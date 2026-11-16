/**
 * The Animator: one per character. Turns "how fast am I going, am I in the
 * air, what should I be doing" into a pose every frame (plan §4.2 - §4.7).
 *
 * Layers, in order:
 *   1. base       locomotion blend space (idle, walk, jog, run, sprint) with
 *                 phase sync and stride matching (play rate = ground speed /
 *                 measured stride speed, so feet never slide, rule A1); or a
 *                 one-shot / held action (sit, kneel, dance, ride...); or the
 *                 air states (jump start, fall, land); or distance-matched
 *                 stops, turns in place and run pivots; or the ragdoll-lite;
 *   2. crossfade  every change of base state blends from a frozen snapshot of
 *                 the last pose (no pops, rule A9; the pose_pop test);
 *   3. upper      an upper-body clip (wave, phone, talk, eat, carry, horns...)
 *                 through a spine mask, so it plays while walking;
 *   4. reactive   the "physics-guided" layer (owner, 16 Nov): lean into turns
 *                 and from acceleration on a spring, shoulder and spine give
 *                 way on bumps and hits with damped springs and recover;
 *   5. IK         foot IK with pelvis drop on kerbs and steps, hands to
 *                 targets (handlebars, grips, a partner's back), head and eyes
 *                 look-at; only at LOD0 (near the camera).
 *
 * Pure maths, no engine: the same class runs headless in the feel tests.
 */
import { Clip } from "./clip.ts";
import { FEEL } from "./feel.ts";
import { armIK, lookAt, rotateBoneWorld, twoBone, handShape } from "./ik.ts";
import { axisAngle, clamp, nlerpInto, smooth01, type V3 } from "./math.ts";
import { AnimLibrary } from "./library.ts";
import { Ragdoll } from "./ragdoll.ts";
import { B, BONE_COUNT, MASKS, type MaskName, type Pose, Skeleton, copyPose, fk, newPose, newWorld, type World, wpos } from "./skeleton.ts";

export interface AnimInput {
  /** Ground speed (m/s). */
  speed: number;
  /** Change of speed (m/s^2): leans forward when speeding up, back when braking. */
  accel: number;
  /** Turn rate (rad/s, + = turning left). */
  turnRate: number;
  grounded: boolean;
  /** Vertical speed (m/s). */
  vy: number;
  /** The player let go of the stick: stop with a planted-foot stop clip. */
  stopping: boolean;
  /** Distance the controller will still travel before it stops (m), for distance matching. */
  stopDistance: number;
  crouch: boolean;
}

export interface PlayOpts {
  /** Blend-in time (s). */
  blend?: number;
  /** Loop a once clip / hold its last frame (sit, kneel). */
  hold?: boolean;
  /** Clip to continue into when a once clip ends (sit_down -> sit_idle). */
  then?: string;
  rate?: number;
  /** Seconds into the clip to start. */
  at?: number;
  /** Play on a body mask instead of the full body. */
  mask?: MaskName;
  /** For upper-body clips: how long to keep playing (s); loops repeat until then. */
  duration?: number;
  /** Model-space offset of the hips while this action plays (seat placement). */
  offset?: [number, number, number];
  /** Ignore the clip's root motion (sit down on the spot). */
  noRoot?: boolean;
}

type BaseState =
  | { k: "loco" }
  | { k: "action"; clip: Clip; t: number; rate: number; hold: boolean; then: string | null; offset: [number, number, number] | null; noRoot: boolean; ramp: boolean }
  | { k: "air"; clip: Clip; t: number; rate: number; running: boolean }
  | { k: "land"; clip: Clip; t: number; rate: number }
  | { k: "stop"; clip: Clip; t: number; dist: Float32Array; total: number; matched: boolean }
  | { k: "turn"; clip: Clip; t: number; scale: number }
  | { k: "pivot"; clip: Clip; t: number }
  | { k: "cycle"; clip: Clip; phase: number }
  | { k: "ragdoll" };

interface Upper { clip: Clip; t: number; w: number; until: number; mask: Float32Array; rate: number; fadeOut: boolean }

/** A damped angular spring (two axes, in the character's frame: x = pitch about +X, z = roll about +Z). */
class Spring2 {
  x = 0; z = 0; vx = 0; vz = 0;
  step(dt: number, k: number, zeta: number, tx = 0, tz = 0, max = 1): void {
    const ax = -k * k * (this.x - tx) - 2 * zeta * k * this.vx;
    const az = -k * k * (this.z - tz) - 2 * zeta * k * this.vz;
    this.vx += ax * dt;
    this.vz += az * dt;
    this.x = clamp(this.x + this.vx * dt, -max, max);
    this.z = clamp(this.z + this.vz * dt, -max, max);
  }
  get energy(): number {
    return Math.abs(this.x) + Math.abs(this.z) + 0.1 * (Math.abs(this.vx) + Math.abs(this.vz));
  }
}

