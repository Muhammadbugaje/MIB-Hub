/* EE Hub MATLAB-compatible runner: plotting. The plot commands build a small figure model on the interpreter;
   MLab.plotSVG(figure) turns one figure into an SVG string (works in Node for tests, themed with CSS variables in the page). */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./mlab.js")); else factory(root.MLab); })(typeof self !== "undefined" ? self : this, function (MLab) {
  "use strict";
  var _ = MLab._, B = MLab.B, err = _.err, text = _.text, isText = _.isText, num = _.num, scalar = _.scalar, M = _.M;
  var ORDER = ["#0072BD", "#D95319", "#EDB120", "#7E2F8E", "#77AC30", "#4DBEEE", "#A2142F"];
  var COLS = { r: "#e02020", g: "#1faa2c", b: "#1f4fe0", c: "#00b5c8", m: "#d020d0", y: "#d8c400", k: "var(--mlp-ink, #111)", w: "var(--mlp-bg, #fff)", red: "#e02020", green: "#1faa2c", blue: "#1f4fe0", cyan: "#00b5c8", magenta: "#d020d0", yellow: "#d8c400", black: "var(--mlp-ink, #111)", white: "var(--mlp-bg, #fff)" };

  function fig(I) { if (!I.fig) { I.fig = { axes: [], cur: null, id: I.figs.length + 1 }; I.figs.push(I.fig); } return I.fig; }
  function newAxes(m, n, p) { return { m: m, n: n, p: p, series: [], hold: false, title: "", xlabel: "", ylabel: "", zlabel: "", legend: null, grid: false, xlim: null, ylim: null, zlim: null, xlog: false, ylog: false, equal: false, is3d: false, texts: [], ci: 0, off: false, polar: false }; }
  function ax(I) { var f = fig(I); if (!f.cur) { f.cur = newAxes(1, 1, 1); f.axes.push(f.cur); } return f.cur; }
  function fresh(I) { var a = ax(I); if (!a.hold) { var keep = { m: a.m, n: a.n, p: a.p }, b = newAxes(keep.m, keep.n, keep.p); for (var k in b) a[k] = b[k]; } return a; }
  function color(v) {
    if (isText(v)) { var s = text(v).toLowerCase(); if (COLS[s]) return COLS[s]; if (/^#[0-9a-f]{6}$/.test(s)) return s; if (s === "none") return "none"; throw err("Invalid color '" + text(v) + "'. Use a letter such as 'r', a name such as 'red', a hex code or an [r g b] triple."); }
    if (v.t === "m" && v.d.length === 3) return "rgb(" + v.d.map(function (x) { return Math.round(Math.max(0, Math.min(1, x)) * 255); }).join(",") + ")";
    throw err("A color must be a letter ('r'), a name ('red') or an [r g b] triple with values from 0 to 1.");
  }
  function parseSpec(s) {
    var o = { color: null, ls: null, marker: null }, rest = s;
    var m;
    if ((m = rest.match(/--|-\.|:|-/))) { o.ls = m[0]; rest = rest.replace(m[0], ""); }
    if ((m = rest.match(/[rgbcmykw]/))) { o.color = COLS[m[0]]; rest = rest.replace(m[0], ""); }
    if ((m = rest.match(/[o+*.xsd^v<>ph]/))) { o.marker = m[0]; rest = rest.replace(m[0], ""); }
    if (rest.length) return null;
    return o;
  }
  var NV = { linewidth: 1, color: 1, markersize: 1, markerfacecolor: 1, markeredgecolor: 1, linestyle: 1, marker: 1, displayname: 1, markerindices: 1, facecolor: 1, edgecolor: 1, facealpha: 1, barwidth: 1, filled: 0, fontsize: 1, fontweight: 1, interpreter: 1, location: 1, orientation: 1, linejoin: 1, handlevisibility: 1, normalization: 1, binwidth: 1, numbins: 1 };
  function applyNV(s, args, i) {
    for (; i < args.length; i += 2) {
      if (!isText(args[i])) throw err("Expected a property name (such as 'LineWidth') but got a " + _.className(args[i]) + ".");
      var k = text(args[i]).toLowerCase(), v = args[i + 1];
      if (k === "filled") { s.filled = true; i--; continue; }
      if (NV[k] === undefined) throw err("Unrecognized property '" + text(args[i]) + "' for this plot. Check the spelling (for example 'LineWidth', 'Color', 'MarkerSize', 'DisplayName').");
      if (v === undefined) throw err("Property '" + text(args[i]) + "' needs a value after it.");
      if (k === "linewidth") s.lw = scalar(v); else if (k === "color" || k === "facecolor") s.color = color(v); else if (k === "markersize") s.ms = scalar(v);
      else if (k === "markerfacecolor") s.mfc = isText(v) && text(v) === "auto" ? "auto" : color(v); else if (k === "linestyle") s.ls = text(v) === "none" ? "none" : text(v); else if (k === "marker") s.marker = text(v) === "none" ? null : text(v);
      else if (k === "displayname") s.name = text(v); else if (k === "markeredgecolor") s.mec = color(v); else if (k === "facealpha") s.alpha = scalar(v);
    }
  }
  function nums(v, what) { if (!v || v.t !== "m") throw err((what || "Plot data") + " must be numeric."); return v; }
  function linePlot(args, I, opt) {
    opt = opt || {}; var a = fresh(I), i = 0, groups = [];
    if (!args.length) throw err("Not enough input arguments. plot needs data, e.g. plot(x, y).");
    if (opt.xlog !== undefined) { a.xlog = opt.xlog; a.ylog = opt.ylog; }
    while (i < args.length) {
      if (isText(args[i])) break;
      var X = nums(args[i]), Y = null, spec = null; i++;
      if (i < args.length && !isText(args[i])) { Y = nums(args[i]); i++; }
      if (i < args.length && isText(args[i])) { var sp = parseSpec(text(args[i])); if (sp) { spec = sp; i++; } else if (NV[text(args[i]).toLowerCase()] === undefined) throw err("Invalid line specification or property name '" + text(args[i]) + "'. A line spec combines a colour (r g b c m y k), a marker (o + * . x s d ^) and a style (- -- : -.), e.g. 'r--o'."); }
      groups.push({ X: X, Y: Y, spec: spec });
    }
    var made = [];
    groups.forEach(function (g) {
      var X = g.X, Y = g.Y, cols = [];
      if (!Y) { if (X.im) { Y = M(X.r, X.c, X.im); X = M(X.r, X.c, X.d); } else { Y = X; X = null; } }
      var xlen = X && (X.r === 1 || X.c === 1) ? X.d.length : -1;
      if (Y.r === 1 || Y.c === 1) cols.push(Y.d.slice());
      else if (xlen > 0 && Y.r !== xlen && Y.c === xlen) { for (var q = 0; q < Y.r; q++) { var rw = []; for (var j2 = 0; j2 < Y.c; j2++) rw.push(Y.d[q + j2 * Y.r]); cols.push(rw); } }
      else for (var j = 0; j < Y.c; j++) cols.push(Y.d.slice(j * Y.r, (j + 1) * Y.r));
      cols.forEach(function (yc, j) {
        var xc;
        if (!X) xc = yc.map(function (q, k) { return k + 1; });
        else if (X.r === 1 || X.c === 1) xc = X.d.slice(); else xc = X.d.slice(j * X.r, (j + 1) * X.r);
        if (xc.length !== yc.length) throw err("Vectors must be the same length. (x has " + xc.length + " elements but y has " + yc.length + ".)");
        var s = { type: opt.type || "line", x: xc, y: yc, color: null, ls: "-", marker: null, lw: opt.lw || 1.2, ms: 6, name: "" };
        if (g.spec) { if (g.spec.color) s.color = g.spec.color; s.marker = g.spec.marker; s.ls = g.spec.ls || (g.spec.marker ? "none" : "-"); }
        if (!s.color) { s.color = ORDER[a.ci % ORDER.length]; a.ci++; }
        made.push(s); a.series.push(s);
      });
    });
    made.forEach(function (s) { applyNV(s, args, i); });
    return made;
  }
  B.plot = function (a, n, I) { linePlot(a, I); };
  B.line = function (a, n, I) { var x = ax(I), h = x.hold; x.hold = true; linePlot(a, I); x.hold = h; };
  B.semilogx = function (a, n, I) { linePlot(a, I, { xlog: true, ylog: false }); };
  B.semilogy = function (a, n, I) { linePlot(a, I, { xlog: false, ylog: true }); };
  B.loglog = function (a, n, I) { linePlot(a, I, { xlog: true, ylog: true }); };
  B.stairs = function (a, n, I) { linePlot(a, I, { type: "stairs" }); };
  B.stem = function (a, n, I) { var filled = false; a = a.filter(function (x) { if (isText(x) && text(x) === "filled") { filled = true; return false; } return true; }); linePlot(a, I, { type: "stem" }).forEach(function (s) { if (!s.marker) s.marker = "o"; if (filled) s.mfc = "auto"; }); };
  B.area = function (a, n, I) { linePlot(a, I, { type: "area" }); };
  B.scatter = function (a, n, I) {
    var args = a.slice(), filled = false, x = args.shift(), y = args.shift(), size = null, col = null;
    if (!x || !y) throw err("scatter needs x and y data.");
    if (args.length && !isText(args[0])) { size = args.shift(); }
    if (args.length && (!isText(args[0]) || parseSpec(text(args[0])) || COLS[text(args[0]).toLowerCase()])) { var c = args.shift(); if (!(c.t === "m" && c.d.length !== 3 && c.k !== "c")) col = c; }
    args = args.filter(function (v) { if (isText(v) && text(v) === "filled") { filled = true; return false; } return true; });
    var s = linePlot([x, y, _.str("o")], I)[0]; s.type = "scatter"; if (col) s.color = isText(col) && parseSpec(text(col)) ? parseSpec(text(col)).color : color(col); if (size && size.d.length) s.ms = Math.max(2, Math.sqrt(size.d[0]) * 1.1); if (filled) s.mfc = "auto"; applyNV(s, args, 0);
  };
  B.plot3 = function (a, n, I) { var x = fresh(I); if (a.length < 3) throw err("plot3 needs x, y and z."); var X = nums(a[0]), Y = nums(a[1]), Z = nums(a[2]), i = 3, s = { type: "line3", x: X.d.slice(), y: Y.d.slice(), z: Z.d.slice(), color: ORDER[x.ci++ % 7], ls: "-", lw: 1.2, marker: null, ms: 6, name: "" }; if (a[3] && isText(a[3]) && parseSpec(text(a[3]))) { var sp = parseSpec(text(a[3])); if (sp.color) s.color = sp.color; s.marker = sp.marker; s.ls = sp.ls || (sp.marker ? "none" : "-"); i = 4; } applyNV(s, a, i); x.is3d = true; x.series.push(s); };
  function grid3(a, name) {
    var X, Y, Z, i;
    if (a.length >= 3 && !isText(a[1]) && !isText(a[2])) { X = nums(a[0]); Y = nums(a[1]); Z = nums(a[2]); } else { Z = nums(a[0]); X = null; }
    var r = Z.r, c = Z.c, xs = new Array(r * c), ys = new Array(r * c);
    if (r < 2 || c < 2) throw err(name + " needs Z to be a matrix (at least 2-by-2). Build X and Y with meshgrid.");
    for (var j = 0; j < c; j++) for (i = 0; i < r; i++) { xs[i + j * r] = !X ? j + 1 : X.d.length === c && (X.r === 1 || X.c === 1) ? X.d[j] : X.d[i + j * r]; ys[i + j * r] = !X ? i + 1 : Y.d.length === r && (Y.r === 1 || Y.c === 1) ? Y.d[i] : Y.d[i + j * r]; }
    if (X && X.d.length !== r * c && !(X.d.length === c && Y.d.length === r)) throw err(name + ": X, Y and Z must be the same size (use [X, Y] = meshgrid(x, y)).");
    return { r: r, c: c, x: xs, y: ys, z: Z.d.slice() };
  }
  B.surf = B.surfc = B.surfl = function (a, n, I) { var x = fresh(I), g = grid3(a, "surf"); g.type = "surf"; x.is3d = true; x.series.push(g); };
  B.mesh = B.meshc = B.waterfall = function (a, n, I) { var x = fresh(I), g = grid3(a, "mesh"); g.type = "surf"; g.mesh = true; x.is3d = true; x.series.push(g); };
  B.contour = B.contourf = B.contour3 = function (a, n, I) { var x = fresh(I), g = grid3(a.filter(function (v, i) { return !(i === (a.length === 2 ? 1 : 3)); }), "contour"), lv = a.length === 2 ? a[1] : a[3]; g.type = "contour"; g.levels = lv && lv.t === "m" ? (lv.d.length === 1 ? lv.d[0] : lv.d.slice()) : 9; x.series.push(g); };
  B.imagesc = B.pcolor = B.image = function (a, n, I) { var x = fresh(I), g = grid3([a[a.length >= 3 ? 2 : 0]], "imagesc"); g.type = "image"; x.series.push(g); x.ydir = "reverse"; };
  B.bar = function (a, n, I) {
    var x = fresh(I), args = a.slice(), X = null, Y, col = null; if (!args.length) throw err("bar needs data.");
    if (args.length >= 2 && !isText(args[1]) && args[1].d.length > 1) { X = nums(args.shift()); } Y = nums(args.shift());
    if (args.length && !isText(args[0])) args.shift(); // width
    if (args.length && isText(args[0]) && (parseSpec(text(args[0])) || COLS[text(args[0])])) col = color(args.shift());
    var cols = []; if (Y.r === 1 || Y.c === 1) cols.push(Y.d.slice()); else for (var j = 0; j < Y.c; j++) cols.push(Y.d.slice(j * Y.r, (j + 1) * Y.r));
    cols.forEach(function (yc, j) { var s = { type: "bar", x: X ? X.d.slice() : yc.map(function (q, k) { return k + 1; }), y: yc, color: col || ORDER[x.ci++ % 7], group: j, groups: cols.length, name: "" }; if (s.x.length !== yc.length) throw err("bar: X and Y must have the same length."); applyNV(s, args, 0); x.series.push(s); });
  };
  B.histogram = B.hist = function (a, n, I) {
    var args = a.slice(), data = nums(args.shift(), "histogram data"), nb = null, edges = null, i;
    if (args.length && !isText(args[0])) { var b = args.shift(); if (b.d.length === 1) nb = b.d[0]; else edges = b.d.slice(); }
    var d = data.d.filter(function (v) { return isFinite(v); }), lo = Math.min.apply(null, d), hi = Math.max.apply(null, d);
    for (i = 0; i < args.length - 1; i++) if (isText(args[i]) && /^numbins$/i.test(text(args[i]))) nb = scalar(args[i + 1]);
    if (!edges) { if (!nb) nb = Math.max(1, Math.min(60, Math.ceil(Math.sqrt(d.length)))); if (lo === hi) { lo -= 0.5; hi += 0.5; } edges = []; for (i = 0; i <= nb; i++) edges.push(lo + (hi - lo) * i / nb); }
    var counts = MLab.B.histcounts([M(1, d.length, d), M(1, edges.length, edges)], 1);
    if (n > 0) return [counts, M(1, edges.length - 1, edges.slice(0, -1).map(function (e, k) { return (e + edges[k + 1]) / 2; }))];
    var x = fresh(I), s = { type: "hist", edges: edges, y: counts.d, color: ORDER[x.ci++ % 7], name: "" }; applyNV(s, args.filter(function (v, k) { return !(isText(v) && /^numbins$/i.test(text(v))) && !(k > 0 && isText(args[k - 1]) && /^numbins$/i.test(text(args[k - 1]))); }), 0); x.series.push(s);
  };
  B.errorbar = function (a, n, I) { var X = a[0], Y = a[1], E = a[2]; if (a.length < 3) { E = a[1]; Y = a[0]; X = M(1, Y.d.length, Y.d.map(function (q, k) { return k + 1; })); } var s = linePlot([X, Y].concat(a.slice(3)), I)[0]; s.err = nums(E).d.slice(); };
  B.fplot = B.ezplot = function (a, n, I) { var f = a[0], lim = a.length > 1 && !isText(a[1]) ? a[1].d : [-5, 5], rest = a.slice(a.length > 1 && !isText(a[1]) ? 2 : 1), xs = [], ys = []; if (isText(f)) f = MLab.B.eval([_.str("@(x) " + text(f).replace(/([^.])([*\/^])/g, "$1.$2"))], 1, I); for (var i = 0; i <= 240; i++) { var x = lim[0] + (lim[1] - lim[0]) * i / 240, r = I.feval(f, [num(x)])[0]; xs.push(x); ys.push(r.d[0]); } linePlot([M(1, xs.length, xs), M(1, ys.length, ys)].concat(rest), I); };
  B.polarplot = B.polar = function (a, n, I) { var th = nums(a[0]), r = nums(a[1]); var s = linePlot([M(1, th.d.length, th.d.map(function (t, i) { return r.d[i] * Math.cos(t); })), M(1, th.d.length, th.d.map(function (t, i) { return r.d[i] * Math.sin(t); }))].concat(a.slice(2)), I)[0]; var x = ax(I); x.equal = true; x.polar = true; void s; };
  B.compass = function (a, n, I) { var z = a.length === 1 ? a[0] : null, u = z ? z.d : a[0].d, v = z ? (z.im || z.d.map(function () { return 0; })) : a[1].d, x = fresh(I); x.hold = true; u.forEach(function (ur, i) { linePlot([M(1, 2, [0, ur]), M(1, 2, [0, v[i]]), _.str("-")], I)[0].arrow = true; }); x.hold = false; x.equal = true; x.polar = true; };
  B.quiver = function (a, n, I) { var X = nums(a[0]), Y = nums(a[1]), U = nums(a[2]), V = nums(a[3]), x = fresh(I), keep = x.hold, mx = 0; U.d.forEach(function (u, i) { mx = Math.max(mx, Math.hypot(u, V.d[i])); }); var span = (Math.max.apply(null, X.d) - Math.min.apply(null, X.d)) / Math.max(2, Math.sqrt(X.d.length)), k = mx ? 0.9 * span / mx : 1, col = ORDER[x.ci++ % 7]; x.hold = true; X.d.forEach(function (xv, i) { var s = linePlot([M(1, 2, [xv, xv + k * U.d[i]]), M(1, 2, [Y.d[i], Y.d[i] + k * V.d[i]])], I)[0]; s.arrow = true; s.color = col; }); x.hold = keep; };
  B.pie = function () { throw err("pie charts are not drawn by the browser runner. Use bar here, or run pie in real MATLAB.", "EEHub:realMatlabOnly"); };
  B.barh = B.bar3 = B.pie3 = B.ribbon = B.streamline = B.slice = function () { throw err("This chart type is not drawn by the browser runner. Run it in real MATLAB.", "EEHub:realMatlabOnly"); };
  B.xline = function (a, n, I) { var x = ax(I); x.series.push({ type: "vline", v: scalar(a[0]), color: a[1] && parseSpec(text(a[1])) && parseSpec(text(a[1])).color || "var(--mlp-ink, #111)", ls: a[1] && parseSpec(text(a[1])) ? parseSpec(text(a[1])).ls || "-" : "-", name: "", skipLegend: true }); };
  B.yline = function (a, n, I) { var x = ax(I); x.series.push({ type: "hline", v: scalar(a[0]), color: a[1] && parseSpec(text(a[1])) && parseSpec(text(a[1])).color || "var(--mlp-ink, #111)", ls: a[1] && parseSpec(text(a[1])) ? parseSpec(text(a[1])).ls || "-" : "-", name: "", skipLegend: true }); };
  B.figure = function (a, n, I) { I.fig = { axes: [], cur: null, id: I.figs.length + 1 }; I.figs.push(I.fig); if (n > 0) return num(I.fig.id); };
  B.clf = function (a, n, I) { var f = fig(I); f.axes = []; f.cur = null; };
  B.cla = function (a, n, I) { var x = ax(I); x.series = []; x.texts = []; x.ci = 0; };
  B.close = function (a, n, I) { if (a.length && isText(a[0]) && text(a[0]) === "all") { I.figs = []; I.fig = null; return; } if (I.fig) { I.figs = I.figs.filter(function (f) { return f !== I.fig; }); I.fig = I.figs[I.figs.length - 1] || null; } };
  B.subplot = function (a, n, I) {
    var m, c, p; if (a.length === 1) { var v = scalar(a[0]); m = Math.floor(v / 100); c = Math.floor(v / 10) % 10; p = v % 10; } else { if (a.length < 3) throw err("subplot needs three numbers: rows, columns and position, e.g. subplot(2, 1, 1)."); m = scalar(a[0]); c = scalar(a[1]); p = a[2].d.length > 1 ? a[2].d.slice() : scalar(a[2]); }
    var p1 = Array.isArray(p) ? p[0] : p; if (p1 < 1 || p1 > m * c) throw err("Index exceeds number of subplots.");
    var f = fig(I), key = JSON.stringify([m, c, p]), found = f.axes.filter(function (x) { return JSON.stringify([x.m, x.n, x.p]) === key; })[0];
    if (!found) { f.axes = f.axes.filter(function (x) { return x.m === m && x.n === c; }); found = newAxes(m, c, p); f.axes.push(found); }
    f.cur = found;
  };
  B.hold = function (a, n, I) { var x = ax(I), s = a.length ? text(a[0]) : (x.hold ? "off" : "on"); if (s !== "on" && s !== "off" && s !== "all") throw err("Use  hold on  or  hold off."); x.hold = s !== "off"; };
  B.grid = function (a, n, I) { var x = ax(I), s = a.length ? text(a[0]) : (x.grid ? "off" : "on"); x.grid = s !== "off"; };
  B.box = B.colorbar = B.colormap = B.shading = B.view = B.axes = B.daspect = B.pbaspect = B.camlight = B.lighting = B.rotate3d = B.zoom = B.datacursormode = B.set = B.gtext = B.annotation = B.xticks = B.yticks = B.xticklabels = B.yticklabels = B.xtickangle = B.sgtitle_ = function () {};
  B.gca = B.gcf = function (a, n, I) { ax(I); return _.struct({}); };
  B.get = function () { return _.empty(); };
  function label(key) { return function (a, n, I) { if (!a.length) throw err("Not enough input arguments."); var v = a[0]; if (v.t === "st" && a.length > 1) v = a[1]; ax(I)[key] = v.t === "c" ? v.d.map(function (x) { return text(x); }).join(" / ") : isText(v) ? text(v) : _.num2str(v); }; }
  B.title = label("title"); B.xlabel = label("xlabel"); B.ylabel = label("ylabel"); B.zlabel = label("zlabel");
  B.sgtitle = B.suptitle = function (a, n, I) { fig(I).title = text(a[0]); };
  B.legend = function (a, n, I) { var x = ax(I), names = []; for (var i = 0; i < a.length; i++) { var v = a[i]; if (v.t === "c") v.d.forEach(function (e) { names.push(text(e)); }); else if (isText(v)) { var s = text(v); if (/^(location|orientation|fontsize|box|interpreter|numcolumns)$/i.test(s)) { if (/^location$/i.test(s) && a[i + 1]) x.legendLoc = text(a[i + 1]).toLowerCase(); i++; continue; } if (s === "off" || s === "hide") { x.legend = null; return; } if (s === "show" || s === "on" || s === "boxoff" || s === "boxon") continue; names.push(s); } } x.legend = names; };
  function lim(key) { return function (a, n, I) { var x = ax(I); if (!a.length) return x[key] ? M(1, 2, x[key].slice()) : M(1, 2, [0, 1]); if (isText(a[0])) { x[key] = null; return; } var v = a[0].d; if (v.length !== 2 || !(v[1] > v[0])) throw err("Limits must be a 2-element vector of increasing values, e.g. xlim([0 10])."); x[key] = [v[0], v[1]]; }; }
  B.xlim = lim("xlim"); B.ylim = lim("ylim"); B.zlim = lim("zlim");
  B.axis = function (a, n, I) {
    var x = ax(I);
    a.forEach(function (v) {
      if (isText(v)) { var s = text(v).toLowerCase(); if (s === "equal" || s === "square" || s === "image") x.equal = true; else if (s === "tight") x.tight = true; else if (s === "off") x.off = true; else if (s === "on") x.off = false; else if (s === "auto" || s === "normal") { x.xlim = x.ylim = null; x.equal = false; } else if (s === "ij") x.ydir = "reverse"; else if (s === "xy") x.ydir = null; else throw err("Unknown axis option '" + text(v) + "'."); }
      else { var d = v.d; if (d.length !== 4 && d.length !== 6) throw err("axis needs [xmin xmax ymin ymax]."); if (!(d[1] > d[0]) || !(d[3] > d[2])) throw err("axis limits must be increasing: [xmin xmax ymin ymax]."); x.xlim = [d[0], d[1]]; x.ylim = [d[2], d[3]]; if (d.length === 6) x.zlim = [d[4], d[5]]; }
    });
  };
  B.text = function (a, n, I) { if (a.length < 3) throw err("text needs x, y and the text to show."); ax(I).texts.push({ x: scalar(a[0]), y: scalar(a[1]), s: isText(a[2]) ? text(a[2]) : _.num2str(a[2]) }); };

  /* ================= SVG renderer ================= */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", omega: "ω", Omega: "Ω", Delta: "Δ", Sigma: "Σ", Phi: "Φ", infty: "∞", times: "×", pm: "±", circ: "°", leq: "≤", geq: "≥", approx: "≈", rightarrow: "→", cdot: "·", xi: "ξ", psi: "ψ" };
  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺", "n": "ⁿ" }, SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
  function tex(s) {
    s = String(s).replace(/\\([A-Za-z]+)/g, function (m, w) { return GREEK[w] || m; });
    s = s.replace(/\^\{([^}]*)\}|\^(.)/g, function (m, a, b) { var t = a !== undefined ? a : b; return t.split("").every(function (c) { return SUP[c]; }) ? t.split("").map(function (c) { return SUP[c]; }).join("") : "^" + t; });
    s = s.replace(/_\{([^}]*)\}|_(.)/g, function (m, a, b) { var t = a !== undefined ? a : b; return t.split("").every(function (c) { return SUB[c]; }) ? t.split("").map(function (c) { return SUB[c]; }).join("") : (a !== undefined ? t : "_" + t); });
    return esc(s);
  }
  function niceStep(span, target) { var raw = span / Math.max(1, target), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function ticks(lo, hi, target) { var st = niceStep(hi - lo, target), out = [], t = Math.ceil(lo / st - 1e-9) * st; for (; t <= hi + st * 1e-9; t += st) out.push(Math.abs(t) < st * 1e-9 ? 0 : t); return { t: out, step: st }; }
  function autoLim(lo, hi, tight) { if (!isFinite(lo) || !isFinite(hi)) return [0, 1]; if (lo === hi) { var d = lo === 0 ? 1 : Math.abs(lo) * 0.5; return autoLim(lo - d, hi + d); } if (tight) return [lo, hi]; var st = niceStep(hi - lo, 8); return [Math.floor(lo / st + 1e-9) * st, Math.ceil(hi / st - 1e-9) * st]; }
  function fmtTick(v, step) { if (v === 0) return "0"; var dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); var a = Math.abs(v); if (a >= 1e5 || a < 1e-4) return _.fmtG(v, 3).replace(/e\+?(-?)0*(\d+)/, "e$1$2"); return _.fixed(v, Math.min(6, dec + (step / Math.pow(10, -dec) % 1 ? 1 : 0))).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""); }
  function parula(t) { var st = [[53, 42, 135], [15, 92, 221], [18, 125, 216], [7, 156, 207], [21, 177, 180], [89, 189, 140], [165, 190, 107], [225, 185, 82], [252, 206, 46], [249, 251, 14]]; t = Math.max(0, Math.min(1, t !== t ? 0 : t)) * (st.length - 1); var i = Math.min(st.length - 2, Math.floor(t)), f = t - i; return "rgb(" + [0, 1, 2].map(function (k) { return Math.round(st[i][k] + (st[i + 1][k] - st[i][k]) * f); }).join(",") + ")"; }
  var DASH = { "--": "7 4", ":": "1.5 3.5", "-.": "7 3 1.5 3" };
  function marker(m, x, y, sz, col, fill) {
    var r = sz / 2, st = ' stroke="' + col + '" stroke-width="1.1" fill="' + (fill || "none") + '"', f2 = function (v) { return v.toFixed(1); };
    switch (m) {
      case "o": return '<circle cx="' + f2(x) + '" cy="' + f2(y) + '" r="' + f2(r) + '"' + st + "/>";
      case ".": return '<circle cx="' + f2(x) + '" cy="' + f2(y) + '" r="' + f2(Math.max(1.4, r * 0.45)) + '" fill="' + col + '"/>';
      case "+": return '<path d="M' + f2(x - r) + " " + f2(y) + "H" + f2(x + r) + "M" + f2(x) + " " + f2(y - r) + "V" + f2(y + r) + '"' + st + "/>";
      case "x": return '<path d="M' + f2(x - r) + " " + f2(y - r) + "L" + f2(x + r) + " " + f2(y + r) + "M" + f2(x - r) + " " + f2(y + r) + "L" + f2(x + r) + " " + f2(y - r) + '"' + st + "/>";
      case "*": return '<path d="M' + f2(x - r) + " " + f2(y) + "H" + f2(x + r) + "M" + f2(x) + " " + f2(y - r) + "V" + f2(y + r) + "M" + f2(x - r * .7) + " " + f2(y - r * .7) + "L" + f2(x + r * .7) + " " + f2(y + r * .7) + "M" + f2(x - r * .7) + " " + f2(y + r * .7) + "L" + f2(x + r * .7) + " " + f2(y - r * .7) + '"' + st + "/>";
      case "s": return '<rect x="' + f2(x - r) + '" y="' + f2(y - r) + '" width="' + f2(2 * r) + '" height="' + f2(2 * r) + '"' + st + "/>";
      case "d": return '<path d="M' + f2(x) + " " + f2(y - r * 1.2) + "L" + f2(x + r) + " " + f2(y) + "L" + f2(x) + " " + f2(y + r * 1.2) + "L" + f2(x - r) + " " + f2(y) + 'Z"' + st + "/>";
      case "v": return '<path d="M' + f2(x - r) + " " + f2(y - r) + "L" + f2(x + r) + " " + f2(y - r) + "L" + f2(x) + " " + f2(y + r) + 'Z"' + st + "/>";
      default: return '<path d="M' + f2(x - r) + " " + f2(y + r) + "L" + f2(x + r) + " " + f2(y + r) + "L" + f2(x) + " " + f2(y - r) + 'Z"' + st + "/>";
    }
  }
  function drawAxes(a, bx, uid) { // bx: {x,y,w,h} cell rectangle
    var out = [], L = bx.x + 56, T = bx.y + (a.title ? 30 : 16), R = bx.x + bx.w - 16, Bt = bx.y + bx.h - (a.xlabel ? 44 : 30), W = R - L, H = Bt - T, ink = "var(--mlp-ink, #111)";
    if (a.title) out.push('<text x="' + (L + W / 2) + '" y="' + (bx.y + 19) + '" text-anchor="middle" font-size="13" font-weight="700" fill="' + ink + '">' + tex(a.title) + "</text>");
    if (a.is3d) return out.concat(draw3d(a, L, T, W, H + 10, uid)).join("");
    // data range
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, anyBar = false;
    function ex(x, y) { if (isFinite(x) && (!a.xlog || x > 0)) { if (x < xmin) xmin = x; if (x > xmax) xmax = x; } if (isFinite(y) && (!a.ylog || y > 0)) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; } }
    a.series.forEach(function (s) {
      if (s.type === "hist") { s.edges.forEach(function (e) { ex(e, NaN); }); s.y.forEach(function (v) { ex(NaN, v); }); ex(NaN, 0); anyBar = true; }
      else if (s.type === "contour" || s.type === "image") { s.x.forEach(function (v, i) { ex(v, s.y[i]); }); if (s.type === "image") { ex(xmin - 0.5, ymin - 0.5); ex(xmax + 0.5, ymax + 0.5); } }
      else if (s.type === "vline") ex(s.v, NaN); else if (s.type === "hline") ex(NaN, s.v);
      else if (s.x) { for (var i = 0; i < s.x.length; i++) { ex(s.x[i], s.y[i]); if (s.err) { ex(NaN, s.y[i] - s.err[i]); ex(NaN, s.y[i] + s.err[i]); } } if (s.type === "bar") { anyBar = true; ex(NaN, 0); var dx = s.x.length > 1 ? Math.abs(s.x[1] - s.x[0]) : 1; ex(Math.min.apply(null, s.x) - dx * 0.6, NaN); ex(Math.max.apply(null, s.x) + dx * 0.6, NaN); } if (s.type === "stem" || s.type === "area") ex(NaN, 0); }
    });
    a.texts.forEach(function (t) { ex(t.x, t.y); });
    var tightX = a.tight || a.series.some(function (s) { return s.type === "contour" || s.type === "image" || s.type === "hist"; });
    var xl = a.xlim || (a.xlog ? [Math.pow(10, Math.floor(Math.log10(xmin) + 1e-9)), Math.pow(10, Math.ceil(Math.log10(xmax) - 1e-9))] : autoLim(xmin, xmax, tightX)), yl = a.ylim || (a.ylog ? [Math.pow(10, Math.floor(Math.log10(ymin) + 1e-9)), Math.pow(10, Math.ceil(Math.log10(ymax) - 1e-9))] : autoLim(ymin, ymax, a.tight || a.series.some(function (s) { return s.type === "contour" || s.type === "image"; })));
    if (a.xlog && !(xl[1] > xl[0])) xl = [xl[0] / 10, xl[0] * 10]; if (a.ylog && !(yl[1] > yl[0])) yl = [yl[0] / 10, yl[0] * 10];
    if (!isFinite(xl[0]) || !isFinite(xl[1])) xl = [0, 1]; if (!isFinite(yl[0]) || !isFinite(yl[1])) yl = [0, 1];
    if (a.equal) { var ux = (xl[1] - xl[0]) / W, uy = (yl[1] - yl[0]) / H, u = Math.max(ux, uy), cx = (xl[0] + xl[1]) / 2, cy = (yl[0] + yl[1]) / 2; xl = [cx - u * W / 2, cx + u * W / 2]; yl = [cy - u * H / 2, cy + u * H / 2]; }
    var fx = a.xlog ? function (v) { return L + (Math.log10(v) - Math.log10(xl[0])) / (Math.log10(xl[1]) - Math.log10(xl[0])) * W; } : function (v) { return L + (v - xl[0]) / (xl[1] - xl[0]) * W; };
    var fy0 = a.ylog ? function (v) { return (Math.log10(v) - Math.log10(yl[0])) / (Math.log10(yl[1]) - Math.log10(yl[0])); } : function (v) { return (v - yl[0]) / (yl[1] - yl[0]); };
    var fy = a.ydir === "reverse" ? function (v) { return T + fy0(v) * H; } : function (v) { return Bt - fy0(v) * H; };
    function tk(lim, log, target) { if (log) { var t = [], e0 = Math.ceil(Math.log10(lim[0]) - 1e-9), e1 = Math.floor(Math.log10(lim[1]) + 1e-9), stp = Math.max(1, Math.ceil((e1 - e0 + 1) / 8)); for (var e = e0; e <= e1; e += stp) t.push(Math.pow(10, e)); return { t: t, step: 0, log: true }; } return ticks(lim[0], lim[1], target); }
    var xt = tk(xl, a.xlog, Math.max(3, Math.round(W / 70))), yt = tk(yl, a.ylog, Math.max(3, Math.round(H / 42)));
    function lab(v, t) { if (t.log) { var e = Math.round(Math.log10(v)); return "10" + String(e).split("").map(function (c) { return SUP[c] || c; }).join(""); } return fmtTick(v, t.step); }
    if (!a.off) {
      out.push('<rect x="' + L + '" y="' + T + '" width="' + W + '" height="' + H + '" fill="var(--mlp-plot, transparent)" stroke="' + ink + '" stroke-opacity=".55" stroke-width="1"/>');
      if (a.polar) { var rm = Math.max(Math.abs(xl[0]), Math.abs(xl[1]), Math.abs(yl[0]), Math.abs(yl[1])), rt = ticks(0, rm, 4).t; rt.forEach(function (rv) { if (rv > 0) out.push('<circle cx="' + fx(0).toFixed(1) + '" cy="' + fy(0).toFixed(1) + '" r="' + Math.abs(fx(rv) - fx(0)).toFixed(1) + '" fill="none" stroke="' + ink + '" stroke-opacity=".2" clip-path="url(#' + uid + ')"/>'); }); for (var q = 0; q < 12; q++) out.push('<line x1="' + fx(0).toFixed(1) + '" y1="' + fy(0).toFixed(1) + '" x2="' + fx(rm * 1.5 * Math.cos(q * Math.PI / 6)).toFixed(1) + '" y2="' + fy(rm * 1.5 * Math.sin(q * Math.PI / 6)).toFixed(1) + '" stroke="' + ink + '" stroke-opacity=".15" clip-path="url(#' + uid + ')"/>'); }
      xt.t.forEach(function (v) { var X = fx(v); if (X < L - 0.5 || X > R + 0.5) return; if (a.grid) out.push('<line x1="' + X.toFixed(1) + '" y1="' + T + '" x2="' + X.toFixed(1) + '" y2="' + Bt + '" stroke="' + ink + '" stroke-opacity=".16"/>'); out.push('<line x1="' + X.toFixed(1) + '" y1="' + Bt + '" x2="' + X.toFixed(1) + '" y2="' + (Bt - 4) + '" stroke="' + ink + '" stroke-opacity=".7"/><text x="' + X.toFixed(1) + '" y="' + (Bt + 15) + '" text-anchor="middle" font-size="11" fill="' + ink + '">' + lab(v, xt) + "</text>"); });
      yt.t.forEach(function (v) { var Y = fy(v); if (Y < T - 0.5 || Y > Bt + 0.5) return; if (a.grid) out.push('<line x1="' + L + '" y1="' + Y.toFixed(1) + '" x2="' + R + '" y2="' + Y.toFixed(1) + '" stroke="' + ink + '" stroke-opacity=".16"/>'); out.push('<line x1="' + L + '" y1="' + Y.toFixed(1) + '" x2="' + (L + 4) + '" y2="' + Y.toFixed(1) + '" stroke="' + ink + '" stroke-opacity=".7"/><text x="' + (L - 6) + '" y="' + (Y + 3.8).toFixed(1) + '" text-anchor="end" font-size="11" fill="' + ink + '">' + lab(v, yt) + "</text>"); });
      if (a.xlabel) out.push('<text x="' + (L + W / 2) + '" y="' + (Bt + 34) + '" text-anchor="middle" font-size="12" fill="' + ink + '">' + tex(a.xlabel) + "</text>");
      if (a.ylabel) out.push('<text transform="translate(' + (bx.x + 13) + " " + (T + H / 2) + ') rotate(-90)" text-anchor="middle" font-size="12" fill="' + ink + '">' + tex(a.ylabel) + "</text>");
    }
    out.push('<clipPath id="' + uid + '"><rect x="' + L + '" y="' + T + '" width="' + W + '" height="' + H + '"/></clipPath><g clip-path="url(#' + uid + ')">');
    var legendItems = [];
    a.series.forEach(function (s, si) {
      var i, d = "", pen = false, X, Y, col = s.color;
      if (s.type === "vline") { X = fx(s.v); out.push('<line x1="' + X.toFixed(1) + '" y1="' + T + '" x2="' + X.toFixed(1) + '" y2="' + Bt + '" stroke="' + col + '" stroke-width="1.2"' + (DASH[s.ls] ? ' stroke-dasharray="' + DASH[s.ls] + '"' : "") + "/>"); return; }
      if (s.type === "hline") { Y = fy(s.v); out.push('<line x1="' + L + '" y1="' + Y.toFixed(1) + '" x2="' + R + '" y2="' + Y.toFixed(1) + '" stroke="' + col + '" stroke-width="1.2"' + (DASH[s.ls] ? ' stroke-dasharray="' + DASH[s.ls] + '"' : "") + "/>"); return; }
      if (s.type === "image") { var zmin = Math.min.apply(null, s.z.filter(isFinite)), zmax = Math.max.apply(null, s.z.filter(isFinite)); for (var jj = 0; jj < s.c; jj++) for (i = 0; i < s.r; i++) { var px = fx(s.x[i + jj * s.r] - 0.5), py = fy(s.y[i + jj * s.r] - 0.5), pw = fx(s.x[i + jj * s.r] + 0.5) - px, ph = fy(s.y[i + jj * s.r] + 0.5) - py; out.push('<rect x="' + Math.min(px, px + pw).toFixed(1) + '" y="' + Math.min(py, py + ph).toFixed(1) + '" width="' + (Math.abs(pw) + 0.4).toFixed(1) + '" height="' + (Math.abs(ph) + 0.4).toFixed(1) + '" fill="' + parula((s.z[i + jj * s.r] - zmin) / (zmax - zmin || 1)) + '"/>'); } return; }
      if (s.type === "contour") { var zs = s.z.filter(isFinite), lo = Math.min.apply(null, zs), hi = Math.max.apply(null, zs), levels = Array.isArray(s.levels) ? s.levels : (function () { var n = s.levels, l = []; for (var k = 1; k <= n; k++) l.push(lo + (hi - lo) * k / (n + 1)); return l; })(); levels.forEach(function (lv) { var segs = ""; for (var j = 0; j < s.c - 1; j++) for (var ii = 0; ii < s.r - 1; ii++) { var id = [ii + j * s.r, ii + 1 + j * s.r, ii + 1 + (j + 1) * s.r, ii + (j + 1) * s.r], pts = []; for (var e = 0; e < 4; e++) { var p = id[e], q2 = id[(e + 1) % 4], zp = s.z[p], zq = s.z[q2]; if ((zp < lv) !== (zq < lv)) { var t = (lv - zp) / (zq - zp); pts.push([fx(s.x[p] + (s.x[q2] - s.x[p]) * t), fy(s.y[p] + (s.y[q2] - s.y[p]) * t)]); } } for (var k2 = 0; k2 + 1 < pts.length; k2 += 2) segs += "M" + pts[k2][0].toFixed(1) + " " + pts[k2][1].toFixed(1) + "L" + pts[k2 + 1][0].toFixed(1) + " " + pts[k2 + 1][1].toFixed(1); } if (segs) out.push('<path d="' + segs + '" fill="none" stroke="' + parula((lv - lo) / (hi - lo || 1)) + '" stroke-width="1.3"/>'); }); return; }
      if (s.type === "hist") { for (i = 0; i < s.y.length; i++) { X = fx(s.edges[i]); var X2 = fx(s.edges[i + 1]); Y = fy(s.y[i]); out.push('<rect x="' + X.toFixed(1) + '" y="' + Math.min(Y, fy(0)).toFixed(1) + '" width="' + Math.max(0, X2 - X).toFixed(1) + '" height="' + Math.abs(fy(0) - Y).toFixed(1) + '" fill="' + col + '" fill-opacity=".6" stroke="' + ink + '" stroke-opacity=".6" stroke-width=".8"/>'); } legendItems.push(s); return; }
      if (s.type === "bar") { var dxb = s.x.length > 1 ? Math.abs(s.x[1] - s.x[0]) : 1, bw = dxb * 0.8 / s.groups; for (i = 0; i < s.x.length; i++) { var x0 = s.x[i] - dxb * 0.4 + bw * s.group; X = fx(x0); Y = fy(s.y[i]); var y0 = fy(Math.max(yl[0], Math.min(yl[1], 0))); out.push('<rect x="' + X.toFixed(1) + '" y="' + Math.min(Y, y0).toFixed(1) + '" width="' + Math.max(1, fx(x0 + bw) - X - 1).toFixed(1) + '" height="' + Math.abs(y0 - Y).toFixed(1) + '" fill="' + col + '"' + (s.alpha !== undefined ? ' fill-opacity="' + s.alpha + '"' : "") + "/>"); } legendItems.push(s); return; }
      var n = s.x.length, pts2 = [];
      for (i = 0; i < n; i++) { var xv = s.x[i], yv = s.y[i]; if (!isFinite(xv) || !isFinite(yv) || (a.xlog && xv <= 0) || (a.ylog && yv <= 0)) { pen = false; pts2.push(null); continue; } X = fx(xv); Y = fy(yv); X = Math.max(-1e4, Math.min(1e4, X)); Y = Math.max(-1e4, Math.min(1e4, Y)); pts2.push([X, Y]); if (s.type === "stairs" && pen) d += "H" + X.toFixed(1) + "V" + Y.toFixed(1); else d += (pen ? "L" : "M") + X.toFixed(1) + " " + Y.toFixed(1); pen = true; }
      var base = fy(a.ylog ? yl[0] : Math.max(yl[0], Math.min(yl[1], 0)));
      if (s.type === "area" && pts2.length && pts2[0] && pts2[n - 1]) out.push('<path d="' + d + "L" + pts2[n - 1][0].toFixed(1) + " " + base.toFixed(1) + "L" + pts2[0][0].toFixed(1) + " " + base.toFixed(1) + 'Z" fill="' + col + '" fill-opacity=".35" stroke="none"/>');
      if (s.type === "stem") { var sd = ""; pts2.forEach(function (p) { if (p) sd += "M" + p[0].toFixed(1) + " " + base.toFixed(1) + "V" + p[1].toFixed(1); }); out.push('<path d="' + sd + '" fill="none" stroke="' + col + '" stroke-width="' + s.lw + '"/><line x1="' + L + '" y1="' + base.toFixed(1) + '" x2="' + R + '" y2="' + base.toFixed(1) + '" stroke="' + ink + '" stroke-opacity=".5"/>'); }
      else if (s.type !== "scatter" && s.ls !== "none" && d) out.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + s.lw + '" stroke-linejoin="round"' + (DASH[s.ls] ? ' stroke-dasharray="' + DASH[s.ls] + '"' : "") + "/>");
      if (s.arrow && pts2.length === 2 && pts2[0] && pts2[1]) { var ang = Math.atan2(pts2[1][1] - pts2[0][1], pts2[1][0] - pts2[0][0]), hx = pts2[1][0], hy = pts2[1][1]; out.push('<path d="M' + hx.toFixed(1) + " " + hy.toFixed(1) + "L" + (hx - 8 * Math.cos(ang - 0.4)).toFixed(1) + " " + (hy - 8 * Math.sin(ang - 0.4)).toFixed(1) + "L" + (hx - 8 * Math.cos(ang + 0.4)).toFixed(1) + " " + (hy - 8 * Math.sin(ang + 0.4)).toFixed(1) + 'Z" fill="' + col + '"/>'); }
      if (s.err) pts2.forEach(function (p, k) { if (p) { var y1 = fy(s.y[k] - s.err[k]), y2 = fy(s.y[k] + s.err[k]); out.push('<path d="M' + p[0].toFixed(1) + " " + y1.toFixed(1) + "V" + y2.toFixed(1) + "M" + (p[0] - 3).toFixed(1) + " " + y1.toFixed(1) + "h6M" + (p[0] - 3).toFixed(1) + " " + y2.toFixed(1) + 'h6" stroke="' + col + '" fill="none"/>'); } });
      if (s.marker) { var every = s.ls === "none" ? Math.max(1, Math.ceil(n / 6000)) : Math.max(1, Math.ceil(n / 400)); for (i = 0; i < n; i += every) if (pts2[i]) out.push(marker(s.marker, pts2[i][0], pts2[i][1], s.ms, s.mec || col, s.mfc === "auto" ? col : s.mfc)); }
      if (!s.arrow) legendItems.push(s);
    });
    a.texts.forEach(function (t) { out.push('<text x="' + fx(t.x).toFixed(1) + '" y="' + fy(t.y).toFixed(1) + '" font-size="11.5" fill="' + ink + '">' + tex(t.s) + "</text>"); });
    out.push("</g>");
    var names = a.legend ? (a.legend.length ? a.legend : legendItems.map(function (s, i) { return s.name || "data" + (i + 1); })) : (legendItems.some(function (s) { return s.name; }) && a.legend !== null && a.legendAuto ? legendItems.map(function (s) { return s.name; }) : null);
    if (a.legend && names && names.length) {
      var items = legendItems.slice(0, names.length), wmax = 0; names.slice(0, items.length).forEach(function (nm) { wmax = Math.max(wmax, String(nm).length); });
      var lw = 44 + wmax * 6.4, lh = 8 + items.length * 16, loc = a.legendLoc || "northeast", lx = /west/.test(loc) ? L + 8 : R - lw - 8, ly = /south/.test(loc) ? Bt - lh - 8 : T + 8;
      if (loc === "best" ) { lx = R - lw - 8; ly = T + 8; }
      out.push('<rect x="' + lx.toFixed(1) + '" y="' + ly + '" width="' + lw.toFixed(1) + '" height="' + lh + '" fill="var(--mlp-bg, #fff)" fill-opacity=".9" stroke="' + ink + '" stroke-opacity=".5"/>');
      items.forEach(function (s, i) { var yy = ly + 12 + i * 16; if (s.type === "bar" || s.type === "hist") out.push('<rect x="' + (lx + 8) + '" y="' + (yy - 5) + '" width="22" height="9" fill="' + s.color + '"/>'); else { if (s.ls !== "none" && s.type !== "scatter") out.push('<line x1="' + (lx + 6) + '" y1="' + yy + '" x2="' + (lx + 32) + '" y2="' + yy + '" stroke="' + s.color + '" stroke-width="' + Math.min(2.5, s.lw) + '"' + (DASH[s.ls] ? ' stroke-dasharray="' + DASH[s.ls] + '"' : "") + "/>"); if (s.marker) out.push(marker(s.marker, lx + 19, yy, Math.min(7, s.ms), s.color, s.mfc === "auto" ? s.color : s.mfc)); } out.push('<text x="' + (lx + 38) + '" y="' + (yy + 4) + '" font-size="11.5" fill="' + ink + '">' + tex(names[i]) + "</text>"); });
    }
    return out.join("");
  }
  function draw3d(a, L, T, W, H) {
    var out = [], ink = "var(--mlp-ink, #111)", lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    function ex(k, v) { if (isFinite(v)) { if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; } }
    a.series.forEach(function (s) { if (!s.z) return; s.x.forEach(function (v) { ex(0, v); }); s.y.forEach(function (v) { ex(1, v); }); s.z.forEach(function (v) { ex(2, v); }); });
    var lims = [a.xlim || autoLim(lo[0], hi[0], true), a.ylim || autoLim(lo[1], hi[1], true), a.zlim || autoLim(lo[2], hi[2])];
    var A = -37.5 * Math.PI / 180, E = 30 * Math.PI / 180, cA = Math.cos(A), sA = Math.sin(A), cE = Math.cos(E), sE = Math.sin(E), S = Math.min(W, H * 1.25) * 0.62, cx = L + W / 2, cy = T + H / 2 + 6;
    function nrm(k, v) { return (v - lims[k][0]) / (lims[k][1] - lims[k][0] || 1) - 0.5; }
    function P(x, y, z) { var X = nrm(0, x), Y = nrm(1, y), Z = nrm(2, z) * 0.8; return [cx + S * (X * cA + Y * sA), cy - S * (-X * sA * sE + Y * cA * sE + Z * cE), X * sA * cE - Y * cA * cE + Z * sE]; }
    function ln(p, q, op) { return '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke="' + ink + '" stroke-opacity="' + (op || 0.55) + '"/>'; }
    var x0 = lims[0][0], x1 = lims[0][1], y0 = lims[1][0], y1 = lims[1][1], z0 = lims[2][0], z1 = lims[2][1];
    // floor and the two back walls
    [[[x0, y0, z0], [x1, y0, z0]], [[x1, y0, z0], [x1, y1, z0]], [[x1, y1, z0], [x0, y1, z0]], [[x0, y1, z0], [x0, y0, z0]], [[x0, y1, z0], [x0, y1, z1]], [[x1, y1, z0], [x1, y1, z1]], [[x0, y1, z1], [x1, y1, z1]], [[x1, y0, z0], [x1, y0, z1]], [[x1, y0, z1], [x1, y1, z1]]].forEach(function (e) { out.push(ln(P.apply(null, e[0]), P.apply(null, e[1]), 0.35)); });
    ticks(x0, x1, 4).t.forEach(function (v, i, arr) { var p = P(v, y0, z0); out.push('<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 14).toFixed(1) + '" text-anchor="middle" font-size="10.5" fill="' + ink + '">' + fmtTick(v, (arr[1] - arr[0]) || 1) + "</text>"); });
    ticks(y0, y1, 4).t.forEach(function (v, i, arr) { var p = P(x0, v, z0); out.push('<text x="' + (p[0] - 6).toFixed(1) + '" y="' + (p[1] + 10).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="' + ink + '">' + fmtTick(v, (arr[1] - arr[0]) || 1) + "</text>"); });
    ticks(z0, z1, 4).t.forEach(function (v, i, arr) { var p = P(x0, y1, v); out.push('<text x="' + (p[0] - 6).toFixed(1) + '" y="' + (p[1] + 3).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="' + ink + '">' + fmtTick(v, (arr[1] - arr[0]) || 1) + "</text>"); });
    var pe;
    if (a.xlabel) { pe = P((x0 + x1) / 2, y0, z0); out.push('<text x="' + pe[0].toFixed(1) + '" y="' + (pe[1] + 30).toFixed(1) + '" text-anchor="middle" font-size="12" fill="' + ink + '">' + tex(a.xlabel) + "</text>"); }
    if (a.ylabel) { pe = P(x0, (y0 + y1) / 2, z0); out.push('<text x="' + (pe[0] - 30).toFixed(1) + '" y="' + (pe[1] + 24).toFixed(1) + '" text-anchor="middle" font-size="12" fill="' + ink + '">' + tex(a.ylabel) + "</text>"); }
    if (a.zlabel) { pe = P(x0, y1, (z0 + z1) / 2); out.push('<text transform="translate(' + (pe[0] - 38).toFixed(1) + " " + pe[1].toFixed(1) + ') rotate(-90)" text-anchor="middle" font-size="12" fill="' + ink + '">' + tex(a.zlabel) + "</text>"); }
    a.series.forEach(function (s) {
      if (s.type === "surf") {
        var faces = [], sr = Math.max(1, Math.ceil(s.r / 45)), sc = Math.max(1, Math.ceil(s.c / 45)), i, j;
        for (j = 0; j + sc < s.c + sc - 1 && j < s.c - 1; j += sc) for (i = 0; i < s.r - 1; i += sr) {
          var i2 = Math.min(s.r - 1, i + sr), j2 = Math.min(s.c - 1, j + sc), id = [i + j * s.r, i2 + j * s.r, i2 + j2 * s.r, i + j2 * s.r], pts = id.map(function (k) { return P(s.x[k], s.y[k], s.z[k]); }), zm = (s.z[id[0]] + s.z[id[1]] + s.z[id[2]] + s.z[id[3]]) / 4;
          if (pts.some(function (p) { return !isFinite(p[0]) || !isFinite(p[1]); })) continue;
          faces.push({ d: (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4, p: pts, z: zm });
        }
        faces.sort(function (p, q) { return p.d - q.d; });
        faces.forEach(function (f) { var c = parula((f.z - z0) / (z1 - z0 || 1)); out.push('<path d="M' + f.p.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") + 'Z" fill="' + (s.mesh ? "var(--mlp-bg, #fff)" : c) + '" stroke="' + (s.mesh ? c : "rgba(0,0,0,.35)") + '" stroke-width="' + (s.mesh ? 0.9 : 0.4) + '"/>'); });
      } else if (s.type === "line3") {
        var d = "", pen = false; for (var k = 0; k < s.x.length; k++) { var p = P(s.x[k], s.y[k], s.z[k]); if (!isFinite(p[0]) || !isFinite(p[1])) { pen = false; continue; } d += (pen ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); pen = true; if (s.marker) out.push(marker(s.marker, p[0], p[1], s.ms, s.color)); }
        if (s.ls !== "none") out.push('<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + s.lw + '"' + (DASH[s.ls] ? ' stroke-dasharray="' + DASH[s.ls] + '"' : "") + "/>");
      }
    });
    return out;
  }
  var uidN = 0;
  MLab.plotSVG = function (f, opts) {
    opts = opts || {};
    var axes = f.axes.filter(function (a) { return a.series.length || a.title || a.texts.length; }), m = 1, n = 1;
    axes.forEach(function (a) { m = Math.max(m, a.m); n = Math.max(n, a.n); });
    var W = opts.width || 560, top = f.title ? 24 : 0, H = (opts.height || (m === 1 ? 400 : m === 2 ? 480 : 170 * m)) + top, cw = W / n, ch = (H - top) / m;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" class="mlp" role="img" aria-label="' + esc(axes.map(function (a) { return a.title || "plot"; }).join(", ")) + '" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">'];
    if (f.title) out.push('<text x="' + W / 2 + '" y="17" text-anchor="middle" font-size="14" font-weight="700" fill="var(--mlp-ink, #111)">' + tex(f.title) + "</text>");
    axes.forEach(function (a) {
      var ps = Array.isArray(a.p) ? a.p : [a.p], r0 = Infinity, r1 = -1, c0 = Infinity, c1 = -1;
      ps.forEach(function (p) { var r = Math.floor((p - 1) / a.n), c = (p - 1) % a.n; r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); });
      var w = W / a.n, h = (H - top) / a.m;
      out.push(drawAxes(a, { x: c0 * w, y: top + r0 * h, w: (c1 - c0 + 1) * w, h: (r1 - r0 + 1) * h }, "mlpc" + (++uidN) + (opts.uid || "")));
    });
    void cw; void ch;
    out.push("</svg>");
    return out.join("");
  };
  MLab.plotHelpers = { ax: ax, fig: fig, fresh: fresh, linePlot: linePlot, parseSpec: parseSpec, newAxes: newAxes };
  return MLab;
});
