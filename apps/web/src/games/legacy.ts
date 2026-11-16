/**
 * The 16 arcade games brought over from the old site (EE Hub).
 *
 * They are plain browser scripts, served as they are from
 * apps/web/public/play/_shared/ (copied from legacy/eehub-django/static/).
 * The play page (/play/<slug>) loads, in order:
 *
 *   1. the shared runtime (arcade.js and its helpers),
 *   2. the game's dependencies (the `dependencies` list in the game's
 *      database row, `meta.dependencies`),
 *   3. its level packs (Circuit Forge and Logic Labyrinth only),
 *   4. the game's own script (the `entry` column).
 *
 * public/play/_shared/mib/mib-play.js (the "bridge") does the loading, and
 * replaces the old Django endpoints with MIB-Hub's: see
 * src/pages/api/games/.
 *
 * This file is pure data and functions, so it is safe to import anywhere,
 * including tests.
 */

/** Where the copied game files are served from. */
export const LEGACY_BASE = "/play/_shared/";

/** The shared runtime every legacy game needs, in load order. */
export const LEGACY_RUNTIME = ["arcade", "arcade-settings", "arcade-audio", "arcade-sounds", "arcade-offline"] as const;

export interface LegacyGameInfo {
  /** Level packs loaded after the dependencies (all open: MIB-Hub has no academic levels). */
  packs?: string[];
  /** The game draws in 3D and needs three.js (Freshers School Life). */
  three?: boolean;
  /**
   * The game's own saved data in the browser: localStorage keys
   * "ee-arcade-<prefix>..." The bridge copies these to the player's cloud save.
   */
  savePrefixes: string[];
  /** Highest stage number a result may report (old progress.py MAX_STAGE). */
  maxStage: number;
}

export const LEGACY_GAMES: Record<string, LegacyGameInfo> = {
  "momentum-cup": { savePrefixes: ["kick-", "cup-"], maxStage: 6 },
  "impulse-arena": { savePrefixes: ["clash-"], maxStage: 100 },
  "volt-city": { savePrefixes: ["volt"], maxStage: 12 },
  "kinetic-kingdom": { savePrefixes: ["kk"], maxStage: 41 },
  wavefront: { savePrefixes: ["wavefront"], maxStage: 12 },
  "samaru-days": { three: true, savePrefixes: ["fslg-", "samaru-"], maxStage: 120 },
  motorworks: { savePrefixes: ["motorworks"], maxStage: 30 },
  "storm-map": { savePrefixes: ["stormmap"], maxStage: 26 },
  "induction-dash": { savePrefixes: ["dash"], maxStage: 30 },
  "logic-labyrinth": { packs: ["logic-300", "logic-400"], savePrefixes: ["logic"], maxStage: 40 },
  "signal-surfer": { savePrefixes: ["surfer"], maxStage: 26 },
  "circuit-forge": {
    packs: ["circuit-200", "circuit-300", "circuit-400", "circuit-500"],
    savePrefixes: ["forge"],
    maxStage: 51,
  },
  "light-bender": { savePrefixes: ["bender"], maxStage: 45 },
  "maglev-rescue": { savePrefixes: ["maglev"], maxStage: 26 },
  "algorithm-garage": { savePrefixes: ["garage"], maxStage: 26 },
  "drive-room": { savePrefixes: ["driveroom"], maxStage: 26 },
};

export function isLegacyGame(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(LEGACY_GAMES, slug);
}

/** A script name from the catalogue to its URL ("js/matlab/mlab" keeps its folder). */
export function scriptUrl(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9_./-]/g, "").replace(/\.\.+/g, ".");
  return clean.includes("/") ? `${LEGACY_BASE}${clean}.js` : `${LEGACY_BASE}js/games/${clean}.js`;
}

/** Every script the play page loads for a legacy game, in order. */
export function legacyScripts(slug: string, entry: string, dependencies: unknown): string[] {
  const info = LEGACY_GAMES[slug];
  if (!info || !entry) return [];
  const deps = Array.isArray(dependencies) ? dependencies.filter((d): d is string => typeof d === "string") : [];
  const names = [...LEGACY_RUNTIME, ...deps, ...(info.packs ?? []), entry];
  return [...new Set(names)].map(scriptUrl);
}

/** The localStorage keys (with the "ee-arcade-" prefix) that belong to a game's save. */
export function saveKeyPrefixes(slug: string): string[] {
  const info = LEGACY_GAMES[slug];
  if (!info) return [];
  return [...info.savePrefixes.map((p) => `ee-arcade-${p}`), `ee-arcade-set-${slug}`];
}

/** True when `key` is part of `slug`'s save (and not a probe or temporary key). */
export function isSaveKey(slug: string, key: string): boolean {
  if (key.length > 120 || key.endsWith("-probe")) return false;
  return saveKeyPrefixes(slug).some((p) => key.startsWith(p));
}
