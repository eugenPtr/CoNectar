// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingForm from "@/app/onboarding/form";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(), replace: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock("@/app/onboarding/actions", () => ({ submitOnboardingAction: mocks.submit }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

describe("OnboardingForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:profile-photo") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });
  afterEach(cleanup);

  async function reachResources(user: ReturnType<typeof userEvent.setup>) {
    if (screen.queryByRole("button", { name: "Începe" })) {
      await user.click(screen.getByRole("button", { name: "Începe" }));
    }
    await user.type(screen.getByLabelText("Prenume (obligatoriu)"), "Ana");
    await user.type(screen.getByLabelText("Nume (obligatoriu)"), "Pop");
    await user.type(screen.getByLabelText("Localitate (obligatoriu)"), "Cluj");
    await user.click(screen.getByRole("button", { name: "Înainte" }));
    expect(screen.getByRole("button", { name: "Înapoi" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Pasiuni (obligatoriu)"), "Muzică");
    await user.click(screen.getByRole("button", { name: "Încă nu" }));
    await user.click(screen.getByRole("button", { name: "Înainte" }));
  }

  async function addFreeResource(user: ReturnType<typeof userEvent.setup>, text = "Mentorat tehnic") {
    await user.click(screen.getAllByRole("button", { name: "Adaugă resursă" })[0]);
    const input = screen.getByLabelText("Descrie resursa gratis");
    await user.type(input, `${text}{Enter}`);
  }

  async function reachContact(user: ReturnType<typeof userEvent.setup>) {
    await reachResources(user);
    await addFreeResource(user);
    await user.click(screen.getByRole("button", { name: "Înainte" }));
    await user.type(screen.getByLabelText("Telefon (obligatoriu)"), "721234567");
    await user.type(screen.getByLabelText("Email de contact (obligatoriu)"), "contact@example.com");
  }

  it("starts with a shared intro, then shows progress without repeating the intro copy", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    expect(screen.getByRole("heading", { name: "Intră în rețea" })).toBeInTheDocument();
    expect(screen.getByText("Spune-ne despre tine, ca membrii să te poată găsi.")).toBeInTheDocument();
    expect(screen.queryByText("Pasul 1/4")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Începe" })).toHaveClass("bg-action");
    await user.click(screen.getByRole("button", { name: "Începe" }));
    expect(screen.queryByRole("heading", { name: "Intră în rețea" })).not.toBeInTheDocument();
    expect(screen.getByText("Pasul 1/4")).toBeInTheDocument();
    expect(screen.getAllByTestId("progress-segment")).toHaveLength(4);
    expect(screen.getByLabelText("Localitate (obligatoriu)")).not.toHaveAttribute("placeholder");
    expect(screen.getByRole("button", { name: "Înainte" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Înainte" })).toHaveClass("bg-action");
    await reachResources(user);
    expect(screen.getByRole("heading", { name: "Ce resurse poți oferi comunității?" })).toBeInTheDocument();
    expect(screen.getByText("Adaugă fiecare resursă separat.")).toBeInTheDocument();
    expect(screen.queryByText(/^Exemple:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Adaugă cel puțin o resursă, gratis sau contra cost.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Înainte" })).toBeDisabled();
    await addFreeResource(user);
    expect(screen.getByRole("button", { name: "Înainte" })).toBeEnabled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("allows the same photo to be selected again after eliminating it", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await user.click(screen.getByRole("button", { name: "Începe" }));
    const input = screen.getByLabelText("Încarcă o fotografie de profil (max. 5 MB)");
    const photo = new File(["photo"], "profil.png", { type: "image/png" });

    await user.upload(input, photo);
    expect(screen.queryByLabelText("Schimbă fotografia (max. 5 MB)")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elimină selecția" }));
    expect(screen.getByLabelText("Încarcă o fotografie de profil (max. 5 MB)")).toBeInTheDocument();

    const replacementInput = screen.getByLabelText("Încarcă o fotografie de profil (max. 5 MB)");
    await user.upload(replacementInput, photo);
    expect(screen.queryByLabelText("Schimbă fotografia (max. 5 MB)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimină selecția" })).toBeInTheDocument();
  });

  it("shows a toast instead of accepting a photo over 5 MB", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await user.click(screen.getByRole("button", { name: "Începe" }));
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "mare.png", { type: "image/png" });

    await user.upload(screen.getByLabelText("Încarcă o fotografie de profil (max. 5 MB)"), oversized);

    expect(mocks.toast.error).toHaveBeenCalledWith("Fotografia trebuie să aibă cel mult 5 MB.");
  });

  it("submits classified Resources in their visible order", async () => {
    const user = userEvent.setup(); mocks.submit.mockResolvedValue({ kind: "ok" });
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await reachResources(user);
    await addFreeResource(user, "Mentorat");
    await addFreeResource(user, "Atelier");
    await user.click(screen.getAllByRole("button", { name: "Adaugă resursă" })[1]);
    await user.type(screen.getByLabelText("Descrie resursa contra cost"), "Audit software{Enter}");
    await user.click(screen.getByRole("button", { name: "Înainte" }));
    expect(screen.getByLabelText("Email de contact (obligatoriu)")).toHaveValue("");
    await user.type(screen.getByLabelText("Telefon (obligatoriu)"), "721234567");
    await user.type(screen.getByLabelText("Email de contact (obligatoriu)"), "contact@example.com");
    await user.click(screen.getByRole("button", { name: "Finalizează înregistrarea" }));
    const data = mocks.submit.mock.calls[0][0] as FormData;
    expect(data.get("free_resources")).toBe("Mentorat\nAtelier");
    expect(data.get("paid_resources")).toBe("Audit software");
    expect(data.get("contact_email")).toBe("contact@example.com");
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  it("restores Resource lists and active progress from its versioned draft", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await reachResources(user);
    await addFreeResource(user, "Mentorat păstrat");
    await waitFor(() => expect(localStorage.getItem("onboarding-draft:m1:DEV")).toContain("Mentorat păstrat"));
    cleanup();
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await user.click(screen.getByRole("button", { name: "Începe" }));
    await waitFor(() => expect(screen.getByText("Pasul 3/4")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Mentorat păstrat" })).toBeInTheDocument();
  });

  it("ignores incompatible legacy Skill drafts", async () => {
    const user = userEvent.setup();
    localStorage.setItem("onboarding-draft:m1:DEV", JSON.stringify({ version: 2, expiresAt: Date.now() + 10000, step: 3, values: { freeResources: "legacy" } }));
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await user.click(screen.getByRole("button", { name: "Începe" }));
    expect(screen.getByText("Pasul 1/4")).toBeInTheDocument();
  });

  it("surfaces an unexpected failure, preserves the draft, and permits retry", async () => {
    const user = userEvent.setup();
    mocks.submit
      .mockResolvedValueOnce({ kind: "submissionFailed", reference: "ABC12345" })
      .mockResolvedValueOnce({ kind: "ok" });
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await reachContact(user);

    const submit = screen.getByRole("button", { name: "Finalizează înregistrarea" });
    await user.click(submit);
    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.stringContaining("ABC12345"),
      { duration: 10_000 },
    );
    expect(submit).toBeEnabled();
    expect(screen.getByLabelText("Email de contact (obligatoriu)")).toHaveValue("contact@example.com");
    expect(localStorage.getItem("onboarding-draft:m1:DEV")).toContain("contact@example.com");

    await user.click(submit);
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(localStorage.getItem("onboarding-draft:m1:DEV")).toBeNull();
  });

  it("shows actionable feedback for an already-claimed invitation", async () => {
    const user = userEvent.setup();
    mocks.submit.mockResolvedValue({ kind: "alreadyClaimed" });
    render(<OnboardingForm invite="DEV" memberId="m1" loginEmail="ana@example.com" />);
    await reachContact(user);
    await user.click(screen.getByRole("button", { name: "Finalizează înregistrarea" }));
    expect(mocks.toast.error).toHaveBeenCalledWith(expect.stringContaining("deja folosit"));
  });
});
