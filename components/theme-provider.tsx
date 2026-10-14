"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { Toaster } from "sonner";

type Theme = "system" | "light" | "dark";
type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const storageKey = "conectar-theme";
const changeEvent = "conectar-theme-change";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme;
}

function getTheme(): Theme {
  const stored = window.localStorage.getItem(storageKey);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changeEvent, listener);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(subscribe, getTheme, () => "system");

  function setTheme(value: Theme) {
    applyTheme(value);
    if (value === "system") window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, value);
    window.dispatchEvent(new Event(changeEvent));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
      <Toaster theme={theme} richColors position="top-center" duration={5000} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
