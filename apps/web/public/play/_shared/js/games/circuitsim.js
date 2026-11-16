/* Circuit Forge solver: modified nodal analysis on a small netlist (node 0 = ground), DC and AC (phasors).
 * Elements in a level's netlist:
 *   { k: "R", a, b, R }              resistor (lamps, meters and wires are resistors too; R null = open circuit)
 *   { k: "E", a, b, E, r }           cell: emf E driving current out of a (+), internal resistance r > 0
 *   { k: "C", a, b, C }              capacitor: open in DC, impedance 1/(jωC) in AC
 *   { k: "L", a, b, L }              inductor: short in DC, impedance jωL in AC
 *   { k: "D", a, b, Vf, rd, Imax }   LED / diode from anode a to cathode b: off below Vf, then Vf + I·rd
 *   { k: "OA", p, m, o }             ideal op-amp (gain 10⁵, output resistance 1 mΩ to ground reference)
 * A slot is an element with role "slot": the player fills it with a part from the tray. A tray item is a number
 * (a resistor in ohms) or a part object { k: "R"|"C"|"L"|"E"|"D"|"W" (wire), value fields, label }.
 * A level has `goal` or `goals` (all must be met). Goal kinds: I (element current), V (node a − b), P (power in an
 * element), Req (resistance seen between a and b with sources zeroed), tau (R_th seen by a capacitor × C),
 * f0 (resonant frequency of an L and a C), Vac / Iac (AC magnitudes at the level's frequency f), gain (|Vab| / source),
 * pf (power factor at a source). */
