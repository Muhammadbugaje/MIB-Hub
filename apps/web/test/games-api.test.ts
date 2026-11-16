/**
 * The play bridge's server side (src/games/arcade-api.ts) against a real
 * in-memory database with the real migrations: results, rewards, scores,
 * cloud saves, cheats, the secret character and the site switches.
 */
import { createHash } from "node:crypto";
import { createRepos, hashCode, LEGACY_SALT, type Repos } from "@mib/db";
import { cheat as cheatTable, user } from "@mib/db/schema";
import { createSqliteDb, migrateSqlite, type SqliteDb } from "@mib/db/sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  accessAllows,
  arcadeCall,
  cheat,
  cheatsSettings,
  heroToken,
  loadSave,
  pageConfig,
  playGate,
  storeSave,
  submitScore,
  type PlayCtx,
} from "../src/games/arcade-api.ts";
import type { Viewer } from "../src/lib/guard.ts";
import { effectivePermissions } from "../src/lib/permissions.ts";
import type { Switches } from "../src/lib/site.ts";

/** Same as SWITCH_DEFAULTS in src/lib/site.ts (not imported: that file opens the real database). */
const SWITCH_DEFAULTS: Switches = {
  registration: true,
  guestPlay: true,
  tickets: true,
  store: true,
  payments: false,
  ads: true,
  leaderboards: true,
  likes: true,
  tracking: true,
  maintenance: false,
};

const testHasher = {
  hash: async (plain: string) => "test$" + createHash("sha256").update(plain).digest("hex"),
  verify: async (hash: string, plain: string) => hash === "test$" + createHash("sha256").update(plain).digest("hex"),
};

let db: SqliteDb;
let repos: Repos;
let jar: Map<string, string>;
let calls: Map<string, number>;

function viewer(role: string | null, id = "u1"): Viewer {
  if (!role) return { user: null, role: "guest", permissions: effectivePermissions("guest") };
  return { user: { id, name: "Amina Bello", email: `${id}@example.test`, role }, role, permissions: effectivePermissions(role) };
}

function ctx(v: Viewer, opts: { switches?: Partial<Switches>; now?: number } = {}): PlayCtx {
  return {
    repos,
    viewer: v,
    switches: { ...SWITCH_DEFAULTS, ...opts.switches } as Switches,
    now: opts.now ?? 1_800_000_000_000,
    secret: "test-secret",
    cookies: { get: (n) => jar.get(n), set: (n, v) => void jar.set(n, v) },
    limited: (key, limit) => {
      const n = (calls.get(key) ?? 0) + 1;
      calls.set(key, n);
      return n > limit;
    },
  };
}

beforeEach(async () => {
  db = createSqliteDb(":memory:");
  migrateSqlite(db);
  repos = createRepos(db, { hasher: testHasher });
  jar = new Map();
  calls = new Map();
  await db.insert(user).values({ id: "u1", name: "Amina Bello", email: "u1@example.test" });
  await repos.games.upsert({ slug: "light-bender", title: "Light Bender", status: "live", entry: "bender" });
  await repos.games.upsert({ slug: "wavefront", title: "Wavefront", status: "live", entry: "shooter", enabled: false });
});

describe("playGate", () => {
  it("lets players in and keeps hidden or switched-off games to staff", async () => {
    const bender = await repos.games.getBySlug("light-bender");
    const wave = await repos.games.getBySlug("wavefront");
    expect(playGate(bender, viewer(null), { ...SWITCH_DEFAULTS })).toMatchObject({ ok: true });
    expect(playGate(undefined, viewer("player"), { ...SWITCH_DEFAULTS })).toMatchObject({ ok: false, status: 404 });
    expect(playGate(wave, viewer("player"), { ...SWITCH_DEFAULTS })).toMatchObject({ ok: false, status: 404 });
    expect(playGate(wave, viewer("moderator"), { ...SWITCH_DEFAULTS })).toMatchObject({ ok: true });
  });

  it("respects the guest-play and maintenance switches", async () => {
    const g = await repos.games.getBySlug("light-bender");
    expect(playGate(g, viewer(null), { ...SWITCH_DEFAULTS, guestPlay: false })).toMatchObject({ ok: false, status: 401 });
    expect(playGate(g, viewer("player"), { ...SWITCH_DEFAULTS, guestPlay: false })).toMatchObject({ ok: true });
    expect(playGate(g, viewer("player"), { ...SWITCH_DEFAULTS, maintenance: true })).toMatchObject({ ok: false, status: 503 });
    expect(playGate(g, viewer("admin"), { ...SWITCH_DEFAULTS, maintenance: true })).toMatchObject({ ok: true });
  });
});

