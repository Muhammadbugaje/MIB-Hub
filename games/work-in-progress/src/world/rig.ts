/**
 * The rig layer: poses and gestures on top of the animation clips.
 *
 * The CC0 bases ship idle, walk, run and a few extras (wave, interact, clap,
 * sit, punch, fall...). The script needs more: point, phone, write, eat, hug,
 * nod, shake_head, look, gesture, shock, laugh, kneel, facepalm, cheer, carry,
 * sit on a chair for rigs without a sit clip, and pedalling a bicycle.
 *
 * Every pose here is built from *aim constraints* and *two-bone IK* that work
 * in world space from the bones' own positions, so they do not depend on how
 * each rig's bones are oriented (the two Quaternius rigs differ):
 *
 *   aim(bone, child, dir)   turn a bone so the line to its child points along dir
 *   ik(hip, knee, target)   bend a leg (or an arm) so its end reaches a point
 *
 * Directions are given in the character's own frame (x left, y up, z forward;
 * a character facing +z has its right hand on -x) and turned into world space
 * with the root's rotation. The layer runs after the animation system each
 * frame (PlayCanvas fires the app "update" event after "animationUpdate"),
 * blends in and out over 0.25 s (plan rule A9: no pops), and only ever writes
 * absolute targets for limbs, so it never drifts.
 */
import * as pc from "playcanvas";

export type GestureName =
  | "wave" | "point" | "phone" | "write" | "eat" | "hug" | "nod" | "shake_head" | "gesture" | "shock" | "laugh"
  | "facepalm" | "cheer" | "carry" | "kneel" | "sit" | "look" | "stand" | "sleep" | "clap" | "hold_torch" | "oath";

/** Gestures that are poses held until replaced (the others play once and fade). */
export const HELD: ReadonlySet<GestureName> = new Set<GestureName>(["sit", "kneel", "carry", "phone", "hold_torch", "sleep", "oath"]);

/** How long a one-shot gesture lasts, seconds. */
export const GESTURE_TIME: Partial<Record<GestureName, number>> = {
  wave: 2.4, point: 2.2, write: 3, eat: 3.2, hug: 3.2, nod: 1.4, shake_head: 1.6, gesture: 2.8, shock: 1.8, laugh: 2.4,
  facepalm: 2.2, cheer: 2.4, clap: 2.4, stand: 0.6, look: 0,
};

const V = () => new pc.Vec3();
const tmpQ = new pc.Quat();
const rwWorld = new pc.Quat();
const rwParent = new pc.Quat();
const tmpM = new pc.Mat4();

/** Quaternion that turns unit vector a onto unit vector b. */
export function fromTo(a: pc.Vec3, b: pc.Vec3, out = new pc.Quat()): pc.Quat {
  const d = Math.max(-1, Math.min(1, a.dot(b)));
  if (d > 0.999999) return out.set(0, 0, 0, 1);
  if (d < -0.999999) {
    // Opposite: any perpendicular axis.
    const axis = Math.abs(a.x) < 0.9 ? new pc.Vec3(1, 0, 0) : new pc.Vec3(0, 1, 0);
    const c = new pc.Vec3().cross(a, axis).normalize();
    return out.setFromAxisAngle(c, 180);
  }
  const c = new pc.Vec3().cross(a, b);
  out.set(c.x, c.y, c.z, 1 + d);
  return out.normalize();
}

/** Spherical blend between two unit vectors (by angle). */
function blendDir(a: pc.Vec3, b: pc.Vec3, t: number, out: pc.Vec3): pc.Vec3 {
  out.lerp(a, b, t);
  if (out.lengthSq() < 1e-6) out.copy(t < 0.5 ? a : b);
  return out.normalize();
}

/** Turn a node (world rotation multiplied by q on the left), keeping its parent. */
/** The rig currently applying poses (rotateWorld records the bones it touches there). */
const current: { rig: Rig | null } = { rig: null };

function rotateWorld(node: pc.GraphNode, q: pc.Quat): void {
  current.rig?.touch(node);
  // Own temporaries: callers often pass tmpQ as q (never alias the two).
  const world = rwWorld.copy(node.getRotation());
  const nw = world.mul2(q.clone(), world);
  const parent = node.parent;
  if (parent) {
    const pinv = rwParent.copy(parent.getRotation()).invert();
    node.setLocalRotation(pinv.mul(nw));
  } else node.setLocalRotation(nw);
}

