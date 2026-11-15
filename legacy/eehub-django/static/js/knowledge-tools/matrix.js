/* EE Hub — matrix calculator (Round 7, R7E, shared tool K8).
   settings: {n: 3, sizes: [2,3,4], A: [[...]], b: [...], modes: ["det","inv","solve","cramer","rank","eig","param"], mode: "det",
              symbol: "k" (for "param": entries may contain the symbol; det is solved for it)}
   Entries accept expressions (1/3, sqrt(2), 2*k). Results shown as fractions when they are simple. */
(function () {
  "use strict";
  var KT = window.KT, E = KT.expr, el = KT.el, F = KT.fmt;
  var LABELS = { ss2tf: "State space → G(s)", ctrb: "Controllability / observability", det: "Determinant", inv: "Inverse", solve: "Solve Ax = b", cramer: "Cramer's rule", rank: "Rank and RREF", eig: "Eigenvalues", param: "Find k (det = 0)", mul: "A × B" };

  function frac(x) {
    if (!isFinite(x)) return isNaN(x) ? "—" : "∞";
    if (Math.abs(x) < 1e-12) return "0";
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x)).replace("-", "−");
    // continued fraction, denominator ≤ 999
    var s = x < 0 ? -1 : 1, v = Math.abs(x), h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = v;
    for (var i = 0; i < 20; i++) {
      var a = Math.floor(b), h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > 999) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(v - h1 / k1) < 1e-9 * Math.max(1, v)) return (s < 0 ? "−" : "") + h1 + "/" + k1;
      b = 1 / (b - a);
      if (!isFinite(b)) break;
    }
    return F.sig(x, 5).replace("-", "−");
  }
  function det(M) {
    var n = M.length, A = M.map(function (r) { return r.slice(); }), d = 1;
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-14) return 0;
      if (p !== c) { var t = A[p]; A[p] = A[c]; A[c] = t; d = -d; }
      d *= A[c][c];
      for (r = c + 1; r < n; r++) { var f = A[r][c] / A[c][c]; for (var k = c; k < n; k++) A[r][k] -= f * A[c][k]; }
    }
    return d;
  }
  function minor(M, i, j) { return M.filter(function (_, r) { return r !== i; }).map(function (row) { return row.filter(function (_, c) { return c !== j; }); }); }
  function cof(M) { return M.map(function (row, i) { return row.map(function (_, j) { return ((i + j) % 2 ? -1 : 1) * det(minor(M, i, j)); }); }); }
  function T(M) { return M[0].map(function (_, j) { return M.map(function (r) { return r[j]; }); }); }
  function rref(M, steps) {
    var A = M.map(function (r) { return r.slice(); }), rows = A.length, cols = A[0].length, lead = 0, piv = [];
    for (var r = 0; r < rows && lead < cols; r++) {
      var i = r;
      while (Math.abs(A[i][lead]) < 1e-12) { i++; if (i === rows) { i = r; lead++; if (lead === cols) return { A: clean(A), piv: piv }; } }
      if (i !== r) { var t = A[i]; A[i] = A[r]; A[r] = t; if (steps) steps.push("R" + (r + 1) + " ↔ R" + (i + 1)); }
      var lv = A[r][lead];
      if (Math.abs(lv - 1) > 1e-12) { A[r] = A[r].map(function (v) { return v / lv; }); if (steps) steps.push("R" + (r + 1) + " → R" + (r + 1) + " ÷ " + frac(lv)); }
      for (i = 0; i < rows; i++) if (i !== r && Math.abs(A[i][lead]) > 1e-12) {
        var f = A[i][lead];
        A[i] = A[i].map(function (v, k) { return v - f * A[r][k]; });
        if (steps) steps.push("R" + (i + 1) + " → R" + (i + 1) + (f > 0 ? " − " : " + ") + frac(Math.abs(f)) + "·R" + (r + 1));
      }
      piv.push(lead); lead++;
    }
    return { A: clean(A), piv: piv };
  }
  function clean(A) { return A.map(function (r) { return r.map(function (v) { return Math.abs(v) < 1e-11 ? 0 : v; }); }); }
  function show(M, aug) {
    var g = el("div", "kt-mshow"); g.style.gridTemplateColumns = "repeat(" + M[0].length + ", auto)";
    M.forEach(function (r) { r.forEach(function (v, j) { var s = el("span", null, frac(v)); if (aug && j === M[0].length - 1) s.style.borderLeft = "1px solid currentColor", s.style.paddingLeft = "8px"; g.appendChild(s); }); });
    return g;
  }
  KT.matrix = { det: det, rref: rref, cof: cof, frac: frac, T: T };

  function build(mount, S) {
    var sizes = S.sizes || [2, 3, 4], n = S.n || 3, modes = S.modes || ["det", "inv", "solve", "rank", "eig"], mode = S.mode || modes[0];
    var sym = S.symbol || "k";
    var A = S.A || null, b = S.b || S.B || null;
    var wrap = el("div", "kt-matrix-tool");
    var bar = el("div", "kt-row");
    if (sizes.length > 1) bar.appendChild(KT.ui.select({ label: "Size", options: sizes.map(function (s) { return [s, s + "×" + s]; }), value: n }, function (v) { n = +v; A = null; b = null; grid(); calc(); }));
    if (modes.length > 1) bar.appendChild(KT.ui.select({ label: "Calculate", options: modes.map(function (m) { return [m, LABELS[m]]; }), value: mode }, function (v) { mode = v; grid(); calc(); }));
    wrap.appendChild(bar);
    var gbox = el("div", "kt-grid2"), inA = el("div"), inB = el("div");
    gbox.appendChild(inA); gbox.appendChild(inB); wrap.appendChild(gbox);
    var out = el("div", "kt-results"); out.setAttribute("aria-live", "polite");
    wrap.appendChild(out);
    var steps = KT.Steps("Working"); wrap.appendChild(steps.el);
    mount.appendChild(wrap);
    var cellsA = [], cellsB = [], cellsC = [], cellD = null;

    function grid() {
      var keepA = cellsA.length === n ? cellsA.map(function (r) { return r.map(function (c) { return c.value; }); }) : null;
      var keepB = cellsB.length === n ? cellsB.map(function (c) { return c.value; }) : null;
      inA.innerHTML = ""; inB.innerHTML = ""; cellsA = []; cellsB = [];
      inA.appendChild(el("div", "kt-ctl__lab", "Matrix A" + (mode === "param" ? " (use " + sym + " for the unknown)" : "")));
      var sc = el("div", "kt-scroll"), g = el("div", "kt-matrix"); g.style.gridTemplateColumns = "repeat(" + n + ", auto)";
      for (var i = 0; i < n; i++) {
        var row = [];
        for (var j = 0; j < n; j++) {
          var x = el("input"); x.type = "text"; x.inputMode = "decimal"; x.autocomplete = "off"; x.spellcheck = false;
          x.setAttribute("aria-label", "A row " + (i + 1) + " column " + (j + 1));
          x.value = keepA ? keepA[i][j] : (A && A[i] && A[i][j] != null ? A[i][j] : (i === j ? (n - i + 1) : ((i + 2 * j) % 3) - 1));
          x.addEventListener("input", calc);
          g.appendChild(x); row.push(x);
        }
        cellsA.push(row);
      }
      sc.appendChild(g); inA.appendChild(sc);
      if (mode === "ss2tf" || mode === "ctrb") {
        inB.appendChild(el("div", "kt-ctl__lab", "B (column), C (row) and D"));
        var gB = el("div", "kt-matrix"); gB.style.gridTemplateColumns = "auto";
        for (i = 0; i < n; i++) { var yb = el("input"); yb.type = "text"; yb.setAttribute("aria-label", "B row " + (i + 1)); yb.value = keepB ? keepB[i] : (b && b[i] != null ? b[i] : (i === n - 1 ? 1 : 0)); yb.addEventListener("input", calc); gB.appendChild(yb); cellsB.push(yb); }
        inB.appendChild(gB);
        var gC = el("div", "kt-matrix"); gC.style.gridTemplateColumns = "repeat(" + n + ", auto)"; gC.style.marginTop = "8px";
        cellsC = [];
        for (i = 0; i < n; i++) { var yc = el("input"); yc.type = "text"; yc.setAttribute("aria-label", "C column " + (i + 1)); yc.value = S.C && S.C[i] != null && S.C.length === n ? S.C[i] : (i === 0 ? 1 : 0); yc.addEventListener("input", calc); gC.appendChild(yc); cellsC.push(yc); }
        inB.appendChild(gC);
        var dD = KT.ui.text({ label: "D", value: String(S.D || 0) }, calc); cellD = dD.querySelector("input"); inB.appendChild(dD);
      }
      if (mode === "solve" || mode === "cramer") {
        inB.appendChild(el("div", "kt-ctl__lab", "Vector b"));
        var gb = el("div", "kt-matrix"); gb.style.gridTemplateColumns = "auto";
        for (i = 0; i < n; i++) {
          var y = el("input"); y.type = "text"; y.inputMode = "decimal"; y.setAttribute("aria-label", "b row " + (i + 1));
          y.value = keepB ? keepB[i] : (b && b[i] != null ? b[i] : i + 1);
          y.addEventListener("input", calc); gb.appendChild(y); cellsB.push(y);
        }
        inB.appendChild(gb);
      }
    }
    function read(extra) {
      var sc = new KT.Scope(); if (extra) Object.keys(extra).forEach(function (k) { sc.v[k] = extra[k]; });
      return cellsA.map(function (r) { return r.map(function (c) { var v = E.num(E.run(c.value || "0", sc)); if (!isFinite(v)) throw new Error("'" + c.value + "' is not a number"); return v; }); });
    }
    function readB() { return cellsB.map(function (c) { return E.num(E.run(c.value || "0")); }); }
    function card(label, node) { var r = el("div", "kt-readout"); r.appendChild(el("dt", null, label)); var dd = el("dd"); if (typeof node === "string") dd.textContent = node; else dd.appendChild(node); r.appendChild(dd); return r; }
    function mmul(X, Y) { return X.map(function (r) { return Y[0].map(function (_, j) { return r.reduce(function (s2, v, k) { return s2 + v * Y[k][j]; }, 0); }); }); }
    function polyTxt(c, v) { var m = c.length - 1; return c.map(function (q, i) { var p = m - i; if (Math.abs(q) < 1e-12) return ""; return (q < 0 ? " − " : " + ") + (Math.abs(Math.abs(q) - 1) < 1e-12 && p ? "" : frac(Math.abs(q))) + (p > 1 ? v + "^" + p : p === 1 ? v : ""); }).join("").replace(/^ \+ /, "").replace(/^ − /, "−") || "0"; }
    function ss(A, list, st) {
      var Bv = readB().map(function (x) { return [x]; }), Cv = [cellsC.map(function (c) { return E.num(E.run(c.value || "0")); })], D = E.num(E.run(cellD.value || "0"));
      if (mode === "ctrb") {
        var cols = [Bv], rows = [Cv];
        for (var k = 1; k < n; k++) { cols.push(mmul(A, cols[k - 1])); rows.push(mmul(rows[k - 1], A)); }
        var Qc = A.map(function (_, i) { return cols.map(function (c) { return c[i][0]; }); }), Qo = rows.map(function (r) { return r[0]; });
        var rc = rref(Qc).piv.length, ro = rref(Qo).piv.length;
        list.appendChild(card("Q_c = [B  AB  …  Aⁿ⁻¹B]", show(Qc))); list.appendChild(card("rank Q_c", rc + " of " + n + (rc === n ? " → controllable" : " → NOT controllable")));
        list.appendChild(card("Q_o = [C; CA; …; CAⁿ⁻¹]", show(Qo))); list.appendChild(card("rank Q_o", ro + " of " + n + (ro === n ? " → observable" : " → NOT observable")));
        st.push("det Q_c = " + frac(det(Qc)) + (Math.abs(det(Qc)) > 1e-12 ? " ≠ 0 → full rank → completely state controllable." : " = 0 → rank deficient → not controllable."));
        st.push("det Q_o = " + frac(det(Qo)) + (Math.abs(det(Qo)) > 1e-12 ? " ≠ 0 → completely observable." : " = 0 → not observable."));
        return;
      }
      // Faddeev–LeVerrier: adj(sI − A) = Σ N_k s^(n−1−k),  det(sI − A) = Σ c_k s^(n−k)
      var I = A.map(function (r, i) { return r.map(function (_, j) { return i === j ? 1 : 0; }); }), N = I, c = [1], Ns = [I];
      for (var k2 = 1; k2 <= n; k2++) {
        var AN = mmul(A, N), tr = 0; for (var q = 0; q < n; q++) tr += AN[q][q];
        var ck = -tr / k2; c.push(ck);
        N = AN.map(function (r, i) { return r.map(function (v, j) { return v + (i === j ? ck : 0); }); });
        if (k2 < n) Ns.push(N);
      }
      var num = Ns.map(function (Nk) { return mmul(mmul(Cv, Nk), Bv)[0][0]; });
      num.unshift(0); // degree n slot
      num = num.map(function (v, i) { return v + D * c[i]; });
      while (num.length > 1 && Math.abs(num[0]) < 1e-12) num.shift();
      list.appendChild(card("G(s) = C(sI − A)⁻¹B + D", "(" + polyTxt(num, "s") + ") / (" + polyTxt(c, "s") + ")"));
      list.appendChild(card("Characteristic equation |sI − A| = 0", polyTxt(c, "s") + " = 0"));
      list.appendChild(card("Poles", KT.tf.roots(c).map(function (z) { return KT.isC(z) ? F.complex(z, "rect", "", 4) : frac(z); }).join(",  ")));
      var zs = num.length > 1 ? KT.tf.roots(num) : [];
      list.appendChild(card("Zeros", zs.length ? zs.map(function (z) { return KT.isC(z) ? F.complex(z, "rect", "", 4) : frac(z); }).join(",  ") : "none"));
      st.push("|sI − A| = " + polyTxt(c, "s") + " (Faddeev–LeVerrier: c_k = −tr(A N_(k−1))/k).");
      Ns.forEach(function (Nk, i) { st.push("N" + i + " = " + Nk.map(function (r) { return "[" + r.map(frac).join(", ") + "]"; }).join(" ") + "  → C N" + i + " B = " + frac(mmul(mmul(Cv, Nk), Bv)[0][0]) + " (coefficient of s^" + (n - 1 - i) + ")"); });
      st.push("adj(sI − A) = Σ N_k s^(n−1−k), so G(s) = [Σ (C N_k B) s^(n−1−k)] / |sI − A| + D.");
    }
    function calc() {
      out.innerHTML = "";
      var list = el("dl", "kt-readouts"), st = [];
      out.appendChild(list);
      try {
        if (mode === "param") {
          // det(A(k)) is a polynomial of degree ≤ n in k: sample n+1 points and fit
          var ks = [], ds = [];
          for (var t = 0; t <= n; t++) { ks.push(t - 1); ds.push(det(read({ k: t - 1, [sym]: t - 1 }))); }
          var V = ks.map(function (k) { return ks.map(function (_, p) { return Math.pow(k, n - p); }); });
          var R = rref(V.map(function (r, i) { return r.concat([ds[i]]); })).A, coeff = R.map(function (r) { return r[n + 1]; });
          while (coeff.length > 1 && Math.abs(coeff[0]) < 1e-9) coeff.shift();
          var poly = coeff.map(function (c, i) { var p = coeff.length - 1 - i; if (Math.abs(c) < 1e-9) return ""; return (c < 0 ? " − " : " + ") + frac(Math.abs(c)) + (p > 1 ? sym + "^" + p : p === 1 ? sym : ""); }).join("").replace(/^ \+ /, "").replace(/^ − /, "−");
          list.appendChild(card("det A as a polynomial in " + sym, poly || "0"));
          var roots = coeff.length > 1 ? KT.tf.roots(coeff).filter(function (z) { return !KT.isC(z); }) : [];
          list.appendChild(card("det A = 0 when " + sym + " =", roots.length ? roots.map(frac).join(",  ") : "no real value"));
          st.push("Expand det A with " + sym + " left as a symbol: " + (poly || "0") + ".");
          st.push("Set it to zero and solve: " + sym + " = " + (roots.map(frac).join(" or ") || "no real root") + ". For these values A is singular (no inverse; the system has no unique solution).");
          steps.update(st); return;
        }
        var M = read();
        if (mode === "ss2tf" || mode === "ctrb") { ss(M, list, st); steps.update(st); return; }
        var d = det(M);
        if (mode === "det" || mode === "inv" || mode === "cramer") list.appendChild(card("det A", frac(d)));
        if (mode === "det") {
          if (n === 2) st.push("det A = a₁₁a₂₂ − a₁₂a₂₁ = (" + frac(M[0][0]) + ")(" + frac(M[1][1]) + ") − (" + frac(M[0][1]) + ")(" + frac(M[1][0]) + ") = " + frac(d));
          else {
            var C = cof(M);
            st.push("Expand along row 1: det A = Σ a₁ⱼ C₁ⱼ, with C₁ⱼ = (−1)^(1+j) M₁ⱼ.");
            M[0].forEach(function (a, j) { st.push("a₁" + (j + 1) + " = " + frac(a) + ",  M₁" + (j + 1) + " = " + frac(det(minor(M, 0, j))) + ",  C₁" + (j + 1) + " = " + frac(C[0][j]) + ",  product = " + frac(a * C[0][j])); });
            st.push("det A = " + M[0].map(function (a, j) { return "(" + frac(a * C[0][j]) + ")"; }).join(" + ") + " = " + frac(d));
          }
        } else if (mode === "inv") {
          if (Math.abs(d) < 1e-12) { list.appendChild(card("Inverse", "none: det A = 0 (singular)")); st.push("det A = 0, so A has no inverse."); }
          else {
            var Cf = cof(M), adj = T(Cf), inv = adj.map(function (r) { return r.map(function (v) { return v / d; }); });
            list.appendChild(card("A⁻¹ = adj(A) / det A", show(inv)));
            st.push("det A = " + frac(d) + " ≠ 0, so A⁻¹ exists.");
            var cg = el("div"); st.push("Cofactor matrix C = " + Cf.map(function (r) { return "[" + r.map(frac).join(", ") + "]"; }).join(" "));
            st.push("adj A = Cᵀ = " + adj.map(function (r) { return "[" + r.map(frac).join(", ") + "]"; }).join(" "));
            st.push("A⁻¹ = adj A ÷ " + frac(d) + " = " + inv.map(function (r) { return "[" + r.map(frac).join(", ") + "]"; }).join(" "));
          }
        } else if (mode === "rank") {
          var rr = rref(M, st);
          list.appendChild(card("Rank", String(rr.piv.length)));
          list.appendChild(card("Reduced row-echelon form", show(rr.A)));
          st.push("Non-zero rows in RREF = rank = " + rr.piv.length + ".");
        } else if (mode === "solve") {
          var bb = readB(), Ab = M.map(function (r, i) { return r.concat([bb[i]]); });
          var ra = rref(M).piv.length, rab = rref(Ab, st);
          var rk = rab.piv.length;
          list.appendChild(card("rank A / rank [A|b]", ra + " / " + rk));
          if (rk > ra) { list.appendChild(card("Solution", "none (inconsistent: rank A < rank [A|b])")); }
          else if (ra < n) { list.appendChild(card("Solution", "infinitely many (" + (n - ra) + " free variable" + (n - ra > 1 ? "s" : "") + ")")); }
          else list.appendChild(card("Solution x", rab.A.map(function (r, i) { return "x" + (i + 1) + " = " + frac(r[n]); }).join(",  ")));
          list.appendChild(card("Augmented matrix after elimination", show(rab.A, true)));
          st.push(rk > ra ? "A row reads 0 = non-zero → no solution." : ra < n ? "Fewer pivots than unknowns → infinitely many solutions." : "Unique solution read from the last column.");
        } else if (mode === "cramer") {
          var b2 = readB();
          if (Math.abs(d) < 1e-12) { list.appendChild(card("Cramer's rule", "not usable: det A = 0")); }
          else {
            var xs = [];
            for (var j = 0; j < n; j++) {
              var Aj = M.map(function (r, i) { return r.map(function (v, c) { return c === j ? b2[i] : v; }); }), dj = det(Aj);
              xs.push(dj / d);
              st.push("A" + (j + 1) + " = A with column " + (j + 1) + " replaced by b: det A" + (j + 1) + " = " + frac(dj) + " → x" + (j + 1) + " = " + frac(dj) + " / " + frac(d) + " = " + frac(dj / d));
            }
            list.appendChild(card("Solution x", xs.map(function (v, i) { return "x" + (i + 1) + " = " + frac(v); }).join(",  ")));
          }
        } else if (mode === "eig") {
          // characteristic polynomial via Faddeev–LeVerrier
          var I = M.map(function (r, i) { return r.map(function (_, j) { return i === j ? 1 : 0; }); }), Mk = I, c = [1];
          var mul = function (X, Y) { return X.map(function (r) { return Y[0].map(function (_, j) { return r.reduce(function (s, v, k) { return s + v * Y[k][j]; }, 0); }); }); };
          var AM = null;
          for (var k = 1; k <= n; k++) {
            AM = mul(M, Mk);
            var tr = 0; for (var q = 0; q < n; q++) tr += AM[q][q];
            var ck = -tr / k; c.push(ck);
            Mk = AM.map(function (r, i) { return r.map(function (v, j) { return v + (i === j ? ck : 0); }); });
          }
          var lam = KT.tf.roots(c);
          var cp = c.map(function (v, i) { var p = n - i; if (Math.abs(v) < 1e-12) return ""; return (v < 0 ? " − " : " + ") + (Math.abs(Math.abs(v) - 1) < 1e-12 && p ? "" : frac(Math.abs(v))) + (p > 1 ? "λ^" + p : p === 1 ? "λ" : ""); }).join("").replace(/^ \+ /, "");
          list.appendChild(card("Characteristic equation", cp + " = 0"));
          list.appendChild(card("Eigenvalues λ", lam.map(function (z) { return KT.isC(z) ? F.complex(z, "rect", "", 4) : frac(z); }).join(",  ")));
          lam.forEach(function (z) {
            if (KT.isC(z)) return;
            var B = M.map(function (r, i) { return r.map(function (v, j) { return v - (i === j ? z : 0); }); });
            var R2 = rref(B).A, free = -1, piv = rref(B).piv;
            for (var c2 = 0; c2 < n; c2++) if (piv.indexOf(c2) < 0) { free = c2; break; }
            if (free < 0) return;
            var v = new Array(n).fill(0); v[free] = 1;
            piv.forEach(function (pc, ri) { v[pc] = -R2[ri][free]; });
            st.push("λ = " + frac(z) + ":  (A − λI)v = 0 → v = [" + v.map(frac).join(", ") + "]ᵀ");
          });
          st.unshift("det(A − λI) = " + cp + " = 0");
        }
      } catch (e) { var p = el("p", "kt-error", "Check the entries — " + (e.message || e)); out.appendChild(p); }
      steps.update(st.length ? st : ["Nothing to show for this choice."]);
    }
    grid(); calc();
  }
  KT.define("matrix", build);
})();
