import type { SupabaseClient } from "@supabase/supabase-js";
import type { Embedder } from "./embed-member";

export const RESOURCE_MATCH_COUNT = 12;
export const PROFILE_MATCH_COUNT = 12;
export const HEART_PROJECT_MATCH_COUNT = 30;
export const MAX_GENERATION_CANDIDATES = 10;
export const RESOURCE_MIN_SIMILARITY = 0.3;
export const PROFILE_MIN_SIMILARITY = 0.3;
export const HEART_PROJECT_MIN_SIMILARITY = 0.3;

export type Evidence =
  | { type: "free_resource" | "paid_resource"; text: string; similarity: number; resourceId: string }
  | { type: "passion"; text: string; similarity: number }
  | { type: "heart_project"; projectId: string; title: string; text: string; similarity: number };

export interface Candidate {
  memberId: string;
  firstName: string;
  lastName: string;
  evidence: Evidence[];
  similarity: number;
}

export interface ResourceMatch {
  memberId: string;
  firstName: string;
  lastName: string;
  resourceId: string;
  description: string;
  classification: "free" | "paid";
  similarity: number;
}

export interface ProfileContextMatch {
  memberId: string;
  firstName: string;
  lastName: string;
  passions: string;
  similarity: number;
}

export interface HeartProjectMatch {
  memberId: string;
  firstName: string;
  lastName: string;
  projectId: string;
  title: string;
  description: string;
  similarity: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

type RetrievalResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export interface SearchMembersDbClient {
  matchResources(args: { queryEmbedding: number[]; matchCount: number; minSimilarity: number }): RetrievalResult<ResourceMatch>;
  matchProfileContexts(args: { queryEmbedding: number[]; matchCount: number; minSimilarity: number }): RetrievalResult<ProfileContextMatch>;
  matchHeartProjects(args: { queryEmbedding: number[]; matchCount: number; minSimilarity: number }): RetrievalResult<HeartProjectMatch>;
}

export interface GenerationRequest {
  system: string;
  history: ConversationMessage[];
  query: string;
  candidates: Candidate[];
  contextBlock: string;
}

export const SYSTEM_PROMPT = `You are People Search for a private, invite-only community ("Fain Men"). A Member describes who they need; you recommend real Members from the community.

Hard rules:
- Recommend ONLY people from the CANDIDATES list provided in the user message. Never invent people, job titles, roles, organisations, availability, or services.
- Never output any external link. Link each recommended person exactly as [Full Name](/profile/{member_id}) using the member_id from CANDIDATES. No other URLs.
- Explain the exact supporting evidence. free_resource and paid_resource are offers. passion indicates an interest. heart_project is a named pursuit by the Member; identify its title and relevant description, but never call it a Resource or imply that it is offered to others or that the Member is available to help.
- State Resource classification accurately as gratuit (free_resource) or contra cost (paid_resource).
- Answer in Romanian.
- If CANDIDATES is empty, say plainly in Romanian that nobody in the community matches this need yet. Do not suggest anyone.
- Count only from the provided CANDIDATES list.`;

export function formatCandidates(candidates: Candidate[]): string {
  if (candidates.length === 0) return "CANDIDATES: (none)";
  return `CANDIDATES:\n${candidates.map((candidate) => [
    `- member_id: ${candidate.memberId}`,
    `  name: ${candidate.firstName} ${candidate.lastName}`,
    "  evidence:",
    ...candidate.evidence.map((evidence) => evidence.type === "heart_project"
      ? `    - type: heart_project\n      project_id: ${evidence.projectId}\n      title: ${JSON.stringify(evidence.title)}\n      description: ${JSON.stringify(evidence.text)}\n      similarity: ${evidence.similarity.toFixed(4)}`
      : `    - type: ${evidence.type}\n      text: ${JSON.stringify(evidence.text)}\n      similarity: ${evidence.similarity.toFixed(4)}`),
  ].join("\n")).join("\n")}`;
}

export function isHelpSeekingQuery(query: string): boolean {
  return /\b(caut|caută|am nevoie|nevoie de|mă poate ajuta|ma poate ajuta|recomand|cine poate|oferă|ofera|servici|ajutor|ajute)\b/iu.test(query);
}

export function mergeSearchEvidence(
  resources: ResourceMatch[], profiles: ProfileContextMatch[], projects: HeartProjectMatch[], searcherId: string, helpSeeking: boolean,
): Candidate[] {
  const merged = new Map<string, Candidate>();
  const candidateFor = (match: { memberId: string; firstName: string; lastName: string }) => {
    let candidate = merged.get(match.memberId);
    if (!candidate) {
      candidate = { memberId: match.memberId, firstName: match.firstName, lastName: match.lastName, evidence: [], similarity: 0 };
      merged.set(match.memberId, candidate);
    }
    return candidate;
  };

  for (const match of resources) {
    if (match.memberId === searcherId) continue;
    const candidate = candidateFor(match);
    candidate.evidence.push({
      type: match.classification === "free" ? "free_resource" : "paid_resource",
      text: match.description,
      similarity: match.similarity,
      resourceId: match.resourceId,
    });
    candidate.similarity = Math.max(candidate.similarity, match.similarity);
  }
  for (const match of profiles) {
    if (match.memberId === searcherId) continue;
    const candidate = candidateFor(match);
    if (match.passions.trim()) candidate.evidence.push({ type: "passion", text: match.passions.trim(), similarity: match.similarity });
    candidate.similarity = Math.max(candidate.similarity, match.similarity);
  }
  const seenProjects = new Set<string>();
  for (const match of projects) {
    if (match.memberId === searcherId || seenProjects.has(match.projectId)) continue;
    seenProjects.add(match.projectId);
    const candidate = candidateFor(match);
    candidate.evidence.push({ type: "heart_project", projectId: match.projectId, title: match.title,
      text: match.description, similarity: match.similarity });
    candidate.similarity = Math.max(candidate.similarity, match.similarity);
  }

  const hasOffer = (candidate: Candidate) => candidate.evidence.some((e) => e.type === "free_resource" || e.type === "paid_resource");
  return [...merged.values()].sort((a, b) => {
    if (helpSeeking && hasOffer(a) !== hasOffer(b)) return hasOffer(a) ? -1 : 1;
    return b.similarity - a.similarity;
  }).slice(0, MAX_GENERATION_CANDIDATES);
}

export async function searchMembers<T>(
  deps: { embedder: Embedder; db: SearchMembersDbClient; generate: (req: GenerationRequest) => T },
  opts: { query: string; searcherId: string; history?: ConversationMessage[] },
): Promise<{ candidates: Candidate[]; result: T }> {
  const queryEmbedding = await deps.embedder(opts.query);
  const [resourceResult, profileResult, projectResult] = await Promise.all([
    deps.db.matchResources({ queryEmbedding, matchCount: RESOURCE_MATCH_COUNT, minSimilarity: RESOURCE_MIN_SIMILARITY }),
    deps.db.matchProfileContexts({ queryEmbedding, matchCount: PROFILE_MATCH_COUNT, minSimilarity: PROFILE_MIN_SIMILARITY }),
    deps.db.matchHeartProjects({ queryEmbedding, matchCount: HEART_PROJECT_MATCH_COUNT, minSimilarity: HEART_PROJECT_MIN_SIMILARITY }),
  ]);
  if (resourceResult.error) throw new Error(`matchResources failed: ${resourceResult.error.message}`);
  if (profileResult.error) throw new Error(`matchProfileContexts failed: ${profileResult.error.message}`);
  if (projectResult.error) throw new Error(`matchHeartProjects failed: ${projectResult.error.message}`);

  const candidates = mergeSearchEvidence(
    resourceResult.data ?? [], profileResult.data ?? [], projectResult.data ?? [], opts.searcherId, isHelpSeekingQuery(opts.query),
  );
  const request: GenerationRequest = {
    system: SYSTEM_PROMPT,
    history: opts.history ?? [],
    query: opts.query,
    candidates,
    contextBlock: formatCandidates(candidates),
  };
  return { candidates, result: deps.generate(request) };
}

export function supabaseSearchMembersClient(supabase: SupabaseClient): SearchMembersDbClient {
  return {
    async matchResources(args) {
      const { data, error } = await supabase.rpc("match_resources", rpcArgs(args));
      return { data: (data as ResourceMatchRow[] | null)?.map(mapResourceMatch) ?? null, error: error ? { message: error.message } : null };
    },
    async matchProfileContexts(args) {
      const { data, error } = await supabase.rpc("match_profile_contexts", rpcArgs(args));
      return { data: (data as ProfileContextMatchRow[] | null)?.map(mapProfileMatch) ?? null, error: error ? { message: error.message } : null };
    },
    async matchHeartProjects(args) {
      const { data, error } = await supabase.rpc("match_heart_projects", rpcArgs(args));
      return { data: (data as HeartProjectMatchRow[] | null)?.map(mapHeartProjectMatch) ?? null,
        error: error ? { message: error.message } : null };
    },
  };
}

function rpcArgs(args: { queryEmbedding: number[]; matchCount: number; minSimilarity: number }) {
  return { query_embedding: JSON.stringify(args.queryEmbedding), match_count: args.matchCount, min_similarity: args.minSimilarity };
}

interface ResourceMatchRow { member_id: string; first_name: string; last_name: string; resource_id: string; description: string; classification: "free" | "paid"; similarity: number }
interface ProfileContextMatchRow { member_id: string; first_name: string; last_name: string; passions: string; similarity: number }
interface HeartProjectMatchRow { member_id: string; first_name: string; last_name: string; project_id: string; title: string; description: string; similarity: number }

function mapResourceMatch(row: ResourceMatchRow): ResourceMatch {
  return { memberId: row.member_id, firstName: row.first_name, lastName: row.last_name, resourceId: row.resource_id, description: row.description, classification: row.classification, similarity: row.similarity };
}
function mapProfileMatch(row: ProfileContextMatchRow): ProfileContextMatch {
  return { memberId: row.member_id, firstName: row.first_name, lastName: row.last_name, passions: row.passions, similarity: row.similarity };
}
function mapHeartProjectMatch(row: HeartProjectMatchRow): HeartProjectMatch {
  return { memberId: row.member_id, firstName: row.first_name, lastName: row.last_name, projectId: row.project_id,
    title: row.title, description: row.description, similarity: row.similarity };
}
