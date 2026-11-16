/**
 * Uploads kept in the database (the `blob` table; the live site's storage on
 * Cloudflare D1). Runs the real migrations on an in-memory SQLite database.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { BLOB_PART_BYTES, dbBlobStore, sha256Hex } from "../src/blob-store.ts";
import { blob } from "../src/schema/index.ts";
import { createSqliteDb, migrateSqlite, type SqliteDb } from "../src/sqlite.ts";

let db: SqliteDb;

beforeEach(() => {
  db = createSqliteDb(":memory:");
  migrateSqlite(db);
});

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
  return out;
}

describe("dbBlobStore", () => {
  it("stores a small file in one row and reads it back", async () => {
    const store = dbBlobStore(db);
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    await store.put("people/a-1.png", bytes, "image/png");
    const got = await store.get("people/a-1.png");
    expect(got?.contentType).toBe("image/png");
    expect([...(got?.bytes ?? [])]).toEqual([...bytes]);
    expect(got?.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect((await db.select().from(blob)).length).toBe(1);
  });

  it("cuts a big file into 1 MB parts and joins them back exactly", async () => {
    const store = dbBlobStore(db);
    const bytes = randomBytes(BLOB_PART_BYTES * 3 + 12345); // a 3.x MB image: 4 parts
    await store.put("covers/big.jpg", bytes, "image/jpeg");
    const rows = await db.select().from(blob);
    expect(rows.map((r) => r.part).sort()).toEqual([0, 1, 2, 3]);
    expect(Math.max(...rows.map((r) => r.data.length))).toBeLessThanOrEqual(BLOB_PART_BYTES);
    const got = await store.get("covers/big.jpg");
    expect(got?.size).toBe(bytes.length);
    expect(Buffer.from(got!.bytes).equals(Buffer.from(bytes))).toBe(true);
    expect(await store.stat("covers/big.jpg")).toEqual({ contentType: "image/jpeg", size: bytes.length, sha256: await sha256Hex(bytes) });
  });

  it("handles sizes on a part boundary and empty files", async () => {
    const store = dbBlobStore(db, 4);
    for (const n of [0, 1, 4, 8, 9]) {
      const bytes = randomBytes(n);
      await store.put(`t/n${n}.bin`, bytes, "application/octet-stream");
      expect([...(await store.get(`t/n${n}.bin`))!.bytes]).toEqual([...bytes]);
    }
  });

  it("replaces a file stored under the same key, and deletes every part", async () => {
    const store = dbBlobStore(db, 4);
    await store.put("sounds/x.wav", randomBytes(17), "audio/wav"); // 5 parts
    await store.put("sounds/x.wav", new Uint8Array([9, 9]), "audio/wav"); // 1 part
    expect([...(await store.get("sounds/x.wav"))!.bytes]).toEqual([9, 9]);
    expect((await db.select().from(blob)).length).toBe(1);
    await store.delete("sounds/x.wav");
    expect(await store.get("sounds/x.wav")).toBeNull();
    expect(await store.stat("sounds/x.wav")).toBeNull();
  });

  it("treats a half-written file as missing", async () => {
    const store = dbBlobStore(db, 4);
    await store.put("people/p.png", randomBytes(10), "image/png"); // 3 parts
    await db.delete(blob).where(and(eq(blob.key, "people/p.png"), eq(blob.part, 2)));
    expect(await store.get("people/p.png")).toBeNull();
  });
});
