"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";

export type MapTheme = { id: string; name: string; description: string };
export type MapProject = {
  id: string;
  title: string;
  description: string;
  memberId: string;
  memberName: string;
  themeIds: string[];
};

const OTHER_ID = "__other_projects__";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro");

function graphElements(themes: MapTheme[], projects: MapProject[]): ElementDefinition[] {
  const activeIds = new Set(themes.map((theme) => theme.id));
  const unmatched = projects.some((project) => !project.themeIds.some((id) => activeIds.has(id)));
  const groups = [...themes, ...(unmatched ? [{ id: OTHER_ID, name: "Alte proiecte", description: "Proiecte fără o temă asociată" }] : [])];
  const nodes: ElementDefinition[] = [{ data: { id: "community", label: "CoNectar", kind: "community" }, position: { x: 0, y: 0 } }];
  const edges: ElementDefinition[] = [];
  const groupPositions = new Map<string, { x: number; y: number }>();
  groups.forEach((group, index) => {
    const angle = (2 * Math.PI * index) / Math.max(groups.length, 1) - Math.PI / 2;
    const position = { x: 420 * Math.cos(angle), y: 420 * Math.sin(angle) };
    groupPositions.set(group.id, position);
    nodes.push({ data: { id: `theme:${group.id}`, label: group.name, kind: "theme", sourceId: group.id }, position });
    edges.push({ data: { id: `center:${group.id}`, source: "community", target: `theme:${group.id}` } });
  });

  const groupCounts = new Map<string, number>();
  projects.forEach((project) => {
    const themeIds = project.themeIds.filter((id) => activeIds.has(id));
    const connected = themeIds.length ? themeIds : [OTHER_ID];
    const primary = connected[0];
    const groupIndex = groupCounts.get(primary) ?? 0;
    groupCounts.set(primary, groupIndex + 1);
    const anchor = groupPositions.get(primary) ?? { x: 0, y: 0 };
    const angle = (2 * Math.PI * groupIndex) / 12;
    const radius = 175 + Math.floor(groupIndex / 12) * 100;
    nodes.push({
      data: { id: `project:${project.id}`, label: project.title, kind: "project", sourceId: project.id },
      position: { x: anchor.x + radius * Math.cos(angle), y: anchor.y + radius * Math.sin(angle) },
    });
    connected.forEach((id) => edges.push({ data: { id: `link:${project.id}:${id}`, source: `theme:${id}`, target: `project:${project.id}` } }));
  });
  return [...nodes, ...edges];
}

