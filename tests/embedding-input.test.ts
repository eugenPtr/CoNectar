import { describe, expect, it } from "vitest";
import { buildEmbeddingInput, buildProfileContextEmbeddingInput } from "@/lib/people-search/embedding-input";

describe("buildEmbeddingInput", () => {
  it("normalizes exactly one Resource description", () => {
    expect(buildEmbeddingInput("  Mentorat   tehnic  ")).toBe("Mentorat tehnic");
  });

  it("keeps Profile context separate from Resources", () => {
    const input = buildProfileContextEmbeddingInput({
      passions: "  ceramică   japoneză ",
      heartProjectDescription: "Ateliere pentru copii",
      heartProjectSeeking: false,
    });
    expect(input).toBe("Pasiuni: ceramică japoneză");
    expect(input).not.toContain("Mentorat tehnic");
  });
});
