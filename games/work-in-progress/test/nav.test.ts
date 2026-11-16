/**
 * Navigation: the grid, the agents, and every mover in Missions 1-10 walking
 * for real on the actual colliders (buildings, interior walls and furniture,
 * props, tree trunks). Fails on any body inside geometry, any two bodies
 * overlapping, or anyone stuck for long.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as pc from "playcanvas";
import { describe, expect, it, vi } from "vitest";

// These run whole scenes and simulations on the real colliders: allow for a busy machine.
vi.setConfig({ testTimeout: 30_000 });
import { AgentSystem, NavAgent } from "../src/sim/agents.ts";
import { buildGraph, clearLines, makeWalker, pruneGraph, separate, stepWalker } from "../src/sim/crowd.ts";
import { NavGrid, type NavPoint, type NavWorld } from "../src/sim/nav.ts";
import { makePath, sample } from "../src/sim/path.ts";
import { makeRng } from "../src/sim/rng.ts";
import { parseMissionFile } from "../src/story/parse.ts";
import { CAMPUS_ANCHORS } from "../src/world/campus.ts";
import { INTERIORS, interiorOrigin } from "../src/world/interior-plan.ts";
import { walkLines } from "../src/world/layout.ts";
import { buildSolids, groundKind, navWorld } from "../src/world/nav-world.ts";
import { doorSpecs } from "../src/world/door-plan.ts";
import { surfaceHeight } from "../src/world/surface.ts";
import { type A3, type CamAnchor, Director, type PlayerCtx, type StageActor, type StageWorld } from "../src/game/director.ts";
import { EXTRA_INTERIOR_ANCHORS, EXTRA_WORLD_ANCHORS, STAGES } from "../src/game/missions/stages.ts";
import { frontOf, hall, worldAnchors } from "../src/game/missions/places.ts";
import { navLinks, placeOf, routeLegs } from "../src/game/nav-routes.ts";
import { type Body, StoryNav } from "../src/game/story-nav.ts";
import { NAV_ROUTES } from "../src/game/missions/scripts.ts";
import { projectOnPath, trailMarks } from "../src/game/guide-trail.ts";

const ROOT = resolve(__dirname, "../../..");
const missions = parseMissionFile(readFileSync(resolve(ROOT, "docs/plan/missions/Y1.md"), "utf8")).filter((m) => m.num <= 10);
const cuts = missions.flatMap((m) => m.cutscenes);
const ctx = (female: boolean): PlayerCtx => ({ name: "Amina", female, topColour: "blue", headwear: "none", headColour: "navy", roomie: female ? "Firdausi" : "Bature", specials: { jiya: true, taty: true, madison: true } });

const COL = buildSolids();
/** A body is inside geometry when its core (0.22 m: shoulders, not the swing of a hand) overlaps a collider. */
const CORE = 0.22;

function anchorIn(name: string, where: string, female: boolean): A3 | CamAnchor | null {
  if (where === "world") return ({ ...CAMPUS_ANCHORS, ...worldAnchors(female), ...EXTRA_WORLD_ANCHORS } as Record<string, A3 | CamAnchor>)[name] ?? null;
  const plan = INTERIORS.find((p) => p.id === where);
  if (!plan) return null;
  const [ox, oz] = interiorOrigin(plan);
  if (name === "__origin") return [ox, 0, oz];
  const a = EXTRA_INTERIOR_ANCHORS[where]?.[name] ?? plan.anchors[name];
  if (!a) return null;
  const conv = (p: A3): A3 => [ox + p[0], p[1], oz + p[2]];
  return Array.isArray(a) ? conv(a) : { pos: conv(a.pos), to: a.to ? conv(a.to) : undefined, fov: a.fov };
}
const at = (name: string, where: string, female = false): A3 => anchorIn(name, where, female) as A3;

/* ------------------------------------------------------------ the grid */

