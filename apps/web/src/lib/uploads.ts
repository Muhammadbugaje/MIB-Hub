/**
 * Image uploads (people's photos, covers, ad images). Stored on disk under
 * apps/web/.data/uploads/ (git-ignored, so real photos never reach git) and
 * served by src/pages/uploads/[...path].ts. Later this becomes Cloudflare R2.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { REPO_ROOT } from "./env.ts";

export const UPLOAD_DIR = resolve(REPO_ROOT, "apps/web/.data/uploads");
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const EXT_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

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
  await mkdir(join(UPLOAD_DIR, safeFolder), { recursive: true });
  await writeFile(join(UPLOAD_DIR, safeFolder, name), bytes);
  return `/uploads/${safeFolder}/${name}`;
}

/** Read an uploaded file for serving; null when missing or outside the folder. */
export async function readUpload(path: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const full = normalize(join(UPLOAD_DIR, path));
  if (!full.startsWith(UPLOAD_DIR + "/")) return null;
  const ext = full.split(".").pop()?.toLowerCase() ?? "";
  const type = EXT_TYPES[ext];
  if (!type) return null;
  try {
    return { bytes: new Uint8Array(await readFile(full)), type };
  } catch {
    return null;
  }
}
