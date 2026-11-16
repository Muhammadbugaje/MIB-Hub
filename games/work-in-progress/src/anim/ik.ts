/**
 * Inverse kinematics and pose editing on mib_rig (plan §4.3).
 *
 * Everything works in model space (the character's own frame: +Z forward,
 * +Y up, +X the character's left). Edits are written back as local
 * rotations, so the result blends and layers like any other pose.
 *
 *   rotateBoneWorld  turn a bone by a model-space rotation (children follow)
 *   twoBone          two-bone IK (leg: UpLeg-Leg-Foot, arm: Arm-ForeArm-Hand)
 *                    with a pole direction for the knee or elbow
 *   lookAt           head 50 % / neck 30 % / Spine2 20 %, clamped (plan §4.3)
 *   curlFinger       bend a finger chain towards the palm (hand signs, grips)
 *
 * Callers pass a World computed by fk(); each function keeps it up to date
 * for the bones it changes (so several solves can be chained cheaply).
 */
import { add, clamp, conj, cross, dot, fromTo, len, mulQ, norm, qMul, rotV, scale, sub, axisAngle, type Q, type V3 } from "./math.ts";
import { BONE_COUNT, BONE_INDEX as BONE_BY_NAME, B, PARENT, type Pose, type Skeleton, type World, fk, wpos } from "./skeleton.ts";

const getQ = (w: World, i: number): Q => [w.rot[i * 4]!, w.rot[i * 4 + 1]!, w.rot[i * 4 + 2]!, w.rot[i * 4 + 3]!];

/** Children lists (built once). */
const CHILDREN: number[][] = (() => {
  const c: number[][] = Array.from({ length: BONE_COUNT }, () => []);
  for (let i = 0; i < BONE_COUNT; i++) if (PARENT[i]! >= 0) c[PARENT[i]!]!.push(i);
  return c;
})();

/** Recompute the model-space transforms of bone i's subtree from its (new) local rotation. */
export function refreshSubtree(sk: Skeleton, pose: Pose, w: World, i: number, hipScale = 1): void {
  const stack = [i];
  while (stack.length) {
    const b = stack.pop()!;
    const par = PARENT[b]!;
    if (par < 0) {
      w.rot.set(pose.rot.subarray(b * 4, b * 4 + 4), b * 4);
    } else {
      qMul(w.rot, par * 4, pose.rot, b * 4, w.rot, b * 4);
      const t: V3 = b === B.Hips ? [pose.hips[0]! * hipScale, pose.hips[1]! * hipScale, pose.hips[2]! * hipScale] : [sk.restPos[b * 3]!, sk.restPos[b * 3 + 1]!, sk.restPos[b * 3 + 2]!];
      const v = rotV(w.rot, par * 4, t);
      w.pos[b * 3] = w.pos[par * 3]! + v[0];
      w.pos[b * 3 + 1] = w.pos[par * 3 + 1]! + v[1];
      w.pos[b * 3 + 2] = w.pos[par * 3 + 2]! + v[2];
    }
    for (const c of CHILDREN[b]!) stack.push(c);
  }
}

/** Turn bone i by model-space rotation q (pre-multiplied), keeping its parent. */
export function rotateBoneWorld(sk: Skeleton, pose: Pose, w: World, i: number, q: Q, hipScale = 1): void {
  const par = PARENT[i]!;
  const cur = getQ(w, i);
  const nw = mulQ(q, cur);
  const local = par >= 0 ? mulQ(conj(getQ(w, par)), nw) : nw;
  const l = Math.hypot(local[0], local[1], local[2], local[3]) || 1;
  pose.rot[i * 4] = local[0] / l;
  pose.rot[i * 4 + 1] = local[1] / l;
  pose.rot[i * 4 + 2] = local[2] / l;
  pose.rot[i * 4 + 3] = local[3] / l;
  refreshSubtree(sk, pose, w, i, hipScale);
}

/** Partial rotation: q scaled by weight t (slerp from identity). */
export function partial(q: Q, t: number): Q {
  const w = clamp(q[3], -1, 1);
  const ang = 2 * Math.acos(Math.abs(w));
  if (ang < 1e-6) return [0, 0, 0, 1];
  const s = Math.sqrt(1 - w * w) || 1;
  const sign = w < 0 ? -1 : 1;
  return axisAngle([(q[0] / s) * sign, (q[1] / s) * sign, (q[2] / s) * sign], ang * t);
}

/**
 * Two-bone IK: bones a (upper), b (lower), c (end). Moves c towards target
 * (model space) with weight, bending b towards `pole` (a direction). Bone
 * lengths never change. Returns the remaining error in metres.
 */
