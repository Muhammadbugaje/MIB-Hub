/**
 * AGENTS: people (and the goat) walking the navigation grid.
 *
 * Each NavAgent follows a planned path (sim/nav.ts) the way a person does:
 *  - corner anticipation: it heads for the furthest corner it can already
 *    see, so it rounds corners instead of touching each one;
 *  - arrival: it slows over the last metre and stops on the mark;
 *  - local avoidance: it predicts where every nearby agent or obstacle (the
 *    player, crowd walkers, the goat) will be over the next second and steers
 *    to pass on one side, and hard-separates if two bodies ever touch;
 *  - collision: every move is checked against the same colliders the player
 *    bumps into, sliding along them; it never goes through anything;
 *  - re-planning: when its goal moves (followers), on a timer, or when
 *    blocked; the stuck ladder is re-plan, then side-step, then (only when
 *    nobody can see it) a hop to the next clear point along its path.
 *
 * Searches are queued and run with a per-step work budget so a phone never
 * pays for a long search in one frame.
 *
 * For the animation system each agent exposes vx/vz (metres per second),
 * `speed` (actual) and `desiredSpeed` (what it is trying to walk at now,
 * arrival slowing included).
 *
 * Pure TypeScript: the tests drive it headless on the real colliders.
 */
import { type NavGrid, type NavPoint, type PathSearch, type SearchOptions } from "./nav.ts";

export interface Solids {
  blocked(x: number, z: number, r: number): boolean;
  resolve(x: number, z: number, r: number): [number, number];
}

/** Something to avoid that the agent system does not move (the player, crowd walkers, the goat). */
export interface Obstacle { x: number; z: number; r: number; vx?: number; vz?: number }

export type AgentStatus = "idle" | "planning" | "moving" | "holding" | "arrived" | "failed";

let nextId = 1;

export class NavAgent {
  readonly id = nextId++;
  x: number;
  z: number;
  yaw: number;
  /** Velocity, metres per second (read by the animation system). */
  vx = 0;
  vz = 0;
  /** Actual ground speed this step. */
  speed = 0;
  /** The speed the agent wants right now (0 when holding or arrived; slows on arrival). */
  desiredSpeed = 0;
  /** Cruise speed for this walk. */
  cruise = 1.4;
  radius: number;
  status: AgentStatus = "idle";
  /** The planned path (first point = where it was when planned). */
  path: NavPoint[] = [];
  /** Index of the corner it is heading for. */
  corner = 1;
  goal: NavPoint | null = null;
  /** Stop within this distance of the goal. */
  arriveRadius = 0.12;
  /** Hold still (a leader waiting for you); keeps the path. */
  hold = false;
  /** Seconds without progress while it wants to move (the stuck ladder reads it). */
  stuckTime = 0;
  /** The longest it has been stuck (tests, the debug overlay). */
  maxStuck = 0;
  /** Re-plan every this many seconds while moving (0 = only when needed). */
  repathEvery = 0;
  searchOpts: SearchOptions = {};
  /** Turn rate (radians per second at full error), for a natural walk. */
  turnRate = 9;
  /** Accelerate / brake (m/s per second). */
  accel = 4.5;
  /** Avoidance weight; 0 turns avoidance off (cutscene-perfect marks). */
  avoidance = 1;
  /** Counts of each stuck-ladder rung used (tests). */
  ladder = { repath: 0, nudge: 0, hop: 0 };
  /** Set by the system on a hop so the view can snap (no interpolation streak). */
  hopped = false;
  search: PathSearch | null = null;
  private sinceRepath = 0;
  private lastProgress = Infinity;
  private needPlan = false;

