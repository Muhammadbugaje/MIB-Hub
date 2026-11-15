/* course-fx: power systems — single-line diagram (grid), phasors, fault current (fault),
   equal-area criterion (swing) and a daily energy balance with solar and storage (energy). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;
  var PH = ["#ff5d5d", "#ffd23f", "#4da3ff"];

  /* ================================================================== grid */
  var NODES = [
    { k: "gen", lab: "Generator", sub: "16 kV", tip: "Hydro or gas-turbine synchronous generator, typically 11–23 kV at its terminals." },
    { k: "tx", lab: "Step-up", sub: "16/330 kV", tip: "Generator step-up transformer: raises the voltage so the current — and the I²R loss — is small." },
    { k: "tx", lab: "TCN station", sub: "330/132 kV", tip: "TCN transmission station: 330 kV backbone down to 132 kV." },
    { k: "tx", lab: "132/33 kV", sub: "", tip: "Sub-transmission station feeding the distribution company's 33 kV lines." },
    { k: "tx", lab: "Injection S/S", sub: "33/11 kV", tip: "DisCo injection substation: 33 kV in, several 11 kV feeders out." },
    { k: "pole", lab: "Street transformer", sub: "11/0.415 kV", tip: "The transformer on your street: 415 V three-phase, 240 V phase to neutral." },
    { k: "load", lab: "Homes", sub: "415/240 V", tip: "Lighting, fans, fridges, pumps and air-conditioners." }
  ];
  var SEGV = [["16 kV", "#9fb4aa"], ["330 kV", "#ffd23f"], ["132 kV", "#ff9a3c"], ["33 kV", "#3dd68c"], ["11 kV", "#5ec8ff"], ["415 V", "#ff7ab6"]];

  function drawTx(f, x, y, r, col, on) {
    f.circle(x - r * 0.45, y, r, f.a(col, on ? 0.12 : 0.04), f.a(col, on ? 0.95 : 0.35), 1.8, { glow: on ? 8 : 0, glowColor: col });
    f.circle(x + r * 0.45, y, r, f.a(col, on ? 0.12 : 0.04), f.a(col, on ? 0.95 : 0.35), 1.8);
  }
  function drawTower(f, x, y, h, col) {
    var w = h * 0.36;
    f.line([[x - w / 2, y], [x - w * 0.12, y - h], [x + w * 0.12, y - h], [x + w / 2, y]], col, 1.1);
    f.seg(x - w * 0.6, y - h * 0.78, x + w * 0.6, y - h * 0.78, col, 1.1);
    f.seg(x - w * 0.45, y - h * 0.55, x + w * 0.45, y - h * 0.55, col, 1);
    f.seg(x - w * 0.35, y, x + w * 0.1, y - h * 0.5, col, 0.7); f.seg(x + w * 0.35, y, x - w * 0.1, y - h * 0.5, col, 0.7);
  }
  function drawHouse(f, x, y, s, lit, col) {
    f.line([[x - s, y], [x - s, y - s * 1.1], [x, y - s * 1.9], [x + s, y - s * 1.1], [x + s, y]], f.a(f.c.ink, 0.55), 1.3, { close: true, fill: f.a(f.c.ink, 0.05) });
    f.box(x - s * 0.55, y - s * 0.95, s * 0.42, s * 0.42, 2, lit ? col : f.a(f.c.ink, 0.12), null, 0, { glow: lit ? 10 : 0, glowColor: col });
    f.box(x + s * 0.13, y - s * 0.95, s * 0.42, s * 0.42, 2, lit > 1 ? col : f.a(f.c.ink, 0.12), null, 0, { glow: lit > 1 ? 10 : 0, glowColor: col });
  }

  FX.define("grid", {
    aspect: 2.5, aspectSmall: 0.92,
    controls: [
      { key: "load", label: "Demand", min: 15, max: 100, step: 1, value: 60, unit: " %" },
      { key: "fault", label: "Fault on the 33 kV feeder", type: "toggle", value: false }
    ],
    init: function (f) { f.state.flow = 0; f.state.spark = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var load = hero ? 0.55 + 0.4 * sin(f.t * 0.35) : (f.v.load == null ? 60 : f.v.load) / 100;
      var fault = !hero && !!f.v.fault;
      s.flow += (f.dt || 0) * (0.3 + load * 1.4);
      f.clear();
      var narrow = f.w / f.h < (hero ? 1.75 : 1.25), n = NODES.length, pos = [];
      if (!narrow) {
        for (var i = 0; i < n; i++) pos.push([f.w * (0.07 + 0.86 * i / (n - 1)), f.h * (hero ? 0.5 : 0.46)]);
      } else {
        var r1 = [0, 1, 2, 3], r2 = [4, 5, 6];
        r1.forEach(function (k, j) { pos[k] = [f.w * (0.12 + 0.76 * j / 3), f.h * 0.26]; });
        r2.forEach(function (k, j) { pos[k] = [f.w * (0.88 - 0.76 * j / 2), f.h * 0.66]; });
      }
      var R = Math.max(9, Math.min(f.w, f.h) * (hero ? 0.058 : narrow ? 0.045 : 0.05));
      var dark = function (i) { return fault && i >= 3; }; // segments/nodes beyond the 33 kV breaker
      // segments
      for (var sg = 0; sg < n - 1; sg++) {
        var a = pos[sg], b = pos[sg + 1], col = SEGV[sg][1], off = dark(sg);
        var pts = (narrow && sg === 3) ? [a, [a[0] + R * 2.2, a[1]], [a[0] + R * 2.2, b[1]], b] : [a, b];
        f.line(pts, f.a(col, off ? 0.18 : 0.75), sg === 1 ? 3 : 2.2, { glow: off ? 0 : 8 });
        // label
        var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (narrow && sg === 3) { mx = a[0] + R * 2.2 + 4; my = (a[1] + b[1]) / 2; }
        f.text(SEGV[sg][0], mx + (narrow && sg === 3 ? 22 : 0), my - (narrow && sg === 3 ? 0 : R * 1.9), { size: narrow ? 10 : 11.5, weight: 700, color: f.a(col, off ? 0.4 : 1), align: "center", mono: true });
        // towers on the 330 kV and 132 kV lines
        if ((sg === 1 || sg === 2) && !narrow) {
          for (var tw = 1; tw <= 2; tw++) {
            var tx = a[0] + (b[0] - a[0]) * tw / 3;
            drawTower(f, tx, a[1] + R * 0.2, R * 2.4, f.a(c.ink, 0.35));
          }
        }
        // power-flow dots
        if (!off) {
          var len = 0, segl = [];
          for (var p = 1; p < pts.length; p++) { var L = Math.hypot(pts[p][0] - pts[p - 1][0], pts[p][1] - pts[p - 1][1]); segl.push(L); len += L; }
          var nd = Math.max(2, Math.round(len / 34));
          for (var d = 0; d < nd; d++) {
            var u = ((s.flow + d / nd) % 1) * len, q = 0;
            while (q < segl.length - 1 && u > segl[q]) { u -= segl[q]; q++; }
            var t = segl[q] ? u / segl[q] : 0;
            var px = pts[q][0] + (pts[q + 1][0] - pts[q][0]) * t, py = pts[q][1] + (pts[q + 1][1] - pts[q][1]) * t;
            f.circle(px, py, sg === 1 ? 2.8 : 2.3, col, null, 0, { glow: 10, glowColor: col });
          }
        }
        // breaker on the 33 kV feeder
        if (sg === 3 && !hero) {
          var bx = narrow ? a[0] + R * 2.2 : (a[0] + b[0]) / 2, by = narrow ? (a[1] + b[1]) / 2 : a[1];
          f.box(bx - 6, by - 6, 12, 12, 2, fault ? c.d : f.a(c.a, 0.85), "#fff", 1, { glow: 8, glowColor: fault ? c.d : c.a });
          f.hit({ x: bx - 9, y: by - 9, w: 18, h: 18 }, "33 kV circuit breaker", fault ? "Tripped by the overcurrent relay: the fault is isolated, the rest of the grid keeps running." : "Closed. Its relay watches the feeder current.");
          if (fault) {
            s.spark += (f.dt || 0);
            var fx = narrow ? bx : bx + (b[0] - bx) * 0.5, fy = narrow ? by + (b[1] - by) * 0.45 : by;
            if (Math.floor(s.spark * 8) % 2 === 0 || f.reduce) {
              for (var z = 0; z < 5; z++) { var ang = z * 1.3 + s.spark * 9; f.seg(fx, fy, fx + cos(ang) * 12, fy + sin(ang) * 12, "#fff6c2", 1.4, { glow: 12 }); }
            }
            f.text("FAULT", fx, fy + 22, { size: 10, weight: 800, color: c.d, align: "center" });
          }
        }
      }
      // nodes
      NODES.forEach(function (nd, i) {
        var x = pos[i][0], y = pos[i][1], col = SEGV[Math.max(0, i - 1)][1], on = !dark(i);
        if (nd.k === "gen") {
          f.circle(x, y, R * 1.15, f.a(c.a, 0.12), c.a, 2, { glow: 14, glowColor: c.a });
          var pts2 = []; for (var k = 0; k <= 24; k++) { var u2 = k / 24; pts2.push([x - R * 0.6 + u2 * R * 1.2, y - sin(u2 * TAU + f.t * 4) * R * 0.35]); }
          f.line(pts2, c.a, 1.8);
        } else if (nd.k === "tx" || nd.k === "pole") {
          drawTx(f, x, y, R * (nd.k === "pole" ? 0.7 : 0.85), SEGV[i][1] || col, on);
        } else {
          var lit = !on ? 0 : load > 0.6 ? 2 : 1, hs = R * 0.7;
          drawHouse(f, x - hs * 1.3, y + hs, hs, lit, c.b);
          drawHouse(f, x + hs * 1.1, y + hs * 0.6, hs * 0.85, lit > 0 ? (load > 0.35 ? 2 : 1) : 0, c.b);
        }
        if (true) {
          var ly = y + R * (nd.k === "load" ? 2.2 : 2.0);
          f.text(nd.lab, x, ly, { size: narrow ? 9.5 : 11, weight: 650, align: "center", color: on ? c.ink : f.a(c.ink, 0.4) });
          if (nd.sub) f.text(nd.sub, x, ly + 13, { size: narrow ? 9 : 10, align: "center", color: c.dim, mono: true });
        }
        f.hit({ x: x, y: y, r: R * 1.4 }, nd.lab + (nd.sub ? " · " + nd.sub : ""), nd.tip);
      });
      if (hero) return;
      // read-out
      var vEnd = fault ? 0 : 1 - 0.075 * load * load - 0.01;
      var ry = narrow ? f.h - 22 : f.h - 18;
      f.text("Power sent  " + Math.round(load * 600) + " MW", 14, ry, { size: 11.5, mono: true, color: c.b });
      f.text("Voltage at the far end  " + (fault ? "— (isolated)" : (vEnd * 100).toFixed(1) + " %"), narrow ? 14 : f.w * 0.36, narrow ? ry - 17 : ry, { size: 11.5, mono: true, color: fault ? c.d : (vEnd < 0.95 ? c.d : c.a) });
    }
  });

  /* ================================================================ phasors */
  function phasorPanel(f, cx, cy, R, vecs, label) {
    f.circle(cx, cy, R, null, f.a(f.c.ink, 0.12), 1, { dash: [3, 5] });
    f.seg(cx - R * 1.05, cy, cx + R * 1.05, cy, f.a(f.c.ink, 0.12), 1);
    f.seg(cx, cy - R * 1.05, cx, cy + R * 1.05, f.a(f.c.ink, 0.12), 1);
    vecs.forEach(function (v) {
      var x0 = v.from ? v.from[0] : cx, y0 = v.from ? v.from[1] : cy;
      f.arrow(x0, y0, x0 + v.x, y0 + v.y, v.col, v.w || 2.6, { glow: v.glow ? 12 : 0, head: v.head || 10 });
      if (v.lab) f.text(v.lab, x0 + v.x + (v.lx || 8), y0 + v.y + (v.ly || 0), { color: v.col, weight: 750, size: 12.5 });
    });
    if (label) f.text(label, cx, cy + R + 16, { size: 11, color: f.c.dim, align: "center", weight: 650 });
  }

  FX.define("phasors", {
    aspect: 1.9, aspectSmall: 0.9,
    controls: function (o) {
      if (o.variant === "seq") return [{ key: "unb", label: "Unbalance", min: 0, max: 1, step: 0.02, value: 0.45, fmt: function (v) { return Math.round(v * 100) + " %"; } }];
      var c = [{ key: "phi", label: "Power-factor angle", min: -60, max: 75, step: 1, value: 32, fmt: function (v) { return Math.abs(v) + "° " + (v > 0 ? "lag" : v < 0 ? "lead" : "") + "  (pf " + cos(v * PI / 180).toFixed(2) + ")"; } }];
      if (o.variant === "sync" || o.variant === "line") c.push({ key: "i", label: "Load current", min: 0.1, max: 1.2, step: 0.02, value: 0.8, fmt: function (v) { return v.toFixed(2) + " pu"; } });
      return c;
    },
    draw: function (f) {
      var c = f.c, v = f.v, o = f.opts, variant = o.variant || "pf";
      f.clear();
      var narrow = f.w / f.h < 1.25, t = f.t;
      if (variant === "seq") {
        var u = v.unb == null ? 0.45 : v.unb, w = t * 0.8;
        // sequence sets (magnitudes)
        var p1 = 1, p2 = 0.55 * u, p0 = 0.4 * u;
        var cols = 4, cw = narrow ? f.w / 2 : f.w / cols, rr = Math.min(cw * 0.34, (narrow ? f.h / 2 : f.h) * 0.3);
        var centre = function (k) { return narrow ? [cw * (k % 2) + cw / 2, (k < 2 ? f.h * 0.27 : f.h * 0.74)] : [cw * k + cw / 2, f.h * 0.47]; };
        var sets = [];
        var vec = function (m, ang, col, lab) { return { x: cos(ang) * m * rr, y: -sin(ang) * m * rr, col: col, lab: lab, w: 2.4 }; };
        var pos = [0, 1, 2].map(function (q) { return vec(p1, w - q * TAU / 3, PH[q], "abc"[q] + "₁"); });
        var neg = [0, 1, 2].map(function (q) { return vec(p2, w + q * TAU / 3 + 0.6, PH[q], "abc"[q] + "₂"); });
        var zer = [0, 1, 2].map(function (q) { return vec(p0, w + 1.1 + q * 0.06, PH[q], q === 0 ? "a₀ b₀ c₀" : ""); });
        var tot = [0, 1, 2].map(function (q) { return { x: pos[q].x + neg[q].x + zer[q].x, y: pos[q].y + neg[q].y + zer[q].y, col: PH[q], lab: "abc"[q], w: 3, glow: true }; });
        sets = [[tot, "Unbalanced set"], [pos, "Positive sequence"], [neg, "Negative sequence"], [zer, "Zero sequence"]];
        sets.forEach(function (st, k) { var ce = centre(k); phasorPanel(f, ce[0], ce[1], rr, st[0], st[1]); });
        if (!narrow) { f.text("=", cw, f.h * 0.47, { size: 22, color: c.dim, align: "center" }); f.text("+", cw * 2, f.h * 0.47, { size: 22, color: c.dim, align: "center" }); f.text("+", cw * 3, f.h * 0.47, { size: 22, color: c.dim, align: "center" }); }
        return;
      }
      var phi = (v.phi == null ? 32 : v.phi) * PI / 180;
      if (variant === "pf") {
        // rotating V and I with their waveforms, plus the power triangle
        var R = narrow ? Math.min(f.w * 0.3, f.h * 0.2) : Math.min(f.h * 0.34, f.w * 0.17);
        var cx = narrow ? f.w * 0.5 : R + 30, cy = narrow ? R + 26 : f.h * 0.46;
        var th = t * 1.4;
        var V = { x: cos(th) * R, y: -sin(th) * R, col: c.b, lab: "V", w: 3, glow: true };
        var I = { x: cos(th - phi) * R * 0.72, y: -sin(th - phi) * R * 0.72, col: c.a, lab: "I", w: 3, glow: true };
        phasorPanel(f, cx, cy, R, [V, I]);
        // angle arc
        f.ctx.save(); f.ctx.strokeStyle = f.a(c.ink, 0.5); f.ctx.beginPath(); f.ctx.arc(cx, cy, R * 0.3, -th, -th + phi, phi < 0); f.ctx.stroke(); f.ctx.restore();
        f.text("φ", cx + cos(th - phi / 2) * R * 0.42, cy - sin(th - phi / 2) * R * 0.42, { color: c.ink, size: 12, align: "center" });
        // waveforms
        var px0 = narrow ? 14 : cx + R + 30, py0 = narrow ? cy + R + 20 : 20, pw = narrow ? f.w - 28 : f.w * 0.62 - px0 + f.w * 0.36 - 16, ph = narrow ? f.h * 0.32 : f.h * 0.5;
        if (!narrow) pw = f.w - px0 - 16;
        var pl = f.plot(px0, py0, pw, ph, [0, 2], [-1.2, 1.2], { nx: 8, ny: 4, xl: "time" });
        f.curve(pl, function (x) { return sin(th - x * PI * 2); }, 0, 2, 160, c.b, 2.2, { glow: 6 });
        f.curve(pl, function (x) { return 0.72 * sin(th - phi - x * PI * 2); }, 0, 2, 160, c.a, 2.2, { glow: 6 });
        f.curve(pl, function (x) { return 0.72 * sin(th - x * PI * 2) * sin(th - phi - x * PI * 2); }, 0, 2, 160, f.a(c.c, 0.8), 1.4, { dash: [4, 4] });
        f.text("v", px0 + 10, py0 + 12, { color: c.b, weight: 700 }); f.text("i", px0 + 24, py0 + 12, { color: c.a, weight: 700 }); f.text("p = vi", px0 + 38, py0 + 12, { color: c.c, size: 11 });
        // power triangle
        var ty0 = py0 + ph + 18, tH = f.h - ty0 - 14;
        if (tH > 40) {
          var Pm = cos(phi), Qm = sin(phi), sc = Math.min(tH / 1.0, (narrow ? f.w * 0.5 : pw * 0.4));
          var ox = px0 + 20, oy = ty0 + (phi >= 0 ? 6 : tH - 6);
          var Pp = [ox + Pm * sc, oy], Qp = [ox + Pm * sc, oy + Qm * sc * (phi >= 0 ? 1 : 1)];
          f.line([[ox, oy], Pp, Qp, [ox, oy]], f.a(c.ink, 0.3), 1, { close: true, fill: f.a(c.a, 0.08) });
          f.arrow(ox, oy, Pp[0], Pp[1], c.b, 2.2); f.arrow(Pp[0], Pp[1], Qp[0], Qp[1], c.c, 2.2); f.arrow(ox, oy, Qp[0], Qp[1], c.a, 2.2, { glow: 8 });
          var tx2 = Pp[0] + 26;
          f.text("P = S cos φ = " + Pm.toFixed(2), tx2, ty0 + 10, { size: 11.5, mono: true, color: c.b });
          f.text("Q = S sin φ = " + Qm.toFixed(2) + (phi > 0 ? " (absorbed)" : phi < 0 ? " (supplied)" : ""), tx2, ty0 + 28, { size: 11.5, mono: true, color: c.c });
          if (o.variant === "pf" && f.opts.variant === "pf") {
            var W1 = cos(PI / 6 - phi), W2 = cos(PI / 6 + phi), k = 1 / 1.732;
            f.text("Two wattmeters: W₁ = " + (W1 * k).toFixed(2) + ", W₂ = " + (W2 * k).toFixed(2) + " (× √3VI)", tx2, ty0 + 46, { size: 11.5, mono: true, color: c.ink });
          }
        }
        return;
      }
      // sync / line: static phasor construction drawn progressively
      var Ii = v.i == null ? 0.8 : v.i;
      var X = variant === "sync" ? 1.0 : 0.25, Rr = variant === "sync" ? 0 : 0.08;
      var Vv = [1, 0], Iv = [Ii * cos(-phi), Ii * sin(-phi)];
      var drop = [Rr * Iv[0] - X * Iv[1], Rr * Iv[1] + X * Iv[0]]; // (R + jX) I
      var E = [Vv[0] + drop[0], Vv[1] + drop[1]];
      var allp = [[0, 0], Vv, Iv, E];
      var mnx = Math.min.apply(null, allp.map(function (q) { return q[0]; })), mxx = Math.max.apply(null, allp.map(function (q) { return q[0]; }));
      var mny = Math.min.apply(null, allp.map(function (q) { return q[1]; })), mxy = Math.max.apply(null, allp.map(function (q) { return q[1]; }));
      var aw = narrow ? f.w - 60 : f.w * 0.56, ah = narrow ? f.h * 0.58 : f.h - 70;
      var sc2 = Math.min(aw / Math.max(0.3, mxx - mnx), ah / Math.max(0.3, mxy - mny));
      var ox2 = (narrow ? 30 : 40) + (-mnx) * sc2 + (aw - (mxx - mnx) * sc2) / 2;
      var oy2 = (narrow ? f.h * 0.36 : 35) + mxy * sc2 + (ah - (mxy - mny) * sc2) / 2;
      var prog = f.reduce ? 1 : FX.clamp((t % 7) / 2.2, 0, 1);
      var P = function (z) { return [ox2 + z[0] * sc2, oy2 - z[1] * sc2]; };
      var o0 = P([0, 0]), pv = P(Vv), pi = P(Iv);
      f.grid(0, 0, f.w, f.h, 28, f.a(c.ink, 0.035));
      f.arrow(o0[0], o0[1], pv[0], pv[1], c.b, 3, { glow: 10 });
      f.text(variant === "sync" ? "V (terminal)" : "V_R", pv[0] - 10, pv[1] + 16, { color: c.b, weight: 700, align: "right" });
      f.arrow(o0[0], o0[1], pi[0], pi[1], c.a, 2.4, { glow: 6 });
      f.text("I", pi[0] + 8, pi[1] + 4, { color: c.a, weight: 700 });
      if (Rr) {
        var pR = P([Vv[0] + Rr * Iv[0], Vv[1] + Rr * Iv[1]]);
        f.arrow(pv[0], pv[1], pv[0] + (pR[0] - pv[0]) * Math.min(1, prog * 3), pv[1] + (pR[1] - pv[1]) * Math.min(1, prog * 3), "#ff9a3c", 2, { head: 7 });
        if (prog > 0.35) { var pE0 = P(E); f.arrow(pR[0], pR[1], pR[0] + (pE0[0] - pR[0]) * FX.clamp((prog - 0.33) * 1.6, 0, 1), pR[1] + (pE0[1] - pR[1]) * FX.clamp((prog - 0.33) * 1.6, 0, 1), c.c, 2.2, { head: 8 }); }
        f.text("IR", (pv[0] + pR[0]) / 2, pR[1] + 14, { size: 11, color: "#ff9a3c" });
      } else {
        var pE1 = P(E);
        f.arrow(pv[0], pv[1], pv[0] + (pE1[0] - pv[0]) * Math.min(1, prog * 1.6), pv[1] + (pE1[1] - pv[1]) * Math.min(1, prog * 1.6), c.c, 2.4, { head: 9 });
        f.text("jX_s I", (pv[0] + pE1[0]) / 2 + 10, (pv[1] + pE1[1]) / 2, { size: 11.5, color: c.c, weight: 700 });
      }
      if (prog > 0.6) {
        var pE = P(E), k2 = FX.clamp((prog - 0.6) * 2.5, 0, 1);
        f.arrow(o0[0], o0[1], o0[0] + (pE[0] - o0[0]) * k2, o0[1] + (pE[1] - o0[1]) * k2, "#fff", 3.2, { glow: 16 });
        f.text(variant === "sync" ? "E (excitation)" : "V_S", pE[0] + 8, pE[1] - 10, { color: "#fff", weight: 750 });
      }
      var Emag = Math.hypot(E[0], E[1]), delta = Math.atan2(E[1], E[0]) * 180 / PI;
      var rx = narrow ? 14 : f.w * 0.66, ry = narrow ? 18 : f.h * 0.22;
      var lines = variant === "sync"
        ? ["|E| = " + Emag.toFixed(2) + " pu", "δ = " + delta.toFixed(1) + "°", "P = EV sin δ / X_s = " + (Emag * sin(delta * PI / 180) / X).toFixed(2) + " pu", Emag > 1.02 ? "over-excited" : Emag < 0.98 ? "under-excited" : "normal excitation"]
        : ["|V_S| = " + Emag.toFixed(3) + " pu", "regulation = " + ((Emag - 1) * 100).toFixed(1) + " %", phi < 0 ? "leading load: V_R can exceed V_S" : "lagging load: voltage drops along the line"];
      lines.forEach(function (s2, j) { f.text(s2, rx, ry + j * 19, { size: 12, mono: true, color: j === 0 ? "#fff" : c.ink }); });
    }
  });

  /* ================================================================== fault */
  FX.define("fault", {
    aspect: 2.0, aspectSmall: 1.0,
    controls: function (o) {
      return [
        { key: "xr", label: "X/R ratio", min: 2, max: 40, step: 1, value: 15 },
        { key: "alpha", label: "Instant of fault", min: 0, max: 180, step: 5, value: 0, unit: "°" }
      ];
    },
    draw: function (f) {
      var c = f.c, gen = f.opts.variant === "gen", xr = f.v.xr || 15, al = (f.v.alpha || 0) * PI / 180;
      if (f.mode === "hero") { xr = 15; al = 0; }
      f.clear();
      var tau = xr / (2 * PI * 50), theta = Math.atan(xr), T = 0.2; // seconds shown
      var Iac = function (tt) {
        if (!gen) return 1;
        var I2 = 5, I1 = 3.33, I0 = 0.83;
        return ((I2 - I1) * Math.exp(-tt / 0.03) + (I1 - I0) * Math.exp(-tt / 0.6) + I0) / 5;
      };
      var i = function (tt) { return Iac(tt) * (sin(2 * PI * 50 * tt + al - theta) - sin(al - theta) * Math.exp(-tt / tau)); };
      var dc = function (tt) { return -Iac(0) * sin(al - theta) * Math.exp(-tt / tau); };
      var ymax = 2.1;
      var pl = f.plot(16, 16, f.w - 32, f.h - 48, [-0.02, T], [-ymax, ymax], { nx: 11, ny: 6, xl: "time (s)", yl: gen ? "short-circuit current (pu of I″)" : "fault current (pu of AC peak)" });
      // prefault load current
      f.curve(pl, function (tt) { return 0.12 * sin(2 * PI * 50 * tt + al - 0.6); }, -0.02, 0, 40, f.a(c.ink, 0.5), 1.5);
      var prog = f.reduce ? 1 : ((f.t % 5) / 3.8);
      var tEnd = Math.min(T, prog * T);
      f.seg(pl.X(0), pl.y0, pl.X(0), pl.y0 + pl.h, f.a(c.d, 0.6), 1, { dash: [4, 4] });
      f.text("fault", pl.X(0) + 4, pl.y0 + pl.h - 12, { size: 10.5, color: c.d, weight: 700 });
      // envelopes
      f.curve(pl, function (tt) { return dc(tt) + Iac(tt); }, 0, T, 120, f.a(c.b, 0.55), 1.2, { dash: [5, 5] });
      f.curve(pl, function (tt) { return dc(tt) - Iac(tt); }, 0, T, 120, f.a(c.b, 0.55), 1.2, { dash: [5, 5] });
      f.curve(pl, dc, 0, T, 120, f.a(c.c, 0.9), 1.8);
      if (tEnd > 0) f.curve(pl, i, 0, tEnd, Math.max(10, Math.round(600 * tEnd / T)), c.a, 2.4, { glow: 10 });
      var pk = 0; for (var k = 0; k < 400; k++) { var tt = k / 400 * 0.012; pk = Math.max(pk, Math.abs(i(tt))); }
      f.text("DC offset (τ = X/ωR = " + (tau * 1000).toFixed(0) + " ms)", pl.X(T * 0.35), pl.Y(dc(T * 0.35)) - 12, { size: 11, color: c.c });
      f.text("first peak ≈ " + pk.toFixed(2) + " × AC peak", pl.x0 + pl.w - 10, pl.y0 + pl.h - 30, { size: 12, mono: true, align: "right", color: "#fff" });
      if (gen) {
        f.text("sub-transient", pl.X(0.012), pl.Y(-ymax * 0.92), { size: 10.5, color: c.b });
        f.text("transient", pl.X(0.09), pl.Y(-ymax * 0.92), { size: 10.5, color: c.b });
      }
      for (var s = 0; s <= 0.2001; s += 0.05) f.text(s.toFixed(2), pl.X(s), pl.y0 + pl.h + 12, { size: 10, color: c.dim, align: "center" });
    }
  });

  /* ================================================================== swing */
  FX.define("swing", {
    aspect: 1.9, aspectSmall: 0.95,
    controls: [{ key: "dc", label: "Clearing angle δc", min: 31, max: 135, step: 1, value: 70, unit: "°" }],
    draw: function (f) {
      var c = f.c, Pm = 1, P1 = 2.0, P2 = 0.5, P3 = 1.5;
      var d0 = Math.asin(Pm / P1), dmax = PI - Math.asin(Pm / P3);
      var dc = (f.v.dc == null ? 70 : f.v.dc) * PI / 180;
      if (f.mode === "hero") dc = (60 + 25 * sin(f.t * 0.3)) * PI / 180;
      dc = FX.clamp(dc, d0 + 0.01, dmax - 0.01);
      var A1 = Pm * (dc - d0) + P2 * (cos(dc) - cos(d0));
      var A2max = P3 * (cos(dc) - cos(dmax)) - Pm * (dmax - dc);
      var cosCr = (Pm * (dmax - d0) + P3 * cos(dmax) - P2 * cos(d0)) / (P3 - P2), dcr = Math.acos(FX.clamp(cosCr, -1, 1));
      var stable = A2max >= A1;
      // delta_1 where decelerating area equals A1
      var d1 = dmax;
      if (stable) { var lo = dc, hi = dmax; for (var k = 0; k < 40; k++) { var m = (lo + hi) / 2; var A = P3 * (cos(dc) - cos(m)) - Pm * (m - dc); if (A < A1) lo = m; else hi = m; } d1 = lo; }
      f.clear();
      var pl = f.plot(40, 16, f.w - 56, f.h - 50, [0, PI], [0, 2.2], { nx: 6, ny: 4, xl: "rotor angle δ", yl: "electrical power (pu)" });
      for (var deg = 0; deg <= 180; deg += 30) f.text(deg + "°", pl.X(deg * PI / 180), pl.y0 + pl.h + 12, { size: 10, color: c.dim, align: "center" });
      var x = f.ctx;
      // shaded areas
      x.save(); x.beginPath(); x.moveTo(pl.X(d0), pl.Y(Pm));
      for (var a = d0; a <= dc; a += 0.01) x.lineTo(pl.X(a), pl.Y(P2 * sin(a)));
      x.lineTo(pl.X(dc), pl.Y(Pm)); x.closePath(); x.fillStyle = f.a(c.a, 0.35); x.fill(); x.restore();
      x.save(); x.beginPath(); x.moveTo(pl.X(dc), pl.Y(Pm));
      var dEnd = stable ? d1 : dmax;
      for (var b = dc; b <= dEnd; b += 0.01) x.lineTo(pl.X(b), pl.Y(P3 * sin(b)));
      x.lineTo(pl.X(dEnd), pl.Y(Pm)); x.closePath(); x.fillStyle = f.a(stable ? c.c : c.d, 0.3); x.fill(); x.restore();
      f.curve(pl, function (d) { return P1 * sin(d); }, 0, PI, 120, f.a(c.ink, 0.45), 1.5, { dash: [5, 4] });
      f.curve(pl, function (d) { return P2 * sin(d); }, 0, PI, 120, f.a(c.d, 0.8), 1.8);
      f.curve(pl, function (d) { return P3 * sin(d); }, 0, PI, 120, c.b, 2.4, { glow: 8 });
      f.seg(pl.X(0), pl.Y(Pm), pl.X(PI), pl.Y(Pm), f.a(c.ink, 0.6), 1.2, { dash: [2, 3] });
      f.text("P_m", pl.X(PI) - 6, pl.Y(Pm) - 10, { size: 11, align: "right", color: c.ink });
      f.text("pre-fault", pl.X(PI / 2), pl.Y(P1) - 10, { size: 10.5, align: "center", color: c.dim });
      f.text("post-fault", pl.X(PI / 2) + 30, pl.Y(P3) - 10, { size: 10.5, color: c.b });
      f.text("during fault", pl.X(PI / 2), pl.Y(P2) - 10, { size: 10.5, align: "center", color: c.d });
      f.text("A₁", pl.X((d0 + dc) / 2), pl.Y((Pm + P2 * sin((d0 + dc) / 2)) / 2), { size: 13, weight: 800, align: "center" });
      f.text("A₂", pl.X((dc + dEnd) / 2), pl.Y((Pm + P3 * sin((dc + dEnd) / 2)) / 2), { size: 13, weight: 800, align: "center" });
      f.seg(pl.X(dc), pl.y0, pl.X(dc), pl.y0 + pl.h, f.a(c.a, 0.7), 1, { dash: [3, 3] });
      f.seg(pl.X(dcr), pl.y0, pl.X(dcr), pl.y0 + pl.h, f.a(c.ink, 0.35), 1, { dash: [1, 4] });
      f.text("δcr " + Math.round(dcr * 180 / PI) + "°", pl.X(dcr) + 4, pl.y0 + pl.h - 10, { size: 10, color: c.dim });
      // the rotor's journey
      var T = f.reduce ? 2.0 : (f.t % 6);
      var dpt, Ppt;
      if (T < 1.4) { dpt = d0 + (dc - d0) * FX.ease(T / 1.4); Ppt = P2 * sin(dpt); }
      else if (stable) { var u = (T - 1.4) / 4.6; var sw = (1 - cos(u * TAU)) / 2; dpt = dc + (d1 - dc) * (u < 0.5 ? FX.ease(u * 2) : 1 - FX.ease((u - 0.5) * 2) * 0.55); Ppt = P3 * sin(dpt); }
      else { var u2 = (T - 1.4) / 4.6; dpt = dc + (PI - dc) * FX.ease(u2); Ppt = P3 * sin(dpt); }
      f.circle(pl.X(dpt), pl.Y(Ppt), 6, "#fff", null, 0, { glow: 16, glowColor: stable ? c.a : c.d });
      var rx = pl.x0 + pl.w - 46;
      f.text("A₁ = " + A1.toFixed(3), rx, pl.y0 + 14, { size: 12, mono: true, align: "right" });
      f.text("A₂ available = " + Math.max(0, A2max).toFixed(3), rx, pl.y0 + 32, { size: 12, mono: true, align: "right" });
      f.text(stable ? "STABLE — rotor swings back" : "UNSTABLE — loses synchronism", rx, pl.y0 + 52, { size: 12.5, weight: 800, align: "right", color: stable ? c.a : c.d });
    }
  });

  /* ================================================================= energy */
  function demand(h) { // kW, a small office/home building
    var base = 0.6 + 0.25 * Math.exp(-Math.pow((h - 13) / 4, 2)) * 2.4;
    var eve = 2.2 * Math.exp(-Math.pow((h - 20) / 2.2, 2));
    var morn = 0.8 * Math.exp(-Math.pow((h - 7) / 1.3, 2));
    return base + eve + morn;
  }
  function solar(h, kwp) { if (h < 6.3 || h > 18.7) return 0; return kwp * 0.82 * Math.pow(sin(PI * (h - 6.3) / 12.4), 1.6); }
  FX.define("energy", {
    aspect: 1.9, aspectSmall: 0.85,
    controls: [
      { key: "pv", label: "PV array", min: 0, max: 8, step: 0.2, value: 3, unit: " kWp" },
      { key: "bat", label: "Battery", min: 0, max: 20, step: 0.5, value: 7.5, unit: " kWh" }
    ],
    draw: function (f) {
      var c = f.c, hero = f.mode === "hero";
      var kwp = hero ? 3.2 : (f.v.pv == null ? 3 : f.v.pv), cap = hero ? 8 : (f.v.bat == null ? 7.5 : f.v.bat);
      // simulate 24 h at 6-min steps, battery starts at 30 %
      var N = 240, dt = 24 / N, soc = cap * 0.3, rows = [], eDem = 0, eSolar = 0, eGen = 0;
      for (var k = 0; k <= N; k++) {
        var h = k * dt, D = demand(h), S = solar(h, kwp), use = Math.min(D, S), ex = S - use, need = D - use;
        var ch = Math.min(ex, (cap - soc) / dt) * 0.95; soc += ch * dt;
        var dis = Math.min(need, soc / dt); soc -= dis * dt;
        var gen = need - dis;
        rows.push({ h: h, D: D, S: S, use: use, dis: dis, gen: gen, soc: cap ? soc / cap : 0, spill: ex - ch / 0.95 });
        if (k < N) { eDem += D * dt; eSolar += (use + dis) * dt; eGen += gen * dt; }
      }
      f.clear();
      var small = f.w / f.h < 1.25;
      var pl = f.plot(36, small ? 46 : 40, f.w - 52, f.h - (small ? 120 : 84), [0, 24], [0, Math.max(5, kwp * 0.9 + 0.5)], { nx: 8, ny: 4, xl: "hour of day", yl: "kW" });
      for (var hh = 0; hh <= 24; hh += 6) f.text(String(hh).padStart(2, "0") + ":00", pl.X(hh), pl.y0 + pl.h + 12, { size: 10, color: c.dim, align: "center" });
      var x = f.ctx;
      var area = function (lowF, highF, col) {
        x.save(); x.beginPath();
        rows.forEach(function (r, i) { var X0 = pl.X(r.h), Y0 = pl.Y(highF(r)); if (i) x.lineTo(X0, Y0); else x.moveTo(X0, Y0); });
        for (var i = rows.length - 1; i >= 0; i--) x.lineTo(pl.X(rows[i].h), pl.Y(lowF(rows[i])));
        x.closePath(); x.fillStyle = col; x.fill(); x.restore();
      };
      area(function () { return 0; }, function (r) { return r.use; }, f.a(c.b, 0.55));
      area(function (r) { return r.use; }, function (r) { return r.use + r.dis; }, f.a(c.a, 0.55));
      area(function (r) { return r.use + r.dis; }, function (r) { return r.D; }, f.a(c.d, 0.45));
      f.line(rows.map(function (r) { return [pl.X(r.h), pl.Y(r.S)]; }), c.b, 1.6, { dash: [4, 4] });
      f.line(rows.map(function (r) { return [pl.X(r.h), pl.Y(r.D)]; }), "#fff", 2.2, { glow: 8 });
      // time cursor and sun / moon
      var hc = f.reduce ? 13 : ((f.t * 1.6) % 24), r0 = rows[Math.round(hc / dt)];
      f.seg(pl.X(hc), pl.y0, pl.X(hc), pl.y0 + pl.h, f.a(c.ink, 0.5), 1, { dash: [3, 3] });
      var sy = pl.y0 - 14 + (hc > 6 && hc < 19 ? -sin(PI * (hc - 6) / 13) * 0 : 0);
      if (hc > 6.2 && hc < 18.8) f.circle(pl.X(hc), sy, 7, c.b, null, 0, { glow: 18, glowColor: c.b });
      else { f.circle(pl.X(hc), sy, 6, "#dfe8ff"); f.circle(pl.X(hc) + 3, sy - 2, 5.5, "#0b1712"); }
      // battery gauge
      var bx = pl.x0 + 10, by = pl.y0 + 8, bw = 54, bh = 18;
      if (cap > 0) {
        f.box(bx, by, bw, bh, 4, "rgba(0,0,0,.3)", f.a(c.ink, 0.6), 1.2);
        f.box(bx + bw, by + 5, 4, 8, 1, f.a(c.ink, 0.6));
        f.box(bx + 2, by + 2, (bw - 4) * r0.soc, bh - 4, 2, c.a, null, 0, { glow: 8 });
        f.text(Math.round(r0.soc * 100) + "%", bx + bw + 10, by + bh / 2, { size: 11, mono: true });
      }
      // legend & totals
      var ly = small ? pl.y0 + pl.h + 30 : f.h - 14, lx = 36;
      var leg = [["solar used", c.b], ["battery", c.a], ["generator / grid", c.d], ["demand", "#fff"]];
      leg.forEach(function (l, i) {
        var xx = small ? lx + (i % 2) * (f.w / 2 - 20) : lx + i * 120, yy = small ? ly + Math.floor(i / 2) * 16 : ly;
        f.box(xx, yy - 5, 10, 10, 2, l[1]); f.text(l[0], xx + 15, yy, { size: 11, color: c.ink });
      });
      var frac = eDem ? eSolar / eDem : 0;
      f.text("solar share " + Math.round(frac * 100) + " %  ·  generator " + eGen.toFixed(1) + " kWh/day", f.w - 16, small ? 22 : 22, { size: 12, mono: true, align: "right", color: frac > 0.6 ? c.a : c.ink });
    }
  });
})();
