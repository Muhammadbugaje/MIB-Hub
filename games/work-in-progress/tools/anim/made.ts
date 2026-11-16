/**
 * Clips we make ourselves: the ones the owner could not find on Mixamo
 * (hug, eat, sitting-thinking, bicycle, okada, keke, carry on head, Taty's
 * horns) plus a sit-down. Each is built from real Mixamo motion where one
 * fits (the seated body from "Sitting Idle", breathing from the idle, legs
 * from the walk) with procedural keyframes and IK on top: hands to the
 * chin, the mouth, a partner's back, handlebars and grips; feet to pedals
 * and pegs. They are baked into the packs like any other clip, so they
 * blend, layer and test the same way.
 *
 * Seat and grip numbers come from the game's own vehicle models
 * (world/story-props.ts BIKE, world/vehicle-models.ts okada and keke), so the
 * baked pose already sits right; at run time hand and foot IK snaps to the
 * actual sockets (plan rule A6).
 */
import type { ClipMeta } from "../../src/anim/clip.ts";
import { armIK, aimBone, handShape, legIK, lookAt, rotateBoneWorld } from "../../src/anim/ik.ts";
import { axisAngle, sub, type V3 } from "../../src/anim/math.ts";
import { B, BONE_COUNT, type Pose, type Skeleton, fk, newPose, newWorld, wpos } from "../../src/anim/skeleton.ts";
import type { Raw } from "./build-anims.ts";

export interface MadeCtx {
  get(id: string): Raw | undefined;
  sk: Skeleton;
  fps: number;
  newRaw(id: string, frames: number, meta: Omit<ClipMeta, "id">): Raw;
  rawPose(r: Raw, f: number, out?: Pose): Pose;
  setRawPose(r: Raw, f: number, p: Pose): void;
  measureFeet(r: Raw, sk: Skeleton, vel: [number, number]): Pick<ClipMeta, "contacts" | "syncL" | "events">;
}

export interface Recipe {
  name: string;
  how: string;
  build(ctx: MadeCtx): Raw[];
}

const need = (c: MadeCtx, id: string): Raw => {
  const r = c.get(id);
  if (!r) throw new Error(`needs clip ${id}`);
  return r;
};
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const env = (t: number, a: number, b: number, c: number, d: number) => ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)));

/** Bend the spine forward (+) about the character's left-right axis, spread over three bones. */
function lean(c: MadeCtx, p: Pose, w: ReturnType<typeof newWorld>, rad: number, side = 0): void {
  for (const [b, k] of [[B.Spine, 0.4], [B.Spine1, 0.35], [B.Spine2, 0.25]] as const) {
    rotateBoneWorld(c.sk, p, w, b, axisAngle([1, 0, 0], rad * k));
    if (side) rotateBoneWorld(c.sk, p, w, b, axisAngle([0, 0, 1], side * k));
  }
}

/** A loop built frame by frame from a base clip (looped) and an editor. */
function fromBase(c: MadeCtx, id: string, baseId: string, seconds: number, meta: Omit<ClipMeta, "id">, edit: (p: Pose, w: ReturnType<typeof newWorld>, t: number, u: number) => void, baseRate = 1): Raw {
  const base = need(c, baseId);
  const n = Math.round(seconds * c.fps) + 1;
  const r = c.newRaw(id, n, meta);
  const p = newPose(), w = newWorld();
  const period = base.frames - 1;
  for (let f = 0; f < n; f++) {
    const t = f / c.fps;
    const bf = Math.round((f * baseRate) % period);
    c.rawPose(base, bf, p);
    fk(c.sk, p, w);
    edit(p, w, t, f / (n - 1));
    c.setRawPose(r, f, p);
  }
  // Make the loop seamless: the last frame repeats the first exactly.
  if (meta.kind === "loop") {
    c.rawPose(r, 0, p);
    c.setRawPose(r, n - 1, p);
  }
  return r;
}

/** Hips placed at a model-space point (the seat), Root at the feet. */
function seatHips(p: Pose, x: number, y: number, z: number): void {
  p.hips[0] = x;
  p.hips[1] = y;
  p.hips[2] = z;
}

