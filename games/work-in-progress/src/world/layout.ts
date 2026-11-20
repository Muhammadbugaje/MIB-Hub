/**
 * THE MAP PLAN: where every road, lane, footpath, building, tree and lamp
 * goes. Pure data (no engine), so tests can check it: no tree in a road, no
 * lane leaving the tarmac, every footpath connected.
 *
 * Axes: x = east, z = south (north is -z), metres. The Ring Road runs east to
 * west through the middle with a roundabout at (0, 0). North of it is the
 * campus (a fictional university), south of it the town strip, Gidan Kwari.
 *
 *   campus:  gate (z -44) -> palm avenue -> clock plaza (0, -128) -> the quad,
 *            with the domed Senate Hall at its head
 *   town:    shophouses, kiosks, a suya spot, a buka, the market, Market Street (z 90)
 */
import { arc, corner, type P2 } from "../sim/path.ts";
import { makeRng } from "../sim/rng.ts";

/* ------------------------------------------------------------------ roads */

export interface RoadStrip {
  /** Centre line. */
  line: P2[];
  width: number;
  /** Lane markings: "centre" dashed white line, "none" for junction boxes. */
  marks: "centre" | "none";
  /** Painted kerbs on both sides. */
  kerbs: boolean;
}

export const RING_HALF = 5;
export const RB = { x: 0, z: 0, island: 9, outer: 16.5, lane: 12.6 };
export const CLOCK = { x: 0, z: -128, island: 8, outer: 13, lane: 10.6 };
export const GATE_Z = -44;
export const MARKET_Z = 90;
export const FAR = 430;

export const roads: RoadStrip[] = [
  { line: [[-FAR, 0], [-RB.outer + 0.5, 0]], width: 10, marks: "centre", kerbs: true },
  { line: [[RB.outer - 0.5, 0], [FAR, 0]], width: 10, marks: "centre", kerbs: true },
  { line: [[0, -RB.outer + 0.5], [0, GATE_Z - 2]], width: 10, marks: "centre", kerbs: true },
  { line: [[0, GATE_Z - 2], [0, -CLOCK.outer + CLOCK.z + 26.5]], width: 7, marks: "centre", kerbs: true },
  { line: [[0, RB.outer - 0.5], [0, MARKET_Z - 5]], width: 10, marks: "centre", kerbs: true },
  { line: [[0, MARKET_Z + 5], [0, FAR]], width: 10, marks: "centre", kerbs: true },
  { line: [[-170, MARKET_Z], [-5, MARKET_Z]], width: 10, marks: "centre", kerbs: true },
  { line: [[5, MARKET_Z], [FAR, MARKET_Z]], width: 10, marks: "centre", kerbs: true },
  { line: [[-5, MARKET_Z], [5, MARKET_Z]], width: 10, marks: "none", kerbs: false },
];

/** Zebra crossings: centre, direction of the road (true = road runs along x). */
export const crossings: { x: number; z: number; alongX: boolean; width: number }[] = [
  { x: -42, z: 0, alongX: true, width: 10 },
  { x: 58, z: 0, alongX: true, width: 10 },
  { x: 0, z: 42, alongX: false, width: 10 },
  { x: 0, z: -30, alongX: false, width: 10 },
  { x: 0, z: -84, alongX: false, width: 7 },
  { x: -14, z: MARKET_Z, alongX: true, width: 10 },
  { x: 14, z: MARKET_Z, alongX: true, width: 10 },
];

/* ---------------------------------------------------------- traffic lanes */

const L = 2.5; // lane offset on 10 m roads
const C = 1.75; // lane offset on the campus avenue
const rb = (a0: number, a1: number) => arc(RB.x, RB.z, RB.lane, a0, a1);
const ck = (a0: number, a1: number) => arc(CLOCK.x, CLOCK.z, CLOCK.lane, a0, a1);
const PI = Math.PI;

/**
 * Traffic drives on the right, so roundabouts go anticlockwise on the map.
 * Each lane is an open route; vehicles re-enter at the start when done.
 */
export const lanes: { pts: P2[]; kinds: ("car" | "keke" | "okada")[] }[] = [
  // Ring Road eastbound, straight through the roundabout.
  { pts: [[-FAR, L], [-22, L], ...rb(PI + 0.35, 2 * PI - 0.35), [22, L], [FAR, L]], kinds: ["car", "okada", "keke"] },
  // Ring Road westbound.
  { pts: [[FAR, -L], [22, -L], ...rb(0.35, PI - 0.35), [-22, -L], [-FAR, -L]], kinds: ["car", "okada", "keke"] },
  // From the town (south) up to the roundabout, then east.
  { pts: [[L, FAR], [L, MARKET_Z + 8], [L, 22], ...rb(1.5 * PI + 0.35, 2 * PI - 0.35), [22, L], [FAR, L]], kinds: ["car", "okada"] },
  // From the east into town.
  { pts: [[FAR, -L], [22, -L], ...rb(0.35, 1.5 * PI - 0.35), [-L, 22], [-L, MARKET_Z - 8], ...corner([-L, MARKET_Z - 8], [-L, MARKET_Z - L], [-8, MARKET_Z - L]), [-170, MARKET_Z - L]], kinds: ["car", "keke", "okada"] },
  // Market Street eastbound.
  { pts: [[-170, MARKET_Z + L], [FAR, MARKET_Z + L]], kinds: ["car", "okada", "keke"] },
  // Keke shuttle: town -> roundabout -> campus gate -> round the clock -> back out -> west.
  {
    pts: [
      [L, FAR], [L, 22], ...rb(1.5 * PI + 0.35, 2.5 * PI - 0.35), [L, -22], [L, GATE_Z + 4], [C, GATE_Z - 6], [C, CLOCK.z + 18],
      ...ck(1.5 * PI + 0.3, 3.5 * PI - 0.3), [-C, CLOCK.z + 18], [-C, GATE_Z - 6], [-L, GATE_Z + 4], [-L, -22],
      ...rb(0.5 * PI + 0.35, PI - 0.35), [-22, -L], [-FAR, -L],
    ],
    kinds: ["keke", "okada"],
  },
];

