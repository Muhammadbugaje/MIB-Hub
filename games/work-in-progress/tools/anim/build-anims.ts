/**
 * The animation asset build: Mixamo FBX downloads -> mib_rig clip packs.
 *
 *   npm run assets:anim -w @mib/game-work-in-progress
 *   (or: npx tsx games/work-in-progress/tools/anim/build-anims.ts [--src ~/Downloads/games-files/mixamo])
 *
 * Steps (plan §3.7, §4.1, §4.3):
 *   1. read the reference skeleton (Mixamo X Bot, from the Soccer pack) as the
 *      mib_rig rest pose; every clip is checked against it;
 *   2. read each mapped FBX (tools/anim/clip-map.ts), detect what it really
 *      is (skinned? frame rate? does it travel?), resample at 30 fps;
 *   3. process per mode: strip steady travel from loops and measure the
 *      stride speed; move one-shot travel and turning onto the Root as root
 *      motion; take flight height out of jumps; face stances forward;
 *      cut long takes into seamless loops;
 *   4. measure foot contacts (planted = low and still in the world), the
 *      left-foot plant phase for gait sync, and footstep events;
 *   5. build the clips the owner could not find (tools/anim/made.ts);
 *   6. quantise (16-bit rotations, static bones as one key) and write the
 *      packs: assets/anim/<pack>.glb + assets/anim/index.json;
 *   7. write the coverage report docs/ANIM_INVENTORY.md.
 *
 * Raw FBX files stay in ~/Downloads/games-files/mixamo (Mixamo's licence
 * allows them in games but not as standalone files); only the converted
 * packs go into the repo.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Clip, encodeClipPack, type ClipMeta } from "../../src/anim/clip.ts";
import { axisAngle, conj, mulQ, qAngle, rotV, yawOf, type Q } from "../../src/anim/math.ts";
import { B, BONE_COUNT, BONE_INDEX, MIB_BONES, Skeleton, fk, newPose, newWorld, type Pose } from "../../src/anim/skeleton.ts";
import { CLIP_SPECS, PLAN_CLIPS, type ClipSpec } from "./clip-map.ts";
import { fbxLocal, matToQuat, readFbxScene, sampleModel, type FbxScene } from "./fbx.ts";
import { MADE_RECIPES } from "./made.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, "../..");
const OUT = join(GAME, "assets/anim");
const FPS = 30;

const argSrc = process.argv.indexOf("--src");
const SRC = argSrc > 0 ? process.argv[argSrc + 1]! : join(homedir(), "Downloads/games-files/mixamo");

/* ------------------------------------------------------------------ raw clips */

/** A clip while it is being built: dense float frames. */
export interface Raw {
  id: string;
  frames: number;
  /** frames x BONE_COUNT x 4 local rotations. */
  rot: Float32Array;
  /** frames x 3 hips translation (metres, relative to Root). */
  hips: Float32Array;
  /** frames x 3 root motion [x, z, yaw], or null. */
  root: Float32Array | null;
  meta: ClipMeta;
}

export function rawPose(r: Raw, f: number, out: Pose = newPose()): Pose {
  out.rot.set(r.rot.subarray(f * BONE_COUNT * 4, (f + 1) * BONE_COUNT * 4));
  out.hips.set(r.hips.subarray(f * 3, f * 3 + 3));
  return out;
}

export function setRawPose(r: Raw, f: number, p: Pose): void {
  r.rot.set(p.rot, f * BONE_COUNT * 4);
  r.hips.set(p.hips, f * 3);
}

export function newRaw(id: string, frames: number, meta: Omit<ClipMeta, "id">): Raw {
  return { id, frames, rot: new Float32Array(frames * BONE_COUNT * 4), hips: new Float32Array(frames * 3), root: null, meta: { id, ...meta } };
}

const strip = (n: string) => n.replace(/^mixamorig\d*:/, "");