describe("nav grid: real paths round real things", () => {
  const box: NavWorld = {
    blocked: (x, z, r) => Math.abs(x) < 2 + r && Math.abs(z) < 2 + r,
    ground: (x, z) => (x > 4 && x < 8 ? (Math.abs(z) < 1 ? "crossing" : "road") : "path"),
  };

  it("goes round a box, never through it, in a few straight legs", () => {
    const nav = new NavGrid(box);
    const p = nav.findPath([-5, 0.3], [5, -0.3])!;
    expect(p.length).toBeGreaterThan(2);
    expect(p.length).toBeLessThan(6);
    for (let i = 1; i < p.length; i++) expect(nav.clear(p[i - 1]!, p[i]!)).toBe(true);
  });

  it("crosses a road at the crossing, not straight over it", () => {
    const nav = new NavGrid(box);
    const p = nav.findPath([3, 10], [9, 10])!;
    const mid = makePath(p);
    // It walks down to the crossing (z near 0) to get over the road.
    let onCrossing = false;
    for (let s = 0; s < mid.length; s += 0.2) {
      const q = sample(mid, s);
      if (q.x > 4.2 && q.x < 7.8 && Math.abs(q.z) > 1.05) throw new Error(`on the road at ${q.x.toFixed(2)},${q.z.toFixed(2)}`);
      if (q.x > 4.2 && q.x < 7.8) onCrossing = true;
    }
    expect(onCrossing).toBe(true);
  });

  it("an allowed shortcut (per-move override) walks straight across", () => {
    const nav = new NavGrid(box);
    const p = nav.findPath([3, 10], [9, 10], { allow: ["road"] })!;
    expect(p.length).toBe(2);
  });

  it("budgeted searches finish over several steps with the same answer", () => {
    const nav = new NavGrid(box);
    const s = nav.search([-5, -5], [5, 5]);
    let steps = 0;
    while (!s.step(40)) steps++;
    expect(steps).toBeGreaterThan(3);
    expect(s.reached).toBe(true);
  });

  it("follows the footpaths on the campus (cheap ground first)", () => {
    const nav = new NavGrid(navWorld(COL));
    const d = (hall(false));
    const a = frontOf(d, 2.4), b = at("spot_counter", "world");
    const p = nav.findPath([a[0], a[2]], nav.nearestWalkable(b[0], b[2])!)!;
    const path = makePath(p);
    let lawn = 0;
    for (let s = 0; s < path.length; s += 0.5) {
      const q = sample(path, s);
      if (groundKind(q.x, q.z) === "lawn") lawn += 0.5;
      expect(COL.blocked(q.x, q.z, CORE), `${q.x},${q.z}`).toBe(false);
    }
    expect(lawn / path.length).toBeLessThan(0.25);
  });
});

/* ------------------------------------------------------------ the crowd's walk graph */

describe("crowd: the walk graph never crosses geometry, and walkers stay clear for minutes", () => {
  const LINES = clearLines(walkLines, new NavGrid(navWorld(COL)));
  it("every walk-line edge (as routed at load) is clear of every collider", () => {
    const bad: string[] = [];
    for (const line of LINES)
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1]!, b = line[i]!;
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0; s <= L; s += 0.25) {
          const x = a[0] + ((b[0] - a[0]) * s) / L, z = a[1] + ((b[1] - a[1]) * s) / L;
          if (COL.blocked(x, z, CORE)) {
            bad.push(`${a.join(",")} -> ${b.join(",")} at ${x.toFixed(1)},${z.toFixed(1)}`);
            break;
          }
        }
      }
    expect(bad).toEqual([]);
  });

  it("three minutes of a busy crowd: nobody inside anything, nobody overlapping", () => {
    const g = pruneGraph(buildGraph(LINES), new NavGrid(navWorld(COL)));
    const rng = makeRng(11);
    const ws = Array.from({ length: 140 }, () => makeWalker(g, rng));
    let inside = 0, overlaps = 0, samples = 0;
    const where: string[] = [];
    for (let k = 0; k < 60 * 180; k++) {
      for (const w of ws) stepWalker(w, g, 1 / 60, rng, 0.12, COL);
      separate(ws, g, [], 1 / 60, 0.72, COL);
      if (k % 30) continue;
      for (const w of ws) {
        samples++;
        if (COL.blocked(w.x, w.z, CORE)) {
          inside++;
          if (where.length < 8) where.push(`${w.x.toFixed(1)},${w.z.toFixed(1)}`);
        }
      }
      for (let i = 0; i < ws.length; i++)
        for (let j = i + 1; j < ws.length; j++) if (Math.hypot(ws[i]!.x - ws[j]!.x, ws[i]!.z - ws[j]!.z) < 0.4) overlaps++;
    }
    expect(samples).toBeGreaterThan(0);
    expect(where).toEqual([]);
    expect(inside).toBe(0);
    expect(overlaps / (samples / ws.length)).toBeLessThan(1);
  }, 120_000);
});

