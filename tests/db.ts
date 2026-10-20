import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { InviteRpcClient } from "@/lib/invites/claim";
import type { InviteValidateClient } from "@/lib/invites/validate";
import type { OnboardingDbClient } from "@/lib/onboarding/submit";
import type { ListMembersClient } from "@/lib/members/list";
import type { GetProfileClient, SocialKey } from "@/lib/profile/get";
import type { ListInvitesClient } from "@/lib/invites/list";
import type { GenerateInviteClient } from "@/lib/invites/generate";
import type { EmbedResourceDbClient } from "@/lib/people-search/embed-member";
import type { SearchMembersDbClient } from "@/lib/people-search/search-members";
import type { ConversationsDbClient } from "@/lib/people-search/conversations";

// The init migration references `auth.users(id)` because in production
// Supabase owns the auth schema. PGlite doesn't ship with auth, so we
// stub the minimum the schema and the function need.
const STUB_AUTH_SCHEMA = `
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key,
    email text unique
  );
  do $$ begin
    create role anon nologin;
  exception when duplicate_object then null; end $$;
  do $$ begin
    create role authenticated nologin;
  exception when duplicate_object then null; end $$;
  do $$ begin
    create role service_role nologin;
  exception when duplicate_object then null; end $$;
  -- The conversations RLS policies reference auth.uid() (GoTrue provides it in
  -- production). Stub it (returns null) so the policy expressions resolve when
  -- the migration loads. Tests drive the DB through service-role-style adapters
  -- and pglite connects as owner, so RLS is not enforced here regardless.
  create or replace function auth.uid() returns uuid language sql stable as $$
    select null::uuid
  $$;
`;

// People Search (issue #23) exercises pgvector SQL, but the project's PGlite
// (0.5.x) does not ship the vector extension -- the `./vector` subpath was
// dropped after 0.3.x. So the harness substitutes a vector-shaped shim:
// `embedding` is a `double precision[]`, and `match_members` is the same
// retrieval contract (cosine, similarity floor, count, best-first) computed in
// plain SQL instead of via pgvector's `<=>` operator. This still exercises the
// embed / search / persistence seams against real in-memory SQL and real rows;
// only pgvector's operator -- library code, not our logic -- is out of the test.
// The production migrations (20260617120000_profiles_embedding.sql and
// 20260617120100_match_members.sql) remain pure pgvector.
const VECTOR_SHIM = `
  create type resource_classification as enum ('free', 'paid');
  create table resources (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references members(id) on delete cascade,
    description text not null check (description = btrim(description) and char_length(description) between 1 and 255 and description !~ E'[\\n\\r]'),
    classification resource_classification not null,
    position smallint not null check (position >= 0),
    embedding double precision[] not null,
    embedding_input text not null,
    embedded_at timestamptz not null default now(),
    unique (member_id, classification, position)
  );
  create unique index resources_description_unique on resources(member_id, lower(description));
  create function enforce_resource_category_limit() returns trigger language plpgsql as $$
  begin
    if (select count(*) from resources where member_id=new.member_id and classification=new.classification) >= 10 then
      raise exception 'resource_category_limit' using errcode='23514';
    end if;
    return new;
  end $$;
  create trigger resources_category_limit before insert on resources for each row execute function enforce_resource_category_limit();
  alter table profiles drop column skills;
  alter table profiles
    add column profile_context_embedding double precision[],
    add column profile_context_embedding_input text,
    add column profile_context_embedded_at timestamptz;

  create or replace function cosine_similarity(a double precision[], b double precision[])
  returns double precision language sql immutable as $$
    select (select coalesce(sum(x * y), 0) from unnest(a, b) as t(x, y))
         / (sqrt((select sum(x * x) from unnest(a) as x))
            * sqrt((select sum(y * y) from unnest(b) as y)));
  $$;

  create or replace function match_resources(
    query_embedding double precision[],
    match_count int,
    min_similarity float
  )
  returns table (
    member_id uuid,
    first_name text,
    last_name text,
    resource_id uuid,
    description text,
    classification resource_classification,
    similarity float
  )
  language sql stable as $$
    select
      p.member_id, p.first_name, p.last_name, r.id, r.description, r.classification,
      cosine_similarity(r.embedding, query_embedding) as similarity
    from resources r join profiles p on p.member_id = r.member_id
    where cosine_similarity(r.embedding, query_embedding) >= min_similarity
    order by similarity desc
    limit match_count;
  $$;

  create or replace function match_profile_contexts(
    query_embedding double precision[], match_count int, min_similarity float
  ) returns table (
    member_id uuid, first_name text, last_name text, passions text,
    heart_project_description text, heart_project_seeking boolean, similarity float
  ) language sql stable as $$
    select p.member_id, p.first_name, p.last_name, p.passions,
      p.heart_project_description, p.heart_project_seeking,
      cosine_similarity(p.profile_context_embedding, query_embedding) as similarity
    from profiles p
    where p.profile_context_embedding is not null
      and cosine_similarity(p.profile_context_embedding, query_embedding) >= min_similarity
    order by similarity desc limit match_count;
  $$;
`;

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

