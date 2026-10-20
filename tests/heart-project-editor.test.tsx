// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeartProjectEditor } from "@/components/heart-project-editor";
import type { HeartProjectInput } from "@/lib/heart-projects/save";

function Harness() {
  const [projects, setProjects] = useState<HeartProjectInput[]>([]);
  return <><HeartProjectEditor projects={projects} onChange={setProjects} /><output>{projects.map((project) => project.title).join(",")}</output></>;
}

describe("Heart Project editor", () => {
  it("adds, reorders and restores a removed project without a pointer gesture", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Titlu proiect"), { target: { value: "Dans" } });
    fireEvent.change(screen.getByLabelText("Descriere proiect"), { target: { value: "Un spațiu de dans" } });
    fireEvent.click(screen.getByRole("button", { name: "Adaugă proiect" }));
    fireEvent.change(screen.getByLabelText("Titlu proiect"), { target: { value: "Pădure" } });
    fireEvent.change(screen.getByLabelText("Descriere proiect"), { target: { value: "Plantăm copaci" } });
    fireEvent.click(screen.getByRole("button", { name: "Adaugă proiect" }));
    fireEvent.click(screen.getByRole("button", { name: "Mută Pădure mai sus" }));
    expect(screen.getByText("Pădure,Dans")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elimină Pădure" }));
    expect(screen.getByRole("status").textContent).toBe("Dans");
    fireEvent.click(screen.getByRole("button", { name: "Anulează eliminarea" }));
    expect(screen.getByText("Pădure,Dans")).toBeInTheDocument();
  });
});
