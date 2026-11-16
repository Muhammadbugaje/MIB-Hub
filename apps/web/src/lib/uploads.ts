/**
 * Image uploads (people's photos, covers, ad images). Stored through the
 * platform's blob store: apps/web/.data/uploads/ locally (git-ignored, so
 * real photos never reach git), the D1 database on Cloudflare (`blob` table). Served by
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

/**
 * Folders that take no uploads. Profile pictures are switched off (there is no
 * storage for them): players get coloured initials instead (Avatar.astro).
 * Staff uploads (news covers, people photos, ads...) use other folders.
 */
export const BLOCKED_UPLOAD_FOLDERS: ReadonlySet<string> = new Set(["avatars", "avatar", "profile", "profiles"]);

/** The storage folder name for an upload (letters, digits and dashes; "misc" when empty). */
export function uploadFolder(folder: string): string {
  return folder.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "misc";
}

/** True when `path` ("avatars/x.png") is in a folder that is switched off. */
export function isBlockedUploadPath(path: string): boolean {
  return BLOCKED_UPLOAD_FOLDERS.has(uploadFolder(path.split("/")[0] ?? ""));
}

/** Save an uploaded image into a folder (e.g. "people"). Returns its public URL. */
export async function saveImage(file: File, folder: string): Promise<string> {
  if (BLOCKED_UPLOAD_FOLDERS.has(uploadFolder(folder))) throw new Error("Profile pictures are switched off.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Images must be 4 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type || !IMAGE_TYPES[type]) throw new Error("Upload a PNG, JPEG, WebP or GIF image.");
  const safeFolder = uploadFolder(folder);
  const name = `${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
  await blobs.put(`${safeFolder}/${name}`, bytes, type);
  return `/uploads/${safeFolder}/${name}`;
}

/** Read an uploaded image for serving; null when missing or not an image key. */
export async function readUpload(path: string): Promise<{ bytes: Uint8Array; type: string; etag: string } | null> {
  if (isBlockedUploadPath(path)) return null; // old profile pictures are no longer shown
  const file = await blobs.get(path);
  if (!file || !IMAGE_TYPES[file.contentType]) return null;
  return { bytes: file.bytes, type: file.contentType, etag: file.etag };
}

/** An uploaded image's ETag without reading the file; null when missing or not an image. */
export async function uploadEtag(path: string): Promise<string | null> {
  if (isBlockedUploadPath(path)) return null;
  const info = await blobs.stat(path);
  return info && IMAGE_TYPES[info.contentType] ? info.etag : null;
}

/** Does an If-None-Match header list this ETag (or "*")? */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((t) => {
    const v = t.trim().replace(/^W\//, "");
    return v === "*" || v === etag;
  });
}
