/**
 * Tests for the admin-panel repository additions: user search, audit filters,
 * profile edits, score moderation, cheat/hero edits, product and character
 * removal, and the game_sound repository.
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

beforeEach(() => {
  db = createSqliteDb(":memory:");
  migrateSqlite(db);
  repos = createRepos(db, { hasher: testHasher });
});

describe("users.search", () => {
  it("finds by name or email, filters by role and banned, and counts", async () => {
    await db.insert(user).values([
      { id: "a", name: "Amina Bello", email: "amina@test", role: "admin", createdAt: new Date(1000) },
      { id: "b", name: "Chidi", email: "chidi@test", role: "player", createdAt: new Date(2000) },
      { id: "c", name: "Zara", email: "zz@test", role: "player", banned: true, createdAt: new Date(3000) },
    ]);
    const all = await repos.users.search();
    expect(all.total).toBe(3);
    expect(all.rows[0]!.id).toBe("c"); // newest first
    expect((await repos.users.search({ q: "AMI" })).rows.map((u) => u.id)).toEqual(["a"]);
    expect((await repos.users.search({ q: "chidi@" })).total).toBe(1);
    expect((await repos.users.search({ role: "player" })).total).toBe(2);
    expect((await repos.users.search({ banned: true })).rows.map((u) => u.id)).toEqual(["c"]);
    expect((await repos.users.search({ limit: 1, offset: 1 })).rows.map((u) => u.id)).toEqual(["b"]);
  });
});

describe("audit filters", () => {
  it("filters by actor and action prefix and lists target types", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@test" });
    await repos.audit.record({ actorId: "u1", action: "game.update", targetType: "game", targetId: "g" });
    await repos.audit.record({ actorId: null, action: "post.create", targetType: "post", targetId: "p" });
    expect((await repos.audit.list({ actorId: "u1" })).map((a) => a.action)).toEqual(["game.update"]);
    expect((await repos.audit.list({ actionPrefix: "post." })).map((a) => a.targetId)).toEqual(["p"]);
    expect(await repos.audit.targetTypes()).toEqual(["game", "post"]);
  });
});

describe("profiles and score moderation", () => {
  it("updates a profile and moderates scores", async () => {
    await db.insert(user).values({ id: "u1", name: "Amina Bello", email: "u1@test" });
    const p = await repos.profiles.getOrCreateForUser("u1", "Amina Bello");
    const updated = await repos.profiles.update(p.id, { displayName: "Ami", onLeaderboard: false, stats: { bio: "Hi" } });
    expect(updated?.displayName).toBe("Ami");
    expect(updated?.stats).toEqual({ bio: "Hi" });

    await repos.profiles.update(p.id, { onLeaderboard: true });
    const s1 = await repos.scores.submit({ profileId: p.id, gameSlug: "g", score: 50 });
    const s2 = await repos.scores.submit({ profileId: p.id, gameSlug: "g", score: 90 });
    const rows = await repos.scores.listForAdmin({ gameSlug: "g" });
    expect(rows.map((r) => r.score)).toEqual([90, 50]);
    expect(rows[0]!.name).toBe("Amina Bello"); // the account name wins over a stale profile display name

    await repos.scores.setCheated(s2.id, true);
    expect((await repos.scores.top("g")).map((r) => r.score)).toEqual([50]);
    expect((await repos.scores.listForAdmin({ cheated: true })).map((r) => r.id)).toEqual([s2.id]);
    await repos.scores.remove(s1.id);
    expect(await repos.scores.getById(s1.id)).toBeUndefined();
    expect((await repos.scores.forProfile(p.id)).length).toBe(1);
  });
});

describe("cheat and hero edits", () => {
  it("edits non-secret fields without touching the code", async () => {
    const c = await repos.cheats.create({ gameSlug: "g", key: "money", label: "Money", code: "richkid" });
    const u = await repos.cheats.update(c.id, { label: "Infinite money", access: "staff" });
    expect(u?.label).toBe("Infinite money");
    expect(u).not.toHaveProperty("codeHash");
    expect((await repos.cheats.match("g", "richkid"))?.key).toBe("money");
    expect(await repos.cheats.legacyIds()).toEqual([]);

    const h = await repos.heroes.create({ name: "HERO", code: "secretcode" });
    await repos.heroes.update(h.id, { enabled: false, access: "staff" });
    expect((await repos.heroes.get(h.id))?.enabled).toBe(false);
    expect(await repos.heroes.verify("g", "secretcode")).toBeNull();
    expect(await repos.heroes.isLegacy(h.id)).toBe(false);
    await repos.heroes.remove(h.id);
    expect(await repos.heroes.get(h.id)).toBeUndefined();
  });
});

describe("products, characters and sounds", () => {
  it("removes products and characters", async () => {
    await repos.products.upsertBySku({ sku: "boost-1", title: "Boost", priceKobo: 100 });
    await repos.products.remove("boost-1");
    expect(await repos.products.getBySku("boost-1")).toBeUndefined();
    await repos.characters.upsertByKey({ key: "npc.x", name: "X" });
    await repos.characters.remove("npc.x");
    expect(await repos.characters.getByKey("npc.x")).toBeUndefined();
  });

  it("saves, replaces (bumping the version) and removes sounds", async () => {
    const base = { gameSlug: "g", name: "goal", contentType: "audio/mpeg", size: 1000, duration: 1.2 };
    const first = await repos.sounds.save({ ...base, fileKey: "sounds/a.mp3" });
    expect(first.previousFileKey).toBeNull();
    expect(first.sound.version).toBe(1);
    const second = await repos.sounds.save({ ...base, fileKey: "sounds/b.mp3" });
    expect(second.previousFileKey).toBe("sounds/a.mp3");
    expect(second.sound.version).toBe(2);
    expect((await repos.sounds.list("g")).length).toBe(1);
    await expect(repos.sounds.save({ ...base, name: "Bad Name", fileKey: "x" })).rejects.toThrow();
    const removed = await repos.sounds.remove(second.sound.id);
    expect(removed?.fileKey).toBe("sounds/b.mp3");
    expect(await repos.sounds.list()).toEqual([]);
  });
});

describe("account pages: handles, saves and ticket counts", () => {
  it("finds a profile by handle, lists and removes saves across games", async () => {
    await db.insert(user).values({ id: "u1", name: "Amina", email: "u1@test" });
    const p = await repos.profiles.getOrCreateForUser("u1", "Amina");
    await repos.profiles.update(p.id, { stats: { handle: "Ami_9" } });
    expect((await repos.profiles.findByHandle("ami_9"))?.id).toBe(p.id);
    expect(await repos.profiles.findByHandle("nobody")).toBeUndefined();

    const a = await repos.progress.save({ profileId: p.id, gameSlug: "g1", data: { lvl: 1 } });
    await repos.progress.save({ profileId: p.id, gameSlug: "g2", slot: "1", data: { lvl: 2 } });
    expect((await repos.progress.forProfile(p.id)).length).toBe(2);
    await repos.progress.remove("someone-else", a.id); // wrong owner: nothing happens
    expect((await repos.progress.forProfile(p.id)).length).toBe(2);
    await repos.progress.remove(p.id, a.id);
    expect((await repos.progress.forProfile(p.id)).map((s) => s.gameSlug)).toEqual(["g2"]);
  });

  it("counts public messages per ticket", async () => {
    const t = await repos.tickets.create({ kind: "help", subject: "Stuck", body: "Help me please" });
    await repos.tickets.reply({ ticketId: t.id, body: "On it", fromStaff: true });
    await repos.tickets.reply({ ticketId: t.id, body: "Staff only", fromStaff: true, internal: true });
    expect(await repos.tickets.messageCounts([t.id])).toEqual({ [t.id]: 1 });
    expect(await repos.tickets.messageCounts([])).toEqual({});
  });
});
