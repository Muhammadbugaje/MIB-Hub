/* course-fx: engineering fundamentals — the design loop and a gear train (design), orthographic projection
   (isometric), a loaded truss (truss), a bending beam with its stress–strain curve (beam), a spring–mass–damper
   (dynamics), the Carnot cycle (carnot), crystal lattices (lattice) and flow past a cylinder (fluid).
   Hero visuals for the 100–200 level ENGG courses; every one also works as a figure. */
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
  function phase(f, per) { return f.reduce ? 0.5 : (f.t % per) / per; }
  function gear(f, x, y, r, n, ang, col, hub) {
    var pts = [], i, m = n * 4, ro = r + r * 0.12, ri = r - r * 0.12;
    for (i = 0; i < m; i++) { var a = ang + i / m * TAU, rr = (i % 4 < 2) ? ro : ri; pts.push([x + cos(a) * rr, y + sin(a) * rr]); }
    f.line(pts, col, 1.6, { close: true, fill: f.a(col, 0.12) });
    f.circle(x, y, r * 0.3, null, f.a(col, 0.8), 1.5); if (hub) f.circle(x, y, 3, col);
    for (i = 0; i < 4; i++) { var b = ang + i * PI / 2; f.seg(x + cos(b) * r * 0.3, y + sin(b) * r * 0.3, x + cos(b) * r * 0.75, y + sin(b) * r * 0.75, f.a(col, 0.6), 2); }
  }

  /* ================================================================ design */
  var STEPS = ["define the problem", "research", "ideate", "prototype", "test", "improve"];
  FX.define("design", {
    aspect: 1.7, aspectSmall: 1, still: 2,
    draw: function (f) {
      var c = f.c, t = f.t, per = 2.4, k = f.reduce ? 3 : Math.floor(t / per) % STEPS.length, u = (t % per) / per;
      f.clear();
      // gear train: the mechanics behind every idea
      var gx = f.w * (f.small ? 0.5 : 0.22), gy = f.h * 0.5, R = Math.min(f.w, f.h) * (f.small ? 0.16 : 0.15);
      var a1 = t * 0.8, n1 = 12, n2 = 16, n3 = 9, r2 = R * n2 / n1, r3 = R * n3 / n1;
      gear(f, gx, gy, R, n1, a1, c.b, true);
      gear(f, gx + R + r2 + 2, gy, r2, n2, -a1 * n1 / n2 + PI / n2, c.a, true);
      gear(f, gx - cos(0.6) * (R + r3 + 2), gy - sin(0.6) * (R + r3 + 2), r3, n3, -a1 * n1 / n3 + PI / n3, c.c, true);
      f.text("ratio " + n2 + ":" + n1 + " · ω₂ = ω₁ × " + n1 + "/" + n2, gx, gy + Math.max(R, r2) + 22, { size: 10.5, mono: true, align: "center", color: c.dim });
      // the design loop
      var cx = f.small ? f.w * 0.5 : f.w * 0.75, cy = f.small ? f.h * 0.5 : f.h * 0.5, Rl = f.small ? 0 : Math.min(f.w * 0.17, f.h * 0.3);
      if (!f.small) {
        f.circle(cx, cy, Rl, null, f.a(c.ink, 0.18), 1.2, { dash: [3, 5] });
        STEPS.forEach(function (s, i) {
          var a = -PI / 2 + i / STEPS.length * TAU, x = cx + cos(a) * Rl, y = cy + sin(a) * Rl, on = i === k;
          f.circle(x, y, on ? 9 : 5, on ? c.b : f.a(c.ink, 0.5), null, 0, { glow: on ? 16 : 0 });
          f.text(s, x + cos(a) * 18, y + sin(a) * 18, { size: on ? 12 : 10.5, weight: on ? 800 : 500, color: on ? c.ink : c.dim, align: abs(cos(a)) < 0.3 ? "center" : cos(a) > 0 ? "left" : "right" });
        });
        var a0 = -PI / 2 + k / STEPS.length * TAU, a1b = a0 + u * TAU / STEPS.length;
        f.ctx.save(); f.ctx.beginPath(); f.ctx.arc(cx, cy, Rl, a0, a1b); f.ctx.strokeStyle = c.b; f.ctx.lineWidth = 3; f.ctx.lineCap = "round"; f.glow(c.b, 10); f.ctx.stroke(); f.ctx.restore();
        f.text("iterate", cx, cy - 8, { size: 13, weight: 800, align: "center", color: c.b }); f.text("the engineering design process", cx, cy + 10, { size: 10.5, align: "center", color: c.dim });
      }
      title(f, "Introduction to engineering");
      caption(f, f.small ? STEPS[k] : "engineers turn a need into a working, safe and affordable solution");
    }
  });

  /* ============================================================= isometric */
  FX.define("isometric", {
    aspect: 1.7, aspectSmall: 1, still: 1,
    draw: function (f) {
      var c = f.c, t = f.t, rot = f.reduce ? 0.7 : t * 0.4;
      f.clear();
      // an L-bracket with a hole, drawn as an edge list in object space (x right, y back, z up)
      var V = [[0, 0, 0], [3, 0, 0], [3, 2, 0], [0, 2, 0], [0, 0, 1], [3, 0, 1], [3, 2, 1], [0, 2, 1], [0, 0, 3], [1, 0, 3], [1, 2, 3], [0, 2, 3], [1, 0, 1], [1, 2, 1]];
      var E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [1, 5], [2, 6], [0, 8], [3, 11], [8, 9], [9, 10], [10, 11], [9, 12], [10, 13], [12, 13], [12, 5], [13, 6], [11, 8]];
      var cx = f.w * (f.small ? 0.5 : 0.33), cy = f.h * 0.56, S = Math.min(f.w, f.h) * 0.11;
      var P = function (p) { var x = p[0] - 1.5, y = p[1] - 1, z = p[2] - 1.5, xr = x * cos(rot) - y * sin(rot), yr = x * sin(rot) + y * cos(rot); return [cx + xr * S, cy + yr * S * 0.5 - z * S * 0.9]; };
      E.forEach(function (e) { var a = P(V[e[0]]), b = P(V[e[1]]); f.seg(a[0], a[1], b[0], b[1], c.a, 1.8, { glow: 6 }); });
      // hole on the top of the base: an ellipse
      var h = P([2, 1, 1]); f.ctx.save(); f.ctx.translate(h[0], h[1]); f.ctx.rotate(rot); f.ctx.beginPath(); f.ctx.ellipse(0, 0, S * 0.45, S * 0.45 * 0.5, 0, 0, TAU); f.ctx.strokeStyle = f.a(c.a, 0.8); f.ctx.lineWidth = 1.4; f.ctx.stroke(); f.ctx.restore();
      V.forEach(function (v) { var p = P(v); f.circle(p[0], p[1], 2, c.b); });
      f.text("isometric view", cx, cy + S * 2.3, { size: 11, align: "center", color: c.dim });
      if (f.small) { title(f, "Engineering drawing"); caption(f, "projection: front, plan and side views"); return; }
      // first-angle projection panels: plan (top), front, side — drawn from the object
      var px = f.w * 0.56, pw = (f.w - px - pad(f) - 12) / 2, ph = (f.h - pad(f) * 2 - 40) / 2, s2 = Math.min(pw, ph) / 4.4;
      function panel(x, y, lab, proj) {
        f.box(x, y, pw, ph, 8, c.panel, f.a(c.ink, 0.12), 1); f.text(lab, x + 8, y + 11, { size: 10, color: c.dim });
        var ox = x + pw / 2, oy = y + ph / 2 + 6;
        E.forEach(function (e) { var a = proj(V[e[0]]), b = proj(V[e[1]]); var hidden = a[2] || b[2]; f.seg(ox + (a[0] - 1.5) * s2, oy - (a[1] - 1.5) * s2, ox + (b[0] - 1.5) * s2, oy - (b[1] - 1.5) * s2, hidden ? f.a(c.ink, 0.35) : c.ink, hidden ? 1 : 1.5, hidden ? { dash: [3, 3] } : null); });
        f.hit({ x: x, y: y, w: pw, h: ph }, lab, "one of the three orthographic views");
      }
      panel(px, pad(f) + 20, "plan (from above)", function (v) { return [v[0], 3 - v[1] + 0.5, false]; });
      panel(px, pad(f) + 32 + ph, "front elevation", function (v) { return [v[0], v[2], v[1] > 1]; });
      panel(px + pw + 12, pad(f) + 32 + ph, "end elevation", function (v) { return [v[1] + 0.5, v[2], v[0] > 1 && v[0] < 3]; });
      f.text("first-angle projection", px + pw + 12, pad(f) + 32, { size: 11, weight: 700 });
      f.text("hidden detail dashed", px + pw + 12, pad(f) + 52, { size: 10.5, color: c.dim }); f.text("the views line up", px + pw + 12, pad(f) + 70, { size: 10.5, color: c.dim });
      title(f, "Engineering drawing · one object, three views");
    }
  });

  /* ================================================================= truss */
  FX.define("truss", {
    aspect: 1.8, aspectSmall: 1, still: 0.3,
    draw: function (f) {
      var c = f.c, t = f.t, per = 7, u = phase(f, per), n = 6;
      f.clear();
      var x0 = pad(f) + 20, x1 = f.w - pad(f) - 20, L = x1 - x0, h = Math.min(f.h * 0.3, L / n * 0.9), yb = f.h * 0.62, yt = yb - h, dx = L / n;
      var pos = (0.5 - 0.5 * cos(u * TAU)), lx = x0 + pos * L; // moving load
      // member forces from the simple statics of a Warren truss under a single moving load
      var RA = 1 - pos, RB = pos, memb = [];
      var i;
      for (i = 0; i < n; i++) {
        var xa = x0 + i * dx, xb = xa + dx, xm = xa + dx / 2;
        var cut = xm, V = cut < lx ? RA : RA - 1; // shear at the panel centre
        var M = cut < lx ? RA * (cut - x0) / L : RA * (cut - x0) / L - (cut - lx) / L; // bending moment (normalised)
        memb.push([[xa, yb], [xb, yb], M / h * L, "bottom chord"]);            // tension when M > 0
        if (i < n - 1) memb.push([[xm, yt], [xm + dx, yt], -M / h * L, "top chord"]); // compression
        memb.push([[xa, yb], [xm, yt], -V * 1.6, "diagonal"]); memb.push([[xm, yt], [xb, yb], V * 1.6, "diagonal"]);
      }
      var maxF = 0; memb.forEach(function (m) { maxF = Math.max(maxF, abs(m[2])); }); maxF = maxF || 1;
      memb.forEach(function (m) { var k = m[2] / maxF, col = k > 0.04 ? c.d : k < -0.04 ? c.c : c.dim; f.seg(m[0][0], m[0][1], m[1][0], m[1][1], col, 1.5 + abs(k) * 4, { glow: abs(k) > 0.5 ? 8 : 0 }); });
      for (i = 0; i <= n; i++) { f.circle(x0 + i * dx, yb, 4, c.ink); if (i < n) f.circle(x0 + i * dx + dx / 2, yt, 4, c.ink); }
      // supports and reactions
      f.line([[x0, yb + 4], [x0 - 12, yb + 22], [x0 + 12, yb + 22]], c.ink, 1.5, { close: true });
      f.line([[x1, yb + 4], [x1 - 12, yb + 22], [x1 + 12, yb + 22]], c.ink, 1.5, { close: true }); f.circle(x1 - 6, yb + 27, 3, null, c.ink, 1); f.circle(x1 + 6, yb + 27, 3, null, c.ink, 1);
      f.arrow(x0, yb + 70, x0, yb + 30, c.a, 2 + RA * 3); f.text("R_A = " + (RA * 100).toFixed(0) + " %", x0 + 8, yb + 56, { size: 10.5, mono: true, color: c.a });
      f.arrow(x1, yb + 70, x1, yb + 30, c.a, 2 + RB * 3); f.text("R_B = " + (RB * 100).toFixed(0) + " %", x1 - 8, yb + 56, { size: 10.5, mono: true, color: c.a, align: "right" });
      // the load: a lorry
      f.box(lx - 22, yb - 24, 44, 16, 3, c.b, null, 0, { glow: 10 }); f.circle(lx - 12, yb - 5, 4, c.ink); f.circle(lx + 12, yb - 5, 4, c.ink);
      f.arrow(lx, yb - 40 - 20, lx, yb - 30, c.b, 2.5); f.text("W", lx + 8, yb - 54, { size: 12, weight: 800, color: c.b });
      title(f, "Warren truss · a moving load");
      caption(f, "red = tension, blue = compression · ΣF = 0, ΣM = 0 at every joint");
    }
  });

  /* ================================================================== beam */
  FX.define("beam", {
    aspect: 1.7, aspectSmall: 1, still: 2.2,
    draw: function (f) {
      var c = f.c, t = f.t, per = 9, u = phase(f, per), P = 0.5 - 0.5 * cos(u * TAU); // load 0 → 1 → 0
      f.clear();
      var bw = f.small ? f.w - 2 * pad(f) - 20 : f.w * 0.56, x0 = pad(f) + 10, x1 = x0 + bw, yb = f.h * (f.small ? 0.3 : 0.36), th = Math.max(8, f.h * 0.05), L = bw;
      var a = x0 + L * 0.5, w = P; // central point load on a simply supported beam
      var defl = function (x) { var xx = (x - x0) / L; var d = xx <= 0.5 ? xx * (3 - 4 * xx * xx) : (1 - xx) * (3 - 4 * (1 - xx) * (1 - xx)); return d / 1 * w * th * 2.2; };
      // deflected shape, fibres coloured by bending stress
      var N = 60, i, top = [], bot = [];
      for (i = 0; i <= N; i++) { var x = x0 + L * i / N, d = defl(x); top.push([x, yb + d - th / 2]); bot.push([x, yb + d + th / 2]); }
      for (i = 0; i < N; i++) { var xx = (i + 0.5) / N, M = xx <= 0.5 ? xx : 1 - xx, k = M * 2 * w; f.ctx.save(); f.ctx.beginPath(); f.ctx.moveTo(top[i][0], top[i][1]); f.ctx.lineTo(top[i + 1][0], top[i + 1][1]); f.ctx.lineTo(bot[i + 1][0], bot[i + 1][1]); f.ctx.lineTo(bot[i][0], bot[i][1]); f.ctx.closePath(); f.ctx.fillStyle = f.a(c.c, 0.12 + k * 0.5); f.ctx.fill(); f.ctx.restore(); }
      f.line(top, c.c, 1.8); f.line(bot, c.d, 1.8); f.text("compression", x0 + 6, yb - th / 2 - 9, { size: 9.5, color: c.c }); f.text("tension", x0 + 6, yb + th / 2 + 10 + defl(x0 + 10), { size: 9.5, color: c.d });
      // supports and load
      f.line([[x0, yb + th / 2 + 2], [x0 - 10, yb + th / 2 + 18], [x0 + 10, yb + th / 2 + 18]], c.ink, 1.5, { close: true }); f.line([[x1, yb + th / 2 + 2], [x1 - 10, yb + th / 2 + 18], [x1 + 10, yb + th / 2 + 18]], c.ink, 1.5, { close: true });
      f.arrow(a, yb - th / 2 - 60 * (0.3 + 0.7 * w), a, yb - th / 2 + defl(a) - 2, c.b, 2.5 + w * 2, { glow: 10 }); f.text("P = " + (w * 20).toFixed(1) + " kN", a + 8, yb - th / 2 - 40, { size: 11, mono: true, color: c.b });
      // bending moment diagram under the beam
      var my = yb + th / 2 + 40, mh = f.h * (f.small ? 0.16 : 0.2);
      f.seg(x0, my, x1, my, f.a(c.ink, 0.35), 1);
      f.line([[x0, my], [a, my + mh * w], [x1, my]], c.a, 2, { close: true, fill: f.a(c.a, 0.15), glow: 8 });
      f.text("bending moment  M_max = PL/4", x0, my + mh + 14, { size: 10.5, mono: true, color: c.a });
      f.text("δ_max = PL³ / 48EI = " + (w * 6.2).toFixed(1) + " mm", x0, my + mh + 30, { size: 10.5, mono: true, color: c.dim });
      if (f.small) { title(f, "Strength of materials"); return; }
      // stress–strain curve with the working point
      var pl = f.plot(x1 + 24, pad(f) + 18, f.w - x1 - 24 - pad(f), f.h - pad(f) * 2 - 30, [0, 1], [0, 1], { nx: 4, ny: 4, xl: "strain ε", yl: "stress σ" });
      var ss = function (e) { return e < 0.22 ? e / 0.22 * 0.62 : e < 0.3 ? 0.62 + (e - 0.22) * 0.5 : 0.66 + 0.3 * (1 - Math.exp(-(e - 0.3) * 6)) - Math.max(0, e - 0.82) * 1.6; };
      f.curve(pl, ss, 0, 0.98, 160, c.ink, 2, { glow: 6 });
      f.seg(pl.X(0), pl.Y(0), pl.X(0.22), pl.Y(0.62), c.a, 2.4, { glow: 8 }); f.text("elastic · σ = Eε", pl.X(0.03), pl.Y(0.75), { size: 10.5, color: c.a });
      f.circle(pl.X(0.22), pl.Y(0.62), 3.5, c.b); f.text("yield", pl.X(0.24), pl.Y(0.58), { size: 10, color: c.b });
      f.circle(pl.X(0.66), pl.Y(ss(0.66)), 3.5, c.d); f.text("UTS", pl.X(0.66), pl.Y(ss(0.66)) - 11, { size: 10, color: c.d, align: "center" });
      var we = 0.2 * w; f.circle(pl.X(we), pl.Y(ss(we)), 5, "#fff", null, 0, { glow: 12, glowColor: c.b }); f.text("working point", pl.X(we) + 8, pl.Y(ss(we)) + 10, { size: 10, color: c.dim });
      title(f, "Strength of materials · bending and the stress–strain curve");
    }
  });

  /* ============================================================== dynamics */
  FX.define("dynamics", {
    aspect: 1.7, aspectSmall: 1, still: 1.5,
    init: function (f) { f.state.hist = []; },
    draw: function (f) {
      var c = f.c, t = f.t, s = f.state, m = 1, k = 4, zeta = 0.08, wn = Math.sqrt(k / m), wd = wn * Math.sqrt(1 - zeta * zeta);
      var x = Math.exp(-zeta * wn * t) * cos(wd * t), v = -Math.exp(-zeta * wn * t) * (zeta * wn * cos(wd * t) + wd * sin(wd * t));
      if (f.reduce) { x = 0.6; v = -0.9; }
      f.clear();
      var wallX = pad(f) + 14, railY = f.h * (f.small ? 0.3 : 0.36), eq = f.small ? f.w * 0.55 : f.w * 0.3, A = f.small ? f.w * 0.18 : f.w * 0.1, bx = eq + x * A, bs = Math.min(f.h * 0.16, 56);
      f.seg(wallX, railY - bs, wallX, railY + bs * 0.6, c.ink, 3); for (var i = 0; i < 6; i++) f.seg(wallX, railY - bs + i * bs * 0.27, wallX - 8, railY - bs + i * bs * 0.27 + 8, f.a(c.ink, 0.5), 1);
      f.seg(wallX, railY + bs * 0.6, f.small ? f.w - pad(f) : f.w * 0.5, railY + bs * 0.6, f.a(c.ink, 0.3), 1);
      // spring
      var sp = [[wallX, railY - bs * 0.3]], n = 12, len = bx - bs / 2 - wallX; for (i = 1; i < n; i++) sp.push([wallX + len * i / n, railY - bs * 0.3 + (i % 2 ? -1 : 1) * bs * 0.22]); sp.push([bx - bs / 2, railY - bs * 0.3]);
      f.line(sp, c.a, 2, { glow: 6 });
      // damper
      f.seg(wallX, railY + bs * 0.25, wallX + len * 0.45, railY + bs * 0.25, c.c, 2); f.box(wallX + len * 0.45, railY + bs * 0.08, len * 0.3, bs * 0.34, 2, null, c.c, 1.5); f.seg(wallX + len * 0.6, railY + bs * 0.12, wallX + len * 0.6, railY + bs * 0.38, c.c, 2.5); f.seg(wallX + len * 0.6, railY + bs * 0.25, bx - bs / 2, railY + bs * 0.25, c.c, 2);
      f.box(bx - bs / 2, railY - bs / 2, bs, bs * 1.1, 6, f.a(c.b, 0.25), c.b, 2, { glow: 10 }); f.text("m", bx, railY + bs * 0.05, { size: 14, weight: 800, align: "center", color: c.b });
      f.seg(eq, railY + bs * 0.65, eq, railY + bs * 0.9, f.a(c.ink, 0.4), 1, { dash: [2, 2] }); f.text("x = 0", eq, railY + bs * 1.05, { size: 9.5, align: "center", color: c.dim });
      if (abs(v) > 0.05) f.arrow(bx, railY - bs * 0.75, bx + v * A * 0.5, railY - bs * 0.75, c.ink, 1.5);
      // energy bars
      var KE = 0.5 * m * v * v, PE = 0.5 * k * x * x, E0 = 0.5 * k, bxx = f.small ? pad(f) : f.w * 0.5 + 10, byy = f.small ? railY + bs * 1.3 : pad(f) + 24, bwd = f.small ? f.w - 2 * pad(f) : f.w * 0.5 - 10 - pad(f);
      [["kinetic ½mv²", KE, c.c], ["potential ½kx²", PE, c.a], ["total", KE + PE, c.b]].forEach(function (b, j) {
        var y = byy + j * 22; f.text(b[0], bxx, y, { size: 10.5, color: c.dim }); f.box(bxx + 100, y - 6, (bwd - 100) * Math.min(1, b[1] / E0), 12, 3, f.a(b[2], 0.8), null, 0, { glow: 6, glowColor: b[2] });
      });
      if (f.small) { title(f, "Spring–mass–damper"); caption(f, "mẍ + cẋ + kx = 0 · ωₙ = √(k/m)"); return; }
      // x(t) trace
      if (f.playing || !s.hist.length) { s.hist.push([t, x]); if (s.hist.length > 600) s.hist.shift(); }
      var pl = f.plot(bxx, byy + 80, bwd, f.h - byy - 80 - pad(f) - 8, [Math.max(0, t - 12), Math.max(12, t)], [-1.1, 1.1], { nx: 6, ny: 4, xl: "t (s)", yl: "x(t)" });
      f.line(s.hist.filter(function (p) { return p[0] >= Math.max(0, t - 12); }).map(function (p) { return [pl.X(p[0]), pl.Y(p[1])]; }), c.b, 2, { glow: 8 });
      f.text("ωₙ = √(k/m) = " + wn.toFixed(2) + " rad/s · T = " + (TAU / wd).toFixed(2) + " s", bxx, byy + 66, { size: 10.5, mono: true, color: c.dim });
      title(f, "Dynamics · mẍ + cẋ + kx = 0");
      caption(f, "energy swaps between kinetic and potential; damping bleeds it away");
    }
  });

  /* ================================================================ carnot */
  FX.define("carnot", {
    aspect: 1.7, aspectSmall: 1, still: 0.3,
    draw: function (f) {
      var c = f.c, t = f.t, per = 12, u = phase(f, per), Th = 600, Tc = 300, R = 1;
      // the four legs: 1→2 isothermal expansion at Th, 2→3 adiabatic expansion, 3→4 isothermal compression at Tc, 4→1 adiabatic compression
      var V1 = 1, V2 = 2.2, g = 1.4, V3 = V2 * Math.pow(Th / Tc, 1 / (g - 1)), V4 = V1 * Math.pow(Th / Tc, 1 / (g - 1));
      function state(uu) { var s = uu * 4, k = Math.floor(s), fr = s - k; if (k === 0) return [V1 + (V2 - V1) * fr, Th, 0]; if (k === 1) { var Vx = V2 + (V3 - V2) * fr; return [Vx, Th * Math.pow(V2 / Vx, g - 1), 1]; } if (k === 2) return [V3 + (V4 - V3) * fr, Tc, 2]; var Vy = V4 + (V1 - V4) * fr; return [Vy, Tc * Math.pow(V4 / Vy, g - 1), 3]; }
      var st = state(u), Vn = st[0], Tn = st[1], Pn = R * Tn / Vn, leg = st[2];
      f.clear();
      var pw = f.small ? f.w - 2 * pad(f) : f.w * 0.55, pl = f.plot(pad(f), pad(f) + 18, pw, f.h - pad(f) * 2 - 30, [0.6, V3 * 1.08], [0, R * Th / V1 * 1.08], { nx: 6, ny: 4, xl: "volume V", yl: "pressure P" });
      // isotherms faint
      [300, 400, 500, 600].forEach(function (T) { f.curve(pl, function (v) { return R * T / v; }, 0.6, V3 * 1.08, 80, f.a(c.ink, 0.1), 1); });
      // the cycle, coloured per leg, with the swept area tinted
      var N = 120, legs = [[], [], [], []], i; for (i = 0; i <= N; i++) { var s2 = state(i / N); legs[FX.clamp(Math.floor(i / N * 4 - 1e-9), 0, 3)].push([pl.X(s2[0]), pl.Y(R * s2[1] / s2[0])]); }
      var poly = legs[0].concat(legs[1], legs[2], legs[3]); f.line(poly, null, 0, { close: true, fill: f.a(c.b, 0.1) });
      var LC = [c.d, c.b, c.c, c.a], LN = ["isothermal expansion · Q_H in", "adiabatic expansion · T falls", "isothermal compression · Q_C out", "adiabatic compression · T rises"];
      legs.forEach(function (L, k2) { f.line(L, f.a(LC[k2], k2 === leg ? 1 : 0.45), k2 === leg ? 3 : 1.6, { glow: k2 === leg ? 10 : 0 }); });
      f.circle(pl.X(Vn), pl.Y(Pn), 5.5, "#fff", null, 0, { glow: 14, glowColor: LC[leg] });
      if (!f.small) f.text(LN[leg], pl.x0 + 10, pl.y0 + pl.h - 14, { size: 11, color: LC[leg] });
      // piston
      var cxp = f.small ? 0 : pw + pad(f) + 30, cw = f.small ? 0 : f.w - cxp - pad(f);
      if (!f.small) {
        var cy = pad(f) + 30, ch = f.h * 0.42, cyl = Math.min(cw * 0.55, 90), gx = cxp + (cw - cyl) / 2, fill = (Vn - 0.6) / (V3 - 0.6);
        f.box(gx, cy, cyl, ch, 6, null, f.a(c.ink, 0.35), 1.5);
        f.ctx.save(); f.ctx.fillStyle = f.a(Tn > 450 ? c.d : c.c, 0.2 + 0.3 * (Tn - 300) / 300); f.ctx.fillRect(gx + 2, cy + ch * (1 - fill) + 8, cyl - 4, ch * fill - 10); f.ctx.restore();
        f.box(gx + 2, cy + ch * (1 - fill), cyl - 4, 8, 2, c.dim); f.seg(gx + cyl / 2, cy + ch * (1 - fill), gx + cyl / 2, cy - 14, c.dim, 4);
        var r2 = FX.rng(3); for (i = 0; i < 24; i++) { var px = gx + 6 + r2() * (cyl - 12), py = cy + ch * (1 - fill) + 12 + r2() * (ch * fill - 16); f.circle(px + sin(t * 4 + i) * 2 * (Tn / 300), py + cos(t * 5 + i) * 2 * (Tn / 300), 1.8, Tn > 450 ? c.d : c.c); }
        f.text("T = " + Tn.toFixed(0) + " K", cxp + cw / 2, cy + ch + 20, { size: 13, weight: 700, mono: true, align: "center", color: Tn > 450 ? c.d : c.c });
        f.text("η = 1 − T_C/T_H = " + ((1 - Tc / Th) * 100).toFixed(0) + " %", cxp + cw / 2, cy + ch + 44, { size: 12, mono: true, align: "center", color: c.b });
        f.text("W = area inside the loop", cxp + cw / 2, cy + ch + 64, { size: 11, align: "center", color: c.dim });
        f.text("hot 600 K · cold 300 K", cxp + cw / 2, cy + ch + 82, { size: 11, align: "center", color: c.dim });
      }
      title(f, "Carnot cycle · the most efficient engine possible");
      if (f.small) caption(f, "η = 1 − T_C/T_H = 50 %  ·  T = " + Tn.toFixed(0) + " K");
    }
  });

  /* =============================================================== lattice */
  var CELLS = { sc: { name: "simple cubic", pts: function () { return corners(); }, cn: 6 }, bcc: { name: "body-centred cubic (Fe, Cr, W)", pts: function () { return corners().concat([[0.5, 0.5, 0.5]]); }, cn: 8 },
    fcc: { name: "face-centred cubic (Cu, Al, Au)", pts: function () { return corners().concat([[0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5]]); }, cn: 12 } };
  function corners() { var p = []; for (var i = 0; i < 8; i++) p.push([i & 1, (i >> 1) & 1, (i >> 2) & 1]); return p; }
  FX.define("lattice", {
    aspect: 1.7, aspectSmall: 1, still: 1,
    draw: function (f) {
      var c = f.c, t = f.t, per = 8, keys = ["sc", "bcc", "fcc"], ionic = f.opts.variant === "ionic", k = f.reduce ? 2 : Math.floor(t / per) % 3, cell = CELLS[keys[k]], rot = t * 0.35, tilt = 0.55;
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.36), cy = f.h * 0.52, S = Math.min(f.w, f.h) * 0.2;
      var P = function (p) { var x = p[0] - 0.5, y = p[1] - 0.5, z = p[2] - 0.5, xr = x * cos(rot) - y * sin(rot), yr = x * sin(rot) + y * cos(rot); return [cx + xr * S * 1.6, cy + yr * S * tilt * 1.6 - z * S * 1.4, yr]; };
      // 2×2×2 block of cells, faint, then the highlighted unit cell
      var E = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]], C = corners();
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) for (var oz = -1; oz <= 0; oz++) {
        if (!(ox || oy || oz)) continue;
        E.forEach(function (e) { var a = P([C[e[0]][0] + ox, C[e[0]][1] + oy, C[e[0]][2] + oz]), b = P([C[e[1]][0] + ox, C[e[1]][1] + oy, C[e[1]][2] + oz]); f.seg(a[0], a[1], b[0], b[1], f.a(c.ink, 0.06), 1); });
      }
      E.forEach(function (e) { var a = P(C[e[0]]), b = P(C[e[1]]); f.seg(a[0], a[1], b[0], b[1], f.a(c.a, 0.7), 1.4); });
      var atoms = ionic ? C.concat([[0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5], [1, 0.5, 0], [0.5, 1, 0], [1, 1, 0.5], [0.5, 0, 1], [0, 0.5, 1], [1, 0.5, 1], [0.5, 1, 1], [0, 1, 0.5], [1, 0, 0.5], [0.5, 0.5, 0.5]]) : cell.pts();
      atoms.map(function (p, i) { var q = P(p); return [q[2], q, p, i]; }).sort(function (a, b) { return a[0] - b[0]; }).forEach(function (o) {
        var p = o[2], q = o[1], centre = p[0] % 1 || p[1] % 1 || p[2] % 1, isNa = ionic && ((p[0] + p[1] + p[2]) % 2 === 1 || (p[0] % 1 && !(p[1] % 1) && !(p[2] % 1))), rr = (ionic ? (isNa ? 0.11 : 0.16) : (centre ? 0.14 : 0.12)) * S * (1 + o[0] * 0.25);
        f.circle(q[0], q[1], rr, ionic ? (isNa ? c.c : c.b) : (centre ? c.b : c.c), null, 0, { glow: 10 });
      });
      var tx = f.small ? pad(f) : Math.min(f.w * 0.7, f.w - pad(f) - 215), ty = f.small ? f.h - pad(f) - 40 : f.h * 0.3;
      if (ionic) {
        f.text("sodium chloride", tx, ty, { size: f.small ? 12 : 15, weight: 700, color: c.b });
        if (!f.small) { f.text("Na⁺ (blue) and Cl⁻ (gold) alternate", tx, ty + 24, { size: 11.5, color: c.dim }); f.text("coordination number 6 : 6", tx, ty + 44, { size: 11.5, mono: true, color: c.ink }); f.text("ionic bonds · high melting point", tx, ty + 64, { size: 11.5, color: c.dim }); f.text("conducts when molten", tx, ty + 84, { size: 11.5, color: c.dim }); }
        title(f, "Ionic lattice");
      } else {
        f.text(cell.name, tx, ty, { size: f.small ? 11.5 : 14, weight: 700, color: c.b });
        if (!f.small) { f.text("atoms per cell: " + (k === 0 ? 1 : k === 1 ? 2 : 4), tx, ty + 24, { size: 12, mono: true, color: c.ink }); f.text("coordination number: " + cell.cn, tx, ty + 44, { size: 12, mono: true, color: c.ink }); f.text("packing factor: " + ["52 %", "68 %", "74 %"][k], tx, ty + 64, { size: 12, mono: true, color: c.ink }); f.text("structure sets strength and conductivity", tx, ty + 92, { size: 11.5, color: c.dim }); }
        title(f, "Crystal structure · the unit cell");
      }
      caption(f, ionic ? "each ion is held by six neighbours of opposite charge" : "gold = atoms inside or on the faces · blue = corners");
    }
  });

  /* ================================================================= fluid */
  FX.define("fluid", {
    aspect: 1.7, aspectSmall: 1, still: 1,
    init: function (f) { var r = FX.rng(9), p = []; for (var i = 0; i < 140; i++) p.push({ x: r(), y: r(), s: 0.7 + r() * 0.6 }); f.state.p = p; },
    draw: function (f) {
      var c = f.c, s = f.state, t = f.t;
      f.clear();
      var bx = pad(f), by = pad(f) + (f.small ? 46 : 18), bw = f.w - 2 * pad(f), bh = f.small ? f.h * 0.46 : f.h * 0.56, hz = f.small ? 18 : 34;
      // a venturi: the channel narrows in the middle
      var top = function (x) { return by + bh * 0.08 + bh * 0.22 * (0.5 - 0.5 * cos(FX.clamp((x - 0.3) / 0.4, 0, 1) * TAU)) * 0 + bh * 0.22 * Math.exp(-Math.pow((x - 0.5) / 0.14, 2)); };
      var bot = function (x) { return by + bh - (top(x) - by); };
      var A = function (x) { return (bot(x) - top(x)) / (bh * 0.84); }; // relative area → speed 1/A
      var ptsT = [], ptsB = [], i; for (i = 0; i <= 80; i++) { var xx = i / 80; ptsT.push([bx + xx * bw, top(xx)]); ptsB.push([bx + xx * bw, bot(xx)]); }
      f.ctx.save(); f.ctx.beginPath(); ptsT.forEach(function (p, j) { if (j) f.ctx.lineTo(p[0], p[1]); else f.ctx.moveTo(p[0], p[1]); }); for (i = ptsB.length - 1; i >= 0; i--) f.ctx.lineTo(ptsB[i][0], ptsB[i][1]); f.ctx.closePath(); f.ctx.fillStyle = f.a(c.c, 0.08); f.ctx.fill(); f.ctx.clip();
      // streamlines
      for (var k = 1; k < 7; k++) { var sl = []; for (i = 0; i <= 80; i++) { var x = i / 80; sl.push([bx + x * bw, top(x) + (bot(x) - top(x)) * k / 7]); } f.line(sl, f.a(c.ink, 0.12), 1); }
      var dt = f.playing ? Math.min(0.05, f.dt || 0.016) : 0;
      s.p.forEach(function (p) {
        var v = 0.12 / A(p.x) * p.s; p.x += v * dt; if (p.x > 1) p.x -= 1;
        var y = top(p.x) + (bot(p.x) - top(p.x)) * p.y, fast = FX.clamp((1 / A(p.x) - 1) / 1.6, 0, 1);
        f.seg(bx + p.x * bw - v * 60, y, bx + p.x * bw, y, f.a(fast > 0.5 ? c.d : c.c, 0.5 + fast * 0.5), 1.6 + fast);
      });
      f.ctx.restore();
      f.line(ptsT, c.ink, 2); f.line(ptsB, c.ink, 2);
      // piezometer heads: pressure drops where the flow is fast
      [0.12, 0.5, 0.88].forEach(function (x) { var v = 1 / A(x), head = 1 - 0.5 * (v * v - 1) / 3.2, hx = bx + x * bw, hy = top(x); f.seg(hx, hy, hx, hy - bh * 0.1 - 1, c.ink, 1); f.box(hx - 4, hy - bh * 0.1 - 2 - head * hz, 8, head * hz, 2, f.a(c.b, 0.85), null, 0, { glow: 6, glowColor: c.b }); f.text("p" + (x < 0.3 ? "₁" : x < 0.7 ? "₂" : "₃"), hx, hy - bh * 0.1 - 10 - head * hz, { size: 10.5, mono: true, color: c.b, align: "center" }); });
      f.text("v₁", bx + bw * 0.12, bot(0.12) + 14, { size: 10.5, mono: true, color: c.c, align: "center" }); f.text("v₂ = v₁ A₁/A₂", bx + bw * 0.5, bot(0.5) + 14, { size: 10.5, mono: true, color: c.d, align: "center" });
      title(f, "Flow through a venturi · Bernoulli");
      caption(f, f.small ? "p + ½ρv² + ρgh = constant" : "A₁v₁ = A₂v₂ · p + ½ρv² + ρgh = constant · faster means lower pressure");
    }
  });
})();
