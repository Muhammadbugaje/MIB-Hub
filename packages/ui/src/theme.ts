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
 * The script that runs in <head> before the page paints. It must be tiny and
 * self-contained (no imports), so it is written as a string. It follows the
 * exact same rule as resolveTheme() above; the unit test checks they agree.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var os=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var t=localStorage.getItem("${THEME_KEY}");if((t!=="light"&&t!=="dark")||localStorage.getItem("${THEME_OS_KEY}")!==os)t=os;d.setAttribute("data-theme",t);if(localStorage.getItem("${MOTION_KEY}")==="reduce")d.setAttribute("data-motion","reduce");}catch(e){}d.classList.add("js");})();`;
