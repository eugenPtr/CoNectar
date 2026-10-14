"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "@/app/auth/sign-out";
import { deleteConversationAction } from "@/app/chat/actions";
import type { ConversationSummary } from "@/lib/people-search/conversations";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

// Shared member navigation. Desktop uses a horizontal navbar; mobile keeps the
// conversation drawer. The root layout renders it only for onboarded members.
export function AuthedMenu({
  isAdmin = false,
  conversations,
}: {
  isAdmin?: boolean;
  conversations: ConversationSummary[];
}) {
  const [open, setOpen] = useState(false);
  const [conversationMenu, setConversationMenu] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const activeId = pathname.startsWith("/chat/") ? pathname.split("/")[2] : "";

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function removeConversation(id: string) {
    startTransition(async () => {
      const result = await deleteConversationAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversația a fost ștearsă.");
      setConversationMenu(null);
      setOpen(false);
      if (id === activeId) router.push("/");
      else router.refresh();
    });
  }

  const menuLinks = (
    <>
      <Link href="/" onClick={() => setOpen(false)} className="block rounded-[10px] px-3 py-2.5 text-sm text-foreground hover:bg-surface-raised">Chat</Link>
      <Link href="/members" onClick={() => setOpen(false)} className="block rounded-[10px] px-3 py-2.5 text-sm text-foreground hover:bg-surface-raised">Membri</Link>
      <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-[10px] px-3 py-2.5 text-sm text-foreground hover:bg-surface-raised">Profil</Link>
      {isAdmin && <Link href="/admin/dashboard" onClick={() => setOpen(false)} className="block rounded-[10px] px-3 py-2.5 text-sm text-foreground hover:bg-surface-raised">Admin</Link>}
    </>
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-subtle bg-surface px-4 md:px-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Deschide meniul"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="flex size-11 items-center justify-center rounded-[10px] text-foreground hover:bg-surface-raised md:hidden"
        >
          <MenuIcon />
        </button>
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <Image src="/honey-pot.svg" alt="Borcan cu miere" width={28} height={28} />
          CoNectar
        </Link>
      </div>

      <nav aria-label="Navigare principală" className="hidden items-center gap-1 md:flex">
        <Link href="/" aria-current={pathname === "/" || pathname.startsWith("/chat/") ? "page" : undefined} className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-raised aria-[current=page]:bg-sage aria-[current=page]:text-[#292b25]">Chat</Link>
        <Link href="/members" aria-current={pathname.startsWith("/members") ? "page" : undefined} className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-raised aria-[current=page]:bg-sage aria-[current=page]:text-[#292b25]">Membri</Link>
        <Link href="/profile" aria-current={pathname === "/profile" ? "page" : undefined} className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-raised aria-[current=page]:bg-sage aria-[current=page]:text-[#292b25]">Profil</Link>
        {isAdmin && <Link href="/admin/dashboard" aria-current={pathname.startsWith("/admin") ? "page" : undefined} className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-raised aria-[current=page]:bg-sage aria-[current=page]:text-[#292b25]">Admin</Link>}
        <form action={signOutAction}>
          <button type="submit" aria-label="Deconectare" title="Deconectare" className="flex size-11 items-center justify-center rounded-[10px] text-foreground hover:bg-surface-raised"><SignOutIcon /></button>
        </form>
        <ThemeToggle />
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Închide meniul" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
          <aside className="mobile-menu-drawer absolute inset-y-0 left-0 flex w-[85vw] max-w-90 flex-col border-r border-border-subtle bg-surface shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-border-subtle px-4">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 text-lg font-semibold text-foreground"><Image src="/honey-pot.svg" alt="Borcan cu miere" width={28} height={28} />CoNectar</Link>
              <button type="button" aria-label="Închide meniul" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center rounded-[10px] text-foreground hover:bg-surface-raised"><CloseIcon /></button>
            </div>
            <nav className="px-3 py-3">{menuLinks}</nav>
            <div className="mx-3 border-t border-zinc-800 pt-3">
              <Link href="/" onClick={() => setOpen(false)} className="block w-full rounded-xl border border-zinc-700 px-3 py-2.5 text-center text-sm font-medium text-zinc-200 hover:bg-zinc-800">Conversație nouă</Link>
            </div>
            <section className="mt-5 min-h-0 flex-1 overflow-y-auto px-3" aria-labelledby="recent-conversations">
              <h2 id="recent-conversations" className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Recente</h2>
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className={`relative flex items-center rounded-xl text-sm ${conversation.id === activeId ? "bg-zinc-800 text-white" : "text-zinc-200 hover:bg-zinc-900"}`}>
                    <Link href={`/chat/${conversation.id}`} onClick={() => setOpen(false)} className="min-w-0 flex-1 truncate px-3 py-2.5 pr-10">{conversation.title?.trim() || "Conversație fără titlu"}</Link>
                    <button type="button" aria-label={`Acțiuni pentru ${conversation.title?.trim() || "conversația fără titlu"}`} onClick={() => setConversationMenu((current) => current === conversation.id ? null : conversation.id)} className="absolute right-1 flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-700 hover:text-white"><MoreIcon /></button>
                    {conversationMenu === conversation.id && (
                      <div className="absolute right-1 top-9 z-10 rounded-xl border border-zinc-700 bg-zinc-800 p-1 shadow-xl">
                        <button type="button" disabled={isPending} onClick={() => removeConversation(conversation.id)} className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-zinc-700 disabled:opacity-50">Șterge conversația</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <div className="flex items-center justify-between border-t border-border-subtle p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <form action={signOutAction}><button type="submit" className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-foreground hover:bg-surface-raised"><SignOutIcon />Deconectare</button></form>
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}

function MenuIcon() { return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="6" x2="17" y2="6" /><line x1="3" y1="10" x2="17" y2="10" /><line x1="3" y1="14" x2="17" y2="14" /></svg>; }
function CloseIcon() { return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>; }
function MoreIcon() { return <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="16" cy="10" r="1.5" /></svg>; }
function SignOutIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>; }
