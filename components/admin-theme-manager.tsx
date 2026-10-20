"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveThemeAction, saveThemeAction } from "@/app/admin/dashboard/actions";

export type ThemeSummary = { id: string; name: string; description: string; archived_at: string | null };

export function AdminThemeManager({ themes }: { themes: ThemeSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setEditingId(null);
    setName("");
    setDescription("");
  }

  function edit(theme: ThemeSummary) {
    setEditingId(theme.id);
    setName(theme.name);
    setDescription(theme.description);
    document.getElementById("theme-name")?.focus();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = await saveThemeAction({ id: editingId ?? undefined, name, description });
      if (result.kind === "unauthorized") {
        router.push("/");
      } else if (result.kind === "invalid") {
        toast.error("Completează numele și descrierea temei.");
      } else if (result.kind === "missing") {
        toast.error("Tema nu mai există. Reîncarcă pagina.");
      } else if (result.kind === "failed") {
        toast.error("Tema nu a putut fi salvată. Încearcă din nou.");
      } else {
        toast.success(editingId ? "Tema a fost actualizată." : "Tema a fost creată.");
        reset();
        router.refresh();
      }
    });
  }

  function archive(theme: ThemeSummary) {
    if (pending) return;
    startTransition(async () => {
      const result = await archiveThemeAction(theme.id);
      if (result.kind === "unauthorized") router.push("/");
      else if (result.kind !== "ok") toast.error("Tema nu a putut fi arhivată.");
      else {
        toast.success("Tema a fost arhivată, iar proiectele au fost regrupate.");
        if (editingId === theme.id) reset();
        router.refresh();
      }
    });
  }

  const active = themes.filter((theme) => !theme.archived_at);
  const archived = themes.filter((theme) => theme.archived_at);

  return (
    <section aria-labelledby="themes-heading" className="mt-10 border-t border-zinc-700 pt-8">
      <h2 id="themes-heading" className="text-xl font-semibold">Temele comunității</h2>
      <p className="mt-2 text-sm text-zinc-300">Creează teme largi. Modificările refac potrivirile Proiectelor de Suflet.</p>

      <form onSubmit={submit} className="mt-6 grid gap-4 rounded-xl border border-zinc-700 p-4">
        <h3 className="font-medium">{editingId ? "Editează tema" : "Temă nouă"}</h3>
        <label htmlFor="theme-name" className="grid gap-1 text-sm">Nume
          <input id="theme-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} disabled={pending}
            className="min-h-11 rounded-lg border border-zinc-600 bg-zinc-900 px-3 text-white" />
        </label>
        <label htmlFor="theme-description" className="grid gap-1 text-sm">Descriere într-o propoziție
          <textarea id="theme-description" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={500} rows={3} disabled={pending}
            className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-white" />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-action px-5 font-semibold text-action-foreground disabled:opacity-50">
            {pending ? "Se actualizează harta…" : editingId ? "Salvează tema" : "Adaugă tema"}
          </button>
          {editingId && <button type="button" onClick={reset} disabled={pending} className="min-h-11 rounded-lg border border-zinc-600 px-5 disabled:opacity-50">Renunță</button>}
        </div>
      </form>

      {active.length === 0 ? <p className="mt-6 text-sm text-zinc-300">Nu există încă teme active.</p> : (
        <ul className="mt-6 space-y-3">
          {active.map((theme) => <li key={theme.id} className="rounded-xl border border-zinc-700 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-semibold">{theme.name}</h3><p className="mt-1 text-sm text-zinc-300">{theme.description}</p></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => edit(theme)} disabled={pending} className="min-h-11 rounded-lg border border-zinc-600 px-3 text-sm disabled:opacity-50">Editează</button>
                <button type="button" onClick={() => archive(theme)} disabled={pending} className="min-h-11 rounded-lg border border-zinc-600 px-3 text-sm disabled:opacity-50">Arhivează</button>
              </div>
            </div>
          </li>)}
        </ul>
      )}
      {archived.length > 0 && <div className="mt-6 text-sm text-zinc-400"><h3 className="font-medium">Teme arhivate</h3><ul className="mt-2 space-y-1">{archived.map((theme) => <li key={theme.id}>{theme.name}</li>)}</ul></div>}

      {pending && <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
        <div className="rounded-xl bg-zinc-900 p-6 text-center text-white shadow-xl"><span aria-hidden="true" className="mx-auto mb-3 block size-7 animate-spin rounded-full border-2 border-white border-t-transparent" />Salvăm tema și actualizăm harta…</div>
      </div>}
    </section>
  );
}
