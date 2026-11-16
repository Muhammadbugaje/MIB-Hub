/* Logic Labyrinth engine: a tiny digital-logic evaluator, checker and brute-force solver (UMD: window.LogicSim in the
 * browser, module.exports in Node so games/tests/test_logic.py can prove every level is solvable).
 * Signals are 0, 1 or X (2 = floating: an empty socket is an open circuit, and X spreads through any gate it feeds).
 * Chapter packs (logic-300.js, logic-400.js) call LogicSim.add(level, [...]) with their levels.
 *
 * Node kinds in a level (listed in signal order):
 *   { id, k: "gate", g: "AND", ins: [a, b] }        fixed gate (g: AND OR NAND NOR XOR XNOR NOT)
 *   { id, k: "sock", ins: [a, b] }                  2-input socket: the player places a gate from the inventory
 *   { id, k: "sock", ins: [a] }                     1-input socket: a straight wire (default) or a NOT gate
 *   { id, k: "src", opts: ["0", "1", "C", "!C"] }   source socket: pick a constant or a (complemented) signal
 *   { id, k: "eq", ins: [msb ... lsb], val }        comparator box: 1 when the bits read as `val`
 *   { id, k: "mux", ins: [d0, d1, d2, d3], sel: [s1, s0] }   4-to-1 multiplexer
 *   { id, k: "tile", term: "A'B" }  + { id, k: "plane", type: "sop" | "pos", tiles: [...] }   K-map board
 *   { id, k: "ff", t: "D" | "T", ins: [d] }         clocked flip-flop; its output is the stored state
 * Modes: "levers" (every obstacle must read its `need` at the current lever settings), "table" (outputs must match a
 * truth table over every input combination) and "seq" (clocked from reset, the state must follow `seq.runs`). */