describe("access rules for cheats and heroes", () => {
  it("matches the old modes", () => {
    expect(accessAllows(null, viewer(null))).toBe(true);
    expect(accessAllows("code", viewer(null))).toBe(true);
    expect(accessAllows("signed", viewer(null))).toBe(false);
    expect(accessAllows("signed", viewer("player"))).toBe(true);
    expect(accessAllows("staff", viewer("player"))).toBe(false);
    expect(accessAllows("staff", viewer("moderator"))).toBe(true);
    expect(accessAllows("named", viewer("player", "u9"), ["u9"])).toBe(true);
    expect(accessAllows("named", viewer("player", "u8"), ["u9"])).toBe(false);
  });
});

describe("page config (data-gm-config)", () => {
  const codes = [
    { key: "skip", channel: "typed" as const, access: null, legacyHash: "a".repeat(64) },
    { key: "skip", channel: "dial" as const, access: null, legacyHash: "b".repeat(64) },
    { key: "god", channel: "any" as const, access: "staff" as const, legacyHash: null },
  ];

  it("sends old hashes only, groups by cheat and hides staff cheats from players", () => {
    const cfg = pageConfig(codes, cheatsSettings({}, false), viewer("player"));
    expect(cfg.cheats).toEqual([{ id: "skip", typed: "a".repeat(64), dial: "b".repeat(64) }]);
    const staff = pageConfig(codes, cheatsSettings({}, false), viewer("moderator"));
    expect(staff.cheats.map((c) => c.id)).toEqual(["skip", "god"]);
    expect(JSON.stringify(staff)).not.toMatch(/code/i);
  });

  it("sends a list that matches nothing when cheats are off (so game defaults do not apply)", () => {
    const cfg = pageConfig(codes, cheatsSettings({ cheatsEnabled: false }, false), viewer("player"));
    expect(cfg.cheats).toEqual([{ id: "-", typed: "", dial: "" }]);
    expect(cfg.cheatsEnabled).toBe(false);
  });

  it("takes the hero reveal from the game settings and the boards rule from the site", () => {
    const s = cheatsSettings({ heroReveal: { name: "M.I. BUGAJE", combo: "Up Up", swipe: "Up Down" } }, true);
    const cfg = pageConfig([], s, viewer(null));
    expect(cfg.hero).toEqual({ enabled: true, name: "M.I. BUGAJE", combo: "Up Up", swipe: "Up Down" });
    expect(cfg.cheatsOnBoards).toBe(true);
    expect(cheatsSettings({ cheatsOnBoards: false }, true).cheatsOnBoards).toBe(false);
  });
});

