/**
 * Ground, roads and everything flat: the grass with rolling hills beyond the
 * town, asphalt with lane markings, painted kerbs, paved sidewalks, the
 * roundabout, zebra crossings, the open drain on the town side, lawns with
 * mown stripes, flower beds, plazas and the odd red-earth accent.
 */
import type { Builder, RGBA } from "../gfx/builder.ts";
import { arc, type P2 } from "../sim/path.ts";
import { fbm, makeRng } from "../sim/rng.ts";
import {
  CLOCK, FAR, GATE_Z, LAKE, MARKET_Z, PIER, PITCH, RB, STADIUM, crossings, flowerBeds, lateriteAreas, lawns, pathSurfaces, pavedAreas, plazas, roads,
} from "./layout.ts";

/**
 * Layer heights (metres). Each flat layer sits at least 1.5 cm above the one
 * below, enough for the depth buffer at the far end of the fog, so nothing
 * shimmers (z-fighting); markings also use a depth bias. A test checks the gaps.
 */
export const Y = { lawn: 0.03, laterite: 0.045, paving: 0.06, pathEdge: 0.073, path: 0.086, road: 0.1, ring: 0.115, mark: 0.13, walk: 0.24 };

/** Ground height: flat in town, gentle hills far out (horizon interest). */
export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z + 40);
  if (r < 240) return 0;
  const t = Math.min(1, (r - 240) / 120);
  return t * t * (6 + fbm(x * 0.01, z * 0.01, 3, 7) * 26);
}

const WHITE: RGBA = [255, 255, 255, 255];
const PAINT: RGBA = [236, 236, 228, 255];
const YELLOW: RGBA = [232, 184, 52, 255];

function rect(b: Builder, mat: string, x: number, z: number, hx: number, hz: number, y: number, uv: number, color: RGBA = WHITE): void {
  b.at(0, 0).tint(color).poly(mat, [[x - hx, y, z + hz], [x + hx, y, z + hz], [x + hx, y, z - hz], [x - hx, y, z - hz]],
    [[(x - hx) / uv, (z + hz) / uv], [(x + hx) / uv, (z + hz) / uv], [(x + hx) / uv, (z - hz) / uv], [(x - hx) / uv, (z - hz) / uv]], [0, 1, 0]);
}

/** Annulus (ring) between radii r0 and r1, from angle a0 to a1, flat at y. */
function ring(b: Builder, mat: string, cx: number, cz: number, r0: number, r1: number, y: number, a0 = 0, a1 = Math.PI * 2, uv = 4, color: RGBA = WHITE): void {
  const inner = arc(cx, cz, r0, a0, a1, 0.08), outer = arc(cx, cz, r1, a0, a1, 0.08);
  b.at(0, 0).tint(color);
  for (let i = 0; i < inner.length - 1; i++) {
    const p = (q: P2): [number, number, number] => [q[0], y, q[1]];
    const u = (q: P2): [number, number] => [q[0] / uv, q[1] / uv];
    b.poly(mat, [p(inner[i]!), p(outer[i]!), p(outer[i + 1]!), p(inner[i + 1]!)], [u(inner[i]!), u(outer[i]!), u(outer[i + 1]!), u(inner[i + 1]!)], [0, 1, 0]);
  }
}

/** Offset a polyline sideways (left of travel = +). */
function offsetLine(line: P2[], d: number): P2[] {
  return line.map((p, i) => {
    const a = line[Math.max(0, i - 1)]!, c = line[Math.min(line.length - 1, i + 1)]!;
    const dx = c[0] - a[0], dz = c[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / l) * d, p[1] + (dx / l) * d];
  });
}

function dashes(b: Builder, line: P2[], w: number, dash: number, gap: number, color: RGBA): void {
  const [a, c] = [line[0]!, line[line.length - 1]!];
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const dx = (c[0] - a[0]) / L, dz = (c[1] - a[1]) / L;
  b.tint(color);
  for (let s = gap / 2; s + dash < L; s += dash + gap) b.ribbon("marking", [[a[0] + dx * s, a[1] + dz * s], [a[0] + dx * (s + dash), a[1] + dz * (s + dash)]], w, Y.mark, 1);
}

