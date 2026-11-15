/* Freshers School Life — the living city.
   Walkers have small lives: a trait (honest, mischievous, timid, bold), needs (food, class, money, social, rest)
   and now and then an errand that takes them somewhere: lunch at a food spot, a lecture they are late for, the
   Social Centre in the evening. A director spaces out small, light-hearted incidents: a phone snatched, a wallet
   lifted, a bicycle or okada pinched, something slipped out of a shop, a notice board defaced, a show-off driving
   too fast, two students squaring up over a girlfriend. Security, a patrol rider and sometimes a brave bystander
   give chase; thieves run for cover, hide, get away or get walked to the security post.
   You can ignore it, film it (stand still and watch), report it from the phone, help (tackle or punch the thief:
   reward and reputation) or join in (heat, and people talk). Witnesses gossip; rumours spread through chats and
   reach your friends. Nothing happens while Z.focus says you are busy (a mission, a job, a race, a lecture).
   Procedural only: no network, no AI service. Nobody is hurt worse than a fall. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, C = Z.city = {}, TAU = Math.PI * 2;
  var TRAITS = ["honest", "honest", "honest", "mischievous", "timid", "timid", "bold", "bold"];
  var KINDS = { snatch: { w: 3, night: 1.4, name: "phone snatch" }, pickpocket: { w: 2, night: 1, name: "pick-pocket" }, shoplift: { w: 2, night: .6, name: "shoplifting" }, bike: { w: 2, night: 1.3, name: "stolen bike" }, vandal: { w: 1, night: 1.8, name: "vandalism" }, reckless: { w: 1.5, night: 1.2, name: "reckless driving" }, quarrel: { w: 1.5, night: 1, name: "a fight over a girlfriend" } };
  var L = {
    snatch: ["My phone! He took my phone!", "Thief! Thief! My phone!", "Hey! Bring back my phone!"],
    pickpocket: ["My wallet... where is my wallet?!", "Somebody has dipped hand in my pocket!"],
    shoplift: ["Hold that one! He did not pay!", "Ole! Catch am!"],
    bike: ["My bike! Somebody is riding my bike!", "Hey! That okada is mine!"],
    vandal: ["Who is spoiling the notice board?!", "Leave the timetable alone!"],
    help: ["Abeg, help me catch him!", "Please! Stop him!", "You! Help me!"],
    chase: ["Stop there!", "Security! Stop!", "You cannot run far!"],
    caught: ["Okay okay, I surrender.", "Na mistake, abeg!", "I was going to return it!"],
    escaped: ["He don run.", "They are gone.", "Next time."],
    argue: ["You dey toast my babe?", "She is my girlfriend!", "Who are you to talk to her?", "Leave her alone!"],
    gossip: ["Did you hear? Somebody's {k} near {p}.", "Gist: there was {k} at {p} today.", "They said security chased somebody round {p}."],
    you: ["People are saying you caught a thief at {p}!", "Everybody is talking about how you stopped that thief.", "They say you were in that wahala at {p}. Is it true?"]
  };
  var gapT = 70, inc = null, rum = [], seq = 0, agendaT = 0;
  function rnd() { return Math.random(); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function say(o, t) { try { if (Z.say) Z.say(o, t); } catch (e) {} }
  function toast(h) { try { if (Z.toast) Z.toast(h); } catch (e) {} }
  function sfx(n) { try { Z.api.sound.sfx(n); } catch (e) {} }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function state() { var P = Z.P; if (!P.city || typeof P.city !== "object") P.city = { rep: 0, caught: 0, seen: 0, joined: 0, heard: {} }; if (!P.city.heard) P.city.heard = {}; return P.city; }
  C.state = function () { return Z.P ? state() : null; };

  /* ---------- lives: a trait, needs and the odd errand ---------- */
  function life(n) { if (n.cz) return n.cz; var h = S.hash((n.k || 0) + 11, Math.floor((n.sp || 1) * 1000) + (n.look && n.look.top ? n.look.top.length : 0)); n.cz = { trait: TRAITS[Math.floor(h * TRAITS.length) % TRAITS.length], food: 30 + rnd() * 70, social: 30 + rnd() * 70, money: rnd() * 100, rest: 50 + rnd() * 50, goal: null, cd: 3 + rnd() * 20 }; return n.cz; }
  C.life = life;
  function placesOf(test) { return Z.placeList.filter(test); }
  function kindOf(p) { return Z.crowd && Z.crowd.kindOf ? Z.crowd.kindOf(p) : p.role || "any"; }
  function nearest(n, test, maxD) { var best = null, bd = maxD || 160; Z.placeList.forEach(function (p) { if (!test(p)) return; var d = Math.hypot(p.mx - n.x, p.my - n.y); if (d < bd && d > 12) { bd = d; best = p; } }); return best; }
  // What does this person want to do next? The highest-scoring need wins.
  function choose(n, c, h) {
    var opts = [];
    if (c.food < 35) opts.push({ u: 100 - c.food, p: nearest(n, function (p) { return p.role === "food"; }), act: "eat", t: 12 });
    if (h >= 7.5 && h < 16 && c.trait !== "mischievous") opts.push({ u: 55 + (h >= 7.5 && h < 9 ? 25 : 0), p: nearest(n, function (p) { return p.role === "class"; }, 220), act: "class", t: 6, late: h % 1 > .8 });
    if (h >= 17 && h < 22) opts.push({ u: 110 - c.social, p: nearest(n, function (p) { var k = kindOf(p); return k === "social" || k === "garden" || k === "water"; }, 220), act: "social", t: 18 });
    if (c.rest < 30 || h >= 22.5 || h < 6) opts.push({ u: 90 - c.rest, p: nearest(n, function (p) { return p.role === "home"; }, 260), act: "home", t: 4 });
    opts = opts.filter(function (o) { return o.p; }); if (!opts.length) return null; opts.sort(function (a, b) { return b.u - a.u; }); return opts[0];
  }
  function route(o, tx, ty) { var p = S.route(Z.W, o.x, o.y, tx, ty, false); if (!p || p.length < 4) p = [o.x, o.y, tx, ty]; return { p: p, i: 2, tx: tx, ty: ty, slow: 0 }; }
  // Walk o along route r. Returns true on arrival.
  function follow(o, r, sp, dt, others) {
    if (o.fall > 0 || o.getUpT > 0 || o.dustT > 0) { o.spd = 0; return false; } // on the floor: no moving until they are up
    var W = Z.W, p = r.p; while (r.i < p.length - 2 && Math.hypot(p[r.i] - o.x, p[r.i + 1] - o.y) < 2) r.i += 2;
    var last = r.i >= p.length - 2, tx = last ? r.tx : p[r.i], ty = last ? r.ty : p[r.i + 1]; if (last && Math.hypot(tx - o.x, ty - o.y) < 1.2) { o.spd = (o.spd || 0) * Math.exp(-10 * dt); return true; }
    var mv = S.walkTo(W, o, tx, ty, sp, dt, others || null, .4); o.walk = (o.walk || 0) + mv * 2.6;
    if (mv < sp * dt * .2) { r.slow += dt; if (r.slow > .6) { r.slow = 0; var ex = Z.wayOut ? Z.wayOut(o.x, o.y, r.tx, r.ty) : null; if (ex) { var rq = S.route(W, ex.x, ex.y, r.tx, r.ty, false); r.p = [o.x, o.y, ex.x, ex.y].concat(rq && rq.length >= 4 ? rq.slice(2) : [r.tx, r.ty]); r.i = 2; } else r.i += 2; } } else r.slow = 0;
    return false;
  }
  // Steer o at a moving point: straight when you can see it, by the paths when you cannot.
  function chaseTo(o, tx, ty, sp, dt) {
    if (o.fall > 0 || o.getUpT > 0 || o.dustT > 0) { o.spd = 0; return; }
    var d = Math.hypot(tx - o.x, ty - o.y); if (d < 20 && S.los(Z.W, o.x, o.y, tx, ty)) { o.rr = null; var mv = S.walkTo(Z.W, o, tx, ty, sp, dt, null, .4); o.walk = (o.walk || 0) + mv * 2.6; if (mv < sp * dt * .2 && d > 2) { o.rr = route(o, tx, ty); } return; }
    o.rrT = (o.rrT || 0) - dt; if (!o.rr || o.rrT <= 0 || Math.hypot(o.rr.tx - tx, o.rr.ty - ty) > 10) { o.rr = route(o, tx, ty); o.rrT = 1.5; } follow(o, o.rr, sp, dt, null);
  }
  function rejoin(n) { var W = Z.W, nr = S.nearRoad(W, n.x, n.y, 120); if (!nr) return; var w = S.wanderStart(W, Math.random, { x: nr.x, y: nr.y, r: nr.r }, false), p = nr.r.p, dd = Math.hypot(nr.x - p[nr.s], nr.y - p[nr.s + 1]); for (var k = 0; k < nr.s; k += 2) dd += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]); w.d = w.fwd ? dd : nr.r.len - dd; S.wanderStep(W, w, 0, Math.random, n.side || 2); n.w = w; }
  // After the reactions module: errands for ordinary walkers. True = handled this frame.
  C.ped = function (n, dt, d) {
    if (n.scene || n.pax || n.cls != null || n.cr) return false; var c = life(n), P = Z.P;
    c.food -= dt * .05; c.social -= dt * .04; c.rest -= dt * .02; c.cd -= dt;
    var g = c.goal;
    if (!g) { if (c.cd > 0 || d > 120) return false; c.cd = 25 + rnd() * 40; if (rnd() > .35) return false; var o = choose(n, c, P.time / 60); if (!o) return false; var q = S.push(Z.W, o.p.mx + (rnd() - .5) * 6, o.p.my + (rnd() - .5) * 6, .4); c.goal = g = { act: o.act, place: o.p.id, r: route(n, q.x, q.y), t: o.t + rnd() * 8, late: !!o.late, there: false }; }
    if (!g.there) { var sp = n.sp * (g.late ? 2.4 : 1.1) * (n.limp > 0 ? .5 : 1); if (follow(n, g.r, sp, dt, Z.peds)) g.there = true; else if (g.late && !g.said && d < 18) { g.said = 1; say(n, pick(["I'm late! I'm late!", "Lecturer will lock the door!", "Abeg comot for road!"])); } return true; }
    g.t -= dt; n.spd = (n.spd || 0) * Math.exp(-10 * dt);
    if (g.act === "eat") { n.sit = true; c.food = Math.min(100, c.food + dt * 6); } else if (g.act === "social") { n.film = g.t % 6 < 2; c.social = Math.min(100, c.social + dt * 5); } else if (g.act === "home") c.rest = 100;
    if (g.t <= 0) { n.sit = false; n.film = false; c.goal = null; if (g.act === "home" || g.act === "class") n.gone = true; else rejoin(n); } return true;
  };

  /* ---------- incidents ---------- */
  function allowed() {
    var P = Z.P, m = Z.me; if (!P || Z.mode !== "play" || Z.inside || Z.race || P.job || m.alt > .05) return false;
    try { if (Z.api.overlayOpen()) return false; } catch (e) {}
    if (Z.focus && Z.focus.current().kind !== "roam") return false; if (P.sec && P.sec.state) return false; if (Z.phone && Z.phone.snatch && Z.phone.snatch()) return false; /* your own phone is being snatched (samaru-phone.js) */ if (Z.foes && Z.foes.length) return false; if (Z.momentBusy && Z.momentBusy()) return false;
    return true;
  }
  C.allowed = allowed;
  function gap() { var h = Z.P.time / 60, night = h >= 20 || h < 5; return (night ? 60 : 95) + rnd() * (night ? 70 : 110); }
  function candidate(test, lo, hi) { var m = Z.me, best = null, bs = -1; for (var i = 0; i < Z.peds.length; i++) { var n = Z.peds[i]; if (n.scene || n.pax || n.cr || n.fall > 0 || n.st || n.hall || n.gone) continue; var d = dist(n, m); if (d < lo || d > hi || !test(n)) continue; var sc = rnd() + (life(n).trait === "mischievous" ? 1 : 0); if (sc > bs) { bs = sc; best = n; } } return best; }
  function guardLook() { return { skin: "#5e3a22", hair: "cap", hairCol: "#1e3a8a", top: "#1e3a8a", pants: "#0f172a", mode: "tee" }; }
  function spawnPed(x, y, look, extra) { var W = Z.W, nr = S.nearRoad(W, x, y, 120) || { x: x, y: y, r: W.roads[0] }, w = S.wanderStart(W, Math.random, { x: nr.x, y: nr.y, r: nr.r }, false); S.wanderStep(W, w, 0, Math.random, nr.r.w / 2 + 1.4); var n = { w: w, x: x, y: y, a: 0, spd: 0, look: look, sp: 1.4, side: nr.r.w / 2 + 1.4, walk: 0, fall: 0, wave: 0, flee: 0, k: 2 }; for (var k in extra) n[k] = extra[k]; Z.peds.push(n); return n; }
  // A guard (or a patrol rider) appears out of sight, a sensible distance from the trouble.
  function chaser(at, look) {
    var W = Z.W; for (var t = 0; t < 24; t++) { var a = rnd() * TAU, r = 32 + rnd() * 30, x = at.x + Math.cos(a) * r, y = at.y + Math.sin(a) * r; if (S.insideBuilding(W, x, y) || S.inWater(W, x, y)) continue; var q = { x: x, y: y }; if (Z.brawl && !Z.brawl.okSpawn(q, 135, 50)) continue;
      return spawnPed(x, y, look || guardLook(), { cr: "chaser", torch: Z.P.time / 60 > 19 || Z.P.time / 60 < 6 }); }
    return null;
  }
  C.start = function (kind) {
    var m = Z.me, W = Z.W, h = Z.P.time / 60, I = { kind: kind, id: ++seq, t: 0, st: "setup", chasers: [], lastSeen: 0, filmed: false, reported: false, by: "", place: "" }, thief = null, victim = null;
    var near = Z.placeList.reduce(function (b, p) { var d = Math.hypot(p.mx - m.x, p.my - m.y); return !b || d < b.d ? { p: p, d: d } : b; }, null); I.place = near ? near.p.name : "campus";
    if (kind === "snatch" || kind === "pickpocket") { thief = candidate(function (n) { return life(n).trait === "mischievous" || rnd() < .3; }, 18, 90); if (!thief) return null; victim = candidate(function (n) { return n !== thief && dist(n, thief) < 30 && dist(n, thief) > 3; }, 8, 100); if (!victim) return null; I.st = "approach"; }
    else if (kind === "shoplift") { var shop = nearest(m, function (p) { return p.role === "shop" || p.role === "food"; }, 90); if (!shop) return null; thief = candidate(function (n) { return dist(n, { x: shop.mx, y: shop.my }) < 60; }, 15, 90); if (!thief) return null; I.goal = { x: shop.mx, y: shop.my }; I.place = shop.name; I.st = "approach"; }
    else if (kind === "vandal") { var board = nearest(m, function (p) { return p.role === "class"; }, 90); if (!board) return null; thief = candidate(function () { return true; }, 15, 90); if (!thief) return null; I.goal = { x: board.mx, y: board.my }; I.place = board.name; I.st = "approach"; }
    else if (kind === "bike") { var bk = null, bd = 1e9; Z.cars.forEach(function (c) { if (c === m.veh || c.job || c.city || !/^(bike|okada|scooter)$/.test(c.type) || Math.abs(c.speed || 0) > .5) return; var d = dist(c, m); if (d > 25 && d < 100 && d < bd) { bd = d; bk = c; } }); if (!bk) return null; thief = candidate(function (n) { return dist(n, bk) < 45; }, 15, 110); if (!thief) return null; I.bike = bk; I.goal = { x: bk.x, y: bk.y }; I.st = "approach"; }
    else if (kind === "reckless") { var car = null; Z.traffic.forEach(function (t) { var d = dist(t, m); if (!car && !t.city && t.type === "car" && d > 50 && d < 160) car = t; }); if (!car) return null; car.city = "reckless"; car.sp0 = car.sp; car.sp = Math.min(S.VEH.car.max * .85, car.sp * 2); I.car = car; I.st = "run"; I.chasers.push(patrolCar(car)); say(null, ""); }
    else if (kind === "quarrel") { var a = candidate(function (n) { return life(n).trait !== "timid"; }, 14, 60); if (!a) return null; var b = candidate(function (n) { return n !== a && dist(n, a) < 25; }, 8, 70); if (!b) return null; I.a = a; I.b = b; a.cr = b.cr = "quarrel"; I.st = "argue"; I.spot = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    if (thief) { thief.cr = "thief"; life(thief).goal = null; thief.scene = null; I.thief = thief; thief.hits0 = thief.hits || 0; }
    if (victim) { victim.cr = "victim"; life(victim).goal = null; I.victim = victim; }
    inc = I; Z.emit && Z.emit({ t: "crime", kind: kind, phase: "start" }); return I;
  };
  function patrolCar(target) { var W = Z.W, m = Z.me; for (var t = 0; t < 30; t++) { var q = S.randomRoadPoint(W, Math.random, true, target, 120); if (!q) continue; var d = dist(q, target); if (d < 50 || (Z.brawl && !Z.brawl.okSpawn(q, 265, 60))) continue; var w = S.wanderStart(W, Math.random, q, true); S.wanderStep(W, w, 0, Math.random, q.r.w * .23); var c = { w: w, type: "okada", col: "#1e3a8a", sp: 15, v: 0, x: w.x, y: w.y, a: w.a, pri: 0, look: guardLook(), city: "patrol", torch: true }; Z.traffic.push(c); void m; return c; } return null; }
  // the thief's run: away from whoever is closest, into cover where it can be found
  function flee(n, dt, chasers) {
    var W = Z.W, m = Z.me, near = null, nd = 1e9; chasers.concat(!m.veh && dist(m, n) < 30 ? [m] : []).forEach(function (c) { var d = dist(c, n); if (d < nd) { nd = d; near = c; } });
    n.fleeT = (n.fleeT || 0) - dt; if (!n.fr || n.fleeT <= 0 || (n.fr && follow(n, n.fr, 0, 0))) { n.fleeT = 2.2; var base = near ? Math.atan2(n.y - near.y, n.x - near.x) : n.a, best = null, bs = -1e9;
      for (var k = 0; k < 10; k++) { var a = base + (k - 4.5) * .3, r = 22 + rnd() * 14, x = n.x + Math.cos(a) * r, y = n.y + Math.sin(a) * r; if (S.insideBuilding(W, x, y) || S.inWater(W, x, y)) continue; var sc = (near ? dist({ x: x, y: y }, near) : 0) + (near && !S.los(W, near.x, near.y, x, y) ? 25 : 0); if (sc > bs) { bs = sc; best = { x: x, y: y }; } }
      if (best) n.fr = route(n, best.x, best.y); }
    var tired = (inc.t > 22 ? .72 : 1), sp = S.FOOT.run * .74 * tired; if (n.fr) follow(n, n.fr, sp, dt, null);
  }
  function seen(n, chasers) { var W = Z.W; for (var i = 0; i < chasers.length; i++) { var c = chasers[i]; if (dist(c, n) < 45 && S.los(W, c.x, c.y, n.x, n.y)) return true; } return false; }
  function end(result, who) {
    var I = inc, P = Z.P, cs = state(); if (!I) return; I.st = result; I.endT = 0; var here = I.place;
    if (result === "caught") { if (I.thief) { I.thief.cr = "held"; I.thief.st = ""; I.thief.react = 0; I.thief.dodge = 0; say(I.thief, pick(L.caught)); } if (who === "you") { var cash = 300 + Math.floor(rnd() * 5) * 100; P.money += cash; cs.rep += 3; cs.caught++; if (P.sec) { P.sec.heat = Math.max(0, (P.sec.heat || 0) - 30); P.sec.warns = Math.max(0, (P.sec.warns || 0) - 1); } if (Z.moment) Z.moment("goal", { title: "Thief stopped at " + here, cash: cash, lines: ["Security took it from there. Reputation +3"] }); } }
    else if (result === "escaped") { var s0 = I.chasers[0]; if (s0) say(s0, pick(L.escaped)); }
    rumour(I, result, who); Z.emit && Z.emit({ t: "crime", kind: I.kind, phase: result, by: who || "" });
  }
  // the end of a scene: everyone goes back to an ordinary day, the officers walk the thief off, and out of view they are gone
  function wrap(dt) {
    var I = inc; I.endT += dt; var post = Z.places.gate || Z.placeList[0], all = [I.thief, I.victim, I.a, I.b].concat(I.chasers).filter(Boolean);
    all.forEach(function (n) { if (Z.traffic.indexOf(n) >= 0) return; if (n.cr === "held" || (n.cr === "chaser" && I.st === "caught")) { n.gone = false; if (!n.esc) n.esc = route(n, post.mx, post.my); var lead = I.chasers[0]; if (n.cr === "held" && lead && Z.peds.indexOf(lead) >= 0) chaseTo(n, lead.x - Math.cos(lead.a) * 1.1, lead.y - Math.sin(lead.a) * 1.1, 2.4, dt); else follow(n, n.esc, 1.6, dt, null); n.st = n.cr === "held" ? "yield" : ""; } });
    if (I.endT > 4) all.forEach(function (n) { if (Z.traffic.indexOf(n) >= 0) { if (n.city === "patrol" || n.city === "thief") { n.city = n.city === "patrol" ? "leave" : "leave"; n.sp = 9; } else if (n.city === "reckless") { n.city = ""; n.sp = n.sp0 || 8; } return; } if (n.cr === "held" || n.cr === "chaser") { if (I.endT > 25 || (dist(n, Z.me) > 45 && !(Z.crowd && false))) { n.st = ""; n.gone = true; } return; } if (n.cr) { n.cr = null; n.st = ""; n.sit = false; rejoin(n); } });
    if (I.endT > 26) { release(); inc = null; gapT = gap(); }
  }
  function fizzle(I) { I.st = "fizzled"; I.endT = 20; Z.emit && Z.emit({ t: "crime", kind: I.kind, phase: "fizzled" }); } /* the people walked off or you got busy: it never comes to anything */
  function step(dt) {
    var I = inc, m = Z.me, P = Z.P, cs = state(); I.t += dt;
    if (I.st === "caught" || I.st === "escaped" || I.st === "settled" || I.st === "fizzled") { wrap(dt); return; }
    if (!allowed() && I.st !== "run") { fizzle(I); return; }
    var th = I.thief, all = [th, I.victim, I.a, I.b].filter(Boolean);
    for (var i = 0; i < all.length; i++) if (Z.peds.indexOf(all[i]) < 0) { fizzle(I); return; }
    // you, watching: stand still with the trouble in view and you have it on your phone
    if (!I.filmed && (th || I.a) && !m.veh && (m.speed || 0) < .4) { var tg = th || I.a, d0 = dist(tg, m); if (d0 < 40 && S.los(Z.W, m.x, m.y, tg.x, tg.y)) { I.watch = (I.watch || 0) + dt; if (I.watch > 2.5) { I.filmed = true; cs.seen++; cs.rep += 1; toast("<b>You filmed it.</b> Security will know exactly who to look for."); Z.emit && Z.emit({ t: "crime", kind: I.kind, phase: "filmed" }); } } else I.watch = 0; }
    // you, joining in: hitting the victim or an officer
    all.concat(I.chasers).forEach(function (n) { if (!n || n === th) return; if ((n.hits || 0) > (n.hitSeen || 0)) { n.hitSeen = n.hits; if (n.cr === "victim" || n.cr === "chaser") { cs.joined++; cs.rep -= 2; I.joined = true; if (Z.offend) Z.offend("shove"); } } });
    if (I.kind === "reckless") return stepCar(I, dt);
    if (I.kind === "quarrel") return stepQuarrel(I, dt);
    if (I.st === "approach") {
      var tx = I.victim ? I.victim.x : I.goal.x, ty = I.victim ? I.victim.y : I.goal.y; chaseTo(th, tx, ty, I.kind === "snatch" ? 4.2 : 1.8, dt);
      if (I.victim) { I.victim.spd = (I.victim.spd || 0) * .9; } if (dist(th, { x: tx, y: ty }) < (I.victim ? 1.2 : 2.5) || I.t > 40) {
        if (I.kind === "bike" && I.bike) { var ci = Z.cars.indexOf(I.bike); if (ci >= 0 && m.veh !== I.bike) { Z.cars.splice(ci, 1); var w = S.wanderStart(Z.W, Math.random, S.nearRoad(Z.W, I.bike.x, I.bike.y, 80) ? (function () { var q = S.nearRoad(Z.W, I.bike.x, I.bike.y, 80); return { x: q.x, y: q.y, r: q.r }; })() : S.randomRoadPoint(Z.W, Math.random, true), true); S.wanderStep(Z.W, w, 0, Math.random, 1.5); var tc = { w: w, type: I.bike.type, col: I.bike.col || "#ef4444", sp: Math.min(S.VEH[I.bike.type].max * .7, 12), v: 2, x: I.bike.x, y: I.bike.y, a: I.bike.a, pri: 0, look: th.look, city: "thief" }; Z.traffic.push(tc); I.car = tc; th.gone = true; var owner = candidate(function () { return true; }, 4, 60); if (owner) say(owner, pick(L.bike)); I.st = "run"; I.chasers.push(patrolCar(tc)); sfx("whistle"); } else fizzle(I); return; }
        if (I.kind === "vandal") { I.st = "work"; I.workT = 4; return; }
        if (I.kind === "snatch" || I.kind === "pickpocket") { I.victim.hitT = .35; I.victim.hitA = th.a; if (I.kind === "snatch" && Z.fx && Z.fx.knock) Z.fx.knock(I.victim, th.a, 2.5); I.delay = I.kind === "pickpocket" ? 3 : .3; }
        I.st = "flee"; I.fleeAt = I.t; th.spd = 0; sfx("dash");
        var c1 = chaser(th); if (c1) I.chasers.push(c1); if (rnd() < .45) { var bold = candidate(function (n) { return n !== th && n !== I.victim && life(n).trait === "bold"; }, 2, 50); if (bold) { bold.cr = "chaser"; bold.vol = true; I.chasers.push(bold); } }
      }
      return;
    }
    if (I.st === "work") { th.atkT = th.atkT > 0 ? th.atkT - dt : .26; th.combo = 1; I.workT -= dt; if (I.workT <= 0) { var w0 = candidate(function () { return true; }, 3, 50); if (w0) say(w0, pick(L.vandal)); I.st = "flee"; I.fleeAt = I.t; var c2 = chaser(th); if (c2) I.chasers.push(c2); } return; }
    if (I.st === "flee") {
      if (I.delay > 0) { I.delay -= dt; if (I.delay <= 0 && I.victim) { say(I.victim, pick(L[I.kind] || L.snatch)); I.victim.wave = 1.5; if (dist(I.victim, m) < 45) { setTimeout(function () { if (inc === I && I.st === "flee" && I.victim) say(I.victim, pick(L.help)); }, 1200); toast("<b>Thief!</b> Tackle or punch them to stop them, report it on your phone, or keep out of it."); Z.emit && Z.emit({ t: "crimeVictim", kind: I.kind, help: true }); } } }
      else if (I.kind === "shoplift" && !I.shout) { I.shout = 1; var sk = candidate(function () { return true; }, 2, 50); if (sk) say(sk, pick(L.shoplift)); }
      // caught by you: the reactions module put them on the floor, or you simply grabbed them
      if ((th.hits || 0) > th.hits0 || (th.fall > 0 && dist(th, m) < 4)) { end("caught", "you"); return; }
      var live = I.chasers.filter(function (c) { return c && Z.peds.indexOf(c) >= 0; });
      live.forEach(function (c, k) { if (c.fall > 0 || (c.getUpT > 0) || (Z.brawl && Z.brawl.downed(c, 0))) return; var sp = c.vol ? S.FOOT.run * .7 : S.FOOT.run * .82; if (seen(th, [c]) || I.filmed) { c.lx = th.x; c.ly = th.y; } chaseTo(c, c.lx != null ? c.lx : th.x, c.ly != null ? c.ly : th.y, sp, dt); if (!c.yell || c.yell < I.t) { c.yell = I.t + 6 + rnd() * 4; if (dist(c, m) < 30) say(c, pick(L.chase)); }
        if (c.vol && I.t - I.fleeAt > 12) { c.cr = null; c.vol = false; rejoin(c); } });
      if (I.t - I.fleeAt > 2.5 && !(I.delay > 0)) flee(th, dt, live); else th.spd = 0;
      var vc = I.victim; if (vc && Z.peds.indexOf(vc) >= 0 && !(vc.fall > 0)) { if (I.t - I.fleeAt < 9 && dist(vc, th) > 4) chaseTo(vc, th.x, th.y, 2.6, dt); else { vc.spd = (vc.spd || 0) * .85; vc.a += S.angDiff(Math.atan2(th.y - vc.y, th.x - vc.x), vc.a) * Math.min(1, dt * 4); } } /* the victim runs a few steps after them, then can only watch */
      for (var j = 0; j < live.length; j++) if (dist(live[j], th) < 1.4 && !(live[j].fall > 0)) { th.spd = 0; end("caught", live[j].vol ? "bystander" : "security"); return; }
      if (seen(th, live) || I.filmed || (!m.veh && dist(th, m) < 30 && S.los(Z.W, m.x, m.y, th.x, th.y))) I.lastSeen = I.t; /* you on their heels count too */ if ((I.t - I.lastSeen > 7 && I.t - I.fleeAt > 6) || I.t - I.fleeAt > 75 || (live.length && Math.min.apply(null, live.map(function (c) { return dist(c, th); })) > 110)) end("escaped");
    }
  }
  function stepCar(I, dt) { var c = I.car, p = I.chasers[0]; if (!c || Z.traffic.indexOf(c) < 0) { end("escaped"); return; } if (!p || Z.traffic.indexOf(p) < 0) { end("escaped"); return; } var d = dist(c, p); if (d < 6) { I.close = (I.close || 0) + dt; if (I.close > 1.2) { c.v = 0; c.sp = 0; p.v = 0; end("caught", "security"); return; } } else I.close = 0; if (d > 170 || I.t > 80) end("escaped"); }
  function stepQuarrel(I, dt) {
    var a = I.a, b = I.b, m = Z.me; if (I.st === "argue") { if (I.ax == null) I.ax = Math.atan2(b.y - a.y, b.x - a.x); [a, b].forEach(function (n, k) { var o = k ? a : b, sg = k ? 1 : -1, px = I.spot.x + Math.cos(I.ax) * .85 * sg, py = I.spot.y + Math.sin(I.ax) * .85 * sg; if (Math.hypot(px - n.x, py - n.y) > .3) chaseTo(n, px, py, 2.4, dt); else n.spd = (n.spd || 0) * .8; n.a = Math.atan2(o.y - n.y, o.x - n.x); }); /* nose to nose, a step apart */ if (!I.said || I.said < I.t) { I.said = I.t + 2.2; say(rnd() < .5 ? a : b, pick(L.argue)); } if (I.t > 7) { I.st = "fight"; if (Z.brawl) { var gasp = candidate(function (n) { return n !== a && n !== b; }, 2, 40); if (gasp) say(gasp, pick(Z.brawl.SAY.gasp)); } var c3 = chaser(I.spot); if (c3) I.chasers.push(c3); } return; }
    if (I.st === "fight") { [a, b].forEach(function (n, k) { var o = k ? a : b; if (n.fall > 0 || n.getUpT > 0 || n.dustT > 0) return; n.a = Math.atan2(o.y - n.y, o.x - n.x); if (dist(n, o) > 1.3) S.walkTo(Z.W, n, o.x, o.y, 2.5, dt, null, .4); n.cd = (n.cd || rnd()) - dt; if (n.cd <= 0) { n.cd = .9 + rnd() * .9; n.atkT = .26; n.combo = rnd() < .3 ? 2 : 1; if (dist(n, o) < 1.6 && !(o.fall > 0) && !(o.getUpT > 0)) { o.hitT = .35; o.hitA = n.a; if (Z.fx && Z.fx.knock) Z.fx.knock(o, n.a, 3); if (rnd() < .18 && Z.brawl) Z.brawl.down(o, 1.6, n.a, 3, 2.4, false); } } });
      var c = I.chasers[0]; if (c && Z.peds.indexOf(c) >= 0) { chaseTo(c, I.spot.x, I.spot.y, S.FOOT.run * .7, dt); if (dist(c, I.spot) < 4) { say(c, "Break it up! Both of you, go your ways!"); end("settled", "security"); } } if (I.t > 30) end("settled"); }
    void m;
  }
  // traffic hook: thieves on stolen bikes, show-offs and the patrol rider. True = handled.
  C.car = function (t, dt) {
    if (!t.city) return false; var W = Z.W;
    // city cars keep their distance like everyone else: never inside another machine, and the patrol pulls up behind, it does not ram
    for (var j = 0; j < Z.traffic.length; j++) { var o = Z.traffic[j]; if (o === t) continue; var ox = t.x - o.x, oy = t.y - o.y, od = Math.hypot(ox, oy); if (od < 2.4 && od > .01) { t.x += ox / od * (2.4 - od) * .6; t.y += oy / od * (2.4 - od) * .6; t.v *= .6; } }
    if (t.city === "thief" || t.city === "reckless" || t.city === "leave") { var gs = S.gapSpeed(t, t.city === "leave" ? 8 : t.sp, [Z.traffic.filter(function (o) { return o.city !== "patrol"; }), Z.cars]); if (gs < t.v) t.v += (gs - t.v) * (1 - Math.exp(-5 * dt)); }
    if (t.city === "patrol") { var tg0 = inc && inc.car; if (tg0 && Z.traffic.indexOf(tg0) >= 0 && dist(t, tg0) < 5) { t.v *= Math.exp(-6 * dt); t.speed = t.spd = t.v; return true; } }
    if (t.city === "thief" || t.city === "reckless" || t.city === "leave") { var rd = W.roads[t.w.road], lead = Math.hypot(t.w.x - t.x, t.w.y - t.y); t.v += ((t.city === "leave" ? 8 : t.sp) - t.v) * (1 - Math.exp(-2 * dt)); if (lead < 6) S.wanderStep(W, t.w, Math.max(t.v, 3) * dt * (lead < 3 ? 1.8 : 1), Math.random, rd.w * .23); S.carTo(t, t.w.x, t.w.y, t.w.a, dt); t.speed = t.spd; return true; }
    if (t.city === "patrol") { var I = inc, tg = I && I.car; if (!tg || Z.traffic.indexOf(tg) < 0) { t.city = "leave"; return true; } t.rT = (t.rT || 0) - dt; if (!t.rp || t.rT <= 0) { var p = S.route(W, t.x, t.y, tg.x, tg.y, true); t.rp = { p: p && p.length >= 4 ? p : [t.x, t.y, tg.x, tg.y], i: 2 }; t.rT = 1.2; } var pp = t.rp.p; while (t.rp.i < pp.length - 2 && Math.hypot(pp[t.rp.i] - t.x, pp[t.rp.i + 1] - t.y) < 4) t.rp.i += 2; var near2 = dist(t, tg) < 18, gx = near2 || t.rp.i >= pp.length - 2 ? tg.x : pp[t.rp.i], gy = near2 || t.rp.i >= pp.length - 2 ? tg.y : pp[t.rp.i + 1];
      t.v += (t.sp - t.v) * (1 - Math.exp(-2 * dt)); S.carTo(t, gx, gy, Math.atan2(gy - t.y, gx - t.x), dt); var q = S.push(W, t.x, t.y, .6); t.x = q.x; t.y = q.y; t.speed = t.spd; return true; }
    return false;
  };

  /* ---------- gossip ---------- */
  function rumour(I, result, who) {
    if (result === "fizzled") return; var cs = state(), kname = KINDS[I.kind] ? KINDS[I.kind].name : I.kind, r = { id: "r" + I.id + ":" + Z.P.day, about: who === "you" || I.joined ? "you" : "", text: (who === "you" ? pick(L.you) : I.joined ? "They say you were in that wahala at {p}. Is it true?" : pick(L.gossip)).replace("{k}", kname).replace("{p}", I.place), t: Z.api.t };
    rum.push(r); if (rum.length > 8) rum.shift();
    // whoever saw it knows
    Z.peds.forEach(function (n) { if (dist(n, I.thief || I.a || Z.me) < 35) n.rumour = r.id; }); void cs;
  }
  function spread() {
    if (!rum.length) return; var cs = state(), byId = {}; rum.forEach(function (r) { byId[r.id] = r; });
    // in conversation, news travels
    for (var i = 0; i < Z.peds.length; i++) { var a = Z.peds[i]; if (!a.rumour) continue; for (var j = 0; j < Z.peds.length; j++) { var b = Z.peds[j]; if (b.rumour === a.rumour || dist(a, b) > 5) continue; b.rumour = a.rumour; } }
    Z.npcs.forEach(function (f) { if (f.rumour || f.hidden) return; for (var k = 0; k < Z.peds.length; k++) if (Z.peds[k].rumour && dist(Z.peds[k], f) < 8) { f.rumour = Z.peds[k].rumour; break; } if (!f.rumour && f.follow && rum.length) f.rumour = rum[rum.length - 1].id; });
    // and your friends tell you, once each
    Z.npcs.forEach(function (f) { var r = f.rumour && byId[f.rumour]; if (!r || cs.heard[r.id] || dist(f, Z.me) > 7 || (Z.focus && Z.focus.busy())) return; if (Z.friends && !Z.friends.isFriend(f)) return; cs.heard[r.id] = 1; say(f, r.text); });
  }
  C.rumours = function () { return rum.slice(); };

  /* ---------- the director ---------- */
  var spreadT = 0;
  C.tick = function (dt) {
    var P = Z.P; if (!P || Z.mode !== "play") return; spreadT -= dt; if (spreadT <= 0) { spreadT = 3; spread(); }
    if (inc) { step(dt); return; }
    gapT -= dt; if (gapT > 0) return; gapT = 15; if (!allowed()) return;
    var h = P.time / 60, night = h >= 20 || h < 5, pool = [], k; for (k in KINDS) { var w = KINDS[k].w * (night ? KINDS[k].night : 1); if (k === "shoplift" && (h < 8 || h > 21)) w = 0; if (k === "quarrel" && h < 12) w *= .4; pool.push([k, w]); }
    var tot = pool.reduce(function (s, q) { return s + q[1]; }, 0), x = rnd() * tot; for (k = 0; k < pool.length; k++) { x -= pool[k][1]; if (x <= 0) break; }
    var kind = pool[Math.min(k, pool.length - 1)][0]; if (C.start(kind)) gapT = 0; else gapT = 12;
  };
  // Phone → Report: security comes faster and knows where to look.
  C.active = function () { return !!inc && (inc.st === "flee" || inc.st === "run" || inc.st === "fight" || inc.st === "argue" || inc.st === "work" || inc.st === "approach"); };
  C.report = function () { var I = inc; if (!C.active() || I.reported) return false; I.reported = true; var cs = state(); cs.rep += 1; var at = I.thief || I.a || I.car; if (at && Z.peds.indexOf(at) >= 0) { var c = chaser(at); if (c) I.chasers.push(c); } I.filmed = true; toast("<b>Reported.</b> Security is on the way."); sfx("click"); return true; };
  C.incident = function () { return inc; };
  C.marks = function (m) { var I = inc; if (!I || !C.active()) return; var t = I.thief || I.a || I.car; if (t && (I.filmed || I.reported || dist(t, Z.me) < 50)) m.push({ x: t.x, y: t.y, col: "#ef4444", r: 4, pin: true }); };
  C.reset = function () { release(); inc = null; gapT = 70; rum = []; };
  // let everyone in a scene go back to an ordinary day (a held thief is led off out of sight)
  function release() { var I = inc; if (!I) return; [I.thief, I.victim, I.a, I.b].concat(I.chasers || []).forEach(function (n) { if (!n || Z.traffic.indexOf(n) >= 0) { if (n && n.city) { n.city = n.city === "reckless" ? "" : "leave"; if (n.sp0) n.sp = n.sp0; } return; } var held = n.cr === "held" || n.cr === "chaser"; n.cr = null; n.st = ""; n.sit = false; n.film = false; if (held) n.gone = true; else rejoin(n); }); }
  // help for tests: the incident director on a short leash
  C.setGap = function (s) { gapT = s; };
  void agendaT;
})();
