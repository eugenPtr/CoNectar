import type { SupabaseClient } from "@supabase/supabase-js";
import { isUniversalInviteCode, type UniversalInviteConfig } from "./universal";

export type ValidateResult =
  | { kind: "valid" }
  | { kind: "invalid" }
  | { kind: "already-claimed" }
  | { kind: "configuration-error" };

export interface InviteValidateClient {
  findInvite(code: string): PromiseLike<{ claimedBy: string | null } | null>;
}

export async function validateInvite(
  client: InviteValidateClient,
  code: string,
  universal?: UniversalInviteConfig,
): Promise<ValidateResult> {
  const invite = await client.findInvite(code);
  if (universal && isUniversalInviteCode(code, universal)) {
    return invite === null ? { kind: "valid" } : { kind: "configuration-error" };
  }
  if (invite === null) return { kind: "invalid" };
  if (invite.claimedBy !== null) return { kind: "already-claimed" };
  return { kind: "valid" };
}

export function supabaseInviteValidateClient(service: SupabaseClient): InviteValidateClient {
  return {
    async findInvite(code) {
      const { data, error } = await service
        .from("invites")
        .select("claimed_by")
        .eq("code", code)
        .maybeSingle();
      if (error) throw new Error(`validateInvite failed: ${error.message}`);
      return data === null ? null : { claimedBy: data.claimed_by };
    },
  };
}
