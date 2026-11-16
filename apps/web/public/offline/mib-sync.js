/* MIB-Hub offline core: window.MIBSync (self.MIBSync in the service worker).
 *
 * One plain script shared by everything that works offline, so the rules live in one place:
 *   - public/sw.js (the service worker, through importScripts) for Background Sync;
 *   - public/offline/mib-offline.js (the "Download for offline" button, the offline banner, the sync toast);
 *   - public/play/_shared/mib/mib-play.js (the play bridge: cloud saves);
 *   - public/offline.html (the page shown for pages that were not downloaded).
 * Tests: apps/web/test/offline-sync.test.ts.
 *
 * What is here:
 *   downloads  which files to fetch for a game, which can be kept from an older download, and what the play page links to
 *   merging    two copies of a save (this device's, the cloud's) into one, losing no progress
 *   outbox     saves and scores made offline, waiting in IndexedDB; sent later with an id so nothing counts twice
 *
 * The legacy games' results already wait in their own outbox (IndexedDB "ee-arcade", made by
 * play/_shared/js/games/arcade-offline.js); flushArcade() sends those too.
 *
 * No dependencies. Every storage call is wrapped: private windows and old browsers just get "not available". */
(function (root) {
  "use strict";
  var S = {};

  /* ------------------------------------------------------------------ ids */

  /** A new device-made id (a UUID), the idempotency key the server stores. */
  S.cid = function () {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch { /* fall through */ }
    var a = new Uint8Array(16);
    try { root.crypto.getRandomValues(a); } catch { for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); }
    a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128;
    var h = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  };

  /** "1.4 MB" / "820 KB". */
  S.size = function (b) {
    b = Math.max(0, Number(b) || 0);
    if (b >= 1048576) return (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + " MB";
    return Math.max(1, Math.round(b / 1024)) + " KB";
  };

  /* ------------------------------------------------------------ downloads */

  /** Each downloaded game lives in its own cache, "mib-game-<slug>@<version>". */
  S.CACHE_PREFIX = "mib-game-";
  /** Inside it, this entry describes the download (written last: a cache without it is unfinished). */
  S.META_URL = "/__mib-offline/meta.json";
  S.SHELL_CACHE = "mib-shell-v1";
  S.MANIFEST_DIR = "/offline/games/";

  S.cacheName = function (slug, version) { return S.CACHE_PREFIX + slug + "@" + version; };
  S.parseCacheName = function (name) {
    var m = /^mib-game-([a-z0-9-]{1,80})@([a-zA-Z0-9_-]{1,40})$/.exec(String(name || ""));
    return m ? { slug: m[1], version: m[2] } : null;
  };

  /** Which sound format to keep: .ogg where the browser plays Opus, else .m4a (Safari). */
  S.pickVariant = function (canPlayOgg) { return canPlayOgg ? "ogg" : "m4a"; };

  /** The manifest's files this browser needs (one sound format). */
  S.filesFor = function (manifest, variant) {
    return (manifest && manifest.files || []).filter(function (f) { return !f.variant || f.variant === variant; });
  };

  /**
   * What a download has to fetch. Files whose hash is unchanged since an older download (`old`, that
   * download's meta) are copied across instead of fetched again, so an update only fetches what changed.
   */
  S.planDownload = function (manifest, variant, old) {
    var had = {};
    if (old && old.files) old.files.forEach(function (f) { had[f.url] = f.hash; });
    var plan = { fetch: [], reuse: [], bytes: 0, reuseBytes: 0, total: 0 };
    S.filesFor(manifest, variant).forEach(function (f) {
      plan.total += f.bytes;
      if (had[f.url] && had[f.url] === f.hash) { plan.reuse.push(f); plan.reuseBytes += f.bytes; }
      else { plan.fetch.push(f); plan.bytes += f.bytes; }
    });
    return plan;
  };

  /** The state of one game's download: "none", "ready" or "update" (a newer version is on the server). */
  S.downloadState = function (meta, manifest) {
    if (!meta) return "none";
    if (manifest && manifest.version && meta.version !== manifest.version) return "update";
    return "ready";
  };

  var SAME_ORIGIN_PATH = /^\/(?!\/)/;
  /** Keep a path only if it is same-origin and one of the kinds of file a page needs to run. */
  function wantedPath(p) {
    if (!p || !SAME_ORIGIN_PATH.test(p)) return false;
    if (/^\/(api|auth|admin|account|uploads)\//.test(p)) return false;
    return /^\/(_astro|play|games|offline|fx|js)\//.test(p) || /^\/favicon\.[a-z]+$/.test(p);
  }
  /** Resolve `ref` against `base` (a path) and return the path (+ query) if same-origin, else "". */
  function resolve(ref, base) {
    ref = String(ref || "").trim().replace(/&amp;/g, "&");
    if (!ref || /^(data|blob|javascript|mailto|tel):/i.test(ref) || ref.charAt(0) === "#") return "";
    try {
      var u = new URL(ref, "https://mib.invalid" + (base || "/"));
      return u.host === "mib.invalid" ? u.pathname + u.search : "";
    } catch { return ""; }
  }
  S.resolvePath = resolve;
  function attr(tag, name) {
    var m = new RegExp("\\s" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(tag);
    return m ? (m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]) : null;
  }

  /**
   * Every file the play page's HTML links to that it needs to run: stylesheets, scripts, island code,
   * images, three.js, and the scripts the bridge loads (the JSON in #mib-play-config). Navigation links
   * (<a href>) are not followed. Works without a DOM (the service worker has none).
   */
  S.discover = function (html, pagePath) {
    var out = [], seen = {};
    function add(ref) { var p = resolve(ref, pagePath || "/"); if (wantedPath(p) && !seen[p]) { seen[p] = 1; out.push(p); } }
    var tags = String(html || "").match(/<(link|script|img|source|astro-island|div)\b[^>]*>/gi) || [];
    tags.forEach(function (t) {
      var name = /^<([a-z-]+)/i.exec(t)[1].toLowerCase();
      if (name === "link") {
        var rel = (attr(t, "rel") || "").toLowerCase();
        if (/(^|\s)(stylesheet|icon|modulepreload|preload|manifest|apple-touch-icon)(\s|$)/.test(rel)) add(attr(t, "href"));
      } else if (name === "script" || name === "img" || name === "source") add(attr(t, "src"));
      ["data-gm-three", "component-url", "renderer-url", "before-hydration-url"].forEach(function (a) { var v = attr(t, a); if (v) add(v); });
    });
    var cfg = /<script[^>]*id=["']?mib-play-config["']?[^>]*>([\s\S]*?)<\/script>/i.exec(String(html || ""));
    if (cfg) {
      try { var c = JSON.parse(cfg[1]); (c.scripts || []).forEach(add); } catch { /* not JSON: ignore */ }
    }
    return out;
  };

  /** url(...) and @import in a stylesheet (fonts, images), resolved against the stylesheet's own path. */
  S.cssUrls = function (css, cssPath) {
    var out = [], seen = {}, m, re = /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;
    css = String(css || "");
    while ((m = re.exec(css))) {
      var p = resolve(m[2] || m[4], cssPath);
      if (wantedPath(p) && !seen[p]) { seen[p] = 1; out.push(p); }
    }
    return out;
  };

  /** The modules a built script imports (static and dynamic), resolved against its own path. */
  S.jsImports = function (js, jsPath) {
    var out = [], seen = {}, m, re = /(?:\bimport\s*\(\s*|\bfrom\s*|\bimport\s*)(["'])((?:\.{1,2}\/|\/_astro\/)[^"'\s]+?\.m?js)\1/g;
    js = String(js || "");
    while ((m = re.exec(js))) {
      var p = resolve(m[2], jsPath);
      if (wantedPath(p) && !seen[p]) { seen[p] = 1; out.push(p); }
    }
    return out;
  };

  /** The play page marks itself as fine to keep offline (the game is open to this player right now). */
  S.pageOk = function (html, slug) {
    var m = /<meta\s+name=["']mib-offline["']\s+content=["']([^"']*)["']/i.exec(String(html || ""));
    return !!m && m[1] === slug;
  };

  /**
   * Fetch `paths` into `cache`, 4 at a time, following what each stylesheet (fonts, images) and each
   * built script in /_astro/ (its imports) links to. Options:
   *   fetch         the fetch function
   *   skip(path)    true: already have it, do not fetch (it may still be followed if its text is passed)
   *   onFile(path, bytes, done, total)   progress
   *   follow        false: do not follow links (default true)
   *   cacheMode     fetch cache mode (default "no-cache": revalidate, so an update is never served stale)
   * Resolves { bytes, files: [{ url, bytes }], failed: [paths] }.
   */
  S.fetchInto = function (cache, paths, opts) {
    opts = opts || {};
    var fetchFn = opts.fetch || (root.fetch && root.fetch.bind(root)), queue = [], seen = {}, out = { bytes: 0, files: [], failed: [] }, done = 0;
    function push(p) { if (p && !seen[p]) { seen[p] = 1; queue.push(p); } }
    (paths || []).forEach(push);
    function followText(p, type) {
      return opts.follow !== false && (/\.css(\?|$)/.test(p) || /css/.test(type) || (/^\/_astro\/.*\.m?js(\?|$)/.test(p)));
    }
    function one() {
      var p = queue.shift();
      if (!p) return Promise.resolve();
      if (opts.skip && opts.skip(p)) { done++; return one(); }
      return fetchFn(p, { credentials: "same-origin", cache: opts.cacheMode || "no-cache" }).then(function (r) {
        if (!r || !r.ok || (r.type && r.type !== "basic" && r.type !== "default")) throw new Error("HTTP " + (r && r.status));
        var type = (r.headers && r.headers.get && r.headers.get("content-type")) || "";
        return r.arrayBuffer().then(function (buf) {
          var copy = new Response(buf, { status: 200, headers: { "content-type": type || "application/octet-stream" } });
          if (followText(p, type)) {
            var text = new TextDecoder().decode(buf);
            (/\.css(\?|$)/.test(p) || /css/.test(type) ? S.cssUrls(text, p) : S.jsImports(text, p)).forEach(push);
          }
          out.bytes += buf.byteLength; out.files.push({ url: p, bytes: buf.byteLength });
          return cache.put(p, copy);
        });
      }).catch(function () { out.failed.push(p); })
        .then(function () { done++; if (opts.onFile) opts.onFile(p, out.bytes, done, done + queue.length); return one(); });
    }
    return Promise.all([one(), one(), one(), one()]).then(function () { return out; });
  };

  /* -------------------------------------------------------------- merging */

  var PROGRESS_KEY = /(level|stage|best|score|star|xp|unlock|done|complete|clear|won|wins|progress|year|week|mission|chapter|record|badge|trophy|rank|tier|seen|story|quest|owned|max)/i;
  var NOT_PROGRESS = /(coin|money|cash|naira|health|hp$|energy|stamina|time|stamp|date|seed|vol|volume|^x$|^y$|^z$|pos|angle|speed|^at$|^ts$|updated|created)/i;
  var SETTINGS_KEY = /(-set-|settings|-snd-|prefs|-gfx|keys?bind|controls)/i;

  /**
   * A rough "how far along" number for one saved value, used only to compare two copies of the same save.
   * It adds up the numbers, the true flags and the length of every list (levels done, badges, items owned),
   * plus the number of entries in progress-like maps (unlocked, stars, missions...). Values under names
   * that go up and down in normal play (money, health, energy, times, positions, volume) are left out.
   */
  S.progressOf = function (value) {
    var budget = 20000;
    function walk(v, hint, depth) {
      if (budget-- <= 0 || depth > 8 || v == null) return 0;
      if (typeof v === "string") {
        var t = v.trim();
        if (depth === 0 && (t.charAt(0) === "{" || t.charAt(0) === "[")) { try { return walk(JSON.parse(t), hint, depth); } catch { return 0; } }
        if (depth === 0 && /^-?\d+(\.\d+)?$/.test(t)) return walk(Number(t), hint, depth);
        return t === "true" && depth === 0 ? walk(true, hint, depth) : 0;
      }
      if (typeof v === "number") return hint && isFinite(v) ? Math.max(0, v) : 0;
      if (typeof v === "boolean") return hint && v ? 1 : 0;
      var n = 0;
      if (Array.isArray(v)) {
        if (hint) n += v.length;
        for (var i = 0; i < v.length; i++) n += walk(v[i], hint, depth + 1);
        return n;
      }
      if (typeof v === "object") {
        for (var k in v) {
          if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
          var h = !NOT_PROGRESS.test(k) && (hint || PROGRESS_KEY.test(k));
          if (h && v[k] && typeof v[k] === "object" && !Array.isArray(v[k])) n += Object.keys(v[k]).length;
          n += walk(v[k], h, depth + 1);
        }
      }
      return n;
    }
    return walk(value, true, 0);
  };

  /**
   * Merge two copies of a legacy game's save (its localStorage keys). For each key:
   *   only one side has it        -> keep it
   *   both, the same              -> keep it
   *   both, different, a setting  -> the newer copy wins
   *   both, different, progress   -> the one with more progress wins (S.progressOf); equal: the newer copy
   * Every value that loses is returned in `losers`, so it can be kept as a backup: nothing is thrown away.
   */
  S.mergeKeys = function (local, cloud, localAt, cloudAt) {
    local = local || {}; cloud = cloud || {};
    var keys = {}, losers = {}, fromLocal = [], fromCloud = [], all = {}, k;
    for (k in local) all[k] = 1;
    for (k in cloud) all[k] = 1;
    var localNewer = (Number(localAt) || 0) > (Number(cloudAt) || 0);
    Object.keys(all).sort().forEach(function (key) {
      var a = local[key], b = cloud[key], hasA = typeof a === "string", hasB = typeof b === "string";
      if (hasA && !hasB) { keys[key] = a; fromLocal.push(key); return; }
      if (hasB && !hasA) { keys[key] = b; fromCloud.push(key); return; }
      if (!hasA && !hasB) return;
      if (a === b) { keys[key] = a; return; }
      var useLocal;
      if (SETTINGS_KEY.test(key)) useLocal = localNewer;
      else {
        var pa = S.progressOf(a), pb = S.progressOf(b);
        useLocal = pa !== pb ? pa > pb : localNewer;
      }
      keys[key] = useLocal ? a : b;
      losers[key] = useLocal ? b : a;
      (useLocal ? fromLocal : fromCloud).push(key);
    });
    return { keys: keys, losers: losers, fromLocal: fromLocal, fromCloud: fromCloud };
  };

  /**
   * Resolve a save conflict between this device's data and the cloud's.
   *   legacy saves ({ keys, at })  -> merged key by key (S.mergeKeys)
   *   any other save               -> the copy with more progress, else the newer one, wins whole
   * Returns { data, loser } where `loser` (or null) is what to keep as a backup.
   */
  S.resolveSave = function (local, cloud, now) {
    local = local || {}; cloud = cloud || {};
    var la = Number(local.at) || 0, ca = Number(cloud.at) || 0;
    if (local.keys && typeof local.keys === "object" && cloud.keys && typeof cloud.keys === "object") {
      var m = S.mergeKeys(local.keys, cloud.keys, la, ca);
      var lost = Object.keys(m.losers).length ? { keys: m.losers, at: la > ca ? ca : la } : null;
      return { data: { keys: m.keys, at: Math.max(la, ca, Number(now) || 0) }, loser: lost, merged: m };
    }
    var pl = S.progressOf(local), pc = S.progressOf(cloud);
    var keepLocal = pl !== pc ? pl > pc : la >= ca;
    return { data: keepLocal ? local : cloud, loser: keepLocal ? cloud : local };
  };

  /* --------------------------------------------------------------- outbox */

  /**
   * An outbox item (IndexedDB "mib-offline" / "outbox"):
   *   { id, kind: "save" | "score", slug, owner, at, url, body, tries, next }
   * `owner` is "u<user id>" or "guest". The server refuses items whose owner is not the signed-in
   * player (409), so a shared device never adds one player's progress to another's account.
   * A save is one item per player and game ("save:<owner>:<slug>:<slot>"): a newer save replaces it.
   * A score is one item per score, its id the idempotency key.
   */
  S.saveItem = function (o) {
    var slot = o.slot || "auto";
    return {
      id: "save:" + o.owner + ":" + o.slug + ":" + slot, kind: "save", slug: o.slug, owner: o.owner, at: o.at || Date.now(),
      url: "/api/games/" + encodeURIComponent(o.slug) + "/save",
      body: { slot: slot, data: o.data, summary: o.summary || "", base: Number(o.base) || 0, saveVersion: o.saveVersion || 1 },
      tries: 0, next: 0,
    };
  };
  S.scoreItem = function (o) {
    var id = o.cid || S.cid();
    return {
      id: id, kind: "score", slug: o.slug, owner: o.owner, at: o.at || Date.now(),
      url: "/api/games/" + encodeURIComponent(o.slug) + "/score",
      body: { score: o.score, cheated: !!o.cheated, details: o.details || {}, cid: id },
      tries: 0, next: 0,
    };
  };

  /**
   * What to do with an item after the server answered (status 0: no answer, the network failed):
   *   done      sent (or already counted): remove it
   *   conflict  a save changed elsewhere: merge with the cloud copy and send again
   *   hold      not this player's, or nobody signed in: keep it, untouched, until it is
   *   retry     try again later (offline, server busy, too many requests)
   *   drop      the server will never take it (bad data, game removed): remove it
   */
  S.outcome = function (status, body) {
    if (status >= 200 && status < 300) return "done";
    if (status === 409) return body && body.conflict ? "conflict" : "hold";
    if (status === 401 || status === 403) return "hold";
    if (status === 0 || status === 408 || status === 429 || status >= 500) return "retry";
    return "drop";
  };

  /** Wait before retry n (1, 2, 4... minutes, at most an hour). */
  S.backoff = function (tries) { return Math.min(3600000, 60000 * Math.pow(2, Math.max(0, (tries || 1) - 1))); };

  function postJSON(fetchFn, url, body) {
    return fetchFn(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); },
        function () { return { status: 0, body: null }; });
  }
  S.postJSON = postJSON;

  /**
   * Send every due item in `store` ({ all, put, del }). Options:
   *   fetch       the fetch function
   *   now         clock (ms)
   *   owner       only send this owner's items (omit: send all; the server holds back the wrong ones)
   *   backups     a store to keep the losing side of a merged save
   * Resolves { sent, dropped, held, retry, merged, items: [ids sent] }. Safe to run twice at once:
   * scores carry their id (counted once by the server) and saves carry the version they built on.
   */
  S.flush = function (store, opts) {
    opts = opts || {};
    var now = opts.now || Date.now(), fetchFn = opts.fetch || (root.fetch && root.fetch.bind(root));
    var res = { sent: 0, dropped: 0, held: 0, retry: 0, merged: 0, items: [] };
    return store.all().then(function (items) {
      items = (items || []).filter(function (it) { return (!opts.owner || it.owner === opts.owner) && !(it.next > now); })
        .sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      var chain = Promise.resolve();
      items.forEach(function (it) {
        chain = chain.then(function () { return sendOne(store, it, fetchFn, opts, res, now); });
      });
      return chain.then(function () { return res; });
    });
  };

  function sendOne(store, it, fetchFn, opts, res, now) {
    var body = Object.assign({}, it.body, { owner: it.owner });
    return postJSON(fetchFn, it.url, body).then(function (r) {
      var o = S.outcome(r.status, r.body);
      if (o === "conflict" && it.kind === "save" && r.body && r.body.save) {
        var cloud = r.body.save, fixed = S.resolveSave(it.body.data, cloud.data, now);
        var keep = fixed.loser && opts.backups ? opts.backups.put({ id: "backup:" + it.slug + ":" + now, slug: it.slug, owner: it.owner, at: now, data: fixed.loser }).catch(function () {}) : Promise.resolve();
        res.merged++;
        return keep.then(function () {
          var again = Object.assign({}, body, { data: fixed.data, base: cloud.version || 0 });
          return postJSON(fetchFn, it.url, again);
        }).then(function (r2) { return finish(store, it, S.outcome(r2.status, r2.body), res, now); });
      }
      return finish(store, it, o === "conflict" ? "retry" : o, res, now);
    });
  }
  function finish(store, it, o, res, now) {
    if (o === "done") { res.sent++; res.items.push(it.id); return store.del(it.id); }
    if (o === "drop") { res.dropped++; return store.del(it.id); }
    if (o === "hold") { res.held++; return Promise.resolve(); }
    res.retry++;
    var tries = (it.tries || 0) + 1;
    return store.put(Object.assign({}, it, { tries: tries, next: now + S.backoff(tries) }));
  }

  /** Move a guest's waiting items to the account that just signed in (only when the player says yes). */
  S.adopt = function (store, fromOwner, toOwner, ownerField) {
    var f = ownerField || "owner";
    return store.all().then(function (items) {
      var mine = (items || []).filter(function (it) { return it[f] === fromOwner; });
      return Promise.all(mine.map(function (it) {
        var copy = Object.assign({}, it); copy[f] = toOwner;
        if (copy.kind === "save" && copy.id) { // a save's id includes its owner
          copy.id = String(copy.id).replace("save:" + fromOwner + ":", "save:" + toOwner + ":");
          return store.del(it.id).then(function () { return store.put(copy); });
        }
        return store.put(copy);
      })).then(function () { return mine.length; });
    });
  };

  /**
   * Send the legacy games' queued results (IndexedDB "ee-arcade" / "outbox", items { cid, kind, at, data, user })
   * to /api/games/arcade/sync/ in batches of 40, one batch per owner. Counted once each by the server.
   */
  S.flushArcade = function (store, opts) {
    opts = opts || {};
    var fetchFn = opts.fetch || (root.fetch && root.fetch.bind(root)), res = { sent: 0, rejected: 0, held: 0, retry: 0 };
    return store.all().then(function (items) {
      var by = {};
      (items || []).forEach(function (it) { var o = it.user || "guest"; if (!opts.owner || o === opts.owner) (by[o] = by[o] || []).push(it); });
      var chain = Promise.resolve();
      Object.keys(by).forEach(function (owner) {
        var list = by[owner].sort(function (a, b) { return (a.at || 0) - (b.at || 0); }).slice(0, 40);
        chain = chain.then(function () {
          return postJSON(fetchFn, "/api/games/arcade/sync/", { owner: owner, items: list.map(function (i) { return { cid: i.cid, kind: i.kind, at: i.at, data: i.data }; }) })
            .then(function (r) {
              var o = S.outcome(r.status, r.body);
              if (o !== "done") { if (o === "hold") res.held += list.length; else res.retry += list.length; return; }
              var done = (r.body && r.body.done) || [], rej = ((r.body && r.body.rejected) || []).map(function (x) { return x.cid; });
              res.sent += done.length; res.rejected += rej.length;
              return Promise.all(done.concat(rej).map(function (c) { return store.del(c); }));
            });
        });
      });
      return chain.then(function () { return res; });
    });
  };

  /* -------------------------------------------------------- IndexedDB */

  var DB_NAME = "mib-offline", DB_VERSION = 1;
  /** A tiny promise wrapper over one IndexedDB object store: { all, get, put, del }. */
  S.idbStore = function (dbName, storeName, keyPath, version) {
    var idb = root.indexedDB;
    function open() {
      return new Promise(function (ok, no) {
        if (!idb) return no(new Error("IndexedDB is not available"));
        var r = idb.open(dbName, version || 1);
        r.onupgradeneeded = function () {
          var db = r.result;
          if (dbName === DB_NAME) ["outbox", "backups", "meta"].forEach(function (n) { if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: "id" }); });
          else if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: keyPath });
        };
        r.onsuccess = function () { ok(r.result); };
        r.onerror = function () { no(r.error); };
      });
    }
    function run(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (ok, no) {
          var t = db.transaction(storeName, mode), req = fn(t.objectStore(storeName));
          t.oncomplete = function () { db.close(); ok(req && "result" in req ? req.result : undefined); };
          t.onerror = t.onabort = function () { db.close(); no(t.error); };
        });
      });
    }
    return {
      all: function () { return run("readonly", function (st) { return st.getAll(); }).then(function (r) { return r || []; }); },
      get: function (id) { return run("readonly", function (st) { return st.get(id); }); },
      put: function (v) { return run("readwrite", function (st) { return st.put(v); }); },
      del: function (id) { return run("readwrite", function (st) { return st.delete(id); }); },
    };
  };
  S.outbox = function () { return S.idbStore(DB_NAME, "outbox", "id", DB_VERSION); };
  S.backups = function () { return S.idbStore(DB_NAME, "backups", "id", DB_VERSION); };
  S.meta = function () { return S.idbStore(DB_NAME, "meta", "id", DB_VERSION); };
  /** The legacy games' results queue (arcade-offline.js). */
  S.arcadeOutbox = function () { return S.idbStore("ee-arcade", "outbox", "cid", 1); };

  /** Keep at most `max` backups per game (oldest go first). */
  S.trimBackups = function (store, slug, max) {
    return store.all().then(function (all) {
      var mine = all.filter(function (b) { return b.slug === slug; }).sort(function (a, b) { return b.at - a.at; });
      return Promise.all(mine.slice(max || 5).map(function (b) { return store.del(b.id); }));
    });
  };

  /* ------------------------------------------------------ downloaded games */

  /** Every finished download in Cache Storage: [{ slug, version, title, bytes, at, files, cache }]. */
  S.listDownloads = function (cachesApi) {
    var cs = cachesApi || root.caches;
    if (!cs) return Promise.resolve([]);
    return cs.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        var p = S.parseCacheName(n); if (!p) return null;
        return cs.open(n).then(function (c) { return c.match(S.META_URL); })
          .then(function (r) { return r ? r.json() : null; })
          .then(function (m) { return m ? Object.assign({}, m, { cache: n }) : null; }, function () { return null; });
      }));
    }).then(function (list) {
      var best = {};
      list.forEach(function (m) { if (m && (!best[m.slug] || (best[m.slug].at || 0) < (m.at || 0))) best[m.slug] = m; });
      return Object.keys(best).sort().map(function (k) { return best[k]; });
    });
  };

  root.MIBSync = S;
})(typeof self !== "undefined" ? self : globalThis);
