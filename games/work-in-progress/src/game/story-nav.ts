/**
 * Everyone the story moves, walking for real: mission actors leading you
 * (GPS style), followers, the goat, and the routes cutscenes walk. Built on
 * the navigation grid (sim/nav.ts), the agents (sim/agents.ts) and the door
 * links (nav-routes.ts).
 *
 *  - walk(): a route of marks, in any places; between marks the walker plans
 *    a real path (footpaths first, round every wall, prop and tree), and
 *    passes through doors on the way.
 *  - lead: the walker waits when you fall behind (turns to you, waves after
 *    a moment), comes back to fetch you if you wander off, and on setting
 *    off again skips any marks you have already gone past (re-routes).
 *  - follow(): a follower keeps a spot a little behind you, re-planning as
 *    you move, never crowding you.
 *  - Bodies are placed every rendered frame, interpolated between fixed
 *    steps (no jitter), and given the agent's desired speed for the gait.
 */
import { AgentSystem, NavAgent, type Obstacle } from "../sim/agents.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { NavGrid, type NavPoint, type SearchOptions } from "../sim/nav.ts";
import { navWorld } from "../world/nav-world.ts";
import { surfaceHeight } from "../world/surface.ts";
import type { A3 } from "./director.ts";
import { navLinks, type NavLink, placeOf, type RouteLeg, routeLegs } from "./nav-routes.ts";

/** What the story moves: a person or the goat. */
export interface Body {
  place(x: number, y: number, z: number, yaw: number): void;
  /** Desired ground speed this frame (the animation system matches it to the measured speed). */
  gait(speed: number, dt: number): void;
  visible: boolean;
  /** Turn the head to a point (null: look ahead). */
  look?(at: A3 | null): void;
  /** A short gesture (the leader's wave). */
  wave?(): void;
}

export interface NavHost {
  /** The player now: position, place and velocity. */
  player(): { x: number; y: number; z: number; place: string; vx: number; vz: number; visible: boolean };
  /** True when (x, z) cannot be seen (hops and door passes may happen there). */
  unseen(x: number, z: number): boolean;
  female(): boolean;
  /** A walker is going through a door ("out" of this side, then "in" on the other): swing it open. */
  doorPass?(link: NavLink, phase: "out" | "in"): void;
}

interface Mover {
  body: Body;
  agent: NavAgent;
  kind: "walk" | "follow";
  legs: RouteLeg[];
  leg: number;
  speed: number;
  lead?: number;
  gap: number;
  maxSpeed: number;
  waiting: boolean;
  waitT: number;
  waved: number;
  fetching: boolean;
  fetchT: number;
  passT: number;
  /** Seconds left waiting for a door to swing open before going through. */
  opening?: number;
  /** Interpolation: where the body was at the previous fixed step. */
  px: number;
  pz: number;
  pyaw: number;
  done: () => void;
  opts: SearchOptions;
}

export class StoryNav {
  readonly nav: NavGrid;
  readonly agents: AgentSystem;
  /** Extra things to avoid this step (crowd walkers), filled by the game loop. */
  readonly obstacles: Obstacle[] = [];
  private movers: Mover[] = [];
  private byBody = new Map<Body, NavAgent>();
  private links: NavLink[] | null = null;
  private linksFemale: boolean | null = null;
  private reach = new Map<string, boolean>();
  private obs: Obstacle[] = [];
  private lastPl = { x: 0, z: 0, ok: false };
  /** Debug overlay on/off (the ?debug=1 menu). */
  debug = false;

  constructor(col: CollisionWorld, nav: NavGrid | undefined, private host: NavHost) {
    this.nav = nav ?? new NavGrid(navWorld(col));
    this.agents = new AgentSystem(this.nav, col, { unseen: (x, z) => host.unseen(x, z) });
  }

  private linkList(): NavLink[] {
    const f = this.host.female();
    if (!this.links || this.linksFemale !== f) {
      this.links = navLinks(f);
      this.linksFemale = f;
      this.reach.clear();
    }
    return this.links;
  }