/** Set the hips' rotation to a forward lean (pelvis tilt) with optional yaw. */
function hipsTilt(p: Pose, pitch: number, yaw = 0): void {
  const q1 = axisAngle([0, 1, 0], yaw), q2 = axisAngle([1, 0, 0], pitch);
  const q = [q1[3] * q2[0] + q1[0] * q2[3] + q1[1] * q2[2] - q1[2] * q2[1], q1[3] * q2[1] - q1[0] * q2[2] + q1[1] * q2[3] + q1[2] * q2[0], q1[3] * q2[2] + q1[0] * q2[1] - q1[1] * q2[0] + q1[2] * q2[3], q1[3] * q2[3] - q1[0] * q2[0] - q1[1] * q2[1] - q1[2] * q2[2]];
  // Compose with the rest hips rotation (stored in the pose already from the base clip's first frame of a stand).
  const r = [p.rot[B.Hips * 4]!, p.rot[B.Hips * 4 + 1]!, p.rot[B.Hips * 4 + 2]!, p.rot[B.Hips * 4 + 3]!];
  const o = [q[3]! * r[0]! + q[0]! * r[3]! + q[1]! * r[2]! - q[2]! * r[1]!, q[3]! * r[1]! - q[0]! * r[2]! + q[1]! * r[3]! + q[2]! * r[0]!, q[3]! * r[2]! + q[0]! * r[1]! - q[1]! * r[0]! + q[2]! * r[3]!, q[3]! * r[3]! - q[0]! * r[0]! - q[1]! * r[1]! - q[2]! * r[2]!];
  const l = Math.hypot(o[0]!, o[1]!, o[2]!, o[3]!);
  p.rot.set(o.map((v) => v! / l), B.Hips * 4);
}

/** A pose seated astride or on a seat: hips at the seat, feet and hands by IK. */
function ride(c: MadeCtx, p: Pose, w: ReturnType<typeof newWorld>, o: { seat: V3; tilt: number; lean: number; footL: V3; footR: V3; handL: V3 | null; handR: V3 | null; knee?: V3; grip?: "grip" | "relaxed"; elbowOut?: number }): void {
  c.sk.restPose(p);
  seatHips(p, o.seat[0], o.seat[1], o.seat[2]);
  hipsTilt(p, o.tilt);
  fk(c.sk, p, w);
  lean(c, p, w, o.lean);
  legIK(c.sk, p, w, "L", o.footL, 1, o.knee ?? [0, 0.3, 1]);
  legIK(c.sk, p, w, "R", o.footR, 1, o.knee ?? [0, 0.3, 1]);
  // Feet flat on pedals or pegs: aim the foot towards the toes, level.
  aimBone(c.sk, p, w, B.LFoot, B.LToe, [0.05, -0.35, 1], 1);
  aimBone(c.sk, p, w, B.RFoot, B.RToe, [-0.05, -0.35, 1], 1);
  // Arms down from the shoulder first (the T-pose arms would twist the elbows).
  aimBone(c.sk, p, w, B.LArm, B.LForeArm, [0.25, -1, 0.35], 1);
  aimBone(c.sk, p, w, B.RArm, B.RForeArm, [-0.25, -1, 0.35], 1);
  const eo = o.elbowOut ?? 0.7;
  if (o.handL) armIK(c.sk, p, w, "L", o.handL, 1, [eo, -0.7, -0.4]);
  if (o.handR) armIK(c.sk, p, w, "R", o.handR, 1, [-eo, -0.7, -0.4]);
  if (o.grip) {
    handShape(c.sk, p, w, "L", o.grip);
    handShape(c.sk, p, w, "R", o.grip);
  }
  // Eyes on the road.
  lookAt(c.sk, p, w, [0, 1.3, 6], 0.8);
}

/* ------------------------------------------------------------------ bicycle (story-props BIKE) */
const BIKE = { seatY: 0.92, seatZ: -0.22, crankY: 0.32, crankZ: 0.02, crankR: 0.17, barY: 1.0, barZ: 0.42, barHalf: 0.26 };
/* Okada (vehicle-models.ts): seat top 0.75, rider socket z -0.05, bars y 0.98 z 0.56 half-width 0.36. */
const OKADA = { seatY: 0.8, seatZ: -0.1, pillionY: 0.84, pillionZ: -0.5, barY: 0.99, barZ: 0.52, barHalf: 0.33, pegY: 0.3, pegZ: 0.08, pegX: 0.2 };
/* Keke (vehicle-models.ts): driver seat top 0.67 at z 0.45, bars under the windscreen; bench top 0.68 at z -0.6. */
const KEKE = { seatY: 0.72, seatZ: 0.42, barY: 0.98, barZ: 0.86, barHalf: 0.3, floorY: 0.1, benchY: 0.74, benchZ: -0.62 };

