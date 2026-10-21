"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function retryNatalChartAction(): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.rpc("retry_own_natal_chart");
  return { ok: !error };
}
