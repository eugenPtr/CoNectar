"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { OnboardingInfrastructureError, submitOnboarding } from "@/lib/onboarding/submit";
import { gatewayEmbedder } from "@/lib/people-search/ai-gateway";
import { parseResourceLines } from "@/lib/resources/model";
import { validateProfilePhoto } from "@/lib/profile/photo";
import { supabaseInviteValidateClient, validateInvite } from "@/lib/invites/validate";
import { isUniversalInviteCode, universalInviteConfig } from "@/lib/invites/universal";
import type { HeartProjectInput } from "@/lib/heart-projects/save";

export type SubmitOnboardingActionResult =
  | { kind: "ok" }
  | { kind: "invalidPhoto" }
  | { kind: "photoUploadFailed" }
  | { kind: "missingFields" }
  | { kind: "alreadyClaimed" }
  | { kind: "invalidCode" }
  | { kind: "embeddingFailed"; reference: string }
  | { kind: "submissionFailed"; reference: string };

function diagnosticReference() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

function constraintName(message: string) {
  return message.match(/constraint ["']([^"']+)["']/i)?.[1];
}

export async function submitOnboardingAction(
  formData: FormData,
): Promise<SubmitOnboardingActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) redirect("/sign-in");

  const code = String(formData.get("invite") ?? "").trim();
  const service = await createSupabaseServiceClient();
  const config = universalInviteConfig();
  const isUniversal = isUniversalInviteCode(code, config);
  const photo = formData.get("profile_photo");
  let profilePhotoPath: string | undefined;

  try {
    const validation = await validateInvite(supabaseInviteValidateClient(service), code, config);
    if (validation.kind === "already-claimed") return { kind: "alreadyClaimed" };
    if (validation.kind !== "valid") return { kind: "invalidCode" };

    if (photo instanceof File && photo.size > 0) {
      const valid = await validateProfilePhoto(photo);
      if (!valid) return { kind: "invalidPhoto" };
      profilePhotoPath = `${data.user.id}/${crypto.randomUUID()}.${valid.extension}`;
      const { error } = await service.storage.from("profile-photos").upload(
        profilePhotoPath,
        photo,
        { contentType: photo.type, upsert: false },
      );
      if (error) return { kind: "photoUploadFailed" };
    }

    const result = await submitOnboarding(
      {
        embedder: gatewayEmbedder,
        db: {
          async completeOnboarding(payload) {
            const { error } = await service.rpc("complete_onboarding", {
              p_user_id: payload.userId,
              p_email: payload.email,
              p_code: payload.code,
              p_is_universal: isUniversal,
              p_profile: {
                first_name: payload.firstName,
                last_name: payload.lastName,
                location: payload.location,
                passions: payload.passions,
                heart_project_description: "",
                heart_project_seeking: payload.heartProjectSeeking,
                profile_context_embedding: JSON.stringify(payload.profileContextEmbedding),
                profile_context_embedding_input: payload.profileContextEmbeddingInput,
                profile_photo_path: payload.profilePhotoPath ?? "",
              },
              p_socials: payload.socials,
              p_resources: payload.resources.map((resource) => ({
                ...resource,
                embedding: JSON.stringify(resource.embedding),
              })),
              p_projects: payload.projects.map((project) => ({ ...project, embedding: JSON.stringify(project.embedding), embedding_input: project.embeddingInput })),
              p_community_ids: payload.communityIds,
            });
            return { error: error ? { code: error.code, message: error.message } : null };
          },
        },
      },
      {
        userId: data.user.id,
        email: data.user.email,
        code,
        firstName: String(formData.get("first_name") ?? "").trim(),
        lastName: String(formData.get("last_name") ?? "").trim(),
        location: String(formData.get("location") ?? "").trim(),
        passions: String(formData.get("passions") ?? "").trim(),
        heartProjectSeeking: formData.get("heart_project_seeking") === "true",
        heartProjects: formData.get("heart_project_seeking") === "true" ? [] : JSON.parse(String(formData.get("heart_projects") ?? "[]")) as HeartProjectInput[],
        resources: parseResourceLines(
          String(formData.get("free_resources") ?? ""),
          String(formData.get("paid_resources") ?? ""),
        ),
        socials: Object.fromEntries(
          ["phone", "contact_email", "website", "linkedin", "facebook", "instagram", "x"].map(
            (key) => [key === "contact_email" ? "email" : key, String(formData.get(key) ?? "")],
          ),
        ),
        communityIds: JSON.parse(String(formData.get("community_ids") ?? "[]")) as string[],
        profilePhotoPath,
      },
    );

    if (result.kind !== "ok" && profilePhotoPath) {
      await cleanupPhoto(service, profilePhotoPath);
    }
    return result;
  } catch (error) {
    if (profilePhotoPath) await cleanupPhoto(service, profilePhotoPath);
    const reference = diagnosticReference();
    const infrastructureError = error instanceof OnboardingInfrastructureError ? error : undefined;
    console.error("Onboarding submission failed", {
      reference,
      stage: infrastructureError?.stage ?? "complete-onboarding-rpc",
      databaseCode: infrastructureError?.databaseCode,
      constraint: constraintName(error instanceof Error ? error.message : ""),
      error,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
      requestId: process.env.VERCEL_REQUEST_ID,
    });
    return infrastructureError?.stage === "embedding"
      ? { kind: "embeddingFailed", reference }
      : { kind: "submissionFailed", reference };
  }
}

async function cleanupPhoto(
  service: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  profilePhotoPath: string,
) {
  try {
    const { error } = await service.storage.from("profile-photos").remove([profilePhotoPath]);
    if (!error) return;
    console.error("Onboarding photo cleanup failed", {
      stage: "photo-cleanup",
      databaseCode: error.name,
      error,
    });
  } catch (error) {
    console.error("Onboarding photo cleanup failed", {
      stage: "photo-cleanup",
      error,
    });
  }
}
