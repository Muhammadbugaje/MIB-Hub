/* EE Hub — truth table and K-map solver (Round 7, R7E, shared tool K8).
   settings: {vars: 3, names: "ABCD", minterms: [1,3,5,7], dc: [], expr: "", mode: "kmap"|"expr", lut: false}
   Quine–McCluskey minimisation with an exact cover search: minimal SOP and POS, literal and gate counts. */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el;
  var GRAY = { 1: [0, 1], 2: [0, 1, 3, 2] };

  /* ---- Boolean expressions: A'B + C(A ⊕ D), ~, !, ¬, ', + | OR, · * & AND, ^ ⊕ XOR, juxtaposition = AND ---- */
  function parseBool(src, names) {
    var s = String(src || "").replace(/\s+/g, ""), i = 0;
    s = s.replace(/OR/gi, "+").replace(/AND/gi, "&").replace(/XOR/gi, "^").replace(/NOT/gi, "!").replace(/[·*]/g, "&").replace(/\|/g, "+").replace(/⊕/g, "^").replace(/[¬~]/g, "!").replace(/[’`]/g, "'");
    function or() { var l = xor(); while (s[i] === "+") { i++; var r = xor(); l = (function (a, b) { return function (v) { return a(v) | b(v); }; })(l, r); } return l; }
    function xor() { var l = and(); while (s[i] === "^") { i++; var r = and(); l = (function (a, b) { return function (v) { return a(v) ^ b(v); }; })(l, r); } return l; }
    function and() {
      var l = not();
      while (i < s.length && (s[i] === "&" || /[A-Za-z01(!]/.test(s[i]))) { if (s[i] === "&") i++; var r = not(); l = (function (a, b) { return function (v) { return a(v) & b(v); }; })(l, r); }
      return l;
    }
    function not() {
      if (s[i] === "!") { i++; var a = not(); return function (v) { return 1 - a(v); }; }
      var p = prim();
      while (s[i] === "'") { i++; p = (function (a) { return function (v) { return 1 - a(v); }; })(p); }
      return p;
    }
    function prim() {
      var c = s[i];
      if (c === "(") { i++; var e = or(); if (s[i] !== ")") throw new Error("missing )"); i++; return e; }
      if (c === "0" || c === "1") { i++; return function () { return +c; }; }
      var k = names.indexOf(c);
      if (k < 0) throw new Error(c ? "unknown variable '" + c + "'" : "unfinished expression");
      i++;
      return function (v) { return v[k]; };
    }
    var f = or();
    if (i !== s.length) throw new Error("unexpected '" + s[i] + "'");
    return f;
  }

  /* ---- Quine–McCluskey ----------------------------------------------------------- */
  function bits(m, n) { var b = []; for (var k = n - 1; k >= 0; k--) b.push((m >> k) & 1); return b; }
  function primes(ones, dc, n) {
    var terms = ones.concat(dc).map(function (m) { return { b: bits(m, n).join(""), ms: [m] }; });
    var seen = {}, pis = [];
    while (terms.length) {
      var next = [], used = {}, made = {};
      for (var a = 0; a < terms.length; a++) for (var b = a + 1; b < terms.length; b++) {
        var x = terms[a].b, y = terms[b].b, diff = -1, cnt = 0;
        for (var k = 0; k < n; k++) if (x[k] !== y[k]) { cnt++; diff = k; if (cnt > 1) break; }
        if (cnt === 1 && x.replace(/[01]/g, "0") === y.replace(/[01]/g, "0")) {
          var nb = x.slice(0, diff) + "-" + x.slice(diff + 1);
          used[a] = used[b] = 1;
          if (!made[nb]) { made[nb] = 1; next.push({ b: nb, ms: terms[a].ms.concat(terms[b].ms) }); }
        }
      }
      terms.forEach(function (t, i) { if (!used[i] && !seen[t.b]) { seen[t.b] = 1; pis.push(t); } });
      terms = next;
    }
    return pis;
  }
  function cover(pis, ones, n) {
    if (!ones.length) return [];
    var need = ones.slice(), chosen = [];
    // essentials
    need.forEach(function (m) { var c = pis.filter(function (p) { return p.ms.indexOf(m) >= 0; }); if (c.length === 1 && chosen.indexOf(c[0]) < 0) chosen.push(c[0]); });
    var left = need.filter(function (m) { return !chosen.some(function (p) { return p.ms.indexOf(m) >= 0; }); });
    if (!left.length) return chosen;
    var cand = pis.filter(function (p) { return chosen.indexOf(p) < 0 && p.ms.some(function (m) { return left.indexOf(m) >= 0; }); });
    var best = null, bestCost = Infinity;
    var lits = function (p) { return p.b.replace(/-/g, "").length; };
    var N = cand.length;
    if (N <= 16) {
      for (var mask = 1; mask < (1 << N); mask++) {
        var set = [], cnt = 0;
        for (var k = 0; k < N; k++) if (mask & (1 << k)) { set.push(cand[k]); cnt++; }
        if (best && cnt > best.length) continue;
        if (!left.every(function (m) { return set.some(function (p) { return p.ms.indexOf(m) >= 0; }); })) continue;
        var cost = cnt * 100 + set.reduce(function (a, p) { return a + lits(p); }, 0);
        if (cost < bestCost) { bestCost = cost; best = set; }
      }
    } else { // greedy fallback
      best = []; var rem = left.slice();
      while (rem.length) { cand.sort(function (p, q) { return q.ms.filter(function (m) { return rem.indexOf(m) >= 0; }).length - p.ms.filter(function (m) { return rem.indexOf(m) >= 0; }).length; }); best.push(cand[0]); rem = rem.filter(function (m) { return cand[0].ms.indexOf(m) < 0; }); }
    }
    return chosen.concat(best || []);
  }
  function termSOP(p, names) { var s = ""; p.b.split("").forEach(function (c, k) { if (c === "1") s += names[k]; else if (c === "0") s += names[k] + "'"; }); return s || "1"; }
  function termPOS(p, names) { var s = []; p.b.split("").forEach(function (c, k) { if (c === "0") s.push(names[k]); else if (c === "1") s.push(names[k] + "'"); }); return s.length > 1 ? "(" + s.join(" + ") + ")" : (s[0] || "0"); }
  function minimise(ones, dc, n, names) {
    var zeros = []; for (var m = 0; m < (1 << n); m++) if (ones.indexOf(m) < 0 && dc.indexOf(m) < 0) zeros.push(m);
    var sopPI = primes(ones, dc, n), sop = cover(sopPI, ones, n);
    var posPI = primes(zeros, dc, n), pos = cover(posPI, zeros, n);
    var sopTxt = !ones.length ? "0" : !zeros.length ? "1" : sop.map(function (p) { return termSOP(p, names); }).join(" + ");
    var posTxt = !zeros.length ? "1" : !ones.length ? "0" : pos.map(function (p) { return termPOS(p, names); }).join("");
    return { sop: sop, pos: pos, sopTxt: sopTxt, posTxt: posTxt, primes: sopPI, zeros: zeros };
  }
  KT.logic = { parse: parseBool, minimise: minimise, primes: primes };

  function build(mount, S) {
    var n = S.vars || 3, names = (S.names || "ABCDE").split("").slice(0, 5), mode = S.mode || "kmap";
    var cells = {};
    (S.minterms || [1, 3, 5, 7]).forEach(function (m) { cells[m] = "1"; });
    (S.dc || []).forEach(function (m) { cells[m] = "x"; });
    var wrap = el("div", "kt-logic");
    var bar = el("div", "kt-row");
    bar.appendChild(KT.ui.select({ label: "Variables", options: [[2, "2"], [3, "3"], [4, "4"]], value: n }, function (v) { n = +v; Object.keys(cells).forEach(function (k) { if (+k >= (1 << n)) delete cells[k]; }); draw(); }));
    bar.appendChild(KT.ui.select({ label: "Enter the function as", options: [["kmap", "Tap the K-map"], ["list", "Minterm list"], ["expr", "Expression"]], value: mode }, function (v) { mode = v; draw(); }));
    wrap.appendChild(bar);
    var inBox = el("div"); wrap.appendChild(inBox);
    var grid = el("div", "kt-grid2"), left = el("div"), right = el("div");
    grid.appendChild(left); grid.appendChild(right); wrap.appendChild(grid);
    var steps = KT.Steps("How the groups were found"); wrap.appendChild(steps.el);
    mount.appendChild(wrap);
    var COLS = ["var(--kt-1)", "var(--kt-2)", "var(--kt-3)", "var(--kt-4)", "var(--kt-5)", "var(--kt-6)"];
    var exprText = S.expr || "A'B + AC", listText = "";

    function ones() { return Object.keys(cells).filter(function (k) { return cells[k] === "1" && +k < (1 << n); }).map(Number).sort(function (a, b) { return a - b; }); }
    function dcs() { return Object.keys(cells).filter(function (k) { return cells[k] === "x" && +k < (1 << n); }).map(Number).sort(function (a, b) { return a - b; }); }
    function draw() {
      inBox.innerHTML = "";
      if (mode === "expr") {
        inBox.appendChild(KT.ui.text({ label: "Boolean expression (A'B + AC, !A&B, A⊕B, (A+B)(C+D))", value: exprText }, function (v) { exprText = v; fromExpr(); solve(); }));
        fromExpr();
      } else if (mode === "list") {
        listText = "m(" + ones().join(",") + ")" + (dcs().length ? " + d(" + dcs().join(",") + ")" : "");
        inBox.appendChild(KT.ui.text({ label: "Minterms and don't-cares, e.g. m(1,3,5,7) + d(2)", value: listText }, function (v) { fromList(v); solve(); }));
      }
      solve();
    }
    function fromExpr() {
      try { var f = parseBool(exprText, names.slice(0, n)); cells = {}; for (var m = 0; m < (1 << n); m++) if (f(bits(m, n))) cells[m] = "1"; inBox.dataset.err = ""; }
      catch (e) { inBox.dataset.err = e.message; }
    }
    function fromList(v) {
      var mm = /m\s*\(([^)]*)\)/i.exec(v) || /^\s*([\d,\s]+)/.exec(v), dd = /d\s*\(([^)]*)\)/i.exec(v);
      cells = {};
      (mm ? mm[1].split(",") : []).forEach(function (x) { x = parseInt(x, 10); if (x >= 0 && x < (1 << n)) cells[x] = "1"; });
      (dd ? dd[1].split(",") : []).forEach(function (x) { x = parseInt(x, 10); if (x >= 0 && x < (1 << n)) cells[x] = "x"; });
    }
    function solve() {
      left.innerHTML = ""; right.innerHTML = "";
      if (inBox.dataset.err) { left.appendChild(el("p", "kt-error", "Check the expression: " + inBox.dataset.err)); }
      var on = ones(), dc = dcs(), r = minimise(on, dc, n, names);
      // K-map
      var rv = n >= 3 ? 2 : 1, cv = n - rv, rows = GRAY[rv], cols = GRAY[cv];
      if (n === 3) { rv = 1; cv = 2; rows = GRAY[1]; cols = GRAY[2]; }
      var t = el("table", "kt-kmap"), cap = el("caption", "kt-ctl__lab", "K-map (tap a cell: 0 → 1 → X)");
      t.appendChild(cap);
      var hr = el("tr"); hr.appendChild(el("th", null, names.slice(0, rv).join("") + " \\ " + names.slice(rv, n).join("")));
      cols.forEach(function (c) { hr.appendChild(el("th", null, bits(c, cv).join(""))); }); t.appendChild(hr);
      rows.forEach(function (rr) {
        var tr = el("tr"); tr.appendChild(el("th", null, bits(rr, rv).join("")));
        cols.forEach(function (cc) {
          var m = (rr << cv) | cc, v = cells[m] || "0", td = el("td"), b = el("button");
          b.type = "button"; b.setAttribute("data-v", v); b.textContent = v === "x" ? "X" : v;
          b.setAttribute("aria-label", "Minterm " + m + ", value " + (v === "x" ? "don't care" : v));
          var sm = el("small", null, String(m)); b.appendChild(sm);
          var groups = r.sop.map(function (p, i) { return p.ms.indexOf(m) >= 0 ? i : -1; }).filter(function (i) { return i >= 0; });
          if (groups.length && v !== "0") b.style.boxShadow = groups.map(function (g, k) { return "inset 0 " + (-4 - 4 * k) + "px 0 " + COLS[g % COLS.length]; }).join(",");
          b.addEventListener("click", function () { cells[m] = v === "0" ? "1" : v === "1" ? "x" : "0"; if (cells[m] === "0") delete cells[m]; if (mode !== "kmap") { mode = "kmap"; } solve(); });
          td.appendChild(b); tr.appendChild(td);
        });
        t.appendChild(tr);
      });
      var sc = el("div", "kt-scroll"); sc.appendChild(t); left.appendChild(sc);
      // results
      var dl = el("dl", "kt-readouts"); dl.style.gridTemplateColumns = "1fr";
      function card(k, v, big) { var x = el("div", "kt-readout" + (big ? " kt-readout--big" : "")); x.appendChild(el("dt", null, k)); x.appendChild(el("dd", null, v)); dl.appendChild(x); }
      card("Minimal SOP  F =", r.sopTxt, true);
      card("Minimal POS  F =", r.posTxt);
      card("Canonical", "F = Σm(" + on.join(", ") + ")" + (dc.length ? " + d(" + dc.join(", ") + ")" : "") + "  =  ΠM(" + r.zeros.join(", ") + ")" + (dc.length ? " · D(" + dc.join(", ") + ")" : ""));
      var litS = r.sop.reduce(function (a, p) { return a + p.b.replace(/-/g, "").length; }, 0), litP = r.pos.reduce(function (a, p) { return a + p.b.replace(/-/g, "").length; }, 0);
      card("Cost (terms / literals)", "SOP " + r.sop.length + " / " + litS + "   ·   POS " + r.pos.length + " / " + litP + (litS !== litP ? "   → " + (litS < litP ? "SOP" : "POS") + " is cheaper" : ""));
      if (S.lut) { var lut = ""; for (var m = (1 << n) - 1; m >= 0; m--) lut += cells[m] === "1" ? "1" : "0"; card("LUT contents (" + (1 << n) + " bits, m" + ((1 << n) - 1) + " … m0)", lut); }
      right.appendChild(dl);
      // truth table
      var tw = el("div", "kt-tablewrap"), tt = el("table", "kt-table"), th = el("tr");
      names.slice(0, n).concat(["m", "F"]).forEach(function (h) { var x = el("th", null, h); x.scope = "col"; th.appendChild(x); });
      var thead = el("thead"); thead.appendChild(th); tt.appendChild(thead);
      var tb = el("tbody");
      for (var mm = 0; mm < (1 << n); mm++) {
        var tr = el("tr"); if (cells[mm] === "1") tr.className = "is-hl";
        bits(mm, n).forEach(function (bv) { tr.appendChild(el("td", null, String(bv))); });
        tr.appendChild(el("td", null, String(mm))); tr.appendChild(el("td", null, cells[mm] === "x" ? "X" : cells[mm] || "0"));
        tb.appendChild(tr);
      }
      tt.appendChild(tb); tw.appendChild(tt);
      var det = el("details", "kt-about"); det.appendChild(el("summary", null, "Truth table")); det.appendChild(tw); right.appendChild(det);
      var st = ["Prime implicants: " + (r.primes.map(function (p) { return termSOP(p, names) + " covers m(" + p.ms.slice().sort(function (a, b) { return a - b; }).join(",") + ")"; }).join(";  ") || "none")];
      r.sop.forEach(function (p, i) { st.push("Group " + (i + 1) + " (colour " + (i + 1) + "): " + termSOP(p, names) + " — " + p.ms.length + " cells; variables that change inside the group drop out."); });
      st.push("F = " + r.sopTxt + ". For POS, group the 0s the same way and write each group as a sum term: F = " + r.posTxt + ".");
      steps.update(st);
    }
    draw();
  }
  KT.define("logic", build);
})();
