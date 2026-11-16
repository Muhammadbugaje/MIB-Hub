/* Freshers School Life — the wild beyond the fence, and the patrol that sends you back.
   The ground outside the school is S.wildH (samaru-sim.js): endless, seeded, never stored. This file turns it into
   something to look at: one merged terrain mesh per chunk (hills, stream beds, boulders, baobab trunks, farm huts,
   cattle, grass and flowers, the perimeter fence) plus two instanced meshes for trees (trunks and crowns). Chunks are
   built and dropped by the engine's own streaming, so there is nothing to keep.
   Patrol: about 400 m out a pickup radios "go back to school"; a second warning follows; then it gives chase and
   takes you back to the gate, or, if you were stubborn about it, you wake up in the Sick Bay. The patrol gets faster
   the deeper you go, so the wild has no wall but does have an edge. Security heat is not touched.
   Nothing runs at load time except attaching Z.wild and wrapping update and draw, so it also runs headless. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim;
  if (!Z || !S) return;
  var Wd = Z.wild = { st: null }, TAU = Math.PI * 2;
  var RULES = S.RULES || (S.RULES = {});
  if (RULES.wildWarn == null) RULES.wildWarn = 400;     // metres past the fence before the first warning
  if (RULES.wildLimit == null) RULES.wildLimit = 1500;  // metres at which the patrol simply has you
  if (RULES.wildFine == null) RULES.wildFine = 150;     // naira, when you are driven back to the gate
  if (RULES.wildPatience == null) RULES.wildPatience = 22; // seconds between the warnings, and before the chase
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function free() { var P = Z.P; return !!(P && (P.god || P.char === S.HERO_ID)); } // the maker roams where he likes

  /* ---------- terrain chunk: called by the engine's chunk builder ---------- */
  var mat = null;
  Wd.chunk = function (T, cx, cy, CH, ctx) {
    var W = Z.W, x0 = cx * CH, y0 = cy * CH, N = 16, st = CH / N, i, j, any = false, low = ctx.R && ctx.R.quality === "low";
    for (i = 0; i <= 4 && !any; i++) for (j = 0; j <= 4; j++) if (S.wildD(W, x0 + i * CH / 4, y0 + j * CH / 4) > 0) { any = true; break; }
    if (!any) return null;
    var H = [], D = [], pos = [], col = [], g = new T.Group();
    for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) { var px = x0 + i * st, py = y0 + j * st; D.push(S.wildD(W, px, py)); H.push(S.wildH(W, px, py)); }
    function tri(ax, ay, az, bx, by, bz, qx, qy, qz, r, gg, b) { pos.push(ax, ay, az, bx, by, bz, qx, qy, qz); col.push(r, gg, b, r, gg, b, r, gg, b); }
    function quad(a, b, c, d, r, gg, bl) { tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], r, gg, bl); tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], r, gg, bl); }
    // an upright box, turned by rot, with its base at height y (top can be narrower: taper)
    function box(x, y, z, w, h, d, rot, r, gg, b, taper) {
      var c = Math.cos(rot || 0), s = Math.sin(rot || 0), t = taper == null ? 1 : taper, P = [], k;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) { var lx = q[0] * w / 2, lz = q[1] * d / 2; P.push([x + lx * c - lz * s, y, z + lx * s + lz * c], [x + lx * t * c - lz * t * s, y + h, z + lx * t * s + lz * t * c]); });
      for (k = 0; k < 4; k++) { var n = (k + 1) % 4, sh = .82 + (k % 2) * .12; quad(P[k * 2], P[k * 2 + 1], P[n * 2 + 1], P[n * 2], r * sh, gg * sh, b * sh); }
      quad(P[1], P[7], P[5], P[3], r, gg, b);
    }
    function hAt(x, z) { return S.wildH(W, x, z) - .03; }
    // ground
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var a = j * (N + 1) + i, b2 = a + 1, c2 = a + N + 1, d2 = c2 + 1; if (!D[a] && !D[b2] && !D[c2] && !D[d2]) continue;
      var mx = x0 + (i + .5) * st, my = y0 + (j + .5) * st, bi = S.biome(W, mx, my), hm = (H[a] + H[b2] + H[c2] + H[d2]) / 4, slope = (Math.max(H[a], H[b2], H[c2], H[d2]) - Math.min(H[a], H[b2], H[c2], H[d2])) / st;
      var r = .50 + .06 * (1 - bi.forest), gg = .68 - .1 * bi.forest, bl = .28; r -= bi.forest * .24; bl -= bi.forest * .05;       // savanna gold-green → forest green
      r += (.5 - r) * bi.rocky * .7; gg += (.5 - gg) * bi.rocky * .7; bl += (.42 - bl) * bi.rocky * .7;                              // rocky hills: stone
      var up = Math.min(1, hm / 80); r += up * .08; gg += up * .06; bl += up * .05;
      if (slope > .55) { var k2 = Math.min(1, (slope - .55) / .4); r += (.52 - r) * k2; gg += (.5 - gg) * k2; bl += (.46 - bl) * k2; }
      if (bi.river > .25) { var kr = Math.min(1, (bi.river - .25) / .5); r += (.3 - r) * kr; gg += (.62 - gg) * kr; bl += (.3 - bl) * kr; }      // lush banks
      if (bi.river > .97 && Math.min(D[a], D[d2]) > 40) { r = .13; gg = .4; bl = .72; }                                                    // the stream itself
      var n1 = (S.wildHash(cx * N + i, cy * N + j, 5) - .5) * .06; r += n1; gg += n1; bl += n1 * .5; if (!(bi.river > .97 && Math.min(D[a], D[d2]) > 40)) { r *= .55; gg *= .66; bl *= .5; } // the sun is strong: keep the grass deep
      var A = [x0 + i * st, H[a] - .03, y0 + j * st], B = [x0 + (i + 1) * st, H[b2] - .03, y0 + j * st], C = [x0 + i * st, H[c2] - .03, y0 + (j + 1) * st], E = [x0 + (i + 1) * st, H[d2] - .03, y0 + (j + 1) * st];
      tri(A[0], A[1], A[2], C[0], C[1], C[2], B[0], B[1], B[2], r, gg, bl); tri(B[0], B[1], B[2], C[0], C[1], C[2], E[0], E[1], E[2], r * .97, gg * .97, bl * .97);
    }
    // boulders, baobab trunks and farm huts: the same list the collision uses
    var things = [], cs = 40; for (i = 0; i < CH / cs; i++) for (j = 0; j < CH / cs; j++) S.wildCell(W, Math.floor(x0 / cs) + i, Math.floor(y0 / cs) + j, things);
    var trees = [];
    things.forEach(function (o) {
      var y = hAt(o.x, o.y) - .2, rot = o.s * TAU;
      if (o.k === "rock") { var gr = .44 + o.s * .12; box(o.x, y, o.y, o.r * 2, o.r * (1 + o.s * .8), o.r * 1.8, rot, gr, gr * .98, gr * .93, .62); box(o.x + Math.cos(rot) * o.r * .7, y, o.y + Math.sin(rot) * o.r * .7, o.r * 1.1, o.r * .7, o.r, rot + 1, gr * .9, gr * .88, gr * .84, .6); }
      else if (o.k === "baobab") { box(o.x, y, o.y, 3.4, 5.2, 3.4, rot, .56, .46, .36, .72); box(o.x, y + 5.2, o.y, 2.4, 2.2, 2.4, rot, .54, .44, .34, .5); [0, 1.6, 3.2, 4.8].forEach(function (aa, n) { trees.push({ x: o.x + Math.cos(rot + aa) * 2.6, y: o.y + Math.sin(rot + aa) * 2.6, h: 7.6 + (n % 2), r: 2.4, bare: 1, c: o.s }); }); }
      else { box(o.x, y, o.y, 5, 2.5, 4.2, rot, .78, .62, .44); box(o.x, y + 2.5, o.y, 6.2, 2.1, 5.4, rot, .72, .6, .3, .08); box(o.x + Math.cos(rot) * 2.52, y, o.y + Math.sin(rot) * 2.52, .1, 1.9, 1, rot, .3, .2, .14); box(o.x - Math.sin(rot) * 5, y, o.y + Math.cos(rot) * 5, 3.4, .9, .12, rot, .45, .32, .2); }
    });
    // cattle and goats grazing in the open, grass tufts, wildflowers
    var hr = S.rng((cx * 92821) ^ (cy * 68917) ^ 5);
    if (hr() < .28) { var gx = x0 + 30 + hr() * 100, gz = y0 + 30 + hr() * 100, gb = S.biome(W, gx, gz); if (gb.kind !== 2 && gb.river < .5 && S.wildD(W, gx, gz) > 60) for (i = 0; i < 3 + Math.floor(hr() * 4); i++) { var ax = gx + (hr() - .5) * 22, az = gz + (hr() - .5) * 22, ar = hr() * TAU, goat = hr() < .35, sz = goat ? .55 : 1, ay = hAt(ax, az), cr = goat ? [.9, .88, .8] : hr() < .5 ? [.92, .9, .86] : [.42, .28, .2], c0 = Math.cos(ar), s0 = Math.sin(ar);
      box(ax, ay + .75 * sz, az, 1.9 * sz, .85 * sz, .8 * sz, ar, cr[0], cr[1], cr[2]); box(ax + c0 * 1.15 * sz, ay + .55 * sz, az + s0 * 1.15 * sz, .7 * sz, .5 * sz, .45 * sz, ar, cr[0] * .9, cr[1] * .9, cr[2] * .9); [[-.7, -.28], [-.7, .28], [.7, -.28], [.7, .28]].forEach(function (q) { box(ax + (q[0] * c0 - q[1] * s0) * sz, ay, az + (q[0] * s0 + q[1] * c0) * sz, .16 * sz, .78 * sz, .16 * sz, ar, cr[0] * .7, cr[1] * .7, cr[2] * .7); }); } }
    var FLW = [[.95, .3, .4], [.98, .8, .25], [.95, .95, .98], [.6, .4, .9]], tufts = low ? 50 : 130;
    for (i = 0; i < tufts; i++) { var tx = x0 + hr() * CH, tz = y0 + hr() * CH, td = S.wildD(W, tx, tz); if (td < 3) continue; var tb = S.biome(W, tx, tz); if (tb.river > .95 || tb.rocky > .7) continue; var ty = hAt(tx, tz), fl = hr() < .22, fc = FLW[Math.floor(hr() * 4)];
      if (fl) box(tx, ty + .25, tz, .34, .3, .34, hr() * 3, fc[0], fc[1], fc[2]); else box(tx, ty, tz, .5, .7 + hr() * .7, .5, hr() * 3, .5 - tb.forest * .2, .7 - tb.forest * .08, .26, .05); }
    // trees: denser in forest, scattered in savanna, rare on rock, none in a stream bed or on a cliff
    var cell = low ? 26.7 : 20, nc = Math.round(CH / cell);
    for (i = 0; i < nc; i++) for (j = 0; j < nc; j++) for (var rep = 0; rep < 2; rep++) {
      var qx = x0 + (i + hr()) * cell, qz = y0 + (j + hr()) * cell, u = hr(), kc = hr(), ks = hr(); if (S.wildD(W, qx, qz) < 7) continue;
      var qb = S.biome(W, qx, qz), dens = .16 + qb.forest * .62 - qb.rocky * .1 + (qb.river > .2 && qb.river < .8 ? .25 : 0); if (rep && qb.forest < .5) continue; if (u > dens || qb.river > .95) continue;
      if (Math.abs(S.wildH(W, qx + 3, qz) - S.wildH(W, qx - 3, qz)) > 4.5) continue; if (things.some(function (o) { return Math.hypot(o.x - qx, o.y - qz) < o.r + 2.5; })) continue;
      var tall = qb.forest > .5 && kc < .35, acacia = qb.forest < .4 && kc < .6; trees.push({ x: qx, y: qz, h: (tall ? 9 : acacia ? 5.6 : 5) * (.8 + ks * .5), r: (tall ? 1.7 : acacia ? 4.2 : 2.9) * (.8 + ks * .45), flat: acacia ? .42 : tall ? 2.2 : .85, c: kc, fall: qb.forest < .3 && ks < .12 });
    }
    // the fence round the grounds, open wherever a road goes out
    var F = W.flat || [];
    F.forEach(function (f, fi) {
      [[f[0], f[1], f[2], f[1]], [f[2], f[1], f[2], f[3]], [f[2], f[3], f[0], f[3]], [f[0], f[3], f[0], f[1]]].forEach(function (e) {
        var len = Math.hypot(e[2] - e[0], e[3] - e[1]), dx = (e[2] - e[0]) / len, dy = (e[3] - e[1]) / len, ang = Math.atan2(dy, dx);
        if (Math.max(e[0], e[2]) < x0 - 2 || Math.min(e[0], e[2]) >= x0 + CH + 2 || Math.max(e[1], e[3]) < y0 - 2 || Math.min(e[1], e[3]) >= y0 + CH + 2) return;
        for (var s2 = 3; s2 < len; s2 += 6) { var fx = e[0] + dx * s2 + dy * 1.2, fz = e[1] + dy * s2 - dx * 1.2; // a step outside the line, so the fence belongs to the wild chunk if (fx < x0 || fx >= x0 + CH || fz < y0 || fz >= y0 + CH) continue;
          if (F.some(function (o, oi) { return oi !== fi && fx > o[0] + .5 && fx < o[2] - .5 && fz > o[1] + .5 && fz < o[3] - .5; })) continue;
          var nr = S.nearRoad(W, fx, fz, 16); if (nr && nr.d < nr.r.w / 2 + 5) continue;
          box(fx, -.03, fz, .22, 1.5, .22, ang, .12, .5, .28); box(fx + dx * 3, 1.0, fz + dy * 3, 6, .12, .1, ang, .95, .94, .9); box(fx + dx * 3, .5, fz + dy * 3, 6, .12, .1, ang, .95, .94, .9); }
      });
    });
    if (!pos.length && !trees.length) return null;
    if (pos.length) { var geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals(); var m = new T.Mesh(geo, mat || (mat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }))); m.receiveShadow = true; g.add(m); }
    if (trees.length) {
      var G = ctx.geo, tg = G.trunk || (G.trunk = new T.CylinderGeometry(.2, .32, 1, 8)), cg = G.wildCanopy || (G.wildCanopy = new T.IcosahedronGeometry(1, low ? 0 : 1)), live = trees.filter(function (t) { return !t.bare; });
      var trunk = new T.InstancedMesh(tg, G.trunkMat, live.length || 1), crown = new T.InstancedMesh(cg, G.canopyMat, Math.max(1, trees.length)), m4 = new T.Matrix4(), q4 = new T.Quaternion(), e4 = new T.Euler(), ps = new T.Vector3(), sc = new T.Vector3(), cc = new T.Color();
      var GREEN = [0x3f7a2e, 0x4a8a34, 0x356b28, 0x5c9a3c, 0x2f6b2a], DRY = [0xc9a43a, 0xd9762c, 0xb58a2e];
      live.forEach(function (t, n) { var gy = hAt(t.x, t.y); ps.set(t.x, gy + t.h * .36, t.y); sc.set(t.r > 3.5 ? 1.5 : 1, t.h * .74, t.r > 3.5 ? 1.5 : 1); q4.identity(); m4.compose(ps, q4, sc); trunk.setMatrixAt(n, m4); });
      trunk.count = live.length;
      trees.forEach(function (t, n) { var gy = hAt(t.x, t.y), fl = t.flat || .5; ps.set(t.x, gy + t.h * (t.bare ? 1 : .8) + (fl > 1 ? t.r * .6 : 0), t.y); sc.set(t.r, t.r * fl, t.r); e4.set(0, t.c * 6, 0); q4.setFromEuler(e4); m4.compose(ps, q4, sc); crown.setMatrixAt(n, m4); crown.setColorAt(n, cc.setHex(t.fall ? DRY[Math.floor(t.c * 30) % 3] : GREEN[Math.floor(t.c * 50) % 5])); });
      trunk.castShadow = crown.castShadow = true; g.add(trunk); g.add(crown); g.userData.trunk = trunk;
    }
    g.userData.cx = cx; g.userData.cy = cy; g.userData.tris = pos.length / 9;
    return g;
  };
  // far chunks keep their crowns and lose their trunks: one draw call less each
  Wd.lod = function () {
    var R3 = Z.r3, me = Z.me; if (!R3 || !R3.chunks || !me) return; var n = 0, CH = 160;
    for (var k in R3.chunks) { var w = R3.chunks[k].userData.wild; if (!w) continue; n++; if (w.userData.trunk) w.userData.trunk.visible = Math.hypot((w.userData.cx + .5) * CH - me.x, (w.userData.cy + .5) * CH - me.y) < 230; }
    Wd.chunks = n;
  };

  /* ---------- patrol ---------- */
  function reset() { var st = Wd.st; if (st && st.truck) { var i = Z.cars.indexOf(st.truck); if (i >= 0 && Z.me.veh !== st.truck) Z.cars.splice(i, 1); } Wd.st = null; }
  Wd.reset = reset;
  function say(text, dur) { if (Z.sub) Z.sub("", text, dur || 5); if (Z.api.sound && Z.api.sound.tone) { Z.api.sound.tone(660, .18, "square", .08); Z.api.sound.tone(520, .22, "square", .08); } }
  function emit(stage, extra) { var e = { t: "patrol", stage: stage }; if (extra) for (var k in extra) e[k] = extra[k]; try { if (Z.emit) Z.emit(e); } catch (err) {} Wd.last = stage; }
  // the nearest point back on the grounds, for the marker and for where the truck comes from
  Wd.home = function (x, y) { var F = Z.W.flat || [], best = null, bd = 1e9; F.forEach(function (f) { var px = Math.max(f[0], Math.min(f[2], x)), py = Math.max(f[1], Math.min(f[3], y)), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x: px, y: py, d: d }; } }); return best; };
  function spawnTruck(st) {
    var me = Z.me, hm = Wd.home(me.x, me.y), l = Math.max(1, hm.d), back = Math.min(170, hm.d * .6 + 40), x = me.x + (hm.x - me.x) / l * back, y = me.y + (hm.y - me.y) / l * back, f = S.push(Z.W, x, y, 1.6);
    st.truck = { id: "patrol" + Date.now(), type: "car", vk: "pickup", col: "#1e3a8a", x: f.x, y: f.y, a: Math.atan2(me.y - f.y, me.x - f.x), vx: 0, vy: 0, speed: 0, hx: f.x, hy: f.y, ha: 0, free: true, paid: true, patrol: true };
    Z.cars.push(st.truck);
  }
  function caught(st, how) {
    var me = Z.me, P = Z.P, api = Z.api, ko = how === "ko", mine = me.veh;
    if (mine) { if (Z.exit) Z.exit(true); me.alt = 0; if (!mine.patrol && mine.hx != null) { mine.x = mine.hx; mine.y = mine.hy; mine.a = mine.ha || 0; mine.vx = mine.vy = 0; mine.speed = 0; } }
    var to = Z.places[ko ? "sickbay" : "gate"], f = S.push(Z.W, to.mx, to.my, .7), fine = ko ? 0 : Math.min(Math.max(0, Math.floor(P.money)), RULES.wildFine);
    api.flash("#000", 1.6); S.advance(P, ko ? 180 : 45); me.x = f.x; me.y = f.y; me.vx = me.vy = 0; me.z = 0; me.fall = 0;
    if (fine) Z.money(-fine);
    if (ko) { P.hp = Math.max(1, Math.min(P.hp, Math.round((P.maxHp || 100) * .6))); P.energy = Math.max(P.energy, 40); if (Z.sub) Z.sub("hauwa", "You again? The patrol found you flat on your back under a baobab. Drink this water. And stay in school.", 7); Z.toast("<b>You wake up in the Sick Bay.</b> Nurse Hauwa is looking down at you."); }
    else { if (Z.sub) Z.sub("", "Patrol: “Next time, stay inside the fence.”", 5); Z.toast("<b>Driven back to the Main Gate.</b>" + (fine ? " The fine was ₦" + fine + "." : "")); }
    P.stats.patrols = (P.stats.patrols || 0) + 1; api.sound.sfx(ko ? "lose" : "block");
    emit(ko ? "ko" : "escorted", { fine: fine }); reset(); if (Z.save) Z.save();
  }
  Wd.depth = function () { var me = Z.me; return me && Z.W && Z.W.flat ? S.wildD(Z.W, me.x, me.y) : 0; };
  Wd.step = function (dt) {
    var me = Z.me, P = Z.P, W = Z.W; if (!me || !P || !W.flat) return;
    Wd.lodT = (Wd.lodT || 0) - dt; if (Wd.lodT <= 0) { Wd.lodT = .4; Wd.lod(); }
    var d = S.wildD(W, me.x, me.y), st = Wd.st, air = me.alt > .05;
    if (!st) { if (d < RULES.wildWarn || free() || Z.race) return; st = Wd.st = { stage: 1, t: 0, chase: 0, near: 0, max: d }; say("PATROL RADIO: “You are off the school grounds. Go back to school.”", 6); Z.toast("<b>Patrol warning 1 of 2.</b> Turn back towards the school."); emit("warn1", { d: Math.round(d) }); spawnTruck(st); return; }
    if (free()) { reset(); return; }
    st.t += dt; st.max = Math.max(st.max, d);
    if (d < RULES.wildWarn - 120) { say("Patrol: “Good. Stay on the grounds.”", 4); emit("clear"); reset(); return; }
    if (me.veh === st.truck) { caught(st, "escorted"); return; } // you climbed into the patrol pickup yourself
    var tr = st.truck, dx = me.x - tr.x, dy = me.y - tr.y, l = Math.hypot(dx, dy) || 1;
    if (st.stage === 1 && (st.t > RULES.wildPatience || d > RULES.wildWarn + 200)) { st.stage = 2; st.t = 0; say("PATROL MEGAPHONE: “Second warning! Turn round now, or we are coming to fetch you.”", 6); Z.toast("<b>Patrol warning 2 of 2.</b> Last chance to walk back."); emit("warn2", { d: Math.round(d) }); }
    else if (st.stage === 2 && (st.t > RULES.wildPatience || d > RULES.wildWarn + 420)) { st.stage = 3; st.t = 0; say("PATROL: “Right. Stay where you are!”", 4); Z.toast("<b>The patrol is coming for you.</b>"); emit("chase", { d: Math.round(d) }); }
    // the pickup shadows you at a distance while it warns, then closes in; deeper in, it is faster than anything you can drive
    var hold = st.stage < 3 ? 34 : 0, top = st.stage < 3 ? 14 : 11 + d / 45 + st.chase * .5, want = l > hold + 4 ? top : l < hold - 4 ? -4 : 0;
    tr.speed += Math.max(-14 * dt, Math.min(9 * dt, want - tr.speed)); var ta = Math.atan2(dy, dx), da = ((ta - tr.a + Math.PI * 3) % TAU) - Math.PI; tr.a += da * (1 - Math.exp(-dt * 4));
    var nx = tr.x + Math.cos(tr.a) * tr.speed * dt, ny = tr.y + Math.sin(tr.a) * tr.speed * dt, f = S.push(W, nx, ny, 1.5); tr.x = f.x; tr.y = f.y; tr.vx = Math.cos(tr.a) * tr.speed; tr.vy = Math.sin(tr.a) * tr.speed;
    if (st.stage === 3) {
      st.chase += dt; if (!air && l < 5.5) st.near += dt; else st.near = Math.max(0, st.near - dt);
      var stubborn = st.max > RULES.wildWarn + 500 || st.chase > 30;
      if (st.near > .6 || d > RULES.wildLimit || (air && d > RULES.wildLimit * 2) || st.chase > 75) caught(st, stubborn && !air ? "ko" : "escorted");
    }
  };
  // "Back to school: 430 m" under the clock, with an arrow home
  Wd.hud = function () {
    var st = Wd.st, api = Z.api, me = Z.me; if (!st || !api || !api.x || Z.mode !== "play" || api.overlayOpen()) return;
    var x = api.x, hm = Wd.home(me.x, me.y), txt = (st.stage === 3 ? "PATROL IS COMING · " : "PATROL WARNING " + st.stage + " OF 2 · ") + "Back to school: " + Math.round(hm.d / 10) * 10 + " m";
    x.save(); x.font = "800 15px system-ui, sans-serif"; x.textAlign = "center"; var w = x.measureText(txt).width + 34; x.fillStyle = st.stage === 3 ? "rgba(153,27,27,.9)" : "rgba(30,58,138,.88)"; x.beginPath(); if (x.roundRect) x.roundRect(480 - w / 2, 332, w, 28, 14); else x.rect(480 - w / 2, 332, w, 28); x.fill(); x.fillStyle = "#fff"; x.fillText(txt, 480, 351);
    var mp = Z.r3 && Z.r3.ready && Z.r3.project ? Z.r3.project(hm.x, 3 + S.wildH(Z.W, hm.x, hm.y), hm.y) : null; if (mp && mp.x > 20 && mp.x < 940 && mp.y > 100 && mp.y < 500) { x.fillStyle = "#fde047"; x.beginPath(); x.moveTo(mp.x, mp.y); x.lineTo(mp.x - 8, mp.y - 16); x.lineTo(mp.x + 8, mp.y - 16); x.fill(); x.font = "800 12px system-ui, sans-serif"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText("SCHOOL", mp.x, mp.y - 22); x.fillText("SCHOOL", mp.x, mp.y - 22); }
    x.restore();
  };

  Wd.install = function () {
    if (Wd.installed || !Z.update || !Z.draw) return; Wd.installed = true;
    var uUpdate = Z.update, uDraw = Z.draw;
    Z.update = function (dt) { var r = uUpdate.apply(this, arguments), api = Z.api; if (Z.mode === "play" && api && !api.overlayOpen() && !(Z.bigOpen && Z.bigOpen())) Wd.step(dt); else if (Z.mode !== "play" && Wd.st) reset(); return r; };
    Z.draw = function () { var r = uDraw.apply(this, arguments); try { Wd.hud(); } catch (e) { Wd.hudErr = String(e); } return r; };
  };
  Wd.install();
  void esc;
})();
