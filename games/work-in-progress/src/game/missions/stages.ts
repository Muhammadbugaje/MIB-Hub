/**
 * Staging for every cutscene block in Missions 1-10 (docs/plan/missions/Y1.md).
 *
 * The blocks themselves (timing, shots, lines, anims) are played as written by
 * the Director. Staging only says what the script leaves to the director of
 * photography and the stage manager:
 *   - where the scene is (the map or an interior);
 *   - each actor's mark and facing at the start (marks never overlap: a test
 *     checks every pair is at least 0.6 m apart and clear of furniture);
 *   - the camera anchors the block names (gate_kerb_low, room_corner...);
 *   - walk routes round corners;
 *   - small extra beats the block implies but does not list (the porter walks
 *     to the door while the camera follows him; you sit down in Theatre Yamma),
 *     and lines that react to who the player is (ids start with "wip_", so
 *     the voice scripts can add them).
 */
import type { A3, CamAnchor, CutStage, ExtraEntry, PlayerCtx } from "../director.ts";
import { B, frontOf, hall, inYaw, outYaw } from "./places.ts";

const PI = Math.PI;

/** A stage, possibly depending on who the player is (the hall, the outfit, specials). */
export type Stage = (c: PlayerCtx) => CutStage & { aliases?: Record<string, string> };

const outfitLine = (c: PlayerCtx): string => {
  if (c.headwear === "hijab") return `And that ${c.headColour} hijab: keep it neat. You are carrying this family's name.`;
  if (c.female) return `And that ${c.topColour} top is too fine for a fresher. Don't let anybody borrow it.`;
  return `And that ${c.topColour} shirt. Don't let your roommate borrow it. He will not return it.`;
};

const x = (at: number, key: string, args: Record<string, string | number | boolean | number[]>, cond?: string, branch?: "then" | "else"): ExtraEntry => ({ at, key, args: args as unknown as ExtraEntry["args"], cond: cond ?? null, branch: branch ?? null });

