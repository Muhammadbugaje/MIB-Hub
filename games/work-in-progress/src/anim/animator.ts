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
import { axisAngle, clamp, conj, mulQ, nlerpInto, rotV, smooth01, type V3 } from "./math.ts";
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
  /**
   * The exact movement since the last update in the body's frame (x left, z forward) and its turn, when
   * someone else moves the body (NPCs): the foot lock carries planted feet by this, not by a smoothed speed.
   */
  moved?: { x: number; z: number; yaw: number } | null;
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
  /** Root motion summed since the controller last took it (the controller runs at 60 Hz, the animation per frame). */
  readonly rootAccum = { x: 0, z: 0, yaw: 0 };
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
  /** Height of this body's ball-of-foot joint above its sole at rest (m). */
  readonly soleLift: number;
  /** Height of the ankle joint above the sole at rest (m). */
  readonly restAnkle: number;
  private readonly heels: [V3, V3];
  private time = 0;

  constructor(lib: AnimLibrary, sk: Skeleton) {
    this.lib = lib;
    this.sk = sk;
    this.hipScale = sk.hipHeight / (lib.refHipHeight || sk.refHipHeight);
    sk.restPose(this.pose);
    this.ragdoll = new Ragdoll(sk);
    // Soles on the ground: the clips put the ball-of-foot joint at ground level, this body's joint sits a
    // little above its sole (the reference rig's does not), so lift the body by that much (no sinking).
    const rw = fk(sk, sk.restPose());
    this.soleLift = Math.max(0, Math.min(0.06, Math.min(rw.pos[B.LToe * 3 + 1]!, rw.pos[B.RToe * 3 + 1]!)));
    this.restAnkle = Math.min(rw.pos[B.LFoot * 3 + 1]!, rw.pos[B.RFoot * 3 + 1]!);
    // Heel points: the back of each sole (on the ground at rest) in its foot bone's own frame.
    this.heels = [B.LFoot, B.RFoot].map((f) => {
      const ax = rw.pos[f * 3]!, ay = rw.pos[f * 3 + 1]!, az = rw.pos[f * 3 + 2]!;
      const q = rw.rot.subarray(f * 4, f * 4 + 4);
      const inv = new Float32Array([-q[0]!, -q[1]!, -q[2]!, q[3]!]);
      const sole = Math.min(rw.pos[(f === B.LFoot ? B.LToe : B.RToe) * 3 + 1]!, ay);
      return rotV(inv, 0, [0, sole - ay, -0.035 + 0 * ax * az]) as V3;
    }) as [V3, V3];
    const idle = lib.get("idle_breathe");
    if (idle) idle.sample(0, this.pose);
    copyPose(this.pose, this.basePose);
    copyPose(this.pose, this.fadeFrom);
    this.phase = 0;
  }

  /**
   * Stride speed of a locomotion clip on THIS body (m/s): how fast the planted
   * foot moves backwards under the hips, measured by forward kinematics on the
   * body's own skeleton over the clip's foot-contact windows. (Scaling the
   * reference speed by hip height is not enough: cartoon bodies have their own
   * leg proportions, and the owner saw the feet slide.) Cached per skeleton.
   */
  strideSpeed(c: Clip): number {
    let cache = STRIDE_CACHE.get(this.sk);
    if (!cache) STRIDE_CACHE.set(this.sk, (cache = new Map()));
    const hit = cache.get(c.id);
    if (hit !== undefined) return hit;
    const v = measureStride(this.sk, c, this.hipScale);
    cache.set(c.id, v);
    return v;
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

  private stoppedFor = 0;

  private setBase(s: BaseState, blend: number): void {
    // Back into locomotion: the gait blend starts from the real speed (no flicker of the old gait).
    if (s.k === "loco") {
      // The crossfade from the last pose already blends; the gait and idle weights start where they belong.
      this.blendV = this.input.speed;
      this.idleWS = this.input.speed < 0.05 ? 1 : 0;
    }
    this.stoppedFor = 0;
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
    this.setBase({ k: "air", clip, t: takeoff, rate: 1, running }, 0.1);
  }

  /** Landing with an impact speed (m/s). Moving fast: no clip, a spring dip; standing: the landing clip. */
  land(impact: number): void {
    this.dip.v -= Math.min(2.2, impact * 0.18);
    if (this.base.k === "air" && this.base.running && this.input.speed > 2) {
      this.setBase({ k: "loco" }, 0.2);
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
    if (clip) this.setBase({ k: "pivot", clip, t: 0 }, 0.12);
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
    this.rootAccum.x += this.rootDelta.x;
    this.rootAccum.z += this.rootDelta.z;
    this.rootAccum.yaw += this.rootDelta.yaw;
    if (this.base.k === "ragdoll") {
      fk(this.sk, this.pose, this.world, this.hipScale);
      return this.pose;
    }
    this.evalUpper(dt);
    this.pose.hips[1] = this.pose.hips[1]! + this.soleLift / this.hipScale;
    if (this.lod <= 1) this.reactive(dt);
    fk(this.sk, this.pose, this.world, this.hipScale);
    // Ground clearance in the air and while landing: a dangling foot never goes through the ground.
    if ((this.base.k === "air" || this.base.k === "land" || !this.input.grounded) && this.groundAt) this.clearGround();
    if (this.lod === 0) this.ik(dt);
    else if (this.lod === 1 && (this.base.k === "loco" || this.base.k === "stop")) {
      if (this.base.k === "loco" && (this.warp > 1.001 || this.warpDrop > 0.0005)) this.applyStrideWarp();
      this.footLock(dt);
    }
    return this.pose;
  }

  private evalBase(dt: number, out: Pose): void {
    const s = this.base;
    const skipF = this.lod >= 1;
    if (s.k !== "loco") {
      this.dominant = s.k === "ragdoll" ? "ragdoll" : s.clip.id;
      this.warp = 1;
      // Any action resets the fidget clock.
      this.stillFor = 0;
    }
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
        // Once the body has stopped, let the settle play briefly, then ease into the idle.
        if (this.input.speed < 0.05) this.stoppedFor += dt;
        if (t >= c.duration || this.stoppedFor > 0.45) this.setBase({ k: "loco" }, 0.4);
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
        if (s.t >= c.duration) {
          this.setBase({ k: "loco" }, FEEL.blend.loco);
          // Out of a pivot we push off running (the controller does the same): never through idle.
          this.idleWS = 0;
          this.blendV = Math.max(this.blendV, FEEL.speed.run * 0.45);
        }
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

  /** The blend space: idle and the gaits by speed, phase-synced, stride-matched, stride-warped. */
  private locomotion(dt: number, out: Pose, skipF: boolean): void {
    const vTrue = Math.max(0, this.input.speed);
    // The blend weights follow a smoothed speed (a gait change takes ~0.12 s, never a one-frame jump: the
    // pose_pop rule); the cadence below still uses the true speed, so the feet stay matched.
    this.blendV += (vTrue - this.blendV) * (1 - Math.exp(-dt / 0.1));
    if (Math.abs(vTrue - this.blendV) < 0.01) this.blendV = vTrue;
    const v = this.blendV;
    const crouch = this.input.crouch;
    const idle = this.lib.get(crouch ? "crouch_idle" : "idle_breathe");
    const pts: { c: Clip; at: number }[] = [];
    if (crouch) {
      const cw = this.lib.get("crouch_walk");
      if (cw) pts.push({ c: cw, at: this.strideSpeed(cw) });
    } else for (const [id, at] of FEEL.gaits) {
      const c = this.lib.get(id);
      if (c && c.meta.speed) pts.push({ c, at });
    }
    this.warp = 1;
    if (!pts.length) {
      if (idle) idle.sample(this.time, out, 1, undefined, skipF);
      this.dominant = idle?.id ?? "";
      return;
    }
    // Two neighbouring gait points and the blend weight (by the game speeds the gaits stand for).
    let a = 0, b = 0, w = 0;
    const last = pts.length - 1;
    if (v <= pts[0]!.at) a = b = 0;
    else if (v >= pts[last]!.at) a = b = last;
    else
      for (let i = 0; i < last; i++)
        if (v >= pts[i]!.at && v <= pts[i + 1]!.at) {
          a = i;
          b = i + 1;
          w = (v - pts[i]!.at) / (pts[i + 1]!.at - pts[i]!.at);
        }
    const ca = pts[a]!.c, cb = pts[b]!.c;
    const sa = this.strideSpeed(ca), sb = this.strideSpeed(cb);
    // Natural speed of the blended gait, and how much faster we really go.
    const natural = (1 - w) * sa + w * sb;
    const ratio = vTrue / Math.max(0.05, natural);
    // Part of the extra speed is a longer stride (IK stretches the steps), the rest a quicker cadence.
    this.warp = ratio > 1 ? Math.min(FEEL.strideWarp.max, Math.pow(ratio, FEEL.strideWarp.share)) : 1;
    const cycle = (1 - w) * ca.duration + w * cb.duration;
    let rate = ratio / this.warp / cycle; // cycles per second (recomputed below once the warp is eased)
    // Below the walk point the walk slows (min 0.55x cadence) and blends with idle.
    let idleW = 0;
    const walkAt = pts[0]!.at;
    if (v < walkAt) {
      idleW = 1 - smooth01(v / (walkAt * 0.45));
      if (vTrue < 0.02 && v < 0.05) idleW = 1;
      rate = Math.max(0.55 / ca.duration, rate);
    }
    // Idle <-> gait weight eases over ~0.12 s whatever the acceleration (no one-frame swap of arms and legs).
    this.idleWS += (idleW - this.idleWS) * (1 - Math.exp(-dt / 0.05));
    if (Math.abs(idleW - this.idleWS) < 0.002) this.idleWS = idleW;
    idleW = this.idleWS;
    // The stride warp grows with the gait's weight and eases over time (never a jump of the feet).
    const warpWant = 1 + (this.warp - 1) * (1 - idleW);
    this.warpS += (warpWant - this.warpS) * (1 - Math.exp(-dt / 0.08));
    this.warp = this.warpS;
    if (v >= walkAt) rate = ratio / this.warp / cycle;
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
    const dom = w > 0.5 ? cb : ca;
    this.dominant = idleW >= 0.5 ? (idle?.id ?? "") : dom.id;
    // Footstep events from the dominant gait's contact starts.
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
    // Fidgets: only after standing still a long while, never while moving (owner, 16 Nov).
    if (vTrue < 0.05 && !this.input.stopping) this.stillFor += dt;
    else this.stillFor = 0;
    if (this.stillFor > this.nextFidget && this.lod <= 1) {
      const ids = FEEL.fidget.clips;
      const id = ids[Math.floor(this.rand() * ids.length)]!;
      this.stillFor = 0;
      const [lo, hi] = FEEL.fidget.every;
      this.nextFidget = lo + this.rand() * (hi - lo);
      if (this.lib.get(id)) this.setBase({ k: "action", clip: this.lib.get(id)!, t: 0, rate: 1, hold: false, then: null, offset: null, noRoot: true, ramp: false }, 0.45);
      else this.lib.request(id);
    }
  }

  private blendV = 0;
  private seed = 1;
  /** Deterministic randomness (fidgets): same seed, same behaviour (plan rule P5). */
  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  /** Give a person their own gait phase and fidget timing (crowds do not march in step). */
  setSeed(seed: number): void {
    this.seed = seed >>> 0 || 1;
    this.phase = this.rand();
    this.nextFidget = FEEL.fidget.after + this.rand() * 15;
  }
  /** Seconds standing still (fidgets); reset by any movement or command. */
  private stillFor = 0;
  private nextFidget = FEEL.fidget.after;
  /** Stride warp of this frame (1 = the clip's own stride). */
  warp = 1;
  private warpS = 1;
  private warpDrop = 0;
  private idleWS = 1;
  /** The clip that dominates the base layer this frame (tests and debugging). */
  dominant = "";

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
    fk(this.sk, this.pose, this.world, this.hipScale);
    if (Math.abs(this.dip.y) > 0.0005) {
      // Landing squash: the hips drop and the knees bend; the feet stay exactly where they are.
      const la = wpos(this.world, B.LFoot), ra = wpos(this.world, B.RFoot);
      this.pose.hips[1] = this.pose.hips[1]! + this.dip.y / this.hipScale;
      fk(this.sk, this.pose, this.world, this.hipScale);
      if (this.input.grounded) {
        this.legTo(0, la);
        this.legTo(1, ra);
      }
    }
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
    // Stride warping: longer steps for faster-than-natural speeds (feet stretched fore and aft of the hips).
    if (this.base.k === "loco" && (this.warp > 1.001 || this.warpDrop > 0.0005)) this.applyStrideWarp();
    // Foot locking: a planted foot stays exactly where it landed (rule A1).
    this.footLock(dt);

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
      // Ground offsets eased per foot (up quickly, down gently): no pops when the body steps onto a kerb.
      const rawL = this.footGround(B.LFoot), rawR = this.footGround(B.RFoot);
      const kL = 1 - Math.exp(-dt * (rawL > this.gS[0] ? 45 : 18)), kR = 1 - Math.exp(-dt * (rawR > this.gS[1] ? 45 : 18));
      this.gS[0] += (rawL - this.gS[0]) * kL;
      this.gS[1] += (rawR - this.gS[1]) * kR;
      const gl = this.gS[0], gr = this.gS[1];
      const drop = clamp(Math.min(gl, gr, 0), -FEEL.ik.pelvisDrop, 0);
      if (Math.abs(gl) > 0.004 || Math.abs(gr) > 0.004) {
        // Ankle targets from the animated pose (before the pelvis moves), raised or lowered by the ground under each foot.
        const al = wpos(w, B.LFoot), ar = wpos(w, B.RFoot);
        p.hips[1] = p.hips[1]! + drop / hs;
        fk(sk, p, w, hs);
        this.legTo(0, [al[0], al[1] + gl, al[2]]);
        this.legTo(1, [ar[0], ar[1] + gr, ar[2]]);
      }
    }
    // Safety: no sole (ball or heel) ever below the ground: stairs, kerbs, a foot rolled onto its heel.
    // Safety: no sole (ball or heel) sunk into the ground: stairs, kerbs, a foot rolled onto its heel.
    if (this.groundAt && this.input.grounded) this.footFloor();
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

  /**
   * Stride warping: each foot's fore-aft distance from the hips scaled by the
   * warp. The knee keeps its own bend plane (no flips), the target stays
   * inside the leg's reach, and the pelvis drops a little when both legs are
   * long at once (a longer stride sits lower).
   */
  private applyStrideWarp(): void {
    const sk = this.sk, p = this.pose, w = this.world, hs = this.hipScale;
    const k = this.warp;
    const hips = wpos(w, B.Hips);
    const legs = [[B.LUpLeg, B.LLeg, B.LFoot], [B.RUpLeg, B.RLeg, B.RFoot]] as const;
    const targets = legs.map(([, , f]) => {
      const a = wpos(w, f);
      return [a[0], a[1], hips[2] + (a[2] - hips[2]) * k] as V3;
    });
    const L = sk.legLength * 0.97;
    let over = 0;
    legs.forEach(([u, , f], i) => {
      const hp = wpos(w, u), t = targets[i]!, an = wpos(w, f);
      const cur = Math.hypot(an[0] - hp[0], an[1] - hp[1], an[2] - hp[2]);
      // Only the stretch the warp adds beyond what the clip's leg already does counts.
      over = Math.max(over, Math.hypot(t[0] - hp[0], t[1] - hp[1], t[2] - hp[2]) - Math.max(L, cur));
    });
    // Eased pelvis drop (a longer stride sits a little lower), never a jump.
    const want = Math.min(0.05, Math.max(0, over));
    this.warpDrop += (want - this.warpDrop) * 0.25;
    if (this.warpDrop > 0.0005) {
      p.hips[1] = p.hips[1]! - this.warpDrop / hs;
      fk(sk, p, w, hs);
    }
    legs.forEach(([u, m, f], i) => {
      const hp = wpos(w, u), kn = wpos(w, m), an = wpos(w, f);
      let t = targets[i]!;
      // Keep the target reachable, but never shorter than the clip's own leg (a straight leg stays straight).
      const d: V3 = [t[0] - hp[0], t[1] - hp[1], t[2] - hp[2]];
      const dl = Math.hypot(d[0], d[1], d[2]);
      const cur = Math.hypot(an[0] - hp[0], an[1] - hp[1], an[2] - hp[2]);
      const reach = Math.max(L, Math.min(cur, sk.legLength * 0.999));
      if (dl > reach) t = [hp[0] + (d[0] * reach) / dl, hp[1] + (d[1] * reach) / dl, hp[2] + (d[2] * reach) / dl];
      // Pole: where the knee already points, away from the hip-ankle line.
      const ax: V3 = [an[0] - hp[0], an[1] - hp[1], an[2] - hp[2]];
      const al = Math.hypot(ax[0], ax[1], ax[2]) || 1;
      const kv: V3 = [kn[0] - hp[0], kn[1] - hp[1], kn[2] - hp[2]];
      const along = (kv[0] * ax[0] + kv[1] * ax[1] + kv[2] * ax[2]) / al;
      // The knee's own bend plane, plus a small forward bias so a nearly straight leg never flips its knee.
      const pole: V3 = [kv[0] - (ax[0] / al) * along + (i === 0 ? 0.002 : -0.002), kv[1] - (ax[1] / al) * along, kv[2] - (ax[2] / al) * along + 0.012];
      twoBone(sk, p, w, u, m, f, t, pole, 1, hs);
    });
  }

  private locks = [
    { on: false, w: 0, pos: [0, 0, 0] as V3, step: -1, from: [0, 0, 0] as V3, wait: false, lift: 0 },
    { on: false, w: 0, pos: [0, 0, 0] as V3, step: -1, from: [0, 0, 0] as V3, wait: false, lift: 0 },
  ];

  /**
   * Foot locking with corrective steps. While the clip says a foot is on the
   * ground (the ball of the foot at its lowest), that foot stays exactly
   * where it landed in the world: each frame the locked spot moves backwards
   * by the body's own travel and turn, and the leg reaches it by IK. When the
   * animation wants the planted foot somewhere else (a stop, settling into the
   * idle stance, a turn) the foot never slides there: it takes a quick little
   * step (lifted 6 cm, 0.22 s), one foot at a time, like a person
   * re-balancing. Blends out over 0.12 s when the clip lifts the foot.
   */
  private footLock(dt: number): void {
    // Running and sprinting need no lock (stride matching keeps those feet within millimetres, and a lock on a
    // short sprint contact only snaps the knee): walking, stopping, turning and standing do. The moment the
    // player lets go of a sprint, the lock engages at once: otherwise the planted foot slides for the two or
    // three frames it takes the stop clip to take over.
    const active = this.input.grounded && (this.base.k === "stop" || (this.base.k === "loco" && (this.input.speed < 3.5 || this.input.stopping)));
    const w = this.world;
    const mv = this.input.moved;
    const dx = mv ? mv.x : 0, dz = mv ? mv.z : this.input.speed * dt, dyaw = mv ? mv.yaw : this.input.turnRate * dt;
    const c = Math.cos(-dyaw), sn = Math.sin(-dyaw);
    const carry = (v: V3): V3 => {
      const x = v[0] - dx, z = v[2] - dz;
      return [x * c + z * sn, v[1], -x * sn + z * c];
    };
    const legs = [[B.LUpLeg, B.LLeg, B.LFoot, B.LToe], [B.RUpLeg, B.RLeg, B.RFoot, B.RToe]] as const;
    legs.forEach(([, , f, toe], i) => {
      const L = this.locks[i]!;
      const other = this.locks[1 - i]!;
      if (L.w > 0) {
        L.pos = carry(L.pos);
        L.from = carry(L.from);
      }
      const ball = wpos(w, toe);
      const ank = wpos(w, f);
      // The sole is the lower of the ball of the foot and the heel: a foot rolled onto its heel is planted
      // even while the toes are up (and vice versa), so both the harness and the lock agree on contact.
      const hr = rotV(w.rot, f * 4, this.heels[i]!);
      const heelY = ank[1] + hr[1];
      const lowest = Math.min(ball[1] - this.soleLift, heelY);
      const fg = this.groundAt ? this.footGround(f) : 0;
      const planted = active && lowest < fg + 0.02;
      if (planted && !L.on && !L.wait) {
        L.on = true;
        // Re-locking while the last lock is still fading: start from where the foot visibly is.
        if (L.w > 0.02) {
          const k = smooth01(L.w);
          L.pos = [ball[0] + (L.pos[0] - ball[0]) * k, ball[1], ball[2] + (L.pos[2] - ball[2]) * k];
        } else L.pos = ball;
        L.step = -1;
      } else if (!planted) {
        L.on = false;
        L.wait = false;
        L.step = -1;
      }
      // A cancelled step's lift eases out (never a foot dropping in one frame).
      let lift = L.lift * Math.exp(-dt / 0.06);
      if (L.on) {
        const far = Math.hypot(L.pos[0] - ball[0], L.pos[2] - ball[2]);
        // While walking or running a stretched lock simply lets go (the gait itself steps); when stopping or
        // standing, the foot takes a small corrective step instead of sliding.
        if (this.input.speed > 3 && far > 0.1 && !this.input.stopping) {
          // At a run the gait itself steps: a stretched lock simply lets go until this foot lifts again.
          L.on = false;
          L.wait = true;
          L.step = -1;
        } else if (L.step < 0 && far > (this.input.speed > 0.6 ? 0.12 : 0.06) && other.step < 0) {
          L.step = 0;
          L.from = L.pos;
        }
        if (L.step >= 0) {
          L.step = Math.min(1, L.step + dt / (this.input.speed > 0.6 ? 0.16 : 0.22));
          const e = smooth01(L.step);
          L.pos = [L.from[0] + (ball[0] - L.from[0]) * e, ball[1], L.from[2] + (ball[2] - L.from[2]) * e];
          lift = Math.max(lift * (1 - L.step), 0.06 * Math.sin(Math.PI * L.step));
          if (L.step >= 1) L.step = -1;
        }
      }
      L.lift = lift;
      L.w = L.on ? Math.min(1, L.w + dt / 0.05) : Math.max(0, L.w - dt / 0.12);
      if (L.w <= 0.001 || !active) {
        if (!active) L.w = 0;
        return;
      }
      // The ball of the foot stays on its spot; the ankle keeps its offset from the ball (heel roll) and the sole
      // sits on the ground (blends between poses would otherwise float or sink a planted foot by a centimetre or two).
      const target: V3 = [L.pos[0] + (ank[0] - ball[0]), ank[1] - lowest + fg + lift, L.pos[2] + (ank[2] - ball[2])];
      this.legTo(i as 0 | 1, target, smooth01(L.w));
    });
  }

  /** Two-bone IK of a leg to an ankle target, bending in the knee's own current plane (never flips). */
  private legTo(i: 0 | 1, target: V3, weight = 1): void {
    const [u, m, f] = i === 0 ? [B.LUpLeg, B.LLeg, B.LFoot] : [B.RUpLeg, B.RLeg, B.RFoot];
    const w = this.world;
    const hp = wpos(w, u), kn = wpos(w, m), an = wpos(w, f);
    const ax: V3 = [an[0] - hp[0], an[1] - hp[1], an[2] - hp[2]];
    const al = Math.hypot(ax[0], ax[1], ax[2]) || 1;
    const kv: V3 = [kn[0] - hp[0], kn[1] - hp[1], kn[2] - hp[2]];
    const along = (kv[0] * ax[0] + kv[1] * ax[1] + kv[2] * ax[2]) / al;
    // The knee's own bend plane, plus a small forward bias so a nearly straight leg never flips its knee.
    const pole: V3 = [kv[0] - (ax[0] / al) * along + (i === 0 ? 0.002 : -0.002), kv[1] - (ax[1] / al) * along, kv[2] - (ax[2] / al) * along + 0.012];
    // Keep the foot's own angle to the ground (bending the knee must not tip the toes into the floor).
    const before: [number, number, number, number] = [w.rot[f * 4]!, w.rot[f * 4 + 1]!, w.rot[f * 4 + 2]!, w.rot[f * 4 + 3]!];
    twoBone(this.sk, this.pose, w, u, m, f, target, pole, weight, this.hipScale);
    const after: [number, number, number, number] = [w.rot[f * 4]!, w.rot[f * 4 + 1]!, w.rot[f * 4 + 2]!, w.rot[f * 4 + 3]!];
    rotateBoneWorld(this.sk, this.pose, w, f, mulQ(before, conj(after)), this.hipScale);
  }

  /** Lift any foot whose sole (under the ball or the heel) would be below the ground, by leg IK. */
  private footFloor(): void {
    const w = this.world;
    for (const [i, f, toe] of [[0, B.LFoot, B.LToe], [1, B.RFoot, B.RToe]] as const) {
      const a = wpos(w, f), b = wpos(w, toe);
      const hr = rotV(w.rot, f * 4, this.heels[i]!);
      const heel = a[1] + hr[1];
      const g = this.groundAt ? this.footGround(f) : 0;
      const need = Math.max(g - (a[1] - this.restAnkle), g - (b[1] - this.soleLift), g - heel);
      // Only a real sink is lifted: a millimetre or two of clip noise is not worth touching the pose for.
      if (need > 0.012) this.legTo(i, [a[0], a[1] + need, a[2]]);
    }
  }

  /** Raise the body so the lowest point of either foot is at or above the ground under it. */
  private clearGround(): void {
    const w = this.world;
    let need = 0;
    for (const [f, toe, end] of [[B.LFoot, B.LToe, B.LToeEnd], [B.RFoot, B.RToe, B.RToeEnd]] as const) {
      for (const b of [toe, end]) {
        const p = wpos(w, b);
        const g = this.groundAt!(p[0], p[2]) + (b === toe ? this.soleLift : 0);
        need = Math.max(need, g - p[1]);
      }
      const a = wpos(w, f);
      need = Math.max(need, this.groundAt!(a[0], a[2]) - (a[1] - this.restAnkle));
      // The heel can be the lowest point of a foot that is toe-up (a landing, a high step).
      const hr = rotV(w.rot, f * 4, this.heels[f === B.LFoot ? 0 : 1]!);
      need = Math.max(need, this.groundAt!(a[0] + hr[0], a[2] + hr[2]) - (a[1] + hr[1]));
    }
    if (need > 0.0005) {
      this.pose.hips[1] = this.pose.hips[1]! + Math.min(0.4, need) / this.hipScale;
      fk(this.sk, this.pose, this.world, this.hipScale);
    }
  }

  private gS: [number, number] = [0, 0];

  /**
   * Ground offset under a foot relative to the root's ground (positive = the
   * ground is higher there): the highest of the ground under the heel, the
   * ball and the tip, so a toe never pokes into a stair riser or a kerb face.
   */
  private footGround(foot: number): number {
    const [toe, end] = foot === B.LFoot ? [B.LToe, B.LToeEnd] : [B.RToe, B.RToeEnd];
    let best = -Infinity;
    for (const b of [foot, toe, end]) {
      const a = wpos(this.world, b);
      let h = this.groundAt!(a[0], a[2]);
      // A drop deeper than a step is an edge, not uneven ground: no reaching into the void.
      if (h < -FEEL.step.down) h = 0;
      best = Math.max(best, h);
    }
    return clamp(best, -FEEL.ik.pelvisDrop, FEEL.step.up);
  }
}

const STRIDE_CACHE = new WeakMap<Skeleton, Map<string, number>>();

/** Planted-foot speed of a loop on a skeleton (see Animator.strideSpeed). */
export function measureStride(sk: Skeleton, c: Clip, hipScale: number): number {
  const fallback = (c.meta.speed ?? 1) * hipScale;
  const con = c.meta.contacts;
  if (!con || !c.loop) return fallback;
  const p = sk.restPose(), w = newWorld();
  const n = c.frames - 1;
  const toeZ: number[][] = [[], []];
  const toeY: number[][] = [[], []];
  for (let f = 0; f <= n; f++) {
    c.sample(f / c.fps, p);
    fk(sk, p, w, hipScale);
    toeZ[0]!.push(w.pos[B.LToe * 3 + 2]!);
    toeZ[1]!.push(w.pos[B.RToe * 3 + 2]!);
    toeY[0]!.push(w.pos[B.LToe * 3 + 1]!);
    toeY[1]!.push(w.pos[B.RToe * 3 + 1]!);
  }
  // Planted = the ball of the foot within 1 cm of its lowest point; speed = backward travel per second while planted.
  let dist = 0, time = 0;
  for (let side = 0; side < 2; side++) {
    const ys = toeY[side]!, zs = toeZ[side]!;
    const low = Math.min(...ys);
    for (let f = 1; f <= n; f++) {
      if (ys[f]! < low + 0.01 && ys[f - 1]! < low + 0.01) {
        dist += zs[f - 1]! - zs[f]!;
        time += 1 / c.fps;
      }
    }
  }
  if (time < 0.05 || dist <= 0) return fallback;
  const v = dist / time;
  // Guard against a bad measurement (a clip with an odd contact): stay near the reference.
  return v > fallback * 0.6 && v < fallback * 1.6 ? v : fallback;
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