describe("arcade API: me and result", () => {
  it("asks guests to sign in", async () => {
    const r = await arcadeCall(ctx(viewer(null)), "GET", "me", {});
    expect(r.status).toBe(401);
    const res = await arcadeCall(ctx(viewer(null)), "POST", "result/", { game: "light-bender", result: "win" });
    expect(res.status).toBe(401);
  });

  it("records a win: coins, XP, badge and a leaderboard score", async () => {
    const r = await arcadeCall(ctx(viewer("player")), "POST", "result/", { game: "light-bender", result: "win", stage: 2, score: 240 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ earned_coins: 40, earned_xp: 80, coins: 40, xp: 80, counted: true });
    expect((r.body as { new_badges: { id: string }[] }).new_badges[0]!.id).toBe("first-win");
    const top = await repos.scores.top("light-bender");
    expect(top).toEqual([expect.objectContaining({ name: "Amina B.", score: 240 })]);
    const me = await arcadeCall(ctx(viewer("player")), "GET", "me/", {});
    expect(me.body).toMatchObject({ coins: 40, level: 1, badges: [{ id: "first-win" }] });
  });

  it("refuses a second result within 15 seconds, and results for switched-off games", async () => {
    const c = ctx(viewer("player"));
    await arcadeCall(c, "POST", "result", { game: "light-bender", result: "lose", score: 5 });
    const again = await arcadeCall(c, "POST", "result", { game: "light-bender", result: "lose", score: 5 });
    expect(again.status).toBe(400);
    const off = await arcadeCall(c, "POST", "result", { game: "wavefront", result: "win", score: 5 });
    expect(off).toMatchObject({ status: 400, body: { error: "This game is switched off." } });
  });

  it("keeps cheated runs off the boards unless the site allows them", async () => {
    await arcadeCall(ctx(viewer("player")), "POST", "result", { game: "light-bender", result: "win", score: 900, cheated: true });
    expect(await repos.scores.top("light-bender")).toEqual([]);
    expect(await repos.scores.top("light-bender", { includeCheated: true })).toHaveLength(1);
  });

  it("syncs offline results once each", async () => {
    const now = 1_800_000_000_000;
    const items = [
      { cid: "abcdefgh1", kind: "result", at: now - 60_000, data: { game: "light-bender", result: "win", score: 10 } },
      { cid: "abcdefgh2", kind: "result", at: now - 30_000, data: { game: "light-bender", result: "win", score: 20 } },
      { cid: "short", kind: "result", at: now, data: {} },
    ];
    const c = ctx(viewer("player"), { now });
    const r = await arcadeCall(c, "POST", "sync", { items });
    expect(r.body).toMatchObject({ done: ["abcdefgh1", "abcdefgh2"], rejected: [] });
    const again = await arcadeCall(c, "POST", "sync", { items });
    expect(again.body).toMatchObject({ done: ["abcdefgh1", "abcdefgh2"] });
    expect(await repos.scores.top("light-bender", { limit: 10 })).toHaveLength(2);
  });

  it("counts an offline result once even across server restarts (the ids are in the database)", async () => {
    const now = 1_800_000_000_000;
    const items = [{ cid: "6f1c2b9a-0d3e-4c55-9f00-aa11bb22cc33", kind: "result", at: now - 90_000, data: { game: "light-bender", result: "win", score: 30 } }];
    await arcadeCall(ctx(viewer("player"), { now }), "POST", "sync", { items });
    calls = new Map(); // a fresh server process: in-memory rate-limit state is gone
    const again = await arcadeCall(ctx(viewer("player"), { now: now + 5_000 }), "POST", "sync", { items });
    expect(again.body).toMatchObject({ done: [items[0]!.cid], rejected: [] });
    expect(await repos.scores.top("light-bender", { limit: 10 })).toHaveLength(1);
    const prof = await repos.profiles.getForUser("u1");
    expect((await repos.offline.listForProfile(prof!.id)).map((r) => r.ok)).toEqual([true]);
  });

  it("refuses offline results that belong to another account, and records refused items", async () => {
    const now = 1_800_000_000_000;
    const c = ctx(viewer("player"), { now });
    const wrong = await arcadeCall(c, "POST", "sync", { owner: "uu2", items: [{ cid: "zzzzzzzz1", kind: "result", at: now, data: { game: "light-bender", result: "win" } }] });
    expect(wrong.status).toBe(409);
    const guest = await arcadeCall(c, "POST", "sync", { owner: "guest", items: [] });
    expect(guest.status).toBe(409);
    const r = await arcadeCall(c, "POST", "sync", { owner: "uu1", items: [{ cid: "yyyyyyyy1", kind: "nonsense", at: now, data: { game: "light-bender" } }] });
    expect(r.body).toMatchObject({ done: [], rejected: [{ cid: "yyyyyyyy1" }] });
    // A refused item is not retried into a different outcome later.
    const again = await arcadeCall(c, "POST", "sync", { owner: "uu1", items: [{ cid: "yyyyyyyy1", kind: "result", at: now, data: { game: "light-bender", result: "win" } }] });
    expect(again.body).toMatchObject({ done: ["yyyyyyyy1"] });
    expect(await repos.scores.top("light-bender", { limit: 10 })).toHaveLength(0);
  });

  it("runs the shop through the profile", async () => {
    const c = ctx(viewer("player"));
    const poor = await arcadeCall(c, "POST", "buy", { item: "kit-volt" });
    expect(poor.status).toBe(400);
    const prof = await repos.profiles.getOrCreateForUser("u1", "Amina Bello");
    await repos.profiles.addRewards(prof.id, { coins: 500 });
    const bought = await arcadeCall(c, "POST", "buy", { item: "kit-volt" });
    expect(bought.body).toMatchObject({ coins: 380, owned: ["kit-volt"] });
    const worn = await arcadeCall(c, "POST", "equip", { item: "kit-volt" });
    expect(worn.body).toMatchObject({ equipped: { kit: "kit-volt" } });
    const hidden = await arcadeCall(c, "POST", "privacy", { on_leaderboard: false });
    expect(hidden.body).toMatchObject({ on_leaderboard: false });
  });
});

