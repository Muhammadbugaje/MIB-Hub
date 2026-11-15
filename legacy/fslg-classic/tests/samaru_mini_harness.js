/* Headless checks for the Freshers School Life mini-games: each game is played by a simple bot for a few thousand
   ticks, twice with the same seed (must match), and its rules are checked. Prints one JSON line. */
const fs = require("fs"), path = require("path");
const dir = process.argv[2];
global.window = global;
const keys = {};
const P = { name: "Tester", money: 500, day: 1, time: 600, xp: 0, lvl: 1 };
global.SamaruGame = { P, stick: { x: 0, y: 0 }, saved: 0, save() { this.saved++; this.store = JSON.stringify(P); },
  api: { down: (k) => !!keys[k], sound: { sfx() {} }, x: null } };
(0, eval)(fs.readFileSync(path.join(dir, "samaru-minigames.js"), "utf8"));
const Z = global.SamaruGame, M = Z.mini, G = M.games, out = { ok: true };
const I = () => ({ x: 0, y: 0, l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, lh: 0, rh: 0, uh: 0, dh: 0, ah: 0, bh: 0 });
const sig = (o) => JSON.stringify(o, (k, v) => (typeof v === "function" ? undefined : ArrayBuffer.isView(v) ? Array.from(v) : v)).length + ":" + JSON.stringify(o.sc || o.score);

