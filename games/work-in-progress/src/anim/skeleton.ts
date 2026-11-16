/**
 * mib_rig v1: the one skeleton every human in the game uses (plan §3.7).
 *
 * Bone names and hierarchy are Mixamo's (the "mixamorig:" prefix dropped),
 * so every Mixamo clip and most libraries play with no renaming. A `Root`
 * node sits on the ground under the hips and carries root motion.
 *
 * The rest pose (bone frames) is the Mixamo bind T-pose, Y up, metres,
 * facing +Z. Each character keeps its own bone lengths (its own rest
 * translations), so a tall thin body and a short round one share every clip.
 *
 * Pure data and maths: no engine types, so the feel tests run headless.
 */
import { qMul, rotV, type V3 } from "./math.ts";

/** [name, parent] in hierarchy order (parents always come first). */
export const MIB_BONES: readonly (readonly [string, string | null])[] = (() => {
  const b: [string, string | null][] = [
    ["Root", null], ["Hips", "Root"], ["Spine", "Hips"], ["Spine1", "Spine"], ["Spine2", "Spine1"], ["Neck", "Spine2"], ["Head", "Neck"], ["HeadTop_End", "Head"],
  ];
  for (const s of ["Left", "Right"]) {
    b.push([`${s}Shoulder`, "Spine2"], [`${s}Arm`, `${s}Shoulder`], [`${s}ForeArm`, `${s}Arm`], [`${s}Hand`, `${s}ForeArm`]);
    for (const f of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
      b.push([`${s}Hand${f}1`, `${s}Hand`], [`${s}Hand${f}2`, `${s}Hand${f}1`], [`${s}Hand${f}3`, `${s}Hand${f}2`], [`${s}Hand${f}4`, `${s}Hand${f}3`]);
    }
  }
  for (const s of ["Left", "Right"]) b.push([`${s}UpLeg`, "Hips"], [`${s}Leg`, `${s}UpLeg`], [`${s}Foot`, `${s}Leg`], [`${s}ToeBase`, `${s}Foot`], [`${s}Toe_End`, `${s}ToeBase`]);
  return b;
})();

export const BONE_COUNT = MIB_BONES.length;
export const BONE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(MIB_BONES.map(([n], i) => [n, i]));
export const PARENT: Int16Array = Int16Array.from(MIB_BONES.map(([, p]) => (p ? BONE_INDEX[p]! : -1)));

export const B = {
  Root: 0, Hips: BONE_INDEX.Hips!, Spine: BONE_INDEX.Spine!, Spine1: BONE_INDEX.Spine1!, Spine2: BONE_INDEX.Spine2!, Neck: BONE_INDEX.Neck!, Head: BONE_INDEX.Head!,
  LShoulder: BONE_INDEX.LeftShoulder!, LArm: BONE_INDEX.LeftArm!, LForeArm: BONE_INDEX.LeftForeArm!, LHand: BONE_INDEX.LeftHand!,
  RShoulder: BONE_INDEX.RightShoulder!, RArm: BONE_INDEX.RightArm!, RForeArm: BONE_INDEX.RightForeArm!, RHand: BONE_INDEX.RightHand!,
  LUpLeg: BONE_INDEX.LeftUpLeg!, LLeg: BONE_INDEX.LeftLeg!, LFoot: BONE_INDEX.LeftFoot!, LToe: BONE_INDEX.LeftToeBase!, LToeEnd: BONE_INDEX.LeftToe_End!,
  RUpLeg: BONE_INDEX.RightUpLeg!, RLeg: BONE_INDEX.RightLeg!, RFoot: BONE_INDEX.RightFoot!, RToe: BONE_INDEX.RightToeBase!, RToeEnd: BONE_INDEX.RightToe_End!,
  HeadTop: BONE_INDEX.HeadTop_End!,
} as const;

/** True for a bone and everything under it. */
export function subtree(root: number): Uint8Array {
  const m = new Uint8Array(BONE_COUNT);
  m[root] = 1;
  for (let i = root + 1; i < BONE_COUNT; i++) if (PARENT[i]! >= 0 && m[PARENT[i]!]) m[i] = 1;
  return m;
}

/**
 * Masks (per-bone weights 0..1) for layered animation (plan §4.2):
 *  - upper: the spine from Spine1 up (arms, neck, head), with a soft ramp
 *    on the spine so an upper-body clip blends into walking legs;
 *  - arms: shoulders down (a hand-only gesture keeps the torso's own sway);
 *  - head: neck and head.
 */
export const MASKS = (() => {
  const upper = new Float32Array(BONE_COUNT);
  const s2 = subtree(B.Spine2);
  for (let i = 0; i < BONE_COUNT; i++) upper[i] = s2[i] ? 1 : 0;
  upper[B.Spine1] = 0.6;
  upper[B.Spine] = 0.25;
  const arms = new Float32Array(BONE_COUNT);
  const la = subtree(B.LShoulder), ra = subtree(B.RShoulder);
  for (let i = 0; i < BONE_COUNT; i++) arms[i] = la[i] || ra[i] ? 1 : 0;
  const rightArm = new Float32Array(BONE_COUNT);
  for (let i = 0; i < BONE_COUNT; i++) rightArm[i] = ra[i] ? 1 : 0;
  const leftArm = new Float32Array(BONE_COUNT);
  for (let i = 0; i < BONE_COUNT; i++) leftArm[i] = la[i] ? 1 : 0;
  const head = new Float32Array(BONE_COUNT);
  head[B.Neck] = 1;
  head[B.Head] = 1;
  head[B.HeadTop] = 1;
  const full = new Float32Array(BONE_COUNT).fill(1);
  const lower = new Float32Array(BONE_COUNT);
  for (let i = 0; i < BONE_COUNT; i++) lower[i] = 1 - upper[i]!;
  return { upper, arms, rightArm, leftArm, head, full, lower };
})();
export type MaskName = keyof typeof MASKS;