// Only the schema migration runs in pglite — the extensions migration
// (CREATE EXTENSION vector) needs Supabase. pgvector isn't exercised yet
// in this slice; issue #6 adds the column and its own tests.
const SCHEMA_MIGRATION = "20260615120100_init.sql";
const PROFILES_MIGRATION = "20260615120200_profiles.sql";
const SOCIALS_MIGRATION = "20260616120000_socials.sql";
// People Search (#23). The conversations tables + retention function load
// verbatim (no pgvector). The embedding column + match_members come from
// VECTOR_SHIM above, not their pgvector migrations; the HNSW index and pg_cron
// migrations are production-only and never loaded here.
const CONVERSATIONS_MIGRATION = "20260618120200_conversations.sql";
const RETENTION_MIGRATION = "20260618120300_conversation_retention.sql";
// The member-readable RLS policies (ADR-0006) reference auth.uid(), which pglite
// does not provide, so they are exercised against the real local stack
// (tests/rls-member-readable.test.ts), not here. The list/get *logic* seams
// below run on pglite where RLS is off, which is exactly the boundary we want:
// these tests prove ordering/shape/not-found, the RLS test proves the gate.
// The member-readable RLS migration is deliberately NOT applied here: its
// policy predicate calls auth.uid(), which pglite has no function for, so
// CREATE POLICY would fail. pglite also connects as owner (RLS bypassed), so
// the policies would have no effect anyway.

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB_AUTH_SCHEMA);
  const schema = readFileSync(join(MIGRATIONS_DIR, SCHEMA_MIGRATION), "utf8");
  await db.exec(schema);
  const profiles = readFileSync(join(MIGRATIONS_DIR, PROFILES_MIGRATION), "utf8");
  await db.exec(profiles);
  const socials = readFileSync(join(MIGRATIONS_DIR, SOCIALS_MIGRATION), "utf8");
  await db.exec(socials);
  await db.exec(VECTOR_SHIM);
  const conversations = readFileSync(
    join(MIGRATIONS_DIR, CONVERSATIONS_MIGRATION),
    "utf8",
  );
  await db.exec(conversations);
  const retention = readFileSync(join(MIGRATIONS_DIR, RETENTION_MIGRATION), "utf8");
  await db.exec(retention);
  return db;
}

// Adapt PGlite to the same shape `claimInvite` expects from a Supabase
// client. The server action passes the real `supabase.rpc`; the test
// passes this adapter — both call into the same `claim_invite` function
// over the same SQL, which is the seam the issue calls out.
export function pgliteRpcAdapter(db: PGlite): InviteRpcClient {
  return {
    async rpc(name, args) {
      try {
        const result = await db.query<{ claim_invite: string }>(
          `select claim_invite($1, $2, $3) as claim_invite`,
          [args.p_user_id, args.p_email, args.p_code],
        );
        return { data: result.rows[0].claim_invite, error: null };
      } catch (err) {
        const e = err as { code?: string; message?: string };
        return {
          data: null,
          error: { code: e.code, message: e.message ?? String(err) },
        };
      }
    },
  };
}

export function pgliteValidateAdapter(db: PGlite): InviteValidateClient {
  return {
    async findInvite(code: string) {
      const result = await db.query<{ claimed_by: string | null }>(
        `select claimed_by from invites where code = $1`,
        [code],
      );
      if (result.rows.length === 0) return null;
      return { claimedBy: result.rows[0].claimed_by };
    },
  };
}

