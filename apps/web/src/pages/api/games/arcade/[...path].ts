/** /api/games/arcade/*: the old games' API (they call it through the play
 * page's data-gm-api attribute). The logic is in src/games/arcade-api.ts.
 *
 *   GET  me/  ·  POST result/ sync/ buy/ equip/ privacy/ hero/  ·  GET sounds/<slug>/
 *   GET  sounds/<slug>/file/<name>   a replacement sound file
 *
 * FSLG endpoints:
 *   GET   /fslg/config          – read current config
 *   PATCH /fslg/config          – update config (super admin)
 *   POST  /fslg/config/reset    – reset config to defaults (super admin)
 *   GET   /fslg/characters    – read NPC definitions (super admin)
 *   POST  /fslg/characters/save  – save NPC changes (super admin)
 *   POST  /fslg/characters/reset – reset NPCs to defaults (super admin)
 *   GET   /fslg/credits       – read current credits (super admin)
 *   POST  /fslg/credits/save   – save credits changes (super admin)
 *   POST  /fslg/credits/reset  – reset credits to defaults (super admin)
 *   GET   /fslg/settings      – read game settings (super admin)
 *   PATCH /fslg/settings      – update settings (super admin)
 *   POST  /fslg/settings/reset – reset settings to defaults (super admin)
 */
import type { APIRoute } from "astro";
import { arcadeCall } from "../../../../games/arcade-api.ts";
import { jsonBody, playCtx, send } from "../../../../games/server.ts";
import { repos } from "../../../../lib/db.ts";
import { fail } from "../../../../lib/http.ts";
import { readSound } from "../../../../lib/admin-sounds.ts";

import { getFslgConfig, patchFslgConfig, postFslgConfigReset } from "../../../../games/fslg-config.ts";
import { getFslgCharacters, postFslgCharactersSave, postFslgCharactersReset } from "../../../../games/fslg-characters.ts";
import { getFslgCredits, postFslgCreditsSave, postFslgCreditsReset } from "../../../../games/fslg-credits.ts";
import { getFslgSettings, patchFslgSettings, postFslgSettingsReset } from "../../../../games/fslg-settings.ts";

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

/** FSLG route handler – dispatches to the appropriate FSLG handler based on the path. */
async function handleFslg(ctx: PlayCtx, method: string, path: string, body: Record<string, unknown>): Promise<Reply> {
  const parts = path.split("/").filter(Boolean);
  const what = parts[0] ?? "";

  if (what === "config") {
    if (method === "GET") return send(await getFslgConfig(ctx));
    if (method === "PATCH") return send(await patchFslgConfig(ctx, body));
    if (method === "POST") return send(await postFslgConfigReset(ctx));
    return err("Unknown config method.", 400);
  }

  if (what === "characters") {
    if (method === "GET") return send(await getFslgCharacters(ctx));
    if (method === "POST") {
      const action = body.action || "save";
      if (action === "save") return send(await postFslgCharactersSave(ctx, body));
      if (action === "reset") return send(await postFslgCharactersReset(ctx, body));
    }
    return err("Unknown characters method.", 400);
  }

  if (what === "credits") {
    if (method === "GET") return send(await getFslgCredits(ctx));
    if (method === "POST") {
      const action = body.action || "save";
      if (action === "save") return send(await postFslgCreditsSave(ctx, body));
      if (action === "reset") return send(await postFslgCreditsReset(ctx, body));
    }
    return err("Unknown credits method.", 400);
  }

  if (what === "settings") {
    if (method === "GET") return send(await getFslgSettings(ctx));
    if (method === "PATCH") return send(await patchFslgSettings(ctx, body));
    if (method === "POST") return send(await postFslgSettingsReset(ctx, body));
    return err("Unknown settings method.", 400);
  }

  return err("FSLG endpoint not found.", 404);
}

export const GET: APIRoute = async (c) => {
  const parts = (c.params.path ?? "").split("/").filter(Boolean);
  if (parts[0] === "sounds" && parts[2] === "file" && parts[1] && parts[3]) return soundFile(parts[1], decodeURIComponent(parts[3]));

  const ctx = await playCtx(c);
  if (parts[0] === "fslg") {
    const body: Record<string, unknown> = {};
    if (c.request.method === "POST" || c.request.method === "patch" || c.request.method === "PUT") {
      const read = await jsonBody(c.request);
      if (read) Object.assign(body, read);
    }
    return send(await handleFslg(ctx, "GET", parts[1] ?? "", body));
  }

  return send(await arcadeCall(ctx, "GET", parts[0] ?? "", {}));
};

export const POST: APIRoute = async (c) => {
  const read = await jsonBody(c.request, MAX_BODY);
  if (!read) return fail("Bad JSON.", 400);

  const parts = (c.params.path ?? "").split("/").filter(Boolean);
  if (parts[0] === "sounds" && parts[2] === "file" && parts[1] && parts[3]) {
    if (read.bytes > MAX_BODY) return fail("Request too large.", 413);
    return soundFile(parts[1], decodeURIComponent(parts[3]));
  }

  const ctx = await playCtx(c);
  if (parts[0] === "fslg") {
    const body: Record<string, unknown> = {};
    if (c.request.method === "POST" || c.request.method === "patch" || c.request.method === "PUT") {
      const read = await jsonBody(c.request);
      if (read) Object.assign(body, read);
    }
    return send(await handleFslg(ctx, "POST", parts[1] ?? "", body));
  }

  return send(await arcadeCall(ctx, "POST", parts[0] ?? "", read.body));
};