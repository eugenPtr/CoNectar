import { supabaseInviteValidateClient, validateInvite } from "@/lib/invites/validate";
import { universalInviteConfig } from "@/lib/invites/universal";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { BrandLockup } from "@/components/brand-lockup";
import { sendMagicLink } from "./actions";
import { SubmitButton } from "./submit-button";

type SearchParams = Promise<{
  sent?: string;
  error?: string;
  invite?: string;
  checkInbox?: string;
}>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { invite, checkInbox } = await searchParams;

  if (invite) {
    const service = await createSupabaseServiceClient();
    const result = await validateInvite(
      supabaseInviteValidateClient(service), invite, universalInviteConfig(),
    );

    if (result.kind === "configuration-error") {
      return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
          <h1 className="text-2xl font-semibold">Cod de invitație indisponibil</h1>
          <p className="text-sm text-zinc-300">Contactează administratorul rețelei.</p>
        </main>
      );
    }

    if (result.kind === "invalid") {
      return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
          <h1 className="text-2xl font-semibold">Cod de invitație invalid</h1>
          <p className="text-sm text-zinc-300">
            Acest cod de invitație nu există. Verifică linkul pe care l-ai primit.
          </p>
        </main>
      );
    }

    if (result.kind === "already-claimed") {
      return (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
          <h1 className="text-2xl font-semibold">Invitație deja folosită</h1>
          <p className="text-sm text-zinc-300">
            Această invitație a fost deja folosită. Contactează persoana care te-a invitat.
          </p>
        </main>
      );
    }
  }

  // After a successful send in invite mode, the action redirects here with
  // checkInbox=1. We replace the form with a confirmation panel rather than a
  // toast (the form is gone, so transient feedback would have nothing to
  // accompany). A link is always sent in valid-invite mode, so this is always
  // honest and reveals nothing about Member status (ADR-0005).
  if (checkInbox) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-semibold">Verifică-ți emailul</h1>
        <p className="text-sm text-zinc-300">
          Caută în inbox linkul magic de autentificare.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="sign-in-brand rounded-2xl bg-brand-green px-3 py-6 text-center">
        <BrandLockup hero tagline />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{invite ? "Ești invitat" : "Autentificare"}</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {invite
            ? "Invitația ta e confirmată. Introdu-ți emailul și îți trimitem un link magic de autentificare."
            : "Introdu-ți emailul — îți trimitem un link magic. Vei avea nevoie de un cod de invitație pe ecranul următor."}
        </p>
      </div>

      <form action={sendMagicLink} className="flex flex-col gap-3">
        {invite ? <input type="hidden" name="invite" value={invite} /> : null}
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded border border-zinc-600 px-3 py-2"
          placeholder="you@example.com"
        />
        <SubmitButton label={invite ? "Trimite link-ul de autentificare" : undefined} />
      </form>
    </main>
  );
}