export function pgliteOnboardingAdapter(db: PGlite): OnboardingDbClient {
  return {
    async completeOnboarding(data) {
      try {
        await db.exec("begin");
        await db.query(`select claim_invite($1, $2, $3)`, [data.userId, data.email, data.code]);
        await db.query(
          `insert into profiles (member_id, first_name, last_name, location, passions, heart_project_description, heart_project_seeking,
             profile_context_embedding, profile_context_embedding_input, profile_context_embedded_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
          [data.userId, data.firstName, data.lastName, data.location, data.passions,
            data.heartProjectDescription ?? null, data.heartProjectSeeking,
            data.profileContextEmbedding, data.profileContextEmbeddingInput],
        );
        await db.query(
          `insert into socials (member_id, phone, email, website, linkedin, facebook, instagram, x)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [data.userId, data.socials.phone, data.socials.email, data.socials.website,
            data.socials.linkedin, data.socials.facebook, data.socials.instagram, data.socials.x],
        );
        for (const resource of data.resources) {
          await db.query(
            `insert into resources (member_id, description, classification, position, embedding, embedding_input)
             values ($1,$2,$3,$4,$5,$2)`,
            [data.userId, resource.description, resource.classification, resource.position, resource.embedding],
          );
        }
        await db.exec("commit");
        return { error: null };
      } catch (err) {
        await db.exec("rollback").catch(() => undefined);
        const e = err as { code?: string; message?: string };
        return { error: { code: e.code, message: e.message ?? String(err) } };
      }
    },
  };
}

export function pgliteListMembersAdapter(db: PGlite): ListMembersClient {
  return {
    async fetchMemberCards() {
      const result = await db.query<{
        member_id: string;
        first_name: string;
        last_name: string;
        passions: string;
        heart_project_description: string | null;
        heart_project_seeking: boolean;
        resource_description: string | null;
        resource_classification: "free" | "paid" | null;
        resource_position: number | null;
      }>(
        `select p.member_id, p.first_name, p.last_name, p.passions, p.heart_project_description,
                p.heart_project_seeking, r.description as resource_description,
                r.classification as resource_classification, r.position as resource_position
           from profiles p
           left join resources r on r.member_id = p.member_id`,
      );
      const members = new Map<string, {
        id: string;
        name: string;
        passions: string;
        heartProjectDescription: string | null;
        heartProjectSeeking: boolean;
        resources: Array<{ description: string; classification: "free" | "paid"; position: number }>;
      }>();
      for (const r of result.rows) {
        const member = members.get(r.member_id) ?? {
          id: r.member_id,
          name: `${r.first_name} ${r.last_name}`,
          passions: r.passions,
          heartProjectDescription: r.heart_project_description,
          heartProjectSeeking: r.heart_project_seeking,
          resources: [],
        };
        if (r.resource_description && r.resource_classification !== null && r.resource_position !== null) {
          member.resources.push({
            description: r.resource_description,
            classification: r.resource_classification,
            position: r.resource_position,
          });
        }
        members.set(r.member_id, member);
      }
      return {
        data: [...members.values()],
        error: null,
      };
    },
  };
}

export function pgliteGetProfileAdapter(db: PGlite): GetProfileClient {
  return {
    async fetchProfile(memberId) {
      const result = await db.query<{
        member_id: string;
        first_name: string;
        last_name: string;
        location: string;
        passions: string;
        heart_project_description: string | null;
        heart_project_seeking: boolean;
      }>(
        `select member_id, first_name, last_name, location, passions,
                heart_project_description, heart_project_seeking
           from profiles where member_id = $1`,
        [memberId],
      );
      const row = result.rows[0];
      return {
        data: row
          ? {
              id: row.member_id,
              name: `${row.first_name} ${row.last_name}`,
              location: row.location,
              passions: row.passions,
              heartProjectDescription: row.heart_project_description,
              heartProjectSeeking: row.heart_project_seeking,
            }
          : null,
        error: null,
      };
    },
    async fetchSocials(memberId) {
      const result = await db.query<Record<SocialKey, string | null>>(
        `select phone, email, website, linkedin, facebook, instagram, x
           from socials where member_id = $1`,
        [memberId],
      );
      return { data: result.rows[0] ?? null, error: null };
    },
    async fetchResources(memberId) {
      const result = await db.query<{ id: string; description: string; classification: "free" | "paid"; position: number }>(
        `select id, description, classification, position from resources where member_id = $1
         order by classification, position`, [memberId],
      );
      return { data: result.rows, error: null };
    },
  };
}