export const MADE_RECIPES: Recipe[] = [
  {
    name: "idle_relaxed",
    how: "a neutral standing frame from Head Nod Yes; breathing, a slow weight shift (feet held by IK), arms and head drifting; replaces the action-stance idles as idle_breathe",
    build(c) {
      const nod = need(c, "nod");
      const n = Math.round(8 * c.fps) + 1;
      const r = c.newRaw("idle_breathe", n, { pack: "locomotion", kind: "loop", src: "made:nod[0]+breathing+weight shift" });
      const p = newPose(), w = newWorld();
      // A balanced stance: feet hip-width apart, level with each other, flat, toes turned out a little
      // (the borrowed frame stands staggered, which reads as crossed legs from the side).
      const rw = fk(c.sk, c.sk.restPose());
      const hipX = Math.abs(wpos(rw, B.LUpLeg)[0]);
      const ankY = wpos(rw, B.LFoot)[1];
      const ankZ = wpos(rw, B.LFoot)[2] + 0.015;
      const la: V3 = [hipX + 0.025, ankY, ankZ], ra: V3 = [-(hipX + 0.025), ankY, ankZ];
      const footDir = (side: 1 | -1): V3 => {
        const d = sub(wpos(rw, side > 0 ? B.LToe : B.RToe), wpos(rw, side > 0 ? B.LFoot : B.RFoot));
        const a = side * 0.14; // about 8 degrees out
        return [d[0] * Math.cos(a) + d[2] * Math.sin(a), d[1], -d[0] * Math.sin(a) + d[2] * Math.cos(a)];
      };
      const base = newPose();
      c.rawPose(nod, 0, base);
      // Hips centred over the feet.
      base.hips[0] = 0;
      base.hips[2] = ankZ + 0.01;
      const TAU = Math.PI * 2;
      for (let f = 0; f < n; f++) {
        const t = f / c.fps;
        const u = t / 8; // one loop
        p.rot.set(base.rot);
        p.hips.set(base.hips);
        // Weight shift side to side (one slow cycle) and a tiny bob with each breath (4 breaths).
        const shift = Math.sin(u * TAU);
        const breath = Math.sin(u * TAU * 4);
        p.hips[0] = base.hips[0]! + 0.018 * shift;
        p.hips[1] = base.hips[1]! - 0.004 * (1 - Math.cos(u * TAU * 2)) * 0.5;
        fk(c.sk, p, w);
        rotateBoneWorld(c.sk, p, w, B.Hips, axisAngle([0, 0, 1], -0.025 * shift));
        rotateBoneWorld(c.sk, p, w, B.Spine, axisAngle([0, 0, 1], 0.03 * shift));
        rotateBoneWorld(c.sk, p, w, B.Spine1, axisAngle([1, 0, 0], -0.012 * breath));
        rotateBoneWorld(c.sk, p, w, B.Spine2, axisAngle([1, 0, 0], -0.018 * breath));
        for (const [b, sgn] of [[B.LShoulder, 1], [B.RShoulder, -1]] as const) rotateBoneWorld(c.sk, p, w, b, axisAngle([0, 0, 1], sgn * 0.02 * breath));
        // Arms hang and drift a little; the head wanders.
        for (const [b, ph] of [[B.LArm, 0.3], [B.RArm, 1.4]] as const) rotateBoneWorld(c.sk, p, w, b, axisAngle([1, 0, 0], 0.035 * Math.sin(u * TAU * 2 + ph)));
        rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([0, 1, 0], 0.12 * Math.sin(u * TAU * 2 + 0.7) * Math.sin(u * TAU)));
        rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([1, 0, 0], 0.03 * Math.sin(u * TAU * 3)));
        // Feet stay planted, flat and level.
        legIK(c.sk, p, w, "L", la, 1);
        legIK(c.sk, p, w, "R", ra, 1);
        aimBone(c.sk, p, w, B.LFoot, B.LToe, footDir(1), 1);
        aimBone(c.sk, p, w, B.RFoot, B.RToe, footDir(-1), 1);
        handShape(c.sk, p, w, "L", "relaxed");
        handShape(c.sk, p, w, "R", "relaxed");
        c.setRawPose(r, f, p);
      }
      c.rawPose(r, 0, p);
      c.setRawPose(r, n - 1, p);
      r.meta.contacts = { L: [[0, 1]], R: [[0, 1]] };
      return [r];
    },
  },
  {
    name: "sit_down",
    how: "Stand Up played backwards, hips eased onto the Sitting Idle seat height",
    build(c) {
      const su = need(c, "stand_up"), si = need(c, "sit_idle");
      const n = su.frames;
      const r = c.newRaw("sit_down", n, { pack: "social", kind: "once", src: "made:reverse(stand_up)" });
      const p = newPose(), seat = c.rawPose(si, 0, newPose());
      const startY = su.hips[1]!;
      for (let f = 0; f < n; f++) {
        const g = n - 1 - f;
        c.rawPose(su, g, p);
        // Ease the end onto the seated loop's exact pose (no pop into sit_idle).
        const u = ease((f - n * 0.7) / (n * 0.3));
        if (u > 0) {
          for (let b = 0; b < BONE_COUNT; b++) {
            const o = b * 4;
            let d = 0;
            for (let j = 0; j < 4; j++) d += p.rot[o + j]! * seat.rot[o + j]!;
            const s = d < 0 ? -1 : 1;
            let l = 0;
            for (let j = 0; j < 4; j++) {
              p.rot[o + j] = p.rot[o + j]! + (s * seat.rot[o + j]! - p.rot[o + j]!) * u;
              l += p.rot[o + j]! ** 2;
            }
            for (let j = 0; j < 4; j++) p.rot[o + j] = p.rot[o + j]! / Math.sqrt(l);
          }
        }
        const dropTo = seat.hips[1]! - startY;
        p.hips[1] = p.hips[1]! + dropTo * ease(f / (n - 1)) * (1 - u) + (seat.hips[1]! - p.hips[1]!) * u;
        p.hips[0] = p.hips[0]! + (seat.hips[0]! - p.hips[0]!) * u;
        p.hips[2] = p.hips[2]! + (seat.hips[2]! - p.hips[2]!) * u;
        c.setRawPose(r, f, p);
      }
      // Root motion reversed: you back up onto the seat.
      if (su.root) {
        r.root = new Float32Array(n * 3);
        const ex = su.root[(n - 1) * 3]!, ez = su.root[(n - 1) * 3 + 1]!, ey = su.root[(n - 1) * 3 + 2]!;
        for (let f = 0; f < n; f++) {
          const g = n - 1 - f;
          r.root[f * 3] = su.root[g * 3]! - ex;
          r.root[f * 3 + 1] = su.root[g * 3 + 1]! - ez;
          r.root[f * 3 + 2] = su.root[g * 3 + 2]! - ey;
        }
        r.meta.root = { dx: -ex, dz: -ez, dyaw: -ey };
      }
      return [r];
    },
  },
  {
    name: "sit_think",
    how: "Sitting Idle body; right elbow on the knee, knuckles to the chin, head tilted, slow finger tap",
    build(c) {
      return [fromBase(c, "sit_think", "sit_idle", 6, { pack: "social", kind: "loop", src: "made:sit_idle+think" }, (p, w, t) => {
        lean(c, p, w, 0.32, 0);
        const knee = wpos(w, B.RLeg);
        const head = wpos(w, B.Head);
        // Elbow rests on the right knee; the hand comes up to the chin.
        const chin: V3 = [head[0] - 0.02, head[1] - 0.02 + 0.006 * Math.sin(t * 1.05), head[2] + 0.1];
        armIK(c.sk, p, w, "R", chin, 1, [-0.2, -1, 0.6]);
        void knee;
        handShape(c.sk, p, w, "R", "fist");
        // The other hand rests on the left thigh.
        const lk = wpos(w, B.LLeg), lh = wpos(w, B.LUpLeg);
        armIK(c.sk, p, w, "L", [(lk[0] + lh[0]) / 2 + 0.02, (lk[1] + lh[1]) / 2 + 0.06, (lk[2] + lh[2]) / 2], 1);
        handShape(c.sk, p, w, "L", "relaxed");
        // Head tilts to the side and down, drifting (thinking), and looks off.
        rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([0, 0, 1], -0.12 + 0.04 * Math.sin(t * 0.52)));
        rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([1, 0, 0], 0.18));
        lookAt(c.sk, p, w, [1.2 * Math.sin(t * 0.35), 0.9, 3], 0.45);
      })];
    },
  },
  {
    name: "eat",
    how: "idle / Sitting Idle body; right hand lifts food (a suya stick) to the mouth, bites, lowers; left hand holds the plate",
    build(c) {
      const make = (id: string, base: string) =>
        fromBase(c, id, base, 4.2, { pack: "social", kind: "loop", src: `made:${base}+eat`, layer: "upper", events: [{ t: 1.15, name: "bite" }] }, (p, w, t) => {
          const head = wpos(w, B.Head), chest = wpos(w, B.Spine2);
          const lift = env(t, 0.35, 1.0, 1.35, 2.0); // up, hold for the bite, down
          const low: V3 = [chest[0] - 0.12, chest[1] - 0.28, chest[2] + 0.3];
          const mouth: V3 = [head[0] - 0.03, head[1] + 0.02, head[2] + 0.13];
          const hand: V3 = [low[0] + (mouth[0] - low[0]) * lift, low[1] + (mouth[1] - low[1]) * lift, low[2] + (mouth[2] - low[2]) * lift];
          armIK(c.sk, p, w, "R", hand, 1, [-0.8, -0.6, -0.2]);
          handShape(c.sk, p, w, "R", "pinch");
          // Plate in the left hand at the belly.
          armIK(c.sk, p, w, "L", [chest[0] + 0.1, chest[1] - 0.3, chest[2] + 0.28], 1, [0.8, -0.6, -0.3]);
          handShape(c.sk, p, w, "L", "open");
          // Lean in to the bite; chew (small head nods) afterwards.
          const bite = env(t, 0.8, 1.1, 1.2, 1.5);
          rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([1, 0, 0], 0.16 * bite + (t > 1.8 && t < 3.6 ? 0.03 * Math.sin(t * 13) : 0)));
          lean(c, p, w, 0.05 * bite);
          lookAt(c.sk, p, w, [hand[0], hand[1] - 0.15, hand[2] + 0.2], 0.35 * (1 - lift));
        });
      return [make("eat_stand", "idle_breathe"), make("eat_seated", "sit_idle")];
    },
  },
  {
    name: "hug",
    how: "idle body; paired: arms wrap round the partner (A over the shoulders, B under the arms), hands to the partner's back, heads to the side, gentle sway and pats",
    build(c) {
      // Partners stand 0.42 m apart (feet), chest to chest; hands on the partner's back at their Spine2 (A) or Spine (B).
      const make = (id: string, high: boolean) =>
        fromBase(c, id, "idle_breathe", 4, { pack: "social", kind: "once", src: "made:idle+hug", notes: "paired: place partners 0.42 m apart facing each other; run-time hand IK targets the partner's back", hold: [1.0, 3.0] }, (p, w, t) => {
          const k = env(t, 0.05, 0.75, 3.2, 3.95);
          const sway = Math.sin(t * 2.2) * 0.04 * k;
          lean(c, p, w, 0.14 * k, sway);
          const chest = wpos(w, B.Spine2);
          const back = 0.42 + 0.08; // partner's back plane, ahead of us
          const y = high ? chest[1] + 0.12 : chest[1] - 0.1;
          const pat = high ? 0 : 0.03 * Math.max(0, Math.sin(t * 9)) * env(t, 1.2, 1.4, 2.4, 2.6);
          const L: V3 = [0.09, y, back + pat];
          const R: V3 = [-0.09, y - (high ? 0.02 : 0.03), back];
          armIK(c.sk, p, w, "L", [chest[0] + (L[0] - chest[0]), L[1], chest[2] + (L[2] - 0.0) * k + (1 - k) * 0.1], k, [1, high ? 0.3 : -0.4, 0.1]);
          armIK(c.sk, p, w, "R", [chest[0] + (R[0] - chest[0]), R[1], chest[2] + (R[2] - 0.0) * k + (1 - k) * 0.1], k, [-1, high ? 0.3 : -0.4, 0.1]);
          handShape(c.sk, p, w, "L", "relaxed");
          handShape(c.sk, p, w, "R", "relaxed");
          // Heads go to opposite sides (A to its right, B to its left: they mirror).
          rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([0, 1, 0], (high ? -0.45 : 0.45) * k));
          rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([0, 0, 1], (high ? -0.12 : 0.12) * k));
        });
      return [make("hug_a", true), make("hug_b", false)];
    },
  },
  {
    name: "horns",
    how: "idle body; Taty's rock hand sign: right arm punches up, index and pinky out, two pumps (special.taty only)",
    build(c) {
      return [fromBase(c, "horns", "idle_breathe", 2.2, { pack: "social", kind: "once", src: "made:idle+horns", layer: "upper" }, (p, w, t) => {
        const k = env(t, 0.0, 0.28, 1.7, 2.15);
        const pump = 0.06 * Math.max(0, Math.sin((t - 0.35) * 9)) * env(t, 0.35, 0.45, 1.4, 1.6);
        const sh = wpos(w, B.RShoulder);
        const target: V3 = [sh[0] - 0.12, sh[1] + 0.42 + pump, sh[2] + 0.22];
        armIK(c.sk, p, w, "R", target, k, [-1, 0.2, -0.6]);
        handShape(c.sk, p, w, "R", k > 0.3 ? "horns" : "relaxed");
        // Rock face: chin up, a little lean back on the pumps.
        rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([1, 0, 0], -0.12 * k - pump));
        lean(c, p, w, -0.06 * k);
      })];
    },
  },
  {
    name: "carry_on_head",
    how: "idle and walk bodies; both hands up steadying a basin on the head, neck held level (market traders)",
    build(c) {
      const edit = (p: Pose, w: ReturnType<typeof newWorld>, t: number) => {
        const top = wpos(w, B.HeadTop);
        armIK(c.sk, p, w, "L", [top[0] + 0.2, top[1] + 0.06, top[2] + 0.02], 1, [1, 0.2, -0.3]);
        armIK(c.sk, p, w, "R", [top[0] - 0.2, top[1] + 0.06, top[2] + 0.02 + 0.01 * Math.sin(t * 3)], 1, [-1, 0.2, -0.3]);
        handShape(c.sk, p, w, "L", "open");
        handShape(c.sk, p, w, "R", "open");
        // Keep the head level and upright (the load decides the posture).
        lookAt(c.sk, p, w, [0, top[1] - 0.1, 6], 0.6);
      };
      const walk = need(c, "walk_fwd");
      const idle = fromBase(c, "carry_head_idle", "idle_breathe", 4, { pack: "social", kind: "loop", src: "made:idle+carry_on_head", layer: "upper" }, edit);
      const per = (walk.frames - 1) / c.fps;
      const wk = fromBase(c, "carry_head_walk", "walk_fwd", per, { pack: "social", kind: "loop", src: "made:walk_fwd+carry_on_head", layer: "upper", speed: walk.meta.speed, dir: walk.meta.dir, syncL: walk.meta.syncL, contacts: walk.meta.contacts }, edit);
      return [idle, wk];
    },
  },
  {
    name: "bicycle",
    how: "procedural: seated on the saddle, hands on the bars, feet on the pedals through one crank turn (phase = crank angle, driven by wheel distance at run time); freewheel; foot down; mount and dismount",
    build(c) {
      const out: Raw[] = [];
      const p = newPose(), w = newWorld();
      const seat: V3 = [0, BIKE.seatY + 0.06, BIKE.seatZ + 0.04];
      const pedal = (a: number, side: 1 | -1): V3 => [side * 0.13, BIKE.crankY + Math.sin(a) * BIKE.crankR + 0.09, BIKE.crankZ + Math.cos(a) * BIKE.crankR - 0.03];
      const bars = (s: 1 | -1): V3 => [s * (BIKE.barHalf - 0.04), BIKE.barY + 0.02, BIKE.barZ - 0.03];
      // One crank revolution in 30 frames (phase 0..1 = crank angle 0..2pi).
      const cyc = c.newRaw("cycle", 31, { pack: "vehicles", kind: "loop", src: "made:procedural cycle", notes: "phase = crank angle / 2pi; play by wheel distance (plan §4.5)" });
      for (let f = 0; f < 31; f++) {
        const a = (f / 30) * Math.PI * 2;
        ride(c, p, w, { seat, tilt: 0.12, lean: 0.38, footL: pedal(a, 1), footR: pedal(a + Math.PI, -1), handL: bars(1), handR: bars(-1), grip: "grip", knee: [0, 0.2, 1] });
        // The hips rock a touch with the pushing leg.
        rotateBoneWorld(c.sk, p, w, B.Hips, axisAngle([0, 0, 1], 0.05 * Math.sin(a)));
        legIK(c.sk, p, w, "L", pedal(a, 1), 1, [0, 0.2, 1]);
        legIK(c.sk, p, w, "R", pedal(a + Math.PI, -1), 1, [0, 0.2, 1]);
        c.setRawPose(cyc, f, p);
      }
      out.push(cyc);
      const still = (id: string, a: number, footDown: boolean, notes: string) => {
        const r = c.newRaw(id, 2, { pack: "vehicles", kind: "loop", src: `made:procedural ${id}`, notes });
        for (let f = 0; f < 2; f++) {
          const down: V3 = [0.3, 0.09, 0.05];
          ride(c, p, w, { seat: footDown ? [0.05, seat[1] - 0.04, seat[2]] : seat, tilt: 0.1, lean: footDown ? 0.25 : 0.36, footL: footDown ? down : pedal(a, 1), footR: pedal(a + Math.PI, -1), handL: bars(1), handR: bars(-1), grip: "grip" });
          if (footDown) rotateBoneWorld(c.sk, p, w, B.Hips, axisAngle([0, 0, 1], 0.07));
          c.setRawPose(r, f, p);
        }
        return r;
      };
      out.push(still("cycle_freewheel", 0, false, "pedals level, coasting"));
      out.push(still("cycle_foot_down", Math.PI / 2, true, "stopped, left foot on the ground, right foot on the raised pedal"));
      // Mount from the left: stand beside, swing the right leg over the back, sit, feet to pedals.
      const n = 37;
      const mount = c.newRaw("bike_mount", n, { pack: "vehicles", kind: "once", src: "made:procedural mount", notes: "start standing at the bike's left; reverse = bike_dismount" });
      const idle = need(c, "idle_breathe");
      const sp = newPose(), mp = newPose(), mw = newWorld();
      for (let f = 0; f < n; f++) {
        const u = f / (n - 1);
        c.rawPose(idle, 0, sp);
        // Target end pose: freewheel.
        ride(c, mp, mw, { seat, tilt: 0.1, lean: 0.36, footL: pedal(0, 1), footR: pedal(Math.PI, -1), handL: bars(1), handR: bars(-1), grip: "grip" });
        const s = ease(u);
        for (let b = 0; b < BONE_COUNT; b++) {
          const o = b * 4;
          let d = 0;
          for (let j = 0; j < 4; j++) d += sp.rot[o + j]! * mp.rot[o + j]!;
          const sg = d < 0 ? -1 : 1;
          let l = 0;
          for (let j = 0; j < 4; j++) {
            p.rot[o + j] = sp.rot[o + j]! + (sg * mp.rot[o + j]! - sp.rot[o + j]!) * s;
            l += p.rot[o + j]! ** 2;
          }
          for (let j = 0; j < 4; j++) p.rot[o + j] = p.rot[o + j]! / Math.sqrt(l);
        }
        // Hips travel from beside the bike (x +0.35) over the saddle.
        const hx = 0.35 * (1 - ease(u * 1.4)), hy = sp.hips[1]! + (mp.hips[1]! - sp.hips[1]!) * s + 0.08 * Math.sin(Math.PI * u), hz = sp.hips[2]! + (mp.hips[2]! - sp.hips[2]!) * s;
        p.hips.set([hx, hy, hz]);
        fk(c.sk, p, w);
        // The right leg swings high over the back wheel mid-way.
        const swing = Math.sin(Math.PI * Math.min(1, u * 1.3));
        const rf = pedal(Math.PI, -1);
        legIK(c.sk, p, w, "R", [rf[0] + 0.3 * (1 - s), rf[1] + 0.55 * swing, rf[2] - 0.45 * swing], 1, [0, 0.3, 1]);
        legIK(c.sk, p, w, "L", u < 0.6 ? [0.3 * (1 - s) + 0.12, 0.09, 0.05] : pedal(0, 1), 1);
        armIK(c.sk, p, w, "L", bars(1), Math.min(1, u * 2), [0.7, -0.7, -0.4]);
        armIK(c.sk, p, w, "R", bars(-1), Math.min(1, u * 2), [-0.7, -0.7, -0.4]);
        c.setRawPose(mount, f, p);
      }
      out.push(mount);
      const dis = c.newRaw("bike_dismount", n, { pack: "vehicles", kind: "once", src: "made:reverse(bike_mount)" });
      for (let f = 0; f < n; f++) c.setRawPose(dis, f, c.rawPose(mount, n - 1 - f, p));
      out.push(dis);
      return out;
    },
  },
  {
    name: "okada",
    how: "procedural: rider astride (hands on grips, feet on pegs, lean-ready), pillion astride behind (hands on the rider's waist or own thighs), foot down at a stop",
    build(c) {
      const p = newPose(), w = newWorld();
      const peg = (s: 1 | -1, z = OKADA.pegZ): V3 => [s * OKADA.pegX, OKADA.pegY + 0.08, z];
      const grip = (s: 1 | -1): V3 => [s * (OKADA.barHalf - 0.05), OKADA.barY + 0.02, OKADA.barZ - 0.04];
      const one = (id: string, o: Parameters<typeof ride>[3], notes: string, idleMove = true) => {
        const n = idleMove ? 61 : 2;
        const r = c.newRaw(id, n, { pack: "vehicles", kind: "loop", src: `made:procedural ${id}`, notes });
        for (let f = 0; f < n; f++) {
          const t = f / c.fps;
          ride(c, p, w, o);
          if (idleMove) {
            // Small life: a breath and a glance (2 s loop).
            rotateBoneWorld(c.sk, p, w, B.Spine2, axisAngle([1, 0, 0], 0.015 * Math.sin((t * Math.PI * 2) / 2)));
            rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([0, 1, 0], 0.08 * Math.sin((t * Math.PI * 2) / 2)));
          }
          c.setRawPose(r, f, p);
        }
        return r;
      };
      const rider = one("okada_ride", { seat: [0, OKADA.seatY + 0.06, OKADA.seatZ], tilt: 0.05, lean: 0.24, footL: peg(1), footR: peg(-1), handL: grip(1), handR: grip(-1), grip: "grip", knee: [0.35, 0.2, 1], elbowOut: 0.9 }, "Root at the okada's origin; lean additive at run time");
      const down = one("okada_foot_down", { seat: [0.04, OKADA.seatY + 0.04, OKADA.seatZ], tilt: 0.05, lean: 0.18, footL: [0.32, 0.09, 0.12], footR: peg(-1), handL: grip(1), handR: grip(-1), grip: "grip", knee: [0.35, 0.2, 1] }, "stopped: left foot on the ground", false);
      // Pillion: hands on own thighs (side-saddle comes later as a separate seat).
      const pil = one("okada_pillion", { seat: [0, OKADA.pillionY + 0.06, OKADA.pillionZ], tilt: 0.02, lean: 0.1, footL: [0.23, 0.4, -0.3], footR: [-0.23, 0.4, -0.3], handL: null, handR: null, knee: [0.4, 0.2, 1] }, "pillion astride behind the rider; Root at the okada's origin; hands rest on the thighs");
      // Hands on the thighs for the pillion.
      for (let f = 0; f < pil.frames; f++) {
        c.rawPose(pil, f, p);
        fk(c.sk, p, w);
        for (const s of ["L", "R"] as const) {
          const k = wpos(w, s === "L" ? B.LLeg : B.RLeg), h = wpos(w, s === "L" ? B.LUpLeg : B.RUpLeg);
          armIK(c.sk, p, w, s, [(k[0] * 0.6 + h[0] * 0.4) + (s === "L" ? 0.04 : -0.04), (k[1] * 0.6 + h[1] * 0.4) + 0.08, k[2] * 0.6 + h[2] * 0.4], 1);
          handShape(c.sk, p, w, s, "relaxed");
        }
        c.setRawPose(pil, f, p);
      }
      return [rider, down, pil];
    },
  },
  {
    name: "keke",
    how: "procedural: keke driver (seat, hands on the bars, feet on the floor), passenger on the back bench (Sitting Idle body at bench height, hands on the knees, gentle sway)",
    build(c) {
      const p = newPose(), w = newWorld();
      const n = 61;
      const drv = c.newRaw("keke_drive", n, { pack: "vehicles", kind: "loop", src: "made:procedural keke_drive", notes: "Root at the keke's origin" });
      for (let f = 0; f < n; f++) {
        const t = f / c.fps;
        ride(c, p, w, { seat: [0, KEKE.seatY + 0.06, KEKE.seatZ], tilt: 0.0, lean: 0.12, footL: [0.14, KEKE.floorY + 0.09, 0.8], footR: [-0.14, KEKE.floorY + 0.09, 0.8], handL: [KEKE.barHalf, KEKE.barY, KEKE.barZ], handR: [-KEKE.barHalf, KEKE.barY, KEKE.barZ], grip: "grip", knee: [0.2, 0.3, 1] });
        rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([0, 1, 0], 0.1 * Math.sin((t * Math.PI * 2) / 2)));
        c.setRawPose(drv, f, p);
      }
      const pas = fromBase(c, "keke_passenger", "sit_idle", 2, { pack: "vehicles", kind: "loop", src: "made:sit_idle+keke_passenger", notes: "back bench; sways with lateral acceleration at run time" }, (pp, ww, t) => {
        for (const s of ["L", "R"] as const) {
          const k = wpos(ww, s === "L" ? B.LLeg : B.RLeg);
          armIK(c.sk, pp, ww, s, [k[0] + (s === "L" ? -0.02 : 0.02), k[1] + 0.07, k[2] - 0.04], 1);
          handShape(c.sk, pp, ww, s, "relaxed");
        }
        rotateBoneWorld(c.sk, pp, ww, B.Head, axisAngle([0, 1, 0], 0.15 * Math.sin((t * Math.PI * 2) / 2)));
      });
      const car = fromBase(c, "car_passenger_idle", "sit_idle", 2, { pack: "vehicles", kind: "loop", src: "made:sit_idle+car_passenger" }, (pp, ww, t) => {
        rotateBoneWorld(c.sk, pp, ww, B.Head, axisAngle([0, 1, 0], -0.25 + 0.12 * Math.sin((t * Math.PI * 2) / 2)));
      });
      const wave = fromBase(c, "wave_from_car", "sit_idle", 2, { pack: "vehicles", kind: "loop", src: "made:sit_idle+wave", layer: "upper" }, (pp, ww, t) => {
        const sh = wpos(ww, B.RShoulder);
        armIK(c.sk, pp, ww, "R", [sh[0] - 0.32 + 0.08 * Math.sin(t * Math.PI * 4), sh[1] + 0.22, sh[2] + 0.12], 1, [-1, -0.3, -0.5]);
        handShape(c.sk, pp, ww, "R", "open");
      });
      return [drv, pas, car, wave];
    },
  },
  {
    name: "dazed",
    how: "Sitting-on-the-floor body; knocked-down daze: head shakes and wobbles (cartoon, non-lethal)",
    build(c) {
      return [fromBase(c, "dazed_shake_head", "sit_floor", 1.6, { pack: "action", kind: "once", src: "made:sit_floor+daze" }, (p, w, t) => {
        const k = env(t, 0, 0.15, 1.3, 1.6);
        rotateBoneWorld(c.sk, p, w, B.Head, axisAngle([0, 1, 0], 0.35 * Math.sin(t * 14) * k * (1 - t / 1.8)));
        rotateBoneWorld(c.sk, p, w, B.Spine2, axisAngle([0, 0, 1], 0.08 * Math.sin(t * 5) * k));
      })];
    },
  },
  {
    name: "raise_hand",
    how: "Sitting Idle body; right hand up (class)",
    build(c) {
      return [fromBase(c, "raise_hand", "sit_idle", 2.4, { pack: "social", kind: "once", src: "made:sit_idle+raise_hand", layer: "upper" }, (p, w, t) => {
        const k = env(t, 0, 0.35, 1.9, 2.4);
        const sh = wpos(w, B.RShoulder);
        armIK(c.sk, p, w, "R", [sh[0] - 0.08, sh[1] + 0.55, sh[2] + 0.08], k, [-1, 0, -0.4]);
        handShape(c.sk, p, w, "R", "open");
      })];
    },
  },
];