export function CommunityMap({ themes, projects }: { themes: MapTheme[]; projects: MapProject[] }) {
  const graphContainer = useRef<HTMLDivElement>(null);
  const graph = useRef<Core | null>(null);
  const [query, setQuery] = useState("");
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const themeById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes]);
  const unmatched = useMemo(() => projects.filter((project) => !project.themeIds.some((id) => themeById.has(id))), [projects, themeById]);
  const groups = useMemo(() => [...themes, ...(unmatched.length ? [{ id: OTHER_ID, name: "Alte proiecte", description: "Proiecte fără o temă asociată" }] : [])], [themes, unmatched.length]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const needle = normalize(query.trim());
  const matchingThemeIds = useMemo(() => new Set(themes.filter((theme) => normalize(theme.name).includes(needle)).map((theme) => theme.id)), [themes, needle]);
  const matchingProjects = useMemo(() => projects.filter((project) => !needle || normalize(project.title).includes(needle) || normalize(project.memberName).includes(needle) || project.themeIds.some((id) => matchingThemeIds.has(id))), [projects, needle, matchingThemeIds]);
  const matchingProjectIds = useMemo(() => new Set(matchingProjects.map((project) => project.id)), [matchingProjects]);

  useEffect(() => {
    if (!graphContainer.current) return;
    const styles = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const cy = cytoscape({
      container: graphContainer.current,
      elements: graphElements(themes, projects),
      layout: { name: "preset", fit: true, padding: 60 },
      minZoom: 0.1,
      maxZoom: 3,
      style: [
        { selector: "node", style: { label: "data(label)", "font-family": "Arial, sans-serif", "font-size": 17, color: color("--foreground", "#292b25"), "text-wrap": "wrap", "text-max-width": "145px", "text-valign": "center", "text-halign": "center", "border-width": 2, "border-color": color("--border-control", "#858878") } },
        { selector: 'node[kind = "community"]', style: { width: 150, height: 150, "background-color": color("--brand-green", "#24382d"), color: "#fff9ef", "font-size": 28, "font-weight": "bold", "border-color": color("--brand-gold", "#e8a33e") } },
        { selector: 'node[kind = "theme"]', style: { width: 138, height: 138, "background-color": color("--sage", "#dde8d3"), color: "#24382d", "font-weight": "bold" } },
        { selector: 'node[kind = "project"]', style: { width: 124, height: 92, shape: "round-rectangle", "background-color": color("--surface", "#ffffff") } },
        { selector: "edge", style: { width: 2, "line-color": color("--border-control", "#858878"), "curve-style": "bezier" } },
        { selector: ".dimmed", style: { opacity: 0.16 } },
        { selector: ".highlighted", style: { "border-width": 5, "border-color": color("--brand-gold", "#e8a33e"), "line-color": color("--brand-gold", "#e8a33e"), "z-index": 10 } },
      ],
    });
    cy.on("tap", "node", (event) => {
      const node = event.target;
      if (node.data("kind") === "theme") setSelectedThemeId((current) => current === node.data("sourceId") ? null : node.data("sourceId"));
      if (node.data("kind") === "project") setSelectedProjectId(node.data("sourceId"));
    });
    graph.current = cy;
    return () => { graph.current = null; cy.destroy(); };
  }, [themes, projects]);

  useEffect(() => {
    const cy = graph.current;
    if (!cy) return;
    cy.elements().removeClass("dimmed highlighted");
    const hasFocus = Boolean(needle || selectedThemeId);
    if (!hasFocus) return;
    cy.elements().addClass("dimmed");
    cy.getElementById("community").removeClass("dimmed");
    groups.forEach((group) => {
      const ids = group.id === OTHER_ID ? unmatched.map((project) => project.id) : projects.filter((project) => project.themeIds.includes(group.id)).map((project) => project.id);
      const groupMatches = !needle || matchingThemeIds.has(group.id) || ids.some((id) => matchingProjectIds.has(id));
      if (groupMatches && (!selectedThemeId || selectedThemeId === group.id)) cy.getElementById(`theme:${group.id}`).removeClass("dimmed").addClass("highlighted");
    });
    matchingProjects.filter((project) => !selectedThemeId || (selectedThemeId === OTHER_ID ? unmatched.includes(project) : project.themeIds.includes(selectedThemeId))).forEach((project) => {
      cy.getElementById(`project:${project.id}`).removeClass("dimmed").addClass("highlighted");
      const ids = project.themeIds.filter((id) => themeById.has(id));
      (ids.length ? ids : [OTHER_ID]).forEach((id) => {
        if (!selectedThemeId || id === selectedThemeId) cy.getElementById(`link:${project.id}:${id}`).removeClass("dimmed").addClass("highlighted");
      });
    });
  }, [needle, selectedThemeId, groups, unmatched, projects, matchingProjects, matchingProjectIds, matchingThemeIds, themeById]);

  function zoom(factor: number) {
    const cy = graph.current;
    if (cy) cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }

  return (
    <section aria-label="Harta comunității" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Harta comunității</h2>
          <p className="text-sm text-secondary">Apasa pe o tema pentru a evidentia proiectele asociate</p>
        </div>
        <label className="block text-sm font-medium text-foreground">
          Caută în hartă
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Temă, proiect sau membru" className="mt-1 block w-full min-w-60 rounded-lg border border-control bg-surface px-3 py-2 text-foreground" />
        </label>
      </div>
      {projects.length === 0 ? <p className="rounded-xl border border-subtle bg-surface p-6 text-secondary">Încă nu există Proiecte de Suflet publicate.</p> : null}
      {projects.length === 0 && themes.length === 0 ? null : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-3">
            <div className="relative overflow-hidden rounded-xl border border-subtle bg-surface-raised">
              <div ref={graphContainer} role="img" aria-label="Diagramă interactivă cu CoNectar, teme și proiecte; lista de sub hartă oferă aceleași relații" className="h-[24rem] w-full touch-none sm:h-[34rem]" />
              <div className="absolute bottom-3 right-3 flex gap-1 rounded-lg border border-subtle bg-surface p-1 shadow-sm">
                <button type="button" aria-label="Mărește harta" onClick={() => zoom(1.25)} className="min-h-10 min-w-10 rounded px-2 text-lg hover:bg-surface-raised">+</button>
                <button type="button" aria-label="Micșorează harta" onClick={() => zoom(0.8)} className="min-h-10 min-w-10 rounded px-2 text-lg hover:bg-surface-raised">−</button>
                <button type="button" aria-label="Arată toată harta" onClick={() => graph.current?.fit(undefined, 60)} className="min-h-10 rounded px-2 text-sm hover:bg-surface-raised">Tot</button>
              </div>
            </div>
            <p className="text-sm text-secondary">Trage harta pentru deplasare. Folosește rotița sau butoanele pentru zoom. Lista de mai jos poate fi folosită și cu tastatura.</p>
            <div className="space-y-3" aria-label="Teme și proiecte">
              {groups.map((group) => {
                const inGroup = projects.filter((project) => (group.id === OTHER_ID ? unmatched.includes(project) : project.themeIds.includes(group.id)) && matchingProjectIds.has(project.id));
                if (needle && !inGroup.length && !matchingThemeIds.has(group.id)) return null;
                return <div key={group.id} role="group" aria-label={group.name} className="rounded-xl border border-subtle bg-surface p-3">
                  <button type="button" aria-pressed={selectedThemeId === group.id} onClick={() => setSelectedThemeId((current) => current === group.id ? null : group.id)} className="min-h-10 rounded-md px-2 text-left font-semibold text-accent-text hover:bg-surface-raised">{group.name} <span className="text-sm font-normal text-secondary">({inGroup.length})</span></button>
                  <p className="px-2 text-sm text-secondary">{group.description}</p>
                  <ul className="mt-2 flex flex-wrap gap-2 px-2">
                    {inGroup.map((project) => <li key={project.id}><button type="button" onClick={() => setSelectedProjectId(project.id)} className="min-h-10 rounded-lg border border-control bg-surface-raised px-3 py-2 text-left text-sm hover:border-accent-text">{project.title} <span className="text-secondary">· {project.memberName}</span></button></li>)}
                  </ul>
                </div>;
              })}
              {needle && matchingProjects.length === 0 && matchingThemeIds.size === 0 ? <p role="status" className="text-sm text-secondary">Niciun rezultat pentru „{query}”.</p> : null}
            </div>
          </div>
          {selectedProject ? <aside role="region" aria-label="Detalii proiect" className="h-fit rounded-xl border border-subtle bg-surface p-5 lg:sticky lg:top-4">
            <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-semibold">{selectedProject.title}</h3><button type="button" aria-label="Închide detaliile" onClick={() => setSelectedProjectId(null)} className="min-h-10 min-w-10 rounded text-xl hover:bg-surface-raised">×</button></div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{selectedProject.description}</p>
            <p className="mt-4 text-sm text-secondary">Membru: {selectedProject.memberName}</p>
            <Link href={`/profile/${selectedProject.memberId}`} className="mt-3 inline-block rounded-md bg-action px-4 py-2 font-semibold text-action-foreground hover:bg-action-hover">Vezi profilul lui {selectedProject.memberName}</Link>
          </aside> : <div className="hidden rounded-xl border border-dashed border-subtle p-5 text-sm text-secondary lg:block">Alege un proiect pentru a vedea detaliile.</div>}
        </div>
      )}
    </section>
  );
}
