/* Kinetic Kingdom: a side-scrolling platformer (PHYS 111 Mechanics: kinematics, projectiles, friction, work–energy,
 * circular motion). Level data, the hero's movement physics and the level solver live in platformer-levels.js.
 * Game-world scale: 1 tile = 1 m = 40 px; the kingdom's gravity is g = 36 m/s² (disclosed in the physics panel).
 * Every readout is computed from the same numbers the simulation uses. Original characters, art and music. */
(function () {
  "use strict";
  var A = window.Arcade, KL = window.KineticLevels, P = KL.P, LV = KL.LEVELS, WD = KL.WORLDS;
  var TS = 40, VWT = 960 / TS, VHT = 540 / TS, SLUG = "kinetic-kingdom", G_EARTH = 9.8;
  var MOUNTS = {
    newton: { id: "horse", name: "Principia the horse", ability: "Gallop: top speed 14 m/s, and hooves tough enough to stomp spiked Gearbacks.", col: "#8a5a35" },
    tesla: { id: "drone", name: "a crackling lightning drone", ability: "Hold Jump while falling to hover; Run fires a short spark.", col: "#7ef0ff" },
    einstein: { id: "wave", name: "a light-wave board", ability: "Surf straight over plasma and spikes (a game metaphor).", col: "#ffe066" },
    curie: { id: "scooter", name: "a glowing scooter", ability: "Its glow reveals hidden crates and pulls nearby coins in.", col: "#7dff9a" },
    faraday: { id: "maglev", name: "a maglev board", ability: "Floats on a magnetic field: no contact, so no friction on ice and no spike damage.", col: "#a78bfa" },
    bohr: { id: "orbit", name: "an orbit drone", ability: "A second jump in mid-air: a 'quantum jump' to a higher level.", col: "#ffa94d" },
    groove: { id: "bass", name: "a bass board", ability: "Landing hard sends a shockwave that flattens nearby minions.", col: "#ff3d8b" },
    kai: { id: "crane", name: "a jade crane kite", ability: "Hold Jump to glide: fall speed capped at 3 m/s.", col: "#3dd68c" }
  };
  var THEMES = {
    grass: { sky: ["#5fb8f0", "#d4f1ff"], top: "#58c457", topD: "#3a9a3c", soil: "#a06c3c", soilD: "#7e522b", brick: "#c9683a", brickL: "#ec9460", steel: "#8e9aaa", ledge: "#e8d7a8", fog: "rgba(255,255,255,.0)" },
    lab: { sky: ["#0e1626", "#22304a"], top: "#56708f", topD: "#3c5068", soil: "#2e3b4d", soilD: "#222d3c", brick: "#7d5a8c", brickL: "#a07bb0", steel: "#7a8798", ledge: "#9fb4cc", dark: 0.62 },
    ice: { sky: ["#8fcdeb", "#f0fbff"], top: "#e9fbff", topD: "#a8dff0", soil: "#6fa9cc", soilD: "#4f8bb0", brick: "#5c8fb8", brickL: "#8cc0e0", steel: "#a3b4c4", ledge: "#d6f3ff", snow: true },
    volcano: { sky: ["#1a0707", "#5e1a0e"], top: "#5b4842", topD: "#3e302c", soil: "#2b201d", soilD: "#1e1614", brick: "#8a3b24", brickL: "#c0603a", steel: "#6e6670", ledge: "#c99a7a", dark: 0.45, embers: true },
    storm: { sky: ["#151834", "#3b3f70"], top: "#9aa6c0", topD: "#6c7894", soil: "#3c4560", soilD: "#2a3148", brick: "#5a5f8a", brickL: "#8086b8", steel: "#8b95ad", ledge: "#cfd8f0", rain: true },
    cliffs: { sky: ["#5aa9e6", "#e6f5ff"], top: "#7cc46a", topD: "#4f9a46", soil: "#9a7b5a", soilD: "#7a5f44", brick: "#b8774a", brickL: "#dd9a66", steel: "#9aa7b6", ledge: "#f1e3b8" },
    moon: { sky: ["#03040c", "#1b2240"], top: "#c9ccd6", topD: "#9ea3b3", soil: "#6b7080", soilD: "#4d5262", brick: "#7a7f96", brickL: "#a3a8c0", steel: "#8d95a8", ledge: "#e2e6f0" },
    citadel: { sky: ["#12051c", "#3a1050"], top: "#6d5a86", topD: "#4a3c5e", soil: "#2c2238", soilD: "#1e1728", brick: "#6b2e66", brickL: "#9c4a92", steel: "#7a7290", ledge: "#d8b8e8", dark: 0.3 }
  };
  var save = Object.assign({ who: "newton", done: {}, secrets: {}, shards: {}, sel: 0, hud: true, cards: {} }, A.store("kk") || {});
  if (!save.v) { save.v = 2; save.chars = {}; save.chars[save.who] = true; }
  save.chars = save.chars || {}; save.fails = save.fails || {}; save.best = save.best || {}; save.lap = save.lap || 1; save.lapMax = save.lapMax || 1;
  function persist() { A.store("kk", save); }
  var S = { mode: "title", mapT: 0, sel: save.sel || 0, mapHero: save.sel || 0 }, G = null, L = null, API = null;
  var SONGS = {};
  function songFor(o) { var k = o.seed + o.style; return SONGS[k] || (SONGS[k] = A.song(o.seed, o.style, { bpm: o.bpm, scale: o.scale })); }
  var MAP_SONG = { seed: 1000, style: "chip", bpm: 116 };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fx(n) { return (Math.round(n * 100) / 100).toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2); }
  function hero() { return L && L.hero; }
  function who() { var id = save.who, c = A.byId[id] || A.byId.newton; if (id === "entropy" ? !charOpen("entropy") : (c.guest && !A.owns("char-" + c.id)) || !charOpen(id)) c = A.byId.newton; return A.styled(c); }
  /* ---------------- Progression: abilities, characters, laps, assists ---------------- */
  var ABIL = [["dash", "1-4", "Air dash", "Press Run in mid-air for a burst of sideways speed: an impulse J = Δp = mΔv."],
    ["glide", "2-4", "Cape glide", "Hold Jump while falling: drag on the cape caps your fall at 4 m/s, a terminal velocity."],
    ["shock", "3-4", "Shock pound", "Ground-pounds flatten minions up to 4.5 m away: the same momentum, delivered harder."],
    ["double", "4-4", "Double jump", "Jump once more in mid-air, every jump (and after walking off a ledge)."]];
  var CHAR_REQ = { tesla: "1-4", einstein: "2-4", bohr: "3-4", entropy: "7-6" };
  function abilities() { var o = {}; ABIL.forEach(function (a) { o[a[0]] = heroOn() || !!save.done[a[1]]; }); return o; }
  function charOpen(id) { return heroOn() || !CHAR_REQ[id] || !!save.done[CHAR_REQ[id]] || !!save.chars[id]; }
  function bossOf(w) { return LV.filter(function (o) { return o.world === w && o.boss; })[0]; }
  function lapSpeed() { return 1 + .12 * (save.lap - 1); }
  function lapTime() { return Math.max(.6, 1 - .07 * (save.lap - 1)); }
  function opt(id, d) { try { var v = API && API.settings && API.settings.get ? API.settings.get(id) : null; return v == null ? d : v; } catch (e) { return d; } }
  function shardTotal() { var n = 0; for (var k in save.shards) n += (save.shards[k] || []).filter(Boolean).length; return n; }
  function completion() { // every level cleared, every fragment, every secret exit
    var got = 0, all = 0; LV.forEach(function (lv) { all += 4 + (lv.secret ? 1 : 0); var d = save.done[lv.id]; if (d && !d.skipped) got++; got += Math.min(3, (save.shards[lv.id] || []).filter(Boolean).length); if (lv.secret && save.secrets[lv.id]) got++; });
    return Math.floor(100 * got / all); }
  function nextIdx(i) { var lv = LV[i]; if (lv.trial || i + 1 >= LV.length || LV[i + 1].trial) return -1; return i + 1; }
  function canSkip(i) { var n = parseInt(opt("kkSkip", "5"), 10) || 0, lv = LV[i]; return n > 0 && !save.done[lv.id] && (save.fails[lv.id] || 0) >= n; }
  function skipLevel(api, i) { var lv = LV[i]; save.done[lv.id] = { best: 0, secs: 0, skipped: true }; var nx = nextIdx(i); if (nx >= 0) S.sel = save.sel = nx; persist(); api.sound.sfx("power"); A.toast("<b>" + A.esc(lv.id + " " + lv.name) + "</b> skipped. Come back any time: it still counts toward 100%."); }
  function unlocked(i) {
    if (i === 0 || CT.unlock || heroOn()) return true; var lv = LV[i];
    if (lv.trial) return !!save.done[bossOf(lv.world).id];
    if (save.done[LV[i - 1].id]) return true;
    if (lv.boss) return LV.some(function (o) { return o.world === lv.world && save.secrets[o.id]; });
    return false;
  }

  /* ---------------- Level load ---------------- */
  // every 30 formula fragments found adds a life to each new run (up to three)
  function newSession() { G = { lives: 5 + Math.min(3, Math.floor(shardTotal() / 30)), coins: 0, score: 0, power: "small", hearts: 0 }; }
  function themeFor(lv) { var th = THEMES[lv.theme] || THEMES.grass; return lv.dark ? Object.assign({}, th, { dark: .62, skyG: null }) : th; }
  function loadLevel(api, idx, fromCheck) {
    var lv = LV[idx], pl = KL.parse(lv), keepCheck = fromCheck && L && L.idx === idx ? L.check : null;
    Wh.gs = We.gs = pl.gs; Wh.air = pl.air;
    L = { idx: idx, lv: lv, pl: pl, H: pl.H, W: pl.W, grid: pl.grid.map(function (r) { return r.split(""); }), th: themeFor(lv),
      ents: [], plats: [], items: [], shots: [], pops: [], bumps: [], debris: [], doors: {}, gates: [], cps: [], arms: [], waves: [], multi: {},
      t: 0, time: S.attack ? 999 : Math.round(lv.time * lapTime()), clear: 0, cam: { x: 0, y: 0 }, read: null, readT: 0, seen: {}, combo: 0, shardIdx: {}, shardN: 0, boss: null, locked: false,
      fade: 0, fadeTo: null, check: keepCheck, scoreAtStart: G.score, start: null, coinsHere: 0, lastWarn: 999, flash: 0, intro: 5, rainSeed: Math.random() * 1000, gustT: 0, att: 0, rec: [], recT: 0 };
    var g = L.grid;
    for (var r = 0; r < L.H; r++) for (var c = 0; c < L.W; c++) {
      var ch = g[r][c], o = pl.objs[c + "," + r] || {};
      if (ch === "P") { L.start = { c: c, r: r }; g[r][c] = "."; }
      else if (ch === "*") { L.shardIdx[c + "," + r] = L.shardN++; }
      else if (ch === "C") { L.cps.push({ c: c, r: r, on: keepCheck && keepCheck.c === c && keepCheck.r === r }); g[r][c] = "."; }
      else if (ch === "G" || ch === "g") { L.gates.push({ c: c, r: r, secret: ch === "g", hidden: ch === "G" && !!lv.boss }); g[r][c] = "."; }
      else if (ch >= "1" && ch <= "9") { (L.doors[ch] = L.doors[ch] || []).push({ c: c, r: r }); g[r][c] = "."; }
      else if ("wkjbsrx".indexOf(ch) >= 0) { spawnEnemy(ch, c, r); g[r][c] = "."; }
      else if (ch === "u") { L.ents.push({ type: "u", x: c + .5 - .85, y: r, w: 1.7, h: 1.2, home: r, vy: 0, st: "wait", t: 0, alive: true }); g[r][c] = "."; }
      else if (ch === "c") L.ents.push({ type: "c", c: c, r: r, x: c, y: r, w: 1, h: 1, t: 0, fire: 1 + (c % 3) * .6, alive: true, fixed: true });
      else if (ch === "a" || ch === "A") L.arms.push({ c: c, r: r, len: o.len || 3, w: ch === "a" ? 2.0 : -2.0, th: (c * 1.3) % 6.28 });
      else if ("mvfp".indexOf(ch) >= 0) { var sp = KL.platformSpec(ch, o); sp.c = c; sp.r = r; sp.x = c; sp.y = r; sp.vx = 0; sp.vy = 0; sp.t = (c * 0.37) % 6.28; sp.home = r; sp.st = 0; L.plats.push(sp); g[r][c] = "."; }
      else if (ch === "@") { L.boss = makeBoss(lv.boss, c, r); g[r][c] = "."; }
    }
    if (L.boss) L.gates.forEach(function (gt) { gt.hidden = true; });
    var sc = keepCheck || L.start;
    var big = G.power !== "small";
    L.hero = KL.newHero(sc.c, sc.r, big); L.hero.abil = abilities();
    G.hearts = opt("kkHearts", false) ? 2 : 0;
    if (S.attack) { G.lives = 99; L.ghost = opt("kkGhost", true) ? A.store("kk-g-" + lv.id) : null; }
    Object.assign(L.hero, { power: G.power, boots: G.power === "boots", inv: 0, shield: 0, dead: 0, sx: 1, sy: 1, runLatch: false, empCd: 0, zapCd: 0, hover: .6, plat: null, blink: 0, step: 0, maxFall: 0, mountT: 0, airT: 0, iceT: 0 });
    snapCam();
    api.music(songFor(lv.song));
    setPanel(api);
    S.mode = "play";
  }
  function spawnEnemy(ch, c, r) {
    var e = { type: ch, x: c + .1, y: r + .15, w: .8, h: .85, vx: -1.6, vy: 0, dir: -1, alive: true, st: "walk", t: 0, x0: c, y0: r };
    if (ch === "k") { e.vx = -1.4; e.h = .95; }
    if (ch === "j") { e.vx = 0; e.t = .6 + (c % 4) * .25; }
    if (ch === "b") { e.vx = 0; e.y = r + .2; e.h = .6; e.ph = c * .7; }
    if (ch === "s") { e.vx = -1.2; }
    if (ch === "r") { e.vx = 0; e.y = r + .2; e.h = .6; e.w = .9; e.ph = c * .7; e.st = "fly"; e.cd = 1.5 + (c % 3) * .4; }
    if (ch === "x") { e.vx = 0; e.w = .9; e.h = .9; e.t = .4 + (c % 5) * .2; }
    L.ents.push(e); return e;
  }
  function makeBoss(kind, c, r) {
    var b = { kind: kind, x: c - .7, y: r - 1.6, w: 2.4, h: 2.6, vx: 0, vy: 0, hp: kind === "entropy" ? 5 : 3, max: kind === "entropy" ? 5 : 3, st: "idle", t: 1.2, inv: 0, dizzy: 0, alive: true, chip: 0, face: -1, ground: false, home: { c: c, r: r } };
    if (kind === "golem") { b.w = 2.2; b.h = 2.2; b.y = r - 1.2; }
    if (kind === "boiler") { b.w = 2.6; b.h = 3; b.y = r - 2; }
    if (kind === "entropy") { b.w = 1.8; b.h = 2.2; b.y = r - 6; b.fly = true; }
    if (kind === "harpy") { b.w = 2.2; b.h = 1.6; b.y = r - 6; b.fly = true; b.hp = b.max = 4; b.gust = 4; }
    if (kind === "mech") { b.w = 2.4; b.h = 2.8; b.y = r - 1.8; b.hp = b.max = 4; }
    if (kind === "prime") { b.w = 2.2; b.h = 2.6; b.y = r - 6; b.fly = true; b.hp = b.max = 8; b.arc = 3; }
    b.hp = b.max = b.max + Math.min(3, save.lap - 1);
    return b;
  }

  /* ---------------- World access ---------------- */
  function rawTile(c, r) { if (c < 0 || c >= L.W) return "X"; if (r < 0 || r >= L.H) return "."; return L.grid[r][c]; }
  var Wh = { tile: function (c, r) {
    var ch = rawTile(c, r);
    if (ch === "H" || ch === "J" || ch === "o" || ch === "*") return ".";
    var m = L.hero && L.hero.mount;
    if (m === "wave" && ch === "~") return "#";
    if ((m === "maglev" || m === "wave") && ch === "^") return "X";
    return ch;
  }, plats: [] };
  var We = { tile: function (c, r) { var ch = rawTile(c, r); return ch === "H" || ch === "J" || ch === "o" || ch === "*" ? "." : ch; } };
  function solidAt(x, y) { return KL.kind(We.tile(Math.floor(x), Math.floor(y))) === 1; }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function mass() { return (who().mass || 75) + (hero() && hero().mount ? 0 : 0); }

  /* ---------------- Physics readouts (one line at a time, bottom of the screen) ---------------- */
  function read(key, text, dur, once) {
    if (!save.hud) return;
    if (once && L.seen[key]) return; L.seen[key] = 1;
    L.read = text; L.readT = dur || 3.5;
  }
  function pop(x, y, text, col, big) { L.pops.push({ x: x, y: y, text: text, col: col || "#fff", t: 0, big: !!big }); }
  function addScore(n, x, y) { G.score += n; if (x != null) pop(x, y, String(n), "#fff"); }
  function coin(api, x, y) { G.coins++; L.coinsHere++; G.score += 50; api.sound.sfx("coin"); if (G.coins >= 100) { G.coins -= 100; oneUp(api, x, y); } }
  function oneUp(api, x, y) { G.lives++; api.sound.sfx("power"); pop(x, y, "1-UP", "#7dff9a", true); }

  /* ---------------- Camera ---------------- */
  function zoneOf(x) { var z = L.pl.zones; for (var i = 0; i < z.length; i++) if (x >= z[i].x0 && x < z[i].x1) return z[i]; return z[0]; }
  function camTarget() {
    var h = L.hero, z = zoneOf(h.x + h.w / 2), tx = h.x + h.w / 2 - VWT * 0.42 + h.face * 1.6, ty = h.y + h.h - VHT * 0.62;
    var x0 = z.x0, x1 = z.x1;
    if (L.locked) { x0 = L.pl.arenaX - 1; x1 = L.pl.arenaX + 27; }
    if (x1 - x0 <= VWT) tx = (x0 + x1) / 2 - VWT / 2; else tx = clamp(tx, x0, x1 - VWT);
    ty = clamp(ty, z.room ? Math.min(z.y0, L.H - VHT) : 0, L.H - VHT);
    return { x: tx, y: ty };
  }
  function snapCam() { var t = camTarget(); L.cam.x = t.x; L.cam.y = t.y; }

  /* ---------------- Hero helpers ---------------- */
  function sizeFor(h) { return h.mount || G.power !== "small" ? P.BIG : P.SMALL; }
  function resize(h) {
    var s = sizeFor(h), feet = h.y + h.h, cx = h.x + h.w / 2;
    h.big = s === P.BIG; h.w = s.w;
    if (KL.fits(h, Wh, cx - s.w / 2, feet - s.h, s.h)) { h.h = s.h; h.duck = false; } else { h.h = P.DUCK_H; h.duck = true; }
    h.x = cx - h.w / 2; h.y = feet - h.h;
  }
  function powerUp(api, kind, x, y) {
    var h = L.hero, m = mass();
    if (kind === "oneup") { oneUp(api, x, y); return; }
    if (kind === "shield") { h.shield = 10; api.sound.sfx("special"); pop(x, y, "INERTIA SHIELD", "#7ef0ff", true);
      read("shield", "Inertia shield (game metaphor): for 10 s you are effectively a huge mass; by Newton's first law minions bounce off and you barely notice.", 5); return; }
    if (kind === "mount") {
      var mo = MOUNTS[who().id] || MOUNTS.newton; h.mount = mo.id; h.mountT = 1; resize(h); api.sound.sfx("power"); api.buzz(30);
      pop(x, y, "MOUNTED!", mo.col, true); read("mount", "You ride " + mo.name + ". " + mo.ability + " It also takes one hit for you.", 6); return;
    }
    var grow = G.power === "small";
    if (kind === "cell") { if (grow) G.power = "big"; else { addScore(1000, x, y); api.sound.sfx("coin"); return; } read("cell", "Energy cell: chemical energy becomes your stored 'growth' (a game metaphor). Bigger hero: one extra hit, and your head breaks bricks.", 5); }
    if (kind === "boots") { G.power = "boots"; var dh = P.maxHeight(P.JUMP_V) * (P.BOOTS_H - 1), E = m * P.G * dh, k = 60000, xc = Math.sqrt(2 * E / k);
      read("boots", "Spring boots (Hooke's law F = kx): k = 60 kN/m squeezed x = " + fx(xc) + " m stores ½kx² = " + Math.round(E) + " J = mgΔh, so your " + m + " kg standing jump goes Δh = " + fx(dh) + " m higher (every jump is 40 % higher).", 7); }
    if (kind === "emp") { G.power = "emp"; read("emp", "EMP charge: press Run to throw. Each charge is a projectile: launched at 9 m/s, it follows a parabola and bounces.", 5); }
    h.power = G.power; h.boots = G.power === "boots"; resize(h);
    api.sound.sfx("power"); api.buzz(25); pop(x, y, kind === "cell" ? "ENERGY CELL" : kind === "boots" ? "SPRING BOOTS" : "EMP CHARGE", "#ffe066", true);
    h.sx = 1.25; h.sy = .8;
  }
  function hurt(api) {
    var h = L.hero; if (CT.god || heroOn() || h.inv > 0 || h.shield > 0 || h.dead || L.clear) return;
    if (h.mount) { L.debris.push({ x: h.x, y: h.y + h.h - .6, vx: -h.face * 6, vy: -6, t: 0, mount: h.mount, life: 1.4 }); h.mount = null; h.inv = 1.5; resize(h); api.sound.sfx("hit"); api.kick(5); api.buzz(40); pop(h.x, h.y, "Mount lost!", "#ffb4b4"); return; }
    if (G.power !== "small") { G.power = "small"; h.power = "small"; h.boots = false; resize(h); h.inv = 2; api.sound.sfx("hit"); api.kick(5); api.buzz(50); api.flash("#ff3355", .15); return; }
    if (G.hearts > 0) { G.hearts--; h.inv = 2; api.sound.sfx("hit"); api.kick(4); pop(h.x, h.y - .4, "♥ " + G.hearts + " left", "#fda4af"); return; }
    die(api);
  }
  function die(api) {
    var h = L.hero; if (h.dead) return;
    h.dead = .001; h.vy = -13; h.vx = 0; G.power = "small"; h.mount = null; api.sound.sfx("lose"); api.buzz([70, 50, 70]); api.kick(6);
  }
  function stompScore(api, e) {
    var vals = [100, 200, 400, 800, 1000, 2000, 4000, 8000];
    if (L.combo >= vals.length) { oneUp(api, e.x, e.y); } else addScore(vals[L.combo], e.x + .2, e.y - .3);
    L.combo++;
  }
  function kill(api, e, dir, quiet) {
    if (!e.alive) return; e.alive = false; e.dying = 1.4; e.vy = -9; e.vx = (dir || 1) * 2.5; e.flip = true;
    if (!quiet) { api.sound.sfx("kick"); stompScore(api, e); }
    api.burst(sx(e.x + e.w / 2), sy(e.y), "#ffe066", 8, 200);
  }
  function sx(x) { return (x - L.cam.x) * TS; }
  function sy(y) { return (y - L.cam.y) * TS; }

  /* ---------------- Blocks ---------------- */
  var CONTENT = { E: "cell", F: "emp", K: "boots", Z: "shield", U: "oneup", Y: "mount" };
  function bumpBlock(api, c, r, from) {
    var ch = rawTile(c, r), h = L.hero;
    L.bumps.push({ c: c, r: r, t: 0 });
    // minions standing on a bumped block are knocked out
    L.ents.forEach(function (e) { if (e.alive && e.type !== "u" && e.type !== "c" && Math.abs(e.y + e.h - r) < .2 && e.x + e.w > c && e.x < c + 1) kill(api, e, e.x > c ? 1 : -1); });
    if (ch === "?") { L.grid[r][c] = "q"; coin(api, c, r - 1); L.pops.push({ x: c + .2, y: r - 1, text: "", coin: true, t: 0 }); }
    else if (ch === "$") { var n = L.multi[c + "," + r] = (L.multi[c + "," + r] || 0) + 1; coin(api, c, r - 1); L.pops.push({ x: c + .2, y: r - 1, text: "", coin: true, t: 0 }); if (n >= 8) L.grid[r][c] = "q"; }
    else if (ch === "=") {
      if (h.big || from === "pound") { L.grid[r][c] = "."; addScore(50); api.sound.sfx("block"); for (var i = 0; i < 4; i++) L.debris.push({ x: c + .25 + (i % 2) * .5, y: r + .25 + (i > 1 ? .5 : 0), vx: (i % 2 ? 4 : -4), vy: -10 + (i > 1 ? 3 : 0), t: 0, brick: true, life: 1.2 }); api.kick(2); }
      else api.sound.sfx("block");
    } else if (CONTENT[ch]) {
      L.grid[r][c] = "q"; var kind = CONTENT[ch];
      if ((kind === "boots" || kind === "emp") && G.power === "small") kind = "cell";
      if (kind === "cell" && G.power !== "small" && ch === "E") kind = "boots";
      L.items.push({ kind: kind, x: c + .1, y: r, w: .8, h: .8, vx: 0, vy: 0, rise: .55, dir: h.x + h.w / 2 < c + .5 ? 1 : -1, ground: false });
      api.sound.sfx(kind === "oneup" ? "power" : "special");
    } else api.sound.sfx("block");
  }
  function poundHit(api, p) {
    var h = L.hero; api.kick(7); api.hitstop(.05); api.sound.sfx("heavy"); api.buzz(35);
    api.burst(sx(h.x + h.w / 2), sy(h.y + h.h), L.th.topD, 14, 240);
    var m = mass(), v = P.POUND_V;
    read("pound", "Ground-pound: you hit the floor at v = " + v + " m/s, momentum p = mv = " + m + " × " + v + " = " + (m * v) + " kg·m/s, stopped in a few milliseconds: a huge force F = Δp/Δt.", 5.5, true);
    [Math.floor(h.x + .05), Math.floor(h.x + h.w - .05)].forEach(function (c, i, arr) { if (i && c === arr[0]) return; var ch = rawTile(c, p.r); if (ch === "=" || ch === "$" || ch === "?" || CONTENT[ch]) bumpBlock(api, c, p.r, "pound"); });
    var reach = h.abil && h.abil.shock ? 4.5 : 2.6; if (reach > 3) api.burst(sx(h.x + h.w / 2), sy(h.y + h.h), "#fde68a", 18, 360);
    L.ents.forEach(function (e) { if (e.alive && "wkjsx".indexOf(e.type) >= 0 && e.ground && Math.abs(e.x - h.x) < reach && Math.abs(e.y + e.h - (h.y + h.h)) < .3) { if (e.type === "k") { e.st = "shell"; e.vx = 0; e.h = .7; e.y += .25; addScore(100, e.x, e.y); } else kill(api, e, e.x > h.x ? 1 : -1); } });
  }

  /* ---------------- Platforms ---------------- */
  function platsUpdate(dt) {
    Wh.plats = [];
    L.plats.forEach(function (p) {
      var ox = p.x, oy = p.y;
      if (p.kind === "h" || p.kind === "v") { p.t += dt; var om = p.range > 0 ? p.speed / p.range : 0, off = p.range * Math.sin(p.t * om); if (p.kind === "h") p.x = p.c + off; else p.y = p.r + off; }
      else if (p.kind === "pend") { var w0 = Math.sqrt(P.G / p.len); p.t += dt; p.ang = p.amp * Math.sin(w0 * p.t); p.angV = p.amp * w0 * Math.cos(w0 * p.t); p.x = p.c + .5 + Math.sin(p.ang) * p.len - p.w / 2; p.y = p.r + .5 + Math.cos(p.ang) * p.len; }
      else if (p.kind === "fall") {
        if (p.st === 1) { p.wait -= dt; if (p.wait <= 0) { p.st = 2; p.vf = 0; } }
        if (p.st === 2) { p.vf = Math.min(P.MAX_FALL, p.vf + P.G * dt); p.y += p.vf * dt; if (p.y > L.H + 2) { p.st = 3; p.back = 3; } }
        if (p.st === 3) { p.back -= dt; if (p.back <= 0) { p.st = 0; p.y = p.r; p.vf = 0; } }
      }
      if (p.kind === "pend" && p.first !== false) { p.first = false; ox = p.x; oy = p.y; }
      p.dx = p.x - ox; p.dy = p.y - oy; p.vx = p.dx / dt; p.vy = p.dy / dt; p.off = p.st === 3;
      Wh.plats.push(p);
    });
    L.ents.forEach(function (e) { if (e.type === "u" && e.alive) { e.top = e.top || { press: e, w: e.w }; e.top.x = e.x; e.top.y = e.y; e.top.vx = 0; e.top.vy = e.vy || 0; e.top.dx = 0; e.top.dy = e.dy || 0; Wh.plats.push(e.top); } });
  }

  /* ---------------- Main step ---------------- */
  function play(dt, api) {
    var h = L.hero; L.t += dt; if (L.intro > 0) L.intro -= dt;
    if (L.readT > 0) L.readT -= dt;
    if (L.fade > 0) { var was = L.fade; L.fade -= dt; if (was > .25 && L.fade <= .25 && L.fadeTo) { var d = L.fadeTo; h.x = d.c + .5 - h.w / 2; h.y = d.r + 1 - h.h; h.vx = h.vy = 0; L.fadeTo = null; snapCam(); } if (L.fade > 0) return; }
    stepPops(dt);
    if (L.clear) { L.clear += dt; h.vx = 4; h.face = 1; var ev0 = KL.heroStep(h, { r: true }, dt, Wh); h.step += dt * 8; if (L.clear > 2.6 && !L.tallied) { L.tallied = true; tally(api); } return; }
    if (h.dead) { h.dead += dt; if (h.dead > .45) { h.vy += P.G * .55 * dt; h.y += h.vy * dt; } if (h.dead > 2.3) afterDeath(api); return; }
    if (S.attack) { L.att += dt; L.recT += dt; if (L.recT >= .2) { L.recT -= .2; if (L.rec.length < 6000) L.rec.push(Math.round(h.x * 10), Math.round(h.y * 10)); } }
    else if (!(CT.time || heroOn())) L.time -= dt;
    if (L.time <= 100 && L.lastWarn > 100) { api.sound.sfx("whistle"); pop(h.x, h.y - 1, "HURRY!", "#ffb4b4", true); }
    L.lastWarn = L.time;
    if (L.time <= 0) { L.time = 0; die(api); return; }
    platsUpdate(dt);
    // input
    if (api.double("left") || api.double("right")) h.runLatch = true;
    var inp = { l: api.down("left"), r: api.down("right"), d: api.down("down"), dHit: api.hit("down"), jump: api.down("jump"), jumpHit: api.hit("jump"), run: api.down("run"), dashHit: false };
    if (!inp.l && !inp.r) h.runLatch = false;
    inp.run = inp.run || h.runLatch;
    if (api.hit("run")) {
      if (h.mount === "drone" && h.zapCd <= 0) { h.zapCd = .8; L.shots.push({ kind: "zap", x: h.x + h.w / 2, y: h.y + h.h * .45, vx: h.face * 22, vy: 0, life: .22, r: .3 }); api.sound.sfx("zap"); }
      else if (G.power === "emp" && h.empCd <= 0 && L.shots.filter(function (s) { return s.kind === "emp"; }).length < 2) { h.empCd = .25; var evx = h.face * 9 + h.vx * .3, evy = -5; L.shots.push({ kind: "emp", x: h.x + h.w / 2 + h.face * .4, y: h.y + .5, vx: evx, vy: evy, life: 3, r: .22 }); api.sound.sfx("laser");
        read("empth", "EMP charge thrown at v = " + fx(Math.hypot(evx, evy)) + " m/s, " + Math.round(Math.atan2(-evy, Math.abs(evx)) * 180 / Math.PI) + "° above horizontal: a projectile. Its horizontal speed (" + fx(Math.abs(evx)) + " m/s) stays constant; its vertical speed changes by g = 36 m/s² every second. It bounces off floors.", 5, true); }
      else inp.dashHit = true;
    }
    // the Gale Harpy's wingbeats push you away from it
    if (L.gustT > 0) { L.gustT -= dt; h.vx += L.gustDir * 13 * dt; }
    // ride a platform: move with it (its velocity becomes yours: relative motion)
    if (h.plat && h.ground && !h.plat.off) { KL.sweepX(h, h.plat.dx || 0, Wh, {}); h.y = h.plat.y - h.h; }
    // hidden crates appear when hit from below
    if (h.vy < 0) { var nr = Math.floor(h.y + h.vy * dt - 1e-6); for (var c = Math.floor(h.x); c <= Math.floor(h.x + h.w - 1e-6); c++) { var hc = rawTile(c, nr); if ((hc === "H" || hc === "J") && h.y >= nr + .9) L.grid[nr][c] = hc === "H" ? "U" : "?"; } }
    var platVx = h.plat && h.ground ? h.plat.vx : 0, wasGround = h.ground;
    var ev = KL.heroStep(h, inp, dt, Wh);
    h.plat = ev.plat || null;
    if (h.plat && h.plat.kind === "fall" && h.plat.st === 0) { h.plat.st = 1; h.plat.wait = .45; }
    if (ev.jump) {
      if (platVx) h.vx += platVx;
      api.sound.sfx("jump"); if (!api.reduce) { h.sx = .78; h.sy = 1.24; }
      dust(api, h, 4);
      var v0 = ev.jump, gE = P.G * L.pl.gs, hm = v0 * v0 / (2 * gE), tf = 2 * v0 / gE;
      L.apex = { y: h.y + h.h - hm, x: h.x + h.w / 2, t: tf / 2 + .25, h: hm };
      read("jump", (ev.airjump ? "Quantum jump! " : "Jump: ") + "v₀ = " + fx(v0) + " m/s → h = v₀²/2g = " + fx(hm) + " m, airtime t = 2v₀/g = " + fx(tf) + " s (g = " + fx(gE) + " m/s²). Same jump on Earth: h = " + fx(v0 * v0 / (2 * G_EARTH)) + " m." + (h.boots ? " Spring boots added ½kx²." : ""), 3.2);
      if (platVx && Math.abs(platVx) > .5) read("relv", "Jumping off a moving platform: its velocity (" + fx(platVx) + " m/s) adds to yours. Velocities add: v = v_you + v_platform.", 4);
    }
    if (ev.walljump) { api.sound.sfx("jump"); dust(api, h, 5); }
    if (ev.dash) { api.sound.sfx("dash"); dust(api, h, 6); if (!api.reduce) { h.sx = 1.3; h.sy = .8; } read("dash", "Air dash: an impulse sets your sideways speed to " + P.DASH_V + " m/s in an instant. Impulse J = Δp = mΔv: from a standing start that is " + mass() + " × " + P.DASH_V + " = " + (mass() * P.DASH_V) + " kg·m/s.", 5, true); }
    if (ev.glide) read("glide", "Cape glide: air drag on the cape grows with speed until it balances your weight. At that terminal velocity (4 m/s here) you stop speeding up.", 5, true);
    if (ev.air) {
      if (ev.air.up) read("updraft", "Updraft: the fan pushes up with " + P.UP_A + " m/s² worth of force and gravity pulls down with " + fx(P.G * L.pl.gs) + ", so the net force is upward: ΣF = ma, a = " + fx(P.UP_A - P.G * L.pl.gs) + " m/s² up, until you rise at " + P.UP_MAX + " m/s.", 6, true);
      if (ev.air.gx) read("gust", "Gust: a sideways force of " + P.GUST_A + " m/s² per kilogram. Your jump's horizontal speed keeps growing while you are in it, so you fly further (up to " + P.GUST_MAX + " m/s).", 6, true);
    }
    if (ev.poundStart) { api.sound.sfx("dash"); }
    if (ev.landed != null) {
      L.combo = 0; var imp = ev.landed;
      if (!api.reduce) { var q = clamp(imp / 22, .1, .35); h.sx = 1 + q; h.sy = 1 - q; }
      if (imp > 6) dust(api, h, imp > 14 ? 8 : 4);
      if (h.mount === "bass" && imp > 9) { api.kick(4); api.sound.sfx("boom"); L.ents.forEach(function (e) { if (e.alive && "wkjs".indexOf(e.type) >= 0 && Math.abs(e.x - h.x) < 3.5 && Math.abs(e.y - h.y) < 2.5) kill(api, e, e.x > h.x ? 1 : -1); }); }
      if (h.surf === "I" && !h.mount) read("ice", "Ice: μ = 0.10, so the most friction can brake you is a = μg = " + fx(P.MU_ICE * P.G) + " m/s². From " + fx(Math.max(4, Math.abs(h.vx))) + " m/s you need d = v²/2μg = " + fx(Math.pow(Math.max(4, Math.abs(h.vx)), 2) / (2 * P.MU_ICE * P.G)) + " m to stop (on grass, μ = 0.95: " + fx(Math.pow(Math.max(4, Math.abs(h.vx)), 2) / (2 * P.MU * P.G)) + " m).", 6, true);
    }
    if (h.ground && (h.surf === ">" || h.surf === "<") && !h.mount) { var u = h.surf === ">" ? P.BELT : -P.BELT; L.read = "Conveyor: belt speed u = " + (u > 0 ? "+" : "") + u + " m/s. Your speed over the floor v = v_rel + u = " + fx(h.vx - u) + " + (" + u + ") = " + fx(h.vx) + " m/s."; L.readT = Math.max(L.readT, .6); L.seen.belt = 1; }
    if (h.ground && h.surf === "I" && h.skid && !L.seen.iceSkid) { L.seen.iceSkid = 1; read("iceskid", "Skidding on ice: friction f = μmg = 0.1 × " + mass() + " × 36 = " + fx(.1 * mass() * 36) + " N is all that slows you. Lean early!", 4); }
    if (h.plat && h.plat.kind === "pend") { var pv = Math.abs(h.plat.angV * h.plat.len); L.read = "Swinging platform: r = " + h.plat.len + " m, v = " + fx(pv) + " m/s → a = v²/r = " + fx(pv * pv / h.plat.len) + " m/s² toward the pivot; the net inward force is F = mv²/r = " + Math.round(mass() * pv * pv / h.plat.len) + " N (rod pull minus gravity's part along the rod). Period T = 2π√(L/g) = " + fx(2 * Math.PI * Math.sqrt(h.plat.len / P.G)) + " s (small swings)."; L.readT = Math.max(L.readT, .6); }
    if (ev.bump) bumpBlock(api, ev.bump.c, ev.bump.r);
    if (ev.pound) poundHit(api, ev.pound);
    if (ev.spring) { L.springT = { c: Math.floor(h.x + h.w / 2), r: ev.landRow, t: L.t }; api.sound.sfx("bounce"); if (!api.reduce) { h.sx = .75; h.sy = 1.3; } var m = mass(), E = .5 * m * P.SPRING_V * P.SPRING_V, k = 4e5;
      read("spring", "Spring pad: ½kx² = ½mv². It launches you at " + P.SPRING_V + " m/s, so it stores E = ½ × " + m + " × " + P.SPRING_V + "² = " + Math.round(E) + " J; with k = 400 kN/m that is x = √(2E/k) = " + fx(Math.sqrt(2 * E / k)) + " m of squash. You rise h = v²/2g = " + fx(P.maxHeight(P.SPRING_V)) + " m.", 6); }
    if (ev.lava) { if (h.mount === "wave") { } else { die(api); return; } }
    if (ev.spike) hurt(api);
    // skid dust and footsteps
    if (h.skid && h.ground) { if (Math.random() < .5) dust(api, h, 1); if (L.t % .2 < dt) api.sound.sfx("click"); }
    if (h.ground) h.step += Math.abs(h.vx) * dt * 1.6; else h.airT += dt;
    h.sx += (1 - h.sx) * Math.min(1, dt * 12); h.sy += (1 - h.sy) * Math.min(1, dt * 12);
    h.inv = Math.max(0, h.inv - dt); h.empCd -= dt; h.zapCd -= dt;
    if (h.shield > 0) { h.shield -= dt; if (h.shield <= 0) pop(h.x, h.y - .5, "shield off", "#7ef0ff"); }
    if (h.mountT > 0) h.mountT -= dt;
    if (L.apex) { L.apex.t -= dt; if (L.apex.t <= 0 || h.ground) L.apex = null; }
    pickups(api);
    enemies(dt * lapSpeed(), api);
    items(dt, api);
    shots(dt, api);
    arms(dt, api);
    if (L.boss) bossStep(dt, api);
    debris(dt);
    if (h.y > L.H + 1.5) { die(api); return; }
    // camera
    var t = camTarget(), k = Math.min(1, dt * 6);
    L.cam.x += (t.x - L.cam.x) * k; L.cam.y += (t.y - L.cam.y) * Math.min(1, dt * 4);
    if (L.boss && !L.locked && h.x > L.pl.arenaX + 1.5) lockArena(api);
  }
  function dust(api, h, n) { api.burst(sx(h.x + h.w / 2), sy(h.y + h.h), "rgba(230,220,200,.9)", n, 90); }
  function stepPops(dt) { L.pops.forEach(function (p) { p.t += dt; }); L.pops = L.pops.filter(function (p) { return p.t < (p.coin ? .6 : 1.2); }); L.bumps.forEach(function (b) { b.t += dt; }); L.bumps = L.bumps.filter(function (b) { return b.t < .2; }); }
  function debris(dt) { L.debris.forEach(function (d) { d.t += dt; d.vy += P.G * dt; d.x += d.vx * dt; d.y += d.vy * dt; }); L.debris = L.debris.filter(function (d) { return d.t < d.life; }); }

  function pickups(api) {
    var h = L.hero;
    for (var r = Math.floor(h.y); r <= Math.floor(h.y + h.h - 1e-6); r++) for (var c = Math.floor(h.x); c <= Math.floor(h.x + h.w - 1e-6); c++) {
      var ch = rawTile(c, r);
      if (ch === "o") { L.grid[r][c] = "."; coin(api, c, r); api.burst(sx(c + .5), sy(r + .5), "#ffe066", 4, 90); }
      if (ch === "*") { L.grid[r][c] = "."; var i = L.shardIdx[c + "," + r], got = save.shards[L.lv.id] || [], fresh = !got[i]; got[i] = true; save.shards[L.lv.id] = got; persist();
        if (fresh) { addScore(2000); api.sound.sfx("goal"); api.buzz(30); pop(c, r - .5, "FORMULA FRAGMENT", "#c4b5fd", true); api.burst(sx(c + .5), sy(r + .5), "#c4b5fd", 16, 220);
          var tot = shardTotal(); if (tot % 30 === 0) pop(c, r - 1.4, tot + " fragments: +1 life on every run", "#7dff9a"); }
        else { addScore(100); api.sound.sfx("coin"); pop(c, r - .5, "fragment (already found)", "#a5b4fc"); } }
    }
    if (h.mount === "scooter") for (var r2 = Math.floor(h.y - 2); r2 <= Math.floor(h.y + h.h + 2); r2++) for (var c2 = Math.floor(h.x - 3); c2 <= Math.floor(h.x + h.w + 3); c2++) if (rawTile(c2, r2) === "o") { L.grid[r2][c2] = "."; coin(api, c2, r2); api.burst(sx(c2 + .5), sy(r2 + .5), "#7dff9a", 3, 60); }
    L.cps.forEach(function (cp) { if (!cp.on && h.x + h.w > cp.c - .2 && h.x < cp.c + 1.2 && h.y < cp.r + 1 && h.y + h.h > cp.r - 2) { L.cps.forEach(function (o) { o.on = false; }); cp.on = true; L.check = { c: cp.c, r: cp.r }; api.sound.sfx("power"); pop(cp.c, cp.r - 2, "CHECKPOINT", "#7ef0ff", true); if (G.power === "small") { G.power = "big"; h.power = "big"; resize(h); } } });
    if (h.ground && (api.hit("up") || api.hit("down")) && !L.fade) {
      for (var k in L.doors) L.doors[k].forEach(function (d, i, arr) { if (L.fade) return; if (Math.abs(h.x + h.w / 2 - (d.c + .5)) < .6 && Math.abs(h.y + h.h - (d.r + 1)) < .3) { var to = arr[1 - i]; if (to) { L.fade = .5; L.fadeTo = to; api.sound.sfx("whistle"); } } });
    }
    L.gates.forEach(function (gt) { if (!gt.hidden && h.x + h.w > gt.c - .2 && h.x < gt.c + 1.2 && h.y < gt.r + 1 && h.y + h.h > gt.r - 2.5) levelClear(api, gt); });
  }

  /* ---------------- Minions ---------------- */
  function bodyMove(e, dt) { var ev = {}, gs = L.pl.gs; e.vy = Math.min(P.MAX_FALL * Math.sqrt(gs), (e.vy || 0) + P.G * gs * dt); KL.sweepX(e, e.vx * dt, We, ev); KL.sweepY(e, e.vy * dt, We, ev); e.ground = !!ev.land; if (e.y > L.H + 2) { e.alive = false; e.gone = true; } return ev; }
  function edgeAhead(e) { var fxx = e.dir > 0 ? e.x + e.w + .05 : e.x - .05, ch = We.tile(Math.floor(fxx), Math.floor(e.y + e.h + .1)); return KL.kind(ch) === 0; }
  function enemies(dt, api) {
    var h = L.hero, camR = L.cam.x + VWT + 4, camL = L.cam.x - 10;
    L.ents.forEach(function (e) {
      if (e.gone) return;
      if (!e.awake) { if (e.x < camR && e.x > camL - 4) e.awake = true; else return; }
      if (!e.alive) { if (e.dying) { e.dying -= dt; e.vy += P.G * dt; e.y += e.vy * dt; e.x += e.vx * dt; if (e.dying <= 0) e.gone = true; } else if (e.squash) { e.squash -= dt; if (e.squash <= 0) e.gone = true; } return; }
      e.t += dt;
      var ev;
      if (e.type === "w") { e.vx = e.dir * 1.6; ev = bodyMove(e, dt); if (ev.wall) e.dir *= -1; }
      else if (e.type === "s" || (e.type === "k" && e.st === "walk")) { e.vx = e.dir * (e.type === "s" ? 1.2 : 1.4); if (e.ground && edgeAhead(e)) e.dir *= -1; e.vx = e.dir * Math.abs(e.vx); ev = bodyMove(e, dt); if (ev.wall) e.dir *= -1; }
      else if (e.type === "k") {
        if (e.st === "shell") { e.vx = 0; bodyMove(e, dt); e.wake = (e.wake || 0) + dt; if (e.wake > 8) { e.st = "walk"; e.h = .95; e.y -= .25; e.wake = 0; } }
        else { e.grace = Math.max(0, (e.grace || 0) - dt); var sgn = e.vx > 0 ? 1 : -1; e.vx -= sgn * .02 * P.G * dt; var pre = e.vx; ev = bodyMove(e, dt); if (ev.wall) { e.vx = -pre; api.sound.sfx("bounce"); if (Math.abs(e.x - h.x) < 14) api.kick(1.5); }
          L.ents.forEach(function (o) { if (o !== e && o.alive && o.type !== "u" && o.type !== "c" && overlap(e, o)) { if (o.type === "k" && o.st === "slide") { kill(api, o, -sgn); kill(api, e, sgn, true); } else kill(api, o, sgn); } });
          if (L.boss && L.boss.alive && overlap(e, L.boss)) { bossHit(api, 1, "puck"); kill(api, e, -sgn, true); } }
      }
      else if (e.type === "j") { if (e.ground) { e.vx = 0; e.t2 = (e.t2 || 0) + dt; if (e.t2 > 1.1) { e.t2 = 0; e.vy = -12; e.vx = (h.x > e.x ? 1 : -1) * 3; e.dir = e.vx > 0 ? 1 : -1; } } ev = bodyMove(e, dt); if (ev.wall) e.vx = -e.vx; }
      else if (e.type === "b") { e.ph += dt; var nx = e.x0 + Math.sin(e.ph * .8) * 3, dx2 = nx - e.x; e.dir = dx2 > 0 ? 1 : -1; e.x = nx; e.y = e.y0 + .2 + Math.sin(e.ph * 3) * .45; }
      else if (e.type === "r") { // gust kite: rides the wind, then dives at you and climbs back
        e.ph += dt;
        if (e.st === "fly") { var kx = e.x0 + Math.sin(e.ph * .9) * 2.5; e.dir = kx > e.x ? 1 : -1; e.x = kx; e.y = e.y0 + .2 + Math.sin(e.ph * 2.4) * .5; e.cd -= dt;
          var dxk = h.x - e.x; if (e.cd <= 0 && Math.abs(dxk) < 6 && h.y > e.y + .5 && h.y - e.y < 9) { e.st = "dive"; e.dvx = dxk > 0 ? 5 : -5; e.dvy = 9; e.dt = 0; e.dir = e.dvx > 0 ? 1 : -1; } }
        else { e.dt += dt; e.x += e.dvx * dt; e.y += e.dvy * dt; e.dvy -= 15 * dt; if (e.dt > .3 && e.y <= e.y0 + .2) { e.st = "fly"; e.cd = 2.4; e.x0 = e.x - Math.sin(e.ph * .9) * 2.5; } }
      }
      else if (e.type === "x") { // moon hopper: the same push as a spring imp, but bigger in weak gravity
        if (e.ground) { e.vx = 0; e.t2 = (e.t2 || 0) + dt; if (e.t2 > 1.3) { e.t2 = 0; e.vy = -13; e.vx = (h.x > e.x ? 1 : -1) * 2.6; e.dir = e.vx > 0 ? 1 : -1; } }
        ev = bodyMove(e, dt); if (ev.wall) e.vx = -e.vx; }
      else if (e.type === "u") {
        var cxp = e.x + e.w / 2, oy = e.y;
        if (e.st === "wait") { e.t -= dt; if (e.t <= 0 && Math.abs(h.x + h.w / 2 - cxp) < 1.4 && h.y > e.y + .5 && h.y - e.y < 14) { e.st = "fall"; e.vy = 0; e.from = e.y; } }
        else if (e.st === "fall") { e.vy = Math.min(P.MAX_FALL * 1.5, e.vy + P.G * dt); e.y += e.vy * dt; var rb = Math.floor(e.y + e.h);
          if (solidAt(e.x + .1, e.y + e.h) || solidAt(e.x + e.w - .1, e.y + e.h)) { e.y = rb - e.h; var hh = e.y - e.from, vimp = Math.sqrt(2 * P.G * hh);
            e.st = "rest"; e.t = 1; e.vy = 0; if (Math.abs(cxp - h.x) < 16) { api.kick(5); api.sound.sfx("heavy"); }
            if (Math.abs(cxp - h.x) < 12) read("press", "Hydraulic press dropped h = " + fx(hh) + " m: it hits at v = √(2gh) = " + fx(vimp) + " m/s. Its potential energy mgh became kinetic energy ½mv².", 4.5); } }
        else if (e.st === "rest") { e.t -= dt; if (e.t <= 0) e.st = "rise"; }
        else if (e.st === "rise") { e.y -= 2.2 * dt; if (e.y <= e.home) { e.y = e.home; e.st = "wait"; e.t = .7; } }
        e.dy = e.y - oy; e.vy = e.st === "fall" ? e.vy : e.dy / dt;
        // touching the press anywhere but its top hurts
        if (overlap(h, e) && !(h.plat && h.plat.press === e) && h.y + h.h > e.y + .3) hurt(api);
        return;
      }
      else if (e.type === "c") {
        e.fire -= dt; var dxh = h.x + h.w / 2 - (e.c + .5), dyh = (h.y + h.h / 2) - (e.r + .5);
        if (e.fire <= 0 && Math.abs(dxh) > 2.5 && Math.abs(dxh) < 13 && Math.abs(dyh) < 9) { e.fire = 2.8; fireArc(api, e.c + .5, e.r - .1, h.x + h.w / 2, h.y + h.h * .5, 15.5, "bolt"); }
        return;
      }
      if (!e.alive) return;
      heroVsEnemy(api, e);
    });
    L.ents = L.ents.filter(function (e) { return !e.gone; });
  }
  // launch a projectile from (x0,y0) to hit (x1,y1) at fixed speed v: tan θ = (v² ± √(v⁴ − g(g dx² + 2 dy v²))) / (g dx)
  function fireArc(api, x0, y0, x1, y1, v, kind) {
    var dx = x1 - x0, dy = y0 - y1, g = P.G, ad = Math.abs(dx), disc = v * v * v * v - g * (g * ad * ad + 2 * dy * v * v), th;
    if (disc >= 0) th = Math.atan((v * v - Math.sqrt(disc)) / (g * ad)); else th = Math.PI / 4;
    if (kind === "magma" && disc >= 0 && Math.random() < .5) th = Math.atan((v * v + Math.sqrt(disc)) / (g * ad));
    var dir = dx >= 0 ? 1 : -1;
    L.shots.push({ kind: kind, x: x0, y: y0, vx: dir * v * Math.cos(th), vy: -v * Math.sin(th), life: 4, r: kind === "magma" ? .38 : .26, v: v, th: th });
    api.sound.sfx("boom");
    if (Math.abs(x0 - L.hero.x) < 16) read("arc" + kind, (kind === "magma" ? "Magma lob" : "Chaos mortar") + ": v = " + fx(v) + " m/s at θ = " + Math.round(th * 180 / Math.PI) + "°. On flat ground it would land R = v² sin 2θ / g = " + fx(v * v * Math.sin(2 * th) / g) + " m away. The mortar solves the projectile equation to aim at you.", 5, kind === "bolt");
  }
  function heroVsEnemy(api, e) {
    var h = L.hero; if (h.dead || L.clear || !overlap(h, e)) return;
    if (h.shield > 0) { kill(api, e, h.face); return; }
    var feet = h.y + h.h, stomp = h.vy > 0 && feet - e.y < .5 + h.vy * P.DT * 2;
    if (e.type === "k" && e.st === "shell") {
      e.st = "slide"; e.vx = (h.x + h.w / 2 < e.x + e.w / 2 ? 1 : -1) * 12; e.grace = .3; api.sound.sfx("kick"); addScore(400, e.x, e.y);
      read("puck", "Kicked puck: 12 m/s across a near-frictionless floor (μ = 0.02 → it slows at only μg = " + fx(.02 * P.G) + " m/s²). It rebounds off walls with the same speed: an elastic collision.", 5, true);
      if (stomp) { h.vy = -10; } return;
    }
    if (stomp) {
      if (e.type === "s" && h.mount !== "horse") { hurt(api); h.vy = -9; return; }
      if (e.type === "k" && e.st === "slide") { e.st = "shell"; e.vx = 0; stompScore(api, e); }
      else if (e.type === "k") { e.st = "shell"; e.vx = 0; e.h = .7; e.y += .25; e.wake = 0; stompScore(api, e); }
      else if (e.type === "b" || e.type === "r") { kill(api, e, h.face, true); stompScore(api, e); }
      else { e.alive = false; e.squash = .45; stompScore(api, e); }
      api.sound.sfx("stomp"); api.hitstop(.045); api.buzz(18); api.burst(sx(e.x + e.w / 2), sy(e.y), "#fff", 6, 140);
      h.vy = -(api.down("jump") ? 15 : 10); h.jumping = api.down("jump"); h.pounding = false; h.sx = .85; h.sy = 1.15;
      return;
    }
    if (e.type === "k" && e.st === "slide" && e.grace > 0) return;
    if (h.mount === "horse" && e.type !== "s" && h.vx * (e.x - h.x) > 0 && Math.abs(h.vx) > 8) { kill(api, e, h.face); return; }
    hurt(api);
  }

  /* ---------------- Items, shots, spark arms ---------------- */
  function items(dt, api) {
    var h = L.hero;
    L.items.forEach(function (it) {
      if (it.rise > 0) { it.rise -= dt; it.y -= dt * 1.6; return; }
      if (it.kind === "emp" || it.kind === "mount") { it.vx = 0; bodyMove(it, dt); }
      else { if (!it.vx) it.vx = it.dir * (it.kind === "shield" ? 3 : 2.6); var pre = it.vx, ev = bodyMove(it, dt); if (ev.wall) it.vx = -pre; if (it.ground && (it.kind === "boots" || it.kind === "shield")) it.vy = it.kind === "shield" ? -11 : -8; }
      if (overlap(h, it) && !h.dead) { it.got = true; powerUp(api, it.kind, it.x, it.y); }
      if (it.y > L.H + 2) it.got = true;
    });
    L.items = L.items.filter(function (it) { return !it.got; });
  }
  function shots(dt, api) {
    var h = L.hero;
    L.shots.forEach(function (s) {
      s.life -= dt; var px = s.x, py = s.y;
      if (s.kind === "zap") { s.x += s.vx * dt; }
      else if (s.kind === "puck") { s.vy += P.G * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (solidAt(s.x, s.y + .25)) { s.y = Math.floor(s.y + .25) - .25; s.vy = 0; } if (solidAt(s.x + (s.vx > 0 ? .3 : -.3), s.y)) s.life = 0; }
      else { s.vy = Math.min(P.MAX_FALL, s.vy + P.G * dt); s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.kind === "emp" && solidAt(s.x, s.y + s.r)) { s.y = Math.floor(s.y + s.r) - s.r; s.vy = -7; }
        if (solidAt(s.x, s.y)) { s.life = 0; api.burst(sx(s.x), sy(s.y), s.kind === "emp" ? "#7ef0ff" : "#ff8a3d", 6, 120); } }
      var box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      if (s.kind === "emp" || s.kind === "zap") {
        L.ents.forEach(function (e) { if (s.life > 0 && e.alive && e.type !== "u" && e.type !== "c" && overlap(box, e)) { kill(api, e, s.vx > 0 ? 1 : -1); s.life = s.kind === "zap" ? s.life : 0; } });
        if (L.boss && L.boss.alive && overlap(box, L.boss) && s.life > 0) { s.life = 0; bossHit(api, 1 / 3, "emp"); }
      } else if (!h.dead && overlap(box, h)) {
        if (h.shield > 0) { s.life = 0; }
        else if (s.kind === "bolt" && h.vy > 0 && h.y + h.h - box.y < .45) { s.life = 0; h.vy = -10; addScore(100, s.x, s.y); api.sound.sfx("stomp"); }
        else { s.life = 0; hurt(api); }
      }
    });
    L.shots = L.shots.filter(function (s) { return s.life > 0 && s.y < L.H + 2 && s.x > -2 && s.x < L.W + 2; });
    L.waves.forEach(function (w) { w.x += w.v * dt; w.life -= dt; if (!h.dead && h.ground && Math.abs(h.x + h.w / 2 - w.x) < .5 && Math.abs(h.y + h.h - w.y) < .4) hurt(api); });
    L.waves = L.waves.filter(function (w) { return w.life > 0; });
  }
  function arms(dt, api) {
    var h = L.hero;
    L.arms.forEach(function (a) {
      a.th += a.w * dt;
      var cx = a.c + .5, cy = a.r + .5;
      if (Math.abs(cx - h.x) < 9) read("arm", "Spark arm: ω = " + Math.abs(a.w) + " rad/s. The outer spark, r = " + a.len + " m out, moves at v = ωr = " + fx(Math.abs(a.w) * a.len) + " m/s with centripetal acceleration ω²r = " + fx(a.w * a.w * a.len) + " m/s²; sparks near the pivot are slow.", 5.5, true);
      if (h.dead || h.inv > 0 || h.shield > 0) return;
      for (var k = 1; k <= a.len * 2; k++) { var rr = k * .5, ox = cx + Math.cos(a.th) * rr, oy = cy + Math.sin(a.th) * rr;
        var nx = clamp(ox, h.x, h.x + h.w), ny = clamp(oy, h.y, h.y + h.h); if ((nx - ox) * (nx - ox) + (ny - oy) * (ny - oy) < .07) { hurt(api); return; } }
    });
  }

  /* ---------------- Bosses ---------------- */
  var BOSS = {
    brute: { name: "BULK SCRAMBLER", sub: "Jump the shockwaves, stomp its head", col: "#c084fc", edge: "#4c1d95" },
    golem: { name: "CRYO GOLEM", sub: "It slides with no friction. Stomp it when it is dizzy", col: "#a5f3fc", edge: "#155e75" },
    boiler: { name: "BOILER BRUTE", sub: "Dodge the arcs. Stomp the open valve", col: "#fdba74", edge: "#7c2d12" },
    entropy: { name: "COUNT ENTROPY", sub: "Restore order to the kingdom!", col: "#f0abfc", edge: "#581c87" },
    harpy: { name: "GALE HARPY", sub: "Lean into the gusts. Stomp it when it dives", col: "#7dd3fc", edge: "#0c4a6e" },
    mech: { name: "LUNAR MECH", sub: "Stomp it while it vents after each landing", col: "#cbd5e1", edge: "#334155" },
    prime: { name: "ENTROPY PRIME", sub: "The last battle for the kingdom", col: "#f0abfc", edge: "#3b0764" }
  };
  function floorRow(c) { for (var r = 0; r < L.H; r++) if (KL.kind(rawTile(c, r)) === 1) return r; return L.H; }
  function lockArena(api) {
    L.locked = true; var ax = L.pl.arenaX - 1, fr = floorRow(ax);
    for (var r = 0; r < fr; r++) L.grid[r][ax] = "X";
    var B = BOSS[L.boss.kind]; api.banner(B.name, { sub: B.sub, col: B.col, edge: B.edge, size: 84, dur: 2.4 });
    api.sound.sfx("whistle"); api.kick(4); L.boss.st = "intro"; L.boss.t = 1.8; L.boss.floorY = floorRow(L.boss.home.c || Math.floor(L.boss.x + 1));
    if (L.boss.kind === "entropy") api.sound.say("Count Entropy! Order will fall to chaos!");
    if (L.boss.kind === "golem") read("golem", "Cryo Golem: its claws can push it toward you at only 7 m/s², and on frictionless ice nothing pushes back, so it overshoots and slams into the walls (each bounce keeps 90 % of its speed). That leaves it dizzy.", 6);
    if (L.boss.kind === "brute") read("brute", "Bulk Scrambler: when it lands, the impact sends a wave along the floor at 8 m/s. Be in the air when it passes.", 6);
    if (L.boss.kind === "boiler") read("boiler", "Boiler Brute: each lob is a projectile. It picks the launch angle that lands on you: R = v² sin 2θ / g.", 6);
    if (L.boss.kind === "prime") api.sound.say("You again? This time, disorder wins!");
    if (L.boss.kind === "harpy") read("harpy", "Gale Harpy: each wingbeat pushes air at you. A force on you changes your velocity (F = ma), so lean into it and keep your footing.", 6);
    if (L.boss.kind === "mech") read("mech", "Lunar Mech: in weak gravity its leaps are huge and slow (t = 2v/g). After every landing it vents heat for a second: that is your window.", 6);
    if (L.boss.kind === "prime") read("prime", "Entropy Prime: two phases. Halfway down he starts lobbing chaos arcs as well: watch each parabola.", 6);
    if (L.boss.kind === "entropy") read("entropy", "Count Entropy drops disorder bolts: they start with no vertical speed and fall with g = 36 m/s², so after t seconds they have dropped ½gt² (until they reach the 20 m/s top speed).", 6);
  }
  function bossVulnerable(b) {
    if (b.inv > 0) return false;
    if (b.kind === "golem") return b.dizzy > 0;
    if (b.kind === "boiler") return b.st === "vent";
    if (b.kind === "mech") return b.dizzy > 0;
    return true;
  }
  function bossHit(api, dmg, src) {
    var b = L.boss; if (!b.alive || (b.inv > 0 && src !== "emp")) return;
    b.chip += dmg; api.sound.sfx("hit"); api.burst(sx(b.x + b.w / 2), sy(b.y), "#fff", 10, 220);
    if (b.chip < .999) { pop(b.x + b.w / 2, b.y - .4, "zap!", "#7ef0ff"); return; }
    b.chip = 0; b.hp--; b.inv = 1.1; api.hitstop(.09); api.kick(7); api.flash("#ffffff", .12); api.buzz(60); addScore(1000, b.x + b.w / 2, b.y - .5);
    if (b.kind === "golem") { b.dizzy = 0; b.vx = (b.x > L.hero.x ? 1 : -1) * 8; b.st = "slide"; }
    if (b.kind === "boiler") { b.st = "volley"; b.t = 1.2; b.n = 0; }
    if (b.kind === "brute") { b.dizzy = .9; }
    if (b.kind === "mech") { b.dizzy = 0; b.st = "walk"; b.t = 1.2; }
    if (b.kind === "harpy") { b.st = "rise"; b.t = 1; }
    if (b.kind === "prime") { b.st = "rise"; b.t = .8; api.sound.say(["Order is an illusion!", "I am every wasted joule!", "You cannot win forever!", "Enough!"][b.hp % 4]); if (b.hp === Math.floor(b.max / 2)) { api.banner("PHASE TWO", { sub: "Entropy Prime is enraged", col: "#f0abfc", edge: "#3b0764", size: 72 }); api.flash("#a855f7", .25); } }
    if (b.kind === "entropy") { b.st = "rise"; b.t = 1; api.sound.say(["Impossible!", "Disorder always grows!", "You cannot reverse me!", "No!"][b.hp % 4]); }
    if (b.hp <= 0) bossDown(api);
  }
  function bossDown(api) {
    var b = L.boss; b.alive = false; b.dieT = 0; b.vy = -10; b.vx = 2;
    L.shots = []; L.waves = []; L.ents.forEach(function (e) { if (e.alive && e.type !== "u" && e.type !== "c") kill(api, e, 1, true); });
    L.gates.forEach(function (gt) { gt.hidden = false; gt.appear = 0; });
    addScore(5000);
    var fin = b.kind === "prime";
    api.banner(fin ? "ORDER RESTORED!" : b.kind === "entropy" ? "COUNT ENTROPY FLEES!" : "BOSS DOWN!", { sub: fin ? "Count Entropy is beaten for good" : b.kind === "entropy" ? "He escapes to the Windward Cliffs" : "The gate is open", col: "#7dff9a", edge: "#14532d", size: 96 });
    api.confetti(200); api.sound.sfx("win"); api.slowmo(.35, .8); api.buzz([40, 30, 40, 30, 80]);
    if (b.kind === "entropy") api.sound.say("Curses! You will never catch me in the clouds!");
    if (fin) api.sound.say("Curses! Entropy will rise again. It always does!");
  }
  function bossStep(dt, api) {
    var b = L.boss, h = L.hero;
    if (!b.alive) { if (b.dieT != null) { b.dieT += dt; b.vy += P.G * .5 * dt; b.y += b.vy * dt; b.x += b.vx * dt; } return; }
    if (!L.locked) return;
    b.inv = Math.max(0, b.inv - dt); b.dizzy = Math.max(0, b.dizzy - dt); b.t -= dt;
    var ax = L.pl.arenaX, fy = floorRow(ax + 2), hurtTouch = true, ev;
    if (b.kind === "brute" || b.kind === "mech") {
      var mech = b.kind === "mech";
      if (b.st === "intro") { if (b.t <= 0) { b.st = "walk"; b.t = 2; } }
      else if (b.st === "walk") { b.face = h.x > b.x ? 1 : -1; b.vx = b.dizzy > 0 ? 0 : b.face * ((mech ? 1.8 : 2.2) + (b.max - b.hp) * .9);
        if (b.t <= 0 && b.ground && b.dizzy <= 0) { b.vy = mech ? -14 : -15; b.vx = b.face * (mech ? 5 : 3.5); b.st = "jump"; b.air = false; } }
      if (b.st === "jump" && b.air && b.ground) { L.waves.push({ x: b.x, y: b.y + b.h, v: -8, life: 2.4 }, { x: b.x + b.w, y: b.y + b.h, v: 8, life: 2.4 }); api.kick(7); api.sound.sfx("heavy"); api.buzz(30); b.st = "walk"; b.t = Math.max(1, 2.4 - (b.max - b.hp) * .5);
        if (mech) { b.dizzy = 1.3; pop(b.x + b.w / 2, b.y - .5, "VENTING!", "#fde68a", true); } }
      ev = bodyMove(b, dt); if (!b.ground) b.air = true; if (ev.wall) b.face *= -1;
      if (b.dizzy > 0) hurtTouch = false;
    } else if (b.kind === "golem") {
      if (b.st === "intro") { if (b.t <= 0) { b.st = "slide"; b.t = 3; } }
      else if (b.st === "slide") { var dir = h.x > b.x ? 1 : -1; b.vx += dir * 7 * dt; b.vx = clamp(b.vx, -13, 13); b.face = b.vx > 0 ? 1 : -1;
        if (b.t <= 0) { b.t = 3.2 - (b.max - b.hp) * .5; L.shots.push({ kind: "puck", x: b.x + b.w / 2, y: b.y + b.h - .3, vx: (h.x > b.x ? 1 : -1) * 7, vy: 0, life: 4, r: .3 }); api.sound.sfx("kick"); } }
      else if (b.st === "dizzy") { b.vx *= Math.pow(.02, dt); if (b.dizzy <= 0) { b.st = "slide"; b.t = 1.5; } }
      var pre = b.vx; ev = bodyMove(b, dt);
      if (ev.wall) { b.vx = -pre * .9; api.kick(4); api.sound.sfx("heavy"); if (Math.abs(pre) > 6 && b.st === "slide") { b.st = "dizzy"; b.dizzy = 1.8; pop(b.x + b.w / 2, b.y - .5, "DIZZY!", "#a5f3fc", true); } }
      if (b.dizzy > 0) hurtTouch = false;
    } else if (b.kind === "boiler") {
      b.face = h.x > b.x ? 1 : -1;
      if (b.st === "intro") { if (b.t <= 0) { b.st = "volley"; b.t = .6; b.n = 0; } }
      else if (b.st === "volley") { if (b.t <= 0) { b.n++; b.t = .8 - (b.max - b.hp) * .12; fireArc(api, b.x + b.w / 2, b.y + .3, h.x + h.w / 2 + (Math.random() - .5) * 1.5, h.y + h.h, 15 + (b.max - b.hp), "magma"); if (b.n >= 3 + (b.max - b.hp)) { b.st = "vent"; b.t = 2.4; api.sound.sfx("special"); pop(b.x + b.w / 2, b.y - .6, "VALVE OPEN!", "#fdba74", true); } } }
      else if (b.st === "vent") { if (Math.random() < .5) api.burst(sx(b.x + b.w / 2), sy(b.y - .2), "rgba(240,240,255,.8)", 1, 120); if (b.t <= 0) { b.st = "volley"; b.t = .5; b.n = 0; } }
      ev = bodyMove(b, dt);
    } else if (b.kind === "entropy" || b.kind === "harpy" || b.kind === "prime") {
      var cx = ax + 13, hoverY = fy - 6.5, harpy = b.kind === "harpy", prime = b.kind === "prime", angry = prime && b.hp <= b.max / 2;
      if (harpy) { b.gust -= dt; if (b.gust <= 0 && b.st !== "swoop") { b.gust = 4.5 - (b.max - b.hp) * .5; L.gustT = 1.4; L.gustDir = h.x > b.x ? 1 : -1; api.sound.sfx("dash"); pop(b.x + b.w / 2, b.y - .5, "WINGBEAT!", "#7dd3fc", true); } }
      if (prime) { b.arc -= dt; if (angry && b.arc <= 0 && b.st !== "swoop") { b.arc = 2.6; fireArc(api, b.x + b.w / 2, b.y + b.h, h.x + h.w / 2, h.y + h.h, 15, "magma"); } }
      b.ph = (b.ph || 0) + dt;
      if (b.st === "intro") { b.y += (hoverY - b.y) * Math.min(1, dt * 2); if (b.t <= 0) { b.st = "float"; b.t = 4; b.drop = 1.4; b.call = 5; } }
      else if (b.st === "float" || b.st === "rise") {
        var tx = cx + Math.sin(b.ph * .7) * 9 - b.w / 2; b.x += (tx - b.x) * Math.min(1, dt * 1.6); b.y += (hoverY - b.y) * Math.min(1, dt * 2);
        b.face = h.x > b.x ? 1 : -1; b.drop -= dt; b.call -= dt;
        if (b.drop <= 0) { b.drop = harpy ? 2 : prime ? (angry ? .7 : 1.1) : b.hp <= 2 ? .9 : 1.4; L.shots.push({ kind: "dis", x: b.x + b.w / 2, y: b.y + b.h, vx: (Math.random() - .5) * 3, vy: 0, life: 3, r: .28 }); api.sound.sfx("zap");
          if ((b.hp <= 2 && !harpy) || angry) [-1, 1].forEach(function (s) { L.shots.push({ kind: "dis", x: b.x + b.w / 2, y: b.y + b.h, vx: s * 6, vy: -4, life: 3, r: .26 }); }); }
        if (b.call <= 0 && !harpy) { b.call = prime ? 6 : 7; if (L.ents.filter(function (e) { return e.alive && e.type === "w"; }).length < 2) { var e = spawnEnemy("w", Math.floor(b.x + 1), Math.floor(b.y + b.h)); e.awake = true; e.dir = h.x > b.x ? 1 : -1; api.sound.sfx("special"); pop(b.x, b.y, "Minion!", "#c084fc"); } }
        if (b.t <= 0 && b.st === "float") { b.st = "swoop"; b.sw = 0; b.sx0 = b.x; b.sdir = h.x > b.x ? 1 : -1; b.t = 2.2; api.sound.sfx("dash"); }
        if (b.st === "rise" && b.t <= 0) { b.st = "float"; b.t = 3.5; }
      } else if (b.st === "swoop") {
        b.sw += dt / (angry ? 1.6 : 2.2); var u = Math.min(1, b.sw);
        b.x = clamp(b.sx0 + b.sdir * 16 * u, ax + .5, ax + 26 - b.w); b.y = hoverY + (fy - b.h - .6 - hoverY) * Math.sin(u * Math.PI);
        if (u >= 1) { b.st = "float"; b.t = 3.6 - (b.max - b.hp) * .35; }
      }
    }
    // contact with the hero
    if (!h.dead && overlap(h, b)) {
      var feet = h.y + h.h, stomp = h.vy > 0 && feet - b.y < .7 + h.vy * P.DT * 2;
      if (stomp && bossVulnerable(b)) { bossHit(api, 1, "stomp"); h.vy = -15; h.jumping = true; api.sound.sfx("stomp"); h.pounding = false; }
      else if (stomp && b.inv > 0) { h.vy = -12; }
      else if (stomp && b.kind === "boiler") { hurt(api); h.vy = -12; h.vx = -6; pop(h.x, h.y, "Too hot! Wait for the valve", "#fdba74"); }
      else if (stomp && b.kind === "golem") { h.vy = -13; pop(h.x, h.y, "Wait until it is dizzy", "#a5f3fc"); }
      else if (hurtTouch && b.inv <= 0 && h.shield <= 0) { hurt(api); h.vx = (h.x < b.x ? -1 : 1) * 8; h.vy = -8; }
    }
  }

  /* ---------------- Level clear, death, tally ---------------- */
  function fmtT(t) { var m = Math.floor(t / 60), s2 = t - m * 60; return (m ? m + ":" + (s2 < 10 ? "0" : "") : "") + s2.toFixed(2); }
  function attackClear(api) {
    L.clear = .001; var t = Math.round(L.att * 100) / 100, best = save.best[L.lv.id], rec = !best || t < best, honest = !(API.cheated || heroOn());
    if (rec && honest) { save.best[L.lv.id] = t; persist(); A.store("kk-g-" + L.lv.id, { t: t, f: L.rec }); }
    L.attRes = { t: t, best: best, rec: rec && honest };
    api.banner(L.attRes.rec ? "NEW BEST!" : "FINISH", { sub: fmtT(t) + " s", col: "#7ef0ff", edge: "#0e7490" }); api.sound.sfx("goal"); api.confetti(L.attRes.rec ? 160 : 40);
  }
  function levelClear(api, gt) {
    if (L.clear) return;
    if (S.attack) return attackClear(api);
    var wasDone = save.done[L.lv.id] && !save.done[L.lv.id].skipped;
    var h = L.hero, m = mass(), v = Math.abs(h.vx), KE = .5 * m * v * v, keB = Math.min(3000, Math.round(KE / 50) * 10), tb = Math.ceil(L.time) * 10;
    L.clear = .001; L.tally = { m: m, v: v, KE: KE, keB: keB, tb: tb, coins: L.coinsHere, secret: gt.secret };
    G.score += tb + keB;
    var lv = L.lv, prev = save.done[lv.id] || {}, pts = G.score - L.scoreAtStart;
    var isRec = !!prev.best && pts > prev.best;
    save.done[lv.id] = { best: Math.max(prev.best || 0, pts), secs: Math.round(lv.time - L.time), secret: !!(prev.secret || gt.secret) };
    if (gt.secret) save.secrets[lv.id] = true;
    var un = [];
    if (!wasDone) { ABIL.forEach(function (a) { if (a[1] === lv.id) un.push("<b>New ability: " + a[2] + ".</b> " + a[3]); });
      for (var cid in CHAR_REQ) if (CHAR_REQ[cid] === lv.id) un.push("<b>New scientist to play: " + A.esc((A.byId[cid] || {}).name || cid) + ".</b>");
      if (lv.boss) { var ch = LV.filter(function (o) { return o.trial && o.world === lv.world; })[0]; if (ch) un.push("<b>Challenge level open:</b> " + A.esc(ch.name) + " (gold node above the boss on the map)."); } }
    if (lv.boss === "prime" && save.lap === save.lapMax && save.lapMax < 9) { save.lapMax++; un.push("<b>Remix lap " + save.lapMax + " unlocked.</b> Minions move faster and clocks run shorter. Pick it on the map."); }
    var nx = nextIdx(L.idx); save.sel = nx >= 0 ? nx : L.idx; S.sel = save.sel; persist();
    L.tally.pts = pts; L.tally.record = isRec; L.tally.un = un;
    A.report(SLUG, { result: "win", stage: lv.stage, score: Math.min(5000, Math.round(pts / 10)) });
    api.banner(gt.secret ? "SECRET EXIT!" : "LEVEL CLEAR!", { sub: lv.name, col: gt.secret ? "#c4b5fd" : "#ffd84a", edge: gt.secret ? "#4c1d95" : "#8a4b00" });
    api.confetti(160); api.sound.sfx("goal"); api.buzz([30, 40, 30]); api.kick(3);
    read("gate", "Through the gate at v = " + fx(v) + " m/s: kinetic energy KE = ½mv² = ½ × " + m + " kg × (" + fx(v) + " m/s)² = " + Math.round(KE) + " J → +" + keB + " points. Speed counts twice: double v, four times the energy.", 7);
  }
  function attackTally(api) {
    var R2 = L.attRes, lv = L.lv, idx = L.idx;
    var html = "<h2>Time attack: " + A.esc(lv.id + " " + lv.name) + "</h2><table class='gm-tally'><tr><td>Your time</td><td><b>" + fmtT(R2.t) + " s</b></td></tr>" +
      "<tr><td>Best before</td><td>" + (R2.best ? fmtT(R2.best) + " s" : "none yet") + "</td></tr></table>" +
      (R2.rec ? "<p>New best. Your ghost will race you next time.</p>" : R2.best ? "<p>" + fmtT(Math.abs(R2.t - R2.best)) + " s behind your best.</p>" : "") +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>Race again</button><button class='gm-btn' data-act='map'>World map</button></div>";
    api.ceremony(R2.rec ? "newRecord" : "stageClear", { title: R2.rec ? "NEW BEST!" : "FINISHED", sub: lv.id + " " + lv.name, hero: who(), trophy: "star", score: Math.round(R2.t * 100) / 100, scoreLabel: "Seconds",
      stats: [["Time", fmtT(R2.t) + " s"], ["Best before", R2.best ? fmtT(R2.best) + " s" : "-"]], line: R2.rec ? "A new ghost to beat." : "Race your ghost again.",
      then: function () { api.show(html, function (a) { api.hide(); if (a === "again") startLevel(api, idx, "attack"); else toMap(api); }); } });
  }
  function tally(api) {
    if (S.attack) return attackTally(api);
    var t = L.tally, lv = L.lv, idx = L.idx, got = (save.shards[lv.id] || []).filter(Boolean).length, last = lv.boss === "prime";
    var w = WD[lv.world - 1], nx = nextIdx(idx), nextOk = !last && nx >= 0 && unlocked(nx);
    var html = "<h2>" + (last ? "Count Entropy is beaten!" : (t.secret ? "Secret exit found: " : "Cleared: ") + A.esc(lv.id + " " + lv.name)) + "</h2>" +
      "<table class='gm-tally'><tr><td>Time bonus</td><td>" + Math.ceil(L.time) + " s × 10 = <b>" + t.tb + "</b></td></tr>" +
      "<tr><td>Gate speed</td><td>KE = ½mv² = ½ × " + t.m + " × " + fx(t.v) + "² = " + Math.round(t.KE) + " J → <b>" + t.keB + "</b></td></tr>" +
      "<tr><td>Coins this level</td><td><b>" + t.coins + "</b> (100 = extra life)</td></tr>" +
      "<tr><td>Formula fragments</td><td><b>" + got + " / " + L.shardN + "</b></td></tr>" +
      "<tr><td>Level score</td><td><b>" + t.pts.toLocaleString() + "</b> · total " + G.score.toLocaleString() + "</td></tr></table>" +
      (t.secret ? "<p>The secret gate opened a shortcut on the map straight to " + A.esc(LV.filter(function (o) { return o.world === lv.world && o.boss; })[0].name) + ".</p>" : "") +
      (t.un && t.un.length ? "<p>" + t.un.join("<br>") + "</p>" : "") +
      (lv.boss === "entropy" ? "<p>Count Entropy escaped on the wind. Follow him to the Windward Cliffs!</p>" : "") +
      (last ? "<p>The Citadel falls silent. In real physics, the second law of thermodynamics says the total entropy of an isolated system never decreases; here, a few well-placed stomps had to do. Thanks for restoring order to the Kinetic Kingdom! Completion: " + completion() + "%.</p>" :
        "<p class='gm-small'><b>" + A.esc(w.concept.title) + ".</b> " + w.concept.body + "</p>") +
      "<div class='gm-actions'>" + (nextOk ? "<button class='gm-btn gm-btn--go' data-act='next'>Next level</button>" : "") + "<button class='gm-btn" + (nextOk ? "" : " gm-btn--go") + "' data-act='map'>World map</button><button class='gm-btn' data-act='again'>Play again</button></div>";
    var frac = L.time / Math.max(1, lv.time), stars = frac > .5 ? 3 : frac > .25 ? 2 : 1, rec = !!t.record;
    api.ceremony(last ? "gameComplete" : lv.boss ? "win" : rec ? "newRecord" : "stageClear", { title: last ? "KINGDOM SAVED!" : lv.boss ? "BOSS DOWN!" : t.secret ? "SECRET EXIT!" : rec ? "NEW RECORD!" : "LEVEL CLEAR!", sub: lv.id + " " + lv.name,
      hero: who(), trophy: last ? "crown" : lv.boss ? "medal" : "star", score: t.pts, scoreLabel: "Level score", stars: stars,
      stats: [["Time left", Math.ceil(L.time) + " s"], ["Gate speed", fx(t.v) + " m/s"], ["Coins", t.coins], ["Fragments", got + " / " + L.shardN]],
      line: last ? "Count Entropy is beaten. Order is restored." : stars === 3 ? "Fast and clean. Three stars." : t.keB > 0 ? "Best moment: hitting the gate at " + fx(t.v) + " m/s for +" + t.keB + "." : "Cleared. Hit the gate at speed for a bigger bonus.",
      then: function () { api.show(html, function (a) { api.hide(); if (a === "next") startLevel(api, nx); else if (a === "again") startLevel(api, idx); else toMap(api); }); } });
  }
  function afterDeath(api) {
    if (S.attack) { loadLevel(api, L.idx, false); L.intro = 0; return; }
    var lid = L.lv.id; save.fails[lid] = (save.fails[lid] || 0) + 1; persist();
    if (canSkip(L.idx) && !L.toldSkip) { A.toast("Stuck on <b>" + A.esc(lid) + "</b>? You can skip it from the map, or turn on assists in Settings."); }
    G.lives--;
    if (G.lives <= 0) {
      var far = L.hero && L.W ? Math.round(100 * Math.min(1, L.hero.x / L.W)) : 0, sc = G.score;
      S.mode = "over";
      api.ceremony("lose", { title: "GAME OVER", sub: L.lv.id + " " + L.lv.name, hero: who(), score: sc, scoreLabel: "Run score", stats: [["Got to", far + "% of the course"], ["Coins", L.coinsHere || 0]],
        line: far >= 60 ? "So close: you were " + far + "% of the way through." : "You got " + far + "% of the way. Every run teaches the layout.", tip: "Hold run before a long gap: range grows with the square of your speed. Checkpoints save your place.",
        then: function () { var sk = canSkip(L.idx); api.show("<h2>Game over</h2><p>Count Entropy's minions win this round. Your cleared levels and fragments are saved; lives and score start fresh.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='retry'>Try this level again</button>" + (sk ? "<button class='gm-btn' data-act='skip'>Skip this level</button>" : "") + "<button class='gm-btn' data-act='map'>World map</button></div>",
          function (a) { api.hide(); newSession(); if (a === "retry") startLevel(api, L.idx); else if (a === "skip") { skipLevel(api, L.idx); toMap(api); } else toMap(api); }); } });
      return;
    }
    loadLevel(api, L.idx, true); L.intro = 1.6;
  }

  /* ================= Drawing ================= */
  function hash(n) { n = (n << 13) ^ n; return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff; }
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function layer(api, f, period, fn) { // repeat fn(i, screenX) across the screen with parallax factor f
    var cx = L.cam.x * TS * f, i0 = Math.floor(cx / period) - 1, i1 = Math.ceil((cx + 960) / period) + 1, base = (L.cam.y * TS - (L.H * TS - 540)) * f * .5;
    for (var i = i0; i <= i1; i++) fn(i, i * period - cx, -base);
  }
  function drawSky(x, api) {
    var th = L.th, t = L.t, theme = L.lv.theme, g = th.skyG;
    if (!g) { g = th.skyG = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); }
    x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    if (theme === "grass") {
      x.fillStyle = "rgba(255,250,220,.9)"; x.beginPath(); x.arc(800, 90, 38, 0, 7); x.fill(); x.fillStyle = "rgba(255,250,220,.18)"; x.beginPath(); x.arc(800, 90, 70, 0, 7); x.fill();
      layer(api, .05, 330, function (i, X, Y) { x.fillStyle = "rgba(255,255,255,.85)"; var yy = 70 + hash(i) * 90 + Y * .2; [0, 26, 52].forEach(function (o, k) { x.beginPath(); x.ellipse(X + 40 + o, yy - (k === 1 ? 12 : 0), 34, 20, 0, 0, 7); x.fill(); }); });
      layer(api, .15, 420, function (i, X, Y) { x.fillStyle = "#8fc9b0"; x.beginPath(); x.ellipse(X + 210, 470 + Y, 260, 150 + hash(i) * 60, 0, Math.PI, 0); x.fill(); });
      layer(api, .35, 250, function (i, X, Y) { var hgt = 120 + hash(i * 3) * 110, w = 90 + hash(i * 7) * 70, by = 520 + Y; x.fillStyle = "#6b8fa3"; x.fillRect(X, by - hgt, w, hgt);
        x.fillStyle = "#c7e3f0"; for (var wy = by - hgt + 14; wy < by - 20; wy += 22) for (var wx = X + 10; wx < X + w - 14; wx += 20) x.fillRect(wx, wy, 9, 12);
        if (hash(i * 11) > .7) { x.fillStyle = "#5c7d90"; x.fillRect(X + w / 2 - 16, by - hgt - 70, 32, 70); x.fillStyle = "#f4f1e6"; x.beginPath(); x.arc(X + w / 2, by - hgt - 44, 11, 0, 7); x.fill(); x.strokeStyle = "#333"; x.lineWidth = 2; x.beginPath(); x.moveTo(X + w / 2, by - hgt - 44); x.lineTo(X + w / 2 + 6 * Math.cos(t), by - hgt - 44 + 6 * Math.sin(t)); x.stroke(); } });
      layer(api, .6, 170, function (i, X, Y) { if (hash(i * 5) < .35) return; var by = 560 + Y; x.fillStyle = "#6b4a2e"; x.fillRect(X + 40, by - 70, 10, 70); x.fillStyle = "#3f8f4f"; x.beginPath(); x.arc(X + 45, by - 84, 34, 0, 7); x.arc(X + 22, by - 66, 24, 0, 7); x.arc(X + 70, by - 64, 22, 0, 7); x.fill(); });
    } else if (theme === "lab") {
      layer(api, .2, 120, function (i, X, Y) { x.fillStyle = "#1a2538"; x.fillRect(X + 10, 60 + Y * .3, 80, 420); for (var k = 0; k < 12; k++) { x.fillStyle = (Math.floor(t * 2 + i * 3 + k) % 5) ? "#2b3a55" : (k % 3 ? "#3dd68c" : "#ff6b6b"); x.fillRect(X + 18 + (k % 3) * 22, 80 + Y * .3 + Math.floor(k / 3) * 90, 6, 4); } });
      layer(api, .45, 300, function (i, X, Y) { x.strokeStyle = "rgba(120,140,170,.35)"; x.lineWidth = 3; x.beginPath(); for (var k = 0; k < 3; k++) { x.moveTo(X, 110 + k * 8 + Y); x.quadraticCurveTo(X + 150, 170 + k * 14 + Y, X + 300, 110 + k * 8 + Y); } x.stroke(); });
    } else if (theme === "ice") {
      layer(api, .12, 300, function (i, X, Y) { x.fillStyle = "#cfe9f7"; var hh = 200 + hash(i) * 140; x.beginPath(); x.moveTo(X - 40, 520 + Y); x.lineTo(X + 150, 520 - hh + Y); x.lineTo(X + 340, 520 + Y); x.fill(); x.fillStyle = "#ffffff"; x.beginPath(); x.moveTo(X + 110, 520 - hh * .8 + Y); x.lineTo(X + 150, 520 - hh + Y); x.lineTo(X + 190, 520 - hh * .8 + Y); x.lineTo(X + 150, 520 - hh * .72 + Y); x.fill(); });
      layer(api, .3, 360, function (i, X, Y) { if (hash(i * 3) < .4) return; var by = 520 + Y; x.fillStyle = "#b9d7ea"; x.beginPath(); x.arc(X + 120, by, 80, Math.PI, 0); x.fill(); x.fillStyle = "rgba(255,255,255,.6)"; x.beginPath(); x.arc(X + 100, by - 40, 20, Math.PI, 0); x.fill(); x.strokeStyle = "#7da3bd"; x.lineWidth = 3; x.beginPath(); x.moveTo(X + 120, by - 80); x.lineTo(X + 120, by - 120); x.stroke(); x.fillStyle = Math.floor(t * 2) % 2 ? "#ff6b6b" : "#ffd1d1"; x.beginPath(); x.arc(X + 120, by - 122, 4, 0, 7); x.fill(); });
      layer(api, .6, 140, function (i, X, Y) { if (hash(i * 9) < .5) return; var by = 560 + Y; x.fillStyle = "#5f8ea8"; x.beginPath(); x.moveTo(X + 50, by - 110); x.lineTo(X + 80, by); x.lineTo(X + 20, by); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.moveTo(X + 50, by - 110); x.lineTo(X + 62, by - 70); x.lineTo(X + 38, by - 70); x.fill(); });
    } else if (theme === "volcano") {
      layer(api, .08, 700, function (i, X, Y) { x.fillStyle = "#2a0f0c"; x.beginPath(); x.moveTo(X, 520 + Y); x.lineTo(X + 280, 220 + Y); x.lineTo(X + 360, 220 + Y); x.lineTo(X + 640, 520 + Y); x.fill();
        var gg = x.createRadialGradient(X + 320, 220 + Y, 4, X + 320, 220 + Y, 110); gg.addColorStop(0, "rgba(255,140,40,.65)"); gg.addColorStop(1, "rgba(255,80,20,0)"); x.fillStyle = gg; x.fillRect(X + 200, 110 + Y, 240, 220);
        x.fillStyle = "rgba(60,40,40,.5)"; for (var k = 0; k < 4; k++) { x.beginPath(); x.arc(X + 320 + Math.sin(t * .4 + k) * 30, 180 - k * 40 + Y - ((t * 12) % 40), 30 + k * 10, 0, 7); x.fill(); } });
      layer(api, .3, 260, function (i, X, Y) { if (hash(i) < .3) return; var by = 520 + Y; x.fillStyle = "#3a1d18"; x.beginPath(); x.moveTo(X + 40, by); x.quadraticCurveTo(X + 75, by - 90, X + 55, by - 170); x.lineTo(X + 145, by - 170); x.quadraticCurveTo(X + 125, by - 90, X + 160, by); x.fill(); x.fillStyle = "rgba(255,120,60,.25)"; x.fillRect(X + 55, by - 172, 90, 6); });
      layer(api, .55, 200, function (i, X, Y) { var by = 540 + Y; x.strokeStyle = "rgba(40,20,18,.85)"; x.lineWidth = 5; x.beginPath(); x.moveTo(X, by - 150); x.lineTo(X + 200, by - 150); x.moveTo(X, by - 150); x.lineTo(X + 100, by - 60); x.lineTo(X + 200, by - 150); x.stroke(); });
    } else if (theme === "cliffs" || theme === "moon" || theme === "citadel") { skyNew(x, api, theme);
    } else if (theme === "storm") {
      if (!api.reduce && (Math.floor(t * 10) % 97 === 0 || Math.floor(t * 10) % 131 === 0)) { x.fillStyle = "rgba(220,220,255,.35)"; x.fillRect(0, 0, 960, 540); x.strokeStyle = "rgba(240,240,255,.9)"; x.lineWidth = 3; var lx = 200 + hash(Math.floor(t)) * 600; x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx - 30, 90); x.lineTo(lx + 10, 120); x.lineTo(lx - 20, 240); x.stroke(); }
      layer(api, .08, 360, function (i, X, Y) { x.fillStyle = "rgba(40,44,90,.9)"; x.beginPath(); x.ellipse(X + 180, 120 + hash(i) * 60, 200, 60, 0, 0, 7); x.fill(); });
      layer(api, .3, 280, function (i, X, Y) { var by = 520 + Y; x.strokeStyle = "#2b2f55"; x.lineWidth = 4; x.beginPath(); x.moveTo(X + 120, by); x.lineTo(X + 140, by - 230); x.lineTo(X + 160, by); x.moveTo(X + 100, by - 200); x.lineTo(X + 180, by - 200); x.moveTo(X + 108, by - 160); x.lineTo(X + 172, by - 160); x.stroke();
        x.lineWidth = 1.5; x.beginPath(); x.moveTo(X + 100, by - 200); x.quadraticCurveTo(X + 240, by - 150, X + 380, by - 200); x.stroke(); x.fillStyle = Math.floor(t * 3 + i) % 3 ? "#ff5370" : "#521426"; x.beginPath(); x.arc(X + 140, by - 232, 4, 0, 7); x.fill(); });
      layer(api, .65, 230, function (i, X, Y) { if (hash(i * 7) < .4) return; x.fillStyle = "rgba(90,96,150,.55)"; x.beginPath(); x.ellipse(X + 100, 470 + Y, 90, 26, 0, 0, 7); x.ellipse(X + 150, 456 + Y, 60, 24, 0, 0, 7); x.fill(); });
    }
  }
  function skyNew(x, api, theme) { // Windward Cliffs, Lunar Annex, Entropy Citadel
    var t = L.t;
    if (theme === "cliffs") {
      x.fillStyle = "rgba(255,250,220,.9)"; x.beginPath(); x.arc(780, 100, 34, 0, 7); x.fill();
      layer(api, .06, 300, function (i, X, Y) { x.fillStyle = "rgba(255,255,255,.8)"; var yy = 60 + hash(i) * 100 + Y * .2, dx = (t * 30) % 300; x.beginPath(); x.ellipse(X + 40 + dx, yy, 50, 16, 0, 0, 7); x.ellipse(X + 80 + dx, yy - 8, 36, 14, 0, 0, 7); x.fill(); });
      layer(api, .22, 340, function (i, X, Y) { var hh = 180 + hash(i * 5) * 160, by = 540 + Y; x.fillStyle = "#7d9bb5"; x.beginPath(); x.moveTo(X, by); x.lineTo(X + 40, by - hh); x.lineTo(X + 120, by - hh - 20); x.lineTo(X + 200, by - hh + 30); x.lineTo(X + 340, by); x.fill(); });
      layer(api, .5, 260, function (i, X, Y) { if (hash(i * 3) < .35) return; var by = 560 + Y; x.strokeStyle = "#e2e8f0"; x.lineWidth = 4; x.beginPath(); x.moveTo(X + 120, by); x.lineTo(X + 120, by - 160); x.stroke(); x.save(); x.translate(X + 120, by - 160); x.rotate(t * 2 + i); for (var k = 0; k < 3; k++) { x.rotate(2.094); x.fillStyle = "#f8fafc"; x.fillRect(0, -3, 46, 6); } x.restore(); });
    } else if (theme === "moon") {
      for (var k2 = 0; k2 < 70; k2++) { var sxp = ((hash(k2 * 3) * 1400 - L.cam.x * TS * .03) % 960 + 960) % 960, syp = hash(k2 * 7) * 420; x.fillStyle = "rgba(255,255,255," + (.4 + .6 * hash(k2 * 11) * (api.reduce ? 1 : .6 + .4 * Math.sin(t * 2 + k2))) + ")"; x.fillRect(sxp, syp, 2, 2); }
      x.fillStyle = "#2b6cb0"; x.beginPath(); x.arc(170, 120, 46, 0, 7); x.fill(); x.fillStyle = "#38a169"; x.beginPath(); x.ellipse(160, 110, 18, 12, .4, 0, 7); x.ellipse(186, 136, 12, 8, -.3, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.25)"; x.beginPath(); x.arc(176, 108, 46, -.8, 1.2); x.fill();
      layer(api, .18, 420, function (i, X, Y) { var by = 540 + Y; x.fillStyle = "#3b4256"; x.beginPath(); x.ellipse(X + 210, by, 260, 120 + hash(i) * 50, 0, Math.PI, 0); x.fill(); x.fillStyle = "#2c3244"; x.beginPath(); x.ellipse(X + 140, by - 70, 40, 10, 0, 0, 7); x.fill(); });
      layer(api, .45, 300, function (i, X, Y) { if (hash(i * 9) < .4) return; var by = 550 + Y; x.fillStyle = "#cbd5e1"; x.beginPath(); x.arc(X + 150, by - 90, 60, Math.PI, 0); x.fill(); x.strokeStyle = "#94a3b8"; x.lineWidth = 3; x.beginPath(); x.moveTo(X + 150, by - 150); x.lineTo(X + 150, by - 190); x.stroke(); x.fillStyle = Math.floor(t * 2 + i) % 2 ? "#f87171" : "#7f1d1d"; x.beginPath(); x.arc(X + 150, by - 192, 4, 0, 7); x.fill(); });
    } else if (theme === "citadel") {
      if (!api.reduce && Math.floor(t * 10) % 113 === 0) { x.fillStyle = "rgba(230,200,255,.18)"; x.fillRect(0, 0, 960, 540); }
      layer(api, .08, 380, function (i, X, Y) { x.fillStyle = "rgba(60,20,80,.9)"; x.beginPath(); x.ellipse(X + 190, 110 + hash(i) * 70, 210, 50, 0, 0, 7); x.fill(); });
      layer(api, .28, 260, function (i, X, Y) { var by = 540 + Y, hh = 220 + hash(i * 3) * 160; x.fillStyle = "#24102f"; x.fillRect(X + 60, by - hh, 70, hh); x.beginPath(); x.moveTo(X + 50, by - hh); x.lineTo(X + 95, by - hh - 60); x.lineTo(X + 140, by - hh); x.fill();
        for (var w2 = 0; w2 < 5; w2++) { x.fillStyle = (Math.floor(t * 1.5 + i + w2) % 4) ? "rgba(240,171,252,.7)" : "rgba(240,171,252,.15)"; x.fillRect(X + 85, by - hh + 30 + w2 * 34, 18, 12); } });
      layer(api, .55, 200, function (i, X, Y) { var by = 550 + Y; x.strokeStyle = "rgba(90,40,110,.8)"; x.lineWidth = 6; x.beginPath(); x.moveTo(X, by - 120); x.lineTo(X + 200, by - 120); x.stroke(); x.fillStyle = "rgba(60,25,80,.9)"; x.fillRect(X + 90, by - 120, 14, 120); });
    }
  }
  // moving air: updrafts (rising streaks, a fan where the column meets the floor) and gusts (sideways streaks)
  function drawAir(x, ch, c, r, X, Y) {
    var t = L.t, k;
    x.lineWidth = 2; x.beginPath();
    if (ch === "|") { x.strokeStyle = "rgba(210,240,255,.32)"; for (k = 0; k < 2; k++) { var px = X + 10 + k * 20 + Math.sin(t * 3 + c + k) * 3, o = (t * 110 + hash(c * 31 + k) * 40 + r * 13) % 40; x.moveTo(px, Y + 40 - o); x.lineTo(px, Y + 28 - o); } }
    else { var d = ch === "}" ? 1 : -1; x.strokeStyle = "rgba(230,240,255,.26)"; for (k = 0; k < 2; k++) { var oo = ((t * 140 * d + hash(r * 17 + k) * 40 + c * 40) % 40 + 40) % 40, py = Y + 10 + k * 20; x.moveTo(X + oo - 7, py); x.lineTo(X + oo + 7, py); } }
    x.stroke();
    if (ch === "|" && KL.kind(rawTile(c, r + 1)) === 1) { x.fillStyle = "#334155"; rr(x, X + 1, Y + 30, 38, 10, 3); x.fill(); x.strokeStyle = "#cbd5e1"; x.lineWidth = 3; x.beginPath(); var a0 = t * 18; x.moveTo(X + 20 + Math.cos(a0) * 15, Y + 35); x.lineTo(X + 20 - Math.cos(a0) * 15, Y + 35); x.stroke(); }
  }
  function isGround(ch) { return ch === "#" || ch === "I" || ch === ">" || ch === "<"; }
  var SPR = {}, SPR_THEME = "";
  function sprite(x, key, X, Y, size, paint) { // static tiles are painted once per theme at 2× resolution, then blitted
    if (SPR_THEME !== L.lv.theme) { SPR = {}; SPR_THEME = L.lv.theme; }
    var cv = SPR[key];
    if (!cv) { cv = document.createElement("canvas"); cv.width = TS * 2; cv.height = size * 2; var q = cv.getContext("2d"); q.scale(2, 2); paint(q); SPR[key] = cv; }
    x.drawImage(cv, X, Y, TS + .6, size + .6);
  }
  function drawTile(x, ch, c, r, X, Y, api) {
    var th = L.th, t = L.t, T = TS;
    if (ch === "|" || ch === "{" || ch === "}") { drawAir(x, ch, c, r, X, Y); return; }
    if (ch === "#") {
      var above = rawTile(c, r - 1), top = !isGround(above) && above !== "=" && above !== "X";
      var v = Math.floor(hash(c * 7 + r * 13) * 4);
      sprite(x, "#" + (top ? 1 : 0) + v, X, Y - (top ? 6 : 0), T + 6, function (q) {
        q.translate(0, top ? 6 : 0); q.fillStyle = th.soil; q.fillRect(0, 0, T, T); q.fillStyle = th.soilD;
        [[8, 14], [22, 26], [30, 10], [12, 30]].forEach(function (pp, i) { if ((v + i) % 2 === 0) q.fillRect(pp[0], pp[1], 6, 4); });
        if (top) { q.fillStyle = th.top; q.fillRect(0, 0, T, 11); q.fillStyle = th.topD; q.fillRect(0, 11, T, 3);
          if (L.lv.theme === "grass") { q.fillStyle = th.top; for (var k = 0; k < 4; k++) { q.beginPath(); q.moveTo(k * 10 + 1, 1); q.lineTo(k * 10 + 4, -4 - ((v + k) % 3)); q.lineTo(k * 10 + 7, 1); q.fill(); } }
          if (L.lv.theme === "ice") { q.fillStyle = "#fff"; q.fillRect(0, 0, T, 4); }
          if (L.lv.theme === "volcano") { q.fillStyle = "rgba(255,120,40,.55)"; q.fillRect(0, 0, T, 2); q.fillRect(6 + v * 6, 4, 10, 2); } }
      });
    } else if (ch === "I") { sprite(x, "I", X, Y, T, function (x) { var X = 0, Y = 0;
      var gi = x.createLinearGradient(X, Y, X, Y + T); gi.addColorStop(0, "#effbff"); gi.addColorStop(1, "#8fd3ef"); x.fillStyle = gi; x.fillRect(X, Y, T, T);
      x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 2; x.beginPath(); x.moveTo(X + 6, Y + 30); x.lineTo(X + 18, Y + 8); x.moveTo(X + 22, Y + 34); x.lineTo(X + 30, Y + 20); x.stroke(); x.strokeStyle = "rgba(60,140,180,.35)"; x.strokeRect(X + .5, Y + .5, T - 1, T - 1); });
    } else if (ch === ">" || ch === "<") {
      x.fillStyle = "#3b4350"; x.fillRect(X, Y, T, T); x.fillStyle = "#596273"; x.fillRect(X, Y, T, 10);
      var off = ((t * P.BELT * TS * (ch === ">" ? 1 : -1)) % 20 + 20) % 20; x.fillStyle = "#ffd84a";
      for (var s2 = -20; s2 < T; s2 += 20) { var ax = X + s2 + off; if (ax < X - 6 || ax > X + T - 8) continue; x.beginPath(); if (ch === ">") { x.moveTo(ax, Y + 2); x.lineTo(ax + 6, Y + 5); x.lineTo(ax, Y + 8); } else { x.moveTo(ax + 6, Y + 2); x.lineTo(ax, Y + 5); x.lineTo(ax + 6, Y + 8); } x.fill(); }
      x.fillStyle = "#222830"; x.beginPath(); x.arc(X + 10, Y + 24, 6, 0, 7); x.arc(X + 30, Y + 24, 6, 0, 7); x.fill();
    } else if (ch === "=" || ch === "$") {
      sprite(x, "=", X, Y, T, function (x) { var X = 0, Y = 0; x.fillStyle = th.brick; x.fillRect(X, Y, T, T); x.fillStyle = th.brickL; x.fillRect(X, Y, T, 3);
      x.fillStyle = "rgba(0,0,0,.28)"; x.fillRect(X, Y + 19, T, 2); x.fillRect(X + 19, Y, 2, 19); x.fillRect(X + 9, Y + 21, 2, 19); x.fillRect(X + 29, Y + 21, 2, 19); x.fillRect(X, Y + T - 2, T, 2); });
      if (ch === "$" && Math.floor(t * 2 + c) % 4 === 0) { x.fillStyle = "rgba(255,230,120,.8)"; x.fillRect(X + 26, Y + 6, 3, 3); }
    } else if (ch === "X" || ch === "a" || ch === "A") {
      sprite(x, "X", X, Y, T, function (x) { var X = 0, Y = 0; x.fillStyle = th.steel; x.fillRect(X, Y, T, T); x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(X, Y, T, 4); x.fillRect(X, Y, 4, T); x.fillStyle = "rgba(0,0,0,.3)"; x.fillRect(X, Y + T - 4, T, 4); x.fillRect(X + T - 4, Y, 4, T);
      x.fillStyle = "rgba(0,0,0,.35)"; [[9, 9], [31, 9], [9, 31], [31, 31]].forEach(function (p) { x.beginPath(); x.arc(X + p[0], Y + p[1], 2.4, 0, 7); x.fill(); }); });
      if (ch !== "X") { x.fillStyle = "#ffd84a"; x.beginPath(); x.arc(X + 20, Y + 20, 7, 0, 7); x.fill(); }
    } else if (ch === "q") { sprite(x, "q", X, Y, T, function (x) { x.fillStyle = "#4b5563"; rr(x, 1, 1, T - 2, T - 2, 6); x.fill(); x.fillStyle = "#374151"; x.fillRect(8, 8, T - 16, T - 16); }); }
    else if ("?EFKZUY".indexOf(ch) >= 0) {
      var pulse = .5 + .5 * Math.sin(t * 4 + c);
      sprite(x, "crate", X, Y, T, function (q) { var gq = q.createLinearGradient(0, 0, 0, T); gq.addColorStop(0, "#38d6e8"); gq.addColorStop(1, "#11717f"); q.fillStyle = gq; rr(q, 1, 1, T - 2, T - 2, 8); q.fill(); q.strokeStyle = "#0b4752"; q.lineWidth = 2; q.stroke(); });
      x.strokeStyle = "rgba(255,255,255," + (.55 + pulse * .45) + ")"; x.lineWidth = 2; x.beginPath(); x.ellipse(X + 20, Y + 20, 12, 5, .6, 0, 7); x.stroke(); x.beginPath(); x.ellipse(X + 20, Y + 20, 12, 5, -.6, 0, 7); x.stroke();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(X + 20, Y + 20, 3, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(X + 5, Y + 4, T - 10, 4);
    } else if (ch === "-") { sprite(x, "-", X, Y, T, function (x) { var X = 0, Y = 0;
      x.fillStyle = th.ledge; x.fillRect(X, Y, T, 9); x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(X, Y + 7, T, 2); x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(X + 5, Y + 9, 3, 7); x.fillRect(X + T - 8, Y + 9, 3, 7); });
    } else if (ch === "^") { sprite(x, "^", X, Y, T, function (x) { var X = 0, Y = 0;
      x.fillStyle = "#c9d1dc"; x.strokeStyle = "#6b7280"; x.lineWidth = 1.5;
      for (var k2 = 0; k2 < 4; k2++) { x.beginPath(); x.moveTo(X + k2 * 10, Y + T); x.lineTo(X + k2 * 10 + 5, Y + 10); x.lineTo(X + k2 * 10 + 10, Y + T); x.closePath(); x.fill(); x.stroke(); } });
    } else if (ch === "~") {
      var surf = rawTile(c, r - 1) !== "~", wv = surf ? Math.sin(t * 3 + c * 1.3) * 3 : 0, gl = x.createLinearGradient(X, Y, X, Y + T); gl.addColorStop(0, "#ffd166"); gl.addColorStop(.4, "#ff7b25"); gl.addColorStop(1, "#b3261e");
      x.fillStyle = gl; x.fillRect(X, Y + (surf ? 8 + wv : 0), T, T - (surf ? 8 + wv : 0));
      if (surf) { x.fillStyle = "#fff3b0"; x.fillRect(X, Y + 8 + wv, T, 3); if (hash(c + Math.floor(t * 2)) > .85) { x.fillStyle = "#ffd166"; x.beginPath(); x.arc(X + 20, Y + 4 + wv, 4, 0, 7); x.fill(); } }
    } else if (ch === "S") {
      var sq = L.springT && L.springT.c === c && L.springT.r === r ? Math.max(0, 1 - (L.t - L.springT.t) * 6) * 8 : 0;
      x.fillStyle = "#374151"; x.fillRect(X + 2, Y + T - 7, T - 4, 7); x.strokeStyle = "#e5e7eb"; x.lineWidth = 3; x.beginPath();
      for (var k3 = 0; k3 < 5; k3++) { var yy = Y + T - 8 - k3 * (5 - sq / 6); x.moveTo(X + 8, yy); x.lineTo(X + 32, yy - 2); } x.stroke();
      x.fillStyle = "#ef4444"; rr(x, X + 1, Y + 6 + sq, T - 2, 8, 3); x.fill(); x.fillStyle = "#fff"; x.font = "700 9px system-ui"; x.textAlign = "center"; x.fillText("kx", X + 20, Y + 13 + sq);
    } else if (ch === "o") {
      var sp = Math.abs(Math.cos(t * 3 + c * .7)); x.fillStyle = "#f4b81c"; x.beginPath(); x.ellipse(X + 20, Y + 20, 11 * sp + 1, 13, 0, 0, 7); x.fill(); x.fillStyle = "#ffe066"; x.beginPath(); x.ellipse(X + 20, Y + 20, 8 * sp, 10, 0, 0, 7); x.fill();
      if (sp > .5) { x.fillStyle = "#b07d00"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText("J", X + 20, Y + 25); }
      if (!api.reduce && hash(c * 13 + r + Math.floor(t * 3)) > .93) { x.fillStyle = "#fff"; x.fillRect(X + 26, Y + 6, 2, 8); x.fillRect(X + 23, Y + 9, 8, 2); }
    } else if (ch === "*") {
      var had = (save.shards[L.lv.id] || [])[L.shardIdx[c + "," + r]], bob = Math.sin(t * 3 + c) * 3;
      x.save(); x.translate(X + 20, Y + 20 + bob); x.rotate(t * .8);
      if (!had) { var gs = x.createRadialGradient(0, 0, 2, 0, 0, 22); gs.addColorStop(0, "rgba(196,181,253,.7)"); gs.addColorStop(1, "rgba(196,181,253,0)"); x.fillStyle = gs; x.fillRect(-22, -22, 44, 44); }
      x.fillStyle = had ? "rgba(196,181,253,.3)" : "#a78bfa"; x.strokeStyle = "#f5f3ff"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -14); x.lineTo(10, 0); x.lineTo(0, 14); x.lineTo(-10, 0); x.closePath(); x.fill(); x.stroke();
      x.restore(); x.fillStyle = had ? "rgba(255,255,255,.4)" : "#fff"; x.font = "800 10px system-ui"; x.textAlign = "center"; x.fillText("F=ma", X + 20, Y + 44 + bob);
    } else if (ch === "c") {
      var h = L.hero, ang = Math.atan2((h.y + h.h / 2) - (r + .5), (h.x - c)) ;
      x.fillStyle = "#3b2a4a"; rr(x, X + 2, Y + 18, T - 4, 22, 5); x.fill();
      x.save(); x.translate(X + 20, Y + 18); x.rotate(clamp(ang, -2.6, -.5)); x.fillStyle = "#5b3b7a"; x.fillRect(0, -8, 24, 16); x.fillStyle = "#c084fc"; x.fillRect(16, -8, 4, 16); x.fillStyle = "#1a1124"; x.fillRect(22, -6, 4, 12); x.restore();
      x.fillStyle = "#ff3355"; x.beginPath(); x.arc(X + 20, Y + 28, 3, 0, 7); x.fill();
    } else if ((ch === "H" || ch === "J") && L.hero.mount === "scooter") { x.strokeStyle = "rgba(125,255,154,.6)"; x.setLineDash([4, 4]); x.strokeRect(X + 3, Y + 3, T - 6, T - 6); x.setLineDash([]); }
  }
  function drawTiles(x, api) {
    var c0 = Math.floor(L.cam.x) - 1, c1 = Math.ceil(L.cam.x + VWT) + 1, r0 = Math.max(0, Math.floor(L.cam.y) - 1), r1 = Math.min(L.H - 1, Math.ceil(L.cam.y + VHT) + 1);
    var bumpAt = {}; L.bumps.forEach(function (b) { bumpAt[b.c + "," + b.r] = Math.sin(b.t / .2 * Math.PI) * 8; });
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var ch = rawTile(c, r); if (ch === "." || c < 0 || c >= L.W) continue;
      var X = Math.round((c - L.cam.x) * TS), Y = Math.round((r - L.cam.y) * TS) - (bumpAt[c + "," + r] || 0);
      drawTile(x, ch, c, r, X, Y, api);
    }
  }
  function drawPlats(x) {
    L.plats.forEach(function (p) {
      if (p.off) return; var X = sx(p.x), Y = sy(p.y), w = p.w * TS;
      if (p.kind === "pend") { var px = sx(p.c + .5), py = sy(p.r + .5); x.strokeStyle = "#cbd5e1"; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.lineTo(X + w / 2, Y); x.stroke(); x.fillStyle = "#64748b"; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); x.fillStyle = "#e2e8f0"; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); }
      var shake = p.kind === "fall" && p.st === 1 ? (Math.random() - .5) * 3 : 0;
      x.fillStyle = p.kind === "fall" ? "#b45309" : p.kind === "pend" ? "#7c3aed" : "#0e7490"; rr(x, X + shake, Y, w, 12, 4); x.fill();
      x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(X + 4 + shake, Y + 2, w - 8, 3);
      if (p.kind === "h" || p.kind === "v") { x.fillStyle = "#67e8f9"; x.beginPath(); x.arc(X + w / 2, Y + 7, 3, 0, 7); x.fill(); }
      if (p.kind === "fall") { x.fillStyle = "rgba(0,0,0,.3)"; for (var k = 8; k < w - 6; k += 12) x.fillRect(X + k + shake, Y + 4, 2, 7); }
    });
  }
  function drawMarkers(x, api) {
    var t = L.t;
    L.cps.forEach(function (cp) { var X = sx(cp.c), Y = sy(cp.r + 1); x.fillStyle = "#94a3b8"; x.fillRect(X + 18, Y - 80, 5, 80); x.fillStyle = "#475569"; x.fillRect(X + 10, Y - 6, 20, 6);
      x.fillStyle = cp.on ? "#7ef0ff" : "#64748b"; x.beginPath(); x.ellipse(X + 20, Y - 84, 14, 7, 0, 0, 7); x.fill();
      if (cp.on) { x.strokeStyle = "rgba(126,240,255," + (.5 + .5 * Math.sin(t * 6)) + ")"; x.lineWidth = 2; for (var k = 1; k <= 3; k++) { x.beginPath(); x.arc(X + 20, Y - 84, 8 + k * 7 + (t * 20) % 7, -2.4, -.7); x.stroke(); } } });
    for (var d in L.doors) L.doors[d].forEach(function (o) { var X = sx(o.c), Y = sy(o.r + 1); x.fillStyle = "#334155"; rr(x, X + 2, Y - 76, 36, 76, 5); x.fill(); x.fillStyle = "#64748b"; rr(x, X + 6, Y - 72, 28, 72, 4); x.fill();
      x.fillStyle = "#7dd3fc"; x.fillRect(X + 12, Y - 64, 16, 14); x.fillStyle = "#facc15"; x.beginPath(); x.arc(X + 29, Y - 36, 3, 0, 7); x.fill();
      var h = L.hero; if (Math.abs(h.x + h.w / 2 - (o.c + .5)) < 1 && Math.abs(h.y + h.h - (o.r + 1)) < .4) { x.fillStyle = "#fff"; x.font = "800 14px system-ui"; x.textAlign = "center"; x.fillText("▲ / ▼", X + 20, Y - 84); } });
    L.gates.forEach(function (g) {
      if (g.hidden) return; var X = sx(g.c), Y = sy(g.r + 1), col = g.secret ? "#a78bfa" : "#facc15";
      g.appear = Math.min(1, (g.appear == null ? 1 : g.appear) + .02); x.globalAlpha = g.appear;
      x.fillStyle = "#475569"; x.fillRect(X - 10, Y - 120, 12, 120); x.fillRect(X + 38, Y - 120, 12, 120); x.fillStyle = col; x.fillRect(X - 14, Y - 128, 68, 12);
      var gg = x.createLinearGradient(X, 0, X + 40, 0); gg.addColorStop(0, "rgba(255,255,255,0)"); gg.addColorStop(.5, g.secret ? "rgba(196,181,253,.55)" : "rgba(255,230,120,.55)"); gg.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = gg; x.fillRect(X + 2, Y - 116, 36, 116);
      x.strokeStyle = "rgba(255,255,255,.7)"; x.lineWidth = 1.5; for (var k = 0; k < 4; k++) { var yy = Y - ((t * 60 + k * 30) % 116); x.beginPath(); x.moveTo(X + 4, yy); x.lineTo(X + 36, yy); x.stroke(); }
      x.fillStyle = "#111827"; x.font = "900 11px system-ui"; x.textAlign = "center"; x.fillText(g.secret ? "SECRET" : "½mv²", X + 20, Y - 118); x.globalAlpha = 1;
    });
  }
  function drawEnemy(x, e, t) {
    var X = sx(e.x + e.w / 2), Y = sy(e.y + e.h), f = e.dir || -1;
    if (e.type === "c" || e.gone) return;
    x.save(); x.translate(X, Y); if (e.flip) { x.translate(0, -e.h * TS / 2); x.rotate(Math.PI); x.translate(0, e.h * TS / 2); }
    if (e.squash) x.scale(1.3, .35);
    if (e.type === "w") {
      var j = Math.sin(t * 20 + e.x0) * 1.5; x.fillStyle = "#6d28d9"; x.beginPath();
      for (var k = 0; k < 14; k++) { var a = k / 14 * 6.283, rad = 15 + (k % 2 ? 3 : 0) + (k % 3 === 0 ? j : 0); x.lineTo(Math.cos(a) * rad, -17 + Math.sin(a) * rad); } x.closePath(); x.fill();
      x.fillStyle = "#a78bfa"; x.beginPath(); x.arc(-4, -22, 6, 0, 7); x.fill();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(f * 4 - 4, -19, 5, 0, 7); x.arc(f * 4 + 6, -19, 5, 0, 7); x.fill(); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(f * 6 - 4, -19, 2.4, 0, 7); x.arc(f * 6 + 6, -19, 2.4, 0, 7); x.fill();
      x.fillStyle = "#2e1065"; var st = Math.sin(t * 12 + e.x0) * 4; x.fillRect(-8 + st, -4, 6, 4); x.fillRect(3 - st, -4, 6, 4);
    } else if (e.type === "k") {
      if (e.st === "walk") { x.fillStyle = "#1f2937"; var s2 = Math.sin(t * 10 + e.x0) * 3; x.fillRect(-9 + s2, -8, 4, 8); x.fillRect(5 - s2, -8, 4, 8);
        x.fillStyle = "#e5e7eb"; x.fillRect(f > 0 ? 8 : -18, -24, 10, 10); x.fillStyle = "#111"; x.fillRect(f > 0 ? 13 : -15, -21, 3, 4);
        var gd = x.createLinearGradient(0, -38, 0, -8); gd.addColorStop(0, "#93c5fd"); gd.addColorStop(1, "#1d4ed8"); x.fillStyle = gd; x.beginPath(); x.ellipse(0, -10, 16, 24, 0, Math.PI, 0); x.fill(); x.fillStyle = "rgba(255,255,255,.5)"; x.beginPath(); x.ellipse(-6, -24, 4, 7, -.4, 0, 7); x.fill(); }
      else { x.fillStyle = "#1e3a8a"; x.beginPath(); x.ellipse(0, -9, 17, 9, 0, 0, 7); x.fill(); x.fillStyle = "#60a5fa"; x.beginPath(); x.ellipse(0, -12, 17, 6, 0, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(-6, -14, 12, 2);
        if (e.st === "slide") { x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 2; for (var m = 0; m < 3; m++) { x.beginPath(); x.moveTo(-(e.vx > 0 ? 1 : -1) * (22 + m * 6), -6 - m * 4); x.lineTo(-(e.vx > 0 ? 1 : -1) * (34 + m * 6), -6 - m * 4); x.stroke(); } } }
    } else if (e.type === "j") {
      var sqz = e.ground ? 1 + Math.sin(Math.min(1, (e.t2 || 0) / 1.1) * Math.PI) * .25 : .8;
      x.strokeStyle = "#a3a3a3"; x.lineWidth = 3; x.beginPath(); for (var q = 0; q < 4; q++) { x.moveTo(-7, -2 - q * 4 / sqz); x.lineTo(7, -4 - q * 4 / sqz); } x.stroke();
      x.fillStyle = "#22c55e"; x.beginPath(); x.arc(0, -20 / sqz, 12, 0, 7); x.fill(); x.fillStyle = "#fff"; x.beginPath(); x.arc(-4, -22 / sqz, 4, 0, 7); x.arc(5, -22 / sqz, 4, 0, 7); x.fill(); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(-3, -22 / sqz, 2, 0, 7); x.arc(6, -22 / sqz, 2, 0, 7); x.fill();
    } else if (e.type === "b") {
      var fl = Math.sin(t * 18 + e.x0) * 10; x.fillStyle = "#4c1d95"; x.beginPath(); x.moveTo(-6, -14); x.lineTo(-24, -14 - fl); x.lineTo(-14, -4); x.closePath(); x.moveTo(6, -14); x.lineTo(24, -14 - fl); x.lineTo(14, -4); x.closePath(); x.fill();
      x.fillStyle = "#7c3aed"; x.beginPath(); x.arc(0, -12, 10, 0, 7); x.fill(); x.strokeStyle = "#fde047"; x.lineWidth = 2; x.beginPath(); x.moveTo(-4, -26); x.lineTo(0, -21); x.lineTo(-2, -19); x.lineTo(3, -14); x.stroke();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(-3, -13, 3, 0, 7); x.arc(4, -13, 3, 0, 7); x.fill();
    } else if (e.type === "r") {
      var fl2 = Math.sin(t * 9 + e.x0) * .25; x.save(); x.translate(0, -14); x.rotate(e.st === "dive" ? f * .6 : fl2);
      x.fillStyle = "#0ea5e9"; x.beginPath(); x.moveTo(0, -16); x.lineTo(16, 0); x.lineTo(0, 12); x.lineTo(-16, 0); x.closePath(); x.fill(); x.fillStyle = "#e0f2fe"; x.beginPath(); x.moveTo(0, -16); x.lineTo(16, 0); x.lineTo(0, 0); x.fill();
      x.strokeStyle = "#f43f5e"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 12); x.quadraticCurveTo(-f * 10, 22, -f * 4, 32); x.stroke(); x.fillStyle = "#111"; x.fillRect(-6 + f * 2, -4, 3, 3); x.fillRect(3 + f * 2, -4, 3, 3); x.restore();
    } else if (e.type === "x") {
      var sq2 = e.ground ? 1 + Math.sin(Math.min(1, (e.t2 || 0) / 1.3) * Math.PI) * .22 : .85;
      x.fillStyle = "#94a3b8"; x.beginPath(); x.ellipse(0, -15 / sq2, 15, 15 / sq2, 0, 0, 7); x.fill(); x.fillStyle = "#e2e8f0"; x.beginPath(); x.ellipse(-4, -20 / sq2, 6, 4, -.4, 0, 7); x.fill();
      x.strokeStyle = "#64748b"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -30 / sq2); x.lineTo(f * 6, -40 / sq2); x.stroke(); x.fillStyle = "#facc15"; x.beginPath(); x.arc(f * 6, -41 / sq2, 3, 0, 7); x.fill();
      x.fillStyle = "#0f172a"; x.beginPath(); x.arc(-4 + f * 3, -16 / sq2, 3, 0, 7); x.arc(5 + f * 3, -16 / sq2, 3, 0, 7); x.fill();
    } else if (e.type === "s") {
      x.save(); x.translate(0, -16); x.rotate(t * 3 * f); x.fillStyle = "#ea580c"; x.beginPath(); for (var g2 = 0; g2 < 16; g2++) { var a2 = g2 / 16 * 6.283, rd = g2 % 2 ? 12 : 18; x.lineTo(Math.cos(a2) * rd, Math.sin(a2) * rd); } x.closePath(); x.fill(); x.restore();
      x.fillStyle = "#fed7aa"; x.beginPath(); x.arc(0, -16, 9, 0, 7); x.fill(); x.fillStyle = "#111"; x.fillRect(-5 + f * 2, -19, 3, 4); x.fillRect(2 + f * 2, -19, 3, 4); x.fillRect(-5, -13, 10, 2);
    } else if (e.type === "u") {
      x.restore(); var PX = sx(e.x), PY = sy(e.y), W = e.w * TS, H = e.h * TS;
      x.fillStyle = "#6b7280"; x.fillRect(PX + W / 2 - 7, -10, 14, PY + 10); x.fillStyle = "#9ca3af"; x.fillRect(PX + W / 2 - 3, -10, 3, PY + 10);
      x.fillStyle = "#4b5563"; rr(x, PX, PY, W, H, 4); x.fill(); x.fillStyle = "#1f2937"; x.fillRect(PX, PY + H - 10, W, 10);
      x.save(); x.beginPath(); x.rect(PX, PY + H - 10, W, 10); x.clip(); x.fillStyle = "#facc15"; for (var z = -10; z < W; z += 16) { x.beginPath(); x.moveTo(PX + z, PY + H); x.lineTo(PX + z + 8, PY + H - 10); x.lineTo(PX + z + 16, PY + H - 10); x.lineTo(PX + z + 8, PY + H); x.fill(); } x.restore();
      x.fillStyle = e.st === "fall" ? "#ef4444" : "#22c55e"; x.beginPath(); x.arc(PX + 10, PY + 10, 4, 0, 7); x.fill();
      return;
    }
    x.restore();
  }
  function drawItem(x, it, t) {
    var X = sx(it.x + it.w / 2), Y = sy(it.y + it.h);
    x.save(); x.translate(X, Y);
    if (it.kind === "cell") { x.fillStyle = "#facc15"; rr(x, -9, -30, 18, 28, 4); x.fill(); x.fillStyle = "#1f2937"; x.fillRect(-4, -34, 8, 4); x.fillStyle = "#1f2937"; x.font = "900 16px system-ui"; x.textAlign = "center"; x.fillText("+", 0, -10); }
    else if (it.kind === "boots") { x.fillStyle = "#ef4444"; rr(x, -12, -30, 16, 16, 4); x.fill(); x.fillRect(-12, -18, 22, 7); x.strokeStyle = "#e5e7eb"; x.lineWidth = 2.5; x.beginPath(); for (var k = 0; k < 4; k++) { x.moveTo(-8, -9 + k * 2.5); x.lineTo(6, -10 + k * 2.5); } x.stroke(); }
    else if (it.kind === "emp") { x.fillStyle = "#0891b2"; x.beginPath(); x.arc(0, -15, 12, 0, 7); x.fill(); x.strokeStyle = "#a5f3fc"; x.lineWidth = 2; x.beginPath(); x.arc(0, -15, 16 + Math.sin(t * 8) * 2, 0, 7); x.stroke(); x.strokeStyle = "#fff"; x.beginPath(); x.moveTo(-3, -24); x.lineTo(2, -16); x.lineTo(-2, -14); x.lineTo(3, -6); x.stroke(); }
    else if (it.kind === "shield") { x.strokeStyle = "#7ef0ff"; x.lineWidth = 3; x.fillStyle = "rgba(126,240,255,.25)"; x.beginPath(); x.arc(0, -16, 14, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#fff"; x.font = "800 11px system-ui"; x.textAlign = "center"; x.fillText("m", 0, -12); }
    else if (it.kind === "oneup") { x.fillStyle = "#16a34a"; rr(x, -12, -28, 24, 24, 4); x.fill(); x.fillStyle = "#bbf7d0"; x.fillRect(-7, -28, 14, 8); x.fillStyle = "#fff"; x.font = "900 11px system-ui"; x.textAlign = "center"; x.fillText("+1", 0, -8); }
    else if (it.kind === "mount") { x.restore(); drawMount(x, (MOUNTS[who().id] || MOUNTS.newton).id, X, Y, 1, t, true); return; }
    x.restore();
  }
  function drawMount(x, id, X, Y, f, t, idle) {
    x.save(); x.translate(X, Y); x.scale(f, 1);
    var bob = Math.sin(t * 6) * 2;
    if (id === "horse") { var g = Math.sin(t * 14) * (idle ? 1 : 6); x.fillStyle = "#7c4a24"; x.fillRect(-14 + g, -14, 5, 14); x.fillRect(9 - g, -14, 5, 14); x.beginPath(); x.ellipse(0, -20, 20, 10, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(14, -26); x.lineTo(26, -40); x.lineTo(32, -34); x.lineTo(20, -18); x.fill(); x.fillStyle = "#3b2412"; x.fillRect(16, -42, 6, 14); x.beginPath(); x.moveTo(-18, -24); x.quadraticCurveTo(-30, -20, -28, -8); x.lineTo(-24, -20); x.fill(); x.fillStyle = "#111"; x.beginPath(); x.arc(27, -36, 1.6, 0, 7); x.fill(); }
    else if (id === "drone") { x.fillStyle = "#334155"; x.beginPath(); x.ellipse(0, -10 + bob, 22, 7, 0, 0, 7); x.fill(); x.strokeStyle = "#7ef0ff"; x.lineWidth = 2; for (var k = -1; k <= 1; k += 2) { x.beginPath(); x.ellipse(k * 20, -16 + bob, 10, 2.5, 0, 0, 7); x.stroke(); } if (Math.floor(t * 12) % 3 === 0) { x.beginPath(); x.moveTo(-10, -4 + bob); x.lineTo(-4, 2 + bob); x.lineTo(-8, 4 + bob); x.lineTo(-2, 10 + bob); x.stroke(); } }
    else if (id === "wave") { x.fillStyle = "#fde047"; rr(x, -24, -8, 48, 7, 3); x.fill(); x.strokeStyle = "rgba(253,224,71,.7)"; x.lineWidth = 2; x.beginPath(); for (var w = 0; w < 30; w++) x.lineTo(-24 - w * 2, -4 + Math.sin(t * 20 + w * .6) * 4); x.stroke(); }
    else if (id === "scooter") { var gg = x.createRadialGradient(0, -10, 2, 0, -10, 40); gg.addColorStop(0, "rgba(125,255,154,.5)"); gg.addColorStop(1, "rgba(125,255,154,0)"); x.fillStyle = gg; x.fillRect(-40, -50, 80, 60); x.fillStyle = "#16a34a"; x.fillRect(-18, -8, 36, 5); x.fillRect(12, -30, 4, 24); x.fillRect(8, -32, 12, 4); x.fillStyle = "#111"; x.beginPath(); x.arc(-13, -2, 5, 0, 7); x.arc(14, -2, 5, 0, 7); x.fill(); }
    else if (id === "maglev") { x.fillStyle = "#7c3aed"; rr(x, -22, -10 + bob, 44, 6, 3); x.fill(); x.strokeStyle = "rgba(167,139,250,.6)"; x.lineWidth = 1.5; for (var m2 = 0; m2 < 3; m2++) { x.beginPath(); x.ellipse(0, -2 + bob, 10 + m2 * 8, 3 + m2, 0, 0, Math.PI); x.stroke(); } }
    else if (id === "orbit") { x.strokeStyle = "#fb923c"; x.lineWidth = 2; for (var o = 0; o < 2; o++) { x.beginPath(); x.ellipse(0, -20, 22, 8, o ? .5 : -.5, 0, 7); x.stroke(); x.fillStyle = "#fed7aa"; x.beginPath(); x.arc(Math.cos(t * 5 + o * 3) * 22, -20 + Math.sin(t * 5 + o * 3) * 8 * (o ? 1 : -1), 3.5, 0, 7); x.fill(); } x.fillStyle = "#c2410c"; x.beginPath(); x.ellipse(0, -6, 14, 5, 0, 0, 7); x.fill(); }
    else if (id === "bass") { x.fillStyle = "#db2777"; rr(x, -22, -9, 44, 8, 3); x.fill(); x.fillStyle = "#111"; x.beginPath(); x.arc(-11, -5, 4, 0, 7); x.arc(11, -5, 4, 0, 7); x.fill(); x.strokeStyle = "rgba(255,61,139,.6)"; x.lineWidth = 2; x.beginPath(); x.arc(0, -4, 14 + (t * 30) % 12, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
    else if (id === "crane") { x.fillStyle = "#10b981"; x.beginPath(); x.moveTo(0, -30); x.lineTo(-34, -42 + bob); x.lineTo(-10, -24); x.closePath(); x.moveTo(0, -30); x.lineTo(34, -42 + bob); x.lineTo(10, -24); x.closePath(); x.fill(); x.fillStyle = "#064e3b"; x.fillRect(-12, -8, 24, 5); }
    if (idle) { x.fillStyle = "#fff"; x.globalAlpha = .5 + .5 * Math.sin(t * 5); x.font = "800 12px system-ui"; x.textAlign = "center"; x.fillText("RIDE ME", 0, -50); x.globalAlpha = 1; }
    x.restore();
  }
  function drawHero(x, api) {
    var h = L.hero, c = who(), t = L.t;
    if (h.inv > 0 && !h.dead && Math.floor(t * 18) % 2) return;
    var X = sx(h.x + h.w / 2), Y = sy(h.y + h.h), f = h.face, big = h.h > 1.2 || (h.duck && h.big), duck = h.duck;
    x.save(); x.translate(X, Y);
    if (h.dead) x.rotate(Math.sin(h.dead * 10) * .3);
    if (h.pounding && h.pound > 0) x.rotate(f * (1 - h.pound / P.POUND_HANG) * 6.283);
    x.scale(h.sx, h.sy);
    if (h.shield > 0) { x.strokeStyle = "rgba(126,240,255," + (h.shield < 2 ? (Math.floor(t * 10) % 2 ? .9 : .2) : .8) + ")"; x.lineWidth = 3; x.fillStyle = "rgba(126,240,255,.12)"; x.beginPath(); x.arc(0, -h.h * TS / 2, h.h * TS * .62 + 4, 0, 7); x.fill(); x.stroke(); }
    var my = 0;
    if (h.mount) { drawMount(x, h.mount, 0, 0, f, t, false); my = h.mount === "orbit" || h.mount === "crane" ? -8 : -16; }
    x.translate(0, my);
    var legs = h.mount ? 0 : big ? 14 : 8, bodyH = h.mount ? (big ? 20 : 14) : duck ? (big ? 10 : 6) : big ? 26 : 10, r = big ? 15 : 13, run = h.ground ? Math.sin(h.step) : .6;
    if (h.mount) legs = 6;
    // legs
    x.strokeStyle = "#1f2937"; x.lineWidth = big ? 6 : 5; x.lineCap = "round";
    if (!h.mount) { x.beginPath(); x.moveTo(-3, -legs); x.lineTo(-3 + run * 6 * (h.ground ? 1 : .5), 0 - (h.ground ? 0 : 4)); x.moveTo(3, -legs); x.lineTo(3 - run * 6 * (h.ground ? 1 : .5), 0 - (h.ground ? 0 : 6)); x.stroke(); }
    if (h.boots) { x.fillStyle = "#ef4444"; x.fillRect(-8, -5, 7, 5); x.fillRect(2, -5, 7, 5); x.strokeStyle = "#e5e7eb"; x.lineWidth = 2; x.beginPath(); x.moveTo(-6, 0); x.lineTo(-2, 2); x.moveTo(4, 0); x.lineTo(8, 2); x.stroke(); }
    // coat
    var top = -legs - bodyH; x.fillStyle = c.coat; rr(x, -r * .62, top, r * 1.24, bodyH + 3, 5); x.fill();
    if (G.power === "emp") { x.strokeStyle = "#7ef0ff"; x.lineWidth = 2; x.stroke(); }
    // arms
    x.strokeStyle = c.coat; x.lineWidth = big ? 6 : 5; var sw = h.ground ? -run * 6 : -8;
    x.beginPath(); x.moveTo(-r * .55, top + 5); x.lineTo(-r * .55 - f * sw * .4 - 3, top + bodyH - 2 + (h.ground ? 0 : -10)); x.moveTo(r * .55, top + 5); x.lineTo(r * .55 + f * sw * .4 + 3, top + bodyH - 2 + (h.ground ? 0 : -10)); x.stroke();
    x.fillStyle = c.skin; x.beginPath(); x.arc(-r * .55 - f * sw * .4 - 3, top + bodyH - 2 + (h.ground ? 0 : -10), 3, 0, 7); x.arc(r * .55 + f * sw * .4 + 3, top + bodyH - 2 + (h.ground ? 0 : -10), 3, 0, 7); x.fill();
    A.drawHead(x, c, 0, top - r * .75, r, f, { mood: h.dead ? "sad" : h.inv > 0 ? "sad" : h.pounding || h.skid ? "fight" : "happy", blink: Math.floor(t * 1.3 + 0.3) % 5 === 0 && (t * 1.3 % 1) < .12 });
    x.restore();
    if (h.skid && h.ground) { x.fillStyle = "rgba(255,255,255,.8)"; x.font = "800 11px system-ui"; x.textAlign = "center"; }
  }
  function drawShots(x, t) {
    L.shots.forEach(function (s) {
      var X = sx(s.x), Y = sy(s.y), R = s.r * TS;
      if (s.kind === "zap") { x.strokeStyle = "#7ef0ff"; x.lineWidth = 3; x.beginPath(); x.moveTo(X - s.vx * .05 * TS, Y); for (var k = 0; k < 5; k++) x.lineTo(X - s.vx * .05 * TS * (1 - k / 5), Y + (k % 2 ? -6 : 6)); x.stroke(); return; }
      var col = s.kind === "emp" ? "#22d3ee" : s.kind === "magma" ? "#fb923c" : s.kind === "puck" ? "#bae6fd" : "#a855f7";
      var gg = x.createRadialGradient(X, Y, 1, X, Y, R * 2.2); gg.addColorStop(0, col); gg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gg; x.beginPath(); x.arc(X, Y, R * 2.2, 0, 7); x.fill();
      x.fillStyle = s.kind === "puck" ? "#e0f2fe" : "#fff"; x.beginPath(); if (s.kind === "puck") x.ellipse(X, Y, R, R * .5, 0, 0, 7); else x.arc(X, Y, R * .55, 0, 7); x.fill();
      if (s.kind === "dis") { x.strokeStyle = "#f0abfc"; x.lineWidth = 2; x.beginPath(); x.arc(X, Y, R, t * 8, t * 8 + 4); x.stroke(); }
    });
    L.waves.forEach(function (w) { var X = sx(w.x), Y = sy(w.y); x.fillStyle = "rgba(196,181,253,.8)"; x.beginPath(); x.moveTo(X - 14, Y); x.quadraticCurveTo(X, Y - 26, X + 14, Y); x.fill(); });
  }
  function drawArms(x, t) {
    L.arms.forEach(function (a) { var cx = sx(a.c + .5), cy = sy(a.r + .5);
      for (var k = 1; k <= a.len * 2; k++) { var rr2 = k * .5 * TS, ox = cx + Math.cos(a.th) * rr2, oy = cy + Math.sin(a.th) * rr2, gg = x.createRadialGradient(ox, oy, 1, ox, oy, 14);
        gg.addColorStop(0, "rgba(255,255,255,1)"); gg.addColorStop(.35, "rgba(125,211,252,.95)"); gg.addColorStop(1, "rgba(56,189,248,0)"); x.fillStyle = gg; x.beginPath(); x.arc(ox, oy, 14, 0, 7); x.fill(); } });
  }
  function bossBar(x) {
    var b = L.boss;
    { var bx = 470, by = 34, bw = 260; x.fillStyle = "#fff"; x.font = "800 13px system-ui"; x.textAlign = "left"; x.fillText(BOSS[b.kind].name, bx, by - 8);
      for (var i = 0; i < b.max; i++) { x.fillStyle = i < b.hp ? BOSS[b.kind].col : "rgba(255,255,255,.15)"; rr(x, bx + i * (bw / b.max), by, bw / b.max - 4, 9, 3); x.fill(); }
      if (b.chip > 0) { x.fillStyle = "#7ef0ff"; x.fillRect(bx + (b.hp - 1) * (bw / b.max), by + 10, (bw / b.max - 4) * b.chip, 2); } }
  }
  function drawBoss(x, t) {
    var b = L.boss; if (!b || (!b.alive && (b.dieT == null || b.dieT > 3))) return;
    var X = sx(b.x + b.w / 2), Y = sy(b.y + b.h), flick = b.inv > 0 && Math.floor(t * 16) % 2;
    x.save(); x.translate(X, Y); if (!b.alive) x.rotate(b.dieT * 3); if (flick) x.globalAlpha = .45;
    var W = b.w * TS, H = b.h * TS;
    if (b.kind === "brute") {
      x.fillStyle = "#5b21b6"; x.beginPath(); for (var k = 0; k < 22; k++) { var a = k / 22 * 6.283, rad = W * .5 + (k % 2 ? 8 : 0) + Math.sin(t * 20 + k) * 2; x.lineTo(Math.cos(a) * rad, -H / 2 + Math.sin(a) * rad * .95); } x.closePath(); x.fill();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(-16 + b.face * 10, -H * .6, 12, 0, 7); x.arc(16 + b.face * 10, -H * .6, 12, 0, 7); x.fill(); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(-16 + b.face * 14, -H * .6, 5, 0, 7); x.arc(16 + b.face * 14, -H * .6, 5, 0, 7); x.fill();
      x.strokeStyle = "#1e1b4b"; x.lineWidth = 4; x.beginPath(); x.moveTo(-30, -H * .78); x.lineTo(-6, -H * .7); x.moveTo(30, -H * .78); x.lineTo(6, -H * .7); x.stroke(); x.fillStyle = "#1e1b4b"; x.fillRect(-18, -H * .35, 36, 6);
    } else if (b.kind === "golem") {
      var gi = x.createLinearGradient(0, -H, 0, 0); gi.addColorStop(0, "#e0f7ff"); gi.addColorStop(1, "#5aa9cf"); x.fillStyle = gi; rr(x, -W / 2, -H, W, H, 10); x.fill(); x.strokeStyle = "#1e6f94"; x.lineWidth = 3; x.stroke();
      x.fillStyle = "#0c4a6e"; x.fillRect(-W / 2 + 6, -H * .55, W - 12, 4); x.fillStyle = b.dizzy > 0 ? "#fff" : "#38bdf8"; x.beginPath(); x.arc(-14 + b.face * 6, -H * .72, 8, 0, 7); x.arc(14 + b.face * 6, -H * .72, 8, 0, 7); x.fill();
      x.fillStyle = "rgba(255,255,255,.7)"; x.beginPath(); x.moveTo(-W / 2 + 8, -H + 8); x.lineTo(-W / 2 + 22, -H + 8); x.lineTo(-W / 2 + 8, -H + 30); x.fill();
    } else if (b.kind === "boiler") {
      x.fillStyle = "#7c2d12"; rr(x, -W / 2, -H, W, H, 18); x.fill(); x.fillStyle = "#9a3412"; x.fillRect(-W / 2, -H * .5, W, 10); x.fillStyle = "#e5e7eb"; x.beginPath(); x.arc(0, -H * .7, 16, 0, 7); x.fill(); x.strokeStyle = "#111"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -H * .7); x.lineTo(Math.cos(t * 3) * 12, -H * .7 + Math.sin(t * 3) * 12); x.stroke();
      x.fillStyle = b.st === "vent" ? "#22c55e" : "#ef4444"; x.fillRect(-14, -H - 12, 28, 12); x.fillRect(-4, -H - 20, 8, 10);
      x.fillStyle = "#fde68a"; x.beginPath(); x.arc(-W / 2 + 18, -H * .3, 6, 0, 7); x.arc(W / 2 - 18, -H * .3, 6, 0, 7); x.fill();
      if (b.st === "vent") { x.fillStyle = "rgba(255,255,255,.7)"; for (var s = 0; s < 4; s++) { x.beginPath(); x.arc(Math.sin(t * 7 + s) * 10, -H - 30 - ((t * 60 + s * 15) % 50), 8 + s * 2, 0, 7); x.fill(); } }
    } else if (b.kind === "harpy") {
      var wf = Math.sin(t * 10) * 18; x.fillStyle = "#0369a1"; x.beginPath(); x.moveTo(-10, -H * .6); x.lineTo(-60, -H * .6 - wf); x.lineTo(-30, -H * .2); x.closePath(); x.moveTo(10, -H * .6); x.lineTo(60, -H * .6 - wf); x.lineTo(30, -H * .2); x.closePath(); x.fill();
      x.fillStyle = "#e0f2fe"; x.beginPath(); x.ellipse(0, -H * .5, 26, 22, 0, 0, 7); x.fill(); x.fillStyle = "#fbbf24"; x.beginPath(); x.moveTo(b.face * 20, -H * .62); x.lineTo(b.face * 36, -H * .55); x.lineTo(b.face * 20, -H * .48); x.fill();
      x.fillStyle = "#0c4a6e"; x.beginPath(); x.arc(b.face * 10, -H * .62, 4, 0, 7); x.fill(); x.strokeStyle = "#0c4a6e"; x.lineWidth = 3; x.beginPath(); x.moveTo(-8, -H * .1); x.lineTo(-12, 0); x.moveTo(8, -H * .1); x.lineTo(12, 0); x.stroke();
    } else if (b.kind === "mech") {
      x.fillStyle = "#475569"; rr(x, -W / 2, -H, W, H * .75, 12); x.fill(); x.fillStyle = "#1e293b"; x.fillRect(-W / 2 + 10, -H * .25, 14, H * .25); x.fillRect(W / 2 - 24, -H * .25, 14, H * .25);
      x.fillStyle = b.dizzy > 0 ? "#fde68a" : "#38bdf8"; rr(x, -W / 2 + 12, -H + 14, W - 24, 18, 6); x.fill(); x.fillStyle = "#0f172a"; x.fillRect(-6 + b.face * 14, -H + 18, 12, 10);
      if (b.dizzy > 0) { x.fillStyle = "rgba(255,255,255,.6)"; for (var v2 = 0; v2 < 3; v2++) { x.beginPath(); x.arc(-W / 2 + 6 + v2 * (W - 12) / 2, -H - 10 - ((t * 50 + v2 * 12) % 30), 6 + v2, 0, 7); x.fill(); } }
    } else if (b.kind === "entropy" || b.kind === "prime") {
      if (b.kind === "prime") { x.strokeStyle = "rgba(240,171,252," + (.35 + .25 * Math.sin(t * 6)) + ")"; x.lineWidth = 6; x.beginPath(); x.arc(0, -40, 58 + Math.sin(t * 4) * 4, 0, 7); x.stroke(); if (b.hp <= b.max / 2) { x.fillStyle = "rgba(168,85,247,.18)"; x.beginPath(); x.arc(0, -40, 70, 0, 7); x.fill(); } }
      x.fillStyle = "#3b0764"; x.beginPath(); x.ellipse(0, -6, 46, 12, 0, 0, 7); x.fill(); x.fillStyle = "#c084fc"; x.beginPath(); x.ellipse(0, -10, 30, 6, 0, 0, 7); x.fill();
      for (var q = 0; q < 6; q++) { x.fillStyle = Math.floor(t * 8 + q) % 2 ? "#f0abfc" : "#7e22ce"; x.beginPath(); x.arc(-36 + q * 14.4, -4, 3, 0, 7); x.fill(); }
      x.fillStyle = "#2a1f3d"; x.beginPath(); x.moveTo(-26, -16); x.quadraticCurveTo(-36 - Math.sin(t * 4) * 6, -50, -18, -70); x.lineTo(18, -70); x.quadraticCurveTo(36 + Math.sin(t * 4) * 6, -50, 26, -16); x.fill();
      A.drawHead(x, A.VILLAIN, 0, -66, 26, b.face, { mood: b.inv > 0 ? "sad" : "fight" });
    }
    if (b.dizzy > 0 || !b.alive) { x.fillStyle = "#fde047"; for (var d = 0; d < 3; d++) { var aa = t * 5 + d * 2.1; x.font = "900 16px system-ui"; x.fillText("★", Math.cos(aa) * 26 - 6, -H - 12 + Math.sin(aa) * 6); } }
    x.restore(); x.globalAlpha = 1;

  }

  var darkCv = null;
  function lighting(x, api) {
    var th = L.th; if (!th.dark) return;
    if (!darkCv) { darkCv = document.createElement("canvas"); darkCv.width = 480; darkCv.height = 270; darkCv.getContext("2d").scale(.5, .5); }
    var d = darkCv.getContext("2d"), h = L.hero;
    d.globalCompositeOperation = "source-over"; d.clearRect(0, 0, 960, 540); d.fillStyle = "rgba(4,6,16," + th.dark + ")"; d.fillRect(0, 0, 960, 540);
    d.globalCompositeOperation = "destination-out";
    function hole(X, Y, R, a) { var g = d.createRadialGradient(X, Y, R * .15, X, Y, R); g.addColorStop(0, "rgba(0,0,0," + a + ")"); g.addColorStop(1, "rgba(0,0,0,0)"); d.fillStyle = g; d.fillRect(X - R, Y - R, R * 2, R * 2); }
    hole(sx(h.x + h.w / 2), sy(h.y + h.h / 2), h.mount === "scooter" ? 330 : 240, 1);
    var c0 = Math.floor(L.cam.x), c1 = c0 + VWT + 1, r0 = Math.max(0, Math.floor(L.cam.y)), r1 = Math.min(L.H - 1, r0 + VHT + 1);
    for (var c = c0; c <= c1; c += 2) for (var r = r0; r <= r1; r++) if (rawTile(c, r) === "~" && rawTile(c, r - 1) !== "~") hole(sx(c + .5), sy(r), 120, .9);
    for (var lc = Math.floor(c0 / 9) * 9; lc <= c1; lc += 9) if (L.lv.theme === "lab") hole(sx(lc + .5), sy(L.cam.y + 2.5), 150, .7);
    L.gates.forEach(function (g) { if (!g.hidden) hole(sx(g.c + .5), sy(g.r - 1), 160, .9); });
    L.cps.forEach(function (cp) { if (cp.on) hole(sx(cp.c + .5), sy(cp.r - 1.5), 110, .8); });
    L.shots.forEach(function (s) { hole(sx(s.x), sy(s.y), 60, .8); });
    L.arms.forEach(function (a) { hole(sx(a.c + .5), sy(a.r + .5), a.len * TS + 40, .7); });
    if (L.boss && L.boss.alive && L.locked) hole(sx(L.boss.x + L.boss.w / 2), sy(L.boss.y + L.boss.h / 2), 200, .8);
    x.drawImage(darkCv, 0, 0, 960, 540);
  }
  function weather(x, api) {
    var th = L.th, t = L.t, n = api.reduce ? 0 : 40;
    if (th.snow) { x.fillStyle = "rgba(255,255,255,.85)"; for (var i = 0; i < n; i++) { var X = ((hash(i) * 960 - L.cam.x * TS * .8 + Math.sin(t + i) * 20) % 960 + 960) % 960, Y = ((hash(i * 7) * 540 + t * (30 + hash(i * 3) * 40)) % 540); x.fillRect(X, Y, 3, 3); } }
    if (th.embers) { for (var j = 0; j < n * .7; j++) { var ex = ((hash(j * 5) * 960 - L.cam.x * TS * .9) % 960 + 960) % 960, ey = 540 - ((hash(j * 11) * 540 + t * (40 + hash(j) * 50)) % 540); x.fillStyle = j % 3 ? "rgba(255,150,60,.8)" : "rgba(255,220,120,.9)"; x.fillRect(ex + Math.sin(t * 2 + j) * 6, ey, 2, 2); } }
    if (th.rain) { x.strokeStyle = "rgba(170,190,255,.35)"; x.lineWidth = 1.5; x.beginPath(); for (var k = 0; k < n * 1.5; k++) { var rx = ((hash(k * 3) * 1100 - L.cam.x * TS) % 1000 + 1000) % 1000 - 20, ry = (hash(k * 13) * 540 + t * 700) % 560 - 20; x.moveTo(rx, ry); x.lineTo(rx - 6, ry + 16); } x.stroke(); }
    if (!vignette) { vignette = document.createElement("canvas"); vignette.width = 480; vignette.height = 270; var vq = vignette.getContext("2d"), vg = vq.createRadialGradient(240, 135, 150, 240, 135, 310); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.35)"); vq.fillStyle = vg; vq.fillRect(0, 0, 480, 270); }
    x.drawImage(vignette, 0, 0, 960, 540);
  }
  var hudHead = null, wrapCache = { text: null, w: 0, lines: [] }, vignette = null;
  function wrapLines(x, text, maxW) {
    if (wrapCache.text === text && wrapCache.w === maxW) return wrapCache.lines;
    var words = text.split(" "), line = "", out = [];
    for (var i = 0; i < words.length; i++) { var test = line + words[i] + " "; if (x.measureText(test).width > maxW && line) { out.push(line); line = words[i] + " "; } else line = test; }
    out.push(line); wrapCache = { text: text, w: maxW, lines: out.slice(0, 3) }; return wrapCache.lines;
  }
  // On a phone the 960-wide canvas is drawn very small; scale the HUD up so its text stays readable (and honour the
  // player's HUD and text size settings).
  function hudK(api) {
    if (S.hk == null || Math.abs(L.t - S.hkT) > .5) { S.hkT = L.t; var k = 1;
      try { var r = api.x.canvas.getBoundingClientRect(), css = Math.min(r.width / 960, r.height / 540); if (css > 0 && css < .62) k = Math.min(2.2, .62 / css); } catch (e) {}
      S.hk = k * (opt("hudScale", 1) || 1) * (opt("textScale", 1) || 1); }
    return S.hk;
  }
  function hudCompact(x, api, k) {
    var Wv = 960 / k, t = L.t; x.save(); x.scale(k, k); x.globalAlpha = opt("hudAlpha", 1) || 1;
    x.fillStyle = "rgba(4,12,18,.6)"; rr(x, 6, 6, Wv - 12, 34, 9); x.fill(); x.globalAlpha = 1;
    x.textBaseline = "middle"; x.font = "800 18px system-ui, sans-serif"; x.textAlign = "left"; x.fillStyle = "#fff";
    var lx = 14; x.fillText((S.attack ? "∞" : "× " + G.lives) + (G.hearts ? "  ♥" + G.hearts : ""), lx, 23);
    x.fillStyle = "#f4b81c"; x.fillText("● " + G.coins, lx + 92, 23);
    var got = save.shards[L.lv.id] || []; x.fillStyle = "#c4b5fd"; x.fillText("◆ " + got.filter(Boolean).length + "/" + L.shardN, lx + 170, 23);
    x.textAlign = "right"; x.fillStyle = !S.attack && L.time < 100 && Math.floor(t * 2) % 2 ? "#ff6b6b" : "#fff"; x.fillText(S.attack ? fmtT(L.att) : "⏱ " + Math.ceil(L.time), Wv - 14, 23);
    var ry = 44;
    if (L.intro > 0 && L.lv.hint && !L.locked) { x.font = "700 14px system-ui"; var hl = wrapLines(x, L.lv.hint, Wv - 40); x.globalAlpha = Math.min(1, L.intro); x.fillStyle = "rgba(4,12,18,.82)"; rr(x, 12, ry, Wv - 24, 12 + hl.length * 17, 8); x.fill(); x.fillStyle = "#fff"; x.textAlign = "left"; hl.forEach(function (ln, i) { x.fillText(ln, 22, ry + 14 + i * 17); }); ry += 18 + hl.length * 17; x.globalAlpha = 1; }
    if (save.hud && L.read && L.readT > 0) { x.font = "600 13px system-ui"; var wl = wrapLines(x, L.read, Wv - 44); x.globalAlpha = Math.min(1, L.readT * 2); x.fillStyle = "rgba(4,12,18,.84)"; rr(x, 12, ry, Wv - 24, 10 + wl.length * 16, 8); x.fill(); x.fillStyle = "#e2f8ff"; x.textAlign = "left"; wl.forEach(function (ln, i) { x.fillText(ln, 22, ry + 13 + i * 16); }); x.globalAlpha = 1; }
    x.textBaseline = "alphabetic"; x.restore();
  }
  function hud(x, api) {
    var k = hudK(api); if (k > 1.15) return hudCompact(x, api, k);
    var c = who(), t = L.t;
    x.fillStyle = "rgba(4,12,18,.55)"; rr(x, 8, 8, 944, 46, 12); x.fill();
    if (!hudHead || hudHead.id !== c.id + c.coat) { hudHead = document.createElement("canvas"); hudHead.width = hudHead.height = 80; var hq = hudHead.getContext("2d"); hq.scale(2, 2); A.drawHead(hq, c, 20, 18, 15, 1, { mood: "happy" }); hudHead.id = c.id + c.coat; }
    x.drawImage(hudHead, 14, 13, 40, 40);
    x.textAlign = "left"; x.textBaseline = "middle"; x.fillStyle = "#fff"; x.font = "800 22px system-ui, sans-serif";
    x.fillText(S.attack ? "∞" : "× " + G.lives, 56, 32); if (G.hearts) { x.fillStyle = "#fda4af"; x.font = "800 15px system-ui"; x.fillText("♥" + G.hearts, 56, 48); x.font = "800 22px system-ui, sans-serif"; x.fillStyle = "#fff"; }
    x.fillStyle = "#f4b81c"; x.beginPath(); x.ellipse(130, 31, 9, 11, 0, 0, 7); x.fill(); x.fillStyle = "#fff"; x.fillText(String(G.coins), 146, 32);
    x.fillText(String(G.score).padStart(7, "0"), 210, 32);
    var got = save.shards[L.lv.id] || [];
    for (var i = 0; i < L.shardN; i++) { var X = 340 + i * 22; x.fillStyle = got[i] ? "#a78bfa" : "rgba(255,255,255,.2)"; x.beginPath(); x.moveTo(X, 20); x.lineTo(X + 8, 31); x.lineTo(X, 42); x.lineTo(X - 8, 31); x.closePath(); x.fill(); }
    x.textAlign = "center"; x.font = "800 18px system-ui, sans-serif"; x.fillStyle = "#cbd5e1"; if (!(L.boss && L.boss.alive && L.locked)) x.fillText(L.lv.id + "  " + L.lv.name, 610, 32);
    x.textAlign = "right"; x.font = "800 22px system-ui, sans-serif"; x.fillStyle = L.time < 100 && Math.floor(t * 2) % 2 ? "#ff6b6b" : "#fff"; x.fillText(S.attack ? "⏱ " + fmtT(L.att) + (L.ghost ? "  (best " + fmtT(L.ghost.t) + ")" : "") : "⏱ " + Math.ceil(L.time), 940, 32);
    var h = L.hero, tags = [];
    if (G.power === "boots") tags.push("Spring boots"); if (G.power === "emp") tags.push("EMP"); if (h.shield > 0) tags.push("Shield " + Math.ceil(h.shield) + " s");
    if (h.mount) tags.push("Riding"); if (save.lap > 1) tags.push("Remix lap " + save.lap); if (h.runLatch || api.down("run")) tags.push("RUN");
    if (tags.length) { x.textAlign = "right"; x.font = "700 14px system-ui"; x.fillStyle = "#7ef0ff"; x.fillText(tags.join(" · "), 944, 68); }
    var ry = 62;
    if (L.intro > 0 && L.lv.hint && !L.locked) { x.globalAlpha = Math.min(1, L.intro); x.fillStyle = "rgba(4,12,18,.8)"; rr(x, 60, 76, 840, 40, 10); x.fill(); x.fillStyle = "#fff"; x.font = "700 16px system-ui"; x.textAlign = "center"; x.fillText(L.lv.hint, 480, 97); x.globalAlpha = 1; ry = 122; }
    // physics readout strip
    if (save.hud && L.read && L.readT > 0) {
      x.globalAlpha = Math.min(1, L.readT * 2); x.font = "600 15px system-ui, sans-serif"; var wl = wrapLines(x, L.read, 890), bh = 16 + wl.length * 19;
      x.fillStyle = "rgba(4,12,18,.84)"; rr(x, 20, ry + 14, 920, bh, 10); x.fill(); x.fillStyle = "#7ef0ff"; x.fillRect(20, ry + 14, 5, bh);
      x.fillStyle = "#e2f8ff"; x.textAlign = "left"; x.textBaseline = "middle"; wl.forEach(function (ln, i) { x.fillText(ln, 36, ry + 14 + 8 + 9.5 + i * 19); }); x.globalAlpha = 1;
    }
    x.textBaseline = "alphabetic";
  }
  function drawGhost(x) { // your best run, replayed at 5 samples a second
    var f = L.ghost.f, n = f.length / 2, q = L.att / .2, i0 = Math.min(n - 1, Math.floor(q)), i1 = Math.min(n - 1, i0 + 1), u = Math.min(1, q - i0);
    if (n < 2) return; var gx = (f[i0 * 2] + (f[i1 * 2] - f[i0 * 2]) * u) / 10, gy = (f[i0 * 2 + 1] + (f[i1 * 2 + 1] - f[i0 * 2 + 1]) * u) / 10;
    var X = sx(gx + .36), Y = sy(gy + 1.72); x.save(); x.globalAlpha = .38; x.fillStyle = "#7ef0ff"; rr(x, X - 9, Y - 44, 18, 30, 5); x.fill(); A.drawHead(x, who(), X, Y - 56, 14, f[i1 * 2] >= f[i0 * 2] ? 1 : -1, { mood: "happy" }); x.restore();
  }
  var DBG = { skip: {} };
  function drawPlay(x, api) {
    var sk = DBG.skip;
    if (!sk.sky) drawSky(x, api); else { x.fillStyle = "#123"; x.fillRect(0, 0, 960, 540); }
    drawPlats(x);
    if (!sk.tiles) drawTiles(x, api);
    drawMarkers(x, api);
    drawArms(x, L.t);
    L.items.forEach(function (it) { drawItem(x, it, L.t); });
    L.ents.forEach(function (e) { drawEnemy(x, e, L.t); });
    drawBoss(x, L.t);
    L.debris.forEach(function (d) { if (d.mount) { drawMount(x, d.mount, sx(d.x), sy(d.y), -1, L.t, false); return; } x.fillStyle = L.th.brick; x.fillRect(sx(d.x) - 7, sy(d.y) - 7, 14, 14); });
    if (L.apex && save.hud) { var ay = sy(L.apex.y), ax = sx(L.apex.x); x.strokeStyle = "rgba(126,240,255,.75)"; x.setLineDash([6, 5]); x.lineWidth = 2; x.beginPath(); x.moveTo(ax - 60, ay); x.lineTo(ax + 60, ay); x.stroke(); x.setLineDash([]); x.fillStyle = "#7ef0ff"; x.font = "700 13px system-ui"; x.textAlign = "left"; x.fillText("h = " + fx(L.apex.h) + " m", ax + 64, ay + 4); }
    if (S.attack && L.ghost && L.ghost.f) drawGhost(x);
    drawHero(x, api);
    drawShots(x, L.t);
    L.pops.forEach(function (p) { var a = 1 - p.t / (p.coin ? .6 : 1.2), X = sx(p.x + .4), Y = sy(p.y) - p.t * 40;
      if (p.coin) { x.fillStyle = "#f4b81c"; x.beginPath(); x.ellipse(X, Y - p.t * 60, 9 * Math.abs(Math.cos(p.t * 20)) + 1, 11, 0, 0, 7); x.fill(); return; }
      x.globalAlpha = Math.max(0, a); x.font = (p.big ? "900 20px" : "800 15px") + " system-ui"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.6)"; x.strokeText(p.text, X, Y); x.fillStyle = p.col; x.fillText(p.text, X, Y); x.globalAlpha = 1; });
    if (!sk.light) lighting(x, api);
    if (!sk.weather) weather(x, api);
    if (L.fade > 0) { x.fillStyle = "rgba(0,0,0," + (1 - Math.abs(L.fade - .25) / .25) + ")"; x.fillRect(0, 0, 960, 540); }
    // mask the area outside a narrow room
    var z = zoneOf(L.hero.x + L.hero.w / 2); if (z.room) { var l = sx(z.x0), r = sx(z.x1); x.fillStyle = "#05070c"; if (l > 0) x.fillRect(0, 0, l, 540); if (r < 960) x.fillRect(r, 0, 960 - r, 540); }
    if (!sk.hud) hud(x, api);
    if (L.boss && L.boss.alive && L.locked) bossBar(x);
  }

  /* ---------------- World map ----------------
     Two pages (Worlds 1-4, Worlds 5-7). A challenge level sits above each world's boss and opens once the boss is beaten.
     The bottom panel has touch-friendly buttons: Play, Time attack, Skip (assist), Scientist and Remix lap. */
  var MAPCOL = ["#4ade80", "#7dd3fc", "#fb923c", "#a5b4fc", "#86efac", "#cbd5e1", "#c084fc"];
  var ORDER = (function () { var o = []; WD.forEach(function (w) { LV.forEach(function (lv, i) { if (lv.world === w.id && !lv.trial) o.push(i); }); LV.forEach(function (lv, i) { if (lv.world === w.id && lv.trial) o.push(i); }); }); return o; })();
  function pageOf(i) { return LV[i].world <= 4 ? 0 : 1; }
  function nodePos(i) {
    var lv = LV[i], pg = pageOf(i), wi = pg ? lv.world - 5 : lv.world - 1;
    if (lv.trial) { var bp = nodePos(LV.indexOf(bossOf(lv.world))); return { x: bp.x + 40, y: bp.y - 44 }; }
    var k = LV.filter(function (o, j) { return j < i && o.world === lv.world && !o.trial; }).length;
    return pg ? { x: 104 + wi * 300 + k * 38, y: 340 - k * 30 + (k % 2) * 30 } : { x: 72 + wi * 232 + k * 46, y: 330 - k * 42 + (k % 2) * 34 };
  }
  function islandX(w) { return w <= 4 ? 140 + (w - 1) * 232 : 196 + (w - 5) * 300; }
  function drawMap(x, api) {
    var t = S.mapT, pg = pageOf(S.sel), g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, pg ? "#140b2e" : "#0b2440"); g.addColorStop(1, pg ? "#2a1450" : "#103a5e"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    x.strokeStyle = "rgba(255,255,255,.06)"; x.lineWidth = 2; for (var wv = 0; wv < 12; wv++) { x.beginPath(); for (var sxp = 0; sxp <= 960; sxp += 20) x.lineTo(sxp, 150 + wv * 33 + Math.sin(sxp * .02 + t + wv) * 4); x.stroke(); }
    WD.forEach(function (w, i) { if ((w.id <= 4 ? 0 : 1) !== pg) return; var cx = islandX(w.id), cy = 300, rw = w.id <= 4 ? 112 : 140;
      x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.ellipse(cx, cy + 70, rw + 6, 40, 0, 0, 7); x.fill();
      x.fillStyle = MAPCOL[i]; x.beginPath(); x.ellipse(cx, cy + 40, rw, 120, 0, Math.PI * 1.02, Math.PI * 1.98); x.ellipse(cx, cy + 46, rw, 40, 0, 0, Math.PI); x.fill();
      x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.ellipse(cx - 30, cy - 30, 40, 18, -.3, 0, 7); x.fill();
      x.fillStyle = "#fff"; x.font = "800 15px system-ui"; x.textAlign = "center"; x.fillText("World " + w.id, cx, 150); x.font = "700 13px system-ui"; x.fillStyle = "#cbd5e1"; x.fillText(w.name, cx, 167);
      if (w.id === 4 && !save.done["4-4"]) A.drawHead(x, A.VILLAIN, cx + 70, cy - 70 + Math.sin(t * 2) * 4, 16, -1, { mood: "fight" });
      if (w.id === 7) A.drawHead(x, A.VILLAIN, cx + 90, cy - 80 + Math.sin(t * 2) * 4, 18, -1, { mood: save.done["7-6"] ? "sad" : "fight" });
    });
    x.lineWidth = 4; x.setLineDash([2, 8]); x.lineCap = "round";
    for (var i = 1; i < LV.length; i++) { var lv0 = LV[i - 1], lv1 = LV[i]; if (lv1.trial || lv0.trial || pageOf(i) !== pg || pageOf(i - 1) !== pg) continue; var a = nodePos(i - 1), b = nodePos(i); x.strokeStyle = unlocked(i) ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.2)"; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
    LV.forEach(function (lv, j) { if (pageOf(j) !== pg) return;
      if (lv.trial) { var bp = nodePos(LV.indexOf(bossOf(lv.world))), tp = nodePos(j); x.strokeStyle = unlocked(j) ? "#fbbf24" : "rgba(251,191,36,.25)"; x.beginPath(); x.moveTo(bp.x, bp.y); x.lineTo(tp.x, tp.y); x.stroke(); }
      if (lv.secret && save.secrets[lv.id]) { var bi = LV.indexOf(bossOf(lv.world)), a2 = nodePos(j), b2 = nodePos(bi); x.strokeStyle = "#c4b5fd"; x.beginPath(); x.moveTo(a2.x, a2.y); x.quadraticCurveTo((a2.x + b2.x) / 2, a2.y - 60, b2.x, b2.y); x.stroke(); } });
    x.setLineDash([]);
    LV.forEach(function (lv, j) {
      if (pageOf(j) !== pg) return;
      var p = nodePos(j), open = unlocked(j), done = save.done[lv.id], sel = j === S.sel, R = lv.boss ? 19 : lv.trial ? 16 : 15;
      if (sel) { x.strokeStyle = "rgba(255,255,255," + (.5 + .5 * Math.sin(t * 5)) + ")"; x.lineWidth = 3; x.beginPath(); x.arc(p.x, p.y, R + 7, 0, 7); x.stroke(); }
      x.fillStyle = !open ? "#334155" : done && done.skipped ? "#94a3b8" : done ? "#facc15" : lv.boss ? "#a855f7" : lv.trial ? "#fb923c" : "#f8fafc"; x.beginPath(); x.arc(p.x, p.y, R, 0, 7); x.fill();
      x.strokeStyle = lv.trial ? "#fbbf24" : "rgba(0,0,0,.4)"; x.lineWidth = 2; x.stroke();
      x.fillStyle = !open ? "#94a3b8" : "#0f172a"; x.font = "800 " + (lv.boss ? 13 : 12) + "px system-ui"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(open ? (lv.boss ? "B" : lv.trial ? "★" : lv.id.split("-")[1]) : "🔒", p.x, p.y + 1);
      var got = save.shards[lv.id] || []; for (var s3 = 0; s3 < 3; s3++) { x.fillStyle = got[s3] ? "#a78bfa" : "rgba(255,255,255,.15)"; x.fillRect(p.x - 10 + s3 * 8, p.y + R + 4, 5, 5); }
      if (save.secrets[lv.id]) { x.fillStyle = "#c4b5fd"; x.font = "900 14px system-ui"; x.fillText("★", p.x + R, p.y - R); }
      if (save.best[lv.id]) { x.fillStyle = "#7ef0ff"; x.font = "800 10px system-ui"; x.fillText("⏱", p.x - R, p.y - R); }
    });
    x.textBaseline = "alphabetic";
    var hp = nodePos(S.sel); A.drawHead(x, who(), hp.x, hp.y - 40 + (api.reduce ? 0 : Math.sin(t * 4) * 4), 15, 1, { mood: "happy" });
    x.fillStyle = "#fff"; x.font = "900 40px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("KINETIC KINGDOM", 480, 56);
    x.fillStyle = "#93c5fd"; x.font = "700 14px system-ui"; x.fillText("Completion " + completion() + "%  ·  fragments " + shardTotal() + " / " + (LV.length * 3) + (save.lap > 1 ? "  ·  remix lap " + save.lap : ""), 480, 82);
    // page tabs
    S.btns = [];
    [["◀ Worlds 1–4", 20, 0], ["Worlds 5–7 ▶", 790, 1]].forEach(function (tb) { var on = pg === tb[2]; x.fillStyle = on ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.08)"; rr(x, tb[1], 96, 150, 32, 9); x.fill(); x.fillStyle = on ? "#fff" : "#cbd5e1"; x.font = "800 14px system-ui"; x.fillText(tb[0], tb[1] + 75, 117); S.btns.push({ x: tb[1], y: 96, w: 150, h: 32, act: "page" + tb[2] }); });
    var lv = LV[S.sel], d = save.done[lv.id], open = unlocked(S.sel);
    x.fillStyle = "rgba(4,12,18,.84)"; rr(x, 100, 420, 760, 110, 14); x.fill();
    x.fillStyle = "#fff"; x.font = "800 19px system-ui"; x.fillText(lv.id + "  " + lv.name + (lv.boss ? "  (boss)" : ""), 480, 446);
    x.font = "600 13px system-ui"; x.fillStyle = "#cbd5e1";
    x.fillText(open ? (d ? (d.skipped ? "Skipped" : "Cleared · best " + d.best.toLocaleString()) + " · fragments " + (save.shards[lv.id] || []).filter(Boolean).length + "/3" + (save.best[lv.id] ? " · time attack " + fmtT(save.best[lv.id]) + " s" : "") + (lv.secret ? (save.secrets[lv.id] ? " · secret exit found" : " · has a secret exit") : "") : "Not cleared yet" + (lv.secret ? " · this level hides a secret exit" : "")) : lv.trial ? "Locked: beat " + bossOf(lv.world).name + " to open this challenge." : "Locked: clear the level before it.", 480, 468);
    // buttons
    var bl = [];
    if (open) bl.push(["Play", "play", true]);
    if (open && d && !d.skipped && !lv.boss) bl.push(["Time attack", "attack"]);
    if (canSkip(S.sel)) bl.push(["Skip level", "skip"]);
    bl.push(["Scientist", "pick"]);
    if (save.lapMax > 1) bl.push(["Lap " + save.lap + " ↻", "lap"]);
    var bw = 130, gap = 10, tw = bl.length * bw + (bl.length - 1) * gap, bx = 480 - tw / 2;
    bl.forEach(function (b, k) { var X = bx + k * (bw + gap); x.fillStyle = b[2] ? "#22c55e" : "rgba(255,255,255,.14)"; rr(x, X, 482, bw, 38, 10); x.fill(); x.fillStyle = b[2] ? "#052e16" : "#fff"; x.font = "800 15px system-ui"; x.fillText(b[0], X + bw / 2, 506); S.btns.push({ x: X, y: 482, w: bw, h: 38, act: b[1] }); });
  }
  function mapGo(api, j) { if (j === S.sel || j < 0) return; S.sel = j; api.sound.sfx("click"); mapMusic(api); }
  function mapAct(api, act) {
    if (act === "play") { if (unlocked(S.sel)) startLevel(api, S.sel); }
    else if (act === "attack") startLevel(api, S.sel, "attack");
    else if (act === "skip") skipLevel(api, S.sel);
    else if (act === "pick") pickChar(api);
    else if (act === "lap") { save.lap = save.lap % save.lapMax + 1; persist(); api.sound.sfx("click"); }
    else if (act === "page0" || act === "page1") { var want = act === "page1" ? 1 : 0; if (pageOf(S.sel) !== want) { var cand = ORDER.filter(function (j) { return pageOf(j) === want && unlocked(j) && !LV[j].trial; }); mapGo(api, cand.length ? cand[cand.length - 1] : ORDER.filter(function (j) { return pageOf(j) === want; })[0]); } }
  }
  function mapStep(dt, api) {
    if (api.overlayOpen()) return;
    var k = ORDER.indexOf(S.sel), j;
    if (api.hit("left")) for (j = k - 1; j >= 0; j--) { if (unlocked(ORDER[j]) || !LV[ORDER[j]].trial) { if (unlocked(ORDER[j])) mapGo(api, ORDER[j]); break; } }
    if (api.hit("right")) for (j = k + 1; j < ORDER.length; j++) { if (unlocked(ORDER[j])) { mapGo(api, ORDER[j]); break; } if (!LV[ORDER[j]].trial) break; }
    if (api.hit("jump") || api.hit("up")) mapAct(api, "play");
    if (api.hit("down")) { var d = save.done[LV[S.sel].id]; if (d && !d.skipped && !LV[S.sel].boss) mapAct(api, "attack"); }
    if (api.hit("run")) pickChar(api);
  }
  function mapMusic(api) { api.music(songFor(WD[LV[S.sel].world - 1].song)); }
  function toMap(api) { S.mode = "map"; L = null; mapMusic(api); save.sel = S.sel; persist(); setPanel(api); }
  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["8f6cfa6b0dc26df145194ef93a74562fa81b570c9dd343c1f90a59aa31c7fdd9","7a1034817a380d631bc19e460e91f739985469b53bd5706354768034fed660a7"],"god":["df56d53a2af04fcef84c04f3ea9fcea78cfce10dcbc54b158cdd9aeb30cd2c92","be1b891a4eeb51067c739fb3caee6ca4bc4dfe772442e97942e43f9794fb3e56"],"lives":["237e027d46551518f7a240444eb13eb7af1a5aa1d33ff525a56ee1b6c4f7a28b","d7886c11aa27237d74847acb598301b9ab7fb5c2d7d9d7c360c1c39e376b8477"],"time":["7a7b7d2eb2a77ba72361d28d51a2ab212588533d6ab086406b614b1e20dcadc0","27d4291944c0e046ff16c46de52ccf6e0d913e9e0784ff22c5063b0f0e2e1d93"],"unlock":["14f5af216f7ba611db6d7e91022bb66aceb86b7b4f22d36c2d483d2c813c1d46","0eb8b062bce167ba8da27bace486494093a8c3be7756177d0bbb511a396a1a4e"],"shield":["8ba433b73830cee25adb680ce28faf560e2874f57f5e834775e336f1d294c15e","96a3f39bb022f0d7fc0aa7a86799a4703276ddff4614c97abe952f8b188a1053"],"slow":["afe32a973ad468422d08d6050e812a5fd81267a4d15d20652e37c8649c92a17f","f2ba2a7eb95d61f8ef52aedd9e622078f5acc12d57ec790c4a8536928c962909"],"party":["e95127dfdbd3e5da26552f86be9577a5c9904304d47ca2a9bd5b672951e93ac7","9fa160e2b54a4f687d86117173b70d74348fb84e6908a5e8a44ae7e309964110"],"_combo":"0f6583687052a5484ffcf4e3485309219077e9fda44f5dcff8a76299d2a46a6a","_swipe":"df5014451d701bbd68c5b34e6951fd2abe3e2a6447379304732185187f81ac9a"}/*]CH*/, CT = {};
  function heroOn() { return !!(API && API.hero.active && save.who === "mib"); }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Clear this level", h: CH.skip, run: function () { if (L && L.hero && !L.clear && S.mode === "play") levelClear(api, { secret: false }); } },
      god: { label: "Cannot be hurt", h: CH.god, run: function () { CT.god = 1; } },
      lives: { label: "99 lives", h: CH.lives, run: function () { if (G) G.lives = 99; } },
      time: { label: "The clock never runs out", h: CH.time, run: function () { CT.time = 1; } },
      unlock: { label: "Every level open", h: CH.unlock, run: function () { CT.unlock = 1; } },
      shield: { label: "Shield for 30 s", h: CH.shield, run: function () { if (L && L.hero) L.hero.shield = 30; } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { toMap(api); } });
  }
  function startLevel(api, i, mode) { try { if (window.MIBPlay) MIBPlay.level(LV[i] ? LV[i].stage : i + 1); } catch (mibErr) {} /* MIB-Hub: play tracking */
    S.attack = mode === "attack";
    if (!G || S.attack) newSession();
    S.sel = i; save.sel = i; persist();
    var lv = LV[i], w = WD[lv.world - 1], first = LV.filter(function (o) { return o.world === lv.world; })[0] === lv;
    var go = function () { api.hide(); loadLevel(api, i, false); api.banner(S.attack ? "TIME ATTACK" : lv.id, { sub: lv.name, size: 90, dur: 1.8 }); };
    if (first && !lv.trial && !S.attack && !S["card" + w.id]) {
      S["card" + w.id] = true; S.mode = "card";
      api.show("<h2>World " + w.id + ": " + A.esc(w.name) + "</h2><p><b>" + A.esc(w.concept.title) + "</b></p><p>" + w.concept.body + "</p><p class='gm-small'>Kingdom scale: 1 tile = 1 m, g = 36 m/s². Watch the readouts at the bottom of the screen: every number is computed from the game's own physics.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Let's go</button></div>", function () { go(); });
      return;
    }
    go();
  }
  function charList() {
    var list = A.CAST.slice(); list.push(A.VILLAIN); if (API && API.hero && API.hero.active && A.byId.mib) list.push(A.byId.mib);
    return "<p><b>Each one has a different mount from the mount crates. Beat bosses to bring more scientists to the kingdom.</b></p><div class='gm-picks'>" + list.map(function (c) {
      var shopLock = c.guest && c.id !== "entropy" && c.id !== "mib" && !A.owns("char-" + c.id), lock = shopLock || !charOpen(c.id);
      var why = shopLock ? "300 coins in the shop" : CHAR_REQ[c.id] ? "Beat " + LV.filter(function (o) { return o.id === CHAR_REQ[c.id]; })[0].name : "";
      if (lock) return "<button type='button' class='gm-pick is-locked' data-act='locked' disabled aria-disabled='true'><canvas width='144' height='144' data-face='" + c.id + "'></canvas><b>" + A.esc(c.name.split(" ").pop()) + "</b><small>" + A.esc(why) + "</small></button>";
      return "<button type='button' class='gm-pick' data-act='pick' data-id='" + c.id + "' aria-pressed='" + (c.id === save.who) + "'><canvas width='144' height='144' data-face='" + c.id + "'></canvas><b>" + A.esc(c.name.split(" ").pop()) + "</b><small>" + A.esc(c.special || (c.id === "entropy" ? "The villain himself" : "")) + "</small></button>";
    }).join("") + "</div>";
  }
  function pickChar(api) {
    S.mode = "pick";
    api.show("<h2>Choose your scientist</h2>" + charList() + "<div data-note>" + mountNote(save.who) + "</div><p class='gm-small'>Abilities: " + ABIL.map(function (a) { return (abilities()[a[0]] ? "✓ " : "🔒 ") + a[2]; }).join(" · ") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='done'>To the map</button></div>",
      function (a, el) {
        if (a === "pick") { save.who = el.getAttribute("data-id"); save.chars[save.who] = true; persist(); [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); }); var n = document.querySelector("[data-gm-overlay] [data-note]"); if (n) n.innerHTML = mountNote(save.who); }
        if (a === "done") { api.hide(); toMap(api); }
      });
    A.paintFaces(document.querySelector("[data-gm-overlay]"));
  }
  function mountNote(id) { var c = A.byId[id] || A.byId.newton, m = MOUNTS[id] || MOUNTS.newton; return A.card(c) + "<p class='gm-small'><b>Mount:</b> " + A.esc(m.name) + ". " + A.esc(m.ability) + " Mass " + c.mass + " kg (used in every energy readout).</p>"; }
  function title(api) {
    S.mode = "title";
    api.show("<h2>Kinetic Kingdom</h2><p>Count Entropy and his minions have scrambled the kingdom's seven lands. Run, jump and stomp your way through 41 levels (34 in the story, 7 challenges), ride your scientist's mount, earn new abilities from every boss, and read the physics of every move: jump heights, friction on ice, spring energy, swinging platforms, updrafts, gusts and moon gravity.</p>" +
      "<p class='gm-small'>Keyboard: ← → move · Space jump (hold for higher) · Shift run / throw / air dash · ↓ duck, ground-pound in mid-air, enter doors · H physics readouts. Map: ↓ time attack. Phones: on-screen buttons (move or resize them in Settings). Assists (extra hearts, game speed, skipping a level) are in Settings.</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='map'>Play</button><button class='gm-btn' data-act='pick'>Choose scientist</button></div>",
      function (a) { api.hide(); if (a === "pick") pickChar(api); else toMap(api); });
  }
  function setPanel(api) {
    var lv = L && L.lv, w = lv ? WD[lv.world - 1] : null;
    api.panel(
      (w ? "<p><b>World " + w.id + ": " + A.esc(w.concept.title) + ".</b> " + w.concept.body + "</p>" : "") +
      "<p>Every jump is a projectile. Take-off speed v₀ = " + P.JUMP_V + " m/s walking and " + P.JUMP_RUN_V + " m/s at a full run:</p><table>" +
      "<tr><td>Highest point</td><td><span class='gm-eq'>h = v₀²/2g</span> = " + fx(P.maxHeight(P.JUMP_V)) + " m walking, " + fx(P.maxHeight(P.JUMP_RUN_V)) + " m running</td></tr>" +
      "<tr><td>Time in the air</td><td><span class='gm-eq'>t = 2v₀/g</span> = " + fx(P.flightTime(P.JUMP_RUN_V)) + " s (running)</td></tr>" +
      "<tr><td>Longest running jump</td><td><span class='gm-eq'>d = v<sub>x</sub>·t</span> = " + P.RUN + " × " + fx(P.flightTime(P.JUMP_RUN_V)) + " = " + fx(P.RUN * P.flightTime(P.JUMP_RUN_V)) + " m</td></tr>" +
      "<tr><td>Friction</td><td><span class='gm-eq'>a<sub>max</sub> = μg</span>: grass μ = " + P.MU + " (" + fx(P.MU * P.G) + " m/s²), ice μ = " + P.MU_ICE + " (" + fx(P.MU_ICE * P.G) + " m/s²)</td></tr>" +
      "<tr><td>Springs</td><td><span class='gm-eq'>F = kx</span>, stored energy <span class='gm-eq'>½kx² = ½mv²</span>; pads launch at " + P.SPRING_V + " m/s</td></tr>" +
      "<tr><td>Swings and spinners</td><td><span class='gm-eq'>a = v²/r</span>, <span class='gm-eq'>v = ωr</span>, pendulum period <span class='gm-eq'>T = 2π√(L/g)</span></td></tr>" +
      "<tr><td>Updrafts and gusts</td><td><span class='gm-eq'>ΣF = ma</span>: a fan pushes up with " + P.UP_A + " m/s² against g, so you rise until you reach " + P.UP_MAX + " m/s; gusts add " + P.GUST_A + " m/s² sideways</td></tr>" +
      "<tr><td>Moon gravity</td><td><span class='gm-eq'>w = mg</span>: World 6 has g = " + fx(P.G * .55) + " m/s², so a running jump rises " + fx(P.JUMP_RUN_V * P.JUMP_RUN_V / (2 * P.G * .55)) + " m</td></tr></table>" +
      "<p class='gm-small'>Model and scale: 1 tile = 1 m (40 px). The kingdom's gravity is g = " + P.G + " m/s², about 3.7 × Earth's 9.8 m/s², so jumps feel snappy; the readouts also show what the same jump would do on Earth. Air drag is modelled only as a top fall speed of " + P.MAX_FALL + " m/s. Steering in mid-air, coyote time and jump buffering are game allowances, not real physics. Mount abilities, the inertia shield and Count Entropy's powers are labelled game metaphors. Courses: PHYS 111 Mechanics (kinematics, projectiles, friction, work–energy, circular motion).</p>",
      "<table><tr><td>Move</td><td>← → or A D</td></tr><tr><td>Jump (hold = higher)</td><td>Space / K / Z</td></tr><tr><td>Run · throw EMP · mount power</td><td>Shift / J / X, or double-tap a direction</td></tr>" +
      "<tr><td>Duck · ground-pound (in the air)</td><td>↓ / S</td></tr><tr><td>Drop through a ledge</td><td>↓ + Jump</td></tr><tr><td>Enter a door</td><td>↑ or ↓ in front of it</td></tr><tr><td>Wall jump</td><td>Jump while sliding down a wall</td></tr><tr><td>Physics readouts on/off</td><td>H</td></tr><tr><td>Air dash (after World 1)</td><td>Run in mid-air</td></tr><tr><td>Cape glide (after World 2)</td><td>Hold Jump while falling</td></tr><tr><td>Double jump (after World 4)</td><td>Jump in mid-air</td></tr></table>" +
      "<p class='gm-small'>Phones: ◀ ▶ ▼ on the left, jump and run on the right. Drag them anywhere in Settings → Phone buttons. 100 coins = an extra life; each level hides 3 formula fragments.</p>");
  }

  /* ---------------- Game object ---------------- */
  var game = {
    song: songFor(MAP_SONG), savePrefix: ["ee-arcade-kk"],
    actions: [
      { id: "left", label: "Move left", keys: ["ArrowLeft", "KeyA"], touch: { label: "◀", x: 8, y: 80 } },
      { id: "right", label: "Move right", keys: ["ArrowRight", "KeyD"], touch: { label: "▶", x: 23, y: 80 } },
      { id: "down", label: "Duck / ground-pound / door", keys: ["ArrowDown", "KeyS"], touch: { label: "▼", x: 15.5, y: 90 } },
      { id: "up", label: "Enter a door", keys: ["ArrowUp", "KeyW"] },
      { id: "jump", label: "Jump", keys: ["Space", "KeyK", "KeyZ"], touch: { label: "⤒", x: 91, y: 78 } },
      { id: "run", label: "Run / throw / mount power", keys: ["ShiftLeft", "KeyJ", "KeyX"], touch: { label: "⚡", x: 78, y: 86 } },
      { id: "info", label: "Physics readouts on/off", keys: ["KeyH"] }
    ],
    init: function (api) {
      API = api; setupCheats(api); newSession(); api.useActions(["left", "right", "down", "jump", "run"]); setPanel(api);
      if (api.settings && api.settings.add) {
        api.settings.add({ id: "kkReadouts", tab: "gameplay", section: "Kinetic Kingdom", label: "Physics readouts", type: "toggle", default: save.hud !== false, help: "The one-line physics notes at the bottom of the screen (H).", apply: function (v) { save.hud = !!v; persist(); } });
        api.settings.add({ id: "kkGhost", tab: "gameplay", section: "Kinetic Kingdom", label: "Ghost in time attack", type: "toggle", default: true, help: "Race a replay of your best run." });
        api.settings.add({ id: "kkHearts", tab: "access", section: "Kinetic Kingdom assists", label: "Extra hearts", type: "toggle", default: false, help: "Every life starts with two spare hits." });
        api.settings.add({ id: "kkSkip", tab: "access", section: "Kinetic Kingdom assists", label: "Offer to skip a hard level", type: "choice", default: "5", choices: [["0", "Never"], ["3", "After 3 tries"], ["5", "After 5 tries"], ["8", "After 8 tries"]], help: "A skipped level opens the next one but earns no coins or badge. Game speed is under Accessibility." });
      }
      S.mode = "map"; title(api);
    },
    update: function (dt, api) {
      if (api.hero.inUse !== heroOn()) api.hero.use(heroOn()); if (heroOn() && G) G.lives = Math.max(G.lives, 9);
      S.mapT += dt;
      if (api.hit("info")) { save.hud = !save.hud; persist(); if (api.settings && api.settings.set) api.settings.set("kkReadouts", save.hud); }
      if (S.mode === "map") return mapStep(dt, api);
      if (S.mode !== "play" || !L || api.overlayOpen()) return;
      play(dt, api);
    },
    draw: function (api) { if (L && (S.mode === "play" || S.mode === "over")) drawPlay(api.x, api); else drawMap(api.x, api); },
    click: function (px, py, api) {
      if (S.mode !== "map" || api.overlayOpen()) return;
      var bt = (S.btns || []).filter(function (b) { return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h; })[0]; if (bt) { mapAct(api, bt.act); return; }
      var pg = pageOf(S.sel);
      for (var i = 0; i < LV.length; i++) { if (pageOf(i) !== pg) continue; var p = nodePos(i); if ((px - p.x) * (px - p.x) + (py - p.y) * (py - p.y) < 28 * 28) { if (!unlocked(i)) { api.sound.sfx("block"); return; } if (S.sel === i) startLevel(api, i); else mapGo(api, i); return; } }
    },
    menu: function (api) { api.hide(); toMap(api); }
  };
  A.run(game);
  window.KineticKingdom = { S: S, get L() { return L; }, get G() { return G; }, startLevel: function (i, mode) { startLevel(API, i, mode); }, completion: completion, abilities: abilities, mapAct: function (a) { mapAct(API, a); }, unlocked: unlocked, charOpen: charOpen, who: function () { return who(); },
    bossVulnerable: function () { return !!(L && L.boss && L.boss.alive && L.locked && bossVulnerable(L.boss)); }, debugClear: function (secret) { levelClear(API, { secret: !!secret }); }, newSession: newSession, toMap: function () { toMap(API); }, save: save, MOUNTS: MOUNTS, LV: LV, dbg: DBG,
    debugGive: function (k) { powerUp(API, k, L.hero.x, L.hero.y); } };
})();