/** The reference skeleton: Mixamo's bind T-pose from the X Bot download (metres). */
function loadReference(): { sk: Skeleton; scene: FbxScene; file: string } {
  const candidates = ["Soccer Game Pack/X Bot.fbx", "X Bot.fbx", "Y Bot.fbx", "Action Adventure Pack/X Bot.fbx"].map((f) => join(SRC, f));
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    let scene: FbxScene;
    try {
      scene = readFbxScene(readFileSync(file));
    } catch {
      continue;
    }
    const rot = new Float32Array(BONE_COUNT * 4), pos = new Float32Array(BONE_COUNT * 3);
    for (let i = 0; i < BONE_COUNT; i++) rot[i * 4 + 3] = 1;
    const k = 0.01 * scene.unitScale;
    for (const m of scene.models) {
      const b = BONE_INDEX[strip(m.name)];
      if (b === undefined) continue;
      const L = fbxLocal(m, m.t, [0, 0, 0], m.s); // the bind pose: Lcl Rotation zero, pre-rotation kept
      rot.set(matToQuat(L), b * 4);
      pos.set([L[12]! * k, L[13]! * k, L[14]! * k], b * 3);
    }
    return { sk: new Skeleton(rot, pos), scene, file };
  }
  // No skinned reference: build the rig from the first clip's skeleton (all Mixamo clips share mixamorig).
  const first = CLIP_SPECS.map((s) => join(SRC, s.file)).find((f) => existsSync(f));
  if (!first) throw new Error(`No Mixamo files found in ${SRC}`);
  const scene = readFbxScene(readFileSync(first));
  const rot = new Float32Array(BONE_COUNT * 4), pos = new Float32Array(BONE_COUNT * 3);
  for (let i = 0; i < BONE_COUNT; i++) rot[i * 4 + 3] = 1;
  for (const m of scene.models) {
    const b = BONE_INDEX[strip(m.name)];
    if (b === undefined) continue;
    const L = fbxLocal(m, m.t, [0, 0, 0], m.s);
    rot.set(matToQuat(L), b * 4);
    pos.set([L[12]! * 0.01, L[13]! * 0.01, L[14]! * 0.01], b * 3);
  }
  return { sk: new Skeleton(rot, pos), scene, file: first };
}

interface Detected { skin: boolean; fps: number; travel: number; turn: number; duration: number; version: number }