/** A pose: every bone's local rotation, plus the hips' local translation (metres, relative to Root). */
export interface Pose {
  rot: Float32Array;
  hips: Float32Array;
}

export function newPose(): Pose {
  return { rot: new Float32Array(BONE_COUNT * 4), hips: new Float32Array(3) };
}

export function copyPose(src: Pose, dst: Pose): Pose {
  dst.rot.set(src.rot);
  dst.hips.set(src.hips);
  return dst;
}

/**
 * One character's proportions on mib_rig: the rest local rotations (the
 * Mixamo bind frames, shared by everyone) and its own rest translations.
 */
export class Skeleton {
  readonly restRot: Float32Array;
  readonly restPos: Float32Array;
  /** Hips height above the feet at rest (metres): scales clip hip motion to this body. */
  readonly hipHeight: number;
  /** The reference skeleton's hip height (clips were authored on it). */
  readonly refHipHeight: number;
  /** Leg length (hip joint to ankle), for IK reach. */
  readonly legLength: number;

  constructor(restRot: Float32Array, restPos: Float32Array, refHipHeight?: number) {
    this.restRot = restRot;
    this.restPos = restPos;
    const w = this.fkRest();
    const groundY = Math.min(w.pos[B.LToeEnd * 3 + 1]!, w.pos[B.LToe * 3 + 1]!);
    this.hipHeight = w.pos[B.Hips * 3 + 1]! - groundY;
    this.refHipHeight = refHipHeight ?? this.hipHeight;
    const hp: V3 = [w.pos[B.LUpLeg * 3]!, w.pos[B.LUpLeg * 3 + 1]!, w.pos[B.LUpLeg * 3 + 2]!];
    const kn: V3 = [w.pos[B.LLeg * 3]!, w.pos[B.LLeg * 3 + 1]!, w.pos[B.LLeg * 3 + 2]!];
    const an: V3 = [w.pos[B.LFoot * 3]!, w.pos[B.LFoot * 3 + 1]!, w.pos[B.LFoot * 3 + 2]!];
    this.legLength = Math.hypot(hp[0] - kn[0], hp[1] - kn[1], hp[2] - kn[2]) + Math.hypot(kn[0] - an[0], kn[1] - an[1], kn[2] - an[2]);
  }

  /** The rest pose as a Pose (bind T-pose). */
  restPose(out = newPose()): Pose {
    out.rot.set(this.restRot);
    out.hips[0] = this.restPos[B.Hips * 3]!;
    out.hips[1] = this.restPos[B.Hips * 3 + 1]!;
    out.hips[2] = this.restPos[B.Hips * 3 + 2]!;
    return out;
  }

  private fkRest(): World {
    return fk(this, this.restPose());
  }
}

/** Model-space (character-space) transforms of every bone. */
export interface World {
  rot: Float32Array;
  pos: Float32Array;
}

export function newWorld(): World {
  return { rot: new Float32Array(BONE_COUNT * 4), pos: new Float32Array(BONE_COUNT * 3) };
}

/**
 * Forward kinematics: local pose -> model space. Bones other than the hips
 * use the skeleton's own rest translations (its bone lengths); the hips use
 * the pose's translation, scaled to this body by `hipScale`.
 */
export function fk(sk: Skeleton, pose: Pose, out: World = newWorld(), hipScale = 1): World {
  const r = out.rot, p = out.pos;
  for (let i = 0; i < BONE_COUNT; i++) {
    const par = PARENT[i]!;
    const lr = pose.rot;
    let tx: number, ty: number, tz: number;
    if (i === B.Hips) {
      tx = pose.hips[0]! * hipScale;
      ty = pose.hips[1]! * hipScale;
      tz = pose.hips[2]! * hipScale;
    } else {
      tx = sk.restPos[i * 3]!;
      ty = sk.restPos[i * 3 + 1]!;
      tz = sk.restPos[i * 3 + 2]!;
    }
    if (par < 0) {
      r[i * 4] = lr[i * 4]!;
      r[i * 4 + 1] = lr[i * 4 + 1]!;
      r[i * 4 + 2] = lr[i * 4 + 2]!;
      r[i * 4 + 3] = lr[i * 4 + 3]!;
      p[i * 3] = tx;
      p[i * 3 + 1] = ty;
      p[i * 3 + 2] = tz;
      continue;
    }
    qMul(r, par * 4, lr, i * 4, r, i * 4);
    const v = rotV(r, par * 4, [tx, ty, tz]);
    p[i * 3] = p[par * 3]! + v[0];
    p[i * 3 + 1] = p[par * 3 + 1]! + v[1];
    p[i * 3 + 2] = p[par * 3 + 2]! + v[2];
  }
  return out;
}

export const wpos = (w: World, i: number): V3 => [w.pos[i * 3]!, w.pos[i * 3 + 1]!, w.pos[i * 3 + 2]!];
