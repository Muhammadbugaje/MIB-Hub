/**
 * The map plan and the models obey the "nothing overlaps, nothing sinks,
 * nothing faces backwards" rules (owner direction, 16 Nov 2026; plan §1).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Builder, MeshData } from "../src/gfx/builder.ts";
import { buildGraph } from "../src/sim/crowd.ts";
import { makePath, sample, type P2 } from "../src/sim/path.ts";
import { type Building, buildings, lanes, roads, streetLights, trees, walkLines, poleRuns, benches, RB, CLOCK } from "../src/world/layout.ts";
import { Y } from "../src/world/roads.ts";
import { surfaceHeight } from "../src/world/surface.ts";
import { KEKE_SEATS, OKADA_SEATS, kekeMesh, okadaMesh } from "../src/world/vehicle-models.ts";

type Rect = { x: number; z: number; hx: number; hz: number; rot: number };
const corners = (r: Rect): P2[] => {
  const c = Math.cos(r.rot), s = Math.sin(r.rot);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const lx = a! * r.hx, lz = b! * r.hz;
    return [r.x + lx * c + lz * s, r.z - lx * s + lz * c] as P2;
  });
};
/** Separating-axis test for two rotated rectangles. */
function overlap(a: Rect, b: Rect, margin = 0): boolean {
  const ca = corners(a), cb = corners(b);
  const axes: P2[] = [];
  for (const cs of [ca, cb]) for (let i = 0; i < 2; i++) {
    const p = cs[i]!, q = cs[i + 1]!;
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    axes.push([-(q[1] - p[1]) / l, (q[0] - p[0]) / l]);
  }
  return axes.every((ax) => {
    const pa = ca.map((p) => p[0] * ax[0] + p[1] * ax[1]), pb = cb.map((p) => p[0] * ax[0] + p[1] * ax[1]);
    return Math.max(...pa) + margin > Math.min(...pb) && Math.max(...pb) + margin > Math.min(...pa);
  });
}
const footprint = (b: Building): Rect => ({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, rot: b.rot });
/** Road strips as rectangles (including the kerbs and sidewalks either side). */
const roadRects = (extra: number): Rect[] =>
  roads.flatMap((r) => r.line.slice(1).map((q, i) => {
    const p = r.line[i]!;
    const dx = q[0] - p[0], dz = q[1] - p[1];
    return { x: (p[0] + q[0]) / 2, z: (p[1] + q[1]) / 2, hx: r.width / 2 + extra, hz: Math.hypot(dx, dz) / 2, rot: Math.atan2(dx, dz) };
  }));
const onRoad = (x: number, z: number, extra = 0) => roadRects(extra).some((r) => overlap(r, { x, z, hx: 0.01, hz: 0.01, rot: 0 })) ||
  (Math.hypot(x - RB.x, z - RB.z) < RB.outer + extra && Math.hypot(x - RB.x, z - RB.z) > RB.island - extra) ||
  (Math.hypot(x - CLOCK.x, z - CLOCK.z) < CLOCK.outer + extra && Math.hypot(x - CLOCK.x, z - CLOCK.z) > CLOCK.island - extra);

