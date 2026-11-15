/* MATLAB Academy animated explainers and the block-diagram practice sandbox.
   MLAnim.mount(name, element, arg): "indexing", "matmul", "plotmap", "ode", "fft", "flow" (an animated, read-only
   block diagram) and "sandbox" (drag, wire and simulate blocks). Every animation has play/pause/step controls and
   a still, fully readable state when the reader prefers reduced motion. */
(function () {
  "use strict";
  var REDUCE = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function btn(label, cls) { var b = el("button", "mla-btn " + (cls || "mla-btn--ghost"), label); b.type = "button"; return b; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function frame(title, sub) { var w = el("div", "mla-fx"); w.innerHTML = '<div class="mla-code__head"><span class="mla-code__title">' + esc(title) + " <em>" + esc(sub || "animated explainer") + '</em></span></div><div class="mla-fx__stage"></div><div class="mla-code__bar mla-fx__bar"></div><p class="mla-fx__cap" aria-live="polite"></p>'; return { root: w, stage: w.querySelector(".mla-fx__stage"), bar: w.querySelector(".mla-fx__bar"), cap: w.querySelector(".mla-fx__cap") }; }
  /* a stepper: steps = [fn], with Back / Step / Play controls */
  function stepper(f, n, show, opts) {
    opts = opts || {}; var k = 0, timer = null, b0 = btn("Back"), b1 = btn("Step", "mla-btn--go"), bp = btn("Play"), br = btn("Restart"), cnt = el("span", "mla-trace__count"), scrub = el("input", "mla-scrub");
    scrub.type = "range"; scrub.min = 0; scrub.step = 1; scrub.setAttribute("aria-label", opts.label || "Step");
    [b0, b1, bp, br].forEach(function (b) { f.bar.appendChild(b); }); f.bar.appendChild(scrub); f.bar.appendChild(cnt);
    scrub.oninput = function () { stop(); k = Math.max(0, Math.min(n() - 1, +scrub.value)); paint(); };
    function paint() { show(k); var N = n(); cnt.textContent = (opts.label || "Step") + " " + (k + 1) + " of " + N; b0.disabled = k === 0; b1.disabled = k >= N - 1; scrub.max = Math.max(0, N - 1); scrub.value = k; scrub.style.setProperty("--p", (N > 1 ? k / (N - 1) * 100 : 0) + "%"); }
    function stop() { clearInterval(timer); timer = null; bp.textContent = "Play"; }
    b1.onclick = function () { stop(); if (k < n() - 1) k++; paint(); };
    b0.onclick = function () { stop(); if (k > 0) k--; paint(); };
    br.onclick = function () { stop(); k = 0; paint(); };
    bp.onclick = function () { if (timer) return stop(); if (k >= n() - 1) k = 0; bp.textContent = "Pause"; timer = setInterval(function () { if (k >= n() - 1) return stop(); k++; paint(); }, REDUCE ? 1500 : (opts.ms || 650)); paint(); };
    paint();
    return { reset: function () { stop(); k = 0; paint(); }, paint: paint, go: function (i) { stop(); k = i; paint(); } };
  }

  /* ---------- 1. matrix indexing: which elements does an index pick? ---------- */
  function indexing(host) {
    var f = frame("Indexing a matrix", "pick an expression, then step through"), A = [[16, 2, 3, 13], [5, 11, 10, 8], [9, 7, 6, 12], [4, 14, 15, 1]], R = 4, C = 4;
    var EX = [
      ["A(2,3)", "row 2, column 3", function () { return [[1, 2]]; }],
      ["A(3)", "linear index 3: MATLAB counts down the columns", function () { return [[2, 0]]; }],
      ["A(7)", "linear index 7 is in column 2 (4 per column), row 3", function () { return [[2, 1]]; }],
      ["A(2,:)", "the colon means every column of row 2", function () { var o = []; for (var j = 0; j < C; j++) o.push([1, j]); return o; }],
      ["A(:,end)", "every row of the last column", function () { var o = []; for (var i = 0; i < R; i++) o.push([i, C - 1]); return o; }],
      ["A(2:3,[1 4])", "rows 2 to 3, columns 1 and 4", function () { return [[1, 0], [2, 0], [1, 3], [2, 3]]; }],
      ["A(end,end)", "end means the last index in that position", function () { return [[R - 1, C - 1]]; }],
      ["A(A>10)", "logical indexing: every element where the test is true, in column order", function () { var o = []; for (var j = 0; j < C; j++) for (var i = 0; i < R; i++) if (A[i][j] > 10) o.push([i, j]); return o; }],
      ["A(:)'", "A(:) stacks every column into one long column", function () { var o = []; for (var j = 0; j < C; j++) for (var i = 0; i < R; i++) o.push([i, j]); return o; }]
    ];
    var pick = el("div", "mla-fx__chips"), cur = 0, cells = [], svg = sv("svg", { viewBox: "0 0 520 250", class: "mla-fx__svg", role: "img", "aria-label": "4 by 4 matrix A = magic(4)" });
    EX.forEach(function (e, i) { var b = btn("<code>" + esc(e[0]) + "</code>", "mla-chip"); b.setAttribute("aria-pressed", i === 0); b.onclick = function () { cur = i; [].forEach.call(pick.children, function (c, j) { c.setAttribute("aria-pressed", j === i); }); st.reset(); }; pick.appendChild(b); });
    sv("text", { x: 20, y: 22, class: "mla-fx__t" }, svg).textContent = "A = magic(4)";
    for (var i = 0; i < R; i++) for (var j = 0; j < C; j++) { var g = sv("g", {}, svg), x = 20 + j * 56, y = 36 + i * 50; sv("rect", { x: x, y: y, width: 50, height: 44, rx: 6, class: "mla-fx__cell" }, g); sv("text", { x: x + 25, y: y + 28, "text-anchor": "middle", class: "mla-fx__v" }, g).textContent = A[i][j]; sv("text", { x: x + 46, y: y + 12, "text-anchor": "end", class: "mla-fx__li" }, g).textContent = j * R + i + 1; cells.push({ g: g, i: i, j: j }); }
    sv("text", { x: 20, y: 245, class: "mla-fx__li" }, svg).textContent = "small grey numbers = linear index (column-major order)";
    var res = sv("text", { x: 270, y: 60, class: "mla-fx__t" }, svg), resv = sv("text", { x: 270, y: 92, class: "mla-fx__res" }, svg), note = sv("text", { x: 270, y: 124, class: "mla-fx__li" }, svg);
    f.stage.appendChild(pick); f.stage.appendChild(svg);
    var st = stepper(f, function () { return EX[cur][2]().length + 1; }, function (k) {
      var list = EX[cur][2](), shown = list.slice(0, k);
      cells.forEach(function (c) { var on = shown.some(function (p) { return p[0] === c.i && p[1] === c.j; }), last = k > 0 && list[k - 1][0] === c.i && list[k - 1][1] === c.j; c.g.setAttribute("class", on ? (last ? "is-hot" : "is-on") : ""); });
      res.textContent = EX[cur][0] + "  →"; resv.textContent = "[" + shown.map(function (p) { return A[p[0]][p[1]]; }).join(" ") + (k < list.length ? " …" : "") + "]"; note.textContent = "";
      f.cap.textContent = k === 0 ? EX[cur][0] + ": " + EX[cur][1] + ". Press Step." : k >= list.length ? "Done: " + list.length + " element" + (list.length > 1 ? "s" : "") + " selected. " + EX[cur][1] + "." : "Element " + k + ": row " + (list[k - 1][0] + 1) + ", column " + (list[k - 1][1] + 1) + " (linear index " + (list[k - 1][1] * R + list[k - 1][0] + 1) + ") = " + A[list[k - 1][0]][list[k - 1][1]];
    }, { label: "Element" });
    host.appendChild(f.root);
  }

  /* ---------- 2. element-wise (.*) versus matrix (*) multiplication ---------- */
  function matmul(host) {
    var f = frame("A.*B versus A*B", "the dot changes everything"), A = [[1, 2], [3, 4]], B = [[5, 6], [7, 8]], mode = "ew";
    var pick = el("div", "mla-fx__chips"), b1 = btn("<code>A .* B</code> element-wise", "mla-chip"), b2 = btn("<code>A * B</code> matrix product", "mla-chip");
    b1.setAttribute("aria-pressed", "true"); b2.setAttribute("aria-pressed", "false");
    b1.onclick = function () { mode = "ew"; b1.setAttribute("aria-pressed", "true"); b2.setAttribute("aria-pressed", "false"); st.reset(); };
    b2.onclick = function () { mode = "mm"; b2.setAttribute("aria-pressed", "true"); b1.setAttribute("aria-pressed", "false"); st.reset(); };
    pick.appendChild(b1); pick.appendChild(b2);
    var svg = sv("svg", { viewBox: "0 0 560 200", class: "mla-fx__svg", role: "img", "aria-label": "A = [1 2; 3 4], B = [5 6; 7 8]" });
    function grid(x0, name, M, key) { sv("text", { x: x0 + 52, y: 22, "text-anchor": "middle", class: "mla-fx__t" }, svg).textContent = name; var out = []; for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) { var g = sv("g", { "data-k": key + i + j }, svg), x = x0 + j * 54, y = 36 + i * 54; sv("rect", { x: x, y: y, width: 48, height: 48, rx: 6, class: "mla-fx__cell" }, g); var t = sv("text", { x: x + 24, y: y + 30, "text-anchor": "middle", class: "mla-fx__v" }, g); t.textContent = M ? M[i][j] : "?"; out.push({ g: g, t: t, i: i, j: j }); } return out; }
    var ga = grid(10, "A", A, "a"), gb = grid(160, "B", B, "b"), gc = grid(380, "result", null, "c");
    var op = sv("text", { x: 135, y: 100, "text-anchor": "middle", class: "mla-fx__res" }, svg), eq = sv("text", { x: 340, y: 100, "text-anchor": "middle", class: "mla-fx__res" }, svg); eq.textContent = "=";
    var work = sv("text", { x: 280, y: 188, "text-anchor": "middle", class: "mla-fx__t" }, svg);
    f.stage.appendChild(pick); f.stage.appendChild(svg);
    var order = [[0, 0], [0, 1], [1, 0], [1, 1]];
    var st = stepper(f, function () { return 5; }, function (k) {
      op.textContent = mode === "ew" ? ".*" : "*";
      [ga, gb, gc].forEach(function (g) { g.forEach(function (c) { c.g.setAttribute("class", ""); }); });
      gc.forEach(function (c, n) { var idx = order.findIndex(function (o) { return o[0] === c.i && o[1] === c.j; }); c.t.textContent = idx < k ? (mode === "ew" ? A[c.i][c.j] * B[c.i][c.j] : A[c.i][0] * B[0][c.j] + A[c.i][1] * B[1][c.j]) : "?"; void n; });
      if (k === 0) { work.textContent = ""; f.cap.textContent = mode === "ew" ? "Element-wise: each result is the product of the two numbers in the same position. Sizes must match (or one is a scalar)." : "Matrix product: each result is a row of A times a column of B, added up. Columns of A must equal rows of B."; return; }
      var p = order[k - 1], i = p[0], j = p[1];
      gc.forEach(function (c) { if (c.i === i && c.j === j) c.g.setAttribute("class", "is-hot"); });
      if (mode === "ew") { ga.concat(gb).forEach(function (c) { if (c.i === i && c.j === j) c.g.setAttribute("class", "is-on"); }); work.textContent = "result(" + (i + 1) + "," + (j + 1) + ") = " + A[i][j] + " × " + B[i][j] + " = " + A[i][j] * B[i][j]; }
      else { ga.forEach(function (c) { if (c.i === i) c.g.setAttribute("class", "is-on"); }); gb.forEach(function (c) { if (c.j === j) c.g.setAttribute("class", "is-on"); }); work.textContent = "row " + (i + 1) + " of A · column " + (j + 1) + " of B = " + A[i][0] + "×" + B[0][j] + " + " + A[i][1] + "×" + B[1][j] + " = " + (A[i][0] * B[0][j] + A[i][1] * B[1][j]); }
      f.cap.textContent = k === 4 ? (mode === "ew" ? "A.*B = [5 12; 21 32]. Try A*B to compare: [19 22; 43 50]." : "A*B = [19 22; 43 50]. Element-wise gives [5 12; 21 32]: a different answer.") : work.textContent;
    }, { label: "Step" });
    host.appendChild(f.root);
  }

  /* ---------- 3. how plot turns numbers into a picture ---------- */
  function plotmap(host) {
    var f = frame("How plot(x, y) draws", "points, then straight lines between them"), n = 5;
    var ctl = el("div", "mla-fx__chips"); ctl.innerHTML = '<label class="mla-fx__range">Number of points <code>n</code> in <code>x = linspace(0, 2*pi, n)</code>: <input type="range" min="3" max="60" value="5"> <b>5</b></label>';
    var range = ctl.querySelector("input"), lab = ctl.querySelector("b");
    var svg = sv("svg", { viewBox: "0 0 560 260", class: "mla-fx__svg", role: "img", "aria-label": "Points of sin(x) and the line through them" });
    var tbl = el("div", "mla-fx__tbl");
    f.stage.appendChild(ctl); f.stage.appendChild(svg); f.stage.appendChild(tbl);
    var L = 40, T = 20, W = 500, H = 200;
    function X(v) { return L + v / (2 * Math.PI) * W; } function Y(v) { return T + (1 - (v + 1) / 2) * H; }
    var st;
    function draw(k) {
      svg.innerHTML = "";
      sv("rect", { x: L, y: T, width: W, height: H, class: "mla-fx__axes" }, svg); sv("line", { x1: L, y1: Y(0), x2: L + W, y2: Y(0), class: "mla-fx__zero" }, svg);
      var tr = "", i; for (i = 0; i <= 200; i++) { var xv = 2 * Math.PI * i / 200; tr += (i ? "L" : "M") + X(xv).toFixed(1) + " " + Y(Math.sin(xv)).toFixed(1); } sv("path", { d: tr, class: "mla-fx__ghost" }, svg);
      var xs = [], ys = []; for (i = 0; i < n; i++) { xs.push(2 * Math.PI * i / (n - 1)); ys.push(Math.sin(xs[i])); }
      var shown = Math.min(n, k), d = "";
      for (i = 0; i < shown; i++) d += (i ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(ys[i]).toFixed(1);
      if (k > n && shown > 1) sv("path", { d: d, class: "mla-fx__line" }, svg);
      for (i = 0; i < shown; i++) sv("circle", { cx: X(xs[i]), cy: Y(ys[i]), r: n > 30 ? 2.5 : 4.5, class: i === shown - 1 && k <= n ? "mla-fx__pt is-hot" : "mla-fx__pt" }, svg);
      sv("text", { x: L, y: T + H + 18, class: "mla-fx__li" }, svg).textContent = "0"; sv("text", { x: L + W, y: T + H + 18, "text-anchor": "end", class: "mla-fx__li" }, svg).textContent = "2π";
      tbl.innerHTML = n <= 12 ? "<table class='mla-table'><tr><th>x</th>" + xs.map(function (v, j) { return "<td" + (j < shown ? " class='is-on'" : "") + ">" + v.toFixed(2) + "</td>"; }).join("") + "</tr><tr><th>y = sin(x)</th>" + ys.map(function (v, j) { return "<td" + (j < shown ? " class='is-on'" : "") + ">" + v.toFixed(2) + "</td>"; }).join("") + "</tr></table>" : "";
      f.cap.textContent = k === 0 ? "plot gets two vectors of the same length. Press Step to place each (x, y) pair." : k <= n ? "Point " + k + ": x = " + xs[k - 1].toFixed(3) + ", y = " + ys[k - 1].toFixed(3) : "plot joins neighbouring points with straight lines. With only " + n + " points the curve looks " + (n < 12 ? "jagged" : "smooth") + ". Drag the slider to change n.";
    }
    st = stepper(f, function () { return n + 2; }, draw, { ms: 400 });
    range.addEventListener("input", function () { n = +range.value; lab.textContent = n; st.go(n + 1); });
    host.appendChild(f.root);
  }

  /* ---------- 4. Euler and RK4 stepping along an ODE ---------- */
  function ode(host) {
    var f = frame("Solving dy/dt = −2y + sin(3t)", "how a numerical solver steps"), h = 0.4, method = "euler", T = 4;
    function rhs(t, y) { return -2 * y + Math.sin(3 * t); }
    function exact(t) { return 16 / 13 * Math.exp(-2 * t) + (2 * Math.sin(3 * t) - 3 * Math.cos(3 * t)) / 13; }
    var ctl = el("div", "mla-fx__chips"); ctl.innerHTML = '<button type="button" class="mla-btn mla-chip" aria-pressed="true" data-m="euler">Euler</button><button type="button" class="mla-btn mla-chip" aria-pressed="false" data-m="rk4">Runge–Kutta 4</button><label class="mla-fx__range">step size <code>h</code> <input type="range" min="5" max="80" value="40"> <b>0.40</b></label>';
    var svg = sv("svg", { viewBox: "0 0 560 260", class: "mla-fx__svg", role: "img", "aria-label": "Exact solution and numerical steps" });
    f.stage.appendChild(ctl); f.stage.appendChild(svg);
    var L = 40, Tp = 16, W = 500, H = 210, ymin = -0.5, ymax = 1.1;
    function X(v) { return L + v / T * W; } function Y(v) { return Tp + (1 - (v - ymin) / (ymax - ymin)) * H; }
    function pts() { var t = 0, y = 1, out = [{ t: 0, y: 1 }]; while (t < T - 1e-9) { var k1 = rhs(t, y), yn; if (method === "euler") yn = y + h * k1; else { var k2 = rhs(t + h / 2, y + h / 2 * k1), k3 = rhs(t + h / 2, y + h / 2 * k2), k4 = rhs(t + h, y + h * k3); yn = y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); } out.push({ t: t + h, y: yn, slope: k1, from: y }); t += h; y = yn; } return out; }
    var P = pts();
    function draw(k) {
      svg.innerHTML = ""; sv("rect", { x: L, y: Tp, width: W, height: H, class: "mla-fx__axes" }, svg); sv("line", { x1: L, y1: Y(0), x2: L + W, y2: Y(0), class: "mla-fx__zero" }, svg);
      var d = "", i; for (i = 0; i <= 200; i++) { var tt = T * i / 200; d += (i ? "L" : "M") + X(tt).toFixed(1) + " " + Y(exact(tt)).toFixed(1); } sv("path", { d: d, class: "mla-fx__ghost" }, svg);
      var pd = ""; for (i = 0; i <= k && i < P.length; i++) pd += (i ? "L" : "M") + X(P[i].t).toFixed(1) + " " + Y(P[i].y).toFixed(1); sv("path", { d: pd, class: "mla-fx__line" }, svg);
      for (i = 0; i <= k && i < P.length; i++) sv("circle", { cx: X(P[i].t), cy: Y(P[i].y), r: 4, class: i === k ? "mla-fx__pt is-hot" : "mla-fx__pt" }, svg);
      if (k < P.length - 1) { var p = P[k], s = rhs(p.t, p.y), x2 = p.t + h; sv("line", { x1: X(p.t), y1: Y(p.y), x2: X(x2), y2: Y(p.y + s * h), class: "mla-fx__slope" }, svg); }
      sv("text", { x: L + 8, y: Tp + 16, class: "mla-fx__li" }, svg).textContent = "grey: exact solution   ·   coloured: " + (method === "euler" ? "Euler" : "RK4") + " with h = " + h.toFixed(2);
      var err = Math.abs(P[Math.min(k, P.length - 1)].y - exact(P[Math.min(k, P.length - 1)].t));
      f.cap.textContent = k === 0 ? "Start at y(0) = 1. Each step uses the slope f(t, y) to jump h seconds ahead." : "t = " + P[k].t.toFixed(2) + ": y ≈ " + P[k].y.toFixed(4) + ", exact " + exact(P[k].t).toFixed(4) + ", error " + err.toExponential(1) + (method === "euler" ? ". Euler uses one slope per step; halve h and the error roughly halves." : ". RK4 averages four slopes per step; halve h and the error drops about 16 times.");
    }
    var st = stepper(f, function () { return P.length; }, draw, { ms: 420 });
    ctl.addEventListener("click", function (e) { var b = e.target.closest("[data-m]"); if (!b) return; method = b.getAttribute("data-m"); [].forEach.call(ctl.querySelectorAll("[data-m]"), function (c) { c.setAttribute("aria-pressed", c === b); }); P = pts(); st.reset(); });
    var rg = ctl.querySelector("input"); rg.addEventListener("input", function () { h = rg.value / 100; ctl.querySelector("b").textContent = h.toFixed(2); P = pts(); st.go(P.length - 1); });
    host.appendChild(f.root);
  }

  /* ---------- 5. sum of sines and its spectrum ---------- */
  function fft(host) {
    var f = frame("What fft shows", "a signal and its frequency content"), comps = [[50, 1], [120, 0.5], [0, 0]];
    var ctl = el("div", "mla-fx__chips"); ctl.innerHTML = [0, 1, 2].map(function (i) { return '<label class="mla-fx__range">tone ' + (i + 1) + ': <input type="range" min="0" max="240" step="10" value="' + comps[i][0] + '" data-f="' + i + '"> <b>' + comps[i][0] + ' Hz</b> amp <input type="range" min="0" max="10" value="' + comps[i][1] * 10 + '" data-a="' + i + '"></label>'; }).join("");
    var svg = sv("svg", { viewBox: "0 0 560 300", class: "mla-fx__svg", role: "img", "aria-label": "Time signal above, single-sided spectrum below" });
    f.stage.appendChild(ctl); f.stage.appendChild(svg);
    function draw() {
      svg.innerHTML = ""; var Fs = 1000, N = 500, i, k, x = [];
      for (i = 0; i < N; i++) { var s = 0; comps.forEach(function (c) { s += c[1] * Math.sin(2 * Math.PI * c[0] * i / Fs); }); x.push(s); }
      sv("rect", { x: 40, y: 10, width: 500, height: 110, class: "mla-fx__axes" }, svg); var d = ""; for (i = 0; i < 200; i++) d += (i ? "L" : "M") + (40 + i * 2.5).toFixed(1) + " " + (65 - x[i] * 22).toFixed(1); sv("path", { d: d, class: "mla-fx__line" }, svg);
      sv("text", { x: 44, y: 24, class: "mla-fx__li" }, svg).textContent = "x(t), first 0.2 s (Fs = 1000 Hz)";
      sv("rect", { x: 40, y: 150, width: 500, height: 120, class: "mla-fx__axes" }, svg);
      for (k = 0; k <= 250; k += 1) { var re = 0, im = 0; for (i = 0; i < N; i++) { re += x[i] * Math.cos(2 * Math.PI * k * i / N); im -= x[i] * Math.sin(2 * Math.PI * k * i / N); } var mag = Math.hypot(re, im) / N * (k ? 2 : 1), fr = k * Fs / N; if (fr > 250) break; var px = 40 + fr / 250 * 500; if (mag > 0.01) sv("line", { x1: px, y1: 270, x2: px, y2: 270 - mag * 100, class: "mla-fx__stem" }, svg); }
      [0, 50, 100, 150, 200, 250].forEach(function (v) { sv("text", { x: 40 + v / 250 * 500, y: 288, "text-anchor": "middle", class: "mla-fx__li" }, svg).textContent = v + " Hz"; });
      sv("text", { x: 44, y: 166, class: "mla-fx__li" }, svg).textContent = "P1 = single-sided amplitude of fft(x)";
      f.cap.textContent = "Each tone becomes one spike at its own frequency; the spike height is its amplitude. Move the sliders.";
    }
    ctl.addEventListener("input", function (e) { var t = e.target; if (t.hasAttribute("data-f")) { comps[+t.getAttribute("data-f")][0] = +t.value; t.nextElementSibling.textContent = t.value + " Hz"; } else comps[+t.getAttribute("data-a")][1] = t.value / 10; draw(); });
    draw(); host.appendChild(f.root);
  }

  /* ================= block-diagram sandbox ================= */
  var TYPES = {
    step: { label: "Step", lib: "Simulink > Sources", ins: 0, p: { time: 1, before: 0, after: 1 }, txt: function (p) { return "Step"; } },
    constant: { label: "Constant", lib: "Simulink > Sources", ins: 0, p: { value: 1 }, txt: function (p) { return String(p.value); } },
    sine: { label: "Sine Wave", lib: "Simulink > Sources", ins: 0, p: { amp: 1, freq: 1, phase: 0, bias: 0 }, txt: function () { return "∿"; } },
    pulse: { label: "Pulse Generator", lib: "Simulink > Sources", ins: 0, p: { amp: 1, period: 2, width: 50 }, txt: function () { return "⊓⊓"; } },
    clock: { label: "Clock", lib: "Simulink > Sources", ins: 0, p: {}, txt: function () { return "t"; } },
    gain: { label: "Gain", lib: "Simulink > Math Operations", ins: 1, p: { k: 1 }, txt: function (p) { return String(p.k); }, shape: "tri" },
    sum: { label: "Sum", lib: "Simulink > Math Operations", ins: 2, p: { signs: "+-" }, txt: function (p) { return "Σ"; }, shape: "circ" },
    product: { label: "Product", lib: "Simulink > Math Operations", ins: 2, p: {}, txt: function () { return "×"; } },
    integrator: { label: "Integrator", lib: "Simulink > Continuous", ins: 1, p: { ic: 0, lo: "-inf", hi: "inf" }, txt: function () { return "1/s"; } },
    tf: { label: "Transfer Fcn", lib: "Simulink > Continuous", ins: 1, p: { num: "[1]", den: "[1 1]" }, txt: function (p) { return p.num + "/" + p.den; } },
    pid: { label: "PID Controller", lib: "Simulink > Continuous", ins: 1, p: { P: 1, I: 0, D: 0, N: 100 }, txt: function () { return "PID"; } },
    fcn: { label: "MATLAB Function (expression)", lib: "Simulink > User-Defined Functions", ins: 1, p: { expr: "u(1)^2", n: 1 }, txt: function (p) { return "f(u)"; } },
    sat: { label: "Saturation", lib: "Simulink > Discontinuities", ins: 1, p: { lo: -1, hi: 1 }, txt: function () { return "⌐¬"; } },
    switch: { label: "Switch", lib: "Simulink > Signal Routing", ins: 3, p: { threshold: 0.5 }, txt: function () { return "⇄"; } },
    relay: { label: "Relay", lib: "Simulink > Discontinuities", ins: 1, p: { on: 0.1, off: -0.1, outOn: 1, outOff: 0 }, txt: function () { return "▟▙"; } },
    pwm: { label: "PWM Generator", lib: "Simulink > Sources (build from Repeating Sequence + Relational Operator)", ins: 1, p: { freq: 5000 }, txt: function () { return "PWM"; } },
    delay: { label: "Unit Delay", lib: "Simulink > Discrete", ins: 1, p: { Ts: 0.1, ic: 0 }, txt: function () { return "1/z"; } },
    zoh: { label: "Zero-Order Hold", lib: "Simulink > Discrete", ins: 1, p: { Ts: 0.1 }, txt: function () { return "ZOH"; } },
    scope: { label: "Scope", lib: "Simulink > Sinks", ins: 1, p: { n: 1 }, txt: function () { return "▭"; }, outs: 0 }
  };
  var PNAMES = { time: "Step time", before: "Initial value", after: "Final value", value: "Constant value", amp: "Amplitude", freq: "Frequency (rad/s; Hz for PWM)", phase: "Phase (rad)", bias: "Bias", period: "Period (s)", width: "Pulse width (% of period)", k: "Gain", signs: "List of signs (e.g. +- or ++-)", ic: "Initial condition", num: "Numerator coefficients", den: "Denominator coefficients", P: "Proportional (P)", I: "Integral (I)", D: "Derivative (D)", N: "Filter coefficient (N)", expr: "Expression in u(1), u(2)…", n: "Number of inputs", lo: "Lower limit", hi: "Upper limit", threshold: "Threshold (passes input 1 when input 2 >= threshold, else input 3)", on: "Switch on point", off: "Switch off point", outOn: "Output when on", outOff: "Output when off", Ts: "Sample time (s)" };
  function nIns(b) { var T = TYPES[b.type]; if (b.type === "sum") return String(b.p.signs).replace(/[^+-]/g, "").length || 1; if (b.type === "fcn" || b.type === "scope") return Math.max(1, Math.min(4, +b.p.n || 1)); if (b.type === "product") return 2; return T.ins; }
  function nOuts(b) { return TYPES[b.type].outs === 0 ? 0 : 1; }
  function vecParse(s) { return String(s).replace(/[\[\]]/g, " ").trim().split(/[\s,]+/).filter(Boolean).map(Number); }
  var PRESETS = {
    rc: { title: "RC circuit charging: RC·dv/dt = Vs − v", stop: 6, blocks: [["s", "step", 30, 60, { time: 0.5, after: 5 }], ["sum", "sum", 150, 60, { signs: "+-" }], ["g", "gain", 240, 60, { k: 1 }], ["i", "integrator", 350, 60, { ic: 0 }], ["sc", "scope", 480, 60, { n: 1 }]], lines: [["s", "sum", 0], ["sum", "g", 0], ["g", "i", 0], ["i", "sc", 0], ["i", "sum", 1]], names: { g: "1/(RC)", i: "v" } },
    msd: { title: "Mass–spring–damper: m·x'' + b·x' + k·x = F", stop: 15, blocks: [["F", "step", 20, 60, { time: 1, after: 1 }], ["sum", "sum", 120, 60, { signs: "+--" }], ["m", "gain", 210, 60, { k: 1 }], ["i1", "integrator", 310, 60, {}], ["i2", "integrator", 420, 60, {}], ["sc", "scope", 530, 60, { n: 1 }], ["b", "gain", 310, 170, { k: 1 }], ["k", "gain", 420, 230, { k: 4 }]], lines: [["F", "sum", 0], ["sum", "m", 0], ["m", "i1", 0], ["i1", "i2", 0], ["i2", "sc", 0], ["i1", "b", 0], ["b", "sum", 1], ["i2", "k", 0], ["k", "sum", 2]], names: { m: "1/m", i1: "x' (velocity)", i2: "x (position)", b: "b", k: "k" } },
    vdp: { title: "Van der Pol oscillator: x'' − μ(1 − x²)x' + x = 0, μ = 1", stop: 20, blocks: [["fn", "fcn", 60, 60, { expr: "1*(1-u(1)^2)*u(2) - u(1)", n: 2 }], ["i1", "integrator", 220, 60, { ic: 0 }], ["i2", "integrator", 350, 60, { ic: 2 }], ["sc", "scope", 500, 80, { n: 2 }]], lines: [["fn", "i1", 0], ["i1", "i2", 0], ["i2", "sc", 0], ["i1", "sc", 1], ["i2", "fn", 0], ["i1", "fn", 1]], names: { i1: "x2 = x'", i2: "x1 = x", fn: "Fcn" } },
    pid: { title: "PID control of 1/(m s² + b s + k), m = 1, b = 10, k = 20", stop: 2, blocks: [["r", "step", 20, 60, { time: 0, after: 1 }], ["sum", "sum", 120, 60, { signs: "+-" }], ["c", "pid", 210, 60, { P: 350, I: 300, D: 50, N: 100 }], ["p", "tf", 330, 60, { num: "[1]", den: "[1 10 20]" }], ["sc", "scope", 500, 80, { n: 2 }]], lines: [["r", "sum", 0], ["sum", "c", 0], ["c", "p", 0], ["p", "sc", 0], ["r", "sc", 1], ["p", "sum", 1]], names: { c: "PID", p: "Plant" } },
    tf: { title: "Second-order transfer function step response", stop: 8, blocks: [["s", "step", 40, 60, { time: 0 }], ["g", "tf", 190, 60, { num: "[10]", den: "[1 2 10]" }], ["sc", "scope", 380, 60, {}]], lines: [["s", "g", 0], ["g", "sc", 0]], names: {} },
    feedback: { title: "Unity feedback around K/(s(s+2))", stop: 10, blocks: [["r", "step", 20, 60, { time: 0 }], ["sum", "sum", 130, 60, { signs: "+-" }], ["k", "gain", 220, 60, { k: 4 }], ["g", "tf", 330, 60, { num: "[1]", den: "[1 2 0]" }], ["sc", "scope", 490, 60, {}]], lines: [["r", "sum", 0], ["sum", "k", 0], ["k", "g", 0], ["g", "sc", 0], ["g", "sum", 1]], names: { k: "K" } },
    buck: { title: "Buck converter (switching model): 12 V in, duty 0.5, L = 1 mH, C = 100 µF, R = 10 Ω", stop: 0.02, blocks: [["d", "constant", 20, 30, { value: 0.5 }], ["pwm", "pwm", 110, 30, { freq: 5000 }], ["vin", "gain", 200, 30, { k: 12 }], ["s1", "sum", 290, 30, { signs: "+-" }], ["gl", "gain", 370, 30, { k: 1000 }], ["il", "integrator", 460, 30, { ic: 0, lo: 0 }], ["s2", "sum", 290, 150, { signs: "+-" }], ["gc", "gain", 370, 150, { k: 10000 }], ["vc", "integrator", 460, 150, {}], ["gr", "gain", 370, 240, { k: 0.1 }], ["sc", "scope", 580, 90, { n: 2 }]], lines: [["d", "pwm", 0], ["pwm", "vin", 0], ["vin", "s1", 0], ["vc", "s1", 1], ["s1", "gl", 0], ["gl", "il", 0], ["il", "s2", 0], ["gr", "s2", 1], ["s2", "gc", 0], ["gc", "vc", 0], ["vc", "gr", 0], ["vc", "sc", 0], ["il", "sc", 1]], names: { d: "duty", vin: "Vin", gl: "1/L", il: "iL (A)", gc: "1/C", vc: "vC (V)", gr: "1/R" } },
    motor: { title: "DC motor speed control: PI controller, voltage limit ±24 V", stop: 2, blocks: [["r", "step", 20, 60, { time: 0.1, after: 25 }], ["sum", "sum", 110, 60, { signs: "+-" }], ["c", "pid", 190, 60, { P: 2, I: 10, D: 0, N: 100 }], ["sat", "sat", 290, 60, { lo: -24, hi: 24 }], ["m", "tf", 390, 60, { num: "[0.5]", den: "[0.005 0.06 0.35]" }], ["sc", "scope", 540, 80, { n: 2 }]], lines: [["r", "sum", 0], ["sum", "c", 0], ["c", "sat", 0], ["sat", "m", 0], ["m", "sc", 0], ["r", "sc", 1], ["m", "sum", 1]], names: { c: "PI", m: "Motor", r: "speed ref (rad/s)" } },
    thermostat: { title: "On–off (relay) temperature control with hysteresis", stop: 60, blocks: [["r", "constant", 20, 60, { value: 50 }], ["sum", "sum", 110, 60, { signs: "+-" }], ["rel", "relay", 200, 60, { on: 2, off: -2, outOn: 100, outOff: 0 }], ["p", "tf", 310, 60, { num: "[1]", den: "[10 1]" }], ["sc", "scope", 480, 60, { n: 1 }]], lines: [["r", "sum", 0], ["sum", "rel", 0], ["rel", "p", 0], ["p", "sc", 0], ["p", "sum", 1]], names: { rel: "Relay", p: "Heater", r: "set point" } },
    sampled: { title: "Sampling a sine: Zero-Order Hold at Ts = 0.5 s", stop: 10, blocks: [["s", "sine", 30, 60, { freq: 1 }], ["z", "zoh", 180, 60, { Ts: 0.5 }], ["sc", "scope", 360, 60, { n: 2 }]], lines: [["s", "z", 0], ["z", "sc", 0], ["s", "sc", 1]], names: {} },
    blank: { title: "Empty model", stop: 10, blocks: [], lines: [], names: {} }
  };
  var compiled = {};
  function fcnOf(expr) {
    if (compiled[expr]) return compiled[expr];
    var MLab = window.MLab, I = new MLab.Interp({ maxMs: 20000 }), r = I.run("f__ = @(u) " + expr + ";");
    if (r.error) throw new Error("The expression '" + expr + "' is not valid MATLAB: " + r.error.message);
    var h = I.base.vars.f__;
    return (compiled[expr] = function (u) { var v = I.callHandle(h, [MLab._.colv(u)], 1, I.base)[0]; return v.d[0]; });
  }
  function simulate(model) {
    var B = model.blocks, byId = {}, src = {}, i;
    B.forEach(function (b) { byId[b.id] = b; src[b.id] = new Array(nIns(b)); });
    model.lines.forEach(function (l) { if (byId[l.from] && byId[l.to] && l.port < src[l.to].length) src[l.to][l.port] = l.from; });
    B.forEach(function (b) { src[b.id].forEach(function (s, k) { if (s === undefined) throw new Error((b.name || TYPES[b.type].label) + ": input " + (k + 1) + " is not connected. Connect it (or delete the block)."); }); });
    // states
    var off = 0, info = {};
    B.forEach(function (b) {
      var o = { at: off, n: 0 };
      if (b.type === "integrator") o.n = 1;
      else if (b.type === "pid") o.n = 2;
      else if (b.type === "tf") { var den = vecParse(b.p.den), num = vecParse(b.p.num); while (den.length > 1 && den[0] === 0) den.shift(); while (num.length > 1 && num[0] === 0) num.shift(); if (!den.length || den[0] === 0) throw new Error("Transfer Fcn: the denominator is empty or zero."); if (num.length > den.length) throw new Error("Transfer Fcn: the numerator order is higher than the denominator (improper)."); var a = den.map(function (v) { return v / den[0]; }), bb = num.map(function (v) { return v / den[0]; }); while (bb.length < a.length) bb.unshift(0); o.n = a.length - 1; o.a = a; o.b = bb; }
      info[b.id] = o; off += o.n;
    });
    var NX = off, stop = Math.max(0.01, +model.stop || 10), N = Math.min(4000, Math.max(400, Math.round(stop * 200))), rate = 0;
    B.forEach(function (b) { var o = info[b.id]; if (b.type === "pid") rate = Math.max(rate, Math.abs(+b.p.N) || 0); if (b.type === "tf" && o.n) { var bound = 0; for (var q = 1; q < o.a.length; q++) bound = Math.max(bound, Math.pow(Math.abs(o.a[q]), 1 / q)); rate = Math.max(rate, 2 * bound); } });
    var sub = Math.max(1, Math.min(50, Math.ceil(rate * stop / N / 1.0))), h = stop / N / sub;  // keep h*rate <= 1 so RK4 stays stable
    var mem = {}; var direct = function (b) { var o = info[b.id]; if (b.type === "integrator" || b.type === "delay" || b.type === "zoh") return false; if (b.type === "tf") return o.b[0] !== 0; return TYPES[b.type].ins > 0 || b.type === "scope"; };
    function outputs(t, x) {
      var y = {}, done = 0, guard = 0;
      while (done < B.length && guard++ < B.length + 2) {
        B.forEach(function (b) {
          if (y[b.id] !== undefined) return;
          var o = info[b.id], ins = src[b.id], u = [];
          if (direct(b)) { for (var k = 0; k < ins.length; k++) { if (y[ins[k]] === undefined) return; u.push(y[ins[k]]); } }
          var p = b.p, v = 0;
          switch (b.type) {
            case "step": v = t >= +p.time ? +p.after : +p.before; break;
            case "constant": v = +p.value; break;
            case "sine": v = +p.amp * Math.sin(+p.freq * t + +p.phase) + +p.bias; break;
            case "pulse": v = ((t % +p.period) / +p.period * 100) < +p.width ? +p.amp : 0; break;
            case "clock": v = t; break;
            case "gain": v = +p.k * u[0]; break;
            case "sum": var sg = String(p.signs).replace(/[^+-]/g, ""); v = 0; for (var q = 0; q < u.length; q++) v += (sg[q] === "-" ? -1 : 1) * u[q]; break;
            case "product": v = u[0] * u[1]; break;
            case "integrator": v = x[o.at]; break;
            case "pid": v = +p.P * u[0] + +p.I * x[o.at] + +p.D * +p.N * (u[0] - x[o.at + 1]); break;
            case "tf": var s = o.b[0] * (u.length ? u[0] : 0); for (var j = 1; j <= o.n; j++) s += (o.b[o.n - j + 1] - o.a[o.n - j + 1] * o.b[0]) * x[o.at + j - 1]; v = s; break;
            case "fcn": v = fcnOf(p.expr)(u); break;
            case "sat": v = Math.min(+p.hi, Math.max(+p.lo, u[0])); break;
            case "switch": v = u[1] >= +p.threshold ? u[0] : u[2]; break;
            case "relay": if (mem[b.id] === undefined) mem[b.id] = 0; if (u[0] >= +p.on) mem[b.id] = 1; else if (u[0] <= +p.off) mem[b.id] = 0; v = mem[b.id] ? +p.outOn : +p.outOff; break;
            case "pwm": v = ((t * +p.freq) % 1) < Math.min(1, Math.max(0, u[0])) ? 1 : 0; break;
            case "delay": case "zoh": v = mem[b.id] === undefined ? (+p.ic || 0) : mem[b.id].out; break;
            case "scope": v = 0; break;
          }
          y[b.id] = v; done++;
        });
      }
      if (done < B.length) throw new Error("Algebraic loop: a feedback path has no Integrator or Transfer Fcn in it, so its value cannot be worked out. Add an Integrator (or remove the loop).");
      return y;
    }
    function deriv(t, x) {
      var y = outputs(t, x), dx = new Array(NX).fill(0);
      B.forEach(function (b) {
        var o = info[b.id]; if (!o.n) return; var u = src[b.id].length ? y[src[b.id][0]] : 0;
        if (b.type === "integrator") { var lo = parseFloat(String(b.p.lo).replace("inf", "Infinity")), hi = parseFloat(String(b.p.hi).replace("inf", "Infinity")); dx[o.at] = (x[o.at] >= hi && u > 0) || (x[o.at] <= lo && u < 0) ? 0 : u; }
        else if (b.type === "pid") { dx[o.at] = u; dx[o.at + 1] = +b.p.N * (u - x[o.at + 1]); }
        else { for (var j = 0; j < o.n - 1; j++) dx[o.at + j] = x[o.at + j + 1]; var s = u; for (j = 0; j < o.n; j++) s -= o.a[o.n - j] * x[o.at + j]; dx[o.at + o.n - 1] = s; }
      });
      return { dx: dx, y: y };
    }
    var x = new Array(NX).fill(0); B.forEach(function (b) { if (b.type === "integrator") x[info[b.id].at] = +b.p.ic || 0; });
    var T = [], S = {}; B.forEach(function (b) { if (b.type === "scope") S[b.id] = src[b.id].map(function () { return []; }); });
    function record(t, y) { T.push(t); B.forEach(function (b) { if (b.type === "scope") src[b.id].forEach(function (s, k) { S[b.id][k].push(y[s]); }); }); }
    var all = {}; B.forEach(function (b) { all[b.id] = []; });
    for (i = 0; i <= N * sub; i++) {
      var t = i * h, k1 = deriv(t, x);
      B.forEach(function (b) { if (b.type !== "delay" && b.type !== "zoh") return; var Ts = Math.max(1e-6, +b.p.Ts || 0.1), kk = Math.floor(t / Ts + 1e-9), m = mem[b.id] || (mem[b.id] = { k: -1, out: +b.p.ic || 0, next: +b.p.ic || 0 }); if (kk > m.k) { var uin = k1.y[src[b.id][0]]; if (b.type === "zoh") { m.out = uin; } else { m.out = m.next; m.next = uin; } m.k = kk; } });
      if (i % sub === 0) { record(t, k1.y); B.forEach(function (b) { all[b.id].push(k1.y[b.id]); }); }
      if (i === N * sub) break;
      var add = function (a, d, c) { return a.map(function (v, q) { return v + c * d[q]; }); };
      var k2 = deriv(t + h / 2, add(x, k1.dx, h / 2)).dx, k3 = deriv(t + h / 2, add(x, k2, h / 2)).dx, k4 = deriv(t + h, add(x, k3, h)).dx;
      x = x.map(function (v, q) { return v + h / 6 * (k1.dx[q] + 2 * k2[q] + 2 * k3[q] + k4[q]); });
      if (x.some(function (v) { return !isFinite(v) || Math.abs(v) > 1e12; })) { break; }
    }
    return { t: T, scopes: S, all: all, src: src };
  }
  function scopeSVG(res, b, names, upto) {
    var MLab = window.MLab, f = { axes: [], cur: null }, a = MLab.plotHelpers.newAxes(1, 1, 1), cols = ["#e8b923", "#3dd6f0", "#ff6b9a", "#7ee08a"], n = upto === undefined ? res.t.length : upto;
    a.grid = true; a.title = b.name || "Scope"; a.xlabel = "time (s)"; a.xlim = [0, res.t[res.t.length - 1] || 1];
    var lo = Infinity, hi = -Infinity; res.scopes[b.id].forEach(function (y) { y.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
    if (isFinite(lo)) { var pad = (hi - lo) * 0.1 || 0.5; a.ylim = [lo - pad, hi + pad]; }
    res.scopes[b.id].forEach(function (y, k) { a.series.push({ type: "line", x: res.t.slice(0, n), y: y.slice(0, n), color: cols[k % 4], ls: "-", lw: 1.7, marker: null, ms: 6, name: names[k] || "input " + (k + 1) }); });
    if (res.scopes[b.id].length > 1) a.legend = names;
    f.axes.push(a);
    return MLab.plotSVG(f, { width: 560, height: 300 }).replace('class="mlp"', 'class="mlp mla-scope"');
  }
  function sandbox(host, preset, readonly) {
    var P = PRESETS[preset] || PRESETS.rc, model = { stop: P.stop, blocks: [], lines: [] }, nid = 1, sel = null, wire = null, lastRes = null;
    P.blocks.forEach(function (d) { var T = TYPES[d[1]], p = {}; for (var k in T.p) p[k] = T.p[k]; for (k in d[4]) p[k] = d[4][k]; model.blocks.push({ id: d[0], type: d[1], x: d[2], y: d[3], p: p, name: P.names[d[0]] || "" }); });
    P.lines.forEach(function (l) { model.lines.push({ from: l[0], to: l[1], port: l[2] }); });
    var root = el("div", "mla-sb" + (readonly ? " mla-sb--ro" : ""));
    root.innerHTML = '<div class="mla-code__head"><span class="mla-code__title">' + esc(readonly ? P.title : "Block diagram practice sandbox") + ' <em>' + (readonly ? "watch the signals flow" : "a teaching model of Simulink, not Simulink itself") + "</em></span></div>" +
      (readonly ? "" : '<div class="mla-sb__tools"><label>Start from <select data-sb-preset>' + Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '"' + (k === preset ? " selected" : "") + ">" + esc(PRESETS[k].title) + "</option>"; }).join("") + '</select></label><div class="mla-sb__pal" role="toolbar" aria-label="Add a block">' + Object.keys(TYPES).map(function (k) { return '<button type="button" class="mla-chip mla-btn" data-sb-add="' + k + '" title="Library: ' + esc(TYPES[k].lib) + '">' + esc(TYPES[k].label.replace(" (expression)", "")) + "</button>"; }).join("") + "</div></div>") +
      '<div class="mla-sb__canvas"><svg class="mla-sb__svg" viewBox="0 0 640 300" role="application" aria-label="Block diagram"></svg></div>' +
      '<div class="mla-code__bar"><button type="button" class="mla-btn mla-btn--go" data-sb-run>▶ Run</button><label class="mla-sb__stop">Stop time <input type="number" min="0.1" step="any" value="' + model.stop + '" data-sb-stop></label>' + (readonly ? "" : '<button type="button" class="mla-btn mla-btn--ghost" data-sb-del disabled>Delete selected</button>') + '<span class="mla-sb__hint"></span></div>' +
      '<div class="mla-sb__props" hidden></div><div class="mla-sb__out" aria-live="polite"></div>';
    var svg = root.querySelector("svg"), out = root.querySelector(".mla-sb__out"), props = root.querySelector(".mla-sb__props"), hint = root.querySelector(".mla-sb__hint"), delBtn = root.querySelector("[data-sb-del]");
    hint.textContent = readonly ? "" : "Drag blocks to move. Click an output ▸ then an input ▸ to draw a line. Click a block to set its parameters.";
    var BW = 74, BH = 46;
    function byId(id) { return model.blocks.filter(function (b) { return b.id === id; })[0]; }
    function inPos(b, k) { var n = nIns(b); return [b.x, b.y + BH * (k + 1) / (n + 1)]; }
    function outPos(b) { return [b.x + BW, b.y + BH / 2]; }
    function draw(flowT) {
      svg.innerHTML = ""; var defs = sv("defs", {}, svg), mk = sv("marker", { id: "sbArrow" + uid, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs); sv("path", { d: "M0 0L10 5L0 10z", class: "mla-sb__arrowhead" }, mk);
      var maxY = 300, maxX = 640; model.blocks.forEach(function (b) { maxY = Math.max(maxY, b.y + BH + 40); maxX = Math.max(maxX, b.x + BW + 30); }); svg.setAttribute("viewBox", "0 0 " + maxX + " " + maxY);
      model.lines.forEach(function (l, li) {
        var a = byId(l.from), b = byId(l.to); if (!a || !b) return; var p = outPos(a), q = inPos(b, l.port), d;
        if (q[0] > p[0] + 10) { var mx = (p[0] + q[0]) / 2; d = "M" + p[0] + " " + p[1] + "H" + mx + "V" + q[1] + "H" + q[0]; }
        else { var yy = Math.max(a.y, b.y) + BH + 22 + (li % 3) * 8; d = "M" + p[0] + " " + p[1] + "H" + (p[0] + 14) + "V" + yy + "H" + (q[0] - 16) + "V" + q[1] + "H" + q[0]; }
        var path = sv("path", { d: d, class: "mla-sb__line", "marker-end": "url(#sbArrow" + uid + ")" }, svg);
        if (flowT !== undefined && lastRes) { var len = path.getTotalLength ? path.getTotalLength() : 0; if (len) { for (var dd = 0; dd < 3; dd++) { var pt = path.getPointAtLength(((flowT * 90 + dd * len / 3) % len)); sv("circle", { cx: pt.x, cy: pt.y, r: 3.4, class: "mla-sb__dot" }, svg); } } }
        if (!readonly) path.addEventListener("click", function () { if (confirm("Delete this line?")) { model.lines.splice(li, 1); draw(); } });
      });
      model.blocks.forEach(function (b) {
        var T = TYPES[b.type], g = sv("g", { class: "mla-sb__blk" + (sel === b ? " is-sel" : ""), transform: "translate(" + b.x + " " + b.y + ")", tabindex: readonly ? -1 : 0, role: "button", "aria-label": T.label + (b.name ? " " + b.name : "") }, svg);
        if (T.shape === "tri") sv("path", { d: "M0 0L" + BW + " " + BH / 2 + "L0 " + BH + "Z", class: "mla-sb__body" }, g);
        else if (T.shape === "circ") sv("ellipse", { cx: BW / 2, cy: BH / 2, rx: BH / 2 + 2, ry: BH / 2, class: "mla-sb__body" }, g);
        else sv("rect", { width: BW, height: BH, rx: 5, class: "mla-sb__body" }, g);
        var txt = T.txt(b.p); if (b.type === "tf") { sv("text", { x: BW / 2, y: 18, "text-anchor": "middle", class: "mla-sb__tt" }, g).textContent = vecParse(b.p.num).join(" "); sv("line", { x1: 10, y1: 23, x2: BW - 10, y2: 23, class: "mla-sb__bar" }, g); sv("text", { x: BW / 2, y: 37, "text-anchor": "middle", class: "mla-sb__tt" }, g).textContent = vecParse(b.p.den).join(" "); }
        else sv("text", { x: T.shape === "tri" ? BW / 3 : BW / 2, y: BH / 2 + 5, "text-anchor": "middle", class: "mla-sb__t" }, g).textContent = txt.length > 9 ? txt.slice(0, 8) + "…" : txt;
        if (b.type === "sum") String(b.p.signs).replace(/[^+-]/g, "").split("").forEach(function (sg, k) { var ip = inPos(b, k); sv("text", { x: 7, y: ip[1] - b.y + 4, class: "mla-sb__sign" }, g).textContent = sg; });
        sv("text", { x: BW / 2, y: BH + 14, "text-anchor": "middle", class: "mla-sb__name" }, g).textContent = b.name || T.label.replace(" (expression)", "");
        for (var k = 0; k < nIns(b); k++) { var ip2 = inPos(b, k), hp = sv("path", { d: "M" + (ip2[0] - b.x - 7) + " " + (ip2[1] - b.y - 5) + "l7 5l-7 5z", class: "mla-sb__port mla-sb__port--in" + (wire ? " is-target" : "") }, g); hp.setAttribute("data-in", k); }
        if (nOuts(b)) { var op = sv("path", { d: "M" + BW + " " + (BH / 2 - 5) + "l7 5l-7 5z", class: "mla-sb__port mla-sb__port--out" + (wire && wire.from === b.id ? " is-active" : "") }, g); op.setAttribute("data-out", "1"); }
        if (readonly) return;
        g.addEventListener("pointerdown", function (e) {
          var port = e.target.getAttribute && (e.target.getAttribute("data-out") ? "out" : e.target.getAttribute("data-in") !== null ? "in" : null);
          if (port === "out") { wire = { from: b.id }; hint.textContent = "Now click an input port ▸ on another block (Esc to cancel)."; draw(); return; }
          if (port === "in") { if (wire) { var k2 = +e.target.getAttribute("data-in"); model.lines = model.lines.filter(function (l) { return !(l.to === b.id && l.port === k2); }); if (wire.from !== b.id) model.lines.push({ from: wire.from, to: b.id, port: k2 }); wire = null; hint.textContent = "Line drawn. Press Run."; draw(); } return; }
          select(b); var pt = toSvg(e), dx = pt[0] - b.x, dy = pt[1] - b.y, moved = false;
          function mv(ev) { var p2 = toSvg(ev); b.x = Math.max(4, Math.round((p2[0] - dx) / 2) * 2); b.y = Math.max(4, Math.round((p2[1] - dy) / 2) * 2); moved = true; draw(); }
          function up() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }
          window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); e.preventDefault(); void moved;
        });
        g.addEventListener("keydown", function (e) { var step = e.shiftKey ? 20 : 4; if (e.key === "Enter" || e.key === " ") { select(b); e.preventDefault(); } else if (e.key === "ArrowLeft") { b.x = Math.max(4, b.x - step); draw(); } else if (e.key === "ArrowRight") { b.x += step; draw(); } else if (e.key === "ArrowUp") { b.y = Math.max(4, b.y - step); draw(); } else if (e.key === "ArrowDown") { b.y += step; draw(); } else if (e.key === "Delete" || e.key === "Backspace") { remove(b); } if (e.key.indexOf("Arrow") === 0) { e.preventDefault(); var again = svg.querySelector('[aria-label="' + g.getAttribute("aria-label") + '"]'); if (again) again.focus(); } });
      });
    }
    var uid = Math.random().toString(36).slice(2, 7);
    function toSvg(e) { var r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return [(e.clientX - r.left) / r.width * vb.width, (e.clientY - r.top) / r.height * vb.height]; }
    function remove(b) { model.blocks = model.blocks.filter(function (x) { return x !== b; }); model.lines = model.lines.filter(function (l) { return l.from !== b.id && l.to !== b.id; }); sel = null; props.hidden = true; if (delBtn) delBtn.disabled = true; draw(); }
    function select(b) {
      sel = b; if (delBtn) delBtn.disabled = !b; draw(); if (!b) { props.hidden = true; return; }
      var T = TYPES[b.type]; props.hidden = false;
      props.innerHTML = "<h4>" + esc(T.label) + ' <small>Library Browser: ' + esc(T.lib) + "</small></h4>" + '<label>Label <input data-k="__name" value="' + esc(b.name || "") + '"></label>' + Object.keys(T.p).map(function (k) { return "<label>" + esc(PNAMES[k] || k) + ' <input data-k="' + k + '" value="' + esc(b.p[k]) + '"></label>'; }).join("");
      props.oninput = function (e) { var k = e.target.getAttribute("data-k"); if (!k) return; if (k === "__name") b.name = e.target.value; else b.p[k] = e.target.value; model.lines = model.lines.filter(function (l) { var t = byId(l.to); return !t || l.port < nIns(t); }); draw(); };
    }
    function run(animate) {
      model.stop = +root.querySelector("[data-sb-stop]").value || model.stop;
      try { lastRes = simulate(model); } catch (e) { out.innerHTML = '<div class="mla-out__err"><strong>Cannot simulate</strong><pre></pre></div>'; out.querySelector("pre").textContent = e.message; return; }
      var scopes = model.blocks.filter(function (b) { return b.type === "scope"; });
      if (!scopes.length) { out.innerHTML = '<p class="mla-out__none">Simulated, but there is no Scope to show the result. Add a Scope block and connect a signal to it.</p>'; return; }
      function namesFor(sc) { return lastRes.src[sc.id].map(function (s) { var b = byId(s); return b.name || TYPES[b.type].label; }); }
      if (!animate || REDUCE) { out.innerHTML = scopes.map(function (sc) { return '<figure class="mla-out__fig">' + scopeSVG(lastRes, sc, namesFor(sc)) + "</figure>"; }).join(""); draw(); return; }
      var n = lastRes.t.length, k = 0, t0 = performance.now();
      (function tick(now) { k = Math.min(n, Math.round((now - t0) / 2400 * n)); out.innerHTML = scopes.map(function (sc) { return '<figure class="mla-out__fig">' + scopeSVG(lastRes, sc, namesFor(sc), Math.max(2, k)) + "</figure>"; }).join(""); draw((now - t0) / 1000); if (k < n && root.isConnected) requestAnimationFrame(tick); else draw(); })(t0);
    }
    root.querySelector("[data-sb-run]").addEventListener("click", function () { run(true); });
    if (!readonly) {
      root.querySelector("[data-sb-preset]").addEventListener("change", function (e) { var r = el("div"); root.replaceWith(r); sandbox(r, e.target.value, false); r.replaceWith(r.firstChild); });
      root.querySelector(".mla-sb__pal").addEventListener("click", function (e) { var b = e.target.closest("[data-sb-add]"); if (!b) return; var type = b.getAttribute("data-sb-add"), T = TYPES[type], p = {}; for (var k in T.p) p[k] = T.p[k]; var nb = { id: "b" + (nid++) + "_" + type, type: type, x: 20 + (model.blocks.length * 37) % 480, y: 200 + (model.blocks.length % 3) * 30, p: p, name: "" }; model.blocks.push(nb); select(nb); });
      delBtn.addEventListener("click", function () { if (sel) remove(sel); });
      root.addEventListener("keydown", function (e) { if (e.key === "Escape" && wire) { wire = null; hint.textContent = "Line cancelled."; draw(); } });
    }
    host.appendChild(root); draw(); if (readonly) run(false);
  }
  /* ================= second-round explainers ================= */
  function axes(svg, L, T, W, H) { sv("rect", { x: L, y: T, width: W, height: H, class: "mla-fx__axes" }, svg); }
  function pathOf(f, a, b, X, Y, n) { var d = ""; for (var i = 0; i <= (n || 200); i++) { var x = a + (b - a) * i / (n || 200); d += (i ? "L" : "M") + X(x).toFixed(1) + " " + Y(f(x)).toFixed(1); } return d; }
  function slider(label, min, max, val, step) { var l = el("label", "mla-fx__range", esc(label) + ' <input type="range" min="' + min + '" max="' + max + '" value="' + val + '" step="' + (step || 1) + '"> <b></b>'); return l; }

  /* logical indexing: mask then pick */
  function mask(host) {
    var f = frame("Logical indexing: x(x > 4)", "test every element, keep the true ones"), x = [3, 8, 1, 9, 4, 7], svg = sv("svg", { viewBox: "0 0 560 200", class: "mla-fx__svg", role: "img", "aria-label": "Vector x, its mask and the result" });
    f.stage.appendChild(svg);
    stepper(f, function () { return x.length + 2; }, function (k) {
      svg.innerHTML = ""; var kept = [];
      [["x", 30], ["x > 4", 90], ["x(x > 4)", 150]].forEach(function (r) { sv("text", { x: 10, y: r[1] + 22, class: "mla-fx__t" }, svg).textContent = r[0]; });
      x.forEach(function (v, i) {
        var X0 = 130 + i * 62, tested = i < k, hot = i === k - 1, ok = v > 4;
        var g = sv("g", { class: hot ? "is-hot" : "" }, svg); sv("rect", { x: X0, y: 30, width: 50, height: 36, rx: 6, class: "mla-fx__cell" }, g); sv("text", { x: X0 + 25, y: 54, "text-anchor": "middle", class: "mla-fx__v" }, g).textContent = v;
        if (tested) { var g2 = sv("g", { class: ok ? "is-on" : "" }, svg); sv("rect", { x: X0, y: 90, width: 50, height: 36, rx: 6, class: "mla-fx__cell" }, g2); sv("text", { x: X0 + 25, y: 114, "text-anchor": "middle", class: "mla-fx__v" }, g2).textContent = ok ? 1 : 0; if (ok) kept.push(v); }
      });
      kept.forEach(function (v, i) { var X0 = 130 + i * 62, g = sv("g", { class: "is-on" }, svg); sv("rect", { x: X0, y: 150, width: 50, height: 36, rx: 6, class: "mla-fx__cell" }, g); sv("text", { x: X0 + 25, y: 174, "text-anchor": "middle", class: "mla-fx__v" }, g).textContent = v; });
      f.cap.textContent = k === 0 ? "x > 4 compares every element with 4 and gives a logical vector (the mask)." : k <= x.length ? "Element " + k + ": " + x[k - 1] + " > 4 is " + (x[k - 1] > 4 ? "true (1): keep it." : "false (0): drop it.") : "x(mask) returns only the elements where the mask is 1: [" + kept.join(" ") + "]. sum(x > 4) counts them: " + kept.length + ".";
    });
    host.appendChild(f.root);
  }
  /* implicit expansion */
  function broadcast(host) {
    var f = frame("Implicit expansion: column + row", "each is stretched to a full matrix"), r = [10, 20, 30], c = [1, 2], svg = sv("svg", { viewBox: "0 0 560 190", class: "mla-fx__svg", role: "img", "aria-label": "Column [1;2] plus row [10 20 30]" });
    f.stage.appendChild(svg);
    function cellAt(x, y, v, cls) { var g = sv("g", { class: cls || "" }, svg); sv("rect", { x: x, y: y, width: 44, height: 36, rx: 6, class: "mla-fx__cell" }, g); sv("text", { x: x + 22, y: y + 24, "text-anchor": "middle", class: "mla-fx__v" }, g).textContent = v; }
    stepper(f, function () { return 4; }, function (k) {
      svg.innerHTML = ""; var i, j;
      sv("text", { x: 14, y: 20, class: "mla-fx__t" }, svg).textContent = "c = [1; 2]"; sv("text", { x: 150, y: 20, class: "mla-fx__t" }, svg).textContent = "r = [10 20 30]"; sv("text", { x: 372, y: 20, class: "mla-fx__t" }, svg).textContent = "c + r";
      for (i = 0; i < 2; i++) for (j = 0; j < (k >= 1 ? 3 : 1); j++) cellAt(14 + j * 40 * (k >= 1 ? 1 : 0), 40 + i * 44, c[i], j > 0 ? "is-on" : "");
      for (i = 0; i < (k >= 2 ? 2 : 1); i++) for (j = 0; j < 3; j++) cellAt(150 + j * 50, 40 + i * 44, r[j], i > 0 ? "is-on" : "");
      if (k >= 3) for (i = 0; i < 2; i++) for (j = 0; j < 3; j++) cellAt(372 + j * 50, 40 + i * 44, c[i] + r[j], "is-hot");
      f.cap.textContent = ["A 2-by-1 column and a 1-by-3 row have different sizes, but each dimension is either equal or 1, so MATLAB can expand them.", "The column is copied across to make 3 columns.", "The row is copied down to make 2 rows.", "Now both are 2-by-3 and are added element by element. No loop and no repmat needed."][k];
    });
    host.appendChild(f.root);
  }
  /* Newton-Raphson */
  function newton(host) {
    var f = frame("Newton–Raphson on f(x) = x² − 2", "follow the tangent to the axis"), fn = function (x) { return x * x - 2; }, df = function (x) { return 2 * x; }, xs = [3], i;
    for (i = 0; i < 5; i++) xs.push(xs[i] - fn(xs[i]) / df(xs[i]));
    var svg = sv("svg", { viewBox: "0 0 560 260", class: "mla-fx__svg", role: "img", "aria-label": "Tangent lines converging on the root" }), L = 40, T = 14, W = 500, H = 210, X = function (v) { return L + (v - 0.5) / 3 * W; }, Y = function (v) { return T + (1 - (v + 2.5) / 10.5) * H; };
    f.stage.appendChild(svg);
    stepper(f, function () { return xs.length; }, function (k) {
      svg.innerHTML = ""; axes(svg, L, T, W, H); sv("line", { x1: L, y1: Y(0), x2: L + W, y2: Y(0), class: "mla-fx__zero" }, svg); sv("path", { d: pathOf(fn, 0.5, 3.5, X, Y), class: "mla-fx__line" }, svg);
      for (var q = 0; q <= k; q++) { sv("circle", { cx: X(xs[q]), cy: Y(fn(xs[q])), r: 4.5, class: q === k ? "mla-fx__pt is-hot" : "mla-fx__pt" }, svg); if (q < k) { sv("line", { x1: X(xs[q]), y1: Y(fn(xs[q])), x2: X(xs[q + 1]), y2: Y(0), class: "mla-fx__slope" }, svg); sv("line", { x1: X(xs[q + 1]), y1: Y(0), x2: X(xs[q + 1]), y2: Y(fn(xs[q + 1])), class: "mla-fx__zero" }, svg); } }
      sv("text", { x: L + 8, y: T + 16, class: "mla-fx__li" }, svg).textContent = "x(k+1) = x(k) − f(x(k)) / f'(x(k))";
      f.cap.textContent = k === 0 ? "Start with a guess x = 3. f(3) = 7, far from zero." : "Iteration " + k + ": x = " + xs[k].toFixed(10) + ", error " + Math.abs(xs[k] - Math.SQRT2).toExponential(1) + (k >= 3 ? ". The number of correct digits roughly doubles every step (quadratic convergence)." : ".");
    }, { label: "Iteration", ms: 900 });
    host.appendChild(f.root);
  }
  /* trapezium rule strips */
  function strips(host) {
    var f = frame("Numerical integration: trapz", "add up the strips"), n = 4, fn = function (x) { return Math.sin(x); }, a = 0, b = Math.PI, ctl = el("div", "mla-fx__chips"), sl = slider("number of strips n", 1, 40, 4), svg = sv("svg", { viewBox: "0 0 560 240", class: "mla-fx__svg", role: "img", "aria-label": "Area under sin(x) from 0 to pi as trapezium strips" });
    ctl.appendChild(sl); f.stage.appendChild(ctl); f.stage.appendChild(svg);
    var L = 40, T = 14, W = 500, H = 190, X = function (v) { return L + v / Math.PI * W; }, Y = function (v) { return T + (1 - v / 1.1) * H; }, st;
    function draw(k) {
      svg.innerHTML = ""; axes(svg, L, T, W, H); var h = (b - a) / n, area = 0;
      for (var i = 0; i < Math.min(k, n); i++) { var x0 = a + i * h, x1 = x0 + h; area += h * (fn(x0) + fn(x1)) / 2; sv("path", { d: "M" + X(x0) + " " + Y(0) + "L" + X(x0) + " " + Y(fn(x0)) + "L" + X(x1) + " " + Y(fn(x1)) + "L" + X(x1) + " " + Y(0) + "Z", class: i === k - 1 ? "mla-fx__strip is-hot" : "mla-fx__strip" }, svg); }
      sv("path", { d: pathOf(fn, a, b, X, Y), class: "mla-fx__line" }, svg);
      sl.querySelector("b").textContent = n;
      f.cap.textContent = k === 0 ? "trapz joins neighbouring samples with straight lines and adds the areas of the trapeziums. Exact area = 2." : "After " + Math.min(k, n) + " of " + n + " strips: area ≈ " + area.toFixed(5) + (k >= n ? ". Error " + Math.abs(2 - area).toExponential(1) + ": doubling n cuts the error by about 4." : "");
    }
    st = stepper(f, function () { return n + 1; }, draw, { label: "Strip", ms: 300 });
    sl.querySelector("input").addEventListener("input", function (e) { n = +e.target.value; st.go(n); });
    host.appendChild(f.root);
  }
  /* convolution sliding */
  function convolve(host) {
    var f = frame("Convolution: y = conv(x, h)", "flip h, slide it, multiply and add"), x = [1, 2, 3, 2], h = [1, 1, 0.5], N = x.length + h.length - 1, svg = sv("svg", { viewBox: "0 0 560 230", class: "mla-fx__svg", role: "img", "aria-label": "h flipped and sliding across x" });
    f.stage.appendChild(svg);
    stepper(f, function () { return N + 1; }, function (k) {
      svg.innerHTML = ""; var x0 = 200, w = 46, n = k - 1, terms = [], y = [], i, m;
      for (m = 0; m < N; m++) { var s = 0; for (i = 0; i < x.length; i++) if (m - i >= 0 && m - i < h.length) s += x[i] * h[m - i]; y.push(s); }
      sv("text", { x: 10, y: 44, class: "mla-fx__t" }, svg).textContent = "x[k]"; sv("text", { x: 10, y: 98, class: "mla-fx__t" }, svg).textContent = "h[n − k]"; sv("text", { x: 10, y: 186, class: "mla-fx__t" }, svg).textContent = "y[n]";
      x.forEach(function (v, q) { var over = k > 0 && n - q >= 0 && n - q < h.length, g = sv("g", { class: over ? "is-on" : "" }, svg); sv("rect", { x: x0 + q * w, y: 20, width: w - 6, height: 36, rx: 6, class: "mla-fx__cell" }, g); sv("text", { x: x0 + q * w + 20, y: 44, "text-anchor": "middle", class: "mla-fx__v" }, g).textContent = v; if (over) terms.push(v + "×" + h[n - q]); });
      if (k > 0) h.forEach(function (v, j) { var pos = n - j, g = sv("g", { class: pos >= 0 && pos < x.length ? "is-on" : "" }, svg); sv("rect", { x: x0 + pos * w, y: 74, width: w - 6, height: 36, rx: 6, class: "mla-fx__cell" }, g); sv("text", { x: x0 + pos * w + 20, y: 98, "text-anchor": "middle", class: "mla-fx__v" }, g).textContent = v; });
      y.forEach(function (v, q) { var g = sv("g", { class: q === n ? "is-hot" : q < n ? "is-on" : "" }, svg); sv("rect", { x: 110 + q * 62, y: 162, width: 54, height: 36, rx: 6, class: "mla-fx__cell" }, g); sv("text", { x: 137 + q * 62, y: 186, "text-anchor": "middle", class: "mla-fx__v" }, g).textContent = q < k ? v : "?"; });
      f.cap.textContent = k === 0 ? "x = [1 2 3 2], h = [1 1 0.5]. The result has numel(x) + numel(h) − 1 = " + N + " elements." : "y[" + n + "] = " + terms.join(" + ") + " = " + y[n] + (k === N ? ". Done: y = [" + y.join(" ") + "]." : "");
    }, { label: "Output", ms: 900 });
    host.appendChild(f.root);
  }
  /* pole position <-> step response */
  function poles(host) {
    var f = frame("Pole position and step response", "drag ζ and ωn: both views move together"), z = 0.4, wn = 3, ctl = el("div", "mla-fx__chips"), s1 = slider("damping ratio ζ", 0, 150, 40), s2 = slider("natural frequency ωn (rad/s)", 5, 60, 30), svg = sv("svg", { viewBox: "0 0 560 250", class: "mla-fx__svg", role: "img", "aria-label": "s-plane on the left, step response on the right" });
    ctl.appendChild(s1); ctl.appendChild(s2); f.stage.appendChild(ctl); f.stage.appendChild(svg);
    function draw() {
      svg.innerHTML = ""; z = s1.querySelector("input").value / 100; wn = s2.querySelector("input").value / 10; s1.querySelector("b").textContent = z.toFixed(2); s2.querySelector("b").textContent = wn.toFixed(1);
      var cx = 170, cy = 125, sc = 20; axes(svg, 20, 15, 200, 220); sv("line", { x1: 20, y1: cy, x2: 220, y2: cy, class: "mla-fx__zero" }, svg); sv("line", { x1: cx, y1: 15, x2: cx, y2: 235, class: "mla-fx__zero" }, svg);
      sv("text", { x: 26, y: 30, class: "mla-fx__li" }, svg).textContent = "s-plane (× = poles)"; sv("rect", { x: cx, y: 15, width: 50, height: 220, class: "mla-fx__bad" }, svg);
      var re = -z * wn, im = z < 1 ? wn * Math.sqrt(1 - z * z) : 0, p = z < 1 ? [[re, im], [re, -im]] : [[-wn * (z - Math.sqrt(z * z - 1)), 0], [-wn * (z + Math.sqrt(z * z - 1)), 0]];
      p.forEach(function (q) { var px = cx + q[0] * sc, py = cy - q[1] * sc; if (px > 22) sv("path", { d: "M" + (px - 6) + " " + (py - 6) + "l12 12M" + (px - 6) + " " + (py + 6) + "l12 -12", class: "mla-fx__slope", "stroke-dasharray": "none" }, svg); });
      var L = 260, T = 15, W = 285, H = 220, tmax = 6, X = function (t) { return L + t / tmax * W; }, Y = function (y) { return T + (1 - y / 2) * H; }; axes(svg, L, T, W, H); sv("line", { x1: L, y1: Y(1), x2: L + W, y2: Y(1), class: "mla-fx__zero" }, svg);
      var y = function (t) { if (z < 1) { var wd = wn * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * wn * t) * (Math.cos(wd * t) + z * wn / wd * Math.sin(wd * t)); } if (Math.abs(z - 1) < 1e-6) return 1 - Math.exp(-wn * t) * (1 + wn * t); var a = -p[0][0], b = -p[1][0]; return 1 - (b * Math.exp(-a * t) - a * Math.exp(-b * t)) / (b - a); };
      sv("path", { d: pathOf(y, 0, tmax, X, Y, 300), class: "mla-fx__line" }, svg); sv("text", { x: L + 6, y: T + 15, class: "mla-fx__li" }, svg).textContent = "step response of ωn² / (s² + 2ζωn s + ωn²)";
      f.cap.textContent = z === 0 ? "ζ = 0: poles on the imaginary axis, the output oscillates for ever." : z < 1 ? "Underdamped: complex poles at " + re.toFixed(2) + " ± " + im.toFixed(2) + "j. Overshoot " + (100 * Math.exp(-z * Math.PI / Math.sqrt(1 - z * z))).toFixed(1) + " %. Poles further left decay faster; poles higher up oscillate faster." : "ζ ≥ 1: two real poles, no overshoot. The pole nearer the origin sets the speed.";
    }
    ctl.addEventListener("input", draw); draw(); host.appendChild(f.root);
  }
  /* sampling and aliasing */
  function alias(host) {
    var f = frame("Sampling and aliasing", "sample a 9 Hz sine at different rates"), fs = 40, f0 = 9, ctl = el("div", "mla-fx__chips"), sl = slider("sampling rate Fs (Hz)", 5, 60, 40), svg = sv("svg", { viewBox: "0 0 560 220", class: "mla-fx__svg", role: "img", "aria-label": "A sine wave, its samples and the wave the samples appear to make" });
    ctl.appendChild(sl); f.stage.appendChild(ctl); f.stage.appendChild(svg);
    function draw() {
      svg.innerHTML = ""; fs = +sl.querySelector("input").value; sl.querySelector("b").textContent = fs + " Hz"; var L = 30, T = 14, W = 510, H = 180, X = function (t) { return L + t * W; }, Y = function (v) { return T + (1 - (v + 1.2) / 2.4) * H; };
      axes(svg, L, T, W, H); sv("path", { d: pathOf(function (t) { return Math.sin(2 * Math.PI * f0 * t); }, 0, 1, X, Y, 600), class: "mla-fx__ghost" }, svg);
      var fa = Math.abs(f0 - Math.round(f0 / fs) * fs), sign = (f0 - Math.round(f0 / fs) * fs) < 0 ? -1 : 1;
      if (fs < 2 * f0) sv("path", { d: pathOf(function (t) { return sign * Math.sin(2 * Math.PI * fa * t); }, 0, 1, X, Y, 400), class: "mla-fx__slope" }, svg);
      for (var n = 0; n <= fs; n++) { var t = n / fs; sv("line", { x1: X(t), y1: Y(0), x2: X(t), y2: Y(Math.sin(2 * Math.PI * f0 * t)), class: "mla-fx__stem", "stroke-width": 1.5 }, svg); sv("circle", { cx: X(t), cy: Y(Math.sin(2 * Math.PI * f0 * t)), r: 3.2, class: "mla-fx__pt is-hot" }, svg); }
      f.cap.textContent = fs >= 2 * f0 ? "Fs = " + fs + " Hz is more than twice 9 Hz (the Nyquist rate is 18 Hz), so the samples describe the sine correctly." : "Fs = " + fs + " Hz is below 18 Hz. The samples now look like a " + fa.toFixed(0) + " Hz wave (dashed): that false frequency is the alias, |f − k·Fs|.";
    }
    ctl.addEventListener("input", draw); draw(); host.appendChild(f.root);
  }
  /* PID terms */
  function pidterms(host) {
    var f = frame("What P, I and D each do", "plant 1/(s² + 10s + 20), unit step reference"), ctl = el("div", "mla-fx__chips"), sp = slider("Kp", 0, 400, 100, 10), si = slider("Ki", 0, 400, 0, 10), sd = slider("Kd", 0, 60, 0, 2), svg = sv("svg", { viewBox: "0 0 560 240", class: "mla-fx__svg", role: "img", "aria-label": "Closed-loop step response" });
    [sp, si, sd].forEach(function (s) { ctl.appendChild(s); }); f.stage.appendChild(ctl); f.stage.appendChild(svg);
    function draw() {
      var Kp = +sp.querySelector("input").value, Ki = +si.querySelector("input").value, Kd = +sd.querySelector("input").value; sp.querySelector("b").textContent = Kp; si.querySelector("b").textContent = Ki; sd.querySelector("b").textContent = Kd;
      var x1 = 0, x2 = 0, e_i = 0, h = 0.0005, ys = [], peak = 0, t; // plant states; derivative acts on the measurement
      for (t = 0; t <= 2; t += h) { var e = 1 - x1; e_i += e * h; var u = Kp * e + Ki * e_i - Kd * x2, a = u - 10 * x2 - 20 * x1; x1 += x2 * h; x2 += a * h; if (Math.round(t / h) % 8 === 0) ys.push(x1); peak = Math.max(peak, x1); }
      svg.innerHTML = ""; var L = 40, T = 14, W = 500, H = 200, top = Math.max(1.4, peak * 1.1), X = function (i) { return L + i / (ys.length - 1) * W; }, Y = function (v) { return T + (1 - v / top) * H; };
      axes(svg, L, T, W, H); sv("line", { x1: L, y1: Y(1), x2: L + W, y2: Y(1), class: "mla-fx__zero" }, svg); sv("path", { d: ys.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(Math.max(-0.2, Math.min(top, v))).toFixed(1); }).join(""), class: "mla-fx__line" }, svg);
      sv("text", { x: L + W - 4, y: Y(1) - 5, "text-anchor": "end", class: "mla-fx__li" }, svg).textContent = "reference = 1"; sv("text", { x: L + W, y: T + H + 16, "text-anchor": "end", class: "mla-fx__li" }, svg).textContent = "2 s";
      var fin = ys[ys.length - 1];
      f.cap.textContent = "Final value " + fin.toFixed(3) + ", overshoot " + Math.max(0, (peak - Math.max(fin, 1e-9)) / Math.max(fin, 1e-9) * 100).toFixed(0) + " %. " + (Ki === 0 ? "With no integral action a steady-state error of 20/(20 + Kp) remains. " : "Integral action removes the steady-state error. ") + (Kd > 0 ? "Derivative action adds damping and cuts the overshoot." : "Raise Kd to damp the oscillation.");
    }
    ctl.addEventListener("input", draw); draw(); host.appendChild(f.root);
  }
  /* Bode construction from corner frequencies */
  function bodebuild(host) {
    var f = frame("Building a Bode magnitude plot", "G(s) = 100 / ((s + 1)(s + 10)): add one piece at a time"), svg = sv("svg", { viewBox: "0 0 560 250", class: "mla-fx__svg", role: "img", "aria-label": "Straight-line asymptotes and the exact curve" });
    f.stage.appendChild(svg); var L = 50, T = 14, W = 490, H = 200, X = function (w) { return L + (Math.log10(w) + 1) / 4 * W; }, Y = function (db) { return T + (1 - (db + 60) / 90) * H; };
    var parts = [function () { return 20; }, function (w) { return w < 1 ? 0 : -20 * Math.log10(w); }, function (w) { return w < 10 ? 0 : -20 * Math.log10(w / 10); }];
    stepper(f, function () { return 5; }, function (k) {
      svg.innerHTML = ""; axes(svg, L, T, W, H); [-40, -20, 0, 20].forEach(function (d) { sv("line", { x1: L, y1: Y(d), x2: L + W, y2: Y(d), class: "mla-fx__zero" }, svg); sv("text", { x: L - 6, y: Y(d) + 4, "text-anchor": "end", class: "mla-fx__li" }, svg).textContent = d + " dB"; });
      [0.1, 1, 10, 100, 1000].forEach(function (w) { sv("text", { x: X(w), y: T + H + 16, "text-anchor": "middle", class: "mla-fx__li" }, svg).textContent = w; });
      var asym = function (w) { var s = 0; for (var i = 0; i < Math.min(k, 3); i++) s += parts[i](w); return s; };
      if (k >= 1) sv("path", { d: pathOf(function (lw) { return asym(Math.pow(10, lw)); }, -1, 3, function (lw) { return X(Math.pow(10, lw)); }, Y, 400), class: "mla-fx__slope", "stroke-dasharray": "none" }, svg);
      if (k >= 4) sv("path", { d: pathOf(function (lw) { var w = Math.pow(10, lw); return 20 * Math.log10(100 / (Math.hypot(1, w) * Math.hypot(10, w))); }, -1, 3, function (lw) { return X(Math.pow(10, lw)); }, Y, 400), class: "mla-fx__line" }, svg);
      f.cap.textContent = ["Rewrite G(s) = 10 / ((1 + s)(1 + s/10)): a constant gain of 10 and two corner frequencies, 1 and 10 rad/s.", "The gain 10 is a flat line at 20·log10(10) = 20 dB.", "The pole at 1 rad/s bends the line down by 20 dB per decade after ω = 1.", "The pole at 10 rad/s adds another −20 dB/decade: the slope is −40 dB/decade after ω = 10.", "bode(G) draws the exact curve. It is 3 dB below the asymptotes at each corner."][k];
    }, { ms: 1300 });
    host.appendChild(f.root);
  }
  var MOUNT = { mask: mask, broadcast: broadcast, newton: newton, strips: strips, convolve: convolve, poles: poles, alias: alias, pidterms: pidterms, bodebuild: bodebuild, indexing: indexing, matmul: matmul, plotmap: plotmap, ode: ode, fft: fft,
    flow: function (host, arg) { sandbox(host, arg || "rc", true); },
    sandbox: function (host, arg) { sandbox(host, arg || "rc", false); } };
  window.MLAnim = { mount: function (name, host, arg) { var f = MOUNT[name]; if (!f) { host.textContent = "Unknown figure: " + name; return; } f(host, arg); }, simulate: simulate, PRESETS: PRESETS, TYPES: TYPES };
  function boot() { [].forEach.call(document.querySelectorAll("[data-mla-sandbox]"), function (h) { sandbox(h, h.getAttribute("data-mla-sandbox") || "rc", false); }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
