/* EE Hub Arcade — play without internet.
   "Download for offline" keeps everything one game needs (its scripts, the 3D engine, sounds, the play page) in this
   browser, in a Cache Storage cache named "ee-arcade-<slug>". The site's service worker (static/sw.js) serves the
   game from that cache when the network is gone, and serves pictures, sounds and content-hashed scripts from it even
   when online. Results played offline wait in an IndexedDB outbox and are sent to /arcade/api/sync/ when the device
   is back online, each with its own id so nothing is counted twice. Everything here is optional: without service
   workers or Cache Storage the arcade works exactly as before. */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  var doc = document, stage = doc.querySelector("[data-gm-stage]"), allBox = doc.querySelector("[data-gm-offline-all]");
  var apiRoot = (stage && stage.getAttribute("data-gm-api")) || (doc.querySelector("[data-gm-api]") || { getAttribute: function () { return "/arcade/api/"; } }).getAttribute("data-gm-api") || "/arcade/api/";
  var SLUG = stage ? stage.getAttribute("data-gm-slug") : "";
  var CACHE = "ee-arcade-", SHARED = "ee-arcade--shared", META = "ee-arcade-pkg:", DB = "ee-arcade", STORE = "outbox", SYNC_TAG = "ee-arcade-outbox";
  var hasCaches = "caches" in window, hasSW = "serviceWorker" in navigator;
  var O = window.ArcadeOffline = { supported: hasCaches && hasSW };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function mb(b) { return b >= 1048576 ? (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function cookie(name) { var m = doc.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : ""; }
  function csrf() { return cookie("csrftoken") || (stage && stage.getAttribute("data-csrf")) || ((doc.querySelector("[data-csrf]") || { getAttribute: function () { return ""; } }).getAttribute("data-csrf")) || ""; }
  function userId() { var m = doc.querySelector('meta[name="ee-user"]'); return m ? (m.getAttribute("content") || "guest") : "guest"; }
  function soundExt() { try { var a = doc.createElement("audio"); return a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"') ? "ogg" : "m4a"; } catch (e) { return "m4a"; } }
  O.isNetErr = function (e) { return !navigator.onLine || (e && (e.name === "TypeError" || /fetch|network|load failed|offline/i.test(e.message || ""))); };

  /* ---------- styles (scoped gm-off-*) ---------- */
  function styles() {
    if (doc.getElementById("gm-off-css")) return;
    var s = doc.createElement("style"); s.id = "gm-off-css";
    s.textContent = ".gm-off{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}.gm-off__bar{width:110px;height:6px;border-radius:9px;background:rgba(127,127,127,.25);overflow:hidden}.gm-off__bar i{display:block;height:100%;width:0;background:var(--gm-a,#3dd68c);transition:width .2s}" +
      ".gm-off__note{font-size:12px;opacity:.8}.gm-off-banner{position:fixed;left:50%;top:12px;transform:translate(-50%,-140%);z-index:9999;max-width:min(92vw,520px);padding:10px 16px;border-radius:12px;background:#14213d;color:#fff;font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3);transition:transform .35s ease;pointer-events:none;text-align:center}" +
      ".gm-off-banner.is-on{transform:translate(-50%,0)}.gm-off-banner.is-ok{background:#166534}@media (prefers-reduced-motion:reduce){.gm-off-banner{transition:none}}" +
      ".gm-off-all{margin:12px 0;padding:14px 16px;border-radius:14px;border:1px solid rgba(127,127,127,.25)}.gm-off-all p{margin:6px 0}" +
      ".gm-install{position:fixed;inset:0;z-index:9998;background:rgba(5,10,20,.6);display:flex;align-items:flex-end;justify-content:center;padding:12px}.gm-install__card{background:#fff;color:#14213d;border-radius:18px;width:100%;max-width:440px;padding:18px 18px 14px;font:16px/1.45 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35)}" +
      ".gm-install__card h2{font-size:1.15rem;margin:0 0 8px}.gm-install__card ol{margin:6px 0 10px;padding-left:22px}.gm-install__card li{margin:6px 0}.gm-install__card .btn{min-height:44px}@media (min-width:700px){.gm-install{align-items:center}}@media (prefers-color-scheme:dark){.gm-install__card{background:#171e2d;color:#eef2f8}}";
    doc.head.appendChild(s);
  }

  /* ---------- banner: "Offline — playing from your device" ---------- */
  var bannerEl, bannerT;
  function banner(text, ok, secs) {
    styles(); if (!bannerEl) { bannerEl = doc.createElement("div"); bannerEl.className = "gm-off-banner"; bannerEl.setAttribute("role", "status"); doc.body.appendChild(bannerEl); }
    bannerEl.textContent = text; bannerEl.classList.toggle("is-ok", !!ok); bannerEl.classList.add("is-on");
    clearTimeout(bannerT); bannerT = setTimeout(function () { bannerEl.classList.remove("is-on"); }, (secs || 15) * 1000);
  }
  O.banner = banner;

  /* ---------- outbox (IndexedDB) ---------- */
  function idb() {
    return new Promise(function (ok, no) {
      if (!window.indexedDB) return no(new Error("no indexedDB"));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "cid" }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); };
    });
  }
  function tx(mode, fn) { return idb().then(function (db) { return new Promise(function (ok, no) { var t = db.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st); t.oncomplete = function () { ok(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { no(t.error); }; }); }); }
  function cid() { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {} return "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }
  O.queue = function (kind, data) {
    var item = { cid: cid(), kind: kind || "result", at: Date.now(), data: data, csrf: csrf(), user: userId() };
    return tx("readwrite", function (st) { st.put(item); }).then(function () {
      try { navigator.serviceWorker.ready.then(function (reg) { if (reg.sync) reg.sync.register(SYNC_TAG).catch(function () {}); }); } catch (e) {}
      return item;
    }).catch(function () { var l = lsGet("ee-arcade-outbox") || []; l.push(item); lsSet("ee-arcade-outbox", l.slice(-60)); return item; });
  };
  O.pending = function () { return tx("readonly", function (st) { return st.getAll(); }).then(function (r) { return r || []; }, function () { return lsGet("ee-arcade-outbox") || []; }); };
  var flushing = null;
  O.flush = function () {
    if (flushing) return flushing;
    if (!navigator.onLine) return Promise.resolve({ sent: 0 });
    flushing = O.pending().then(function (items) {
      var mine = items.filter(function (i) { return !i.user || i.user === userId(); }).slice(0, 40);
      if (!mine.length) return { sent: 0 };
      return fetch(apiRoot + "sync/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf(), "Accept": "application/json" },
        body: JSON.stringify({ owner: userId(), items: mine.map(function (i) { return { cid: i.cid, kind: i.kind, at: i.at, data: i.data }; }) }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Sync failed"); return j; }); })
        .then(function (j) {
          var gone = (j.done || []).concat((j.rejected || []).map(function (x) { return x.cid; }));
          return tx("readwrite", function (st) { gone.forEach(function (c) { st.delete(c); }); }).catch(function () {
            lsSet("ee-arcade-outbox", (lsGet("ee-arcade-outbox") || []).filter(function (i) { return gone.indexOf(i.cid) < 0; })); }).then(function () {
            var n = (j.done || []).length; if (n) banner(n === 1 ? "Your offline result was added to your record." : n + " offline results were added to your record.", true, 5);
            return { sent: n, rejected: j.rejected || [], me: j.me };
          });
        });
    }).catch(function () { return { sent: 0 }; }).then(function (r) { flushing = null; return r; });
    return flushing;
  };

  /* ---------- packages ---------- */
  function getJSON(url) { return fetch(url, { credentials: "same-origin", headers: { "Accept": "application/json" }, cache: "no-store" }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Request failed"); return j; }); }); }
  O.info = function (slug) { return getJSON(apiRoot + "package/" + slug + "/"); };
  O.meta = function (slug) { return lsGet(META + slug); };
  function pageUrls(html, base) { // every same-origin file the play page itself loads
    var out = [];
    try {
      var d = new DOMParser().parseFromString(html, "text/html");
      Array.prototype.forEach.call(d.querySelectorAll("script[src],link[href],img[src],[data-gm-three]"), function (el) {
        var v = el.getAttribute("src") || el.getAttribute("data-gm-three") || (el.tagName === "LINK" && /stylesheet|icon|manifest|preload|modulepreload/i.test(el.getAttribute("rel") || "") ? el.getAttribute("href") : "");
        if (!v) return; var u = new URL(v, base); if (u.origin === location.origin && u.pathname.indexOf("/static/") === 0) out.push(u.pathname + u.search);
      });
    } catch (e) {}
    return out;
  }
  O.download = function (slug, opts, progress) {
    opts = opts || {}; progress = progress || function () {};
    if (!O.supported) return Promise.reject(new Error("This browser cannot keep games for offline play."));
    var name = CACHE + slug, info;
    return O.info(slug).then(function (i) {
      info = i;
      return fetch(i.page, { credentials: "same-origin", cache: "no-store", redirect: "follow" }).then(function (r) {
        if (!r.ok || r.redirected) throw new Error("Open the game while signed in, then download it.");
        return r.clone().text().then(function (html) { return { res: r, html: html }; });
      });
    }).then(function (pg) {
      // Files every game uses (site shell, arcade runtime, core sounds) go to one shared cache, kept once.
      var ext = soundExt(), shared = {}, list = [];
      info.files.concat(info.sounds[ext] || []).forEach(function (f) { list.push(f.u); if (f.s) shared[f.u] = 1; });
      pageUrls(pg.html, location.href).forEach(function (u) { list.push(u); });
      if (opts.voices) (info.voices[ext] || []).forEach(function (f) { list.push(f.u); });
      var seen = {}; list = list.filter(function (u) { if (seen[u]) return false; seen[u] = 1; return true; });
      return Promise.all([caches.delete(name).then(function () { return caches.open(name); }), caches.open(SHARED)]).then(function (cs) {
        var cache = cs[0], common = cs[1];
        var done = 0, bytes = 0, failed = [], i = 0, total = list.length + 2;
        function one() {
          if (i >= list.length) return Promise.resolve();
          var u = list[i++], into = shared[u] ? common : cache;
          return (shared[u] ? common.match(u) : Promise.resolve(null)).then(function (have) {
            if (have) return;
            return fetch(u, { credentials: "same-origin", cache: "no-cache" }).then(function (r) {
              if (!r.ok) throw new Error(r.status);
              return r.clone().blob().then(function (b) { bytes += b.size; return into.put(u, r); });
            });
          }).catch(function () { failed.push(u); }).then(function () { done++; progress(done / total, bytes); return one(); });
        }
        return Promise.all([one(), one(), one(), one()]).then(function () {
          return cache.put(info.page, pg.res).then(function () { progress((done + 1) / total, bytes); return fetch(info.lan_page, { credentials: "same-origin" }).then(function (r) { if (r.ok) return cache.put(info.lan_page, r); }).catch(function () {}); });
        }).then(function () {
          if (failed.length > Math.max(2, list.length * 0.05)) throw new Error("Some files did not download (" + failed.length + "). Try again on a better connection.");
          var m = { v: info.version, size: bytes, at: Date.now(), user: userId(), voices: !!opts.voices, title: info.title, missing: failed.length };
          lsSet(META + slug, m); progress(1, bytes);
          try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
          return m;
        });
      });
    });
  };
  function anySaved() { try { return Object.keys(localStorage).some(function (k) { return k.indexOf(META) === 0; }); } catch (e) { return false; } }
  O.remove = function (slug) {
    lsSet(META + slug, null); if (!hasCaches) return Promise.resolve();
    return caches.delete(CACHE + slug).then(function () { if (!anySaved()) return caches.delete(SHARED); });
  };
  O.usage = function () { return navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : Promise.resolve(null); };
  function isIOS() { var ua = navigator.userAgent || ""; return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }

  /* A different person signed in on this device: forget the saved play pages (they carry the old account's name and
     settings), keep the game files. */
  (function () {
    if (!hasCaches) return; var me = userId();
    Object.keys(localStorage || {}).forEach(function (k) {
      if (k.indexOf(META) !== 0) return; var m = lsGet(k); if (!m || m.user === me) return;
      var slug = k.slice(META.length); caches.open(CACHE + slug).then(function (c) { return c.keys().then(function (ks) { return Promise.all(ks.filter(function (rq) { return /\/arcade\/play\//.test(new URL(rq.url).pathname); }).map(function (rq) { return c.delete(rq); })); }); }).catch(function () {});
      m.user = me; m.stalePage = true; lsSet(k, m);
    });
  })();

  /* ---------- the play page button ---------- */
  function playUI() {
    var host = doc.querySelector("[data-gm-offline]"); if (!host || !SLUG) return;
    styles();
    if (!O.supported) { host.innerHTML = "<span class='gm-off__note'>This browser cannot keep games offline.</span>"; return; }
    var info = null;
    function render(state, extra) {
      var m = O.meta(SLUG), h = "";
      if (state === "busy") h = "<span class='gm-off__note'>Downloading…</span><span class='gm-off__bar' role='progressbar' aria-label='Download progress'><i data-gm-off-bar></i></span>";
      else if (m) {
        var upd = info && info.version !== m.v;
        h = (upd ? "<button type='button' class='btn btn-primary btn-sm' data-gm-off='get'>Update offline copy" + (info ? " (" + mb(info.size) + ")" : "") + "</button>" : "<span class='gm-off__note' title='Saved on this device'>Offline ✓ " + mb(m.size) + "</span>") +
          "<button type='button' class='btn btn-ghost btn-sm' data-gm-off='rm'>Remove</button>";
      } else h = "<button type='button' class='btn btn-ghost btn-sm' data-gm-off='get' title='Keep this game on this device so it plays with no internet'>Download for offline" + (info ? " (" + mb(info.size) + ")" : "") + "</button>";
      if (extra) h += "<span class='gm-off__note'>" + esc(extra) + "</span>";
      host.innerHTML = "<span class='gm-off'>" + h + "</span>";
    }
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gm-off]"); if (!b) return; var act = b.getAttribute("data-gm-off");
      if (act === "rm") { O.remove(SLUG).then(function () { render("", "Removed from this device."); }); return; }
      if (!navigator.onLine) { render("", "You need internet to download."); return; }
      var voices = false; if (info && info.voice_size > 0) voices = confirm("Also keep the recorded voices (" + mb(info.voice_size) + ")?");
      render("busy");
      O.download(SLUG, { voices: voices }, function (f) { var bar = host.querySelector("[data-gm-off-bar]"); if (bar) bar.style.width = Math.round(f * 100) + "%"; })
        .then(function (m) { render("", isIOS() && !standalone() ? "Saved. On iPhone, add EE Hub to your Home Screen so it stays." : "Saved: plays with no internet."); })
        .catch(function (err) { render("", err.message); });
    });
    render("");
    if (navigator.onLine) O.info(SLUG).then(function (i) { info = i; var m = O.meta(SLUG); if (m && m.stalePage) { m.stalePage = false; lsSet(META + SLUG, m); fetch(i.page, { credentials: "same-origin" }).then(function (r) { if (r.ok && !r.redirected) return caches.open(CACHE + SLUG).then(function (c) { return c.put(i.page, r); }); }).catch(function () {}); } render(""); }).catch(function () {});
  }

  /* ---------- the arcade home: download every game ---------- */
  function allUI() {
    if (!allBox) return; styles();
    if (!O.supported) { allBox.innerHTML = "<div class='gm-off-all'><p>This browser cannot keep games for offline play.</p></div>"; return; }
    var list = null;
    function render(note) {
      var have = 0, haveB = 0, total = 0;
      var sharedB = 0; (list || []).forEach(function (g) { sharedB = Math.max(sharedB, g.shared_size || 0); total += g.size - (g.shared_size || 0); var m = O.meta(g.slug); if (m) { have++; haveB += m.size; } });
      total += sharedB;
      allBox.innerHTML = "<div class='gm-off-all'><p><b>Play without internet.</b> Keep the games on this device; they still open from this website, and your results are added to your record when you are back online.</p>" +
        "<p>" + (list ? have + " of " + list.length + " games saved (" + mb(haveB) + ")" : "Checking…") + " · <span data-gm-off-usage></span></p>" +
        "<p><button type='button' class='btn btn-primary btn-sm' data-gm-off-all" + (list ? "" : " disabled") + ">Download all games" + (list ? " (" + mb(total) + ")" : "") + "</button> " +
        (have ? "<button type='button' class='btn btn-ghost btn-sm' data-gm-off-clear>Remove all</button>" : "") + " <span class='gm-off__bar'><i data-gm-off-bar></i></span></p>" +
        (isIOS() && !standalone() ? "<p class='gm-off__note'>On iPhone and iPad, add EE Hub to your Home Screen (Share → Add to Home Screen), or Safari may clear saved games after a few weeks without a visit.</p>" : "") +
        (note ? "<p class='gm-off__note'>" + esc(note) + "</p>" : "") + "</div>";
      O.usage().then(function (u) { var el = allBox.querySelector("[data-gm-off-usage]"); if (el && u) el.textContent = "this site uses " + mb(u.usage || 0) + " of " + mb(u.quota || 0) + " allowed"; });
    }
    allBox.addEventListener("click", function (e) {
      if (e.target.closest("[data-gm-off-clear]")) { Promise.all((list || []).map(function (g) { return O.remove(g.slug); })).then(function () { render("Removed."); }); return; }
      if (!e.target.closest("[data-gm-off-all]") || !list) return;
      var i = 0, n = list.length; e.target.disabled = true;
      (function next() {
        if (i >= n) { render("All games saved on this device."); return; }
        var g = list[i++], bar = allBox.querySelector("[data-gm-off-bar]");
        O.download(g.slug, {}, function (f) { if (bar) bar.style.width = Math.round(((i - 1) + f) / n * 100) + "%"; }).catch(function () {}).then(next);
      })();
    });
    render();
    getJSON(apiRoot + "packages/").then(function (j) { list = j.games || []; render(); }).catch(function () { render(navigator.onLine ? "Could not list the games." : "You are offline. Games you already saved still open."); });
  }

  /* ---------- pin to the home screen: each game installs as its own app (its manifest is set by the page) ---------- */
  var promptEv = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); promptEv = e; installUI(); });
  window.addEventListener("appinstalled", function () { promptEv = null; installUI(); banner("Installed. Open it from your home screen.", true, 6); });
  function isAndroid() { return /android/i.test(navigator.userAgent || ""); }
  function installSheet(title) {
    styles(); var old = doc.getElementById("gm-install-sheet"); if (old) old.remove();
    var steps = isIOS()
      ? "<ol><li>Tap <b>Share</b> <span aria-hidden='true'>(the square with an arrow, at the bottom of Safari)</span>.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. The game gets its own icon and opens full screen.</li></ol><p class='gm-off__note'>Use Safari: other iPhone browsers may not show Add to Home Screen.</p>"
      : isAndroid()
        ? "<ol><li>Tap the browser menu <b>⋮</b> (top right in Chrome).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Tap <b>Install</b>. The game gets its own icon and opens full screen.</li></ol>"
        : "<ol><li>Click the <b>install</b> icon at the right of the address bar, or open the browser menu.</li><li>Choose <b>Install " + esc(title) + "</b> (Chrome, Edge) or <b>Add to Dock</b> (Safari: File menu).</li></ol>";
    var el = doc.createElement("div"); el.id = "gm-install-sheet"; el.className = "gm-install"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "gm-install-h");
    el.innerHTML = "<div class='gm-install__card'><h2 id='gm-install-h'>Put " + esc(title) + " on your home screen</h2>" + steps +
      (SLUG && !O.meta(SLUG) && O.supported ? "<p>Also keep it on this phone so it plays with no internet:</p><p><button type='button' class='btn btn-primary btn-sm' data-gm-inst='dl'>Download for offline</button></p>" : "") +
      "<p><button type='button' class='btn btn-ghost btn-sm' data-gm-inst='close'>Close</button></p></div>";
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gm-inst]"); if (e.target === el || (b && b.getAttribute("data-gm-inst") === "close")) { el.remove(); return; }
      if (b && b.getAttribute("data-gm-inst") === "dl") { var d = doc.querySelector("[data-gm-off='get']"); el.remove(); if (d) d.click(); }
    });
    doc.body.appendChild(el); var f = el.querySelector("button"); if (f) f.focus();
  }
  function installUI() {
    var host = doc.querySelector("[data-gm-install]"); if (!host) return; styles();
    if (standalone()) { host.innerHTML = ""; return; }
    var title = (doc.querySelector('meta[name="apple-mobile-web-app-title"]') || { getAttribute: function () { return "this game"; } }).getAttribute("content") || "this game";
    host.innerHTML = "<button type='button' class='btn btn-ghost btn-sm' data-gm-install-btn title='Pin " + esc(title) + " to your home screen'>" + (SLUG ? "Install this game" : "Install the arcade") + "</button>";
    host.firstChild.onclick = function () {
      if (promptEv) {
        var ev = promptEv; promptEv = null; ev.prompt();
        (ev.userChoice || Promise.resolve({})).then(function (c) { if (c && c.outcome === "accepted" && SLUG && !O.meta(SLUG) && O.supported && navigator.onLine) { var d = doc.querySelector("[data-gm-off='get']"); if (d) d.click(); } installUI(); });
      } else installSheet(title);
    };
  }
  O.installSheet = installSheet;

  /* ---------- online / offline ---------- */
  function start() {
    playUI(); allUI(); installUI();
    var OFF = "Offline — playing from your device. Results are saved here and added to your record later.";
    var show = stage && !window.MIBOffline; // MIB-Hub: /offline/mib-offline.js shows the offline banner on this page
    if (show && !navigator.onLine) banner(OFF, false, 15);
    else if (show) { // "online" can still mean no route to the server (Wi-Fi without internet): ask once
      var t = setTimeout(function () { banner(OFF, false, 15); }, 6000);
      fetch(apiRoot + "me/", { credentials: "same-origin", headers: { "Accept": "application/json" }, cache: "no-store" }).then(function () { clearTimeout(t); }, function () { clearTimeout(t); banner(OFF, false, 15); });
    }
    window.addEventListener("offline", function () { if (show) banner("Offline — playing from your device.", false, 15); });
    window.addEventListener("online", function () { if (show) banner("Back online — syncing.", true, 4); O.flush(); });
    if (navigator.onLine) setTimeout(function () { O.flush(); }, 2500);
    if (hasSW) navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.type === "arcade-synced" && e.data.n) banner(e.data.n + " offline result" + (e.data.n > 1 ? "s were" : " was") + " added to your record.", true, 5); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
