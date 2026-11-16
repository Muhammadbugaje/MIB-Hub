/**
 * The Cloudflare Workers platform: the live site. Only the Cloudflare build
 * uses this file (see ./types.ts). Bindings come from apps/web/wrangler.jsonc:
 *
 *   DB       the D1 database (hosted SQLite)
 *   UPLOADS  the R2 bucket for uploaded images and sounds
 *   vars and secrets (SITE_URL, BETTER_AUTH_SECRET...) also arrive on `env`.
 *
 * No Node file system here: everything goes through the bindings.
 */
import { env as cf } from "cloudflare:workers";
import type { AppDb } from "@mib/db";
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

/** The parts of an R2 bucket binding we use. */
interface R2Bucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

function bucket(): R2Bucket {
  const b = bindings.UPLOADS as R2Bucket | undefined;
  if (!b) throw new Error('The R2 binding "UPLOADS" is missing. Check r2_buckets in apps/web/wrangler.jsonc.');
  return b;
}

export const blobs: BlobStore = {
  async put(key, bytes, contentType) {
    if (!isSafeKey(key)) throw new Error(`Bad upload key: ${key}`);
    await bucket().put(key, bytes, { httpMetadata: { contentType } });
  },
  async get(key) {
    if (!isSafeKey(key)) return null;
    const obj = await bucket().get(key);
    if (!obj) return null;
    return { bytes: new Uint8Array(await obj.arrayBuffer()), contentType: obj.httpMetadata?.contentType ?? "application/octet-stream" };
  },
  async delete(key) {
    if (!isSafeKey(key)) return;
    await bucket().delete(key);
  },
};

/** The files under public/games/, listed at build time (see astro.config.mjs). */
const known = new Set(publicFiles);

/** True when public/<path> was part of the build (e.g. "games/maze/cover.jpg"). */
export function hasPublicFile(path: string): boolean {
  return known.has(path);
}
