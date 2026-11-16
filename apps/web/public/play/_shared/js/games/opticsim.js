/* Light Bender ray tracer (PHYS 124, PHYS 162). Units: pixels of the 960×540 board.
 *  - Plane mirrors reflect with angle of incidence = angle of reflection: d' = d − 2(d·n)n.
 *  - Beam splitters (half-silvered) both reflect and transmit: the beam branches.
 *  - Glass (rectangles and polygon prisms, any index n) refracts by Snell's law n₁ sin θ₁ = n₂ sin θ₂; leaving glass
 *    beyond the critical angle θc = sin⁻¹(1/n) gives total internal reflection.
 *  - Thin lenses (focal length f, + converging, − diverging) bend a ray hitting at height h from the centre so that its
 *    slope relative to the lens axis changes by −h/f: a ray parallel to the axis crosses it a distance f past the lens.
 *  - Colour filters pass only the colours they share with the beam (bit mask: red 1, green 2, blue 4, white 7).
 * Rotatable mirrors and splitters turn in 15° steps. A level is solved when every receiver is lit by a beam of its colour.
 * generate(seed, spec) builds a level backwards from a working beam path; solve(L) enumerates every setting. */
(function (root) {
  "use strict";
  var EPS = 1e-6, STEP = 15, ANGS = []; for (var k0 = 0; k0 < 180; k0 += STEP) ANGS.push(k0);
  function rad(d) { return d * Math.PI / 180; }
  function segHit(px, py, dx, dy, ax, ay, bx, by) { // ray p+t d vs segment a-b → t or -1
    var ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex; if (Math.abs(den) < EPS) return -1;
    var t = ((ax - px) * ey - (ay - py) * ex) / den, u = ((ax - px) * dy - (ay - py) * dx) / den;
    return t > 1e-4 && u >= 0 && u <= 1 ? t : -1;
  }
  function ends(m, ang) { var a = rad(ang == null ? m.ang : ang), h = m.len / 2; return [m.x - Math.cos(a) * h, m.y - Math.sin(a) * h, m.x + Math.cos(a) * h, m.y + Math.sin(a) * h]; }
  function rectPts(b) { return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]; }
  function glassList(L) { return (L.blocks || []).map(function (b) { return { pts: rectPts(b), n: b.n, src: b }; }).concat((L.prisms || []).map(function (p) { return { pts: p.pts, n: p.n, src: p }; })); }
  function inPoly(pts, x, y) { var c = false; for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) { var a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function rectEdges(w) { var p = rectPts(w); return p.map(function (q, i) { var r = p[(i + 1) % 4]; return [q[0], q[1], r[0], r[1]]; }); }
  var BOARD = [[0, 0, 960, 0], [960, 0, 960, 540], [960, 540, 0, 540], [0, 540, 0, 0]];
  function rotIdx(L) { return L.mirrors.map(function (m, i) { return m.rot === false ? -1 : i; }).filter(function (i) { return i >= 0; }); }
  /* trace(L, angs): angs[i] overrides mirrors[i].ang. Returns segments (with colour), hits, events, and `all`. */
  function trace(L, angs) {
    var mir = L.mirrors.map(function (m, i) { var a = angs && angs[i] != null ? angs[i] : m.ang; return { m: m, e: ends(m, a), split: m.type === "split" }; });
    var glass = glassList(L), lenses = L.lenses || [], filters = L.filters || [], targets = L.targets || [], walls = L.walls || [];
    var srcs = L.srcs || [L.src], segs = [], hit = {}, wrong = {}, events = [], stack = [], total = 0;
    srcs.forEach(function (s) { stack.push({ x: s.x, y: s.y, d: [Math.cos(rad(s.ang)), Math.sin(rad(s.ang))], col: s.col || 7, n: 0 }); });
    while (stack.length && total < 260) {
      var R = stack.pop(), x = R.x, y = R.y, d = R.d, col = R.col;
      for (var bounce = R.n; bounce < 48 && total < 260; bounce++) {
        var best = { t: Infinity }, i, t, e;
        for (i = 0; i < mir.length; i++) { e = mir[i].e; t = segHit(x, y, d[0], d[1], e[0], e[1], e[2], e[3]); if (t > 0 && t < best.t) best = { t: t, kind: mir[i].split ? "split" : "mirror", e: e, i: i }; }
        for (i = 0; i < glass.length; i++) { var P = glass[i].pts; for (var j = 0; j < P.length; j++) { var a = P[j], b = P[(j + 1) % P.length]; t = segHit(x, y, d[0], d[1], a[0], a[1], b[0], b[1]); if (t > 0 && t < best.t) best = { t: t, kind: "glass", e: [a[0], a[1], b[0], b[1]], g: glass[i] }; } }
        for (i = 0; i < lenses.length; i++) { e = ends(lenses[i]); t = segHit(x, y, d[0], d[1], e[0], e[1], e[2], e[3]); if (t > 0 && t < best.t) best = { t: t, kind: "lens", e: e, ln: lenses[i] }; }
        for (i = 0; i < filters.length; i++) { e = ends(filters[i]); t = segHit(x, y, d[0], d[1], e[0], e[1], e[2], e[3]); if (t > 0 && t < best.t) best = { t: t, kind: "filter", f: filters[i] }; }
        walls.forEach(function (w) { rectEdges(w).forEach(function (q) { var tt = segHit(x, y, d[0], d[1], q[0], q[1], q[2], q[3]); if (tt > 0 && tt < best.t) best = { t: tt, kind: "wall" }; }); });
        for (i = 0; i < targets.length; i++) { var g = targets[i], fx = x - g.x, fy = y - g.y, b2 = fx * d[0] + fy * d[1], c = fx * fx + fy * fy - g.r * g.r, disc = b2 * b2 - c; if (disc >= 0) { t = -b2 - Math.sqrt(disc); if (t > 1e-4 && t < best.t) best = { t: t, kind: "target", gi: i }; } }
        BOARD.forEach(function (q) { var tt = segHit(x, y, d[0], d[1], q[0], q[1], q[2], q[3]); if (tt > 0 && tt < best.t) best = { t: tt, kind: "edge" }; });
        var nx = x + d[0] * best.t, ny = y + d[1] * best.t; segs.push([x, y, nx, ny, col]); total++; x = nx; y = ny;
        if (best.kind === "target") { var tg = targets[best.gi]; if (!tg.col || tg.col === col) hit[best.gi] = true; else { wrong[best.gi] = col; events.push({ kind: "wrong", x: x, y: y, col: col }); } break; }
        if (best.kind === "wall" || best.kind === "edge") break;
        if (best.kind === "filter") { var nc = col & best.f.col; events.push({ kind: "filter", x: x, y: y, from: col, to: nc }); if (!nc) break; col = nc; x += d[0] * 1e-3; y += d[1] * 1e-3; continue; }
        if (best.kind === "lens") {
          var ln = best.ln, u = [Math.cos(rad(ln.ang)), Math.sin(rad(ln.ang))], nrm = [-u[1], u[0]], h = (x - ln.x) * u[0] + (y - ln.y) * u[1];
          var dn = d[0] * nrm[0] + d[1] * nrm[1], du = d[0] * u[0] + d[1] * u[1], s = dn >= 0 ? 1 : -1, sl = du / Math.abs(dn) - h / ln.f;
          var nd = [s * nrm[0] + sl * u[0], s * nrm[1] + sl * u[1]], ll = Math.hypot(nd[0], nd[1]); d = [nd[0] / ll, nd[1] / ll];
          events.push({ kind: "lens", x: x, y: y, h: h, f: ln.f }); x += d[0] * 1e-3; y += d[1] * 1e-3; continue;
        }
        var ex = best.e[2] - best.e[0], ey = best.e[3] - best.e[1], el = Math.hypot(ex, ey), n = [-ey / el, ex / el], dn2 = d[0] * n[0] + d[1] * n[1];
        if (best.kind === "mirror" || best.kind === "split") {
          var rd = [d[0] - 2 * dn2 * n[0], d[1] - 2 * dn2 * n[1]], inc = Math.acos(Math.min(1, Math.abs(dn2))) * 180 / Math.PI;
          events.push({ kind: best.kind === "split" ? "split" : "reflect", x: x, y: y, inc: inc, i: best.i });
          if (best.kind === "split") { stack.push({ x: x + rd[0] * 1e-3, y: y + rd[1] * 1e-3, d: rd, col: col, n: bounce + 1 }); x += d[0] * 1e-3; y += d[1] * 1e-3; continue; }
          d = rd; continue;
        }
        if (dn2 > 0) { n = [-n[0], -n[1]]; dn2 = -dn2; } // n faces against the ray
        var into = !inPoly(best.g.pts, x - d[0] * 0.5, y - d[1] * 0.5), gn = best.g.n, n1 = into ? 1 : gn, n2 = into ? gn : 1, eta = n1 / n2, cosi = -dn2, kk = 1 - eta * eta * (1 - cosi * cosi);
        var th1 = Math.acos(Math.min(1, cosi)) * 180 / Math.PI;
        if (kk < 0) { d = [d[0] + 2 * cosi * n[0], d[1] + 2 * cosi * n[1]]; events.push({ kind: "tir", x: x, y: y, inc: th1, n: gn }); }
        else { var c2 = Math.sqrt(kk); d = [eta * d[0] + (eta * cosi - c2) * n[0], eta * d[1] + (eta * cosi - c2) * n[1]]; events.push({ kind: into ? "enter" : "leave", x: x, y: y, inc: th1, ref: Math.acos(Math.min(1, c2)) * 180 / Math.PI, n: gn }); }
        x += d[0] * 1e-3; y += d[1] * 1e-3;
      }
    }
    return { segs: segs, hit: hit, wrong: wrong, events: events, all: targets.length > 0 && targets.every(function (_, i) { return hit[i]; }) };
  }
  function angDist(a, b) { var d = Math.abs(a - b) % 180; return Math.min(d, 180 - d) / STEP; }
  /* solve(L): every setting of the rotatable mirrors that lights all receivers, and par = fewest 15° turns from the start. */
  function solve(L, from) {
    var R = rotIdx(L), sols = [], a = L.mirrors.map(function (m) { return m.ang; });
    (function rec(k) { if (k === R.length) { if (trace(L, a).all) sols.push(R.map(function (i) { return a[i]; })); return; } for (var j = 0; j < ANGS.length; j++) { a[R[k]] = ANGS[j]; rec(k + 1); } a[R[k]] = L.mirrors[R[k]].ang; })(0);
    var start = from || L.mirrors.map(function (m) { return m.ang; }), par = Infinity, parSol = null;
    sols.forEach(function (s) { var c = 0; R.forEach(function (i, k) { c += angDist(start[i], s[k]); }); if (c < par) { par = c; parSol = s; } });
    return { count: sols.length, sols: sols, par: par, parSol: parSol, rot: R, configs: Math.pow(ANGS.length, R.length) };
  }
  function nearest(L, angs) { // the solution nearest the current angles (for hints)
    var r = solve(L, angs), out = null; if (!r.parSol) return null; out = L.mirrors.map(function (m, i) { return angs[i]; }); r.rot.forEach(function (i, k) { out[i] = r.parSol[k]; }); return { angs: out, turns: r.par };
  }
  /* ---------- level generator (deterministic) ---------- */
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function round(v) { return Math.round(v); }
  function terminals(L) { // last segment of every branch of the beam (no targets placed yet)
    var tr = trace(Object.assign({}, L, { targets: [] })), byEnd = [];
    tr.segs.forEach(function (s, i) { var next = tr.segs[i + 1]; var cont = next && Math.abs(next[0] - s[2]) < 0.01 && Math.abs(next[1] - s[3]) < 0.01; if (!cont) byEnd.push(s); });
    return { segs: byEnd, tr: tr };
  }
  function objects(L) { // every placed thing as a centre + radius, for spacing
    var o = [{ x: L.src.x, y: L.src.y, r: 50 }];
    L.mirrors.forEach(function (m) { o.push({ x: m.x, y: m.y, r: m.len / 2 + 14 }); });
    (L.lenses || []).forEach(function (m) { o.push({ x: m.x, y: m.y, r: m.len / 2 + 14 }); });
    (L.filters || []).forEach(function (m) { o.push({ x: m.x, y: m.y, r: m.len / 2 + 14 }); });
    (L.blocks || []).forEach(function (b) { o.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.hypot(b.w, b.h) / 2 + 10 }); });
    (L.prisms || []).forEach(function (p) { o.push({ x: p.cx, y: p.cy, r: p.R + 12 }); });
    (L.targets || []).forEach(function (g) { o.push({ x: g.x, y: g.y, r: g.r + 16 }); });
    return o;
  }
  function clear(L, x, y, r) { if (x < 60 + r * .5 || x > 900 - r * .5 || y < 70 + r * .3 || y > 490 - r * .3) return false; return objects(L).every(function (o) { return Math.hypot(o.x - x, o.y - y) > o.r + r; }); }
  function pickPoint(L, R, seg, lo, hi, r) { // a clear point on a segment between fractions lo..hi
    for (var tries = 0; tries < 14; tries++) { var f = lo + R() * (hi - lo), x = seg[0] + (seg[2] - seg[0]) * f, y = seg[1] + (seg[3] - seg[1]) * f; if (Math.hypot(seg[2] - seg[0], seg[3] - seg[1]) * (1 - f) > 70 && clear(L, x, y, r)) return [x, y]; }
    return null;
  }
  function dirOf(seg) { return Math.atan2(seg[3] - seg[1], seg[2] - seg[0]) * 180 / Math.PI; }
  function placeMirror(L, R, seg, type) {
    var p = pickPoint(L, R, seg, .3, .8, 52); if (!p) return false;
    var len = type === "split" ? 76 : 80, opts = ANGS.slice().sort(function () { return R() - .5; });
    for (var i = 0; i < opts.length; i++) {
      var m = { x: round(p[0]), y: round(p[1]), len: len, ang: opts[i], rot: true }; if (type === "split") m.type = "split";
      var trial = Object.assign({}, L, { mirrors: L.mirrors.concat([m]) }), term = terminals(trial);
      // the new mirror must actually be hit, and the reflected ray must travel a useful distance
      var used = term.tr.events.some(function (e) { return (e.kind === "reflect" || e.kind === "split") && e.i === L.mirrors.length; });
      var good = used && term.segs.every(function (s) { return Math.hypot(s[2] - s[0], s[3] - s[1]) > 150; });
      if (good) { L.mirrors.push(m); return true; }
    }
    return false;
  }
  function placeGlass(L, R, seg, kind) {
    var p = pickPoint(L, R, seg, .3, .65, 95); if (!p) return false;
    var n = kind === "water" ? 1.33 : kind === "diamond" ? 2.42 : 1.5;
    if (kind === "prism") {
      var s = 110 + round(R() * 40), rot = round(R() * 8) * 45 + (R() < .5 ? 0 : 15), shape = R() < .55 ? [[0, 0], [1, 0], [0, 1]] : [[0, -.58], [.5, .29], [-.5, .29]];
      var cx = round(p[0]), cy = round(p[1]), a = rad(rot), pts = shape.map(function (q) { return [q[0] * s, q[1] * s]; });
      var mx = pts.reduce(function (t, q) { return t + q[0]; }, 0) / 3, my = pts.reduce(function (t, q) { return t + q[1]; }, 0) / 3;
      pts = pts.map(function (q) { var x0 = q[0] - mx, y0 = q[1] - my; return [round(cx + x0 * Math.cos(a) - y0 * Math.sin(a)), round(cy + x0 * Math.sin(a) + y0 * Math.cos(a))]; });
      L.prisms = (L.prisms || []).concat([{ pts: pts, n: n, cx: cx, cy: cy, R: s * .7 }]); return true;
    }
    var w = 120 + round(R() * 120), h = 80 + round(R() * 90);
    L.blocks = (L.blocks || []).concat([{ x: round(p[0] - w / 2), y: round(p[1] - h / 2), w: w, h: h, n: n }]); return true;
  }
  function placeLens(L, R, seg) {
    var p = pickPoint(L, R, seg, .3, .6, 60); if (!p) return false;
    var dir = dirOf(seg), f = (R() < .65 ? 1 : -1) * (120 + round(R() * 6) * 20);
    L.lenses = (L.lenses || []).concat([{ x: round(p[0]), y: round(p[1]), len: 96, ang: round(dir + 90), f: f }]); return true;
  }
  function placeFilter(L, R, seg, col) {
    var p = pickPoint(L, R, seg, .3, .7, 44); if (!p) return false;
    L.filters = (L.filters || []).concat([{ x: round(p[0]), y: round(p[1]), len: 70, ang: round(dirOf(seg) + 90), col: col }]); return true;
  }
  function segRect(s, w, pad) { // does segment s cross rectangle w (grown by pad)?
    var x0 = w.x - pad, y0 = w.y - pad, x1 = w.x + w.w + pad, y1 = w.y + w.h + pad;
    for (var k = 0; k <= 20; k++) { var x = s[0] + (s[2] - s[0]) * k / 20, y = s[1] + (s[3] - s[1]) * k / 20; if (x > x0 && x < x1 && y > y0 && y < y1) return true; }
    return false;
  }
  /* spec: { rot: [min,max] mirrors, split, glass: "glass"|"water"|"diamond"|"prism", lens, filter, tir, walls, par: [min,max] } */
  function generate(seed, spec) {
    for (var attempt = 0; attempt < 400; attempt++) {
      var R = rng(seed * 7919 + attempt * 104729 + 1), L = { mirrors: [], targets: [], walls: [], src: { x: 46, y: 90 + round(R() * 360), ang: [0, 0, 15, -15, 30, -30][Math.floor(R() * 6)] } };
      if (spec.filter) L.src.col = 7;
      var nRot = spec.rot[0] + Math.floor(R() * (spec.rot[1] - spec.rot[0] + 1)), plan = [], k;
      for (k = 0; k < nRot; k++) plan.push("mirror");
      if (spec.split) plan.splice(Math.min(plan.length, Math.floor(R() * 2)), 0, "split");
      if (spec.glass) plan.splice(1 + Math.floor(R() * plan.length), 0, "glass");
      if (spec.lens) plan.splice(Math.floor(R() * (plan.length + 1)), 0, "lens");
      var ok = true, filtersToPlace = spec.filter ? (spec.split ? 2 : 1) : 0;
      for (k = 0; k < plan.length && ok; k++) {
        var term = terminals(L), segs = term.segs, seg = segs[Math.floor(R() * segs.length)];
        if (plan[k] === "mirror" || plan[k] === "split") ok = placeMirror(L, R, seg, plan[k]);
        else if (plan[k] === "glass") ok = placeGlass(L, R, seg, spec.glass);
        else if (plan[k] === "lens") ok = placeLens(L, R, seg);
      }
      if (!ok) continue;
      var fin = terminals(L), cols = [1, 2, 4, 3, 6, 5];
      if (filtersToPlace) { var fc = cols.slice().sort(function () { return R() - .5; }); for (k = 0; k < Math.min(filtersToPlace, fin.segs.length) && ok; k++) ok = placeFilter(L, R, fin.segs[k], fc[k]); if (!ok) continue; fin = terminals(L); }
      // receivers on the end of every branch
      var targets = [];
      for (k = 0; k < fin.segs.length && ok; k++) { var s = fin.segs[k], p = null;
        for (var tt = 0; tt < 12 && !p; tt++) { var f = .5 + R() * .4, x = s[0] + (s[2] - s[0]) * f, y = s[1] + (s[3] - s[1]) * f; if (x > 60 && x < 900 && y > 70 && y < 490 && clear(L, x, y, 30)) p = [x, y]; }
        if (!p) ok = false; else targets.push({ x: round(p[0]), y: round(p[1]), r: 24, col: s[4] !== 7 ? s[4] : undefined }); }
      if (!ok || (spec.split && targets.length < 2)) continue;
      L.targets = targets.map(function (g) { var o = { x: g.x, y: g.y, r: g.r }; if (g.col) o.col = g.col; return o; });
      var sol = L.mirrors.map(function (m) { return m.ang; }), chk = trace(L, sol);
      if (!chk.all) continue;
      var ev = chk.events;
      if (L.mirrors.some(function (m, i) { return !ev.some(function (e) { return (e.kind === "reflect" || e.kind === "split") && e.i === i; }); })) continue;
      if (spec.glass && !ev.some(function (e) { return e.kind === "enter"; })) continue;
      if (spec.tir && !ev.some(function (e) { return e.kind === "tir"; })) continue;
      if (spec.lens && !ev.some(function (e) { return e.kind === "lens"; })) continue;
      if (spec.filter && !ev.some(function (e) { return e.kind === "filter"; })) continue;
      // walls that keep clear of the working path, to close easy shortcuts
      var nw = spec.walls == null ? 1 + Math.floor(R() * 2) : spec.walls;
      for (k = 0; k < nw; k++) for (var wt = 0; wt < 10; wt++) {
        var w = { x: 120 + round(R() * 680), y: 60 + round(R() * 380), w: 24 + round(R() * 40), h: 60 + round(R() * 140) }; if (R() < .5) { var tmp = w.w; w.w = w.h; w.h = tmp; }
        if (chk.segs.some(function (sg) { return segRect(sg, w, 14); })) continue;
        if (!objects(L).every(function (o) { return Math.hypot(o.x - (w.x + w.w / 2), o.y - (w.y + w.h / 2)) > o.r + Math.hypot(w.w, w.h) / 2; })) continue;
        L.walls.push(w); break;
      }
      // start angles: scrambled, never already solved, with par inside the requested range
      var res = solve(L), rot = res.rot;
      if (!res.count || res.count > Math.max(2, res.configs * .03)) continue;
      var startFound = null;
      for (var st = 0; st < 40 && !startFound; st++) {
        var start = L.mirrors.map(function (m) { return m.rot === false ? m.ang : ANGS[Math.floor(R() * ANGS.length)]; });
        if (trace(L, start).all) continue;
        var pr = solve(L, start).par; if (pr >= spec.par[0] && pr <= spec.par[1]) startFound = { a: start, par: pr };
      }
      if (!startFound) continue;
      L.mirrors.forEach(function (m, i) { m.ang = startFound.a[i]; });
      L.par = startFound.par; L.seed = seed; L.solCount = res.count;
      (L.prisms || []).forEach(function (p) { delete p.cx; delete p.cy; delete p.R; });
      if (!L.blocks || !L.blocks.length) delete L.blocks; if (!L.walls.length) delete L.walls;
      return L;
    }
    return null;
  }
  /* daily puzzle: the same level for everyone on a given date */
  var DAILY = [{ rot: [2, 2], par: [3, 7] }, { rot: [1, 2], split: true, par: [3, 7] }, { rot: [2, 3], glass: "glass", par: [3, 8] }, { rot: [1, 2], lens: true, par: [3, 7] }, { rot: [1, 2], glass: "prism", par: [3, 7] }];
  function daily(dateStr) {
    var h = hashStr("light-bender:" + dateStr), spec = DAILY[h % DAILY.length], L = generate(h % 100000 + 17, spec);
    if (L) { L.name = "Daily beam · " + dateStr; L.daily = dateStr; L.hint = "Today's puzzle is the same for everyone. Work backwards from the receiver."; }
    return L;
  }
  // Hand-made levels (also the first level of several chapters). Mirrors marked rot: true can be turned in 15° steps.
  var HAND = {
    first: { name: "First reflection", hint: "Angle of incidence equals angle of reflection. Turn the mirror until the beam reaches the receiver.",
      src: { x: 70, y: 400, ang: 0 }, mirrors: [{ x: 520, y: 400, len: 90, ang: 0, rot: true }], targets: [{ x: 520, y: 90, r: 26 }], walls: [{ x: 250, y: 150, w: 40, h: 160 }] },
    periscope: { name: "Periscope", hint: "Two mirrors at the same tilt send light out parallel to how it came in, just shifted. That is how a periscope works.",
      src: { x: 70, y: 460, ang: 0 }, mirrors: [{ x: 300, y: 460, len: 80, ang: 90, rot: true }, { x: 300, y: 110, len: 80, ang: 90, rot: true }],
      targets: [{ x: 880, y: 110, r: 26 }], walls: [{ x: 420, y: 200, w: 60, h: 340 }] },
    block: { name: "Round the block", hint: "Plan the whole path: each mirror turns the beam by twice the angle between the beam and the mirror.",
      src: { x: 70, y: 270, ang: 0 }, mirrors: [{ x: 250, y: 270, len: 80, ang: 0, rot: true }, { x: 250, y: 80, len: 80, ang: 0, rot: true }, { x: 720, y: 80, len: 80, ang: 0, rot: true }],
      targets: [{ x: 720, y: 460, r: 26 }], walls: [{ x: 380, y: 160, w: 260, h: 380 }] },
    glass: { name: "Through the glass", hint: "Light bends towards the normal entering glass and away from it leaving. A block with parallel faces shifts the beam sideways.",
      src: { x: 70, y: 120, ang: 0 }, mirrors: [{ x: 220, y: 120, len: 80, ang: 0, rot: true }], blocks: [{ x: 300, y: 200, w: 320, h: 140, n: 1.5 }],
      targets: [{ x: 684, y: 470, r: 26 }], walls: [{ x: 640, y: 0, w: 40, h: 380 }] },
    pipe: { name: "Light pipe", hint: "Inside glass, light hitting the surface beyond the critical angle (41.8° for n = 1.5) is totally reflected. Optical fibres trap light this way.",
      src: { x: 70, y: 450, ang: 0 }, mirrors: [{ x: 160, y: 450, len: 80, ang: 0, rot: true }, { x: 160, y: 250, len: 80, ang: 0, rot: true }],
      blocks: [{ x: 250, y: 240, w: 520, h: 80, n: 1.5 }], targets: [{ x: 832, y: 279, r: 20 }], walls: [{ x: 250, y: 120, w: 520, h: 30 }, { x: 250, y: 400, w: 520, h: 30 }] },
    boss: { name: "Count Entropy's hall of mirrors", hint: "Entropy scattered the mirrors. Work backwards from the receiver: which direction must the last beam travel?", boss: true,
      src: { x: 70, y: 80, ang: 0 }, mirrors: [{ x: 380, y: 80, len: 80, ang: 0, rot: true }, { x: 380, y: 300, len: 80, ang: 0, rot: true }, { x: 160, y: 300, len: 80, ang: 0, rot: true }, { x: 160, y: 470, len: 80, ang: 0, rot: true }],
      blocks: [{ x: 520, y: 400, w: 200, h: 120, n: 1.5 }], targets: [{ x: 880, y: 470, r: 24 }], walls: [{ x: 430, y: 150, w: 260, h: 60 }, { x: 760, y: 200, w: 30, h: 170 }, { x: 185, y: 350, w: 130, h: 50 }] }
  };
  /* Chapters. Generated levels are baked into bender-levels.js by games/levelgen/bender_levels.js (seed + spec are kept
   * there so anyone can regenerate them) and proved solvable, with exact par, by games/tests/test_puzzles.py. */
  var CHAPTERS = [
    { id: "mirrors", name: "Mirrors", course: "PHYS 124: plane mirrors", hand: ["first", "periscope", "block"],
      tip: "A mirror turned by θ turns the reflected beam by 2θ. Work backwards from the receiver." },
    { id: "split", name: "Beam splitters", course: "PHYS 124: partial reflection", hand: [],
      tip: "A half-silvered mirror sends one beam on and reflects a copy. Every receiver must be lit." },
    { id: "glass", name: "Glass, water and diamond", course: "PHYS 162: Snell's law", hand: ["glass"],
      tip: "n₁ sin θ₁ = n₂ sin θ₂. Higher n (diamond 2.42, glass 1.5, water 1.33) bends the beam more." },
    { id: "prism", name: "Prisms and total internal reflection", course: "PHYS 162: critical angle", hand: ["pipe"],
      tip: "Past the critical angle sin θc = 1/n, light cannot leave the glass: it reflects totally. Right-angle prisms use this." },
    { id: "lens", name: "Lenses", course: "PHYS 124: thin lenses", hand: [],
      tip: "A converging lens bends rays towards its centre line: a ray parallel to the axis passes through the focus, f beyond the lens. A diverging lens spreads them." },
    { id: "colour", name: "Colour filters", course: "PHYS 124: colour and filters", hand: [],
      tip: "White light holds red, green and blue. A filter passes only its own colours. Each receiver wants one colour." },
    { id: "entropy", name: "Entropy's laboratory", course: "PHYS 124 and PHYS 162: everything together", hand: [], last: ["boss"],
      tip: "Everything at once. Trace the beam backwards from each receiver." }
  ];
  var LEVELS = [], BAKED = {};
  function build() {
    LEVELS.length = 0;
    CHAPTERS.forEach(function (c, ci) {
      var list = c.hand.map(function (h) { return HAND[h]; }).concat(BAKED[c.id] || []).concat((c.last || []).map(function (h) { return HAND[h]; }));
      list.forEach(function (L, k) { L.ch = ci; L.chapter = c.name; L.course = c.course; if (!L.hint) L.hint = c.tip; if (!L.name) L.name = c.name + " " + (k + 1); LEVELS.push(L); });
    });
  }
  function addBaked(map) { for (var k in map) BAKED[k] = map[k]; build(); }
  build();
  root.OpticSim = { trace: trace, solve: solve, nearest: nearest, generate: generate, daily: daily, rng: rng, hashStr: hashStr, LEVELS: LEVELS, CHAPTERS: CHAPTERS, HAND: HAND,
    addBaked: addBaked, STEP: STEP, ANGS: ANGS, rad: rad, ends: ends, rotIdx: rotIdx, glassList: glassList, angDist: angDist };
  if (typeof module !== "undefined") module.exports = root.OpticSim;
})(typeof window !== "undefined" ? window : globalThis);
