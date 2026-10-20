// Run after applying migrations with credentials for the intended Supabase project:
// node --env-file=.env.local --import tsx scripts/backfill-profile-context-embeddings.ts
import { createClient } from "@supabase/supabase-js";
import { gatewayEmbedder } from "../lib/people-search/ai-gateway";
import { buildProfileContextEmbeddingInput } from "../lib/people-search/embedding-input";
import { serializeEmbedding } from "../lib/people-search/serialize-embedding";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase service credentials required");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  let count = 0;
  for (;;) {
    const { data, error } = await db.from("profiles")
      .select("member_id, passions, heart_project_seeking")
      .is("profile_context_embedding", null).order("member_id").limit(50);
    if (error) throw error;
    if (!data?.length) break;
    for (const profile of data) {
      const input = buildProfileContextEmbeddingInput({ passions: profile.passions, heartProjectSeeking: profile.heart_project_seeking });
      const embedding = await gatewayEmbedder(input);
      const { error: updateError } = await db.from("profiles").update({
        profile_context_embedding: serializeEmbedding(embedding),
        profile_context_embedding_input: input,
        profile_context_embedded_at: new Date().toISOString(),
      }).eq("member_id", profile.member_id).is("profile_context_embedding", null);
      if (updateError) throw updateError;
      count++;
    }
  }
  console.log(`Indexed ${count} Profile contexts`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
