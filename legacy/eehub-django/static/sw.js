/* EE Hub service worker (Round 5G).
 *
 * Served at /sw.js (scope "/") by core.views_pwa.service_worker, which fills in
 * the version and the precache list. The site works the same without it.
 *
 *   app shell (CSS/JS/fonts/icons) ...... precached per version (offline fallback)
 *   scripts and stylesheets .............. network first, cached copy only when offline;
 *                                          content-hashed names (prod) cache first
 *                                          (Nov 2026: a stale script after an update
 *                                          broke the interactive labs until a 2nd reload)
 *   images, fonts, public /media/ ........ stale-while-revalidate
 *   page navigations ..................... network first; a saved copy of a few pages
 *                                          (public pages, dashboard, timetable) when
 *                                          offline; else the offline page
 *   never cached ......................... POST and other writes, admin, sign-in pages,
 *                                          JSON / HTMX / fetch calls, downloads,
 *                                          protected files, anything marked no-store
 */
/* eslint-disable no-restricted-globals */
"use strict";

var VERSION = "__EE_SW_VERSION__";
var PRECACHE = "__EE_PRECACHE__";
var OFFLINE_URL = "__EE_OFFLINE_URL__";

var STATIC_CACHE = "ee-static-" + VERSION;
var PAGE_CACHE = "ee-pages-v1";
var MAX_PAGES = 40;
var ARCADE = "ee-arcade-";   // games saved with "Download for offline" (static/js/games/arcade-offline.js)

// Pages a signed-in person may want offline. Everything else that needs a
// sign-in is never stored.
var PRIVATE_PAGES = [/^\/dashboard\/$/, /^\/timetable\/$/, /^\/timetable\/exams\/$/];
// Public website paths (no sign-in needed) - safe to keep a copy of.
var PUBLIC_PAGES = [/^\/$/, /^\/news\//, /^\/events\//, /^\/gallery\//, /^\/programmes\//, /^\/guides\//,
  /^\/p\//, /^\/history\/$/, /^\/heads-of-department\/$/, /^\/people\//, /^\/contact\/$/, /^\/handbook\//,
  /^\/eesa\//, /^\/research\//, /^\/offline\/$/];
var NEVER = [/^\/admin\//, /^\/accounts\//, /^\/access\//, /^\/core\/files\//, /^\/protected\//, /^\/core\/impersonate/,
  /^\/settings\//, /^\/sw\.js$/, /\.ics$/, /\/export\//, /\/download/];

function matches(list, path) {
  for (var i = 0; i < list.length; i++) { if (list[i].test(path)) return true; }
  return false;
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      // One failing asset must not block the install: add them one by one.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { credentials: "same-origin" })).catch(function () {});
      }));
    })
  );
  // Nov 2026: take over at once. Pages and scripts both come from the network
  // (network first), so a new worker never mixes versions; waiting for the
  // "new version is ready" click left the old worker serving old lab scripts.
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        // Old EE Hub versions, and (Round 6) any cache another project left on this
        // address (e.g. a previous app on 127.0.0.1:8000): only EE Hub's own survive.
        // Arcade games saved for offline play (ee-arcade-<slug>) belong to the player, not to a version.
        if (k !== STATIC_CACHE && k !== PAGE_CACHE && k.indexOf(ARCADE) !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type === "skip-waiting") self.skipWaiting();
  if (data.type === "clear-pages") event.waitUntil(caches.delete(PAGE_CACHE));
  if (data.type === "version" && event.ports && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
});

function cacheable(response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  var cc = (response.headers.get("Cache-Control") || "").toLowerCase();
  if (cc.indexOf("no-store") !== -1) return false;
  if ((response.headers.get("Content-Disposition") || "").toLowerCase().indexOf("attachment") !== -1) return false;
  return true;
}

function stamp(response) {
  // Keep a copy with the time it was saved, for the offline page.
  return response.clone().blob().then(function (body) {
    var headers = new Headers(response.headers);
    headers.set("X-EE-Saved-At", String(Date.now()));
    return new Response(body, { status: response.status, statusText: response.statusText, headers: headers });
  });
}

function trimPages(cache) {
  return cache.keys().then(function (keys) {
    if (keys.length <= MAX_PAGES) return;
    return Promise.all(keys.slice(0, keys.length - MAX_PAGES).map(function (k) { return cache.delete(k); }));
  });
}