export function twoBone(sk: Skeleton, pose: Pose, w: World, a: number, b: number, c: number, target: V3, pole: V3, weight = 1, hipScale = 1): number {
  if (weight <= 0) return 0;
  const A = wpos(w, a), Bp = wpos(w, b), C = wpos(w, c);
  const la = len(sub(Bp, A)), lb = len(sub(C, Bp));
  const goal = weight >= 1 ? target : add(C, scale(sub(target, C), weight));
  const toT = sub(goal, A);
  const d = clamp(len(toT), Math.abs(la - lb) + 1e-4, la + lb - 1e-4);
  const dir = norm(toT);
  const cosA = clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  // The bend plane: the pole's component perpendicular to the reach direction.
  let side = sub(pole, scale(dir, dot(pole, dir)));
  if (len(side) < 1e-5) {
    // Pole parallel to the reach: keep the current bend.
    side = sub(Bp, add(A, scale(dir, dot(sub(Bp, A), dir))));
    if (len(side) < 1e-5) side = [0, 0, 1];
  }
  side = norm(side);
  const mid = add(add(A, scale(dir, cosA * la)), scale(side, sinA * la));
  rotateBoneWorld(sk, pose, w, a, fromTo(norm(sub(Bp, A)), norm(sub(mid, A))), hipScale);
  const B2 = wpos(w, b), C2 = wpos(w, c);
  rotateBoneWorld(sk, pose, w, b, fromTo(norm(sub(C2, B2)), norm(sub(goal, B2))), hipScale);
  return len(sub(wpos(w, c), target));
}

/** Leg IK helper: knee bends forward (character +Z) and slightly out. */
export function legIK(sk: Skeleton, pose: Pose, w: World, side: "L" | "R", ankle: V3, weight = 1, kneeDir: V3 = [0, 0, 1], hipScale = 1): number {
  const [a, b, c] = side === "L" ? [B.LUpLeg, B.LLeg, B.LFoot] : [B.RUpLeg, B.RLeg, B.RFoot];
  const out = side === "L" ? 0.12 : -0.12;
  return twoBone(sk, pose, w, a, b, c, ankle, norm([kneeDir[0] + out, kneeDir[1], kneeDir[2]]), weight, hipScale);
}

/** Arm IK helper: elbow bends down, back and out. */
export function armIK(sk: Skeleton, pose: Pose, w: World, side: "L" | "R", wrist: V3, weight = 1, elbow: V3 | null = null, hipScale = 1): number {
  const [a, b, c] = side === "L" ? [B.LArm, B.LForeArm, B.LHand] : [B.RArm, B.RForeArm, B.RHand];
  const pole: V3 = elbow ?? [side === "L" ? 0.55 : -0.55, -0.8, -0.35];
  return twoBone(sk, pose, w, a, b, c, wrist, norm(pole), weight, hipScale);
}

/** Point a bone's local axis (given in model space at the current pose) along a direction. */
export function aimBone(sk: Skeleton, pose: Pose, w: World, bone: number, child: number, dir: V3, weight = 1, hipScale = 1): void {
  const cur = norm(sub(wpos(w, child), wpos(w, bone)));
  const goal = norm(add(scale(cur, 1 - weight), scale(norm(dir), weight)));
  rotateBoneWorld(sk, pose, w, bone, fromTo(cur, goal), hipScale);
}

/**
 * Look-at (plan §4.3): yaw and pitch towards a model-space point, shared
 * Spine2 20 % / Neck 30 % / Head 50 %, clamped to yaw ±70°, pitch ±30°.
 * Returns the applied [yaw, pitch] in radians.
 */
export function lookAt(sk: Skeleton, pose: Pose, w: World, target: V3, weight = 1, hipScale = 1, maxYaw = 1.22, maxPitch = 0.52): [number, number] {
  if (weight <= 0) return [0, 0];
  const head = wpos(w, B.Head);
  const eye: V3 = [head[0], head[1] + 0.09, head[2]];
  const to = sub(target, eye);
  // Current head facing (model space): the head's +Z in the bind pose maps to forward.
  const hf = rotV(w.rot, B.Head * 4, rotV(conjArr(sk.restRot, B.Head), 0, [0, 0, 1]));
  const yawNow = Math.atan2(hf[0], hf[2]);
  const yawTo = Math.atan2(to[0], to[2]);
  let dy = yawTo - yawNow;
  while (dy > Math.PI) dy -= 2 * Math.PI;
  while (dy < -Math.PI) dy += 2 * Math.PI;
  const yaw = clamp(dy, -maxYaw, maxYaw) * weight;
  const pitchTo = Math.atan2(-to[1], Math.hypot(to[0], to[2]));
  const pitchNow = Math.atan2(-hf[1], Math.hypot(hf[0], hf[2]));
  const pitch = clamp(pitchTo - pitchNow, -maxPitch, maxPitch) * weight;
  const share: [number, number][] = [[B.Spine2, 0.2], [B.Neck, 0.3], [B.Head, 0.5]];
  for (const [bone, k] of share) {
    rotateBoneWorld(sk, pose, w, bone, axisAngle([0, 1, 0], yaw * k), hipScale);
    // Pitch about the character's current left-right axis after the yaw.
    const right = rotV(axisAngle([0, 1, 0], yawNow + yaw), 0, [1, 0, 0]);
    rotateBoneWorld(sk, pose, w, bone, axisAngle(right, pitch * k), hipScale);
  }
  return [yaw, pitch];
}

