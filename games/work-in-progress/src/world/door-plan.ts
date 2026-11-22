/**
 * Every door people pass through, as data: where it stands, which way it
 * faces, how big it is, what it joins. One source for the door models
 * (door-models.ts), the door links the navigation walks (game/nav-routes.ts),
 * the player's door interactions and the tests.
 *
 *  - Building entrances on the map (the halls, the Senate, the Student Union,
 *    the twin theatres, the electrical lab, A&E): a frame, a threshold, a dark
 *    doorway and hinged leaves on the building's front, exactly where the
 *    building's solid edge is, so you walk right up to it.
 *  - Interior exits and stairs: the same door on the wall behind the spot you
 *    arrive at (the interiors are separate spaces joined by these doors).
 *  - Room doorways inside (your room, Idris's room): a frame with a leaf that
 *    stands open against the room side; the kitchen has a bare frame.
 *
 * Pure data and maths (no engine): the tests read it headless.
 */
import { buildingHeight } from "./buildings.ts";
import { INTERIORS, type InteriorPlan, toWorld } from "./interior-plan.ts";
import { type Building, buildings, THEATRES, GATE_Z } from "./layout.ts";

export interface DoorSpec {
  id: string;
  /** "world" or an interior id. */
  place: string;
  /** Centre of the doorway on the wall face (world metres). */
  x: number;
  z: number;
  /** Floor height under the doorway. */
  y: number;
  /** Facing of the door's outside (the side you approach from), radians, 0 = +z. */
  yaw: number;
  w: number;
  h: number;
  leaves: 1 | 2;
  colour: string;
  arch?: boolean;
  /** "closed" doors swing open as someone passes; "open" ones stand open against the wall; "frame" has no leaf. */
  rest: "closed" | "open" | "frame";
  /** Swing direction: +1 leaves open away from the approach side (into the building), -1 towards it. */
  swing: 1 | -1;
  /** Single leaves: the hinge side, seen from the approach side (-1 left, +1 right). */
  hinge?: 1 | -1;
  /** How far an "open" leaf stands open (degrees): 168 lies it flat against the wall. */
  openDeg?: number;
  /** A glazed vestibule from the door back to a recessed facade (metres deep), if any. */
  porch?: number;
  /** Interior this door leads to (for seamless entry). */
  roomId?: string;
  /** Where the player appears inside (defaults to the door position). */
  interiorX?: number;
  interiorZ?: number;
  interiorY?: number;
}

/** Entrance shapes per building style: where the door sits relative to the building's solid front, its size, its colour. */
export const ENTRANCE: Partial<Record<Building["style"], { off: number; w: number; h: number; leaves: 1 | 2; colour: string; arch?: boolean; porch?: number }>> = {
  hostel: { off: 1.31, w: 1.8, h: 2.5, leaves: 2, colour: "#2f5f8a" },
  senate: { off: 0, w: 2.4, h: 4.2, leaves: 2, colour: "#5a3a24", arch: true },
  sahel: { off: 0, w: 3.2, h: 4.2, leaves: 2, colour: "#6b3e22", arch: true },
  gothic: { off: 0, w: 2.2, h: 3.4, leaves: 2, colour: "#4a2e1c" },
  theatre: { off: 0.17, w: 2.6, h: 3.0, leaves: 2, colour: "#3b2a1e", porch: 1.1 },
  medicine: { off: 0.04, w: 2.2, h: 2.8, leaves: 2, colour: "#cfd8dc", porch: 2.0 },
};

/** The building each interior's front door belongs to (both halls have a hostel interior). */
const BUILDING_OF: Record<string, (female: boolean) => Building> = {
  hostel: (f) => near("hostel", f ? [115, -160] : [-112, -92]),
  senate: () => near("senate", [0, -226]),
  sug: () => near("sahel", [-42, -84]),
  yamma: () => near("theatre", [THEATRES.yamma.x, THEATRES.yamma.z]),
  gabas: () => near("theatre", [THEATRES.gabas.x, THEATRES.gabas.z]),
  lab: () => near("gothic", [-52, -175]),
  ae: () => near("medicine", [112, -84]),
};

