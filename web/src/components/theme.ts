/** Landing accents as theme tokens: each resolves to a deeper shade in light mode (see globals.css). */
export const ACCENT = {
  brand: "var(--lp-brand)",
  brandSoft: "var(--lp-brand-soft)",
  blue: "var(--lp-blue)",
  ok: "var(--lp-ok)",
  info: "var(--lp-info)",
  fg: "var(--lp-fg)",
} as const;

/** A translucent tint of a color, for tinted backgrounds and borders in either theme. */
export const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

export type Theme = "light" | "dark";
export const THEME_KEY = "blazeresolver:theme";

/** Sets the theme on <html>: the tokens, Tailwind's `dark` class and native form controls all follow it. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/**
 * Runs in <head> before first paint, so the page never flashes the wrong theme: the visitor's saved choice,
 * else their OS preference, else dark.
 */
export const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}
if(t!=="light"&&t!=="dark")t=window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
var r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",t==="dark");r.style.colorScheme=t})()`;
