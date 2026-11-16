/**
 * Sound files for /admin/sounds (replacement sounds for every player of a
 * game). Files live under apps/web/.data/uploads/sounds/ (git-ignored; R2
 * later); the row in game_sound keeps `fileKey` = "sounds/<uuid>.<ext>".
 * They are served to staff by /api/admin/sound/<id>.
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { SOUND_MAX_BYTES } from "@mib/db";
import { UPLOAD_DIR } from "./uploads.ts";

export const SOUND_TYPES: Record<string, { ext: string; label: string }> = {
  "audio/wav": { ext: "wav", label: "WAV" },
  "audio/mpeg": { ext: "mp3", label: "MP3" },
  "audio/mp4": { ext: "m4a", label: "M4A" },
};

/** What kind of audio these first bytes are (WAV, MP3 or M4A), or null. */
export function sniffSound(b: Uint8Array): keyof typeof SOUND_TYPES | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "audio/wav";
  if (ascii(0, 3) === "ID3") return "audio/mpeg";
  if (b[0] === 0xff && b[1] !== undefined && (b[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (ascii(4, 8) === "ftyp") return "audio/mp4";
  return null;
}

/** Check and store a sound file. Returns its key and type. Throws a plain-English error. */
export async function saveSound(file: File): Promise<{ fileKey: string; contentType: string; size: number }> {
  if (file.size === 0) throw new Error("Choose a sound file.");
  if (file.size > SOUND_MAX_BYTES) throw new Error("Sounds must be 2 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffSound(bytes);
  if (!type) throw new Error("Upload a WAV, MP3 or M4A file.");
  const name = `${crypto.randomUUID()}.${SOUND_TYPES[type]!.ext}`;
  await mkdir(join(UPLOAD_DIR, "sounds"), { recursive: true });
  await writeFile(join(UPLOAD_DIR, "sounds", name), bytes);
  return { fileKey: `sounds/${name}`, contentType: type, size: bytes.length };
}

function pathOf(fileKey: string): string | null {
  const full = normalize(join(UPLOAD_DIR, fileKey));
  return full.startsWith(join(UPLOAD_DIR, "sounds") + "/") ? full : null;
}

/** Delete a stored sound (ignores missing files). */
export async function deleteSound(fileKey: string | null | undefined): Promise<void> {
  const p = fileKey ? pathOf(fileKey) : null;
  if (!p) return;
  await unlink(p).catch(() => undefined);
}

export async function readSound(fileKey: string): Promise<Uint8Array | null> {
  const p = pathOf(fileKey);
  if (!p) return null;
  try {
    return new Uint8Array(await readFile(p));
  } catch {
    return null;
  }
}