// Seed a fully-onboarded Member (auth.users + members + profiles, plus an
// optional socials row) directly, so list/get tests start from a known set of
// Members without driving onboarding. Returns the member id.
export async function seedMember(
  db: PGlite,
  opts: {
    firstName: string;
    lastName: string;
    email?: string;
    role?: "member" | "admin";
    location?: string;
    resources?: Array<{ description: string; classification: "free" | "paid"; embedding?: number[] }>;
    skills?: string;
    passions?: string;
    heartProjectDescription?: string | null;
    heartProjectSeeking?: boolean;
    socials?: Partial<Record<SocialKey, string>>;
    // Pre-set the People Search embedding (the shim's double precision[]), so a
    // search test starts from members that are already findable.
    embedding?: number[];
    profileContextEmbedding?: number[];
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const email = opts.email ?? `${id}@example.com`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [
    id,
    email,
  ]);
  await db.query(`insert into members (id, email, role) values ($1, $2, $3)`, [
    id,
    email,
    opts.role ?? "member",
  ]);
  await db.query(
    `insert into profiles
       (member_id, first_name, last_name, location, passions, heart_project_description, heart_project_seeking,
        profile_context_embedding, profile_context_embedding_input, profile_context_embedded_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
    [
      id,
      opts.firstName,
      opts.lastName,
      opts.location ?? "Bucharest",
      opts.passions ?? "passions",
      opts.heartProjectDescription ?? null,
      opts.heartProjectSeeking ?? false,
      opts.profileContextEmbedding ?? opts.embedding ?? [0, 0, 1],
      `Pasiuni: ${opts.passions ?? "passions"}`,
    ],
  );
  const resources = opts.resources ?? [{ description: opts.skills ?? "Community resource", classification: "free" as const, embedding: opts.embedding }];
  for (const [position, resource] of resources.entries()) {
    await db.query(
      `insert into resources (member_id, description, classification, position, embedding, embedding_input)
       values ($1,$2,$3,$4,$5,$2)`,
      [id, resource.description, resource.classification, position, resource.embedding ?? [0, 0, 1]],
    );
  }
  if (opts.socials) {
    const keys: SocialKey[] = [
      "phone",
      "email",
      "website",
      "linkedin",
      "facebook",
      "instagram",
      "x",
    ];
    await db.query(
      `insert into socials (member_id, phone, email, website, linkedin, facebook, instagram, x)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, ...keys.map((k) => opts.socials?.[k] ?? null)],
    );
  }
  return id;
}

// Adapt PGlite to the invite-listing seam. Left-joins each invite to the
// claimer's and generator's profile so listInvites can resolve display names;
// missing joins (PENDING, or a legacy null generator) come back null.
export function pgliteListInvitesAdapter(db: PGlite): ListInvitesClient {
  return {
    async fetchInvites() {
      const result = await db.query<{
        code: string;
        created_at: string | Date;
        claimed_by: string | null;
        claimer_first: string | null;
        claimer_last: string | null;
        gen_first: string | null;
        gen_last: string | null;
      }>(
        `select i.code, i.created_at, i.claimed_by,
                c.first_name as claimer_first, c.last_name as claimer_last,
                g.first_name as gen_first, g.last_name as gen_last
           from invites i
           left join profiles c on c.member_id = i.claimed_by
           left join profiles g on g.member_id = i.generated_by`,
      );
      return {
        data: result.rows.map((r) => ({
          code: r.code,
          createdAt: new Date(r.created_at).toISOString(),
          claimed: r.claimed_by != null,
          claimerFirstName: r.claimer_first,
          claimerLastName: r.claimer_last,
          generatorFirstName: r.gen_first,
          generatorLastName: r.gen_last,
        })),
        error: null,
      };
    },
  };
}

// People Search (#23) adapters: PGlite over the lib client interfaces, mirroring
// the onboarding/profile adapters above. embedMember and searchMembers read/write
// the shimmed `embedding` (double precision[]) and the shimmed match_members.

export function pgliteEmbedResourceAdapter(db: PGlite): EmbedResourceDbClient {
  return {
    async getResource(id) {
      const result = await db.query<{ description: string }>(
        `select description from resources where id = $1`, [id],
      );
      return { data: result.rows[0] ?? null, error: null };
    },
    async writeEmbedding({ id, embedding, embeddingInput }) {
      await db.query(
        `update resources
            set embedding = $2, embedding_input = $3, embedded_at = now()
          where id = $1`,
        [id, embedding, embeddingInput],
      );
      return { error: null };
    },
  };
}

export function pgliteSearchMembersAdapter(db: PGlite): SearchMembersDbClient {
  return {
    async matchResources({ queryEmbedding, matchCount, minSimilarity }) {
      const result = await db.query<{
        member_id: string;
        first_name: string;
        last_name: string;
        resource_id: string;
        description: string;
        classification: "free" | "paid";
        similarity: number;
      }>(`select * from match_resources($1, $2, $3)`, [
        queryEmbedding,
        matchCount,
        minSimilarity,
      ]);
      return {
        data: result.rows.map((r) => ({
          memberId: r.member_id,
          firstName: r.first_name,
          lastName: r.last_name,
          resourceId: r.resource_id,
          description: r.description,
          classification: r.classification,
          similarity: r.similarity,
        })),
        error: null,
      };
    },
    async matchProfileContexts({ queryEmbedding, matchCount, minSimilarity }) {
      const result = await db.query<{
        member_id: string; first_name: string; last_name: string; passions: string; similarity: number;
      }>(`select * from match_profile_contexts($1, $2, $3)`, [queryEmbedding, matchCount, minSimilarity]);
      return { data: result.rows.map((r) => ({
        memberId: r.member_id, firstName: r.first_name, lastName: r.last_name,
        passions: r.passions, similarity: r.similarity,
      })), error: null };
    },
    async matchHeartProjects() {
      return { data: [], error: null };
    },
  };
}