describe("map plan: nothing overlaps", () => {
  it("no two buildings overlap", () => {
    const bad: string[] = [];
    for (let i = 0; i < buildings.length; i++)
      for (let j = i + 1; j < buildings.length; j++)
        if (overlap(footprint(buildings[i]!), footprint(buildings[j]!), -0.05)) bad.push(`${buildings[i]!.style}@${buildings[i]!.x.toFixed(0)},${buildings[i]!.z.toFixed(0)} x ${buildings[j]!.style}@${buildings[j]!.x.toFixed(0)},${buildings[j]!.z.toFixed(0)}`);
    expect(bad).toEqual([]);
  });
  it("no building stands on a road or its sidewalks", () => {
    const rr = roadRects(3.6 + 0.3);
    const bad = buildings.filter((b) => rr.some((r) => overlap(footprint(b), r))).map((b) => `${b.style}@${b.x.toFixed(1)},${b.z.toFixed(1)}`);
    expect(bad).toEqual([]);
  });
  it("no tree grows in a road, on a sidewalk or inside a building", () => {
    const fp = buildings.map(footprint);
    const bad = trees.filter((t) => t.kind !== "far").filter((t) => onRoad(t.x, t.z, 3.6 + 0.4) || fp.some((f) => overlap(f, { x: t.x, z: t.z, hx: 0.5, hz: 0.5, rot: 0 })));
    expect(bad.map((t) => `${t.kind}@${t.x.toFixed(1)},${t.z.toFixed(1)}`)).toEqual([]);
  });
  it("street lights, power poles and benches stay off the tarmac", () => {
    const pts: [string, number, number][] = [...streetLights.map((l): [string, number, number] => ["light", l.x, l.z]), ...poleRuns.flat().map((p): [string, number, number] => ["pole", p[0], p[1]]), ...benches.map((b): [string, number, number] => ["bench", b.x, b.z])];
    expect(pts.filter(([, x, z]) => onRoad(x, z, 0.1)).map(([k, x, z]) => `${k}@${x},${z}`)).toEqual([]);
  });
  it("every traffic lane runs on tarmac (checked every 2 m, ends excepted)", () => {
    const bad: string[] = [];
    lanes.forEach((l, i) => {
      const p = makePath(l.pts);
      for (let s = 0; s < p.length; s += 2) {
        const q = sample(p, s);
        if (Math.abs(q.x) > 400 || Math.abs(q.z) > 400) continue;
        if (!onRoad(q.x, q.z, 0.2)) bad.push(`lane ${i} at ${q.x.toFixed(1)},${q.z.toFixed(1)}`);
      }
    });
    expect(bad.slice(0, 10)).toEqual([]);
  });
  it("footpaths are one connected network, and no walker path goes through a building", () => {
    const g = buildGraph(walkLines);
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) for (const n of g.edges[stack.pop()!]!) if (!seen.has(n)) {
      seen.add(n);
      stack.push(n);
    }
    expect(seen.size).toBe(g.nodes.length);
    const fp = buildings.map(footprint);
    const bad: string[] = [];
    g.nodes.forEach((a, i) => g.edges[i]!.forEach((j) => {
      if (j < i) return;
      const b = g.nodes[j]!;
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
      for (let k = 0; k <= n; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / n, z = a[1] + ((b[1] - a[1]) * k) / n;
        const hit = fp.findIndex((f) => Math.abs(f.x - x) < f.hx + f.hz + 1 && Math.abs(f.z - z) < f.hx + f.hz + 1 && overlap(f, { x, z, hx: 0.25, hz: 0.25, rot: 0 }));
        if (hit >= 0) {
          bad.push(`${buildings[hit]!.style} at ${x.toFixed(1)},${z.toFixed(1)}`);
          break;
        }
      }
    }));
    expect(bad).toEqual([]);
  }, 30000);
});

describe("heights: nothing sinks, nothing shimmers", () => {
  it("flat layers are at least 1.2 cm apart (no z-fighting)", () => {
    const ys = [0, Y.lawn, Y.laterite, Y.paving, Y.pathEdge, Y.path, Y.road, Y.ring, Y.mark].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(0.012);
  });
  it("the surface under people matches what is drawn", () => {
    expect(surfaceHeight(-60, 7)).toBe(Y.walk); // Ring Road sidewalk
    expect(surfaceHeight(-60, 2)).toBe(Y.road); // Ring Road tarmac
    expect(surfaceHeight(0, -176 + 12)).toBe(Y.path); // quad path
    expect(surfaceHeight(12, 0)).toBe(Y.ring); // roundabout
    expect(surfaceHeight(-75, -130)).toBe(0); // open grass
  });
});

function model(build: (b: Builder) => void): MeshData {
  const d = new MeshData();
  const b = new Builder(() => d);
  b.at(0, 0);
  build(b);
  return d;
}

