/* course-fx: circuit theory — series RLC with moving charge, phasors and resonance curve (rlc),
   Butterworth / Chebyshev low-pass responses (filter). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;
  var Lh = 10e-3, Cf = 1e-6, F0 = 1 / (TAU * Math.sqrt(Lh * Cf));

  function zz(f, x1, y, x2, col, glow) { // horizontal resistor
    var pts = [[x1, y]], n = 7, w = (x2 - x1);
    pts.push([x1 + w * 0.15, y]);
    for (var i = 1; i < n; i++) pts.push([x1 + w * 0.15 + w * 0.7 * i / n, y + (i % 2 ? -7 : 7)]);
    pts.push([x1 + w * 0.85, y], [x2, y]);
    f.line(pts, col, 2, { glow: glow ? 10 : 0 });
  }
  function coil(f, x, y1, y2, col) {
    var n = 4, h = (y2 - y1) / n, ctx = f.ctx;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
    for (var i = 0; i < n; i++) ctx.arc(x, y1 + h * (i + 0.5), h / 2, -PI / 2, PI / 2); ctx.stroke(); ctx.restore();
  }

  FX.define("rlc", {
    aspect: 1.75, aspectSmall: 0.72,
    controls: [
      { key: "fr", label: "Frequency", min: 600, max: 3600, step: 10, value: 1300, unit: " Hz" },
      { key: "R", label: "Resistance R", min: 4, max: 60, step: 1, value: 10, unit: " Ω" }
    ],
    init: function (f) { f.state.ph = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var fr = hero ? F0 * (1 + 0.45 * sin(f.t * 0.35)) : (f.v.fr || 1300), R = hero ? 12 : (f.v.R || 10);
      var w = TAU * fr, XL = w * Lh, XC = 1 / (w * Cf), X = XL - XC, Z = Math.hypot(R, X), phi = Math.atan2(X, R);
      var Imax = 1 / R, I = 1 / Z, rel = I / Imax;
      s.ph += (f.dt || 0) * TAU * 0.55;
      var th = f.reduce && !f.playing ? 0.8 : s.ph;
      f.clear();
      var small = f.w / f.h < 1.2;
      // circuit (a rectangle loop)
      var cx0 = 22, cy0 = 22, cw = small ? f.w - 44 : f.w * 0.42, ch = small ? f.h * 0.34 : f.h * 0.5;
      var x1 = cx0, x2 = cx0 + cw, y1 = cy0 + 10, y2 = cy0 + ch;
      var wire = f.a(c.ink, 0.5);
      // source on the left
      f.seg(x1, y1, x1, (y1 + y2) / 2 - 16, wire, 2); f.seg(x1, (y1 + y2) / 2 + 16, x1, y2, wire, 2);
      f.circle(x1, (y1 + y2) / 2, 16, "rgba(0,0,0,.3)", c.b, 2);
      var sp = []; for (var k = 0; k <= 20; k++) sp.push([x1 - 9 + 18 * k / 20, (y1 + y2) / 2 - sin(k / 20 * TAU) * 6]); f.line(sp, c.b, 1.6);
      // R on the top, L on the right, C on the bottom
      f.seg(x1, y1, x1 + cw * 0.25, y1, wire, 2); zz(f, x1 + cw * 0.25, y1, x1 + cw * 0.65, f.a(c.ink, 0.85), false); f.seg(x1 + cw * 0.65, y1, x2, y1, wire, 2);
      f.seg(x2, y1, x2, y1 + ch * 0.22, wire, 2); coil(f, x2, y1 + ch * 0.22, y2 - ch * 0.22, c.c); f.seg(x2, y2 - ch * 0.22, x2, y2, wire, 2);
      var cmx = x1 + cw * 0.5;
      f.seg(x2, y2, cmx + 6, y2, wire, 2); f.seg(cmx - 6, y2, x1, y2, wire, 2);
      f.seg(cmx - 6, y2 - 14, cmx - 6, y2 + 14, "#ff9a3c", 2.6); f.seg(cmx + 6, y2 - 14, cmx + 6, y2 + 14, "#ff9a3c", 2.6);
      f.text("R", x1 + cw * 0.45, y1 - 16, { size: 11.5, weight: 700, align: "center" });
      f.text("L = 10 mH", x2 - 12, (y1 + y2) / 2, { size: 11, weight: 700, color: c.c, align: "right" });
      f.text("C = 1 µF", cmx, y2 + 24, { size: 11, weight: 700, color: "#ff9a3c", align: "center" });
      // charges: oscillating displacement along the loop
      var loop = [[x1, y2], [x1, y1], [x2, y1], [x2, y2], [x1, y2]];
      var disp = -cos(th - phi) * 0.06 * rel;
      for (var d = 0; d < 28; d++) {
        var p = FX.along(loop, d / 28 + disp + 0.001);
        f.circle(p[0], p[1], 2.6, c.a, null, 0, { glow: 8 + 10 * rel, glowColor: c.a });
      }
      f.hit({ x: x1 + cw * 0.25, y: y1 - 12, w: cw * 0.4, h: 24 }, "Resistor R", "V_R is in phase with the current.");
      f.hit({ x: x2 - 14, y: y1 + ch * 0.2, w: 28, h: ch * 0.6 }, "Inductor", "X_L = ωL = " + XL.toFixed(0) + " Ω; V_L leads the current by 90°.");
      f.hit({ x: cmx - 16, y: y2 - 16, w: 32, h: 32 }, "Capacitor", "X_C = 1/ωC = " + XC.toFixed(0) + " Ω; V_C lags the current by 90°.");
      // phasors
      var pr = small ? Math.min(f.w * 0.2, f.h * 0.13) : Math.min(f.h * 0.2, f.w * 0.12);
      var px = small ? f.w * 0.27 : cx0 + cw * 0.5, py = small ? y2 + 40 + pr * 1.4 : y2 + (f.h - y2) / 2 + 8;
      var scale = pr / Math.max(1, Math.max(XL, XC, R) * I * 1.0);
      var vr = R * I * scale, vl = XL * I * scale, vc = XC * I * scale;
      var base = th;
      var P = function (m, a) { return [px + cos(a) * m, py - sin(a) * m]; };
      var pI = P(pr * rel * 0.9, base - phi + 0), pR = P(vr, base - phi), pL = P(vl, base - phi + PI / 2), pC = P(vc, base - phi - PI / 2), pS = P(Math.hypot(vr, vl - vc), base);
      f.circle(px, py, pr * 1.05, null, f.a(c.ink, 0.12), 1, { dash: [3, 5] });
      f.arrow(px, py, pR[0], pR[1], f.a(c.ink, 0.9), 2, { head: 7 });
      f.arrow(px, py, pL[0], pL[1], c.c, 2, { head: 7 });
      f.arrow(px, py, pC[0], pC[1], "#ff9a3c", 2, { head: 7 });
      f.arrow(px, py, pS[0], pS[1], c.b, 3, { glow: 10, head: 9 });
      f.arrow(px, py, pI[0], pI[1], c.a, 2.4, { glow: 8, head: 8 });
      if (!small) f.text("phasors", px, py + pr * 1.05 + 14, { size: 10.5, align: "center", color: c.dim });
      // resonance curve
      var gx0 = small ? f.w * 0.52 : cx0 + cw + 34, gy0 = small ? y2 + 40 : 22, gw = small ? f.w * 0.48 - 16 : f.w - gx0 - 16, gh = small ? f.h - y2 - 60 : f.h - 70;
      if (gw > 60 && gh > 50) {
        var pl = f.plot(gx0, gy0, gw, gh, [500, 3700], [0, 1.1], { nx: 6, ny: 4, xl: "f (Hz)", yl: "|I| / I_max" });
        var Ifun = function (fq) { var ww = TAU * fq, xx = ww * Lh - 1 / (ww * Cf); return (1 / Math.hypot(R, xx)) / Imax; };
        f.curve(pl, Ifun, 500, 3700, 260, c.a, 2.4, { glow: 10 });
        f.seg(pl.X(F0), pl.y0, pl.X(F0), pl.y0 + pl.h, f.a(c.b, 0.5), 1, { dash: [3, 4] });
        f.text("f₀ = " + Math.round(F0) + " Hz", pl.X(F0) + 5, pl.y0 + pl.h - 12, { size: 10, color: c.b });
        f.seg(pl.X(500), pl.Y(Math.SQRT1_2), pl.X(3700), pl.Y(Math.SQRT1_2), f.a(c.ink, 0.25), 1, { dash: [2, 4] });
        f.circle(pl.X(fr), pl.Y(rel), 6, "#fff", null, 0, { glow: 14, glowColor: c.a });
        var Q = (1 / R) * Math.sqrt(Lh / Cf);
        f.text("Q = " + Q.toFixed(1) + "  ·  φ = " + (phi * 180 / PI).toFixed(0) + "°" + (Math.abs(phi) < 0.05 ? " (resonance)" : phi > 0 ? " (inductive)" : " (capacitive)"), pl.x0 + pl.w - 46, pl.y0 + 14, { size: small ? 10 : 11.5, mono: true, align: "right" });
      }
    }
  });

  /* ================================================================ filter */
  function cheb(n, x) { return x <= 1 ? cos(n * Math.acos(x)) : Math.cosh(n * Math.log(x + Math.sqrt(x * x - 1))); }
  FX.define("filter", {
    aspect: 1.9, aspectSmall: 0.9,
    controls: [{ key: "n", label: "Order n", min: 1, max: 8, step: 1, value: 4 }],
    draw: function (f) {
      var c = f.c, n = f.mode === "hero" ? 2 + Math.round(3 + 3 * sin(f.t * 0.4)) : (f.v.n || 4), eps = Math.sqrt(Math.pow(10, 0.1) - 1);
      f.clear();
      var pl = f.plot(40, 16, f.w - 56, f.h - 46, [-1, 1], [-60, 5], { nx: 8, ny: 6, xl: "log₁₀(ω/ω_c)", yl: "|H| (dB)" });
      var bw = function (lw) { var x = Math.pow(10, lw); return -10 * Math.log10(1 + Math.pow(x, 2 * n)); };
      var ch = function (lw) { var x = Math.pow(10, lw); var t = cheb(n, x); return -10 * Math.log10(1 + eps * eps * t * t); };
      [-3, -20, -40].forEach(function (db) { f.text(db + " dB", pl.x0 + 4, pl.Y(db) - 7, { size: 9.5, color: c.dim }); });
      f.seg(pl.X(0), pl.y0, pl.X(0), pl.y0 + pl.h, f.a(c.ink, 0.35), 1, { dash: [4, 4] });
      f.text("ω_c", pl.X(0) + 4, pl.y0 + pl.h - 10, { size: 10, color: c.dim });
      var sweep = f.reduce ? 1 : Math.min(1, ((f.t * 0.3) % 1.3));
      var end = -1 + 2 * sweep;
      f.curve(pl, bw, -1, 1, 240, f.a(c.a, 0.25), 1.2); f.curve(pl, ch, -1, 1, 240, f.a(c.b, 0.25), 1.2);
      f.curve(pl, bw, -1, end, 240, c.a, 2.6, { glow: 10 });
      f.curve(pl, ch, -1, end, 240, c.b, 2.6, { glow: 10 });
      f.circle(pl.X(end), pl.Y(Math.max(-60, bw(end))), 4.5, "#fff", null, 0, { glow: 10, glowColor: c.a });
      f.circle(pl.X(end), pl.Y(Math.max(-60, ch(end))), 4.5, "#fff", null, 0, { glow: 10, glowColor: c.b });
      f.text("Butterworth (maximally flat)", pl.x0 + pl.w - 46, pl.y0 + 14, { size: 11.5, align: "right", color: c.a, weight: 700 });
      f.text("Chebyshev (1 dB ripple)", pl.x0 + pl.w - 46, pl.y0 + 31, { size: 11.5, align: "right", color: c.b, weight: 700 });
      f.text("n = " + n + "  ·  roll-off " + 20 * n + " dB/decade", pl.x0 + pl.w - 46, pl.y0 + 50, { size: 11.5, align: "right", mono: true });
    }
  });
})();
