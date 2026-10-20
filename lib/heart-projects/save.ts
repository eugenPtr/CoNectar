import type { SupabaseClient } from "@supabase/supabase-js";
import type { Embedder } from "@/lib/people-search/embed-member";
import { serializeEmbedding } from "@/lib/people-search/serialize-embedding";

export interface HeartProjectInput { id?: string; title: string; description: string }
export interface HeartProject extends HeartProjectInput { id: string; position: number }
export interface IndexedHeartProject extends HeartProject {
  embedding: number[];
  embeddingInput: string;
}

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
export const heartProjectEmbeddingInput = ({ title, description }: HeartProjectInput) => `${normalize(title)}\n${normalize(description)}`;

export function normalizeHeartProjects(projects: HeartProjectInput[]): HeartProjectInput[] | null {
  if (!Array.isArray(projects) || projects.length > 10) return null;
  const normalized = projects.map((project) => ({ ...project, title: normalize(project.title), description: normalize(project.description) }));
  if (normalized.some((project) => project.title.length < 1 || project.title.length > 120 || project.description.length < 1 || project.description.length > 2000)) return null;
  return normalized;
}

export interface SaveHeartProjectsClient {
  loadProjects(memberId: string): PromiseLike<{ data: IndexedHeartProject[] | null; error: { message: string } | null }>;
  replaceProjects(memberId: string, projects: IndexedHeartProject[]): PromiseLike<{ error: { message: string } | null }>;
}

export async function prepareHeartProjects(deps: { db: Pick<SaveHeartProjectsClient, "loadProjects">; embedder: Embedder }, opts: { memberId: string; projects: HeartProjectInput[] }) {
  const normalized = normalizeHeartProjects(opts.projects);
  if (!normalized) return null;
  const { data, error } = await deps.db.loadProjects(opts.memberId);
  if (error) throw new Error(`loadProjects failed: ${error.message}`);
  const previous = new Map((data ?? []).map((project) => [project.id, project]));
  return Promise.all(normalized.map(async (project, position) => {
    const id = project.id && previous.has(project.id) ? project.id : crypto.randomUUID();
    const embeddingInput = heartProjectEmbeddingInput(project);
    const existing = previous.get(id);
    return { ...project, id, position, embeddingInput,
      embedding: existing?.embeddingInput === embeddingInput ? existing.embedding : await deps.embedder(embeddingInput) };
  }));
}

export async function saveHeartProjects(deps: { db: SaveHeartProjectsClient; embedder: Embedder }, opts: { memberId: string; projects: HeartProjectInput[] }) {
  const indexed = await prepareHeartProjects(deps, opts);
  if (!indexed) return { kind: "invalid" } as const;
  const { error } = await deps.db.replaceProjects(opts.memberId, indexed);
  if (error) throw new Error(`replaceProjects failed: ${error.message}`);
  return { kind: "ok" } as const;
}

export function supabaseHeartProjectClient(supabase: SupabaseClient): SaveHeartProjectsClient {
  return {
    async loadProjects(memberId) {
      const { data, error } = await supabase.from("heart_projects").select("id, title, description, position, embedding, embedding_input").eq("member_id", memberId).order("position");
      return { data: data?.map((row) => ({ ...row, embeddingInput: row.embedding_input, embedding: typeof row.embedding === "string" ? JSON.parse(row.embedding) : row.embedding })) as IndexedHeartProject[] | null,
        error: error ? { message: error.message } : null };
    },
    async replaceProjects(_memberId, projects) {
      const { error } = await supabase.rpc("replace_own_heart_projects", { p_projects: projects.map((project) => ({
        id: project.id, title: project.title, description: project.description, position: project.position,
        embedding: serializeEmbedding(project.embedding), embedding_input: project.embeddingInput,
      })) });
      return { error: error ? { message: error.message } : null };
    },
  };
}
