import { isPossiblePhoneNumber, parsePhoneNumber } from "libphonenumber-js/max";
import type { Embedder } from "@/lib/people-search/embed-member";
import { buildProfileContextEmbeddingInput } from "@/lib/people-search/embedding-input";
import { normalizeResources, type ResourceInput } from "@/lib/resources/model";
import { heartProjectEmbeddingInput, normalizeHeartProjects, type HeartProjectInput, type IndexedHeartProject } from "@/lib/heart-projects/save";
import type { BirthDataInput } from "@/lib/birth-data";

export type SubmitOnboardingResult =
  | { kind: "ok" }
  | { kind: "alreadyClaimed" }
  | { kind: "invalidCode" }
  | { kind: "missingFields" };

export class OnboardingInfrastructureError extends Error {
  constructor(
    readonly stage: "embedding" | "complete-onboarding-rpc",
    message: string,
    readonly databaseCode?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OnboardingInfrastructureError";
  }
}

export interface SocialsInput {
  phone?: string; email?: string; website?: string; linkedin?: string;
  facebook?: string; instagram?: string; x?: string;
}

interface OnboardingPayload {
  userId: string; email: string; code: string; firstName: string; lastName: string;
  location: string; passions: string; heartProjectSeeking: boolean;
  heartProjectDescription?: string; heartProjects?: HeartProjectInput[]; resources: ResourceInput[]; socials?: SocialsInput;
  communityIds?: string[]; profilePhotoPath?: string;
  birthData?: BirthDataInput | null;
}

export interface OnboardingDbClient {
  completeOnboarding(data: Omit<OnboardingPayload, "resources" | "socials"> & {
    resources: Array<ResourceInput & { position: number; embedding: number[] }>;
    projects: IndexedHeartProject[];
    profileContextEmbedding: number[];
    profileContextEmbeddingInput: string;
    socials: Record<string, string | null>;
  }): PromiseLike<{ error: { code?: string; message: string } | null }>;
}

const SOCIAL_FIELDS = ["phone", "email", "website", "linkedin", "facebook", "instagram", "x"] as const;

export async function submitOnboarding(
  deps: { db: OnboardingDbClient; embedder: Embedder },
  opts: OnboardingPayload,
): Promise<SubmitOnboardingResult> {
  const phone = opts.socials?.phone?.trim() ?? "";
  const contactEmail = opts.socials?.email?.trim() ?? "";
  const resources = normalizeResources(opts.resources);
  const projects = normalizeHeartProjects(opts.heartProjects ?? (opts.heartProjectDescription?.trim()
    ? [{ title: "Soul project", description: opts.heartProjectDescription }] : []));
  if (!opts.firstName.trim() || !opts.lastName.trim() || !opts.location.trim() ||
      !opts.passions.trim() || !projects || (!opts.heartProjectSeeking && projects.length === 0) ||
      !phone.startsWith("+") || !isPossiblePhoneNumber(phone) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || !resources || opts.communityIds?.length === 0) {
    return { kind: "missingFields" };
  }

  // Index first. If Gateway embedding fails, no Member/Profile/Invite/Resource write occurs.
  const profileContextEmbeddingInput = buildProfileContextEmbeddingInput(opts);
  let profileContextEmbedding: number[];
  let indexed: Array<ResourceInput & { position: number; embedding: number[] }>;
  let indexedProjects: IndexedHeartProject[];
  try {
    [profileContextEmbedding, indexed, indexedProjects] = await Promise.all([
      deps.embedder(profileContextEmbeddingInput),
      Promise.all(resources.map(async (resource) => ({
        ...resource,
        position: resources.filter((r) => r.classification === resource.classification).indexOf(resource),
        embedding: await deps.embedder(resource.description),
      }))),
      Promise.all(projects.map(async (project, position) => {
        const embeddingInput = heartProjectEmbeddingInput(project);
        return { ...project, id: crypto.randomUUID(), position, embeddingInput,
          embedding: await deps.embedder(embeddingInput) };
      })),
    ]);
  } catch (error) {
    throw new OnboardingInfrastructureError(
      "embedding",
      "Onboarding embedding failed",
      undefined,
      { cause: error },
    );
  }
  const socials = Object.fromEntries(SOCIAL_FIELDS.map((field) => [field, opts.socials?.[field]?.trim() || null]));
  socials.phone = parsePhoneNumber(phone).number;
  socials.email = contactEmail;

  const { error } = await deps.db.completeOnboarding({
    ...opts, communityIds: opts.communityIds ?? ["test-community"], resources: indexed, projects: indexedProjects, socials, profileContextEmbedding, profileContextEmbeddingInput,
  });
  if (!error) return { kind: "ok" };
  if (error.code === "P0001") return { kind: "invalidCode" };
  if (error.code === "P0002") return { kind: "alreadyClaimed" };
  throw new OnboardingInfrastructureError(
    "complete-onboarding-rpc",
    `completeOnboarding failed: ${error.message}`,
    error.code,
  );
}
