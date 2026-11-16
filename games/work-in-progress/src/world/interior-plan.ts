/**
 * THE INTERIOR PLAN: the rooms Missions 1 to 10 need, as pure data.
 *
 * Interiors live far east of the map (x > 1500), out of sight, each in its
 * own slot. A door on the map (a building's entrance) leads to a door inside,
 * with a short fade (like every open-world game's interiors). The floor is
 * flat at y = FLOOR; surfaceHeight() returns it for any point out here.
 *
 * Everything solid is a rectangle in the room's local frame (x across, z
 * deep, metres from the room's centre): walls with door gaps, and each piece
 * of furniture. The same rectangles become the drawn boxes, the colliders
 * and the no-overlap test, so what you see is exactly what blocks you.
 *
 * Anchors are named spots (and camera positions) used by the cutscene blocks
 * in Y1.md: e.g. room_corner, kitchen_door, gabas_row_six, ae_curtain.
 */

export const INTERIOR_X0 = 2000;
export const INTERIOR_Z0 = 2000;
export const FLOOR = 0.02;
/** Rooms are this far apart (no light or shadow leaks between them). */
const SLOT = 80;

export type Furn =
  | "bed" | "desk" | "chair" | "wardrobe" | "shelf" | "bench" | "deskrow" | "counter" | "locker" | "table" | "stool" | "hotplate" | "radio"
  | "lectern" | "board" | "curtain" | "crate" | "chairs_stack" | "tt_table" | "bag" | "rope_post" | "steel_door" | "ledger_desk" | "bunk" | "plant"
  | "noticeboard" | "sink" | "cabinet" | "drawer" | "workbench" | "waiting_bench" | "bed_med" | "door_prop" | "banner" | "gown_table" | "window" | "clock" | "lamp" | "stage";

export interface Item {
  kind: Furn;
  /** Centre, local metres. */
  x: number;
  z: number;
  /** Footprint half sizes before rotation. */
  hx: number;
  hz: number;
  /** Rotation about y (radians). Front faces local +z (same convention as buildings). */
  rot: number;
  /** Height (for drawing and the camera's clearance). */
  h: number;
  /** Walk-through decor (rugs, wall pictures, ceiling things): drawn but not solid. */
  soft?: boolean;
  /** Extra data: label text, colour, etc. */
  tag?: string;
}

export interface DoorPlan {
  id: string;
  /** Local position inside the room (standing spot just inside the door). */
  x: number;
  z: number;
  /** Facing when you arrive through it (radians). */
  yaw: number;
  /** Where it leads: "world" (a map position) or another door id. */
  to: string;
  label: string;
}

export interface RoomRect { x: number; z: number; hx: number; hz: number; h: number; floor: "tile" | "wood" | "concrete" | "lino"; wall: string; name: string }

export interface InteriorPlan {
  id: string;
  name: string;
  slot: number;
  rooms: RoomRect[];
  /** Openings in shared or outer walls: [x, z, half-width, axis] where axis "x" = gap along x in a wall running along x. */
  gaps: { x: number; z: number; hw: number; along: "x" | "z" }[];
  items: Item[];
  doors: DoorPlan[];
  lights: { x: number; z: number; y: number; range: number; color: [number, number, number]; strip?: boolean }[];
  anchors: Record<string, [number, number, number]>;
}

const PI = Math.PI;
const it = (kind: Furn, x: number, z: number, hx: number, hz: number, rot = 0, h = 0.8, extra: Partial<Item> = {}): Item => ({ kind, x, z, hx, hz, rot, h, ...extra });

/* ------------------------------------------------------------------ hostel (Giginya / Kadanya, fourth floor) */

/**
 * Corridor along x (z from -1.2 to 1.2), the player's room south of it, the
 * kitchen at the west end, Idris's room at the east end, the stairs west.
 */