/** Sidewalk: raised paver strip with a painted kerb face on the road side. */
function sidewalk(b: Builder, line: P2[], offset: number, width: number): void {
  const s = Math.sign(offset);
  const centre = offsetLine(line, offset + s * width / 2);
  b.tint([222, 214, 200, 255]).ribbon("paver", centre, width, Y.walk, 2);
  b.tint(WHITE).kerb("kerb", line, offset, 0.32, Y.walk + 0.02, 2);
}

export function buildGround(b: Builder): void {
  // Ground grid, 1000 m square, vertex coloured for patches of lush and dry grass.
  const N = 100, SIZE = 1000;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = -SIZE / 2 + (i * SIZE) / N, z0 = -SIZE / 2 + (j * SIZE) / N - 40, d = SIZE / N;
      const corners: [number, number][] = [[x0, z0 + d], [x0 + d, z0 + d], [x0 + d, z0], [x0, z0]];
      const pts = corners.map(([x, z]) => [x, groundHeight(x, z), z] as [number, number, number]);
      // One colour per quad from noise at its centre: lush green, deep green, a little straw.
      const n = fbm((x0 + d / 2) * 0.012, (z0 + d / 2) * 0.012, 4, 3);
      const m = fbm((x0 + d / 2) * 0.05, (z0 + d / 2) * 0.05, 2, 4);
      const g = Math.round(190 + (n - 0.5) * 90 + (m - 0.5) * 40);
      const r = Math.round(184 + (n - 0.5) * 100 + Math.max(0, n - 0.58) * 190);
      const bl = Math.round(160 + (n - 0.5) * 50);
      b.at(0, 0).tint([Math.min(255, r), Math.min(255, g), bl, 255]);
      b.poly("grass", pts, corners.map(([x, z]) => [x / 4, z / 4]));
    }
  }

  // Lawns with mown stripes (alternating shades, 3 m wide).
  for (const l of lawns) {
    const stripes = Math.ceil((l.hx * 2) / 3);
    for (let i = 0; i < stripes; i++) {
      const x0 = l.x - l.hx + i * 3, x1 = Math.min(l.x + l.hx, x0 + 3);
      rect(b, "grass", (x0 + x1) / 2, l.z, (x1 - x0) / 2, l.hz, Y.lawn, 4, i % 2 ? [196, 214, 170, 255] : [172, 192, 150, 255]);
    }
  }

  // Red-earth accents and the football pitch.
  for (const a of lateriteAreas) rect(b, "laterite", a.x, a.z, a.hx, a.hz, Y.laterite, 4, [200, 182, 170, 255]);
  b.tint([238, 232, 222, 255]);
  const P = PITCH;
  for (const line of [
    [[P.x - P.hx, P.z - P.hz], [P.x + P.hx, P.z - P.hz], [P.x + P.hx, P.z + P.hz], [P.x - P.hx, P.z + P.hz], [P.x - P.hx, P.z - P.hz]],
    [[P.x, P.z - P.hz], [P.x, P.z + P.hz]],
  ] as P2[][])
    b.ribbon("marking", line, 0.12, Y.paving, 1);
  b.ribbon("marking", arc(P.x, P.z, 3, 0, Math.PI * 2, 0.2), 0.12, Y.paving, 1);

  // Paved forecourts and plazas (brick pavers).
  for (const a of pavedAreas) if (a.hx > 0) rect(b, "paver", a.x, a.z, a.hx, a.hz, Y.paving, 2, [226, 216, 200, 255]);
  for (const p of plazas) rect(b, "paver", p.x, p.z, p.hx, p.hz, Y.paving, 2, [238, 230, 214, 255]);

  // Footpaths.
  // Campus footpaths: pale stone pavers with a darker brick edging; red earth only where marked.
  for (const p of pathSurfaces) {
    if (p.kind === "paving") {
      b.at(0, 0).tint([170, 120, 96, 255]).ribbon("brickpave", p.line, p.width + 0.5, Y.pathEdge, 2);
      b.tint([240, 232, 216, 255]).ribbon("paver", p.line, p.width, Y.path, 2);
    } else b.at(0, 0).tint([232, 220, 210, 255]).ribbon("laterite", p.line, p.width, Y.laterite, 2);
  }

  // The lake: water, a darker shallow rim, a dressed-stone edge. A wooden pier runs out from the west shore.
  {
    const n = 64;
    const pt = (a: number, k: number): [number, number, number] => [LAKE.x + Math.cos(a) * LAKE.rx * k, Y.paving, LAKE.z + Math.sin(a) * LAKE.rz * k];
    b.at(0, 0);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      b.tint([255, 255, 255, 255]).poly("water", [[LAKE.x, Y.paving, LAKE.z], pt(a1, 1), pt(a0, 1)], [[0, 0], [1, 0], [1, 1]], [0, 1, 0]);
      const e0 = pt(a0, 1), e1 = pt(a1, 1), o0 = pt(a0, 1.06), o1 = pt(a1, 1.06);
      b.tint([226, 216, 196, 255]).poly("stone", [[e0[0], 0.25, e0[2]], [e1[0], 0.25, e1[2]], [o1[0], 0.25, o1[2]], [o0[0], 0.25, o0[2]]], [[0, 0], [1, 0], [1, 0.3], [0, 0.3]], [0, 1, 0]);
      b.poly("stone", [[e1[0], 0.25, e1[2]], [e0[0], 0.25, e0[2]], [e0[0], Y.paving, e0[2]], [e1[0], Y.paving, e1[2]]], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]]);
    }
    const p = b.at(PIER.x, PIER.z, Math.PI / 2);
    p.tint([255, 255, 255, 255]).box("wood", 0, 0.45, PIER.len / 2 + 2, PIER.w, 0.16, PIER.len + 4, 2);
    for (let z = 1; z <= PIER.len + 4; z += 2.5) for (const x of [-PIER.w / 2 + 0.1, PIER.w / 2 - 0.1]) p.tint([110, 84, 60, 255]).box("wood", x, 0, z, 0.18, 1.6, 0.18);
    for (const x of [-PIER.w / 2 + 0.05, PIER.w / 2 - 0.05]) p.tint([150, 112, 80, 255]).box("wood", x, 1.45, PIER.len / 2 + 3, 0.08, 0.08, PIER.len + 2);
  }

  // The sports ground: grass pitch inside a red running track with white lane lines.
  {
    const S = STADIUM;
    const ring = (rad: number): P2[] => {
      const out: P2[] = [];
      for (let i = 0; i <= 24; i++) { const a = Math.PI / 2 + (i / 24) * Math.PI; out.push([S.x - S.straight / 2 + Math.cos(a) * rad, S.z - Math.sin(a) * rad]); }
      for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI; out.push([S.x + S.straight / 2 + Math.cos(a) * rad, S.z - Math.sin(a) * rad]); }
      out.push(out[0]!);
      return out;
    };
    const mid = S.r + (S.lanes * S.laneW) / 2;
    b.at(0, 0).tint([206, 96, 70, 255]).ribbon("laterite", ring(mid), S.lanes * S.laneW + 0.6, Y.paving, 2);
    for (let k = 0; k <= S.lanes; k++) b.tint([240, 236, 226, 255]).ribbon("marking", ring(S.r + k * S.laneW), 0.06, Y.mark, 1);
    // Pitch stripes inside.
    for (let i = 0; i < 10; i++) {
      const x0 = S.x - S.straight / 2 - 8 + i * ((S.straight + 16) / 10);
      rect(b, "grass", x0 + (S.straight + 16) / 20, S.z, (S.straight + 16) / 20, S.r - 6, Y.lawn, 4, i % 2 ? [196, 214, 170, 255] : [172, 192, 150, 255]);
    }
    b.tint([244, 240, 230, 255]).ribbon("marking", [[S.x - S.straight / 2 - 8, S.z - S.r + 6], [S.x + S.straight / 2 + 8, S.z - S.r + 6], [S.x + S.straight / 2 + 8, S.z + S.r - 6], [S.x - S.straight / 2 - 8, S.z + S.r - 6], [S.x - S.straight / 2 - 8, S.z - S.r + 6]], 0.12, Y.mark, 1);
    b.ribbon("marking", [[S.x, S.z - S.r + 6], [S.x, S.z + S.r - 6]], 0.12, Y.mark, 1);
  }

  // Flower beds: dark soil and bright flowers.
  const rng = makeRng(33);
  const flowers: RGBA[] = [[214, 40, 60, 255], [250, 196, 40, 255], [240, 120, 170, 255], [250, 246, 236, 255], [236, 92, 32, 255], [150, 80, 200, 255]];
  for (const f of flowerBeds) {
    b.at(f.x, f.z).tint([90, 62, 44, 255]).box("laterite", 0, 0, 0, f.hx * 2, 0.16, f.hz * 2, 2);
    b.tint([120, 200, 100, 255]).box("bush", 0, 0.16, 0, f.hx * 2 - 0.3, 0.22, f.hz * 2 - 0.3, 1);
    const count = Math.round(f.hx * f.hz * 9);
    const col = rng.pick(flowers);
    for (let i = 0; i < count; i++) {
      const x = rng.range(-f.hx + 0.2, f.hx - 0.2), z = rng.range(-f.hz + 0.2, f.hz - 0.2);
      b.tint(rng.chance(0.75) ? col : rng.pick(flowers)).box("cloth", x, 0.34, z, 0.16, 0.12, 0.16, 1, ["bottom"]);
    }
  }
}

