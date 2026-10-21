import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  const { data: birth, error } = await supabase.from("birth_details")
    .select("chart_path,chart_status").eq("member_id", memberId).maybeSingle();
  if (error || !birth || birth.chart_status !== "ready" || !birth.chart_path) {
    return new Response(null, { status: 404 });
  }
  const service = await createSupabaseServiceClient();
  const { data: chart, error: downloadError } = await service.storage.from("natal-charts").download(birth.chart_path);
  if (downloadError || !chart) return new Response(null, { status: 404 });
  return new Response(chart, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
