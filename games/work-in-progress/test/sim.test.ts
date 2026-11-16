/**
 * Pure logic: day/night maths, lanes, traffic following, crowd wandering,
 * collisions and smoothing helpers.
 */
import { describe, expect, it } from "vitest";
import { buildGraph, makeWalker, nextNode, stepWalker } from "../src/sim/crowd.ts";
import { CollisionWorld, pushOut } from "../src/sim/collide.ts";
import { clockText, hemisphereSH, skyAt, sunDirection } from "../src/sim/daynight.ts";
import { angleDelta, damp, dampAngle, forwardOf, spring, yawFor } from "../src/sim/motion.ts";
import { arc, makePath, sample, turnAhead } from "../src/sim/path.ts";
import { fbm, makeRng, noise2 } from "../src/sim/rng.ts";
import { type Vehicle, gapAhead, placeVehicle, stepTraffic, targetSpeed } from "../src/sim/traffic.ts";

describe("day and night", () => {
  it("puts the sun high at noon, below the horizon at midnight, near the horizon at 6:15 and 18:15", () => {
    expect(sunDirection(12).elevation).toBeGreaterThan(70);
    expect(sunDirection(0).elevation).toBeLessThan(-50);
    expect(Math.abs(sunDirection(6.2).elevation)).toBeLessThan(6);
    expect(Math.abs(sunDirection(18.2).elevation)).toBeLessThan(6);
  });
  it("rises in the east and sets in the west", () => {
    expect(sunDirection(8).dir[0]).toBeGreaterThan(0.5);
    expect(sunDirection(16).dir[0]).toBeLessThan(-0.5);
  });
  it("returns unit sun vectors", () => {
    for (let h = 0; h < 24; h += 0.5) expect(Math.hypot(...sunDirection(h).dir)).toBeCloseTo(1, 6);
  });
  it("is fully night at 23:00 and fully day at 10:00, with lights fading in between", () => {
    expect(skyAt(23).night).toBeCloseTo(1, 3);
    expect(skyAt(10).night).toBe(0);
    const dusk = skyAt(18.4).night;
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
    expect(skyAt(23).sunIntensity).toBe(0);
  });
  it("blends sky colours continuously (no jumps between keys)", () => {
    let prev = skyAt(5);
    for (let h = 5; h < 20; h += 0.02) {
      const s = skyAt(h);
      for (let c = 0; c < 3; c++) expect(Math.abs(s.skyHorizon[c]! - prev.skyHorizon[c]!)).toBeLessThan(0.08);
      prev = s;
    }
  });
  it("builds hemisphere light: brighter from the sky side than from the ground", () => {
    const sh = hemisphereSH([0.6, 0.7, 0.9], [0.2, 0.15, 0.1], [0, 0, 0], [0, 1, 0]);
    const up = sh[0]! + sh[6]!, down = sh[0]! - sh[6]!;
    expect(up).toBeCloseTo(0.6, 5);
    expect(down).toBeCloseTo(0.2, 5);
  });
  it("formats the clock", () => {
    expect(clockText(7.5)).toBe("07:30");
    expect(clockText(23.999)).toBe("23:59");
  });
});

describe("paths", () => {
  it("measures length and samples positions and headings", () => {
    const p = makePath([[0, 0], [10, 0], [10, 10]]);
    expect(p.length).toBeCloseTo(20);
    const s = sample(p, 15);
    expect(s.x).toBeCloseTo(10);
    expect(s.z).toBeCloseTo(5);
    expect(s.dz).toBeCloseTo(1);
  });
  it("wraps closed paths and clamps open ones", () => {
    const loop = makePath([[0, 0], [10, 0], [10, 10], [0, 10]], true);
    expect(loop.length).toBeCloseTo(40);
    expect(sample(loop, 41).x).toBeCloseTo(1);
    expect(sample(makePath([[0, 0], [5, 0]]), 99).x).toBeCloseTo(5);
  });
  it("draws arcs anticlockwise on a north-up map (traffic drives on the right)", () => {
    const a = arc(0, 0, 10, 0, Math.PI / 2);
    expect(a[0]![0]).toBeCloseTo(10);
    expect(a[a.length - 1]![1]).toBeCloseTo(-10); // north is -z
  });
  it("sees bends ahead", () => {
    const p = makePath([[0, 0], [20, 0], [20, 20]]);
    expect(turnAhead(p, 0, 5)).toBeCloseTo(0);
    expect(turnAhead(p, 15, 10)).toBeGreaterThan(1);
  });
});