const hostel: InteriorPlan = {
  id: "hostel",
  name: "Hostel, fourth floor",
  slot: 0,
  rooms: [
    { name: "corridor", x: 0, z: 0, hx: 13, hz: 1.25, h: 2.9, floor: "tile", wall: "#e8e0cc" },
    { name: "room", x: 2, z: 3.2, hx: 2.2, hz: 1.95, h: 2.9, floor: "tile", wall: "#d7e3e8" },
    { name: "kitchen", x: -10, z: -3.4, hx: 3, hz: 2.15, h: 2.9, floor: "concrete", wall: "#e9dcc2" },
    { name: "idris", x: 10.5, z: 3.2, hx: 2, hz: 1.95, h: 2.9, floor: "tile", wall: "#dfe0d0" },
  ],
  gaps: [
    { x: 2, z: 1.25, hw: 0.5, along: "x" }, // room door
    { x: -10, z: -1.25, hw: 0.85, along: "x" }, // kitchen doorway (no door)
    { x: 10.5, z: 1.25, hw: 0.5, along: "x" }, // Idris's door
  ],
  items: [
    // The room: two beds along the side walls, a desk under the window, a wardrobe by the door.
    it("bed", 0.35, 3.6, 0.48, 1.0, 0, 0.5, { tag: "#2f5f8a" }),
    it("bed", 3.65, 3.6, 0.48, 1.0, 0, 0.5, { tag: "#8a3a3a" }),
    it("desk", 2, 4.78, 0.7, 0.3, PI, 0.76),
    it("chair", 2, 4.2, 0.22, 0.22, 0, 0.9),
    it("wardrobe", 3.66, 1.75, 0.3, 0.45, -PI / 2, 2.0),
    it("bag", 0.95, 2.05, 0.32, 0.22, 0.3, 0.45),
    it("window", 2, 5.12, 0.9, 0.05, PI, 1.3, { soft: true }),
    it("lamp", 2, 3.2, 0.2, 0.2, 0, 0.1, { soft: true }),
    // Corridor doors (drawn on the walls, not solid), a notice board.
    ...[-7, -3, 6, 9.5].map((x) => it("door_prop", x, 1.2, 0.45, 0.04, PI, 2.05, { soft: true })),
    ...[-7, -3, 2, 6].map((x) => it("door_prop", x, -1.2, 0.45, 0.04, 0, 2.05, { soft: true })),
    it("door_prop", 12.95, 0, 0.45, 0.04, -PI / 2, 2.05, { soft: true, tag: "far" }),
    it("noticeboard", -5, -1.2, 0.7, 0.04, 0, 1.6, { soft: true }),
    ...[-8, -2, 4, 10].map((x) => it("lamp", x, 0, 0.3, 0.06, 0, 0.1, { soft: true, tag: "strip" })),
    // Kitchen: counter with hotplates on the far wall, shelf with the radio, stools, a table.
    it("counter", -10, -5.15, 2.6, 0.32, 0, 0.92),
    it("hotplate", -11.2, -5.15, 0.25, 0.2, 0, 0.12, { soft: true }),
    it("hotplate", -9.6, -5.15, 0.25, 0.2, 0, 0.12, { soft: true }),
    it("shelf", -12.7, -3.6, 0.8, 0.22, PI / 2, 1.8),
    it("radio", -12.6, -3.6, 0.14, 0.08, PI / 2, 0.16, { soft: true }),
    it("table", -9.6, -3.3, 0.6, 0.45, 0, 0.75),
    it("stool", -10.7, -2.5, 0.18, 0.18, 0, 0.6),
    it("stool", -8.5, -2.5, 0.18, 0.18, 0, 0.6),
    it("sink", -7.5, -4.2, 0.3, 0.4, -PI / 2, 0.9),
    // Idris's room: one bed, a desk, a book.
    it("bed", 9.05, 3.6, 0.48, 1.0, 0, 0.5, { tag: "#4b5d3a" }),
    it("desk", 11.6, 4.78, 0.6, 0.3, PI, 0.76),
  ],
  doors: [
    { id: "hostel.stairs", x: -12.3, z: 0, yaw: PI / 2, to: "world", label: "Stairs (go out)" },
  ],
  lights: [
    { x: 2, z: 3.2, y: 2.6, range: 6, color: [1, 0.92, 0.78] },
    { x: -10, z: -3.4, y: 2.6, range: 7, color: [1, 0.95, 0.85], strip: true },
    { x: -6, z: 0, y: 2.6, range: 8, color: [0.95, 0.98, 1], strip: true },
    { x: 6, z: 0, y: 2.6, range: 8, color: [0.95, 0.98, 1], strip: true },
  ],
  anchors: {
    room_centre: [2, 1.55, 3.0], room_corner: [3.6, 1.8, 2.0], room_door: [2, 0, 1.75], hostel_bed: [0.35, 0.5, 3.6], hostel_bed_stand: [0.95, 0, 3.4],
    roomie_bed: [3.65, 0.5, 3.6], room_window: [1.45, 0, 3.9], room_table: [2.6, 1.3, 4.3], corridor_far_end: [12.4, 1.6, 0], corridor_mid: [5, 1.6, 0.3],
    corridor_west: [-11.8, 1.6, 0], door_floor: [2.4, 0.25, 0.7], room_door_gap: [2, 0.02, 1.05], corridor_lights: [0, 2.6, 0],
    kitchen_door: [-10, 1.6, -1.0], kitchen_counter: [-10, 0, -4.4], kitchen_high: [-8, 2.6, -1.6], kitchen_shelf: [-12, 1.4, -2.6],
    kitchen_circle: [-9.5, 0, -2.25], candle_circle: [-9.6, 0.8, -3.3], idris_door: [10.5, 0, 0.6], idris_door_light: [10.5, 0.05, 1.2],
    corridor_empty: [12.4, 1.2, 0], hall_forecourt: [0, 0, 0], porter_stairs: [-12, 0, 0],
  },
};