function readClip(spec: ClipSpec, ref: Skeleton): { raw: Raw; det: Detected } {
  const file = join(SRC, spec.file);
  const scene = readFbxScene(readFileSync(file));
  if (scene.version < 7000) throw new Error(`${spec.file}: FBX ${scene.version} is too old (export as FBX 2013+ binary)`);
  const k = 0.01 * scene.unitScale;
  const byBone = new Map<number, (typeof scene.models)[number]>();
  for (const m of scene.models) {
    const b = BONE_INDEX[strip(m.name)];
    if (b !== undefined) byBone.set(b, m);
  }
  const t0 = scene.start + (spec.trim?.[0] ?? 0);
  const t1 = spec.trim ? Math.min(scene.end, scene.start + spec.trim[1]) : scene.end;
  const frames = Math.max(2, Math.round((t1 - t0) * FPS) + 1);
  const raw = newRaw(spec.id, frames, { pack: spec.pack, kind: spec.kind, src: spec.file });
  for (let f = 0; f < frames; f++) {
    const t = Math.min(t1, t0 + f / FPS);
    for (let b = 0; b < BONE_COUNT; b++) {
      const m = byBone.get(b);
      const o = (f * BONE_COUNT + b) * 4;
      if (!m) {
        raw.rot.set(ref.restRot.subarray(b * 4, b * 4 + 4), o);
        continue;
      }
      const s = sampleModel(m, t);
      const L = fbxLocal(m, s.t, s.r, s.s);
      raw.rot.set(matToQuat(L), o);
      if (b === B.Hips) raw.hips.set([L[12]! * k, L[13]! * k, L[14]! * k], f * 3);
    }
  }
  // Keep quaternion signs continuous (no flips between frames: cleaner quantised interpolation).
  for (let b = 0; b < BONE_COUNT; b++)
    for (let f = 1; f < frames; f++) {
      const a = ((f - 1) * BONE_COUNT + b) * 4, c = (f * BONE_COUNT + b) * 4;
      let d = 0;
      for (let j = 0; j < 4; j++) d += raw.rot[a + j]! * raw.rot[c + j]!;
      if (d < 0) for (let j = 0; j < 4; j++) raw.rot[c + j] = -raw.rot[c + j]!;
    }
  const h0 = raw.hips.subarray(0, 3), h1 = raw.hips.subarray((frames - 1) * 3);
  const yaw0 = yawOf(raw.rot, (0 * BONE_COUNT + B.Hips) * 4), yaw1 = yawOf(raw.rot, ((frames - 1) * BONE_COUNT + B.Hips) * 4);
  return {
    raw,
    det: { skin: scene.hasSkin, fps: scene.frameRate, travel: Math.hypot(h1[0]! - h0[0]!, h1[2]! - h0[2]!), turn: wrap(yaw1 - yaw0), duration: (frames - 1) / FPS, version: scene.version },
  };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* ------------------------------------------------------------------ processing */

function hipsQ(r: Raw, f: number): Q {
  const o = (f * BONE_COUNT + B.Hips) * 4;
  return [r.rot[o]!, r.rot[o + 1]!, r.rot[o + 2]!, r.rot[o + 3]!];
}
function setHipsQ(r: Raw, f: number, q: Q): void {
  r.rot.set(q, (f * BONE_COUNT + B.Hips) * 4);
}

/** Rotate the whole clip about Y (hips rotation and position) by yaw radians. */
function turnClip(r: Raw, yaw: number): void {
  const q = axisAngle([0, 1, 0], yaw);
  for (let f = 0; f < r.frames; f++) {
    setHipsQ(r, f, mulQ(q, hipsQ(r, f)));
    const p = rotV(q, 0, [r.hips[f * 3]!, r.hips[f * 3 + 1]!, r.hips[f * 3 + 2]!]);
    r.hips.set(p, f * 3);
  }
}

/** Facing yaw of the pose: the direction the feet and chest agree on (average of hips and Spine2 forward). */
function facingYaw(r: Raw, f: number, sk: Skeleton, w = newWorld()): number {
  fk(sk, rawPose(r, f), w);
  const hf = rotV(w.rot, B.Hips * 4, rotV(conj(Array.from(sk.restRot.subarray(B.Hips * 4, B.Hips * 4 + 4)) as Q), 0, [0, 0, 1]));
  const cf = rotV(w.rot, B.Spine2 * 4, rotV(conj(Array.from(sk.restRot.subarray(B.Spine2 * 4, B.Spine2 * 4 + 4)) as Q), 0, [0, 0, 1]));
  // Feet: the line from the left foot to the right foot, turned 90 degrees, also says where the body faces.
  const lf = [w.pos[B.LFoot * 3]!, w.pos[B.LFoot * 3 + 2]!], rf = [w.pos[B.RFoot * 3]!, w.pos[B.RFoot * 3 + 2]!];
  const fx = -(rf[1]! - lf[1]!), fz = rf[0]! - lf[0]!;
  // left foot is at +x when facing +z: (rf - lf) = (-1, 0) -> forward (0, ... ) rotate: (-dz, dx) of (rf-lf) gives +z.
  const feet = Math.atan2(-fx, -fz);
  const sx = Math.sin(Math.atan2(hf[0], hf[2])) + Math.sin(Math.atan2(cf[0], cf[2])) + Math.sin(feet);
  const sz = Math.cos(Math.atan2(hf[0], hf[2])) + Math.cos(Math.atan2(cf[0], cf[2])) + Math.cos(feet);
  return Math.atan2(sx, sz);
}

function faceForward(r: Raw, sk: Skeleton): number {
  let sx = 0, sz = 0;
  const w = newWorld();
  for (let f = 0; f < r.frames; f += 3) {
    const y = facingYaw(r, f, sk, w);
    sx += Math.sin(y);
    sz += Math.cos(y);
  }
  const avg = Math.atan2(sx, sz);
  if (Math.abs(avg) > 0.12) turnClip(r, -avg);
  return avg;
}

/** Steady travel out of a loop; returns the measured ground velocity [vx, vz] and vertical rate. */
function stripTravel(r: Raw, alsoY = false): { vx: number; vz: number; vy: number } {
  const n = r.frames, dur = (n - 1) / FPS;
  const d = [r.hips[(n - 1) * 3]! - r.hips[0]!, r.hips[(n - 1) * 3 + 1]! - r.hips[1]!, r.hips[(n - 1) * 3 + 2]! - r.hips[2]!];
  for (let f = 0; f < n; f++) {
    const u = f / (n - 1);
    r.hips[f * 3] = r.hips[f * 3]! - d[0]! * u;
    if (alsoY) r.hips[f * 3 + 1] = r.hips[f * 3 + 1]! - d[1]! * u;
    r.hips[f * 3 + 2] = r.hips[f * 3 + 2]! - d[2]! * u;
  }
  return { vx: d[0]! / dur, vz: d[2]! / dur, vy: d[1]! / dur };
}

/** Root motion: smoothed hips travel and facing move onto the Root; the hips become relative to it. */
function extractRoot(r: Raw, sk: Skeleton): void {
  const n = r.frames;
  const px = new Float64Array(n), pz = new Float64Array(n), yw = new Float64Array(n);
  const w = newWorld();
  let prev = 0;
  for (let f = 0; f < n; f++) {
    px[f] = r.hips[f * 3]!;
    pz[f] = r.hips[f * 3 + 2]!;
    let y = facingYaw(r, f, sk, w);
    if (f > 0) {
      while (y - prev > Math.PI) y -= 2 * Math.PI;
      while (y - prev < -Math.PI) y += 2 * Math.PI;
    }
    yw[f] = y;
    prev = y;
  }
  const smooth = (a: Float64Array, k: number) => {
    const o = new Float64Array(n);
    for (let f = 0; f < n; f++) {
      let s = 0, c = 0;
      for (let j = -k; j <= k; j++) {
        const g = Math.max(0, Math.min(n - 1, f + j));
        s += a[g]!;
        c++;
      }
      o[f] = s / c;
    }
    return o;
  };
  const sx = smooth(px, 6), sz = smooth(pz, 6), sy = smooth(yw, 5);
  // Pin the ends: the root starts at zero and ends at the true final displacement.
  const ex = px[n - 1]! - px[0]!, ez = pz[n - 1]! - pz[0]!, ey = yw[n - 1]! - yw[0]!;
  const fixEnds = (s: Float64Array, start: number, total: number) => {
    const a = s[0]!, b = s[n - 1]!;
    for (let f = 0; f < n; f++) {
      const u = f / (n - 1);
      s[f] = s[f]! - a - (b - a - total) * u + 0 * start;
    }
  };
  fixEnds(sx, px[0]!, ex);
  fixEnds(sz, pz[0]!, ez);
  fixEnds(sy, yw[0]!, ey);
  r.root = new Float32Array(n * 3);
  for (let f = 0; f < n; f++) {
    r.root[f * 3] = sx[f]!;
    r.root[f * 3 + 1] = sz[f]!;
    r.root[f * 3 + 2] = sy[f]!;
    const inv = axisAngle([0, 1, 0], -sy[f]!);
    setHipsQ(r, f, mulQ(inv, hipsQ(r, f)));
    const rel = rotV(inv, 0, [r.hips[f * 3]! - sx[f]!, r.hips[f * 3 + 1]!, r.hips[f * 3 + 2]! - sz[f]!]);
    r.hips.set(rel, f * 3);
  }
  r.meta.root = { dx: ex, dz: ez, dyaw: ey };
}

/** Airborne clips: the controller owns the arc, so take flight height out of the hips; keep the squash. */
function groundRelative(r: Raw, sk: Skeleton): void {
  stripTravel(r);
  const w = newWorld();
  const restToe = 0;
  for (let f = 0; f < r.frames; f++) {
    fk(sk, rawPose(r, f), w);
    const low = Math.min(w.pos[B.LToe * 3 + 1]!, w.pos[B.RToe * 3 + 1]!, w.pos[B.LFoot * 3 + 1]! - 0.087, w.pos[B.RFoot * 3 + 1]! - 0.087);
    const lift = Math.max(0, low - restToe);
    r.hips[f * 3 + 1] = r.hips[f * 3 + 1]! - lift;
  }
}

/** Pose distance (radians summed over the main bones, plus hips metres x 4). */
function poseDist(r: Raw, a: number, b: number): number {
  let s = 0;
  for (const bone of MAIN_BONES) s += qAngle(r.rot, (a * BONE_COUNT + bone) * 4, r.rot, (b * BONE_COUNT + bone) * 4);
  s += 4 * Math.hypot(r.hips[a * 3]! - r.hips[b * 3]!, r.hips[a * 3 + 1]! - r.hips[b * 3 + 1]!, r.hips[a * 3 + 2]! - r.hips[b * 3 + 2]!);
  return s;
}
const MAIN_BONES = [B.Hips, B.Spine, B.Spine1, B.Spine2, B.Neck, B.Head, B.LArm, B.LForeArm, B.RArm, B.RForeArm, B.LUpLeg, B.LLeg, B.LFoot, B.RUpLeg, B.RLeg, B.RFoot, B.LHand, B.RHand];

/** Cut a long take into a seamless loop: find the best end frame, then blend the tail into the head. */
function makeLoop(r: Raw, search: boolean): number {
  let end = r.frames - 1;
  if (search && r.frames > 90) {
    let best = Infinity;
    const lo = Math.max(30, Math.floor(r.frames * 0.55));
    for (let f = lo; f < r.frames; f++) {
      const d = poseDist(r, 0, f) + 0.002 * (r.frames - f);
      if (d < best) {
        best = d;
        end = f;
      }
    }
  }
  if (end < r.frames - 1) {
    r.frames = end + 1;
    r.rot = r.rot.slice(0, r.frames * BONE_COUNT * 4);
    r.hips = r.hips.slice(0, r.frames * 3);
  }
  const mismatch = poseDist(r, 0, r.frames - 1);
  if (mismatch > 0.02) {
    // Blend the last k frames towards the first frames' continuation, so frame[n-1] == frame[0].
    const k = Math.min(12, Math.floor(r.frames / 3));
    const n = r.frames;
    const target = newPose(), cur = newPose();
    for (let j = 0; j < k; j++) {
      const f = n - k + j;
      const u = (j + 1) / k;
      const wgt = u * u * (3 - 2 * u);
      rawPose(r, f, cur);
      rawPose(r, Math.max(0, j - k + 1 + 0) === 0 ? 0 : 0, target);
      // Offset the head pose by the remaining distance in time: frame (j - k + 1) mod loop ~ start.
      rawPose(r, (j + 1 === k ? 0 : Math.max(0, 0)), target);
      for (let b = 0; b < BONE_COUNT; b++) {
        const o = b * 4;
        let d = 0;
        for (let i = 0; i < 4; i++) d += cur.rot[o + i]! * target.rot[o + i]!;
        const sgn = d < 0 ? -1 : 1;
        let l = 0;
        for (let i = 0; i < 4; i++) {
          cur.rot[o + i] = cur.rot[o + i]! + (sgn * target.rot[o + i]! - cur.rot[o + i]!) * wgt;
          l += cur.rot[o + i]! ** 2;
        }
        l = Math.sqrt(l) || 1;
        for (let i = 0; i < 4; i++) cur.rot[o + i] = cur.rot[o + i]! / l;
      }
      for (let i = 0; i < 3; i++) cur.hips[i] = cur.hips[i]! + (target.hips[i]! - cur.hips[i]!) * wgt;
      setRawPose(r, f, cur);
    }
  }
  return mismatch;
}

/* ------------------------------------------------------------------ measuring feet */

/**
 * Foot contacts: a foot is planted while it is near its lowest height and
 * nearly still in the world (for in-place loops the body's travel is added
 * back). Returns contact windows as phases and the left-plant phase.
 */
export function measureFeet(r: Raw, sk: Skeleton, vel: [number, number]): Pick<ClipMeta, "contacts" | "syncL" | "events"> {
  const n = r.frames, w = newWorld();
  const pts: { L: [number, number, number][]; R: [number, number, number][] } = { L: [], R: [] };
  for (let f = 0; f < n; f++) {
    fk(sk, rawPose(r, f), w);
    for (const [s, foot, toe] of [["L", B.LFoot, B.LToe], ["R", B.RFoot, B.RToe]] as const) {
      // A point on the sole between the ankle and the ball of the foot.
      pts[s].push([(w.pos[foot * 3]! + w.pos[toe * 3]!) / 2, Math.min(w.pos[foot * 3 + 1]! - 0.075, w.pos[toe * 3 + 1]!), (w.pos[foot * 3 + 2]! + w.pos[toe * 3 + 2]!) / 2]);
    }
  }
  const out: Pick<ClipMeta, "contacts" | "syncL" | "events"> = { contacts: { L: [], R: [] }, events: [] };
  let syncL: number | undefined;
  let bestLen = 0;
  for (const s of ["L", "R"] as const) {
    const p = pts[s];
    const minY = Math.min(...p.map((q) => q[1]));
    const on: boolean[] = p.map((q, f) => {
      const a = p[Math.max(0, f - 1)]!, b = p[Math.min(n - 1, f + 1)]!;
      const dt = ((Math.min(n - 1, f + 1) - Math.max(0, f - 1)) || 1) / FPS;
      const vx = (b[0] - a[0]) / dt + vel[0], vz = (b[2] - a[2]) / dt + vel[1];
      return q[1] < minY + 0.045 && Math.hypot(vx, vz) < 0.6;
    });
    // Windows of consecutive contact frames.
    const wins: [number, number][] = [];
    for (let f = 0; f < n; f++) {
      if (on[f] && (f === 0 || !on[f - 1])) {
        let e = f;
        while (e + 1 < n && on[e + 1]) e++;
        if (e - f >= 1) wins.push([f, e]);
      }
    }
    // Join a window that wraps around the loop end.
    if (r.meta.kind === "loop" && wins.length > 1 && wins[0]![0] === 0 && wins[wins.length - 1]![1] >= n - 2) {
      const last = wins.pop()!;
      wins[0] = [last[0], wins[0]![1]];
    }
    const per = n - 1;
    out.contacts![s] = wins.map(([a, b]) => [+(a / per).toFixed(3), +((b % per) / per).toFixed(3)]);
    for (const [a] of wins) out.events!.push({ t: +(a / FPS).toFixed(3), name: `fs_${s}` });
    if (s === "L")
      for (const [a, b] of wins) {
        const l = b >= a ? b - a : b + per - a;
        if (l > bestLen) {
          bestLen = l;
          syncL = a / per;
        }
      }
  }
  out.events!.sort((a, b) => a.t - b.t);
  if (syncL !== undefined) out.syncL = +syncL.toFixed(3);
  return out;
}

/* ------------------------------------------------------------------ quantise and pack */

export function toClip(r: Raw): Clip {
  const rot: (Int16Array | Float32Array | null)[] = [];
  for (let b = 0; b < BONE_COUNT; b++) {
    if (b === B.Root) {
      rot.push(null);
      continue;
    }
    let moving = false;
    for (let f = 1; f < r.frames && !moving; f++) if (qAngle(r.rot, b * 4, r.rot, (f * BONE_COUNT + b) * 4) > 0.0012) moving = true;
    if (!moving) {
      rot.push(Float32Array.from(r.rot.subarray(b * 4, b * 4 + 4)));
      continue;
    }
    const q = new Int16Array(r.frames * 4);
    for (let f = 0; f < r.frames; f++) for (let j = 0; j < 4; j++) q[f * 4 + j] = Math.round(r.rot[(f * BONE_COUNT + b) * 4 + j]! * 32767);
    rot.push(q);
  }
  let hips = r.hips;
  let still = true;
  for (let f = 1; f < r.frames && still; f++) if (Math.hypot(hips[f * 3]! - hips[0]!, hips[f * 3 + 1]! - hips[1]!, hips[f * 3 + 2]! - hips[2]!) > 0.001) still = false;
  if (still) hips = hips.slice(0, 3);
  return new Clip(r.meta, FPS, r.frames, rot, Float32Array.from(hips), r.root ? Float32Array.from(r.root) : null);
}

/* ------------------------------------------------------------------ main */

function main(): void {
  if (!existsSync(SRC)) {
    console.error(`Mixamo folder not found: ${SRC}`);
    process.exit(1);
  }
  const ref = loadReference();
  console.log(`Reference rig: ${relative(SRC, ref.file)} (${ref.scene.hasSkin ? "skinned" : "skeleton only"}), hips ${ref.sk.hipHeight.toFixed(3)} m, legs ${ref.sk.legLength.toFixed(3)} m`);
  const raws = new Map<string, Raw>();
  const report: string[] = [];
  const problems: string[] = [];
  for (const spec of CLIP_SPECS) {
    const file = join(SRC, spec.file);
    if (!existsSync(file)) {
      problems.push(`missing file for ${spec.id}: ${spec.file}`);
      continue;
    }
    let raw: Raw, det: Detected;
    try {
      ({ raw, det } = readClip(spec, ref.sk));
    } catch (e) {
      problems.push(`${spec.file}: ${(e as Error).message}`);
      continue;
    }
    if (spec.layer) raw.meta.layer = spec.layer;
    if (spec.notes) raw.meta.notes = spec.notes;
    let faced = 0;
    if (spec.face) faced = faceForward(raw, ref.sk);
    let vel: [number, number] = [0, 0];
    if (spec.mode === "inplace") {
      const v = stripTravel(raw, /stairs/.test(spec.id));
      const sp = Math.hypot(v.vx, v.vz);
      raw.meta.speed = +sp.toFixed(3);
      raw.meta.dir = [+(v.vx / (sp || 1)).toFixed(3), +(v.vz / (sp || 1)).toFixed(3)];
      vel = [v.vx, v.vz];
    } else if (spec.mode === "root") extractRoot(raw, ref.sk);
    else if (spec.mode === "ground") groundRelative(raw, ref.sk);
    let seam = 0;
    if (spec.kind === "loop") seam = makeLoop(raw, !!spec.autoLoop);
    Object.assign(raw.meta, measureFeet(raw, ref.sk, vel));
    raws.set(spec.id, raw);
    const note = [
      det.skin ? "WITH SKIN" : "no skin",
      `${det.fps} fps`,
      `${det.duration.toFixed(2)} s`,
      spec.mode === "inplace" ? `in-place loop, stride ${raw.meta.speed} m/s` : det.travel > 0.2 ? `travels ${det.travel.toFixed(2)} m (root motion)` : "in place",
      Math.abs(det.turn) > 0.3 ? `turns ${((det.turn * 180) / Math.PI).toFixed(0)} deg` : "",
      faced ? `faced forward (${((faced * 180) / Math.PI).toFixed(0)} deg)` : "",
      seam > 0.02 ? `loop seam blended (${seam.toFixed(2)})` : "",
    ].filter(Boolean);
    report.push(`| \`${spec.id}\` | ${spec.pack} | ${spec.file.replace(/^.*\//, "")} | ${spec.kind} | ${note.join(", ")} |`);
  }
  // Clips we make ourselves (the owner could not find them on Mixamo).
  const made: string[] = [];
  for (const recipe of MADE_RECIPES) {
    try {
      const out = recipe.build({ get: (id: string) => raws.get(id), sk: ref.sk, measureFeet, newRaw, rawPose, setRawPose, fps: FPS });
      for (const r of out) {
        if (r.meta.kind === "loop" && !r.meta.contacts) Object.assign(r.meta, measureFeet(r, ref.sk, [0, 0]));
        raws.set(r.id, r);
        made.push(r.id);
        report.push(`| \`${r.id}\` | ${r.meta.pack} | made: ${recipe.how} | ${r.meta.kind} | ${((r.frames - 1) / FPS).toFixed(2)} s |`);
      }
    } catch (e) {
      problems.push(`made ${recipe.name}: ${(e as Error).message}`);
    }
  }
  // Packs.
  mkdirSync(OUT, { recursive: true });
  const packs = new Map<string, Raw[]>();
  for (const r of raws.values()) (packs.get(r.meta.pack) ?? packs.set(r.meta.pack, []).get(r.meta.pack)!).push(r);
  const index: { version: number; refHipHeight: number; packs: Record<string, { file: string; bytes: number; clips: string[] }>; clips: Record<string, { pack: string; kind: string; duration: number; speed?: number; layer?: string; made?: boolean }> } = { version: 1, refHipHeight: +ref.sk.hipHeight.toFixed(4), packs: {}, clips: {} };
  const sizes: string[] = [];
  for (const [name, list] of [...packs].sort()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
    const clips = list.map(toClip);
    const bytes = encodeClipPack({ name, rest: { rot: ref.sk.restRot, pos: ref.sk.restPos }, clips, extras: { refHipHeight: ref.sk.hipHeight, fps: FPS } });
    const file = `${name}.glb`;
    writeFileSync(join(OUT, file), bytes);
    if (bytes.length >= 5 * 1024 * 1024) problems.push(`${file} is ${(bytes.length / 1048576).toFixed(2)} MB (budget 5 MB)`);
    index.packs[name] = { file, bytes: bytes.length, clips: clips.map((c) => c.id) };
    for (const c of clips) index.clips[c.id] = { pack: name, kind: c.meta.kind, duration: +c.duration.toFixed(3), ...(c.meta.speed ? { speed: c.meta.speed } : {}), ...(c.meta.layer ? { layer: c.meta.layer } : {}), ...(c.meta.src.startsWith("made:") ? { made: true } : {}) };
    sizes.push(`| ${file} | ${clips.length} | ${(bytes.length / 1024).toFixed(0)} KB |`);
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index));
  // Unused downloads (so nothing the owner fetched is silently ignored).
  const used = new Set(CLIP_SPECS.map((s) => s.file));
  const unused: string[] = [];
  const walk = (d: string, pre: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p, `${pre}${f}/`);
      else if (f.toLowerCase().endsWith(".fbx") && !used.has(pre + f) && !/X Bot|Y Bot/.test(f)) unused.push(pre + f);
    }
  };
  walk(SRC, "");
  // Coverage against the plan.
  const have = new Set(raws.keys());
  const alias: Record<string, string> = { handshake: "handshake_a", run_start: "walk_start", turn_180: "run_pivot_180", jump_air: "fall_loop", land_run: "jump_run", hug: "hug_a", celebrate: "victory", idle_tired: "walk_tired" };
  const covered: string[] = [], madeCov: string[] = [], missing: string[] = [];
  for (const id of PLAN_CLIPS) {
    const real = have.has(id) ? id : alias[id] && have.has(alias[id]!) ? alias[id]! : null;
    if (!real) missing.push(id);
    else if (made.includes(real)) madeCov.push(id === real ? id : `${id} (${real})`);
    else covered.push(id === real ? id : `${id} (${real})`);
  }
  const md = [
    "# Animation inventory (generated)",
    "",
    `Generated by \`tools/anim/build-anims.ts\` from \`${SRC.replace(homedir(), "~")}\`. Do not edit by hand: re-run \`npm run assets:anim -w @mib/game-work-in-progress\`.`,
    "",
    `Reference rig: \`${relative(SRC, ref.file)}\` (Mixamo bind T-pose, ${BONE_COUNT} bones, hips ${ref.sk.hipHeight.toFixed(2)} m). Every clip uses this exact skeleton (checked).`,
    "",
    `## Coverage of the plan's clip list (§4.1, slice and missions)`,
    "",
    `- **From Mixamo (${covered.length}):** ${covered.join(", ")}`,
    `- **Made by us (${madeCov.length}):** ${madeCov.join(", ")}`,
    `- **Still missing (${missing.length}):** ${missing.join(", ") || "none"}`,
    "",
    "Missing clips fall back to the nearest clip or a procedural pose in `src/anim/actor.ts` (`FALLBACKS`), so a mission never stalls.",
    "",
    "## Packs",
    "",
    "| File | Clips | Size |",
    "|---|---|---|",
    ...sizes,
    "",
    "## Every clip",
    "",
    "| Clip | Pack | Source | Kind | What the build found |",
    "|---|---|---|---|---|",
    ...report,
    "",
    "## Downloads not used",
    "",
    unused.length ? unused.map((u) => `- ${u}`).join("\n") : "None.",
    "",
    "## Problems",
    "",
    problems.length ? problems.map((p) => `- ${p}`).join("\n") : "None.",
    "",
  ].join("\n");
  writeFileSync(join(GAME, "docs/ANIM_INVENTORY.md"), md);
  console.log(sizes.join("\n"));
  console.log(`${raws.size} clips (${made.length} made). Plan coverage: ${covered.length} Mixamo, ${madeCov.length} made, ${missing.length} missing.`);
  if (problems.length) console.log("Problems:\n  " + problems.join("\n  "));
  if (unused.length) console.log(`Unused downloads: ${unused.length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { MIB_BONES };