  /** Are a and b joined by floor (same interior, same storey)? The map always is. */
  private reachable = (a: NavPoint, b: NavPoint): boolean => {
    const w = placeOf(a[0], a[1]);
    if (w === "world") return true;
    const key = `${a[0].toFixed(1)},${a[1].toFixed(1)}>${b[0].toFixed(1)},${b[1].toFixed(1)}`;
    let r = this.reach.get(key);
    if (r === undefined) {
      const s = this.nav.search(this.nav.nearestWalkable(a[0], a[1]) ?? a, this.nav.nearestWalkable(b[0], b[1]) ?? b, { maxNodes: 60000 });
      s.finishNow();
      r = s.reached;
      this.reach.set(key, r);
    }
    return r;
  };

  /** The agent for a body (created on first use, at the body's position). */
  agentFor(body: Body, x: number, z: number, yaw: number, radius = 0.3): NavAgent {
    let a = this.byBody.get(body);
    if (!a) {
      a = new NavAgent(x, z, yaw, radius);
      this.byBody.set(body, a);
    }
    return a;
  }

  isMoving(body: Body): boolean {
    return this.movers.some((m) => m.body === body);
  }

  /** Stop whatever a body was doing (put on a mark, hidden, a cutscene took it). */
  release(body: Body): void {
    for (const m of this.movers.filter((x) => x.body === body)) this.finish(m, false);
    const a = this.byBody.get(body);
    if (a) {
      a.stop();
      this.agents.remove(a);
    }
  }

  /** Everyone stops (a cutscene starts, a new run). */
  clear(): void {
    for (const m of [...this.movers]) this.finish(m, false);
    for (const a of [...this.agents.agents]) this.agents.remove(a);
  }

  /**
   * Walk a route of marks (each in any place). Resolves on arrival at the last.
   * lead: wait for the player when they are further than this (GPS-style guide).
   */
  walk(body: Body, from: { x: number; z: number; yaw: number }, route: A3[], o: { speed?: number; lead?: number; radius?: number; allow?: SearchOptions["allow"] } = {}): Promise<void> {
    this.release(body);
    const a = this.agentFor(body, from.x, from.z, from.yaw, o.radius);
    a.place(from.x, from.z, from.yaw);
    a.avoidance = 1;
    this.agents.add(a);
    const links = this.linkList();
    const legs: RouteLeg[] = [];
    let at: NavPoint = [from.x, from.z];
    route.forEach((t, i) => {
      let to: NavPoint = [t[0], t[2]];
      // Marks along the way (not the last) sit on the footpath when one is within a few metres:
      // a guide keeps to the path rather than cutting the lawn to reach a mark beside it.
      if (i < route.length - 1 && placeOf(to[0], to[1]) === "world") to = this.nav.nearestOfKind(to[0], to[1], ["path", "rough", "crossing"], 3.5) ?? to;
      legs.push(...routeLegs(at, to, links, this.reachable));
      at = to;
    });
    return new Promise((resolve) => {
      const m: Mover = {
        body, agent: a, kind: "walk", legs, leg: 0, speed: o.speed ?? 1.4, lead: o.lead, gap: 0, maxSpeed: o.speed ?? 1.4,
        waiting: false, waitT: 0, waved: 0, fetching: false, fetchT: 0, passT: 0, px: from.x, pz: from.z, pyaw: from.yaw, done: resolve,
        opts: o.allow ? { allow: o.allow } : {},
      };
      this.movers.push(m);
      this.startLeg(m);
    });
  }

  /** Follow the player at `gap` metres (escorts). Returns a handle to stop it. */
  follow(body: Body, from: { x: number; z: number; yaw: number }, o: { gap?: number; maxSpeed?: number } = {}): { stop(): void } {
    this.release(body);
    const a = this.agentFor(body, from.x, from.z, from.yaw);
    a.place(from.x, from.z, from.yaw);
    this.agents.add(a);
    const m: Mover = {
      body, agent: a, kind: "follow", legs: [], leg: 0, speed: 1.4, gap: o.gap ?? 1.2, maxSpeed: o.maxSpeed ?? 2.6,
      waiting: false, waitT: 0, waved: 0, fetching: false, fetchT: 0, passT: 0, px: from.x, pz: from.z, pyaw: from.yaw, done: () => undefined, opts: {},
    };
    this.movers.push(m);
    return { stop: () => this.finish(m, false) };
  }

