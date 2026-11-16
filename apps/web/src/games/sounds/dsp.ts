/**
 * The sound editor's maths, on plain Float32Arrays (one per channel), so it
 * runs in the browser (the admin's editor) and in tests alike:
 * trim, fade in and out, volume and normalise, trailing-silence trim,
 * waveform peaks for drawing, and encoding to a 16-bit WAV file.
 */

export interface EditSettings {
  /** Seconds from the start to keep from. */
  start: number;
  /** Seconds from the start to keep until. */
  end: number;
  fadeIn: number;
  fadeOut: number;
  /** Linear gain (1 = as is). Applied after normalising. */
  gain: number;
  /** Scale so the loudest sample reaches -1 dBFS before the gain. */
  normalise: boolean;
}

export const NORMALISE_PEAK = 0.891; // -1 dBFS

/** Apply an edit. Returns new arrays; the input is not changed. */
export function applyEdit(channels: Float32Array[], sampleRate: number, e: EditSettings): Float32Array[] {
  const len = channels[0]?.length ?? 0;
  const a = Math.max(0, Math.min(len, Math.round(e.start * sampleRate)));
  const b = Math.max(a, Math.min(len, Math.round(e.end * sampleRate)));
  const out = channels.map((c) => c.slice(a, b));
  const n = b - a;
  let scale = e.gain;
  if (e.normalise) {
    let peak = 0;
    for (const c of out) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(c[i]!));
    if (peak > 1e-6) scale *= NORMALISE_PEAK / peak;
  }
  const fi = Math.min(n, Math.round(Math.max(0, e.fadeIn) * sampleRate));
  const fo = Math.min(n, Math.round(Math.max(0, e.fadeOut) * sampleRate));
  for (const c of out) {
    for (let i = 0; i < n; i++) {
      let g = scale;
      if (i < fi) g *= i / fi;
      if (i >= n - fo) g *= (n - 1 - i) / fo;
      const v = c[i]! * g;
      c[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
  }
  return out;
}

/** Seconds of sound before the trailing silence (below `floor`), plus a short tail. */
export function soundEnd(channels: Float32Array[], sampleRate: number, floor = 0.002, tail = 0.05): number {
  const len = channels[0]?.length ?? 0;
  for (let i = len - 1; i >= 0; i--) {
    for (const c of channels) if (Math.abs(c[i]!) > floor) return Math.min(len, i + 1 + tail * sampleRate) / sampleRate;
  }
  return 0;
}

/** `count` (min, max) pairs across the sound, for drawing its waveform. */
export function peaks(channel: Float32Array, count: number): { min: number; max: number }[] {
  const out: { min: number; max: number }[] = [];
  const step = channel.length / Math.max(1, count);
  for (let k = 0; k < count; k++) {
    let lo = 0;
    let hi = 0;
    const from = Math.floor(k * step);
    const to = Math.max(from + 1, Math.floor((k + 1) * step));
    for (let i = from; i < to && i < channel.length; i++) {
      const v = channel[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out.push({ min: lo, max: hi });
  }
  return out;
}

/** Mix to mono and resample (linear) to a lower rate, for keeping recordings under the size limit. */
export function downmix(channels: Float32Array[], fromRate: number, toRate: number): Float32Array {
  const len = channels[0]?.length ?? 0;
  const ratio = fromRate / toRate;
  const n = Math.floor(len / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const j = Math.floor(x);
    const f = x - j;
    let s = 0;
    for (const c of channels) s += (c[j]! * (1 - f) + (c[Math.min(len - 1, j + 1)] ?? 0) * f) / channels.length;
    out[i] = s;
  }
  return out;
}

/** Encode as a 16-bit PCM WAV file. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const ch = Math.max(1, channels.length);
  const n = channels[0]?.length ?? 0;
  const dataBytes = n * ch * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

/** Bytes a WAV of this length would take. */
export function wavBytes(seconds: number, sampleRate: number, channels: number): number {
  return 44 + Math.ceil(seconds * sampleRate) * channels * 2;
}

/** The largest standard rate (44.1, 22.05, 16 or 11.025 kHz) at which a mono WAV fits `maxBytes`. */
export function fitRate(seconds: number, sourceRate: number, maxBytes: number): number | null {
  for (const r of [sourceRate, 44100, 22050, 16000, 11025]) if (r <= sourceRate && wavBytes(seconds, r, 1) <= maxBytes) return r;
  return null;
}
