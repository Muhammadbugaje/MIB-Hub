/**
 * The cast of Missions 1 to 10: how each named character looks.
 *
 * Every character is built from one of the six base models (jiya, taty,
 * zainab, muhammad, the_maker, bature) with their own skin tone, outfit
 * colours and accessories. Heights stay within ±6% (plan rule C6).
 *
 * Dr. Zainab is very fair ("Snow White" to her friends) and her tone is
 * locked: a test checks it.
 */
import type { Look } from "../world/people.ts";

export interface CastMember {
  /** Display name (subtitles use the voice profile's name). */
  name: string;
  look: Look;
  /** Height multiplier within ±6% (plan rule C6). */
  height?: number;
  /** Extra width for the one genuinely huge man (Big Sly), applied to x and z only. */
  width?: number;
  /** Things they carry or wear that the base mesh lacks (drawn as small props). */
  extras?: ("folder" | "glasses" | "sunglasses" | "pens" | "camera" | "phone" | "volleyball" | "ledger" | "torch" | "bumbag" | "whistle" | "apron" | "labcoat" | "stethoscope" | "spanner" | "notebook" | "jersey10" | "bag")[];
}

const L = (model: string, skin: string, hair: string, outfit: string[], headwear: Look["headwear"] = "none", headwearColor = "#ffffff"): Look => ({ model, skin, hair, outfit, headwear, headwearColor });

/** Skin tones used for the authored cast. */
export const CAST_SKIN = {
  veryFair: "#f1d6c2",
  fair: "#e2b892",
  light: "#d9a77c",
  honey: "#c68a5e",
  caramel: "#b5794f",
  medium: "#a06a46",
  tan: "#8d5b3c",
  deep: "#7a4e34",
};
const S = CAST_SKIN;
const BLACK_HAIR = "#141010", BROWN_HAIR = "#2a1d16", GREY_HAIR = "#8f8a84", RED_HAIR = "#5d2e1c", BLOND_HAIR = "#d4a056";

/** Outfit variants per character: each variant is a different look the player can choose. */
export const OUTFIT_VARIANTS: Record<string, Look[]> = {
  "npc.roomie.m": [
    L("bature", S.deep, BLACK_HAIR, ["#f2c230", "#f2c230", "#2b2b2b", "#e9e4d8"]),
    L("bature", S.deep, BLACK_HAIR, ["#2b2b2b", "#a83232", "#2b2b2b", "#e9e4d8"]),
    L("the_maker", S.deep, BLACK_HAIR, ["#1f3c66", "#2b2b2b", "#2b2b2b", "#e9e4d8"]),
  ],
  "npc.roomie.f": [
    L("zainab", S.deep, BLACK_HAIR, ["#e98a8a", "#3a3a5a", "#f4f1ea", "#f4f1ea"], "hijab", "#7a2e3b"),
    L("zainab", S.deep, BLACK_HAIR, ["#3e8e9e", "#2b2b2b", "#f4f1ea", "#f4f1ea"], "hijab", "#3e8e9e"),
    L("zainab", S.deep, BLACK_HAIR, ["#5b4ba8", "#e0a526", "#d4af37", "#e0a526"], "hijab", "#e0a526"),
  ],
  "npc.muhammad": [
    L("muhammad", S.tan, BLACK_HAIR, ["#fbfbf8", "#2b2b2b", "#2b2b2b", "#2b2b2b"]),
    L("muhammad", S.tan, BLACK_HAIR, ["#8a5a3a", "#2b2b2b", "#2b2b2b", "#2b2b2b"]),
    L("muhammad", S.tan, BLACK_HAIR, ["#c9b896", "#4f4a36", "#2b2b2b", "#2b2b2b"]),
  ],
  "npc.zainab": [
    L("zainab", S.veryFair, BLACK_HAIR, ["#3e8e9e", "#3e8e9e", "#f4f1ea", "#f4f1ea"], "hijab", "#2b2b2b"),
    L("zainab", S.veryFair, BLACK_HAIR, ["#5b4ba8", "#e0a526", "#d4af37", "#e0a526"], "hijab", "#e0a526"),
    L("zainab", S.veryFair, BLACK_HAIR, ["#f4f1ea", "#86b7e0", "#86b7e0", "#f4f1ea"], "hijab", "#f4f1ea"),
  ],
  "npc.maker": [
    L("the_maker", S.light, GREY_HAIR, ["#c9ccc8", "#56606a", "#2b2b2b", "#2b2b2b"]),
    L("the_maker", S.light, GREY_HAIR, ["#2b2b2b", "#a83232", "#2b2b2b", "#2b2b2b"]),
    L("the_maker", S.light, GREY_HAIR, ["#56606a", "#2b2b2b", "#2b2b2b", "#2b2b2b"]),
  ],
  "special.jiya": [
    L("jiya", S.fair, "#e8c3a0", ["#ff6b6b", "#4ecdc4", "#f1f1f1", "#f1f1f1"], "cap", "#ff6b6b"),
    L("jiya", S.fair, "#e8c3a0", ["#2f8a4c", "#e9e4d8", "#c9b896", "#8a5a3a"], "cap", "#2f8a4c"),
    L("jiya", S.fair, "#e8c3a0", ["#5b4ba8", "#e0a526", "#d4af37", "#e0a526"], "cap", "#e0a526"),
  ],
  "special.taty": [
    L("taty", S.fair, BLACK_HAIR, ["#2b2b2b", "#2b2b2b", "#e98a8a", "#f4f1ea"]),
    L("taty", S.fair, BLACK_HAIR, ["#f4f1ea", "#5b4ba8", "#f2c230", "#2b2b2b"]),
    L("taty", S.fair, BLACK_HAIR, ["#e98a8a", "#f4f1ea", "#d9622b", "#f4f1ea"]),
  ],
};

