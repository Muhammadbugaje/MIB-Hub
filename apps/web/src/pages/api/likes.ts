/**
 * POST /api/likes: like or un-like a game (or one of its levels).
 * Body: { gameSlug, level? }. Returns { liked, total }.
 * Signed-out visitors can like too (one vote per browser).
 */
import type { APIRoute } from "astro";
import { repos } from "../../lib/db.ts";
import { clientKey, fail, guestId, json, rateLimited, readBody, str } from "../../lib/http.ts";
import { siteSwitches } from "../../lib/site.ts";

export const POST: APIRoute = async ({ request, locals, cookies, clientAddress }) => {
  if (!(await siteSwitches()).likes) return fail("Likes are switched off.", 403);
  if (rateLimited(`like:${clientKey(request, clientAddress)}`, 60, 60_000)) return fail("Slow down a little.", 429);
  const body = await readBody(request);
  const gameSlug = str(body.gameSlug, 80);
  const level = str(body.level, 40);
  if (!gameSlug || !(await repos.games.getBySlug(gameSlug))) return fail("No such game.", 404);
  const voter = locals.viewer.user?.id ?? `guest:${guestId(cookies)}`;
  return json({ ok: true, ...(await repos.likes.toggle(gameSlug, voter, level)) });
};
