/**
 * ThemeToggle: a React island that flips between light and dark, styled like
 * EE Hub's toggle (one button, a sun and a moon; CSS shows the right one, so
 * it is correct before React even loads).
 *
 * Use it in an .astro file like this:
 *   import ThemeToggle from "@mib/ui/components/ThemeToggle.tsx";
 *   <ThemeToggle client:load />
 *
 * Plain pages can use the same look without React: any
 * <button class="theme-toggle" data-theme-toggle> works once the page calls
 * toggleTheme() on click (see apps/web/src/components/ThemeToggle.astro).
 */
import { useEffect, useState } from "react";
import { THEME_EVENT, currentTheme, toggleTheme, watchTheme, type Theme } from "../theme.ts";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // Before hydration we do not know the theme; the icons are swapped by CSS anyway.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(currentTheme());
    watchTheme();
    const sync = (e: Event) => setTheme((e as CustomEvent<{ theme: Theme }>).detail.theme);
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={() => setTheme(toggleTheme())}
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
    >
      <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}
