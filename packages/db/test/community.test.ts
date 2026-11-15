/**
 * Tests for the Site v2 tables (community, content, analytics) and the
 * legacy (Django) cheat and hero imports. Real SQLite in memory, real
 * migrations.
 */
import { createHash, pbkdf2Sync } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createRepos, LEGACY_SALT, makeRef, slugify, type Repos } from "../src/index.ts";
import { cheat, hero, user } from "../src/schema/index.ts";
import { createSqliteDb, migrateSqlite, type SqliteDb } from "../src/sqlite.ts";
import { eq } from "drizzle-orm";

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

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const DAY = 86_400_000;

describe("legacy cheat import", () => {
  it("accepts the old unsalted hash and upgrades it on first correct use", async () => {
    const imported = await repos.cheats.importLegacy({
      gameSlug: "momentum-cup",
      key: "goal",
      label: "Free goal",
      channel: "typed",
      legacyHash: sha("momentum-cup:freegoal"),
    });
    expect(imported).toBe(true);
    // Importing again is a no-op.
    expect(await repos.cheats.importLegacy({ gameSlug: "momentum-cup", key: "goal", label: "x", channel: "typed", legacyHash: "00" })).toBe(false);

    expect(await repos.cheats.match("momentum-cup", "wrong code")).toBeNull();
    const hit = await repos.cheats.match("momentum-cup", "Free Goal");
    expect(hit?.key).toBe("goal");
    const row = (await db.select().from(cheat).where(eq(cheat.key, "goal")))[0]!;
    expect(row.codeSalt).not.toBe(LEGACY_SALT);
    // Still works after the upgrade.
    expect((await repos.cheats.match("momentum-cup", "freegoal"))?.key).toBe("goal");
  });
});

describe("legacy hero import", () => {
  it("verifies a Django PBKDF2 hash and re-hashes it on first use", async () => {
    const salt = "abcdefghijklmnopqrstuv";
    const digest = pbkdf2Sync("updown", salt, 1000, 32, "sha256").toString("base64");
    const django = `pbkdf2_sha256$1000$${salt}$${digest}`;
    expect(await repos.heroes.importLegacy({ name: "M.I. BUGAJE", djangoHash: django })).toBe(true);
    expect(await repos.heroes.verify("momentum-cup", "nope")).toBeNull();
    expect((await repos.heroes.verify("momentum-cup", "Up Down"))?.name).toBe("M.I. BUGAJE");
    const row = (await db.select().from(hero))[0]!;
    expect(row.passwordHash.startsWith("test$")).toBe(true);
    expect((await repos.heroes.verify("momentum-cup", "updown"))?.name).toBe("M.I. BUGAJE");
  });
});

describe("posts and events", () => {
  it("lists only published posts that are due, pinned first", async () => {
    const now = Date.now();
    await repos.posts.upsertBySlug({ slug: "a", title: "A", status: "published", publishedAt: new Date(now - 2 * DAY) });
    await repos.posts.upsertBySlug({ slug: "b", title: "B", status: "published", publishedAt: new Date(now - DAY), pinned: false });
    await repos.posts.upsertBySlug({ slug: "c", title: "C", status: "published", publishedAt: new Date(now - 3 * DAY), pinned: true });
    await repos.posts.upsertBySlug({ slug: "d", title: "Draft", status: "draft" });
    await repos.posts.upsertBySlug({ slug: "e", title: "Future", status: "published", publishedAt: new Date(now + DAY) });
    expect((await repos.posts.listPublished()).map((p) => p.slug)).toEqual(["c", "b", "a"]);
  });

  it("separates upcoming and past events", async () => {
    const now = Date.now();
    await repos.events.upsertBySlug({ slug: "soon", title: "Soon", status: "published", startsAt: new Date(now + DAY), endsAt: new Date(now + 2 * DAY) });
    await repos.events.upsertBySlug({ slug: "done", title: "Done", status: "published", startsAt: new Date(now - 3 * DAY), endsAt: new Date(now - 2 * DAY) });
    expect((await repos.events.upcoming()).map((e) => e.slug)).toEqual(["soon"]);
    expect((await repos.events.past()).map((e) => e.slug)).toEqual(["done"]);
  });
});

describe("deals and ads", () => {
  it("shows only active deals inside their dates and finds codes", async () => {
    const now = Date.now();
    await repos.deals.create({ title: "Live", code: "MIB50", percentOff: 50 });
    await repos.deals.create({ title: "Ended", endsAt: new Date(now - DAY) });
    await repos.deals.create({ title: "Off", active: false });
    expect((await repos.deals.listLive()).map((d) => d.title)).toEqual(["Live"]);
    expect((await repos.deals.findByCode(" mib50 "))?.title).toBe("Live");
  });

  it("picks an ad for a placement and counts impressions and clicks", async () => {
    const a = await repos.ads.create({ placement: "home_strip", title: "Play Momentum Cup" });
    const picked = await repos.ads.pick("home_strip");
    expect(picked?.id).toBe(a.id);
    await repos.ads.click(a.id);
    const after = await repos.ads.getById(a.id);
    expect(after?.impressions).toBe(1);
    expect(after?.clicks).toBe(1);
    expect(await repos.ads.pick("arcade_top")).toBeUndefined();
  });
});