export const CAST: Record<string, CastMember> = {
  "npc.mum": { name: "Mum", look: L("zainab", S.medium, BLACK_HAIR, ["#2f6f5a", "#e0a526", "#d4af37", "#e0a526"], "hijab", "#e0a526") },
  "npc.dad": { name: "Dad", look: L("the_maker", S.tan, BLACK_HAIR, ["#e9e4d8", "#e9e4d8", "#2b2b2b", "#2b2b2b"], "cap", "#7a2e3b"), height: 1.02 },
  "npc.gate_guard": { name: "Gate guard", look: L("muhammad", S.deep, BLACK_HAIR, ["#7d7350", "#4f4a36", "#2b2b2b", "#2b2b2b"], "cap", "#4f4a36") },
  "npc.baba_porter": { name: "Baba Porter", look: L("muhammad", S.tan, GREY_HAIR, ["#4f6a8a", "#2e3a48", "#2b2b2b", "#2b2b2b"], "cap", "#2e3a48") },
  "npc.roomie.m": { name: "Bature", look: L("bature", S.deep, BLACK_HAIR, ["#f2c230", "#f2c230", "#2b2b2b", "#e9e4d8"]), height: 0.95 },
  "npc.roomie.f": { name: "Firdausi", look: L("zainab", S.deep, BLACK_HAIR, ["#e98a8a", "#3a3a5a", "#f4f1ea", "#f4f1ea"], "hijab", "#7a2e3b"), height: 0.96 },
  "npc.mama_nkechi": { name: "Mama Nkechi", look: L("zainab", S.caramel, BLACK_HAIR, ["#d9622b", "#2f8a4c", "#e0a526", "#2f8a4c"], "hijab", "#2f8a4c"), extras: ["apron"] },
  "npc.suya_man": { name: "Suya man", look: L("muhammad", S.tan, BLACK_HAIR, ["#f4f1ea", "#56606a", "#2b2b2b", "#2b2b2b"], "cap", "#f4f1ea") },
  "npc.malam_sule": { name: "Malam Sule", look: L("bature", S.tan, GREY_HAIR, ["#8a6a48", "#c9b896", "#4f4a36", "#c9b896"]) },
  "npc.aleeya": { name: "Aleeya", look: L("zainab", S.light, BLACK_HAIR, ["#5b4ba8", "#2b2b2b", "#f4f1ea", "#f4f1ea"], "hijab", "#c9b8e8"), height: 1.05 },
  "npc.mrs_adebayo": { name: "Mrs. Adebayo", look: L("zainab", S.medium, BLACK_HAIR, ["#1f3c66", "#e9e4d8", "#d4af37", "#1f3c66"], "hijab", "#1f3c66"), extras: ["glasses"] },
  "npc.mr_clement": { name: "Mr. Clement", look: L("the_maker", S.honey, BLACK_HAIR, ["#56606a", "#2b2b2b", "#2b2b2b", "#2b2b2b"], "cap", "#2f8a4c"), extras: ["glasses"] },
  "npc.muhammad": { name: "Muhammad", look: L("muhammad", S.tan, BLACK_HAIR, ["#fbfbf8", "#2b2b2b", "#2b2b2b", "#2b2b2b"]) },
  "npc.garba": { name: "Malam Garba", look: L("muhammad", S.tan, GREY_HAIR, ["#8a5a3a", "#8a5a3a", "#2b2b2b", "#2b2b2b"], "cap", "#f4f1ea"), height: 0.95, extras: ["ledger"] },
  "npc.idris": { name: "Idris", look: L("the_maker", S.honey, BLACK_HAIR, ["#56606a", "#2b2b2b", "#1f3c66", "#2b2b2b"]) },
  "npc.needle": { name: "Alhaji Needle", look: L("the_maker", S.tan, GREY_HAIR, ["#e9e4d8", "#e9e4d8", "#2b2b2b", "#2b2b2b"], "cap", "#2f8a4c"), extras: ["glasses"] },
  "npc.mubarak": { name: "Mubarak", look: L("bature", S.deep, BLACK_HAIR, ["#e0a526", "#a83232", "#1f3c66", "#f4f1ea"]), extras: ["sunglasses", "bumbag"] },
  "npc.lyzzy": { name: "Lyzzy", look: L("taty", S.caramel, BLACK_HAIR, ["#e98a8a", "#f4f1ea", "#d9622b", "#f4f1ea"]), extras: ["camera"] },
  "npc.lily": { name: "Lily", look: L("taty", S.caramel, BLACK_HAIR, ["#2f8a4c", "#e9e4d8", "#c9b896", "#8a5a3a"]) },
  "npc.maryam": { name: "Maryam", look: L("zainab", S.light, BLACK_HAIR, ["#3e8e9e", "#2b2b2b", "#8a5a3a", "#8a5a3a"], "hijab", "#3e8e9e"), extras: ["bag"] },
  "npc.law_lecturer": { name: "Law lecturer", look: L("the_maker", S.honey, GREY_HAIR, ["#2b2b2b", "#2b2b2b", "#2b2b2b", "#2b2b2b"], "cap", "#2b2b2b"), extras: ["glasses"] },
  "npc.shamsu": { name: "Shamsu", look: L("muhammad", S.honey, BLACK_HAIR, ["#f4f1ea", "#f4f1ea", "#2b2b2b", "#2b2b2b"], "cap", "#f4f1ea"), extras: ["glasses", "pens"] },
  "npc.nusaiba": { name: "Nusaiba", look: L("zainab", S.light, BLACK_HAIR, ["#1f3c66", "#2b2b2b", "#2b2b2b", "#2b2b2b"], "hijab", "#e9e4d8"), extras: ["folder"] },
  "npc.okonkwo": { name: "Dr. Okonkwo", look: L("zainab", S.caramel, BLACK_HAIR, ["#7a2e3b", "#e9e4d8", "#d4af37", "#7a2e3b"], "cap", "#7a2e3b"), extras: ["glasses"] },
  "npc.wednesday": { name: "Wednesday", look: L("taty", S.light, BROWN_HAIR, ["#56606a", "#2b2b2b", "#e9e4d8", "#2b2b2b"]) },
  "npc.abbas": { name: "Abbas", look: L("bature", S.honey, BLACK_HAIR, ["#2a5fa8", "#e9e4d8", "#1f3c66", "#2a5fa8"]) },
  "npc.mai_shayi": { name: "Mai Shayi Audu", look: L("muhammad", S.tan, GREY_HAIR, ["#c9b896", "#c9b896", "#2b2b2b", "#2b2b2b"], "cap", "#7a2e3b"), height: 0.96 },
  "npc.maker": { name: "The Maker", look: L("the_maker", S.light, GREY_HAIR, ["#c9ccc8", "#56606a", "#2b2b2b", "#2b2b2b"], "cap", "#56606a"), extras: ["labcoat"] },
  "npc.tanko": { name: "Tanko", look: L("bature", S.tan, BLACK_HAIR, ["#8a5a3a", "#c9b896", "#4f4a36", "#2b2b2b"], "cap", "#c9b896") },
  "npc.bolaji": { name: "Big Sly", look: L("the_maker", S.tan, BLACK_HAIR, ["#2b2b2b", "#a83232", "#2b2b2b", "#2b2b2b"]), height: 1.06, width: 1.18 },
  "npc.hassan": { name: "Hassan", look: L("muhammad", S.honey, BLACK_HAIR, ["#86b7e0", "#56606a", "#2b2b2b", "#2b2b2b"], "cap", "#56606a"), height: 0.98, extras: ["notebook"] },
  "npc.big_baby": { name: "Big Baby", look: L("zainab", S.medium, BLACK_HAIR, ["#e98a8a", "#2b2b2b", "#d4af37", "#2b2b2b"], "hijab", "#2b2b2b"), height: 0.94, extras: ["apron"] },
  "npc.jega": { name: "Jega", look: L("bature", S.tan, BLACK_HAIR, ["#2f8a4c", "#f4f1ea", "#f4f1ea", "#2b2b2b"]), height: 1.05, extras: ["jersey10"] },
  "npc.danladi": { name: "Coach Danladi", look: L("muhammad", S.tan, BLACK_HAIR, ["#a83232", "#2b2b2b", "#2b2b2b", "#2b2b2b"], "cap", "#2b2b2b"), extras: ["whistle"] },
  "npc.helen": { name: "Helen", look: L("taty", S.caramel, BLACK_HAIR, ["#2a5fa8", "#2b2b2b", "#f4f1ea", "#f4f1ea"]), height: 0.95, extras: ["volleyball"] },
  "npc.hauwa": { name: "Nurse Hauwa", look: L("zainab", S.medium, BLACK_HAIR, ["#f4f1ea", "#86b7e0", "#86b7e0", "#f4f1ea"], "hijab", "#f4f1ea") },
  "npc.zainab": { name: "Dr. Zainab", look: L("zainab", S.veryFair, BLACK_HAIR, ["#3e8e9e", "#3e8e9e", "#f4f1ea", "#f4f1ea"], "hijab", "#2b2b2b"), extras: ["stethoscope", "torch"] },
  "npc.hajiya_ladi": { name: "Hajiya Ladi", look: L("zainab", S.medium, BLACK_HAIR, ["#5b4ba8", "#e0a526", "#d4af37", "#e0a526"], "hijab", "#e0a526") },
  "npc.kb": { name: "KB", look: L("bature", S.honey, BLACK_HAIR, ["#56606a", "#e9e4d8", "#2b2b2b", "#2b2b2b"]) },
  "npc.sophomore": { name: "Customer", look: L("the_maker", S.caramel, BLACK_HAIR, ["#3e8e9e", "#f4f1ea", "#2b2b2b", "#2b2b2b"]) },
  "npc.sug_porter": { name: "SUG porter", look: L("muhammad", S.tan, GREY_HAIR, ["#1f6b52", "#2b2b2b", "#2b2b2b", "#2b2b2b"], "cap", "#f4f1ea") },
  "crowd.students": { name: "A senior", look: L("bature", S.caramel, BLACK_HAIR, ["#2b2b2b", "#d9622b", "#56606a", "#f4f1ea"]), extras: ["phone"] },
  // Special characters (only ever in [IF special.x] blocks; placeholders until each person approves her look).
  "special.jiya": { name: "Jiya", look: L("jiya", S.fair, "#e8c3a0", ["#ff6b6b", "#4ecdc4", "#f1f1f1", "#f1f1f1"], "cap", "#ff6b6b"), height: 1.05, extras: ["sunglasses"] },
  "special.taty": { name: "Taty", look: L("taty", S.fair, BLACK_HAIR, ["#2b2b2b", "#2b2b2b", "#e98a8a", "#f4f1ea"]) },
  "special.madison": { name: "Madison", look: L("taty", S.fair, BLACK_HAIR, ["#f4f1ea", "#5b4ba8", "#f2c230", "#2b2b2b"]), extras: ["phone"] },
};

