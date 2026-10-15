"use client";

import { toast } from "sonner";
import type { UniversalInviteSignup } from "@/lib/invites/list-universal-signups";

export function AdminUniversalInvite({
  code,
  enabled,
  conflict,
  signups,
}: {
  code: string;
  enabled: boolean;
  conflict: boolean;
  signups: UniversalInviteSignup[];
}) {
  async function copyLink() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/sign-in?invite=${encodeURIComponent(code)}`,
      );
      toast.success("Link de invitație copiat");
    } catch {
      toast.error("Linkul nu a putut fi copiat");
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Cod universal</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-sage text-[#292b25]" : "bg-zinc-700 text-white"}`}>
          {enabled ? "Activat" : "Dezactivat"}
        </span>
      </div>
      {code ? (
        <button
          type="button"
          onClick={copyLink}
          title="Copiază linkul de invitație"
          className="mt-3 min-h-11 max-w-full cursor-copy break-all rounded-lg border border-border-subtle px-3 py-2 text-left font-mono text-sm text-foreground hover:border-focus-ring"
        >
          {code} <span aria-hidden="true">⧉</span>
        </button>
      ) : (
        <p className="mt-3 text-sm text-secondary">Cod neconfigurat.</p>
      )}
      {conflict && (
        <p className="mt-3 text-sm text-amber-300">
          Codul coincide cu o invitație obișnuită. Configurația trebuie corectată.
        </p>
      )}
      <h3 className="mt-6 text-sm font-semibold">Membri înscriși cu codul universal ({signups.length})</h3>
      {signups.length === 0 ? (
        <p className="mt-2 text-sm text-secondary">Încă niciun membru.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border-subtle">
          {signups.map((signup) => (
            <li key={signup.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{signup.name}</p>
                <p className="break-all text-secondary">{signup.email}</p>
              </div>
              <div className="min-w-0 sm:text-right">
                <p className="break-all font-mono text-foreground">{signup.code}</p>
                <p className="text-xs text-secondary">{new Date(signup.createdAt).toLocaleDateString("ro-RO")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
