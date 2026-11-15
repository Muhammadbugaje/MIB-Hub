/* Freshers School Life — friends with lives of their own.
   The students you know keep a day: hostel, lectures, food, gardens, the Social Centre, the library, bed. They walk
   the paths to get there, sit, chat in pairs, wave when they spot you. Ask one to walk with you and they stay at
   your shoulder, on foot, on your pillion, in your car or on their own bicycle. Now and then one comes over and
   offers to show you somewhere ("Let's go to …, I'll walk you through"); say yes and they lead the way, waiting if
   you fall behind and pointing things out. After a while they say goodbye and carry on with their own day.
   The game loop calls F.tick(dt) once a frame and F.step(n, dt, dist) for every named person. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData, F = Z.friends = {}, TAU = Math.PI * 2;
  var offer = null, offerT = 75, rnd = Math.random;
  var SLOTS = [[6, "food"], [8, "class"], [11, "class"], [13, "food"], [15, "study"], [17, "garden"], [19, "social"], [21, "study"], [23, "home"]];
  var LINES = {
    food: ["The food at {n} is the truth.", "{n}. My stomach knows this road by heart.", "If you are ever broke, {n} will still sort you out."],
    "class": ["{n}. Do not be late here, they lock the door.", "That is {n}. Sit in front if you want to hear anything.", "{n}. Half of my carry-overs live in there."],
    home: ["{n}. Some of my guys stay there.", "That is {n}. Loud at night, I warn you."],
    garden: ["{n}. Good place to read, or to hide.", "People come to {n} to think. Or to gist.", "{n}. Bring a mat and a book some day."],
    shop: ["{n}. Buy your torch there before the light goes.", "That is {n}, if you need anything."],
    bank: ["{n}. The queue on Friday will humble you."], heal: ["{n}. Pray you never need it."],
    any: ["That is {n}.", "You see {n}? Remember it.", "{n} is just there."]
  };
  var CHAT = ["Did you finish the assignment?", "I never start o.", "That test was wicked.", "Abeg, who has the past questions?", "NEPA took light again last night.", "Are you going to the Social Centre later?", "My pocket money has finished.", "Let us read together tomorrow.", "Did you hear the gist from Shinkafi?", "This sun is not smiling."];
  var BYE = ["I have to go. Later!", "Let me catch up with my own day. See you!", "I am off. Call me!", "That was nice. See you around."];
  var WAIT = ["This way!", "Come now, you dey slack.", "I am waiting o.", "Over here!"];

  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function say(n, t) { try { if (Z.say) Z.say(n, t); } catch (e) {} }
  function aff(n) { var P = Z.P; return (P && P.friends && P.friends[n.id]) || 0; }
  function inView(o, min) { // could the camera be looking at o?
    var m = Z.me, dx = o.x - m.x, dy = o.y - m.y, d = Math.hypot(dx, dy); if (d > 135) return false; if (d < (min || 14)) return true;
    if (!(Z.r3 && Z.r3.ready)) return d < 60; var yw = Z.r3.yaw || 0; return (dx * Math.cos(yw) + dy * Math.sin(yw)) / d > .1;
  }
  F.isFriend = function (n) { var d = n && n.def; return !!d && n.id !== "sly" && !d.temp && !d.retired && d.friend !== false && (!!d.date || d.friend === true || d.at === "@home" || d._homeAt === "@home" || d._homeAt === "@hostel"); }; // students you live and study with (the story may re-home a non-roommate)
  F.companions = function () { return Z.npcs.filter(function (n) { return n.follow; }); };
  F.canJoin = function (n) { var c = F.companions(); if (c.indexOf(n) >= 0 || c.length < 2) return true; say(n, "You already have company. Next time!"); return false; };

  /* ---------- walking a route along the roadside ---------- */
  function path(n, tx, ty, mid) { var rp = S.route(Z.W, n.x, n.y, tx, ty, false); if (!rp || rp.length < 4) rp = [n.x, n.y, tx, ty]; return { p: rp, i: 2, tx: tx, ty: ty, w: null, age: 0, slow: 0, mid: !!mid }; } // mid: keep to the line itself (a follower walks where you walked)
  function waypoint(pa) {
    var p = pa.p, i = pa.i, W = Z.W; if (i >= p.length - 2) return (pa.w = { x: pa.tx, y: pa.ty, last: true });
    var x = p[i], y = p[i + 1], ax = p[i - 2], ay = p[i - 1], bx = p[i + 2], by = p[i + 3], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nr = pa.mid ? null : S.nearRoad(W, x, y, 6), off = nr ? nr.r.w / 2 + 1.1 : 0, q = S.push(W, x - dy / l * off, y + dx / l * off, .45);
    return (pa.w = { x: q.x, y: q.y });
  }
  // One step along the path. far = nobody can see them, so they cover ground quickly and skip the footwork.
  function pathStep(n, pa, speed, dt, far) {
    var w = pa.w || waypoint(pa), d = Math.hypot(w.x - n.x, w.y - n.y), guard = 0;
    while (d < (w.last ? .9 : 1.8) && !w.last && guard++ < 8) { pa.i += 2; w = waypoint(pa); d = Math.hypot(w.x - n.x, w.y - n.y); }
    if (w.last && d < .9) { n.spd = (n.spd || 0) * Math.exp(-10 * dt); return 0; }
    if (far) { var st = Math.min(d, speed * dt); n.a = Math.atan2(w.y - n.y, w.x - n.x); n.x += Math.cos(n.a) * st; n.y += Math.sin(n.a) * st; n.spd = 0; if (S.insideBuilding(Z.W, n.x, n.y)) { var fq = S.push(Z.W, n.x, n.y, .45); n.x = fq.x; n.y = fq.y; } if (st >= d - .01 && !w.last) { pa.i += 2; waypoint(pa); } return st; }
    var mv = S.walkTo(Z.W, n, w.x, w.y, speed, dt, others(n), .42); n.walk += mv * 2.6;
    if (mv < speed * dt * .2) { pa.slow += dt; if (pa.slow > 1) { pa.slow = 0; if (!w.last) { pa.i += 2; waypoint(pa); } else { var q = S.push(Z.W, n.x + (rnd() - .5) * 3, n.y + (rnd() - .5) * 3, .45); n.x += (q.x - n.x) * .2; n.y += (q.y - n.y) * .2; } } } else pa.slow = 0;
    return mv;
  }
  function others(n) { var o = n.oth; if (!o || o.t !== Z.api.t) { o = n.oth = { t: Z.api.t, l: Z.npcs.concat(Z.me.veh ? [] : [Z.me], Z.traffic || []) }; } return o.l; }
  // Head for a moving point: straight there when the way is clear, otherwise round by the paths.
  function chase(n, tx, ty, speed, dt) {
    var W = Z.W, d = Math.hypot(tx - n.x, ty - n.y);
    if (d < 22 && S.los(W, n.x, n.y, tx, ty)) { n.cp = null; var mv = S.walkTo(W, n, tx, ty, speed, dt, others(n), .42); n.walk += mv * 2.6;
      if (mv < speed * dt * .2 && d > 2) { n.jam = (n.jam || 0) + dt; if (n.jam > .8) { n.jam = 0; n.cp = path(n, tx, ty, true); n.cpHold = 2; } } else n.jam = 0; return mv; }
    if (!n.cp || (n.cp.age += dt) > 1.6 && !(n.cpHold > 0) || Math.hypot(n.cp.tx - tx, n.cp.ty - ty) > 12) n.cp = path(n, tx, ty, true);
    if (n.cpHold > 0) n.cpHold -= dt; return pathStep(n, n.cp, speed, dt, false);
  }
  function face(n, x, y, dt) { n.a += S.angDiff(Math.atan2(y - n.y, x - n.x), n.a) * Math.min(1, dt * 5); n.spd = (n.spd || 0) * Math.exp(-10 * dt); }
  function catchUp(k) { // a free spot 12–20 m from you, behind the camera or behind a wall
    var m = Z.me, W = Z.W, yw = Z.r3 && Z.r3.ready ? Z.r3.yaw || 0 : m.a; for (var t = 0; t < 14; t++) { var a = yw + Math.PI + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * .35, r = 12 + (t % 3) * 4, q = S.push(W, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, .45);
      if (S.insideBuilding(W, q.x, q.y) || S.inWater(W, q.x, q.y) || (Z.brawl && Z.brawl.onRoad(q.x, q.y))) continue; if (!inView(q, 9) || !S.los(W, m.x, m.y, q.x, q.y)) return q; }
    return null;
  }
  function behind(k) { var m = Z.me, a = m.veh ? m.veh.a : m.a, sd = k ? -1.1 : 1.1, q = S.push(Z.W, m.x - Math.cos(a) * 2.1 + Math.cos(a + 1.5708) * sd, m.y - Math.sin(a) * 2.1 + Math.sin(a + 1.5708) * sd, .45); return q; }

  /* ---------- where the day takes them ---------- */
  function slotOf(time) { var h = time / 60, k = SLOTS.length - 1; for (var i = 0; i < SLOTS.length; i++) if (h >= SLOTS[i][0]) k = i; if (h < SLOTS[0][0]) k = SLOTS.length - 1; return k; }
  function kindOf(p) { var nm = (p.name + " " + p.id).toLowerCase(); return /garden|dam|lake|park/.test(nm) ? "garden" : /social|court|shinkafi/.test(p.id) ? "social" : /library/.test(p.id) ? "study" : p.role === "class" ? "class" : p.role === "food" ? "food" : p.role === "home" ? "home" : p.role || "any"; }
  function choose(n, kind, salt) {
    var P = Z.P, list = Z.placeList.filter(function (p) { var k = kindOf(p); return kind === "study" ? k === "study" || k === "class" : kind === "social" ? k === "social" || k === "food" : k === kind; });
    if (kind === "home") { var h = n.def.at === "@home" ? Z.place("@home") : null; if (h) return h; list = Z.placeList.filter(function (p) { return p.role === "home"; }); return list[Math.floor(S.hash(n.k, 3) * list.length)] || Z.place(n.def.at); }
    if (kind === "study") { var lib = Z.placeList.filter(function (p) { return kindOf(p) === "study"; }); if (lib.length && S.hash(n.k + salt, P.day) < .6) list = lib; }
    if (kind === "social") { var so = Z.placeList.filter(function (p) { return kindOf(p) === "social"; }); if (so.length && S.hash(n.k + salt, P.day + 1) < .7) list = so; }
    if (!list.length) return Z.place(n.def.at) || Z.placeList[0];
    var campus = list.filter(function (p) { return !Z.W.designed || p.my > Z.W.townY - 5; }); if (campus.length) list = campus; // stay on campus when you can
    list.sort(function (a, b) { return Math.hypot(a.mx - n.x, a.my - n.y) - Math.hypot(b.mx - n.x, b.my - n.y); });
    var top = list.slice(0, Math.min(4, list.length)); return top[Math.floor(S.hash(n.k * 7 + salt, P.day * 3 + 1) * top.length)];
  }
  function spot(n, pl, salt) { // somewhere to stand near the place, off the carriageway
    for (var tr = 0; tr < 6; tr++) { var a = S.hash(n.k + 11 + tr, salt) * TAU, r = 3 + S.hash(n.k + 5, salt + tr) * 3.5, q = S.push(Z.W, pl.mx + Math.cos(a) * r, pl.my + Math.sin(a) * r, .5); if (!(Z.brawl && Z.brawl.onRoad(q.x, q.y))) return q; }
    var nr = S.nearRoad(Z.W, pl.mx, pl.my, 30), ox = nr ? pl.mx - nr.x : 0, oy = nr ? pl.my - nr.y : 1, ol = Math.hypot(ox, oy) || 1; return S.push(Z.W, pl.mx + ox / ol * 4, pl.my + oy / ol * 4, .5);
  }
  function routine(n, dt, dd) {
    var P = Z.P, st = Z.step && Z.step(), need = st && st.npc === n.id, own = !need && Z.npcRoutine ? Z.npcRoutine(n, P.time) : null, k = need ? -1 : slotOf(P.time), key = need ? "m" : own ? P.day * 10 + 1000 + own.i : P.day * 10 + k, rt = n.rt; // own: a day set in Arcade Management (samaru-overrides.js)
    if (!rt || rt.key !== key) {
      var kind = need ? "post" : own ? "any" : SLOTS[k][1], pl = need ? null : own ? own.place : choose(n, kind, k), q = need ? { x: n.hx, y: n.hy } : spot(n, pl, key);
      rt = n.rt = { key: key, kind: kind, place: pl ? pl.id : n.def.at, tx: q.x, ty: q.y, pa: null, there: false, talk: 4 + rnd() * 8, greet: false };
      if (n.fresh) { n.fresh = false; if (!need && !inView(q, 30)) { n.x = q.x; n.y = q.y; rt.there = true; } } // a new day or a loaded game: already where the hour puts them
    }
    if (!rt.there) {
      var d = Math.hypot(rt.tx - n.x, rt.ty - n.y); if (d < 1.2) { rt.there = true; return; }
      if (!rt.pa) rt.pa = path(n, rt.tx, rt.ty);
      var far = dd > 140 && !inView(n); pathStep(n, rt.pa, far ? (dd > 400 ? 80 : 40) : (n.def.walk ? n.def.walk * .95 : 2.7 + S.hash(n.k, 2) * .6), dt, far); return;
    }
    // arrived: live a little
    var m = Z.me, h = P.time / 60;
    if (dd < 8 && !rt.greet && aff(n) >= 10 && !m.veh) { rt.greet = true; n.wave = 1.6; if (dd < 6) say(n, pick(n.def.hi || ["How far?"])); }
    if (dd < 5 && !m.veh) { face(n, m.x, m.y, dt); return; }
    var mate = null; for (var i = 0; i < Z.npcs.length; i++) { var o = Z.npcs[i]; if (o !== n && o.rt && o.rt.there && !o.follow && !o.lead && Math.hypot(o.x - n.x, o.y - n.y) < 9 && F.isFriend(o)) { mate = o; break; } }
    if (mate) { face(n, mate.x, mate.y, dt); rt.talk -= dt; if (rt.talk <= 0) { rt.talk = 9 + rnd() * 10; if (dd < 16 && !Z.api.overlayOpen()) say(n, pick(CHAT)); } }
    else if (rt.kind === "social" && h >= 19 && S.hash(n.k, P.day) < .6) n.dance = true;
    else if (rt.kind === "food" || rt.kind === "garden" || rt.kind === "study" || rt.kind === "home") n.sit = true;
    n.spd = 0;
  }

  /* ---------- walking with you ---------- */
  F.follow = function (n, secs) { if (!F.canJoin(n)) return false; n.follow = true; n.lead = null; n.coming = false; n.ft = secs || 300 + S.hash(n.k, Z.P.day + Math.floor(Z.P.time)) * 600; n.t0 = 0; return true; };
  F.release = function (n, line) { if (line) say(n, line); n.follow = false; n.lead = null; n.coming = false; n.riding = false; n.onBike = false; n.rt = null; if (n.bike) n.bike.speed = 0; if (Z.date && Z.date.npc === n) Z.date = null; };
  function ownBike(n, k, dt, dd) {
    var m = Z.me, v = m.veh, b = n.bike; if (b && Z.cars.indexOf(b) < 0) b = n.bike = null;
    if (b && !n.onBike && Math.hypot(b.x - n.x, b.y - n.y) > 8) { var bi = Z.cars.indexOf(b); if (bi >= 0 && Z.me.veh !== b) Z.cars.splice(bi, 1); b = n.bike = null; } /* an old bike left somewhere else: fetch a fresh one here */
    if (!b) { var q = S.push(Z.W, n.x, n.y, .6); b = n.bike = { id: Z.cars.length, type: "bike", x: q.x, y: q.y, a: n.a, vx: 0, vy: 0, speed: 0, v: 0, col: "#f472b6", hx: q.x, hy: q.y, ha: n.a, free: true, owner: n.id }; Z.cars.push(b); }
    if (!n.onBike) { if (Math.hypot(b.x - n.x, b.y - n.y) > 2.5 && Math.hypot(b.x - n.x, b.y - n.y) < 60) { chase(n, b.x, b.y, S.FOOT.run, dt); return; } n.onBike = true; b.x = n.x; b.y = n.y; b.a = n.a; b.v = 0; }
    var a = v.a, tx = v.x - Math.cos(a) * 4.5 + Math.cos(a + 1.5708) * (k ? -1.4 : 1.4), ty = v.y - Math.sin(a) * 4.5 + Math.sin(a + 1.5708) * (k ? -1.4 : 1.4), d = Math.hypot(tx - b.x, ty - b.y), top = (S.VEH.bike.max || 9) * 1.25, want = d < 1 ? 0 : clamp(Math.max(Math.abs(v.speed) * 1.1, 3) * (d > 8 ? 1.4 : 1), 0, top);
    b.v += (want - b.v) * (1 - Math.exp(-3 * dt));
    if (d > 26 || !S.los(Z.W, b.x, b.y, tx, ty)) { if (!n.bp || (n.bp.age += dt) > 1.5) n.bp = path(b, tx, ty); var w = n.bp.w || waypoint(n.bp); while (!w.last && Math.hypot(w.x - b.x, w.y - b.y) < 3) { n.bp.i += 2; w = waypoint(n.bp); } tx = w.x; ty = w.y; }
    S.carTo(b, tx, ty, a, dt); var p = S.push(Z.W, b.x, b.y, .5); b.x = p.x; b.y = p.y; b.speed = b.spd || 0; b.vx = Math.cos(b.a) * b.speed; b.vy = Math.sin(b.a) * b.speed;
    n.x = b.x; n.y = b.y; n.a = b.a; n.rideV = b; n.spd = 0;
    if (dd > 120 && !inView(n)) { var q2 = S.nearRoad(Z.W, v.x - Math.cos(a) * 30, v.y - Math.sin(a) * 30, 80); if (q2 && !inView(q2, 22)) { b.x = n.x = q2.x; b.y = n.y = q2.y; b.a = a; n.bp = null; } }
  }
  function follow(n, dt, dd) {
    var m = Z.me, P = Z.P, W = Z.W, k = F.companions().indexOf(n), h = P.time / 60, v = m.veh;
    n.ft -= dt; n.t0 = (n.t0 || 0) + dt;
    if (n.ft <= 0 && !(Z.date && Z.date.npc === n)) { F.release(n, (h >= 23 || h < 5) ? "It is late. I am going to sleep." : pick(BYE)); return; }
    if (v) {
      var type = v.type, slots = Z.veh && Z.veh.seats ? Z.veh.seats(v) : [], seats = slots.length; // samaru-veh.js seats: car 3, keke 3, okada 2, scooter 1, bicycle 0
      if (type === "plane" || m.alt > .05) { F.release(n, "I do not fly o. Catch you later!"); return; }
      var taken = function (q) { return Z.npcs.some(function (o) { return o !== n && o.rideV === v && o.seatI === q; }); }; // never a seat someone is already in: take the first free one
      var si = -1; if (n.riding && n.rideV === v && n.seatI != null && !taken(n.seatI)) si = n.seatI; else if (k < seats) for (var q = k; q < seats + k && si < 0; q++) if (!taken(q % seats)) si = q % seats; // their own seat first, else the next free one
      if (si >= 0 && seats > 0) {
        if (!n.riding && v.shuttle) { n.riding = true; n.boardT = 0; } // a paid ride: they got on with you at the stop
        if (!n.riding) { var dp = Z.veh.door(v, si), dg = dp ? Math.hypot(dp.x - n.x, dp.y - n.y) : 0;
          if (dg > 1.2 && dd > 2 && dd < 45 && Math.abs(v.speed || 0) < 2.5) { n.onBike = false; n.hidden = false; n.rideV = null; n.seatAnc = null; chase(n, dp.x, dp.y, dg > 5 ? S.FOOT.run : S.FOOT.walk + .6, dt); return; } // walk or run to their door
          if (dg <= 1.2 || dd <= 2) { n.riding = true; n.boardT = 0; } } // n.boardT: seconds since they started climbing in (for the animation)
        if (n.riding) { n.boardT = (n.boardT || 0) + dt; n.onBike = false; n.hidden = false; n.rideV = v; n.seatAnc = slots[si]; n.seatI = si; n.x = v.x; n.y = v.y; n.a = v.a; n.spd = 0; return; }
      }
      // no seat for them (a bicycle or skateboard, a full machine, or you drove off before they reached it): on foot
      if (n.riding) { n.riding = false; n.rideV = null; n.seatAnc = null; }
    }
    if (n.riding || n.onBike) { var side = k ? -1 : 1, q = S.push(W, n.x + Math.cos(m.a + 1.5708 * side) * (n.riding ? 1.4 : .9), n.y + Math.sin(m.a + 1.5708 * side) * (n.riding ? 1.4 : .9), .45); n.x = q.x; n.y = q.y; n.riding = false; n.onBike = false; n.rideV = null; n.seatAnc = null; n.boardT = 0; if (n.bike) { n.bike.speed = n.bike.v = 0; n.bike.vx = n.bike.vy = 0; } n.cp = null; }
    var t = behind(k), d2 = Math.hypot(t.x - n.x, t.y - n.y), ms = m.speed || 0;
    if (dd < .75 && !m.veh) { var aw = Math.atan2(n.y - m.y, n.x - m.x) || 1; n.walk += S.walkTo(Z.W, n, n.x + Math.cos(aw) * 1.6, n.y + Math.sin(aw) * 1.6, 3, dt, null, .42) * 2.6; return; } // you walked into them: they step out of your way
    if (d2 < .7 || (ms < .3 && dd < 3.2)) { if (ms < .3) face(n, m.x + Math.cos(m.a) * 4, m.y + Math.sin(m.a) * 4, dt); else n.spd = (n.spd || 0) * Math.exp(-8 * dt); }
    else chase(n, t.x, t.y, clamp(ms * 1.02 + (d2 - .4) * 1.5, 1.5, S.FOOT.run * 1.15), dt); // match your pace, and hurry in proportion to the gap
    // hopelessly behind and out of sight: catch up off-screen
    // hopelessly behind (you ran, rode or travelled on): they catch up somewhere you are not looking, then walk the last bit
    if (dd > 38) { n.far = (n.far || 0) + dt; if (n.far > 3 || dd > 110) { var cp = catchUp(k); if (cp) { n.x = cp.x; n.y = cp.y; n.a = Math.atan2(m.y - cp.y, m.x - cp.x); n.far = 0; n.cp = null; } } } else n.far = 0;
  }

  /* ---------- showing you the way ---------- */
  F.lead = function (n, placeId, why) {
    var pl = Z.place(placeId); if (!pl || !F.canJoin(n)) return false; var q = S.push(Z.W, pl.mx, pl.my, .5);
    n.follow = false; n.coming = false; n.lead = { place: pl.id, name: pl.name, pa: path(n, q.x, q.y), said: {}, wait: 0, gone: 0, scan: 0, why: why || "" }; n.riding = n.onBike = false;
    say(n, "Follow me. " + pl.name + " is this way."); if (Z.toast) Z.toast("<b>" + n.def.name + "</b> is taking you to <b>" + pl.name + "</b>. Stay close."); return true;
  };
  function lead(n, dt, dd) {
    var L = n.lead, m = Z.me, pl = Z.place(L.place), dEnd = Math.hypot(pl.mx - n.x, pl.my - n.y);
    if (dEnd < 5 || (L.pa.w && L.pa.w.last && Math.hypot(L.pa.tx - n.x, L.pa.ty - n.y) < 1.5)) {
      if (dd < 10) { say(n, pick(["Here we are: " + pl.name + ".", "This is " + pl.name + ". You will not get lost again.", pl.name + ". Told you it was close."])); S.bond(Z.P, n.id, 3); if (Z.xp) Z.xp(5); var id = L.place; n.lead = null; F.follow(n, 80); n.after = id; Z.emit({ t: "lead", place: id, npc: n.id }); return; }
      face(n, m.x, m.y, dt); nag(n, L, dt); return; }
    if (m.veh) { face(n, m.x, m.y, dt); if (!L.park) { L.park = 1; say(n, "Park that thing. We are walking."); } return; }
    if (dd > 15) { face(n, m.x, m.y, dt); nag(n, L, dt); L.gone += dt; if (L.gone > 50) F.release(n, "I will go ahead. Find me later!"); return; }
    L.gone = 0; L.wait = Math.min(L.wait, 3);
    var ahead = (n.x - m.x) * Math.cos(m.a) + (n.y - m.y) * Math.sin(m.a), sp = clamp(Math.max(m.speed || 0, S.FOOT.walk * .85) * (dd < 4 ? 1.2 : dd > 9 && ahead > 0 ? .55 : 1), 1.4, S.FOOT.run * 1.08);
    pathStep(n, L.pa, sp, dt, false);
    L.scan -= dt; if (L.scan <= 0) { L.scan = .8; for (var i = 0; i < Z.placeList.length; i++) { var p = Z.placeList[i]; if (p.id === L.place || L.said[p.id] || Math.hypot(p.mx - n.x, p.my - n.y) > 24) continue; L.said[p.id] = 1; if (dd < 14 && (L.quiet || 0) < Z.api.t) { L.quiet = Z.api.t + 7; var k = kindOf(p), ls = LINES[k] || LINES.any; say(n, pick(ls).replace("{n}", p.name)); } break; } }
  }
  function nag(n, L, dt) { L.wait += dt; if (L.wait > 6) { L.wait = 0; say(n, pick(WAIT)); n.wave = 1.2; } }

  /* ---------- coming when you call ---------- */
  F.call = function (n) { if (!F.canJoin(n)) return false; n.lead = null; n.follow = false; n.coming = { far: Math.hypot(n.x - Z.me.x, n.y - Z.me.y) > 250, t: 0 }; n.cp = null; say(n, pick(["I dey come!", "Give me a moment.", "On my way."])); return true; };
  function coming(n, dt, dd) {
    var m = Z.me, c = n.coming; c.t += dt;
    if (dd < 4) { var far = c.far; n.coming = false; if (offer && offer.n === n) { ask(); return; } F.follow(n); say(n, far ? "I took a keke. You owe me ₦100!" : pick(["I'm here. Where are we going?", "Oya, let's go.", "You called?"])); return; }
    // taking too long (a blocked path, the far side of campus): the keke drops them round the corner, out of your sight
    if (c.t > 35 && dd > 62 && !inView(n) && !c.dropped) { for (var tr = 0; tr < 12; tr++) { var q = S.randomRoadPoint(Z.W, rnd, false, m, 95); if (q && Math.hypot(q.x - m.x, q.y - m.y) > 62 && !inView(q) && !S.insideBuilding(Z.W, q.x, q.y)) { n.x = q.x; n.y = q.y; n.cp = null; c.dropped = 1; c.far = true; break; } } }
    if (dd > 120 && !inView(n)) { if (!n.cp || (n.cp.age += dt) > 2) n.cp = path(n, m.x, m.y); pathStep(n, n.cp, 13, dt, true); } // far away: they flag down a keke
    else chase(n, m.x, m.y, dd > 12 ? S.FOOT.run : S.FOOT.walk, dt);
    if (c.t > 150) { n.coming = false; if (offer && offer.n === n) offer = null; }
  }

  /* ---------- "let's go to …" ---------- */
  function nearest(kind, minD) { var m = Z.me, best = null, bd = 1e9; Z.placeList.forEach(function (p) { if (kindOf(p) !== kind) return; var d = Math.hypot(p.mx - m.x, p.my - m.y); if (d > (minD || 0) && d < bd) { bd = d; best = p; } }); return best; }
  F.idea = function () { // what would a friend suggest right now?
    var P = Z.P, h = P.time / 60, m = Z.me, L = null, p = null, why = "";
    try { L = Z.life && Z.life.next && Z.life.next(); } catch (e) { L = null; }
    if (L && L.place && Z.place(L.place) && L.start != null && L.start - P.time < 50 && L.start - P.time > -10) { p = Z.place(L.place); why = (L.label || "The lecture") + " starts soon"; }
    else if (P.hunger < 45) { p = nearest("food", 25); why = "You look hungry"; }
    else if (h >= 13 && h < 14 && Z.places.mosque && S.hash(P.day, 5) < .5) { p = Z.places.mosque; why = "It is prayer time"; }
    else if (h >= 16 && h < 21) { p = nearest("social", 40); why = "Everybody is there this evening"; }
    else if (h >= 8 && h < 16 && S.hash(P.day, Math.floor(h)) < .5) { p = nearest("study", 40) || nearest("class", 40); why = "Let us get some reading done"; }
    else { p = nearest("garden", 40); why = "It is nice out"; }
    if (!p || Math.hypot(p.mx - m.x, p.my - m.y) < 35) return null; return { place: p.id, name: p.name, why: why };
  };
  function quiet() { var P = Z.P, m = Z.me, st = Z.step && Z.step(); return Z.mode === "play" && P && (!Z.focus || Z.focus.allow("friend-offer")) && !Z.api.overlayOpen() && !m.veh && !m.fall && !(Z.foes && Z.foes.length) && !(P.sec && P.sec.state) && !Z.race && !(Z.momentBusy && Z.momentBusy()) && !(Z.bigOpen && Z.bigOpen()) && !(st && st.t === "fight") && !(Z.guide && Z.guide.active && Z.guide.active()) && !Z.date; }
  function ask() { var o = offer; o.st = "ask"; o.t = 0; say(o.n, "Let's go to " + o.name + ". I'll walk you through."); var key = ""; try { key = Z.api.keyName("act"); } catch (e) {} if (Z.toast) Z.toast("<b>" + o.n.def.name + ":</b> " + o.why + ". Let's go to <b>" + o.name + "</b>. Press <b>" + (key || "E") + "</b> beside them to go along."); o.n.wave = 1.4; }
  F.tick = function (dt) {
    if (!Z.P || Z.mode !== "play") return; var m = Z.me;
    if (offer) { var o = offer, n = o.n, d = Math.hypot(n.x - m.x, n.y - m.y); o.t += dt;
      if (!quiet() || n.follow || n.lead) { n.coming = false; offer = null; offerT = 120; return; }
      if (o.st === "ask" && o.t > 11) { say(n, pick(["No wahala. Later!", "Another time then.", "Okay o. See you."])); n.rt = null; offer = null; offerT = 200 + rnd() * 140; }
      else if (o.st === "come" && !n.coming) { offer = null; offerT = 90; }
      return; }
    offerT -= dt; if (offerT > 0) return; offerT = 12;
    if (!quiet() || F.companions().length || Z.npcs.some(function (q) { return q.lead || q.coming; })) return;
    var idea = F.idea(); if (!idea) { offerT = 40; return; }
    var best = null, bs = -1; Z.npcs.forEach(function (q) { if (!F.isFriend(q)) return; var a = aff(q), d = Math.hypot(q.x - m.x, q.y - m.y), st = Z.step && Z.step(); if (st && st.npc === q.id) return; if (d < 70 && a >= 5 || a >= 20 && d < 900) { var sc = a + (d < 70 ? 60 : 0) - d * .05; if (sc > bs) { bs = sc; best = q; } } });
    if (!best) { offerT = 45; return; }
    offer = { n: best, place: idea.place, name: idea.name, why: idea.why, st: "come", t: 0 }; best.coming = { far: Math.hypot(best.x - m.x, best.y - m.y) > 250, t: 0, offer: true }; best.cp = null;
  };
  // E beside a friend who has just offered: go along. Returns true when it used the press.
  F.act = function () { var o = offer; if (!o || o.st !== "ask" || Math.hypot(o.n.x - Z.me.x, o.n.y - Z.me.y) > 7) return false; offer = null; offerT = 260 + rnd() * 160; F.lead(o.n, o.place, o.why); return true; };
  F.offer = function () { return offer; };
  F.soon = function (s) { offerT = s || 0; }; // bring the next offer forward
  // Where is this friend's day taking them? Builds the routine on first ask, for anyone (late-loaded people too).
  F.ensure = function (n) { if (!n || !F.isFriend(n) || !Z.P) return null; if (!n.rt) { try { routine(n, 0, Math.hypot(n.x - Z.me.x, n.y - Z.me.y)); } catch (e) {} } return n.rt || null; };
  // Where is this friend's day taking them? Builds the routine on first ask, for anyone (late-loaded people too).
  F.ensure = function (n) { if (!n || !F.isFriend(n) || !Z.P) return null; if (!n.rt) { try { routine(n, 0, Math.hypot(n.x - Z.me.x, n.y - Z.me.y)); } catch (e) {} } return n.rt || null; };
  F.reset = function () { offer = null; offerT = 75; Z.npcs.forEach(function (n) { n.rt = null; n.lead = null; n.coming = false; n.riding = n.onBike = false; n.bike = null; n.fresh = true; n.cp = null; }); };

  /* ---------- the game loop's hook ---------- */
  // Returns true when this module moved the person this frame (the old stand-at-your-post code is skipped).
  F.step = function (n, dt, dd) {
    if (!F.isFriend(n) && !n.follow && !n.lead && !n.coming) return false;
    if (Z.P && n.day !== Z.P.day) { if (n.day == null) n.fresh = true; n.day = Z.P.day; }
    // you are indoors: whoever came in with you belongs to the interiors code; nobody else is pulled into the room
    if (Z.inside) { if (n.y > 3000) return true; var door = Z.inside.out; if ((n.follow || n.lead || n.coming) && door) { var dd2 = Math.hypot(door.x - n.x, door.y - n.y); if (dd2 > 3) chase(n, door.x + 1.5, door.y + 1.5, S.FOOT.walk, dt); else face(n, door.x, door.y, dt); n.sit = false; return true; } }
    n.sit = false; n.dance = false; n.rideV = null;
    if (!Z.me.veh && !n.riding && !n.onBike && dd < .6) { var aw0 = Math.atan2(n.y - Z.me.y, n.x - Z.me.x) || 1; n.walk += S.walkTo(Z.W, n, n.x + Math.cos(aw0) * 1.6, n.y + Math.sin(aw0) * 1.6, 3.2, dt, null, .42) * 2.6; return true; } /* nobody stands inside you */
    if (offer && offer.n === n && offer.st === "ask") { face(n, Z.me.x, Z.me.y, dt); return true; }
    if (n.lead) lead(n, dt, dd); else if (n.follow) follow(n, dt, dd); else if (n.coming) coming(n, dt, dd); else routine(n, dt, dd);
    return true;
  };

  /* ---------- menus (the talk screen and the phone ask these) ---------- */
  F.items = function (n, items) { if (!F.isFriend(n) && !n.follow) return; var a = aff(n); items.push({ label: n.lead ? "Stop leading me" : "Lead me to…", sub: a >= 10 ? "They walk ahead and show you the way" : "Needs a little friendship first (10). You are at " + Math.round(a), act: "f_lead", off: a < 10 && !n.lead }); };
  F.places = function () { var m = Z.me, order = { "class": 0, study: 1, food: 2, social: 3, garden: 4, home: 5 }; return Z.placeList.filter(function (p) { return Math.hypot(p.mx - m.x, p.my - m.y) > 30; }).map(function (p) { var d = Math.hypot(p.mx - m.x, p.my - m.y); return { label: p.name, sub: (d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d / 10) * 10 + " m") + " away", id: p.id, k: order[kindOf(p)] == null ? 9 : order[kindOf(p)], d: d }; }).sort(function (a, b) { return a.k - b.k || a.d - b.d; }).slice(0, 14); };
  void D;
})();
