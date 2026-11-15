/* course-fx: foundation mathematics — sets (venn), algebra (polynomial), trigonometry (unitcircle),
   conic sections (conic), calculus (calculus), vectors (vectors), linear algebra (matrix),
   differential equations and transforms (ode) and statistics (stats). Hero visuals for the 100–300 level
   mathematics courses; every one also works as a figure. Deterministic, transform/alpha only, no DOM. */
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
  function cycle(f, per, n) { return f.reduce ? 0 : Math.floor(f.t / per) % n; }
  function phase(f, per) { return f.reduce ? 0.5 : (f.t % per) / per; }

  /* ================================================================== venn */
  var OPS = [
    ["A ∪ B", function (a, b, c) { return a || b; }], ["A ∩ B", function (a, b, c) { return a && b; }], ["A \\ B", function (a, b, c) { return a && !b; }],
    ["(A ∪ B) ∩ C", function (a, b, c) { return (a || b) && c; }], ["A′ (complement)", function (a, b, c) { return !a; }], ["A ∩ B ∩ C", function (a, b, c) { return a && b && c; }],
    ["A △ B", function (a, b, c) { return a !== b; }]
  ];
  FX.define("venn", {
    aspect: 1.6, aspectSmall: 1, still: 1,
    draw: function (f) {
      var c = f.c, t = f.t, per = 4, k = cycle(f, per, OPS.length), u = phase(f, per), op = OPS[k], fade = Math.min(1, u * 6, (1 - u) * 6);
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.4), cy = f.h * (f.small ? 0.46 : 0.49), R = Math.min(f.w * 0.26, f.h * (f.small ? 0.2 : 0.215)), d = R * 0.58;
      var cs = [[cx - d, cy - d * 0.55, c.a, "A"], [cx + d, cy - d * 0.55, c.b, "B"], [cx, cy + d * 0.75, c.c, "C"]];
      // universal set
      f.box(cx - R * 2.3, cy - R * 2, R * 4.6, R * 4, 14, c.panel, f.a(c.ink, 0.18), 1);
      f.text("U", cx - R * 2.3 + 10, cy - R * 2 + 14, { size: 12, weight: 700, color: c.dim });
      // shaded region, sampled
      f.ctx.save(); f.rr(cx - R * 2.3, cy - R * 2, R * 4.6, R * 4, 14); f.ctx.clip();
      var step = f.small ? 7 : 6;
      for (var y = cy - R * 2; y < cy + R * 2; y += step) for (var x = cx - R * 2.3; x < cx + R * 2.3; x += step) {
        var inA = Math.hypot(x - cs[0][0], y - cs[0][1]) < R, inB = Math.hypot(x - cs[1][0], y - cs[1][1]) < R, inC = Math.hypot(x - cs[2][0], y - cs[2][1]) < R;
        if (op[1](inA, inB, inC)) { var w = 0.5 + 0.5 * sin(t * 2 + (x + y) * 0.03); f.ctx.fillStyle = f.a(c.ink, 0.1 + 0.16 * w * fade); f.ctx.fillRect(x - step / 2, y - step / 2, step - 1, step - 1); }
      }
      f.ctx.restore();
      cs.forEach(function (s) { f.circle(s[0], s[1], R, f.a(s[2], 0.06), s[2], 2, { glow: 10 }); });
      f.text("A", cs[0][0] - R * 0.75, cs[0][1] - R * 0.65, { size: 15, weight: 800, color: c.a }); f.text("B", cs[1][0] + R * 0.75, cs[1][1] - R * 0.65, { size: 15, weight: 800, color: c.b }); f.text("C", cs[2][0], cs[2][1] + R * 0.85, { size: 15, weight: 800, color: c.c, align: "center" });
      // a few elements
      var r = FX.rng(4); for (var i = 0; i < 14; i++) { var ex = cx + (r() - 0.5) * R * 4.2, ey = cy + (r() - 0.5) * R * 3.6; f.circle(ex, ey, 2.2, f.a(c.ink, 0.55)); }
      f.ctx.save(); f.ctx.globalAlpha = fade;
      var lx = Math.min(cx + R * 2.5, f.w - pad(f) - 150);
      f.text(op[0], f.small ? f.w - pad(f) : lx, f.small ? pad(f) + 4 : cy - 20, { size: f.small ? 18 : 30, weight: 800, mono: true, color: c.b, align: f.small ? "right" : "left" });
      if (!f.small) f.text("= { x : the rule holds }", lx, cy + 14, { size: 12, mono: true, color: c.dim });
      f.ctx.restore();
      caption(f, "sets, subsets, union, intersection, complement");
    }
  });

  /* ============================================================ polynomial */
  FX.define("polynomial", {
    aspect: 1.7, aspectSmall: 1, still: 3,
    draw: function (f) {
      var c = f.c, t = f.t, per = 9, u = phase(f, per), k = cycle(f, per, 2);
      // roots move apart and together: p(x) = (x - r1)(x - r2)(x - r3) (cubic) or quadratic
      var s = sin(u * TAU), r1 = -2.2 + 0.4 * s, r2 = 0.3 + 1.1 * s, r3 = 2.4 - 0.5 * s, roots = k ? [r1, r2, r3] : [r1, r3];
      var p = function (x) { var v = 1; roots.forEach(function (r) { v *= (x - r); }); return v * (k ? 0.5 : 0.8); };
      f.clear();
      var pw = f.small ? f.w - 2 * pad(f) : f.w * 0.54, pl = f.plot(pad(f), pad(f) + 18, pw, f.small ? f.h * 0.56 : f.h - pad(f) * 2 - 30, [-4, 4], [-6, 6], { nx: 8, ny: 6, xl: "x", yl: "p(x)" });
      f.seg(pl.X(0), pl.y0, pl.X(0), pl.y0 + pl.h, f.a(c.ink, 0.25), 1);
      // factor areas: sign of each factor shown as faint bands
      roots.forEach(function (r) { f.seg(pl.X(r), pl.y0, pl.X(r), pl.y0 + pl.h, f.a(c.b, 0.25), 1, { dash: [3, 4] }); });
      f.curve(pl, p, -4, 4, 220, c.a, 2.6, { glow: 10 });
      roots.forEach(function (r) { f.circle(pl.X(r), pl.Y(0), 5, "#fff", null, 0, { glow: 14, glowColor: c.b }); f.text(r.toFixed(1), pl.X(r), pl.Y(0) + 14, { size: 10, mono: true, color: c.b, align: "center" }); });
      // turning points (numerical)
      var prev = p(-4), prevD = 0; for (var i = 1; i <= 400; i++) { var x = -4 + 8 * i / 400, v = p(x), dd = v - prev; if (i > 1 && dd * prevD < 0 && abs(v) < 6) f.circle(pl.X(x), pl.Y(v), 3.5, c.c, null, 0, { glow: 8 }); prevD = dd; prev = v; }
      // expanded form
      var co = [1]; roots.forEach(function (r) { var n = new Array(co.length + 1).fill(0); co.forEach(function (a, j) { n[j] += a; n[j + 1] -= a * r; }); co = n; });
      var deg = co.length - 1, terms = co.map(function (a, j) { var pw2 = deg - j, s = abs(a).toFixed(1).replace(/\.0$/, ""); return (a < 0 ? "− " : j ? "+ " : "") + (pw2 ? (s === "1" ? "" : s) + "x" + (pw2 > 1 ? ["", "", "²", "³"][pw2] : "") : s); }).join(" ");
      var tx = f.small ? pad(f) : pad(f) + pw + 16, ty = f.small ? pl.y0 + pl.h + 40 : pad(f) + 40;
      f.text(k ? "cubic" : "quadratic", tx, ty - 22, { size: 11, color: c.dim });
      f.text("p(x) = " + roots.map(function (r) { return "(x" + (r < 0 ? "+" : "−") + abs(r).toFixed(1) + ")"; }).join(""), tx, ty, { size: f.small ? 10.5 : 11.5, mono: true, color: c.b });
      f.text("     = " + terms, tx, ty + 22, { size: f.small ? 10.5 : 11.5, mono: true, color: c.ink });
      if (!f.small) {
        f.text("roots: where p(x) = 0", tx, ty + 60, { size: 11.5, color: c.b });
        f.text("turning points: p′(x) = 0", tx, ty + 80, { size: 11.5, color: c.c });
        f.text(k ? "a cubic has 1 or 3 real roots" : "b² − 4ac: real or complex roots", tx, ty + 100, { size: 11, color: c.dim });
      }
      title(f, "Polynomials · factors and roots");
    }
  });

  /* ============================================================ unitcircle */
  FX.define("unitcircle", {
    aspect: 1.8, aspectSmall: 1, still: 1.1,
    draw: function (f) {
      var c = f.c, t = f.t, th = f.reduce ? 0.9 : (t * 0.9) % TAU;
      f.clear();
      var R = Math.min(f.h * 0.33, f.w * 0.17), cx = pad(f) + R + 30, cy = f.h * 0.5;
      f.seg(cx - R - 20, cy, cx + R + 20, cy, f.a(c.ink, 0.3), 1); f.seg(cx, cy - R - 20, cx, cy + R + 20, f.a(c.ink, 0.3), 1);
      f.circle(cx, cy, R, null, f.a(c.ink, 0.5), 1.5);
      var px = cx + cos(th) * R, py = cy - sin(th) * R;
      f.ctx.save(); f.ctx.beginPath(); f.ctx.moveTo(cx, cy); f.ctx.arc(cx, cy, R * 0.28, 0, -th, true); f.ctx.closePath(); f.ctx.fillStyle = f.a(c.b, 0.25); f.ctx.fill(); f.ctx.restore();
      f.seg(cx, cy, px, py, c.ink, 2);
      f.seg(px, cy, px, py, c.a, 2.5, { glow: 8 }); f.seg(cx, cy, px, cy, c.c, 2.5, { glow: 8 });
      f.circle(px, py, 5, "#fff", null, 0, { glow: 14, glowColor: c.b });
      f.text("θ", cx + cos(th / 2) * R * 0.4, cy - sin(th / 2) * R * 0.4, { size: 12, color: c.b, align: "center" });
      f.text("sin θ", px + (cos(th) >= 0 ? 8 : -8), (cy + py) / 2, { size: 11, color: c.a, align: cos(th) >= 0 ? "left" : "right" });
      f.text("cos θ", (cx + px) / 2, cy + (sin(th) >= 0 ? 12 : -12), { size: 11, color: c.c, align: "center" });
      if (f.small) { caption(f, "θ = " + (th * 180 / PI).toFixed(0) + "°  sin = " + sin(th).toFixed(2) + "  cos = " + cos(th).toFixed(2)); return; }
      // traces: sine and cosine unrolled to the right
      var gx = cx + R + 50, gw = f.w - gx - pad(f), gh = R;
      var pl = f.plot(gx, cy - gh, gw, gh * 2, [0, TAU], [-1, 1], { nx: 4, ny: 4, xl: "θ (rad)" });
      [0, PI / 2, PI, 3 * PI / 2, TAU].forEach(function (v, i) { f.text(["0", "π/2", "π", "3π/2", "2π"][i], pl.X(v), pl.y0 + pl.h + 12, { size: 10, mono: true, color: c.dim, align: "center" }); });
      f.curve(pl, function (x) { return sin(x); }, 0, TAU, 120, f.a(c.a, 0.35), 1.2); f.curve(pl, function (x) { return cos(x); }, 0, TAU, 120, f.a(c.c, 0.35), 1.2);
      f.curve(pl, function (x) { return sin(x); }, 0, th, 120, c.a, 2.4, { glow: 8 }); f.curve(pl, function (x) { return cos(x); }, 0, th, 120, c.c, 2.4, { glow: 8 });
      f.seg(px, py, pl.X(th), pl.Y(sin(th)), f.a(c.a, 0.3), 1, { dash: [3, 4] });
      f.circle(pl.X(th), pl.Y(sin(th)), 4, c.a, null, 0, { glow: 10 }); f.circle(pl.X(th), pl.Y(cos(th)), 4, c.c, null, 0, { glow: 10 });
      f.text("sin²θ + cos²θ = 1", gx, pl.y0 - 12, { size: 12, mono: true, color: c.ink });
      f.text("θ = " + (th * 180 / PI).toFixed(0) + "°  ·  tan θ = " + (abs(cos(th)) < 0.02 ? "∞" : (sin(th) / cos(th)).toFixed(2)), gx + gw, pl.y0 + pl.h + 30, { size: 11.5, mono: true, color: c.b, align: "right" });
      caption(f, "the unit circle generates every trigonometric graph");
    }
  });

  /* ================================================================= conic */
  FX.define("conic", {
    aspect: 1.7, aspectSmall: 1, still: 2.6,
    draw: function (f) {
      var c = f.c, t = f.t, per = 14, u = phase(f, per), e = 0.05 + 1.75 * (0.5 - 0.5 * cos(u * TAU)); // eccentricity 0.05 → 1.8 → back
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.4), cy = f.h * 0.52, L = Math.min(f.w, f.h) * 0.22; // semi-latus rectum
      f.seg(pad(f), cy, f.w - pad(f), cy, f.a(c.ink, 0.2), 1); f.seg(cx, pad(f) + 10, cx, f.h - pad(f) - 10, f.a(c.ink, 0.2), 1);
      // r(θ) = L / (1 + e cos θ) about the focus at (cx, cy)
      var pts = [], pts2 = [], i, N = 400;
      for (i = 0; i <= N; i++) { var th = -PI + TAU * i / N, den = 1 + e * cos(th); if (den > 0.05) { var r = L / den; var x = cx + r * cos(th), y = cy - r * sin(th); if (x > -200 && x < f.w + 200 && y > -200 && y < f.h + 200) pts.push([x, y]); else if (pts.length) { pts2 = pts2.concat(pts, [null]); pts = []; } } else if (pts.length) { pts2 = pts2.concat(pts, [null]); pts = []; } }
      var all = pts2.concat(pts), seg = [];
      all.forEach(function (p) { if (p) seg.push(p); else { f.line(seg, c.a, 2.6, { glow: 12 }); seg = []; } }); f.line(seg, c.a, 2.6, { glow: 12 });
      // directrix x = L/e and the focus
      var dx = cx + L / e; if (dx < f.w) f.seg(dx, pad(f) + 10, dx, f.h - pad(f) - 10, f.a(c.b, 0.6), 1.2, { dash: [5, 4] });
      f.circle(cx, cy, 5, c.b, null, 0, { glow: 14 }); f.text("focus", cx + 8, cy + 12, { size: 10.5, color: c.b });
      if (dx < f.w - 30) f.text("directrix", dx + 6, pad(f) + 20, { size: 10.5, color: c.b });
      // a point on the curve showing PF / PD = e
      var thp = 0.9 + 0.5 * sin(t * 0.7), denp = 1 + e * cos(thp); if (denp > 0.1) { var rp = L / denp, px = cx + rp * cos(thp), py = cy - rp * sin(thp); f.seg(cx, cy, px, py, f.a(c.ink, 0.6), 1.2); if (dx < f.w) f.seg(px, py, dx, py, f.a(c.ink, 0.6), 1.2, { dash: [2, 3] }); f.circle(px, py, 4, "#fff", null, 0, { glow: 10, glowColor: c.a }); }
      var name = e < 0.12 ? "circle" : e < 0.97 ? "ellipse" : e < 1.03 ? "parabola" : "hyperbola";
      var tx = f.small ? f.w - pad(f) : Math.min(f.w * 0.72, f.w - pad(f) - 180), al = f.small ? "right" : "left";
      f.text(name, tx, f.small ? pad(f) + 30 : f.h * 0.3, { size: f.small ? 20 : 32, weight: 800, color: c.b, align: al });
      f.text("e = " + e.toFixed(2), tx, f.small ? pad(f) + 52 : f.h * 0.3 + 30, { size: f.small ? 12 : 15, mono: true, color: c.ink, align: al });
      if (!f.small) {
        f.text("r = ℓ / (1 + e cos θ)", tx, f.h * 0.3 + 58, { size: 12.5, mono: true, color: c.dim });
        f.text("e = PF / PD for every point P", tx, f.h * 0.3 + 80, { size: 12, color: c.dim });
        f.text(["x² + y² = r²", "x²/a² + y²/b² = 1", "y² = 4ax", "x²/a² − y²/b² = 1"][["circle", "ellipse", "parabola", "hyperbola"].indexOf(name)], tx, f.h * 0.3 + 104, { size: 12.5, mono: true, color: c.a });
      }
      title(f, "Conic sections · one family, one eccentricity");
    }
  });

  /* ============================================================== calculus */
  FX.define("calculus", {
    aspect: 1.7, aspectSmall: 1, still: 2.2,
    draw: function (f) {
      var c = f.c, t = f.t, per = 12, u = phase(f, per);
      var fn = function (x) { return 0.25 * x * x * x - 1.2 * x + 1.8 + 0.6 * sin(1.3 * x); }, dfn = function (x) { return 0.75 * x * x - 1.2 + 0.78 * cos(1.3 * x); };
      f.clear();
      var pl = f.plot(pad(f), pad(f) + 18, f.w - 2 * pad(f), f.h - 2 * pad(f) - 30, [-3, 3.2], [-2.5, 5.5], { nx: 6, ny: 4, xl: "x", yl: "y" });
      f.seg(pl.X(0), pl.y0, pl.X(0), pl.y0 + pl.h, f.a(c.ink, 0.25), 1);
      // Riemann sum from a to b with a refining partition, area tint underneath
      var a = -2, b = 1.2, n = 4 + Math.floor(u * 2 * 28) % 29; if (u > 0.5) n = 4 + Math.floor((1 - u) * 2 * 28);
      var tot = 0, i;
      for (i = 0; i < n; i++) { var x0 = a + (b - a) * i / n, x1 = a + (b - a) * (i + 1) / n, h = fn((x0 + x1) / 2); tot += h * (x1 - x0); f.box(pl.X(x0), Math.min(pl.Y(0), pl.Y(h)), pl.X(x1) - pl.X(x0) - 1, abs(pl.Y(h) - pl.Y(0)), 1, f.a(c.b, 0.18), f.a(c.b, 0.6), 1); }
      f.curve(pl, fn, -3, 3.2, 200, c.a, 2.6, { glow: 10 });
      // tangent line sweeping along the curve
      var xt = -2.6 + 5.4 * (0.5 - 0.5 * cos(u * TAU)), yt = fn(xt), m = dfn(xt), dx = 0.9;
      f.line([[pl.X(xt - dx), pl.Y(yt - m * dx)], [pl.X(xt + dx), pl.Y(yt + m * dx)]], c.c, 2.2, { glow: 10 });
      f.line([[pl.X(xt), pl.Y(yt)], [pl.X(xt + 0.6), pl.Y(yt)], [pl.X(xt + 0.6), pl.Y(yt + m * 0.6)]], f.a(c.c, 0.6), 1.2, { dash: [3, 3] });
      f.circle(pl.X(xt), pl.Y(yt), 5, "#fff", null, 0, { glow: 14, glowColor: c.c });
      f.text("dy/dx = " + m.toFixed(2), pl.X(xt) + (xt > 1.2 ? -10 : 10), pl.Y(yt) - 16, { size: 11.5, mono: true, color: c.c, align: xt > 1.2 ? "right" : "left" });
      // stationary points
      var pm = dfn(-3); for (i = 1; i <= 300; i++) { var xx = -3 + 6.2 * i / 300, d = dfn(xx); if (d * pm < 0) f.circle(pl.X(xx), pl.Y(fn(xx)), 3.5, c.b, null, 0, { glow: 8 }); pm = d; }
      f.text("∫ₐᵇ f(x) dx ≈ " + tot.toFixed(3) + "   (n = " + n + " strips)", pl.x0 + 10, pl.y0 + pl.h - 14, { size: 11.5, mono: true, color: c.b });
      title(f, "Calculus · the slope and the area");
      if (!f.small) f.text("derivative = limit of the chord slope · integral = limit of the strip sum", pad(f), pad(f) + 20 - 4, { size: 11, color: c.dim });
    }
  });

  /* =============================================================== vectors */
  FX.define("vectors", {
    aspect: 1.6, aspectSmall: 1, still: 1.2,
    draw: function (f) {
      var c = f.c, t = f.t, rot = f.reduce ? 0.6 : t * 0.35, tilt = 0.5;
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.4), cy = f.h * 0.58, S = Math.min(f.w, f.h) * 0.26;
      var P = function (x, y, z) { var xr = x * cos(rot) - y * sin(rot), yr = x * sin(rot) + y * cos(rot); return [cx + xr * S, cy - z * S * 0.9 + yr * S * tilt]; };
      // ground grid
      for (var g = -1; g <= 1; g += 0.5) { var p1 = P(-1, g, 0), p2 = P(1, g, 0), p3 = P(g, -1, 0), p4 = P(g, 1, 0); f.seg(p1[0], p1[1], p2[0], p2[1], f.a(c.ink, 0.1), 1); f.seg(p3[0], p3[1], p4[0], p4[1], f.a(c.ink, 0.1), 1); }
      var o = P(0, 0, 0), ax = P(1.25, 0, 0), ay = P(0, 1.25, 0), az = P(0, 0, 1.25);
      f.arrow(o[0], o[1], ax[0], ax[1], f.a(c.ink, 0.5), 1.2); f.arrow(o[0], o[1], ay[0], ay[1], f.a(c.ink, 0.5), 1.2); f.arrow(o[0], o[1], az[0], az[1], f.a(c.ink, 0.5), 1.2);
      f.text("x", ax[0] + 8, ax[1], { size: 11, color: c.dim }); f.text("y", ay[0] + 8, ay[1], { size: 11, color: c.dim }); f.text("z", az[0], az[1] - 10, { size: 11, color: c.dim, align: "center" });
      var A = [0.9, 0.25, 0.3], B = [0.2, 0.8, 0.5 + 0.2 * sin(t * 0.8)], Sm = [A[0] + B[0], A[1] + B[1], A[2] + B[2]];
      var X = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
      var pa = P.apply(null, A), pb = P.apply(null, B), ps = P.apply(null, Sm), px = P.apply(null, X);
      // parallelogram
      f.line([o, pa, ps, pb], null, 0, { close: true, fill: f.a(c.b, 0.1) });
      f.line([pa, ps], f.a(c.c, 0.5), 1, { dash: [3, 3] }); f.line([pb, ps], f.a(c.a, 0.5), 1, { dash: [3, 3] });
      f.arrow(o[0], o[1], pa[0], pa[1], c.a, 2.4, { glow: 10 }); f.arrow(o[0], o[1], pb[0], pb[1], c.c, 2.4, { glow: 10 });
      f.arrow(o[0], o[1], ps[0], ps[1], c.b, 2.6, { glow: 12 }); f.arrow(o[0], o[1], px[0], px[1], c.d, 1.8, { glow: 8 });
      f.text("a", pa[0] + 8, pa[1] - 6, { size: 13, weight: 800, color: c.a }); f.text("b", pb[0] + 8, pb[1] - 6, { size: 13, weight: 800, color: c.c });
      f.text("a + b", ps[0] + 8, ps[1] - 8, { size: 13, weight: 800, color: c.b }); f.text("a × b", px[0] + 8, px[1] - 8, { size: 12, weight: 700, color: c.d });
      var dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2], mA = Math.hypot(A[0], A[1], A[2]), mB = Math.hypot(B[0], B[1], B[2]), ang = Math.acos(dot / (mA * mB)) * 180 / PI;
      var tx = f.small ? pad(f) : Math.min(f.w * 0.72, f.w - pad(f) - 215), ty = f.small ? f.h - pad(f) - 40 : f.h * 0.3;
      f.text("a · b = |a||b| cos θ = " + dot.toFixed(2), tx, ty, { size: f.small ? 10.5 : 12, mono: true, color: c.ink });
      f.text("θ = " + ang.toFixed(0) + "°", tx, ty + 20, { size: f.small ? 10.5 : 12, mono: true, color: c.b });
      if (!f.small) {
        f.text("|a × b| = |a||b| sin θ = " + Math.hypot(X[0], X[1], X[2]).toFixed(2), tx, ty + 40, { size: 12, mono: true, color: c.d });
        f.text("a × b is normal to both a and b", tx, ty + 62, { size: 11.5, color: c.dim });
        f.text("parallelogram rule: a + b", tx, ty + 82, { size: 11.5, color: c.dim });
      }
      title(f, "Vectors · sum, dot and cross product");
    }
  });

  /* ================================================================ matrix */
  var MATS = [["rotation", function (u) { var a = u * TAU; return [cos(a), -sin(a), sin(a), cos(a)]; }], ["shear", function (u) { return [1, 1.2 * sin(u * TAU), 0, 1]; }],
    ["scale", function (u) { return [1 + 0.8 * sin(u * TAU), 0, 0, 1 - 0.5 * sin(u * TAU)]; }], ["symmetric", function (u) { var s = sin(u * TAU); return [1 + 0.6 * s, 0.5 * s, 0.5 * s, 1 - 0.3 * s]; }]];
  FX.define("matrix", {
    aspect: 1.7, aspectSmall: 1, still: 1.5,
    draw: function (f) {
      var c = f.c, t = f.t, per = 7, k = cycle(f, per, MATS.length), u = phase(f, per), M = MATS[k][1](u);
      f.clear();
      var cx = f.w * (f.small ? 0.5 : 0.36), cy = f.h * 0.52, S = Math.min(f.w, f.h) * 0.11;
      var T = function (x, y) { return [cx + (M[0] * x + M[1] * y) * S, cy - (M[2] * x + M[3] * y) * S]; };
      // original grid faint, transformed grid bright
      var g, p1, p2;
      for (g = -3; g <= 3; g++) { f.seg(cx + g * S, cy - 3 * S, cx + g * S, cy + 3 * S, f.a(c.ink, 0.08), 1); f.seg(cx - 3 * S, cy - g * S, cx + 3 * S, cy - g * S, f.a(c.ink, 0.08), 1); }
      for (g = -3; g <= 3; g++) { p1 = T(g, -3); p2 = T(g, 3); f.seg(p1[0], p1[1], p2[0], p2[1], f.a(c.a, g === 0 ? 0.7 : 0.3), g === 0 ? 1.6 : 1); p1 = T(-3, g); p2 = T(3, g); f.seg(p1[0], p1[1], p2[0], p2[1], f.a(c.c, g === 0 ? 0.7 : 0.3), g === 0 ? 1.6 : 1); }
      // the unit square and the basis vectors
      var q = [T(0, 0), T(1, 0), T(1, 1), T(0, 1)]; f.line(q, c.b, 1.5, { close: true, fill: f.a(c.b, 0.18) });
      f.arrow(cx, cy, q[1][0], q[1][1], c.a, 2.6, { glow: 10 }); f.arrow(cx, cy, q[3][0], q[3][1], c.c, 2.6, { glow: 10 });
      f.text("î", q[1][0] + 8, q[1][1], { size: 13, weight: 800, color: c.a }); f.text("ĵ", q[3][0], q[3][1] - 10, { size: 13, weight: 800, color: c.c, align: "center" });
      var det = M[0] * M[3] - M[1] * M[2];
      // eigenvectors of a 2x2 (real ones only)
      var tr = M[0] + M[3], disc = tr * tr / 4 - det;
      if (disc >= 0 && k !== 0) [tr / 2 + Math.sqrt(disc), tr / 2 - Math.sqrt(disc)].forEach(function (lam, i) {
        var vx = M[1], vy = lam - M[0]; if (abs(vx) + abs(vy) < 1e-6) { vx = lam - M[3]; vy = M[2]; } if (abs(vx) + abs(vy) < 1e-6) { vx = i ? 0 : 1; vy = i ? 1 : 0; }
        var L = Math.hypot(vx, vy) || 1; vx /= L; vy /= L; var e1 = [cx - vx * S * 3, cy + vy * S * 3], e2 = [cx + vx * S * 3, cy - vy * S * 3];
        f.seg(e1[0], e1[1], e2[0], e2[1], f.a(c.d, 0.7), 1.4, { dash: [6, 4] });
      });
      var tx = f.small ? pad(f) : Math.min(f.w * 0.7, f.w - pad(f) - 205), ty = f.small ? f.h - pad(f) - 48 : f.h * 0.28, fs = f.small ? 11 : 14;
      f.text(MATS[k][0], tx, ty - 24, { size: 12, color: c.dim });
      f.text("⎡ " + M[0].toFixed(2) + "  " + M[1].toFixed(2) + " ⎤", tx, ty, { size: fs, mono: true, color: c.ink });
      f.text("⎣ " + M[2].toFixed(2) + "  " + M[3].toFixed(2) + " ⎦", tx, ty + fs + 4, { size: fs, mono: true, color: c.ink });
      f.text("det = " + det.toFixed(2) + " (area scale)", tx, ty + 2 * fs + 16, { size: f.small ? 10.5 : 12, mono: true, color: c.b });
      if (!f.small) { f.text("columns: the images of î and ĵ", tx, ty + 2 * fs + 40, { size: 11.5, color: c.dim }); f.text("dashed: eigenvectors", tx, ty + 2 * fs + 60, { size: 11.5, color: c.d }); }
      title(f, "Linear maps · a matrix moves the grid");
    }
  });

  /* =================================================================== ode */
  FX.define("ode", {
    aspect: 1.7, aspectSmall: 1, still: 3,
    draw: function (f) {
      var c = f.c, t = f.t, per = 12, u = phase(f, per), zeta = 0.08 + 0.9 * (0.5 - 0.5 * cos(u * TAU)), wn = 1;
      f.clear();
      // x'' + 2ζωn x' + ωn² x = 0 : time response on the left, phase portrait in the middle, s-plane poles on the right
      var cols = f.small ? 1 : 3, gw = (f.w - 2 * pad(f) - (cols - 1) * 16) / cols, gy = pad(f) + 20, gh = f.h - gy - pad(f) - 10;
      var wd = wn * Math.sqrt(Math.max(0, 1 - zeta * zeta)), xt = function (tt) { return zeta < 1 ? Math.exp(-zeta * wn * tt) * (cos(wd * tt) + zeta * wn / (wd || 1) * sin(wd * tt)) : Math.exp(-wn * tt) * (1 + wn * tt); };
      var vt = function (tt) { var h = 1e-3; return (xt(tt + h) - xt(tt - h)) / (2 * h); };
      var pl = f.plot(pad(f), gy, gw, gh, [0, 16], [-1.2, 1.2], { nx: 4, ny: 4, xl: "t", yl: "x(t)" });
      var tm = f.reduce ? 10 : (t * 2) % 16;
      f.curve(pl, xt, 0, 16, 200, f.a(c.a, 0.35), 1.2); f.curve(pl, xt, 0, tm, 200, c.a, 2.4, { glow: 10 });
      f.curve(pl, function (tt) { return Math.exp(-zeta * wn * tt); }, 0, 16, 60, f.a(c.b, 0.5), 1, { dash: [3, 3] }); f.curve(pl, function (tt) { return -Math.exp(-zeta * wn * tt); }, 0, 16, 60, f.a(c.b, 0.5), 1, { dash: [3, 3] });
      f.circle(pl.X(tm), pl.Y(xt(tm)), 4.5, "#fff", null, 0, { glow: 12, glowColor: c.a });
      f.text("ζ = " + zeta.toFixed(2) + (zeta < 0.3 ? " · lightly damped" : zeta < 0.9 ? " · underdamped" : " · critically damped"), pl.x0 + 8, pl.y0 + pl.h - 14, { size: 11, mono: true, color: c.b });
      if (f.small) { title(f, "x″ + 2ζωₙx′ + ωₙ²x = 0"); caption(f, "second-order ODE · damped oscillation"); return; }
      var p2 = f.plot(pad(f) + gw + 16, gy, gw, gh, [-1.3, 1.3], [-1.3, 1.3], { nx: 4, ny: 4, xl: "x", yl: "x′" });
      f.seg(p2.X(0), p2.y0, p2.X(0), p2.y0 + p2.h, f.a(c.ink, 0.25), 1);
      // vector field
      for (var i = -1; i <= 1; i += 0.5) for (var j = -1; j <= 1; j += 0.5) { var dx = j, dy = -2 * zeta * wn * j - wn * wn * i, L = Math.hypot(dx, dy) || 1; f.arrow(p2.X(i), p2.Y(j), p2.X(i + dx / L * 0.18), p2.Y(j + dy / L * 0.18), f.a(c.ink, 0.3), 1, { head: 5 }); }
      var tr = []; for (var k = 0; k <= 200; k++) { var tt = k / 200 * tm; tr.push([p2.X(xt(tt)), p2.Y(vt(tt))]); } f.line(tr, c.c, 2, { glow: 8 });
      f.circle(p2.X(xt(tm)), p2.Y(vt(tm)), 4.5, "#fff", null, 0, { glow: 12, glowColor: c.c });
      f.text("phase portrait", p2.x0 + 8, p2.y0 + 12, { size: 11, color: c.dim });
      var p3 = f.plot(pad(f) + 2 * (gw + 16), gy, gw, gh, [-2.2, 0.6], [-1.4, 1.4], { nx: 4, ny: 4, xl: "σ", yl: "jω" });
      f.seg(p3.X(0), p3.y0, p3.X(0), p3.y0 + p3.h, f.a(c.ink, 0.35), 1);
      f.circle(p3.X(0), p3.Y(0), p3.h / 2.8 * 1, null, f.a(c.ink, 0.15), 1, { dash: [2, 4] });
      var re = -zeta * wn, im = wd;
      if (zeta < 1) { [im, -im].forEach(function (w) { f.seg(p3.X(re) - 6, p3.Y(w) - 6, p3.X(re) + 6, p3.Y(w) + 6, c.d, 2); f.seg(p3.X(re) - 6, p3.Y(w) + 6, p3.X(re) + 6, p3.Y(w) - 6, c.d, 2); }); }
      else { f.seg(p3.X(-wn) - 6, p3.Y(0) - 6, p3.X(-wn) + 6, p3.Y(0) + 6, c.d, 2.5); f.seg(p3.X(-wn) - 6, p3.Y(0) + 6, p3.X(-wn) + 6, p3.Y(0) - 6, c.d, 2.5); }
      f.text("s = −ζωₙ ± jωₙ√(1−ζ²)", p3.x0 + 8, p3.y0 + 12, { size: 10.5, mono: true, color: c.d });
      f.text("Laplace: s² + 2ζωₙs + ωₙ²", p3.x0 + 8, p3.y0 + p3.h - 12, { size: 10.5, mono: true, color: c.dim });
      title(f, "x″ + 2ζωₙx′ + ωₙ²x = 0 · one equation, three pictures");
    }
  });

  /* ================================================================= stats */
  FX.define("stats", {
    aspect: 1.7, aspectSmall: 1, still: 12,
    init: function (f) { f.state.bins = []; f.state.balls = []; f.state.n = 0; f.state.cyc = -1; f.state.next = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, t = f.t, per = 26, cyc = Math.floor(t / per), rows = f.small ? 8 : 10, nb = rows + 1;
      if (cyc !== s.cyc) { s.cyc = cyc; s.bins = new Array(nb).fill(0); s.balls = []; s.n = 0; s.next = t; s.r = FX.rng(cyc * 17 + 5); }
      f.clear();
      var bw = f.small ? f.w - 2 * pad(f) : f.w * 0.5, bx = pad(f), top = pad(f) + 22, pegDy = Math.min(22, (f.h * 0.5) / rows), pegDx = bw / (nb + 1), binH = f.h - top - rows * pegDy - pad(f) - 26, by = top + rows * pegDy + 6;
      var pegX = function (r, k) { return bx + bw / 2 + (k - r / 2) * pegDx; }, pegY = function (r) { return top + r * pegDy; };
      // release a ball every so often (faster as the demo goes on)
      var dt = f.playing ? Math.min(0.05, f.dt || 0.016) : 0, rate = 0.08 + 0.5 * Math.min(1, (t % per) / 12);
      if (f.reduce) { for (var q = 0; q < 180; q++) { var kq = 0; for (var rr = 0; rr < rows; rr++) kq += s.r() < 0.5 ? 0 : 1; s.bins[kq]++; } s.reduceDone = true; }
      while (!f.reduce && t >= s.next && s.n < 400) { s.next += rate; s.n++; var path = [0]; for (var r = 0; r < rows; r++) path.push(path[r] + (s.r() < 0.5 ? 0 : 1)); s.balls.push({ p: path, t: 0, done: false }); }
      // pegs
      for (var i = 0; i < rows; i++) for (var k = 0; k <= i; k++) f.circle(pegX(i, k), pegY(i), 2.2, f.a(c.ink, 0.45));
      // balls
      var fall = 0.22;
      s.balls.forEach(function (b) {
        b.t += dt / fall; var row = Math.floor(b.t), fr = b.t - row;
        if (row >= rows) { if (!b.done) { b.done = true; s.bins[b.p[rows]]++; } return; }
        var x0 = pegX(row, b.p[row]), x1 = pegX(row + 1, b.p[row + 1]), x = x0 + (x1 - x0) * fr, y = pegY(row) + pegDy * fr - 4 * sin(fr * PI);
        f.circle(x, y, 3.2, c.b, null, 0, { glow: 10 });
      });
      s.balls = s.balls.filter(function (b) { return !b.done; });
      // bins
      var total = s.bins.reduce(function (a, b) { return a + b; }, 0) || 1, maxB = Math.max.apply(null, s.bins) || 1;
      var binW = bw / nb;
      for (var j = 0; j < nb; j++) {
        var h = s.bins[j] / maxB * binH, x = bx + j * binW;
        f.box(x + 2, by + binH - h, binW - 4, h, 3, f.a(c.a, 0.75), null, 0, { glow: 6, glowColor: c.a });
        f.seg(x, by, x, by + binH, f.a(c.ink, 0.15), 1);
      }
      f.seg(bx, by + binH, bx + bw, by + binH, f.a(c.ink, 0.35), 1);
      // the normal curve the sum tends to
      var mean = rows / 2, sd = Math.sqrt(rows / 4), pts = [];
      for (var m = 0; m <= 80; m++) { var xv = m / 80 * nb - 0.5, pdf = Math.exp(-0.5 * Math.pow((xv - mean) / sd, 2)) / (sd * Math.sqrt(TAU)); var expected = pdf * total; pts.push([bx + (xv + 0.5) * binW, by + binH - expected / maxB * binH]); }
      f.line(pts, c.c, 2, { glow: 8, dash: [5, 4] });
      var sum = 0, sq = 0; s.bins.forEach(function (n, j) { sum += n * j; sq += n * j * j; }); var mu = sum / total, sg = Math.sqrt(Math.max(0, sq / total - mu * mu));
      var tx = f.small ? pad(f) : bx + bw + 24, ty = f.small ? f.h - pad(f) - 2 : top + 10;
      if (!f.small) {
        f.text("n = " + total, tx, ty, { size: 14, weight: 700, mono: true });
        f.text("mean x̄ = " + mu.toFixed(2), tx, ty + 26, { size: 12.5, mono: true, color: c.a });
        f.text("s.d. s = " + sg.toFixed(2), tx, ty + 46, { size: 12.5, mono: true, color: c.a });
        f.text("binomial(" + rows + ", ½) → normal", tx, ty + 76, { size: 12, color: c.c });
        f.text("μ = np = " + mean.toFixed(1) + "   σ = √(np(1−p)) = " + sd.toFixed(2), tx, ty + 96, { size: 11, mono: true, color: c.dim });
        f.text("the central limit theorem at work", tx, ty + 124, { size: 11.5, color: c.dim });
      }
      title(f, "Galton board · randomness has a shape");
      caption(f, f.small ? "n = " + total + "  x̄ = " + mu.toFixed(2) + "  s = " + sg.toFixed(2) : "each ball makes " + rows + " left/right choices · the heap is binomial");
    }
  });
})();
