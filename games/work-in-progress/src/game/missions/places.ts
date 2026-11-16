/**
 * Where things are, for Missions 1-10: building doors, the hostel by the
 * player's sex (Giginya Hall for a male fresher, Kadanya Hall for a female
 * one), the market's stalls and shops (found by their sign, so moving a shop
 * in layout.ts moves the mission with it), and the world anchors cutscenes
 * use that are not in campus.ts (the air shots, the gate, the forecourt).
 */
import { type Building, buildings, CLOCK, THEATRES } from "../../world/layout.ts";
import type { A3, CamAnchor } from "../director.ts";

/** A point d metres in front of a building's front face (plus s metres to its right), at height y. */
export function frontOf(b: Building, d: number, s = 0, y = 0): A3 {
  const lx = -s, lz = b.d / 2 + d;
  const c = Math.cos(b.rot), sn = Math.sin(b.rot);
  return [b.x + lx * c + lz * sn, y, b.z - lx * sn + lz * c];
}

/** Facing (yaw) that looks out of a building's front. */
export const outYaw = (b: Building): number => b.rot;
/** Facing that looks into a building's front. */
export const inYaw = (b: Building): number => b.rot + Math.PI;

/**
 * A point in front of a shop that keeps clear of the forecourt kiosks (they
 * stand in a row in front of the shophouses): the side offset moves until the
 * point is at least `clear` metres from every kiosk.
 */
export function clearFront(b: Building, d: number, s = 0, y = 0, clear = 2.2): A3 {
  const kiosks = buildings.filter((k) => k.style === "kiosk" || k.style === "stall");
  for (const step of [0, 1.5, -1.5, 3, -3, 4.5, -4.5]) {
    const p = frontOf(b, d, s + step, y);
    if (kiosks.every((k) => Math.hypot(k.x - p[0], k.z - p[2]) >= clear)) return p;
  }
  return frontOf(b, d + 2.5, s, y);
}

export function bySign(sign: string): Building {
  const b = buildings.find((x) => x.sign === sign);
  if (!b) throw new Error(`no building signed ${sign}`);
  return b;
}

