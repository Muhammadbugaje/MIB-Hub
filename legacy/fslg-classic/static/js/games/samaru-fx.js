/* Freshers School Life — feel and feedback: foot dust, sprint start and skid clouds, landings, punches and
   kicks that land, body bumps, wall bounces, knockback, drifting leaves and fireflies. All game-side timing
   lives here; the particles themselves are drawn by R.puff in samaru-3d.js (absent in the 2D fallback and in
   the Node harness, where everything here still runs and simply draws nothing). */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, TAU = Math.PI * 2;
  if (!Z) return;
  var F = Z.fx = { wallCd: 0, barkCd: 0, moteT: 0, wasRun: false, pz: 0, step: 0, st0: 0, sp0: 0, lx: null, ly: 0, idle: 0 };
  var POW = ["POW!", "BAM!", "WHAM!", "KPOW!", "GBAM!"], OOPS = ["Ah ah! Watch where you're going!", "Easy now!", "Haba, fresher!", "Sorry o!", "You no dey see road?", "Take am easy!"];
  function r3() { return Z.r3 && Z.r3.ready && Z.r3.puff ? Z.r3 : null; }
  function puff(x, h, y, col, n, spread, up, o) { var r = r3(); if (r) r.puff(x, h, y, col, n, spread, up, o); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function sfx(n) { try { Z.api.sound.sfx(n); } catch (e) {} }

  // What the ground under (x, y) throws up: [main colour, fleck colour].
  F.ground = function (x, y) {
    var W = Z.W; if (!W) return [0xc9b28a, 0xc9b28a];
    if (S.onRoad(W, x, y)) return [0xdcdfe4, 0xc2c6cc];
    var a = S.areaAt(W, x, y), k = a ? String(a.k || a.kind || a.t || "") : "";
    if (/court|plaza|pav|yard/.test(k)) return [0xb9bcc2, 0xa3a7ae];
    if (/sand|farm|earth|dirt|strip/.test(k)) return [0xc9a877, 0xb08d5c];
    if (/water|lake/.test(k)) return [0xdff3ff, 0xbfe6ff];
    return W.designed ? [0xbfae84, 0x6fae4a] : [0xc9b28a, 0xb58a5a];
  };
  F.dust = function (x, y, n, power, dirA) { // a soft cloud at ground level, optionally thrown along dirA
    var g = F.ground(x, y), o = { size: .55 + power * .25, life: .55 + power * .25, grow: 1.6, drag: 2.4, alpha: .7 };
    if (dirA != null) { o.vx = Math.cos(dirA) * power * 2.2; o.vz = Math.sin(dirA) * power * 2.2; }
    puff(x, .12, y, g[0], n, .9 + power * .7, .5 + power * .5, o);
    if (g[1] !== g[0]) puff(x, .15, y, g[1], Math.max(1, n >> 1), 1.6 + power, 1.6 + power, { size: .16, life: .5, grav: 9, vx: o.vx, vz: o.vz });
  };
  F.sparks = function (x, h, y, n, col) { puff(x, h, y, col || 0xfff1a8, n, 6.5, 2.6, { size: .46, life: .4, grav: 11, glow: 1, shrink: 1 }); puff(x, h, y, 0xffffff, 1, .1, 0, { size: 1.15, life: .1, glow: 1, shrink: 1 }); };
  F.camKick = function (ang, mag) { var r = Z.r3; if (r && r.ready && r.kick) r.kick(ang, mag); };

  // Someone has been struck. `ang` is the direction the blow travels (attacker -> victim).
  F.hit = function (o, ang, heavy, kind) {
    if (!o) return;
    o.hitT = heavy ? .5 : .35; o.hitA = ang;
    var cx = o.x - Math.cos(ang) * .35, cy = o.y - Math.sin(ang) * .35, h = kind === "kick" ? .8 : 1.25, api = Z.api;
    F.sparks(cx, h, cy, heavy ? 14 : 8, kind === "shade" ? 0xc4b5fd : 0xfff1a8); F.dust(o.x, o.y, heavy ? 5 : 2, heavy ? 1 : .4, ang);
    if (kind !== "quiet") { sfx(heavy ? "heavy" : "hit"); api.hitstop(heavy ? .075 : .05); api.kick(heavy ? 6 : 2.5); api.buzz && api.buzz(heavy ? 35 : 15); }
    F.camKick(ang, heavy ? .28 : .12);
    if (heavy || kind === "car" || kind === "ped") Z.float(o.x, o.y - 1.9, pick(POW), "#fde047");
  };
  // Eased knockback: a velocity that bleeds off, moved through the collision world.
  F.knock = function (o, ang, v) { o.kvx = (o.kvx || 0) + Math.cos(ang) * v; o.kvy = (o.kvy || 0) + Math.sin(ang) * v; };
  // Two bodies meet without a blow.
  F.bump = function (o, ang, hard) {
    o.bumpT = .25; o.hitA = ang; if (o.bumpCd > 0) return; o.bumpCd = 1.2;
    puff((o.x + Z.me.x) / 2, 1.1, (o.y + Z.me.y) / 2, 0xffffff, hard ? 4 : 2, 1.6, .8, { size: .22, life: .28, glow: 1, shrink: 1 });
    if (hard) { sfx("stomp"); Z.api.kick(3); F.camKick(ang, .1); F.dust(o.x, o.y, 3, .5, ang); if (F.barkCd <= 0 && !o.def && Z.say) { F.barkCd = 2.5; Z.say(o, pick(OOPS)); } }
  };
  F.crash = function (x, y, nx, ny, imp) { // a vehicle meets something solid
    var a = Math.atan2(-ny, -nx); F.sparks(x - nx * .8, .7, y - ny * .8, Math.min(18, 4 + imp), 0xffd27a); F.dust(x, y, Math.min(8, 2 + imp * .4), Math.min(1.4, imp * .1), a + Math.PI); F.camKick(a, Math.min(.45, imp * .03));
  };

  function timers(o, dt) {
    if (o.hitT > 0) o.hitT = Math.max(0, o.hitT - dt); if (o.bumpT > 0) o.bumpT = Math.max(0, o.bumpT - dt); if (o.bumpCd > 0) o.bumpCd -= dt;
    if (o.kvx || o.kvy) { var r = o.def && o.def.r ? o.def.r : .45, n = S.push(Z.W, o.x + o.kvx * dt, o.y + o.kvy * dt, r), k = Math.exp(-7 * dt); o.x = n.x; o.y = n.y; o.kvx *= k; o.kvy *= k; if (Math.abs(o.kvx) + Math.abs(o.kvy) < .05) o.kvx = o.kvy = 0; }
  }

  F.update = function (dt) {
    var me = Z.me, P = Z.P, W = Z.W, i, o; if (!me || !P || !W) return;
    F.wallCd -= dt; F.barkCd -= dt;
    timers(me, dt); for (i = 0; i < Z.foes.length; i++) timers(Z.foes[i], dt); for (i = 0; i < Z.npcs.length; i++) timers(Z.npcs[i], dt); for (i = 0; i < Z.peds.length; i++) { o = Z.peds[i]; if (o.hitT > 0) o.hitT = Math.max(0, o.hitT - dt); if (o.bumpT > 0) o.bumpT = Math.max(0, o.bumpT - dt); if (o.bumpCd > 0) o.bumpCd -= dt; }
    var foot = !me.veh && !me.fall && me.alt < .05, sp = foot ? Math.abs(me.speed) : 0, back = me.a + Math.PI;
    if (foot) {
      // footfalls: one small puff each time a foot comes down while jogging or sprinting
      var stp = Math.floor(me.walk / Math.PI);
      if (stp !== F.step && me.z === 0 && sp > 4.2) { var side = (stp & 1 ? 1 : -1) * .16; F.dust(me.x - Math.sin(me.a) * side - Math.cos(me.a) * .2, me.y + Math.cos(me.a) * side - Math.sin(me.a) * .2, sp > 5.6 ? 2 : 1, sp > 5.6 ? .45 : .22, back); }
      F.step = stp;
      // sprint start and skid stop: worker A's flags when present, else read it off the speed
      var run = sp > 5.2, st = me.startT || 0, so = me.stopT || 0;
      if (me.startT !== undefined || me.stopT !== undefined) { if (st > F.st0 + .05) { F.dust(me.x, me.y, 7, 1, back); sfx("dash"); } if (so > F.sp0 + .05 && F.wasFast) { F.dust(me.x + Math.cos(me.a) * .5, me.y + Math.sin(me.a) * .5, 8, 1.1, me.a); sfx("stomp"); } }
      else { if (run && !F.wasRun && F.idle > .12) F.dust(me.x, me.y, 7, 1, back); if (!run && F.wasRun && sp < 1) F.dust(me.x + Math.cos(me.a) * .5, me.y + Math.sin(me.a) * .5, 8, 1.1, me.a); }
      F.st0 = st; F.sp0 = so; if (sp > 5.2) F.wasFast = .4; else F.wasFast = Math.max(0, (F.wasFast || 0) - dt); F.idle = sp < 4 ? F.idle + dt : 0; if (sp > 5.2 || sp < 1) F.wasRun = run;
      // landing
      if (F.pz > .05 && me.z === 0) { F.dust(me.x, me.y, 6, .7); sfx("stomp"); F.camKick(Math.PI / 2, 0, .12); }
      // sprinting flat into a wall: bounce off it
      if (F.lx != null && sp > 5.4 && F.wallCd <= 0 && me.dash <= 0) { var moved = Math.hypot(me.x - F.lx, me.y - F.ly), n = S.push(W, me.x + Math.cos(me.a) * .35, me.y + Math.sin(me.a) * .35, .45);
        if (n.hit && moved < sp * dt * .45 && Math.cos(me.a) * n.nx + Math.sin(me.a) * n.ny < -.75) { F.wallCd = .7; me.bumpT = .25; me.hitA = Math.atan2(n.ny, n.nx); F.knock(me, me.hitA, 3.2); F.dust(me.x + Math.cos(me.a) * .5, me.y + Math.sin(me.a) * .5, 5, .7, me.hitA); F.sparks(me.x + Math.cos(me.a) * .5, 1.2, me.y + Math.sin(me.a) * .5, 4, 0xffffff); sfx("stomp"); Z.api.kick(4); F.camKick(me.hitA, .14); } }
      // shoulder bumps with walkers, friends and human foes
      if (sp > 2.6) { var lists = [Z.peds, Z.npcs]; for (var li = 0; li < 2; li++) for (i = 0; i < lists[li].length; i++) { o = lists[li][i]; if (o.fall || o.hidden || o.follow) continue; var dx = o.x - me.x, dy = o.y - me.y; if (dx * dx + dy * dy < .64 && dx * Math.cos(me.a) + dy * Math.sin(me.a) > 0) { var hard = sp > 5.2, ba = Math.atan2(dy, dx), fresh = !(o.bumpCd > 0); F.bump(o, ba, hard); if (fresh) { me.bumpT = .2; me.hitA = ba + Math.PI; if (hard) { F.knock(me, ba + Math.PI, 1.6); if (li) F.knock(o, ba, 2.2); } } } } }
    }
    F.pz = me.z; F.lx = me.x; F.ly = me.y;
    // life in the air: leaves by day, fireflies after dark (a handful, near you)
    F.moteT -= dt; if (F.moteT <= 0 && r3() && me.alt < .05) { F.moteT = .22; var dk = S.darkness(P.time), ma = Math.random() * TAU, md = 3 + Math.random() * 13, mx = me.x + Math.cos(ma) * md, my = me.y + Math.sin(ma) * md;
      if (!S.insideBuilding(W, mx, my)) { if (dk > .6) { if (!S.onRoad(W, mx, my) && !Z.blackout) puff(mx, .5 + Math.random() * 1.6, my, 0xd9f99d, 1, .5, .15, { size: .16, life: 2.6, glow: 1, drag: .2, pulse: 1 }); }
        else puff(mx, 3 + Math.random() * 3, my, Math.random() < .5 ? 0x8fbf4d : 0xd9b34a, 1, .9, -.5, { size: .14, life: 3.4, drag: .3, grav: .25, sway: 1 }); } }
  };
})();

