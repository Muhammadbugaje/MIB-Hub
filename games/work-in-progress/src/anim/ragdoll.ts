/**
 * Active-ragdoll "lite" for knock-downs and falls (owner, 16 Nov: "model
 * dummies, like GTA 4... they react freely", but light on the browser).
 *
 * Not a physics engine: 15 Verlet particles at the main joints (pelvis,
 * chest, head, shoulders, elbows, hands, hips, knees, feet), held together
 * by distance constraints (bone lengths, cross-braced torso, limits so knees
 * and elbows never fold through the body), gravity, ground contact with
 * friction, and an optional wall push-out. A body takes about 0.1 ms per
 * step. The pose is rebuilt from the particles every frame by aiming the
 * bones, starting from the last animated pose (so twists and fingers stay
 * natural). When the body has settled, the Animator blends into a get-up
 * clip chosen by how it landed (face up or face down).
 *
 * Ideas from: Thomas Jakobsen, "Advanced Character Physics" (GDC 2001, the
 * Hitman ragdoll: Verlet + constraint relaxation); NaturalMotion Euphoria
 * talks (pose-driven active ragdolls, blending back to animation);
 * Unity/Godot "active ragdoll" write-ups (PD-driven joints towards an
 * animated target; here simplified to springs towards the snapshot pose).
 */
import { aimBone, rotateBoneWorld } from "./ik.ts";
import { clamp, cross, fromTo, norm, sub, type V3 } from "./math.ts";
import { B, type Pose, type Skeleton, type World, copyPose, fk, newPose, newWorld, wpos } from "./skeleton.ts";

const P = [B.Hips, B.Spine2, B.Head, B.LArm, B.LForeArm, B.LHand, B.RArm, B.RForeArm, B.RHand, B.LUpLeg, B.LLeg, B.LFoot, B.RUpLeg, B.RLeg, B.RFoot] as const;
const I = Object.fromEntries(P.map((b, i) => [b, i])) as Record<number, number>;
/** Particle radii (m): how far above the ground each part rests. */
const RAD = [0.12, 0.13, 0.11, 0.07, 0.05, 0.04, 0.07, 0.05, 0.04, 0.08, 0.06, 0.05, 0.08, 0.06, 0.05];

interface Link { a: number; b: number; len: number; min?: boolean }

export class Ragdoll {
  private x: V3[] = P.map(() => [0, 0, 0]);
  private px: V3[] = P.map(() => [0, 0, 0]);
  private links: Link[] = [];
  private t = 0;
  private snapshot: Pose = newPose();
  private w: World = newWorld();
  private hipScale = 1;
  private ground: ((x: number, z: number) => number) | null = null;
  private collide: ((p: V3) => V3) | null = null;
  /** Set when the body has settled. */
  faceUp = true;
  restYaw = 0;
  /** Lowest point any particle reached relative to the ground (tests: never below 0). */
  minClearance = Infinity;

  constructor(private sk: Skeleton) {}

  start(pose: Pose, world: World, impulse: V3, hipScale: number, ground: ((x: number, z: number) => number) | null, collide: ((p: V3) => V3) | null): void {
    copyPose(pose, this.snapshot);
    this.hipScale = hipScale;
    this.ground = ground;
    this.collide = collide;
    this.t = 0;
    this.minClearance = Infinity;
    P.forEach((b, i) => {
      const p = wpos(world, b);
      this.x[i] = p;
      // Impulse: strongest on the chest, the feet trip (opposite) a little so the body tips over.
      const k = b === B.Spine2 || b === B.Head ? 1.1 : b === B.LFoot || b === B.RFoot ? -0.35 : 0.7;
      const dt = 1 / 60;
      this.px[i] = [p[0] - impulse[0] * k * dt, p[1] - impulse[1] * dt - (b === B.Head ? 0.01 : 0), p[2] - impulse[2] * k * dt];
    });
    const L = (a: number, b: number, min = false) => {
      const ia = I[a]!, ib = I[b]!;
      const pa = this.x[ia]!, pb = this.x[ib]!;
      this.links.push({ a: ia, b: ib, len: Math.hypot(...sub(pa, pb)), min });
    };
    this.links = [];
    // Torso (cross-braced: it stays a rigid-ish box).
    for (const [a, b] of [[B.Hips, B.Spine2], [B.Spine2, B.Head], [B.Hips, B.Head], [B.Spine2, B.LArm], [B.Spine2, B.RArm], [B.LArm, B.RArm], [B.Hips, B.LUpLeg], [B.Hips, B.RUpLeg], [B.LUpLeg, B.RUpLeg], [B.LArm, B.LUpLeg], [B.RArm, B.RUpLeg], [B.LArm, B.RUpLeg], [B.RArm, B.LUpLeg], [B.Head, B.LArm], [B.Head, B.RArm]] as const) L(a, b);
    // Limbs.
    for (const [a, b] of [[B.LArm, B.LForeArm], [B.LForeArm, B.LHand], [B.RArm, B.RForeArm], [B.RForeArm, B.RHand], [B.LUpLeg, B.LLeg], [B.LLeg, B.LFoot], [B.RUpLeg, B.RLeg], [B.RLeg, B.RFoot]] as const) L(a, b);
    // Limits: a limb can bend but never fold flat through itself.
    for (const [a, b, k] of [[B.LArm, B.LHand, 0.45], [B.RArm, B.RHand, 0.45], [B.LUpLeg, B.LFoot, 0.55], [B.RUpLeg, B.RFoot, 0.55]] as const) {
      const ia = I[a]!, ib = I[b]!;
      this.links.push({ a: ia, b: ib, len: Math.hypot(...sub(this.x[ia]!, this.x[ib]!)) * k, min: true });
    }
  }

