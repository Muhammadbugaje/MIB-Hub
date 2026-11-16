/**
 * Override resolution: from the database rows (game_sound = the file players
 * hear now, game_sound_setting = per-sound volume) to what the game page needs
 * (sound id -> file URL + volume) and what the admin list shows (original or
 * custom, which version, volume).
 *
 * Pure functions: the routes pass the rows in. Used by
 *   - the arcade API's sounds/<slug>/ list (arcade-sounds.js loads it in every game),
 *   - GET /api/games/<slug>/sounds (the offline worker precaches `files`),
 *   - /admin/games/<slug>/sounds.
 */
import type { SoundEntry } from "./extract.ts";

export interface OverrideRow {
  name: string;
  version: number;
  contentType: string;
  size: number;
  duration: number;
  updatedAt: Date;
}
export interface SettingRow {
  name: string;
  volume: number;
}

export interface ResolvedOverride {
  name: string;
  /** Version number: changes whenever the file changes (also the cache key). */
  v: number;
  type: string;
  size: number;
  duration: number;
  at: Date;
  url: string;
  /** Volume every player hears (1 = as made). */
  vol: number;
}

export interface OverrideMap {
  slug: string;
  /** Sounds with a replacement file. */
  sounds: ResolvedOverride[];
  /** Volume for every sound with a setting (with or without a replacement file). */
  vols: Record<string, number>;
  /** Every file URL the game may fetch: precache these for offline play. */
  files: string[];
}

/** The public URL of a sound's replacement file (served by /api/games/arcade/[...path].ts). */
export function soundFileUrl(slug: string, name: string, version: number): string {
  return `/api/games/arcade/sounds/${encodeURIComponent(slug)}/file/${encodeURIComponent(name)}?v=${version}`;
}

function clampVol(v: number): number {
  return Number.isFinite(v) ? Math.min(2, Math.max(0, v)) : 1;
}

export function resolveOverrides(slug: string, rows: OverrideRow[], settings: SettingRow[] = []): OverrideMap {
  const vols: Record<string, number> = {};
  for (const s of settings) if (s.volume !== 1) vols[s.name] = clampVol(s.volume);
  const sounds = rows.map((r) => ({
    name: r.name,
    v: r.version,
    type: r.contentType,
    size: r.size,
    duration: r.duration,
    at: r.updatedAt,
    url: soundFileUrl(slug, r.name, r.version),
    vol: vols[r.name] ?? 1,
  }));
  return { slug, sounds, vols, files: sounds.map((s) => s.url) };
}

export type SoundStatus = "original" | "custom";

export interface SoundRowView extends SoundEntry {
  status: SoundStatus;
  override: ResolvedOverride | null;
  volume: number;
  /** How many saved versions it has (custom files, current and old). */
  versions: number;
}

/**
 * The admin list: every sound in the inventory with its status. Overrides for
 * ids that are not in the inventory (uploaded under another name earlier, or a
 * sound the game registers at run time) are listed too, so nothing is hidden.
 */
export function soundRows(inventory: SoundEntry[], map: OverrideMap, versionCounts: Record<string, number> = {}): SoundRowView[] {
  const byName = new Map(map.sounds.map((s) => [s.name, s]));
  const seen = new Set<string>();
  const rows: SoundRowView[] = inventory.map((e) => {
    seen.add(e.id);
    const o = byName.get(e.id) ?? null;
    return { ...e, status: o ? "custom" : "original", override: o, volume: map.vols[e.id] ?? 1, versions: versionCounts[e.id] ?? 0 };
  });
  const extra = new Set([...map.sounds.map((s) => s.name), ...Object.keys(map.vols), ...Object.keys(versionCounts)]);
  for (const name of extra) {
    if (seen.has(name)) continue;
    const o = byName.get(name) ?? null;
    rows.push({
      id: name,
      name,
      group: "gameplay",
      usage: ["Not found in the game's code: the game may name it at run time, or it is left over from an older upload"],
      source: "file",
      files: [],
      calls: [],
      preview: "none",
      status: o ? "custom" : "original",
      override: o,
      volume: map.vols[name] ?? 1,
      versions: versionCounts[name] ?? 0,
    });
  }
  return rows;
}