/* ---------- keeping it light: geometry merging, level of detail, far-away stand-ins, a frame governor and a
   hidden performance panel. Used by samaru-3d.js; nothing here runs in the 2D fallback or the Node harness. ---------- */
(function () {
  "use strict";
  var Z = window.SamaruGame; if (!Z) return;
  var L = Z.lod = { on: false, far: null, lowGeo: {}, acc: { sim: 0, render: 0, frames: 0, worst: 0 }, n: { rigs: 0, walkers: 0, vehs: 0, boxes: 0, nearFar: 0 } }, T = null, scene = null, vcMat = {};
  // Per tier: how detailed, how many full figures and vehicles, how far they stay full, shadow map size.
  L.TIERS = { high: { name: "High", lod: 2, rigs: 14, rigR: 55, fullR: 32, vehs: 12, vehR: 140, shadow: 2048, dpr: 2, dprPhone: 1.5 },
    mid: { name: "Balanced", lod: 1, rigs: 7, rigR: 40, fullR: 26, vehs: 6, vehR: 75, shadow: 1024, dpr: 1.5, dprPhone: 1.25 },
    low: { name: "Fast", lod: 0, rigs: 4, rigR: 30, fullR: 18, vehs: 3, vehR: 38, shadow: 0, dpr: 1.25, dprPhone: 1 } };
  L.boot = function (three, sc) { T = three; scene = sc; };
  function vc(flat) { var k = flat ? "f" : "s"; return vcMat[k] || (vcMat[k] = new T.MeshLambertMaterial({ vertexColors: true, flatShading: !!flat })); }

  // A cheaper twin of a round primitive (cached); detail 2 keeps the original.
  function lower(g, detail) {
    if (detail >= 2 || !g.parameters) return g; var p = g.parameters, k, hi = detail === 1;
    if (g.type === "CapsuleGeometry") { k = "c" + detail + "," + p.radius + "," + p.length; return L.lowGeo[k] || (L.lowGeo[k] = new T.CapsuleGeometry(p.radius, p.length, hi ? 3 : 2, hi ? 9 : 6)); }
    if (g.type === "SphereGeometry" && p.widthSegments > (hi ? 12 : 8)) { k = "s" + detail + "," + [p.radius, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength].join(); return L.lowGeo[k] || (L.lowGeo[k] = new T.SphereGeometry(p.radius, hi ? 12 : 8, hi ? 8 : 5, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength)); }
    if (g.type === "CylinderGeometry" && p.radialSegments > (hi ? 10 : 7) && !p.openEnded) { k = "y" + detail + "," + [p.radiusTop, p.radiusBottom, p.height, p.thetaStart, p.thetaLength].join(); return L.lowGeo[k] || (L.lowGeo[k] = new T.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, hi ? 10 : 7, 1, false, p.thetaStart, p.thetaLength)); }
    return g;
  }
  function held(root) { // every Object3D some code keeps a handle on (through userData): those must stay as they are
    var set = new Set(); function add(v, d) { if (!v || typeof v !== "object" || d > 3) return; if (v.isObject3D) { set.add(v); return; } if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) add(v[i], d + 1); return; } if (v.constructor === Object) for (var k in v) add(v[k], d + 1); }
    root.traverse(function (o) { for (var k in o.userData) add(o.userData[k], 0); }); return set;
  }
  function plain(o, keep) { var m = o.material; return o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && !o.children.length && !keep.has(o) && m && !Array.isArray(m) && (m.isMeshLambertMaterial || m.isMeshPhongMaterial) && !m.transparent && !m.map && !m.emissiveMap && !m.vertexColors && m.side === 0 && m.opacity === 1 && !(m.emissive && m.emissive.getHex()) && !m.polygonOffset && o.geometry.attributes.position && o.geometry.attributes.normal; }
  var _m = null, _n = null, _v = null;
  function pour(list, mats, material, cast, uv) { // parts + the matrix that carries each into the target space -> one mesh (vertex-coloured unless uv is asked for)
    var total = 0, i, j, g, idx, n; for (i = 0; i < list.length; i++) { g = list[i].geometry; total += g.index ? g.index.count : g.attributes.position.count; }
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = uv ? null : new Float32Array(total * 3), tex = uv ? new Float32Array(total * 2) : null, w = 0, t = 0; _n = _n || new T.Matrix3(); _v = _v || new T.Vector3();
    for (i = 0; i < list.length; i++) { g = list[i].geometry; idx = g.index; var P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, c = list[i].color, M = mats[i]; n = idx ? idx.count : P.count; _n.getNormalMatrix(M);
      for (j = 0; j < n; j++) { var a = idx ? idx.getX(j) : j; _v.fromBufferAttribute(P, a).applyMatrix4(M); pos[w] = _v.x; pos[w + 1] = _v.y; pos[w + 2] = _v.z; if (N) { _v.fromBufferAttribute(N, a).applyMatrix3(_n).normalize(); nor[w] = _v.x; nor[w + 1] = _v.y; nor[w + 2] = _v.z; } else nor[w + 1] = 1;
        if (col) { col[w] = c.r; col[w + 1] = c.g; col[w + 2] = c.b; } else { tex[t++] = U ? U.getX(a) : 0; tex[t++] = U ? U.getY(a) : 0; } w += 3; } }
    var bg = new T.BufferGeometry(); bg.setAttribute("position", new T.BufferAttribute(pos, 3)); bg.setAttribute("normal", new T.BufferAttribute(nor, 3)); if (col) bg.setAttribute("color", new T.BufferAttribute(col, 3)); else bg.setAttribute("uv", new T.BufferAttribute(tex, 2));
    var out = new T.Mesh(bg, material); out.castShadow = cast; out.receiveShadow = !material.isMeshBasicMaterial; out.userData.bk = 1; return out;
  }
  // Jointed things (figures, vehicles): within each joint, fuse the plain parts that never move against each other.
  L.collapse = function (root, detail) {
    var keep = held(root), nodes = []; root.traverse(function (o) { if (!o.isMesh || keep.has(o)) nodes.push(o); });
    for (var q = 0; q < nodes.length; q++) { var node = nodes[q], kids = node.children, sets = [[], []], i; if (node.isMesh) continue;
      for (i = 0; i < kids.length; i++) if (plain(kids[i], keep)) sets[kids[i].material.flatShading ? 1 : 0].push(kids[i]);
      for (var f = 0; f < 2; f++) { var list = sets[f]; if (list.length < 2 && !(list.length && detail < 2 && lower(list[0].geometry, detail) !== list[0].geometry)) continue; var mats = [], cast = false, src = [];
        for (i = 0; i < list.length; i++) { list[i].updateMatrix(); mats.push(list[i].matrix); cast = cast || list[i].castShadow; src.push({ geometry: lower(list[i].geometry, detail), color: list[i].material.color }); node.remove(list[i]); }
        node.add(pour(src, mats, vc(f === 1), cast)); } }
    return root;
  };
  // Scenery that never moves: everything plain under `grp` becomes one mesh per kind of surface (flat-shaded, smooth, unlit),
  // meshes that share one textured material become one, and `extra` instanced meshes (trunks, poles, hedges) are poured in too.
  L.bake = function (grp, detail, extra) {
    var keep = held(grp), S3 = [[], [], []], M3 = [[], [], []], cast = [false, false, false], byMat = new Map(), f, i; grp.updateMatrixWorld(true); var inv = new T.Matrix4().copy(grp.matrixWorld).invert();
    grp.traverse(function (o) { if (o === grp || !o.isMesh || o.isInstancedMesh || keep.has(o) || !o.visible || o.children.length) return; for (var a = o.parent; a && a !== grp; a = a.parent) if (keep.has(a) || !a.visible) return; var m = o.material, g = o.geometry;
      if (plain(o, keep)) f = m.flatShading ? 1 : 0; else if (m && m.isMeshBasicMaterial && !m.map && !m.transparent && m.side === 0 && !m.vertexColors && !m.polygonOffset) f = 2;
      else { if (m && m.map && !m.vertexColors && !Array.isArray(m) && g.attributes.uv) { var q = byMat.get(m); if (!q) byMat.set(m, q = { s: [], m: [], o: [] }); q.s.push({ geometry: g }); q.m.push(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); q.o.push(o); } return; }
      var r = g.parameters && g.type === "SphereGeometry" ? g.parameters.radius : 0;
      if (r && r <= .7 && detail < 2 && g.parameters.thetaLength > 3) { var k = "i" + detail + "," + r; g = L.lowGeo[k] || (L.lowGeo[k] = new T.IcosahedronGeometry(r, r > .3 || detail ? 1 : 0)); } else g = lower(g, detail);
      S3[f].push({ geometry: g, color: m.color, o: o }); M3[f].push(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); cast[f] = cast[f] || o.castShadow; });
    (extra || []).forEach(function (im) { if (!im || !im.count) return; var fl = im.material.flatShading ? 1 : 0, base = new T.Matrix4().multiplyMatrices(inv, im.matrixWorld), mi = new T.Matrix4(), ci = new T.Color();
      for (var e = 0; e < im.count; e++) { im.getMatrixAt(e, mi); var c2 = im.material.color.clone(); if (im.instanceColor) { im.getColorAt(e, ci); c2.multiply(ci); } S3[fl].push({ geometry: im.geometry, color: c2 }); M3[fl].push(new T.Matrix4().multiplyMatrices(base, mi)); } cast[fl] = cast[fl] || im.castShadow; if (im.parent) im.parent.remove(im); im.dispose(); });
    for (f = 0; f < 3; f++) { if (S3[f].length < 2) continue; for (i = 0; i < S3[f].length; i++) { var o = S3[f][i].o; if (o && o.parent) o.parent.remove(o); } grp.add(pour(S3[f], M3[f], f === 2 ? (vcMat.b || (vcMat.b = new T.MeshBasicMaterial({ vertexColors: true }))) : vc(f === 1), cast[f])); }
    byMat.forEach(function (q, m) { if (q.s.length < 2) return; for (i = 0; i < q.o.length; i++) if (q.o[i].parent) q.o[i].parent.remove(q.o[i]); grp.add(pour(q.s, q.m, m, false, true)); });
    return grp;
  };
  // Any group of meshes drawn with one material -> one mesh (clouds).
  L.fuse = function (grp, material) { var s = [], m = []; grp.updateMatrixWorld(true); var inv = new T.Matrix4().copy(grp.matrixWorld).invert(); grp.traverse(function (o) { if (o.isMesh) { s.push({ geometry: o.geometry, color: material.color }); m.push(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); } }); if (s.length < 2) return grp; while (grp.children.length) grp.remove(grp.children[0]); var out = pour(s, m, material, false, true); out.frustumCulled = false; grp.add(out); return grp; };
  L.free = function (m) { m.traverse(function (o) { if (o.userData.bk && o.geometry) o.geometry.dispose(); }); };

  /* far-away stand-ins: every distant walker is four instances (body, head, two legs), every distant vehicle one */
  function farInit() {
    var N = 128, mk = function (g, n) { var im = new T.InstancedMesh(g, new T.MeshLambertMaterial({ vertexColors: !!g.attributes.color }), n); im.frustumCulled = false; im.count = 0; im.castShadow = false; im.setColorAt(0, new T.Color()); scene.add(im); return im; };
    // a person's outline, not a block: shoulders, two arms, a neck and a head with hair. Only ever drawn beyond TIERS[..].fullR metres.
    var gs = [new T.BoxGeometry(.2, .5, .36), new T.BoxGeometry(.22, .12, .44), new T.BoxGeometry(.1, .56, .1), new T.BoxGeometry(.1, .56, .1)], bp = [], bn = []; gs[0].translate(0, 1.15, 0); gs[1].translate(0, 1.44, 0); gs[2].translate(0, 1.2, -.27); gs[3].translate(0, 1.2, .27);
    gs.forEach(function (g0) { var g1 = g0.toNonIndexed(), p1 = g1.attributes.position, n1 = g1.attributes.normal; for (var e = 0; e < p1.count; e++) { bp.push(p1.getX(e), p1.getY(e), p1.getZ(e)); bn.push(n1.getX(e), n1.getY(e), n1.getZ(e)); } });
    var body = new T.BufferGeometry(); body.setAttribute("position", new T.Float32BufferAttribute(bp, 3)); body.setAttribute("normal", new T.Float32BufferAttribute(bn, 3));
    var head = new T.IcosahedronGeometry(.155, 1); head.translate(0, 1.68, 0); var hp = head.attributes.position, hc = []; for (var hi = 0; hi < hp.count; hi += 3) { var top = (hp.getY(hi) + hp.getY(hi + 1) + hp.getY(hi + 2)) / 3 > 1.72 || (hp.getX(hi) + hp.getX(hi + 1) + hp.getX(hi + 2)) / 3 < -.07 ? .12 : 1; hc.push(top, top, top, top, top, top, top, top, top); } head.setAttribute("color", new T.Float32BufferAttribute(hc, 3));
    var lL = new T.BoxGeometry(.14, .9, .15); lL.translate(0, -.45, -.1); var lR = new T.BoxGeometry(.14, .9, .15); lR.translate(0, -.45, .1);
    var vb = new T.BoxGeometry(1, .5, 1), vt = new T.BoxGeometry(.52, .4, .88), vg = new T.BufferGeometry(), P = [], C = [], Nn = []; vb.translate(0, .42, 0); vt.translate(-.04, .82, 0);
    [[vb, 1], [vt, .3]].forEach(function (q) { var g = q[0].toNonIndexed(), p = g.attributes.position, nn = g.attributes.normal; for (var i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); Nn.push(nn.getX(i), nn.getY(i), nn.getZ(i)); C.push(q[1], q[1], q[1]); } });
    vg.setAttribute("position", new T.Float32BufferAttribute(P, 3)); vg.setAttribute("normal", new T.Float32BufferAttribute(Nn, 3)); vg.setAttribute("color", new T.Float32BufferAttribute(C, 3));
    L.far = { body: mk(body, N), head: mk(head, N), lL: mk(lL, N), lR: mk(lR, N), veh: mk(vg, 96), n: 0, v: 0, N: N, m: new T.Matrix4(), r: new T.Matrix4(), c: new T.Color(), looks: new WeakMap(), cols: {} };
  }
  L.farBegin = function () { if (!L.far) farInit(); L.far.n = 0; L.far.v = 0; };
  function hexOf(F, s, d) { if (s == null) return d; if (typeof s === "number") return s; return F.cols[s] != null ? F.cols[s] : (F.cols[s] = parseInt(String(s).replace("#", ""), 16) || d); }
  L.farWalker = function (o, t) {
    var F = L.far, i = F.n; if (i >= F.N) return; F.n++; var lk = o.look || {}, q = F.looks.get(lk); if (!q) { q = { top: hexOf(F, lk.top, 0x6b7280), skin: hexOf(F, lk.skin, 0x6b4a2f), pants: hexOf(F, lk.pants, 0x1f2937) }; if (lk === o.look) F.looks.set(lk, q); }
    var mv = o.fall ? false : o.w ? !(o.hold || o.sit || o.wave > 0 || o.busy) : !!o.follow, sw = mv ? Math.sin(t * 7 + o.x + o.y) * .55 : 0, m = F.m, r = F.r; m.makeRotationY(-o.a); m.setPosition(o.x, 0, o.y); F.body.setMatrixAt(i, m); F.head.setMatrixAt(i, m);
    m.makeRotationY(-o.a); r.makeRotationZ(sw); m.multiply(r); m.setPosition(o.x, .9, o.y); F.lL.setMatrixAt(i, m); m.makeRotationY(-o.a); r.makeRotationZ(-sw); m.multiply(r); m.setPosition(o.x, .9, o.y); F.lR.setMatrixAt(i, m);
    F.body.setColorAt(i, F.c.setHex(q.top)); F.head.setColorAt(i, F.c.setHex(q.skin)); F.lL.setColorAt(i, F.c.setHex(q.pants)); F.lR.setColorAt(i, F.c);
  };
  L.farVeh = function (c, spec, up) {
    var F = L.far, i = F.v; if (i >= 96) return; F.v++; var m = F.m, two = spec.wid < 1.1; F.r.makeScale(spec.len || 4, two ? 1.3 : (spec.len > 5.5 ? 2.3 : 1.45), two ? .5 : spec.wid || 1.8); m.makeRotationY(-c.a); m.multiply(F.r); m.setPosition(c.x, up || 0, c.y); F.veh.setMatrixAt(i, m); F.veh.setColorAt(i, F.c.setHex(hexOf(F, c.col, 0xd1d5db)));
  };
  L.farEnd = function () { var F = L.far, k = ["body", "head", "lL", "lR"], i; for (i = 0; i < 4; i++) { var im = F[k[i]]; im.count = F.n; im.visible = F.n > 0; if (F.n) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; } } F.veh.count = F.v; F.veh.visible = F.v > 0; if (F.v) { F.veh.instanceMatrix.needsUpdate = true; F.veh.instanceColor.needsUpdate = true; } L.n.walkers = F.n; L.n.boxes = F.v; };
  L.farHide = function () { if (!L.far) return; L.far.n = L.far.v = 0; L.farEnd(); };

  /* the hidden performance panel: Alt+Shift+P, or ?perf=1 */
  var box = null, shown = 0, fpsT = 0, lastNow = 0;
  function now() { return window.performance ? performance.now() : Date.now(); }
  L.toggle = function (on) {
    L.on = on == null ? !L.on : !!on; var R = Z.r3;
    if (L.on && !L.wrapped) { L.wrapped = true; Z.prof = { now: now, people: 0, traffic: 0, foes: 0, security: 0 };
      var up = Z.update; Z.update = function (dt) { if (!L.on) return up.apply(this, arguments); var t0 = now(), r = up.apply(this, arguments); L.acc.sim += now() - t0; return r; };
      if (R && R.render) { var rr = R.render; R.render = function (t) { if (!L.on) return rr.call(R, t); var t0 = now(), r = rr.call(R, t), t1 = now(); L.acc.render += t1 - t0; L.acc.frames++; if (lastNow) L.acc.worst = Math.max(L.acc.worst, t0 - lastNow); lastNow = t0; if (t1 - fpsT > 500) paint(t1); return r; }; } }
    if (!L.on && box) box.style.display = "none"; if (L.on) { fpsT = now(); lastNow = 0; }
  };
  function paint(t1) {
    var R = Z.r3, a = L.acc, f = Math.max(1, a.frames), el = (t1 - fpsT) / 1000, pf = Z.prof, i = R.info ? R.info() : {}, stage = document.querySelector("[data-gm-stage]"); fpsT = t1;
    if (!box) { box = document.createElement("pre"); box.style.cssText = "position:absolute;left:8px;bottom:8px;z-index:9;margin:0;padding:8px 10px;font:11px/1.45 ui-monospace,Menlo,monospace;color:#d1fae5;background:rgba(2,6,12,.78);border-radius:8px;pointer-events:none;white-space:pre"; stage.appendChild(box); }
    box.style.display = "block"; var heap = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + " MB" : "n/a", cv = stage.querySelector("canvas");
    L.last = { fps: f / el, frame: el * 1000 / f, worst: a.worst, sim: a.sim / f, people: pf.people / f, traffic: pf.traffic / f, other: (a.sim - pf.people - pf.traffic) / f, render: a.render / f, calls: i.calls, tris: i.tris, geo: i.geo, tex: i.tex, prog: i.prog };
    box.textContent = "fps " + (f / el).toFixed(0) + "   frame " + (el * 1000 / f).toFixed(1) + " ms   worst " + a.worst.toFixed(0) + " ms\n" +
      "sim " + (a.sim / f).toFixed(2) + " ms  (people " + (pf.people / f).toFixed(2) + ", traffic " + (pf.traffic / f).toFixed(2) + ", rest " + ((a.sim - pf.people - pf.traffic) / f).toFixed(2) + ")\n" +
      "draw " + (a.render / f).toFixed(2) + " ms on the CPU; the rest of the frame is the GPU and the browser\n" +
      "calls " + i.calls + "   tris " + Math.round(i.tris / 1000) + "k   geo " + i.geo + "   tex " + i.tex + "   prog " + i.prog + "\n" +
      (R.audit && R.audit().length ? "!! " + R.audit().join("; ") + "\n" : "") + "chunks " + (R.stats ? R.stats.chunks : "?") + "   figures " + L.n.rigs + " full + " + L.n.walkers + " far   vehicles " + L.n.vehs + " full + " + L.n.boxes + " far\n" +
      "walkers " + Z.peds.length + "  friends " + Z.npcs.length + "  traffic " + Z.traffic.length + "  parked " + Z.cars.length + "\n" +
      "tier " + (R.tier || R.quality) + "   scale " + (R.res || 1).toFixed(2) + "   " + (cv ? cv.width + "×" + cv.height : "") + "   heap " + heap;
    a.sim = a.render = a.frames = a.worst = 0; pf.people = pf.traffic = pf.foes = pf.security = 0; void shown;
  }
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("keydown", function (e) { if (e.altKey && e.shiftKey && e.code === "KeyP") { L.toggle(); e.preventDefault(); } });
    try { if (/[?&]perf=1/.test(location.search)) window.addEventListener("load", function () { L.toggle(true); }); } catch (e) {}
  }
})();
