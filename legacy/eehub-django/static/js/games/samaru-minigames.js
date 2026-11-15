/* Freshers School Life — mini-games you sit down and play on an arcade cabinet (Samaru Market) or the TV in your room.
   Five original games: Table Smash (table tennis), Kola Stack (falling kola clusters), Fresher Run (amber LCD
   platformer), Harmattan Patrol (prop-plane shooter) and Ayo (the sowing board game). Each game is a pure, seeded,
   fixed-step simulation (init/step/result) with a separate draw, so the Node harness can play them without a canvas.
   Contract: Z.mini = { list(), open(id, opts), close(), active(), update(dt), draw(x), best(id), games }.
   opts: { free: true } no coin fee (hostel TV), { fee: n }, { frame: "tv" | "cabinet" }, { opponent: "Name" }, { level: n }. */
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;
  var Z = root.SamaruGame = root.SamaruGame || {};
  var M = Z.mini = { games: {}, FEE: 50, CAP_CASH: 600, CAP_XP: 90 }, TAU = Math.PI * 2, STEP = 1 / 60;
  var SX = 180, SY = 40, SW = 600, SH = 450;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  M.rng = rng;
  function mkCanvas(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function bmp(rows, px, col) { var c = mkCanvas(rows[0].length * px, rows.length * px), g = c.getContext("2d"); g.fillStyle = col; for (var r = 0; r < rows.length; r++) for (var q = 0; q < rows[r].length; q++) if (rows[r].charAt(q) === "#") g.fillRect(q * px, r * px, px, px); return c; }
  function txt(x, s, px, py, size, col, align, weight, maxW) { x.font = (weight || "700") + " " + size + "px system-ui, -apple-system, 'Segoe UI', sans-serif"; x.fillStyle = col; x.textAlign = align || "left"; x.textBaseline = "middle"; if (maxW) x.fillText(s, px, py, maxW); else x.fillText(s, px, py); }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r); x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r); x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath(); }

  /* =====================================================================================================
     1. TABLE SMASH — table tennis seen from above. The ball has height: it must bounce once on the other
     side; spin comes from how fast your bat is moving when you meet the ball. First to 11, two clear.
     ===================================================================================================== */
  var TT = { L: 80, R: 520, T: 110, B: 340, NET: 300, G: 900, NH: 9 };
  var ttLv = [{ v: 150, err: 34, miss: .2, pw: .25 }, { v: 215, err: 17, miss: .1, pw: .5 }, { v: 285, err: 7, miss: .045, pw: .8 }];
  function ttServer(total) { return total >= 20 ? total % 2 : Math.floor(total / 2) % 2; }
  function ttHit(st, who, power, vy, sp, smash) {
    var b = st.b, r = st.r, dir = who === 0 ? 1 : -1, reach = smash ? 150 + r() * 80 : 70 + power * 110 + r() * 30;
    var tx = TT.NET + dir * reach, speed = (330 + power * 300) * (1 + Math.min(.6, st.rally * .03)), T = Math.abs(tx - b.x) / speed;
    b.vx = dir * speed; b.vy = clamp(vy, -230, 230); b.sp = clamp(sp, -200, 200); b.vz = TT.G * T / 2 - b.z / T;
    var tn = Math.abs(TT.NET - b.x) / speed, zn = b.z + b.vz * tn - .5 * TT.G * tn * tn; if (zn < TT.NH + 3) b.vz += (TT.NH + 3 - zn) / tn;
    b.nb = 0; b.last = who; b.live = 1; st.rally++; if (st.rally > st.bestRally) st.bestRally = st.rally; st.ev = smash ? "heavy" : "kick";
    if (who === 0) st.oerr = (r() - .5) * 2 * ttLv[st.lvl].err; // how wrongly the opponent reads this shot
  }
  function ttAward(st, who, why) {
    var b = st.b; b.live = 0; st.sc[who]++; st.msg = why || (who === 0 ? "Point!" : "Point to " + st.opp); st.ev = who === 0 ? "coin" : "block"; st.phase = "point"; st.pt = 1.15; st.rally = 0;
    if ((st.sc[0] >= 11 || st.sc[1] >= 11) && Math.abs(st.sc[0] - st.sc[1]) >= 2) { st.won = st.sc[0] > st.sc[1]; st.pt = 1.6; st.final = 1; }
  }
  M.games.tabletennis = {
    id: "tabletennis", name: "Table Smash", tag: "Table tennis to 11", accent: "#38bdf8", levels: ["Friendly", "Hall champion", "Social Centre legend"], serverFor: ttServer,
    how: ["Move your bat with the stick or arrows. Get behind the ball: it must bounce once on your side.", "The bat's movement puts spin on the ball. Hold B on a high ball to smash — big, but it can fly long.", "A serves. Serve changes every two points. First to 11, two clear."],
    init: function (seed, lvl, o) {
      var names = ["Emeka", "Halima", "Sadiq"]; try { var D = root.SamaruData; if (D && D.CAST) names = [D.CAST[1].name.split(" ")[0], D.CAST[4].name.split(" ")[0], D.CAST[7].name.split(" ")[0]]; } catch (e) {}
      return { r: rng(seed), lvl: lvl, opp: (o && o.opponent) || names[lvl] || "Rival", px: 50, py: 225, pvy: 0, ox: 550, oy: 225, oerr: 0, b: { x: 60, y: 225, z: 22, vx: 0, vy: 0, vz: 0, sp: 0, nb: 0, last: 0, live: 0 },
        sc: [0, 0], phase: "serve", pt: 0, wait: .9, msg: "", won: null, final: 0, over: 0, ev: "", rally: 0, bestRally: 0, t: 0, swing: 0, oswing: 0 };
    },
    step: function (st, I) {
      var dt = STEP, b = st.b, L = ttLv[st.lvl], sv = ttServer(st.sc[0] + st.sc[1]); if (st.over) return; st.t += dt; if (st.swing > 0) st.swing -= dt; if (st.oswing > 0) st.oswing -= dt;
      var py0 = st.py; st.px = clamp(st.px + I.x * 300 * dt, 26, 230); st.py = clamp(st.py + I.y * 330 * dt, 70, 380); st.pvy += ((st.py - py0) / dt - st.pvy) * .35;
      if (st.phase === "point") { st.pt -= dt; if (st.pt <= 0) { if (st.final) { st.over = 1; return; } st.phase = "serve"; st.wait = .9; st.msg = ""; } return; }
      if (st.phase === "serve") {
        if (sv === 0) { b.x = st.px + 12; b.y = st.py; b.z = 22; if (I.ah) { st.swing = .18; ttHit(st, 0, .3, st.pvy * .2, st.pvy * .5, 0); st.phase = "rally"; } }
        else { st.oy += clamp(225 - st.oy, -L.v * dt, L.v * dt); b.x = st.ox - 12; b.y = st.oy; b.z = 22; st.wait -= dt; if (st.wait <= 0) { st.oswing = .18; ttHit(st, 1, .25 + st.r() * .2, (st.r() - .5) * 150, 0, 0); st.phase = "rally"; } }
        return;
      }
      // opponent bat: read the ball and go there
      if (b.live && b.last === 0) { var tt = b.vx > 0 ? (st.ox - b.x) / b.vx : 0, ty = b.y + b.vy * tt + .5 * b.sp * tt * tt + st.oerr; st.oy += clamp(clamp(ty, 80, 370) - st.oy, -L.v * dt, L.v * dt); }
      else st.oy += clamp(225 - st.oy, -L.v * .6 * dt, L.v * .6 * dt);
      if (!b.live) return;
      var ox = b.x; b.vy += b.sp * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vz -= TT.G * dt; b.z += b.vz * dt;
      if ((ox - TT.NET) * (b.x - TT.NET) < 0 && b.z < TT.NH && b.y > TT.T - 8 && b.y < TT.B + 8) return ttAward(st, 1 - b.last, "Net");
      if (b.z <= 0) {
        if (b.x < TT.L || b.x > TT.R || b.y < TT.T || b.y > TT.B) return ttAward(st, b.nb >= 1 ? b.last : 1 - b.last, b.nb >= 1 ? "" : (b.x < TT.L - 2 || b.x > TT.R + 2 ? "Long" : "Wide"));
        if ((b.x < TT.NET ? 0 : 1) === b.last) return ttAward(st, 1 - b.last, "Own side");
        b.nb++; if (b.nb >= 2) return ttAward(st, b.last, ""); b.z = 0; b.vz = -b.vz * .86; b.sp *= .5; st.ev = "bounce";
      }
      if (b.nb >= 1 && b.last === 1 && Math.abs(b.x - st.px) < 17 && Math.abs(b.y - st.py) < 31) {
        var sm = I.b && b.z > 26; st.swing = .2; ttHit(st, 0, sm ? 1 : clamp(.3 + (I.x > .3 ? .3 : 0), 0, 1), (b.y - st.py) * 2.4 + st.pvy * .2, st.pvy * .5, sm);
      } else if (b.nb >= 1 && b.last === 0 && Math.abs(b.x - st.ox) < 17 && Math.abs(b.y - st.oy) < 31) {
        st.oswing = .2; var r = st.r, bad = r() < L.miss + st.rally * .004, goal = bad ? (r() < .5 ? TT.T - 40 : TT.B + 40) : TT.T + 28 + r() * (TT.B - TT.T - 56), pw = L.pw * (.5 + r() * .5), T2 = (b.x - (TT.NET - 70 - pw * 110)) / (330 + pw * 300);
        if (!bad && st.lvl > 0 && r() < .5) goal = st.py > 225 ? TT.T + 30 + r() * 40 : TT.B - 30 - r() * 40; // play away from you
        ttHit(st, 1, pw, (goal - b.y) / Math.max(.3, T2), 0, st.lvl === 2 && b.z > 30 && r() < .3);
      }
    },
    result: function (st) { return { won: !!st.won, score: st.sc[0] * 10 * (st.lvl + 1) + (st.won ? 100 * (st.lvl + 1) : 0) + st.bestRally, line: (st.won ? "You beat " : "You lost to ") + st.opp + " " + st.sc[0] + "–" + st.sc[1] + " · longest rally " + st.bestRally }; },
    reward: function (st) { return st.won ? { cash: [80, 150, 260][st.lvl], xp: [10, 18, 30][st.lvl] } : { cash: 0, xp: st.sc[0] >= 6 ? 4 : 0 }; },
    side: function (st) { return ["You " + st.sc[0], st.opp + " " + st.sc[1], "Rally " + st.rally]; },
    draw: function (x, st) {
      var b = st.b, sv = ttServer(st.sc[0] + st.sc[1]);
      x.fillStyle = "#3b2a1c"; x.fillRect(0, 0, SW, SH); x.fillStyle = "rgba(0,0,0,.12)"; for (var i = 0; i < 12; i++) x.fillRect(0, i * 40, SW, 2);
      x.fillStyle = "#4a3524"; rr(x, 14, 84, SW - 28, 282, 18); x.fill(); x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 2; x.stroke(); x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(TT.L + 8, TT.T + 12, TT.R - TT.L, TT.B - TT.T);
      x.fillStyle = "#1d5fa8"; x.fillRect(TT.L, TT.T, TT.R - TT.L, TT.B - TT.T); x.strokeStyle = "#fff"; x.lineWidth = 3; x.strokeRect(TT.L + 1.5, TT.T + 1.5, TT.R - TT.L - 3, TT.B - TT.T - 3);
      x.fillStyle = "rgba(255,255,255,.7)"; x.fillRect(TT.L, 224, TT.R - TT.L, 2); x.fillStyle = "#e5e7eb"; x.fillRect(TT.NET - 2, TT.T - 10, 4, TT.B - TT.T + 20); x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(TT.NET + 2, TT.T - 6, 5, TT.B - TT.T + 16);
      bat(st.px, st.py, "#dc2626", "#7c4a2d", st.swing > 0 ? 8 : 0); bat(st.ox, st.oy, "#111827", "#8a5633", st.oswing > 0 ? -8 : 0);
      var k = 1 + b.z / 140; x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(b.x + b.z * .12, b.y + b.z * .1, 6, 4, 0, 0, TAU); x.fill();
      x.fillStyle = "#fff7d6"; x.beginPath(); x.arc(b.x, b.y - b.z * .55, 5.5 * k, 0, TAU); x.fill(); x.strokeStyle = "#f59e0b"; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = "rgba(0,0,0,.55)"; rr(x, 190, 18, 220, 54, 10); x.fill(); txt(x, "YOU", 240, 34, 13, "#fca5a5", "center"); txt(x, st.opp.toUpperCase(), 360, 34, 13, "#cbd5e1", "center"); txt(x, String(st.sc[0]), 240, 56, 26, "#fff", "center", "900"); txt(x, String(st.sc[1]), 360, 56, 26, "#fff", "center", "900"); txt(x, "–", 300, 54, 22, "#94a3b8", "center");
      x.fillStyle = "#fde047"; x.beginPath(); x.arc(sv === 0 ? 205 : 395, 34, 4, 0, TAU); x.fill();
      if (st.phase === "serve" && sv === 0) txt(x, "Press A to serve", 300, 400, 18, "#fff", "center");
      if (st.msg) { x.fillStyle = "rgba(0,0,0,.6)"; rr(x, 200, 380, 200, 40, 10); x.fill(); txt(x, st.msg, 300, 400, 18, "#fde047", "center"); }
      function bat(px, py, col, skin, lean) { x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(px + 4, py + 6, 13, 30, 0, 0, TAU); x.fill(); var bx = px - (px < 300 ? 22 : -22); x.fillStyle = px < 300 ? "#f59e0b" : "#0ea5e9"; x.beginPath(); x.ellipse(bx, py, 12, 22, 0, 0, TAU); x.fill(); x.fillStyle = skin; x.beginPath(); x.arc(bx, py, 10, 0, TAU); x.fill(); x.fillStyle = "#1f2937"; x.beginPath(); x.arc(bx - (px < 300 ? 3 : -3), py, 8, 0, TAU); x.fill(); x.save(); x.translate(px, py); x.rotate(lean * .03); x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, 10, 29, 0, 0, TAU); x.fill(); x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 2; x.stroke(); x.restore(); }
    }
  };

  /* =====================================================================================================
     2. KOLA STACK — clusters of coloured kola nuts fall into a market crate nine nuts wide. Fill a row to
     sell it; three or more of one colour side by side in a sold row pay extra. B swaps with your basket.
     In "Rising floor" a layer of husks pushes up from below every few seconds.
     ===================================================================================================== */
  var KW = 9, KH = 15, KCOL = ["", "#b91c1c", "#f5e6c8", "#ec4899", "#7c3f1d", "#6b7280"];
  var KSH = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [0, 1]], [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]], KWT = [1, 3, 4, 4, 1, 1.5, 1.5], KR = [];
  (function () { for (var s = 0; s < KSH.length; s++) { var c = KSH[s], rots = []; for (var r = 0; r < 4; r++) { var mx = 99, my = 99, flat = [], i; for (i = 0; i < c.length; i++) { mx = Math.min(mx, c[i][0]); my = Math.min(my, c[i][1]); } for (i = 0; i < c.length; i++) flat.push(c[i][0] - mx, c[i][1] - my); rots.push(flat); var maxY = 0; for (i = 0; i < c.length; i++) maxY = Math.max(maxY, c[i][1]); c = c.map(function (q) { return [maxY - q[1], q[0]]; }); } KR.push(rots); } })();
  function kFits(st, s, r, px, py) { var f = KR[s][r]; for (var i = 0; i < f.length; i += 2) { var cx = px + f[i], cy = py + f[i + 1]; if (cx < 0 || cx >= KW || cy >= KH) return false; if (cy >= 0 && st.g[cy * KW + cx]) return false; } return true; }
  function kRoll(st, p) { var r = st.r, t = r() * 16, s = 0; while (s < KWT.length - 1 && t >= KWT[s]) { t -= KWT[s]; s++; } p.s = s; p.r = 0; var mono = r() < .5, c0 = 1 + Math.floor(r() * 4); for (var i = 0; i < 5; i++) p.c[i] = mono ? c0 : 1 + Math.floor(r() * 4); }
  function kCopy(a, b) { a.s = b.s; a.r = b.r; for (var i = 0; i < 5; i++) a.c[i] = b.c[i]; }
  function kSpawn(st) { kCopy(st.cur, st.nxt); kRoll(st, st.nxt); st.cur.r = 0; st.cur.x = 3; st.cur.y = 0; st.canHold = 1; st.ft = st.iv; if (!kFits(st, st.cur.s, 0, 3, 0)) { st.over = 1; st.ev = "lose"; } }
  function kLock(st) {
    var p = st.cur, f = KR[p.s][p.r], g = st.g, i, y, x0, n = 0, bonus = 0, hn = 0;
    for (i = 0; i < f.length; i += 2) { var cy = p.y + f[i + 1]; if (cy >= 0) g[cy * KW + p.x + f[i]] = p.c[i / 2]; }
    for (y = KH - 1; y >= 0; y--) {
      var full = 1; for (x0 = 0; x0 < KW; x0++) if (!g[y * KW + x0]) { full = 0; break; } if (!full) continue;
      var husk = 0; for (x0 = 0; x0 < KW; x0++) if (g[y * KW + x0] === 5) husk = 1; if (husk) { hn++; n--; }
      var run = 1; for (x0 = 1; x0 <= KW; x0++) { if (x0 < KW && g[y * KW + x0] === g[y * KW + x0 - 1] && g[y * KW + x0] < 5) run++; else { if (run >= 3) bonus += 30 * run; run = 1; } }
      for (var yy = y; yy > 0; yy--) for (x0 = 0; x0 < KW; x0++) g[yy * KW + x0] = g[(yy - 1) * KW + x0]; for (x0 = 0; x0 < KW; x0++) g[x0] = 0; n++; y++;
    }
    if (n || hn) { st.rows += n + hn; st.score += (100 * n * n + 40 * hn + bonus) * st.lvl; st.lvl = 1 + Math.floor(st.rows / 6); st.iv = Math.max(.08, .8 - (st.lvl - 1) * .07); st.fx = .3; st.lastBonus = bonus; st.ev = n + hn > 1 ? "special" : "coin"; } else { st.score += 4; st.ev = "stomp"; }
    kSpawn(st);
  }
  function kRise(st) { var g = st.g, x0, y; for (x0 = 0; x0 < KW; x0++) if (g[x0]) { st.over = 1; st.ev = "lose"; return; } for (y = 0; y < KH - 1; y++) for (x0 = 0; x0 < KW; x0++) g[y * KW + x0] = g[(y + 1) * KW + x0]; var gap = Math.floor(st.r() * KW); for (x0 = 0; x0 < KW; x0++) g[(KH - 1) * KW + x0] = x0 === gap ? 0 : 5; if (!kFits(st, st.cur.s, st.cur.r, st.cur.x, st.cur.y)) st.cur.y--; st.ev = "heavy"; }
  M.games.kola = {
    id: "kola", name: "Kola Stack", tag: "Fill rows of kola nuts", accent: "#f472b6", levels: ["Market day", "Rising floor"], _: { fits: kFits, KR: KR, KW: KW, KH: KH },
    how: ["Left and right move the cluster, down drops it faster, up drops it at once. A turns it.", "A full row is sold. Three or more nuts of one colour side by side in that row pay extra.", "B swaps the cluster with the one in your basket, once per cluster."],
    init: function (seed, lvl) { var st = { r: rng(seed), mode: lvl, g: new Int8Array(KW * KH), cur: { s: 0, r: 0, x: 3, y: 0, c: new Int8Array(5) }, nxt: { s: 0, r: 0, c: new Int8Array(5) }, hold: { s: -1, r: 0, c: new Int8Array(5) }, tmp: { s: 0, r: 0, c: new Int8Array(5) }, canHold: 1, ft: .8, iv: .8, das: 0, lvl: 1, rows: 0, score: 0, rt: 18, fx: 0, lastBonus: 0, over: 0, ev: "", t: 0 }; kRoll(st, st.nxt); kSpawn(st); return st; },
    step: function (st, I) {
      var dt = STEP, p = st.cur, k; if (st.over) return; st.t += dt; if (st.fx > 0) st.fx -= dt;
      var dir = I.lh ? -1 : I.rh ? 1 : 0; if (dir) st.das = .17; else if (I.l !== I.r) { st.das -= dt; if (st.das <= 0) { dir = I.l ? -1 : 1; st.das = .045; } }
      if (dir && kFits(st, p.s, p.r, p.x + dir, p.y)) p.x += dir;
      if (I.ah) { var nr = (p.r + 1) % 4, kicks = [0, -1, 1, -2, 2]; for (k = 0; k < 5; k++) if (kFits(st, p.s, nr, p.x + kicks[k], p.y)) { p.x += kicks[k]; p.r = nr; st.ev = "click"; break; } }
      if (I.bh && st.canHold) { if (st.hold.s < 0) { kCopy(st.hold, p); kSpawn(st); } else { kCopy(st.tmp, p); kCopy(p, st.hold); kCopy(st.hold, st.tmp); p.r = 0; p.x = 3; p.y = 0; if (!kFits(st, p.s, 0, 3, 0)) { st.over = 1; return; } } st.canHold = 0; st.ev = "dash"; p = st.cur; }
      if (I.uh) { while (kFits(st, p.s, p.r, p.x, p.y + 1)) { p.y++; st.score += 1; } kLock(st); return; }
      st.ft -= dt * (I.d ? 14 : 1); if (st.ft <= 0) { st.ft += st.iv; if (kFits(st, p.s, p.r, p.x, p.y + 1)) p.y++; else { kLock(st); return; } }
      if (st.mode === 1) { st.rt -= dt; if (st.rt <= 0) { kRise(st); st.rt = Math.max(7, 20 - st.lvl); } }
    },
    result: function (st) { return { won: st.score >= 1500, score: st.score, line: st.rows + " rows sold · level " + st.lvl }; },
    reward: function (st) { var s = st.score; return { cash: (s >= 500 ? 40 : 0) + (s >= 1500 ? 80 : 0) + (s >= 4000 ? 150 : 0), xp: (s >= 500 ? 5 : 0) + (s >= 1500 ? 10 : 0) + (s >= 4000 ? 18 : 0) }; },
    side: function (st) { return ["Score " + st.score, "Rows " + st.rows, "Level " + st.lvl]; },
    draw: function (x, st) {
      var C = 26, ox = 300 - KW * C / 2, oy = 30, g = st.g, i, cx, cy, p = st.cur, f;
      x.fillStyle = "#2a1a10"; x.fillRect(0, 0, SW, SH); x.fillStyle = "#3a2516"; for (i = 0; i < 9; i++) x.fillRect(i * 70 - 10, 0, 34, SH);
      x.fillStyle = "#1a0f08"; x.fillRect(ox - 8, oy - 8, KW * C + 16, KH * C + 16); x.fillStyle = "#26364a"; x.fillRect(ox, oy, KW * C, KH * C); x.fillStyle = "rgba(255,255,255,.06)"; for (i = 1; i < KW; i++) x.fillRect(ox + i * C, oy, 1, KH * C); for (i = 1; i < KH; i++) x.fillRect(ox, oy + i * C, KW * C, 1);
      for (cy = 0; cy < KH; cy++) for (cx = 0; cx < KW; cx++) if (g[cy * KW + cx]) nut(ox + cx * C, oy + cy * C, g[cy * KW + cx], C);
      if (!st.over) { f = KR[p.s][p.r]; var gy = p.y; while (kFits(st, p.s, p.r, p.x, gy + 1)) gy++; x.globalAlpha = .22; for (i = 0; i < f.length; i += 2) nut(ox + (p.x + f[i]) * C, oy + (gy + f[i + 1]) * C, p.c[i / 2], C); x.globalAlpha = 1; for (i = 0; i < f.length; i += 2) if (p.y + f[i + 1] >= 0) nut(ox + (p.x + f[i]) * C, oy + (p.y + f[i + 1]) * C, p.c[i / 2], C); }
      if (st.fx > 0) { x.fillStyle = "rgba(253,224,71," + (st.fx * 1.6) + ")"; x.fillRect(ox, oy, KW * C, KH * C); if (st.lastBonus) txt(x, "COLOUR RUN +" + st.lastBonus * st.lvl, 300, 210, 20, "#fff", "center", "900"); }
      box(40, 40, "NEXT", st.nxt); box(40, 200, "BASKET (B)", st.hold.s < 0 ? null : st.hold);
      txt(x, "SCORE", 470, 50, 13, "#d6b98c"); txt(x, String(st.score), 470, 76, 26, "#fff", "left", "900"); txt(x, "ROWS " + st.rows, 470, 116, 15, "#fde68a"); txt(x, "LEVEL " + st.lvl, 470, 140, 15, "#fde68a");
      if (st.mode === 1) { txt(x, "FLOOR RISES IN", 470, 190, 12, "#fca5a5"); x.fillStyle = "#7f1d1d"; x.fillRect(470, 204, 100, 8); x.fillStyle = "#ef4444"; x.fillRect(470, 204, 100 * clamp(st.rt / 20, 0, 1), 8); }
      function nut(a, b, c, s) { if (c === 5) { x.fillStyle = "#6b7280"; x.fillRect(a + 1, b + 1, s - 2, s - 2); x.fillStyle = "#4b5563"; x.fillRect(a + 4, b + 4, s - 8, 3); x.fillRect(a + 4, b + s - 9, s - 8, 3); return; } x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.ellipse(a + s / 2 + 1, b + s / 2 + 2, s * .44, s * .4, 0, 0, TAU); x.fill(); x.fillStyle = KCOL[c]; x.beginPath(); x.ellipse(a + s / 2, b + s / 2, s * .44, s * .4, 0, 0, TAU); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.ellipse(a + s * .38, b + s * .36, s * .13, s * .09, -.6, 0, TAU); x.fill(); x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(a + s / 2 - .5, b + s * .2, 1, s * .6); }
      function box(a, b, label, pc) { x.fillStyle = "rgba(0,0,0,.45)"; rr(x, a, b, 96, 112, 10); x.fill(); txt(x, label, a + 48, b + 14, 11, "#d6b98c", "center"); if (!pc) return; var q = KR[pc.s][0]; for (var j = 0; j < q.length; j += 2) nut(a + 15 + q[j] * 22, b + 30 + q[j + 1] * 22, pc.c[j / 2], 22); }
    }
  };

  /* =====================================================================================================
     3. FRESHER RUN — a two-tone amber LCD platformer across the campus rooftops. Collect lecture notes,
     hop the puddles, land on the goats. Six short hand-built levels and Baba Goat at the end.
     ===================================================================================================== */
  var FR = { TILE: 30, HPX: 390, RUN: 190, ACC: 1500, G: 1300, JV: -470, COY: .09, BUF: .12 };
  var FLV = [
    { name: "Ribadu roofs", segs: "9:3 2:0 7:3 3:4 6:3 2:0 5:4 4:3 3:0 8:3 4:5 6:3 10:3", goats: [22, 45], pud: [13, 31, 56], plats: [], notes: "4:5 9:6 10:6 14:5 19:6 24:5 27:6 28:6 30:6 36:5 39:6 40:6 44:5 50:7 51:7 60:5 63:5" },
    { name: "Senate ledges", segs: "8:3 3:0 4:4 2:0 4:5 3:0 6:3 2:5 5:3 2:0 3:4 2:0 3:5 2:0 8:3 3:4 3:5 3:6 2:0 12:3", goats: [26, 34, 52, 72], pud: [27, 54, 71], plats: [], notes: "9:6 12:6 16:7 18:7 22:7 25:5 30:7 31:7 35:5 38:6 40:6 43:7 45:7 48:7 58:6 61:7 64:8 67:8 70:5" },
    { name: "Market stalls", segs: "10:2 3:0 6:2 2:4 6:2 3:0 4:3 3:0 4:3 2:0 9:2 3:4 2:0 3:4 8:2 3:0 10:2 4:4 10:2", goats: [16, 24, 47, 64, 76, 88], pud: [63, 74, 87], plats: [[14, 4, 3], [23, 4, 3], [45, 4, 4], [62, 4, 4], [73, 4, 5]], notes: "11:5 12:5 14:6 15:6 16:6 23:6 24:6 25:6 28:5 29:5 35:6 36:6 42:5 45:6 46:6 47:6 48:6 53:6 56:7 58:6 62:6 63:6 64:6 65:6 69:5 70:5 73:6 75:6 77:6 82:6" },
    { name: "Engineering quad", segs: "7:3 2:0 3:5 2:0 3:3 3:0 5:4 5:3 2:0 2:4 2:0 2:5 2:0 2:6 3:0 9:3 3:5 6:3 3:0 4:4 3:0 12:3", goats: [22, 27, 48, 59, 77], pud: [51, 76], plats: [], notes: "8:6 10:7 13:6 18:6 19:6 21:6 31:6 33:6 35:7 37:7 39:8 41:8 43:7 46:5 55:7 58:5 64:6 65:6 67:6 71:6 72:6 75:5" },
    { name: "Night shuttle", segs: "8:3 3:0 3:3 3:0 3:3 3:0 6:4 2:6 6:4 2:0 5:3 2:5 2:0 2:5 5:3 3:0 3:4 3:0 3:5 3:0 10:3 2:5 2:0 2:5 2:0 2:5 10:3", goats: [25, 33, 41, 52, 73, 76, 93], pud: [72, 77, 92], plats: [], notes: "9:6 10:6 15:6 16:6 21:6 22:6 26:6 30:8 32:6 38:6 45:7 47:7 49:7 56:6 57:6 62:7 63:7 68:7 69:7 81:7 83:7 85:7 87:7 89:7" },
    { name: "Convocation roof", segs: "8:3 2:0 4:4 2:0 4:5 2:0 4:4 3:0 6:3 3:5 3:0 3:5 6:3 2:0 3:4 2:0 3:4 2:0 26:3", goats: [31, 46], pud: [32], plats: [], notes: "9:6 12:6 15:7 18:7 21:7 24:6 27:6 28:6 36:7 39:8 40:8 42:7 51:6 53:6 56:6 58:6 61:6", boss: 80, flag: 85 }
  ];
  function frParse(i) {
    var d = FLV[i], h = [], L = { i: i, name: d.name, h: h, plats: d.plats, notes: [], goats: [], pud: {}, boss: d.boss || 0 }, k, j;
    d.segs.split(" ").forEach(function (s) { var p = s.split(":"), w = +p[0], hh = +p[1]; for (var q = 0; q < w; q++) h.push(hh); });
    L.n = h.length; L.flag = d.flag || L.n - 5;
    d.notes.split(" ").forEach(function (s) { var p = s.split(":"); L.notes.push({ x: +p[0] * 30 + 15, y: FR.HPX - (+p[1]) * 30 + 15, got: 0 }); });
    for (k = 0; k < d.pud.length; k++) if (d.pud[k] >= 6 && h[d.pud[k]]) L.pud[d.pud[k]] = 1;
    for (k = 0; k < d.goats.length; k++) { var c = d.goats[k]; if (c < 6 || !h[c]) continue; var a = c, b = c; while (a > 0 && h[a - 1] === h[c]) a--; while (b < L.n - 1 && h[b + 1] === h[c]) b++; L.goats.push({ x: c * 30 + 15, y: FR.HPX - h[c] * 30, vx: (k % 2 ? 50 : -50), a: 1, lo: a * 30 + 14, hi: (b + 1) * 30 - 14 }); }
    return L;
  }
  function frCheck() { // static sanity of the six levels: every gap can be jumped and every step can be climbed
    var bad = [];
    for (var i = 0; i < FLV.length; i++) { var L = frParse(i), h = L.h, last = h[0], gap = 0; if (!h[L.flag]) bad.push(i + ": flag over a gap"); if (!h[0] || !h[1]) bad.push(i + ": no start");
      for (var c = 1; c < L.n; c++) { if (!h[c]) { gap++; continue; } if (gap > 3) { var cover = false; for (var p = 0; p < L.plats.length; p++) if (L.plats[p][0] <= c - gap + 1 && L.plats[p][0] + L.plats[p][2] >= c - 1) cover = true; if (!cover) bad.push(i + ": gap of " + gap + " at " + c); } if (h[c] - last > 2) bad.push(i + ": step of " + (h[c] - last) + " at " + c); if (gap && h[c] - last > 1 && gap > 2) bad.push(i + ": up " + (h[c] - last) + " over a gap of " + gap + " at " + c); last = h[c]; gap = 0; }
      for (var pc in L.pud) { pc = +pc; if (h[pc - 1] !== h[pc] || h[pc - 2] !== h[pc] || h[pc + 1] !== h[pc] || h[pc + 2] !== h[pc]) bad.push(i + ": puddle with no room to land beside it at " + pc); if (Math.abs(pc - L.flag) < 3) bad.push(i + ": puddle at the flag"); if (!h[pc + 3] || !h[pc + 4]) bad.push(i + ": a jump over the puddle at " + pc + " lands in a gap"); }
      for (var n = 0; n < L.notes.length; n++) { var col = Math.floor(L.notes[n].x / 30), top = FR.HPX - (h[col] || 0) * 30; if (L.notes[n].y > top - 10) bad.push(i + ": note inside the roof at " + col); } }
    return bad;
  }
  function frGy(L, col) { if (col < 0) return -9999; var h = col >= L.n ? 0 : L.h[col]; return h ? FR.HPX - h * 30 : 9999; }
  function frLevel(st, i) { st.L = frParse(i); st.li = i; var p = st.p; p.x = 45; p.y = frGy(st.L, 1); p.vx = p.vy = 0; p.onG = 1; p.coy = p.buf = 0; p.inv = 1; st.safe = 45; st.lt = 0; st.cam = 0; st.boss = st.L.boss ? { x: st.L.boss * 30, y: frGy(st.L, st.L.boss), vx: -70, hp: 3, stun: 0, tell: 0, charge: 0, on: 0, dead: 0 } : null; st.banner = 1.6; }
  function frHurt(st, fell) { var p = st.p; if (p.inv > 0 && !fell) return; st.lives--; st.ev = "hit"; if (st.lives <= 0) { st.over = 1; st.won = 0; return; } p.inv = 1.6; if (fell) { p.x = st.safe; p.y = frGy(st.L, Math.floor(st.safe / 30)); p.vx = p.vy = 0; } else { p.vy = -300; p.vx = -p.face * 150; } }
  M.games.run = {
    id: "run", name: "Fresher Run", tag: "Rooftop platformer", accent: "#f59e0b", levels: null, check: frCheck, levelCount: FLV.length, _: { gy: frGy, FR: FR },
    how: ["Run with left and right. A jumps: hold it to jump higher.", "Collect lecture notes. Land on a goat to send it home. Do not step in puddles.", "Six rooftops. Baba Goat guards the last flag: land on his back three times."],
    init: function (seed) { var st = { r: rng(seed), p: { x: 45, y: 0, vx: 0, vy: 0, onG: 1, coy: 0, buf: 0, inv: 0, face: 1, anim: 0 }, lives: 3, score: 0, notes: 0, li: 0, lt: 0, t: 0, over: 0, won: 0, ev: "", cam: 0, safe: 45, banner: 0, L: null, boss: null }; frLevel(st, 0); return st; },
    step: function (st, I) {
      var dt = STEP, p = st.p, L = st.L, i, g, B = st.boss; if (st.over) return; st.t += dt; st.lt += dt; if (st.banner > 0) st.banner -= dt; if (p.inv > 0) p.inv -= dt;
      var tv = I.x * FR.RUN, a = FR.ACC * (p.onG ? 1 : .65) * dt; p.vx += clamp(tv - p.vx, -a, a); if (I.x > .2) p.face = 1; else if (I.x < -.2) p.face = -1;
      if (I.ah) p.buf = FR.BUF; else p.buf -= dt; if (p.onG) p.coy = FR.COY; else p.coy -= dt;
      if (p.buf > 0 && p.coy > 0) { p.vy = FR.JV; p.buf = 0; p.coy = 0; p.onG = 0; st.ev = "jump"; }
      if (!I.a && p.vy < -170) p.vy = -170; p.vy = Math.min(p.vy + FR.G * dt, 720);
      var nx = p.x + p.vx * dt, sg = p.vx > 0 ? 1 : -1, col = Math.floor((nx + sg * 9) / 30);
      if (frGy(L, col) < p.y - 1) { nx = sg > 0 ? col * 30 - 9.01 : (col + 1) * 30 + 9.01; p.vx = 0; } p.x = clamp(nx, 9, L.n * 30 - 9);
      var py0 = p.y; p.y += p.vy * dt; g = Math.min(frGy(L, Math.floor((p.x - 8) / 30)), frGy(L, Math.floor((p.x + 8) / 30))); p.onG = 0;
      if (p.vy >= 0) { if (p.y >= g && py0 <= g + 14) { p.y = g; p.vy = 0; p.onG = 1; } else for (i = 0; i < L.plats.length; i++) { var pl = L.plats[i], top = FR.HPX - pl[1] * 30; if (py0 <= top + .01 && p.y >= top && p.x > pl[0] * 30 - 6 && p.x < (pl[0] + pl[2]) * 30 + 6) { p.y = top; p.vy = 0; p.onG = 1; break; } } }
      if (p.onG) { p.anim += Math.abs(p.vx) * dt; var c0 = Math.floor(p.x / 30); if (L.pud[c0] && p.y >= frGy(L, c0) - 1 && Math.abs(p.x - (c0 * 30 + 15)) < 11) frHurt(st, false); else if (frGy(L, c0) === p.y && !L.pud[c0] && !L.pud[c0 + 1] && !L.pud[c0 - 1]) st.safe = c0 * 30 + 15; }
      if (p.y > FR.HPX + 60) { frHurt(st, true); if (st.over) return; }
      for (i = 0; i < L.notes.length; i++) { var n = L.notes[i]; if (!n.got && Math.abs(n.x - p.x) < 17 && Math.abs(n.y - (p.y - 14)) < 22) { n.got = 1; st.notes++; st.score += 10; st.ev = "coin"; } }
      for (i = 0; i < L.goats.length; i++) { var q = L.goats[i]; if (!q.a) continue; q.x += q.vx * dt; if (q.x < q.lo) { q.x = q.lo; q.vx = Math.abs(q.vx); } else if (q.x > q.hi) { q.x = q.hi; q.vx = -Math.abs(q.vx); }
        if (Math.abs(q.x - p.x) < 21 && p.y > q.y - 22 && p.y - 26 < q.y) { if (p.vy > 60 && py0 <= q.y - 12) { q.a = 0; p.vy = -330; st.score += 25; st.ev = "stomp"; } else frHurt(st, false); } }
      if (B && !B.dead) {
        if (!B.on && p.x > (L.boss - 13) * 30) { B.on = 1; st.ev = "whistle"; }
        if (B.on) { if (B.stun > 0) B.stun -= dt; else if (B.tell > 0) { B.tell -= dt; if (B.tell <= 0) { B.charge = 1.1; B.vx = (p.x < B.x ? -1 : 1) * (150 + (3 - B.hp) * 40); } } else { if (B.charge > 0) B.charge -= dt; else { B.vx = (B.vx < 0 ? -1 : 1) * (70 + (3 - B.hp) * 25); if (Math.abs(p.x - B.x) < 240 && st.r() < .012) B.tell = .55; } B.x += B.vx * dt; var lo = (L.boss - 13) * 30 + 30, hi = (L.n - 1) * 30 - 30; if (B.x < lo) { B.x = lo; B.vx = Math.abs(B.vx); } else if (B.x > hi) { B.x = hi; B.vx = -Math.abs(B.vx); } }
          if (Math.abs(B.x - p.x) < 34 && p.y > B.y - 46 && p.y - 26 < B.y) { if (p.vy > 60 && py0 <= B.y - 30) { p.vy = -420; if (B.stun <= 0) { B.hp--; B.stun = 1; B.tell = 0; B.charge = 0; st.score += 100; st.ev = "heavy"; if (B.hp <= 0) { B.dead = 1; st.score += 300; st.ev = "special"; } } } else if (B.stun <= 0) frHurt(st, false); } }
      }
      st.cam = clamp(p.x - 220, 0, Math.max(0, L.n * 30 - SW));
      if ((!B || B.dead) && p.x > L.flag * 30 + 4) { st.score += Math.max(0, Math.round(60 - st.lt)) * 5 + 50; if (st.li >= FLV.length - 1) { st.over = 1; st.won = 1; st.ev = "win"; } else { frLevel(st, st.li + 1); st.ev = "power"; } }
    },
    result: function (st) { return { won: !!st.won, score: st.score, line: (st.won ? "All six rooftops cleared" : "Reached " + st.L.name) + " · " + st.notes + " notes" }; },
    reward: function (st) { var s = st.score; return { cash: (s >= 300 ? 40 : 0) + (s >= 800 ? 70 : 0) + (s >= 1500 ? 110 : 0) + (st.won ? 200 : 0), xp: (s >= 300 ? 5 : 0) + (s >= 800 ? 8 : 0) + (s >= 1500 ? 12 : 0) + (st.won ? 25 : 0) }; },
    side: function (st) { return ["Score " + st.score, "Roof " + (st.li + 1) + " of " + FLV.length, "Lives " + st.lives]; },
    draw: function (x, st, t) {
      var S = M._spr || (M._spr = frSprites()), L = st.L, p = st.p, cam = Math.round(st.cam), c, i, BG = "#e9b949", INK = "#2a1d06", oy = 60, c0 = Math.floor(cam / 30), B = st.boss;
      x.fillStyle = BG; x.fillRect(0, 0, SW, SH); x.fillStyle = "rgba(42,29,6,.07)"; for (i = 0; i < 5; i++) { var bx = ((i * 190 - cam * .3) % 950 + 950) % 950 - 120; x.fillRect(bx, oy + 150 - (i % 3) * 40, 90, 240 + (i % 3) * 40); x.fillRect(bx + 20, oy + 120 - (i % 3) * 40, 14, 30); }
      x.fillStyle = INK; x.fillRect(0, oy - 4, SW, 2);
      for (c = c0; c <= c0 + 21 && c < L.n; c++) { var h = L.h[c]; if (!h) continue; var top = oy + FR.HPX - h * 30, sx = c * 30 - cam; x.drawImage(S.roof, sx, top); for (i = 1; i < h; i++) x.drawImage(S.wall, sx, top + i * 30); if (L.pud[c]) x.drawImage(S.pud, sx + 3, top - 5); }
      for (i = 0; i < L.plats.length; i++) { var pl = L.plats[i]; x.fillRect(pl[0] * 30 - cam, oy + FR.HPX - pl[1] * 30, pl[2] * 30, 6); x.fillRect(pl[0] * 30 - cam + 4, oy + FR.HPX - pl[1] * 30 + 6, 3, 8); x.fillRect((pl[0] + pl[2]) * 30 - cam - 7, oy + FR.HPX - pl[1] * 30 + 6, 3, 8); }
      for (i = 0; i < L.notes.length; i++) { var n = L.notes[i]; if (!n.got && n.x - cam > -20 && n.x - cam < SW + 20) x.drawImage(S.note, n.x - cam - 8, oy + n.y - 9 + Math.sin(t * 4 + i) * 2); }
      for (i = 0; i < L.goats.length; i++) { var q = L.goats[i]; if (!q.a) continue; x.save(); x.translate(Math.round(q.x - cam), oy + q.y - 21); if (q.vx > 0) x.scale(-1, 1); x.drawImage(S.goat, -15, 0); x.restore(); }
      if (!B || B.dead) { var fx = L.flag * 30 + 15 - cam, fy = oy + frGy(L, L.flag); x.fillRect(fx - 1, fy - 62, 3, 62); x.fillRect(fx + 2, fy - 62, 22, 5); x.fillRect(fx + 2, fy - 57, 16, 5); x.fillRect(fx + 2, fy - 52, 22, 5); }
      if (B && !B.dead) { x.save(); x.translate(Math.round(B.x - cam + (B.tell > 0 ? Math.sin(t * 60) * 2 : 0)), oy + B.y - 50); if (B.vx > 0) x.scale(-1, 1); if (B.stun <= 0 || Math.floor(t * 12) % 2) { x.drawImage(S.goat, -36, 0, 72, 50); x.fillRect(-34, -8, 4, 8); x.fillRect(-26, -12, 4, 12); x.fillRect(-18, -8, 4, 8); x.fillRect(-34, -2, 20, 3); } x.restore(); for (i = 0; i < B.hp; i++) x.fillRect(SW - 30 - i * 16, oy + 8, 11, 11); txt(x, "BABA GOAT", SW - 84, oy + 14, 12, INK, "right", "900"); }
      if (p.inv <= 0 || Math.floor(t * 14) % 2) { x.save(); x.translate(Math.round(p.x - cam), oy + p.y - 30); if (p.face < 0) x.scale(-1, 1); x.drawImage(!p.onG ? S.jump : Math.abs(p.vx) > 20 && Math.floor(p.anim / 14) % 2 ? S.run : S.stand, -12, 0); x.restore(); }
      x.fillStyle = INK; txt(x, "FRESHER RUN", 14, 22, 18, INK, "left", "900"); txt(x, L.name.toUpperCase(), 14, 44, 12, INK); txt(x, "NOTES " + st.notes, 250, 22, 14, INK); txt(x, "SCORE " + st.score, 250, 44, 14, INK); txt(x, "TIME " + Math.floor(st.lt), 420, 22, 14, INK); for (i = 0; i < st.lives; i++) x.drawImage(S.stand, 420 + i * 20, 32, 14, 18);
      if (st.banner > 0) { x.fillStyle = INK; x.fillRect(150, 190, 300, 54); txt(x, "ROOF " + (st.li + 1) + " · " + L.name.toUpperCase(), 300, 217, 17, BG, "center", "900"); }
      x.fillStyle = "rgba(42,29,6,.05)"; for (i = 0; i < SH; i += 3) x.fillRect(0, i, SW, 1);
    }
  };
  function frSprites() {
    var INK = "#2a1d06", BG = "#e9b949", S = {}, c, g;
    S.stand = bmp(["..###...", ".#####..", ".#.##.#.", ".#####..", "..###...", ".#####..", "#.###.#.", "..###...", "..#.#...", ".##.##.."], 3, INK);
    S.run = bmp(["..###...", ".#####..", ".#.##.#.", ".#####..", "..###...", "######..", "..###.#.", "..###...", ".#...#..", "##....##"], 3, INK);
    S.jump = bmp(["..###...", ".#####..", ".#.##.#.", ".#####..", "#.###.#.", ".#####..", "..###...", "..###...", ".#...#..", "#.....#."], 3, INK);
    S.goat = bmp(["#.......#.", "##.....###", ".#########", ".########.", ".########.", ".#.#..#.#.", ".#.#..#.#."], 3, INK);
    S.note = bmp(["####.", "#..##", "#...#", "#.#.#", "#...#", "#####"], 3, INK);
    S.pud = bmp(["..##..##", "########"], 3, INK);
    c = S.roof = mkCanvas(30, 30); g = c.getContext("2d"); g.fillStyle = INK; g.fillRect(0, 0, 30, 30); g.fillStyle = BG; g.fillRect(0, 5, 30, 2); g.fillRect(6, 13, 6, 9); g.fillRect(18, 13, 6, 9);
    c = S.wall = mkCanvas(30, 30); g = c.getContext("2d"); g.fillStyle = INK; g.fillRect(0, 0, 30, 30); g.fillStyle = BG; g.fillRect(6, 6, 6, 9); g.fillRect(18, 6, 6, 9); g.fillRect(6, 21, 6, 6); g.fillRect(18, 21, 6, 6);
    return S;
  }

  /* =====================================================================================================
     4. HARMATTAN PATROL — a prop plane over the savanna in harmattan season. Runaway kites, rogue survey
     drones and storm clouds; gusts of dusty wind shove everything sideways. Three stages, a boss each.
     ===================================================================================================== */
  var HP = { W: 360, H: 450, X0: 120 };
  // [time, kind (0 kite, 1 drone, 2 cloud), x, how many, seconds between]
  var HWAVES = [
    [[1, 0, 70, 4, .5], [4, 0, 290, 4, .5], [8, 1, 180, 1, 0], [11, 0, 120, 5, .4], [15, 1, 90, 2, 1.2], [19, 0, 250, 5, .4], [23, 2, 180, 1, 0], [28, 1, 270, 2, 1], [31, 0, 60, 6, .35], [36, 1, 180, 3, .9]],
    [[1, 1, 100, 2, .8], [4, 0, 200, 6, .35], [8, 2, 100, 1, 0], [10, 2, 260, 1, 0], [14, 1, 250, 3, .7], [18, 0, 80, 6, .3], [21, 0, 280, 6, .3], [25, 1, 180, 4, .6], [30, 2, 180, 1, 0], [34, 0, 150, 8, .3], [38, 1, 90, 3, .6]],
    [[1, 2, 90, 1, 0], [2, 2, 270, 1, 0], [5, 1, 180, 4, .5], [9, 0, 60, 8, .25], [12, 0, 300, 8, .25], [16, 1, 120, 4, .5], [20, 2, 180, 2, 2], [24, 1, 250, 5, .45], [29, 0, 180, 10, .22], [34, 2, 110, 2, 1.5], [38, 1, 200, 5, .4]]
  ];
  function hPool(n, f) { var a = []; for (var i = 0; i < n; i++) a.push(f()); return a; }
  function hGet(pool) { for (var i = 0; i < pool.length; i++) if (!pool[i].a) return pool[i]; return null; }
  function hShot(st, px, py, vx, vy) { var s = hGet(st.eb); if (s) { s.a = 1; s.x = px; s.y = py; s.vx = vx; s.vy = vy; } }
  function hFoe(st, k, px) { var f = hGet(st.foes); if (!f) return; f.a = 1; f.k = k; f.x = px; f.y = -24; f.t = 0; f.x0 = px; f.hp = k === 0 ? 1 : k === 1 ? 3 : 8; f.cd = k === 1 ? 1 : 1.6; f.tell = 0; f.ph = st.r() * TAU; }
  function hBoom(st, px, py, big) { var e = hGet(st.fx); if (e) { e.a = 1; e.x = px; e.y = py; e.t = 0; e.big = big; } }
  function hDrop(st, px, py, sure) { if (!sure && st.r() > .16) return; var k = hGet(st.pk); if (!k) return; var q = st.r(); k.a = 1; k.x = px; k.y = py; k.k = q < .55 ? 0 : q < .8 ? 1 : 2; }
  function hHurt(st) { var p = st.p; if (p.inv > 0) return; st.lives--; st.ev = "boom"; hBoom(st, p.x, p.y, 1); if (st.lives <= 0) { st.over = 1; st.won = 0; return; } p.inv = 2; p.pw = Math.max(1, p.pw - 1); }
  M.games.patrol = {
    id: "patrol", name: "Harmattan Patrol", tag: "Prop-plane shooter", accent: "#fb923c", levels: null, _: { HP: HP },
    how: ["Fly with the stick or arrows. Your guns fire by themselves.", "A or B drops a dust-buster bomb: it clears the sky around you. You carry three.", "Watch the wind arrow: a gust pushes you sideways. P powers up your guns, B is a bomb, + is a spare plane."],
    init: function (seed) {
      return { r: rng(seed), p: { x: 180, y: 380, inv: 1.5, pw: 1, cd: 0 }, lives: 3, bombs: 3, score: 0, stage: 0, t: 0, wi: 0, sub: 0, subT: 0, over: 0, won: 0, ev: "", scroll: 0, banner: 2, flash: 0,
        shots: hPool(48, function () { return { a: 0, x: 0, y: 0, vx: 0 }; }), foes: hPool(28, function () { return { a: 0, k: 0, x: 0, y: 0, x0: 0, t: 0, hp: 0, cd: 0, tell: 0, ph: 0 }; }), eb: hPool(90, function () { return { a: 0, x: 0, y: 0, vx: 0, vy: 0 }; }), pk: hPool(6, function () { return { a: 0, k: 0, x: 0, y: 0 }; }), fx: hPool(20, function () { return { a: 0, x: 0, y: 0, t: 0, big: 0 }; }),
        boss: { a: 0, hp: 0, max: 1, x: 180, y: -60, t: 0, cd: 2, pat: 0 }, wind: { t: 9, warn: 0, blow: 0, dir: 1 } };
    },
    step: function (st, I) {
      var dt = STEP, p = st.p, r = st.r, i, j, f, s, W = st.wind, B = st.boss, wx = 0; if (st.over) return; st.t += dt; st.scroll = (st.scroll + 46 * dt) % 900; if (st.banner > 0) st.banner -= dt; if (st.flash > 0) st.flash -= dt; if (p.inv > 0) p.inv -= dt;
      // wind gusts
      if (W.blow > 0) { W.blow -= dt; wx = W.dir * 58; } else if (W.warn > 0) { W.warn -= dt; if (W.warn <= 0) { W.blow = 3; st.ev = "dash"; } } else { W.t -= dt; if (W.t <= 0) { W.t = 11 + r() * 6; W.warn = 1.3; W.dir = r() < .5 ? -1 : 1; } }
      p.x = clamp(p.x + (I.x * 215 + wx) * dt, 16, HP.W - 16); p.y = clamp(p.y + I.y * 200 * dt, 60, HP.H - 22);
      p.cd -= dt; if (p.cd <= 0) { p.cd = .16; var n = p.pw; for (i = 0; i < n; i++) { s = hGet(st.shots); if (!s) break; s.a = 1; s.y = p.y - 16; s.x = p.x + (n === 1 ? 0 : n === 2 ? (i ? 8 : -8) : (i - 1) * 10); s.vx = n === 3 ? (i - 1) * 60 : 0; } }
      if ((I.ah || I.bh) && st.bombs > 0) { st.bombs--; st.flash = .5; p.inv = Math.max(p.inv, 1); st.ev = "boom"; for (i = 0; i < st.eb.length; i++) st.eb[i].a = 0; for (i = 0; i < st.foes.length; i++) { f = st.foes[i]; if (f.a) { f.hp -= 6; if (f.hp <= 0) { f.a = 0; st.score += [10, 30, 60][f.k]; hBoom(st, f.x, f.y, f.k === 2); } } } if (B.a) B.hp -= 20; }
      // the script for this stage, then its boss
      var wv = HWAVES[st.stage];
      if (st.wi < wv.length) { var w = wv[st.wi]; if (st.t >= w[0] + st.sub * w[4]) { hFoe(st, w[1], clamp(w[2] + (w[1] === 0 ? (st.sub % 2 ? 22 : -22) : st.sub * 46 - (w[3] - 1) * 23), 24, HP.W - 24)); st.sub++; if (st.sub >= w[3]) { st.sub = 0; st.wi++; } } }
      else if (!B.a && !B.done) { var any = 0; for (i = 0; i < st.foes.length; i++) if (st.foes[i].a) any = 1; if (!any) { B.a = 1; B.max = B.hp = [150, 230, 320][st.stage]; B.x = 180; B.y = -60; B.t = 0; B.cd = 2; B.pat = 0; st.banner = 1.6; st.ev = "whistle"; } }
      for (i = 0; i < st.foes.length; i++) { f = st.foes[i]; if (!f.a) continue; f.t += dt;
        if (f.k === 0) { f.y += 62 * dt; f.x = clamp(f.x0 + Math.sin(f.t * 2.2 + f.ph) * 48 + wx * f.t * .25, 14, HP.W - 14); if (st.stage > 0) { f.cd -= dt; if (f.cd <= 0) { f.cd = 99; hShot(st, f.x, f.y + 10, 0, 120); } } }
        else if (f.k === 1) { if (f.t < 7) { f.y += (90 + (i % 3) * 30 - f.y) * 2 * dt; f.x = clamp(f.x0 + Math.sin(f.t * 1.3 + f.ph) * 60, 20, HP.W - 20); f.cd -= dt; if (f.cd <= 0 && f.y > 30) { f.cd = 1.7 - st.stage * .25; var dx = p.x - f.x, dy = p.y - f.y, d = Math.sqrt(dx * dx + dy * dy) || 1; hShot(st, f.x, f.y + 8, dx / d * 172, dy / d * 172); if (st.stage > 0) hShot(st, f.x, f.y + 8, (dx / d * .94 - dy / d * .34) * 172, (dy / d * .94 + dx / d * .34) * 172); if (st.stage > 1) hShot(st, f.x, f.y + 8, (dx / d * .94 + dy / d * .34) * 172, (dy / d * .94 - dx / d * .34) * 172); } } else f.y -= 120 * dt; if (f.y < -40 && f.t > 7) f.a = 0; }
        else { f.y += 27 * dt; if (f.tell > 0) { f.tell -= dt; if (f.tell <= 0) { hShot(st, f.x, f.y + 20, 0, 300); hShot(st, f.x, f.y + 4, 0, 300); hShot(st, f.x, f.y - 12, 0, 300); st.ev = "zap"; } } else { f.cd -= dt; if (f.cd <= 0 && f.y > 20) { f.cd = 2.4; f.tell = .6; } } }
        if (f.y > HP.H + 30) f.a = 0;
        if (f.a && p.inv <= 0 && Math.abs(f.x - p.x) < (f.k === 2 ? 34 : 18) && Math.abs(f.y - p.y) < (f.k === 2 ? 24 : 18)) { hHurt(st); if (f.k < 2) f.a = 0; if (st.over) return; } }
      if (B.a) { B.t += dt; B.y += (78 - B.y) * 1.5 * dt; B.x = 180 + Math.sin(B.t * .7) * 110; B.cd -= dt;
        if (B.cd <= 0 && B.y > 40) { var pat = B.pat++ % 3, lowHp = B.hp < B.max * .4; B.cd = (lowHp ? .9 : 1.3) - st.stage * .12;
          if (pat === 0) { var nb = 8 + st.stage * 3, o = r() * TAU; for (j = 0; j < nb; j++) hShot(st, B.x, B.y, Math.cos(o + j / nb * TAU) * 132, Math.sin(o + j / nb * TAU) * 132); }
          else if (pat === 1) { var ax = Math.atan2(p.y - B.y, p.x - B.x), nf = 3 + st.stage; for (j = 0; j < nf; j++) { var an = ax + (j - (nf - 1) / 2) * .2; hShot(st, B.x, B.y + 16, Math.cos(an) * 195, Math.sin(an) * 195); } }
          else if (st.stage === 1) { hFoe(st, 0, clamp(B.x - 60, 24, 336)); hFoe(st, 0, clamp(B.x + 60, 24, 336)); } else for (j = 0; j < 5 + st.stage; j++) hShot(st, 20 + r() * 320, B.y + 10, 0, 150 + r() * 70);
          st.ev = "laser"; }
        if (p.inv <= 0 && Math.abs(B.x - p.x) < 50 && Math.abs(B.y - p.y) < 34) { hHurt(st); if (st.over) return; }
        if (B.hp <= 0) { B.a = 0; st.score += 400 * (st.stage + 1); hBoom(st, B.x, B.y, 1); hBoom(st, B.x - 30, B.y + 10, 1); hBoom(st, B.x + 30, B.y - 8, 1); st.ev = "special"; for (i = 0; i < st.eb.length; i++) st.eb[i].a = 0; if (st.stage >= 2) { st.over = 1; st.won = 1; return; } st.stage++; st.t = 0; st.wi = 0; st.sub = 0; st.banner = 2.4; if (st.bombs < 3) st.bombs++; } }
      for (i = 0; i < st.shots.length; i++) { s = st.shots[i]; if (!s.a) continue; s.y -= 520 * dt; s.x += s.vx * dt; if (s.y < -10) { s.a = 0; continue; }
        if (B.a && Math.abs(s.x - B.x) < 52 && Math.abs(s.y - B.y) < 30) { s.a = 0; B.hp--; st.score += 2; continue; }
        for (j = 0; j < st.foes.length; j++) { f = st.foes[j]; if (!f.a) continue; if (Math.abs(s.x - f.x) < (f.k === 2 ? 34 : 16) && Math.abs(s.y - f.y) < (f.k === 2 ? 22 : 16)) { s.a = 0; f.hp--; if (f.hp <= 0) { f.a = 0; st.score += [10, 30, 60][f.k]; hBoom(st, f.x, f.y, f.k === 2); hDrop(st, f.x, f.y, f.k === 2); st.ev = "hit"; } break; } } }
      for (i = 0; i < st.eb.length; i++) { s = st.eb[i]; if (!s.a) continue; s.x += (s.vx + wx * .4) * dt; s.y += s.vy * dt; if (s.y > HP.H + 10 || s.y < -20 || s.x < -10 || s.x > HP.W + 10) { s.a = 0; continue; } if (p.inv <= 0 && Math.abs(s.x - p.x) < 7 && Math.abs(s.y - p.y) < 9) { s.a = 0; hHurt(st); if (st.over) return; } }
      for (i = 0; i < st.pk.length; i++) { s = st.pk[i]; if (!s.a) continue; s.y += 72 * dt; if (s.y > HP.H + 16) { s.a = 0; continue; } if (Math.abs(s.x - p.x) < 20 && Math.abs(s.y - p.y) < 20) { s.a = 0; st.ev = "power"; st.score += 20; if (s.k === 0) p.pw = Math.min(3, p.pw + 1); else if (s.k === 1) st.bombs = Math.min(5, st.bombs + 1); else st.lives = Math.min(5, st.lives + 1); } }
      for (i = 0; i < st.fx.length; i++) { s = st.fx[i]; if (s.a) { s.t += dt; if (s.t > .45) s.a = 0; } }
    },
    result: function (st) { return { won: !!st.won, score: st.score, line: st.won ? "Three stages cleared. The sky is yours." : "Went down on stage " + (st.stage + 1) }; },
    reward: function (st) { var s = st.score; return { cash: (s >= 1000 ? 40 : 0) + (s >= 3000 ? 80 : 0) + (s >= 6000 ? 120 : 0) + (st.won ? 200 : 0), xp: (s >= 1000 ? 5 : 0) + (s >= 3000 ? 9 : 0) + (s >= 6000 ? 14 : 0) + (st.won ? 25 : 0) }; },
    side: function (st) { return ["Score " + st.score, "Stage " + (st.stage + 1) + " of 3", "Planes " + st.lives + " · Bombs " + st.bombs]; },
    draw: function (x, st, t) {
      var S = M._hs || (M._hs = hSprites()), p = st.p, i, s, f, B = st.boss, W = st.wind, X0 = HP.X0;
      x.fillStyle = "#1b1410"; x.fillRect(0, 0, SW, SH); x.save(); x.beginPath(); x.rect(X0, 0, HP.W, HP.H); x.clip(); x.translate(X0, 0);
      var sc = Math.floor(st.scroll); x.drawImage(S.bg, 0, sc - 900); x.drawImage(S.bg, 0, sc);
      for (i = 0; i < st.pk.length; i++) { s = st.pk[i]; if (!s.a) continue; x.fillStyle = ["#22c55e", "#f97316", "#ef4444"][s.k]; rr(x, s.x - 11, s.y - 11, 22, 22, 6); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 2; x.stroke(); txt(x, ["P", "B", "+"][s.k], s.x, s.y + 1, 14, "#fff", "center", "900"); }
      for (i = 0; i < st.foes.length; i++) { f = st.foes[i]; if (!f.a) continue; if (f.k === 0) { x.save(); x.translate(f.x, f.y); x.rotate(Math.sin(f.t * 2.2 + f.ph) * .3); x.drawImage(S.kite, -14, -18); x.restore(); } else if (f.k === 1) { x.drawImage(S.drone, f.x - 18, f.y - 18); x.fillStyle = "rgba(255,255,255,.5)"; var a = t * 30; x.fillRect(f.x - 16 + Math.cos(a) * 5, f.y - 14, 2, 2); x.fillRect(f.x + 14 + Math.cos(a) * 5, f.y + 12, 2, 2); } else { x.drawImage(S.cloud, f.x - 44, f.y - 28); if (f.tell > 0) { x.fillStyle = "rgba(253,224,71," + (.25 + .4 * Math.sin(t * 40) * Math.sin(t * 40)) + ")"; x.fillRect(f.x - 3, f.y + 20, 6, HP.H); } } }
      if (B.a) { x.drawImage(S.boss[st.stage], B.x - 64, B.y - 42); x.fillStyle = "rgba(0,0,0,.5)"; x.fillRect(40, 12, 280, 8); x.fillStyle = "#ef4444"; x.fillRect(40, 12, 280 * clamp(B.hp / B.max, 0, 1), 8); }
      x.fillStyle = "#fff59d"; for (i = 0; i < st.shots.length; i++) { s = st.shots[i]; if (s.a) x.fillRect(s.x - 1.5, s.y - 7, 3, 12); }
      for (i = 0; i < st.eb.length; i++) { s = st.eb[i]; if (!s.a) continue; x.fillStyle = "#7c2d12"; x.fillRect(s.x - 5, s.y - 5, 10, 10); x.fillStyle = "#fdba74"; x.fillRect(s.x - 3, s.y - 3, 6, 6); }
      for (i = 0; i < st.fx.length; i++) { s = st.fx[i]; if (!s.a) continue; var k = s.t / .45, rad = (s.big ? 46 : 22) * k; x.fillStyle = "rgba(255,237,160," + (1 - k) + ")"; x.beginPath(); x.arc(s.x, s.y, rad, 0, TAU); x.fill(); x.fillStyle = "rgba(234,88,12," + (1 - k) * .8 + ")"; x.beginPath(); x.arc(s.x, s.y, rad * .6, 0, TAU); x.fill(); }
      if (p.inv <= 0 || Math.floor(t * 14) % 2) { x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.ellipse(p.x + 14, p.y + 20, 16, 7, 0, 0, TAU); x.fill(); x.drawImage(S.plane, p.x - 22, p.y - 22); x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(p.x, p.y - 20, 12, 2.5 + Math.sin(t * 50), 0, 0, TAU); x.fill(); }
      x.fillStyle = "rgba(214,178,120,.16)"; x.fillRect(0, 0, HP.W, HP.H);
      if (W.blow > 0) { x.fillStyle = "rgba(240,214,170,.35)"; for (i = 0; i < 14; i++) { var yy = (i * 37 + 11) % HP.H, xx = ((t * 520 * W.dir + i * 97) % (HP.W + 120) + HP.W + 120) % (HP.W + 120) - 60; x.fillRect(xx, yy, 46, 2); } }
      if (W.warn > 0 || W.blow > 0) txt(x, W.dir > 0 ? "WIND  ➜➜" : "⬅⬅  WIND", 180, 40, 16, W.warn > 0 && Math.floor(t * 8) % 2 ? "#fff" : "#fde047", "center", "900");
      if (st.flash > 0) { x.fillStyle = "rgba(255,255,255," + st.flash * 1.4 + ")"; x.fillRect(0, 0, HP.W, HP.H); }
      if (st.banner > 0) { x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(0, 190, HP.W, 50); txt(x, B.a ? ["DUST DEVIL", "THE KITE KING", "THUNDERHEAD"][st.stage] : "STAGE " + (st.stage + 1) + " · " + ["Dry river", "Groundnut fields", "Storm front"][st.stage], 180, 215, 20, "#fde047", "center", "900"); }
      x.restore();
      txt(x, "SCORE", 14, 30, 12, "#fdba74"); txt(x, String(st.score), 14, 54, 22, "#fff", "left", "900"); txt(x, "STAGE " + (st.stage + 1), 14, 90, 13, "#fde68a"); txt(x, "PLANES", 494, 30, 12, "#fdba74"); for (i = 0; i < st.lives; i++) x.drawImage(S.plane, 494 + i * 20, 40, 18, 18); txt(x, "BOMBS", 494, 84, 12, "#fdba74"); x.fillStyle = "#f97316"; for (i = 0; i < st.bombs; i++) { x.beginPath(); x.arc(502 + i * 18, 104, 6, 0, TAU); x.fill(); } txt(x, "GUNS " + "▮▮▮".slice(0, p.pw), 494, 136, 13, "#86efac");
    }
  };
  function hSprites() {
    var S = {}, c, g, i, r = rng(7);
    c = S.bg = mkCanvas(360, 900); g = c.getContext("2d"); g.fillStyle = "#c9a468"; g.fillRect(0, 0, 360, 900);
    for (i = 0; i < 60; i++) { g.fillStyle = ["#bf9a5c", "#d2b078", "#b8915a"][i % 3]; g.beginPath(); g.ellipse(r() * 360, r() * 900, 30 + r() * 50, 14 + r() * 24, r() * 3, 0, TAU); g.fill(); }
    g.strokeStyle = "#a9c3c9"; g.lineWidth = 16; g.beginPath(); g.moveTo(40, 0); g.bezierCurveTo(200, 200, 60, 420, 220, 640); g.bezierCurveTo(300, 760, 120, 820, 40, 900); g.stroke(); g.strokeStyle = "#e3cc9e"; g.lineWidth = 26; g.globalCompositeOperation = "destination-over"; g.stroke(); g.globalCompositeOperation = "source-over";
    for (i = 0; i < 6; i++) { var fx = 200 + (i % 2) * 70, fy = 60 + i * 140; g.fillStyle = i % 2 ? "#8fa35a" : "#a7b56b"; g.fillRect(fx, fy, 60, 44); g.fillStyle = "rgba(0,0,0,.12)"; for (var q = 0; q < 6; q++) g.fillRect(fx + q * 10, fy, 2, 44); }
    for (i = 0; i < 46; i++) { var tx = r() * 360, ty = r() * 900; g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(tx + 5, ty + 5, 11, 7, 0, 0, TAU); g.fill(); g.fillStyle = "#5f7a3a"; g.beginPath(); g.ellipse(tx, ty, 11, 8, 0, 0, TAU); g.fill(); g.fillStyle = "#789447"; g.beginPath(); g.ellipse(tx - 3, ty - 2, 5, 3, 0, 0, TAU); g.fill(); }
    c = S.plane = mkCanvas(44, 44); g = c.getContext("2d"); g.fillStyle = "#e5e7eb"; g.fillRect(2, 16, 40, 9); g.fillStyle = "#0f766e"; g.fillRect(2, 16, 8, 9); g.fillRect(34, 16, 8, 9); g.fillStyle = "#f8fafc"; g.beginPath(); g.ellipse(22, 22, 5.5, 19, 0, 0, TAU); g.fill(); g.fillStyle = "#e5e7eb"; g.fillRect(13, 36, 18, 5); g.fillStyle = "#0ea5e9"; g.beginPath(); g.ellipse(22, 16, 3.5, 6, 0, 0, TAU); g.fill(); g.fillStyle = "#f59e0b"; g.fillRect(19, 2, 6, 4);
    c = S.kite = mkCanvas(28, 46); g = c.getContext("2d"); g.fillStyle = "#dc2626"; g.beginPath(); g.moveTo(14, 0); g.lineTo(28, 16); g.lineTo(14, 34); g.lineTo(0, 16); g.closePath(); g.fill(); g.fillStyle = "#fde047"; g.beginPath(); g.moveTo(14, 0); g.lineTo(28, 16); g.lineTo(14, 16); g.closePath(); g.fill(); g.strokeStyle = "#1f2937"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, 0); g.lineTo(14, 34); g.moveTo(0, 16); g.lineTo(28, 16); g.moveTo(14, 34); g.quadraticCurveTo(20, 40, 12, 46); g.stroke();
    c = S.drone = mkCanvas(36, 36); g = c.getContext("2d"); g.strokeStyle = "#111827"; g.lineWidth = 4; g.beginPath(); g.moveTo(5, 5); g.lineTo(31, 31); g.moveTo(31, 5); g.lineTo(5, 31); g.stroke(); g.fillStyle = "#374151"; [[5, 5], [31, 5], [5, 31], [31, 31]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 5, 0, TAU); g.fill(); }); g.fillStyle = "#1f2937"; rr(g, 11, 11, 14, 14, 4); g.fill(); g.fillStyle = "#ef4444"; g.beginPath(); g.arc(18, 18, 3, 0, TAU); g.fill();
    c = S.cloud = mkCanvas(88, 56); g = c.getContext("2d"); g.fillStyle = "#3f3f46"; [[24, 34, 22], [46, 24, 24], [66, 34, 20], [44, 40, 24]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2] * .8, 0, TAU); g.fill(); }); g.fillStyle = "#52525b"; [[30, 28, 12], [50, 20, 13]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, TAU); g.fill(); }); g.fillStyle = "#fde047"; g.beginPath(); g.moveTo(46, 34); g.lineTo(38, 46); g.lineTo(44, 46); g.lineTo(40, 56); g.lineTo(52, 42); g.lineTo(46, 42); g.closePath(); g.fill();
    S.boss = [0, 1, 2].map(function (k) { var b = mkCanvas(128, 84), q = b.getContext("2d"), j; if (k === 0) { for (j = 0; j < 6; j++) { q.fillStyle = j % 2 ? "#b08a55" : "#8f6d3f"; q.beginPath(); q.ellipse(64, 12 + j * 12, 56 - j * 8, 9, 0, 0, TAU); q.fill(); } q.fillStyle = "#3b2a1c"; q.beginPath(); q.arc(48, 22, 5, 0, TAU); q.arc(80, 22, 5, 0, TAU); q.fill(); } else if (k === 1) { q.fillStyle = "#7c3aed"; q.beginPath(); q.moveTo(64, 0); q.lineTo(126, 36); q.lineTo(64, 84); q.lineTo(2, 36); q.closePath(); q.fill(); q.fillStyle = "#fde047"; q.beginPath(); q.moveTo(64, 0); q.lineTo(126, 36); q.lineTo(64, 36); q.closePath(); q.fill(); q.fillStyle = "#facc15"; q.fillRect(44, 20, 40, 7); [44, 60, 77].forEach(function (cx) { q.beginPath(); q.moveTo(cx, 20); q.lineTo(cx + 4, 8); q.lineTo(cx + 8, 20); q.fill(); }); q.fillStyle = "#111827"; q.beginPath(); q.arc(52, 40, 5, 0, TAU); q.arc(76, 40, 5, 0, TAU); q.fill(); } else { q.fillStyle = "#27272a"; [[30, 50, 28], [64, 34, 34], [98, 50, 28], [64, 56, 30]].forEach(function (p) { q.beginPath(); q.arc(p[0], p[1], p[2], 0, TAU); q.fill(); }); q.fillStyle = "#fde047"; q.beginPath(); q.arc(50, 44, 6, 0, TAU); q.arc(80, 44, 6, 0, TAU); q.fill(); q.fillStyle = "#facc15"; q.fillRect(54, 60, 22, 5); } return b; });
    return S;
  }

  /* =====================================================================================================
     5. AYO — the sowing game played on carved boards all over West Africa (the Abapa rules).
     Twelve houses, four seeds each. Sow anticlockwise; if your last seed makes two or three in an
     opponent's house you take them, and any unbroken run of twos and threes behind it. 25 wins.
     ===================================================================================================== */
  var AY = { stack: [] }; (function () { for (var i = 0; i < 12; i++) AY.stack.push(new Int8Array(12)); })();
  function ayLegal(b, who, out) { // fills out[0..n) with the houses `who` may play; returns n
    var base = who * 6, ob = (1 - who) * 6, i, n = 0, opp = 0; for (i = 0; i < 6; i++) opp += b[ob + i];
    for (i = 0; i < 6; i++) { var s = b[base + i]; if (!s) continue; if (opp === 0 && s < 6 - i) continue; out[n++] = base + i; } return n;
  }
  function ayApply(b, pit, who) { // sows and captures in place; returns seeds captured
    var n = b[pit], i = pit, ob = (1 - who) * 6, cap = 0, j, left = 0; b[pit] = 0;
    while (n > 0) { i = (i + 1) % 12; if (i === pit) continue; b[i]++; n--; }
    if (i >= ob && i < ob + 6 && (b[i] === 2 || b[i] === 3)) {
      for (j = i; j >= ob && (b[j] === 2 || b[j] === 3); j--) cap += b[j];
      for (j = ob; j < ob + 6; j++) left += b[j];
      if (cap === left) return 0; // a grand slam captures nothing
      for (j = i; j >= ob && (b[j] === 2 || b[j] === 3); j--) b[j] = 0;
    }
    return cap;
  }
  function aySearch(b, who, depth, alpha, beta, me, diff) { // negamax on score difference from `me`
    var buf = AY.buf || (AY.buf = []), moves = buf[depth] || (buf[depth] = new Int8Array(6)), n = ayLegal(b, who, moves), i, best = -99, c = AY.stack[depth];
    if (!n) { var rest = 0; for (i = 0; i < 12; i++) rest += b[i]; var v0 = diff + (who === me ? -rest : rest); return who === me ? v0 : -v0; } // the stuck player loses what is left
    if (depth === 0) return who === me ? diff : -diff;
    for (i = 0; i < n; i++) { c.set(b); var cap = ayApply(c, moves[i], who), v = -aySearch(c, 1 - who, depth - 1, -beta, -alpha, me, diff + (who === me ? cap : -cap)); if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break; }
    return best;
  }
  function ayBest(st, who) {
    var moves = st.mv, n = ayLegal(st.b, who, moves), best = -999, pick = -1, depth = [1, 3, 6][st.lvl], c = AY.stack[11], i;
    for (i = 0; i < n; i++) { c.set(st.b); var cap = ayApply(c, moves[i], who), v = -aySearch(c, 1 - who, depth, -99, 99, who, cap) + st.r() * (st.lvl === 0 ? 3 : .2); if (v > best) { best = v; pick = moves[i]; } }
    return pick;
  }
  function ayEnd(st) { var b = st.b, i, a = 0, o = 0; for (i = 0; i < 6; i++) { a += b[i]; o += b[6 + i]; b[i] = b[6 + i] = 0; } st.sc[0] += a; st.sc[1] += o; st.over = 1; st.won = st.sc[0] > st.sc[1]; st.draw = st.sc[0] === st.sc[1]; }
  function ayPlay(st, pit) {
    var who = st.turn, cap = ayApply(st.b, pit, who); st.sc[who] += cap; st.last = pit; st.lastCap = cap; st.plies++; st.quiet = cap ? 0 : st.quiet + 1; st.ev = cap ? "coin" : "click"; st.turn = 1 - who;
    if (st.sc[0] >= 25 || st.sc[1] >= 25) { st.over = 1; st.won = st.sc[0] > st.sc[1]; return; }
    if (!ayLegal(st.b, st.turn, st.mv) || st.quiet >= 80 || st.plies >= 400) ayEnd(st); // nobody can move, or the game has gone round in circles: each side keeps what is in its houses
    else if (st.turn === 1) st.wait = .9;
  }
  M.games.ayo = {
    id: "ayo", name: "Ayo", tag: "The sowing board game", accent: "#a3e635", levels: ["Beginner", "Regular", "Elder"], _: { legal: ayLegal, apply: ayApply, best: ayBest, play: ayPlay },
    how: ["Pick one of your six houses (bottom row) with left and right, then A. Its seeds are sown one by one, anticlockwise.", "If your last seed makes two or three in one of their houses, you take them — and any twos and threes just behind it.", "If they have no seeds you must feed them. First to 25 of the 48 seeds wins."],
    init: function (seed, lvl, o) { var b = new Int8Array(12); for (var i = 0; i < 12; i++) b[i] = 4; return { r: rng(seed), lvl: lvl, b: b, sc: [0, 0], turn: 0, sel: 2, wait: 0, mv: new Int8Array(6), last: -1, lastCap: 0, plies: 0, quiet: 0, tap: -1, over: 0, won: 0, draw: 0, ev: "", t: 0, opp: (o && o.opponent) || ["Baba Sule", "Mama Nkechi", "Malam Garba"][lvl] }; },
    step: function (st, I) {
      if (st.over) return; st.t += STEP;
      if (st.turn === 1) { st.wait -= STEP; if (st.wait <= 0) ayPlay(st, ayBest(st, 1)); return; }
      if (I.lh) st.sel = (st.sel + 5) % 6; if (I.rh) st.sel = (st.sel + 1) % 6; if (st.tap >= 0) { st.sel = st.tap; }
      if (I.ah || st.tap >= 0) { st.tap = -1; var n = ayLegal(st.b, 0, st.mv), ok = false; for (var i = 0; i < n; i++) if (st.mv[i] === st.sel) ok = true; if (ok) ayPlay(st, st.sel); else st.ev = "block"; }
    },
    click: function (st, lx, ly) { if (ly > 235 && ly < 325) { var i = Math.round((lx - 105) / 78); if (i >= 0 && i < 6) st.tap = i; } },
    result: function (st) { return { won: !!st.won, score: st.sc[0] * 10 * (st.lvl + 1), line: (st.draw ? "A draw with " : st.won ? "You beat " : "You lost to ") + st.opp + " " + st.sc[0] + "–" + st.sc[1] }; },
    reward: function (st) { return st.won ? { cash: [60, 120, 220][st.lvl], xp: [8, 15, 28][st.lvl] } : { cash: 0, xp: 3 }; },
    side: function (st) { return ["You " + st.sc[0], st.opp + " " + st.sc[1], st.turn === 0 ? "Your turn" : "Thinking…"]; },
    draw: function (x, st, t) {
      var S = M._ay || (M._ay = aySprites()), b = st.b, i, n = st.turn === 0 && !st.over ? ayLegal(b, 0, st.mv) : 0;
      x.fillStyle = "#14532d"; x.fillRect(0, 0, SW, SH); x.fillStyle = "rgba(0,0,0,.15)"; for (i = 0; i < 20; i++) x.fillRect(0, i * 24, SW, 10);
      x.drawImage(S.board, 30, 110);
      for (i = 0; i < 12; i++) { var px = i < 6 ? 105 + i * 78 : 105 + (11 - i) * 78, py = i < 6 ? 280 : 180, legal = false; for (var q = 0; q < n; q++) if (st.mv[q] === i) legal = true;
        if (i === st.last) { x.strokeStyle = "#fde047"; x.lineWidth = 3; x.beginPath(); x.arc(px, py, 35, 0, TAU); x.stroke(); }
        if (i < 6 && st.turn === 0 && !st.over) { if (i === st.sel) { x.strokeStyle = legal ? "#fff" : "#f87171"; x.lineWidth = 4; x.beginPath(); x.arc(px, py, 37 + Math.sin(t * 6) * 1.5, 0, TAU); x.stroke(); } else if (!legal) { x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.arc(px, py, 33, 0, TAU); x.fill(); } }
        var c = b[i], k; for (k = 0; k < Math.min(c, 12); k++) x.drawImage(S.seed, px + S.off[k * 2] - 7, py + S.off[k * 2 + 1] - 6);
        txt(x, String(c), px, i < 6 ? py + 50 : py - 50, 15, "#fef3c7", "center", "900"); }
      txt(x, st.opp.toUpperCase() + "  " + st.sc[1], 300, 62, 20, "#d9f99d", "center", "900"); txt(x, "YOU  " + st.sc[0], 300, 400, 22, "#fff", "center", "900");
      x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(200, 78, 200, 6); x.fillRect(200, 418, 200, 6); x.fillStyle = "#a3e635"; x.fillRect(200, 78, 200 * Math.min(1, st.sc[1] / 25), 6); x.fillRect(200, 418, 200 * Math.min(1, st.sc[0] / 25), 6);
       txt(x, "sowing goes this way  ➜", 300, 352, 11, "rgba(254,243,199,.6)", "center"); if (!st.over) txt(x, st.turn === 0 ? "Your turn: choose a house" : st.opp + " is thinking…", 300, 26, 14, "#fef9c3", "center"); if (st.lastCap) txt(x, "+" + st.lastCap + " taken", 520, 230, 16, "#fde047", "center", "900");
    }
  };
  function aySprites() {
    var S = {}, c = S.board = mkCanvas(540, 240), g = c.getContext("2d"), i, r = rng(3);
    g.fillStyle = "rgba(0,0,0,.35)"; rr(g, 6, 10, 534, 230, 40); g.fill(); g.fillStyle = "#8b5a2b"; rr(g, 0, 0, 534, 226, 40); g.fill(); g.strokeStyle = "rgba(60,30,10,.35)"; g.lineWidth = 2; for (i = 0; i < 9; i++) { g.beginPath(); g.moveTo(10, 20 + i * 24); g.bezierCurveTo(180, 10 + i * 24, 360, 34 + i * 24, 524, 18 + i * 24); g.stroke(); }
    for (i = 0; i < 12; i++) { var px = 75 + (i % 6) * 78, py = i < 6 ? 70 : 170; g.fillStyle = "#4a2c12"; g.beginPath(); g.arc(px, py, 33, 0, TAU); g.fill(); g.fillStyle = "#5e3a1a"; g.beginPath(); g.arc(px, py + 3, 30, 0, TAU); g.fill(); }
    c = S.seed = mkCanvas(14, 12); g = c.getContext("2d"); g.fillStyle = "#cbd5e1"; g.beginPath(); g.ellipse(7, 6, 6.5, 5.5, 0, 0, TAU); g.fill(); g.fillStyle = "#f8fafc"; g.beginPath(); g.ellipse(5, 4, 2.5, 1.8, 0, 0, TAU); g.fill();
    S.off = []; for (i = 0; i < 12; i++) { var a = i * 2.4 + r(), d = i === 0 ? 0 : 8 + (i % 3) * 6; S.off.push(Math.cos(a) * d, Math.sin(a) * d); }
    return S;
  }

  /* =====================================================================================================
     The cabinet: picking a game, the how-to card, pause, results, coins, rewards and high scores.
     ===================================================================================================== */
  var ORDER = ["tabletennis", "kola", "run", "patrol", "ayo"], cur = null, seedN = 0;
  var IN = { x: 0, y: 0, l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, lh: 0, rh: 0, uh: 0, dh: 0, ah: 0, bh: 0 }, prev = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, m: 0 }, pend = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, m: 0 };
  var BOARD = { tabletennis: [["Sadiq", 340], ["Zainab", 260], ["Chidi", 150], ["Bolaji", 90]], kola: [["Amaka", 5200], ["Yakubu", 3100], ["Kelechi", 1500], ["Tunde", 600]], run: [["Fatima", 1900], ["Emeka", 1300], ["Bello", 800], ["Ada", 350]], patrol: [["Ibrahim", 7400], ["Ngozi", 4200], ["Musa", 2500], ["Halima", 1100]], ayo: [["Malam Garba", 500], ["Mama Nkechi", 380], ["Baba Sule", 250], ["Sadiq", 120]] };
  function sfx(n) { try { if (Z.api && Z.api.sound) Z.api.sound.sfx(n); } catch (e) {} }
  function dn(n) { try { return Z.api && Z.api.down(n) ? 1 : 0; } catch (e) { return 0; } }
  function book(P) { var m = P.mini; if (!m || typeof m !== "object") m = P.mini = {}; if (!m.best || typeof m.best !== "object") m.best = {}; if (!(m.plays >= 0)) m.plays = 0; if (m.day !== P.day) { m.day = P.day; m.cash = 0; m.xp = 0; } if (!(m.cash >= 0)) m.cash = 0; if (!(m.xp >= 0)) m.xp = 0; return m; }
  M.list = function () { return ORDER.map(function (id) { var g = M.games[id]; return { id: id, name: g.name, tag: g.tag, best: M.best(id) }; }); };
  M.best = function (id) { var P = Z.P; return P && P.mini && P.mini.best && P.mini.best[id] || 0; };
  M.active = function () { return !!cur; };
  M.state = function () { return cur ? cur.st : null; }; M.screen = function () { return cur ? cur.state : ""; };
  M.board = function (id) { var NM = null; try { var D = root.SamaruData; if (D && D.NAMES && D.NAMES.length >= 4) NM = D.NAMES; } catch (e) {} // friends' first names when the game data has them
    var off = ORDER.indexOf(id) * 3, rows = (BOARD[id] || []).map(function (r, i) { return { name: NM ? String(NM[(off + i) % NM.length]) : r[0], score: r[1], me: false }; }), b = M.best(id); if (b) rows.push({ name: (Z.P && Z.P.name) || "You", score: b, me: true }); rows.sort(function (a, c) { return c.score - a.score; }); return rows.slice(0, 5); };
  M.open = function (id, opts) {
    if ((id != null && !M.games[id]) || !Z.P) return false;
    opts = opts || {}; cur = { g: id ? M.games[id] : null, opts: opts, state: id ? "card" : "pick", sel: 0, lvl: opts.level || 0, st: null, acc: 0, t: 0, res: null, paid: false, fee: opts.free ? 0 : (opts.fee != null ? opts.fee : M.FEE), from: id ? "direct" : "pick", note: "" };
    if (id) cur.sel = ORDER.indexOf(id); touchReset(); wire(); try { if (Z.touch && Z.touch.active) M.touchMode = true; if (Z.touch && Z.touch.refresh) Z.touch.refresh(); } catch (e) {} // the world's own sticks and buttons step aside
    try { var top = document.querySelector("[data-gm-canvas]"), w3 = top && top.previousElementSibling; if (w3 && w3.tagName === "CANVAS") { M._w3 = w3; w3.style.visibility = "hidden"; } } catch (e) {} // and the frozen 3D world does not show round the cabinet prev.a = prev.b = prev.m = prev.l = prev.r = prev.u = prev.d = 1; pend.a = pend.b = pend.m = pend.l = pend.r = pend.u = pend.d = 0; M._frame = null; sfx("power"); return true;
  };
  M.close = function () { if (!cur) return; cur = null; touchReset(); if (M._w3) { M._w3.style.visibility = ""; M._w3 = null; } try { if (Z.touch && Z.touch.refresh) Z.touch.refresh(); } catch (e) {} try { if (Z.save) Z.save(); } catch (e) {} };
  function start() {
    var P = Z.P, g = cur.g; if (cur.fee && P.money < cur.fee) { cur.note = "You need ₦" + cur.fee + " for a coin."; sfx("block"); return; }
    if (cur.fee) P.money -= cur.fee; book(P).plays++; cur.note = ""; cur.st = g.init((P.day * 7919 + (++seedN) * 104729 + Math.floor((P.time || 0) * 13) + (cur.opts.seed || 0)) >>> 0, g.levels ? cur.lvl : 0, cur.opts); cur.state = "play"; cur.acc = 0; cur.res = null; sfx("click");
  }
  function finish() {
    var P = Z.P, g = cur.g, st = cur.st, res = g.result(st), m = book(P), rw = g.reward(st), cash = Math.max(0, Math.min(rw.cash || 0, M.CAP_CASH - m.cash)), xp = Math.max(0, Math.min(rw.xp || 0, M.CAP_XP - m.xp));
    res.record = res.score > (m.best[g.id] || 0); if (res.record) m.best[g.id] = res.score; m.cash += cash; m.xp += xp; P.money += cash; res.cash = cash; res.xp = xp; res.capped = (rw.cash || 0) > cash || (rw.xp || 0) > xp;
    try { var S = root.SamaruSim; if (xp) { if (S && S.addXp) S.addXp(P, xp); else P.xp = (P.xp || 0) + xp; } } catch (e) {}
    try { if (Z.story && Z.story.miniResult) Z.story.miniResult(g.id, res); } catch (e3) {}
    cur.res = res; cur.state = "over"; cur.sel = 0; sfx(res.won ? "win" : res.record ? "special" : "lose"); try { if (Z.save) Z.save(); } catch (e2) {}
  }
  M.grant = function (g, st) { cur = cur || { g: g, st: st, opts: {}, fee: 0 }; cur.g = g; cur.st = st; finish(); return cur.res; }; // for tests
  function readInput() {
    var s = Z.stick, sx = s ? s.x || 0 : 0, sy = s ? s.y || 0 : 0, l = dn("left") || sx < -.45 ? 1 : 0, r = dn("right") || sx > .45 ? 1 : 0, u = dn("up") || sy < -.45 ? 1 : 0, d = dn("down") || sy > .45 ? 1 : 0, a = dn("jump") || dn("act") ? 1 : 0, b = dn("attack") || dn("throw") ? 1 : 0, m = dn("phone");
    if (TB.l) l = 1; if (TB.r) r = 1; if (TB.u) u = 1; if (TB.d) d = 1; if (TB.a) a = 1; if (TB.b) b = 1;
    IN.x = clamp(dn("right") - dn("left") + (TB.r ? 1 : 0) - (TB.l ? 1 : 0) + (Math.abs(sx) > .18 ? sx : 0), -1, 1); IN.y = clamp(dn("down") - dn("up") + (TB.d ? 1 : 0) + (Math.abs(sy) > .18 ? sy : 0), -1, 1);
    if (TD.on && cur && cur.st && cur.state === "play") dragInput(cur.g.id, cur.st); IN.l = l; IN.r = r; IN.u = u; IN.d = d; IN.a = a; IN.b = b;
    if (l && !prev.l) pend.l = 1; if (r && !prev.r) pend.r = 1; if (u && !prev.u) pend.u = 1; if (d && !prev.d) pend.d = 1; if (a && !prev.a) pend.a = 1; if (b && !prev.b) pend.b = 1; if (m && !prev.m) pend.m = 1;
    prev.l = l; prev.r = r; prev.u = u; prev.d = d; prev.a = a; prev.b = b; prev.m = m;
  }
  function take() { if (TQ.x > 0) { pend.r = 1; TQ.x--; } else if (TQ.x < 0) { pend.l = 1; TQ.x++; } IN.lh = pend.l; IN.rh = pend.r; IN.uh = pend.u; IN.dh = pend.d; IN.ah = pend.a; IN.bh = pend.b; var m = pend.m; pend.l = pend.r = pend.u = pend.d = pend.a = pend.b = pend.m = 0; return m; }
  function back() { if (cur.from === "pick" && cur.state !== "pick") { cur.state = "pick"; cur.g = null; cur.st = null; cur.note = ""; M._frame = null; sfx("click"); } else M.close(); }
  function choose(i) { cur.sel = i; cur.g = M.games[ORDER[i]]; cur.lvl = 0; cur.state = "card"; cur.note = ""; M._frame = null; sfx("click"); }
  M.update = function (dt) {
    if (!cur) return; cur.t += dt; try { if (Z.touch && Z.touch.step) Z.touch.step(dt); } catch (e) {}
    readInput(); var g = cur.g, menu;
    if (cur.state === "play") {
      if (pend.m) { take(); cur.state = "pause"; cur.sel = 0; sfx("click"); return; }
      cur.acc = Math.min(cur.acc + dt, .1);
      while (cur.acc >= STEP && cur.state === "play") { cur.acc -= STEP; take(); g.step(cur.st, IN); IN.lh = IN.rh = IN.uh = IN.dh = IN.ah = IN.bh = 0; if (cur.st.ev) { sfx(cur.st.ev); cur.st.ev = ""; } if (cur.st.over) finish(); }
      return;
    }
    menu = take();
    if (cur.state === "pick") { if (IN.uh) cur.sel = (cur.sel + ORDER.length - 1) % ORDER.length; if (IN.dh) cur.sel = (cur.sel + 1) % ORDER.length; if (IN.uh || IN.dh) sfx("click"); if (IN.ah) choose(cur.sel); else if (IN.bh || menu) M.close(); }
    else if (cur.state === "card") { if (g.levels) { if (IN.uh || IN.lh) cur.lvl = (cur.lvl + g.levels.length - 1) % g.levels.length; if (IN.dh || IN.rh) cur.lvl = (cur.lvl + 1) % g.levels.length; } if (IN.ah) start(); else if (IN.bh || menu) back(); }
    else if (cur.state === "pause") { if (IN.uh) cur.sel = (cur.sel + 2) % 3; if (IN.dh) cur.sel = (cur.sel + 1) % 3; if (menu || (IN.ah && cur.sel === 0)) cur.state = "play"; else if (IN.ah && cur.sel === 1) { cur.state = "card"; cur.st = null; } else if (IN.ah && cur.sel === 2) back(); }
    else if (cur.state === "over") { if (IN.ah) start(); else if (IN.bh || menu) back(); }
  };
  M.click = function (px, py) { // taps and clicks on the cabinet: the buttons drawn on it, and the Ayo houses
    if (!cur) return false; var lx = px - SX, ly = py - SY;
    if (px > 884 && py < 44) { if (cur.state === "play") { cur.state = "pause"; cur.sel = 0; } else back(); return true; }
    if (cur.state === "pick") { var i = Math.floor((ly - 96) / 62); if (lx > 60 && lx < 540 && i >= 0 && i < ORDER.length) choose(i); }
    else if (cur.state === "card" && M.touchMode) { if (ly > 348 && ly < 424 && lx > 146 && lx < 454) start(); else if (cur.g.levels && ly > 264 && ly < 340 && lx > 20 && lx < 580) cur.lvl = clamp(Math.floor((lx - 24) / (552 / cur.g.levels.length)), 0, cur.g.levels.length - 1); }
    else if (cur.state === "card") { if (ly > 370 && lx > 150 && lx < 450) start(); else if (cur.g.levels && ly > 250 && ly < 250 + cur.g.levels.length * 34 && lx > 150 && lx < 450) cur.lvl = Math.floor((ly - 250) / 34); }
    else if (cur.state === "over") { if (ly > 368 && lx > 106 && lx < 300) start(); else if (ly > 368 && lx >= 300 && lx < 494) back(); }
    else if (cur.state === "pause") { var y0 = M.touchMode ? 120 : 190, gap = M.touchMode ? 76 : 44, k = Math.floor((ly - y0) / gap); if (lx > 160 && lx < 440 && k >= 0 && k < 3) { cur.sel = k; pend.a = 1; } }
    else if (cur.state === "play" && cur.g.click) cur.g.click(cur.st, lx, ly);
    return true;
  };
  function frame(kind, title, accent) {
    var c = mkCanvas(960, 540), g = c.getContext("2d"), i;
    if (kind === "tv") { g.fillStyle = "#3a2f45"; g.fillRect(0, 0, 960, 540); g.fillStyle = "rgba(255,255,255,.03)"; for (i = 0; i < 24; i++) g.fillRect(i * 40, 0, 2, 540); g.fillStyle = "#2a2233"; g.fillRect(0, 500, 960, 40); g.fillStyle = "#6b4a2b"; g.fillRect(300, 498, 360, 14); g.fillStyle = "#14161b"; rr(g, SX - 22, SY - 20, SW + 44, SH + 46, 18); g.fill(); g.fillStyle = "#23262e"; rr(g, SX - 14, SY - 12, SW + 28, SH + 24, 12); g.fill(); g.fillStyle = "#14161b"; g.fillRect(430, SY + SH + 26, 100, 10); g.fillStyle = "#ef4444"; g.beginPath(); g.arc(SX + SW + 8, SY + SH + 17, 3, 0, TAU); g.fill(); txt(g, (Z.resolveText || String)("{{GAME_INITIALS}}-TV · ") + title, SX - 8, SY + SH + 17, 11, "#9ca3af"); }
    else { g.fillStyle = "#0b0f17"; g.fillRect(0, 0, 960, 540); var gr = g.createLinearGradient(0, 0, 960, 0); gr.addColorStop(0, "#1b2333"); gr.addColorStop(.18, "#111827"); gr.addColorStop(.82, "#111827"); gr.addColorStop(1, "#1b2333"); g.fillStyle = gr; g.fillRect(0, 0, 960, 540); g.fillStyle = accent; g.fillRect(SX - 30, 0, 6, 540); g.fillRect(SX + SW + 24, 0, 6, 540); g.fillStyle = "#05070b"; rr(g, SX - 16, SY - 12, SW + 32, SH + 24, 16); g.fill(); g.fillStyle = accent; rr(g, SX - 16, 4, SW + 32, 22, 8); g.fill(); txt(g, title.toUpperCase(), 480, 16, 14, "#0b0f17", "center", "900"); g.fillStyle = "#1f2937"; for (i = 0; i < 30; i++) { g.beginPath(); g.arc(SX + 20 + i * 19, 520, 3, 0, TAU); g.fill(); } }
    g.fillStyle = "#1f2937"; rr(g, 890, 8, 60, 30, 8); g.fill(); txt(g, "EXIT", 920, 24, 13, "#e5e7eb", "center", "900");
    return c;
  }
  function panel(x) {
    var g = cur.g, i, rows;
    if (g) { txt(x, g.name.toUpperCase(), 12, 60, 15, g.accent, "left", "900", 130); txt(x, g.tag, 12, 80, 11, "#9ca3af", "left", "700", 130); txt(x, "YOUR BEST", 14, 116, 11, "#9ca3af"); txt(x, String(M.best(g.id)), 14, 138, 22, "#fff", "left", "900");
      if (cur.st && g.side) { rows = g.side(cur.st); for (i = 0; i < rows.length; i++) txt(x, rows[i], 12, 184 + i * 22, 13, "#e5e7eb", "left", "700", 132); }
      if (M.touchMode && cur.state === "play") { var h = { tabletennis: "Drag on the table to move your bat", patrol: "Drag anywhere: the plane follows your finger", ayo: "Tap one of your houses", kola: "Swipe the crate: sideways moves, tap turns, flick down drops", run: "" }[g.id]; if (h) wrap(x, h, 12, 262, 132, 12, "#fde68a"); return; }
      txt(x, "TOP SCORES", 820, 60, 11, "#9ca3af"); rows = M.board(g.id); for (i = 0; i < rows.length; i++) { txt(x, (i + 1) + ". " + rows[i].name, 820, 84 + i * 22, 12, rows[i].me ? "#fde047" : "#e5e7eb", "left", "700", 88); txt(x, String(rows[i].score), 948, 84 + i * 22, 12, rows[i].me ? "#fde047" : "#9ca3af", "right"); } }
    txt(x, "CONTROLS", 820, 236, 11, "#9ca3af"); key(x, "A", 258, "Space · JUMP"); key(x, "B", 284, "J · HIT"); key(x, "M", 310, "Q · PHONE"); txt(x, cur.fee ? "₦" + cur.fee + " a game" : "Free play", 14, 290, 12, cur.fee ? "#fde68a" : "#86efac");
  }
  function key(x, k, py, label) { x.fillStyle = "#334155"; rr(x, 820, py - 10, 22, 20, 5); x.fill(); txt(x, k, 831, py + 1, 12, "#fff", "center", "900"); txt(x, label, 848, py + 1, 11, "#cbd5e1", "left", "700", 100); }
  M.draw = function (x) {
    if (!cur) return; var g = cur.g, t = cur.t, i, key = (cur.opts.frame === "tv" ? "tv" : "cab") + (g ? g.id : "pick");
    if (!M._frame || M._frame.key !== key) { M._frame = frame(cur.opts.frame === "tv" ? "tv" : "cabinet", g ? g.name : "Samaru Arcade", g ? g.accent : "#f59e0b"); M._frame.key = key; }
    if (x.canvas && x.setTransform) { x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = "#0b0f17"; x.fillRect(0, 0, x.canvas.width, x.canvas.height); x.restore(); } // the frozen world must not show at the screen edges
    x.save(); x.globalAlpha = 1; x.drawImage(M._frame, 0, 0); panel(x); x.beginPath(); x.rect(SX, SY, SW, SH); x.clip(); x.translate(SX, SY);
    if (cur.state === "pick") {
      x.fillStyle = "#0f172a"; x.fillRect(0, 0, SW, SH); txt(x, "CHOOSE A GAME", 300, 50, 26, "#fff", "center", "900");
      for (i = 0; i < ORDER.length; i++) { var gg = M.games[ORDER[i]], on = i === cur.sel; x.fillStyle = on ? gg.accent : "#1e293b"; rr(x, 60, 93 + i * 62, 480, 58, 12); x.fill(); txt(x, gg.name, 84, 114 + i * 62, 19, on ? "#0b0f17" : "#fff", "left", "900"); txt(x, gg.tag, 84, 134 + i * 62, 12, on ? "#1f2937" : "#94a3b8"); txt(x, "Best " + M.best(gg.id), 520, 122 + i * 62, 13, on ? "#0b0f17" : "#cbd5e1", "right"); }
      txt(x, "A: choose   ·   B: leave", 300, 428, 13, "#94a3b8", "center");
    } else if (cur.state === "card") {
      x.fillStyle = "#0f172a"; x.fillRect(0, 0, SW, SH); x.fillStyle = g.accent; x.fillRect(0, 0, SW, 6); txt(x, g.name.toUpperCase(), 300, 48, 30, "#fff", "center", "900"); txt(x, g.tag, 300, 78, 14, g.accent, "center");
      for (i = 0; i < g.how.length; i++) wrap(x, g.how[i], 60, 116 + i * 44, 480, 13, "#e2e8f0");
      if (g.levels && M.touchMode) { var lw = Math.floor((552 - (g.levels.length - 1) * 8) / g.levels.length); for (i = 0; i < g.levels.length; i++) { x.fillStyle = i === cur.lvl ? g.accent : "#1e293b"; rr(x, 24 + i * (lw + 8), 268, lw, 68, 12); x.fill(); txt(x, g.levels[i], 24 + i * (lw + 8) + lw / 2, 302, 14, i === cur.lvl ? "#0b0f17" : "#e2e8f0", "center", "800", lw - 12); } }
      else if (g.levels) { for (i = 0; i < g.levels.length; i++) { x.fillStyle = i === cur.lvl ? g.accent : "#1e293b"; rr(x, 150, 252 + i * 34, 300, 28, 8); x.fill(); txt(x, g.levels[i], 300, 266 + i * 34, 14, i === cur.lvl ? "#0b0f17" : "#e2e8f0", "center", "800"); } }
      x.fillStyle = "#22c55e"; if (M.touchMode) { rr(x, 150, 352, 300, 68, 12); x.fill(); txt(x, cur.fee ? "INSERT COIN  ₦" + cur.fee : "PLAY", 300, 387, 18, "#052e16", "center", "900"); txt(x, cur.note || "", 300, 436, 12, "#fca5a5", "center"); } else { rr(x, 150, 376, 300, 40, 10); x.fill(); txt(x, cur.fee ? "INSERT COIN  ₦" + cur.fee + "   (A)" : "PLAY   (A)", 300, 396, 16, "#052e16", "center", "900"); txt(x, cur.note || "B: back", 300, 432, 12, cur.note ? "#fca5a5" : "#94a3b8", "center"); }
    } else {
      g.draw(x, cur.st, t);
      if (cur.state === "pause") { var big = M.touchMode, y0 = big ? 120 : 190, gap = big ? 76 : 44, hh = big ? 68 : 36; x.fillStyle = "rgba(2,6,23,.78)"; x.fillRect(0, 0, SW, SH); txt(x, "PAUSED", 300, big ? 72 : 140, 28, "#fff", "center", "900"); ["Carry on", "Start again", "Leave the game"].forEach(function (s, k) { x.fillStyle = k === cur.sel ? g.accent : "#1e293b"; rr(x, 160, y0 + k * gap, 280, hh, 10); x.fill(); txt(x, s, 300, y0 + k * gap + hh / 2, big ? 18 : 15, k === cur.sel ? "#0b0f17" : "#e2e8f0", "center", "800"); }); }
      else if (cur.state === "over" && cur.res && M.touchMode) { drawOver(x); }
      else if (cur.state === "over" && cur.res) { var r = cur.res; x.fillStyle = "rgba(2,6,23,.82)"; x.fillRect(0, 0, SW, SH); txt(x, r.won ? "WELL PLAYED!" : "GAME OVER", 300, 96, 32, r.won ? "#86efac" : "#fca5a5", "center", "900"); txt(x, r.line, 300, 140, 15, "#e2e8f0", "center"); txt(x, "SCORE", 300, 186, 12, "#94a3b8", "center"); txt(x, String(r.score), 300, 218, 40, "#fff", "center", "900"); if (r.record) txt(x, "★ NEW BEST ★", 300, 256, 16, "#fde047", "center", "900");
        txt(x, r.cash || r.xp ? "You earned " + (r.cash ? "₦" + r.cash : "") + (r.cash && r.xp ? " and " : "") + (r.xp ? r.xp + " XP" : "") : r.capped ? "You have earned today's limit from games." : "No prize this time.", 300, 300, 14, r.cash || r.xp ? "#86efac" : "#94a3b8", "center"); if (r.capped && (r.cash || r.xp)) txt(x, "(today's limit reached)", 300, 322, 11, "#94a3b8", "center");
        x.fillStyle = "#22c55e"; rr(x, 120, 384, 170, 40, 10); x.fill(); txt(x, cur.fee ? "AGAIN ₦" + cur.fee + " (A)" : "AGAIN (A)", 205, 404, 14, "#052e16", "center", "900"); x.fillStyle = "#334155"; rr(x, 310, 384, 170, 40, 10); x.fill(); txt(x, "LEAVE (B)", 395, 404, 14, "#e2e8f0", "center", "900"); if (cur.note) txt(x, cur.note, 300, 440, 12, "#fca5a5", "center"); }
    }
    x.restore();
    if (M.touchMode) drawPads(x);
  };
  function drawOver(x) { var r = cur.res, g = cur.g; x.fillStyle = "rgba(2,6,23,.82)"; x.fillRect(0, 0, SW, SH); txt(x, r.won ? "WELL PLAYED!" : "GAME OVER", 300, 96, 32, r.won ? "#86efac" : "#fca5a5", "center", "900"); txt(x, r.line, 300, 140, 15, "#e2e8f0", "center"); txt(x, String(r.score), 300, 210, 40, "#fff", "center", "900"); if (r.record) txt(x, "★ NEW BEST ★", 300, 250, 16, "#fde047", "center", "900"); txt(x, r.cash || r.xp ? "You earned " + (r.cash ? "₦" + r.cash : "") + (r.cash && r.xp ? " and " : "") + (r.xp ? r.xp + " XP" : "") : "No prize this time.", 300, 292, 14, r.cash || r.xp ? "#86efac" : "#94a3b8", "center");
    x.fillStyle = "#22c55e"; rr(x, 110, 372, 180, 56, 12); x.fill(); txt(x, cur.fee ? "AGAIN ₦" + cur.fee : "AGAIN", 200, 400, 16, "#052e16", "center", "900"); x.fillStyle = "#334155"; rr(x, 310, 372, 180, 56, 12); x.fill(); txt(x, "LEAVE", 400, 400, 16, "#e2e8f0", "center", "900"); if (cur.note) txt(x, cur.note, 300, 444, 12, "#fca5a5", "center"); }
  function drawPads(x) {
    var L = M.touchLayout(), i, b, on; if (!L.length) return; x.save();
    for (i = 0; i < L.length; i++) { b = L[i]; on = b.k === "m" ? 0 : TB[b.k] > 0; x.fillStyle = on ? cur.g.accent : "rgba(30,41,59,.92)"; x.beginPath(); x.arc(b.x, b.y, b.r, 0, TAU); x.fill(); x.lineWidth = 3; x.strokeStyle = on ? "#fff" : "rgba(255,255,255,.35)"; x.stroke(); txt(x, b.label, b.x, b.y + 1, b.label.length > 2 ? 12 : 22, on ? "#0b0f17" : "#f8fafc", "center", "900"); }
    if (TD.on && cur.g && cur.g.id === "patrol") { x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 2; x.beginPath(); x.arc(SX + TD.x, SY + TD.y, 26, 0, TAU); x.stroke(); }
    x.restore();
  }
  function wrap(x, s, px, py, w, size, col) { x.font = "600 " + size + "px system-ui, -apple-system, 'Segoe UI', sans-serif"; var words = s.split(" "), line = "", y = py; for (var i = 0; i < words.length; i++) { var t = line ? line + " " + words[i] : words[i]; if (x.measureText(t).width > w && line) { txt(x, line, px, y, size, col, "left", "600"); line = words[i]; y += size + 5; } else line = t; } if (line) txt(x, line, px, y, size, col, "left", "600"); }

  /* ---------- touch: each game's own controls, drawn on the cabinet's side panels while you play ----------
     Buttons are circles at least 68 logical px across (49 CSS px on an 844x390 phone). Several fingers at once. */
  var TB = { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0 }, TP = {}, TD = { on: 0, id: null, x: 0, y: 0, ox: 0, oy: 0 }, TQ = { x: 0 }, wired = false;
  M.touchMode = false;
  function tnow() { return cur ? cur.t : 0; }
  function touchReset() { TB.l = TB.r = TB.u = TB.d = TB.a = TB.b = 0; TP = {}; TD.on = 0; TD.id = null; TQ.x = 0; }
  M.touchLayout = function () { // [{k, x, y, r, label}] in the 960x540 space; k is the input it holds (m = pause)
    if (!cur || cur.state !== "play" || !cur.g || !M.touchMode) return [];
    var id = cur.g.id, L = [{ k: "m", x: 916, y: 92, r: 34, label: "II" }], LR = [{ k: "l", x: 40, y: 446, r: 34, label: "◀" }, { k: "r", x: 112, y: 446, r: 34, label: "▶" }];
    if (id === "kola") L = L.concat(LR, [{ k: "d", x: 76, y: 362, r: 34, label: "▼" }, { k: "u", x: 850, y: 446, r: 34, label: "DROP" }, { k: "a", x: 920, y: 446, r: 34, label: "⟳" }, { k: "b", x: 885, y: 356, r: 34, label: "BASKET" }]);
    else if (id === "run") L = L.concat(LR, [{ k: "a", x: 885, y: 446, r: 42, label: "JUMP" }]);
    else if (id === "tabletennis") L = L.concat([{ k: "a", x: 885, y: 446, r: 38, label: "SERVE" }, { k: "b", x: 885, y: 354, r: 34, label: "SMASH" }]);
    else if (id === "patrol") L = L.concat([{ k: "a", x: 885, y: 446, r: 42, label: "BOMB" }]);
    return L;
  };
  function dragInput(id, st) {
    if (id === "tabletennis") { IN.x = clamp((TD.x - st.px) / 10, -1, 1); IN.y = clamp((TD.y - st.py) / 10, -1, 1); }
    else if (id === "patrol") { var p = st.p, tx = TD.x + TD.ox - HP.X0, ty = TD.y + TD.oy; IN.x = clamp((tx - p.x) / 8, -1, 1); IN.y = clamp((ty - p.y) / 8, -1, 1); }
  }
  function hitBtn(lx, ly) { var L = M.touchLayout(); for (var i = 0; i < L.length; i++) { var b = L[i], dx = lx - b.x, dy = ly - b.y; if (dx * dx + dy * dy <= (b.r + 4) * (b.r + 4)) return b; } return null; }
  M.touch = {
    down: function (id, lx, ly) {
      if (!cur) return false; M.touchMode = true; var b = hitBtn(lx, ly), g = cur.g;
      if (b) { if (b.k === "m") { cur.state = "pause"; cur.sel = 0; touchReset(); sfx("click"); return true; } TB[b.k]++; TP[id] = { k: "btn", b: b.k }; return true; }
      if (cur.state === "play" && g && lx >= SX && lx <= SX + SW && ly >= SY && ly <= SY + SH) {
        if (g.id === "tabletennis" || g.id === "patrol") { TD.on = 1; TD.id = id; TD.x = lx - SX; TD.y = ly - SY; if (g.id === "patrol") { TD.ox = cur.st.p.x + HP.X0 - TD.x; TD.oy = cur.st.p.y - TD.y; } TP[id] = { k: "drag" }; return true; }
        if (g.id === "kola") { TP[id] = { k: "swipe", x0: lx, y0: ly, cx: lx, t0: tnow(), moved: 0, drop: 0 }; return true; }
      }
      TP[id] = { k: "tap" }; M.click(lx, ly); return true;
    },
    move: function (id, lx, ly) {
      var p = TP[id]; if (!cur || !p) return;
      if (p.k === "drag" && TD.id === id) { TD.x = lx - SX; TD.y = ly - SY; }
      else if (p.k === "swipe") { var dx = lx - p.cx; while (dx >= 30) { TQ.x++; p.cx += 30; dx -= 30; } while (dx <= -30) { TQ.x--; p.cx -= 30; dx += 30; } p.moved = Math.max(p.moved, Math.abs(lx - p.x0) + Math.abs(ly - p.y0)); if (!p.drop && ly - p.y0 > 70 && Math.abs(lx - p.x0) < 50 && tnow() - p.t0 < .35) { pend.u = 1; p.drop = 1; } }
    },
    up: function (id) {
      var p = TP[id]; if (!p) return; delete TP[id];
      if (p.k === "btn") TB[p.b] = Math.max(0, TB[p.b] - 1);
      else if (p.k === "drag" && TD.id === id) { TD.on = 0; TD.id = null; }
      else if (p.k === "swipe" && cur && !p.drop && p.moved < 14 && tnow() - p.t0 < .3) pend.a = 1; // a tap turns the cluster
    },
    held: function () { return { l: TB.l, r: TB.r, u: TB.u, d: TB.d, a: TB.a, b: TB.b, drag: TD.on }; }
  };
  function wire() { // real fingers: listen before the canvas does, so the world's own look-drag and taps never see them
    if (wired || typeof document === "undefined" || !document.querySelector) return; var cv = document.querySelector("[data-gm-canvas]"); if (!cv || !cv.addEventListener) return; wired = true;
    var host = cv.parentNode || cv, ids = {};
    function lg(e) { var r = cv.getBoundingClientRect(), d = cv.width / (r.width || 1), sc = Math.min(cv.width / 960, cv.height / 540), ox = (cv.width - 960 * sc) / 2, oy = (cv.height - 540 * sc) / 2; return [((e.clientX - r.left) * d - ox) / sc, ((e.clientY - r.top) * d - oy) / sc]; }
    host.addEventListener("pointerdown", function (e) { if (!cur) return; if (e.pointerType === "mouse") { M.touchMode = false; return; } if (e.target !== cv) return; var q = lg(e); ids[e.pointerId] = 1; M.touch.down(e.pointerId, q[0], q[1]); try { cv.setPointerCapture(e.pointerId); } catch (x) {} if (e.cancelable) e.preventDefault(); e.stopPropagation(); }, true);
    window.addEventListener("pointermove", function (e) { if (!cur || !ids[e.pointerId]) return; var q = lg(e); M.touch.move(e.pointerId, q[0], q[1]); if (e.cancelable) e.preventDefault(); }, { passive: false });
    var end = function (e) { if (!ids[e.pointerId]) return; delete ids[e.pointerId]; M.touch.up(e.pointerId); };
    window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
    document.addEventListener("keydown", function () { if (cur) M.touchMode = false; });
  }

  /* ---------- sit in front of the rest of the game: while a cabinet is on, the world waits ---------- */
  if (typeof Z.update === "function" && !Z.update._mini) { var up = Z.update; Z.update = function (dt) { if (cur) { M.update(dt); return; } return up.apply(this, arguments); }; Z.update._mini = 1; }
  if (typeof Z.draw === "function" && !Z.draw._mini) { var dr = Z.draw; Z.draw = function () { if (cur && Z.api && Z.api.x) { M.draw(Z.api.x); return; } return dr.apply(this, arguments); }; Z.draw._mini = 1; }
  if (typeof Z.click === "function" && !Z.click._mini) { var ck = Z.click; Z.click = function (px, py) { if (cur) { M.click(px, py); return; } return ck.apply(this, arguments); }; Z.click._mini = 1; }
  try { if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("keydown", function (e) { if (cur && e && e.code === "Backspace") { if (cur.state === "play") { cur.state = "pause"; cur.sel = 0; } else back(); } }); } catch (e) {}
})();
