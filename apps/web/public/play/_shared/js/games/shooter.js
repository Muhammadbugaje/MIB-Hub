/* Wavefront: a side-scrolling run-and-gun about light as a wave (PHYS 124 Geometrical and Wave Optics; PHYS 122).
 * Original game. The heroes are the arcade's scientist cast; the enemies are Count Entropy's machines (they spark and
 * break apart). Weapons follow the real wave relationships in shooterdata.js: c = fλ and E = hf (Sine Beam),
 * d sinθ = nλ (Diffraction Spread), 1/r² (EMP), y = nλL/d (Interference Lance), I = I₀cos²θ (Polariser Shield). */
(function () {
  "use strict";
  var A = window.Arcade, D = window.WavefrontData, WP = D.WEAPONS, EN = D.ENEMIES;
  var GRAV = 1900, RUN = 230, JUMP = 720, PW = 24, PH = 56, PRONE = 22, VW = 960, VH = 540, Z = 1;
  var save = Object.assign({ cleared: 0, best: {}, who: "einstein", who2: "curie", diff: "normal", armour: true, tut: false, ph: 0, up: {}, opt: {}, surv: [] }, A.store("wavefront") || {});
  function persist() { A.store("wavefront", save); }
  var DIFF = { easy: { label: "Easy", lives: 5, cont: 5, hp: 0.75, fire: 0.7, shot: 0.8 }, normal: { label: "Normal", lives: 3, cont: 3, hp: 1, fire: 1, shot: 1 },
    hard: { label: "Hard", lives: 3, cont: 2, hp: 1.3, fire: 1.3, shot: 1.15 } };
  var ORDER = ["sine", "spread", "emp", "lance"];
  var MENU_SONG = A.song(1900, "synthwave", { bpm: 112 });
  var SONGS = D.STAGES.map(function (s) { return A.song(s.song[0], s.song[1], { bpm: s.song[2] }); });
  var BOSS_SONGS = D.STAGES.map(function (s, i) { return A.song(s.bossSong[0], s.bossSong[1], { bpm: s.bossSong[2], scale: ["phrygian", "harmonic", "minor", "phrygian", "harmonic", "dorian", "minor", "harmonic"][i] }); });
  var MID_SONGS = D.STAGES.map(function (s, i) { return A.song(1971 + i, "breaks", { bpm: 148 + i * 2, scale: "minor" }); });
  var SURV_K = D.STAGES.length; SONGS[SURV_K] = A.song(1913, "breaks", { bpm: 150 }); BOSS_SONGS[SURV_K] = A.song(1963, "boss", { bpm: 172, scale: "phrygian" }); MID_SONGS[SURV_K] = A.song(1983, "breaks", { bpm: 160, scale: "minor" });
  /* save migration: older saves have no upgrades, photons, options or survival board */
  if (!save.up || typeof save.up !== "object") save.up = {}; if (!(save.ph >= 0)) save.ph = 0; if (!save.opt || typeof save.opt !== "object") save.opt = {}; if (!Array.isArray(save.surv)) save.surv = [];
  if (save.cleared > D.STAGES.length - 1) save.cleared = D.STAGES.length - 1;
  function up(id) { return !!save.up[id] && opt("noUpgrades", false) !== true; }
  function opt(k, dflt) { var v = API && API.settings && API.settings.get ? API.settings.get("wf_" + k) : undefined; if (v !== undefined && v !== null) return v; return save.opt[k] === undefined ? dflt : save.opt[k]; }
  var S = { idle: true, t: 0 }, API = null;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function sci(f) { return (f / 1e14).toFixed(1) + "×10¹⁴ Hz"; }

  /* ---------- Actions (remappable; P1 also has phone buttons) ---------- */
  function act(id, label, keys, touch) { var a = { id: id, label: label, keys: keys }; if (touch) a.touch = touch; return a; }
  var ACTIONS = [
    act("left", "Move left", ["KeyA"], { label: "◀", x: 8, y: 86, s: .9 }), act("right", "Move right", ["KeyD"], { label: "▶", x: 28, y: 86, s: .9 }),
    act("up", "Aim up", ["KeyW"], { label: "▲", x: 18, y: 77, s: .9 }), act("down", "Crouch / aim down", ["KeyS"], { label: "▼", x: 18, y: 95, s: .9 }),
    act("jump", "Jump (down + jump drops through)", ["Space", "KeyK"], { label: "⤒", x: 74, y: 93 }), act("fire", "Fire", ["KeyJ"], { label: "✸", x: 90, y: 85 }),
    act("weapon", "Switch weapon", ["KeyL"], { label: "⇄", x: 90, y: 70, s: .75 }), act("fup", "Frequency up (turns shield while held)", ["KeyE"], { label: "f+", x: 57, y: 80, s: .7 }),
    act("fdown", "Frequency down (turns shield while held)", ["KeyQ"], { label: "f−", x: 57, y: 94, s: .7 }), act("shield", "Polariser shield (hold)", ["KeyI"], { label: "◐", x: 74, y: 78, s: .75 }),
    act("lock", "Lock aim (hold)", ["ShiftLeft", "KeyU"], { label: "⌖", x: 42, y: 94, s: .7 }),
    act("p2left", "P2 move left", ["ArrowLeft"]), act("p2right", "P2 move right", ["ArrowRight"]), act("p2up", "P2 aim up", ["ArrowUp"]), act("p2down", "P2 crouch / aim down", ["ArrowDown"]),
    act("p2jump", "P2 jump", ["Period"]), act("p2fire", "P2 fire", ["Slash"]), act("p2weapon", "P2 switch weapon", ["Comma"]), act("p2fup", "P2 frequency up", ["BracketRight"]),
    act("p2fdown", "P2 frequency down", ["BracketLeft"]), act("p2shield", "P2 polariser shield", ["Semicolon"]), act("p2lock", "P2 lock aim", ["ShiftRight"])
  ];
  var TOUCH = ["left", "right", "up", "down", "jump", "fire", "weapon", "fup", "fdown", "shield", "lock"];
  function I(p, id) { return API.down(p.pre + id) || (S.mode === "solo" && API.down("p2" + id)); }
  function H(p, id) { return API.hit(p.pre + id) || (S.mode === "solo" && API.hit("p2" + id)); }

  /* ---------- World queries ---------- */
  function camL() { return S.cam.x; } function camR() { return S.cam.x + VW; }
  function bandAt(x) { var b = S.st.bands; for (var i = 0; i < b.length; i++) if (x >= b[i].x0 && x < b[i].x1) return b[i]; return b[x < 0 ? 0 : b.length - 1]; }
  function gAt(x) { var z = S.st.gzones; for (var i = 0; i < z.length; i++) if (x >= z[i].x0 && x < z[i].x1) return z[i].g; return 1; }
  function surfaceAt(x, y0) { // highest walkable surface at x with top ≥ y0
    var best = Infinity;
    S.st.solids.forEach(function (s) { if (x >= s.x && x <= s.x + s.w && s.y >= y0 && s.y < best) best = s.y; });
    S.st.plats.forEach(function (s) { if (x >= s.x && x <= s.x + s.w && s.y >= y0 && s.y < best) best = s.y; });
    S.props.forEach(function (s) { if (s.hp > 0 && x >= s.x && x <= s.x + s.w && s.y >= y0 && s.y < best) best = s.y; });
    return best;
  }
  function solidAt(px, py) {
    var L = S.nearS; for (var i = 0; i < L.length; i++) { var s = L[i]; if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return true; }
    var P = S.nearP; for (var j = 0; j < P.length; j++) { var q = P[j]; if (px >= q.x && px <= q.x + q.w && py >= q.y - 1 && py <= q.y + 10) return true; }
    return false;
  }
  function wallAt(px, py) { var L = S.nearS; for (var i = 0; i < L.length; i++) { var s = L[i]; if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return s; } return null; }
  function refreshNear() {
    var a = S.cam.x - 500, b = S.cam.x + VW + 500;
    S.nearS = S.st.solids.filter(function (s) { return s.x + s.w > a && s.x < b; }).concat(S.props.filter(function (p) { return p.hp > 0 && p.x + p.w > a && p.x < b; }));
    S.nearP = S.st.plats.filter(function (s) { return s.x + s.w > a && s.x < b; }).concat(S.movers);
  }
  function moveBody(b, dt, g) {
    if (g) b.vy = Math.min(1100, b.vy + g * dt);
    var hw = b.w / 2, L = S.nearS, i, s;
    b.x += b.vx * dt; b.wall = 0;
    for (i = 0; i < L.length; i++) { s = L[i];
      if (b.x + hw > s.x && b.x - hw < s.x + s.w && b.y > s.y + .5 && b.y - b.h < s.y + s.h) { if (b.x < s.x + s.w / 2) { b.x = s.x - hw; b.wall = 1; } else { b.x = s.x + s.w + hw; b.wall = -1; } } }
    var old = b.y; b.y += b.vy * dt; b.ground = false; b.on = null;
    for (i = 0; i < L.length; i++) { s = L[i];
      if (b.x + hw > s.x && b.x - hw < s.x + s.w && b.y > s.y && b.y - b.h < s.y + s.h) {
        if (old <= s.y + 1) { b.y = s.y; b.vy = 0; b.ground = true; b.on = s; }
        else if (b.vy < 0) { b.y = s.y + s.h + b.h; b.vy = 0; }
        else { b.y = s.y; b.vy = 0; b.ground = true; b.on = s; } } }
    if (b.vy >= 0 && !(b.drop > 0)) {
      var P = S.nearP;
      for (i = 0; i < P.length; i++) { s = P[i];
        if (b.x + hw > s.x && b.x - hw < s.x + s.w && old <= s.y - (s.dy || 0) + .5 && b.y >= s.y) { b.y = s.y; b.vy = 0; b.ground = true; b.on = s; } }
    }
  }

  /* ---------- Run / stage setup ---------- */
  function maxHp() { if (S.surv && S.surv.mods.glass) return 1; return (S.armour ? 3 : 1) + (S.armour && up("plate") ? 1 : 0); }
  function mkPlayer(i, id) {
    var c = A.byId[id] || A.CAST[0]; if (i === 0) c = A.styled(c);
    return { i: i, c: c, pre: i ? "p2" : "", x: 0, y: 0, w: PW, h: PH, vx: 0, vy: 0, face: 1, aim: 0, ground: false, on: null, drop: 0, lives: S.dif.lives, hp: 1, inv: 0, dead: 0, out: false,
      wpn: { sine: up("tuned") ? 2 : 1 }, cur: "sine", fi: 3, cool: 0, shield: false, sAng: 90, flip: false, spin: 0, run: 0, prone: false, safe: null, fireT: 0, hurt: 0, lanceT: 0, shots: 0, hits: 0, tip: 0 };
  }
  function newRun(k) {
    S.dif = DIFF[save.diff] || DIFF.normal; S.armour = save.armour; S.cont = S.dif.cont; S.score = 0;
    S.ps = [mkPlayer(0, save.who)]; if (S.mode === "duo") S.ps.push(mkPlayer(1, save.who2));
    S.ps.forEach(function (p) { p.hp = maxHp(); });
    startStage(k);
  }
  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["46f1b4adb976b4dcc97086d07ed2af36bc686de74c78bca5c192e0e795d26bda","c51586ccc71ef700161bb56808c5fb82dbc5840d331fbee7d7b3c723612299eb"],"god":["57792433432e1a09462722ff2e04beac4a785fe24df85aeb94a5ec4b9de0074e","bb3f99376a5662b6003f0b9e5ee2c6c8926306ff71bd2dbeb45eded13e91a4d0"],"guns":["05848f4e1f1b714100c07d1fe32da3b5820d0344530c595c95166735f9bad74e","5ce0e6260fa0f350d1bffec3973f111245644cfd0fc1a9b67bb50306f5367cbf"],"lives":["c889292057f01137de78e46d30c9ef7784c960609c473a2cfd3ae15a16bcd3f2","4a7c704d5dab0db73fe5498a85c54a2a0dfeba263200ca920aa3343ab7722db0"],"cont":["21fa73b5d73b6af4cdc25cc6f503e97ac62ab31bffe159bb141cbeeeb834ba55","0b8fc3595983557fb25508762bea439cdac7f346a81fd36fe858e028a7821a19"],"unlock":["80933abbcc07ca8bbb5a73b577e99f60c4256ffe68b934c9d82b9ade13ba3505","55147ae3e68e546e6a3ce483ac54151eaa32653dfa0eafc6a8c5cac99fcd7e49"],"slow":["c29ef5427986431fbbe43619011b3c8536c82b0d1f7cf2b95be532d33b128dea","8a096d594b0b269ee4ed917094053fcc0c239ff3ce148a0d421b2054e1d22caf"],"party":["bbdea148220425f60ef1db8b5247c64bf56ed8bbc6fdcb32bdf6275cec148a6a","c2ce7f74bb6cfd2a3e6b3648c9030b807925f5decaf6662afbf15ffd2d070b30"],"_combo":"d8a160789de3d2d145d6769009f4f6d089af89fdd3baf2672a658069fb485b06","_swipe":"4b941b1de1d88f008a5da3533265cba3bcd581ab9b05f4bc717a40817ea33759"}/*]CH*/, CT = {};
  function heroOn() { return !!(API && API.hero.active && save.who === "mib" && S.mode !== "duo"); }
  function allGuns() { (S.ps || []).forEach(function (p) { ORDER.forEach(function (w) { p.wpn[w] = 3; }); }); }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Clear this stage", h: CH.skip, run: function () { if (S.phase === "play") stageClear(); } },
      god: { label: "Cannot be hurt", h: CH.god, run: function () { CT.god = 1; } },
      guns: { label: "Every weapon at level 3", h: CH.guns, run: allGuns },
      lives: { label: "9 lives", h: CH.lives, run: function () { (S.ps || []).forEach(function (p) { p.lives = 9; }); } },
      cont: { label: "9 continues", h: CH.cont, run: function () { S.cont = 9; } },
      unlock: { label: "Every stage open", h: CH.unlock, run: function () { save.cleared = D.STAGES.length - 1; persist(); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { menu(api); } });
  }
  function cheatTick(api) {
    var hx = heroOn(); if (api.hero.inUse !== hx) api.hero.use(hx);
    if (CT.god || hx) { S.god = true; CT._g = 1; } else if (CT._g) { S.god = false; CT._g = 0; }
    if (hx && S.phase === "play" && S.ps && S.ps[0] && !(S.ps[0].wpn.lance >= 3)) allGuns();
  }
  function startStage(k) { try { if (window.MIBPlay) MIBPlay.level(k + 1); } catch (mibErr) {} /* MIB-Hub: play tracking */
    var st = S.survNext ? D.buildSurvival() : D.build(k);
    Object.assign(S, { idle: false, k: k, st: st, def: st.def, cam: { x: 0, y: st.bands[0].bottom - VH }, si: 0, foes: [], shots: [], eshots: [], items: [], debris: [], rings: [], pops: [], beams: [],
      props: st.props.map(function (p) { return Object.assign({}, p); }), movers: st.movers.map(function (m) { return Object.assign({ bx: m.x, by: m.y, dx: 0, dy: 0 }, m); }),
      done: {}, ev: null, lock: null, scroll: null, wave: null, boss: null, lift: null, t: 0, clock: 0, kills: 0, found: 0, stageScore: 0, phase: "card", clearT: 0, tipT: 0, flag: false, bossDown: false, nearS: [], nearP: [] });
    st.items.forEach(function (it) { S.items.push({ x: it.x, y: it.y, kind: it.kind, secret: it.secret, vx: 0, vy: 0, w: 22, h: 22, fixed: true, bob: Math.random() * 6 }); });
    S.surv = null; S.ps.forEach(function (p) { if (up("spare") && !p.out) p.lives++; });
    S.ps.forEach(function (p, i) { p.x = 120 + i * 50; p.y = surfaceAt(p.x, -1e9); p.vx = p.vy = 0; p.dead = 0; p.inv = 0; p.safe = { x: p.x, y: p.y }; if (!p.out) p.hp = maxHp(); });
    refreshNear();
    API.music(MENU_SONG);
    API.show(S.survNext ? survCard() : card(k), function (a) { if (a === "go") { API.hide(); begin(); } else if (a === "menu") menu(API); });
  }
  /* ---------- Survival: one arena, endless escalating waves, a modifier every 5th wave, a boss every 10th ---------- */
  function startSurvival() {
    S.dif = Object.assign({}, DIFF[save.diff] || DIFF.normal); S.armour = save.armour; S.cont = 0; S.score = 0;
    S.ps = [mkPlayer(0, save.who)]; if (S.mode === "duo") S.ps.push(mkPlayer(1, save.who2));
    var seed = 1 + Math.floor(Math.random() * 9973);
    S.survNext = { n: 0, seed: seed, mods: {}, modList: [], gapT: 2.5, base: S.dif.hp, best: 0 };
    S.ps.forEach(function (p) { p.hp = maxHp(); });
    startStage(SURV_K); S.surv = S.survNext; S.survNext = null; S.lock = { x0: 0, x1: S.st.len };
  }
  function survCard() {
    var top = save.surv[0];
    return "<h2>Survival</h2><p>One arena, no continues, endless waves. Every wave is a little tougher (+6% machine health). Every 5th wave adds a <b>modifier</b>; every 10th brings a <b>boss</b>.</p>" +
      "<p class='gm-small'>Photons earned here buy upgrades. " + (top ? "Best on this device: wave " + top.wave + ", " + top.score.toLocaleString() + " points (" + A.esc(top.who) + ")." : "No run recorded on this device yet.") + "</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Start</button><button class='gm-btn' data-act='menu'>Menu</button></div>";
  }
  function addModifier() {
    var V = S.surv, free = D.MODIFIERS.filter(function (m) { return !V.mods[m.id]; }), r = D.rng(V.seed * 31 + V.n), m = free[Math.floor(r() * free.length)];
    if (!m) return; if (V.modList.length >= 3) { var old = V.modList.shift(); delete V.mods[old]; }
    V.mods[m.id] = true; V.modList.push(m.id);
    S.st.gzones = V.mods.lowg ? [{ x0: -1e5, x1: 1e5, g: .55 }] : [];
    if (m.id === "glass") S.ps.forEach(function (p) { p.hp = Math.min(p.hp, 1); });
    API.banner(m.name.toUpperCase(), { sub: m.text, col: "#ffd86b", edge: "#5a3a00", size: 64, y: 160, dur: 2.2 }); API.sound.sfx("power");
  }
  function survivalStep(dt) {
    var V = S.surv, L = S.st.len; S.lock = S.boss ? { x0: L - 960, x1: L } : { x0: 0, x1: L }; // boss fights close the arena to one screen, so the boss is always in view
    if (S.wave || S.boss) return;
    if ((V.gapT -= dt) > 0) return;
    V.n++; V.gapT = 3; var n = V.n;
    S.dif.hp = V.base * D.survivalScale(n);
    if (n % 5 === 0) addModifier();
    if (n > 1 && up("mend")) S.ps.forEach(function (p) { if (!p.out && p.dead <= 0) p.hp = Math.min(maxHp(), p.hp + 1); });
    var bs = D.survivalBoss(n, V.seed), hpW = S.dif.hp; if (bs) S.dif.hp = V.base * (1 + (D.survivalScale(n) - 1) * .5); // bosses grow at half the rate of the waves
    if (bs && n % 10 === 0) { S.boss = mkBoss({ boss: bs.boss, x0: L - 960, x1: L }, false); S.lock = { x0: L - 960, x1: L }; S.dif.hp = hpW; API.music(BOSS_SONGS[SURV_K]); API.banner("WAVE " + n, { sub: "BOSS: " + S.boss.name, col: "#ff4d6d", edge: "#5a1020", size: 96 }); API.sound.say("Wave " + n + ". Boss."); return; }
    if (bs) { S.boss = mkBoss({ boss: bs.boss, x0: L - 960, x1: L }, true); S.lock = { x0: L - 960, x1: L }; S.dif.hp = hpW; API.music(MID_SONGS[SURV_K]); API.banner("WAVE " + n, { sub: "WARNING: " + S.boss.name, col: "#ff9d5c", edge: "#5a1020", size: 84 }); return; }
    var groups = D.survivalWave(n, V.seed); if (V.mods.swarm) groups.push(["drone", 2 + Math.floor(n / 6)]);
    S.wave = { ev: { x0: 0, x1: S.st.len, waves: groups, surv: true }, wi: -1, pend: [], gap: .6 };
    API.banner("WAVE " + n, { size: 72, y: 150, dur: 1.2, col: "#ff9d5c", edge: "#6b2a00" }); API.sound.sfx("whistle");
  }
  function survivalOver() {
    var V = S.surv, n = Math.max(0, V.n - (S.wave || S.boss ? 1 : 0)), who = S.ps[0] && S.ps[0].c ? S.ps[0].c.name : "Player";
    var earned = Math.floor(S.score / 150) + n * 3; save.ph += earned;
    var row = { score: S.score, wave: n, who: who + (S.mode === "duo" && S.ps[1] ? " & " + S.ps[1].c.name : ""), mods: V.modList.slice(), when: new Date().toISOString().slice(0, 10) };
    var prevTop = save.surv[0]; save.surv.push(row); save.surv.sort(function (a, b) { return b.score - a.score || b.wave - a.wave; }); save.surv = save.surv.slice(0, 10);
    var rank = save.surv.indexOf(row); persist();
    A.report("wavefront", { result: "lose", stage: 1, score: Math.min(5000, Math.round(S.score / 10)), mode: S.mode === "duo" ? "duo" : "solo" });
    var record = rank === 0 && !!prevTop;
    API.ceremony(record ? "newRecord" : "lose", { title: record ? "NEW RECORD!" : "OVERRUN", sub: "Survival · wave " + n, hero: S.ps[0] && S.ps[0].c, score: S.score, scoreLabel: "Survival score",
      stats: [["Waves held", n], ["Machines broken", S.kills], ["Photons earned", earned]], line: n >= 10 ? "You held past a boss wave. That is real staying power." : "Every run earns photons; spend them on upgrades and come back stronger.",
      tip: "Stay near the middle ledges: drones come from both sides, and the high platform gives a steep angle on shield wardens.", then: function () {
        var board = save.surv.map(function (r, i) { return "<tr" + (i === rank ? " style='font-weight:800'" : "") + "><td>" + (i + 1) + "</td><td>" + A.esc(r.who) + "</td><td>wave " + r.wave + "</td><td>" + r.score.toLocaleString() + "</td></tr>"; }).join("");
        API.show("<h2>Survival over: wave " + n + "</h2><p>Score <b>" + S.score.toLocaleString() + "</b>. You earned <b>" + earned + " photons</b> (you have " + save.ph + ").</p><table class='gm-board'><tr><th>#</th><th>Who</th><th>Reached</th><th>Score</th></tr>" + board + "</table>" +
          "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>Go again</button><button class='gm-btn' data-act='up'>Upgrades</button><button class='gm-btn' data-act='menu'>Menu</button></div>",
          function (a) { if (a === "again") startSurvival(); else if (a === "up") upgrades(API); else menu(API); });
      } });
  }
  function begin() {
    S.phase = "play"; API.music(SONGS[S.k]); API.useActions(TOUCH);
    if (S.surv) { API.banner("SURVIVAL", { sub: "How long can you hold?", col: "#ff9d5c", edge: "#5a1020", size: 100 }); API.sound.say("Survival"); S.tipT = 0; return; }
    API.banner("STAGE " + (S.k + 1), { sub: S.def.name, col: "#7ef0ff", edge: "#0b4a6e", size: 110 }); API.sound.say("Stage " + (S.k + 1) + ". " + S.def.name);
    S.tipT = S.k === 0 && !save.tut && opt("tips", true) ? 26 : 0;
  }

  /* ---------- Concept cards and panel ---------- */
  function card(k) {
    var f = 5.8e14, nm = D.nm(f), th = D.gratingAngles(nm * 1e-9, WP.spread.d[1]), r = D.gratingAngles(697e-9, 1.1e-6);
    var body = [
      "<p>Light is an electromagnetic wave. Its speed, frequency and wavelength are linked by <span class='gm-eq'>c = fλ</span>, and each photon carries energy <span class='gm-eq'>E = hf</span>.</p><p>Your <b>Sine Beam</b> fires a wave packet. Step the frequency with <b>f+ / f−</b> from 4.3 to 7.3 × 10¹⁴ Hz (red to violet). At f = " + sci(f) + ", λ = c/f = " + nm.toFixed(0) + " nm and E = hf = " + D.photonEV(f).toFixed(2) + " eV. Higher f means a visibly shorter wave and more energy per photon, so more damage (a game metaphor).</p>",
      "<p><b>Huygens' principle:</b> every point on a wavefront acts as a source of new wavelets. A diffraction grating is many slits a distance d apart; their wavelets add up only where <span class='gm-eq'>d sinθ = nλ</span>.</p><p>Your <b>Diffraction Spread</b> fires the orders n = 0, ±1, ±2. With d = 1.6 µm and λ = " + nm.toFixed(0) + " nm: θ₁ = " + th[3].deg.toFixed(1) + "°, θ₂ = " + th[4].deg.toFixed(1) + "°. A finer grating fans wider. Red light (697 nm) on the finest grating (d = 1.1 µm) has only n = 0, ±1 (θ₁ = " + r[2].deg.toFixed(1) + "°): n = 2 would need sinθ = 1.27, so that order does not exist.</p>",
      "<p>An electromagnetic pulse comes from a sudden surge of current (PHYS 122). From a small source its energy spreads over a sphere of area 4πr², so the intensity falls as <span class='gm-eq'>I ∝ 1/r²</span>: twice as far, a quarter of the effect.</p><p>Your <b>EMP Pulse</b> is a short-range burst. The changing field induces currents in the drones' circuits (Faraday: ε = −dΦ/dt) and knocks them out. It ignores coloured filters, because it is not visible light.</p>",
      "<p>Light's electric field oscillates in one plane: its <b>polarisation</b>. A polariser passes only the component along its axis, so the transmitted intensity is <span class='gm-eq'>I = I₀ cos²θ</span> (Malus's law). Unpolarised light loses half.</p><p>Hold <b>shield</b> and turn it with f+ / f− in 15° steps. Each beam shows its polarisation angle. Shield 30° from the beam: cos²30° = 0.75 of the hit gets through. At 90°: cos²90° = 0, a full block. Hold your shield <i>crossed</i> to the beam.</p>",
      "<p>In <b>Young's double slit</b>, two coherent sources d apart make bright fringes where the path difference is nλ. On a screen L away (small angles) they sit at <span class='gm-eq'>y = nλL/d</span>, with intensity <span class='gm-eq'>I = I₀ cos²(πdy/λL)</span>.</p><p>Your <b>Interference Lance</b> is a double slit with d = 4 µm. At λ = 600 nm and L = 400 px the fringes are 60 px apart. Only machines on a bright fringe take damage. Changing f moves the fringes.</p>",
      "<p>A coloured filter absorbs most wavelengths and transmits one <b>pass band</b>: red glass passes about 620–750 nm, blue glass 400–495 nm. Filter knights carry such glass.</p><p>Since λ = c/f, tune your frequency until your beam's wavelength lies inside their pass band, or hit them from behind. Red needs f ≲ 4.8 × 10¹⁴ Hz; blue needs f ≳ 6.1 × 10¹⁴ Hz.</p>",
      "<p>Light needs no medium. In vacuum all electromagnetic waves travel at <span class='gm-eq'>c = 1/√(μ₀ε₀)</span> = " + (1 / Math.sqrt(4 * Math.PI * 1e-7 * 8.854e-12)).toExponential(3).replace("e+8", " × 10⁸") + " m/s.</p><p>The station spins to make artificial gravity, <span class='gm-eq'>a = ω²r</span>. In the spoke corridors you are closer to the hub, so r is smaller and you weigh less: 55% and 40% of normal. Jumps go higher.</p>",
      "<p>Everything together: light is a transverse wave with E ⟂ B ⟂ direction of travel; its polarisation is the direction of E. Use c = fλ to beat the prism, d sinθ = nλ to cover angles, I = I₀cos²θ to block his beams, and 1/r² to stay close with the EMP.</p><p>Count Entropy wants everything in disorder. Waves are order: phase, wavelength, interference. Bring the relay core home.</p>",
      "<p>Shield wardens carry a metal plate. Metal reflects light: the free electrons in it oscillate with the wave's electric field and re-radiate it back, so your beam bounces off the front.</p><p>Hit them from behind, from steeply above (jump and aim down), or with the EMP, whose changing field induces currents through the plate. Scatter cells split into two wheels when broken: keep moving.</p>",
      "<p>Laser snipers aim before they fire, and you can see their aim line. A laser is <b>coherent</b>: every part of the beam is in phase, so it stays narrow over long distances.</p><p>Watch the dashed line: when it turns solid, the shot is coming. Duck behind cover, or hold your polariser crossed to its polarisation (shown above it): cos²90° = 0.</p>",
      "<p>Market lamps show <b>colour mixing by light</b>: red + green light look yellow, and red + green + blue look white, because your eye has three kinds of colour receptor. That is additive mixing, the opposite of mixing paints.</p><p>Your frequency selector picks one wavelength at a time: each is a pure spectral colour.</p>",
      "<p>The Echo uses everything: polarised beams (Malus), coloured filters (pass bands), plates (reflection) and swarms (stay close with the 1/r² pulse).</p><p>Light carries energy E = hf in packets, and travels as a wave that interferes and diffracts. Both pictures are true. Finish it.</p>"][k] || "";
    var who = S.ps.map(function (p) { return A.esc(p.c.name); }).join(" and ");
    return "<h2>Stage " + (k + 1) + ": " + A.esc(D.STAGES[k].name) + "</h2><p>" + A.esc(D.STAGES[k].intro) + "</p><div class='gm-card-note'>" + body + "</div>" +
      "<p class='gm-small'>" + who + " · " + S.dif.label + (S.armour ? " · 3-hit armour" : " · one-hit mode") + " · " + (S.mode === "duo" ? "co-op" : "solo") + "</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Fight!</button><button class='gm-btn' data-act='menu'>Menu</button></div>";
  }
  function panel(api) {
    api.panel("<p>Every weapon in Wavefront follows a real wave relationship (PHYS 124; EMP from PHYS 122).</p><table>" +
      "<tr><td>Wave speed</td><td><span class='gm-eq'>c = fλ</span>, c = 2.998 × 10⁸ m/s, f in Hz, λ in m</td></tr>" +
      "<tr><td>Photon energy</td><td><span class='gm-eq'>E = hf</span>, h = 6.626 × 10⁻³⁴ J s (E in J; 1 eV = 1.602 × 10⁻¹⁹ J)</td></tr>" +
      "<tr><td>Grating</td><td><span class='gm-eq'>d sinθ = nλ</span>, d slit spacing (m), n order; orders with |nλ/d| &gt; 1 are omitted</td></tr>" +
      "<tr><td>Double slit</td><td><span class='gm-eq'>y = nλL/d</span>, <span class='gm-eq'>I = I₀cos²(πdy/λL)</span> (small angles, y ≪ L)</td></tr>" +
      "<tr><td>Malus's law</td><td><span class='gm-eq'>I = I₀cos²θ</span>; unpolarised light: I = I₀/2</td></tr>" +
      "<tr><td>Point-source pulse</td><td><span class='gm-eq'>I ∝ 1/r²</span>, EMP effect = (r₀/r)² beyond r₀ = 40 px</td></tr>" +
      "<tr><td>Spin gravity</td><td><span class='gm-eq'>a = ω²r</span> (m/s²)</td></tr>" +
      "<tr><td>EM waves in vacuum</td><td><span class='gm-eq'>c = 1/√(μ₀ε₀)</span></td></tr></table>" +
      "<p class='gm-small'>Disclosed model: frequencies 4.3–7.3 × 10¹⁴ Hz (visible light, 697–411 nm). Waves are drawn 1 px per 16.7 nm, so the wavelength you see is enlarged about 6 × 10⁷ times but keeps the right ratios. Damage proportional to hf is a game metaphor, as are the EMP and shield hit points. The double slit is an ideal pair of point sources (no single-slit envelope), using λ/d of a real 4 µm slit pair. Gratings: 300, 625 and 900 lines per mm (d = 3.0, 1.6, 1.1 µm). Spectral orders are weighted 1, 0.7, 0.5 for n = 0, 1, 2 (real gratings vary). Polarisation angles are drawn as if you were looking along the beam. Running and jumping use arcade gravity; only the spin-gravity ratios are physical. Enemies are Count Entropy's machines.</p>",
      "<table><tr><td>Run / aim (8 ways)</td><td>A D + W S (P2: arrows)</td></tr><tr><td>Jump · somersault while running</td><td>Space or K</td></tr><tr><td>Drop through a ledge</td><td>S + jump</td></tr><tr><td>Prone</td><td>S on the ground</td></tr>" +
      "<tr><td>Fire (hold)</td><td>J</td></tr><tr><td>Frequency up / down</td><td>E / Q</td></tr><tr><td>Polariser shield (hold) · turn it</td><td>I, then E / Q</td></tr><tr><td>Lock aim (stand and aim)</td><td>Shift or U</td></tr><tr><td>Switch weapon</td><td>L</td></tr></table>" +
      "<p class='gm-small'>Solo players can also use the P2 keys. Phones: d-pad on the left, jump and fire on the right, f+ / f− in the middle. Move them in Settings → Phone buttons.</p>");
  }

  /* ---------- Menus ---------- */
  function menu(api) {
    S.idle = true; S.phase = "menu"; api.useActions([]); api.music(MENU_SONG);
    var stages = D.STAGES.map(function (st, k) { var open = k <= save.cleared || !!(API && API.hero.active); return "<button class='gm-btn" + (open ? " gm-btn--go" : "") + "' data-act='" + (open ? "st" : "no") + "' data-k='" + k + "'" + (open ? "" : " disabled") + ">" + (k + 1) + ". " + A.esc(st.name) + (save.best[st.id] ? " · " + save.best[st.id].toLocaleString() : open ? "" : " 🔒") + "</button>"; }).join("");
    var dif = ["easy", "normal", "hard"].map(function (d) { return "<button class='gm-btn gm-btn--sm' data-act='diff' data-d='" + d + "' aria-pressed='" + (save.diff === d) + "'>" + DIFF[d].label + "</button>"; }).join("");
    api.show("<h2>Wavefront</h2><p>Count Entropy has stolen the relay core that lights the city. Run, jump and fight through his machines with weapons made of light: every one follows a real wave law.</p>" +
      "<p><b>Players</b></p><div class='gm-actions'><button class='gm-btn' data-act='mode' data-m='solo' aria-pressed='" + (S.mode !== "duo") + "'>One player</button><button class='gm-btn' data-act='mode' data-m='duo' aria-pressed='" + (S.mode === "duo") + "'>Two players, one keyboard</button></div>" +
      "<p><b>Difficulty</b></p><div class='gm-actions'>" + dif + "<button class='gm-btn gm-btn--sm' data-act='armour' aria-pressed='" + !!save.armour + "'>3-hit armour: " + (save.armour ? "on" : "off") + "</button></div>" +
      "<p><b>Stages</b></p><div class='gm-actions'>" + stages + "</div>" +
      "<p><b>More</b></p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='surv'>Survival (endless)" + (save.surv[0] ? " · best wave " + save.surv[0].wave : "") + "</button><button class='gm-btn' data-act='up'>Upgrades · " + save.ph + " photons</button><button class='gm-btn' data-act='opt'>Options</button></div>" +
      "<p class='gm-small'>Stage select opens as you clear stages. Progress, photons and upgrades are saved on this device.</p>",
      function (a, el) {
        if (a === "mode") { S.mode = el.getAttribute("data-m"); menu(api); }
        else if (a === "surv") pick(api, "surv", 0);
        else if (a === "up") upgrades(api);
        else if (a === "opt") { if (api.openSettings && api.settings && api.settings.add) api.openSettings("gameplay"); else options(api); }
        else if (a === "diff") { save.diff = el.getAttribute("data-d"); save.armour = save.diff === "easy" ? true : save.diff === "hard" ? false : save.armour; persist(); menu(api); }
        else if (a === "armour") { save.armour = !save.armour; persist(); menu(api); }
        else if (a === "st") pick(api, +el.getAttribute("data-k"), 0);
      });
  }
  function upgrades(api) {
    var rows = D.UPGRADES.map(function (b) {
      return "<p><b>" + b.name + "</b></p><div class='gm-actions' style='flex-wrap:wrap'>" + b.nodes.map(function (nd, i) {
        var c = D.upgradeCost(save.up, b.id, i), own = c === 0, can = c != null && c > 0 && save.ph >= c;
        return "<button class='gm-btn gm-btn--sm" + (own ? " gm-btn--go" : "") + "' data-act='" + (can ? "buy" : "no") + "' data-b='" + b.id + "' data-i='" + i + "'" + (own || can ? "" : " disabled") + " title='" + A.esc(nd.text) + "'>" +
          (own ? "✓ " : c == null ? "🔒 " : "") + A.esc(nd.name) + (own ? "" : " · " + nd.cost) + "<br><small>" + A.esc(nd.text) + "</small></button>";
      }).join("") + "</div>";
    }).join("");
    api.show("<h2>Upgrades</h2><p>You have <b>" + save.ph + " photons</b>. Earn them by clearing stages (1 per 100 stage points) and in Survival. Each branch is bought in order.</p>" + rows +
      "<p class='gm-small'>Upgrades can be switched off in Options for a pure run.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='back'>Back</button></div>",
      function (a, el) {
        if (a === "buy") { var b = el.getAttribute("data-b"), i = +el.getAttribute("data-i"), c = D.upgradeCost(save.up, b, i), nd = D.UPGRADES.filter(function (x) { return x.id === b; })[0].nodes[i];
          if (c > 0 && save.ph >= c) { save.ph -= c; save.up[nd.id] = true; persist(); api.sound.sfx("power"); api.toast && api.toast(nd.name + " bought"); } upgrades(api); }
        else if (a === "back") menu(api);
      });
  }
  var OPTIONS = [
    { k: "autoAim", label: "Auto-aim", choices: [["touch", "On phones"], ["on", "Always"], ["off", "Off"]], dflt: "touch", help: "Aims at the nearest machine when you are not aiming up or down yourself." },
    { k: "hud", label: "HUD size", choices: [["auto", "Auto"], ["large", "Large"]], dflt: "auto", help: "Large makes the lives, weapon and score panel bigger on every screen." },
    { k: "noUpgrades", label: "Upgrades", choices: [[false, "Use them"], [true, "Pure run (off)"]], dflt: false, help: "Switch your bought upgrades off without losing them." },
    { k: "tips", label: "Tutorial tips", choices: [[true, "Show"], [false, "Hide"]], dflt: true, help: "The control hints at the start of stage 1." }
  ];
  function options(api) {
    api.show("<h2>Wavefront options</h2>" + OPTIONS.map(function (o) { var cur = opt(o.k, o.dflt);
      return "<p><b>" + o.label + "</b> <span class='gm-small'>" + A.esc(o.help) + "</span></p><div class='gm-actions'>" + o.choices.map(function (c) { return "<button class='gm-btn gm-btn--sm' data-act='set' data-k='" + o.k + "' data-v='" + JSON.stringify(c[0]) + "' aria-pressed='" + (cur === c[0]) + "'>" + c[1] + "</button>"; }).join("") + "</div>"; }).join("") +
      "<p class='gm-small'>Sound, keys, phone button layout and screen shake are in the arcade's Settings (gear) menu.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='back'>Back</button></div>",
      function (a, el) { if (a === "set") { save.opt[el.getAttribute("data-k")] = JSON.parse(el.getAttribute("data-v")); persist(); options(api); } else if (a === "back") menu(api); });
  }
  function pick(api, k, who) {
    var key = who ? "who2" : "who";
    api.show("<h2>" + (S.mode === "duo" ? "Player " + (who + 1) + ": choose" : "Choose your scientist") + "</h2>" + A.picker(api, save[key], who ? "Player 2 (arrow keys)" : S.mode === "duo" ? "Player 1 (WASD)" : "Pick your scientist") +
      "<p class='gm-small'>Everyone handles the same in Wavefront; pick a favourite.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Next</button><button class='gm-btn' data-act='back'>Back</button></div>",
      function (a, el) {
        if (a === "pick") { save[key] = el.getAttribute("data-id"); persist(); [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); }); }
        else if (a === "back") menu(api);
        else if (a === "ok") { if (S.mode === "duo" && !who) pick(api, k, 1); else if (k === "surv") startSurvival(); else newRun(k); }
      });
    A.paintFaces(document.querySelector("[data-gm-overlay]"));
  }

  /* ---------- Effects ---------- */
  function pop(x, y, t, col) { if (S.pops.length > 14) S.pops.shift(); S.pops.push({ x: x, y: y, t: t, col: col || "#fff", life: 1.6 }); }
  function boom(x, y, s, col) {
    s = s || 1; S.rings.push({ x: x, y: y, r: 4, max: 46 * s, life: .45, col: col || "#ffd86b" });
    var n = API.reduce ? 3 : Math.round(5 + 5 * s);
    for (var i = 0; i < n; i++) S.debris.push({ x: x, y: y, vx: rnd(-260, 260) * s, vy: rnd(-520, -120) * Math.sqrt(s), r: 0, vr: rnd(-12, 12), w: rnd(4, 10) * Math.sqrt(s), h: rnd(3, 7), col: Math.random() < .5 ? "#4b2b6b" : "#8a8f99", life: rnd(.8, 1.5) });
    API.burst(x, y, "#ffd86b", Math.round(8 * s), 240 * Math.sqrt(s)); API.burst(x, y, col || "#ff7a3d", Math.round(5 * s), 160);
    API.sound.sfx(s > 1.4 ? "boom" : "hit"); API.kick(Math.min(14, 3 * s));
  }

  /* ---------- Player ---------- */
  function updatePlayer(p, dt) {
    if (p.out) { if (S.mode === "duo" && S.cont > 0 && H(p, "fire")) { S.cont--; p.out = false; p.lives = S.dif.lives; respawn(p); pop(p.x, p.y - 80, "Continue! " + S.cont + " left", "#7ef0ff"); } return; }
    if (p.dead > 0) {
      p.dead -= dt; p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.dead <= 0) { if (p.lives > 0) respawn(p); else { p.out = true; checkOver(); } }
      return;
    }
    p.inv = Math.max(0, p.inv - dt); p.fireT = Math.max(0, p.fireT - dt); p.cool -= dt; p.drop = Math.max(0, p.drop - dt); p.hurt = Math.max(0, p.hurt - dt);
    var l = I(p, "left"), r = I(p, "right"), u = I(p, "up"), d = I(p, "down"), lock = I(p, "lock"), sh = I(p, "shield");
    var ax = (r ? 1 : 0) - (l ? 1 : 0), ay = (d ? 1 : 0) - (u ? 1 : 0), shLv = Math.max(1, p.wpn.shield || 1);
    p.shield = sh;
    if (H(p, "fup")) { if (sh) p.sAng = (p.sAng + WP.shield.step) % 180; else if (p.fi < D.FREQS.length - 1) { p.fi++; API.sound.tone(300 + p.fi * 90, .07, "sine", .08); } }
    if (H(p, "fdown")) { if (sh) p.sAng = (p.sAng + 180 - WP.shield.step) % 180; else if (p.fi > 0) { p.fi--; API.sound.tone(300 + p.fi * 90, .07, "sine", .08); } }
    if (H(p, "weapon")) { var own = ORDER.filter(function (w) { return p.wpn[w]; }); p.cur = own[(own.indexOf(p.cur) + 1) % own.length]; API.sound.sfx("click"); pop(p.x, p.y - 80, WP[p.cur].name, "#7ef0ff"); }
    p.prone = p.ground && ay > 0 && ax === 0 && !lock && !sh;
    var dx = ax, dy = ay;
    if (!lock && p.ground && ay > 0 && ax === 0) dy = 0;
    if (!dx && !dy) dx = p.face;
    if (ax) p.face = ax;
    p.aim = Math.atan2(dy, dx);
    if (autoAim() && !u && !d && !lock) { var tg = aimTarget(p); if (tg) { p.aim = Math.atan2(tg.y - (p.y - 36), tg.x - p.x); p.face = tg.x < p.x ? -1 : 1; } }
    var spd = RUN * (sh ? WP.shield.move[shLv - 1] : 1);
    p.vx = lock || p.prone ? 0 : ax * spd;
    if (H(p, "jump") && p.ground && !lock) {
      if (d && p.on && !p.on.lift && S.st.plats.concat(S.movers).indexOf(p.on) >= 0) { p.drop = .22; p.y += 2; }
      else { p.vy = -JUMP; p.flip = ax !== 0 && !sh; p.spin = 0; API.sound.sfx("jump"); }
    }
    if (!I(p, "jump") && p.vy < -320) p.vy = -320;
    p.h = p.prone ? PRONE : PH;
    var g = GRAV * gAt(p.x);
    moveBody(p, dt, g);
    if (p.ground) { p.flip = false; if (p.on && S.st.solids.indexOf(p.on) >= 0) p.safe = { x: p.x, y: p.y }; }
    if (p.flip) p.spin += dt * 15;
    if (p.ground && p.vx) p.run += dt * 12;
    var lo = S.lock ? S.lock.x0 + 14 : camL() + 14, hi = S.lock ? S.lock.x1 - 14 : camR() - 14;
    if (S.lift && S.lift.go) { lo = S.lift.ev.x0 + 14; hi = S.lift.ev.x1 - 14; }
    lo = Math.max(lo, camL() + 12); hi = Math.min(hi, camR() - 12);
    if (p.x < lo) p.x = lo; if (p.x > hi) p.x = hi;
    var emb = wallAt(p.x, p.y - 4) || wallAt(p.x + p.w / 2 - 1, p.y - 4) || wallAt(p.x - p.w / 2 + 1, p.y - 4);
    if (emb) { if (emb.y > p.y - p.h - 90 && !wallAt(p.x, emb.y - 10)) { p.y = emb.y; p.vy = 0; } else { kill(p, "left behind"); return; } }
    if (p.y > bandAt(p.x).bottom + 140) { kill(p, "fell"); return; }
    if (I(p, "fire") && !sh && p.cool <= 0) fire(p);
    // hazards
    S.st.hazards.forEach(function (z) {
      if (p.x + p.w / 2 < z.x || p.x - p.w / 2 > z.x + z.w || p.y < z.y || p.y - p.h > z.y + z.h) return;
      if (z.kind === "arc" && !arcOn(z)) return;
      if (z.kind === "water") { kill(p, "swept"); return; }
      hurt(p, 1, z.kind === "arc" ? "Electric arc" : "Spikes");
    });
    // pickups
    if (up("magnet")) S.items.forEach(function (it) { if (it.gone || it.secret || hidden(it)) return; var dx = p.x - it.x, dy = p.y - 20 - it.y, d = Math.hypot(dx, dy); if (d < 160 && d > 4) { it.fixed = true; it.x += dx / d * 320 * dt; it.y += dy / d * 320 * dt; } });
    S.items.forEach(function (it) { if (!it.gone && !hidden(it) && Math.abs(it.x - p.x) < 26 && it.y - 10 > p.y - p.h - 20 && it.y - 10 < p.y + 6) collect(p, it); });
  }
  function autoAim() { var o = opt("autoAim", "touch"); return o === "on" || (o === "touch" && !!(API && API.touchActive ? API.touchActive() : (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches))); }
  function aimTarget(p) { // nearest machine in front (or anywhere when none is in front) within reach, with a clear line
    var best = null, bd = 560; targets().forEach(function (t) { if (t.q) return; var ty = t.cy(), dx = t.x - p.x, dist = Math.hypot(dx, ty - p.y + 36) - (dx * p.face < 0 ? -120 : 0); if (dist < bd) { bd = dist; best = { x: t.x, y: ty }; } }); return best; }
  function arcOn(z) { return ((S.t + z.ph) % z.period) < z.on; }
  function hidden(it) { return S.props.some(function (q) { return q.hp > 0 && it.x > q.x && it.x < q.x + q.w && it.y > q.y && it.y < q.y + q.h + 4; }); }
  function respawn(p) {
    var s = p.safe, L = camL() + 60, R = camR() - 60;
    if (S.lock) { L = Math.max(L, S.lock.x0 + 60); R = Math.min(R, S.lock.x1 - 60); }
    var ok = s && s.x > L && s.x < R && s.y > S.cam.y && s.y < S.cam.y + VH + 40;
    if (S.lift) { s = { x: (S.lift.ev.x0 + S.lift.ev.x1) / 2, y: S.lift.mv.y }; ok = true; }
    if (!ok) { s = null; for (var x = L + 60; x < R; x += 30) { var y = surfaceAt(x, S.cam.y + 60); if (y < S.cam.y + VH - 10) { s = { x: x, y: y }; break; } } }
    if (!s) s = p.safe;
    p.x = s.x; p.y = s.y - 1; p.vx = p.vy = 0; p.dead = 0; p.inv = up("phase") ? 4 : 2.6; p.hp = maxHp(); p.flip = false; p.drop = 0;
    API.burst(p.x, p.y - 30, "#7ef0ff", 16, 220); API.sound.sfx("power");
  }
  function hurt(p, amt, why) {
    if (p.inv > 0 || p.dead > 0 || p.out) return;
    if (S.god) { S.taken = (S.taken || 0) + amt; (S.why = S.why || {})[why] = (S.why[why] || 0) + 1; p.inv = 1.0; return; }
    p.hp -= amt; p.hurt = .35; API.buzz(amt >= 1 ? [40, 30, 60] : 25); API.sound.sfx("hit"); API.kick(5);
    if (p.hp <= 0.001) kill(p, why); else { p.inv = 1.0; pop(p.x, p.y - 74, "−" + (Math.round(amt * 100) / 100) + " armour", "#ff8080"); }
  }
  function kill(p, why) {
    if (p.dead > 0 || p.out) return;
    if (S.god) { if (why === "fell" || why === "swept") { respawn(p); } return; }
    p.lives--; p.dead = 1.4; p.vy = -520; p.vx = -p.face * 150; p.hp = 0; p.flip = false;
    var lv = p.wpn[p.cur]; if (up("memory")) {} else if (p.cur !== "sine") { if (lv > 1) p.wpn[p.cur]--; else { delete p.wpn[p.cur]; p.cur = "sine"; } } else if (lv > 1) p.wpn.sine--;
    API.sound.sfx("ko"); API.buzz([80, 40, 140]); API.kick(10); API.burst(p.x, p.y - 30, "#ffd86b", 18, 260); API.flash("#ff3355", .25);
    pop(p.x, p.y - 90, why === "fell" || why === "swept" ? "Out of bounds!" : "Knocked out!", "#ff8080");
  }
  function checkOver() {
    if (S.ps.some(function (p) { return !p.out; })) return;
    S.phase = "over"; API.music(MENU_SONG); var overK = S.k;
    if (S.surv) { setTimeout(function () { if (S.phase === "over") survivalOver(); }, 900); return; }
    setTimeout(function () {
      if (S.phase !== "over") return;
      API.ceremony(S.cont > 0 ? "lose" : "eliminated", { title: "GAME OVER", sub: "Stage " + (overK + 1) + " · " + S.st.name, hero: S.ps[0] && S.ps[0].c, score: S.score, scoreLabel: "Score so far",
        stats: [["Machines broken", S.kills], ["Continues left", S.cont]], line: S.kills > 0 ? "You broke " + S.kills + " of Entropy's machines before they got you." : "A rough start. The first wave always looks worse than it is.",
        tip: "Keep moving and aim diagonally: most machines cannot track a target that changes height. Match the shield's frequency to cancel a beam.", then: function () {
      API.show("<h2>Count Entropy wins this round</h2><p>Score so far: <b>" + S.score.toLocaleString() + "</b>. " + (S.cont > 0 ? "You have <b>" + S.cont + "</b> continue" + (S.cont > 1 ? "s" : "") + " left; you restart right here with full lives." : "No continues left.") + "</p>" +
        "<div class='gm-actions'>" + (S.cont > 0 ? "<button class='gm-btn gm-btn--go' data-act='cont'>Continue</button>" : "") + "<button class='gm-btn" + (S.cont > 0 ? "" : " gm-btn--go") + "' data-act='retry'>Restart stage</button><button class='gm-btn' data-act='menu'>Menu</button></div>",
        function (a) {
          if (a === "cont") { S.cont--; S.score = Math.floor(S.score / 2); S.ps.forEach(function (p) { p.out = false; p.lives = S.dif.lives; respawn(p); }); S.phase = "play"; API.hide(); API.music(S.boss && !S.boss.dead ? (S.boss.isMid ? MID_SONGS[S.k] : BOSS_SONGS[S.k]) : SONGS[S.k]); }
          else { report("lose"); if (a === "retry") { S.cont = S.dif.cont; S.score = 0; S.ps.forEach(function (p) { p.out = false; p.lives = S.dif.lives; p.wpn = { sine: 1 }; p.cur = "sine"; }); startStage(S.k); } else menu(API); }
        }); } });
    }, 900);
  }
  function muzzle(p) {
    var cy = p.prone ? p.y - 12 : p.y - 36, len = p.prone ? 30 : 24;
    return { x: p.x + Math.cos(p.aim) * len, y: cy + Math.sin(p.aim) * len };
  }
  function fire(p) {
    var w = p.cur, lv = p.wpn[w] || 1, f = D.FREQS[p.fi], nm = D.nm(f), fac = D.damageFactor(f), m = muzzle(p), def = WP[w], a = p.aim;
    p.fireT = .07; p.shots++;
    if (w === "sine") {
      var offs = def.twin[lv - 1] ? [-7, 7] : [0];
      offs.forEach(function (o) { shot(m.x - Math.sin(a) * o, m.y + Math.cos(a) * o, a, def.speed, def.dmg[lv - 1] * fac, nm, "sine", p); });
      API.sound.sfx("laser");
    } else if (w === "spread") {
      D.gratingAngles(nm * 1e-9, def.d[lv - 1], 2).forEach(function (o) { shot(m.x, m.y, a + o.theta, def.speed, def.dmg[lv - 1] * def.weights[Math.abs(o.n)] * fac, nm, "spread", p, o.n); });
      API.sound.sfx("laser");
    } else if (w === "emp") {
      var R = def.radius[lv - 1] * (up("reach") ? 1.15 : 1), cx = p.x, cy = p.y - 30;
      S.rings.push({ x: cx, y: cy, r: 10, max: R, life: .4, col: "#9be7ff", emp: true });
      targets().forEach(function (t) {
        var tx = t.x, ty = t.cy(), r = Math.hypot(tx - cx, ty - cy) - t.rad; if (r > R) return;
        var k = D.empFactor(Math.max(1, r), def.r0), dm = def.dmg[lv - 1] * k;
        if (t.e) { if (t.e.k === "mine") { t.e.hp = 0; killFoe(t.e, p, true); pop(tx, ty - 20, "Fused", "#9be7ff"); return; }
          if (t.e.d.electronic) { t.e.stun = def.stun[lv - 1]; dm *= 1.5; } }
        t.hit(dm, { emp: true, k: k }, p);
        if (k < 1) pop(tx, ty - 30, "(r₀/r)² = " + k.toFixed(2), "#9be7ff");
      });
      API.sound.sfx("zap"); API.kick(3);
    } else if (w === "lance") {
      var range = def.range[lv - 1], lam = nm * 1e-9, best = [];
      targets().forEach(function (t) {
        var vx = t.x - m.x, vy = t.cy() - m.y, L = vx * Math.cos(a) + vy * Math.sin(a), y = -vx * Math.sin(a) + vy * Math.cos(a);
        if (L < 20 || L > range || Math.abs(Math.atan2(y, L)) > def.cone * Math.PI / 180) return;
        for (var q = 20; q < Math.hypot(vx, vy) - t.rad; q += 18) if (wallAt(m.x + vx * q / Math.hypot(vx, vy), m.y + vy * q / Math.hypot(vx, vy))) return; // walls block light
        var Iy = D.fringeI(y, lam, L, def.slit);
        if (Iy >= 0.5) { t.hit(def.dmg[lv - 1] * Iy * fac, { lance: true, nm: nm, from: Math.sign(Math.cos(a)) || 1 }, p); best.push([t.x, t.cy()]); }
        else if (Math.random() < .2) pop(t.x, t.cy() - 30, "dark fringe", "#8899aa");
      });
      S.beams.push({ p: p, x: m.x, y: m.y, a: a, range: range, nm: nm, life: 1 / def.rate[lv - 1] + .02, hits: best });
      if (++p.lanceT % 3 === 0) API.sound.sfx("zap");
    }
    p.cool = 1 / def.rate[lv - 1] / (up("cadence") ? 1.1 : 1);
  }
  function shot(x, y, a, sp, dmg, nm, kind, p, n) { if (up("focus")) dmg *= 1.1; S.shots.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: a, dmg: dmg, nm: nm, k: kind, p: p, n: n || 0, life: 1.2, ph: Math.random() * 6 }); }

  /* Everything a player can hit, as a uniform list */
  function targets() {
    var out = [];
    S.foes.forEach(function (e) { if (e.alive) out.push({ e: e, x: e.x, cy: function () { return e.fly || e.wall ? e.y : e.y - e.h / 2; }, rad: Math.max(e.w, e.h) / 2, hit: function (d, o, p) { hitFoe(e, d, o, p); } }); });
    var B = S.boss; if (B && !B.dead) out.push({ boss: B, x: B.x, cy: function () { return B.y; }, rad: Math.min(B.w, B.h) / 2, hit: function (d, o, p) { hitBoss(B, d, o, p); } });
    S.props.forEach(function (q) { if (q.hp > 0 && q.x < camR() + 40 && q.x + q.w > camL() - 40) out.push({ q: q, x: q.x + q.w / 2, cy: function () { return q.y + q.h / 2; }, rad: q.w / 2, hit: function (d) { hitProp(q, d); } }); });
    return out;
  }
  function collect(p, it) {
    it.gone = true; var x = it.x, y = it.y - 30;
    if (it.kind === "cap" && it.w8 === "shield") { p.wpn.shield = Math.min(3, (p.wpn.shield || 1) + 1); pop(x, y, "Polariser shield Lv " + p.wpn.shield + ": bigger, lighter", "#9be7ff"); API.sound.sfx("power"); }
    else if (it.kind === "cap") { var w = it.w8; p.wpn[w] = Math.min(3, (p.wpn[w] || 0) + 1); p.cur = w; pop(x, y, WP[w].name + " Lv " + p.wpn[w], "#ffd86b"); API.sound.sfx("power"); API.banner(WP[w].short + (p.wpn[w] > 1 ? " Lv" + p.wpn[w] : ""), { size: 54, y: 120, dur: 1.2, col: "#ffd86b" }); }
    else if (it.kind === "shield") { p.wpn.shield = Math.min(3, (p.wpn.shield || 1) + 1); pop(x, y, "Shield Lv " + p.wpn.shield, "#9be7ff"); API.sound.sfx("power"); }
    else if (it.kind === "medal") { addScore(500); pop(x, y, "+500", "#ffd86b"); API.sound.sfx("coin"); }
    else if (it.kind === "armor") { p.hp = Math.min(maxHp(), p.hp + 1); pop(x, y, "Armour +1", "#3dd68c"); API.sound.sfx("power"); }
    else if (it.kind === "cell") { S.found++; p.lives++; addScore(1000); pop(x, y, "Secret data cell! +1 life", "#c084fc"); API.sound.sfx("goal"); API.confetti(30, x - camL(), y - S.cam.y); }
  }
  function addScore(n) { n = Math.round(n * (up("bounty") ? 1.1 : 1) * (S.surv && S.surv.mods.glass ? 2 : 1)); S.score += n; S.stageScore += n; }
  function shieldSize(p) { return WP.shield.size[Math.max(1, p.wpn.shield || 1) - 1] * (up("wide") ? 1.15 : 1); }

  /* ---------- Enemies ---------- */
  function mkFoe(k, x, y, o) {
    o = o || {}; var d = EN[k];
    var hpm = S.dif.hp * (S.surv && S.surv.mods.heavy ? 1.4 : 1);
    var e = { k: k, d: d, x: x, y: y, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp * hpm, max: d.hp * hpm, t: Math.random() * 3, cool: 1 + Math.random() * 1.5, face: -1, flash: 0, stun: 0, alive: true,
      pol: o.pol === undefined ? null : o.pol, filter: o.filter, hang: o.hang, wall: o.wall, drop: o.drop, fly: !!d.fly, arena: o.arena, ground: false, ang: Math.PI, by: y, arm: 0, tele: 0 };
    if (k === "carrier") { e.x = Math.max(x, camR() + 40); e.by = y; e.vx = -d.speed; }
    if (e.hang) { e.y = y + d.h; }
    if (e.wall) { e.x = x + 20; e.fly = true; e.ang = e.wall > 0 ? 0 : Math.PI; }
    S.foes.push(e); return e;
  }
  function spawnCheck() {
    var sp = S.st.spawns, L = camL(), R = camR(), cy = S.cam.y + VH / 2;
    while (S.si < sp.length && sp[S.si].x < L - 300) S.si++;
    for (var i = S.si; i < sp.length && sp[i].x < R + 60; i++) {
      var s = sp[i]; if (s.done) continue;
      if (Math.abs(s.y - cy) > VH / 2 + 140) continue;
      s.done = true; var e = mkFoe(s.k, s.x, s.y, s);
      if (s.x < R - 40 && !e.fly && !s.hang && s.k !== "carrier") { e.warp = .5; API.burst(e.x, e.y - e.h / 2, "#c084fc", 8, 120); }
    }
  }
  function nearest(e) { var best = null, bd = Infinity; S.ps.forEach(function (p) { if (p.out || p.dead > 0) return; var d = Math.abs(p.x - e.x) + Math.abs(p.y - e.y) * .5; if (d < bd) { bd = d; best = p; } }); return best; }
  function eshot(x, y, a, kind, o) {
    o = o || {}; var sp = ({ shell: 250, beam: 520, bomb: 60, wave: 300, spec: 420 })[kind] * S.dif.shot * (o.sp || 1);
    if (S.surv && S.surv.mods.polar && (kind === "beam" || kind === "spec")) o.pol = 45;
    S.eshots.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, k: kind, pol: o.pol === undefined ? null : o.pol, nm: o.nm, life: 7, g: kind === "bomb" ? 900 : o.g || 0, r: kind === "shell" ? 7 : kind === "bomb" ? 8 : 4, dmg: o.dmg || 1, gy: o.gy });
  }
  function updateFoe(e, dt) {
    var d = e.d, p = nearest(e), inView = e.x > camL() - 60 && e.x < camR() + 60 && e.y > S.cam.y - 120 && e.y < S.cam.y + VH + 160;
    e.t += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.warp > 0) { e.warp -= dt; return; }
    if (e.stun > 0) { e.stun -= dt; if (e.fly && !e.wall) { e.y += 30 * dt; } if (Math.random() < .2) API.burst(e.x, e.y, "#9be7ff", 1, 80); return; }
    if (S.surv && S.surv.mods.fast) dt *= 1.25;
    var fire = function () { return (e.cool -= dt) <= 0 && inView && p; }, rate = d.rate * S.dif.fire, reset = function () { e.cool = (1 / rate) * rnd(.75, 1.25); };
    var px = p ? p.x : e.x - 100, py = p ? p.y - 30 : e.y;
    switch (e.k) {
      case "walker": case "filter":
        if (p) e.face = px < e.x ? -1 : 1;
        var want = p && Math.abs(px - e.x) > 200 ? e.face * d.speed : 0;
        if (want && e.ground && !solidAt(e.x + e.face * (e.w / 2 + 6), e.y + 6)) want = 0;
        e.vx = want; moveBody(e, dt, GRAV * gAt(e.x));
        if (fire()) { reset(); var a = Math.atan2(py - (e.y - 40), px - e.x); eshot(e.x + e.face * 18, e.y - 40, a, "shell"); }
        break;
      case "runner":
        if (!e.vx) e.vx = (p && px > e.x ? 1 : -1) * d.speed; moveBody(e, dt, GRAV); if (e.wall) e.vx = -e.vx || -d.speed; e.face = Math.sign(e.vx); e.spin = (e.spin || 0) + e.vx * dt / 15; break;
      case "jumper":
        if (e.ground) { e.vx = 0; e.jt = (e.jt || 0) + dt; if (e.jt > .8 && p && inView) { e.jt = 0; e.vy = -d.jump * rnd(.8, 1.05); e.vx = Math.sign(px - e.x) * d.speed * rnd(.8, 1.3); e.face = Math.sign(e.vx); } }
        moveBody(e, dt, GRAV * gAt(e.x)); break;
      case "turret":
        if (p) { var ta = Math.atan2(py - e.y + (e.hang ? e.h : e.h * .6), px - e.x); if (e.hang) ta = clamp(ta, .15, Math.PI - .15); else if (!e.wall) ta = ta > 0 ? (ta < Math.PI / 2 ? -.12 : Math.PI + .12) : ta; else ta = e.wall > 0 ? clamp(ta, -1.2, 1.2) : (ta > 0 ? Math.max(ta, Math.PI - 1.2) : Math.min(ta, -Math.PI + 1.2)); e.ang += Math.atan2(Math.sin(ta - e.ang), Math.cos(ta - e.ang)) * Math.min(1, dt * 4); }
        if (!e.hang && !e.wall) moveBody(e, dt, GRAV);
        e.tele = e.cool < .4 && inView ? 1 : 0;
        if (fire()) { reset(); var my = e.hang ? e.y - e.h + 20 : e.wall ? e.y : e.y - e.h * .6; eshot(e.x + Math.cos(e.ang) * 26, my + Math.sin(e.ang) * 26, e.ang, "beam", { pol: e.pol }); }
        break;
      case "tower":
        if (p) e.face = px < e.x ? -1 : 1; moveBody(e, dt, GRAV);
        e.tele = e.cool < .55 && inView ? 1 : 0;
        if (fire()) { reset(); var a2 = clamp(Math.atan2(py - (e.y - 62), (px - e.x) || 1), -.35, .35); if (e.face < 0) a2 = Math.PI - clamp(Math.atan2(py - (e.y - 62), e.x - px), -.35, .35);
          eshot(e.x + e.face * 14, e.y - 62, a2, "beam", { pol: e.pol }); eshot(e.x + e.face * 14, e.y - 62, a2, "beam", { pol: e.pol, sp: .93 }); }
        break;
      case "drone":
        if (p) { var tx = px + (e.side || (e.side = Math.random() < .5 ? -1 : 1)) * 120, ty = p.y - 210; e.vx += (clamp(tx - e.x, -1, 1) * d.speed - e.vx) * dt * 2; e.vy += ((ty - e.y) * 1.5 - e.vy) * dt * 2; }
        e.x += e.vx * dt; e.y += (e.vy + Math.sin(e.t * 4) * 20) * dt; e.face = e.vx < 0 ? -1 : 1;
        if (fire() && Math.abs(px - e.x) < 160) { reset(); eshot(e.x, e.y + 12, Math.PI / 2, "bomb"); }
        break;
      case "mine":
        e.y = e.by + Math.sin(e.t * 2) * 8;
        if (p && Math.hypot(p.x - e.x, p.y - 28 - e.y) < 90 && !e.arm) e.arm = .6;
        if (e.arm) { e.arm -= dt; if (e.arm <= 0) { e.hp = 0; killFoe(e, null); } }
        break;
      case "carrier":
        e.x += e.vx * dt; e.y = e.by + Math.sin(e.t * 2.2) * 26; if (e.x < camL() - 120) e.alive = false; break;
      case "splitter": // rolls toward you; breaking it releases two scatter wheels
        if (p) e.face = px < e.x ? -1 : 1; e.vx = p && Math.abs(px - e.x) > 30 ? e.face * d.speed : 0;
        if (e.ground && !solidAt(e.x + e.face * (e.w / 2 + 6), e.y + 6)) e.vx = 0; moveBody(e, dt, GRAV * gAt(e.x)); e.spin = (e.spin || 0) + e.vx * dt / 20; break;
      case "warden": // advances behind a plate; turns slowly, so flanking works
        if (p) { var wantF = px < e.x ? -1 : 1; e.turn = (e.turn || 0) + dt; if (wantF !== e.face && e.turn > 1.4) { e.face = wantF; e.turn = 0; } }
        e.vx = p && Math.abs(px - e.x) > 150 ? e.face * d.speed : 0; if (e.ground && !solidAt(e.x + e.face * (e.w / 2 + 6), e.y + 6)) e.vx = 0;
        moveBody(e, dt, GRAV * gAt(e.x));
        if (fire()) { reset(); eshot(e.x + e.face * 22, e.y - 44, Math.atan2(py - (e.y - 44), px - e.x), "shell"); }
        break;
      case "sniper": // locks on for aimT seconds (aim line shown), then fires one fast polarised beam
        moveBody(e, dt, GRAV); if (p) e.face = px < e.x ? -1 : 1;
        if (e.aimT > 0) { e.aimT -= dt; if (p && e.aimT > .25) e.ang = Math.atan2(py - (e.y - 46), px - e.x); if (e.aimT <= 0) { eshot(e.x + Math.cos(e.ang) * 20, e.y - 46 + Math.sin(e.ang) * 20, e.ang, "beam", { pol: e.pol, sp: 1.6 }); API.sound.sfx("laser"); } }
        else if (fire()) { reset(); e.aimT = d.aimT; e.ang = Math.atan2(py - (e.y - 46), px - e.x); }
        e.tele = e.aimT > 0 ? 1 : 0; break;
    }
    if (e.fly && !e.wall) { e.x = clamp(e.x, camL() - 200, camR() + 200); }
    if (e.arena && S.lock) { var cxA = clamp(e.x, S.lock.x0 + 20, S.lock.x1 - 20); if (cxA !== e.x && (e.k === "runner" || e.k === "splitter")) e.vx = cxA > e.x ? Math.abs(e.vx) : -Math.abs(e.vx); e.x = cxA; /* bounce off the arena edge instead of parking out of reach */ if (e.fly) e.y = clamp(e.y, S.cam.y + 30, S.cam.y + VH - 60); }
    if (!e.fly && !e.hang && e.y > bandAt(e.x).bottom + 200) e.alive = false;
    if (e.x < camL() - 400 && !e.arena) e.alive = false;
    // contact
    S.ps.forEach(function (q) { if (q.dead > 0 || q.out || e.k === "carrier") return; var ey = e.fly || e.wall ? e.y + e.h / 2 : e.hang ? e.y : e.y;
      if (Math.abs(q.x - e.x) < (q.w + e.w) / 2 - 4 && q.y > ey - e.h + 4 && q.y - q.h < ey - 4) { if (e.k === "mine") { e.hp = 0; killFoe(e, null); } else hurt(q, 1, e.d.name); } });
  }
  function hitFoe(e, dmg, o, p) {
    if (!e.alive || e.warp > 0) return false;
    if (e.k === "filter" && !o.emp) {
      var b = D.FILTERS[e.filter], front = o.from == null ? true : o.from * e.face < 0;
      if (front && (o.nm < b[0] || o.nm > b[1])) { if (Math.random() < .5) pop(e.x, e.y - 70, Math.round(o.nm) + " nm absorbed (passes " + b[0] + "–" + b[1] + ")", "#c9d2dc"); API.sound.sfx("block"); return false; }
    }
    if (e.k === "warden" && !o.emp && !o.lance) { // the plate faces e.face; shots from in front bounce unless they come steeply from above
      var fromFront = o.from == null ? true : o.from * e.face < 0, steep = o.vy != null && o.vy > 0 && Math.abs(o.vy) > Math.abs(o.vx || 0) * 1.2;
      if (fromFront && !steep) { if (Math.random() < .35) pop(e.x, e.y - 72, "Plate! Flank it or use the EMP", "#c9d2dc"); API.sound.sfx("block"); return false; }
    }
    e.hp -= dmg; e.flash = .08; if (p) p.hits++;
    if (e.hp <= 0) killFoe(e, p);
    return true;
  }
  function killFoe(e, p, quiet) {
    if (!e.alive) return; e.alive = false; S.kills++;
    addScore(e.d.score);
    var cy = e.fly || e.wall ? e.y : e.y - e.h / 2;
    if (e.k === "mine" && !quiet) { blast(e.x, e.y, e.d.blast); return; }
    boom(e.x, cy, e.k === "carrier" ? 1.4 : 1, "#c084fc");
    if (e.k === "splitter") for (var si = 0; si < e.d.splits; si++) { var ch = mkFoe("runner", e.x + (si ? 18 : -18), e.y, { arena: e.arena }); ch.vx = (si ? 1 : -1) * EN.runner.speed; ch.warp = .15; }
    if (e.drop) S.items.push({ x: e.x, y: cy, vx: 0, vy: -380, kind: "cap", w8: e.drop, w: 24, h: 18, bob: 0 });
    else if (Math.random() < .05) S.items.push({ x: e.x, y: cy, vx: 0, vy: -300, kind: Math.random() < .5 ? "armor" : "medal", w: 20, h: 20, bob: 0 });
  }
  function blast(x, y, R) {
    boom(x, y, 1.6, "#ff7a3d"); S.rings.push({ x: x, y: y, r: 6, max: R, life: .35, col: "#ff7a3d" });
    S.ps.forEach(function (p) { if (Math.hypot(p.x - x, p.y - 28 - y) < R) hurt(p, 1, "Mine blast"); });
    S.foes.forEach(function (e) { if (e.alive && e.k !== "mine" && Math.hypot(e.x - x, e.y - y) < R) hitFoe(e, 3, { emp: true }, null); });
  }
  function hitProp(q, dmg) {
    if (q.hp <= 0) return; q.hp -= dmg; q.flash = .08;
    if (q.hp <= 0) {
      boom(q.x + q.w / 2, q.y + q.h / 2, q.kind === "tank" ? 1.8 : 1.1, q.kind === "tank" ? "#ff7a3d" : "#c9a36b"); addScore(50);
      if (q.kind === "tank") S.foes.forEach(function (e) { if (e.alive && Math.hypot(e.x - q.x, e.y - q.y) < 130) hitFoe(e, 8, { emp: true }, null); });
      if (q.kind === "cracked") pop(q.x + q.w / 2, q.y - 10, "A hidden passage!", "#c084fc");
      if (q.drop) S.items.push({ x: q.x + q.w / 2, y: q.y + q.h / 2, vx: 0, vy: -300, kind: q.drop, w: 20, h: 20, bob: 0 });
      refreshNear();
    }
  }

  /* ---------- Bosses and mid-bosses (one engine; attacks are data in shooterdata.js) ---------- */
  function mkBoss(ev, isMid) {
    var def = (isMid ? D.MIDS : D.BOSSES)[ev.boss], gy = surfaceAt(ev.x0 + 30, -1e9);
    var B = { def: def, key: ev.boss, isMid: isMid, name: def.name, look: def.look, move: def.move, w: def.w, h: def.h, x: ev.x1 + def.w, y: gy - def.h / 2, gy: gy, x0: ev.x0, x1: ev.x1,
      ph: 0, hp: def.hp[0] * S.dif.hp, phMax: def.hp[0] * S.dif.hp, t: 0, cool: 2.2, ai: 0, tele: 0, flash: 0, inv: 1.6, dead: 0, dash: 0, hits: 0, filter: def.filters ? def.filters[0] : null, total: 0 };
    B.total = def.hp.reduce(function (a, b) { return a + b; }, 0) * S.dif.hp; B.left = B.total;
    if (B.move === "hover" || B.move === "orbit") B.y = gy - 300;
    return B;
  }
  function bossHome(B, dt) {
    var t = B.t, mid = (B.x0 + B.x1) / 2, tx = B.x, ty = B.y;
    if (B.dash > 0) { B.dash -= dt; tx = B.dashTo; ty = B.move === "orbit" ? B.gy - 140 : B.y; B.x += clamp(tx - B.x, -700 * dt, 700 * dt); B.y += (ty - B.y) * Math.min(1, dt * 3); if (B.dash <= 0) B.dashTo = null; return; }
    if (B.move === "walk") { tx = B.x1 - B.w / 2 - 60 - (Math.sin(t * .55) * .5 + .5) * 300; ty = B.gy - B.h / 2; }
    else if (B.move === "charge") { tx = B.x1 - B.w / 2 - 40; ty = B.gy - B.h / 2; }
    else if (B.move === "wall") { tx = B.x1 - B.w / 2 - 10; ty = B.gy - B.h / 2 - 30 + Math.sin(t * .7) * 50; }
    else if (B.move === "hover") { tx = Math.min(B.x1 - B.w / 2 - 20, B.x1 - 250 + Math.sin(t * .45) * 170); ty = Math.max(B.gy - 470 + B.h / 2, B.gy - 300 + Math.sin(t * .9) * 45); }
    else if (B.move === "orbit") { tx = mid + Math.cos(t * .6) * 290; ty = B.gy - 270 + Math.sin(t * 1.2) * 80; }
    B.x += (tx - B.x) * Math.min(1, dt * 2.2); B.y += (ty - B.y) * Math.min(1, dt * 2.2);
  }
  function mouth(B) { return { x: B.x - B.w * .32, y: B.y + (B.look === "hydra" ? 0 : B.h * .05) }; }
  function bossAttack(B, at) {
    var o = at[1] || {}, m = mouth(B), p = nearest(B) || S.ps[0], pa = Math.atan2(p.y - 30 - m.y, p.x - m.x), i, n;
    switch (at[0]) {
      case "fan": n = o.n; for (i = 0; i < n; i++) eshot(m.x, m.y, pa + (i - (n - 1) / 2) * (o.spread / Math.max(1, n - 1)) * Math.PI / 180, o.kind); API.sound.sfx("laser"); break;
      case "aim": for (i = 0; i < 3; i++) eshot(m.x - Math.cos(pa) * i * 26, m.y - Math.sin(pa) * i * 26, pa, o.kind, { pol: o.pol }); API.sound.sfx("laser"); break;
      case "slam": eshot(B.x - B.w / 2, B.gy - 13, Math.PI, "wave", { gy: B.gy }); if (B.x + B.w / 2 < B.x1 - 40) eshot(B.x + B.w / 2, B.gy - 13, 0, "wave", { gy: B.gy }); API.kick(8); API.sound.sfx("stomp"); break;
      case "lob": for (i = 0; i < o.n; i++) eshot(m.x, m.y - 20, -Math.PI / 2 - rnd(.2, 1.1), "shell", { g: 700, sp: rnd(1.6, 2.6) }); API.sound.sfx("kick"); break;
      case "summon": for (i = 0; i < o.n; i++) { var e = mkFoe(o.kind, B.x - B.w / 2 - 30 - i * 40, o.kind === "drone" ? B.gy - 280 : B.gy, { arena: true }); e.warp = .4; } break;
      case "mines": for (i = 0; i < o.n; i++) mkFoe("mine", rnd(B.x0 + 120, B.x1 - 200), B.gy - rnd(90, 260), { arena: true }); break;
      case "sweep": B.sweep = { t: 0, a0: pa - .6, a1: pa + .6, pol: o.pol, n: 0 }; break;
      case "rain": for (i = 0; i < o.n; i++) eshot(rnd(B.x0 + 40, B.x1 - 40), S.cam.y - 20 - i * 40, Math.PI / 2, "shell", { sp: 1.1 }); API.sound.sfx("laser"); break;
      case "bombs": for (i = 0; i < o.n; i++) eshot(B.x - B.w / 2 + i * B.w / o.n, B.y + B.h / 2, Math.PI / 2 + rnd(-.3, .3), "bomb", { sp: rnd(2, 4) }); break;
      case "heads": o.pols.forEach(function (pol, j) { var hx = B.x - 90 + j * 90, hy = B.y - 70 - Math.sin(B.t * 2 + j) * 20, ha = Math.atan2(p.y - 30 - hy, p.x - hx); eshot(hx, hy, ha, "beam", { pol: pol }); eshot(hx - Math.cos(ha) * 24, hy - Math.sin(ha) * 24, ha, "beam", { pol: pol }); }); API.sound.sfx("laser"); break;
      case "spectrum": n = o.n; for (i = 0; i < n; i++) eshot(m.x, m.y, Math.PI + (i - (n - 1) / 2) * .16 + (pa - Math.PI) * .5, "spec", { nm: 410 + i * 290 / Math.max(1, n - 1) }); API.sound.sfx("special"); break;
      case "ring": n = o.n; for (i = 0; i < n; i++) eshot(B.x, B.y, i / n * Math.PI * 2 + B.t, "shell"); API.sound.sfx("laser"); break;
      case "disorder": for (i = 0; i < o.n; i++) eshot(B.x + rnd(-40, 40), B.y + rnd(-40, 40), rnd(0, Math.PI * 2), "shell", { sp: rnd(.6, 1.4) }); API.sound.sfx("special"); break;
      case "charge": B.dash = 1.6; B.dashTo = B.dashTo == null ? (B.x > (B.x0 + B.x1) / 2 ? B.x0 + B.w / 2 + 30 : B.x1 - B.w / 2 - 30) : B.dashTo; API.sound.sfx("dash"); break;
    }
  }
  function updateBoss(B, dt) {
    B.t += dt; B.flash = Math.max(0, B.flash - dt);
    if (B.dead > 0) { B.dead -= dt; B.y += 30 * dt; if (Math.random() < dt * 12) boom(B.x + rnd(-B.w / 2, B.w / 2), B.y + rnd(-B.h / 2, B.h / 2), rnd(.8, 1.6)); if (B.dead <= 0) bossGone(B); return; }
    if (B.inv > 0) B.inv -= dt;
    bossHome(B, dt);
    if (B.sweep) { var sw = B.sweep; sw.t += dt; if (sw.t > .5 && sw.n < 14 && sw.t > .5 + sw.n * .07) { var m = mouth(B); eshot(m.x, m.y, sw.a0 + (sw.a1 - sw.a0) * sw.n / 13, "beam", { pol: sw.pol }); sw.n++; if (sw.n % 3 === 0) API.sound.sfx("laser"); } if (sw.n >= 14) B.sweep = null; }
    if (B.inv > 0) return;
    if (B.tele > 0) { B.tele -= dt; if (B.tele <= 0) bossAttack(B, B.next); }
    else if ((B.cool -= dt) <= 0) { var ph = B.def.phases[B.ph]; B.next = ph.att[B.ai++ % ph.att.length]; B.tele = .45; B.cool = ph.every / Math.sqrt(S.dif.fire); }
    S.ps.forEach(function (p) { if (p.dead > 0 || p.out) return; if (Math.abs(p.x - B.x) < B.w / 2 + 6 && p.y > B.y - B.h / 2 + 10 && p.y - p.h < B.y + B.h / 2) hurt(p, 1, B.name); });
  }
  function hitBoss(B, dmg, o, p) {
    if (B.dead > 0 || B.inv > 0) return false;
    if (B.filter && !o.emp) { var b = D.FILTERS[B.filter]; if (o.nm < b[0] || o.nm > b[1]) { if (Math.random() < .3) pop(B.x, B.y - B.h / 2 - 10, Math.round(o.nm) + " nm reflected: armour passes only " + b[0] + "–" + b[1] + " nm", "#c9d2dc"); API.sound.sfx("block"); return false; } }
    if (o.emp && B.def.empWeak) dmg *= B.def.empWeak; if (o.emp && B.filter) dmg *= .5;
    B.hp -= dmg; B.left -= dmg; B.flash = .06; B.hits++; if (p) p.hits++; addScore(5);
    if (B.hits % 12 === 0 || o.emp) API.hitstop(.03);
    if (B.hp <= 0) {
      if (B.ph < B.def.hp.length - 1) {
        B.ph++; B.hp = B.phMax = B.def.hp[B.ph] * S.dif.hp; B.inv = 1.1; B.tele = 0; B.cool = 1.2; B.sweep = null; B.filter = B.def.filters ? B.def.filters[B.ph] : null;
        if (B.def.pod && B.ph >= B.def.pod && B.look !== "pod") { B.look = "pod"; B.w = 150; B.h = 110; B.move = "orbit"; pop(B.x, B.y - 120, "Count Entropy ejects in his escape pod!", "#c084fc"); API.sound.say("You have not seen the last of me!"); }
        API.hitstop(.14); API.flash("#ffffff", .2); boom(B.x, B.y, 2.2); API.zoom(.06, B.x - camL(), B.y - S.cam.y);
        API.banner("PHASE " + (B.ph + 1), { size: 64, y: 140, dur: 1.4, col: "#ff9d5c", edge: "#6b2a00" });
        if (B.filter) { var f = D.FILTERS[B.filter]; pop(B.x, B.y - B.h / 2 - 30, "Prism armour: only " + f[0] + "–" + f[1] + " nm gets through. Tune f!", "#ffd86b"); }
      } else { B.dead = 2.2; B.hp = 0; B.sweep = null; API.hitstop(.2); API.slowmo(.3, 1.6); API.flash("#ffffff", .35); API.zoom(.1, B.x - camL(), B.y - S.cam.y); API.sound.sfx("ko"); API.buzz([100, 50, 200]);
        S.eshots.length = 0; S.foes.forEach(function (e) { if (e.arena && e.alive) killFoe(e, null, true); }); }
    }
    return true;
  }
  function bossGone(B) {
    boom(B.x, B.y, 3); addScore(B.isMid ? 2000 : 5000 + S.k * 1000); S.boss = null;
    if (B.isMid) { API.banner("SMASHED!", { size: 80, col: "#3dd68c", edge: "#0b4a2a" }); unlock(); API.music(SONGS[S.k]); }
    else { S.bossDown = true; API.banner("BOSS DOWN", { col: "#ffd84a", sub: B.name, size: 96 }); API.sound.sfx("goal"); unlock(); API.music(SONGS[S.k]); if (S.k === 7) pop(B.x, B.y - 100, "Count Entropy's pod sputters away into the storm…", "#c084fc"); }
  }
  function unlock() { S.lock = null; S.ev = null; }

  /* ---------- Events: arenas, mid-bosses, bosses, lifts, auto-scroll ---------- */
  function events(dt) {
    var evs = S.st.events;
    evs.forEach(function (ev, i) {
      if (S.done[i]) return;
      if (ev.t === "scroll") { if (camL() >= ev.x0 - 2) { S.done[i] = true; S.scroll = ev; pop(camL() + VW / 2, S.cam.y + 150, "The city is moving: keep up!", "#ffd86b"); } return; }
      if (ev.t === "lift") { var mv = S.movers.filter(function (m) { return m.lift && m.x === ev.x0; })[0]; if (mv && S.ps.some(function (p) { return p.on === mv && !p.dead; })) { S.done[i] = true; startLift(ev, mv); } return; }
      if (camR() >= ev.x1 - 4 || S.ps.some(function (p) { return !p.out && p.x > ev.x0 + 420; })) {
        if (S.ps.every(function (p) { return p.out || p.dead > 0 || p.x > ev.x0 + 10; }) || camR() >= ev.x1 - 4) {
          S.done[i] = true; S.lock = { x0: ev.x0, x1: ev.x1 }; S.ev = ev;
          if (ev.t === "arena") { S.wave = { ev: ev, wi: -1, pend: [], gap: 1.2 }; API.banner("AMBUSH!", { size: 72, y: 150, dur: 1.4, col: "#ff9d5c", edge: "#6b2a00" }); }
          else { S.boss = mkBoss(ev, ev.t === "mid"); API.music(ev.t === "mid" ? MID_SONGS[S.k] : BOSS_SONGS[S.k]);
            API.banner(ev.t === "mid" ? "WARNING" : "BOSS", { sub: S.boss.name, col: ev.t === "mid" ? "#ff9d5c" : "#ff4d6d", edge: "#5a1020", size: ev.t === "mid" ? 84 : 120 });
            API.sound.say((ev.t === "mid" ? "Warning. " : "Boss. ") + S.boss.name); API.kick(6); }
        }
      }
    });
    if (S.wave) waves(dt);
    if (S.lift) liftStep(dt);
  }
  function waves(dt) {
    var W = S.wave, ev = W.ev;
    W.pend = W.pend.filter(function (s) { s.t -= dt; if (s.t > 0) return true;
      var left = s.side < 0, x = left ? Math.max(ev.x0 + 30, camL() + 30) : Math.min(ev.x1 - 30, camR() - 30), gy = surfaceAt(left ? ev.x0 + 30 : ev.x1 - 30, -1e9);
      var e = mkFoe(s.k, x, s.k === "drone" || s.k === "mine" ? gy - rnd(200, 300) : s.k === "jumper" ? gy - 300 : gy, { arena: true, filter: ["red", "green", "blue", "yellow"][Math.floor(Math.random() * 4)], pol: [0, 45, 90, null][Math.floor(Math.random() * 4)] });
      if (s.k === "runner") e.vx = left ? EN.runner.speed : -EN.runner.speed; e.face = left ? 1 : -1; e.warp = .35; API.burst(e.x, e.y - 20, "#c084fc", 8, 140);
      return false; });
    var alive = S.foes.some(function (e) { return e.alive && e.arena; });
    if (!W.pend.length && !alive) {
      if ((W.gap -= dt) > 0) return;
      W.wi++; W.gap = 1.0;
      if (W.wi >= ev.waves.length && ev.surv) { S.wave = null; addScore(300 + 40 * S.surv.n); pop(camL() + VW / 2, S.cam.y + 120, "Wave " + S.surv.n + " held", "#3dd68c"); return; }
      if (W.wi >= ev.waves.length) { if (up("mend")) S.ps.forEach(function (p) { if (!p.out) p.hp = Math.min(maxHp(), p.hp + 1); }); S.wave = null; unlock(); API.banner("AREA CLEAR", { size: 70, y: 150, dur: 1.4, col: "#3dd68c", edge: "#0b4a2a" }); API.sound.sfx("goal"); addScore(1000); return; }
      var wv = ev.waves[W.wi]; for (var j = 0; j < wv[1]; j++) W.pend.push({ k: wv[0], t: j * .55, side: j % 2 ? -1 : 1 });
      pop(camL() + VW / 2, S.cam.y + 120, "Wave " + (W.wi + 1) + " of " + ev.waves.length, "#ffd86b");
    }
  }
  function startLift(ev, mv) {
    S.lift = { ev: ev, mv: mv, go: true, t: 0, wi: 0 }; mv.go = true;
    S.ps.forEach(function (p) { if (!p.out && p.on !== mv) { p.x = clamp(p.x, ev.x0 + 40, ev.x1 - 40); p.y = mv.y; p.vy = 0; p.dead = 0; } });
    API.banner("GOING UP", { size: 64, y: 150, dur: 1.4, col: "#7ef0ff", edge: "#0b4a6e" }); API.sound.sfx("power");
  }
  function liftStep(dt) {
    var L = S.lift, ev = L.ev, mv = L.mv; L.t += dt;
    if (L.wi < ev.waves.length && L.t > 3 + L.wi * 5.5 && mv.y > mv.y1 + 200) {
      var wv = ev.waves[L.wi++];
      for (var j = 0; j < wv[1]; j++) { var side = j % 2 ? 1 : -1, x = side < 0 ? ev.x0 + 60 + j * 30 : ev.x1 - 60 - j * 30;
        var e = mkFoe(wv[0], x, wv[0] === "drone" ? mv.y - 330 : mv.y - 460, { arena: true }); e.warp = .3; }
    }
    if (mv.y <= mv.y1) { L.go = false; S.lift = null; API.banner("TOP FLOOR", { size: 60, y: 150, dur: 1.2, col: "#3dd68c", edge: "#0b4a2a" }); }
  }
  function moveMovers(dt) {
    S.movers.forEach(function (m) {
      var ox = m.x, oy = m.y;
      if (m.lift) { if (m.go && m.y > m.y1) m.y = Math.max(m.y1, m.y - m.speed * dt); }
      else { m.y = m.by + Math.sin(S.t * Math.PI * 2 / m.period + m.ph) * m.ay; }
      m.dx = m.x - ox; m.dy = m.y - oy;
      if (m.dx || m.dy) S.ps.concat(S.foes).forEach(function (b) { if (b.on === m) { b.x += m.dx; b.y += m.dy; } });
    });
  }

  /* ---------- Shots ---------- */
  function updateShots(dt) {
    var T = targets();
    S.shots = S.shots.filter(function (s) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.ph += dt * 30;
      if (s.life <= 0 || s.x < camL() - 40 || s.x > camR() + 40 || s.y < S.cam.y - 60 || s.y > S.cam.y + VH + 60) return false;
      var w = wallAt(s.x, s.y); if (w && w.hp != null) { hitProp(w, s.dmg); API.burst(s.x, s.y, "#c9a36b", 3, 120); return false; }
      if (w) { API.burst(s.x, s.y, D.colour(s.nm), 2, 100); return false; }
      for (var i = 0; i < T.length; i++) { var t = T[i]; if (t.q) continue; var e = t.e, B = t.boss, hw, hh, cy = t.cy();
        if (e) { hw = e.w / 2 + 3; hh = e.h / 2 + 3; } else { hw = B.w / 2; hh = B.h / 2; }
        if (Math.abs(s.x - t.x) < hw && Math.abs(s.y - cy) < hh) { t.hit(s.dmg, { nm: s.nm, from: Math.sign(s.vx), vx: s.vx, vy: s.vy }, s.p); API.burst(s.x, s.y, D.colour(s.nm), API.reduce ? 1 : 4, 150); return false; } }
      return true;
    });
    S.eshots = S.eshots.filter(function (s) {
      s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.k === "wave") { s.y = s.gy - 13; if (s.x < (S.lock ? S.lock.x0 : camL()) || s.x > (S.lock ? S.lock.x1 : camR())) return false; }
      if (s.life <= 0 || s.x < camL() - 80 || s.x > camR() + 80 || s.y > S.cam.y + VH + 80 || s.y < S.cam.y - 400) return false;
      if (s.k !== "wave" && wallAt(s.x, s.y)) { if (s.k === "bomb") { boom(s.x, s.y, .7); S.ps.forEach(function (p) { if (Math.hypot(p.x - s.x, p.y - 20 - s.y) < 46) hurt(p, 1, "Bomb"); }); } return false; }
      for (var i = 0; i < S.ps.length; i++) { var p = S.ps[i]; if (p.dead > 0 || p.out) continue;
        var front = Math.sign(s.vx) === -p.face;
        if (p.shield && front && s.k !== "wave") { var sz = shieldSize(p), sx = p.x + p.face * 20;
          if (Math.abs(s.x - sx) < 10 + s.r && s.y > p.y - 30 - sz / 2 && s.y < p.y - 30 + sz / 2) { shieldHit(p, s); return false; } }
        var hh = s.k === "wave" ? 13 : s.r;
        if (Math.abs(s.x - p.x) < p.w / 2 + s.r && s.y + hh > p.y - p.h && s.y - hh < p.y) { if (s.k === "bomb") boom(s.x, s.y, .6); hurt(p, s.dmg, s.k === "beam" ? "Polarised beam" : "Shell"); return false; } }
      return true;
    });
  }
  function shieldHit(p, s) {
    if (s.k === "beam" || s.k === "spec") {
      var T = D.transmit(p.sAng, s.pol), thr = s.pol == null ? "unpolarised: I₀/2" : "cos²(" + (function (d) { return Math.round(Math.min(d, 180 - d)); })(Math.abs(p.sAng - s.pol) % 180) + "°) = " + T.toFixed(2);
      pop(p.x, p.y - 90, thr, T < .05 ? "#3dd68c" : T < .6 ? "#ffd86b" : "#ff8080");
      API.burst(p.x + p.face * 20, s.y, "#9be7ff", 4, 120); API.sound.sfx("block");
      if (T > .02) hurt(p, s.dmg * T, "Beam through shield"); else addScore(10);
    } else { API.burst(p.x + p.face * 20, s.y, "#ffd86b", 4, 140); API.sound.sfx("block"); }
  }

  /* ---------- Main step ---------- */
  function step(dt) {
    S.t += dt; S.clock += dt; S.tipT = Math.max(0, S.tipT - dt);
    refreshNear(); moveMovers(dt);
    S.ps.forEach(function (p) { updatePlayer(p, dt); });
    spawnCheck(); events(dt); if (S.surv && S.phase === "play") survivalStep(dt);
    S.foes.forEach(function (e) { if (e.alive) updateFoe(e, dt); }); S.foes = S.foes.filter(function (e) { return e.alive; });
    if (S.boss) updateBoss(S.boss, dt);
    updateShots(dt);
    S.items.forEach(function (it) { if (it.gone || it.fixed) return; it.bob += dt; moveBody(it, dt, GRAV * .6); if (it.ground) it.vx = 0; if (it.y > bandAt(it.x).bottom + 200) it.gone = true; });
    S.items = S.items.filter(function (it) { return !it.gone && it.x > camL() - 300; });
    S.props.forEach(function (q) { if (q.flash) q.flash = Math.max(0, q.flash - dt); });
    S.debris = S.debris.filter(function (d) { d.life -= dt; d.vy += 1200 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; return d.life > 0; });
    S.rings = S.rings.filter(function (r) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 12); return r.life > 0; });
    S.pops = S.pops.filter(function (p) { p.life -= dt; p.y -= 28 * dt; return p.life > 0; });
    S.beams = S.beams.filter(function (b) { b.life -= dt; return b.life > 0; });
    camera(dt);
    if (S.bossDown && !S.flag && S.ps.some(function (p) { return !p.out && p.dead <= 0 && p.x >= S.st.finish; })) stageClear();
  }
  function camera(dt) {
    var live = S.ps.filter(function (p) { return !p.out && p.dead <= 0; }); if (!live.length) live = S.ps;
    var ax = 0, ay = 0, mn = Infinity; live.forEach(function (p) { ax += p.x; ay += p.y; mn = Math.min(mn, p.x); }); ax /= live.length; ay /= live.length;
    var want = Math.min(ax - VW * .4, mn - 60), c = S.cam;
    if (want > c.x) c.x += (want - c.x) * Math.min(1, dt * 6);
    if (S.scroll) { c.x += S.scroll.speed * dt; if (c.x >= S.scroll.x1) S.scroll = null; }
    if (S.lock) { if (c.x < S.lock.x0) c.x = Math.min(S.lock.x0, c.x + 900 * dt); c.x = Math.min(c.x, S.lock.x1 - VW);
      // an arena wider than the screen (phones): follow the player both ways so nothing can park out of sight and out of range
      if (S.lock.x1 - S.lock.x0 > VW + 4 && c.x >= S.lock.x0) { var both = clamp(ax - VW * .5, S.lock.x0, S.lock.x1 - VW); c.x += (both - c.x) * Math.min(1, dt * 5); } }
    else { var nx = S.st.events.filter(function (ev, i) { return !S.done[i] && ev.t !== "scroll" && ev.t !== "lift"; })[0]; if (nx) c.x = Math.min(c.x, nx.x1 - VW); }
    c.x = clamp(c.x, 0, S.st.len - VW);
    var bd = bandAt(ax + 0), ty = clamp(ay - VH * .7, bd.top, bd.bottom - VH);
    if (S.lift) ty = clamp(S.lift.mv.y - VH * .72, bd.top, bd.bottom - VH);
    c.y += (ty - c.y) * Math.min(1, dt * (S.lift ? 8 : 4));
  }
  function stageClear() {
    S.flag = true; S.phase = "clear"; S.clearAt = S.clock; var k = S.k, st = D.STAGES[k];
    var lives = S.ps.reduce(function (a, p) { return a + Math.max(0, p.lives); }, 0), tb = Math.max(0, Math.round((420 - S.clock) * 10));
    addScore(lives * 1000 + tb);
    API.sound.say("Stage clear!"); var wasBest = save.best[st.id] || 0;
    save.cleared = Math.max(save.cleared, Math.min(D.STAGES.length - 1, k + 1)); if (k === D.STAGES.length - 1) save.allClear = true; save.tut = true;
    save.best[st.id] = Math.max(save.best[st.id] || 0, S.stageScore); var earned = Math.max(1, Math.floor(S.stageScore / 100)); save.ph += earned; persist();
    report("win");
    var shots = S.ps.reduce(function (a, p) { return a + p.shots; }, 0), hits = S.ps.reduce(function (a, p) { return a + p.hits; }, 0), last = k === D.STAGES.length - 1;
    setTimeout(function () {
      API.ceremony(last ? "gameComplete" : k === 7 ? "champion" : S.stageScore > wasBest && wasBest > 0 ? "newRecord" : "win", { title: last ? "ECHO SILENCED!" : k === 7 ? "FORTRESS DARK!" : "STAGE CLEAR!", sub: st.name, hero: S.ps[0] && S.ps[0].c, trophy: last ? "crown" : "medal", colors: ["#7ef0ff", "#3dd68c", "#c084fc", "#ffffff"],
        score: S.stageScore, scoreLabel: "Stage score", stars: shots && hits / shots > .6 ? 3 : shots && hits / shots > .35 ? 2 : 1,
        stats: [["Time", Math.floor(S.clock / 60) + ":" + ("0" + Math.floor(S.clock % 60)).slice(-2)], ["Machines broken", S.kills], ["Secrets", S.found + " / " + S.st.secrets], ["Accuracy", shots ? Math.round(100 * hits / shots) + "%" : "–"], ["Photons", "+" + earned]],
        line: last ? "The last echo of Count Entropy's signal is gone. Order holds." : k === 7 ? "Count Entropy's fortress goes dark. But something still echoes beyond it..." : "Best moment: " + S.kills + " machines down in " + Math.floor(S.clock / 60) + ":" + ("0" + Math.floor(S.clock % 60)).slice(-2) + ".", then: function () {
      API.show("<h2>" + (last ? "The echo is silenced!" : k === 7 ? "The relay core is home!" : "Stage " + (k + 1) + " clear!") + "</h2>" + (last ? "<p>The last of Count Entropy's signal folds away. The relay network runs clean, powered by order: phase, wavelength and interference. Survival mode is waiting if you want more.</p>" : k === 7 ? "<p>Count Entropy's fortress goes dark and the city lights come back on. But his signal echoes on beyond the fortress: four more stages are now open.</p>" : "") + "<p class='gm-small'>+" + earned + " photons for upgrades (you have " + save.ph + ").</p>" +
        "<table><tr><td>Stage score</td><td><b>" + S.stageScore.toLocaleString() + "</b> (run total " + S.score.toLocaleString() + ")</td></tr><tr><td>Time</td><td>" + Math.floor(S.clock / 60) + ":" + ("0" + Math.floor(S.clock % 60)).slice(-2) + " (time bonus " + tb + ")</td></tr>" +
        "<tr><td>Machines broken</td><td>" + S.kills + "</td></tr><tr><td>Secrets</td><td>" + S.found + " / " + S.st.secrets + "</td></tr><tr><td>Hits per trigger pull</td><td>" + (shots ? (hits / shots).toFixed(2) : "–") + "</td></tr></table>" +
        "<div class='gm-actions'>" + (last ? "" : "<button class='gm-btn gm-btn--go' data-act='next'>Next stage</button>") + "<button class='gm-btn" + (last ? " gm-btn--go" : "") + "' data-act='again'>Replay stage</button><button class='gm-btn' data-act='menu'>Menu</button></div>",
        function (a) { if (a === "next") { S.stageScore = 0; startStage(k + 1); } else if (a === "again") { S.stageScore = 0; startStage(k); } else menu(API); }); } });
    }, 1400);
  }
  function report(result) {
    if (S.reported === S.k + ":" + result + ":" + S.clock) return; S.reported = S.k + ":" + result + ":" + S.clock;
    A.report("wavefront", { result: result, stage: S.k + 1, score: Math.min(5000, Math.round(S.stageScore / 10)), mode: S.mode === "duo" ? "duo" : "solo" });
  }

  /* ---------- Drawing: backgrounds ---------- */
  var THEME = {
    coast: { sky: ["#1b2a5a", "#f08a5d"], far: "#3b3f73", mid: "#283456", ground: "#c9a46b", top: "#e9d29a", dirt: "#7a5a3a", sea: true },
    falls: { sky: ["#0f3b4a", "#7ccfc0"], far: "#1d5a5a", mid: "#16434a", ground: "#4a6b3a", top: "#7fbf5a", dirt: "#3a2e22" },
    plant: { sky: ["#0d1217", "#1d2731"], far: "#18222c", mid: "#222f3b", ground: "#3a4552", top: "#6b7a8a", dirt: "#2a323c", inside: true },
    tower: { sky: ["#060a1c", "#1e2a5a"], far: "#141c3c", mid: "#1a2448", ground: "#3a4256", top: "#7e8aa6", dirt: "#252c3c", stars: true },
    roofs: { sky: ["#2a1a4a", "#ff8a6b"], far: "#3a2a5a", mid: "#2a2040", ground: "#555a66", top: "#9aa0ad", dirt: "#3a3e48" },
    canyon: { sky: ["#3a1a4a", "#f2a65a"], far: "#7a3a5a", mid: "#5a2a4a", ground: "#a0603a", top: "#e09a5a", dirt: "#6a3a2a", crystals: true },
    orbit: { sky: ["#02030a", "#0a1030"], far: "#1a2244", mid: "#202a4a", ground: "#5a6378", top: "#a8b3c8", dirt: "#3a4255", stars: true, inside: true },
    fortress: { sky: ["#1a0a1f", "#5a1a3a"], far: "#2a1030", mid: "#3a1640", ground: "#3a2a44", top: "#7a5a8a", dirt: "#2a1a30", storm: true },
    dunes: { sky: ["#8a5a2a", "#f2c27a"], far: "#b07a4a", mid: "#9a6a3a", ground: "#c99a5a", top: "#f0cf8a", dirt: "#8a6038", haze: true },
    lagoon: { sky: ["#062a33", "#3aa6a0"], far: "#0e4048", mid: "#0b343c", ground: "#4a5a52", top: "#8fb3a3", dirt: "#2a3530", sea: true },
    market: { sky: ["#140a24", "#3a1f4a"], far: "#22163a", mid: "#2a1a40", ground: "#4a4250", top: "#a08aa8", dirt: "#2e2836", lamps: true },
    echo: { sky: ["#05010d", "#2a0f3f"], far: "#1a0a2e", mid: "#22103a", ground: "#2e2440", top: "#9a7ad0", dirt: "#1c1428", stars: true, storm: true },
    arena: { sky: ["#0a0f22", "#2a1a3a"], far: "#141a33", mid: "#1c2240", ground: "#3a3f52", top: "#8a93ad", dirt: "#262a38", stars: true }
  };
  function drawBack(x) {
    var th = THEME[S.def.theme], cx = S.cam.x, cy = S.cam.y, t = S.t, i;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    if (th.stars) { x.fillStyle = "rgba(255,255,255,.8)"; for (i = 0; i < 70; i++) { var sx = ((i * 137.5 - cx * .03) % 960 + 960) % 960, sy = ((i * 71.3 - cy * .03) % 540 + 540) % 540; x.fillRect(sx, sy, i % 7 ? 1.5 : 2.5, i % 7 ? 1.5 : 2.5); } }
    if (S.def.theme === "orbit") { var pg = x.createRadialGradient(760, 820 - cy * .02, 200, 760, 820, 520); pg.addColorStop(0, "#3a7bd5"); pg.addColorStop(.8, "#16306a"); pg.addColorStop(1, "rgba(22,48,106,0)"); x.fillStyle = pg; x.beginPath(); x.arc(760, 820 - cy * .02, 520, 0, 7); x.fill(); }
    if (th.haze) { x.fillStyle = "rgba(255,220,160,.18)"; for (i = 0; i < 5; i++) x.fillRect(0, 140 + i * 70 + Math.sin(t * .4 + i) * 10, 960, 26); }
    if (th.lamps) { for (i = 0; i < 14; i++) { var lx = ((i * 97 - cx * .2) % 1100 + 1100) % 1100 - 70, ly = 330 + (i % 3) * 18; x.fillStyle = "rgba(255," + (180 + (i * 23) % 60) + ",90," + (.55 + .35 * Math.sin(t * 3 + i)) + ")"; x.beginPath(); x.arc(lx, ly - cy * .05, 5, 0, 7); x.fill(); } }
    if (S.def.theme === "coast" || S.def.theme === "roofs" || S.def.theme === "canyon" || S.def.theme === "dunes") { x.fillStyle = "rgba(255,230,180,.85)"; x.beginPath(); x.arc(720, 170 - cy * .05, 46, 0, 7); x.fill(); }
    if (th.storm && !API.reduce && Math.floor(t * 1.3) % 11 === 0) { x.strokeStyle = "rgba(230,200,255,.8)"; x.lineWidth = 2; x.beginPath(); x.moveTo(300, 0); x.lineTo(280, 80); x.lineTo(310, 100); x.lineTo(270, 200); x.stroke(); }
    var py = function (f) { return (cy - (S.st.bands[0].bottom - 540)) * f; };
    // far layer
    x.fillStyle = th.far;
    for (i = -1; i < 7; i++) { var fx = ((i * 200 - cx * .12) % 1400 + 1400) % 1400 - 200, fy = 300 - py(.12), hgt = 80 + ((i * 53) % 90);
      if (S.def.theme === "roofs" || S.def.theme === "tower" || S.def.theme === "fortress") { x.fillRect(fx, fy - hgt, 120, 400); x.fillStyle = "rgba(255,216,107,.35)"; for (var wy = 0; wy < 5; wy++) for (var wx = 0; wx < 4; wx++) if ((i + wx + wy) % 3) x.fillRect(fx + 12 + wx * 26, fy - hgt + 16 + wy * 26, 10, 12); x.fillStyle = th.far; if (S.def.theme === "fortress" && i % 2) { x.beginPath(); x.moveTo(fx, fy - hgt); x.lineTo(fx + 60, fy - hgt - 70); x.lineTo(fx + 120, fy - hgt); x.fill(); } }
      else if (th.inside) { x.fillRect(fx, 0, 46, 540); x.fillRect(fx - 20, fy - 120, 200, 18); }
      else { x.beginPath(); x.moveTo(fx - 40, 560); x.quadraticCurveTo(fx + 100, fy - hgt, fx + 240, 560); x.fill(); } }
    if (th.sea) { x.fillStyle = "#24507a"; x.fillRect(0, 330 - py(.2), 960, 300); x.fillStyle = "rgba(255,255,255,.35)"; for (i = 0; i < 24; i++) x.fillRect(((i * 97 - cx * .25 + t * 20) % 1000 + 1000) % 1000 - 20, 340 + (i % 6) * 22 - py(.2), 26, 2); }
    // mid layer
    x.fillStyle = th.mid;
    for (i = -1; i < 6; i++) { var mx = ((i * 260 - cx * .35) % 1560 + 1560) % 1560 - 260, my = 380 - py(.35);
      if (S.def.theme === "coast" || S.def.theme === "tower") { x.strokeStyle = th.mid; x.lineWidth = 4; x.beginPath(); x.moveTo(mx, my + 200); x.lineTo(mx + 30, my - 180); x.lineTo(mx + 60, my + 200); for (var k = 0; k < 6; k++) { x.moveTo(mx + 5 + k * 4, my + 160 - k * 60); x.lineTo(mx + 55 - k * 4, my + 130 - k * 60); } x.stroke(); x.fillStyle = "#ff3355"; x.fillRect(mx + 27, my - 186, 6, 6); x.fillStyle = th.mid; }
      else if (S.def.theme === "falls") { x.fillRect(mx, my - 120, 150, 400); x.fillStyle = "rgba(200,240,255,.25)"; x.fillRect(mx + 50, my - 120, 30, 400); x.fillStyle = th.mid; }
      else if (th.inside) { x.beginPath(); x.arc(mx + 90, my - 60, 70, 0, 7); x.fill(); x.strokeStyle = "rgba(255,216,107,.25)"; x.lineWidth = 6; x.beginPath(); x.arc(mx + 90, my - 60, 50, t + i, t + i + 4); x.stroke(); }
      else if (th.crystals) { x.beginPath(); x.moveTo(mx, my + 160); x.lineTo(mx + 40, my - 90); x.lineTo(mx + 80, my + 160); x.fill(); x.fillStyle = ["rgba(255,80,80,.35)", "rgba(80,255,120,.35)", "rgba(80,140,255,.35)"][((i % 3) + 3) % 3]; x.beginPath(); x.moveTo(mx + 40, my - 90); x.lineTo(mx + 120, my - 40); x.lineTo(mx + 60, my); x.fill(); x.fillStyle = th.mid; }
      else { x.fillRect(mx, my - 60 - (i % 3) * 30, 180, 400); } }
  }
  /* ---------- Drawing: world ---------- */
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function drawWorld(x) {
    var th = THEME[S.def.theme], L = camL() - 60, R = camR() + 60, t = S.t;
    S.st.deco.forEach(function (d) { if (d.x > R || d.x + (d.w || 0) < L) return;
      if (d.t === "fall") { x.fillStyle = "rgba(170,225,255,.45)"; x.fillRect(d.x, d.y, d.w, 1400); x.fillStyle = "rgba(255,255,255,.5)"; for (var i = 0; i < 14; i++) x.fillRect(d.x + (i * 13) % d.w, d.y + ((i * 97 + t * 420) % 1400), 3, 40); }
      else if (d.t === "shaft" || d.t === "lift") { x.fillStyle = "rgba(10,14,30,.55)"; x.fillRect(d.x, d.y, d.w, d.h); x.strokeStyle = "rgba(126,240,255,.12)"; x.lineWidth = 2; for (var yy = d.y; yy < d.y + d.h; yy += 60) { x.beginPath(); x.moveTo(d.x, yy); x.lineTo(d.x + d.w, yy + 30); x.stroke(); } if (d.t === "lift") { x.fillStyle = "#555"; x.fillRect(d.x + 30, d.y, 8, d.h); x.fillRect(d.x + d.w - 38, d.y, 8, d.h); } }
      else if (d.t === "maze") { x.fillStyle = "rgba(20,28,36,.85)"; x.fillRect(d.x, d.y, d.w, d.h); x.strokeStyle = "rgba(255,216,107,.18)"; x.lineWidth = 8; for (var px = d.x + 40; px < d.x + d.w; px += 240) { x.beginPath(); x.moveTo(px, d.y); x.lineTo(px, d.y + d.h); x.stroke(); } x.fillStyle = "rgba(255,216,107,.5)"; for (var wx = d.x + 100; wx < d.x + d.w; wx += 320) { x.save(); x.translate(wx, d.y + 60); for (var s = 0; s < 6; s++) { x.fillStyle = s % 2 ? "#111" : "#e9c46a"; x.fillRect(s * 12, 0, 12, 10); } x.restore(); } }
      else if (d.t === "space") { x.fillStyle = "rgba(30,38,60,.9)"; x.fillRect(d.x, d.y, d.w, d.h); for (var sx = d.x + 80; sx < d.x + d.w - 60; sx += 300) { x.fillStyle = "#02030a"; rr(x, sx, d.y + 70, 160, 110, 30); x.fill(); x.fillStyle = "rgba(255,255,255,.8)"; for (var st = 0; st < 8; st++) x.fillRect(sx + 20 + (st * 37 + Math.floor(t * 8)) % 120, d.y + 85 + (st * 23) % 80, 2, 2); x.strokeStyle = "#8894aa"; x.lineWidth = 4; rr(x, sx, d.y + 70, 160, 110, 30); x.stroke(); }
        if (d.g < 1) { x.fillStyle = "rgba(126,240,255,.75)"; x.font = "700 15px system-ui"; x.textAlign = "left"; for (var gx = d.x + 40; gx < d.x + d.w; gx += 600) x.fillText("Spoke corridor: r = " + Math.round(d.g * 100) + "% of rim radius → a = ω²r = " + d.g.toFixed(2) + " g", gx, d.y + 230); } }
    });
    S.st.solids.forEach(function (s) { if (s.x > R || s.x + s.w < L) return;
      if (s.kind === "metal" || s.kind === "hull") { x.fillStyle = s.kind === "hull" ? "#4a5468" : "#3a4552"; x.fillRect(s.x, s.y, s.w, s.h); x.fillStyle = s.kind === "hull" ? "#8a96ae" : "#6b7a8a"; x.fillRect(s.x, s.y, s.w, 4); x.fillRect(s.x, s.y + s.h - 4, s.w, 4); x.fillStyle = "rgba(0,0,0,.25)"; for (var bx = s.x + 20; bx < s.x + s.w; bx += 60) x.fillRect(bx, s.y + 8, 3, Math.min(s.h - 16, 200)); }
      else if (s.kind === "roof") { x.fillStyle = "#454a55"; x.fillRect(s.x, s.y, s.w, s.h); x.fillStyle = "#9aa0ad"; x.fillRect(s.x - 4, s.y, s.w + 8, 8); x.fillStyle = "rgba(255,216,107,.4)"; for (var ry = s.y + 40; ry < s.y + 400; ry += 50) for (var rx = s.x + 20; rx < s.x + s.w - 20; rx += 46) x.fillRect(rx, ry, 18, 24); }
      else if (s.kind === "rock") { x.fillStyle = "#4a4a52"; rr(x, s.x, s.y, s.w, s.h, 14); x.fill(); x.fillStyle = "#6a8a5a"; x.fillRect(s.x + 6, s.y, s.w - 12, 6); }
      else { x.fillStyle = th.dirt; x.fillRect(s.x, s.y, s.w, s.h); x.fillStyle = th.ground; x.fillRect(s.x, s.y, s.w, 26); x.fillStyle = th.top; x.fillRect(s.x, s.y, s.w, 7); x.fillStyle = "rgba(0,0,0,.15)"; for (var gx2 = s.x + 14; gx2 < s.x + s.w - 10; gx2 += 38) x.fillRect(gx2, s.y + 34 + (gx2 % 3) * 12, 14, 6); }
    });
    S.st.plats.concat(S.movers).forEach(function (p) { if (p.x > R || p.x + p.w < L) return;
      if (p.lift) { x.fillStyle = "#5a6378"; x.fillRect(p.x, p.y, p.w, 18); x.fillStyle = "#e9c46a"; for (var s = 0; s < p.w; s += 40) x.fillRect(p.x + s, p.y, 20, 5); x.fillStyle = "#2a3040"; x.fillRect(p.x + 20, p.y + 18, p.w - 40, 30); return; }
      if (p.period) { x.fillStyle = "#7a5230"; rr(x, p.x, p.y, p.w, 16, 8); x.fill(); x.fillStyle = "#a06a3a"; x.fillRect(p.x + 8, p.y + 3, p.w - 16, 3); return; }
      x.fillStyle = th.inside ? "#56606e" : "#5a4a3a"; x.fillRect(p.x, p.y, p.w, 10); x.strokeStyle = th.inside ? "#8a96a6" : "#8a6a4a"; x.lineWidth = 2; x.beginPath(); for (var k = p.x; k < p.x + p.w - 10; k += 20) { x.moveTo(k, p.y + 10); x.lineTo(k + 10, p.y + 18); x.lineTo(k + 20, p.y + 10); } x.stroke(); });
    S.st.hazards.forEach(function (z) { if (z.x > R || z.x + z.w < L) return;
      if (z.kind === "spikes") { x.fillStyle = "#c9ced6"; for (var i = 0; i < z.w; i += 14) { x.beginPath(); x.moveTo(z.x + i, z.y + z.h); x.lineTo(z.x + i + 7, z.y); x.lineTo(z.x + i + 14, z.y + z.h); x.fill(); } }
      else if (z.kind === "water") { x.fillStyle = "rgba(60,150,200,.85)"; x.fillRect(z.x, z.y, z.w, 400); x.fillStyle = "rgba(255,255,255,.5)"; for (var w = 0; w < z.w; w += 50) x.fillRect(z.x + w + Math.sin(t * 3 + w) * 8, z.y + 4, 24, 3); }
      else if (z.kind === "arc") { var on = arcOn(z); x.fillStyle = "#555"; x.fillRect(z.x - 6, z.y - 4, 8, z.h + 4); x.fillRect(z.x + z.w - 2, z.y - 4, 8, z.h + 4);
        if (on) { x.strokeStyle = "#bfe9ff"; x.lineWidth = 3; x.beginPath(); x.moveTo(z.x, z.y + z.h / 2); for (var q = 1; q <= 6; q++) x.lineTo(z.x + z.w * q / 6, z.y + z.h / 2 + (q < 6 ? rnd(-z.h / 2, z.h / 2) : 0)); x.stroke(); }
        else { x.fillStyle = "rgba(191,233,255,.35)"; x.fillRect(z.x, z.y + z.h / 2 - 1, z.w * ((S.t + z.ph) % z.period - z.on) / (z.period - z.on), 2); } }
    });
    S.props.forEach(function (q) { if (q.hp <= 0 || q.x > R || q.x + q.w < L) return; drawProp(x, q); });
    S.items.forEach(function (it) { if (it.gone || hidden(it)) return; drawItem(x, it); });
    if (S.bossDown) { var fx = S.st.finish; x.fillStyle = "#ccc"; x.fillRect(fx, S.st.endY - 150, 6, 150); x.fillStyle = "#3dd68c"; x.beginPath(); x.moveTo(fx + 6, S.st.endY - 150); x.lineTo(fx + 70, S.st.endY - 128 + Math.sin(t * 6) * 4); x.lineTo(fx + 6, S.st.endY - 106); x.fill(); }
    if (S.lock && S.ev) { [S.lock.x0, S.lock.x1].forEach(function (gx) { x.fillStyle = "rgba(192,132,252," + (.25 + .15 * Math.sin(t * 6)) + ")"; x.fillRect(gx - 4, S.cam.y, 8, VH); }); }
  }
  function drawProp(x, q) {
    var fl = q.flash > 0;
    if (q.kind === "crate") { x.fillStyle = fl ? "#fff" : "#9a6a3a"; x.fillRect(q.x, q.y, q.w, q.h); x.strokeStyle = "#5a3a1a"; x.lineWidth = 3; x.strokeRect(q.x + 2, q.y + 2, q.w - 4, q.h - 4); x.beginPath(); x.moveTo(q.x + 3, q.y + 3); x.lineTo(q.x + q.w - 3, q.y + q.h - 3); x.moveTo(q.x + q.w - 3, q.y + 3); x.lineTo(q.x + 3, q.y + q.h - 3); x.stroke(); }
    else if (q.kind === "tank") { x.fillStyle = fl ? "#fff" : "#c0392b"; rr(x, q.x + 4, q.y, q.w - 8, q.h, 8); x.fill(); x.fillStyle = "#f6c445"; x.fillRect(q.x + 4, q.y + 14, q.w - 8, 8); x.fillStyle = "#111"; x.font = "800 9px system-ui"; x.textAlign = "center"; x.fillText("FUEL", q.x + q.w / 2, q.y + 21); }
    else if (q.kind === "ac") { x.fillStyle = fl ? "#fff" : "#8a929e"; x.fillRect(q.x, q.y, q.w, q.h); x.strokeStyle = "#444"; x.lineWidth = 2; x.beginPath(); x.arc(q.x + q.w / 2, q.y + q.h / 2, 15, 0, 7); x.stroke(); x.save(); x.translate(q.x + q.w / 2, q.y + q.h / 2); x.rotate(S.t * 8); x.fillStyle = "#444"; x.fillRect(-13, -2, 26, 4); x.fillRect(-2, -13, 4, 26); x.restore(); }
    else if (q.kind === "door") { x.fillStyle = fl ? "#fff" : "#6a7488"; x.fillRect(q.x, q.y, q.w, q.h); x.fillStyle = "#e9c46a"; for (var y = q.y + 10; y < q.y + q.h; y += 36) x.fillRect(q.x + 4, y, q.w - 8, 10); x.fillStyle = "#ff3355"; x.fillRect(q.x + q.w / 2 - 3, q.y + 20, 6, 6); }
    else if (q.kind === "cracked") { x.fillStyle = fl ? "#fff" : "#555c68"; x.fillRect(q.x, q.y, q.w, q.h); x.strokeStyle = "#2a2e36"; x.lineWidth = 2; x.beginPath(); x.moveTo(q.x + 6, q.y + 8); x.lineTo(q.x + q.w / 2, q.y + q.h / 2); x.lineTo(q.x + 10, q.y + q.h - 6); x.moveTo(q.x + q.w / 2, q.y + q.h / 2); x.lineTo(q.x + q.w - 4, q.y + 20); x.stroke(); }
    if (q.hp < q.max && q.hp > 0 && q.kind !== "cracked") { x.fillStyle = "rgba(0,0,0,.5)"; x.fillRect(q.x, q.y - 6, q.w, 3); x.fillStyle = "#ffd86b"; x.fillRect(q.x, q.y - 6, q.w * q.hp / q.max, 3); }
  }
  function wIcon(x, w, cx, cy, s, col) {
    x.save(); x.translate(cx, cy); x.scale(s, s); x.strokeStyle = col || "#fff"; x.fillStyle = col || "#fff"; x.lineWidth = 2.2; x.beginPath();
    if (w === "sine") { for (var i = 0; i <= 20; i++) { var px = -10 + i, py = Math.sin(i / 20 * Math.PI * 4) * 5; if (i) x.lineTo(px, py); else x.moveTo(px, py); } }
    else if (w === "spread") { [-35, -15, 0, 15, 35].forEach(function (a) { var r = a * Math.PI / 180; x.moveTo(-9, 0); x.lineTo(-9 + Math.cos(r) * 20, Math.sin(r) * 20); }); }
    else if (w === "emp") { x.arc(0, 0, 3, 0, 7); x.moveTo(7, 0); x.arc(0, 0, 7, 0, 7); x.moveTo(11, 0); x.arc(0, 0, 11, 0, 7); }
    else if (w === "lance") { x.moveTo(-10, -3); x.lineTo(10, -3); x.moveTo(-10, 3); x.lineTo(10, 3); for (var k = -8; k <= 8; k += 4) { x.moveTo(k, -7); x.lineTo(k, -5); x.moveTo(k, 5); x.lineTo(k, 7); } }
    else if (w === "shield") { x.arc(0, 0, 9, 0, 7); x.moveTo(-6, -6); x.lineTo(6, 6); x.moveTo(-9, -1); x.lineTo(1, 9); x.moveTo(-1, -9); x.lineTo(9, 1); }
    x.stroke(); x.restore();
  }
  function drawItem(x, it) {
    var b = it.fixed ? Math.sin(S.t * 3 + it.bob) * 4 : 0, cx = it.x, cy = it.y - 10 + b;
    if (it.kind === "cap") { x.fillStyle = "#2a3550"; rr(x, cx - 16, cy - 11, 32, 22, 11); x.fill(); x.strokeStyle = "#ffd86b"; x.lineWidth = 2; x.stroke(); wIcon(x, it.w8, cx, cy, .8, "#ffd86b"); }
    else if (it.kind === "cell") { var g = x.createRadialGradient(cx, cy, 2, cx, cy, 24); g.addColorStop(0, "rgba(192,132,252,.9)"); g.addColorStop(1, "rgba(192,132,252,0)"); x.fillStyle = g; x.fillRect(cx - 24, cy - 24, 48, 48); x.fillStyle = "#e9d5ff"; rr(x, cx - 8, cy - 12, 16, 24, 4); x.fill(); x.fillStyle = "#7c3aed"; x.fillRect(cx - 4, cy - 6, 8, 3); x.fillRect(cx - 4, cy + 1, 8, 3); }
    else if (it.kind === "medal") { x.fillStyle = "#f6c445"; x.beginPath(); x.arc(cx, cy, 9, 0, 7); x.fill(); x.fillStyle = "#8a5a00"; x.font = "800 10px system-ui"; x.textAlign = "center"; x.fillText("★", cx, cy + 4); }
    else if (it.kind === "armor" || it.kind === "shield") { x.fillStyle = "#3dd68c"; x.beginPath(); x.moveTo(cx, cy - 11); x.lineTo(cx + 10, cy - 6); x.lineTo(cx + 7, cy + 7); x.lineTo(cx, cy + 11); x.lineTo(cx - 7, cy + 7); x.lineTo(cx - 10, cy - 6); x.fill(); }
  }
  /* ---------- Drawing: actors ---------- */
  function drawPlayer(x, p) {
    if (p.out) return;
    if (p.inv > 0 && !p.dead && (API.reduce ? false : Math.floor(S.t * 16) % 2)) return;
    var c = p.c, f = p.face;
    x.save(); x.translate(p.x, p.y); if (p.inv > 0 && API.reduce) x.globalAlpha = .55;
    if (p.dead > 0) { x.translate(0, -26); x.rotate(-f * (1.4 - p.dead) * 5); A.drawHead(x, c, 0, -8, 13, f, { mood: "sad", hit: true }); x.restore();
      x.fillStyle = "#ffd86b"; x.font = "16px system-ui"; x.textAlign = "center"; for (var s = 0; s < 3; s++) { var a = S.t * 5 + s * 2.1; x.fillText("✦", p.x + Math.cos(a) * 18, p.y - 70 + Math.sin(a) * 6); } return; }
    if (p.flip) { x.translate(0, -24); x.rotate(p.spin * f); x.fillStyle = c.coat; x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill(); x.fillStyle = "#26303c"; x.beginPath(); x.arc(0, 0, 15, .2, 2.2); x.fill(); A.drawHead(x, c, 6, -6, 9, f, { mood: "fight" }); x.restore(); return; }
    var m = muzzle(p), gx = m.x - p.x, gy2 = m.y - p.y;
    if (p.prone) {
      x.fillStyle = "#26303c"; x.fillRect(-f * 30 - (f < 0 ? 0 : 0), -10, 30 * 1, 8); x.fillStyle = c.coat; x.fillRect(f > 0 ? -12 : -14, -16, 26, 12);
      A.drawHead(x, c, f * 20, -16, 11, f, { mood: "fight" });
    } else {
      var ph = Math.sin(p.run), air = !p.ground;
      x.strokeStyle = "#26303c"; x.lineWidth = 6; x.lineCap = "round"; x.beginPath();
      x.moveTo(-3, -24); x.lineTo(-3 + (air ? -6 : ph * 9), -2 + (air ? -6 : 0)); x.moveTo(3, -24); x.lineTo(3 + (air ? 8 : -ph * 9), -2 + (air ? -10 : 0)); x.stroke();
      x.fillStyle = c.coat; rr(x, -10, -44, 20, 24, 5); x.fill(); x.fillStyle = "#f4f4f0"; x.fillRect(-2, -44, 4, 10);
      A.drawHead(x, c, f * 2, -54, 12, f, { mood: p.hurt > 0 ? "sad" : "fight", blink: Math.floor(S.t * 2 + p.i) % 7 === 0 });
    }
    // arm + emitter
    var sy = p.prone ? -12 : -36; x.strokeStyle = c.skin; x.lineWidth = 5; x.beginPath(); x.moveTo(0, sy); x.lineTo(gx * .55, sy + (gy2 - sy) * .55); x.stroke();
    x.save(); x.translate(gx * .5, sy + (gy2 - sy) * .5); x.rotate(p.aim); x.fillStyle = "#2a3550"; rr(x, -4, -4, 20, 8, 3); x.fill(); x.fillStyle = D.colour(D.nm(D.FREQS[p.fi])); x.fillRect(10, -2, 6, 4); x.restore();
    if (p.fireT > 0 && p.cur !== "lance") { var col = p.cur === "emp" ? "#9be7ff" : D.colour(D.nm(D.FREQS[p.fi])); x.fillStyle = col; x.globalAlpha = .9; x.beginPath(); x.arc(gx, gy2, 6 + Math.random() * 4, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(gx, gy2, 3, 0, 7); x.fill(); x.globalAlpha = 1; }
    if (p.shield) { var sz = shieldSize(p), scx = f * 20, scy = -30;
      x.fillStyle = "rgba(155,231,255,.25)"; x.strokeStyle = "#9be7ff"; x.lineWidth = 2; x.beginPath(); x.ellipse(scx, scy, 10, sz / 2, 0, 0, 7); x.fill(); x.stroke();
      x.save(); x.beginPath(); x.ellipse(scx, scy, 10, sz / 2, 0, 0, 7); x.clip(); x.translate(scx, scy); x.rotate(p.sAng * Math.PI / 180); x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.5;
      for (var k = -40; k <= 40; k += 8) { x.beginPath(); x.moveTo(k, -60); x.lineTo(k, 60); x.stroke(); } x.restore();
      polIcon(x, scx + f * 26, scy - sz / 2 - 8, p.sAng, "#9be7ff", 9); }
    x.restore();
    if (S.mode === "duo") { x.fillStyle = p.i ? "#ff9d5c" : "#7ef0ff"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText("P" + (p.i + 1), p.x, p.y - p.h - 26); }
  }
  function polIcon(x, cx, cy, ang, col, r) { // double-headed arrow at angle from vertical; null = unpolarised star
    x.save(); x.translate(cx, cy); x.strokeStyle = col; x.lineWidth = 2;
    var list = ang == null ? [0, 45, 90, 135] : [ang];
    list.forEach(function (a) { x.save(); x.rotate(a * Math.PI / 180); x.beginPath(); x.moveTo(0, -r); x.lineTo(0, r); if (ang != null) { x.moveTo(-3, -r + 4); x.lineTo(0, -r); x.lineTo(3, -r + 4); x.moveTo(-3, r - 4); x.lineTo(0, r); x.lineTo(3, r - 4); } x.stroke(); x.restore(); });
    x.restore();
  }
  function bot(x, e, body, eye) { // shared robot palette
    var fl = e.flash > 0; x.fillStyle = fl ? "#fff" : body || "#3d1f5c"; return fl;
  }
  function drawFoe(x, e) {
    var t = e.t, f = e.face, k = e.k;
    if (e.warp > 0) { x.globalAlpha = 1 - e.warp * 1.6; }
    x.save(); x.translate(e.x, e.y);
    if (k === "walker" || k === "filter") {
      var ph = Math.sin(t * 8) * (e.vx ? 1 : 0); x.strokeStyle = "#2a2a36"; x.lineWidth = 6; x.beginPath(); x.moveTo(-6, -22); x.lineTo(-6 + ph * 7, 0); x.moveTo(6, -22); x.lineTo(6 - ph * 7, 0); x.stroke();
      bot(x, e); rr(x, -16, -52, 32, 32, 6); x.fill(); x.fillStyle = "#ff3355"; x.fillRect(f > 0 ? 2 : -14, -44, 12, 6); x.fillStyle = "#c084fc"; x.fillRect(-16, -26, 32, 4);
      x.fillStyle = "#555"; x.fillRect(f > 0 ? 10 : -28, -38, 18, 6);
      if (k === "filter") { var b = D.FILTERS[e.filter], col = D.colour((b[0] + b[1]) / 2); x.fillStyle = col.replace("rgb", "rgba").replace(")", ",.55)"); x.strokeStyle = "#ddd"; x.lineWidth = 2; rr(x, f * 20 - 7, -62, 14, 58, 5); x.fill(); x.stroke();
        x.fillStyle = "#fff"; x.font = "700 11px system-ui"; x.textAlign = "center"; x.fillText(b[0] + "–" + b[1] + " nm", 0, -68); }
    } else if (k === "runner") {
      x.translate(0, -15); x.rotate(e.spin || 0); bot(x, e, "#4b2b6b"); x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill(); x.strokeStyle = "#c084fc"; x.lineWidth = 3; for (var s = 0; s < 3; s++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(s * 2.1) * 14, Math.sin(s * 2.1) * 14); x.stroke(); }
      x.rotate(-(e.spin || 0)); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(f * 5, -3, 4, 0, 7); x.fill();
    } else if (k === "jumper") {
      var sq = e.ground ? 1 : 1.4; x.strokeStyle = "#9aa0ad"; x.lineWidth = 3; x.beginPath(); for (var c = 0; c < 6; c++) { x.lineTo(c % 2 ? 7 : -7, -c * 3 * sq); } x.stroke();
      bot(x, e); x.beginPath(); x.ellipse(0, -18 * sq - 10, 16, 13, 0, Math.PI, 0); x.fill(); x.fillRect(-16, -18 * sq - 10, 32, 6); x.fillStyle = "#ff3355"; x.fillRect(f * 4 - 5, -18 * sq - 18, 10, 5);
    } else if (k === "turret") {
      if (e.wall) { bot(x, e, "#4b2b6b"); rr(x, -18, -16, 36, 32, 6); x.fill(); x.save(); x.rotate(e.ang); x.fillStyle = "#333"; x.fillRect(0, -5, 30, 10); x.restore(); var oy = 0; }
      else if (e.hang) { x.translate(0, -e.h); bot(x, e, "#4b2b6b"); x.fillRect(-20, 0, 40, 18); x.beginPath(); x.arc(0, 18, 15, 0, Math.PI); x.fill(); x.save(); x.translate(0, 20); x.rotate(e.ang); x.fillStyle = "#333"; x.fillRect(0, -5, 28, 10); x.restore(); oy = 20; }
      else { bot(x, e, "#4b2b6b"); x.fillRect(-20, -18, 40, 18); x.beginPath(); x.arc(0, -18, 15, Math.PI, 0); x.fill(); x.save(); x.translate(0, -20); x.rotate(e.ang); x.fillStyle = "#333"; x.fillRect(0, -5, 28, 10); x.restore(); oy = -20; }
      if (e.tele) { x.fillStyle = "rgba(255,61,139," + (.5 + .5 * Math.sin(t * 30)) + ")"; x.beginPath(); x.arc(Math.cos(e.ang) * 26, oy + Math.sin(e.ang) * 26, 6, 0, 7); x.fill(); }
      polIcon(x, 0, e.hang ? 48 : e.wall ? -28 : -44, e.pol, "#ff9dc8", 8);
    } else if (k === "tower") {
      bot(x, e, "#2a1f3d"); x.fillRect(-10, -60, 20, 60); x.fillRect(-16, -4, 32, 4); x.fillStyle = e.flash > 0 ? "#fff" : "#4b2b6b"; x.beginPath(); x.arc(0, -64, 13, 0, 7); x.fill();
      x.fillStyle = e.tele ? "#ff3d8b" : "#a0446a"; x.beginPath(); x.arc(f * 8, -64, 5, 0, 7); x.fill();
      if (e.tele) { x.strokeStyle = "rgba(255,61,139,.35)"; x.setLineDash([6, 6]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(f * 14, -64); x.lineTo(f * 700, -64); x.stroke(); x.setLineDash([]); }
      polIcon(x, 0, -92, e.pol, "#ff9dc8", 9);
    } else if (k === "drone") {
      if (e.stun > 0) x.rotate(Math.sin(t * 20) * .2);
      bot(x, e); x.beginPath(); x.ellipse(0, 0, 18, 10, 0, 0, 7); x.fill(); x.fillStyle = e.stun > 0 ? "#555" : "#ff3355"; x.beginPath(); x.arc(f * 6, 1, 4, 0, 7); x.fill();
      x.strokeStyle = "#c084fc"; x.lineWidth = 2; var sp = e.stun > 0 ? 3 : Math.abs(Math.sin(t * 40)) * 14 + 4; x.beginPath(); x.moveTo(-14 - sp, -12); x.lineTo(-14 + sp, -12); x.moveTo(14 - sp, -12); x.lineTo(14 + sp, -12); x.moveTo(-14, -10); x.lineTo(-14, -4); x.moveTo(14, -10); x.lineTo(14, -4); x.stroke();
    } else if (k === "mine") {
      bot(x, e, "#3a3a44"); x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill(); x.strokeStyle = "#3a3a44"; x.lineWidth = 3; for (var q = 0; q < 8; q++) { x.beginPath(); x.moveTo(Math.cos(q * .785) * 9, Math.sin(q * .785) * 9); x.lineTo(Math.cos(q * .785) * 14, Math.sin(q * .785) * 14); x.stroke(); }
      x.fillStyle = e.arm && Math.floor(t * 16) % 2 ? "#fff" : "#ff3355"; x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill();
    } else if (k === "carrier") {
      bot(x, e, "#5a3a7a"); rr(x, -23, -13, 46, 26, 12); x.fill(); x.strokeStyle = "#c084fc"; x.lineWidth = 2; var rs = Math.abs(Math.sin(t * 30)) * 22; x.beginPath(); x.moveTo(-rs, -20); x.lineTo(rs, -20); x.moveTo(0, -20); x.lineTo(0, -13); x.stroke();
      x.fillStyle = "#2a3550"; rr(x, -12, 14, 24, 16, 5); x.fill(); wIcon(x, e.drop || "sine", 0, 22, .55, "#ffd86b");
    } else if (k === "splitter") {
      x.translate(0, -20); x.rotate(e.spin || 0); bot(x, e, "#5a2a6b"); x.beginPath(); x.arc(0, 0, 20, 0, 7); x.fill();
      x.strokeStyle = "#ff9dc8"; x.lineWidth = 3; x.beginPath(); x.moveTo(-20, 0); x.lineTo(20, 0); x.stroke(); x.beginPath(); x.arc(-8, 0, 7, 0, 7); x.arc(8, 0, 7, 0, 7); x.stroke();
      x.rotate(-(e.spin || 0)); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(f * 6, -6, 4, 0, 7); x.fill();
    } else if (k === "warden") {
      var ph2 = Math.sin(t * 7) * (e.vx ? 1 : 0); x.strokeStyle = "#2a2a36"; x.lineWidth = 7; x.beginPath(); x.moveTo(-7, -24); x.lineTo(-7 + ph2 * 7, 0); x.moveTo(7, -24); x.lineTo(7 - ph2 * 7, 0); x.stroke();
      bot(x, e); rr(x, -18, -58, 36, 36, 7); x.fill(); x.fillStyle = "#ff3355"; x.fillRect(f > 0 ? 3 : -15, -48, 12, 6);
      x.fillStyle = "rgba(190,210,230,.9)"; x.strokeStyle = "#fff"; x.lineWidth = 2; rr(x, f * 22 - 6, -66, 12, 64, 4); x.fill(); x.stroke();
      x.fillStyle = "#4b5a6b"; x.fillRect(f * 22 - 2, -60, 4, 52);
    } else if (k === "sniper") {
      bot(x, e, "#2a1f3d"); rr(x, -12, -54, 24, 40, 6); x.fill(); x.fillRect(-14, -14, 28, 14);
      x.save(); x.translate(0, -46); x.rotate(e.ang || (f > 0 ? 0 : Math.PI)); x.fillStyle = "#333"; x.fillRect(0, -3, 34, 6); x.fillStyle = "#ff3d8b"; x.fillRect(30, -2, 6, 4); x.restore();
      if (e.aimT > 0) { var al = Math.max(.15, 1 - e.aimT / e.d.aimT); x.strokeStyle = "rgba(255,61,139," + (.25 + .6 * al) + ")"; x.lineWidth = 1 + al * 2; x.setLineDash(e.aimT < .25 ? [] : [8, 6]);
        x.beginPath(); x.moveTo(0, -46); x.lineTo(Math.cos(e.ang) * 900, -46 + Math.sin(e.ang) * 900); x.stroke(); x.setLineDash([]); }
      polIcon(x, 0, -76, e.pol, "#ff9dc8", 8);
    }
    x.restore(); x.globalAlpha = 1;
  }
  function drawBoss(x, B) {
    var t = B.t, fl = B.flash > 0, w = B.w, h = B.h, body = fl ? "#7a4fb0" : "#3d1f5c", dark = fl ? "#4a2a70" : "#24123a", eye = "#ff3355";
    x.save(); x.translate(B.x, B.y); if (B.dead > 0) x.rotate(Math.sin(t * 30) * .03);
    if (B.def.hue && "filter" in x) x.filter = "hue-rotate(" + B.def.hue + "deg) saturate(1.2)";
    if (B.tele > 0) { x.fillStyle = "rgba(255,61,139,.5)"; var m = mouth(B); x.beginPath(); x.arc(m.x - B.x, m.y - B.y, 10 + (.45 - B.tele) * 30, 0, 7); x.fill(); }
    switch (B.look) {
      case "siege": x.strokeStyle = "#2a2a36"; x.lineWidth = 14; var lg = Math.sin(t * 3) * 12; x.beginPath(); x.moveTo(-30, 20); x.lineTo(-40 + lg, 65); x.moveTo(30, 20); x.lineTo(40 - lg, 65); x.stroke();
        x.fillStyle = body; rr(x, -60, -60, 120, 85, 14); x.fill(); x.fillStyle = eye; x.fillRect(-48, -40, 40, 12); x.fillStyle = "#555"; x.fillRect(-90, -10, 40, 14); x.fillStyle = "#c084fc"; x.fillRect(-60, 10, 120, 6); break;
      case "drill": x.fillStyle = body; rr(x, -50, -40, 120, 70, 12); x.fill(); x.fillStyle = "#222"; x.fillRect(-60, 30, 140, 15); x.fillStyle = "#9aa0ad"; x.save(); x.translate(-55, -5); x.beginPath(); x.moveTo(0, -30); x.lineTo(-45, 0); x.lineTo(0, 30); x.fill();
        x.strokeStyle = "#555"; x.lineWidth = 3; for (var i = 0; i < 4; i++) { var o = ((t * 60 + i * 12) % 45); x.beginPath(); x.moveTo(-o, -30 + o * .66); x.lineTo(-o, 30 - o * .66); x.stroke(); } x.restore(); x.fillStyle = eye; x.fillRect(10, -25, 30, 10); break;
      case "gate": x.fillStyle = dark; x.fillRect(-w / 2, -h / 2, w, h); x.fillStyle = body; x.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
        var pulse = .6 + .4 * Math.sin(t * 5), cg = x.createRadialGradient(0, 0, 4, 0, 0, 40); cg.addColorStop(0, "rgba(255,51,85," + pulse + ")"); cg.addColorStop(1, "rgba(255,51,85,0)"); x.fillStyle = cg; x.beginPath(); x.arc(0, 0, 40, 0, 7); x.fill(); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill();
        x.fillStyle = "#555"; x.fillRect(-w / 2 - 20, -h / 2 + 40, 30, 14); x.fillRect(-w / 2 - 20, h / 2 - 60, 30, 14); break;
      case "crawler": x.strokeStyle = "#2a2a36"; x.lineWidth = 8; for (var l = 0; l < 4; l++) { var lx = -70 + l * 46, s2 = Math.sin(t * 6 + l) * 8; x.beginPath(); x.moveTo(lx, 10); x.lineTo(lx - 14 + s2, 40); x.lineTo(lx - 6 + s2, 60); x.stroke(); }
        x.fillStyle = body; x.beginPath(); x.ellipse(0, 0, 100, 45, 0, Math.PI, 0); x.fill(); x.fillRect(-100, 0, 200, 16); x.fillStyle = "#c084fc"; x.fillRect(-80, -8, 160, 5);
        x.fillStyle = dark; for (var cl = -1; cl <= 1; cl += 2) { x.save(); x.translate(cl * 95 - 20, -10); x.rotate(cl * (.3 + Math.sin(t * 3) * .2)); x.beginPath(); x.ellipse(-20, -20, 26, 14, 0, 0, 7); x.fill(); x.restore(); }
        x.fillStyle = eye; x.beginPath(); x.arc(-30, -25, 7, 0, 7); x.arc(-10, -30, 7, 0, 7); x.fill(); break;
      case "turbine": x.fillStyle = dark; x.fillRect(-w / 2, -h / 2, w, h); x.fillStyle = body; x.beginPath(); x.arc(-10, 0, 85, 0, 7); x.fill();
        x.save(); x.translate(-10, 0); x.rotate(t * (2 + B.ph)); x.fillStyle = "#9aa0ad"; for (var bl = 0; bl < 6; bl++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(40, -20, 75, 0); x.quadraticCurveTo(40, 8, 0, 0); x.fill(); } x.restore();
        x.fillStyle = eye; x.beginPath(); x.arc(-10, 0, 14, 0, 7); x.fill(); x.fillStyle = "rgba(170,225,255,.4)"; x.fillRect(-w / 2 - 30, h / 2 - 20, w + 30, 20); break;
      case "transformer": x.fillStyle = "#555"; x.fillRect(-6, -h / 2 - 400, 12, 400);
        x.fillStyle = body; rr(x, -70, -60, 140, 120, 14); x.fill(); for (var cz = -1; cz <= 1; cz += 2) { x.fillStyle = "#b87333"; for (var r2 = 0; r2 < 6; r2++) x.fillRect(cz * 90 - 16, -50 + r2 * 18, 32, 10); x.fillStyle = dark; x.fillRect(cz * 90 - 6, -60, 12, 120); }
        x.strokeStyle = "#bfe9ff"; x.lineWidth = 2; if (!API.reduce || Math.floor(t * 4) % 2) { x.beginPath(); x.moveTo(-90, -60); for (var z = 1; z <= 8; z++) x.lineTo(-90 + z * 22.5, -60 - rnd(0, 26)); x.stroke(); }
        x.fillStyle = eye; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill(); x.fillStyle = "#fff"; x.font = "800 14px system-ui"; x.textAlign = "center"; x.fillText("ε = −dΦ/dt", 0, 48); break;
      case "hydra": x.fillStyle = dark; x.fillRect(-120, 20, 240, 70); x.fillStyle = body; rr(x, -100, -20, 200, 60, 12); x.fill();
        for (var hd = 0; hd < 3; hd++) { var hx = -90 + hd * 90, hy = -70 - Math.sin(t * 2 + hd) * 20; x.strokeStyle = "#555"; x.lineWidth = 8; x.beginPath(); x.moveTo(hx, -20); x.quadraticCurveTo(hx + 20, -40, hx, hy); x.stroke();
          x.fillStyle = body; x.beginPath(); x.arc(hx, hy, 18, 0, 7); x.fill(); x.strokeStyle = "#9aa0ad"; x.lineWidth = 2; x.beginPath(); x.moveTo(hx, hy - 18); x.lineTo(hx, hy - 46); x.moveTo(hx - 10, hy - 36); x.lineTo(hx + 10, hy - 36); x.stroke(); x.fillStyle = eye; x.beginPath(); x.arc(hx - 6, hy, 5, 0, 7); x.fill(); } break;
      case "hauler": x.fillStyle = body; rr(x, -120, -40, 240, 80, 18); x.fill(); x.fillStyle = dark; x.fillRect(-60, -55, 120, 20); x.fillStyle = "#7ef0ff"; x.fillRect(-110, -28, 50, 22);
        x.fillStyle = "#ffd86b"; rr(x, 10, -30, 90, 50, 6); x.fill(); x.fillStyle = "#24123a"; x.font = "800 12px system-ui"; x.textAlign = "center"; x.fillText("RELAY CORE", 55, 0);
        x.fillStyle = "rgba(126,240,255,.5)"; for (var j = -1; j <= 1; j += 2) { x.beginPath(); x.ellipse(j * 80, 48, 30, 8 + Math.sin(t * 30) * 2, 0, 0, 7); x.fill(); } x.fillStyle = eye; x.fillRect(-116, 10, 14, 8); break;
      case "golem": var fc = B.filter ? D.colour((D.FILTERS[B.filter][0] + D.FILTERS[B.filter][1]) / 2) : "#bfe9ff";
        x.fillStyle = body; x.fillRect(-50, 40, 30, 70); x.fillRect(20, 40, 30, 70); x.beginPath(); x.moveTo(-80, -60); x.lineTo(80, -60); x.lineTo(60, 50); x.lineTo(-60, 50); x.fill();
        x.globalAlpha = .7; x.fillStyle = fc; x.beginPath(); x.moveTo(0, -110); x.lineTo(50, -40); x.lineTo(0, 30); x.lineTo(-50, -40); x.fill(); x.globalAlpha = 1;
        x.strokeStyle = "#fff"; x.lineWidth = 2; x.stroke(); x.fillStyle = eye; x.fillRect(-30, -50, 18, 8);
        if (B.filter) { x.fillStyle = "#fff"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText("passes " + D.FILTERS[B.filter][0] + "–" + D.FILTERS[B.filter][1] + " nm", 0, -122); } break;
      case "gyro": x.strokeStyle = fl ? "#fff" : "#9aa0ad"; x.lineWidth = 8; for (var rg = 0; rg < 3; rg++) { x.save(); x.rotate(t * (1 + rg * .6) + rg); x.beginPath(); x.ellipse(0, 0, 95, 30 + rg * 20, 0, 0, 7); x.stroke(); x.restore(); }
        x.fillStyle = body; x.beginPath(); x.arc(0, 0, 42, 0, 7); x.fill(); x.fillStyle = eye; x.beginPath(); x.arc(0, 0, 16, 0, 7); x.fill(); break;
      case "engine": x.fillStyle = dark; x.fillRect(-130, -130, 260, 260); x.fillStyle = body; rr(x, -120, -120, 240, 230, 20); x.fill();
        x.fillStyle = "#555"; x.fillRect(-170, -40, 60, 20); x.fillRect(-170, 30, 60, 20); x.fillStyle = "#7ef0ff"; rr(x, -50, -100, 100, 70, 14); x.fill(); A.drawHead(x, A.VILLAIN, 0, -62, 22, -1, { mood: "fight" });
        x.fillStyle = "#c084fc"; x.font = "900 18px system-ui"; x.textAlign = "center"; x.fillText("S → ∞", 0, 30); x.strokeStyle = "#2a2a36"; x.lineWidth = 16; x.beginPath(); x.moveTo(-70, 110); x.lineTo(-90, 140); x.moveTo(70, 110); x.lineTo(90, 140); x.stroke(); break;
      case "pod": x.fillStyle = body; x.beginPath(); x.ellipse(0, 10, 75, 40, 0, 0, 7); x.fill(); x.fillStyle = "rgba(126,240,255,.6)"; x.beginPath(); x.arc(0, -10, 38, Math.PI, 0); x.fill(); A.drawHead(x, A.VILLAIN, 0, -8, 20, -1, { mood: B.hp < B.phMax * .3 ? "sad" : "fight" });
        x.fillStyle = "rgba(255,120,60,.8)"; x.beginPath(); x.moveTo(-30, 48); x.lineTo(0, 70 + Math.random() * 14); x.lineTo(30, 48); x.fill(); break;
    }
    x.restore();
  }
  function drawShots(x) {
    S.shots.forEach(function (s) {
      var col = D.colour(s.nm), lam = s.nm * D.NM_PX, len = s.k === "sine" ? lam * 2.5 : lam * 1.6, amp = s.k === "sine" ? 6 : 4;
      x.save(); x.translate(s.x, s.y); x.rotate(Math.atan2(s.vy, s.vx)); x.strokeStyle = col; x.lineWidth = 3; x.globalAlpha = .95; x.beginPath();
      for (var i = 0; i <= 28; i++) { var u = -len + len * i / 28, yy = Math.sin((u / lam) * Math.PI * 2 - s.ph) * amp * (i / 28); if (i) x.lineTo(u, yy); else x.moveTo(u, yy); } x.stroke();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(0, 0, 3.5, 0, 7); x.fill(); x.restore();
    }); x.globalAlpha = 1;
    S.beams.forEach(function (b) {
      var lam = b.nm * 1e-9, d = WP.lance.slit, col = D.colour(b.nm), cone = WP.lance.cone * Math.PI / 180;
      x.save(); x.translate(b.x, b.y); x.rotate(b.a); x.globalAlpha = Math.min(1, b.life * 8) * .9;
      x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -5); x.lineTo(60, 0); x.moveTo(0, 5); x.lineTo(60, 0); x.stroke();
      for (var n = -6; n <= 6; n++) { var th = Math.atan(n * lam / d); if (Math.abs(th) > cone) continue; x.globalAlpha = (n === 0 ? .55 : .35) * Math.min(1, b.life * 8); x.lineWidth = n === 0 ? 5 : 3;
        x.beginPath(); x.moveTo(60, 0); x.lineTo(b.range * Math.cos(th), b.range * Math.sin(th)); x.stroke(); }
      x.restore(); x.globalAlpha = 1;
      b.hits.forEach(function (h) { x.fillStyle = col; x.beginPath(); x.arc(h[0], h[1], 8, 0, 7); x.fill(); });
    });
    S.eshots.forEach(function (s) {
      if (s.k === "shell") { x.fillStyle = "#ff7a3d"; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill(); x.fillStyle = "#ffe0a0"; x.beginPath(); x.arc(s.x, s.y, s.r * .45, 0, 7); x.fill(); }
      else if (s.k === "bomb") { x.fillStyle = "#2a2a36"; x.beginPath(); x.arc(s.x, s.y, s.r, 0, 7); x.fill(); x.fillStyle = "#ff3355"; x.fillRect(s.x - 2, s.y - s.r - 3, 4, 4); }
      else if (s.k === "wave") { x.fillStyle = "rgba(255,157,92,.85)"; x.beginPath(); x.moveTo(s.x - 20, s.y + 13); x.quadraticCurveTo(s.x, s.y - 22, s.x + 20, s.y + 13); x.fill(); }
      else { var a = Math.atan2(s.vy, s.vx), col2 = s.k === "spec" ? D.colour(s.nm) : "#ff3d8b"; x.save(); x.translate(s.x, s.y); x.rotate(a); x.strokeStyle = col2; x.lineWidth = 4; x.beginPath(); x.moveTo(-28, 0); x.lineTo(4, 0); x.stroke(); x.strokeStyle = "#fff"; x.lineWidth = 1.5; x.stroke(); x.restore();
        if (s.k === "beam") polIcon(x, s.x - Math.cos(a) * 14, s.y - Math.sin(a) * 14 - 12, s.pol, "#ffc2dc", 6); }
    });
  }
  function drawFx(x) {
    S.rings.forEach(function (r) { x.strokeStyle = r.col; x.globalAlpha = Math.max(0, r.life * 2); x.lineWidth = r.emp ? 4 : 3; x.beginPath(); x.arc(r.x, r.y, r.r, 0, 7); x.stroke();
      if (r.emp) { x.lineWidth = 1; x.beginPath(); x.arc(r.x, r.y, r.r * .5, 0, 7); x.stroke(); } }); x.globalAlpha = 1;
    S.debris.forEach(function (d) { x.save(); x.translate(d.x, d.y); x.rotate(d.r); x.globalAlpha = Math.min(1, d.life * 2); x.fillStyle = d.col; x.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); x.restore(); }); x.globalAlpha = 1;
    S.pops.forEach(function (p) { x.globalAlpha = Math.min(1, p.life * 1.5); x.font = "700 " + (S.small ? 22 : 15) + "px system-ui"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText(p.t, p.x, p.y); x.fillStyle = p.col; x.fillText(p.t, p.x, p.y); }); x.globalAlpha = 1;
  }
  /* ---------- HUD ---------- */
  function drawHud(x) {
    var big = S.small || opt("hud", "auto") === "large", cw = S.cssW || 960, fs = big ? clamp(11 / (14 * Math.min(1, cw / 960)), 1.6, S.mode === "duo" ? 1.6 : 2.3) : 1;
    S.ps.forEach(function (p, i) {
      var right = i === 1, bx = right ? 960 - 12 - 330 * fs : 12, by = 10, w = 330 * fs, h = 64 * fs;
      x.fillStyle = "rgba(4,10,20,.72)"; rr(x, bx, by, w, h, 10); x.fill();
      A.drawHead(x, p.c, bx + 26 * fs, by + 28 * fs, 15 * fs, 1, { mood: p.out ? "sad" : "happy" });
      x.fillStyle = "#fff"; x.font = "800 " + 14 * fs + "px system-ui"; x.textAlign = "left";
      x.fillText(p.out ? (S.mode === "duo" && S.cont > 0 ? "Fire to join (" + S.cont + ")" : "Out") : "×" + Math.max(0, p.lives), bx + 46 * fs, by + 22 * fs);
      for (var k = 0; k < maxHp(); k++) { x.fillStyle = k < Math.ceil(p.hp - .001) ? (p.hp - k < 1 ? "#ffd86b" : "#3dd68c") : "rgba(255,255,255,.18)"; rr(x, bx + 46 * fs + k * 16 * fs, by + 30 * fs, 12 * fs, 8 * fs, 3); x.fill(); }
      var f = D.FREQS[p.fi], nm = D.nm(f), col = D.colour(nm);
      wIcon(x, p.cur, bx + 116 * fs, by + 18 * fs, fs, "#ffd86b"); x.fillStyle = "#ffd86b"; x.font = "700 " + 12 * fs + "px system-ui"; x.fillText(WP[p.cur].short + " " + p.wpn[p.cur], bx + 132 * fs, by + 23 * fs);
      x.fillStyle = col; x.fillRect(bx + 116 * fs, by + 32 * fs, 10 * fs, 10 * fs);
      x.fillStyle = "#fff"; x.font = "600 " + 12 * fs + "px ui-monospace, monospace";
      x.fillText(big ? Math.round(nm) + " nm" : "f " + sci(f) + "  λ " + Math.round(nm) + " nm", bx + 130 * fs, by + 42 * fs);
      // mini wave preview at the true drawn wavelength
      var lam = D.drawnLambda(f), wx0 = bx + 116 * fs, wy = by + 54 * fs; x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); for (var u = 0; u <= 100; u += 2) { var yy = Math.sin(u / lam * Math.PI * 2 - S.t * 8) * 4; if (u) x.lineTo(wx0 + u * fs * (big ? 1 : 1.9), wy + yy); else x.moveTo(wx0, wy + yy); } x.stroke();
      if (p.shield && !big) { x.fillStyle = "#9be7ff"; x.font = "600 12px system-ui"; x.fillText("shield " + p.sAng + "°", bx + 250, by + 23); }
      if (big && p.shield) { x.fillStyle = "#9be7ff"; x.font = "600 " + 12 * fs + "px system-ui"; x.fillText(p.sAng + "°", bx + 220 * fs, by + 23 * fs); }
    });
    x.fillStyle = "#fff"; x.font = "800 " + (big ? 26 : 18) + "px system-ui"; x.textAlign = "center"; if (S.mode !== "duo" || !big) x.fillText(S.score.toLocaleString(), S.mode === "duo" ? 480 : 600 + (big ? 120 : 0), big ? 40 : 30);
    var B = S.boss; if (B) { var bw = 560, bx2 = 200, by2 = 540 - (big ? 50 : 34); x.fillStyle = "rgba(4,10,20,.8)"; rr(x, bx2 - 8, by2 - 22 * (big ? 1.4 : 1), bw + 16, (big ? 48 : 36), 8); x.fill();
      x.fillStyle = "#fff"; x.font = "800 " + (big ? 20 : 13) + "px system-ui"; x.textAlign = "left"; x.fillText(B.name + (B.def.hp.length > 1 ? "  · phase " + (B.ph + 1) + "/" + B.def.hp.length : ""), bx2, by2 - (big ? 8 : 6));
      x.fillStyle = "rgba(255,255,255,.15)"; x.fillRect(bx2, by2, bw, big ? 12 : 8); x.fillStyle = B.filter ? D.colour((D.FILTERS[B.filter][0] + D.FILTERS[B.filter][1]) / 2) : "#ff4d6d"; x.fillRect(bx2, by2, bw * Math.max(0, B.hp / B.phMax), big ? 12 : 8); }
    if (S.bossDown && !S.flag) { x.fillStyle = "#3dd68c"; x.font = "900 " + (big ? 40 : 28) + "px system-ui"; x.textAlign = "right"; x.fillText("GO →", 940, 300 + Math.sin(S.t * 6) * 6); }
    else if (!S.lock && !S.scroll && S.phase === "play" && S.clock > 3 && S.idleT > 4) { x.fillStyle = "rgba(126,240,255,.8)"; x.font = "900 " + (big ? 34 : 24) + "px system-ui"; x.textAlign = "right"; x.fillText("→", 940, 280); }
    if (S.tipT > 0) { var tips = ["A / D run · W / S aim · Space jump (running jump = somersault)", "J fires (hold). E / Q step the frequency: watch λ shrink as f rises", "Hold I for the polariser shield; E / Q then turn it. Cross it to the beam!", "S + Space drops through ledges · hold Shift to lock your aim", "Shoot the cargo pods for new wave weapons"],
      tip = tips[Math.min(tips.length - 1, Math.floor((26 - S.tipT) / 5.2))];
      x.fillStyle = "rgba(4,12,18,.85)"; rr(x, 120, 92 * (big ? 1.6 : 1), 720, big ? 50 : 34, 10); x.fill(); x.fillStyle = "#7ef0ff"; x.font = "600 " + (big ? 20 : 15) + "px system-ui"; x.textAlign = "center"; x.fillText(S.small ? tip.replace(/A \/ D|W \/ S|Space|J |E \/ Q|Hold I|S \+ Space|Shift/g, function (m) { return { "A / D": "◀ ▶", "W / S": "▲ ▼", "Space": "⤒", "J ": "✸ ", "E / Q": "f+ / f−", "Hold I": "Hold ◐", "S + Space": "▼ + ⤒", "Shift": "⌖" }[m]; }) : tip, 480, 92 * (big ? 1.6 : 1) + (big ? 32 : 22)); }
  }
  function draw(api) {
    var x = api.x;
    if (!S.st) { var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#0a1030"); g.addColorStop(1, "#3a1a4a"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
      x.strokeStyle = "rgba(126,240,255,.6)"; x.lineWidth = 3; for (var w = 0; w < 4; w++) { x.beginPath(); for (var i = 0; i <= 96; i++) { var px = i * 10, py = 300 + w * 34 + Math.sin(i / (6 + w * 2) + api.t * (2 + w * .5)) * 24; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.strokeStyle = D.colour(420 + w * 90); x.stroke(); }
      x.fillStyle = "#fff"; x.font = "900 72px system-ui"; x.textAlign = "center"; x.fillText("WAVEFRONT", 480, 190); return; }
    var cv = document.querySelector("[data-gm-canvas]"), cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null; S.cssW = cr ? Math.min(cr.width, cr.height * 16 / 9 || cr.width) : 960; S.small = !!(cv && S.cssW < 620); // the 960×540 picture is letterboxed inside the canvas
    var z = S.small ? 1.25 : 1; if (z !== Z) { Z = z; VW = 960 / Z; VH = 540 / Z; }
    drawBack(x);
    x.save(); x.scale(Z, Z); x.translate(-Math.round(S.cam.x), -Math.round(S.cam.y));
    drawWorld(x);
    S.foes.forEach(function (e) { if (e.x > camL() - 80 && e.x < camR() + 80) drawFoe(x, e); });
    if (S.boss) drawBoss(x, S.boss);
    S.ps.forEach(function (p) { drawPlayer(x, p); });
    drawShots(x); drawFx(x);
    x.restore();
    if (S.ps.some(function (p) { return p.hurt > 0; }) && !api.reduce) { var v = x.createRadialGradient(480, 270, 260, 480, 270, 600); v.addColorStop(0, "rgba(255,0,0,0)"); v.addColorStop(1, "rgba(255,40,60,.35)"); x.fillStyle = v; x.fillRect(0, 0, 960, 540); }
    if (S.surv && S.surv.mods.dark && S.ps[0]) { var lp = S.ps[0], lx = (lp.x - S.cam.x) * Z, ly = (lp.y - 40 - S.cam.y) * Z, dg = x.createRadialGradient(lx, ly, 90, lx, ly, 330); dg.addColorStop(0, "rgba(0,0,8,0)"); dg.addColorStop(1, "rgba(0,0,8,.88)"); x.fillStyle = dg; x.fillRect(0, 0, 960, 540); }
    drawHud(x);
    if (S.surv) { var sfz = S.small ? 1.8 : 1; x.fillStyle = "rgba(4,10,20,.72)"; var sbY = S.small ? 128 : 82; rr(x, 12, sbY, 300 * sfz, 28 * sfz, 8); x.fill(); x.fillStyle = "#ffd86b"; x.font = "800 " + 14 * sfz + "px system-ui"; x.textAlign = "left";
      x.fillText("Wave " + Math.max(1, S.surv.n) + (S.surv.modList.length ? " · " + S.surv.modList.map(function (m) { return D.MODIFIERS.filter(function (q) { return q.id === m; })[0].name; }).join(", ") : ""), 24, sbY + 19 * sfz); }
  }

  var game = {
    song: MENU_SONG, actions: ACTIONS,
    init: function (api) { API = api; S.mode = "solo"; setupCheats(api); panel(api);
      if (api.settings && api.settings.add) OPTIONS.forEach(function (o) { api.settings.add({ id: "wf_" + o.k, tab: o.k === "hud" ? "display" : "gameplay", section: "Wavefront", label: o.label, type: "choice", default: save.opt[o.k] === undefined ? o.dflt : save.opt[o.k], choices: o.choices, help: o.help }); });
      menu(api); },
    savePrefix: ["ee-arcade-wavefront"],
    update: function (dt, api) {
      cheatTick(api);
      if (!S.st || S.idle || api.overlayOpen()) return;
      if (S.phase === "play" || S.phase === "clear") { step(dt); var moving = S.ps.some(function (p) { return Math.abs(p.vx) > 1; }); S.idleT = moving ? 0 : (S.idleT || 0) + dt; }
    },
    draw: draw,
    menu: function (api) { S.st = null; menu(api); }
  };
  A.run(game);
  window.Wavefront = { get S() { return S; }, D: D, save: save, newRun: function (k, mode) { S.mode = mode || "solo"; newRun(k); }, begin: begin, step: step };
})();
