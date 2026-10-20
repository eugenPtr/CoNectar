"use server";

import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import {
  generateInvite,
  supabaseGenerateInviteClient,
} from "@/lib/invites/generate";
import { revalidatePath } from "next/cache";
import { gatewayEmbedder } from "@/lib/people-search/ai-gateway";
import { archiveTheme, saveTheme, supabaseThemeStore, type ThemeInput } from "@/lib/community-map/themes";

// Mint a new invite attributed to the acting Admin and return its code (the
// client builds the link and copies it). Re-verifies the caller is an Admin
// before writing -- the menu gate hides the route, this enforces it (ADR-0007).
// The Admin check runs on the cookie-bound client (is_admin() reads auth.uid());
// the insert runs on the service-role client, which bypasses RLS.
export async function generateInviteAction(): Promise<{ code: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  const service = createSupabaseServiceClient();
  const code = await generateInvite(supabaseGenerateInviteClient(service), {
    adminId: user.id,
  });

  return { code };
}

async function adminThemeClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) return null;
  return supabaseThemeStore(supabase);
}

export async function saveThemeAction(input: ThemeInput) {
  const db = await adminThemeClient();
  if (!db) return { kind: "unauthorized" } as const;
  try {
    const result = await saveTheme({ db, embedder: gatewayEmbedder }, input);
    if (result.kind === "ok") {
      revalidatePath("/admin/dashboard");
      revalidatePath("/community-map");
    }
    return result;
  } catch (error) {
    console.error("Theme save failed", error);
    return { kind: "failed" } as const;
  }
}

export async function archiveThemeAction(id: string) {
  const db = await adminThemeClient();
  if (!db) return { kind: "unauthorized" } as const;
  try {
    const result = await archiveTheme(db, id);
    if (result.kind === "ok") {
      revalidatePath("/admin/dashboard");
      revalidatePath("/community-map");
    }
    return result;
  } catch (error) {
    console.error("Theme archive failed", error);
    return { kind: "failed" } as const;
  }
}
