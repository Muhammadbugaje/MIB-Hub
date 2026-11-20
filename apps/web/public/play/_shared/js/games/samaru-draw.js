/* Freshers School Life — drawing: the 2.5D campus (flat ground, leaning walls, floating roofs), people, vehicles,
   night lighting, the minimap and the full map. Everything is drawn with canvas paths: no image files. */
(function () {
  "use strict";
  var S = window.SamaruSim, G = {}, TAU = Math.PI * 2;
  var W, mini, MS = .4, ground, treeCache = {}, lampCache = null, dark, dctx, vis = [], seen = { stamp: 0 };
  var WALLS = ["#e8d5a9", "#dcc08a", "#e3c9a0", "#d9b98c", "#efe0bd", "#cfa97a", "#e6cfa6", "#d6c2a0"];
  var ROOFS = ["#9a4a32", "#a8552f", "#8b8f96", "#7d848c", "#94583a", "#a39a8c", "#6f7f8f", "#b06a3c", "#8a3f2a", "#4f7a8c"];
  var AREA = { lawn: "#8fcf6a", plaza: "#d9d0c1", court: "#2f7d9a", field: "#4a9a40", wood: "#5f8f4a", pitch: "#c97b4a", garden: "#86b765", park: "#8fbf6a", farmland: "#b9b26a", commercial: "#d6b98c", residential: "#d9bd8e", water: "#3f86c4", reservoir: "#3f86c4", scrub: "#a8a868", grassland: "#b2bb72" };
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f)); return "rgb(" + r + "," + g + "," + b + ")"; }
  G.shade = shade;

  G.init = function (world) {
    W = world; treeCache = {}; lampCache = null;
    W.b.forEach(function (b) {
      var h1 = S.hash(b.i, 11), h2 = S.hash(b.i, 29), wc = WALLS[Math.floor(h1 * WALLS.length)], rc = ROOFS[Math.floor(h2 * ROOFS.length)];
      if (b.n === "Senate Building") { wc = "#f1ead8"; rc = "#c9c2b0"; } else if (/Mosque|Masjid/.test(b.n)) { wc = "#f3f0e6"; rc = "#3f8f6a"; } else if (/Chapel/.test(b.n)) { wc = "#f0e6d2"; rc = "#7a3f2a"; } else if (b.n === "BlueRoof") rc = "#2f6fb8"; else if (/Akenzua/.test(b.n)) { wc = "#e9dcc0"; rc = "#8f4a34"; }
      b.wc = [shade(wc, 1.04), shade(wc, .86), shade(wc, .7)]; b.rc = rc; b.rd = shade(rc, .72);
      var p = b.p, a = 0, k, j; for (k = 0, j = p.length - 2; k < p.length; j = k, k += 2) a += p[j] * p[k + 1] - p[k] * p[j + 1];
      b.ccw = a > 0; b.es = [];
      for (k = 0, j = p.length - 2; k < p.length; j = k, k += 2) { var ang = Math.atan2(p[k + 1] - p[j + 1], p[k] - p[j]), l = Math.cos(ang - .9); b.es.push(l > .35 ? 0 : l > -.35 ? 1 : 2); }
    });
    W.roads.forEach(function (r) { var p = r.p, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (var k = 0; k < p.length; k += 2) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); y0 = Math.min(y0, p[k + 1]); y1 = Math.max(y1, p[k + 1]); } r.x0 = x0 - r.w; r.y0 = y0 - r.w; r.x1 = x1 + r.w; r.y1 = y1 + r.w; });
    // ground texture
    ground = document.createElement("canvas"); ground.width = ground.height = 256; var g = ground.getContext("2d"), rnd = S.rng(77);
    g.fillStyle = "#77a54b"; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 900; i++) { g.fillStyle = ["rgba(120,80,40,.10)", "rgba(255,235,190,.12)", "rgba(150,110,60,.10)", "rgba(110,130,60,.10)"][i % 4]; var s = 1 + rnd() * 3; g.fillRect(rnd() * 256, rnd() * 256, s, s * (.5 + rnd())); }
    // minimap bake
    var B = W.bounds; mini = document.createElement("canvas"); mini.width = Math.ceil((B[2] - B[0]) * MS); mini.height = Math.ceil((B[3] - B[1]) * MS);
    var m = mini.getContext("2d"); m.fillStyle = "#86ae5a"; m.fillRect(0, 0, mini.width, mini.height); m.setTransform(MS, 0, 0, MS, -B[0] * MS, -B[1] * MS);
    if (W.flat && S.wildH) for (var wgx = B[0]; wgx < B[2]; wgx += 20) for (var wgy = B[1]; wgy < B[3]; wgy += 20) { if (!S.wildD(W, wgx + 10, wgy + 10)) continue; var wh = Math.min(1, S.wildH(W, wgx + 10, wgy + 10) / 60), wb = S.biome(W, wgx + 10, wgy + 10); m.fillStyle = wb.river > .97 ? "#4f93c9" : "rgb(" + Math.round(112 - 46 * wh) + "," + Math.round(150 - 52 * wh) + "," + Math.round(72 - 30 * wh) + ")"; m.fillRect(wgx, wgy, 20.5, 20.5); } // the wild beyond the fence, darker where it is higher
    W.areas.forEach(function (a) { m.fillStyle = AREA[a.k] || "#ccc"; poly(m, a.p); m.fill(); });
    m.lineCap = "round"; m.lineJoin = "round";
    W.roads.forEach(function (r) { m.strokeStyle = r.k === "p" ? "#fff7e6" : r.k === "x" || r.k === "k" ? "#c4a878" : "#f3e6c8"; m.lineWidth = Math.max(4, r.w * (r.k === "p" ? 1.5 : 1.1)); line(m, r.p); m.stroke(); });
    m.fillStyle = "#9a8262"; W.b.forEach(function (b) { m.fillStyle = b.n ? "#b4562f" : "#9a8262"; poly(m, b.p); m.fill(); });
    dark = document.createElement("canvas"); dark.width = 240; dark.height = 135; dctx = dark.getContext("2d");
  };
  function poly(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (var k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]); c.closePath(); }
  function line(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (var k = 2; k < p.length; k += 2) c.lineTo(p[k], p[k + 1]); }
  G.sx = function (cam, wx) { return (wx - cam.x) * cam.s + 480; };
  G.sy = function (cam, wy) { return (wy - cam.y) * cam.s + 270; };

  /* ---------- ground layer: earth, areas, roads ---------- */
  G.ground = function (x, cam, t) {
    var s = cam.s, vx0 = cam.x - 490 / s, vx1 = cam.x + 490 / s, vy0 = cam.y - 280 / s, vy1 = cam.y + 280 / s, i, a, r;
    x.save(); var pat = x.createPattern(ground, "repeat"), ox = -(((cam.x * s) % 256) + 256) % 256, oy = -(((cam.y * s) % 256) + 256) % 256;
    x.translate(ox, oy); x.fillStyle = pat; x.fillRect(0, 0, 960 + 256, 540 + 256); x.restore();
    x.save(); x.translate(480 - cam.x * s, 270 - cam.y * s); x.scale(s, s);
    for (i = 0; i < W.areas.length; i++) {
      a = W.areas[i]; if (a.x1 < vx0 || a.x0 > vx1 || a.y1 < vy0 || a.y0 > vy1) continue;
      x.fillStyle = AREA[a.k] || "#ccc"; x.globalAlpha = a.k === "residential" || a.k === "commercial" ? .45 : 1; poly(x, a.p); x.fill(); x.globalAlpha = 1;
      if (a.k === "water" || a.k === "reservoir") { x.strokeStyle = "rgba(255,255,255,.22)"; x.lineWidth = .5; for (var w = 0; w < 14; w++) { var wx = a.x0 + S.hash(w, 3) * (a.x1 - a.x0), wy = a.y0 + S.hash(w, 9) * (a.y1 - a.y0); if (wx < vx0 || wx > vx1 || wy < vy0 || wy > vy1 || !S.inPoly(a.p, wx, wy)) continue; x.beginPath(); x.arc(wx, wy, 3 + ((t * .6 + w) % 4) * 2, 0, TAU); x.stroke(); } x.strokeStyle = "#e8d7a8"; x.lineWidth = 1.2; poly(x, a.p); x.stroke(); }
      if (a.k === "pitch") { x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = .25; poly(x, a.p); x.stroke(); var cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2; x.beginPath(); x.arc(cx, cy, 2.4, 0, TAU); x.stroke(); }
      if (a.k === "farmland") { x.save(); poly(x, a.p); x.clip(); x.strokeStyle = "rgba(90,110,40,.35)"; x.lineWidth = 1; x.beginPath(); for (var f = a.x0 - (a.y1 - a.y0); f < a.x1; f += 6) { x.moveTo(f, a.y0); x.lineTo(f + (a.y1 - a.y0), a.y1); } x.stroke(); x.restore(); }
    }
    x.lineCap = "round"; x.lineJoin = "round";
    var vr = []; for (i = 0; i < W.roads.length; i++) { r = W.roads[i]; if (r.x1 < vx0 || r.x0 > vx1 || r.y1 < vy0 || r.y0 > vy1) continue; vr.push(r); }
    var pass = [["#b89466", 3, null], [null, 0, null]];
    for (i = 0; i < vr.length; i++) { r = vr[i]; if (r.k === "x" || r.k === "k") continue; x.strokeStyle = "#b89466"; x.lineWidth = r.w + 3; line(x, r.p); x.stroke(); }
    for (i = 0; i < vr.length; i++) { r = vr[i]; x.strokeStyle = r.k === "p" ? "#4b4b54" : r.k === "t" || r.k === "r" ? "#55545a" : r.k === "s" ? "#6a655e" : r.k === "k" ? "#b98f5e" : "#d8c096"; x.lineWidth = r.w; line(x, r.p); x.stroke(); }
    if (s > 4.5) { x.strokeStyle = "rgba(255,236,170,.75)"; x.lineWidth = .28; x.setLineDash([3, 4]); for (i = 0; i < vr.length; i++) { r = vr[i]; if (r.k !== "p" && r.k !== "t") continue; line(x, r.p); x.stroke(); } x.setLineDash([]); }
    x.restore();
    void pass;
  };

  /* ---------- trees and street lamps (generated from the cell hash, cached) ---------- */
  function treesIn(cx, cy) {
    var k = cx + ":" + cy, t = treeCache[k]; if (t) return t; t = treeCache[k] = [];
    var n = Math.floor(S.hash(cx, cy) * 4);
    for (var i = 0; i < n; i++) {
      var x = (cx + S.hash(cx * 7 + i, cy * 3 + 1)) * 40, y = (cy + S.hash(cx * 5 + 2, cy * 11 + i)) * 40, nr = S.nearRoad(W, x, y, 14);
      if ((nr && nr.d < nr.r.w / 2 + 2.5) || S.insideBuilding(W, x, y) || S.inWater(W, x, y)) continue;
      var kind = S.hash(cx + i, cy - i); t.push({ x: x, y: y, r: 2.4 + S.hash(cx - i, cy + 5) * 2.6, h: 5 + kind * 5, c: kind < .5 ? "#3f7d3a" : kind < .8 ? "#4f8f3f" : "#6f9a3f" });
    }
    return t;
  }
  G.treesIn = treesIn;
  G.lamps = function () {
    if (lampCache) return lampCache; lampCache = [];
    W.roads.forEach(function (r) { if (r.k !== "p" && r.k !== "t") return; for (var d = 12; d < r.len; d += 46) { var q = S.along(r.p, d); lampCache.push({ x: q.x + Math.cos(q.a + 1.57) * (r.w / 2 + 1.5), y: q.y + Math.sin(q.a + 1.57) * (r.w / 2 + 1.5) }); } });
    return lampCache;
  };
  G.treeShadows = function (x, cam) {
    var s = cam.s, cx0 = Math.floor((cam.x - 500 / s) / 40), cx1 = Math.floor((cam.x + 500 / s) / 40), cy0 = Math.floor((cam.y - 290 / s) / 40), cy1 = Math.floor((cam.y + 290 / s) / 40);
    x.fillStyle = "rgba(40,30,10,.22)";
    for (var cx = cx0; cx <= cx1; cx++) for (var cy = cy0; cy <= cy1; cy++) { var ts = treesIn(cx, cy); for (var i = 0; i < ts.length; i++) { var t = ts[i]; x.beginPath(); x.ellipse(G.sx(cam, t.x) + t.r * s * .35, G.sy(cam, t.y) + t.r * s * .45, t.r * s, t.r * s * .8, 0, 0, TAU); x.fill(); } }
  };
  G.treeTops = function (x, cam, t0) {
    var s = cam.s, cx0 = Math.floor((cam.x - 520 / s) / 40), cx1 = Math.floor((cam.x + 520 / s) / 40), cy0 = Math.floor((cam.y - 310 / s) / 40), cy1 = Math.floor((cam.y + 310 / s) / 40);
    for (var cx = cx0; cx <= cx1; cx++) for (var cy = cy0; cy <= cy1; cy++) { var ts = treesIn(cx, cy);
      for (var i = 0; i < ts.length; i++) { var t = ts[i], bx = G.sx(cam, t.x), by = G.sy(cam, t.y), k = 1 + t.h * .02, tx = 480 + (bx - 480) * k, ty = 270 + (by - 270) * k, r = t.r * s * k, sw = Math.sin(t0 * .8 + t.x) * s * .08;
        x.strokeStyle = "#6b4a2a"; x.lineWidth = Math.max(1, s * .35); x.beginPath(); x.moveTo(bx, by); x.lineTo(tx, ty); x.stroke();
        x.globalAlpha = .93; x.fillStyle = shade(t.c, .8); x.beginPath(); x.arc(tx + sw, ty, r, 0, TAU); x.fill(); x.fillStyle = t.c; x.beginPath(); x.arc(tx - r * .18 + sw, ty - r * .2, r * .72, 0, TAU); x.fill(); x.fillStyle = shade(t.c, 1.18); x.beginPath(); x.arc(tx - r * .3 + sw, ty - r * .34, r * .34, 0, TAU); x.fill(); x.globalAlpha = 1; } }
  };

  /* ---------- buildings: walls lean away from the screen centre, roofs float above ---------- */
  G.buildings = function (x, cam, fade) {
    var s = cam.s, i, k, j, b, p, kf;
    seen.stamp++; S.buildingsNear(W, cam.x - 560 / s, cam.y - 340 / s, cam.x + 560 / s, cam.y + 340 / s, vis, seen);
    for (i = 0; i < vis.length; i++) { b = vis[i]; var dx = b.cx - cam.x, dy = b.cy - cam.y; b._d = dx * dx + dy * dy; }
    vis.sort(function (a, c) { return c._d - a._d; });
    var walls = s >= 3.2;
    if (walls) for (i = 0; i < vis.length; i++) {
      b = vis[i]; p = b.p; kf = 1 + Math.min(b.h, 40) * .022; var e = 0;
      for (k = 0, j = p.length - 2; k < p.length; j = k, k += 2, e++) {
        var ax = (p[j] - cam.x) * s, ay = (p[j + 1] - cam.y) * s, bx = (p[k] - cam.x) * s, by = (p[k + 1] - cam.y) * s;
        var cross = ax * (by - ay) - ay * (bx - ax); if (b.ccw ? cross >= 0 : cross <= 0) continue; // only walls that face the camera
        x.fillStyle = b.wc[b.es[e]]; x.beginPath(); x.moveTo(480 + ax, 270 + ay); x.lineTo(480 + bx, 270 + by); x.lineTo(480 + bx * kf, 270 + by * kf); x.lineTo(480 + ax * kf, 270 + ay * kf); x.closePath(); x.fill();
        if (s > 9 && b.h > 5) { x.strokeStyle = "rgba(60,40,20,.28)"; x.lineWidth = 1; var m = (1 + kf) / 2; x.beginPath(); x.moveTo(480 + ax * m, 270 + ay * m); x.lineTo(480 + bx * m, 270 + by * m); x.stroke(); }
      }
    }
    for (i = 0; i < vis.length; i++) {
      b = vis[i]; p = b.p; kf = walls ? 1 + Math.min(b.h, 40) * .022 : 1;
      x.beginPath(); for (k = 0; k < p.length; k += 2) { var rx = 480 + (p[k] - cam.x) * s * kf, ry = 270 + (p[k + 1] - cam.y) * s * kf; if (k) x.lineTo(rx, ry); else x.moveTo(rx, ry); } x.closePath();
      var near = fade && b === fade; if (near) x.globalAlpha = .35;
      x.fillStyle = b.rc; x.fill(); x.strokeStyle = b.rd; x.lineWidth = Math.max(1, s * .18); x.stroke();
      if (s > 7 && p.length === 8) { // ridge line on simple roofs
        var m0x = (p[0] + p[2]) / 2, m0y = (p[1] + p[3]) / 2, m1x = (p[4] + p[6]) / 2, m1y = (p[5] + p[7]) / 2, l0 = Math.hypot(p[2] - p[0], p[3] - p[1]), l1 = Math.hypot(p[4] - p[2], p[5] - p[3]);
        if (l0 > l1) { m0x = (p[2] + p[4]) / 2; m0y = (p[3] + p[5]) / 2; m1x = (p[6] + p[0]) / 2; m1y = (p[7] + p[1]) / 2; }
        x.beginPath(); x.moveTo(480 + (m0x - cam.x) * s * kf, 270 + (m0y - cam.y) * s * kf); x.lineTo(480 + (m1x - cam.x) * s * kf, 270 + (m1y - cam.y) * s * kf); x.stroke();
      }
      x.globalAlpha = 1;
    }
  };

  /* ---------- people (top-down, chibi) ---------- */
  // look: {skin, hair, hairCol, top}. pose: {walk (phase), z, sit, fall, dance, wave, punch, big, outfit}
  G.person = function (x, px, py, a, look, pose, s) {
    pose = pose || {}; var U = s * .62 * (1 + (pose.z || 0) * .22), ph = pose.walk || 0, z = pose.z || 0;
    x.fillStyle = "rgba(0,0,0,.26)"; x.beginPath(); x.ellipse(px + 2 + z * 6, py + 3 + z * 9, U * .7, U * .55, 0, 0, TAU); x.fill();
    x.save(); x.translate(px, py - z * s * .5);
    if (pose.fall) { x.rotate(a + 1.57); x.fillStyle = look.top; x.beginPath(); x.ellipse(0, U * .3, U * .5, U * .95, 0, 0, TAU); x.fill(); x.fillStyle = "#1f2937"; x.fillRect(-U * .4, U * 1.05, U * .3, U * .6); x.fillRect(U * .1, U * 1.05, U * .3, U * .6); head(x, look, 0, -U * .75, U * .44, pose); x.restore();
      for (var st = 0; st < 3; st++) { var sa = pose.fall * 5 + st * 2.1; star(x, px + Math.cos(sa) * U * 1.3, py - U * .2 + Math.sin(sa) * U * .5, U * .22); } return; }
    x.rotate(a + (pose.dance ? Math.sin(pose.dance * 9) * .5 : 0));
    var sw = Math.sin(ph) * .55;
    x.fillStyle = "#1f2937";
    if (pose.sit) { x.beginPath(); x.ellipse(U * .62, -U * .28, U * .34, U * .18, 0, 0, TAU); x.ellipse(U * .62, U * .28, U * .34, U * .18, 0, 0, TAU); x.fill(); }
    else { x.beginPath(); x.ellipse(sw * U, -U * .3, U * .32, U * .19, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(-sw * U, U * .3, U * .32, U * .19, 0, 0, TAU); x.fill(); }
    var mode = pose.outfit || "tee", top = look.top;
    // arms
    x.fillStyle = mode === "kaftan" || mode === "coat" ? top : look.skin;
    var lax = -sw * U * .8, rax = sw * U * .8, lay = -U * .78, ray = U * .78;
    if (pose.punch) { rax = U * (.5 + pose.punch * .9); ray = U * .45; }
    if (pose.wave) { lax = U * .25; lay = -U * (1.0 + Math.sin(pose.wave * 14) * .18); }
    if (pose.dance) { lax = Math.sin(pose.dance * 9) * U * .6; lay = -U * 1.0; rax = -Math.sin(pose.dance * 9) * U * .6; ray = U * 1.0; }
    x.beginPath(); x.arc(lax, lay, U * .22, 0, TAU); x.fill(); x.beginPath(); x.arc(rax, ray, U * .22, 0, TAU); x.fill();
    if (pose.torch) { x.fillStyle = "#fde047"; x.fillRect(rax, ray - U * .1, U * .5, U * .2); }
    // torso
    x.fillStyle = mode === "coat" ? "#f8fafc" : top; x.beginPath(); x.ellipse(0, 0, U * (mode === "kaftan" ? .58 : .48), U * .74, 0, 0, TAU); x.fill();
    if (mode === "ankara") { x.fillStyle = shade(top, .6); for (var d = 0; d < 5; d++) { x.beginPath(); x.arc(Math.cos(d * 1.9) * U * .26, Math.sin(d * 2.3) * U * .5, U * .09, 0, TAU); x.fill(); } }
    else if (mode === "jersey") { x.fillStyle = "#fff"; x.fillRect(-U * .1, -U * .7, U * .2, U * 1.4); }
    else if (mode === "kaftan") { x.strokeStyle = shade(top, .7); x.lineWidth = Math.max(1, U * .08); x.beginPath(); x.moveTo(U * .1, -U * .3); x.lineTo(U * .1, U * .3); x.stroke(); }
    else if (mode === "coat") { x.fillStyle = top; x.fillRect(U * .05, -U * .2, U * .3, U * .4); }
    head(x, look, U * .06, 0, U * .43, pose);
    x.restore();
  };
  function head(x, look, hx, hy, r, pose) {
    if (pose && pose.big) r *= 1.9;
    var hc = look.hairCol || "#1a1210", st = look.hair, hij = st === "hijab";
    if (st === "afro") { x.fillStyle = hc; x.beginPath(); x.arc(hx - r * .1, hy, r * 1.28, 0, TAU); x.fill(); }
    if (st === "puff") { x.fillStyle = hc; x.beginPath(); x.arc(hx - r * 1.05, hy, r * .7, 0, TAU); x.fill(); }
    if (hij) { // the scarf covers the head and shoulders; only the face shows, at the front
      x.fillStyle = hc; x.beginPath(); x.ellipse(hx - r * .2, hy + r * .1, r * 1.2, r * 1.28, 0, 0, TAU); x.fill();
      x.beginPath(); x.arc(hx, hy, r * 1.03, 0, TAU); x.fill();
      x.fillStyle = look.skin; x.beginPath(); x.ellipse(hx + r * .56, hy, r * .5, r * .58, 0, 0, TAU); x.fill();
    }
    else { x.fillStyle = look.skin; x.beginPath(); x.arc(hx, hy, r, 0, TAU); x.fill(); }
    x.fillStyle = hc;
    if (st === "cap") { x.beginPath(); x.arc(hx - r * .1, hy, r * .8, 0, TAU); x.fill(); x.strokeStyle = shade(hc === "#fff" || hc === "#f8fafc" ? "#cbd5e1" : hc, .7); x.lineWidth = Math.max(1, r * .14); x.beginPath(); x.arc(hx - r * .1, hy, r * .5, 0, TAU); x.stroke(); }
    else if (st === "coily") { for (var cq = 0; cq < 7; cq++) { var ca = 1.15 + cq * (TAU - 2.3) / 6; x.beginPath(); x.arc(hx + Math.cos(ca) * r * .82, hy + Math.sin(ca) * r * .82, r * .36, 0, TAU); x.fill(); } x.beginPath(); x.arc(hx - r * .2, hy, r * .75, 0, TAU); x.fill(); }
    else if (!hij) { x.beginPath(); x.arc(hx, hy, r * 1.02, st === "fade" ? 1.25 : 1.05, TAU - (st === "fade" ? 1.25 : 1.05)); x.closePath(); x.fill();
      if (st === "braids" || st === "locs") { x.strokeStyle = hc; x.lineWidth = Math.max(1, r * .2); for (var i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(hx - r * .7, hy + i * r * .3); x.lineTo(hx - r * (st === "locs" ? 1.5 : 1.9), hy + i * r * .42); x.stroke(); } } }
    x.fillStyle = shade(look.skin, .8); x.beginPath(); x.arc(hx + r * .92, hy, r * .16, 0, TAU); x.fill(); // nose: shows which way they face
  }
  function star(x, cx, cy, r) { x.fillStyle = "#fde047"; x.beginPath(); for (var i = 0; i < 10; i++) { var a = i * .6283 - 1.57, rr = i % 2 ? r * .45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fill(); }
  G.star = star;

  // Front-view portrait for menus and dialogue.
  G.face = function (c, look, cx, cy, r) {
    var wd = window.SamaruGame && window.SamaruGame.wardrobe; if (wd && look.fit) look = wd.flat(look); // a chosen outfit: same skin, hair, headwear, glasses and beard as the 3D figure
    var hc = look.hairCol || "#1a1210", st = look.hair, hij = st === "hijab";
    c.fillStyle = look.top; c.beginPath(); c.ellipse(cx, cy + r * 1.5, r * 1.25, r * .8, 0, Math.PI, TAU); c.fill();
    if (hij) { // scarf: cloth over the shoulders, the hood over the head, a darker inner edge, then the face opening
      c.fillStyle = hc; c.beginPath(); c.ellipse(cx, cy + r * .92, r * 1.56, r * 1.12, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(cx, cy - r * .02, r * 1.13, r * 1.25, 0, 0, TAU); c.fill();
      c.fillStyle = shade(hc, .84); c.beginPath(); c.ellipse(cx, cy + r * .06, r * .95, r * 1.04, 0, 0, TAU); c.fill();
      c.fillStyle = look.skin; c.beginPath(); c.ellipse(cx, cy + r * .08, r * .79, r * .92, 0, 0, TAU); c.fill();
    }
    if (st === "afro") { c.fillStyle = hc; c.beginPath(); c.arc(cx, cy - r * .3, r * 1.3, 0, TAU); c.fill(); }
    if (st === "puff") { c.fillStyle = hc; c.beginPath(); c.arc(cx, cy - r * 1.2, r * .7, 0, TAU); c.fill(); }
    if (st === "braids" || st === "locs") { c.strokeStyle = hc; c.lineWidth = r * .22; c.lineCap = "round"; for (var i = -1; i <= 1; i += 2) for (var j = 0; j < 3; j++) { c.beginPath(); c.moveTo(cx + i * r * (.7 + j * .12), cy - r * .4); c.lineTo(cx + i * r * (.95 + j * .1), cy + r * (st === "locs" ? .9 : 1.5)); c.stroke(); } }
    if (!hij) {
      c.fillStyle = shade(look.skin, .9); c.fillRect(cx - r * .3, cy + r * .6, r * .6, r * .6);
      c.fillStyle = look.skin; c.beginPath(); c.ellipse(cx, cy, r * .92, r, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(cx - r * .92, cy + r * .05, r * .16, 0, TAU); c.arc(cx + r * .92, cy + r * .05, r * .16, 0, TAU); c.fill();
    }
    c.fillStyle = hc;
    if (hij) { /* the scarf is already drawn */ }
    else if (st === "cap") { c.beginPath(); c.ellipse(cx, cy - r * .62, r * .88, r * .52, 0, Math.PI, TAU); c.fill(); c.fillRect(cx - r * .88, cy - r * .66, r * 1.76, r * .2); c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = r * .06; for (var z = -2; z <= 2; z++) { c.beginPath(); c.moveTo(cx + z * r * .3, cy - r * .5); c.lineTo(cx + z * r * .24, cy - r * 1.05); c.stroke(); } }
    else if (st === "bald") { /* clean shave */ }
    else if (st === "coily") { c.beginPath(); c.ellipse(cx, cy - r * .36, r * .93, r * .66, 0, Math.PI, TAU); c.fill(); for (var q = 0; q < 9; q++) { var qa = Math.PI + q * Math.PI / 8; c.beginPath(); c.arc(cx + Math.cos(qa) * r * .92, cy - r * .34 + Math.sin(qa) * r * .7, r * .24, 0, TAU); c.fill(); } for (q = 0; q < 5; q++) { c.beginPath(); c.arc(cx + (q - 2) * r * .34, cy - r * .92 + Math.abs(q - 2) * r * .08, r * .22, 0, TAU); c.fill(); } }
    else { c.beginPath(); c.ellipse(cx, cy - r * .32, r * .95, r * (st === "fade" ? .62 : .74), 0, Math.PI, TAU); c.fill(); }
    c.fillStyle = "#fff"; c.beginPath(); c.ellipse(cx - r * .34, cy + r * .02, r * .17, r * .2, 0, 0, TAU); c.ellipse(cx + r * .34, cy + r * .02, r * .17, r * .2, 0, 0, TAU); c.fill();
    c.fillStyle = "#1a1210"; c.beginPath(); c.arc(cx - r * .32, cy + r * .05, r * .1, 0, TAU); c.arc(cx + r * .36, cy + r * .05, r * .1, 0, TAU); c.fill();
    c.strokeStyle = "#1a1210"; c.lineWidth = r * .08; c.lineCap = "round"; c.beginPath(); c.moveTo(cx - r * .52, cy - r * .26); c.lineTo(cx - r * .18, cy - r * .3); c.moveTo(cx + r * .18, cy - r * .3); c.lineTo(cx + r * .52, cy - r * .26); c.stroke();
    c.strokeStyle = shade(look.skin, .6); c.beginPath(); c.arc(cx, cy + r * .3, r * .1, .3, 2.8); c.stroke();
    c.strokeStyle = "#5b1f1f"; c.lineWidth = r * .09; c.beginPath(); c.arc(cx, cy + r * .42, r * .36, .35, Math.PI - .35); c.stroke();
    if (look.beard) { c.fillStyle = look.beardCol || hc; if (look.beard === "moustache" || look.beard === "full") { c.beginPath(); c.ellipse(cx, cy + r * .34, r * .34, r * .08, 0, 0, TAU); c.fill(); } if (look.beard === "goatee") { c.beginPath(); c.ellipse(cx, cy + r * .82, r * .2, r * .18, 0, 0, TAU); c.fill(); } if (look.beard === "full") { c.beginPath(); c.ellipse(cx, cy + r * .5, r * .86, r * .56, 0, .25, Math.PI - .25); c.arc(cx, cy + r * .42, r * .44, Math.PI - .3, .3, true); c.fill(); } }
    if (look.glasses) { var sun = look.glasses === "sun", gr = look.glasses === "reading" ? r * .2 : r * .27; c.strokeStyle = look.glassCol || "#111827"; c.lineWidth = r * .07; [-1, 1].forEach(function (s) { c.beginPath(); if (look.glasses === "square") c.rect(cx + s * r * .36 - gr, cy - gr * .75, gr * 2, gr * 1.5); else c.arc(cx + s * r * .36, cy + r * .03, gr, 0, TAU); if (sun) { c.fillStyle = "rgba(10,14,24,.9)"; c.fill(); } c.stroke(); }); c.beginPath(); c.moveTo(cx - r * .1, cy); c.lineTo(cx + r * .1, cy); c.stroke(); }
  };

  /* ---------- vehicles (top-down; length along +x) ---------- */
  G.vehicle = function (x, px, py, a, type, col, s, o) {
    o = o || {}; var spec = S.VEH[type], u = s * 1.2, L = spec.len * u, Wd = spec.wid * u, alt = o.alt || 0;
    x.fillStyle = "rgba(0,0,0,.28)"; x.save(); x.translate(px + 3 + alt * 26, py + 4 + alt * 34); x.rotate(a); if (type === "plane") { x.fillRect(-L / 2, -Wd * .06, L, Wd * .12); x.fillRect(-L * .05, -Wd / 2, L * .22, Wd); } else { x.beginPath(); x.ellipse(0, 0, L * .52, Math.max(Wd * .6, 3), 0, 0, TAU); x.fill(); } x.restore();
    x.save(); x.translate(px, py); x.rotate(a); if (alt) x.scale(1 + alt * .35, 1 + alt * .35);
    if (type === "skate") { x.fillStyle = col; rr(x, -L / 2, -Wd / 2, L, Wd, Wd / 2); x.fill(); x.fillStyle = "#111"; x.fillRect(-L * .36, -Wd * .7, L * .12, Wd * 1.4); x.fillRect(L * .24, -Wd * .7, L * .12, Wd * 1.4); }
    else if (type === "bike" || type === "scooter" || type === "okada") {
      var fat = type === "okada" ? 1 : type === "scooter" ? .8 : .45;
      x.fillStyle = "#111"; rr(x, -L / 2, -Wd * .16 * (1 + fat), L * .3, Wd * .32 * (1 + fat), 2); x.fill(); rr(x, L * .2, -Wd * .16 * (1 + fat), L * .3, Wd * .32 * (1 + fat), 2); x.fill();
      x.fillStyle = col; rr(x, -L * .3, -Wd * .3 * fat - 1, L * .6, Wd * .6 * fat + 2, 3); x.fill();
      x.strokeStyle = "#333"; x.lineWidth = Math.max(1.5, u * .1); x.beginPath(); x.moveTo(L * .28, -Wd * .55); x.lineTo(L * .28, Wd * .55); x.stroke();
      if (type === "okada") { x.fillStyle = "#222"; rr(x, -L * .28, -Wd * .2, L * .3, Wd * .4, 2); x.fill(); x.fillStyle = "#fef08a"; x.beginPath(); x.arc(L * .46, 0, Wd * .14, 0, TAU); x.fill(); }
    } else if (type === "keke") {
      x.fillStyle = "#111"; x.fillRect(L * .3, -Wd * .12, L * .2, Wd * .24); x.fillRect(-L * .42, -Wd * .56, L * .22, Wd * .16); x.fillRect(-L * .42, Wd * .4, L * .22, Wd * .16);
      x.fillStyle = col; rr(x, -L / 2, -Wd / 2, L * .86, Wd, Wd * .3); x.fill(); x.fillStyle = "#1f2937"; rr(x, -L * .42, -Wd * .42, L * .62, Wd * .84, Wd * .2); x.fill();
      x.fillStyle = "#16a34a"; x.fillRect(-L * .42, -Wd * .06, L * .62, Wd * .12); x.fillStyle = "#9ad0ee"; rr(x, L * .2, -Wd * .36, L * .12, Wd * .72, 2); x.fill();
    } else if (type === "car" || type === "sport") {
      x.fillStyle = "#111"; [[-.32, -.52], [-.32, .4], [.22, -.52], [.22, .4]].forEach(function (w) { x.fillRect(L * w[0], Wd * w[1], L * .16, Wd * .12); });
      x.fillStyle = col; rr(x, -L / 2, -Wd / 2, L, Wd, Wd * (type === "sport" ? .42 : .28)); x.fill();
      x.fillStyle = shade(col, 1.25); rr(x, -L * .2, -Wd * .38, L * .36, Wd * .76, Wd * .14); x.fill();
      x.fillStyle = "#1e293b"; x.beginPath(); x.moveTo(L * .16, -Wd * .38); x.lineTo(L * .28, -Wd * .34); x.lineTo(L * .28, Wd * .34); x.lineTo(L * .16, Wd * .38); x.closePath(); x.fill(); x.fillRect(-L * .3, -Wd * .34, L * .08, Wd * .68);
      x.fillStyle = "#fef9c3"; x.fillRect(L * .46, -Wd * .42, L * .04, Wd * .2); x.fillRect(L * .46, Wd * .22, L * .04, Wd * .2); x.fillStyle = "#ef4444"; x.fillRect(-L / 2, -Wd * .42, L * .03, Wd * .2); x.fillRect(-L / 2, Wd * .22, L * .03, Wd * .2);
      if (type === "sport") { x.fillStyle = "#fff"; x.fillRect(-L / 2, -Wd * .08, L, Wd * .05); x.fillRect(-L / 2, Wd * .03, L, Wd * .05); x.fillStyle = "#111"; x.fillRect(-L * .5, -Wd * .46, L * .06, Wd * .92); }
      if (o.siren) { x.fillStyle = Math.floor(o.siren * 6) % 2 ? "#ef4444" : "#3b82f6"; x.fillRect(-L * .06, -Wd * .2, L * .1, Wd * .4); }
    } else if (type === "plane") {
      x.fillStyle = "#e5e7eb"; rr(x, -L * .08, -Wd / 2, L * .2, Wd, 3); x.fill(); rr(x, -L * .5, -Wd * .17, L * .1, Wd * .34, 2); x.fill();
      x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, L / 2, Wd * .07, 0, 0, TAU); x.fill(); x.fillStyle = "#9ad0ee"; x.beginPath(); x.ellipse(L * .16, 0, L * .08, Wd * .045, 0, 0, TAU); x.fill();
      x.strokeStyle = "rgba(60,60,60,.6)"; x.lineWidth = 2; x.beginPath(); var pa = (o.t || 0) * 40; x.moveTo(L * .5, Math.sin(pa) * Wd * .12); x.lineTo(L * .5, -Math.sin(pa) * Wd * .12); x.stroke();
    }
    x.restore();
  };
  function rr(x, a, b, w, h, r) { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  G.rr = rr;

  /* ---------- night: a dark sheet with holes punched where there is light ---------- */
  // lights: [{x, y (screen px), r (px), a (0..1), dir, cone}]
  G.night = function (x, darkness, lights, tint) {
    if (darkness <= .02) return;
    dctx.globalCompositeOperation = "source-over"; dctx.clearRect(0, 0, 240, 135); dctx.fillStyle = tint || "rgba(10,12,38,1)"; dctx.globalAlpha = darkness * .84; dctx.fillRect(0, 0, 240, 135); dctx.globalAlpha = 1;
    dctx.globalCompositeOperation = "destination-out";
    for (var i = 0; i < lights.length; i++) { var l = lights[i], lx = l.x / 4, ly = l.y / 4, r = l.r / 4; if (lx < -r || lx > 240 + r || ly < -r || ly > 135 + r) continue;
      var g = dctx.createRadialGradient(lx, ly, 0, lx, ly, r); g.addColorStop(0, "rgba(0,0,0," + (l.a || .9) + ")"); g.addColorStop(1, "rgba(0,0,0,0)"); dctx.fillStyle = g;
      dctx.beginPath(); if (l.cone) { dctx.moveTo(lx, ly); dctx.arc(lx, ly, r, l.dir - l.cone, l.dir + l.cone); dctx.closePath(); } else dctx.arc(lx, ly, r, 0, TAU); dctx.fill(); }
    x.imageSmoothingEnabled = true; x.drawImage(dark, 0, 0, 960, 540);
  };

  /* ---------- minimap and full map ---------- */
  // rot: when given, the map turns so that the way the camera faces is up.
  G.minimap = function (x, cx, cy, R, me, marks, route, range, rot) {
    var B = W.bounds, k = R / (range || 170), turn = rot == null ? 0 : -rot - Math.PI / 2, ext = rot == null ? R : R * 1.45;
    x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip(); x.fillStyle = "#86ae5a"; x.fillRect(cx - R, cy - R, R * 2, R * 2);
    x.translate(cx, cy); x.rotate(turn);
    var sw = (ext * 2) / k * MS, sx = (me.x - B[0]) * MS - sw / 2, sy = (me.y - B[1]) * MS - sw / 2; x.drawImage(mini, sx, sy, sw, sw, -ext, -ext, ext * 2, ext * 2);
    if (route && route.length > 3) { x.strokeStyle = "#facc15"; x.lineWidth = 4; x.lineJoin = "round"; x.beginPath(); for (var i = 0; i < route.length; i += 2) { var rx = (route[i] - me.x) * k, ry = (route[i + 1] - me.y) * k; if (i) x.lineTo(rx, ry); else x.moveTo(rx, ry); } x.stroke(); }
    marks.forEach(function (m) { var dx = (m.x - me.x) * k, dy = (m.y - me.y) * k, d = Math.hypot(dx, dy); if (m.ring) { x.beginPath(); x.arc(dx, dy, m.ring * k, 0, TAU); x.globalAlpha = .18; x.fillStyle = m.col; x.fill(); x.globalAlpha = .95; x.lineWidth = 2; x.strokeStyle = m.col; x.stroke(); x.globalAlpha = 1; return; } if (d > R - 6) { if (!m.pin) return; dx *= (R - 6) / d; dy *= (R - 6) / d; } dot(x, dx, dy, m); });
    x.rotate(me.a); x.fillStyle = "#fff"; x.strokeStyle = "#111"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(8, 0); x.lineTo(-6, -6); x.lineTo(-2.5, 0); x.lineTo(-6, 6); x.closePath(); x.fill(); x.stroke();
    x.restore();
    x.strokeStyle = "rgba(255,255,255,.92)"; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke(); x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, R + 2, 0, TAU); x.stroke();
    var na = turn - Math.PI / 2; x.fillStyle = "#fff"; x.font = "800 11px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText("N", cx + Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10) + 4); x.fillText("N", cx + Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10) + 4);
  };
  function dot(x, px, py, m) {
    x.fillStyle = m.col || "#fff"; x.strokeStyle = "rgba(0,0,0,.7)"; x.lineWidth = 1.2;
    if (m.star) { star(x, px, py, 7); return; }
    if (m.sh && window.SamaruGame && window.SamaruGame.bigmap) { window.SamaruGame.bigmap.shape(x, px, py, m.sh, m.col, m.r || 4); return; } // one marker language for the minimap and the full map
    x.beginPath(); if (m.sq) x.rect(px - 3.5, py - 3.5, 7, 7); else x.arc(px, py, m.r || 3.5, 0, TAU); x.fill(); x.stroke();
  }
  // Full map: returns the transform so taps can be mapped back to the world.
  G.miniCanvas = function () { return mini; };
  G.bigmap = function (x, me, marks, route, labels) {
    var B = W.bounds, k = Math.min(900 / (B[2] - B[0]), 500 / (B[3] - B[1])), ox = 480 - (B[0] + B[2]) / 2 * k, oy = 270 - (B[1] + B[3]) / 2 * k;
    x.fillStyle = "rgba(8,14,22,.92)"; x.fillRect(0, 0, 960, 540);
    x.drawImage(mini, ox + B[0] * k, oy + B[1] * k, (B[2] - B[0]) * k, (B[3] - B[1]) * k);
    if (route && route.length > 3) { x.strokeStyle = "#facc15"; x.lineWidth = 3; x.beginPath(); for (var i = 0; i < route.length; i += 2) { if (i) x.lineTo(ox + route[i] * k, oy + route[i + 1] * k); else x.moveTo(ox + route[i] * k, oy + route[i + 1] * k); } x.stroke(); }
    marks.forEach(function (m) { dot(x, ox + m.x * k, oy + m.y * k, m); });
    x.font = "600 10px system-ui, sans-serif"; x.textAlign = "left"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.75)";
    (labels || []).forEach(function (l) { x.strokeText(l.name, ox + l.x * k + 6, oy + l.y * k + 3); x.fillStyle = "#fff"; x.fillText(l.name, ox + l.x * k + 6, oy + l.y * k + 3); });
    x.save(); x.translate(ox + me.x * k, oy + me.y * k); x.rotate(me.a); x.fillStyle = "#22d3ee"; x.strokeStyle = "#111"; x.lineWidth = 2; x.beginPath(); x.moveTo(10, 0); x.lineTo(-7, -7); x.lineTo(-3, 0); x.lineTo(-7, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
    return { k: k, ox: ox, oy: oy };
  };
  window.SamaruDraw = G;
})();
