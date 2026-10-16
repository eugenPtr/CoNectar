"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/theme-provider";

const darkModeQuery = "(prefers-color-scheme: dark)";

function subscribeToDeviceTheme(listener: () => void) {
  const media = window.matchMedia(darkModeQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function deviceUsesDarkTheme() {
  return window.matchMedia(darkModeQuery).matches;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const deviceIsDark = useSyncExternalStore(subscribeToDeviceTheme, deviceUsesDarkTheme, () => false);
  const isDark = theme === "dark" || (theme === "system" && deviceIsDark);

  return (
    <button
      type="button"
      aria-label={isDark ? "Activează modul luminos" : "Activează modul întunecat"}
      title={isDark ? "Mod luminos" : "Mod întunecat"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-11 items-center justify-center rounded-[10px] text-nav-foreground hover:bg-nav-hover"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>;
}

function MoonIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" /></svg>;
}