/* ------------------------------------------------------------------ Senate: the registration hall and the basement */

const senate: InteriorPlan = {
  id: "senate",
  name: "Senate Hall",
  slot: 1,
  rooms: [
    { name: "hall", x: 0, z: 0, hx: 11, hz: 7, h: 5.2, floor: "tile", wall: "#efe6d2" },
    { name: "basement", x: 0, z: 14, hx: 8, hz: 3, h: 3, floor: "concrete", wall: "#c9c4b6" },
  ],
  gaps: [],
  items: [
    // Three windows along the north wall: Registry, Bursary, Bank.
    it("counter", -6.5, -5.6, 2.6, 0.45, 0, 1.1, { tag: "Registry" }),
    it("counter", 0, -5.6, 2.6, 0.45, 0, 1.1, { tag: "Bursary" }),
    it("counter", 6.5, -5.6, 2.6, 0.45, 0, 1.1, { tag: "Bank" }),
    // Queue rope posts (two lanes) and waiting benches.
    ...[-3, -1, 1].flatMap((z) => [it("rope_post", -4.6, z, 0.12, 0.12, 0, 0.95), it("rope_post", -3.4, z, 0.12, 0.12, 0, 0.95)]),
    it("waiting_bench", -9.6, 1.5, 1.6, 0.3, PI / 2, 0.45),
    it("waiting_bench", 9.6, 1.5, 1.6, 0.3, -PI / 2, 0.45),
    it("waiting_bench", 4, 3.4, 1.6, 0.3, PI, 0.45),
    it("plant", -10.4, 6.3, 0.35, 0.35, 0, 1.4),
    it("plant", 10.4, 6.3, 0.35, 0.35, 0, 1.4),
    it("clock", 0, -6.95, 0.5, 0.05, 0, 0.5, { soft: true, tag: "606" }),
    it("noticeboard", 8.4, 6.95, 1.2, 0.04, PI, 1.6, { soft: true, tag: "fees" }),
    ...[-6, 0, 6].map((x) => it("lamp", x, -2, 0.5, 0.08, 0, 0.1, { soft: true, tag: "strip" })),
    // The basement: a long corridor, Door 7 on the north wall, Malam Garba's desk at the end.
    it("steel_door", -1.5, 11.05, 0.6, 0.05, 0, 2.1, { soft: true, tag: "7" }),
    it("ledger_desk", 5.6, 14.6, 0.9, 0.45, -PI / 2, 0.78),
    it("chair", 6.6, 14.6, 0.22, 0.22, -PI / 2, 0.9),
    it("cabinet", 7.45, 12.0, 0.3, 0.45, -PI / 2, 1.8),
    it("lamp", 0, 14, 0.4, 0.08, 0, 0.1, { soft: true, tag: "strip" }),
  ],
  doors: [
    { id: "senate.front", x: 0, z: 6.2, yaw: PI, to: "world", label: "Go out" },
    { id: "senate.down", x: -10.2, z: -5.6, yaw: PI / 2, to: "senate.up", label: "Stairs down" },
    { id: "senate.up", x: -7.2, z: 14.2, yaw: PI / 2, to: "senate.down", label: "Stairs up" },
  ],
  lights: [
    { x: -6, z: -2, y: 4.8, range: 10, color: [1, 0.96, 0.88], strip: true },
    { x: 6, z: -2, y: 4.8, range: 10, color: [1, 0.96, 0.88], strip: true },
    { x: 0, z: 3, y: 4.8, range: 10, color: [1, 0.94, 0.85] },
    { x: 0, z: 14, y: 2.7, range: 9, color: [0.9, 0.95, 1], strip: true },
  ],
  anchors: {
    registry_window: [-6.5, 1.55, -4.6], bursary_window: [0, 1.55, -4.6], bank_window: [6.5, 1.55, -4.6],
    clerk_spot: [-6.5, 0, -6.5], clement_spot: [0, 0, -6.5], bank_spot: [6.5, 0, -6.5],
    queue_end: [-4, 0, 2.6], queue_front: [-4, 1.6, -4.4], queue_side: [-1.6, 1.5, 0.5], bursary_queue: [-0.6, 0, -2.6],
    queue_behind_muhammad: [0.6, 1.5, -1.0], muhammad_mark: [0.5, 1.5, -2.0],
    basement_corridor: [-6.4, 1.6, 13.4], door7: [-1.5, 1.1, 11.1], garba_desk_side: [3.4, 1.4, 13.4], garba_desk_low: [4.6, 1.0, 15.6],
    garba_spot: [6.38, 0, 14.6], senate_basement_stair: [-6.6, 0, 14.2], basement_player: [4.6, 0, 14.6],
  },
};