  constructor(x: number, z: number, yaw = 0, radius = 0.3) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.radius = radius;
  }

  /** Walk to (x, z). Planning happens on the system's budget. */
  goTo(x: number, z: number, cruise = this.cruise, opts: SearchOptions = this.searchOpts): void {
    this.goal = [x, z];
    this.cruise = cruise;
    this.searchOpts = opts;
    this.needPlan = true;
    this.search = null;
    this.status = "planning";
    this.lastProgress = Infinity;
  }

  /** Move the goal without forcing an immediate re-plan (followers); re-plans when it has moved enough. */
  retarget(x: number, z: number, cruise = this.cruise): void {
    this.cruise = cruise;
    if (!this.goal || (this.status !== "moving" && this.status !== "planning") || this.path.length < 2) {
      this.goTo(x, z, cruise);
      return;
    }
    const end = this.path[this.path.length - 1]!;
    // A small move of the goal: extend the last leg if it is clear; a bigger one: plan again.
    this.goal = [x, z];
    if (Math.hypot(end[0] - x, end[1] - z) > 1.2) this.needPlan = true;
    else this.path[this.path.length - 1] = [x, z];
  }

  /** Take a ready-made path (cutscenes plan synchronously). */
  setPath(p: NavPoint[], cruise = this.cruise): void {
    this.path = p;
    this.corner = 1;
    this.goal = p[p.length - 1] ?? null;
    this.cruise = cruise;
    this.status = p.length > 1 ? "moving" : "arrived";
    this.search = null;
    this.needPlan = false;
  }

  stop(): void {
    this.goal = null;
    this.path = [];
    this.search = null;
    this.needPlan = false;
    this.status = "idle";
  }

  /** Teleport (doors, set-up). */
  place(x: number, z: number, yaw = this.yaw): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.vx = this.vz = this.speed = 0;
    this.hopped = true;
  }

  get busy(): boolean {
    return this.status === "planning" || this.status === "moving";
  }

  /** Distance left along the path. */
  remaining(): number {
    const p = this.path;
    if (this.corner >= p.length) return 0;
    let L = Math.hypot(p[this.corner]![0] - this.x, p[this.corner]![1] - this.z);
    for (let i = this.corner; i < p.length - 1; i++) L += Math.hypot(p[i + 1]![0] - p[i]![0], p[i + 1]![1] - p[i]![1]);
    return L;
  }

  /** Internal: the system asks whether a plan is wanted. */
  wantsPlan(): boolean {
    return this.needPlan;
  }
  planned(): void {
    this.needPlan = false;
    this.sinceRepath = 0;
  }
  tickRepath(dt: number): void {
    this.sinceRepath += dt;
    if (this.repathEvery > 0 && this.sinceRepath > this.repathEvery && this.status === "moving") this.needPlan = true;
  }
  progress(d: number, dt: number, wants: boolean): void {
    if (!wants) {
      this.stuckTime = 0;
      this.lastProgress = Infinity;
      return;
    }
    if (d < this.lastProgress - 0.04 * Math.max(1, dt * 60)) {
      this.lastProgress = d;
      this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
    } else this.stuckTime += dt;
    this.maxStuck = Math.max(this.maxStuck, this.stuckTime);
  }
  resetProgress(): void {
    this.lastProgress = Infinity;
  }
}

export interface AgentSystemOptions {
  /** Search work per step (cells expanded); amortises long searches over frames. */
  budget?: number;
  /** True when (x, z) cannot be seen by the camera (the stuck ladder's last rung may hop there). */
  unseen?: (x: number, z: number) => boolean;
}

const dampAngle = (a: number, b: number, rate: number, dt: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-rate * dt));
};

export class AgentSystem {
  readonly agents: NavAgent[] = [];
  budget: number;
  unseen: (x: number, z: number) => boolean;
  /** Searches started (debug overlay, tests). */
  searches = 0;
  private queue: NavAgent[] = [];

  constructor(readonly nav: NavGrid, readonly solids: Solids, o: AgentSystemOptions = {}) {
    this.budget = o.budget ?? 1500;
    this.unseen = o.unseen ?? (() => false);
  }

  add(a: NavAgent): NavAgent {
    if (!this.agents.includes(a)) this.agents.push(a);
    return a;
  }

  remove(a: NavAgent): void {
    const i = this.agents.indexOf(a);
    if (i >= 0) this.agents.splice(i, 1);
    this.queue = this.queue.filter((q) => q !== a);
    a.search = null;
  }