/* -------------------------------------------------------------- buildings */

export type Style =
  | "senate" | "gothic" | "library" | "arcade" | "sahel" | "medicine" | "hostel"
  | "shophouse" | "house" | "gatehouse" | "stall" | "kiosk" | "busstop" | "deco" | "barn" | "stand" | "boathouse" | "theatre" | "pyramid";

export interface Building {
  style: Style;
  x: number;
  z: number;
  /** Rotation about y (radians); the front faces local +z. 0 = faces south, PI = north, PI/2 = east, -PI/2 = west. */
  rot: number;
  w: number;
  d: number;
  floors: number;
  /** Text for the sign slot (shop name), if any. */
  sign?: string;
  /** Index into the building colour list. */
  tone: number;
  seed: number;
}

const FACE_N = PI, FACE_S = 0, FACE_E = PI / 2, FACE_W = -PI / 2;

/** Fictional shop names (never real brands). */
export const SHOP_NAMES = [
  "Mama Ladi Provisions", "Phone Doctor", "Mama Nkechi's Kitchen", "Fresh Cut Barbers", "Ring Road Cyber & Print",
  "Sunrise Pharmacy", "Kwari Fabrics", "Bolaji Gadgets", "Alhaji Needle Tailoring", "Gidan Kwari Bakery",
  "Campus Books & Stationery", "Zobo & Kunu Spot", "Sabo Electricals", "Blessed Hands Salon", "Iya Basira Buka",
  "Golden Grill Shawarma", "Arewa Spices", "Smart Plug Repairs", "Kano Leatherworks", "KB's Corner Shop",
];

/** The Twin Theatres (Engineering), west of the quad. */
export const THEATRES = { yamma: { x: -82, z: -146 }, gabas: { x: -82, z: -196 } };

/**
 * Story places outside buildings (Missions 1-10). Each has a reserved rectangle
 * that trees, bushes and the far tree line keep out of, so nothing grows
 * through a bench, a fence or a football court.
 */
export const PLACES = {
  /** The Spot food court, in front of the Student Centre. */
  spot: { x: -21, z: -84, hx: 7, hz: 9 },
  /** Mai Shayi's tea bench under a neem tree, outside Giginya Hall. */
  maiShayi: { x: -96, z: -104, hx: 4, hz: 3.5 },
  /** The Sculpture Garden with the girl feeding fish at the pond. */
  sculpture: { x: -32, z: -113, hx: 22, hz: 7 },
  pond: { x: -24, z: -116, r: 3.4 },
  /** The fenced Engineering Garden with the coil. */
  engGarden: { x: -78, z: -226, hx: 8, hz: 6 },
  /** The basketball court between the hostels and the gate. */
  court: { x: -80, z: -57, hx: 14, hz: 7.5 },
  /** The theatre lawn between the Twin Theatres (matriculation). */
  theatreLawn: { x: -82, z: -171, hx: 10, hz: 13 },
  /** The teaching hospital garden (tap, neem, bench, lamp), beside A&E. */
  hospitalGarden: { x: 95, z: -104, hx: 4.5, hz: 4 },
  /** The farm gate fence in front of the barn, and the old kola tree behind it. */
  farm: { x: 62, z: -258, hx: 18, hz: 1.2 },
  kola: { x: 60, z: -286, hx: 4, hz: 3 },
  /** The Glass Pyramid (study space & landmark) between library and lake. */
  pyramid: { x: 86, z: -146, hx: 12, hz: 12 },
  /** Quiet garden behind the Library (reading benches, secret spot). */
  libraryGarden: { x: 78, z: -200, hx: 16, hz: 10 },
  /** Student lounge outside arcade building (hangout spot). */
  arcadeLounge: { x: 64, z: -70, hx: 12, hz: 6 },
};

/** Rectangles kept clear of trees and bushes (the places above, with a margin). */
export const reserved: { x: number; z: number; hx: number; hz: number }[] = [
  ...[PLACES.spot, PLACES.maiShayi, PLACES.sculpture, PLACES.engGarden, PLACES.court, PLACES.theatreLawn, PLACES.hospitalGarden, PLACES.farm, PLACES.kola, PLACES.pyramid, PLACES.libraryGarden, PLACES.arcadeLounge].map((r) => ({ x: r.x, z: r.z, hx: r.hx + 2.5, hz: r.hz + 2.5 })),
];

export function inReserved(x: number, z: number, margin = 0): boolean {
  return reserved.some((r) => Math.abs(x - r.x) < r.hx + margin && Math.abs(z - r.z) < r.hz + margin);
}

