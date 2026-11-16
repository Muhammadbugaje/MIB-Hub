/**
 * The player's kinematic character controller (plan §5.2), pure logic on the
 * fixed 60 Hz step so it runs the same in the game and in the feel tests.
 *
 *   - speed eases towards the target along an acceleration curve (walk in
 *     0.15 s, run in 0.35 s, stop from a run in 0.25 s; FEEL.accel);
 *   - the body turns towards the stick at a rate that falls with speed
 *     (tight at a walk, wider at a sprint), and a hard reversal at speed asks
 *     for a pivot (plant and turn) instead of a moonwalk;
 *   - ground: steps up to 0.35 m (kerbs, stairs) without leaving the ground,
 *     snaps down up to 0.30 m (no air frames walking down stairs), anything
 *     taller is a wall; walls and solid things push out (circle vs boxes);
 *   - jumps: cartoon height 0.9 m with a short hop when the button is let go
 *     early, faster falling than rising, coyote time and a jump buffer;
 *   - root motion from turn and pivot clips turns the body through here.
 *
 * Positions are metres; yaw is radians with 0 = facing +z.
 */
import { FEEL } from "../anim/feel.ts";

export interface MoveIntent {
  /** Desired direction in the world (unit or zero) and stick deflection 0..1. */
  dx: number;
  dz: number;
  mag: number;
  /** Target speed for full deflection (m/s): walk, jog, run or sprint. */
  gaitSpeed: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export interface Ground {
  /** Walkable height at (x, z). */
  height(x: number, z: number): number;
  /** Push a circle out of walls; returns the corrected position. */
  resolve(x: number, z: number, r: number): [number, number];
}

export type ControllerEvent = { k: "jump"; running: boolean } | { k: "land"; impact: number } | { k: "fall" } | { k: "pivot" } | { k: "step"; dy: number };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Controller {
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  grounded = true;
  /** Seconds since we last stood on the ground (coyote time). */
  airTime = 0;
  private sinceJumpPress = 99;
  private jumpTime = 99;
  private jumping = false;
  /** While a pivot plays, the body turns by root motion and does not accelerate. */
  pivoting = false;
  /** Yaw rate of the last step (rad/s), and the change of speed (m/s^2). */
  turnRate = 0;
  accel = 0;
  /** Speed multiplier (Turbo Sneakers, carrying a crate). */
  speedMul = 1;
  readonly events: ControllerEvent[] = [];

  constructor(x = 0, y = 0, z = 0, yaw = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  /** Distance still to travel if the stick is let go now (for distance-matched stops). */
  stopDistance(): number {
    const k = 3 / FEEL.accel.stopFromRun;
    return this.speed / k;
  }

  /** Root motion from a clip: turn the body (and move it, through the walls). */
  applyRoot(dx: number, dz: number, dyaw: number, g: Ground, r: number): void {
    this.yaw = wrap(this.yaw + dyaw);
    if (dx || dz) {
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const wx = this.x + dx * c + dz * s, wz = this.z - dx * s + dz * c;
      [this.x, this.z] = g.resolve(wx, wz, r);
    }
  }

  step(dt: number, m: MoveIntent, g: Ground): void {
    this.events.length = 0;
    const F = FEEL;
    const prevSpeed = this.speed, prevYaw = this.yaw;
    // --- input intent -> target velocity
    const mag = clamp(m.mag, 0, 1);
    const target = mag * m.gaitSpeed * this.speedMul;
    const hasDir = mag > 0.05 && (m.dx || m.dz);
    const want = hasDir ? Math.atan2(m.dx, m.dz) : this.yaw;
    // Pivot: a hard reversal at speed plants and turns (the animator plays it, root motion turns us).
    if (this.grounded && hasDir && !this.pivoting && prevSpeed > F.pivot.minSpeed && Math.abs(wrap(want - Math.atan2(this.vx, this.vz))) > (F.pivot.angle * Math.PI) / 180) {
      this.pivoting = true;
      this.events.push({ k: "pivot" });
    }
    // Acceleration curve: exponential approach that reaches 95 % in the configured time.
    const sp = this.speed;
    const tAcc = target > sp
      ? sp < F.speed.walk ? F.accel.toWalk : target > F.speed.run ? F.accel.runToSprint : F.accel.toRun
      : sp > F.speed.run ? F.accel.stopFromSprint : F.accel.stopFromRun;
    let k = 3 / Math.max(0.05, tAcc);
    if (!this.grounded) k *= F.airControl;
    if (this.pivoting) {
      // Brake into the plant; the root motion turns us; then we accelerate out along the new facing.
      const nv = sp * Math.exp(-14 * dt);
      const f = sp > 1e-6 ? nv / sp : 0;
      this.vx *= f;
      this.vz *= f;
    } else {
      // Turn: fast at a walk, slower at a sprint (no instant 180s).
      const rate = ((sp < F.speed.jog ? F.turn.walk : sp < F.speed.run + 0.5 ? F.turn.run : F.turn.sprint) * Math.PI) / 180;
      if (hasDir) {
        const d = wrap(want - this.yaw);
        this.yaw = wrap(this.yaw + clamp(d, -rate * dt, rate * dt));
      }
      // Speed along the facing (the body goes where it looks; turning sheds a little speed).
      const align = hasDir ? Math.max(0, Math.cos(wrap(want - this.yaw))) : 0;
      const tgt = target * (0.35 + 0.65 * align);
      const ns = tgt + (sp - tgt) * Math.exp(-k * dt);
      // Velocity direction follows the facing (with a touch of carry while airborne).
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      if (this.grounded) {
        this.vx = fx * ns;
        this.vz = fz * ns;
      } else {
        const blend = 1 - Math.exp(-4 * F.airControl * dt * 10);
        this.vx = this.vx + (fx * ns - this.vx) * blend;
        this.vz = this.vz + (fz * ns - this.vz) * blend;
      }
    }
    // --- jump: buffer, coyote, short hop
    this.sinceJumpPress = m.jumpPressed ? 0 : this.sinceJumpPress + dt;
    const canJump = this.grounded || (this.airTime <= F.jump.coyote && !this.jumping);
    if (this.sinceJumpPress <= F.jump.buffer && canJump && !this.pivoting) {
      this.vy = Math.sqrt(2 * F.jump.riseG * F.jump.height);
      this.grounded = false;
      this.jumping = true;
      this.jumpTime = 0;
      this.sinceJumpPress = 99;
      this.events.push({ k: "jump", running: this.speed > 3 });
    }
    // --- horizontal move with walls and steps
    const ox = this.x, oz = this.z;
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    [nx, nz] = g.resolve(nx, nz, F.capsule.radius);
    const gh = g.height(nx, nz);
    if (gh - this.y > F.step.up + 1e-4) {
      // Too tall to step onto: a wall. Stay put on that axis (slide along the other).
      const ga = g.height(nx, oz), gb = g.height(ox, nz);
      if (ga - this.y <= F.step.up) nz = oz;
      else if (gb - this.y <= F.step.up) nx = ox;
      else {
        nx = ox;
        nz = oz;
      }
    }
    // Tall steps are walls for the whole capsule: keep its radius clear of any ground higher than a step
    // (no foot or knee inside a ledge, a planter or a platform edge).
    const r = F.capsule.radius;
    for (let it = 0; it < 2; it++) {
      let px = 0, pz = 0;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        for (const d of [r * 0.5, r]) {
          if (g.height(nx + ca * d, nz + sa * d) - this.y > F.step.up + 1e-4) {
            px -= ca * (r - d + 0.02);
            pz -= sa * (r - d + 0.02);
            break;
          }
        }
      }
      if (!px && !pz) break;
      nx += px / 3;
      nz += pz / 3;
    }
    // Real velocity after collisions (sliding along a wall slows the animation too).
    this.vx = (nx - ox) / dt;
    this.vz = (nz - oz) / dt;
    this.x = nx;
    this.z = nz;
    // --- vertical
    const ground = g.height(this.x, this.z);
    if (this.grounded) {
      const drop = this.y - ground;
      if (drop <= F.step.down + 1e-4 && ground - this.y <= F.step.up + 1e-4) {
        if (Math.abs(ground - this.y) > 0.005) this.events.push({ k: "step", dy: ground - this.y });
        this.y = ground;
        this.vy = 0;
        this.airTime = 0;
      } else {
        // Walked off a ledge.
        this.grounded = false;
        this.airTime = 0;
        this.vy = 0;
        this.events.push({ k: "fall" });
      }
    }
    if (!this.grounded) {
      this.airTime += dt;
      this.jumpTime += dt;
      const rising = this.vy > 0;
      let gr = rising ? F.jump.riseG : F.jump.fallG;
      // Short hop: let go early and the rise is cut.
      if (rising && this.jumping && !m.jumpHeld && this.jumpTime > 0.02 && this.jumpTime < F.jump.shortWindow + 0.1) gr *= 2.6;
      this.vy = Math.max(-F.jump.terminal, this.vy - gr * dt);
      this.y += this.vy * dt;
      if (this.y <= ground && this.vy <= 0) {
        const impact = -this.vy;
        this.y = ground;
        this.vy = 0;
        this.grounded = true;
        this.jumping = false;
        this.airTime = 0;
        this.events.push({ k: "land", impact });
        // Jump buffer: pressed just before landing -> jump now.
        if (this.sinceJumpPress <= F.jump.buffer) {
          this.vy = Math.sqrt(2 * F.jump.riseG * F.jump.height);
          this.grounded = false;
          this.jumping = true;
          this.jumpTime = 0;
          this.sinceJumpPress = 99;
          this.events.push({ k: "jump", running: this.speed > 3 });
        }
      }
    }
    this.turnRate = wrap(this.yaw - prevYaw) / dt;
    this.accel = (this.speed - prevSpeed) / dt;
  }
}
