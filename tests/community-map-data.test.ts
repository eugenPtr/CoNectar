import { describe, expect, it } from "vitest";
import { loadCommunityMap } from "@/lib/community-map/data";

describe("Member Community Map read model", () => {
  it("keeps one project with several active Theme links and leaves unmatched projects visible", async () => {
    const result = await loadCommunityMap({
      themes: async () => [{ id: "nature", name: "Natură", description: "Spații naturale" }, { id: "therapy", name: "Terapie", description: "Sprijin" }],
      projects: async () => [{ id: "retreat", title: "Tabără", description: "Între copaci", member_id: "ana" }, { id: "dance", title: "Dans", description: "Atelier", member_id: "irina" }],
      links: async () => [{ heart_project_id: "retreat", theme_id: "nature" }, { heart_project_id: "retreat", theme_id: "therapy" }, { heart_project_id: "dance", theme_id: "archived" }],
      members: async () => [{ id: "ana", first_name: "Ana", last_name: "Pop" }, { id: "irina", first_name: "Irina", last_name: "Stan" }],
    });

    expect(result.projects).toEqual([
      { id: "retreat", title: "Tabără", description: "Între copaci", memberId: "ana", memberName: "Ana Pop", themeIds: ["nature", "therapy"] },
      { id: "dance", title: "Dans", description: "Atelier", memberId: "irina", memberName: "Irina Stan", themeIds: [] },
    ]);
  });
});
