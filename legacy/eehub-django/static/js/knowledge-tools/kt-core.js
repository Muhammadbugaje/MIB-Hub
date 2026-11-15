/* EE Hub — knowledge tools core (Round 7, R7E).

   One small engine shared by every interactive tool on the Interactive lab tab:
     KT.expr     a safe expression language (no eval): real, complex and array values,
                 ~120 functions, user functions, sums, solvers, integrals.  Runs in Node too
                 (module.exports) so the tests can check every configured tool's numbers.
     KT.fmt      engineering number formatting (SI prefixes, sig figs, polar/rect complex).
     KT.ui       controls (slider + number box, segmented select, toggle, table), readouts,
                 badges, step-by-step working.
     KT.Plot     canvas plots (line/step/stem/area/points/bars/phasor/argand), log axes,
                 labelled axes with units, crosshair readout, theme aware, pauses off screen,
                 respects prefers-reduced-motion.
     KT.define(key, init) / KT.boot()   — tools find their roots by [data-kt="<key>"].
   No dependencies. */
(function (global) {
  "use strict";
  var KT = global.KT || {};
  if (KT.expr) return; // loaded twice
  global.KT = KT;
  var PI = Math.PI;

  /* ======================================================================
     Complex numbers
     ====================================================================== */
  function C(re, im) { this.re = re; this.im = im || 0; }
  C.prototype.toString = function () { return fmtComplex(this, "rect"); };
  function isC(v) { return v instanceof C; }
  function cx(v) { return isC(v) ? v : new C(+v, 0); }
  function simp(z) { return (isC(z) && Math.abs(z.im) <= 1e-12 * Math.max(1, Math.abs(z.re))) ? z.re : z; }
  var Cx = {
    add: function (a, b) { return new C(a.re + b.re, a.im + b.im); },
    sub: function (a, b) { return new C(a.re - b.re, a.im - b.im); },
    mul: function (a, b) { return new C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re); },
    div: function (a, b) { var d = b.re * b.re + b.im * b.im; return new C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); },
    abs: function (a) { return Math.hypot(a.re, a.im); },
    arg: function (a) { return Math.atan2(a.im, a.re); },
    exp: function (a) { var e = Math.exp(a.re); return new C(e * Math.cos(a.im), e * Math.sin(a.im)); },
    log: function (a) { return new C(Math.log(Cx.abs(a)), Cx.arg(a)); },
    sqrt: function (a) { var r = Math.sqrt(Cx.abs(a)), t = Cx.arg(a) / 2; return new C(r * Math.cos(t), r * Math.sin(t)); },
    pow: function (a, b) { if (a.re === 0 && a.im === 0) return new C(0, 0); return Cx.exp(Cx.mul(b, Cx.log(a))); },
    sin: function (a) { return new C(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im)); },
    cos: function (a) { return new C(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im)); },
    sinh: function (a) { return new C(Math.sinh(a.re) * Math.cos(a.im), Math.cosh(a.re) * Math.sin(a.im)); },
    cosh: function (a) { return new C(Math.cosh(a.re) * Math.cos(a.im), Math.sinh(a.re) * Math.sin(a.im)); },
    polar: function (m, rad) { return new C(m * Math.cos(rad), m * Math.sin(rad)); }
  };
  Cx.tan = function (a) { return Cx.div(Cx.sin(a), Cx.cos(a)); };
  Cx.tanh = function (a) { return Cx.div(Cx.sinh(a), Cx.cosh(a)); };
  KT.C = C; KT.Cx = Cx; KT.isC = isC;

  /* ======================================================================
     Expression language
     ====================================================================== */
  var TK = { NUM: 1, STR: 2, ID: 3, OP: 4, END: 5 };
  var OPS = ["<=", ">=", "==", "!=", "&&", "||", "+", "-", "*", "/", "%", "^", "(", ")", "[", "]", ",", "<", ">", "!", "?", ":", "="];
  function ExprError(msg) { this.message = msg; this.name = "ExprError"; }
  ExprError.prototype = Object.create(Error.prototype);
  KT.ExprError = ExprError;

  function tokenize(src) {
    var out = [], i = 0, s = String(src == null ? "" : src);
    s = s.replace(/[−–]/g, "-").replace(/[×⋅·]/g, "*").replace(/÷/g, "/");
    while (i < s.length) {
      var ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      var m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (m) { out.push({ t: TK.NUM, v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if (ch === '"' || ch === "'") {
        var j = s.indexOf(ch, i + 1);
        if (j < 0) throw new ExprError("Unclosed text");
        out.push({ t: TK.STR, v: s.slice(i + 1, j) }); i = j + 1; continue;
      }
      m = /^[A-Za-z_Ͱ-Ͽἀ-῿][A-Za-z0-9_Ͱ-Ͽἀ-῿']*/.exec(s.slice(i));
      if (m) { out.push({ t: TK.ID, v: m[0] }); i += m[0].length; continue; }
      var op = null;
      for (var k = 0; k < OPS.length; k++) if (s.substr(i, OPS[k].length) === OPS[k]) { op = OPS[k]; break; }
      if (!op) throw new ExprError("Unexpected '" + ch + "'");
      out.push({ t: TK.OP, v: op }); i += op.length;
    }
    out.push({ t: TK.END });
    return out;
  }

  function Parser(tokens) { this.k = tokens; this.p = 0; }
  Parser.prototype.peek = function () { return this.k[this.p]; };
  Parser.prototype.next = function () { return this.k[this.p++]; };
  Parser.prototype.is = function (v) { var t = this.k[this.p]; return t.t === TK.OP && t.v === v; };
  Parser.prototype.eat = function (v) { if (!this.is(v)) throw new ExprError("Expected '" + v + "'"); this.p++; };
  Parser.prototype.expr = function () {
    var c = this.or();
    if (this.is("?")) { this.p++; var a = this.expr(); this.eat(":"); var b = this.expr(); return { n: "if", a: [c, a, b] }; }
    return c;
  };
  Parser.prototype.or = function () {
    var l = this.and();
    while (this.is("||") || (this.peek().t === TK.ID && this.peek().v === "or")) { this.p++; l = { n: "bin", o: "||", l: l, r: this.and() }; }
    return l;
  };
  Parser.prototype.and = function () {
    var l = this.cmp();
    while (this.is("&&") || (this.peek().t === TK.ID && this.peek().v === "and")) { this.p++; l = { n: "bin", o: "&&", l: l, r: this.cmp() }; }
    return l;
  };
  Parser.prototype.cmp = function () {
    var l = this.add();
    while (["<", ">", "<=", ">=", "==", "!="].some(this.is, this)) { var o = this.next().v; l = { n: "bin", o: o, l: l, r: this.add() }; }
    return l;
  };
  Parser.prototype.add = function () {
    var l = this.mul();
    while (this.is("+") || this.is("-")) { var o = this.next().v; l = { n: "bin", o: o, l: l, r: this.mul() }; }
    return l;
  };
  Parser.prototype.mul = function () {
    var l = this.unary();
    while (this.is("*") || this.is("/") || this.is("%")) { var o = this.next().v; l = { n: "bin", o: o, l: l, r: this.unary() }; }
    return l;
  };
  Parser.prototype.unary = function () {
    if (this.is("-")) { this.p++; return { n: "neg", a: this.unary() }; }
    if (this.is("+")) { this.p++; return this.unary(); }
    if (this.is("!") || (this.peek().t === TK.ID && this.peek().v === "not")) { this.p++; return { n: "not", a: this.unary() }; }
    return this.pow();
  };
  Parser.prototype.pow = function () {
    var b = this.postfix();
    if (this.is("^")) { this.p++; return { n: "bin", o: "^", l: b, r: this.unary() }; }
    return b;
  };
  Parser.prototype.postfix = function () {
    var e = this.primary();
    while (this.is("[")) { this.p++; var i = this.expr(); this.eat("]"); e = { n: "idx", a: e, i: i }; }
    return e;
  };
  Parser.prototype.primary = function () {
    var t = this.next();
    if (t.t === TK.NUM) return { n: "num", v: t.v };
    if (t.t === TK.STR) return { n: "str", v: t.v };
    if (t.t === TK.ID) {
      if (this.is("(")) {
        this.p++;
        var args = [];
        if (!this.is(")")) { do { args.push(this.expr()); } while (this.is(",") && ++this.p); }
        this.eat(")");
        return { n: "call", f: t.v, a: args };
      }
      return { n: "id", v: t.v };
    }
    if (t.t === TK.OP && t.v === "(") { var e = this.expr(); this.eat(")"); return e; }
    if (t.t === TK.OP && t.v === "[") {
      var items = [];
      if (!this.is("]")) { do { items.push(this.expr()); } while (this.is(",") && ++this.p); }
      this.eat("]");
      return { n: "arr", a: items };
    }
    throw new ExprError(t.t === TK.END ? "Unfinished expression" : "Unexpected '" + t.v + "'");
  };

  var astCache = {};
  function parse(src) {
    src = String(src == null ? "" : src);
    if (astCache[src]) return astCache[src];
    var p = new Parser(tokenize(src)), e = p.expr();
    if (p.peek().t !== TK.END) throw new ExprError("Unexpected '" + p.peek().v + "'");
    astCache[src] = e;
    return e;
  }

  /* ---- value arithmetic ---------------------------------------------------- */
  function isA(v) { return Array.isArray(v); }
  function num(v) { if (isC(v)) return v.re; if (typeof v === "string") return parseFloat(v); if (typeof v === "boolean") return v ? 1 : 0; return v; }
  function truthy(v) { if (isA(v)) return v.length > 0; if (typeof v === "string") return v.length > 0; return !!num(v) && !isNaN(num(v)); }
  function bin(o, a, b) {
    if (isA(a) || isA(b)) {
      if (isA(a) && isA(b)) { var n = Math.min(a.length, b.length), r = new Array(n); for (var i = 0; i < n; i++) r[i] = bin(o, a[i], b[i]); return r; }
      return isA(a) ? a.map(function (x) { return bin(o, x, b); }) : b.map(function (y) { return bin(o, a, y); });
    }
    if (typeof a === "string" || typeof b === "string") {
      if (o === "+") return String(fmtAuto(a)) + String(fmtAuto(b));
      if (o === "==") return a == b ? 1 : 0;
      if (o === "!=") return a != b ? 1 : 0;
    }
    if (o === "&&") return truthy(a) && truthy(b) ? 1 : 0;
    if (o === "||") return truthy(a) || truthy(b) ? 1 : 0;
    if (isC(a) || isC(b)) {
      var A = cx(a), B = cx(b);
      switch (o) {
        case "+": return simp(Cx.add(A, B));
        case "-": return simp(Cx.sub(A, B));
        case "*": return simp(Cx.mul(A, B));
        case "/": return simp(Cx.div(A, B));
        case "^": return simp(isC(b) || A.im !== 0 || A.re < 0 ? cpow(A, B) : new C(Math.pow(A.re, B.re)));
        case "==": return A.re === B.re && A.im === B.im ? 1 : 0;
        case "!=": return A.re !== B.re || A.im !== B.im ? 1 : 0;
      }
      a = A.re; b = B.re;
    }
    switch (o) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return a / b;
      case "%": return a - b * Math.floor(a / b);
      case "^": return Math.pow(a, b);
      case "<": return a < b ? 1 : 0;
      case ">": return a > b ? 1 : 0;
      case "<=": return a <= b ? 1 : 0;
      case ">=": return a >= b ? 1 : 0;
      case "==": return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)) ? 1 : 0;
      case "!=": return Math.abs(a - b) > 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)) ? 1 : 0;
    }
    throw new ExprError("Unknown operator " + o);
  }
  function cpow(A, B) {
    if (B.im === 0 && Number.isInteger(B.re) && Math.abs(B.re) <= 64) {
      var r = new C(1, 0), n = Math.abs(B.re);
      for (var i = 0; i < n; i++) r = Cx.mul(r, A);
      return B.re < 0 ? Cx.div(new C(1, 0), r) : r;
    }
    return Cx.pow(A, B);
  }
  // map a function over arrays (elementwise)
  function lift(fr, fc) {
    return function rec(x) {
      if (isA(x)) return x.map(rec);
      if (isC(x)) { if (!fc) return fr(x.re); return simp(fc(x)); }
      return fr(num(x));
    };
  }
  function flat(args) {
    var out = [];
    (function walk(a) { Array.prototype.forEach.call(a, function (x) { if (isA(x)) walk(x); else out.push(x); }); })(args);
    return out;
  }
  function reals(args) { return flat(args).map(num); }

  /* ---- special functions --------------------------------------------------- */
  function gammaLn(x) {
    var g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(PI / Math.abs(Math.sin(PI * x))) - gammaLn(1 - x);
    x -= 1; var a = c[0], t = x + g + 0.5;
    for (var i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  function gamma(x) {
    if (Number.isInteger(x) && x > 0 && x < 171) { var r = 1; for (var i = 2; i < x; i++) r *= i; return r; }
    if (x < 0.5) return PI / (Math.sin(PI * x) * gamma(1 - x));
    return Math.exp(gammaLn(x));
  }
  function fact(n) { return n < 0 ? NaN : gamma(n + 1); }
  function nCr(n, k) { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r * 1e6) / 1e6 === Math.round(r) ? Math.round(r) : r; }
  function erf(x) {
    // Abramowitz-Stegun 7.1.26 is too coarse for tests; use a series / continued fraction (|err| < 1e-13)
    var ax = Math.abs(x), s;
    if (ax < 2.5) {
      var term = ax, sum = ax, n = 0;
      while (Math.abs(term) > 1e-17 * Math.abs(sum) && n < 200) { n++; term *= -ax * ax / n; sum += term / (2 * n + 1); }
      s = 2 / Math.sqrt(PI) * sum;
    } else {
      // continued fraction for erfc
      var f = 0;
      for (var k = 60; k >= 1; k--) f = k / 2 / (ax + f);
      s = 1 - Math.exp(-ax * ax) / Math.sqrt(PI) / (ax + f);
    }
    return x < 0 ? -s : s;
  }
  function normcdf(x, mu, sd) { mu = mu || 0; sd = sd == null ? 1 : sd; return 0.5 * (1 + erf((x - mu) / (sd * Math.SQRT2))); }
  function norminv(p, mu, sd) {
    mu = mu || 0; sd = sd == null ? 1 : sd;
    var lo = -40, hi = 40;
    for (var i = 0; i < 200; i++) { var m = (lo + hi) / 2; if (normcdf(m) < p) lo = m; else hi = m; }
    return mu + sd * (lo + hi) / 2;
  }
  function besselj(n, x) {
    // integral representation (n integer): J_n(x) = 1/pi * int_0^pi cos(n t - x sin t) dt  (Simpson, 400 panels)
    n = Math.round(n);
    var N = 400, h = PI / N, s = 0;
    for (var i = 0; i <= N; i++) { var t = i * h, w = (i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2); s += w * Math.cos(n * t - x * Math.sin(t)); }
    return s * h / 3 / PI;
  }
  function erlangb(A, N) { var B = 1; for (var k = 1; k <= Math.round(N); k++) B = A * B / (k + A * B); return B; }
  function erlangc(A, N) { var B = erlangb(A, N); return N > A ? N * B / (N - A * (1 - B)) : 1; }
  function polyval(c, x) { // c highest power first; x real or complex
    var r = 0;
    for (var i = 0; i < c.length; i++) r = bin("+", bin("*", r, x), c[i]);
    return r;
  }
  function polyroots(c) { // Durand–Kerner; c real coefficients, highest power first
    c = c.map(num);
    while (c.length && Math.abs(c[0]) < 1e-300) c.shift();
    var n = c.length - 1;
    if (n < 1) return [];
    var a = c.map(function (x) { return x / c[0]; }), z = [], i, k, it;
    // count and strip zero roots
    var zeros = 0;
    while (n > 0 && Math.abs(a[n]) < 1e-14) { a.pop(); n--; zeros++; }
    var R = 1 + Math.max.apply(null, a.slice(1).map(Math.abs).concat([0]));
    for (i = 0; i < n; i++) z.push(Cx.polar(R * 0.9, 2 * PI * i / n + 0.4));
    for (it = 0; it < 800; it++) {
      var delta = 0;
      for (i = 0; i < n; i++) {
        var num_ = new C(1, 0), p = new C(1, 0);
        for (k = 1; k <= n; k++) p = Cx.add(Cx.mul(p, z[i]), new C(a[k], 0));
        num_ = p;
        var den = new C(1, 0);
        for (k = 0; k < n; k++) if (k !== i) den = Cx.mul(den, Cx.sub(z[i], z[k]));
        var d = Cx.div(num_, den);
        z[i] = Cx.sub(z[i], d);
        delta = Math.max(delta, Cx.abs(d));
      }
      if (delta < 1e-14) break;
    }
    // polish with Newton and clean tiny imaginary parts
    var dc = a.slice(0, n).map(function (x, j) { return x * (n - j); });
    z = z.map(function (r) {
      for (var t = 0; t < 3; t++) {
        var pv = cx(polyval(a, r)), dv = cx(polyval(dc, r));
        if (Cx.abs(dv) > 1e-300) r = Cx.sub(r, Cx.div(pv, dv));
      }
      if (Math.abs(r.im) < 1e-9 * Math.max(1, Math.abs(r.re))) r = new C(r.re, 0);
      if (Math.abs(r.re) < 1e-12 * Math.max(1, Math.abs(r.im))) r = new C(0, r.im);
      return r;
    });
    for (i = 0; i < zeros; i++) z.push(new C(0, 0));
    z.sort(function (p, q) { return p.re - q.re || q.im - p.im; });
    return z.map(simp);
  }
  function polymul(a, b) {
    var r = new Array(a.length + b.length - 1).fill(0);
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) r[i + j] += num(a[i]) * num(b[j]);
    return r;
  }
  function polyadd(a, b) {
    var n = Math.max(a.length, b.length), r = new Array(n).fill(0);
    for (var i = 0; i < a.length; i++) r[n - a.length + i] += num(a[i]);
    for (i = 0; i < b.length; i++) r[n - b.length + i] += num(b[i]);
    return r;
  }
  function conv(a, b) { return polymul(a, b); }
  function dft(x) { // returns complex array
    var N = x.length, out = [];
    for (var k = 0; k < N; k++) {
      var re = 0, im = 0;
      for (var n = 0; n < N; n++) { var v = cx(x[n]), t = -2 * PI * k * n / N, c = Math.cos(t), s = Math.sin(t); re += v.re * c - v.im * s; im += v.re * s + v.im * c; }
      out.push(simp(new C(re, im)));
    }
    return out;
  }
  function interp(xs, ys, x) {
    if (!xs.length) return NaN;
    if (x <= xs[0]) return ys[0];
    for (var i = 1; i < xs.length; i++) if (x <= xs[i]) { var t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + t * (ys[i] - ys[i - 1]); }
    return ys[ys.length - 1];
  }
  function stepdown(xs, ys, x) { // value of a stair-step table: the largest xs[i] <= x
    var r = ys[0];
    for (var i = 0; i < xs.length; i++) if (x >= xs[i]) r = ys[i];
    return r;
  }
  function pickup(table, x) { // first index whose value >= x
    for (var i = 0; i < table.length; i++) if (num(table[i]) >= x) return i;
    return -1;
  }

  /* ---- Quine–McCluskey (shared with the logic tool) ------------------------ */
  function qmBits(m, n) { var b = []; for (var k = n - 1; k >= 0; k--) b.push((m >> k) & 1); return b; }
  function qmPrimes(ones, dc, n) {
    var terms = ones.concat(dc).map(function (m) { return { b: qmBits(m, n).join(""), ms: [m] }; });
    var seen = {}, pis = [];
    while (terms.length) {
      var next = [], used = {}, made = {};
      for (var a = 0; a < terms.length; a++) for (var b = a + 1; b < terms.length; b++) {
        var x = terms[a].b, y = terms[b].b, diff = -1, cnt = 0;
        for (var k = 0; k < n; k++) if (x[k] !== y[k]) { cnt++; diff = k; if (cnt > 1) break; }
        if (cnt === 1 && x.replace(/[01]/g, "0") === y.replace(/[01]/g, "0")) {
          var nb = x.slice(0, diff) + "-" + x.slice(diff + 1);
          used[a] = used[b] = 1;
          if (!made[nb]) { made[nb] = 1; next.push({ b: nb, ms: terms[a].ms.concat(terms[b].ms) }); }
        }
      }
      terms.forEach(function (t, i) { if (!used[i] && !seen[t.b]) { seen[t.b] = 1; pis.push(t); } });
      terms = next;
    }
    return pis;
  }
  function qmCover(pis, ones) {
    if (!ones.length) return [];
    var chosen = [];
    ones.forEach(function (m) { var c = pis.filter(function (p) { return p.ms.indexOf(m) >= 0; }); if (c.length === 1 && chosen.indexOf(c[0]) < 0) chosen.push(c[0]); });
    var left = ones.filter(function (m) { return !chosen.some(function (p) { return p.ms.indexOf(m) >= 0; }); });
    if (!left.length) return chosen;
    var cand = pis.filter(function (p) { return chosen.indexOf(p) < 0 && p.ms.some(function (m) { return left.indexOf(m) >= 0; }); });
    var lits = function (p) { return p.b.replace(/-/g, "").length; }, best = null, bestCost = Infinity, N = cand.length;
    if (N <= 16) {
      for (var mask = 1; mask < (1 << N); mask++) {
        var set = [];
        for (var k = 0; k < N; k++) if (mask & (1 << k)) set.push(cand[k]);
        if (best && set.length > best.length) continue;
        if (!left.every(function (m) { return set.some(function (p) { return p.ms.indexOf(m) >= 0; }); })) continue;
        var cost = set.length * 100 + set.reduce(function (a2, p) { return a2 + lits(p); }, 0);
        if (cost < bestCost) { bestCost = cost; best = set; }
      }
    } else {
      best = []; var rem = left.slice();
      while (rem.length) { cand.sort(function (p, q) { return q.ms.filter(function (m) { return rem.indexOf(m) >= 0; }).length - p.ms.filter(function (m) { return rem.indexOf(m) >= 0; }).length; }); best.push(cand[0]); rem = rem.filter(function (m) { return cand[0].ms.indexOf(m) < 0; }); }
    }
    return chosen.concat(best || []);
  }
  function qmTerm(p, names, pos) {
    if (pos) { var s2 = []; p.b.split("").forEach(function (c, k) { if (c === "0") s2.push(names[k]); else if (c === "1") s2.push(names[k] + "'"); }); return s2.length > 1 ? "(" + s2.join(" + ") + ")" : (s2[0] || "0"); }
    var s = ""; p.b.split("").forEach(function (c, k) { if (c === "1") s += names[k]; else if (c === "0") s += names[k] + "'"; }); return s || "1";
  }
  // vals: one entry per minterm: 1, 0 or 2 (= don't care / X)
  function qmSolve(vals, n, names, pos) {
    var ones = [], dc = [], zeros = [];
    for (var m = 0; m < (1 << n); m++) { var v = vals[m]; if (v === 2 || v === "x" || v === "X") dc.push(m); else if (+v === 1) ones.push(m); else zeros.push(m); }
    var target = pos ? zeros : ones, other = pos ? ones : zeros;
    if (!target.length) return { terms: [], text: pos ? "1" : "0" };
    if (!other.length) return { terms: [], text: pos ? "0" : "1" };
    var cov = qmCover(qmPrimes(target, dc, n), target);
    var terms = cov.map(function (p) { return qmTerm(p, names, pos); });
    return { terms: terms, text: terms.join(pos ? "" : " + "), cover: cov };
  }
  KT.qm = { primes: qmPrimes, cover: qmCover, term: qmTerm, solve: qmSolve, bits: qmBits };

  /* ---- transfer-function helpers (shared with the tf tool) ----------------- */
  // Step response of N(s)/D(s) (proper) by RK4 on the controllable canonical form.
  function tfstep(numc, denc, tmax, npts, input) {
    numc = numc.map(num); denc = denc.map(num);
    while (denc.length && Math.abs(denc[0]) < 1e-300) denc.shift();
    var n = denc.length - 1;
    if (n < 1) { var k0 = numc[numc.length - 1] / denc[0]; return { t: [0, tmax], y: [k0, k0] }; }
    var a0 = denc[0];
    var a = denc.map(function (x) { return x / a0; });
    var b = numc.map(function (x) { return x / a0; });
    while (b.length < n + 1) b.unshift(0);
    if (b.length > n + 1) b = b.slice(b.length - n - 1);
    var d = b[0]; // direct feed-through
    var cvec = []; // y = c x + d u, with b_i - d a_i
    for (var i = 1; i <= n; i++) cvec.push(b[i] - d * a[i]);
    // states x1..xn with x1' = x2 ... xn' = -a_n x1 - ... - a_1 xn + u ; output uses reversed c
    var x = new Array(n).fill(0);
    input = input || function () { return 1; };
    function f(xx, u) {
      var dx = new Array(n);
      for (var k = 0; k < n - 1; k++) dx[k] = xx[k + 1];
      var s = u;
      for (k = 0; k < n; k++) s -= a[n - k] * xx[k];
      dx[n - 1] = s;
      return dx;
    }
    function out(xx, u) { var s = d * u; for (var k = 0; k < n; k++) s += cvec[n - 1 - k] * xx[k]; return s; }
    npts = npts || 400;
    var sub = Math.max(4, Math.ceil(4000 / npts)), dt = tmax / npts / sub, T = [0], Y = [out(x, input(0))], t = 0;
    for (var p = 0; p < npts; p++) {
      for (var q = 0; q < sub; q++) {
        var u0 = input(t), um = input(t + dt / 2), u1 = input(t + dt);
        var k1 = f(x, u0), x2 = x.map(function (v, j) { return v + dt / 2 * k1[j]; });
        var k2 = f(x2, um), x3 = x.map(function (v, j) { return v + dt / 2 * k2[j]; });
        var k3 = f(x3, um), x4 = x.map(function (v, j) { return v + dt * k3[j]; });
        var k4 = f(x4, u1);
        x = x.map(function (v, j) { return v + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]); });
        t += dt;
        if (!isFinite(x[0]) || Math.abs(x[0]) > 1e30) break;
      }
      T.push(t); Y.push(out(x, input(t)));
    }
    return { t: T, y: Y };
  }
  function stepinfo(T, Y, final) {
    var n = Y.length, yf = final != null ? final : Y[n - 1], i;
    var info = { final: yf, peak: -Infinity, tp: NaN, tr: NaN, ts: NaN, mp: 0 };
    for (i = 0; i < n; i++) if (Y[i] > info.peak) { info.peak = Y[i]; info.tp = T[i]; }
    if (Math.abs(yf) > 1e-12) {
      info.mp = Math.max(0, (info.peak - yf) / Math.abs(yf) * 100);
      var t10 = NaN, t90 = NaN;
      for (i = 0; i < n; i++) { if (isNaN(t10) && Y[i] >= 0.1 * yf) t10 = T[i]; if (isNaN(t90) && Y[i] >= 0.9 * yf) { t90 = T[i]; break; } }
      info.tr = t90 - t10;
      info.ts = 0;
      for (i = n - 1; i >= 0; i--) if (Math.abs(Y[i] - yf) > 0.02 * Math.abs(yf)) { info.ts = T[Math.min(n - 1, i + 1)]; break; }
    }
    return info;
  }
  function tfeval(numc, denc, s) { return bin("/", polyval(numc, s), polyval(denc, s)); }
  // gain/phase margins from a frequency sweep
  function margins(numc, denc) {
    var w0 = 1e-3, w1 = 1e4, N = 4000, prev = null, out = { wgc: NaN, wpc: NaN, pm: NaN, gm: Infinity };
    var unwrap = 0, lastPh = null;
    for (var i = 0; i <= N; i++) {
      var w = w0 * Math.pow(w1 / w0, i / N), G = cx(tfeval(numc, denc, new C(0, w)));
      var mag = Cx.abs(G), ph = Cx.arg(G) * 180 / PI;
      if (lastPh != null) { while (ph + unwrap - lastPh > 180) unwrap -= 360; while (ph + unwrap - lastPh < -180) unwrap += 360; }
      ph += unwrap; lastPh = ph;
      var cur = { w: w, m: 20 * Math.log10(mag), p: ph };
      if (prev) {
        if (isNaN(out.wgc) && (prev.m > 0) !== (cur.m > 0)) { var t = prev.m / (prev.m - cur.m); out.wgc = prev.w * Math.pow(cur.w / prev.w, t); out.pm = 180 + prev.p + t * (cur.p - prev.p); }
        var k1 = Math.floor((prev.p + 180) / 360), k2 = Math.floor((cur.p + 180) / 360);
        if (isNaN(out.wpc) && k1 !== k2 && cur.p < prev.p) { var cross = k1 * 360 - 180, u = (prev.p - cross) / (prev.p - cur.p); out.wpc = prev.w * Math.pow(cur.w / prev.w, u); out.gm = -(prev.m + u * (cur.m - prev.m)); }
      }
      prev = cur;
    }
    return out;
  }
  function routh(c) { // returns {rows, changes, special}
    c = c.map(num);
    var n = c.length, cols = Math.ceil(n / 2), rows = [], eps = 1e-9, special = [];
    var r0 = [], r1 = [];
    for (var i = 0; i < cols; i++) { r0.push(c[2 * i] || 0); r1.push(c[2 * i + 1] || 0); }
    rows.push(r0); rows.push(r1);
    for (var k = 2; k < n; k++) {
      var a = rows[k - 2], b = rows[k - 1].slice();
      if (b.every(function (x) { return Math.abs(x) < 1e-12; })) {
        // row of zeros: auxiliary polynomial derivative
        var order = n - k + 1; // power of the row above
        b = a.map(function (x, j) { return x * (order - 2 * j); });
        rows[k - 1] = b; special.push({ row: k - 1, kind: "zero-row" });
      } else if (Math.abs(b[0]) < 1e-12) { b[0] = eps; rows[k - 1] = b; special.push({ row: k - 1, kind: "epsilon" }); }
      var r = [];
      for (i = 0; i < cols; i++) r.push((b[0] * (a[i + 1] || 0) - a[0] * (b[i + 1] || 0)) / b[0]);
      rows.push(r);
    }
    var changes = 0;
    for (k = 1; k < rows.length; k++) if ((rows[k][0] > 0) !== (rows[k - 1][0] > 0) && rows[k][0] !== 0) changes++;
    return { rows: rows.slice(0, n), changes: changes, special: special };
  }
  KT.tf = { step: tfstep, info: stepinfo, evalAt: tfeval, margins: margins, routh: routh, roots: polyroots, polymul: polymul, polyadd: polyadd, polyval: polyval };

  /* ---- numerical helpers ------------------------------------------------- */
  function brent(f, lo, hi) {
    var a = lo, b = hi, fa = f(a), fb = f(b);
    if (!isFinite(fa) || !isFinite(fb)) return NaN;
    if (fa * fb > 0) {
      // scan for a sign change
      var N = 200, found = false;
      for (var i = 1; i <= N; i++) { var x = lo + (hi - lo) * i / N, fx = f(x); if (fa * fx <= 0) { b = x; fb = fx; a = lo + (hi - lo) * (i - 1) / N; fa = f(a); found = true; break; } }
      if (!found) return NaN;
    }
    for (var it = 0; it < 200; it++) {
      var m = (a + b) / 2, fm = f(m);
      if (fm === 0 || (b - a) / 2 < 1e-13 * Math.max(1, Math.abs(m))) return m;
      // secant step inside bracket when safe
      var s = b - fb * (b - a) / (fb - fa);
      if (s > a && s < b) { var fs = f(s); if (fa * fs < 0) { b = s; fb = fs; } else { a = s; fa = fs; } }
      m = (a + b) / 2; fm = f(m);
      if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
    }
    return (a + b) / 2;
  }
  function simpson(f, a, b, n) {
    n = Math.max(2, Math.round(n || 400)); if (n % 2) n++;
    var h = (b - a) / n, s = f(a) + f(b);
    for (var i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
    return s * h / 3;
  }
  KT.num = { brent: brent, simpson: simpson, erf: erf, gamma: gamma, besselj: besselj, erlangb: erlangb, normcdf: normcdf };

  function mat(A) { A = arr(A); return A.map(function (r) { return arr(r); }); }
  function gdet(A) {
    var n = A.length, M = A.map(function (r) { return r.map(function (v) { return cx(v); }); }), d = new C(1, 0);
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Cx.abs(M[r][c]) > Cx.abs(M[p][c])) p = r;
      if (Cx.abs(M[p][c]) < 1e-300) return 0;
      if (p !== c) { var t = M[p]; M[p] = M[c]; M[c] = t; d = Cx.mul(d, new C(-1, 0)); }
      d = Cx.mul(d, M[c][c]);
      for (r = c + 1; r < n; r++) { var f = Cx.div(M[r][c], M[c][c]); for (var k = c; k < n; k++) M[r][k] = Cx.sub(M[r][k], Cx.mul(f, M[c][k])); }
    }
    return simp(d);
  }
  function ginv(A) {
    var n = A.length, M = A.map(function (r, i) { return r.map(function (v) { return cx(v); }).concat(A.map(function (_, j) { return new C(i === j ? 1 : 0, 0); })); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Cx.abs(M[r][c]) > Cx.abs(M[p][c])) p = r;
      if (Cx.abs(M[p][c]) < 1e-300) throw new ExprError("matrix is singular");
      var t = M[p]; M[p] = M[c]; M[c] = t;
      var pv = M[c][c]; M[c] = M[c].map(function (v) { return Cx.div(v, pv); });
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c]; M[r] = M[r].map(function (v, k) { return Cx.sub(v, Cx.mul(f, M[c][k])); }); }
    }
    return M.map(function (r) { return r.slice(n).map(simp); });
  }
  /* ---- functions table ------------------------------------------------------ */
  var D2R = PI / 180;
  function arr(v) { return isA(v) ? v : [v]; }
  var F = {
    sin: lift(Math.sin, Cx.sin), cos: lift(Math.cos, Cx.cos), tan: lift(Math.tan, Cx.tan),
    asin: lift(Math.asin), acos: lift(Math.acos), atan: lift(Math.atan),
    sind: lift(function (x) { return Math.sin(x * D2R); }), cosd: lift(function (x) { return Math.cos(x * D2R); }), tand: lift(function (x) { return Math.tan(x * D2R); }),
    asind: lift(function (x) { return Math.asin(x) / D2R; }), acosd: lift(function (x) { return Math.acos(x) / D2R; }), atand: lift(function (x) { return Math.atan(x) / D2R; }),
    atan2: function (y, x) { return Math.atan2(num(y), num(x)); }, atan2d: function (y, x) { return Math.atan2(num(y), num(x)) / D2R; },
    sinh: lift(Math.sinh, Cx.sinh), cosh: lift(Math.cosh, Cx.cosh), tanh: lift(Math.tanh, Cx.tanh),
    asinh: lift(Math.asinh), acosh: lift(Math.acosh), atanh: lift(Math.atanh),
    sec: lift(function (x) { return 1 / Math.cos(x); }), csc: lift(function (x) { return 1 / Math.sin(x); }), cot: lift(function (x) { return 1 / Math.tan(x); }),
    exp: lift(Math.exp, Cx.exp),
    ln: lift(Math.log, Cx.log), log: lift(Math.log10, function (z) { var l = Cx.log(z); return new C(l.re / Math.LN10, l.im / Math.LN10); }),
    log10: lift(Math.log10), log2: lift(Math.log2), logb: function (x, b) { return Math.log(num(x)) / Math.log(num(b)); },
    sqrt: lift(function (x) { return x < 0 ? simp(Cx.sqrt(new C(x, 0))) : Math.sqrt(x); }, Cx.sqrt),
    cbrt: lift(Math.cbrt), nthroot: function (x, n) { x = num(x); n = num(n); return x < 0 && n % 2 === 1 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n); },
    abs: lift(Math.abs, function (z) { return Cx.abs(z); }), mag: lift(Math.abs, function (z) { return Cx.abs(z); }),
    sign: lift(Math.sign), floor: lift(Math.floor), ceil: lift(Math.ceil), trunc: lift(Math.trunc),
    round: function (x, n) { var k = Math.pow(10, n ? num(n) : 0); return lift(function (v) { return Math.round(v * k + (v >= 0 ? 1e-9 : -1e-9)) / k; })(x); },
    roundup: function (x, step) { step = step ? num(step) : 1; return lift(function (v) { return Math.ceil(v / step - 1e-9) * step; })(x); },
    sig: function (x, n) { n = n ? num(n) : 3; return lift(function (v) { return v === 0 ? 0 : +v.toPrecision(n); })(x); },
    pow: function (a, b) { return bin("^", a, b); }, hypot: function () { return Math.hypot.apply(null, reals(arguments)); },
    sq: function (x) { return bin("*", x, x); }, cube: function (x) { return bin("*", x, bin("*", x, x)); },
    rad: lift(function (x) { return x * D2R; }), deg: lift(function (x) { return x / D2R; }),
    min: function () { var a = reals(arguments); return a.length ? Math.min.apply(null, a) : NaN; },
    max: function () { var a = reals(arguments); return a.length ? Math.max.apply(null, a) : NaN; },
    clamp: function (x, a, b) { return Math.min(Math.max(num(x), num(a)), num(b)); },
    lerp: function (a, b, t) { return num(a) + (num(b) - num(a)) * num(t); },
    mod: function (a, b) { return bin("%", a, b); }, step: lift(function (x) { return x >= 0 ? 1 : 0; }), u: lift(function (x) { return x >= 0 ? 1 : 0; }),
    rect: lift(function (x) { return Math.abs(x) <= 0.5 ? 1 : 0; }), sinc: lift(function (x) { return x === 0 ? 1 : Math.sin(PI * x) / (PI * x); }),
    sq_wave: lift(function (x) { var f = x - Math.floor(x); return f < 0.5 ? 1 : -1; }), tri_wave: lift(function (x) { var f = x - Math.floor(x); return f < 0.5 ? 4 * f - 1 : 3 - 4 * f; }),
    saw: lift(function (x) { return 2 * (x - Math.floor(x + 0.5)); }), frac: lift(function (x) { return x - Math.floor(x); }),
    // complex
    cx: function (re, im) { return simp(new C(num(re), num(im || 0))); },
    pol: function (m, d) { return simp(Cx.polar(num(m), num(d) * D2R)); }, polr: function (m, r) { return simp(Cx.polar(num(m), num(r))); },
    re: lift(function (x) { return x; }, function (z) { return z.re; }), im: lift(function () { return 0; }, function (z) { return z.im; }),
    conj: lift(function (x) { return x; }, function (z) { return new C(z.re, -z.im); }),
    arg: lift(function (x) { return x < 0 ? PI : 0; }, function (z) { return Cx.arg(z); }),
    argd: lift(function (x) { return x < 0 ? 180 : 0; }, function (z) { return Cx.arg(z) / D2R; }),
    par: function () { var a = flat(arguments), s = 0; a.forEach(function (z) { s = bin("+", s, bin("/", 1, z)); }); return bin("/", 1, s); },
    // arrays
    sum: function () { var a = flat(arguments), s = 0; a.forEach(function (x) { s = bin("+", s, x); }); return s; },
    prod: function () { var a = flat(arguments), s = 1; a.forEach(function (x) { s = bin("*", s, x); }); return s; },
    mean: function () { var a = flat(arguments); return a.length ? bin("/", F.sum(a), a.length) : NaN; },
    median: function () { var a = reals(arguments).sort(function (x, y) { return x - y; }), n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : NaN; },
    variance: function () { var a = reals(arguments), m = F.mean(a), s = 0; a.forEach(function (x) { s += (x - m) * (x - m); }); return a.length > 1 ? s / (a.length - 1) : NaN; },
    pvariance: function () { var a = reals(arguments), m = F.mean(a), s = 0; a.forEach(function (x) { s += (x - m) * (x - m); }); return a.length ? s / a.length : NaN; },
    std: function () { return Math.sqrt(F.variance.apply(null, arguments)); }, pstd: function () { return Math.sqrt(F.pvariance.apply(null, arguments)); },
    rms: function () { var a = reals(arguments), s = 0; a.forEach(function (x) { s += x * x; }); return a.length ? Math.sqrt(s / a.length) : NaN; },
    len: function (a) { return isA(a) ? a.length : (typeof a === "string" ? a.length : 1); },
    sort: function (a) { return arr(a).slice().sort(function (x, y) { return num(x) - num(y); }); },
    sortdesc: function (a) { return arr(a).slice().sort(function (x, y) { return num(y) - num(x); }); },
    rev: function (a) { return arr(a).slice().reverse(); },
    cumsum: function (a) { var s = 0; return arr(a).map(function (x) { s = bin("+", s, x); return s; }); },
    diff: function (a) { a = arr(a); var r = []; for (var i = 1; i < a.length; i++) r.push(bin("-", a[i], a[i - 1])); return r; },
    seq: function (a, b, s) { a = num(a); b = num(b); s = s == null ? 1 : num(s); var r = []; if (!(s > 0 || s < 0)) return r; for (var x = a; s > 0 ? x <= b + 1e-9 * Math.abs(s) : x >= b - 1e-9 * Math.abs(s); x += s) { r.push(+x.toPrecision(12)); if (r.length > 20000) break; } return r; },
    linspace: function (a, b, n) { a = num(a); b = num(b); n = Math.max(2, Math.round(num(n))); var r = []; for (var i = 0; i < n; i++) r.push(a + (b - a) * i / (n - 1)); return r; },
    logspace: function (a, b, n) { return F.linspace(a, b, n).map(function (x) { return Math.pow(10, x); }); },
    at: function (a, i) { a = arr(a); i = Math.round(num(i)); if (i < 0) i += a.length; return a[i]; },
    first: function (a) { return arr(a)[0]; }, last: function (a) { a = arr(a); return a[a.length - 1]; },
    slice: function (a, i, j) { return arr(a).slice(num(i), j == null ? undefined : num(j)); },
    concat: function () { return flat(arguments); }, fill: function (n, v) { return new Array(Math.max(0, Math.round(num(n)))).fill(v == null ? 0 : v); },
    argmax: function (a) { a = reals(arr(a)); var k = 0; for (var i = 1; i < a.length; i++) if (a[i] > a[k]) k = i; return k; },
    argmin: function (a) { a = reals(arr(a)); var k = 0; for (var i = 1; i < a.length; i++) if (a[i] < a[k]) k = i; return k; },
    count: function (a) { return arr(a).filter(truthy).length; },
    dot: function (a, b) { return F.sum(bin("*", a, b)); },
    cross: function (a, b) { a = reals(a); b = reals(b); return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; },
    norm: function (a) { return Math.sqrt(reals(arr(a)).reduce(function (s, x) { return s + x * x; }, 0)); },
    interp: function (xs, ys, x) { return lift(function (v) { return interp(reals(xs), reals(ys), v); })(x); },
    stair: function (xs, ys, x) { return lift(function (v) { return stepdown(reals(xs), reals(ys), v); })(x); },
    pick: function (table, x) { return pickup(arr(table), num(x)); },
    choose: function (i) { var a = Array.prototype.slice.call(arguments, 1); a = a.length === 1 && isA(a[0]) ? a[0] : a; return a[Math.max(0, Math.min(a.length - 1, Math.round(num(i))))]; },
    // stats / special
    fact: lift(fact), gamma: lift(gamma), nCr: function (n, k) { return nCr(num(n), num(k)); }, nPr: function (n, k) { n = num(n); k = num(k); return fact(n) / fact(n - k); },
    erf: lift(erf), erfc: lift(function (x) { return 1 - erf(x); }),
    normpdf: function (x, m, s) { m = m == null ? 0 : num(m); s = s == null ? 1 : num(s); return lift(function (v) { return Math.exp(-0.5 * Math.pow((v - m) / s, 2)) / (s * Math.sqrt(2 * PI)); })(x); },
    normcdf: function (x, m, s) { m = m == null ? 0 : num(m); s = s == null ? 1 : num(s); return lift(function (v) { return normcdf(v, m, s); })(x); },
    norminv: function (p, m, s) { return norminv(num(p), m == null ? 0 : num(m), s == null ? 1 : num(s)); },
    binompmf: function (k, n, p) { n = num(n); p = num(p); return lift(function (x) { return nCr(n, x) * Math.pow(p, x) * Math.pow(1 - p, n - x); })(k); },
    poissonpmf: function (k, l) { l = num(l); return lift(function (x) { return Math.exp(-l + x * Math.log(l) - gammaLn(x + 1)); })(k); },
    besselj: function (n, x) { return lift(function (v) { return besselj(num(n), v); })(x); },
    erlangb: function (A, N) { return erlangb(num(A), num(N)); }, erlangc: function (A, N) { return erlangc(num(A), num(N)); },
    // polynomials and signals
    polyval: function (c, x) { c = arr(c); return isA(x) ? x.map(function (v) { return polyval(c, v); }) : polyval(c, x); },
    roots: function (c) { return polyroots(arr(c)); }, polymul: function (a, b) { return polymul(arr(a), arr(b)); }, polyadd: function (a, b) { return polyadd(arr(a), arr(b)); },
    conv: function (a, b) { return conv(arr(a), arr(b)); }, dft: function (a) { return dft(arr(a)); },
    dB: lift(function (x) { return 10 * Math.log10(x); }), dB20: lift(function (x) { return 20 * Math.log10(x); }, function (z) { return 20 * Math.log10(Cx.abs(z)); }),
    undB: lift(function (x) { return Math.pow(10, x / 10); }), undB20: lift(function (x) { return Math.pow(10, x / 20); }),
    // text helpers
    str: function (x, f) { return fmtValue(x, f ? String(f) : "auto"); }, fmt: function (x, f) { return fmtValue(x, f ? String(f) : "auto"); },
    bin: function (x, w) { x = Math.round(num(x)); var s = (x >>> 0).toString(2); if (x < 0 && w) s = s.slice(-num(w)); return w ? s.padStart(num(w), "0") : s; },
    hex: function (x, w) { x = Math.round(num(x)); var s = (x >>> 0).toString(16).toUpperCase(); return w ? s.padStart(num(w), "0").slice(-num(w)) : s; },
    oct: function (x) { return (Math.round(num(x)) >>> 0).toString(8); },
    parsebin: function (s) { return parseInt(String(s), 2); }, parsehex: function (s) { return parseInt(String(s), 16); },
    nums: function (s) { return String(s == null ? "" : s).split(/[,;\s]+/).filter(Boolean).map(function (t) { try { return num(run(t)); } catch (e) { return NaN; } }); },
    poly: function (r) { // coefficients of the product of (x - r_i), complex roots allowed
      var c = [1];
      arr(r).forEach(function (z) { var nc = c.concat([0]); for (var i = c.length; i >= 1; i--) nc[i] = bin("-", nc[i], bin("*", z, c[i - 1])); c = nc; });
      return c.map(function (v) { return isC(v) && Math.abs(v.im) < 1e-9 * Math.max(1, Math.abs(v.re)) ? v.re : v; });
    },
    // small matrices as nested arrays [[..],[..]]
    matmul: function (A, B) { A = mat(A); B = mat(B); return A.map(function (r) { return B[0].map(function (_, j) { var s = 0; r.forEach(function (v, k) { s = bin("+", s, bin("*", v, B[k][j])); }); return s; }); }); },
    matvec: function (A, x) { A = mat(A); x = arr(x); return A.map(function (r) { var s = 0; r.forEach(function (v, k) { s = bin("+", s, bin("*", v, x[k])); }); return s; }); },
    transpose: function (A) { A = mat(A); return A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); }); },
    eye: function (n) { n = Math.round(num(n)); var I = []; for (var i = 0; i < n; i++) { I.push([]); for (var j = 0; j < n; j++) I[i].push(i === j ? 1 : 0); } return I; },
    det: function (A) { return gdet(mat(A)); },
    inv: function (A) { return ginv(mat(A)); },
    solvelin: function (A, b) { var I = ginv(mat(A)); return F.matvec(I, b); },
    expm2: function (M, t) { // e^(M t) for a 2x2 matrix (real result)
      M = mat(M); t = num(t);
      var a = num(M[0][0]), b = num(M[0][1]), c = num(M[1][0]), d = num(M[1][1]), sx = (a + d) / 2, q2 = sx * sx - (a * d - b * c);
      var e = Math.exp(sx * t), ch, sh; // cosh(qt), sinh(qt)/q with q = sqrt(q2) (q2 may be negative)
      if (q2 > 1e-14 * Math.max(1, sx * sx)) { // real distinct eigenvalues: combine the exponentials directly (no overflow)
        var q = Math.sqrt(q2), l1 = sx + q, l2 = sx - q, e1 = Math.exp(l1 * t), e2 = Math.exp(l2 * t), dl = l1 - l2;
        return [[(e1 * (a - l2) - e2 * (a - l1)) / dl, (e1 - e2) * b / dl], [(e1 - e2) * c / dl, (e1 * (d - l2) - e2 * (d - l1)) / dl]];
      }
      if (q2 > -1e-14 * Math.max(1, sx * sx)) { ch = 1; sh = t; }
      else { var w = Math.sqrt(-q2); ch = Math.cos(w * t); sh = Math.sin(w * t) / w; }
      return [[e * (ch + sh * (a - sx)), e * sh * b], [e * sh * c, e * (ch + sh * (d - sx))]];
    },
    minsop: function (vals, n, names) { n = Math.round(num(n)); return qmSolve(arr(vals).map(function (v) { return typeof v === "string" ? v : num(v); }), n, String(names || "ABCDE").split(""), false).text; },
    minpos: function (vals, n, names) { n = Math.round(num(n)); return qmSolve(arr(vals).map(function (v) { return typeof v === "string" ? v : num(v); }), n, String(names || "ABCDE").split(""), true).text; },
    sopterms: function (vals, n, names) { n = Math.round(num(n)); return qmSolve(arr(vals).map(function (v) { return typeof v === "string" ? v : num(v); }), n, String(names || "ABCDE").split(""), false).terms; },
    unique: function (a) { var out = []; arr(a).forEach(function (x) { if (!out.some(function (y) { return isC(x) || isC(y) ? false : y === x || (typeof x === "number" && Math.abs(y - x) < 1e-12); })) out.push(x); }); return out; },
    join: function (a, sep) { return arr(a).map(function (x) { return typeof x === "string" ? x : fmtValue(x, "auto"); }).join(sep == null ? ", " : String(sep)); },
    cnums: function (s) { return String(s == null ? "" : s).split(/[,;]+/).map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { try { return run(t.replace(/(\d)\s*j/g, "$1*j").replace(/(^|[-+])\s*j(\d)/g, "$1j*$2")); } catch (e) { return NaN; } }); },
    argsort: function (a) { a = arr(a).map(num); return a.map(function (v, i) { return i; }).sort(function (x, y) { return a[x] - a[y]; }); },
    decimals: function (sv) { var t = String(sv).trim(), i = t.indexOf("."); return i < 0 ? 0 : t.length - i - 1; },
    polyder: function (c) { c = arr(c); var n = c.length - 1; return c.slice(0, n).map(function (v, i) { return bin("*", v, n - i); }); },
    cauer1: function (nm, dn, k) { // continued fraction about s = ∞: quotients q_i (coefficient of s)
      var a = arr(nm).map(num), b = arr(dn).map(num), out = [], lim = Math.round(num(k || 12));
      for (var it = 0; it < lim; it++) {
        while (a.length && Math.abs(a[0]) < 1e-12) a.shift();
        while (b.length && Math.abs(b[0]) < 1e-12) b.shift();
        if (!a.length || !b.length || a.length !== b.length + 1) break;
        var q = a[0] / b[0]; out.push(q);
        var r = a.slice(1).map(function (v, i) { return v - q * (b[i + 1] || 0); }); // a − q·s·b (degree drops by 1)
        while (r.length && Math.abs(r[0]) < 1e-12) r.shift();
        a = b; b = r;
        if (!b.length) break;
      }
      return out;
    },
    cauer2: function (nm, dn, k) { // about s = 0: write polynomials in ascending powers; quotients of 1/s
      var a = arr(nm).map(num).reverse(), b = arr(dn).map(num).reverse(), out = [], lim = Math.round(num(k || 12));
      for (var it = 0; it < lim; it++) {
        while (a.length && Math.abs(a[0]) < 1e-12) a.shift(); // remove leading zero (lowest power) terms: shift powers
        while (b.length && Math.abs(b[0]) < 1e-12) b.shift();
        if (!a.length || !b.length) break;
        var q = a[0] / b[0]; out.push(q);
        var r = a.map(function (v, i) { return v - q * (b[i] || 0); }).slice(1);
        while (r.length && Math.abs(r[0]) < 1e-12) r.shift();
        a = b; b = r;
        if (!b.length) break;
      }
      return out;
    },
    today: function () { return Math.floor(Date.now() / 86400000); },
    date: function (sv) { var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(sv).trim()); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN; },
    datestr: function (d) { d = num(d); if (!isFinite(d)) return "—"; var t = new Date(d * 86400000); return t.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.getUTCMonth()] + " " + t.getUTCFullYear(); },
    isnan: lift(function (x) { return isNaN(x) ? 1 : 0; }), finite: lift(function (x) { return isFinite(x) ? 1 : 0; })
  };
  KT.functions = F;
  var CONST = {
    pi: PI, π: PI, e: Math.E, j: new C(0, 1), inf: Infinity, Infinity: Infinity, NaN: NaN, true: 1, false: 0,
    c0: 299792458, mu0: 4e-7 * PI, eps0: 8.8541878128e-12, qe: 1.602176634e-19, kB: 1.380649e-23, hP: 6.62607015e-34,
    NA: 6.02214076e23, g0: 9.80665, Rgas: 8.314462618, me: 9.1093837015e-31, kC: 8.9875517923e9, sigmaSB: 5.670374419e-8, Vm0: 22.414,
    eV: 1.602176634e-19
  };
  KT.constants = CONST;

  /* ---- evaluator ----------------------------------------------------------- */
  function Scope(parent) { this.v = Object.create(parent ? parent.v : null); this.f = Object.create(parent ? parent.f : null); }
  Scope.prototype.child = function (vars) { var s = new Scope(this); if (vars) for (var k in vars) s.v[k] = vars[k]; return s; };
  Scope.prototype.set = function (k, v) { this.v[k] = v; };
  KT.Scope = Scope;

  function lazy(scope, name, node) { return evaluate(node, scope); }
  function withVar(scope, name, val) { var s = new Scope(scope); s.v[name] = val; return s; }
  function varName(node, fn) { if (!node || node.n !== "id") throw new ExprError(fn + "(): first argument must be a variable name"); return node.v; }
  var SPECIAL = {
    "if": function (a, sc) {
      for (var i = 0; i + 1 < a.length; i += 2) if (truthy(evaluate(a[i], sc))) return evaluate(a[i + 1], sc);
      return a.length % 2 ? evaluate(a[a.length - 1], sc) : NaN;
    },
    sigma: function (a, sc) { // sigma(k, from, to, expr)
      var k = varName(a[0], "sigma"), lo = Math.round(num(evaluate(a[1], sc))), hi = Math.round(num(evaluate(a[2], sc))), s = 0;
      if (hi - lo > 200000) throw new ExprError("sigma(): too many terms");
      for (var i = lo; i <= hi; i++) s = bin("+", s, evaluate(a[3], withVar(sc, k, i)));
      return s;
    },
    product: function (a, sc) {
      var k = varName(a[0], "product"), lo = Math.round(num(evaluate(a[1], sc))), hi = Math.round(num(evaluate(a[2], sc))), s = 1;
      for (var i = lo; i <= hi && i - lo < 100000; i++) s = bin("*", s, evaluate(a[3], withVar(sc, k, i)));
      return s;
    },
    map: function (a, sc) { // map(x, array, expr)  — also map(x, i, array, expr) gives the index
      var x = varName(a[0], "map");
      if (a.length === 4) { var ix = varName(a[1], "map"), arr4 = arr(evaluate(a[2], sc)); return arr4.map(function (v, i) { var s = withVar(sc, x, v); s.v[ix] = i; return evaluate(a[3], s); }); }
      return arr(evaluate(a[1], sc)).map(function (v) { return evaluate(a[2], withVar(sc, x, v)); });
    },
    filter: function (a, sc) { var x = varName(a[0], "filter"); return arr(evaluate(a[1], sc)).filter(function (v) { return truthy(evaluate(a[2], withVar(sc, x, v))); }); },
    solve: function (a, sc) { // solve(x, expr, lo, hi): root of expr = 0
      var x = varName(a[0], "solve"), lo = num(evaluate(a[2], sc)), hi = num(evaluate(a[3], sc));
      return brent(function (v) { return num(evaluate(a[1], withVar(sc, x, v))); }, lo, hi);
    },
    integral: function (a, sc) { // integral(x, a, b, expr [, n])
      var x = varName(a[0], "integral"), lo = num(evaluate(a[1], sc)), hi = num(evaluate(a[2], sc)), n = a[4] ? num(evaluate(a[4], sc)) : 400;
      return simpson(function (v) { return num(evaluate(a[3], withVar(sc, x, v))); }, lo, hi, n);
    },
    deriv: function (a, sc) { // deriv(x, at, expr)
      var x = varName(a[0], "deriv"), at = num(evaluate(a[1], sc)), h = 1e-5 * Math.max(1, Math.abs(at));
      var f = function (v) { return num(evaluate(a[2], withVar(sc, x, v))); };
      return (f(at - 2 * h) - 8 * f(at - h) + 8 * f(at + h) - f(at + 2 * h)) / (12 * h);
    },
    maximize: function (a, sc) { // maximize(x, lo, hi, expr) -> x at the maximum (golden section after a scan)
      var x = varName(a[0], "maximize"), lo = num(evaluate(a[1], sc)), hi = num(evaluate(a[2], sc));
      var f = function (v) { return num(evaluate(a[3], withVar(sc, x, v))); }, N = 400, best = lo, bv = -Infinity;
      for (var i = 0; i <= N; i++) { var v = lo + (hi - lo) * i / N, fv = f(v); if (fv > bv) { bv = fv; best = v; } }
      var l = Math.max(lo, best - (hi - lo) / N), r = Math.min(hi, best + (hi - lo) / N), g = (Math.sqrt(5) - 1) / 2;
      for (i = 0; i < 80; i++) { var c = r - g * (r - l), d = l + g * (r - l); if (f(c) > f(d)) r = d; else l = c; }
      return (l + r) / 2;
    },
    iter: function (a, sc) { // iter(v, init, n, expr): apply v = expr n times (k = step index unless k is already a variable)
      var v = varName(a[0], "iter"), x = evaluate(a[1], sc), n = Math.round(num(evaluate(a[2], sc)));
      for (var i = 0; i < n && i < 100000; i++) { var s = withVar(sc, v, x); if (!("k" in sc.v)) s.v.k = i; x = evaluate(a[3], s); }
      return x;
    },
    iterseq: function (a, sc) { // iterseq(v, init, n, expr): [x0, x1, ..., xn]
      var v = varName(a[0], "iterseq"), x = evaluate(a[1], sc), n = Math.round(num(evaluate(a[2], sc))), out = [x];
      for (var i = 0; i < n && i < 20000; i++) { var s = withVar(sc, v, x); if (!("k" in sc.v)) s.v.k = i; x = evaluate(a[3], s); out.push(x); }
      return out;
    },
    ev: function (a, sc) { // ev(text, "x", value, ...): evaluate an expression the user typed (same safe language)
      var src = evaluate(a[0], sc), s2 = new Scope(sc);
      for (var i = 1; i + 1 < a.length; i += 2) s2.v[String(evaluate(a[i], sc))] = evaluate(a[i + 1], sc);
      return evaluate(parse(String(src)), s2);
    },
    defined: function (a, sc) { return a[0] && a[0].n === "id" && (a[0].v in sc.v) ? 1 : 0; }
  };
  KT.special = SPECIAL;

  function evaluate(node, sc) {
    switch (node.n) {
      case "num": return node.v;
      case "str": return node.v;
      case "id":
        if (node.v in sc.v) return sc.v[node.v];
        if (node.v in CONST) return CONST[node.v];
        throw new ExprError("Unknown name '" + node.v + "'");
      case "neg": { var v = evaluate(node.a, sc); return bin("*", -1, v); }
      case "not": return truthy(evaluate(node.a, sc)) ? 0 : 1;
      case "bin":
        if (node.o === "&&") return truthy(evaluate(node.l, sc)) && truthy(evaluate(node.r, sc)) ? 1 : 0;
        if (node.o === "||") return truthy(evaluate(node.l, sc)) || truthy(evaluate(node.r, sc)) ? 1 : 0;
        return bin(node.o, evaluate(node.l, sc), evaluate(node.r, sc));
      case "if": return SPECIAL["if"](node.a, sc);
      case "arr": return node.a.map(function (x) { return evaluate(x, sc); });
      case "idx": {
        var a = evaluate(node.a, sc), i = Math.round(num(evaluate(node.i, sc)));
        if (typeof a === "string") return a.charAt(i);
        a = arr(a); if (i < 0) i += a.length;
        return a[i] === undefined ? NaN : a[i];
      }
      case "call": {
        if (SPECIAL[node.f]) return SPECIAL[node.f](node.a, sc);
        var uf = sc.f[node.f];
        if (uf) {
          var s = new Scope(uf.scope || sc);
          // user functions see the caller's variables (dynamic) so plots can sweep them
          s = sc.child();
          uf.params.forEach(function (p, k) { s.v[p] = node.a[k] ? evaluate(node.a[k], sc) : NaN; });
          return evaluate(uf.body, s);
        }
        var fn = F[node.f];
        if (!fn) throw new ExprError("Unknown function '" + node.f + "'");
        return fn.apply(null, node.a.map(function (x) { return evaluate(x, sc); }));
      }
    }
    throw new ExprError("Bad expression");
  }
  // defs: ["name = expr", "f(x, y) = expr", ...]
  var DEF_RX = /^\s*([A-Za-z_Ͱ-Ͽ][A-Za-z0-9_Ͱ-Ͽ']*)\s*(\(([^)]*)\))?\s*=(?!=)([\s\S]*)$/;
  function define(sc, def) {
    var m = DEF_RX.exec(def);
    if (!m) throw new ExprError("Definition must look like 'name = expression': " + def);
    if (m[2]) { sc.f[m[1]] = { params: m[3].split(",").map(function (p) { return p.trim(); }).filter(Boolean), body: parse(m[4]) }; return; }
    sc.v[m[1]] = evaluate(parse(m[4]), sc);
  }
  function run(src, sc) { return evaluate(parse(src), sc || new Scope()); }
  KT.expr = { parse: parse, evaluate: evaluate, run: run, define: define, Scope: Scope, truthy: truthy, num: num, bin: bin };

  /* ======================================================================
     Formatting
     ====================================================================== */
  var PREFIX = [[1e12, "T"], [1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "µ"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"]];
  var ENG_UNITS = /^(Ω|V|A|W|VA|VAr|var|Hz|F|H|s|J|Wh|S|C|N|Pa|m|g|V\/m|A\/m|Wb|T|bit\/s|b\/s|bps|baud|rad\/s|Ω\/m|F\/m|H\/m|S\/m|W\/m²|lm|cd|N·m|Nm|J\/kg|VAR|mho|Ω·m|Bq|sps|B|byte|bytes|FLOPS|IPS)$/;
  function trimZeros(s) { return s.indexOf("e") < 0 && s.indexOf(".") >= 0 ? s.replace(/\.?0+$/, "") : s; }
  function group(s) { // thousands separators for the integer part
    var m = /^(-?)(\d+)(\.\d+)?$/.exec(s);
    if (!m || m[2].length < 5) return s;
    return m[1] + m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (m[3] || "");
  }
  function sigStr(x, n) {
    if (!isFinite(x)) return isNaN(x) ? "—" : (x > 0 ? "∞" : "−∞");
    if (x === 0) return "0";
    var ax = Math.abs(x);
    if (ax >= 1e9 || ax < 1e-4) {
      var e = Math.floor(Math.log10(ax)), mnt = x / Math.pow(10, e);
      if (Math.abs(+mnt.toPrecision(n)) >= 10) { e++; mnt /= 10; }
      return trimZeros(mnt.toPrecision(n)) + "×10" + supNum(e);
    }
    var d = Math.max(0, n - 1 - Math.floor(Math.log10(ax)));
    return group(trimZeros(x.toFixed(Math.min(d, 12))));
  }
  function supNum(e) { var S = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" }; return String(e).split("").map(function (c) { return S[c] || c; }).join(""); }
  function eng(x, unit, n) {
    n = n || 4;
    if (!isFinite(x)) return sigStr(x, n) + (unit ? " " + unit : "");
    if (x === 0) return "0" + (unit ? " " + unit : "");
    var ax = Math.abs(x);
    for (var i = 0; i < PREFIX.length; i++) {
      if (ax >= PREFIX[i][0] * 0.99995 || i === PREFIX.length - 1) {
        if (unit === "s" && PREFIX[i][0] > 1) return sigStr(x, n) + " s";
        var v = x / PREFIX[i][0];
        if (unit === "g" && PREFIX[i][1] === "k") return trimZeros((x / 1e3).toPrecision(n)) + " kg";
        var s = Math.abs(v) >= 1000 ? sigStr(v, n) : trimZeros(v.toPrecision(n));
        return s + " " + PREFIX[i][1] + (unit || "");
      }
    }
    return sigStr(x, n);
  }
  function fmtComplex(z, mode, unit, n) {
    n = n || 4;
    var u = unit ? " " + unit : "";
    if (mode === "rect") {
      var re = sigStr(z.re, n), im = sigStr(Math.abs(z.im), n);
      return (Math.abs(z.re) < 1e-12 * Cx.abs(z) ? "" : re + (z.im < 0 ? " − " : " + ")) + (Math.abs(z.re) < 1e-12 * Cx.abs(z) && z.im < 0 ? "−" : "") + "j" + im + u;
    }
    return sigStr(Cx.abs(z), n) + u + " ∠ " + sigStr(Cx.arg(z) / D2R, n) + "°";
  }
  function fmtValue(v, f, unit) {
    f = f || "auto";
    if (v == null) return "—";
    if (typeof v === "string") return v;
    if (isA(v)) return "[" + v.slice(0, 12).map(function (x) { return fmtValue(x, f === "auto" ? "sig4" : f); }).join(", ") + (v.length > 12 ? ", …" : "") + "]";
    if (isC(v)) {
      if (f === "rect") return fmtComplex(v, "rect", unit);
      if (f === "both" || f === "auto" || f === "eng" || /^sig/.test(f)) return fmtComplex(v, "polar", unit) + "  (" + fmtComplex(v, "rect", "", 4) + ")";
      return fmtComplex(v, "polar", unit);
    }
    v = num(v);
    var u = unit ? " " + unit : "", m;
    if (typeof v !== "number" || isNaN(v)) return "—";
    if (f === "auto") f = unit && ENG_UNITS.test(unit) ? "eng" : "sig4";
    if (f === "eng") return eng(v, unit, 4);
    if ((m = /^eng(\d)$/.exec(f))) return eng(v, unit, +m[1]);
    if ((m = /^sig(\d+)$/.exec(f))) return sigStr(v, +m[1]) + u;
    if ((m = /^fix(\d+)$/.exec(f))) return isFinite(v) ? group(v.toFixed(+m[1])) + u : sigStr(v, 4) + u;
    if (f === "int") return isFinite(v) ? group(String(Math.round(v))) + u : sigStr(v, 4) + u;
    if (f === "pct") return sigStr(v * 100, 4) + " %";
    if (f === "sci") return v.toExponential(3).replace(/e([+-])(\d+)/, function (_, s, d) { return "×10" + supNum((s === "-" ? "-" : "") + d); }) + u;
    if (f === "money" || f === "naira") return "₦" + group(v.toFixed(2)) ;
    if (f === "bool") return truthy(v) ? "Yes" : "No";
    if (f === "deg") return sigStr(v, 4) + "°";
    return sigStr(v, 4) + u;
  }
  function fmtAuto(v) { return typeof v === "string" ? v : fmtValue(v, "auto"); }
  KT.fmt = { value: fmtValue, eng: eng, sig: sigStr, complex: fmtComplex };

  // "{expr}" and "{expr|fmt}" and "{expr|fmt|unit}" interpolation
  function interpolate(tpl, sc) {
    return String(tpl).replace(/\{([^{}]+)\}/g, function (all, body) {
      var parts = body.split("|");
      try { return fmtValue(run(parts[0], sc), parts[1] || "auto", parts[2] || ""); } catch (e) { return "—"; }
    });
  }
  KT.interpolate = interpolate;

  if (typeof module !== "undefined" && module.exports) { module.exports = KT; }
  if (typeof document === "undefined") return;

  /* ======================================================================
     Browser side: UI helpers
     ====================================================================== */
  var doc = document, root = doc.documentElement;
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function uid(p) { return (p || "kt") + Math.random().toString(36).slice(2, 8); }
  function reduced() {
    return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches) || root.getAttribute("data-motion") === "reduce" ||
      !!doc.querySelector("[data-fx-motion=off]");
  }
  KT.el = el; KT.uid = uid; KT.reduced = reduced;

  function label(inp) { return (inp.label || inp.id) + (inp.unit ? " (" + inp.unit + ")" : ""); }
  function pretty(v, inp) {
    if (inp && inp.fmt) return fmtValue(v, inp.fmt);
    var s = sigStr(v, 4);
    return s;
  }
  /* A slider + number box. inp = {id,label,unit,min,max,step,value,scale:'log'} ; onchange(value) */
  function rangeControl(inp, onchange) {
    var w = el("div", "kt-ctl kt-ctl--range"), id = uid("ktr"), lab = el("label", "kt-ctl__lab");
    lab.setAttribute("for", id + "n");
    lab.innerHTML = "";
    var sym = inp.sym ? el("i", "kt-sym", inp.sym) : null;
    lab.appendChild(doc.createTextNode(inp.label || inp.id));
    if (sym) { lab.appendChild(doc.createTextNode(" ")); lab.appendChild(sym); }
    if (inp.unit) lab.appendChild(el("span", "kt-unit", inp.unit));
    var row = el("div", "kt-ctl__row");
    var r = el("input"); r.type = "range"; r.id = id; r.setAttribute("aria-label", label(inp) + " slider");
    var nb = el("input", "kt-num"); nb.type = "number"; nb.id = id + "n"; nb.inputMode = "decimal"; nb.step = "any";
    var min = +inp.min, max = +inp.max, log = inp.scale === "log" && min > 0;
    var steps = 1000;
    if (log) { r.min = 0; r.max = steps; r.step = 1; } else { r.min = min; r.max = max; r.step = inp.step || (max - min) / 200; }
    function toSlider(v) { return log ? Math.round(Math.log(v / min) / Math.log(max / min) * steps) : v; }
    function fromSlider(p) {
      if (!log) return +p;
      var v = min * Math.pow(max / min, p / steps);
      var mag = Math.pow(10, Math.floor(Math.log10(v)) - 2);
      return Math.round(v / mag) * mag;
    }
    var value = inp.value != null ? +inp.value : min;
    function paint() {
      var p = log ? (toSlider(value) / steps * 100) : ((value - min) / (max - min) * 100);
      r.style.setProperty("--p", Math.max(0, Math.min(100, p)).toFixed(1) + "%");
    }
    function set(v, src) {
      if (!isFinite(v)) return;
      value = v;
      if (src !== "range") r.value = toSlider(Math.max(min, Math.min(max, v)));
      if (src !== "num") nb.value = +(+v).toPrecision(6);
      paint();
      onchange(value);
    }
    r.addEventListener("input", function () { set(fromSlider(+r.value), "range"); });
    nb.addEventListener("input", function () { var v = parseFloat(nb.value); if (isFinite(v) && (inp.free || (v >= min && v <= max))) set(v, "num"); });
    nb.addEventListener("change", function () { var v = parseFloat(nb.value); if (!isFinite(v)) v = value; if (!inp.free) v = Math.max(min, Math.min(max, v)); set(v); });
    r.value = toSlider(value); nb.value = +value.toPrecision(6); paint();
    row.appendChild(r); row.appendChild(nb);
    w.appendChild(lab); w.appendChild(row);
    w.set = function (v) { set(v); };
    return w;
  }
  function selectControl(inp, onchange) {
    var w = el("div", "kt-ctl kt-ctl--select"), lab = el("span", "kt-ctl__lab", inp.label || inp.id), opts = inp.options || [];
    w.appendChild(lab);
    var value = inp.value != null ? inp.value : (opts[0] ? opts[0][0] : 0);
    var short = opts.length <= 5 && opts.every(function (o) { return String(o[1]).length <= 16; });
    if (short) {
      var seg = el("div", "kt-seg"); seg.setAttribute("role", "radiogroup"); seg.setAttribute("aria-label", inp.label || inp.id);
      opts.forEach(function (o) {
        var b = el("button", "kt-seg__b", o[1]); b.type = "button"; b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(o[0] == value));
        b.addEventListener("click", function () {
          value = o[0];
          Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute("aria-checked", String(x === b)); });
          onchange(value);
        });
        seg.appendChild(b);
      });
      w.appendChild(seg);
    } else {
      var s = el("select", "kt-select"), id = uid("kts"); s.id = id; lab.outerHTML; var l2 = el("label", "kt-ctl__lab", inp.label || inp.id); l2.setAttribute("for", id);
      w.replaceChild(l2, lab);
      opts.forEach(function (o, i) { var op = el("option", null, o[1]); op.value = String(i); if (o[0] == value) op.selected = true; s.appendChild(op); });
      s.addEventListener("change", function () { value = opts[+s.value][0]; onchange(value); });
      w.appendChild(s);
    }
    return w;
  }
  function toggleControl(inp, onchange) {
    var w = el("div", "kt-ctl kt-ctl--toggle"), b = el("button", "kt-toggle"), v = !!inp.value;
    b.type = "button"; b.setAttribute("aria-pressed", String(v));
    b.innerHTML = '<span class="kt-toggle__sw" aria-hidden="true"></span>';
    b.appendChild(doc.createTextNode(inp.label || inp.id));
    b.addEventListener("click", function () { v = !v; b.setAttribute("aria-pressed", String(v)); onchange(v ? 1 : 0); });
    w.appendChild(b);
    return w;
  }
  function textControl(inp, onchange) {
    var w = el("div", "kt-ctl kt-ctl--text"), id = uid("ktt"), lab = el("label", "kt-ctl__lab", inp.label || inp.id);
    lab.setAttribute("for", id);
    var t = el("input", "kt-text"); t.type = "text"; t.id = id; t.value = inp.value == null ? "" : String(inp.value);
    t.spellcheck = false; t.autocapitalize = "off"; t.setAttribute("autocomplete", "off");
    if (inp.placeholder) t.placeholder = inp.placeholder;
    if (inp.pattern) t.pattern = inp.pattern;
    t.addEventListener("input", function () { onchange(t.value); });
    w.appendChild(lab); w.appendChild(t);
    return w;
  }
  /* editable table: inp = {id, label, columns:[{key,label,unit}], rows:[[...]], min_rows, max_rows} ; onchange({key: array}) */
  function tableControl(inp, onchange) {
    var w = el("div", "kt-ctl kt-ctl--table"), cols = inp.columns || [], rows = (inp.rows || []).map(function (r) { return r.slice(); });
    var cap = el("div", "kt-ctl__lab", inp.label || "Data");
    var wrap = el("div", "kt-tablewrap"), tbl = el("table", "kt-table kt-table--edit"), thead = el("thead"), tbody = el("tbody");
    var hr = el("tr");
    cols.forEach(function (c) { var th = el("th", null, c.label || c.key); if (c.unit) th.appendChild(el("span", "kt-unit", c.unit)); th.scope = "col"; hr.appendChild(th); });
    hr.appendChild(el("th", "kt-sr", "Remove"));
    thead.appendChild(hr); tbl.appendChild(thead); tbl.appendChild(tbody); wrap.appendChild(tbl);
    function emit() {
      var out = {};
      cols.forEach(function (c, j) { out[c.key] = rows.map(function (r) { var v = r[j]; return c.text ? String(v) : (v === "" || v == null ? NaN : +v); }); });
      onchange(out);
    }
    function draw() {
      tbody.innerHTML = "";
      rows.forEach(function (r, i) {
        var tr = el("tr");
        cols.forEach(function (c, j) {
          var td = el("td"), x = el("input", "kt-cell");
          x.type = c.text ? "text" : "number"; x.step = "any"; x.value = r[j] == null ? "" : r[j];
          x.setAttribute("aria-label", (c.label || c.key) + ", row " + (i + 1));
          x.addEventListener("input", function () { r[j] = c.text ? x.value : x.value; emit(); });
          td.appendChild(x); tr.appendChild(td);
        });
        var td = el("td"), del = el("button", "kt-iconbtn", "×"); del.type = "button"; del.setAttribute("aria-label", "Remove row " + (i + 1));
        del.disabled = rows.length <= (inp.min_rows || 1);
        del.addEventListener("click", function () { rows.splice(i, 1); draw(); emit(); });
        td.appendChild(del); tr.appendChild(td); tbody.appendChild(tr);
      });
    }
    var add = el("button", "kt-btn kt-btn--ghost", "+ Add row"); add.type = "button";
    add.addEventListener("click", function () {
      if (rows.length >= (inp.max_rows || 40)) return;
      var last = rows[rows.length - 1] || [];
      rows.push(cols.map(function (c, j) { return c.text ? "" : (last[j] != null ? last[j] : 0); }));
      draw(); emit();
      var inputs = tbody.querySelectorAll("tr:last-child input"); if (inputs[0]) inputs[0].focus();
    });
    draw();
    w.appendChild(cap); w.appendChild(wrap);
    var bg = el("div", "btn-group kt-btns"); bg.appendChild(add); w.appendChild(bg);
    w.initial = function () { emit(); };
    return w;
  }
  /* builds the controls for an inputs list into box; vals[id] holds SI values; ctlEls[id] the control */
  KT.buildInputs = function (ctlBox, inputs, vals, ctlEls, changed) {
    inputs.forEach(function (inp) {
      var t = inp.type || (inp.options ? "select" : "range"), c;
      var k = inp.k == null ? 1 : +inp.k;
      if (t === "select") { vals[inp.id] = inp.value != null ? inp.value : (inp.options[0] || [0])[0]; c = KT.ui.select(inp, function (v) { vals[inp.id] = v; changed(); }); }
      else if (t === "toggle") { vals[inp.id] = inp.value ? 1 : 0; c = KT.ui.toggle(inp, function (v) { vals[inp.id] = v; changed(); }); }
      else if (t === "text") { vals[inp.id] = inp.value == null ? "" : String(inp.value); c = KT.ui.text(inp, function (v) { vals[inp.id] = v; changed(); }); }
      else if (t === "table") {
        c = KT.ui.table(inp, function (cols) { Object.keys(cols).forEach(function (key) { vals[key] = cols[key]; }); vals[inp.id + "_n"] = (cols[Object.keys(cols)[0]] || []).length; changed(); });
        c.initial();
      } else {
        var r = Object.assign({}, inp);
        if (t === "number") { r.free = true; }
        vals[inp.id] = (inp.value != null ? +inp.value : +inp.min) * k;
        c = KT.ui.range(r, function (v) { vals[inp.id] = v * k; changed(); });
        if (t === "number") c.classList.add("kt-ctl--numonly");
      }
      c.setAttribute("data-in", inp.id);
      ctlEls[inp.id] = c;
      ctlBox.appendChild(c);
    });

  };
  /* scope from input values + ordered defs; sc.err holds the first error */
  KT.scopeFrom = function (vals, defs, extra) {
    var sc = new Scope();
    Object.keys(vals || {}).forEach(function (k) { sc.v[k] = vals[k]; });
    Object.keys(extra || {}).forEach(function (k) { sc.v[k] = extra[k]; });
    var err = null;
    (defs || []).forEach(function (d) { try { define(sc, d); } catch (e) { if (!err) err = e.message; var m = /^\s*([A-Za-z_\u0370-\u03ff][\w']*)\s*=/.exec(d); if (m) sc.v[m[1]] = NaN; } });
    sc.err = err;
    return sc;
  };
  KT.ui = { range: rangeControl, select: selectControl, toggle: toggleControl, text: textControl, table: tableControl, label: label };

  /* step-by-step working: list of strings (already interpolated). Returns {el, update(list)} */
  function Steps(title) {
    var box = el("div", "kt-steps"), head = el("div", "kt-steps__head");
    var h = el("b", null, title || "Working");
    var bg = el("div", "btn-group");
    var next = el("button", "kt-btn kt-btn--ghost", "Next step"), all = el("button", "kt-btn kt-btn--ghost", "Show all");
    next.type = all.type = "button";
    bg.appendChild(next); bg.appendChild(all);
    head.appendChild(h); head.appendChild(bg);
    var ol = el("ol", "kt-steps__list"); ol.setAttribute("aria-live", "polite");
    box.appendChild(head); box.appendChild(ol);
    var shown = 1, items = [];
    function paint() {
      ol.innerHTML = "";
      items.slice(0, shown).forEach(function (s) { var li = el("li"); li.textContent = s; ol.appendChild(li); });
      next.disabled = shown >= items.length; all.disabled = shown >= items.length;
      next.textContent = shown >= items.length ? "All steps shown" : "Next step (" + shown + "/" + items.length + ")";
    }
    next.addEventListener("click", function () { shown = Math.min(items.length, shown + 1); paint(); });
    all.addEventListener("click", function () { shown = items.length; paint(); });
    return { el: box, update: function (list) { items = list; if (shown > items.length) shown = items.length; if (shown < 1) shown = 1; paint(); } };
  }
  KT.Steps = Steps;

  /* ======================================================================
     Plot (canvas)
     ====================================================================== */
  var PAL_KEYS = ["--kt-1", "--kt-2", "--kt-3", "--kt-4", "--kt-5", "--kt-6"];
  function colours(host) {
    var cs = getComputedStyle(host);
    function v(n, d) { var x = cs.getPropertyValue(n).trim(); return x || d; }
    return {
      ser: PAL_KEYS.map(function (k, i) { return v(k, ["#16a34a", "#d97706", "#2563eb", "#dc2626", "#7c3aed", "#0891b2"][i]); }),
      ink: v("--kt-ink", "#1b2a24"), dim: v("--kt-dim", "#5b6f66"), grid: v("--kt-grid", "rgba(0,0,0,.08)"), axis: v("--kt-axis", "rgba(0,0,0,.35)"),
      bg: v("--kt-plot-bg", "#fff"), fill: v("--kt-fill", "rgba(22,163,74,.14)"), font: v("--kt-font", "Inter, system-ui, sans-serif"), mono: v("--kt-mono", "ui-monospace, Menlo, Consolas, monospace")
    };
  }
  function niceStep(span, n) {
    var raw = span / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  }
  function tickLabel(v, step) {
    if (v === 0) return "0";
    var av = Math.abs(v);
    if (av >= 1e5 || av < 1e-3) return eng(v, "", 3).replace(/ $/, "").replace(" ", "");
    var d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return (+v.toFixed(Math.min(d, 8))).toString().replace("-", "−");
  }
  function Plot(host, opt) {
    this.host = host; this.opt = opt || {};
    this.fig = el("figure", "kt-plot");
    if (opt.title) this.fig.appendChild(el("figcaption", "kt-plot__title", opt.title));
    this.box = el("div", "kt-plot__box");
    this.canvas = el("canvas");
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", opt.aria || opt.title || "Plot");
    this.box.appendChild(this.canvas);
    this.fig.appendChild(this.box);
    this.readout = el("div", "kt-plot__read");
    this.readout.setAttribute("aria-hidden", "true");
    this.fig.appendChild(this.readout);
    this.legend = el("div", "kt-legend");
    this.fig.appendChild(this.legend);
    host.appendChild(this.fig);
    this.ctx = this.canvas.getContext("2d");
    this.data = null; this.pointer = null;
    var self = this;
    if ("ResizeObserver" in global) new ResizeObserver(function () { self.resize(); }).observe(this.box);
    this.canvas.addEventListener("pointermove", function (e) { var r = self.canvas.getBoundingClientRect(); self.pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; self.render(); if (self.opt.onPointer) self.opt.onPointer(self.pointer, self); });
    this.canvas.addEventListener("pointerleave", function () { self.pointer = null; self.render(); });
    this.canvas.addEventListener("pointerdown", function (e) { var r = self.canvas.getBoundingClientRect(); self.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, down: true }; if (self.opt.onDown) self.opt.onDown(self.pointer, self, e); self.render(); });
    Plot.all.push(this);
    this.resize();
  }
  Plot.all = [];
  Plot.prototype.resize = function () {
    var w = this.box.clientWidth;
    if (!w) return;
    var ar = this.opt.aspect || (w < 520 ? 0.78 : 0.56), h = Math.round(Math.min(this.opt.maxh || 460, Math.max(this.opt.minh || 220, w * ar)));
    if (this.opt.square) h = Math.min(w, this.opt.maxh || 420);
    this.box.style.height = h + "px";
    var dpr = Math.min(global.devicePixelRatio || 1, w < 600 ? 2 : 2);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.render();
  };
  Plot.prototype.set = function (data) { this.data = data; this.render(); };
  Plot.prototype.colours = function () { if (!this._c || this._cv !== KT.themeVersion) { this._c = colours(this.host); this._cv = KT.themeVersion; } return this._c; };
  Plot.prototype.render = function () {
    if (!this.w || !this.data) return;
    var c = this.colours(), x = this.ctx, d = this.data;
    x.save(); x.clearRect(0, 0, this.w, this.h);
    try {
      if (d.type === "phasor" || d.type === "argand") this.drawPhasor(d, c);
      else if (d.type === "bars") this.drawBars(d, c);
      else if (d.type === "custom" && d.draw) d.draw(x, this.w, this.h, c, this);
      else this.drawXY(d, c);
    } catch (e) { if (global.console) console.warn("kt plot", e); }
    x.restore();
  };
  function rangeOf(vals, lo, hi, padFrac, log) {
    var mn = Infinity, mx = -Infinity;
    vals.forEach(function (v) { if (isFinite(v) && (!log || v > 0)) { if (v < mn) mn = v; if (v > mx) mx = v; } });
    if (lo != null && isFinite(lo)) mn = lo;
    if (hi != null && isFinite(hi)) mx = hi;
    if (!isFinite(mn) || !isFinite(mx)) return log ? [1, 10] : [0, 1];
    if (mn === mx) { if (log) { mn /= 10; mx *= 10; } else { var p = Math.abs(mn) * 0.1 || 1; mn -= p; mx += p; } }
    else if (!log) {
      var pad = (mx - mn) * (padFrac == null ? 0.06 : padFrac);
      if (lo == null || !isFinite(lo)) mn -= pad;
      if (hi == null || !isFinite(hi)) mx += pad;
    }
    return [mn, mx];
  }
  Plot.prototype.frame = function (d, c, xr, yr) {
    var x = this.ctx, small = this.w < 420;
    var L = small ? 44 : 58, R = 14, T = 12, B = small ? 40 : 46;
    if (d.y2) R = small ? 44 : 56;
    var pw = this.w - L - R, ph = this.h - T - B;
    var xlog = !!(d.x && d.x.log), ylog = !!(d.y && d.y.log);
    var X = xlog ? function (v) { return L + (Math.log10(v) - Math.log10(xr[0])) / (Math.log10(xr[1]) - Math.log10(xr[0])) * pw; } : function (v) { return L + (v - xr[0]) / (xr[1] - xr[0]) * pw; };
    var Y = ylog ? function (v) { return T + ph - (Math.log10(v) - Math.log10(yr[0])) / (Math.log10(yr[1]) - Math.log10(yr[0])) * ph; } : function (v) { return T + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph; };
    var fs = small ? 10.5 : 11.5;
    x.fillStyle = c.bg; x.fillRect(L, T, pw, ph);
    x.lineWidth = 1; x.strokeStyle = c.grid; x.fillStyle = c.dim; x.font = "500 " + fs + "px " + c.font;
    function ticks(r, log, n) {
      var out = [];
      if (log) {
        var a = Math.floor(Math.log10(r[0])), b = Math.ceil(Math.log10(r[1]));
        var stepD = Math.max(1, Math.ceil((b - a) / n));
        for (var e = a; e <= b; e += stepD) { var v = Math.pow(10, e); if (v >= r[0] * 0.999 && v <= r[1] * 1.001) out.push({ v: v, major: true }); if (stepD === 1) for (var k = 2; k < 10; k++) { var m = k * v; if (m > r[0] && m < r[1]) out.push({ v: m, major: false }); } }
        return { list: out, step: 1 };
      }
      var st = niceStep(r[1] - r[0], n), s0 = Math.ceil(r[0] / st - 1e-9) * st;
      for (var t = s0; t <= r[1] + st * 1e-9; t += st) out.push({ v: Math.abs(t) < st * 1e-9 ? 0 : t, major: true });
      return { list: out, step: st };
    }
    var xt = ticks(xr, xlog, Math.max(3, Math.floor(pw / (small ? 64 : 80)))), yt = ticks(yr, ylog, Math.max(3, Math.floor(ph / 44)));
    x.beginPath();
    xt.list.forEach(function (t) { var px = Math.round(X(t.v)) + 0.5; x.moveTo(px, T); x.lineTo(px, T + ph); });
    yt.list.forEach(function (t) { var py = Math.round(Y(t.v)) + 0.5; x.moveTo(L, py); x.lineTo(L + pw, py); });
    x.stroke();
    // zero lines
    x.strokeStyle = c.axis; x.beginPath();
    if (!ylog && yr[0] < 0 && yr[1] > 0) { var zy = Math.round(Y(0)) + 0.5; x.moveTo(L, zy); x.lineTo(L + pw, zy); }
    if (!xlog && xr[0] < 0 && xr[1] > 0) { var zx = Math.round(X(0)) + 0.5; x.moveTo(zx, T); x.lineTo(zx, T + ph); }
    x.stroke();
    x.strokeStyle = c.axis; x.strokeRect(L + 0.5, T + 0.5, pw - 1, ph - 1);
    x.textAlign = "center"; x.textBaseline = "top";
    var lastR = -1e9;
    xt.list.forEach(function (t) {
      if (!t.major) return;
      var s = xlog ? logLabel(t.v) : tickLabel(t.v, xt.step), px = X(t.v), wv = x.measureText(s).width;
      if (px - wv / 2 < lastR + 6) return;
      x.fillText(s, Math.max(L + wv / 2, Math.min(L + pw - wv / 2, px)), T + ph + 5); lastR = px + wv / 2;
    });
    x.textAlign = "right"; x.textBaseline = "middle";
    yt.list.forEach(function (t) { if (!t.major) return; x.fillText(ylog ? logLabel(t.v) : tickLabel(t.v, yt.step), L - 6, Math.max(T + 6, Math.min(T + ph - 6, Y(t.v)))); });
    // axis titles
    x.fillStyle = c.ink; x.font = "600 " + fs + "px " + c.font;
    if (d.x && d.x.label) { x.textAlign = "center"; x.textBaseline = "bottom"; x.fillText(axisTitle(d.x), L + pw / 2, this.h - 3); }
    if (d.y && d.y.label) { x.save(); x.translate(12, T + ph / 2); x.rotate(-PI / 2); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(axisTitle(d.y), 0, 0); x.restore(); }
    return { X: X, Y: Y, L: L, T: T, pw: pw, ph: ph, xlog: xlog, ylog: ylog, xr: xr, yr: yr };
  };
  function logLabel(v) { var e = Math.round(Math.log10(v)); if (e >= -2 && e <= 3) return String(+v.toPrecision(3)); return "10" + supNum(e); }
  function axisTitle(a) { return a.label + (a.unit ? " (" + a.unit + ")" : ""); }
  /* d = {x:{label,unit,log,min,max}, y:{...}, series:[{kind,label,color,x:[...],y:[...],width,dash,fill,y2:[...]}], marks:[{x,y,label}], vlines:[{x,label}], hlines:[{y,label}]} */
  Plot.prototype.drawXY = function (d, c) {
    var x = this.ctx, allX = [], allY = [];
    (d.series || []).forEach(function (s) {
      if (s.kind === "vline") { allX.push(s.x); return; }
      if (s.kind === "hline") { allY.push(s.y); return; }
      (s.x || []).forEach(function (v) { allX.push(v); });
      (s.y || []).forEach(function (v) { allY.push(v); });
      (s.y2 || []).forEach(function (v) { allY.push(v); });
      if (s.kind === "stem" || s.kind === "bar") allY.push(0);
    });
    var xa = d.x || {}, ya = d.y || {};
    var xr = rangeOf(allX, xa.min, xa.max, 0, xa.log), yr = rangeOf(allY, ya.min, ya.max, 0.08, ya.log);
    if (ya.zero && !ya.log) { yr[0] = Math.min(0, yr[0]); yr[1] = Math.max(0, yr[1]); }
    // keep crazy spikes (asymptotes) from flattening the plot: clip to 1st..99th percentile when asked
    if (ya.robust && allY.length > 20 && ya.min == null && ya.max == null) {
      var sorted = allY.filter(isFinite).sort(function (a, b) { return a - b; });
      var lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.ceil(sorted.length * 0.98) - 1];
      yr = rangeOf([lo, hi], null, null, 0.1);
    }
    var f = this.frame(d, c, xr, yr), self = this;
    x.save(); x.beginPath(); x.rect(f.L, f.T, f.pw, f.ph); x.clip();
    var legend = [];
    (d.series || []).forEach(function (s, si) {
      var col = s.color != null ? (typeof s.color === "number" ? c.ser[s.color % c.ser.length] : s.color) : c.ser[si % c.ser.length];
      if (s.label && !s.nolegend && s.kind !== "vline" && s.kind !== "hline") legend.push([col, s.label, s.dash]);
      x.strokeStyle = col; x.fillStyle = col; x.lineWidth = s.width || 2.2; x.lineJoin = "round"; x.lineCap = "round";
      x.setLineDash(s.dash ? [6, 5] : []);
      var X = f.X, Y = f.Y;
      var clampY = function (v) { var p = Y(v); return Math.max(f.T - 2000, Math.min(f.T + f.ph + 2000, p)); };
      if (s.kind === "vline") {
        if (!isFinite(s.x)) return;
        x.setLineDash([5, 4]); x.lineWidth = 1.4; x.beginPath(); x.moveTo(X(s.x), f.T); x.lineTo(X(s.x), f.T + f.ph); x.stroke();
        if (s.label) { x.setLineDash([]); x.font = "600 11px " + c.font; x.textAlign = X(s.x) > f.L + f.pw - 60 ? "right" : "left"; x.textBaseline = "top"; x.fillText(s.label, X(s.x) + (x.textAlign === "right" ? -4 : 4), f.T + 4 + (s.row || 0) * 14); }
        return;
      }
      if (s.kind === "hline") {
        if (!isFinite(s.y)) return;
        x.setLineDash([5, 4]); x.lineWidth = 1.4; x.beginPath(); x.moveTo(f.L, Y(s.y)); x.lineTo(f.L + f.pw, Y(s.y)); x.stroke();
        if (s.label) { x.setLineDash([]); x.font = "600 11px " + c.font; x.textAlign = "right"; x.textBaseline = "bottom"; x.fillText(s.label, f.L + f.pw - 4, Y(s.y) - 3); }
        return;
      }
      var xs = s.x || [], ys = s.y || [], n = Math.min(xs.length, ys.length), i;
      if (s.kind === "area" || s.fill) {
        x.save(); x.globalAlpha = s.alpha != null ? s.alpha : 0.18; x.beginPath();
        var started = false, base = s.y2;
        for (i = 0; i < n; i++) { if (!isFinite(ys[i])) continue; var px = X(xs[i]), py = clampY(ys[i]); if (!started) { x.moveTo(px, base ? clampY(base[i]) : Y(f.ylog ? yr[0] : Math.max(yr[0], Math.min(yr[1], 0)))); started = true; } x.lineTo(px, py); }
        for (i = n - 1; i >= 0; i--) { if (!isFinite(ys[i])) continue; x.lineTo(X(xs[i]), base ? clampY(base[i]) : Y(f.ylog ? yr[0] : Math.max(yr[0], Math.min(yr[1], 0)))); }
        x.closePath(); x.fill(); x.restore();
        if (s.kind === "area") return;
      }
      if (s.kind === "stem" || s.kind === "bar") {
        var y0 = Y(f.ylog ? yr[0] : Math.max(yr[0], Math.min(yr[1], 0)));
        var bw = s.kind === "bar" ? Math.max(3, Math.min(40, f.pw / Math.max(1, n) * 0.7)) : 0;
        for (i = 0; i < n; i++) {
          if (!isFinite(ys[i])) continue;
          var sx = X(xs[i]), sy = clampY(ys[i]);
          if (s.colors && s.colors[i] != null) { x.strokeStyle = x.fillStyle = typeof s.colors[i] === "number" ? c.ser[s.colors[i] % c.ser.length] : s.colors[i]; } else { x.strokeStyle = x.fillStyle = col; }
          if (bw) { x.globalAlpha = 0.85; x.fillRect(sx - bw / 2, Math.min(sy, y0), bw, Math.abs(y0 - sy)); x.globalAlpha = 1; }
          else { x.beginPath(); x.moveTo(sx, y0); x.lineTo(sx, sy); x.stroke(); x.beginPath(); x.arc(sx, sy, 3.6, 0, 2 * PI); x.fill(); }
        }
        return;
      }
      if (s.kind === "points" || s.kind === "scatter") {
        for (i = 0; i < n; i++) {
          if (!isFinite(ys[i]) || !isFinite(xs[i])) continue;
          x.beginPath(); x.arc(X(xs[i]), clampY(ys[i]), s.r || 4.5, 0, 2 * PI); x.fill();
          if (s.labels && s.labels[i]) { x.font = "600 11px " + c.font; x.textAlign = "left"; x.textBaseline = "bottom"; x.fillStyle = c.ink; x.fillText(s.labels[i], X(xs[i]) + 6, clampY(ys[i]) - 4); x.fillStyle = col; }
        }
        return;
      }
      // line / step
      x.beginPath();
      var pen = false, prevY = null;
      for (i = 0; i < n; i++) {
        var yv = ys[i], xv = xs[i];
        if (!isFinite(yv) || !isFinite(xv) || (f.ylog && yv <= 0) || (f.xlog && xv <= 0)) { pen = false; continue; }
        var qx = X(xv), qy = clampY(yv);
        if (!pen) { x.moveTo(qx, qy); pen = true; }
        else if (s.kind === "step") { x.lineTo(qx, prevY); x.lineTo(qx, qy); }
        else x.lineTo(qx, qy);
        prevY = qy;
      }
      x.stroke();
    });
    x.setLineDash([]);
    // marks (labels that would collide with an earlier one are skipped)
    var placed = [];
    (d.marks || []).forEach(function (m, mi) {
      if (!isFinite(m.x) || !isFinite(m.y)) return;
      var col = m.color != null ? (typeof m.color === "number" ? c.ser[m.color % c.ser.length] : m.color) : c.ink;
      var px = f.X(m.x), py = f.Y(m.y);
      x.fillStyle = c.bg; x.strokeStyle = col; x.lineWidth = 2.4; x.beginPath(); x.arc(px, py, 5.5, 0, 2 * PI); x.fill(); x.stroke();
      if (m.label) {
        x.font = "700 11.5px " + c.font; x.fillStyle = c.ink; var tw = x.measureText(m.label).width;
        var lx = px + 9, ly = py - 10; if (lx + tw > f.L + f.pw - 4) lx = px - 9 - tw; if (ly < f.T + 10) ly = py + 14;
        x.textAlign = "left"; x.textBaseline = "middle";
        var box = [lx - 3, ly - 8, tw + 6, 16];
        if (placed.some(function (b) { return box[0] < b[0] + b[2] && b[0] < box[0] + box[2] && box[1] < b[1] + b[3] && b[1] < box[1] + box[3]; })) return;
        placed.push(box);
        x.globalAlpha = 0.85; x.fillStyle = c.bg; x.fillRect(lx - 3, ly - 8, tw + 6, 16); x.globalAlpha = 1; x.fillStyle = c.ink; x.fillText(m.label, lx, ly);
      }
    });
    x.restore();
    // crosshair
    var p = this.pointer, read = "";
    if (p && p.x >= f.L && p.x <= f.L + f.pw && p.y >= f.T && p.y <= f.T + f.ph && !d.nocross) {
      var xv = f.xlog ? Math.pow(10, Math.log10(xr[0]) + (p.x - f.L) / f.pw * (Math.log10(xr[1]) - Math.log10(xr[0]))) : xr[0] + (p.x - f.L) / f.pw * (xr[1] - xr[0]);
      x.strokeStyle = c.axis; x.lineWidth = 1; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(Math.round(p.x) + 0.5, f.T); x.lineTo(Math.round(p.x) + 0.5, f.T + f.ph); x.stroke(); x.setLineDash([]);
      var parts = [(xa.sym || xa.label || "x") + " = " + fmtValue(xv, "sig4", xa.unit || "")];
      (d.series || []).forEach(function (s, si) {
        if (!s.x || !s.y || s.kind === "points" || s.kind === "scatter" || s.kind === "vline" || s.kind === "hline" || s.nocross || s.kind === "area") return;
        var xs = s.x, ys = s.y, k = -1, best = Infinity;
        for (var i2 = 0; i2 < xs.length; i2++) { var dd = Math.abs(f.X(xs[i2]) - p.x); if (dd < best) { best = dd; k = i2; } }
        if (k < 0 || best > 30 || !isFinite(ys[k])) return;
        var col = s.color != null ? (typeof s.color === "number" ? c.ser[s.color % c.ser.length] : s.color) : c.ser[si % c.ser.length];
        x.fillStyle = col; x.beginPath(); x.arc(f.X(xs[k]), f.Y(ys[k]), 4, 0, 2 * PI); x.fill();
        parts.push((s.label || ya.label || "y") + " = " + fmtValue(ys[k], "sig4", s.unit || ya.unit || ""));
      });
      read = parts.join("   ·   ");
    }
    this.readout.textContent = read || (d.hint || (this.w > 0 ? "Point at the plot to read values." : ""));
    this.setLegend(legend);
  };
  Plot.prototype.setLegend = function (items) {
    var key = JSON.stringify(items);
    if (key === this._lk) return;
    this._lk = key;
    this.legend.innerHTML = "";
    items.forEach(function (it) { var s = el("span", "kt-legend__i"); var sw = el("i"); sw.style.background = it[0]; if (it[2]) sw.className = "is-dash"; s.appendChild(sw); s.appendChild(doc.createTextNode(it[1])); this.legend.appendChild(s); }, this);
  };
  /* phasors: d = {items:[{z:C|number, label, color, from: C}], unit, circle: true, angleRef} */
  Plot.prototype.drawPhasor = function (d, c) {
    var x = this.ctx, w = this.w, h = this.h, items = d.items || [];
    var R = 0;
    items.forEach(function (it) { var z = cx(it.z), f0 = it.from ? cx(it.from) : new C(0, 0); R = Math.max(R, Cx.abs(z), Cx.abs(Cx.add(z, f0)), Cx.abs(f0)); });
    if (d.scale) R = Math.max(R, d.scale);
    if (!(R > 0)) R = 1;
    var cxp = w / 2, cyp = h / 2, rad = Math.min(w, h) / 2 - 26, k = rad / R;
    var st = niceStep(R, 3);
    x.fillStyle = c.bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = c.grid; x.lineWidth = 1;
    for (var r = st; r <= R * 1.0001; r += st) { x.beginPath(); x.arc(cxp, cyp, r * k, 0, 2 * PI); x.stroke(); }
    for (var a = 0; a < 12; a++) { x.beginPath(); x.moveTo(cxp, cyp); x.lineTo(cxp + Math.cos(a * PI / 6) * rad, cyp - Math.sin(a * PI / 6) * rad); x.stroke(); }
    x.strokeStyle = c.axis; x.beginPath(); x.moveTo(cxp - rad - 10, cyp); x.lineTo(cxp + rad + 10, cyp); x.moveTo(cxp, cyp - rad - 10); x.lineTo(cxp, cyp + rad + 10); x.stroke();
    x.fillStyle = c.dim; x.font = "500 10.5px " + c.font; x.textAlign = "left"; x.textBaseline = "top";
    x.fillText(d.type === "argand" ? "Re" : "0°", cxp + rad - 8, cyp + 4);
    x.textAlign = "left"; x.fillText(d.type === "argand" ? "Im" : "90°", cxp + 5, cyp - rad - 8);
    x.textAlign = "right"; x.textBaseline = "bottom"; x.fillText(sigStr(R, 3) + (d.unit ? " " + d.unit : ""), w - 6, h - 4);
    var legend = [];
    items.forEach(function (it, i) {
      var z = cx(it.z), f0 = it.from ? cx(it.from) : new C(0, 0);
      var col = it.color != null ? (typeof it.color === "number" ? c.ser[it.color % c.ser.length] : it.color) : c.ser[i % c.ser.length];
      var x1 = cxp + f0.re * k, y1 = cyp - f0.im * k, x2 = x1 + z.re * k, y2 = y1 - z.im * k;
      if (it.point) { x.fillStyle = col; x.beginPath(); x.arc(x2, y2, 5, 0, 2 * PI); x.fill(); }
      else arrow(x, x1, y1, x2, y2, col, it.width || 2.6, it.dash);
      if (it.label) {
        x.font = "700 12px " + c.font; x.fillStyle = col; x.textAlign = "center"; x.textBaseline = "middle";
        var ang = Math.atan2(y2 - y1, x2 - x1), lx = x2 + Math.cos(ang) * 14, ly = y2 + Math.sin(ang) * 14;
        x.fillText(it.label, Math.max(12, Math.min(w - 12, lx)), Math.max(10, Math.min(h - 10, ly)));
      }
      if (it.label && !it.nolegend) legend.push([col, it.label + " = " + fmtComplex(z, "polar", it.unit || d.unit || "", 3), it.dash]);
    });
    if (d.poly) { // polygon through points (roots)
      x.strokeStyle = c.ser[1]; x.lineWidth = 1.4; x.setLineDash([4, 4]); x.beginPath();
      d.poly.forEach(function (z, i) { z = cx(z); var px = cxp + z.re * k, py = cyp - z.im * k; if (i) x.lineTo(px, py); else x.moveTo(px, py); });
      x.closePath(); x.stroke(); x.setLineDash([]);
    }
    if (d.ring) { x.strokeStyle = c.ser[2]; x.setLineDash([4, 4]); x.beginPath(); x.arc(cxp, cyp, d.ring * k, 0, 2 * PI); x.stroke(); x.setLineDash([]); }
    this.readout.textContent = d.hint || "";
    this.setLegend(legend);
    this.phasorMap = { cx: cxp, cy: cyp, k: k };
  };
  function arrow(x, x1, y1, x2, y2, col, wd, dash) {
    var ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1), hl = Math.min(11, len * 0.4);
    x.save(); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = wd; x.lineCap = "round";
    if (dash) x.setLineDash([5, 4]);
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2 - Math.cos(ang) * hl * 0.6, y2 - Math.sin(ang) * hl * 0.6); x.stroke(); x.setLineDash([]);
    if (len > 2) { x.beginPath(); x.moveTo(x2, y2); x.lineTo(x2 - hl * Math.cos(ang - 0.42), y2 - hl * Math.sin(ang - 0.42)); x.lineTo(x2 - hl * Math.cos(ang + 0.42), y2 - hl * Math.sin(ang + 0.42)); x.closePath(); x.fill(); }
    x.restore();
  }
  KT.arrow = arrow;
  /* bars: d = {labels:[..], values:[..], colors:[..], unit, y:{label,unit,min,max}, ref:[{y,label}]} */
  Plot.prototype.drawBars = function (d, c) {
    var x = this.ctx, vals = (d.values || []).map(num), labels = d.labels || [], n = vals.length;
    var ya = d.y || {}, all = vals.slice(); (d.ref || []).forEach(function (r) { all.push(r.y); }); all.push(0);
    var yr = rangeOf(all, ya.min, ya.max, 0.12, ya.log);
    var f = this.frame({ x: { label: d.x && d.x.label }, y: ya }, c, [0, Math.max(1, n)], yr);
    // replace x tick labels with category labels: blank out the bottom band first
    x.fillStyle = getComputedStyle(this.host).getPropertyValue("--kt-panel").trim() || c.bg;
    x.save(); x.clearRect(f.L - 2, f.T + f.ph + 1, f.pw + 4, (this.w < 420 ? 40 : 46) - 16); x.restore();
    var bw = f.pw / Math.max(1, n), y0 = f.Y(Math.max(yr[0], Math.min(yr[1], 0)));
    x.font = "600 " + (this.w < 420 ? 10 : 11) + "px " + c.font; x.textAlign = "center";
    for (var i = 0; i < n; i++) {
      var col = d.colors && d.colors[i] != null ? (typeof d.colors[i] === "number" ? c.ser[d.colors[i] % c.ser.length] : d.colors[i]) : c.ser[(d.color || 0) % c.ser.length];
      var px = f.L + bw * i + bw * 0.16, wv = bw * 0.68, py = f.Y(vals[i]);
      if (!isFinite(py)) continue;
      x.fillStyle = col; x.globalAlpha = 0.88; x.fillRect(px, Math.min(py, y0), wv, Math.max(1, Math.abs(y0 - py))); x.globalAlpha = 1;
      x.fillStyle = c.ink; x.textBaseline = vals[i] >= 0 ? "bottom" : "top";
      if (wv > 22) x.fillText(fmtValue(vals[i], d.fmt || "sig3"), px + wv / 2, vals[i] >= 0 ? Math.min(py, y0) - 2 : Math.max(py, y0) + 2);
      x.fillStyle = c.dim; x.textBaseline = "top";
      var lab = String(labels[i] == null ? i + 1 : labels[i]), maxw = bw - 4;
      while (lab.length > 2 && x.measureText(lab).width > maxw) lab = lab.slice(0, -2) + "…";
      x.fillText(lab, px + wv / 2, f.T + f.ph + 5);
    }
    (d.ref || []).forEach(function (r) {
      if (!isFinite(r.y)) return;
      x.strokeStyle = c.ser[3]; x.setLineDash([5, 4]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(f.L, f.Y(r.y)); x.lineTo(f.L + f.pw, f.Y(r.y)); x.stroke(); x.setLineDash([]);
      if (r.label) { x.fillStyle = c.ink; x.textAlign = "right"; x.textBaseline = "bottom"; x.fillText(r.label, f.L + f.pw - 4, f.Y(r.y) - 3); }
    });
    this.readout.textContent = d.hint || "";
    this.setLegend([]);
  };
  KT.Plot = Plot;

  /* ---- animation clock: one rAF loop for every animated tool -------------- */
  var anims = [], running = false, last = 0;
  function loop(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    var any = false;
    if (!doc.hidden) anims.forEach(function (a) { if (a.visible && a.playing) { a.t += dt * (a.speed || 1); a.tick(a.t, dt); any = true; } });
    if (any) global.requestAnimationFrame(loop); else { running = false; last = 0; }
  }
  function kick() { if (!running) { running = true; last = 0; global.requestAnimationFrame(loop); } }
  var io = "IntersectionObserver" in global ? new IntersectionObserver(function (en) {
    en.forEach(function (e) { var a = e.target._ktAnim; if (a) { a.visible = e.isIntersecting && e.target.offsetParent !== null; if (a.visible) kick(); } });
  }, { rootMargin: "60px 0px" }) : null;
  /* KT.animate(rootEl, tick(t, dt), {still}) -> {play(), pause(), button} */
  KT.animate = function (rootEl, tick, opt) {
    opt = opt || {};
    var a = { t: opt.start || 0, tick: tick, visible: !io, playing: !reduced(), speed: opt.speed || 1 };
    rootEl._ktAnim = a;
    anims.push(a);
    if (io) io.observe(rootEl);
    var b = el("button", "kt-btn kt-btn--ghost kt-play"); b.type = "button";
    function paint() { b.textContent = a.playing ? "Pause" : "Play"; b.setAttribute("aria-pressed", String(!a.playing)); b.setAttribute("aria-label", (a.playing ? "Pause" : "Play") + " the animation"); }
    b.addEventListener("click", function () { a.playing = !a.playing; paint(); kick(); if (!a.playing) tick(a.t, 0); });
    paint();
    if (!a.playing) { a.t = opt.still != null ? opt.still : a.t; }
    a.button = b;
    a.kick = kick;
    setTimeout(function () { tick(a.t, 0); kick(); }, 0);
    return a;
  };
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden) kick(); });
  // tab panels become visible without scrolling: re-check visibility on clicks
  doc.addEventListener("click", function () { setTimeout(function () { anims.forEach(function (a) { }); kick(); }, 60); }, true);

  /* ---- theme changes: bump a version so plots re-read their colours ------- */
  KT.themeVersion = 0;
  function themeChanged() { KT.themeVersion++; Plot.all.forEach(function (p) { p.render(); }); (KT._themeHooks || []).forEach(function (f) { try { f(); } catch (e) { } }); }
  KT.onTheme = function (f) { (KT._themeHooks = KT._themeHooks || []).push(f); };
  new MutationObserver(themeChanged).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (global.matchMedia) { var mq = global.matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", themeChanged); }

  /* ======================================================================
     Registry and boot
     ====================================================================== */
  KT.defs = KT.defs || {};
  KT.define = function (key, init) { KT.defs[key] = init; if (doc.readyState !== "loading") setTimeout(KT.boot, 0); };
  KT.settings = function (rootEl) {
    var id = rootEl.getAttribute("data-settings-id"), s = {};
    try {
      if (id && doc.getElementById(id)) s = JSON.parse(doc.getElementById(id).textContent || "{}") || {};
      else if (rootEl.getAttribute("data-settings")) s = JSON.parse(rootEl.getAttribute("data-settings")) || {};
    } catch (e) { s = {}; }
    return s;
  };
  KT.boot = function () {
    Array.prototype.forEach.call(doc.querySelectorAll("[data-kt]"), function (r) {
      var key = r.getAttribute("data-kt"), init = KT.defs[key];
      if (!init || r._kt) return;
      r._kt = true;
      var mount = r.querySelector("[data-kt-mount]") || r;
      try { init(mount, KT.settings(r), r); r.classList.add("kt--live"); }
      catch (e) { if (global.console) console.warn("knowledge tool " + key, e); var m = el("p", "kt-error", "This tool could not start: " + (e.message || e)); mount.appendChild(m); }
    });
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", KT.boot); else setTimeout(KT.boot, 0);
})(typeof window !== "undefined" ? window : globalThis);
