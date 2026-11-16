/**
 * Builds the sound inventory: one JSON per game in src/games/sounds/inventory/.
 *
 *   npx tsx apps/web/scripts/gen-sound-inventory.ts          (from the repo root)
 *   npx tsx apps/web/scripts/gen-sound-inventory.ts --dump   (also print every call site)
 *
 * It reads each legacy game's scripts (from packages/db/seed/games.catalogue.json:
 * entry + dependencies + level packs), the shared runtime and
 * public/play/_shared/audio/sfx/manifest.json, and writes what each game plays,
 * where, and how (src/games/sounds/extract.ts does the work). The names and
 * "where it is used" text come from src/games/sounds/catalog.ts.
 *
 * A game that is not one of the old EE Hub games (e.g. Work in Progress) can
 * ship its own inventory: drop `<slug>.json` in that folder with kind
 * "registered" (same shape); this script never overwrites a registered file.
 * Dev tool only: it uses node:fs, which never runs on the server.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY_GAMES, LEGACY_RUNTIME, legacyScripts } from "../src/games/legacy.ts";
import { GAME_EXTRA, GAME_USAGE, GENERIC, SHARED_USAGE } from "../src/games/sounds/catalog.ts";
import { buildInventory, extractSoundCalls, parseLegacyDesc, type GenericInfo, type SfxManifest } from "../src/games/sounds/extract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../..");
const PUB = join(ROOT, "apps/web/public");
const OUT = join(ROOT, "apps/web/src/games/sounds/inventory");
const dump = process.argv.includes("--dump");

const catalogue = JSON.parse(readFileSync(join(ROOT, "packages/db/seed/games.catalogue.json"), "utf8")) as {
  slug: string;
  title: string;
  entry: string;
  meta?: { dependencies?: string[] };
}[];
const manifest = JSON.parse(readFileSync(join(PUB, "play/_shared/audio/sfx/manifest.json"), "utf8")) as SfxManifest;
const read = (url: string) => readFileSync(join(PUB, url), "utf8");
const legacyDesc = parseLegacyDesc(read("play/_shared/js/games/arcade-sounds.js"));
const generic: Record<string, GenericInfo> = {};
for (const id of new Set([...Object.keys(legacyDesc), ...Object.keys(GENERIC)])) generic[id] = { ...legacyDesc[id], ...GENERIC[id] };

// Calls the shared runtime makes for every game (dialog buttons, cheats, result stars, level-up, ceremonies).
// (The ceremony's fanfares and the crowd roar inside the champion fanfare are counted per game, from api.ceremony.)
const shared = ["arcade", "arcade-settings"]
  .flatMap((n) => extractSoundCalls(`${n}.js`, read(`play/_shared/js/games/${n}.js`)))
  .filter((c) => !/^(crowd_|fanfare_)/.test(c.id));

mkdirSync(OUT, { recursive: true });
const counts: string[] = [];
for (const g of catalogue) {
  if (!LEGACY_GAMES[g.slug]) continue;
  const target = join(OUT, `${g.slug}.json`);
  if (existsSync(target) && JSON.parse(readFileSync(target, "utf8")).kind === "registered") continue;
  const urls = legacyScripts(g.slug, g.entry, g.meta?.dependencies ?? []).filter(
    (u) => !(LEGACY_RUNTIME as readonly string[]).some((r) => u.endsWith(`/js/games/${r}.js`)),
  );
  const scripts = urls.filter((u) => existsSync(join(PUB, u))).map((u) => ({ file: u.split("/").pop()!, text: read(u) }));
  const inv = buildInventory({
    slug: g.slug,
    title: g.title,
    scripts,
    shared,
    manifest,
    generic,
    usage: GAME_USAGE[g.slug],
    sharedUsage: SHARED_USAGE,
    extra: GAME_EXTRA[g.slug],
  });
  writeFileSync(target, JSON.stringify(inv, null, 1) + "\n");
  counts.push(`${g.slug}: ${inv.sounds.length}`);
  if (dump) {
    console.log(`\n## ${g.slug}`);
    for (const s of inv.sounds) {
      const own = s.calls.filter((c) => !c.file.startsWith("arcade"));
      console.log(`  ${s.id} [${s.group}/${s.source}] ${own.map((c) => `${c.file}:${c.line}${c.fn ? " " + c.fn : ""}`).join(", ")}`);
    }
  }
}
console.log(counts.join("\n"));
