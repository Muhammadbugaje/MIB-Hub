/* Gridkeepers: Storm Map — the distribution network model (EEEN 327: energy sources, transmission and distribution).
   Pure and deterministic, so the Node tests can prove every incident can be restored safely.

   The network: substations (sources with a capacity in MW) feed radial feeders. Each feeder is a chain of line sections
   (edges). An edge may carry a circuit breaker (at the substation, remote-controlled, trips on faults), a manual switch
   (operated on site by the crew truck) or nothing. Normally-open tie switches join feeder ends, so healthy sections can
   be back-fed from a neighbour. Some sections have a fault passage indicator (FPI) that lights if fault current passed.

   Rules (the safety and protection the game enforces):
     · energising a faulted section trips the nearest upstream breaker (permanent faults) — a transient fault clears on
       the first reclose
     · a section may only be repaired when it is dead and earthed; closing a switch that would make an earthed section
       live is blocked by the interlock (and counts as a safety violation)
     · two live areas may never be joined (no loops, no paralleling sources); a feeder may never be back-fed into a
       substation that has lost supply unless its breaker is open first
     · each source's load must stay within its capacity, and every served customer needs voltage ≥ 0.92 per unit, using a
       radial voltage-drop estimate ΔV = R·P along each section (per unit on the feeder base) */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.GridSim = factory(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VMIN = .92, SPEED = .12, T_SWITCH = 3, T_EARTH = 5, T_REPAIR = 30; // minutes per px of driving, per operation
  function rng(seed) { var s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0 || 1; for (var w = 0; w < 4; w++) s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------- incident generator ---------- */
  function params(i) {
    return { subs: i < 6 ? 1 : i < 16 ? 2 : 3, feeders: i < 2 ? 2 : i < 10 ? 2 : 3, len: Math.min(6, 3 + Math.floor(i / 5)), faults: 1 + Math.floor(i / 6) + (i >= 20 ? 1 : 0),
      transient: i >= 3 ? .35 : 0, fpi: i < 8 ? 1 : i < 18 ? .6 : .35, dg: i >= 12 && i % 3 === 0, hospital: i >= 4, subOut: i >= 18 && i % 2 === 0, tight: i >= 9 };
  }
  var NAMES = ["Kanti", "Bomo", "Hayin Dogo", "Basawa", "Kongo", "Shika", "Danmagaji", "Jushi", "Tudun Wada", "Palladan", "Dogarawa", "Zango", "Unguwar Kaya", "Gyellesu", "Muchia", "Kwangila", "Wusasa", "Tukur Tukur", "Graceland", "Sabon Gari"];
  function make(level, seedExtra) {
    var P = params(level), r = rng(level * 9973 + 17 + (seedExtra || 0) * 7919), N = [], E = [], ids = 0;
    function node(o) { o.id = ids++; o.load = o.load || 0; o.cust = o.cust || 0; N.push(o); return o; }
    function edge(a, b, dev, extra) { var e = { id: E.length, a: a.id, b: b.id, dev: dev, closed: dev !== "tie", earthed: false, fault: 0, known: false, fpi: false, R: .002 }; for (var k in extra || {}) e[k] = extra[k]; E.push(e); return e; }
    var subs = [], ends = [], ny = P.subs, nm = 0;
    for (var s = 0; s < P.subs; s++) {
      var sx = P.subs === 1 ? 70 : s === 0 ? 70 : s === 1 ? 890 : 480, sy = P.subs === 3 ? (s === 2 ? 50 : 340) : 290;
      var sub = node({ kind: "sub", x: sx, y: sy, name: NAMES[nm++ % NAMES.length] + " substation", cap: 0, out: false }); subs.push(sub);
      for (var f = 0; f < P.feeders; f++) {
        var prev = sub, chain = [];
        for (var k = 0; k < P.len; k++) {
          var t = (k + 1) / (P.len + .5), fy = P.feeders === 1 ? 0 : (f - (P.feeders - 1) / 2) * (P.subs === 3 ? (s === 2 ? 120 : 120) : 150);
          var nx, nyy;
          if (P.subs === 3 && s === 2) { nx = sx + fy; nyy = sy + t * 140; }
          else { var dir = s === 1 ? -1 : 1, span = P.subs === 1 ? 800 : 360; nx = sx + dir * t * span; nyy = sy + fy + (P.subs === 1 ? 0 : 0); }
          var ld = Math.round((.25 + r() * .55) * 100) / 100, n = node({ kind: "load", x: Math.round(nx), y: Math.round(nyy), load: ld, cust: Math.round(ld * 260), name: NAMES[nm++ % NAMES.length] });
          var dev = k === 0 ? "cb" : (k % 2 === 0 ? "sw" : "none");
          edge(prev, n, dev, { feeder: sub.id * 10 + f, sub: sub.id }); chain.push(n); prev = n;
          if (k === 1 && r() < .5 && P.len > 3) { var sp = node({ kind: "load", x: n.x + (r() < .5 ? -30 : 30), y: n.y + (fy >= 0 ? 60 : -60), load: Math.round((.2 + r() * .3) * 100) / 100, cust: 0, name: NAMES[nm++ % NAMES.length] }); sp.cust = Math.round(sp.load * 260); edge(n, sp, "sw", { feeder: sub.id * 10 + f, sub: sub.id, spur: true }); }
        }
        ends.push({ sub: sub, f: f, last: chain[chain.length - 1], mid: chain[Math.floor(chain.length / 2)] });
      }
    }
    // normally-open ties between feeder ends (and between substations)
    for (var i = 0; i + 1 < ends.length; i++) edge(ends[i].last, ends[i + 1].last, "tie", { tie: true, R: .003 });
    if (ends.length > 2) edge(ends[0].mid, ends[ends.length - 1].mid, "tie", { tie: true, R: .003 });
    // capacities: own load plus a margin; tight levels leave little room for transfers
    subs.forEach(function (sb) { var own = N.filter(function (n) { return feederSub(E, N, n) === sb.id; }).reduce(function (a, n) { return a + n.load; }, 0); sb.cap = Math.round(own * (P.tight ? 1.45 : 2.1) * 10) / 10; });
    if (P.hospital) { var cand = N.filter(function (n) { return n.kind === "load"; }); var h = cand[Math.floor(r() * cand.length)]; h.hospital = true; h.name = "General Hospital"; h.cust = Math.max(h.cust, 300); }
    if (P.dg) { var lo = N.filter(function (n) { return n.kind === "load" && !n.hospital; }); var d = lo[Math.floor(r() * lo.length)]; d.dg = { cap: 1.2, on: false }; }
    // the storm: faults on line sections (never on the tie switches)
    var lines = E.filter(function (e) { return !e.tie; }), nf = Math.min(P.faults, lines.length - 1);
    for (var q = 0; q < nf; q++) { var e = lines[Math.floor(r() * lines.length)]; if (e.fault) { q--; continue; } e.fault = r() < P.transient && q > 0 ? 1 : 2; } // 2 = permanent, 1 = transient
    if (P.subOut && subs.length > 1) { // the last substation is lost; the others get just enough spare to share its load
      var lost = subs[subs.length - 1];
      // each of the lost substation's feeders gets a second normally-open tie near its head, so it can be split in two
      E.filter(function (e) { return e.dev === "cb" && e.sub === lost.id; }).forEach(function (cb) { var head = N[cb.b], best = null, bd = 1e9;
        N.forEach(function (n) { if (n.kind !== "load") return; var fs = feederSub(E, N, n); if (fs === lost.id || fs < 0) return; var d = Math.hypot(n.x - head.x, n.y - head.y); if (d < bd) { bd = d; best = n; } });
        if (best) edge(head, best, "tie", { tie: true, R: .003 }); });
      var lostLoad = N.filter(function (n) { return feederSub(E, N, n) === lost.id; }).reduce(function (a2, n) { return a2 + n.load; }, 0); lost.out = true;
      subs.slice(0, -1).forEach(function (sb) { var own = N.filter(function (n) { return feederSub(E, N, n) === sb.id; }).reduce(function (a2, n) { return a2 + n.load; }, 0); sb.cap = Math.round((own * 1.1 + lostLoad / (subs.length - 1) * 1.25) * 10) / 10; }); }
    var net = { level: level, N: N, E: E, P: P, t: 0, truck: subs[0].id, violations: 0, trips: 0, cmi: 0, log: [], done: false };
    // the storm hits with everything closed: protection opens the breakers upstream of each fault and lights the FPIs
    E.filter(function (e) { return e.fault; }).forEach(function (fe) { pathToSource(net, fe).forEach(function (pe) { if (pe.dev !== "cb" && r() < P.fpi) pe.fpi = true; }); var cb = upstreamBreaker(net, fe); if (cb) cb.closed = false; });
    subs.forEach(function (sb) { if (sb.out) E.forEach(function (e) { if (e.dev === "cb" && e.sub === sb.id) e.closed = false; }); });
    E.forEach(function (e) { if (e.fault === 1) { /* transient faults are cleared by the storm's own trip; reclosing restores */ } });
    net.limit = 360 + level * 40; recompute(net);
    return net;
  }
  function feederSub(E, N, n) { var seen = {}, q = [n.id]; seen[n.id] = 1; while (q.length) { var c = q.shift(), cn = N[c]; if (cn.kind === "sub") return c; E.forEach(function (e) { if (e.tie) return; var o = e.a === c ? e.b : e.b === c ? e.a : -1; if (o >= 0 && !seen[o]) { seen[o] = 1; q.push(o); } }); } return -1; }
  function other(e, n) { return e.a === n ? e.b : e.a; }
  function adj(net, n) { return net.E.filter(function (e) { return e.a === n || e.b === n; }); }
  /* the radial path (non-tie edges) from an edge back to its substation */
  function pathToSource(net, edge) {
    var N = net.N, E = net.E, start = edge.a, prev = {}, seen = {}, q = [start]; seen[start] = 1;
    while (q.length) { var c = q.shift(); if (N[c].kind === "sub") { var p = [], k = c; while (prev[k]) { p.push(prev[k].e); k = prev[k].n; } return [edge].concat(p.reverse()).filter(function (x, i, a) { return a.indexOf(x) === i; }); }
      E.forEach(function (e) { if (e.tie || e === edge) return; var o = e.a === c ? e.b : e.b === c ? e.a : -1; if (o >= 0 && !seen[o]) { seen[o] = 1; prev[o] = { n: c, e: e }; q.push(o); } }); }
    return [edge];
  }
  /* the breaker that sees a fault: the first breaker on the live path from the island's source to the fault */
  function feedingBreaker(net, isl, f) {
    var prev = {}, seen = {}, q = [isl.src.id]; seen[isl.src.id] = 1;
    while (q.length) { var c = q.shift(); if (c === f.a || c === f.b) { var p = [], k = c; while (prev[k]) { p.unshift(prev[k].e); k = prev[k].n; } p.push(f); for (var i = 0; i < p.length; i++) if (p[i].dev === "cb") return p[i]; return null; }
      isl.edges.forEach(function (e) { if (e === f || (e.a !== c && e.b !== c)) return; var o = other(e, c); if (!seen[o]) { seen[o] = 1; prev[o] = { n: c, e: e }; q.push(o); } }); }
    return null;
  }
  function upstreamBreaker(net, edge) { var p = pathToSource(net, edge); for (var i = 0; i < p.length; i++) if (p[i].dev === "cb") return p[i]; return null; }

  /* ---------- energisation, load flow and service ---------- */
  function sources(net) { return net.N.filter(function (n) { return (n.kind === "sub" && !n.out) || (n.dg && n.dg.on); }); }
  function islands(net) { // flood from each source through closed edges; faulted closed edges are noted
    var N = net.N, E = net.E, src = sources(net), owner = {}, out = [];
    src.forEach(function (s) {
      if (owner[s.id] != null) return; var isl = { src: s, nodes: [s.id], edges: [], faults: [], earthed: [], other: [] }, q = [s.id]; owner[s.id] = out.length;
      while (q.length) { var c = q.shift(); E.forEach(function (e) { if (!e.closed || (e.a !== c && e.b !== c)) return; if (isl.edges.indexOf(e) < 0) isl.edges.push(e); if (e.fault === 2 || (e.fault === 1 && !e.reclosed)) { if (isl.faults.indexOf(e) < 0) isl.faults.push(e); } if (e.earthed && isl.earthed.indexOf(e) < 0) isl.earthed.push(e);
        var o = other(e, c); if (owner[o] == null) { owner[o] = out.length; isl.nodes.push(o); if (N[o].kind === "sub" && N[o] !== s && !N[o].out) isl.other.push(N[o]); if (N[o].dg && N[o].dg.on && N[o] !== s) isl.other.push(N[o]); q.push(o); } }); }
      out.push(isl);
    });
    return { list: out, owner: owner };
  }
  /* voltage along each island's tree: V(child) = V(parent) − R·(load downstream), per unit */
  function voltages(net, isl) {
    var N = net.N, V = {}, par = {}, order = [isl.src.id], seen = {}; seen[isl.src.id] = 1; V[isl.src.id] = isl.src.kind === "sub" ? 1.03 : 1.0; // substation tap-changers hold 1.03 per unit
    for (var i = 0; i < order.length; i++) { var c = order[i]; isl.edges.forEach(function (e) { if (e.a !== c && e.b !== c) return; var o = other(e, c); if (!seen[o]) { seen[o] = 1; par[o] = { n: c, e: e }; order.push(o); } }); }
    var down = {}; for (var j = order.length - 1; j >= 0; j--) { var n = order[j]; down[n] = (down[n] || 0) + N[n].load; if (par[n]) down[par[n].n] = (down[par[n].n] || 0) + down[n]; }
    order.forEach(function (n) { if (par[n]) V[n] = V[par[n].n] - par[n].e.R * down[n]; });
    return { V: V, total: down[isl.src.id] || 0 };
  }
  function recompute(net) {
    var I = islands(net), N = net.N; net.live = {}; net.V = {}; net.served = {}; net.over = []; net.low = [];
    I.list.forEach(function (isl) { var vv = voltages(net, isl), cap = isl.src.kind === "sub" ? isl.src.cap : isl.src.dg.cap;
      if (vv.total > cap + 1e-9) net.over.push(isl);
      isl.nodes.forEach(function (n) { net.live[n] = true; net.V[n] = vv.V[n]; if (N[n].kind === "load") { if (vv.V[n] >= VMIN) net.served[n] = true; else net.low.push(n); } });
      isl.edges.forEach(function (e) { e.live = true; }); });
    net.E.forEach(function (e) { e.live = !!(net.live[e.a] && net.live[e.b] && e.closed); });
    return I;
  }
  function custOut(net) { return net.N.reduce(function (a, n) { return a + (n.kind === "load" && !net.served[n.id] ? n.cust : 0); }, 0); }
  function custAll(net) { return net.N.reduce(function (a, n) { return a + (n.kind === "load" ? n.cust : 0); }, 0); }
  function advance(net, minutes) { net.cmi += custOut(net) * minutes; net.t += minutes; var h = net.N.filter(function (n) { return n.hospital; })[0]; if (h && !net.served[h.id]) net.hospOut = (net.hospOut || 0) + minutes; }

  /* ---------- crew actions ---------- */
  function route(net, from, to) { // Dijkstra over every line (roads follow the lines), by length
    var N = net.N, d = {}, prev = {}, done = {}; N.forEach(function (n) { d[n.id] = Infinity; }); d[from] = 0;
    for (;;) { var u = -1; N.forEach(function (n) { if (!done[n.id] && d[n.id] < Infinity && (u < 0 || d[n.id] < d[u])) u = n.id; }); if (u < 0 || u === to) break; done[u] = 1;
      adj(net, u).forEach(function (e) { var o = other(e, u), l = Math.hypot(N[o].x - N[u].x, N[o].y - N[u].y); if (d[u] + l < d[o]) { d[o] = d[u] + l; prev[o] = { n: u, e: e }; } }); }
    var path = [], k = to; while (prev[k]) { path.unshift(prev[k].e); k = prev[k].n; } return { len: d[to], edges: path };
  }
  function drive(net, to) { if (to === net.truck) return 0; var r = route(net, net.truck, to); r.edges.forEach(function (e) { if (!e.known) { e.known = true; } }); var m = r.len * SPEED; advance(net, m); net.truck = to; return m; }
  function atEdge(net, e) { return net.truck === e.a || net.truck === e.b; }
  function can(net, e, act) { // why an action is not allowed (or "" if it is)
    if (act === "close" || act === "open") { if (!e.dev || e.dev === "none") return "No switch on this section."; if (e.dev !== "cb" && !atEdge(net, e)) return "Drive the crew to this switch first."; if (act === "close" && e.closed) return "Already closed."; if (act === "open" && !e.closed) return "Already open."; }
    if (act === "earth") { if (!atEdge(net, e)) return "Drive the crew to this section first."; if (e.live) return "Earthing a live section is forbidden: open the switches on both sides first."; if (e.earthed) return "Already earthed."; if (!isolated(net, e)) return "Isolate it first: open the switches on both sides, so no supply can reach it."; }
    if (act === "unearth") { if (!e.earthed) return "Not earthed."; if (!atEdge(net, e)) return "Drive the crew to this section first."; }
    if (act === "repair") { if (!atEdge(net, e)) return "Drive the crew to this section first."; if (!e.known || !e.fault) return "Nothing to repair here."; if (!e.earthed) return "Earth the section before anyone touches it."; if (e.live) return "It is live!"; }
    return "";
  }
  /* is the section bounded by open switches, with no source reachable through closed edges (ignoring e itself)? */
  function isolated(net, e) {
    // a section's switch sits at its `a` end: when it is open, the conductor is cut off from node a
    var N = net.N, seen = {}, q = e.closed ? [e.a, e.b] : [e.b], bad = false; q.forEach(function (n) { seen[n] = 1; });
    while (q.length) { var c = q.shift(); if (N[c].kind === "sub" || (N[c].dg && N[c].dg.on)) bad = true; net.E.forEach(function (x) { if (x === e || !x.closed) return; var o = x.a === c ? x.b : x.b === c ? x.a : -1; if (o >= 0 && !seen[o]) { seen[o] = 1; q.push(o); } }); }
    return !bad;
  }
  function act(net, e, what) {
    var why = can(net, e, what); if (why) return { ok: false, why: why };
    if (what === "open") { e.closed = false; advance(net, e.dev === "cb" ? 1 : T_SWITCH); recompute(net); return { ok: true }; }
    if (what === "close") {
      // simulate the close, then check the interlocks
      if (net.live[e.a] && net.live[e.b]) { net.violations++; return { ok: false, why: "Interlock: both sides are already live — closing would make a loop. Open one side first.", violation: true }; }
      e.closed = true; var I = islands(net), bad = "";
      I.list.forEach(function (isl) { if (isl.earthed.length) bad = bad || "Interlock: closing this would make an earthed section live."; if (isl.other.length) bad = bad || "Interlock: this would join two live sources (a loop). Open the other side first."; });
      if (!bad) { var deadSub = net.N.filter(function (n) { return n.kind === "sub" && n.out; })[0]; if (deadSub) I.list.forEach(function (isl) { if (isl.nodes.indexOf(deadSub.id) >= 0) bad = "Interlock: this would back-feed the dead " + deadSub.name + ". Open its feeder breaker first."; }); }
      if (bad) { e.closed = false; net.violations++; return { ok: false, why: bad, violation: true }; }
      advance(net, e.dev === "cb" ? 1 : T_SWITCH);
      // protection: any fault now energised trips its upstream breaker (a transient fault clears on its first reclose)
      var tripped = null; I.list.forEach(function (isl) { isl.faults.forEach(function (f) { if (f.fault === 1 && !f.reclosed) { f.reclosed = true; f.fault = 0; return; } var cb = feedingBreaker(net, isl, f); if (cb && cb.closed) { cb.closed = false; tripped = cb; } else if (!cb && isl.src.dg) { isl.src.dg.on = false; tripped = e; } }); });
      recompute(net);
      if (tripped) { net.trips++; return { ok: true, tripped: tripped }; }
      if (net.over.length) { net.over.forEach(function (isl) { var cbs = net.E.filter(function (x) { return x.closed && x.dev === "cb" && isl.edges.indexOf(x) >= 0; }); var c = cbs[cbs.length - 1] || e; c.closed = false; }); net.trips++; recompute(net); return { ok: true, overload: true }; }
      return { ok: true };
    }
    if (what === "earth") { e.earthed = true; advance(net, T_EARTH); return { ok: true }; }
    if (what === "unearth") { e.earthed = false; advance(net, T_EARTH); return { ok: true }; }
    if (what === "repair") { e.fault = 0; advance(net, T_REPAIR); return { ok: true }; }
    return { ok: false, why: "?" };
  }
  function dgToggle(net, n) { if (!n.dg) return { ok: false }; if (!n.dg.on) { n.dg.on = true; var I = islands(net), bad = I.list.some(function (isl) { return isl.other.length || isl.earthed.length; }); if (bad) { n.dg.on = false; net.violations++; return { ok: false, why: "Anti-islanding: the solar-battery unit may only run on a section cut off from the grid.", violation: true }; } } else n.dg.on = false; advance(net, 2); recompute(net); return { ok: true }; }
  function finished(net) { var faults = net.E.some(function (e) { return e.fault || e.earthed; }); return !faults && custOut(net) === 0; }
  function stars(net, par) { if (!finished(net) || net.violations > 2 || net.t > net.limit) return 0; return net.cmi <= par * 1.25 ? 3 : net.cmi <= par * 1.9 ? 2 : 1; }

  /* ---------- reference solver (tests and par): knows where the faults are, plans in a sensible safe order ---------- */
  function clone(net) { var c = JSON.parse(JSON.stringify(net)); return c; }
  function solve(net0) {
    var net = clone(net0), steps = [];
    function go(n) { drive(net, n); steps.push(["drive", n]); }
    function op(e, what) { if (e.dev !== "cb") go(atNear(e)); var r = act(net, e, what); steps.push([what, e.id, r.ok, r.why || ""]); return r; }
    function atNear(e) { var ra = route(net, net.truck, e.a).len, rb = route(net, net.truck, e.b).len; return ra <= rb ? e.a : e.b; }
    // 1) restore every breaker whose feeder has only transient faults (try one reclose per tripped breaker)
    net.E.filter(function (e) { return e.dev === "cb" && !e.closed && !net.N.filter(function (n) { return n.id === e.a || n.id === e.b; }).some(function (n) { return n.kind === "sub" && n.out; }); }).forEach(function (cb) { var r = act(net, cb, "close"); steps.push(["close", cb.id, r.ok]); });
    // 2) for each permanent fault: patrol it, open the switches that bound its section, earth, repair, unearth, close
    var faults = net.E.filter(function (e) { return e.fault === 2; });
    faults.forEach(function (f) {
      go(f.a); go(f.b); f.known = true; // patrol the section
      var bound = sectionBounds(net, f); bound.forEach(function (b) { if (b.closed) op(b, "open"); });
      go(atNear(f)); var r1 = act(net, f, "earth"); steps.push(["earth", f.id, r1.ok, r1.why || ""]); act(net, f, "repair"); steps.push(["repair", f.id]); act(net, f, "unearth"); steps.push(["unearth", f.id]);
      bound.forEach(function (b) { if (!b.closed && !b.tie && b.dev !== "cb") op(b, "close"); });
    });
    // 3) every healthy feeder breaker back in (not those of a dead substation: open them instead)
    var dead = net.N.filter(function (n) { return n.kind === "sub" && n.out; }).map(function (n) { return n.id; });
    net.E.forEach(function (e) { if (e.dev !== "cb") return; if (dead.indexOf(e.sub) >= 0) { if (e.closed) op(e, "open"); } else if (!e.closed) op(e, "close"); });
    // 4) pick up what is still dark through the ties, one at a time, keeping within capacity and voltage;
    //    if a whole dead feeder is too much for one neighbour, split it at a mid switch and try again
    for (var pass = 0; pass < 14 && custOut(net) > 0; pass++) {
      net.E.filter(function (e) { return (e.tie || e.dev === "sw") && !e.closed && !e.earthed; }).forEach(function (t) {
        if (custOut(net) === 0) return; var la = !!net.live[t.a], lb = !!net.live[t.b]; if (la === lb) return;
        var before = custOut(net), r = op(t, "close"); recompute(net);
        if (r.ok && (r.tripped || r.overload || net.low.length || custOut(net) >= before)) { if (t.closed) op(t, "open"); if (r.tripped || r.overload) net.E.forEach(function (e) { if (e.dev === "cb" && !e.closed && dead.indexOf(e.sub) < 0) op(e, "close"); }); }
      });
      if (custOut(net) === 0) break;
      // split the largest dark area at the middle switch along it
      var darkStart = net.N.filter(function (n) { return n.kind === "load" && !net.served[n.id] && !n.out; })[0]; if (!darkStart) break;
      var comp = [], seenC = {}, qq = [darkStart.id]; seenC[darkStart.id] = 1; while (qq.length) { var c0 = qq.shift(); adj(net, c0).forEach(function (e) { if (!e.closed || e.tie) return; var o = other(e, c0); if (net.N[o].kind === "sub") return; if (!seenC[o]) { seenC[o] = 1; qq.push(o); } if (e.dev === "sw" && comp.indexOf(e) < 0) comp.push(e); }); }
      if (!comp.length) break; op(comp[Math.floor(comp.length / 2)], "open");
    }
    net.E.forEach(function (e) { if (e.earthed) { go(atNear(e)); act(net, e, "unearth"); } });
    // DG: island a dark pocket if one is left
    net.N.filter(function (n) { return n.dg && !net.served[n.id]; }).forEach(function (n) { go(n.id); var bnd = adj(net, n.id); bnd.forEach(function (b) { if (b.closed && b.dev !== "none" && !b.live) op(b, "open"); }); dgToggle(net, n); });
    recompute(net);
    return { net: net, steps: steps, ok: finished(net) && net.violations === 0, cmi: net.cmi, t: net.t };
  }
  /* the switching devices that bound a faulted section (walk outwards through device-less edges until a switch) */
  function sectionBounds(net, f) {
    var hasDev = f.dev && f.dev !== "none", out = [], seenN = {}, q = hasDev ? [f.b] : [f.a, f.b]; q.forEach(function (n) { seenN[n] = 1; });
    while (q.length) { var c = q.shift(); adj(net, c).forEach(function (e) { if (e === f) return; if (e.dev === "none") { var o = other(e, c); if (!seenN[o]) { seenN[o] = 1; q.push(o); } } else if (out.indexOf(e) < 0) out.push(e); }); }
    if (f.dev && f.dev !== "none") out.push(f);
    return out.filter(function (e) { return e.dev !== "none"; });
  }
  /* an incident the reference crew can fully restore safely (re-rolls the storm until it can); par = its CMI */
  function incident(level, seed) {
    for (var k = 0; k < 40; k++) { var net = make(level, (seed || 0) * 101 + k), r = solve(net); if (r.ok && r.t <= net.limit) { net.par = Math.max(1, r.cmi); net.parT = r.t; return net; } }
    var n2 = make(level, seed || 0); n2.par = 1e9; return n2;
  }
  var LESSONS = [
    "Radial feeders: power flows one way, from the substation out. A fault anywhere trips the breaker at the head of that feeder.",
    "Circuit breakers interrupt fault current and are operated remotely. Line switches cannot break a fault; they only re-route a dead network.",
    "Patrol before you switch: driving a line shows you the damage. Closing onto a permanent fault just trips the breaker again.",
    "Fault passage indicators flash where fault current flowed. The fault lies past the last lit indicator on the path.",
    "Hospitals, water pumps and the like are priority loads: restore them first.",
    "Many storm faults are transient (a branch brushing the line). One reclose often brings everything back.",
    "Before anyone touches a conductor: isolate (open both sides), prove it dead, then earth it. Remove the earths before re-energising.",
    "Sectionalising: open the switches either side of the fault and the healthy sections can be fed again while the crew works.",
    "Normally-open points (tie switches) let a neighbouring feeder back-feed healthy sections beyond a fault.",
    "Never close a tie between two live feeders unless the network is designed for it: you would parallel two sources and create a loop.",
    "Every source has a rating. Transfer only what the neighbour can carry; otherwise its breaker trips on overload.",
    "Voltage drop grows with distance and load (ΔV ≈ R·P per section). A long back-feed may leave the far end below 0.92 per unit.",
    "Split a long transfer: open a switch mid-feeder so each half is fed from the nearer end.",
    "Distributed generation (a solar-battery unit) can supply a small island on its own, but anti-islanding rules forbid it to run while connected to the grid.",
    "When a whole substation is lost, open its feeder breakers before back-feeding — otherwise you energise the dead transformer from the low side.",
    "Customer minutes interrupted (CMI) is how utilities are judged: restore the most customers soonest.",
    "Multiple faults on one feeder: find the one nearest the source first, or the healthy middle stays dark.",
    "Transfer capacity is shared: two neighbours each taking half a dead feeder can succeed where either alone would overload.",
    "Distribution networks are built radial but meshed by ties: secure, simple protection with the option to re-route.",
    "Reclosing logic: a breaker that recloses onto a permanent fault and trips again locks out. Patrol, then switch.",
    "Earths left on a section block re-energising: the interlock protects the crew and the public.",
    "Energy sources differ: a substation transformer is stiff; a battery inverter can only carry a little load.",
    "Restoration plans: isolate, restore upstream, back-feed downstream, repair, then return to the normal configuration.",
    "Long rural feeders sag the most. Utilities add regulators and capacitors; here you shorten the path instead.",
    "Night storms: priorities and safety rules do not change in the dark.",
    "The full picture: protection, isolation, earthing, transfer limits, voltage and priorities — the job of a distribution control engineer.",
    "Every storm is different: Endless storms keep coming. Read the indicators, plan the switching, keep the lights on."
  ];
  var LEVELS = 26;
  return { make: make, incident: incident, act: act, can: can, drive: drive, route: route, recompute: recompute, islands: islands, isolated: isolated, sectionBounds: sectionBounds, dgToggle: dgToggle,
    finished: finished, stars: stars, solve: solve, custOut: custOut, custAll: custAll, advance: advance, adj: adj, other: other, upstreamBreaker: upstreamBreaker, params: params,
    LESSONS: LESSONS, LEVELS: LEVELS, VMIN: VMIN, SPEED: SPEED, T: { SWITCH: T_SWITCH, EARTH: T_EARTH, REPAIR: T_REPAIR } };
});
