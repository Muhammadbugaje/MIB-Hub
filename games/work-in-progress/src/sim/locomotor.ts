/**
 * The Locomotor: the glue between input, the character controller and the
 * animator. The game's Player uses it, and so do the feel tests, so the
 * tests drive exactly the loop the player plays (owner, 16 Nov: "test each
 * animation through the real update loop").
 *
 * Each fixed step: stick + camera -> a world direction and a gait speed
 * (walk by default, run with Shift / the run button) -> Controller.step ->
 * the animator's inputs (measured speed, acceleration, turn rate, grounded,
 * stopping and the distance left to stop) and its events (jump, land, fall,
 * pivot). Root motion the animator produced since the last step (turns,
 * pivots) is applied through the controller, so walls still block it.
 */
import type { Animator } from "../anim/animator.ts";
import { FEEL } from "../anim/feel.ts";
import { Controller, type Ground } from "./controller.ts";

export interface LocoInput {
  /** Stick or keys: x right, y forward (camera relative), length 0..1. */
  moveX: number;
  moveY: number;
  /** Run (Shift, the run button, or the stick pushed fully). */
  run: boolean;
  /** Walk slowly (Alt). */
  walk?: boolean;
  /** Sprint (optional, faster than run). */
  sprint?: boolean;
  jumpPressed?: boolean;
  jumpHeld?: boolean;
}

export class Locomotor {
  readonly c: Controller;
  frozen = false;
  /** Seconds since the stick was last touched (idle fidgets wait for 30 s+). */
  idleFor = 0;
  /** Visual smoothing of step-ups and step-downs (the capsule snaps; the body eases over ~0.1 s). */
  visY = 0;
  private visV = 0;

  /** Height to draw the body at (the capsule's height plus the step smoothing). */
  get renderY(): number {
    return this.c.y + this.visY;
  }

  constructor(readonly anim: Animator | null, x = 0, y = 0, z = 0, yaw = 0) {
    this.c = new Controller(x, y, z, yaw);
    if (anim) anim.consumeRoot = true;
  }

  /** Gait speed for this input (m/s). */
  static gaitSpeed(inp: LocoInput): number {
    const S = FEEL.speed;
    if (inp.walk) return S.walk * 0.62;
    if (inp.sprint) return S.sprint;
    return inp.run ? S.run : S.walk;
  }

  step(dt: number, inp: LocoInput, camYaw: number, g: Ground): void {
    const c = this.c, a = this.anim;
    // Root motion from the animation (pivots, turns), through the walls.
    if (a) {
      const r = a.rootAccum;
      if (r.x || r.z || r.yaw) c.applyRoot(r.x, r.z, r.yaw, g, FEEL.capsule.radius);
      r.x = r.z = r.yaw = 0;
      if (c.pivoting && !a.pivoting) {
        // Out of the plant-and-turn: push off along the new facing (no stall through idle).
        c.pivoting = false;
        const v = Math.max(c.speed, FEEL.speed.run * 0.45);
        c.vx = Math.sin(c.yaw) * v;
        c.vz = Math.cos(c.yaw) * v;
      }
    }
    let mx = this.frozen ? 0 : inp.moveX, my = this.frozen ? 0 : inp.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 1e-3) {
      mx /= Math.max(1, Math.hypot(mx, my));
      my /= Math.max(1, Math.hypot(mx, my));
    }
    // Camera relative: forward is away from the camera along the ground.
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -fz, rz = fx;
    let dx = fx * my + rx * mx, dz = fz * my + rz * mx;
    const l = Math.hypot(dx, dz);
    if (l > 1e-6) {
      dx /= l;
      dz /= l;
    }
    c.step(dt, { dx, dz, mag, gaitSpeed: Locomotor.gaitSpeed(inp), jumpPressed: !this.frozen && !!inp.jumpPressed, jumpHeld: !!inp.jumpHeld }, g);
    this.idleFor = mag > 0.05 || inp.jumpPressed ? 0 : this.idleFor + dt;
    for (const e of c.events) if (e.k === "step") this.visY -= e.dy;
    // Critically damped spring back to the capsule (omega 24: about 0.12 s).
    const om = 24, f = 1 + 2 * dt * om, det = 1 / (f + dt * dt * om * om);
    const nv = (this.visV - dt * om * om * this.visY) * det;
    this.visY = (f * this.visY + dt * this.visV) * det;
    this.visV = nv;
    if (!c.grounded) this.visY *= Math.exp(-dt * 20);
    if (!a) return;
    for (const e of c.events) {
      if (e.k === "jump") a.jump(e.running);
      else if (e.k === "land") a.land(e.impact);
      else if (e.k === "fall") a.fall();
      else if (e.k === "pivot") a.pivot();
    }
    a.input.speed = c.speed;
    a.input.accel = c.accel;
    a.input.turnRate = c.turnRate;
    a.input.grounded = c.grounded;
    a.input.vy = c.vy;
    a.input.stopping = mag < 0.05 && c.grounded;
    a.input.stopDistance = c.stopDistance();
  }
}
