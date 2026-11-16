/* MIB-Hub full screen for every game (window.MIBFull). Loaded by /play/<slug> (src/pages/play/[slug].astro) for the
 * old arcade games (wired by mib-play.js) and the TypeScript games (wired by src/games/GameHost.tsx).
 *
 * What the owner asked for (phone test, 16 Nov 2026):
 *   - a game never starts without going full screen: a "Play" cover sits on the stage until it is tapped, and every
 *     Play / Start / Resume button enters full screen on that same tap (the Fullscreen API needs a real tap or click);
 *   - iPhone Safari has no full screen for anything but video, so there the stage becomes a fixed, edge-to-edge layer
 *     ("pseudo full screen": 100dvh, safe areas, page scroll locked). Added to the home screen, the site opens with no
 *     browser bars at all (manifest.webmanifest + apple-mobile-web-app-capable);
 *   - landscape games try screen.orientation.lock("landscape") and show a "turn your phone" hint in portrait;
 *   - a small X stays in the top corner while full screen. It leaves full screen AND pauses, then a "Resume" cover
 *     shows; Resume goes back to full screen and carries on. Esc, the back gesture, the browser's own exit and hiding
 *     the tab do the same;
 *   - on a computer the title bar's Full screen button still toggles, and the cover also offers "Play in this window".
 *
 *   MIBFull.attach(stage, { pause, resume, landscape, rotateHint, title, icon })   once per page
 *   MIBFull.cover("play" | "resume")   show the cover        MIBFull.enter()  go full screen (call inside a tap)
 *   MIBFull.exit()   leave and pause                         MIBFull.toggle() / .active() / .mode()
 *
 * Pure helpers (tested in apps/web/test/play-full.test.ts): isStartAction, wantsPseudo, inPortrait.
 * No dependencies; runs in Safari 15+. */