interface Chain { a: pc.GraphNode; b: pc.GraphNode; /** the end point in b's local space (b's "tail") */ tail: pc.Vec3; lenA: number; lenB: number; end?: pc.GraphNode; endIsChild: boolean }

/**
 * One character's bones and procedural layer. Created per Person.
 */
export class Rig {
  readonly root: pc.Entity;
  readonly bones: Record<string, pc.GraphNode | null> = {};
  private legs: Chain[] = [];
  private arms: Chain[] = [];
  /** The hips' rest position (local): poses offset from it, so they never accumulate when a clip leaves the hips alone. */
  private hipsRestLocal: pc.Vec3 | null = null;
  /** Hip bone rest height above the feet (for sitting and kneeling). */
  private hipRest = 0.9;
  private scale = 1;
  /** Active gesture and its timing. */
  gesture: GestureName | null = null;
  private gT = 0;
  private gDur = 0;
  /** 0..1 weight of the current gesture layer. */
  private w = 0;
  private wanted: GestureName | null = null;
  /** Look-at target (world); null = none. */
  lookAt: pc.Vec3 | null = null;
  private lookW = 0;
  /** Pedalling: phase in radians from distance travelled (rule A3); null when not riding. */
  pedal: { phase: number; seatY: number; crankY: number; crankZ: number; crankR: number; handZ: number; handY: number } | null = null;
  /** Height of the seat for "sit" (metres above the root), when the rig has no sit clip. */
  seatHeight = 0.46;
  /** Freeze head turns (stone statues are posed once). */
  headTurn = { yaw: 0, pitch: 0 };

  constructor(root: pc.Entity, model: pc.Entity, scale: number) {
    this.root = root;
    this.scale = scale;
    for (const n of ["Hips", "Abdomen", "Torso", "Chest", "Neck", "Head", "Shoulder.L", "Shoulder.R", "UpperArm.L", "UpperArm.R", "LowerArm.L", "LowerArm.R", "Wrist.L", "Wrist.R", "Palm.L", "Palm.R", "UpperLeg.L", "UpperLeg.R", "LowerLeg.L", "LowerLeg.R", "Foot.L", "Foot.R"]) {
      this.bones[n] = model.findByName(n);
    }
    root.syncHierarchy();
    const mk = (a: string, b: string, end: string[]): Chain | null => {
      const A = this.bones[a], B = this.bones[b];
      if (!A || !B) return null;
      const E = end.map((n) => this.bones[n]).find((x) => !!x) ?? null;
      const pa = A.getPosition().clone(), pb = B.getPosition().clone();
      const pe = E ? E.getPosition().clone() : pb.clone().add(pb.clone().sub(pa).mulScalar(0.9));
      const inv = new pc.Mat4().copy(B.getWorldTransform()).invert();
      const tail = inv.transformPoint(pe, new pc.Vec3());
      let isChild = false;
      for (let p: pc.GraphNode | null = E; p; p = p.parent) if (p === B) isChild = true;
      return { a: A, b: B, tail, lenA: pa.distance(pb), lenB: pb.distance(pe), end: E ?? undefined, endIsChild: isChild };
    };
    for (const s of ["L", "R"]) {
      const leg = mk(`UpperLeg.${s}`, `LowerLeg.${s}`, [`Foot.${s}`]);
      if (leg) this.legs.push(leg);
      const arm = mk(`UpperArm.${s}`, `LowerArm.${s}`, [`Wrist.${s}`, `Palm.${s}`]);
      if (arm) this.arms.push(arm);
    }
    const hips = this.bones.Hips;
    if (hips) {
      this.hipRest = Math.max(0.5, hips.getPosition().y - root.getPosition().y);
      this.hipsRestLocal = hips.getLocalPosition().clone();
    }
  }

  /** The body pose held under the gestures (sitting, kneeling): its own layer, so eating while seated keeps you seated. */
  bodyPose: "sit" | "kneel" | "sleep" | null = null;
  private poseW = 0;
  get debugPoseW(): number {
    return this.poseW;
  }
  private poseWanted: "sit" | "kneel" | "sleep" | null = null;

