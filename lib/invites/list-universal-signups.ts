import type { SupabaseClient } from "@supabase/supabase-js";

export interface UniversalInviteSignup {
  id: string;
  email: string;
  name: string;
  code: string;
  createdAt: string;
}

export async function listUniversalInviteSignups(
  service: SupabaseClient,
): Promise<UniversalInviteSignup[]> {
  const signups: Array<{ member_id: string; code: string; created_at: string }> = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await service
      .from("universal_invite_signups")
      .select("member_id, code, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`listUniversalInviteSignups failed: ${error.message}`);
    signups.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const members = new Map<string, { email: string; name: string }>();
  for (let from = 0; from < signups.length; from += 100) {
    const ids = signups.slice(from, from + 100).map((signup) => signup.member_id);
    const [memberResult, profileResult] = await Promise.all([
      service.from("members").select("id, email").in("id", ids),
      service.from("profiles").select("member_id, first_name, last_name").in("member_id", ids),
    ]);
    if (memberResult.error) throw new Error(`listUniversalInviteSignups members failed: ${memberResult.error.message}`);
    if (profileResult.error) throw new Error(`listUniversalInviteSignups profiles failed: ${profileResult.error.message}`);
    const names = new Map((profileResult.data ?? []).map((profile) => [
      profile.member_id, `${profile.first_name} ${profile.last_name}`.trim(),
    ]));
    for (const member of memberResult.data ?? []) {
      members.set(member.id, {
        email: member.email,
        name: names.get(member.id) || member.email,
      });
    }
  }

  return signups.flatMap((signup) => {
    const member = members.get(signup.member_id);
    return member ? [{
      id: signup.member_id,
      email: member.email,
      name: member.name,
      code: signup.code,
      createdAt: signup.created_at,
    }] : [];
  });
}
