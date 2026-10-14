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
  afterEach(cleanup);

  it("defaults to the device and saves or clears an explicit choice", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);

    await user.click(screen.getByRole("button", { name: /Aspect: alege/ }));
    expect(screen.getByRole("menuitemradio", { name: "Dispozitiv" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemradio", { name: "Întunecat" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("conectar-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: /Aspect: alege/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Dispozitiv" }));
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(window.localStorage.getItem("conectar-theme")).toBeNull();
  });
});
