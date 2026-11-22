/**
 * MIB-Hub Work-in-Progress PWA Service Worker.
 *
 * Caches all game assets (3D GLB models, animations, fonts, audio, bundle)
 * on first load so phones play instantly without re-downloading over
 * slow or no network. Cache-first strategy for assets, network-first
 * for the HTML shell.
 */

const CACHE = "wip-v1";
const SHELL = ["/games/work-in-progress/", "/games/work-in-progress/index.html"];

const ASSET_PATTERNS = [
  "/assets/",       // 3D GLB models, animations, character models
  "/fonts/",        // web fonts
  "/audio/",        // game audio (if separate files)
  "/fonts/bricolage-800-latin.woff2",
];

const BYPASS = ["/api/", "socket.io", "localhost:"];

function isAsset(url) {
  return ASSET_PATTERNS.some(function (p) { return url.includes(p); });
}

function shouldBypass(url) {
  return BYPASS.some(function (b) { return url.includes(b); });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  var url = req.url;

  if (req.method !== "GET" || shouldBypass(url)) return;

  // Assets: cache-first (download once, play forever offline).
  if (isAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(req).then(function (cached) {
          if (cached) return cached;
          return fetch(req).then(function (resp) {
            if (resp.ok && resp.status === 200) cache.put(req, resp.clone());
            return resp;
          });
        });
      }),
    );
    return;
  }

  // Shell HTML: network-first with cache fallback.
  if (SHELL.some(function (s) { return url.endsWith(s); })) {
    event.respondWith(
      fetch(req).then(function (resp) {
        if (resp.ok) caches.open(CACHE).then(function (c) { c.put(req, resp.clone()); });
        return resp;
      }).catch(function () { return caches.match(req); }),
    );
    return;
  }

  // Everything else: network then cache.
  event.respondWith(fetch(req).catch(function () { return caches.match(req); }));
});