  /** A route through marks planned now on the grid (cutscene walks): every leg goes round what is in the way. */
  planRoute(pts: NavPoint[], o: SearchOptions = {}): NavPoint[] {
    if (pts.length < 2) return pts;
    const out: NavPoint[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const a = out[out.length - 1]!, b = pts[i]!;
      // Different places (a scene that cuts between rooms): no walking between them.
      if (placeOf(a[0], a[1]) !== placeOf(b[0], b[1]) || Math.hypot(b[0] - a[0], b[1] - a[1]) > 400) {
        out.push(b);
        continue;
      }
      const p = this.agents.planNow(a, b, o);
      for (let k = 1; k < p.length; k++) out.push(p[k]!);
    }
    return out;
  }

  private startLeg(m: Mover): void {
    const leg = m.legs[m.leg];
    if (!leg) {
      this.finish(m, true);
      return;
    }
    m.agent.goTo(leg.to[0], leg.to[1], m.speed, m.opts);
  }

  private finish(m: Mover, arrived: boolean): void {
    const i = this.movers.indexOf(m);
    if (i < 0) return;
    this.movers.splice(i, 1);
    m.agent.stop();
    m.agent.hold = false;
    m.body.gait(0, 0);
    m.body.look?.(null);
    m.body.visible = m.body.visible || m.passT > 0;
    // Keep the agent registered only while it moves; a standing body is the game's to place.
    if (!this.movers.some((x) => x.agent === m.agent)) this.agents.remove(m.agent);
    // Only an arrival resolves the walk (a walker taken over by a cutscene or a new mark just stops).
    if (arrived) m.done();
  }

  /** Fixed step: leaders, followers, door passes, then every agent. */
  step(dt: number): void {
    const pl = this.host.player();
    const pvx = this.lastPl.ok ? (pl.x - this.lastPl.x) / dt : 0, pvz = this.lastPl.ok ? (pl.z - this.lastPl.z) / dt : 0;
    this.lastPl = { x: pl.x, z: pl.z, ok: true };
    for (const m of [...this.movers]) {
      m.px = m.agent.x;
      m.pz = m.agent.z;
      m.pyaw = m.agent.yaw;
      if (m.kind === "walk") this.stepWalk(m, dt, pl);
      else this.stepFollow(m, pl);
    }
    this.obs.length = 0;
    if (pl.visible) this.obs.push({ x: pl.x, z: pl.z, r: 0.33, vx: pvx, vz: pvz });
    for (const o of this.obstacles) this.obs.push(o);
    this.agents.update(dt, this.obs);
  }

