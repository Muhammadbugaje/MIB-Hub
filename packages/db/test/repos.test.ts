/**
 * Repository tests against a real SQLite database (in memory), with the real
 * migrations applied. If these pass, the schema and the queries agree.
 */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createRepos, hashCode, leaderboardName, normaliseCode, redact, type Repos } from "../src/index.ts";
import { user } from "../src/schema/index.ts";
import { createSqliteDb, migrateSqlite, type SqliteDb } from "../src/sqlite.ts";

/** A stand-in password hasher for tests (the site uses Better Auth's scrypt). */
const testHasher = {
  hash: async (plain: string) => "test$" + createHash("sha256").update(plain).digest("hex"),
  verify: async (hash: string, plain: string) => hash === "test$" + createHash("sha256").update(plain).digest("hex"),
};

let db: SqliteDb;
let repos: Repos;

async function addUser(id: string, name: string, email: string) {
  await db.insert(user).values({ id, name, email });
}

beforeEach(() => {
  db = createSqliteDb(":memory:");
  migrateSqlite(db);
  repos = createRepos(db, { hasher: testHasher });
});

describe("games", () => {
  it("upserts by slug and lists only live/demo enabled games publicly", async () => {
    await repos.games.upsert({ slug: "momentum-cup", title: "Momentum Cup", status: "live", sort: 2 });
    await repos.games.upsert({ slug: "volt-city", title: "Volt City", status: "demo", sort: 1 });
    await repos.games.upsert({ slug: "secret", title: "Secret", status: "hidden" });
    await repos.games.upsert({ slug: "off", title: "Off", status: "live", enabled: false });
    // Upsert again: updates instead of duplicating.
    await repos.games.upsert({ slug: "momentum-cup", title: "Momentum Cup 2", status: "live", sort: 2 });

    const pub = await repos.games.listPublic();
    expect(pub.map((g) => g.slug)).toEqual(["volt-city", "momentum-cup"]);
    expect(pub[1]!.title).toBe("Momentum Cup 2");
    expect((await repos.games.listAll()).length).toBe(4);
  });

  it("stores settings and meta as JSON", async () => {
    await repos.games.upsert({ slug: "g", title: "G", settings: { lives: 3 }, meta: { tags: ["quick"] } });
    const g = await repos.games.getBySlug("g");
    expect(g?.settings).toEqual({ lives: 3 });
    expect(g?.meta.tags).toEqual(["quick"]);
    await repos.games.update("g", { enabled: false });
    expect((await repos.games.getBySlug("g"))?.enabled).toBe(false);
  });

  it("merges defaults, site-wide and per-game settings (per-game wins)", async () => {
    await repos.gameSettings.update("*", { cheatsEnabled: false, music: 0.5 });
    await repos.gameSettings.update("g", { music: 0.8 });
    expect(await repos.gameSettings.effective("g", { music: 1, lives: 3 })).toEqual({
      music: 0.8,
      lives: 3,
      cheatsEnabled: false,
    });
    await repos.gameSettings.update("g", { music: null });
    expect(await repos.gameSettings.get("g")).toEqual({});
  });
});