(function (root) {
  "use strict";
  var OPEN = 1e12, SHORT = 1e-6, OA_GAIN = 1e5, OA_GOUT = 1e3;
  /* ---- complex numbers ---- */
  function cx(re, im) { return { re: re, im: im || 0 }; }
  function cadd(a, b) { return cx(a.re + b.re, a.im + b.im); } function csub(a, b) { return cx(a.re - b.re, a.im - b.im); }
  function cmul(a, b) { return cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); }
  function cdiv(a, b) { var d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); }
  function cabs(a) { return Math.hypot(a.re, a.im); }
  /* one linear solve: G v = I over complex numbers (DC uses im = 0) */
  function linsolve(N, G, I) {
    for (var c = 0; c < N; c++) {
      var p = c; for (var r = c + 1; r < N; r++) if (cabs(G[r][c]) > cabs(G[p][c])) p = r;
      var t = G[c]; G[c] = G[p]; G[p] = t; t = I[c]; I[c] = I[p]; I[p] = t;
      if (cabs(G[c][c]) < 1e-300) continue;
      for (r = c + 1; r < N; r++) { var f = cdiv(G[r][c], G[c][c]); if (!f.re && !f.im) continue; for (var k = c; k < N; k++) G[r][k] = csub(G[r][k], cmul(f, G[c][k])); I[r] = csub(I[r], cmul(f, I[c])); }
    }
    var v = new Array(N);
    for (r = N - 1; r >= 0; r--) { var s = I[r]; for (k = r + 1; k < N; k++) s = csub(s, cmul(G[r][k], v[k])); v[r] = cabs(G[r][r]) < 1e-300 ? cx(0) : cdiv(s, G[r][r]); }
    return v;
  }
  function admittance(e, w) { // element admittance (complex) for passive kinds
    if (e.k === "R") return cx(1 / (e.R == null ? OPEN : Math.max(e.R, SHORT)));
    if (e.k === "C") return w ? cx(0, w * e.C) : cx(1 / OPEN);
    if (e.k === "L") return w ? cdiv(cx(1), cx(0, w * e.L)) : cx(1 / SHORT);
    return null;
  }
  /* solveNet(n, els, w): w = 0 for DC. Returns complex node voltages and element currents (a → b inside the element;
   * for sources, the current out of terminal a into the circuit). */
  function solveNet(n, els, w) {
    var N = n - 1, G = [], I = [], r, c;
    for (r = 0; r < N; r++) { G.push([]); for (c = 0; c < N; c++) G[r].push(cx(0)); I.push(cx(0)); }
    function stamp(a, b, y) { if (a) G[a - 1][a - 1] = cadd(G[a - 1][a - 1], y); if (b) G[b - 1][b - 1] = cadd(G[b - 1][b - 1], y); if (a && b) { G[a - 1][b - 1] = csub(G[a - 1][b - 1], y); G[b - 1][a - 1] = csub(G[b - 1][a - 1], y); } }
    els.forEach(function (e) {
      var y = admittance(e, w);
      if (y) stamp(e.a, e.b, y);
      else if (e.k === "E") { var g = 1 / Math.max(e.r, SHORT); stamp(e.a, e.b, cx(g)); if (e.a) I[e.a - 1] = cadd(I[e.a - 1], cx(e.E * g)); if (e.b) I[e.b - 1] = csub(I[e.b - 1], cx(e.E * g)); }
      else if (e.k === "OA") { if (e.o) { G[e.o - 1][e.o - 1] = cadd(G[e.o - 1][e.o - 1], cx(OA_GOUT)); if (e.p) G[e.o - 1][e.p - 1] = csub(G[e.o - 1][e.p - 1], cx(OA_GOUT * OA_GAIN)); if (e.m) G[e.o - 1][e.m - 1] = cadd(G[e.o - 1][e.m - 1], cx(OA_GOUT * OA_GAIN)); } }
    });
    var vv = linsolve(N, G, I), v = [cx(0)].concat(vv);
    var cur = els.map(function (e) {
      if (e.k === "OA") return cx(0);
      var dv = csub(v[e.a], v[e.b]), y = admittance(e, w);
      if (y) return cmul(dv, y);
      if (e.k === "E") return cdiv(csub(cx(e.E), dv), cx(Math.max(e.r, SHORT)));
      return cx(0);
    });
    return { v: v, i: cur };
  }
  function real(sol) { return { v: sol.v.map(function (z) { return z.re; }), i: sol.i.map(function (z) { return z.re; }), cv: sol.v, ci: sol.i }; }
  /* DC solve with diodes: iterate each diode between off (open) and on (Vf + I·rd) until stable */
  function solveDC(n, els) {
    var on = els.map(function () { return false; }), sol;
    for (var it = 0; it < 12; it++) {
      var net = els.map(function (e, i) { if (e.k !== "D") return e; return on[i] ? { k: "E", a: e.b, b: e.a, E: -e.Vf, r: e.rd || 1 } : { k: "R", a: e.a, b: e.b, R: null }; });
      sol = real(solveNet(n, net, 0));
      var changed = false;
      els.forEach(function (e, i) { if (e.k !== "D") return; var vd = sol.v[e.a] - sol.v[e.b], now = on[i] ? sol.i[i] > 0 : vd > e.Vf; if (now !== on[i]) { on[i] = now; changed = true; } });
      if (!changed) break;
    }
    sol.on = on; return sol;
  }
  function solve(n, els) { return solveDC(n, els); } // kept for the old API and tests
  /* ---- parts and slots ---- */
  function part(v) { return typeof v === "number" ? { k: "R", R: v } : v; }
  function fillEls(L, fill) {
    return L.els.map(function (e, i) {
      if (e.role !== "slot") return Object.assign({}, e);
      var p = fill[i] == null ? null : part(fill[i]), c = { a: e.a, b: e.b, role: "slot", name: e.name, part: p };
      if (!p) return Object.assign(c, { k: "R", R: null });
      if (p.k === "W") return Object.assign(c, { k: "R", R: 0 });
      if (p.k === "E") return Object.assign(c, { k: "E", a: e.b, b: e.a, E: p.E, r: p.r || .001 }); // a cell in a slot pushes current from the slot's a end towards its b end
      return Object.assign(c, p, { a: e.a, b: e.b, role: "slot", name: e.name, part: p });
    });
  }
  function zeroSources(els) { return els.map(function (e) { return e.k === "E" ? Object.assign({}, e, { E: 0 }) : e.k === "D" ? Object.assign({}, e, { k: "R", R: null }) : e; }); }
  function reqBetween(n, els, a, b) { // resistance seen between a and b with every source zeroed
    var t = zeroSources(els).concat([{ k: "E", a: a, b: b, E: 1, r: SHORT }]), s = solveDC(n, t), I = s.i[t.length - 1];
    return Math.abs(I) < 1e-12 ? Infinity : 1 / Math.abs(I);
  }
  function measure(L, g, els, dc, ac) {
    if (g.what === "I") return Math.abs(dc.i[g.el]);
    if (g.what === "V") return dc.v[g.a] - dc.v[g.b];
    if (g.what === "P") { var e = els[g.el]; return e.k === "R" ? dc.i[g.el] * dc.i[g.el] * (e.R || 0) : Math.abs(dc.i[g.el] * (dc.v[e.a] - dc.v[e.b])); }
    if (g.what === "Req") return reqBetween(L.nodes.length, els.map(function (q) { return q.k === "C" ? Object.assign({}, q, { k: "R", R: null }) : q; }), g.a, g.b);
    if (g.what === "tau") { var c = els[g.el]; if (c.k !== "C") return NaN; var rest = els.map(function (q, i) { return i === g.el ? { k: "R", a: q.a, b: q.b, R: null } : q.k === "C" ? Object.assign({}, q, { k: "R", R: null }) : q; }); return reqBetween(L.nodes.length, rest, c.a, c.b) * c.C; }
    if (g.what === "f0") { var l = els[g.L], cc = els[g.C]; if (l.k !== "L" || cc.k !== "C") return NaN; return 1 / (2 * Math.PI * Math.sqrt(l.L * cc.C)); }
    if (!ac) return NaN;
    if (g.what === "Vac") return cabs(csub(ac.cv[g.a], ac.cv[g.b]));
    if (g.what === "Iac") return cabs(ac.ci[g.el]);
    if (g.what === "gain") return cabs(csub(ac.cv[g.a], ac.cv[g.b])) / Math.abs(els[g.src].E);
    if (g.what === "pf") { var I = ac.ci[g.el]; if (cabs(I) < 1e-9) return 0; return Math.cos(Math.atan2(I.im, I.re)); } // no current: no power factor
    return NaN;
  }
  function goals(L) { return L.goals || [L.goal]; }
  function check(L, fill) { // fill: slot index (in els order) -> part (ohms or a part object)
    var els = fillEls(L, fill), n = L.nodes.length, dc = solveDC(n, els), ac = L.f ? real(solveNet(n, els.map(function (e) { return e.k === "D" ? { k: "R", a: e.a, b: e.b, R: null } : e; }), 2 * Math.PI * L.f)) : null;
    var vals = goals(L).map(function (g) { return measure(L, g, els, dc, ac); });
    var oks = goals(L).map(function (g, k) { return vals[k] >= g.lo && vals[k] <= g.hi; });
    var blown = els.some(function (e, i) { return (e.role === "lamp" && dc.i[i] * dc.i[i] * e.R > e.pmax) || (e.k === "D" && e.Imax && dc.i[i] > e.Imax); });
    return { ok: oks.every(Boolean) && !blown, oks: oks, values: vals, value: vals[0], blown: blown, sol: dc, ac: ac, els: els };
  }
  function slotsOf(L) { return L.els.map(function (e, i) { return e.role === "slot" ? i : -1; }).filter(function (i) { return i >= 0; }); }
  /* every way of putting distinct tray parts into the slots that meets the goals */
  function solutions(L, limit) {
    var sl = slotsOf(L), out = [];
    (function rec(k, fill, used) {
      if (limit && out.length >= limit) return;
      if (k === sl.length) { if (check(L, fill).ok) out.push(Object.assign({}, fill)); return; }
      L.tray.forEach(function (v, j) { if (used.indexOf(j) >= 0) return; fill[sl[k]] = v; rec(k + 1, fill, used.concat([j])); delete fill[sl[k]]; });
    })(0, {}, []);
    return out;
  }
  // Each level: nodes (with screen positions), elements (with roles), a tray of parts and goals checked on the solution.
  // Positions are in a 960x540 canvas. Lamp max power before it blows: pmax (W).
  // A plain rectangular loop: nodes 0 (bottom-left), 1 (top-left), 2 (top-middle), 3 (top-right), 4 (bottom-right).
  function loop() { return [[180, 430], [180, 150], [470, 150], [780, 150], [780, 430]]; }
  var LEVELS = [
    { name: "One lamp, one resistor", course: "PHYS 162: Ohm's law", tray: [2, 4, 8, 12],
      text: "The lamp (4 Ω) wants exactly 0.50 A from the 6 V cell. Pick the series resistor. Ohm's law: I = V / R_total.",
      nodes: [[200, 420], [200, 160], [600, 160], [760, 160], [760, 420]],
      els: [{ k: "E", a: 1, b: 0, E: 6, r: 0.001, role: "cell" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" }, { k: "R", a: 2, b: 3, R: null, role: "slot" },
        { k: "R", a: 3, b: 4, R: 4, role: "lamp", pmax: 2 }, { k: "R", a: 4, b: 0, R: 0, role: "ammeter" }],
      goal: { what: "I", el: 3, lo: 0.48, hi: 0.52, label: "Lamp current", unit: "A" },
      explain: "Total resistance 8 + 4 = 12 Ω, so I = 6 / 12 = 0.5 A. Series resistances add." },
    { name: "Two in parallel", course: "PHYS 162: series and parallel", tray: [3, 4, 6, 12],
      text: "12 V cell, 6 Ω lamp. Fill both parallel slots so the lamp gets 1.5 A. Parallel resistors: 1/R = 1/R₁ + 1/R₂.",
      nodes: [[160, 440], [160, 200], [400, 200], [400, 200], [620, 200], [800, 200], [800, 440]],
      els: [{ k: "E", a: 1, b: 0, E: 12, r: 0.001, role: "cell" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" },
        { k: "R", a: 2, b: 4, R: null, role: "slot", bend: -80 }, { k: "R", a: 2, b: 4, R: null, role: "slot", bend: 80 },
        { k: "R", a: 4, b: 5, R: 6, role: "lamp", pmax: 18 }, { k: "R", a: 5, b: 6, R: 0, role: "wire" }, { k: "R", a: 6, b: 0, R: 0, role: "ammeter" }],
      goal: { what: "I", el: 4, lo: 1.47, hi: 1.53, label: "Lamp current", unit: "A" },
      explain: "3 Ω ∥ 6 Ω = 2 Ω. With the 6 Ω lamp the total is 8 Ω, and 12 / 8 = 1.5 A." },
    { name: "The tired cell", course: "PHYS 162: internal resistance", tray: [2, 3, 5, 10],
      text: "This cell has emf 9 V but internal resistance 1 Ω. Choose the load so the voltmeter across it reads 7.5 V. Terminal voltage V = E − Ir.",
      nodes: [[220, 420], [220, 160], [740, 160], [740, 420]],
      els: [{ k: "E", a: 1, b: 0, E: 9, r: 1, role: "cell" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" }, { k: "R", a: 2, b: 3, R: null, role: "slot" }, { k: "R", a: 3, b: 0, R: 0, role: "wire" }],
      goal: { what: "V", a: 2, b: 3, lo: 7.45, hi: 7.55, label: "Load voltage", unit: "V" },
      explain: "I = 9 / (5 + 1) = 1.5 A, so V = E − Ir = 9 − 1.5 = 7.5 V. A real cell loses voltage inside itself." },
    { name: "Balance the bridge", course: "PHYS 162: metre bridge", tray: [5, 10, 15, 20, 25],
      text: "Wheatstone bridge: P = 10 Ω, Q = 20 Ω, S = 30 Ω. Pick R so the galvanometer reads zero. At balance P/Q = R/S.",
      nodes: [[480, 110], [290, 260], [670, 260], [480, 410], [130, 110], [130, 410]],
      els: [{ k: "E", a: 4, b: 5, E: 6, r: 0.5, role: "cell" }, { k: "R", a: 4, b: 0, R: 0, role: "wire" }, { k: "R", a: 5, b: 3, R: 0, role: "wire" },
        { k: "R", a: 0, b: 1, R: 10, role: "fixed", name: "P" }, { k: "R", a: 0, b: 2, R: 20, role: "fixed", name: "Q" },
        { k: "R", a: 1, b: 3, R: null, role: "slot", name: "R" }, { k: "R", a: 2, b: 3, R: 30, role: "fixed", name: "S" },
        { k: "R", a: 1, b: 2, R: 50, role: "galvo" }],
      goal: { what: "I", el: 7, lo: 0, hi: 0.0005, label: "Galvanometer current", unit: "A" },
      explain: "P/Q = 10/20 = R/S = 15/30. At balance both midpoints sit at the same potential, so no current crosses the galvanometer. The metre bridge uses the same idea." },
    { name: "Count Entropy's two cells", course: "PHYS 122: Kirchhoff's laws", tray: [1, 2, 4, 6, 8],
      text: "Two cells share one load: 12 V (r = 1 Ω) and 6 V (r = 1 Ω) in parallel. Pick the load that draws 3.6 A. Use Kirchhoff's junction and loop rules.",
      nodes: [[160, 440], [160, 150], [480, 150], [480, 440], [800, 150], [800, 440]],
      els: [{ k: "E", a: 1, b: 0, E: 12, r: 1, role: "cell" }, { k: "R", a: 1, b: 2, R: 0, role: "wire" }, { k: "R", a: 2, b: 3, R: null, role: "slot" },
        { k: "R", a: 3, b: 0, R: 0, role: "wire" }, { k: "R", a: 2, b: 4, R: 0, role: "wire" }, { k: "E", a: 4, b: 5, E: 6, r: 1, role: "cell" }, { k: "R", a: 5, b: 3, R: 0, role: "wire" }],
      goal: { what: "I", el: 2, lo: 3.55, hi: 3.65, label: "Load current", unit: "A" },
      explain: "Superposition or Kirchhoff: the two cells act like 9 V behind 0.5 Ω, so 9 / (0.5 + 2) = 3.6 A." }
  ];
  function norm(L) { L.unit = L.unit || "Ω"; L.scale = L.scale || 1; L.goals = goals(L); L.goal = L.goals[0]; }
  LEVELS.forEach(function (L) { L.level = 100; norm(L); });
  function add(level, list) { list.forEach(function (L) { L.level = level; norm(L); LEVELS.push(L); }); LEVELS.sort(function (a, b) { return a.level - b.level || (a.order || 0) - (b.order || 0); }); }
  /* ---- layout helpers for chapter files ----
   * ring(items): a cell (or AC source) on the left and up to four elements round a rectangle, then back to ground.
   * Element positions: 0 top-left, 1 top-right, 2 right side, 3 bottom (each item: an element without a, b). */
  function ring(src, items) {
    var nodes = [[180, 430], [180, 150], [480, 150], [780, 150], [780, 430], [480, 430]], els = [Object.assign({ a: 1, b: 0 }, src)];
    var spans = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 0]];
    for (var k = 0; k < 5; k++) { var it = items[k] || { k: "R", R: 0, role: "wire" }; els.push(Object.assign({}, it, { a: spans[k][0], b: spans[k][1] })); }
    return { nodes: nodes, els: els };
  }
  /* divider(src, top, bottom, load): source, a top element, then a bottom element and an optional load from the
   * middle node (2) to ground (0). Node 1 is the supply rail, node 2 the output. */
  function divider(src, top, bottom, load) {
    var nodes = [[180, 430], [180, 140], [560, 140], [560, 430], [800, 140], [800, 430]];
    var els = [Object.assign({ a: 1, b: 0 }, src), Object.assign({}, top, { a: 1, b: 2 }), Object.assign({}, bottom, { a: 2, b: 3 }), { k: "R", a: 3, b: 0, R: 0, role: "wire" }];
    if (load) els.push({ k: "R", a: 2, b: 4, R: 0, role: "wire" }, Object.assign({}, load, { a: 4, b: 5 }), { k: "R", a: 5, b: 3, R: 0, role: "wire" });
    return { nodes: nodes, els: els };
  }
  /* opamp(kind, vin, rin, rf, rg): inverting or non-inverting amplifier. Nodes: 0 ground, 1 input source +,
   * 2 inverting input (−), 3 output, 4 non-inverting input (+), 5 output meter end. */
  function opamp(kind, vin, rin, rf) {
    var els;
    if (kind === "inv") { // nodes: 0 ground rail, 1 input, 2 − input, 3 output, 4 + input (grounded), 5 load foot
      var nodes = [[120, 420], [120, 234], [400, 234], [820, 234], [560, 420], [820, 420]];
      els = [Object.assign({ a: 1, b: 0 }, vin), Object.assign({}, rin, { a: 1, b: 2 }), Object.assign({}, rf, { a: 2, b: 3, bend: -120 }), { k: "R", a: 4, b: 0, R: 0, role: "wire" },
        { k: "OA", p: 4, m: 2, o: 3, role: "opamp" }, { k: "R", a: 3, b: 5, R: 10000, role: "fixed", name: "load 10 kΩ" }, { k: "R", a: 5, b: 4, R: 0, role: "wire" }];
      return { nodes: nodes, els: els };
    }
    // non-inverting (+ input drawn on top): 0 ground rail, 1 input, 2 − input, 3 output, 4 + input, 5 load foot, 6 R₁ foot, 7 feedback corner
    var nodes2 = [[120, 420], [120, 208], [560, 330], [820, 234], [400, 208], [820, 420], [560, 420], [820, 330]];
    els = [Object.assign({}, vin, { a: 1, b: 0 }), Object.assign({}, rin, { a: 2, b: 6 }), Object.assign({}, rf, { a: 2, b: 7 }), { k: "R", a: 1, b: 4, R: 0, role: "wire" },
      { k: "OA", p: 4, m: 2, o: 3, role: "opamp", flip: true }, { k: "R", a: 3, b: 7, R: 0, role: "wire" }, { k: "R", a: 7, b: 5, R: 10000, role: "fixed", name: "load 10 kΩ" },
      { k: "R", a: 5, b: 6, R: 0, role: "wire" }, { k: "R", a: 6, b: 0, R: 0, role: "wire" }];
    return { nodes: nodes2, els: els };
  }
  /* daily puzzle: a voltage divider or a series lamp circuit with values drawn from the E12 series */
  var E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function daily(dateStr) {
    var base = hashStr("circuit-forge:" + dateStr);
    for (var k = 0; k < 200; k++) {
      var R = rng(base + k * 104729), pick = function (a) { return a[Math.floor(R() * a.length)]; }, V = pick([5, 6, 9, 12, 24]);
      var r1 = pick(E12) * 100, r2 = pick(E12) * 100, decoys = [], kind = R() < .5 ? "div" : "two";
      while (decoys.length < 3) { var d = pick(E12) * pick([10, 100, 1000]); if (d !== r1 && d !== r2 && decoys.indexOf(d) < 0) decoys.push(d); }
      var tray = [r1, r2].concat(decoys).sort(function (a, b) { return a - b; }), L, vout = V * r2 / (r1 + r2);
      if (kind === "div") {
        var lay = divider({ k: "E", E: V, r: 0.001, role: "cell" }, { k: "R", R: null, role: "slot", name: "R₁" }, { k: "R", R: null, role: "slot", name: "R₂" });
        L = { name: "Daily divider · " + dateStr, course: "Daily puzzle", tray: tray, unit: "kΩ", scale: 1000, nodes: lay.nodes, els: lay.els,
          text: "Make " + vout.toFixed(2) + " V at the output from " + V + " V. V_out = V × R₂ / (R₁ + R₂). Today's puzzle is the same for everyone.",
          goals: [{ what: "V", a: 2, b: 3, lo: vout * .99, hi: vout * 1.01, label: "Output voltage", unit: "V" }], explain: "V_out = " + V + " × " + r2 / 1000 + " / (" + r1 / 1000 + " + " + r2 / 1000 + ") = " + vout.toFixed(2) + " V." };
      } else {
        var I = V / (r1 + r2), lay2 = ring({ k: "E", E: V, r: 0.001, role: "cell" }, [{ k: "R", R: null, role: "slot", name: "R₁" }, { k: "R", R: null, role: "slot", name: "R₂" }, { k: "R", R: 0, role: "ammeter" }]);
        L = { name: "Daily series · " + dateStr, course: "Daily puzzle", tray: tray, unit: "kΩ", scale: 1000, nodes: lay2.nodes, els: lay2.els,
          text: "Make the current " + (I * 1000).toFixed(3) + " mA from " + V + " V with two resistors in series. I = V / (R₁ + R₂).",
          goals: [{ what: "I", el: 3, lo: I * .99, hi: I * 1.01, label: "Current", unit: "A" }], explain: "I = " + V + " / (" + r1 / 1000 + " + " + r2 / 1000 + ") kΩ = " + (I * 1000).toFixed(3) + " mA." };
      }
      L.level = 100; L.daily = dateStr; norm(L);
      var s = solutions(L, 3); if (s.length < 1 || s.length > 2 || check(L, {}).ok) continue; // two orders of the same pair are fine for series
      return L;
    }
    return null;
  }
  root.CircuitSim = { solve: solve, solveDC: solveDC, solveNet: solveNet, LEVELS: LEVELS, check: check, solutions: solutions, slotsOf: slotsOf, part: part, OPEN: OPEN, add: add,
    loop: loop, ring: ring, divider: divider, opamp: opamp, daily: daily, cabs: cabs, reqBetween: reqBetween, fillEls: fillEls, E12: E12 };
  if (typeof module !== "undefined") module.exports = root.CircuitSim;
})(typeof window !== "undefined" ? window : globalThis);
