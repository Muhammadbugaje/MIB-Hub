/**
 * Writes the offline-download manifests: public/offline/games/<slug>.json
 * (one per game that can be downloaded) and public/offline/games/index.json.
 *
 *   npm run offline:manifest -w @mib/web      (also runs before dev and build)
 *
 * The rules (which files a game needs) are in src/offline/manifest.ts. This
 * script only reads the files, hashes them and writes the JSON. It fails if a
 * file is missing or is 25 MiB or bigger (Cloudflare's static file limit).
 * The output folder is git-ignored: it is rebuilt every time.
 *
 * Build-time only (Node): never imported by the site at run time.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CONTRACT_OFFLINE,
  MANIFEST_DIR,
  buildIndex,
  buildManifest,
  contractGameUrls,
  legacyGameUrls,
  type GameManifest,
  type SfxManifest,
} from "../src/offline/manifest.ts";
import { isLegacyGame } from "../src/games/legacy.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = resolve(HERE, "../public");
export const CATALOGUE = resolve(HERE, "../../../packages/db/seed/games.catalogue.json");

interface CatalogueEntry {
  slug: string;
  title: string;
  entry: string;
  meta?: { dependencies?: unknown };
}

/** Read every game's manifest from the files under `publicDir`. */
export function collectManifests(publicDir = PUBLIC_DIR, cataloguePath = CATALOGUE): GameManifest[] {
  const catalogue = JSON.parse(readFileSync(cataloguePath, "utf8")) as CatalogueEntry[];
  const cache = new Map<string, { bytes: number; hash: string } | null>();
  const fileOf = (url: string) => join(publicDir, decodeURIComponent(url.split("?")[0]!));
  const stat = (url: string) => {
    if (!cache.has(url)) {
      const p = fileOf(url);
      let v: { bytes: number; hash: string } | null = null;
      if (existsSync(p) && statSync(p).isFile()) {
        const buf = readFileSync(p);
        v = { bytes: buf.length, hash: createHash("sha256").update(buf).digest("hex").slice(0, 20) };
      }
      cache.set(url, v);
    }
    return cache.get(url)!;
  };
  const listDir = (dirUrl: string): string[] => {
    const root = fileOf(dirUrl);
    if (!existsSync(root)) return [];
    const out: string[] = [];
    const walk = (abs: string, url: string) => {
      for (const name of readdirSync(abs).sort()) {
        const a = join(abs, name);
        if (statSync(a).isDirectory()) walk(a, `${url}${name}/`);
        else out.push(`${url}${name}`);
      }
    };
    walk(root, dirUrl);
    return out;
  };
  const sfxPath = join(publicDir, "play/_shared/audio/sfx/manifest.json");
  const sfx = existsSync(sfxPath) ? (JSON.parse(readFileSync(sfxPath, "utf8")) as SfxManifest) : null;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");

  const out: GameManifest[] = [];
  for (const g of catalogue) {
    if (!isLegacyGame(g.slug)) continue;
    const wanted = legacyGameUrls({ slug: g.slug, entry: g.entry, dependencies: g.meta?.dependencies }, sfx, listDir);
    out.push(buildManifest(g, wanted, stat, hash));
  }
  for (const [slug, opt] of Object.entries(CONTRACT_OFFLINE)) {
    out.push(buildManifest({ slug, title: opt.title }, contractGameUrls(slug, listDir), stat, hash));
  }
  return out;
}

/** Write the manifests (and remove ones for games that are gone). */
export function writeManifests(manifests: GameManifest[], publicDir = PUBLIC_DIR): string {
  const dir = join(publicDir, MANIFEST_DIR);
  mkdirSync(dir, { recursive: true });
  const keep = new Set(["index.json", ...manifests.map((m) => `${m.slug}.json`)]);
  for (const f of readdirSync(dir)) if (f.endsWith(".json") && !keep.has(f)) rmSync(join(dir, f));
  for (const m of manifests) writeFileSync(join(dir, `${m.slug}.json`), JSON.stringify(m) + "\n");
  writeFileSync(join(dir, "index.json"), JSON.stringify(buildIndex(manifests), null, 1) + "\n");
  return dir;
}

const mb = (b: number) => `${(b / 1048576).toFixed(2)} MB`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifests = collectManifests();
  const dir = writeManifests(manifests);
  if (process.argv.includes("--table")) {
    console.log("| Game | Files | Download (Chrome, Firefox: .ogg) | Download (Safari: .m4a) |\n|---|---:|---:|---:|");
    for (const m of manifests) {
      const files = m.files.filter((f) => !f.variant || f.variant === "ogg").length;
      console.log(`| ${m.title} | ${files} | ${mb(m.bytes.ogg)} | ${mb(m.bytes.m4a)} |`);
    }
  }
  console.log(`offline manifests: ${manifests.length} games written to ${dir}`);
}