function near(style: Building["style"], p: [number, number]): Building {
  let best: Building | null = null, bd = Infinity;
  for (const b of buildings) {
    if (b.style !== style) continue;
    const d = Math.hypot(b.x - p[0], b.z - p[1]);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best!;
}

/** A point d metres in front of a building's front face at its centre line. */
function front(b: Building, d: number): [number, number] {
  const lz = b.d / 2 + d;
  return [b.x + lz * Math.sin(b.rot), b.z + lz * Math.cos(b.rot)];
}

/** The id of a building entrance door ("sug.entrance"; the two halls are "hostel.giginya.entrance" and "hostel.kadanya.entrance"). */
export function entranceId(interior: string, female: boolean): string {
  return `${interior}${interior === "hostel" ? (female ? ".kadanya" : ".giginya") : ""}.entrance`;
}

/** The building an interior is entered from (for the given player). */
export function buildingFor(interior: string, female: boolean): Building | null {
  return BUILDING_OF[interior]?.(female) ?? null;
}

/** Where you stand outside a building's entrance (just in front of the door), and the facing out. */
export function entranceApproach(b: Building, d = 0.85): { at: [number, number]; yaw: number } {
  const e = ENTRANCE[b.style];
  return { at: front(b, (e?.off ?? 0) + d), yaw: b.rot };
}

/** The entrance door of a building on the map. */
export function entranceDoor(id: string, b: Building, ground: (x: number, z: number) => number): DoorSpec {
  const e = ENTRANCE[b.style] ?? { off: 0, w: 1.8, h: 2.6, leaves: 2 as const, colour: "#5a4030" };
  const [x, z] = front(b, e.off);
  const [ax, az] = front(b, e.off + 0.8);
  return { id, place: "world", x, z, y: ground(ax, az), yaw: b.rot, w: e.w, h: Math.min(e.h, buildingHeight(b) - 0.3), leaves: e.leaves, colour: e.colour, arch: e.arch, rest: "closed", swing: 1, porch: e.porch };
}

/** The wall point behind an interior door's arrival spot (the door is on that wall), and the wall's facing into the room. */
export function interiorDoorWall(plan: InteriorPlan, dx: number, dz: number, yaw: number): { x: number; z: number; yaw: number } {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const room = plan.rooms.find((r) => Math.abs(dx - r.x) <= r.hx + 0.01 && Math.abs(dz - r.z) <= r.hz + 0.01) ?? plan.rooms[0]!;
  // Arriving facing +x means the wall is behind, at the room's -x side (and so on).
  // On the wall's inner face (walls are 12 cm thick, centred on the room's edge).
  const t = 0.06;
  if (Math.abs(fx) >= Math.abs(fz)) return { x: room.x - Math.sign(fx) * (room.hx - t), z: dz, yaw: Math.sign(fx) > 0 ? Math.PI / 2 : -Math.PI / 2 };
  return { x: dx, z: room.z - Math.sign(fz) * (room.hz - t), yaw: Math.sign(fz) > 0 ? 0 : Math.PI };
}

const FLOOR_Y = 0.02;

/** Every door: map entrances (both halls), interior exits and stairs, room doorways. */
export function doorSpecs(ground: (x: number, z: number) => number): DoorSpec[] {
  const out: DoorSpec[] = [];
  const seen = new Set<Building>();
  for (const [id, of] of Object.entries(BUILDING_OF))
    for (const female of [false, true]) {
      const b = of(female);
      if (seen.has(b)) continue;
      seen.add(b);
      out.push(entranceDoor(entranceId(id, female), b, ground));
    }
  for (const plan of INTERIORS) {
    for (const d of plan.doors) {
      const w = interiorDoorWall(plan, d.x, d.z, d.yaw);
      const [x, z] = toWorld(plan, w.x, w.z);
      const stairs = d.to !== "world";
      out.push({ id: d.id, place: plan.id, x, z, y: FLOOR_Y, yaw: w.yaw, w: stairs ? 1.0 : 1.2, h: 2.2, leaves: 1, colour: stairs ? "#6b6f74" : "#5a3a24", rest: "closed", swing: -1 });
    }
    // Doorways between rooms: a frame, and a leaf standing open on the room side.
    plan.gaps.forEach((g, i) => {
      const [x, z] = toWorld(plan, g.x, g.z);
      // Which side is the smaller room (the door opens into it)?
      const side = (s: number) => plan.rooms.some((r) => r.name !== "corridor" && (g.along === "x" ? Math.abs(g.x - r.x) <= r.hx && Math.sign(r.z - g.z) === s : Math.abs(g.z - r.z) <= r.hz && Math.sign(r.x - g.x) === s));
      const into = side(1) ? 1 : -1;
      const yaw = g.along === "x" ? (into > 0 ? Math.PI : 0) : into > 0 ? -Math.PI / 2 : Math.PI / 2;
      const bare = g.hw > 0.7;
      const spec: DoorSpec = { id: `${plan.id}.gap${i}`, place: plan.id, x, z, y: FLOOR_Y, yaw, w: g.hw * 2, h: 2.1, leaves: 1, colour: "#7f9db3", rest: bare ? "frame" : "open", swing: 1, hinge: -1, openDeg: 168 };
      // Hang the leaf on the side where, folded flat against the wall, it touches no furniture.
      if (!bare) {
        const [ox, oz] = toWorld(plan, 0, 0);
        const clash = (d: DoorSpec) => {
          const c = openLeaf(d);
          const L = d.w, ux = Math.cos(c.ang), uz = Math.sin(c.ang);
          for (let k = -4; k <= 4; k++) {
            const px = c.x + (ux * L * k) / 9, pz = c.z + (uz * L * k) / 9;
            for (const it of plan.items) {
              if (it.soft) continue;
              const dx = px - ox - it.x, dz = pz - oz - it.z, cs = Math.cos(it.rot), sn = Math.sin(it.rot);
              if (Math.abs(dx * cs - dz * sn) < it.hx + 0.12 && Math.abs(dx * sn + dz * cs) < it.hz + 0.12) return true;
            }
          }
          return false;
        };
        if (clash(spec)) spec.hinge = 1;
      }
      out.push(spec);
    });
  }
  return out;
}

/**
 * The solid part of doors that stand open (a leaf against the room side is
 * something you can walk into). Closed exits need none (the wall is there).
 */
export function doorColliders(specs: DoorSpec[]): { kind: "box"; x: number; z: number; hx: number; hz: number; rot: number; h: number }[] {
  const out: { kind: "box"; x: number; z: number; hx: number; hz: number; rot: number; h: number }[] = [];
  for (const d of specs) {
    if (d.rest !== "open") continue;
    const p = openLeaf(d);
    // A box along the leaf (local x of the box = the leaf's direction).
    out.push({ kind: "box", x: p.x, z: p.z, hx: d.w / 2 - 0.02, hz: 0.04, rot: -p.ang, h: d.h });
  }
  // Threshold plates at closed entrances: a thin plate at the doorway's floor
  // height so the player never falls through the gap between exterior ground
  // and the interior floor at the threshold. Very thin in z so it only covers
  // the step itself and never blocks walking up to or through the door.
  for (const d of specs) {
    if (d.rest !== "closed") continue;
    out.push({ kind: "box", x: d.x, z: d.z, hx: (d.w / 2) + 0.05, hz: 0.05, rot: d.yaw, h: 0.1 });
  }
  return out;
}

/**
 * Where a leaf standing open lies: its centre and its direction (world angle
 * of the leaf's length, radians from +x towards +z). The hinge is at the
 * door's left or right edge; the leaf turns openDeg into the room.
 */
export function openLeaf(d: DoorSpec): { x: number; z: number; ang: number } {
  const side = d.hinge ?? -1;
  const sx = -side; // the leaf extends from the hinge across the doorway
  const deg = ((d.openDeg ?? 96) * Math.PI) / 180;
  const th = deg * sx * d.swing;
  // Local frame: +z towards the approach side; hinge at (side * w/2, -0.07 * swing).
  const hx = (side * d.w) / 2, hz = -0.07 * d.swing;
  const L = d.w;
  // Rotating (sx * L/2, 0) about y by th (engine convention: x' = x cos + z sin, z' = -x sin + z cos).
  const lx = hx + ((sx * L) / 2) * Math.cos(th), lz = hz - ((sx * L) / 2) * Math.sin(th);
  const dirx = sx * Math.cos(th), dirz = -sx * Math.sin(th);
  const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
  const wx = d.x + lx * c + lz * s, wz = d.z - lx * s + lz * c;
  const wdx = dirx * c + dirz * s, wdz = -dirx * s + dirz * c;
  return { x: wx, z: wz, ang: Math.atan2(wdz, wdx) };
}
