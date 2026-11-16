/* Volt City: the Outer Ring (districts 7-12), the challenge ladder, the sandbox lab and upgrades.
 * Pure data and physics, shared by fieldbound.js (the game) and games/tests/test_volt.py (node). SI units throughout.
 *
 * Physics used here (PHYS 122 and the ENGG 205 circuit basics), with game simplifications disclosed:
 *  - Probe boards reuse fieldsim.js (Coulomb's law + superposition, softened by 3 cm).
 *  - Magnetic boards: a charged dust grain (q = +2 µC, m = 0.1 mg, speed 1.5 m/s) crosses cells holding a uniform
 *    B = 0.5 T perpendicular to the board. F = q v × B is always sideways, so speed never changes and the path in a
 *    field cell is a circular arc of radius r = m v / (|q| B) = 0.15 m. Screen axes: x right, y down, z INTO the board;
 *    "in" (⊗) cells have Bz = +B, "out" (⊙) cells Bz = −B. A + charge moving right through an ⊗ cell curves up.
 *  - Parallel-plate capacitor with a dielectric: C = κ ε0 A / d; the field between the plates E = V / d must stay
 *    below the material's dielectric strength. κ and strengths are textbook values (Serway, Table 26.1).
 *  - Resistors: series R = R1 + R2, parallel 1/R = 1/R1 + 1/R2; Ohm's law I = ε / R_total; power P = I²R.
 *  - Gauss's law: flux through a closed surface Φ = Q_enclosed / ε0, whatever the charges outside do.
 *  - Velocity selector: a charge passes straight when qE = qvB, so v = E / B with E = V_plates / d.
 *    Mass spectrometer: in B2 it moves on a circle r = m v / (q B2).
 * Every generated puzzle is built from a known solution and the tests replay that solution through the physics. */
