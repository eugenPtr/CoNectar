// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthedMenu } from "@/components/authed-menu";

const mocks = vi.hoisted(() => ({
  deleteConversation: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/auth/sign-out", () => ({ signOutAction: vi.fn() }));
vi.mock("@/app/chat/actions", () => ({
  deleteConversationAction: mocks.deleteConversation,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/chat/active",
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <button type="button" aria-label="Aspect">Aspect</button> }));

const conversations = [
  { id: "active", title: "Casa naturală", lastMessageAt: "2026-08-10" },
  { id: "other", title: "Mentorat", lastMessageAt: "2026-08-09" },
];

describe("AuthedMenu mobile drawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteConversation.mockResolvedValue({ ok: true });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });
  afterEach(cleanup);

  it("shows Member navigation, a tertiary new Conversation link, and Recents", async () => {
    const user = userEvent.setup();
    render(<AuthedMenu isAdmin conversations={conversations} />);

    await user.click(screen.getByRole("button", { name: "Deschide meniul" }));

    expect(screen.getByRole("heading", { name: "Recente" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Membri" })).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "Conversație nouă" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Casa naturală" })).toHaveAttribute("href", "/chat/active");
    expect(screen.getAllByRole("button", { name: "Deconectare" })).not.toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Chat" })).not.toHaveLength(0);
  });

  it("deletes an active Conversation immediately from its overflow menu", async () => {
    const user = userEvent.setup();
    render(<AuthedMenu conversations={conversations} />);
    await user.click(screen.getByRole("button", { name: "Deschide meniul" }));
    await user.click(screen.getByRole("button", { name: "Acțiuni pentru Casa naturală" }));
    await user.click(screen.getByRole("button", { name: "Șterge conversația" }));

    await waitFor(() => expect(mocks.deleteConversation).toHaveBeenCalledWith("active"));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Conversația a fost ștearsă.");
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    render(<AuthedMenu conversations={conversations} />);
    await user.click(screen.getByRole("button", { name: "Deschide meniul" }));
    expect(screen.getByRole("heading", { name: "Recente" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("heading", { name: "Recente" })).not.toBeInTheDocument();
  });
});
