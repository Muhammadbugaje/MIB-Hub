/**
 * POST /api/uploads (multipart: file, folder): staff upload an image and get
 * its URL back. Needs content.manage or games.manage_content.
 */
import type { APIRoute } from "astro";
import { fail, json } from "../../lib/http.ts";
import { saveImage } from "../../lib/uploads.ts";

export const POST: APIRoute = async ({ request, locals }) => {
  const v = locals.viewer;
  if (!v.user) return fail("Sign in first.", 401);
  if (!v.permissions.has("content.manage") && !v.permissions.has("games.manage_content")) return fail("Not allowed.", 403);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Choose an image to upload.");
  try {
    const url = await saveImage(file, String(form?.get("folder") ?? "misc"));
    return json({ ok: true, url });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Upload failed.");
  }
};
