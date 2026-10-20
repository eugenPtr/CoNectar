import { describe, expect, it, vi } from "vitest";
import { embedProfileContext } from "@/lib/people-search/embed-member";
import { createProfileWebhookHandler } from "@/supabase/functions/embed-profile/handler";

const payload = {
  type: "UPDATE",
  table: "profiles",
  schema: "public",
  record: { member_id: "member-007" },
  old_record: { member_id: "member-007", passions: "vechi" },
} as const;

describe("embed-profile webhook", () => {
  it("writes a fixture vector when a Profile changes", async () => {
    const writeProfileContextEmbedding = vi.fn(async () => ({ error: null }));
    const handler = createProfileWebhookHandler({
      reembedProfile: (memberId) => embedProfileContext({
        embedder: async () => [0.25, 0.5, 0.75],
        db: {
          getProfileContext: async () => ({
            data: {
              passions: "permacultură",
              heartProjectDescription: "grădini comunitare",
              heartProjectSeeking: true,
            },
            error: null,
          }),
          writeProfileContextEmbedding,
        },
      }, memberId),
    });

    const response = await handler(new Request("http://localhost/embed-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(200);
    expect(writeProfileContextEmbedding).toHaveBeenCalledWith({
      id: "member-007",
      embedding: [0.25, 0.5, 0.75],
      embeddingInput: "Pasiuni: permacultură\nCaută un proiect de suflet.",
    });
  });

  it("rejects requests that are not Profile insert/update webhooks", async () => {
    const reembedProfile = vi.fn();
    const handler = createProfileWebhookHandler({ reembedProfile });
    const response = await handler(new Request("http://localhost/embed-profile", {
      method: "POST",
      body: JSON.stringify({ ...payload, table: "members" }),
    }));

    expect(response.status).toBe(400);
    expect(reembedProfile).not.toHaveBeenCalled();
  });
});