function conjArr(a: Float32Array, i: number): Float32Array {
  return new Float32Array([-a[i * 4]!, -a[i * 4 + 1]!, -a[i * 4 + 2]!, a[i * 4 + 3]!]);
}

const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"] as const;
export type Finger = (typeof FINGERS)[number];

/**
 * Curl a finger towards the palm: amount 0 (straight) .. 1 (fist). The bend
 * axis is found from the hand's own geometry (palm normal x finger
 * direction), so it works for both hands and any wrist angle.
 */
export function curlFinger(sk: Skeleton, pose: Pose, w: World, side: "L" | "R", finger: Finger, amount: number, hipScale = 1): void {
  const pre = side === "L" ? "Left" : "Right";
  const idx = (n: number) => BONE_BY_NAME[`${pre}Hand${finger}${n}`]!;
  const hand = side === "L" ? B.LHand : B.RHand;
  const mid1 = BONE_BY_NAME[`${pre}HandMiddle1`]!, idx1 = BONE_BY_NAME[`${pre}HandIndex1`]!, pinky1 = BONE_BY_NAME[`${pre}HandPinky1`]!;
  const H = wpos(w, hand);
  const fdir = norm(sub(wpos(w, mid1), H));
  const across = norm(sub(wpos(w, idx1), wpos(w, pinky1)));
  // Palm normal: for the left hand index->pinky x finger points to the palm side.
  let palm = norm(cross(fdir, across));
  if (side === "R") palm = scale(palm, -1);
  const axis = norm(cross(fdir, palm));
  const per = finger === "Thumb" ? [0.35, 0.55, 0.5] : [0.95, 1.4, 0.9];
  for (let j = 1; j <= 3; j++) {
    const ang = amount * per[j - 1]!;
    if (finger === "Thumb") {
      // The thumb folds across the palm.
      rotateBoneWorld(sk, pose, w, idx(j), axisAngle(norm(add(axis, scale(fdir, 0.6))), ang * (side === "L" ? 1 : -1)), hipScale);
    } else rotateBoneWorld(sk, pose, w, idx(j), axisAngle(axis, ang), hipScale);
  }
}

/** Hand shapes for gestures and grips. */
export function handShape(sk: Skeleton, pose: Pose, w: World, side: "L" | "R", shape: "open" | "fist" | "grip" | "horns" | "point" | "relaxed" | "pinch", hipScale = 1): void {
  const c: Record<Finger, number> =
    shape === "fist" ? { Thumb: 0.9, Index: 1, Middle: 1, Ring: 1, Pinky: 1 }
    : shape === "grip" ? { Thumb: 0.6, Index: 0.75, Middle: 0.8, Ring: 0.85, Pinky: 0.85 }
    : shape === "horns" ? { Thumb: 0.95, Index: 0, Middle: 1, Ring: 1, Pinky: 0.02 }
    : shape === "point" ? { Thumb: 0.8, Index: 0, Middle: 1, Ring: 1, Pinky: 1 }
    : shape === "pinch" ? { Thumb: 0.55, Index: 0.55, Middle: 0.6, Ring: 0.7, Pinky: 0.75 }
    : shape === "relaxed" ? { Thumb: 0.2, Index: 0.25, Middle: 0.3, Ring: 0.35, Pinky: 0.4 }
    : { Thumb: 0, Index: 0, Middle: 0, Ring: 0, Pinky: 0 };
  for (const f of FINGERS) curlFinger(sk, pose, w, side, f, c[f], hipScale);
}

/** Recompute everything (after many local edits). */
export function refreshAll(sk: Skeleton, pose: Pose, w: World, hipScale = 1): World {
  return fk(sk, pose, w, hipScale);
}
