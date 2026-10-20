export function buildEmbeddingInput(description: string): string {
  return description.trim().replace(/\s+/g, " ");
}

export function buildProfileContextEmbeddingInput(input: {
  passions: string;
  heartProjectDescription?: string | null;
  heartProjectSeeking: boolean;
}): string {
  const parts = [`Pasiuni: ${buildEmbeddingInput(input.passions)}`];
  if (input.heartProjectSeeking) parts.push("Caută un proiect de suflet.");
  return parts.join("\n");
}
