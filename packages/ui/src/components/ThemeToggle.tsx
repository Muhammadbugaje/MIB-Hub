/**
 * ThemeToggle: a React island that flips between light and dark.
 *
 * Use it in an .astro file like this:
 *   import ThemeToggle from "@mib/ui/components/ThemeToggle.tsx";
 *   <ThemeToggle client:load />
 *
 * The page already has the right theme before React loads (the inline
 * THEME_INIT_SCRIPT set html[data-theme]). This component only reads that
 * attribute, and on click switches it and saves the choice.
 */
import { useEffect, useState } from "react";
import { nextTheme, saveTheme, isTheme, type Theme } from "../theme.ts";

function osTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function ThemeToggle() {
  // Before hydration we do not know the theme; render the "light" icon.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(isTheme(current) ? current : osTheme());
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = nextTheme(theme);
    // Switch every colour in the same frame (see .no-transition in tokens.css).
    root.classList.add("no-transition");
    root.setAttribute("data-theme", next);
    void root.offsetWidth; // force a style flush before re-enabling transitions
    requestAnimationFrame(() => root.classList.remove("no-transition"));
    saveTheme(safeStorage(), next, osTheme());
    setTheme(next);
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? (
        // Sun icon (shown in dark mode: "go light")
        <svg key="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Moon icon (shown in light mode: "go dark")
        <svg key="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
