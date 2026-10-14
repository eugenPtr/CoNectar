import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchParamsToast } from "@/components/searchparams-toast";
import { AuthedMenu } from "@/components/authed-menu";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { supabaseConversationsClient } from "@/lib/people-search/conversations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoNectar",
  description: "O comunitate pentru oameni care participă la cercuri de bărbați și de femei și vor să se conecteze prin resursele pe care le oferă.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = user
    ? await supabase.from("members").select("id, role").eq("id", user.id).maybeSingle()
    : { data: null };
  const conversations = member
    ? await supabaseConversationsClient(supabase).listConversations(member.id)
    : [];

  return (
    <html lang="ro" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("conectar-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          {member && (
            <AuthedMenu
              isAdmin={member.role === "admin"}
              conversations={conversations}
            />
          )}
          {children}
          {member && <SiteFooter />}
          <Suspense>
            <SearchParamsToast />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