/* ------------------------------------------------------------ mission walks, headless */

/** A body that records where it was put. */
class Rec implements Body {
  visible = true;
  x = 0;
  z = 0;
  place(x: number, _y: number, z: number): void {
    this.x = x;
    this.z = z;
  }
  gait(): void {}
}

interface SimResult { arrived: boolean; secs: number; inside: string[]; overlaps: string[]; maxStuck: number }

/**
 * The player in the simulation: walks the grid after whoever they are meant
 * to follow (or to a goal), through doors like the player does (walk up,
 * press E, appear on the other side). Yields to promise chains every step so
 * multi-leg awaits progress as in the game.
 */
interface SimOpts {
  female: boolean;
  player: A3;
  start: (n: StoryNav, pl: NavAgent) => Promise<void>;
  playerGoal: (n: StoryNav) => NavPoint;
  crowd?: number;
  maxSecs?: number;
  /** The beat also ends when this is true (escorts end when you reach the place). */
  until?: (pl: NavAgent) => boolean;
  /** Called every tenth of a second with the story's navigator (to watch a walker). */
  onSample?: (n: StoryNav) => void;
}

async function simulateAsync(o: SimOpts): Promise<SimResult> {
  let playerPlace = placeOf(o.player[0], o.player[2]);
  const playerSys = new AgentSystem(new NavGrid(navWorld(COL)), COL);
  const pl = playerSys.add(new NavAgent(o.player[0], o.player[2], 0, 0.33));
  const n = new StoryNav(COL, undefined, {
    player: () => ({ x: pl.x, y: 0, z: pl.z, place: playerPlace, vx: pl.vx, vz: pl.vz, visible: true }),
    unseen: () => false,
    female: () => o.female,
  });
  const rng = makeRng(5);
  const extras: NavAgent[] = [];
  for (let i = 0; i < (o.crowd ?? 0); i++) {
    const w = n.nav.nearestWalkable(o.player[0] + rng.range(-12, 12), o.player[2] + rng.range(-12, 12), 4);
    if (!w || [...n.agents.agents, pl].some((b) => Math.hypot(b.x - w[0], b.z - w[1]) < 0.8)) continue;
    const a = n.agents.add(new NavAgent(w[0], w[1]));
    extras.push(a);
  }
  let done = false;
  void o.start(n, pl).then(() => (done = true));
  const links = navLinks(o.female);
  const res: SimResult = { arrived: false, secs: 0, inside: [], overlaps: [], maxStuck: 0 };
  const maxSteps = (o.maxSecs ?? 300) * 60;
  for (let k = 0; k < maxSteps && !done; k++) {
    for (let m = 0; m < 4; m++) await Promise.resolve();
    if (o.until?.(pl)) done = true;
    if (k % 30 === 0) {
      const g = o.playerGoal(n);
      const leg = routeLegs([pl.x, pl.z], g, links)[0]!;
      if (!pl.goal || Math.hypot(pl.goal[0] - leg.to[0], pl.goal[1] - leg.to[1]) > 0.8 || !pl.busy) pl.goTo(leg.to[0], leg.to[1], 2.3);
    }
    if (k % 60 === 0)
      for (const e of extras)
        if (!e.busy) {
          const t = n.nav.nearestWalkable(e.x + rng.range(-12, 12), e.z + rng.range(-12, 12), 3);
          if (t) e.goTo(t[0], t[1], rng.range(1.1, 1.6));
        }
    for (const l of links)
      if (l.from === playerPlace && Math.hypot(pl.x - l.a[0], pl.z - l.a[1]) < 1.3) {
        const g = o.playerGoal(n);
        if (routeLegs([pl.x, pl.z], g, links)[0]?.link === l) {
          pl.place(l.b[0], l.b[1], l.yaw);
          pl.stop();
          playerPlace = l.to;
          break;
        }
      }
    playerSys.update(1 / 60, n.agents.agents.map((a) => ({ x: a.x, z: a.z, r: a.radius, vx: a.vx, vz: a.vz })));
    n.step(1 / 60);
    // As in the game: the player is pushed out of the story's walkers.
    [pl.x, pl.z] = n.pushOut(pl.x, pl.z, pl.radius);
    if (k % 6) continue;
    o.onSample?.(n);
    const everyone = [...n.agents.agents, pl];
    for (const a of everyone) {
      if (COL.blocked(a.x, a.z, CORE) && res.inside.length < 10) res.inside.push(`agent ${a.id} at ${a.x.toFixed(2)},${a.z.toFixed(2)} t=${(k / 60).toFixed(1)}`);
      res.maxStuck = Math.max(res.maxStuck, a.maxStuck);
    }
    for (let i = 0; i < everyone.length; i++)
      for (let j = i + 1; j < everyone.length; j++) {
        const a = everyone[i]!, b = everyone[j]!;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d < a.radius + b.radius - 0.12 && res.overlaps.length < 10) res.overlaps.push(`${a.id}/${b.id} ${d.toFixed(2)} at ${a.x.toFixed(1)},${a.z.toFixed(1)} t=${(k / 60).toFixed(1)}`);
      }
    res.secs = k / 60;
  }
  res.arrived = done;
  return res;
}

