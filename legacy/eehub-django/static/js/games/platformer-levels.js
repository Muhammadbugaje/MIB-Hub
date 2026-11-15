/* Kinetic Kingdom: level data, the hero's movement physics and a reachability solver (UMD: browser + Node).
 * PHYS 111 Mechanics: kinematics, projectiles, friction, work–energy, circular motion.
 *
 * Game-world model (disclosed in the physics panel): 1 tile = 1 m, SI units throughout. The kingdom's gravity is
 * g = 36 m/s² (about 3.7 × Earth's 9.8 m/s²) so jumps feel snappy; every readout uses this g. Air drag is modelled
 * only as a terminal fall speed of 20 m/s. Friction: a sliding/braking foot gives at most a = μg.
 *
 * The same heroStep() runs in the game (platformer.js) and in the Node tests' reachability search, so the level
 * checks use the real jump physics, not a guess. */
(function (root) {
  "use strict";

  /* ---------------- Movement constants (SI: m, s, m/s, m/s²) ---------------- */
  var P = {
    G: 36,            // kingdom gravity, m/s²
    MAX_FALL: 20,     // terminal fall speed (simple air-drag model), m/s
    WALK: 6, RUN: 10.5, MOUNT_RUN: 12.5,
    ACC: 28,          // leg drive on good ground, m/s² (also limited by μg)
    AIR_ACC: 20,      // air steering, m/s² (a game allowance: real bodies cannot steer in the air)
    AIR_DRAG: 2,      // gentle air slow-down with no input, m/s²
    SKID: 48,         // turning against your motion, m/s² (limited by μg)
    MU: 0.95, MU_ICE: 0.1,
    JUMP_V: 16, JUMP_RUN_V: 17.5,   // take-off speed walking / at full run, m/s
    CUT: 0.45,        // releasing jump early keeps 45 % of the upward speed (variable jump height)
    COYOTE: 0.1, BUFFER: 0.12,      // forgiveness windows, s
    POUND_V: 24, POUND_HANG: 0.16,
    SPRING_V: 23.5,   // powered spring pads always launch at this speed
    BOOTS_H: 1.4,     // spring boots: 40 % more jump height (extra energy from ½kx²)
    BELT: 3,          // conveyor belt speed, m/s
    WALL_SLIDE: 4, WALL_JUMP_VX: 8, WALL_JUMP_V: 14.5,
    GLIDE_FALL: 3,    // crane-kite glide (mount) caps fall speed, m/s
    // Worlds 5-7. Updraft fans push up with UP_A (net UP_A − g upward) until you rise at UP_MAX; gusts push sideways
    // with GUST_A up to GUST_MAX over the ground. Lunar levels scale gravity by lv.g (weight w = mg).
    UP_A: 70, UP_MAX: 8, GUST_A: 16, GUST_MAX: 15.5,
    // Abilities earned from bosses: an air dash (impulse J = mΔv), a cape glide (drag caps the fall), a second jump.
    DASH_V: 15, DASH_T: 0.16, CAPE_FALL: 4,
    SMALL: { w: 0.68, h: 0.92 }, BIG: { w: 0.72, h: 1.72 }, DUCK_H: 0.92,
    DT: 1 / 120
  };
  P.maxHeight = function (v) { return v * v / (2 * P.G); };            // h = v²/2g
  P.flightTime = function (v) { return 2 * v / P.G; };                 // t = 2v/g (same launch and landing height)
  P.jumpSpeed = function (vx) { var k = Math.max(0, Math.min(1, (Math.abs(vx) - P.WALK) / (P.RUN - P.WALK))); return P.JUMP_V + (P.JUMP_RUN_V - P.JUMP_V) * k; };

  /* ---------------- Tiles ---------------- */
  var TILES = {
    ".": "air", "#": "ground", "I": "ice (μ = 0.1)", ">": "conveyor belt →", "<": "conveyor belt ←", "=": "brick (breakable when big or by ground-pound)",
    "$": "coin brick", "X": "steel block", "q": "spent item crate", "-": "one-way ledge", "^": "spikes", "~": "plasma/lava", "S": "spring pad",
    "?": "coin crate", "E": "energy-cell crate", "F": "EMP crate", "K": "spring-boots crate", "Z": "inertia-shield crate", "U": "backup-drive (1-up) crate", "Y": "mount crate",
    "H": "hidden 1-up crate", "J": "hidden coin crate",
    "o": "coin", "*": "formula fragment", "P": "start", "G": "goal gate", "g": "secret goal gate", "C": "checkpoint beacon", "@": "boss",
    "w": "Scrambler (walker)", "k": "Domebot (shell, kickable puck)", "j": "Spring imp (hopper)", "b": "Static bat (flier)", "s": "Gearback (spiked crawler)",
    "c": "Chaos mortar (cannon)", "u": "Hydraulic press (crusher)", "a": "Spark arm (rotates clockwise)", "A": "Spark arm (anticlockwise)",
    "m": "moving platform (horizontal)", "v": "moving platform (vertical)", "f": "falling platform", "p": "pendulum platform pivot",
    "|": "updraft (air rising from a fan)", "}": "gust blowing right", "{": "gust blowing left",
    "r": "Gust kite (flier that dives)", "x": "Moon hopper (bounces higher in low gravity)"
  };
  for (var d = 1; d <= 9; d++) TILES[String(d)] = "door (pairs with the other " + d + ")";
  var SOLID = "#I><=$Xq?EFKZUY^Sca A".replace(" ", "");
  function kind(ch) { return SOLID.indexOf(ch) >= 0 ? 1 : ch === "-" ? 2 : 0; }
  function isHazard(ch) { return ch === "^" || ch === "~"; }

  /* ---------------- Body vs tile-grid collision ----------------
   * W = { tile(c, r) → char, plats: [{x, y, w, vx, vy}] (optional one-way moving tops) } */
  function sweepX(b, dx, W, ev) {
    b.x += dx; if (!dx) return;
    var top = Math.floor(b.y + 1e-6), bot = Math.floor(b.y + b.h - 1e-6), c, r;
    if (dx > 0) { c = Math.floor(b.x + b.w - 1e-9); for (r = top; r <= bot; r++) if (kind(W.tile(c, r)) === 1) { b.x = c - b.w; b.vx = 0; ev.wall = 1; ev.wallTile = W.tile(c, r); if (W.tile(c, r) === "^") ev.spike = 1; return; } }
    else { c = Math.floor(b.x + 1e-9); for (r = top; r <= bot; r++) if (kind(W.tile(c, r)) === 1) { b.x = c + 1; b.vx = 0; ev.wall = -1; ev.wallTile = W.tile(c, r); if (W.tile(c, r) === "^") ev.spike = 1; return; } }
  }
  function sweepY(b, dy, W, ev) {
    var oldBot = b.y + b.h; b.y += dy;
    var l = Math.floor(b.x + 1e-6), rr = Math.floor(b.x + b.w - 1e-6), c, r;
    if (dy > 0) {
      r = Math.floor(b.y + b.h - 1e-9);
      var hit = null;
      for (c = l; c <= rr; c++) { var ch = W.tile(c, r), k = kind(ch); if (k === 1 || (k === 2 && oldBot <= r + 1e-4 && !b.drop)) { if (!hit || ch === "S" || hit === "^") hit = ch; } }
      if (hit) { b.y = r - b.h; b.vy = 0; ev.land = hit; ev.landRow = r; if (hit === "^") ev.spike = 1; return; }
      if (W.plats) for (var i = 0; i < W.plats.length; i++) { var p = W.plats[i]; if (p.off) continue; if (b.x + b.w > p.x + .02 && b.x < p.x + p.w - .02 && oldBot <= Math.max(p.y, p.y - (p.dy || 0)) + 1e-3 && b.y + b.h >= p.y - 1e-6 && !b.drop) { b.y = p.y - b.h; b.vy = 0; ev.land = "-"; ev.plat = p; ev.landRow = Math.floor(p.y); return; } }
    } else if (dy < 0) {
      r = Math.floor(b.y + 1e-9);
      var hits = [];
      for (c = l; c <= rr; c++) if (kind(W.tile(c, r)) === 1) hits.push(c);
      if (hits.length) {
        // corner correction: if only a sliver of the head clips a block edge, slide around it
        var cx = b.x + b.w / 2;
        if (hits.length === 1 && W.tile(hits[0], r) !== "^") {
          var hc = hits[0], over = cx < hc + .5 ? b.x + b.w - hc : hc + 1 - b.x;
          if (over < 0.26) { var nx = cx < hc + .5 ? hc - b.w : hc + 1, free = true, rows0 = Math.floor(b.y + 1e-6), rows1 = Math.floor(b.y + b.h - 1e-6);
            for (var rw = rows0; rw <= rows1 && free; rw++) for (var cc = Math.floor(nx + 1e-6); cc <= Math.floor(nx + b.w - 1e-6); cc++) if (kind(W.tile(cc, rw)) === 1) free = false;
            if (free) { b.x = nx; return; } }
        }
        b.y = r + 1; b.vy = 0;
        hits.sort(function (a, z) { return Math.abs(a + .5 - cx) - Math.abs(z + .5 - cx); });
        ev.bump = { c: hits[0], r: r }; if (W.tile(hits[0], r) === "^") ev.spike = 1;
      }
    }
  }
  function fits(b, W, x, y, h) {
    for (var r = Math.floor(y + 1e-6); r <= Math.floor(y + h - 1e-6); r++) for (var c = Math.floor(x + 1e-6); c <= Math.floor(x + b.w - 1e-6); c++) if (kind(W.tile(c, r)) === 1) return false;
    return true;
  }

  /* ---------------- Hero controller: input → velocity → collisions. Returns an events object. ----------------
   * inp = { l, r, d, dHit, jump (held), jumpHit, run }.  h = hero state (see newHero). */
  function newHero(x, y, big) {
    var s = big ? P.BIG : P.SMALL;
    return { x: x + 0.5 - s.w / 2, y: y + 1 - s.h, w: s.w, h: s.h, vx: 0, vy: 0, ground: false, surf: "#", coy: 0, buf: 0, jumping: false,
      pound: 0, pounding: false, duck: false, big: !!big, boots: false, mount: null, airJumps: 0, wall: 0, face: 1, skid: false, drop: false, lastJumpV: 0 };
  }
  function approach(v, t, a) { return v < t ? Math.min(t, v + a) : Math.max(t, v - a); }
  // air currents overlapping the body: updraft (up) and gusts (gx = ±1); only scanned on levels that have them
  function airAt(h, W) {
    var up = 0, gx = 0, c0 = Math.floor(h.x + 1e-6), c1 = Math.floor(h.x + h.w - 1e-6), r0 = Math.floor(h.y + 1e-6), r1 = Math.floor(h.y + h.h - 1e-6);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var t = W.tile(c, r); if (t === "|") up = 1; else if (t === "}") gx = 1; else if (t === "{") gx = -1; }
    return up || gx ? { up: up, gx: gx } : null;
  }
  function heroStep(h, inp, dt, W) {
    var ev = {}, dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0), m = h.mount, vxPre = h.vx, gs = W.gs || 1, g = P.G * gs, maxFall = P.MAX_FALL * Math.sqrt(gs), ab = h.abil || {};
    if (dir) h.face = dir;
    var surf = h.ground ? h.surf : null, maglev = m === "maglev";
    var mu = surf === "I" && !maglev ? P.MU_ICE : P.MU, aMax = mu * g;
    var belt = h.ground && !maglev ? (surf === ">" ? P.BELT : surf === "<" ? -P.BELT : 0) : 0;
    var top = inp.run ? (m ? P.MOUNT_RUN : P.RUN) : P.WALK;
    if (m === "horse" && inp.run) top = P.MOUNT_RUN + 1.5;
    // ducking (big heroes shrink; anyone ducking on the ground stops driving)
    var wantDuck = inp.d && h.ground && !m;
    if (wantDuck && !h.duck) { h.duck = true; if (h.h > P.DUCK_H) { h.y += h.h - P.DUCK_H; h.h = P.DUCK_H; } }
    else if (!wantDuck && h.duck) { var full = h.big ? P.BIG.h : P.SMALL.h; if (fits(h, W, h.x, h.y + h.h - full, full)) { h.y += h.h - full; h.h = full; h.duck = false; } }
    var drive = h.duck && h.ground ? 0 : dir;
    h.skid = false;
    if (h.ground) {
      var vr = h.vx - belt;
      if (drive) {
        if (vr * drive < -0.5) { vr += drive * Math.min(P.SKID, aMax) * dt; h.skid = Math.abs(vr) > 2; }
        else if (Math.abs(vr) <= top || vr * drive < 0) vr = approach(vr, drive * top, Math.min(P.ACC, aMax) * dt);
        else vr = approach(vr, drive * top, Math.min(P.ACC * 0.5, aMax) * dt);
      } else vr = approach(vr, 0, aMax * dt);
      h.vx = vr + belt;
    } else {
      if (dir) { if (h.vx * dir < top) h.vx = approach(h.vx, dir * top, P.AIR_ACC * dt); }
      else h.vx = approach(h.vx, 0, P.AIR_DRAG * dt);
    }
    // jump: buffer + coyote time; wall jump; mount double jump
    // ↓ + Jump on a one-way ledge or platform: drop through it instead of jumping
    if (inp.d && inp.jumpHit && h.ground && h.surf === "-" && !m) { h.dropT = 0.22; h.ground = false; h.coy = 0; h.duck = false; var fh0 = h.big ? P.BIG.h : P.SMALL.h; if (h.h < fh0 && fits(h, W, h.x, h.y + h.h - fh0, fh0)) { h.y += h.h - fh0; h.h = fh0; } inp = { l: inp.l, r: inp.r, run: inp.run, jump: false, jumpHit: false }; ev.drop = 1; }
    if (inp.jumpHit) h.buf = P.BUFFER; else h.buf = Math.max(0, h.buf - dt);
    h.coy = h.ground ? P.COYOTE : Math.max(0, h.coy - dt);
    if (h.buf > 0 && !h.pounding) {
      if (h.coy > 0) {
        var v0 = P.jumpSpeed(h.vx - belt) * (h.boots ? Math.sqrt(P.BOOTS_H) : 1);
        h.vy = -v0; h.ground = false; h.coy = 0; h.buf = 0; h.jumping = true; ev.jump = v0; h.lastJumpV = v0; h.airJumps = m === "orbit" || (ab.double && !m) ? 1 : 0;
        if (h.duck) { h.duck = false; var fh = h.big ? P.BIG.h : P.SMALL.h; if (fits(h, W, h.x, h.y + h.h - fh, fh)) { h.y += h.h - fh; h.h = fh; } else h.duck = true; }
      } else if (h.wall && !h.ground && !m && h.vy > -2) {
        h.vy = -P.WALL_JUMP_V; h.vx = -h.wall * P.WALL_JUMP_VX; h.face = -h.wall; h.buf = 0; h.jumping = true; ev.walljump = 1; h.lastJumpV = P.WALL_JUMP_V;
      } else if (h.airJumps > 0) {
        h.airJumps--; h.vy = -P.JUMP_V; h.buf = 0; h.jumping = true; ev.jump = P.JUMP_V; ev.airjump = 1; h.lastJumpV = P.JUMP_V;
      }
    }
    if (h.jumping && !inp.jump && h.vy < 0) { h.vy *= P.CUT; h.jumping = false; }
    if (h.vy >= 0) h.jumping = false;
    // air dash (ability): one per airtime, a horizontal impulse with gravity paused for DASH_T
    if (ab.dash && inp.dashHit && !h.ground && !h.dashed && !h.pounding && !m) { h.dashed = true; h.dashT = P.DASH_T; h.vx = h.face * P.DASH_V; h.vy = 0; vxPre = h.vx; ev.dash = 1; }
    // ground pound
    if (inp.dHit && !h.ground && !h.pounding && !m) { h.pounding = true; h.pound = P.POUND_HANG; h.vx = 0; h.vy = 0; ev.poundStart = 1; h.dashT = 0; }
    if (h.pounding) { h.vx = 0; vxPre = 0; if (h.pound > 0) { h.pound -= dt; h.vy = 0; } else h.vy = P.POUND_V; }
    var vyPre = h.vy;
    if (h.dashT > 0) { h.dashT -= dt; h.vy = 0; vyPre = 0; }
    else if (!h.pounding) {
      h.vy = Math.min(maxFall, h.vy + g * dt);
      if (m === "crane" && inp.jump && h.vy > P.GLIDE_FALL) h.vy = P.GLIDE_FALL;
      if (m === "drone" && inp.jump && h.vy > 1.2 && h.hover > 0) { h.vy = 1.2; h.hover -= dt; }
      if (ab.glide && !m && inp.jump && !h.jumping && h.vy > P.CAPE_FALL) { h.vy = P.CAPE_FALL; ev.glide = 1; }
      // updrafts and gusts: forces from moving air
      var air = W.air ? airAt(h, W) : null;
      if (air) {
        if (air.up) h.vy = Math.max(-P.UP_MAX, h.vy - P.UP_A * dt);
        if (air.gx && h.vx * air.gx < P.GUST_MAX) h.vx = Math.min(P.GUST_MAX, Math.max(-P.GUST_MAX, h.vx + air.gx * P.GUST_A * dt));
        ev.air = air;
      }
    }
    // wall slide
    if (h.wall && !h.ground && dir === -h.wall * -1 && h.vy > P.WALL_SLIDE && !m && !h.pounding) h.vy = P.WALL_SLIDE;
    // integrate with collisions
    h.dropT = Math.max(0, (h.dropT || 0) - dt); h.drop = h.dropT > 0;
    var wasGround = h.ground, preVy = h.vy;
    // exact update for constant acceleration over the step: displacement = average velocity × dt
    if (ev.walljump) vxPre = h.vx;
    sweepX(h, (vxPre + h.vx) / 2 * dt, W, ev);
    sweepY(h, (vyPre + h.vy) / 2 * dt, W, ev);
    h.ground = !!ev.land;
    h.wall = 0;
    if (!h.ground) { // wall contact check (for slides and wall jumps)
      var rows0 = Math.floor(h.y + .1), rows1 = Math.floor(h.y + h.h - .1);
      for (var rw = rows0; rw <= rows1; rw++) { if (kind(W.tile(Math.floor(h.x - .05), rw)) === 1 && W.tile(Math.floor(h.x - .05), rw) !== "I") h.wall = -1; if (kind(W.tile(Math.floor(h.x + h.w + .05), rw)) === 1 && W.tile(Math.floor(h.x + h.w + .05), rw) !== "I") h.wall = 1; }
    }
    if (h.ground) {
      if (ev.plat) h.surf = "-";
      else { var cl = W.tile(Math.floor(h.x + .1), ev.landRow), cr = W.tile(Math.floor(h.x + h.w - .1), ev.landRow);
        h.surf = (cl === "I" && (cr === "I" || kind(cr) !== 1)) || (cr === "I" && kind(cl) !== 1) ? "I" : kind(cl) === 1 ? cl : cr; }
      // landing refills the air jump, so walking off a ledge still leaves the double jump
      if (!wasGround) { ev.landed = preVy; h.airJumps = m === "orbit" || (ab.double && !m) ? 1 : 0; if (h.pounding) { ev.pound = { c: Math.floor(h.x + h.w / 2), r: ev.landRow }; } h.pounding = false; h.hover = 0.6; h.dashed = false; h.dashT = 0; }
      if (ev.land === "S" && !ev.spike) { h.vy = -P.SPRING_V; h.ground = false; ev.spring = 1; h.jumping = false; h.pounding = false; }
    }
    // hazards touching the body
    var r0 = Math.floor(h.y), r1 = Math.floor(h.y + h.h + 0.02), c0 = Math.floor(h.x), c1 = Math.floor(h.x + h.w);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var t = W.tile(c, r);
      if (t === "~" && h.y + h.h > r + 0.35 && h.x + h.w > c && h.x < c + 1) ev.lava = 1;
      if (t === "^" && h.y + h.h >= r - 0.01 && h.y <= r + 1 && h.x + h.w > c + .08 && h.x < c + .92) ev.spike = 1;
    }
    return ev;
  }

  /* ---------------- Level builder ----------------
   * A cursor walks left to right laying floor at height f (tiles above the bottom row). put()/art() stamp tiles at a
   * height y above the floor surface (y = 1 is the first row of air). Rooms (hidden areas) go after the main course. */
  function Builder(H) {
    var rows = [], b = { x: 0, f: 2, H: H, objs: {}, zones: [], mainEnd: 0 };
    function set(c, r, ch) { if (r < 0 || r >= H || c < 0) return; while (rows.length < H) rows.push([]); var row = rows[r]; while (row.length <= c) row.push("."); row[c] = ch; }
    function width() { var w = 0; rows.forEach(function (r) { w = Math.max(w, r.length); }); return w; }
    b.set = set; b.rowAt = function (y) { return H - b.f - y; };
    b.get = function (c, r) { return rows[r] && rows[r][c] || "."; };
    b.g = function (n, top) { for (var i = 0; i < n; i++) { for (var r = H - b.f; r < H; r++) set(b.x, r, r === H - b.f ? (top || "#") : "#"); for (var r2 = 0; r2 < H - b.f; r2++) if (!rows[r2] || !rows[r2][b.x]) set(b.x, r2, "."); b.x++; } return b; };
    b.ice = function (n) { return b.g(n, "I"); };
    b.belt = function (n, dir) { return b.g(n, dir < 0 ? "<" : ">"); };
    b.pit = function (n) { for (var i = 0; i < n; i++) { set(b.x, 0, b.get(b.x, 0)); b.x++; } return b; };
    b.lava = function (n) { for (var i = 0; i < n; i++) { for (var r = Math.min(H - 1, H - b.f + 1); r < H; r++) set(b.x, r, "~"); for (var r2 = 0; r2 < H - b.f + 1; r2++) if (!rows[r2] || !rows[r2][b.x]) set(b.x, r2, "."); b.x++; } return b; };
    b.spk = function (n) { for (var i = 0; i < n; i++) { b.g(1); set(b.x - 1, H - b.f - 1, "^"); } return b; };
    // s(n, fn, top): lay n columns of floor (or "pit", "lava", "bridge", "spk", "I", ">", "<") and decorate with fn(b)
    // using offsets from the segment's first column.
    b.s = function (n, fn, top) {
      var x0 = b.x;
      if (top === "pit") b.pit(n); else if (top === "lava") b.lava(n); else if (top === "spk") b.spk(n);
      else if (top === "bridge") { b.pit(n); for (var i = 0; i < n; i++) set(x0 + i, H - b.f, "-"); }
      else b.g(n, top);
      if (fn) { var x1 = b.x; b.x = x0; fn(b); b.x = x1; }
      return b;
    };
    b.roof = function (dx, n, k) { for (var c = 0; c < n; c++) for (var r = 0; r < k; r++) set(b.x + dx + c, r, "#"); return b; };
    b.e = function (dx, s) { return b.put(dx, 1, s); };
    b.arena = function () { b.arenaX = b.x; return b; };
    b.up = function (k) { b.f += k; return b; };
    b.dn = function (k) { b.f -= k; return b; };
    b.put = function (dx, y, s) { var r = H - b.f - y; for (var i = 0; i < s.length; i++) if (s[i] !== " ") set(b.x + dx + i, r, s[i]); return b; };
    b.art = function (dx, lines, y0) { var n = lines.length; for (var k = 0; k < n; k++) b.put(dx, (y0 || 1) + n - 1 - k, lines[k]); return b; };
    b.col = function (dx, y0, y1, ch) { for (var y = y0; y <= y1; y++) b.put(dx, y, ch); return b; };
    b.obj = function (dx, y, ch, o) { b.put(dx, y, ch); b.objs[(b.x + dx) + "," + (H - b.f - y)] = o; return b; };
    // moving air: fill empty cells only, so tiles placed on top keep working
    b.updraft = function (dx, w, top) { var r0 = H - b.f - top; for (var c = b.x + dx; c < b.x + dx + w; c++) for (var r = Math.max(0, r0); r < H; r++) if (b.get(c, r) === ".") set(c, r, "|"); return b; };
    b.gust = function (dx, w, y0, y1, dir) { var ch = dir < 0 ? "{" : "}"; for (var c = b.x + dx; c < b.x + dx + w; c++) for (var y = y0; y <= y1; y++) { var r = H - b.f - y; if (r >= 0 && r < H && b.get(c, r) === ".") set(c, r, ch); } return b; };
    b.abs = function (c, r, lines) { lines.forEach(function (ln, k) { for (var i = 0; i < ln.length; i++) if (ln[i] !== " ") set(c + i, r + k, ln[i]); }); return b; };
    b.end = function () { b.mainEnd = b.x; b.zones.push({ x0: 0, x1: b.x }); return b; };
    // a hidden room: walled box after the main course; lines (top → bottom) fill the bottom rows of the level
    b.room = function (lines) {
      var x0 = width() + 1, w = lines[0].length + 2, top = H - lines.length - 1;
      for (var c = x0 - 1; c < x0 + w; c++) for (var r = 0; r < H; r++) set(c, r, "#");
      b.abs(x0 + 1, top + 1, lines);
      for (var c2 = x0 + 1; c2 < x0 + w - 1; c2++) for (var r2 = top + 1; r2 < H; r2++) if (b.get(c2, r2) === "#" && r2 - top - 1 < lines.length && lines[r2 - top - 1][c2 - x0 - 1] === " ") set(c2, r2, ".");
      b.zones.push({ x0: x0, x1: x0 + w, y0: top, room: true });
      return b;
    };
    b.done = function () {
      var w = width(); return rows.map(function (r) { while (r.length < w) r.push("."); return r.join(""); });
    };
    return b;
  }

  /* ---------------- Reusable set pieces (hand-placed with parameters in each level) ---------------- */
  function stairs(b, n, dir) { // solid staircase of n steps rising (dir 1) or falling (-1)
    for (var i = 0; i < n; i++) { var hgt = dir > 0 ? i + 1 : n - i; b.g(1); for (var y = 1; y <= hgt; y++) b.put(-1, y, "X"); }
    return b;
  }

  /* ---------------- Worlds and levels ---------------- */
  var WORLDS = [
    { id: 1, name: "Campus Green", theme: "grass", song: { seed: 1100, style: "chip" },
      concept: { title: "Kinematics: jumping is a projectile", body: "Leave the ground at speed v₀ and gravity slows you at g until you stop rising. Highest point: <b>h = v₀²/2g</b>. Time in the air (landing at the same height): <b>t = 2v₀/g</b>. Running adds horizontal speed, so a running jump goes further: range = v<sub>x</sub>·t." } },
    { id: 2, name: "Cryo Lab", theme: "ice", song: { seed: 2100, style: "calm" },
      concept: { title: "Friction: f = μN", body: "Friction is what lets your feet push you and stop you. The most it can give is <b>f = μN = μmg</b>, so the biggest braking (or speeding-up) acceleration is <b>a = μg</b>. Ice has μ ≈ 0.1, so you need about <b>d = v²/2μg</b> to stop, ten times further than on grass (μ ≈ 0.95). Belts add their own speed: your speed over the ground is <b>v = v<sub>rel</sub> + u</b>." } },
    { id: 3, name: "Volcanic Power Station", theme: "volcano", song: { seed: 3100, style: "boss" },
      concept: { title: "Work and energy", body: "A spring compressed by x stores <b>E = ½kx²</b>; the spring force is <b>F = kx</b> (Hooke's law). Released, that energy becomes kinetic energy <b>½mv²</b>, then height <b>mgh</b>. A crusher dropped from height h hits at <b>v = √(2gh)</b>: its potential energy turned into motion." } },
    { id: 4, name: "Storm Grid", theme: "storm", song: { seed: 4100, style: "synthwave" },
      concept: { title: "Circular motion", body: "Anything moving on a circle of radius r at speed v accelerates toward the centre at <b>a = v²/r</b>, so something must pull inward with <b>F = mv²/r</b>: a rope, a rod, gravity. Spinning arms turn at angular speed ω, and a point at radius r moves at <b>v = ωr</b>." } },
    { id: 5, name: "Windward Cliffs", theme: "cliffs", song: { seed: 5100, style: "anthem" },
      concept: { title: "Forces add: Newton's second law", body: "Several forces act at once and only their sum moves you: <b>ΣF = ma</b>. A fan's updraft pushes up harder than gravity pulls down, so the net force is upward and you rise; a gust pushes sideways and your jump goes further. Drag grows with speed, so each push has a top speed where the forces balance." } },
    { id: 6, name: "Lunar Annex", theme: "moon", song: { seed: 6100, style: "dub" },
      concept: { title: "Weight is w = mg", body: "Your mass is the same everywhere, but your <b>weight w = mg</b> depends on g. Here g is a little over half the kingdom's, so the same take-off speed carries you higher, <b>h = v²/2g</b>, and for longer, <b>t = 2v/g</b>. Friction is weaker too (it depends on weight: <b>f = μmg</b>), so you skid further." } },
    { id: 7, name: "Entropy Citadel", theme: "citadel", song: { seed: 7100, style: "boss", scale: "phrygian" },
      concept: { title: "Energy is conserved", body: "Count Entropy's fortress uses every trick at once. Through all of them one rule holds: energy changes form but is never lost. Height becomes speed (<b>mgh → ½mv²</b>), springs store <b>½kx²</b>, friction turns motion into heat. Entropy only wins where energy is wasted." } }
  ];

  var LEVELS = [];
  function level(def) { LEVELS.push(def); def.stage = LEVELS.length; return def; }

  /* ===== World 1: Campus Green ===== */
  level({ id: "1-1", world: 1, name: "Freshers' Lawn", theme: "grass", H: 17, time: 400, song: { seed: 1101, style: "chip", bpm: 132 },
    hint: "Hold Run (or double-tap a direction) for longer jumps. Stomp Scramblers. Head-butt crates from below.",
    build: function (b) {
      // the lawn: a park bench, a planter and the first crates up on a step
      b.s(18, function (b) { b.e(2, "P").put(5, 2, "ooo").art(9, ["X", "X"]).put(12, 5, "?E?").put(16, 3, "o").e(15, "w"); });
      b.s(12, function (b) { b.put(2, 2, "---").put(6, 4, "---").put(7, 5, "oo").e(10, "w"); });
      b.s(12, function (b) { b.art(4, ["XXX", "XXX"]).put(4, 3, "o o").e(1, "w").e(9, "w"); });
      b.s(11, function (b) { b.put(1, 4, "J").art(6, ["X", "X", "X"]).put(6, 4, "o").e(9, "w"); });
      b.s(3, null, "pit");
      b.s(14, function (b) { b.put(3, 4, "=?=$=").put(3, 8, "o *o").e(9, "w w"); });
      b.s(2, null, "pit").s(5, function (b) { b.e(2, "j"); }).s(3, null, "pit");
      b.s(16, function (b) { b.e(4, "k").put(7, 4, "?").put(10, 4, "==?==").e(14, "C"); });
      b.s(14, function (b) { b.put(2, 3, "-----").put(6, 6, "-----").put(8, 7, "*").e(11, "j").put(3, 4, "ooo"); });
      b.s(12, function (b) { b.put(3, 4, "?Y?").e(9, "w").e(11, "w"); });
      b.up(2).s(10, function (b) { b.e(5, "w").put(3, 4, "ooo"); }).dn(2);
      b.s(4).s(7, function (b) { b.obj(2, 1, "m", { range: 2 }); b.put(1, 4, "ooooo"); }, "pit");
      b.s(14, function (b) { b.put(2, 4, "=F=").put(2, 8, "ooo").e(8, "k").e(12, "w"); });
      b.s(4).s(2, null, "pit").s(4, function (b) { b.put(1, 5, "b"); }).s(3, null, "pit").s(4).s(4, function (b) { b.put(1, 5, "b"); }, "pit").s(5);
      // treetop ledges over a long gully
      b.s(3).s(22, function (b) { b.put(1, 2, "---").put(6, 4, "----").put(12, 3, "---").put(17, 5, "----").put(7, 5, "ooo").put(18, 7, "oo").put(12, 6, "b"); }, "pit").s(3);
      b.s(16, function (b) { b.e(2, "C").e(6, "w w").put(5, 4, "?=?=?").put(7, 8, "H").e(13, "j"); });
      // domebot bowling alley: stomp the shell, kick the puck into the line of Scramblers
      b.s(22, function (b) { b.e(3, "k").e(9, "w").e(11, "w").e(13, "w").e(15, "w").art(19, ["X", "X"]).put(6, 4, "?   ?"); });
      // brick canopy
      b.s(18, function (b) { b.put(3, 4, "==========").put(3, 8, "=?===?===$").put(4, 9, "oooooooo").e(6, "w").e(10, "w").put(14, 1, "1"); });
      b.s(12, function (b) { b.e(3, "S").put(6, 8, "------").put(7, 9, "oooo").put(9, 10, "*").e(11, "2"); });
      b.s(6, function (b) { b.e(3, "w"); });
      // EXT-1-1
      // campus quad: a Scrambler parade, rising lecture-hall ledges and a lift over the pond
      b.s(12, function (b) { b.e(3, "w").e(5, "w").e(7, "w").put(2, 4, "o=?=o").art(10, ["XX", "XX"]); });
      b.s(3, null, "pit").s(3, function (b) { b.put(1, 4, "o"); }).s(3, null, "pit").s(3).s(3, null, "pit");
      b.s(18, function (b) { b.put(2, 3, "---").put(6, 5, "---").put(10, 7, "---").put(14, 9, "----").put(15, 10, "oo").put(11, 8, "o").e(8, "j").e(15, "w"); });
      b.s(16, function (b) { b.put(3, 4, "?=$=?").e(6, "k").e(11, "w w").put(4, 8, "J"); });
      b.s(6, function (b) { b.obj(1, 2, "m", { range: 1 }); b.put(2, 5, "b"); }, "pit");
      b.s(14, function (b) { b.art(3, ["XX", "XX"]).art(8, ["XX", "XX", "XX"]).e(6, "j").e(12, "w").put(8, 5, "ooo"); });
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(18, function (b) { b.e(7, "G").put(2, 3, "o o o"); });
      b.end();
      b.room(["                         ",
              "  oooooooooooooooooooo   ",
              "                         ",
              "  oooooooooooooooooooo   ",
              "                         ",
              "  ===?====$====?===      ",
              "                         ",
              "                         ",
              "                         ",
              " 1                     2 ",
              "#########################",
              "#########################"]);
    } });

  level({ id: "1-2", world: 1, name: "Lecture Hall Basement", theme: "lab", H: 17, time: 400, song: { seed: 1202, style: "funk", bpm: 112 },
    hint: "Big heroes break bricks with their head. Down in mid-air = ground-pound.",
    build: function (b) {
      b.s(12, function (b) { b.e(2, "P").put(6, 4, "?").e(10, "w"); });
      b.s(16, function (b) { b.roof(0, 16, 2).put(3, 4, "=E=?=").e(9, "w w").put(4, 8, "oooo"); });
      b.s(14, function (b) { b.roof(0, 14, 2).art(5, ["===", "===", "==="]).put(5, 4, "ooo").e(11, "k"); });
      // low corridor
      b.s(18, function (b) { b.roof(0, 18, 8).put(2, 1, "ooooooooooooo").e(8, "w").e(13, "j"); b.put(15, 3, "J"); });
      b.s(16, function (b) { b.roof(0, 16, 4).put(2, 4, "--- ---").put(10, 6, "----").put(11, 7, "*").e(5, "w").e(13, "w"); });
      b.s(5, function (b) { b.roof(0, 5, 2); }, "pit");
      b.s(14, function (b) { b.roof(0, 14, 2).put(3, 4, "=?==?=").put(3, 8, "======").e(7, "k").e(12, "C"); });
      // a lift shaft up to the mezzanine
      b.s(8, function (b) { b.roof(0, 8, 2).obj(2, 1, "v", { range: 3 }); b.put(0, 8, "o").put(7, 8, "o"); }, "pit");
      b.up(5).s(20, function (b) { b.roof(0, 20, 2).e(3, "w").e(6, "w").put(9, 4, "?Y?").e(14, "j").put(16, 3, "ooo"); });
      b.dn(5).s(3, function (b) { b.roof(0, 3, 2); }, "pit");
      b.s(18, function (b) { b.roof(0, 18, 2).put(2, 1, "1").put(5, 3, "XX  XX  XX").put(5, 4, "o   o   o").e(8, "s").e(14, "w").put(16, 4, "=F="); });
      // tiered lecture seating
      b.s(4, function (b) { b.roof(0, 4, 2); });
      stairs(b, 5, 1); b.s(6, function (b) { b.roof(0, 6, 2).put(1, 6, "w").put(1, 7, "oooo").art(0, ["XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX", "XXXXXX"]); });
      stairs(b, 5, -1);
      b.s(12, function (b) { b.roof(0, 12, 2).e(3, "j").e(7, "w").put(4, 4, "?=?").put(5, 8, "*"); });
      b.s(6, function (b) { b.roof(0, 6, 2).put(0, 0, "------"); }, "pit");
      b.s(14, function (b) { b.roof(0, 14, 2).e(2, "C").put(6, 4, "==$==").e(10, "k").e(12, "w"); });
      b.s(20, function (b) { b.roof(0, 20, 6).put(2, 1, "o o o o o o o o o").e(6, "w").e(10, "w").e(14, "w").put(18, 3, "?"); });
      b.s(10, function (b) { b.roof(0, 10, 2).obj(3, 2, "m", { range: 2 }); b.put(3, 6, "ooo"); }, "pit");
      b.s(16, function (b) { b.roof(0, 16, 2).put(3, 4, "=U=").put(7, 3, "-----").put(8, 6, "---").e(12, "j").e(14, "2"); });
      b.s(8, function (b) { b.roof(0, 8, 2).e(4, "b"); });
      // EXT-1-2
      // the server room: shells ricochet between racks, lifts between floors
      b.s(18, function (b) { b.roof(0, 18, 2).art(2, ["X", "X"]).e(4, "k").e(8, "w").e(10, "w").e(12, "w").art(15, ["X", "X"]).put(6, 5, "oooo"); });
      b.s(6, function (b) { b.roof(0, 6, 2).obj(1, 2, "v", { range: 2 }); }, "pit");
      b.up(4).s(14, function (b) { b.roof(0, 14, 2).put(3, 4, "=?=").e(7, "j").e(11, "w").put(9, 3, "J"); }).dn(4);
      b.s(4, function (b) { b.roof(0, 4, 2); }, "pit");
      b.s(16, function (b) { b.roof(0, 16, 6).put(1, 1, "oooooooooooooo").e(5, "s").e(11, "w"); });
      b.s(12, function (b) { b.roof(0, 12, 2).art(4, ["===", "===", "==="]).put(5, 4, "o$o").e(9, "j"); });
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(16, function (b) { b.e(6, "G"); });
      b.end();
      b.room(["######################",
              "#                    #",
              "#  ooo  ooo  ooo     #",
              "#                    #",
              "# =?== =$== =?==     #",
              "#                    #",
              "#          o o o     #",
              "#                    #",
              "# 1     ---    -*-  2#",
              "######################",
              "######################"]);
    } });

  level({ id: "1-3", world: 1, name: "Clocktower Climb", theme: "grass", H: 40, time: 450, song: { seed: 1303, style: "anthem", bpm: 124 }, secret: true,
    hint: "Climb the tower. Somewhere above the clock there is a second way out.",
    build: function (b) {
      b.s(16, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w").e(13, "w"); });
      b.s(12, function (b) { b.art(5, ["XX", "XX", "XX"]).e(9, "j").put(4, 6, "oooo"); });
      b.s(14, function (b) { b.e(2, "k").put(6, 4, "=?=").e(11, "w"); });
      // inside the clocktower: zig-zag ledges, 3 m apart
      b.s(15, function (b) {
        b.col(0, 5, 32, "X");
        b.put(8, 3, "-----").put(2, 6, "----").put(8, 9, "-----").put(2, 12, "----").put(8, 15, "-----").put(2, 18, "----").put(9, 21, "-----");
        b.put(3, 7, "ooo").put(9, 10, "oo").put(3, 13, "ooo").put(9, 16, "oo").put(3, 19, "*").put(6, 11, "b").put(6, 17, "b").e(11, "w").put(10, 10, "j");
      });
      b.up(24);
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "w").put(1, 6, "-----").put(2, 9, "---").put(2, 10, "S"); });
      b.s(4, null, "pit");
      b.s(10, function (b) { b.e(3, "w").put(2, 4, "ooo"); });
      b.s(6, function (b) { b.obj(1, 0, "m", { range: 1 }); b.put(1, 4, "b"); }, "pit");
      b.up(2).s(12, function (b) { b.put(3, 4, "=F=").e(8, "k"); }).dn(2);
      b.s(5, null, "pit");
      // the clock face: swinging pendulum platforms
      b.s(12, function (b) { b.put(1, 1, "--").put(10, 1, "--"); b.obj(5, 8, "p", { len: 4, amp: 0.8 }); b.put(5, 3, "ooo"); }, "pit");
      b.s(12, function (b) { b.e(3, "w").e(7, "j").put(4, 4, "?=?").put(5, 8, "*"); });
      b.s(4, null, "pit").s(8, function (b) { b.e(4, "b"); }).s(4, null, "pit");
      b.s(14, function (b) { b.e(2, "C").e(8, "w w").put(5, 4, "=?=$=").put(11, 1, "S"); b.put(11, 8, "--"); });
      // hidden roof path to the secret gate (spring up from the ledge above)
      b.s(10, function (b) { b.put(1, 9, "--------").put(1, 10, "o o o").put(7, 12, "---").put(8, 13, "g"); });
      b.s(3, null, "pit");
      // way down: falling floors back toward the ground
      b.s(10, function (b) { b.e(4, "w").put(3, 4, "ooo"); });
      b.dn(6).s(10, function (b) { b.e(5, "j"); });
      b.dn(6).s(10, function (b) { b.put(3, 4, "?").e(7, "w"); });
      b.dn(6).s(12, function (b) { b.e(3, "k").e(8, "w"); });
      b.s(4, null, "pit");
      b.s(6, function (b) { b.obj(1, 1, "f", {}); }, "pit");
      b.dn(4).s(14, function (b) { b.e(4, "w w").put(6, 4, "=U=").e(11, "b"); });
      b.s(16, function (b) { b.put(2, 4, "?").put(6, 3, "XX").put(6, 2, "XX").put(6, 1, "XX").put(10, 4, "*").e(12, "j"); });
      // EXT-1-3
      // garden terraces back on the ground
      b.s(14, function (b) { b.put(2, 3, "XX").put(6, 5, "XX").put(10, 3, "XX").put(6, 6, "o").e(8, "w").e(12, "w"); });
      b.s(4, null, "pit").s(10, function (b) { b.put(2, 4, "=?=").e(6, "k"); }).s(5, function (b) { b.obj(1, 1, "m", { range: 1 }); }, "pit");
      b.s(14, function (b) { b.e(2, "j").e(6, "w w").put(5, 4, "o o o").put(10, 3, "-----").put(11, 6, "---").put(12, 7, "oo"); });
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G"); });
      b.end();
    } });

  level({ id: "1-4", world: 1, name: "Quad Showdown", theme: "grass", H: 17, time: 300, song: { seed: 1404, style: "boss", bpm: 150 }, boss: "brute",
    hint: "The Bulk Scrambler shakes the ground when it lands. Jump the shockwave, then stomp it while it is dizzy.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(3, null, "pit").s(12, function (b) { b.e(4, "w w").put(5, 4, "=?=").put(6, 8, "*"); });
      b.s(4, null, "pit").s(10, function (b) { b.e(3, "j").put(2, 5, "ooo"); });
      b.s(12, function (b) { b.art(3, ["XX", "XX", "XX"]).e(8, "k").put(9, 4, "?"); });
      b.s(6, function (b) { b.put(1, 2, "--").put(3, 4, "--*").put(2, 6, "b"); }, "pit");
      b.s(16, function (b) { b.e(3, "C").put(6, 4, "?Y?").e(11, "w").e(13, "w"); });
      b.s(5, function (b) { b.put(2, 5, "o"); });
      b.arena();
      b.s(26, function (b) { b.put(4, 4, "---").put(19, 4, "---").put(12, 7, "--").put(12, 8, "*").put(4, 5, "ooo").put(19, 5, "ooo").e(15, "@").e(23, "G"); });
      b.up(15).s(3);
      b.end();
    } });

  /* ===== World 2: Cryo Lab (ice: μ = 0.1) ===== */
  level({ id: "2-1", world: 2, name: "Frost Annex", theme: "ice", H: 17, time: 400, song: { seed: 2101, style: "calm", bpm: 104 },
    hint: "Ice has μ = 0.1: you need ten times the distance to stop. Start braking early.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(18, function (b) { b.put(3, 4, "=?=").e(8, "s").put(11, 3, "-----").put(12, 4, "ooo").e(15, "w"); }, "I");
      b.s(3, null, "pit").s(7, function (b) { b.put(2, 3, "ooo"); }, "I").s(3, null, "pit");
      b.s(14, function (b) { b.e(4, "w w").put(6, 4, "=?=$=").put(4, 5, "*"); }, "I");
      b.s(5, null, "spk");
      b.s(12, function (b) { b.e(2, "C").put(6, 4, "?Y?").e(10, "s"); }, "I");
      // grippy frosted-steel stepping blocks over a crevasse
      b.s(24, function (b) { b.put(2, 2, "XXX").put(8, 3, "XXX").put(14, 4, "XXX").put(19, 3, "XXX").put(14, 7, "o").put(9, 6, "b").put(19, 6, "b"); }, "pit");
      b.s(18, function (b) { b.e(4, "w").e(8, "k").put(11, 4, "==F==").put(1, 1, "1"); }, "I");
      b.s(4, null, "pit");
      b.up(2).s(12, function (b) { b.e(3, "s").put(5, 4, "ooo"); }, "I").dn(2);
      b.s(6, function (b) { b.obj(1, 1, "m", { range: 1 }); }, "pit");
      b.s(16, function (b) { b.e(2, "C").put(5, 4, "=?=?=").put(6, 8, "H").e(12, "j"); });
      b.s(20, function (b) { b.put(1, 3, "--------").put(10, 6, "--------").put(13, 7, "*").e(4, "s").e(15, "w").put(2, 4, "oooooo"); }, "I");
      b.s(5, null, "spk");
      b.s(16, function (b) { b.e(3, "w w w").put(7, 4, "?U?").e(13, "2"); }, "I");
      // EXT-2-1
      // the flash-freezer: long ice runs with grippy steel islands
      b.s(20, function (b) { b.e(4, "s").e(9, "w").e(14, "s").put(5, 4, "=?==?=").put(16, 3, "XXX").put(17, 4, "o"); }, "I");
      b.s(4, null, "pit").s(6, function (b) { b.put(1, 3, "oooo"); }).s(4, null, "pit");
      b.s(18, function (b) { b.put(2, 3, "IIII").put(8, 5, "IIII").put(14, 3, "IIII").put(9, 6, "ooo").e(5, "w").e(12, "k"); }, "I");
      b.s(5, null, "spk").s(10, function (b) { b.e(4, "s").put(2, 4, "?K?"); }, "I");
      stairs(b, 5, 1); b.s(4, null, "pit");
      b.up(4).s(12, function (b) { b.e(5, "s").put(3, 4, "ooooo"); }, "I").dn(4);
      b.s(3, null, "pit");
      b.s(22, function (b) { b.e(3, "k").e(9, "w").e(12, "w").e(15, "w").put(5, 4, "?   ?").put(18, 3, "*"); b.put(17, 2, "XXX"); }, "I");
      b.s(4, null, "spk").s(4, null, "I").s(4, null, "spk");
      b.s(12, function (b) { b.e(4, "s").put(6, 4, "=$="); }, "I");
      b.s(18, function (b) { b.e(8, "G"); }, "I");
      b.end();
      b.room(["                        ",
              "  o o o o o o o o o o   ",
              "                        ",
              "  IIIIIIIIIIIIIIIIIIII  ",
              "                        ",
              "   ?=?=?          ooo   ",
              "                        ",
              " 1                    2 ",
              "IIIIIIIIIIIIIIIIIIIIIIII",
              "########################"]);
    } });

  level({ id: "2-2", world: 2, name: "Cold-Store Conveyors", theme: "ice", H: 17, time: 420, song: { seed: 2202, style: "breaks", bpm: 118 }, secret: true,
    hint: "On a belt your speed over the floor is your walking speed plus the belt's: v = v_rel + u.",
    build: function (b) {
      b.s(12, function (b) { b.e(2, "P").put(5, 4, "?E?").e(10, "w"); });
      b.s(16, function (b) { b.roof(0, 16, 2).put(5, 4, "=?=").e(11, "w"); }, ">");
      b.s(14, function (b) { b.roof(0, 14, 2).put(6, 7, "u").e(11, "s"); });
      b.s(16, function (b) { b.roof(0, 16, 2).e(4, "w").e(8, "w").put(3, 4, "oooo").put(10, 4, "?K?"); }, "<");
      b.s(4, function (b) { b.roof(0, 4, 2); }, "pit");
      b.s(14, function (b) { b.roof(0, 14, 2).e(2, "C").put(5, 7, "u").put(9, 7, "u").put(5, 2, "o").put(9, 2, "o"); });
      b.s(18, function (b) { b.roof(0, 18, 2).put(2, 3, "-----").put(8, 5, "------").put(10, 6, "*").e(14, "c").e(5, "w"); }, ">");
      b.s(5, function (b) { b.roof(0, 5, 2); }, "pit");
      b.s(18, function (b) { b.roof(0, 18, 2).e(3, "k").e(9, "w").e(12, "w").put(6, 4, "=?==?=").put(7, 8, "$"); }, "<");
      b.s(12, function (b) { b.roof(0, 12, 2).art(3, ["XX", "XX", "XX"]).e(1, "j").e(9, "c"); });
      b.s(6, function (b) { b.roof(0, 6, 2).obj(1, 2, "m", { range: 1 }); }, "pit");
      b.s(16, function (b) { b.roof(0, 16, 2).e(2, "C").put(5, 4, "?Y?").e(11, "s").put(13, 7, "u"); }, ">");
      // freezer racks: belt floors in opposite directions stacked up
      b.s(20, function (b) { b.roof(0, 20, 2).put(2, 3, ">>>>>>>").put(10, 6, "<<<<<<<").put(3, 7, "-----").put(4, 8, "*").e(14, "w").e(17, "c").put(11, 7, "ooooo"); });
      b.s(4, function (b) { b.roof(0, 4, 2); }, "pit");
      b.s(18, function (b) { b.roof(0, 18, 2).put(4, 7, "u").put(8, 7, "u").put(12, 7, "u").e(16, "w"); }, "<");
      b.s(12, function (b) { b.roof(0, 12, 2).put(3, 4, "=U=").e(8, "s").put(10, 1, "1"); });
      b.s(5, null, "spk");
      b.s(18, function (b) { b.e(3, "w").e(5, "w").e(7, "w").put(9, 4, "=F=").e(14, "j"); }, ">");
      b.s(10, function (b) { b.e(4, "c").put(6, 3, "ooo"); });
      // EXT-2-2
      // the loading dock: belts against you, presses over the gaps
      b.s(16, function (b) { b.roof(0, 16, 2).put(4, 7, "u").put(10, 7, "u").e(7, "w").e(13, "s"); }, "<");
      b.s(4, function (b) { b.roof(0, 4, 2); }, "pit");
      b.s(16, function (b) { b.roof(0, 16, 2).put(2, 3, "<<<<<").put(9, 5, ">>>>>").put(10, 6, "ooo").e(14, "c").e(5, "w"); });
      b.s(12, function (b) { b.roof(0, 12, 2).put(3, 4, "=$=").e(7, "k").e(10, "j"); }, ">");
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(16, function (b) { b.e(7, "G").put(3, 4, "*"); });
      b.end();
      b.room(["######################",
              "#                    #",
              "#  oooooooooooooo    #",
              "#                    #",
              "#  >>>>>>>>>>>>>>    #",
              "#               ---  #",
              "#          ---       #",
              "#     ---           g#",
              "# 1                ###",
              "######################",
              "######################"]);
    } });

  level({ id: "2-3", world: 2, name: "Glacier Shafts", theme: "ice", H: 40, time: 450, song: { seed: 2303, style: "dub", bpm: 96 },
    hint: "Springs store energy ½kx² and give it back as ½mv². Steer while you rise.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "s"); }, "I");
      b.s(4, null, "pit");
      b.s(12, function (b) { b.e(3, "w").e(6, "w").put(5, 4, "ooo"); }, "I");
      // first shaft: springs and ice ledges up the glacier
      b.s(16, function (b) {
        b.col(0, 6, 30, "X").col(15, 1, 2, "X");
        b.e(4, "S").put(8, 7, "IIIII").put(2, 10, "XXXX").put(8, 13, "IIIII").put(2, 16, "XXXX").put(9, 19, "IIIII").put(3, 22, "XXXX").put(3, 23, "S");
        b.put(9, 8, "ooo").put(3, 11, "oo").put(9, 14, "*").put(6, 12, "b").put(6, 18, "b").put(10, 20, "s");
      });
      b.up(24);
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "w"); }, "I");
      b.s(5, null, "pit");
      b.s(10, function (b) { b.e(5, "s").put(2, 4, "ooo"); }, "I");
      b.s(14, function (b) { b.obj(5, 3, "p", { len: 4, amp: 0.85 }); b.put(1, 0, "--").put(12, 0, "--"); b.put(5, -2, "ooo"); }, "pit");
      b.s(12, function (b) { b.e(3, "w").put(5, 4, "=?=").put(3, 5, "*"); }, "I");
      b.s(4, null, "pit").s(8, function (b) { b.e(4, "j"); }, "I");
      // second shaft down: ledges back to the valley floor
      b.s(16, function (b) {
        b.put(3, -3, "XXXX").put(9, -6, "IIIIII").put(2, -9, "XXXX").put(9, -12, "IIIIII").put(2, -15, "XXXXX").put(10, -18, "XXXXXX").put(4, -14, "ooo").put(10, -11, "oo").put(6, -7, "b");
      }, "pit");
      b.dn(20).s(14, function (b) { b.e(2, "C").put(5, 4, "=F=").e(10, "s"); }, "I");
      b.s(18, function (b) { b.e(3, "S").put(6, 8, "IIIIIII").put(7, 9, "ooooo").e(10, "w").e(13, "k").put(14, 4, "?U?"); }, "I");
      b.s(4, null, "spk");
      b.s(16, function (b) { b.put(2, 3, "XX").put(6, 5, "XX").put(10, 7, "XX").put(10, 8, "*").e(13, "s"); }, "I");
      b.s(6, function (b) { b.obj(1, 2, "v", { range: 2 }); }, "pit");
      b.s(16, function (b) { b.e(3, "w w").put(7, 4, "?=?").e(12, "j"); }, "I");
      // EXT-2-3
      // frozen waterfall: springs between ice shelves
      b.s(16, function (b) { b.e(3, "S").put(6, 7, "IIIII").put(7, 8, "ooo").e(12, "s").put(13, 4, "=?="); }, "I");
      b.s(5, null, "pit");
      b.s(14, function (b) { b.put(2, 3, "XXX").put(7, 5, "XXX").put(8, 6, "oo").e(11, "w").e(5, "w"); }, "I");
      b.s(6, function (b) { b.obj(1, 1, "m", { range: 1 }); b.put(2, 4, "b"); }, "pit");
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G"); }, "I");
      b.end();
    } });

  level({ id: "2-4", world: 2, name: "Cryo Golem's Rink", theme: "ice", H: 17, time: 300, song: { seed: 2404, style: "boss", bpm: 156 }, boss: "golem",
    hint: "The Cryo Golem slides on frictionless ice and bounces off the walls. Stomp it when it stops, dizzy.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "s"); }, "I");
      b.s(3, null, "pit").s(12, function (b) { b.e(3, "w").e(7, "k").put(5, 4, "=?=").put(3, 5, "*"); }, "I");
      b.s(5, null, "spk").s(12, function (b) { b.e(6, "s").put(4, 4, "o*o"); }, "I");
      b.s(8, function (b) { b.put(1, 2, "XXX").put(5, 3, "XX").put(5, 4, "o").put(6, 6, "*"); }, "pit");
      b.s(16, function (b) { b.e(3, "C").put(7, 4, "?Y?").e(12, "w"); }, "I");
      b.s(5);
      b.arena();
      b.s(26, function (b) { b.put(3, 4, "----").put(19, 4, "----").put(11, 7, "----").e(16, "@").e(23, "G"); }, "I");
      b.up(15).s(3);
      b.end();
    } });

  /* ===== World 3: Volcanic Power Station ===== */
  level({ id: "3-1", world: 3, name: "Turbine Hall", theme: "volcano", H: 17, time: 420, song: { seed: 3101, style: "afro", bpm: 118 },
    hint: "Spark arms turn at a steady ω; the outer spark moves fastest, v = ωr. Plasma is instant trouble.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(4, null, "lava").s(12, function (b) { b.e(4, "j").put(6, 4, "=?=").put(7, 8, "o"); });
      b.s(16, function (b) { b.obj(7, 3, "a", { len: 3 }); b.e(2, "w").e(13, "w").put(6, 6, "o o o"); });
      b.s(6, function (b) { b.obj(1, 1, "m", { range: 1 }); }, "lava");
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "k"); });
      b.s(4, null, "lava").s(4, function (b) { b.put(1, 3, "ooo"); }).s(4, null, "lava").s(4).s(4, null, "lava");
      b.s(18, function (b) { b.art(3, ["XX", "XX"]).e(1, "c").e(8, "w").e(10, "w").put(12, 4, "=F=").put(13, 8, "*"); });
      // turbine floor: spark arms between pillars
      b.s(20, function (b) { b.art(2, ["X", "X"]).obj(6, 4, "A", { len: 3 }).art(10, ["X", "X", "X"]).obj(14, 4, "a", { len: 3 }).art(18, ["X", "X"]).put(5, 1, "o").put(14, 1, "o"); });
      b.s(7, function (b) { b.put(1, 1, "--").put(4, 2, "---").put(5, 5, "b"); }, "lava");
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "=?==?=").put(6, 8, "H").e(11, "s"); });
      b.s(18, function (b) { b.obj(3, 2, "m", { range: 2 }).obj(11, 3, "m", { range: 2 }); b.put(9, 7, "*").put(4, 5, "ooo"); }, "lava");
      b.s(14, function (b) { b.e(3, "w w").e(9, "c").put(11, 1, "1"); });
      b.s(5, null, "lava");
      b.s(16, function (b) { b.obj(8, 6, "a", { len: 4 }); b.e(3, "k").e(13, "j").put(6, 2, "oooo"); });
      b.s(10, function (b) { b.put(1, 2, "XX").put(5, 3, "XX").put(8, 2, "X").put(5, 4, "o"); }, "lava");
      b.s(16, function (b) { b.e(3, "w").e(6, "w").put(5, 4, "?U?").e(12, "c"); });
      // EXT-3-1
      // generator floor: twin spark arms and a moving bridge over plasma
      b.s(18, function (b) { b.obj(5, 4, "a", { len: 3 }).obj(13, 4, "A", { len: 3 }); b.put(8, 1, "ooo").e(2, "w").e(16, "w"); });
      b.s(10, function (b) { b.obj(2, 2, "m", { range: 2 }); b.put(4, 5, "ooo"); }, "lava");
      b.s(14, function (b) { b.e(3, "c").e(8, "k").put(5, 4, "=?=").put(11, 1, "XX").put(11, 2, "XX"); });
      b.s(6, function (b) { b.put(1, 1, "--").put(4, 2, "--").put(3, 5, "b"); }, "lava");
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G").put(2, 1, "2"); });
      b.end();
      b.room(["######################",
              "#                    #",
              "#   oo*o    oooo     #",
              "#   XXXX    XXXX     #",
              "#                    #",
              "#     ooo  ooo       #",
              "#     ---  ---       #",
              "# 1                 2#",
              "####~~~~####~~~~######",
              "######################"]);
    } });

  level({ id: "3-2", world: 3, name: "Boiler Tunnels", theme: "volcano", H: 17, time: 420, song: { seed: 3202, style: "funk", bpm: 122 }, secret: true,
    hint: "A press dropped from height h hits at v = √(2gh). Wait for it to rise, then dash under.",
    build: function (b) {
      b.s(12, function (b) { b.e(2, "P").put(5, 4, "?E?").e(10, "w"); });
      b.s(16, function (b) { b.roof(0, 16, 2).put(5, 7, "u").put(10, 7, "u").e(13, "w"); });
      b.s(4, function (b) { b.roof(0, 4, 2); }, "lava");
      b.s(14, function (b) { b.roof(0, 14, 2).put(3, 4, "=?=").e(8, "s").put(9, 4, "?F?"); });
      b.s(10, function (b) { b.roof(0, 10, 2).obj(1, 2, "f", {}).obj(6, 2, "f", {}); b.put(2, 5, "o").put(7, 5, "o"); }, "lava");
      b.s(14, function (b) { b.roof(0, 14, 2).e(2, "C").put(6, 7, "u").e(11, "k"); });
      b.s(18, function (b) { b.roof(0, 18, 5).put(2, 1, "oooooooooooo").e(6, "w").e(9, "w").e(12, "w").e(15, "c"); });
      b.s(6, function (b) { b.roof(0, 6, 2).put(1, 1, "--").put(4, 2, "--"); }, "lava");
      b.s(16, function (b) { b.roof(0, 16, 2).obj(8, 3, "A", { len: 3 }); b.e(2, "j").e(13, "w").put(7, 7, "*"); });
      b.s(12, function (b) { b.roof(0, 12, 2).obj(1, 2, "f", {}).obj(5, 3, "f", {}).obj(9, 2, "f", {}); }, "lava");
      b.s(14, function (b) { b.roof(0, 14, 2).e(2, "C").put(5, 4, "?Y?").e(10, "s"); });
      b.s(20, function (b) { b.roof(0, 20, 2).put(3, 7, "u").put(7, 7, "u").put(11, 7, "u").put(15, 7, "u").put(9, 1, "o").put(13, 1, "o").put(5, 1, "o"); });
      // the secret: a door hidden on a high ledge above the pressure vessels
      b.s(16, function (b) { b.roof(0, 16, 2).art(3, ["XX", "XX", "XX"]).put(7, 6, "---").put(11, 9, "--").put(12, 10, "3").e(14, "w").put(8, 7, "oo"); });
      b.s(5, function (b) { b.roof(0, 5, 2); }, "lava");
      b.s(18, function (b) { b.roof(0, 18, 2).e(3, "k").e(10, "w").e(12, "w").put(6, 4, "=?=$=").put(7, 8, "*").e(16, "c"); });
      b.s(10, function (b) { b.roof(0, 10, 2).obj(2, 2, "m", { range: 2 }); }, "lava");
      b.s(14, function (b) { b.roof(0, 14, 2).put(4, 4, "=U=").e(9, "j"); });
      // EXT-3-2
      // the valve gallery: falling grates and presses in a row
      b.s(14, function (b) { b.roof(0, 14, 2).put(3, 7, "u").put(8, 7, "u").e(11, "s"); });
      b.s(12, function (b) { b.roof(0, 12, 2).obj(1, 2, "f", {}).obj(5, 3, "f", {}).obj(9, 2, "f", {}); b.put(6, 6, "ooo"); }, "lava");
      b.s(14, function (b) { b.roof(0, 14, 2).e(3, "j").e(7, "w w").put(5, 4, "?=?").e(12, "c"); });
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G"); });
      b.end();
      b.room(["######################",
              "#   =?====?====?==   #",
              "#                    #",
              "#   o o o * o o o    #",
              "#                    #",
              "#                    #",
              "#      ooo   ooo     #",
              "#     ---    ---     #",
              "# 3               g  #",
              "####~~~~~##~~~~~######",
              "######################"]);
    } });

  level({ id: "3-3", world: 3, name: "Magma Lift", theme: "volcano", H: 40, time: 450, song: { seed: 3303, style: "amapiano", bpm: 112 },
    hint: "Ride the lifts up out of the magma. Spring pads store ½kx² and give it back.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(4, null, "lava").s(10, function (b) { b.e(4, "s").put(3, 4, "ooo"); });
      // the lift shaft: vertical platforms climb out of the plasma
      b.s(18, function (b) {
        b.col(17, 1, 1, "X");
        b.obj(1, 2, "v", { range: 2 }).obj(6, 6, "v", { range: 2 }).put(11, 9, "XXXX").obj(5, 12, "v", { range: 2 }).put(11, 15, "XXXX").obj(5, 18, "v", { range: 2 }).put(11, 21, "XXXXXX");
        b.put(12, 10, "oo").put(12, 16, "*").put(8, 13, "b").put(12, 22, "j");
      }, "lava");
      b.up(20);
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "w"); });
      b.s(5, null, "pit");
      b.s(14, function (b) { b.obj(7, 3, "a", { len: 3 }); b.e(2, "k").e(12, "w"); });
      b.s(6, function (b) { b.obj(1, 1, "m", { range: 1 }); b.put(2, 4, "b"); }, "pit");
      b.s(12, function (b) { b.e(3, "S").put(6, 8, "-----").put(7, 9, "*").e(9, "c"); });
      b.s(5, null, "pit");
      b.s(14, function (b) { b.e(3, "w w").put(6, 4, "=?=$=").put(7, 8, "H"); });
      // down the cooling tower
      b.s(14, function (b) { b.put(2, -3, "XXXX").put(8, -7, "XXXX").put(2, -11, "XXXX").put(8, -15, "XXXXX").put(3, -10, "oo").put(9, -6, "oo").put(6, -9, "b"); }, "pit");
      b.dn(18).s(14, function (b) { b.e(2, "C").put(5, 4, "=F=").e(10, "s"); });
      b.s(4, null, "lava");
      b.s(16, function (b) { b.obj(4, 4, "A", { len: 3 }).obj(11, 4, "a", { len: 3 }); b.put(7, 1, "ooo"); });
      b.s(12, function (b) { b.obj(1, 2, "f", {}).obj(5, 3, "f", {}).obj(9, 2, "f", {}); b.put(6, 6, "*"); }, "lava");
      b.s(14, function (b) { b.e(3, "j").e(8, "k").put(6, 4, "?U?"); });
      // EXT-3-3
      // slag heaps: hoppers and spark arms on uneven ground
      b.s(12, function (b) { b.art(3, ["XX", "XX"]).obj(8, 3, "A", { len: 2 }); b.e(1, "j").put(3, 3, "oo"); });
      b.s(4, null, "lava").up(2).s(12, function (b) { b.e(3, "w").e(6, "w").put(4, 4, "=?=").e(10, "s"); }).dn(2);
      b.s(6, function (b) { b.obj(1, 1, "m", { range: 1 }); }, "lava");
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G"); });
      b.end();
    } });

  level({ id: "3-4", world: 3, name: "Boiler Brute's Furnace", theme: "volcano", H: 17, time: 300, song: { seed: 3404, style: "boss", bpm: 160 }, boss: "boiler",
    hint: "The Boiler Brute lobs magma in parabolas: R = v² sin 2θ / g. When it vents steam, its valve is open: stomp it!",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(4, null, "lava").s(12, function (b) { b.obj(6, 3, "a", { len: 3 }); b.put(6, 7, "*"); });
      b.s(5, function (b) { b.put(1, 2, "XXX").put(2, 4, "*"); }, "lava");
      b.s(14, function (b) { b.e(3, "k").e(9, "c").put(5, 4, "=?="); });
      b.s(6, function (b) { b.obj(1, 1, "m", { range: 1 }); }, "lava");
      b.s(16, function (b) { b.e(3, "C").put(7, 4, "?Y?").e(12, "w"); });
      b.s(5);
      b.arena();
      b.s(9, function (b) { b.put(3, 4, "---").put(4, 5, "*").put(1, 1, "ooo"); });
      b.s(6, function (b) { b.put(1, 3, "----"); }, "lava");
      b.s(11, function (b) { b.e(5, "@").e(9, "G").put(2, 5, "---"); });
      b.up(15).s(3);
      b.end();
    } });

  /* ===== World 4: Storm Grid ===== */
  level({ id: "4-1", world: 4, name: "Pylon Bridges", theme: "storm", H: 17, time: 420, song: { seed: 4101, style: "synthwave", bpm: 120 },
    hint: "Riding a swinging platform, you need a centripetal force mv²/r: the rod pulls you toward the pivot.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(10, null, "bridge").s(3, null, "pit");
      b.s(12, function (b) { b.e(3, "w").e(8, "b").put(5, 4, "=?="); });
      b.s(14, function (b) { b.obj(7, 7, "p", { len: 4, amp: 0.9 }); b.put(1, 0, "--").put(12, 0, "--").put(6, 2, "ooo"); }, "pit");
      b.s(12, function (b) { b.e(2, "C").put(5, 4, "?Y?").put(4, 6, "b"); });
      b.s(12, function (b) { b.e(4, "j"); b.put(2, 3, "ooo"); }, "bridge");
      b.s(4, null, "pit");
      b.s(16, function (b) { b.e(2, "k").e(7, "w").e(9, "w").put(10, 4, "=F=").put(11, 8, "*"); });
      b.s(18, function (b) { b.obj(4, 7, "p", { len: 4, amp: 0.8 }).obj(12, 7, "p", { len: 4, amp: 0.8 }); b.put(0, 0, "-").put(17, 0, "-").put(8, 5, "*"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(6, "c").put(8, 4, "=?==?=").put(9, 8, "H").e(12, "s"); });
      b.s(16, function (b) { b.put(2, 5, "b").put(9, 4, "b"); b.put(4, 3, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(3, "w w").put(6, 4, "?K?").put(11, 1, "1"); });
      b.s(10, function (b) { b.obj(2, 1, "m", { range: 2 }); b.put(3, 5, "b"); }, "pit");
      b.s(16, function (b) { b.art(3, ["X", "X", "X"]).e(4, "c").e(8, "w").put(9, 4, "?U?").e(13, "j"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 5, amp: 0.9 }); b.put(0, 0, "--").put(14, 0, "--").put(7, 1, "*"); }, "pit");
      b.s(12, function (b) { b.e(4, "s").e(8, "w").put(1, 1, "2"); });
      // EXT-4-1
      // the switchyard: bridges, fliers and a long pendulum
      b.s(12, function (b) { b.put(3, 4, "b").put(8, 5, "b").put(4, 2, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(3, "w").e(6, "c").put(8, 4, "=?=").e(12, "j"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 5, amp: 0.85 }); b.put(0, 0, "--").put(14, 0, "--").put(6, 3, "oooo"); }, "pit");
      b.s(12, function (b) { b.e(4, "k").e(8, "w").put(5, 4, "?$?"); });
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G"); });
      b.end();
      b.room(["                        ",
              "  o o o o o o o o o o   ",
              "                        ",
              "   --- --- --- ---      ",
              "                        ",
              "   ?=$=?    ooooo       ",
              "                        ",
              " 1                    2 ",
              "########################",
              "########################"]);
    } });

  level({ id: "4-2", world: 4, name: "Thunderhead", theme: "storm", H: 22, time: 450, song: { seed: 4202, style: "breaks", bpm: 128 }, secret: true,
    hint: "Cloud ledges let you jump up through them. Chaos mortars fire projectiles: watch the arc.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(20, function (b) { b.put(1, 1, "----").put(6, 3, "----").put(11, 5, "----").put(16, 3, "----").put(12, 6, "ooo").put(9, 7, "b"); }, "pit");
      b.s(12, function (b) { b.e(3, "c").e(8, "w").put(5, 4, "=?="); });
      b.s(6, function (b) { b.put(1, 0, "S"); b.put(2, 8, "o"); }, "pit");
      b.up(4).s(12, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "j"); });
      b.s(22, function (b) { b.put(1, 0, "---").put(6, 2, "---").put(11, 4, "---").put(16, 2, "---").put(20, 0, "--").put(11, 7, "*").put(4, 5, "b").put(15, 6, "b"); }, "pit");
      b.s(14, function (b) { b.e(3, "w").e(5, "w").e(10, "c").put(4, 4, "=?=$="); });
      b.s(10, function (b) { b.obj(2, 1, "m", { range: 2 }).put(3, 6, "oooo"); }, "pit");
      b.dn(4).s(14, function (b) { b.e(2, "C").e(6, "k").put(8, 4, "?F?"); });
      // storm column: springs up into the clouds, the secret gate sits on the highest cloud
      b.s(20, function (b) { b.e(3, "S").put(6, 8, "-----").put(12, 11, "-----").put(14, 14, "---").put(15, 15, "g").put(7, 9, "ooo").put(13, 12, "ooo").put(10, 13, "b").e(16, "c"); });
      b.s(5, null, "pit");
      b.s(16, function (b) { b.e(3, "w").e(8, "s").put(5, 4, "?=?").put(6, 8, "*"); });
      b.s(16, function (b) { b.obj(7, 6, "p", { len: 4, amp: 0.85 }); b.put(0, 0, "--").put(14, 0, "--"); }, "pit");
      b.s(14, function (b) { b.e(3, "j").e(9, "c").put(5, 4, "=U="); });
      b.s(20, function (b) { b.put(1, 1, "---").put(5, 3, "---").put(9, 5, "---").put(13, 3, "---").put(17, 1, "--").put(10, 8, "*").put(7, 6, "b"); }, "pit");
      b.s(12, function (b) { b.e(4, "w w"); });
      // EXT-4-2
      // anvil clouds: one-way ledges over the void, mortars on the far side
      b.s(18, function (b) { b.put(1, 1, "---").put(5, 3, "---").put(9, 5, "---").put(13, 3, "---").put(9, 6, "ooo").put(6, 7, "b"); }, "pit");
      b.s(12, function (b) { b.e(3, "c").e(7, "w").put(5, 4, "=?="); });
      b.s(8, function (b) { b.obj(2, 1, "m", { range: 2 }); }, "pit");
      b.s(12, function (b) { b.e(3, "s").e(8, "j").put(4, 4, "ooo"); });
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G"); });
      b.end();
    } });

  level({ id: "4-3", world: 4, name: "Capacitor Spire", theme: "storm", H: 46, time: 480, song: { seed: 4303, style: "anthem", bpm: 136 },
    hint: "Everything you have learned, all the way up. The arms spin at ω; time your jump through the gap.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "w"); });
      b.s(4, null, "pit").s(12, function (b) { b.e(3, "s").e(8, "c").put(5, 4, "=?="); });
      // spire, stage one
      b.s(18, function (b) {
        b.col(0, 6, 40, "X").col(17, 1, 2, "X");
        b.put(9, 3, "------").put(2, 6, "-----").put(9, 9, "------").put(2, 12, "-----").put(10, 15, "------");
        b.obj(8, 18, "a", { len: 3 });
        b.put(2, 18, "----").put(12, 21, "-----").put(3, 24, "-----").put(11, 27, "------");
        b.put(10, 4, "ooo").put(3, 7, "ooo").put(10, 10, "oo").put(4, 13, "*").put(6, 16, "b").put(12, 22, "j").put(6, 25, "b");
      });
      b.up(30);
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "w"); });
      b.s(16, function (b) { b.obj(7, 6, "p", { len: 4, amp: 0.9 }); b.put(0, 0, "--").put(14, 0, "--").put(7, 2, "*"); }, "pit");
      b.s(12, function (b) { b.obj(6, 3, "A", { len: 3 }); b.e(2, "k").e(10, "w"); });
      b.s(10, function (b) { b.obj(2, 1, "m", { range: 2 }); b.put(4, 5, "b"); }, "pit");
      b.s(14, function (b) { b.e(3, "c").e(9, "s").put(5, 4, "=F=").put(10, 4, "?K?"); });
      b.s(5, null, "pit");
      b.s(12, function (b) { b.e(3, "S").put(6, 8, "------").put(8, 9, "*").e(10, "w"); });
      // the spire's lightning rods: down the far side
      b.s(14, function (b) { b.put(2, -3, "XXXX").put(8, -7, "XXXX").put(2, -11, "XXXX").put(8, -15, "XXXX").put(2, -19, "XXXX").put(8, -23, "XXXXX").put(4, -10, "ooo").put(9, -14, "oo").put(5, -17, "b"); }, "pit");
      b.dn(26).s(14, function (b) { b.e(2, "C").put(5, 4, "=?=?=").put(6, 8, "H").e(10, "j"); });
      b.s(14, function (b) { b.obj(7, 3, "a", { len: 4 }); b.e(2, "w").e(12, "w"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 4, amp: 0.85 }); b.put(0, 0, "--").put(14, 0, "--"); }, "pit");
      b.s(14, function (b) { b.e(3, "c").e(7, "k").put(9, 4, "?U?"); });
      // EXT-4-3
      // grounding field: arms, a lift and mortars before the last climb
      b.s(14, function (b) { b.obj(5, 4, "a", { len: 3 }); b.e(10, "c").e(2, "w").put(5, 1, "oo"); });
      b.s(6, function (b) { b.obj(1, 2, "v", { range: 2 }); }, "pit");
      b.up(3).s(14, function (b) { b.e(3, "s").e(9, "w").put(5, 4, "=?=").put(10, 3, "ooo"); }).dn(3);
      b.s(5, null, "pit");
      // speed run-up: the gate pays out ½mv², so arrive fast
      b.s(12, function (b) { b.put(2, 1, "o o o o o"); });
      b.s(14, function (b) { b.e(6, "G"); });
      b.end();
    } });

  level({ id: "4-4", world: 4, name: "Entropy's Engine", theme: "storm", H: 17, time: 360, song: { seed: 4404, style: "boss", bpm: 168, scale: "phrygian" }, boss: "entropy",
    hint: "Count Entropy himself. Stomp him when he swoops low; kicked pucks and EMP charges help too.",
    build: function (b) {
      b.s(14, function (b) { b.e(2, "P").put(6, 4, "?E?").e(11, "s"); });
      b.s(4, null, "pit").s(14, function (b) { b.obj(7, 3, "a", { len: 3 }); b.e(2, "w").put(7, 7, "*"); });
      b.s(10, function (b) { b.obj(2, 1, "m", { range: 2 }); }, "pit");
      b.s(14, function (b) { b.e(3, "k").e(9, "c").put(5, 4, "=?F?=").put(7, 8, "*").put(5, 5, "o o"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 4, amp: 0.85 }); b.put(0, 0, "--").put(14, 0, "--"); }, "pit");
      b.s(16, function (b) { b.e(3, "C").put(7, 4, "?Y?").e(12, "j").put(10, 1, "Z"); });
      b.s(5);
      b.arena();
      b.s(28, function (b) { b.put(3, 4, "----").put(21, 4, "----").put(11, 6, "------").put(13, 7, "*").put(3, 5, "oooo").put(21, 5, "oooo").e(18, "@").e(25, "G"); });
      b.up(15).s(3);
      b.end();
    } });

  /* ===== World 5: Windward Cliffs (updrafts and gusts: ΣF = ma) ===== */
  // shared openers and finishers keep the new levels consistent; everything between is hand-placed
  function opener(b, crate) { b.s(14, function (b) { b.e(2, "P").put(6, 4, crate || "?E?").e(11, "w"); }); }
  function finisher(b) { b.s(12, function (b) { b.put(2, 1, "o o o o o"); }); b.s(14, function (b) { b.e(6, "G"); }); b.end(); }

  level({ id: "5-1", world: 5, name: "Fan Farm", theme: "cliffs", H: 20, time: 420, song: { seed: 5101, style: "afro", bpm: 116 },
    hint: "Fans blow air upward. Step into the stream and the updraft lifts you; drift sideways at the top to land.",
    build: function (b) {
      opener(b);
      // the first fan sits on solid ground: a lift to a coin ledge
      b.s(12, function (b) { b.put(1, 7, "---").put(7, 7, "-----").put(8, 8, "oooo").e(10, "w").updraft(4, 3, 7); });
      b.s(10, function (b) { b.e(3, "w").e(7, "w").put(4, 4, "=?="); });
      // a fan rising out of a pit: fall in on purpose
      b.s(12, function (b) { b.put(5, 7, "*").updraft(3, 6, 6); }, "pit");
      b.s(14, function (b) { b.e(2, "C").put(6, 4, "?Y?").e(11, "j").put(13, 1, "1"); });
      // two fans as a staircase
      b.s(16, function (b) { b.put(4, 5, "---").put(9, 9, "----").put(10, 10, "ooo").e(14, "w").updraft(2, 2, 5).updraft(7, 2, 9); });
      b.s(4, null, "pit");
      b.s(12, function (b) { b.e(3, "k").put(6, 4, "=$=").e(9, "w"); });
      b.s(14, function (b) { b.e(3, "w").e(6, "w").put(2, 4, "?=?=?").put(9, 3, "--").put(10, 4, "ooo"); });
      b.s(12, function (b) { b.put(3, 4, "b").put(8, 5, "b").put(4, 2, "oooo"); }, "bridge");
      // a long updraft corridor over a pit
      b.s(14, function (b) { b.put(5, 8, "o o o").updraft(2, 10, 5); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(7, "w w").put(4, 4, "?K?").put(11, 8, "*").updraft(11, 2, 8); });
      b.s(12, function (b) { b.e(4, "j").put(6, 3, "---").e(9, "w"); });
      b.s(16, function (b) { b.put(6, 6, "--").updraft(2, 3, 6).updraft(10, 3, 6); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(6, "w").e(9, "s").put(5, 4, "=?="); });
      b.s(12, function (b) { b.put(5, 9, "---").put(6, 10, "*").updraft(3, 2, 9); });
      b.s(14, function (b) { b.put(1, 1, "2").e(5, "w").e(9, "k").put(6, 4, "?=?"); });
      finisher(b);
      b.room(["                     ",
              "  o o o o o o o o o  ",
              "                     ",
              "   ?=$=?   ooooo     ",
              "                     ",
              " 1                 2 ",
              "#####################",
              "#####################"]);
    } });

  level({ id: "5-2", world: 5, name: "Gusty Bridges", theme: "cliffs", H: 18, time: 420, song: { seed: 5202, style: "breaks", bpm: 124 },
    hint: "A gust blowing your way adds a sideways force: ΣF = ma, so your jump goes further. Wide gaps need a tailwind.",
    build: function (b) {
      opener(b);
      b.s(10, function (b) { b.e(4, "w").put(6, 4, "?$?").gust(5, 5, 1, 4, 1); });
      b.s(10, function (b) { b.gust(0, 10, 1, 6, 1); }, "pit");
      b.s(12, function (b) { b.e(3, "w").e(8, "k").put(5, 4, "=?=").gust(8, 4, 1, 4, 1); });
      b.s(12, function (b) { b.put(6, 5, "ooo").gust(0, 12, 1, 7, 1); }, "pit");
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "j"); });
      b.s(16, function (b) { b.put(4, 4, "b").put(10, 5, "b").put(5, 2, "ooooo"); }, "bridge");
      b.s(4, null, "pit");
      b.s(14, function (b) { b.e(3, "w w").put(6, 4, "=F=").put(11, 3, "--").put(12, 4, "*"); });
      b.s(14, function (b) { b.put(6, 3, "--").put(6, 5, "*").gust(0, 14, 1, 8, 1); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(7, "w").e(10, "s").put(4, 4, "?K?"); });
      // a headwind on flat ground: you push against it and slow down
      b.s(12, function (b) { b.e(4, "w").e(8, "w").put(5, 4, "ooo").gust(0, 12, 1, 5, -1); });
      b.s(3);
      b.s(10, function (b) { b.gust(0, 10, 1, 6, 1); }, "pit");
      b.s(12, function (b) { b.e(3, "j").put(6, 3, "---").e(9, "w"); });
      b.s(14, function (b) { b.e(3, "w").e(6, "c").put(8, 4, "=?=").put(12, 5, "*"); });
      b.s(14, function (b) { b.put(3, 4, "b").put(9, 4, "b").put(4, 3, "oooo"); }, "bridge");
      b.s(12, function (b) { b.e(3, "w").e(8, "k").put(5, 4, "?=?"); });
      b.s(6, null, "pit");
      b.s(6);
      finisher(b);
    } });

  level({ id: "5-3", world: 5, name: "Kite Ridge", theme: "cliffs", H: 30, time: 450, song: { seed: 5303, style: "synthwave", bpm: 128 }, secret: true,
    hint: "Gust kites ride the wind and dive at you: stomp them on the way down. A fan column climbs to a secret.",
    build: function (b) {
      opener(b);
      b.s(12, function (b) { b.e(3, "w").put(6, 5, "r").put(5, 4, "=?="); });
      b.s(12, function (b) { b.put(4, 6, "---").put(5, 7, "ooo").updraft(2, 2, 6); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(7, "w").put(9, 6, "r").put(4, 4, "?$?"); });
      b.s(10, function (b) { b.gust(0, 10, 1, 6, 1).put(4, 5, "ooo"); }, "pit");
      b.s(14, function (b) { b.e(3, "k").e(9, "w").put(6, 4, "?F?").put(11, 3, "--").put(11, 5, "*"); });
      // the ridge: fan, ledge, fan up to the high path
      b.s(20, function (b) { b.put(4, 6, "----").put(11, 12, "-----").put(12, 13, "ooo").put(16, 9, "r").updraft(2, 2, 6).updraft(9, 2, 12); });
      b.up(8);
      b.s(14, function (b) { b.e(2, "C").e(6, "w").e(9, "s").put(4, 4, "=?=").put(10, 5, "*"); });
      b.s(12, function (b) { b.put(3, 5, "r").put(8, 4, "r").put(4, 2, "oooo"); }, "bridge");
      // secret column: two fans stacked over the void, the gate on the highest ledge
      b.s(20, function (b) { b.put(5, 7, "-----").put(12, 13, "-----").put(14, 14, "g").put(6, 8, "ooo").put(13, 14, "o").updraft(2, 3, 7).updraft(9, 3, 13); });
      b.s(4, null, "pit");
      b.s(14, function (b) { b.e(3, "w").e(8, "j").put(5, 4, "?U?"); });
      b.dn(8);
      b.s(12, function (b) { b.e(2, "w").e(6, "w").e(9, "w").put(4, 3, "ooo"); });
      b.s(14, function (b) { b.put(6, 3, "--").put(6, 5, "*").gust(0, 14, 1, 8, 1); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(6, "k").put(8, 4, "=?=").put(4, 6, "r"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 4, amp: 0.8 }); b.put(0, 0, "--").put(14, 0, "--").put(6, 2, "ooo"); }, "pit");
      b.s(12, function (b) { b.e(4, "s").e(8, "w").put(6, 4, "?$?"); });
      b.s(4);
      finisher(b);
    } });

  level({ id: "5-4", world: 5, name: "Turbine Run", theme: "cliffs", H: 20, time: 420, song: { seed: 5404, style: "funk", bpm: 120 },
    hint: "Belts, fans and gusts at once. Add the velocities and the forces: where the belt carries you, the wind adds more.",
    build: function (b) {
      opener(b, "?Y?");
      b.s(14, function (b) { b.e(5, "w").put(7, 4, "=?=").gust(0, 14, 1, 4, 1); }, ">");
      b.s(10, function (b) { b.gust(0, 10, 1, 6, 1); }, "pit");
      b.s(14, function (b) { b.e(3, "k").e(10, "w").put(5, 4, "?E?"); }, ">");
      b.s(12, function (b) { b.put(4, 6, "----").put(5, 7, "*").updraft(2, 2, 6).updraft(9, 2, 5); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(9, "s").put(5, 4, "=$=").obj(10, 4, "a", { len: 2 }); });
      b.s(14, function (b) { b.e(4, "w").e(9, "w").put(6, 4, "ooo"); }, "<");
      b.s(4, null, "pit");
      b.s(16, function (b) { b.put(4, 5, "---").put(10, 8, "----").put(11, 9, "ooo").e(14, "j").updraft(2, 2, 5).updraft(7, 3, 8); });
      b.s(12, function (b) { b.put(3, 4, "r").put(8, 5, "b").put(4, 2, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(2, "C").e(6, "c").put(8, 4, "?K?").put(12, 5, "*"); });
      b.s(14, function (b) { b.put(6, 3, "--").gust(0, 14, 1, 8, 1); }, "pit");
      b.s(14, function (b) { b.e(3, "w").e(7, "k").put(9, 4, "=?="); }, ">");
      b.s(12, function (b) { b.obj(5, 3, "A", { len: 3 }); b.e(2, "w").e(10, "w"); });
      b.s(14, function (b) { b.e(2, "C").put(5, 9, "---").put(6, 10, "*").updraft(3, 2, 9).e(10, "j"); });
      b.s(10, function (b) { b.obj(2, 1, "m", { range: 2 }); b.put(3, 5, "r"); }, "pit");
      b.s(12, function (b) { b.e(4, "s").e(8, "w").put(5, 4, "?$?"); });
      b.s(6);
      finisher(b);
    } });

  level({ id: "5-5", world: 5, name: "Stormfront Summit", theme: "cliffs", H: 34, time: 480, song: { seed: 5505, style: "anthem", bpm: 136 },
    hint: "Up the cliff on fan after fan. At the top of each stream the forces balance: that is where you float.",
    build: function (b) {
      opener(b);
      b.s(4, null, "pit").s(12, function (b) { b.e(3, "s").put(6, 6, "r").put(5, 4, "=?="); });
      // the cliff: fans stacked up a shaft
      b.s(18, function (b) {
        b.col(0, 6, 28, "X").col(17, 1, 2, "X");
        b.put(9, 5, "------").put(2, 10, "-----").put(10, 15, "------").put(2, 20, "-----").put(9, 24, "------");
        b.put(10, 6, "ooo").put(3, 11, "ooo").put(4, 21, "*").put(11, 16, "r").put(5, 17, "b");
        b.updraft(10, 2, 10).updraft(4, 2, 15).updraft(12, 2, 20).updraft(5, 2, 24);
      });
      b.up(22);
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "w"); });
      b.s(14, function (b) { b.put(6, 3, "--").put(7, 4, "*").gust(0, 14, 1, 8, 1); }, "pit");
      b.s(12, function (b) { b.obj(6, 3, "a", { len: 3 }); b.e(2, "k").e(10, "w"); });
      b.s(10, function (b) { b.put(4, 5, "r").put(3, 2, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(3, "c").e(9, "s").put(5, 4, "=F=").put(10, 4, "?K?"); });
      // down the far face on gust-blown ledges
      b.s(16, function (b) { b.put(2, -3, "XXXX").put(8, -7, "XXXX").put(2, -11, "XXXX").put(8, -15, "XXXX").put(2, -19, "XXXXX").put(4, -10, "ooo").put(9, -14, "oo").put(5, -17, "r"); }, "pit");
      b.dn(18).s(14, function (b) { b.e(2, "C").put(5, 4, "=?=?=").e(10, "j"); });
      b.s(12, function (b) { b.put(5, 9, "---").put(6, 10, "*").updraft(3, 2, 9); });
      b.s(14, function (b) { b.obj(7, 3, "A", { len: 3 }); b.e(2, "w").e(12, "w"); });
      b.s(12, function (b) { b.e(3, "w").e(7, "k").put(9, 4, "?U?"); });
      b.s(14, function (b) { b.e(3, "w").e(9, "s").put(6, 4, "=$="); });
      b.s(5, null, "pit");
      b.s(12, function (b) { b.put(4, 5, "---").put(5, 6, "ooo").updraft(2, 2, 5).e(10, "w"); });
      b.s(6);
      finisher(b);
    } });

  level({ id: "5-6", world: 5, name: "Gale Harpy's Nest", theme: "cliffs", H: 18, time: 330, song: { seed: 5606, style: "boss", bpm: 158 }, boss: "harpy",
    hint: "The Gale Harpy beats its wings to push you away. Lean into the wind, then stomp it when it dives low.",
    build: function (b) {
      opener(b);
      b.s(12, function (b) { b.put(5, 7, "*").updraft(3, 5, 6); }, "pit");
      b.s(14, function (b) { b.e(3, "w").e(9, "k").put(5, 4, "=?=").put(10, 6, "r"); });
      b.s(10, function (b) { b.gust(0, 10, 1, 6, 1).put(5, 6, "*"); }, "pit");
      b.s(16, function (b) { b.e(3, "C").put(7, 4, "?Y?").e(12, "w").put(10, 1, "Z"); });
      b.s(5);
      b.arena();
      b.s(28, function (b) { b.put(3, 4, "----").put(21, 4, "----").put(11, 6, "------").put(13, 7, "*").put(3, 5, "oooo").put(21, 5, "oooo").e(18, "@").e(25, "G"); });
      b.up(15).s(3);
      b.end();
    } });

  /* ===== World 6: Lunar Annex (g scaled by 0.55: weight w = mg) ===== */
  level({ id: "6-1", world: 6, name: "Low-G Landing", theme: "moon", H: 24, g: 0.55, time: 420, song: { seed: 6101, style: "calm", bpm: 96 },
    hint: "Weaker gravity: the same take-off speed carries you higher and further (h = v²/2g). Gaps here are wider.",
    build: function (b) {
      opener(b);
      b.s(12, function (b) { b.e(5, "w").put(4, 7, "---").put(5, 8, "ooo"); });
      b.s(12, null, "pit");
      b.s(14, function (b) { b.e(3, "w").e(9, "w").put(6, 6, "?=?").put(7, 10, "*"); });
      b.s(14, function (b) { b.put(5, 6, "oooo"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").put(6, 4, "?Y?").e(11, "j"); });
      b.up(5).s(12, function (b) { b.e(4, "w").put(3, 6, "o o o"); }).dn(5);
      b.s(16, function (b) { b.put(5, 8, "---").put(6, 9, "*").put(10, 3, "-----"); }, "pit");
      b.s(14, function (b) { b.e(3, "k").e(10, "w").put(6, 5, "=F="); });
      b.s(12, function (b) { b.put(4, 4, "b").put(9, 7, "b").put(3, 5, "ooooo"); }, "bridge");
      b.s(15, null, "pit");
      b.s(14, function (b) { b.e(2, "C").e(6, "w w").put(9, 6, "?K?"); });
      b.up(6).s(12, function (b) { b.e(5, "s").put(3, 4, "oooo"); }).dn(6);
      b.s(14, function (b) { b.put(5, 5, "---").put(6, 8, "*"); }, "pit");
      b.s(14, function (b) { b.e(3, "w").e(7, "c").put(9, 5, "=?="); });
      b.s(12, function (b) { b.e(4, "x").put(6, 6, "=?="); });
      b.s(6);
      finisher(b);
    } });

  level({ id: "6-2", world: 6, name: "Crater Hop", theme: "moon", H: 24, g: 0.55, time: 420, song: { seed: 6202, style: "dub", bpm: 92 },
    hint: "Moon hoppers bounce with the same push but weaker gravity, so they fly high. Time your stomp as they come down.",
    build: function (b) {
      opener(b);
      b.s(14, function (b) { b.e(5, "x").put(8, 5, "ooo"); });
      b.s(10, null, "spk");
      b.s(14, function (b) { b.e(3, "w").e(9, "x").put(5, 6, "=?=").put(6, 10, "*"); });
      b.s(13, function (b) { b.put(6, 7, "ooo"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").put(5, 5, "?Y?").e(10, "x"); });
      b.s(12, null, "spk");
      b.s(12, function (b) { b.e(4, "w").e(8, "k").put(5, 6, "?=?"); });
      b.up(4).s(14, function (b) { b.e(3, "x").e(10, "s").put(6, 5, "oooo"); }).dn(4);
      b.s(14, function (b) { b.put(6, 4, "---").put(7, 7, "*"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(7, "x").put(9, 6, "?K?"); });
      b.s(10, null, "spk");
      b.s(14, function (b) { b.e(3, "w w").e(10, "x").put(6, 5, "=$="); });
      b.s(14, function (b) { b.put(4, 6, "b").put(9, 8, "b").put(5, 4, "ooooo"); }, "bridge");
      b.s(12, function (b) { b.e(4, "x").put(7, 6, "*").put(6, 5, "--"); });
      b.s(14, function (b) { b.e(3, "w").e(9, "s").put(6, 6, "?$?"); });
      b.s(6);
      finisher(b);
    } });

  level({ id: "6-3", world: 6, name: "Regolith Mines", theme: "moon", H: 26, g: 0.55, time: 450, song: { seed: 6303, style: "breaks", bpm: 110 }, secret: true, dark: true,
    hint: "Low ceilings in the mines: in weak gravity a full jump will hit your head. Tap Jump for short hops.",
    build: function (b) {
      opener(b);
      b.s(16, function (b) { b.roof(0, 16, 15).e(4, "w").e(10, "w").put(6, 3, "?=?").put(7, 5, "ooo"); });
      b.s(10, function (b) { b.roof(0, 10, 15); }, "pit");
      b.s(14, function (b) { b.roof(0, 14, 15).e(3, "x").put(7, 4, "*").put(6, 3, "--"); });
      b.s(14, function (b) { b.e(2, "C").e(8, "k").put(5, 5, "?Y?"); });
      // mine shaft: up past the ore, the secret gate at the top
      b.s(20, function (b) { b.put(3, 5, "-----").put(10, 10, "-----").put(4, 15, "----").put(12, 18, "---").put(13, 19, "g").put(5, 6, "ooo").put(11, 11, "ooo").e(17, "w"); });
      b.s(12, function (b) { b.roof(0, 12, 15).e(4, "x").put(6, 3, "=$="); });
      b.s(13, function (b) { b.put(6, 6, "ooo"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(6, "w").e(10, "s").put(4, 5, "?K?").put(11, 1, "1"); });
      b.s(14, function (b) { b.roof(0, 14, 15).e(4, "x").e(9, "w").put(6, 3, "ooo"); });
      b.s(14, function (b) { b.put(6, 4, "--").put(7, 6, "*"); }, "pit");
      b.s(14, function (b) { b.e(3, "w").e(7, "c").put(9, 5, "=?=").put(12, 1, "2"); });
      b.s(14, function (b) { b.roof(0, 14, 15).e(3, "w").e(9, "x").put(6, 3, "?=?"); });
      b.s(12, null, "pit");
      b.s(14, function (b) { b.e(4, "k").e(10, "w").put(6, 5, "oooo"); });
      b.s(6);
      finisher(b);
      b.room(["                       ",
              "  o o o o o o o o o o  ",
              "                       ",
              "   --- --- --- ---     ",
              "                       ",
              "   ?=$=?   ooooo   *   ",
              "                       ",
              " 1                   2 ",
              "#######################",
              "#######################"]);
    } });

  level({ id: "6-4", world: 6, name: "Dome Gardens", theme: "moon", H: 24, g: 0.55, time: 420, song: { seed: 6404, style: "amapiano", bpm: 108 },
    hint: "Lunar ice: friction f = μmg shrinks with your weight, so you slide even further than in the Cryo Lab.",
    build: function (b) {
      opener(b);
      b.s(14, function (b) { b.e(5, "w").put(7, 5, "ooo"); }, "I");
      b.s(12, null, "pit");
      b.s(14, function (b) { b.e(3, "x").put(6, 6, "?=?").put(7, 10, "*"); }, "I");
      b.s(14, function (b) { b.obj(5, 3, "m", { range: 3 }); b.put(6, 6, "ooo"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").put(5, 5, "?Y?").e(10, "w"); });
      b.s(14, function (b) { b.e(4, "w").e(9, "k").put(6, 5, "oooo"); }, ">");
      b.s(14, function (b) { b.obj(6, 6, "p", { len: 4, amp: 0.8 }); b.put(0, 0, "--").put(12, 0, "--").put(6, 4, "*"); }, "pit");
      b.s(14, function (b) { b.e(3, "x").e(10, "s").put(6, 6, "=F="); }, "I");
      b.s(12, function (b) { b.obj(4, 2, "v", { range: 3 }); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(7, "w w").put(9, 6, "?K?"); });
      b.s(14, function (b) { b.e(4, "x").put(6, 5, "oooo"); }, "<");
      b.s(13, null, "pit");
      b.s(14, function (b) { b.e(3, "w").e(9, "x").put(6, 7, "*").put(5, 6, "---"); }, "I");
      b.s(14, function (b) { b.e(3, "w").e(9, "x").put(6, 6, "=?="); }, "I");
      b.s(6, null, "pit");
      b.s(6);
      finisher(b);
    } });

  level({ id: "6-5", world: 6, name: "Antenna Array", theme: "moon", H: 44, g: 0.55, time: 480, song: { seed: 6505, style: "anthem", bpm: 120 },
    hint: "Climb the antenna. Every jump here is a projectile in weak gravity: long, floaty arcs.",
    build: function (b) {
      opener(b);
      b.s(12, function (b) { b.e(4, "x").put(6, 6, "=?="); });
      b.s(20, function (b) {
        b.col(0, 8, 34, "X").col(19, 1, 3, "X");
        b.put(8, 6, "------").put(2, 12, "-----").put(10, 18, "------").put(2, 24, "-----").put(10, 30, "------");
        b.put(9, 7, "ooo").put(3, 13, "ooo").put(4, 25, "*").put(12, 19, "x").put(6, 20, "b");
      });
      b.up(28);
      b.s(14, function (b) { b.e(2, "C").put(5, 5, "?Y?").e(10, "w"); });
      b.s(14, null, "pit");
      b.s(14, function (b) { b.e(3, "x").e(9, "k").put(6, 6, "?=?").put(7, 10, "*"); });
      b.s(12, function (b) { b.put(4, 4, "b").put(8, 6, "x").put(3, 3, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(3, "c").e(9, "s").put(5, 5, "=F="); });
      b.s(16, function (b) { b.put(2, -4, "XXXX").put(9, -10, "XXXX").put(2, -16, "XXXX").put(9, -22, "XXXXX").put(4, -15, "ooo").put(10, -21, "oo"); }, "pit");
      b.dn(25).s(14, function (b) { b.e(2, "C").put(5, 5, "=?=?=").e(10, "x"); });
      b.s(14, function (b) { b.put(6, 5, "---").put(7, 8, "*"); }, "pit");
      b.s(12, function (b) { b.e(3, "w").e(7, "k").put(9, 5, "?U?"); });
      b.s(14, function (b) { b.e(3, "x").e(9, "w").put(6, 6, "?$?"); });
      b.s(12, null, "pit");
      b.s(12, function (b) { b.e(4, "s").put(6, 5, "oooo"); });
      b.s(6);
      finisher(b);
    } });

  level({ id: "6-6", world: 6, name: "Lunar Mech Hangar", theme: "moon", H: 24, g: 0.55, time: 330, song: { seed: 6606, style: "boss", bpm: 150 }, boss: "mech",
    hint: "The Lunar Mech leaps high in weak gravity and vents heat after every landing. Stomp it while it cools.",
    build: function (b) {
      opener(b);
      b.s(14, null, "pit");
      b.s(14, function (b) { b.e(3, "x").put(6, 6, "?=?").put(7, 10, "*"); });
      b.s(13, function (b) { b.put(6, 6, "*"); }, "pit");
      b.s(16, function (b) { b.e(3, "C").put(7, 5, "?Y?").e(12, "w").put(10, 1, "Z"); });
      b.s(5);
      b.arena();
      b.s(28, function (b) { b.put(3, 5, "----").put(21, 5, "----").put(11, 9, "------").put(13, 10, "*").put(3, 6, "oooo").put(21, 6, "oooo").e(18, "@").e(25, "G"); });
      b.up(20).s(3);
      b.end();
    } });

  /* ===== World 7: Entropy Citadel (everything at once; energy is conserved) ===== */
  level({ id: "7-1", world: 7, name: "Citadel Gates", theme: "citadel", H: 20, time: 420, song: { seed: 7101, style: "synthwave", bpm: 132 },
    hint: "Count Entropy's fortress mixes every trick. Read each obstacle before you commit.",
    build: function (b) {
      opener(b);
      b.s(4, null, "lava").s(12, function (b) { b.e(3, "w").e(8, "c").put(5, 4, "=?="); });
      b.s(12, function (b) { b.put(4, 6, "---").put(5, 7, "*").updraft(2, 2, 6); }, "lava");
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "k"); });
      b.s(14, function (b) { b.obj(7, 3, "a", { len: 3 }); b.e(2, "w").e(12, "s"); });
      b.s(10, function (b) { b.gust(0, 10, 1, 6, 1).put(5, 6, "r"); }, "pit");
      b.s(14, function (b) { b.e(3, "w w").put(6, 4, "=F=").put(11, 3, "--").put(12, 4, "*"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 4, amp: 0.85 }); b.put(0, 0, "--").put(14, 0, "--").put(6, 2, "ooo"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(6, "c").put(8, 4, "?K?").e(12, "j"); });
      b.s(5, null, "lava");
      b.s(12, function (b) { b.put(5, 9, "---").put(6, 10, "*").updraft(3, 2, 9).e(10, "s"); });
      b.s(14, function (b) { b.e(3, "w").e(7, "k").put(9, 4, "=?="); }, ">");
      b.s(12, function (b) { b.put(4, 4, "b").put(8, 5, "r").put(3, 2, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(3, "c").e(9, "w").put(5, 4, "?U?"); });
      b.s(14, function (b) { b.e(3, "w").e(9, "k").put(6, 4, "=?="); });
      b.s(5, null, "lava");
      b.s(12, function (b) { b.e(4, "s").put(6, 4, "ooo"); });
      b.s(6);
      finisher(b);
    } });

  level({ id: "7-2", world: 7, name: "Wind Forge", theme: "citadel", H: 22, time: 420, song: { seed: 7202, style: "afro", bpm: 124 },
    hint: "Fans over molten metal. The updraft balances your weight just above the lava: trust the air.",
    build: function (b) {
      opener(b);
      b.s(12, function (b) { b.put(5, 6, "ooo").updraft(2, 8, 5); }, "lava");
      b.s(14, function (b) { b.e(3, "w").e(9, "c").put(5, 4, "=?=").put(11, 3, "--").put(12, 4, "*"); });
      b.s(14, function (b) { b.put(5, 6, "--").put(6, 8, "*").updraft(2, 3, 6).updraft(9, 3, 6); }, "lava");
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "s"); });
      b.s(14, function (b) { b.put(6, 3, "--").gust(0, 14, 1, 8, 1); }, "lava");
      b.s(14, function (b) { b.obj(7, 3, "A", { len: 3 }); b.e(2, "k").e(12, "w"); });
      b.s(16, function (b) { b.put(4, 5, "---").put(10, 9, "----").put(11, 10, "*").updraft(2, 2, 5).updraft(7, 3, 9); });
      b.s(12, function (b) { b.put(5, 7, "ooo").updraft(2, 8, 6); }, "lava");
      b.s(14, function (b) { b.e(2, "C").e(6, "w w").put(9, 4, "?K?"); });
      b.s(10, function (b) { b.gust(0, 10, 1, 6, 1).put(4, 5, "r"); }, "lava");
      b.s(14, function (b) { b.e(3, "c").e(9, "j").put(5, 4, "=$="); });
      b.s(12, function (b) { b.obj(2, 1, "m", { range: 2 }); b.put(3, 5, "r"); }, "lava");
      b.s(14, function (b) { b.e(3, "w").e(7, "k").put(9, 4, "?U?"); }, ">");
      b.s(14, function (b) { b.e(3, "w").e(9, "c").put(6, 4, "?=?"); });
      b.s(8, function (b) { b.put(3, 5, "ooo").updraft(2, 4, 4); }, "lava");
      b.s(6);
      finisher(b);
    } });

  level({ id: "7-3", world: 7, name: "Gravity Well", theme: "citadel", H: 26, g: 0.7, time: 450, song: { seed: 7303, style: "dub", bpm: 104, scale: "phrygian" }, secret: true,
    hint: "Count Entropy has tampered with gravity: g here is 70 % of normal. Your jumps change shape; so do the mortars.",
    build: function (b) {
      opener(b);
      b.s(12, function (b) { b.e(4, "x").put(6, 5, "=?="); });
      b.s(11, null, "pit");
      b.s(14, function (b) { b.e(3, "w").e(9, "c").put(6, 5, "?=?").put(7, 9, "*"); });
      b.s(12, function (b) { b.put(5, 5, "ooo"); }, "lava");
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "x"); });
      // secret: a fan column in low gravity, very high
      b.s(20, function (b) { b.put(5, 7, "-----").put(12, 14, "-----").put(14, 15, "g").put(6, 8, "ooo").updraft(2, 3, 7).updraft(9, 3, 14); });
      b.s(4, null, "pit");
      b.s(14, function (b) { b.e(3, "x").e(9, "s").put(6, 5, "=F=").put(11, 4, "--").put(11, 6, "*"); });
      b.s(14, function (b) { b.obj(6, 6, "p", { len: 5, amp: 0.8 }); b.put(0, 0, "--").put(12, 0, "--").put(5, 3, "ooo"); }, "pit");
      b.s(14, function (b) { b.e(2, "C").e(7, "w w").put(9, 5, "?K?"); });
      b.s(12, null, "spk");
      b.s(14, function (b) { b.e(3, "x").e(9, "w").put(6, 5, "=?=").put(12, 6, "*"); });
      b.s(12, function (b) { b.put(4, 4, "b").put(8, 6, "r").put(3, 3, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(3, "c").e(9, "k").put(5, 5, "?U?"); });
      b.s(14, function (b) { b.e(4, "x").e(10, "w").put(6, 5, "=$="); });
      b.s(6);
      finisher(b);
    } });

  level({ id: "7-4", world: 7, name: "Chaos Conveyors", theme: "citadel", H: 20, time: 420, song: { seed: 7404, style: "funk", bpm: 128 },
    hint: "Belts, ice and crushers. On a belt your ground speed is v = v_rel + u; on ice you cannot stop quickly.",
    build: function (b) {
      opener(b);
      b.s(14, function (b) { b.e(5, "w").put(7, 4, "=?="); }, ">");
      b.s(4, null, "pit");
      b.s(14, function (b) { b.e(3, "k").put(6, 4, "?$?").put(11, 3, "--").put(12, 4, "*"); }, "I");
      b.s(14, function (b) { b.e(2, "C").put(5, 6, "u").e(10, "w"); });
      b.s(14, function (b) { b.e(4, "w").e(9, "w").put(6, 4, "ooo"); }, "<");
      b.s(14, function (b) { b.obj(7, 3, "a", { len: 3 }); b.e(2, "s").e(12, "w"); }, "I");
      b.s(5, null, "lava");
      b.s(14, function (b) { b.e(3, "w").put(6, 6, "u").put(10, 6, "u").put(8, 3, "*"); });
      b.s(14, function (b) { b.e(2, "C").e(9, "c").put(5, 4, "?K?"); });
      b.s(12, function (b) { b.put(4, 5, "---").put(5, 6, "ooo").updraft(2, 2, 5); }, "pit");
      b.s(14, function (b) { b.e(4, "k").e(10, "w").put(6, 4, "=F="); }, ">");
      b.s(14, function (b) { b.obj(7, 3, "A", { len: 3 }); b.e(2, "w").put(7, 7, "*"); }, "I");
      b.s(12, function (b) { b.put(4, 4, "b").put(8, 5, "b").put(3, 2, "oooo"); }, "bridge");
      b.s(14, function (b) { b.e(3, "w").e(7, "j").put(9, 4, "?U?"); }, "<");
      b.s(14, function (b) { b.e(3, "w").e(9, "s").put(6, 4, "=?="); }, ">");
      b.s(10, function (b) { b.e(4, "w").put(6, 4, "ooo"); }, "I");
      b.s(6);
      finisher(b);
    } });

  level({ id: "7-5", world: 7, name: "The Long Climb", theme: "citadel", H: 48, time: 540, song: { seed: 7505, style: "anthem", bpm: 140, scale: "phrygian" },
    hint: "The tower to Entropy's throne. Height is stored energy: every fan and spring pays it back.",
    build: function (b) {
      opener(b);
      b.s(4, null, "lava").s(12, function (b) { b.e(3, "s").e(8, "c").put(5, 4, "=?="); });
      b.s(20, function (b) {
        b.col(0, 6, 40, "X").col(19, 1, 2, "X");
        b.put(9, 4, "------").put(2, 9, "-----").put(10, 14, "------").put(2, 19, "-----").put(10, 24, "------").put(2, 29, "-----").put(10, 34, "------");
        b.put(10, 5, "ooo").put(3, 10, "ooo").put(4, 20, "*").put(12, 15, "r").put(6, 25, "b").put(12, 30, "j");
        b.updraft(4, 2, 14).updraft(12, 2, 24).updraft(4, 2, 34);
      });
      b.up(32);
      b.s(14, function (b) { b.e(2, "C").put(5, 4, "?Y?").e(10, "w"); });
      b.s(14, function (b) { b.put(6, 3, "--").put(7, 4, "*").gust(0, 14, 1, 8, 1); }, "pit");
      b.s(12, function (b) { b.obj(6, 3, "a", { len: 3 }); b.e(2, "k").e(10, "w"); });
      b.s(10, function (b) { b.obj(2, 1, "m", { range: 2 }); b.put(4, 5, "r"); }, "pit");
      b.s(14, function (b) { b.e(3, "c").e(9, "s").put(5, 4, "=F=").put(10, 4, "?K?"); });
      b.s(16, function (b) { b.put(2, -3, "XXXX").put(8, -7, "XXXX").put(2, -11, "XXXX").put(8, -15, "XXXX").put(2, -19, "XXXX").put(8, -23, "XXXXX").put(4, -10, "ooo").put(9, -14, "oo").put(5, -17, "r"); }, "pit");
      b.dn(26).s(14, function (b) { b.e(2, "C").put(5, 4, "=?=?=").e(10, "j"); });
      b.s(14, function (b) { b.obj(7, 3, "a", { len: 4 }); b.e(2, "w").e(12, "w").put(7, 7, "*"); });
      b.s(14, function (b) { b.e(3, "c").e(7, "k").put(9, 4, "?U?"); });
      b.s(14, function (b) { b.e(3, "w").e(9, "s").put(6, 4, "?$?"); });
      b.s(6, null, "lava");
      b.s(14, function (b) { b.e(4, "k").e(10, "w").put(6, 4, "=?="); });
      b.s(9);
      finisher(b);
    } });

  level({ id: "7-6", world: 7, name: "Entropy Prime", theme: "citadel", H: 18, time: 400, song: { seed: 7606, style: "boss", bpm: 172, scale: "phrygian" }, boss: "prime",
    hint: "Count Entropy at full power, in two phases. Stomp him when he swoops; kicked pucks and EMP charges help.",
    build: function (b) {
      opener(b);
      b.s(4, null, "lava").s(14, function (b) { b.obj(7, 3, "a", { len: 3 }); b.e(2, "w").put(7, 7, "*"); });
      b.s(12, function (b) { b.put(5, 6, "*").updraft(3, 5, 5); }, "lava");
      b.s(14, function (b) { b.e(3, "k").e(9, "c").put(5, 4, "=?F?=").put(7, 8, "*").put(5, 5, "o o"); });
      b.s(16, function (b) { b.e(3, "C").put(7, 4, "?Y?").e(12, "j").put(10, 1, "Z"); });
      b.s(5);
      b.arena();
      b.s(28, function (b) { b.put(3, 4, "----").put(21, 4, "----").put(11, 6, "------").put(13, 7, "o").put(3, 5, "oooo").put(21, 5, "oooo").e(18, "@").e(25, "G"); });
      b.up(15).s(3);
      b.end();
    } });

  /* ===== Challenge levels: one per world, unlocked by beating that world's boss. Short, hard, no checkpoints. ===== */
  level({ id: "X1", world: 1, trial: true, name: "Challenge: Freshers' Gauntlet", theme: "grass", H: 17, time: 240, song: { seed: 1909, style: "chip", bpm: 150 },
    hint: "No checkpoints. Every running jump is near its full range: d = v·t at 10.5 m/s.",
    build: function (b) {
      opener(b);
      b.s(9, null, "pit").s(8, function (b) { b.e(4, "w"); }).s(9, null, "pit");
      b.s(10, function (b) { b.e(3, "j").e(7, "w").put(4, 4, "*"); });
      b.s(6, null, "spk").s(10, function (b) { b.put(3, 3, "--").put(4, 5, "*").e(8, "w"); });
      b.s(9, null, "pit").s(6).s(9, function (b) { b.put(4, 3, "---"); }, "pit");
      b.s(12, function (b) { b.e(2, "k").e(6, "w").e(9, "w").put(5, 4, "ooo"); });
      b.s(9, null, "pit").s(10, function (b) { b.put(5, 5, "*").e(8, "j"); });
      b.s(9, null, "pit");
      finisher(b);
    } });

  level({ id: "X2", world: 2, trial: true, name: "Challenge: Black Ice", theme: "ice", H: 17, time: 240, song: { seed: 2909, style: "calm", bpm: 132 },
    hint: "All ice, μ = 0.1. Brake long before every edge: d = v²/2μg.",
    build: function (b) {
      opener(b);
      b.s(16, function (b) { b.e(6, "w").e(11, "k").put(4, 5, "*"); }, "I");
      b.s(6, null, "pit").s(14, function (b) { b.e(5, "s").put(9, 4, "ooo"); }, "I");
      b.s(7, null, "pit").s(14, function (b) { b.put(3, 3, "--").put(4, 5, "*").e(9, "w"); }, "I");
      b.s(6, null, "spk").s(14, function (b) { b.e(4, "k").e(9, "w"); }, "I");
      b.s(7, null, "pit").s(14, function (b) { b.put(6, 5, "*").e(10, "s"); }, "I");
      b.s(6, null, "pit").s(10, null, "I");
      finisher(b);
    } });

  level({ id: "X3", world: 3, trial: true, name: "Challenge: Magma Sprint", theme: "volcano", H: 17, time: 240, song: { seed: 3909, style: "boss", bpm: 162 },
    hint: "Lava everywhere and mortars overhead. Watch each arc: R = v² sin 2θ / g.",
    build: function (b) {
      opener(b);
      b.s(7, null, "lava").s(10, function (b) { b.e(5, "c").put(3, 5, "*"); });
      b.s(8, null, "lava").s(8, function (b) { b.obj(4, 3, "a", { len: 2 }); });
      b.s(8, function (b) { b.obj(1, 1, "m", { range: 2 }); }, "lava");
      b.s(12, function (b) { b.e(3, "w").e(8, "c").put(6, 5, "*"); });
      b.s(7, null, "lava").s(8, function (b) { b.put(2, 3, "--"); }).s(8, null, "lava");
      b.s(12, function (b) { b.e(3, "k").e(9, "s").put(6, 5, "*"); });
      b.s(7, null, "lava");
      finisher(b);
    } });

  level({ id: "X4", world: 4, trial: true, name: "Challenge: Pendulum Alley", theme: "storm", H: 17, time: 260, song: { seed: 4909, style: "synthwave", bpm: 140 },
    hint: "Swing to swing. Period T = 2π√(L/g): count the beat before you jump.",
    build: function (b) {
      opener(b);
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 4, amp: 0.9 }); b.put(0, 0, "--").put(14, 0, "--").put(7, 2, "*"); }, "pit");
      b.s(8, function (b) { b.e(4, "c"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 5, amp: 0.85 }); b.put(0, 0, "--").put(14, 0, "--"); }, "pit");
      b.s(10, function (b) { b.obj(5, 3, "a", { len: 3 }); b.put(5, 7, "*"); });
      b.s(18, function (b) { b.obj(4, 7, "p", { len: 4, amp: 0.8 }).obj(12, 7, "p", { len: 4, amp: 0.8 }); b.put(0, 0, "-").put(17, 0, "-").put(8, 5, "*"); }, "pit");
      b.s(8, function (b) { b.e(4, "w"); });
      finisher(b);
    } });

  level({ id: "X5", world: 5, trial: true, name: "Challenge: Jet Stream", theme: "cliffs", H: 22, time: 240, song: { seed: 5909, style: "breaks", bpm: 140 },
    hint: "Fan to gust to fan with no ground in between. Let the forces carry you.",
    build: function (b) {
      opener(b);
      b.s(12, function (b) { b.put(5, 7, "*").updraft(3, 4, 6); }, "pit");
      b.s(4);
      b.s(12, function (b) { b.gust(0, 12, 1, 8, 1); }, "pit");
      b.s(6, function (b) { b.e(3, "r"); });
      b.s(16, function (b) { b.put(6, 6, "--").put(7, 8, "*").updraft(2, 3, 6).updraft(10, 3, 6); }, "pit");
      b.s(6);
      b.s(14, function (b) { b.put(6, 3, "--").put(6, 5, "*").gust(0, 14, 1, 8, 1); }, "pit");
      b.s(8, function (b) { b.e(4, "w"); });
      b.s(12, function (b) { b.put(5, 7, "ooo").updraft(3, 6, 6); }, "pit");
      finisher(b);
    } });

  level({ id: "X6", world: 6, trial: true, name: "Challenge: Moonwalk", theme: "moon", H: 24, g: 0.55, time: 260, song: { seed: 6909, style: "dub", bpm: 120 },
    hint: "Low gravity, wide craters, moon hoppers. Your arcs are long: commit early.",
    build: function (b) {
      opener(b);
      b.s(15, null, "pit").s(8, function (b) { b.e(4, "x"); });
      b.s(14, function (b) { b.put(6, 7, "*"); }, "pit");
      b.s(8, function (b) { b.e(4, "x"); });
      b.s(12, null, "spk").s(8, function (b) { b.put(4, 8, "*"); });
      b.s(15, function (b) { b.put(7, 5, "--"); }, "pit");
      b.s(10, function (b) { b.e(3, "x").e(7, "w").put(5, 6, "*"); });
      b.s(14, null, "pit");
      finisher(b);
    } });

  level({ id: "X7", world: 7, trial: true, name: "Challenge: Entropy's Maze", theme: "citadel", H: 22, time: 280, song: { seed: 7909, style: "boss", bpm: 168, scale: "phrygian" },
    hint: "The hardest run in the kingdom. Everything you have learned, with no checkpoints.",
    build: function (b) {
      opener(b);
      b.s(8, null, "lava").s(10, function (b) { b.e(4, "c").put(7, 5, "*"); }, "I");
      b.s(12, function (b) { b.put(5, 6, "--").updraft(2, 3, 6).updraft(8, 3, 5); }, "lava");
      b.s(12, function (b) { b.obj(5, 3, "a", { len: 3 }); b.e(10, "s"); }, ">");
      b.s(12, function (b) { b.gust(0, 12, 1, 8, 1).put(6, 6, "*"); }, "lava");
      b.s(8, function (b) { b.e(4, "k"); });
      b.s(16, function (b) { b.obj(7, 7, "p", { len: 4, amp: 0.9 }); b.put(0, 0, "--").put(14, 0, "--").put(7, 4, "*"); }, "pit");
      b.s(10, function (b) { b.e(3, "w").e(6, "w"); }, "I");
      b.s(8, null, "lava");
      finisher(b);
    } });

  /* ---------------- Parsing ---------------- */
  var cache = {};
  function parse(lv) {
    if (cache[lv.id]) return cache[lv.id];
    var b = Builder(lv.H || 17); lv.build(b);
    if (!b.zones.length) b.end();
    var grid = b.done(), H = grid.length, W = grid[0].length, out = { id: lv.id, arenaX: b.arenaX, boss: lv.boss, grid: grid, H: H, W: W, objs: b.objs, zones: b.zones, mainEnd: b.mainEnd, starts: [], goals: [], secrets: [], doors: {}, unknown: [], gs: lv.g || 1, air: false, shards: [], coins: [] };
    for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
      var ch = grid[r][c];
      if (!(ch in TILES)) out.unknown.push(ch + "@" + c + "," + r);
      if (ch === "|" || ch === "{" || ch === "}") out.air = true;
      if (ch === "*") out.shards.push({ c: c, r: r });
      if (ch === "o") out.coins.push({ c: c, r: r });
      if (ch === "P") out.starts.push({ c: c, r: r });
      if (ch === "G") out.goals.push({ c: c, r: r });
      if (ch === "g") out.secrets.push({ c: c, r: r });
      if (ch >= "1" && ch <= "9") (out.doors[ch] = out.doors[ch] || []).push({ c: c, r: r });
    }
    cache[lv.id] = out; return out;
  }
  function platformSpec(ch, o) {
    o = o || {};
    if (ch === "m") return { kind: "h", w: o.w || 3, range: o.range == null ? 3 : o.range, speed: o.speed || 2 };
    if (ch === "v") return { kind: "v", w: o.w || 3, range: o.range == null ? 3 : o.range, speed: o.speed || 2 };
    if (ch === "f") return { kind: "fall", w: o.w || 3 };
    if (ch === "p") return { kind: "pend", w: o.w || 3, len: o.len || 4, amp: o.amp || 0.9 };
    return null;
  }

  /* ---------------- Reachability solver (Node tests) ----------------
   * Breadth-first search over standing cells. From each one it simulates jumps and walk-offs with heroStep (the
   * game's own physics, big hero size, no power-ups or mounts, no wall jumps), so a level only passes if a real
   * player could do it. Moving/swinging/falling platforms count as one-way ledges along their paths. */
  function solverWorld(pl) {
    var extra = {}, g = pl.grid;
    for (var r = 0; r < pl.H; r++) for (var c = 0; c < pl.W; c++) {
      var ch = g[r][c], sp = platformSpec(ch, pl.objs[c + "," + r]); if (!sp) continue;
      var add = function (cc, rr) { extra[cc + "," + rr] = 1; };
      if (sp.kind === "h") for (var k = -sp.range; k <= sp.range; k++) for (var i = 0; i < sp.w; i++) add(c + k + i, r);
      if (sp.kind === "v") for (var k2 = -sp.range; k2 <= sp.range; k2++) for (var i2 = 0; i2 < sp.w; i2++) add(c + i2, r + k2);
      if (sp.kind === "fall") for (var i3 = 0; i3 < sp.w; i3++) add(c + i3, r);
      if (sp.kind === "pend") for (var a = -sp.amp; a <= sp.amp + 1e-9; a += sp.amp / 4) { var px = c + .5 + Math.sin(a) * sp.len, py = r + .5 + Math.cos(a) * sp.len; for (var i4 = 0; i4 < sp.w; i4++) add(Math.floor(px - sp.w / 2 + i4 + .5), Math.floor(py)); }
    }
    var Wd = pl.W, cells = new Array(pl.W * pl.H); pl.moving = extra;
    for (var r2 = 0; r2 < pl.H; r2++) for (var c2 = 0; c2 < pl.W; c2++) {
      var ch2 = g[r2][c2];
      if (extra[c2 + "," + r2] && kind(ch2) === 0 && !isHazard(ch2)) ch2 = "-";
      else if (ch2 === "H" || ch2 === "J" || ch2 === "u") ch2 = ".";
      cells[r2 * Wd + c2] = ch2;
    }
    return { gs: pl.gs, air: pl.air, tile: function (c, r) { if (c < 0 || c >= Wd) return "X"; if (r < 0 || r >= pl.H) return "."; return cells[r * Wd + c]; } };
  }
  function solve(lv, opts) {
    opts = opts || {};
    var pl = parse(lv), W = solverWorld(pl), seen = {}, queue = [], dt = P.DT, sims = 0, g = P.G * pl.gs;
    // every cell the hero's body passes through, to prove collectibles can be reached (not just the gate)
    var touched = new Uint8Array(pl.W * pl.H);
    function touch(b) { var c0 = Math.max(0, Math.floor(b.x)), c1 = Math.min(pl.W - 1, Math.floor(b.x + b.w - 1e-6)), r0 = Math.max(0, Math.floor(b.y)), r1 = Math.min(pl.H - 1, Math.floor(b.y + b.h - 1e-6)); for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) touched[r * pl.W + c] = 1; }
    function standable(c, r) { var t = W.tile(c, r), u = W.tile(c, r + 1); return kind(t) !== 1 && !isHazard(t) && (kind(u) >= 1) && u !== "S" && u !== "^" && r + 1 < pl.H; }
    function key(c, r) { return c + "," + r; }
    function push(c, r) { var k = key(c, r); if (!seen[k]) { seen[k] = 1; queue.push([c, r]); } }
    var s = pl.starts[0]; if (!s) return { ok: false, why: "no start" };
    // drop the start onto the floor below it
    var sr = s.r; while (sr < pl.H - 1 && !standable(s.c, sr)) sr++;
    push(s.c, sr);
    var size = opts.small ? P.SMALL : P.BIG;
    function runway(c, r, dir) {
      var n = 0; while (n < 14 && standable(c - dir * (n + 1), r)) n++;
      var t = W.tile(c, r + 1), a = Math.min(P.ACC, (t === "I" ? P.MU_ICE : P.MU) * g);
      return Math.min(P.RUN, Math.sqrt(2 * a * (n + 0.35)));
    }
    function sim(c, r, dir, v0, hold, pattern, jump) {
      sims++;
      var h = newHero(c, r, true); h.w = size.w; h.h = size.h; h.x = c + .5 - h.w / 2; h.y = r + 1 - h.h; h.vx = dir * v0; h.ground = true; h.surf = W.tile(c, r + 1);
      var t = 0, airborne = false, inp = { l: false, r: false, d: false, dHit: false, jump: false, jumpHit: false, run: true };
      for (var i = 0, n = Math.round(520 / Math.sqrt(pl.gs)) + (pl.air ? 360 : 0); i < n; i++) {
        var steer = pattern === 0 ? dir : pattern === 1 ? (t > 0.25 ? dir : 0) : pattern === 2 ? (t < 0.2 ? dir : 0) : pattern === 3 ? (t > 0.5 ? dir : 0) : (t < 0.3 ? dir : -dir);
        inp.l = steer < 0; inp.r = steer > 0; inp.jump = jump && t < hold; inp.jumpHit = jump && i === 0;
        var ev = heroStep(h, inp, dt, W); t += dt;
        if (ev.lava || ev.spike) return null;
        touch(h);
        if (h.y > pl.H + 1) return null;
        if (!h.ground) airborne = true;
        else if (airborne || (!jump && i > 2)) {
          var lc = Math.floor(h.x + h.w / 2), lr = Math.floor(h.y + h.h - 1e-6);
          if (!standable(lc, lr)) { lc = Math.floor(h.x + .05); if (!standable(lc, lr)) lc = Math.floor(h.x + h.w - .05); }
          if (standable(lc, lr)) return [lc, lr];
          return null;
        }
        if (airborne === false && i > 60 && !jump) return null;
      }
      return null;
    }
    while (queue.length) {
      var cur = queue.shift(), c = cur[0], r = cur[1];
      touched[r * pl.W + c] = 1; if (r > 0) touched[(r - 1) * pl.W + c] = 1; if (pl.moving[c + "," + (r + 1)]) touched[(r + 1) * pl.W + c] = 1;
      // walk along the floor
      [-1, 1].forEach(function (d) { if (standable(c + d, r)) push(c + d, r); });
      // doors
      var dch = pl.grid[r] && pl.grid[r][c];
      if (dch >= "1" && dch <= "9") pl.doors[dch].forEach(function (o) { var rr = o.r; while (rr < pl.H - 1 && !standable(o.c, rr)) rr++; push(o.c, rr); });
      [-1, 1].forEach(function (d) {
        var vr = runway(c, r, d), speeds = [0, Math.min(P.WALK, vr)];
        if (vr > P.WALK + .5) speeds.push(vr);
        speeds.forEach(function (v0) {
          [9, 0.14].forEach(function (hold) {
            for (var pat = 0; pat < 5; pat++) { if (v0 === 0 && pat === 4) continue; var o = sim(c, r, d, v0, hold, pat, true); if (o) push(o[0], o[1]); }
          });
          if (v0 > 0) { var w = sim(c, r, d, v0, 0, 0, false); if (w) push(w[0], w[1]); }
        });
      });
    }
    function reached(list) { return list.some(function (g) { var rr = g.r; while (rr < pl.H - 1 && !standable(g.c, rr)) rr++; return seen[key(g.c, rr)] || seen[key(g.c - 1, rr)] || seen[key(g.c + 1, rr)]; }); }
    function got(list) { return list.filter(function (o) { return touched[o.r * pl.W + o.c]; }).length; }
    var missShards = pl.shards.filter(function (o) { return !touched[o.r * pl.W + o.c]; }).map(function (o) { return o.c + "," + o.r; });
    return { ok: reached(pl.goals), secret: pl.secrets.length ? reached(pl.secrets) : null, cells: Object.keys(seen).length, sims: sims, seen: seen,
      shards: got(pl.shards), shardTotal: pl.shards.length, missShards: missShards, coins: got(pl.coins), coinTotal: pl.coins.length, checkpoints: pl.grid.reduce(function (n, row) { return n + row.split("C").length - 1; }, 0) };
  }

  var KL = { P: P, PHYS: P, TILES: TILES, kind: kind, isHazard: isHazard, heroStep: heroStep, newHero: newHero, sweepX: sweepX, sweepY: sweepY, fits: fits,
    WORLDS: WORLDS, LEVELS: LEVELS, parse: parse, solve: solve, platformSpec: platformSpec, Builder: Builder };
  if (typeof module !== "undefined" && module.exports) module.exports = KL;
  if (typeof window !== "undefined") window.KineticLevels = KL;
  else root.KineticLevels = KL;
})(this);
