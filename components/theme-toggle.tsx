"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";

const choices = [
  { value: "system", label: "Dispozitiv" },
  { value: "light", label: "Luminos" },
  { value: "dark", label: "Întunecat" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Aspect: alege modul luminos sau întunecat"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-[10px] text-foreground hover:bg-surface-raised"
      >
        {theme === "dark" ? <MoonIcon /> : <SunIcon />}
      </button>
      {open && (
        <div role="menu" aria-label="Aspect" className="absolute bottom-full right-0 z-50 mb-2 w-40 rounded-xl border border-border-subtle bg-surface p-1 shadow-lg md:bottom-auto md:top-full md:mb-0 md:mt-2">
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === choice.value}
              onClick={() => { setTheme(choice.value); setOpen(false); }}
              className="flex min-h-11 w-full items-center justify-between rounded-[10px] px-3 text-left text-sm text-foreground hover:bg-surface-raised"
            >
              {choice.label}<span aria-hidden="true">{theme === choice.value ? "✓" : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SunIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>;
}

function MoonIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /></svg>;
}