describe("cheats and heroes", () => {
  it("never stores or returns the plain code, and matches normalised input", async () => {
    const c = await repos.cheats.create({ gameSlug: "g", key: "money", label: "Money", code: "Big Money" });
    expect(c).not.toHaveProperty("codeHash");
    const raw = db.$sqlite.prepare("select code_hash, code_salt from cheat").get() as { code_hash: string; code_salt: string };
    expect(raw.code_hash).not.toContain("money");
    expect(raw.code_hash).toBe(await hashCode("g", normaliseCode("bigmoney"), raw.code_salt));

    expect((await repos.cheats.match("g", "  BIGmoney "))?.key).toBe("money");
    expect(await repos.cheats.match("g", "wrong")).toBeNull();
    expect(await repos.cheats.match("other-game", "bigmoney")).toBeNull();

    await repos.cheats.setEnabled(c.id, false);
    expect(await repos.cheats.match("g", "bigmoney")).toBeNull();
  });

  it("gives every cheat its own salt", async () => {
    await repos.cheats.create({ gameSlug: "g", key: "a", label: "A", code: "same", channel: "typed" });
    await repos.cheats.create({ gameSlug: "g", key: "a", label: "A", code: "same", channel: "dial" });
    const rows = db.$sqlite.prepare("select code_hash from cheat").all() as Array<{ code_hash: string }>;
    expect(rows[0]!.code_hash).not.toBe(rows[1]!.code_hash);
  });

  it("rejects codes that are too short", async () => {
    await expect(repos.cheats.create({ gameSlug: "g", key: "x", label: "X", code: "a b" })).rejects.toThrow();
  });

  it("verifies a hero code, preferring the game's own hero over the site-wide one", async () => {
    await repos.heroes.create({ name: "Everywhere", code: "open sesame" });
    await repos.heroes.create({ name: "Local", code: "open sesame", gameSlug: "g" });
    expect((await repos.heroes.verify("g", "OPEN SESAME"))?.name).toBe("Local");
    expect((await repos.heroes.verify("other", "opensesame"))?.name).toBe("Everywhere");
    expect(await repos.heroes.verify("g", "nope")).toBeNull();
    const listed = await repos.heroes.list("g");
    expect(listed[0]).not.toHaveProperty("passwordHash");
  });
});

describe("players, scores and progress", () => {
  it("creates one profile per user and keeps coins at zero or above", async () => {
    await addUser("u1", "Amina Bello", "amina@example.test");
    const p1 = await repos.profiles.getOrCreateForUser("u1", "Amina Bello");
    const p2 = await repos.profiles.getOrCreateForUser("u1", "Amina Bello");
    expect(p2.id).toBe(p1.id);
    const after = await repos.profiles.addRewards(p1.id, { coins: 10, xp: 5 });
    expect(after.coins).toBe(10);
    expect((await repos.profiles.addRewards(p1.id, { coins: -50 })).coins).toBe(0);
  });

  it("builds a leaderboard without cheated runs or opted-out players", async () => {
    await addUser("u1", "Amina Bello", "a@example.test");
    await addUser("u2", "Tunde", "t@example.test");
    const a = await repos.profiles.getOrCreateForUser("u1", "");
    const t = await repos.profiles.getOrCreateForUser("u2", "Tunde");
    await repos.scores.submit({ profileId: a.id, gameSlug: "g", score: 50 });
    await repos.scores.submit({ profileId: t.id, gameSlug: "g", score: 90, cheated: true });
    await repos.scores.submit({ profileId: t.id, gameSlug: "g", score: 70 });

    const top = await repos.scores.top("g");
    expect(top.map((r) => [r.name, r.score])).toEqual([
      ["Tunde", 70],
      ["Amina B.", 50],
    ]);
    expect((await repos.scores.top("g", { includeCheated: true }))[0]!.score).toBe(90);
    expect(await repos.scores.bestFor(t.id, "g")).toBe(70);
    await expect(repos.scores.submit({ profileId: a.id, gameSlug: "g", score: -1 })).rejects.toThrow();
  });

  it("renames a person everywhere: account, profile and leaderboards", async () => {
    await addUser("u1", "Amina Bello", "a@example.test");
    const p = await repos.profiles.getOrCreateForUser("u1", "Amina Bello");
    await repos.scores.submit({ profileId: p.id, gameSlug: "g", score: 40 });
    expect((await repos.scores.top("g"))[0]!.name).toBe("Amina B.");

    expect(await repos.users.setName("u1", "  Zara   Okafor ")).toBe("Zara Okafor");
    expect((await repos.users.findById("u1"))!.name).toBe("Zara Okafor");
    expect((await repos.profiles.getForUser("u1"))!.displayName).toBe("Zara Okafor");
    expect((await repos.scores.top("g"))[0]!.name).toBe("Zara O.");
    expect((await repos.scores.listForAdmin({ gameSlug: "g" }))[0]!.name).toBe("Zara Okafor");
  });

  it("shows the account name on leaderboards even when an old profile name is stale", async () => {
    await addUser("u1", "New Name", "n@example.test");
    const p = await repos.profiles.getOrCreateForUser("u1", "Old Name");
    await repos.scores.submit({ profileId: p.id, gameSlug: "g", score: 10 });
    expect((await repos.scores.top("g"))[0]!.name).toBe("New N.");
  });

  it("saves and overwrites one slot", async () => {
    await addUser("u1", "A", "a@example.test");
    const p = await repos.profiles.getOrCreateForUser("u1", "A");
    await repos.progress.save({ profileId: p.id, gameSlug: "g", slot: "1", data: { week: 1 } });
    await repos.progress.save({ profileId: p.id, gameSlug: "g", slot: "1", data: { week: 2 }, saveVersion: 2 });
    const saved = await repos.progress.load(p.id, "g", "1");
    expect(saved?.data).toEqual({ week: 2 });
    expect(saved?.saveVersion).toBe(2);
    expect((await repos.progress.list(p.id, "g")).length).toBe(1);
  });

  it("refuses a profile with neither (or both) an account and a guest", async () => {
    expect(() =>
      db.$sqlite
        .prepare("insert into player_profile (id, created_at, updated_at, owned, equipped, badges, stats) values ('x', 0, 0, '[]', '{}', '[]', '{}')")
        .run(),
    ).toThrow(/CHECK/);
  });

  it("formats leaderboard names as first name + initial", () => {
    expect(leaderboardName("Amina Zainab Bello")).toBe("Amina B.");
    expect(leaderboardName("Tunde")).toBe("Tunde");
    expect(leaderboardName("   ")).toBe("Player");
  });
});

