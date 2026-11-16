/**
 * Animation clips on mib_rig, and the clip-pack file format.
 *
 * A clip pack is an ordinary glTF 2.0 binary (.glb): the mib_rig skeleton as
 * nodes (so any glTF viewer can play it) and one glTF animation per clip.
 * Rotations are stored as normalised 16-bit integers (allowed by the core
 * glTF spec for animation outputs), sampled at a fixed 30 fps; bones that do
 * not move in a clip get a single key. Each animation's `extras` carry what
 * the game needs to play it well: loop or one-shot, measured stride speed,
 * the left-foot plant phase (to keep gaits in step when blending), foot
 * contact windows (foot locking, footstep sounds), events, root motion.
 *
 * Root motion lives on the `Root` node (translation x/z and yaw); in-place
 * loops have none, and their hips keep only the natural sway.
 *
 * The same code encodes (asset tools, Node) and decodes (game and tests).
 */
import { nlerpInto, yawOf } from "./math.ts";
import { B, BONE_COUNT, BONE_INDEX, MIB_BONES, type Pose } from "./skeleton.ts";

export type ClipKind = "loop" | "once" | "pose";

export interface ClipEvent { t: number; name: string }

export interface ClipMeta {
  /** Our clip id (plan §4.1 names), e.g. "walk_fwd". */
  id: string;
  /** Which pack the clip ships in (locomotion, social, sports, vehicles, dance). */
  pack: string;
  kind: ClipKind;
  /** Where it came from: the Mixamo file name, or "made:<recipe>" for clips we built. */
  src: string;
  /** Forward ground speed of a locomotion loop at the reference scale (m/s), measured from root travel. */
  speed?: number;
  /** Ground velocity direction for loops: [x, z] unit, character frame (+z forward). */
  dir?: [number, number];
  /** Phase 0..1 at which the left foot plants (gait sync). */
  syncL?: number;
  /** Foot contact windows as phases [start, end] (end may be < start when it wraps). */
  contacts?: { L: [number, number][]; R: [number, number][] };
  events?: ClipEvent[];
  /** Total root travel of a root-motion clip: [x, z] metres (reference scale) and yaw radians. */
  root?: { dx: number; dz: number; dyaw: number };
  /** Default body mask when this clip plays on the upper-body layer. */
  layer?: "full" | "upper" | "arms" | "head";
  /** Time window [a, b] of a held loop inside a once clip (e.g. a sit that holds its seated part). */
  hold?: [number, number];
  notes?: string;
}

export class Clip {
  readonly meta: ClipMeta;
  readonly fps: number;
  readonly frames: number;
  /** Seconds from the first to the last key. A loop's period (its last key repeats the first). */
  readonly duration: number;
  /** Per bone: frames x 4 normalised int16 (animated), or a single float quaternion (static), or null (not keyed). */
  readonly rot: (Int16Array | Float32Array | null)[];
  /** Hips translation per frame (metres, relative to Root), frames x 3, or one key. */
  readonly hips: Float32Array;
  /** Root motion per frame: [x, z, yaw] cumulative from frame 0, or null. */
  readonly root: Float32Array | null;

  constructor(meta: ClipMeta, fps: number, frames: number, rot: (Int16Array | Float32Array | null)[], hips: Float32Array, root: Float32Array | null) {
    this.meta = meta;
    this.fps = fps;
    this.frames = frames;
    this.duration = Math.max(1e-3, (frames - 1) / fps);
    this.rot = rot;
    this.hips = hips;
    this.root = root;
  }

  get id(): string {
    return this.meta.id;
  }

  get loop(): boolean {
    return this.meta.kind === "loop";
  }

  /** Frame position for a time: loops wrap, one-shots clamp. */
  frameAt(t: number): { i0: number; i1: number; f: number } {
    const u = this.loop ? ((t % this.duration) + this.duration) % this.duration : Math.max(0, Math.min(this.duration, t));
    const x = u * this.fps;
    const i0 = Math.min(this.frames - 1, Math.floor(x));
    const i1 = Math.min(this.frames - 1, i0 + 1);
    return { i0, i1, f: x - i0 };
  }

