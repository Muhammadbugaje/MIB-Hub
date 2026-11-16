/**
 * Arcade progression rules (ported from the old site's games/progress.py).
 *
 * The browser reports what happened in a match ("I won stage 3 with 420
 * points"); these rules decide the coins, XP, badges and whether the score
 * goes on the leaderboard, with caps and a 15-second cooldown per game.
 * Casual, not cheat-proof: rewards are small and only cosmetic.
 *
 * Pure functions only (no database), so they are easy to test. The API route
 * (src/games/arcade-api.ts) loads the player's state, calls these, and saves.
 *
 * Where the state lives: coins and XP in the profile's own columns; the rest
 * (per-game stats, badges, shop items) in `player_profile.stats.arcade`.
 */
import { LEGACY_GAMES } from "./legacy.ts";

export const COOLDOWN_S = 15;
export const MAX_SCORE = 5000;
export const REWARD = { win: 30, draw: 15, lose: 8 } as const;
export type Result = keyof typeof REWARD;
export const RANKS = ["Apprentice", "Technician", "Engineer", "Senior engineer", "Chief engineer", "Fellow"];

/** The last stage of each game, and the badge for clearing it. */
const FINAL: Record<string, [badge: string, stage: number]> = {
  "induction-dash": ["dash-champion", 30],
  "light-bender": ["optics-ace", 45],
  "circuit-forge": ["master-electrician", 51],
  "volt-city": ["ring-restored", 12],
  "logic-labyrinth": ["logic-master", 40],
  "kinetic-kingdom": ["kingdom-restored", 16],
  wavefront: ["wavefront-hero", 12],
  "samaru-days": ["light-of-samaru", 17],
  "signal-surfer": ["signal-master", 26],
  "maglev-rescue": ["line-restored", 26],
  "drive-room": ["chief-engineer", 26],
  motorworks: ["workshop-master", 30],
  "storm-map": ["gridkeeper", 26],
  "algorithm-garage": ["robot-whisperer", 26],
};

export interface ShopItem {
  label: string;
  price: number;
  kind: "kit" | "trail" | "arena" | "weapon" | "char";
  value: string;
}

export const SHOP: Record<string, ShopItem> = {
  "kit-volt": { label: "Volt yellow kit", price: 120, kind: "kit", value: "#c9a227" },
  "kit-ocean": { label: "Ocean blue kit", price: 120, kind: "kit", value: "#1f6fb2" },
  "kit-crimson": { label: "Crimson kit", price: 150, kind: "kit", value: "#a4161a" },
  "kit-emerald": { label: "Emerald kit", price: 150, kind: "kit", value: "#1b7a4b" },
  "kit-gold": { label: "Gold champion kit", price: 400, kind: "kit", value: "#d4a017" },
  "trail-plasma": { label: "Plasma ball trail", price: 200, kind: "trail", value: "#c084fc" },
  "trail-solar": { label: "Solar ball trail", price: 200, kind: "trail", value: "#ffb703" },
  "arena-sunset": { label: "Momentum Cup arena: Sunset Bowl", price: 150, kind: "arena", value: "sunset" },
  "arena-rain": { label: "Momentum Cup arena: Rainy Derby", price: 200, kind: "arena", value: "rain" },
  "arena-snow": { label: "Momentum Cup arena: Snow Classic", price: 250, kind: "arena", value: "snow" },
  "arena-grand": { label: "Momentum Cup arena: Grand Volt Arena", price: 400, kind: "arena", value: "grand" },
  "wpn-rule": { label: "Impulse Arena weapon: metre rule", price: 150, kind: "weapon", value: "rule" },
  "wpn-fork": { label: "Impulse Arena weapon: tuning fork", price: 160, kind: "weapon", value: "fork" },
  "wpn-wrench": { label: "Impulse Arena weapon: big wrench", price: 180, kind: "weapon", value: "wrench" },
  "wpn-staff": { label: "Impulse Arena weapon: coil staff", price: 220, kind: "weapon", value: "staff" },
  "char-groove": { label: "DJ Groove (guest fighter)", price: 300, kind: "char", value: "groove" },
  "char-kai": { label: "Master Kai (guest fighter)", price: 300, kind: "char", value: "kai" },
};