const LOCO_POINTS = ["walk_fwd", "jog_fwd", "run_fwd", "sprint_fwd"] as const;

export class Animator {
  readonly sk: Skeleton;
  readonly lib: AnimLibrary;
  /** Scales clip hip motion and stride speeds to this body. */
  readonly hipScale: number;
  readonly pose: Pose = newPose();
  readonly world: World = newWorld();
  /** 0 full (IK, reactive), 1 no IK, 2 clips only (caller ticks it at 15 Hz), 3 frozen. */
  lod: 0 | 1 | 2 | 3 = 0;
  readonly input: AnimInput = { speed: 0, accel: 0, turnRate: 0, grounded: true, vy: 0, stopping: false, stopDistance: 0, crouch: false };
  /** Player: root motion is handed to the controller instead of being shown in the hips. */
  consumeRoot = false;
  /** Root motion of this frame (model space, metres and radians), when consumeRoot. */
  readonly rootDelta = { x: 0, z: 0, yaw: 0 };
  /** Ground height under a model-space point, relative to the root (foot IK). */
  groundAt: ((x: number, z: number) => number) | null = null;
  /** Model-space look target (null = none). */
  lookTarget: V3 | null = null;
  /** Fixed head turn in degrees (statues, posed shots). */
  headTurn = { yaw: 0, pitch: 0 };
  /** Model-space hand targets (handlebars, grips, a partner's back) and their weights. */
  hands: { L: V3 | null; R: V3 | null; w: number; grip: boolean } = { L: null, R: null, w: 0, grip: false };
  /** Pedals (bicycle): crank centre and radius in model space; phase in radians. */
  pedals: { phase: number; y: number; z: number; r: number; x: number } | null = null;
  onEvent: ((name: string) => void) | null = null;
  /** Called when a bump or hit is strong enough to stagger or knock down. */
  onReact: ((kind: "stagger" | "fall", dir: V3) => void) | null = null;

  private base: BaseState = { k: "loco" };
  private fadeFrom = newPose();
  private fadeT = 1;
  private fadeDur = 0.0001;
  private basePose = newPose();
  private tmpPose = newPose();
  private tmpPose2 = newPose();
  private phase = 0;
  private upper: Upper | null = null;
  private upperFrom: Upper | null = null;
  private lean = new Spring2();
  private react = [new Spring2(), new Spring2(), new Spring2()]; // hips-spine, chest, head
  private shoulder = [new Spring2(), new Spring2()];
  private look = { yaw: 0, pitch: 0, w: 0 };
  private dip = { y: 0, v: 0 };
  private lastLocoClip: Clip | null = null;
  private lastPhase = 0;
  readonly ragdoll: Ragdoll;
  private time = 0;

  constructor(lib: AnimLibrary, sk: Skeleton) {
    this.lib = lib;
    this.sk = sk;
    this.hipScale = sk.hipHeight / (lib.refHipHeight || sk.refHipHeight);
    sk.restPose(this.pose);
    this.ragdoll = new Ragdoll(sk);
    const idle = lib.get("idle_breathe");
    if (idle) idle.sample(0, this.pose);
    copyPose(this.pose, this.basePose);
    copyPose(this.pose, this.fadeFrom);
    this.phase = Math.random();
  }

  /** Stride speed of a locomotion clip on this body (m/s). */
  strideSpeed(c: Clip): number {
    return (c.meta.speed ?? 1) * this.hipScale;
  }

  get state(): string {
    return this.base.k === "action" ? `action:${this.base.clip.id}` : this.base.k;
  }

  get actionClip(): string | null {
    return this.base.k === "action" ? this.base.clip.id : null;
  }

  get upperClip(): string | null {
    return this.upper && !this.upper.fadeOut ? this.upper.clip.id : null;
  }

  /* ------------------------------------------------------------ commands */

  private setBase(s: BaseState, blend: number): void {
    copyPose(this.pose, this.fadeFrom);
    // Blend from what is on screen (including the IK and springs) minus nothing: a frozen snapshot.
    this.fadeT = 0;
    this.fadeDur = Math.max(0.0001, blend);
    this.base = s;
  }

  /** Play a clip on the full body (or a mask: see upperPlay). Returns false if the clip is not loaded yet. */
  play(id: string, o: PlayOpts = {}): boolean {
    if (o.mask && o.mask !== "full") return this.upperPlay(id, o);
    const clip = this.lib.get(id);
    if (!clip) return false;
    if (this.base.k === "action" && this.base.clip === clip && clip.loop) return true;
    this.setBase({ k: "action", clip, t: o.at ?? 0, rate: o.rate ?? 1, hold: !!o.hold, then: o.then ?? null, offset: o.offset ?? null, noRoot: !!o.noRoot, ramp: !!o.then }, o.blend ?? FEEL.blend.action);
    return true;
  }

