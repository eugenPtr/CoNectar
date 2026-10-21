import { createSupabaseServerClient } from "@/lib/supabase/server";

interface GeoapifyResult {
  formatted?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  lat?: number;
  lon?: number;
  timezone?: { name?: string };
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return Response.json({ results: [] });
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return Response.json({ error: "geocoding_unavailable" }, { status: 503 });

  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", query);
  url.searchParams.set("type", "city");
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ro");
  url.searchParams.set("bias", "countrycode:ro");
  url.searchParams.set("limit", "8");
  url.searchParams.set("apiKey", key);
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return Response.json({ error: "geocoding_unavailable" }, { status: 502 });
    const body = await response.json() as { results?: GeoapifyResult[] };
    const results = (body.results ?? []).flatMap((item) => {
      const place = item.city ?? item.town ?? item.village;
      const timezone = item.timezone?.name;
      if (!place || !timezone || !Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return [];
      const region = item.county ?? item.state;
      return [{
        label: [place, region, item.country].filter(Boolean).join(", "),
        latitude: item.lat!, longitude: item.lon!, timezone,
      }];
    });
    return Response.json({ results });
  } catch {
    return Response.json({ error: "geocoding_unavailable" }, { status: 502 });
  }
}
