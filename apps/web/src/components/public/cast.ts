/**
 * Public-facing words for the open-world cast.
 *
 * The `bio` and `voice` columns in the database are casting notes for the
 * voice actors ("Male, about twenty; …"), so the website never prints them.
 * This file gives each character a short public tagline and, where they have
 * one, a signature line. A character missing here still shows: it falls back
 * to its `role` column and its group's label.
 */
import type { Character } from "@mib/db";
import { specialAllowed } from "../shell/art.ts";

export interface CastProfile {
  /** Short public role, e.g. "The footballer". */
  role: string;
  /** A line they are known for (shown as a quote). */
  line?: string;
  /** Where on campus you are likely to find them. */
  where?: string;
}

const PROFILES: Record<string, CastProfile> = {
  "npc.bature": { role: "Your roommate", line: "Riddle me this.", where: "Your room, and later the radio studio" },
  "npc.firdausi": { role: "Your roommate", line: "Oya, let's move.", where: "Your room and the microbiology lab" },
  "npc.jega": { role: "The footballer", line: "Left boot first.", where: "The football pitch" },
  "npc.mubarak": { role: "The hustler", line: "Trust the Plug.", where: "The Plug, his one-man store" },
  "npc.nusaiba": { role: "The organiser", line: "Point one.", where: "The Law faculty, minutes in hand" },
  "npc.shamsu": { role: "The genius", line: "Simple. Technically…", where: "The engineering labs" },
  "npc.zainab": { role: "The doctor", line: "Doctor's orders.", where: "The teaching hospital" },
  "npc.maker": { role: "The keeper of the coil", where: "Nobody is quite sure" },
  "npc.muhammad": { role: "A quiet young man in a white shirt", where: "Wherever you need him" },
  "special.jiya": { role: "The lawyer who became an engineer", line: "With respect, and I mean none." },
  "special.madison": { role: "Fast talk, faster feet", line: "Wait wait wait, film this." },
  "special.taty": { role: "Never tired, usually winning", line: "Bora!" },
  "special.mib": { role: "Kind, quiet, and three letters at the top of every table" },
  "npc.abbas": { role: "The mechanic", line: "Not John Carter.", where: "The workshop" },
  "npc.aleeya": { role: "Architecture student", line: "Every compliment ends in a punchline.", where: "The design studios" },
  "npc.aliyu": { role: "The works engineer", line: "It's complicated.", where: "The works yard" },
  "npc.baba_dam": { role: "The old fisherman", line: "Fish don't hurry.", where: "Kwari Dam" },
  "npc.baba_porter": { role: "The hall porter", where: "Your hall's front desk" },
  "npc.big_baby": { role: "Salon owner", where: "The market" },
  "npc.bilkisu": { role: "Head of campus security", line: "You. Yes, you.", where: "Everywhere you should not be" },
  "npc.bolaji": { role: "The gentle giant", line: "Sly is sorry.", where: "The market" },
  "npc.dad": { role: "Your father", line: "When I was your age…", where: "On the phone" },
  "npc.danladi": { role: "The football coach", line: "Is the ball your inheritance?", where: "The football pitch" },
  "npc.dr_minus": { role: "Law lecturer", line: "Minus two.", where: "Lecture theatre, red pen ready" },
  "npc.emily": { role: "Crop Science student", line: "Strawberry?", where: "Her family's strawberry farm" },
  "npc.faty": { role: "Keeper of the joke book", where: "On the bench beside Lula" },
  "npc.garba": { role: "The senate porter", line: "Hm.", where: "The senate building door" },
  "npc.hajiya_ladi": { role: "Head of the market traders", where: "The market" },
  "npc.hauwa": { role: "The night nurse", line: "Doctor is coming. Sit.", where: "The teaching hospital, after dark" },
  "npc.helen": { role: "Volleyball captain", line: "Who's asking?", where: "The volleyball court" },
  "npc.kabiru": { role: "The radio station head", line: "You're on the Ring Road.", where: "Ring Road FM" },
  "npc.kaka": { role: "The ranger's grandmother", where: "The forest edge" },
  "npc.kb": { role: "The corner-shop owner", line: "Price by face, price by mood.", where: "His corner shop" },
  "npc.kelechi": { role: "The sculptor", line: "Clay doesn't rush.", where: "The Fine Arts studios" },
  "npc.khadija": { role: "Your level adviser", line: "My office. Now. Bring yourself.", where: "The department office" },
  "npc.lawal": { role: "The forest ranger", line: "Follow my light.", where: "The forest reserve" },
  "npc.lily": { role: "The botanist", line: "…", where: "The greenhouse" },
  "npc.lula": { role: "The storyteller", line: "I mean left. Emotionally.", where: "On the bench beside Faty" },
  "npc.lyzzy": { role: "Campus TV reporter", line: "We saw it first.", where: "Wherever the story is" },
  "npc.mai_shayi": { role: "The tea seller", line: "Tea first. Gist second.", where: "His tea stall" },
  "npc.mama_nkechi": { role: "The buka owner", where: "Her buka, pot always on" },
  "npc.maryam": { role: "The bookshop assistant", where: "The campus bookshop" },
  "npc.megawatt": { role: "The businessman", line: "Let us not be emotional. Let us be commercial.", where: "Wherever there is a deal" },
  "npc.mrs_adebayo": { role: "The registry clerk", line: "Four passports.", where: "Behind the registry window" },
  "npc.mum": { role: "Your mother", line: "Have you eaten?", where: "On the phone" },
  "npc.ngozi": { role: "The gym trainer", line: "Garri is not a food group.", where: "The gym" },
  "npc.okonkwo": { role: "Lecturer", line: "Page forty.", where: "The lecture theatre" },
  "npc.pastor_sam": { role: "The chapel pastor", line: "Ask him.", where: "The chapel, or the football" },
  "npc.tanko": { role: "The riddler", line: "Which?", where: "The garden gate" },
  "npc.tunde": { role: "The quiet artist", where: "The Fine Arts studios" },
  "npc.ustaz_auwal": { role: "The mosque teacher", line: "No, ask him.", where: "The mosque, or the suya spot" },
  "npc.wednesday": { role: "Someone you only meet on Wednesdays", where: "Ask again next Wednesday" },
};

