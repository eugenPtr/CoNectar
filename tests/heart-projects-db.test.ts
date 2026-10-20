import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const anon = process.env.SUPABASE_LOCAL_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const auth = { persistSession: false, autoRefreshToken: false } as const;
const service = createClient(url, serviceKey, { auth });
const vector = (axis: number) => JSON.stringify(Array.from({ length: 1536 }, (_, i) => i === axis ? 1 : 0));
const suffix = crypto.randomUUID().slice(0, 8);
const password = "heart-project-test-password";
let memberId = "";
let adminId = "";
let outsiderId = "";
let member: SupabaseClient;
let admin: SupabaseClient;
let outsider: SupabaseClient;
const themeIds: string[] = [];

describe("Heart Project and Theme database boundary (live local stack)", () => {
  beforeAll(async () => {
    async function user(kind: string, role?: "admin") {
      const email = `heart-${kind}-${suffix}@example.com`;
      const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw created.error;
      if (role || kind === "member") {
        const inserted = await service.from("members").insert({ id: created.data.user.id, email, role: role ?? "member" });
        if (inserted.error) throw inserted.error;
      }
      const client = createClient(url, anon, { auth });
      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;
      return { id: created.data.user.id, client };
    }
    ({ id: memberId, client: member } = await user("member"));
    ({ id: adminId, client: admin } = await user("admin", "admin"));
    ({ id: outsiderId, client: outsider } = await user("outsider"));
    const profile = await service.from("profiles").insert({ member_id: memberId, first_name: "Ana", last_name: "Pop", location: "Cluj", passions: "Dans", heart_project_seeking: false });
    if (profile.error) throw profile.error;
  });

  afterAll(async () => {
    for (const id of themeIds) await service.from("themes").delete().eq("id", id);
    for (const id of [memberId, adminId, outsiderId]) if (id) await service.auth.admin.deleteUser(id);
  });

  it("restricts catalog writes and map reads, and recomputes multi-theme links on archive", async () => {
    const denied = await member.from("themes").insert({ name: `Dans ${suffix}`, description: "Spații de dans", embedding: vector(0), embedding_input: "Dans" });
    expect(denied.error).not.toBeNull();
    for (const [name, axis] of [["Dans", 0], ["Terapie", 0], ["Agricultură", 1]] as const) {
      const inserted = await admin.from("themes").insert({ name: `${name} ${suffix}`, description: `${name} comunitar`, embedding: vector(axis), embedding_input: name }).select("id").single();
      expect(inserted.error).toBeNull();
      themeIds.push(inserted.data!.id);
    }
    const projectId = crypto.randomUUID();
    const saved = await member.rpc("replace_own_heart_projects", { p_projects: [{ id: projectId, title: "Dans", description: "Spațiu de dans", position: 0, embedding: vector(0), embedding_input: "Dans\nSpațiu de dans" }] });
    expect(saved.error).toBeNull();
    const pursuitMatches = await member.rpc("match_heart_projects", {
      query_embedding: vector(0), match_count: 10, min_similarity: 0.3,
    });
    expect(pursuitMatches.error).toBeNull();
    expect(pursuitMatches.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ project_id: projectId, title: "Dans", member_id: memberId }),
    ]));
    const outsiderMatches = await outsider.rpc("match_heart_projects", {
      query_embedding: vector(0), match_count: 10, min_similarity: 0.3,
    });
    expect(outsiderMatches.data ?? []).toEqual([]);
    const links = await member.from("heart_project_theme_links").select("theme_id, similarity, match_version").eq("heart_project_id", projectId);
    expect(links.error).toBeNull();
    expect(links.data?.map((link) => link.theme_id).sort()).toEqual(themeIds.slice(0, 2).sort());
    const hidden = await outsider.from("heart_projects").select("id");
    expect(hidden.data).toEqual([]);
    const directWrite = await member.from("heart_projects").insert({ member_id: memberId, title: "Direct", description: "Bypass", position: 1, embedding: vector(0), embedding_input: "Direct\nBypass" });
    expect(directWrite.error).not.toBeNull();
    const archived = await admin.from("themes").update({ archived_at: new Date().toISOString() }).eq("id", themeIds[0]);
    expect(archived.error).toBeNull();
    const after = await member.from("heart_project_theme_links").select("theme_id").eq("heart_project_id", projectId);
    expect(after.data).toEqual([{ theme_id: themeIds[1] }]);
  });
});
