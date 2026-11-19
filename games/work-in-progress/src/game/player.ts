/**
 * The player and the cameras.
 *
 * Player: the kinematic character controller (sim/controller.ts) driven
 * through the Locomotor (sim/locomotor.ts) on the fixed 60 Hz step, with the
 * picture interpolated between steps. Walk by default (2.3 m/s), run with
 * Shift or the run button (7 m/s), jump with Space (coyote time and a jump
 * buffer), kerbs and steps without leaving the ground; the animation's feet
 * are matched to the real ground speed (no sliding). Every number is in
 * src/anim/feel.ts (the debug menu edits it live).
 *
 * Follow camera: orbit with mouse or touch, critically damped follow, and a
 * spring arm that pulls in before it can enter a building (never clips).
 *
 * Showcase camera (press C): a slow cinematic flight along a smooth rail
 * through the map's best views, for showing people.
 */
import * as pc from "playcanvas";
import { FEEL } from "../anim/feel.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { CameraRig, type CamSolids, type MovingSolid } from "../sim/camera.ts";
import { Locomotor } from "../sim/locomotor.ts";
import { catmull } from "../sim/motion.ts";
import type { Person } from "../world/people.ts";
import { surfaceHeight } from "../world/surface.ts";
import type { InputState } from "./input.ts";

/** Walk and run speeds (m/s), from the feel config. */
export const WALK = FEEL.speed.walk;
export const RUN = FEEL.speed.run;

export class Player {
  readonly loco: Locomotor;
  private prev = { x: 0, y: 0, z: 0, yaw: 0 };
  /** Last spot where the player was free (unstick and below-world recovery). */
  private safe = { x: 0, z: 0 };
  private stuckFor = 0;
  /** Visual smoothing of step-ups (the body rises over a kerb in a few frames; the capsule is already up). */
  private stepY = 0;
  private ground: { height: (x: number, z: number) => number; resolve: (x: number, z: number, r: number) => [number, number] };

  constructor(public person: Person, private col: CollisionWorld, x: number, z: number, yaw: number) {
    person.driven = true;
    this.loco = new Locomotor(person.anim, x, surfaceHeight(x, z), z, yaw);
    this.ground = { height: (gx, gz) => surfaceHeight(gx, gz), resolve: (gx, gz, r) => this.col.resolve(gx, gz, r) };
    this.safe = { x, z };
    this.snapPrev();
  }

  get x(): number {
    return this.loco.c.x;
  }
  set x(v: number) {
    this.loco.c.x = v;
  }
  get z(): number {
    return this.loco.c.z;
  }
  set z(v: number) {
    this.loco.c.z = v;
  }
  get y(): number {
    return this.loco.c.y;
  }
  set y(v: number) {
    this.loco.c.y = v;
  }
  get yaw(): number {
    return this.loco.c.yaw;
  }
  set yaw(v: number) {
    this.loco.c.yaw = v;
  }
  get speed(): number {
    return this.loco.c.speed;
  }
  /** Set the ground speed along the facing (the bicycle hands its speed back when you get off). */
  set speed(v: number) {
    this.loco.c.vx = Math.sin(this.yaw) * v;
    this.loco.c.vz = Math.cos(this.yaw) * v;
  }
  get frozen(): boolean {
    return this.loco.frozen;
  }
  set frozen(v: boolean) {
    this.loco.frozen = v;
  }
  /** Speed multiplier (Turbo Sneakers 1.45, carrying a crate 0.86). */
  get speedMul(): number {
    return this.loco.c.speedMul;
  }
  set speedMul(v: number) {
    this.loco.c.speedMul = v;
  }

  snapPrev(): void {
    this.prev = { x: this.x, y: this.y, z: this.z, yaw: this.yaw };
  }

  teleport(x: number, z: number, yaw: number): void {
    const c = this.loco.c;
    c.x = x;
    c.z = z;
    c.y = surfaceHeight(x, z);
    c.yaw = yaw;
    c.vx = c.vz = c.vy = 0;
    c.grounded = true;
    this.stepY = this.loco.visY = 0;
    this.snapPrev();
  }

