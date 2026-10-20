import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resource } from "@/lib/resources/model";
import type { HeartProject } from "@/lib/heart-projects/save";

// The Social Links a Profile can publish, in display order. The same order the
// Profile page renders them in; a link absent from the map was never published
// and is omitted entirely (issue #17), never shown as an empty row.
export const SOCIAL_KEYS = [
  "phone",
  "email",
  "website",
  "linkedin",
  "facebook",
  "instagram",
  "x",
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export interface MemberProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  location: string;
  passions: string;
  heartProjectDescription: string | null;
  heartProjectSeeking: boolean;
  profilePhotoPath?: string | null;
  photoUrl?: string | null;
  communities?: Array<{ id: string; name: string }>;
  // Only the Social Links the Member actually set. Absent key = not published.
  socials: Partial<Record<SocialKey, string>>;
  resources: Resource[];
  heartProjects: HeartProject[];
}

interface ProfileRow {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  location: string;
  passions: string;
  heartProjectDescription: string | null;
  heartProjectSeeking: boolean;
  profilePhotoPath?: string | null;
  photoUrl?: string | null;
}

export interface GetProfileClient {
  fetchProfile(memberId: string): PromiseLike<{
    data: ProfileRow | null;
    error: { message: string } | null;
  }>;
  fetchSocials(memberId: string): PromiseLike<{
    data: Record<SocialKey, string | null> | null;
    error: { message: string } | null;
  }>;
  fetchResources(memberId: string): PromiseLike<{
    data: Resource[] | null;
    error: { message: string } | null;
  }>;
  fetchHeartProjects?(memberId: string): PromiseLike<{
    data: HeartProject[] | null;
    error: { message: string } | null;
  }>;
  fetchCommunities?(memberId: string): PromiseLike<{
    data: Array<{ id: string; name: string }> | null;
    error: { message: string } | null;
  }>;
}

// A Member's full published Profile, or null when no Member has that id (a
// broken or stale link). Only the Social Links that are set come back, so the
// page never has to decide what "empty" means.
export async function getProfile(
  client: GetProfileClient,
  memberId: string,
): Promise<MemberProfile | null> {
  const { data: profile, error } = await client.fetchProfile(memberId);
  if (error) throw new Error(`getProfile failed: ${error.message}`);
  if (!profile) return null;

  const { data: socialsRow, error: socialsError } =
    await client.fetchSocials(memberId);
  if (socialsError) {
    throw new Error(`getProfile socials failed: ${socialsError.message}`);
  }
  const { data: resources, error: resourcesError } = await client.fetchResources(memberId);
  if (resourcesError) throw new Error(`getProfile resources failed: ${resourcesError.message}`);
  const { data: heartProjects, error: projectsError } = client.fetchHeartProjects
    ? await client.fetchHeartProjects(memberId) : { data: [], error: null };
  if (projectsError) throw new Error(`getProfile Heart Projects failed: ${projectsError.message}`);
  const { data: communities, error: communitiesError } = client.fetchCommunities
    ? await client.fetchCommunities(memberId) : { data: [], error: null };
  if (communitiesError) throw new Error(`getProfile communities failed: ${communitiesError.message}`);

  const socials: Partial<Record<SocialKey, string>> = {};
  if (socialsRow) {
    for (const key of SOCIAL_KEYS) {
      const value = socialsRow[key];
      if (value && value.trim()) socials[key] = value;
    }
  }

  return { ...profile, socials, resources: resources ?? [], heartProjects: heartProjects ?? [], communities: communities ?? [] };
}

// Production adapter over the cookie-bound server client (ADR-0006 RLS).
export function supabaseGetProfileClient(
  supabase: SupabaseClient,
): GetProfileClient {
  return {
    async fetchProfile(memberId) {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "member_id, first_name, last_name, location, passions, heart_project_description, heart_project_seeking, profile_photo_path",
        )
        .eq("member_id", memberId)
        .maybeSingle();
      const signed = data?.profile_photo_path
        ? await supabase.storage.from("profile-photos").createSignedUrl(data.profile_photo_path, 3600)
        : null;
      return {
        data: data
          ? {
              id: data.member_id,
              name: `${data.first_name} ${data.last_name}`,
              firstName: data.first_name,
              lastName: data.last_name,
              location: data.location,
              passions: data.passions,
              heartProjectDescription: data.heart_project_description,
              heartProjectSeeking: data.heart_project_seeking,
              profilePhotoPath: data.profile_photo_path,
              photoUrl: signed?.data?.signedUrl ?? null,
            }
          : null,
        error: error ? { message: error.message } : null,
      };
    },
    async fetchSocials(memberId) {
      const { data, error } = await supabase
        .from("socials")
        .select("phone, email, website, linkedin, facebook, instagram, x")
        .eq("member_id", memberId)
        .maybeSingle();
      return {
        data: data ?? null,
        error: error ? { message: error.message } : null,
      };
    },
    async fetchResources(memberId) {
      const { data, error } = await supabase.from("resources")
        .select("id, description, classification, position")
        .eq("member_id", memberId)
        .order("classification", { ascending: true })
        .order("position", { ascending: true });
      return { data: data as Resource[] | null, error: error ? { message: error.message } : null };
    },
    async fetchHeartProjects(memberId) {
      const { data, error } = await supabase.from("heart_projects")
        .select("id, title, description, position").eq("member_id", memberId).order("position");
      return { data: data as HeartProject[] | null, error: error ? { message: error.message } : null };
    },
    async fetchCommunities(memberId) {
      const { data, error } = await supabase.from("profile_community_affiliations")
        .select("affiliated_communities!inner(id, name)").eq("member_id", memberId);
      return {
        data: data?.map((row) => {
          const community = Array.isArray(row.affiliated_communities)
            ? row.affiliated_communities[0] : row.affiliated_communities;
          return { id: community.id, name: community.name };
        }).sort((a, b) => a.name.localeCompare(b.name, "ro")) ?? null,
        error: error ? { message: error.message } : null,
      };
    },
  };
}
