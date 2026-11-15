/* EE Hub — numerical methods lab (Round 7, R7E, shared tool K8).
   settings.mode:
     "root"   f(x), [a, b], x0, tol → bisection, Newton–Raphson and secant tables side by side + |error| (log) plot
     "ode"    y' = f(x, y), x0, y0, h, x_end, exact (optional) → Euler, Heun (RK2) and RK4 against the exact solution
     "interp" table of (x, y), target x → forward-difference table, Newton forward/backward or Lagrange value + curve
     "quad"   f(x), [a, b], n → trapezoidal, Simpson 1/3 and 3/8 with errors against a fine reference
   presets: [{label, f, a, b, x0, exact, y0, ...}] */
(function () {
  "use strict";
  var KT = window.KT, E = KT.expr, el = KT.el, F = KT.fmt;

  function fn(src, vars) {
    var ast = E.parse(src), sc = new KT.Scope();
    return function () { var s = sc.child(); for (var i = 0; i < vars.length; i++) s.v[vars[i]] = arguments[i]; return +E.num(E.evaluate(ast, s)); };
  }
  function bisect(f, a, b, tol, max) {
    var rows = [], fa = f(a);
    for (var i = 1; i <= max; i++) { var c = (a + b) / 2, fc = f(c); rows.push([i, a, b, c, fc]); if (Math.abs(b - a) / 2 < tol || fc === 0) break; if (fa * fc < 0) b = c; else { a = c; fa = fc; } }
    return rows;
  }
  function newton(f, x, tol, max, df) {
    var rows = [];
    for (var i = 1; i <= max; i++) { var fx = f(x), d = df ? df(x) : (f(x + 1e-6) - f(x - 1e-6)) / 2e-6, nx = x - fx / d; rows.push([i, x, fx, d, nx]); if (!isFinite(nx)) break; if (Math.abs(nx - x) < tol) { x = nx; break; } x = nx; }
    return rows;
  }
  function secant(f, x0, x1, tol, max) {
    var rows = [];
    for (var i = 1; i <= max; i++) { var f0 = f(x0), f1 = f(x1), x2 = x1 - f1 * (x1 - x0) / (f1 - f0); rows.push([i, x0, x1, x2, f(x2)]); if (!isFinite(x2)) break; if (Math.abs(x2 - x1) < tol) break; x0 = x1; x1 = x2; }
    return rows;
  }
  function odeSolve(f, x0, y0, h, xe, method) {
    var xs = [x0], ys = [y0], x = x0, y = y0, k1s = null, n = Math.min(5000, Math.round((xe - x0) / h));
    for (var i = 0; i < n; i++) {
      var k1 = f(x, y), ny;
      if (method === "euler") ny = y + h * k1;
      else if (method === "heun") { var k2 = f(x + h, y + h * k1); ny = y + h / 2 * (k1 + k2); if (!k1s) k1s = [k1, k2]; }
      else { var a = f(x + h / 2, y + h / 2 * k1), b = f(x + h / 2, y + h / 2 * a), c = f(x + h, y + h * b); ny = y + h / 6 * (k1 + 2 * a + 2 * b + c); if (!k1s) k1s = [k1, a, b, c]; }
      x = x0 + (i + 1) * h; y = ny; xs.push(x); ys.push(y);
    }
    return { x: xs, y: ys, k: k1s };
  }
  function diffTable(y) { var t = [y.slice()]; while (t[t.length - 1].length > 1) { var p = t[t.length - 1], d = []; for (var i = 1; i < p.length; i++) d.push(p[i] - p[i - 1]); t.push(d); } return t; }
  function lagrange(xs, ys, x) { var s = 0; for (var i = 0; i < xs.length; i++) { var l = 1; for (var j = 0; j < xs.length; j++) if (j !== i) l *= (x - xs[j]) / (xs[i] - xs[j]); s += l * ys[i]; } return s; }
  function trap(f, a, b, n) { var h = (b - a) / n, s = (f(a) + f(b)) / 2; for (var i = 1; i < n; i++) s += f(a + i * h); return s * h; }
  function simp13(f, a, b, n) { if (n % 2) return NaN; var h = (b - a) / n, s = f(a) + f(b); for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h); return s * h / 3; }
  function simp38(f, a, b, n) { if (n % 3) return NaN; var h = (b - a) / n, s = f(a) + f(b); for (var i = 1; i < n; i++) s += (i % 3 ? 3 : 2) * f(a + i * h); return 3 * h / 8 * s; }
  KT.numerics = { bisect: bisect, newton: newton, secant: secant, ode: odeSolve, diffTable: diffTable, lagrange: lagrange, trap: trap, simp13: simp13, simp38: simp38 };

  function table(head, rows, fmt) {
    var tw = el("div", "kt-tablewrap"), t = el("table", "kt-table"), th = el("thead"), tr = el("tr");
    head.forEach(function (h) { var x = el("th", null, h); x.scope = "col"; tr.appendChild(x); }); th.appendChild(tr); t.appendChild(th);
    var tb = el("tbody");
    rows.forEach(function (r) { var row = el("tr"); r.forEach(function (v, i) { row.appendChild(el("td", null, typeof v === "number" ? (i === 0 && Number.isInteger(v) ? String(v) : F.sig(v, fmt || 8)) : String(v))); }); tb.appendChild(row); });
    t.appendChild(tb); tw.appendChild(t); return tw;
  }

  function build(mount, S) {
    var mode = S.mode || "root", P = Object.assign({}, S), presets = S.presets || [];
    var wrap = el("div", "kt-numerics");
    var ctl = el("div", "kt-controls"); wrap.appendChild(ctl);
    var outBox = el("div"); wrap.appendChild(outBox);
    mount.appendChild(wrap);
    var fields = {};
    function field(key, label, dflt) { var f = KT.ui.text({ label: label, value: P[key] != null ? String(P[key]) : String(dflt) }, function (v) { P[key] = v; run(); }); f.classList.add("kt-field"); fields[key] = f; return f; }
    function setFields(p) { Object.keys(p).forEach(function (k) { if (fields[k]) { fields[k].querySelector("input").value = String(p[k]); P[k] = p[k]; } }); }
    if (presets.length) ctl.appendChild(KT.ui.select({ label: "Preset", options: presets.map(function (p, i) { return [i, p.label]; }), value: 0 }, function (i) { setFields(presets[+i]); run(); }));
    var r1 = el("div", "kt-row");
    if (mode === "root") { r1.appendChild(field("f", "f(x) =", "x^3 - x - 1")); r1.appendChild(field("a", "a", 1)); r1.appendChild(field("b", "b", 2)); r1.appendChild(field("x0", "x₀ (Newton)", 1.5)); r1.appendChild(field("tol", "Tolerance", "1e-6")); }
    if (mode === "ode") { r1.appendChild(field("f", "y' = f(x, y) =", "x + y")); r1.appendChild(field("x0", "x₀", 0)); r1.appendChild(field("y0", "y₀", 1)); r1.appendChild(field("h", "Step h", 0.1)); r1.appendChild(field("xe", "x end", 1)); r1.appendChild(field("exact", "Exact y(x) (optional)", "2*exp(x) - x - 1")); }
    if (mode === "interp") { r1.appendChild(field("xs", "x values", "1, 2, 3, 4, 5")); r1.appendChild(field("ys", "y values", "1, 8, 27, 64, 125")); r1.appendChild(field("xt", "Find y at x =", 2.5)); }
    if (mode === "quad") { r1.appendChild(field("f", "f(x) =", "exp(x)")); r1.appendChild(field("a", "a", 0)); r1.appendChild(field("b", "b", 1)); r1.appendChild(field("n", "Strips n", 6)); r1.appendChild(field("exact", "Exact value (optional)", "e - 1")); }
    ctl.appendChild(r1);
    if (presets.length) setFields(presets[0]);
    function num(v) { return +E.num(E.run(String(v))); }
    function list(v) { return String(v).split(/[,;\s]+/).filter(Boolean).map(function (x) { return +E.num(E.run(x)); }); }

    function run() {
      outBox.innerHTML = "";
      try {
        if (mode === "root") {
          var f = fn(P.f, ["x"]), a = num(P.a), b = num(P.b), tol = num(P.tol), x0 = num(P.x0);
          if (f(a) * f(b) > 0) outBox.appendChild(el("p", "kt-badge kt-badge--warn", "f(a) and f(b) have the same sign — bisection needs a sign change."));
          var B = bisect(f, a, b, tol, 60), N = newton(f, x0, tol, 40), Sc = secant(f, a, b, tol, 40);
          var dl = el("dl", "kt-readouts");
          [["Bisection", B[B.length - 1][3], B.length], ["Newton–Raphson", N[N.length - 1][4], N.length], ["Secant", Sc[Sc.length - 1][3], Sc.length]].forEach(function (r) {
            var c = el("div", "kt-readout"); c.appendChild(el("dt", null, r[0] + " (" + r[2] + " iterations)")); c.appendChild(el("dd", null, F.sig(r[1], 10))); dl.appendChild(c);
          });
          outBox.appendChild(dl);
          var root = N[N.length - 1][4];
          var cell = el("div", "kt-plots"); outBox.appendChild(cell);
          var pl = new KT.Plot(cell, { title: "Error |xₙ − root| (log scale): linear against quadratic convergence" });
          var err = function (rows, k) { return { x: rows.map(function (r) { return r[0]; }), y: rows.map(function (r) { return Math.max(1e-16, Math.abs(r[k] - root)); }) }; };
          var e1 = err(B, 3), e2 = err(N, 4), e3 = err(Sc, 3);
          pl.set({ type: "xy", x: { label: "Iteration n", min: 1, max: Math.max(B.length, 2) }, y: { label: "|error|", log: true }, series: [{ x: e1.x, y: e1.y, label: "bisection", kind: "line" }, { x: e2.x, y: e2.y, label: "Newton–Raphson", color: 1 }, { x: e3.x, y: e3.y, label: "secant", color: 2 }], marks: [] });
          var g = el("div", "kt-plots"); outBox.appendChild(g);
          var p2 = new KT.Plot(g, { title: "f(x) with the Newton tangents" });
          var xs = [], ys = [], lo = Math.min(a, x0) - 0.5 * Math.abs(b - a), hi = Math.max(b, x0) + 0.5 * Math.abs(b - a);
          for (var i = 0; i <= 300; i++) { var xx = lo + (hi - lo) * i / 300; xs.push(xx); ys.push(f(xx)); }
          var ser = [{ x: xs, y: ys, label: "f(x)" }];
          N.slice(0, 4).forEach(function (r, k) { ser.push({ x: [r[1], r[4]], y: [r[2], 0], color: 1, dash: true, nolegend: true, label: "tangent " + (k + 1) }); });
          p2.set({ type: "xy", x: { label: "x", min: lo, max: hi }, y: { label: "f(x)", robust: true }, series: ser, marks: [{ x: root, y: 0, label: "root ≈ " + F.sig(root, 6) }] });
          outBox.appendChild(el("h4", "kt-h4", "Bisection"));
          outBox.appendChild(table(["n", "a", "b", "c = (a+b)/2", "f(c)"], B));
          outBox.appendChild(el("h4", "kt-h4", "Newton–Raphson: xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ)"));
          outBox.appendChild(table(["n", "xₙ", "f(xₙ)", "f′(xₙ)", "xₙ₊₁"], N));
          outBox.appendChild(el("h4", "kt-h4", "Secant"));
          outBox.appendChild(table(["n", "xₙ₋₁", "xₙ", "xₙ₊₁", "f(xₙ₊₁)"], Sc));
        } else if (mode === "ode") {
          var g2 = fn(P.f, ["x", "y"]), X0 = num(P.x0), Y0 = num(P.y0), h = num(P.h), xe = num(P.xe);
          if (!(h > 0) || xe <= X0) throw new Error("need h > 0 and x end > x₀");
          var ex = String(P.exact || "").trim() ? fn(P.exact, ["x"]) : null;
          var eu = odeSolve(g2, X0, Y0, h, xe, "euler"), he = odeSolve(g2, X0, Y0, h, xe, "heun"), rk = odeSolve(g2, X0, Y0, h, xe, "rk4");
          var dl2 = el("dl", "kt-readouts");
          [["Euler", eu], ["Heun (RK2)", he], ["RK4", rk]].forEach(function (r) {
            var y = r[1].y[r[1].y.length - 1], c = el("div", "kt-readout"); c.appendChild(el("dt", null, r[0] + "  y(" + F.sig(r[1].x[r[1].x.length - 1], 4) + ")")); c.appendChild(el("dd", null, F.sig(y, 8) + (ex ? "   error " + F.sig(Math.abs(y - ex(r[1].x[r[1].x.length - 1])), 3) : ""))); dl2.appendChild(c);
          });
          if (ex) { var c2 = el("div", "kt-readout"); c2.appendChild(el("dt", null, "Exact")); c2.appendChild(el("dd", null, F.sig(ex(rk.x[rk.x.length - 1]), 8))); dl2.appendChild(c2); }
          outBox.appendChild(dl2);
          var cell2 = el("div", "kt-plots"); outBox.appendChild(cell2);
          var pl2 = new KT.Plot(cell2, { title: "Numerical solutions against the exact curve" });
          var ser2 = [];
          if (ex) { var xs2 = [], ys2 = []; for (var k = 0; k <= 200; k++) { var xv = X0 + (xe - X0) * k / 200; xs2.push(xv); ys2.push(ex(xv)); } ser2.push({ x: xs2, y: ys2, label: "exact", color: 3, width: 3 }); }
          ser2.push({ x: eu.x, y: eu.y, label: "Euler", kind: "line", color: 1 }, { x: eu.x, y: eu.y, kind: "points", color: 1, nolegend: true, r: 3 });
          ser2.push({ x: he.x, y: he.y, label: "Heun", color: 2, dash: true });
          ser2.push({ x: rk.x, y: rk.y, label: "RK4", color: 0 }, { x: rk.x, y: rk.y, kind: "points", color: 0, nolegend: true, r: 3 });
          pl2.set({ type: "xy", x: { label: "x", min: X0, max: xe }, y: { label: "y" }, series: ser2 });
          outBox.appendChild(el("h4", "kt-h4", "First RK4 step"));
          var kk = rk.k || [];
          outBox.appendChild(table(["k₁ = f(x₀, y₀)", "k₂ = f(x₀+h/2, y₀+hk₁/2)", "k₃ = f(x₀+h/2, y₀+hk₂/2)", "k₄ = f(x₀+h, y₀+hk₃)", "y₁ = y₀ + h(k₁+2k₂+2k₃+k₄)/6"], [[kk[0], kk[1], kk[2], kk[3], rk.y[1]]]));
          outBox.appendChild(el("h4", "kt-h4", "Steps"));
          outBox.appendChild(table(["n", "x", "Euler", "Heun", "RK4"].concat(ex ? ["exact"] : []), rk.x.slice(0, 41).map(function (x, i) { var r = [i, x, eu.y[i], he.y[i], rk.y[i]]; if (ex) r.push(ex(x)); return r; })));
        } else if (mode === "interp") {
          var xs3 = list(P.xs), ys3 = list(P.ys), xt = num(P.xt);
          if (xs3.length !== ys3.length || xs3.length < 2) throw new Error("give the same number of x and y values (at least 2)");
          var hh = xs3[1] - xs3[0], equal = xs3.every(function (x, i) { return i === 0 || Math.abs((x - xs3[i - 1]) - hh) < 1e-9 * Math.abs(hh); });
          var val = lagrange(xs3, ys3, xt), dt = diffTable(ys3), method;
          if (equal) {
            var mid = (xs3[0] + xs3[xs3.length - 1]) / 2;
            method = xt <= mid ? "Newton forward, p = (x − x₀)/h = " + F.sig((xt - xs3[0]) / hh, 5) : "Newton backward, p = (x − xₙ)/h = " + F.sig((xt - xs3[xs3.length - 1]) / hh, 5);
          } else method = "Lagrange (unequal spacing)";
          var d3 = el("dl", "kt-readouts");
          [["y(" + F.sig(xt, 6) + ")", F.sig(val, 8)], ["Method", method], ["Degree of the polynomial", String(xs3.length - 1)]].forEach(function (r, i) { var c = el("div", "kt-readout" + (i === 0 ? " kt-readout--big" : "")); c.appendChild(el("dt", null, r[0])); c.appendChild(el("dd", null, r[1])); d3.appendChild(c); });
          outBox.appendChild(d3);
          if (equal) {
            var rows = xs3.map(function (x, i) { return [x].concat(dt.map(function (col) { return col[i] != null ? col[i] : ""; })); });
            var constCol = -1; for (var c3 = 1; c3 < dt.length; c3++) if (dt[c3].length > 1 && dt[c3].every(function (v) { return Math.abs(v - dt[c3][0]) < 1e-9 * Math.max(1, Math.abs(dt[c3][0])); })) { constCol = c3; break; }
            outBox.appendChild(el("h4", "kt-h4", "Forward-difference table" + (constCol > 0 ? " — Δ" + (constCol > 1 ? toSup(constCol) : "") + "y is constant: the data fit a degree-" + constCol + " polynomial" : "")));
            outBox.appendChild(table(["x", "y"].concat(dt.slice(1).map(function (_, i) { return "Δ" + (i ? toSup(i + 1) : "") + "y"; })), rows, 6));
          }
          var cell3 = el("div", "kt-plots"); outBox.appendChild(cell3);
          var pl3 = new KT.Plot(cell3, { title: "Data and the interpolating polynomial" });
          var lo3 = Math.min.apply(null, xs3.concat([xt])), hi3 = Math.max.apply(null, xs3.concat([xt])), cx = [], cy = [];
          for (var q = 0; q <= 200; q++) { var xx3 = lo3 + (hi3 - lo3) * q / 200; cx.push(xx3); cy.push(lagrange(xs3, ys3, xx3)); }
          pl3.set({ type: "xy", x: { label: "x" }, y: { label: "y" }, series: [{ x: cx, y: cy, label: "P(x)" }, { x: xs3, y: ys3, kind: "points", label: "data", color: 1 }], marks: [{ x: xt, y: val, label: "P(" + F.sig(xt, 4) + ") = " + F.sig(val, 6), color: 2 }] });
        } else if (mode === "quad") {
          var fq = fn(P.f, ["x"]), aq = num(P.a), bq = num(P.b), n = Math.max(1, Math.round(num(P.n)));
          var ref = String(P.exact || "").trim() ? num(P.exact) : simp13(fq, aq, bq, 20000);
          var res = [["Trapezoidal", trap(fq, aq, bq, n)], ["Simpson 1/3" + (n % 2 ? " (needs even n)" : ""), simp13(fq, aq, bq, n)], ["Simpson 3/8" + (n % 3 ? " (needs n divisible by 3)" : ""), simp38(fq, aq, bq, n)]];
          var d4 = el("dl", "kt-readouts");
          res.forEach(function (r) { var c = el("div", "kt-readout"); c.appendChild(el("dt", null, r[0])); c.appendChild(el("dd", null, isNaN(r[1]) ? "—" : F.sig(r[1], 9) + "   error " + F.sig(Math.abs(r[1] - ref), 3))); d4.appendChild(c); });
          var c4 = el("div", "kt-readout"); c4.appendChild(el("dt", null, String(P.exact || "").trim() ? "Exact" : "Reference (Simpson, n = 20 000)")); c4.appendChild(el("dd", null, F.sig(ref, 10))); d4.appendChild(c4);
          outBox.appendChild(d4);
          var cell4 = el("div", "kt-plots"); outBox.appendChild(cell4);
          var pl4 = new KT.Plot(cell4, { title: "Trapezoidal strips under f(x)" });
          var fx = [], fy = [], sx = [], sy = [];
          for (var t = 0; t <= 200; t++) { var xv4 = aq + (bq - aq) * t / 200; fx.push(xv4); fy.push(fq(xv4)); }
          for (t = 0; t <= n; t++) { var xs4 = aq + (bq - aq) * t / n; sx.push(xs4); sy.push(fq(xs4)); }
          pl4.set({ type: "xy", x: { label: "x", min: aq, max: bq }, y: { label: "f(x)", zero: true }, series: [{ x: sx, y: sy, kind: "area", color: 1, label: "strips" }, { x: sx, y: sy, kind: "stem", color: 1, nolegend: true }, { x: fx, y: fy, label: "f(x)" }] });
        }
      } catch (e) { outBox.innerHTML = ""; outBox.appendChild(el("p", "kt-error", "Check the inputs — " + (e.message || e))); }
    }
    function toSup(n) { return String(n).split("").map(function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]; }).join(""); }
    run();
  }
  KT.define("numerics", build);
})();