const expectClean = (r: SimResult, what: string) => {
  expect(r.inside, `${what}: inside geometry`).toEqual([]);
  expect(r.overlaps, `${what}: bodies overlapping`).toEqual([]);
  expect(r.maxStuck, `${what}: stuck seconds`).toBeLessThan(3);
  expect(r.arrived, `${what}: arrived (after ${r.secs.toFixed(0)} s)`).toBe(true);
};

describe("missions: every scripted walk, lead and follow, simulated on the real colliders", () => {
  for (const female of [false, true]) {
    it(`M1: the roommate leads you out of the room, down the corridor, out of the hall and to the Spot (${female ? "female" : "male"})`, async () => {
      const R = NAV_ROUTES.m001_lead(female, (n, w) => at(n, w, female));
      const lead = new Rec();
      // Outdoor distance walked, and how much of it was on a footpath (paving, red earth, crossings).
      let last: A3 | null = null, outdoor = 0, onPath = 0;
      const r = await simulateAsync({
        onSample: (n) => {
          const p = n.positionOf(lead);
          if (!p || p.where !== "world") {
            last = null;
            return;
          }
          if (last) {
            const d = Math.hypot(p.pos[0] - last[0], p.pos[2] - last[2]);
            if (d < 2) {
              outdoor += d;
              if (groundKind(p.pos[0], p.pos[2]) !== "lawn") onPath += d;
              else if (process.env.NAVDBG) console.log("LAWN", p.pos[0].toFixed(1), p.pos[2].toFixed(1));
            }
          }
          last = p.pos;
        },
        female,
        player: at("room_window", "hostel", female),
        crowd: 0,
        start: (n) => n.walk(lead, { x: R.from[0], z: R.from[2], yaw: 0 }, R.route, { speed: 2.1, lead: 12 }),
        playerGoal: (n) => {
          const p = n.positionOf(lead);
          return p ? [p.pos[0], p.pos[2]] : [R.route[R.route.length - 1]![0], R.route[R.route.length - 1]![2]];
        },
      });
      expectClean(r, "M1 lead");
      expect(outdoor).toBeGreaterThan(40);
      expect(onPath / outdoor, `on the footpath for ${((100 * onPath) / outdoor).toFixed(0)}% of ${outdoor.toFixed(0)} m`).toBeGreaterThan(0.8);
    }, 120_000);
  }

  it("M1: the goat chase runs real paths through a crowd", async () => {
    const R = NAV_ROUTES.m001_goat();
    const goat = new Rec();
    const r = await simulateAsync({
      female: false,
      player: [R.from[0] - 3, 0, R.from[2] - 2],
      crowd: 12,
      start: async (n) => {
        let from = { x: R.from[0], z: R.from[2], yaw: 0 };
        for (const p of R.route) {
          await n.walk(goat, from, [p], { speed: 4.4, radius: 0.35, allow: ["lawn"] });
          const g = n.positionOf(goat)!.pos;
          from = { x: g[0], z: g[2], yaw: 0 };
        }
      },
      playerGoal: (n) => {
        const g = n.positionOf(goat)?.pos ?? R.from;
        return [g[0], g[2]];
      },
    });
    expectClean(r, "goat");
  }, 120_000);

  it("M3: Idris follows you to the kitchen", async () => {
    const idris = new Rec();
    const door = at("idris_door", "hostel");
    const kitchen = at("kitchen_circle", "hostel");
    const r = await simulateAsync({
      female: false,
      player: [door[0], 0, door[2] + 1.0],
      start: (n) => {
        n.follow(idris, { x: door[0], z: door[2] + 2.2, yaw: 0 }, { gap: 1.1, maxSpeed: 2.8 });
        return new Promise<void>(() => undefined);
      },
      until: (pl) => Math.hypot(pl.x - kitchen[0], pl.z - kitchen[2]) < 1.5,
      playerGoal: () => [kitchen[0], kitchen[2]],
      maxSecs: 60,
    });
    expectClean(r, "M3 follow");
  }, 60_000);

  it("M9: Jega follows you to the sports gate", async () => {
    const jega = new Rec();
    const gate = at("sports_gate", "world");
    const r = await simulateAsync({
      female: false,
      player: [-185.6, 0, -212.0],
      crowd: 6,
      start: (n) => {
        n.follow(jega, { x: -187.4, z: -212.4, yaw: 0 }, { gap: 1.2, maxSpeed: 2.6 });
        return new Promise<void>(() => undefined);
      },
      until: (pl) => Math.hypot(pl.x - gate[0], pl.z - gate[2]) < 3,
      playerGoal: () => [gate[0], gate[2]],
      maxSecs: 120,
    });
    expectClean(r, "M9 follow");
  }, 120_000);

  it("a crowd of 20 milling at the Spot for two minutes: no overlaps, nothing inside anything, nobody stuck", async () => {
    const spot = at("spot_counter", "world");
    const r = await simulateAsync({
      female: false,
      player: [spot[0] + 3, 0, spot[2] + 4],
      crowd: 20,
      start: () => new Promise<void>(() => undefined),
      playerGoal: () => [spot[0] + 3, spot[2] + 4],
      maxSecs: 120,
    });
    expect(r.inside).toEqual([]);
    expect(r.overlaps).toEqual([]);
    expect(r.maxStuck).toBeLessThan(5);
  }, 120_000);
});

