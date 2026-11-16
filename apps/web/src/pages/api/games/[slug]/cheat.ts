/**
 * POST /api/games/<slug>/cheat { code, channel: "typed" | "dial" } -> { ok, key: string | null }
 * Codes are checked here, against hashes; plain codes never reach the browser.
 */
import type { APIRoute } from "astro";
import { cheat } from "../../../../games/arcade-api.ts";
import { jsonBody, playCtx, send } from "../../../../games/server.ts";
import { fail } from "../../../../lib/http.ts";

export const POST: APIRoute = async (c) => {
  const read = await jsonBody(c.request, 2048);
  if (!read || read.bytes > 2048) return fail("Bad request.");
  return send(await cheat(await playCtx(c), c.params.slug ?? "", read.body));
};
