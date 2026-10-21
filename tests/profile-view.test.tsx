// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileView } from "@/components/profile-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const base = {
  id: "m1", name: "Ana Pop", location: "Cluj", passions: "Muzică",
  heartProjectDescription: null, heartProjectSeeking: true, heartProjects: [], socials: {},
};

describe("ProfileView Resources", () => {
  afterEach(cleanup);
  it("shows full free Resources before paid Resources in stored order", () => {
    render(<ProfileView isOwn={false} profile={{ ...base, resources: [
      { id: "f1", description: "Mentorat cu o descriere completă care se poate împacheta", classification: "free", position: 0 },
      { id: "f2", description: "Atelier", classification: "free", position: 1 },
      { id: "p1", description: "Audit software", classification: "paid", position: 0 },
    ] }} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings.indexOf("Resurse gratis")).toBeLessThan(headings.indexOf("Resurse contra cost"));
    expect(screen.getByText(/descriere completă/)).toHaveClass("border-emerald-500/70");
    expect(screen.getByText("Audit software")).toHaveClass("border-sky-500/70");
  });

  it("hides empty Resource categories", () => {
    render(<ProfileView isOwn={false} profile={{ ...base, resources: [
      { id: "p1", description: "Audit software", classification: "paid", position: 0 },
    ] }} />);
    expect(screen.queryByText("Resurse gratis")).not.toBeInTheDocument();
    expect(screen.getByText("Resurse contra cost")).toBeInTheDocument();
  });

  it("shows Resource editing only on the owner's Profile", () => {
    const { rerender } = render(<ProfileView isOwn profile={{ ...base, resources: [] }} />);
    expect(screen.getByRole("link", { name: "Editează profilul" })).toHaveAttribute("href", "/profile/edit");
    rerender(<ProfileView isOwn={false} profile={{ ...base, resources: [] }} />);
    expect(screen.queryByRole("link", { name: "Editează profilul" })).not.toBeInTheDocument();
  });

  it("frames Passions and Heart Project with neutral borders", () => {
    render(<ProfileView isOwn={false} profile={{ ...base, resources: [] }} />);
    expect(screen.getByText("Muzică")).toHaveClass("border-zinc-700");
    expect(screen.getByText("În căutare")).toHaveClass("border-zinc-700");
  });

  it("shows each Heart Project as a distinct ordered pursuit", () => {
    render(<ProfileView isOwn={false} profile={{ ...base, resources: [], heartProjects: [
      { id: "a", title: "Dans", description: "Spațiu de dans", position: 0 },
      { id: "b", title: "Pădure", description: "Plantare", position: 1 },
    ] }} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Dans", "Pădure"]);
  });
});

describe("ProfileView birth details", () => {
  afterEach(cleanup);

  const birth = {
    birthDate: "1990-05-14", birthTime: "08:30", birthplace: "Cluj-Napoca, Cluj, România",
    latitude: 46.7712, longitude: 23.6236, timezone: "Europe/Bucharest", isVisible: true,
    chartStatus: "ready" as const, chartUrl: "/api/natal-chart/m1",
  };

  it("shows the three birth values in one row with the chart", () => {
    render(<ProfileView isOwn={false} profile={{ ...base, resources: [], birth }} />);
    const heading = screen.getByRole("heading", { name: "Datele nașterii" });
    const row = heading.nextElementSibling;
    expect(row).toHaveTextContent("14 mai 1990");
    expect(row).toHaveTextContent("08:30");
    expect(row).toHaveTextContent("Cluj-Napoca, Cluj, România");
    expect(screen.getByRole("img", { name: "Harta natală" })).toHaveAttribute("src", birth.chartUrl);
  });

  it("keeps pending and failed chart controls for the owner", () => {
    const { rerender } = render(<ProfileView isOwn profile={{ ...base, resources: [], birth: { ...birth, chartStatus: "pending", chartUrl: null } }} />);
    expect(screen.getByText(/se generează/)).toBeInTheDocument();
    rerender(<ProfileView isOwn profile={{ ...base, resources: [], birth: { ...birth, chartStatus: "failed", chartUrl: null, isVisible: false } }} />);
    expect(screen.getByText(/vizibile doar pentru tine/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reîncearcă/i })).toBeInTheDocument();
  });

  it("has no birth section when RLS returns no birth data", () => {
    render(<ProfileView isOwn={false} profile={{ ...base, resources: [], birth: null }} />);
    expect(screen.queryByRole("heading", { name: "Datele nașterii" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Harta natală" })).not.toBeInTheDocument();
  });
});
