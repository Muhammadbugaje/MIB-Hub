/**
 * The story places of Year 1 that are not buildings (layout.ts PLACES): the
 * Spot food court, Mai Shayi's tea bench, the Sculpture Garden and its pond,
 * the fenced Engineering Garden with the coil, the basketball court, the
 * hospital garden, the farm fence and the old kola stump, the stadium's
 * floodlights. Static geometry joins the merged town meshes; every solid
 * thing gets a collider of the same size (so nothing walks through it).
 *
 * The named spots the missions and cutscenes use (counter, suya table,
 * bench, coil plinth, court centre...) are exported as CAMPUS_ANCHORS.
 */
import type { Builder, RGBA } from "../gfx/builder.ts";
import type { SignAtlas } from "../gfx/textures.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { signBoard } from "./buildings.ts";
import { PLACES, STADIUM } from "./layout.ts";
import { surfaceHeight } from "./surface.ts";

const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const WOOD = hex("#a8754a"), DARKWOOD = hex("#6e4a2e"), METAL = hex("#6f777e"), IRON = hex("#2d3134"), STONE = hex("#cfc6b4"), WHITE = hex("#f4f1ea");
const PI = Math.PI;

export type A3 = [number, number, number];

/** Named spots on the map for missions and cutscenes (y = height of a camera or a look target). */
export const CAMPUS_ANCHORS: Record<string, A3> = {
  // The Spot.
  spot_counter: [-17.75, 0, -80.2], nkechi_spot: [-15.6, 0, -80.2], suya_table: [-19.5, 0, -89.6], suya_table_top: [-19.5, 0.84, -89.6], suya_man_spot: [-17.6, 0, -90.8],
  spot_rafters: [-12.5, 4.2, -95.5], suya_table_low: [-21.6, 0.7, -87.4], spot_exit_east: [-10.5, 0, -88], spot_bench_a: [-24.5, 0, -79.5], spot_bench_b: [-24.5, 0, -85.5],
  spot_eat: [-24.1, 0, -84.97], roomie_eat: [-24.9, 0, -84.97],
  // Mai Shayi's bench.
  mai_shayi_bench: [-96, 0, -102.1], shayi_spot: [-97.8, 0, -104.15], bench_seat_a: [-95.6, 0, -102.55], bench_seat_b: [-94.4, 0, -102.55], neem_tree_branch: [-90.4, 2.3, -98.4],
  bench_end: [-92.2, 1.4, -102.2], bench_fire: [-96.6, 0.9, -101.6], shayi_fire: [-97.8, 0, -103.2],
  // Sculpture Garden.
  sculpture_garden_pond: [-24, 0, -110.6], pond_far_bank: [-23.4, 1.75, -109.6], pond_edge: [-24, 0, -120.3], pond_path: [-30.2, 0, -110.4], statue_girl: [-24, 0, -120.3],
  hospital_lights_far: [112, 6, -84],
  // Engineering Garden.
  coil_plinth: [-78, 0, -226], garden_fence_east: [-66.5, 2.6, -228.5], garden_fence_gate: [-78, 1.6, -233.6], garden_gate_outside: [-78, 0, -234.6],
  maker_crate: [-74.6, 0, -228.38], garden_bench: [-73.0, 0, -228.6], garden_bench_low: [-75.6, 0.8, -231.2], garden_gate_post: [-80.6, 1.5, -235.4], tanko_spot: [-80.4, 0, -233.9],
  // Basketball court.
  court_centre: [-80, 0, -57], court_hoop_high: [-94, 5.2, -57], court_floor_low: [-75.4, 0.8, -60.4], court_side: [-83.5, 1.5, -51.2], court_gate: [-67, 1.6, -61.6],
  court_gate_inside: [-70.5, 1.5, -58], court_touchline: [-85, 1.4, -62.8], court_bench: [-80, 1.2, -66.2], sly_spot: [-78.6, 0, -57.4], hassan_spot: [-77.2, 0, -59.6],
  abbas_court: [-86, 0, -64.0], baby_spot: [-68.4, 0, -60.2], court_gate_out: [-64.6, 0, -61.6], jiya_bench: [-80, 0, -65.6],
  // Hospital garden and A&E.
  med_garden_bench: [95, 0, -105.8], maker_hosp: [95, 0, -105.6], ward_window_first_floor: [101.2, 5.5, -96], ae_entrance: [99.4, 0, -84], ae_window_out: [100.4, 2.4, -95.4],
  // The farm.
  farm_gate: [60, 0, -255.6], farm_gate_post: [57.2, 1.6, -255.2], farm_gate_low: [61.6, 1.0, -253.2], sule_spot: [61.2, 0, -257.0], barn_back: [60, 0, -283.2], kola_stone: [60.6, 0, -285.6],
  // Stadium (the training pitch).
  pitch_centre: [-160, 0, -215], pitch_floodlight: [-128, 12, -190], pitch_grass_low: [-155.4, 0.8, -210.8], pitch_touchline: [-160, 1.6, -199], pitch_corner: [-184, 1.6, -200],
  goalmouth: [-188.6, 0, -215], goalmouth_side: [-183, 1.5, -208.5], goalmouth_low: [-184.6, 0.55, -211.6], goalpost_near: [-189.6, 0, -211.4], water_cooler: [-166, 1.5, -200.4],
  water_spot: [-164.4, 0, -199.6], pitch_touchline_far: [-160, 1.5, -231], helen_spot: [-150, 0, -233.2], jega_spot: [-158, 0, -214], sports_gate: [-132, 0, -188.8], coach_spot: [-164, 0, -201.2],
  // Gate.
  gate_flowers: [16, 0, -48.5], lily_spot: [17.6, 0, -49.6],
};

