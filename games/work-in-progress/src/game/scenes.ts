/**
 * Scene data. The opening follows docs/plan/missions/Y1.md (M001, cutscenes
 * cut_m001_film_a and cut_m001_film_b, and "CALL ME!" from film_d) and the
 * bible's first-ten-minutes table: the air over campus, the clock stuck at
 * 6:06, the gate argument, Mum's advice, and a quiet young man in a white
 * shirt who is there for one shot and gone the next. Lines keep the story's
 * voice line ids; the two outfit lines (wip_open_*) are new for this slice
 * and react to what the player is wearing.
 */
import type { PlayerCtx, SceneDef } from "./cutscene.ts";

const NAMES: [string, [number, number, number]][] = [
  ["white", [244, 241, 234]], ["cream", [233, 228, 216]], ["sky-blue", [134, 183, 224]], ["blue", [42, 95, 168]], ["navy", [31, 60, 102]],
  ["wine", [122, 46, 59]], ["red", [168, 50, 50]], ["green", [47, 138, 76]], ["dark green", [31, 107, 82]], ["mustard", [224, 165, 38]],
  ["orange", [217, 98, 43]], ["purple", [91, 75, 168]], ["black", [43, 43, 43]], ["grey", [86, 96, 106]], ["beige", [201, 184, 150]],
  ["pink", [233, 138, 138]], ["yellow", [242, 194, 48]], ["teal", [62, 142, 158]], ["brown", [138, 90, 58]],
];

/** Plain-English name for a colour, for lines like "that blue shirt". */
export function colourName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let best = NAMES[0]!;
  let bd = Infinity;
  for (const n of NAMES) {
    const d = (n[1][0] - r) ** 2 + (n[1][1] - g) ** 2 + (n[1][2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best[0];
}

const outfitLine = (c: PlayerCtx): string => {
  if (c.look.headwear === "hijab") return `And that ${colourName(c.look.headwearColor)} hijab: keep it neat. You are carrying this family's name.`;
  if (c.female) return `And that ${c.topColour} top is too fine for a fresher. Don't let anybody borrow it.`;
  return `And that ${c.topColour} shirt. Don't let your roommate borrow it. He will not return it.`;
};

export const OPENING: SceneDef = {
  id: "cut_wip_opening",
  letterbox: true,
  duration: 62,
  end: { player: [11.3, 0, -40.6], yaw: Math.PI, cameraYaw: Math.PI },
  shots: [
    // film_a: the air.
    { at: 0, dur: 9.5, from: [175, 88, -30], to: [72, 52, -118], look: [0, 6, -210], lookTo: [0, 10, -178], ease: "sine", fov: 50 },
    { at: 9.5, dur: 8, from: [-170, 36, 48], to: [-52, 20, 16], look: [0, 3, -6], lookTo: [0, 4, -30], ease: "sine", fov: 50 },
    // The clock that says 6:06.
    { at: 17.5, dur: 5, from: [3, 17.5, -100], to: [0.8, 18.4, -108], look: [0, 18.6, -125.3], ease: "out", fov: 38 },
    // The gate from high up; freshers pour in.
    { at: 22.5, dur: 5, from: [32, 26, -76], to: [15, 12, -60], look: [0, 3, -40], lookTo: [4, 2, -44], ease: "inOut", fov: 50 },
    // film_b: the family car at the gate.
    { at: 27.5, dur: 6.5, from: [8.2, 1.3, -32], to: [7.6, 1.4, -34], look: "CAR", ease: "out", fov: 45 },
    { at: 34, dur: 3, from: [-1.2, 1.7, -35.8], look: "GUARD", ease: "linear", fov: 40 },
    { at: 37, dur: 16, from: [9.6, 1.6, -29.5], to: [8.8, 1.55, -31.5], look: [2.5, 1.3, -38.2], lookTo: [2.2, 1.4, -39.5], ease: "linear", fov: 42 },
    // You step out.
    { at: 53, dur: 4.5, from: [10, 2.4, -33.5], to: [9.4, 2.1, -35], look: "PLAYER", ease: "inOut", fov: 45 },
    // The car leaves; settle behind the player for gameplay.
    { at: 57.5, dur: 4.5, from: [13.5, 3.4, -33.5], to: [11.3, 3.1, -35.7], look: [11.3, 1.6, -44], ease: "inOut", fov: 55 },
  ],
  lines: [
    { at: 33, who: "DAD", id: "m001_film_01", text: "This is not the main gate." },
    { at: 35.2, who: "GUARD", id: "m001_film_02", text: "Oga, it is the only gate." },
    { at: 38, who: "MUM", id: "m001_film_03", text: "Don't follow bad friends." },
    { at: 40.6, who: "MUM", id: "m001_film_04", text: "Don't follow good friends too closely either." },
    { at: 43.6, who: "MUM", id: "m001_film_05", text: "Eat. Pray. Call me." },
    { at: 46, who: "MUM", id: "wip_open_01", text: outfitLine },
    { at: 49.8, who: "DAD", id: "m001_film_06", text: "When I was your age I trekked to school." },
    { at: 52.2, who: "MUM", id: "m001_film_07", text: "You took a bus." },
    { at: 55.2, who: "PLAYER", id: "wip_open_02", text: (c) => (c.female ? "I will call. Every day. Almost." : "I will call. Every day. Almost.") },
    { at: 58.2, who: "MUM", id: "m001_film_12", text: "CALL ME!" },
  ],
  cues: [
    { at: 0, do: "fade", to: 1, dur: 0 },
    { at: 0.1, do: "fade", to: 0, dur: 2.2 },
    { at: 0, do: "hide", actor: "PLAYER" },
    { at: 0, do: "spawn", actor: "CAR", pos: [2.5, 0.05, -15], yaw: Math.PI },
    { at: 0, do: "spawn", actor: "GUARD", pos: [-5.8, 0, -41.2], yaw: 0.35 },
    { at: 0, do: "hide", actor: "MUHAMMAD" },
    { at: 22.5, do: "spawn", actor: "MUHAMMAD", pos: [11.2, 0, -45.6], yaw: 0.2 },
    { at: 27.4, do: "hide", actor: "MUHAMMAD" },
    { at: 27.6, do: "ride", actor: "CAR", path: [[2.5, -15], [2.5, -38]], speed: 6.5 },
    { at: 53, do: "spawn", actor: "PLAYER", pos: [3.9, 0, -37.6], yaw: Math.PI / 2 },
    { at: 53.3, do: "walk", actor: "PLAYER", path: [[3.9, -37.6], [6.2, -38.0], [9.6, -39.2], [11.3, -40.6]], speed: 1.35 },
    { at: 56.2, do: "ride", actor: "CAR", path: [[2.5, -38], [2.6, -35], [1.2, -31.2], [-1.6, -29], [-2.5, -25], [-2.5, -15]], speed: 5 },
    { at: 61, do: "hide", actor: "CAR" },
  ],
};
