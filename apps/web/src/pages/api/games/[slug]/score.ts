/**
 * POST /api/games/<slug>/score { score, cheated?, details? } -> { ok, id, best }
 * For games built on the TypeScript contract (src/games/contract.ts). The old
 * EE Hub games report through /api/games/arcade/result/ instead.
 */
import type { APIRoute } from "astro";
import { submitScore } from "../../../../games/arcade-api.ts";
import { jsonBody, playCtx, send } from "../../../../games/server.ts";
import { fail } from "../../../../lib/http.ts";

export const POST: APIRoute = async (c) => {
  const read = await jsonBody(c.request, 8192);
  if (!read || read.bytes > 8192) return fail("Bad request.");
  return send(await submitScore(await playCtx(c), c.params.slug ?? "", read.body));
};