  private stepWalk(m: Mover, dt: number, pl: ReturnType<NavHost["player"]>): void {
    const a = m.agent;
    // Passing through a door: out of sight for a moment, then on the other side.
    if (m.passT > 0) {
      m.passT -= dt;
      if (m.passT <= 0) {
        const link = m.legs[m.leg]!.link!;
        // Step clear of the doorway on the far side (you come through it next).
        const fx = Math.sin(link.yaw), fz = Math.cos(link.yaw);
        let ax = link.b[0] + fx * 1.5 + fz * 0.9, az = link.b[1] + fz * 1.5 - fx * 0.9;
        if (!this.nav.walkable(ax, az)) {
          const w = this.nav.nearestWalkable(link.b[0] + fx * 1.5, link.b[1] + fz * 1.5, 1.5) ?? link.b;
          ax = w[0];
          az = w[1];
        }
        a.place(ax, az, link.yaw);
        this.host.doorPass?.(link, "in");
        m.px = a.x;
        m.pz = a.z;
        m.pyaw = a.yaw;
        m.body.visible = true;
        m.leg++;
        this.startLeg(m);
      }
      return;
    }
    const here = placeOf(a.x, a.z);
    const d = here === pl.place ? Math.hypot(pl.x - a.x, pl.z - a.z) : Infinity;
    if (m.lead !== undefined) {
      if (!m.waiting && d > m.lead) {
        m.waiting = true;
        m.waitT = 0;
        m.waved = 0;
      } else if (m.waiting && d < m.lead * 0.7) {
        m.waiting = false;
        m.fetching = false;
        a.hold = false;
        this.reroute(m, pl);
        m.body.look?.(null);
      }
      if (m.waiting) {
        m.waitT += dt;
        if (d < Infinity) {
          m.body.look?.([pl.x, pl.y + 1.5, pl.z]);
          // Turn round to you, and wave after a moment (again every few seconds).
          if (!m.fetching) a.yaw = turnTo(a.yaw, Math.atan2(pl.x - a.x, pl.z - a.z), 5, dt);
          if (m.waitT > 0.9 + m.waved * 6 && m.waved < 3) {
            m.waved++;
            m.body.wave?.();
          }
          // You wandered off: come and fetch you.
          if (m.waitT > 5 && d > m.lead * 1.5) {
            m.fetching = true;
            m.fetchT -= dt;
            a.hold = false;
            if (m.fetchT <= 0) {
              m.fetchT = 1;
              a.goTo(pl.x, pl.z, m.speed, m.opts);
            }
          } else if (!m.fetching) a.hold = true;
        } else {
          // You are in another place (behind a door): wait facing the way you will come.
          a.hold = true;
          const leg = m.legs[m.leg - 1];
          if (leg?.link) a.yaw = turnTo(a.yaw, leg.link.yaw + Math.PI, 5, dt);
        }
        return;
      }
    }
    if (a.status === "arrived" || a.status === "failed" || (a.status === "idle" && !a.goal)) {
      const leg = m.legs[m.leg];
      if (!leg) {
        this.finish(m, true);
        return;
      }
      if (leg.link) {
        // At the door: a guide waits until you are close enough to see them go through.
        if (m.lead !== undefined && d > Math.min(m.lead, 4.5)) {
          a.hold = true;
          a.yaw = turnTo(a.yaw, Math.atan2(pl.x - a.x, pl.z - a.z), 5, dt);
          return;
        }
        a.hold = false;
        // Through the door: it swings open, then they are gone a moment (and come out the other side).
        if (m.passT === 0 && !m.opening) {
          m.opening = 0.45;
          a.yaw = turnTo(a.yaw, Math.atan2(leg.link.doorA.x - a.x, leg.link.doorA.z - a.z), 10, dt);
          this.host.doorPass?.(leg.link, "out");
          return;
        }
        if (m.opening && m.opening > 0) {
          m.opening -= dt;
          a.yaw = turnTo(a.yaw, Math.atan2(leg.link.doorA.x - a.x, leg.link.doorA.z - a.z), 10, dt);
          return;
        }
        m.opening = 0;
        m.body.visible = false;
        m.passT = 0.5;
        return;
      }
      m.leg++;
      this.startLeg(m);
    }
  }

  /** GPS re-route: set off again towards the next mark you have not already passed. */
  private reroute(m: Mover, pl: { x: number; z: number; place: string }): void {
    const a = m.agent;
    let best = m.leg;
    for (let i = m.leg + 1; i < m.legs.length; i++) {
      const prev = m.legs[i - 1]!;
      if (prev.link || m.legs[i]!.where !== pl.place) break;
      // You are already at (or past) this mark's start: skip the earlier ones.
      if (Math.hypot(pl.x - m.legs[i]!.from[0], pl.z - m.legs[i]!.from[1]) < 6) best = i;
    }
    m.leg = best;
    const leg = m.legs[m.leg];
    if (leg) a.goTo(leg.to[0], leg.to[1], m.speed, m.opts);
  }

  private stepFollow(m: Mover, pl: ReturnType<NavHost["player"]>): void {
    const a = m.agent;
    if (placeOf(a.x, a.z) !== pl.place) {
      a.hold = true;
      return;
    }
    a.hold = false;
    const d = Math.hypot(pl.x - a.x, pl.z - a.z);
    // The spot behind you, on your side of the line to the follower.
    const ux = (a.x - pl.x) / (d || 1), uz = (a.z - pl.z) / (d || 1);
    const tx = pl.x + ux * m.gap, tz = pl.z + uz * m.gap;
    if (d > m.gap + 0.45) {
      const sp = Math.max(1.1, Math.min(m.maxSpeed, 1 + (d - m.gap) * 0.7));
      a.retarget(tx, tz, sp);
      a.cruise = sp;
      m.body.look?.(null);
    } else if (d < m.gap + 0.1 && a.busy) {
      a.stop();
    }
    if (!a.busy) {
      a.yaw = turnTo(a.yaw, Math.atan2(pl.x - a.x, pl.z - a.z), 4, 1 / 60);
      m.body.look?.([pl.x, pl.y + 1.5, pl.z]);
    }
  }