  /** Back to locomotion (stand). */
  stopAction(blend = FEEL.blend.soft): void {
    if (this.base.k !== "loco") this.setBase({ k: "loco" }, blend);
  }

  /** An upper-body clip (masked), blending in and out. */
  upperPlay(id: string, o: PlayOpts = {}): boolean {
    const clip = this.lib.get(id);
    if (!clip) return false;
    if (this.upper && this.upper.clip === clip && !this.upper.fadeOut) {
      this.upper.until = o.duration !== undefined ? this.upper.t + o.duration : Infinity;
      return true;
    }
    if (this.upper && this.upper.w > 0.01) this.upperFrom = { ...this.upper, fadeOut: true };
    const mask = MASKS[o.mask && o.mask !== "full" ? o.mask : ((clip.meta.layer as MaskName | undefined) ?? "upper")] ?? MASKS.upper;
    this.upper = { clip, t: o.at ?? 0, w: 0, until: o.duration ?? (clip.loop ? Infinity : clip.duration), mask, rate: o.rate ?? 1, fadeOut: false };
    return true;
  }

  upperStop(): void {
    if (this.upper) this.upper.fadeOut = true;
  }

  /** Jump: answered in the same frame (the clip starts at take-off, its anticipation skipped). */
  jump(running: boolean): void {
    const clip = this.lib.get(running ? "jump_run" : "jump_start");
    if (!clip) return;
    const takeoff = takeoffTime(clip);
    this.setBase({ k: "air", clip, t: takeoff, rate: 1, running }, FEEL.blend.hit);
  }

  /** Landing with an impact speed (m/s). Moving fast: no clip, a spring dip; standing: the landing clip. */
  land(impact: number): void {
    this.dip.v -= Math.min(2.2, impact * 0.18);
    if (this.base.k === "air" && this.base.running && this.input.speed > 2) {
      this.setBase({ k: "loco" }, FEEL.blend.land);
      return;
    }
    if (this.input.speed > 2.5) {
      this.setBase({ k: "loco" }, FEEL.blend.land);
      return;
    }
    const clip = this.lib.get(impact > 11 ? "land_hard" : "land_soft");
    if (!clip) return this.setBase({ k: "loco" }, FEEL.blend.land);
    this.setBase({ k: "land", clip, t: landTime(clip), rate: impact > 11 ? 1 : 1.25 }, FEEL.blend.land);
  }

  /** Fell off a ledge without jumping. */
  fall(): void {
    if (this.base.k === "air" || this.base.k === "ragdoll") return;
    const clip = this.lib.get("fall_loop");
    if (clip) this.setBase({ k: "air", clip, t: 0, rate: 1, running: false }, FEEL.blend.soft);
  }

  /** Run pivot (plant and turn 180); the player's yaw follows the clip's root turn (rootDelta.yaw). */
  pivot(): void {
    const clip = this.lib.get("run_pivot_180");
    if (clip) this.setBase({ k: "pivot", clip, t: 0 }, FEEL.blend.hit);
  }

  get pivoting(): boolean {
    return this.base.k === "pivot";
  }

  /** Turn on the spot by an angle (rad, + = left) with the 90-degree turn clips, scaled. */
  turnInPlace(angle: number): void {
    if (this.base.k !== "loco") return;
    const left = angle > 0;
    const clip = this.lib.get(left ? "turn_90L" : "turn_90R");
    if (!clip || !clip.meta.root) return;
    const scale = Math.abs(angle) / Math.max(0.3, Math.abs(clip.meta.root.dyaw));
    this.setBase({ k: "turn", clip, t: 0, scale }, FEEL.blend.loco);
  }

  get turning(): boolean {
    return this.base.k === "turn";
  }

  /** Bicycle: the pedal cycle sampled by crank phase. */
  cycle(on: boolean): void {
    if (on) {
      const clip = this.lib.get("cycle");
      if (clip && this.base.k !== "cycle") this.setBase({ k: "cycle", clip, phase: 0 }, FEEL.blend.vehicle * 2);
    } else if (this.base.k === "cycle") this.setBase({ k: "loco" }, FEEL.blend.soft);
  }

  /**
   * A bump (someone brushes past) or a hit: an impulse in the character's
   * frame (direction the body is pushed, metres per second). The upper body
   * gives way on springs and recovers; strong ones stagger or knock down.
   */
  bump(dir: V3, strength: number, part: "upper" | "head" | "shoulderL" | "shoulderR" = "upper"): void {
    if (this.lod >= 2) return;
    const l = Math.hypot(dir[0], dir[2]) || 1;
    const dx = dir[0] / l, dz = dir[2] / l;
    // Pushed towards +z tips forward: pitch +; pushed towards +x (left) rolls left: roll -.
    const ip = dz * strength * 1.6, ir = -dx * strength * 1.6;
    const share = part === "head" ? [0.2, 0.4, 1.0] : [0.5, 1.0, 0.7];
    this.react.forEach((s, i) => {
      s.vx += ip * share[i]!;
      s.vz += ir * share[i]!;
    });
    if (part === "shoulderL" || part === "shoulderR" || part === "upper") {
      const s = this.shoulder[dx > 0 ? 1 : 0]!;
      s.vz += -dx * strength * 2.4;
      s.vx += dz * strength * 1.2;
    }
    if (strength >= FEEL.react.fall) this.onReact?.("fall", [dx, 0, dz]);
    else if (strength >= FEEL.react.stagger) this.onReact?.("stagger", [dx, 0, dz]);
  }