  /** Start a gesture (one-shot or held). null releases a held pose and any gesture. */
  play(g: GestureName | null): void {
    if (g === "sit" || g === "kneel" || g === "sleep") {
      this.poseWanted = g;
      if (!this.bodyPose || this.bodyPose === g || this.poseW <= 0.01) this.bodyPose = g;
      return;
    }
    if (g === null) this.poseWanted = null;
    this.wanted = g;
    if (g && g !== this.gesture) {
      this.gesture = g;
      this.gT = 0;
      this.gDur = HELD.has(g) ? Infinity : GESTURE_TIME[g] ?? 2;
    }
  }

  get busy(): boolean {
    return (!!this.gesture && this.w > 0.01) || (!!this.bodyPose && this.poseW > 0.01);
  }

  /** Character-frame direction to world. */
  private dir(x: number, y: number, z: number, out: pc.Vec3): pc.Vec3 {
    const q = this.root.getRotation();
    return q.transformVector(out.set(x, y, z), out).normalize();
  }

  /** Point a bone's line-to-child along a world direction, blended by weight. */
  private aim(node: pc.GraphNode, childWorld: pc.Vec3, want: pc.Vec3, weight: number): void {
    if (weight <= 0.001) return;
    const p = node.getPosition();
    const cur = V().sub2(childWorld, p);
    if (cur.lengthSq() < 1e-8) return;
    cur.normalize();
    const goal = blendDir(cur, want, weight, V());
    rotateWorld(node, fromTo(cur, goal));
  }

  /** Current world position of a chain's end. */
  private endOf(c: Chain, out: pc.Vec3): pc.Vec3 {
    return c.b.getWorldTransform().transformPoint(c.tail, out);
  }

