/**
 * The service worker (public/sw.js), run in a stand-in worker scope: fake
 * Cache Storage, a fetch we control (online, offline, slow) and captured
 * event listeners. Checks what it serves for page loads and files, that it
 * leaves the API and other sites alone, and that Background Sync sends the
 * outbox.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeCaches, ORIGIN, loadSync, memStore, publicFile, type Any } from "./offline-fakes.ts";

type Listener = (e: Any) => void;

interface Worker {
  self: Any;
  caches: FakeCaches;
  listeners: Record<string, Listener>;
  net: { online: boolean; hang: boolean; routes: Record<string, () => Response>; log: string[] };
  posted: Any[];
}

function boot(): Worker {
  const caches = new FakeCaches();
  const listeners: Record<string, Listener> = {};
  const net = { online: true, hang: false, routes: {} as Record<string, () => Response>, log: [] as string[] };
  const posted: Any[] = [];
  const fetch = (input: string | Request): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input.url, ORIGIN);
    const path = url.pathname + url.search;
    net.log.push(path);
    if (net.hang) return new Promise(() => undefined);
    if (!net.online) return Promise.reject(new TypeError("Failed to fetch"));
    const r = net.routes[path] ?? net.routes[url.pathname];
    return Promise.resolve(r ? r() : new Response("missing", { status: 404 }));
  };
  const self: Any = {
    location: new URL(ORIGIN + "/sw.js"),
    navigator: { onLine: true },
    crypto: globalThis.crypto,
    addEventListener: (type: string, fn: Listener) => void (listeners[type] = fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined, matchAll: async () => [{ postMessage: (m: Any) => posted.push(m) }] },
  };
  const importScripts = (path: string) => {
    new Function("self", publicFile(path))(self);
  };
  new Function("self", "importScripts", "caches", "fetch", publicFile("/sw.js"))(self, importScripts, caches, fetch);
  return { self, caches, listeners, net, posted };
}

const html = (slug: string, extra = "") =>
  `<!doctype html><link rel="stylesheet" href="/_astro/site.A1.css"><meta name="mib-offline" content="${slug}">${extra}<p>${slug} page</p>`;
const page = (body: string) => () => new Response(body, { headers: { "content-type": "text/html" } });

/** Dispatch a fetch event; resolves the response the worker gave, or null if it let the browser handle it. */
async function dispatch(w: Worker, path: string, opts: { mode?: string; method?: string; origin?: string } = {}) {
  const got: { p: Promise<Response> | null } = { p: null };
  const waits: Promise<unknown>[] = [];
  const request = { url: (opts.origin ?? ORIGIN) + path, method: opts.method ?? "GET", mode: opts.mode ?? "no-cors" };
  w.listeners.fetch!({ request, respondWith: (p: Promise<Response>) => (got.p = p), waitUntil: (p: Promise<unknown>) => waits.push(p) });
  const res = got.p ? await got.p : null;
  await Promise.all(waits);
  return res;
}

/** Put a finished download of `slug` in Cache Storage (like mib-offline.js does). */
async function downloaded(w: Worker, slug: string, files: Record<string, string>) {
  const S = w.self.MIBSync;
  const c = await w.caches.open(S.cacheName(slug, "v1-x"));
  for (const [p, body] of Object.entries(files)) await c.put(p, new Response(body));
  await c.put(`/play/${slug}`, new Response(html(slug), { headers: { "content-type": "text/html" } }));
  await c.put(S.META_URL, new Response(JSON.stringify({ slug, title: slug, version: "v1", bytes: 1, at: 1, files: [] })));
  return c;
}

let w: Worker;
beforeEach(() => {
  w = boot();
  for (const p of ["/offline.html", "/offline/mib-sync.js", "/offline/mib-offline.js", "/favicon.svg"]) w.net.routes[p] = page(`file ${p}`);
});
afterEach(() => vi.useRealTimers());

describe("install and activate", () => {
  it("keeps the offline page and the offline scripts, and clears old shells", async () => {
    let done: Promise<unknown> = Promise.resolve();
    w.listeners.install!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    const shell = await w.caches.open(w.self.MIBSync.SHELL_CACHE);
    expect([...shell.entries.keys()].sort()).toEqual(["/favicon.svg", "/offline.html", "/offline/mib-offline.js", "/offline/mib-sync.js"]);
    expect(await (await shell.match("/offline.html"))!.text()).toBe("file /offline.html");
    await w.caches.open("mib-shell-v0");
    await w.caches.open("mib-game-light-bender@v1-x");
    w.listeners.activate!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(await w.caches.keys()).toEqual([w.self.MIBSync.SHELL_CACHE, "mib-game-light-bender@v1-x"]);
  });
});

describe("what it leaves alone", () => {
  it("does not touch the API, posts, other sites, the manifests, or pages it has no business with", async () => {
    expect(await dispatch(w, "/api/games/light-bender/save")).toBeNull();
    expect(await dispatch(w, "/play/_shared/js/games/arcade.js", { method: "POST" })).toBeNull();
    expect(await dispatch(w, "/x.js", { origin: "https://cdn.example" })).toBeNull();
    expect(await dispatch(w, "/offline/games/light-bender.json")).toBeNull();
    expect(await dispatch(w, "/sw.js")).toBeNull();
    expect(await dispatch(w, "/uploads/avatar.png")).toBeNull();
  });
});

