import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { supabaseInviteValidateClient, validateInvite } from "@/lib/invites/validate";
import { universalInviteConfig } from "@/lib/invites/universal";
import OnboardingForm from "./form";

type SearchParams = Promise<{ invite?: string }>;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (member) {
    redirect("/");
  }

  const { invite } = await searchParams;

  if (!invite) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-semibold">Niciun cod de invitație</h1>
        <p className="text-sm text-zinc-300">
          Pornește din linkul tău de invitație ca să intri în rețea.
        </p>
      </main>
    );
  }

  const service = createSupabaseServiceClient();
  const validation = await validateInvite(
    supabaseInviteValidateClient(service), invite, universalInviteConfig(),
  );
  if (validation.kind !== "valid") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-2xl font-semibold">Cod de invitație indisponibil</h1>
        <p className="text-sm text-zinc-300">Contactează persoana care te-a invitat.</p>
      </main>
    );
  }

  const { data: communities } = await supabase
    .from("affiliated_communities")
    .select("id, name")
    .order("name");

  return (
    <OnboardingForm
      invite={invite}
      memberId={user.id}
      loginEmail={user.email ?? ""}
      communities={communities ?? []}
    />
  );
}