export const STAGES: Record<string, Stage> = {
  /* ================================================================ M001 */
  cut_m001_film_a: () => ({
    where: "world",
    hour: 6.7,
    actors: {},
    extra: [x(0, "music.play", { cue: "main_theme_dawn" })],
  }),

  cut_m001_film_b: () => ({
    where: "world",
    hour: 7.0,
    actors: {
      CAR: { at: "car_spawn", face: PI },
      DAD: { at: "car_spawn", hidden: true },
      // Mum has stepped out of the back to stretch, reading her list off her phone while Dad argues.
      MUM: { at: "mum_car_seat", face: 0.9, anim: "phone", hidden: true },
      PLAYER: { at: "car_spawn", hidden: true },
      GUARD: { at: "guard_spot", face: 0.75 },
    },
    extra: [
      x(7.4, "camera.cut", { shot: "medium", from: "guard_cam", look: "GUARD", dur: 3.4 }),
      x(10.9, "actor.show", { who: "MUM" }),
      x(12.4, "actor.anim", { who: "MUM", anim: "gesture" }),
      x(23.4, "camera.cut", { shot: "medium", from: "gate_kerb_low", look: "family_car", dur: 7 }),
      // The player's outfit, noticed (a new line that reacts to the look; id is the game's own).
      x(31.6, "camera.cut", { shot: "close", from: "car_back_seat", look: "MUM", dur: 6 }),
      x(32, "say", { who: "MUM", id: "wip_m001_film_b_01", text: "{{OUTFIT_LINE}}", mood: "stern" }),
    ],
    variants: { wip_m001_film_b_01: (c) => ({ id: "wip_m001_film_b_01", text: outfitLine(c) }) },
  }),

  cut_m001_film_c: (c) => {
    const h = hall(c.female);
    return {
      where: "world",
      hour: 7.3,
      actors: {
        PORTER: { at: "porter_start", face: inYaw(h) + 0.4 },
        CAR: { at: "car_forecourt", face: inYaw(h) + PI / 2 },
        MUM: { at: "hostel:mum_room", face: "hostel:hostel_bed" },
        DAD: { at: "hostel:dad_room", face: "hostel:mum_room" },
        PLAYER: { at: "hostel:player_room", face: "hostel:dad_room" },
      },
      aliases: { room_door: "hostel:room_door_cam" },
      routes: { "PORTER>hall_door": [] },
      extra: [x(3.2, "actor.walk", { who: "PORTER", to: "hall_door" }), x(13.6, "actor.hide", { who: "PORTER" })],
    };
  },

  cut_m001_film_d: (c) => {
    const h = hall(c.female);
    return {
      where: "world",
      hour: 7.5,
      actors: {
        MUM: { at: "hostel:mum_hug", face: "hostel:player_hug" },
        DAD: { at: "hostel:dad_room", face: "hostel:mum_hug" },
        PLAYER: { at: "hostel:player_hug", face: "hostel:mum_hug" },
        CAR: { at: "car_forecourt", face: inYaw(h) + PI / 2 },
        MUHAMMAD: { at: "muhammad_gate", face: 0.2, hidden: true },
      },
      aliases: { room_centre: "hostel:room_centre_cam" },
      routes: { gate_road_far: walkOut(c.female) },
      crowd: [{ n: 14, x: 3, z: -50, hx: 5, hz: 4, face: PI, rows: false }],
      extra: [x(6.9, "actor.hide", { who: "MUM" }), x(6.9, "actor.hide", { who: "DAD" })],
      end: { at: "hostel:hostel_bed_sit", face: PI / 2 },
    };
  },

  cut_m001_film_e: () => ({
    where: "hostel",
    hour: 7.8,
    actors: {
      ROOMIE: { at: "roomie_bed_sit", face: -PI / 2, anim: "sit" },
      PLAYER: { at: "hostel_bed_sit", face: PI / 2, anim: "sit" },
    },
    extra: [x(14, "actor.look", { who: "PLAYER", at: "ROOMIE" }), x(26.5, "actor.anim", { who: "PLAYER", anim: "stand" })],
    end: { at: "hostel_bed_stand", face: PI / 2 },
  }),

  cut_m001_mid_1: () => ({
    where: "world",
    hour: 8.4,
    actors: {
      GOAT: { at: [-9.5, 0, -95], face: -PI / 2 },
      PLAYER: { at: "spot_eat", face: PI, anim: "sit" },
      ROOMIE: { at: "roomie_eat", face: PI, anim: "sit" },
      SUYA: { at: "suya_man_spot", face: -PI / 2 },
    },
    routes: { suya_table_top: [[-14, 0, -93]] },
    crowd: [{ n: 8, x: -20, z: -76, hx: 6, hz: 1.6, face: PI, rows: false }],
    extra: [x(4.6, "actor.anim", { who: "SUYA", anim: "shock" }), x(10.2, "actor.anim", { who: "ROOMIE", anim: "point" })],
    end: { at: "spot_eat", face: PI / 2 },
  }),

  cut_m001_mid_2: () => ({
    where: "world",
    hour: 11.0,
    actors: {
      SULE: { at: "sule_spot", face: 0 },
      GOAT: { at: [62.6, 0, -256.6], face: -PI / 2 },
      PLAYER: { at: [59.4, 0, -253.8], face: PI - 0.2 },
      ROOMIE: { at: [57.4, 0, -253.2], face: PI - 0.4 },
    },
    extra: [x(1.2, "actor.anim", { who: "SULE", anim: "point" }), x(9.4, "actor.walk", { who: "GOAT", to: [64.4, 0, -262] }), x(18.2, "actor.anim", { who: "SULE", anim: "point" })],
    end: { at: "farm_gate", face: PI },
  }),

  cut_m001_close: () => ({
    where: "hostel",
    hour: 18.4,
    actors: {
      PLAYER: { at: "note_kneel", face: 0 },
      ROOMIE: { at: "note_roomie", face: 0.6 },
    },
    aliases: { "prop.note": "note_look" },
    extra: [x(14.9, "actor.anim", { who: "PLAYER", anim: "stand" })],
    end: { at: "room_door", face: 0 },
  }),

  /* ================================================================ M002 */
  cut_m002_open: () => ({
    where: "senate",
    hour: 8.6,
    actors: {
      PLAYER: { at: "senate_enter", face: PI },
      ALEEYA: { at: "aleeya_queue", face: 0 },
      CLERK: { at: "clerk_spot", face: 0 },
      JIYA: { at: "jiya_queue", face: PI },
    },
    anchors: { senate_crane_high: { pos: [9.2, 4.6, 5.6], to: [8, 4.4, 4.4], fov: 52 }, senate_queue: [-4, 0.8, -1] },
    routes: { "PLAYER>queue_end": [[-1.5, 0, 4.4]] },
    crowd: [{ n: 5, x: -4, z: -2.2, hx: 0.2, hz: 2.0, face: PI, rows: true }],
    extra: [x(9, "actor.look", { who: "PLAYER", at: "ALEEYA" })],
  }),

  cut_m002_mid_1: () => ({
    where: "senate",
    hour: 13.2,
    actors: {
      PLAYER: { at: "bursary_queue", face: "muhammad_spot" },
      MUHAMMAD: { at: "muhammad_spot", face: "bursary_queue" },
      CLEMENT: { at: "clement_spot", face: 0 },
      CLERK: { at: "clerk_spot", face: 0.3 },
    },
    crowd: [{ n: 6, x: 2.9, z: -1.2, hx: 1.6, hz: 1.4, face: PI, anim: "sit_floor" }],
    extra: [x(5.6, "actor.look", { who: "MUHAMMAD", at: "PLAYER" }), x(16.2, "actor.look", { who: "PLAYER", at: "MUHAMMAD" })],
  }),

  cut_m002_close: () => ({
    where: "senate",
    hour: 15.9,
    actors: {
      PLAYER: { at: "senate_basement_stair", face: PI / 2 },
      GARBA: { at: "garba_spot", face: -PI / 2, anim: "sit" },
    },
    aliases: { "prop.note": "note_pocket", senate_lawn: "world:senate_lawn", clock_hands_606: "world:clock_hands_606" },
    extra: [x(0.3, "actor.walk", { who: "PLAYER", to: "basement_player" })],
    end: { at: "senate_basement_stair", face: -PI / 2 },
  }),

  /* ================================================================ M003 */
  cut_m003_open: () => ({
    where: "hostel",
    hour: 18.0,
    actors: {
      PLAYER: { at: "desk_stand", face: 0 },
      ROOMIE: { at: "roomie_bed_sit", face: -PI / 2, anim: "sit" },
    },
    aliases: { "prop.onion": "onion" },
    end: { at: "room_door", face: PI },
  }),

  cut_m003_mid_1: () => ({
    where: "hostel",
    hour: 19.67,
    actors: {
      PLAYER: { at: "kitchen_counter", face: PI },
      ROOMIE: { at: "kitchen_stool_a", face: PI, anim: "sit" },
    },
    crowd: [{ n: 4, x: -11.6, z: -4.1, hx: 0.6, hz: 0.6, face: PI / 2 }, { n: 3, x: -8.2, z: -4.3, hx: 0.5, hz: 0.5, face: -PI / 2 }],
  }),

  cut_m003_mid_2: () => ({
    where: "hostel",
    hour: 20.2,
    actors: { PLAYER: { at: "corridor_pov", face: PI / 2 } },
    anchors: { door_floor: [9.9, 0.3, 0.55] },
    extra: [x(12.6, "actor.place", { who: "PLAYER", at: "idris_door", face: 0 })],
    end: { at: "idris_door", face: 0 },
  }),

  cut_m003_close: () => ({
    where: "hostel",
    hour: 21.1,
    actors: {
      PLAYER: { at: "circle_player", face: PI, anim: "sit_floor" },
      ROOMIE: { at: "circle_roomie", face: PI, anim: "sit" },
      IDRIS: { at: "circle_idris", face: PI, anim: "sit" },
      PORTER: { at: "kitchen_doorway", face: PI },
    },
    anchors: { RADIO: [-12.6, 1.42, -3.6] },
    crowd: [{ n: 3, x: -12.1, z: -2.6, hx: 0.5, hz: 0.6, face: PI / 2, anim: "sit_floor" }],
    end: { at: "kitchen_circle", face: PI },
  }),

  /* ================================================================ M004 */
  cut_m004_open: () => ({
    where: "world",
    hour: 8.1,
    actors: {
      NEEDLE: { at: "needle_spot", face: outYaw(B.needle) - 0.3, anim: "sit" },
      PLAYER: { at: "needle_customer", face: inYaw(B.needle) },
      MUBARAK: { at: "sug:mubarak_hall", face: 0 },
    },
    aliases: { sug_hall_door: "sug:sug_hall_door_cam" },
    extra: [x(9.45, "actor.place", { who: "PLAYER", at: "sug:sug_hall_table", face: PI })],
    end: { at: "sug:sug_hall_table", face: PI },
  }),

  cut_m004_mid_1: () => ({
    where: "world",
    hour: 10.0,
    actors: {
      PLAYER: { at: "lawn_row", face: 0, anim: "oath" },
      LYZZY: { at: "lyzzy_lawn", face: PI / 2 + 0.4 },
      LILY: { at: "lily_lawn", face: -PI / 2 },
      MADISON: { at: [-77.6, 0, -168.4], face: -PI / 2 },
    },
    aliases: { CROWD: "lawn_crowd" },
    crowd: [
      { n: 10, x: -83.2, z: -172.4, hx: 3.2, hz: 0.1, face: 0, anim: "oath", rows: true },
      { n: 10, x: -82, z: -174.4, hx: 3.8, hz: 0.1, face: 0, anim: "oath", rows: true },
      { n: 8, x: -82, z: -170.4, hx: 3.2, hz: 0.1, face: 0, anim: "oath", rows: true },
    ],
    extra: [x(12, "actor.anim", { who: "LYZZY", anim: "point" }), x(16, "actor.anim", { who: "PLAYER", anim: "stand" })],
    end: { at: "lawn_row", face: 0 },
  }),

  cut_m004_close: () => ({
    where: "world",
    hour: 10.6,
    actors: {
      PLAYER: { at: [-77.8, 0, -167.2], face: PI / 2 },
      LYZZY: { at: [-77.0, 0, -166.6], face: -PI / 2 + 0.3, anim: "phone" },
      MUBARAK: { at: "mubarak_lawn", face: 0.6 },
    },
    aliases: { "prop.camera_screen": "camera_screen" },
    anchors: { camera_screen: [-77.3, 1.45, -166.8] },
    extra: [x(16.5, "actor.walk", { who: "MUBARAK", to: [-77.2, 0, -165.9] }), x(13, "actor.anim", { who: "LYZZY", anim: "stand" })],
    end: { at: [-77.8, 0, -167.2], face: 0 },
  }),

  /* ================================================================ M005 */
  cut_m005_open: () => ({
    where: "world",
    hour: 8.05,
    actors: {
      PLAYER: { at: "yamma:row3_seat", face: PI, anim: "sit" },
      LAWLEC: { at: "yamma:stage_spot", face: 0 },
    },
    aliases: { yamma_aisle: "yamma:row_three_cam", yamma_stage: "yamma:stage_cam" },
    crowd: [
      { n: 5, x: -2.6, z: -1.34, hx: 2.4, hz: 0.05, face: PI, anim: "sit", rows: true },
      { n: 4, x: -3.4, z: 1.36, hx: 2.4, hz: 0.05, face: PI, anim: "sit", rows: true },
      { n: 4, x: -3.6, z: 2.71, hx: 2.4, hz: 0.05, face: PI, anim: "sit", rows: true },
    ].map((s) => ({ ...s, where: "yamma" })) as CutStage["crowd"],
    variants: {
      m005_open_01: (cc) => (cc.female ? { id: "m005_open_01_f", text: `You. The young lady in the unfortunate ${cc.topColour} top.` } : { id: "m005_open_01", text: `You. The gentleman in the unfortunate shirt.` }),
    },
    extra: [x(20.4, "fx.play", { id: "crowd:laugh" }), x(27.2, "actor.anim", { who: "PLAYER", anim: "stand" })],
    end: { at: "yamma:aisle_door", face: 0 },
  }),

  cut_m005_mid_1: () => ({
    where: "gabas",
    hour: 8.2,
    actors: {
      OKONKWO: { at: "stage_spot", face: 0 },
      PLAYER: { at: "row6_seat", face: PI, anim: "sit" },
      SHAMSU: { at: "row6_seat_b", face: PI, anim: "sit" },
      NUSAIBA: { at: "row3_seat_b", face: PI, anim: "sit" },
    },
    anchors: { gabas_stage: { pos: [1.2, 1.9, -3.9], fov: 40 }, gabas_row_six: { pos: [3.6, 1.32, 4.5], fov: 34 }, gabas_row_three: { pos: [4.2, 1.35, 0.4], fov: 38 } },
    crowd: [
      { n: 5, x: -3.4, z: 5.41, hx: 2.2, hz: 0.05, face: PI, anim: "sit", rows: true },
      { n: 4, x: -3.2, z: 1.36, hx: 2.2, hz: 0.05, face: PI, anim: "sit", rows: true },
      { n: 3, x: 4.4, z: 2.71, hx: 1.4, hz: 0.05, face: PI, anim: "sit", rows: true },
    ],
    extra: [x(22.5, "actor.anim", { who: "NUSAIBA", anim: "point" }), x(26, "actor.look", { who: "OKONKWO", at: "NUSAIBA" })],
    end: { at: "row6_seat", face: PI },
  }),

  cut_m005_close: () => ({
    where: "lab",
    hour: 9.6,
    actors: {
      PLAYER: { at: "logbook_stand", face: PI },
      WEDNESDAY: { at: "wednesday_spot", face: 0 },
      ABBAS: { at: "abbas_spot", face: PI },
      OKONKWO: { at: "okonkwo_door", face: PI },
    },
    aliases: { "prop.logbook": "lab_bench" },
    routes: {},
    extra: [x(13.5, "actor.walk", { who: "OKONKWO", to: "okonkwo_lab" }), x(16.6, "actor.anim", { who: "OKONKWO", anim: "point" })],
    end: { at: "logbook_stand", face: 0 },
  }),

  /* ================================================================ M006 */
  cut_m006_open: () => ({
    where: "world",
    hour: 19.2,
    actors: {
      SHAYI: { at: "shayi_spot", face: 0, anim: "sit" },
      PLAYER: { at: "bench_seat_a", face: 0, anim: "sit" },
      ROOMIE: { at: "bench_seat_b", face: 0, anim: "sit" },
    },
    aliases: { "prop.note": "note_hand" },
    anchors: { note_hand: [-96.9, 0.9, -103.9] },
    extra: [x(14.2, "actor.anim", { who: "SHAYI", anim: "gesture" })],
    end: { at: [-95.6, 0, -101.8], face: PI },
  }),

  cut_m006_mid_1: () => ({
    where: "world",
    hour: 20.4,
    actors: {
      MAKER: { at: "maker_crate", face: PI, anim: "sit" },
      PLAYER: { at: [-76.6, 0, -230.8], face: 0.5 },
    },
    aliases: { "prop.note": "note_held" },
    anchors: { note_held: [-76.3, 1.1, -230.3] },
    extra: [x(10, "actor.anim", { who: "PLAYER", anim: "point" })],
    end: { at: "garden_gate_outside", face: PI },
  }),

  cut_m006_close: () => ({
    where: "world",
    hour: 21.0,
    actors: {
      TANKO: { at: "tanko_spot", face: 0.3 },
      PLAYER: { at: [-78.6, 0, -236.6], face: PI - 0.6 },
      ROOMIE: { at: [-77.2, 0, -237.2], face: PI - 0.9 },
    },
    aliases: { "prop.statue_fish_girl": "statue_head" },
    anchors: { statue_head: [-24, 1.05, -120.0] },
    extra: [x(9.9, "actor.place", { who: "PLAYER", at: "pond_path", face: PI / 2 }), x(9.9, "actor.place", { who: "ROOMIE", at: [-31.4, 0, -109.4], face: PI / 2 })],
    end: { at: "pond_path", face: PI / 2 },
  }),

  /* ================================================================ M007 */
  cut_m007_open: () => ({
    where: "world",
    hour: 16.0,
    actors: {
      PLAYER: { at: [-90.6, 0, -57.6], face: PI / 2 },
      ROOMIE: { at: [-91.8, 0, -58.8], face: PI / 2 },
      SLY: { at: "sly_spot", face: -PI / 2 },
      HASSAN: { at: "hassan_spot", face: -PI / 2 },
      JIYA: { at: "jiya_bench", face: PI, anim: "sit" },
    },
    crowd: [{ n: 6, x: -80, z: -48.6, hx: 6, hz: 0.4, face: PI, rows: true }],
    extra: [x(4.4, "actor.anim", { who: "SLY", anim: "gesture" })],
    end: { at: "court_centre", face: PI / 2 },
  }),

  cut_m007_close: () => ({
    where: "world",
    hour: 16.3,
    actors: {
      ABBAS: { at: "abbas_court", face: PI / 2 },
      BABY: { at: "baby_spot", face: -PI / 2, hidden: true },
      SLY: { at: "sly_spot", face: -PI / 2 },
      PLAYER: { at: [-81.6, 0, -57.2], face: PI / 2, anim: "sit" },
      ROOMIE: { at: [-82.6, 0, -55.6], face: PI / 2 + 0.6 },
    },
    routes: { "SLY>court_gate": [[-72, 0, -60.8]] },
    anchors: { court_gate: [-65.4, 0, -61.2] },
    aliases: {},
    extra: [x(4, "camera.cut", { shot: "wide", from: "court_gate_cam", look: "BABY", dur: 5 })],
    end: { at: "court_centre", face: PI / 2 },
  }),

  /* ================================================================ M008 */
  cut_m008_open: () => ({
    where: "world",
    hour: 17.0,
    actors: {
      JEGA: { at: "jega_spot", face: PI - 0.4, anim: "kneel" },
      COACH: { at: "coach_spot", face: PI },
      PLAYER: { at: [-160.6, 0, -210.6], face: PI },
      TATY: { at: [-182, 0, -203], face: PI / 2 },
    },
    anchors: { pitch_centre: [-160, 1.0, -214] },
    extra: [x(13, "actor.anim", { who: "COACH", anim: "point" }), x(22.4, "actor.anim", { who: "JEGA", anim: "stand" }), x(22.5, "actor.look", { who: "JEGA", at: "PLAYER" })],
    end: { at: [-160.6, 0, -210.6], face: PI },
  }),

  cut_m008_mid_1: () => ({
    where: "world",
    hour: 17.6,
    actors: {
      SHAMSU: { at: [-186.4, 0, -212.6], face: -PI / 2 },
      ROOMIE: { at: [-133.6, 0, -215], face: -PI / 2 },
      JEGA: { at: [-163.6, 0, -201.6], face: 0.4 },
      PLAYER: { at: "water_spot", face: -PI / 2 + 0.3 },
    },
    anchors: { goalmouth_side: { pos: [-181.4, 1.5, -207.4], fov: 40 }, water_cooler: { pos: [-162.2, 1.5, -201.4], fov: 34 } },
    extra: [x(10.4, "actor.place", { who: "SHAMSU", at: [-165.6, 0, -199.6], face: PI / 2 }), x(10.4, "actor.place", { who: "ROOMIE", at: [-166.8, 0, -201.2], face: PI / 2 }), x(32, "actor.anim", { who: "JEGA", anim: "gesture" })],
    end: { at: "water_spot", face: PI },
  }),

  cut_m008_close: () => ({
    where: "world",
    hour: 18.2,
    actors: {
      HELEN: { at: "helen_spot", face: PI, anim: "write" },
      JEGA: { at: [-159.4, 0, -229.6], face: PI / 2 },
      PLAYER: { at: [-160.6, 0, -229.2], face: -PI / 2 },
    },
    anchors: { pitch_touchline: { pos: [-157.6, 1.5, -226.6], fov: 40 }, pitch_centre: { pos: [-161.2, 1.6, -224], fov: 40 } },
    end: { at: [-160.6, 0, -229.2], face: 0 },
  }),

  /* ================================================================ M009 */
  cut_m009_open: () => ({
    where: "world",
    hour: 20.4,
    actors: {
      JEGA: { at: [-180, 0, -213], face: -PI / 2 },
      PLAYER: { at: [-176, 0, -219], face: -PI / 2 },
    },
    extra: [x(5.6, "actor.anim", { who: "PLAYER", anim: "shock" })],
    end: { at: [-185.6, 0, -213.0], face: -PI / 2 },
  }),

  cut_m009_mid_1: () => ({
    where: "ae",
    hour: 20.6,
    actors: {
      HAUWA: { at: "hauwa_spot", face: 0 },
      JEGA: { at: "jega_waiting", face: PI / 2, anim: "sit" },
      PLAYER: { at: "player_waiting", face: PI / 2 },
      ZAINAB: { at: "zainab_enter", face: PI },
    },
    routes: { "ZAINAB>ae_bay_bed": [[0.6, 0, 0.6]] },
    anchors: { ae_bay_bed: [1.2, 0, -1.9] },
    extra: [
      x(15, "actor.place", { who: "JEGA", at: "jega_bed", face: PI / 2 }),
      x(15.05, "actor.anim", { who: "JEGA", anim: "sit" }),
      x(15, "actor.place", { who: "PLAYER", at: "ae_bay_bedside", face: PI }),
      x(25.2, "actor.anim", { who: "PLAYER", anim: "hold_torch" }),
    ],
    end: { at: "ae_bay_bedside", face: PI },
  }),

  cut_m009_close: () => ({
    where: "ae",
    hour: 22.4,
    actors: {
      ZAINAB: { at: "zainab_chair", face: -PI / 2 + 0.3 },
      JEGA: { at: "jega_bed", face: PI / 2, anim: "sit" },
      PLAYER: { at: "ae_bay_bedside", face: PI },
      MAKER: { at: "maker_hosp", face: PI - 0.5, hidden: true },
    },
    aliases: { med_garden_bench: "world:med_garden_bench", ward_window_first_floor: "world:ward_window_first_floor", maker_hosp: "world:maker_hosp" },
    extra: [
      x(16.0, "camera.cut", { shot: "medium", from: "world:ae_window_out", look: "world:med_garden_bench_look", dur: 9 }),
      x(26, "actor.look", { who: "ZAINAB", at: "ae_window" }),
    ],
    end: { at: "ae_bay_bedside", face: PI },
  }),

  /* ================================================================ M010 */
  cut_m010_open: () => ({
    where: "sug",
    hour: 11.0,
    actors: {
      PLAYER: { at: "basement_enter", face: PI / 2 },
      MUBARAK: { at: "mubarak_locker", face: -PI / 2 },
    },
    extra: [x(5.2, "actor.look", { who: "PLAYER", at: "MUBARAK" })],
    end: { at: "locker_row", face: PI / 2 },
  }),

  cut_m010_mid_1: () => ({
    where: "world",
    hour: 12.0,
    actors: {
      LADI: { at: "ladi_spot", face: outYaw(B.ladi) },
      MUBARAK: { at: "mubarak_market", face: inYaw(B.ladi) },
      PLAYER: { at: "ladi_stall", face: inYaw(B.ladi) + 0.4 },
    },
    end: { at: "ladi_stall", face: inYaw(B.ladi) },
  }),

  cut_m010_close: () => ({
    where: "sug",
    hour: 13.4,
    actors: {
      CUSTOMER: { at: "customer_spot", face: -PI / 2 },
      MUBARAK: { at: "mubarak_locker", face: PI / 2 },
      PLAYER: { at: "locker_row", face: PI / 2 },
      PORTER: { at: "porter_stair", face: PI / 2, hidden: true },
    },
    extra: [x(20.8, "actor.show", { who: "PORTER" }), x(21, "actor.walk", { who: "PORTER", to: "porter_in" })],
    end: { at: "basement_stair_spot", face: PI },
  }),
};