  /**
   * Sample into a pose at time t. With a mask, each bone's weight lerps from
   * what is already in `out` towards the clip (weight 1 = replace).
   */
  sample(t: number, out: Pose, weight = 1, mask?: Float32Array, skipFingers = false): void {
    const { i0, i1, f } = this.frameAt(t);
    const tmp = TMP4;
    for (let b = 0; b < BONE_COUNT; b++) {
      if (skipFingers && FINGER[b]) continue;
      const w = mask ? mask[b]! * weight : weight;
      if (w <= 0) continue;
      const k = this.rot[b];
      if (!k) continue;
      if (k instanceof Float32Array) {
        tmp[0] = k[0]!; tmp[1] = k[1]!; tmp[2] = k[2]!; tmp[3] = k[3]!;
      } else {
        const a = i0 * 4, c = i1 * 4, s = 1 / 32767;
        let x1 = k[c]! * s, y1 = k[c + 1]! * s, z1 = k[c + 2]! * s, w1 = k[c + 3]! * s;
        const x0 = k[a]! * s, y0 = k[a + 1]! * s, z0 = k[a + 2]! * s, w0 = k[a + 3]! * s;
        if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) {
          x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1;
        }
        const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, z = z0 + (z1 - z0) * f, ww = w0 + (w1 - w0) * f;
        const l = Math.hypot(x, y, z, ww) || 1;
        tmp[0] = x / l; tmp[1] = y / l; tmp[2] = z / l; tmp[3] = ww / l;
      }
      if (w >= 0.9999) {
        out.rot[b * 4] = tmp[0]!; out.rot[b * 4 + 1] = tmp[1]!; out.rot[b * 4 + 2] = tmp[2]!; out.rot[b * 4 + 3] = tmp[3]!;
      } else nlerpInto(out.rot, b * 4, tmp, 0, w);
    }
    const hw = mask ? mask[B.Hips]! * weight : weight;
    if (hw > 0) {
      const h = this.hips;
      const n = h.length / 3;
      const a = Math.min(n - 1, i0) * 3, c = Math.min(n - 1, i1) * 3;
      for (let j = 0; j < 3; j++) {
        const v = h[a + j]! + (h[c + j]! - h[a + j]!) * f;
        out.hips[j] = hw >= 0.9999 ? v : out.hips[j]! + (v - out.hips[j]!) * hw;
      }
    }
  }

  /** Root motion at time t (clamped; one-shots only): [x, z, yaw] from the start. */
  rootAt(t: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    const r = this.root;
    if (!r) {
      out[0] = out[1] = out[2] = 0;
      return out;
    }
    const u = Math.max(0, Math.min(this.duration, t)) * this.fps;
    const i0 = Math.min(this.frames - 1, Math.floor(u)), i1 = Math.min(this.frames - 1, i0 + 1), f = u - i0;
    out[0] = r[i0 * 3]! + (r[i1 * 3]! - r[i0 * 3]!) * f;
    out[1] = r[i0 * 3 + 1]! + (r[i1 * 3 + 1]! - r[i0 * 3 + 1]!) * f;
    out[2] = r[i0 * 3 + 2]! + (r[i1 * 3 + 2]! - r[i0 * 3 + 2]!) * f;
    return out;
  }

  /** Normalised phase (0..1) of time t for a loop, measured from the left-foot plant. */
  phaseAt(t: number): number {
    const p = t / this.duration - (this.meta.syncL ?? 0);
    return ((p % 1) + 1) % 1;
  }

  /** Time for a normalised phase (inverse of phaseAt). */
  timeAtPhase(ph: number): number {
    const p = (((ph + (this.meta.syncL ?? 0)) % 1) + 1) % 1;
    return p * this.duration;
  }

  /** Is a foot planted at time t (from the measured contact windows)? */
  planted(t: number, foot: "L" | "R"): boolean {
    const c = this.meta.contacts?.[foot];
    if (!c) return false;
    const p = this.loop ? (((t / this.duration) % 1) + 1) % 1 : Math.max(0, Math.min(1, t / this.duration));
    return c.some(([a, b]) => (a <= b ? p >= a && p <= b : p >= a || p <= b));
  }
}

const TMP4 = new Float32Array(4);
const FINGER = (() => {
  const m = new Uint8Array(BONE_COUNT);
  MIB_BONES.forEach(([n], i) => {
    if (/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n)) m[i] = 1;
  });
  return m;
})();
export const IS_FINGER: Readonly<Uint8Array> = FINGER;

/* ------------------------------------------------------------------ GLB codec */

interface GJson {
  asset: { version: string; generator: string; extras?: Record<string, unknown> };
  scene: number;
  scenes: { nodes: number[] }[];
  nodes: { name: string; children?: number[]; rotation?: number[]; translation?: number[] }[];
  animations: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number; interpolation: string }[]; extras?: unknown }[];
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean; min?: number[]; max?: number[] }[];
  bufferViews: { buffer: number; byteOffset: number; byteLength: number }[];
  buffers: { byteLength: number }[];
}

