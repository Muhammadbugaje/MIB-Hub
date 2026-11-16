/**
 * The player and the cameras.
 *
 * Player: a kinematic character on the fixed 60 Hz step. Speed eases in and
 * out (no instant starts or stops), the body turns smoothly towards where it
 * is going, it slides along walls (circle against boxes), it steps up kerbs
 * with a short spring (no popping), and the walk/run play rate matches the
 * ground speed (no foot sliding). What you see is interpolated between steps.
 *
 * Follow camera: orbit with mouse or touch, critically damped follow, and a
 * spring arm that pulls in before it can enter a building (never clips).
 *
 * Showcase camera (press C): a slow cinematic flight along a smooth rail
 * through the map's best views, for showing people.
 */
import * as pc from "playcanvas";
import type { CollisionWorld } from "../sim/collide.ts";
import { catmull, damp, dampAngle, spring } from "../sim/motion.ts";
import type { Person } from "../world/people.ts";
import { surfaceHeight } from "../world/surface.ts";
import type { InputState } from "./input.ts";

export const WALK = 1.55;
export const RUN = 4.6;
const RADIUS = 0.33;

export class Player {
  x: number;
  z: number;
  y: number;
  yaw: number;
  speed = 0;
  private vx = 0;
  private vz = 0;
  private yVel = 0;
  private prev = { x: 0, y: 0, z: 0, yaw: 0 };
  /** Last spot where the player was free (unstick and below-world recovery). */
  private safe = { x: 0, z: 0 };
  private stuckFor = 0;
  frozen = false;

  constructor(public person: Person, private col: CollisionWorld, x: number, z: number, yaw: number) {
    this.x = x;
    this.z = z;
    this.y = surfaceHeight(x, z);
    this.yaw = yaw;
    this.safe = { x, z };
    this.snapPrev();
  }

  snapPrev(): void {
    this.prev = { x: this.x, y: this.y, z: this.z, yaw: this.yaw };
  }

  teleport(x: number, z: number, yaw: number): void {
    this.x = x;
    this.z = z;
    this.y = surfaceHeight(x, z);
    this.yaw = yaw;
    this.vx = this.vz = this.speed = 0;
    this.snapPrev();
  }

  /** One fixed step. camYaw: the camera's heading, so "forward" is away from the camera. */
  step(dt: number, inp: InputState, camYaw: number): void {
    this.snapPrev();
    if (this.frozen) {
      this.vx = damp(this.vx, 0, 10, dt);
      this.vz = damp(this.vz, 0, 10, dt);
    } else {
      // Input relative to the camera: forward = direction the camera looks along the ground.
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = -fz, rz = fx; // camera right
      let dx = fx * inp.moveY + rx * inp.moveX;
      let dz = fz * inp.moveY + rz * inp.moveX;
      const len = Math.hypot(dx, dz);
      const mag = Math.min(1, len);
      if (len > 0.001) {
        dx /= len;
        dz /= len;
      }
      const target = mag * (inp.run ? RUN : WALK);
      const accel = target > this.speed ? 7 : 9;
      const tvx = dx * target, tvz = dz * target;
      this.vx = damp(this.vx, tvx, accel, dt);
      this.vz = damp(this.vz, tvz, accel, dt);
      if (mag > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 12, dt);
    }
    const ox = this.x, oz = this.z;
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    [nx, nz] = this.col.resolve(nx, nz, RADIUS);
    // Real velocity after collision (so sliding along a wall slows the animation too).
    this.vx = (nx - ox) / dt;
    this.vz = (nz - oz) / dt;
    this.x = nx;
    this.z = nz;
    this.speed = Math.hypot(this.vx, this.vz);
    // Kerbs: spring to the surface height (fast up, gentle down).
    const ground = surfaceHeight(this.x, this.z);
    [this.y, this.yVel] = spring(this.y, this.yVel, ground, ground > this.y ? 28 : 18, dt);
    if (this.y < ground - 0.05) this.y = ground - 0.05;
    // Unstick: pushing for 1.5 s without moving -> back to the last free spot.
    const pushing = Math.hypot(inp.moveX, inp.moveY) > 0.3 && !this.frozen;
    if (pushing && this.speed < 0.05) this.stuckFor += dt;
    else this.stuckFor = 0;
    if (!this.col.blocked(this.x, this.z, RADIUS)) this.safe = { x: this.x, z: this.z };
    if (this.stuckFor > 1.5 || !Number.isFinite(this.x) || Math.abs(this.x) > 480 || Math.abs(this.z) > 480) {
      this.teleport(this.safe.x, this.safe.z, this.yaw);
      this.stuckFor = 0;
    }
  }