/* ------------------------------------------------------------ cutscene walks */

function fakeWorld(female: boolean, n: StoryNav, legs: string[]): StageWorld {
  const cam = new pc.Entity("cam");
  const ents = new Map<string, pc.Entity>();
  return {
    cam,
    anchor: (nm, w) => anchorIn(nm, w, female),
    actor: (role): StageActor => {
      let e = ents.get(role);
      if (!e) ents.set(role, (e = new pc.Entity(role)));
      const kind = role === "CAR" || role === "KEKE" ? "vehicle" : role === "GOAT" ? "goat" : "person";
      return { kind, ent: e, radius: kind === "vehicle" ? 0 : 0.3 };
    },
    ground: (x, z) => surfaceHeight(x, z),
    clearCam: (p) => p,
    prop: () => null,
    showProp: () => undefined,
    light: () => undefined,
    fx: () => undefined,
    sfx: () => undefined,
    music: () => undefined,
    say: () => undefined,
    speakerName: (r) => r,
    ui: { letterbox: () => undefined, subtitle: () => undefined, fade: () => undefined, skipButton: () => undefined, titleCard: () => undefined, calendar: () => undefined },
    gameplayCam: () => ({ pos: [0, 2, 0], look: [0, 1, 1] }),
    crowd: () => undefined,
    clearCrowd: () => undefined,
    navRoute: (pts) => {
      // Every leg's end must be reachable on the grid (no route into a wall or a closed room).
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!, b = pts[i]!;
        if (placeOf(a[0], a[1]) !== placeOf(b[0], b[1])) continue;
        const s = n.nav.search(n.nav.nearestWalkable(a[0], a[1]) ?? a, n.nav.nearestWalkable(b[0], b[1]) ?? b);
        s.finishNow();
        if (!s.reached) legs.push(`${a.map((v) => v.toFixed(1))} -> ${b.map((v) => v.toFixed(1))}`);
      }
      return n.planRoute(pts);
    },
    blocked: (x, z, r) => COL.blocked(x, z, r),
  };
}