  /** Plan now, synchronously (cutscenes, set-up): a path from (x, z) to the goal, never through anything. */
  planNow(from: NavPoint, to: NavPoint, o: SearchOptions = {}): NavPoint[] {
    const goal = this.nav.nearestWalkable(to[0], to[1]) ?? to;
    const start = this.nav.nearestWalkable(from[0], from[1]) ?? from;
    const p = this.nav.findPath(start, goal, o);
    this.searches++;
    if (!p) return [from, to];
    // Keep the exact ends (the start may sit a hair inside the clearance band).
    const out = p.slice();
    if (start !== from) out.unshift(from);
    if (goal !== to && this.nav.clear(out[out.length - 1]!, to)) out.push(to);
    return out;
  }

  /** One fixed step: plan (on budget), steer, avoid, move, resolve, watch for stuck. */
  update(dt: number, obstacles: Obstacle[] = []): void {
    this.plan();
    for (const a of this.agents) this.steer(a, dt, obstacles);
    this.separateAll();
  }

  private plan(): void {
    for (const a of this.agents) {
      a.tickRepath(1 / 60);
      if (a.wantsPlan() && a.goal && !this.queue.includes(a)) {
        a.planned();
        const goal = this.nav.nearestWalkable(a.goal[0], a.goal[1]) ?? a.goal;
        const start = this.nav.nearestWalkable(a.x, a.z) ?? [a.x, a.z];
        a.search = this.nav.search(start as NavPoint, goal as NavPoint, a.searchOpts);
        this.searches++;
        this.queue.push(a);
      }
    }
    let budget = this.budget;
    while (budget > 0 && this.queue.length) {
      const a = this.queue[0]!;
      const s = a.search;
      if (!s) {
        this.queue.shift();
        continue;
      }
      const before = s.expanded;
      const done = s.step(budget);
      budget -= Math.max(50, s.expanded - before);
      if (!done) break;
      this.queue.shift();
      a.search = null;
      if (!s.path || s.path.length < 1) {
        a.status = "failed";
        a.path = [];
        continue;
      }
      const p = s.path.slice();
      p[0] = [a.x, a.z];
      // Finish exactly on the goal when it is reachable in a straight line from the path's end.
      const g = a.goal!;
      const end = p[p.length - 1]!;
      if (Math.hypot(end[0] - g[0], end[1] - g[1]) > 0.01 && this.nav.clear(end, g)) p.push([g[0], g[1]]);
      a.path = p;
      a.corner = 1;
      a.status = p.length > 1 ? "moving" : "arrived";
      a.resetProgress();
    }
  }

  /** The point the agent steers for: the furthest upcoming corner it can see (corner anticipation). */
  private aim(a: NavAgent): NavPoint | null {
    const p = a.path;
    if (a.corner >= p.length) return null;
    // Passed or reached the current corner: move on.
    while (a.corner < p.length - 1 && Math.hypot(p[a.corner]![0] - a.x, p[a.corner]![1] - a.z) < 0.35) a.corner++;
    // Look one corner further: when it is already in clear sight, cut towards it.
    if (a.corner < p.length - 1) {
      const c = p[a.corner]!;
      if (Math.hypot(c[0] - a.x, c[1] - a.z) < 1.4 && this.nav.clear([a.x, a.z], p[a.corner + 1]!)) a.corner++;
    }
    return p[a.corner]!;
  }

