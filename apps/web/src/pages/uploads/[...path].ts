/** GET /uploads/<folder>/<file>: serve an uploaded image (see src/lib/uploads.ts). */
import type { APIRoute } from "astro";
import { readUpload } from "../../lib/uploads.ts";

export const GET: APIRoute = async ({ params }) => {
  const file = await readUpload(params.path ?? "");
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.bytes.buffer as ArrayBuffer, {
    headers: { "content-type": file.type, "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" },
  });
};
