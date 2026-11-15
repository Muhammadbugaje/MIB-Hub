/* Campus story systems, shared kit. The phase 2 story modules (switching, friendship and romance, prosperity, cooking,
   the workshop, the Maker, weather, world life) all need the same few things, so they live here once:
     Z.kit.block(P, key, init)   a saved sub-block of the story save (P.story[key])
     Z.kit.spot({...})           a place in the world you can press E at (prompt + action), no core edits
     Z.kit.prop({...})           a simple 3D thing made of boxes (drawn by the generic "props" pass in the renderer)
     Z.kit.on(type, fn)          listen to game events (talk, eat, gift, buy, sleep, photo…)
     Z.kit.tick / begin / daily  per-frame, per-load and per-new-day callbacks
     Z.kit.panel(...)            a menu in the game's own overlay (works headless, so tests can press its buttons)
     Z.kit.chip(fn)              a small HUD chip (text on the HUD canvas, never smaller than 15 px)
     Z.kit.rng(seed)             seeded random numbers, so tests repeat
   Nothing here touches window or document at load time. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData;
  if (!Z || !S || !D) return;
  var K = Z.kit = { spots: [], chips: [], overlays: [], ticks: [], begins: [], dailies: [], listeners: {}, day: null, errs: [] };
  Z.props = Z.props || [];

  function safe(fn, a, b, c) { try { return fn(a, b, c); } catch (e) { if (K.errs.length < 20) K.errs.push(String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")); if (K.strict) throw e; return undefined; } }
  K.safe = safe;
  K.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  K.naira = function (n) { return "₦" + Math.round(n).toLocaleString(); };
  K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  K.rng = function (seed) { var s = (seed >>> 0) || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  K.hash = function (a, b) { return S.hash(a, b); };
  K.pickBy = function (list, a, b) { return list[Math.floor(S.hash(a, b) * list.length) % list.length]; };
  K.toast = function (h) { K.lastToast = h; try { if (Z.toast) Z.toast(h); } catch (e) {} };
  K.sfx = function (n) { try { Z.api.sound.sfx(n); } catch (e) {} };
  K.say = function (who, text) { try { if (Z.story && Z.story.say) Z.story.say([[who, text]]); else if (Z.say) Z.say(Z.npc(who) || who, text); } catch (e) {} K.lastSay = [who, text]; };
  K.npcDef = function (id) { for (var i = 0; i < D.NPCS.length; i++) if (D.NPCS[i].id === id) return D.NPCS[i]; return null; };
  K.name = function (id) { var d = K.npcDef(id); return d ? d.name : String(id || ""); };
  K.sex = function (P) { try { return Z.story.sex(P || Z.P); } catch (e) { return "m"; } };
  K.busy = function () { // true when a menu, film, race or anything else has the player's attention
    try { if ((Z.intro && Z.intro.on) || Z.mode !== "play") return true; if (Z.api.overlayOpen && Z.api.overlayOpen()) return true; if (Z.phone && Z.phone.isOpen && Z.phone.isOpen()) return true; if (Z.inv && Z.inv.isOpen && Z.inv.isOpen()) return true; } catch (e) {} return false;
  };

  /* ---------- saved state: one sub-block per system inside the story save ---------- */
  K.block = function (P, key, init) {
    P = P || Z.P; if (!P) return init || {}; var s = Z.story && Z.story.state ? Z.story.state(P) : (P.story = P.story || {});
    var b = s[key]; if (!b || typeof b !== "object") b = s[key] = {}; if (init) for (var k in init) if (b[k] === undefined) b[k] = typeof init[k] === "object" && init[k] !== null ? JSON.parse(JSON.stringify(init[k])) : init[k];
    return b;
  };

  /* ---------- events ---------- */
  K.on = function (type, fn) { (K.listeners[type] = K.listeners[type] || []).push(fn); };
  K.emit = function (ev) { try { Z.emit(ev); } catch (e) {} };
  K.tick = function (fn) { K.ticks.push(fn); };
  K.begin = function (fn) { K.begins.push(fn); };
  K.daily = function (fn) { K.dailies.push(fn); };

  /* ---------- spots: press E here ---------- */
  // { id, x, y, r (2.6), label: "text" | fn → text ("" hides it), act: fn, when: fn → bool, place: placeId (follows the place marker) }
  K.spot = function (def) { for (var i = 0; i < K.spots.length; i++) if (K.spots[i].id === def.id) { K.spots[i] = def; return def; } K.spots.push(def); return def; };
  K.unspot = function (id) { K.spots = K.spots.filter(function (s) { return s.id !== id; }); };
  K.spotAt = function () {
    var me = Z.me; if (!me || me.veh || Z.inside) return null; var best = null, bd = 1e9;
    for (var i = 0; i < K.spots.length; i++) { var s = K.spots[i], d = Math.hypot(s.x - me.x, s.y - me.y); if (d > (s.r || 2.6) || d >= bd) continue; if (s.when && !safe(s.when, s)) continue; var lb = typeof s.label === "function" ? safe(s.label, s) : s.label; if (!lb) continue; bd = d; best = s; best._label = lb; }
    return best;
  };
  K.useSpot = function (id) { var s = null; K.spots.forEach(function (q) { if (q.id === id) s = q; }); if (!s || (s.when && !s.when(s))) return false; safe(s.act, s); return true; };
  function nearPerson() { var me = Z.me; for (var i = 0; i < (Z.npcs || []).length; i++) { var n = Z.npcs[i]; if (!n.hidden && Math.hypot(n.x - me.x, n.y - me.y) < 2.2) return n; } return null; }

  /* ---------- props: simple 3D things ---------- */
  // { id, x, y, a, z, parts: [[w, h, d, colour, px, py, pz], …] }. Replace the object (K.prop with the same id) to rebuild it.
  K.prop = function (def) { for (var i = 0; i < Z.props.length; i++) if (Z.props[i].id === def.id) { Z.props[i] = def; return def; } Z.props.push(def); return def; };
  K.unprop = function (id) { for (var i = Z.props.length - 1; i >= 0; i--) if (Z.props[i].id === id || (id instanceof RegExp && id.test(Z.props[i].id))) Z.props.splice(i, 1); };
  K.findProp = function (id) { for (var i = 0; i < Z.props.length; i++) if (Z.props[i].id === id) return Z.props[i]; return null; };
  // a free spot beside a place marker, on a fixed bearing, pushed out of walls, roads and water
  K.beside = function (placeId, ang, r) {
    var pl = Z.place(placeId); if (!pl) return null; var W = Z.W, best = null;
    for (var t = 0; t < 10; t++) { var a = ang + t * .63, rr = r + (t > 4 ? 3 : 0), q = S.push(W, pl.mx + Math.cos(a) * rr, pl.my + Math.sin(a) * rr, 1.2); if (S.insideBuilding(W, q.x, q.y) || S.inWater(W, q.x, q.y)) continue; var nr = S.nearRoad(W, q.x, q.y, 6); if (nr && Math.hypot(nr.x - q.x, nr.y - q.y) < nr.r.w / 2 + .8) { best = best || q; continue; } return q; }
    return best || { x: pl.mx + Math.cos(ang) * r, y: pl.my + Math.sin(ang) * r };
  };

  /* ---------- menus ---------- */
  // buttons: [{ id, label, sub, go, off }]. cb(id). Uses the arcade overlay, so the headless tests can press buttons.
  K.panel = function (title, body, buttons, cb, opt) {
    opt = opt || {}; var e = K.esc;
    var html = "<h2 style='margin:0 0 6px'>" + title + "</h2>" + (body ? "<div class='gm-small' style='max-width:560px;margin:0 auto 10px;line-height:1.45;font-size:15px'>" + body + "</div>" : "") +
      "<div class='gm-actions' style='display:flex;flex-direction:column;align-items:stretch;width:min(520px,100%);max-width:520px;margin:0 auto;gap:8px;grid-template-columns:none;max-height:52vh;overflow:auto'>" +
      buttons.map(function (b, i) { return "<button class='gm-btn" + (b.go || (!i && opt.first !== false) ? " gm-btn--go" : "") + "' style='min-height:48px;height:auto;aspect-ratio:auto;padding:9px 14px;font-size:16px;width:100%;flex:none;text-align:left" + (b.off ? ";opacity:.5" : "") + "' data-act='" + e(b.id) + "'" + (b.off ? " disabled" : "") + ">" + b.label + (b.sub ? "<br><small style='font-weight:500;opacity:.85;font-size:13px'>" + b.sub + "</small>" : "") + "</button>"; }).join("") + "</div>";
    K.open = { title: title, buttons: buttons, body: body };
    Z.api.show(html, function (a) { var b = null; buttons.forEach(function (q) { if (q.id === a) b = q; }); if (b && b.off) return; K.open = null; Z.api.hide(); safe(cb, a, b); });
  };
  K.close = function () { K.open = null; try { Z.api.hide(); } catch (e) {} };
  K.card = function (title, body, ok, cb) { K.panel(title, body, [{ id: "ok", label: ok || "OK", go: true }], function () { if (cb) cb(); }); };

  /* ---------- HUD chips and overlays ---------- */
  K.chip = function (fn) { K.chips.push(fn); };          // fn() → null | { text, col, bg, sub, tap: fn } (a chip with tap is a 50 px button)
  K.overlay = function (fn) { K.overlays.push(fn); };     // fn(ctx, t) draws on the 960×540 HUD canvas (weather, photo frame…)
  K.chipList = function () { var out = []; if (!Z.P || Z.mode !== "play") return out; K.chips.forEach(function (fn) { var c = safe(fn); if (c && c.text) out.push(c); }); return out; };
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r); x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r); x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath(); }
  K.rr = rr;
  K.CHIP_AT = { x: 14, y: 196 }; // left edge, under the needs bars and above the touch stick
  function drawHud() {
    var x = Z.api && Z.api.x; if (!x || !x.fillText || !Z.P || Z.mode !== "play" || (Z.intro && Z.intro.on)) return; var t = Z.api.t || 0;
    K.overlays.forEach(function (fn) { x.save(); safe(fn, x, t); x.restore(); });
    if (Z.hideHud || K.hideChips) return; var list = K.chipList(), y = K.CHIP_AT.y;
    x.save(); x.textBaseline = "middle"; x.textAlign = "left";
    K.hits = [];
    list.forEach(function (c) { var h = c.tap ? 50 : 26; x.font = "700 15px system-ui, sans-serif"; var w = Math.min(300, Math.max(x.measureText(c.text).width, c.sub ? x.measureText(c.sub).width * .9 : 0) + 22 + (c.tap ? 30 : 0)); x.fillStyle = c.bg || "rgba(8,14,26,.74)"; rr(x, K.CHIP_AT.x, y, w, h, 13); x.fill(); x.lineWidth = c.tap ? 2 : 1.5; x.strokeStyle = c.col || "rgba(226,232,240,.5)"; x.stroke(); x.fillStyle = c.col || "#e2e8f0";
      if (c.tap) { x.fillText(c.text, K.CHIP_AT.x + 11, y + (c.sub ? 17 : 25), 250); if (c.sub) { x.font = "600 13px system-ui, sans-serif"; x.fillStyle = "rgba(226,232,240,.85)"; x.fillText(c.sub, K.CHIP_AT.x + 11, y + 36, 250); } x.font = "800 18px system-ui, sans-serif"; x.fillStyle = c.col || "#e2e8f0"; x.fillText("⇄", K.CHIP_AT.x + w - 28, y + 26); K.hits.push({ x: K.CHIP_AT.x, y: y, w: w, h: h, tap: c.tap }); }
      else x.fillText(c.text, K.CHIP_AT.x + 11, y + 13.5, 280);
      y += h + 5; });
    x.restore();
  }

  /* ---------- hooks (wrap, never edit: the same pattern the other modules use) ---------- */
  var oUpdate = Z.update, oBegin = Z.begin, oEmit = Z.emit, oPrompt = Z.prompt, oDraw = Z.draw;
  if (oUpdate) Z.update = function (dt) {
    var r = oUpdate.apply(Z, arguments); var P = Z.P; if (!P || Z.mode !== "play") return r;
    hookAct();
    if (K.day !== P.day) { var first = K.day == null; K.day = P.day; if (!first) K.dailies.forEach(function (fn) { safe(fn, P); }); }
    if (!(Z.intro && Z.intro.on)) for (var i = 0; i < K.ticks.length; i++) safe(K.ticks[i], dt, P);
    return r;
  };
  if (oBegin) Z.begin = function (p, fresh) { var r = oBegin.apply(Z, arguments); K.day = null; K.open = null; K.begins.forEach(function (fn) { safe(fn, Z.P, !!fresh); }); return r; };
  if (oEmit) Z.emit = function (ev) { var r = oEmit.apply(Z, arguments); if (ev && ev.t && Z.P) { var ls = K.listeners[ev.t]; if (ls) for (var i = 0; i < ls.length; i++) safe(ls[i], ev, Z.P); ls = K.listeners["*"]; if (ls) for (var j = 0; j < ls.length; j++) safe(ls[j], ev, Z.P); } return r; };
  if (oPrompt) Z.prompt = function () { var p = oPrompt.apply(Z, arguments); if (p && /^(Talk to|Get off|Ride |Start the date|Enter |Stop)/.test(p)) return p; var s = K.spotAt(); return s ? s._label : p; };
  var oClick = Z.click; Z.click = function (px, py) { if (Z.P && Z.mode === "play" && !K.busy()) for (var i = 0; i < (K.hits || []).length; i++) { var h = K.hits[i]; if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) { safe(h.tap); return; } } return oClick ? oClick.apply(Z, arguments) : undefined; };
  if (oDraw) Z.draw = function () { var r = oDraw.apply(Z, arguments); safe(drawHud); return r; };
  // E: the interiors module is asked first by the core, so a spot answers through it (people still win when you stand beside one)
  function hookAct() {
    var I = Z.interior; if (!I || I._kit || !I.act) return; var oa = I.act; I._kit = 1;
    I.act = function () { if (oa.apply(I, arguments)) return true; if (Z.inside || !Z.me || Z.me.veh || Z.me.fall) return false; var s = K.spotAt(); if (!s || nearPerson()) return false; safe(s.act, s); return true; };
  }
  K.hookAct = hookAct;
})();
