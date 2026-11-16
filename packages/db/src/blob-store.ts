/**
 * Uploaded files stored inside the database (the `blob` table, see
 * schema/storage.ts). The live site on Cloudflare uses this so uploads need
 * no R2 bucket (R2 asks for a payment card). Runs on D1 and on local SQLite,
 * so the tests check exactly the code the live site runs.
 *
 *   put     cuts the file into parts of up to 1 MB (D1 allows ~2 MB per value)
 *   get     joins the parts back; a half-written file (parts or bytes
 *           missing) reads as missing instead of being served broken
 *   stat    the file's details from part 0 only (cheap: for the ETag check)
 *   delete  removes every part
 *
 * Keys are checked by the caller (src/platform/types.ts isSafeKey); here they
 * are only ever used as bound values, never pasted into SQL.
 */
import { and, asc, eq } from "drizzle-orm";
import { blob } from "./schema/storage.ts";
import type { AppDb } from "./types.ts";

/** Biggest part stored in one row. D1's limit for one value is about 2 MB. */
export const BLOB_PART_BYTES = 1024 * 1024;

export interface StoredBlob {
  bytes: Uint8Array;
  contentType: string;
  size: number;
  /** SHA-256 of the file (hex). */
  sha256: string;
}

export type BlobInfo = Omit<StoredBlob, "bytes">;

/** SHA-256 of some bytes, as hex (Web Crypto: Node, browsers and Workers). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function dbBlobStore(db: AppDb, partBytes = BLOB_PART_BYTES) {
  return {
    async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
      const sha256 = await sha256Hex(bytes);
      const parts = Math.max(1, Math.ceil(bytes.length / partBytes));
      const createdAt = new Date();
      // Replace any older file with the same key (keys are random, so this is rare).
      await db.delete(blob).where(eq(blob.key, key));
      for (let part = 0; part < parts; part++) {
        const data = bytes.subarray(part * partBytes, (part + 1) * partBytes);
        await db.insert(blob).values({ key, part, parts, contentType, size: bytes.length, sha256, data, createdAt });
      }
    },

    async stat(key: string): Promise<BlobInfo | null> {
      const row = (
        await db
          .select({ contentType: blob.contentType, size: blob.size, sha256: blob.sha256 })
          .from(blob)
          .where(and(eq(blob.key, key), eq(blob.part, 0)))
          .limit(1)
      )[0];
      return row ?? null;
    },

    async get(key: string): Promise<StoredBlob | null> {
      const rows = await db.select().from(blob).where(eq(blob.key, key)).orderBy(asc(blob.part));
      const first = rows[0];
      if (!first || rows.length !== first.parts) return null;
      const out = new Uint8Array(first.size);
      let at = 0;
      for (const [i, row] of rows.entries()) {
        if (row.part !== i || at + row.data.length > out.length) return null;
        out.set(row.data, at);
        at += row.data.length;
      }
      // (No checksum pass here: hashing every download would spend CPU time,
      // which the Workers free plan counts. The part count and size catch a half-written file.)
      if (at !== first.size) return null;
      return { bytes: out, contentType: first.contentType, size: first.size, sha256: first.sha256 };
    },

    async delete(key: string): Promise<void> {
      await db.delete(blob).where(eq(blob.key, key));
    },
  };
}

export type DbBlobStore = ReturnType<typeof dbBlobStore>;
