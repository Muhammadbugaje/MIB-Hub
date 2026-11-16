/**
 * Offline downloads: which files one game needs to run with no internet.
 *
 * `npm run offline:manifest` (also run before `dev` and `build`) writes one
 * small JSON file per game to public/offline/games/<slug>.json, plus
 * index.json. The "Download for offline" button (public/offline/mib-offline.js)
 * reads it, fetches every file into the browser's Cache Storage, and the
 * service worker (public/sw.js) serves them when the network is gone.
 *
 * A manifest lists:
 *   - the files the game itself needs: the shared arcade runtime, the game's
 *     scripts and level packs, its sounds (in both .ogg and .m4a: the browser
 *     downloads only the kind it can play), three.js for the 3D game, the play
 *     bridge, the offline client and the game's icon;
 *   - `page`: the play page. It is fetched at download time, and the files it
 *     links to (the site's hashed CSS, fonts and island scripts in /_astro/)
 *     are found then, because their names change with every build.
 *
 * Every file has a content hash; the manifest's `version` is a hash of all of
 * them, so any change to any file shows "Update available" to players who
 * downloaded the game.
 *
 * This file is pure (no file system): scripts/offline-manifest.ts feeds it.
 */
import { LEGACY_BASE, LEGACY_GAMES, legacyScripts } from "../games/legacy.ts";

/** Cloudflare's static hosting refuses files of 25 MiB or more. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const MANIFEST_SCHEMA = 1;

/** Where the manifests are published (under public/). */
export const MANIFEST_DIR = "/offline/games/";

/** Sound formats: each sound exists in both; a browser keeps only one. */
export type AudioVariant = "ogg" | "m4a";
export const AUDIO_VARIANTS: readonly AudioVariant[] = ["ogg", "m4a"];

export interface ManifestFile {
  url: string;
  bytes: number;
  /** Content hash (hex). */
  hash: string;
  /** Only for sounds: the browser downloads one variant. */
  variant?: AudioVariant;
}

export interface GameManifest {
  schema: typeof MANIFEST_SCHEMA;
  slug: string;
  title: string;
  icon: string;
  /** The play page; cached at download time, with what it links to. */
  page: string;
  /** Changes whenever any file changes. */
  version: string;
  files: ManifestFile[];
  /** Total size of `files` for a browser that plays .ogg, or .m4a (the page and /_astro files come on top). */
  bytes: Record<AudioVariant, number>;
}

/** Every file every offline game needs, whatever the game. */
export const OFFLINE_CORE = ["/offline/mib-sync.js", "/offline/mib-offline.js", "/offline.html", "/favicon.svg"] as const;

/** The legacy (EE Hub) games also need the play bridge and the games stylesheet. */
export const LEGACY_PAGE_FILES = [`${LEGACY_BASE}mib/mib-play.js`, `${LEGACY_BASE}css/games.css`] as const;

export const SFX_BASE = `${LEGACY_BASE}audio/sfx/`;
export const THREE_URL = `${LEGACY_BASE}vendor/three@0.158.0/build/three.module.min.js`;

/**
 * Extra files a legacy game loads by itself (not through the play page's
 * script list). Folders end in "/" and are taken whole.
 */
export const LEGACY_EXTRAS: Record<string, string[]> = {
  // Freshers School Life: the intro's score and narration, and the voice manifests.
  "samaru-days": [THREE_URL, `${LEGACY_BASE}audio/fslg-intro/`, `${LEGACY_BASE}audio/voice/`],
};

/**
 * Games built on the TypeScript contract (src/games/contract.ts) are offered
 * for download only once they opt in here, with the static folders or files
 * they load at run time. Their code in /_astro/ is found from the play page.
 *
 * To let Work in Progress opt in later (its build lives in
 * public/play/work-in-progress/):
 *
 *   "work-in-progress": { title: "Work in Progress", files: ["/play/work-in-progress/"] },
 *
 * (Check first that no file in that folder is 25 MiB or more.)
 */
export const CONTRACT_OFFLINE: Record<string, { title: string; files: string[] }> = {};

/** The parts of the sound manifest (public/play/_shared/audio/sfx/manifest.json) used here. */
export interface SfxManifest {
  core?: Record<string, { f?: string[] }>;
  packs?: Record<string, Record<string, { f?: string[] }>>;
}

/** One entry of what a game needs, before sizes and hashes are known. */
export interface Wanted {
  url: string;
  variant?: AudioVariant;
}

/** Sound files are "<stem>.ogg" / "<stem>.m4a". */
export function audioVariant(url: string): AudioVariant | undefined {
  const m = /\.(ogg|m4a)$/i.exec(url);
  return m ? (m[1]!.toLowerCase() as AudioVariant) : undefined;
}

