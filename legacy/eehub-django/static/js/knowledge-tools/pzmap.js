/* EE Hub — pole–zero designer (Round 7, R7E, course tool for EEEN 517, COEN 407, COEN 507).
   settings: {plane: "z"|"s", poles: [[re, im], ...], zeros: [[re, im], ...], response: "impulse"|"step", gain: 1}
   A point with im ≠ 0 stands for a conjugate pair. Drag points; tap the buttons to add or remove. */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el, F = KT.fmt, C = KT.C, Cx = KT.Cx;
  function expand(pts) { // real coefficients of Π(x − p) (pairs expanded)
    var c = [1];
    pts.forEach(function (p) { if (Math.abs(p[1]) > 1e-9) c = KT.tf.polymul(c, [1, -2 * p[0], p[0] * p[0] + p[1] * p[1]]); else c = KT.tf.polymul(c, [1, -p[0]]); });
    return c;
  }
  function impulse(b, a, N, step) { // a[0] = 1; difference equation
    var y = [], x = function (n) { return step ? (n >= 0 ? 1 : 0) : (n === 0 ? 1 : 0); };
    for (var n = 0; n < N; n++) { var s = 0, k; for (k = 0; k < b.length; k++) s += b[k] * x(n - k); for (k = 1; k < a.length; k++) if (n - k >= 0) s -= a[k] * y[n - k]; y.push(s); }
    return y;
  }
  KT.pz = { expand: expand, impulse: impulse };
  function build(mount, S) {
    var plane = S.plane || "z", poles = (S.poles || (plane === "z" ? [[0.6, 0.5]] : [[-1, 2]])).map(function (p) { return p.slice(); }), zeros = (S.zeros || (plane === "z" ? [[-1, 0]] : [])).map(function (p) { return p.slice(); });
    var resp = S.response || (plane === "z" ? "impulse" : "step"), gain = S.gain || 1;
    var wrap = el("div", "kt-pz");
    var bg = el("div", "btn-group");
    function btn(t, f) { var b = el("button", "kt-btn kt-btn--ghost", t); b.type = "button"; b.addEventListener("click", function () { f(); draw(); }); bg.appendChild(b); }
    btn("+ pole pair", function () { if (poles.length < 4) poles.push(plane === "z" ? [0.3, 0.4] : [-0.5, 1]); });
    btn("+ real pole", function () { if (poles.length < 4) poles.push(plane === "z" ? [0.5, 0] : [-2, 0]); });
    btn("+ zero", function () { if (zeros.length < 4) zeros.push(plane === "z" ? [-0.5, 0] : [-3, 0]); });
    btn("Remove last pole", function () { if (poles.length > 1) poles.pop(); });
    btn("Remove last zero", function () { zeros.pop(); });
    wrap.appendChild(el("p", "kt-note", "Drag a pole (×) or zero (○). A point off the real axis is a conjugate pair."));
    wrap.appendChild(bg);
    var grid = el("div", "kt-plots kt-plots--multi"); wrap.appendChild(grid);
    var c1 = el("div", "kt-plotcell"), c2 = el("div", "kt-plotcell"), c3 = el("div", "kt-plotcell");
    grid.appendChild(c1); grid.appendChild(c2); grid.appendChild(c3);
    var pm = new KT.Plot(c1, { title: plane === "z" ? "z-plane (unit circle = stability boundary)" : "s-plane", square: true, maxh: 380, aria: "Pole-zero plot; drag the markers" });
    var pf = new KT.Plot(c2, { title: "Magnitude response |H|" });
    var pt = new KT.Plot(c3, { title: resp === "step" ? "Step response" : "Impulse response h[n]" });
    var dl = el("dl", "kt-readouts"); wrap.appendChild(dl);
    mount.appendChild(wrap);
    var lim = plane === "z" ? 1.6 : Math.max(4, Math.max.apply(null, poles.concat(zeros).map(function (p) { return Math.max(Math.abs(p[0]), Math.abs(p[1])); })) * 1.4), frame = null, drag = null;
    function toWorld(px, py) { return [frame.xr[0] + (px - frame.L) / frame.pw * (frame.xr[1] - frame.xr[0]), frame.yr[0] + (frame.T + frame.ph - py) / frame.ph * (frame.yr[1] - frame.yr[0])]; }
    var cv = pm.canvas;
    cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", function (e) {
      if (!frame) return;
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = 22;
      drag = null;
      [["p", poles], ["z", zeros]].forEach(function (g) { g[1].forEach(function (p, i) { [1, -1].forEach(function (sg) { var d = Math.hypot(frame.X(p[0]) - x, frame.Y(sg * p[1]) - y); if (d < best) { best = d; drag = { list: g[1], i: i, sg: sg }; } }); }); });
      if (drag) { cv.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    cv.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var r = cv.getBoundingClientRect(), w = toWorld(e.clientX - r.left, e.clientY - r.top);
      var im = Math.abs(w[1]) < lim * 0.04 ? 0 : Math.abs(w[1]);
      drag.list[drag.i] = [Math.max(-lim, Math.min(lim, +w[0].toFixed(3))), Math.min(lim, +im.toFixed(3))];
      draw();
    });
    cv.addEventListener("pointerup", function () { drag = null; });
    cv.addEventListener("keydown", function () { });
    function draw() {
      var a = expand(poles), b = expand(zeros).map(function (v) { return v * gain; });
      var stable = poles.every(function (p) { return plane === "z" ? Math.hypot(p[0], p[1]) < 1 - 1e-9 : p[0] < -1e-9; });
      pm.set({ type: "custom", draw: function (x, w, h, c, P) {
        frame = P.frame({ x: { label: "Real", unit: "" }, y: { label: "Imaginary", unit: "" } }, c, [-lim, lim], [-lim, lim]);
        var f = frame;
        x.save(); x.beginPath(); x.rect(f.L, f.T, f.pw, f.ph); x.clip();
        if (plane === "z") { x.strokeStyle = c.ser[2]; x.lineWidth = 1.6; x.beginPath(); x.arc(f.X(0), f.Y(0), f.X(1) - f.X(0), 0, 2 * Math.PI); x.stroke(); }
        else { x.fillStyle = "rgba(220,38,38,.07)"; x.fillRect(f.X(0), f.T, f.L + f.pw - f.X(0), f.ph); }
        x.lineWidth = 2.6;
        poles.forEach(function (p) { [1, -1].forEach(function (sg) { if (sg < 0 && !p[1]) return; var px = f.X(p[0]), py = f.Y(sg * p[1]); x.strokeStyle = c.ser[3]; x.beginPath(); x.moveTo(px - 7, py - 7); x.lineTo(px + 7, py + 7); x.moveTo(px + 7, py - 7); x.lineTo(px - 7, py + 7); x.stroke(); }); });
        zeros.forEach(function (p) { [1, -1].forEach(function (sg) { if (sg < 0 && !p[1]) return; x.strokeStyle = c.ser[2]; x.beginPath(); x.arc(f.X(p[0]), f.Y(sg * p[1]), 7, 0, 2 * Math.PI); x.stroke(); }); });
        x.restore();
        P.readout.textContent = stable ? "Stable: every pole " + (plane === "z" ? "inside the unit circle." : "in the left half-plane.") : "Unstable: a pole " + (plane === "z" ? "on or outside the unit circle." : "on or right of the jω axis.");
      } });
      var W = [], M = [];
      if (plane === "z") {
        for (var i = 0; i <= 300; i++) { var om = Math.PI * i / 300, z = Cx.polar(1, om), H = Cx.div(KT.tf.polyval(b, z), KT.tf.polyval(a, z)); W.push(om / Math.PI); M.push(20 * Math.log10(Cx.abs(KT.isC(H) ? H : new C(H, 0)) + 1e-12)); }
        pf.set({ type: "xy", x: { label: "Normalised frequency ω/π", min: 0, max: 1 }, y: { label: "|H(e^jω)|", unit: "dB", robust: true }, series: [{ x: W, y: M, label: "|H|" }] });
        var y = impulse(b, a, 30, resp === "step"), n = y.map(function (_, k) { return k; });
        pt.set({ type: "xy", x: { label: "n", min: -0.5, max: 29.5 }, y: { label: resp === "step" ? "y[n]" : "h[n]", zero: true, robust: !stable }, series: [{ x: n, y: y, kind: "stem", label: resp === "step" ? "step response" : "h[n]", color: stable ? 0 : 3 }] });
      } else {
        for (i = 0; i <= 300; i++) { var wv = Math.pow(10, -2 + 5 * i / 300), H2 = KT.tf.evalAt(b, a, new C(0, wv)); W.push(wv); M.push(20 * Math.log10(Cx.abs(KT.isC(H2) ? H2 : new C(H2, 0)) + 1e-12)); }
        pf.set({ type: "xy", x: { label: "ω", unit: "rad/s", log: true, min: 0.01, max: 1000 }, y: { label: "|H(jω)|", unit: "dB", robust: true }, series: [{ x: W, y: M, label: "|H|" }] });
        if (b.length <= a.length) {
          var slow = Math.min.apply(null, poles.map(function (p) { return Math.abs(p[0]) || 0.2; })), st = KT.tf.step(b, a, stable ? Math.min(60, 8 / slow) : 10, 400);
          pt.set({ type: "xy", x: { label: "t", unit: "s", min: 0 }, y: { label: "y(t)", robust: !stable }, series: [{ x: st.t, y: st.y, label: "step response", color: stable ? 0 : 3 }] });
        }
      }
      dl.innerHTML = "";
      var v = plane === "z" ? "z" : "s";
      function poly(c) { return c.map(function (q, k) { var p = c.length - 1 - k; if (Math.abs(q) < 1e-12) return ""; return (q < 0 ? " − " : k ? " + " : "") + (p && Math.abs(Math.abs(q) - 1) < 1e-12 ? "" : F.sig(Math.abs(q), 4)) + (p ? v + (p > 1 ? "^" + p : "") : ""); }).join(""); }
      [["H(" + v + ") numerator", poly(b)], ["H(" + v + ") denominator", poly(a)], ["Poles", poles.map(function (p) { return p[1] ? F.sig(p[0], 3) + " ± j" + F.sig(p[1], 3) : F.sig(p[0], 3); }).join(",  ") + (plane === "z" ? "   (|p| = " + poles.map(function (p) { return F.sig(Math.hypot(p[0], p[1]), 3); }).join(", ") + ")" : "")], ["Stability", stable ? "stable" : "unstable"]].forEach(function (q) {
        var c = el("div", "kt-readout"); c.appendChild(el("dt", null, q[0])); c.appendChild(el("dd", null, q[1])); dl.appendChild(c);
      });
      if (plane === "z") { var c4 = el("div", "kt-readout"); c4.appendChild(el("dt", null, "Difference equation")); c4.appendChild(el("dd", null, "y[n] = " + b.map(function (q, k) { return F.sig(q, 4) + "x[n−" + k + "]"; }).join(" + ").replace(/x\[n−0\]/, "x[n]") + a.slice(1).map(function (q, k) { return (q > 0 ? " − " : " + ") + F.sig(Math.abs(q), 4) + "y[n−" + (k + 1) + "]"; }).join(""))); dl.appendChild(c4); }
    }
    draw();
  }
  KT.define("pzmap", build);
})();
