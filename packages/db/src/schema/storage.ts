/**
 * Uploaded files (people photos, avatars, post covers, admin sound
 * overrides) kept inside the database itself. Used by the live site on
 * Cloudflare, where the D1 database is the only free storage that needs no
 * payment card (R2 does). Locally, `npm run dev` keeps uploads as plain files
 * in apps/web/.data/uploads/ instead (src/platform/node.ts).
 *
 * D1 allows at most about 2 MB in one value, so a file is cut into parts of
 * up to 1 MB: one row per part, all with the same `key`. Every row repeats
 * the file's details (type, size, checksum, number of parts), so reading
 * part 0 alone is enough to answer "has it changed?" (the ETag).
 * The code that reads and writes these rows: src/blob-store.ts.
 */
import { customType, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { timestamp } from "./helpers.ts";

/** Turn whatever the driver hands back for a BLOB into plain bytes. */
export function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]); // D1 can return BLOBs as number arrays
  throw new Error("Not a BLOB value.");
}

/** A BLOB column read back as a Uint8Array (on Node and on D1). */
const bytes = customType<{ data: Uint8Array; driverData: unknown }>({
  dataType: () => "blob",
  fromDriver: toBytes,
  toDriver: (value) => value,
});

export const blob = sqliteTable(
  "blob",
  {
    /** The upload key, e.g. "people/<uuid>.png" (src/platform/types.ts isSafeKey). */
    key: text("key").notNull(),
    /** Which part this row holds: 0, 1, 2... */
    part: integer("part").notNull(),
    /** How many parts the whole file has. */
    parts: integer("parts").notNull(),
    contentType: text("content_type").notNull(),
    /** The whole file's size in bytes. */
    size: integer("size").notNull(),
    /** SHA-256 of the whole file (hex): checks the parts and serves as the ETag. */
    sha256: text("sha256").notNull(),
    data: bytes("data").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.key, t.part] })],
);

export type BlobRow = typeof blob.$inferSelect;
