/* course-fx: the sciences — chemistry (atom, reaction, titration, molecule), physics (mechanics, efield,
   optics, kinetic, pendulum), fields and waves (emwave), instruments (scope) and device electronics
   (transistor, junction). Hero visuals for the 100–300 level foundation courses; every one also works as
   a figure. Deterministic (FX.rng), transform/alpha only, no DOM. */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI, abs = Math.abs;
  function pad(f) { return f.small ? 12 : 20; }
  function fit(f, s, size, mono, weight, reserve) {
    var x = f.ctx, max = f.w - 2 * pad(f) - (reserve || 0);
    x.save(); x.font = (weight || 500) + " " + size + "px " + (mono ? f.c.mono : f.c.sans);
    var parts = s.split(" · "), out = s;
    while (x.measureText(out).width > max && parts.length > 1) { parts.pop(); out = parts.join(" · "); }
    while (x.measureText(out).width > max && out.length > 4) out = out.slice(0, -2).replace(/\s+$/, "") + "…";
    x.restore(); return out;
  }
  function caption(f, s, col) {
    var size = f.small ? 10.5 : 12, hero = f.mode === "hero";
    if (hero) f.text(fit(f, s, size, true, 500, f.small ? 150 : 190), f.w - pad(f), f.h - pad(f) + 2, { size: size, mono: true, color: col || f.c.dim, align: "right" });
    else f.text(fit(f, s, size, true), pad(f), f.h - pad(f) + 2, { size: size, mono: true, color: col || f.c.dim });
  }
  function title(f, s, col) { var size = f.small ? 11.5 : 13.5; f.text(fit(f, s, size, false, 700, f.mode === "hero" ? 44 : 0), pad(f), pad(f) - 2, { size: size, weight: 700, color: col || f.c.ink }); }

  /* ================================================================== atom */
  var ELEMENTS = [
    ["Hydrogen", "H", 1, [1], "1s¹"], ["Helium", "He", 2, [2], "1s²"], ["Carbon", "C", 6, [2, 4], "1s² 2s² 2p²"],
    ["Oxygen", "O", 8, [2, 6], "1s² 2s² 2p⁴"], ["Sodium", "Na", 11, [2, 8, 1], "[Ne] 3s¹"], ["Chlorine", "Cl", 17, [2, 8, 7], "[Ne] 3s² 3p⁵"]
  ];
  FX.define("atom", {
    aspect: 1.6, aspectSmall: 1, still: 3,
    draw: function (f) {
      var c = f.c, t = f.t, per = 7;
      var k = f.reduce ? 2 : (Math.floor(t / per) + 2) % ELEMENTS.length, u = (t % per) / per, E = ELEMENTS[k];
      var fade = Math.min(1, u * 6, (1 - u) * 6);
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.42), cy = f.h * 0.52, R = Math.min(f.w, f.h) * 0.4;
      // nucleus
      var r = FX.rng(E[2] * 7 + 3), A = E[2] * 2 - (E[2] > 1 ? 0 : 1), i;
      for (i = 0; i < A; i++) {
        var a = r() * TAU, d = Math.sqrt(r()) * R * 0.08 * (A > 4 ? 1 : 0.5), jit = sin(t * 9 + i) * 0.6;
        f.circle(cx + cos(a) * d + jit, cy + sin(a) * d, R * 0.045, i % 2 ? c.d : c.dim, null, 0, { glow: i % 2 ? 8 : 0 });
      }
      // shells and electrons
      E[3].forEach(function (n, s) {
        var rr = R * (0.32 + s * 0.3), tilt = 0.5 + s * 0.55, sp = (1.4 - s * 0.35) * (s % 2 ? -1 : 1);
        f.ctx.save(); f.ctx.translate(cx, cy); f.ctx.rotate(tilt);
        f.ctx.beginPath(); f.ctx.ellipse(0, 0, rr, rr * 0.42, 0, 0, TAU); f.ctx.strokeStyle = f.a(c.ink, 0.16); f.ctx.lineWidth = 1; f.ctx.stroke();
        f.ctx.restore();
        for (i = 0; i < n; i++) {
          var ph = t * sp + i / n * TAU, ex = cos(ph) * rr, ey = sin(ph) * rr * 0.42;
          var px = cx + ex * cos(tilt) - ey * sin(tilt), py = cy + ex * sin(tilt) + ey * cos(tilt);
          f.circle(px, py, 3.2, c.a, null, 0, { glow: 12 });
        }
      });
      f.ctx.save(); f.ctx.globalAlpha = fade;
      var lx = f.small ? pad(f) : f.w * 0.72, ly = f.small ? pad(f) : f.h * 0.3;
      f.text(E[1], f.small ? f.w - pad(f) : lx, f.small ? pad(f) + 4 : ly - 34, { size: f.small ? 26 : 40, weight: 800, color: c.b, align: f.small ? "right" : "left" });
      if (!f.small) {
        f.text(E[0], lx, ly + 6, { size: 14, weight: 700 });
        f.text("Z = " + E[2] + " · " + E[3].join(", ") + " electrons", lx, ly + 26, { size: 11.5, color: c.dim });
        f.text(E[4], lx, ly + 46, { size: 12.5, mono: true, color: c.c });
      }
      f.ctx.restore();
      caption(f, f.small ? E[4] : "Bohr model · electrons fill shells 2, 8, 8");
    }
  });

  /* ============================================================== reaction */
  FX.define("reaction", {
    aspect: 1.7, aspectSmall: 0.9, still: 9,
    init: function (f) {
      var r = FX.rng(77), m = [];
      for (var i = 0; i < 26; i++) m.push({ x: r(), y: r(), vx: (r() - 0.5) * 0.18, vy: (r() - 0.5) * 0.18, k: i < 13 ? 0 : 1, a: r() * TAU, w: (r() - 0.5) * 3 });
      f.state.m = m; f.state.hist = []; f.state.lastT = -1; f.state.cyc = -1;
    },
    draw: function (f) {
      var c = f.c, s = f.state, t = f.t, per = 18, cyc = Math.floor(t / per), u = (t % per) / per;
      if (cyc !== s.cyc) { s.cyc = cyc; s.m.forEach(function (p, i) { p.k = i < 13 ? 0 : 1; }); s.hist = []; }
      // A2 + B2 ⇌ 2AB: the AB fraction approaches equilibrium
      var eq = 0.72, frac = eq * (1 - Math.exp(-u * 7));
      var want = Math.round(frac * s.m.length / 2) * 2, have = s.m.filter(function (p) { return p.k === 2; }).length;
      var r = FX.rng(cyc * 31 + Math.floor(t * 4));
      if (have < want) { // convert the closest A2 / B2 pair
        var A = s.m.filter(function (p) { return p.k === 0; }), B = s.m.filter(function (p) { return p.k === 1; });
        if (A.length && B.length) { var a = A[Math.floor(r() * A.length)], b = B[Math.floor(r() * B.length)]; a.k = 2; b.k = 2; a.flash = t; b.flash = t; }
      }
      f.clear();
      var dt = f.playing ? Math.min(0.05, f.dt || 0.016) : 0;
      var bx = pad(f), by = pad(f) + 14, bw = f.small ? f.w - 2 * pad(f) : f.w * 0.52, bh = f.small ? f.h * 0.48 : f.h - by - pad(f) - 8;
      f.box(bx, by, bw, bh, 12, c.panel, f.a(c.ink, 0.12));
      var COL = [c.c, c.b, c.a];
      s.m.forEach(function (p) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.w * dt;
        if (p.x < 0.04 || p.x > 0.96) p.vx *= -1; if (p.y < 0.06 || p.y > 0.94) p.vy *= -1;
        var x = bx + p.x * bw, y = by + p.y * bh, rr = Math.max(3, Math.min(bw, bh) * 0.022), dx = cos(p.a) * rr * 1.1, dy = sin(p.a) * rr * 1.1;
        var c1 = p.k === 2 ? COL[0] : COL[p.k], c2 = p.k === 2 ? COL[1] : COL[p.k];
        f.seg(x - dx, y - dy, x + dx, y + dy, f.a(c.ink, 0.5), 2);
        f.circle(x - dx, y - dy, rr, c1, null, 0, { glow: 6 }); f.circle(x + dx, y + dy, rr, c2, null, 0, { glow: 6 });
        if (p.flash != null && t - p.flash < 0.5) f.circle(x, y, rr * 2 + (t - p.flash) * 40, null, f.a(c.ink, 1 - (t - p.flash) * 2), 1.5);
      });
      // concentration-time plot
      if (Math.floor(t * 10) !== s.lastT) { s.lastT = Math.floor(t * 10); s.hist.push([u, frac]); if (s.hist.length > 200) s.hist.shift(); }
      var px0 = f.small ? pad(f) : bx + bw + 18, py0 = f.small ? by + bh + 30 : by + 24, pw = f.small ? f.w - 2 * pad(f) : f.w - px0 - pad(f), ph = f.small ? f.h - py0 - pad(f) - 6 : bh - 24;
      var pl = f.plot(px0, py0, pw, ph, [0, 1], [0, 1], { nx: 4, ny: 4, xl: "time", yl: "concentration" });
      f.seg(pl.X(0), pl.Y(eq), pl.X(1), pl.Y(eq), f.a(c.a, 0.5), 1, { dash: [4, 4] });
      f.text("equilibrium", pl.X(1) - 4, pl.Y(eq) - 9, { size: 10, color: c.a, align: "right" });
      f.line(s.hist.map(function (h) { return [pl.X(h[0]), pl.Y(h[1])]; }), c.a, 2.4, { glow: 8 });
      f.line(s.hist.map(function (h) { return [pl.X(h[0]), pl.Y(1 - h[1])]; }), c.b, 2, { glow: 6 });
      title(f, "A₂ + B₂ ⇌ 2AB");
      caption(f, "Kc = [AB]² / [A₂][B₂] · forward and reverse rates equal at equilibrium");
    }
  });

  /* ============================================================= titration */
  FX.define("titration", {
    aspect: 1.7, aspectSmall: 0.9, still: 8,
    draw: function (f) {
      var c = f.c, t = f.t, per = 16, u = f.reduce ? 0.5 : (t % per) / per, V = u * 50, Ve = 25;
      var pH = function (v) { var d = (v - Ve) / Ve; return 7 + 5.6 * Math.tanh(d * 9) + d * 0.6; };
      f.clear();
      var left = f.small ? f.w * 0.5 : f.w * 0.38, cx = left * 0.5, top = pad(f);
      // burette
      var bw = Math.max(10, left * 0.08), bh = f.h * 0.46, bx = cx - bw / 2, by = top;
      f.box(bx, by, bw, bh, 3, f.a(c.ink, 0.05), f.a(c.ink, 0.35), 1);
      var fill = 1 - u * 0.9; f.ctx.save(); f.ctx.fillStyle = f.a(c.c, 0.55); f.ctx.fillRect(bx + 1, by + bh * (1 - fill), bw - 2, bh * fill - 1); f.ctx.restore();
      for (var g = 0; g <= 10; g++) f.seg(bx + bw, by + bh * g / 10, bx + bw + (g % 5 ? 4 : 7), by + bh * g / 10, f.a(c.ink, 0.4), 1);
      f.seg(cx, by + bh, cx, by + bh + 14, f.a(c.ink, 0.35), 2);
      // drop
      var dp = (t * 1.6) % 1, dropY = by + bh + 16 + dp * (f.h * 0.22);
      if (!f.reduce && u < 0.98) f.circle(cx, dropY, 3, c.c, null, 0, { glow: 8 });
      // flask
      var fy = f.h * 0.6, fh = f.h - fy - pad(f) - 24, fw = Math.min(left * 0.6, fh * 1.1), neck = fw * 0.28;
      var body = [[cx - neck / 2, fy - fh * 0.26], [cx - neck / 2, fy], [cx - fw / 2, fy + fh], [cx + fw / 2, fy + fh], [cx + neck / 2, fy], [cx + neck / 2, fy - fh * 0.26]];
      var mix = FX.clamp((pH(V) - 8.2) / 1.4, 0, 1), liq = "rgba(" + Math.round(255 * mix + 190 * (1 - mix)) + "," + Math.round(90 * mix + 215 * (1 - mix)) + "," + Math.round(170 * mix + 235 * (1 - mix)) + ",";
      var lvl = 0.5 + u * 0.3, ly = fy + fh - fh * lvl * 0.95;
      f.ctx.save(); f.ctx.beginPath(); body.forEach(function (p, i) { if (i) f.ctx.lineTo(p[0], p[1]); else f.ctx.moveTo(p[0], p[1]); }); f.ctx.closePath(); f.ctx.clip();
      f.ctx.fillStyle = liq + "0.55)"; f.ctx.fillRect(cx - fw, ly, fw * 2, fh);
      for (var w = 0; w < 3; w++) { var wx = cx - fw / 2 + ((t * 30 + w * 40) % (fw)); f.circle(wx, ly + 6 + w * 9, 1.5, "rgba(255,255,255,.5)"); }
      f.ctx.restore();
      f.line(body, f.a(c.ink, 0.6), 2);
      if (!f.small) f.text("pH " + pH(V).toFixed(1), cx, fy + fh * 0.62, { size: 14, weight: 800, align: "center", color: mix > 0.5 ? "#2a0a1c" : c.ink });
      // pH curve
      var px0 = f.small ? f.w * 0.52 : left + 10, pw = f.w - px0 - pad(f), py0 = pad(f) + 16, ph = f.h - py0 - pad(f) - 6;
      var pl = f.plot(px0, py0, pw, ph, [0, 50], [0, 14], { nx: 5, ny: 7, xl: "NaOH added (mL)", yl: "pH" });
      f.curve(pl, pH, 0, V, 160, c.a, 2.6, { glow: 10 });
      f.seg(pl.X(Ve), pl.y0, pl.X(Ve), pl.y0 + pl.h, f.a(c.b, 0.5), 1, { dash: [3, 4] });
      f.text("equivalence 25 mL", pl.X(Ve) + 5, pl.y0 + 12, { size: 10, color: c.b });
      f.circle(pl.X(V), pl.Y(pH(V)), 4.5, "#fff", null, 0, { glow: 12, glowColor: c.a });
      caption(f, "HCl + NaOH → NaCl + H₂O · phenolphthalein turns pink at pH ≈ 8.2");
    }
  });

  /* ============================================================== molecule */
  FX.define("molecule", {
    aspect: 1.6, aspectSmall: 1, still: 2,
    draw: function (f) {
      var c = f.c, t = f.t, i;
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.36), cy = f.h * 0.5, R = Math.min(f.w, f.h) * 0.26, rot = t * 0.25;
      // benzene: resonance between two Kekulé structures, π cloud circulating
      var P = []; for (i = 0; i < 6; i++) P.push([cx + cos(rot + i * TAU / 6) * R, cy + sin(rot + i * TAU / 6) * R]);
      var kek = f.reduce ? 0.5 : 0.5 + 0.5 * sin(t * 1.2);
      for (i = 0; i < 6; i++) {
        var a = P[i], b = P[(i + 1) % 6], dbl = (i % 2 ? kek : 1 - kek);
        f.seg(a[0], a[1], b[0], b[1], c.ink, 2.4);
        var nx = (cy - (a[1] + b[1]) / 2), ny = ((a[0] + b[0]) / 2 - cx), L = Math.hypot(nx, ny) || 1; nx = nx / L * 7; ny = ny / L * 7;
        if (dbl > 0.05) f.seg(a[0] * 0.85 + b[0] * 0.15 - ny, a[1] * 0.85 + b[1] * 0.15 - nx, a[0] * 0.15 + b[0] * 0.85 - ny, a[1] * 0.15 + b[1] * 0.85 - nx, c.a, 2, { alpha: dbl });
        var hx = cx + cos(rot + i * TAU / 6) * R * 1.3, hy = cy + sin(rot + i * TAU / 6) * R * 1.3;
        f.seg(a[0], a[1], hx, hy, f.a(c.ink, 0.5), 1.5); f.circle(hx, hy, 4, c.dim); f.circle(a[0], a[1], 6, c.c, null, 0, { glow: 8 });
      }
      f.circle(cx, cy, R * 0.6, null, f.a(c.a, 0.45), 1.5, { dash: [3, 5] });
      for (i = 0; i < 6; i++) { var ph = t * 1.5 + i * TAU / 6; f.circle(cx + cos(ph) * R * 0.6, cy + sin(ph) * R * 0.6, 2.2, c.a, null, 0, { glow: 10 }); }
      f.text("benzene C₆H₆", cx, cy - R * 1.42 - 14, { size: f.small ? 11 : 12.5, align: "center", mono: true, color: c.dim });
      if (!f.small) {
        // ethanol, ball and stick, gently tumbling
        var ox = f.w * 0.76, oy = f.h * 0.48, s = Math.min(f.w, f.h) * 0.12, tt = t * 0.5;
        var atoms = [["C", -1.1, 0, c.c], ["C", 0, 0.5, c.c], ["O", 1.1, 0, c.d], ["H", 1.9, 0.5, c.dim], ["H", -1.6, -0.8, c.dim], ["H", -1.7, 0.7, c.dim], ["H", -0.9, 0.9, c.dim], ["H", 0.3, 1.4, c.dim], ["H", 0.4, -0.4, c.dim]];
        var bonds = [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]];
        var pr = atoms.map(function (a) { var x = a[1] * cos(tt) - 0 * sin(tt), z = a[1] * sin(tt); return [ox + x * s, oy + a[2] * s, z]; });
        bonds.forEach(function (b) { f.seg(pr[b[0]][0], pr[b[0]][1], pr[b[1]][0], pr[b[1]][1], f.a(c.ink, 0.55), 2); });
        atoms.map(function (a, k) { return [pr[k][2], k]; }).sort(function (p, q) { return p[0] - q[0]; }).forEach(function (o) {
          var a = atoms[o[1]], p = pr[o[1]], rr = (a[0] === "H" ? 4 : 7) * (1 + p[2] * 0.15);
          f.circle(p[0], p[1], rr, a[3], null, 0, { glow: a[0] === "H" ? 0 : 8 });
        });
        f.text("ethanol C₂H₅OH", ox, oy + s * 2.2, { size: 12.5, align: "center", mono: true, color: c.dim });
        f.text("functional group –OH", ox, oy + s * 2.2 + 16, { size: 11, align: "center", color: c.d });
      }
      if (f.h > 300) caption(f, "resonance: the six π electrons are shared around the ring");
    }
  });

  /* ============================================================= mechanics */
  FX.define("mechanics", {
    aspect: 1.7, aspectSmall: 1, still: 1.6,
    draw: function (f) {
      var c = f.c, t = f.t, per = 4.2, n = Math.floor(t / per), u = (t % per), g = 9.81;
      var angs = [30, 45, 60, 75], th = (f.reduce ? 45 : angs[n % 4]) * PI / 180, v0 = 24;
      f.clear();
      var gy = f.h - pad(f) - 14, ox = pad(f) + 16, sc = (f.w - 2 * pad(f) - 24) / (v0 * v0 / g * 1.05);
      f.seg(pad(f), gy, f.w - pad(f), gy, f.a(c.ink, 0.35), 1.5);
      for (var x = ox; x < f.w - pad(f); x += sc * 5) f.seg(x, gy, x, gy + 4, f.a(c.ink, 0.3), 1);
      var T = 2 * v0 * sin(th) / g, tt = Math.min(u, T), R = v0 * v0 * sin(2 * th) / g, H = v0 * v0 * sin(th) * sin(th) / (2 * g);
      // ghost trajectories of the other angles
      angs.forEach(function (A) { var a = A * PI / 180, pts = []; for (var k = 0; k <= 40; k++) { var tk = k / 40 * 2 * v0 * sin(a) / g; pts.push([ox + v0 * cos(a) * tk * sc, gy - (v0 * sin(a) * tk - 0.5 * g * tk * tk) * sc]); } f.line(pts, f.a(c.ink, 0.1), 1, { dash: [3, 4] }); });
      var pts = []; for (var k = 0; k <= 60; k++) { var tk = k / 60 * tt; pts.push([ox + v0 * cos(th) * tk * sc, gy - (v0 * sin(th) * tk - 0.5 * g * tk * tk) * sc]); }
      f.line(pts, c.a, 2.4, { glow: 10 });
      var px = ox + v0 * cos(th) * tt * sc, py = gy - (v0 * sin(th) * tt - 0.5 * g * tt * tt) * sc;
      // velocity components
      var vx = v0 * cos(th), vy = v0 * sin(th) - g * tt, vs = sc * 0.9;
      f.arrow(px, py, px + vx * vs, py, c.c, 1.8); f.arrow(px, py, px, py - vy * vs, c.b, 1.8); f.arrow(px, py, px + vx * vs, py - vy * vs, c.ink, 2);
      f.circle(px, py, 6, c.a, null, 0, { glow: 14 });
      // launcher
      f.ctx.save(); f.ctx.translate(ox, gy); f.ctx.rotate(-th); f.box(-4, -5, 26, 10, 3, c.dim); f.ctx.restore(); f.circle(ox, gy, 7, c.dim);
      f.ctx.save(); f.ctx.beginPath(); f.ctx.arc(ox, gy, 28, -th, 0); f.ctx.strokeStyle = f.a(c.b, 0.7); f.ctx.lineWidth = 1.2; f.ctx.stroke(); f.ctx.restore();
      f.text("θ = " + Math.round(th * 180 / PI) + "°", ox + 34, gy - 12, { size: 11, mono: true, color: c.b });
      // range and height
      f.seg(ox + R * sc, gy, ox + R * sc, gy - 8, c.a, 2); f.text("R = " + R.toFixed(1) + " m", ox + R * sc, gy - 16, { size: 10.5, mono: true, color: c.a, align: "center" });
      if (!f.small) {
        f.seg(ox + R * sc / 2, gy - H * sc, ox + R * sc / 2 + 60, gy - H * sc, f.a(c.ink, 0.35), 1, { dash: [3, 3] });
        f.text("H = " + H.toFixed(1) + " m", ox + R * sc / 2 + 64, gy - H * sc, { size: 10.5, mono: true, color: c.dim });
      }
      title(f, "Projectile motion · v₀ = 24 m/s");
      if (!f.small) f.text("x = v₀cosθ·t    y = v₀sinθ·t − ½gt²    R = v₀² sin2θ / g", pad(f), pad(f) + 20, { size: 11.5, mono: true, color: c.dim });
    }
  });

  /* ================================================================ efield */
  FX.define("efield", {
    aspect: 1.7, aspectSmall: 1, still: 1,
    draw: function (f) {
      var c = f.c, t = f.t, s = f.state, key = f.w + "x" + f.h;
      var qx = f.w * 0.32, nx = f.w * 0.68, cy = f.h * 0.52, R = Math.max(10, Math.min(f.w, f.h) * 0.055);
      if (s.key !== key) { // field lines of a dipole, integrated once per size
        s.key = key; s.lines = [];
        for (var i = 0; i < 16; i++) {
          var a = i / 16 * TAU, x = qx + cos(a) * R * 1.1, y = cy + sin(a) * R * 1.1, pts = [[x, y]];
          for (var k = 0; k < 900; k++) {
            var dx1 = x - qx, dy1 = y - cy, r1 = Math.hypot(dx1, dy1) || 1, dx2 = x - nx, dy2 = y - cy, r2 = Math.hypot(dx2, dy2) || 1;
            var ex = dx1 / (r1 * r1 * r1) - dx2 / (r2 * r2 * r2), ey = dy1 / (r1 * r1 * r1) - dy2 / (r2 * r2 * r2), L = Math.hypot(ex, ey) || 1;
            x += ex / L * 3; y += ey / L * 3; pts.push([x, y]);
            if (r2 < R * 1.1 || x < -40 || x > f.w + 40 || y < -40 || y > f.h + 40) break;
          }
          s.lines.push(pts);
        }
      }
      f.clear();
      // equipotentials (faint)
      [0.35, 0.5, 0.7, 1].forEach(function (k) { f.circle(qx, cy, R * (1 + k * 3), null, f.a(c.b, 0.1 + 0.08 * (1 - k)), 1, { dash: [2, 5] }); f.circle(nx, cy, R * (1 + k * 3), null, f.a(c.c, 0.1 + 0.08 * (1 - k)), 1, { dash: [2, 5] }); });
      s.lines.forEach(function (pts, i) {
        f.line(pts, f.a(c.ink, 0.22), 1.2);
        var L = FX.along(pts, 0)[2], nd = Math.max(2, Math.round(L / 60));
        for (var d = 0; d < nd; d++) { var p = FX.along(pts, (t * 0.18 + d / nd + i * 0.03) % 1); if (p[0] > 0 && p[0] < f.w && p[1] > 0 && p[1] < f.h) f.circle(p[0], p[1], 2, c.a, null, 0, { glow: 8 }); }
      });
      f.circle(qx, cy, R, c.b, null, 0, { glow: 22 }); f.text("+", qx, cy + 1, { size: R * 1.5, weight: 800, align: "center", color: "#1a1400" });
      f.circle(nx, cy, R, c.c, null, 0, { glow: 22 }); f.text("−", nx, cy, { size: R * 1.5, weight: 800, align: "center", color: "#021a22" });
      // a test charge released between the plates of the dipole
      var tu = f.reduce ? 0.4 : (t * 0.22) % 1, tp = FX.along(s.lines[3] || [[qx, cy], [nx, cy]], tu);
      f.circle(tp[0], tp[1], 5, "#fff", null, 0, { glow: 14, glowColor: c.a });
      title(f, "Electric dipole · field lines run from + to −");
      caption(f, "E = kq / r² · F = qE · work along an equipotential is zero");
    }
  });

  /* ================================================================ optics */
  FX.define("optics", {
    aspect: 1.7, aspectSmall: 1, still: 2.5,
    draw: function (f) {
      var c = f.c, t = f.t, per = 9, u = f.reduce ? 0.35 : (1 - cos((t % per) / per * TAU)) / 2;
      f.clear();
      var ax = f.h * 0.56, lx = f.w * 0.5, fl = Math.min(f.w * 0.16, 120), lh = f.h * 0.36;
      f.seg(pad(f), ax, f.w - pad(f), ax, f.a(c.ink, 0.3), 1);
      // lens
      f.ctx.save(); f.ctx.beginPath(); f.ctx.moveTo(lx, ax - lh); f.ctx.quadraticCurveTo(lx + lh * 0.32, ax, lx, ax + lh); f.ctx.quadraticCurveTo(lx - lh * 0.32, ax, lx, ax - lh); f.ctx.closePath();
      f.ctx.fillStyle = f.a(c.c, 0.14); f.ctx.fill(); f.ctx.strokeStyle = f.a(c.c, 0.8); f.ctx.lineWidth = 1.6; f.ctx.stroke(); f.ctx.restore();
      [-2, -1, 1, 2].forEach(function (k) { f.seg(lx + k * fl, ax - 5, lx + k * fl, ax + 5, c.b, 1.5); f.text(k === 1 ? "F" : k === -1 ? "F" : "2F", lx + k * fl, ax + 16, { size: 10.5, align: "center", color: c.b, mono: true }); });
      // object moves from 3F to 1.2F; image from the lens formula
      var uo = fl * (3 - 1.8 * u), ho = lh * 0.42, ox = lx - uo, v = 1 / (1 / fl - 1 / uo), hi = -ho * v / uo, ix = lx + v;
      f.arrow(ox, ax, ox, ax - ho, c.a, 2.5, { glow: 10 });
      var ixc = FX.clamp(ix, lx + 10, f.w - pad(f)), scale = (ixc - lx) / (ix - lx);
      // principal rays
      var iy = ax - hi; // image top (below the axis: hi < 0)
      // 1: parallel to the axis, then through F; 2: straight through the centre; 3: through F, then parallel
      f.line([[ox, ax - ho], [lx, ax - ho], [lx + (ixc - lx), ax - ho + (iy - (ax - ho)) * scale]], f.a(c.b, 0.85), 1.4);
      f.line([[ox, ax - ho], [lx + (ixc - lx), ax - ho + (iy - (ax - ho)) * scale]], f.a(c.b, 0.6), 1.2);
      var y3 = ax + ho * fl / (uo - fl);
      f.line([[ox, ax - ho], [lx, y3], [ixc, y3]], f.a(c.b, 0.85), 1.4);
      if (ix < f.w - pad(f)) f.arrow(ix, ax, ix, ax - hi, c.d, 2.5, { glow: 10 });
      var m = (hi / ho);
      if (!f.small) f.text("1/f = 1/u + 1/v", pad(f), pad(f) + 20, { size: 11.5, mono: true, color: c.dim });
      title(f, "Thin convex lens · f = " + fl.toFixed(0) + " units");
      caption(f, "u = " + uo.toFixed(0) + "   v = " + v.toFixed(0) + "   magnification m = " + m.toFixed(2) + (abs(m) > 1 ? " (enlarged, inverted)" : " (diminished, inverted)"));
    }
  });

  /* =============================================================== kinetic */
  FX.define("kinetic", {
    aspect: 1.7, aspectSmall: 1, still: 3,
    init: function (f) { var r = FX.rng(5), p = []; for (var i = 0; i < 56; i++) { var a = r() * TAU; p.push({ x: r(), y: r(), vx: cos(a), vy: sin(a) }); } f.state.p = p; },
    draw: function (f) {
      var c = f.c, s = f.state, t = f.t, per = 14, u = f.reduce ? 0.5 : (1 - cos((t % per) / per * TAU)) / 2;
      var Tk = 250 + 450 * u, speed = Math.sqrt(Tk / 300) * 0.22, piston = 0.72 + 0.26 * (1 - u) * 0.6;
      f.clear();
      var bx = pad(f), by = pad(f) + 16, bw = (f.small ? f.w - 2 * pad(f) : f.w * 0.6), bh = f.small ? f.h * 0.5 : f.h - by - pad(f) - 10;
      f.box(bx, by, bw, bh, 8, c.panel, f.a(c.ink, 0.25), 1.5);
      var px = bx + bw * piston;
      f.box(px, by + 2, 10, bh - 4, 2, c.dim); f.seg(px + 10, by + bh / 2, bx + bw, by + bh / 2, c.dim, 5);
      var dt = f.playing ? Math.min(0.05, f.dt || 0.016) : 0, pr = Math.max(2.4, Math.min(bw, bh) * 0.012);
      s.p.forEach(function (p) {
        p.x += p.vx * speed * dt * 2; p.y += p.vy * speed * dt * 2;
        if (p.x < 0.01) { p.x = 0.01; p.vx = abs(p.vx); } if (p.x > piston - 0.02) { p.x = piston - 0.02; p.vx = -abs(p.vx); }
        if (p.y < 0.02) { p.y = 0.02; p.vy = abs(p.vy); } if (p.y > 0.98) { p.y = 0.98; p.vy = -abs(p.vy); }
        var hot = FX.clamp((Tk - 250) / 450, 0, 1), col = hot > 0.5 ? c.d : c.c;
        f.circle(bx + p.x * bw, by + p.y * bh, pr, col, null, 0, { glow: 6 });
      });
      // thermometer and readouts
      var tx = f.small ? bx + bw - 26 : bx + bw + 30, ty = f.small ? by + bh + 24 : by + 10, th = f.small ? 0 : bh - 60;
      if (!f.small) {
        f.box(tx, ty, 14, th, 7, f.a(c.ink, 0.06), f.a(c.ink, 0.3), 1);
        f.ctx.save(); f.ctx.fillStyle = c.d; f.ctx.fillRect(tx + 3, ty + th - th * (Tk / 700), 8, th * (Tk / 700)); f.ctx.restore(); f.circle(tx + 7, ty + th + 8, 11, c.d, null, 0, { glow: 10 });
        var rx = tx + 40;
        f.text("T = " + Tk.toFixed(0) + " K", rx, ty + 12, { size: 13, weight: 700, mono: true });
        f.text("V = " + (piston * 100).toFixed(0) + " %", rx, ty + 34, { size: 12, mono: true, color: c.dim });
        f.text("P ∝ T / V", rx, ty + 56, { size: 12, mono: true, color: c.a });
        f.text("⟨½mv²⟩ = 3/2 kT", rx, ty + 78, { size: 11.5, mono: true, color: c.dim });
      }
      title(f, "Kinetic theory · PV = nRT");
      caption(f, f.small ? "T = " + Tk.toFixed(0) + " K · P ∝ T/V" : "heating speeds the molecules; pressure pushes the piston back");
    }
  });

  /* ============================================================== pendulum */
  FX.define("pendulum", {
    aspect: 1.7, aspectSmall: 1, still: 2,
    draw: function (f) {
      var c = f.c, t = f.t, g = 9.81, per = 8, n = Math.floor(t / per), u = (t % per);
      var Ls = [0.4, 0.6, 0.8, 1.0, 1.2], L = f.reduce ? 0.8 : Ls[n % Ls.length], T = TAU * Math.sqrt(L / g), th = 0.35 * cos(TAU * u / T) * Math.exp(-u * 0.03);
      f.clear();
      var left = f.small ? f.w : f.w * 0.46, pxc = left * 0.5, py = pad(f) + 10, scale = (f.h * 0.72) / 1.3, bob = 10;
      f.seg(pxc - 40, py, pxc + 40, py, c.dim, 3);
      var bx = pxc + sin(th) * L * scale, by = py + cos(th) * L * scale;
      f.ctx.save(); f.ctx.beginPath(); f.ctx.arc(pxc, py, L * scale, PI / 2 - 0.35, PI / 2 + 0.35); f.ctx.strokeStyle = f.a(c.ink, 0.12); f.ctx.setLineDash([3, 5]); f.ctx.stroke(); f.ctx.restore();
      f.seg(pxc, py, bx, by, f.a(c.ink, 0.7), 1.5); f.circle(bx, by, bob, c.b, null, 0, { glow: 16 });
      f.text("L = " + L.toFixed(1) + " m", pxc, py + L * scale + 26, { size: 11.5, mono: true, align: "center", color: c.dim });
      // stopwatch
      var sw = f.small ? { x: f.w - pad(f) - 72, y: pad(f) } : { x: pad(f), y: f.h - pad(f) - 34 };
      f.box(sw.x, sw.y, 76, 28, 8, "rgba(0,0,0,.35)", f.a(c.ink, 0.25), 1);
      f.text((u % (10 * T)).toFixed(2) + " s", sw.x + 38, sw.y + 14, { size: 13, mono: true, align: "center", color: c.a });
      if (f.small) { caption(f, "T = 2π√(L/g)  →  T = " + T.toFixed(2) + " s"); return; }
      // T² against L: the measured points appear one length at a time
      var pl = f.plot(left + 10, pad(f) + 20, f.w - left - 10 - pad(f), f.h - pad(f) * 2 - 40, [0, 1.4], [0, 6], { nx: 7, ny: 6, xl: "L (m)", yl: "T² (s²)" });
      f.curve(pl, function (l) { return 4 * PI * PI * l / g; }, 0, 1.4, 40, f.a(c.a, 0.5), 1.4, { dash: [4, 4] });
      Ls.forEach(function (l, i) {
        var shown = f.reduce || i <= n % Ls.length, tt = 4 * PI * PI * l / g * (1 + (FX.rng(i + 9)() - 0.5) * 0.06);
        if (!shown) return;
        f.seg(pl.X(l), pl.Y(tt) - 6, pl.X(l), pl.Y(tt) + 6, f.a(c.ink, 0.4), 1);
        f.circle(pl.X(l), pl.Y(tt), 4.5, c.b, null, 0, { glow: 10 });
      });
      f.text("slope = 4π²/g  →  g ≈ " + (9.81 * (1 + (FX.rng(n + 3)() - 0.5) * 0.02)).toFixed(2) + " m/s²", pl.x0 + 10, pl.y0 + pl.h - 14, { size: 11, mono: true, color: c.a });
      title(f, "Simple pendulum · measuring g");
      caption(f, "T = 2π√(L/g) · time 10 swings, divide by 10, plot T² against L");
    }
  });

  /* ================================================================ emwave */
  FX.define("emwave", {
    aspect: 1.7, aspectSmall: 1, still: 1,
    draw: function (f) {
      var c = f.c, t = f.t;
      f.clear();
      var ox = pad(f) + 10, oy = f.h * 0.52, len = f.w - 2 * pad(f) - 30, amp = Math.min(f.h * 0.26, 90), k = TAU / (len / 2.2), w = 2.2;
      var P = function (z, e, b) { return [ox + z + b * 0.55, oy - e - b * 0.3]; }; // oblique projection: z right, E up, B into the page
      f.arrow(ox, oy, ox + len + 12, oy, f.a(c.ink, 0.5), 1.2); f.text("z (propagation)", ox + len + 2, oy + 14, { size: 10, color: c.dim, align: "right" });
      f.arrow(ox, oy, ox, oy - amp - 18, f.a(c.a, 0.6), 1.2); f.text("E", ox - 10, oy - amp - 10, { size: 12, weight: 700, color: c.a, align: "center" });
      f.arrow(ox, oy, ox + amp * 0.55 + 10, oy - amp * 0.3 - 6, f.a(c.c, 0.6), 1.2); f.text("B", ox + amp * 0.55 + 18, oy - amp * 0.3 - 8, { size: 12, weight: 700, color: c.c });
      var eP = [], bP = [], z, i;
      for (i = 0; i <= 160; i++) { z = i / 160 * len; var v = sin(k * z - w * t); eP.push(P(z, amp * v, 0)); bP.push(P(z, 0, amp * v)); }
      // filled ribbons
      f.ctx.save(); f.ctx.globalAlpha = 0.14;
      f.ctx.beginPath(); f.ctx.moveTo(ox, oy); eP.forEach(function (p) { f.ctx.lineTo(p[0], p[1]); }); f.ctx.lineTo(ox + len, oy); f.ctx.closePath(); f.ctx.fillStyle = c.a; f.ctx.fill();
      f.ctx.beginPath(); f.ctx.moveTo(ox, oy); bP.forEach(function (p) { f.ctx.lineTo(p[0], p[1]); }); f.ctx.lineTo(ox + len, oy); f.ctx.closePath(); f.ctx.fillStyle = c.c; f.ctx.fill();
      f.ctx.restore();
      for (i = 0; i <= 24; i++) { z = i / 24 * len; var v2 = sin(k * z - w * t); var e = P(z, amp * v2, 0), b = P(z, 0, amp * v2), o = P(z, 0, 0); f.seg(o[0], o[1], e[0], e[1], f.a(c.a, 0.55), 1.2); f.seg(o[0], o[1], b[0], b[1], f.a(c.c, 0.55), 1.2); }
      f.line(bP, c.c, 2.2, { glow: 8 }); f.line(eP, c.a, 2.4, { glow: 10 });
      // wavefront marker
      var zf = ((w * t) / k) % (len / 2.2) + len * 0.3, pf = P(zf, 0, 0); f.circle(pf[0], pf[1], 4, "#fff", null, 0, { glow: 12, glowColor: c.b });
      f.text("λ", ox + len * 0.5, oy + amp * 0.5 + 18, { size: 12, color: c.b, align: "center" }); f.seg(ox + len * 0.5 - len / 4.4, oy + amp * 0.5 + 8, ox + len * 0.5 + len / 4.4, oy + amp * 0.5 + 8, f.a(c.b, 0.6), 1, { dash: [4, 3] });
      title(f, "Plane electromagnetic wave · E ⊥ B ⊥ k");
      caption(f, "c = 1/√(μ₀ε₀) ≈ 3×10⁸ m/s · E/B = c · Poynting vector S = E × H");
    }
  });

  /* ================================================================= scope */
  FX.define("scope", {
    aspect: 1.7, aspectSmall: 1, still: 1.5,
    draw: function (f) {
      var c = f.c, t = f.t, per = 10, mode = f.reduce ? 0 : Math.floor(t / per) % 3;
      f.clear();
      var sx = pad(f), sy = pad(f) + 4, sw = f.small ? f.w - 2 * pad(f) : f.w * 0.62, sh = f.small ? f.h * 0.56 : f.h - sy - pad(f);
      f.box(sx, sy, sw, sh, 10, "#02110c", f.a(c.ink, 0.25), 1.5);
      f.ctx.save(); f.rr(sx, sy, sw, sh, 10); f.ctx.clip();
      f.grid(sx, sy, sw, sh, sw / 10, "rgba(61,214,140,.1)");
      f.seg(sx, sy + sh / 2, sx + sw, sy + sh / 2, "rgba(61,214,140,.3)", 1); f.seg(sx + sw / 2, sy, sx + sw / 2, sy + sh, "rgba(61,214,140,.3)", 1);
      var pts1 = [], pts2 = [], i, N = 240;
      for (i = 0; i <= N; i++) {
        var x = i / N, ph = x * TAU * 2.5 - t * 4;
        if (mode === 2) { // Lissajous 3:2
          pts1.push([sx + sw / 2 + sin(3 * x * TAU + t) * sw * 0.36, sy + sh / 2 + sin(2 * x * TAU) * sh * 0.36]);
        } else {
          var y1 = sin(ph), y2 = mode === 1 ? (sin(ph) > 0 ? 0.8 : -0.8) : sin(ph * 2 + 1) * 0.5;
          pts1.push([sx + x * sw, sy + sh / 2 - y1 * sh * 0.3]); pts2.push([sx + x * sw, sy + sh / 2 - y2 * sh * 0.3 + (mode === 1 ? 0 : 0)]);
        }
      }
      if (pts2.length) f.line(pts2, c.b, 1.8, { glow: 8 });
      f.line(pts1, c.a, 2.2, { glow: 12 });
      // sweep
      if (mode !== 2) { var swx = sx + ((t * 0.5) % 1) * sw; f.seg(swx, sy, swx, sy + sh, f.a(c.ink, 0.2), 1); }
      f.ctx.restore();
      f.text(["CH1 1 V/div   CH2 500 mV/div   2 ms/div", "CH1 1 V/div   CH2 2 V/div   1 ms/div", "XY mode · 3:2 Lissajous"][mode], sx + 10, sy + sh - 12, { size: 9.5, mono: true, color: "rgba(61,214,140,.75)" });
      f.text(["sine + harmonic", "square from a sine (comparator)", "frequency ratio from the figure"][mode], sx + 10, sy + 12, { size: 10, color: c.dim });
      // multimeter and readouts
      var mx = f.small ? sx : sx + sw + 16, my = f.small ? sy + sh + 14 : sy, mw = f.small ? f.w - 2 * pad(f) : f.w - mx - pad(f);
      var vals = [["V~", (229.3 + 1.5 * sin(t * 1.3)).toFixed(1) + " V"], ["Hz", (50 + 0.03 * sin(t * 0.7)).toFixed(2) + " Hz"], ["A~", (2.14 + 0.04 * sin(t * 2.1)).toFixed(2) + " A"]];
      vals.forEach(function (v, k) {
        var yy = my + k * (f.small ? 0 : 56), xx = mx + (f.small ? k * (mw / 3) : 0), ww = f.small ? mw / 3 - 6 : mw;
        f.box(xx, yy, ww, 46, 8, "rgba(0,0,0,.35)", f.a(c.ink, 0.2), 1);
        f.text(v[0], xx + 10, yy + 23, { size: 11, weight: 700, color: c.dim });
        f.text(v[1], xx + ww - 10, yy + 23, { size: f.small ? 12 : 16, mono: true, align: "right", color: c.b, glow: 6 });
      });
      if (!f.small) { f.text("RMS = Vpeak / √2", mx, my + 3 * 56 + 8, { size: 11, mono: true, color: c.dim }); f.text("accuracy ±(0.5 % + 2 digits)", mx, my + 3 * 56 + 26, { size: 10.5, color: c.dim }); }
    }
  });

  /* ============================================================ transistor */
  FX.define("transistor", {
    aspect: 1.7, aspectSmall: 1, still: 1,
    draw: function (f) {
      var c = f.c, t = f.t, per = 12, u = f.reduce ? 0.5 : (1 - cos((t % per) / per * TAU)) / 2, gain = 4 + 8 * u;
      f.clear();
      var cx = f.w * 0.5, cy = f.h * 0.46, S = Math.min(f.w, f.h) * 0.16;
      // transistor symbol (npn, common emitter)
      f.seg(cx - S * 0.25, cy - S * 0.6, cx - S * 0.25, cy + S * 0.6, c.ink, 3);
      f.seg(cx - S, cy, cx - S * 0.25, cy, c.ink, 2);
      f.seg(cx - S * 0.25, cy - S * 0.3, cx + S * 0.5, cy - S * 0.9, c.ink, 2);
      f.arrow(cx - S * 0.25, cy + S * 0.3, cx + S * 0.5, cy + S * 0.9, c.ink, 2);
      f.circle(cx + S * 0.1, cy, S * 1.15, null, f.a(c.ink, 0.5), 1.4);
      f.text("B", cx - S * 0.75, cy - 12, { size: 11, color: c.dim }); f.text("C", cx + S * 0.62, cy - S * 0.95, { size: 11, color: c.dim }); f.text("E", cx + S * 0.62, cy + S * 1.05, { size: 11, color: c.dim });
      // collector resistor and supply
      f.seg(cx + S * 0.5, cy - S * 0.9, cx + S * 0.5, cy - S * 1.5, c.ink, 2);
      f.box(cx + S * 0.5 - 7, cy - S * 2.1, 14, S * 0.6, 3, null, c.ink, 1.5); f.text("Rc", cx + S * 0.5 + 14, cy - S * 1.8, { size: 10.5, color: c.dim });
      f.seg(cx + S * 0.5, cy - S * 2.1, cx + S * 0.5, cy - S * 2.4, c.ink, 2); if (!f.small) f.text("+Vcc", cx + S * 0.5, cy - S * 2.4 - 10, { size: 10.5, align: "center", color: c.b });
      f.seg(cx + S * 0.5, cy + S * 0.9, cx + S * 0.5, cy + S * 1.4, c.ink, 2); f.seg(cx + S * 0.3, cy + S * 1.4, cx + S * 0.7, cy + S * 1.4, c.ink, 2); f.seg(cx + S * 0.38, cy + S * 1.5, cx + S * 0.62, cy + S * 1.5, c.ink, 1.5); f.seg(cx + S * 0.45, cy + S * 1.6, cx + S * 0.55, cy + S * 1.6, c.ink, 1);
      // input and output waveforms
      var ww = f.small ? f.w * 0.26 : f.w * 0.24, wh = f.h * 0.14, inx = pad(f), iny = cy, outx = f.w - pad(f) - ww, outy = cy - S * 1.2;
      var pts = [], po = [], i;
      for (i = 0; i <= 80; i++) { var x = i / 80, v = sin(x * TAU * 2 - t * 5); pts.push([inx + x * ww, iny - v * wh * 0.25]); po.push([outx + x * ww, outy + v * wh * Math.min(1, gain / 12)]); }
      f.seg(inx, iny, inx + ww, iny, f.a(c.ink, 0.2), 1); f.line(pts, c.a, 2, { glow: 8 }); f.text("v_in · 20 mV", inx, iny - wh * 0.5 - 4, { size: 10.5, mono: true, color: c.a });
      f.seg(inx + ww, iny, cx - S, cy, f.a(c.ink, 0.35), 1.2, { dash: [3, 4] });
      f.seg(outx, outy, outx + ww, outy, f.a(c.ink, 0.2), 1); f.line(po, c.b, 2.2, { glow: 10 }); f.text(f.small ? "v_out ×" + gain.toFixed(0) : "v_out · " + (20 * gain).toFixed(0) + " mV (inverted)", outx + ww, outy - wh - 4, { size: 10.5, mono: true, color: c.b, align: "right" });
      f.seg(cx + S * 0.5, cy - S * 1.2, outx, outy, f.a(c.ink, 0.35), 1.2, { dash: [3, 4] });
      // load line with Q point
      if (!f.small) {
        var pl = f.plot(pad(f), f.h - pad(f) - 18 - f.h * 0.3, f.w * 0.3, f.h * 0.3 - 2, [0, 12], [0, 6], { nx: 4, ny: 3, xl: "V_CE (V)", yl: "I_C (mA)" });
        [0.5, 1, 1.5, 2, 2.5].forEach(function (ib) { f.curve(pl, function (v) { return Math.min(6, ib * 2 * (1 - Math.exp(-v * 3)) * (1 + v * 0.01)); }, 0, 12, 40, f.a(c.ink, 0.25), 1); });
        f.line([[pl.X(12), pl.Y(0)], [pl.X(0), pl.Y(6)]], c.c, 1.8);
        var q = 0.5 + 0.12 * sin(t * 5); f.circle(pl.X(12 * (1 - q)), pl.Y(6 * q), 4.5, "#fff", null, 0, { glow: 12, glowColor: c.b }); f.text("Q", pl.X(12 * (1 - q)) + 8, pl.Y(6 * q) - 8, { size: 11, weight: 700, color: c.b });
      }
      title(f, "Common-emitter amplifier · A_v ≈ −" + gain.toFixed(0));
      caption(f, "I_C = β I_B · the Q point sits mid load line for maximum swing");
    }
  });

  /* ============================================================== junction */
  FX.define("junction", {
    aspect: 1.7, aspectSmall: 1, still: 2,
    init: function (f) { var r = FX.rng(13), h = [], e = []; for (var i = 0; i < 30; i++) { h.push({ x: r() * 0.46, y: 0.1 + r() * 0.8, p: r() }); e.push({ x: 0.54 + r() * 0.46, y: 0.1 + r() * 0.8, p: r() }); } f.state.h = h; f.state.e = e; },
    draw: function (f) {
      var c = f.c, s = f.state, t = f.t, per = 12, u = f.reduce ? 0.7 : (t % per) / per;
      // bias sweeps: reverse (−3 V) → forward (0.8 V)
      var V = -3 + 3.8 * (0.5 - 0.5 * cos(u * TAU)), Wd = 0.09 * Math.sqrt(Math.max(0.05, 0.7 - V)) / Math.sqrt(0.7), I = V > 0 ? 1e-3 * (Math.exp(V / 0.052) - 1) : -0.02;
      f.clear();
      var bx = pad(f), by = pad(f) + 18, bw = f.small ? f.w - 2 * pad(f) : f.w * 0.58, bh = f.small ? f.h * 0.42 : f.h * 0.5, mid = bx + bw / 2;
      f.ctx.save(); f.rr(bx, by, bw, bh, 10); f.ctx.clip();
      f.ctx.fillStyle = f.a(c.d, 0.12); f.ctx.fillRect(bx, by, bw / 2, bh); f.ctx.fillStyle = f.a(c.c, 0.12); f.ctx.fillRect(mid, by, bw / 2, bh);
      f.ctx.fillStyle = f.a(c.ink, 0.06); f.ctx.fillRect(mid - Wd * bw, by, Wd * bw * 2, bh);
      f.ctx.restore();
      f.box(bx, by, bw, bh, 10, null, f.a(c.ink, 0.25), 1.5);
      f.seg(mid - Wd * bw, by, mid - Wd * bw, by + bh, f.a(c.ink, 0.4), 1, { dash: [3, 3] }); f.seg(mid + Wd * bw, by, mid + Wd * bw, by + bh, f.a(c.ink, 0.4), 1, { dash: [3, 3] });
      f.text("p-type", bx + 10, by + 12, { size: 11, weight: 700, color: c.d }); f.text("n-type", bx + bw - 10, by + 12, { size: 11, weight: 700, color: c.c, align: "right" });
      f.text("depletion", mid, by + bh - 10, { size: 10, color: c.dim, align: "center" });
      var fwd = Math.max(0, V - 0.5) * 2, dt = f.playing ? Math.min(0.05, f.dt || 0.016) : 0, pr = Math.max(3, Math.min(bw, bh) * 0.018);
      s.h.forEach(function (p, i) { // holes drift right under forward bias and recombine
        p.x += (0.02 * sin(t * 3 + p.p * 9) + fwd * 0.12) * dt; if (p.x > 0.5 + Wd + 0.05 * p.p) { p.x = 0.02 + p.p * 0.3; } else if (p.x > 0.5 - Wd && fwd < 0.02) p.x = 0.5 - Wd - 0.01;
        var x = bx + p.x * bw, y = by + (p.y + 0.02 * sin(t * 2 + i)) * bh; f.circle(x, y, pr, null, c.d, 1.6, { glow: fwd ? 6 : 0, glowColor: c.d }); f.text("+", x, y + 0.5, { size: pr * 1.6, align: "center", color: c.d });
      });
      s.e.forEach(function (p, i) {
        p.x -= (0.02 * sin(t * 3 + p.p * 9) + fwd * 0.12) * dt; if (p.x < 0.5 - Wd - 0.05 * p.p) { p.x = 0.98 - p.p * 0.3; } else if (p.x < 0.5 + Wd && fwd < 0.02) p.x = 0.5 + Wd + 0.01;
        var x = bx + p.x * bw, y = by + (p.y + 0.02 * cos(t * 2 + i)) * bh; f.circle(x, y, pr * 0.8, c.c, null, 0, { glow: fwd ? 8 : 0 });
      });
      // I–V curve
      var px0 = f.small ? pad(f) : bx + bw + 16, py0 = f.small ? by + bh + 24 : by, pw = f.small ? f.w - 2 * pad(f) : f.w - px0 - pad(f), ph = f.small ? f.h - py0 - pad(f) - 6 : bh;
      var pl = f.plot(px0, py0, pw, ph, [-3, 1], [-0.1, 1], { nx: 4, ny: 4, xl: "V (V)", yl: "I" });
      f.seg(pl.X(0), pl.y0, pl.X(0), pl.y0 + pl.h, f.a(c.ink, 0.25), 1);
      f.curve(pl, function (v) { return v > 0 ? Math.min(1, 1e-3 * (Math.exp(v / 0.052) - 1) / 4.8) : -0.02; }, -3, 0.9, 160, c.a, 2.4, { glow: 10 });
      f.circle(pl.X(Math.min(0.9, V)), pl.Y(V > 0 ? Math.min(1, I / 4.8) : -0.02), 4.5, "#fff", null, 0, { glow: 12, glowColor: c.a });
      f.text(V >= 0 ? "forward " + V.toFixed(2) + " V" : "reverse " + V.toFixed(2) + " V", pl.x0 + 8, pl.y0 + 14, { size: 11, mono: true, color: V >= 0.5 ? c.a : c.dim });
      title(f, "p–n junction diode");
      caption(f, "I = I₀(e^(qV/kT) − 1) · forward bias narrows the depletion region");
    }
  });
})();
