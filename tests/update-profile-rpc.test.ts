import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.SUPABASE_LOCAL_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const auth = { persistSession: false, autoRefreshToken: false } as const;
const service = createClient(URL, SERVICE_KEY, { auth });
const password = "profile-rpc-test-password";
const suffix = crypto.randomUUID().slice(0, 8);
const email = `profile-rpc-${suffix}@example.com`;
const embedding = Array(1536).fill(0);

let memberId = "";
let communityId = "";
let resourceId = "";
let client: SupabaseClient;

describe("update_own_profile RPC (live local stack)", () => {
  beforeAll(async () => {
    const user = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (user.error) throw user.error;
    memberId = user.data.user.id;

    const member = await service.from("members").insert({ id: memberId, email });
    if (member.error) throw member.error;
    const profile = await service.from("profiles").insert({
      member_id: memberId,
      first_name: "Before",
      last_name: "Update",
      location: "Brașov",
      passions: "Testing",
      heart_project_description: null,
      heart_project_seeking: true,
      profile_context_embedding: JSON.stringify(embedding),
      profile_context_embedding_input: "Testing\nSeeking a Heart Project",
      profile_context_embedded_at: new Date().toISOString(),
    });
    if (profile.error) throw profile.error;
    const social = await service.from("socials").insert({
      member_id: memberId,
      phone: "+40722000000",
      email,
    });
    if (social.error) throw social.error;
    const community = await service
      .from("affiliated_communities")
      .insert({ name: `Profile RPC ${suffix}` })
      .select("id")
      .single();
    if (community.error) throw community.error;
    communityId = community.data.id;
    const affiliation = await service
      .from("profile_community_affiliations")
      .insert({ member_id: memberId, community_id: communityId });
    if (affiliation.error) throw affiliation.error;
    const resource = await service
      .from("resources")
      .insert({
        member_id: memberId,
        description: "Testare profil",
        classification: "free",
        position: 0,
        embedding: JSON.stringify(embedding),
        embedding_input: "Testare profil",
      })
      .select("id")
      .single();
    if (resource.error) throw resource.error;
    resourceId = resource.data.id;

    client = createClient(URL, ANON_KEY, { auth });
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  });

  afterAll(async () => {
    if (memberId) await service.auth.admin.deleteUser(memberId);
    if (communityId) {
      await service.from("affiliated_communities").delete().eq("id", communityId);
    }
  });

  it("updates the renamed profile context timestamp column", async () => {
    const result = await client.rpc("update_own_profile", {
      p_profile: {
        first_name: "After",
        last_name: "Update",
        location: "Brașov",
        passions: "Testing",
        heart_project_description: "",
        heart_project_seeking: true,
        profile_photo_path: "",
        profile_context_embedding: JSON.stringify(embedding),
        profile_context_embedding_input: "Testing\nSeeking a Heart Project",
      },
      p_socials: {
        phone: "+40722000000",
        email,
        website: "",
        linkedin: "",
        facebook: "",
        instagram: "",
        x: "",
      },
      p_resources: [
        {
          id: resourceId,
          description: "Testare profil",
          classification: "free",
          position: 0,
          embedding: JSON.stringify(embedding),
          embedding_input: "Testare profil",
        },
      ],
      p_community_ids: [communityId],
      p_projects: [{ id: crypto.randomUUID(), title: "Dans", description: "Spațiu de dans", position: 0,
        embedding: JSON.stringify(embedding), embedding_input: "Dans\nSpațiu de dans" }],
    });

    expect(result.error).toBeNull();
    const saved = await service
      .from("profiles")
      .select("first_name, profile_context_embedded_at")
      .eq("member_id", memberId)
      .single();
    expect(saved.error).toBeNull();
    expect(saved.data?.first_name).toBe("After");
    expect(saved.data?.profile_context_embedded_at).not.toBeNull();
    const projects = await client.from("heart_projects").select("title, description, position").eq("member_id", memberId);
    expect(projects.error).toBeNull();
    expect(projects.data).toEqual([{ title: "Dans", description: "Spațiu de dans", position: 0 }]);

    const failed = await client.rpc("update_own_profile", {
      p_profile: { first_name: "Should Roll Back", last_name: "Update", location: "Brașov", passions: "Testing",
        heart_project_description: "", heart_project_seeking: true, profile_photo_path: "",
        profile_context_embedding: JSON.stringify(embedding), profile_context_embedding_input: "Pasiuni: Testing" },
      p_socials: { phone: "+40722000000", email },
      p_resources: [{ id: resourceId, description: "Testare profil", classification: "free", position: 0,
        embedding: JSON.stringify(embedding), embedding_input: "Testare profil" }],
      p_community_ids: [communityId],
      p_projects: [{ id: crypto.randomUUID(), title: "", description: "Invalid", position: 0,
        embedding: JSON.stringify(embedding), embedding_input: "\nInvalid" }],
    });
    expect(failed.error).not.toBeNull();
    const afterFailure = await service.from("profiles").select("first_name").eq("member_id", memberId).single();
    expect(afterFailure.data?.first_name).toBe("After");
    const projectsAfterFailure = await service.from("heart_projects").select("title").eq("member_id", memberId);
    expect(projectsAfterFailure.data).toEqual([{ title: "Dans" }]);
  });
});
