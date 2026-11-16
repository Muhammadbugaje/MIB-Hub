/**
 * Load a game's override map (sound id -> file URL + volume) from the
 * database. Runtime-neutral (repos only), for the API routes.
 *
 * For the offline worker: `(await loadOverrideMap(repos, slug)).files` is the
 * list of replacement sound files to precache for a game; the same list is
 * served at GET /api/games/<slug>/sounds (field `files`).
 */
import type { Repos } from "@mib/db";
import { resolveOverrides, type OverrideMap } from "./overrides.ts";

export async function loadOverrideMap(repos: Repos, slug: string): Promise<OverrideMap> {
  const [rows, settings] = await Promise.all([repos.sounds.list(slug), repos.sounds.settings(slug)]);
  return resolveOverrides(slug, rows, settings);
}

/** Just the URLs to precache for offline play of one game. */
export async function soundPrecacheUrls(repos: Repos, slug: string): Promise<string[]> {
  return (await loadOverrideMap(repos, slug)).files;
}
