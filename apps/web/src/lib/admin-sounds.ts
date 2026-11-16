/**
 * Sound files for the sound manager (/admin/games/<slug>/sounds): checking an
 * upload and storing, reading and deleting the file. Rows live in game_sound
 * and game_sound_version (repos.sounds); each keeps `fileKey` =
 * "sounds/<uuid>.<ext>".
 *
 * STORAGE: the three functions under "storage" are the only place that touches
 * where files live. They go through the platform's blob store (src/platform/):
 * apps/web/.data/uploads/ on disk locally (git-ignored), the D1 database on
 * Cloudflare (`blob` table), as for every other upload.
 */
import { blobs } from "#platform";
import { checkSoundFile, SOUND_EXT_TYPES, type SoundCheck } from "../games/sounds/audio-file.ts";

export { SOUND_FORMATS, SOUND_LIMITS } from "../games/sounds/audio-file.ts";

/** Check an uploaded File (type from its bytes, size, length). */
export async function checkUpload(file: File, declaredSeconds?: number | null): Promise<{ check: SoundCheck; bytes: Uint8Array }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { check: checkSoundFile(bytes, declaredSeconds), bytes };
}

/** The content type for a stored key, from its extension. */
export function typeOfKey(fileKey: string): string {
  return SOUND_EXT_TYPES[fileKey.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** Check and store a sound file. Returns its key, type, size and length. Throws a plain-English error. */
export async function saveSound(file: File, declaredSeconds?: number | null): Promise<{ fileKey: string; contentType: string; size: number; duration: number }> {
  if (file.size === 0) throw new Error("Choose a sound file.");
  const { check, bytes } = await checkUpload(file, declaredSeconds);
  if (!check.ok) throw new Error(check.error);
  const fileKey = `sounds/${crypto.randomUUID()}.${check.ext}`;
  await putSoundBytes(fileKey, bytes);
  return { fileKey, contentType: check.type, size: bytes.length, duration: check.seconds };
}

/* ------------------------------------------------------------- storage */

/** Only "sounds/<uuid>.<ext>" keys belong here. */
function isSoundKey(fileKey: string): boolean {
  return /^sounds\/[a-z0-9-]+\.(wav|mp3|ogg|m4a)$/.test(fileKey);
}

async function putSoundBytes(fileKey: string, bytes: Uint8Array): Promise<void> {
  if (!isSoundKey(fileKey)) throw new Error("Bad file key.");
  await blobs.put(fileKey, bytes, typeOfKey(fileKey));
}

/** Read a stored sound (null when missing). */
export async function readSound(fileKey: string): Promise<Uint8Array | null> {
  if (!isSoundKey(fileKey)) return null;
  return (await blobs.get(fileKey))?.bytes ?? null;
}

/** Delete stored sounds (ignores missing files). */
export async function deleteSound(...fileKeys: (string | null | undefined)[]): Promise<void> {
  for (const k of fileKeys) {
    if (k && isSoundKey(k)) await blobs.delete(k);
  }
}
