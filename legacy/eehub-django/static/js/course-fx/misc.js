/* course-fx: reliability bathtub curve with a failing population (bathtub), project Gantt chart with critical path (gantt). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;

  /* ================================================================ bathtub */
  FX.define("bathtub", {
    aspect: 1.75, aspectSmall: 0.8,
    controls: function (o) {
      return [
        { key: "beta", label: "Wear-out shape β", min: 1.5, max: 8, step: 0.1, value: 4, fmt: function (v) { return v.toFixed(1); } },
        { key: "burn", label: "Burn-in", type: "toggle", value: false }
      ];
    },
    init: function (f) { var r = FX.rng(21), u = []; for (var i = 0; i < 64; i++) u.push({ th: r(), dead: -1 }); f.state.units = u; f.state.cyc = -1; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero", energy = f.opts.variant === "energy";
      var beta = hero ? 4 : (f.v.beta || 4), burn = !hero && !!f.v.burn;
      var Tlife = 10; // normalised life
      var lam = function (t) {
        var early = burn ? 0 : 0.9 * Math.exp(-t / 0.55);
        var rnd = 0.06;
        var wear = beta / 8 * Math.pow(t / 8, beta - 1);
        return early + rnd + wear;
      };
      // cumulative hazard for R(t)
      var H = function (t) { var n = 80, h = 0, dt = t / n; for (var i = 0; i < n; i++) h += lam((i + 0.5) * dt) * dt; return h; };
      var cyc = f.reduce ? 0 : Math.floor(f.t / 12), tc = f.reduce ? 6.5 : (f.t % 12) / 12 * Tlife;
      if (cyc !== s.cyc) { s.cyc = cyc; s.units.forEach(function (u) { u.dead = -1; }); }
      f.clear();
      var small = f.w / f.h < 1.2;
      var pw = small ? f.w - 32 : f.w * 0.64;
      var h1 = small ? f.h * 0.34 : (f.h - 48) * 0.58, h2 = small ? f.h * 0.2 : (f.h - 48) * 0.42 - 12;
      var p1 = f.plot(36, 16, pw - 20, h1, [0, Tlife], [0, 1.2], { nx: 10, ny: 4, yl: "failure rate λ(t)" });
      var p2 = f.plot(36, 16 + h1 + 14, pw - 20, h2, [0, Tlife], [0, 1.05], { nx: 10, ny: 2, yl: "reliability R(t)", xl: energy ? "years" : "operating life" });
      // regions
      var GOOD = "#3dd68c", WARN = "#f6c445";
      var reg = [[0, 1.4, "early failures", c.d], [1.4, 6.4, "useful life: random failures", GOOD], [6.4, Tlife, "wear-out", WARN]];
      reg.forEach(function (r) {
        f.ctx.save(); f.ctx.fillStyle = f.a(r[3], 0.07); f.ctx.fillRect(p1.X(r[0]), p1.y0, p1.X(r[1]) - p1.X(r[0]), p1.h); f.ctx.restore();
        if (!(burn && r[0] === 0)) f.text(r[2], (p1.X(r[0]) + p1.X(r[1])) / 2, p1.y0 + 30, { size: small ? 9 : 10.5, align: "center", color: r[3] });
      });
      f.curve(p1, function (t) { return Math.min(1.19, lam(t)); }, 0.02, Tlife, 240, c.d, 2.6, { glow: 10 });
      f.curve(p2, function (t) { return Math.exp(-H(t)); }, 0.02, Tlife, 120, GOOD, 2.4, { glow: 8 });
      f.seg(p1.X(tc), p1.y0, p1.X(tc), p2.y0 + p2.h, f.a(c.ink, 0.5), 1, { dash: [3, 3] });
      f.circle(p1.X(tc), p1.Y(Math.min(1.19, lam(tc))), 5, "#fff", null, 0, { glow: 12, glowColor: c.d });
      var Rt = Math.exp(-H(tc));
      f.circle(p2.X(tc), p2.Y(Rt), 4.5, "#fff", null, 0, { glow: 12, glowColor: GOOD });
      // population
      var alive = 0;
      s.units.forEach(function (u) { if (u.dead < 0 && (1 - Rt) > u.th) u.dead = f.t; if (u.dead < 0) alive++; });
      var gx = small ? 20 : pw + 30, gy = small ? 16 + h1 + 14 + h2 + 30 : 30, gw = small ? f.w - 40 : f.w - pw - 46, cols = 8, cell = Math.min(gw / cols, small ? (f.h - gy - 10) / 8 : 26);
      if (!small) f.text("64 units in service", gx, gy - 12, { size: 11, weight: 700 });
      s.units.forEach(function (u, i) {
        var x = gx + (i % cols) * cell + cell / 2, y = gy + Math.floor(i / cols) * cell + cell / 2;
        var dead = u.dead >= 0, age = dead ? f.t - u.dead : 0;
        if (dead) { f.circle(x, y + Math.min(3, age * 6), cell * 0.26, f.a(c.d, 0.3), f.a(c.d, 0.8), 1.2); f.seg(x - cell * 0.12, y - cell * 0.12 + Math.min(3, age * 6), x + cell * 0.12, y + cell * 0.12 + Math.min(3, age * 6), c.d, 1.4); }
        else f.circle(x, y, cell * 0.3, GOOD, null, 0, { glow: 6, glowColor: GOOD });
        if (dead && age < 0.5) f.circle(x, y, cell * 0.3 + age * 20, null, f.a(c.d, 1 - age * 2), 1.5);
      });
      if (!small) f.text(alive + " working · R ≈ " + (Rt * 100).toFixed(0) + " %", gx, gy + 8 * cell + 16, { size: 11.5, mono: true, color: c.ink });
    }
  });

  /* ================================================================== gantt */
  var PLANS = {
    "default": { unit: "week", span: 16, tasks: [
      ["Site survey", 0, 2, 1], ["Design & approval", 2, 5, 1], ["Procure transformer", 5, 11, 1], ["Civil works", 5, 9, 0, 2],
      ["Line works", 7, 12, 0, 1], ["Install & connect", 11, 13, 1], ["Testing", 13, 15, 1], ["Commissioning", 15, 15, 1, 0, true]] },
    siwes: { unit: "week", span: 24, tasks: [
      ["Orientation & ITF forms", 0, 1, 1], ["Acceptance letter", 0, 2, 0, 1], ["Placement in industry", 2, 22, 1], ["Supervisor visit", 11, 11, 0, 0, true],
      ["Weekly logbook sign-off", 2, 22, 0], ["Technical report", 19, 23, 1], ["Seminar", 24, 24, 1, 0, true]] },
    project: { unit: "week", span: 28, tasks: [
      ["Topic, aim & objectives", 0, 2, 1], ["Literature review", 1, 7, 1], ["Methodology & design", 5, 11, 1], ["Proposal seminar", 12, 12, 1, 0, true],
      ["Build / simulate", 14, 22, 1], ["Testing", 19, 25, 1], ["Writing the thesis", 16, 27, 0, 1], ["Defence", 28, 28, 1, 0, true]] },
    project2: { unit: "week", span: 14, tasks: [
      ["Implementation", 0, 6, 1], ["Testing & results", 6, 9, 1], ["Writing chapters 4–5", 5, 11, 0, 1], ["Supervisor review", 10, 12, 1],
      ["Submission", 12, 12, 1, 0, true], ["Defence", 13, 13, 1, 0, true]] }
  };
  FX.define("gantt", {
    aspect: 1.9, aspectSmall: 0.85,
    draw: function (f) {
      var c = f.c, P = PLANS[f.opts.variant] || PLANS["default"], hero = f.mode === "hero";
      f.clear();
      var small = f.w / f.h < 1.2, labW = small ? Math.min(140, f.w * 0.38) : Math.min(190, f.w * 0.3);
      var x0 = 14 + labW, w = f.w - x0 - 18, top = 36, n = P.tasks.length, rh = Math.min(36, (f.h - top - 24) / n);
      var X = function (t) { return x0 + t / P.span * w; };
      var now = f.reduce ? P.span * 0.45 : ((f.t * 1.4) % (P.span + 3));
      // week scale
      var stepW = P.span > 20 ? 4 : 2;
      for (var wk = 0; wk <= P.span; wk += stepW) {
        f.seg(X(wk), top - 6, X(wk), top + n * rh, f.a(c.ink, 0.07), 1);
        f.text(String(wk), X(wk), top - 14, { size: 9.5, color: c.dim, align: "center", mono: true });
      }
      f.text(P.unit + "s", x0 - 8, top - 14, { size: 9.5, color: c.dim, align: "right" });
      P.tasks.forEach(function (t, i) {
        var y = top + i * rh, crit = !!t[3], fl = t[4] || 0, ms = !!t[5];
        var col = crit ? c.a : c.c;
        if (i % 2 === 0) { f.ctx.save(); f.ctx.fillStyle = "rgba(255,255,255,.02)"; f.ctx.fillRect(10, y, f.w - 20, rh); f.ctx.restore(); }
        var active = now >= t[1] && now <= t[2] + (ms ? 0.6 : 0);
        f.text(t[0], 18, y + rh / 2, { size: small ? 10 : 11.5, weight: active ? 800 : 600, color: active ? "#fff" : c.ink });
        if (ms) {
          var mx = X(t[1]), my = y + rh / 2, r = rh * 0.28;
          f.line([[mx, my - r], [mx + r, my], [mx, my + r], [mx - r, my]], col, 1.5, { close: true, fill: now >= t[1] ? col : f.a(col, 0.2), glow: active ? 14 : 0 });
        } else {
          var bx = X(t[1]), bw = X(t[2]) - X(t[1]), by = y + rh * 0.22, bh = rh * 0.56;
          f.box(bx, by, bw, bh, 5, f.a(col, 0.18), f.a(col, 0.7), 1.2);
          var done = FX.clamp((now - t[1]) / Math.max(0.01, t[2] - t[1]), 0, 1);
          if (done > 0) f.box(bx, by, bw * done, bh, 5, f.a(col, active ? 0.85 : 0.6), null, 0, { glow: active ? 12 : 0, glowColor: col });
          if (fl) f.line([[X(t[2]), y + rh / 2], [X(t[2] + fl), y + rh / 2]], f.a(c.ink, 0.45), 1.2, { dash: [3, 3] });
        }
        f.hit({ x: 10, y: y, w: f.w - 20, h: rh }, t[0], ms ? "Milestone at " + P.unit + " " + t[1] : P.unit.charAt(0).toUpperCase() + P.unit.slice(1) + "s " + t[1] + "–" + t[2] + (crit ? " · on the critical path" : fl ? " · float " + fl + " " + P.unit + (fl > 1 ? "s" : "") : ""));
      });
      // today marker
      var nx = X(Math.min(now, P.span));
      f.seg(nx, top - 4, nx, top + n * rh, c.b, 2, { glow: 10 });
      f.circle(nx, top - 4, 4, c.b, null, 0, { glow: 10, glowColor: c.b });
      if (!hero) {
        f.box(18, f.h - 18, 10, 8, 2, c.a); f.text("critical path", 34, f.h - 14, { size: 10.5, color: c.ink });
        f.box(122, f.h - 18, 10, 8, 2, c.c); f.text("has float", 138, f.h - 14, { size: 10.5, color: c.ink });
      }
    }
  });
})();
