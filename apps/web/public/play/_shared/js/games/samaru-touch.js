/* Freshers School Life — touch module: one thumb stick on the left (move) and drag-to-look on the right half, an action cluster round the right
   thumb, a small tool row, a fill-the-screen mode, a rotate hint and gamepad support. Nothing is built at load time;
   samaru-core's setup calls Z.touch.init(api) and its update calls Z.touch.step(dt). Keyboard and mouse are untouched.
   Contract for other modules: Z.touch.active (bool), Z.touch.sticks.move ({ el, x, y, on }) and .look ({ el: null, x, y, on }: a drag region, the right half of the stage, not a visible stick), Z.touch.buttons[id]
   (DOM elements: jump, act, attack, ctx, phone, more, pause, full) and Z.touch.rect(name) → { x, y, w, h } in the
   960×540 logical space (null when hidden). Z.touch.set("move"|"look", x, y) drives a stick from code. */
(function () {
  "use strict";
  var Z = window.SamaruGame; if (!Z) return;
  var T = Z.touch = { active: false, forced: false, sens: 1, sticks: { move: { x: 0, y: 0, on: false, id: null, el: null }, look: { x: 0, y: 0, on: false, id: null, el: null } }, buttons: {}, fill: false, pad: { on: false } };
  var api, stage, layer, tray, hint, built = false, shown = null, ctxId = "", lookX = 0, lookY = 0, k = 1, labelT = 0, portraitOk = false, autoFill = true, synth = { move: null, look: null }, padDown = {}, sizeKey = "", flingX = 0, flingY = 0, fling = false, lookHold = 0;
  var SENS = [.6, 1, 1.5], SENS_NAME = ["Slow", "Normal", "Fast"], REACH = 52;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dbg() { return window.EEArcadeDebug; }
  function press(id) { var d = dbg(); if (d && d.press) d.press(id); }
  function release(id) { var d = dbg(); if (d && d.release) d.release(id); }
  function tap(id) { press(id); setTimeout(function () { release(id); }, 90); }
  function coarse() { try { return window.matchMedia && matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } }
  function playing() { return Z.mode === "play" && Z.P && api && !api.overlayOpen() && !(Z.mini && Z.mini.active && Z.mini.active()); } // a mini-game cabinet draws its own controls

  T.sensName = function () { var i = SENS.indexOf(T.sens); return SENS_NAME[i < 0 ? 1 : i]; };
  T.cycleSens = function () { var i = SENS.indexOf(T.sens); T.sens = SENS[(i + 1) % SENS.length]; if (api) api.store("fslg-look", T.sens); return T.sens; };
  T.set = function (which, x, y) { synth[which] = x == null ? null : { x: x, y: y }; };
  T.force = function (on) { T.forced = !!on; if (on) activate(); };
  T.rect = function (name) {
    var el = T.sticks[name] ? T.sticks[name].el : T.buttons[name]; if (!el || !stage || !T.active || shown !== "play" || !el.getBoundingClientRect) return null;
    var s = stage.getBoundingClientRect(), r = el.getBoundingClientRect(); if (!r.width || !s.width) return null;
    var sc = Math.min(s.width / 960, s.height / 540), ox = (s.width - 960 * sc) / 2, oy = (s.height - 540 * sc) / 2;
    return { x: (r.left - s.left - ox) / sc, y: (r.top - s.top - oy) / sc, w: r.width / sc, h: r.height / sc };
  };

  T.init = function (a) {
    api = a; var sv = api.store("fslg-look"); if (SENS.indexOf(sv) >= 0) T.sens = sv;
    if (typeof document === "undefined" || !document.body || !document.body.insertBefore) return; // headless test run: sticks are driven with T.set
    stage = document.querySelector("[data-gm-stage]"); if (!stage || !stage.classList) return;
    stage.classList.add("fs-stage");
    stage.addEventListener("pointerdown", down, true); window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
    // no page scroll, pinch zoom or long-press callout while playing; menus (the overlay) still scroll
    var block = function (e) { if (!T.active || (e.target.closest && e.target.closest("[data-gm-overlay], .gm-edit-bar"))) return; if (Z.mode === "play" && e.cancelable) e.preventDefault(); };
    stage.addEventListener("touchmove", block, { passive: false }); stage.addEventListener("contextmenu", function (e) { if (T.active) e.preventDefault(); });
    stage.addEventListener("gesturestart", function (e) { e.preventDefault(); });
    window.addEventListener("resize", layout); window.addEventListener("orientationchange", function () { setTimeout(layout, 250); });
    document.addEventListener("fullscreenchange", function () { setTimeout(layout, 60); });
    window.addEventListener("blur", dropAll);
    build(); layout(); if (coarse()) T.active = true;
    if (api.layout && api.layout.register) api.layout.register({ refresh: function () { layout(); },
      editing: function (on) { T.editMode = !!on; if (on) { layer.hidden = false; tray.hidden = true; hint.hidden = true; Object.keys(T.buttons).forEach(function (id) { var b = T.buttons[id]; if (b.getAttribute("data-lay") && b.hidden) { b._wasHidden = true; b.hidden = false; } }); if (!T.buttons.ctx.innerHTML) T.buttons.ctx.innerHTML = "WAVE"; }
        else { Object.keys(T.buttons).forEach(function (id) { var b = T.buttons[id]; if (b._wasHidden) { b.hidden = true; b._wasHidden = false; } }); shown = null; ctxId = ""; layout(); T.refresh(); } } });
    var last = 0, loop = function (t) { ui(Math.min(.1, (t - last) / 1000 || .016)); last = t; requestAnimationFrame(loop); }; if (window.requestAnimationFrame) requestAnimationFrame(loop);
  };

  function activate() { if (T.active) return; T.active = true; if (stage) layout(); }
  function mk(cls, html, parent) { var e = document.createElement("div"); e.className = cls; if (html) e.innerHTML = html; (parent || layer).appendChild(e); return e; }
  function button(id, cls, label, action, hold) {
    var b = document.createElement("button"); b.type = "button"; b.className = "fs-btn " + cls; b.setAttribute("data-fs", id); b.innerHTML = label; b._a = action; b._hold = hold; b._pid = null; return (T.buttons[id] = b);
  }
  function build() {
    if (built) return; built = true;
    layer = mk("fs-touch", "", stage); layer.hidden = true;
    var ms = T.sticks.move; ms.el = mk("fs-stick fs-stick--move", "<i></i><b></b><span>MOVE</span>"); ms.nub = ms.el.querySelector("b");
    [button("jump", "fs-btn--a", "JUMP", "jump", true), button("act", "fs-btn--b", "USE", "act", true), button("attack", "fs-btn--c", "HIT", "attack", true), button("kick", "fs-btn--s", "KICK", "kick", true), button("block", "fs-btn--s", "BLOCK", "block", true), button("ctx", "fs-btn--s", "WAVE", "", false),
      button("phone", "fs-btn--t", "PHONE", "phone"), button("pocket", "fs-btn--t fs-btn--pocket", "<span style='font-size:1.45em;line-height:1' aria-hidden='true'>🎒</span>", "#pocket"), button("more", "fs-btn--t", "MORE", "#more"), button("pause", "fs-btn--t", "II", "#pause"), button("full", "fs-btn--t", "FULL", "#full"), button("closemap", "fs-btn--t fs-btn--wide", "CLOSE MAP", "map")]
      .forEach(function (b) { layer.appendChild(b); });
    var LAB = { jump: "Jump / drift", act: "Use", attack: "Hit / horn", ctx: "Context (wave, radio…)", kick: "Kick", block: "Block", phone: "Phone", pocket: "Pockets (hold: quick slots)", more: "More", pause: "Pause", full: "Full screen" };
    ms.el.setAttribute("data-lay", "stick"); ms.el.setAttribute("data-lay-label", "Move stick");
    Object.keys(LAB).forEach(function (id) { var b = T.buttons[id]; if (b) { b.setAttribute("data-lay", id); b.setAttribute("data-lay-label", LAB[id]); } });
    tray = mk("fs-tray"); tray.hidden = true;
    [["emote1", "WAVE"], ["emote2", "DANCE"], ["emote3", "SIT"], ["torch", "TORCH"], ["throw", "THROW"], ["map", "MAP"]].forEach(function (m) { var b = button("m_" + m[0], "fs-btn--t", m[1], m[0]); b._tray = true; tray.appendChild(b); });
    hint = mk("fs-rotate", "<div><div class='fs-rotate__ico'></div><h3>Turn your phone sideways</h3><p>" + (window.Arcade && Arcade.esc ? Arcade.esc : String)((Z.resolveText || String)("{{GAME_NAME}}")) + " plays best in landscape: left thumb moves, drag on the right to look.</p><button type='button' class='gm-btn' data-fs-portrait>Play this way anyway</button></div>", stage); hint.hidden = true;
    hint.addEventListener("click", function (e) { if (e.target.closest("[data-fs-portrait]")) { portraitOk = true; hint.hidden = true; } });
  }

  /* ---------- layout: everything is placed in pixels from the stage size, so it follows rotation and fullscreen ---------- */
  function layout() {
    if (!built) return; var s = stage.getBoundingClientRect(), w = s.width, h = s.height; if (!w || !h) return;
    var set = api.settings || {}, sc = Math.min(w / 960, h / 540), ox = (w - 960 * sc) / 2, oy = (h - 540 * sc) / 2;
    k = clamp(Math.min(h / 390, w / 700), .8, 1.5) * clamp(set.touchScale || 1, .7, 1.5); REACH = 52 * k;
    layer.style.setProperty("--k", k.toFixed(3)); layer.style.opacity = clamp(set.touchAlpha || .85, .3, 1);
    T.cx = 88 * k; T.cy = 88 * k; home("move");
    place("jump", 78, 78, 68); place("act", 70, 172, 58); place("attack", 172, 62, 58); place("ctx", 168, 150, 46); place("kick", 258, 54, 48); place("block", 250, 128, 46);
    var ty = Math.round(oy + 104 * sc + 8), tx = Math.max(10, Math.round(ox + 12 * sc)), n = 0;
    ["phone", "pocket", "more", "pause", "full"].forEach(function (id) { var b = T.buttons[id], sz = Math.round(Math.max(44, 44 * k)); b.style.cssText = "left:calc(" + (tx + n * (sz + 8)) + "px + env(safe-area-inset-left, 0px));top:" + ty + "px;width:" + sz + "px;height:" + sz + "px"; n++; });
    tray.style.cssText = "left:calc(" + tx + "px + env(safe-area-inset-left, 0px));top:" + (ty + Math.round(Math.max(44, 44 * k)) + 8) + "px;--sz:" + Math.round(Math.max(44, 44 * k)) + "px";
    T.buttons.closemap.style.cssText = "left:50%;bottom:calc(14px + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);height:46px";
    sizeKey = w + "x" + h; applyLay();
  }
  // player-edited positions (Settings → Phone controls): centre in % of the stage, size multiplier, opacity, hidden
  function applyLay() {
    if (!api || !api.layout || !api.layout.get) return;
    [["stick", T.sticks.move.el]].concat(Object.keys(T.buttons).map(function (id) { return [id, T.buttons[id]]; })).forEach(function (p) {
      var el = p[1]; if (!el || !el.getAttribute || !el.getAttribute("data-lay")) return; var L = api.layout.get(p[0]);
      if (!L) { el.removeAttribute("data-lay-hidden"); if (p[0] === "stick") T.homeAt = null; return; }
      var w = p[0] === "stick" ? Math.round(REACH * 2) : parseFloat(el.style.width) || el.offsetWidth || 60, h = p[0] === "stick" ? w : parseFloat(el.style.height) || el.offsetHeight || 60;
      el.style.left = L.x + "%"; el.style.top = L.y + "%"; el.style.right = "auto"; el.style.bottom = "auto"; el.style.transform = "translate(-50%,-50%)";
      el.style.width = Math.round(w * (L.s || 1)) + "px"; el.style.height = Math.round(h * (L.s || 1)) + "px"; if (L.a != null) el.style.opacity = L.a;
      if (L.h) el.setAttribute("data-lay-hidden", ""); else el.removeAttribute("data-lay-hidden");
      if (p[0] === "stick") { var r = stage.getBoundingClientRect(); T.homeAt = { x: L.x / 100 * r.width, y: L.y / 100 * r.height, s: L.s || 1, a: L.a, h: !!L.h }; }
    });
  }
  function place(id, fromRight, fromBottom, size) { var b = T.buttons[id], sz = Math.round(Math.max(44, size * k)); b.style.cssText = "right:calc(" + Math.round(fromRight * k - sz / 2) + "px + env(safe-area-inset-right, 0px));bottom:calc(" + Math.round(fromBottom * k - sz / 2) + "px + env(safe-area-inset-bottom, 0px));width:" + sz + "px;height:" + sz + "px"; }
  function home(n) { var s = T.sticks[n], el = s.el; if (!el) return; var d = Math.round(REACH * 2); el.classList.remove("is-on"); el.style.cssText = "width:" + d + "px;height:" + d + "px;bottom:calc(" + Math.round(T.cy - REACH) + "px + env(safe-area-inset-bottom, 0px));" + (n === "move" ? "left" : "right") + ":calc(" + Math.round(T.cx - REACH) + "px + env(safe-area-inset-" + (n === "move" ? "left" : "right") + ", 0px))"; if (n === "move" && T.homeAt) { var hd = Math.round(d * (T.homeAt.s || 1)); el.style.cssText = "width:" + hd + "px;height:" + hd + "px;left:" + Math.round(T.homeAt.x - hd / 2) + "px;top:" + Math.round(T.homeAt.y - hd / 2) + "px;opacity:" + (T.homeAt.a == null ? "" : T.homeAt.a); if (T.homeAt.h) el.setAttribute("data-lay-hidden", ""); } nub(s, 0, 0); }
  function nub(s, x, y) { if (s.nub) s.nub.style.transform = "translate(" + (x * REACH * .62).toFixed(1) + "px," + (y * REACH * .62).toFixed(1) + "px)"; }

  /* ---------- pointers: each stick and each button keeps its own pointer id ---------- */
  function logical(e) { var r = stage.getBoundingClientRect(), sc = Math.min(r.width / 960, r.height / 540); return { x: (e.clientX - r.left - (r.width - 960 * sc) / 2) / sc, y: (e.clientY - r.top - (r.height - 540 * sc) / 2) / sc }; }
  function onMinimap(e) { var q = logical(e), r3 = Z.r3 && Z.r3.ready; return Math.hypot(q.x - 868, q.y - (r3 ? 96 : 84)) < (r3 ? 82 : 70); }
  function down(e) {
    var mouse = e.pointerType === "mouse" && !T.forced;
    var b = e.target.closest && e.target.closest(".fs-btn");
    if (b && layer && layer.contains(b)) { e.preventDefault(); e.stopPropagation(); btnDown(b, e); return; }
    if (mouse && (e.button !== 0 || (Z.r3 && Z.r3.locked))) return;
    if (!playing() || Z.bigOpen() || (e.target.closest && e.target.closest("[data-gm-overlay], .gm-touch.is-editing, .gm-edit-bar, .fs-rotate, .fp-phone, .fi-pocket, .fi-hot, .fp-dock, .fi-tut"))) return; /* the handset and pockets take their own taps */
    if (onMinimap(e)) { e.preventDefault(); e.stopPropagation(); tap("map"); return; } // tap or click the minimap: the full map opens
    if (mouse) return;
    if (!T.active) activate();
    if (!tray.hidden) tray.hidden = true;
    var r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, n = px < r.width * .5 ? "move" : "look", s = T.sticks[n];
    if (s.id !== null) return;
    e.preventDefault(); e.stopPropagation();
    s.id = e.pointerId; s.on = true; s.x = s.y = 0;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    if (n === "look") { s.lx = e.clientX; s.ly = e.clientY; s.lt = performance.now(); flingX = flingY = 0; return; } // right half: the finger turns the camera directly
    // the ring floats to the thumb, kept on screen
    s.ox = clamp(px, REACH + 6, r.width - REACH - 6); s.oy = clamp(py, REACH + 6, r.height - REACH - 6); s.cx = s.ox + r.left; s.cy = s.oy + r.top;
    var d = Math.round(REACH * 2); s.el.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + Math.round(s.ox - REACH) + "px;top:" + Math.round(s.oy - REACH) + "px"; s.el.classList.add("is-on");
  }
  function turn(dyaw, dpitch) { var r3 = Z.r3; if (!r3 || Z.mode !== "play") return; if (Z.invertY) dpitch = -dpitch; r3.yaw += dyaw; r3.pitch = clamp((r3.pitch == null ? .3 : r3.pitch) + dpitch, .06, 1.2); r3.manual = 2.5; lookHold = 1.2; }
  function move(e) {
    var s = T.sticks.move.id === e.pointerId ? T.sticks.move : T.sticks.look.id === e.pointerId ? T.sticks.look : null; if (!s) return;
    if (e.cancelable) e.preventDefault();
    if (s === T.sticks.look) { // 1:1 with the finger; remember the speed so a flick carries on for a moment after release
      var mx = e.clientX - s.lx, my = e.clientY - s.ly, now = performance.now(), el = Math.max(.004, (now - s.lt) / 1000), dyw = mx * .0062 * T.sens, dpt = my * .0042 * T.sens;
      s.lx = e.clientX; s.ly = e.clientY; s.lt = now; turn(dyw, dpt);
      var f = Math.min(1, el * 30); flingX += (dyw / el - flingX) * f; flingY += (dpt / el - flingY) * f; s.x = clamp(mx / 20, -1, 1); s.y = clamp(my / 20, -1, 1); return; }
    var dx = (e.clientX - s.cx) / REACH, dy = (e.clientY - s.cy) / REACH, l = Math.hypot(dx, dy);
    if (l > 1) { // the ring trails a thumb that has gone past its edge, so reversing direction is instant
      var over = (l - 1) * REACH; s.cx += dx / l * over; s.cy += dy / l * over; s.ox += dx / l * over; s.oy += dy / l * over; s.el.style.left = Math.round(s.ox - REACH) + "px"; s.el.style.top = Math.round(s.oy - REACH) + "px"; dx /= l; dy /= l; }
    s.x = dx; s.y = dy; nub(s, dx, dy);
  }
  function up(e) {
    ["move", "look"].forEach(function (n) { var s = T.sticks[n]; if (s.id === e.pointerId) { s.id = null; s.on = false; s.x = s.y = 0; if (n === "look") { if (performance.now() - s.lt > 90) flingX = flingY = 0; fling = Math.hypot(flingX, flingY) > .5; } else if (built) home(n); } });
    for (var id in T.buttons) { var b = T.buttons[id]; if (b._pid === e.pointerId) btnUp(b); }
  }
  function dropAll() { ["move", "look"].forEach(function (n) { var s = T.sticks[n]; s.id = null; s.on = false; s.x = s.y = 0; if (built) home(n); }); fling = false; for (var id in T.buttons) if (T.buttons[id]._pid !== null) btnUp(T.buttons[id]); }
  function btnDown(b, e) {
    if (b._pid !== null) return; b._pid = e.pointerId; b.classList.add("is-down"); try { b.setPointerCapture(e.pointerId); } catch (_) {}
    if (api.buzz) api.buzz(8);
    var a = b._a;
    if (a === "#more") { tray.hidden = !tray.hidden; return; }
    if (a === "#pocket") { if (Z.inv && Z.inv.btnDown) Z.inv.btnDown(b); return; } /* tap: pockets; hold: quick slots (samaru-inv.js) */
    if (a === "#pause") { var p = document.querySelector("[data-gm-pause]"); if (p && p.click) p.click(); return; }
    if (a === "#full") { T.toggleFill(); return; }
    if (!a) return;
    if (b._tray) tray.hidden = true;
    if (b._hold) { b._held = a; press(a); } else tap(a);
  }
  function btnUp(b) { if (b._a === "#pocket" && b._pid !== null && Z.inv && Z.inv.btnUp) Z.inv.btnUp(b); b._pid = null; b.classList.remove("is-down"); if (b._held) { release(b._held); b._held = null; } }

  /* ---------- fill the screen: real fullscreen where the browser has it, a fixed full-viewport stage where it has not (iPhone) ---------- */
  T.toggleFill = function (want) {
    var MF = window.MIBFull; // MIB-Hub: the play page's shared full screen (mib-full.js) owns entering and leaving
    if (MF && MF.toggle) { if (want === undefined || !!want !== MF.active()) MF.toggle(); autoFill = false; setTimeout(refit, 80); return; }
    var on = want === undefined ? !(T.fill || document.fullscreenElement) : want; autoFill = false;
    if (on) {
      var req = stage.requestFullscreen || stage.webkitRequestFullscreen, done = false;
      if (req) { try { var pr = req.call(stage); done = true; if (pr && pr.catch) pr.catch(function () { cssFill(true); }); if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {}); } catch (e) { done = false; } }
      if (!done) cssFill(true);
    } else { cssFill(false); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} }
    setTimeout(refit, 80); setTimeout(refit, 400);
  };
  function cssFill(on) { T.fill = on; stage.classList.toggle("fs-fill", on); document.documentElement.classList.toggle("fs-noscroll", on); refit(); }
  function refit() { try { window.dispatchEvent(new Event("resize")); } catch (e) {} layout(); }

  /* ---------- per frame: read sticks and gamepad, turn the camera, keep labels and visibility right ---------- */
  T.step = function (dt) {
    var st = Z.stick, mv = synth.move || T.sticks.move, lk = synth.look || { x: 0, y: 0 }, mx = mv.x || 0, my = mv.y || 0, lx = lk.x || 0, ly = lk.y || 0, mOn = !!(synth.move || T.sticks.move.on), used = mOn || !!synth.look;
    var gp = gamepad(); if (gp) { if (Math.hypot(gp.mx, gp.my) > Math.hypot(mx, my)) { mx = gp.mx; my = gp.my; mOn = mOn || Math.hypot(mx, my) > 0; } if (Math.hypot(gp.lx, gp.ly) > Math.hypot(lx, ly)) { lx = gp.lx; ly = gp.ly; } used = used || gp.used; }
    // move: a small dead zone, then a smooth ramp; pushing right out to the rim sprints
    var m = Math.hypot(mx, my), was = T._drove;
    if (mOn) { var out = m < .14 ? 0 : Math.min(1, (m - .14) / .7), f = m > 0 ? out / m : 0; st.on = true; st.x = mx * f; st.y = my * f; Z.runLock = m > .86 || !!(gp && gp.run); T._drove = true; }
    else if (was) { st.on = false; st.x = st.y = 0; Z.runLock = false; T._drove = false; }
    // look: rate control with a dead zone, a soft response curve and a little smoothing so the view never jerks
    var l = Math.hypot(lx, ly), tx = 0, ty = 0; if (l > .12) { var c = Math.min(1, (l - .12) / .88); c = c * (.35 + .65 * c) / l; tx = lx * c; ty = ly * c; }
    var e = 1 - Math.exp(-dt * 14); lookX += (tx - lookX) * e; lookY += (ty - lookY) * e;
    var r3 = Z.r3;
    if (Math.abs(lookX) > .002 || Math.abs(lookY) > .002) turn(lookX * 2.7 * T.sens * dt, lookY * 1.5 * T.sens * dt); // gamepad right stick (and scripted look)
    if (fling && !T.sticks.look.on) { turn(flingX * dt, flingY * dt); var dec = Math.exp(-dt * 7); flingX *= dec; flingY *= dec; if (Math.hypot(flingX, flingY) < .08) fling = false; } // a little glide after a flick
    if (lookHold > 0) lookHold -= dt;
    if (r3) r3.noFollow = T.sticks.look.on || lookHold > 0; // while you are steering the view (and just after) the camera does not swing by itself
    if (r3 && T.active && r3.dpr) { var cap = r3.quality === "high" ? 1.5 : 1; if (r3.dpr > cap) r3.dpr = cap; } // phones: sharp enough, far fewer pixels to fill
  };
  function ui(dt) { // visibility, labels, rotate hint and auto-fill: runs every display frame, menus open or not
    if (!built) return;
    if (T.editMode) { layer.hidden = false; return; } // the layout editor is open: show every control, change nothing
    var mode = Z.mode === "play" && Z.bigOpen() && !api.overlayOpen() ? "map" : T.active && playing() ? "play" : null;
    if (mode !== shown) { shown = mode; layer.hidden = !mode; layer.classList.toggle("fs-touch--map", mode === "map"); if (!mode) { dropAll(); tray.hidden = true; } labelT = 0; }
    var s = stage.getBoundingClientRect(); if (s.width + "x" + s.height !== sizeKey) layout();
    var port = window.innerHeight > window.innerWidth * 1.05, phone = coarse() || T.forced;
    hint.hidden = !(phone && port && Z.mode === "play" && !portraitOk && !api.overlayOpen());
    if (autoFill && phone && !port && Z.mode === "play" && !T.fill && !document.fullscreenElement && !(window.MIBFull && window.MIBFull.attached) && window.innerHeight < 560 && s.height < window.innerHeight - 24) { cssFill(true); autoFill = true; }
    if (T.fill && autoFill && port) { cssFill(false); autoFill = true; }
    if (mode === "play" && (labelT -= dt) <= 0) { labelT = .2; labels(); }
  };
  T.refresh = function () { labelT = 0; ui(.016); };
  function txt(b, s) { if (b._t !== s) { b._t = s; b.innerHTML = s; } }
  function labels() {
    var me = Z.me, P = Z.P, B = T.buttons, veh = !!me.veh, pr = Z.prompt ? Z.prompt() : "", a = "USE";
    if (veh) a = pr ? "EXIT" : "…"; else if (/^Ride/.test(pr)) a = "RIDE"; else if (/^Talk/.test(pr)) a = "TALK"; else if (/^Start/.test(pr)) a = "DATE"; else if (/level \d+\)$/.test(pr)) a = "LOCKED"; else if (/^Sit/.test(pr)) a = "SIT"; else if (/^(Go outside|Stand up)/.test(pr)) a = "EXIT"; else if (/^(Order|Buy|Snack bar|Use the ATM)/.test(pr)) a = "ORDER"; else if (/^Raise/.test(pr)) a = "HAND"; else if (/^Listening/.test(pr)) a = "…"; else if (/^Enter /.test(pr)) a = "ENTER"; else if (Z.inside && pr) a = "USE"; else if (pr) a = "ENTER";
    txt(B.act, a); B.act.classList.toggle("is-ready", !!pr);
    // riding: hop and handbrake are never the same button. Machines that hop get HOP plus a separate DRIFT; the rest get DRIFT.
    var hops = veh && (me.veh.type === "bike" || me.veh.type === "skate"), flies = veh && me.veh.type === "plane";
    B.jump._a = veh && !hops ? "drift" : "jump"; txt(B.jump, !veh ? "JUMP" : hops ? "HOP" : flies ? "BRAKE" : "DRIFT");
    B.attack._a = veh ? "horn" : "attack"; txt(B.attack, veh ? "HORN" : "HIT"); if (B.kick) { B.kick.hidden = veh && !hops; B.kick._a = hops ? "drift" : "kick"; txt(B.kick, hops ? "DRIFT" : "KICK"); } if (B.block) B.block.hidden = !!veh;
    var c = veh ? (me.veh.type === "skate" ? "" : "radio") : P.inv && P.inv.slipper ? "throw" : P.inv && P.inv.torch ? "torch" : "emote1";
    if (c !== ctxId) { ctxId = c; B.ctx._a = c; B.ctx.hidden = !c; txt(B.ctx, { radio: "RADIO", "throw": "THROW", torch: "TORCH", emote1: "WAVE" }[c] || ""); }
    txt(B.full, T.fill || document.fullscreenElement || (window.MIBFull && window.MIBFull.active()) ? "EXIT" : "FULL");
  }

  /* ---------- gamepad: left stick moves, right stick looks ---------- */
  var MAP = { 0: "jump", 1: "attack", 2: "act", 3: "phone", 4: "radio", 5: "horn", 8: "map", 12: "emote1", 13: "emote3", 14: "torch", 15: "emote2" };
  function gamepad() {
    var nav = typeof navigator !== "undefined" ? navigator : null; if (!nav || !nav.getGamepads) return null;
    var list; try { list = nav.getGamepads(); } catch (e) { return null; }
    for (var i = 0; list && i < list.length; i++) {
      var g = list[i]; if (!g || !g.connected || g.axes.length < 2) continue;
      var dz = function (v) { return Math.abs(v) < .16 ? 0 : v; }, o = { mx: dz(g.axes[0]), my: dz(g.axes[1]), lx: dz(g.axes[2] || 0), ly: dz(g.axes[3] || 0), run: false, used: false };
      o.run = !!(g.buttons[7] && g.buttons[7].pressed) || !!(g.buttons[10] && g.buttons[10].pressed);
      for (var b in MAP) { var on = !!(g.buttons[b] && g.buttons[b].pressed); if (on !== !!padDown[b]) { padDown[b] = on; if (on) press(MAP[b]); else release(MAP[b]); o.used = true; } }
      if (g.buttons[9] && g.buttons[9].pressed !== !!padDown[9]) { padDown[9] = g.buttons[9].pressed; if (padDown[9]) { var p = document.querySelector("[data-gm-pause]"); if (p && p.click) p.click(); } }
      o.used = o.used || !!(o.mx || o.my || o.lx || o.ly); T.pad.on = T.pad.on || o.used; return o;
    }
    return null;
  }
})();