export interface RigRest {
  rot: Float32Array;
  pos: Float32Array;
}

/** Everything a clip pack holds. */
export interface ClipPack {
  name: string;
  rest: RigRest;
  clips: Clip[];
  extras: Record<string, unknown>;
}

/** Build a .glb clip pack (asset tools). */
export function encodeClipPack(pack: ClipPack): Uint8Array {
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const views: GJson["bufferViews"] = [];
  const accessors: GJson["accessors"] = [];
  const push = (data: ArrayBufferView): number => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(new Uint8Array(pad));
      offset += pad;
    }
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength });
    chunks.push(bytes.slice());
    offset += bytes.byteLength;
    return views.length - 1;
  };
  const acc = (data: Float32Array | Int16Array, type: string, count: number, normalized = false, minmax = false): number => {
    const bv = push(data);
    const a: GJson["accessors"][number] = { bufferView: bv, componentType: data instanceof Float32Array ? 5126 : 5122, count, type };
    if (normalized) a.normalized = true;
    if (minmax) {
      a.min = [Math.min(...data)];
      a.max = [Math.max(...data)];
    }
    accessors.push(a);
    return accessors.length - 1;
  };
  const timeAcc = new Map<number, number>();
  const times = (frames: number, fps: number): number => {
    const k = frames * 1000 + fps;
    let a = timeAcc.get(k);
    if (a === undefined) {
      const t = new Float32Array(frames);
      for (let i = 0; i < frames; i++) t[i] = i / fps;
      a = acc(t, "SCALAR", frames, false, true);
      timeAcc.set(k, a);
    }
    return a;
  };
  const nodes: GJson["nodes"] = MIB_BONES.map(([name], i) => ({
    name,
    rotation: Array.from(pack.rest.rot.subarray(i * 4, i * 4 + 4)).map((v) => +v.toFixed(7)),
    translation: Array.from(pack.rest.pos.subarray(i * 3, i * 3 + 3)).map((v) => +v.toFixed(6)),
  }));
  MIB_BONES.forEach(([, p], i) => {
    if (!p) return;
    const pn = nodes[BONE_INDEX[p]!]!;
    (pn.children ??= []).push(i);
  });
  const animations: GJson["animations"] = [];
  for (const c of pack.clips) {
    const ch: GJson["animations"][number]["channels"] = [];
    const sm: GJson["animations"][number]["samplers"] = [];
    const add = (node: number, path: string, out: number, keys: number) => {
      sm.push({ input: times(keys, c.fps), output: out, interpolation: "LINEAR" });
      ch.push({ sampler: sm.length - 1, target: { node, path } });
    };
    c.rot.forEach((k, b) => {
      if (!k) return;
      if (k instanceof Float32Array) add(b, "rotation", acc(k, "VEC4", 1), 1);
      else add(b, "rotation", acc(k, "VEC4", c.frames, true), c.frames);
    });
    const hk = c.hips.length / 3;
    add(B.Hips, "translation", acc(c.hips, "VEC3", hk), hk);
    if (c.root) {
      const tr = new Float32Array(c.frames * 3), rq = new Int16Array(c.frames * 4);
      for (let i = 0; i < c.frames; i++) {
        tr[i * 3] = c.root[i * 3]!;
        tr[i * 3 + 2] = c.root[i * 3 + 1]!;
        const y = c.root[i * 3 + 2]!;
        rq[i * 4 + 1] = Math.round(Math.sin(y / 2) * 32767);
        rq[i * 4 + 3] = Math.round(Math.cos(y / 2) * 32767);
      }
      add(B.Root, "translation", acc(tr, "VEC3", c.frames), c.frames);
      add(B.Root, "rotation", acc(rq, "VEC4", c.frames, true), c.frames);
    }
    animations.push({ name: c.meta.id, channels: ch, samplers: sm, extras: { ...c.meta, fps: c.fps } });
  }
  const binLen = offset + ((4 - (offset % 4)) % 4);
  const json: GJson = {
    asset: { version: "2.0", generator: "MIB-Hub WIP anim pipeline (tools/anim)", extras: { mib_rig: 1, pack: pack.name, ...pack.extras } },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    animations,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: binLen }],
  };
  const enc = new TextEncoder();
  let jb = enc.encode(JSON.stringify(json));
  const jpad = (4 - (jb.length % 4)) % 4;
  if (jpad) {
    const p = new Uint8Array(jb.length + jpad);
    p.set(jb);
    p.fill(0x20, jb.length);
    jb = p;
  }
  const total = 12 + 8 + jb.length + 8 + binLen;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jb.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jb, 20);
  const bo = 20 + jb.length;
  dv.setUint32(bo, binLen, true);
  dv.setUint32(bo + 4, 0x004e4942, true);
  let o = bo + 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Read a clip pack (game and tests). */
