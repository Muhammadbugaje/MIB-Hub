/**
 * Street furniture and landmarks: the campus gate and fence, the Amana Clock
 * tower (stuck at 6:06), fountains and the roundabout sculpture, street
 * lights, power poles with sagging wires, benches, bins, football goals, the
 * suya grill and parked motorbikes. All static, merged into the world.
 */
import type { Builder, RGBA } from "../gfx/builder.ts";
import type { SignAtlas } from "../gfx/textures.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { makeRng } from "../sim/rng.ts";
import { CLOCK, GATE_Z, LAKE, PITCH, RB, STADIUM, SUYA, benches, okadaPark, poleRuns, streetLights } from "./layout.ts";
import { Y } from "./roads.ts";
import { surfaceHeight } from "./surface.ts";
import { okadaMesh } from "./vehicle-models.ts";

const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const STONE = hex("#efe2c8");
const IRON = hex("#2c3236");
const TRIM = hex("#f7f2e6");
const COPPER = hex("#5fa48e");
const WARM: RGBA = [255, 214, 160, 255];

export interface LightSpot { x: number; y: number; z: number; color: [number, number, number]; range: number }

export function buildProps(b: Builder, signs: SignAtlas, col: CollisionWorld): LightSpot[] {
  const lights: LightSpot[] = [];
  const rng = makeRng(404);

  /* ---- campus fence: low stone wall with iron railings and piers (two gates: main at 0, east shop gate at 80) */
  for (const [x0, x1] of [[-200, -13], [13, 78], [82, 200]] as const) {
    b.at(0, 0).tint(STONE).box("stone", (x0 + x1) / 2, 0, GATE_Z, x1 - x0, 0.7, 0.5, 4);
    for (let x = x0; x <= x1; x += 0.2) b.at(x, GATE_Z).tint(IRON).box("metal", 0, 0.7, 0, 0.035, 1.5, 0.035, 1, ["bottom"]);
    b.at(0, 0).tint(IRON).box("metal", (x0 + x1) / 2, 2.0, GATE_Z, x1 - x0, 0.05, 0.05);
    b.at(0, 0).box("metal", (x0 + x1) / 2, 0.95, GATE_Z, x1 - x0, 0.05, 0.05);
    for (let x = x0; x <= x1; x += 6) {
      b.at(x, GATE_Z).tint(STONE).box("stone", 0, 0, 0, 0.8, 2.4, 0.8, 4);
      b.box("stone", 0, 2.4, 0, 0.95, 0.18, 0.95, 4);
    }
    col.add({ kind: "box", x: (x0 + x1) / 2, z: GATE_Z, hx: (x1 - x0) / 2, hz: 0.4, rot: 0 });
  }

  /* ---- East shop gate (second pedestrian entrance to access market/kiosks) */
  for (const gx of [78, 82]) {
    const ep = b.at(gx, GATE_Z);
    ep.tint(STONE).box("stone", 0, 0, 0, 0.9, 3.2, 0.9, 4);
    ep.tint(TRIM).box("stone", 0, 3.2, 0, 1.1, 0.25, 1.1, 4);
    ep.tint(hex("#d8b45a")).dome("dome", 0, 3.45, 0, 0.2, 6, 2, true);
    col.add({ kind: "box", x: gx, z: GATE_Z, hx: 0.45, hz: 0.45, rot: 0, h: 4 });
  }
  const eastLintel = b.at(80, GATE_Z);
  eastLintel.tint(STONE).box("stone", 0, 2.8, 0, 4.0, 0.4, 0.6, 4);

  /* ---- the main gate: two great piers, pedestrian arches, a lintel with the name */
  for (const sx of [-1, 1]) {
    const g = b.at(sx * 7.6, GATE_Z);
    g.tint(STONE).box("stone", 0, 0, 0, 2.6, 8.5, 2.6, 4);
    g.tint(TRIM).box("stone", 0, 8.5, 0, 3.0, 0.5, 3.0, 4);
    g.tint(COPPER).cylinder("dome", 0, 9.0, 0, 1.2, 0, 1.6, 4, false, false);
    g.tint(hex("#d8b45a")).dome("dome", 0, 10.6, 0, 0.3, 8, 3, true);
    // Pedestrian arch beside each pier.
    const p = b.at(sx * 11.4, GATE_Z);
    p.tint(STONE).arcade("stone", -2.3, 2.3, 0.4, 0.8, 0, 5.2, 1, 2.8, 0.9);
    p.tint(TRIM).box("stone", 0, 5.2, 0, 4.9, 0.4, 1.0, 4);
    col.add({ kind: "box", x: sx * 7.6, z: GATE_Z, hx: 1.3, hz: 1.3, rot: 0, h: 10 });
    for (const ex of [-2.1, 2.1]) col.add({ kind: "box", x: sx * 11.4 + ex, z: GATE_Z, hx: 0.45, hz: 0.45, rot: 0 });
  }
  const lintel = b.at(0, GATE_Z);
  lintel.tint(STONE).box("stone", 0, 6.4, 0, 12.6, 1.6, 1.4, 4);
  lintel.tint(TRIM).box("stone", 0, 8.0, 0, 13, 0.3, 1.6, 4);
  const [u0, v0, u1, v1] = signs.uv("Welcome · Main Gate");
  for (const side of [1, -1]) {
    const sb = b.at(0, GATE_Z + side * 0.71, side > 0 ? 0 : Math.PI);
    sb.tint([255, 255, 255, 255]).poly("signs", [[-4.6, 6.6, 0.01], [4.6, 6.6, 0.01], [4.6, 7.8, 0.01], [-4.6, 7.8, 0.01]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [0, 0, 1]);
  }
  // Barrier arm and the guard's booth area.
  b.at(-3.2, GATE_Z - 3).tint(hex("#d23c3c")).box("trim", 0, 1.0, 0, 0.3, 1.0, 0.3);
  b.at(-1.6, GATE_Z - 3).tint(TRIM).box("trim", 0, 1.8, 0, 3.2, 0.12, 0.12);

  /* ---- the Amana Clock tower in the middle of the clock plaza */
  const ct = b.at(CLOCK.x, CLOCK.z);
  ct.tint(STONE).box("stone", 0, Y.walk, 0, 6, 1.2, 6, 4);
  ct.tint(hex("#b4553a")).box("brick", 0, 1.38, 0, 4.4, 15, 4.4, 2);
  for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) ct.tint(STONE).box("stone", px * 2.1, 1.38, pz * 2.1, 0.7, 15, 0.7, 4);
  ct.tint(STONE).box("stone", 0, 16.3, 0, 5.4, 4.6, 5.4, 4);
  ct.tint(TRIM).box("stone", 0, 20.9, 0, 6, 0.5, 6, 4);
  for (let k = 0; k < 4; k++) {
    const f = b.at(CLOCK.x, CLOCK.z, (k * Math.PI) / 2);
    f.tint([255, 255, 255, 255]);
    // Clock face disc on each side (a flat fan facing out).
    const n = 24, r = 1.8, cy = 18.6, cz = 2.72;
    const pts: [number, number, number][] = [];
    const uvs: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
      uvs.push([0.5 + Math.cos(a) * 0.5, 0.5 - Math.sin(a) * 0.5]); // texture v runs downwards
    }
    f.poly("clock", pts, uvs, [0, 0, 1]);
    f.tint(hex("#d8b45a")).box("metal", 0, cy - r - 0.15, cz - 0.05, r * 2 + 0.3, 0.15, 0.12);
    // Belfry openings above.
    f.tint(STONE).arcade("stone", -2.7, 2.7, 3.0, 0.3, 21.4, 25, 2, 23.6, 0.6);
  }
  ct.tint(STONE).box("stone", 0, 25, 0, 6, 0.4, 6, 4);
  ct.tint(COPPER).cylinder("dome", 0, 25.4, 0, 3.6, 0, 6.5, 4, false, false);
  ct.tint(hex("#d8b45a")).cylinder("metal", 0, 31.9, 0, 0.1, 0.01, 2, 6);
  col.add({ kind: "box", x: CLOCK.x, z: CLOCK.z, hx: 3, hz: 3, rot: 0, h: 32 });

  /* ---- roundabout sculpture: a ring of arcs (abstract "rising sun") with a pool */
  const rs = b.at(RB.x, RB.z);
  rs.tint(STONE).cylinder("stone", 0, Y.walk, 0, 4.2, 4.2, 0.6, 32);
  rs.tint([255, 255, 255, 255]).cylinder("water", 0, Y.walk + 0.62, 0, 3.8, 3.8, 0.01, 32);
  rs.tint(STONE).cylinder("stone", 0, Y.walk, 0, 1.0, 0.8, 2.2, 12);
  // A "rising sun": a golden arch of rays over a sphere, on two faces of the island.
  for (const yaw of [0, Math.PI / 2]) {
    const g = b.at(RB.x, RB.z, yaw);
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      g.tint(hex("#d8b45a")).box("dome", Math.cos(a) * 3.0, Y.walk + 2.2 + Math.sin(a) * 3.0, 0, 0.42, 0.42, 0.3);
    }
  }
  rs.tint(hex("#d8b45a")).dome("dome", 0, Y.walk + 2.4, 0, 1.3, 16, 6, true);
  col.add({ kind: "circle", x: RB.x, z: RB.z, r: 8.5 });

  /* ---- the quad fountain (three tiers) */
  const qf = b.at(0, -176);
  qf.tint(STONE).cylinder("stone", 0, Y.paving, 0, 5.2, 5.2, 0.7, 36);
  qf.tint([255, 255, 255, 255]).cylinder("water", 0, Y.paving + 0.72, 0, 4.8, 4.8, 0.01, 36);
  qf.tint(STONE).cylinder("stone", 0, 0.7, 0, 0.7, 0.5, 1.6, 12);
  qf.cylinder("stone", 0, 2.3, 0, 2.2, 2.0, 0.35, 24);
  qf.tint([255, 255, 255, 255]).cylinder("water", 0, 2.66, 0, 1.9, 1.9, 0.01, 24);
  qf.tint(STONE).cylinder("stone", 0, 2.6, 0, 0.35, 0.25, 1.4, 10);
  qf.cylinder("stone", 0, 4.0, 0, 1.0, 0.9, 0.25, 18);
  qf.tint(hex("#d8b45a")).dome("dome", 0, 4.25, 0, 0.35, 10, 4, true);
  col.add({ kind: "circle", x: 0, z: -176, r: 5.3 });

  /* ---- a bronze statue on a plinth in front of the Senate (abstract scholar) */
  const st = b.at(0, -196);
  st.tint(STONE).box("stone", 0, 0, 0, 2.2, 2.4, 2.2, 4);
  st.tint(hex("#7a5a3a")).cylinder("dome", 0, 2.4, 0, 0.55, 0.35, 2.0, 10);
  st.dome("dome", 0, 4.6, 0, 0.32, 10, 4, true);
  st.tint(hex("#7a5a3a")).box("dome", 0.5, 3.4, 0.2, 0.9, 0.18, 0.5);
  col.add({ kind: "box", x: 0, z: -196, hx: 1.1, hz: 1.1, rot: 0 });

  /* ---- street lights */
  for (const l of streetLights) {
    const g = b.at(l.x, l.z, l.yaw);
    if (l.style === "modern") {
      g.tint(hex("#5d646a")).cylinder("metal", 0, Y.walk, 0, 0.11, 0.07, 8.2, 8);
      g.box("metal", 0, 8.1, 0.9, 0.08, 0.08, 1.9);
      g.tint(hex("#4a5056")).box("metal", 0, 7.95, 1.9, 0.34, 0.16, 0.7);
      g.tint(WARM).box("lamp", 0, 7.9, 1.9, 0.28, 0.06, 0.6, 1, ["top"]);
      const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
      lights.push({ x: l.x + 1.9 * s, y: 7.6, z: l.z + 1.9 * c, color: [1, 0.78, 0.5], range: 16 });
    } else {
      g.tint(IRON).box("metal", 0, Y.walk, 0, 0.4, 0.5, 0.4);
      g.cylinder("metal", 0, Y.walk + 0.5, 0, 0.09, 0.06, 3.4, 8);
      g.box("metal", 0, 3.9, 0, 0.5, 0.06, 0.06);
      for (const sx of [-0.25, 0.25]) {
        g.tint(WARM).cylinder("lamp", sx, 3.95, 0, 0.13, 0.17, 0.4, 8);
        g.tint(IRON).cylinder("metal", sx, 4.35, 0, 0.2, 0.0, 0.22, 8, false, false);
      }
      lights.push({ x: l.x, y: 4.1, z: l.z, color: [1, 0.82, 0.58], range: 11 });
    }
    col.add({ kind: "circle", x: l.x, z: l.z, r: 0.25 });
  }

  /* ---- power poles with crossarms, insulators and sagging wires */
  for (const run of poleRuns) {
    const tops: { x: number; z: number; yaw: number }[] = [];
    for (let i = 0; i < run.length; i++) {
      const [x, z] = run[i]!;
      const n = run[Math.min(run.length - 1, i + 1)]!, p = run[Math.max(0, i - 1)]!;
      const yaw = Math.atan2(n[0] - p[0], n[1] - p[1]);
      const g = b.at(x, z, yaw);
      g.tint(hex("#7a6a58")).cylinder("wood", 0, 0, 0, 0.16, 0.12, 9.6, 8);
      g.tint(hex("#5a4a38")).box("wood", 0, 9.0, 0, 2.4, 0.14, 0.14);
      for (const ox of [-1.0, 0, 1.0]) g.tint(hex("#e8e4dc")).cylinder("trim", ox, 9.14, 0, 0.06, 0.04, 0.2, 6);
      if (i % 3 === 1) g.tint(hex("#8a9096")).cylinder("metal", 0.35, 7.4, 0, 0.32, 0.32, 0.9, 10); // transformer
      tops.push({ x, z, yaw });
      col.add({ kind: "circle", x, z, r: 0.25 });
    }
    b.at(0, 0).tint(hex("#1e1e1e"));
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i]!, c = tops[i + 1]!;
      for (const ox of [-1.0, 0, 1.0]) {
        const ca = Math.cos(a.yaw), sa = Math.sin(a.yaw), cc = Math.cos(c.yaw), sc = Math.sin(c.yaw);
        b.wire("metal", [a.x + ox * ca, 9.34, a.z - ox * sa], [c.x + ox * cc, 9.34, c.z - ox * sc], 0.75 + rng.range(0, 0.3));
      }
    }
  }

  /* ---- benches and bins */
  for (const be of benches) {
    const g = b.at(be.x, be.z, be.yaw, surfaceHeight(be.x, be.z));
    g.tint(IRON).box("metal", -0.8, 0, 0, 0.08, 0.45, 0.5);
    g.box("metal", 0.8, 0, 0, 0.08, 0.45, 0.5);
    g.tint(hex("#b98454")).box("wood", 0, 0.42, 0, 1.9, 0.06, 0.48, 2);
    g.box("wood", 0, 0.62, -0.25, 1.9, 0.36, 0.05, 2);
    col.add({ kind: "box", x: be.x, z: be.z, hx: 1, hz: 0.3, rot: be.yaw });
    const bx = be.x + 1.4 * Math.cos(be.yaw), bz = be.z - 1.4 * Math.sin(be.yaw);
    const bin = b.at(bx, bz, 0, surfaceHeight(bx, bz));
    bin.tint(hex("#2f6b4f")).cylinder("metal", 0, 0, 0, 0.25, 0.28, 0.85, 10);
  }

  /* ---- football goals on the pitch */
  for (const sx of [-1, 1]) {
    const g = b.at(PITCH.x + sx * PITCH.hx, PITCH.z, sx * Math.PI / 2);
    g.tint(hex("#f4efe4"));
    g.box("metal", -1.8, 0, 0, 0.1, 2.1, 0.1);
    g.box("metal", 1.8, 0, 0, 0.1, 2.1, 0.1);
    g.box("metal", 0, 2.05, 0, 3.7, 0.1, 0.1);
  }

  /* ---- the lake is not walkable (a ring of circles keeps people on the shore) */
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    col.add({ kind: "circle", x: LAKE.x + Math.cos(a) * (LAKE.rx - 6), z: LAKE.z + Math.sin(a) * (LAKE.rz - 6), r: 9 });
  }
  col.add({ kind: "circle", x: LAKE.x, z: LAKE.z, r: Math.min(LAKE.rx, LAKE.rz) - 4 });
  /* ---- goals on the sports ground */
  for (const sx of [-1, 1]) {
    const g = b.at(STADIUM.x + sx * (STADIUM.straight / 2 + 8), STADIUM.z, sx * Math.PI / 2);
    g.tint(hex("#f4efe4"));
    g.box("metal", -3.6, 0, 0, 0.12, 2.44, 0.12);
    g.box("metal", 3.6, 0, 0, 0.12, 2.44, 0.12);
    g.box("metal", 0, 2.4, 0, 7.4, 0.12, 0.12);
  }

  /* ---- the suya spot: grill, smoke-blackened hood, bench */
  const sg = b.at(SUYA.x, SUYA.z);
  sg.tint(hex("#3a3a3a")).box("metal", 0, 0, 0, 2.2, 0.9, 0.8);
  sg.tint(hex("#d9622b")).box("lamp", 0, 0.9, 0, 2.0, 0.04, 0.6);
  for (let i = 0; i < 9; i++) sg.tint(hex("#7a3a20")).box("cloth", -0.9 + i * 0.22, 0.96, 0, 0.05, 0.05, 0.55);
  sg.tint(hex("#5a5048")).box("metal", 0, 2.1, -0.2, 2.4, 0.08, 1.4);
  for (const x of [-1.1, 1.1]) sg.box("metal", x, 0.9, -0.8, 0.06, 1.2, 0.06);
  lights.push({ x: SUYA.x, y: 1.3, z: SUYA.z, color: [1, 0.45, 0.15], range: 7 });
  col.add({ kind: "box", x: SUYA.x, z: SUYA.z, hx: 1.2, hz: 0.5, rot: 0 });

  /* ---- parked okadas near the gate */
  for (const o of okadaPark) okadaMesh(b.at(o.x, o.z, o.yaw, surfaceHeight(o.x, o.z)), rng.pick([hex("#c8442f"), hex("#1f1f1f"), hex("#2a6fb0"), hex("#e0a526")]));

  return lights;
}
