/* Freshers School Life — a campus you can tell the time by.
   Besides the lone walkers, small scenes come and go with the hour and the place:
     morning   groups walking to lectures together
     midday    queues at the food spots, people eating and chatting
     evening   couples in the gardens and by the water, circles of friends at Shinkafi and the Social Centre,
               joggers, a kick-about on the pitch, rows at the mosque at prayer times
     night     hardly anyone: security on patrol with torches, night-market sellers, groups walking back
     Sunday    a crowd at the chapel in the morning
   Scene people are ordinary walkers (Z.peds) with a `scene` and an `act`: chat, sit, queue, pray, phone, ball,
   jog, group, patrol, sell. Hit one, scare one, and they drop the act and behave like anyone else.
   Everyone appears out of sight (the same rule as walkers) and is cleaned up when you are far away. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, C = Z.crowd = {}, TAU = Math.PI * 2, tickT = 0, scenes = {};
  var TALK = ["Did you see the timetable?", "That lecturer no dey smile.", "Who is going to Shinkafi tonight?", "I have not eaten since morning.", "Send me the note abeg.", "This semester is moving fast.", "Light never come?", "Your shoe is fine o.", "Let us snap one picture.", "I dey come, I dey come."];
  var SELL = ["Buy your recharge card here!", "Fresh bread! Hot bread!", "Suya, suya, suya!", "Pure water, cold one!"];
  var MAX = 30;
  function rnd() { return Math.random(); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function hour() { return Z.P.time / 60; }
  function kindOf(p) { var nm = (p.name + " " + p.id).toLowerCase(); return /mosque|masjid/.test(nm) ? "mosque" : /chapel|church/.test(nm) ? "chapel" : /pitch|field|stadium/.test(nm) ? "pitch" : /pier|dam|lake/.test(nm) ? "water" : /garden|park/.test(nm) ? "garden" : /market/.test(nm) ? "market" : /social|shinkafi|court/.test(p.id) ? "social" : p.role === "class" ? "class" : p.role === "food" ? "food" : p.role === "home" ? "home" : "any"; }
  C.kindOf = kindOf;
  function places(kind) { return Z.placeList.filter(function (p) { return kindOf(p) === kind; }); }
  function prayer(h) { return (h >= 5.3 && h < 6) || (h >= 13 && h < 13.7) || (h >= 15.7 && h < 16.2) || (h >= 18.4 && h < 19) || (h >= 19.8 && h < 20.3); }
  // What should be going on at this hour? [{kind of place, act, how many people, how many such scenes per place}]
  C.plan = function (h, day) {
    var out = [], sunday = day % 7 === 0;
    if (h >= 7 && h < 10) out.push({ at: "home", act: "group", n: 3, per: 1 }, { at: "class", act: "chat", n: 3, per: 1 });
    if (h >= 10 && h < 12) out.push({ at: "class", act: "chat", n: 3, per: 1 }, { at: "garden", act: "sit", n: 2, per: 1 });
    if (h >= 12 && h < 14.5) out.push({ at: "food", act: "queue", n: 5, per: 1 }, { at: "food", act: "chat", n: 3, per: 1 }, { at: "social", act: "sit", n: 3, per: 1 });
    if (h >= 14.5 && h < 16.5) out.push({ at: "class", act: "phone", n: 2, per: 1 }, { at: "garden", act: "sit", n: 2, per: 1 });
    if (h >= 16.5 && h < 19) out.push({ at: "pitch", act: "ball", n: 6, per: 1 }, { at: "garden", act: "couple", n: 2, per: 1 }, { at: "water", act: "couple", n: 2, per: 1 }, { at: "social", act: "chat", n: 4, per: 1 }, { at: "home", act: "jog", n: 2, per: 1 });
    if (h >= 19 && h < 22) out.push({ at: "social", act: "chat", n: 4, per: 2 }, { at: "garden", act: "couple", n: 2, per: 1 }, { at: "water", act: "couple", n: 2, per: 1 }, { at: "food", act: "sit", n: 3, per: 1 }, { at: "class", act: "group", n: 3, per: 1 });
    if (h >= 22 || h < 5) out.push({ at: "home", act: "patrol", n: 1, per: 1 }, { at: "class", act: "patrol", n: 1, per: 1 }, { at: "market", act: "sell", n: 3, per: 1 });
    if (h >= 21 && h < 23.5) out.push({ at: "home", act: "group", n: 3, per: 1 });
    if (prayer(h)) out.push({ at: "mosque", act: "pray", n: 8, per: 1 });
    if (sunday && h >= 8 && h < 11.5) out.push({ at: "chapel", act: "chat", n: 5, per: 2 }, { at: "chapel", act: "sit", n: 4, per: 1 });
    return out;
  };
  function free(x, y) { return !S.insideBuilding(Z.W, x, y) && !(Z.brawl && Z.brawl.onRoad(x, y)) && !S.inWater(Z.W, x, y); }
  function person(x, y, a, sc, act, i) {
    var W = Z.W, nr = S.nearRoad(W, x, y, 120) || { x: x, y: y, r: W.roads[0] }, w = S.wanderStart(W, Math.random, { x: nr.x, y: nr.y, r: nr.r }, false), side = (rnd() < .5 ? 1 : -1) * (nr.r.w / 2 + .8 + rnd());
    // start the wander point beside them, so that if the scene breaks up they simply walk on from here
    var p = nr.r.p, dd = 0; if (nr.s != null) { dd = Math.hypot(nr.x - p[nr.s], nr.y - p[nr.s + 1]); for (var k = 0; k < nr.s; k += 2) dd += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]); w.d = w.fwd ? dd : nr.r.len - dd; }
    S.wanderStep(W, w, 0, Math.random, side);
    var sd = Math.floor(rnd() * 1e6), look = act === "patrol" ? { skin: "#5e3a22", hair: "cap", hairCol: "#1e3a8a", top: "#1e3a8a", pants: "#0f172a", mode: "tee" } : (Z.lookOf ? Z.lookOf(sd) : { skin: "#6b4226", hair: "low", top: "#2563eb", mode: "tee" });
    return { w: w, x: x, y: y, a: a, spd: 0, look: look, sp: act === "jog" ? 3.5 : act === "patrol" ? 1.3 : act === "couple" ? .95 : 1.3 + rnd() * .5, side: side, walk: rnd() * 6, fall: 0, wave: 0, flee: 0, k: sd % 7, scene: sc, act: act, slot: i, torch: act === "patrol" || (!!Z.blackout && (act === "chat" || act === "group" || act === "sell")), sayT: 4 + rnd() * 10 };
  }
  // Put one scene down near place pl. Returns the people, or null if there is nowhere out of sight to put it.
  function stage(pl, spec, key) {
    var W = Z.W, m = Z.me, cx, cy, tries, ok = false;
    for (tries = 0; tries < 8 && !ok; tries++) { var a = rnd() * TAU, r = spec.act === "ball" ? 4 + rnd() * 8 : 6 + rnd() * 12; cx = pl.mx + Math.cos(a) * r; cy = pl.my + Math.sin(a) * r; ok = free(cx, cy) && (!Z.brawl || Z.brawl.okSpawn({ x: cx, y: cy }, 135, 60)); }
    if (!ok) return null;
    var sc = { key: key, act: spec.act, x: cx, y: cy, face: Math.atan2(pl.my - cy, pl.mx - cx), born: Z.api.t, until: 0, place: pl.id, people: [] }, n = spec.n, i, q;
    for (i = 0; i < n; i++) {
      var px, py, pa;
      if (spec.act === "queue") { px = cx - Math.cos(sc.face) * i * .95; py = cy - Math.sin(sc.face) * i * .95; pa = sc.face; }
      else if (spec.act === "pray") { var row = Math.floor(i / 4), col = i % 4; pa = 1.2; px = cx + Math.cos(pa + 1.5708) * (col - 1.5) * .9 - Math.cos(pa) * row * 1.2; py = cy + Math.sin(pa + 1.5708) * (col - 1.5) * .9 - Math.sin(pa) * row * 1.2; }
      else if (spec.act === "couple" || spec.act === "group" || spec.act === "jog") { px = cx + Math.cos(sc.face + 1.5708) * (i - (n - 1) / 2) * .9; py = cy + Math.sin(sc.face + 1.5708) * (i - (n - 1) / 2) * .9; pa = sc.face; }
      else if (spec.act === "sell" || spec.act === "patrol") { px = cx + (rnd() - .5) * 8; py = cy + (rnd() - .5) * 8; pa = rnd() * TAU; }
      else { var ca = i / n * TAU, cr = spec.act === "ball" ? 5 : n < 3 ? .8 : 1.15; px = cx + Math.cos(ca) * cr; py = cy + Math.sin(ca) * cr; pa = ca + Math.PI; }
      q = S.push(W, px, py, .4); if (!free(q.x, q.y) || (Z.brawl && !Z.brawl.okSpawn(q, 135, 60))) continue; /* every member out of sight, not just the middle of the scene */
      sc.people.push(person(q.x, q.y, pa, sc, spec.act, i));
    }
    if (sc.people.length < Math.min(2, n)) return null;
    sc.people.forEach(function (p) { Z.peds.push(p); }); void m; return sc;
  }
  // Once a second or so: start what the hour calls for near you, and let finished scenes drift apart.
  C.tick = function (dt) {
    var P = Z.P, m = Z.me; if (!P || Z.mode !== "play") return; tickT -= dt; if (tickT > 0) return; tickT = .6;
    var h = hour(), plan = C.plan(h, P.day), want = {}, k, i, count = 0;
    for (k in scenes) { var sc = scenes[k]; sc.people = sc.people.filter(function (p) { return p.scene === sc && Z.peds.indexOf(p) >= 0; }); if (!sc.people.length) delete scenes[k]; else count += sc.people.length; }
    if (m.alt > .05) return;
    if (Z.blackout) plan = plan.filter(function (sp) { return sp.act === "chat" || sp.act === "sell" || sp.act === "patrol" || sp.act === "group"; }).map(function (sp) { return { at: sp.at, act: sp.act, n: Math.max(2, sp.n - 1), per: 1 }; }); /* no light: fewer, smaller groups, phone torches on */
    plan.forEach(function (sp) { places(sp.at).forEach(function (pl) { for (var j = 0; j < sp.per; j++) want[pl.id + ":" + sp.act + ":" + j] = { pl: pl, sp: sp }; }); });
    // a scene whose hour has passed breaks up: its people just walk on
    for (k in scenes) if (!want[k] && Z.api.t - scenes[k].born > 20) { scenes[k].people.forEach(function (p) { p.scene = null; p.act = ""; p.sit = false; p.film = false; }); delete scenes[k]; }
    var made = 0; for (k in want) { if (scenes[k] || made >= 2 || count >= MAX) continue; var w = want[k], d = Math.hypot(w.pl.mx - m.x, w.pl.my - m.y); if (d > 150 || d < 30) continue; var s2 = stage(w.pl, w.sp, k); if (s2) { scenes[k] = s2; count += s2.people.length; made++; } }
    // nobody named stands inside a tree
    for (i = 0; i < Z.npcs.length; i++) C.untree(Z.npcs[i]);
  };
  C.untree = function (n) {
    if (n.hidden || n.follow || n.lead || (n.spd || 0) > .3) return false; var G = window.SamaruDraw, ts = [], pr = Z.W.props || [], j;
    if (!C._trees) { C._trees = pr.filter(function (q) { return q && (q.k === "tree" || q.k === "palm"); }); }
    for (j = 0; j < C._trees.length; j++) if (Math.abs(C._trees[j].x - n.x) < 2 && Math.abs(C._trees[j].y - n.y) < 2) ts.push(C._trees[j]);
    try { if (G && G.treesIn && !Z.W.designed) ts = ts.concat(G.treesIn(Math.floor(n.x / 40), Math.floor(n.y / 40))); } catch (e) {} if (!ts.length) return false;
    for (var i = 0; i < ts.length; i++) { var t = ts[i], d = Math.hypot(t.x - n.x, t.y - n.y); if (d < 1.5) { var a = d > .05 ? Math.atan2(n.y - t.y, n.x - t.x) : 1, q = S.push(Z.W, t.x + Math.cos(a) * 2.4, t.y + Math.sin(a) * 2.4, .5); n.x = q.x; n.y = q.y; if (n.hx != null && Math.hypot(n.hx - t.x, n.hy - t.y) < 1.5) { n.hx = q.x; n.hy = q.y; } if (n.rt && Math.hypot(n.rt.tx - t.x, n.rt.ty - t.y) < 1.5) { n.rt.tx = q.x; n.rt.ty = q.y; } return true; } }
    return false;
  };
  function turn(n, x, y, dt) { n.a += S.angDiff(Math.atan2(y - n.y, x - n.x), n.a) * Math.min(1, dt * 5); }
  function still(n, dt) { n.spd = (n.spd || 0) * Math.exp(-12 * dt); }
  function chatter(n, dt, lines) { n.sayT -= dt; if (n.sayT > 0) return; n.sayT = 9 + rnd() * 14; var m = Z.me; if (Math.hypot(n.x - m.x, n.y - m.y) < 13 && !Z.api.overlayOpen() && (!Z.focus || Z.focus.allow("bystander")) && Z.say) Z.say(n, pick(lines)); }
  // Called for each walker after the reactions module has had its say. True = this module moved them.
  C.ped = function (n, dt, d) {
    var sc = n.scene; if (!sc) return false;
    if (n.hits || n.st || n.limp > 0) { n.scene = null; n.act = ""; n.sit = false; n.film = false; return false; } // disturbed: an ordinary walker now
    var W = Z.W, m = Z.me, act = n.act, lead = sc.people[0];
    n.sit = false; n.film = false;
    if (act === "chat") { turn(n, sc.x, sc.y, dt); still(n, dt); chatter(n, dt, TALK); if (n.slot === 0 && rnd() < dt * .08) n.wave = 1; return true; }
    if (act === "sit" || act === "pray") { n.sit = true; still(n, dt); if (act === "sit") chatter(n, dt, TALK); return true; }
    if (act === "phone") { n.film = true; still(n, dt); return true; }
    if (act === "sell") { still(n, dt); if (d < 14) turn(n, m.x, m.y, dt); chatter(n, dt, SELL); return true; }
    if (act === "queue") { var tx = sc.x - Math.cos(sc.face) * n.slot * .95, ty = sc.y - Math.sin(sc.face) * n.slot * .95; if (Math.hypot(tx - n.x, ty - n.y) > .35) n.walk += S.walkTo(W, n, tx, ty, 1.2, dt, null, .3) * 2.6; else { still(n, dt); n.a += S.angDiff(sc.face, n.a) * Math.min(1, dt * 4); }
      // the front of the queue is served and joins the back
      if (n.slot === 0) { sc.serve = (sc.serve || 6 + rnd() * 5) - dt; if (sc.serve <= 0) { sc.serve = 6 + rnd() * 6; sc.people.forEach(function (p) { p.slot = p.slot === 0 ? sc.people.length - 1 : p.slot - 1; }); } } return true; }
    if (act === "ball") { // a kick-about: everyone chases a ball that keeps getting booted somewhere else
      if (!sc.ball || (sc.bt -= dt / sc.people.length) <= 0) { var ba = rnd() * TAU, br = rnd() * 9, bq = S.push(W, sc.x + Math.cos(ba) * br, sc.y + Math.sin(ba) * br, .5); sc.ball = { x: bq.x, y: bq.y }; sc.bt = 1.6 + rnd() * 1.8; }
      var bd = Math.hypot(sc.ball.x - n.x, sc.ball.y - n.y), off = (n.slot % 3) * 1.6; if (bd > 1.2 + off) n.walk += S.walkTo(W, n, sc.ball.x, sc.ball.y, n.slot % 2 ? 4.6 : 3.4, dt, sc.people, .38) * 2.6; else { still(n, dt); if (!(n.atkT > 0) && rnd() < dt * 1.5) { n.atkT = .26; n.combo = 2; } } if (n.atkT > 0) n.atkT = Math.max(0, n.atkT - dt); return true; }
    if (act === "group" || act === "couple" || act === "jog") { // the first one walks the paths as usual; the rest keep beside them
      if (n === lead || !lead || Z.peds.indexOf(lead) < 0 || lead.scene !== sc) { if (act === "couple" && n === lead && Z.api.t - sc.born > 25 && !sc.rest && rnd() < dt * .02) sc.rest = 14; if (sc.rest > 0 && n === lead) { sc.rest -= dt; n.sit = true; still(n, dt); return true; } return false; }
      if (sc.rest > 0) { n.sit = true; still(n, dt); return true; }
      var row = n.slot, la = lead.a, ox = lead.x - Math.cos(la) * (act === "couple" ? 0 : .5 + Math.floor(row / 2) * .9) + Math.cos(la + 1.5708) * (row % 2 ? .85 : -.85) * (act === "couple" ? 1 : 1), oy = lead.y - Math.sin(la) * (act === "couple" ? 0 : .5 + Math.floor(row / 2) * .9) + Math.sin(la + 1.5708) * (row % 2 ? .85 : -.85), gd = Math.hypot(ox - n.x, oy - n.y);
      if (gd > .3) n.walk += S.walkTo(W, n, ox, oy, Math.min(lead.sp * 1.6 + 1, .6 + gd * 2.2 + (lead.spd || 0)), dt, null, .36) * 2.6; else still(n, dt); if (act !== "jog") chatter(n, dt, TALK); return true; }
    if (act === "patrol") return false; // walks the paths like anyone, torch in hand
    return false;
  };
  C.scenes = function () { return scenes; };
  C.reset = function () { scenes = {}; tickT = 0; };
})();
