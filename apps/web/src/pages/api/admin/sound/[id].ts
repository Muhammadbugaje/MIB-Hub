/** GET /api/admin/sound/<id>: play an uploaded replacement sound (staff with games.manage_sounds). */
import type { APIRoute } from "astro";
import { readSound } from "../../../../lib/admin-sounds.ts";
import { repos } from "../../../../lib/db.ts";
import { guardApi } from "../../../../lib/guard.ts";

export const GET: APIRoute = async ({ params, locals }) => {
  const denied = guardApi(locals.viewer, { permission: "games.manage_sounds" });
  if (denied) return denied;
  const sound = await repos.sounds.getById(String(params.id ?? ""));
  const bytes = sound ? await readSound(sound.fileKey) : null;
  if (!sound || !bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: { "content-type": sound.contentType, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
};