/* ------------------------------------------------------------------ the Student Union: hall and basement */

const sug: InteriorPlan = {
  id: "sug",
  name: "Student Union",
  slot: 2,
  rooms: [
    { name: "hall", x: 0, z: 0, hx: 8, hz: 5, h: 4.2, floor: "wood", wall: "#e6d6b8" },
    { name: "basement", x: 0, z: 12, hx: 6.5, hz: 4, h: 2.8, floor: "concrete", wall: "#b8b4a8" },
  ],
  gaps: [],
  items: [
    it("gown_table", 0, -2.2, 1.6, 0.5, 0, 0.78),
    it("banner", 0, -4.95, 3, 0.04, 0, 1.2, { soft: true, tag: "SUG" }),
    it("table", -5, 1.5, 0.8, 0.5, 0, 0.75),
    it("table", 5, 1.5, 0.8, 0.5, 0, 0.75),
    it("chairs_stack", 7.2, -4.2, 0.3, 0.3, 0, 1.4),
    it("noticeboard", -7.95, 0, 1, 0.04, PI / 2, 1.6, { soft: true }),
    // The basement: the locker row (THE PLUG is the fourth), a broken table-tennis table, stacked chairs, old banners.
    ...[-3.6, -2.8, -2.0, -1.2, -0.4, 0.4].map((x, i) => it("locker", x, 15.64, 0.38, 0.28, PI, 1.85, { tag: i === 3 ? "plug" : "" })),
    it("tt_table", 3.2, 11.6, 1.2, 0.7, 0.2, 0.76),
    it("chairs_stack", -5.4, 9.2, 0.35, 0.35, 0, 1.6),
    it("chairs_stack", -5.4, 10.2, 0.35, 0.35, 0.3, 1.3),
    it("crate", 5.4, 15.2, 0.35, 0.3, 0, 0.5),
    it("banner", 5.0, 8.05, 1.2, 0.04, PI, 1, { soft: true, tag: "old" }),
    it("lamp", 0, 12, 0.3, 0.08, 0, 0.1, { soft: true, tag: "bulb" }),
  ],
  doors: [
    { id: "sug.front", x: 0, z: 4.2, yaw: PI, to: "world", label: "Go out" },
    { id: "sug.down", x: -7.2, z: 3.8, yaw: PI / 2, to: "sug.up", label: "Stairs to the basement" },
    { id: "sug.up", x: -5.6, z: 14.8, yaw: PI / 2, to: "sug.down", label: "Stairs up" },
  ],
  lights: [
    { x: 0, z: 0, y: 3.8, range: 10, color: [1, 0.93, 0.8] },
    { x: 0, z: 12, y: 2.5, range: 8, color: [1, 0.86, 0.6] },
  ],
  anchors: {
    sug_hall_door: [0, 1.7, 4.4], sug_hall_table: [0, 0, -1.2], mubarak_hall: [0, 0, -3.2],
    basement_stair: [-5.2, 1.6, 14.2], locker_row: [-1.2, 0, 14.4], locker_side: [1.6, 1.4, 13.4], basement_centre: [0, 0, 12.4],
    customer_spot: [0.4, 0, 13.0], porter_stair: [-5.4, 0, 14.6], crate_drop: [4.6, 0, 14.6], chairs_hide: [-4.6, 0, 9.7],
  },
};

