// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

vi.mock("sonner", () => ({ Toaster: () => null }));

describe("appearance choice", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    [false, "Întunecat", "dark"],
    [true, "Luminos", "light"],
  ])("switches directly from the device theme to %s's opposite", async (deviceIsDark, label, nextTheme) => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: deviceIsDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);

    const toggle = screen.getByRole("button", { name: `Activează modul ${label.toLowerCase()}` });
    await user.click(toggle);
    expect(document.documentElement).toHaveAttribute("data-theme", nextTheme);
    expect(window.localStorage.getItem("conectar-theme")).toBe(nextTheme);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Activează modul ${deviceIsDark ? "întunecat" : "luminos"}` }));
    expect(document.documentElement).toHaveAttribute("data-theme", deviceIsDark ? "dark" : "light");
  });
});