  /** Knock-down: the ragdoll-lite takes the body from the current pose, then a get-up clip takes over. */
  knockDown(impulse: V3, collide?: (p: V3) => V3): void {
    fk(this.sk, this.pose, this.world, this.hipScale);
    this.ragdoll.start(this.pose, this.world, impulse, this.hipScale, this.groundAt, collide ?? null);
    this.setBase({ k: "ragdoll" }, 0.0001);
  }

  get ragdolling(): boolean {
    return this.base.k === "ragdoll";
  }

  /* ------------------------------------------------------------ the frame */

  update(dt: number): Pose {
    this.time += dt;
    this.rootDelta.x = this.rootDelta.z = this.rootDelta.yaw = 0;
    if (this.lod === 3) return this.pose;
    const bp = this.basePose;
    this.evalBase(dt, bp);
    // Crossfade from the frozen snapshot.
    if (this.fadeT < 1) {
      this.fadeT = Math.min(1, this.fadeT + dt / this.fadeDur);
      const w = smooth01(this.fadeT);
      copyPose(this.fadeFrom, this.pose);
      for (let b = 0; b < BONE_COUNT; b++) nlerpInto(this.pose.rot, b * 4, bp.rot, b * 4, w);
      for (let j = 0; j < 3; j++) this.pose.hips[j] = this.fadeFrom.hips[j]! + (bp.hips[j]! - this.fadeFrom.hips[j]!) * w;
    } else copyPose(bp, this.pose);
    if (this.base.k === "ragdoll") {
      fk(this.sk, this.pose, this.world, this.hipScale);
      return this.pose;
    }
    this.evalUpper(dt);
    if (this.lod <= 1) this.reactive(dt);
    fk(this.sk, this.pose, this.world, this.hipScale);
    if (this.lod === 0) this.ik(dt);
    return this.pose;
  }

