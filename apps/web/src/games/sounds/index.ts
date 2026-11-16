/**
 * The sound inventory of every game: which sounds it plays, where, and how.
 *
 * Each game's list is a JSON file in ./inventory/ (generated for the old EE
 * Hub games by scripts/gen-sound-inventory.ts). A new game registers its own
 * sounds by adding `inventory/<slug>.json` with `"kind": "registered"` (the
 * generator never overwrites those), or at run time with
 * registerSoundInventory() from its own module.
 */
import { SOUND_ID_RE, type GameSoundInventory, type SoundEntry } from "./extract.ts";

export { SOUND_GROUPS, type GameSoundInventory, type SoundEntry, type SoundGroup, type SoundSource } from "./extract.ts";

const files = import.meta.glob<GameSoundInventory>("./inventory/*.json", { eager: true, import: "default" });
const bySlug = new Map<string, GameSoundInventory>();
for (const inv of Object.values(files)) if (inv?.slug) bySlug.set(inv.slug, inv);

/** Add (or replace) a game's sound list. Ids that are not valid sound names are dropped. */
export function registerSoundInventory(inv: GameSoundInventory): void {
  bySlug.set(inv.slug, { ...inv, sounds: inv.sounds.filter((s) => SOUND_ID_RE.test(s.id)) });
}

export function soundInventory(slug: string): GameSoundInventory | null {
  return bySlug.get(slug) ?? null;
}

export function soundEntry(slug: string, id: string): SoundEntry | null {
  return bySlug.get(slug)?.sounds.find((s) => s.id === id) ?? null;
}

/** Every game with a sound list, and how many sounds each has. */
export function soundInventoryCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [slug, inv] of bySlug) out[slug] = inv.sounds.length;
  return out;
}