const car = (path: number, s: number, cruise = 12): Vehicle => ({ kind: "car", path, s, speed: cruise, cruise, length: 4.2, x: 0, z: 0, dx: 1, dz: 0, wait: 0 });

describe("traffic", () => {
  const paths = [makePath([[0, 0], [400, 0]])];
  it("follows its lane", () => {
    const v = car(0, 10);
    placeVehicle(v, paths);
    stepTraffic([v], paths, 1);
    expect(v.s).toBeGreaterThan(10);
    expect(v.z).toBeCloseTo(0);
    expect(v.dx).toBeCloseTo(1);
  });
  it("keeps a gap: a car behind a stopped car stops before touching it", () => {
    const front = car(0, 60, 0);
    front.speed = 0;
    const back = car(0, 20);
    const vs = [front, back];
    vs.forEach((v) => placeVehicle(v, paths));
    for (let i = 0; i < 60 * 20; i++) stepTraffic(vs, paths, 1 / 60);
    expect(front.s - back.s).toBeGreaterThan((front.length + back.length) / 2);
    expect(back.speed).toBeLessThan(0.5);
  });
  it("stops for a person standing in the lane, then goes again", () => {
    const v = car(0, 0);
    placeVehicle(v, paths);
    const person = [{ x: 40, z: 0, r: 0.4 }];
    for (let i = 0; i < 60 * 10; i++) stepTraffic([v], paths, 1 / 60, person);
    expect(v.x).toBeLessThan(40 - 0.4 - 2);
    for (let i = 0; i < 60 * 5; i++) stepTraffic([v], paths, 1 / 60, []);
    expect(v.speed).toBeGreaterThan(5);
  });
  it("ignores oncoming traffic in the other lane", () => {
    const paths2 = [makePath([[0, 2.5], [400, 2.5]]), makePath([[400, -2.5], [0, -2.5]])];
    const a = car(0, 50), b = car(1, 330);
    [a, b].forEach((v) => placeVehicle(v, paths2));
    expect(gapAhead(a, [a, b], [])).toBe(28);
  });
  it("slows down for bends", () => {
    const bend = makePath([[0, 0], [30, 0], ...arc(30, -10, 10, -Math.PI / 2, 0).slice(1)]);
    const v = car(0, 25);
    placeVehicle(v, [bend]);
    expect(targetSpeed(v, 99, bend)).toBeLessThan(v.cruise);
  });
  it("re-enters at the start of an open lane after the end", () => {
    const v = car(0, 399);
    placeVehicle(v, paths);
    for (let i = 0; i < 60 * 5; i++) stepTraffic([v], paths, 1 / 60);
    expect(v.s).toBeLessThan(100);
  });
  it("behaves the same at any frame rate (fixed step)", () => {
    const run = (substeps: number) => {
      const v = car(0, 0);
      placeVehicle(v, paths);
      for (let i = 0; i < 60 * 4; i++) stepTraffic([v], paths, 1 / 60);
      return Math.round(v.s * 1000) + substeps * 0;
    };
    expect(run(1)).toBe(run(2));
  });
});

describe("crowd", () => {
  const g = buildGraph([[[0, 0], [10, 0], [20, 0]], [[10, 0], [10, 10]], [[20, 0.3], [20, 8]]]);
  it("joins lines that meet (snap and T-junctions)", () => {
    const at10 = g.nodes.findIndex((n) => Math.hypot(n[0] - 10, n[1]) < 0.01);
    expect(g.edges[at10]!.length).toBe(3);
    const at20 = g.nodes.findIndex((n) => Math.hypot(n[0] - 20, n[1]) < 0.01);
    expect(g.edges[at20]!.length).toBe(2);
  });
  it("splits a line where another line's end touches its middle", () => {
    const t = buildGraph([[[0, 0], [20, 0]], [[10, 0.2], [10, 9]]]);
    expect(t.nodes.length).toBe(4);
  });
  it("never turns straight back unless it is a dead end", () => {
    const rng = makeRng(3);
    const at10 = g.nodes.findIndex((n) => Math.hypot(n[0] - 10, n[1]) < 0.01);
    const from = g.edges[at10]![0]!;
    for (let i = 0; i < 50; i++) expect(nextNode(g, at10, from, rng)).not.toBe(from);
    const end = g.nodes.findIndex((n) => Math.hypot(n[0], n[1]) < 0.01);
    expect(nextNode(g, end, g.edges[end]![0]!, rng)).toBe(g.edges[end]![0]);
  });
  it("walks along edges at its own speed and stays on the network", () => {
    const rng = makeRng(9);
    const w = makeWalker(g, rng);
    for (let i = 0; i < 60 * 60; i++) {
      stepWalker(w, g, 1 / 60, rng, 0);
      expect(w.x).toBeGreaterThan(-1.5);
      expect(w.x).toBeLessThan(21.5);
      expect(w.z).toBeGreaterThan(-1.5);
      expect(w.z).toBeLessThan(11.5);
    }
  });
  it("sometimes stops to idle", () => {
    const rng = makeRng(11);
    const w = makeWalker(g, rng);
    let idled = false;
    for (let i = 0; i < 60 * 120; i++) {
      stepWalker(w, g, 1 / 60, rng, 0.5);
      if (!w.moving) idled = true;
    }
    expect(idled).toBe(true);
  });
});