  private evalBase(dt: number, out: Pose): void {
    const s = this.base;
    const skipF = this.lod >= 1;
    switch (s.k) {
      case "loco":
        this.locomotion(dt, out, skipF);
        if (this.input.stopping && this.input.speed > 0.9 && this.lod <= 1) this.beginStop();
        return;
      case "action": {
        s.t += dt * s.rate;
        const c = s.clip;
        if (!c.loop && s.t >= c.duration) {
          if (s.then) {
            const next = this.lib.get(s.then);
            if (next) {
              this.base = { k: "action", clip: next, t: 0, rate: 1, hold: true, then: null, offset: s.offset, noRoot: s.noRoot, ramp: false };
              copyPose(this.pose, this.fadeFrom);
              this.fadeT = 0;
              this.fadeDur = 0.2;
              next.sample(0, out, 1, undefined, skipF);
              this.applyOffset(out, s.offset, 1);
              return;
            }
          }
          if (!s.hold) {
            c.sample(c.duration, out, 1, undefined, skipF);
            this.setBase({ k: "loco" }, FEEL.blend.soft);
            return;
          }
          s.t = c.duration;
        }
        c.sample(s.t, out, 1, undefined, skipF);
        if (!s.noRoot) this.rootMotion(c, s.t - dt * s.rate, s.t, out);
        this.applyOffset(out, s.offset, s.ramp ? smooth01(s.t / c.duration) : 1);
        return;
      }
      case "air": {
        const c = s.clip;
        s.t += dt * s.rate;
        if (c.id === "jump_start" && (s.t >= c.duration - 0.05 || this.input.vy < -1)) {
          const fl = this.lib.get("fall_loop");
          if (fl) {
            this.setBase({ k: "air", clip: fl, t: 0, rate: 1, running: s.running }, 0.3);
            fl.sample(0, out, 1, undefined, skipF);
            return;
          }
        }
        if (s.running && c.id === "jump_run") {
          // Hold the clip's airborne part until we land (never play its landing in mid-air).
          const lt = landTime(c);
          if (s.t > lt - 0.04) s.t = lt - 0.04;
        }
        c.sample(c.loop ? s.t : Math.min(s.t, c.duration), out, 1, undefined, skipF);
        return;
      }
      case "land": {
        s.t += dt * s.rate;
        const c = s.clip;
        c.sample(Math.min(s.t, c.duration), out, 1, undefined, skipF);
        // Walk out of a landing as soon as the stick moves (responsive), otherwise finish it.
        if (s.t >= c.duration - 0.05 || this.input.speed > 0.8 || s.t > landTime(c) + 0.55) this.setBase({ k: "loco" }, FEEL.blend.soft);
        return;
      }
      case "stop": {
        // Distance matching: the clip time follows the distance the controller still has to go.
        const c = s.clip;
        const remain = Math.max(0, this.input.stopDistance) / this.hipScale;
        let t = s.t;
        if (s.matched && remain > 0.01) {
          const want = s.total - remain;
          let f = 0;
          while (f < s.dist.length - 1 && s.dist[f + 1]! < want) f++;
          const a = s.dist[f]!, b = s.dist[Math.min(s.dist.length - 1, f + 1)]!;
          const tt = (f + (b > a ? (want - a) / (b - a) : 0)) / c.fps;
          t = Math.max(t, tt);
        } else t += dt;
        s.t = t;
        if (!this.input.stopping) {
          // The stick came back: straight back into the gait (responsive).
          this.setBase({ k: "loco" }, FEEL.blend.loco);
          this.locomotion(dt, out, skipF);
          return;
        }
        c.sample(Math.min(t, c.duration), out, 1, undefined, skipF);
        if (t >= c.duration) this.setBase({ k: "loco" }, FEEL.blend.soft);
        return;
      }
      case "turn": {
        const c = s.clip;
        const t0 = s.t;
        s.t += dt;
        c.sample(Math.min(s.t, c.duration), out, 1, undefined, skipF);
        const a = c.rootAt(t0), b = c.rootAt(Math.min(s.t, c.duration));
        this.rootDelta.yaw += (b[2] - a[2]) * s.scale;
        if (s.t >= c.duration || this.input.speed > 0.6) this.setBase({ k: "loco" }, FEEL.blend.loco);
        return;
      }
      case "pivot": {
        const c = s.clip;
        const t0 = s.t;
        s.t += dt * 1.15;
        c.sample(Math.min(s.t, c.duration), out, 1, undefined, skipF);
        const a = c.rootAt(t0), b = c.rootAt(Math.min(s.t, c.duration));
        this.rootDelta.yaw += b[2] - a[2];
        if (s.t >= c.duration) this.setBase({ k: "loco" }, FEEL.blend.loco);
        return;
      }
      case "cycle": {
        const ph = this.pedals ? this.pedals.phase / (Math.PI * 2) : s.phase;
        s.phase = ((ph % 1) + 1) % 1;
        s.clip.sample(s.phase * s.clip.duration, out, 1, undefined, skipF);
        return;
      }
      case "ragdoll": {
        const done = this.ragdoll.step(dt, out);
        if (done) {
          const up = this.ragdoll.faceUp;
          const clip = this.lib.get(up ? "get_up_back" : "get_up_front") ?? this.lib.get("stand_up_floor");
          if (clip) {
            // Root aligned so the clip's first pose lies where the body lies.
            this.base = { k: "action", clip, t: 0, rate: 1.2, hold: false, then: null, offset: null, noRoot: false, ramp: false };
            copyPose(out, this.fadeFrom);
            this.fadeT = 0;
            this.fadeDur = 0.45;
            this.rootDelta.yaw += this.ragdoll.restYaw;
          } else this.setBase({ k: "loco" }, 0.5);
        }
        return;
      }
    }
  }

  private applyOffset(out: Pose, o: [number, number, number] | null, k: number): void {
    if (!o || k <= 0) return;
    out.hips[0] = out.hips[0]! + (o[0] * k) / this.hipScale;
    out.hips[1] = out.hips[1]! + (o[1] * k) / this.hipScale;
    out.hips[2] = out.hips[2]! + (o[2] * k) / this.hipScale;
  }

  /** Root motion of a one-shot: handed to the controller, or shown in the hips. */
  private rootMotion(c: Clip, t0: number, t1: number, out: Pose): void {
    if (!c.root) return;
    if (this.consumeRoot) {
      const a = c.rootAt(Math.max(0, t0)), b = c.rootAt(t1);
      // Root deltas are in the clip's start frame: turn into the current root frame.
      const cy = Math.cos(-a[2]), sy = Math.sin(-a[2]);
      const dx = b[0] - a[0], dz = b[1] - a[1];
      this.rootDelta.x += (dx * cy + dz * sy) * this.hipScale;
      this.rootDelta.z += (-dx * sy + dz * cy) * this.hipScale;
      this.rootDelta.yaw += b[2] - a[2];
      return;
    }
    // Visual only: the body travels within the clip (cutscene actors are placed by the director).
    const r = c.rootAt(t1);
    const q = axisAngle([0, 1, 0], r[2]);
    const hx = out.hips[0]!, hz = out.hips[2]!;
    const cy = Math.cos(r[2]), sy = Math.sin(r[2]);
    out.hips[0] = hx * cy + hz * sy + r[0];
    out.hips[2] = -hx * sy + hz * cy + r[1];
    const hq = out.rot.subarray(B.Hips * 4, B.Hips * 4 + 4);
    const o = [q[3] * hq[0]! + q[0] * hq[3]! + q[1] * hq[2]! - q[2] * hq[1]!, q[3] * hq[1]! - q[0] * hq[2]! + q[1] * hq[3]! + q[2] * hq[0]!, q[3] * hq[2]! + q[0] * hq[1]! - q[1] * hq[0]! + q[2] * hq[3]!, q[3] * hq[3]! - q[0] * hq[0]! - q[1] * hq[1]! - q[2] * hq[2]!];
    hq.set(o);
  }