// Adapt PGlite to the invite-generation seam. Inserts the new code; a duplicate
// `code` primary key surfaces as a Postgres unique_violation (23505), which is
// exactly the collision generateInvite retries on.
export function pgliteGenerateInviteAdapter(db: PGlite): GenerateInviteClient {
  return {
    async insertInvite(code, adminId) {
      try {
        await db.query(
          `insert into invites (code, generated_by) values ($1, $2)`,
          [code, adminId],
        );
        return { error: null };
      } catch (err) {
        const e = err as { code?: string; message?: string };
        return {
          error: { code: e.code, message: e.message ?? String(err) },
        };
      }
    },
  };
}

export function pgliteConversationsAdapter(db: PGlite): ConversationsDbClient {
  return {
    async createConversation(memberId) {
      const result = await db.query<{ id: string }>(
        `insert into conversations (member_id) values ($1) returning id`,
        [memberId],
      );
      return { id: result.rows[0].id };
    },
    async countMemberMessages(conversationId) {
      const result = await db.query<{ count: number }>(
        `select count(*)::int as count from messages
          where conversation_id = $1 and role = 'user'`,
        [conversationId],
      );
      return result.rows[0].count;
    },
    async insertMessage({ conversationId, role, content }) {
      await db.query(
        `insert into messages (conversation_id, role, content) values ($1, $2, $3)`,
        [conversationId, role, content],
      );
    },
    async touchConversation(conversationId) {
      await db.query(
        `update conversations set last_message_at = now() where id = $1`,
        [conversationId],
      );
    },
    async setTitle(conversationId, title) {
      await db.query(`update conversations set title = $2 where id = $1`, [
        conversationId,
        title,
      ]);
    },
    async deleteConversation(conversationId) {
      await db.query(`delete from conversations where id = $1`, [conversationId]);
    },
    async listMessages(conversationId) {
      const result = await db.query<{ role: "user" | "assistant"; content: string }>(
        `select role, content from messages
          where conversation_id = $1 order by id asc`,
        [conversationId],
      );
      return result.rows.map((r) => ({ role: r.role, content: r.content }));
    },
    async listConversations(memberId) {
      const result = await db.query<{
        id: string;
        title: string | null;
        last_message_at: string;
      }>(
        `select id, title, last_message_at from conversations
          where member_id = $1 order by last_message_at desc`,
        [memberId],
      );
      return result.rows.map((r) => ({
        id: r.id,
        title: r.title,
        lastMessageAt: r.last_message_at,
      }));
    },
    async deleteExpiredConversations() {
      await db.query(`select delete_expired_conversations()`);
    },
  };
}

// Seed an invite row with explicit claim/generation/timestamp state, so a list
// test can build a known mix of PENDING and claimed invites across times.
export async function seedInvite(
  db: PGlite,
  opts: {
    code: string;
    createdAt?: string; // ISO; defaults to now()
    claimedBy?: string | null; // member id, or null for PENDING
    generatedBy?: string | null; // member id, or null for a legacy invite
  },
): Promise<void> {
  await db.query(
    `insert into invites (code, claimed_by, claimed_at, generated_by, created_at)
     values ($1, $2, $3, $4, coalesce($5, now()))`,
    [
      opts.code,
      opts.claimedBy ?? null,
      opts.claimedBy ? new Date().toISOString() : null,
      opts.generatedBy ?? null,
      opts.createdAt ?? null,
    ],
  );
}

// Seed an auth.users row + an unclaimed invite. Returns the user id and
// the code so a test can drive a claim from a known starting state.
export async function seedUnclaimedInvite(
  db: PGlite,
  opts: { code: string; email: string },
): Promise<{ userId: string; email: string; code: string }> {
  const userId = crypto.randomUUID();
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [
    userId,
    opts.email,
  ]);
  await db.query(`insert into invites (code) values ($1)`, [opts.code]);
  return { userId, email: opts.email, code: opts.code };
}