describe("vehicle models (the classic game's complaints)", () => {
  for (const [name, build, seats] of [
    ["okada", (b: Builder) => okadaMesh(b, [200, 50, 40, 255]), Object.values(OKADA_SEATS)],
    ["keke", (b: Builder) => kekeMesh(b, [240, 190, 40, 255], [40, 140, 70, 255]), Object.values(KEKE_SEATS)],
  ] as const) {
    const d = model(build);
    const ys = d.pos.filter((_, i) => i % 3 === 1), zs = d.pos.filter((_, i) => i % 3 === 2);
    it(`${name}: the wheels touch the road exactly (lowest point y = 0)`, () => {
      expect(Math.min(...ys)).toBeCloseTo(0, 4);
    });
    it(`${name}: faces +z, so it is never ridden backwards (headlamp at the front)`, () => {
      const lamp = model((b) => {
        const real = b.box.bind(b);
        b.box = (mat, ...rest) => (mat === "lamp" ? real(mat, ...rest) : undefined);
        build(b);
      });
      // The brightest lamp (the headlamp) is the one furthest forward.
      const lz = lamp.pos.filter((_, i) => i % 3 === 2);
      expect(Math.max(...lz)).toBeGreaterThan(0.5);
      expect(Math.max(...zs)).toBeGreaterThan(-Math.min(...zs) - 0.5);
    });
    it(`${name}: seats sit above the wheels and inside the body`, () => {
      for (const s of seats) {
        expect(s.y).toBeGreaterThan(0.5);
        expect(Math.abs(s.z)).toBeLessThan(1.2);
      }
    });
  }
});

describe("people assets", () => {
  const index = JSON.parse(readFileSync(resolve(__dirname, "../assets/people2/index.json"), "utf8")) as Record<string, { height: number; hipHeight: number; rig: string; fit?: unknown; female: boolean; meshes: { name: string; tris: number }[] }>;
  const anim = JSON.parse(readFileSync(resolve(__dirname, "../assets/anim/index.json"), "utf8")) as { clips: Record<string, { speed?: number }> };
  it("a male and a female base on mib_rig at one human height, with eyes, brows, hair and headwear fit data", () => {
    expect(Object.values(index).map((b) => b.female).sort()).toEqual([false, true]);
    for (const [k, m] of Object.entries(index)) {
      expect(m.rig, k).toBe("mib_rig");
      expect(m.height, k).toBeCloseTo(1.74, 2);
      expect(m.hipHeight, k).toBeGreaterThan(0.8);
      expect(m.hipHeight, k).toBeLessThan(1.05);
      expect(m.fit, k).toBeTruthy();
      const names = m.meshes.map((x) => x.name);
      expect(names, k).toEqual(expect.arrayContaining(["body", "eyes", "brows"]));
      expect(names.filter((n) => n.startsWith("hair_")).length, k).toBeGreaterThanOrEqual(2);
      // Budget: about 12-13k triangles for the body.
      expect(m.meshes.find((x) => x.name === "body")!.tris, k).toBeLessThan(16000);
    }
  });
  it("the shared clip set has idle, walk, jog, run and sprint with measured strides", () => {
    expect(anim.clips.idle_breathe).toBeTruthy();
    const sp = ["walk_fwd", "jog_fwd", "run_fwd", "sprint_fwd"].map((id) => anim.clips[id]?.speed ?? 0);
    expect(sp[0]).toBeGreaterThan(1.2);
    expect(sp[3]).toBeLessThan(8);
    for (let i = 1; i < sp.length; i++) expect(sp[i]).toBeGreaterThan(sp[i - 1]!);
  });
});

describe("hosting limits (Cloudflare static assets)", () => {
  const LIMIT = 25 * 1024 * 1024;
  const walk = (dir: string, out: { path: string; size: number }[] = []) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p, out);
      else out.push({ path: p, size: st.size });
    }
    return out;
  };
  const files = walk(resolve(__dirname, "../../../apps/web/public"));
  it("no public file is 25 MiB or larger", () => {
    expect(files.filter((f) => f.size >= LIMIT).map((f) => f.path)).toEqual([]);
  });
  it("the public folder stays well under 20,000 files", () => {
    expect(files.length).toBeLessThan(15000);
  });
  it("each game asset is under 5 MB", () => {
    const game = walk(resolve(__dirname, "../assets"));
    expect(game.filter((f) => f.size > 5 * 1024 * 1024).map((f) => f.path)).toEqual([]);
  });
});
