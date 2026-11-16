/* EE Hub MATLAB-compatible runner: function library (maths, arrays, text, linear algebra, numerical methods).
   Loaded after mlab.js. Every function follows MATLAB's documented behaviour for the cases the lessons teach;
   anything outside that raises a clear error instead of returning a wrong answer. */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./mlab.js")); else factory(root.MLab); })(typeof self !== "undefined" ? self : this, function (MLab) {
  "use strict";
  var _ = MLab._, B = MLab.B, U = MLab.UNSUPPORTED, M = _.M, num = _.num, bool = _.bool, str = _.str, empty = _.empty, zeros = _.zeros, err = _.err, text = _.text, scalar = _.scalar,
    isText = _.isText, cell = _.cell, struct = _.struct, ew = _.ew, C = _.C, COLON = _.COLON, fmtG = _.fmtG, expo = _.expo, fixed = _.fixed, pad = _.pad, isInt = _.isInt;
  function def(names, fn) { names.split(" ").forEach(function (n) { B[n] = fn; }); }
  function need(args, lo, hi, name) { if (args.length < lo) throw err("Not enough input arguments" + (name ? " for '" + name + "'." : ".")); if (hi !== undefined && args.length > hi) throw err("Too many input arguments" + (name ? " for '" + name + "'." : ".")); }
  function mat(v, name) { if (!v || v.t !== "m") throw err((name ? "'" + name + "': " : "") + "expected a numeric array but got a " + (v ? _.className(v) : "missing value") + "."); return v; }
  function vec(v, name) { return mat(v, name).d; }
  function like(v, d, k) { return M(v.r, v.c, d, null, k || "d"); }
  function rowOrCol(v, d) { return v.c === 1 && v.r !== 1 ? M(d.length, 1, d) : M(1, d.length, d); }
  function intArg(v, name) { var x = scalar(v, name); if (x !== Math.floor(x)) throw err((name || "Value") + " must be an integer."); return x; }

  /* ---- element-wise maths ---- */
  function unary(name, fr, fc, bad) {
    B[name] = function (a) {
      need(a, 1, 1, name); var v = a[0];
      if (v.t !== "m") { throw err("Undefined function '" + name + "' for input arguments of type '" + _.className(v) + "'."); }
      var n = v.d.length, d = new Array(n), i, cx = !!v.im;
      if (!cx && bad) for (i = 0; i < n; i++) if (bad(v.d[i])) { cx = true; break; }
      if (!cx) { for (i = 0; i < n; i++) d[i] = fr(v.d[i]); return M(v.r, v.c, d); }
      if (!fc) throw err("'" + name + "' of complex values is not supported by the browser runner.");
      var im = new Array(n), o = [0, 0], any = false;
      for (i = 0; i < n; i++) { fc(v.d[i], v.im ? v.im[i] : 0, o); d[i] = o[0]; im[i] = o[1]; if (o[1] !== 0) any = true; }
      return M(v.r, v.c, d, any ? im : null);
    };
  }
  function csqrt(a, b, o) { if (b === 0) { if (a >= 0) { o[0] = Math.sqrt(a); o[1] = 0; } else { o[0] = 0; o[1] = Math.sqrt(-a); } return; } var m = Math.hypot(a, b), re = Math.sqrt((m + a) / 2), im = Math.sqrt((m - a) / 2); o[0] = re; o[1] = b < 0 ? -im : im; }
  function clog(a, b, o) { o[0] = Math.log(Math.hypot(a, b)); o[1] = Math.atan2(b, a); }
  var neg = function (x) { return x < 0; };
  unary("sqrt", Math.sqrt, csqrt, neg);
  unary("exp", Math.exp, function (a, b, o) { var e = Math.exp(a); o[0] = e * Math.cos(b); o[1] = e * Math.sin(b); });
  unary("log", Math.log, clog, neg);
  unary("log10", function (x) { var r = Math.log10(x); return r; }, function (a, b, o) { clog(a, b, o); o[0] /= Math.LN10; o[1] /= Math.LN10; }, neg);
  unary("log2", Math.log2, function (a, b, o) { clog(a, b, o); o[0] /= Math.LN2; o[1] /= Math.LN2; }, neg);
  unary("sin", Math.sin, function (a, b, o) { o[0] = Math.sin(a) * Math.cosh(b); o[1] = Math.cos(a) * Math.sinh(b); });
  unary("cos", Math.cos, function (a, b, o) { o[0] = Math.cos(a) * Math.cosh(b); o[1] = -Math.sin(a) * Math.sinh(b); });
  unary("tan", Math.tan); unary("asin", Math.asin); unary("acos", Math.acos); unary("atan", Math.atan);
  unary("sinh", Math.sinh); unary("cosh", Math.cosh); unary("tanh", Math.tanh); unary("asinh", Math.asinh); unary("acosh", Math.acosh); unary("atanh", Math.atanh);
  unary("sec", function (x) { return 1 / Math.cos(x); }); unary("csc", function (x) { return 1 / Math.sin(x); }); unary("cot", function (x) { return 1 / Math.tan(x); });
  function dtrig(f) { return function (x) { var q = ((x % 360) + 360) % 360; if (f === "s") return q === 0 || q === 180 ? 0 : q === 90 ? 1 : q === 270 ? -1 : q === 30 || q === 150 ? 0.5 : q === 210 || q === 330 ? -0.5 : Math.sin(x * Math.PI / 180); if (f === "c") return q === 90 || q === 270 ? 0 : q === 0 ? 1 : q === 180 ? -1 : q === 60 || q === 300 ? 0.5 : q === 120 || q === 240 ? -0.5 : Math.cos(x * Math.PI / 180); return q === 0 || q === 180 ? 0 : q === 45 || q === 225 ? 1 : q === 135 || q === 315 ? -1 : q === 90 ? Infinity : q === 270 ? -Infinity : Math.tan(x * Math.PI / 180); }; }
  unary("sind", dtrig("s")); unary("cosd", dtrig("c")); unary("tand", dtrig("t"));
  unary("asind", function (x) { return Math.asin(x) * 180 / Math.PI; }); unary("acosd", function (x) { return Math.acos(x) * 180 / Math.PI; }); unary("atand", function (x) { return Math.atan(x) * 180 / Math.PI; });
  unary("deg2rad", function (x) { return x * Math.PI / 180; }); unary("rad2deg", function (x) { return x * 180 / Math.PI; });
  unary("abs", Math.abs, function (a, b, o) { o[0] = Math.hypot(a, b); o[1] = 0; });
  unary("floor", Math.floor, function (a, b, o) { o[0] = Math.floor(a); o[1] = Math.floor(b); }); unary("ceil", Math.ceil, function (a, b, o) { o[0] = Math.ceil(a); o[1] = Math.ceil(b); });
  unary("fix", Math.trunc, function (a, b, o) { o[0] = Math.trunc(a); o[1] = Math.trunc(b); });
  unary("sign", function (x) { return x > 0 ? 1 : x < 0 ? -1 : x; });
  unary("real", function (x) { return x; }, function (a, b, o) { o[0] = a; o[1] = 0; });
  unary("imag", function () { return 0; }, function (a, b, o) { o[0] = b; o[1] = 0; });
  unary("conj", function (x) { return x; }, function (a, b, o) { o[0] = a; o[1] = -b; });
  unary("angle", function (x) { return x < 0 ? Math.PI : 0; }, function (a, b, o) { o[0] = Math.atan2(b, a); o[1] = 0; });
  B.phase = B.angle;
  unary("factorial", function (x) { if (x < 0 || x !== Math.floor(x)) throw err("N must be an array of real non-negative integers."); var r = 1; for (var i = 2; i <= x; i++) r *= i; return r; });
  unary("gamma", function (x) { if (x === Math.floor(x) && x > 0 && x < 171) { var r = 1; for (var i = 2; i < x; i++) r *= i; return r; } var g = 7, p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    function gm(z) { if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gm(1 - z)); z -= 1; var a = p[0], t = z + g + 0.5; for (var i = 1; i < 9; i++) a += p[i] / (z + i); return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * a; } return gm(x); });
  unary("isnan", function (x) { return x !== x ? 1 : 0; }); unary("isinf", function (x) { return x === Infinity || x === -Infinity ? 1 : 0; }); unary("isfinite", function (x) { return isFinite(x) ? 1 : 0; });
  ["isnan", "isinf", "isfinite"].forEach(function (n) { var f = B[n]; B[n] = function (a) { var o = f(a); o.k = "l"; return o; }; });
  B.round = function (a) { need(a, 1, 2, "round"); var v = mat(a[0], "round"), p = a.length > 1 ? Math.pow(10, intArg(a[1])) : 1, f = function (x) { var y = x * p; return (y < 0 ? -Math.round(-y) : Math.round(y)) / p; }; return M(v.r, v.c, v.d.map(f), v.im ? v.im.map(f) : null); };
  B.isprime = function (a) { var v = mat(a[0]); return like(v, v.d.map(function (x) { if (x < 2 || x !== Math.floor(x)) return 0; for (var i = 2; i * i <= x; i++) if (x % i === 0) return 0; return 1; }), "l"); };
  function binary(name, fr, fc, kind) { B[name] = function (a) { need(a, 2, 2, name); return ew(mat(a[0], name), mat(a[1], name), fr, fc, kind); }; }
  binary("mod", function (x, y) { if (y === 0) return x; var r = x % y; return r !== 0 && (r < 0) !== (y < 0) ? r + y : r; });
  binary("rem", function (x, y) { return y === 0 ? NaN : x % y; });
  binary("atan2", Math.atan2); binary("hypot", Math.hypot);
  binary("gcd", function (x, y) { x = Math.abs(x); y = Math.abs(y); while (y) { var t = y; y = x % y; x = t; } return x; });
  binary("lcm", function (x, y) { var a = Math.abs(x), b = Math.abs(y), g = a, h = b; while (h) { var t = h; h = g % h; g = t; } return g ? a * b / g : 0; });
  binary("nthroot", function (x, n) { if (x < 0 && n % 2 === 0) throw err("If X is negative, N must be an odd integer."); return x < 0 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n); });
  binary("xor", function (x, y) { return (x !== 0) !== (y !== 0) ? 1 : 0; }, null, "l");
  binary("bitand", function (x, y) { return (x & y) >>> 0; }); binary("bitor", function (x, y) { return (x | y) >>> 0; }); binary("bitxor", function (x, y) { return (x ^ y) >>> 0; });
  binary("bitshift", function (x, y) { return y >= 0 ? x * Math.pow(2, y) : Math.floor(x / Math.pow(2, -y)); });
  [["plus", "+"], ["minus", "-"], ["times", ".*"], ["rdivide", "./"], ["ldivide", ".\\"], ["power", ".^"], ["mtimes", "*"], ["mrdivide", "/"], ["mldivide", "\\"], ["mpower", "^"], ["eq", "=="], ["ne", "~="], ["lt", "<"], ["le", "<="], ["gt", ">"], ["ge", ">="], ["and", "&"], ["or", "|"]].forEach(function (p) { B[p[0]] = function (a, n, I) { need(a, 2, 2, p[0]); return _.binop(p[1], a[0], a[1], I); }; });
  B.not = function (a) { var v = mat(a[0]); return like(v, v.d.map(function (x) { return x === 0 ? 1 : 0; }), "l"); };
  B.uminus = function (a) { var v = mat(a[0]); return M(v.r, v.c, v.d.map(function (x) { return -x; }), v.im ? v.im.map(function (x) { return -x; }) : null); };
  B.transpose = function (a) { return _.transpose(a[0], false); }; B.ctranspose = function (a) { return _.transpose(a[0], true); };
  B.complex = function (a) { need(a, 2, 2, "complex"); var x = mat(a[0]), y = mat(a[1]); var o = ew(x, y, function (p) { return p; }); var im = ew(x, y, function (p, q) { return q; }); o.im = im.d; return o; };
  B.nchoosek = function (a) { var n = scalar(a[0]), k = scalar(a[1]), r = 1; if (k > n) throw err("K must be an integer between 0 and N."); for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return num(Math.round(r)); };
  B.primes = function (a) { var n = scalar(a[0]), out = [], s = []; for (var i = 2; i <= n; i++) { if (!s[i]) { out.push(i); for (var j = i * i; j <= n; j += i) s[j] = 1; } } return _.rowv(out); };
  B.factor = function (a) { var n = scalar(a[0]), out = []; for (var p = 2; p * p <= n; p++) while (n % p === 0) { out.push(p); n /= p; } if (n > 1 || !out.length) out.push(n); return _.rowv(out); };

  /* ---- constants ---- */
  function konst(name, v) { B[name] = function (a, n, I) { if (a.length) return fill(a, v, name); return typeof v === "object" ? v() : num(v); }; }
  function dims(a, name) {
    var d = [], i;
    a = a.filter(function (x) { return !(isText(x)); });
    if (a.length === 0) return [1, 1];
    if (a.length === 1) { var v = mat(a[0], name); if (v.d.length === 1) return [v.d[0], v.d[0]]; if (v.d.length > 2) { for (i = 2; i < v.d.length; i++) if (v.d[i] !== 1) throw err("This runner supports 2-D arrays only."); } return [v.d[0], v.d[1]]; }
    for (i = 0; i < a.length; i++) d.push(scalar(a[i], "Size input"));
    for (i = 2; i < d.length; i++) if (d[i] !== 1) throw err("This runner supports 2-D arrays only (N-D arrays need real MATLAB).");
    return [d[0], d[1]];
  }
  function fill(a, v, name) { var d = dims(a, name), r = Math.max(0, d[0]), c = Math.max(0, d[1]); if (r !== Math.floor(r) || c !== Math.floor(c)) throw err("Size inputs must be integers."); if (r * c > 4e6) throw err("Requested " + r + "x" + c + " array is too large for the browser runner."); var o = new Array(r * c), f = typeof v === "function"; for (var i = 0; i < o.length; i++) o[i] = f ? v() : v; return M(r, c, o); }
  konst("pi", Math.PI); konst("Inf", Infinity); konst("inf", Infinity); konst("NaN", NaN); konst("nan", NaN); konst("realmax", Number.MAX_VALUE); konst("realmin", 2.2250738585072014e-308);
  B.eps = function (a) { if (a.length && a[0].t === "m") { var x = Math.abs(a[0].d[0]); if (x === 0) return num(4.9406564584124654e-324); return num(Math.pow(2, Math.floor(Math.log2(x)) - 52)); } return num(2.220446049250313e-16); };
  B.i = B.j = B["1i"] = function () { return M(1, 1, [0], [1]); };
  B["true"] = function (a) { var o = fill(a, 1); o.k = "l"; return o; }; B["false"] = function (a) { var o = fill(a, 0); o.k = "l"; return o; };
  B.zeros = function (a) { return fill(a, 0, "zeros"); }; B.ones = function (a) { return fill(a, 1, "ones"); };
  B.eye = function (a) { var d = dims(a, "eye"); return _.eye(d[0], d[1]); };
  B.rand = function (a, n, I) { return fill(a, function () { return I.rand(); }, "rand"); };
  function gauss(I) { var u = 0, v = 0; while (u === 0) u = I.rand(); v = I.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  B.randn = function (a, n, I) { return fill(a, function () { return gauss(I); }, "randn"); };
  B.randi = function (a, n, I) { need(a, 1, 3, "randi"); var lim = mat(a[0]), lo = lim.d.length > 1 ? lim.d[0] : 1, hi = lim.d.length > 1 ? lim.d[1] : lim.d[0]; return fill(a.slice(1), function () { return lo + Math.floor(I.rand() * (hi - lo + 1)); }, "randi"); };
  B.randperm = function (a, n, I) { var N = scalar(a[0]), p = [], i; for (i = 1; i <= N; i++) p.push(i); for (i = N - 1; i > 0; i--) { var j = Math.floor(I.rand() * (i + 1)), t = p[i]; p[i] = p[j]; p[j] = t; } if (a.length > 1) p = p.slice(0, scalar(a[1])); return _.rowv(p); };
  B.rng = function (a, n, I) { if (a.length && a[0].t === "m") I.seed = (Math.floor(a[0].d[0]) * 2654435761 + 12345) >>> 0 || 1; else if (a.length && isText(a[0])) { var t = text(a[0]); I.seed = t === "shuffle" ? 0 : t === "default" ? 5489 : (parseInt(t, 10) * 2654435761 + 12345) >>> 0 || 1; } };
  B.magic = function (a) {
    var n = scalar(a[0]), o = zeros(n, n), i, j, k;
    if (n === 2) return M(2, 2, [4, 3, 1, 2]);
    if (n % 2 === 1) { for (i = 0; i < n; i++) for (j = 0; j < n; j++) o.d[i + j * n] = n * ((i + j + 1 + Math.floor(n / 2)) % n) + ((i + 2 * j + n - 3 + 2) % n) + 1; var t = zeros(n, n); i = 0; j = Math.floor(n / 2); for (k = 1; k <= n * n; k++) { t.d[i + j * n] = k; var ni = (i - 1 + n) % n, nj = (j + 1) % n; if (t.d[ni + nj * n]) { ni = (i + 1) % n; nj = j; } i = ni; j = nj; } return t; }
    if (n % 4 === 0) { for (i = 0; i < n; i++) for (j = 0; j < n; j++) { var v = i * n + j + 1, keep = ((i % 4 === 0 || i % 4 === 3) && (j % 4 === 0 || j % 4 === 3)) || ((i % 4 === 1 || i % 4 === 2) && (j % 4 === 1 || j % 4 === 2)); o.d[i + j * n] = keep ? n * n + 1 - v : v; } return o; }
    var h = n / 2, sub = B.magic([num(h)]), q = h * h, kk = (n - 2) / 4;
    for (i = 0; i < h; i++) for (j = 0; j < h; j++) { var s = sub.d[i + j * h]; o.d[i + j * n] = s; o.d[i + h + (j + h) * n] = s + q; o.d[i + (j + h) * n] = s + 2 * q; o.d[i + h + j * n] = s + 3 * q; }
    for (i = 0; i < h; i++) { var colsL = []; for (j = 0; j < kk; j++) colsL.push(j); if (i === Math.floor(h / 2)) colsL = colsL.map(function (c) { return c + 1; }); for (j = n - kk + 1; j < n; j++) colsL.push(j); colsL.forEach(function (c) { var t2 = o.d[i + c * n]; o.d[i + c * n] = o.d[i + h + c * n]; o.d[i + h + c * n] = t2; }); }
    return o;
  };
  B.linspace = function (a) { need(a, 2, 3, "linspace"); var x = scalar(a[0]), y = scalar(a[1]), n = a.length > 2 ? Math.floor(scalar(a[2])) : 100, d = []; for (var i = 0; i < n; i++) d.push(n === 1 ? y : x + (y - x) * i / (n - 1)); if (n > 1) d[n - 1] = y; return M(1, d.length, d); };
  B.logspace = function (a) { var x = scalar(a[0]), y = scalar(a[1]), n = a.length > 2 ? scalar(a[2]) : 50, d = []; for (var i = 0; i < n; i++) d.push(Math.pow(10, n === 1 ? y : x + (y - x) * i / (n - 1))); return M(1, n, d); };
  B.colon = function (a) { return _.range(scalar(a[0]), a.length > 2 ? scalar(a[1]) : 1, scalar(a[a.length - 1])); };

  /* ---- size and shape ---- */
  function shape(v) { return v.t === "m" || v.t === "c" || v.t === "sa" ? [v.r, v.c] : [1, 1]; }
  B.size = function (a, n) { need(a, 1, 2, "size"); var s = shape(a[0]); if (a.length > 1) { var d = scalar(a[1]); return num(d === 1 ? s[0] : d === 2 ? s[1] : 1); } if (n <= 1) return M(1, 2, s); var out = [num(s[0]), num(s[1])]; for (var i = 2; i < n; i++) out.push(num(1)); return out; };
  B.numel = function (a) { var s = shape(a[0]); return num(s[0] * s[1]); };
  B.length = function (a) { need(a, 1, 1, "length"); var s = shape(a[0]); return num(s[0] * s[1] === 0 ? 0 : Math.max(s[0], s[1])); };
  B.ndims = function () { return num(2); };
  B.isempty = function (a) { need(a, 1, 1, "isempty"); var s = shape(a[0]); return bool(a[0].t === "s" ? false : s[0] * s[1] === 0); };
  B.isscalar = function (a) { var s = shape(a[0]); return bool(s[0] === 1 && s[1] === 1); };
  B.isvector = function (a) { var s = shape(a[0]); return bool((s[0] === 1 || s[1] === 1) && s[0] * s[1] >= 1); };
  B.isrow = function (a) { return bool(shape(a[0])[0] === 1); }; B.iscolumn = function (a) { return bool(shape(a[0])[1] === 1); };
  B.ismatrix = function () { return bool(true); }; B.issquare = function (a) { var s = shape(a[0]); return bool(s[0] === s[1]); };
  B.isnumeric = function (a) { return bool(a[0].t === "m" && a[0].k === "d"); }; B.ischar = function (a) { return bool(a[0].t === "m" && a[0].k === "c"); };
  B.islogical = function (a) { return bool(a[0].t === "m" && a[0].k === "l"); }; B.iscell = function (a) { return bool(a[0].t === "c"); };
  B.isstruct = function (a) { return bool(a[0].t === "st" || a[0].t === "sa"); }; B.isstring = function (a) { return bool(a[0].t === "s"); };
  B.isreal = function (a) { return bool(a[0].t === "m" && !a[0].im); }; B.isfloat = function (a) { return bool(a[0].t === "m" && a[0].k === "d" && !(a[0].cls && _.INT[a[0].cls])); };
  B.isinteger = function (a) { return bool(!!(a[0].cls && _.INT[a[0].cls])); };
  B.iscellstr = function (a) { return bool(a[0].t === "c" && a[0].d.every(function (x) { return x.t === "m" && x.k === "c"; })); };
  B.isa = function (a) { var c = _.className(a[0]), w = text(a[1]); return bool(c === w || (w === "numeric" && a[0].t === "m" && a[0].k === "d") || (w === "float" && (c === "double" || c === "single")) || (w === "function_handle" && a[0].t === "f")); };
  B["class"] = function (a) { need(a, 1, 1, "class"); return str(_.className(a[0])); };
  function deepEq(x, y) {
    if (x.t === "s" || y.t === "s") return isText(x) && isText(y) && text(x) === text(y);
    if (x.t !== y.t) return false;
    if (x.t === "m") { if (x.r !== y.r || x.c !== y.c) return false; for (var i = 0; i < x.d.length; i++) { if (x.d[i] !== y.d[i]) return false; if ((x.im ? x.im[i] : 0) !== (y.im ? y.im[i] : 0)) return false; } return true; }
    if (x.t === "c" || x.t === "sa") { if (x.r !== y.r || x.c !== y.c) return false; return x.d.every(function (e, i) { return deepEq(e, y.d[i]); }); }
    if (x.t === "st") { var kx = Object.keys(x.f), ky = Object.keys(y.f); return kx.length === ky.length && kx.every(function (k) { return y.f[k] !== undefined && deepEq(x.f[k], y.f[k]); }); }
    if (x.t === "f") return x === y || (x.name && x.name === y.name);
    return x === y;
  }
  B.isequal = function (a) { need(a, 2, undefined, "isequal"); for (var i = 1; i < a.length; i++) if (!deepEq(a[0], a[i])) return bool(false); return bool(true); };
  B.reshape = function (a) {
    need(a, 2, 3, "reshape"); var v = a[0], n = _.numel(v), r, c;
    if (a.length === 2) { var s = vec(a[1]); r = s[0]; c = s[1]; } else { r = a[1].d.length ? a[1].d[0] : -1; c = a[2].d.length ? a[2].d[0] : -1; if (r < 0) r = n / c; if (c < 0) c = n / r; }
    if (r * c !== n || r !== Math.floor(r) || c !== Math.floor(c)) throw err("Number of elements must not change. Use [] as one of the size inputs to automatically calculate the appropriate size for that dimension.");
    if (v.t === "c") return cell(r, c, v.d.slice()); var o = M(r, c, v.d.slice(), v.im ? v.im.slice() : null, v.k); if (v.cls) o.cls = v.cls; return o;
  };
  B.repmat = function (a) {
    need(a, 2, 3, "repmat"); var v = a[0], m, n; if (a.length === 2) { var s = vec(a[1]); m = s[0]; n = s.length > 1 ? s[1] : s[0]; } else { m = scalar(a[1]); n = scalar(a[2]); }
    if (v.t !== "m" && v.t !== "c") v = cell(1, 1, [v]);
    var rows = [], i, j; for (i = 0; i < m; i++) { var r = []; for (j = 0; j < n; j++) r.push(v); rows.push(r); }
    if (!m || !n) return v.t === "c" ? cell(0, 0, []) : empty();
    return _.catRows(rows);
  };
  B.horzcat = function (a) { return _.catRows([a]); }; B.vertcat = function (a) { return _.catRows(a.map(function (x) { return [x]; })); };
  B.cat = function (a) { var d = scalar(a[0]); return d === 1 ? B.vertcat(a.slice(1)) : B.horzcat(a.slice(1)); };
  B.fliplr = function (a) { var v = a[0], idx = []; for (var j = v.c; j >= 1; j--) idx.push(j); return _.indexGet(v, [COLON, _.rowv(idx)]); };
  B.flipud = function (a) { var v = a[0], idx = []; for (var j = v.r; j >= 1; j--) idx.push(j); return _.indexGet(v, [_.rowv(idx), COLON]); };
  B.flip = function (a) { var v = a[0], dim = a.length > 1 ? scalar(a[1]) : (v.r === 1 ? 2 : 1); return dim === 2 ? B.fliplr([v]) : B.flipud([v]); };
  B.rot90 = function (a) { return B.flipud([_.transpose(a[0], false)]); };
  B.circshift = function (a) { var v = mat(a[0]), k = scalar(a[1]), dim = a.length > 2 ? scalar(a[2]) : (v.r === 1 ? 2 : 1), n = dim === 2 ? v.c : v.r, idx = []; for (var i = 0; i < n; i++) idx.push((((i - k) % n) + n) % n + 1); return dim === 2 ? _.indexGet(v, [COLON, _.rowv(idx)]) : _.indexGet(v, [_.rowv(idx), COLON]); };
  B.diag = function (a) {
    var v = mat(a[0], "diag"), k = a.length > 1 ? scalar(a[1]) : 0, i, n;
    if (v.r === 1 || v.c === 1) { n = v.d.length + Math.abs(k); var o = zeros(n, n); for (i = 0; i < v.d.length; i++) o.d[(i + (k < 0 ? -k : 0)) + (i + (k > 0 ? k : 0)) * n] = v.d[i]; return o; }
    var d = []; for (i = 0; i < Math.min(v.r, v.c); i++) { var rr = i + (k < 0 ? -k : 0), cc = i + (k > 0 ? k : 0); if (rr < v.r && cc < v.c) d.push(v.d[rr + cc * v.r]); } return M(d.length, 1, d);
  };
  B.triu = function (a) { var v = mat(a[0]), k = a.length > 1 ? scalar(a[1]) : 0, o = M(v.r, v.c, v.d.slice()); for (var j = 0; j < v.c; j++) for (var i = 0; i < v.r; i++) if (j - i < k) o.d[i + j * v.r] = 0; return o; };
  B.tril = function (a) { var v = mat(a[0]), k = a.length > 1 ? scalar(a[1]) : 0, o = M(v.r, v.c, v.d.slice()); for (var j = 0; j < v.c; j++) for (var i = 0; i < v.r; i++) if (j - i > k) o.d[i + j * v.r] = 0; return o; };
  B.meshgrid = function (a, n) { need(a, 1, 2, "meshgrid"); var x = vec(a[0]), y = a.length > 1 ? vec(a[1]) : x, X = zeros(y.length, x.length), Y = zeros(y.length, x.length); for (var j = 0; j < x.length; j++) for (var i = 0; i < y.length; i++) { X.d[i + j * y.length] = x[j]; Y.d[i + j * y.length] = y[i]; } return [X, Y]; };
  B.sub2ind = function (a) { var s = vec(a[0]); return ew(mat(a[1]), mat(a[2]), function (r, c) { return r + (c - 1) * s[0]; }); };
  B.ind2sub = function (a, n) { var s = vec(a[0]), v = mat(a[1]); if (n < 2) return v; return [like(v, v.d.map(function (k) { return (k - 1) % s[0] + 1; })), like(v, v.d.map(function (k) { return Math.floor((k - 1) / s[0]) + 1; }))]; };

  /* ---- reductions ---- */
  function getDim(v, arg) { if (arg !== undefined && arg.t === "m" && arg.d.length) return arg.d[0]; return v.r === 1 ? 2 : 1; }
  function reduce(v, dim, f, part) {
    var src = part === "im" ? (v.im || v.d.map(function () { return 0; })) : v.d, i, j, col, out;
    if (dim === 1) { out = new Array(v.c); for (j = 0; j < v.c; j++) { col = new Array(v.r); for (i = 0; i < v.r; i++) col[i] = src[i + j * v.r]; out[j] = f(col); } return M(v.r === 0 && v.c === 0 ? 1 : 1, v.c === 0 ? 1 : v.c, v.c === 0 ? [f([])] : out); }
    if (dim === 2) { out = new Array(v.r); for (i = 0; i < v.r; i++) { col = new Array(v.c); for (j = 0; j < v.c; j++) col[j] = src[i + j * v.r]; out[i] = f(col); } return M(v.r, 1, out); }
    return M(v.r, v.c, src.slice());
  }
  function reducer(name, f, linear) {
    B[name] = function (a) {
      need(a, 1, 3, name); var v = mat(a[0], name);
      if (a.length > 1 && isText(a[1])) { if (text(a[1]) === "all") v = M(1, v.d.length, v.d, v.im); a = [v]; }
      var dim = getDim(v, a[1]), o = reduce(v, dim, f);
      if (v.im) { if (!linear) throw err("'" + name + "' of complex values is not supported by the browser runner."); var im = reduce(v, dim, f, "im"); if (im.d.some(function (x) { return x !== 0; })) o.im = im.d; }
      return o;
    };
  }
  function ssum(c) { var s = 0; for (var i = 0; i < c.length; i++) s += c[i]; return s; }
  function smean(c) { return c.length ? ssum(c) / c.length : NaN; }
  function svar(c, w) { var n = c.length; if (n === 1) return 0; var m = smean(c), s = 0; for (var i = 0; i < n; i++) s += (c[i] - m) * (c[i] - m); return s / (w ? n : n - 1); }
  function smedian(c) { var s = c.slice().sort(function (x, y) { return x - y; }), n = s.length; if (!n) return NaN; if (s.some(function (x) { return x !== x; })) return NaN; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  reducer("sum", ssum, true); reducer("mean", smean, true);
  reducer("prod", function (c) { var p = 1; for (var i = 0; i < c.length; i++) p *= c[i]; return p; });
  reducer("median", smedian);
  reducer("mode", function (c) { var m = {}, best = NaN, bc = 0; c.slice().sort(function (x, y) { return x - y; }).forEach(function (x) { m[x] = (m[x] || 0) + 1; if (m[x] > bc) { bc = m[x]; best = x; } }); return best; });
  B["var"] = function (a) { var v = mat(a[0], "var"), w = a.length > 1 && a[1].d.length ? a[1].d[0] : 0; return reduce(v, getDim(v, a[2]), function (c) { return svar(c, w); }); };
  B.std = function (a) { var o = B["var"](a); o.d = o.d.map(Math.sqrt); return o; };
  B.rms = function (a) { var v = mat(a[0]); return reduce(v, getDim(v, a[1]), function (c) { var s = 0; c.forEach(function (x) { s += x * x; }); return Math.sqrt(s / c.length); }); };
  B.range = function (a) { var v = mat(a[0]); return reduce(v, getDim(v, a[1]), function (c) { return Math.max.apply(null, c) - Math.min.apply(null, c); }); };
  B.any = function (a) { var v = mat(a[0], "any"); var o = reduce(v, getDim(v, a[1]), function (c) { return c.some(function (x) { return x !== 0 && x === x; }) ? 1 : 0; }); o.k = "l"; return o; };
  B.all = function (a) { var v = mat(a[0], "all"); var o = reduce(v, getDim(v, a[1]), function (c) { return c.every(function (x) { return x !== 0; }) ? 1 : 0; }); o.k = "l"; return o; };
  B.nnz = function (a) { return num(mat(a[0]).d.filter(function (x) { return x !== 0; }).length); };
  function cumulative(name, f) {
    B[name] = function (a) {
      var v = mat(a[0], name), dim = getDim(v, a[1]), o = M(v.r, v.c, v.d.slice()), i, j;
      function run(src, dst) { if (dim === 1) { for (j = 0; j < v.c; j++) for (i = 1; i < v.r; i++) dst[i + j * v.r] = f(dst[i - 1 + j * v.r], src[i + j * v.r]); } else for (i = 0; i < v.r; i++) for (j = 1; j < v.c; j++) dst[i + j * v.r] = f(dst[i + (j - 1) * v.r], src[i + j * v.r]); }
      run(v.d, o.d); if (v.im && name === "cumsum") { o.im = v.im.slice(); run(v.im, o.im); } return o;
    };
  }
  cumulative("cumsum", function (p, x) { return p + x; }); cumulative("cumprod", function (p, x) { return p * x; });
  cumulative("cummax", function (p, x) { return Math.max(p, x); }); cumulative("cummin", function (p, x) { return Math.min(p, x); });
  B.diff = function (a) {
    var v = mat(a[0], "diff"), n = a.length > 1 && a[1].d.length ? a[1].d[0] : 1, dim = getDim(v, a[2]), k, i, j;
    for (k = 0; k < n; k++) {
      var o, parts = ["d"].concat(v.im ? ["im"] : []), res = {};
      parts.forEach(function (p) { var src = v[p]; if (dim === 2) { o = new Array(v.r * Math.max(0, v.c - 1)); for (j = 0; j < v.c - 1; j++) for (i = 0; i < v.r; i++) o[i + j * v.r] = src[i + (j + 1) * v.r] - src[i + j * v.r]; } else { o = new Array(Math.max(0, v.r - 1) * v.c); for (j = 0; j < v.c; j++) for (i = 0; i < v.r - 1; i++) o[i + j * (v.r - 1)] = src[i + 1 + j * v.r] - src[i + j * v.r]; } res[p] = o; });
      v = dim === 2 ? M(v.r, Math.max(0, v.c - 1), res.d, res.im) : M(Math.max(0, v.r - 1), v.c, res.d, res.im);
    }
    return v;
  };
  function extreme(name, better) {
    B[name] = function (a, nargout) {
      need(a, 1, 3, name); var v = mat(a[0], name);
      if (a.length >= 2 && a[1].t === "m" && a[1].d.length) return ew(v, mat(a[1]), function (x, y) { return x !== x ? y : y !== y ? x : better(x, y) ? x : y; });
      if (a.length === 3 && isText(a[2])) { v = M(1, v.d.length, v.d); a = [v]; }
      if (v.im) { v = like(v, v.d.map(function (x, i) { return Math.hypot(x, v.im[i]); })); }
      var dim = getDim(v, a[2]), idx = [];
      var o = reduce(v, dim, function (c) { var bi = -1; for (var i = 0; i < c.length; i++) if (c[i] === c[i] && (bi < 0 || better(c[i], c[bi]))) bi = i; idx.push(bi < 0 ? 1 : bi + 1); return bi < 0 ? NaN : c[bi]; });
      if (!v.d.length) return nargout > 1 ? [empty(), empty()] : empty();
      if (a[0].im) { var src = a[0], pick = idx.map(function (k, q) { var p = dim === 1 ? (k - 1) + q * src.r : q + (k - 1) * src.r; return p; }); o = M(o.r, o.c, pick.map(function (p) { return src.d[p]; }), pick.map(function (p) { return src.im[p]; })); }
      if (a[0].k === "c") o.k = "d";
      return nargout > 1 ? [o, M(o.r, o.c, idx)] : o;
    };
  }
  extreme("max", function (x, y) { return x > y; }); extreme("min", function (x, y) { return x < y; });
  B.sort = function (a, nargout) {
    need(a, 1, 3, "sort"); var v = a[0], desc = false, dimArg;
    a.slice(1).forEach(function (x) { if (isText(x)) desc = /^desc/i.test(text(x)); else dimArg = x; });
    if (v.t === "c") { var strs = v.d.map(function (x) { return text(x); }), order = strs.map(function (s, i) { return i; }).sort(function (p, q) { return strs[p] < strs[q] ? -1 : strs[p] > strs[q] ? 1 : p - q; }); if (desc) order.reverse(); var oc = cell(v.r, v.c, order.map(function (i) { return v.d[i]; })); return nargout > 1 ? [oc, M(v.r, v.c, order.map(function (i) { return i + 1; }))] : oc; }
    mat(v, "sort"); var dim = getDim(v, dimArg), o = M(v.r, v.c, v.d.slice(), null, v.k), ix = zeros(v.r, v.c), i, j;
    function sortLine(vals) { var ord = vals.map(function (x, k) { return k; }); ord.sort(function (p, q) { var x = vals[p], y = vals[q]; if (x !== x) return y !== y ? p - q : 1; if (y !== y) return -1; return x === y ? p - q : (desc ? y - x : x - y); }); return ord; }
    if (dim === 1) for (j = 0; j < v.c; j++) { var col = []; for (i = 0; i < v.r; i++) col.push(v.d[i + j * v.r]); var od = sortLine(col); for (i = 0; i < v.r; i++) { o.d[i + j * v.r] = col[od[i]]; ix.d[i + j * v.r] = od[i] + 1; } }
    else for (i = 0; i < v.r; i++) { var rw = []; for (j = 0; j < v.c; j++) rw.push(v.d[i + j * v.r]); var od2 = sortLine(rw); for (j = 0; j < v.c; j++) { o.d[i + j * v.r] = rw[od2[j]]; ix.d[i + j * v.r] = od2[j] + 1; } }
    return nargout > 1 ? [o, ix] : o;
  };
  B.find = function (a, nargout) {
    need(a, 1, 3, "find"); var v = mat(a[0], "find"), lim = a.length > 1 ? scalar(a[1]) : Infinity, idx = [], i;
    for (i = 0; i < v.d.length && idx.length < lim; i++) if (v.d[i] !== 0 || (v.im && v.im[i] !== 0)) idx.push(i);
    var mk = function (d) { return v.r === 1 && v.c !== 1 ? M(1, d.length, d) : M(d.length, 1, d); };
    if (nargout >= 2) return [mk(idx.map(function (k) { return k % v.r + 1; })), mk(idx.map(function (k) { return Math.floor(k / v.r) + 1; })), mk(idx.map(function (k) { return v.d[k]; }))];
    return mk(idx.map(function (k) { return k + 1; }));
  };
  B.unique = function (a, nargout) { var v = a[0]; if (v.t === "c") { var seen = {}, out = []; v.d.map(text).sort().forEach(function (s) { if (!seen[s]) { seen[s] = 1; out.push(str(s)); } }); return cell(out.length, 1, out); } var s = mat(v).d.slice().sort(function (x, y) { return x - y; }), u = []; s.forEach(function (x) { if (!u.length || u[u.length - 1] !== x) u.push(x); }); return v.r === 1 ? M(1, u.length, u, null, v.k) : M(u.length, 1, u, null, v.k); };
  B.ismember = function (a) { var v = mat(a[0]), set = {}; if (a[1].t === "c") { var t = text(a[0]); return bool(a[1].d.some(function (x) { return isText(x) && text(x) === t; })); } mat(a[1]).d.forEach(function (x) { set[x] = 1; }); return like(v, v.d.map(function (x) { return set[x] ? 1 : 0; }), "l"); };
  B.cross = function (a) { var x = vec(a[0]), y = vec(a[1]); if (x.length !== 3 || y.length !== 3) throw err("A and B must be of length 3."); return rowOrCol(a[0], [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]]); };
  B.dot = function (a) { var x = vec(a[0]), y = vec(a[1]); if (x.length !== y.length) throw err("A and B must be same size."); var s = 0; for (var i = 0; i < x.length; i++) s += x[i] * y[i]; return num(s); };
  B.kron = function (a) { var A = mat(a[0]), Bm = mat(a[1]), r = A.r * Bm.r, c = A.c * Bm.c, o = zeros(r, c); for (var i = 0; i < A.r; i++) for (var j = 0; j < A.c; j++) for (var k = 0; k < Bm.r; k++) for (var l = 0; l < Bm.c; l++) o.d[(i * Bm.r + k) + (j * Bm.c + l) * r] = A.d[i + j * A.r] * Bm.d[k + l * Bm.r]; return o; };
  B.trapz = function (a) { var x, y; if (a.length === 1) { y = vec(a[0]); x = y.map(function (q, i) { return i; }); } else { x = vec(a[0]); y = vec(a[1]); } if (x.length !== y.length) throw err("Point spacing does not match the length of Y: x and y must have the same number of elements."); var s = 0; for (var i = 1; i < y.length; i++) s += (x[i] - x[i - 1]) * (y[i] + y[i - 1]) / 2; return num(s); };
  B.cumtrapz = function (a) { var x, y, src = a[a.length - 1]; if (a.length === 1) { y = vec(a[0]); x = y.map(function (q, i) { return i; }); } else { x = vec(a[0]); y = vec(a[1]); } var o = [0]; for (var i = 1; i < y.length; i++) o.push(o[i - 1] + (x[i] - x[i - 1]) * (y[i] + y[i - 1]) / 2); return rowOrCol(src, o); };
  B.gradient = function (a) { var y = vec(a[0]), n = y.length, h = a.length > 1 ? (a[1].d.length === 1 ? null : vec(a[1])) : null, hs = a.length > 1 && a[1].d.length === 1 ? a[1].d[0] : 1, o = []; function X(i) { return h ? h[i] : i * hs; } for (var i = 0; i < n; i++) o.push(n === 1 ? 0 : i === 0 ? (y[1] - y[0]) / (X(1) - X(0)) : i === n - 1 ? (y[n - 1] - y[n - 2]) / (X(n - 1) - X(n - 2)) : (y[i + 1] - y[i - 1]) / (X(i + 1) - X(i - 1))); return rowOrCol(a[0], o); };

  /* ---- linear algebra ---- */
  function sq(v, name) { mat(v, name); if (v.r !== v.c) throw err("Matrix must be square."); return v; }
  function det(A) { var n = A.r, a = A.d.slice(), d = 1, i, j, k; for (k = 0; k < n; k++) { var p = k; for (i = k + 1; i < n; i++) if (Math.abs(a[i + k * n]) > Math.abs(a[p + k * n])) p = i; if (a[p + k * n] === 0) return 0; if (p !== k) { for (j = 0; j < n; j++) { var t = a[k + j * n]; a[k + j * n] = a[p + j * n]; a[p + j * n] = t; } d = -d; } d *= a[k + k * n]; for (i = k + 1; i < n; i++) { var f = a[i + k * n] / a[k + k * n]; for (j = k; j < n; j++) a[i + j * n] -= f * a[k + j * n]; } } return d; }
  B.det = function (a) { var A = sq(a[0], "det"); if (A.im) throw err("det of a complex matrix is not supported by the browser runner."); var d = det(A); if (A.d.every(isInt) && Math.abs(d - Math.round(d)) < 1e-9 * Math.max(1, Math.abs(d))) d = Math.round(d) + (d - Math.round(d)); return num(d); };
  B.inv = function (a, n, I) { var A = sq(a[0], "inv"); return _.solve(A, _.eye(A.r), I); };
  B.pinv = function (a, n, I) { var A = mat(a[0]), At = _.transpose(A, true); return A.r >= A.c ? _.solve(_.matmul(At, A), At, I) : _.matmul(At, _.solve(_.matmul(A, At), _.eye(A.r), I)); };
  B.trace = function (a) { var A = sq(a[0], "trace"), s = 0; for (var i = 0; i < A.r; i++) s += A.d[i + i * A.r]; return num(s); };
  function rref(A) { var r = A.r, c = A.c, a = A.d.slice(), lead = 0, rank = 0, i, j, k; var tol = 1e-10 * Math.max(1, Math.max.apply(null, a.map(Math.abs).concat([0]))); for (k = 0; k < r && lead < c; lead++) { var p = k; for (i = k + 1; i < r; i++) if (Math.abs(a[i + lead * r]) > Math.abs(a[p + lead * r])) p = i; if (Math.abs(a[p + lead * r]) <= tol) { for (i = k; i < r; i++) a[i + lead * r] = 0; continue; } for (j = 0; j < c; j++) { var t = a[k + j * r]; a[k + j * r] = a[p + j * r]; a[p + j * r] = t; } var pv = a[k + lead * r]; for (j = 0; j < c; j++) a[k + j * r] /= pv; for (i = 0; i < r; i++) if (i !== k) { var f = a[i + lead * r]; if (f !== 0) for (j = 0; j < c; j++) a[i + j * r] -= f * a[k + j * r]; } k++; rank++; } return { m: M(r, c, a.map(function (x) { return Math.abs(x) < 1e-12 ? 0 : x; })), rank: rank }; }
  B.rref = function (a) { return rref(mat(a[0])).m; };
  B.rank = function (a) { return num(rref(mat(a[0])).rank); };
  B.norm = function (a) {
    var v = mat(a[0], "norm"), p = a.length > 1 ? (isText(a[1]) ? text(a[1]) : a[1].d[0]) : 2, mags = v.d.map(function (x, i) { return v.im ? Math.hypot(x, v.im[i]) : Math.abs(x); }), i, j, s;
    if (v.r === 1 || v.c === 1) { if (p === Infinity || p === "inf") return num(Math.max.apply(null, mags)); if (p === "fro") p = 2; s = 0; mags.forEach(function (x) { s += Math.pow(x, p); }); return num(Math.pow(s, 1 / p)); }
    if (p === "fro") { s = 0; mags.forEach(function (x) { s += x * x; }); return num(Math.sqrt(s)); }
    if (p === 1) { var best = 0; for (j = 0; j < v.c; j++) { s = 0; for (i = 0; i < v.r; i++) s += mags[i + j * v.r]; best = Math.max(best, s); } return num(best); }
    if (p === Infinity || p === "inf") { var b2 = 0; for (i = 0; i < v.r; i++) { s = 0; for (j = 0; j < v.c; j++) s += mags[i + j * v.r]; b2 = Math.max(b2, s); } return num(b2); }
    var ev = symEig(_.matmul(_.transpose(v, true), v)).vals; return num(Math.sqrt(Math.max.apply(null, ev)));
  };
  function symEig(A) { // Jacobi; returns ascending eigenvalues and vectors
    var n = A.r, a = A.d.slice(), V = _.eye(n).d, sweep, p, q, i;
    for (sweep = 0; sweep < 100; sweep++) {
      var off = 0; for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) off += a[p + q * n] * a[p + q * n];
      if (off < 1e-22) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (Math.abs(a[p + q * n]) < 1e-300) continue;
        var th = (a[q + q * n] - a[p + p * n]) / (2 * a[p + q * n]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (i = 0; i < n; i++) { var x = a[i + p * n], y = a[i + q * n]; a[i + p * n] = c * x - s * y; a[i + q * n] = s * x + c * y; }
        for (i = 0; i < n; i++) { var x2 = a[p + i * n], y2 = a[q + i * n]; a[p + i * n] = c * x2 - s * y2; a[q + i * n] = s * x2 + c * y2; }
        for (i = 0; i < n; i++) { var x3 = V[i + p * n], y3 = V[i + q * n]; V[i + p * n] = c * x3 - s * y3; V[i + q * n] = s * x3 + c * y3; }
      }
    }
    var order = []; for (i = 0; i < n; i++) order.push(i); order.sort(function (x, y) { return a[x + x * n] - a[y + y * n]; });
    var vals = order.map(function (k) { return a[k + k * n]; }), vecs = zeros(n, n);
    order.forEach(function (k, j) { var sgn = 1, big = 0; for (i = 0; i < n; i++) if (Math.abs(V[i + k * n]) > Math.abs(big) + 1e-12) big = V[i + k * n]; void big; for (i = 0; i < n; i++) vecs.d[i + j * n] = sgn * V[i + k * n]; });
    return { vals: vals, vecs: vecs };
  }
  function charPoly(A) { // Faddeev–LeVerrier: coefficients of det(sI - A), highest power first
    var n = A.r, c = [1], Mk = zeros(n, n), k, i;
    for (k = 1; k <= n; k++) { var T = _.matmul(A, Mk); for (i = 0; i < n; i++) T.d[i + i * n] += c[k - 1]; Mk = T; var AM = _.matmul(A, Mk), tr = 0; for (i = 0; i < n; i++) tr += AM.d[i + i * n]; c.push(-tr / k); }
    return c;
  }
  function polyRoots(p) { // Durand–Kerner; returns [{re,im}]
    p = p.slice(); while (p.length && p[0] === 0) p.shift();
    var zerosAtEnd = 0; while (p.length && p[p.length - 1] === 0) { p.pop(); zerosAtEnd++; }
    var n = p.length - 1, out = [], i, j, it;
    if (n >= 1) {
      var a = p.map(function (x) { return x / p[0]; }), R = 1 + Math.max.apply(null, a.slice(1).map(Math.abs)), zr = [], zi = [];
      for (i = 0; i < n; i++) { var ang = 2 * Math.PI * i / n + 0.4; zr.push(R * 0.9 * Math.cos(ang)); zi.push(R * 0.9 * Math.sin(ang)); }
      for (it = 0; it < 2000; it++) {
        var delta = 0;
        for (i = 0; i < n; i++) {
          var pr = 1, pi = 0; for (j = 1; j <= n; j++) { var t = pr * zr[i] - pi * zi[i] + a[j]; pi = pr * zi[i] + pi * zr[i]; pr = t; }
          var dr = 1, di = 0; for (j = 0; j < n; j++) if (j !== i) { var er = zr[i] - zr[j], ei = zi[i] - zi[j], t2 = dr * er - di * ei; di = dr * ei + di * er; dr = t2; }
          var den = dr * dr + di * di; if (den === 0) { zr[i] += 1e-8; continue; }
          var qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den; zr[i] -= qr; zi[i] -= qi; delta = Math.max(delta, Math.abs(qr) + Math.abs(qi));
        }
        if (delta < 1e-15 * R) break;
      }
      for (i = 0; i < n; i++) { var sc = Math.max(1, Math.abs(zr[i])); if (Math.abs(zi[i]) < 1e-6 * sc) zi[i] = 0; if (Math.abs(zr[i]) < 1e-9 * Math.max(1, Math.abs(zi[i]))) zr[i] = 0; var rr = Math.round(zr[i] * 1e6) / 1e6; if (Math.abs(zr[i] - rr) < 1e-7 && zi[i] === 0) { var pv = 0; for (j = 0; j <= n; j++) pv = pv * rr + a[j]; if (Math.abs(pv) < 1e-9 * R) zr[i] = rr; } out.push({ re: zr[i], im: zi[i] }); }
      // make conjugate pairs exact
      for (i = 0; i < out.length; i++) if (out[i].im > 0) { var bj = -1, bd = Infinity; for (j = 0; j < out.length; j++) if (out[j].im < 0 && !out[j].paired) { var dd = Math.abs(out[j].re - out[i].re) + Math.abs(out[j].im + out[i].im); if (dd < bd) { bd = dd; bj = j; } } if (bj >= 0) { out[bj].paired = 1; out[bj].re = out[i].re; out[bj].im = -out[i].im; } }
    }
    for (i = 0; i < zerosAtEnd; i++) out.push({ re: 0, im: 0 });
    out.sort(function (x, y) { var mx = Math.hypot(x.re, x.im), my = Math.hypot(y.re, y.im); if (Math.abs(mx - my) > 1e-9 * Math.max(1, mx)) return my - mx; if (x.im !== y.im) return y.im - x.im; return x.re - y.re; });
    return out;
  }
  function cvec(list, asRow) { var re = list.map(function (z) { return z.re; }), im = list.map(function (z) { return z.im; }), any = im.some(function (x) { return x !== 0; }); return asRow ? M(1, re.length, re, any ? im : null) : M(re.length, 1, re, any ? im : null); }
  _.polyRoots = polyRoots; _.cvec = cvec;
  B.roots = function (a) { need(a, 1, 1, "roots"); var p = mat(a[0], "roots"); if (p.im) throw err("roots of a polynomial with complex coefficients is not supported by the browser runner."); var r = polyRoots(p.d); return r.length ? cvec(r) : empty(); };
  B.eig = function (a, nargout, I) {
    var A = sq(a[0], "eig"), n = A.r, i, j, sym = true;
    if (A.im) throw err("eig of a complex matrix is not supported by the browser runner.");
    for (i = 0; i < n && sym; i++) for (j = 0; j < i; j++) if (Math.abs(A.d[i + j * n] - A.d[j + i * n]) > 1e-12 * (Math.abs(A.d[i + j * n]) + 1)) { sym = false; break; }
    if (sym) { var e = symEig(A); if (nargout < 2) return M(n, 1, e.vals); var D = zeros(n, n); e.vals.forEach(function (x, k) { D.d[k + k * n] = x; }); return [e.vecs, D]; }
    var lam = polyRoots(charPoly(A)); lam.sort(function (x, y) { return x.re - y.re || x.im - y.im; });
    if (nargout < 2) return cvec(lam);
    if (lam.some(function (z) { return z.im !== 0; })) throw err("[V,D] = eig(A) with complex eigenvalues is not supported by the browser runner. Use e = eig(A) here, or run this in real MATLAB.", "EEHub:realMatlabOnly");
    var V = zeros(n, n), D2 = zeros(n, n);
    lam.forEach(function (z, k) { var S = M(n, n, A.d.slice()); for (i = 0; i < n; i++) S.d[i + i * n] -= z.re + 1e-10 * Math.max(1, Math.abs(z.re)); var x = M(n, 1, A.d.slice(0, n).map(function (q, ii) { return 1 + 0.1 * ii; })); for (var it = 0; it < 4; it++) { x = _.solve(S, x, null); var nm = Math.sqrt(x.d.reduce(function (s, q) { return s + q * q; }, 0)); x.d = x.d.map(function (q) { return q / nm; }); } for (i = 0; i < n; i++) V.d[i + k * n] = x.d[i]; D2.d[k + k * n] = z.re; });
    return [V, D2];
  };
  B.poly = function (a) { var v = mat(a[0], "poly"); if (v.r === v.c && v.r > 1) return _.rowv(charPoly(v)); var re = [1], im = [0]; v.d.forEach(function (r, k) { var ri = v.im ? v.im[k] : 0, nr = re.concat([0]), ni = im.concat([0]); for (var i = 1; i < nr.length; i++) { nr[i] -= re[i - 1] * r - im[i - 1] * ri; ni[i] -= re[i - 1] * ri + im[i - 1] * r; } re = nr; im = ni; }); var any = im.some(function (x) { return Math.abs(x) > 1e-12; }); return M(1, re.length, re, any ? im : null); };
  B.polyval = function (a) { need(a, 2, 2, "polyval"); var p = mat(a[0], "polyval"), x = mat(a[1], "polyval"), cx = !!(p.im || x.im), o = M(x.r, x.c, new Array(x.d.length), cx ? new Array(x.d.length) : null); for (var i = 0; i < x.d.length; i++) { var sr = 0, si = 0, xr = x.d[i], xi = x.im ? x.im[i] : 0; for (var k = 0; k < p.d.length; k++) { var t = sr * xr - si * xi + p.d[k]; si = sr * xi + si * xr + (p.im ? p.im[k] : 0); sr = t; } o.d[i] = sr; if (cx) o.im[i] = si; } if (cx && o.im.every(function (q) { return q === 0; })) o.im = null; return o; };
  B.polyfit = function (a, nargout, I) { need(a, 3, 3, "polyfit"); var x = vec(a[0]), y = vec(a[1]), n = scalar(a[2]), V = zeros(x.length, n + 1); if (x.length !== y.length) throw err("The first two inputs must have the same number of elements."); for (var i = 0; i < x.length; i++) for (var j = 0; j <= n; j++) V.d[i + j * x.length] = Math.pow(x[i], n - j); var p = _.mldivide(V, M(y.length, 1, y), I); return M(1, n + 1, p.d.map(function (q) { return Math.abs(q) < 1e-13 ? 0 : q; })); };
  function conv(x, y) { var o = new Array(x.length + y.length - 1).fill(0); for (var i = 0; i < x.length; i++) for (var j = 0; j < y.length; j++) o[i + j] += x[i] * y[j]; return o; }
  _.conv = conv;
  B.conv = function (a) { need(a, 2, 2, "conv"); var o = conv(vec(a[0]), vec(a[1])); return a[0].c === 1 && a[0].r > 1 ? M(o.length, 1, o) : M(1, o.length, o); };
  B.deconv = function (a, nargout) { var u = vec(a[0]).slice(), v = vec(a[1]), q = []; if (v[0] === 0) throw err("First coefficient of B must be non-zero."); var n = u.length - v.length; if (n < 0) return nargout > 1 ? [num(0), _.rowv(u)] : num(0); var r = u.slice(); for (var i = 0; i <= n; i++) { var f = r[i] / v[0]; q.push(f); for (var j = 0; j < v.length; j++) r[i + j] -= f * v[j]; } for (i = 0; i <= n; i++) r[i] = 0; return nargout > 1 ? [_.rowv(q), _.rowv(r.map(function (x) { return Math.abs(x) < 1e-12 ? 0 : x; }))] : _.rowv(q); };
  B.polyder = function (a) { var p = vec(a[0]), n = p.length - 1, o = []; for (var i = 0; i < n; i++) o.push(p[i] * (n - i)); return _.rowv(o.length ? o : [0]); };
  B.polyint = function (a) { var p = vec(a[0]), n = p.length, o = []; for (var i = 0; i < n; i++) o.push(p[i] / (n - i)); o.push(a.length > 1 ? scalar(a[1]) : 0); return _.rowv(o); };
  B.filter = function (a) { var b = vec(a[0]), aa = vec(a[1]), x = vec(a[2]), y = [], n, k; for (n = 0; n < x.length; n++) { var s = 0; for (k = 0; k < b.length; k++) if (n - k >= 0) s += b[k] * x[n - k]; for (k = 1; k < aa.length; k++) if (n - k >= 0) s -= aa[k] * y[n - k]; y.push(s / aa[0]); } return rowOrCol(a[2], y); };
  B.interp1 = function (a) {
    need(a, 3, 5, "interp1"); var x = vec(a[0]), y = vec(a[1]), q = mat(a[2]), method = a.length > 3 && isText(a[3]) ? text(a[3]) : "linear", extrap = a.length > 4 || (a.length > 3 && isText(a[3]) && text(a[3]) === "extrap");
    if (x.length !== y.length) throw err("Sample points and values must have the same length.");
    if (["linear", "nearest", "previous", "next", "extrap"].indexOf(method) < 0) throw err("interp1 method '" + method + "' is not supported by the browser runner (linear, nearest, previous and next are). Run this one in real MATLAB.", "EEHub:realMatlabOnly");
    var order = x.map(function (v, i) { return i; }).sort(function (p, r) { return x[p] - x[r]; }), xs = order.map(function (i) { return x[i]; }), ys = order.map(function (i) { return y[i]; }), n = xs.length;
    return like(q, q.d.map(function (v) {
      if (v !== v) return NaN;
      if ((v < xs[0] || v > xs[n - 1]) && !extrap) return NaN;
      var lo = 0, hi = n - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] <= v) lo = mid; else hi = mid; }
      if (method === "nearest") return v - xs[lo] < xs[hi] - v ? ys[lo] : ys[hi];
      if (method === "previous") return v >= xs[hi] ? ys[hi] : ys[lo];
      if (method === "next") return v <= xs[lo] ? ys[lo] : ys[hi];
      return n === 1 ? ys[0] : ys[lo] + (ys[hi] - ys[lo]) * (v - xs[lo]) / (xs[hi] - xs[lo]);
    }));
  };
  /* ---- function-of-function numerics ---- */
  function fnum(I, f) { return function (x) { var r = I.feval(f, [num(x)])[0]; if (!r || r.t !== "m" || !r.d.length) throw err("The function must return a numeric value."); return r.d[0]; }; }
  B.fzero = function (a, nargout, I) {
    need(a, 2, 3, "fzero"); var f = fnum(I, a[0]), x0 = mat(a[1]), lo, hi, flo, fhi, i;
    if (x0.d.length >= 2) { lo = x0.d[0]; hi = x0.d[1]; flo = f(lo); fhi = f(hi); if (flo * fhi > 0) throw err("Function values at the interval endpoints must differ in sign."); }
    else { var x = x0.d[0], fx = f(x), dx = x !== 0 ? Math.abs(x) / 50 : 1 / 50; if (fx === 0) return nargout > 1 ? [num(x), num(0)] : num(x); lo = hi = x; flo = fhi = fx; for (i = 0; i < 200 && flo * fhi > 0; i++) { dx *= Math.SQRT2; lo = x - dx; flo = f(lo); if (flo * fx <= 0) { hi = x; fhi = fx; break; } hi = x + dx; fhi = f(hi); if (fhi * fx <= 0) { lo = x; flo = fx; break; } } if (flo * fhi > 0 || flo !== flo || fhi !== fhi) throw err("Exiting fzero: aborting search for an interval containing a sign change because no sign change is detected during search. Function may not have a root."); }
    for (i = 0; i < 200; i++) { var mid = (lo + hi) / 2, fm = f(mid), sec = hi - fhi * (hi - lo) / (fhi - flo); if (sec > Math.min(lo, hi) && sec < Math.max(lo, hi)) { var fs = f(sec); if (Math.abs(fs) < Math.abs(fm)) { mid = sec; fm = fs; } } if (fm === 0 || Math.abs(hi - lo) < 4e-16 * Math.max(1, Math.abs(mid))) { lo = hi = mid; break; } if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; } }
    var root = (lo + hi) / 2; return nargout > 1 ? [num(root), num(f(root))] : num(root);
  };
  B.fminbnd = function (a, nargout, I) { var f = fnum(I, a[0]), lo = scalar(a[1]), hi = scalar(a[2]), g = (Math.sqrt(5) - 1) / 2, c = hi - g * (hi - lo), d = lo + g * (hi - lo), fc = f(c), fd = f(d); for (var i = 0; i < 200 && Math.abs(hi - lo) > 1e-10; i++) { if (fc < fd) { hi = d; d = c; fd = fc; c = hi - g * (hi - lo); fc = f(c); } else { lo = c; c = d; fc = fd; d = lo + g * (hi - lo); fd = f(d); } } var x = (lo + hi) / 2; return nargout > 1 ? [num(x), num(f(x))] : num(x); };
  B.fminsearch = function (a, nargout, I) {
    var x0 = mat(a[1]), n = x0.d.length, f = function (p) { var r = I.feval(a[0], [M(x0.r, x0.c, p.slice())])[0]; return r.d[0]; }, S = [x0.d.slice()], i, j, it;
    for (i = 0; i < n; i++) { var p = x0.d.slice(); p[i] = p[i] !== 0 ? p[i] * 1.05 : 0.00025; S.push(p); }
    var F = S.map(f);
    for (it = 0; it < 200 * n; it++) {
      var ord = F.map(function (v, k) { return k; }).sort(function (p1, q) { return F[p1] - F[q]; }); S = ord.map(function (k) { return S[k]; }); F = ord.map(function (k) { return F[k]; });
      if (Math.abs(F[n] - F[0]) < 1e-10 && Math.max.apply(null, S[n].map(function (v, k) { return Math.abs(v - S[0][k]); })) < 1e-8) break;
      var cen = new Array(n).fill(0); for (i = 0; i < n; i++) for (j = 0; j < n; j++) cen[j] += S[i][j] / n;
      var refl = cen.map(function (c, k) { return 2 * c - S[n][k]; }), fr = f(refl);
      if (fr < F[0]) { var ex = cen.map(function (c, k) { return 3 * c - 2 * S[n][k]; }), fe = f(ex); if (fe < fr) { S[n] = ex; F[n] = fe; } else { S[n] = refl; F[n] = fr; } }
      else if (fr < F[n - 1]) { S[n] = refl; F[n] = fr; }
      else { var con = fr < F[n] ? cen.map(function (c, k) { return 1.5 * c - 0.5 * S[n][k]; }) : cen.map(function (c, k) { return 0.5 * c + 0.5 * S[n][k]; }), fcn = f(con); if (fcn < Math.min(fr, F[n])) { S[n] = con; F[n] = fcn; } else { for (i = 1; i <= n; i++) { S[i] = S[i].map(function (v, k) { return S[0][k] + 0.5 * (v - S[0][k]); }); F[i] = f(S[i]); } } }
    }
    var best = M(x0.r, x0.c, S[0]); return nargout > 1 ? [best, num(F[0])] : best;
  };
  B.integral = B.quad = B.quadl = B.quadgk = function (a, nargout, I) {
    need(a, 3, undefined, "integral"); var f = fnum(I, a[0]), lo = scalar(a[1]), hi = scalar(a[2]), calls = 0;
    function simpson(a0, fa, b0, fb, m, fm) { return (b0 - a0) / 6 * (fa + 4 * fm + fb); }
    function rec(a0, fa, b0, fb, m, fm, whole, tol, depth) { var lm = (a0 + m) / 2, rm = (m + b0) / 2, flm = f(lm), frm = f(rm), L = simpson(a0, fa, m, fm, lm, flm), R = simpson(m, fm, b0, fb, rm, frm); if (++calls > 200000) throw err("integral: the function is too hard to integrate to the requested accuracy in the browser runner."); if (depth <= 0 || Math.abs(L + R - whole) <= 15 * tol) return L + R + (L + R - whole) / 15; return rec(a0, fa, m, fm, lm, flm, L, tol / 2, depth - 1) + rec(m, fm, b0, fb, rm, frm, R, tol / 2, depth - 1); }
    if (lo === hi) return num(0);
    var fa = f(lo), fb = f(hi), m = (lo + hi) / 2, fm = f(m); if (!isFinite(fa)) fa = f(lo + 1e-12 * (hi - lo)); if (!isFinite(fb)) fb = f(hi - 1e-12 * (hi - lo));
    return num(rec(lo, fa, hi, fb, m, fm, simpson(lo, fa, hi, fb, m, fm), 1e-10, 40));
  };
  function odeSolve(name, a, nargout, I) {
    need(a, 3, 4, name); var f = a[0], ts = vec(a[1]), y0 = vec(a[2]).slice(), n = y0.length;
    if (ts.length < 2) throw err("TSPAN must have at least two elements, e.g. [0 10].");
    function F(t, y) { var r = I.feval(f, [num(t), M(n, 1, y.slice())])[0]; if (!r || r.t !== "m" || r.d.length !== n) throw err("The ODE function must return a column vector with " + n + " element(s), the same length as the initial condition" + (r && r.t === "m" ? " (it returned " + r.d.length + ")." : ".")); return r.d; }
    var c2 = 1 / 5, c3 = 3 / 10, c4 = 4 / 5, c5 = 8 / 9, A = [[1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729], [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]],
      E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40], cs = [0, c2, c3, c4, c5, 1, 1];
    var t0 = ts[0], tf = ts[ts.length - 1], dir = tf >= t0 ? 1 : -1, span = Math.abs(tf - t0), rtol = 1e-3, atol = 1e-6, hmax = span / 10, t = t0, y = y0.slice(), T = [t0], Y = [y0.slice()], targets = ts.length > 2 ? ts.slice(1) : null, ti = 0, steps = 0;
    var k1 = F(t, y), h = Math.min(hmax, span / 100) , sc0 = 0; y.forEach(function (v, i) { sc0 = Math.max(sc0, Math.abs(k1[i]) / Math.max(Math.abs(v), atol / rtol)); }); if (sc0 > 0) h = Math.min(hmax, 0.8 * Math.pow(rtol, 0.2) / sc0);
    while ((tf - t) * dir > 1e-13 * Math.max(1, Math.abs(tf))) {
      if (++steps > 200000) throw err(name + ": too many steps. The problem may be stiff or the time span too long for the browser runner.");
      I.tick();
      var hEnd = targets ? Math.abs(targets[ti] - t) : Math.abs(tf - t), hit = false; if (h >= hEnd * (1 - 1e-12)) { h = hEnd; hit = true; }
      var k = [k1], s, i, j;
      for (s = 0; s < 6; s++) { var yt = y.slice(); for (j = 0; j <= s; j++) for (i = 0; i < n; i++) yt[i] += dir * h * A[s][j] * k[j][i]; k.push(F(t + dir * h * cs[s + 1], yt)); if (s === 5) var ynew = yt; }
      var e = 0; for (i = 0; i < n; i++) { var ei = 0; for (j = 0; j < 7; j++) ei += E[j] * k[j][i]; ei = Math.abs(h * ei) / Math.max(atol, rtol * Math.max(Math.abs(y[i]), Math.abs(ynew[i]))); if (ei > e || ei !== ei) e = ei; }
      if (e !== e) throw err(name + ": the solution became NaN/Inf. Check the equations and initial conditions.");
      if (e <= 1) {
        // refine: 3 extra Hermite points per step when no output grid was requested (smooth plots, like MATLAB's Refine = 4)
        if (!targets) for (var q = 1; q <= 3; q++) { var th = q / 4, h00 = 2 * th * th * th - 3 * th * th + 1, h10 = th * th * th - 2 * th * th + th, h01 = -2 * th * th * th + 3 * th * th, h11 = th * th * th - th * th; T.push(t + dir * h * th); Y.push(y.map(function (v, ii) { return h00 * v + h10 * dir * h * k1[ii] + h01 * ynew[ii] + h11 * dir * h * k[6][ii]; })); }
        t = hit ? (targets ? targets[ti] : tf) : t + dir * h; y = ynew; k1 = k[6];
        if (!targets || hit) { T.push(t); Y.push(y.slice()); if (targets && hit) ti++; }
        h = Math.min(hmax, h * Math.min(5, Math.max(0.2, 0.9 * Math.pow(Math.max(e, 1e-10), -0.2))));
      } else h = h * Math.max(0.1, 0.9 * Math.pow(e, -0.2));
      if (h < 1e-14 * Math.max(1, Math.abs(t))) throw err(name + ": step size became too small at t = " + fmtG(t, 5) + ". The problem may be stiff or singular.");
    }
    var m = T.length, Ym = zeros(m, n); for (var r = 0; r < m; r++) for (var cc = 0; cc < n; cc++) Ym.d[r + cc * m] = Y[r][cc];
    var Tm = M(m, 1, T);
    if (nargout === 0) { if (B.plot) { B.plot([Tm, Ym, str("-o")], 0, I); } return undefined; }
    if (nargout === 1) return struct({ x: _.transpose(Tm), y: _.transpose(Ym), solver: str(name) });
    return [Tm, Ym];
  }
  B.ode45 = function (a, n, I) { return odeSolve("ode45", a, n, I); };
  B.ode23 = function (a, n, I) { return odeSolve("ode23", a, n, I); };
  B.ode113 = B.ode15s = B.ode23s = B.ode23t = function (a, n, I) { return odeSolve("ode45", a, n, I); };
  B.deval = function (a) { var sol = a[0], tq = mat(a[1]); if (sol.t !== "st") throw err("deval needs the solution structure returned by sol = ode45(...)."); var T = sol.f.x.d, Y = sol.f.y, n = Y.r, o = zeros(n, tq.d.length); tq.d.forEach(function (t, q) { var lo = 0, hi = T.length - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; } var w = (t - T[lo]) / (T[hi] - T[lo] || 1); for (var i = 0; i < n; i++) o.d[i + q * n] = Y.d[i + lo * n] * (1 - w) + Y.d[i + hi * n] * w; }); return o; };
  /* fft */
  function fftCore(re, im, inv) {
    var n = re.length, i, j, k;
    if (n <= 1) return;
    if ((n & (n - 1)) === 0) {
      for (i = 1, j = 0; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (var len = 2; len <= n; len <<= 1) { var ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang); for (i = 0; i < n; i += len) { var cr = 1, ci = 0; for (k = 0; k < len / 2; k++) { var ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
    } else {
      if (n > 4096) throw err("fft length " + n + " is too large for the browser runner unless it is a power of 2.");
      var or = new Array(n), oi = new Array(n), sgn = inv ? 1 : -1;
      for (k = 0; k < n; k++) { var sr = 0, si = 0; for (j = 0; j < n; j++) { var a2 = sgn * 2 * Math.PI * ((k * j) % n) / n, c = Math.cos(a2), s = Math.sin(a2); sr += re[j] * c - im[j] * s; si += re[j] * s + im[j] * c; } or[k] = sr; oi[k] = si; }
      for (k = 0; k < n; k++) { re[k] = or[k]; im[k] = oi[k]; }
    }
    if (inv) for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  function fftFn(inv) { return function (a) { var v = mat(a[0], inv ? "ifft" : "fft"), n = a.length > 1 && a[1].d.length ? a[1].d[0] : v.d.length, re = [], im = []; for (var i = 0; i < n; i++) { re.push(i < v.d.length ? v.d[i] : 0); im.push(i < v.d.length && v.im ? v.im[i] : 0); } fftCore(re, im, inv); var tol = 1e-12 * Math.max.apply(null, re.map(Math.abs).concat(im.map(Math.abs)).concat([1e-300])), any = im.some(function (x) { return Math.abs(x) > tol; }); if (!any) im = null; else { im = im.map(function (x) { return Math.abs(x) <= tol ? 0 : x; }); } re = re.map(function (x) { return Math.abs(x) <= tol ? 0 : x; }); return v.c === 1 && v.r > 1 ? M(n, 1, re, im) : M(1, n, re, im); }; }
  B.fft = fftFn(false); B.ifft = fftFn(true);
  B.fftshift = function (a) { var v = mat(a[0]), n = v.d.length, k = Math.floor(n / 2); return B.circshift([v, num(k)]); };
  B.unwrap = function (a) { var p = vec(a[0]), o = [p[0]], off = 0; for (var i = 1; i < p.length; i++) { var d = p[i] - p[i - 1]; if (d > Math.PI) off -= 2 * Math.PI; else if (d < -Math.PI) off += 2 * Math.PI; o.push(p[i] + off); } return rowOrCol(a[0], o); };
  B.cart2pol = function (a) { var x = mat(a[0]), y = mat(a[1]); return [ew(y, x, Math.atan2), ew(x, y, Math.hypot)]; };
  B.pol2cart = function (a) { var th = mat(a[0]), r = mat(a[1]); return [ew(r, th, function (p, q) { return p * Math.cos(q); }), ew(r, th, function (p, q) { return p * Math.sin(q); })]; };
  B.histcounts = function (a, nargout) { var x = vec(a[0]), nb = a.length > 1 ? (a[1].d.length === 1 ? a[1].d[0] : null) : 10, edges = a.length > 1 && a[1].d.length > 1 ? a[1].d.slice() : null, i; if (!edges) { var lo = Math.min.apply(null, x), hi = Math.max.apply(null, x); if (lo === hi) { lo -= 0.5; hi += 0.5; } edges = []; for (i = 0; i <= nb; i++) edges.push(lo + (hi - lo) * i / nb); } var cnt = new Array(edges.length - 1).fill(0); x.forEach(function (v) { for (var k = 0; k < cnt.length; k++) if (v >= edges[k] && (v < edges[k + 1] || (k === cnt.length - 1 && v <= edges[k + 1]))) { cnt[k]++; break; } }); return nargout > 1 ? [_.rowv(cnt), _.rowv(edges)] : _.rowv(cnt); };

  /* ---- type conversion ---- */
  B["double"] = function (a) { var v = a[0]; if (v.t === "s") { var x = parseFloat(v.v); return num(/^\s*[-+]?(\d|\.\d|Inf|NaN)/i.test(v.v) ? x : NaN); } mat(v, "double"); return M(v.r, v.c, v.d.slice(), v.im ? v.im.slice() : null); };
  B.single = function (a) { var v = mat(a[0]); var o = M(v.r, v.c, v.d.map(Math.fround)); o.cls = "single"; return o; };
  Object.keys(_.INT).forEach(function (c) { B[c] = function (a) { return _.castInt(mat(a[0], c), c); }; });
  B.intmax = function (a) { var c = a.length ? text(a[0]) : "int32"; return _.castInt(num(_.INT[c][1]), c); }; B.intmin = function (a) { var c = a.length ? text(a[0]) : "int32"; return _.castInt(num(_.INT[c][0]), c); };
  B.logical = function (a) { var v = mat(a[0], "logical"); return like(v, v.d.map(function (x) { if (x !== x) throw err("NaN's cannot be converted to logicals."); return x !== 0 ? 1 : 0; }), "l"); };
  B["char"] = function (a) {
    if (a.length === 1) { var v = a[0]; if (v.t === "s") return str(v.v); if (v.t === "c") { var w = 0, rows = v.d.map(function (x) { var s = text(x); w = Math.max(w, s.length); return s; }); return charRows(rows, w); } mat(v, "char"); return M(v.r, v.c, v.d.slice(), null, "c"); }
    var rs = a.map(function (x) { return x.t === "m" && x.k !== "c" ? String.fromCharCode.apply(null, x.d) : text(x); }), wd = 0; rs.forEach(function (s) { wd = Math.max(wd, s.length); }); return charRows(rs, wd);
  };
  function charRows(rows, w) { var o = M(rows.length, w, new Array(rows.length * w), null, "c"); rows.forEach(function (s, i) { for (var j = 0; j < w; j++) o.d[i + j * rows.length] = j < s.length ? s.charCodeAt(j) : 32; }); return o; }
  B.string = function (a) { var v = a[0]; if (v.t === "s") return v; if (v.t === "m" && v.k === "c") return { t: "s", v: text(v) }; if (v.t === "m" && v.d.length === 1) return { t: "s", v: fmtG(v.d[0], 5) }; throw err("string() of arrays is not supported by the browser runner; use num2str or sprintf."); };
  B.num2cell = function (a) { var v = mat(a[0]); return cell(v.r, v.c, v.d.map(function (x) { return M(1, 1, [x], null, v.k); })); };
  B.cell2mat = function (a) { var c = a[0]; if (c.t !== "c") throw err("cell2mat needs a cell array."); if (!c.d.length) return empty(); var rows = []; for (var i = 0; i < c.r; i++) { var r = []; for (var j = 0; j < c.c; j++) r.push(c.d[i + j * c.r]); rows.push(r); } return _.catRows(rows); };
  B.cell = function (a) { var d = dims(a, "cell"), o = []; for (var i = 0; i < d[0] * d[1]; i++) o.push(empty()); return cell(d[0], d[1], o); };
  B.struct = function (a) { if (a.length % 2) throw err("struct needs field name / value pairs, e.g. struct('name','Ada','age',21)."); var s = struct({}); for (var i = 0; i < a.length; i += 2) { var v = a[i + 1]; if (v.t === "c" && v.d.length === 1) v = v.d[0]; s.f[text(a[i], "Field name")] = v; } return s; };
  B.fieldnames = function (a) { var s = a[0]; if (s.t === "sa") s = s.d[0] || struct({}); if (s.t !== "st") throw err("fieldnames needs a struct."); var k = Object.keys(s.f); return cell(k.length, 1, k.map(str)); };
  B.isfield = function (a) { var s = a[0]; if (s.t === "sa") s = s.d[0]; if (!s || s.t !== "st") return bool(false); if (a[1].t === "c") return M(a[1].r, a[1].c, a[1].d.map(function (x) { return s.f[text(x)] !== undefined ? 1 : 0; }), null, "l"); return bool(s.f[text(a[1])] !== undefined); };
  B.rmfield = function (a) { var s = _.own(a[0]), k = text(a[1]); if (s.f[k] === undefined) throw err("A field named '" + k + "' doesn't exist."); delete s.f[k]; return s; };
  B.setfield = function (a) { var s = _.own(a[0]); s.f[text(a[1])] = a[2]; return s; }; B.getfield = function (a) { var v = a[0].f[text(a[1])]; if (v === undefined) throw err("Unrecognized field name \"" + text(a[1]) + "\"."); return v; };

  /* ---- text ---- */
  function fmtOne(sp, val) {
    var s, conv = sp.conv, prec = sp.prec;
    if (typeof val === "string") { if (conv === "s" || conv === "c") s = prec !== null && conv === "s" ? val.slice(0, prec) : val; else if (conv === "d" || conv === "i" || conv === "u") s = val; else s = val; }
    else if (conv === "d" || conv === "i" || conv === "u") { s = isInt(val) ? _.intStr(val) : _.special(val) || expo(val, prec === null ? 6 : prec); if (isInt(val) && prec !== null) { var neg = val < 0, dg = String(Math.abs(val)); while (dg.length < prec) dg = "0" + dg; s = (neg ? "-" : "") + dg; } }
    else if (conv === "f" || conv === "F") s = fixed(val, prec === null ? 6 : prec);
    else if (conv === "e" || conv === "E") { s = expo(val, prec === null ? 6 : prec); if (conv === "E") s = s.toUpperCase(); }
    else if (conv === "g" || conv === "G") { s = fmtG(val, prec === null ? 6 : (prec || 1), sp.flags.indexOf("#") >= 0); if (conv === "G") s = s.toUpperCase(); }
    else if (conv === "s") s = isInt(val) && val >= 32 && val < 65536 && false ? String.fromCharCode(val) : fmtG(val, prec === null ? 5 : prec);
    else if (conv === "c") s = isInt(val) ? String.fromCharCode(val) : fmtG(val, 5);
    else if (conv === "x" || conv === "X") { s = isInt(val) ? Math.abs(val).toString(16) : expo(val, 6); if (conv === "X") s = s.toUpperCase(); }
    else if (conv === "o") s = isInt(val) ? Math.abs(val).toString(8) : expo(val, 6);
    else s = String(val);
    if (typeof val === "number" && val >= 0 && !/^[-+]/.test(s) && "dieEfFgG".indexOf(conv) >= 0) { if (sp.flags.indexOf("+") >= 0) s = "+" + s; else if (sp.flags.indexOf(" ") >= 0) s = " " + s; }
    if (sp.width !== null && s.length < sp.width) {
      if (sp.flags.indexOf("-") >= 0) s = _.padR(s, sp.width);
      else if (sp.flags.indexOf("0") >= 0 && typeof val === "number" && isFinite(val)) { var sign = /^[-+ ]/.test(s) ? s[0] : "", body = sign ? s.slice(1) : s; while (body.length + sign.length < sp.width) body = "0" + body; s = sign + body; }
      else s = pad(s, sp.width);
    }
    return s;
  }
  function unescape(s) { return s.replace(/\\(n|t|r|\\|a|b|f|v|x[0-9a-fA-F]{1,2}|[0-7]{1,3})/g, function (m, c) { return c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c === "\\" ? "\\" : c === "a" ? "" : c === "b" ? "\b" : c === "f" ? "\f" : c === "v" ? "\v" : c[0] === "x" ? String.fromCharCode(parseInt(c.slice(1), 16)) : String.fromCharCode(parseInt(c, 8)); }); }
  function sprintfM(fmt, args) {
    var items = [], parts = [], re = /%(%|([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d+))?([diufFeEgGscxXo]))/g, last = 0, m, out = "", idx = 0, nspec = 0;
    args.forEach(function (v) { if (v.t === "s") items.push(v.v); else if (v.t === "m" && v.k === "c") items.push(text(v)); else if (v.t === "m") v.d.forEach(function (x) { items.push(x); }); else if (v.t === "c") throw err("Function is not defined for 'cell' inputs. (Pass the cell contents, e.g. c{1}, not the cell itself.)"); else throw err("sprintf/fprintf cannot print a value of type '" + _.className(v) + "'."); });
    while ((m = re.exec(fmt))) { if (m.index > last) parts.push(unescape(fmt.slice(last, m.index))); if (m[1] === "%") parts.push("%"); else { parts.push({ flags: m[2] || "", width: m[3] === undefined ? null : m[3], prec: m[4] === undefined ? null : m[4], conv: m[5] }); nspec++; } last = re.lastIndex; }
    if (last < fmt.length) parts.push(unescape(fmt.slice(last)));
    for (var guard = 0; guard < 100000; guard++) {
      var stop = false;
      for (var p = 0; p < parts.length; p++) {
        var part = parts[p];
        if (typeof part === "string") { out += part; continue; }
        var sp = { flags: part.flags, conv: part.conv, width: part.width, prec: part.prec };
        if (sp.width === "*") sp.width = items[idx++]; else if (sp.width !== null) sp.width = parseInt(sp.width, 10);
        if (sp.prec === "*") sp.prec = items[idx++]; else if (sp.prec !== null) sp.prec = parseInt(sp.prec, 10);
        if (idx >= items.length) { if (items.length) { stop = true; break; } continue; }
        var val = items[idx++];
        if (typeof val === "string" && sp.conv !== "s" && sp.conv !== "c") { if (val.length === 1) val = val; out += fmtOne(sp, val); } else out += fmtOne(sp, val);
      }
      if (stop || idx >= items.length || !nspec) break;
    }
    return out;
  }
  _.sprintf = sprintfM;
  B.sprintf = function (a) { need(a, 1, undefined, "sprintf"); return str(sprintfM(text(a[0], "Format"), a.slice(1))); };
  B.fprintf = function (a, n, I) { need(a, 1, undefined, "fprintf"); if (a[0].t === "m" && a[0].k !== "c" && a[0].d.length === 1 && a.length > 1 && isText(a[1])) a = a.slice(1); I.print(sprintfM(text(a[0], "Format"), a.slice(1))); };
  B.printf = B.fprintf;
  function num2str(v, a1) {
    if (v.t === "s") return v.v; if (v.t === "m" && v.k === "c") return text(v);
    if (v.t !== "m") throw err("num2str needs a number.");
    if (a1 && isText(a1)) return sprintfM(text(a1), [v]);
    var prec = a1 ? scalar(a1) : null, d = v.d;
    function one(x, im) {
      var s; if (prec !== null) s = fmtG(x, prec); else if (isInt(x)) s = _.intStr(x); else s = fmtG(x, Math.max(0, Math.floor(Math.log10(Math.abs(x) || 1))) + 5);
      if (im !== undefined) { var t = prec !== null ? fmtG(Math.abs(im), prec) : isInt(im) ? _.intStr(Math.abs(im)) : fmtG(Math.abs(im), Math.max(0, Math.floor(Math.log10(Math.abs(im) || 1))) + 5); s += (im < 0 ? "-" : "+") + t + "i"; }
      return s;
    }
    if (d.length === 1) return one(d[0], v.im ? v.im[0] : undefined);
    if (!d.length) return "";
    var allInt = d.every(isInt) && !v.im, strs = d.map(function (x, i) { return one(x, v.im ? v.im[i] : undefined); }), w = 0, mx = 0; strs.forEach(function (s) { w = Math.max(w, s.length); }); d.forEach(function (x) { if (isFinite(x)) mx = Math.max(mx, Math.abs(x)); });
    if (allInt) w += 2; else { var N = Math.max(0, Math.floor(Math.log10(mx || 1))) + 5; strs = d.map(function (x, i) { return prec !== null ? one(x, v.im ? v.im[i] : undefined) : (v.im ? one(x, v.im[i]) : fmtG(x, N)); }); w = prec !== null ? Math.max.apply(null, strs.map(function (s) { return s.length; })) + 2 : Math.max(N + 7, Math.max.apply(null, strs.map(function (s) { return s.length; })) + 2); }
    var rows = []; for (var i = 0; i < v.r; i++) { var ln = ""; for (var j = 0; j < v.c; j++) ln += pad(strs[i + j * v.r], w); rows.push(ln); }
    var lead = Math.min.apply(null, rows.map(function (r) { return r.match(/^ */)[0].length; })); return rows.map(function (r) { return r.slice(lead); }).join("\n");
  }
  _.num2str = num2str;
  B.num2str = function (a) { need(a, 1, 2, "num2str"); var s = num2str(a[0], a[1]); if (s.indexOf("\n") >= 0) { var rows = s.split("\n"), w = 0; rows.forEach(function (r) { w = Math.max(w, r.length); }); return charRows(rows, w); } return str(s); };
  B.int2str = function (a) { var v = mat(a[0]); return B.num2str([like(v, v.d.map(_.mround))]); };
  B.mat2str = function (a) { var v = mat(a[0]), p = a.length > 1 ? scalar(a[1]) : 15, f = function (i) { return v.k === "l" ? (v.d[i] ? "true" : "false") : fmtG(v.d[i], p) + (v.im ? (v.im[i] < 0 ? "-" : "+") + fmtG(Math.abs(v.im[i]), p) + "i" : ""); }; if (v.k === "c") return str('"' + text(v) + '"'); if (v.d.length === 1) return str(f(0)); var rows = []; for (var i = 0; i < v.r; i++) { var r = []; for (var j = 0; j < v.c; j++) r.push(f(i + j * v.r)); rows.push(r.join(" ")); } return str("[" + rows.join(";") + "]"); };
  B.str2double = function (a) { var v = a[0]; if (v.t === "c") return M(v.r, v.c, v.d.map(function (x) { return B.str2double([x]).d[0]; })); if (!isText(v)) return num(NaN); var s = text(v).trim().replace(/,/g, ""); if (/^[-+]?(\d+\.?\d*|\.\d+)([eEdD][-+]?\d+)?$/.test(s)) return num(parseFloat(s.replace(/[dD]/, "e"))); if (/^[-+]?inf$/i.test(s)) return num(s[0] === "-" ? -Infinity : Infinity); var m = s.match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)?\s*([-+]\s*[\d.]*(?:e[-+]?\d+)?)\s*[ij]$/i); if (m) { var im = m[2].replace(/\s/g, ""); return M(1, 1, [m[1] ? parseFloat(m[1]) : 0], [im === "+" || im === "" ? 1 : im === "-" ? -1 : parseFloat(im)]); } return num(NaN); };
  B.str2num = B.eval = function (a, n, I, env) {
    var src = text(a[0], "Input");
    if (a === null) return empty();
    var sub = new MLab.Parser(src + "\n").program(), isExpr = sub.body.length === 1 && sub.body[0].type === "expr";
    if (isExpr) { var r = I.evalMulti(sub.body[0].e, env || I.base, 1); return r.length ? r[0] : undefined; }
    I.exec(sub.body, env || I.base); return undefined;
  };
  B.evalc = function () { throw err("evalc is not supported by the browser runner."); };
  B.upper = B.toupper = function (a) { return isText(a[0]) ? retext(a[0], text(a[0]).toUpperCase()) : a[0].t === "c" ? cell(a[0].r, a[0].c, a[0].d.map(function (x) { return B.upper([x]); })) : a[0]; };
  B.lower = B.tolower = function (a) { return isText(a[0]) ? retext(a[0], text(a[0]).toLowerCase()) : a[0].t === "c" ? cell(a[0].r, a[0].c, a[0].d.map(function (x) { return B.lower([x]); })) : a[0]; };
  function retext(orig, s) { return orig.t === "s" ? { t: "s", v: s } : str(s); }
  B.strtrim = B.strip = function (a) { if (a[0].t === "c") return cell(a[0].r, a[0].c, a[0].d.map(function (x) { return B.strtrim([x]); })); return retext(a[0], text(a[0]).trim()); };
  B.deblank = function (a) { return retext(a[0], text(a[0]).replace(/\s+$/, "")); };
  B.blanks = function (a) { return str(new Array(scalar(a[0]) + 1).join(" ")); };
  B.newline = function () { return str("\n"); };
  B.strcat = function (a) { if (a.some(function (x) { return x.t === "c"; })) { var n = 1; a.forEach(function (x) { if (x.t === "c") n = Math.max(n, x.d.length); }); var out = []; for (var i = 0; i < n; i++) out.push(str(a.map(function (x) { return x.t === "c" ? text(x.d[x.d.length === 1 ? 0 : i]) : text(x); }).join(""))); var first = a.filter(function (x) { return x.t === "c"; })[0]; return cell(first.d.length === n ? first.r : 1, first.d.length === n ? first.c : n, out); } var anyS = a.some(function (x) { return x.t === "s"; }), s = a.map(function (x) { var t = text(x, "strcat input"); return x.t === "s" ? t : t.replace(/[ \t]+$/, ""); }).join(""); return anyS ? { t: "s", v: s } : str(s); };
  B.strrep = B.replace = function (a) { need(a, 3, 3, "strrep"); if (a[0].t === "c") return cell(a[0].r, a[0].c, a[0].d.map(function (x) { return B.strrep([x, a[1], a[2]]); })); return retext(a[0], text(a[0]).split(text(a[1])).join(text(a[2]))); };
  function cmpFn(name, f) { B[name] = function (a) { need(a, 2, 3, name); var x = a[0], y = a[1], n = a[2] ? scalar(a[2]) : null; function one(p, q) { return isText(p) && isText(q) && f(text(p), text(q), n) ? 1 : 0; } if (x.t === "c" || y.t === "c") { var c = x.t === "c" ? x : y, o = x.t === "c" ? y : x; return M(c.r, c.c, c.d.map(function (e, i) { return one(e, o.t === "c" ? o.d[i] : o); }), null, "l"); } return bool(one(x, y)); }; }
  cmpFn("strcmp", function (p, q) { return p === q; }); cmpFn("strcmpi", function (p, q) { return p.toLowerCase() === q.toLowerCase(); });
  cmpFn("strncmp", function (p, q, n) { return p.length >= n && q.length >= n && p.slice(0, n) === q.slice(0, n); }); cmpFn("strncmpi", function (p, q, n) { return p.length >= n && q.length >= n && p.slice(0, n).toLowerCase() === q.slice(0, n).toLowerCase(); });
  B.strfind = function (a) { var s = text(a[0]), p = text(a[1]), out = [], i = -1; if (!p.length) return M(1, 0, []); while ((i = s.indexOf(p, i + 1)) >= 0) out.push(i + 1); return out.length ? _.rowv(out) : empty(); };
  B.contains = function (a) { var p = text(a[1]); if (a[0].t === "c") return M(a[0].r, a[0].c, a[0].d.map(function (x) { return text(x).indexOf(p) >= 0 ? 1 : 0; }), null, "l"); return bool(text(a[0]).indexOf(p) >= 0); };
  B.startsWith = function (a) { return bool(text(a[0]).indexOf(text(a[1])) === 0); }; B.endsWith = function (a) { var s = text(a[0]), p = text(a[1]); return bool(s.length >= p.length && s.slice(s.length - p.length) === p); };
  B.strsplit = B.split = function (a) { var s = text(a[0]), parts = a.length > 1 ? s.split(text(a[1]).replace(/\\n/g, "\n").replace(/\\t/g, "\t")) : s.split(/\s+/); return cell(1, parts.length, parts.map(str)); };
  B.strjoin = B.join = function (a) { var c = a[0]; if (c.t !== "c") throw err("strjoin needs a cell array of text."); return str(c.d.map(function (x) { return text(x); }).join(a.length > 1 ? text(a[1]).replace(/\\n/g, "\n") : " ")); };
  B.strlength = function (a) { return num(text(a[0]).length); };
  B.isspace = function (a) { var v = a[0]; return like(v, v.d.map(function (c) { return /\s/.test(String.fromCharCode(c)) ? 1 : 0; }), "l"); };
  B.isletter = function (a) { var v = a[0]; return like(v, v.d.map(function (c) { return /[A-Za-z]/.test(String.fromCharCode(c)) ? 1 : 0; }), "l"); };
  B.isstrprop = function (a) { var v = a[0], k = text(a[1]), re = k === "digit" ? /[0-9]/ : k === "alpha" ? /[A-Za-z]/ : k === "upper" ? /[A-Z]/ : k === "lower" ? /[a-z]/ : k === "alphanum" ? /[A-Za-z0-9]/ : /\s/; return like(v, v.d.map(function (c) { return re.test(String.fromCharCode(c)) ? 1 : 0; }), "l"); };
  B.regexprep = function (a) { return str(text(a[0]).replace(new RegExp(text(a[1]), "g"), text(a[2]).replace(/\$(\d)/g, "$$$1"))); };
  B.dec2bin = function (a) { var s = Math.round(scalar(a[0])).toString(2), n = a.length > 1 ? scalar(a[1]) : 0; while (s.length < n) s = "0" + s; return str(s); };
  B.bin2dec = function (a) { return num(parseInt(text(a[0]).replace(/\s/g, ""), 2)); };
  B.dec2hex = function (a) { var s = Math.round(scalar(a[0])).toString(16).toUpperCase(), n = a.length > 1 ? scalar(a[1]) : 0; while (s.length < n) s = "0" + s; return str(s); };
  B.hex2dec = function (a) { return num(parseInt(text(a[0]), 16)); };
  B.dec2base = function (a) { return str(Math.round(scalar(a[0])).toString(scalar(a[1])).toUpperCase()); };
  B.func2str = function (a) { if (a[0].t !== "f") throw err("func2str needs a function handle."); return str(a[0].name ? a[0].name : a[0].src); };
  B.str2func = function (a, n, I) { var s = text(a[0]); if (s[0] === "@") return B.eval([str(s)], 1, I); return { t: "f", name: s }; };
  B.feval = function (a, n, I) { return I.feval(a[0], a.slice(1), n); };
  B.cellfun = function (a, nargout, I) {
    need(a, 2, undefined, "cellfun"); var f = a[0], uniform = true, cells = [], i;
    for (i = 1; i < a.length; i++) { if (isText(a[i]) && /^UniformOutput$/i.test(text(a[i]))) { uniform = _.truthy(a[i + 1]); i++; } else if (isText(a[i]) && /^ErrorHandler$/i.test(text(a[i]))) i++; else cells.push(a[i]); }
    if (isText(f)) { var nm = text(f); f = { t: "f", name: nm === "isclass" ? "isa" : nm }; }
    var c0 = cells[0]; if (c0.t !== "c") throw err("cellfun works on cell arrays. For numeric arrays use arrayfun.");
    var out = c0.d.map(function (x, k) { var r = I.feval(f, cells.map(function (c) { return c.d[k]; }), 1)[0]; if (r === undefined) throw err("The function passed to cellfun returned no value."); return r; });
    if (!uniform) return cell(c0.r, c0.c, out);
    out.forEach(function (r) { if (r.t !== "m" || r.d.length !== 1) throw err("Non-scalar in Uniform output, at index 1, output 1. Set 'UniformOutput' to false."); });
    return M(c0.r, c0.c, out.map(function (r) { return r.d[0]; }), null, out.length && out.every(function (r) { return r.k === "l"; }) ? "l" : "d");
  };
  B.arrayfun = function (a, nargout, I) {
    var f = a[0], uniform = true, arrs = [], i; for (i = 1; i < a.length; i++) { if (isText(a[i]) && /^UniformOutput$/i.test(text(a[i]))) { uniform = _.truthy(a[i + 1]); i++; } else arrs.push(a[i]); }
    var v = arrs[0], n = _.numel(v), out = []; for (i = 0; i < n; i++) out.push(I.feval(f, arrs.map(function (x) { return _.indexGet(x, [num(i + 1)]); }), 1)[0]);
    if (!uniform) return cell(v.r, v.c, out);
    out.forEach(function (r) { if (!r || r.t !== "m" || r.d.length !== 1) throw err("Non-scalar in Uniform output. Set 'UniformOutput' to false."); });
    return M(v.r, v.c, out.map(function (r) { return r.d[0]; }), null, out.length && out.every(function (r) { return r.k === "l"; }) ? "l" : "d");
  };

  /* ---- output, workspace, environment ---- */
  B.disp = function (a, n, I) {
    need(a, 1, 1, "disp"); var v = a[0];
    if (v.t === "s") { I.print(v.v + "\n"); return; }
    if (v.t === "m" && v.k === "c") { I.print(text(v) + "\n"); return; }
    if (v.t === "m" && !v.d.length) { if (!(v.r === 0 && v.c === 0)) I.print(_.bodyLines(v, I).join("\n") + "\n"); return; }
    var lines = _.bodyLines(v, I);
    if ((v.t === "m" && (v.k === "l" || v.cls)) || v.t === "c" || v.t === "st" || v.t === "f") lines = lines.slice(2);
    I.print(lines.join("\n") + "\n");
  };
  B.display = function (a, n, I) { I.print(_.showNamed("ans", a[0], I)); };
  B.error = function (a) { if (!a.length) throw err("Unknown error."); if (a[0].t === "st") throw err(text(a[0].f.message), a[0].f.identifier ? text(a[0].f.identifier) : ""); var first = text(a[0]), id = ""; if (a.length > 1 && /^[A-Za-z]\w*(:\w+)+$/.test(first)) { id = first; a = a.slice(1); first = text(a[0]); } throw err(a.length > 1 || /%[-+ 0#]*\d*\.?\d*[diufeEgGsc]|\\n/.test(first) ? sprintfM(first, a.slice(1)) : first, id); };
  B.warning = function (a, n, I) { if (!a.length) return; var first = text(a[0]); if (first === "off" || first === "on") return; if (a.length > 1 && /^[A-Za-z]\w*(:\w+)+$/.test(first)) { a = a.slice(1); first = text(a[0]); } I.warn(sprintfM(first, a.slice(1))); };
  B.assert = function (a) { if (!_.truthy(a[0])) throw err(a.length > 1 ? sprintfM(text(a[1]), a.slice(2)) : "Assertion failed."); };
  B.MException = function (a) { return struct({ identifier: a[0], message: str(sprintfM(text(a[1]), a.slice(2))) }); };
  B.rethrow = function (a) { throw err(text(a[0].f.message), a[0].f.identifier ? text(a[0].f.identifier) : ""); };
  B.lasterr = function (a, n, I) { return str(I.lastError ? I.lastError.message : ""); };
  B.input = function (a, n, I, env) {
    var prompt = a.length ? text(a[0]) : "", asStr = a.length > 1 && text(a[1]) === "s", ans;
    if (I.inputs && I.inputs.length) ans = String(I.inputs.shift());
    else if (I.onInput) ans = I.onInput(prompt.replace(/\\n/g, "\n"));
    else throw err("input() needs someone to type a value. In this runner, fill the \"Input values\" box under the code, or replace input(...) with a fixed value.", "EEHub:input");
    if (ans === null || ans === undefined) throw err("Input cancelled.", "EEHub:input");
    I.print(unescape(prompt) + ans + "\n");
    if (asStr) return str(String(ans));
    if (String(ans).trim() === "") return empty();
    return B.eval([str(String(ans))], 1, I, env);
  };
  B.keyboard = B.dbstop = B.dbcont = B.dbquit = function () {};
  B.pause = B.drawnow = B.beep = B.shg = B.more = B.echo = B.diary = B.commandwindow = function () {};
  B.clc = function (a, n, I) { I.out = ""; };
  B.home = B.clc;
  B.format = function (a, n, I) { var args = a.map(function (x) { return text(x).toLowerCase(); }); if (!args.length) { I.format = "short"; I.compact = false; } args.forEach(function (m) { if (m === "long" || m === "longg" || m === "longe") I.format = "long"; else if (m === "short" || m === "shortg" || m === "shorte") I.format = "short"; else if (m === "compact") I.compact = true; else if (m === "loose") I.compact = false; else if (m === "bank" || m === "rat" || m === "hex") throw err("format " + m + " is not supported by the browser runner; use format short or format long.", "EEHub:realMatlabOnly"); }); };
  B.clear = B.clearvars = function (a, n, I, env) { var names = a.map(function (x) { return text(x); }).filter(function (s) { return s[0] !== "-"; }); if (!names.length || names[0] === "all" || names[0] === "variables") { for (var k in env.vars) delete env.vars[k]; if (names[0] === "all") { I.globals = Object.create(null); } return; } names.forEach(function (nm) { if (nm.indexOf("*") >= 0) { var re = new RegExp("^" + nm.replace(/\*/g, ".*") + "$"); Object.keys(env.vars).forEach(function (k2) { if (re.test(k2)) delete env.vars[k2]; }); } else delete env.vars[nm]; }); };
  B.exist = function (a, n, I, env) { var nm = text(a[0]); if (env.vars[nm] !== undefined) return num(1); if (I.funcs[nm]) return num(2); if (B[nm]) return num(nm in { sin: 1, cos: 1, zeros: 1, ones: 1, size: 1, numel: 1, disp: 1 } ? 5 : 2); return num(0); };
  B.isvarname = function (a) { return bool(isText(a[0]) && /^[A-Za-z]\w{0,62}$/.test(text(a[0]))); };
  B.who = function (a, n, I, env) { var k = Object.keys(env.vars).sort(); if (k.length) I.print("\nYour variables are:\n\n" + k.join("  ") + "\n\n"); };
  B.whos = function (a, n, I, env) {
    var k = Object.keys(env.vars).sort(); if (!k.length) return;
    var rows = k.map(function (name) { var v = env.vars[name], s = shape(v), cn = _.className(v), bytes = v.t === "m" ? s[0] * s[1] * (v.k === "c" ? 2 : v.k === "l" ? 1 : cn === "single" || cn === "int32" || cn === "uint32" ? 4 : cn === "int8" || cn === "uint8" ? 1 : cn === "int16" || cn === "uint16" ? 2 : 8) * (v.im ? 2 : 1) : 0; return [name, s[0] + "x" + s[1], String(bytes || ""), cn, v.im ? "complex" : ""]; });
    var w = [4, 4, 5, 5]; rows.forEach(function (r) { for (var i = 0; i < 4; i++) w[i] = Math.max(w[i], r[i].length); });
    I.print("  " + _.padR("Name", w[0]) + "      " + _.padR("Size", w[1]) + "    " + pad("Bytes", w[2]) + "  " + _.padR("Class", w[3]) + "     Attributes\n\n");
    rows.forEach(function (r) { I.print(("  " + _.padR(r[0], w[0]) + "      " + _.padR(r[1], w[1]) + "    " + pad(r[2], w[2]) + "  " + _.padR(r[3], w[3]) + "     " + r[4]).replace(/\s+$/, "") + "\n"); }); I.print("\n");
  };
  B.nargin = function (a, n, I, env) { if (env.nargin === undefined) throw err("You can only use nargin inside a function."); return num(env.nargin); };
  B.nargout = function (a, n, I, env) { if (env.nargout === undefined) throw err("You can only use nargout inside a function."); return num(env.nargout); };
  B.narginchk = function (a, n, I, env) { var lo = scalar(a[0]), hi = scalar(a[1]); if (env.nargin < lo) throw err("Not enough input arguments."); if (env.nargin > hi) throw err("Too many input arguments."); };
  B.nargoutchk = function () {};
  B.inputname = function () { return str(""); };
  B.tic = function (a, n, I) { I.ticStart = Date.now(); };
  B.toc = function (a, n, I) { var s = (Date.now() - I.ticStart) / 1000; if (n > 0) return num(s); I.print("Elapsed time is " + s.toFixed(6) + " seconds.\n"); };
  B.clock = function () { var d = new Date(); return _.rowv([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]); };
  B.cputime = B.now = function () { return num(Date.now() / 1000); };
  B.date = function () { var d = new Date(), m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return str((d.getDate() < 10 ? "0" : "") + d.getDate() + "-" + m[d.getMonth()] + "-" + d.getFullYear()); };
  B.version = function () { return str("EE Hub runner (MATLAB-compatible subset)"); };
  B.ver = function (a, n, I) { I.print("EE Hub MATLAB-compatible runner. This is not MathWorks MATLAB; it runs a teaching subset of the language in your browser.\n"); };
  B.computer = function () { return str("BROWSER"); };
  B.ispc = B.ismac = B.isunix = function () { return bool(false); };
  B.help = B.doc = B.lookfor = function (a, n, I) { var nm = a.length ? text(a[0]) : ""; I.print(nm ? (B[nm] ? "'" + nm + "' is available in this runner. " : U[nm] ? "'" + nm + "' needs real MATLAB. " : "'" + nm + "' is not known to this runner. ") + "For the full reference page type  doc " + nm + "  in MATLAB, or search \"" + nm + "\" at mathworks.com/help.\n" : "Type  help name  for a function, e.g.  help linspace\n"); };

  /* ---- commands that need real MATLAB ---- */
  var why = {
    "needs the Symbolic Math Toolbox.": "syms sym vpa solve dsolve int limit simplify expand factorial_sym subs laplace ilaplace fourier ifourier ztrans iztrans taylor collect pretty symsum jacobian fplot3 matlabFunction double_sym latex",
    "reads or writes files on your computer.": "load save fopen fclose fgetl fgets fscanf fread fwrite textscan readtable writetable readmatrix writematrix xlsread xlswrite csvread csvwrite dlmread dlmwrite importdata imread imwrite imshow audioread audiowrite sound soundsc dir ls cd pwd mkdir delete copyfile movefile exist_file which type open edit uigetfile uiputfile saveas print exportgraphics savefig openfig publish websave webread",
    "opens a window or app that only exists in desktop MATLAB.": "uifigure uicontrol uibutton uilabel uieditfield uislider uiaxes appdesigner guide msgbox inputdlg questdlg errordlg warndlg waitbar menu ginput getframe movie VideoWriter animatedline simulink sim open_system new_system load_system add_block add_line set_param get_param sscnew ssc_new slLibraryBrowser sisotool pidTuner rltool controlSystemDesigner ltiview linearSystemAnalyzer",
    "is part of a toolbox the browser runner does not include.": "table array2table cell2table struct2table timetable datetime duration datestr datenum categorical containers.Map ss ss2tf tf2ss tf2zp zp2tf zpk c2d d2c residue lsim initial nichols acker place lqr ctrb obsv spline pchip ppval mkpp griddata interp2 lu qr chol svd expm null orth cond lsqnonlin lsqcurvefit fmincon linprog fsolve optimset optimoptions odeset bvp4c pdepe butter cheby1 cheby2 ellip fir1 freqz filtfilt spectrogram pwelch periodogram xcorr hamming hanning hann blackman resample downsample upsample awgn normrnd normpdf normcdf fitlm regress corrcoef cov kmeans arduino raspi serialport tcpclient parfor_pool gpuArray",
    "is not supported by the browser runner (classes and handle graphics need real MATLAB).": "classdef properties methods events enumeration gcf gca gco set get findobj handle addpath rmpath genpath mlock inputParser validateattributes timer start stop wait"
  };
  Object.keys(why).forEach(function (reason) { why[reason].split(" ").forEach(function (n) { if (!B[n]) U[n] = reason; }); });
  return MLab;
});