/* ------------------------------------------------------------------ the Twin Theatres (identical, by tradition) */

function theatre(id: string, name: string, slot: number, board: string): InteriorPlan {
  const rows: Item[] = [];
  for (let r = 0; r < 6; r++) {
    const z = -1.6 + r * 1.35;
    rows.push(it("deskrow", -3.4, z, 2.7, 0.22, PI, 0.78), it("deskrow", 3.4, z, 2.7, 0.22, PI, 0.78));
  }
  return {
    id, name, slot,
    rooms: [{ name: "hall", x: 0, z: 0, hx: 9, hz: 7, h: 6, floor: "wood", wall: "#e3dccb" }],
    gaps: [],
    items: [
      it("stage", 0, -5.62, 8.9, 1.3, 0, 0.35, { soft: true }),
      it("board", 0, -6.95, 4, 0.05, 0, 2.2, { soft: true, tag: board }),
      it("lectern", -3.6, -5.6, 0.35, 0.3, 0, 1.15),
      it("clock", 6.5, -6.95, 0.45, 0.05, 0, 0.45, { soft: true, tag: "time" }),
      ...rows,
      ...[-4, 4].map((x) => it("lamp", x, 0, 0.6, 0.08, 0, 0.1, { soft: true, tag: "strip" })),
    ],
    doors: [{ id: `${id}.front`, x: 7.8, z: 6.0, yaw: PI, to: "world", label: "Go out" }],
    lights: [
      { x: -4, z: 0, y: 5.6, range: 12, color: [1, 0.97, 0.9], strip: true },
      { x: 4, z: 0, y: 5.6, range: 12, color: [1, 0.97, 0.9], strip: true },
      { x: 0, z: -5, y: 5.6, range: 9, color: [1, 0.95, 0.85] },
    ],
    anchors: {
      stage_spot: [0, 0.35, -5.4], lectern_spot: [-3.6, 0.35, -6.1], aisle: [0, 0, 2], aisle_door: [7.8, 0, 5.4],
      // Rows are numbered from the front: row 1 at z -1.6 ... row 6 at z 5.15. Seats sit behind each desk row (+z).
      row3_seat: [2.2, 0, 1.33], row6_seat: [1.4, 0, 5.38], row6_seat_b: [2.2, 0, 5.38], row3_seat_b: [3.0, 0, 1.33], row1_seat: [-2.4, 0, -1.37],
      stage_cam: [1.5, 2.1, -4.4], aisle_cam: [6.6, 1.8, 3.8], row_six_cam: [3.6, 1.35, 4.4], row_three_cam: [1.0, 1.3, 2.4], hall_high: [6.8, 4.8, 6.2],
    },
  };
}

const yamma = theatre("yamma", "Theatre Yamma", 3, "LAW OF TORT · Week 3");
const gabas = theatre("gabas", "Theatre Gabas", 4, "EEE 101 · Circuits");