function buildPlan(): Building[] {
  const rng = makeRng(1406);
  const out: Building[] = [];
  let seed = 1;
  let shop = 0;
  const add = (b: Omit<Building, "seed">) => out.push({ ...b, seed: seed++ });

  // Campus.
  add({ style: "gatehouse", x: -19, z: GATE_Z - 7, rot: FACE_E, w: 8, d: 6, floors: 1, tone: 0 });
  add({ style: "arcade", x: 42, z: -84, rot: FACE_W, w: 44, d: 18, floors: 2, tone: 1, sign: "Student Centre" });
  add({ style: "sahel", x: -42, z: -84, rot: FACE_E, w: 38, d: 18, floors: 2, tone: 2, sign: "Arts & Social Sciences" });
  add({ style: "senate", x: 0, z: -226, rot: FACE_S, w: 56, d: 26, floors: 3, tone: 0, sign: "Senate Building" });
  add({ style: "gothic", x: -52, z: -175, rot: FACE_E, w: 46, d: 20, floors: 3, tone: 3, sign: "Faculty of Engineering" });
  add({ style: "library", x: 52, z: -175, rot: FACE_W, w: 46, d: 20, floors: 2, tone: 4, sign: "University Library" });
  add({ style: "medicine", x: 112, z: -84, rot: FACE_W, w: 40, d: 22, floors: 3, tone: 5, sign: "Teaching Hospital" });
  add({ style: "hostel", x: -112, z: -92, rot: FACE_E, w: 48, d: 15, floors: 4, tone: 6, sign: "Giginya Hall" });
  add({ style: "hostel", x: -112, z: -160, rot: FACE_E, w: 48, d: 15, floors: 4, tone: 7, sign: "Giginya Hall" });
  add({ style: "hostel", x: 115, z: -160, rot: FACE_W, w: 48, d: 15, floors: 4, tone: 8, sign: "Kadanya Hall" });
  add({ style: "hostel", x: 115, z: -222, rot: FACE_W, w: 48, d: 15, floors: 4, tone: 6, sign: "Kadanya Hall" });
  add({ style: "deco", x: -58, z: -272, rot: FACE_S, w: 40, d: 18, floors: 3, tone: 0, sign: "Faculty of Sciences" });
  add({ style: "barn", x: 62, z: -272, rot: FACE_S, w: 34, d: 16, floors: 2, tone: 0, sign: "Faculty of Agriculture" });
  add({ style: "stand", x: -160, z: -253, rot: FACE_S, w: 46, d: 9, floors: 1, tone: 0 });
  add({ style: "boathouse", x: 140, z: -122, rot: FACE_E, w: 9, d: 7, floors: 1, tone: 0 });
  // The Twin Theatres: identical, facing each other across the theatre lawn (their signs are swapped by tradition).
  add({ style: "theatre", x: THEATRES.yamma.x, z: THEATRES.yamma.z, rot: FACE_N, w: 22, d: 16, floors: 2, tone: 0, sign: "Theatre Yamma" });
  add({ style: "theatre", x: THEATRES.gabas.x, z: THEATRES.gabas.z, rot: FACE_S, w: 22, d: 16, floors: 2, tone: 0, sign: "Theatre Gabas" });

  // NEW: The Glass Pyramid - iconic study space and landmark between library and lake
  add({ style: "pyramid", x: 86, z: -146, rot: FACE_S, w: 24, d: 24, floors: 2, tone: 0, sign: "Glass Pyramid Study Centre" });

  // NEW: Additional campus buildings for richer environment
  add({ style: "deco", x: 0, z: -68, rot: FACE_S, w: 28, d: 14, floors: 2, tone: 9, sign: "Department of Computer Science" });
  add({ style: "sahel", x: -140, z: -210, rot: FACE_E, w: 32, d: 16, floors: 2, tone: 2, sign: "Sports Complex & Gym" });
  add({ style: "arcade", x: 140, z: -200, rot: FACE_W, w: 30, d: 14, floors: 2, tone: 1, sign: "Cafeteria & Dining Hall" });
  add({ style: "deco", x: -26, z: -128, rot: FACE_E, w: 22, d: 12, floors: 2, tone: 10, sign: "Art Gallery" });
  add({ style: "sahel", x: 26, z: -128, rot: FACE_W, w: 20, d: 12, floors: 2, tone: 2, sign: "Music Department" });

  // Bus stop on the campus side of the Ring Road.
  add({ style: "busstop", x: 46, z: -11.5, rot: FACE_S, w: 7, d: 2.4, floors: 1, tone: 0 });

  // Town strip: shophouses along the south side of the Ring Road, fronts at z = 15.
  for (const [x0, x1] of [[-168, -24], [24, 168]] as const) {
    let x = x0;
    while (x < x1 - 8) {
      const w = Math.min(rng.range(9, 14), x1 - x);
      add({ style: "shophouse", x: x + w / 2, z: 15 + 6, rot: FACE_N, w: w - 0.4, d: 12, floors: rng.chance(0.3) ? 3 : 2, tone: rng.int(0, 9), sign: SHOP_NAMES[shop++ % SHOP_NAMES.length]! });
      x += w;
    }
  }
  // Avenue south frontage (both sides).
  for (const side of [-1, 1]) {
    let z = 34;
    while (z < MARKET_Z - 18) {
      const w = rng.range(10, 13);
      add({ style: "shophouse", x: side * 21, z: z + w / 2, rot: side < 0 ? FACE_E : FACE_W, w: w - 0.4, d: 12, floors: 2, tone: rng.int(0, 9), sign: SHOP_NAMES[shop++ % SHOP_NAMES.length]! });
      z += w;
    }
  }
  // Market Street, south side: houses and shops.
  for (let x = -150; x < 150; x += rng.range(13, 18)) {
    if (Math.abs(x) < 16) continue;
    const shopFront = rng.chance(0.5);
    add({ style: shopFront ? "shophouse" : "house", x, z: MARKET_Z + 17, rot: FACE_N, w: rng.range(9, 12), d: 10, floors: shopFront ? 2 : 1, tone: rng.int(0, 9), ...(shopFront ? { sign: SHOP_NAMES[shop++ % SHOP_NAMES.length]! } : {}) });
  }
  // Residential compounds west of the avenue, north of Market Street.
  for (const [x, z] of [[-48, 50], [-90, 50], [-122, 50], [-170, 58], [-64, 74], [-134, 76]] as const) {
    add({ style: "house", x, z, rot: rng.pick([FACE_N, FACE_S]), w: rng.range(9, 11), d: 8, floors: 1, tone: rng.int(0, 9) });
  }
  // The market: rows of stalls between the shophouses and Market Street, east of the avenue.
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      if (rng.chance(0.12)) continue;
      add({ style: "stall", x: 40 + col * 11, z: 42 + row * 10, rot: row % 2 ? FACE_N : FACE_S, w: 5.5, d: 3.6, floors: 1, tone: rng.int(0, 9) });
    }
  }
  // Kiosks in the laterite forecourt in front of the shops.
  for (const x of [-150, -128, -96, -70, -47, 34, 66, 92, 118, 146]) {
    add({ style: "kiosk", x: x + rng.range(-2, 2), z: 13.95, rot: FACE_N, w: 2.6, d: 2.0, floors: 1, tone: rng.int(0, 9) });
  }
  return out;
}

