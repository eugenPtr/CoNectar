import { redirect } from "next/navigation";
import { CommunityMap } from "@/components/community-map";
import { loadCommunityMap, supabaseCommunityMapReader } from "@/lib/community-map/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CommunityMapPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: member, error } = await supabase.from("members").select("id").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) redirect("/");

  const data = await loadCommunityMap(supabaseCommunityMapReader(supabase));
  return <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8"><CommunityMap {...data} /></main>;
}
