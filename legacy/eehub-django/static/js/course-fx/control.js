/* course-fx: control — PID loop with live step response (pid), Bode plot with margins (bode),
   root locus (rootlocus), phase portrait with a limit cycle (phase). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;

  /* =================================================================== pid */
  function simulate(Kp, Ki, Kd, sampled) {
    var dt = 0.01, T = 12, n = Math.round(T / dt), x1 = 0, x2 = 0, x3 = 0, I = 0, y = [], u = [], uh = 0, Ts = 0.3, next = 0, ePrev = 1;
    for (var k = 0; k <= n; k++) {
      var t = k * dt, e = 1 - x3, dy = (x2 - x3) / 0.2;
      var uc = Kp * e + Ki * I + Kd * (-dy);
      if (sampled) { if (t >= next - 1e-9) { uh = uc; next += Ts; } } else uh = uc;
      var uu = FX.clamp(uh, -25, 25);
      y.push(x3); u.push(uu);
      I += e * dt;
      x1 += dt * (uu - x1); x2 += dt * (x1 - x2) / 0.5; x3 += dt * (x2 - x3) / 0.2;
      if (!isFinite(x3) || Math.abs(x3) > 50) { x3 = FX.clamp(x3, -50, 50); }
      ePrev = e;
    }
    // metrics
    var peak = Math.max.apply(null, y), final = y[y.length - 1], ts = null;
    for (var j = y.length - 1; j >= 0; j--) { if (Math.abs(y[j] - final) > 0.02 * Math.max(0.05, Math.abs(final))) { ts = (j + 1) * dt; break; } }
    return { y: y, u: u, dt: dt, T: T, peak: peak, final: final, ts: ts };
  }
  var PRESETS = [[1.2, 0, 0, "P only"], [1.2, 0.6, 0, "PI"], [2.4, 1.0, 0.6, "PID"]];
  FX.define("pid", {
    aspect: 1.6, aspectSmall: 0.75,
    controls: [
      { key: "kp", label: "K_p", min: 0, max: 8, step: 0.1, value: 2.0, fmt: function (v) { return v.toFixed(1); } },
      { key: "ki", label: "K_i", min: 0, max: 3, step: 0.05, value: 0.8, fmt: function (v) { return v.toFixed(2); } },
      { key: "kd", label: "K_d", min: 0, max: 2, step: 0.05, value: 0.4, fmt: function (v) { return v.toFixed(2); } }
    ],
    init: function (f) { f.state.key = ""; f.state.prev = null; f.state.t0 = 0; },
    onChange: function (f) { f.state.t0 = f.t; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var kp, ki, kd, label = "";
      if (hero) { var pi = Math.floor(f.t / 5) % 3; kp = PRESETS[pi][0]; ki = PRESETS[pi][1]; kd = PRESETS[pi][2]; label = PRESETS[pi][3]; if (s.pi !== pi) { s.pi = pi; s.t0 = f.t; } }
      else { kp = f.v.kp == null ? 2 : f.v.kp; ki = f.v.ki == null ? 0.8 : f.v.ki; kd = f.v.kd == null ? 0.4 : f.v.kd; }
      var key = [kp, ki, kd].join(",");
      if (s.key !== key) { s.prev = s.sim; s.sim = simulate(kp, ki, kd, !!f.opts.sampled); s.key = key; }
      var sim = s.sim;
      f.clear();
      var small = f.w / f.h < 1.15;
      // block diagram
      var by = 30, bh = small ? 30 : 36, W = f.w - 40, x0 = 20;
      var items = [["r", 0.0, 0], ["Σ", 0.13, 1], ["PID", 0.3, 2], ["Plant G(s)", 0.58, 2], ["y", 0.95, 0]];
      var pos = items.map(function (it) { return x0 + it[1] * W; });
      var bw = small ? W * 0.2 : W * 0.17;
      var flow = f.reduce ? 0 : f.t * 0.7;
      var wirePts = [[pos[0] + 10, by], [pos[1] - 9, by]], w2 = [[pos[1] + 9, by], [pos[2], by]], w3 = [[pos[2] + bw, by], [pos[3], by]], w4 = [[pos[3] + bw, by], [pos[4] - 8, by]];
      [wirePts, w2, w3, w4].forEach(function (p, i) { f.line(p, f.a(c.ink, 0.45), 1.6); FX.flowDots && FX.flowDots(f, p, flow + i * 0.2, 3, i === 2 ? c.b : c.a, 2.2); });
      var fb = [[pos[3] + bw + (pos[4] - 8 - pos[3] - bw) / 2, by], [pos[3] + bw + (pos[4] - 8 - pos[3] - bw) / 2, by + bh / 2 + 20], [pos[1], by + bh / 2 + 20], [pos[1], by + 9]];
      f.line(fb, f.a(c.c, 0.7), 1.5, { dash: [5, 4] });
      if (FX.flowDots) FX.flowDots(f, fb, flow, 4, c.c, 2);
      f.circle(pos[1], by, 9, "rgba(0,0,0,.3)", c.ink, 1.4); f.text("Σ", pos[1], by + 0.5, { size: 11, align: "center", weight: 700 });
      f.text("−", pos[1] - 13, by + 14, { size: 12, color: c.c }); f.text("r", pos[0], by, { size: 13, weight: 800, color: c.b });
      f.text("y", pos[4], by, { size: 13, weight: 800, color: c.a });
      f.box(pos[2], by - bh / 2, bw, bh, 9, f.a(c.b, 0.12), f.a(c.b, 0.7), 1.3, { glow: 8, glowColor: c.b });
      f.text(hero ? label : bw < 150 ? "PID" : "K_p + K_i/s + K_d s", pos[2] + bw / 2, by, { size: small ? 10 : 11, weight: 700, align: "center", mono: !hero && bw >= 150 });
      f.box(pos[3], by - bh / 2, bw, bh, 9, f.a(c.a, 0.12), f.a(c.a, 0.7), 1.3);
      f.text(bw < 200 ? "Plant G(s)" : "1/((s+1)(0.5s+1)(0.2s+1))", pos[3] + bw / 2, by, { size: bw < 200 ? 11 : 9.5, align: "center", mono: bw >= 200, weight: 700 });
      f.hit({ x: pos[2], y: by - bh / 2, w: bw, h: bh }, "Controller", "u = K_p e + K_i ∫e dt + K_d de/dt");
      f.hit({ x: pos[3], y: by - bh / 2, w: bw, h: bh }, "Plant", "Three first-order lags in series — like a motor, its drive and a sensor.");
      // step response
      var py = by + bh / 2 + 40, ph = f.h - py - (hero ? 12 : 40);
      var ymax = Math.max(1.6, Math.min(3, sim.peak * 1.1));
      var pl = f.plot(x0, py, W, ph, [0, sim.T], [-0.1, ymax], { nx: 12, ny: 4, xl: "time (s)", yl: "step response y(t)" });
      f.seg(pl.X(0), pl.Y(1), pl.X(sim.T), pl.Y(1), f.a(c.b, 0.7), 1.2, { dash: [6, 4] });
      f.ctx.save(); f.ctx.fillStyle = f.a(c.a, 0.06); f.ctx.fillRect(pl.X(0), pl.Y(1.02), pl.w, pl.Y(0.98) - pl.Y(1.02)); f.ctx.restore();
      if (s.prev && !hero) f.line(s.prev.y.map(function (v, i) { return [pl.X(i * s.prev.dt), pl.Y(FX.clamp(v, -0.1, ymax))]; }).filter(function (_, i) { return i % 3 === 0; }), f.a(c.ink, 0.18), 1.4);
      var prog = f.reduce ? 1 : FX.clamp((f.t - s.t0) / 2.6, 0, 1);
      var nShow = Math.max(2, Math.round(sim.y.length * prog));
      var pts = []; for (var i = 0; i < nShow; i += 2) pts.push([pl.X(i * sim.dt), pl.Y(FX.clamp(sim.y[i], -0.1, ymax))]);
      f.line(pts, c.a, 2.6, { glow: 12 });
      if (f.opts.sampled) {
        var up = []; for (var j = 0; j < nShow; j += 2) up.push([pl.X(j * sim.dt), pl.Y(FX.clamp(sim.u[j] / 4, -0.1, ymax))]);
        f.line(up, f.a(c.c, 0.75), 1.4);
        f.text("u(t)/4 held between samples", pl.x0 + 10, pl.y0 + pl.h - 12, { size: 10.5, color: c.c });
      }
      var last = pts[pts.length - 1]; if (last) f.circle(last[0], last[1], 4.5, "#fff", null, 0, { glow: 12, glowColor: c.a });
      if (hero) return;
      var os = Math.max(0, (sim.peak - 1) * 100), ess = (1 - sim.final) * 100;
      var unstable = !isFinite(sim.final) || Math.abs(sim.final) > 5 || (sim.ts && sim.ts > sim.T * 0.98 && os > 60);
      var txt = unstable ? "unstable / oscillating" : "overshoot " + os.toFixed(0) + " %  ·  settling " + (sim.ts ? sim.ts.toFixed(1) + " s" : "—") + "  ·  error " + ess.toFixed(1) + " %";
      f.text(txt, pl.x0 + pl.w - 10, pl.y0 + 14, { size: 11.5, mono: true, align: "right", color: unstable ? c.d : c.ink });
    }
  });

  /* ================================================================== bode */
  function cabs(re, im) { return Math.hypot(re, im); }
  FX.define("bode", {
    aspect: 1.6, aspectSmall: 0.75,
    controls: function (o) {
      if (o.variant === "second") return [{ key: "z", label: "Damping ratio ζ", min: 0.05, max: 1.2, step: 0.01, value: 0.3, fmt: function (v) { return v.toFixed(2); } }];
      return [{ key: "K", label: "Loop gain K", min: 0.5, max: 20, step: 0.1, value: 3, fmt: function (v) { return v.toFixed(1); } }];
    },
    draw: function (f) {
      var c = f.c, second = f.opts.variant === "second" || !!f.opts.second;
      var K = f.v.K == null ? 3 : f.v.K, z = f.v.z == null ? 0.3 : f.v.z;
      if (f.mode === "hero") { K = 3 + 2.5 * sin(f.t * 0.4); z = 0.35 + 0.25 * sin(f.t * 0.4); }
      // L(jw)
      var L = function (w) {
        if (second) { var re = 1 - w * w, im = 2 * z * w, d = re * re + im * im; return [re / d, -im / d]; }
        // K / (jw (jw+1)(0.2jw+1))
        var ar = 0, ai = w; // jw
        var br = 1, bi = w;
        var cr = 1, ci = 0.2 * w;
        var pr = ar * br - ai * bi, pi2 = ar * bi + ai * br;
        var qr = pr * cr - pi2 * ci, qi = pr * ci + pi2 * cr, dd = qr * qr + qi * qi;
        return [K * qr / dd, -K * qi / dd];
      };
      f.clear();
      var w0 = -2, w1 = 2;
      var h = (f.h - 46) / 2;
      var pm = f.plot(36, 14, f.w - 52, h, [w0, w1], second ? [-40, 25] : [-60, 50], { nx: 8, ny: 4, yl: "|L(jω)| dB" });
      var pp = f.plot(36, 14 + h + 14, f.w - 52, h, [w0, w1], [-270, 0], { nx: 8, ny: 3, yl: "phase (°)", xl: "log₁₀ ω" });
      var mag = function (lw) { var v = L(Math.pow(10, lw)); return 20 * Math.log10(cabs(v[0], v[1])); };
      var phs = function (lw) { var v = L(Math.pow(10, lw)); var a = Math.atan2(v[1], v[0]) * 180 / PI; if (a > 0) a -= 360; return a; };
      var sweep = f.reduce ? w1 : Math.min(w1, w0 + ((f.t * 1.2) % 5.5));
      f.curve(pm, mag, w0, w1, 200, f.a(c.a, 0.25), 1.2);
      f.curve(pp, phs, w0, w1, 200, f.a(c.b, 0.25), 1.2);
      f.curve(pm, mag, w0, sweep, 200, c.a, 2.6, { glow: 10 });
      f.curve(pp, phs, w0, sweep, 200, c.b, 2.6, { glow: 10 });
      f.seg(pm.X(w0), pm.Y(0), pm.X(w1), pm.Y(0), f.a(c.ink, 0.4), 1, { dash: [4, 4] });
      f.seg(pp.X(w0), pp.Y(-180), pp.X(w1), pp.Y(-180), f.a(c.ink, 0.4), 1, { dash: [4, 4] });
      f.text("0 dB", pm.X(w0) + 4, pm.Y(0) - 8, { size: 10, color: c.dim }); f.text("−180°", pp.X(w0) + 4, pp.Y(-180) - 8, { size: 10, color: c.dim });
      if (second) {
        var peak = -999, wpk = 0; for (var i = 0; i <= 300; i++) { var lw = w0 + (w1 - w0) * i / 300, m = mag(lw); if (m > peak) { peak = m; wpk = lw; } }
        f.circle(pm.X(wpk), pm.Y(peak), 5, "#fff", null, 0, { glow: 12, glowColor: c.a });
        f.text("resonant peak " + peak.toFixed(1) + " dB", pm.x0 + pm.w - 46, pm.y0 + 14, { size: 12, mono: true, align: "right" });
        return;
      }
      // margins: gain crossover and phase crossover
      var wc = null, wpc = null, prevM = mag(w0), prevP = phs(w0);
      for (var j = 1; j <= 600; j++) {
        var lw2 = w0 + (w1 - w0) * j / 600, m2 = mag(lw2), p2 = phs(lw2);
        if (wc === null && prevM > 0 && m2 <= 0) wc = lw2;
        if (wpc === null && prevP > -180 && p2 <= -180) wpc = lw2;
        prevM = m2; prevP = p2;
      }
      var PM = wc !== null ? 180 + phs(wc) : null, GM = wpc !== null ? -mag(wpc) : null;
      if (wc !== null) {
        f.seg(pm.X(wc), pm.Y(0), pp.X(wc), pp.Y(phs(wc)), f.a(c.c, 0.6), 1, { dash: [3, 3] });
        f.arrow(pp.X(wc), pp.Y(-180), pp.X(wc), pp.Y(phs(wc)), PM > 0 ? c.c : c.d, 2.2, { head: 7 });
        f.text("PM " + PM.toFixed(0) + "°", pp.X(wc) + 6, pp.Y((phs(wc) - 180) / 2), { size: 11, weight: 700, color: PM > 0 ? c.c : c.d });
      }
      if (wpc !== null) {
        f.arrow(pm.X(wpc), pm.Y(mag(wpc)), pm.X(wpc), pm.Y(0), GM > 0 ? c.c : c.d, 2.2, { head: 7 });
        f.text("GM " + GM.toFixed(1) + " dB", pm.X(wpc) + 6, pm.Y(mag(wpc) / 2), { size: 11, weight: 700, color: GM > 0 ? c.c : c.d });
      }
      var stable = (PM === null || PM > 0) && (GM === null || GM > 0);
      f.text("L(s) = K / [s(s+1)(0.2s+1)]   " + (stable ? "stable" : "UNSTABLE"), pm.x0 + pm.w - 46, pm.y0 + 14, { size: 11.5, mono: true, align: "right", color: stable ? c.ink : c.d });
    }
  });

  /* ============================================================= rootlocus */
  function cubicRoots(a2, a1, a0) { // roots of s^3 + a2 s^2 + a1 s + a0 (Durand–Kerner)
    var r = [[0.4, 0.9], [-0.65, 0.72], [-1.3, -0.5]];
    function f(z) { var x = z[0], y = z[1];
      var z2 = [x * x - y * y, 2 * x * y], z3 = [z2[0] * x - z2[1] * y, z2[0] * y + z2[1] * x];
      return [z3[0] + a2 * z2[0] + a1 * x + a0, z3[1] + a2 * z2[1] + a1 * y]; }
    for (var it = 0; it < 80; it++) {
      for (var i = 0; i < 3; i++) {
        var num = f(r[i]), den = [1, 0];
        for (var j = 0; j < 3; j++) if (j !== i) { var d = [r[i][0] - r[j][0], r[i][1] - r[j][1]]; den = [den[0] * d[0] - den[1] * d[1], den[0] * d[1] + den[1] * d[0]]; }
        var dd = den[0] * den[0] + den[1] * den[1] || 1e-12;
        r[i] = [r[i][0] - (num[0] * den[0] + num[1] * den[1]) / dd, r[i][1] - (num[1] * den[0] - num[0] * den[1]) / dd];
      }
    }
    return r;
  }
  FX.define("rootlocus", {
    aspect: 1.6, aspectSmall: 0.85,
    controls: [{ key: "K", label: "Gain K", min: 0, max: 120, step: 1, value: 20 }],
    init: function (f) {
      var br = [[], [], []];
      for (var k = 0; k <= 200; k++) {
        var K = Math.pow(k / 200, 2) * 200, rr = cubicRoots(6, 8, K);
        rr.sort(function (a, b) { return a[1] - b[1]; });
        for (var i = 0; i < 3; i++) br[i].push(rr[i]);
      }
      f.state.br = br;
    },
    draw: function (f) {
      var c = f.c, K = f.mode === "hero" ? 60 + 55 * sin(f.t * 0.45) : (f.v.K == null ? 20 : f.v.K);
      if (f.mode !== "hero" && !f.reduce && f.playing) K = K; // the slider sets K; the poles pulse to show motion
      f.clear();
      var ar = f.w / f.h, yr = 6, xr = [-7, 3];
      var pl = f.plot(16, 14, f.w - 32, f.h - 30, [xr[0], xr[1]], [-yr, yr], { nx: 10, ny: 6, xl: "σ (real)", yl: "jω (imaginary)" });
      // keep aspect roughly equal
      f.ctx.save(); f.ctx.fillStyle = f.a(c.d, 0.06); f.ctx.fillRect(pl.X(0), pl.y0, pl.x0 + pl.w - pl.X(0), pl.h); f.ctx.restore();
      f.seg(pl.X(0), pl.y0, pl.X(0), pl.y0 + pl.h, f.a(c.ink, 0.5), 1.2);
      f.text("unstable", pl.X(0) + 8, pl.y0 + 14, { size: 10.5, color: c.d });
      var cols = [c.a, c.b, c.c];
      f.state.br.forEach(function (b, i) { f.line(b.map(function (p) { return [pl.X(p[0]), pl.Y(p[1])]; }).filter(function (p) { return p[0] > pl.x0 - 2 && p[0] < pl.x0 + pl.w + 2 && p[1] > pl.y0 - 2 && p[1] < pl.y0 + pl.h + 2; }), f.a(cols[i], 0.85), 2.2, { glow: 8 }); });
      [0, -2, -4].forEach(function (p) { var x = pl.X(p), y = pl.Y(0); f.seg(x - 6, y - 6, x + 6, y + 6, "#fff", 2); f.seg(x - 6, y + 6, x + 6, y - 6, "#fff", 2); });
      var rr = cubicRoots(6, 8, K);
      var stable = rr.every(function (r) { return r[0] < 0; });
      rr.forEach(function (r) { f.circle(pl.X(r[0]), pl.Y(r[1]), 6, stable ? c.a : c.d, "#fff", 1.5, { glow: 14, glowColor: stable ? c.a : c.d }); });
      f.circle(pl.X(0), pl.Y(Math.sqrt(8)), 3, null, "#fff", 1.2); f.circle(pl.X(0), pl.Y(-Math.sqrt(8)), 3, null, "#fff", 1.2);
      f.text("K = 48, ω = 2.83", pl.X(0) + 8, pl.Y(Math.sqrt(8)) - 10, { size: 10, color: c.dim });
      f.text("K = " + Math.round(K) + (stable ? "  stable" : "  UNSTABLE"), pl.x0 + 12, pl.y0 + 34, { size: 12.5, mono: true, weight: 700, color: stable ? c.a : c.d });
      f.text("× open-loop poles 0, −2, −4", pl.x0 + 12, pl.y0 + 52, { size: 10.5, color: c.dim });
    }
  });

  /* ================================================================= phase */
  FX.define("phase", {
    aspect: 1.6, aspectSmall: 0.9,
    controls: [{ key: "mu", label: "Damping parameter μ", min: -1, max: 2.5, step: 0.05, value: 1.0, fmt: function (v) { return v.toFixed(2); } }],
    init: function (f) {
      var r = FX.rng(4), p = [];
      for (var i = 0; i < 140; i++) p.push({ x: (r() - 0.5) * 7, y: (r() - 0.5) * 7, age: r() * 6, trail: [] });
      f.state.p = p; f.state.r = r;
    },
    draw: function (f) {
      var c = f.c, s = f.state, mu = f.mode === "hero" ? 1.2 : (f.v.mu == null ? 1 : f.v.mu);
      var F = function (x, y) { return [y, mu * (1 - x * x) * y - x]; };
      f.clear();
      var pl = f.plot(14, 14, f.w - 28, f.h - 28, [-4, 4], [-4.5 * (f.h - 28) / (f.w - 28) * 2, 4.5 * (f.h - 28) / (f.w - 28) * 2], { nx: 8, ny: 6, xl: "x", yl: "ẋ" });
      var yr = 4.5 * (f.h - 28) / (f.w - 28) * 2;
      // vector field
      for (var gx = -3.75; gx <= 3.8; gx += 0.5) for (var gy = -yr + 0.4; gy < yr; gy += yr / 6) {
        var v = F(gx, gy), m = Math.hypot(v[0], v[1]) || 1, L = 9;
        f.seg(pl.X(gx), pl.Y(gy), pl.X(gx) + v[0] / m * L, pl.Y(gy) - v[1] / m * L, f.a(c.ink, 0.12), 1);
      }
      // particles
      var dt = f.reduce && !f.playing ? 0 : Math.min(0.03, f.dt || 0);
      var steps = f.reduce && !f.playing ? 0 : 3;
      s.p.forEach(function (p) {
        for (var k = 0; k < steps; k++) { var v1 = F(p.x, p.y); p.x += v1[0] * dt; p.y += v1[1] * dt; }
        p.age += f.dt || 0;
        p.trail.push([p.x, p.y]); if (p.trail.length > 26) p.trail.shift();
        if (p.age > 7 || Math.abs(p.x) > 6 || Math.abs(p.y) > 9) { p.x = (s.r() - 0.5) * 7; p.y = (s.r() - 0.5) * 2 * yr; p.age = 0; p.trail = []; }
        if (p.trail.length > 1) f.line(p.trail.map(function (q) { return [pl.X(q[0]), pl.Y(q[1])]; }), f.a(c.a, 0.45), 1.3);
        f.circle(pl.X(p.x), pl.Y(p.y), 1.8, c.a);
      });
      // limit cycle (integrate a long trajectory) for mu > 0
      if (mu > 0.02) {
        var x = 2, y = 0, pts = [];
        for (var i = 0; i < 4000; i++) { var a = F(x, y); x += a[0] * 0.005; y += a[1] * 0.005; }
        for (var j = 0; j < 2600; j++) { var b = F(x, y); x += b[0] * 0.005; y += b[1] * 0.005; pts.push([pl.X(x), pl.Y(y)]); }
        f.line(pts, c.b, 2.6, { glow: 14 });
        f.text("limit cycle", pl.X(2.1), pl.Y(0.4), { size: 11, color: c.b, weight: 700 });
      } else {
        f.circle(pl.X(0), pl.Y(0), 6, c.b, null, 0, { glow: 14 });
        f.text("stable equilibrium", pl.X(0) + 10, pl.Y(0) - 12, { size: 11, color: c.b, weight: 700 });
      }
      f.text("ẍ − μ(1 − x²)ẋ + x = 0   (Van der Pol)", pl.x0 + 10, pl.y0 + 14, { size: 11.5, mono: true });
    }
  });
})();
