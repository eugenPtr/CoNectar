import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { searchMembers, type GenerationRequest, type SearchMembersDbClient } from "@/lib/people-search/search-members";
import { createTestDb, pgliteSearchMembersAdapter, seedMember } from "./db";

describe("searchMembers three-path orchestration", () => {
  let db: PGlite;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await db.close(); });

  function captureGenerate() {
    let captured: GenerationRequest | undefined;
    return { generate: (req: GenerationRequest) => { captured = req; return "ANSWER"; }, get: () => captured };
  }

  it("embeds once, searches all three indexes, and merges separate project evidence by Member", async () => {
    const embedder = vi.fn(async () => [1, 0, 0]);
    const matchResources = vi.fn<SearchMembersDbClient["matchResources"]>(async () => ({ data: [
      { memberId: "provider", firstName: "Ana", lastName: "Pop", resourceId: "r1", description: "Mentorat de produs", classification: "free", similarity: 0.82 },
      { memberId: "provider", firstName: "Ana", lastName: "Pop", resourceId: "r2", description: "Audit UX", classification: "paid", similarity: 0.75 },
    ], error: null }));
    const matchProfileContexts = vi.fn<SearchMembersDbClient["matchProfileContexts"]>(async () => ({ data: [
      { memberId: "provider", firstName: "Ana", lastName: "Pop", passions: "design de produs", similarity: 0.91 },
      { memberId: "interested", firstName: "Mihai", lastName: "Ionescu", passions: "cercetare UX", similarity: 0.95 },
    ], error: null }));
    const matchHeartProjects = vi.fn(async () => ({ data: [
      { memberId: "provider", firstName: "Ana", lastName: "Pop", projectId: "hp1", title: "Accesibilitate digitală", description: "Construiesc produse digitale accesibile", similarity: 0.93 },
      { memberId: "provider", firstName: "Ana", lastName: "Pop", projectId: "hp2", title: "Atelier UX", description: "Organizez ateliere de cercetare UX", similarity: 0.81 },
    ], error: null }));
    const cap = captureGenerate();
    const { candidates } = await searchMembers(
      { embedder, db: { matchResources, matchProfileContexts, matchHeartProjects }, generate: cap.generate },
      { query: "Caut pe cineva care mă poate ajuta cu UX", searcherId: "self" },
    );

    expect(embedder).toHaveBeenCalledTimes(1);
    expect(matchResources).toHaveBeenCalledWith(expect.objectContaining({ matchCount: 12, minSimilarity: 0.3 }));
    expect(matchProfileContexts).toHaveBeenCalledWith(expect.objectContaining({ matchCount: 12, minSimilarity: 0.3 }));
    expect(matchHeartProjects).toHaveBeenCalledWith(expect.objectContaining({ minSimilarity: 0.3 }));
    expect(matchResources.mock.calls[0][0].queryEmbedding).toBe(matchProfileContexts.mock.calls[0][0].queryEmbedding);
    expect(candidates.map((candidate) => candidate.memberId)).toEqual(["provider", "interested"]);
    expect(candidates[0].evidence.map((evidence) => evidence.type)).toEqual([
      "free_resource", "paid_resource", "passion", "heart_project", "heart_project",
    ]);
    expect(candidates[0].evidence.filter((evidence) => evidence.type === "heart_project")).toEqual([
      expect.objectContaining({ projectId: "hp1", title: "Accesibilitate digitală", text: "Construiesc produse digitale accesibile" }),
      expect.objectContaining({ projectId: "hp2", title: "Atelier UX", text: "Organizez ateliere de cercetare UX" }),
    ]);
    expect(cap.get()?.contextBlock).toContain("title: \"Accesibilitate digitală\"");
    expect(cap.get()?.contextBlock).toContain('type: passion\n      text: "design de produs"');
    expect(cap.get()?.system).toContain("never call it a Resource");
  });

  it("ranks general topic matches by similarity, including interest-only Members", async () => {
    const dbClient: SearchMembersDbClient = {
      matchResources: async () => ({ data: [{ memberId: "provider", firstName: "Ana", lastName: "Pop", resourceId: "r1", description: "Atelier ceramică", classification: "paid", similarity: 0.72 }], error: null }),
      matchProfileContexts: async () => ({ data: [{ memberId: "enthusiast", firstName: "Dan", lastName: "Stan", passions: "ceramică japoneză", similarity: 0.94 }], error: null }),
      matchHeartProjects: async () => ({ data: [], error: null }),
    };
    const { candidates } = await searchMembers(
      { embedder: async () => [1, 0, 0], db: dbClient, generate: () => "ok" },
      { query: "ceramică japoneză", searcherId: "self" },
    );
    expect(candidates.map((candidate) => candidate.memberId)).toEqual(["enthusiast", "provider"]);
  });

  it("queries both pgvector-equivalent indexes with representative Romanian content", async () => {
    const searcher = await seedMember(db, { firstName: "Self", lastName: "Searcher", embedding: [0, 0, 1] });
    const both = await seedMember(db, {
      firstName: "Ioana", lastName: "Munteanu", passions: "arhitectură sustenabilă",
      heartProjectDescription: "Case sănătoase din materiale naturale", profileContextEmbedding: [0.9, 0.1, 0],
      resources: [
        { description: "Consultanță gratuită pentru case din baloți de paie", classification: "free", embedding: [1, 0, 0] },
        { description: "Proiectare contra cost pentru case ecologice", classification: "paid", embedding: [0.8, 0.2, 0] },
      ],
    });
    const interestOnly = await seedMember(db, {
      firstName: "Radu", lastName: "Verde", passions: "materiale naturale și permacultură",
      profileContextEmbedding: [0.95, 0.05, 0], resources: [{ description: "Lecții de chitară", classification: "free", embedding: [0, 0, 1] }],
    });
    const cap = captureGenerate();
    const { candidates } = await searchMembers(
      { embedder: async () => [1, 0, 0], db: pgliteSearchMembersAdapter(db), generate: cap.generate },
      { query: "Caut ajutor pentru o casă din materiale naturale", searcherId: searcher },
    );
    expect(candidates.map((candidate) => candidate.memberId)).toEqual([both, interestOnly]);
    expect(candidates[0].evidence.filter((evidence) => evidence.type.endsWith("resource"))).toHaveLength(2);
    expect(candidates[1].evidence).toEqual([expect.objectContaining({ type: "passion", text: "materiale naturale și permacultură" })]);
  });

  it("returns no candidates when neither index clears its floor", async () => {
    const cap = captureGenerate();
    const empty: SearchMembersDbClient = {
      matchResources: async () => ({ data: [], error: null }),
      matchProfileContexts: async () => ({ data: [], error: null }),
      matchHeartProjects: async () => ({ data: [], error: null }),
    };
    const { candidates } = await searchMembers(
      { embedder: async () => [0, 1, 0], db: empty, generate: cap.generate },
      { query: "ceva absent", searcherId: "self" },
    );
    expect(candidates).toEqual([]);
    expect(cap.get()?.contextBlock).toBe("CANDIDATES: (none)");
  });

  it("returns generated text that references the retrieved Members", async () => {
    const dbClient: SearchMembersDbClient = {
      matchResources: async () => ({
        data: [
          { memberId: "ana", firstName: "Ana", lastName: "Pop", resourceId: "r1", description: "Consultanță în construcții naturale", classification: "free", similarity: 0.91 },
          { memberId: "bob", firstName: "Bob", lastName: "Ionescu", resourceId: "r2", description: "Proiectare cu materiale moderne", classification: "paid", similarity: 0.87 },
        ],
        error: null,
      }),
      matchProfileContexts: async () => ({ data: [], error: null }),
      matchHeartProjects: async () => ({ data: [], error: null }),
    };

    const { result } = await searchMembers(
      {
        embedder: async () => [1, 0, 0],
        db: dbClient,
        generate: ({ candidates }) =>
          `Îți recomand ${candidates.map((candidate) => `${candidate.firstName} ${candidate.lastName}`).join(" și ")}.`,
      },
      { query: "Cine mă poate ajuta să construiesc o casă?", searcherId: "self" },
    );

    expect(result.trim()).not.toBe("");
    expect(result).toContain("Ana Pop");
    expect(result).toContain("Bob Ionescu");
  });

  it("limits the generation context to the ten strongest Members", async () => {
    const matches = Array.from({ length: 12 }, (_, index) => ({
      memberId: `member-${index}`,
      firstName: `Member${index}`,
      lastName: "Test",
      resourceId: `resource-${index}`,
      description: `Resource ${index}`,
      classification: "free" as const,
      similarity: 1 - index / 100,
    }));
    const dbClient: SearchMembersDbClient = {
      matchResources: async () => ({ data: matches, error: null }),
      matchProfileContexts: async () => ({ data: [], error: null }),
      matchHeartProjects: async () => ({ data: [], error: null }),
    };

    const { candidates } = await searchMembers(
      { embedder: async () => [1, 0, 0], db: dbClient, generate: () => "ok" },
      { query: "Caut ajutor", searcherId: "self" },
    );

    expect(candidates).toHaveLength(10);
    expect(candidates.map((candidate) => candidate.memberId)).toEqual(
      matches.slice(0, 10).map((match) => match.memberId),
    );
  });
});