function handleNavigation(event, url) {
  var keep = !matches(NEVER, url.pathname) && (matches(PUBLIC_PAGES, url.pathname) || matches(PRIVATE_PAGES, url.pathname));
  return fetch(event.request).then(function (response) {
    var html = (response.headers.get("Content-Type") || "").indexOf("text/html") !== -1;
    // A redirect to the sign-in page (signed out) is never stored over a good copy.
    if (keep && html && cacheable(response) && !response.redirected) {
      var copy = stamp(response);
      event.waitUntil(copy.then(function (r) {
        return caches.open(PAGE_CACHE).then(function (c) { return c.put(url.pathname + url.search, r).then(function () { return trimPages(c); }); });
      }));
    }
    return response;
  }).catch(function () {
    return caches.open(PAGE_CACHE).then(function (c) {
      return c.match(url.pathname + url.search).then(function (hit) {
        return hit || c.match(url.pathname, { ignoreSearch: true });
      });
    }).then(function (hit) {
      if (hit) return hit;
      return caches.match(OFFLINE_URL, { ignoreSearch: true }).then(function (off) {
        return off || new Response("<h1>You are offline</h1><p>EE Hub will be back when your connection returns.</p>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
      });
    });
  });
}

function staleWhileRevalidate(event) {
  // Round 6: a versioned URL (?v=8) is never answered with an older copy
  // (ignoreSearch used to hide a CSS/JS fix until the next visit). Exact match
  // first; the search-less precached copy is only the offline fallback.
  var versioned = new URL(event.request.url).search.length > 1;
  return caches.open(STATIC_CACHE).then(function (cache) {
    return cache.match(event.request).then(function (exact) {
      if (exact) return { hit: exact, fallback: exact };
      return cache.match(event.request, { ignoreSearch: true }).then(function (loose) {
        return { hit: versioned ? null : loose, fallback: loose };
      });
    }).then(function (r) {
      var network = fetch(event.request).then(function (response) {
        if (cacheable(response)) cache.put(event.request, response.clone());
        return response;
      }).catch(function () { return r.fallback; });
      if (r.hit) { event.waitUntil(network.catch(function () {})); return r.hit; }
      return network;
    });
  });
}

// Code (JS/CSS) must always match the page that loads it. A name with a content hash
// (core.storage.ManifestStaticStorage in production: app.3f2a9c1b7d4e.js) can never
// change, so it may come from the cache first; any other script or stylesheet comes
// from the network, and the cached copy is only used when the network fails.
var CODE = /\.(?:m?js|css)$/i;
var HASHED = /\.[0-9a-f]{12}\.(?:m?js|css)$/i;

function networkFirstCode(event) {
  // A URL without a version (?v=…) is revalidated with the server (a cheap 304),
  // so not even the browser's own HTTP cache can hand back an old copy.
  var plain = new URL(event.request.url).search.length < 2;
  return caches.open(STATIC_CACHE).then(function (cache) {
    return fetch(event.request, plain ? { cache: "no-cache" } : undefined).then(function (response) {
      if (cacheable(response)) cache.put(event.request, response.clone());
      return response;
    }).catch(function () {
      return cache.match(event.request).then(function (exact) {
        return exact || cache.match(event.request, { ignoreSearch: true });
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;                       // writes always go to the network
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // fonts/CDNs: browser default
  if (matches(NEVER, url.pathname)) return;
  if (req.headers.get("HX-Request") || req.headers.get("X-Requested-With")) return;
  var accept = req.headers.get("Accept") || "";
  if (accept.indexOf("application/json") !== -1) return;  // authenticated JSON is never stored

  if (req.mode === "navigate" && ARCADE_PAGE.test(url.pathname)) { event.respondWith(arcadeNavigation(event, url)); return; }
  if (req.mode === "navigate") { event.respondWith(handleNavigation(event, url)); return; }
  if (url.pathname.indexOf("/static/") === 0) { event.respondWith(arcadeStatic(event, url)); return; }
  if (url.pathname.indexOf("/media/content/") === 0 ||
      url.pathname === "/manifest.webmanifest") {
    if (CODE.test(url.pathname) && !HASHED.test(url.pathname)) { event.respondWith(networkFirstCode(event)); return; }
    event.respondWith(staleWhileRevalidate(event));
  }
});

/* ---------- Arcade games saved for offline play -----------------------------------------------------------------
 * A game the player downloaded lives in a cache "ee-arcade-<slug>". Its play page is fetched from the network first
 * (it carries the player's name and settings) with a short wait, then from the saved copy. Its files - pictures,
 * sounds, the 3D engine, content-hashed scripts - come from the saved copy first, so a saved game does not load them
 * from the server again; plain-named scripts (development) are network first so an edit is never hidden. Results
 * played offline are queued by the page in IndexedDB "ee-arcade" and sent here on Background Sync. */
var ARCADE_PAGE = /^\/arcade\/(?:play\/[a-z0-9-]+|lan)\/$/;

function arcadeMatch(request) {
  return caches.keys().then(function (keys) {
    var mine = keys.filter(function (k) { return k.indexOf(ARCADE) === 0; });
    return mine.reduce(function (p, k) {
      return p.then(function (hit) { return hit || caches.open(k).then(function (c) { return c.match(request); }); });
    }, Promise.resolve(null));
  });
}

function withTimeout(promise, ms) {
  return new Promise(function (ok, no) {
    var t = setTimeout(function () { no(new Error("timeout")); }, ms);
    promise.then(function (r) { clearTimeout(t); ok(r); }, function (e) { clearTimeout(t); no(e); });
  });
}

function arcadeNavigation(event, url) {
  return arcadeMatch(url.pathname).then(function (saved) {
    if (!saved) return handleNavigation(event, url);
    var net = fetch(event.request).then(function (response) {
      var html = (response.headers.get("Content-Type") || "").indexOf("text/html") !== -1;
      if (response.status === 200 && html && !response.redirected) {
        var copy = response.clone();
        event.waitUntil(caches.keys().then(function (keys) {
          return Promise.all(keys.filter(function (k) { return k.indexOf(ARCADE) === 0; }).map(function (k) {
            return caches.open(k).then(function (c) { return c.match(url.pathname).then(function (old) { if (old) return c.put(url.pathname, copy.clone()); }); });
          }));
        }));
      }
      return response;
    });
    // A slow or captive connection must not keep a saved game from opening.
    return withTimeout(net, 4000).catch(function () { return saved; });
  });
}

function arcadeStatic(event, url) {
  return arcadeMatch(event.request).then(function (saved) {
    if (!saved) {
      if (CODE.test(url.pathname) && !HASHED.test(url.pathname)) return networkFirstCode(event);
      return staleWhileRevalidate(event);
    }
    // A plain name (no content hash, no ?v=) can change under the same URL: ask the network first.
    if (CODE.test(url.pathname) && !HASHED.test(url.pathname) && url.search.length < 2) {
      return withTimeout(fetch(event.request, { cache: "no-cache" }), 4000).then(function (r) { return r.ok ? r : saved; }, function () { return saved; });
    }
    return saved;
  });
}

function outboxAll() {
  return new Promise(function (ok) {
    var r = indexedDB.open("ee-arcade", 1);
    r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains("outbox")) r.result.createObjectStore("outbox", { keyPath: "cid" }); };
    r.onerror = function () { ok({ db: null, items: [] }); };
    r.onsuccess = function () {
      var db = r.result, t = db.transaction("outbox", "readonly"), q = t.objectStore("outbox").getAll();
      q.onsuccess = function () { ok({ db: db, items: q.result || [] }); };
      q.onerror = function () { ok({ db: db, items: [] }); };
    };
  });
}

function flushOutbox() {
  return outboxAll().then(function (o) {
    if (!o.items.length) return 0;
    var items = o.items.slice(0, 40), token = items[items.length - 1].csrf || "";
    return fetch("/arcade/api/sync/", { method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "X-CSRFToken": token },
      body: JSON.stringify({ items: items.map(function (i) { return { cid: i.cid, kind: i.kind, at: i.at, data: i.data }; }) }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "sync"); return j; }); })
      .then(function (j) {
        var gone = (j.done || []).concat((j.rejected || []).map(function (x) { return x.cid; }));
        return new Promise(function (ok) {
          var t = o.db.transaction("outbox", "readwrite"), st = t.objectStore("outbox");
          gone.forEach(function (c) { st.delete(c); });
          t.oncomplete = function () { ok((j.done || []).length); }; t.onerror = function () { ok(0); };
        });
      }).then(function (n) {
        if (n) self.clients.matchAll({ type: "window" }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ type: "arcade-synced", n: n }); }); });
        return n;
      });
  });
}

self.addEventListener("sync", function (event) {
  if (event.tag === "ee-arcade-outbox") event.waitUntil(flushOutbox());
});