  /** Per rendered frame: place every moving body, interpolated between fixed steps. */
  render(alpha: number, dt: number): void {
    for (const m of this.movers) {
      const a = m.agent;
      if (m.passT > 0) continue;
      const hop = a.hopped || Math.hypot(a.x - m.px, a.z - m.pz) > 1;
      const x = hop ? a.x : m.px + (a.x - m.px) * alpha, z = hop ? a.z : m.pz + (a.z - m.pz) * alpha;
      let dy = a.yaw - m.pyaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      m.body.place(x, surfaceHeight(x, z), z, hop ? a.yaw : m.pyaw + dy * alpha);
      m.body.gait(a.desiredSpeed > 0.05 ? a.desiredSpeed : 0, dt);
    }
  }

  /**
   * The player is solid to the story's walkers (and they to the player): a
   * point pushed out of every agent it overlaps (never into a wall).
   */
  pushOut(x: number, z: number, r: number): [number, number] {
    for (const a of this.agents.agents) {
      const dx = x - a.x, dz = z - a.z, d = Math.hypot(dx, dz), min = r + a.radius;
      if (d >= min) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
      const px = a.x + nx * min, pz = a.z + nz * min;
      if (!this.agents.solids.blocked(px, pz, r)) {
        x = px;
        z = pz;
      }
    }
    return [x, z];
  }

  /** The guide you are following (a walk with lead), if any: where they are now. */
  leader(): { pos: A3; where: string } | null {
    const m = this.movers.find((x) => x.kind === "walk" && x.lead !== undefined);
    if (!m) return null;
    return { pos: [m.agent.x, 0, m.agent.z], where: placeOf(m.agent.x, m.agent.z) };
  }

  /** Where a walker is (the objective marker follows a leader). */
  positionOf(body: Body): { pos: A3; where: string } | null {
    const a = this.byBody.get(body);
    if (!a) return null;
    return { pos: [a.x, 0, a.z], where: placeOf(a.x, a.z) };
  }

  /** Debug overlay: grid round a point (walkable/blocked/cost), every path, stuck agents. */
  debugDraw(line: (a: A3, b: A3, colour: [number, number, number]) => void, cx: number, cz: number): void {
    const R = 9, S = 0.5;
    const col: Record<string, [number, number, number]> = { path: [0.8, 0.8, 0.8], floor: [0.8, 0.8, 0.8], crossing: [1, 1, 1], rough: [0.8, 0.45, 0.25], lawn: [0.3, 0.8, 0.3], road: [0.3, 0.3, 0.4], verge: [0.9, 0.7, 0.3], blocked: [1, 0.15, 0.1] };
    for (let x = cx - R; x <= cx + R; x += S)
      for (let z = cz - R; z <= cz + R; z += S) {
        if (!this.nav.isBaked(x, z)) continue;
        const k = this.nav.kindAt(x, z);
        if (k === "path" || k === "floor") continue;
        const y = surfaceHeight(x, z) + 0.05;
        line([x - 0.12, y, z], [x + 0.12, y, z], col[k]!);
      }
    for (const a of this.agents.agents) {
      const y = surfaceHeight(a.x, a.z) + 0.08;
      for (let i = Math.max(1, a.corner); i < a.path.length; i++) {
        const p = i === a.corner ? [a.x, a.z] : a.path[i - 1]!, q = a.path[i]!;
        line([p[0]!, y, p[1]!], [q[0], y, q[1]], [1, 0.85, 0]);
      }
      const c: [number, number, number] = a.stuckTime > 1 ? [1, 0, 0] : a.hold ? [0.2, 0.6, 1] : [0, 1, 0.4];
      for (let k = 0; k < 12; k++) {
        const t0 = (k / 12) * Math.PI * 2, t1 = ((k + 1) / 12) * Math.PI * 2;
        line([a.x + Math.sin(t0) * a.radius, y, a.z + Math.cos(t0) * a.radius], [a.x + Math.sin(t1) * a.radius, y, a.z + Math.cos(t1) * a.radius], c);
      }
      line([a.x, y, a.z], [a.x + a.vx * 0.5, y, a.z + a.vz * 0.5], [0.2, 0.9, 1]);
    }
  }

  /** Bake a little of the grid ahead of need (a chunk per call round the player). */
  prebake(x: number, z: number): void {
    for (const [dx, dz] of [[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16], [16, 16], [-16, -16], [16, -16], [-16, 16]] as const) {
      if (!this.nav.isBaked(x + dx, z + dz)) {
        this.nav.bakeAt(x + dx, z + dz);
        return;
      }
    }
  }
}

function turnTo(a: number, b: number, rate: number, dt: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-rate * dt));
}