export const BADGES: Record<string, [name: string, text: string]> = {
  "first-win": ["First win", "Won your first match or puzzle."],
  "cup-champion": ["Cup champion", "Won the Momentum Cup final against Count Entropy."],
  "arena-champion": ["Arena champion", "Cleared the first chapter of the Impulse Arena Circuit."],
  "arena-legend": ["Circuit legend", "Cleared all ten chapters of the Impulse Arena Circuit."],
  "city-restored": ["City restored", "Brought all six inner Volt City districts back online."],
  "ring-restored": ["The Ring is lit", "Restored all twelve Volt City districts, Outer Ring included."],
  "all-rounder": ["All-rounder", "Won in Momentum Cup, Impulse Arena and Volt City."],
  "dash-champion": ["Storm rider", "Lit the final beacon on Entropy's Rail in Induction Dash."],
  "optics-ace": ["Optics ace", "Lit the receiver in Count Entropy's hall of mirrors."],
  "master-electrician": ["Master electrician", "Fixed the final 500-level Circuit Forge circuit."],
  "level-10": ["Level 10", "Reached player level 10."],
  "kingdom-restored": ["Kingdom restored", "Beat Count Entropy in Entropy's Engine (Kinetic Kingdom 4-4)."],
  "wavefront-hero": ["Wavefront hero", "Silenced Entropy's Echo, the last stage of Wavefront."],
  "logic-master": ["Logic master", "Beat Count Entropy's clock tower in Logic Labyrinth."],
  "light-of-samaru": ["Light of Kanti", "Beat Count Entropy at the Senate Building in Freshers School Life."],
  "signal-master": ["Signal master", "Carried the final relay through the worst channel in Signal Surfer."],
  "line-restored": ["Line restored", "Brought the last pod home on the Golden line in Maglev Rescue."],
  "chief-engineer": ["Chief engineer", "Ran the station's biggest drive through the Grand finale in Drive Room."],
  "workshop-master": ["Workshop master", "Got the last machine in Motorworks Trails doing its job."],
  gridkeeper: ["Gridkeeper", "Brought every customer back after the final storm in Storm Map."],
  "robot-whisperer": ["Robot whisperer", "Beat Count Entropy's scrambler in Algorithm Garage."],
  "level-5": ["Level 5", "Reached player level 5."],
  collector: ["Collector", "Bought three items in the arcade shop."],
};

/** Thrown for a request the rules refuse; the message is shown to the player. */
export class Rejected extends Error {}

export function levelFor(xp: number): number {
  return Math.floor((Math.sqrt(1 + (8 * xp) / 100) - 1) / 2) + 1;
}

export function xpForLevel(n: number): number {
  return Math.floor((100 * (n - 1) * n) / 2);
}

export function rankFor(level: number): string {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))]!;
}

export interface GameStat {
  plays: number;
  wins: number;
  best: number;
  stages: number[];
  /** Seconds since 1970 of the last counted result (for the cooldown). */
  last: number | null;
}

