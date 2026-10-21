import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.1";
import { historicalUtcOffset } from "./timezone.ts";

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const webhookSecret = Deno.env.get("NATAL_CHART_WEBHOOK_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function astrologyPost(path: string, body: Record<string, unknown>) {
  const key = Deno.env.get("FREE_ASTROLOGY_API_KEY");
  if (!key) throw new Error("Missing FREE_ASTROLOGY_API_KEY");
  const response = await fetch(`https://json.freeastrologyapi.com/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Astrology API ${path} returned ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

async function markFailed(memberId: string, generation: string) {
  await supabase.from("birth_details").update({ chart_status: "failed" })
    .eq("member_id", memberId).eq("chart_generation", generation).eq("chart_status", "pending");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (!webhookSecret || request.headers.get("authorization") !== `Bearer ${webhookSecret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let payload: { member_id?: string; generation?: string };
  try { payload = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const memberId = payload.member_id;
  const generation = payload.generation;
  if (!memberId || !generation || !/^[0-9a-f-]{36}$/i.test(memberId) || !/^[0-9a-f-]{36}$/i.test(generation)) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }
  const { data: birth, error: lookupError } = await supabase.from("birth_details")
    .select("birth_date,birth_time,latitude,longitude,timezone,chart_generation,chart_status")
    .eq("member_id", memberId).maybeSingle();
  if (lookupError) return Response.json({ error: "lookup_failed" }, { status: 500 });
  if (!birth || birth.chart_generation !== generation || birth.chart_status !== "pending") {
    return Response.json({ ok: true, skipped: true });
  }

  const path = `${memberId}/${generation}.svg`;
  try {
    const [year, month, date] = birth.birth_date.split("-").map(Number);
    const [hours, minutes] = birth.birth_time.split(":").map(Number);
    const wheel = await astrologyPost("western/natal-wheel-chart", {
      year, month, date, hours, minutes, seconds: 0,
      latitude: birth.latitude, longitude: birth.longitude,
      timezone: historicalUtcOffset(birth.birth_date, birth.birth_time, birth.timezone),
    });
    const svgUrl = new URL(String(wheel.output ?? ""));
    if (svgUrl.protocol !== "https:" || !svgUrl.hostname.endsWith(".amazonaws.com")) {
      throw new Error("Invalid natal chart URL");
    }
    const svgResponse = await fetch(svgUrl, { signal: AbortSignal.timeout(25000) });
    if (!svgResponse.ok) throw new Error(`Chart download returned ${svgResponse.status}`);
    const svg = await svgResponse.text();
    if (svg.length > 2_000_000 || !/<svg[\s>]/i.test(svg) || /<script\b|<foreignObject\b|\son\w+\s*=/i.test(svg)) {
      throw new Error("Invalid SVG chart");
    }
    const { data: latest } = await supabase.from("birth_details").select("chart_generation,chart_status")
      .eq("member_id", memberId).maybeSingle();
    if (latest?.chart_generation !== generation || latest.chart_status !== "pending") {
      return Response.json({ ok: true, skipped: true });
    }
    const upload = await supabase.storage.from("natal-charts").upload(path, new Blob([svg], { type: "image/svg+xml" }), {
      contentType: "image/svg+xml", upsert: false,
    });
    if (upload.error) throw upload.error;
    const updated = await supabase.from("birth_details").update({ chart_status: "ready", chart_path: path })
      .eq("member_id", memberId).eq("chart_generation", generation).eq("chart_status", "pending")
      .select("member_id");
    if (updated.error || !updated.data?.length) {
      await supabase.storage.from("natal-charts").remove([path]);
      if (updated.error) throw updated.error;
      return Response.json({ ok: true, skipped: true });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Natal chart generation failed", { memberId, generation, error });
    await markFailed(memberId, generation);
    return Response.json({ error: "chart_generation_failed", detail: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
