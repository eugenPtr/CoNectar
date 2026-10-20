import type { SupabaseClient } from "@supabase/supabase-js";
import type { Embedder } from "@/lib/people-search/embed-member";
import { serializeEmbedding } from "@/lib/people-search/serialize-embedding";

export type ThemeInput = { id?: string; name: string; description: string };
export type IndexedTheme = Required<Pick<ThemeInput, "name" | "description">> & {
  id?: string;
  embedding: number[];
  embeddingInput: string;
};

export interface ThemeStore {
  findTheme(id: string): Promise<{ id: string; embeddingInput: string } | null>;
  saveTheme(theme: IndexedTheme): Promise<{ id: string }>;
  archiveTheme(id: string): Promise<void>;
}

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

export async function saveTheme(deps: { db: ThemeStore; embedder: Embedder }, input: ThemeInput) {
  const name = normalize(input.name);
  const description = normalize(input.description);
  if (!name || name.length > 120 || !description || description.length > 500) return { kind: "invalid" } as const;
  const embeddingInput = `${name}\n${description}`;
  if (input.id) {
    const previous = await deps.db.findTheme(input.id);
    if (!previous) return { kind: "missing" } as const;
    if (previous.embeddingInput === embeddingInput) return { kind: "ok", id: input.id } as const;
  }
  const embedding = await deps.embedder(embeddingInput);
  if (embedding.length !== 1536) throw new Error("Dimensiunea vectorului pentru temă este invalidă.");
  const { id } = await deps.db.saveTheme({ id: input.id, name, description, embedding, embeddingInput });
  return { kind: "ok", id } as const;
}

export async function archiveTheme(db: ThemeStore, id: string) {
  if (!id) return { kind: "invalid" } as const;
  await db.archiveTheme(id);
  return { kind: "ok" } as const;
}

// Theme writes use the acting Admin's cookie-bound client and RLS policy.
// The database trigger increments catalog_version and rematches projects in
// the same transaction as each insert, update, or archive.
export function supabaseThemeStore(supabase: SupabaseClient): ThemeStore {
  return {
    async findTheme(id) {
      const { data, error } = await supabase.from("themes").select("id,embedding_input").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, embeddingInput: data.embedding_input } : null;
    },
    async saveTheme(theme) {
      const row = { name: theme.name, description: theme.description, embedding: serializeEmbedding(theme.embedding), embedding_input: theme.embeddingInput, embedded_at: new Date().toISOString() };
      const query = theme.id
        ? supabase.from("themes").update(row).eq("id", theme.id)
        : supabase.from("themes").insert(row);
      const { data, error } = await query.select("id").single();
      if (error) throw new Error(error.message);
      return { id: data.id };
    },
    async archiveTheme(id) {
      const { data, error } = await supabase.from("themes").update({ archived_at: new Date().toISOString() }).eq("id", id).is("archived_at", null).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Tema nu există sau este deja arhivată.");
    },
  };
}
