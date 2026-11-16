/**
 * The Node platform: used by `npm run dev`, the tests and the scripts
 * (seed, migrate). Never part of the Cloudflare build (see ./types.ts).
 *
 *   database  a SQLite file (DATABASE_FILE, default apps/web/.data/dev.sqlite)
 *   uploads   files under apps/web/.data/uploads/ (git-ignored)
 *   settings  process.env, plus the repo-root .env file
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { AppDb } from "@mib/db";
import { createSqliteDb, migrateSqlite } from "@mib/db/sqlite";
import { isSafeKey, type BlobStore } from "./types.ts";

export type { BlobStore } from "./types.ts";

export const PLATFORM = "node" as const;

/** Walk up from the current folder to the repo root (the folder with package-lock.json). */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, "package-lock.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export const REPO_ROOT = findRepoRoot(process.cwd());

try {
  // Node 21.7+ built-in .env loader. Values already in the environment win.
  process.loadEnvFile(resolve(REPO_ROOT, ".env"));
} catch {
  /* no .env file: defaults apply */
}

/** Read a setting (environment variable). */
export function readVar(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const isProd = process.env.NODE_ENV === "production";

/** Where the SQLite file lives (absolute path). */
export const databaseFile = (() => {
  const file = process.env.DATABASE_FILE || "apps/web/.data/dev.sqlite";
  return isAbsolute(file) ? file : resolve(REPO_ROOT, file);
})();

/** Open the local SQLite database. In development, new migrations are applied automatically. */
export function openDb(): AppDb {
  const db = createSqliteDb(databaseFile);
  // (import.meta.env is Astro/Vite's; it is missing when a script runs under tsx.)
  const isDev = import.meta.env?.DEV ?? !isProd;
  if (isDev) migrateSqlite(db);
  return db;
}

export const UPLOAD_DIR = resolve(REPO_ROOT, "apps/web/.data/uploads");

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

/** An ETag for a file on disk: its size and last-changed time. */
function fileEtag(size: number, mtimeMs: number): string {
  return `"${size.toString(36)}-${Math.floor(mtimeMs).toString(36)}"`;
}

/** Uploads as plain files in a folder. */
export function folderBlobStore(root: string): BlobStore {
  return {
    async put(key, bytes) {
      if (!isSafeKey(key)) throw new Error(`Bad upload key: ${key}`);
      await mkdir(dirname(join(root, key)), { recursive: true });
      await writeFile(join(root, key), bytes);
    },
    async get(key) {
      if (!isSafeKey(key)) return null;
      const contentType = TYPES[key.split(".").pop() ?? ""];
      if (!contentType) return null;
      try {
        const [info, bytes] = await Promise.all([stat(join(root, key)), readFile(join(root, key))]);
        return { bytes: new Uint8Array(bytes), contentType, etag: fileEtag(info.size, info.mtimeMs) };
      } catch {
        return null;
      }
    },
    async stat(key) {
      if (!isSafeKey(key)) return null;
      const contentType = TYPES[key.split(".").pop() ?? ""];
      if (!contentType) return null;
      try {
        const info = await stat(join(root, key));
        return { contentType, size: info.size, etag: fileEtag(info.size, info.mtimeMs) };
      } catch {
        return null;
      }
    },
    async delete(key) {
      if (!isSafeKey(key)) return;
      await unlink(join(root, key)).catch(() => undefined);
    },
  };
}

export const blobs: BlobStore = folderBlobStore(UPLOAD_DIR);

/** Where the public folder can be, in dev (`apps/web`, repo root) and in a Node build. */
const PUBLIC_ROOTS = [
  join(process.cwd(), "public"),
  join(process.cwd(), "apps", "web", "public"),
  join(process.cwd(), "dist", "client"),
  join(process.cwd(), "apps", "web", "dist", "client"),
];

/** True when public/<path> exists (e.g. "games/maze/cover.jpg"). */
export function hasPublicFile(path: string): boolean {
  return PUBLIC_ROOTS.some((root) => existsSync(join(root, path)));
}
