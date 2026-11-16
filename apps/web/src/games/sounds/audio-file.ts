/**
 * Checking an uploaded sound file without trusting its name or its claimed
 * type: what it really is (from its first bytes), how long it plays (read
 * from the file's own header where the format allows), and whether it fits
 * the limits. Pure functions on bytes: runs on Node, Cloudflare and in tests.
 */

export const SOUND_FORMATS = {
  "audio/wav": { ext: "wav", label: "WAV" },
  "audio/mpeg": { ext: "mp3", label: "MP3" },
  "audio/ogg": { ext: "ogg", label: "OGG" },
  "audio/mp4": { ext: "m4a", label: "M4A" },
} as const;
export type SoundType = keyof typeof SOUND_FORMATS;

/** File extension -> type, for serving stored files. */
export const SOUND_EXT_TYPES: Record<string, SoundType> = { wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4" };

/** Limits (as the old site's sounds.py): 2 MB, 0.05 to 120 seconds. */
export const SOUND_LIMITS = { maxBytes: 2 * 1024 * 1024, minSeconds: 0.05, maxSeconds: 120 } as const;

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));

/** What kind of audio these bytes are, or null when it is not one we accept. */
export function sniffAudio(b: Uint8Array): SoundType | null {
  if (b.length < 12) return null;
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return "audio/wav";
  if (ascii(b, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(b, 4, 8) === "ftyp") return "audio/mp4";
  if (ascii(b, 0, 3) === "ID3") return "audio/mpeg";
  if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0 && (b[1]! & 0x06) !== 0) return "audio/mpeg"; // frame sync + a layer
  return null;
}

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16)) + b[o + 3]! * 0x1000000;
const u32be = (b: Uint8Array, o: number) => b[o]! * 0x1000000 + ((b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!);

/** WAV: data bytes / byte rate (from the fmt and data chunks). */
function wavSeconds(b: Uint8Array): number | null {
  let o = 12;
  let byteRate = 0;
  while (o + 8 <= b.length) {
    const id = ascii(b, o, o + 4);
    const size = u32(b, o + 4);
    if (id === "fmt " && o + 16 <= b.length) byteRate = u32(b, o + 8 + 8);
    if (id === "data") return byteRate > 0 ? Math.min(size, b.length - o - 8) / byteRate : null;
    o += 8 + size + (size % 2);
  }
  return null;
}

/** OGG (Vorbis or Opus): the last page's granule position / sample rate. */
function oggSeconds(b: Uint8Array): number | null {
  // The first page's packet says which codec and its sample rate.
  let rate = 0;
  let preSkip = 0;
  for (let i = 0; i < Math.min(b.length - 20, 512); i++) {
    if (ascii(b, i, i + 7) === "\x01vorbis") {
      rate = u32(b, i + 12);
      break;
    }
    if (ascii(b, i, i + 8) === "OpusHead") {
      rate = 48000; // Opus granule positions always count 48 kHz samples
      preSkip = u16(b, i + 10);
      break;
    }
  }
  if (!rate) return null;
  for (let i = b.length - 27; i >= 0; i--) {
    if (b[i] === 0x4f && ascii(b, i, i + 4) === "OggS") {
      const lo = u32(b, i + 6);
      const hi = u32(b, i + 10);
      const granule = hi * 0x100000000 + lo;
      return Math.max(0, granule - preSkip) / rate;
    }
  }
  return null;
}

/** M4A / MP4: the movie header (mvhd) duration / timescale. */
function mp4Seconds(b: Uint8Array): number | null {
  for (let i = 4; i < b.length - 32; i++) {
    if (b[i] === 0x6d && ascii(b, i, i + 4) === "mvhd") {
      const v = b[i + 4];
      if (v === 1) {
        const scale = u32be(b, i + 4 + 4 + 16);
        const dur = u32be(b, i + 4 + 4 + 20) * 0x100000000 + u32be(b, i + 4 + 4 + 24);
        return scale ? dur / scale : null;
      }
      const scale = u32be(b, i + 4 + 4 + 8);
      const dur = u32be(b, i + 4 + 4 + 12);
      return scale ? dur / scale : null;
    }
  }
  return null;
}

const MP3_KBPS: Record<string, number[]> = {
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** MP3: the Xing/Info frame count when present, else the first frame's bit rate (an estimate for VBR). */
function mp3Seconds(b: Uint8Array): number | null {
  let o = 0;
  if (ascii(b, 0, 3) === "ID3") o = 10 + ((b[6]! & 0x7f) << 21) + ((b[7]! & 0x7f) << 14) + ((b[8]! & 0x7f) << 7) + (b[9]! & 0x7f);
  for (; o < b.length - 4 && o < 64 * 1024; o++) if (b[o] === 0xff && (b[o + 1]! & 0xe0) === 0xe0) break;
  if (o >= b.length - 4) return null;
  const ver = (b[o + 1]! >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layer = 4 - ((b[o + 1]! >> 1) & 3);
  const kbps = MP3_KBPS[`${ver === 3 ? 1 : 2}-${ver === 3 ? layer : layer === 1 ? 1 : 2}`]?.[b[o + 2]! >> 4];
  const rate = MP3_RATES[ver]?.[(b[o + 2]! >> 2) & 3];
  if (!kbps || !rate) return null;
  const spf = layer === 1 ? 384 : layer === 3 && ver !== 3 ? 576 : 1152;
  for (const tag of ["Xing", "Info"]) {
    for (let i = o + 4; i < o + 64 && i < b.length - 12; i++) {
      if (ascii(b, i, i + 4) === tag && b[i + 7]! & 1) return u32be(b, i + 8) * (spf / rate);
    }
  }
  return ((b.length - o) * 8) / (kbps * 1000);
}

/** How long the sound plays, in seconds, read from the file itself; null when it cannot be read. */
export function audioSeconds(b: Uint8Array, type: SoundType): number | null {
  try {
    const s = type === "audio/wav" ? wavSeconds(b) : type === "audio/ogg" ? oggSeconds(b) : type === "audio/mp4" ? mp4Seconds(b) : mp3Seconds(b);
    return s !== null && Number.isFinite(s) && s >= 0 ? Math.round(s * 1000) / 1000 : null;
  } catch {
    return null;
  }
}

export type SoundCheck = { ok: true; type: SoundType; ext: string; seconds: number } | { ok: false; error: string };

/**
 * Check an uploaded sound: not empty, at most 2 MB, really WAV/MP3/OGG/M4A,
 * and 0.05 to 120 seconds long. The length comes from the file; `declared`
 * (what the browser measured) is used only when the file's header cannot be read.
 */
export function checkSoundFile(b: Uint8Array, declared?: number | null): SoundCheck {
  if (b.length === 0) return { ok: false, error: "Choose a sound file." };
  if (b.length > SOUND_LIMITS.maxBytes) return { ok: false, error: "Sounds must be 2 MB or smaller." };
  const type = sniffAudio(b);
  if (!type) return { ok: false, error: "Upload a WAV, MP3, OGG or M4A file." };
  const read = audioSeconds(b, type);
  const seconds = read ?? (declared != null && Number.isFinite(declared) ? declared : null);
  if (seconds === null) return { ok: false, error: "Could not tell how long that sound is. Try a WAV or MP3 file." };
  if (seconds < SOUND_LIMITS.minSeconds || seconds > SOUND_LIMITS.maxSeconds) {
    return { ok: false, error: `The sound must be between ${SOUND_LIMITS.minSeconds} and ${SOUND_LIMITS.maxSeconds} seconds long (this one is ${seconds.toFixed(2)} s).` };
  }
  return { ok: true, type, ext: SOUND_FORMATS[type].ext, seconds };
}
