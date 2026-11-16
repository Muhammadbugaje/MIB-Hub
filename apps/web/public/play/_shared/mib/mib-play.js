/* MIB-Hub play bridge. Loaded by /play/<slug> (src/pages/play/[slug].astro) before any game code.
 *
 * The old EE Hub games are plain scripts that talk to the page through data attributes and to the server through
 * data-gm-api (now /api/games/arcade/, see src/games/arcade-api.ts). This file adds what MIB-Hub needs on top:
 *
 *   - loads the game's scripts in order, after the player's cloud save has been copied into this browser;
 *   - cloud save: the game's own localStorage keys go to /api/games/<slug>/save (signed-in players), every 20 s,
 *     after each result and when the tab is hidden or closed; a newer cloud save wins when the page opens;
 *   - play tracking (POST /api/track): start, level_start, level_complete, level_fail, end;
 *   - window.MIBPlay.level(n) (called by the games when a level starts) and MIBPlay.checkCheat(code, channel)
 *     (asks the server about codes that are not in the page);
 *   - the like button, the "How to play" dialog and the cloud-save status chip in the title bar.
 *
 * No dependencies; runs in Safari 15+. Every storage access is in try/catch (private mode). */
(function () {
  "use strict";
  var cfgEl = document.getElementById("mib-play-config");
  if (!cfgEl) return;
  var C;
  try { C = JSON.parse(cfgEl.textContent || "{}"); } catch { return; }
  var SLUG = C.slug;
  var stage = document.querySelector("[data-gm-stage]");
  var bootEl = document.querySelector("[data-mib-boot]");
  var errors = (window.__mibErrors = []);

  function rid() { var a = new Uint8Array(12); try { crypto.getRandomValues(a); } catch { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); } return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  function post(url, body, keep) {
    var text = JSON.stringify(body);
    return fetch(url, { method: "POST", credentials: "same-origin", keepalive: !!keep && text.length < 60000,
      headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: text })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || "Request failed"); e.status = r.status; throw e; } return j; }); });
  }

  var M = (window.MIBPlay = { slug: SLUG, sessionId: rid(), config: C });

  /* ---------- play tracking ---------- */
  var startedAt = Date.now(), lvl = { id: "", at: 0 };
  function track(kind, extra) {
    if (!C.tracking) return;
    var body = { gameSlug: SLUG, kind: kind, sessionId: M.sessionId };
    for (var k in extra || {}) if (extra[k] !== undefined && extra[k] !== null) body[k] = extra[k];
    post("/api/track", body, true).catch(function () {});
  }
  M.track = track;
  /** A level (stage, round, mission) has started. Repeats within 1.5 s are ignored. */
  M.level = function (id) {
    var s = String(id == null ? "" : id).slice(0, 40), now = Date.now();
    if (s === lvl.id && now - lvl.at < 1500) return;
    lvl = { id: s, at: now };
    track("level_start", { level: s });
  };
  function onResult(payload) {
    var p = payload || {}, level = p.stage != null ? String(p.stage) : lvl.id;
    var kind = p.result === "lose" ? "level_fail" : "level_complete";
    track(kind, { level: level, score: typeof p.score === "number" ? Math.round(p.score) : null, durationMs: lvl.at ? Date.now() - lvl.at : null, meta: { result: p.result || "", mode: p.mode || "solo" } });
    lvl = { id: "", at: 0 };
    setTimeout(function () { push(false); }, 2000); // the game writes its own save just after reporting
  }

  /* ---------- cheats checked by the server ---------- */
  M.checkCheat = function (code, channel) {
    return post("/api/games/" + SLUG + "/cheat", { code: String(code || ""), channel: channel === "dial" ? "dial" : "typed" })
      .then(function (r) { return r && r.key ? r.key : null; }, function () { return null; });
  };

  /* ---------- cloud save ---------- */
  var PREFIXES = C.savePrefixes || [], MARK = "mib-cloud-" + SLUG, chip = document.querySelector("[data-mib-cloud]");
  function ls() { try { return window.localStorage; } catch { return null; } }
  function mine(k) { if (!k || /-probe$/.test(k)) return false; for (var i = 0; i < PREFIXES.length; i++) if (k.indexOf(PREFIXES[i]) === 0) return true; return false; }
  function localKeys() { var s = ls(), out = {}; if (!s) return out; try { for (var i = 0; i < s.length; i++) { var k = s.key(i); if (mine(k)) out[k] = s.getItem(k); } } catch { /* ignore */ } return out; }
  function sig(o) { var t = JSON.stringify(o), h = 5381; for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return t.length + ":" + h; }
  function mark(v) { var s = ls(); try { if (v === undefined) return JSON.parse(s.getItem(MARK)) || {}; s.setItem(MARK, JSON.stringify(v)); } catch { /* ignore */ } return {}; }
  function say(text, state) { if (!chip) return; chip.textContent = text; chip.setAttribute("data-state", state || ""); }
  M.cloud = { keys: localKeys, enabled: !!(C.signedIn && C.canSave) };
  var pushing = false;
  function push(force, keep) {
    if (!M.cloud.enabled || pushing) return Promise.resolve(false);
    var keys = localKeys(), s = sig(keys), m = mark();
    if (!Object.keys(keys).length || (!force && m.sig === s)) return Promise.resolve(false);
    var at = Date.now(); pushing = true; say("Saving…", "busy");
    return post("/api/games/" + SLUG + "/save", { slot: "auto", data: { keys: keys, at: at }, summary: "Played " + new Date(at).toLocaleDateString() }, keep)
      .then(function () { mark({ at: at, sig: s }); say("Saved to your account", "ok"); return true; },
        function (e) { say(e && e.status === 413 ? "Save too big for the cloud: kept on this device" : "Saved on this device (cloud later)", "warn"); return false; })
      .then(function (v) { pushing = false; return v; });
  }
  M.cloud.push = push;
  function pull() {
    if (!C.signedIn) { say(C.guestNote || "Progress is saved on this device only", "guest"); return Promise.resolve(); }
    say("Loading your save…", "busy");
    return fetch("/api/games/" + SLUG + "/save?slot=auto", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var sv = j && j.save && j.save.data, m = mark(), s = ls();
        if (sv && sv.keys && sv.at > (m.at || 0) && s) {
          for (var k in sv.keys) if (mine(k) && typeof sv.keys[k] === "string") try { s.setItem(k, sv.keys[k]); } catch { /* ignore */ }
          mark({ at: sv.at, sig: sig(localKeys()) });
          say("Cloud save loaded", "ok");
        } else say(sv ? "Cloud save on" : "Cloud save on (nothing saved yet)", "ok");
      }, function () { say("Offline: saving on this device", "warn"); });
  }

  /* ---------- loading the game ---------- */
  var booted = false;
  function bootMsg(html, bad) { if (!bootEl) return; bootEl.hidden = false; bootEl.classList.toggle("is-error", !!bad); var p = bootEl.querySelector("[data-mib-boot-msg]"); if (p) p.innerHTML = html; }
  window.addEventListener("error", function (e) {
    errors.push(String((e && e.message) || "error") + (e && e.filename ? " @ " + e.filename + ":" + e.lineno : ""));
    if (!booted) bootMsg("This game hit a problem while starting. <a href=''>Reload the page</a> to try again.", true);
  });
  function hook() { // after arcade.js: watch every result the game reports
    var A = window.Arcade; if (!A || !A.report || A.report.__mib) return;
    var orig = A.report;
    A.report = function (game, payload) { try { onResult(payload); } catch { /* ignore */ } return orig.apply(this, arguments); };
    A.report.__mib = true;
  }
  function load() {
    var list = C.scripts || [], left = list.length, failed = false;
    if (!left) return;
    list.forEach(function (src) {
      var s = document.createElement("script"); s.src = src; s.async = false;
      s.onload = function () {
        if (/\/arcade\.js(\?|$)/.test(src)) hook();
        if (--left === 0 && !failed) {
          booted = true; hook();
          if (bootEl) bootEl.hidden = true;
          track("start", { meta: { signedIn: !!C.signedIn } });
          var cv = stage && stage.querySelector("[data-gm-canvas]"); if (cv) try { cv.focus({ preventScroll: true }); } catch { /* ignore */ }
          if (M.cloud.enabled) setTimeout(function () { push(false); }, 4000);
        }
      };
      s.onerror = function () { failed = true; errors.push("load " + src); bootMsg("A file this game needs could not be loaded. Check your connection and <a href=''>reload</a>.", true); };
      document.body.appendChild(s);
    });
  }
  pull().then(load, load);

  setInterval(function () { if (!document.hidden) push(false); }, 20000);
  document.addEventListener("visibilitychange", function () { if (document.hidden) push(false, true); });
  window.addEventListener("pagehide", function () { push(false, true); track("end", { durationMs: Date.now() - startedAt }); });

  /* ---------- title bar: like, how to play ---------- */
  var likeBtn = document.querySelector("[data-mib-like]");
  if (likeBtn) likeBtn.addEventListener("click", function () {
    likeBtn.disabled = true;
    post("/api/likes", { gameSlug: SLUG }).then(function (r) {
      likeBtn.setAttribute("aria-pressed", r.liked ? "true" : "false");
      var n = likeBtn.querySelector("[data-mib-like-n]"); if (n) n.textContent = String(r.total);
      likeBtn.querySelector("[data-mib-like-label]").textContent = r.liked ? "Liked" : "Like";
    }, function () {}).then(function () { likeBtn.disabled = false; });
  });
  var help = document.querySelector("[data-mib-help]"), dlg = document.querySelector("[data-mib-help-dialog]");
  if (help && dlg && dlg.showModal) {
    help.addEventListener("click", function () {
      var pb = document.querySelector("[data-gm-pause]"); if (booted && pb && pb.getAttribute("aria-pressed") !== "true") pb.click();
      dlg.showModal();
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || (e.target.closest && e.target.closest("[data-mib-close]"))) dlg.close(); });
  } else if (help) help.hidden = true;
})();