export const buildings: Building[] = buildPlan();

/** The suya spot: a grill with smoke in the forecourt. */
export const SUYA = { x: -84, z: 13.9 };
/** Generators that hum at night (sound + a little light). */
export const GENERATORS: P2[] = [[-110, 13], [80, 13], [70, 64]];

/* ------------------------------------------------------------- footpaths */

const SW = 7.2; // sidewalk centre offset from a 10 m road's centre line

export const walkLines: P2[][] = [
  // Ring Road sidewalks.
  [[-200, -SW], [-18.12, -SW]], [[18.12, -SW], [200, -SW]],
  [[-200, SW], [-18.12, SW]], [[18.12, SW], [200, SW]],
  // Round the roundabout.
  arc(0, 0, 19.5, 0, 2 * PI, 0.2),
  // Avenue north to the gate, then the campus avenue.
  [[-SW, -18.1], [-SW, GATE_Z]], [[SW, -18.1], [SW, GATE_Z]],
  [[-SW, GATE_Z], [-5.4, GATE_Z - 4], [-5.4, CLOCK.z + 14.5]], [[SW, GATE_Z], [5.4, GATE_Z - 4], [5.4, CLOCK.z + 14.5]],
  // Clock plaza ring and the quad.
  arc(CLOCK.x, CLOCK.z, 15.5, 0, 2 * PI, 0.2),
  [[0, CLOCK.z - 15.5], [0, -160], [0, -205]],
  [[-27, -152], [27, -152], [27, -200], [-27, -200], [-27, -152]],
  [[-27, -152], [27, -200]], [[27, -152], [-27, -200]],
  [[-27, -176], [-41, -176]], [[27, -176], [41, -176]],
  [[-15, -205], [15, -205]], [[-15, -205], [-27, -200]], [[15, -205], [27, -200]],
  [[-5.4, -70], [-24, -84]], [[5.4, -70], [21, -84]],
  [[-5.4, -100], [-60, -122], [-100, -122], [-100, -160]], [[-60, -122], [-100, -92]],
  [[5.4, -100], [60, -122], [107, -122], [107, -160], [107, -222]], [[60, -122], [92, -84]],
  [[-15.5, CLOCK.z], [-27, -152]], [[15.5, CLOCK.z], [27, -152]],
  [[-27, -200], [-42, -212], [-42, -252], [-50, -261]], [[27, -200], [42, -212], [42, -252], [52, -262]], [[-42, -252], [42, -252]],
  [[107, -122], [128, -112], [134, -100]], [[-100, -160], [-100, -188], [-118, -188]],
  // Story paths: round the theatre lawn, to the Engineering Garden, the court and the hospital garden.
  [[-100, -171], [-93, -171], [-82, -171], [-71, -171], [-64, -171]], [[-82, -160], [-82, -171]], [[-82, -171], [-82, -182]],
  [[-100, -188], [-100, -212], [-78, -214], [-60, -214], [-42, -212]],
  [[-100, -92], [-96, -74], [-82, -66], [-60, -52], [-26, -62.5], [-12.5, -59], [-12.5, -47], [-SW, GATE_Z]],
  [[92, -84], [96, -96], [98, -104]],
  // Avenue south sidewalks and Market Street.
  [[-SW, 18.1], [-SW, MARKET_Z - SW]], [[SW, 18.1], [SW, MARKET_Z - SW]],
  [[-SW, MARKET_Z + SW], [-SW, 160]], [[SW, MARKET_Z + SW], [SW, 160]],
  [[-160, MARKET_Z - SW], [-SW, MARKET_Z - SW]], [[SW, MARKET_Z - SW], [170, MARKET_Z - SW]],
  [[-160, MARKET_Z + SW], [-SW, MARKET_Z + SW]], [[SW, MARKET_Z + SW], [170, MARKET_Z + SW]],
  // Shop forecourt.
  [[-165, 11.5], [-20, 11.5]], [[20, 11.5], [165, 11.5]],
  [[-150, SW], [-150, 11.5]], [[-100, SW], [-100, 11.5]], [[-60, SW], [-60, 11.5]], [[-25, SW], [-20, 11.5]],
  [[25, SW], [20, 11.5]], [[70, SW], [70, 11.5]], [[120, SW], [120, 11.5]], [[160, SW], [160, 11.5]],
  // Market lanes.
  [[34, 37], [116, 37]], [[34, 57], [116, 57]], [[34, 77], [116, 77]], [[34, 37], [34, 77]], [[116, 37], [116, 77]], [[78.5, 37], [78.5, 77]],
  [[34, 77], [40, MARKET_Z - SW]], [[116, 77], [110, MARKET_Z - SW]], [[34, 37], [30, 30.5], [SW, 30.5]],
  // Laterite short cuts through the residential side.
  [[-SW, 30], [-60, 36], [-120, 36], [-150, 66], [-150, MARKET_Z - SW]], [[-60, 36], [-75, 60], [-110, 64], [-120, MARKET_Z - SW]],
  // Zebra crossings.
  [[-42, -SW], [-42, SW]], [[58, -SW], [58, SW]], [[-SW, 42], [SW, 42]], [[-SW, -30], [SW, -30]], [[-5.4, -84], [5.4, -84]],
  [[-14, MARKET_Z - SW], [-14, MARKET_Z + SW]], [[14, MARKET_Z - SW], [14, MARKET_Z + SW]],
];