export function decodeClipPack(buf: ArrayBuffer | Uint8Array): ClipPack {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("not a GLB");
  const jlen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jlen))) as GJson;
  const binStart = 20 + jlen + 8;
  const bin = u8.subarray(binStart, binStart + dv.getUint32(20 + jlen, true));
  const read = (ai: number): Float32Array | Int16Array => {
    const a = json.accessors[ai]!;
    const v = json.bufferViews[a.bufferView]!;
    const comps = a.type === "SCALAR" ? 1 : a.type === "VEC3" ? 3 : 4;
    const n = a.count * comps;
    const start = bin.byteOffset + v.byteOffset + (a.byteOffset ?? 0);
    const copy = bin.buffer.slice(start, start + n * (a.componentType === 5126 ? 4 : 2));
    return a.componentType === 5126 ? new Float32Array(copy) : new Int16Array(copy);
  };
  // Map the file's nodes onto mib_rig indices by name (order-independent).
  const nodeBone = json.nodes.map((n) => BONE_INDEX[n.name] ?? -1);
  const rest: RigRest = { rot: new Float32Array(BONE_COUNT * 4), pos: new Float32Array(BONE_COUNT * 3) };
  for (let b = 0; b < BONE_COUNT; b++) rest.rot[b * 4 + 3] = 1;
  json.nodes.forEach((n, i) => {
    const b = nodeBone[i]!;
    if (b < 0) return;
    if (n.rotation) rest.rot.set(n.rotation, b * 4);
    if (n.translation) rest.pos.set(n.translation, b * 3);
  });
  const clips: Clip[] = [];
  for (const an of json.animations ?? []) {
    const meta = an.extras as ClipMeta & { fps: number };
    const fps = meta.fps ?? 30;
    let frames = 1;
    for (const s of an.samplers) frames = Math.max(frames, json.accessors[s.input]!.count);
    const rot: (Int16Array | Float32Array | null)[] = new Array(BONE_COUNT).fill(null);
    let hips: Float32Array = new Float32Array([rest.pos[B.Hips * 3]!, rest.pos[B.Hips * 3 + 1]!, rest.pos[B.Hips * 3 + 2]!]);
    let rootT: Float32Array | null = null, rootR: Int16Array | Float32Array | null = null;
    for (const ch of an.channels) {
      const b = nodeBone[ch.target.node]!;
      if (b < 0) continue;
      const data = read(an.samplers[ch.sampler]!.output);
      if (b === B.Root) {
        if (ch.target.path === "translation") rootT = data as Float32Array;
        else if (ch.target.path === "rotation") rootR = data;
        continue;
      }
      if (ch.target.path === "rotation") rot[b] = data;
      else if (ch.target.path === "translation" && b === B.Hips) hips = data as Float32Array;
    }
    let root: Float32Array | null = null;
    if (rootT && rootR) {
      const n = rootT.length / 3;
      root = new Float32Array(n * 3);
      const q = new Float32Array(4);
      const s = rootR instanceof Int16Array ? 1 / 32767 : 1;
      for (let i = 0; i < n; i++) {
        root[i * 3] = rootT[i * 3]!;
        root[i * 3 + 1] = rootT[i * 3 + 2]!;
        for (let j = 0; j < 4; j++) q[j] = rootR[i * 4 + j]! * s;
        root[i * 3 + 2] = yawOf(q);
      }
      // Unwrap the yaw so turns past 180 degrees accumulate.
      for (let i = 1; i < n; i++) {
        let d = root[i * 3 + 2]! - root[(i - 1) * 3 + 2]!;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        root[i * 3 + 2] = root[(i - 1) * 3 + 2]! + d;
      }
    }
    const { fps: _f, ...m } = meta;
    clips.push(new Clip(m, fps, frames, rot, hips, root));
  }
  const ex = (json.asset.extras ?? {}) as Record<string, unknown>;
  return { name: String(ex.pack ?? "pack"), rest, clips, extras: ex };
}
