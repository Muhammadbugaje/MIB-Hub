/**
 * /api/games/<slug>/save: the signed-in player's cloud save for one game.
 *   GET  ?slot=auto|1..5        -> { ok, save: { data, saveVersion, summary, updatedAt } | null }
 *   POST { slot?, data, saveVersion?, summary? } -> { ok, updatedAt }
 * Old (EE Hub) games save { keys: { localStorage key: value }, at }; see src/games/legacy.ts.
 */
import type { APIRoute } from "astro";
import { MAX_SAVE_BYTES, loadSave, storeSave } from "../../../../games/arcade-api.ts";
import { jsonBody, playCtx, send } from "../../../../games/server.ts";
import { fail } from "../../../../lib/http.ts";

export const GET: APIRoute = async (c) =>
  send(await loadSave(await playCtx(c), c.params.slug ?? "", c.url.searchParams.get("slot") ?? "auto"));

export const POST: APIRoute = async (c) => {
  const read = await jsonBody(c.request, MAX_SAVE_BYTES);
  if (!read) return fail("Bad JSON.");
  return send(await storeSave(await playCtx(c), c.params.slug ?? "", read.body, read.bytes));
};
