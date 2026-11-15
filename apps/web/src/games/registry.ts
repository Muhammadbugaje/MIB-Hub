/**
 * Which code runs for which game. The key is the game's `entry` column in
 * the database (catalogue "script" in the old site, e.g. "kickoff").
 *
 * Each value MUST be a dynamic import, so a game's code is only downloaded
 * when someone opens that game:
 *
 *   kickoff: () => import("@mib/game-momentum-cup"),
 *
 * TODO(games-port): add each ported game here. Games without an entry show
 * the "coming soon" panel on their play page.
 */
import type { GameLoader } from "./contract.ts";

export const gameRegistry: Record<string, GameLoader> = {
  // Example of the shape (a tiny demo that proves the contract end to end):
  "demo-hello": () => import("./demo-hello.ts"),
};

export function hasGame(entry: string): boolean {
  return Object.prototype.hasOwnProperty.call(gameRegistry, entry);
}