  /** One fixed step. camYaw: the camera's heading, so "forward" is away from the camera. */
  step(dt: number, inp: InputState, camYaw: number): void {
    this.snapPrev();
    const y0 = this.y;
    this.loco.step(dt, { moveX: inp.moveX, moveY: inp.moveY, run: inp.run, walk: inp.walk, jumpPressed: inp.pressed.has(" "), jumpHeld: inp.jumpHeld }, camYaw, this.ground);
    // Kerbs and steps: the capsule snaps, the body eases (the Locomotor's visual spring, no pop).
    this.stepY = this.loco.visY;
    void y0;
    // Unstick: pushing for 1.5 s without moving -> back to the last free spot.
    // (The interiors sit far east, x > 1500: not "off the map".)
    const pushing = Math.hypot(inp.moveX, inp.moveY) > 0.3 && !this.frozen;
    if (pushing && this.speed < 0.05) this.stuckFor += dt;
    else this.stuckFor = 0;
    if (!this.col.blocked(this.x, this.z, FEEL.capsule.radius)) this.safe = { x: this.x, z: this.z };
    if (this.stuckFor > 1.5 || !Number.isFinite(this.x) || (this.x < 1500 && (Math.abs(this.x) > 480 || Math.abs(this.z) > 480)) || this.y < surfaceHeight(this.x, this.z) - 2) {
      this.teleport(this.safe.x, this.safe.z, this.yaw);
      this.stuckFor = 0;
    }
  }

  render(alpha: number): void {
    const p = this.prev;
    let dy = this.yaw - p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.person.place(p.x + (this.x - p.x) * alpha, p.y + (this.y - p.y) * alpha + this.stepY, p.z + (this.z - p.z) * alpha, p.yaw + dy * alpha);
    this.person.gait(this.speed);
  }

  /** Interpolated position (for the camera). */
  pos(alpha: number, out: pc.Vec3): pc.Vec3 {
    const p = this.prev;
    return out.set(p.x + (this.x - p.x) * alpha, p.y + (this.y - p.y) * alpha + this.stepY, p.z + (this.z - p.z) * alpha);
  }
}

/* ---------------------------------------------------------- follow camera */

export class FollowCamera {
  /** People and vehicles the camera must not pass through (set once by main.ts). */
  static moving: (() => MovingSolid[]) | null = null;
  readonly rig = new CameraRig();
  private solids: CamSolids;
  private lastYaw = 0;
  private turn = 0;
  /** Yaw that movement is read against (see moveYaw()). */
  private steerYaw = 0;
  private hadInput = false;

  constructor(private cam: pc.Entity, private col: CollisionWorld) {
    this.rig.lookScale = 0.0042;
    this.solids = {
      clearance: (ax, ay, az, bx, by, bz, r) => this.col.clearance(ax, ay, az, bx, by, bz, r),
      inside: (x, y, z, r) => this.col.inside(x, y, z, r),
      ground: (x, z) => surfaceHeight(x, z),
    };
  }

  /** Camera heading (radians); the camera sits behind the player. */
  get yaw(): number {
    return this.rig.yaw;
  }
  set yaw(v: number) {
    this.rig.yaw = v;
  }
  get pitch(): number {
    return this.rig.pitch;
  }
  set pitch(v: number) {
    this.rig.pitch = v;
  }
  get dist(): number {
    return this.rig.dist;
  }
  set dist(v: number) {
    this.rig.dist = v;
  }

  reset(at: pc.Vec3, yaw: number): void {
    this.rig.reset({ x: at.x, y: at.y, z: at.z, moveYaw: yaw, speed: 0, turnRate: 0, indoors: at.x > 1500 }, yaw);
    this.lastYaw = yaw;
    this.hadInput = false;
  }

  /**
   * The heading movement is read against. Normally the live camera (forward is
   * away from the camera), but while the player holds one direction the
   * camera's own settling must never steer them: it does not feed back into
   * the controls, so a held stick walks a straight line while the view eases
   * behind it. A manual look still steers, exactly as before.
   */
  moveYaw(inp: InputState): number {
    const moving = Math.hypot(inp.moveX, inp.moveY) > 0.05;
    const looking = Math.abs(inp.lookDX) + Math.abs(inp.lookDY) > 1e-4;
    if (!moving || looking || !this.hadInput) this.steerYaw = this.rig.yaw;
    this.hadInput = moving;
    return this.steerYaw;
  }

  update(dt: number, inp: InputState, playerPos: pc.Vec3, playerSpeed: number, playerYaw: number): void {
    let dy = playerYaw - this.lastYaw;
    while (dy > Math.PI) dy -= 2 * Math.PI;
    while (dy < -Math.PI) dy += 2 * Math.PI;
    this.turn += ((dt > 0 ? dy / dt : 0) - this.turn) * (1 - Math.exp(-dt * 8));
    this.lastYaw = playerYaw;
    // Interiors are built far east (x > 1500): a shorter arm and a tighter probe there.
    const indoors = playerPos.x > 1500;
    this.rig.update(dt, inp, { x: playerPos.x, y: playerPos.y, z: playerPos.z, moveYaw: playerYaw, speed: playerSpeed, turnRate: this.turn, indoors }, this.solids, FollowCamera.moving?.() ?? []);
    const p = this.rig.pos, t = this.rig.pivot;
    this.cam.setPosition(p.x, p.y, p.z);
    this.cam.lookAt(t.x, t.y, t.z);
    if (this.cam.camera) this.cam.camera.fov = this.rig.fov;
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
