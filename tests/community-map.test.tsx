// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommunityMap } from "@/components/community-map";

vi.mock("cytoscape", () => {
  const collection = { removeClass: () => collection, addClass: () => collection };
  return { default: () => ({ on: vi.fn(), destroy: vi.fn(), elements: () => collection, getElementById: () => collection, fit: vi.fn(), zoom: vi.fn(() => 1), minZoom: () => 0.1, maxZoom: () => 3, width: () => 800, height: () => 600 }) };
});

const themes = [
  { id: "nature", name: "Natură", description: "Spații naturale" },
  { id: "therapy", name: "Terapie", description: "Sprijin emoțional" },
];
const projects = [
  { id: "retreat", title: "Tabără de terapie", description: "Un refugiu între copaci", memberId: "ana", memberName: "Ana Pop", themeIds: ["nature", "therapy"] },
  { id: "forest", title: "Pădure urbană", description: "Plantăm arbori în oraș", memberId: "mihai", memberName: "Mihai Ionescu", themeIds: ["nature"] },
  { id: "dance", title: "Atelier de dans", description: "Dans pentru comunitate", memberId: "irina", memberName: "Irina Stan", themeIds: [] },
];

afterEach(cleanup);

describe("Community Map", () => {
  it("offers every project through a keyboard accessible list and opens its Profile", async () => {
    const user = userEvent.setup();
    render(<CommunityMap themes={themes} projects={projects} />);

    const other = screen.getByRole("group", { name: "Alte proiecte" });
    expect(within(other).getByRole("button", { name: /Atelier de dans/ })).toBeInTheDocument();
    await user.click(within(other).getByRole("button", { name: /Atelier de dans/ }));
    const detail = screen.getByRole("region", { name: "Detalii proiect" });
    expect(within(detail).getByText("Dans pentru comunitate")).toBeInTheDocument();
    expect(within(detail).getByRole("link", { name: /Irina Stan/ })).toHaveAttribute("href", "/profile/irina");
    await user.click(within(detail).getByRole("button", { name: "Închide detaliile" }));
    expect(screen.queryByRole("region", { name: "Detalii proiect" })).not.toBeInTheDocument();
  });

  it("searches titles, member names, and themes locally", async () => {
    const user = userEvent.setup();
    render(<CommunityMap themes={themes} projects={projects} />);
    const search = screen.getByRole("searchbox", { name: "Caută în hartă" });
    await user.type(search, "terapie");
    expect(screen.getAllByRole("button", { name: /Tabără de terapie/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Pădure urbană/ })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "Mihai");
    expect(screen.getByRole("button", { name: /Pădure urbană/ })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "necunoscut");
    expect(screen.getByRole("status")).toHaveTextContent("Niciun rezultat");
  });

  it("shows the multi-theme relationship and lets a keyboard user select a theme", async () => {
    const user = userEvent.setup();
    render(<CommunityMap themes={themes} projects={projects} />);
    const nature = screen.getByRole("group", { name: "Natură" });
    const therapy = screen.getByRole("group", { name: "Terapie" });
    expect(within(nature).getByRole("button", { name: /Tabără de terapie/ })).toBeInTheDocument();
    expect(within(therapy).getByRole("button", { name: /Tabără de terapie/ })).toBeInTheDocument();
    await user.click(within(therapy).getByRole("button", { name: /^Terapie/ }));
    expect(within(therapy).getByRole("button", { name: /^Terapie/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("states when the map has no published projects", () => {
    render(<CommunityMap themes={themes} projects={[]} />);
    expect(screen.getByText(/Încă nu există Proiecte de Suflet/)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Natură" })).toBeInTheDocument();
  });
});
