/* EE Hub MATLAB-compatible runner: Control System Toolbox basics used in EEEN 316 / 519 and COEN 333 / 407.
   Continuous-time SISO transfer functions only: tf, pole, zero, feedback, series, parallel, step, impulse, lsim,
   bode, margin, rlocus, nyquist, pzmap, stepinfo, damp, residue. Anything else says "run this in real MATLAB". */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./mlab.js")); else factory(root.MLab); })(typeof self !== "undefined" ? self : this, function (MLab) {
  "use strict";
  var _ = MLab._, B = MLab.B, err = _.err, text = _.text, isText = _.isText, num = _.num, scalar = _.scalar, M = _.M, str = _.str, fmtG = _.fmtG;
  function trim(p) { p = p.slice(); while (p.length > 1 && p[0] === 0) p.shift(); return p; }
  function TF(n, d) { n = trim(n); d = trim(d); if (d.length === 1 && d[0] === 0) throw err("The denominator of a transfer function cannot be zero."); return { t: "tf", num: n, den: d }; }
  function padd(a, b, sb) { var n = Math.max(a.length, b.length), o = new Array(n).fill(0); a.forEach(function (v, i) { o[n - a.length + i] += v; }); b.forEach(function (v, i) { o[n - b.length + i] += (sb || 1) * v; }); return o; }
  function pmul(a, b) { return _.conv(a, b); }
  function asTF(v) { if (v.t === "tf") return v; if (v.t === "m" && v.d.length === 1 && !v.im) return TF([v.d[0]], [1]); throw err("Transfer functions can only be combined with other transfer functions or real scalars."); }
  function tfop(op, a, b) {
    if (op === "^" || op === ".^") { var G = asTF(a), p = scalar(b); if (p !== Math.floor(p)) throw err("A transfer function can only be raised to an integer power."); var r = TF([1], [1]), base = p < 0 ? TF(G.den, G.num) : G; for (var i = 0; i < Math.abs(p); i++) r = TF(pmul(r.num, base.num), pmul(r.den, base.den)); return r; }
    var x = asTF(a), y = asTF(b);
    switch (op) {
      case "+": return TF(padd(pmul(x.num, y.den), pmul(y.num, x.den)), pmul(x.den, y.den));
      case "-": return TF(padd(pmul(x.num, y.den), pmul(y.num, x.den), -1), pmul(x.den, y.den));
      case "*": case ".*": return TF(pmul(x.num, y.num), pmul(x.den, y.den));
      case "/": case "./": if (y.num.length === 1 && y.num[0] === 0) throw err("Division by a zero transfer function."); return TF(pmul(x.num, y.den), pmul(x.den, y.num));
      case "\\": return TF(pmul(y.num, x.den), pmul(y.den, x.num));
    }
    throw err("Operator '" + op + "' is not supported for transfer functions.");
  }
  function polyStr(p) {
    var n = p.length - 1, s = "";
    p.forEach(function (c, i) {
      if (c === 0 && p.length > 1) return; var pw = n - i, a = Math.abs(c), cs = fmtG(a, 4), term = pw === 0 ? cs : (a === 1 ? "" : cs + " ") + "s" + (pw > 1 ? "^" + pw : "");
      s += s === "" ? (c < 0 ? "-" : "") + term : (c < 0 ? " - " : " + ") + term;
    });
    return s || "0";
  }
  function tfLines(G) {
    var n = polyStr(G.num), d = polyStr(G.den);
    if (G.den.length === 1 && G.den[0] === 1) return ["  " + n, "", G.num.length === 1 ? "Static gain." : "Continuous-time transfer function."];
    var w = Math.max(n.length, d.length), c = function (s) { return "  " + new Array(Math.floor((w - s.length) / 2) + 1).join(" ") + s; };
    return [c(n), "  " + new Array(w + 1).join("-"), c(d), "", "Continuous-time transfer function."];
  }
  MLab.Interp.ext.control = function (I) {
    I.ext.binop.tf = function (op, a, b) { return tfop(op, a, b); };
    I.ext.unop.tf = function (op, a) { if (op === "-") return TF(a.num.map(function (v) { return -v; }), a.den); if (op === "'" || op === "+") return a; throw err("Operator '" + op + "' is not supported for transfer functions."); };
    I.ext.display.tf = function (v) { return tfLines(v); };
    I.ext.getField = I.ext.getField || {}; I.ext.getField.tf = function (G, f) { var k = f.toLowerCase(); if (k === "num" || k === "numerator") return _.cell(1, 1, [_.rowv(G.num)]); if (k === "den" || k === "denominator") return _.cell(1, 1, [_.rowv(G.den)]); if (k === "ts") return num(0); if (k === "variable") return str("s"); throw err("Transfer functions here have the properties Numerator, Denominator, Ts and Variable."); };
  };
  function sys(v, name) { if (v && v.t === "tf") return v; if (v && v.t === "m" && v.d.length === 1) return TF([v.d[0]], [1]); throw err((name || "This function") + " needs a transfer function, e.g. G = tf([1], [1 2 1])."); }
  B.tf = function (a) {
    if (a.length === 1 && isText(a[0])) { var v = text(a[0]); if (v === "s" || v === "p") return TF([1, 0], [1]); throw err("Only continuous-time transfer functions are supported here: use s = tf('s'). Discrete-time models (z) need real MATLAB.", "EEHub:realMatlabOnly"); }
    if (a.length === 1 && a[0].t === "tf") return a[0];
    if (a.length === 1 && a[0].t === "m") return TF([scalar(a[0])], [1]);
    if (a.length >= 3) throw err("Discrete-time transfer functions (a sample time as the third input) are not supported by the browser runner. Run this in real MATLAB.", "EEHub:realMatlabOnly");
    if (a.length < 2) throw err("tf needs a numerator and a denominator, e.g. tf([1], [1 2 1]).");
    if (a[0].t !== "m" || a[1].t !== "m") throw err("tf needs numeric coefficient vectors, e.g. tf([1 2], [1 3 2]). (MIMO systems with cell arrays need real MATLAB.)");
    return TF(a[0].d, a[1].d);
  };
  B.zpk = function (a) { if (a.length === 1 && isText(a[0])) return TF([1, 0], [1]); var z = a[0].d, p = a[1].d, k = scalar(a[2]), n = [k], d = [1]; if (a[0].im || a[1].im) { n = B.poly([a[0]]).d.map(function (v) { return v * k; }); d = B.poly([a[1]]).d; return TF(n, d); } z.forEach(function (r) { n = pmul(n, [1, -r]); }); p.forEach(function (r) { d = pmul(d, [1, -r]); }); return TF(n, d); };
  B.pid = function (a) { var kp = a.length > 0 ? scalar(a[0]) : 1, ki = a.length > 1 ? scalar(a[1]) : 0, kd = a.length > 2 ? scalar(a[2]) : 0; if (ki === 0) return TF([kd, kp], [1]); return TF([kd, kp, ki], [1, 0]); };
  B.tfdata = function (a, n) { var G = sys(a[0], "tfdata"), v = a.length > 1 && text(a[1]) === "v", nn = G.num.slice(); while (nn.length < G.den.length) nn.unshift(0); var N = _.rowv(nn), D = _.rowv(G.den); return v ? [N, D] : [_.cell(1, 1, [N]), _.cell(1, 1, [D])]; };
  B.pole = function (a) { var r = _.polyRoots(sys(a[0], "pole").den); return r.length ? _.cvec(r) : _.empty(); };
  B.zero = B.tzero = function (a) { var r = _.polyRoots(sys(a[0], "zero").num); return r.length ? _.cvec(r) : M(0, 1, []); };
  B.dcgain = function (a) { var G = sys(a[0], "dcgain"); return num(G.num[G.num.length - 1] / G.den[G.den.length - 1]); };
  B.order = function (a) { return num(sys(a[0]).den.length - 1); };
  B.isstable = function (a) { return _.bool(_.polyRoots(sys(a[0]).den).every(function (p) { return p.re < 0; })); };
  B.isproper = function (a) { var G = sys(a[0]); return _.bool(G.num.length <= G.den.length); };
  B.series = function (a) { return tfop("*", sys(a[0], "series"), sys(a[1], "series")); };
  B.parallel = function (a) { return tfop("+", sys(a[0], "parallel"), sys(a[1], "parallel")); };
  B.feedback = function (a) { if (a.length < 2) throw err("feedback needs the forward path and the feedback path, e.g. feedback(G, 1) for unity feedback."); var G = sys(a[0], "feedback"), H = sys(a[1], "feedback"), sg = a.length > 2 ? scalar(a[2]) : -1; return TF(pmul(G.num, H.den), padd(pmul(G.den, H.den), pmul(G.num, H.num), sg < 0 ? 1 : -1)); };
  B.minreal = function (a) {
    var G = sys(a[0], "minreal"), z = _.polyRoots(G.num), p = _.polyRoots(G.den), k = G.num[0] / G.den[0], used = {};
    z = z.filter(function (zz) { for (var i = 0; i < p.length; i++) if (!used[i] && Math.hypot(zz.re - p[i].re, zz.im - p[i].im) < 1e-6 * Math.max(1, Math.hypot(zz.re, zz.im))) { used[i] = 1; return false; } return true; });
    p = p.filter(function (pp, i) { return !used[i]; });
    function build(rs) { var re = [1], im = [0]; rs.forEach(function (r) { var nr = re.concat([0]), ni = im.concat([0]); for (var i = 1; i < nr.length; i++) { nr[i] -= re[i - 1] * r.re - im[i - 1] * r.im; ni[i] -= re[i - 1] * r.im + im[i - 1] * r.re; } re = nr; im = ni; }); return re.map(function (v) { return Math.abs(v) < 1e-12 ? 0 : v; }); }
    return TF(build(z).map(function (v) { return v * k; }), build(p));
  };
  B.squeeze = function (a) { return a[0]; };
  B.mag2db = B.db = function (a) { var v = a[0]; return M(v.r, v.c, v.d.map(function (x, i) { return 20 * Math.log10(v.im ? Math.hypot(x, v.im[i]) : Math.abs(x)); })); };
  B.db2mag = function (a) { var v = a[0]; return M(v.r, v.c, v.d.map(function (x) { return Math.pow(10, x / 20); })); };
  function evalAt(p, re, im) { var sr = 0, si = 0; for (var k = 0; k < p.length; k++) { var t = sr * re - si * im + p[k]; si = sr * im + si * re; sr = t; } return [sr, si]; }
  function freq(G, w) { var n = evalAt(G.num, 0, w), d = evalAt(G.den, 0, w), den = d[0] * d[0] + d[1] * d[1]; return [(n[0] * d[0] + n[1] * d[1]) / den, (n[1] * d[0] - n[0] * d[1]) / den]; }
  B.evalfr = function (a) { var G = sys(a[0]), s = a[1], n = evalAt(G.num, s.d[0], s.im ? s.im[0] : 0), d = evalAt(G.den, s.d[0], s.im ? s.im[0] : 0), o = [0, 0]; _.C.div(n[0], n[1], d[0], d[1], o); return o[1] === 0 ? num(o[0]) : M(1, 1, [o[0]], [o[1]]); };
  B.freqresp = function (a) { var G = sys(a[0]), w = a[1].d, re = [], im = []; w.forEach(function (x) { var h = freq(G, x); re.push(h[0]); im.push(h[1]); }); return M(w.length, 1, re, im); };
  /* time response by RK4 on the controllable canonical form */
  function simulate(G, t, uFn, impulse) {
    var n = G.den.length - 1, a0 = G.den[0], a = G.den.map(function (v) { return v / a0; }), b = G.num.map(function (v) { return v / a0; }), i, k;
    if (b.length > a.length) throw err("The transfer function is improper (the numerator has a higher order than the denominator), so its time response cannot be simulated.");
    while (b.length < a.length) b.unshift(0);
    if (n === 0) return t.map(function (tt) { return b[0] * uFn(tt); });
    var Cc = []; for (i = 1; i <= n; i++) Cc.push(b[n - i + 1] - a[n - i + 1] * b[0]); // multiplies x1..xn
    function f(x, u) { var dx = new Array(n); for (var q = 0; q < n - 1; q++) dx[q] = x[q + 1]; var s = u; for (q = 0; q < n; q++) s -= a[n - q] * x[q]; dx[n - 1] = s; return dx; }
    var x = new Array(n).fill(0), y = [], pmax = 0; _.polyRoots(G.den).forEach(function (p) { pmax = Math.max(pmax, Math.hypot(p.re, p.im)); });
    if (impulse) x[n - 1] = 1;
    function out(xv, u) { var s = b[0] * u; for (var q = 0; q < n; q++) s += Cc[q] * xv[q]; return s; }
    y.push(out(x, impulse ? 0 : uFn(t[0])));
    for (k = 1; k < t.length; k++) {
      var T = t[k] - t[k - 1], sub = Math.max(1, Math.min(4000, Math.ceil(T * pmax / 0.5))), h = T / sub, tt = t[k - 1];
      for (var s2 = 0; s2 < sub; s2++) {
        var u1 = impulse ? 0 : uFn(tt), u2 = impulse ? 0 : uFn(tt + h / 2), u3 = impulse ? 0 : uFn(tt + h), k1 = f(x, u1), k2 = f(x.map(function (v, q) { return v + h / 2 * k1[q]; }), u2), k3 = f(x.map(function (v, q) { return v + h / 2 * k2[q]; }), u2), k4 = f(x.map(function (v, q) { return v + h * k3[q]; }), u3);
        x = x.map(function (v, q) { return v + h / 6 * (k1[q] + 2 * k2[q] + 2 * k3[q] + k4[q]); }); tt += h;
      }
      y.push(out(x, impulse ? 0 : uFn(t[k])));
      if (!isFinite(y[k]) ) { for (; k < t.length - 1; k++) y.push(NaN); break; }
    }
    return y;
  }
  function horizon(G) {
    var p = _.polyRoots(G.den), slow = Infinity, osc = 0, unstable = false;
    p.forEach(function (r) { if (r.re < -1e-9) slow = Math.min(slow, -r.re); else if (r.re > 1e-9) unstable = true; if (Math.abs(r.im) > 1e-9) osc = Math.max(osc, Math.abs(r.im)); });
    var tf = isFinite(slow) ? 7 / slow : osc ? 5 * 2 * Math.PI / osc : 10;
    if (unstable) { var fast = 0; p.forEach(function (r) { fast = Math.max(fast, r.re); }); tf = Math.min(tf, 6 / fast); }
    if (osc && isFinite(slow)) tf = Math.max(tf, 2 * 2 * Math.PI / osc);
    var pw = Math.pow(10, Math.floor(Math.log10(tf))), f = tf / pw; return (f <= 1.2 ? 1.2 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10) * pw;
  }
  function timeGrid(arg, G) { if (arg && arg.t === "m" && arg.d.length > 1) return arg.d.slice(); var tf = arg && arg.t === "m" ? arg.d[0] : horizon(G), t = [], N = 400; for (var i = 0; i <= N; i++) t.push(tf * i / N); return t; }
  function response(kind) {
    return function (a, nargout, I) {
      var systems = [], targ = null, specs = [];
      a.forEach(function (v) { if (v.t === "tf") systems.push(v); else if (isText(v)) specs.push(v); else if (v.t === "m" && systems.length) targ = v; else if (v.t === "m" && v.d.length === 1) systems.push(sys(v)); });
      if (!systems.length) throw err(kind + " needs a transfer function, e.g. " + kind + "(tf(1, [1 2 1])).");
      var t = timeGrid(targ, systems[0]), ys = systems.map(function (G) { return simulate(G, t, function () { return 1; }, kind === "impulse"); });
      if (nargout > 0) return [M(t.length, 1, ys[0]), M(t.length, 1, t)];
      var h = MLab.plotHelpers, ax = h.fresh(I), keep = ax.hold; ax.hold = true;
      ys.forEach(function (y, i) { h.linePlot([M(1, t.length, t), M(1, y.length, y)].concat(specs[i] ? [specs[i]] : []), I); });
      ax.hold = keep; ax.title = kind === "step" ? "Step Response" : "Impulse Response"; ax.xlabel = "Time (seconds)"; ax.ylabel = "Amplitude"; ax.grid = ax.grid || false;
    };
  }
  B.step = response("step"); B.impulse = response("impulse");
  B.lsim = function (a, nargout, I) {
    if (a.length < 3) throw err("lsim needs the system, the input signal and the time vector: lsim(G, u, t).");
    var G = sys(a[0], "lsim"), u = a[1].d, t = a[2].d; if (u.length !== t.length) throw err("In lsim(G, u, t) the input u and the time vector t must have the same length.");
    var uf = function (tt) { var lo = 0, hi = t.length - 1; if (tt <= t[0]) return u[0]; if (tt >= t[hi]) return u[hi]; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (t[m] <= tt) lo = m; else hi = m; } return u[lo] + (u[hi] - u[lo]) * (tt - t[lo]) / (t[hi] - t[lo]); }, y = simulate(G, t, uf, false);
    if (nargout > 0) return [M(t.length, 1, y), M(t.length, 1, t.slice())];
    var h = MLab.plotHelpers, ax = h.fresh(I), keep = ax.hold; ax.hold = true; h.linePlot([M(1, t.length, t), M(1, u.length, u), str("--")], I)[0].color = "#8a8a8a"; h.linePlot([M(1, t.length, t), M(1, y.length, y)], I); ax.hold = keep; ax.title = "Linear Simulation Results"; ax.xlabel = "Time (seconds)"; ax.ylabel = "Amplitude";
  };
  B.stepinfo = function (a) {
    var G = sys(a[0], "stepinfo"), tf = horizon(G) * 2, N = 4000, t = [], i; for (i = 0; i <= N; i++) t.push(tf * i / N);
    var y = simulate(G, t, function () { return 1; }), yf = G.num[G.num.length - 1] / G.den[G.den.length - 1], peak = -Infinity, tp = 0, t10 = NaN, t90 = NaN, ts = 0;
    if (!isFinite(yf) || !_.polyRoots(G.den).every(function (p) { return p.re < 0; })) return _.struct({ RiseTime: num(NaN), SettlingTime: num(NaN), Overshoot: num(NaN), Peak: num(Infinity), PeakTime: num(Infinity) });
    for (i = 0; i <= N; i++) { if (Math.abs(y[i]) > peak) { peak = Math.abs(y[i]); tp = t[i]; } if (t10 !== t10 && y[i] / yf >= 0.1) t10 = t[i - 1] + (t[i] - t[i - 1]) * (0.1 * yf - y[i - 1]) / (y[i] - y[i - 1]); if (t90 !== t90 && y[i] / yf >= 0.9) t90 = t[i - 1] + (t[i] - t[i - 1]) * (0.9 * yf - y[i - 1]) / (y[i] - y[i - 1]); if (Math.abs(y[i] - yf) > 0.02 * Math.abs(yf)) ts = t[Math.min(N, i + 1)]; }
    return _.struct({ RiseTime: num(t90 - t10), SettlingTime: num(ts), Overshoot: num(Math.max(0, (peak - Math.abs(yf)) / Math.abs(yf) * 100)), Peak: num(peak), PeakTime: num(tp) });
  };
  B.damp = function (a, nargout, I) {
    var G = a[0].t === "tf" ? a[0] : null, p = G ? _.polyRoots(G.den) : a[0].d.map(function (re, i) { return { re: re, im: a[0].im ? a[0].im[i] : 0 }; });
    var wn = p.map(function (r) { return Math.hypot(r.re, r.im); }), z = p.map(function (r, i) { return wn[i] === 0 ? -1 : -r.re / wn[i]; });
    if (nargout > 0) return [M(p.length, 1, wn), M(p.length, 1, z), _.cvec(p)];
    I.print("\n         Pole              Damping       Frequency      Time Constant\n                                       (rad/seconds)      (seconds)\n\n");
    p.forEach(function (r, i) { I.print(" " + _.padR(_.expo(r.re, 2) + (r.im ? (r.im < 0 ? " - " : " + ") + _.expo(Math.abs(r.im), 2) + "i" : ""), 26) + _.padR(_.expo(z[i], 2), 15) + _.padR(_.expo(wn[i], 2), 17) + _.expo(-1 / r.re, 2) + "\n"); }); I.print("\n");
  };
  function wRange(G, arg) {
    if (arg && arg.t === "m" && arg.d.length >= 1) return arg.d.slice();
    var lo, hi;
    if (arg && arg.t === "c") { lo = Math.log10(arg.d[0].d[0]); hi = Math.log10(arg.d[1].d[0]); }
    else { var mags = _.polyRoots(G.den).concat(_.polyRoots(G.num)).map(function (r) { return Math.hypot(r.re, r.im); }).filter(function (m) { return m > 1e-8; }); if (!mags.length) { lo = -1; hi = 2; } else { lo = Math.floor(Math.log10(Math.min.apply(null, mags))) - 1; hi = Math.ceil(Math.log10(Math.max.apply(null, mags))) + 1; } }
    var w = [], N = 400; for (var i = 0; i <= N; i++) w.push(Math.pow(10, lo + (hi - lo) * i / N)); return w;
  }
  function phaseDeg(G, w, zs, ps) { var ph = (G.num[0] / G.den[0]) < 0 ? 180 : 0; zs.forEach(function (r) { ph += Math.atan2(w - r.im, -r.re) * 180 / Math.PI; }); ps.forEach(function (r) { ph -= Math.atan2(w - r.im, -r.re) * 180 / Math.PI; }); return ph; }
  function rawPh(G, x) { var h = freq(G, x); return Math.atan2(h[1], h[0]) * 180 / Math.PI; }
  function near(raw, target) { return raw + 360 * Math.round((target - raw) / 360); }
  function unwrapped(G, w, zs, ps) { var out = [], prev = phaseDeg(G, w[0], zs, ps); w.forEach(function (x) { prev = near(rawPh(G, x), prev); out.push(prev); }); return out; }
  function bodeData(G, w) { var zs = _.polyRoots(G.num), ps = _.polyRoots(G.den); return { mag: w.map(function (x) { var h = freq(G, x); return Math.hypot(h[0], h[1]); }), ph: unwrapped(G, w, zs, ps) }; }
  function margins(G) {
    var zs = _.polyRoots(G.num), ps = _.polyRoots(G.den), N = 4000, lo = -5, hi = 6, i, w = [], m = [], p = [], Gm = Infinity, Pm = Infinity, Wcg = NaN, Wcp = NaN;
    for (i = 0; i <= N; i++) { var x = Math.pow(10, lo + (hi - lo) * i / N), h = freq(G, x); w.push(x); m.push(Math.hypot(h[0], h[1])); } p = unwrapped(G, w, zs, ps);
    function refine(f, a, b) { var fa = f(a); for (var k = 0; k < 60; k++) { var mid = Math.sqrt(a * b), fm = f(mid); if ((fa < 0) === (fm < 0)) { a = mid; fa = fm; } else b = mid; } return Math.sqrt(a * b); }
    for (i = 1; i <= N; i++) {
      if ((m[i - 1] - 1) * (m[i] - 1) <= 0 && m[i - 1] !== m[i]) { var wc = refine(function (x) { var h = freq(G, x); return Math.hypot(h[0], h[1]) - 1; }, w[i - 1], w[i]), pm = near(rawPh(G, wc), p[i]) + 180; pm = ((pm + 180) % 360 + 360) % 360 - 180; if (Math.abs(pm) < Math.abs(Pm)) { Pm = pm; Wcp = wc; } }
      var q1 = Math.floor((p[i - 1] + 180) / 360), q2 = Math.floor((p[i] + 180) / 360);
      if (q1 !== q2) { var target = Math.max(q1, q2) * 360 - 180, wg = refine(function (x) { return near(rawPh(G, x), target) - target; }, w[i - 1], w[i]), hh = freq(G, wg), gm = 1 / Math.hypot(hh[0], hh[1]); if (Math.abs(Math.log(gm)) < Math.abs(Math.log(Gm)) || !isFinite(Gm)) { Gm = gm; Wcg = wg; } }
    }
    return { Gm: Gm, Pm: Pm, Wcg: Wcg, Wcp: Wcp };
  }
  function bodePlot(G, w, I, title) {
    var d = bodeData(G, w), h = MLab.plotHelpers, f = h.fig(I); f.axes = []; f.cur = null;
    B.subplot([num(2), num(1), num(1)], 0, I); h.linePlot([M(1, w.length, w), M(1, w.length, d.mag.map(function (v) { return 20 * Math.log10(v); }))], I, { xlog: true, ylog: false }); var a1 = h.ax(I); a1.grid = true; a1.ylabel = "Magnitude (dB)"; a1.title = title || "Bode Diagram";
    B.subplot([num(2), num(1), num(2)], 0, I); h.linePlot([M(1, w.length, w), M(1, w.length, d.ph)], I, { xlog: true, ylog: false }); var a2 = h.ax(I); a2.grid = true; a2.ylabel = "Phase (deg)"; a2.xlabel = "Frequency (rad/s)";
  }
  B.bode = function (a, nargout, I) { var G = sys(a[0], "bode"), w = wRange(G, a[1] && !isText(a[1]) ? a[1] : null); if (nargout > 0) { var d = bodeData(G, w); return [M(w.length, 1, d.mag), M(w.length, 1, d.ph), M(w.length, 1, w)]; } bodePlot(G, w, I); };
  B.bodemag = function (a, nargout, I) { var G = sys(a[0], "bodemag"), w = wRange(G, a[1]), d = bodeData(G, w), h = MLab.plotHelpers; h.linePlot([M(1, w.length, w), M(1, w.length, d.mag.map(function (v) { return 20 * Math.log10(v); }))], I, { xlog: true, ylog: false }); var x = h.ax(I); x.grid = true; x.title = "Bode Diagram"; x.ylabel = "Magnitude (dB)"; x.xlabel = "Frequency (rad/s)"; };
  B.margin = function (a, nargout, I) {
    var G = sys(a[0], "margin"), m = margins(G);
    if (nargout > 0) return [num(m.Gm), num(m.Pm), num(m.Wcg), num(m.Wcp)];
    bodePlot(G, wRange(G), I, "Gm = " + (isFinite(m.Gm) ? fmtG(20 * Math.log10(m.Gm), 3) + " dB (at " + fmtG(m.Wcg, 3) + " rad/s)" : "Inf dB") + ", Pm = " + (isFinite(m.Pm) ? fmtG(m.Pm, 3) + " deg (at " + fmtG(m.Wcp, 3) + " rad/s)" : "Inf"));
  };
  B.allmargin = function (a) { var m = margins(sys(a[0])); return _.struct({ GainMargin: num(m.Gm), GMFrequency: num(m.Wcg), PhaseMargin: num(m.Pm), PMFrequency: num(m.Wcp), Stable: _.bool(m.Gm > 1 && m.Pm > 0) }); };
  function scatterPts(I, pts, spec, ms) { var h = MLab.plotHelpers; if (!pts.length) return; var s = h.linePlot([M(1, pts.length, pts.map(function (p) { return p.re; })), M(1, pts.length, pts.map(function (p) { return p.im; })), str(spec)], I)[0]; s.ms = ms || 8; s.lw = 1.6; return s; }
  B.pzmap = function (a, nargout, I) { var G = sys(a[0], "pzmap"), p = _.polyRoots(G.den), z = _.polyRoots(G.num); if (nargout > 0) return [_.cvec(p), _.cvec(z)]; var h = MLab.plotHelpers, x = h.fresh(I); x.hold = true; scatterPts(I, p, "x", 10); var s = scatterPts(I, z, "o", 9); if (s) s.color = "#0072BD"; x.series.forEach(function (q) { q.color = "#0072BD"; }); x.series.push({ type: "vline", v: 0, color: "var(--mlp-ink, #111)", ls: ":", skipLegend: true }, { type: "hline", v: 0, color: "var(--mlp-ink, #111)", ls: ":", skipLegend: true }); x.hold = false; x.title = "Pole-Zero Map"; x.xlabel = "Real Axis (seconds^{-1})"; x.ylabel = "Imaginary Axis (seconds^{-1})"; };
  B.rlocus = function (a, nargout, I) {
    var G = sys(a[0], "rlocus"), h = MLab.plotHelpers, x = h.fresh(I), n = G.den.length - 1, pts = [], k, i, ks = [0];
    for (i = 0; i <= 600; i++) ks.push(Math.pow(10, -4 + 9 * i / 600));
    if (a[1] && a[1].t === "m") ks = a[1].d.slice();
    ks.forEach(function (kk) { _.polyRoots(padd(G.den, G.num.map(function (v) { return v * kk; }))).forEach(function (r) { pts.push(r); }); });
    var poles = _.polyRoots(G.den), zs = _.polyRoots(G.num), scale = 0; poles.concat(zs).forEach(function (r) { scale = Math.max(scale, Math.hypot(r.re, r.im)); }); scale = (scale || 1) * 4;
    pts = pts.filter(function (r) { return Math.abs(r.re) <= scale && Math.abs(r.im) <= scale; });
    if (nargout > 0) return [_.cvec(pts), _.rowv(ks)];
    x.hold = true; var s = scatterPts(I, pts, ".", 5); if (s) s.color = "#0072BD"; var sp = scatterPts(I, poles, "x", 10); if (sp) sp.color = "#D95319"; var sz = scatterPts(I, zs, "o", 9); if (sz) sz.color = "#D95319";
    x.series.push({ type: "vline", v: 0, color: "var(--mlp-ink, #111)", ls: ":", skipLegend: true }, { type: "hline", v: 0, color: "var(--mlp-ink, #111)", ls: ":", skipLegend: true });
    x.hold = false; x.title = "Root Locus"; x.xlabel = "Real Axis (seconds^{-1})"; x.ylabel = "Imaginary Axis (seconds^{-1})"; void n; void k;
  };
  B.nyquist = function (a, nargout, I) {
    var G = sys(a[0], "nyquist"), w = wRange(G), re = [], im = []; w = [w[0] / 100, w[0] / 10].concat(w).concat([w[w.length - 1] * 10, w[w.length - 1] * 100]);
    w.forEach(function (x) { var h = freq(G, x); re.push(h[0]); im.push(h[1]); });
    if (nargout > 0) return [M(w.length, 1, re), M(w.length, 1, im), M(w.length, 1, w)];
    var h = MLab.plotHelpers, x = h.fresh(I); x.hold = true; h.linePlot([M(1, re.length, re), M(1, im.length, im)], I)[0].color = "#0072BD"; var s2 = h.linePlot([M(1, re.length, re), M(1, im.length, im.map(function (v) { return -v; })), str("--")], I)[0]; s2.color = "#0072BD"; var c = h.linePlot([num(-1), num(0), str("+")], I)[0]; c.color = "#e02020"; c.ms = 10; c.lw = 1.8; x.hold = false; x.title = "Nyquist Diagram"; x.xlabel = "Real Axis"; x.ylabel = "Imaginary Axis"; x.grid = true;
  };
  B.residue = function (a, nargout) {
    var b = a[0].d.slice(), den = a[1].d.slice(), k = [], q;
    while (b.length > 1 && b[0] === 0) b.shift();
    if (b.length >= den.length) { var dq = B.deconv([_.rowv(b), _.rowv(den)], 2); k = dq[0].d; b = dq[1].d.slice(); while (b.length > 1 && b[0] === 0) b.shift(); }
    var p = _.polyRoots(den), dder = B.polyder([_.rowv(den)]).d;
    for (var i = 0; i < p.length; i++) for (var j = i + 1; j < p.length; j++) if (Math.hypot(p[i].re - p[j].re, p[i].im - p[j].im) < 1e-6) throw err("residue with repeated poles is not supported by the browser runner. Run this one in real MATLAB.", "EEHub:realMatlabOnly");
    var r = p.map(function (pp) { var n = evalAt(b, pp.re, pp.im), d = evalAt(dder, pp.re, pp.im), o = [0, 0]; _.C.div(n[0], n[1], d[0], d[1], o); return { re: Math.abs(o[0]) < 1e-12 ? 0 : o[0], im: Math.abs(o[1]) < 1e-10 ? 0 : o[1] }; });
    q = [_.cvec(r), _.cvec(p), k.length ? _.rowv(k) : _.empty()]; return nargout <= 1 ? q[0] : q;
  };
  B.tf2zp = function (a) { var G = TF(a[0].d, a[1].d); return [_.cvec(_.polyRoots(G.num)), _.cvec(_.polyRoots(G.den)), num(G.num[0] / G.den[0])]; };
  B.zp2tf = function (a) { var G = B.zpk(a); return [_.rowv(G.num), _.rowv(G.den)]; };
  B.printsys = function (a, n, I) { I.print("\nnum/den = \n" + tfLines(TF(a[0].d, a[1].d)).slice(0, 3).join("\n") + "\n"); };
  B.ltiview = B.sisotool = B.rltool = B.pidTuner = B.controlSystemDesigner = function () { throw err("This opens an interactive app that only exists in desktop MATLAB. Follow the guided steps in the lesson to use it there.", "EEHub:realMatlabOnly"); };
  return MLab;
});
