/**
 * /api/games/arcade/*: the old games' API (they call it through the play
 * page's data-gm-api attribute). The logic is in src/games/arcade-api.ts.
 *
 *   GET  me/  ·  POST result/ sync/ buy/ equip/ privacy/ hero/  ·  GET sounds/<slug>/
 *   GET  sounds/<slug>/file/<name>   a replacement sound file
 */
import type { APIRoute } from "astro";
import { arcadeCall } from "../../../../games/arcade-api.ts";
import { jsonBody, playCtx, send } from "../../../../games/server.ts";
import { repos } from "../../../../lib/db.ts";
import { fail } from "../../../../lib/http.ts";
import { readSound } from "../../../../lib/admin-sounds.ts";

/** Biggest request body: one result is tiny; a batch of offline results is bigger. */
const MAX_BODY = 96 * 1024;

async function soundFile(slug: string, name: string): Promise<Response> {
  const row = await repos.sounds.get(slug, name);
  const bytes = row ? await readSound(row.fileKey) : null;
  if (!row || !bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: { "content-type": row.contentType, "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" },
  });
}

export const GET: APIRoute = async (c) => {
  const parts = (c.params.path ?? "").split("/").filter(Boolean);
  if (parts[0] === "sounds" && parts[2] === "file" && parts[1] && parts[3]) return soundFile(parts[1], decodeURIComponent(parts[3]));
  return send(await arcadeCall(await playCtx(c), "GET", c.params.path ?? "", {}));
};

export const POST: APIRoute = async (c) => {
  const read = await jsonBody(c.request, MAX_BODY);
  if (!read) return fail("Bad JSON.");
  if (read.bytes > MAX_BODY) return fail("Request too large.", 413);
  return send(await arcadeCall(await playCtx(c), "POST", c.params.path ?? "", read.body));
};
