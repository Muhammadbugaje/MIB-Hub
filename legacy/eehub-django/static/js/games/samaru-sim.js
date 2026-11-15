/* Freshers School Life — pure simulation rules (no DOM, no canvas), shared by the browser game and the Node tests.
   World geometry, road graph and routing, collision, vehicle physics, needs (hunger, energy), levels,
   the mission engine, endless job and race generators, cheats, saves and multiplayer packing.
   Units: metres, seconds, radians. One real second is one game minute. */
(function (root, f) { if (typeof module === "object" && module.exports) module.exports = f(); else root.SamaruSim = f(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var S = {}, CELL = 80;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function key(cx, cy) { return (cx + 512) * 4096 + (cy + 512); }
  S.clamp = clamp;
  S.rng = function (seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  S.hash = function (a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  /* ---------- vehicles ---------- */
  // lvl: player level that unlocks the licence. max m/s, acc m/s², turn rad/s, grip (higher = less slide), seats = can carry a passenger.
  S.VEH = {
    skate: { two: 1, name: "Skateboard", lvl: 1, max: 7, acc: 4.2, turn: 2.5, grip: 7, len: 1.0, wid: .45, rent: 0, effort: .1 },
    bike: { two: 1, name: "Bicycle", lvl: 1, max: 9, acc: 3.8, turn: 2.3, grip: 9, len: 1.8, wid: .55, rent: 0, effort: .14 },
    scooter: { two: 1, name: "Scooter", lvl: 2, max: 14, acc: 5.5, turn: 2.3, grip: 8, len: 1.7, wid: .6, rent: 50, seats: 1 },
    okada: { two: 1, name: "Okada", lvl: 3, max: 20, acc: 8, turn: 2.1, grip: 7, len: 2.1, wid: .8, rent: 100, seats: 2 },
    keke: { name: "Keke", lvl: 4, max: 14, acc: 5, turn: 1.9, grip: 8, len: 2.8, wid: 1.4, rent: 150, seats: 3 },
    car: { name: "Saloon car", lvl: 5, max: 28, acc: 7.5, turn: 1.8, grip: 7, pwr: .35, len: 4.4, wid: 1.9, rent: 300, seats: 4 },
    sport: { name: "Sports car", lvl: 8, max: 40, acc: 12, turn: 1.9, grip: 6, pwr: .62, len: 4.5, wid: 2.0, rent: 800, seats: 1 },
    plane: { name: "Light aircraft", lvl: 10, max: 62, acc: 9, turn: 1.15, grip: 4, len: 7.5, wid: 9.5, rent: 2500, takeoff: 27, seats: 1 }
  };
  S.VEH_ORDER = ["skate", "bike", "scooter", "okada", "keke", "car", "sport", "plane"];
  // inp: {throttle -1..1, steer -1..1, brake (handbrake)}. surf: top-speed factor of the ground (1 road, <1 off-road).
  // The engine pushes hard up to about half speed and then tapers. Steering is eased in and out (v.st), is slow to
  // bite when crawling, and tightens less at speed. Tyres hold the line; only the handbrake lets the tail slide.
  S.stepVehicle = function (v, spec, inp, dt, surf) {
    var fx = Math.cos(v.a), fy = Math.sin(v.a), vf = v.vx * fx + v.vy * fy, vl = -v.vx * fy + v.vy * fx;
    var soft = surf == null ? 1 : 1 - (1 - surf) * .6, top = spec.max * soft * (v.boost || 1), th = clamp(inp.throttle || 0, -1, 1), rev = Math.max(3, spec.max * .28), hb = !!inp.brake, two = !!spec.two, vf0 = vf;
    // pedal feel: the throttle and the brake come in over about a tenth of a second and let go faster, so a press is
    // a push, not a jolt. Brakes are what the machine can really do: a bicycle about 0.75 g, a car about 1 g.
    var te = v.thE || 0, rate = (Math.abs(th) > Math.abs(te) && th * te >= 0 ? 9 : 18) * dt; te = Math.abs(th - te) <= rate ? th : te + Math.sign(th - te) * rate; v.thE = te; th = te;
    var brk = two ? 6 + spec.acc * .35 : 9 + spec.acc * .45;
    if (th > 0) { if (vf < -.3) vf = Math.min(0, vf + brk * th * dt); else vf += spec.acc * (v.push || 1) * (v.loadK || 1) * th * dt * clamp((1 - vf / top) / .45, 0, 1); }
    else if (th < 0) { if (vf > .4) vf = Math.max(0, vf + brk * th * dt); else vf += spec.acc * .7 * th * dt * clamp((1 + vf / rev) / .45, 0, 1); }
    // handbrake: the rear wheel locks. It scrubs speed gently (the foot brake is the one that stops you) and lets the tail go.
    if (hb) { var b = (two ? 2.4 : 2.6) * dt; vf = Math.abs(vf) <= b ? 0 : vf - Math.sign(vf) * b; }
    if (th === 0) { var roll = (.7 + Math.abs(vf) * .09) * dt; vf = Math.abs(vf) <= roll ? 0 : vf - Math.sign(vf) * roll; }
    if (vf > top) vf -= (vf - top) * Math.min(1, 1.6 * dt);
    // steering is eased: a tap is a small correction, a hold winds on lock progressively (slower the faster you go),
    // and letting go centres it. Inputs under a few percent are ignored, so a drifting stick or camera cannot twitch it.
    var sv = Math.abs(vf), want = clamp(inp.steer || 0, -1, 1); if (Math.abs(want) < .06) want = 0;
    var st = v.st || 0, rate = (want === 0 ? 5 : want * st < 0 ? 7 : 2.2 + 2.4 * (1 - clamp(sv / spec.max, 0, 1))) * dt;
    st = Math.abs(want - st) <= rate ? want : st + Math.sign(want - st) * rate; v.st = st;
    var low = clamp(sv / (hb ? 2.5 : 5), 0, 1), yaw = st * spec.turn * low / (1 + Math.pow(sv / (spec.max * .75), 2) * 1.1) * (vf < 0 ? -1 : 1);
    // weight transfer: braking loads the front tyres and the nose turns in a little sharper; full power unloads them
    var ax = (vf - vf0) / Math.max(dt, 1e-4); v.ax = (v.ax || 0) + (ax - (v.ax || 0)) * (1 - Math.exp(-dt * 10)); yaw *= 1 + clamp(-v.ax * Math.sign(vf || 1) / 40, -.08, .15);
    // rear grip: full when rolling, low while the handbrake is on, and reduced under full power in a hard, fast
    // corner for the machines with the power to do it (spec.pwr). It eases back, so a slide is caught, not snapped.
    var pwr = spec.pwr && th > .9 && Math.abs(st) > .85 && sv > spec.max * .45 ? spec.pwr : 0, gw = hb && sv > 2 ? .08 : pwr ? 1 - pwr : 1, gk = v.gk == null ? 1 : v.gk;
    gk += (gw - gk) * (1 - Math.exp(-dt * (gw < gk ? 9 : th > .3 && v.slide > 1.5 ? 1.5 : 3))); v.gk = gk;
    // with the tail loose the nose turns in harder; and a sliding machine always wants to point where it is going,
    // which is what lets a drift be held on the throttle, caught with opposite lock, and never wound into a spin
    var slip = Math.atan2(vl, Math.max(2, sv));
    yaw = yaw * (1 + (1 - gk) * (hb ? (two ? .5 : .6) : .25)) + slip * (hb ? .15 : 2.2) * clamp(sv / 4, 0, 1) * (vf < 0 ? -1 : 1);
    var wx = fx * vf - fy * vl, wy = fy * vf + fx * vl;
    v.a += yaw * dt; v.yaw = yaw; fx = Math.cos(v.a); fy = Math.sin(v.a);
    vf = wx * fx + wy * fy; vl = (-wx * fy + wy * fx) * Math.exp(-spec.grip * (.3 + 2.9 * gk) * (1 + Math.max(0, Math.abs(slip) - (two ? .32 : .6)) * (two ? 6 : 3)) * dt);
    if (v.slide > 1.5 && !hb) vf -= vf * Math.min(.35, v.slide * .012) * dt; // a slide bleeds speed gradually
    v.vx = fx * vf - fy * vl; v.vy = fy * vf + fx * vl;
    v.x += v.vx * dt; v.y += v.vy * dt; v.speed = vf; v.slide = Math.abs(vl); v.slip = Math.atan2(vl, Math.max(1, Math.abs(vf))); v.lock = hb && Math.hypot(vf, vl) > 1.5;
    return v;
  };

  /* ---------- world: buildings grid, road graph ---------- */
  function segDist(px, py, ax, ay, bx, by, out) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    var qx = ax + dx * t, qy = ay + dy * t, ex = px - qx, ey = py - qy;
    if (out) { out.x = qx; out.y = qy; out.t = t; }
    return Math.sqrt(ex * ex + ey * ey);
  }
  S.segDist = segDist;
  function inPoly(p, x, y) {
    var c = false, n = p.length;
    for (var i = 0, j = n - 2; i < n; j = i, i += 2) { var yi = p[i + 1], yj = p[j + 1]; if ((yi > y) !== (yj > y) && x < (p[j] - p[i]) * (y - yi) / (yj - yi) + p[i]) c = !c; }
    return c;
  }
  S.inPoly = inPoly;
  S.buildWorld = function (map) {
    var W = { bounds: map.bounds, b: [], bgrid: {}, roads: [], nodes: [], rgrid: {}, areas: [], water: [], pois: map.pois || [], props: map.props || [], tokens: map.tokens || null, flat: map.flat || null, lim: map.limit || null, townY: map.townY == null ? -640 : map.townY, designed: !!map.designed, cell: CELL };
    map.buildings.forEach(function (raw, i) {
      var p = raw[2], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0, n = p.length / 2;
      for (var k = 0; k < p.length; k += 2) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); y0 = Math.min(y0, p[k + 1]); y1 = Math.max(y1, p[k + 1]); sx += p[k]; sy += p[k + 1]; }
      var b = { i: i, n: raw[0] || "", h: raw[1], p: p, st: raw[3] || null, x0: x0, y0: y0, x1: x1, y1: y1, cx: sx / n, cy: sy / n };
      W.b.push(b);
      for (var cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (var cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) { var kk = key(cx, cy); (W.bgrid[kk] || (W.bgrid[kk] = [])).push(i); }
    });
    var nodeAt = {};
    function node(x, y) { var k = x + "," + y; if (nodeAt[k] == null) { nodeAt[k] = W.nodes.length; W.nodes.push({ x: x, y: y, e: [] }); } return nodeAt[k]; }
    map.roads.forEach(function (raw) {
      var p = raw[3]; if (p.length < 4) return;
      var len = 0; for (var k = 2; k < p.length; k += 2) len += Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]);
      if (len < 1) return;
      var r = { i: W.roads.length, k: raw[0], w: raw[1], n: raw[2] || "", p: p, len: len, a: node(p[0], p[1]), b: node(p[p.length - 2], p[p.length - 1]), drive: raw[0] !== "x" };
      W.roads.push(r); W.nodes[r.a].e.push(r.i); W.nodes[r.b].e.push(r.i);
      for (var s = 0; s + 2 < p.length; s += 2) {
        var m = r.w / 2 + 2, ax = Math.min(p[s], p[s + 2]) - m, bx = Math.max(p[s], p[s + 2]) + m, ay = Math.min(p[s + 1], p[s + 3]) - m, by = Math.max(p[s + 1], p[s + 3]) + m;
        for (var cx = Math.floor(ax / CELL); cx <= Math.floor(bx / CELL); cx++) for (var cy = Math.floor(ay / CELL); cy <= Math.floor(by / CELL); cy++) { var kk = key(cx, cy); (W.rgrid[kk] || (W.rgrid[kk] = [])).push(r.i, s); }
      }
    });
    map.areas.forEach(function (raw) {
      var p = raw[2], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (var k = 0; k < p.length; k += 2) { x0 = Math.min(x0, p[k]); x1 = Math.max(x1, p[k]); y0 = Math.min(y0, p[k + 1]); y1 = Math.max(y1, p[k + 1]); }
      var a = { k: raw[0], n: raw[1] || "", p: p, x0: x0, y0: y0, x1: x1, y1: y1 };
      W.areas.push(a); if (a.k === "water" || a.k === "reservoir") W.water.push(a);
    });
    return W;
  };
  S.buildingsNear = function (W, x0, y0, x1, y1, out, seen) {
    out.length = 0;
    for (var cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (var cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
      var l = W.bgrid[key(cx, cy)]; if (!l) continue;
      for (var i = 0; i < l.length; i++) { var b = W.b[l[i]]; if (b.x1 < x0 || b.x0 > x1 || b.y1 < y0 || b.y0 > y1) continue; if (seen) { if (seen[b.i] === seen.stamp) continue; seen[b.i] = seen.stamp; } out.push(b); }
    }
    return out;
  };
  var tmpB = [], tmpQ = { x: 0, y: 0, t: 0 };
  // Push a circle (x, y, r) out of every building. Returns {x, y, hit, nx, ny}.
  S.push = function (W, x, y, r) {
    var hit = false, nx = 0, ny = 0;
    for (var pass = 0; pass < 2; pass++) {
      var seen = {}, cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL), cy0 = Math.floor((y - r) / CELL), cy1 = Math.floor((y + r) / CELL), moved = false;
      for (var cx = cx0; cx <= cx1; cx++) for (var cy = cy0; cy <= cy1; cy++) {
        var l = W.bgrid[key(cx, cy)]; if (!l) continue;
        for (var i = 0; i < l.length; i++) {
          var b = W.b[l[i]]; if (seen[b.i]) continue; seen[b.i] = 1;
          if (x + r < b.x0 || x - r > b.x1 || y + r < b.y0 || y - r > b.y1) continue;
          var p = b.p, best = 1e9, qx = 0, qy = 0;
          for (var k = 0, j = p.length - 2; k < p.length; j = k, k += 2) { var d = segDist(x, y, p[j], p[j + 1], p[k], p[k + 1], tmpQ); if (d < best) { best = d; qx = tmpQ.x; qy = tmpQ.y; } }
          var inside = inPoly(p, x, y);
          if (!inside && best >= r) continue;
          var dx = x - qx, dy = y - qy, dl = Math.hypot(dx, dy) || 1e-6; dx /= dl; dy /= dl;
          if (inside) { x = qx - dx * (r + .05); y = qy - dy * (r + .05); nx = -dx; ny = -dy; } else { x = qx + dx * (r + .01); y = qy + dy * (r + .01); nx = dx; ny = dy; }
          hit = true; moved = true;
        }
      }
      if (!moved) break;
    }
    if (W.flat && S.wildD(W, x, y) > 8) { var wr = S.wildRocks(W, x, y); for (var wi = 0; wi < wr.length; wi++) { var wo = wr[wi], wdx = x - wo.x, wdy = y - wo.y, wl = Math.hypot(wdx, wdy), wm = wo.r + r; if (wl < wm) { wl = wl || 1e-6; x = wo.x + wdx / wl * wm; y = wo.y + wdy / wl * wm; nx = wdx / wl; ny = wdy / wl; hit = true; } } } // boulders and baobab trunks out in the wild
    var B = W.lim || W.bounds; if (x < B[0] + 4) { x = B[0] + 4; hit = true; nx = 1; ny = 0; } if (x > B[2] - 4) { x = B[2] - 4; hit = true; nx = -1; ny = 0; } if (y < B[1] + 4) { y = B[1] + 4; hit = true; nx = 0; ny = 1; } if (y > B[3] - 4) { y = B[3] - 4; hit = true; nx = 0; ny = -1; }
    return { x: x, y: y, hit: hit, nx: nx, ny: ny };
  };
  S.insideBuilding = function (W, x, y) {
    var l = W.bgrid[key(Math.floor(x / CELL), Math.floor(y / CELL))]; if (!l) return null;
    for (var i = 0; i < l.length; i++) { var b = W.b[l[i]]; if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && inPoly(b.p, x, y)) return b; }
    return null;
  };
  S.inWater = function (W, x, y) { if (W.props && W.props.length && S.deckAt(W, x, y) > 0) return false; for (var i = 0; i < W.water.length; i++) { var a = W.water[i]; if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1 && inPoly(a.p, x, y)) return true; } return false; };
  // Height of the surface under a point: the one answer used for feet and wheels. Roads sit a little proud of the
  // grass, the pier deck is raised over the lake, everything else is the painted ground.
  S.GROUND = { road: .062, lane: .052, flat: .034, pier: .66 };
  // 0..1: how far onto a raised deck (the pier) this point is
  S.deckAt = function (W, x, y) {
    var i, q;
    if (!W.raised) { W.raised = []; for (i = 0; i < W.props.length; i++) { q = W.props[i]; if (q.k === "pier") W.raised.push({ x: q.x, y: q.y, c: Math.cos(q.a || 0), s: Math.sin(q.a || 0) }); } }
    for (i = 0; i < W.raised.length; i++) { q = W.raised[i]; var dx = (x - q.x) * q.c + (y - q.y) * q.s, dz = -(x - q.x) * q.s + (y - q.y) * q.c; if ((dx > -.8 && dx < 45 && Math.abs(dz) < 2.5) || (dx >= 42 && dx < 50 && Math.abs(dz) < 4)) return clamp((dx + .8) / 1.6, 0, 1); }
    return 0;
  };
  /* ---------- the wild: endless hills beyond the school, the same every time ----------
     The map lists the rectangles that are kept flat (campus, market town, Phase 2 and the road between). Outside them
     the ground rises from zero over the first 120 m and keeps going for ever: value noise, so nothing is stored.
     S.wildH is the one height function; the terrain mesh, feet, wheels, the camera and the plane all ask it. */
  var WSEED = 20261;
  function h2(ix, iy, sd) { var n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(sd, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function vn(x, y, sd) { var xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = h2(xi, yi, sd), b = h2(xi + 1, yi, sd), c = h2(xi, yi + 1, sd), d = h2(xi + 1, yi + 1, sd); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  S.wildNoise = vn; S.wildHash = h2;
  // metres outside the flat grounds (0 inside)
  S.wildD = function (W, x, y) { var F = W.flat; if (!F) return 0; var best = 1e9; for (var i = 0; i < F.length; i++) { var f = F[i], dx = x < f[0] ? f[0] - x : x > f[2] ? x - f[2] : 0, dy = y < f[1] ? f[1] - y : y > f[3] ? y - f[3] : 0; if (!dx && !dy) return 0; var d = dx && dy ? Math.hypot(dx, dy) : dx + dy; if (d < best) best = d; } return best; };
  // 0 savanna woodland … 1 forest … 2 rocky hills, changing slowly; river is 1 in the bed of a stream and fades up its banks
  S.biome = function (W, x, y) { var b = vn(x / 1900 + 40, y / 1900 - 17, WSEED + 3), r = Math.abs(vn(x / 950 - 9, y / 950 + 31, WSEED + 7) - .5); return { b: b, kind: b < .4 ? 0 : b < .62 ? 1 : 2, river: 1 - sm(r / .085), rocky: sm((b - .58) / .1), forest: sm((b - .36) / .08) * (1 - sm((b - .6) / .08)) }; };
  S.wildH = function (W, x, y) {
    var d = S.wildD(W, x, y); if (d <= 0) return 0;
    var n = vn(x / 430, y / 430, WSEED) * .64 + vn(x / 170, y / 170, WSEED + 1) * .29 + vn(x / 70, y / 70, WSEED + 2) * .07, base = sm((n - .34) / .56), bi = S.biome(W, x, y);
    var amp = 16 + Math.min(54, d / 40), ridge = sm(1 - Math.abs(2 * vn(x / 190, y / 190, WSEED + 5) - 1)), h = base * amp * (1 + bi.rocky * ridge * .55) + vn(x / 26, y / 26, WSEED + 6) * .9 * sm(d / 60);
    return h * (1 - bi.river * .93) * sm(d / 120);
  };
  // boulders and big trunks you cannot walk through, in the 40 m cells round a point: [{x, y, r, k: "rock" | "baobab", s}]
  var wrOut = [], wrKey = "", WCELL = 40;
  S.wildCell = function (W, cx, cy, out) {
    var x0 = cx * WCELL, y0 = cy * WCELL, mx = x0 + 20, my = y0 + 20; if (S.wildD(W, mx, my) < 50) return out;
    var bi = S.biome(W, mx, my), n = bi.kind === 2 ? 2 : h2(cx, cy, 91) < (bi.kind === 1 ? .2 : .32) ? 1 : 0;
    for (var i = 0; i < n; i++) { var x = x0 + 4 + h2(cx, cy, 11 + i) * 32, y = y0 + 4 + h2(cx, cy, 21 + i) * 32, bao = bi.kind === 0 && h2(cx, cy, 31 + i) < .45; if (S.biome(W, x, y).river > .3) continue; out.push({ x: x, y: y, r: bao ? 1.7 : 1.4 + h2(cx, cy, 41 + i) * 2.2, k: bao ? "baobab" : "rock", s: h2(cx, cy, 51 + i) }); }
    if (bi.kind !== 2 && bi.river < .15 && h2(cx, cy, 77) < .03) out.push({ x: mx, y: my, r: 3.3, k: "hut", s: h2(cx, cy, 78) }); // the odd farm hut
    return out;
  };
  S.wildRocks = function (W, x, y) { var cx = Math.floor(x / WCELL), cy = Math.floor(y / WCELL), k = cx + ":" + cy; if (k === wrKey) return wrOut; wrKey = k; wrOut = []; for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) S.wildCell(W, cx + a, cy + b, wrOut); return wrOut; };
  S.groundY = function (W, x, y) {
    var G = S.GROUND, dk = S.deckAt(W, x, y); if (dk > 0) return G.flat + (G.pier - G.flat) * dk;
    var n = S.nearRoad(W, x, y, 8); if (n) { var e = n.d - n.r.w / 2, h = n.r.k === "p" ? G.road : G.lane; if (e <= 0) return h; if (e < .5) return G.flat + (h - G.flat) * (1 - e / .5); }
    return G.flat + (W.flat ? S.wildH(W, x, y) : 0);
  };
  S.areaAt = function (W, x, y) { for (var i = 0; i < W.areas.length; i++) { var a = W.areas[i]; if (x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1 && inPoly(a.p, x, y)) return a; } return null; };
  // Nearest point on any road within R metres: {d, x, y, r (road), s (segment offset), t}; null when none.
  S.nearRoad = function (W, x, y, R, driveOnly) {
    var best = null, bd = R == null ? 60 : R, n = Math.ceil(bd / CELL), cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL);
    for (var cx = cx0 - n; cx <= cx0 + n; cx++) for (var cy = cy0 - n; cy <= cy0 + n; cy++) {
      var l = W.rgrid[key(cx, cy)]; if (!l) continue;
      for (var i = 0; i < l.length; i += 2) {
        var r = W.roads[l[i]], s = l[i + 1], p = r.p; if (driveOnly && !r.drive) continue;
        var d = segDist(x, y, p[s], p[s + 1], p[s + 2], p[s + 3], tmpQ);
        if (d < bd) { bd = d; best = best || {}; best.d = d; best.x = tmpQ.x; best.y = tmpQ.y; best.t = tmpQ.t; best.r = r; best.s = s; }
      }
    }
    return best;
  };
  S.onRoad = function (W, x, y) { var n = S.nearRoad(W, x, y, 8); return n && n.d <= n.r.w / 2 + .6 ? n.r : null; };
  S.nearestNode = function (W, x, y, driveOnly) {
    var n = S.nearRoad(W, x, y, 400, driveOnly); if (!n) return -1;
    var a = W.nodes[n.r.a], b = W.nodes[n.r.b];
    return Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? n.r.a : n.r.b;
  };
  // Dijkstra over road ends. Returns a list of road indexes with direction: [{r, fwd}], or null.
  S.pathNodes = function (W, from, to, driveOnly) {
    if (from < 0 || to < 0) return null; if (from === to) return [];
    var N = W.nodes.length, dist = new Float64Array(N).fill(1e12), prev = new Int32Array(N).fill(-1), via = new Int32Array(N).fill(-1), done = new Uint8Array(N), open = [from];
    dist[from] = 0;
    while (open.length) {
      var bi = 0; for (var i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
      var u = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (done[u]) continue; done[u] = 1; if (u === to) break;
      var es = W.nodes[u].e;
      for (var e = 0; e < es.length; e++) { var r = W.roads[es[e]]; if (driveOnly && !r.drive) continue; var v = r.a === u ? r.b : r.a, nd = dist[u] + r.len * (r.k === "p" ? .8 : r.k === "x" ? 1.6 : 1); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; via[v] = r.i; open.push(v); } }
    }
    if (prev[to] < 0) return null;
    var out = []; for (var c = to; c !== from; c = prev[c]) { var rd = W.roads[via[c]]; out.push({ r: rd.i, fwd: rd.b === c }); }
    return out.reverse();
  };
  // Flat polyline [x, y, ...] along the roads from one point to another (snapped to road ends), or a straight line.
  function roadPart(r, n, fromA) { // polyline from one end of road r to the snapped point n
    var p = r.p, out = [], k;
    if (fromA) for (k = 0; k <= n.s; k += 2) out.push(p[k], p[k + 1]); else for (k = p.length - 2; k >= n.s + 2; k -= 2) out.push(p[k], p[k + 1]);
    out.push(n.x, n.y); return out;
  }
  S.route = function (W, x1, y1, x2, y2, driveOnly) {
    var ns = S.nearRoad(W, x1, y1, 400, driveOnly), ne = S.nearRoad(W, x2, y2, 400, driveOnly), out, k;
    if (!ns || !ne) return [x1, y1, x2, y2];
    if (ns.r === ne.r) {
      out = [x1, y1, ns.x, ns.y]; var p = ns.r.p;
      if (ns.s < ne.s) for (k = ns.s + 2; k <= ne.s; k += 2) out.push(p[k], p[k + 1]); else for (k = ns.s; k >= ne.s + 2; k -= 2) out.push(p[k], p[k + 1]);
      out.push(ne.x, ne.y, x2, y2); return out;
    }
    var best = null, bc = 1e12;
    [true, false].forEach(function (sa) { [true, false].forEach(function (ea) {
      var head = roadPart(ns.r, ns, sa), tail = roadPart(ne.r, ne, ea), path = S.pathNodes(W, sa ? ns.r.a : ns.r.b, ea ? ne.r.a : ne.r.b, driveOnly); if (!path) return;
      var c = S.lineLen(head) + S.lineLen(tail); path.forEach(function (st) { c += W.roads[st.r].len; });
      if (c < bc) { bc = c; best = { head: head, tail: tail, path: path }; }
    }); });
    if (!best) return [x1, y1, x2, y2];
    out = [x1, y1]; for (k = best.head.length - 2; k >= 0; k -= 2) out.push(best.head[k], best.head[k + 1]);
    best.path.forEach(function (st) { var p = W.roads[st.r].p, k; if (st.fwd) for (k = 2; k < p.length; k += 2) out.push(p[k], p[k + 1]); else for (k = p.length - 4; k >= 0; k -= 2) out.push(p[k], p[k + 1]); });
    for (k = 2; k < best.tail.length; k += 2) out.push(best.tail[k], best.tail[k + 1]);
    out.push(x2, y2);
    return out;
  };
  S.lineLen = function (p) { var l = 0; for (var k = 2; k < p.length; k += 2) l += Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]); return l; };
  S.along = function (p, d) { // point at distance d along a flat polyline
    for (var k = 2; k < p.length; k += 2) { var l = Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]); if (d <= l || k === p.length - 2) { var t = l ? clamp(d / l, 0, 1) : 0; return { x: p[k - 2] + (p[k] - p[k - 2]) * t, y: p[k - 1] + (p[k + 1] - p[k - 1]) * t, a: Math.atan2(p[k + 1] - p[k - 1], p[k] - p[k - 2]) }; } d -= l; }
    return { x: p[0], y: p[1], a: 0 };
  };
  S.randomRoadPoint = function (W, rnd, driveOnly, near, R) {
    for (var tries = 0; tries < 60; tries++) {
      var r = W.roads[Math.floor(rnd() * W.roads.length)]; if (driveOnly && !r.drive) continue;
      var q = S.along(r.p, rnd() * r.len); if (near && Math.hypot(q.x - near.x, q.y - near.y) > R) continue;
      var B = W.bounds; if (q.x < B[0] + 20 || q.x > B[2] - 20 || q.y < B[1] + 20 || q.y > B[3] - 20) continue;
      q.r = r; return q;
    }
    return null;
  };
  // A wanderer walks or drives the graph forever: {x, y, a, road, fwd, d}. side = lateral offset to the right (m).
  S.wanderStart = function (W, rnd, q, driveOnly) { var r = q.r, w = { road: r.i, fwd: rnd() < .5, d: 0, x: q.x, y: q.y, a: 0, drive: !!driveOnly }; w.d = rnd() * r.len; return w; };
  S.wanderStep = function (W, w, dist, rnd, side) {
    var r = W.roads[w.road]; w.d += dist;
    var guard = 0;
    while (w.d > r.len && guard++ < 6) {
      w.d -= r.len; var at = w.fwd ? r.b : r.a, es = W.nodes[at].e, opts = [];
      for (var i = 0; i < es.length; i++) { var c = W.roads[es[i]]; if (es[i] !== r.i && (!w.drive || c.drive)) opts.push(es[i]); }
      var nx = opts.length ? opts[Math.floor(rnd() * opts.length)] : r.i;
      var nr = W.roads[nx]; w.fwd = nx === r.i ? !w.fwd : nr.a === at; if (nr.a === nr.b) w.fwd = true; r = nr; w.road = nx;
    }
    var q = S.along(r.p, w.fwd ? w.d : r.len - w.d), a = w.fwd ? q.a : q.a + Math.PI;
    w.x = q.x + Math.cos(a + Math.PI / 2) * (side || 0); w.y = q.y + Math.sin(a + Math.PI / 2) * (side || 0); w.a = a;
    return w;
  };

  /* ---------- player, clock, needs, levels ---------- */
  S.TITLES = [[1, "Fresher"], [5, "Staylite"], [10, "Class rep"], [15, "Finalist"], [25, "Graduate"], [40, "Corper"], [60, "Oga"], [80, "Legend of Samaru"], [100, "Professor"], [125, "Vice-Chancellor"], [150, "Chancellor"]];
  S.MAX_LEVEL = 150;
  S.xpForLevel = function (n) { return 50 * n * (n - 1); };
  S.levelFor = function (xp) { var n = Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2); return clamp(n, 1, S.MAX_LEVEL); };
  S.title = function (lvl) { var t = S.TITLES[0][1]; S.TITLES.forEach(function (r) { if (lvl >= r[0]) t = r[1]; }); return t; };
  S.newPlayer = function (charId, name) {
    return { v: 2, char: charId || "tunde", name: name || "", x: 0, y: -730, a: Math.PI / 2, money: 2500, xp: 0, lvl: 1, hp: 100, maxHp: 100, energy: 100, hunger: 90,
      time: 7 * 60 + 30, day: 1, inv: { torch: 0 }, friends: {}, partner: "", m: { active: "", step: 0, n: 0, done: {} }, job: null, flags: {}, skills: { fit: 0, drive: 0, brain: 0, charm: 0 },
      stats: { km: 0, classes: 0, jobs: 0, wins: 0, shades: 0, dates: 0, tokens: 0, races: 0, faints: 0, days: 0 }, tokens: {}, races: {}, seenQ: {}, cheated: false, wanted: 0, home: "", outfit: 0, eggs: {}, reported: 0 };
  };
  (function (make) { S.newPlayer = function (charId, name) { var p = make(charId, name); p.fit = null; p.closet = {}; p.fits = []; if (charId === "bugaje") { p.xp = S.xpForLevel(10); p.lvl = 10; p.maxHp = 136; p.hp = 136; p.money = 9999999; p.god = true; p.cheated = true; p.inv.torch = 1; } return p; }; })(S.newPlayer);
  S.migrate = function (p) {
    if (!p || typeof p !== "object" || !p.char) return null;
    var d = S.newPlayer(p.char, p.name);
    Object.keys(d).forEach(function (k) { if (p[k] == null) p[k] = d[k]; else if (typeof d[k] === "object" && d[k] && !Array.isArray(d[k])) Object.keys(d[k]).forEach(function (j) { if (p[k][j] == null) p[k][j] = d[k][j]; }); });
    p.v = 2; p.lvl = S.levelFor(p.xp); return p;
  };
  S.addXp = function (p, n) { p.xp += Math.max(0, Math.round(n)); var was = p.lvl; p.lvl = S.levelFor(p.xp); if (p.lvl > was) { p.maxHp = 100 + (p.lvl - 1) * 4; p.hp = p.maxHp; } return p.lvl - was; };
  S.clock = function (p) { var h = Math.floor(p.time / 60) % 24, m = Math.floor(p.time % 60); return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m; };
  S.isNight = function (p) { var h = p.time / 60; return h >= 19 || h < 5.5; };
  // 0 = full day, 1 = full night, with dawn and dusk ramps.
  S.darkness = function (time) { var h = time / 60; if (h >= 6.5 && h <= 18) return 0; if (h >= 19.5 || h <= 5) return 1; return h > 18 ? (h - 18) / 1.5 : 1 - (h - 5) / 1.5; };
  S.advance = function (p, minutes) { p.time += minutes; var days = 0; while (p.time >= 1440) { p.time -= 1440; p.day++; p.stats.days++; days++; } return days; };
  // ctx: {run, sit, veh (id or ""), dance, moving}. Returns the list of things that just happened.
  S.tickNeeds = function (p, dt, ctx) {
    var ev = [], h0 = p.hunger, e0 = p.energy, fit = 1 - Math.min(.5, p.skills.fit * .01);
    if (p.char === S.HERO_ID) { p.god = true; p.cheated = true; p.flags.notire = p.flags.sjump = p.flags.onehit = p.flags.calloff = 1; if (p.money < 5e6) p.money = 9999999; }
    if (p.flags.notire) { p.energy = 100; p.hunger = Math.max(p.hunger, 70); }
    if (p.god) { p.hunger = Math.max(p.hunger, 60); p.energy = Math.max(p.energy, 60); p.hp = p.maxHp; return ev; }
    p.hunger -= dt * .05 * (ctx.run ? 1.2 : 1);
    // standing still gets your breath back, so an empty bar never traps you
    var drain = ctx.moving ? .04 : -.15;
    if (ctx.sit) drain = -.9; else if (ctx.veh) drain = ((S.VEH[ctx.veh].effort || 0) * .5 + .02) * (ctx.moving ? 1 : -1); else if (ctx.run) drain = .04 + .22 * fit; else if (ctx.dance) drain = p.energy > 5 ? .1 : -.05;
    p.energy -= dt * drain;
    p.hunger = clamp(p.hunger, 0, 100); p.energy = clamp(p.energy, 0, 100);
    if (p.hunger <= 0) { if (p.hp > p.maxHp * .3) p.hp = Math.max(p.maxHp * .3, p.hp - dt * .25); } else if (p.hunger > 40 && p.energy > 25 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + dt * .6);
    if (h0 > 30 && p.hunger <= 30) ev.push("hungry"); if (h0 > 0 && p.hunger <= 0) ev.push("starving");
    if (e0 > 25 && p.energy <= 25) ev.push("tired");
    if (e0 > 0 && p.energy <= 0) ev.push("exhausted"); // no collapse: you only slow down until you rest or eat
    if (p.hp <= 0) ev.push("faint");
    return ev;
  };
  S.FOOT = { walk: 4.9, run: 9.2 }; // metres per second on foot
  S.canSprint = function (p) { return !!p.god || p.energy > 0; };
  S.speedFactor = function (p) { return (p.hunger <= 0 ? .85 : 1) * (p.energy <= 0 ? .7 : p.energy < 12 ? .88 : 1) * (p.zoom ? 2.2 : p.char === S.HERO_ID ? 1.35 : 1); };
  // Sleep until 06:30. Returns hours slept.
  S.sleep = function (p) { var target = 6 * 60 + 30, mins = p.time < target ? target - p.time : 1440 - p.time + target; S.advance(p, mins); p.energy = 100; p.hp = p.maxHp; p.hunger = Math.max(15, p.hunger - mins / 60 * 4); return mins / 60; };
  // Knocked out in a fight: back on your feet at once, no bill, no lost hours.
  S.faint = function (p) { p.energy = Math.max(p.energy, 45); p.hp = Math.max(40, Math.round(p.maxHp * .6)); p.hunger = Math.max(p.hunger, 30); p.stats.faints++; p.wanted = 0; return 0; };

  /* ---------- missions (story) ---------- */
  // A step matches an event when the types agree and every listed field agrees.
  S.stepMatches = function (step, ev) {
    if (!step || step.t !== ev.t) return false;
    if (step.t === "stat") return step.stat === ev.stat && ev.value >= step.val;
    if (step.place && step.place !== ev.place) return false;
    if (step.npc && step.npc !== ev.npc) return false;
    if (step.item && step.item !== ev.item) return false;
    if (step.enemy && step.enemy !== ev.enemy) return false;
    if (step.veh && step.veh !== ev.veh) return false;
    if (step.emote && step.emote !== ev.emote) return false;
    if (step.race && step.race !== ev.race) return false;
    if (step.night && !ev.night) return false;
    if (step.pass != null && !(ev.score >= step.pass)) return false;
    return true;
  };
  S.missionOpen = function (p, m) { if (p.m.done[m.id]) return false; var need = m.need || {}; if (need.lvl && p.lvl < need.lvl) return false; return (need.done || []).every(function (id) { return p.m.done[id]; }); };
  S.nextMission = function (p, missions) { for (var i = 0; i < missions.length; i++) if (!missions[i].side && S.missionOpen(p, missions[i])) return missions[i]; return null; };
  S.startMission = function (p, m) { p.m.active = m.id; p.m.step = 0; p.m.n = 0; };
  // Feed a world event to the active mission. Returns {step: newStep} | {done: mission, reward} | null.
  S.missionEvent = function (p, missions, ev) {
    if (!p.m.active) return null;
    var m = null; for (var i = 0; i < missions.length; i++) if (missions[i].id === p.m.active) m = missions[i];
    if (!m) { p.m.active = ""; return null; }
    var st = m.steps[p.m.step]; if (!S.stepMatches(st, ev)) return null;
    p.m.n += ev.n || 1; if (p.m.n < (st.n || 1)) return { progress: p.m.n, of: st.n, mission: m };
    p.m.step++; p.m.n = 0;
    if (p.m.step < m.steps.length) return { step: m.steps[p.m.step], mission: m };
    p.m.active = ""; p.m.done[m.id] = 1;
    var rw = m.reward || {}, lv = 0; p.money += rw.cash || 0; if (rw.xp) lv = S.addXp(p, rw.xp); if (rw.item) p.inv[rw.item] = (p.inv[rw.item] || 0) + (rw.count || 1); if (rw.flag) p.flags[rw.flag] = 1;
    return { done: m, reward: rw, levels: lv };
  };
  S.storyProgress = function (p, missions) { var main = missions.filter(function (m) { return !m.side; }), n = main.filter(function (m) { return p.m.done[m.id]; }).length; return { done: n, total: main.length }; };

  /* ---------- endless jobs ---------- */
  S.JOBS = ["delivery", "taxi", "lost", "errand"];
  // places: [{id, name, x, y}] (marker points). Returns a job the runtime runs to completion.
  S.makeJob = function (places, rnd, lvl, kind, from) {
    kind = kind || S.JOBS[Math.floor(rnd() * S.JOBS.length)];
    var a, b, guard = 0;
    do { a = places[Math.floor(rnd() * places.length)]; b = places[Math.floor(rnd() * places.length)]; } while ((a === b || Math.hypot(a.x - b.x, a.y - b.y) < 150) && guard++ < 50);
    if (from && kind !== "taxi") a = from;
    var dist = Math.hypot(a.x - b.x, a.y - b.y) + (from ? Math.hypot(from.x - a.x, from.y - a.y) * .5 : 0), tier = 1 + Math.floor(lvl / 5);
    var job = { kind: kind, a: { id: a.id, name: a.name, x: a.x, y: a.y }, b: { id: b.id, name: b.name, x: b.x, y: b.y }, stage: 0, pay: Math.round((120 + dist * .55) * (1 + lvl * .06) / 10) * 10, xp: Math.round(25 + dist * .05 + tier * 6), time: 0, limit: 0 };
    if (kind === "delivery") { job.limit = Math.round(dist / (4.2 + Math.min(10, lvl * .5)) + 45); job.what = ["a carton of Indomie", "lab coats", "a rechargeable fan", "exam scripts", "a pot of jollof", "handouts", "a crate of malt", "a generator plug"][Math.floor(rnd() * 8)]; }
    if (kind === "taxi") { job.limit = Math.round(dist / 5 + 60); job.pay = Math.round(job.pay * 1.3 / 10) * 10; job.need = "seat"; }
    if (kind === "lost") { var ang = rnd() * 6.283, rr = 12 + rnd() * 30; job.hide = { x: b.x + Math.cos(ang) * rr, y: b.y + Math.sin(ang) * rr }; job.radius = 55; job.what = ["an ID card", "a phone charger", "a scientific calculator", "a flash drive", "a matric gown", "a bunch of keys", "a library card", "a power bank"][Math.floor(rnd() * 8)]; job.pay = Math.round(job.pay * .9 / 10) * 10; }
    if (kind === "errand") { job.what = ["suya", "masa", "a cold zobo", "kosai", "fura da nono", "roasted corn"][Math.floor(rnd() * 6)]; job.limit = Math.round(dist / 3.8 + 70); }
    return job;
  };
  S.jobText = function (job) {
    if (job.kind === "delivery") return job.stage === 0 ? "Pick up " + job.what + " at " + job.a.name : "Deliver " + job.what + " to " + job.b.name;
    if (job.kind === "taxi") return job.stage === 0 ? "Pick up your passenger at " + job.a.name : "Drop your passenger at " + job.b.name;
    if (job.kind === "lost") return "Search around " + job.b.name + " for " + job.what;
    return job.stage === 0 ? "Buy " + job.what + " at " + job.a.name : "Take the " + job.what + " to " + job.b.name;
  };
  S.finishJob = function (p, job, ok) { p.job = null; if (!ok) return { cash: 0, xp: 0, levels: 0 }; var bonus = job.limit && job.time < job.limit * .6 ? 1.25 : 1, cash = Math.round(job.pay * bonus); p.money += cash; p.stats.jobs++; return { cash: cash, xp: job.xp, levels: S.addXp(p, job.xp), fast: bonus > 1 }; };

  /* ---------- races ---------- */
  // 8 routes × the vehicle classes × 3 cups = an endless ladder; each win unlocks the next rung.
  S.CUPS = [{ id: "bronze", name: "Bronze", skill: .72, pay: 1 }, { id: "silver", name: "Silver", skill: .86, pay: 1.8 }, { id: "gold", name: "Gold", skill: .97, pay: 3 }];
  S.raceId = function (route, veh, cup) { return route + ":" + veh + ":" + cup; };
  S.buildRace = function (W, route, veh, cup, places) {
    var pts = route.via.map(function (id) { return places[id]; }).filter(Boolean), line = [];
    for (var i = 0; i + 1 < pts.length; i++) { var seg = S.route(W, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, veh !== "skate" && veh !== "bike" && veh !== "foot"); if (line.length) seg = seg.slice(2); line = line.concat(seg); }
    var len = S.lineLen(line), gates = [], gap = 110, spec = S.VEH[veh] || { max: 6.5 }, c = S.CUPS.filter(function (q) { return q.id === cup; })[0] || S.CUPS[0];
    for (var d = gap; d < len - 20; d += gap) gates.push(S.along(line, d));
    gates.push(S.along(line, len));
    return { id: S.raceId(route.id, veh, cup), route: route.id, name: route.name, veh: veh, cup: c, line: line, len: len, gates: gates, par: len / (spec.max * .62 * c.skill) + 6, pay: Math.round((300 + len * .5) * c.pay * (1 + S.VEH_ORDER.indexOf(veh) * .35) / 50) * 50, xp: Math.round((60 + len * .04) * c.pay) };
  };
  S.raceOpen = function (p, routeIdx, veh, cupIdx, routes) {
    if (veh !== "foot" && p.lvl < S.VEH[veh].lvl) return false;
    if (cupIdx === 0) return routeIdx === 0 || !!p.races[S.raceId(routes[routeIdx - 1].id, veh, "bronze")];
    return !!p.races[S.raceId(routes[routeIdx].id, veh, S.CUPS[cupIdx - 1].id)];
  };

  /* ---------- quizzes (classes) ---------- */
  S.pickQuestions = function (bank, rnd, n, subject, seen) {
    var pool = bank.filter(function (q) { return !subject || q.s === subject; }), fresh = pool.filter(function (q) { return !seen || !seen[q.id]; });
    if (fresh.length < n) { fresh = pool; if (seen) pool.forEach(function (q) { delete seen[q.id]; }); }
    var out = [], c = fresh.slice();
    while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]);
    return out;
  };
  S.classReward = function (p, right, total) { var xp = 20 + right * 18 + (right === total ? 30 : 0); p.stats.classes++; if (right >= Math.ceil(total * .6)) p.skills.brain++; return { xp: xp, levels: S.addXp(p, xp), pass: right >= Math.ceil(total * .6) }; };

  /* ---------- friends and dating ---------- */
  S.affinity = function (p, id) { return p.friends[id] || 0; };
  S.bond = function (p, id, n) { var v = clamp((p.friends[id] || 0) + n * (1 + p.skills.charm * .03), 0, 100); p.friends[id] = Math.round(v * 10) / 10; return p.friends[id]; };
  S.friendTier = function (a) { return a >= 80 ? "Bestie" : a >= 50 ? "Close friend" : a >= 20 ? "Friend" : a > 0 ? "Acquaintance" : "Stranger"; };
  // Date score from the three choices (spot, gift, talk), each graded 0..2 against the partner's tastes.
  S.dateScore = function (npc, spot, gift, talk) { var s = 0; s += npc.likes.spot === spot ? 2 : npc.likes.okSpot === spot ? 1 : 0; s += npc.likes.gift === gift ? 2 : gift ? 1 : 0; s += npc.likes.talk === talk ? 2 : npc.hates === talk || (Array.isArray(npc.hates) && npc.hates.indexOf(talk) >= 0) ? -1 : 1; return s; };

  /* ---------- wardrobe rules (pure) ----------
     An outfit ("fit") is { hair, hc, beard, brow, eyes, head, eye, top, bottom, one, outer, shoes, acc: [] }.
     Worn items are "itemId.colourIndex". A full outfit ("one") replaces top and bottom. */
  S.FIT_KEYS = ["hair", "hc", "beard", "brow", "eyes", "head", "eye", "top", "bottom", "one", "outer", "shoes"];
  S.LENGTHS = ["knee", "calf", "ankle"];
  S.modest = function (it) { return !!it && it.modest === true && it.fit !== "tight" && !it.sheer && ((it.slot !== "bottom" && it.slot !== "one") || S.LENGTHS.indexOf(it.len) >= 0); };
  S.itemValid = function (it) { return S.modest(it) && /^[a-z0-9]{2,12}$/.test(it.id) && !!it.name && ["head", "eye", "top", "bottom", "one", "outer", "shoes", "acc"].indexOf(it.slot) >= 0 && Array.isArray(it.cols) && it.cols.length >= 1 && it.cols.length <= 12 && it.cols.every(function (c) { return /^(#[0-9a-f]{6}|(ankara|adire|stripe|check)\|#[0-9a-f]{6}\|#[0-9a-f]{6})$/i.test(c); }) && it.price >= 0 && it.lvl >= 1 && !!it.brand; };
  // Words on a custom shirt: letters, digits and spaces, at most 12, and nothing from the short blocklist.
  S.TEXT_BLOCK = ["fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "nigg", "fag", "slut", "whore", "rape", "porn", "sex", "arse", "bastard", "wank", "twat", "nazi", "kill", "ashawo", "mumu", "oloshi", "ode", "shege", "banza", "wawa"];
  S.shirtText = function (str) { var t = String(str == null ? "" : str).toLowerCase().replace(/_/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 12).trim(), sq = t.replace(/[^a-z]/g, "").replace(/0/g, "o"), lean = t.replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/0/g, "o").replace(/[^a-z]/g, "");
    for (var i = 0; i < S.TEXT_BLOCK.length; i++) { var w = S.TEXT_BLOCK[i]; if (w.length <= 4 ? (" " + t + " ").indexOf(" " + w + " ") >= 0 || (w.length === 4 && (sq.indexOf(w) >= 0 || lean.indexOf(w) >= 0)) : sq.indexOf(w) >= 0 || lean.indexOf(w) >= 0) return ""; } return t; };
  // A stable first name from a list like D.NAMES (which has .m, .f and .n): same seed, same name.
  S.nameFor = function (names, seed, sex) { var pool = (sex === "m" || sex === "f") && names[sex] ? names[sex].concat(names.n || []) : names; return pool[Math.floor(S.hash(seed | 0, 77) * pool.length) % pool.length]; };
  S.wornId = function (v) { return v ? String(v).split(".")[0] : ""; };
  S.wornCol = function (v) { return v ? +(String(v).split(".")[1] || 0) : 0; };
  // Keep only what exists and fits its slot; a full outfit clears top and bottom; at most three extras.
  S.fitClean = function (fit, items) {
    var by = {}, out = { acc: [] }; (items || []).forEach(function (it) { by[it.id] = it; }); fit = fit || {};
    ["hair", "beard", "brow", "eyes"].forEach(function (k) { if (/^[a-z]{0,12}$/.test(fit[k] || "")) out[k] = fit[k] || ""; }); out.hc = Math.max(0, Math.min(9, fit.hc | 0));
    ["head", "eye", "top", "bottom", "one", "outer", "shoes"].forEach(function (k) { var it = by[S.wornId(fit[k])]; if (it && it.slot === k) out[k] = it.id + "." + Math.max(0, Math.min(it.cols.length - 1, S.wornCol(fit[k]))); });
    (fit.acc || []).forEach(function (v) { var it = by[S.wornId(v)]; if (it && it.slot === "acc" && out.acc.length < 3 && !out.acc.some(function (o) { return by[S.wornId(o)].kind === it.kind; })) out.acc.push(it.id + "." + Math.max(0, Math.min(it.cols.length - 1, S.wornCol(v)))); });
    if (out.one) { delete out.top; delete out.bottom; } else { if (!out.top) out.top = "tee.0"; if (!out.bottom) out.bottom = "trousers.0"; }
    if (!out.shoes) out.shoes = "sneaklow.0"; if (!out.hair) out.hair = "low";
    if (fit.txt && out.top && by[S.wornId(out.top)].custom) { var tx = S.shirtText(fit.txt); if (tx) out.txt = tx; }
    return out;
  };
  // Compact text for the network and for cache keys: 15 comma-separated fields, lower-case letters, digits and dots.
  S.fitPack = function (fit) { if (!fit) return ""; var a = S.FIT_KEYS.map(function (k) { return fit[k] == null ? "" : String(fit[k]); }); for (var i = 0; i < 3; i++) a.push((fit.acc || [])[i] || ""); a.push(fit.txt ? String(fit.txt).replace(/ /g, "_") : ""); return a.join(",").replace(/[^a-z0-9.,_]/g, "").slice(0, 200); };
  S.fitUnpack = function (str) { if (!str || typeof str !== "string") return null; var a = str.split(","), fit = { acc: [] }; if (a.length < S.FIT_KEYS.length) return null; S.FIT_KEYS.forEach(function (k, i) { if (a[i]) fit[k] = k === "hc" ? +a[i] || 0 : a[i]; }); for (var i = S.FIT_KEYS.length; i < a.length && i < S.FIT_KEYS.length + 3; i++) if (a[i]) fit.acc.push(a[i]); if (a[S.FIT_KEYS.length + 3]) fit.txt = a[S.FIT_KEYS.length + 3].replace(/_/g, " "); return fit; };
  // A believable random outfit for a walker. o: { sex: "m"|"f", hijab: bool, hair, lvl }.
  S.randomFit = function (items, seed, o) {
    o = o || {}; var n = 0, h = function () { return S.hash(seed, 31 + n++); }, sex = o.sex || (h() < .5 ? "f" : "m");
    function ok(it) { return (!it.sex || it.sex === sex) && !it.locked && it.brand !== "mib" && it.lvl <= (o.lvl || 12); }
    function pick(slot, kinds) { var pool = items.filter(function (it) { return it.slot === slot && ok(it) && (!kinds || kinds.indexOf(it.kind) >= 0); }); if (!pool.length) return ""; var it = pool[Math.floor(h() * pool.length)]; return it.id + "." + Math.floor(h() * it.cols.length); }
    var fit = { acc: [], hair: o.hair || "low", hc: h() < .85 ? 0 : 1 + Math.floor(h() * 3) }, r = h();
    if (sex === "f") {
      if (o.hijab) { fit.head = pick("head", ["hijab", "hijablong"]); r = h(); if (r < .45) fit.one = pick("one", ["abaya"]); else if (r < .7) fit.one = pick("one", ["gown"]); else { fit.top = pick("top", ["kurta", "shirt", "sweater"]); fit.bottom = pick("bottom", ["skirt", "trousers"]); } }
      else if (r < .22) { fit.one = pick("one", ["native"]); if (h() < .6) fit.head = pick("head", ["gele", "scarf"]); }
      else if (r < .4) fit.one = pick("one", ["gown"]);
      else { fit.top = pick("top", ["tee", "polo", "shirt", "hoodie", "sweater", "kurta", "dashiki", "wrap"]); fit.bottom = pick("bottom", ["jeans", "trousers", "skirt", "joggers"]); if (h() < .15) fit.head = pick("head", ["scarf", "beanie", "bucket"]); }
    } else {
      if (r < .16) { fit.one = pick("one", ["kaftan"]); if (h() < .7) fit.head = pick("head", ["kufi", "fila", "zanna"]); }
      else if (r < .22) { fit.one = pick("one", ["jalabiya"]); if (h() < .6) fit.head = pick("head", ["kufi", "turban"]); }
      else if (r < .25) { fit.one = pick("one", ["agbada"]); fit.head = pick("head", ["fila", "zanna"]); }
      else if (r < .37) { fit.top = pick("top", ["senator", "dashiki", "kurta"]); fit.bottom = pick("bottom", ["trousers"]); if (h() < .4) fit.head = pick("head", ["kufi"]); }
      else { fit.top = pick("top", ["tee", "polo", "shirt", "hoodie", "jersey", "sweater", "tang"]); fit.bottom = pick("bottom", ["jeans", "trousers", "joggers", "shorts"]); if (h() < .18) fit.head = pick("head", ["baseball", "bucket", "beanie"]); if (h() < .2) fit.beard = ["moustache", "goatee", "full"][Math.floor(h() * 3)]; }
    }
    if (!fit.one && h() < .12) fit.outer = pick("outer");
    var robe = !!fit.one; fit.shoes = pick("shoes", robe ? ["sandal", "slipper", "loafer", "flat", "heel"] : ["low", "high", "sandal", "loafer", "boot", "flat", "slipper"]);
    if (h() < .16) fit.eye = pick("eye"); if (h() < .3) fit.acc.push(pick("acc", ["backpack", "tote"])); if (h() < .2) fit.acc.push(pick("acc", ["watch", "bracelet", "chain", "beads", "lanyard", "tasbih"]));
    fit.acc = fit.acc.filter(Boolean); return S.fitClean(fit, items);
  };
  /* ---------- cheats ---------- */
  // Typed on a keyboard during play, or dialled as a USSD code on the in-game phone. Using any marks the save
  // as "cheated": the campus stays fully playable, but the arcade leaderboard ignores it.
  /* ---------- cheats ----------
     The codes themselves are not in this file. The page receives salted hashes (api.config.cheats) from the server;
     S.CHEAT_DEFAULT holds the hashes of the defaults in games/cheat_defaults/samaru-days.json for when there is no config. */
  S.sha256 = function (str) { // small synchronous SHA-256 (hex), so codes can be matched without shipping them
    var K = S.sha256.K; if (!K) { K = S.sha256.K = []; for (var n = 2, c = 0; c < 64; n++) { var pr = true; for (var d = 2; d * d <= n; d++) if (n % d === 0) { pr = false; break; } if (pr) K[c++] = (Math.pow(n, 1 / 3) * 4294967296) | 0; } }
    var s = unescape(encodeURIComponent(String(str))), i, j, l = s.length, w = [], H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    for (i = 0; i < l; i++) w[i >> 2] |= s.charCodeAt(i) << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); var nw = (((l + 8) >> 6) + 1) * 16; for (i = 0; i < nw; i++) w[i] = w[i] | 0; w[nw - 1] = l * 8;
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (i = 0; i < nw; i += 16) { var a = H[0], b = H[1], c2 = H[2], d2 = H[3], e = H[4], f = H[5], g = H[6], h = H[7], m = [];
      for (j = 0; j < 64; j++) { if (j < 16) m[j] = w[i + j]; else { var x = m[j - 15], y = m[j - 2]; m[j] = (m[j - 16] + (rr(x, 7) ^ rr(x, 18) ^ (x >>> 3)) + m[j - 7] + (rr(y, 17) ^ rr(y, 19) ^ (y >>> 10))) | 0; }
        var t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + m[j]) | 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c2) ^ (b & c2))) | 0; h = g; g = f; f = e; e = (d2 + t1) | 0; d2 = c2; c2 = b; b = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c2) | 0; H[3] = (H[3] + d2) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0; }
    return H.map(function (v) { return ("00000000" + (v >>> 0).toString(16)).slice(-8); }).join("");
  };
  S.SLUG = "samaru-days";
  S.codeHash = function (code) { return S.sha256(S.SLUG + ":" + String(code).toLowerCase().replace(/\s+/g, "")); };
  S.CHEATS = [
    { id: "cash", label: "₦50,000", text: "Spray! ₦50,000 lands in your pocket." },
    { id: "rich", label: "₦1,000,000", text: "₦1,000,000. Don't spend it all at the market." },
    { id: "heal", label: "Full health, food and energy", text: "Full belly, full energy, full health." },
    { id: "god", label: "Invincible", text: "Odeshi: nothing can hurt you (enter again to switch off)." },
    { id: "notire", label: "Infinite energy", text: "Infinite energy (enter again to switch off)." },
    { id: "onehit", label: "One-hit knock-out", text: "One-hit knock-outs (enter again to switch off)." },
    { id: "zoom", label: "Super speed", text: "Super speed (enter again to switch off)." },
    { id: "sjump", label: "Super jump", text: "Super jump (enter again to switch off)." },
    { id: "bighead", label: "Big head mode", text: "Big head mode." },
    { id: "calm", label: "Security forgets you", text: "Security forgets your face." },
    { id: "calloff", label: "Send security home", text: "Security has gone home (enter again to bring them back)." },
    { id: "level", label: "One level up", text: "One level up." },
    { id: "max", label: "Every vehicle licence", text: "Level 10: every licence, including the aircraft." },
    { id: "toplvl", label: "Top level", text: "Level 150. Chancellor." },
    { id: "skip", label: "Skip this mission step", text: "The current story step is done for you." },
    { id: "missions", label: "Pick any mission", text: "Pick any mission." },
    { id: "skate", label: "Skateboard", text: "A skateboard appears." },
    { id: "okada", label: "Okada", text: "An okada appears beside you." },
    { id: "keke", label: "Keke", text: "A keke appears beside you." },
    { id: "car", label: "Saloon car", text: "A saloon car appears beside you." },
    { id: "sport", label: "Sports car", text: "A sports car appears beside you." },
    { id: "plane", label: "Aircraft", text: "A light aircraft appears. Find a straight road." },
    { id: "noon", label: "Morning (07:00)", text: "It is 07:00." },
    { id: "midday", label: "Midday (13:00)", text: "It is 13:00." },
    { id: "dusk", label: "Sunset (18:30)", text: "It is 18:30. Sunset." },
    { id: "night", label: "Midnight", text: "It is 00:00." },
    { id: "harmattan", label: "Harmattan haze", text: "Dust season: the harmattan haze rolls in (enter again to clear)." },
    { id: "nepa", label: "Blackout", text: "They have taken the light. The shades are coming." },
    { id: "light", label: "Light back", text: "UP NEPA! Light is back and the shades scatter." },
    { id: "love", label: "Everybody likes you", text: "Everybody on campus likes you a lot more." },
    { id: "map", label: "Show hidden kola nuts", text: "Every hidden kola nut shows on your map." }
  ];
  S.CHEAT_DEFAULT = [
    { id: "cash", typed: "05614668eb10fe00f4d2216761d1892a33f4fd0e39f0600e03de3bcd84272e86", dial: "fbe428831a4c893c060c278a619e28a538033272f3304e421bfa99f0a1a16c4d" },
    { id: "rich", typed: "a1394345d6450ef50471d4555475bea8f4b5991b75dd71f70ec450e20ccbf2ac", dial: "4528cb15c61a53468130d38a4e1e1870487e7ecc2c75578bacf779a282faf7bb" },
    { id: "heal", typed: "60a3296e217794c2a43d385a9286c75a4747f72d8d382cdc2fe0f2c8da4e451f", dial: "e7ec05633364b0cac4f33379808b08b8f1b34c04d1375a37813876fd4796a793" },
    { id: "god", typed: "401dcb0439d84a4430f816d7acd75cfb6b8803a73c0876e8b959c089663b4fdf", dial: "f1853f9e4297748119eeec756ca3d6592c4b85d77676fd4d766c33710651550f" },
    { id: "notire", typed: "5816a3c66fb6a0bc3ed19fbcba0c89dd1ae6021e24262b518449f63cb6d116da", dial: "97c8e7d637417a4f5374d6cd42a16a4bd78094532f7c4105d15da292ca59279c" },
    { id: "onehit", typed: "b5356a3109f856641db2cdd80e3bbbac68a7983b8ed583fd42dcc8159c561fc9", dial: "7818a5b56f91fa9b19f68857975a36e8a10aa5278c2801ffba1e4a845d9c5ee0" },
    { id: "zoom", typed: "3b3870aad066715e404fc3981b037fae1b515d92568a943485f8c5802db8122b", dial: "c64b462945a494d2621bb5a217650b9b332942a57187c6e087f42bf4e2fb030e" },
    { id: "sjump", typed: "4d0e91dd2ce0fc32809a2dba0b32db7caa729bc8d70330a9b73458961305be27", dial: "2bb8b9c230be1c3b5bf272c333bbfdf8b6664b00d8530321ec94fa104624e1d9" },
    { id: "bighead", typed: "29ecf7c34e1b23998a9e1592c2d31ccaea517867cee10060e61160eef7dc9e10", dial: "110b498f4468668265368fafe6764536083a7997afd9e976b359cf42ef7d0d75" },
    { id: "calm", typed: "107a94313cbef628f98c47f7f5154cb93c5348e660b6ecfccf4387fafe3d25c7", dial: "6b5d26446788da61f8730cbab20dd2e5206eeed911884ac54c636d1e47aad899" },
    { id: "calloff", typed: "6f1b852946fc04bc2f2aa2984bb7478e808e6764f6f082c7b215df19f8f5aba5", dial: "559a84aefb90815010b8794512d5eeb0fd649eca15d0675b3e352211101c886b" },
    { id: "level", typed: "797c89ea2a95c43b867f55416088b899b9959c207d22683bf8ba76bae06e9185", dial: "a2cc6c00d58bfc5aa377ab5d6a44ec05e71f027405a7fc6b89e9636858032ffb" },
    { id: "max", typed: "b80dfe2bc5cef8a2db0fa5ecb56347a44bccdb92fb778c626aa14748339df81c", dial: "b105e177fc95909d10d54c92b3fa41446973a9ae9b3ec320f42481032efa5095" },
    { id: "toplvl", typed: "f4825ff5e2047aff3487fec656433e8354007d89fa3cdc34bd64da9495edf697", dial: "f9ea90f88ee1b2722e8976a84ddfa08942fa4e8e7b002f4b29ab8f4f44874a1c" },
    { id: "skip", typed: "2fea6117c9836d7af6011e4abf481928f20173646d5b41d08d9c7e9a5691fe25", dial: "2491e6e6207bedebc8206d0db77a6e3d632d54d662f04cdbb9e4c6f7ecf03216" },
    { id: "missions", typed: "2f5464ad22b7859cfad8d0173a445e3b2d445f7e31641f3ceb3537e6b57231fa", dial: "0be496b41bb4c3930a565b1cf086e2087d6768c475fc91e2586a033ae9a2a1df" },
    { id: "skate", typed: "40ebf37b49e20e2c5bcaaf96fd53b2811895a234e9f30a93e4ea1f7d71e1d847", dial: "aa775be5d62e2ddbf4d5d6fc4ed5ca40973d1a29d828d6bb80263fc102b33863" },
    { id: "okada", typed: "6ea037bee41cd0e6d5b3d69bd2b7444cce2831528addaf164ecb5961f5ed6d00", dial: "0ad7b3e1ed4177dd9460011cfdee4de6bb90ab9f0996f54eb0d7b696a0c7e896" },
    { id: "keke", typed: "842af3734036fd144dd63194f836917bcf5523be20ec1642f0b252a4f343f0ed", dial: "9c8111408417b08652a5d7d0f62db517863bdb4278f0541556fcdf314f376b5d" },
    { id: "car", typed: "b3ed596bc5f637cd787df64e071baa34f9162ace7f62528206e925c9bb376670", dial: "8012af30dbcbc45a01a7cda969131b55397d340fba883b00c3816fe8f230eaac" },
    { id: "sport", typed: "486359f6e61fb3c238c5819cf30a9f880606898c1d0372992bad25a7a632e6dc", dial: "bd75d6e2d41fff1fde6ed6042453da30e3cb944366a9a0004d69fcdf9ae3c10a" },
    { id: "plane", typed: "aec96d36718a8f9d98c1c93b13b4f25e9b454613e112ebc4b8fe27cb1dcbdb76", dial: "a3ce293d20c0843a95c30cf7443cfdcf973b52bebd4abf7dd87b8d3e8af988ab" },
    { id: "noon", typed: "1a6bef109879a1cb4d2dcea81c80fe9fdad7651b02b70f0b2c1160f2704b4381", dial: "a90a88a342edc47fc957c8c1beda632982aad3fbcefe4c22e4bc63ff47ae702d" },
    { id: "midday", typed: "0f51a4fafd9b98d6d95a709bc9e162c2c82a8ac2d5e0a690748b9e479ee1b932", dial: "2bdfb48c565b7beedb00e28ab92e69bbc55f07fec8183c6d6b288f2c7fc8f89a" },
    { id: "dusk", typed: "948e3d81e58447a4300b2c50f9389f83861dd060fb3e5950d9418554462790e9", dial: "1c7afec85946047e1dcdcd995b7e7c9f7eb1bbe4eecea6e056488a5edab3dcc0" },
    { id: "night", typed: "7eb58f7ab76b9f6209b089406b29cf05c6027d57cb9340738c94e65a9f777ed0", dial: "8ee602aa53f9bc47e097ca231fb93fc900fa8e3a1dc41f191a9fe5ec7b3e9710" },
    { id: "harmattan", typed: "a63167be9904857bc2f71c9cc0008949e73f1da7d0077c51e8ab610a713da35e", dial: "81aea75e8f1b47e086fa110776f23a189d88fd7f6520dc144fcdbace2398e45d" },
    { id: "nepa", typed: "1af1c196a8d81f0810d557a9bcdbeec8d8281762b60368e5a6a8c6a327324f23", dial: "feaa58252d2ef2c9b21a9275d306ea8ccca485eb898647c96d9dd830bec587ac" },
    { id: "light", typed: "2d12e1ce11d35dba33306fbc97160f5973ff3c9e835044ac8f045080b08f9013", dial: "9e6fdebdf196eaeadc72637f67ce6239e68832b280ac9e7b045197af1d8d4531" },
    { id: "love", typed: "fc69e9656d33532709fe0d9e2c95757a3bccf63e6552a0aff4ddc6fff23121e4", dial: "259441d14626f9c2f4f642b9d315db6882a4984b024f25f82906e3c7e4c78ef9" },
    { id: "map", typed: "2ba24e0e0db58f036dcbee0df5c83de649125dc3e5e162e601a46f52abbdca2b", dial: "11a56df7e1f5583e8b69982f02e22a4a0ddf5f760d05c556b8ecf2c3e24b9069" }
  ];
  S.HERO_ID = "bugaje";
  S.HERO_DEFAULT = { combo: "311facb06f7b28cd23ae70c8ef457df19f4a03fd66944c23c6681a68d4571d6f", swipe: "efd29b11c7736f28fd8e9871f1997c7c4ffda37ad6681e5779f9366e5970ca1a" };
  S.isHero = function (p) { return !!p && p.char === S.HERO_ID; };
  S.cheatById = function (id) { for (var i = 0; i < S.CHEATS.length; i++) if (S.CHEATS[i].id === id) return S.CHEATS[i]; return null; };
  // mode "typed": the cheat whose word ends the rolling key buffer. mode "dial": the whole entry is a dial code or a typed word.
  S.cheatMatch = function (table, input, mode) {
    table = table && table.length ? table : S.CHEAT_DEFAULT; var s = String(input).toLowerCase().replace(/\s+/g, ""), want = {}, i, h2;
    if (mode === "typed") { for (i = 0; i < table.length; i++) if (table[i].typed) want[table[i].typed] = table[i].id; for (var n = 4; n <= Math.min(24, s.length); n++) { h2 = S.codeHash(s.slice(-n)); if (want[h2]) return S.cheatById(want[h2]); } return null; }
    if (!s) return null; h2 = S.codeHash(s); for (i = 0; i < table.length; i++) if (table[i].dial === h2 || table[i].typed === h2) return S.cheatById(table[i].id); return null;
  };
  // true when a rolling buffer of tokens ends with the sequence whose hash is given (4 to 12 tokens)
  S.seqMatch = function (buf, hash) { for (var n = 4; n <= Math.min(12, buf.length); n++) if (S.codeHash(buf.slice(-n)) === hash) return true; return false; };
  // State-only part of a cheat; the runtime adds spawning and effects.
  S.applyCheat = function (p, id) {
    p.cheated = true;
    if (id === "cash") p.money += 50000; else if (id === "rich") p.money += 1000000;
    else if (id === "heal") { p.hunger = 100; p.energy = 100; p.hp = p.maxHp; }
    else if (id === "god") p.god = !p.god; else if (id === "zoom") p.zoom = !p.zoom;
    else if (id === "level") { p.xp = S.xpForLevel(Math.min(S.MAX_LEVEL, p.lvl + 1)); S.addXp(p, 0); }
    else if (id === "max") { if (p.lvl < 10) { p.xp = S.xpForLevel(10); S.addXp(p, 0); } }
    else if (id === "toplvl") { p.xp = S.xpForLevel(S.MAX_LEVEL); S.addXp(p, 0); }
    else if (id === "calm") { p.wanted = 0; p.sec = null; }
    else if (id === "calloff") { p.flags.calloff = p.flags.calloff ? 0 : 1; p.wanted = 0; p.sec = null; }
    else if (id === "sjump" || id === "notire" || id === "onehit") p.flags[id] = p.flags[id] ? 0 : 1;
    else if (id === "midday") p.time = 13 * 60; else if (id === "dusk") p.time = 18 * 60 + 30;
    else if (id === "noon") p.time = 7 * 60; else if (id === "night") p.time = 0;
    else if (id === "love") Object.keys(p.friends).forEach(function (k) { p.friends[k] = Math.min(100, p.friends[k] + 30); });
    else if (id === "map") p.flags.mappa = 1; else if (id === "bighead") p.flags.bighead = p.flags.bighead ? 0 : 1; else if (id === "harmattan") p.flags.harmattan = p.flags.harmattan ? 0 : 1;
    return p;
  };

  /* ---------- hidden kola nuts (collectibles), placed from a seed so every device agrees ---------- */
  S.TOKEN_COUNT = 150;
  S.placeTokens = function (W) {
    if (W.tokens && W.tokens.length) { S.TOKEN_COUNT = W.tokens.length; return W.tokens.map(function (t) { return { x: t[0], y: t[1] }; }); } // the designed campus ships its nuts: positions are frozen so saves keep theirs
    var rnd = S.rng(20261111), out = [], B = W.bounds, guard = 0;
    while (out.length < S.TOKEN_COUNT && guard++ < 20000) {
      var x = B[0] + 30 + rnd() * (B[2] - B[0] - 60), y = B[1] + 30 + rnd() * (B[3] - B[1] - 60);
      if (S.insideBuilding(W, x, y) || S.inWater(W, x, y)) continue;
      var n = S.nearRoad(W, x, y, 70); if (!n || n.d < n.r.w / 2 + 2) continue; // off the road, but reachable
      var free = S.push(W, x, y, 1.2); if (free.hit) { x = free.x; y = free.y; }
      if (out.some(function (t) { return Math.hypot(t.x - x, t.y - y) < 60; })) continue;
      out.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    return out;
  };

  /* ---------- multiplayer packing ---------- */
  // What one player tells the room about itself, kept tiny: position, heading, vehicle, pose, look.
  S.pack = function (p, me) { return { x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, a: Math.round(me.a * 100) / 100, v: me.veh || "", s: Math.round((me.speed || 0) * 10) / 10, e: me.emote || "", c: p.char, o: p.outfit || 0, f: S.fitPack(p.fit), l: p.lvl, z: me.z ? 1 : 0, h: Math.round(p.hp) }; };
  // Remote players are drawn a little in the past, between the two reports either side of that moment,
  // so they glide instead of chasing each new report. r.spd is their ground speed for the walk cycle.
  S.angDiff = function (to, from) { var d = (to - from) % 6.283185307; if (d > Math.PI) d -= 6.283185307; else if (d < -Math.PI) d += 6.283185307; return d; };
  S.netStep = function (r, dt) {
    var q = r.snaps; if (!q || !q.length) return r;
    r.clock = (r.clock || 0) + dt;
    var T = r.clock - (r.delay || .37), i = q.length - 1, x, y, a;
    while (i > 0 && q[i].t > T) i--;
    var s0 = q[i], s1 = q[i + 1];
    if (s1 && T >= s0.t) { var k = (T - s0.t) / Math.max(.001, s1.t - s0.t); x = s0.x + (s1.x - s0.x) * k; y = s0.y + (s1.y - s0.y) * k; a = s0.a + S.angDiff(s1.a, s0.a) * k; }
    else if (T < s0.t) { x = s0.x; y = s0.y; a = s0.a; }
    else { var e = Math.min(T - s0.t, .25); x = s0.x + Math.cos(s0.a) * s0.s * e; y = s0.y + Math.sin(s0.a) * s0.s * e; a = s0.a; } // late report: coast briefly, then hold
    if (r.x == null || Math.hypot(x - r.x, y - r.y) > 40) { r.x = x; r.y = y; r.a = a; r.spd = 0; return r; }
    var f = 1 - Math.exp(-18 * dt), nx = r.x + (x - r.x) * f, ny = r.y + (y - r.y) * f, v = dt > 0 ? Math.hypot(nx - r.x, ny - r.y) / dt : 0;
    r.spd = (r.spd || 0) + (v - (r.spd || 0)) * (1 - Math.exp(-8 * dt)); r.x = nx; r.y = ny; r.a += S.angDiff(a, r.a) * f;
    while (q.length > 2 && q[1].t < T) q.shift();
    return r;
  };
  S.netApply = function (r, st) {
    var q = r.snaps || (r.snaps = []), now = r.clock || 0, last = q[q.length - 1];
    if (last) { var gap = Math.min(1, now - last.t); r.gap = r.gap ? r.gap + (gap - r.gap) * .2 : gap; r.delay = Math.max(.2, Math.min(.7, r.gap + .12)); }
    if (last && now - last.t < .02) q.pop();
    q.push({ t: now, x: st.x, y: st.y, a: st.a, s: st.s || 0 }); if (q.length > 8) q.shift();
    if (r.x == null) { r.x = st.x; r.y = st.y; r.a = st.a; r.spd = 0; }
    r.tx = st.x; r.ty = st.y; r.ta = st.a; r.ts = st.s || 0; r.veh = st.v; r.emote = st.e; r.char = st.c; r.outfit = st.o; r.fitS = st.f || ""; r.lvl = st.l; r.z = st.z; r.hp = st.h; r.age = 0; return r;
  };

  /* ---------- walkers and traffic ---------- */
  // Walk o toward (tx, ty) at up to `want` m/s: the heading turns at a limited rate, the feet slow while turning,
  // nearby bodies in `others` push sideways, and S.push keeps everyone out of walls. Sets o.spd to the real speed.
  S.walkTo = function (W, o, tx, ty, want, dt, others, rad) {
    var dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy), ax = 0, ay = 0, i, q, ex, ey, ed, r = rad || .4;
    if (others) for (i = 0; i < others.length; i++) { q = others[i]; if (q === o || q.hidden) continue; ex = o.x - q.x; ey = o.y - q.y; if (Math.abs(ex) > 1.3 || Math.abs(ey) > 1.3) continue; ed = Math.hypot(ex, ey); if (ed < 1.1) { if (ed < .01) { ex = Math.cos(i * 2.4); ey = Math.sin(i * 2.4); ed = 1; } var w = (1.1 - ed) / 1.1; ax += ex / ed * w; ay += ey / ed * w; } }
    var go = d > .25 ? Math.min(want, d * 2.5) : 0, vx = (d > .01 ? dx / d : 0) * go + ax * 2.2, vy = (d > .01 ? dy / d : 0) * go + ay * 2.2, sp = Math.hypot(vx, vy);
    if (sp < .08) { o.spd = (o.spd || 0) * Math.exp(-10 * dt); return 0; }
    var da = S.angDiff(Math.atan2(vy, vx), o.a), turn = 5.5 * dt; o.a += Math.abs(da) < turn ? da : (da > 0 ? turn : -turn);
    var al = Math.max(0, Math.cos(da)), step = Math.min(sp, want * 1.25) * (.25 + .75 * al) * dt, n = S.push(W, o.x + Math.cos(o.a) * step, o.y + Math.sin(o.a) * step, r), mv = Math.hypot(n.x - o.x, n.y - o.y);
    o.x = n.x; o.y = n.y; o.spd = (o.spd || 0) + (mv / dt - (o.spd || 0)) * (1 - Math.exp(-10 * dt)); return mv;
  };
  // How fast may car t go, given what is in its lane ahead? list items need x, y and optionally v (their speed) and a.
  S.gapSpeed = function (t, want, lists) {
    var ca = Math.cos(t.a), sa = Math.sin(t.a), out = want, look = 7 + t.v * 1.1, li, i, o, dx, dy, ah, sd, lim; t.blk = null;
    for (li = 0; li < lists.length; li++) for (i = 0; i < lists[li].length; i++) { o = lists[li][i]; if (!o || o === t) continue; dx = o.x - t.x; dy = o.y - t.y; if (Math.abs(dx) > look + 2 || Math.abs(dy) > look + 2) continue; ah = dx * ca + dy * sa; sd = Math.abs(dy * ca - dx * sa);
      if (o.pri != null && ah > -1 && dx * dx + dy * dy < (3.4 + t.v * .55) * (3.4 + t.v * .55) && (t.pri || 0) > o.pri) { out = 0; t.blk = o; continue; } // two cars merging side by side: the later one gives way
      if (ah <= .5 || ah > look || sd > 1.7) continue;
      var ov = 0;
      if (o.v != null && o.a != null) { // another moving car
        var rel = Math.cos(S.angDiff(o.a, t.a)); if (rel < -.3 && (ah > 3 || sd > .9)) continue; // oncoming, in its own lane
        ov = Math.max(0, o.v * rel);
        // two cars each in the other's way (a junction): the one with the lower number goes, so nobody waits for ever
        var bx = -dx * Math.cos(o.a) - dy * Math.sin(o.a), bs = Math.abs(-dy * Math.cos(o.a) + dx * Math.sin(o.a)); if (rel < .7 && bx > .5 && bx < 7 + o.v * 1.1 && bs < 1.7 && ah > 3 && (t.pri || 0) < (o.pri || 0)) continue;
      }
      lim = ah < 5.5 ? Math.min(ov, ah < 4 ? 0 : 2) : ov + (ah - 5.5) * 1.4; if (lim < out) { out = lim; t.blk = o; } }
    return Math.max(0, out);
  };
  // Steer car t at its lane point (tx, ty, ta): limited turn rate, slower through sharp turns. Returns metres moved.
  S.carTo = function (t, tx, ty, ta, dt) {
    var d = Math.hypot(tx - t.x, ty - t.y), aim = d > 1.2 ? Math.atan2(ty - t.y, tx - t.x) : ta, da = S.angDiff(aim, t.a), rate = Math.max(1.3, 2.6 - t.v * .08) * dt;
    t.a += Math.abs(da) < rate ? da : (da > 0 ? rate : -rate);
    var v = t.v * (Math.abs(da) > .7 ? .45 : 1) * Math.min(1, .35 + d / 3), step = Math.min(v * dt, d + .2); t.x += Math.cos(t.a) * step; t.y += Math.sin(t.a) * step; t.spd = dt > 0 ? step / dt : 0; return step;
  };

  /* ---------- campus security: heat, warnings, and a chase you can get out of ---------- */
  // Every number that shapes security lives here; S.setRules merges an override (the admin Game Settings page).
  S.RULES = {
    warnings: 5,        // warnings before anyone gives chase (3 to 6)
    warnHeat: 18,       // heat between one warning and the next
    window: 20,         // seconds after the last warning in which one more offence starts a chase
    warnExpire: 40,     // calm seconds before the first warning is forgotten (then one every half of that)
    decay: 1.2,         // heat lost per second while behaving
    unseenDecay: 2.5,   // multiplier on decay when no guard can see you
    heat: { bump: 0, kerb: 0, reckless: 5, shove: 9, crash: 9, hitPed: 16 },
    guards: 2,          // most guards in one chase
    guardSpeed: .86,    // guard running speed as a share of your sprint
    sight: 45,          // metres a guard can see
    range: 110,         // beyond this they lose you at once
    lostAfter: 2.5,     // seconds out of sight before they head for where they last saw you
    search: 12,         // seconds they search there before giving up
    catchTime: .8,      // seconds a guard must stand beside you
    fine: 200           // naira, never more than you carry
  };
  S.setRules = function (o) {
    if (!o || typeof o !== "object") return S.RULES; var R = S.RULES, k;
    for (k in o) { if (k === "heat" && o.heat && typeof o.heat === "object") { for (var h in o.heat) if (isFinite(+o.heat[h])) R.heat[h] = Math.max(0, +o.heat[h]); } else if (k in R && k !== "heat" && isFinite(+o[k])) R[k] = +o[k]; }
    R.warnings = clamp(Math.round(R.warnings), 3, 6); R.guardSpeed = clamp(R.guardSpeed, .3, .97); R.warnHeat = clamp(R.warnHeat, 4, 100 / (R.warnings + .5)); R.guards = clamp(Math.round(R.guards), 1, 4); R.search = Math.max(2, R.search); R.sight = Math.max(8, R.sight); R.decay = Math.max(.05, R.decay); R.fine = Math.max(0, R.fine); return R;
  };
  S.sec = function (p) { var s = p.sec; if (!s || typeof s !== "object") s = p.sec = {}; if (!(s.heat >= 0)) s.heat = 0; if (!(s.warns >= 0)) s.warns = 0; if (!(s.calm >= 0)) s.calm = 0; if (!(s.since >= 0)) s.since = 999; if (!s.state) s.state = ""; return s; };
  // Something happened. Returns null (nothing worth noticing), {warn, of}, {final: true} or {chase: true}.
  S.offend = function (p, kind) {
    var R = S.RULES, w = R.heat[kind] || 0, s = S.sec(p); if (!w || p.god || p.flags.calloff) return null;
    s.heat = Math.min(100, s.heat + w); s.calm = 0; if (s.state) return null;
    if (s.warns >= R.warnings) { if (s.since <= R.window) { s.state = "chase"; s.heat = 100; return { chase: true }; } s.since = 0; return { final: true }; }
    if (s.heat >= R.warnHeat * (s.warns + 1)) { s.warns++; s.since = 0; return { warn: s.warns, of: R.warnings }; }
    return null;
  };
  // Time passing while not chased: heat drains (faster unseen) down to what your standing warnings hold, and warnings expire.
  S.secTick = function (p, dt, seen) {
    var R = S.RULES, s = S.sec(p); s.calm += dt; s.since += dt; if (s.state) return null;
    s.heat = Math.max(Math.min(s.heat, R.warnHeat * s.warns), s.heat - R.decay * (seen ? 1 : R.unseenDecay) * dt);
    if (s.warns > 0 && s.calm > R.warnExpire) { s.warns--; s.calm = R.warnExpire * .5; s.heat = Math.min(s.heat, R.warnHeat * s.warns + R.warnHeat * .5); return { expired: s.warns }; }
    return null;
  };
  S.secClear = function (p, keep) { var s = S.sec(p); s.state = ""; s.heat = keep ? Math.min(s.heat, S.RULES.warnHeat * keep) : 0; s.warns = keep || 0; s.calm = 0; s.since = 999; p.wanted = 0; return s; };
  // Can a see b? Walls block the view.
  S.los = function (W, ax, ay, bx, by) { var d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 2.5); for (var i = 1; i < n; i++) { if (S.insideBuilding(W, ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false; } return true; };
  return S;
});