export function buildRoads(b: Builder): void {
  b.at(0, 0);
  for (const r of roads) {
    b.tint([255, 255, 255, 255]).ribbon("asphalt", r.line, r.width, Y.road, 4);
    if (r.marks === "centre") {
      // Dashed centre line and solid edge lines.
      dashes(b, r.line, 0.14, 3, 4.5, PAINT);
      b.tint(PAINT);
      b.ribbon("marking", offsetLine(r.line, r.width / 2 - 0.45), 0.12, Y.mark, 1);
      b.ribbon("marking", offsetLine(r.line, -(r.width / 2 - 0.45)), 0.12, Y.mark, 1);
    }
  }

  // The roundabout: asphalt ring, kerbed island with grass, edge line.
  ring(b, "asphalt", RB.x, RB.z, RB.island, RB.outer, Y.ring, 0, Math.PI * 2, 4);
  ring(b, "marking", RB.x, RB.z, RB.outer - 0.6, RB.outer - 0.48, Y.mark + 0.015, 0, Math.PI * 2, 1, PAINT);
  ring(b, "kerb", RB.x, RB.z, RB.island - 0.4, RB.island, Y.walk + 0.02, 0, Math.PI * 2, 2);
  ring(b, "grass", RB.x, RB.z, 0, RB.island - 0.4, Y.walk, 0, Math.PI * 2, 4, [170, 204, 146, 255]);
  // The clock ring on campus.
  ring(b, "asphalt", CLOCK.x, CLOCK.z, CLOCK.island, CLOCK.outer, Y.ring, 0, Math.PI * 2, 4);
  ring(b, "kerb", CLOCK.x, CLOCK.z, CLOCK.island - 0.4, CLOCK.island, Y.walk + 0.02, 0, Math.PI * 2, 2);
  ring(b, "brickpave", CLOCK.x, CLOCK.z, 0, CLOCK.island - 0.4, Y.walk, 0, Math.PI * 2, 2, [240, 230, 216, 255]);

  // Sidewalks round both rings (gaps where roads join).
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    ring(b, "paver", RB.x, RB.z, RB.outer, RB.outer + 3.6, Y.walk, a + 0.36, a + Math.PI / 2 - 0.36, 2, [214, 208, 196, 255]);
    ring(b, "kerb", RB.x, RB.z, RB.outer, RB.outer + 0.32, Y.walk + 0.02, a + 0.36, a + Math.PI / 2 - 0.36, 2);
    if (k !== 3) ring(b, "paver", CLOCK.x, CLOCK.z, CLOCK.outer, CLOCK.outer + 3.6, Y.walk, a + 0.32, a + Math.PI / 2 - 0.32, 2, [214, 208, 196, 255]);
  }
  ring(b, "paver", CLOCK.x, CLOCK.z, CLOCK.outer, CLOCK.outer + 3.6, Y.walk, 1.5 * Math.PI + 0.32, 2 * Math.PI - 0.32, 2, [214, 208, 196, 255]);

  // Straight sidewalks (explicit so they stop neatly at junctions).
  const W = 3.6, E = 5;
  const walks: [P2[], number][] = [
    [[[-FAR + 20, 0], [-19.6, 0]], E], [[[-FAR + 20, 0], [-19.6, 0]], -E],
    [[[19.6, 0], [FAR - 20, 0]], E], [[[19.6, 0], [FAR - 20, 0]], -E],
    [[[0, -19.6], [0, GATE_Z]], E], [[[0, -19.6], [0, GATE_Z]], -E],
    [[[0, 19.6], [0, MARKET_Z - 8.6]], E], [[[0, 19.6], [0, MARKET_Z - 8.6]], -E],
    [[[0, MARKET_Z + 8.6], [0, FAR - 20]], E], [[[0, MARKET_Z + 8.6], [0, FAR - 20]], -E],
    [[[-170, MARKET_Z], [-8.6, MARKET_Z]], E], [[[-170, MARKET_Z], [-8.6, MARKET_Z]], -E],
    [[[8.6, MARKET_Z], [FAR - 20, MARKET_Z]], E], [[[8.6, MARKET_Z], [FAR - 20, MARKET_Z]], -E],
    [[[0, GATE_Z - 2], [0, CLOCK.z + 16.6]], 3.5], [[[0, GATE_Z - 2], [0, CLOCK.z + 16.6]], -3.5],
  ];
  for (const [line, off] of walks) sidewalk(b, line, off, W);

  // Zebra crossings.
  for (const c of crossings) {
    b.tint([246, 246, 240, 255]);
    for (let i = -c.width / 2 + 0.6; i < c.width / 2 - 0.4; i += 1.1) {
      const line: P2[] = c.alongX ? [[c.x - 1.6, c.z + i], [c.x + 1.6, c.z + i]] : [[c.x + i, c.z - 1.6], [c.x + i, c.z + 1.6]];
      b.ribbon("marking", line, 0.55, Y.mark, 1);
    }
  }
  // Give-way triangles... and a yellow box junction on Market Street.
  b.tint(YELLOW);
  for (let i = -4; i <= 4; i += 2) b.ribbon("marking", [[-4.5, MARKET_Z + i], [4.5, MARKET_Z - i]], 0.14, Y.mark, 1);

  // Open drain on the town side of the Ring Road (concrete walls, dark bed, slab covers).
  for (const [x0, x1] of [[-170, -19.6], [19.6, 170]] as const) {
    const line: P2[] = [[x0, 9.4], [x1, 9.4]];
    b.tint([70, 66, 58, 255]).ribbon("asphalt", line, 0.7, 0.035, 2);
    b.tint([196, 192, 182, 255]).ribbon("paver", [[x0, 8.95], [x1, 8.95]], 0.18, 0.22, 2);
    b.tint([196, 192, 182, 255]).ribbon("paver", [[x0, 9.85], [x1, 9.85]], 0.18, 0.22, 2);
    for (let x = x0 + 2; x < x1 - 2; x += 4.5) b.at(x, 9.4).tint([186, 182, 172, 255]).box("paver", 0, 0.12, 0, 1.6, 0.1, 1.1, 2);
    b.at(0, 0);
  }
}
