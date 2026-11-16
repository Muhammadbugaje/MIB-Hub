/* MIB-Hub offline client: window.MIBOffline. Needs /offline/mib-sync.js first.
 *
 * Loaded by the "Download for offline" box (src/components/games/OfflineButton.astro) on /games/<slug> and
 * /play/<slug>, and by /offline.html. It:
 *
 *   - registers the service worker (/sw.js). Not on localhost, so `npm run dev` never serves cached files,
 *     unless you ask: open any page with ?sw=1 (and ?sw=0 to switch it off again, which also removes it);
 *   - draws the box: Download for offline (size) -> progress (files, MB, %) -> Ready offline (size,
 *     Remove download) or Update available, plus how much storage the site uses on this device;
 *   - downloads a game: its manifest (/offline/games/<slug>.json, from scripts/offline-manifest.ts), the
 *     play page and everything that page links to, into one Cache Storage cache per game version;
 *   - shows "Playing offline · progress will sync" on the play page while there is no connection;
 *   - sends waiting saves, scores and results when the connection is back (online event, page load, focus,
 *     and Background Sync where the browser has it), then confirms with a toast;
 *   - offers a guest's offline progress to the account that signs in on this device (never automatically).
 *
 * Every API here fails soft: a browser without service workers or Cache Storage just shows a note. */