describe("cloud saves", () => {
  it("saves only the game's own keys, and loads them back", async () => {
    const c = ctx(viewer("player"));
    const data = { at: 123, keys: { "ee-arcade-bender": '{"done":[1]}', "ee-arcade-forge": "x", "other": "y" } };
    const saved = await storeSave(c, "light-bender", { data }, 100);
    expect(saved.status).toBe(200);
    const loaded = await loadSave(c, "light-bender");
    expect(loaded.body).toMatchObject({ save: { data: { at: 123, keys: { "ee-arcade-bender": '{"done":[1]}' } } } });
    expect(JSON.stringify(loaded.body)).not.toContain("ee-arcade-forge");
  });

  it("refuses guests, unknown slots and saves that are too big", async () => {
    expect((await loadSave(ctx(viewer(null)), "light-bender")).status).toBe(401);
    expect((await loadSave(ctx(viewer("player")), "light-bender", "9")).status).toBe(400);
    expect((await storeSave(ctx(viewer("player")), "light-bender", { data: {} }, 5_000_000)).status).toBe(413);
    expect((await storeSave(ctx(viewer("player")), "nope", { data: {} }, 10)).status).toBe(404);
  });

  it("with a base version, never overwrites progress saved elsewhere (409 + the current save)", async () => {
    const c = ctx(viewer("player"));
    const first = await storeSave(c, "light-bender", { data: { at: 1, keys: { "ee-arcade-bender": "A" } }, base: 0 }, 100);
    expect(first.status).toBe(200);
    const v1 = (first.body as { version: number }).version;
    expect(((await loadSave(c, "light-bender")).body as { save: { version: number } }).save.version).toBe(v1);

    // A device that was offline and never saw v1:
    const stale = await storeSave(c, "light-bender", { data: { at: 2, keys: { "ee-arcade-bender": "B" } }, base: 0 }, 100);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ conflict: true, save: { version: v1, data: { keys: { "ee-arcade-bender": "A" } } } });

    // After merging, it sends again with the version it now knows.
    const merged = await storeSave(c, "light-bender", { data: { at: 3, keys: { "ee-arcade-bender": "AB" } }, base: v1 }, 100);
    expect(merged.status).toBe(200);
    expect((merged.body as { version: number }).version).toBeGreaterThan(v1);

    // No base: the old "last write wins" behaviour, for pages that are already open.
    expect((await storeSave(c, "light-bender", { data: { at: 4, keys: {} } }, 100)).status).toBe(200);
  });

  it("refuses a save queued by another account", async () => {
    const r = await storeSave(ctx(viewer("player")), "light-bender", { data: { at: 1, keys: {} }, owner: "u9", base: 0 }, 10);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ ok: false });
  });
});

