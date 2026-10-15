import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./db";

const code = "UNIV-EXAMPLE";

async function complete(db: PGlite, userId: string, email: string, inviteCode: string, universal: boolean) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [userId, email]);
  const communities = await db.query<{ id: string }>("select id from affiliated_communities limit 1");
  return db.query(
    "select complete_onboarding($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::uuid[],$8)",
    [userId, email, inviteCode,
      JSON.stringify({ first_name: "Alex", last_name: "Example", location: "București",
        passions: "Technology", heart_project_seeking: true,
        profile_context_embedding: "{1,0,0}", profile_context_embedding_input: "profile" }),
      JSON.stringify({ phone: "+40721234567", email }),
      JSON.stringify([{ description: "Mentorat", classification: "free", position: 0, embedding: "{1,0,0}" }]),
      [communities.rows[0].id], universal],
  );
}

describe("universal invite onboarding migration", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
    await db.exec(`
      alter table profiles add column profile_photo_path text;
      create table affiliated_communities (id uuid primary key default gen_random_uuid(), name text not null);
      insert into affiliated_communities (name) values ('Comunitate');
      create table profile_community_affiliations (
        member_id uuid references members(id), community_id uuid references affiliated_communities(id),
        primary key (member_id, community_id)
      );
      create function complete_onboarding(uuid,text,text,jsonb,jsonb,jsonb,uuid[])
      returns uuid language sql as $$ select null::uuid $$;
    `);
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20261015160000_universal_invite.sql"), "utf8",
    );
    await db.exec(migration.replaceAll("::vector", "::double precision[]"));
    const privateAttributionMigration = readFileSync(
      join(process.cwd(), "supabase/migrations/20261015170000_private_universal_invite_attribution.sql"), "utf8",
    );
    await db.exec(privateAttributionMigration.replaceAll("::vector", "::double precision[]"));
  });

  afterEach(async () => {
    await db.close();
  });

  it("allows repeated use and records each exact universal code", async () => {
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    await complete(db, first, "first@example.com", code, true);
    await complete(db, second, "second@example.com", code, true);

    const signups = await db.query<{ member_id: string; code: string }>(
      "select member_id, code from universal_invite_signups order by member_id",
    );
    expect(signups.rows).toHaveLength(2);
    expect(signups.rows.map((row) => row.member_id).sort()).toEqual([first, second].sort());
    expect(signups.rows.every((row) => row.code === code)).toBe(true);
    expect((await db.query("select * from members limit 1")).fields.map((field) => field.name))
      .not.toContain("universal_invite_code");
    expect((await db.query("select * from invites where code = $1", [code])).rows).toHaveLength(0);
  });

  it("continues to claim ordinary invites once", async () => {
    const inviteCode = "INV-TEST-0001";
    await db.query("insert into invites (code) values ($1)", [inviteCode]);
    const first = crypto.randomUUID();
    await complete(db, first, "ordinary@example.com", inviteCode, false);
    expect((await db.query("select * from universal_invite_signups where member_id = $1", [first])).rows)
      .toHaveLength(0);
    const second = crypto.randomUUID();
    await expect(complete(db, second, "second@example.com", inviteCode, false))
      .rejects.toMatchObject({ code: "P0002" });
  });

  it("rejects a code collision without creating a member", async () => {
    await db.query("insert into invites (code) values ($1)", [code]);
    const userId = crypto.randomUUID();
    await expect(complete(db, userId, "collision@example.com", code, true))
      .rejects.toMatchObject({ code: "P0004" });
    expect((await db.query("select id from members where id = $1", [userId])).rows).toHaveLength(0);
  });
});