  /** Advance; writes the pose. Returns true once the body has settled. */
  step(dt: number, out: Pose): boolean {
    const h = Math.min(dt, 1 / 30);
    const sub2 = 2;
    let maxV = 0;
    for (let s = 0; s < sub2; s++) {
      const d = h / sub2;
      for (let i = 0; i < P.length; i++) {
        const x = this.x[i]!, p = this.px[i]!;
        const g = this.groundY(x) + RAD[i]!;
        const onGround = x[1] <= g + 0.01;
        const fr = onGround ? 0.82 : 0.995; // friction on the ground, air drag
        const vx = (x[0] - p[0]) * fr, vy = (x[1] - p[1]) * 0.995, vz = (x[2] - p[2]) * fr;
        this.px[i] = [x[0], x[1], x[2]];
        this.x[i] = [x[0] + vx, x[1] + vy - 14 * d * d, x[2] + vz];
        maxV = Math.max(maxV, Math.hypot(vx, vy, vz) / d);
      }
      for (let it = 0; it < 6; it++) {
        for (const l of this.links) {
          const a = this.x[l.a]!, b = this.x[l.b]!;
          const dd = sub(b, a);
          const dist = Math.hypot(...dd) || 1e-6;
          if (l.min && dist >= l.len) continue;
          const diff = (dist - l.len) / dist / 2;
          a[0] += dd[0] * diff; a[1] += dd[1] * diff; a[2] += dd[2] * diff;
          b[0] -= dd[0] * diff; b[1] -= dd[1] * diff; b[2] -= dd[2] * diff;
        }
        for (let i = 0; i < P.length; i++) {
          const x = this.x[i]!;
          const g = this.groundY(x) + RAD[i]!;
          if (x[1] < g) x[1] = g;
          if (this.collide) {
            const c = this.collide(x);
            x[0] = c[0];
            x[2] = c[2];
          }
        }
      }
    }
    for (let i = 0; i < P.length; i++) this.minClearance = Math.min(this.minClearance, this.x[i]![1] - this.groundY(this.x[i]!) - RAD[i]! * 0.5);
    this.t += h;
    this.toPose(out);
    const settled = (this.t > 0.7 && maxV < 0.25) || this.t > 2.6;
    if (settled) {
      const chestFwd = this.bodyForward();
      this.faceUp = chestFwd[1] > 0;
      const hd = sub(this.x[I[B.Head]!]!, this.x[I[B.Hips]!]!);
      this.restYaw = Math.atan2(hd[0], hd[2]);
    }
    return settled;
  }

  private groundY(x: V3): number {
    return this.ground ? this.ground(x[0], x[2]) : 0;
  }

  private bodyForward(): V3 {
    const hips = this.x[I[B.Hips]!]!, chest = this.x[I[B.Spine2]!]!;
    const up = norm(sub(chest, hips));
    const left = norm(sub(this.x[I[B.LUpLeg]!]!, this.x[I[B.RUpLeg]!]!));
    return norm(cross(left, up));
  }

  /** Rebuild bone rotations from the particles (aiming each bone at its particle). */
  private toPose(out: Pose): void {
    const sk = this.sk, w = this.w, hs = this.hipScale;
    copyPose(this.snapshot, out);
    const hp = this.x[I[B.Hips]!]!;
    out.hips[0] = hp[0] / hs;
    out.hips[1] = hp[1] / hs;
    out.hips[2] = hp[2] / hs;
    fk(sk, out, w, hs);
    // Hips frame: up towards the chest, left from right hip to left hip.
    const up = norm(sub(this.x[I[B.Spine2]!]!, hp));
    const curUp = norm(sub(wpos(w, B.Spine2), wpos(w, B.Hips)));
    rotateBoneWorld(sk, out, w, B.Hips, fromTo(curUp, up), hs);
    const left = norm(sub(this.x[I[B.LUpLeg]!]!, this.x[I[B.RUpLeg]!]!));
    const curLeft = norm(sub(wpos(w, B.LUpLeg), wpos(w, B.RUpLeg)));
    // Twist about the up axis to match the hips' left-right line.
    const proj = (v: V3): V3 => norm(sub(v, [up[0] * (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]), up[1] * (v[0] * up[0] + v[1] * up[1] + v[2] * up[2]), up[2] * (v[0] * up[0] + v[1] * up[1] + v[2] * up[2])]));
    rotateBoneWorld(sk, out, w, B.Hips, fromTo(proj(curLeft), proj(left)), hs);
    const aim = (bone: number, child: number, target: number) => aimBone(sk, out, w, bone, child, sub(this.x[I[target]!]!, wpos(w, bone)), 1, hs);
    aim(B.Spine2, B.Neck, B.Head);
    for (const s of [["L", B.LArm, B.LForeArm, B.LHand, B.LUpLeg, B.LLeg, B.LFoot], ["R", B.RArm, B.RForeArm, B.RHand, B.RUpLeg, B.RLeg, B.RFoot]] as const) {
      aim(s[1], s[2], s[2]);
      aim(s[2], s[3], s[3]);
      aim(s[4], s[5], s[5]);
      aim(s[5], s[6], s[6]);
    }
    void clamp;
  }
}