  /** The blend space: idle and the gaits by speed, phase-synced, stride-matched. */
  private locomotion(dt: number, out: Pose, skipF: boolean): void {
    const v = Math.max(0, this.input.speed);
    const crouch = this.input.crouch;
    const idle = this.lib.get(crouch ? "crouch_idle" : "idle_breathe");
    const pts: Clip[] = [];
    if (crouch) {
      const cw = this.lib.get("crouch_walk");
      if (cw) pts.push(cw);
    } else for (const id of LOCO_POINTS) {
      const c = this.lib.get(id);
      if (c && c.meta.speed) pts.push(c);
    }
    if (!pts.length) {
      if (idle) idle.sample(this.time, out, 1, undefined, skipF);
      return;
    }
    const sp = pts.map((c) => this.strideSpeed(c));
    // Pick the two neighbours and the blend weight.
    let a = 0, b = 0, w = 0;
    if (v <= sp[0]!) {
      a = b = 0;
    } else if (v >= sp[sp.length - 1]!) {
      a = b = sp.length - 1;
    } else {
      for (let i = 0; i < sp.length - 1; i++)
        if (v >= sp[i]! && v <= sp[i + 1]!) {
          a = i;
          b = i + 1;
          w = (v - sp[i]!) / (sp[i + 1]! - sp[i]!);
        }
    }
    const ca = pts[a]!, cb = pts[b]!;
    // Stride matching: phase advances by distance / (blended stride length per cycle).
    const strideLen = (1 - w) * sp[a]! * ca.duration + w * sp[b]! * cb.duration;
    let rate = v / Math.max(0.05, strideLen);
    // Below the slowest gait the clip slows (min 0.55x) and blends with idle.
    const minCycle = 0.55 / ca.duration;
    let idleW = 0;
    if (v < sp[0]!) {
      idleW = 1 - smooth01(v / (sp[0]! * 0.85));
      rate = Math.max(minCycle, rate);
    }
    // Faster than the fastest gait: speed the clip up to the clamp.
    if (v > sp[sp.length - 1]!) rate = Math.min(rate, (FEEL.rateClamp[1] / cb.duration));
    if (idleW < 0.999) this.phase = (this.phase + rate * dt) % 1;
    ca.sample(ca.timeAtPhase(this.phase), out, 1, undefined, skipF);
    if (b !== a && w > 0) cb.sample(cb.timeAtPhase(this.phase), out, w, undefined, skipF);
    if (idle && idleW > 0) {
      if (idleW >= 0.999) idle.sample(this.time, out, 1, undefined, skipF);
      else {
        idle.sample(this.time, this.tmpPose, 1, undefined, skipF);
        for (let i = 0; i < BONE_COUNT; i++) nlerpInto(out.rot, i * 4, this.tmpPose.rot, i * 4, idleW);
        for (let j = 0; j < 3; j++) out.hips[j] = out.hips[j]! + (this.tmpPose.hips[j]! - out.hips[j]!) * idleW;
      }
    }
    // Footstep events from the dominant gait's contact starts.
    const dom = w > 0.5 ? cb : ca;
    if (idleW < 0.5 && dom.meta.events) {
      const p0 = this.lastPhase, p1 = this.phase;
      if (dom === this.lastLocoClip)
        for (const e of dom.meta.events) {
          const ep = dom.phaseAt(e.t);
          const crossed = p1 >= p0 ? ep > p0 && ep <= p1 : ep > p0 || ep <= p1;
          if (crossed) this.onEvent?.(e.name);
        }
    }
    this.lastLocoClip = dom;
    this.lastPhase = this.phase;
  }

