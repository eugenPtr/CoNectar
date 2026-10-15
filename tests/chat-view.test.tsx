// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatView } from "@/components/chat-view";

const chat = vi.hoisted(() => ({
  status: "submitted",
  messages: [] as Array<{ id: string; role: "user" | "assistant"; parts: Array<{ type: "text"; text: string }> }>,
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({ ...chat, sendMessage: vi.fn(), error: undefined }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ChatView reply progress", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    chat.status = "submitted";
    chat.messages = [{ id: "user-1", role: "user", parts: [{ type: "text", text: "Salut" }] }];
  });
  afterEach(cleanup);

  it("shows progress until the assistant starts writing", () => {
    const { rerender } = render(<ChatView conversationId="chat-1" initialMessages={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Pregătesc răspunsul");

    chat.status = "streaming";
    chat.messages = [...chat.messages, { id: "assistant-1", role: "assistant", parts: [] }];
    rerender(<ChatView conversationId="chat-1" initialMessages={[]} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    chat.messages = [...chat.messages.slice(0, -1), {
      id: "assistant-1", role: "assistant", parts: [{ type: "text", text: "Bună!" }],
    }];
    rerender(<ChatView conversationId="chat-1" initialMessages={[]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Bună!")).toBeInTheDocument();
  });
});
