/**
 * The third-person camera rig (plan §5.3; owner, 16 Nov: "the camera must
 * never get stuck in a building or any object, and should re-orient its
 * view when you start moving, unless you're moving the camera as well").
 * Pure logic (no engine), so the camera tests run headless.
 *
 *   - orbit: mouse / touch drag / right stick; pitch limits -35..60 degrees;
 *   - follow: a critically damped pivot at head height (half-life ~0.08 s:
 *     tight, no lag that reads as slowness);
 *   - collision: a sphere probe (0.25 m; 0.18 m indoors) from the pivot to
 *     the wanted camera spot against every solid in the world (buildings,
 *     walls, interiors, trees, poles, props) plus moving solids (people and
 *     vehicles as upright capsules). The arm pulls in at once on a hit and
 *     eases back out over ~0.4 s when clear; a final check keeps the camera
 *     point itself outside everything and above the ground (the near plane
 *     never enters geometry, even with the player backed against a wall);
 *   - indoors: a shorter arm;
 *   - auto-recentre: after 1.2 s without look input, and only while the
 *     player is moving, the camera swings smoothly behind the direction of
 *     travel with a little look-ahead into turns; any look input cancels it
 *     until the player lets go again; standing still never recentres;
 *   - FOV widens with speed (60 -> 68 degrees at a sprint).
 */
import { FEEL } from "../anim/feel.ts";

export interface CamSolids {
  /** Fraction (0..1) of the segment a->b a sphere of radius r can travel before touching a solid taller than it. */
  clearance(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number): number;
  /** Is a sphere at (x, y, z) inside or touching a solid? */
  inside(x: number, y: number, z: number, r: number): boolean;
  ground(x: number, z: number): number;
}

/** A moving solid (a person, a vehicle): an upright cylinder. */
export interface MovingSolid { x: number; z: number; r: number; h: number; y?: number }

export interface CamInput {
  /** Look deltas this frame (mouse counts or touch pixels, already scaled to radians by the caller or not: see lookScale). */
  lookDX: number;
  lookDY: number;
  zoom: number;
}

