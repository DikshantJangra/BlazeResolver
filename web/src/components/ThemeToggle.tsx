"use client";

import React, { useSyncExternalStore } from "react";
import { FaMoon, FaSun } from "react-icons/fa6";
import { applyTheme, THEME_KEY, type Theme } from "./theme";

const saved = (): Theme | null => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
};

/** The theme lives on <html data-theme>; every toggle on the page reads it from there, so they never disagree. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // Follow the OS until the visitor picks a theme themselves.
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onMedia = (e: MediaQueryListEvent) => {
    if (!saved()) applyTheme(e.matches ? "light" : "dark");
  };
  media.addEventListener("change", onMedia);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onMedia);
  };
}

const current = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
// The server can't know the visitor's theme (the head script picks it), so the icon appears once mounted.
const unknown = (): Theme | null => null;

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, current, unknown);
  const next: Theme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          // private mode: the choice lasts for this page only
        }
      }}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-fg/15 bg-fg/[0.04] text-fg/75 hover:text-fg hover:bg-fg/10 hover:border-fg/25 transition-colors cursor-pointer ${className}`}
    >
      {theme === "light" ? <FaMoon className="w-3.5 h-3.5" /> : theme === "dark" ? <FaSun className="w-3.5 h-3.5" /> : null}
    </button>
  );
}