/** Cast id for a character, resolving the roommate by the player's sex. */
export function castKey(castId: string, playerFemale: boolean): string {
  if (castId === "npc.roomie") return playerFemale ? "npc.roomie.f" : "npc.roomie.m";
  return castId;
}

/** Zainab's tone is locked (plan validator LOCKED_SKIN): very fair, never dark. */
export const LOCKED_SKIN: Record<string, string> = { "npc.zainab": CAST_SKIN.veryFair };

/** Body type variants using shape keys (heavy/lean/fit morph targets). */
export const BODY_VARIANTS: Record<string, Record<string, number>> = {
  "heavy": { heavy: 1.0, lean: 0, fit: 0 },
  "lean":  { heavy: 0, lean: 1.0, fit: 0 },
  "fit":   { heavy: 0, lean: 0, fit: 1.0 },
  "mixed": { heavy: 0.3, lean: 0.3, fit: 0.4 },
};

/** Skin tone options for the character creator (respects Zainab's lock). */
export const SKIN_OPTIONS: Record<string, { name: string; hex: string }> = {
  veryFair: { name: "Snow White", hex: S.veryFair },
  fair:     { name: "Fair", hex: S.fair },
  light:    { name: "Light", hex: S.light },
  honey:    { name: "Honey", hex: S.honey },
  caramel:  { name: "Caramel", hex: S.caramel },
  medium:   { name: "Medium", hex: S.medium },
  tan:      { name: "Tan", hex: S.tan },
  deep:     { name: "Deep", hex: S.deep },
};

/** Hair color options. */
export const HAIR_OPTIONS: Record<string, { name: string; hex: string }> = {
  black:  { name: "Black", hex: BLACK_HAIR },
  brown:  { name: "Brown", hex: BROWN_HAIR },
  grey:   { name: "Grey", hex: GREY_HAIR },
  red:    { name: "Red", hex: RED_HAIR },
  blond:  { name: "Blond", hex: BLOND_HAIR },
};
