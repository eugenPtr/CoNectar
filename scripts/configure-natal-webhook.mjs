import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(".env.local", "utf8");
function value(name) {
  const raw = env.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
  return raw?.replace(/^(["'])(.*)\1$/, "$2") ?? "";
}

const url = value("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = value("SUPABASE_SERVICE_ROLE_KEY");
const ref = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
if (!ref || !serviceKey) throw new Error(".env.local needs the linked Supabase URL and service role key");

const secret = randomBytes(32).toString("base64url");
const directory = mkdtempSync(join(tmpdir(), "natal-webhook-"));
try {
  const envFile = join(directory, "secret.env");
  writeFileSync(envFile, `NATAL_CHART_WEBHOOK_SECRET=${secret}\n`, { mode: 0o600 });
  const set = spawnSync("supabase", ["secrets", "set", "--env-file", envFile, "--project-ref", ref], { stdio: "inherit" });
  if (set.status !== 0) throw new Error("Could not set natal webhook Edge secret");
} finally {
  rmSync(directory, { recursive: true, force: true });
}

const deployed = spawnSync("supabase", ["functions", "deploy", "generate-natal-chart", "--project-ref", ref], { stdio: "inherit" });
if (deployed.status !== 0) throw new Error("Could not deploy natal chart function");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await supabase.rpc("configure_natal_chart_webhook", { p_project_url: url, p_secret: secret });
if (error) throw new Error(`Could not set natal webhook Vault secret: ${error.message}`);
console.log("Natal chart webhook configured for", ref);
