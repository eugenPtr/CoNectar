// Run with the local stack after Admins have created the Theme catalog:
// node --env-file=.env.local --import tsx scripts/backfill-heart-project-embeddings.ts
import { createClient } from "@supabase/supabase-js";
import { gatewayEmbedder } from "../lib/people-search/ai-gateway";
import { heartProjectEmbeddingInput } from "../lib/heart-projects/save";
import { serializeEmbedding } from "../lib/people-search/serialize-embedding";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Local Supabase service credentials required");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  let count = 0;
  for (;;) {
    const { data, error } = await db.from("heart_projects")
      .select("id, title, description").is("embedding", null).order("id").limit(50);
    if (error) throw error;
    if (!data?.length) break;
    for (const project of data) {
      const embeddingInput = heartProjectEmbeddingInput(project);
      const embedding = await gatewayEmbedder(embeddingInput);
      const { error: updateError } = await db.from("heart_projects").update({
        embedding: serializeEmbedding(embedding), embedding_input: embeddingInput, embedded_at: new Date().toISOString(),
      }).eq("id", project.id).is("embedding", null);
      if (updateError) throw updateError;
      count++;
    }
  }
  console.log(`Indexed ${count} Heart Projects`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