try {
  /* ---- Table Smash ---- */
  const tt = (seed, lvl) => { const g = G.tabletennis, st = g.init(seed, lvl, {}), inp = I(); let n = 0, servers = [], lastTotal = -1;
    while (!st.over && n < 400000) { n++; const b = st.b; inp.ah = st.phase === "serve" ? 1 : 0;
      let ty = 225; if (b.live && b.last === 1) { const tt2 = b.vx < 0 ? (st.px - b.x) / b.vx : 0; ty = b.y + b.vy * tt2 + .5 * b.sp * tt2 * tt2; }
      inp.y = Math.max(-1, Math.min(1, (ty - st.py) / 12)); inp.x = st.px > 52 ? -1 : 0; inp.b = 0;
      const total = st.sc[0] + st.sc[1]; if (total !== lastTotal) { servers.push(g.serverFor(total)); lastTotal = total; }
      g.step(st, inp); if (!isFinite(b.x + b.y + b.z)) throw new Error("table tennis NaN"); }
    return { st, n, servers }; };
  const a = tt(11, 0), a2 = tt(11, 0), h = tt(5, 2);
  const sv = []; for (let t = 0; t < 26; t++) sv.push(G.tabletennis.serverFor(t));
  out.tt = { steps: a.n, sc: a.st.sc, over: a.st.over, same: sig(a.st) === sig(a2.st), hard: h.st.sc, hardOver: h.st.over, rally: a.st.bestRally,
    valid: (s) => 0, serve: sv.join(""), winBy2: [a, h].every((r) => { const m = Math.max(r.st.sc[0], r.st.sc[1]), d = Math.abs(r.st.sc[0] - r.st.sc[1]); return m >= 11 && d >= 2 && (m === 11 || d === 2); }),
    res: G.tabletennis.result(a.st).score > 0, opp: a.st.opp };
  delete out.tt.valid;

  /* ---- Kola Stack ---- */
  const kola = (seed, mode, steps) => { const g = G.kola, K = g._, st = g.init(seed, mode), inp = I(); let plan = null, n = 0, held = 0, piece = -1;
    const drop = (s, r, x) => { let y = 0; if (!K.fits(st, s, r, x, y)) return null; while (K.fits(st, s, r, x, y + 1)) y++; return y; };
    const score = (s, r, x, y) => { const f = K.KR[s][r], gg = Array.from(st.g); for (let i = 0; i < f.length; i += 2) gg[(y + f[i + 1]) * K.KW + x + f[i]] = 1; let holes = 0, hsum = 0, rows = 0;
      for (let yy = 0; yy < K.KH; yy++) { let full = true; for (let xx = 0; xx < K.KW; xx++) if (!gg[yy * K.KW + xx]) full = false; if (full) rows++; }
      for (let xx = 0; xx < K.KW; xx++) { let seen = false; for (let yy = 0; yy < K.KH; yy++) { if (gg[yy * K.KW + xx]) { if (!seen) { hsum += K.KH - yy; seen = true; } } else if (seen) holes++; } }
      return rows * 30 - holes * 9 - hsum - (K.KH - y) * .5; };
    while (!st.over && n < steps) { n++; Object.assign(inp, I()); const p = st.cur, id = st.rows * 1000 + st.score + p.s * 7;
      if (piece !== id || !plan) { piece = id; let best = -1e9; plan = { r: 0, x: p.x }; for (let r = 0; r < 4; r++) for (let x = -1; x < K.KW; x++) { const y = drop(p.s, r, x); if (y == null) continue; const v = score(p.s, r, x, y); if (v > best) { best = v; plan = { r, x }; } } }
      if (n === 40 && !held) { inp.bh = 1; held = 1; plan = null; }
      else if (p.r !== plan.r) inp.ah = 1; else if (p.x < plan.x) inp.rh = 1; else if (p.x > plan.x) inp.lh = 1; else { inp.uh = 1; plan = null; }
      g.step(st, inp); }
    let fullLeft = 0, bad = 0; for (let y = 0; y < K.KH; y++) { let full = true; for (let x = 0; x < K.KW; x++) { const v = st.g[y * K.KW + x]; if (!v) full = false; if (v < 0 || v > 5) bad++; } if (full) fullLeft++; }
    return { st, n, fullLeft, bad, held: st.hold.s >= 0 }; };
  const k1 = kola(21, 0, 9000), k1b = kola(21, 0, 9000), k2 = kola(22, 1, 9000);
  out.kola = { score: k1.st.score, rows: k1.st.rows, lvl: k1.st.lvl, same: sig(k1.st) === sig(k1b.st), fullLeft: k1.fullLeft + k2.fullLeft, bad: k1.bad + k2.bad, held: k1.held, risingRows: k2.st.rows, risingHusks: Array.from(k2.st.g).filter((v) => v === 5).length > 0 || k2.st.over,
    shapes: G.kola._.KR.length, reward: G.kola.reward({ score: 1600 }).cash };

  /* ---- Fresher Run ---- */
  const run = (seed, steps, noJump) => { const g = G.run, F = g._, st = g.init(seed), inp = I(); let n = 0, hold = 0, maxLevel = 0;
    while (!st.over && n < steps) { n++; Object.assign(inp, I()); const p = st.p, L = st.L, col = Math.floor(p.x / 30), feet = p.y; inp.x = 1;
      let want = false; const ahead = (d) => F.gy(L, Math.floor((p.x + d) / 30));
      if (p.onG) { if (ahead(16) > 5000 || ahead(16) < feet - 1 || ahead(34) < feet - 1) want = true; // a gap or a step up just ahead
        for (let c = col; c <= col + 2; c++) if (L.pud[c] && c * 30 + 15 - p.x < 44 && c * 30 + 15 - p.x > 4) want = true;
        for (const q of L.goats) if (q.a && q.x - p.x > 0 && q.x - p.x < 62 && Math.abs(q.y - feet) < 40) want = true;
        if (st.boss && !st.boss.dead && Math.abs(st.boss.x - p.x) < 95) want = true; }
      if (want && !noJump) { inp.ah = 1; hold = 26; } if (hold > 0) { hold--; inp.a = 1; }
      g.step(st, inp); maxLevel = Math.max(maxLevel, st.li); if (!isFinite(p.x + p.y)) throw new Error("run NaN"); }
    return { st, n, maxLevel }; };
  const r1 = run(31, 60 * 240), r1b = run(31, 60 * 240);
  // coyote time: walk off the first ledge without jumping, then press jump a few ticks after leaving the ground
  const coy = (late) => { const g = G.run, st = g.init(1), inp = I(); let left = -1, jumped = false; inp.x = 1; for (let n = 0; n < 600; n++) { inp.ah = 0; if (!st.p.onG && left < 0) left = n; if (left >= 0 && n === left + late) { inp.ah = 1; inp.a = 1; } g.step(st, inp); if (st.p.vy < -300) jumped = true; } return jumped; };
  // jump buffer: press jump a few ticks before landing from a fall
  const buf = () => { const g = G.run, st = g.init(1), inp = I(); st.p.y -= 60; st.p.onG = 0; st.p.coy = 0; let jumped = false, pressed = false; for (let n = 0; n < 120; n++) { inp.ah = 0; const g0 = g._.gy(st.L, 1); if (!pressed && g0 - st.p.y < 12 && st.p.vy > 0) { inp.ah = 1; inp.a = 1; pressed = true; } g.step(st, inp); if (pressed && st.p.vy < -300) jumped = true; } return jumped; };
  out.run = { check: G.run.check(), levels: G.run.levelCount, reached: r1.maxLevel, score: r1.st.score, notes: r1.st.notes, lives: r1.st.lives, won: r1.st.won, same: sig(r1.st) === sig(r1b.st) && r1.n === r1b.n, coyoteOk: coy(3), coyoteLate: coy(12), buffer: buf(), noJumpDies: run(31, 60 * 60, true).st.over === 1 };

  /* ---- Harmattan Patrol ---- */
  const pat = (seed, steps) => { const g = G.patrol, st = g.init(seed), inp = I(); let n = 0, maxStage = 0, bossSeen = false, maxFoes = 0;
    while (!st.over && n < steps) { n++; Object.assign(inp, I()); const p = st.p; let tx = 180, best = 1e9, dodge = 0;
      for (const f of st.foes) if (f.a && f.y < p.y && p.y - f.y < best) { best = p.y - f.y; tx = f.x; } if (st.boss.a) { tx = st.boss.x; bossSeen = true; }
      for (const s of st.eb) if (s.a && Math.abs(s.y - p.y) < 70 && Math.abs(s.x - p.x) < 26 && s.vy > 0) dodge += s.x < p.x ? 1 : -1;
      inp.x = dodge ? Math.sign(dodge) : Math.max(-1, Math.min(1, (tx - p.x) / 20)); inp.y = p.y < 360 ? 1 : 0; if (st.lives === 1 && st.bombs > 0 && n % 300 === 0) inp.ah = 1;
      g.step(st, inp); maxStage = Math.max(maxStage, st.stage); maxFoes = Math.max(maxFoes, st.foes.filter((f) => f.a).length); if (!isFinite(p.x + p.y + st.score)) throw new Error("patrol NaN"); }
    return { st, n, maxStage, bossSeen, maxFoes }; };
  const p1 = pat(41, 60 * 200), p1b = pat(41, 60 * 200);
  out.patrol = { score: p1.st.score, stage: p1.maxStage, boss: p1.bossSeen, over: p1.st.over, won: p1.st.won, same: sig(p1.st) === sig(p1b.st) && p1.n === p1b.n, maxFoes: p1.maxFoes, pool: p1.st.foes.length };

  /* ---- Ayo ---- */
  const A = G.ayo._, bd = (arr) => Int8Array.from(arr), mv = new Int8Array(6);
  const b1 = bd([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]); const c1 = A.apply(b1, 2, 0);
  const b2 = bd([0, 0, 0, 0, 0, 3, 1, 2, 5, 0, 0, 0]); const c2 = A.apply(b2, 5, 0); // last seed makes 3 in house 8? sows 6,7,8 -> 2,3,6: last is 6 seeds, no capture
  const b3 = bd([0, 0, 0, 0, 2, 0, 1, 2, 4, 0, 0, 0]); const c3 = A.apply(b3, 4, 0); // sows 5 and 6: house 6 becomes 2 -> capture 2
  const b4 = bd([0, 0, 0, 0, 0, 3, 1, 2, 1, 0, 0, 5]); const c4 = A.apply(b4, 5, 0); // 6,7,8 become 2,3,2: all captured (7 seeds), 5 left in house 11
  const b5 = bd([0, 0, 0, 0, 0, 3, 1, 2, 1, 0, 0, 0]); const c5 = A.apply(b5, 5, 0); // the same but it would take everything: grand slam, no capture
  const b6 = bd([1, 0, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0]); const n6 = A.legal(b6, 0, mv), l6 = Array.from(mv.slice(0, n6)); // must feed: house 0 (1 seed) cannot reach, 4 and 5 can
  const b7 = bd([0, 0, 0, 13, 0, 0, 0, 0, 0, 0, 0, 0]); A.apply(b7, 3, 0); // 13 seeds go right round and skip the house they came from
  const full = (seed, lvl) => { const g = G.ayo, st = g.init(seed, lvl, {}), inp = I(); let n = 0; while (!st.over && n < 200000) { n++; Object.assign(inp, I()); if (st.turn === 0) { st.sel = A.best({ b: st.b, mv: new Int8Array(6), lvl: 1, r: st.r }, 0); inp.ah = 1; } g.step(st, inp); } const left = Array.from(st.b).reduce((s, v) => s + v, 0); return { st, n, total: left + st.sc[0] + st.sc[1] }; };
  const f1 = full(51, 0), f1b = full(51, 0), f2 = full(52, 2);
  out.ayo = { sow: Array.from(b1).join(","), c1, c2, c3, b3: Array.from(b3).join(","), c4, b4: Array.from(b4).join(","), c5, b5: Array.from(b5).join(","), l6, b7: Array.from(b7).join(","), over: f1.st.over && f2.st.over, total: [f1.total, f2.total], sc: f1.st.sc, hard: f2.st.sc, same: sig(f1.st) === sig(f1b.st) };

  /* ---- the cabinet: fee, rewards with a daily cap, high scores that survive a save ---- */
  const press = (k, frames) => { Z.mini.update(1 / 60); keys[k] = true; for (let i = 0; i < (frames || 2); i++) Z.mini.update(1 / 60); keys[k] = false; Z.mini.update(1 / 60); Z.mini.update(1 / 60); };
  const cab = {}; P.money = 500;
  cab.list = M.list().map((g) => g.id).join(","); cab.unknown = M.open("nope") === false;
  M.open("kola", {}); cab.active = M.active(); press("jump"); cab.paid = P.money; cab.playing = M.active();
  for (let i = 0; i < 30; i++) Z.mini.update(1 / 60); press("phone"); press("down"); press("down"); press("jump"); cab.closed = !M.active(); // pause -> leave
  M.open("kola", { free: true }); press("jump"); cab.free = P.money; M.close();
  P.money = 10; M.open("ayo", {}); press("jump"); cab.broke = P.money === 10; M.close();
  M.open(null, { free: true }); press("down"); press("jump"); press("jump"); cab.picked = M.active(); M.close();
  P.money = 0; let earned = 0; for (let i = 0; i < 6; i++) { const r = M.grant(G.patrol, { score: 99999, won: 1, stage: 2 }); earned += r.cash; } M.close();
  cab.capCash = earned; cab.cap = M.CAP_CASH; cab.best = M.best("patrol"); const round = JSON.parse(JSON.stringify(P)); Z.P = round; cab.bestAfterSave = M.best("patrol"); cab.saved = Z.saved > 0;
  round.day = 2; const r2 = M.grant(G.patrol, { score: 5, won: 0, stage: 0 }); M.close(); cab.keptBest = M.best("patrol") === 99999 && !r2.record; cab.newDay = round.mini.cash === 0;
  out.cab = cab;

  /* ---- touch only: every game opened, started and played to a score with synthetic fingers (no keys) ---- */
  let refreshed = 0; Z.touch = { active: true, refresh() { refreshed++; } };
  const T = M.touch, SX = 180, SY = 40, tick = (n) => { for (let i = 0; i < (n || 1); i++) M.update(1 / 60); };
  const btn = (k) => M.touchLayout().find((b) => b.k === k);
  const tap = (id, x, y) => { T.down(id, x, y); tick(1); T.up(id); tick(1); };
  const hold = (id, k) => { const b = btn(k); if (!b) throw new Error("no " + k + " button in " + M.screen()); T.down(id, b.x, b.y); };
  const begin = (gid) => { P.money = 500; M.close(); M.open(gid, { free: true }); tick(2); tap(9, SX + 300, SY + 386); if (M.screen() !== "play") throw new Error(gid + " did not start by touch: " + M.screen()); };
  const touch = {};
  // the buttons never overlap and are big enough
  const sizes = []; for (const gid of ["tabletennis", "kola", "run", "patrol", "ayo"]) { begin(gid); const L = M.touchLayout(); for (let i = 0; i < L.length; i++) { sizes.push(L[i].r); for (let j = i + 1; j < L.length; j++) if (Math.hypot(L[i].x - L[j].x, L[i].y - L[j].y) < L[i].r + L[j].r) throw new Error(gid + ": " + L[i].k + " overlaps " + L[j].k); if (L[i].x - L[i].r < 0 || L[i].x + L[i].r > 960 || (L[i].x > 150 && L[i].x < 812)) throw new Error(gid + ": " + L[i].k + " is off the side panels"); } }
  touch.minDiameter = Math.min(...sizes) * 2;
  // Table Smash: drag the bat after the ball, SERVE button
  begin("tabletennis"); { let st = M.state(), n = 0; T.down(1, SX + st.px, SY + st.py);
    while (M.screen() === "play" && st.sc[0] < 2 && n++ < 60 * 300) { const b = st.b; let ty = 225, tx = 50; if (b.live && b.last === 1) { const t = b.vx < 0 ? (st.px - b.x) / b.vx : 0; ty = b.y + b.vy * t + .5 * b.sp * t * t; } T.move(1, SX + tx, SY + ty);
      if (st.phase === "serve" && n % 20 === 0) { hold(2, "a"); tick(1); T.up(2); } tick(1); }
    T.up(1); touch.tt = st.sc.slice(); }
  // Kola Stack: buttons to steer and drop, plus a sideways swipe and a tap on the crate
  begin("kola"); { const st = M.state(), x0 = st.cur.x, r0 = st.cur.r; T.down(3, SX + 300, SY + 200); for (let i = 1; i <= 6; i++) { T.move(3, SX + 300 + i * 11, SY + 200); tick(1); } T.up(3); tick(3); touch.swipeCols = st.cur.x - x0;
    const r1 = st.cur.r; T.down(4, SX + 300, SY + 300); tick(2); T.up(4); tick(2); touch.tapTurns = st.cur.r !== r1;
    const sc0 = st.score; T.down(5, SX + 300, SY + 150); T.move(5, SX + 300, SY + 190); T.move(5, SX + 302, SY + 240); T.up(5); tick(2); touch.flickDrops = st.score > sc0;
    hold(7, "b"); tick(1); T.up(7); tick(1); touch.basket = st.hold.s >= 0;
    const K = M.games.kola._; let n = 0, plan = null, pid = -1;
    while (M.screen() === "play" && st.rows < 2 && n++ < 6000) { const p = st.cur, id = st.score * 31 + st.rows * 7 + p.s;
      if (id !== pid) { pid = id; let best = -1e9; for (let r = 0; r < 4; r++) for (let x = -1; x < K.KW; x++) { let y = 0; if (!K.fits(st, p.s, r, x, y)) continue; while (K.fits(st, p.s, r, x, y + 1)) y++; const f = K.KR[p.s][r]; let v = y * 10; for (let q = 0; q < f.length; q += 2) v += f[q + 1] * 4; if (v > best) { best = v; plan = { r, x }; } } }
      const k = p.r !== plan.r ? "a" : p.x < plan.x ? "r" : p.x > plan.x ? "l" : "u"; hold(6, k); tick(1); T.up(6); tick(1); }
    touch.kola = st.score; touch.kolaRows = st.rows; }
  // Fresher Run: hold ▶ with one finger and tap JUMP with another
  begin("run"); { const st = M.state(), F = M.games.run._; hold(1, "r"); let n = 0, j = 0, both = false;
    while (M.screen() === "play" && st.li === 0 && st.lives > 0 && n++ < 60 * 90) { const p = st.p, L = st.L, a = F.gy(L, Math.floor((p.x + 16) / 30)); let want = p.onG && (a > 5000 || a < p.y - 1); const c = Math.floor(p.x / 30); if (p.onG && L.pud[c + 1]) want = true; for (const q of L.goats) if (q.a && q.x - p.x > 0 && q.x - p.x < 62 && p.onG) want = true;
      if (want && !j) { hold(2, "a"); j = 24; } if (j) { j--; if (!j) T.up(2); } const h = T.held(); if (h.r && h.a) both = true; tick(1); }
    T.up(1); T.up(2); touch.run = st.score; touch.runNotes = st.notes; touch.multi = both; }
  // Harmattan Patrol: drag to fly under the targets (guns fire by themselves), BOMB button
  begin("patrol"); { const st = M.state(); T.down(1, SX + 120 + st.p.x, SY + st.p.y); let n = 0;
    while (M.screen() === "play" && st.score < 200 && n++ < 60 * 60) { let tx = 180, best = 1e9; for (const f of st.foes) if (f.a && f.y < st.p.y && st.p.y - f.y < best) { best = st.p.y - f.y; tx = f.x; } T.move(1, SX + 120 + tx, SY + 380); tick(1); }
    const b0 = st.bombs; hold(2, "a"); tick(1); T.up(2); tick(1); T.up(1); touch.patrol = st.score; touch.bomb = b0 - st.bombs; }
  // Ayo: tap your houses
  begin("ayo"); { const st = M.state(), A = M.games.ayo._; let n = 0, taps = 0;
    while (M.screen() === "play" && n++ < 60 * 400) { if (st.turn === 0) { const pit = A.best({ b: st.b, mv: new Int8Array(6), lvl: 1, r: st.r }, 0); tap(1, SX + 105 + pit * 78, SY + 280); taps++; } else tick(1); }
    touch.ayo = st.sc.slice(); touch.ayoTaps = taps; touch.ayoOver = M.screen() === "over"; }
  // pause by touch, then leave: the world's own touch layer is told to come back
  begin("run"); { const r0 = refreshed; hold(1, "m"); tick(2); T.up(1); touch.paused = M.screen() === "pause"; tap(2, SX + 300, SY + 120 + 76 * 2 + 30); touch.left = !M.active(); touch.restored = refreshed > r0; const h = T.held(); touch.released = !h.l && !h.r && !h.a && !h.drag; }
  // a keyboard player never sees the pads
  M.open("run", { free: true }); M.touchMode = false; keys.jump = true; tick(2); keys.jump = false; tick(2); touch.keysHide = M.touchLayout().length === 0; M.close();
  out.touch = touch;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
console.log(JSON.stringify(out));