  /** Start a distance-matched stop on the foot that is about to plant (mirrored clip for the other foot). */
  private beginStop(): void {
    const id = this.input.speed > 3 ? "run_stop" : "walk_stop";
    const c0 = this.lib.get(id);
    if (!c0 || !c0.root || !c0.meta.root) return;
    // Which foot plants next in the current gait?
    const dom = this.lastLocoClip;
    let nextL = true;
    if (dom?.meta.contacts) {
      const ph = dom.loop ? (((dom.timeAtPhase(this.phase) / dom.duration) % 1) + 1) % 1 : 0;
      const dist = (w: [number, number][]) => Math.min(...w.map(([s]) => ((s - ph) % 1 + 1) % 1), 2);
      nextL = dist(dom.meta.contacts.L) <= dist(dom.meta.contacts.R);
    }
    const firstL = (() => {
      const c = c0.meta.contacts;
      if (!c) return true;
      const l = Math.min(...c.L.map(([s]) => s), 2), r = Math.min(...c.R.map(([s]) => s), 2);
      return l <= r;
    })();
    const clip = nextL === firstL ? c0 : (this.lib.get(`${id}~m`) ?? c0);
    const n = clip.frames;
    const dist = new Float32Array(n);
    let m = 0;
    for (let f = 0; f < n; f++) {
      const r = clip.rootAt(f / clip.fps);
      m = Math.max(m, Math.hypot(r[0], r[1]));
      dist[f] = m;
    }
    const total = dist[n - 1]!;
    const remain = this.input.stopDistance / this.hipScale;
    const want = Math.max(0, total - remain);
    let f = 0;
    while (f < n - 1 && dist[f + 1]! < want) f++;
    const t = f / clip.fps;
    this.setBase({ k: "stop", clip, t, dist, total, matched: true }, FEEL.blend.loco);
  }

  private evalUpper(dt: number): void {
    const layers = [this.upperFrom, this.upper];
    for (const u of layers) {
      if (!u) continue;
      u.t += dt * u.rate;
      const ending = u.fadeOut || u.t >= u.until - FEEL.blend.upperOut;
      u.w = ending ? Math.max(0, u.w - dt / FEEL.blend.upperOut) : Math.min(1, u.w + dt / FEEL.blend.upperIn);
      if (u.w <= 0 && ending) {
        if (u === this.upper) this.upper = null;
        else this.upperFrom = null;
        continue;
      }
      const t = u.clip.loop ? u.t : Math.min(u.t, u.clip.duration);
      u.clip.sample(t, this.pose, smooth01(u.w), u.mask, this.lod >= 1);
    }
  }

  /** Lean (turns, acceleration) and reactive springs on the spine, shoulders and head. */
  private reactive(dt: number): void {
    const F = FEEL.lean;
    const v = this.input.speed;
    const turnLean = clamp(this.input.turnRate * v * 0.06, -1, 1) * (F.turnMax * Math.PI / 180);
    const accLean = clamp(this.input.accel * F.accelPerMs2, -F.accelMax, F.accelMax) * (Math.PI / 180);
    this.lean.step(dt, F.stiffness, F.damping, this.input.grounded ? accLean : 0, this.input.grounded ? -turnLean : 0, 0.5);
    const R = FEEL.react;
    for (const s of this.react) s.step(dt, R.stiffness, R.damping, 0, 0, R.maxAngle);
    for (const s of this.shoulder) s.step(dt, R.stiffness * 1.3, R.damping, 0, 0, R.maxAngle);
    // Landing dip: a spring on the hips height.
    const kd = 16;
    this.dip.v += (-kd * kd * this.dip.y - 2 * 0.6 * kd * this.dip.v) * dt;
    this.dip.y = clamp(this.dip.y + this.dip.v * dt, -0.14, 0.05);
    const needs = Math.abs(this.lean.x) + Math.abs(this.lean.z) + this.react.reduce((a, s) => a + s.energy, 0) + this.shoulder.reduce((a, s) => a + s.energy, 0) + Math.abs(this.dip.y);
    if (needs < 1e-4) return;
    this.pose.hips[1] = this.pose.hips[1]! + this.dip.y / this.hipScale;
    fk(this.sk, this.pose, this.world, this.hipScale);
    const rot = (b: number, x: number, z: number) => {
      if (Math.abs(x) + Math.abs(z) < 1e-5) return;
      const ang = Math.hypot(x, z);
      rotateBoneWorld(this.sk, this.pose, this.world, b, axisAngle([x / ang, 0, z / ang], ang), this.hipScale);
    };
    // Lean: whole-body tilt shared low in the spine (the feet stay; foot IK keeps them planted).
    rot(B.Spine, this.lean.x * 0.45 + this.react[0]!.x, this.lean.z * 0.5 + this.react[0]!.z);
    rot(B.Spine1, this.lean.x * 0.3, this.lean.z * 0.3);
    rot(B.Spine2, this.react[1]!.x, this.react[1]!.z);
    rot(B.Head, this.react[2]!.x * 0.6, this.react[2]!.z * 0.6);
    rot(B.LShoulder, this.shoulder[0]!.x * 0.5, this.shoulder[0]!.z);
    rot(B.RShoulder, this.shoulder[1]!.x * 0.5, this.shoulder[1]!.z);
    if (Math.abs(this.lean.z) > 0.002) {
      // Hips roll a little into the turn as well.
      rot(B.Hips, 0, this.lean.z * 0.25);
    }
  }