/** Footpath surfaces to draw (laterite or paving), as polylines with a width. */
export const pathSurfaces: { line: P2[]; width: number; kind: "laterite" | "paving" }[] = [
  { line: [[-SW, 30], [-60, 36], [-120, 36], [-150, 66], [-150, MARKET_Z - 6]], width: 2.6, kind: "paving" },
  { line: [[-60, 36], [-75, 60], [-110, 64], [-120, MARKET_Z - 6]], width: 1.8, kind: "laterite" },
  { line: [[34, 37], [30, 30.5], [9, 30.5]], width: 2.6, kind: "paving" },
  { line: [[-27, -152], [27, -152], [27, -200], [-27, -200], [-27, -152]], width: 3.2, kind: "paving" },
  { line: [[-27, -152], [27, -200]], width: 2.6, kind: "paving" },
  { line: [[27, -152], [-27, -200]], width: 2.6, kind: "paving" },
  { line: [[0, CLOCK.z - 14], [0, -205]], width: 4, kind: "paving" },
  { line: [[-27, -176], [-41, -176]], width: 3, kind: "paving" },
  { line: [[27, -176], [41, -176]], width: 3, kind: "paving" },
  { line: [[-5.4, -70], [-24, -84]], width: 2.4, kind: "paving" },
  { line: [[5.4, -70], [21, -84]], width: 2.4, kind: "paving" },
  { line: [[-5.4, -100], [-60, -122], [-100, -122], [-100, -160]], width: 2.6, kind: "paving" },
  { line: [[-60, -122], [-100, -92]], width: 2.4, kind: "paving" },
  { line: [[5.4, -100], [60, -122], [107, -122], [107, -222]], width: 2.6, kind: "paving" },
  { line: [[60, -122], [92, -84]], width: 2.4, kind: "paving" },
  { line: [[-15.5, CLOCK.z], [-27, -152]], width: 2.6, kind: "paving" },
  { line: [[15.5, CLOCK.z], [27, -152]], width: 2.6, kind: "paving" },
  { line: [[-27, -200], [-42, -212], [-42, -252], [-50, -261]], width: 2.4, kind: "paving" },
  { line: [[27, -200], [42, -212], [42, -252], [52, -262]], width: 2.4, kind: "paving" },
  { line: [[-42, -252], [42, -252]], width: 3, kind: "paving" },
  { line: [[107, -122], [128, -112], [134, -100]], width: 2.2, kind: "paving" },
  { line: [[-100, -160], [-100, -188], [-118, -188]], width: 2.2, kind: "paving" },
  { line: [[-100, -171], [-64, -171]], width: 2.4, kind: "paving" },
  { line: [[-82, -160], [-82, -182]], width: 2.4, kind: "paving" },
  { line: [[-100, -188], [-100, -212], [-78, -214], [-60, -214], [-42, -212]], width: 2.2, kind: "paving" },
  { line: [[-100, -92], [-96, -74], [-82, -66]], width: 2.2, kind: "laterite" },
  { line: [[-60, -52], [-26, -62.5], [-12.5, -59], [-12.5, -47], [-8, -44.6]], width: 2.2, kind: "laterite" },
  { line: [[92, -84], [96, -96], [98, -104]], width: 2, kind: "paving" },
  // A worn short cut across the grass (red earth accent, deliberately).
  { line: [[-42, -232], [-70, -238], [-98, -228]], width: 1.4, kind: "laterite" },
];

/** Paved plazas (polygons are rectangles: centre, half sizes). */
export const plazas = [
  { x: 0, z: -206, hx: 24, hz: 4 },
  { x: 0, z: -176, hx: 7, hz: 7 },
];

/**
 * Red laterite earth is an accent only (owner: "not everywhere"): the back of
 * the market, the football pitch and one worn short cut. Everything else is
 * tarmac, pavers or grass.
 */