(function () {
  "use strict";
  var S = window.MIBSync;
  if (!S || window.MIBOffline) return;
  var doc = document, nav = navigator;
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
  var supported = "serviceWorker" in nav && "caches" in window && !!window.indexedDB;

  function flag() {
    try {
      var q = new URLSearchParams(location.search).get("sw");
      if (q === "1") localStorage.setItem("mib-sw", "1");
      if (q === "0") localStorage.removeItem("mib-sw");
      return localStorage.getItem("mib-sw") === "1";
    } catch { return false; }
  }
  /** Off on the dev server unless ?sw=1 was used. */
  var enabled = supported && (!LOCAL || flag());
  function owner() {
    var m = doc.querySelector('meta[name="ee-user"]');
    return (m && m.getAttribute("content")) || "guest";
  }
  var O = (window.MIBOffline = { supported: supported, enabled: enabled, owner: owner });

  /* ---------- service worker ---------- */
  var swReady = null;
  O.register = function () {
    if (!supported) return Promise.resolve(null);
    if (!enabled) { // dev server: make sure no worker from an earlier ?sw=1 keeps serving old files
      return nav.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }).then(function () { return null; }, function () { return null; });
    }
    if (!swReady) {
      swReady = nav.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(function () { return nav.serviceWorker.ready; })
        .catch(function () { return null; });
    }
    return swReady;
  };

  /* ---------- small UI helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function styles() {
    if (doc.getElementById("mo-css")) return;
    var s = doc.createElement("style"); s.id = "mo-css";
    s.textContent =
      ".mo-banner{position:fixed;left:50%;bottom:16px;transform:translate(-50%,160%);z-index:9990;max-width:min(92vw,560px);padding:10px 16px;border-radius:999px;background:#14213d;color:#fff;font:600 14px/1.35 var(--font-sans,system-ui,sans-serif);box-shadow:0 8px 30px rgba(0,0,0,.35);transition:transform .35s ease;text-align:center;pointer-events:none}" +
      ".mo-banner.is-on{transform:translate(-50%,0)}.mo-banner.is-ok{background:#166534}.mo-banner.is-warn{background:#7c2d12}" +
      ".mo-offer{position:fixed;right:16px;bottom:16px;z-index:9991;max-width:min(92vw,420px);padding:16px;border-radius:16px;background:var(--surface,#fff);color:var(--text,#14213d);border:1px solid var(--border,rgba(127,127,127,.3));box-shadow:0 12px 40px rgba(0,0,0,.35);font:15px/1.45 var(--font-sans,system-ui,sans-serif)}" +
      ".mo-offer h2{font-size:1rem;margin:0 0 6px}.mo-offer p{margin:0 0 10px}.mo-offer__row{display:flex;gap:8px;flex-wrap:wrap}" +
      "@media (prefers-reduced-motion:reduce){.mo-banner{transition:none}}";
    doc.head.appendChild(s);
  }
  var bannerEl, bannerT;
  /** A short message at the bottom of the screen. secs 0: stays until replaced. */
  O.banner = function (text, kind, secs) {
    styles();
    if (!bannerEl) { bannerEl = doc.createElement("div"); bannerEl.className = "mo-banner"; bannerEl.setAttribute("role", "status"); doc.body.appendChild(bannerEl); }
    bannerEl.textContent = text;
    bannerEl.classList.toggle("is-ok", kind === "ok"); bannerEl.classList.toggle("is-warn", kind === "warn");
    bannerEl.classList.add("is-on");
    clearTimeout(bannerT);
    if (secs !== 0) bannerT = setTimeout(function () { bannerEl.classList.remove("is-on"); }, (secs || 5) * 1000);
  };
  O.hideBanner = function () { if (bannerEl) bannerEl.classList.remove("is-on"); };

  function canPlayOgg() { try { var a = doc.createElement("audio"); return !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"')); } catch { return false; } }
  O.variant = function () { return S.pickVariant(canPlayOgg()); };

  /* ---------- downloads ---------- */
  O.manifest = function (slug) {
    return fetch(S.MANIFEST_DIR + encodeURIComponent(slug) + ".json", { cache: "no-store", credentials: "same-origin" })
      .then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error("Could not check the download (" + r.status + ")."); return r.json(); });
  };
  O.downloads = function () { return supported ? S.listDownloads(caches) : Promise.resolve([]); };
  O.meta = function (slug) { return O.downloads().then(function (l) { return l.filter(function (m) { return m.slug === slug; })[0] || null; }); };
  function slugCaches(slug) {
    return caches.keys().then(function (names) { return names.filter(function (n) { var p = S.parseCacheName(n); return p && p.slug === slug; }); });
  }
  O.remove = function (slug) {
    if (!supported) return Promise.resolve();
    return slugCaches(slug).then(function (ns) { return Promise.all(ns.map(function (n) { return caches.delete(n); })); });
  };
  O.usage = function () {
    var st = nav.storage;
    if (!st || !st.estimate) return Promise.resolve(null);
    return Promise.all([st.estimate(), st.persisted ? st.persisted().catch(function () { return false; }) : Promise.resolve(false)])
      .then(function (r) { return { usage: r[0].usage || 0, quota: r[0].quota || 0, persisted: !!r[1] }; }, function () { return null; });
  };

  var busy = {};
  /**
   * Download (or update) one game. progress({ phase, done, total, bytes, totalBytes, pct }) is called as it goes.
   * The new copy goes into its own cache and replaces the old one only when complete, so a failed or
   * interrupted download never breaks a copy that already works.
   */
  O.download = function (slug, progress) {
    progress = progress || function () {};
    if (!enabled) return Promise.reject(new Error(supported ? "Offline downloads are off on this development server (open the page with ?sw=1)." : "This browser cannot keep games for offline play."));
    if (busy[slug]) return busy[slug];
    if (nav.onLine === false) return Promise.reject(new Error("You need to be online to download."));
    var name, manifest, old, variant = O.variant(), started = Date.now();
    var job = O.register().then(function (reg) {
      if (!reg) throw new Error("This browser would not start offline support. Try another browser.");
      return Promise.all([O.manifest(slug), O.meta(slug)]);
    }).then(function (r) {
      manifest = r[0]; old = r[1];
      if (!manifest) throw new Error("This game is not available offline yet.");
      return fetch(manifest.page, { cache: "no-store", credentials: "same-origin" }).then(function (res) {
        if (!res.ok || res.redirected) throw new Error("This game is not open to you right now. Check you are signed in, then try again.");
        return res.text();
      });
    }).then(function (html) {
      if (!S.pageOk(html, slug)) throw new Error("This game is not open to you right now. Check you are signed in, then try again.");
      var plan = S.planDownload(manifest, variant, old);
      var want = {}; S.filesFor(manifest, variant).forEach(function (f) { want[f.url] = 1; });
      var extra = S.discover(html, manifest.page).filter(function (p) { return !want[p.split("?")[0]]; });
      var total = plan.fetch.length + plan.reuse.length + extra.length + 1, done = 0, bytes = plan.reuseBytes;
      var totalBytes = plan.total;
      function tick(phase) { progress({ phase: phase, done: done, total: total, bytes: bytes, totalBytes: Math.max(totalBytes, bytes), pct: Math.min(99, Math.round((bytes / Math.max(1, totalBytes)) * 100)) }); }
      name = S.cacheName(slug, manifest.version + "-" + started.toString(36));
      tick("start");
      return caches.open(name).then(function (cache) {
        // 1. files unchanged since the last download: copy them across
        var copy = !old ? Promise.resolve() : caches.open(old.cache).then(function (oc) {
          return Promise.all(plan.reuse.map(function (f) {
            return oc.match(f.url).then(function (r) { if (!r) { plan.fetch.push(f); bytes -= f.bytes; return; } done++; return cache.put(f.url, r); });
          }));
        });
        return copy.then(function () {
          tick("files");
          // 2. the game's own files (from the manifest)
          var base = bytes;
          return S.fetchInto(cache, plan.fetch.map(function (f) { return f.url; }), { fetch: fetch.bind(window), follow: false,
            onFile: function (p, b) { done++; bytes = base + b; tick("files"); } });
        }).then(function (a) {
          if (a.failed.length) throw new Error("Some files did not download (" + a.failed.length + "). Check your connection and try again.");
          // 3. what the play page links to (the site's styles, fonts and scripts), found now because their names change per build
          var base = bytes;
          return S.fetchInto(cache, extra, { fetch: fetch.bind(window),
            onFile: function (p, b, d, t) { total = Math.max(total, plan.fetch.length + plan.reuse.length + t + 1); done++; bytes = base + b; totalBytes = Math.max(totalBytes, bytes); tick("page"); } });
        }).then(function (b) {
          if (b.failed.length) throw new Error("Some page files did not download (" + b.failed.length + "). Check your connection and try again.");
          // 4. the page itself, then the description (written last: its presence means "complete")
          return cache.put(manifest.page, new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })).then(function () {
            done++;
            var meta = {
              slug: slug, title: manifest.title, icon: manifest.icon, page: manifest.page, version: manifest.version, variant: variant,
              bytes: bytes + html.length, at: Date.now(), owner: owner(),
              files: S.filesFor(manifest, variant).map(function (f) { return { url: f.url, hash: f.hash }; }),
              extra: b.files.map(function (f) { return f.url; }),
            };
            return cache.put(S.META_URL, new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } })).then(function () { return meta; });
          });
        });
      });
    }).then(function (meta) {
      // 5. the new copy is complete: drop older copies of this game
      return slugCaches(slug).then(function (ns) { return Promise.all(ns.filter(function (n) { return n !== name; }).map(function (n) { return caches.delete(n); })); })
        .then(function () { return nav.storage && nav.storage.persist ? nav.storage.persist().catch(function () { return false; }) : false; })
        .then(function () { progress({ phase: "done", done: 1, total: 1, bytes: meta.bytes, totalBytes: meta.bytes, pct: 100 }); return meta; });
    }).catch(function (e) {
      return (name ? caches.delete(name) : Promise.resolve()).then(function () { throw e; });
    });
    busy[slug] = job.then(function (v) { delete busy[slug]; return v; }, function (e) { delete busy[slug]; throw e; });
    return busy[slug];
  };

  /* ---------- the box ---------- */
  function boxUI(host) {
    var slug = host.getAttribute("data-slug"), title = host.getAttribute("data-title") || "this game";
    var btn = host.getAttribute("data-btn") || "btn btn--ghost btn--sm", btn1 = host.getAttribute("data-btn-primary") || btn;
    var manifest = null, meta = null, note = "", state = "checking", prog = null;
    function usageLine() {
      return O.usage().then(function (u) {
        var el = host.querySelector("[data-mo-usage]");
        if (!el || !u) return;
        el.textContent = "This site uses " + S.size(u.usage) + " of " + S.size(u.quota) + " on this device" +
          (meta ? (u.persisted ? " · kept safe from clean-up" : " · the browser may clear it if space runs low") : "") + ".";
      });
    }
    function render() {
      var h;
      var size = manifest ? S.size(manifest.bytes[O.variant()] || 0) : "";
      if (!supported) h = "<p class='mo-note'>This browser cannot keep games for offline play.</p>";
      else if (!enabled) h = "<p class='mo-note'>Offline downloads are off on this development server. <a href='?sw=1'>Turn them on</a>.</p>";
      else if (state === "busy") {
        var p = prog || { done: 0, total: 1, bytes: 0, totalBytes: 0, pct: 0 };
        h = "<p class='mo-line'><b>Downloading " + esc(title) + "…</b> " + p.pct + "%</p>" +
          "<div class='mo-bar' role='progressbar' aria-label='Download progress' aria-valuemin='0' aria-valuemax='100' aria-valuenow='" + p.pct + "'><i style='width:" + p.pct + "%'></i></div>" +
          "<p class='mo-note'>" + p.done + " of " + p.total + " files · " + S.size(p.bytes) + " of " + S.size(p.totalBytes) + "</p>";
      } else if (state === "checking") h = "<p class='mo-note'>Checking offline download…</p>";
      else if (state === "na") h = "<p class='mo-note'>Offline play is not available for this game yet.</p>";
      else if (state === "ready" || state === "update") {
        h = "<p class='mo-line'><span class='mo-ok' aria-hidden='true'>✓</span> <b>Ready offline</b> · " + S.size(meta.bytes) + "</p>";
        if (state === "update") h += "<p class='mo-line'><b>Update available</b>" + (manifest ? " (" + size + ")" : "") + "</p>";
        h += "<p class='mo-row'>" + (state === "update" ? "<button type='button' class='" + esc(btn1) + "' data-mo='get'>Update download</button>" : "") +
          "<button type='button' class='" + esc(btn) + "' data-mo='rm'>Remove download</button></p>";
      } else {
        h = "<p class='mo-row'><button type='button' class='" + esc(btn1) + "' data-mo='get'>Download for offline" + (size ? " (" + size + ")" : "") + "</button></p>" +
          "<p class='mo-note'>Keep " + esc(title) + " on this device: open it here with no internet, and your progress syncs when you are back online.</p>";
      }
      if (note) h += "<p class='mo-note mo-msg' role='status'>" + esc(note) + "</p>";
      if (supported && enabled && state !== "checking") h += "<p class='mo-note' data-mo-usage></p>";
      host.innerHTML = h;
      host.setAttribute("data-state", state);
      if (supported && enabled && state !== "checking") usageLine();
    }
    function refresh() {
      return Promise.all([O.meta(slug), nav.onLine === false ? Promise.resolve(manifest) : O.manifest(slug).catch(function () { return manifest; })]).then(function (r) {
        meta = r[0]; manifest = r[1];
        state = meta ? S.downloadState(meta, manifest) : manifest ? "none" : "na";
        render();
      }, function () { state = "na"; render(); });
    }
    host.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-mo]");
      if (!b) return;
      var act = b.getAttribute("data-mo");
      if (act === "rm") {
        if (!confirm("Remove the offline copy of " + title + "? Your progress is not affected.")) return;
        O.remove(slug).then(function () { note = "Removed from this device."; return refresh(); });
        return;
      }
      if (nav.onLine === false) { note = "You need to be online to download."; render(); return; }
      state = "busy"; note = ""; prog = null; render();
      O.download(slug, function (p) { prog = p; if (state === "busy") render(); }).then(function () {
        note = "Saved. You can now play " + title + " here with no internet.";
        return refresh();
      }, function (err) { note = err.message || "The download did not finish."; return refresh(); });
    });
    if (!supported || !enabled) { render(); return; }
    refresh();
    window.addEventListener("online", refresh);
  }

  /* ---------- the offline banner on the play page ---------- */
  var playing = !!doc.querySelector("[data-gm-stage], [data-mib-play]");
  var OFF_TEXT = "Playing offline · progress will sync";
  function offlineNow() { O.banner(OFF_TEXT, "warn", 0); }
  O.offline = offlineNow;

  /* ---------- sending what waited ---------- */
  var syncing = null;
  /** Send waiting saves, scores and results for the signed-in player. Resolves the number sent. */
  O.syncNow = function () {
    if (!supported || nav.onLine === false) return Promise.resolve(0);
    if (syncing) return syncing;
    var me = owner();
    if (me === "guest") return Promise.resolve(0);
    syncing = Promise.all([
      S.flush(S.outbox(), { owner: me, backups: S.backups() }).catch(function () { return { sent: 0, merged: 0 }; }),
      S.flushArcade(S.arcadeOutbox(), { owner: me }).catch(function () { return { sent: 0 }; }),
    ]).then(function (r) {
      var n = r[0].sent + r[1].sent;
      if (n) O.banner(n === 1 ? "Synced: your offline progress is saved to your account." : "Synced: " + n + " offline saves and results added to your account.", "ok", 5);
      return n;
    }).then(function (n) { syncing = null; offerGuest(); return n; }, function () { syncing = null; return 0; });
    return syncing;
  };

  /* ---------- a guest's offline progress, offered to the account that signs in ---------- */
  var offered = false;
  function offerGuest() {
    var me = owner();
    if (offered || me === "guest" || !supported) return;
    try { if (sessionStorage.getItem("mib-guest-offer") === "later") return; } catch { /* ignore */ }
    Promise.all([
      S.outbox().all().catch(function () { return []; }),
      S.arcadeOutbox().all().catch(function () { return []; }),
    ]).then(function (r) {
      var mine = r[0].filter(function (i) { return i.owner === "guest"; }).length + r[1].filter(function (i) { return (i.user || "guest") === "guest"; }).length;
      if (!mine || offered) return;
      offered = true; styles();
      var el = doc.createElement("div"); el.className = "mo-offer"; el.setAttribute("role", "dialog"); el.setAttribute("aria-labelledby", "mo-offer-h");
      el.innerHTML = "<h2 id='mo-offer-h'>Add your offline progress?</h2><p>You played " + (mine === 1 ? "once" : mine + " times") +
        " on this device without signing in. Add " + (mine === 1 ? "it" : "them") + " to the account you are signed in to now?</p>" +
        "<div class='mo-offer__row'><button type='button' class='btn btn--primary btn--sm' data-mo-offer='add'>Add to my account</button>" +
        "<button type='button' class='btn btn--ghost btn--sm' data-mo-offer='later'>Not now</button></div>";
      el.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-mo-offer]"); if (!b) return;
        var act = b.getAttribute("data-mo-offer"); el.remove();
        if (act === "later") { try { sessionStorage.setItem("mib-guest-offer", "later"); } catch { /* ignore */ } return; }
        Promise.all([S.adopt(S.outbox(), "guest", me), S.adopt(S.arcadeOutbox(), "guest", me, "user")]).then(function () { return O.syncNow(); });
      });
      doc.body.appendChild(el);
    });
  }

  /* ---------- start ---------- */
  function start() {
    O.register();
    Array.prototype.forEach.call(doc.querySelectorAll("[data-mib-offline]"), boxUI);
    if (playing) {
      if (nav.onLine === false) offlineNow();
      else { // "online" can still mean no route to the server (Wi-Fi without internet): ask once
        var t = setTimeout(offlineNow, 6000);
        fetch(S.MANIFEST_DIR + "index.json", { cache: "no-store" }).then(function () { clearTimeout(t); }, function () { clearTimeout(t); offlineNow(); });
      }
      window.addEventListener("offline", offlineNow);
    }
    window.addEventListener("online", function () {
      if (playing) O.banner("Back online · syncing your progress…", "ok", 3);
      setTimeout(O.syncNow, 800);
    });
    window.addEventListener("focus", function () { O.syncNow(); });
    doc.addEventListener("visibilitychange", function () { if (!doc.hidden) O.syncNow(); });
    if (supported) {
      nav.serviceWorker.addEventListener("message", function (e) {
        var d = e.data || {};
        if (d.type === "mib-synced" && d.sent) O.banner("Synced: your offline progress is saved to your account.", "ok", 5);
      });
    }
    setTimeout(function () { O.syncNow(); offerGuest(); }, 1500);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