describe("files", () => {
  it("online: always the network (no stale files); offline: the downloaded copy", async () => {
    await downloaded(w, "light-bender", { "/play/_shared/js/games/bender.js": "OLD" });
    w.net.routes["/play/_shared/js/games/bender.js"] = () => new Response("NEW");
    expect(await (await dispatch(w, "/play/_shared/js/games/bender.js"))!.text()).toBe("NEW");
    w.net.online = false;
    expect(await (await dispatch(w, "/play/_shared/js/games/bender.js"))!.text()).toBe("OLD");
    expect(await (await dispatch(w, "/play/_shared/js/games/bender.js?v=3"))!.text()).toBe("OLD"); // query ignored
    await expect(dispatch(w, "/play/_shared/js/games/never.js")).rejects.toThrow();
  });

  it("when the browser says it is offline, goes straight to the copy", async () => {
    await downloaded(w, "light-bender", { "/_astro/site.A1.css": "css" });
    w.self.navigator.onLine = false;
    w.net.log.length = 0;
    expect(await (await dispatch(w, "/_astro/site.A1.css"))!.text()).toBe("css");
    expect(w.net.log).toEqual([]);
  });
});

describe("page loads", () => {
  it("offline: a downloaded game's play page comes from the download", async () => {
    await downloaded(w, "light-bender", {});
    w.net.online = false;
    const r = await dispatch(w, "/play/light-bender", { mode: "navigate" });
    expect(await r!.text()).toContain("light-bender page");
  });

  it("offline: any other page gets the offline page (which lists the downloads)", async () => {
    let done: Promise<unknown> = Promise.resolve();
    w.listeners.install!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    w.net.online = false;
    expect(await (await dispatch(w, "/games/wavefront", { mode: "navigate" }))!.text()).toBe("file /offline.html");
    expect(await (await dispatch(w, "/play/wavefront", { mode: "navigate" }))!.text()).toBe("file /offline.html"); // not downloaded
  });

  it("online: the fresh page, which replaces the saved copy along with any new file it links to", async () => {
    const c = await downloaded(w, "light-bender", { "/_astro/site.A1.css": "css" });
    w.net.routes["/play/light-bender"] = page(html("light-bender", `<script src="/_astro/new.B2.js"></script>`));
    w.net.routes["/_astro/new.B2.js"] = () => new Response("js", { headers: { "content-type": "text/javascript" } });
    const r = await dispatch(w, "/play/light-bender", { mode: "navigate" });
    expect(await r!.text()).toContain("/_astro/new.B2.js");
    expect(await (await c.match("/play/light-bender"))!.text()).toContain("/_astro/new.B2.js");
    expect(await (await c.match("/_astro/new.B2.js"))!.text()).toBe("js");
    expect(w.net.log.filter((p) => p === "/_astro/site.A1.css")).toEqual([]); // already had it
  });

  it("does not replace the saved copy with a page that is not playable (signed out, maintenance)", async () => {
    const c = await downloaded(w, "light-bender", {});
    w.net.routes["/play/light-bender"] = page("<h2>Sign in to play Light Bender</h2>");
    await dispatch(w, "/play/light-bender", { mode: "navigate" });
    expect(await (await c.match("/play/light-bender"))!.text()).toContain("light-bender page");
  });

  it("on a connection that never answers, falls back to the download after 8 seconds", async () => {
    vi.useFakeTimers();
    await downloaded(w, "light-bender", {});
    w.net.hang = true;
    const p = dispatch(w, "/play/light-bender", { mode: "navigate" });
    await vi.advanceTimersByTimeAsync(8_100);
    expect(await (await p)!.text()).toContain("light-bender page");
  });
});

describe("Background Sync", () => {
  it("sends the outbox and the legacy results queue, then tells open pages", async () => {
    const S = w.self.MIBSync;
    const outbox = memStore();
    const arcade = memStore("cid");
    S.outbox = () => outbox;
    S.backups = () => memStore();
    S.arcadeOutbox = () => arcade;
    await outbox.put(S.scoreItem({ slug: "light-bender", owner: "uu1", score: 9 }));
    await arcade.put({ cid: "r-0000001", user: "uu1", kind: "result", at: 1, data: { game: "light-bender" } });
    w.net.routes["/api/games/light-bender/score"] = () => new Response('{"ok":true}');
    w.net.routes["/api/games/arcade/sync/"] = () => new Response('{"done":["r-0000001"],"rejected":[]}');
    let done: Promise<unknown> = Promise.resolve();
    w.listeners.sync!({ tag: "mib-outbox", waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    expect(await outbox.all()).toEqual([]);
    expect(await arcade.all()).toEqual([]);
    expect(w.posted).toEqual([
      { type: "mib-synced", sent: 1, merged: 0 },
      { type: "arcade-synced", n: 1 },
    ]);
  });

  it("asks the browser to retry later while the network is still down", async () => {
    const S = w.self.MIBSync;
    const outbox = memStore();
    S.outbox = () => outbox;
    S.backups = () => memStore();
    S.arcadeOutbox = () => memStore("cid");
    await outbox.put(S.scoreItem({ slug: "light-bender", owner: "uu1", score: 9 }));
    w.net.online = false;
    let done: Promise<unknown> = Promise.resolve();
    w.listeners.sync!({ tag: "ee-arcade-outbox", waitUntil: (p: Promise<unknown>) => (done = p) });
    await expect(done).rejects.toThrow();
    expect(await outbox.all()).toHaveLength(1);
  });
});

it("the offline core loads the same in a page and in the worker", () => {
  const S = loadSync({});
  expect(Object.keys(S).sort()).toEqual(Object.keys(boot().self.MIBSync).sort());
});
