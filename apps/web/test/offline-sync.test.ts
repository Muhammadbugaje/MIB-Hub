/**
 * The offline core (public/offline/mib-sync.js): download plans, finding what
 * the play page links to, merging saves, and the outbox that sends saves,
 * scores and results later, exactly once.
 *
 * The last block runs the outbox against the real server code
 * (src/games/arcade-api.ts) and an in-memory database, so "counted once" and
 * "no progress lost" are checked end to end.
 */
import { createHash } from "node:crypto";
import { createRepos, type Repos } from "@mib/db";
import { user } from "@mib/db/schema";
import { createSqliteDb, migrateSqlite } from "@mib/db/sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { arcadeCall, storeSave, submitScore, type PlayCtx } from "../src/games/arcade-api.ts";
import type { Viewer } from "../src/lib/guard.ts";
import { effectivePermissions } from "../src/lib/permissions.ts";
import type { Switches } from "../src/lib/site.ts";
import { FakeCache, FakeCaches, fakeFetch, loadSync, memStore, type Any } from "./offline-fakes.ts";

const S: Any = loadSync({ crypto: globalThis.crypto });

describe("ids and sizes", () => {
  it("makes UUID-shaped ids the server accepts", () => {
    const ids = new Set(Array.from({ length: 200 }, () => S.cid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const noCrypto = loadSync({});
    expect(noCrypto.cid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("formats sizes", () => {
    expect(S.size(0)).toBe("1 KB");
    expect(S.size(900_000)).toBe("879 KB");
    expect(S.size(6_400_000)).toBe("6.1 MB");
    expect(S.size(52_428_800)).toBe("50 MB");
  });
});

describe("download plans", () => {
  const manifest = {
    version: "v2",
    files: [
      { url: "/play/_shared/js/games/arcade.js", bytes: 100, hash: "a2" },
      { url: "/play/_shared/js/games/bender.js", bytes: 50, hash: "b1" },
      { url: "/play/_shared/audio/sfx/core/click_1.ogg", bytes: 10, hash: "c1", variant: "ogg" },
      { url: "/play/_shared/audio/sfx/core/click_1.m4a", bytes: 12, hash: "c2", variant: "m4a" },
    ],
  };
  it("keeps one sound format", () => {
    expect(S.filesFor(manifest, "ogg").map((f: Any) => f.url)).not.toContain("/play/_shared/audio/sfx/core/click_1.m4a");
    expect(S.filesFor(manifest, "m4a")).toHaveLength(3);
    expect(S.pickVariant(true)).toBe("ogg");
    expect(S.pickVariant(false)).toBe("m4a");
  });
  it("fetches everything the first time, and only what changed on an update", () => {
    const first = S.planDownload(manifest, "ogg", null);
    expect(first.fetch).toHaveLength(3);
    expect(first.bytes).toBe(160);
    const old = { files: [{ url: "/play/_shared/js/games/arcade.js", hash: "a1" }, { url: "/play/_shared/js/games/bender.js", hash: "b1" }] };
    const upd = S.planDownload(manifest, "ogg", old);
    expect(upd.fetch.map((f: Any) => f.url)).toEqual(["/play/_shared/js/games/arcade.js", "/play/_shared/audio/sfx/core/click_1.ogg"]);
    expect(upd.reuse.map((f: Any) => f.url)).toEqual(["/play/_shared/js/games/bender.js"]);
    expect(upd.bytes + upd.reuseBytes).toBe(upd.total);
  });
  it("tells none / ready / update apart", () => {
    expect(S.downloadState(null, manifest)).toBe("none");
    expect(S.downloadState({ version: "v2" }, manifest)).toBe("ready");
    expect(S.downloadState({ version: "v1" }, manifest)).toBe("update");
    expect(S.downloadState({ version: "v1" }, null)).toBe("ready"); // offline: cannot tell, the copy works
  });
  it("names caches per game and version", () => {
    expect(S.parseCacheName(S.cacheName("light-bender", "abc123-lz9"))).toEqual({ slug: "light-bender", version: "abc123-lz9" });
    expect(S.parseCacheName("mib-shell-v1")).toBeNull();
    expect(S.parseCacheName("ee-arcade-light-bender")).toBeNull();
  });
});

describe("what the play page links to", () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="/_astro/BaseLayout.Ab12.css">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="canonical" href="/play/light-bender">
    <script type="module" src="/_astro/page.Cd34.js"></script>
    <link rel="stylesheet" href="https://fonts.example.com/x.css">
  </head><body>
    <a href="/games/light-bender">Back</a><a href="/auth/sign-in?next=%2Fplay">Sign in</a>
    <img class="mp-icon" src="/games/light-bender/icon.png" alt="">
    <div class="gm-stage" data-gm-three="/play/_shared/vendor/three@0.158.0/build/three.module.min.js"></div>
    <astro-island uid="1" component-url="/_astro/GameHost.Ef56.js" renderer-url="/_astro/client.Gh78.js"></astro-island>
    <img src="/api/games/x/avatar.png"><img src="data:image/png;base64,AAAA">
    <script type="application/json" id="mib-play-config">{"slug":"light-bender","scripts":["/play/_shared/js/games/arcade.js","/play/_shared/js/games/bender.js"]}</script>
    <script src="/play/_shared/mib/mib-play.js" defer></script>
  </body></html>`;

  it("finds styles, scripts, island code, images and the bridge's scripts, not links or other sites", () => {
    const found = S.discover(html, "/play/light-bender");
    expect(found).toEqual(
      expect.arrayContaining([
        "/_astro/BaseLayout.Ab12.css",
        "/favicon.svg",
        "/_astro/page.Cd34.js",
        "/games/light-bender/icon.png",
        "/play/_shared/vendor/three@0.158.0/build/three.module.min.js",
        "/_astro/GameHost.Ef56.js",
        "/_astro/client.Gh78.js",
        "/play/_shared/js/games/arcade.js",
        "/play/_shared/js/games/bender.js",
        "/play/_shared/mib/mib-play.js",
      ]),
    );
    expect(found).not.toContain("/play/light-bender");
    expect(found).not.toContain("/games/light-bender");
    expect(found.some((p: string) => p.startsWith("/auth") || p.startsWith("/api") || p.includes("fonts.example"))).toBe(false);
    expect(new Set(found).size).toBe(found.length);
  });

  it("follows fonts in stylesheets and imports in built scripts", () => {
    const css = `@font-face{src:url(./inter-var.Q1.woff2) format("woff2")}@import "/_astro/more.css";.a{background:url('data:image/png;base64,x')}.b{background:url("/games/x/cover.jpg")}`;
    expect(S.cssUrls(css, "/_astro/BaseLayout.Ab12.css")).toEqual(["/_astro/inter-var.Q1.woff2", "/_astro/more.css", "/games/x/cover.jpg"]);
    const js = `import{a as b}from"./chunk.Z1.js";import"./side.Z2.js";const m=()=>import("./demo-hello.Z3.js");import x from "https://cdn.example/x.js";`;
    expect(S.jsImports(js, "/_astro/GameHost.Ef56.js")).toEqual(["/_astro/chunk.Z1.js", "/_astro/side.Z2.js", "/_astro/demo-hello.Z3.js"]);
  });

  it("only keeps a play page that says it is fine to keep", () => {
    expect(S.pageOk(`<meta name="mib-offline" content="light-bender">`, "light-bender")).toBe(true);
    expect(S.pageOk(`<meta name="mib-offline" content="wavefront">`, "light-bender")).toBe(false);
    expect(S.pageOk(`<h2>Sign in to play</h2>`, "light-bender")).toBe(false);
  });

  it("fetches files into a cache, following links, and reports failures", async () => {
    const cache = new FakeCache();
    const log: string[] = [];
    const fetch = fakeFetch(
      {
        "/_astro/a.css": "@font-face{src:url(./f.woff2)}",
        "/_astro/f.woff2": "FONT",
        "/_astro/m.js": 'import"./n.js";',
        "/_astro/n.js": "export{}",
        "/play/_shared/js/games/arcade.js": "/* arcade */",
      },
      log,
    );
    const seen: number[] = [];
    const out = await S.fetchInto(cache, ["/_astro/a.css", "/_astro/m.js", "/play/_shared/js/games/arcade.js", "/missing.js"], {
      fetch,
      onFile: (_p: string, b: number) => seen.push(b),
    });
    expect(out.failed).toEqual(["/missing.js"]);
    expect([...cache.entries.keys()].sort()).toEqual(["/_astro/a.css", "/_astro/f.woff2", "/_astro/m.js", "/_astro/n.js", "/play/_shared/js/games/arcade.js"]);
    expect(out.bytes).toBe(out.files.reduce((n: number, f: Any) => n + f.bytes, 0));
    expect(seen.length).toBe(6);
    // skip(): already have it
    const again = await S.fetchInto(cache, ["/_astro/f.woff2"], { fetch, skip: () => true });
    expect(again.files).toEqual([]);
  });

  it("lists finished downloads only (a cache without its description is unfinished)", async () => {
    const caches = new FakeCaches();
    const done = await caches.open(S.cacheName("light-bender", "v1-a"));
    await done.put(S.META_URL, new Response(JSON.stringify({ slug: "light-bender", title: "Light Bender", version: "v1", bytes: 10, at: 5 })));
    await caches.open(S.cacheName("wavefront", "v1-b")); // interrupted download
    await caches.open("mib-shell-v1");
    const list = await S.listDownloads(caches);
    expect(list.map((m: Any) => m.slug)).toEqual(["light-bender"]);
    expect(list[0].cache).toBe("mib-game-light-bender@v1-a");
  });
});

describe("merging two copies of a save", () => {
  it("measures progress from levels, stars and lists, not money or positions", () => {
    expect(S.progressOf(JSON.stringify({ level: 5, stars: [1, 1, 0] }))).toBeGreaterThan(S.progressOf(JSON.stringify({ level: 3, stars: [1] })));
    expect(S.progressOf(JSON.stringify({ level: 3, coins: 9999, x: 500 }))).toBe(S.progressOf(JSON.stringify({ level: 3, coins: 0, x: 0 })));
    expect(S.progressOf("12")).toBe(12);
    expect(S.progressOf("not json")).toBe(0);
    expect(S.progressOf(JSON.stringify({ unlocked: { a: 1, b: 1, c: 1 } }))).toBeGreaterThan(S.progressOf(JSON.stringify({ unlocked: { a: 1 } })));
  });

  it("keeps every key, the furthest progress per key, and the newer setting; returns what lost", () => {
    const local = {
      "ee-arcade-bender": JSON.stringify({ done: [1, 2, 3, 4] }), // played further offline
      "ee-arcade-bender-best": "300",
      "ee-arcade-set-light-bender": JSON.stringify({ volume: 0.2 }),
      "ee-arcade-bender-only-here": "1",
    };
    const cloud = {
      "ee-arcade-bender": JSON.stringify({ done: [1, 2] }),
      "ee-arcade-bender-best": "450", // a better score on the other device
      "ee-arcade-set-light-bender": JSON.stringify({ volume: 0.9 }),
      "ee-arcade-bender-only-cloud": "1",
    };
    const m = S.mergeKeys(local, cloud, 2000, 1000);
    expect(m.keys["ee-arcade-bender"]).toBe(local["ee-arcade-bender"]);
    expect(m.keys["ee-arcade-bender-best"]).toBe("450");
    expect(m.keys["ee-arcade-set-light-bender"]).toBe(local["ee-arcade-set-light-bender"]); // newer
    expect(m.keys["ee-arcade-bender-only-here"]).toBe("1");
    expect(m.keys["ee-arcade-bender-only-cloud"]).toBe("1");
    expect(Object.keys(m.losers).sort()).toEqual(["ee-arcade-bender", "ee-arcade-bender-best", "ee-arcade-set-light-bender"]);
    expect(m.losers["ee-arcade-bender-best"]).toBe("300");
    // equal progress: the newer copy wins
    const tie = S.mergeKeys({ k: JSON.stringify({ level: 2, name: "A" }) }, { k: JSON.stringify({ level: 2, name: "B" }) }, 1, 2);
    expect(JSON.parse(tie.keys.k).name).toBe("B");
  });

  it("is the same whichever side merges (both devices converge)", () => {
    const a = { k1: JSON.stringify({ level: 4 }), k2: "7" };
    const b = { k1: JSON.stringify({ level: 2 }), k2: "9", k3: "x" };
    expect(S.mergeKeys(a, b, 1, 2).keys).toEqual(S.mergeKeys(b, a, 2, 1).keys);
  });

  it("resolves whole saves of other games by progress, then age", () => {
    const r = S.resolveSave({ at: 5, chapter: 3 }, { at: 9, chapter: 2 }, 10);
    expect(r.data.chapter).toBe(3);
    expect(r.loser.chapter).toBe(2);
    const legacy = S.resolveSave({ keys: { a: "1" }, at: 5 }, { keys: { b: "2" }, at: 9 }, 10);
    expect(legacy.data).toEqual({ keys: { a: "1", b: "2" }, at: 10 });
    expect(legacy.loser).toBeNull();
  });
});

describe("the outbox", () => {
  it("maps server answers to what to do", () => {
    expect(S.outcome(200, {})).toBe("done");
    expect(S.outcome(409, { conflict: true })).toBe("conflict");
    expect(S.outcome(409, { error: "another account" })).toBe("hold");
    expect(S.outcome(401, {})).toBe("hold");
    expect(S.outcome(0, null)).toBe("retry");
    expect(S.outcome(429, {})).toBe("retry");
    expect(S.outcome(503, {})).toBe("retry");
    expect(S.outcome(400, {})).toBe("drop");
    expect(S.backoff(1)).toBe(60_000);
    expect(S.backoff(20)).toBe(3_600_000);
  });

  it("keeps one waiting save per player and game, and one item per score", () => {
    const a = S.saveItem({ slug: "light-bender", owner: "uu1", data: { keys: {}, at: 1 }, base: 5 });
    const b = S.saveItem({ slug: "light-bender", owner: "uu1", data: { keys: {}, at: 2 }, base: 5 });
    expect(a.id).toBe(b.id);
    expect(a.body.base).toBe(5);
    const s1 = S.scoreItem({ slug: "g", owner: "uu1", score: 5 });
    const s2 = S.scoreItem({ slug: "g", owner: "uu1", score: 5 });
    expect(s1.id).not.toBe(s2.id);
    expect(s1.body.cid).toBe(s1.id);
  });

  it("sends due items, removes the sent and the hopeless, holds others' and backs off on failure", async () => {
    const store = memStore();
    await store.put({ ...S.scoreItem({ slug: "ok", owner: "uu1", score: 1 }), at: 1 });
    await store.put({ ...S.scoreItem({ slug: "bad", owner: "uu1", score: 1 }), at: 2 });
    await store.put({ ...S.scoreItem({ slug: "down", owner: "uu1", score: 1 }), at: 3 });
    await store.put({ ...S.scoreItem({ slug: "mine-not", owner: "uu1", score: 1 }), at: 4 });
    await store.put({ ...S.scoreItem({ slug: "later", owner: "uu1", score: 1 }), at: 5, next: 99_999 });
    await store.put({ ...S.scoreItem({ slug: "guest", owner: "guest", score: 1 }), at: 6 });
    const calls: { url: string; body: Any }[] = [];
    const fetch = async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body });
      if (url.includes("/ok/")) return new Response("{}", { status: 200 });
      if (url.includes("/bad/")) return new Response('{"error":"Bad"}', { status: 400 });
      if (url.includes("/mine-not/")) return new Response('{"error":"other"}', { status: 409 });
      throw new TypeError("Failed to fetch");
    };
    const r = await S.flush(store, { fetch, now: 1000, owner: "uu1" });
    expect(r).toMatchObject({ sent: 1, dropped: 1, held: 1, retry: 1 });
    expect(calls.map((c) => c.url)).toEqual(["/api/games/ok/score", "/api/games/bad/score", "/api/games/down/score", "/api/games/mine-not/score"]);
    expect(calls[0]!.body).toMatchObject({ owner: "uu1", cid: expect.any(String), score: 1 });
    const left = new Map((await store.all()).map((i: Any) => [i.slug, i]));
    expect([...left.keys()].sort()).toEqual(["down", "guest", "later", "mine-not"]);
    expect(left.get("down")).toMatchObject({ tries: 1, next: 61_000 });
  });

  it("moves a guest's items to the account that signs in, only when asked", async () => {
    const store = memStore();
    await store.put(S.saveItem({ slug: "g", owner: "guest", data: { keys: { a: "1" } } }));
    await store.put(S.scoreItem({ slug: "g", owner: "guest", score: 3 }));
    await store.put(S.scoreItem({ slug: "g", owner: "uu2", score: 3 }));
    expect(await S.adopt(store, "guest", "uu1")).toBe(2);
    const all = await store.all();
    expect(all.filter((i: Any) => i.owner === "uu1")).toHaveLength(2);
    expect(all.find((i: Any) => i.kind === "save").id).toBe("save:uu1:g:auto");
    expect(all.filter((i: Any) => i.owner === "uu2")).toHaveLength(1);
    const arcade = memStore("cid");
    await arcade.put({ cid: "c1", user: "guest", kind: "result" });
    expect(await S.adopt(arcade, "guest", "uu1", "user")).toBe(1);
    expect((await arcade.get("c1")).user).toBe("uu1");
  });
});

/* ------------------------------------------------- against the real server */

const SWITCHES: Switches = {
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
const hasher = {
  hash: async (p: string) => "t$" + createHash("sha256").update(p).digest("hex"),
  verify: async (h: string, p: string) => h === "t$" + createHash("sha256").update(p).digest("hex"),
};

describe("offline items sent to the real server code", () => {
  let repos: Repos;
  let signedIn: string | null;
  let clock: number;

  beforeEach(async () => {
    const db = createSqliteDb(":memory:");
    migrateSqlite(db);
    repos = createRepos(db, { hasher });
    await db.insert(user).values({ id: "u1", name: "Amina Bello", email: "u1@example.test" });
    await repos.games.upsert({ slug: "light-bender", title: "Light Bender", status: "live", entry: "bender" });
    signedIn = "u1";
    clock = 1_800_000_000_000;
  });

  function ctx(): PlayCtx {
    const v: Viewer = signedIn
      ? { user: { id: signedIn, name: "Amina Bello", email: "x@example.test", role: "player" }, role: "player", permissions: effectivePermissions("player") }
      : { user: null, role: "guest", permissions: effectivePermissions("guest") };
    return { repos, viewer: v, switches: SWITCHES, now: clock, secret: "s", cookies: { get: () => undefined, set: () => undefined }, limited: () => false };
  }

  /** fetch, routed to the API handlers the site's routes call. */
  async function server(url: string, init: RequestInit): Promise<Response> {
    const body = JSON.parse(String(init.body ?? "{}"));
    let r;
    if (url === "/api/games/arcade/sync/") r = await arcadeCall(ctx(), "POST", "sync", body);
    else if (url.endsWith("/save")) r = await storeSave(ctx(), url.split("/")[3]!, body, JSON.stringify(body).length);
    else if (url.endsWith("/score")) r = await submitScore(ctx(), url.split("/")[3]!, body);
    else return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(r.body), { status: r.status });
  }

  it("counts a queued score once, even when two flushes race and one retries", async () => {
    const store = memStore();
    await store.put(S.scoreItem({ slug: "light-bender", owner: "uu1", score: 120 }));
    const copy = memStore();
    for (const i of await store.all()) await copy.put(i); // e.g. the page and Background Sync both hold it
    const [a, b] = await Promise.all([S.flush(store, { fetch: server }), S.flush(copy, { fetch: server })]);
    expect(a.sent + b.sent).toBe(2); // both are told "done"...
    expect(await repos.scores.top("light-bender", { limit: 10 })).toHaveLength(1); // ...but it counts once
  });

  it("counts queued legacy results once, and leaves a guest's results alone until adopted", async () => {
    const arcade = memStore("cid");
    const result = (cid: string, userKey: string, at: number) => ({ cid, user: userKey, kind: "result", at, data: { game: "light-bender", result: "win", score: 10 } });
    await arcade.put(result("r-0000001", "uu1", clock - 60_000));
    await arcade.put(result("r-0000002", "guest", clock - 20_000)); // results less than 15 s apart are refused as spam
    const first = await S.flushArcade(arcade, { fetch: server });
    expect(first).toMatchObject({ sent: 1, held: 1 });
    expect((await arcade.all()).map((i: Any) => i.cid)).toEqual(["r-0000002"]);
    // the same result again (an old copy left on another tab): not counted twice
    await arcade.put(result("r-0000001", "uu1", clock - 60_000));
    await S.flushArcade(arcade, { owner: "uu1", fetch: server });
    expect(await repos.scores.top("light-bender", { limit: 10 })).toHaveLength(1);
    // the player says "add to my account"
    await S.adopt(arcade, "guest", "uu1", "user");
    clock += 30_000;
    expect(await S.flushArcade(arcade, { fetch: server })).toMatchObject({ sent: 1 });
    expect(await arcade.all()).toEqual([]);
  });

  it("merges an offline save with newer progress from another device, losing nothing", async () => {
    // Device B (online) saved first.
    const b = await server("/api/games/light-bender/save", {
      body: JSON.stringify({ slot: "auto", base: 0, data: { at: 100, keys: { "ee-arcade-bender": JSON.stringify({ done: [1, 2, 3] }), "ee-arcade-bender-b": "on B" } } }),
    });
    expect(b.status).toBe(200);
    // Device A played offline from an older copy (base 0) and queued its save.
    const store = memStore();
    const backups = memStore();
    await store.put(
      S.saveItem({
        slug: "light-bender",
        owner: "uu1",
        base: 0,
        data: { at: 200, keys: { "ee-arcade-bender": JSON.stringify({ done: [1] }), "ee-arcade-bender-a": "on A" } },
      }),
    );
    const r = await S.flush(store, { fetch: server, backups, now: 300 });
    expect(r).toMatchObject({ sent: 1, merged: 1 });
    const prof = await repos.profiles.getForUser("u1");
    const saved = (await repos.progress.load(prof!.id, "light-bender"))!.data as Any;
    expect(saved.keys).toEqual({
      "ee-arcade-bender": JSON.stringify({ done: [1, 2, 3] }), // B's further progress kept
      "ee-arcade-bender-a": "on A", // A's offline-only progress kept
      "ee-arcade-bender-b": "on B",
    });
    // A's weaker copy of the shared key is kept as a backup on the device.
    expect((await backups.all())[0].data.keys).toEqual({ "ee-arcade-bender": JSON.stringify({ done: [1] }) });
    expect(await store.all()).toEqual([]);
  });

  it("holds items while nobody is signed in", async () => {
    signedIn = null;
    const store = memStore();
    await store.put(S.scoreItem({ slug: "light-bender", owner: "uu1", score: 5 }));
    expect(await S.flush(store, { fetch: server })).toMatchObject({ held: 1, sent: 0 });
    expect(await store.all()).toHaveLength(1);
  });
});