describe("cutscenes: every actor walk is a real path (reachable, never through anything)", () => {
  for (const female of [false, true]) {
    it(`all 35 blocks, ${female ? "female" : "male"} player`, () => {
      const n = new StoryNav(COL, undefined, { player: () => ({ x: 0, y: 0, z: 0, place: "none", vx: 0, vz: 0, visible: false }), unseen: () => true, female: () => female });
      const unreachable: string[] = [];
      const inside: string[] = [];
      for (const cut of cuts) {
        const legs: string[] = [];
        const world = fakeWorld(female, n, legs);
        const d = new Director(cut, STAGES[cut.id]!(ctx(female)), world, ctx(female), () => undefined);
        const moving = new Map<string, A3>();
        for (let t = 0; t < cut.maxDuration + 2 && !d.done; t += 1 / 30) {
          d.update(1 / 30, false);
          for (const [role, p] of Object.entries(d.endPositions())) {
            const prev = moving.get(role);
            moving.set(role, [p[0], 0, p[1]]);
            // Only bodies that walk this frame are judged (marks are checked by the staging tests).
            if (!prev || Math.hypot(prev[0] - p[0], prev[2] - p[1]) < 1e-3) continue;
            if (["CAR", "KEKE"].includes(role)) continue;
            if (COL.blocked(p[0], p[1], 0.18) && inside.length < 20) inside.push(`${cut.id} ${role} at ${p[0].toFixed(1)},${p[1].toFixed(1)}`);
          }
        }
        for (const l of legs) unreachable.push(`${cut.id}: ${l}`);
      }
      expect(unreachable).toEqual([]);
      expect(inside).toEqual([]);
    }, 240_000);
  }
});

/* ------------------------------------------------------------ doors */

