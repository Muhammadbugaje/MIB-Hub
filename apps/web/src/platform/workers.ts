/**
 * The Cloudflare Workers platform: the live site. Only the Cloudflare build
 * uses this file (see ./types.ts). Bindings come from apps/web/wrangler.jsonc:
 *
 *   DB       the D1 database (hosted SQLite)
 *            (also holds uploaded images and sounds: the `blob` table)
 *   vars and secrets (SITE_URL, BETTER_AUTH_SECRET...) also arrive on `env`.
 *
 * No Node file system here: everything goes through the bindings.
 */
import { env as cf } from "cloudflare:workers";
import { dbBlobStore, type AppDb, type DbBlobStore } from "@mib/db";
import { createD1Db, type D1Binding } from "@mib/db/d1";
import publicFiles from "virtual:mib-public-files";
import { isSafeKey, type BlobStore } from "./types.ts";

export type { BlobStore } from "./types.ts";

export const PLATFORM = "workers" as const;

/** There is no repo on Cloudflare; only Node scripts use this. */
export const REPO_ROOT = "/";

/** The live site is always production (secure cookies, a real secret required). */
export const isProd = true;

export const databaseFile = "(Cloudflare D1: binding DB)";

const bindings = cf as unknown as Record<string, unknown>;

/** Read a setting: a wrangler `vars` value or a secret. */
export function readVar(name: string): string | undefined {
  const v = bindings[name];
  return typeof v === "string" && v ? v : undefined;
}

export function openDb(): AppDb {
  const binding = bindings.DB as D1Binding | undefined;
  if (!binding) throw new Error('The D1 binding "DB" is missing. Check d1_databases in apps/web/wrangler.jsonc.');
  return createD1Db(binding) as unknown as AppDb;
}

/**
 * Uploads live in the D1 database itself (the `blob` table), cut into parts
 * of up to 1 MB. No R2 bucket: R2 needs a payment card, and this site's
 * uploads are few and small (images up to 4 MB, sounds up to 2 MB).
 */
let store: DbBlobStore | undefined;
const d1Blobs = (): DbBlobStore => (store ??= dbBlobStore(openDb()));

export const blobs: BlobStore = {
  async put(key, bytes, contentType) {
    if (!isSafeKey(key)) throw new Error(`Bad upload key: ${key}`);
    await d1Blobs().put(key, bytes, contentType);
  },
  async get(key) {
    if (!isSafeKey(key)) return null;
    const file = await d1Blobs().get(key);
    return file ? { bytes: file.bytes, contentType: file.contentType, etag: `"${file.sha256}"` } : null;
  },
  async stat(key) {
    if (!isSafeKey(key)) return null;
    const info = await d1Blobs().stat(key);
    return info ? { contentType: info.contentType, size: info.size, etag: `"${info.sha256}"` } : null;
  },
  async delete(key) {
    if (!isSafeKey(key)) return;
    await d1Blobs().delete(key);
  },
};

/** The files under public/games/, listed at build time (see astro.config.mjs). */
const known = new Set(publicFiles);

/** True when public/<path> was part of the build (e.g. "games/maze/cover.jpg"). */
export function hasPublicFile(path: string): boolean {
  return known.has(path);
}
