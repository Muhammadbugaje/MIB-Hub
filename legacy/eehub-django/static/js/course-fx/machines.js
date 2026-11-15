/* course-fx: electrical machines — rotating magnetic field (rmf), torque–speed curve (torque), speed drive (drive). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
  // Nigerian phase colours: red, yellow, blue
  var PH = ["#ff5d5d", "#ffd23f", "#4da3ff"];
  var PHN = ["R", "Y", "B"];

  /* ------------------------------------------------------------------ rmf */
  FX.define("rmf", {
    aspect: 1.9, aspectSmall: 0.95,
    controls: function (o) {
      var c = [
        { key: "speed", label: "Animation speed", min: 0.1, max: 1.2, step: 0.05, value: 0.45, fmt: function (v) { return v.toFixed(2) + "×"; } },
        { key: "pp", label: "Pole pairs", type: "select", value: 1, options: [[1, "1 (2-pole)"], [2, "2 (4-pole)"], [3, "3 (6-pole)"]] }
      ];
      if (o.variant !== "dq") c.push({ key: "slip", label: "Rotor slip", min: 0, max: 0.3, step: 0.01, value: 0.05, fmt: function (v) { return Math.round(v * 100) + " %"; } });
      return c;
    },
    init: function (f) { f.state.th = 0; f.state.rot = 0; },
    draw: function (f) {
      var hero = f.mode === "hero", c = f.c, v = f.v, s = f.state;
      var pp = hero ? 1 : (v.pp || 1), speed = hero ? 0.32 : (v.speed || 0.45), slip = hero ? 0.06 : (v.slip == null ? 0.05 : v.slip);
      var dq = f.opts.variant === "dq";
      if (f.reduce && !f.playing) { s.th = 0.9; } else { s.th += (f.dt || 0) * TAU * speed; }
      s.rot -= (f.dt || 0) * TAU * speed * (1 - slip) / pp;
      var th = s.th;
      f.clear();
      var wide = f.w / f.h > 1.25 && !hero;
      var R = hero ? Math.min(f.w, f.h) * 0.42 : (wide ? Math.min(f.h * 0.42, f.w * 0.24) : Math.min(f.w * 0.36, f.h * 0.27));
      var cx = hero ? f.w * 0.5 : (wide ? R + 26 + f.w * 0.03 : f.w / 2), cy = hero ? f.h * 0.5 : (wide ? f.h / 2 : R + 22);
      var x = f.ctx;
      // currents
      var ia = [cos(th), cos(th - TAU / 3), cos(th + TAU / 3)];
      // stator yoke
      var g = x.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.12);
      g.addColorStop(0, f.a(c.ink, 0.02)); g.addColorStop(1, f.a(c.ink, 0.10));
      f.circle(cx, cy, R * 1.1, g, f.a(c.ink, 0.25), 1.2);
      f.circle(cx, cy, R * 0.8, "rgba(0,0,0,0.25)", f.a(c.ink, 0.18), 1);
      // slots and coils: each slot belongs to the 60° phase belt it sits in (electrical angle)
      var nslot = 24, PHI = TAU / 3;
      for (var k = 0; k < nslot; k++) {
        var a = (k + 0.5) / nslot * TAU, ae = a * pp, phase = 0, sign = 1;
        for (var q0 = 0; q0 < 3; q0++) {
          var rel = ae + q0 * PHI; // phase q axis sits at -q*PHI
          if (Math.abs(cos(rel)) <= 0.5 + 1e-9) { phase = q0; sign = sin(rel) > 0 ? 1 : -1; break; }
        }
        var cur = ia[phase] * sign;
        var sx = cx + cos(a) * R * 0.9, sy = cy + sin(a) * R * 0.9;
        var col = PH[phase];
        f.circle(sx, sy, R * 0.055, f.a(col, 0.18 + 0.7 * Math.abs(cur)), f.a(col, 0.9), 1, { glow: Math.abs(cur) > 0.6 ? 8 : 0, glowColor: col });
        if (R > 60) {
          if (cur > 0.15) f.circle(sx, sy, R * 0.014, "#fff"); else if (cur < -0.15) {
            var d = R * 0.022; f.seg(sx - d, sy - d, sx + d, sy + d, "#fff", 1.2); f.seg(sx - d, sy + d, sx + d, sy - d, "#fff", 1.2);
          }
        }
      }
      // rotor
      var rr = R * 0.66;
      var rg = x.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, rr * 0.1, cx, cy, rr);
      rg.addColorStop(0, f.a(c.ink, 0.16)); rg.addColorStop(1, f.a(c.ink, 0.04));
      f.circle(cx, cy, rr, rg, f.a(c.ink, 0.3), 1);
      var fieldM = -th / pp; // mechanical angle of the field (the resultant of the three phase MMFs)
      // flux lines through the rotor, parallel to the field axis (2-pole picture)
      if (pp === 1) {
        x.save(); x.beginPath(); x.arc(cx, cy, rr * 0.98, 0, TAU); x.clip();
        var ux = cos(fieldM), uy = sin(fieldM), nx = -uy, ny = ux;
        for (var fl = -3; fl <= 3; fl++) {
          var off = fl * rr * 0.26, bend = 1 - Math.abs(fl) * 0.12;
          var pts = [];
          for (var u = -1.1; u <= 1.1; u += 0.1) pts.push([cx + ux * u * rr + nx * off * (1 + 0.25 * (1 - u * u)) * bend, cy + uy * u * rr + ny * off * (1 + 0.25 * (1 - u * u)) * bend]);
          f.line(pts, f.a(c.a, 0.22 - Math.abs(fl) * 0.02), 1.3, { dash: [5, 7] });
        }
        x.restore();
      }
      for (var b = 0; b < 18; b++) {
        var ba = s.rot + b / 18 * TAU;
        var bx = cx + cos(ba) * rr * 0.86, by = cy + sin(ba) * rr * 0.86;
        // induced current in the bar ~ field in the air gap at that point
        var ind = sin((ba - fieldM) * pp) * Math.min(1, slip * 12 + 0.08);
        f.circle(bx, by, rr * 0.06, f.a(ind > 0 ? c.a : c.c, 0.15 + 0.6 * Math.abs(ind)), f.a(c.ink, 0.25), 0.8);
      }
      f.circle(cx, cy, rr * 0.18, f.a(c.ink, 0.12), f.a(c.ink, 0.35), 1);
      // shaft key mark
      f.seg(cx, cy, cx + cos(s.rot) * rr * 0.18, cy + sin(s.rot) * rr * 0.18, c.ink, 2);
      // flux lines across the air gap (pole pattern)
      for (var p = 0; p < 2 * pp; p++) {
        var pa = fieldM + p * Math.PI / pp, isN = p % 2 === 0;
        var col2 = isN ? c.a : c.c;
        var px = cx + cos(pa) * R * 0.74, py = cy + sin(pa) * R * 0.74;
        f.circle(px, py, R * 0.09, f.a(col2, 0.22), null, 0, { glow: 18, glowColor: col2 });
        f.text(isN ? "N" : "S", px, py + 0.5, { size: Math.max(10, R * 0.08), weight: 700, color: col2, align: "center" });
      }
      // phase vectors and resultant (2-pole picture only)
      if (pp === 1) {
        var L = rr * 0.7;
        var sum = [0, 0];
        for (var q = 0; q < 3; q++) {
          var ang = -q * TAU / 3, mag = ia[q] * L * 0.66;
          sum[0] += cos(ang) * mag; sum[1] += sin(ang) * mag;
          if (!hero) f.arrow(cx, cy, cx + cos(ang) * mag, cy + sin(ang) * mag, f.a(PH[q], 0.9), 2.2, { head: 8 });
        }
        f.arrow(cx, cy, cx + sum[0], cy + sum[1], c.a, hero ? 4 : 3.4, { glow: 16, head: 12 });
        if (dq) {
          // rotating d and q axes
          var dA = Math.atan2(sum[1], sum[0]);
          f.seg(cx - cos(dA) * R * 1.05, cy - sin(dA) * R * 1.05, cx + cos(dA) * R * 1.05, cy + sin(dA) * R * 1.05, f.a(c.b, 0.6), 1.2, { dash: [6, 5] });
          f.seg(cx - cos(dA + Math.PI / 2) * R * 1.05, cy - sin(dA + Math.PI / 2) * R * 1.05, cx + cos(dA + Math.PI / 2) * R * 1.05, cy + sin(dA + Math.PI / 2) * R * 1.05, f.a(c.c, 0.6), 1.2, { dash: [6, 5] });
          f.text("d", cx + cos(dA) * R * 1.12, cy + sin(dA) * R * 1.12, { color: c.b, weight: 700, align: "center", size: 13 });
          f.text("q", cx + cos(dA + Math.PI / 2) * R * 1.12, cy + sin(dA + Math.PI / 2) * R * 1.12, { color: c.c, weight: 700, align: "center", size: 13 });
        }
      }
      if (hero) return;
      // phase labels
      for (var l = 0; l < 3; l++) {
        var la = -l * TAU / 3;
        f.text(PHN[l], cx + cos(la) * R * 1.22, cy + sin(la) * R * 1.22, { color: PH[l], weight: 700, align: "center", size: 12 });
      }
      // waveforms panel
      var px0, py0, pw, ph;
      if (wide) { px0 = cx + R * 1.35; py0 = 18; pw = f.w - px0 - 16; ph = f.h - 36; }
      else { px0 = 14; py0 = cy + R * 1.3; pw = f.w - 28; ph = f.h - py0 - 12; }
      if (pw < 60 || ph < 50) return;
      var rows = dq ? 2 : 1, rh = (ph - (rows - 1) * 10) / rows;
      var pl = f.plot(px0, py0, pw, rh, [0, 2], [-1.25, 1.25], { nx: 8, ny: 4, xl: "time", yl: "phase currents" });
      for (var w = 0; w < 3; w++) {
        (function (w) {
          f.curve(pl, function (u) { return cos(th - (2 - u) * Math.PI - w * TAU / 3); }, 0, 2, 120, PH[w], 2, { glow: 6 });
          f.circle(pl.X(2), pl.Y(ia[w]), 4, PH[w], null, 0, { glow: 10, glowColor: PH[w] });
          f.text("i_" + PHN[w], px0 + 10 + w * 30, py0 + rh - 30, { size: 11, weight: 700, color: PH[w] });
        })(w);
      }
      // "now" cursor at the right edge
      f.seg(pl.X(2), py0, pl.X(2), py0 + rh, f.a(c.ink, 0.5), 1, { dash: [3, 3] });
      var ns = 120 * 50 / (2 * pp);
      f.text("n_s = 120f/P = " + ns + " rpm  (50 Hz, " + 2 * pp + " poles)", px0 + 8, py0 + rh - 12, { size: 11, color: c.ink, mono: true });
      if (dq) {
        var pl2 = f.plot(px0, py0 + rh + 10, pw, rh, [0, 2], [-1.25, 1.25], { nx: 8, ny: 4, yl: "dq frame" });
        f.curve(pl2, function () { return 1.0; }, 0, 2, 2, c.b, 2.4, { glow: 8 });
        f.curve(pl2, function () { return 0.35; }, 0, 2, 2, c.c, 2.4, { glow: 8 });
        f.text("i_d", pl2.X(1.9), pl2.Y(1.0) - 10, { color: c.b, weight: 700, align: "right" });
        f.text("i_q", pl2.X(1.9), pl2.Y(0.35) - 10, { color: c.c, weight: 700, align: "right" });
      }
    }
  });

  /* --------------------------------------------------------------- torque */
  function torque(s, r2, V, X, ws) {
    var Rth = 0.03, a = r2 / s;
    return 3 * V * V * a / (ws * ((Rth + a) * (Rth + a) + X * X));
  }
  FX.define("torque", {
    aspect: 1.9, aspectSmall: 0.9,
    controls: function (o) {
      if (o.variant === "vf") return [{ key: "fr", label: "Supply frequency", min: 10, max: 50, step: 1, value: 50, unit: " Hz" }];
      return [
        { key: "s", label: "Slip s", min: 0.005, max: 1, step: 0.005, value: 0.04, fmt: function (v) { return v.toFixed(3); } },
        { key: "r2", label: "Rotor resistance", min: 0.5, max: 5, step: 0.1, value: 1, fmt: function (v) { return v.toFixed(1) + "× R₂"; } }
      ];
    },
    init: function (f) { f.state.ang = 0; },
    draw: function (f) {
      var c = f.c, v = f.v, vf = f.opts.variant === "vf";
      f.clear();
      var small = f.w / f.h < 1.25;
      var px0 = 46, py0 = 18, pw = (small ? f.w - 62 : f.w * 0.68 - 50), ph = small ? f.h * 0.62 - 30 : f.h - 52;
      var nsync = 1500, Tmax = 0;
      var R2 = 0.04 * (vf ? 1 : (v.r2 || 1)), X = 0.25;
      // scale: peak torque at 50 Hz, R2 base
      var ref = 0; for (var i = 1; i < 400; i++) { ref = Math.max(ref, torque(i / 400, 0.04, 1, X, 1)); }
      var pl = f.plot(px0, py0, pw, ph, [0, nsync * 1.02], [0, 1.25], { xl: "speed (rpm)", yl: "torque (pu of peak)", nx: 6, ny: 5 });
      // axes ticks
      for (var t = 0; t <= 1500; t += 500) f.text(String(t), pl.X(t), py0 + ph + 12, { size: 10, color: c.dim, align: "center" });
      var load = function (n) { return 0.12 + 0.55 * Math.pow(n / 1500, 2); }; // fan/pump
      var op = null;
      if (!vf) {
        // ghost curves for other R2
        [0.5, 1, 2, 4].forEach(function (m) {
          f.curve(pl, function (n) { var s = Math.max(1e-4, (nsync - n) / nsync); return torque(s, 0.04 * m, 1, X, 1) / ref; }, 0, nsync, 160, f.a(c.ink, 0.12), 1);
        });
        var pts = f.curve(pl, function (n) { var s = Math.max(1e-4, (nsync - n) / nsync); return torque(s, R2, 1, X, 1) / ref; }, 0, nsync, 220, c.a, 3, { glow: 12 });
        f.curve(pl, load, 0, nsync, 60, f.a(c.c, 0.85), 2, { dash: [6, 5] });
        f.text("load (pump)", pl.X(1400), pl.Y(load(1400)) - 12, { size: 10, color: c.c, align: "right" });
        var s = v.s || 0.04, n = nsync * (1 - s), T = torque(s, R2, 1, X, 1) / ref;
        op = { n: n, T: T, s: s };
        // stability shading: region right of the peak
        var smax = R2 / Math.sqrt(0.03 * 0.03 + X * X), nmax = nsync * (1 - smax);
        f.ctx.save(); f.ctx.fillStyle = f.a(c.a, 0.06); f.ctx.fillRect(pl.X(Math.max(0, nmax)), py0, pl.X(nsync) - pl.X(Math.max(0, nmax)), ph); f.ctx.restore();
        f.text("stable region", pl.X(Math.max(nmax, 0)) + 6, py0 + ph - 30, { size: 10, color: f.a(c.a, 0.9) });
        f.text("starting torque", pl.X(0) + 6, pl.Y(torque(1, R2, 1, X, 1) / ref) - 10, { size: 10, color: c.dim });
      } else {
        var fr = v.fr || 50;
        [10, 20, 30, 40, 50].forEach(function (fq) {
          var ns = 30 * fq * 2 / 2 * 1, V = fq / 50, Xf = X * fq / 50; ns = 1500 * fq / 50;
          var col = Math.abs(fq - fr) < 0.5 ? c.a : f.a(c.ink, 0.16);
          f.curve(pl, function (n) { var s = (ns - n) / ns; if (s <= 0) return NaN; return torque(s, 0.04, V + 0.02, Xf, fq / 50) / ref; }, 0, ns, 160, col, Math.abs(fq - fr) < 0.5 ? 3 : 1);
        });
        var nsf = 1500 * fr / 50, Vv = fr / 50, Xv = X * fr / 50;
        f.curve(pl, function (n) { var s = (nsf - n) / nsf; if (s <= 0) return NaN; return torque(s, 0.04, Vv + 0.02, Xv, fr / 50) / ref; }, 0, nsf, 220, c.a, 3, { glow: 12 });
        f.curve(pl, load, 0, nsync, 60, f.a(c.c, 0.85), 2, { dash: [6, 5] });
        // operating point: solve T = load by bisection on n in (0, nsf)
        var lo = nsf * 0.7, hi = nsf * 0.9999;
        for (var it = 0; it < 40; it++) { var mid = (lo + hi) / 2, sm = (nsf - mid) / nsf; var d = torque(sm, 0.04, Vv + 0.02, Xv, fr / 50) / ref - load(mid); if (d > 0) lo = mid; else hi = mid; }
        op = { n: lo, T: load(lo), s: (nsf - lo) / nsf };
        f.text("V/f constant: " + Math.round(400 * fr / 50) + " V at " + fr + " Hz", px0 + pw - 10, py0 + 14, { size: 11, mono: true, align: "right" });
      }
      // operating point
      var pulse = f.reduce ? 0 : (Math.sin(f.t * 5) + 1) / 2;
      f.circle(pl.X(op.n), pl.Y(op.T), 6 + pulse * 3, f.a(c.b, 0.3), null, 0);
      f.circle(pl.X(op.n), pl.Y(op.T), 5, c.b, "#fff", 1.5, { glow: 14, glowColor: c.b });
      f.seg(pl.X(op.n), pl.Y(op.T), pl.X(op.n), py0 + ph, f.a(c.b, 0.5), 1, { dash: [3, 4] });
      // side panel: spinning rotor + read-outs
      var bx, by, br;
      if (small) { bx = f.w * 0.25; by = py0 + ph + 34 + (f.h - (py0 + ph + 34)) / 2; br = Math.min(f.w * 0.16, (f.h - py0 - ph - 40) / 2.4); }
      else { bx = px0 + pw + (f.w - px0 - pw) / 2; by = f.h * 0.36; br = Math.min((f.w - px0 - pw) * 0.3, f.h * 0.2); }
      if (br > 10) {
        f.state.ang += (f.dt || 0) * TAU * 0.9 * (op.n / 1500);
        f.circle(bx, by, br * 1.25, null, f.a(c.ink, 0.2), 1);
        f.circle(bx, by, br, f.a(c.ink, 0.06), f.a(c.ink, 0.3), 1.2);
        for (var k = 0; k < 6; k++) {
          var aa = f.state.ang + k * TAU / 6;
          f.seg(bx, by, bx + cos(aa) * br * 0.92, by + sin(aa) * br * 0.92, f.a(c.a, 0.8), 2);
        }
        f.circle(bx, by, br * 0.15, c.a, null, 0, { glow: 10 });
        var tx = small ? f.w * 0.5 : bx - (f.w - px0 - pw) * 0.42, ty = small ? by - br * 0.9 : by + br * 1.6;
        var lines = ["speed  " + Math.round(op.n) + " rpm", "slip   " + (op.s * 100).toFixed(1) + " %", "torque " + (op.T).toFixed(2) + " pu"];
        if (!vf) lines.push("rotor f " + (op.s * 50).toFixed(1) + " Hz");
        lines.forEach(function (s2, j) { f.text(s2, tx, ty + j * 17, { size: 11.5, mono: true, color: j === 0 ? c.b : c.ink }); });
      }
    }
  });

  /* ---------------------------------------------------------------- drive */
  FX.define("drive", {
    aspect: 1.9, aspectSmall: 0.85,
    controls: [
      { key: "ref", label: "Speed reference", min: 0, max: 1500, step: 10, value: 1000, unit: " rpm" },
      { key: "load", label: "Load torque", min: 0, max: 100, step: 1, value: 30, unit: " %" }
    ],
    init: function (f) {
      var s = f.state;
      s.w = 0; s.i = 0; s.integ = 0; s.hist = []; s.clock = 0; s.phase = 0; s.dots = 0; s.shaft = 0;
    },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var ref = f.v.ref == null ? 1000 : f.v.ref, load = (f.v.load == null ? 30 : f.v.load) / 100;
      if (hero) { // self-driven demo: setpoint steps and load steps
        var ph = Math.floor((f.t % 16) / 4);
        ref = [600, 1200, 1200, 900][ph]; load = [0.2, 0.2, 0.7, 0.4][ph];
      }
      // simulate (sub-steps)
      var dt = f.dt || 0, steps = Math.ceil(dt / 0.004);
      if (f.reduce && !f.playing && s.hist.length === 0) { s.w = ref; s.i = load + 0.05 * ref / 1500; dt = 0; }
      for (var k = 0; k < steps; k++) {
        var h = dt / steps, e = (ref - s.w) / 1500;
        s.integ = FX.clamp(s.integ + e * h * 6, -1.5, 1.5);
        var istar = FX.clamp(2.2 * e * 6 + s.integ, -1.6, 1.6);
        s.i += (istar - s.i) * Math.min(1, h * 40);
        var Tm = s.i, TL = load + 0.05 * s.w / 1500;
        s.w += (Tm - TL) * h * 1500 / 0.6;
        s.w = FX.clamp(s.w, -200, 1800);
        s.clock += h;
        if (s.clock > 0.03) { s.clock = 0; s.hist.push([ref, s.w, s.i]); if (s.hist.length > 260) s.hist.shift(); }
      }
      f.clear();
      var small = f.w / f.h < 1.3;
      // block diagram
      var bh = small ? 34 : 40, by = 22 + bh / 2;
      var blocks = small
        ? [["ω*", 0.06], ["PI", 0.3], ["Conv.", 0.55], ["Motor", 0.82]]
        : [["ω* ref", 0.05], ["PI", 0.26], ["Converter", 0.47], ["Motor", 0.68], ["Load", 0.88]];
      var bw = small ? f.w * 0.18 : f.w * 0.13;
      var xs = blocks.map(function (b) { return b[1] * (f.w - 40); });
      var mid = function (i) { return xs[i] + bw / 2; };
      // wires with moving dots
      s.dots += (f.dt || 0) * 60;
      for (var b = 0; b < blocks.length - 1; b++) {
        var x1 = xs[b] + bw, x2 = xs[b + 1];
        f.seg(x1, by, x2, by, f.a(c.ink, 0.35), 1.5);
        var mag = b === 0 ? ref / 1500 : b === 1 ? Math.abs(s.i) : Math.abs(s.w) / 1500;
        for (var d = 0; d < 3; d++) {
          var u = ((s.dots * (0.4 + mag) / 40 + d / 3) % 1);
          f.circle(x1 + (x2 - x1) * u, by, 2.6, c.a, null, 0, { glow: 8 });
        }
      }
      // feedback path
      var fbY = by + bh / 2 + 18;
      var mI = small ? 3 : 3;
      f.line([[mid(mI), by + bh / 2], [mid(mI), fbY], [mid(1) - bw * 0.75, fbY], [mid(1) - bw * 0.75, by]], f.a(c.c, 0.7), 1.5, { dash: [5, 4] });
      for (var dd = 0; dd < 4; dd++) {
        var uu = ((s.dots / 50 + dd / 4) % 1), L1 = mid(mI) - (mid(1) - bw * 0.75);
        f.circle(mid(mI) - L1 * uu, fbY, 2.2, c.c, null, 0, { glow: 6 });
      }
      f.text("speed feedback (tacho)", (mid(mI) + mid(1)) / 2, fbY + 11, { size: 10, color: c.c, align: "center" });
      f.circle(mid(1) - bw * 0.75, by, 7, "rgba(0,0,0,.3)", c.ink, 1.2);
      f.text("Σ", mid(1) - bw * 0.75, by + 0.5, { size: 10, align: "center", weight: 700 });
      blocks.forEach(function (bl, i) {
        var isMotor = bl[0] === "Motor";
        f.box(xs[i], by - bh / 2, bw, bh, 9, f.a(isMotor ? c.a : c.ink, isMotor ? 0.14 : 0.07), f.a(isMotor ? c.a : c.ink, 0.5), 1.2, { glow: isMotor ? 10 : 0 });
        f.text(bl[0], xs[i] + bw / 2, by, { size: small ? 11 : 12, weight: 600, align: "center" });
      });
      // motor shaft spinner inside motor block
      s.shaft += (f.dt || 0) * s.w / 1500 * TAU * 1.5;
      var mx = xs[3] + bw - 12, my = by - bh / 2 + 10;
      for (var sp = 0; sp < 3; sp++) { var aa = s.shaft + sp * TAU / 3; f.seg(mx, my, mx + cos(aa) * 6, my + sin(aa) * 6, c.a, 1.6); }
      // traces
      var py0 = fbY + 26, ph = f.h - py0 - 14, px0 = 14, pw = f.w - 28;
      if (ph < 40) return;
      var pl = f.plot(px0, py0, pw, ph, [0, 260], [-0.2, 1.7], { yl: "speed (rpm/1000) & torque (pu)", xl: "time →", nx: 10, ny: 4 });
      var H = s.hist, n0 = 260 - H.length;
      var line = function (idx, col, w, sc, dash) {
        var pts = H.map(function (r, j) { return [pl.X(n0 + j), pl.Y(r[idx] * sc)]; });
        f.line(pts, col, w, { glow: dash ? 0 : 8, dash: dash });
      };
      if (H.length > 1) {
        line(0, f.a(c.ink, 0.6), 1.5, 1 / 1000, [5, 4]);
        line(1, c.a, 2.6, 1 / 1000);
        line(2, c.b, 1.8, 1);
      }
      var lx = px0 + pw - 8;
      f.text("ω", lx - 70, py0 + 12, { color: c.a, weight: 700 }); f.text("ω*", lx - 50, py0 + 12, { color: c.ink, weight: 700 }); f.text("T", lx - 22, py0 + 12, { color: c.b, weight: 700 });
      f.text(Math.round(s.w) + " rpm", px0 + 10, py0 + ph - 12, { size: 12, mono: true, color: c.a });
    }
  });
})();