(function (root) {
  "use strict";
  var F = {};

  /* ---------- pure helpers ---------- */
  var START_ACTS = /^(play|start|go|resume|continue|retry|again|restart|replay|next|new|begin|fight|race|kick-?off|launch|enter|story|career|quick|solo|duo|versus|vs|arcade|campaign|training|mission|level|stage|run|rematch|tower|survival|trials?|tutorial|climb|time-?attack|endless|daily|challenge)/i;
  var NOT_START = /^(settings|done|reset|layout|bind|code|quit|menu|back|close|cancel|saves?|help|credits|about|shop|sound|mute|keys)\b/i;
  /** Is a tapped control one that starts or resumes play? { act: data-act, go: has the "go" style, text: its label } */
  F.isStartAction = function (b) {
    if (!b) return false;
    var act = String(b.act || "").trim(), text = String(b.text || "").trim();
    if (act && NOT_START.test(act)) return false;
    if (act && START_ACTS.test(act)) return true;
    if (!act && text && NOT_START.test(text)) return false;
    if (b.go) return true;
    return !!text && /^(▶\s*)?(play|start|resume|continue|new game|try again|retry|next level|go)\b/i.test(text);
  };
  /** Use the CSS full screen instead of the Fullscreen API? (iPhone Safari, or no API at all) */
  F.wantsPseudo = function (env) {
    env = env || {};
    if (env.forcePseudo) return true;
    if (!env.hasApi) return true;
    return env.enabled === false;
  };
  /** Is the screen taller than wide (with a little slack for square-ish windows)? */
  F.inPortrait = function (w, h) { return h > w * 1.05; };

  var doc = root.document;
  if (!doc || !doc.createElement) { root.MIBFull = F; return; } // tests: helpers only

  /* ---------- state ---------- */
  var S = { stage: null, o: {}, on: false, how: "", pushed: false, skipPop: false, coverMode: "", pausedByUs: false, windowed: false, portraitOk: false, x: null, cover: null, hint: null };
  var html = doc.documentElement;
  function fsEl() { return doc.fullscreenElement || doc.webkitFullscreenElement || null; }
  function coarse() { try { return root.matchMedia("(pointer: coarse)").matches; } catch { return false; } }
  function refit() { [30, 180, 450].forEach(function (t) { setTimeout(function () { try { root.dispatchEvent(new Event("resize")); } catch { /* old browser */ } paintHint(); }, t); }); }
  function lockLandscape() {
    if (S.o.landscape === false) return;
    try { var so = root.screen && root.screen.orientation; if (so && so.lock) so.lock("landscape").catch(function () {}); } catch { /* not supported: fine */ }
  }
  function unlockOrientation() { try { var so = root.screen && root.screen.orientation; if (so && so.unlock) so.unlock(); } catch { /* ignore */ } }

  F.active = function () { return S.on; };
  F.mode = function () { return S.how; };
  F.forcePseudo = false; // tests and ?pseudo=1 can force the iPhone path on a computer
  try { if (/[?&]pseudo=1\b/.test(root.location.search)) F.forcePseudo = true; } catch { /* ignore */ }

  /* ---------- the parts on the stage: X, cover, rotate hint ---------- */
  var CSS =
    ".mib-x{position:absolute;top:max(2px,env(safe-area-inset-top,0px));right:max(2px,env(safe-area-inset-right,0px));z-index:30;width:44px;height:44px;display:none;place-items:center;padding:0;margin:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}" +
    ".mib-x i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:rgba(4,10,16,.55);border:1px solid rgba(255,255,255,.4);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4)}" +
    ".mib-x:hover i,.mib-x:focus-visible i{background:rgba(4,10,16,.85)}.mib-x:focus-visible{outline:none}.mib-x:focus-visible i{outline:2px solid #fff}" +
    ".mib-full .mib-x{display:grid}" +
    ".mib-full--pseudo{position:fixed!important;inset:0!important;z-index:2147483000!important;width:100vw!important;height:100vh!important;height:100dvh!important;max-width:none!important;max-height:none!important;min-height:0!important;margin:0!important;border-radius:0!important;aspect-ratio:auto!important;transform:none!important;box-shadow:none!important}" +
    ".mib-full:fullscreen{width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;aspect-ratio:auto!important;margin:0!important}" +
    ".mib-full:-webkit-full-screen{width:100%!important;height:100%!important;max-height:none!important;border-radius:0!important;aspect-ratio:auto!important;margin:0!important}" +
    "html.mib-full-lock,html.mib-full-lock body{overflow:hidden!important;overscroll-behavior:none!important}" +
    ".mib-cover,.mib-rotate{position:absolute;inset:0;z-index:25;display:grid;place-content:center;justify-items:center;gap:12px;padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));text-align:center;color:#eafcff;font:15px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;background-color:rgba(3,9,14,.94);background-image:radial-gradient(60% 80% at 50% 40%,color-mix(in srgb,var(--gm-a,#3dd68c) 22%,transparent),transparent 70%);-webkit-user-select:none;user-select:none;touch-action:manipulation}" +
    ".mib-cover[hidden],.mib-rotate[hidden]{display:none}" +
    ".mib-cover img{width:64px;height:64px;border-radius:16px;box-shadow:0 10px 40px -10px var(--gm-a,#3dd68c)}" +
    ".mib-cover h2{margin:0;font-size:clamp(18px,4.4vmin,26px);color:#fff;letter-spacing:-.01em}" +
    ".mib-cover p{margin:0;max-width:34ch;font-size:13px;color:rgba(234,252,255,.78)}" +
    ".mib-go{display:inline-flex;align-items:center;gap:10px;min-height:56px;padding:0 30px;border:0;border-radius:999px;background:var(--gm-a,#3dd68c);color:#04140d;font:800 19px/1 system-ui,-apple-system,sans-serif;cursor:pointer;box-shadow:0 10px 30px -8px var(--gm-a,#3dd68c);-webkit-tap-highlight-color:transparent;touch-action:manipulation}" +
    ".mib-go:active{transform:scale(.97)}.mib-go:focus-visible{outline:3px solid #fff;outline-offset:3px}" +
    ".mib-win{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer}" +
    ".mib-rotate{z-index:26}.mib-rotate b{display:block;width:40px;height:66px;border:3px solid #fff;border-radius:9px;animation:mib-turn 2.2s ease-in-out infinite}" +
    "@keyframes mib-turn{0%,25%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}@media (prefers-reduced-motion:reduce){.mib-rotate b{animation:none}}" +
    "@media (max-height:420px){.mib-cover{gap:8px}.mib-cover img{width:44px;height:44px}.mib-go{min-height:50px}}";
  var X_SVG = "<svg width='14' height='14' viewBox='0 0 14 14' aria-hidden='true'><path d='M2 2l10 10M12 2L2 12' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>";
  var PLAY_SVG = "<svg width='18' height='18' viewBox='0 0 18 18' aria-hidden='true'><path d='M5 3.2v11.6a.8.8 0 0 0 1.2.7l9.3-5.8a.8.8 0 0 0 0-1.4L6.2 2.5A.8.8 0 0 0 5 3.2z' fill='currentColor'/></svg>";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function build() {
    if (!doc.getElementById("mib-full-css")) { var st = doc.createElement("style"); st.id = "mib-full-css"; st.textContent = CSS; doc.head.appendChild(st); }
    var stage = S.stage;
    S.x = doc.createElement("button"); S.x.type = "button"; S.x.className = "mib-x"; S.x.setAttribute("aria-label", "Leave full screen and pause"); S.x.title = "Leave full screen (pauses)";
    S.x.innerHTML = "<i>" + X_SVG + "</i>";
    S.x.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); F.exit(); });
    ["pointerdown", "touchstart", "mousedown"].forEach(function (n) { S.x.addEventListener(n, function (e) { e.stopPropagation(); }, { passive: true }); });
    S.cover = doc.createElement("div"); S.cover.className = "mib-cover"; S.cover.hidden = true;
    S.cover.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-mib-cover]"); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (b.getAttribute("data-mib-cover") === "window") { S.windowed = true; hideCover(true); }
      else F.enter();
    });
    S.hint = doc.createElement("div"); S.hint.className = "mib-rotate"; S.hint.hidden = true;
    S.hint.innerHTML = "<b aria-hidden='true'></b><h2 style='margin:6px 0 0;font-size:20px;color:#fff'>Turn your phone sideways</h2><p style='margin:0;max-width:30ch;font-size:14px'>This game is made for landscape.</p><button type='button' class='mib-win' data-mib-portrait>Play this way anyway</button>";
    S.hint.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-mib-portrait]")) { S.portraitOk = true; paintHint(); } });
    stage.appendChild(S.cover); stage.appendChild(S.hint); stage.appendChild(S.x);
  }

  /** Show the cover: "play" before the first start, "resume" after leaving full screen. */
  F.cover = function (mode) {
    if (!S.cover) return;
    S.coverMode = mode === "resume" ? "resume" : "play";
    var o = S.o, resume = S.coverMode === "resume";
    S.cover.innerHTML = (o.icon ? "<img src='" + esc(o.icon) + "' alt='' width='64' height='64'>" : "") +
      "<h2>" + (resume ? "Paused" : esc(o.title || "Ready?")) + "</h2>" +
      "<button type='button' class='mib-go' data-mib-cover='go'>" + PLAY_SVG + (resume ? "Resume" : "Play") + "</button>" +
      "<p>" + (resume ? "Resume goes back to full screen." : "The game opens in full screen. Tap the small ✕ in the corner to leave.") + "</p>" +
      (coarse() ? "" : "<button type='button' class='mib-win' data-mib-cover='window'>" + (resume ? "Resume in this window" : "Play in this window") + "</button>");
    S.cover.hidden = false;
    try { S.cover.querySelector(".mib-go").focus({ preventScroll: true }); } catch { /* ignore */ }
  };
  F.coverOpen = function () { return !!(S.cover && !S.cover.hidden); };
  function hideCover(resume) {
    if (!S.cover || S.cover.hidden) return;
    var was = S.coverMode; S.cover.hidden = true; S.coverMode = "";
    if (resume && was === "resume" && S.pausedByUs) { S.pausedByUs = false; try { if (S.o.resume) S.o.resume(); } catch { /* ignore */ } }
    if (was === "play" && S.o.start) try { S.o.start(); } catch { /* ignore */ }
  }

  function paintHint() {
    if (!S.hint) return;
    var show = S.on && S.o.landscape !== false && S.o.rotateHint !== false && !S.portraitOk && coarse() && F.inPortrait(root.innerWidth, root.innerHeight);
    S.hint.hidden = !show;
  }

  /* ---------- enter / leave ---------- */
  function pseudo() {
    S.how = "pseudo";
    S.stage.classList.add("mib-full--pseudo");
    if (!S.pushed) { try { root.history.pushState({ mibFull: 1 }, ""); S.pushed = true; } catch { /* ignore */ } }
    try { root.scrollTo(0, 0); } catch { /* ignore */ }
    lockLandscape(); refit();
  }
  /** Go full screen. Call it from inside a tap or click: browsers refuse full screen without one. */
  F.enter = function () {
    if (!S.stage) return;
    S.windowed = false;
    if (!S.on) {
      S.on = true;
      S.stage.classList.add("mib-full"); html.classList.add("mib-full-lock");
      var el = S.stage, req = el.requestFullscreen || el.webkitRequestFullscreen, started = false;
      var env = { hasApi: !!req, enabled: doc.fullscreenEnabled != null ? doc.fullscreenEnabled : doc.webkitFullscreenEnabled, forcePseudo: F.forcePseudo };
      if (!F.wantsPseudo(env)) {
        try {
          var p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen();
          S.how = "real"; started = true;
          if (p && p.then) p.then(lockLandscape, function () { if (S.on && S.how === "real") pseudo(); });
          else lockLandscape();
        } catch { started = false; }
      }
      if (!started) pseudo();
      refit();
    }
    hideCover(true);
    paintHint();
    try { var c = S.stage.querySelector("canvas"); if (c) c.focus({ preventScroll: true }); } catch { /* ignore */ }
  };
  function leave(reason) {
    if (!S.on) return;
    var how = S.how;
    S.on = false; S.how = "";
    S.stage.classList.remove("mib-full", "mib-full--pseudo"); html.classList.remove("mib-full-lock");
    if (how === "real" && fsEl()) { try { (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc).catch(function () {}); } catch { /* ignore */ } }
    if (S.pushed) { S.pushed = false; if (reason !== "back") { S.skipPop = true; try { root.history.back(); } catch { S.skipPop = false; } } }
    unlockOrientation(); paintHint(); refit();
    var paused = false; try { paused = !!(S.o.pause && S.o.pause(reason) !== false); } catch { /* ignore */ }
    S.pausedByUs = S.pausedByUs || paused;
    F.cover("resume");
  }
  /** Leave full screen (the X): the game pauses and the Resume cover shows. */
  F.exit = function () { leave("x"); };
  F.toggle = function () { if (S.on) leave("x"); else F.enter(); };

  /* ---------- wiring ---------- */
  F.attach = function (stage, opts) {
    if (!stage || S.stage) return F;
    S.stage = stage; S.o = opts || {}; F.attached = true;
    build();
    doc.addEventListener("fullscreenchange", onFsChange); doc.addEventListener("webkitfullscreenchange", onFsChange);
    root.addEventListener("popstate", function () { if (S.skipPop) { S.skipPop = false; return; } if (S.on && S.how === "pseudo") { S.pushed = false; leave("back"); } });
    doc.addEventListener("keydown", function (e) {
      if (S.on && S.how === "pseudo" && (e.key === "Escape" || e.code === "Escape")) { e.preventDefault(); e.stopImmediatePropagation(); leave("esc"); }
    }, true);
    doc.addEventListener("visibilitychange", function () { if (doc.hidden && S.on) leave("hidden"); });
    root.addEventListener("resize", paintHint); root.addEventListener("orientationchange", function () { setTimeout(paintHint, 250); });
    // Every Play / Start / Resume control in the game's own menus enters full screen on the same tap.
    stage.addEventListener("click", function (e) {
      if (S.on || S.windowed || !e.isTrusted) return;
      var b = e.target.closest && e.target.closest("button, [data-act], [role=button]");
      if (!b || b === S.x || (S.cover && S.cover.contains(b)) || (S.hint && S.hint.contains(b))) return;
      if (F.isStartAction({ act: b.getAttribute("data-act"), go: b.classList.contains("gm-btn--go"), text: b.textContent })) F.enter();
    }, true);
    // The title bar's Full screen button (desktop toggle) and its Pause button when it resumes.
    [].forEach.call(doc.querySelectorAll("[data-gm-full], [data-mib-full]"), function (b) { b.addEventListener("click", function (e) { e.preventDefault(); e.stopImmediatePropagation(); F.toggle(); }, true); });
    var pb = doc.querySelector("[data-gm-pause]");
    if (pb) pb.addEventListener("click", function () { if (!S.on && !S.windowed && pb.getAttribute("aria-pressed") === "true") { S.pausedByUs = false; F.enter(); } }, true);
    return F;
  };
  function onFsChange() {
    if (fsEl()) { refit(); return; }
    if (S.on && S.how === "real") leave("browser");
  }

  /* ---------- game view lock: a play page is a game, not a web page ----------
   * iPhone (above all as a home-screen app) treats double taps, pinches and long presses as page gestures:
   * it zooms, selects text and opens the copy / look-up menu. On play pages we turn all of that off:
   * no zoom (viewport + gesture events + double-tap guard), no selection or callout, no long-press menu.
   * Form fields (inputs, selects, text areas, editable areas) keep working normally. */
  F.isFormField = function (el) {
    if (!el || !el.closest) return false;
    return !!el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");
  };
  F.lockView = function () {
    if (F.viewLocked || !doc.documentElement) return;
    F.viewLocked = true;
    var vp = doc.querySelector('meta[name="viewport"]');
    if (!vp) { vp = doc.createElement("meta"); vp.name = "viewport"; doc.head.appendChild(vp); }
    vp.setAttribute("content", "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
    var st = doc.createElement("style");
    st.textContent =
      "html.mib-game{-webkit-text-size-adjust:100%;text-size-adjust:100%;touch-action:manipulation;overscroll-behavior:none}" +
      "html.mib-game body{-webkit-tap-highlight-color:transparent;overscroll-behavior:none}" +
      "html.mib-game [data-gm-stage],html.mib-game [data-gm-stage] *,html.mib-game .mib-full,html.mib-game .mib-full *,html.mib-game canvas,html.mib-game iframe,html.mib-game button" +
      "{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent}" +
      "html.mib-game [data-gm-stage] canvas,html.mib-game .mib-full canvas{touch-action:none}" +
      "html.mib-game input,html.mib-game textarea,html.mib-game select{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}";
    doc.head.appendChild(st);
    doc.documentElement.classList.add("mib-game");
    var stop = function (e) { if (e.cancelable) e.preventDefault(); };
    // Pinch zoom (Safari's own gesture events, and two-finger moves everywhere else).
    ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) { doc.addEventListener(t, stop, { passive: false }); });
    doc.addEventListener("touchmove", function (e) { if (e.touches && e.touches.length > 1) stop(e); }, { passive: false });
    // Double-tap zoom: a second tap within 320 ms of the last one is not allowed to become a zoom.
    var lastTap = 0;
    doc.addEventListener("touchend", function (e) {
      var now = Date.now();
      // Buttons and links are left alone (rapid taps must still count); touch-action stops their zoom.
      var t = e.target, ui = t && t.closest && t.closest("button, a, [role=button], [data-act]");
      if (now - lastTap < 320 && !ui && !F.isFormField(e.target)) stop(e);
      lastTap = now;
    }, { passive: false });
    doc.addEventListener("dblclick", function (e) { if (!F.isFormField(e.target)) stop(e); }, { passive: false });
    // Long press: no copy / look-up / save-image menu, no text selection.
    doc.addEventListener("contextmenu", function (e) { if (!F.isFormField(e.target)) stop(e); });
    doc.addEventListener("selectstart", function (e) { if (!F.isFormField(e.target)) stop(e); });
  };
  try { if (doc && doc.head) F.lockView(); else root.addEventListener("DOMContentLoaded", F.lockView); } catch { /* never block the game */ }

  root.MIBFull = F;
})(typeof window !== "undefined" ? window : globalThis);
