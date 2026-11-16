/**
 * GET /uploads/<folder>/<file>: serve an uploaded image (see src/lib/uploads.ts).
 * Upload names are random and never reused, so browsers may keep a copy for a
 * year. The ETag lets a browser that asks again get a tiny "304 Not Modified"
 * (checked from the file's details alone, without reading the file).
 */
import type { APIRoute } from "astro";
import { etagMatches, readUpload, uploadEtag } from "../../lib/uploads.ts";

const CACHE = "public, max-age=31536000, immutable";

export const GET: APIRoute = async ({ params, request }) => {
  const path = params.path ?? "";
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    const etag = await uploadEtag(path);
    if (etag && etagMatches(ifNoneMatch, etag)) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": CACHE } });
    }
  }
  const file = await readUpload(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      "content-type": file.type,
      "content-length": String(file.bytes.length),
      "cache-control": CACHE,
      etag: file.etag,
      "x-content-type-options": "nosniff",
    },
  });
};