export const lateriteAreas: { x: number; z: number; hx: number; hz: number; rough: number }[] = [
  { x: 75, z: 64, hx: 44, hz: 14, rough: 3 },
  { x: -100, z: 64, hx: 28, hz: 13, rough: 2 },
];

/** Paved forecourts and market floor (brick pavers). */
export const pavedAreas: { x: number; z: number; hx: number; hz: number }[] = [
  { x: -94, z: 12.2, hx: 74, hz: 3.2 },
  { x: 94, z: 12.2, hx: 74, hz: 3.2 },
  { x: 75, z: 42, hx: 44, hz: 9 },
  { x: 0, z: MARKET_Z + 10.8, hx: 165, hz: 2.2 },
  { x: 0, z: CLOCK.z, hx: 0, hz: 0 },
  // The basketball court's slab.
  { x: -80, z: -57, hx: 14, hz: 7.5 },
];

/** The campus lake (an ellipse), with a pier from the west shore. */
export const LAKE = { x: 172, z: -100, rx: 30, rz: 40 };
export const PIER = { x: 136, z: -100, len: 12, w: 2.6 };

/** The sports ground: a running track round a grass pitch, a stand on its north side. */
export const STADIUM = { x: -160, z: -215, straight: 56, r: 20, lanes: 6, laneW: 1.2 };

/** Football pitch on the laterite (goals and lines). */
export const PITCH = { x: -100, z: 64, hx: 24, hz: 11 };

/** Manicured lawns on campus (mown stripes). */
export const lawns: { x: number; z: number; hx: number; hz: number }[] = [
  { x: 0, z: -176, hx: 27, hz: 24 },
  { x: -25, z: -66, hx: 18, hz: 20 },
  { x: 25, z: -66, hx: 18, hz: 20 },
  { x: -32, z: -112, hx: 25, hz: 8 },
  { x: 32, z: -112, hx: 25, hz: 8 },
  { x: 0, z: -26, hx: 200, hz: 14 },
  { x: -82, z: -171, hx: 10, hz: 13 },
];

/** Flower beds (campus). */
export const flowerBeds: { x: number; z: number; hx: number; hz: number }[] = [
  { x: -12, z: -153.8, hx: 9, hz: 1.1 }, { x: 12, z: -153.8, hx: 9, hz: 1.1 },
  { x: -12, z: -198.2, hx: 9, hz: 1.1 }, { x: 12, z: -198.2, hx: 9, hz: 1.1 },
  { x: -9.5, z: -60, hx: 1.2, hz: 12 }, { x: 9.5, z: -60, hx: 1.2, hz: 12 },
  { x: -9.5, z: -95, hx: 1.2, hz: 12 }, { x: 9.5, z: -95, hx: 1.2, hz: 12 },
  { x: -16, z: GATE_Z - 3, hx: 3, hz: 1 }, { x: 16, z: GATE_Z - 3, hx: 3, hz: 1 },
];

/* ------------------------------------------------------------- the plants */

/** True when (x, z) is within `margin` of a road's tarmac edge (planning check). */
export function nearRoad(x: number, z: number, margin: number): boolean {
  for (const r of roads)
    for (let i = 0; i < r.line.length - 1; i++) {
      const a = r.line[i]!, b = r.line[i + 1]!;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
      if (Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < r.width / 2 + margin) return true;
    }
  const rb = Math.hypot(x - RB.x, z - RB.z), ck = Math.hypot(x - CLOCK.x, z - CLOCK.z);
  return (rb < RB.outer + margin && rb > RB.island - margin) || (ck < CLOCK.outer + margin && ck > CLOCK.island - margin);
}

export function inLake(x: number, z: number, margin: number): boolean {
  return ((x - LAKE.x) / (LAKE.rx + margin)) ** 2 + ((z - LAKE.z) / (LAKE.rz + margin)) ** 2 < 1;
}

export function inStadium(x: number, z: number, margin: number): boolean {
  const S = STADIUM, outer = S.r + S.lanes * S.laneW + margin;
  const dx = Math.max(0, Math.abs(x - S.x) - S.straight / 2);
  return Math.hypot(dx, z - S.z) < outer;
}

/** True when (x, z) is inside (or within margin of) a building's footprint. */
export function insideBuilding(x: number, z: number, margin: number): boolean {
  return buildings.some((b) => {
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const dx = x - b.x, dz = z - b.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) < b.w / 2 + margin && Math.abs(lz) < b.d / 2 + margin;
  });
}

export type TreeKind = "neem" | "mango" | "palm" | "flame" | "far";

export interface TreeSpot { kind: TreeKind; x: number; z: number; scale: number; rot: number }