  private steer(a: NavAgent, dt: number, obstacles: Obstacle[]): void {
    a.hopped = false;
    const moving = a.status === "moving" && !a.hold;
    let dvx = 0, dvz = 0, want = 0;
    if (moving) {
      const t = this.aim(a);
      if (t) {
        const dx = t[0] - a.x, dz = t[1] - a.z;
        const d = Math.hypot(dx, dz);
        const last = a.corner >= a.path.length - 1;
        if (last && d <= a.arriveRadius) {
          a.status = "arrived";
          a.corner = a.path.length;
        } else if (d > 1e-4) {
          // Arrival: ease off over the last metre and a bit.
          want = last ? Math.min(a.cruise, Math.max(0.3, d * 1.6)) : a.cruise;
          dvx = (dx / d) * want;
          dvz = (dz / d) * want;
        }
      }
    }
    // Local avoidance (predictive): pass others on one side, never through them.
    if (want > 0 && a.avoidance > 0) {
      const [ax, az] = this.avoid(a, dvx, dvz, want, obstacles);
      dvx = ax;
      dvz = az;
    }
    a.desiredSpeed = Math.hypot(dvx, dvz);
    // Smooth acceleration (no snapping between standing and walking).
    const k = 1 - Math.exp(-a.accel * dt * 1.6);
    a.vx += (dvx - a.vx) * k;
    a.vz += (dvz - a.vz) * k;
    if (a.status !== "moving" || a.hold) {
      // Brake to a stop on the spot.
      a.vx *= Math.exp(-10 * dt);
      a.vz *= Math.exp(-10 * dt);
      if (Math.hypot(a.vx, a.vz) < 0.02) a.vx = a.vz = 0;
    }
    const ox = a.x, oz = a.z;
    this.moveTo(a, a.x + a.vx * dt, a.z + a.vz * dt);
    a.speed = Math.hypot(a.x - ox, a.z - oz) / dt;
    if (a.speed > 0.15) a.yaw = dampAngle(a.yaw, Math.atan2(a.x - ox, a.z - oz), a.turnRate, dt);
    else if (want > 0) a.yaw = dampAngle(a.yaw, Math.atan2(dvx, dvz), a.turnRate * 0.6, dt);
    // The stuck ladder.
    a.progress(moving && want > 0 ? a.remaining() : 0, dt, moving && want > 0);
    if (moving && a.stuckTime > 0) this.unstick(a);
  }

  /** Move with collision: slide along walls; never end inside anything. */
  private moveTo(a: NavAgent, nx: number, nz: number): void {
    const r = a.radius;
    if (!this.solids.blocked(nx, nz, r)) {
      a.x = nx;
      a.z = nz;
      return;
    }
    const [rx, rz] = this.solids.resolve(nx, nz, r);
    if (!this.solids.blocked(rx, rz, r - 0.005) && Math.hypot(rx - a.x, rz - a.z) < 0.5) {
      a.x = rx;
      a.z = rz;
      return;
    }
    // Try each axis alone (slide), else stay.
    if (!this.solids.blocked(nx, a.z, r)) a.x = nx;
    else if (!this.solids.blocked(a.x, nz, r)) a.z = nz;
  }

  private avoid(a: NavAgent, dvx: number, dvz: number, want: number, obstacles: Obstacle[]): [number, number] {
    const fx = dvx / want, fz = dvz / want;
    let side = 0, brake = 1;
    const consider = (ox: number, oz: number, orad: number, ovx: number, ovz: number) => {
      const rx = ox - a.x, rz = oz - a.z;
      const dist = Math.hypot(rx, rz);
      const rr = a.radius + orad + 0.12;
      if (dist > 4 || dist < 1e-4) return;
      // Relative motion: time of closest approach within the next 1.4 s.
      const wx = dvx - ovx, wz = dvz - ovz;
      const w2 = wx * wx + wz * wz;
      const t = w2 > 1e-6 ? Math.max(0, Math.min(1.4, (rx * wx + rz * wz) / w2)) : 0;
      const cx = rx - wx * t, cz = rz - wz * t;
      const miss = Math.hypot(cx, cz);
      if (miss >= rr) return;
      const ahead = (rx * fx + rz * fz) / dist;
      if (ahead < -0.2) return; // behind us: their problem
      // Which side to pass: away from where they will be; head-on ties break to the right.
      const cross = fx * cz - fz * cx;
      const s = Math.abs(cross) < 0.05 ? -1 : -Math.sign(cross);
      const urgency = (1 - miss / rr) * (1 - t / 1.6);
      side += s * urgency * 1.6;
      // Something standing right in front, close: slow down rather than shove.
      if (dist < rr + 0.45 && ahead > 0.6 && Math.hypot(ovx, ovz) < 0.3) brake = Math.min(brake, Math.max(0, (dist - rr) / 0.45));
    };
    for (const o of this.agents) if (o !== a) consider(o.x, o.z, o.radius, o.vx, o.vz);
    for (const o of obstacles) consider(o.x, o.z, o.r, o.vx ?? 0, o.vz ?? 0);
    if (side === 0 && brake === 1) return [dvx, dvz];
    side = Math.max(-1.2, Math.min(1.2, side));
    // Side-step direction (left of heading is (-fz, fx) on a north-up map with yaw = atan2(x, z)).
    let nx = fx + -fz * side, nz = fz + fx * side;
    const n = Math.hypot(nx, nz) || 1;
    nx /= n;
    nz /= n;
    // Only side-step on to walkable ground.
    const sp = want * Math.max(0.15, brake);
    if (!this.nav.walkable(a.x + nx * 0.6, a.z + nz * 0.6)) return [fx * sp, fz * sp];
    return [nx * sp, nz * sp];
  }

