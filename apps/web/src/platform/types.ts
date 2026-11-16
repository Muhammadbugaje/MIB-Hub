/**
 * What the website needs from the machine it runs on. There are two
 * implementations, picked automatically by the `#platform` import
 * (see "imports" in apps/web/package.json):
 *
 *   node.ts     `npm run dev`, tests and scripts: SQLite file + folder on disk
 *   workers.ts  Cloudflare Workers (the live site): D1 database + R2 bucket
 *
 * The Cloudflare build asks for the "workerd" version; everything else
 * (Node, Vitest, tsx, TypeScript) gets the Node version.
 */

/** Uploaded files (images, sounds). A folder on disk locally, an R2 bucket on Cloudflare. */
export interface BlobStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** null when the file is missing or the key is not a valid upload key. */
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

/**
 * A safe upload key: "folder/name.ext", lower-case letters, digits and
 * dashes only. Stops "../" tricks reaching other files or bucket keys.
 */
export function isSafeKey(key: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]{2,5}$/.test(key);
}
