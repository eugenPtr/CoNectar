import Link from "next/link";
import Image from "next/image";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { HomeComposer } from "@/components/home-composer";
import { supabaseConversationsClient } from "@/lib/people-search/conversations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <Image src="/honey-pot.svg" alt="CoNectar" width={48} height={48} />
        <h1 className="text-[40px] leading-[48px] font-semibold tracking-tight">
          Bun venit la CoNectar
        </h1>
        <p className="text-base text-secondary">
          Un loc pentru oamenii din cercuri de bărbați și de femei. Descoperă resursele comunității și găsește persoanele potrivite pentru proiectele tale.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-action px-10 font-semibold text-action-foreground hover:bg-action-hover active:brightness-95 disabled:opacity-50"
          >
            Intră
          </Link>
          <Link
            href="/join"
            className="text-sm font-medium text-accent-text underline underline-offset-4 hover:opacity-80"
          >
            Încă nu am cont
          </Link>
        </div>
      </main>
    );
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, email, role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!member) {
    // Authenticated but onboarding never completed (ADR-0004: expected and
    // transient). We have no Invite code here, so we can't resume onboarding —
    // point them back to their Invite link, which carries it.
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-semibold">Finalizează înscrierea</h1>
        <p className="text-sm text-zinc-300">
          Încă nu ți-ai finalizat înscrierea. Deschide din nou linkul de
          invitație ca să continui de unde ai rămas.
        </p>
      </main>
    );
  }

  // Past Conversations open the sidebar on the home route too (always visible
  // on desktop). With none yet, home stays the plain welcome hero.
  const summaries = await supabaseConversationsClient(supabase).listConversations(
    member.id,
  );

  const welcome = (
    <>
      <h1 className="text-[40px] leading-[48px] font-semibold tracking-tight">
        Salut!
      </h1>
      <p className="text-base text-secondary md:text-xl md:leading-7">
        Găsește oameni și resurse în comunitate.
      </p>
    </>
  );

  return (
    <div className="flex min-h-0 w-full flex-1">
      {summaries.length > 0 && <ConversationSidebar conversations={summaries} activeId="" />}
      <main className="flex min-h-0 flex-1 flex-col items-center px-4 text-center md:px-6">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 md:-translate-y-12 md:gap-8">
          {welcome}
          <p className="text-sm font-medium md:text-lg">Spune ce ai nevoie</p>
          <div className="mt-4 hidden w-[min(54vw,42rem)] md:block">
            <HomeComposer />
          </div>
        </div>
        <div className="w-full max-w-2xl shrink-0 pb-3 md:hidden">
          <HomeComposer />
        </div>
      </main>
    </div>
  );
}
