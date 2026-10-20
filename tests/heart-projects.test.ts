import { describe, expect, it, vi } from "vitest";
import { normalizeHeartProjects, saveHeartProjects } from "@/lib/heart-projects/save";

describe("Heart Project save boundary", () => {
  it("publishes multiple ordered projects and retains unchanged embeddings on reorder", async () => {
    const first = { id: "first", title: "Dans", description: "Un spațiu pentru dans", position: 0, embedding: [1], embeddingInput: "Dans\nUn spațiu pentru dans" };
    const db = { loadProjects: vi.fn().mockResolvedValue({ data: [first], error: null }), replaceProjects: vi.fn().mockResolvedValue({ error: null }) };
    const embedder = vi.fn().mockResolvedValue([2]);
    const result = await saveHeartProjects({ db, embedder }, { memberId: "member", projects: [
      { id: "new", title: "Pădure", description: "Plantăm copaci" },
      { id: "first", title: "Dans", description: "Un spațiu pentru dans" },
    ] });
    expect(result).toEqual({ kind: "ok" });
    expect(embedder).toHaveBeenCalledOnce();
    expect(db.replaceProjects).toHaveBeenCalledWith("member", [
      expect.objectContaining({ title: "Pădure", position: 0, embedding: [2] }),
      expect.objectContaining({ id: "first", position: 1, embedding: [1] }),
    ]);
  });

  it("rejects an eleventh project without writing", async () => {
    const db = { loadProjects: vi.fn(), replaceProjects: vi.fn() };
    const result = await saveHeartProjects({ db, embedder: vi.fn() }, { memberId: "member", projects: Array.from({ length: 11 }, (_, i) => ({ title: `Project ${i}`, description: "Description" })) });
    expect(result).toEqual({ kind: "invalid" });
    expect(db.replaceProjects).not.toHaveBeenCalled();
  });

  it("leaves published rows unchanged when embedding fails", async () => {
    const db = { loadProjects: vi.fn().mockResolvedValue({ data: [], error: null }), replaceProjects: vi.fn() };
    await expect(saveHeartProjects({ db, embedder: vi.fn().mockRejectedValue(new Error("gateway unavailable")) }, { memberId: "member", projects: [{ title: "Dans", description: "Descriere" }] })).rejects.toThrow("gateway unavailable");
    expect(db.replaceProjects).not.toHaveBeenCalled();
  });

  it("accepts an empty list for a seeking member and rejects incomplete items", () => {
    expect(normalizeHeartProjects([])).toEqual([]);
    expect(normalizeHeartProjects([{ title: "", description: "Text" }])).toBeNull();
  });
});