function bench(b: Builder, len = 1.8): void {
  b.tint(WOOD);
  for (let k = 0; k < 3; k++) b.box("wood", 0, 0.42, -0.18 + k * 0.13, len, 0.04, 0.1, 1);
  b.box("wood", 0, 0.52, -0.25, len, 0.3, 0.05, 1);
  b.tint(IRON);
  for (const x of [-len / 2 + 0.12, len / 2 - 0.12]) b.box("metal", x, 0, -0.05, 0.05, 0.42, 0.4);
}

export function buildCampus(b: Builder, signs: SignAtlas, col: CollisionWorld): void {
  const y = (x: number, z: number) => surfaceHeight(x, z);
  const solid = (x: number, z: number, hx: number, hz: number, rot = 0, h = 1) => col.add({ kind: "box", x, z, hx, hz, rot, h });

  /* ---- The Spot: Mama Nkechi's counter under a canopy, the suya table and grill, bench tables. */
  {
    // Counter (faces west, towards the terrace).
    const c = b.at(-16.6, -80.2, -PI / 2, y(-16.6, -80.2));
    c.tint(hex("#e7d6b4")).box("plaster", 0, 0, 0, 3.6, 0.95, 0.9, 1);
    c.tint(DARKWOOD).box("wood", 0, 0.95, 0, 3.8, 0.05, 1.0, 1);
    for (let k = 0; k < 4; k++) c.tint(hex(["#c9542b", "#e0a526", "#2f8a4c", "#d9622b"][k]!)).cylinder("trim", -1.3 + k * 0.85, 1.0, 0.05, 0.28, 0.24, 0.16, 12);
    for (const x of [-1.85, 1.85]) for (const z of [-0.9, 0.9]) c.tint(METAL).box("metal", x, 0, z, 0.06, 2.6, 0.06);
    c.tint(hex("#d23c3c")).box("cloth", 0, 2.6, 0, 4.1, 0.06, 2.2, 1);
    signBoard(c, signs, "Mama Nkechi's Kitchen", 0, 2.66, 3.4, 0.55, 1.12);
    solid(-16.6, -80.2, 0.5, 1.95);
    // The suya table with its grill and smoke.
    const s = b.at(-19.5, -89.6, 0, y(-19.5, -89.6));
    s.tint(WOOD).box("wood", 0, 0.78, 0, 1.6, 0.06, 0.8, 1);
    for (const x of [-0.72, 0.72]) for (const z of [-0.32, 0.32]) s.tint(DARKWOOD).box("wood", x, 0, z, 0.06, 0.78, 0.06);
    s.tint(hex("#2b2b2b")).box("metal", 1.5, 0, 0, 0.7, 0.75, 0.55);
    s.tint(hex("#d9622b")).box("glow", 1.5, 0.75, 0, 0.6, 0.03, 0.45);
    for (let k = 0; k < 6; k++) s.tint(hex("#7a3a1e")).box("trim", -0.55 + k * 0.22, 0.84, 0, 0.04, 0.03, 0.5);
    solid(-19.15, -89.6, 1.2, 0.42);
    // Four bench tables in front of the terrace.
    for (const [tx, tz] of [[-24.5, -79.5], [-24.5, -85.5], [-13.5, -86], [-13.5, -92]] as const) {
      const t = b.at(tx, tz, 0, y(tx, tz));
      t.tint(hex("#c79a64")).box("wood", 0, 0.74, 0, 1.6, 0.05, 0.8, 1);
      t.tint(DARKWOOD).box("wood", 0, 0, 0, 0.1, 0.74, 0.1);
      for (const sz of [-0.75, 0.75]) t.tint(WOOD).box("wood", 0, 0.42, sz, 1.6, 0.05, 0.3, 1);
      solid(tx, tz, 0.85, 0.95);
    }
  }

  /* ---- Mai Shayi's bench: a long bench, a charcoal stove, a kettle, one bulb on a pole. */
  {
    const B0 = b.at(-95, -103, 0, y(-95, -103));
    bench(B0, 2.6);
    solid(-95, -103.1, 1.3, 0.28);
    const st = b.at(-97.8, -101.9, 0, y(-97.8, -101.9));
    st.tint(hex("#3a3a3a")).cylinder("metal", 0, 0, 0, 0.26, 0.22, 0.42, 12);
    st.tint(hex("#e0662b")).cylinder("glow", 0, 0.42, 0, 0.2, 0.2, 0.02, 10);
    st.tint(hex("#9aa0a4")).cylinder("metal", 0, 0.44, 0, 0.13, 0.11, 0.2, 10);
    st.tint(hex("#9aa0a4")).limb("metal", [0.12, 0.6, 0], [0.24, 0.66, 0], 0.02, 0.012, 5);
    col.add({ kind: "circle", x: -97.8, z: -101.9, r: 0.3, h: 0.7 });
    const pole = b.at(-99.2, -104.8, 0, y(-99.2, -104.8));
    pole.tint(DARKWOOD).cylinder("wood", 0, 0, 0, 0.06, 0.05, 3.1, 6);
    pole.tint(METAL).limb("metal", [0, 3.0, 0], [0.5, 3.0, 0.3], 0.02, 0.02, 4);
    pole.tint(WHITE).cylinder("lamp", 0.5, 2.82, 0.3, 0.05, 0.07, 0.14, 8);
    col.add({ kind: "circle", x: -99.2, z: -104.8, r: 0.1, h: 3 });
    // A low stool for Mai Shayi by the fire.
    const ms = b.at(-97.8, -104.4, 0, y(-97.8, -104.4));
    ms.tint(WOOD).cylinder("wood", 0, 0, 0, 0.2, 0.18, 0.36, 8);
  }

  /* ---- The Sculpture Garden: a stone rim pond and plinths (the stone people are posed figures, see story props). */
  {
    const P = PLACES.pond;
    const r = b.at(P.x, P.z, 0, 0);
    const n = 28;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * 2 * PI, a1 = ((k + 1) / n) * 2 * PI;
      const x0 = Math.cos(a0) * P.r, z0 = Math.sin(a0) * P.r, x1 = Math.cos(a1) * P.r, z1 = Math.sin(a1) * P.r;
      r.tint(STONE).quad("stone", [x0, 0.45, z0], [x1, 0.45, z1], [x1 * 1.1, 0.45, z1 * 1.1], [x0 * 1.1, 0.45, z0 * 1.1], 1);
      r.quad("stone", [x0 * 1.1, 0.45, z0 * 1.1], [x1 * 1.1, 0.45, z1 * 1.1], [x1 * 1.1, 0, z1 * 1.1], [x0 * 1.1, 0, z0 * 1.1], 1);
      r.tint(hex("#ffffff")).quad("water", [0, 0.28, 0], [x0, 0.28, z0], [x1, 0.28, z1], [x1, 0.28, z1], 1);
    }
    col.add({ kind: "circle", x: P.x, z: P.z, r: P.r * 1.1, h: 0.45 });
    // Plinths for the stone people.
    for (const [px, pz] of SCULPTURES) {
      b.at(px, pz, 0, y(px, pz)).tint(STONE).box("stone", 0, 0, 0, 0.9, 0.35, 0.9, 1);
      solid(px, pz, 0.45, 0.45, 0, 0.35);
    }
  }

  /* ---- The Engineering Garden: an iron fence (gate on the north side), the coil on its plinth, a stone bench, a crate. */
  {
    const G = PLACES.engGarden;
    const fence = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const f = b.at((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0) + PI / 2, 0);
      f.tint(IRON);
      for (let t = -len / 2; t <= len / 2 + 0.01; t += 0.18) f.box("metal", t, 0, 0, 0.03, 1.7, 0.03);
      f.box("metal", 0, 0.25, 0, len, 0.05, 0.05);
      f.box("metal", 0, 1.55, 0, len, 0.05, 0.05);
      for (let t = -len / 2; t <= len / 2 + 0.01; t += 0.18) f.cylinder("metal", t, 1.7, 0, 0.025, 0, 0.12, 4, false, false);
      for (let t = -len / 2; t <= len / 2 + 0.01; t += 2.4) f.tint(hex("#454b50")).box("metal", t, 0, 0, 0.1, 1.85, 0.1);
      f.tint(IRON);
      const ang = Math.atan2(x1 - x0, z1 - z0) + PI / 2;
      col.add({ kind: "box", x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: len / 2, hz: 0.08, rot: ang, h: 1.8 });
    };
    const x0 = G.x - G.hx, x1 = G.x + G.hx, z0 = G.z - G.hz, z1 = G.z + G.hz;
    fence(x0, z1, x1, z1);
    fence(x0, z0, x0, z1);
    fence(x1, z0, x1, z1);
    fence(x0, z0, G.x - 1.1, z0);
    fence(G.x + 1.1, z0, x1, z0);
    // Gate posts.
    for (const gx of [G.x - 1.2, G.x + 1.2]) {
      b.at(gx, z0, 0, 0).tint(hex("#454b50")).box("metal", 0, 0, 0, 0.18, 2.1, 0.18);
      b.at(gx, z0, 0, 0).cylinder("metal", 0, 2.1, 0, 0.12, 0, 0.25, 4, false, false);
    }
    // The coil: a stone plinth, a copper winding as tall as a man, a crown ring that glows.
    const c = b.at(G.x, G.z, 0, 0);
    c.tint(STONE).cylinder("stone", 0, 0, 0, 1.0, 0.9, 0.7, 16);
    c.tint(hex("#5a4a3a")).cylinder("metal", 0, 0.7, 0, 0.32, 0.32, 1.7, 14);
    for (let k = 0; k < 16; k++) c.tint(hex(k % 2 ? "#b87333" : "#c98a46")).cylinder("metal", 0, 0.75 + k * 0.1, 0, 0.42, 0.42, 0.06, 18, false);
    c.tint(hex("#7fd6c8")).cylinder("glow", 0, 2.42, 0, 0.62, 0.62, 0.08, 20);
    c.tint(hex("#b87333")).dome("metal", 0, 2.4, 0, 0.3, 14, 4);
    col.add({ kind: "circle", x: G.x, z: G.z, r: 1.05, h: 2.6 });
    // The stone bench (always empty) and the upturned crate beside it.
    const sb = b.at(-73.0, -228.6, 0, 0);
    sb.tint(STONE).box("stone", 0, 0.38, 0, 1.6, 0.1, 0.45, 1);
    for (const x of [-0.6, 0.6]) sb.box("stone", x, 0, 0, 0.25, 0.38, 0.4, 1);
    solid(-73.0, -228.6, 0.8, 0.25, 0, 0.5);
    const cr = b.at(-74.6, -228.6, 0.2, 0);
    cr.tint(hex("#9b7a4c")).box("wood", 0, 0, 0, 0.5, 0.42, 0.42, 0.5);
    solid(-74.6, -228.6, 0.26, 0.24, 0.2, 0.45);
    // The garden's gravel square.
    b.at(G.x, G.z, 0, 0).tint(hex("#b9ad97")).box("stone", 0, 0, 0, G.hx * 2 - 0.4, 0.02, G.hz * 2 - 0.4, 2);
  }

  /* ---- The basketball court: painted lines on the paved slab, two hoops, a bench, chalk dots under the centre circle. */
  {
    const C = PLACES.court;
    const m = b.at(C.x, C.z, 0, 0.068);
    m.tint(hex("#2f6f5a")).box("marking", 0, 0, 0, C.hx * 2 - 0.4, 0.004, C.hz * 2 - 0.4, 1);
    m.tint(WHITE);
    const line = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      b.at(C.x + (x0 + x1) / 2, C.z + (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), 0.074).tint(WHITE).box("marking", 0, 0, 0, 0.06, 0.004, len, 1);
    };
    const W = C.hx - 0.6, H = C.hz - 0.6;
    line(-W, -H, W, -H); line(-W, H, W, H); line(-W, -H, -W, H); line(W, -H, W, H); line(0, -H, 0, H);
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * 2 * PI, a1 = ((k + 1) / 24) * 2 * PI;
      line(Math.cos(a0) * 1.8, Math.sin(a0) * 1.8, Math.cos(a1) * 1.8, Math.sin(a1) * 1.8);
    }
    for (const sx of [-1, 1]) {
      const h = b.at(C.x + sx * (C.hx - 0.3), C.z, sx > 0 ? -PI / 2 : PI / 2, 0);
      h.tint(hex("#3c4247")).box("metal", 0, 0, 0, 0.16, 3.4, 0.16);
      h.tint(WHITE).box("trim", 0, 2.9, 0.9, 1.8, 1.05, 0.05);
      h.tint(hex("#e0662b")).cylinder("metal", 0, 3.05, 1.2, 0.24, 0.24, 0.02, 14, false);
      h.tint(hex("#3c4247")).box("metal", 0, 3.2, 0.45, 0.1, 0.1, 0.9);
      col.add({ kind: "circle", x: C.x + sx * (C.hx - 0.3), z: C.z, r: 0.2, h: 3.4 });
    }
    const bb = b.at(C.x, C.z - C.hz - 1.0, PI, y(C.x, C.z - C.hz - 1));
    bench(bb, 3);
    solid(C.x, C.z - C.hz - 1.0, 1.5, 0.28);
  }

  /* ---- The hospital garden: a tap, a bench under the lamp, a low wall. */
  {
    const H = PLACES.hospitalGarden;
    const bn = b.at(95, -106.3, 0, y(95, -106.3));
    bench(bn, 1.8);
    solid(95, -106.4, 0.9, 0.28);
    const lp = b.at(97.6, -106.6, 0, y(97.6, -106.6));
    lp.tint(IRON).cylinder("metal", 0, 0, 0, 0.06, 0.05, 3.2, 8);
    lp.tint(WHITE).cylinder("lamp", 0, 3.2, 0, 0.18, 0.12, 0.3, 10);
    col.add({ kind: "circle", x: 97.6, z: -106.6, r: 0.1, h: 3.3 });
    const tp = b.at(91.6, -101.4, 0, y(91.6, -101.4));
    tp.tint(METAL).cylinder("metal", 0, 0, 0, 0.04, 0.04, 0.9, 6);
    tp.limb("metal", [0, 0.88, 0], [0.18, 0.84, 0], 0.025, 0.02, 5);
    col.add({ kind: "circle", x: 91.6, z: -101.4, r: 0.08, h: 1 });
    // Low wall on the garden's open sides.
    for (const [x0, z0, x1, z1] of [[H.x - H.hx, H.z + H.hz, H.x + H.hx, H.z + H.hz], [H.x - H.hx, H.z - H.hz, H.x - H.hx, H.z + H.hz]] as const) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ang = Math.atan2(x1 - x0, z1 - z0) + PI / 2;
      b.at((x0 + x1) / 2, (z0 + z1) / 2, ang, 0).tint(hex("#e9dfc9")).box("plaster", 0, 0, 0, len, 0.55, 0.3, 2);
      col.add({ kind: "box", x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: len / 2, hz: 0.15, rot: ang, h: 0.55 });
    }
  }

  /* ---- The farm: a post-and-rail fence in front of the barn with a gate; the old kola stump behind it. */
  {
    const F = PLACES.farm;
    const rail = (xa: number, xb: number) => {
      const len = xb - xa;
      const f = b.at((xa + xb) / 2, F.z, 0, y((xa + xb) / 2, F.z));
      f.tint(hex("#8a6a48"));
      for (let x = -len / 2; x <= len / 2 + 0.01; x += 2) f.box("wood", x, 0, 0, 0.14, 1.3, 0.14);
      for (const ry of [0.45, 1.0]) f.box("wood", 0, ry, 0, len, 0.1, 0.06, 1);
      solid((xa + xb) / 2, F.z, len / 2, 0.1, 0, 1.3);
    };
    rail(F.x - F.hx, F.x - 2);
    rail(F.x + 2, F.x + F.hx);
    for (const gx of [F.x - 2, F.x + 2]) {
      b.at(gx, F.z, 0, y(gx, F.z)).tint(DARKWOOD).box("wood", 0, 0, 0, 0.22, 1.7, 0.22);
      col.add({ kind: "circle", x: gx, z: F.z, r: 0.16, h: 1.7 });
    }
    const K = PLACES.kola;
    const st = b.at(K.x - 1.6, K.z + 0.4, 0, y(K.x - 1.6, K.z + 0.4));
    st.tint(hex("#6b4a32")).cylinder("bark", 0, -0.1, 0, 0.55, 0.45, 0.5, 10);
    st.tint(hex("#c9a77a")).cylinder("wood", 0, 0.4, 0, 0.45, 0.45, 0.02, 10);
    col.add({ kind: "circle", x: K.x - 1.6, z: K.z + 0.4, r: 0.55, h: 0.5 });
  }

  /* ---- Floodlights for the training pitch (stadium), outside the running track. */
  for (const fx of [STADIUM.x - 34, STADIUM.x + 34]) {
    const fz = STADIUM.z + 30;
    const f = b.at(fx, fz, 0, y(fx, fz));
    f.tint(hex("#8a9096")).cylinder("metal", 0, 0, 0, 0.22, 0.14, 13, 8);
    f.tint(hex("#5a6066")).box("metal", 0, 13, 0.2, 2.2, 0.9, 0.3);
    for (let k = 0; k < 4; k++) f.tint(WHITE).box("lamp", -0.8 + k * 0.53, 13.15, 0.36, 0.4, 0.6, 0.05);
    col.add({ kind: "circle", x: fx, z: fz, r: 0.3, h: 14 });
  }
}

/** Where the stone people stand in the Sculpture Garden (plinth centres), clear of the path and the pond. */
export const SCULPTURES: [number, number][] = [
  [-50, -110], [-46, -111], [-42, -108.6], [-36, -118.2], [-31, -107], [-14.5, -112], [-16, -118.6], [-12.6, -106.8], [-40, -119.5], [-34, -106.6],
];