  /**
   * Two-bone IK: bend chain c so its end reaches `target` (world), with the
   * middle joint bending towards `pole` (world direction). Weight blends.
   */
  private ik(c: Chain, target: pc.Vec3, pole: pc.Vec3, weight: number): void {
    if (weight <= 0.001) return;
    const A = c.a.getPosition().clone();
    const endNow = this.endOf(c, V());
    const goal = V().lerp(endNow, target, weight);
    const la = c.lenA, lb = c.lenB;
    const toT = V().sub2(goal, A);
    let d = toT.length();
    d = Math.max(Math.abs(la - lb) + 1e-3, Math.min(la + lb - 1e-3, d));
    const dirT = toT.normalize();
    // Knee/elbow position: in the plane of dirT and the pole.
    const cosA = (la * la + d * d - lb * lb) / (2 * la * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const side = V().copy(pole).sub(V().copy(dirT).mulScalar(pole.dot(dirT)));
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    side.normalize();
    const mid = V().copy(A).add(V().copy(dirT).mulScalar(cosA * la)).add(V().copy(side).mulScalar(sinA * la));
    // Upper bone: aim its child (the middle joint) at mid.
    const bNow = c.b.getPosition().clone();
    const cur1 = V().sub2(bNow, A).normalize();
    const want1 = V().sub2(mid, A).normalize();
    rotateWorld(c.a, fromTo(cur1, want1));
    // Lower bone: aim its end at the goal.
    const B2 = c.b.getPosition().clone();
    const end2 = this.endOf(c, V());
    const cur2 = V().sub2(end2, B2).normalize();
    const want2 = V().sub2(goal, B2).normalize();
    rotateWorld(c.b, fromTo(cur2, want2));
    // Rigs whose foot is not a child of the shin (the IK-style rigs): move the foot itself.
    if (c.end && !c.endIsChild) {
      this.touch(c.end);
      c.end.setPosition(goal);
    }
  }

  /** Lower the hips by dy metres (world), keeping the root where it is. */
  /** Put the hips at height y above the root (blended by w), shifted fwd metres: absolute every frame (never accumulates). */
  private hipsAt(y: number, fwd: number, w: number): void {
    const h = this.bones.Hips;
    if (!h || !this.hipsRestLocal || w <= 0.001) return;
    const p = h.parent ? h.parent.getWorldTransform().transformPoint(this.hipsRestLocal, new pc.Vec3()) : this.hipsRestLocal.clone();
    const f = this.dir(0, 0, 1, V());
    const ry = this.root.getPosition().y;
    p.y = p.y + (ry + y - p.y) * w;
    p.add(f.mulScalar(fwd * w));
    this.touch(h);
    h.setPosition(p);
  }

  /** Bend the spine forward (+) or back (-) by an angle in degrees about the character's left-right axis. */
  private bend(deg: number, bone = "Torso"): void {
    const n = this.bones[bone] ?? this.bones.Abdomen;
    if (!n || Math.abs(deg) < 0.01) return;
    const axis = this.dir(1, 0, 0, V());
    rotateWorld(n, tmpQ.setFromAxisAngle(axis, deg));
  }

  private turnHead(yawDeg: number, pitchDeg: number): void {
    const n = this.bones.Head ?? this.bones.Neck;
    if (!n) return;
    if (Math.abs(yawDeg) > 0.01) rotateWorld(n, tmpQ.setFromAxisAngle(pc.Vec3.UP, yawDeg));
    if (Math.abs(pitchDeg) > 0.01) rotateWorld(n, tmpQ.setFromAxisAngle(this.dir(1, 0, 0, V()), pitchDeg));
  }

  /** Arm targets in the character frame: hand position (x, y, z) relative to the shoulder bone. */
  private armTo(side: 0 | 1, x: number, y: number, z: number, weight: number, elbowOut = 1): void {
    const c = this.arms[side];
    if (!c) return;
    const sh = c.a.getPosition();
    const off = this.dir(x, y, z, V()).mulScalar(Math.hypot(x, y, z) * this.scaleK());
    const target = V().add2(sh, off);
    // Elbows bend down and out.
    const pole = this.dir(side === 0 ? 0.6 * elbowOut : -0.6 * elbowOut, -1, -0.3, V());
    this.ik(c, target, pole, weight);
  }

  private scaleK(): number {
    // Arm lengths in the rig are measured in world units already; offsets are in metres.
    return 1;
  }

  /**
   * Bones this layer changed last frame: { before: the clip's pose, after: ours }.
   * A clip that does not key a bone (many leave the spine and hips alone) would
   * otherwise let our relative turns pile up frame after frame; restoring the
   * clip's pose first keeps every pose absolute.
   */
  private touched = new Map<pc.GraphNode, { before: pc.Quat; after: pc.Quat; pos: pc.Vec3 | null; posAfter: pc.Vec3 | null }>();

  touch(node: pc.GraphNode): void {
    if (!this.touched.has(node)) this.touched.set(node, { before: node.getLocalRotation().clone(), after: new pc.Quat(), pos: node.getLocalPosition().clone(), posAfter: null });
  }

  /** Called once per rendered frame after the clips have been applied. */
  update(dt: number): void {
    // Put back what the clip did not rewrite since our last frame.
    for (const [node, rec] of this.touched) {
      if (node.getLocalRotation().equals(rec.after)) node.setLocalRotation(rec.before);
      if (rec.posAfter && rec.pos && node.getLocalPosition().equals(rec.posAfter)) node.setLocalPosition(rec.pos);
    }
    this.touched.clear();
    current.rig = this as Rig;
    try {
      this.apply(dt);
    } finally {
      current.rig = null;
    }
    for (const [node, rec] of this.touched) {
      rec.after.copy(node.getLocalRotation());
      rec.posAfter = node.getLocalPosition().clone();
    }
  }

  private apply(dt: number): void {
    // Blend the gesture layer.
    if (this.gesture) {
      this.gT += dt;
      const ending = !HELD.has(this.gesture) ? this.gT > this.gDur - 0.25 : this.wanted !== this.gesture;
      this.w = ending ? Math.max(0, this.w - dt / 0.25) : Math.min(1, this.w + dt / 0.25);
      if (ending && this.w <= 0) {
        this.gesture = null;
        this.w = 0;
      }
    }
    this.lookW = this.lookAt ? Math.min(1, this.lookW + dt * 3) : Math.max(0, this.lookW - dt * 3);
    // The body pose layer (sit / kneel), blended in and out over 0.3 s.
    if (this.bodyPose) {
      const on = this.poseWanted === this.bodyPose;
      this.poseW = on ? Math.min(1, this.poseW + dt / 0.3) : Math.max(0, this.poseW - dt / 0.3);
      if (!on && this.poseW <= 0) this.bodyPose = this.poseWanted;
    }
    if (this.pedal) this.applyPedal();
    if (this.bodyPose && this.poseW > 0) this.applyGesture(this.bodyPose, this.poseW, 0);
    if (this.gesture && this.w > 0) this.applyGesture(this.gesture, this.w, this.gT);
    if (this.lookW > 0.001 && this.lookAt) this.applyLook(this.lookAt, this.lookW);
    else if (this.headTurn.yaw || this.headTurn.pitch) this.turnHead(this.headTurn.yaw, this.headTurn.pitch);
  }

  private applyLook(t: pc.Vec3, w: number): void {
    const head = this.bones.Head;
    if (!head) return;
    const hp = head.getPosition();
    const to = V().sub2(t, hp);
    const fwd = this.dir(0, 0, 1, V());
    // Yaw relative to the body, clamped to a natural range.
    const yawTo = Math.atan2(to.x, to.z) - Math.atan2(fwd.x, fwd.z);
    let y = ((yawTo + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    y = Math.max(-1.1, Math.min(1.1, y));
    const pitch = Math.max(-0.5, Math.min(0.45, -Math.atan2(to.y, Math.hypot(to.x, to.z))));
    this.turnHead((y * 180 / Math.PI) * w * 0.75, (pitch * 180 / Math.PI) * w * 0.7);
    const torso = this.bones.Torso ?? this.bones.Abdomen;
    if (torso) rotateWorld(torso, tmpQ.setFromAxisAngle(pc.Vec3.UP, (y * 180 / Math.PI) * w * 0.25));
  }

  private legsTo(seatDrop: number, footFwd: number, footY: number, weight: number, kneel = false): void {
    // Feet on the floor in front of the hips; knees bend forward.
    const root = this.root.getPosition();
    const fwd = this.dir(0, 0, 1, V());
    this.legs.forEach((c, i) => {
      const hip = c.a.getPosition();
      const side = V().sub2(hip, this.bones.Hips?.getPosition() ?? hip);
      side.y = 0;
      const tgt = V().copy(root).add(side.mulScalar(1.1)).add(V().copy(fwd).mulScalar(kneel && i === 1 ? -0.42 : footFwd));
      tgt.y = root.y + (kneel && i === 1 ? footY + 0.02 : footY);
      this.ik(c, tgt, kneel && i === 1 ? V().copy(fwd).mulScalar(1).add(new pc.Vec3(0, -1, 0)).normalize() : fwd, weight);
    });
    void seatDrop;
  }

  private applyGesture(g: GestureName, w: number, t: number): void {
    const osc = (hz: number) => Math.sin(t * hz * Math.PI * 2);
    switch (g) {
      case "wave":
        this.armTo(1, -0.28, 0.42, 0.12 + 0.05 * osc(1.6), w);
        break;
      case "point":
        this.armTo(1, -0.12, 0.12, 0.58, w);
        break;
      case "phone":
        this.armTo(1, -0.06, 0.18, 0.08, w, 1.4);
        this.turnHead(-8 * w, 6 * w);
        break;
      case "hold_torch":
        this.armTo(1, -0.1, -0.05, 0.5, w);
        break;
      case "write":
        this.armTo(1, -0.05, -0.28, 0.36 + 0.03 * osc(2.2), w);
        this.bend(14 * w);
        this.turnHead(0, 16 * w);
        break;
      case "eat": {
        const up = Math.max(0, osc(0.7));
        this.armTo(1, -0.06, -0.25 + up * 0.38, 0.26 - up * 0.1, w);
        this.armTo(0, 0.12, -0.3, 0.28, w);
        break;
      }
      case "hug":
        this.armTo(0, 0.12, -0.02, 0.36, w);
        this.armTo(1, -0.12, -0.02, 0.36, w);
        this.bend(8 * w);
        break;
      case "carry":
        this.armTo(0, 0.18, -0.12, 0.34, w);
        this.armTo(1, -0.18, -0.12, 0.34, w);
        break;
      case "nod":
        this.turnHead(0, 14 * w * Math.max(0, osc(1.6)));
        break;
      case "shake_head":
        this.turnHead(18 * w * osc(1.8), 0);
        break;
      case "gesture":
        this.armTo(1, -0.22, -0.12 + 0.07 * osc(1.1), 0.34, w);
        this.armTo(0, 0.2, -0.2 + 0.05 * osc(0.9), 0.3, w * 0.8);
        break;
      case "shock":
        this.armTo(0, 0.38, 0.1, 0.22, w);
        this.armTo(1, -0.38, 0.1, 0.22, w);
        this.bend(-10 * w);
        this.turnHead(0, -8 * w);
        break;
      case "laugh":
        this.bend((6 + 4 * osc(3)) * w);
        this.turnHead(0, -10 * w * Math.abs(osc(3)));
        this.armTo(0, 0.12, -0.32, 0.18, w * 0.7);
        break;
      case "facepalm":
        this.armTo(1, -0.04, 0.22, 0.12, w, 1.6);
        this.turnHead(0, 18 * w);
        break;
      case "cheer":
        this.armTo(0, 0.18, 0.55, 0.05, w);
        this.armTo(1, -0.18, 0.55, 0.05, w);
        break;
      case "clap": {
        const c = 0.06 + 0.06 * Math.abs(osc(2.4));
        this.armTo(0, c, -0.1, 0.32, w);
        this.armTo(1, -c, -0.1, 0.32, w);
        break;
      }
      case "oath":
        this.armTo(1, -0.26, 0.36, 0.1, w);
        break;
      case "sit": {
        // Thighs level on the seat, shins straight down: feet under the knees.
        this.hipsAt(this.seatHeight + 0.09, -0.2, w);
        this.legsTo(0, this.seatHeight < 0.2 ? 0.55 : 0.3, 0.06, w);
        break;
      }
      case "kneel": {
        // One knee down: hips low, the front foot flat, the back knee on the ground.
        this.hipsAt(Math.min(this.hipRest, 0.5), 0.04, w);
        this.legsTo(0, 0.36, 0.08, w, true);
        this.bend(12 * w);
        this.armTo(1, -0.14, -0.42, 0.36, w);
        break;
      }
      case "sleep":
        this.bend(-6 * w);
        break;
      case "stand":
      case "look":
        break;
    }
  }

  /** Seated on a bicycle: hips on the saddle, hands on the bars, feet on the pedals. */
  private applyPedal(): void {
    const p = this.pedal!;
    const root = this.root.getPosition();
    const hips = this.bones.Hips;
    if (hips) {
      const hp = hips.getPosition().clone();
      hp.y = root.y + p.seatY + 0.06;
      this.touch(hips);
      hips.setPosition(hp);
    }
    this.bend(16);
    const fwd = this.dir(0, 0, 1, V());
    this.legs.forEach((c, i) => {
      const a = p.phase + (i === 0 ? 0 : Math.PI);
      const hip = c.a.getPosition();
      const side = V().sub2(hip, hips?.getPosition() ?? hip);
      side.y = 0;
      const tgt = V().copy(root).add(side.mulScalar(1.6)).add(V().copy(fwd).mulScalar(p.crankZ + Math.cos(a) * p.crankR));
      tgt.y = root.y + p.crankY + Math.sin(a) * p.crankR;
      this.ik(c, tgt, fwd, 1);
    });
    // Hands on the handlebars.
    this.arms.forEach((c, i) => {
      const sh = c.a.getPosition();
      const tgt = V().copy(root).add(V().copy(fwd).mulScalar(p.handZ)).add(this.dir(i === 0 ? 0.24 : -0.24, 0, 0, V()).mulScalar(1));
      tgt.y = root.y + p.handY;
      void sh;
      this.ik(c, tgt, this.dir(i === 0 ? 0.5 : -0.5, -1, -0.2, V()), 1);
    });
  }
}

/** For tests: the world-space aim helper as a pure function on vectors. */
export function aimQuat(cur: pc.Vec3, want: pc.Vec3): pc.Quat {
  return fromTo(cur.clone().normalize(), want.clone().normalize());
}

void tmpM;
