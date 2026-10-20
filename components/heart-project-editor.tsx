"use client";

import { useEffect, useState } from "react";
import type { HeartProjectInput } from "@/lib/heart-projects/save";

export function HeartProjectEditor({ projects, onChange, onPendingChange }: { projects: HeartProjectInput[]; onChange: (projects: HeartProjectInput[]) => void; onPendingChange?: (pending: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [removed, setRemoved] = useState<{ project: HeartProjectInput; index: number } | null>(null);
  const invalid = !title.trim() || !description.trim();
  useEffect(() => { onPendingChange?.(Boolean(title.trim() || description.trim() || editing !== null)); }, [title, description, editing, onPendingChange]);

  function commit() {
    if (invalid || (editing === null && projects.length >= 10)) return;
    const project = { ...(editing === null ? {} : projects[editing]), title: title.trim().replace(/\s+/g, " "), description: description.trim().replace(/\s+/g, " ") };
    onChange(editing === null ? [...projects, project] : projects.map((item, index) => index === editing ? project : item));
    setTitle(""); setDescription(""); setEditing(null); setRemoved(null);
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= projects.length) return;
    const next = [...projects];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return <div className="space-y-4">
    <p className="text-sm text-zinc-300">Poți publica până la 10 Proiecte de Suflet ({projects.length}/10).</p>
    <ol className="space-y-2">{projects.map((project, index) => <li key={project.id ?? `${project.title}-${index}`} className="rounded-lg border border-zinc-700 p-3">
      <h3 className="font-semibold">{project.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{project.description}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button type="button" aria-label={`Mută ${project.title} mai sus`} disabled={index === 0} onClick={() => move(index, -1)} className="min-h-11 rounded border px-3 disabled:opacity-40">↑</button>
        <button type="button" aria-label={`Mută ${project.title} mai jos`} disabled={index === projects.length - 1} onClick={() => move(index, 1)} className="min-h-11 rounded border px-3 disabled:opacity-40">↓</button>
        <button type="button" aria-label={`Editează ${project.title}`} onClick={() => { setEditing(index); setTitle(project.title); setDescription(project.description); }} className="min-h-11 rounded border px-3">Editează</button>
        <button type="button" aria-label={`Elimină ${project.title}`} onClick={() => { setRemoved({ project, index }); onChange(projects.filter((_, i) => i !== index)); if (editing === index) { setEditing(null); setTitle(""); setDescription(""); } }} className="min-h-11 rounded border px-3">Elimină</button>
      </div>
    </li>)}</ol>
    {removed && <button type="button" onClick={() => { onChange([...projects.slice(0, removed.index), removed.project, ...projects.slice(removed.index)]); setRemoved(null); }} className="min-h-11 rounded border px-3 text-sm">Anulează eliminarea</button>}
    <div className="space-y-3 rounded-lg border border-zinc-700 p-3">
      <h3 className="font-semibold">{editing === null ? "Adaugă Proiect de Suflet" : "Editează Proiectul de Suflet"}</h3>
      <label className="flex flex-col gap-1 text-sm">Titlu proiect<input value={title} maxLength={120} aria-invalid={Boolean(description.trim() && !title.trim())} onChange={(event) => setTitle(event.target.value)} className={`rounded border bg-zinc-950 px-3 py-2 ${description.trim() && !title.trim() ? "border-red-600" : "border-zinc-600"}`} /></label>
      <label className="flex flex-col gap-1 text-sm">Descriere proiect<textarea value={description} maxLength={2000} rows={4} aria-invalid={Boolean(title.trim() && !description.trim())} onChange={(event) => setDescription(event.target.value)} className={`rounded border bg-zinc-950 px-3 py-2 ${title.trim() && !description.trim() ? "border-red-600" : "border-zinc-600"}`} /></label>
      <div className="flex gap-2">
        <button type="button" disabled={invalid || (editing === null && projects.length >= 10)} onClick={commit} className="min-h-11 rounded bg-action px-4 text-action-foreground disabled:opacity-40">{editing === null ? "Adaugă proiect" : "Salvează proiectul"}</button>
        {editing !== null && <button type="button" onClick={() => { setEditing(null); setTitle(""); setDescription(""); }} className="min-h-11 rounded border px-3">Renunță</button>}
      </div>
    </div>
  </div>;
}
