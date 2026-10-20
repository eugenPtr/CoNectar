import type { SupabaseClient } from "@supabase/supabase-js";
import type { MapProject, MapTheme } from "@/components/community-map";

type ThemeRow = MapTheme;
type ProjectRow = Pick<MapProject, "id" | "title" | "description"> & { member_id: string };
type LinkRow = { heart_project_id: string; theme_id: string };
type MemberRow = { id: string; first_name: string; last_name: string };

export interface CommunityMapReader {
  themes(): Promise<ThemeRow[]>;
  projects(): Promise<ProjectRow[]>;
  links(): Promise<LinkRow[]>;
  members(): Promise<MemberRow[]>;
}

export async function loadCommunityMap(reader: CommunityMapReader): Promise<{ themes: MapTheme[]; projects: MapProject[] }> {
  const [themes, projects, links, members] = await Promise.all([reader.themes(), reader.projects(), reader.links(), reader.members()]);
  const activeIds = new Set(themes.map((theme) => theme.id));
  const names = new Map(members.map((member) => [member.id, `${member.first_name} ${member.last_name}`.trim()]));
  const themeIdsByProject = new Map<string, string[]>();
  for (const link of links) {
    if (!activeIds.has(link.theme_id)) continue;
    const ids = themeIdsByProject.get(link.heart_project_id) ?? [];
    if (!ids.includes(link.theme_id)) ids.push(link.theme_id);
    themeIdsByProject.set(link.heart_project_id, ids);
  }
  return {
    themes,
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      memberId: project.member_id,
      memberName: names.get(project.member_id) ?? "Membru",
      themeIds: themeIdsByProject.get(project.id) ?? [],
    })),
  };
}

// These are ordinary, cookie-bound queries. Each table's SELECT policy enforces
// the Member gate; no elevated client or AI request is used to display the map.
export function supabaseCommunityMapReader(supabase: SupabaseClient): CommunityMapReader {
  return {
    async themes() {
      const { data, error } = await supabase.from("themes").select("id,name,description").is("archived_at", null).order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async projects() {
      const { data, error } = await supabase.from("heart_projects").select("id,title,description,member_id").order("member_id").order("position");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async links() {
      const { data, error } = await supabase.from("heart_project_theme_links").select("heart_project_id,theme_id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async members() {
      const { data, error } = await supabase.from("profiles").select("member_id,first_name,last_name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ id: row.member_id, first_name: row.first_name, last_name: row.last_name }));
    },
  };
}
