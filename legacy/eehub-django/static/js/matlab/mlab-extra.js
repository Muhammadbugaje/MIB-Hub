/* EE Hub MATLAB-compatible runner: second-round extensions.
   Matrix factorisations (lu, qr, chol, svd, cond, null, orth, expm), spline/pchip interpolation, an in-memory
   virtual file system (fopen/fprintf/fgetl/fclose, save/load, readmatrix/writematrix, csvread…), basic tables,
   state-space models and discrete-time transfer functions (ss, ss2tf, tf2ss, ctrb, obsv, acker/place, c2d).
   Files never leave the page: they live in memory for one run, seeded with a few sample files. */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./mlab.js")); else factory(root.MLab); })(typeof self !== "undefined" ? self : this, function (MLab) {
  "use strict";
  var _ = MLab._, B = MLab.B, U = MLab.UNSUPPORTED, M = _.M, num = _.num, str = _.str, err = _.err, text = _.text, isText = _.isText, scalar = _.scalar, fmtG = _.fmtG, pad = _.pad, padR = _.padR;
  function def(names, fn) { names.split(" ").forEach(function (n) { B[n] = fn; delete U[n]; }); }
  function rmat(v, name) { if (!v || v.t !== "m") throw err("'" + name + "' needs a numeric matrix."); if (v.im) throw err("'" + name + "' of a complex matrix is not supported by the browser runner."); return v; }
  function rows(A) { var o = []; for (var i = 0; i < A.r; i++) { var r = []; for (var j = 0; j < A.c; j++) r.push(A.d[i + j * A.r]); o.push(r); } return o; }
  function fromRows(R, c) { var r = R.length; c = c === undefined ? (r ? R[0].length : 0) : c; var d = new Array(r * c); for (var i = 0; i < r; i++) for (var j = 0; j < c; j++) d[i + j * r] = R[i][j]; return M(r, c, d); }
  function eyeR(n) { var o = []; for (var i = 0; i < n; i++) { o.push(new Array(n).fill(0)); o[i][i] = 1; } return o; }
  function clean(x) { return Math.abs(x) < 1e-15 ? 0 : x; }
  function mm(a, b) { return _.matmul(a, b); }
  function tp(a) { return _.transpose(a, false); }

  /* ---------- factorisations ---------- */
  function luR(A) {
    var n = A.r, a = rows(A), perm = [], i, j, k; for (i = 0; i < n; i++) perm.push(i);
    for (k = 0; k < n; k++) {
      var p = k; for (i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
      if (p !== k) { var t = a[k]; a[k] = a[p]; a[p] = t; t = perm[k]; perm[k] = perm[p]; perm[p] = t; }
      if (a[k][k] === 0) continue;
      for (i = k + 1; i < n; i++) { var f = a[i][k] / a[k][k]; a[i][k] = f; for (j = k + 1; j < n; j++) a[i][j] -= f * a[k][j]; }
    }
    var L = eyeR(n), Um = eyeR(n), P = [];
    for (i = 0; i < n; i++) { P.push(new Array(n).fill(0)); P[i][perm[i]] = 1; for (j = 0; j < n; j++) { if (j < i) { L[i][j] = a[i][j]; Um[i][j] = 0; } else Um[i][j] = a[i][j]; } }
    return { L: fromRows(L), U: fromRows(Um), P: fromRows(P) };
  }
  def("lu", function (a, nargout) { var A = rmat(a[0], "lu"); if (A.r !== A.c) throw err("lu of a non-square matrix is not supported by the browser runner."); var f = luR(A); if (nargout >= 3) return [f.L, f.U, f.P]; if (nargout === 2) return [mm(tp(f.P), f.L), f.U]; var Y = M(A.r, A.c, f.U.d.slice()); for (var i = 0; i < A.r; i++) for (var j = 0; j < i; j++) Y.d[i + j * A.r] = f.L.d[i + j * A.r]; return Y; });
  function qrR(A) {
    var m = A.r, n = A.c, R = rows(A), Q = eyeR(m), k, i, j;
    for (k = 0; k < Math.min(m - 1, n); k++) {
      var nrm = 0; for (i = k; i < m; i++) nrm += R[i][k] * R[i][k]; nrm = Math.sqrt(nrm); if (nrm === 0) continue;
      var alpha = R[k][k] > 0 ? -nrm : nrm, v = new Array(m).fill(0); v[k] = R[k][k] - alpha; for (i = k + 1; i < m; i++) v[i] = R[i][k];
      var vv = 0; for (i = k; i < m; i++) vv += v[i] * v[i]; if (vv === 0) continue;
      for (j = 0; j < n; j++) { var s = 0; for (i = k; i < m; i++) s += v[i] * R[i][j]; s = 2 * s / vv; for (i = k; i < m; i++) R[i][j] -= s * v[i]; }
      for (j = 0; j < m; j++) { var s2 = 0; for (i = k; i < m; i++) s2 += Q[j][i] * v[i]; s2 = 2 * s2 / vv; for (i = k; i < m; i++) Q[j][i] -= s2 * v[i]; }
    }
    for (i = 0; i < m; i++) for (j = 0; j < n; j++) { R[i][j] = i > j ? 0 : clean(R[i][j]); }
    return { Q: fromRows(Q), R: fromRows(R, n) };
  }
  def("qr", function (a, nargout) { var f = qrR(rmat(a[0], "qr")); return nargout >= 2 ? [f.Q, f.R] : f.R; });
  def("chol", function (a) {
    var A = rmat(a[0], "chol"), n = A.r, R = eyeR(n).map(function (r) { return r.map(function () { return 0; }); }), i, j, k;
    if (A.r !== A.c) throw err("Matrix must be square.");
    for (j = 0; j < n; j++) { var s = A.d[j + j * n]; for (k = 0; k < j; k++) s -= R[k][j] * R[k][j]; if (!(s > 0)) throw err("Matrix must be positive definite."); R[j][j] = Math.sqrt(s); for (i = j + 1; i < n; i++) { var t = A.d[j + i * n]; for (k = 0; k < j; k++) t -= R[k][j] * R[k][i]; R[j][i] = t / R[j][j]; } }
    if (a.length > 1 && isText(a[1]) && text(a[1]) === "lower") return tp(fromRows(R)); return fromRows(R);
  });
  function symEig(S) { // Jacobi on a symmetric matrix -> {vals, V (rows array, columns are vectors)}, descending
    var n = S.r, a = rows(S), V = eyeR(n), sweep, p, q, i;
    for (sweep = 0; sweep < 100; sweep++) {
      var off = 0; for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) off += a[p][q] * a[p][q]; if (off < 1e-30) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        var th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (i = 0; i < n; i++) { var x = a[i][p], y = a[i][q]; a[i][p] = c * x - s * y; a[i][q] = s * x + c * y; }
        for (i = 0; i < n; i++) { var x2 = a[p][i], y2 = a[q][i]; a[p][i] = c * x2 - s * y2; a[q][i] = s * x2 + c * y2; }
        for (i = 0; i < n; i++) { var x3 = V[i][p], y3 = V[i][q]; V[i][p] = c * x3 - s * y3; V[i][q] = s * x3 + c * y3; }
      }
    }
    var ord = []; for (i = 0; i < n; i++) ord.push(i); ord.sort(function (x, y) { return a[y][y] - a[x][x]; });
    return { vals: ord.map(function (k) { return a[k][k]; }), V: V.map(function (r) { return ord.map(function (k) { return r[k]; }); }) };
  }
  function svdR(A) { // thin SVD through the eigen-decomposition of A'A (fine for teaching-size, well-scaled matrices)
    var flip = A.r < A.c, X = flip ? tp(A) : A, m = X.r, n = X.c, e = symEig(mm(tp(X), X)), s = e.vals.map(function (v) { return Math.sqrt(Math.max(0, v)); }), V = fromRows(e.V), XV = mm(X, V), Ur = [], i, j, tol = Math.max(m, n) * (s[0] || 0) * 2.3e-16 * 1e4;
    for (i = 0; i < m; i++) { Ur.push([]); for (j = 0; j < n; j++) Ur[i].push(s[j] > tol ? XV.d[i + j * m] / s[j] : 0); }
    for (j = 0; j < n; j++) if (!(s[j] > tol)) { // complete with a vector orthogonal to the others
      for (var e0 = 0; e0 < m; e0++) { var v = new Array(m).fill(0); v[e0] = 1; for (var k = 0; k < n; k++) if (k !== j && (s[k] > tol || k < j)) { var dt = 0; for (i = 0; i < m; i++) dt += v[i] * Ur[i][k]; for (i = 0; i < m; i++) v[i] -= dt * Ur[i][k]; } var nv = Math.sqrt(v.reduce(function (p, q) { return p + q * q; }, 0)); if (nv > 1e-6) { for (i = 0; i < m; i++) Ur[i][j] = v[i] / nv; break; } }
      s[j] = s[j] > tol * 1e-4 ? s[j] : 0;
    }
    var Um = fromRows(Ur, n);
    return flip ? { U: V, s: s, V: Um, tol: tol } : { U: Um, s: s, V: V, tol: tol };
  }
  def("svd", function (a, nargout) { var A = rmat(a[0], "svd"), f = svdR(A), k = f.s.length; if (nargout < 2) return M(k, 1, f.s.slice()); var S = _.zeros(k, k); f.s.forEach(function (v, i) { S.d[i + i * k] = v; }); return [f.U, S, f.V]; });
  def("cond", function (a) { var s = svdR(rmat(a[0], "cond")).s, lo = s[s.length - 1]; return num(lo === 0 ? Infinity : s[0] / lo); });
  def("null", function (a) { var A = rmat(a[0], "null"), e = symEig(mm(tp(A), A)), n = A.c, tol = Math.max(A.r, n) * Math.sqrt(Math.max(0, e.vals[0])) * 2.3e-16 * 1e4, keep = []; e.vals.forEach(function (v, j) { if (Math.sqrt(Math.max(0, v)) <= tol) keep.push(j); }); return fromRows(e.V.map(function (r) { return keep.map(function (j) { return r[j]; }); }), keep.length); });
  def("orth", function (a) { var A = rmat(a[0], "orth"), f = svdR(A), keep = []; f.s.forEach(function (v, j) { if (v > f.tol) keep.push(j); }); return fromRows(rows(f.U).map(function (r) { return keep.map(function (j) { return r[j]; }); }), keep.length); });
  function expm(A) {
    var n = A.r, nrm = 0, i, j; for (i = 0; i < n; i++) { var rs = 0; for (j = 0; j < n; j++) rs += Math.abs(A.d[i + j * n]); nrm = Math.max(nrm, rs); }
    var sq = Math.max(0, Math.ceil(Math.log2(nrm || 1)) + 2), X = M(n, n, A.d.map(function (v) { return v / Math.pow(2, sq); })), E = _.eye(n), T = _.eye(n);
    for (var k = 1; k <= 18; k++) { T = mm(T, X); T = M(n, n, T.d.map(function (v) { return v / k; })); E = M(n, n, E.d.map(function (v, q) { return v + T.d[q]; })); }
    for (i = 0; i < sq; i++) E = mm(E, E);
    return E;
  }
  _.expm = expm;
  def("expm", function (a) { var A = rmat(a[0], "expm"); if (A.r !== A.c) throw err("Matrix must be square."); return expm(A); });

  /* ---------- spline and pchip ---------- */
  function hermite(xs, ys, d, v) {
    var n = xs.length, lo = 0, hi = n - 1; while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (xs[mid] <= v) lo = mid; else hi = mid; }
    var h = xs[lo + 1] - xs[lo], del = (ys[lo + 1] - ys[lo]) / h, c = (3 * del - 2 * d[lo] - d[lo + 1]) / h, b = (d[lo] - 2 * del + d[lo + 1]) / (h * h), s = v - xs[lo];
    return ys[lo] + s * (d[lo] + s * (c + s * b));
  }
  function slopes(xs, ys, kind) {
    var n = xs.length, h = [], del = [], d = new Array(n), i;
    for (i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); del.push((ys[i + 1] - ys[i]) / h[i]); }
    if (n === 2) return [del[0], del[0]];
    if (kind === "pchip") {
      for (i = 1; i < n - 1; i++) { if (del[i - 1] * del[i] <= 0) d[i] = 0; else { var w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; d[i] = (w1 + w2) / (w1 / del[i - 1] + w2 / del[i]); } }
      var end = function (h0, h1, d0, d1) { var v = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1); if (v * d0 <= 0) return 0; if (d0 * d1 <= 0 && Math.abs(v) > 3 * Math.abs(d0)) return 3 * d0; return v; };
      d[0] = end(h[0], h[1], del[0], del[1]); d[n - 1] = end(h[n - 2], h[n - 3], del[n - 2], del[n - 3]); return d;
    }
    if (n === 3) { // not-a-knot through three points is the parabola
      var a2 = (del[1] - del[0]) / (xs[2] - xs[0]); return [del[0] - a2 * h[0], del[0] + a2 * h[0], del[1] + a2 * h[1]];
    }
    var A = _.zeros(n, n), r = _.zeros(n, 1);
    A.d[0] = h[1]; A.d[0 + 1 * n] = h[0] + h[1]; r.d[0] = ((3 * h[0] + 2 * h[1]) * h[1] * del[0] + h[0] * h[0] * del[1]) / (h[0] + h[1]);
    for (i = 1; i < n - 1; i++) { A.d[i + (i - 1) * n] = h[i]; A.d[i + i * n] = 2 * (h[i - 1] + h[i]); A.d[i + (i + 1) * n] = h[i - 1]; r.d[i] = 3 * (h[i] * del[i - 1] + h[i - 1] * del[i]); }
    A.d[n - 1 + (n - 2) * n] = h[n - 2] + h[n - 3]; A.d[n - 1 + (n - 1) * n] = h[n - 3]; r.d[n - 1] = (h[n - 2] * h[n - 2] * del[n - 3] + (2 * h[n - 3] + 3 * h[n - 2]) * h[n - 3] * del[n - 2]) / (h[n - 3] + h[n - 2]);
    return _.solve(A, r, null).d;
  }
  function smooth(kind, x, y, q) {
    if (x.d.length !== y.d.length) throw err("Sample points and values must have the same length.");
    if (x.d.length < 2) throw err("Interpolation requires at least two sample points.");
    var ord = x.d.map(function (v, i) { return i; }).sort(function (p, r) { return x.d[p] - x.d[r]; }), xs = ord.map(function (i) { return x.d[i]; }), ys = ord.map(function (i) { return y.d[i]; }), d = slopes(xs, ys, kind);
    return M(q.r, q.c, q.d.map(function (v) { return hermite(xs, ys, d, v); }));
  }
  def("spline", function (a) { if (a.length < 3) throw err("This runner supports spline(x, y, xq); the piecewise-polynomial form pp = spline(x, y) needs real MATLAB."); return smooth("spline", a[0], a[1], a[2]); });
  def("pchip", function (a) { if (a.length < 3) throw err("This runner supports pchip(x, y, xq)."); return smooth("pchip", a[0], a[1], a[2]); });
  var interp1 = B.interp1;
  B.interp1 = function (a, n, I) { var m = a.length > 3 && isText(a[3]) ? text(a[3]).toLowerCase() : ""; if (m === "spline") return smooth("spline", a[0], a[1], a[2]); if (m === "pchip" || m === "cubic") return smooth("pchip", a[0], a[1], a[2]); return interp1(a, n, I); };

  /* ---------- virtual file system ---------- */
  var SAMPLES = {
    "readings.csv": "Time,Voltage,Current\n0,0.00,0.000\n0.1,1.18,0.236\n0.2,2.05,0.410\n0.3,2.69,0.538\n0.4,3.16,0.632\n0.5,3.51,0.702\n",
    "data.txt": "1 2 3\n4 5 6\n7 8 9\n",
    "students.csv": "Name,Level,CGPA\nAisha,300,4.21\nBello,500,3.67\nChidi,300,3.95\nDanladi,500,4.48\nEfe,300,2.88\n",
    "notes.txt": "EE Hub sample file\nLine two\nLine three\n"
  };
  function fs(I) { if (!I.vfs) { I.vfs = {}; for (var k in SAMPLES) I.vfs[k] = SAMPLES[k]; I.fids = {}; I.nextFid = 3; } return I.vfs; }
  function fileText(I, name) { var f = fs(I)[name]; if (f === undefined) throw err("Unable to find or open '" + name + "'. Check the path and filename or file permissions. (Files here live in the page's memory: sample files are readings.csv, students.csv, data.txt and notes.txt, plus anything your code writes.)"); if (typeof f !== "string") throw err("'" + name + "' is a MAT-file; read it with load."); return f; }
  function numStr(v) { return v !== v ? "NaN" : v === Infinity ? "Inf" : v === -Infinity ? "-Inf" : String(+v.toPrecision(15)); }
  function matText(Mx, delim) { var out = ""; for (var i = 0; i < Mx.r; i++) { var r = []; for (var j = 0; j < Mx.c; j++) r.push(numStr(Mx.d[i + j * Mx.r])); out += r.join(delim) + "\n"; } return out; }
  function parseNum(txt, name) {
    var lines = txt.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; }), out = [];
    lines.forEach(function (l) { var cells = l.trim().split(/\s*[,;\t]\s*|\s+/), vals = cells.map(function (c) { return c === "" ? NaN : Number(c); }); if (vals.every(function (v, i) { return v === v || /^nan$/i.test(cells[i]); })) out.push(vals); else if (out.length) throw err("Unable to read '" + name + "': a line contains text that is not a number."); });
    if (!out.length) return _.empty(); var c = out[0].length; out.forEach(function (r) { if (r.length !== c) throw err("Unable to read '" + name + "': the rows do not all have the same number of columns."); }); return fromRows(out, c);
  }
  def("fopen", function (a, n, I) { fs(I); var name = text(a[0]), mode = a.length > 1 ? text(a[1]).replace(/[tb]/g, "") : "r"; if (mode === "r") { if (typeof I.vfs[name] !== "string") return num(-1); } else if (mode === "w") I.vfs[name] = ""; else if (mode === "a") { if (typeof I.vfs[name] !== "string") I.vfs[name] = ""; } else throw err("Invalid permission '" + mode + "'. Use 'r' (read), 'w' (write) or 'a' (append)."); var fid = I.nextFid++; I.fids[fid] = { name: name, mode: mode, pos: 0 }; return num(fid); });
  function handle(I, v, fn) { fs(I); var fid = scalar(v), h = I.fids[fid]; if (!h) throw err("Invalid file identifier. Use fopen to generate a valid file identifier. (fopen returns -1 when the file does not exist.)"); void fn; return h; }
  def("fclose", function (a, n, I) { fs(I); if (a.length && isText(a[0]) && text(a[0]) === "all") { I.fids = {}; return n > 0 ? num(0) : undefined; } var fid = scalar(a[0]); handle(I, a[0]); delete I.fids[fid]; return n > 0 ? num(0) : undefined; });
  function readLine(I, a, keep) { var h = handle(I, a[0]), t = I.vfs[h.name]; if (h.pos >= t.length) return num(-1); var e = t.indexOf("\n", h.pos), line = e < 0 ? t.slice(h.pos) : t.slice(h.pos, keep ? e + 1 : e); h.pos = e < 0 ? t.length : e + 1; return str(line.replace(/\r$/, "")); }
  def("fgetl", function (a, n, I) { return readLine(I, a, false); });
  def("fgets", function (a, n, I) { return readLine(I, a, true); });
  def("feof", function (a, n, I) { var h = handle(I, a[0]); return _.bool(h.pos >= I.vfs[h.name].length); });
  def("frewind", function (a, n, I) { handle(I, a[0]).pos = 0; });
  def("fscanf", function (a, n, I) { var h = handle(I, a[0]), rest = I.vfs[h.name].slice(h.pos), nums = (rest.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number); h.pos = I.vfs[h.name].length; return M(nums.length, 1, nums); });
  var fprintf0 = B.fprintf;
  B.fprintf = function (a, n, I, env) {
    if (a.length > 1 && a[0].t === "m" && a[0].k !== "c" && a[0].d.length === 1 && isText(a[1]) && a[0].d[0] >= 3) { var h = handle(I, a[0]); if (h.mode === "r") throw err("The file was opened for reading. Open it with fopen(name, 'w') or 'a' to write."); I.vfs[h.name] += text(B.sprintf(a.slice(1))); return undefined; }
    return fprintf0(a, n, I, env);
  };
  def("fileread", function (a, n, I) { return str(fileText(I, text(a[0]))); });
  def("type", function (a, n, I) { I.print("\n" + fileText(I, text(a[0])) + "\n"); });
  def("delete", function (a, n, I) { var nm = text(a[0]); if (fs(I)[nm] === undefined) I.warn("File '" + nm + "' not found."); delete I.vfs[nm]; });
  def("dir ls", function (a, n, I) { I.print(Object.keys(fs(I)).sort().join("  ") + "\n\n"); });
  def("pwd", function () { return str("/EEHub (files live in this page's memory)"); });
  def("isfile", function (a, n, I) { return _.bool(fs(I)[text(a[0])] !== undefined); });
  var exist0 = B.exist;
  B.exist = function (a, n, I, env) { if (isText(a[0]) && fs(I)[text(a[0])] !== undefined && !(a.length > 1 && text(a[1]) === "var")) return num(2); if (a.length > 1 && text(a[1]) === "file") return num(0); return exist0(a, n, I, env); };
  function matName(nm) { return /\.[A-Za-z0-9]+$/.test(nm) ? nm : nm + ".mat"; }
  def("save", function (a, n, I, env) {
    fs(I); var args = a.map(function (x) { return text(x); }), ascii = args.indexOf("-ascii") >= 0, names = args.filter(function (s) { return s[0] !== "-"; }), file = names.length ? names.shift() : "matlab.mat";
    if (!names.length) names = Object.keys(env.vars).filter(function (k) { return k !== "ans"; });
    names.forEach(function (k) { if (env.vars[k] === undefined) throw err("Variable '" + k + "' not found."); });
    if (ascii) { I.vfs[file] = names.map(function (k) { var v = env.vars[k]; if (v.t !== "m") throw err("Only numeric arrays can be saved as -ascii."); var o = ""; for (var i = 0; i < v.r; i++) { var r = []; for (var j = 0; j < v.c; j++) r.push("  " + _.expo(v.d[i + j * v.r], 7)); o += r.join("") + "\n"; } return o; }).join(""); return; }
    var store = {}; names.forEach(function (k) { env.vars[k].shared = true; store[k] = env.vars[k]; }); I.vfs[matName(file)] = { mat: store };
  });
  def("load", function (a, n, I, env) {
    fs(I); if (!a.length) a = [str("matlab.mat")]; var file = text(a[0]), f = I.vfs[file] !== undefined ? I.vfs[file] : I.vfs[matName(file)], want = a.slice(1).map(function (x) { return text(x); }).filter(function (s) { return s[0] !== "-"; });
    if (f === undefined) throw err("Unable to find file or directory '" + file + "'. (Files here live in the page's memory: save something first, or use a sample file such as data.txt.)");
    if (typeof f === "string") { var v = parseNum(f, file); if (n > 0) return v; env.vars[file.replace(/\.[^.]*$/, "").replace(/\W/g, "_")] = v; return undefined; }
    var keys = want.length ? want : Object.keys(f.mat); keys.forEach(function (k) { if (f.mat[k] === undefined) throw err("Variable '" + k + "' not found in " + file + "."); });
    if (n > 0) { var s = _.struct({}); keys.forEach(function (k) { s.f[k] = f.mat[k]; }); return s; }
    keys.forEach(function (k) { env.vars[k] = f.mat[k]; }); return undefined;
  });
  function delimOf(a, from) { for (var i = from; i < a.length - 1; i++) if (isText(a[i]) && /^delimiter$/i.test(text(a[i]))) { var d = text(a[i + 1]); return d === "\\t" || d === "tab" ? "\t" : d === "space" ? " " : d === "comma" ? "," : d; } return ","; }
  def("writematrix", function (a, n, I) { fs(I); if (a.length < 2) throw err("writematrix needs the matrix and a file name, e.g. writematrix(M, 'out.csv')."); if (a[0].t === "tbl") return B.writetable(a, n, I); I.vfs[text(a[1])] = matText(rmat(a[0], "writematrix"), delimOf(a, 2)); });
  def("csvwrite", function (a, n, I) { fs(I); I.vfs[text(a[0])] = matText(rmat(a[1], "csvwrite"), ","); });
  def("dlmwrite", function (a, n, I) { fs(I); I.vfs[text(a[0])] = matText(rmat(a[1], "dlmwrite"), a.length > 2 && isText(a[2]) ? (a.length > 3 && /^delimiter$/i.test(text(a[2])) ? text(a[3]) : text(a[2])).replace("\\t", "\t") : ","); });
  def("readmatrix csvread dlmread importdata", function (a, n, I) { var name = text(a[0]); return parseNum(fileText(I, name), name); });

  /* ---------- tables ---------- */
  function Tbl(names, cols) { var h = cols.length ? (cols[0].t === "c" ? cols[0].d.length : cols[0].r) : 0; cols.forEach(function (c, i) { var n = c.t === "c" ? c.d.length : c.r; if (n !== h) throw err("All table variables must have the same number of rows (variable '" + names[i] + "' has " + n + ", expected " + h + ")."); }); var seen = {}; names.forEach(function (k) { if (seen[k]) throw err("Duplicate table variable name: '" + k + "'."); seen[k] = 1; }); return { t: "tbl", names: names, cols: cols, r: h, c: names.length }; }
  function asCol(v) { if (v.t === "c") return _.cell(v.d.length, 1, v.d.slice()); if (v.t === "m") return v; if (v.t === "s") return _.cell(1, 1, [str(v.v)]); throw err("A table variable must be a numeric, logical, char or cell array."); }
  function cellText(c, i) { var v = c.t === "c" ? c.d[i] : null; if (v) return isText(v) ? "{'" + text(v) + "'}" : _.brief(v); var parts = []; for (var j = 0; j < c.c; j++) { var x = c.d[i + j * c.r]; parts.push(c.k === "l" ? (x ? "true" : "false") : fmtG(x, 5)); } return parts.join("    "); }
  function tblLines(T) {
    var out = ["  " + T.r + "×" + T.c + " table", ""], w = [], cellsTxt = [], i, j;
    for (j = 0; j < T.c; j++) { var col = [], mx = T.names[j].length; for (i = 0; i < T.r; i++) { col.push(cellText(T.cols[j], i)); mx = Math.max(mx, col[i].length); } w.push(mx); cellsTxt.push(col); }
    function centre(s, wd) { var left = Math.floor((wd - s.length) / 2); return new Array(left + 1).join(" ") + s + new Array(wd - s.length - left + 1).join(" "); }
    out.push("    " + T.names.map(function (k, q) { return centre(k, w[q]); }).join("    ").replace(/\s+$/, ""));
    out.push("    " + T.names.map(function (k, q) { return centre(new Array(Math.max(k.length, 1) + 1).join("_"), w[q]); }).join("    ").replace(/\s+$/, ""), "");
    for (i = 0; i < T.r; i++) out.push(("    " + cellsTxt.map(function (col, q) { return T.cols[q].t === "c" ? padR(col[i], w[q]) : centre(col[i], w[q]); }).join("    ")).replace(/\s+$/, ""));
    return out;
  }
  def("table", function (a, n, I) {
    var cols = [], names = [], given = null, nodes = I.lastArgNodes || [], i;
    for (i = 0; i < a.length; i++) { if (isText(a[i]) && /^variablenames$/i.test(text(a[i])) && a[i + 1] && a[i + 1].t === "c") { given = a[i + 1].d.map(function (x) { return text(x); }); i++; continue; } cols.push(asCol(a[i])); names.push(nodes[i] && nodes[i].type === "id" ? nodes[i].name : "Var" + cols.length); }
    if (given) { if (given.length !== cols.length) throw err("The VariableNames property must contain one name for each variable in the table."); names = given; }
    return Tbl(names, cols);
  });
  def("readtable", function (a, n, I) {
    var name = text(a[0]), lines = fileText(I, name).split(/\r?\n/).filter(function (l) { return l.trim() !== ""; }), split = function (l) { return l.split(/\s*,\s*|\t/).map(function (c) { return c.trim().replace(/^"(.*)"$/, "$1"); }); };
    if (!lines.length) return Tbl([], []);
    var head = split(lines[0]), data = lines.slice(1).map(split), cols = head.map(function (h, j) { var raw = data.map(function (r) { return r[j] === undefined ? "" : r[j]; }), numeric = raw.every(function (c) { return c === "" || !isNaN(Number(c)); }); return numeric ? M(raw.length, 1, raw.map(function (c) { return c === "" ? NaN : Number(c); })) : _.cell(raw.length, 1, raw.map(str)); });
    return Tbl(head.map(function (h) { return h.replace(/\W/g, "_"); }), cols);
  });
  def("writetable", function (a, n, I) { fs(I); var T = a[0]; if (T.t !== "tbl") throw err("writetable needs a table."); var out = T.names.join(",") + "\n"; for (var i = 0; i < T.r; i++) out += T.cols.map(function (c) { return c.t === "c" ? text(c.d[i]) : numStr(c.d[i]); }).join(",") + "\n"; I.vfs[a.length > 1 ? text(a[1]) : "T.txt"] = out; });
  def("height", function (a) { return num(a[0].t === "tbl" ? a[0].r : (a[0].r || 1)); });
  def("width", function (a) { return num(a[0].t === "tbl" ? a[0].c : (a[0].c || 1)); });
  def("istable", function (a) { return _.bool(a[0].t === "tbl"); });
  def("table2array", function (a) { var T = a[0]; if (T.t !== "tbl") throw err("table2array needs a table."); T.cols.forEach(function (c) { if (c.t !== "m") throw err("table2array needs every variable to be numeric."); }); return _.catRows([T.cols]); });
  def("array2table", function (a) { var A = rmat(a[0], "array2table"), cols = [], names = [], given = null; for (var j = 0; j < A.c; j++) { cols.push(_.indexGet(A, [_.COLON, num(j + 1)])); names.push("Var" + (j + 1)); } for (var i = 1; i < a.length - 1; i++) if (isText(a[i]) && /^variablenames$/i.test(text(a[i]))) given = a[i + 1].d.map(function (x) { return text(x); }); return Tbl(given || names, cols); });
  function rowsOf(T, idx) { return Tbl(T.names.slice(), T.cols.map(function (c) { return _.indexGet(c, [idx, _.COLON]); })); }
  function colIndex(T, v) { if (v === _.COLON || (isText(v) && text(v) === ":")) return T.names.map(function (k, i) { return i; }); if (isText(v)) v = _.cell(1, 1, [v]); if (v.t === "c") return v.d.map(function (x) { var k = T.names.indexOf(text(x)); if (k < 0) throw err("Unrecognized table variable name '" + text(x) + "'."); return k; }); if (v.k === "l") { var o = []; v.d.forEach(function (b, i) { if (b) o.push(i); }); return o; } return v.d.map(function (x) { if (x < 1 || x > T.c || x !== Math.floor(x)) throw err("Variable index exceeds table dimensions."); return x - 1; }); }
  function sortOrder(vals, desc, isStr) { var ord = vals.map(function (v, i) { return i; }); ord.sort(function (p, q) { var x = vals[p], y = vals[q], c = isStr ? (x < y ? -1 : x > y ? 1 : 0) : x - y; return (desc ? -c : c) || p - q; }); return ord; }
  def("sortrows", function (a, nargout) {
    var X = a[0], desc = a.some(function (v) { return isText(v) && /^descend$/i.test(text(v)); });
    if (X.t === "tbl") { var j = a.length > 1 && !/^(a|de)scend$/i.test(isText(a[1]) ? text(a[1]) : "x") ? colIndex(X, a[1])[0] : 0, c = X.cols[j], ord = sortOrder(c.t === "c" ? c.d.map(text) : c.d.slice(0, X.r), desc, c.t === "c"), idx = M(ord.length, 1, ord.map(function (k) { return k + 1; })); return nargout > 1 ? [rowsOf(X, idx), idx] : rowsOf(X, idx); }
    rmat(X, "sortrows"); var col = a.length > 1 && a[1].t === "m" ? a[1].d[0] : 1; if (col < 0) { desc = true; col = -col; }
    var o2 = sortOrder(X.d.slice((col - 1) * X.r, col * X.r), desc, false), id2 = M(o2.length, 1, o2.map(function (k) { return k + 1; })), res = _.indexGet(X, [id2, _.COLON]); return nargout > 1 ? [res, id2] : res;
  });
  def("head", function (a) { var T = a[0], k = Math.min(a.length > 1 ? scalar(a[1]) : 8, T.r); return T.t === "tbl" ? rowsOf(T, _.range(1, 1, k)) : _.indexGet(T, [_.range(1, 1, k), _.COLON]); });
  def("varfun", function (a, n, I) { var f = a[0], T = a[1]; if (!T || T.t !== "tbl") throw err("varfun needs a function handle and a table, e.g. varfun(@mean, T)."); var keep = [], cols = []; T.cols.forEach(function (c, j) { if (c.t !== "m") return; keep.push((f.name ? f.name : "Fun") + "_" + T.names[j]); cols.push(I.feval(f, [c], 1)[0]); }); return Tbl(keep, cols); });
  MLab.Interp.ext.extra = function (I) {
    I.ext.display.tbl = function (T) { return tblLines(T); };
    I.ext.getField = I.ext.getField || {}; I.ext.setField = I.ext.setField || {}; I.ext.index = I.ext.index || {};
    I.ext.getField.tbl = function (T, f) { var k = T.names.indexOf(f); if (k >= 0) return T.cols[k]; if (f === "Properties") return _.struct({ VariableNames: _.cell(1, T.c, T.names.map(str)), Description: str("") }); throw err("Unrecognized table variable name '" + f + "'."); };
    I.ext.setField.tbl = function (T, f, rhs) { var col = asCol(rhs), n = col.t === "c" ? col.d.length : col.r; if (col.t === "m" && n === 1 && col.c === 1 && T.r > 1) { col = M(T.r, 1, new Array(T.r).fill(col.d[0])); n = T.r; } if (T.c && n !== T.r) throw err("To assign to or create a variable in a table, the number of rows must match the height of the table."); var k = T.names.indexOf(f), names = T.names.slice(), cols = T.cols.slice(); if (k >= 0) cols[k] = col; else { names.push(f); cols.push(col); } return Tbl(names, cols); };
    I.ext.index.tbl = function (T, args) { if (args.length !== 2) throw err("Subscripting into a table using one subscript (as in t(i)) is not supported. Specify a row subscript and a variable subscript, as in t(rows,vars)."); var ci = colIndex(T, args[1]), sub = Tbl(ci.map(function (j) { return T.names[j]; }), ci.map(function (j) { return T.cols[j]; })); return rowsOf(sub, args[0]); };
    /* state-space */
    I.ext.display.ss = function (S) { return ssLines(S); };
    I.ext.getField.ss = function (S, f) { var k = f.toUpperCase(); if (k === "A" || k === "B" || k === "C" || k === "D") return S[k]; if (k === "TS") return num(S.Ts || 0); throw err("State-space models here have the properties A, B, C, D and Ts."); };
    I.ext.binop.ss = function (op, a, b) { var h = I.ext.binop.tf; return h(op, a.t === "ss" ? ss2tf(a) : a, b.t === "ss" ? ss2tf(b) : b, I); };
    var tfb = I.ext.binop.tf, tfd = I.ext.display.tf, tfg = I.ext.getField.tf;
    I.ext.binop.tf = function (op, a, b) { if (a.t === "ss" || b.t === "ss") return I.ext.binop.ss(op, a, b); var Ta = a.t === "tf" ? a.Ts || 0 : -1, Tb = b.t === "tf" ? b.Ts || 0 : -1; if (Ta >= 0 && Tb >= 0 && Ta !== Tb) throw err("Sample times must agree: you cannot combine a continuous-time and a discrete-time model, or models with different sample times."); var r = tfb(op, a, b); var Ts = Math.max(Ta, Tb); if (Ts > 0) r.Ts = Ts; return r; };
    I.ext.display.tf = function (G) { var L = tfd(G); if (!G.Ts) return L; L = L.map(function (s) { return /^ *-+$/.test(s) ? s : s.replace(/\bs\b/g, "z"); }); L[L.length - 1] = "Sample time: " + fmtG(G.Ts, 5) + " seconds"; L.push("Discrete-time transfer function."); return L; };
    I.ext.getField.tf = function (G, f) { if (f.toLowerCase() === "ts") return num(G.Ts || 0); if (f.toLowerCase() === "variable") return str(G.Ts ? "z" : "s"); return tfg(G, f); };
  };

  /* ---------- state space ---------- */
  function SS(A, Bm, C, D, Ts) { var n = A.r; if (A.r !== A.c) throw err("The \"A\" matrix must be square."); if (Bm.r !== n) throw err("The \"A\" and \"B\" matrices must have the same number of rows."); if (C.c !== n) throw err("The \"A\" and \"C\" matrices must have the same number of columns."); if (D.r !== C.r || D.c !== Bm.c) throw err("The \"D\" matrix must have as many rows as \"C\" and as many columns as \"B\"."); var o = { t: "ss", A: A, B: Bm, C: C, D: D }; if (Ts) o.Ts = Ts; return o; }
  function charPoly(A) { var n = A.r, c = [1], Mk = _.zeros(n, n), k, i; for (k = 1; k <= n; k++) { var T = mm(A, Mk); for (i = 0; i < n; i++) T.d[i + i * n] += c[k - 1]; Mk = T; var AM = mm(A, Mk), trc = 0; for (i = 0; i < n; i++) trc += AM.d[i + i * n]; c.push(-trc / k); } return c; }
  function siso(S, name) { if (S.B.c !== 1 || S.C.r !== 1) throw err((name || "This function") + " supports single-input single-output models in the browser runner; MIMO models need real MATLAB.", "EEHub:realMatlabOnly"); }
  function ss2tf(S) { siso(S, "Converting to a transfer function"); var n = S.A.r, den = charPoly(S.A), BC = mm(S.B, S.C), Acl = M(n, n, S.A.d.map(function (v, i) { return v - BC.d[i]; })), p2 = charPoly(Acl), d = S.D.d[0], nm = den.map(function (v, i) { return clean(p2[i] - v + d * v); }); var G = B.tf([_.rowv(nm), _.rowv(den.map(clean))]); if (S.Ts) G.Ts = S.Ts; return G; }
  function tf2ss(G) { // controllable canonical form, as MATLAB's tf2ss
    var den = G.den.slice(), nm = G.num.slice(); if (nm.length > den.length) throw err("The transfer function is improper, so it has no state-space form."); while (nm.length < den.length) nm.unshift(0); var a0 = den[0]; den = den.map(function (v) { return v / a0; }); nm = nm.map(function (v) { return v / a0; });
    var n = den.length - 1, A = _.zeros(n, n), Bm = _.zeros(n, 1), C = _.zeros(1, n), i; if (n === 0) return SS(_.zeros(0, 0), _.zeros(0, 1), _.zeros(1, 0), num(nm[0]), G.Ts);
    for (i = 0; i < n; i++) A.d[0 + i * n] = -den[i + 1]; for (i = 1; i < n; i++) A.d[i + (i - 1) * n] = 1; Bm.d[0] = 1; for (i = 0; i < n; i++) C.d[i] = nm[i + 1] - nm[0] * den[i + 1];
    return SS(A, Bm, C, num(nm[0]), G.Ts);
  }
  function asSS(v, name) { if (v && v.t === "ss") return v; if (v && v.t === "tf") return tf2ss(v); throw err((name || "This function") + " needs a state-space or transfer-function model."); }
  function grid(Mx, rl, cl) { var w = 4, i, j, cells = []; for (i = 0; i < Mx.r; i++) { cells.push([]); for (j = 0; j < Mx.c; j++) { var s = fmtG(Mx.d[i + j * Mx.r], 4); cells[i].push(s); w = Math.max(w, s.length + 2); } } var out = ["       " + cl.map(function (c) { return pad(c, w); }).join("").replace(/^ {4}/, "")]; out[0] = "     " + cl.map(function (c) { return pad(c, w); }).join(""); for (i = 0; i < Mx.r; i++) out.push("   " + rl[i] + cells[i].map(function (s) { return pad(s, w); }).join("")); return out; }
  function ssLines(S) { var n = S.A.r, x = [], u = [], y = [], i; for (i = 1; i <= n; i++) x.push("x" + i); for (i = 1; i <= S.B.c; i++) u.push("u" + i); for (i = 1; i <= S.C.r; i++) y.push("y" + i); var L = []; [["A", S.A, x, x], ["B", S.B, x, u], ["C", S.C, y, x], ["D", S.D, y, u]].forEach(function (q) { L.push("  " + q[0] + " = "); L = L.concat(grid(q[1], q[2], q[3])); L.push(""); }); if (S.Ts) L.push("Sample time: " + fmtG(S.Ts, 5) + " seconds"); L.push(S.Ts ? "Discrete-time state-space model." : "Continuous-time state-space model."); return L; }
  def("ss", function (a) { if (a.length === 1 && a[0].t === "tf") return tf2ss(a[0]); if (a.length === 1 && a[0].t === "ss") return a[0]; if (a.length < 4) throw err("ss needs four matrices: ss(A, B, C, D)."); return SS(rmat(a[0], "ss"), rmat(a[1], "ss"), rmat(a[2], "ss"), rmat(a[3], "ss"), a.length > 4 ? scalar(a[4]) : 0); });
  def("tf2ss", function (a) { var S = tf2ss(B.tf([a[0], a[1]])); return [S.A, S.B, S.C, S.D]; });
  def("ss2tf", function (a) { var G = ss2tf(SS(rmat(a[0], "ss2tf"), rmat(a[1], "ss2tf"), rmat(a[2], "ss2tf"), rmat(a[3], "ss2tf"))), nm = G.num.slice(); while (nm.length < G.den.length) nm.unshift(0); return [_.rowv(nm), _.rowv(G.den)]; });
  def("ssdata", function (a) { var S = asSS(a[0], "ssdata"); return [S.A, S.B, S.C, S.D]; });
  def("ctrb", function (a) { var A = a[0].t === "ss" ? a[0].A : rmat(a[0], "ctrb"), Bm = a[0].t === "ss" ? a[0].B : rmat(a[1], "ctrb"), blocks = [Bm], i; for (i = 1; i < A.r; i++) blocks.push(mm(A, blocks[i - 1])); return _.catRows([blocks]); });
  def("obsv", function (a) { var A = a[0].t === "ss" ? a[0].A : rmat(a[0], "obsv"), C = a[0].t === "ss" ? a[0].C : rmat(a[1], "obsv"), blocks = [C], i; for (i = 1; i < A.r; i++) blocks.push(mm(blocks[i - 1], A)); return _.catRows(blocks.map(function (b) { return [b]; })); });
  def("acker place", function (a, nargout, I) {
    var A = rmat(a[0], "acker"), Bm = rmat(a[1], "acker"), p = a[2], n = A.r; if (Bm.c !== 1) throw err("Pole placement for multi-input systems needs real MATLAB (this runner uses Ackermann's formula for single-input systems).", "EEHub:realMatlabOnly"); if (p.d.length !== n) throw err("You must specify " + n + " closed-loop pole(s), one per state.");
    var coef = B.poly([p]).d, Cm = B.ctrb([A, Bm]), phi = _.zeros(n, n), Ak = _.eye(n), k; if (Math.abs(B.det([Cm]).d[0]) < 1e-12) throw err("The system is not controllable, so its poles cannot be placed.");
    for (k = n; k >= 0; k--) { phi = M(n, n, phi.d.map(function (v, i) { return v + coef[k] * Ak.d[i]; })); Ak = mm(Ak, A); }
    var last = _.zeros(1, n); last.d[n - 1] = 1; return mm(mm(last, _.solve(Cm, _.eye(n), I)), phi);
  });
  var wrapSys = function (name, pre) { var f0 = B[name]; if (!f0) return; B[name] = function (a, n, I, env) { return f0(a.map(function (v) { return v && v.t === "ss" ? ss2tf(v) : v; }).map(pre || function (v) { return v; }), n, I, env); }; };
  ["tfdata", "zero", "dcgain", "bode", "margin", "rlocus", "nyquist", "stepinfo", "feedback", "series", "parallel", "minreal", "pzmap", "damp", "impulse", "lsim", "order", "bodemag", "evalfr", "freqresp"].forEach(function (nm) { wrapSys(nm); });
  var tf0 = B.tf; B.tf = function (a, n, I) { if (a.length === 1 && a[0].t === "ss") return ss2tf(a[0]); if (a.length === 2 && isText(a[0]) && text(a[0]) === "z") { var z = tf0([_.rowv([1, 0]), _.rowv([1])], n, I); z.Ts = scalar(a[1]); return z; } if (a.length === 3 && a[0].t === "m" && a[1].t === "m") { var G = tf0(a.slice(0, 2), n, I), Ts = scalar(a[2]); if (!(Ts > 0)) throw err("The sample time must be a positive number."); G.Ts = Ts; return G; } return tf0(a, n, I); };
  var pole0 = B.pole; B.pole = function (a, n, I) { if (a[0] && a[0].t === "ss") return B.eig([a[0].A], 1, I); return pole0(a, n, I); };
  var stable0 = B.isstable; B.isstable = function (a, n, I) { var G = a[0] && a[0].t === "ss" ? ss2tf(a[0]) : a[0]; if (G && G.Ts) return _.bool(_.polyRoots(G.den).every(function (p) { return Math.hypot(p.re, p.im) < 1; })); return stable0([G], n, I); };
  function dsim(G, N, input) { var nm = G.num.slice(); while (nm.length < G.den.length) nm.unshift(0); var u = []; for (var k = 0; k < N; k++) u.push(input(k)); return B.filter([_.rowv(nm), _.rowv(G.den), _.rowv(u)]).d; }
  function dHorizon(G) { var r = 0; _.polyRoots(G.den).forEach(function (p) { var m = Math.hypot(p.re, p.im); if (m < 1 - 1e-9) r = Math.max(r, m); }); return Math.max(10, Math.min(400, r ? Math.ceil(Math.log(0.005) / Math.log(r)) : 20)); }
  var step0 = B.step;
  B.step = function (a, nargout, I, env) {
    a = a.map(function (v) { return v && v.t === "ss" ? ss2tf(v) : v; }); var G = a[0];
    if (!G || G.t !== "tf" || !G.Ts) return step0(a, nargout, I, env);
    var tEnd = a.length > 1 && a[1].t === "m" ? scalar(a[1]) : dHorizon(G) * G.Ts, N = Math.round(tEnd / G.Ts) + 1, y = dsim(G, N, function () { return 1; }), t = y.map(function (v, k) { return k * G.Ts; });
    if (nargout > 0) return [M(N, 1, y), M(N, 1, t)];
    B.stairs([_.rowv(t), _.rowv(y)], 0, I); var ax = MLab.plotHelpers.ax(I); ax.title = "Step Response"; ax.xlabel = "Time (seconds)"; ax.ylabel = "Amplitude"; return undefined;
  };
  B.dstep = function (a, nargout, I, env) { var G = B.tf([a[0], a[1], num(1)], 1, I), N = a.length > 2 ? scalar(a[2]) : dHorizon(G), y = dsim(G, N, function () { return 1; }); if (nargout > 0) return M(N, 1, y); B.stairs([_.rowv(y.map(function (v, k) { return k; })), _.rowv(y)], 0, I); return undefined; };
  def("initial", function (a, nargout, I) {
    var S = asSS(a[0], "initial"), x0 = rmat(a[1], "initial"), n = S.A.r; if (x0.d.length !== n) throw err("The initial condition must have " + n + " element(s), one per state."); siso({ B: _.zeros(n, 1), C: S.C }, "initial");
    var ev = B.eig([S.A], 1, I), slow = Infinity, osc = 0; ev.d.forEach(function (re, i) { if (re < -1e-9) slow = Math.min(slow, -re); if (ev.im && ev.im[i]) osc = Math.max(osc, Math.abs(ev.im[i])); });
    var tf = a.length > 2 ? scalar(a[2]) : (isFinite(slow) ? 7 / slow : osc ? 10 * Math.PI / osc : 10), N = 300, E = expm(M(n, n, S.A.d.map(function (v) { return v * tf / N; }))), x = M(n, 1, x0.d.slice()), t = [], y = [];
    for (var k = 0; k <= N; k++) { t.push(k * tf / N); y.push(mm(S.C, x).d[0]); x = mm(E, x); }
    if (nargout > 0) return [M(N + 1, 1, y), M(N + 1, 1, t)];
    B.plot([_.rowv(t), _.rowv(y)], 0, I); var ax = MLab.plotHelpers.ax(I); ax.title = "Response to Initial Conditions"; ax.xlabel = "Time (seconds)"; ax.ylabel = "Amplitude"; return undefined;
  });
  function pscale(p, k) { return p.map(function (v) { return v * k; }); }
  function padd(a, b) { var n = Math.max(a.length, b.length), o = new Array(n).fill(0); a.forEach(function (v, i) { o[n - a.length + i] += v; }); b.forEach(function (v, i) { o[n - b.length + i] += v; }); return o; }
  def("c2d", function (a, nargout, I) {
    if (a.length < 2) throw err("c2d needs the model and the sample time: c2d(G, Ts)."); var Ts = scalar(a[1]), method = a.length > 2 ? text(a[2]).toLowerCase() : "zoh", wasSS = a[0].t === "ss"; if (!(Ts > 0)) throw err("The sample time must be a positive number.");
    if (a[0].Ts) throw err("The model is already discrete-time.");
    if (method === "tustin") {
      var G = wasSS ? ss2tf(a[0]) : a[0]; if (G.t !== "tf") throw err("c2d needs a transfer function or state-space model."); var n = G.den.length - 1, nm = G.num.slice(); while (nm.length < n + 1) nm.unshift(0);
      var sub = function (p) { var out = [0]; p.forEach(function (c, i) { var k = n - i, term = [c * Math.pow(2 / Ts, k)], q; for (q = 0; q < k; q++) term = _.conv(term, [1, -1]); for (q = 0; q < n - k; q++) term = _.conv(term, [1, 1]); out = padd(out, term); }); return out; };
      var N2 = sub(nm), D2 = sub(G.den), d0 = D2[0], R = B.tf([_.rowv(pscale(N2, 1 / d0).map(clean)), _.rowv(pscale(D2, 1 / d0).map(clean))], 1, I); R.Ts = Ts; return wasSS ? tf2ss(R) : R;
    }
    if (method !== "zoh") throw err("c2d method '" + method + "' is not supported by the browser runner ('zoh' and 'tustin' are).", "EEHub:realMatlabOnly");
    var S = asSS(a[0], "c2d"), ns = S.A.r, aug = _.zeros(ns + 1, ns + 1), i, j; for (i = 0; i < ns; i++) { for (j = 0; j < ns; j++) aug.d[i + j * (ns + 1)] = S.A.d[i + j * ns] * Ts; aug.d[i + ns * (ns + 1)] = S.B.d[i] * Ts; }
    siso(S, "c2d"); var E = expm(aug), Ad = _.zeros(ns, ns), Bd = _.zeros(ns, 1); for (i = 0; i < ns; i++) { for (j = 0; j < ns; j++) Ad.d[i + j * ns] = E.d[i + j * (ns + 1)]; Bd.d[i] = E.d[i + ns * (ns + 1)]; }
    var Sd = SS(Ad, Bd, S.C, S.D, Ts); if (wasSS) return Sd; var Gd = ss2tf(Sd); Gd.num = Gd.num.map(function (v) { return Math.abs(v) < 1e-12 ? 0 : v; }); while (Gd.num.length > 1 && Gd.num[0] === 0) Gd.num.shift(); return Gd;
  });
  return MLab;
});
