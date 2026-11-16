/**
 * Theme logic (light / dark), shared by the inline <head> script and the
 * React ThemeToggle. Pure functions, so they are easy to unit-test.
 *
 * The rule (carried over from EE Hub's theme-init.js):
 *   Follow the device's light/dark setting, UNLESS the visitor pressed the
 *   toggle while the device was on the setting it has now.
 *
 * Why remember the device setting too? If you pick "dark" at night while
 * your phone is in light mode, and the next morning your phone is still in
 * light mode, you get dark (your choice). But if your phone has since
 * switched to dark mode by itself, we follow the phone again, so the choice
 * never "sticks" in a way that fights the device forever.
 */

export type Theme = "light" | "dark";

/** localStorage keys. Changing them resets everyone's saved choice. */
export const THEME_KEY = "mib-theme";
export const THEME_OS_KEY = "mib-theme-os";
export const MOTION_KEY = "mib-motion";

/** The minimal storage shape we need (window.localStorage fits it). */
export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Which theme to show, given what is saved and what the device prefers. */
export function resolveTheme(input: { stored: string | null; storedOs: string | null; osTheme: Theme }): Theme {
  const { stored, storedOs, osTheme } = input;
  if (isTheme(stored) && storedOs === osTheme) return stored;
  return osTheme;
}

/** The theme the toggle switches to. */
export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

/** Read the saved theme from storage. Never throws (storage can be blocked). */
export function readTheme(storage: ThemeStorage | null, osTheme: Theme): Theme {
  if (!storage) return osTheme;
  try {
    return resolveTheme({ stored: storage.getItem(THEME_KEY), storedOs: storage.getItem(THEME_OS_KEY), osTheme });
  } catch {
    return osTheme;
  }
}

/**
 * Save the visitor's choice. If they chose the same as the device, we clear
 * the saved value instead, so the site simply follows the device again.
 */
export function saveTheme(storage: ThemeStorage | null, theme: Theme, osTheme: Theme): void {
  if (!storage) return;
  try {
    if (theme === osTheme) {
      storage.removeItem(THEME_KEY);
      storage.removeItem(THEME_OS_KEY);
    } else {
      storage.setItem(THEME_KEY, theme);
      storage.setItem(THEME_OS_KEY, osTheme);
    }
  } catch {
    /* storage blocked (private mode): the choice lasts for this page only */
  }
}

/**
 * The device switched between light and dark while the page was open (or
 * between visits): forget any manual choice and follow the device again.
 * Returns the theme to show. EE Hub's rule: "the device wins when it changes".
 */
export function followDevice(storage: ThemeStorage | null, osTheme: Theme): Theme {
  if (storage) {
    try {
      storage.removeItem(THEME_KEY);
      storage.removeItem(THEME_OS_KEY);
    } catch {
      /* storage blocked */
    }
  }
  return osTheme;
}

/** Fired on window after the theme changes: `window.addEventListener(THEME_EVENT, (e) => e.detail.theme)`. */
export const THEME_EVENT = "theme:change";

/* ---------------------------------------------------------------------------
   Browser helpers (only call these in the browser, never at import time).
   Used by the React ThemeToggle and by the site's plain toggle buttons
   ([data-theme-toggle]), so every toggle on the page stays in sync.
   ------------------------------------------------------------------------- */

/** The device's current preference. */
export function deviceTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function browserStorage(): ThemeStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The theme on <html> right now. */
export function currentTheme(): Theme {
  const t = document.documentElement.getAttribute("data-theme");
  return isTheme(t) ? t : deviceTheme();
}

/**
 * Switch the page to `theme`. Every colour changes in the same frame (the
 * .no-transition class), toggles update their aria-pressed, and THEME_EVENT
 * fires. With `save`, the choice is remembered (see saveTheme).
 */
export function applyTheme(theme: Theme, opts: { save?: boolean } = {}): void {
  const root = document.documentElement;
  root.classList.add("no-transition");
  root.setAttribute("data-theme", theme);
  void root.offsetWidth; // flush styles before transitions come back
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("no-transition")));
  // Older offscreen renderers never run rAF: make sure transitions return.
  setTimeout(() => root.classList.remove("no-transition"), 120);
  if (opts.save) saveTheme(browserStorage(), theme, deviceTheme());
  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((b) => {
    b.setAttribute("aria-pressed", String(theme === "dark"));
    b.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  });
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}

/** Flip light/dark and remember the choice. Returns the new theme. */
export function toggleTheme(): Theme {
  const next = nextTheme(currentTheme());
  applyTheme(next, { save: true });
  return next;
}

let watching = false;
/**
 * Follow the device when it changes, and keep other open tabs in sync.
 * Safe to call more than once.
 */
export function watchTheme(): void {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener?.("change", () => applyTheme(followDevice(browserStorage(), deviceTheme())));
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY || e.key === THEME_OS_KEY || e.key === null) {
      applyTheme(readTheme(browserStorage(), deviceTheme()));
    }
  });
}

/**
 * The script that runs in <head> before the page paints. It must be tiny and
 * self-contained (no imports), so it is written as a string. It follows the
 * exact same rule as resolveTheme() above; the unit test checks they agree.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var os=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var t=localStorage.getItem("${THEME_KEY}");if((t!=="light"&&t!=="dark")||localStorage.getItem("${THEME_OS_KEY}")!==os)t=os;d.setAttribute("data-theme",t);if(localStorage.getItem("${MOTION_KEY}")==="reduce")d.setAttribute("data-motion","reduce");}catch(e){}d.classList.add("js");})();`;
