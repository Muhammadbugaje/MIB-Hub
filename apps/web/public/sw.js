/* MIB-Hub service worker: games that play with no internet.
 *
 * Registered by public/offline/mib-offline.js on every page that has a "Download for offline" button
 * (not on localhost unless asked: see that file). Scope: the whole site, but it only steps in for:
 *
 *   page loads (navigations)
 *     /play/<slug> of a downloaded game  the network first (fresh page, fresh sign-in state); with no
 *                                        answer (or none within 8 s), the copy saved with the download.
 *                                        A fresh copy replaces the saved one, with anything new it links to.
 *     any other page                     the network; with no network, /offline.html (lists downloads).
 *   game files and site assets           the network first, so online play always gets the latest files;
 *   (/play/, /_astro/, /games/, ...)     with no network, the downloaded copy.
 *
 * It never touches /api/ (saves, scores and sign-in always go to the server), never caches anything the
 * player did not download (except the small offline page), and never serves an old file while online.
 *
 * Background Sync: "mib-outbox" sends waiting saves and scores, "ee-arcade-outbox" the legacy games'
 * results (both through MIBSync, public/offline/mib-sync.js). Tests: apps/web/test/offline-sw.test.ts. */
/* global importScripts */
"use strict";
importScripts("/offline/mib-sync.js");

var S = self.MIBSync;
var SHELL_FILES = ["/offline.html", "/offline/mib-sync.js", "/offline/mib-offline.js", "/favicon.svg"];
var NAV_TIMEOUT_MS = 8000;
var ASSET_RE = /^\/(_astro|play|games|offline|fx|js)\/|^\/favicon\.[a-z]+$|^\/offline\.html$/;
var PLAY_RE = /^\/play\/([a-z0-9-]{1,80})\/?$/;

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(S.SHELL_CACHE)
      .then(function (c) {
        // Re-wrapped, so a host that redirects /offline.html to /offline still gives a response a page load may use.
        return Promise.all(SHELL_FILES.map(function (u) {
          return fetch(u, { cache: "no-cache", credentials: "same-origin" }).then(function (r) {
            if (!r.ok) throw new Error(u + " " + r.status);
            return r.blob().then(function (b) { return c.put(u, new Response(b, { headers: { "content-type": r.headers.get("content-type") || "" } })); });
          });
        }));
      })
      .then(function () { return self.skipWaiting(); }),
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return /^mib-shell-/.test(n) && n !== S.SHELL_CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); }),
  );
});

/** The finished download of `slug` (its meta, with .cache = the cache name), or null. */
function downloadOf(slug) {
  return S.listDownloads(caches).then(function (list) { return list.filter(function (m) { return m.slug === slug; })[0] || null; });
}

/** Any downloaded copy of this request (any game's cache, or the offline shell). */
function cached(request) {
  var url = new URL(request.url);
  return caches.match(url.pathname + url.search, { ignoreVary: true }).then(function (r) {
    return r || caches.match(url.pathname, { ignoreSearch: true, ignoreVary: true });
  });
}

function offlinePage() {
  return caches.match("/offline.html").then(function (r) {
    return r || new Response("<!doctype html><meta charset=utf-8><title>Offline</title><p>You are offline.</p>", { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  });
}

/** fetch, but give up after `ms` (null: no limit). */
function fetchWithin(request, ms) {
  if (!ms) return fetch(request);
  return new Promise(function (ok, no) {
    var t = setTimeout(function () { no(new Error("timeout")); }, ms);
    fetch(request).then(function (r) { clearTimeout(t); ok(r); }, function (e) { clearTimeout(t); no(e); });
  });
}

/**
 * A fresh play page for a downloaded game: keep it (if the game is open to this player) and fetch
 * whatever new files it links to, so the next offline visit matches what the player saw online.
 */
function refreshPage(meta, slug, response) {
  return response.text().then(function (html) {
    if (!S.pageOk(html, slug)) return null;
    return caches.open(meta.cache).then(function (cache) {
      var page = new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      return cache.put("/play/" + slug, page).then(function () {
        return Promise.all(S.discover(html, "/play/" + slug).map(function (p) { return cache.match(p, { ignoreVary: true }).then(function (r) { return r ? null : p; }); }));
      }).then(function (missing) {
        missing = missing.filter(Boolean);
        return missing.length ? S.fetchInto(cache, missing, { fetch: fetch }) : null;
      });
    });
  }).catch(function () { return null; });
}

function navigate(event) {
  var request = event.request, url = new URL(request.url), m = PLAY_RE.exec(url.pathname);
  if (!m) return fetch(request).catch(offlinePage);
  var slug = m[1];
  return downloadOf(slug).then(function (meta) {
    if (!meta) return fetch(request).catch(offlinePage);
    var fromCache = function () {
      return caches.open(meta.cache).then(function (c) { return c.match("/play/" + slug); }).then(function (r) { return r || offlinePage(); });
    };
    if (self.navigator && self.navigator.onLine === false) return fromCache();
    return fetchWithin(request, NAV_TIMEOUT_MS).then(function (r) {
      if (r && r.ok && (r.type === "basic" || r.type === "default") && !r.redirected) event.waitUntil(refreshPage(meta, slug, r.clone()));
      return r;
    }, fromCache);
  });
}

function asset(request) {
  if (self.navigator && self.navigator.onLine === false) {
    return cached(request).then(function (r) { return r || fetch(request); });
  }
  return fetch(request).catch(function (e) {
    return cached(request).then(function (r) { if (r) return r; throw e; });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  var path = url.pathname;
  if (/^\/api\//.test(path) || path === "/sw.js" || path.indexOf(S.MANIFEST_DIR) === 0) return;
  if (request.mode === "navigate") { event.respondWith(navigate(event)); return; }
  if (!ASSET_RE.test(path)) return;
  event.respondWith(asset(request));
});

/* ---------- Background Sync and messages ---------- */

function tell(msg) {
  return self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then(function (list) {
    list.forEach(function (c) { c.postMessage(msg); });
  });
}

function syncAll() {
  var a = S.flush(S.outbox(), { fetch: fetch, backups: S.backups() }).catch(function () { return { sent: 0, retry: 1 }; });
  var b = S.flushArcade(S.arcadeOutbox(), { fetch: fetch }).catch(function () { return { sent: 0, retry: 1 }; });
  return Promise.all([a, b]).then(function (r) {
    var sent = r[0].sent + r[1].sent;
    var msgs = [];
    if (r[0].sent || r[0].merged) msgs.push(tell({ type: "mib-synced", sent: r[0].sent, merged: r[0].merged }));
    if (r[1].sent) msgs.push(tell({ type: "arcade-synced", n: r[1].sent }));
    return Promise.all(msgs).then(function () {
      // Ask the browser to try again later if something is still waiting for the network.
      if (r[0].retry || r[1].retry) throw new Error("still waiting");
      return sent;
    });
  });
}

self.addEventListener("sync", function (event) {
  if (event.tag === "mib-outbox" || event.tag === "ee-arcade-outbox") event.waitUntil(syncAll());
});

self.addEventListener("message", function (event) {
  var d = event.data || {};
  if (d.type === "mib-sync-now") event.waitUntil(syncAll().catch(function () { return 0; }));
});

/* For tests (apps/web/test/offline-sw.test.ts). */
self.__mibSW = { navigate: navigate, asset: asset, refreshPage: refreshPage, syncAll: syncAll, downloadOf: downloadOf };