function plantTrees(): TreeSpot[] {
  const rng = makeRng(77);
  const out: TreeSpot[] = [];
  const add = (kind: TreeKind, x: number, z: number, scale = rng.range(0.85, 1.2)) => {
    if (kind !== "far" && (nearRoad(x, z, 4.2) || insideBuilding(x, z, 1.2) || inLake(x, z, 3) || inStadium(x, z, 2))) return;
    if (inReserved(x, z, kind === "far" ? 6 : 1)) return;
    out.push({ kind, x, z, scale, rot: rng.range(0, 2 * PI) });
  };
  // Neem along the campus verge of the Ring Road.
  for (let x = -196; x <= 196; x += 13) if (Math.abs(x) > 26) add("neem", x + rng.range(-1.5, 1.5), -13.5 + rng.range(-1, 1));
  // A second, looser row behind it.
  for (let x = -190; x <= 190; x += 19) if (Math.abs(x) > 30) add(rng.chance(0.3) ? "mango" : "neem", x + rng.range(-3, 3), -31 + rng.range(-3, 3));
  // Royal palms on the campus avenue.
  for (let z = GATE_Z - 10; z > CLOCK.z + 18; z -= 9) {
    add("palm", -7.6, z, rng.range(0.95, 1.08));
    add("palm", 7.6, z, rng.range(0.95, 1.08));
  }
  // Flame trees around the quad, mango and neem on the lawns.
  for (const [x, z] of [[-33, -150], [33, -150], [-33, -202], [33, -202], [-33, -176], [33, -176]] as const) add("flame", x, z, rng.range(1.0, 1.15));
  for (const [x, z] of [[-30, -60], [-20, -75], [-38, -52], [28, -58], [20, -76], [37, -50], [-62, -108], [62, -108], [-80, -130], [80, -135], [-78, -195], [80, -195], [-150, -120], [-30, -240], [40, -245], [128, -70], [132, -138], [205, -60], [210, -140], [185, -150], [150, -52]] as const)
    add(rng.chance(0.5) ? "mango" : "neem", x + rng.range(-2, 2), z + rng.range(-2, 2));
  // MORE TREES: Along paths to the hostels (every 15m rule)
  for (let z = -62; z > -92; z -= 14) { add("neem", -108, z); add("neem", 111, z); }
  for (let z = -92; z > -160; z -= 14) { add(rng.chance(0.4) ? "mango" : "neem", -108, z); add(rng.chance(0.4) ? "mango" : "neem", 111, z); }
  for (let z = -160; z > -220; z -= 14) { add("neem", -108, z); add("neem", 111, z); }
  // Trees flanking the quad paths
  for (let z = -160; z > -200; z -= 16) { add("flame", -29, z, rng.range(0.95, 1.1)); add("flame", 29, z, rng.range(0.95, 1.1)); }
  // Around the new pyramid and library garden
  for (const [x, z] of [[70, -146], [102, -146], [86, -132], [86, -160], [62, -200], [94, -200], [78, -186], [78, -214]] as const) add(rng.pick(["mango", "neem", "flame"]), x, z);
  // Near the new buildings (Computer Science, Art Gallery, Music Dept)
  for (const [x, z] of [[12, -68], [-12, -68], [-18, -120], [-34, -120], [18, -120], [34, -120]] as const) add("neem", x, z);
  // More green cover: additional scattered trees on lawns
  for (let i = 0; i < 30; i++) {
    const x = rng.range(-120, 120), z = rng.range(-240, -52);
    if (Math.abs(x) < 18 || Math.abs(x - 86) < 15) continue; // avoid centre paths and pyramid
    if (!insideBuilding(x, z, 3) && !inReserved(x, z, 0)) add(rng.pick(["neem", "mango", "neem", "flame"]), x, z, rng.range(0.85, 1.15));
  }
  // Mango trees shading the kiosks and the market.
  for (const x of [-140, -112, -79, -58, 44, 80, 106, 132]) add("mango", x + rng.range(-2, 2), 13.8, rng.range(0.9, 1.1));
  for (const [x, z] of [[30, 48], [122, 50], [74, 82], [118, 70], [-44, 40], [-80, 40], [-130, 48], [-160, 40], [-55, 80], [-160, 80]] as const) add(rng.chance(0.6) ? "mango" : "neem", x, z);
  // Shade trees along the avenue south and Market Street.
  for (let z = 30; z < MARKET_Z - 10; z += 14) if (z < 36 || z > 48) {
    add("neem", -12.8, z + 4);
    add("neem", 12.8, z);
  }
  for (let x = -150; x <= 160; x += 16) if (Math.abs(x) > 20) add("neem", x + rng.range(-2, 2), MARKET_Z + 11.5);
  // Campus edges: a belt of trees around everything for depth.
  for (let i = 0; i < 140; i++) {
    const x = rng.range(-215, 215), z = rng.range(-290, -50);
    if (Math.abs(x) < 140 && z > -245) continue;
    add(rng.pick(["neem", "mango", "neem", "flame"]), x, z, rng.range(0.9, 1.3));
  }
  for (let i = 0; i < 60; i++) {
    const x = rng.range(-210, 210), z = rng.range(110, 180);
    add(rng.pick(["neem", "mango"]), x, z, rng.range(0.9, 1.3));
  }
  // The far tree line on the horizon (cheap, never close).
  for (let i = 0; i < 420; i++) {
    const a = rng.range(0, 2 * PI), r = rng.range(250, 380);
    add("far", Math.cos(a) * r, Math.sin(a) * r * 0.9 - 40, rng.range(1.2, 2.4));
  }
  // Story trees, placed by hand inside reserved places: Mai Shayi's neem and the hospital garden's neem.
  out.push({ kind: "neem", x: -91.6, z: -100.6, scale: 1.12, rot: 0.7 }, { kind: "neem", x: 92.4, z: -108.2, scale: 1.0, rot: 2.1 });
  return out;
}

export const trees: TreeSpot[] = plantTrees();