describe("cheats and the secret character", () => {
  it("checks typed codes on the server, by access rule", async () => {
    await repos.cheats.create({ gameSlug: "light-bender", key: "skip", label: "Skip", code: "openup", channel: "typed" });
    const r = await cheat(ctx(viewer(null)), "light-bender", { code: "OPEN UP", channel: "typed" });
    expect(r.body).toEqual({ ok: true, key: "skip", effect: {} });
    const wrong = await cheat(ctx(viewer(null)), "light-bender", { code: "nothing", channel: "typed" });
    expect(wrong.body).toEqual({ ok: true, key: null });
    await repos.gameSettings.update("light-bender", { cheatsEnabled: false });
    const off = await cheat(ctx(viewer(null)), "light-bender", { code: "openup", channel: "typed" });
    expect(off.body).toEqual({ ok: true, key: null });
  });

  it("still accepts imported codes on their old hash", async () => {
    await db.insert(cheatTable).values({
      gameSlug: "light-bender",
      key: "hint",
      label: "Hints",
      channel: "dial",
      codeSalt: LEGACY_SALT,
      codeHash: await hashCode("light-bender", "*123#", LEGACY_SALT),
    });
    const r = await cheat(ctx(viewer(null)), "light-bender", { code: "*123#", channel: "dial" });
    expect(r.body).toMatchObject({ key: "hint" });
  });

  it("unlocks the hero with the right code and remembers it with a signed cookie", async () => {
    await repos.heroes.create({ name: "M.I. BUGAJE", code: "makercode", gameSlug: "*" });
    const c = ctx(viewer("player"));
    expect((await arcadeCall(c, "POST", "hero", { slug: "light-bender", code: "wrong" })).body).toEqual({ ok: false });
    expect((await arcadeCall(c, "POST", "hero", { slug: "light-bender", check: true })).body).toEqual({ ok: false });
    const ok = await arcadeCall(c, "POST", "hero", { slug: "light-bender", code: "makercode" });
    expect(ok.body).toEqual({ ok: true, name: "M.I. BUGAJE" });
    expect(jar.get("mib_hero_light-bender")).toBe(heroToken("test-secret", "light-bender", "u1"));
    expect((await arcadeCall(c, "POST", "hero", { slug: "light-bender", check: true })).body).toEqual({ ok: true });
    // A cookie made for someone else does not count.
    jar.set("mib_hero_light-bender", heroToken("test-secret", "light-bender", "guest"));
    expect((await arcadeCall(c, "POST", "hero", { slug: "light-bender", check: true })).body).toEqual({ ok: false });
  });

  it("limits wrong hero guesses", async () => {
    const c = ctx(viewer(null));
    for (let i = 0; i < 8; i++) await arcadeCall(c, "POST", "hero", { slug: "light-bender", code: "x" + i });
    const r = await arcadeCall(c, "POST", "hero", { slug: "light-bender", code: "again" });
    expect(r.body).toMatchObject({ ok: false, wait: true });
  });
});

describe("scores from contract games", () => {
  it("submits and returns the best", async () => {
    const r = await submitScore(ctx(viewer("player")), "light-bender", { score: 77, details: { level: 1 } });
    expect(r.body).toMatchObject({ ok: true, best: 77 });
    expect((await submitScore(ctx(viewer("player")), "light-bender", { score: -1 })).status).toBe(400);
    expect((await submitScore(ctx(viewer(null)), "light-bender", { score: 5 })).status).toBe(401);
  });

  it("counts a score sent with an offline id once", async () => {
    const c = ctx(viewer("player"));
    const cid = "a1b2c3d4-e5f6-4711-8899-aabbccddeeff";
    expect((await submitScore(c, "light-bender", { score: 50, cid })).body).toMatchObject({ ok: true, best: 50 });
    expect((await submitScore(c, "light-bender", { score: 50, cid })).body).toMatchObject({ ok: true, duplicate: true, best: 50 });
    expect(await repos.scores.top("light-bender", { limit: 10 })).toHaveLength(1);
    expect((await submitScore(c, "light-bender", { score: 1, cid: "no" })).status).toBe(400);
  });
});
