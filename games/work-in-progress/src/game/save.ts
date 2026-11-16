/**
 * Progress: what the player has done, saved on this device (localStorage) and,
 * when signed in on the site, to the site's save API
 * (POST /api/games/work-in-progress/save, slot "auto"). Pure data and pure
 * functions, so tests can check every rule:
 *
 *   - a save is versioned; a save from a newer game version is refused with a
 *     visible message (plan rule U4), an older one is upgraded;
 *   - checkpoints are per step: reloading resumes at the start of the step
 *     you were on, with everything you already earned (rule X8);
 *   - rewards are applied once (replaying a mission from the debug menu
 *     never pays twice).
 */

export const SAVE_VERSION = 1;
export const SAVE_KEY = "wip-save-v1";

export interface Progress {
  version: number;
  /** Player's chosen name (the story's {{PLAYER_NAME}}). */
  name: string;
  money: number;
  items: Record<string, number>;
  /** Story flags from cutscene end states (m001_done, met_aleeya...). */
  flags: Record<string, boolean | number | string>;
  /** Missions passed, in order (m001...). */
  done: string[];
  /** The mission in progress and its step (a checkpoint), or null. */
  current: { mission: string; step: number } | null;
  /** Friendship and relationship levels by cast id. */
  rel: Record<string, number>;
  /** Clue ids found (C-NOTE, MS-01...). */
  clues: string[];
  /** Journal: legends, contacts, entries. */
  journal: { legends: string[]; contacts: string[]; entries: string[] };
  stats: { smarts: number; charm: number; strength: number; stamina: number; health: number; street: number };
  /** Rewards already paid, by mission id (so replays never pay twice). */
  paid: string[];
  /** Hour of day when last saved. */
  hour: number;
  savedAt: number;
}

export function newProgress(name = "Fresher"): Progress {
  return {
    version: SAVE_VERSION, name, money: 0, items: {}, flags: {}, done: [], current: null, rel: {}, clues: [],
    journal: { legends: [], contacts: [], entries: [] },
    stats: { smarts: 0, charm: 0, strength: 0, stamina: 0, health: 0, street: 0 },
    paid: [], hour: 7.6, savedAt: 0,
  };
}

export type LoadResult = { ok: true; progress: Progress } | { ok: false; reason: "empty" | "corrupt" | "newer"; message: string };

/** Read a save string; upgrade old versions, refuse newer ones with a message. */
export function parseSave(raw: string | null | undefined): LoadResult {
  if (!raw) return { ok: false, reason: "empty", message: "" };
  let data: Partial<Progress>;
  try {
    data = JSON.parse(raw) as Partial<Progress>;
  } catch {
    return { ok: false, reason: "corrupt", message: "Your saved game could not be read, so a new one was started." };
  }
  if (typeof data !== "object" || data === null) return { ok: false, reason: "corrupt", message: "Your saved game could not be read, so a new one was started." };
  if ((data.version ?? 0) > SAVE_VERSION) return { ok: false, reason: "newer", message: "This save is from a newer version of the game. Refresh the page to update." };
  const base = newProgress(typeof data.name === "string" ? data.name : "Fresher");
  const p: Progress = {
    ...base,
    ...data,
    version: SAVE_VERSION,
    items: { ...(data.items ?? {}) },
    flags: { ...(data.flags ?? {}) },
    rel: { ...(data.rel ?? {}) },
    journal: { ...base.journal, ...(data.journal ?? {}) },
    stats: { ...base.stats, ...(data.stats ?? {}) },
    done: Array.isArray(data.done) ? data.done.filter((x) => typeof x === "string") : [],
    clues: Array.isArray(data.clues) ? data.clues : [],
    paid: Array.isArray(data.paid) ? data.paid : [],
  };
  return { ok: true, progress: p };
}

export function serialise(p: Progress, now = Date.now()): string {
  return JSON.stringify({ ...p, savedAt: now });
}

/** The next mission to play after `done` (story order), or null when all ten are passed. */
export function nextMission(done: readonly string[], order: readonly string[]): string | null {
  return order.find((m) => !done.includes(m)) ?? null;
}

export function addItem(p: Progress, id: string, n = 1): void {
  p.items[id] = Math.max(0, (p.items[id] ?? 0) + n);
  if (p.items[id] === 0) delete p.items[id];
}

/** Apply a cutscene endState's items and flags (FORMAT.md: `items: { naira: 5000 }`, `"+1000"`). */
export function applyEndState(p: Progress, end: Record<string, unknown>): void {
  const pl = (end.PLAYER ?? {}) as { items?: Record<string, number | string> };
  for (const [k, v] of Object.entries(pl.items ?? {})) {
    if (k === "naira") {
      if (typeof v === "string" && /^[+-]/.test(v)) p.money += Number(v);
      else p.money = Math.max(p.money, Number(v));
    } else addItem(p, k, typeof v === "number" ? Math.max(0, v - (p.items[k] ?? 0)) : 1);
  }
  const flags = (end.flags ?? {}) as Record<string, boolean | number | string>;
  for (const [k, v] of Object.entries(flags)) p.flags[k] = v;
}

/** Mark a mission passed and pay its reward once. */
export function passMission(p: Progress, id: string, reward: (p: Progress) => void): boolean {
  if (!p.done.includes(id)) p.done.push(id);
  p.current = null;
  if (p.paid.includes(id)) return false;
  p.paid.push(id);
  reward(p);
  return true;
}

/* ------------------------------------------------------------ storage (browser) */

export function loadLocal(): LoadResult {
  try {
    return parseSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return { ok: false, reason: "empty", message: "" };
  }
}

export function saveLocal(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, serialise(p));
  } catch {
    /* private mode: progress lasts this session */
  }
}

/** Best effort cloud save through the site (only works on the site, signed in; never blocks play). */
export async function saveCloud(p: Progress, slug = "work-in-progress"): Promise<boolean> {
  try {
    const summary = `${p.done.length}/10 missions · ₦${p.money}`;
    const r = await fetch(`/api/games/${slug}/save`, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot: "auto", data: JSON.parse(serialise(p)), saveVersion: SAVE_VERSION, summary }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Fetch the cloud save; used when it is newer than the local one. */
export async function loadCloud(slug = "work-in-progress"): Promise<Progress | null> {
  try {
    const r = await fetch(`/api/games/${slug}/save?slot=auto`, { credentials: "same-origin" });
    if (!r.ok) return null;
    const j = (await r.json()) as { save?: { data?: unknown } | null };
    if (!j.save?.data) return null;
    const res = parseSave(JSON.stringify(j.save.data));
    return res.ok ? res.progress : null;
  } catch {
    return null;
  }
}
