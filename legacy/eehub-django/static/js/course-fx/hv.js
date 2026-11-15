/* course-fx: high voltage — Marx impulse generator with sparks (marx), insulator string voltage distribution (insulator). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;

  // a jagged discharge path between two points (midpoint displacement)
  function bolt(f, x1, y1, x2, y2, rough, rng, col, width, branches) {
    var pts = [[x1, y1], [x2, y2]];
    for (var it = 0; it < 6; it++) {
      var np = [pts[0]];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        var off = (rng() - 0.5) * L * rough;
        np.push([mx - dy / L * off, my + dx / L * off], b);
      }
      pts = np;
    }
    f.line(pts, col, width * 3, { alpha: 0.25, glow: 30 });
    f.line(pts, "#ffffff", width, { glow: 18 });
    if (branches) {
      for (var k = 0; k < branches; k++) {
        var p = pts[Math.floor(rng() * pts.length * 0.8)];
        var ang = Math.atan2(y2 - y1, x2 - x1) + (rng() - 0.5) * 2.2, len = Math.hypot(x2 - x1, y2 - y1) * (0.15 + rng() * 0.25);
        bolt(f, p[0], p[1], p[0] + cos(ang) * len, p[1] + sin(ang) * len, rough, rng, col, width * 0.5, 0);
      }
    }
    return pts;
  }
  FX.bolt = bolt;

  /* ================================================================== marx */
  FX.define("marx", {
    aspect: 1.75, aspectSmall: 0.78,
    controls: [{ key: "n", label: "Stages", min: 2, max: 8, step: 1, value: 5 }, { key: "fire", label: "Fire now", type: "button" }],
    init: function (f) { f.state.t0 = 0; f.state.lastFire = 0; },
    onChange: function (f, key) { if (key === "fire") f.state.t0 = f.t - 3.0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var n = hero ? 6 : (f.v.n || 5), cyc = 5.5;
      var tc = f.reduce && !f.playing ? 3.12 : ((f.t - s.t0) % cyc + cyc) % cyc;
      var charge = FX.clamp(tc / 2.9, 0, 1), firing = tc >= 3.0 && tc < 3.0 + 0.06 * n + 0.5, fired = tc >= 3.0;
      var kFire = fired ? Math.min(n, Math.floor((tc - 3.0) / 0.06) + 1) : 0;
      f.clear();
      var small = f.w / f.h < 1.2;
      var gx0 = small ? f.w * 0.1 : f.w * 0.06, gw = small ? f.w * 0.8 : f.w * (hero ? 0.62 : 0.48), gy0 = 26, gh = small ? f.h * 0.52 : f.h - 60;
      var sh = gh / n; // stage height
      var colC = c.a, wire = f.a(c.ink, 0.5);
      var leftX = gx0 + gw * 0.18, rightX = gx0 + gw * 0.62;
      // ground
      var gy = gy0 + gh;
      f.seg(gx0, gy, gx0 + gw, gy, wire, 2);
      for (var gk = 0; gk < 5; gk++) f.seg(gx0 + gw * 0.05 + gk * 10, gy + 3, gx0 + gw * 0.05 + gk * 10 - 6, gy + 9, wire, 1.2);
      // DC charging source
      if (!hero) f.text("DC charging supply", gx0, gy0 - 12, { size: 10.5, color: c.dim });
      var rng = FX.rng(Math.floor(f.t * 20) + 7);
      for (var i = 0; i < n; i++) {
        var yb = gy - i * sh, yt = yb - sh;
        var cx = leftX + (i % 2 ? gw * 0.08 : 0);
        // capacitor (vertical) between left rail node and right rail node of the stage
        var my = (yb + yt) / 2;
        var lvl = fired ? (i < kFire ? Math.max(0, 1 - (tc - 3.0) * 1.8) : charge) : charge;
        f.seg(leftX, yb, leftX, my + 6, wire, 1.6);
        f.seg(leftX, my - 6, leftX, yt + sh * 0.12, wire, 1.6);
        f.seg(leftX - 14, my + 6, leftX + 14, my + 6, colC, 2.6); f.seg(leftX - 14, my - 6, leftX + 14, my - 6, colC, 2.6);
        f.box(leftX - 13, my - 5, 26, 10, 1, f.a(c.b, 0.1 + 0.75 * lvl), null, 0, { glow: 14 * lvl, glowColor: c.b });
        // charging resistors on both rails (zig-zags)
        var zz = function (x, y1, y2) { var pts = [[x, y1]]; for (var z = 1; z < 8; z++) pts.push([x + (z % 2 ? 5 : -5), y1 + (y2 - y1) * z / 8]); pts.push([x, y2]); f.line(pts, wire, 1.2); };
        zz(rightX, yb, yt);
        // spark gap: from top of cap (left) to right rail of the next stage
        var gxm = (leftX + rightX) / 2, gyy = yt + sh * 0.12;
        f.seg(leftX, gyy, gxm - 10, gyy, wire, 1.6);
        f.seg(gxm + 10, gyy, rightX, gyy, wire, 1.6);
        f.circle(gxm - 8, gyy, 5, f.a(c.ink, 0.25), c.ink, 1.2); f.circle(gxm + 8, gyy, 5, f.a(c.ink, 0.25), c.ink, 1.2);
        if (firing && i < kFire) bolt(f, gxm - 4, gyy, gxm + 4, gyy, 0.9, rng, c.c, 1.4, 0);
        // stage voltage label
        if (!small && !hero) f.text((Math.round(lvl * 100)) + " kV", leftX - 22, my, { size: 10, mono: true, align: "right", color: c.dim });
        f.hit({ x: leftX - 16, y: my - 10, w: 32, h: 20 }, "Stage " + (i + 1) + " capacitor", "Charged in parallel to the stage voltage, then discharged in series when the gaps fire.");
        f.hit({ x: gxm - 14, y: gyy - 8, w: 28, h: 16 }, "Spark gap", "Breaks down when the voltage across it exceeds its setting, switching the stages into series.");
      }
      // output to test object: sphere gap / insulator
      var ox = gx0 + gw * 0.92, oy = gy0 + gh * 0.08;
      f.seg(rightX, gy - n * sh + sh * 0.12, ox, oy, wire, 1.6);
      f.circle(ox, oy + 14, 11, f.a(c.ink, 0.25), c.ink, 1.4);
      f.circle(ox, gy - 14, 11, f.a(c.ink, 0.25), c.ink, 1.4);
      f.seg(ox, gy - 3, ox, gy, wire, 1.6);
      f.hit({ x: ox - 14, y: oy, w: 28, h: gy - oy }, "Test gap", "Sphere gap or test object across the output.");
      if (firing && kFire >= n && tc < 3.0 + 0.06 * n + 0.35) {
        var r2 = FX.rng(Math.floor(f.t * 30) + 3);
        bolt(f, ox, oy + 25, ox, gy - 25, 0.55, r2, c.c, 2.4, hero ? 4 : 2);
        // flash
        f.ctx.save(); f.ctx.fillStyle = f.a(c.c, 0.08); f.ctx.fillRect(0, 0, f.w, f.h); f.ctx.restore();
      }
      if (hero) {
        f.text(n + " × 100 kV  →  " + Math.round(n * 100 * 0.92) + " kV impulse", gx0, 14, { size: 12, mono: true, color: c.ink });
        // small impulse inset
      }
      // impulse waveform
      var px0 = small ? 16 : (hero ? gx0 + gw + 20 : gx0 + gw + 30), py0 = small ? gy + 30 : 20, pw = small ? f.w - 32 : f.w - px0 - 16, ph = small ? f.h - gy - 44 : f.h - 50;
      if (pw < 80 || ph < 50) return;
      var Vp = n * 100 * 0.92;
      var pl = f.plot(px0, py0, pw, ph, [0, 100], [0, 1.15], { nx: 5, ny: 4, xl: "µs", yl: "output voltage" });
      var a = 1 / 68.2, b = 1 / 0.405, k0 = 1.037;
      var v = function (t) { return k0 * (Math.exp(-a * t) - Math.exp(-b * t)); };
      var show = fired ? Math.min(100, (tc - 3.0) * 160) : 0;
      f.curve(pl, v, 0, 100, 160, f.a(c.c, 0.18), 1.4, { dash: [4, 5] });
      if (show > 0) f.curve(pl, v, 0, show, 200, c.c, 2.6, { glow: 12 });
      f.seg(pl.X(0), pl.Y(0.5), pl.X(100), pl.Y(0.5), f.a(c.ink, 0.25), 1, { dash: [3, 4] });
      f.text("1.2 µs front", pl.X(4), pl.Y(1.08), { size: 10.5, color: c.b });
      f.text("50 µs to half value", pl.X(50), pl.Y(0.42), { size: 10.5, color: c.b, align: "center" });
      f.text("peak ≈ " + Math.round(Vp) + " kV", pl.x0 + pl.w - 44, pl.y0 + 34, { size: 12, mono: true, align: "right" });
      if (!fired) f.text("charging… " + Math.round(charge * 100) + " %", pl.x0 + pl.w / 2, pl.y0 + pl.h * 0.78, { size: 12, align: "center", color: c.ink });
    }
  });

  /* ============================================================= insulator */
  function distribution(n, m, ring) {
    // node voltages V0 (cross-arm, 0) ... Vn (line, 1); shunt capacitance m*C to the tower at each node;
    // a grading ring adds capacitance from the line to each node, roughly cancelling the shunt current.
    var A = [], B = [], C = [], R = [], k;
    var g = ring ? m * 0.9 : 0;
    for (k = 1; k < n; k++) {
      var gk = g * k / n;
      A.push(-1); B.push(2 + m + gk); C.push(-1); R.push(gk);
    }
    R[n - 2] += 1; // the line node is at 1
    // Thomas algorithm
    var N = n - 1, cp = [], dp = [], x = new Array(N);
    for (k = 0; k < N; k++) {
      var den = B[k] - (k ? A[k] * cp[k - 1] : 0);
      cp[k] = C[k] / den; dp[k] = (R[k] - (k ? A[k] * dp[k - 1] : 0)) / den;
    }
    for (k = N - 1; k >= 0; k--) x[k] = dp[k] - (k < N - 1 ? cp[k] * x[k + 1] : 0);
    var V = [0].concat(x, [1]), disc = [];
    for (k = 1; k <= n; k++) disc.push(V[k] - V[k - 1]);
    return disc; // from the cross-arm (top) to the line (bottom)
  }
  FX.define("insulator", {
    aspect: 1.6, aspectSmall: 0.8,
    controls: [
      { key: "m", label: "Stray / disc capacitance m", min: 0, max: 0.3, step: 0.01, value: 0.12, fmt: function (v) { return v.toFixed(2); } },
      { key: "n", label: "Discs", min: 3, max: 12, step: 1, value: 8 },
      { key: "ring", label: "Grading ring", type: "toggle", value: false }
    ],
    draw: function (f) {
      var c = f.c, hero = f.mode === "hero";
      var m = f.v.m == null ? 0.12 : f.v.m, n = f.v.n || 8, ring = !!f.v.ring;
      var d = distribution(n, m, ring), mx = Math.max.apply(null, d), eff = 1 / (n * mx);
      f.clear();
      var small = f.w / f.h < 1.15;
      var sx = small ? f.w * 0.3 : f.w * 0.28, top = 30, bottom = f.h - 46, step = (bottom - top - 30) / n;
      // tower and cross-arm
      f.line([[sx - 90, top], [sx + 40, top]], f.a(c.ink, 0.6), 4);
      f.line([[sx - 90, top], [sx - 90, f.h]], f.a(c.ink, 0.35), 3);
      f.text("tower (earthed)", sx - 84, top + 16, { size: 10, color: c.dim });
      var ac = f.reduce ? 1 : Math.abs(sin(f.t * 3));
      for (var k = 0; k < n; k++) {
        var y = top + 14 + step * k + step / 2, share = d[k] / (1 / n);
        var col = share > 1.35 ? c.d : share > 1.12 ? c.b : c.a;
        var rw = Math.min(46, step * 1.8);
        f.ctx.save();
        f.ctx.beginPath(); f.ctx.ellipse(sx, y, rw, Math.max(4, step * 0.22), 0, 0, TAU);
        f.ctx.fillStyle = f.a(col, 0.18); f.ctx.fill(); f.ctx.strokeStyle = f.a(col, 0.9); f.ctx.lineWidth = 1.6; f.ctx.stroke();
        f.ctx.restore();
        f.seg(sx, y - step / 2, sx, y - step * 0.2, f.a(c.ink, 0.6), 2);
        f.seg(sx, y + step * 0.2, sx, y + step / 2, f.a(c.ink, 0.6), 2);
        // bar chart of the share
        var bx = small ? f.w * 0.55 : f.w * 0.5, bw = (f.w - bx - 70) * Math.min(1, d[k] * n / 2.2);
        f.box(bx, y - step * 0.28, Math.max(2, bw), step * 0.56, 3, f.a(col, 0.75), null, 0, { glow: share > 1.35 ? 10 : 0, glowColor: col });
        f.text((d[k] * 100).toFixed(1) + " %", bx + bw + 8, y, { size: 10.5, mono: true, color: c.ink });
        f.hit({ x: sx - rw, y: y - step / 2, w: rw * 2, h: step }, "Disc " + (k + 1) + (k === n - 1 ? " (next to the line)" : k === 0 ? " (at the cross-arm)" : ""), "Carries " + (d[k] * 100).toFixed(1) + " % of the phase voltage.");
      }
      // conductor
      var cy = top + 14 + step * n + 8;
      f.line([[sx - 60, cy], [sx + 70, cy]], c.c, 5, { glow: 10 });
      f.text("line conductor", sx + 74, cy, { size: 10.5, color: c.c });
      if (ring) { f.ctx.save(); f.ctx.beginPath(); f.ctx.ellipse(sx, cy - step * 0.6, 58, 10, 0, 0, TAU); f.ctx.strokeStyle = f.a(c.b, 0.9); f.ctx.lineWidth = 3; f.ctx.stroke(); f.ctx.restore(); }
      // corona at the most stressed disc when the share is high
      var worst = d[n - 1] * n;
      if (worst > 1.3 && !ring) {
        var gl = (worst - 1.3) * ac;
        f.circle(sx, cy - step * 0.4, 30 + 20 * gl, f.a("#b6a8ff", 0.10 + 0.25 * gl), null, 0, { glow: 30, glowColor: "#b6a8ff" });
        var r = FX.rng(Math.floor(f.t * 25) + 1);
        for (var p = 0; p < 10; p++) { var a = r() * TAU, rr = 18 + r() * 26; f.circle(sx + cos(a) * rr, cy - step * 0.4 + sin(a) * rr * 0.6, 1.4, "#e6e0ff", null, 0, { glow: 8, glowColor: "#b6a8ff" }); }
        if (!hero) f.text("corona", sx - 64, cy - step * 0.9, { size: 10.5, color: "#c9bfff", weight: 700 });
      }
      if (hero) return;
      f.text("string efficiency η = " + (eff * 100).toFixed(1) + " %", f.w - 50, 18, { size: 12, mono: true, align: "right", color: eff < 0.75 ? c.d : c.a, weight: 700 });
      f.text("share of the phase voltage per disc", small ? f.w * 0.55 : f.w * 0.5, f.h - 18, { size: 10.5, color: c.dim });
    }
  });
})();
