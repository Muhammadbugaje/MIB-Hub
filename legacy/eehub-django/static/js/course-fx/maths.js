/* course-fx: mathematics & MATLAB — a MATLAB editor typing a script and drawing its figure (matlab),
   Newton–Raphson iterations (newton), conformal maps of the complex plane (conformal). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;
  var MC = ["#0072BD", "#D95319", "#EDB120", "#7E2F8E"]; // MATLAB default line colours

  /* ================================================================ matlab */
  var SCRIPTS = {
    torque: {
      file: "torque_speed.m",
      code: "% induction motor torque-speed curve\nVth = 230; Rth = 0.4; X = 2.4; R2 = 0.35;\nns = 1500; ws = 2*pi*ns/60;\ns = linspace(0.001, 1, 500);\nT = 3*Vth^2*(R2./s) ./ (ws*((Rth+R2./s).^2 + X^2));\nplot((1-s)*ns, T, 'LineWidth', 2); grid on\nxlabel('Speed (rpm)'); ylabel('Torque (N\\cdotm)')",
      out: ">> torque_speed\n   peak torque 178.3 N·m at 1284 rpm",
      title: "Induction motor torque-speed curve", xl: "Speed (rpm)", yl: "Torque (N·m)",
      plot: function () { var pts = []; for (var i = 0; i <= 200; i++) { var s = 0.001 + i / 200 * 0.999, a = 0.35 / s; pts.push([(1 - s) * 1500, 3 * 230 * 230 * a / (157.08 * ((0.4 + a) * (0.4 + a) + 5.76))]); } return { lines: [pts], xr: [0, 1500], yr: [0, 200] }; }
    },
    step: {
      file: "closed_loop.m",
      code: "s = tf('s');\nG = 1/((s+1)*(0.5*s+1));\nfor K = [1 4 10]\n    step(feedback(K*G, 1)); hold on\nend\ngrid on; legend('K = 1','K = 4','K = 10')",
      out: ">> closed_loop\n   stepinfo: overshoot grows with K",
      title: "Step Response", xl: "Time (seconds)", yl: "Amplitude",
      plot: function () {
        var lines = [1, 4, 10].map(function (K) { var x1 = 0, x2 = 0, pts = [], dt = 0.01; for (var i = 0; i <= 800; i++) { var y = x2, u = K * (1 - y); pts.push([i * dt, y]); x1 += dt * (u - x1); x2 += dt * (x1 - x2) / 0.5; } return pts; });
        return { lines: lines, xr: [0, 8], yr: [0, 1.4] };
      }
    },
    fft: {
      file: "spectrum.m",
      code: "fs = 1000; t = 0:1/fs:0.255;\nx = sin(2*pi*50*t) + 0.35*sin(2*pi*150*t);\nN = numel(x);\nX = abs(fft(x))/N*2;\nf = (0:N-1)*fs/N;\nstem(f(1:N/2), X(1:N/2), 'filled'); grid on\nxlabel('Frequency (Hz)'); ylabel('|X(f)|')",
      out: ">> spectrum\n   N = 256, resolution 3.91 Hz",
      title: "Single-sided spectrum", xl: "Frequency (Hz)", yl: "|X(f)|", stem: true,
      plot: function () { var pts = []; for (var k = 0; k < 128; k++) { var fq = k * 1000 / 256, v = Math.exp(-Math.pow((fq - 50) / 3.2, 2)) + 0.35 * Math.exp(-Math.pow((fq - 150) / 3.2, 2)); pts.push([fq, v]); } return { lines: [pts], xr: [0, 500], yr: [0, 1.1] }; }
    },
    complex: {
      file: "conformal.m",
      code: "[x, y] = meshgrid(-1.2:0.15:1.2);\nz = x + 1i*y;\nw = z.^2;\nplot(real(w), imag(w), 'b'); hold on\nplot(real(w.'), imag(w.'), 'r')\naxis equal; grid on\ntitle('w = z^2')",
      out: ">> conformal",
      title: "w = z²", xl: "Re w", yl: "Im w", eq: true,
      plot: function () {
        var lines = [], v;
        for (v = -1.2; v <= 1.21; v += 0.15) { var a = [], b = []; for (var u = -1.2; u <= 1.21; u += 0.05) { a.push([u * u - v * v, 2 * u * v]); b.push([v * v - u * u, 2 * u * v]); } lines.push(a); lines.push(b); }
        return { lines: lines, xr: [-1.6, 1.6], yr: [-1.6, 1.6], pair: true };
      }
    },
    newton: {
      file: "newton.m",
      code: "f  = @(x) x.^3 - 2*x - 5;\ndf = @(x) 3*x.^2 - 2;\nx = 2;\nfor k = 1:5\n    x = x - f(x)/df(x);\n    fprintf('%d  %.10f\\n', k, x);\nend\nfplot(f, [1 3]); grid on",
      out: ">> newton\n1  2.1000000000\n2  2.0945681211\n3  2.0945514817\n4  2.0945514815",
      title: "f(x) = x³ − 2x − 5", xl: "x", yl: "f(x)",
      plot: function () { var pts = []; for (var i = 0; i <= 200; i++) { var x = 1 + 2 * i / 200; pts.push([x, x * x * x - 2 * x - 5]); } return { lines: [pts], xr: [1, 3], yr: [-7, 17], root: 2.0945515 }; }
    }
  };
  function tokenColour(line) {
    // returns [[text, colour], ...] for a MATLAB-ish line
    var out = [], ci = line.indexOf("%");
    var inStr = false, cut = -1;
    for (var i = 0; i < line.length; i++) { var ch = line[i]; if (ch === "'" && !(i && /[\w)\].']/.test(line[i - 1]) && !inStr)) inStr = !inStr; else if (ch === "%" && !inStr) { cut = i; break; } }
    var code = cut >= 0 ? line.slice(0, cut) : line, com = cut >= 0 ? line.slice(cut) : "";
    code.split(/('(?:[^'])*')/).forEach(function (part, j) {
      if (j % 2 === 1) { out.push([part, "#a709f5"]); return; }
      part.split(/\b(for|end|if|else|while|function|hold|on|grid)\b/).forEach(function (q, k) { if (q) out.push([q, k % 2 === 1 ? "#0e00ff" : "#1f1f1f"]); });
    });
    if (com) out.push([com, "#028009"]);
    return out;
  }
  FX.define("matlab", {
    aspect: 1.75, aspectSmall: 0.72,
    init: function (f) { f.state.t0 = 0; },
    draw: function (f) {
      var c = f.c, hero = f.mode === "hero";
      var key = f.opts.script || "step";
      var cycle = 16;
      if (hero) { var order = ["torque", "step", "fft"]; key = order[Math.floor(f.t / cycle) % 3]; }
      var S = SCRIPTS[key] || SCRIPTS.step;
      if (!S._data) S._data = S.plot();
      var tc = f.reduce ? 99 : (f.t % cycle);
      var typed = Math.floor(tc * 42), codeLen = S.code.length;
      var plotP = FX.clamp((tc - codeLen / 42 - 0.4) / 2.2, 0, 1);
      f.clear();
      var small = f.w / f.h < 1.15;
      // desktop chrome
      f.box(6, 6, f.w - 12, f.h - 12, 12, "#1e1e1e", "rgba(255,255,255,.08)", 1);
      f.box(6, 6, f.w - 12, 26, 12, "#2b2b2b");
      f.ctx.save(); f.ctx.fillStyle = "#2b2b2b"; f.ctx.fillRect(6, 20, f.w - 12, 12); f.ctx.restore();
      ["HOME", "PLOTS", "APPS", "EDITOR"].forEach(function (t, i) { f.text(t, 20 + i * 62, 19, { size: 10, weight: i === 3 ? 800 : 600, color: i === 3 ? "#ff9a3c" : "#c8c8c8" }); });
      f.text("MATLAB", f.w - 20, 19, { size: 10.5, weight: 800, color: "#ff9a3c", align: "right" });
      var ex = 14, ey = 40, ew = small ? f.w - 28 : f.w * 0.5 - 18, eh = small ? f.h * 0.48 : f.h - 54;
      // editor
      f.box(ex, ey, ew, eh, 6, "#ffffff");
      f.box(ex, ey, ew, 20, 6, "#e9eef3"); f.ctx.save(); f.ctx.fillStyle = "#e9eef3"; f.ctx.fillRect(ex, ey + 12, ew, 8); f.ctx.restore();
      f.text(S.file, ex + 10, ey + 10, { size: 10.5, weight: 700, color: "#333" });
      var lines = S.code.slice(0, Math.min(typed, codeLen)).split("\n");
      var fs = small ? 10 : Math.max(10, Math.min(12.5, ew / 46)), lh = fs * 1.45;
      var x = f.ctx;
      lines.forEach(function (ln, i) {
        var yy = ey + 32 + i * lh;
        if (yy > ey + eh - (small ? 8 : 64)) return;
        f.text(String(i + 1), ex + 18, yy, { size: fs - 1.5, mono: true, color: "#9a9a9a", align: "right" });
        var cx = ex + 28;
        x.save(); x.font = "500 " + fs + "px " + c.mono;
        tokenColour(ln).forEach(function (tk) { x.fillStyle = tk[1]; x.textBaseline = "middle"; x.fillText(tk[0], cx, yy); cx += x.measureText(tk[0]).width; });
        x.restore();
        if (i === lines.length - 1 && typed < codeLen && Math.floor(f.t * 3) % 2 === 0) f.seg(cx + 1, yy - fs * 0.6, cx + 1, yy + fs * 0.6, "#000", 1.2);
      });
      // command window
      if (!small) {
        var cwY = ey + eh - 58;
        f.box(ex + 4, cwY, ew - 8, 54, 4, "#f7f7f7", "#dcdcdc", 1);
        f.text("Command Window", ex + 12, cwY + 9, { size: 9, color: "#666", weight: 700 });
        if (plotP > 0) S.out.split("\n").slice(0, 3).forEach(function (o, i) { f.text(o, ex + 12, cwY + 24 + i * 11, { size: 9.5, mono: true, color: "#222" }); });
        else f.text(">> ", ex + 12, cwY + 24, { size: 9.5, mono: true, color: "#222" });
      }
      // figure window
      var fx0 = small ? 14 : ex + ew + 12, fy0 = small ? ey + eh + 10 : ey, fw = small ? f.w - 28 : f.w - fx0 - 14, fh = small ? f.h - fy0 - 14 : eh;
      f.box(fx0, fy0, fw, fh, 6, "#f0f0f0", "rgba(0,0,0,.2)", 1);
      f.box(fx0, fy0, fw, 20, 6, "#dfe5ea"); f.ctx.save(); f.ctx.fillStyle = "#dfe5ea"; f.ctx.fillRect(fx0, fy0 + 12, fw, 8); f.ctx.restore();
      f.text("Figure 1", fx0 + 10, fy0 + 10, { size: 10.5, weight: 700, color: "#333" });
      var ax = fx0 + 46, ay = fy0 + 44, aw = fw - 62, ah = fh - 86;
      if (aw < 40 || ah < 30) return;
      f.box(ax, ay, aw, ah, 0, "#ffffff", "#262626", 1);
      var D = S._data, X = function (v) { return ax + (v - D.xr[0]) / (D.xr[1] - D.xr[0]) * aw; }, Y = function (v) { return ay + ah - (v - D.yr[0]) / (D.yr[1] - D.yr[0]) * ah; };
      x.save(); x.strokeStyle = "#e6e6e6"; x.lineWidth = 1; x.beginPath();
      for (var g = 1; g < 5; g++) { x.moveTo(ax + aw * g / 5, ay); x.lineTo(ax + aw * g / 5, ay + ah); x.moveTo(ax, ay + ah * g / 5); x.lineTo(ax + aw, ay + ah * g / 5); }
      x.stroke(); x.restore();
      for (var tk = 0; tk <= 5; tk++) {
        var xv = D.xr[0] + (D.xr[1] - D.xr[0]) * tk / 5, yv = D.yr[0] + (D.yr[1] - D.yr[0]) * tk / 5;
        f.text(+xv.toFixed(2) + "", ax + aw * tk / 5, ay + ah + 10, { size: 9, color: "#333", align: "center" });
        f.text(+yv.toFixed(2) + "", ax - 5, ay + ah - ah * tk / 5, { size: 9, color: "#333", align: "right" });
      }
      f.text(S.title, ax + aw / 2, ay - 12, { size: 11, weight: 700, color: "#111", align: "center" });
      f.text(S.xl, ax + aw / 2, ay + ah + 24, { size: 10, color: "#222", align: "center" });
      if (plotP > 0) {
        x.save(); x.beginPath(); x.rect(ax, ay, aw, ah); x.clip();
        D.lines.forEach(function (pts, li) {
          var n = Math.max(2, Math.round(pts.length * plotP));
          var col = D.pair ? (li % 2 ? "#ff0000" : "#0000ff") : MC[li % MC.length];
          if (S.stem) {
            for (var i = 0; i < n; i++) { var p = pts[i]; f.seg(X(p[0]), Y(0), X(p[0]), Y(p[1]), col, 1); f.circle(X(p[0]), Y(p[1]), 2.2, col); }
          } else f.line(pts.slice(0, n).map(function (p) { return [X(p[0]), Y(p[1])]; }), col, D.pair ? 1 : 2);
        });
        if (D.root) { f.seg(ax, Y(0), ax + aw, Y(0), "#888", 1, { dash: [3, 3] }); if (plotP >= 1) f.circle(X(D.root), Y(0), 4, "#D95319"); }
        x.restore();
        if (key === "step" && plotP >= 1) ["K = 1", "K = 4", "K = 10"].forEach(function (l, i) { f.box(ax + aw - 64, ay + 8 + i * 13, 10, 3, 0, MC[i]); f.text(l, ax + aw - 50, ay + 10 + i * 13, { size: 9, color: "#222" }); });
      }
    }
  });

  /* ================================================================ newton */
  var FUNCS = {
    cubic: { f: function (x) { return x * x * x - 2 * x - 5; }, d: function (x) { return 3 * x * x - 2; }, xr: [0, 3.4], yr: [-12, 20], lab: "x³ − 2x − 5", x0: 2.0 },
    cosx: { f: function (x) { return cos(x) - x; }, d: function (x) { return -sin(x) - 1; }, xr: [-1, 3], yr: [-3.5, 2], lab: "cos x − x", x0: 2.5 },
    sqrt2: { f: function (x) { return x * x - 2; }, d: function (x) { return 2 * x; }, xr: [0, 4], yr: [-3, 14], lab: "x² − 2", x0: 3.5 }
  };
  FX.define("newton", {
    aspect: 1.75, aspectSmall: 0.8,
    controls: [
      { key: "fn", label: "Function", type: "select", value: "cubic", options: [["cubic", "x³−2x−5"], ["cosx", "cos x − x"], ["sqrt2", "x² − 2"]] },
      { key: "x0", label: "Start x₀", min: 0.2, max: 3.3, step: 0.05, value: 2.0, fmt: function (v) { return v.toFixed(2); } }
    ],
    init: function (f) { f.state.t0 = 0; },
    onChange: function (f) { f.state.t0 = f.t; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var F = FUNCS[hero ? "cubic" : (f.v.fn || "cubic")], x0 = hero ? [2.6, 1.35, 3.1][Math.floor(f.t / 8) % 3] : (f.v.x0 == null ? F.x0 : f.v.x0);
      x0 = FX.clamp(x0, F.xr[0] + 0.05, F.xr[1] - 0.05);
      var it = [x0];
      for (var k = 0; k < 6; k++) { var xn = it[it.length - 1], d = F.d(xn); if (Math.abs(d) < 1e-9) break; var nx = xn - F.f(xn) / d; if (!isFinite(nx) || Math.abs(nx) > 1e3) break; it.push(nx); }
      var tc = f.reduce ? 99 : (hero ? f.t % 8 : f.t - s.t0);
      var shown = Math.min(it.length - 1, Math.floor(tc / 1.1));
      var sub = FX.clamp((tc % 1.1) / 0.8, 0, 1);
      f.clear();
      var small = f.w / f.h < 1.2;
      var pw = small ? f.w - 32 : f.w * 0.66;
      var pl = f.plot(16, 16, pw, small ? f.h * 0.6 : f.h - 32, F.xr, F.yr, { nx: 8, ny: 5, xl: "x", yl: "f(x) = " + F.lab });
      f.seg(pl.X(F.xr[0]), pl.Y(0), pl.X(F.xr[1]), pl.Y(0), f.a(c.ink, 0.5), 1.2);
      f.curve(pl, F.f, F.xr[0], F.xr[1], 260, c.c, 2.6, { glow: 10 });
      var x = f.ctx; x.save(); x.beginPath(); x.rect(pl.x0, pl.y0, pl.w, pl.h); x.clip();
      for (var i = 0; i <= shown && i < it.length - 1; i++) {
        var a = it[i], fa = F.f(a), b = it[i + 1], frac = i < shown ? 1 : sub;
        f.seg(pl.X(a), pl.Y(0), pl.X(a), pl.Y(fa), f.a(c.ink, 0.45), 1, { dash: [3, 3] });
        var bx = a + (b - a) * frac, by = fa * (1 - frac);
        f.seg(pl.X(a), pl.Y(fa), pl.X(bx), pl.Y(by), c.b, 2.2, { glow: 10 });
        // tangent extension
        f.seg(pl.X(a - (b - a) * 0.6), pl.Y(fa + fa * 0.6), pl.X(a), pl.Y(fa), f.a(c.b, 0.35), 1.2);
        f.circle(pl.X(a), pl.Y(fa), 4, c.b, null, 0, { glow: 10, glowColor: c.b });
        f.circle(pl.X(a), pl.Y(0), 3.5, "#fff");
        f.text("x" + "₀₁₂₃₄₅₆"[i], pl.X(a), pl.Y(0) + 13, { size: 11, color: c.ink, align: "center", weight: 700 });
      }
      x.restore();
      // table of iterates
      var tx = small ? 20 : pl.x0 + pw + 24, ty = small ? pl.y0 + pl.h + 22 : 30;
      f.text("k   x_k", tx, ty, { size: 11, mono: true, color: c.dim, weight: 700 });
      var root = it[it.length - 1];
      for (var j = 0; j <= Math.min(shown, it.length - 1) && j < (small ? 4 : 7); j++) {
        var str = it[j].toFixed(10), good = 0;
        var rs = root.toFixed(10); while (good < str.length && str[good] === rs[good]) good++;
        var yy = ty + 18 + j * (small ? 15 : 19);
        if (small && j >= 4) break;
        f.text(j + "   ", tx, yy, { size: 11.5, mono: true, color: c.dim });
        x.save(); x.font = "600 11.5px " + c.mono; x.textBaseline = "middle";
        var w0 = x.measureText("0   ").width;
        x.fillStyle = c.a; x.fillText(str.slice(0, good), tx + w0, yy);
        x.fillStyle = f.a(c.ink, 0.55); x.fillText(str.slice(good), tx + w0 + x.measureText(str.slice(0, good)).width, yy);
        x.restore();
      }
      if (!small) f.text("green = correct digits", tx, ty + 18 + 7 * 19 + 4, { size: 10, color: c.a });
    }
  });

  /* ============================================================= conformal */
  var MAPS = {
    sq: { f: function (x, y) { return [x * x - y * y, 2 * x * y]; }, lab: "w = z²", dom: [[-1.2, 1.2], [-1.2, 1.2]], view: 1.6 },
    exp: { f: function (x, y) { var e = Math.exp(x); return [e * cos(y), e * sin(y)]; }, lab: "w = eᶻ", dom: [[-1, 1], [-PI, PI]], view: 2.9 },
    inv: { f: function (x, y) { var d = x * x + y * y || 1e-9; return [x / d, -y / d]; }, lab: "w = 1/z", dom: [[0.4, 2], [-1.6, 1.6]], view: 2.6 },
    jk: { f: function (x, y) { var d = x * x + y * y || 1e-9; return [x + x / d, y - y / d]; }, lab: "w = z + 1/z (Joukowski)", polar: true, view: 2.7 }
  };
  FX.define("conformal", {
    aspect: 2.0, aspectSmall: 0.6,
    controls: [{ key: "m", label: "Map", type: "select", value: "sq", options: [["sq", "z²"], ["exp", "eᶻ"], ["inv", "1/z"], ["jk", "Joukowski"]] }],
    draw: function (f) {
      var c = f.c, hero = f.mode === "hero";
      var key = hero ? ["sq", "exp", "jk", "inv"][Math.floor(f.t / 7) % 4] : (f.v.m || "sq"), M = MAPS[key];
      var tc = f.reduce ? 3 : (hero ? f.t % 7 : f.t % 7);
      var s = FX.ease((tc < 3.5 ? tc : 7 - tc) / 2.6);
      f.clear();
      var small = f.w / f.h < 1.2;
      var size = small ? Math.min(f.w - 32, (f.h - 40) / 2) : Math.min(f.h - 40, (f.w - 60) / 2);
      var lc = small ? [f.w / 2, 20 + size / 2] : [f.w / 2 - size / 2 - 14, f.h / 2];
      var rc = small ? [f.w / 2, f.h - 20 - size / 2] : [f.w / 2 + size / 2 + 14, f.h / 2];
      if (hero) { size = Math.min(f.w, f.h) * 0.86; rc = [f.w / 2, f.h / 2]; }
      var families = [];
      if (M.polar) {
        for (var r = 1.05; r <= 2.0; r += 0.19) { var a = []; for (var th = 0; th <= TAU + 0.01; th += 0.06) a.push([r * cos(th), r * sin(th)]); families.push([a, 0]); }
        for (var k = 0; k < 24; k++) { var t = k / 24 * TAU, b = []; for (var rr = 1.0; rr <= 2.0; rr += 0.05) b.push([rr * cos(t), rr * sin(t)]); families.push([b, 1]); }
      } else {
        var dx = M.dom[0], dy = M.dom[1], nx = 12, ny = 12, i, u;
        for (i = 0; i <= ny; i++) { var yv = dy[0] + (dy[1] - dy[0]) * i / ny, h = []; for (u = 0; u <= 60; u++) h.push([dx[0] + (dx[1] - dx[0]) * u / 60, yv]); families.push([h, 0]); }
        for (i = 0; i <= nx; i++) { var xv = dx[0] + (dx[1] - dx[0]) * i / nx, v = []; for (u = 0; u <= 60; u++) v.push([xv, dy[0] + (dy[1] - dy[0]) * u / 60]); families.push([v, 1]); }
      }
      var zview = M.polar ? 2.2 : Math.max(Math.abs(M.dom[0][0]), Math.abs(M.dom[0][1]), Math.abs(M.dom[1][0]), Math.abs(M.dom[1][1])) * 1.1;
      function panel(ctr, view, pts, col, w) {
        var sc = size / 2 / view;
        f.line(pts.map(function (p) { return [ctr[0] + p[0] * sc, ctr[1] - p[1] * sc]; }), col, w);
      }
      function frame(ctr, lab) {
        f.box(ctr[0] - size / 2, ctr[1] - size / 2, size, size, 10, c.panel, f.a(c.ink, 0.1), 1);
        f.seg(ctr[0] - size / 2, ctr[1], ctr[0] + size / 2, ctr[1], f.a(c.ink, 0.2), 1); f.seg(ctr[0], ctr[1] - size / 2, ctr[0], ctr[1] + size / 2, f.a(c.ink, 0.2), 1);
        if (lab) f.text(lab, ctr[0] - size / 2 + 10, ctr[1] - size / 2 + 14, { size: 11.5, weight: 700, color: c.ink });
      }
      if (!hero) {
        frame(lc, "z-plane");
        families.forEach(function (fm) { panel(lc, zview, fm[0], fm[1] ? f.a(c.c, 0.75) : f.a(c.a, 0.75), 1.2); });
      }
      frame(rc, hero ? "" : M.lab);
      var view = s * M.view + (1 - s) * zview;
      var x = f.ctx; x.save(); x.beginPath(); x.rect(rc[0] - size / 2, rc[1] - size / 2, size, size); x.clip();
      families.forEach(function (fm) {
        var pts = fm[0].map(function (p) { var w = M.f(p[0], p[1]); return [p[0] + (w[0] - p[0]) * s, p[1] + (w[1] - p[1]) * s]; });
        panel(rc, view, pts, fm[1] ? c.c : c.a, 1.5);
      });
      x.restore();
      if (hero) { f.text(M.lab, rc[0] - size / 2 + 12, rc[1] - size / 2 + 16, { size: 13, weight: 700, mono: true, color: c.ink }); return; }
      if (!small) f.arrow(lc[0] + size / 2 + 4, f.h / 2, rc[0] - size / 2 - 4, f.h / 2, c.b, 2, { head: 7 });
      f.text(s > 0.98 ? "mapped" : s < 0.02 ? "original grid" : "morphing…", rc[0] + size / 2 - 10, rc[1] + size / 2 - 12, { size: 10.5, align: "right", color: c.dim });
    }
  });
})();