/** The family car's route out of the hall forecourt to the gate road (along the campus paths). */
function walkOut(female: boolean): A3[] {
  if (female) return [[100, 0, -150], [92, 0, -128], [60, 0, -122], [20, 0, -100], [5, 0, -80], [2.5, 0, -50], [2.5, 0, -30]];
  return [[-96, 0, -86], [-95, 0, -70], [-62, 0, -67], [-40, 0, -62], [-12, 0, -50], [-2.5, 0, -40], [-2.5, 0, -22]];
}

/**
 * Extra interior anchors the stages use (local metres, added to interior-plan's
 * own). Kept here so the room plan stays the furniture list.
 */
export const EXTRA_INTERIOR_ANCHORS: Record<string, Record<string, A3 | CamAnchor>> = {
  hostel: {
    mum_room: [1.25, 0, 3.0], dad_room: [2.9, 0, 2.0], player_room: [2.5, 0, 3.1],
    room_door_cam: { pos: [1.65, 1.6, 1.45], fov: 48 }, room_centre_cam: { pos: [3.3, 1.55, 2.0], fov: 38 },
    mum_hug: [1.65, 0, 3.0], player_hug: [2.2, 0, 3.0],
    hostel_bed_sit: [1.0, 0, 3.6], roomie_bed_sit: [3.0, 0, 3.6], hostel_bed_stand: [1.6, 0, 2.2],
    room_corner: { pos: [3.7, 1.65, 1.6], fov: 44 },
    note_kneel: [2.0, 0, 0.42], note_roomie: [1.1, 0, 0.0], note_look: [2.0, 0.05, 1.08],
    door_floor: { pos: [2.45, 0.32, 0.3], fov: 34 }, corridor_far_end: { pos: [12.3, 1.7, 0.0], fov: 50 },
    desk_stand: [1.45, 0, 3.7], onion: [2.4, 0.8, 4.75], room_table: { pos: [1.2, 1.25, 3.7], fov: 34 },
    kitchen_stool_a: [-10.7, 0, -2.72], kitchen_door: { pos: [-10, 1.6, -0.6], fov: 46 }, kitchen_high: { pos: [-7.8, 2.55, -1.7], fov: 50 },
    kitchen_shelf: { pos: [-11.2, 1.45, -2.4], fov: 34 }, kitchen_doorway: [-10.2, 0, -0.6],
    circle_player: [-9.6, 0, -2.25], circle_roomie: [-8.5, 0, -2.72], circle_idris: [-10.7, 0, -2.72], candle_circle: [-9.6, 0.8, -3.3],
    corridor_pov: [6.6, 0, 0.2], corridor_mid: { pos: [8.2, 1.55, -0.6], fov: 42 }, idris_door: [10.5, 0, 0.62],
    sugar_shelf: [1.45, 0, 3.7],
  },
  senate: {
    senate_enter: [0, 0, 6.0], aleeya_queue: [-4, 0, 1.75], jiya_queue: [-4, 0, -3.95], muhammad_spot: [0.55, 0, -1.95],
    note_pocket: [4.4, 1.0, 14.6], queue_side: { pos: [-1.8, 1.5, 0.6], fov: 40 }, registry_window: { pos: [-5.6, 1.5, -4.4], fov: 34 },
    bursary_window: { pos: [0.8, 1.5, -4.6], fov: 36 }, basement_corridor: { pos: [-6.4, 1.6, 13.2], fov: 44 },
    garba_desk_side: { pos: [3.2, 1.45, 13.1], fov: 38 }, garba_desk_low: { pos: [4.5, 1.0, 15.8], fov: 32 }, queue_front: { pos: [-2.6, 1.6, -4.6], fov: 38 },
    bursary_queue: [-0.6, 0, -2.6], basement_player: [4.6, 0, 14.6],
  },
  sug: {
    sug_hall_door_cam: { pos: [2.6, 1.7, 3.8], fov: 46 }, basement_enter: [-5.2, 0, 14.2], mubarak_locker: [0.4, 0, 14.6],
    locker_row: [-1.2, 0, 14.4], customer_spot: [-0.6, 0, 13.0], porter_in: [-4.2, 0, 13.6], basement_stair_spot: [-4.6, 0, 14.6],
    locker_side: { pos: [1.9, 1.4, 12.6], fov: 40 }, basement_stair: { pos: [-5.4, 1.65, 13.6], fov: 48 },
  },
  lab: { okonkwo_door: [0, 0, 3.4], logbook_stand: [3, 0, -0.45] },
  ae: {
    jega_waiting: [-6.05, 0, 1.6], player_waiting: [-5.6, 0, 2.4], jega_bed: [2.72, 0, -2.85], zainab_chair: [2.9, 0, -1.62], ae_bay_bedside: [3.75, 0, -1.8],
    ae_desk: { pos: [-2.6, 1.5, -1.4], fov: 40 }, ae_curtain: { pos: [-0.4, 1.55, 0.6], fov: 42 }, ae_bay_foot: { pos: [2.6, 1.45, -0.4], fov: 38 },
    ae_window: { pos: [5.6, 1.5, -1.0], fov: 36 },
  },
  yamma: { row_three_cam: { pos: [4.4, 1.3, 2.6], fov: 38 }, stage_cam: { pos: [1.4, 2.0, -4.2], fov: 40 } },
  gabas: {},
};

/** Extra world anchors the stages use (map coordinates). */
export const EXTRA_WORLD_ANCHORS: Record<string, A3 | CamAnchor> = {
  court_gate_cam: { pos: [-74.6, 1.6, -59.6], fov: 40 },
  med_garden_bench_look: [95, 0.9, -105.8],
};

export function stageFor(id: string, c: PlayerCtx): (CutStage & { aliases?: Record<string, string> }) | null {
  const s = STAGES[id];
  return s ? s(c) : null;
}

void frontOf;
