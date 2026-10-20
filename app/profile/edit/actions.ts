"use server";

import { redirect } from "next/navigation";
import { isPossiblePhoneNumber, parsePhoneNumber } from "libphonenumber-js/max";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gatewayEmbedder } from "@/lib/people-search/ai-gateway";
import { buildProfileContextEmbeddingInput } from "@/lib/people-search/embedding-input";
import { serializeEmbedding } from "@/lib/people-search/serialize-embedding";
import { normalizeResources } from "@/lib/resources/model";
import { withPersistedResourceId } from "@/lib/resources/persistence";
import { validateProfilePhoto } from "@/lib/profile/photo";
import { normalizeHeartProjects, prepareHeartProjects, supabaseHeartProjectClient, type HeartProjectInput } from "@/lib/heart-projects/save";

export async function saveProfileAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" } as const;
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const passions = String(formData.get("passions") ?? "").trim();
  const heartProjectSeeking = formData.get("heart_project_seeking") === "true";
  const heartProjects = heartProjectSeeking ? [] : JSON.parse(String(formData.get("heart_projects") ?? "[]")) as HeartProjectInput[];
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("contact_email") ?? "").trim();
  const communityIds = JSON.parse(String(formData.get("community_ids") ?? "[]")) as string[];
  const rawResources = JSON.parse(String(formData.get("resources") ?? "[]")) as Array<{ id?: string; description: string; classification: "free" | "paid" }>;
  const resources = normalizeResources(rawResources);
  if (!firstName || !lastName || !location || !passions || (!heartProjectSeeking && !heartProjects.length) || !normalizeHeartProjects(heartProjects) ||
    !phone.startsWith("+") || !isPossiblePhoneNumber(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    communityIds.length < 1 || !resources) return { kind: "invalid" } as const;

  const [{ data: currentProfile }, { data: currentResources }] = await Promise.all([
    supabase.from("profiles").select("profile_photo_path, profile_context_embedding_input, profile_context_embedding").eq("member_id", user.id).single(),
    supabase.from("resources").select("id, embedding, embedding_input").eq("member_id", user.id),
  ]);
  const contextInput = buildProfileContextEmbeddingInput({ passions, heartProjectSeeking });
  let contextEmbedding;
  let indexedProjects;
  try {
    [contextEmbedding, indexedProjects] = await Promise.all([
      currentProfile?.profile_context_embedding_input === contextInput
        ? Promise.resolve(currentProfile.profile_context_embedding) : gatewayEmbedder(contextInput),
      prepareHeartProjects({ db: supabaseHeartProjectClient(supabase), embedder: gatewayEmbedder }, { memberId: user.id, projects: heartProjects }),
    ]);
    if (!indexedProjects) return { kind: "invalid" } as const;
  } catch (error) {
    console.error("Heart Project indexing failed", error);
    return { kind: "failed" } as const;
  }
  const existing = new Map((currentResources ?? []).map((resource) => [resource.id, resource]));
  const positions = { free: 0, paid: 0 };
  let indexed;
  try { indexed = await Promise.all(resources.map(async (resource, index) => {
    const id = rawResources[index]?.id && existing.has(rawResources[index].id!) ? rawResources[index].id! : crypto.randomUUID();
    const previous = existing.get(id);
    return { ...withPersistedResourceId(resource, id), position: positions[resource.classification]++, embedding: serializeEmbedding(previous?.embedding_input === resource.description ? previous.embedding : await gatewayEmbedder(resource.description)), embedding_input: resource.description };
  })); } catch (error) { console.error("Resource indexing failed", error); return { kind: "failed" } as const; }

  const photo = formData.get("profile_photo");
  let newPath: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    const valid = await validateProfilePhoto(photo);
    if (!valid) return { kind: "invalidPhoto" } as const;
    newPath = `${user.id}/${crypto.randomUUID()}.${valid.extension}`;
    const { error } = await supabase.storage.from("profile-photos").upload(newPath, photo, { contentType: photo.type, upsert: false });
    if (error) return { kind: "photoUploadFailed" } as const;
  }

  const socials = Object.fromEntries(["website", "linkedin", "facebook", "instagram", "x"].map((key) => [key, String(formData.get(key) ?? "").trim()]));
  const { error } = await supabase.rpc("update_own_profile", {
    p_profile: { first_name: firstName, last_name: lastName, location, passions, heart_project_description: "",
      heart_project_seeking: heartProjectSeeking, profile_photo_path: newPath ?? "", profile_context_embedding: serializeEmbedding(contextEmbedding), profile_context_embedding_input: contextInput },
    p_socials: { ...socials, phone: parsePhoneNumber(phone).number, email },
    p_resources: indexed,
    p_projects: indexedProjects.map((project) => ({ ...project, embedding: serializeEmbedding(project.embedding), embedding_input: project.embeddingInput })),
    p_community_ids: communityIds,
  });
  if (error) {
    if (newPath) await supabase.storage.from("profile-photos").remove([newPath]);
    return { kind: "failed" } as const;
  }
  if (newPath && currentProfile?.profile_photo_path) await supabase.storage.from("profile-photos").remove([currentProfile.profile_photo_path]);
  redirect("/profile?sent=profile-updated");
}