export const GROUPS = [
  { kind: "lead", label: "The leads", short: "Lead", icon: "star" },
  { kind: "special", label: "Guest stars", short: "Guest star", icon: "sparkles" },
  { kind: "friend", label: "Friends", short: "Friend", icon: "heart" },
  { kind: "staff", label: "Staff and lecturers", short: "Staff", icon: "landmark" },
  { kind: "recurring", label: "Around campus", short: "Regular", icon: "map-pin" },
  { kind: "family", label: "Family", short: "Family", icon: "home" },
  { kind: "mystery", label: "Mysteries", short: "Mystery", icon: "ghost" },
  { kind: "public", label: "Everyone else", short: "Cast", icon: "users" },
] as const;

export type GroupKind = (typeof GROUPS)[number]["kind"];

export function groupOf(kind: string) {
  return GROUPS.find((g) => g.kind === kind) ?? GROUPS[GROUPS.length - 1]!;
}

/** The public profile of a character: never the casting notes. */
export function castProfile(c: Pick<Character, "key" | "role" | "kind">): CastProfile {
  const known = PROFILES[c.key];
  if (known) return known;
  // The role column is written for players ("The footballer"); strip stage notes in brackets.
  const role = c.role.replace(/\s*\(.*\)$/, "").trim();
  return { role: role || groupOf(c.kind).short };
}

/** "npc.jega" -> "jega"; "special.jiya" -> "jiya"; "npc.mai_shayi" -> "mai-shayi". */
export function charSlug(key: string): string {
  return key.replace(/^[a-z]+\./, "").replace(/_/g, "-");
}

/** The keys a /characters/<slug> URL can mean, most likely first. */
export function keysForSlug(slug: string): string[] {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return [];
  const tail = slug.replace(/-/g, "_");
  return [`npc.${tail}`, `special.${tail}`];
}

/**
 * The characters the public may see: enabled (the repo already filters that),
 * not the player's own "Your roommate" slot, and special characters only when
 * they have approved and their switch is on (the same rule as the home page).
 */
export function publicCast<T extends Pick<Character, "key" | "name" | "kind" | "approved">>(
  all: T[],
  specials: Record<string, boolean>,
): T[] {
  return all.filter(
    (c) =>
      !/^your /i.test(c.name) &&
      (c.kind !== "special" || c.approved) &&
      specialAllowed(c.name, specials) &&
      specialAllowed(c.key, specials),
  );
}
