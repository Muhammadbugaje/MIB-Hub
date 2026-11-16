/**
 * What the website needs from the machine it runs on. There are two
 * implementations, picked automatically by the `#platform` import
 * (see "imports" in apps/web/package.json):
 *
 *   node.ts     `npm run dev`, tests and scripts: SQLite file + folder on disk
 *   workers.ts  Cloudflare Workers (the live site): D1 database, uploads in D1 too
 *
 * The Cloudflare build asks for the "workerd" version; everything else
 * (Node, Vitest, tsx, TypeScript) gets the Node version.
 */

/**
 * Uploaded files (images, sounds). A folder on disk locally; on Cloudflare,
 * rows in the D1 database (the `blob` table, packages/db/src/blob-store.ts),
 * because R2 needs a payment card.
 */
export interface BlobStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** null when the file is missing or the key is not a valid upload key. */
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string; etag: string } | null>;
  /** The file's type and ETag without reading it (for "not changed" replies). */
  stat(key: string): Promise<{ contentType: string; size: number; etag: string } | null>;
  delete(key: string): Promise<void>;
}

/**
 * A safe upload key: "folder/name.ext", lower-case letters, digits and
 * dashes only. Stops "../" tricks reaching other files or stored keys.
 */
export function isSafeKey(key: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]{2,5}$/.test(key);
}