describe("tickets", () => {
  it("creates a ticket with a reference, replies, and hides internal notes", async () => {
    const t = await repos.tickets.create({ subject: "Game froze", body: "Level 3", kind: "bug", email: "a@b.test" });
    expect(t.ref).toMatch(/^MIB-[A-Z0-9]{5}$/);
    await repos.tickets.reply({ ticketId: t.id, body: "Thanks, looking", fromStaff: true });
    await repos.tickets.reply({ ticketId: t.id, body: "Staff note", fromStaff: true, internal: true });
    expect((await repos.tickets.messages(t.id)).length).toBe(1);
    expect((await repos.tickets.messages(t.id, { includeInternal: true })).length).toBe(2);
    await repos.tickets.update(t.id, { status: "resolved" });
    expect((await repos.tickets.counts()).resolved).toBe(1);
  });
});

describe("analytics and likes", () => {
  it("computes plays, hardest levels, likes and daily trend", async () => {
    await db.insert(user).values({ id: "u1", name: "U1", email: "u1@test" });
    const ev = (kind: "start" | "end" | "level_start" | "level_fail" | "level_complete", extra = {}) => ({
      gameSlug: "momentum-cup",
      kind,
      sessionId: "s1",
      userId: "u1",
      ...extra,
    });
    await repos.analytics.trackMany([
      ev("start"),
      ev("end", { durationMs: 120_000 }),
      ...Array.from({ length: 6 }, () => ev("level_start", { level: "3" })),
      ...Array.from({ length: 4 }, () => ev("level_fail", { level: "3" })),
      ...Array.from({ length: 2 }, () => ev("level_complete", { level: "3" })),
      ...Array.from({ length: 5 }, () => ev("level_start", { level: "1" })),
      ...Array.from({ length: 5 }, () => ev("level_complete", { level: "1" })),
    ]);
    const totals = await repos.analytics.totals();
    expect(totals).toMatchObject({ plays: 1, players: 1, minutes: 2, completions: 7 });
    const hardest = await repos.analytics.hardestLevels();
    expect(hardest[0]).toMatchObject({ level: "3", attempts: 6, fails: 4 });
    expect(hardest[0]!.failRate).toBeCloseTo(4 / 6);

    expect(await repos.likes.toggle("momentum-cup", "u1")).toEqual({ liked: true, total: 1 });
    expect(await repos.likes.toggle("momentum-cup", "u1")).toEqual({ liked: false, total: 0 });
    await repos.likes.toggle("momentum-cup", "u1", "3");
    expect((await repos.analytics.mostLikedLevels())[0]).toMatchObject({ level: "3", likes: 1 });

    const daily = await repos.analytics.daily(7);
    expect(daily).toHaveLength(7);
    expect(daily.at(-1)!.plays).toBe(1);
    expect((await repos.analytics.perGame())[0]).toMatchObject({ gameSlug: "momentum-cup", plays: 1, avgMinutes: 2 });
  });

  it("clears demo data only", async () => {
    await repos.analytics.trackMany([
      { gameSlug: "g", kind: "start", sessionId: "a", demo: true },
      { gameSlug: "g", kind: "start", sessionId: "b" },
    ]);
    expect(await repos.analytics.hasDemoData()).toBe(true);
    await repos.analytics.clearDemo();
    expect(await repos.analytics.hasDemoData()).toBe(false);
    expect((await repos.analytics.totals()).plays).toBe(1);
  });
});

describe("products and orders", () => {
  it("creates orders with a reference and sums paid revenue", async () => {
    await repos.products.upsertBySku({ sku: "boost.speed", title: "Speed boost", priceKobo: 20000 });
    const o = await repos.orders.create({ productSku: "boost.speed", amountKobo: 20000, email: "a@b.test" });
    expect(o.ref).toMatch(/^ORD-/);
    expect(await repos.orders.revenue()).toBe(0);
    await repos.orders.setStatus(o.ref, "paid", "manual-1");
    expect(await repos.orders.revenue()).toBe(20000);
  });
});

describe("helpers", () => {
  it("slugifies and makes refs", () => {
    expect(slugify("Hello, World! Ça va?")).toBe("hello-world-ca-va");
    expect(makeRef("X")).toMatch(/^X-[A-Z0-9]{5}$/);
  });
});
