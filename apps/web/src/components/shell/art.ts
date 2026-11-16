/**
 * Game artwork lookup. Each game has a folder in public/games/<slug>/ with
 *   icon.png   (always there)
 *   cover.jpg  16:9, tile.jpg 4:5, shot-1.jpg, shot-2.jpg  (added as they are made)
 * Pages ask here which files exist, so a card can fall back to the accent
 * gradient + icon when a cover has not been made yet.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Where the public folder can be, in dev (`apps/web`, repo root) and in a build. */
const ROOTS = [
  join(process.cwd(), "public"),
  join(process.cwd(), "apps", "web", "public"),
  join(process.cwd(), "dist", "client"),
  join(process.cwd(), "apps", "web", "dist", "client"),
];

const cache = new Map<string, { at: number; found: boolean }>();
const CACHE_MS = 15_000;

/** True when /games/<slug>/<file> exists on disk. Cached for a few seconds. */
export function hasGameFile(slug: string, file: string): boolean {
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9.-]+$/.test(file)) return false;
  const key = `${slug}/${file}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) return hit.found;
  const found = ROOTS.some((root) => existsSync(join(root, "games", slug, file)));
  cache.set(key, { at: now, found });
  return found;
}

export interface GameArt {
  /** Always set: the square icon. */
  icon: string;
  /** 16:9 cover, when it exists. */
  cover: string | null;
  /** 4:5 tile, when it exists. */
  tile: string | null;
}

export function gameArt(slug: string): GameArt {
  const url = (file: string) => (hasGameFile(slug, file) ? `/games/${slug}/${file}` : null);
  return { icon: `/games/${slug}/icon.png`, cover: url("cover.jpg"), tile: url("tile.jpg") };
}

/** A line icon (Icon.astro name) that suits a game category. */
export function categoryIcon(category: string): string {
  switch (category) {
    case "versus":
      return "swords";
    case "puzzle":
      return "puzzle";
    case "open-world":
      return "compass";
    case "arcade":
      return "joystick";
    default:
      return "gamepad";
  }
}

/** "open-world" -> "Open world" */
export function categoryLabel(category: string): string {
  const text = category.replace(/-/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Momentum Cup" -> "MC"; "Jiya" -> "J" */
export function initials(name: string, max = 2): string {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .slice(0, max)
    .toUpperCase();
}

const TONES = ["green", "teal", "blue", "indigo", "purple", "orange", "pink", "gold", "volt"] as const;

/** A stable icon-tile tone for a name, so the same person always gets the same colour. */
export function toneFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return `var(--tile-${TONES[h % TONES.length]})`;
}

/**
 * Special characters and people (Jiya, Taty, Madison, Zainab) are shown only
 * while their switch is on ("switch.special.<name>" in site settings).
 * `switches` comes from specialSwitches() in lib/site.ts.
 */
export function specialAllowed(name: string, switches: Record<string, boolean>): boolean {
  const lower = name.toLowerCase();
  for (const [key, on] of Object.entries(switches)) {
    if (!on && new RegExp(`\\b${key.replace(/[^a-z0-9]/g, "")}\\b`).test(lower)) return false;
  }
  return true;
}