(function (root) {
  "use strict";
  var EPS0 = 8.854e-12, E_CH = 1.602e-19, AMU = 1.6605e-27;

  /* ---------- deterministic randomness (puzzles must be the same on every device) ---------- */
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }

  /* ---------- magnetic boards (same 12 × 7 grid of 10 cm cells as the probe relays) ---------- */
  var MAG = { cell: 0.1, cols: 12, rows: 7, q: 2e-6, m: 1e-7, v: 1.5, B: 0.5, tmax: 5 };
  MAG.r = MAG.m * MAG.v / (MAG.q * MAG.B); // 0.15 m
  function magSimulate(level, tiles, cb) { // tiles [{c, r, s}] with s = +1 (into, ⊗) or −1 (out of the board, ⊙)
    var C = MAG.cell, B = {}, walls = {}, all = (level.fixed || []).concat(tiles || []), i;
    for (i = 0; i < all.length; i++) B[all[i].c + "," + all[i].r] = all[i].s;
    (level.walls || []).forEach(function (w) { walls[w[0] + "," + w[1]] = 1; });
    var p = { x: (level.src[0] + .5) * C, y: (level.src[1] + .5) * C, vx: MAG.v * level.dir[0], vy: MAG.v * level.dir[1] }, dt = 1 / 600, path = [[p.x, p.y]];
    var tx = (level.dst[0] + .5) * C, ty = (level.dst[1] + .5) * C;
    for (var t = 0, n = 0; t < MAG.tmax; t += dt, n++) {
      var cc = Math.floor(p.x / C), rr = Math.floor(p.y / C), s = B[cc + "," + rr];
      if (s) { var th = MAG.q * s * MAG.B / MAG.m * dt, cs = Math.cos(th), sn = Math.sin(th), vx = p.vx * cs + p.vy * sn, vy = -p.vx * sn + p.vy * cs; p.vx = vx; p.vy = vy; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (n % 4 === 0) path.push([p.x, p.y]); if (cb) cb(p, t);
      if (Math.hypot(p.x - tx, p.y - ty) < C * .45) { path.push([p.x, p.y]); return { ok: true, path: path, t: t }; }
      cc = Math.floor(p.x / C); rr = Math.floor(p.y / C);
      if (cc < 0 || rr < 0 || cc >= MAG.cols || rr >= MAG.rows) return { ok: false, path: path, why: "The grain left the board." };
      if (walls[cc + "," + rr]) return { ok: false, path: path, why: "The grain hit a wall." };
    }
    return { ok: false, path: path, why: "The grain went round in circles until the timer ran out." };
  }

  /* ---------- generated boards: build a solution, fly it, put the receiver on its path ---------- */
  function boardCells(path, cell) { var s = {}; path.forEach(function (p) { s[Math.floor(p[0] / cell) + "," + Math.floor(p[1] / cell)] = 1; }); return s; }
  function genBoard(kind, seed, diff) { // kind "probe" (electric) or "mag"; diff 0 (easy) .. 1 (hard)
    var PS = root.VoltSim, r = rng(seed * 2654435761 + (kind === "mag" ? 7 : 3)), cols = 12, rows = 7, cell = kind === "mag" ? MAG.cell : PS.CELL;
    var give = Math.min(3, 1 + Math.floor(diff * 3)), nFixed = Math.min(3, Math.floor(diff * 4)), nWalls = Math.min(14, 2 + Math.floor(diff * 12));
    for (var attempt = 0; attempt < 400; attempt++) {
      var used = {}, src = [0, 1 + Math.floor(r() * (rows - 2))]; used[src[0] + "," + src[1]] = 1;
      function cellFree(c, rr) { return !used[c + "," + rr]; }
      function place(list, n, colMin) { for (var k = 0, g = 0; k < n && g < 60; g++) { var c = colMin + Math.floor(r() * (cols - colMin)), rr = Math.floor(r() * rows); if (!cellFree(c, rr)) continue; used[c + "," + rr] = 1; list.push({ c: c, r: rr, s: r() < .5 ? 1 : -1 }); k++; } }
      var sol = [], fixed = []; place(sol, give, 2); place(fixed, nFixed, 2);
      var L = kind === "mag" ? { src: src, dir: [1, 0], dst: [99, 99], walls: [], fixed: fixed } : { src: src, v: [0.45 + r() * 0.15, 0], dst: [99, 99], walls: [], fixed: fixed };
      function sim(ch) { return kind === "mag" ? magSimulate(L, ch) : PS.simulate(L, L.fixed.concat(ch)); }
      var res = sim(sol);
      var path = res.path; if (path.length < 40) continue;
      var lo = Math.floor(path.length * .35), hi = Math.floor(path.length * .95), found = null;
      for (var tries = 0; tries < 30 && !found; tries++) {
        var pt = path[lo + Math.floor(r() * Math.max(1, hi - lo))], dc = Math.floor(pt[0] / cell), dr = Math.floor(pt[1] / cell);
        if (dc < 3 || dc >= cols || dr < 0 || dr >= rows || used[dc + "," + dr]) continue;
        L.dst = [dc, dr]; var chk = sim(sol); if (chk.ok) found = chk;
      }
      if (!found) continue;
      if (sim([]).ok) continue; // the player's charges must matter
      var onPath = boardCells(found.path, cell); used[L.dst[0] + "," + L.dst[1]] = 1;
      for (var w = 0, g2 = 0; w < nWalls && g2 < 200; g2++) { var wc = 1 + Math.floor(r() * (cols - 1)), wr = Math.floor(r() * rows), key = wc + "," + wr;
        if (used[key] || onPath[key]) continue; used[key] = 1; L.walls.push([wc, wr]); w++; }
      if (!sim(sol).ok) continue;
      L.give = give; L.preview = diff < 0.3; L.solution = sol; L.kind = kind;
      L.name = kind === "mag" ? "Magnet board" : "Probe board";
      L.hint = kind === "mag" ? "F = qv × B is always sideways: a field cell bends the grain into an arc of radius r = mv/(qB) = 15 cm without changing its speed. ⊗ (into the board) curls a + charge one way, ⊙ the other."
        : "Like charges repel and unlike attract (F = kqQ/r²). The probe feels every charge at once: the forces add as vectors.";
      return L;
    }
    return null;
  }

  /* ---------- dielectric capacitors ---------- */
  var MATS = [ // κ, dielectric strength (V/m)
    { id: "air", name: "Air", k: 1.00059, Emax: 3e6 }, { id: "teflon", name: "Teflon", k: 2.1, Emax: 60e6 },
    { id: "polystyrene", name: "Polystyrene", k: 2.56, Emax: 24e6 }, { id: "paper", name: "Paper", k: 3.7, Emax: 16e6 },
    { id: "pyrex", name: "Pyrex glass", k: 5.6, Emax: 14e6 }, { id: "neoprene", name: "Neoprene rubber", k: 6.7, Emax: 12e6 }];
  var GAPS = [0.05e-3, 0.1e-3, 0.2e-3, 0.5e-3, 1e-3, 2e-3];
  function dielC(p, mi, gi) { return MATS[mi].k * EPS0 * p.A / GAPS[gi]; }
  function dielCheck(p, ch) { var m = MATS[ch[0]], d = GAPS[ch[1]], C = dielC(p, ch[0], ch[1]), E = p.V / d, err = (C - p.C) / p.C;
    if (E > m.Emax) return { ok: false, C: C, E: E, why: m.name + " breaks down above " + (m.Emax / 1e6) + " MV/m; here E = V/d = " + (E / 1e6).toFixed(1) + " MV/m. Sparks!" };
    return { ok: Math.abs(err) <= p.tol, C: C, E: E, why: Math.abs(err) <= p.tol ? "" : "C = " + fmt(C, "F") + ", the job needs " + fmt(p.C, "F") + "." }; }
  function genDiel(seed, diff) {
    var r = rng(seed * 97 + 11);
    for (var a = 0; a < 200; a++) {
      var mi = Math.floor(r() * MATS.length), gi = Math.floor(r() * GAPS.length), A = pick(r, [0.01, 0.02, 0.05, 0.1]);
      var Emax = MATS[mi].Emax * GAPS[gi], V = Math.round(Emax * (0.25 + r() * 0.65) / 10) * 10; if (V < 10) continue;
      var p = { kind: "diel", A: A, V: V, tol: diff > .6 ? 0.03 : 0.05 }; p.C = dielC(p, mi, gi);
      var sols = dielSolve(p); if (!sols.length || sols.length > 2) continue;
      p.solution = [mi, gi]; if (!dielCheck(p, p.solution).ok) { p.solution = sols[0]; }
      p.brief = "Build a capacitor of " + fmt(p.C, "F") + " from plates of " + (A * 1e4) + " cm² that must hold " + V + " V. Choose the dielectric and the gap.";
      return p;
    }
    return null;
  }
  function dielSolve(p) { var out = []; for (var i = 0; i < MATS.length; i++) for (var j = 0; j < GAPS.length; j++) if (dielCheck(p, [i, j]).ok) out.push([i, j]); return out; }

  /* ---------- resistor networks (lamp in series with a chosen pair) ---------- */
  var SHELF = [10, 22, 33, 47, 68, 100, 150, 220]; // ohms, 0.5 W each
  function ohmNet(ch) { var a = SHELF[ch[0]], b = ch[1] < 0 ? null : SHELF[ch[1]]; if (b == null) return a; return ch[2] === "par" ? 1 / (1 / a + 1 / b) : a + b; }
  function ohmCheck(p, ch) {
    var R = ohmNet(ch), I = p.emf / (p.RL + R), a = SHELF[ch[0]], b = ch[1] < 0 ? null : SHELF[ch[1]], pw;
    if (b == null) pw = [I * I * a]; else if (ch[2] === "par") { var V = I * R; pw = [V * V / a, V * V / b]; } else pw = [I * I * a, I * I * b];
    var hot = pw.some(function (w) { return w > p.Pmax * 1.0001; }), err = (I - p.I) / p.I;
    if (hot) return { ok: false, I: I, why: "A resistor would dissipate " + Math.max.apply(null, pw).toFixed(2) + " W, more than its " + p.Pmax + " W rating. It would burn." };
    return { ok: Math.abs(err) <= p.tol, I: I, why: Math.abs(err) <= p.tol ? "" : "The lamp gets " + (I * 1000).toFixed(0) + " mA; it needs " + (p.I * 1000).toFixed(0) + " mA." };
  }
  function ohmChoices() { var out = []; for (var i = 0; i < SHELF.length; i++) { out.push([i, -1, "one"]); for (var j = i + 1; j < SHELF.length; j++) { out.push([i, j, "ser"]); out.push([i, j, "par"]); } } return out; }
  function ohmSolve(p) { return ohmChoices().filter(function (c) { return ohmCheck(p, c).ok; }); }
  function genOhm(seed, diff) {
    var r = rng(seed * 131 + 5);
    for (var a = 0; a < 300; a++) {
      var ch = pick(r, ohmChoices()); if (diff > .4 && ch[2] === "one") continue;
      var p = { kind: "ohm", emf: pick(r, [6, 9, 12]), RL: pick(r, [20, 30, 40, 60]), Pmax: 0.5, tol: diff > .6 ? 0.02 : 0.04 };
      p.I = p.emf / (p.RL + ohmNet(ch)); if (!ohmCheck(p, ch).ok) continue;
      var sols = ohmSolve(p); if (sols.length > 3) continue;
      p.solution = ch; p.brief = "A " + p.emf + " V battery lights a " + p.RL + " Ω lamp that needs " + (p.I * 1000).toFixed(0) + " mA. Add one resistor, or two in series or parallel, from the shelf (0.5 W each).";
      return p;
    }
    return null;
  }

  /* ---------- Gauss's law: flux through a closed loop ---------- */
  function inside(poly, x, y) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function gaussFlux(p) { var q = 0; p.charges.forEach(function (c) { if (inside(p.loop, c.x, c.y)) q += c.q; }); return q / EPS0; }
  function genGauss(seed, diff) {
    var r = rng(seed * 61 + 17), n = 3 + Math.floor(diff * 4), charges = [];
    for (var i = 0; i < n; i++) charges.push({ x: 0.08 + r() * 0.84, y: 0.1 + r() * 0.8, q: pick(r, [-3, -2, -1, 1, 2, 3, 4]) * 1e-9 });
    var cx = 0.3 + r() * 0.4, cy = 0.35 + r() * 0.3, loop = [], k = 5 + Math.floor(r() * 4);
    for (i = 0; i < k; i++) { var ang = i / k * Math.PI * 2, rad = 0.18 + r() * 0.17; loop.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.8]); }
    charges = charges.filter(function (c) { var near = 1; loop.forEach(function (pt, j) { var b = loop[(j + 1) % loop.length], dx = b[0] - pt[0], dy = b[1] - pt[1], t = Math.max(0, Math.min(1, ((c.x - pt[0]) * dx + (c.y - pt[1]) * dy) / (dx * dx + dy * dy))), d = Math.hypot(c.x - pt[0] - t * dx, c.y - pt[1] - t * dy); if (d < .08) near = 0; }); return near; });
    var p = { kind: "gauss", charges: charges, loop: loop }, right = gaussFlux(p), total = charges.reduce(function (s, c) { return s + c.q; }, 0) / EPS0;
    var inN = charges.filter(function (c) { return inside(loop, c.x, c.y); }).length;
    if (charges.length < 3 || !inN || inN === charges.length || charges.some(function (c, i) { return charges.some(function (o, j) { return j > i && Math.hypot(o.x - c.x, o.y - c.y) < .1; }); })) return genGauss(seed + 1000, diff);
    var opts = [right, total, -right, right * 2, 0].filter(function (v, i2, a) { return a.findIndex(function (w) { return Math.abs(w - v) < 1; }) === i2; }).slice(0, 4);
    var rr2 = rng(seed + 3); opts.sort(function () { return rr2() - .5; });
    p.options = opts; p.solution = opts.findIndex(function (v) { return Math.abs(v - right) < 1; });
    p.brief = "What is the electric flux through the closed purple loop? Only the charge inside counts: Φ = Q_in / ε0.";
    return p;
  }

  /* ---------- read the field lines: which arrangement of charges made this pattern? ---------- */
  var LINE_SETS = [
    [[-1, 0, 2], [1, 0, -1]], [[-1, 0, 1], [1, 0, 1]], [[-1, 0, 1], [1, 0, -1]], [[-1, 0, 2], [1, 0, 2]],
    [[-1, 0, -2], [1, 0, 1]], [[-1, 0, 1], [1, 0, -3]], [[0, -1, 1], [0, 1, -1]], [[-1, 0, 1], [0, 0, -1], [1, 0, 1]]];
  function setLabel(s) { return s.map(function (c) { var where = c[0] < 0 ? "left" : c[0] > 0 ? "right" : c[1] < 0 ? "top" : c[1] > 0 ? "bottom" : "middle"; return (c[2] > 0 ? "+" : "−") + Math.abs(c[2]) + " " + where; }).join(", "); }
  function lineCharges(s) { return s.map(function (c) { return { x: 0.5 + c[0] * 0.25, y: 0.5 + c[1] * 0.25, q: c[2] * 1e-9 }; }); }
  function fieldE(ch, x, y) { var ex = 0, ey = 0; ch.forEach(function (c) { var dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy + 1e-4, r = Math.sqrt(r2), e = 8.99e9 * c.q / r2; ex += e * dx / r; ey += e * dy / r; }); return [ex, ey]; }
  function fieldLines(ch, perUnit) { // streamlines from + charges (or into − charges when none are +); 8 lines per nC
    var out = [], pos = ch.filter(function (c) { return c.q > 0; }), seeds = pos.length ? pos : ch, dir = pos.length ? 1 : -1;
    seeds.forEach(function (c) { var n = Math.max(4, Math.round(Math.abs(c.q) / 1e-9 * (perUnit || 8)));
      for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2 + .1, x = c.x + Math.cos(a) * .02, y = c.y + Math.sin(a) * .02, pts = [[x, y]];
        for (var s = 0; s < 220; s++) { var E = fieldE(ch, x, y), m = Math.hypot(E[0], E[1]); if (m < 1e-6) break; x += dir * E[0] / m * .006; y += dir * E[1] / m * .006; pts.push([x, y]);
          if (x < -.1 || y < -.1 || x > 1.1 || y > 1.1) break; if (ch.some(function (o) { return o !== c && Math.hypot(o.x - x, o.y - y) < .015; })) break; }
        out.push(pts); } });
    return out;
  }
  function genLines(seed) {
    var r = rng(seed * 43 + 29), idx = LINE_SETS.map(function (s, i) { return i; }).sort(function () { return r() - .5; }).slice(0, 4), right = Math.floor(r() * 4);
    return { kind: "lines", set: LINE_SETS[idx[right]], options: idx.map(function (i) { return setLabel(LINE_SETS[i]); }), solution: right,
      brief: "Field lines start on + charges and end on − charges, and the number of lines is proportional to the charge. Which arrangement drew this pattern?" };
  }

  /* ---------- velocity selector and mass spectrometer ---------- */
  var ISOTOPES = [{ n: "carbon-12", m: 12.000 }, { n: "carbon-13", m: 13.003 }, { n: "nitrogen-14", m: 14.003 }, { n: "oxygen-16", m: 15.995 }, { n: "neon-20", m: 19.992 }, { n: "neon-22", m: 21.991 }];
  var SEL_V = [100, 200, 300, 400, 500, 600, 800, 1000], SEL_B = [0.01, 0.02, 0.025, 0.04, 0.05, 0.08, 0.1], SEL_D = 0.01, SEL_B2 = [0.05, 0.08, 0.1, 0.12, 0.15, 0.2];
  function selCheck(p, ch) { // ch = [plate voltage index, B1 index] (+ B2 index on spectrometer rounds)
    var E = SEL_V[ch[0]] / SEL_D, v = E / SEL_B[ch[1]], err = (v - p.v) / p.v;
    if (Math.abs(err) > 0.02) return { ok: false, v: v, why: "Particles going straight have v = E/B = " + fmtNum(v) + " m/s, but the beam is " + fmtNum(p.v) + " m/s. The ions hit the plates." };
    if (p.R == null) return { ok: true, v: v };
    var rr = p.mass * v / (E_CH * SEL_B2[ch[2]]), e2 = (rr - p.R) / p.R;
    return { ok: Math.abs(e2) <= 0.03, v: v, r: rr, why: Math.abs(e2) <= 0.03 ? "" : "In B2 the " + p.iso + " ions circle with r = mv/(qB) = " + (rr * 100).toFixed(1) + " cm; the detector is at " + (p.R * 100).toFixed(1) + " cm." };
  }
  function selSolve(p) { var out = []; for (var i = 0; i < SEL_V.length; i++) for (var j = 0; j < SEL_B.length; j++) { if (p.R == null) { if (selCheck(p, [i, j]).ok) out.push([i, j]); } else for (var k = 0; k < SEL_B2.length; k++) if (selCheck(p, [i, j, k]).ok) out.push([i, j, k]); } return out; }
  function genSel(seed, spectro) {
    var r = rng(seed * 89 + 13);
    for (var a = 0; a < 300; a++) {
      var i = Math.floor(r() * SEL_V.length), j = Math.floor(r() * SEL_B.length), v = SEL_V[i] / SEL_D / SEL_B[j]; if (v < 1e4 || v > 2e6) continue;
      var p = { kind: "sel", v: v };
      if (spectro) { var iso = pick(r, ISOTOPES), k = Math.floor(r() * SEL_B2.length); p.iso = iso.n; p.mass = iso.m * AMU; p.R = p.mass * v / (E_CH * SEL_B2[k]); if (p.R < .02 || p.R > .5) continue; p.solution = [i, j, k]; }
      else p.solution = [i, j];
      var sols = selSolve(p); if (sols.length > (spectro ? 2 : 3)) continue;
      p.brief = spectro ? "Spectrometer: pick plate voltage and B1 so only " + fmtNum(v) + " m/s ions pass straight, then B2 so singly charged " + p.iso + " ions land on the detector " + (p.R * 100).toFixed(1) + " cm away."
        : "Velocity selector, plates 1 cm apart. Only ions with v = E/B go straight through. Pass the " + fmtNum(v) + " m/s beam.";
      return p;
    }
    return null;
  }

  /* ---------- generic check / solve ---------- */
  function check(p, ch) {
    if (p.kind === "diel") return dielCheck(p, ch); if (p.kind === "ohm") return ohmCheck(p, ch); if (p.kind === "sel") return selCheck(p, ch);
    if (p.kind === "gauss" || p.kind === "lines") return { ok: ch === p.solution, why: ch === p.solution ? "" : "Not that one." };
    if (p.kind === "probe") return root.VoltSim.simulate(p, (p.fixed || []).concat(ch)); if (p.kind === "mag") return magSimulate(p, ch);
    return { ok: false };
  }
  function make(spec) { // spec {kind, seed, diff, spectro}
    var k = spec.kind, p = k === "probe" || k === "mag" ? genBoard(k, spec.seed, spec.diff) : k === "diel" ? genDiel(spec.seed, spec.diff) : k === "ohm" ? genOhm(spec.seed, spec.diff)
      : k === "gauss" ? genGauss(spec.seed, spec.diff) : k === "lines" ? genLines(spec.seed) : k === "sel" ? genSel(spec.seed, spec.spectro) : null;
    if (p) { p.kind = k; p.boss = !!spec.boss; p.side = !!spec.side; p.title = spec.title || p.name || TITLES[k]; }
    return p;
  }
  var TITLES = { probe: "Probe board", mag: "Magnet board", diel: "Dielectric capacitor", ohm: "Lamp circuit", gauss: "Gauss's law", lines: "Read the field", sel: "Velocity selector" };

  /* ---------- the Outer Ring: districts 7-12 (stage numbers continue the inner city) ---------- */
  var OUTER = [
    { id: "wharf", stage: 7, name: "Dielectric Wharf", col: "#5eead4", song: [907, "dub"], npc: "Harbourmaster Ngozi",
      blurb: "Rebuild the cargo capacitors: slip a dielectric between the plates to raise C = κε0A/d without letting the field break it down.",
      note: ["Dielectrics", "An insulator between capacitor plates polarises: its molecules line up against the field, so the field inside drops by κ and the capacitance rises by κ. Every insulator has a dielectric strength: above it the field tears electrons loose and it breaks down."],
      puzzles: [{ kind: "diel", seed: 701, diff: .1 }, { kind: "diel", seed: 702, diff: .4 }, { kind: "diel", seed: 703, diff: .6, side: true, title: "Side job: the ferry's flash" }, { kind: "diel", seed: 704, diff: .9, boss: true, title: "Boss: the Breakdown Barge" }] },
    { id: "canal", stage: 8, name: "Current Canal", col: "#fbbf24", song: [908, "funk"], npc: "Lock-keeper Musa",
      blurb: "Charges in motion: light the lock lamps with the right current, I = ε / R, and keep every resistor under its power rating.",
      note: ["Current and resistance", "Current is charge per second, I = Δq/Δt. A resistor obeys Ohm's law V = IR and turns electrical energy into heat at P = I²R = V²/R. In series resistances add; in parallel their reciprocals add, so the total is smaller than either."],
      puzzles: [{ kind: "ohm", seed: 801, diff: .1 }, { kind: "ohm", seed: 802, diff: .5 }, { kind: "ohm", seed: 803, diff: .6, side: true, title: "Side job: the bridge beacon" }, { kind: "ohm", seed: 804, diff: .95, boss: true, title: "Boss: the Overload Locks" }] },
    { id: "grove", stage: 9, name: "Gauss Grove", col: "#86efac", song: [909, "calm"], npc: "Ranger Halima",
      blurb: "Count what is inside: the flux through any closed surface is Q_in / ε0, and field lines tell you where the charges are.",
      note: ["Gauss's law", "Draw any closed surface. The total electric flux out of it equals the charge enclosed divided by ε0. Charges outside add as much flux going in as coming out, so they never count. Field lines begin on + charges and end on − charges."],
      puzzles: [{ kind: "gauss", seed: 901, diff: .2 }, { kind: "lines", seed: 902 }, { kind: "gauss", seed: 903, diff: .5 }, { kind: "lines", seed: 904, side: true, title: "Side job: the firefly survey" }, { kind: "gauss", seed: 905, diff: 1, boss: true, title: "Boss: the Tangled Grove" }] },
    { id: "market", stage: 10, name: "Magnet Market", col: "#f472b6", song: [910, "breaks"], npc: "Trader Kwame",
      blurb: "Moving charges feel magnetic force F = qv × B. Lay magnet tiles to curl charged dust onto the scales.",
      note: ["Magnetic force on a moving charge", "F = qv × B is perpendicular to both the velocity and the field, so it never speeds a charge up or slows it down; it only turns it. In a uniform field a charge moves on a circle of radius r = mv/(qB)."],
      puzzles: [{ kind: "mag", seed: 1001, diff: .1 }, { kind: "mag", seed: 1002, diff: .35 }, { kind: "mag", seed: 1003, diff: .55, side: true, title: "Side job: the spice grinder" }, { kind: "mag", seed: 1004, diff: .8, boss: true, title: "Boss: the Whirlpool Stall" }] },
    { id: "yard", stage: 11, name: "Cyclotron Yard", col: "#a78bfa", song: [911, "synthwave"], npc: "Engineer Bello",
      blurb: "Crossed fields: tune E and B so only the right speed passes straight, v = E / B.",
      note: ["Crossed E and B fields", "A charge in crossed fields feels qE one way and qvB the other. They cancel only when v = E/B, so a velocity selector lets just one speed through. Cyclotrons and mass spectrometers use the same forces."],
      puzzles: [{ kind: "sel", seed: 1101 }, { kind: "sel", seed: 1102 }, { kind: "mag", seed: 1103, diff: .6, side: true, title: "Side job: the loading crane" }, { kind: "sel", seed: 1104, spectro: true, boss: true, title: "Boss: the Isotope Sorter" }] },
    { id: "spire", stage: 12, name: "Spectrum Spire", col: "#fb7185", song: [912, "boss"], npc: "Count Entropy's echo",
      blurb: "Entropy's echo hides in the Spire. Every field you have mastered, in one climb.",
      note: ["Everything together", "Electric fields push along E, magnetic fields turn moving charges, capacitors store charge and energy, and currents carry it. The same few laws, F = qE + qv × B, run every circuit in the city."],
      puzzles: [{ kind: "probe", seed: 1201, diff: .7 }, { kind: "mag", seed: 1202, diff: .75 }, { kind: "diel", seed: 1203, diff: .8 }, { kind: "sel", seed: 1204, spectro: true }, { kind: "probe", seed: 1205, diff: 1, boss: true, title: "Final boss: Entropy's echo" }] }
  ];

  /* ---------- challenge ladder: endless, rising difficulty ---------- */
  var LADDER_KINDS = ["probe", "diel", "mag", "ohm", "gauss", "sel", "lines"];
  function ladder(n) { // rung n ≥ 1
    var kind = LADDER_KINDS[(n - 1) % LADDER_KINDS.length], diff = Math.min(1, (n - 1) / 40);
    return make({ kind: kind, seed: 50000 + n * 7, diff: diff, spectro: kind === "sel" && n > 20, title: "Rung " + n });
  }
  function ladderReward(n) { return 10 + Math.min(90, n * 2); }

  /* ---------- upgrades bought with volts ---------- */
  var UPGRADES = [
    { id: "cells", name: "Extra battery cell", desc: "+1 heart of battery.", max: 3, cost: [80, 160, 260] },
    { id: "dash", name: "Dash capacitor", desc: "Dash recharges 20% faster per level.", max: 3, cost: [60, 120, 200] },
    { id: "visor", name: "Field visor", desc: "Predicted paths on every probe and magnet board.", max: 1, cost: [220] },
    { id: "magnet", name: "Crystal magnet", desc: "Collect charge crystals from further away.", max: 2, cost: [90, 180] }];

  function fmtNum(v) { return v >= 1e6 ? (v / 1e6).toPrecision(3) + "×10⁶" : v >= 1e4 ? (v / 1e3).toPrecision(3) + "×10³" : v.toPrecision(3); }
  function fmt(v, unit) { var a = Math.abs(v), p = a >= 1 ? ["", 1] : a >= 1e-3 ? ["m", 1e-3] : a >= 1e-6 ? ["µ", 1e-6] : a >= 1e-9 ? ["n", 1e-9] : ["p", 1e-12]; return (v / p[1]).toPrecision(3) + " " + p[0] + unit; }

  var api = { EPS0: EPS0, MAG: MAG, magSimulate: magSimulate, genBoard: genBoard, MATS: MATS, GAPS: GAPS, dielC: dielC, dielCheck: dielCheck, dielSolve: dielSolve,
    SHELF: SHELF, ohmNet: ohmNet, ohmCheck: ohmCheck, ohmChoices: ohmChoices, ohmSolve: ohmSolve, inside: inside, gaussFlux: gaussFlux, LINE_SETS: LINE_SETS, setLabel: setLabel,
    lineCharges: lineCharges, fieldE: fieldE, fieldLines: fieldLines, ISOTOPES: ISOTOPES, SEL_V: SEL_V, SEL_B: SEL_B, SEL_D: SEL_D, SEL_B2: SEL_B2, selCheck: selCheck, selSolve: selSolve,
    check: check, make: make, OUTER: OUTER, ladder: ladder, ladderReward: ladderReward, UPGRADES: UPGRADES, fmt: fmt, fmtNum: fmtNum, rng: rng };
  root.VoltLab = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