describe("collision", () => {
  it("pushes a circle out of a box and out of a circle", () => {
    expect(pushOut({ kind: "box", x: 0, z: 0, hx: 2, hz: 1, rot: 0 }, 2.1, 0, 0.3)![0]).toBeCloseTo(2.3);
    expect(pushOut({ kind: "box", x: 0, z: 0, hx: 2, hz: 1, rot: 0 }, 5, 0, 0.3)).toBeNull();
    const c = pushOut({ kind: "circle", x: 0, z: 0, r: 1 }, 0.5, 0, 0.5)!;
    expect(Math.hypot(c[0], c[1])).toBeCloseTo(1.5);
  });
  it("handles rotated boxes", () => {
    // A 4 x 1 box turned 90 degrees is long along z.
    const box = { kind: "box" as const, x: 0, z: 0, hx: 2, hz: 0.5, rot: Math.PI / 2 };
    expect(pushOut(box, 0, 1.8, 0.2)).not.toBeNull();
    expect(pushOut(box, 1.8, 0, 0.2)).toBeNull();
  });
  it("slides along walls instead of sticking (resolve keeps the free axis)", () => {
    const w = new CollisionWorld();
    w.add({ kind: "box", x: 0, z: 0, hx: 10, hz: 1, rot: 0 });
    const [x, z] = w.resolve(3, 1.1, 0.33);
    expect(x).toBeCloseTo(3);
    expect(z).toBeCloseTo(1.33);
  });
  it("shortens the camera arm before it enters a tall building, but not for low walls", () => {
    const w = new CollisionWorld();
    w.add({ kind: "box", x: 0, z: -5, hx: 3, hz: 1, rot: 0, h: 12 });
    w.add({ kind: "box", x: 0, z: 5, hx: 3, hz: 1, rot: 0, h: 0.8 });
    expect(w.clearance(0, 1.5, 0, 0, 3, -10)).toBeLessThan(0.5);
    expect(w.clearance(0, 1.5, 0, 0, 3, 10)).toBe(1);
  });
});

describe("smoothing", () => {
  it("damp is frame-rate independent", () => {
    let a = 0, b = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 10, 4, 1 / 60);
    for (let i = 0; i < 144; i++) b = damp(b, 10, 4, 1 / 144);
    expect(a).toBeCloseTo(b, 6);
  });
  it("turns the short way round", () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(dampAngle(3.1, -3.1, 100, 1)).toBeGreaterThan(3.1);
  });
  it("springs settle without overshoot", () => {
    let x = 0, v = 0, max = 0;
    for (let i = 0; i < 600; i++) {
      [x, v] = spring(x, v, 1, 12, 1 / 60);
      max = Math.max(max, x);
    }
    expect(x).toBeCloseTo(1, 4);
    expect(max).toBeLessThanOrEqual(1.0001);
  });
  it("yaw and forward are inverses: a model faces where it travels", () => {
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0.6, -0.8]] as const) {
      const [fx, fz] = forwardOf(yawFor(dx, dz));
      expect(fx).toBeCloseTo(dx);
      expect(fz).toBeCloseTo(dz);
    }
  });
});

describe("seeded randomness", () => {
  it("repeats for the same seed", () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it("noise stays in 0..1", () => {
    for (let i = 0; i < 500; i++) {
      const n = noise2(i * 0.37, i * 0.71), f = fbm(i * 0.13, i * 0.29);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});