describe("doors: every link joins two walkable spots", () => {
  for (const female of [false, true]) {
    it(`both sides of every door are open floor (${female ? "female" : "male"})`, () => {
      const nav = new NavGrid(navWorld(COL));
      const bad: string[] = [];
      for (const l of navLinks(female)) {
        if (!nav.nearestWalkable(l.a[0], l.a[1], 0.6)) bad.push(`${l.label} from-side ${l.a}`);
        if (!nav.nearestWalkable(l.b[0], l.b[1], 0.6)) bad.push(`${l.label} to-side ${l.b}`);
      }
      expect(bad).toEqual([]);
    });
  }

  for (const female of [false, true])
    it(`every door link passes through a modelled door, with nothing in the way (${female ? "female" : "male"})`, () => {
      const specs = doorSpecs(surfaceHeight);
      const bad: string[] = [];
      for (const l of navLinks(female)) {
        for (const [side, door, stand, place] of [["leave", l.doorA, l.a, l.from], ["arrive", l.doorB, l.b, l.to]] as const) {
          // The passage point: where the line from the standing spot meets the door.
          const spec = specs.find((d) => d.id === door.id);
          if (!spec) {
            bad.push(`${l.label} ${side}: no door model ${door.id}`);
            continue;
          }
          if (spec.place !== place) bad.push(`${l.label} ${side}: door ${spec.id} is in ${spec.place}, not ${place}`);
          const near = specs.filter((d) => d.place === place && d.rest === "closed" && Math.hypot(d.x - door.x, d.z - door.z) < 0.5);
          if (!near.length) bad.push(`${l.label} ${side}: no door within 0.5 m of the passage point`);
          // You stand just in front of it, facing it, and nothing solid is between you and it.
          const dist = Math.hypot(stand[0] - spec.x, stand[1] - spec.z);
          if (dist > 1.3 || dist < 0.4) bad.push(`${l.label} ${side}: standing spot ${dist.toFixed(2)} m from the door`);
          const fx = Math.sin(spec.yaw), fz = Math.cos(spec.yaw);
          const ax = spec.x + fx * 0.36, az = spec.z + fz * 0.36;
          if (COL.blocked(ax, az, 0.25)) bad.push(`${l.label} ${side}: wall at the passage point ${ax.toFixed(1)},${az.toFixed(1)}`);
          const n = 8;
          for (let i = 0; i <= n; i++) {
            const x = stand[0] + ((ax - stand[0]) * i) / n, z = stand[1] + ((az - stand[1]) * i) / n;
            if (COL.blocked(x, z, 0.22)) {
              bad.push(`${l.label} ${side}: something between the standing spot and the door at ${x.toFixed(1)},${z.toFixed(1)}`);
              break;
            }
          }
          // The door faces the standing spot.
          if ((stand[0] - spec.x) * fx + (stand[1] - spec.z) * fz < 0.3) bad.push(`${l.label} ${side}: door faces away`);
        }
      }
      expect(bad).toEqual([]);
    });

  it("every building entrance and interior exit has its door; room doorways have frames", () => {
    const specs = doorSpecs(surfaceHeight);
    for (const id of ["hostel.giginya.entrance", "hostel.kadanya.entrance", "senate.entrance", "sug.entrance", "yamma.entrance", "gabas.entrance", "lab.entrance", "ae.entrance"]) expect(specs.some((d) => d.id === id), id).toBe(true);
    for (const p of INTERIORS) for (const d of p.doors) expect(specs.some((s) => s.id === d.id), d.id).toBe(true);
    const hostel = specs.filter((d) => d.place === "hostel" && d.id.includes("gap"));
    expect(hostel.map((d) => d.rest).sort()).toEqual(["frame", "open", "open"]);
  });

  it("a route from a hostel room to the Spot goes out through the stairs and the front door", () => {
    const from = at("room_door", "hostel"), to = at("spot_counter", "world");
    const legs = routeLegs([from[0], from[2]], [to[0], to[2]], navLinks(false));
    expect(legs.length).toBe(2);
    expect(legs[0]!.where).toBe("hostel");
    expect(legs[0]!.link?.to).toBe("world");
  });
});


/* ------------------------------------------------------------ ground arrows */

describe("ground arrows: chevrons follow the walking route and lie on walkable ground", () => {
  it("every chevron sits on the planned path, on open ground, 1.5 m apart, fading out ahead", () => {
    const nav = new NavGrid(navWorld(COL));
    const a = frontOf(hall(false), 3), b = at("spot_counter", "world");
    const path = nav.findPath([a[0], a[2]], nav.nearestWalkable(b[0], b[2])!)!;
    for (const t of [0, 0.4, 3.7]) {
      const marks = trailMarks(path, [a[0], a[2]], t);
      expect(marks.length).toBeGreaterThan(12);
      for (const m of marks) {
        expect(projectOnPath(path, [m.x, m.z]).d).toBeLessThan(0.02);
        expect(nav.walkable(m.x, m.z), `${m.x},${m.z}`).toBe(true);
        expect(COL.blocked(m.x, m.z, 0.1)).toBe(false);
        expect(surfaceHeight(m.x, m.z)).toBeLessThan(0.3);
      }
      for (let i = 1; i < marks.length; i++) {
        const d = Math.hypot(marks[i]!.x - marks[i - 1]!.x, marks[i]!.z - marks[i - 1]!.z);
        expect(d).toBeLessThan(1.51);
        expect(d).toBeGreaterThan(0.9);
      }
      expect(marks[marks.length - 1]!.fade).toBeLessThan(0.35);
      expect(Math.max(...marks.map((m) => m.fade))).toBe(1);
    }
  });

  it("starts from where you are on the route (not from where it was planned)", () => {
    const path: NavPoint[] = [[0, 0], [0, 40]];
    const m = trailMarks(path, [0.4, 20], 0);
    expect(m[0]!.z).toBeGreaterThan(21);
    expect(m.every((k) => k.z > 20 && k.z < 40)).toBe(true);
  });
});