export function byStyle(style: Building["style"], near: [number, number]): Building {
  let best: Building | null = null, bd = Infinity;
  for (const b of buildings) {
    if (b.style !== style) continue;
    const d = Math.hypot(b.x - near[0], b.z - near[1]);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  if (!best) throw new Error(`no ${style}`);
  return best;
}

/* ------------------------------------------------------------ buildings the story uses */

export const B = {
  giginya: byStyle("hostel", [-112, -92]),
  kadanya: byStyle("hostel", [115, -160]),
  senate: byStyle("senate", [0, -226]),
  spot: byStyle("sahel", [-42, -84]),
  engineering: byStyle("gothic", [-52, -175]),
  hospital: byStyle("medicine", [112, -84]),
  yamma: byStyle("theatre", [THEATRES.yamma.x, THEATRES.yamma.z]),
  gabas: byStyle("theatre", [THEATRES.gabas.x, THEATRES.gabas.z]),
  barn: byStyle("barn", [62, -272]),
  needle: bySign("Alhaji Needle Tailoring"),
  kb: bySign("KB's Corner Shop"),
  photo: bySign("Ring Road Cyber & Print"),
  bookshop: bySign("Campus Books & Stationery"),
  ladi: byStyle("stall", [51, 42]),
};

/** The player's hall: Giginya (men) or Kadanya (women), one story either way (bible §0). */
export function hall(female: boolean): Building {
  return female ? B.kadanya : B.giginya;
}

/**
 * Doors between the map and the interiors: where you stand outside to go in
 * (and where you come out), facing away from the door.
 */
export function worldDoors(female: boolean): Record<string, { at: A3; yaw: number; label: string }> {
  const h = hall(female);
  return {
    hostel: { at: frontOf(h, 2.4), yaw: outYaw(h), label: `Go into ${female ? "Kadanya" : "Giginya"} Hall` },
    senate: { at: frontOf(B.senate, 2.2), yaw: outYaw(B.senate), label: "Go into the Senate" },
    sug: { at: frontOf(B.spot, 2.0), yaw: outYaw(B.spot), label: "Go into the Student Union" },
    yamma: { at: frontOf(B.yamma, 4.6), yaw: outYaw(B.yamma), label: "Go into Theatre Yamma" },
    gabas: { at: frontOf(B.gabas, 4.6), yaw: outYaw(B.gabas), label: "Go into Theatre Gabas" },
    lab: { at: frontOf(B.engineering, 3.4), yaw: outYaw(B.engineering), label: "Go into the electrical lab" },
    ae: { at: frontOf(B.hospital, 1.8), yaw: outYaw(B.hospital), label: "Go into A&E" },
  };
}

/* ------------------------------------------------------------ world anchors for the films */

export function worldAnchors(female: boolean): Record<string, A3 | CamAnchor> {
  const h = hall(female);
  const fwd = (b: Building, d: number, s = 0, y = 0) => frontOf(b, d, s, y);
  return {
    // Film A: the air.
    air_dam_east: { pos: [175, 88, -30], to: [72, 52, -118], fov: 50 },
    campus_core: [0, 8, -190],
    air_ring_road: { pos: [-170, 36, 48], to: [-52, 20, 16], fov: 50 },
    twin_theatres: [THEATRES.yamma.x, 5, (THEATRES.yamma.z + THEATRES.gabas.z) / 2],
    clock_tower_face: { pos: [3, 17.5, CLOCK.z + 28], to: [0.8, 18.4, CLOCK.z + 20], fov: 36 },
    clock_hands_606: [0, 18.6, CLOCK.z + 2.7],
    air_gate_high: { pos: [32, 26, -76], to: [15, 12, -60], fov: 50 },
    gate_road: [2, 2, -40],
    // Film B: the gate.
    gate_kerb_low: { pos: [8.2, 1.25, -31.6], to: [7.7, 1.35, -33.4], fov: 44 },
    gate_barrier: [2.5, 0, -38],
    car_spawn: [2.5, 0, -14],
    car_back_seat: { pos: [6.3, 1.55, -34.4], fov: 34 },
    guard_cam: { pos: [-1.6, 1.6, -35.2], fov: 38 },
    guard_spot: [0.4, 0, -41.0],
    mum_car_seat: [3.95, 0, -36.85],
    // Film C/D: the hall forecourt, the room, the window, the crowd at the gate.
    hall_forecourt: { pos: fwd(h, 13, -5, 2.4), fov: 48 },
    hall_door: fwd(h, 1.2),
    porter_start: fwd(h, 5.5, 2.2),
    car_forecourt: fwd(h, 7.5, -3.5),
    hostel_window: { pos: fwd(h, 0.6, 3.5, 11.2), fov: 46 },
    gate_road_far: [-2.5, 0, 8],
    gate_crane: { pos: [17, 8.5, -28], to: [12, 6.8, -33], fov: 46 },
    gate_crane_b: { pos: [-15, 5.5, -31], fov: 44 },
    crowd_freshers: [2, 1.4, -47],
    muhammad_gate: [6.2, 0, -46.8],
    // The window view in step 1 (from the room, the campus: theatres, the clock, the water).
    window_view: { pos: fwd(h, 0.5, 0, 11.4), fov: 50 },
    // M2: the senate lawn shot of the clock.
    senate_lawn: { pos: [7, 1.8, -204], fov: 30 },
    // M4: tailor, lawn.
    tailor_doorway: { pos: clearFront(B.needle, 5.6, 1.4, 1.6), fov: 40 },
    needle_spot: clearFront(B.needle, 1.0, -0.8),
    needle_customer: clearFront(B.needle, 2.3, 0.2),
    lawn_crane: { pos: [-66, 9, -172], to: [-68, 7.5, -170], fov: 48 },
    lawn_crowd: [-82, 1.2, -172],
    lawn_row_side: { pos: [-76.6, 1.55, -175.2], fov: 40 },
    lawn_row: [-80.4, 0, -172.4],
    lawn_edge: { pos: [-74.2, 1.5, -167.4], fov: 36 },
    lily_lawn: [-73.4, 0, -169.6],
    lyzzy_lawn: [-79.2, 0, -171.2],
    lawn_path: { pos: [-75, 1.6, -162], fov: 42 },
    mubarak_lawn: [-78.4, 0, -165.2],
    theatre_lawn_high: { pos: [-62, 12, -150], to: [-64, 10, -156], fov: 50 },
    // M10: the market.
    ladi_stall: fwd(B.ladi, 1.4),
    ladi_spot: fwd(B.ladi, 0.25, 0.8),
    ladi_stall_front: { pos: fwd(B.ladi, 3.6, -1.6, 1.6), fov: 40 },
    mubarak_market: fwd(B.ladi, 1.5, 1.8),
    kb_shop: clearFront(B.kb, 1.8),
    kb_spot: clearFront(B.kb, 0.5),
    photo_kiosk: clearFront(B.photo, 1.8),
    bookshop: clearFront(B.bookshop, 1.8),
    maryam_spot: clearFront(B.bookshop, 1.0, 1.2),
    // M9: the hospital window looking out at the garden bench.
    ae_window_out: { pos: [100.4, 2.0, -95.6], fov: 36 },
  };
}
