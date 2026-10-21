"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { BirthDataDraft } from "@/lib/birth-data";

interface PlaceResult {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const fieldClass = "min-h-11 w-full rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-white";

export function BirthDataFields({ value, onChange, idPrefix }: {
  value: BirthDataDraft;
  onChange: (value: BirthDataDraft) => void;
  idPrefix: string;
}) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value.timezone || value.birthplace.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/birthplace-search?q=${encodeURIComponent(value.birthplace)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("place_search_failed");
        const data = await response.json() as { results: PlaceResult[] };
        setResults(data.results);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) toast.error("Căutarea localităților nu este disponibilă acum. Încearcă din nou.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [value.birthplace, value.timezone]);

  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${idPrefix}-date`} className="flex flex-col gap-1.5 text-sm font-medium">
        Data nașterii
        <input id={`${idPrefix}-date`} type="date" required value={value.birthDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => onChange({ ...value, birthDate: event.target.value })}
          className={fieldClass} />
      </label>
      <label htmlFor={`${idPrefix}-time`} className="flex flex-col gap-1.5 text-sm font-medium">
        Ora nașterii
        <input id={`${idPrefix}-time`} type="time" required step="60" value={value.birthTime}
          onChange={(event) => onChange({ ...value, birthTime: event.target.value })}
          className={fieldClass} />
      </label>
    </div>
    <div className="relative">
      <label htmlFor={`${idPrefix}-place`} className="mb-1.5 block text-sm font-medium">Localitatea nașterii</label>
      <input id={`${idPrefix}-place`} type="text" required autoComplete="off" role="combobox"
        aria-expanded={open && results.length > 0} aria-controls={`${idPrefix}-suggestions`}
        aria-autocomplete="list" value={value.birthplace}
        placeholder="Începe să scrii localitatea…"
        onChange={(event) => { onChange({ ...value, birthplace: event.target.value, latitude: null, longitude: null, timezone: "" }); setResults([]); setOpen(false); }}
        onFocus={() => { if (results.length && !value.timezone) setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        className={fieldClass} />
      {searching && <span className="mt-1 block text-xs text-zinc-400">Se caută localități…</span>}
      {value.timezone && <span className="mt-1 block text-xs text-emerald-300">Localitate selectată</span>}
      {open && results.length > 0 && <ul id={`${idPrefix}-suggestions`} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-900 p-1 shadow-xl">
        {results.map((place, index) => <li key={`${place.label}-${index}`} role="option" aria-selected={false}>
          <button type="button" className="w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-700 focus:bg-zinc-700"
            onClick={() => { onChange({ ...value, birthplace: place.label, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone }); setOpen(false); setResults([]); }}>
            {place.label}
          </button>
        </li>)}
      </ul>}
      <p className="mt-1 text-xs text-zinc-400">Alege o sugestie cu județul sau regiunea și țara. Căutarea este disponibilă în toată lumea.</p>
      <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-zinc-400 underline">Powered by Geoapify</a>
    </div>
    <label className="flex items-start gap-3 rounded-lg border border-zinc-700 p-3 text-sm">
      <input type="checkbox" checked={value.isVisible} onChange={(event) => onChange({ ...value, isVisible: event.target.checked })}
        className="mt-0.5 size-4 accent-purple-600" />
      <span>Arată data, ora și localitatea nașterii și harta natală celorlalți membri autentificați</span>
    </label>
  </div>;
}
