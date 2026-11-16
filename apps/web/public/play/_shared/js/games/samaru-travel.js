/* Freshers School Life — campus shuttle and keke fast travel.
   Shuttle stops are places with role "stop". Press the act key at one to pick another stop and pay the fare; a keke
   in traffic can be flagged down from the roadside and takes you to any stop or to your hostel. Two ways to go:
     skip  – the screen fades, the clock moves on, and you ride only the last stretch in to the stop;
     ride  – you sit in the shuttle while it really drives the whole route (press act to get off early).
   Walking, cycling or driving there yourself always works too. Nothing here runs at load time except attaching
   Z.travel and wrapping three hooks (place menu, prompt, update), so it also runs headless. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim;
  if (!Z || !S) return;
  var T = Z.travel = { active: null }, TAU = Math.PI * 2;
  // fares are rules, so the Game Settings page can change them (S.setRules merges numbers it already knows)
  var RULES = S.RULES || (S.RULES = {});
  if (RULES.fareBase == null) RULES.fareBase = 100;     // naira for the shortest hop
  if (RULES.farePerKm == null) RULES.farePerKm = 40;    // added per kilometre of road
  if (RULES.fareMax == null) RULES.fareMax = 200;       // the most a shuttle ever charges (the Phase 2 run)
  if (RULES.kekeFactor == null) RULES.kekeFactor = 1.5; // a keke costs this many times the shuttle fare

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function stopName(p) { return p.name.replace(/^Shuttle stop: /, ""); }
  T.stops = function () { return Z.placeList.filter(function (p) { return p.role === "stop"; }); };

  // the road line between two points as [[x, y], ...] with its length in metres
  T.path = function (x1, y1, x2, y2) {
    var flat = S.route(Z.W, x1, y1, x2, y2, true) || [x1, y1, x2, y2], pts = [], len = 0, i;
    for (i = 0; i + 1 < flat.length; i += 2) { var q = [flat[i], flat[i + 1]], l = pts[pts.length - 1]; if (l && Math.hypot(q[0] - l[0], q[1] - l[1]) < .5) continue; if (l) len += Math.hypot(q[0] - l[0], q[1] - l[1]); pts.push(q); }
    if (pts.length < 2) { pts = [[x1, y1], [x2, y2]]; len = Math.hypot(x2 - x1, y2 - y1); }
    return { pts: pts, len: len };
  };
  T.fare = function (len, keke) {
    var f = Math.round((RULES.fareBase + RULES.farePerKm * len / 1000) / 10) * 10; f = Math.max(RULES.fareBase, Math.min(RULES.fareMax, f));
    return keke ? Math.round(f * RULES.kekeFactor / 10) * 10 : f;
  };
  // friends following you who come along (as many as there are seats: a keke takes three, the shuttle six)
  T.group = function (keke) { var F = Z.friends, l = F && F.companions ? F.companions() : []; return Math.min(l.length, keke ? 3 : 6); };
  T.minutes = function (len) { return Math.max(4, Math.round(len / 55)); }; // game minutes a skipped trip costs
  function free() { var P = Z.P; return !!(P && (P.god || (P.flags && P.flags.hero))); }

  /* ---------- menus ---------- */
  function dests(from, keke) {
    var me = Z.me, P = Z.P, list = T.stops().filter(function (p) { return p !== from; });
    if (keke) { var home = Z.place("@home"); if (home && list.indexOf(home) < 0) list.push(home); }
    return list.map(function (p) { var pa = T.path(me.x, me.y, p.mx, p.my); return { p: p, len: pa.len, fare: free() ? 0 : T.fare(pa.len, keke), mins: T.minutes(pa.len) }; })
      .filter(function (d) { return d.len > 60; }).sort(function (a, b) { return a.len - b.len; }).map(function (d) { d.off = P.money < d.fare; return d; });
  }
  function dist(len) { return len >= 1000 ? (len / 1000).toFixed(1) + " km" : Math.round(len / 10) * 10 + " m"; }
  T.menu = function (from, keke) {
    var U = Z.ui, P = Z.P; if (!U || !U.menu) return;
    if (T.active) { Z.toast("You are already on your way."); return; }
    var list = dests(from, keke);
    U.menu(keke ? "Keke" : esc(from ? from.name : "Campus shuttle"), (keke ? "“Where to?” A keke takes you to any stop, or straight to your hostel." : "The green and white shuttle runs between the stops all day.") + " <small>" + naira(P.money) + " · " + S.clock(P) + "</small>",
      list.map(function (d) { return { label: esc(stopName(d.p)) + " · " + (d.fare ? naira(d.fare) : "free"), sub: dist(d.len) + " by road" + (d.off ? " · not enough money" : ""), d: d, off: d.off, go: !d.off && d.p.id === "p2park" }; }),
      function (it) { how(from, keke, it.d); });
  };
  function how(from, keke, d) {
    Z.ui.menu(esc(stopName(d.p)), dist(d.len) + " by road. " + (d.fare ? "The fare is " + naira(d.fare) + "." : "No charge for you."), [
      { label: "Skip the journey", sub: "Arrive in about " + d.mins + " minutes of game time", mode: "skip", go: true },
      { label: "Ride along", sub: "Sit back and watch the road. Press " + (Z.api.keyName ? Z.api.keyName("act") : "E") + " to get off early", mode: "ride" }
    ], function (it) { Z.api.hide(); T.go(d.p.id, { mode: it.mode, keke: keke, fare: d.fare }); }, function () { T.menu(from, keke); });
  }

  /* ---------- the trip ---------- */
  // T.go(placeId, {mode: "skip" | "ride" | "instant", keke, fare}) → true when the trip started
  T.go = function (id, o) {
    o = o || {}; var me = Z.me, P = Z.P, api = Z.api, dest = Z.place(id); if (!dest || !P || T.active) return false;
    if (me.veh) { if (Z.exit) Z.exit(true); if (me.veh) return false; }
    var pa = T.path(me.x, me.y, dest.mx, dest.my), fare = o.fare != null ? o.fare : free() ? 0 : T.fare(pa.len, o.keke), grp = T.group(o.keke); fare *= 1 + grp; // you pay for the friends riding with you
    if (P.money < fare) { Z.toast("The fare is " + naira(fare) + ". You have " + naira(P.money) + "."); api.sound.sfx("block"); return false; }
    if (fare) Z.money(-fare); if (fare && grp) Z.toast("You paid " + naira(fare) + " for " + (grp + 1) + " people.");
    P.stats.shuttles = (P.stats.shuttles || 0) + 1;
    var mode = o.mode || "skip";
    if (mode === "instant" || pa.len < 30) { S.advance(P, T.minutes(pa.len)); land(dest); Z.emit({ t: "shuttle", to: dest.id, keke: !!o.keke }); return true; }
    var s0 = 0;
    if (mode === "skip") { s0 = Math.max(0, pa.len - 70); S.advance(P, T.minutes(pa.len)); api.flash("#000", 1.3); }
    var bus = { id: "shuttle" + Date.now(), type: o.keke ? "keke" : "car", vk: o.keke ? null : "bus", col: o.keke ? "#facc15" : "#f8fafc", x: me.x, y: me.y, a: 0, vx: 0, vy: 0, speed: 0, hx: me.x, hy: me.y, ha: 0, free: true, paid: true, shuttle: true };
    Z.cars.push(bus);
    T.active = { bus: bus, pa: pa, s: s0, v: mode === "skip" ? 9 : 0, dest: dest, keke: !!o.keke, mode: mode, heat: heat(), t: 0, seg: 0, acc: 0 };
    place(T.active, 0); bus.a = T.active.ha; bus.ha = bus.a;
    me.veh = bus; me.x = bus.x; me.y = bus.y; me.a = bus.a; me.emote = ""; me.sit = false; me.torch = false;
    if (api.useActions) api.useActions(["act", "jump", "phone", "horn", "radio"]);
    api.sound.sfx("click");
    Z.toast(mode === "ride" ? "<b>" + (o.keke ? "Keke" : "Shuttle") + " to " + esc(stopName(dest)) + ".</b> Press " + (api.keyName ? api.keyName("act") : "E") + " to get off early." : "<b>" + esc(stopName(dest)) + "</b>, coming up.");
    Z.emit({ t: "shuttle", to: dest.id, keke: !!o.keke });
    return true;
  };
  function heat() { try { return S.sec ? S.sec(Z.P).heat : 0; } catch (e) { return 0; } }
  function land(dest) { var me = Z.me, f = S.push(Z.W, dest.mx, dest.my, .6); me.x = f.x; me.y = f.y; me.vx = me.vy = 0; if (Z.api.flash) Z.api.flash("#000", .8); Z.toast("<b>" + esc(stopName(dest)) + ".</b>"); if (Z.save) Z.save(); }
  // put the bus on its line at distance A.s, on the right-hand side of the road
  function place(A, dt) {
    var p = A.pa.pts, s = A.s, i = 0, acc = 0, l;
    for (; i + 1 < p.length; i++) { l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); if (acc + l >= s || i + 2 >= p.length) break; acc += l; }
    l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) || 1; var t = Math.max(0, Math.min(1, (s - acc) / l)), dx = (p[i + 1][0] - p[i][0]) / l, dy = (p[i + 1][1] - p[i][1]) / l, ha = Math.atan2(dy, dx);
    var b = A.bus, da = ((ha - b.a + Math.PI * 3) % TAU) - Math.PI; A.ha = ha; b.a = dt ? b.a + da * (1 - Math.exp(-dt * 5)) : ha;
    var side = 2.1, tx = p[i][0] + dx * l * t - dy * side, ty = p[i][1] + dy * l * t + dx * side;
    if (dt) { var k = 1 - Math.exp(-dt * 8); b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; } else { b.x = tx; b.y = ty; }
    b.vx = Math.cos(b.a) * A.v; b.vy = Math.sin(b.a) * A.v; b.speed = A.v; A.dx = dx; A.dy = dy;
  }
  function blocked(A) { // somebody or something on the road ahead: the driver slows down rather than run them over
    var b = A.bus, near = 99, lists = [Z.peds || [], Z.traffic || [], Z.npcs || []], i, j;
    for (i = 0; i < lists.length; i++) for (j = 0; j < lists[i].length; j++) { var o = lists[i][j]; if (o.hidden) continue; var rx = o.x - b.x, ry = o.y - b.y, f = rx * A.dx + ry * A.dy, side = Math.abs(-rx * A.dy + ry * A.dx); if (f > 1 && f < 16 && side < (i === 1 ? 2.4 : 1.9)) near = Math.min(near, f); }
    return near;
  }
  function finish(early) {
    var A = T.active, me = Z.me, bus = A.bus; T.active = null; bus.speed = 0; bus.vx = bus.vy = 0;
    if (me.veh === bus && Z.exit) Z.exit(true);
    if (!early) { var f = S.push(Z.W, A.dest.mx, A.dest.my, .6); me.x = f.x; me.y = f.y; Z.toast("<b>" + esc(stopName(A.dest)) + ".</b> Mind your step."); Z.api.sound.sfx("click"); }
    else Z.toast("You got off early.");
    bus.gone = 4; T.left = (T.left || []).concat([bus]);
    if (Z.save) Z.save();
  }
  T.step = function (dt) {
    var i, A = T.active;
    if (T.left) { for (i = T.left.length - 1; i >= 0; i--) { var b = T.left[i]; b.gone -= dt; if (b.gone <= 0 || Z.me.veh === b) { if (Z.me.veh !== b) { var k = Z.cars.indexOf(b); if (k >= 0) Z.cars.splice(k, 1); } T.left.splice(i, 1); } } if (!T.left.length) T.left = null; }
    if (!A) return;
    var me = Z.me, P = Z.P;
    if (me.veh !== A.bus) { T.active = null; A.bus.gone = 3; T.left = (T.left || []).concat([A.bus]); return; } // thrown off by something else
    A.t += dt;
    var left = A.pa.len - A.s, top = A.keke ? 11 : 12.4, want = Math.min(top, Math.sqrt(Math.max(0, 2 * 4.5 * left)) + .6), gap = blocked(A);
    if (gap < 16) want = Math.min(want, gap < 5 ? 0 : (gap - 4) * .9);
    A.v += Math.max(-9 * dt, Math.min(3.2 * dt, want - A.v)); if (A.v < 0) A.v = 0;
    if (gap < 5 && A.v < .5) { A.wait = (A.wait || 0) + dt; if (A.wait > 1.2 && Z.api.sound.tone) { Z.api.sound.tone(A.keke ? 520 : 380, .22, "square", .1); A.wait = -1.5; (Z.peds || []).forEach(function (p) { if (Math.hypot(p.x - A.bus.x, p.y - A.bus.y) < 14) p.flee = 1.2; }); } if (A.stuck == null) A.stuck = 0; A.stuck += dt; if (A.stuck > 9) { A.s += 9; A.stuck = 0; } } else A.stuck = 0;
    A.s += A.v * dt; place(A, dt);
    me.x = A.bus.x; me.y = A.bus.y; me.a = A.bus.a; me.speed = A.bus.speed; me.inv = Math.max(me.inv || 0, .3);
    try { if (S.sec) { var sc = S.sec(P); if (sc.heat > A.heat && !sc.state) sc.heat = A.heat; else A.heat = sc.heat; } } catch (e) {}
    if (left < 1.2 || A.t > A.pa.len / 4 + 60) finish(false);
  };

  /* ---------- hooks: stop menu, roadside keke prompt, per-frame step ---------- */
  function keke() { // a keke in traffic close enough to wave down
    var me = Z.me, best = null, bd = 11; if (!me || me.veh || !Z.traffic) return null;
    Z.traffic.forEach(function (c) { if (c.type !== "keke") return; var d = Math.hypot(c.x - me.x, c.y - me.y); if (d < bd) { bd = d; best = c; } });
    return best && S.nearRoad(Z.W, me.x, me.y, 14) ? best : null;
  }
  T.keke = keke;
  T.install = function () {
    if (T.installed || !Z.ui || !Z.update) return; T.installed = true;
    var uPlace = Z.ui.place, uPrompt = Z.prompt, uUpdate = Z.update;
    Z.ui.place = function (pl) { if (pl && pl.role === "stop") { if (Z.guide && Z.guide.note) Z.guide.note("place", pl); return T.menu(pl); } return uPlace.apply(this, arguments); };
    Z.prompt = function () {
      if (T.active) return "Get off here";
      var p = uPrompt.apply(this, arguments); if (p) { var pl = !Z.me.veh && Z.near ? Z.near(7) : null; return pl && pl.role === "stop" && p === pl.name ? "Take the shuttle" : p; }
      return keke() ? "Flag down the keke" : "";
    };
    Z.update = function (dt) {
      var api = Z.api, play = Z.mode === "play" && api && !api.overlayOpen() && !(Z.bigOpen && Z.bigOpen());
      if (play && T.active && api.hit("act")) { finish(true); return uUpdate.apply(this, arguments); } // the core then sees a stopped vehicle and lets you out
      if (play && !T.active && !Z.me.veh && api.hit("act") && !uPrompt()) { var k = keke(); if (k) { k.hold = 2; T.menu(null, true); return; } }
      var r = uUpdate.apply(this, arguments);
      if (play) T.step(dt);
      return r;
    };
  };
  T.install();
})();
