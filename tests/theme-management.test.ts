import { describe, expect, it, vi } from "vitest";
import { archiveTheme, saveTheme } from "@/lib/community-map/themes";

describe("Admin Theme management", () => {
  it("embeds a Theme definition before publishing it", async () => {
    const saved: unknown[] = [];
    const embedder = vi.fn(async () => Array(1536).fill(0.5));
    const result = await saveTheme({
      embedder,
      db: { findTheme: async () => null, saveTheme: async (theme) => { saved.push(theme); return { id: "theme-1" }; }, archiveTheme: async () => {} },
    }, { name: "  Spații naturale  ", description: "  Locuri de reconectare  " });
    expect(result).toEqual({ kind: "ok", id: "theme-1" });
    expect(embedder).toHaveBeenCalledWith("Spații naturale\nLocuri de reconectare");
    expect(saved).toMatchObject([{ name: "Spații naturale", description: "Locuri de reconectare", embeddingInput: "Spații naturale\nLocuri de reconectare" }]);
  });

  it("does not publish an edited Theme if embedding fails", async () => {
    const save = vi.fn();
    await expect(saveTheme({
      embedder: async () => { throw new Error("gateway unavailable"); },
      db: { findTheme: async () => ({ id: "theme-1", embeddingInput: "Old\nDescription" }), saveTheme: save, archiveTheme: async () => {} },
    }, { id: "theme-1", name: "New", description: "Description" })).rejects.toThrow("gateway unavailable");
    expect(save).not.toHaveBeenCalled();
  });

  it("archives a Theme without embedding", async () => {
    const archived: string[] = [];
    await archiveTheme({ findTheme: async () => null, saveTheme: async () => ({ id: "unused" }), archiveTheme: async (id) => { archived.push(id); } }, "theme-1");
    expect(archived).toEqual(["theme-1"]);
  });
});
