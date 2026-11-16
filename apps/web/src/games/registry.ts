/**
 * Which code runs for which game. The key is the game's `entry` column in
 * the database (catalogue "script" in the old site, e.g. "kickoff").
 *
 * Each value MUST be a dynamic import, so a game's code is only downloaded
 * when someone opens that game:
 *
 *   kickoff: () => import("@mib/game-momentum-cup"),
 *
 * The 16 games from the old site do not go through this registry: they run
 * as their original scripts (see legacy.ts). A game that is in neither has no
 * play page (404), so nothing half-built is ever shown.
 */
import type { GameLoader } from "./contract.ts";

export const gameRegistry: Record<string, GameLoader> = {
  // Example of the shape (a tiny demo that proves the contract end to end):
  "demo-hello": () => import("./demo-hello.ts"),
  // The new open-world campus game (PlayCanvas, built from games/work-in-progress).
  "work-in-progress": () => import("./work-in-progress.ts"),
};

export function hasGame(entry: string): boolean {
  return Object.prototype.hasOwnProperty.call(gameRegistry, entry);
}