  /** Hard guarantee: no two agents ever overlap (each pushed half the overlap, never into walls). */
  private separateAll(): void {
    const A = this.agents;
    for (let i = 0; i < A.length; i++)
      for (let j = i + 1; j < A.length; j++) {
        const a = A[i]!, b = A[j]!;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz), min = a.radius + b.radius + 0.02;
        if (d >= min) continue;
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        const push = (min - d) / 2;
        // The one standing still gives way less (a walker steps round a stander).
        const wa = a.speed > 0.1 || b.speed <= 0.1 ? 1 : 0.4, wb = b.speed > 0.1 || a.speed <= 0.1 ? 1 : 0.4;
        this.nudge(a, -nx * push * 2 * (wa / (wa + wb)), -nz * push * 2 * (wa / (wa + wb)));
        this.nudge(b, nx * push * 2 * (wb / (wa + wb)), nz * push * 2 * (wb / (wa + wb)));
      }
  }

  private nudge(a: NavAgent, dx: number, dz: number): void {
    const nx = a.x + dx, nz = a.z + dz;
    if (!this.solids.blocked(nx, nz, a.radius)) {
      a.x = nx;
      a.z = nz;
    }
  }

  /** Re-plan, then side-step, then (out of sight only) hop to the next clear point along the path. */
  private unstick(a: NavAgent): void {
    if (a.stuckTime > 1.0 && a.ladder.repath === a.ladder.nudge + a.ladder.hop && a.goal) {
      a.ladder.repath++;
      a.goTo(a.goal[0], a.goal[1], a.cruise, a.searchOpts);
      return;
    }
    if (a.stuckTime > 2.2 && a.ladder.nudge < a.ladder.repath) {
      a.ladder.nudge++;
      // Side-step to the nearest open spot round us that is not the spot we are in.
      for (let k = 0; k < 12; k++) {
        const ang = a.yaw + Math.PI / 2 + (k * Math.PI) / 6;
        const px = a.x + Math.sin(ang) * 0.6, pz = a.z + Math.cos(ang) * 0.6;
        if (!this.solids.blocked(px, pz, a.radius) && this.nav.walkable(px, pz) && this.free(a, px, pz)) {
          a.x = px;
          a.z = pz;
          break;
        }
      }
      return;
    }
    if (a.stuckTime > 4 && this.unseen(a.x, a.z)) {
      // Hop along the path to the first clear spot at least 2 m on.
      const p = a.path;
      for (let i = a.corner; i < p.length; i++) {
        const q = p[i]!;
        if (Math.hypot(q[0] - a.x, q[1] - a.z) < 2 && i < p.length - 1) continue;
        if (!this.solids.blocked(q[0], q[1], a.radius) && this.free(a, q[0], q[1]) && this.unseen(q[0], q[1])) {
          a.ladder.hop++;
          a.place(q[0], q[1]);
          a.corner = Math.min(p.length - 1, i + 1);
          a.stuckTime = 0;
          a.resetProgress();
          return;
        }
      }
    }
  }

  /** No other agent within touching distance of (x, z). */
  private free(a: NavAgent, x: number, z: number): boolean {
    return this.agents.every((o) => o === a || Math.hypot(o.x - x, o.z - z) >= a.radius + o.radius + 0.05);
  }
}
