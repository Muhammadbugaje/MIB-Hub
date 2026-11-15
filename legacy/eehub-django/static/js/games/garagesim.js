/* Algorithm Garage (EEEN 316): the workshop robot, its commands and the jobs. Programs are MATLAB code, run by the EE
   Hub MATLAB-compatible runner (static/js/matlab/mlab.js + mlab-lib.js, shared with the MATLAB Academy), with the
   robot's commands added as functions. Each run is deterministic: it records every robot action so the game can replay
   it, and the tests can prove every job has a working solution.

   Robot commands (all usable from MATLAB code):
     move() / move(n)     drive forward one / n squares        turnLeft(), turnRight()
     frontIsClear()       true if the square ahead is free      pick(), drop()      pick up / put down a part
     weight()             weight (kg) of the part being held    sense()             the number painted on this square
     scan()               the numbers on every square ahead     pos()               [row col]      heading()  'N','E','S','W' */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory((function () { var m = require("../matlab/mlab.js"); require("../matlab/mlab-lib.js"); return m; })()); else root.GarageSim = factory(root.MLab); })(typeof self !== "undefined" ? self : this, function (ML) {
  "use strict";
  var _ = ML && ML._, DIRS = ["N", "E", "S", "W"], DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1], MAX_ACTIONS = 600;
  function rng(seed) { var s = Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0 || 1; for (var w = 0; w < 4; w++) s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }

  /* a world: rows of characters. '#' wall, '.' floor, 'T' target square, digits = numbers painted on the floor.
     parts: {r, c, w} (kg); bins: {r, c, label, test(w)}; robot: {r, c, d} (d index into N E S W) */
  function world(rows, extra) {
    var w = { grid: rows.map(function (s) { return s.split(""); }), parts: [], bins: [], held: null, robot: { r: 1, c: 1, d: 1 }, paint: {}, target: null, delivered: [] };
    w.grid.forEach(function (row, r) { row.forEach(function (ch, c) { if (ch === "T") { w.target = { r: r, c: c }; row[c] = "."; } }); });
    for (var k in extra || {}) w[k] = extra[k];
    return w;
  }
  function clone(w) { return JSON.parse(JSON.stringify(w)); }
  function wall(w, r, c) { return r < 0 || c < 0 || r >= w.grid.length || c >= w.grid[0].length || w.grid[r][c] === "#"; }
  function partAt(w, r, c) { for (var i = 0; i < w.parts.length; i++) if (w.parts[i].r === r && w.parts[i].c === c) return i; return -1; }
  function binAt(w, r, c) { for (var i = 0; i < w.bins.length; i++) if (w.bins[i].r === r && w.bins[i].c === c) return w.bins[i]; return null; }

  /* run MATLAB code against a world; returns {ok, error, output, vars, trace, w, actions} */
  var CUR = null; // the run in progress (the commands below act on it)
  function fail(msg) { throw _.err(msg); }
  function act(kind, extra) { var R = CUR; if (++R.actions > MAX_ACTIONS) throw _.fatal("Stopped: the robot made more than " + MAX_ACTIONS + " moves. Check your loop's stopping condition."); var w = R.w; R.trace.push({ k: kind, r: w.robot.r, c: w.robot.c, d: w.robot.d, held: w.held ? w.held.w : null, x: extra }); }
  function install() {
    if (!ML || ML.B.__garage) return; var B = ML.B; B.__garage = true;
    function need(a, lo, hi, name) { if (a.length < lo || a.length > hi) fail("'" + name + "' takes " + (lo === hi ? lo : lo + " or " + hi) + " input" + (hi === 1 ? "" : "s") + "."); }
    function noRun(name) { if (!CUR) fail("'" + name + "' only works in Algorithm Garage."); return CUR.w; }
    B.move = function (a) { var w = noRun("move"); need(a, 0, 1, "move"); var n = a.length ? _.scalar(a[0]) : 1; if (n !== Math.floor(n) || n < 0) fail("move(n) needs a whole number of squares, n ≥ 0.");
      for (var i = 0; i < n; i++) { var r = w.robot.r + DR[w.robot.d], c = w.robot.c + DC[w.robot.d]; if (wall(w, r, c)) { act("bump"); fail("The robot hit a wall at row " + (r + 1) + ", column " + (c + 1) + ". Use frontIsClear() to check first."); } w.robot.r = r; w.robot.c = c; act("move"); } };
    B.turnLeft = function (a) { var w = noRun("turnLeft"); need(a, 0, 0, "turnLeft"); w.robot.d = (w.robot.d + 3) % 4; act("turn"); };
    B.turnRight = function (a) { var w = noRun("turnRight"); need(a, 0, 0, "turnRight"); w.robot.d = (w.robot.d + 1) % 4; act("turn"); };
    B.frontIsClear = function (a) { var w = noRun("frontIsClear"); need(a, 0, 0, "frontIsClear"); CUR.sensors++; return _.bool(!wall(w, w.robot.r + DR[w.robot.d], w.robot.c + DC[w.robot.d])); };
    B.pick = function (a) { var w = noRun("pick"); need(a, 0, 0, "pick"); if (w.held) fail("The robot is already holding a part. drop() it first."); var i = partAt(w, w.robot.r, w.robot.c); if (i < 0) fail("There is no part on this square to pick up."); w.held = w.parts.splice(i, 1)[0]; act("pick"); };
    B.drop = function (a) { var w = noRun("drop"); need(a, 0, 0, "drop"); if (!w.held) fail("The robot is not holding anything."); var b = binAt(w, w.robot.r, w.robot.c), p = w.held; w.held = null;
      if (b) { w.delivered.push({ bin: b.label, w: p.w, id: p.id }); act("drop", { bin: b.label }); } else { if (partAt(w, w.robot.r, w.robot.c) >= 0) fail("There is already a part on this square."); p.r = w.robot.r; p.c = w.robot.c; w.parts.push(p); act("drop"); } };
    B.weight = function (a) { var w = noRun("weight"); need(a, 0, 0, "weight"); if (!w.held) fail("weight() needs the robot to be holding a part."); CUR.sensors++; return _.num(w.held.w); };
    B.sense = function (a) { var w = noRun("sense"); need(a, 0, 0, "sense"); CUR.sensors++; var v = w.paint[w.robot.r + "," + w.robot.c]; return _.num(v == null ? NaN : v); };
    B.scan = function (a) { var w = noRun("scan"); need(a, 0, 0, "scan"); CUR.sensors++; var out = [], r = w.robot.r, c = w.robot.c; for (;;) { r += DR[w.robot.d]; c += DC[w.robot.d]; if (wall(w, r, c)) break; var v = w.paint[r + "," + c]; out.push(v == null ? NaN : v); } return _.rowv(out); };
    B.pos = function (a) { var w = noRun("pos"); need(a, 0, 0, "pos"); return _.rowv([w.robot.r + 1, w.robot.c + 1]); };
    B.heading = function (a) { var w = noRun("heading"); need(a, 0, 0, "heading"); return _.str(DIRS[w.robot.d]); };
  }
  function run(code, w0, opts) {
    install(); var w = clone(w0), R = { w: w, trace: [], actions: 0, sensors: 0 }; CUR = R; var res;
    try { res = ML.run(String(code), { maxSteps: 400000, maxMs: (opts && opts.maxMs) || 1500 }); } finally { CUR = null; }
    var err = res.error ? res.error.message + (res.error.line ? " (line " + res.error.line + ")" : "") : null;
    return { ok: !err, error: err, output: res.output || "", vars: res.vars || {}, trace: R.trace, w: w, actions: R.actions };
  }
  function varNum(res, name) { var v = res.vars[name]; return v && v.t === "m" ? v.d.slice() : null; }
  function codeLines(code) { return String(code).split("\n").filter(function (l) { l = l.trim(); return l && l[0] !== "%"; }).length; }

  /* ---------- the jobs ---------- */
  function room(h, wd) { var rows = []; for (var r = 0; r < h; r++) { var s = ""; for (var c = 0; c < wd; c++) s += r === 0 || c === 0 || r === h - 1 || c === wd - 1 ? "#" : "."; rows.push(s); } return rows; }
  function put(rows, r, c, ch) { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); }
  function atTarget(res) { var w = res.w; return w.target && w.robot.r === w.target.r && w.robot.c === w.target.c; }
  function outNum(res) { var m = res.output.match(/-?\d+(\.\d+)?/g); return m ? +m[m.length - 1] : NaN; }

  var JOBS = [
    // Getting started: commands in sequence
    { id: "g1", ch: "Getting started", title: "Roll out", par: 4, lines: 1, teach: "A script runs top to bottom. move(n) is a function call with one input.",
      make: function () { var g = room(3, 7); put(g, 1, 5, "T"); return world(g, { robot: { r: 1, c: 1, d: 1 } }); }, ok: atTarget, starter: "% Drive to the green square\nmove(1)\n", solution: "move(4)" },
    { id: "g2", ch: "Getting started", title: "Round the corner", par: 7, lines: 3, teach: "Commands with no inputs still need their brackets: turnLeft().",
      make: function () { var g = room(6, 6); put(g, 4, 4, "T"); for (var r = 1; r < 4; r++) put(g, r, 2, "#"); put(g, 1, 2, "."); g[1] = "#....#"; g[2] = "####.#"; g[3] = "####.#"; return world(g, { robot: { r: 1, c: 1, d: 1 } }); }, ok: atTarget, starter: "move(3)\n", solution: "move(3)\nturnRight()\nmove(3)" },
    { id: "g3", ch: "Getting started", title: "Pick and place", par: 10, lines: 6, teach: "Order matters: you must pick() before you can drop().",
      make: function () { var g = room(3, 8); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: [{ r: 1, c: 3, w: 4, id: 1 }], bins: [{ r: 1, c: 6, label: "A" }] }); }, ok: function (r) { return r.w.delivered.length === 1; }, starter: "move(2)\n", solution: "move(2)\npick()\nmove(3)\ndrop()" },
    { id: "g4", ch: "Getting started", title: "Comments and semicolons", par: 8, lines: 4, teach: "% starts a comment; a semicolon hides a result. Neither changes what the robot does.",
      make: function () { var g = room(5, 7); put(g, 3, 5, "T"); return world(g, { robot: { r: 1, c: 1, d: 2 } }); }, ok: atTarget, starter: "% down two, then right four\n", solution: "move(2);\nturnLeft();\nmove(4);" },
    { id: "g5", ch: "Getting started", title: "Two parts", par: 20, lines: 12, teach: "Repeating yourself works — but notice the pattern. Loops are coming.",
      make: function () { var g = room(3, 9); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: [{ r: 1, c: 2, w: 2, id: 1 }, { r: 1, c: 4, w: 3, id: 2 }], bins: [{ r: 1, c: 7, label: "A" }] }); },
      ok: function (r) { return r.w.delivered.length === 2; }, starter: "", solution: "move(1)\npick()\nmove(5)\ndrop()\nturnLeft()\nturnLeft()\nmove(3)\npick()\nturnLeft()\nturnLeft()\nmove(3)\ndrop()" },
    { id: "g6", ch: "Getting started", title: "Read the floor", par: 3, lines: 3, teach: "sense() returns a value. Store it in a variable: x = sense(). disp(x) prints it.",
      make: function () { var g = room(3, 6); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: { "1,3": 7 } }); }, ok: function (r) { return outNum(r) === 7; }, starter: "move(2)\n", solution: "move(2)\nx = sense();\ndisp(x)" },
    // Variables and arithmetic
    { id: "v1", ch: "Variables", title: "Add two readings", par: 6, lines: 5, teach: "Variables hold numbers between commands: a = sense(); ... total = a + b.",
      make: function (s) { var r = rng(s), g = room(3, 7); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: { "1,2": ri(r, 1, 9), "1,5": ri(r, 1, 9) } }); },
      ok: function (res, w0) { return outNum(res) === w0.paint["1,2"] + w0.paint["1,5"]; }, starter: "move(1)\na = sense();\n", solution: "move(1)\na = sense();\nmove(3)\nb = sense();\ndisp(a + b)", cases: 3 },
    { id: "v2", ch: "Variables", title: "Move by the number", par: 12, lines: 3, teach: "A variable can be an input: n = sense(); move(n).",
      make: function (s) { var r = rng(s), n = ri(r, 2, 6), g = room(3, 10); put(g, 1, 1 + n + 1, "T"); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: { "1,2": n } }); },
      ok: atTarget, starter: "move(1)\n", solution: "move(1)\nn = sense();\nmove(n)", cases: 3 },
    { id: "v3", ch: "Variables", title: "Heavy or light", par: 8, lines: 4, teach: "Arithmetic follows BODMAS: the scale shows grams, the job wants kilograms × 2.",
      make: function (s) { var r = rng(s), g = room(3, 6); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: [{ r: 1, c: 2, w: ri(r, 2, 9), id: 1 }] }); },
      ok: function (res, w0) { return Math.abs(outNum(res) - w0.parts[0].w * 2) < 1e-9; }, starter: "move(1)\npick()\n", solution: "move(1)\npick()\nw = weight();\ndisp(2*w)", cases: 3 },
    { id: "v4", ch: "Variables", title: "Where am I?", par: 5, lines: 3, teach: "pos() returns a 1×2 array: p(1) is the row, p(2) the column.",
      make: function (s) { var r = rng(s), n = ri(r, 2, 5), g = room(4, 9); return world(g, { robot: { r: 1, c: 1, d: 1 }, steps: n, paint: { "1,1": n } }); },
      ok: function (res, w0) { return outNum(res) === 2 + w0.steps; }, starter: "n = sense();\n", solution: "n = sense();\nmove(n)\np = pos(); disp(p(2))", cases: 3 },
    // Arrays
    { id: "a1", ch: "Arrays", title: "Scan the line", par: 2, lines: 2, teach: "scan() returns a row vector. sum(v) adds its elements.",
      make: function (s) { var r = rng(s), g = room(3, 9), p = {}; for (var c = 2; c < 8; c++) p["1," + c] = ri(r, 0, 9); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p }); },
      ok: function (res, w0) { var t = 0; for (var c = 2; c < 8; c++) t += w0.paint["1," + c]; return outNum(res) === t; }, starter: "v = scan();\n", solution: "v = scan();\ndisp(sum(v))", cases: 3 },
    { id: "a2", ch: "Arrays", title: "Biggest reading", par: 2, lines: 2, teach: "max(v) gives the largest element; [m, k] = max(v) also gives its position k.",
      make: function (s) { var r = rng(s), g = room(3, 10), p = {}; for (var c = 2; c < 9; c++) p["1," + c] = ri(r, 0, 50); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p }); },
      ok: function (res, w0) { var m = -1; for (var c = 2; c < 9; c++) m = Math.max(m, w0.paint["1," + c]); return outNum(res) === m; }, starter: "", solution: "v = scan();\ndisp(max(v))", cases: 3 },
    { id: "a3", ch: "Arrays", title: "Go to the biggest", par: 10, lines: 3, teach: "Indexing starts at 1. [~, k] = max(v) tells you how many squares to move.",
      make: function (s) { var r = rng(s), g = room(3, 10), p = {}, best = 0, bc = 2; for (var c = 2; c < 9; c++) { var v = ri(r, 0, 50); if (c === 2 + ri(r, 0, 6)) v = 60 + c; p["1," + c] = v; if (v > best) { best = v; bc = c; } } put(g, 1, bc, "T"); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p }); },
      ok: atTarget, starter: "v = scan();\n", solution: "v = scan();\n[~, k] = max(v);\nmove(k)", cases: 4 },
    { id: "a4", ch: "Arrays", title: "Count the zeros", par: 2, lines: 2, teach: "Comparisons make logical arrays: v == 0. sum() counts the trues.",
      make: function (s) { var r = rng(s), g = room(3, 11), p = {}; for (var c = 2; c < 10; c++) p["1," + c] = r() < .4 ? 0 : ri(r, 1, 9); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p }); },
      ok: function (res, w0) { var n = 0; for (var c = 2; c < 10; c++) n += w0.paint["1," + c] === 0 ? 1 : 0; return outNum(res) === n; }, starter: "v = scan();\n", solution: "v = scan();\ndisp(sum(v == 0))", cases: 4 },
    { id: "a5", ch: "Arrays", title: "Average load", par: 2, lines: 2, teach: "mean(v) = sum(v)/numel(v). Use round() if the job asks for a whole number.",
      make: function (s) { var r = rng(s), g = room(3, 9), p = {}; for (var c = 2; c < 8; c++) p["1," + c] = ri(r, 0, 20); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p }); },
      ok: function (res, w0) { var t = 0; for (var c = 2; c < 8; c++) t += w0.paint["1," + c]; return outNum(res) === Math.round(t / 6); }, starter: "v = scan();\n", solution: "v = scan();\ndisp(round(mean(v)))", cases: 4 },
    { id: "a6", ch: "Arrays", title: "Readings above five", par: 2, lines: 2, teach: "Logical indexing keeps only some elements: v(v > 5).",
      make: function (s) { var r = rng(s), g = room(3, 11), p = {}; for (var c = 2; c < 10; c++) p["1," + c] = ri(r, 0, 9); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p }); },
      ok: function (res, w0) { var t = 0; for (var c = 2; c < 10; c++) if (w0.paint["1," + c] > 5) t += w0.paint["1," + c]; return outNum(res) === t; }, starter: "v = scan();\n", solution: "v = scan();\ndisp(sum(v(v > 5)))", cases: 4 },
    { id: "a7", ch: "Arrays", title: "Store as you go", par: 14, lines: 6, teach: "Grow an array inside a script: w(end+1) = weight(). Then work on all of it at once.",
      make: function (s) { var r = rng(s), g = room(3, 8), parts = []; for (var c = 2; c < 6; c++) parts.push({ r: 1, c: c, w: ri(r, 1, 9), id: c }); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: parts, bins: [{ r: 1, c: 6, label: "A" }] }); },
      ok: function (res, w0) { var t = w0.parts.reduce(function (a, p) { return a + p.w; }, 0), v = varNum(res, "w"); return !!v && v.length === 4 && v.reduce(function (a, b) { return a + b; }, 0) === t; },
      starter: "w = [];\n", solution: "w = [];\nfor k = 1:4\n  move(1); pick(); w(end+1) = weight(); drop();\nend", cases: 3 },
    // Control flow
    { id: "c1", ch: "Control flow", title: "Loop it", par: 30, lines: 3, teach: "for k = 1:n ... end repeats the body n times.",
      make: function (s) { var r = rng(s), n = ri(r, 3, 6), g = room(3, 10), parts = []; for (var c = 1; c <= n; c++) parts.push({ r: 1, c: 1, w: 1, id: c }); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: [{ r: 1, c: 1, w: 1, id: 0 }], bins: [], target: { r: 1, c: 8 } }); },
      ok: atTarget, starter: "for k = 1:7\n  \nend\n", solution: "for k = 1:7\n  move(1)\nend", cases: 1 },
    { id: "c2", ch: "Control flow", title: "While there is room", par: 12, lines: 3, teach: "while condition ... end: use frontIsClear() when you don't know the distance.",
      make: function (s) { var r = rng(s), n = ri(r, 3, 9), g = room(3, n + 3); put(g, 1, n + 1, "T"); return world(g, { robot: { r: 1, c: 1, d: 1 } }); }, ok: atTarget, starter: "while frontIsClear()\n  \nend\n", solution: "while frontIsClear()\n  move(1)\nend", cases: 4 },
    { id: "c3", ch: "Control flow", title: "If heavy", par: 16, lines: 9, teach: "if ... else ... end chooses. Parts over 5 kg go to bin H, the rest to bin L.",
      make: function (s) { var r = rng(s), g = room(5, 7); return world(g, { robot: { r: 2, c: 1, d: 1 }, parts: [{ r: 2, c: 2, w: ri(r, 1, 10), id: 1 }], bins: [{ r: 1, c: 2, label: "H" }, { r: 3, c: 2, label: "L" }] }); },
      ok: function (res, w0) { var d = res.w.delivered[0]; return !!d && d.bin === (w0.parts[0].w > 5 ? "H" : "L"); },
      starter: "move(1); pick();\nif weight() > 5\n  \nelse\n  \nend\n", solution: "move(1); pick();\nif weight() > 5\n  turnLeft(); move(1); drop();\nelse\n  turnRight(); move(1); drop();\nend", cases: 6 },
    { id: "c4", ch: "Control flow", title: "Clear the conveyor", par: 120, lines: 9, teach: "Loops and ifs together: walk the belt, pick up every part, drop them all in the bin at the end.",
      make: function (s) { var r = rng(s), n = 8, g = room(3, n + 3), parts = [], id = 0; for (var c = 2; c <= n; c++) if (r() < .5) parts.push({ r: 1, c: c, w: ri(r, 1, 9), id: id++ }); if (!parts.length) parts.push({ r: 1, c: 3, w: 2, id: 99 }); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: parts, bins: [{ r: 1, c: n + 1, label: "A" }], paint: (function () { var p = {}; parts.forEach(function (q) { p["1," + q.c] = 1; }); return p; })() }); },
      ok: function (res, w0) { return res.w.delivered.length === w0.parts.length; },
      starter: "% sense() is 1 where a part waits\n", solution: "n = 0;\nwhile frontIsClear()\n  move(1)\n  if sense() == 1\n    pick(); c = pos(); here = c(2);\n    while frontIsClear(); move(1); end\n    drop(); turnLeft(); turnLeft(); move(pos()*[0;1] - here); turnLeft(); turnLeft();\n  end\nend", cases: 4 },
    { id: "c5", ch: "Control flow", title: "Find the exit", par: 60, lines: 8, teach: "A wall-follower: keep the wall on your right. Loops plus conditions solve mazes.",
      make: function (s) { var mz = [["#########", "#.......#", "#.#####.#", "#.#...#.#", "#.#.#.#.#", "#...#..T#", "#########"], ["#########", "#...#...#", "#.#.#.#.#", "#.#...#.#", "#.#####.#", "#......T#", "#########"], ["#########", "#.....#.#", "#####.#.#", "#.....#.#", "#.#####.#", "#......T#", "#########"]][s % 3]; return world(mz, { robot: { r: 1, c: 1, d: 1 } }); },
      ok: atTarget, starter: "for k = 1:200\n  % keep the wall on your right\nend\n", solution: "while true\n  p = pos(); if (p(1) == 6 && p(2) == 8), break; end\n  turnRight();\n  while ~frontIsClear()\n    turnLeft();\n  end\n  move(1);\nend", cases: 3 },
    { id: "c6", ch: "Control flow", title: "Stop on a zero", par: 12, lines: 4, teach: "break leaves a loop early. Drive until the floor reads 0.",
      make: function (s) { var r = rng(s), g = room(3, 12), p = {}, z = ri(r, 3, 9); for (var c = 2; c < 11; c++) p["1," + c] = c === z ? 0 : ri(r, 1, 9); put(g, 1, z, "T"); return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p }); },
      ok: atTarget, starter: "while true\n  move(1)\n  \nend\n", solution: "while true\n  move(1)\n  if sense() == 0, break; end\nend", cases: 4 },
    // Functions-flavoured and the finale
    { id: "f1", ch: "Mastery", title: "Sort by weight", par: 70, lines: 16, teach: "sort() gives an order; [~, idx] = sort(w) tells you which part goes where.",
      make: function (s) { var r = rng(s), g = room(4, 8), ws = [ri(r, 1, 9), ri(r, 10, 19), ri(r, 20, 29)].sort(function () { return r() - .5; }), parts = ws.map(function (w, i) { return { r: 1, c: 2 + i, w: w, id: i }; }); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: parts, bins: [{ r: 2, c: 2, label: "1" }, { r: 2, c: 3, label: "2" }, { r: 2, c: 4, label: "3" }] }); },
      ok: function (res, w0) { var order = w0.parts.slice().sort(function (a, b) { return a.w - b.w; }); return res.w.delivered.length === 3 && res.w.delivered.every(function (d) { return order[+d.bin - 1].w === d.w; }); },
      starter: "% weigh all three, then deliver lightest to bin 1\n", solution: "w = zeros(1,3);\nfor k = 1:3\n  move(1); pick(); w(k) = weight(); drop();\nend\n[~, idx] = sort(w); place(idx) = 1:3;\nturnLeft(); turnLeft(); move(3); turnLeft(); turnLeft();\nfor k = 1:3\n  move(1); pick(); d = place(k) - k; turnRight(); move(1);\n  if d > 0, turnLeft(); move(d); drop(); turnLeft(); turnLeft(); move(d); turnRight();\n  elseif d < 0, turnRight(); move(-d); drop(); turnLeft(); turnLeft(); move(-d); turnLeft();\n  else, drop(); turnLeft(); turnLeft();\n  end\n  move(1); turnRight();\nend", cases: 4 },
    { id: "f2", ch: "Mastery", title: "Night inspection", par: 80, lines: 12, teach: "Nested loops visit a whole grid: row by row, the classic raster scan.",
      make: function (s) { var r = rng(s), g = room(5, 7), p = {}, tot = 0; for (var rr = 1; rr <= 3; rr++) for (var c = 1; c <= 5; c++) { var v = ri(r, 0, 9); p[rr + "," + c] = v; tot += v; } return world(g, { robot: { r: 1, c: 1, d: 1 }, paint: p, total: tot }); },
      ok: function (res, w0) { return outNum(res) === w0.total; }, starter: "total = 0;\n", solution: "total = 0;\nfor row = 1:3\n  for k = 1:5\n    total = total + sense();\n    if k < 5, move(1); end\n  end\n  if row < 3\n    if mod(row,2) == 1, turnRight(); move(1); turnRight(); else, turnLeft(); move(1); turnLeft(); end\n  end\nend\ndisp(total)", cases: 3 },
    { id: "f3", ch: "Mastery", title: "Count Entropy's scrambler", par: 120, lines: 16, teach: "The whole toolkit: arrays to remember, loops to repeat, ifs to decide. Real robots are programmed exactly like this.",
      make: function (s) { var r = rng(s), g = room(3, 10), parts = [], id = 0; for (var c = 2; c <= 7; c++) parts.push({ r: 1, c: c, w: ri(r, 1, 12), id: id++ }); return world(g, { robot: { r: 1, c: 1, d: 1 }, parts: parts, bins: [{ r: 1, c: 8, label: "H" }] }); },
      ok: function (res, w0) { var heavy = w0.parts.filter(function (p) { return p.w > 6; }).length; return res.w.delivered.length === heavy && res.w.delivered.every(function (d) { return d.w > 6; }) && res.w.parts.length === w0.parts.length - heavy; },
      starter: "% only parts over 6 kg go to bin H; leave the rest where they are\n", solution: "for c = 2:7\n  move(1); pick();\n  if weight() > 6\n    move(8 - c); drop(); turnLeft(); turnLeft(); move(8 - c); turnLeft(); turnLeft();\n  else\n    drop();\n  end\nend", cases: 4 }
  ];
  JOBS.forEach(function (j) { if (j.id === "c1") j.make = function () { var g = room(3, 10); put(g, 1, 8, "T"); return world(g, { robot: { r: 1, c: 1, d: 1 } }); }; });
  var CHAPTERS = ["Getting started", "Variables", "Arrays", "Control flow", "Mastery"];

  /* run a program on every test case of a job; result: {pass, cases:[{ok, res, why}], actions, lines} */
  function check(job, code, seed) {
    var n = job.cases || 1, out = [], pass = true, acts = 0;
    for (var i = 0; i < n; i++) { var w0 = job.make((seed || 0) * 31 + i * 7 + 1), res = run(code, w0); var ok = res.ok && !!job.ok(res, w0); if (!ok) pass = false; acts = Math.max(acts, res.actions); out.push({ ok: ok, res: res, w0: w0, why: res.error || (ok ? "" : "The job is not done yet.") }); }
    return { pass: pass, cases: out, actions: acts, lines: codeLines(code) };
  }
  function stars(job, ch) { if (!ch.pass) return 0; return 1 + (ch.actions <= job.par ? 1 : 0) + (ch.lines <= job.lines ? 1 : 0); }

  /* Work orders: endless random jobs drawn from the templates above with new floors every time */
  var POOL = ["v1", "v2", "a1", "a2", "a3", "a4", "a6", "c2", "c3", "c6", "f2", "f3"];
  function workOrder(round, seed) { var r = rng(seed * 977 + round * 131), id = POOL[Math.floor(r() * POOL.length)], j = JOBS.filter(function (x) { return x.id === id; })[0]; return { job: j, seed: seed * 13 + round }; }

  return { run: run, check: check, stars: stars, JOBS: JOBS, CHAPTERS: CHAPTERS, workOrder: workOrder, codeLines: codeLines, DIRS: DIRS, wall: wall, install: install, MAX_ACTIONS: MAX_ACTIONS };
});