/* ------------------------------------------------------------------ the electrical lab */

const lab: InteriorPlan = {
  id: "lab",
  name: "Electrical lab",
  slot: 5,
  rooms: [{ name: "lab", x: 0, z: 0, hx: 6.5, hz: 4.5, h: 3.4, floor: "lino", wall: "#dfe8e4" }],
  gaps: [],
  items: [
    it("workbench", -3, -1.2, 2, 0.5, 0, 0.9, { tag: "scopes" }),
    it("workbench", 3, -1.2, 2, 0.5, 0, 0.9, { tag: "logbook" }),
    it("workbench", -3, 2, 2, 0.5, 0, 0.9, { tag: "parts" }),
    it("drawer", 5.9, 1.6, 0.35, 0.5, -PI / 2, 1.05),
    it("cabinet", -6.1, -2.8, 0.6, 0.3, PI / 2, 1.9),
    it("shelf", 0, -4.2, 1.6, 0.22, 0, 1.9),
    it("noticeboard", 3.5, -4.45, 1.0, 0.04, 0, 1.6, { soft: true }),
    it("lamp", 0, 0, 0.6, 0.08, 0, 0.1, { soft: true, tag: "strip" }),
  ],
  doors: [{ id: "lab.front", x: 0, z: 3.8, yaw: PI, to: "world", label: "Go out" }],
  lights: [{ x: 0, z: 0, y: 3.2, range: 10, color: [0.95, 1, 1], strip: true }],
  anchors: {
    lab_bench: [3, 0.92, -1.2], lab_bench_end: [5.2, 1.4, -2.6], lab_bench_over: [3, 2.3, -0.4], lab_bench_low: [1.4, 1.0, 0.2],
    abbas_spot: [-3, 0, 2.85], wednesday_spot: [-3.4, 0, -0.35], logbook_stand: [3, 0, -0.4], fuse_drawer: [4.85, 0, 1.6], okonkwo_lab: [1.6, 0, -0.2],
  },
};

/* ------------------------------------------------------------------ A&E at the teaching hospital */

const ae: InteriorPlan = {
  id: "ae",
  name: "Accident and Emergency",
  slot: 6,
  rooms: [{ name: "ae", x: 0, z: 0, hx: 7, hz: 4.5, h: 3.2, floor: "lino", wall: "#e4ecec" }],
  gaps: [],
  items: [
    it("counter", -4.6, -3.2, 1.6, 0.4, 0, 1.05, { tag: "Triage" }),
    it("waiting_bench", -6.5, 1.2, 1.5, 0.3, PI / 2, 0.45),
    it("bed_med", 2, -2.7, 0.5, 1.05, 0, 0.62),
    it("bed_med", 5, -2.7, 0.5, 1.05, 0, 0.62),
    it("curtain", 3.5, -2.7, 0.03, 1.2, 0, 2.0, { soft: true }),
    it("curtain", 0.6, -1.9, 0.03, 0.9, 0, 2.0, { soft: true }),
    it("chair", 2.9, -1.4, 0.22, 0.22, PI, 0.9),
    it("cabinet", 6.6, 0.8, 0.5, 0.3, -PI / 2, 1.6),
    it("window", 6.95, -0.9, 0.8, 0.04, -PI / 2, 1.2, { soft: true }),
    it("lamp", 0, 0, 0.6, 0.08, 0, 0.1, { soft: true, tag: "strip" }),
  ],
  doors: [{ id: "ae.front", x: -1.5, z: 3.8, yaw: PI, to: "world", label: "Go out" }],
  lights: [{ x: 0, z: -1, y: 3.0, range: 10, color: [0.92, 1, 1], strip: true }],
  anchors: {
    ae_desk: [-3.0, 1.5, -1.6], ae_curtain: [0.4, 1.55, -0.2], ae_bay_bed: [2, 0.62, -2.7], ae_bay_bedside: [2.9, 0, -1.4], ae_bay_foot: [2.2, 1.45, -0.6],
    hauwa_spot: [-4.6, 0, -4.1], zainab_spot: [1.2, 0, -2.4], zainab_enter: [-1, 0, 2.6], ae_window: [6.2, 1.5, -0.9], waiting: [-6.2, 0, 1.2],
  },
};