/** Bushes and hedges (small instanced shrubs). */
export const bushes: { x: number; z: number; s: number }[] = (() => {
  const rng = makeRng(9);
  const out: { x: number; z: number; s: number }[] = [];
  // Hedges along the campus fence (inside).
  for (let x = -195; x < 195; x += 1.6) if (Math.abs(x) > 16) out.push({ x, z: GATE_Z - 2.2, s: rng.range(0.8, 1.1) });
  // Clumps on lawns and verges.
  for (let i = 0; i < 160; i++) {
    const x = rng.range(-180, 180), z = rng.range(-240, -50);
    if (Math.abs(x) < 34 && z < -140) continue;
    if (Math.abs(x) < 12 || inLake(x, z, 2) || inStadium(x, z, 2) || insideBuilding(x, z, 1) || inReserved(x, z, 0.5)) continue;
    out.push({ x, z, s: rng.range(0.6, 1.3) });
  }
  for (let i = 0; i < 50; i++) out.push({ x: rng.range(-170, 170), z: rng.range(-40, -18), s: rng.range(0.7, 1.2) });
  // The hedge has a gap where the court path reaches the gate.
  return out;
})();

/* ---------------------------------------------------------- street furniture */

/** Street lights: position and the direction the arm points (towards the road). */
export const streetLights: { x: number; z: number; yaw: number; style: "modern" | "classic" }[] = (() => {
  const out: { x: number; z: number; yaw: number; style: "modern" | "classic" }[] = [];
  for (let x = -190; x <= 190; x += 26) if (Math.abs(x) > 24) out.push({ x, z: -5.9, yaw: 0, style: "modern" });
  for (let x = -177; x <= 190; x += 26) if (Math.abs(x) > 24) out.push({ x, z: 5.9, yaw: PI, style: "modern" });
  for (let z = 26; z < 300; z += 26) if (Math.abs(z - MARKET_Z) > 12) out.push({ x: 5.9, z, yaw: -PI / 2, style: "modern" });
  for (let x = -160; x <= 200; x += 28) if (Math.abs(x) > 14) out.push({ x, z: MARKET_Z + 5.9, yaw: PI, style: "modern" });
  for (let z = GATE_Z - 8; z > CLOCK.z + 16; z -= 18) out.push({ x: -4.1, z, yaw: 0, style: "classic" }, { x: 4.1, z: z - 9, yaw: 0, style: "classic" });
  for (const [x, z] of [[-27, -152], [27, -152], [-27, -200], [27, -200], [-27, -176], [27, -176], [0, -164], [0, -188], [-14, -205], [14, -205], [-60, -122], [60, -122], [-100, -140], [107, -190]] as const)
    out.push({ x: x + 1.2, z: z + 1.2, yaw: 0, style: "classic" });
  return out;
})();

/** Power poles with sagging wires (town side). Each run is a line of poles wired together. */
export const poleRuns: P2[][] = [
  Array.from({ length: 13 }, (_, i): P2 => [-180 + i * 30, 10.4]).filter((p) => Math.abs(p[0]) > 24),
  Array.from({ length: 8 }, (_, i): P2 => [10.4, 20 + i * 30]),
  Array.from({ length: 12 }, (_, i): P2 => [-160 + i * 30, MARKET_Z + 9.6]),
];

/** Parked cars (position, facing). */
export const parked: { x: number; z: number; yaw: number }[] = [
  { x: -130, z: MARKET_Z - 6.4, yaw: PI / 2 }, { x: -90, z: MARKET_Z - 6.4, yaw: PI / 2 }, { x: 60, z: MARKET_Z - 6.4, yaw: -PI / 2 },
  { x: 130, z: MARKET_Z + 6.4, yaw: PI / 2 }, { x: 150, z: MARKET_Z + 6.4, yaw: -PI / 2 },
  { x: -26, z: -58, yaw: 0 }, { x: -29, z: -58, yaw: 0 }, { x: -32, z: -58, yaw: PI },
  { x: 26, z: -96, yaw: PI }, { x: 29, z: -96, yaw: 0 },
  { x: -15, z: 26, yaw: 0 }, { x: 15, z: 60, yaw: PI },
];

/** Okada park: parked motorbikes near the campus gate. */
export const okadaPark: { x: number; z: number; yaw: number }[] = Array.from({ length: 7 }, (_, i) => ({ x: -36 + i * 1.3, z: -11.2, yaw: PI * 0.08 }));

/** Benches: position and facing. */
export const benches: { x: number; z: number; yaw: number }[] = [
  ...[-20, -8, 8, 20].flatMap((x) => [{ x, z: -150.2, yaw: 0 }, { x, z: -201.8, yaw: PI }]),
  { x: -5, z: -170, yaw: PI / 2 }, { x: 5, z: -182, yaw: -PI / 2 },
  { x: -5.6, z: CLOCK.z + 1, yaw: 0 }, { x: 5.6, z: CLOCK.z + 1, yaw: 0 },
  { x: -12.5, z: -64, yaw: PI / 2 }, { x: 12.5, z: -78, yaw: -PI / 2 },
];

/** Places a camera can show off (showcase mode tour and the photo URLs). */
export const VIEWPOINTS = {
  gate: { pos: [18, 9, -2] as const, look: [0, 7, -46] as const },
  roundabout: { pos: [-40, 26, 32] as const, look: [0, 0, 0] as const },
  street: { pos: [-121, 1.8, 6.4] as const, look: [-92, 2.6, 12.5] as const },
  market: { pos: [58, 13, 31] as const, look: [84, 1, 62] as const },
  lake: { pos: [128, 9, -150] as const, look: [175, 2, -95] as const },
  stadium: { pos: [-120, 24, -170] as const, look: [-165, 0, -225] as const },
  quad: { pos: [0, 16, -142] as const, look: [0, 8, -215] as const },
  aerial: { pos: [150, 120, 120] as const, look: [0, 0, -70] as const },
};
