/**
 * repos.offline: idempotent offline submissions and the version-checked cloud save.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createRepos, type Repos } from "../src/index.ts";
import { user } from "../src/schema/index.ts";
import { createSqliteDb, migrateSqlite, type SqliteDb } from "../src/sqlite.ts";

const testHasher = {
  hash: async (plain: string) => "test$" + createHash("sha256").update(plain).digest("hex"),
  verify: async (hash: string, plain: string) => hash === "test$" + createHash("sha256").update(plain).digest("hex"),
};

let db: SqliteDb;
let repos: Repos;
let p1: string;
let p2: string;

beforeEach(async () => {
  db = createSqliteDb(":memory:");
  migrateSqlite(db);
  repos = createRepos(db, { hasher: testHasher });
  await db.insert(user).values([
    { id: "u1", name: "Amina Bello", email: "u1@example.test" },
    { id: "u2", name: "Tunde Ade", email: "u2@example.test" },
  ]);
  p1 = (await repos.profiles.getOrCreateForUser("u1", "Amina")).id;
  p2 = (await repos.profiles.getOrCreateForUser("u2", "Tunde")).id;
});

describe("offline submissions", () => {
  it("claims a device id once per player", async () => {
    expect(await repos.offline.claim({ profileId: p1, cid: "abc12345", gameSlug: "light-bender" })).toBe(true);
    expect(await repos.offline.claim({ profileId: p1, cid: "abc12345", gameSlug: "light-bender" })).toBe(false);
    // Another player's identical id is theirs, not blocked.
    expect(await repos.offline.claim({ profileId: p2, cid: "abc12345" })).toBe(true);
    const row = await repos.offline.get(p1, "abc12345");
    expect(row?.gameSlug).toBe("light-bender");
    expect(row?.ok).toBe(true);
  });

  it("only one of many simultaneous claims wins", async () => {
    const wins = await Promise.all(Array.from({ length: 8 }, () => repos.offline.claim({ profileId: p1, cid: "same-id-1" })));
    expect(wins.filter(Boolean)).toHaveLength(1);
  });

  it("settles, releases (so a retry can count) and lists", async () => {
    await repos.offline.claim({ profileId: p1, cid: "first-001", playedAt: new Date(1_700_000_000_000) });
    await repos.offline.settle(p1, "first-001", { ok: false, note: "This game is switched off." });
    expect((await repos.offline.get(p1, "first-001"))?.note).toBe("This game is switched off.");
    expect((await repos.offline.get(p1, "first-001"))?.ok).toBe(false);

    await repos.offline.claim({ profileId: p1, cid: "crash-001" });
    await repos.offline.release(p1, "crash-001");
    expect(await repos.offline.get(p1, "crash-001")).toBeUndefined();
    expect(await repos.offline.claim({ profileId: p1, cid: "crash-001" })).toBe(true);

    expect((await repos.offline.listForProfile(p1)).map((r) => r.cid).sort()).toEqual([`${p1}:crash-001`, `${p1}:first-001`]);
  });

  it("refuses malformed ids and prunes old rows", async () => {
    await expect(repos.offline.claim({ profileId: p1, cid: "short" })).rejects.toThrow();
    await expect(repos.offline.claim({ profileId: p1, cid: "bad id with spaces" })).rejects.toThrow();
    await repos.offline.claim({ profileId: p1, cid: "old-item-1" });
    expect(await repos.offline.prune(new Date(Date.now() + 1000))).toBe(1);
    expect(await repos.offline.listForProfile(p1)).toEqual([]);
  });

  it("goes when the player's profile is deleted", async () => {
    await repos.offline.claim({ profileId: p2, cid: "gone-0001" });
    await db.$sqlite.prepare("DELETE FROM player_profile WHERE id = ?").run(p2);
    expect(await repos.offline.get(p2, "gone-0001")).toBeUndefined();
  });
});

describe("version-checked cloud save", () => {
  it("writes when nothing is there yet (base 0) and refuses a stale base", async () => {
    const a = await repos.offline.saveIfUnchanged({ profileId: p1, gameSlug: "g", data: { n: 1 }, base: 0 });
    expect(a.ok).toBe(true);
    const v1 = a.ok ? a.row.updatedAt.getTime() : 0;

    // A device that never saw v1 (base 0) must not overwrite it.
    const stale = await repos.offline.saveIfUnchanged({ profileId: p1, gameSlug: "g", data: { n: 99 }, base: 0 });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.current.data).toEqual({ n: 1 });

    // A device that saw v1 may write; the version moves forward.
    const b = await repos.offline.saveIfUnchanged({ profileId: p1, gameSlug: "g", data: { n: 2 }, base: v1 });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.row.updatedAt.getTime()).toBeGreaterThan(v1);
    expect((await repos.progress.load(p1, "g"))?.data).toEqual({ n: 2 });

    // ...and the old base is now stale.
    expect((await repos.offline.saveIfUnchanged({ profileId: p1, gameSlug: "g", data: { n: 3 }, base: v1 })).ok).toBe(false);
    expect((await repos.progress.load(p1, "g"))?.data).toEqual({ n: 2 });
  });

  it("keeps slots and players apart", async () => {
    await repos.offline.saveIfUnchanged({ profileId: p1, gameSlug: "g", data: { a: 1 }, base: 0 });
    expect((await repos.offline.saveIfUnchanged({ profileId: p1, gameSlug: "g", slot: "1", data: { b: 1 }, base: 0 })).ok).toBe(true);
    expect((await repos.offline.saveIfUnchanged({ profileId: p2, gameSlug: "g", data: { c: 1 }, base: 0 })).ok).toBe(true);
    expect((await repos.progress.list(p1, "g")).length).toBe(2);
  });
});