export const INTERIORS: InteriorPlan[] = [hostel, senate, sug, yamma, gabas, lab, ae];

export function interiorOrigin(p: InteriorPlan): [number, number] {
  return [INTERIOR_X0 + p.slot * SLOT, INTERIOR_Z0];
}

/** Local -> world for an interior. */
export function toWorld(p: InteriorPlan, x: number, z: number): [number, number] {
  const [ox, oz] = interiorOrigin(p);
  return [ox + x, oz + z];
}

export function interiorAt(x: number, z: number): InteriorPlan | null {
  if (x < INTERIOR_X0 - SLOT / 2) return null;
  for (const p of INTERIORS) {
    const [ox, oz] = interiorOrigin(p);
    if (Math.abs(x - ox) < SLOT / 2 && Math.abs(z - oz) < SLOT / 2) return p;
  }
  return null;
}

export function byId(id: string): InteriorPlan {
  const p = INTERIORS.find((q) => q.id === id);
  if (!p) throw new Error(`no interior ${id}`);
  return p;
}

export interface WallRect { x: number; z: number; hx: number; hz: number }

/**
 * The walls of an interior as thin rectangles (local), with door gaps cut out:
 * each room's four walls, minus gaps where rooms join or doorways are.
 * Walls between two rooms are only built once a gap is accounted for.
 */
export function wallsOf(p: InteriorPlan, t = 0.12): WallRect[] {
  const out: WallRect[] = [];
  const cut = (x0: number, x1: number, z: number, along: "x" | "z", c: number) => {
    // A wall from x0 to x1 at fixed z (or along z at fixed x): remove every gap on it.
    const gaps = p.gaps.filter((g) => g.along === along && Math.abs((along === "x" ? g.z : g.x) - z) < 0.05).map((g) => [(along === "x" ? g.x : g.z) - g.hw, (along === "x" ? g.x : g.z) + g.hw] as const).sort((a, b) => a[0] - b[0]);
    let a = x0;
    for (const [g0, g1] of gaps) {
      if (g1 <= a || g0 >= x1) continue;
      if (g0 > a) out.push(along === "x" ? { x: (a + g0) / 2, z, hx: (g0 - a) / 2, hz: c } : { x: z, z: (a + g0) / 2, hx: c, hz: (g0 - a) / 2 });
      a = Math.max(a, g1);
    }
    if (x1 > a) out.push(along === "x" ? { x: (a + x1) / 2, z, hx: (x1 - a) / 2, hz: c } : { x: z, z: (a + x1) / 2, hx: c, hz: (x1 - a) / 2 });
  };
  for (const r of p.rooms) {
    cut(r.x - r.hx - t / 2, r.x + r.hx + t / 2, r.z - r.hz, "x", t / 2);
    cut(r.x - r.hx - t / 2, r.x + r.hx + t / 2, r.z + r.hz, "x", t / 2);
    cut(r.z - r.hz, r.z + r.hz, r.x - r.hx, "z", t / 2);
    cut(r.z - r.hz, r.z + r.hz, r.x + r.hx, "z", t / 2);
  }
  // Shared walls between rooms touching each other would be built twice (once per room); a room's wall that
  // lies inside another room's floor is removed where the gap list opens it, so duplicates are harmless.
  return out;
}

/** Is a local point on some room's floor? */
export function onFloor(p: InteriorPlan, x: number, z: number, margin = 0): boolean {
  return p.rooms.some((r) => Math.abs(x - r.x) <= r.hx - margin && Math.abs(z - r.z) <= r.hz - margin);
}

/** Floor height at a world point in the interiors: the floor, or the top of a raised platform (the theatres' stages). */
export function interiorFloorAt(x: number, z: number): number {
  const p = interiorAt(x, z);
  if (!p) return FLOOR;
  const [ox, oz] = interiorOrigin(p);
  for (const i of p.items) {
    if (i.kind !== "stage") continue;
    if (Math.abs(x - ox - i.x) <= i.hx && Math.abs(z - oz - i.z) <= i.hz) return FLOOR + i.h;
  }
  return FLOOR;
}
