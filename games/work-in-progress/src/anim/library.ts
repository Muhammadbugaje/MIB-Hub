/**
 * The clip library: loads the clip packs (assets/anim/*.glb) once for the
 * whole game and hands out clips by id. Only the locomotion pack loads at
 * boot; the others (social, action, sports, vehicles, dance) load the first
 * time a clip from them is asked for, so the first playable stays light.
 *
 * Also: mirrored clips (left <-> right) made on demand, so a stop can start
 * on whichever foot is planted, and plan-name aliases.
 */
import { Clip, decodeClipPack, type ClipPack } from "./clip.ts";
import { BONE_COUNT, BONE_INDEX, MIB_BONES } from "./skeleton.ts";

export interface AnimIndex {
  version: number;
  refHipHeight: number;
  packs: Record<string, { file: string; bytes: number; clips: string[] }>;
  clips: Record<string, { pack: string; kind: string; duration: number; speed?: number; layer?: string; made?: boolean }>;
}

/** Plan clip names (§4.1) and mission names that are played by another clip. */
export const ALIASES: Record<string, string> = {
  hug: "hug_a", handshake: "handshake_a", run_start: "walk_start", turn_180: "run_pivot_180", jump_air: "fall_loop", land_run: "jump_run",
  celebrate: "victory", idle_tired: "walk_tired", idle_impatient: "idle_shift", idle_phone_check: "phone_text", carry_on_head: "carry_head_idle",
  eat_suya: "eat_stand", hit_react_light: "flinch", put_down: "pick_up", give: "handshake_a", receive: "handshake_b", wake_up: "stand_up_floor",
  guard_idle: "football_idle", stumble_fwd: "flinch", drop_down: "land_soft", sprint_skid_stop: "run_stop", car_enter: "sit_down",
  high_five: "handshake_a", phone_photo: "phone_text", bike_fall: "knock_down", dodge_L: "flinch", block: "flinch",
};

const MIRROR: Int16Array = (() => {
  const m = new Int16Array(BONE_COUNT);
  MIB_BONES.forEach(([n], i) => {
    const o = n.startsWith("Left") ? `Right${n.slice(4)}` : n.startsWith("Right") ? `Left${n.slice(5)}` : n;
    m[i] = BONE_INDEX[o] ?? i;
  });
  return m;
})();

/** Left/right mirror of a clip (reflection across the character's YZ plane). */
export function mirrorClip(c: Clip): Clip {
  const rot: (Int16Array | Float32Array | null)[] = new Array(BONE_COUNT).fill(null);
  for (let b = 0; b < BONE_COUNT; b++) {
    const k = c.rot[b];
    if (!k) continue;
    const o = k instanceof Float32Array ? new Float32Array(k.length) : new Int16Array(k.length);
    for (let i = 0; i < k.length; i += 4) {
      o[i] = k[i]!;
      o[i + 1] = -k[i + 1]!;
      o[i + 2] = -k[i + 2]!;
      o[i + 3] = k[i + 3]!;
    }
    rot[MIRROR[b]!] = o;
  }
  const hips = Float32Array.from(c.hips);
  for (let i = 0; i < hips.length; i += 3) hips[i] = -hips[i]!;
  let root: Float32Array | null = null;
  if (c.root) {
    root = Float32Array.from(c.root);
    for (let i = 0; i < root.length; i += 3) {
      root[i] = -root[i]!;
      root[i + 2] = -root[i + 2]!;
    }
  }
  const meta = { ...c.meta, id: `${c.meta.id}~m` };
  if (c.meta.contacts) meta.contacts = { L: c.meta.contacts.R, R: c.meta.contacts.L };
  if (c.meta.root) meta.root = { dx: -c.meta.root.dx, dz: c.meta.root.dz, dyaw: -c.meta.root.dyaw };
  if (c.meta.dir) meta.dir = [-c.meta.dir[0], c.meta.dir[1]];
  if (c.meta.events) meta.events = c.meta.events.map((e) => ({ t: e.t, name: e.name === "fs_L" ? "fs_R" : e.name === "fs_R" ? "fs_L" : e.name }));
  return new Clip(meta, c.fps, c.frames, rot, hips, root);
}

export class AnimLibrary {
  readonly clips = new Map<string, Clip>();
  private loading = new Map<string, Promise<void>>();
  rest: ClipPack["rest"] | null = null;
  refHipHeight = 1.043;

  constructor(readonly index: AnimIndex | null = null, private fetchPack: ((file: string) => Promise<ArrayBuffer>) | null = null) {
    if (index) this.refHipHeight = index.refHipHeight;
  }

  /** Tests and tools: a library from decoded packs. */
  static fromPacks(packs: ClipPack[]): AnimLibrary {
    const lib = new AnimLibrary();
    for (const p of packs) lib.add(p);
    return lib;
  }

  add(p: ClipPack): void {
    this.rest ??= p.rest;
    if (typeof p.extras.refHipHeight === "number") this.refHipHeight = p.extras.refHipHeight;
    for (const c of p.clips) this.clips.set(c.id, c);
  }

  /** Load a pack by name (once). */
  loadPack(name: string): Promise<void> {
    let p = this.loading.get(name);
    if (p) return p;
    const info = this.index?.packs[name];
    if (!info || !this.fetchPack) return Promise.resolve();
    p = this.fetchPack(info.file).then((buf) => this.add(decodeClipPack(buf)));
    this.loading.set(name, p);
    return p;
  }

  /** Resolve a name (alias or "~m" mirror) to a loaded clip, or null (and start loading its pack). */
  get(id: string): Clip | null {
    const mirrored = id.endsWith("~m");
    const base = mirrored ? id.slice(0, -2) : id;
    const real = this.clips.has(base) ? base : ALIASES[base] ?? base;
    if (mirrored) {
      const m = this.clips.get(`${real}~m`);
      if (m) return m;
      const c = this.clips.get(real);
      if (!c) {
        this.request(real);
        return null;
      }
      const mc = mirrorClip(c);
      this.clips.set(`${real}~m`, mc);
      return mc;
    }
    const c = this.clips.get(real);
    if (!c) this.request(real);
    return c ?? null;
  }

  has(id: string): boolean {
    const real = this.clips.has(id) ? id : ALIASES[id] ?? id;
    return !!this.index?.clips[real] || this.clips.has(real);
  }

  /** Ask for a clip's pack to load (fire and forget). */
  request(id: string): void {
    const real = ALIASES[id] ?? id;
    const pack = this.index?.clips[real]?.pack;
    if (pack) void this.loadPack(pack);
  }

  /** Wait until a clip is available (cutscenes preload their clips). */
  async ensure(ids: string[]): Promise<void> {
    const packs = new Set<string>();
    for (const id of ids) {
      const real = ALIASES[id] ?? id;
      const pack = this.index?.clips[real]?.pack;
      if (pack) packs.add(pack);
    }
    await Promise.all([...packs].map((p) => this.loadPack(p)));
  }
}
