/**
 * POST /api/track: the play tracker. Games (through the platform services) send
 * one event per thing that happened: start, end, level_start, level_complete,
 * level_fail, quit. Signed-out players are counted by an anonymous cookie id.
 * Body: { gameSlug, kind, sessionId, level?, durationMs?, score?, meta? }
 */
import type { APIRoute } from "astro";
import { PLAY_EVENT_KINDS } from "@mib/db";
import { repos } from "../../lib/db.ts";
import { clientKey, deviceOf, fail, guestId, int, json, rateLimited, readBody, str } from "../../lib/http.ts";
import { siteSwitches } from "../../lib/site.ts";

export const POST: APIRoute = async ({ request, locals, cookies, clientAddress }) => {
  if (!(await siteSwitches()).tracking) return json({ ok: true, tracked: false });
  if (rateLimited(`track:${clientKey(request, clientAddress)}`, 240, 60_000)) return fail("Too many events.", 429);
  const body = await readBody(request);
  const gameSlug = str(body.gameSlug, 80);
  const kind = str(body.kind, 20);
  const sessionId = str(body.sessionId, 64);
  if (!gameSlug || !sessionId || !(PLAY_EVENT_KINDS as readonly string[]).includes(kind)) return fail("Bad event.");
  if (!(await repos.games.getBySlug(gameSlug))) return fail("No such game.", 404);
  const user = locals.viewer.user;
  await repos.analytics.track({
    gameSlug,
    kind: kind as (typeof PLAY_EVENT_KINDS)[number],
    sessionId,
    level: str(body.level, 40),
    durationMs: int(body.durationMs),
    score: int(body.score),
    userId: user?.id ?? null,
    guestId: user ? null : guestId(cookies),
    device: deviceOf(request.headers.get("user-agent")),
    meta: typeof body.meta === "object" && body.meta ? (body.meta as Record<string, unknown>) : {},
  });
  return json({ ok: true, tracked: true });
};
