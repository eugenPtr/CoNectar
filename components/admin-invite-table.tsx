"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InviteListRow } from "@/lib/invites/list";
import { generateInviteAction } from "@/app/admin/dashboard/actions";

// The invite link a recipient claims through -- the same shape as the existing
// magic-link invite URL, built client-side so it carries this browser's origin.
function inviteLink(code: string): string {
  return `${window.location.origin}/sign-in?invite=${code}`;
}

export function AdminInviteTable({ invites }: { invites: InviteListRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function copyLink(code: string) {
    await navigator.clipboard.writeText(inviteLink(code));
    toast.success("Link de invitație copiat");
  }

  function generate() {
    startTransition(async () => {
      const { code } = await generateInviteAction();
      // Copy first, then refresh so the new PENDING row is on screen, then
      // confirm -- the toast matches what the Admin now sees (issue #20).
      await navigator.clipboard.writeText(inviteLink(code));
      router.refresh();
      toast.success("Link de invitație copiat");
    });
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="min-h-11 rounded-[10px] bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover active:brightness-95 disabled:opacity-50"
      >
        {pending ? "Se generează…" : "Generează link de invitație"}
      </button>

      {invites.length === 0 ? (
        <p className="mt-6 text-sm text-white">Încă nicio invitație.</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-500 text-xs font-semibold uppercase tracking-wide text-zinc-300">
              <th className="py-2 pr-4 font-semibold">Cod</th>
              <th className="py-2 pr-4 font-semibold">Folosit de</th>
              <th className="py-2 font-semibold">Generat de</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr key={invite.code} className="border-b border-zinc-600">
                <td className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => copyLink(invite.code)}
                    title="Copiază linkul de invitație"
                    className="group flex cursor-copy items-center gap-1.5 font-mono text-white"
                  >
                    {invite.code}
                    <CopyIcon className="opacity-0 transition group-hover:opacity-100" />
                  </button>
                </td>
                <td className="py-2 pr-4 text-white">{invite.claimedBy}</td>
                <td className="py-2 text-white">{invite.generatedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M13 4H5a1 1 0 0 0-1 1v8" />
    </svg>
  );
}