(function (root) {
  "use strict";
  var X = 2;
  var TWO = ["AND", "OR", "NAND", "NOR", "XOR", "XNOR"];
  function not(a) { return a === X ? X : 1 - a; }
  function gate(g, a, b) {
    if (g === "NOT") return not(a);
    if (g === "WIRE" || g === "J") return a;
    if (a === X || b === X || a == null || b == null) return X;
    switch (g) {
      case "AND": return a & b; case "OR": return a | b; case "NAND": return 1 - (a & b); case "NOR": return 1 - (a | b);
      case "XOR": return a ^ b; case "XNOR": return 1 - (a ^ b);
    }
    return X;
  }
  function parseTerm(t) { // "A'B" (product) or "A+B'" (sum) -> [{v, neg}]
    var out = [], s = t.replace(/[()·\s]/g, "");
    for (var i = 0; i < s.length; i++) { var c = s[i]; if (c === "+") continue; if (/[A-Z]/.test(c)) out.push({ v: c, neg: false }); else if (c === "'" && out.length) out[out.length - 1].neg = true; }
    return out;
  }
  function sockets(L) { return L.nodes.filter(function (n) { return n.k === "sock" || n.k === "src" || n.k === "tile"; }); }
  function options(L, n) {
    if (n.k === "tile") return ["0", "1"];
    if (n.k === "src") return [""].concat(n.opts);
    var inv = L.inv || {};
    if (n.ins.length === 1) return ["WIRE"].concat(inv.NOT ? ["NOT"] : []);
    return [""].concat(TWO.filter(function (g) { return inv[g]; })).concat(L.jumper ? ["J"] : []);
  }
  function blank(L) { var a = {}; sockets(L).forEach(function (n) { a[n.id] = options(L, n)[0]; }); return a; }
  function usage(L, a) { // gates of each kind the assignment takes from the inventory (shared inverters for !x sources)
    var u = {}, neg = {};
    L.nodes.forEach(function (n) {
      var g = a[n.id];
      if (n.k === "sock" && g && g !== "WIRE" && g !== "J") u[g] = (u[g] || 0) + 1;
      if (n.k === "src" && g && g[0] === "!") neg[g] = 1;
    });
    var k = Object.keys(neg).length; if (k) u.NOT = (u.NOT || 0) + k;
    return u;
  }
  function fits(L, a) { var u = usage(L, a), inv = L.inv || {}; for (var g in u) if (u[g] > (inv[g] || 0)) return false; return true; }
  function planeCost(L, a) {
    var c = 0;
    L.nodes.forEach(function (p) {
      if (p.k !== "plane") return;
      var on = p.tiles.filter(function (t) { return a[t] === "1"; }).map(function (t) { return parseTerm(node(L, t).term); }), negs = {};
      on.forEach(function (lits) { if (lits.length > 1) c++; lits.forEach(function (l) { if (l.neg) negs[l.v] = 1; }); });
      if (on.length > 1) c++; c += Object.keys(negs).length;
    });
    return c;
  }
  function gates(L, a) { // gate count: placed gates + shared inverters + the two-level circuit a K-map cover needs
    var u = usage(L, a), c = 0; for (var g in u) c += u[g]; return c + planeCost(L, a);
  }
  function node(L, id) { if (!L._ix) { L._ix = {}; L.nodes.forEach(function (n) { L._ix[n.id] = n; }); } return L._ix[id]; }
  function sig(v, s) { return s[0] === "!" ? not(v[s.slice(1)]) : v[s]; }
  function evaluate(L, a, inp) {
    var v = { "0": 0, "1": 1 }, k;
    for (k in inp) v[k] = inp[k];
    L.nodes.forEach(function (n) {
      var I = (n.ins || []).map(function (s) { return sig(v, s); }), g = a[n.id];
      switch (n.k) {
        case "gate": v[n.id] = gate(n.g, I[0], I[1]); break;
        case "sock": v[n.id] = !g ? X : gate(g, I[0], I[1]); break;
        case "src": v[n.id] = !g ? X : sig(v, g); break;
        case "eq": if (I.indexOf(X) >= 0) v[n.id] = X; else v[n.id] = I.reduce(function (s, b) { return s * 2 + b; }, 0) === n.val ? 1 : 0; break;
        case "mux": var S = n.sel.map(function (s) { return sig(v, s); }); v[n.id] = S.indexOf(X) >= 0 ? X : I[S[0] * 2 + S[1]]; break;
        case "tile": v[n.id] = g === "1" ? 1 : 0; break;
        case "plane":
          var on = n.tiles.filter(function (t) { return a[t] === "1"; }), sop = n.type !== "pos";
          v[n.id] = on.length ? (sop ? 0 : 1) : (sop ? 0 : 1);
          on.forEach(function (t) {
            var lits = parseTerm(node(L, t).term), val = lits.map(function (l) { return l.neg ? not(v[l.v]) : v[l.v]; });
            var term = sop ? val.every(function (b) { return b === 1; }) : val.some(function (b) { return b === 1; });
            if (sop && term) v[n.id] = 1; if (!sop && !term) v[n.id] = 0;
          });
          break;
        case "ff": if (v[n.id] == null) v[n.id] = 0; break;
      }
    });
    return v;
  }
  function combos(ids) { var out = []; for (var i = 0; i < 1 << ids.length; i++) { var o = {}; ids.forEach(function (id, j) { o[id] = (i >> (ids.length - 1 - j)) & 1; }); out.push(o); } return out; }
  function leverStart(L) { var o = {}; (L.levers || []).forEach(function (l) { o[l.id] = l.v || 0; }); return o; }
  function stateCode(L, st) { return L.seq.ffs.reduce(function (s, q) { return s * 2 + st[q]; }, 0); }
  function clock(L, a, st, set) { // one rising edge: returns the next state (or null if a flip-flop input floats)
    var v = evaluate(L, a, Object.assign({}, set, st)), nx = {};
    for (var i = 0; i < L.seq.ffs.length; i++) {
      var q = L.seq.ffs[i], f = node(L, q), d = sig(v, f.ins[0]); if (d === X) return null;
      nx[q] = f.t === "T" ? st[q] ^ d : d;
    }
    return nx;
  }
  function check(L, a, lev) { // is the level solved by assignment `a` (and levers `lev` in levers mode)?
    lev = lev || leverStart(L);
    if (L.mode === "table") {
      var T = L.table, outs = Object.keys(T.outs), ok = true;
      var rows = combos(T.ins).map(function (c, r) {
        var v = evaluate(L, a, Object.assign({}, lev, c)), res = {};
        outs.forEach(function (o) { var want = T.outs[o][r], got = v[o]; res[o] = got; if (want !== "-" && +want !== got) ok = false; });
        return { inp: c, got: res, ok: outs.every(function (o) { var w = T.outs[o][r]; return w === "-" || +w === res[o]; }) };
      });
      return { ok: ok, rows: rows, good: rows.filter(function (r) { return r.ok; }).length };
    }
    if (L.mode === "seq") {
      var okS = true, runs = L.seq.runs.map(function (run) {
        var st = {}; L.seq.ffs.forEach(function (q) { st[q] = 0; });
        var got = [];
        for (var k = 0; k < run.states.length; k++) {
          got.push(st ? stateCode(L, st) : null);
          if (!st || got[k] !== run.states[k]) { okS = false; if (!st) break; }
          if (k < run.states.length - 1) st = st && clock(L, a, st, run.set || {});
        }
        return { got: got };
      });
      return { ok: okS, runs: runs };
    }
    var v = evaluate(L, a, lev);
    var obs = L.obs.map(function (o) { return v[o.sig] === o.need; });
    return { ok: obs.every(Boolean), v: v, obs: obs };
  }
  // cones: which sockets each table output depends on (lets the solver prune a branch as soon as one output is wrong)
  function cone(L, id, acc) {
    acc = acc || {}; var n = node(L, id); if (!n || acc[id]) return acc;
    if (n.k === "sock" || n.k === "src" || n.k === "tile") acc[id] = 1;
    (n.ins || []).concat(n.sel || [], n.tiles || []).forEach(function (s) { cone(L, s.replace("!", ""), acc); });
    if (n.k === "src") n.opts.forEach(function (s) { cone(L, s.replace("!", ""), acc); });
    return acc;
  }
  function moves(L, a, lev) { // fewest player actions from the start: every changed socket, plus lever flips in levers mode
    var d = blank(L), m = 0; for (var k in a) if (a[k] !== d[k]) m++;
    if (L.mode === "levers") { var s = leverStart(L); for (var l in s) if (lev[l] !== s[l]) m++; }
    return m;
  }
  function solve(L, limit) { // brute force over socket assignments (and lever settings): count, fewest gates, fewest moves
    var S = sockets(L), opts = S.map(function (n) { return options(L, n); }), res = { count: 0, best: Infinity, par: Infinity, sol: null, parSol: null };
    var checks = [];
    if (L.mode === "table") {
      var outs = Object.keys(L.table.outs), rowsIn = combos(L.table.ins), lev0 = leverStart(L);
      outs.forEach(function (o) { var c = cone(L, o), last = -1; S.forEach(function (n, i) { if (c[n.id]) last = i; }); (checks[last] = checks[last] || []).push(o); });
      var partial = function (a, list) {
        return rowsIn.every(function (c, r) { var v = evaluate(L, a, Object.assign({}, lev0, c)); return list.every(function (o) { var w = L.table.outs[o][r]; return w === "-" || +w === v[o]; }); });
      };
    }
    var levs = L.mode === "levers" ? combos((L.levers || []).map(function (l) { return l.id; })) : [null], a = {};
    (function rec(i) {
      if (limit && res.count >= limit) return;
      if (i === S.length) {
        if (!fits(L, a)) return;
        levs.forEach(function (lv) {
          if (!check(L, a, lv || undefined).ok) return;
          var g = gates(L, a), m = moves(L, a, lv || leverStart(L));
          res.count++;
          if (g < res.best) { res.best = g; res.sol = { a: Object.assign({}, a), lev: lv }; }
          if (m < res.par) { res.par = m; res.parSol = { a: Object.assign({}, a), lev: lv }; }
        });
        return;
      }
      for (var j = 0; j < opts[i].length; j++) {
        a[S[i].id] = opts[i][j];
        if (!fits(L, a)) continue;
        if (checks[i] && !partial(a, checks[i])) continue;
        rec(i + 1);
      }
      delete a[S[i].id];
    })(0);
    return res;
  }

  /* daily room: a random gate network on four levers, the same for everyone on a date (levers mode, gates fixed) */
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function daily(dateStr) {
    var base = hashStr("logic-labyrinth:" + dateStr), ids = ["A", "B", "C", "D"], names = { AND: "AND", OR: "OR", NAND: "NAND", NOR: "NOR", XOR: "XOR", XNOR: "XNOR" };
    for (var k = 0; k < 200; k++) {
      var R = rng(base + k * 7919), pick = function (a) { return a[Math.floor(R() * a.length)]; };
      var g1 = pick(TWO), g2 = pick(TWO), g3 = pick(TWO), g4 = pick(TWO), hid = {}; ids.forEach(function (id) { hid[id] = R() < .5 ? 1 : 0; });
      var L = { name: "Daily room · " + dateStr, daily: dateStr, level: 300, course: "Daily puzzle", concept: "Reading a gate network", song: [500 + (base % 97), pick(["calm", "synthwave", "chip"])], mode: "levers",
        levers: ids.map(function (id, i) { return { id: id, v: 0, label: id, at: [52, 70 + i * 50] }; }),
        nodes: [{ id: "p", k: "gate", g: g1, ins: ["A", "B"], at: [200, 95] }, { id: "q", k: "gate", g: g2, ins: ["C", "D"], at: [200, 225] },
          { id: "r", k: "gate", g: g3, ins: ["p", "q"], at: [360, 120] }, { id: "s", k: "gate", g: g4, ins: ["q", "A"], at: [360, 236] }] };
      var v = evaluate(L, {}, hid);
      L.obs = [{ k: "door", sig: "r", need: v.r }, { k: "laser", sig: "s", need: v.s }, { k: "bridge", sig: "p", need: v.p }];
      var res = solve(L), start = check(L, {}).ok;
      if (start || res.count < 1 || res.count > 2 || res.par < 2) continue;
      var sol = res.parSol.lev, set = ids.filter(function (id) { return sol[id]; });
      L.best = 0; L.par = res.par;
      L.intro = "Today's room is the same for everyone. The bridge needs " + g1 + "(A, B) = " + v.p + ", the laser needs " + g4 + "(q, A) = " + v.s + " and the door needs " + g3 + "(p, q) = " + v.r + ". Set the four levers.";
      L.hints = ["Start with the bridge: which A, B make " + g1 + " give " + v.p + "?", "q = " + g2 + "(C, D). Find the q that satisfies both the door and the laser, then choose C and D.", "Switch on " + (set.length ? set.join(", ") : "nothing") + " and leave the rest at 0."];
      L.explain = "p = " + g1 + "(A, B), q = " + g2 + "(C, D), door = " + g3 + "(p, q), laser = " + g4 + "(q, A). Working backwards from each output narrows the levers down.";
      return L;
    }
    return null;
  }
  var LEVELS = [];
  function add(level, list) {
    list.forEach(function (L) { L.level = level; L.mode = L.mode || "levers"; LEVELS.push(L); });
    LEVELS.sort(function (p, q) { return p.level - q.level; });
  }
  root.LogicSim = { X: X, TWO: TWO, gate: gate, not: not, parseTerm: parseTerm, sockets: sockets, options: options, blank: blank,
    usage: usage, fits: fits, gates: gates, evaluate: evaluate, check: check, combos: combos, leverStart: leverStart, clock: clock,
    stateCode: stateCode, solve: solve, daily: daily, rng: rng, hashStr: hashStr, moves: moves, node: node, sig: sig, LEVELS: LEVELS, add: add };
  if (typeof module !== "undefined") module.exports = root.LogicSim;
})(typeof window !== "undefined" ? window : globalThis);
