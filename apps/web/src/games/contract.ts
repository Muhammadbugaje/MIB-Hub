/**
 * THE GAME LOADER CONTRACT: how a game plugs into the website.
 *
 * A game is a module that exports `mount`. The play page (/play/[slug])
 * finds the game's row in the database, looks up its `entry` name in the
 * registry (registry.ts), loads that module in the browser ONLY when the
 * player opens the page (so the home page stays light), and calls mount().
 *
 * The game must not know where it runs (V2 §22): everything it needs from
 * the site comes in through `GameContext.platform`, never by calling site
 * URLs or reading cookies itself. That is what lets the same game ship as a
 * portal demo or offline app later.
 *
 * This file is types only, so it is safe to import from game packages.
 */

/** Who is playing, as far as the game needs to know. */
export interface GamePlayer {
  id: string;
  /** Leaderboard-safe name: first name + initial. */
  displayName: string;
  /** Can this player use staff-only cheats / preview disabled content? */
  isStaff: boolean;
}

/** Site services a game may call. All are async and may fail (offline). */
export interface GamePlatform {
  /** Save one slot to the cloud (when signed in). Games must ALSO save locally first. */
  saveProgress(slot: string, data: unknown, opts?: { saveVersion?: number; summary?: string }): Promise<void>;
  loadProgress(slot: string): Promise<{ data: unknown; saveVersion: number } | null>;
  submitScore(score: number, opts?: { cheated?: boolean; details?: Record<string, unknown> }): Promise<void>;
  /** Ask the server which cheat a typed or dialled code unlocks (codes never reach the browser). */
  checkCheat(code: string, channel: "typed" | "dial"): Promise<{ key: string; effect: Record<string, unknown> } | null>;
  /** Ask the server whether a secret-character code is right. */
  checkHero(code: string): Promise<{ name: string; details: Record<string, string> } | null>;
}

export interface GameContext {
  slug: string;
  /** Base URL of the game's built files, e.g. "/games/momentum-cup/". */
  assetsPath: string;
  /** Effective settings: game defaults + site-wide + per-game overrides. */
  settings: Record<string, unknown>;
  /** Null for guests. */
  player: GamePlayer | null;
  platform: GamePlatform;
  /** Aborted when the player leaves the page; stop loops and listeners. */
  signal: AbortSignal;
}

/** What mount() returns so the page can control the running game. */
export interface GameHandle {
  /** Stop everything and remove what the game added to the page. */
  unmount(): void;
  pause?(): void;
  resume?(): void;
}

export interface GameModule {
  /** Start the game inside `container` (an empty, sized element). */
  mount(container: HTMLElement, ctx: GameContext): GameHandle | Promise<GameHandle>;
}

/** A registry entry: a function that loads the module on demand (dynamic import). */
export type GameLoader = () => Promise<GameModule>;
