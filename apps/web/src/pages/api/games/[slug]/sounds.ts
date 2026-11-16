/**
 * GET /api/games/<slug>/sounds -> { slug, sounds: [{ name, v, type, size, duration, at, url, vol }], vols, files }
 *
 * The replacement sounds staff set for a game (sound id -> file URL and
 * volume). `files` lists every URL to precache so the replacements also play
 * offline (the service worker uses it). Public, like the game itself.
 */
import type { APIRoute } from "astro";
import { loadOverrideMap } from "../../../../games/sounds/load.ts";
import { repos } from "../../../../lib/db.ts";

export const GET: APIRoute = async ({ params }) => {
  const slug = String(params.slug ?? "");
  const game = slug ? await repos.games.getBySlug(slug) : undefined;
  if (!game) return new Response(JSON.stringify({ error: "Not found." }), { status: 404, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify(await loadOverrideMap(repos, slug)), {
    headers: { "content-type": "application/json", "cache-control": "no-cache" },
  });
};
