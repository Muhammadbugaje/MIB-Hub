/**
 * GET /api/admin/sound/<id>: play an uploaded sound for staff (games.manage_sounds).
 * <id> is a game_sound row (the file players hear now) or a game_sound_version
 * row (any saved version, for the history list and the editor).
 */
import type { APIRoute } from "astro";
import { readSound } from "../../../../lib/admin-sounds.ts";
import { repos } from "../../../../lib/db.ts";
import { guardApi } from "../../../../lib/guard.ts";

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = guardApi(locals.viewer, { permission: "games.manage_sounds" });
  if (denied) return denied;
  const id = String(params.id ?? "");
  const row = (await repos.sounds.getById(id)) ?? (await repos.sounds.getVersion(id));
  const bytes = row ? await readSound(row.fileKey) : null;
  if (!row || !bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: { "content-type": row.contentType, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
};