  render(alpha: number): void {
    const p = this.prev;
    let dy = this.yaw - p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.person.place(p.x + (this.x - p.x) * alpha, p.y + (this.y - p.y) * alpha, p.z + (this.z - p.z) * alpha, p.yaw + dy * alpha);
    this.person.gait(this.speed);
  }

  /** Interpolated position (for the camera). */
  pos(alpha: number, out: pc.Vec3): pc.Vec3 {
    const p = this.prev;
    return out.set(p.x + (this.x - p.x) * alpha, p.y + (this.y - p.y) * alpha, p.z + (this.z - p.z) * alpha);
  }
}

/* ---------------------------------------------------------- follow camera */

export class FollowCamera {
  yaw = Math.PI; // camera heading (radians); the camera sits behind the player
  pitch = 0.32;
  dist = 5.2;
  private arm = 5.2;
  private target = new pc.Vec3();
  private tv = [0, 0, 0];
  private initialised = false;

  constructor(private cam: pc.Entity, private col: CollisionWorld) {}

  reset(at: pc.Vec3, yaw: number): void {
    this.target.copy(at);
    this.tv = [0, 0, 0];
    this.yaw = yaw;
    this.arm = this.dist;
    this.initialised = true;
  }

  update(dt: number, inp: InputState, playerPos: pc.Vec3, playerSpeed: number, playerYaw: number): void {
    if (!this.initialised) this.reset(playerPos, playerYaw);
    this.yaw -= inp.lookDX * 0.0042;
    this.pitch = Math.max(-0.15, Math.min(1.25, this.pitch + inp.lookDY * 0.0032));
    this.dist = Math.max(2.4, Math.min(16, this.dist * (1 + inp.zoom * 0.1)));
    // Gently swing behind the player while they run and the user is not steering the camera.
    if (Math.abs(inp.lookDX) < 0.5 && playerSpeed > 2.5) this.yaw = dampAngle(this.yaw, playerYaw, 0.7, dt);
    // Critically damped follow of the head.
    const goal = [playerPos.x, playerPos.y + 1.45, playerPos.z];
    const t = [this.target.x, this.target.y, this.target.z];
    for (let i = 0; i < 3; i++) [t[i], this.tv[i]] = spring(t[i]!, this.tv[i]!, goal[i]!, i === 1 ? 10 : 14, dt);
    this.target.set(t[0]!, t[1]!, t[2]!);
    // Spring arm: shorten before entering anything tall.
    const cx = this.target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cz = this.target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cy = this.target.y + Math.sin(this.pitch) * this.dist;
    const free = this.col.clearance(this.target.x, this.target.y, this.target.z, cx, cy, cz, 0.3);
    const want = Math.max(0.9, this.dist * free);
    this.arm = want < this.arm ? damp(this.arm, want, 30, dt) : damp(this.arm, want, 3, dt);
    const k = this.arm / this.dist;
    const px = this.target.x + (cx - this.target.x) * k;
    const pz = this.target.z + (cz - this.target.z) * k;
    let py = this.target.y + (cy - this.target.y) * k;
    py = Math.max(py, surfaceHeight(px, pz) + 0.35);
    this.cam.setPosition(px, py, pz);
    this.cam.lookAt(this.target);
  }
}

/* --------------------------------------------------------- showcase camera */

type Key = [number, number, number, number, number, number]; // position xyz, look xyz

/** A loop of camera keys through the map's best views. */
const TOUR: Key[] = [
  [40, 22, 30, 0, 2, 0],
  [-30, 9, 16, -60, 3, 14],
  [-90, 5, 6.5, -60, 2.5, 12],
  [-40, 14, -16, 0, 6, -44],
  [0, 10, -34, 0, 9, -100],
  [14, 18, -96, 0, 14, -128],
  [24, 26, -150, 0, 10, -205],
  [-40, 40, -230, 0, 6, -170],
  [-110, 30, -130, -112, 8, -92],
  [-60, 60, -20, 0, 0, -60],
  [60, 18, 30, 80, 2, 60],
  [140, 28, 40, 60, 3, 10],
  [110, 45, -10, 0, 4, -30],
];

export class ShowcaseCamera {
  private t = 0;
  private look = new pc.Vec3();
  constructor(private cam: pc.Entity) {}

  update(dt: number): void {
    this.t += dt * 0.045;
    const n = TOUR.length;
    const i = Math.floor(this.t) % n, f = this.t - Math.floor(this.t);
    const k = (o: number) => TOUR[(i + o + n) % n]!;
    const p = [0, 1, 2, 3, 4, 5].map((c) => catmull(k(-1)[c]!, k(0)[c]!, k(1)[c]!, k(2)[c]!, f));
    this.cam.setPosition(p[0]!, Math.max(p[1]!, surfaceHeight(p[0]!, p[2]!) + 1.2), p[2]!);
    this.look.set(p[3]!, p[4]!, p[5]!);
    this.cam.lookAt(this.look);
  }
}
