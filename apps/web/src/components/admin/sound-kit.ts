/**
 * Browser helpers for the admin sound manager: play a game's ORIGINAL sound
 * exactly as the game makes it, and turn it into audio the editor can work on.
 *
 * The page loads the games' shared runtime (public/play/_shared/js/games/arcade.js,
 * see SoundRuntime.astro), so a synthesised sound is made by the same Web Audio
 * code the game runs. Recorded originals are fetched from /play/_shared/audio/sfx/.
 * To edit a synthesised sound, it is rendered once into an OfflineAudioContext.
 */
import { soundEnd } from "../../games/sounds/dsp.ts";

export interface PreviewEntry {
  id: string;
  preview: "synth" | "file" | "song" | "none";
  files: string[];
  song?: [number, string, Record<string, unknown>];
}

/* The parts of arcade.js's Sound object used here (plain JS, so typed loosely). */
interface ArcadeSound {
  ac: AudioContext | null;
  fx: AudioNode | null;
  muted: boolean;
  song: unknown;
  timer: number;
  lastSfx: Record<string, number>;
  ensure(): boolean;
  sfx(name: string, o?: unknown): void;
  fanfare(kind: string): void;
  roar(sad: boolean): void;
  voice(v: unknown, kind: string): void;
  play(song: unknown): void;
}
interface ArcadeGlobal {
  Sound: ArcadeSound;
  song(seed: number, style: string, o?: unknown): unknown;
}

function arcade(): ArcadeGlobal | null {
  return ((window as unknown as { Arcade?: ArcadeGlobal }).Arcade ?? null) as ArcadeGlobal | null;
}

let ctx: AudioContext | null = null;
let current: { stop(): void } | null = null;

/** One AudioContext for the page (arcade.js's own, so synth and files share it). */
export function audio(): AudioContext {
  const A = arcade();
  if (A) {
    A.Sound.muted = false; // the player's mute setting (localStorage) does not apply here
    A.Sound.ensure();
    if (A.Sound.ac) ctx = A.Sound.ac;
  }
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Stop whatever this page is playing. */
export function stop(): void {
  try {
    current?.stop();
  } catch {
    /* already stopped */
  }
  current = null;
  const A = arcade();
  if (A && A.Sound.song) {
    clearTimeout(A.Sound.timer);
    A.Sound.song = null;
  }
}

/** Which recorded format this browser plays: OGG (Opus) or M4A (Safari). */
function ext(): "ogg" | "m4a" {
  try {
    return document.createElement("audio").canPlayType('audio/ogg; codecs="opus"') ? "ogg" : "m4a";
  } catch {
    return "m4a";
  }
}

const cache = new Map<string, Promise<AudioBuffer>>();
/** Fetch and decode a sound file (cached). */
export function decodeUrl(url: string): Promise<AudioBuffer> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the sound (${r.status}).`);
        return r.arrayBuffer();
      })
      .then((ab) => audio().decodeAudioData(ab));
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** Play a decoded buffer (stops the last one). `gain` 0 to 2. */
export function playBuffer(buf: AudioBuffer, gain = 1, onEnd?: () => void): void {
  stop();
  const a = audio();
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g);
  g.connect(a.destination);
  src.onended = () => onEnd?.();
  src.start();
  current = { stop: () => src.stop() };
}

/** The recorded original's URL (the first variation). */
export function originalFileUrl(e: PreviewEntry): string | null {
  const stem = e.files[0];
  return stem ? `/play/_shared/audio/sfx/${stem}.${ext()}` : null;
}

const FANFARE_KIND: Record<string, string> = { fanfare_win: "win", fanfare_champion: "champion", fanfare_draw: "draw", fanfare_lose: "lose" };
const GRUNT_VOICE = { id: "pv", f0: 150, gain: 1 };

/** Make a synthesised sound on arcade.js's Sound object (whatever its ac/fx are right now). */
function synth(S: ArcadeSound, id: string): void {
  S.lastSfx = {};
  if (FANFARE_KIND[id]) S.fanfare(FANFARE_KIND[id]!);
  else if (id === "crowd_cheer" || id === "crowd_groan") S.roar(id === "crowd_groan");
  else if (id.startsWith("grunt_")) S.voice(GRUNT_VOICE, id.slice(6));
  else S.sfx(id);
}

/**
 * Play the original. Resolves with a short note for the page
 * ("Synthesised in the browser", ...) or rejects with a plain-English error.
 */
export async function playOriginal(e: PreviewEntry, gain = 1): Promise<string> {
  stop();
  const A = arcade();
  if (e.preview === "file") {
    const url = originalFileUrl(e);
    if (!url) throw new Error("This sound has no file.");
    playBuffer(await decodeUrl(url), gain);
    return "Recorded file";
  }
  if (e.preview === "synth") {
    if (!A) throw new Error("The game sound engine did not load.");
    audio();
    synth(A.Sound, e.id);
    return "Synthesised live, as in the game";
  }
  if (e.preview === "song" && e.song) {
    if (!A) throw new Error("The game sound engine did not load.");
    audio();
    A.Sound.song = null;
    A.Sound.play(A.song(e.song[0], e.song[1], e.song[2]));
    const s = A.Sound;
    const t = window.setTimeout(() => {
      clearTimeout(s.timer);
      s.song = null;
    }, 10000);
    current = {
      stop: () => {
        clearTimeout(t);
        clearTimeout(s.timer);
        s.song = null;
      },
    };
    return "The main theme, composed live (10 s)";
  }
  throw new Error("The game makes this one while you play (from what is happening). Open the game to hear it.");
}

/** Render a synthesised original into a buffer the editor can use. */
async function renderSynth(id: string): Promise<AudioBuffer> {
  const A = arcade();
  if (!A) throw new Error("The game sound engine did not load.");
  audio();
  const S = A.Sound;
  const rate = 44100;
  const secs = id.startsWith("fanfare_") ? 5 : id.startsWith("crowd_") ? 2.5 : 2;
  const off = new OfflineAudioContext(1, Math.round(rate * secs), rate);
  const keep = { ac: S.ac, fx: S.fx, last: S.lastSfx };
  const fx = off.createGain();
  fx.connect(off.destination);
  S.ac = off as unknown as AudioContext;
  S.fx = fx;
  try {
    synth(S, id);
  } finally {
    S.ac = keep.ac;
    S.fx = keep.fx;
    S.lastSfx = keep.last;
  }
  const full = await off.startRendering();
  // Keep just the sound (the render is a fixed length; most effects are far shorter).
  const ch = full.getChannelData(0);
  const end = Math.max(0.05, soundEnd([ch], rate));
  const out = audio().createBuffer(1, Math.max(1, Math.round(end * rate)), rate);
  out.copyToChannel(ch.subarray(0, out.length), 0);
  return out;
}

/** The original as a buffer, for the editor. */
export async function originalBuffer(e: PreviewEntry): Promise<AudioBuffer> {
  if (e.preview === "file") {
    const url = originalFileUrl(e);
    if (!url) throw new Error("This sound has no file.");
    return decodeUrl(url);
  }
  if (e.preview === "synth") return renderSynth(e.id);
  throw new Error(e.preview === "song" ? "The music is composed live, so it cannot be edited here. Upload or record a replacement instead." : "This sound is made by the game while you play, so it cannot be loaded here. Upload or record a replacement instead.");
}