  /** Foot IK with pelvis drop, pedals, hand targets, look-at. */
  private ik(dt: number): void {
    const sk = this.sk, p = this.pose, w = this.world, hs = this.hipScale;
    const seated = this.base.k === "action" && /sit|kneel|sleep|lie|drive|ride|keke|okada|car_|fallen|dazed/.test(this.base.clip.id);
    // Pedals: feet on the crank by IK (exact, rule A3), hands on the bars.
    if (this.pedals && this.base.k === "cycle") {
      const pd = this.pedals;
      for (const [side, off, sx] of [["L", 0, 1], ["R", Math.PI, -1]] as const) {
        const a = pd.phase + off;
        const ankle: V3 = [sx * pd.x, pd.y + Math.sin(a) * pd.r + 0.09, pd.z + Math.cos(a) * pd.r - 0.03];
        const [ua, la, fo] = side === "L" ? [B.LUpLeg, B.LLeg, B.LFoot] : [B.RUpLeg, B.RLeg, B.RFoot];
        twoBone(sk, p, w, ua, la, fo, ankle, [sx * 0.15, 0.2, 1], 1, hs);
      }
    } else if (this.groundAt && this.input.grounded && !seated && (this.base.k === "loco" || this.base.k === "stop" || this.base.k === "action" || this.base.k === "land")) {
      const gl = this.footGround(B.LFoot), gr = this.footGround(B.RFoot);
      const drop = clamp(Math.min(gl, gr, 0), -FEEL.ik.pelvisDrop, 0);
      if (Math.abs(gl) > 0.004 || Math.abs(gr) > 0.004) {
        p.hips[1] = p.hips[1]! + drop / hs;
        fk(sk, p, w, hs);
        for (const [side, g] of [["L", gl], ["R", gr]] as const) {
          const [ua, la, fo] = side === "L" ? [B.LUpLeg, B.LLeg, B.LFoot] : [B.RUpLeg, B.RLeg, B.RFoot];
          const an = wpos(w, fo);
          twoBone(sk, p, w, ua, la, fo, [an[0], an[1] + g - drop * 0, an[2]], [side === "L" ? 0.1 : -0.1, 0, 1], 1, hs);
        }
      }
    }
    if (this.hands.w > 0.001) {
      if (this.hands.L) armIK(sk, p, w, "L", this.hands.L, this.hands.w, null, hs);
      if (this.hands.R) armIK(sk, p, w, "R", this.hands.R, this.hands.w, null, hs);
      if (this.hands.grip) {
        if (this.hands.L) handShape(sk, p, w, "L", "grip", hs);
        if (this.hands.R) handShape(sk, p, w, "R", "grip", hs);
      }
    }
    // Look-at, rate limited (180 deg/s), weight eased in and out.
    const L = FEEL.look;
    this.look.w = this.lookTarget ? Math.min(1, this.look.w + dt * 3) : Math.max(0, this.look.w - dt * 3);
    if (this.look.w > 0.001 && this.lookTarget) {
      lookAt(sk, p, w, this.lookTarget, smooth01(this.look.w), hs, (L.yaw * Math.PI) / 180, (L.pitch * Math.PI) / 180);
    } else if (this.headTurn.yaw || this.headTurn.pitch) {
      rotateBoneWorld(sk, p, w, B.Head, axisAngle([0, 1, 0], (this.headTurn.yaw * Math.PI) / 180), hs);
      rotateBoneWorld(sk, p, w, B.Head, axisAngle([1, 0, 0], (-this.headTurn.pitch * Math.PI) / 180), hs);
    }
  }

  /** Ground offset under a foot relative to the root's ground (positive = the ground is higher there). */
  private footGround(foot: number): number {
    const a = wpos(this.world, foot);
    const h = this.groundAt!(a[0], a[2] + 0.06);
    return clamp(h, -FEEL.ik.pelvisDrop, FEEL.step.up);
  }
}

/** Seconds into a jump clip where the feet leave the ground (end of the last contact before the air). */
export function takeoffTime(c: Clip): number {
  const ev = c.meta.contacts;
  if (!ev) return 0;
  const ends = [...ev.L, ...ev.R].map(([, e]) => e).filter((e) => e < 0.7);
  return ends.length ? Math.max(0, Math.min(...[Math.max(...ends)]) * c.duration - 0.05) : 0;
}

/** Seconds into a landing (or a run jump) where the feet touch down. */
export function landTime(c: Clip): number {
  const ev = c.meta.contacts;
  if (!ev) return 0;
  const starts = [...ev.L, ...ev.R].map(([s]) => s).filter((s) => s > 0.05);
  return starts.length ? Math.min(...starts) * c.duration : 0;
}