export interface CamTarget {
  x: number;
  y: number;
  z: number;
  /** Direction of travel (radians, 0 = +z) and speed (m/s). */
  moveYaw: number;
  speed: number;
  /** Turn rate of the player (rad/s), for look-ahead. */
  turnRate: number;
  indoors: boolean;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class CameraRig {
  /** Heading (radians): the camera looks along this direction (it sits behind the target). */
  yaw = 0;
  pitch = 0.3;
  /** Wanted arm length (zoom). */
  dist = 4.2;
  /** Current arm length (after collisions). */
  arm = 4.2;
  /** Seconds since the last look input (recentre waits for FEEL.camera.recentreAfter). */
  lookIdle = 99;
  fov = 60;
  readonly pos = { x: 0, y: 0, z: 0 };
  readonly pivot = { x: 0, y: 0, z: 0 };
  private pv = [0, 0, 0];
  private init = false;
  /** Radians per look count (mouse 0.12 deg/count by default). */
  lookScale = (FEEL.camera.mouse * Math.PI) / 180;

  reset(t: CamTarget, yaw: number): void {
    this.pivot.x = t.x;
    this.pivot.y = t.y + FEEL.camera.pivot;
    this.pivot.z = t.z;
    this.pv = [0, 0, 0];
    this.yaw = yaw;
    this.arm = this.dist;
    this.init = true;
  }

  update(dt: number, inp: CamInput, t: CamTarget, solids: CamSolids, moving: MovingSolid[] = []): void {
    const C = FEEL.camera;
    // First frame: start where we are (keep a heading that was set before, e.g. by a cutscene or a mission).
    if (!this.init) this.reset(t, this.yaw);
    // Look input.
    const looking = Math.abs(inp.lookDX) > 0.5 || Math.abs(inp.lookDY) > 0.5;
    this.lookIdle = looking ? 0 : this.lookIdle + dt;
    this.yaw = wrap(this.yaw - inp.lookDX * this.lookScale);
    this.pitch = Math.max((C.pitchMin * Math.PI) / 180, Math.min((C.pitchMax * Math.PI) / 180, this.pitch + inp.lookDY * this.lookScale * 0.8));
    if (inp.zoom) this.dist = Math.max(2.2, Math.min(12, this.dist * (1 + inp.zoom * 0.1)));
    // Auto-recentre behind the travel direction (only while moving, only when the player is not steering the camera).
    // (Not when walking towards the camera: the view stays, as in most third-person games.)
    if (t.speed > 0.6 && this.lookIdle > C.recentreAfter && Math.abs(wrap(t.moveYaw - this.yaw)) < 2.1) {
      const ahead = Math.max(-0.5, Math.min(0.5, t.turnRate * 0.25));
      const want = wrap(t.moveYaw + ahead);
      // Faster when the camera is far off and the player is fast; eased in over the first half second.
      const ramp = Math.min(1, (this.lookIdle - C.recentreAfter) / 0.5);
      const rate = (1.6 + Math.min(2, t.speed * 0.3)) * ramp;
      this.yaw = wrap(this.yaw + wrap(want - this.yaw) * (1 - Math.exp(-rate * dt)));
    }
    // Pivot: critically damped follow of the head.
    const goal = [t.x, t.y + (t.indoors ? C.pivot - 0.05 : C.pivot), t.z];
    const cur = [this.pivot.x, this.pivot.y, this.pivot.z];
    const omega = Math.log(2) / C.posLag * 1.6;
    for (let i = 0; i < 3; i++) {
      const w = i === 1 ? omega * 0.8 : omega;
      const f = 1 + 2 * dt * w, oo = w * w, det = 1 / (f + dt * dt * oo);
      const nx = (f * cur[i]! + dt * this.pv[i]! + dt * dt * oo * goal[i]!) * det;
      this.pv[i] = (this.pv[i]! + dt * oo * (goal[i]! - cur[i]!)) * det;
      cur[i] = nx;
    }
    // Never let the pivot fall far behind (a teleport, a very fast move).
    if (Math.hypot(cur[0]! - goal[0]!, cur[2]! - goal[2]!) > 3) {
      cur[0] = goal[0]!;
      cur[1] = goal[1]!;
      cur[2] = goal[2]!;
      this.pv = [0, 0, 0];
    }
    this.pivot.x = cur[0]!;
    this.pivot.y = cur[1]!;
    this.pivot.z = cur[2]!;
    // The wanted spot.
    const dist = t.indoors ? Math.min(this.dist, C.armIndoor) : this.dist;
    const r = t.indoors ? 0.18 : C.probe;
    const dx = -Math.sin(this.yaw) * Math.cos(this.pitch), dy = Math.sin(this.pitch), dz = -Math.cos(this.yaw) * Math.cos(this.pitch);
    const px = this.pivot.x, py = this.pivot.y, pz = this.pivot.z;
    const wx = px + dx * dist, wy = py + dy * dist, wz = pz + dz * dist;
    let free = solids.clearance(px, py, pz, wx, wy, wz, r);
    for (const m of moving) free = Math.min(free, segCylinder(px, py, pz, wx, wy, wz, r, m));
    // Ground: the arm stops before the camera would go under the ground.
    for (let i = 1; i <= 12; i++) {
      const u = i / 12;
      if (u > free) break;
      const x = px + (wx - px) * u, y = py + (wy - py) * u, z = pz + (wz - pz) * u;
      if (y < solids.ground(x, z) + 0.3) {
        free = Math.min(free, (i - 1) / 12);
        break;
      }
    }
    const wantArm = Math.max(0.35, dist * free);
    // In at once, out gently (~0.4 s to settle).
    if (wantArm < this.arm) this.arm = wantArm;
    else this.arm += (wantArm - this.arm) * (1 - Math.exp(-dt / (C.easeOut / 3)));
    // Final guard: the camera point itself is never inside anything (a wall right behind the player, a moving NPC).
    let a = this.arm;
    for (let i = 0; i < 16; i++) {
      const x = px + dx * a, y = py + dy * a, z = pz + dz * a;
      const hit = solids.inside(x, y, z, r * 0.6) || moving.some((m) => Math.hypot(x - m.x, z - m.z) < m.r + r * 0.6 && y < (m.y ?? 0) + m.h + r * 0.6);
      if (!hit && y >= solids.ground(x, z) + 0.2) break;
      a *= 0.8;
    }
    this.arm = Math.min(this.arm, a);
    this.pos.x = px + dx * this.arm;
    this.pos.y = Math.max(py + dy * this.arm, solids.ground(px + dx * this.arm, pz + dz * this.arm) + 0.2);
    this.pos.z = pz + dz * this.arm;
    // FOV widens with speed.
    const k = Math.max(0, Math.min(1, (t.speed - FEEL.speed.walk) / (FEEL.speed.run - FEEL.speed.walk)));
    this.fov += (C.fov + (C.fovSprint - C.fov) * k - this.fov) * (1 - Math.exp(-dt * 3));
  }
}

/** Fraction along a->b where a sphere of radius r first touches an upright cylinder (1 = never). */
export function segCylinder(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, m: MovingSolid): number {
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const x = ax + (bx - ax) * u, y = ay + (by - ay) * u, z = az + (bz - az) * u;
    if (Math.hypot(x - m.x, z - m.z) < m.r + r && y < (m.y ?? 0) + m.h + r && y > (m.y ?? 0) - r) return (i - 1) / steps;
  }
  return 1;
}
