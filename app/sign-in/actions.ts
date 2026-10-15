"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseInviteValidateClient, validateInvite } from "@/lib/invites/validate";
import { universalInviteConfig } from "@/lib/invites/universal";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/sign-in?error=missing-email");
  }

  const invite = String(formData.get("invite") ?? "").trim() || null;

  // Member-first gate (ADR-0005). Supabase auth only proceeds when the email
  // is already a Member, or a valid Invite is attached. Every other case
  // responds with the identical neutral confirmation and sends nothing — the
  // sign-in form must never reveal whether an email is a Member.
  const service = await createSupabaseServiceClient();
  const { data: member } = await service
    .from("members")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let callbackPath = "/auth/callback";
  let shouldCreateUser = false;

  if (!member) {
    if (!invite) {
      // Unknown email, no Invite: say nothing, send nothing.
      redirect("/sign-in?sent=1");
    }

    const validation = await validateInvite(
      supabaseInviteValidateClient(service), invite, universalInviteConfig(),
    );

    if (validation.kind !== "valid") {
      // Invalid / already-claimed Invite is not membership disclosure — let the
      // sign-in page re-validate and render its full-page Invite error.
      redirect(`/sign-in?invite=${encodeURIComponent(invite)}`);
    }

    callbackPath = `/auth/callback?invite=${encodeURIComponent(invite)}`;
    shouldCreateUser = true;
  }

  const requestHeaders = await headers();
  // `Origin` includes protocol+host. `x-forwarded-host` is set by Vercel's
  // edge (host only, always HTTPS). `host` is always present and works for
  // local dev where origin may be omitted and no proxy sets x-forwarded-host.
  const origin = requestHeaders.get("origin");
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const baseUrl =
    origin ??
    (forwardedHost ? `https://${forwardedHost}` : null) ??
    (host ? `${forwardedProto}://${host}` : undefined);
  const emailRedirectTo = baseUrl ? `${baseUrl}${callbackPath}` : undefined;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser },
  });
  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  // Invite mode (a valid Invite rode the form, so a link was definitely sent —
  // for a Member or a new Member alike): show the definite "check your inbox"
  // panel. Showing it for every email closes ADR-0005's Member/non-Member leak
  // in the invite case, and is always honest. Every other case gets the neutral
  // confirmation that never reveals whether the email is a Member.
  if (invite) {
    redirect(`/sign-in?invite=${encodeURIComponent(invite)}&checkInbox=1`);
  }

  redirect("/sign-in?sent=1");
}
