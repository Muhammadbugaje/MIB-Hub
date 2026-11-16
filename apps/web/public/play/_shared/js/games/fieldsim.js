/* Volt City charge-puzzle physics, shared by the game and its solver test (node). Coulomb's law with superposition:
 * F = k q Q / r² along the line between charges; like charges repel, unlike attract. Charges are treated as small
 * spheres (softening 3 cm) so the force stays finite. Board cell = 0.1 m; probe q = +0.5 µC, m = 20 g (game mass). */
(function (root) {
  "use strict";
  var K = 8.99e9, CELL = 0.1, Q = 0.5e-6, QP = 0.5e-6, M = 0.02, SOFT = 0.03, COLS = 12, ROWS = 7;
  function field(charges, x, y) { // E at (x, y) in metres → [Ex, Ey] (N/C)
    var ex = 0, ey = 0;
    for (var i = 0; i < charges.length; i++) { var c = charges[i], dx = x - (c.c + .5) * CELL, dy = y - (c.r + .5) * CELL, r2 = dx * dx + dy * dy + SOFT * SOFT, r = Math.sqrt(r2), e = K * Q * c.s / r2; ex += e * dx / r; ey += e * dy / r; }
    return [ex, ey];
  }
  function simulate(level, charges, cb) { // returns {ok, path, why}
    var p = { x: (level.src[0] + .5) * CELL, y: (level.src[1] + .5) * CELL, vx: level.v[0], vy: level.v[1] }, dt = 1 / 240, path = [[p.x, p.y]];
    var tx = (level.dst[0] + .5) * CELL, ty = (level.dst[1] + .5) * CELL, walls = {};
    level.walls.forEach(function (w) { walls[w[0] + "," + w[1]] = 1; });
    for (var t = 0; t < 8; t += dt) {
      var E = field(charges, p.x, p.y);
      p.vx += QP * E[0] / M * dt; p.vy += QP * E[1] / M * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      path.push([p.x, p.y]); if (cb) cb(p, t);
      if (Math.hypot(p.x - tx, p.y - ty) < CELL * .45) return { ok: true, path: path, t: t };
      var cc = Math.floor(p.x / CELL), rr = Math.floor(p.y / CELL);
      if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) return { ok: false, path: path, why: "The probe left the board." };
      if (walls[cc + "," + rr]) return { ok: false, path: path, why: "The probe hit an insulating wall." };
      for (var i = 0; i < charges.length; i++) { var c = charges[i]; if (Math.hypot(p.x - (c.c + .5) * CELL, p.y - (c.r + .5) * CELL) < CELL * .25) return { ok: false, path: path, why: "The probe crashed into a charge it was attracted to." }; }
    }
    return { ok: false, path: path, why: "The probe ran out of time (8 s)." };
  }
  // rows 0..6 top to bottom; s = +1 or −1; fixed charges cannot be moved.
  var LEVELS = [
    { name: "North substation", hint: "Like charges repel. A + charge placed near the probe's path pushes it away.", give: 2, src: [0, 5], v: [0.55, 0], dst: [11, 2], preview: true,
      walls: [[6, 5], [6, 6], [7, 5], [7, 6]], fixed: [] },
    { name: "West school", hint: "Unlike charges attract. A − charge can pull the probe round a corner.", give: 2, src: [0, 1], v: [0.5, 0], dst: [10, 5], preview: false,
      walls: [[5, 0], [5, 1], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2]], fixed: [] },
    { name: "East hospital", hint: "Superposition: fields add as vectors. Cancel the fixed charge's pull with one of your own.", give: 2, src: [0, 3], v: [0.6, 0], dst: [11, 3], preview: false,
      walls: [[6, 0], [6, 6]], fixed: [{ c: 5, r: 5, s: -1 }, { c: 8, r: 1, s: -1 }] },
    { name: "South market", hint: "Plan the whole field: the probe feels every charge at once, strongest from the nearest (1/r²).", give: 3, src: [0, 5], v: [0.5, 0], dst: [11, 1], preview: false,
      walls: [[4, 0], [4, 1], [4, 2], [4, 3], [8, 3], [8, 4], [8, 5], [8, 6]], fixed: [{ c: 6, r: 6, s: 1 }] }
  ];
  root.VoltSim = { field: field, simulate: simulate, LEVELS: LEVELS, CELL: CELL, COLS: COLS, ROWS: ROWS, K: K, Q: Q, QP: QP, M: M };
  if (typeof module !== "undefined") module.exports = root.VoltSim;
})(typeof window !== "undefined" ? window : globalThis);
