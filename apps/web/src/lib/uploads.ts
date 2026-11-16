/**
 * Image uploads (people's photos, covers, ad images). Stored through the
 * platform's blob store: apps/web/.data/uploads/ locally (git-ignored, so
 * real photos never reach git), the R2 bucket on Cloudflare. Served by
 * src/pages/uploads/[...path].ts.
 */
import { blobs } from "#platform";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Check the file's first bytes really are the image type it claims. */
export function sniffImage(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Save an uploaded image into a folder (e.g. "people"). Returns its public URL. */
export async function saveImage(file: File, folder: string): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Images must be 4 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type || !IMAGE_TYPES[type]) throw new Error("Upload a PNG, JPEG, WebP or GIF image.");
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "misc";
  const name = `${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
  await blobs.put(`${safeFolder}/${name}`, bytes, type);
  return `/uploads/${safeFolder}/${name}`;
}

/** Read an uploaded image for serving; null when missing or not an image key. */
export async function readUpload(path: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const file = await blobs.get(path);
  if (!file || !IMAGE_TYPES[file.contentType]) return null;
  return { bytes: file.bytes, type: file.contentType };
}