describe("platform", () => {
  it("records audit entries with secrets redacted", async () => {
    await repos.audit.record({ actorId: null, action: "cheat.update", targetType: "cheat", targetId: "c1", before: { code: "old", label: "A" }, after: { code: "new", label: "B" } });
    const [entry] = await repos.audit.list({ targetType: "cheat" });
    expect(entry?.before).toEqual({ code: "(changed)", label: "A" });
    expect(entry?.after).toEqual({ code: "(changed)", label: "B" });
    expect(redact({ nested: { passwordHash: "x" }, list: [{ token: "y" }] })).toEqual({
      nested: { passwordHash: "(changed)" },
      list: [{ token: "(changed)" }],
    });
  });

  it("reads and writes site settings with a fallback", async () => {
    expect(await repos.siteSettings.get("brand.name", "MIB-Hub")).toBe("MIB-Hub");
    await repos.siteSettings.set("brand.name", "New Name");
    await repos.siteSettings.set("brand.name", "Newer Name");
    expect(await repos.siteSettings.get("brand.name", "MIB-Hub")).toBe("Newer Name");
    expect(await repos.siteSettings.all()).toEqual({ "brand.name": "Newer Name" });
  });

  it("lists only unexpired permission overrides and changes roles", async () => {
    await addUser("u1", "A", "a@example.test");
    await repos.permissionOverrides.add({ userId: "u1", permission: "games.manage_settings", effect: "grant" });
    await repos.permissionOverrides.add({ userId: "u1", permission: "admin.access", effect: "grant", expiresAt: new Date(Date.now() - 1000) });
    const active = await repos.permissionOverrides.listActive("u1");
    expect(active.map((o) => o.permission)).toEqual(["games.manage_settings"]);

    await repos.users.setRole("u1", "moderator");
    expect((await repos.users.findByEmail("A@example.test "))?.role).toBe("moderator");
    expect(await repos.users.count()).toBe(1);
  });

  it("upserts the built-in roles", async () => {
    await repos.roles.upsertMany([
      { key: "owner", label: "Owner", description: "", rank: 100 },
      { key: "player", label: "Player", description: "", rank: 10 },
    ]);
    await repos.roles.upsertMany([{ key: "player", label: "Player!", description: "", rank: 10 }]);
    expect((await repos.roles.list()).map((r) => r.label)).toEqual(["Owner", "Player!"]);
  });
});
