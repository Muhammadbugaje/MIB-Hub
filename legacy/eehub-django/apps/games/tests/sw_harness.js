// Runs static/sw.js in Node with an in-memory Cache Storage and a switchable network, and checks how it treats
// arcade games saved for offline play. Prints one JSON line.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ORIGIN = "https://ee.test";
const src = fs.readFileSync(path.join(__dirname, "..", "..", "static", "sw.js"), "utf8")
  .replace('"__EE_PRECACHE__"', "[]").replace(/__EE_SW_VERSION__/g, "test1").replace(/__EE_OFFLINE_URL__/g, "/offline/");

function key(r) { const u = typeof r === "string" ? r : r.url; return new URL(u, ORIGIN).href; }
const store = new Map();
function cacheObj(name) {
  if (!store.has(name)) store.set(name, new Map());
  const m = store.get(name);
  return {
    match: async (r) => { const v = m.get(key(r)) || null; return v ? v.clone() : null; },
    put: async (r, res) => { m.set(key(r), res.clone ? res.clone() : res); },
    keys: async () => [...m.keys()].map((u) => ({ url: u })),
    delete: async (r) => m.delete(key(r)),
    add: async () => {},
  };
}
const caches = {
  open: async (n) => cacheObj(n),
  keys: async () => [...store.keys()],
  delete: async (n) => store.delete(n),
  match: async (r) => { for (const n of store.keys()) { const hit = await cacheObj(n).match(r); if (hit) return hit; } return null; },
};
let online = true, netHits = [];
async function fetchMock(r) {
  const u = typeof r === "string" ? r : r.url; netHits.push(new URL(u, ORIGIN).pathname);
  if (!online) throw new TypeError("Failed to fetch");
  const html = /\/arcade\/play\//.test(u);
  return new Response(html ? "<html>fresh page</html>" : "net:" + new URL(u, ORIGIN).pathname, { status: 200, headers: { "Content-Type": html ? "text/html; charset=utf-8" : "text/plain" } });
}
const listeners = {};
const self = { location: { origin: ORIGIN }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: () => {}, clients: { claim: async () => {}, matchAll: async () => [] } };
vm.runInNewContext(src, { self, caches, fetch: fetchMock, Response, Request, Headers, URL, Promise, setTimeout, clearTimeout, console, indexedDB: undefined });

function req(p, mode, accept) { return { url: ORIGIN + p, method: "GET", mode: mode || "no-cors", headers: new Headers(accept ? { Accept: accept } : {}) }; }
async function run(p, mode) {
  let out = null; const waits = [];
  listeners.fetch({ request: req(p, mode), respondWith(x) { out = x; }, waitUntil(x) { waits.push(x); } });
  if (!out) return "(not handled)";
  const r = await out; await Promise.all(waits);
  return r ? await r.text() : null;
}
(async () => {
  const o = { ok: true };
  try {
    const game = cacheObj("ee-arcade-light-bender"), shared = cacheObj("ee-arcade--shared");
    await game.put("/arcade/play/light-bender/", new Response("<html>saved page</html>", { headers: { "Content-Type": "text/html" } }));
    await game.put("/static/js/games/bender.js", new Response("saved:bender"));
    await game.put("/static/js/games/opticsim.js?v=abc", new Response("saved:opticsim"));
    await shared.put("/static/audio/sfx/core/click_1.ogg", new Response("saved:click"));
    await shared.put("/static/js/games/arcade.1a2b3c4d5e6f.js", new Response("saved:hashed"));
    await cacheObj("ee-static-old").put("/x", new Response("old"));
    // activate: old site versions go, saved games stay
    let w = null; listeners.activate({ waitUntil(x) { w = x; } }); await w;
    o.keptGames = store.has("ee-arcade-light-bender") && store.has("ee-arcade--shared");
    o.droppedOld = !store.has("ee-static-old");
    // online
    online = true; netHits = [];
    o.onlinePage = await run("/arcade/play/light-bender/", "navigate");
    o.pageRefreshed = (await (await game.match("/arcade/play/light-bender/")).text()) === "<html>fresh page</html>";
    netHits = [];
    o.onlineSound = await run("/static/audio/sfx/core/click_1.ogg");
    o.soundSkippedNetwork = !netHits.includes("/static/audio/sfx/core/click_1.ogg");
    netHits = [];
    o.onlineHashed = await run("/static/js/games/arcade.1a2b3c4d5e6f.js");
    o.onlineVersioned = await run("/static/js/games/opticsim.js?v=abc");
    o.versionedSkippedNetwork = !netHits.includes("/static/js/games/opticsim.js");
    o.onlinePlainCode = await run("/static/js/games/bender.js");   // plain name: the network wins while online
    // offline
    online = false;
    o.offlinePage = await run("/arcade/play/light-bender/", "navigate");
    o.offlinePlainCode = await run("/static/js/games/bender.js");
    o.offlineSound = await run("/static/audio/sfx/core/click_1.ogg");
    o.unsavedGame = await run("/arcade/play/momentum-cup/", "navigate");
    // JSON and writes are never answered from a cache
    let handled = false; listeners.fetch({ request: req("/arcade/api/me/", "cors", "application/json"), respondWith() { handled = true; }, waitUntil() {} });
    o.jsonUntouched = !handled;
  } catch (e) { o.ok = false; o.error = String(e && e.stack || e); }
  console.log(JSON.stringify(o));
})();