/** Every sound file a legacy game can play: the shared core set plus its own pack, in both formats. */
export function sfxUrls(slug: string, sfx: SfxManifest | null): Wanted[] {
  if (!sfx) return [];
  const stems = new Set<string>();
  const add = (group: Record<string, { f?: string[] }> | undefined) => {
    for (const e of Object.values(group ?? {})) for (const s of e.f ?? []) stems.add(s);
  };
  add(sfx.core);
  add(sfx.packs?.[slug]);
  const out: Wanted[] = [{ url: `${SFX_BASE}manifest.json` }];
  for (const stem of [...stems].sort()) {
    for (const v of AUDIO_VARIANTS) out.push({ url: `${SFX_BASE}${stem}.${v}`, variant: v });
  }
  return out;
}

/**
 * What a legacy game needs. `listDir` lists the files under a public folder
 * (recursively, as URLs) for the folder entries in LEGACY_EXTRAS.
 */
export function legacyGameUrls(
  game: { slug: string; entry: string; dependencies: unknown },
  sfx: SfxManifest | null,
  listDir: (dirUrl: string) => string[],
): Wanted[] {
  if (!LEGACY_GAMES[game.slug]) return [];
  const urls: Wanted[] = [
    ...OFFLINE_CORE.map((url) => ({ url })),
    ...LEGACY_PAGE_FILES.map((url) => ({ url })),
    { url: `/games/${game.slug}/icon.png` },
    ...legacyScripts(game.slug, game.entry, game.dependencies).map((url) => ({ url })),
    ...sfxUrls(game.slug, sfx),
  ];
  if (LEGACY_GAMES[game.slug]!.three) urls.push({ url: THREE_URL });
  for (const extra of LEGACY_EXTRAS[game.slug] ?? []) urls.push(...expand(extra, listDir));
  return urls;
}

/** What an opted-in contract game needs. */
export function contractGameUrls(slug: string, listDir: (dirUrl: string) => string[]): Wanted[] {
  const opt = CONTRACT_OFFLINE[slug];
  if (!opt) return [];
  return [...OFFLINE_CORE.map((url) => ({ url })), { url: `/games/${slug}/icon.png` }, ...opt.files.flatMap((f) => expand(f, listDir))];
}

function expand(entry: string, listDir: (dirUrl: string) => string[]): Wanted[] {
  if (!entry.endsWith("/")) return [{ url: entry, ...variantOf(entry) }];
  return listDir(entry)
    .filter((u) => !/(^|\/)\.[^/]*$/.test(u) && !/\.md$/i.test(u)) // no dotfiles, no credits/readme notes
    .map((url) => ({ url, ...variantOf(url) }));
}

function variantOf(url: string): { variant?: AudioVariant } {
  const v = audioVariant(url);
  return v ? { variant: v } : {};
}

export class ManifestError extends Error {}

/**
 * Turn a list of wanted URLs into a manifest. `stat` gives a file's size and
 * hash (null: it does not exist); `hash` hashes a string (for `version`).
 * Throws ManifestError for a missing file or one too big for static hosting.
 */
export function buildManifest(
  game: { slug: string; title: string },
  wanted: Wanted[],
  stat: (url: string) => { bytes: number; hash: string } | null,
  hash: (text: string) => string,
): GameManifest {
  const seen = new Map<string, ManifestFile>();
  for (const w of wanted) {
    if (seen.has(w.url)) continue;
    if (!w.url.startsWith("/") || w.url.includes("..")) throw new ManifestError(`${game.slug}: bad path ${w.url}`);
    const s = stat(w.url);
    if (!s) throw new ManifestError(`${game.slug}: missing file ${w.url}`);
    if (s.bytes >= MAX_FILE_BYTES) throw new ManifestError(`${game.slug}: ${w.url} is ${s.bytes} bytes (limit is under 25 MiB)`);
    seen.set(w.url, { url: w.url, bytes: s.bytes, hash: s.hash, ...(w.variant ? { variant: w.variant } : {}) });
  }
  const files = [...seen.values()].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const bytes = { ogg: 0, m4a: 0 };
  for (const f of files) for (const v of AUDIO_VARIANTS) if (!f.variant || f.variant === v) bytes[v] += f.bytes;
  const version = hash(files.map((f) => `${f.url} ${f.hash}`).join("\n")).slice(0, 16);
  return {
    schema: MANIFEST_SCHEMA,
    slug: game.slug,
    title: game.title,
    icon: `/games/${game.slug}/icon.png`,
    page: `/play/${game.slug}`,
    version,
    files,
    bytes,
  };
}

/** The list in public/offline/games/index.json. */
export interface ManifestIndex {
  schema: typeof MANIFEST_SCHEMA;
  games: { slug: string; title: string; version: string; bytes: Record<AudioVariant, number>; files: number }[];
}

export function buildIndex(manifests: GameManifest[]): ManifestIndex {
  return {
    schema: MANIFEST_SCHEMA,
    games: [...manifests]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((m) => ({ slug: m.slug, title: m.title, version: m.version, bytes: m.bytes, files: m.files.length })),
  };
}
