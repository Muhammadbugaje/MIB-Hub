/**
 * Vite plugin: the game's story data comes straight from the writers' files.
 *
 *   import story from "virtual:wip-story";
 *
 * At build (and dev) time this reads, from the repo's docs:
 *   - docs/plan/missions/Y1.md          -> missions M1..M10, parsed by src/story/parse.ts
 *   - docs/voice/barks/*.md             -> Filler and Year 1 barks for the crowd and the cast in M1..M10
 *   - docs/voice/scripts/*.lines.json   -> which character file each line id belongs to
 *   - assets/voice/*.ogg|*.mp3          -> recorded voice lines that exist (named by line id)
 *
 * and hands the game one JSON module. Editing Y1.md and rebuilding changes the
 * game; nothing is retyped. Dev mode watches the files and reloads.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { parseBarks, parseMissionFile, type BarkPack } from "../src/story/parse.ts";

const ID = "virtual:wip-story";
const RID = "\0" + ID;

/** How many missions of Year 1 the game plays (the first ten, in story order). */
export const PLAYABLE = 10;

/** Bark packs used: the public groups heard around campus in Year 1, and the named cast of M1..M10. */
export const BARK_PACKS = [
  "public_freshers", "public_students", "public_traders", "public_hostel", "public_security", "public_riders", "public_town", "public_lecturers", "public_hospital", "public_fans",
  "roomie", "jega", "shamsu", "mubarak", "nusaiba", "zainab", "aleeya", "lyzzy", "lily", "maryam", "abbas", "bolaji", "big_baby", "mai_shayi", "mama_nkechi", "baba_porter", "kb", "hajiya_ladi", "hauwa", "okonkwo", "garba", "mrs_adebayo", "tanko", "wednesday", "danladi", "helen", "maker", "muhammad",
];

export interface StoryBundle {
  missions: ReturnType<typeof parseMissionFile>;
  barks: Record<string, BarkPack>;
  /** line id -> voice script name (e.g. "m001_film_03" -> "mum"). */
  lineOwner: Record<string, string>;
  /** Line ids with a recorded file in assets/voice/ (extension included). */
  recorded: Record<string, string>;
}

export function loadStory(repo: string, gameDir: string): StoryBundle {
  const y1 = readFileSync(join(repo, "docs/plan/missions/Y1.md"), "utf8");
  const missions = parseMissionFile(y1, "Y1.md").filter((m) => m.num <= PLAYABLE);
  const barks: Record<string, BarkPack> = {};
  for (const name of BARK_PACKS) {
    const f = join(repo, "docs/voice/barks", `${name}.md`);
    if (!existsSync(f)) continue;
    const pack = parseBarks(readFileSync(f, "utf8"));
    // Only what fits Year 1: the filler and the Year 1 stage (no spoilers from later years).
    pack.barks = pack.barks.filter((b) => b.stage === "Filler" || b.stage === "Year 1");
    barks[name] = pack;
  }
  const lineOwner: Record<string, string> = {};
  const sdir = join(repo, "docs/voice/scripts");
  if (existsSync(sdir))
    for (const f of readdirSync(sdir).filter((n) => n.endsWith(".lines.json"))) {
      const data = JSON.parse(readFileSync(join(sdir, f), "utf8")) as { sections?: { lines?: { id: string }[] }[] };
      for (const s of data.sections ?? []) for (const l of s.lines ?? []) if (/^m0(0\d|10)_/.test(l.id)) lineOwner[l.id] = f.replace(".lines.json", "");
    }
  const recorded: Record<string, string> = {};
  const vdir = join(gameDir, "assets/voice");
  if (existsSync(vdir)) for (const f of readdirSync(vdir)) {
    const m = /^(.+)\.(ogg|mp3|m4a)$/.exec(f);
    if (m) recorded[m[1]!] = f;
  }
  return { missions, barks, lineOwner, recorded };
}

export function storyPlugin(): Plugin {
  const gameDir = resolve(__dirname, "..");
  const repo = resolve(gameDir, "../..");
  return {
    name: "wip-story",
    resolveId: (id) => (id === ID ? RID : null),
    load(id) {
      if (id !== RID) return null;
      this.addWatchFile(join(repo, "docs/plan/missions/Y1.md"));
      return `export default ${JSON.stringify(loadStory(repo, gameDir))};`;
    },
  };
}