export interface ArcadeState {
  games: Record<string, GameStat>;
  badges: string[];
  owned: string[];
  equipped: Record<string, string>;
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Read the arcade state out of `player_profile.stats` (tolerates anything). */
export function readState(stats: Record<string, unknown> | null | undefined): ArcadeState {
  const raw = (stats?.arcade ?? {}) as Record<string, unknown>;
  const games: Record<string, GameStat> = {};
  const g = raw.games && typeof raw.games === "object" ? (raw.games as Record<string, Partial<GameStat>>) : {};
  for (const [slug, s] of Object.entries(g)) {
    games[slug] = {
      plays: Number(s?.plays) || 0,
      wins: Number(s?.wins) || 0,
      best: Number(s?.best) || 0,
      stages: Array.isArray(s?.stages) ? s.stages.filter((n) => Number.isInteger(n)) : [],
      last: typeof s?.last === "number" ? s.last : null,
    };
  }
  const equipped: Record<string, string> = {};
  if (raw.equipped && typeof raw.equipped === "object") {
    for (const [k, v] of Object.entries(raw.equipped as Record<string, unknown>)) if (typeof v === "string") equipped[k] = v;
  }
  return { games, badges: arr(raw.badges), owned: arr(raw.owned), equipped };
}

/** Put the state back into a stats object (other keys are kept). */
export function writeState(stats: Record<string, unknown> | null | undefined, state: ArcadeState): Record<string, unknown> {
  return { ...(stats ?? {}), arcade: state };
}

export interface CleanResult {
  game: string;
  result: Result;
  stage: number;
  score: number;
  mode: "solo" | "duo";
  cheated: boolean;
}

/** Check a result report from the browser. */
export function cleanResult(data: Record<string, unknown>): CleanResult {
  const game = String(data.game ?? "");
  const info = LEGACY_GAMES[game];
  if (!info) throw new Rejected("Unknown game.");
  const result = data.result;
  if (result !== "win" && result !== "draw" && result !== "lose") throw new Rejected("Result must be win, draw or lose.");
  const stage = Number(data.stage ?? 1);
  const score = Number(data.score ?? 0);
  if (!Number.isFinite(stage) || !Number.isFinite(score)) throw new Rejected("Stage and score must be numbers.");
  const st = Math.trunc(stage);
  if (st < 1 || st > info.maxStage) throw new Rejected("Stage out of range.");
  const mode = data.mode ?? "solo";
  if (mode !== "solo" && mode !== "duo") throw new Rejected("Unknown mode.");
  return {
    game,
    result,
    stage: st,
    score: Math.max(0, Math.min(MAX_SCORE, Math.trunc(score))),
    mode,
    cheated: Boolean(data.cheated || data.hero),
  };
}

export interface RecordOutcome {
  state: ArcadeState;
  earnedCoins: number;
  earnedXp: number;
  newBadges: string[];
  /** The score to save (solo runs with points only), or null. */
  score: number | null;
  /** False when a cheated run is kept off the boards and earns nothing. */
  counted: boolean;
}

/**
 * Apply one result. `xp` is the player's XP before; `cheatsOnBoards` is the
 * site's "cheated runs count" switch; `now` is seconds since 1970.
 */
export function applyResult(
  before: ArcadeState,
  xp: number,
  r: CleanResult,
  opts: { now: number; cheatsOnBoards: boolean },
): RecordOutcome {
  const state: ArcadeState = structuredClone(before);
  const barred = r.cheated && !opts.cheatsOnBoards;
  const g = (state.games[r.game] ??= { plays: 0, wins: 0, best: 0, stages: [], last: null });
  if (g.last !== null && opts.now - g.last >= 0 && opts.now - g.last < COOLDOWN_S) {
    throw new Rejected("Results are counted at most once every 15 seconds per game.");
  }
  g.last = opts.now;
  g.plays += 1;
  let coins = REWARD[r.result] + (r.result === "win" ? 5 * r.stage : 0);
  if (r.mode === "duo") coins = Math.floor(coins / 2); // same-device friendly: half rewards
  if (barred) coins = 0;
  const earnedXp = coins * 2;
  const newBadges: string[] = [];
  const award = (b: string) => {
    if (!state.badges.includes(b)) {
      state.badges.push(b);
      newBadges.push(b);
    }
  };
  if (r.result === "win" && !barred) {
    g.wins += 1;
    if (!g.stages.includes(r.stage)) g.stages.push(r.stage);
    award("first-win");
    if (r.game === "momentum-cup" && r.stage === 6 && r.mode === "solo") award("cup-champion");
    if (r.game === "impulse-arena" && r.stage >= 10 && r.mode === "solo") award("arena-champion");
    if (r.game === "impulse-arena" && r.stage === 100 && r.mode === "solo") award("arena-legend");
    if (r.game === "volt-city" && [1, 2, 3, 4, 5, 6].every((s) => g.stages.includes(s))) award("city-restored");
    if (["momentum-cup", "impulse-arena", "volt-city"].every((k) => (state.games[k]?.wins ?? 0) > 0)) award("all-rounder");
    const fin = FINAL[r.game];
    if (fin && r.stage === fin[1]) award(fin[0]);
  }
  const lv = levelFor(xp + earnedXp);
  if (lv >= 5) award("level-5");
  if (lv >= 10) award("level-10");
  let score: number | null = null;
  if (r.mode === "solo" && r.score > 0) {
    if (!barred) g.best = Math.max(g.best, r.score);
    score = r.score;
  }
  return { state, earnedCoins: coins, earnedXp, newBadges, score, counted: !barred };
}

/** Buy a shop item. Returns the new state and the price to take off. */
export function buyItem(before: ArcadeState, coins: number, item: string): { state: ArcadeState; price: number } {
  const it = SHOP[item];
  if (!it) throw new Rejected("No such item.");
  if (before.owned.includes(item)) throw new Rejected("You already own this.");
  if (coins < it.price) throw new Rejected(`You need ${it.price - coins} more coins.`);
  const state: ArcadeState = structuredClone(before);
  state.owned.push(item);
  if (state.owned.filter((i) => i in SHOP).length >= 3 && !state.badges.includes("collector")) state.badges.push("collector");
  return { state, price: it.price };
}

/** Wear a bought kit or trail ("none-kit" takes it off). */
export function equipItem(before: ArcadeState, item: string): ArcadeState {
  const state: ArcadeState = structuredClone(before);
  if (item.startsWith("none-")) {
    delete state.equipped[item.slice(5)];
    return state;
  }
  const it = SHOP[item];
  if (!it || !state.owned.includes(item)) throw new Rejected("Buy this item first.");
  if (it.kind === "char" || it.kind === "arena" || it.kind === "weapon") throw new Rejected("This item is unlocked, not worn.");
  state.equipped[it.kind] = item;
  return state;
}

/** The player as the old games expect it (GET me/ and every result reply). */
export function asDict(state: ArcadeState, p: { coins: number; xp: number; onLeaderboard: boolean }) {
  const level = levelFor(p.xp);
  return {
    xp: p.xp,
    coins: p.coins,
    level,
    rank: rankFor(level),
    next_xp: xpForLevel(level + 1),
    this_xp: xpForLevel(level),
    owned: state.owned,
    equipped: state.equipped,
    badges: state.badges.filter((b) => b in BADGES).map((b) => badgeInfo(b)),
    on_leaderboard: p.onLeaderboard,
    shop: Object.entries(SHOP).map(([id, s]) => ({ id, label: s.label, price: s.price, kind: s.kind, value: s.value })),
  };
}

export function badgeInfo(id: string) {
  const b = BADGES[id];
  return { id, name: b?.[0] ?? id, text: b?.[1] ?? "" };
}
