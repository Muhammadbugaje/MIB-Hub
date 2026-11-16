/* Momentum Cup v3: scientist head-football (PHYS 111: projectiles, collisions, Newton's laws).
 * Model, in SI units: g = 9.8 m/s², no air drag or spin, ball–turf restitution 0.7 (0.78 wet, 0.55 snow), players far
 * heavier than the ball, rolling slow-down 0.8 m/s² (less when wet, more in snow). 1 m = 55 px on screen.
 * Superpowers are labelled game metaphors for real ideas, not claims about the scientists. */
(function () {
  "use strict";
  var A = window.Arcade, PX = 55, GY = 470, G = 9.8, WM = 960 / PX, GW = 1.35, GH = 2.55, BR = 0.24, HR = 0.62;
  var DRIVE = 25, LOB = 55, KICK_V = 12.5, VMAX = 30, VP = [480, 150];
  function deg(d) { return d * Math.PI / 180; }
  function sx(m) { return m * PX; } function sy(m) { return GY - m * PX; }
  var S = { mode: "menu", state: "menu" };

  /* ---------- arenas ---------- */
  var ARENAS = [
    { id: "campus", name: "Campus Pitch", sky: ["#6fb7ff", "#cfe8ff"], night: false, turf: ["#2f9a52", "#36aa5b"], crowd: .55, cols: ["#3dd68c", "#f6c445", "#ffffff"], song: [301, "afro"], free: true },
    { id: "night", name: "Floodlight Night", sky: ["#061226", "#123056"], night: true, turf: ["#1e8a4c", "#23994f"], crowd: .8, cols: ["#7ef0ff", "#ff6b9a", "#f6c445"], song: [302, "synthwave"], free: true },
    { id: "sunset", name: "Sunset Bowl", sky: ["#3b1d3f", "#ff9a62"], night: false, turf: ["#3a8a3f", "#43984a"], crowd: .75, cols: ["#ff9d5c", "#f6c445", "#ffffff"], song: [303, "amapiano"], price: 150 },
    { id: "rain", name: "Rainy Derby", sky: ["#29343f", "#5d6b78"], night: false, turf: ["#23774a", "#288553"], crowd: .7, cols: ["#9fb6c8", "#3dd68c", "#ffffff"], song: [304, "dub"], weather: "rain", price: 200 },
    { id: "snow", name: "Snow Classic", sky: ["#9fb4c8", "#e6eef5"], night: false, turf: ["#d8e6ef", "#e7f0f6"], crowd: .65, cols: ["#d62828", "#ffffff", "#1f6fb2"], song: [305, "march"], weather: "snow", price: 250 },
    { id: "grand", name: "Grand Volt Arena", sky: ["#0b0b2a", "#2a1f6a"], night: true, turf: ["#1b8f55", "#21a060"], crowd: 1, cols: ["#f6c445", "#7ef0ff", "#a78bfa", "#ff6b9a"], song: [306, "anthem"], price: 400 },
    { id: "void", name: "Entropy's Void", sky: ["#12051f", "#3a0f52"], night: true, turf: ["#2a2240", "#322a4a"], crowd: .9, cols: ["#c084fc", "#ff3355", "#3d1f5c"], song: [307, "boss"], cupOnly: true }
  ];
  var AR = {}; ARENAS.forEach(function (a) { AR[a.id] = a; });
  function arenaOpen(a) { return CT.arenas || (API0 && API0.hero.active) || a.free || A.owns("arena-" + a.id) || (a.cupOnly && (A.store("cup-best") || 0) >= 6); }

  /* ---------- voices: each character has a pitch, vowel colour and speech settings ---------- */
  var VOICE = {
    newton: { id: "newton", f0: 112, formant: .98, speech: { pitch: .8, rate: .95, voice: "male", vi: 0 } },
    faraday: { id: "faraday", f0: 128, formant: 1.04, speech: { pitch: .95, rate: 1, voice: "male", vi: 1 } },
    curie: { id: "curie", f0: 235, formant: 1.2, speech: { pitch: 1.15, rate: 1.02, voice: "female", vi: 0 } },
    tesla: { id: "tesla", f0: 106, formant: .96, rasp: .25, speech: { pitch: .85, rate: .92, voice: "male", vi: 2 } },
    einstein: { id: "einstein", f0: 122, formant: 1, speech: { pitch: 1, rate: .88, voice: "male", vi: 3 } },
    bohr: { id: "bohr", f0: 96, formant: .92, speech: { pitch: .72, rate: .95, voice: "male", vi: 4 } },
    groove: { id: "groove", f0: 150, formant: 1.08, speech: { pitch: 1.18, rate: 1.12, voice: "male", vi: 5 } },
    kai: { id: "kai", f0: 140, formant: 1.1, speech: { pitch: 1.05, rate: 1.05, voice: "male", vi: 6 } },
    entropy: { id: "entropy", f0: 76, formant: .84, rasp: .7, gain: 1.1, speech: { pitch: .45, rate: .82, voice: "male", vi: 7 } }
  };

  /* ---------- superpowers: a cinematic intro, a lasting effect, and a power shot ---------- */
  var POWERS = {
    newton: { name: "Inertia Cannon", dur: 7, col: "#ff8a3d", shot: "fire", idea: "First law: with no net force the ball keeps a straight line. Third law: each cannon kick pushes Newton back just as hard." },
    faraday: { name: "Faraday Cage", dur: 7, col: "#7ef0ff", shot: "magnet", idea: "A Faraday cage is a conducting mesh that shields what is inside from electric fields. Here it shields the goal." },
    curie: { name: "Radium Glow", dur: 7, col: "#3dd68c", shot: "rad", idea: "Radioactive activity halves every half-life. Touch the glowing ball and you're slowed, recovering by half each second." },
    tesla: { name: "Tesla Coil", dur: 7, col: "#b9d8ff", shot: "bolt", idea: "A Tesla coil is a resonant transformer that makes voltages high enough to throw long sparks through air." },
    einstein: { name: "Time Dilation", dur: 6, col: "#8fb4ff", shot: "time", idea: "In relativity, moving clocks run slow. Here everyone else's clock runs at 35% while Einstein's runs normally." },
    bohr: { name: "Quantum Leap", dur: 7, col: "#c6b6ff", shot: "quantum", idea: "Electrons in Bohr's model jump between allowed levels with nothing in between. The power shot jumps, too." },
    groove: { name: "Low-Friction Glide", dur: 7, col: "#ff6bd6", shot: "disco", idea: "Friction f = μN. Shrink μ and the same push carries you much further." },
    kai: { name: "One-Inch Push", dur: 7, col: "#f6c445", shot: "shock", idea: "Impulse J = FΔt. A huge force over a tiny time still changes momentum a lot." },
    curve: { name: "Curve Shot", dur: 7, col: "#34d399", shot: "curve", idea: "A spinning ball bends in flight (the Magnus effect): air pressure is lower on the side spinning with the airflow." },
    well: { name: "Gravity Well", dur: 6, col: "#818cf8", shot: "fire", idea: "Gravity pulls every mass toward every other. Here a tiny 'well' at your feet tugs the loose ball in: a game metaphor." },
    dash: { name: "Lightning Dash", dur: 7, col: "#facc15", shot: "bolt", idea: "Power is work per second, P = Fv. More power means the same push at a higher speed." },
    magnet: { name: "Magnetic Dribble", dur: 7, col: "#f472b6", shot: "magnet", idea: "Opposite poles attract and the force grows quickly as they get closer: the ball stays glued to your boot." },
    entropy: { name: "Disorder Storm", dur: 6, col: "#c084fc", shot: "chaos", idea: "Entropy measures disorder. This storm scatters the ball's direction: a story effect, not real thermodynamics." }
  };
  var ITEMS = [
    { id: "bighead", label: "Big head", col: "#f6c445", dur: 8 }, { id: "boots", label: "Speed boots", col: "#7ef0ff", dur: 8 },
    { id: "freeze", label: "Freeze rival", col: "#9fe8ff", dur: 2.2 }, { id: "power", label: "Power +50%", col: "#a78bfa", dur: 0 },
    { id: "superkick", label: "Super kick", col: "#ff6b9a", dur: 8 }
  ];

  function player(c, side, cpu, skill) {
    if (!cpu) c = A.styled(c);
    var key = c.pw || c.id, P0 = POWERS[key] || POWERS.newton, P = c.powerName ? Object.assign({}, P0, { name: c.powerName, idea: c.powerIdea || P0.idea }) : P0;
    return { c: c, P: P, pk: key, v: VOICE[c.voice || c.id] || VOICE.newton, side: side, imm: 0, face: side ? -1 : 1, x: side ? WM - 3.4 : 3.4, y: 0, vx: 0, vy: 0, cpu: cpu, skill: skill || 0,
      leg: 0, kcool: 0, meter: 0, power: 0, powerMax: 1, fx: {}, react: 0, daze: 0, stun: 0, ko: 0, bleed: 0, dash: 0, dashCool: 0, hurt: 0, goals: 0,
      wobble: 0, mouth: 0, expr: "", jumpBuf: 0, coyote: 0, celebrate: 0, shots: 0, breath: Math.random() * 6 };
  }
  function pw(p) { return p ? p.pk || p.c.pw || p.c.id : ""; }
  function zm(api, a, b, c) { if (!S.camStatic) api.zoom(a, b, c); }
  function comment(t) { if (S.commOn) S.comm = { t: t, life: 3 }; }
  function speak(api, p, kind, words) {
    api.sound.voice(p.v, kind); p.mouth = kind === "ko" || kind === "sad" || kind === "power" || kind === "win" ? .7 : .35; p.expr = kind === "hurt" || kind === "ko" ? "hurt" : "";
    if (words) api.sound.say(words, p.v.speech);
  }

  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["6721aeb34698401b80e69e2b8c007700fbc35064222f6c0919f4154ff6a125df","6a070ea89b433dfbaa1337e828e3e04f559529065e97f1b52c762dc1f2385f48"],"goal":["e4cc34e1fb82fc103217ef6badaa55e810fa9a995a3c77d64992f214b151d1e2","5f5af1b53707ff218809ab976134947516870d3fd0177f1483c1c3f23f4509a3"],"power":["2ffd23ccf49bc88f33d2bf6209301ea081440c0b0c2dc1f724323559d28652ac","f267b3cae0d514e98fef0424043cc3b4367a8093534fe85d68f8211da1c8d28c"],"wall":["98c4892efa5cfcdbb211876ac9512242a220d3cb656aff989969273dfcb8e8f0","3c08969576975f9df47f6e176a53124d60eb7357444609cf001c9c6cbf28fd9b"],"freeze":["ce6d6213c3be2d0c57ecac581ba2d85c6543b80f80353130847ea3f4c5344540","49d25625e8f9d69b782295ce45d943c2d6fb3794cbce43b7bdf6d9089d914372"],"time":["7cb201667b61403bc5eeff41200fd9f66bca2e409d7e700e66402cc7390426b1","098bc7673b160b5e10a045df463726fdf0894f238e7a39eb0b3b65c867b69dea"],"arenas":["50610b7fea78a1e04421153471eafa1ec7ff138b8eb2fbe2f5aa9b428d2527bf","34537bee6b4bbb8b70ad6db89bca6b3884d9d8a009b23471e5de0093decabd09"],"coins":["c89b0961c037027f020f1b93ef0555394a85b5ec84d732af60e50898ba118d47","388465fc54a6a6473b104332c89e9216d98ddc42c74ce157f164acfbc0617ace"],"squad":["1fbb82ccb765fa9ac9d47c7ba3b7ccc29370a9182d3cffc5554859637f51fbc8","80ce0f7d374704360d88110b6d8f9f06d6d2046f332a875f9beb099786747e14"],"slow":["5fd77826a1ac37d3acb1f824d7ac858f602b388a38994dd2fa7e5725a0dbf4c6","2dd80dc3275fb3b337dbb686e372f6bd8417be2fa1d1729d41806818cada52c1"],"party":["ddaf658e2d5098a0a3c0139bd4abfa9fccb34970f74783d15999b778710e14fe","db9fc772bfcb20e4aa3c6735a81002677ea84d3983d18766f56c83fe78a96843"],"_combo":"ce89525099949a4102c6cbf7a1d88a3f9994156ef3ab3871283c451159889b42","_swipe":"16d1f6be77a3e89a608d2b07fe1146340c302b9cbd9099f170761bc135c36820"}/*]CH*/, CT = {}, API0 = null;
  function heroOn() { return !!(S.p && S.p[0] && S.p[0].c && S.p[0].c.id === "mib" && S.mode !== "duo" && S.mode !== "demo"); }
  function setupCheats(api) {
    API0 = api; POWERS.mib = Object.assign({}, POWERS.einstein, { name: "Maker's Mark" }); VOICE.mib = VOICE.einstein;
    function live() { return (S.mode === "cup" || S.mode === "quick" || S.mode === "career") && !S.over; }
    api.cheats({
      skip: { label: "Win this match", h: CH.skip, run: function () { if (!live()) return; S.score[0] = Math.max(S.score[0], S.score[1] + 1); S.golden = false; S.time = .01; if (S.state !== "play") { S.state = "play"; S.ball.hold = false; } } },
      goal: { label: "Free goal", h: CH.goal, run: function () { if (live()) S.score[0]++; } },
      power: { label: "Superpower always ready", h: CH.power, run: function () { CT.power = 1; } },
      wall: { label: "Your goal is sealed", h: CH.wall, run: function () { CT.wall = 1; } },
      freeze: { label: "Rival frozen for 8 s", h: CH.freeze, run: function () { if (S.p && S.p[1]) S.p[1].stun = 8; } },
      time: { label: "+30 seconds", h: CH.time, run: function () { if (isFinite(S.time)) S.time += 30; } },
      arenas: { label: "Every arena open", h: CH.arenas, run: function () { CT.arenas = 1; } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      coins: { label: "+5,000 career coins", h: CH.coins, run: function () { var P = CUI.load(); if (P) { P.coins += 5000; A.store("kick-career", P); } } },
      squad: { label: "Every non-legend player signed", h: CH.squad, run: function () { var P = CUI.load(), MC = window.MomentumCareer; if (P && MC) { MC.PLAYERS.forEach(function (q) { if (q.rarity !== "legendary" && !P.roster[q.id]) P.roster[q.id] = { lvl: 1 }; }); A.store("kick-career", P); } } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { menu(api); } });
  }

  function resetPositions(toss) {
    S.p.forEach(function (p) { if (!p) return; p.x = p.side ? WM - 3.4 : 3.4; p.y = 0; p.vx = p.vy = 0; p.stun = 0; p.ko = 0; p.dash = 0; p.celebrate = 0; p.expr = ""; p.fx.freeze = 0; });
    S.ball = { x: WM / 2, y: 2.7, vx: 0, vy: 0, spin: 0, squash: 0, sqv: 0, nx: 0, ny: 1, trail: [], photon: 0, glow: 0, shot: null, hold: true };
    S.toss = toss == null ? (Math.random() < .5 ? 0 : 1) : toss; S.lastTouch = null; S.item = null; S.itemT = 12;
  }
  function releaseBall() { var b = S.ball; b.hold = false; b.vx = (S.toss === 0 ? -1 : 1) * 2.4; b.vy = 2.2; } // tossed towards the side that conceded

  function newMatch(a, b, mode, o) {
    o = o || {}; if (API0 && mode !== "demo") API0.hero.use(!!(a && a.c && a.c.id === "mib" && mode !== "duo"));
    S.matchId = (S.matchId || 0) + 1; S.mode = mode; S.round = o.round || 0; S.p = [a, b]; S.score = [0, 0]; S.time = mode === "tut" ? Infinity : (o.len || 75);
    S.arena = o.arena || AR.campus; S.golden = false; S.excite = .3; S.hintT = 6; S.hint = null; S.lastScorer = null; S.goalLog = [];
    S.stats = { longest: 0, headers: 0, kicks: 0, lob: 0, drive: 0, shots: 0 }; S.over = false; S.post = null; S.len = S.time; S.halfDone = false; S.apple = null; S.ray = null; S.bolts = []; S.ghost = null; S.flash = null; resetPositions(null);
    S.state = "kickoff"; S.stateT = 1.3;
    // match modifiers (career events and the Legends ladder) and per-player options
    var MD = window.MomentumCareer ? window.MomentumCareer.MODS : {}, mods = o.mods || [], opt = o.opt || {};
    S.mods = mods; S.g = G; S.wind = 0; S.kickMul = 1; BR = .24; S.drawOK = !!o.draws; S.fixture = o.fixture || null;
    mods.forEach(function (m) { var d = MD[m]; if (!d) return; if (d.g) S.g = G * d.g; if (d.ball) BR = .24 * d.ball; if (d.wind) S.wind = d.wind * (Math.random() < .5 ? -1 : 1); if (d.kick) S.kickMul = d.kick; if (d.len && isFinite(S.time)) S.time = Math.round(S.time * d.len); if (d.golden) S.goldenStart = true; });
    S.len = S.time; S.noPowers = opt.powers === false; S.assist = opt.assists !== false; S.camStatic = opt.camera === "static"; S.comm = null; S.commOn = opt.commentary !== false && mode === "career";
    if (S.goldenStart) { S.golden = true; S.goldenStart = false; }
    if (mode === "tut") { S.p[1] = null; S.tut = 0; S.state = "play"; S.ball.hold = false; S.ball.x = 6; }
    S.weather = []; buildCrowd(); buildNets(); S.bg = null; S.crowdCv = null; S.front = null;
    S.api && S.api.music(A.song(S.arena.song[0], S.arena.song[1]));
  }

  /* ---------- crowd ---------- */
  function buildCrowd() {
    var r = A.rng(S.arena.song[0]), a = S.arena; S.crowd = [];
    for (var row = 0; row < 7; row++) {
      var y = 132 + row * 22, sc = .55 + row * .08, n = Math.floor((960 / (16 * sc)));
      for (var i = 0; i < n; i++) { if (r() > .2 + a.crowd * .8) continue; var x = (i + r() * .8) * 960 / n;
        S.crowd.push({ x: x, y: y + (r() - .5) * 5, s: sc * (.82 + r() * .36), side: x < 480 ? 0 : 1, col: a.cols[Math.floor(r() * a.cols.length)], skin: ["#5a3a22", "#8d5a3b", "#c68642", "#e8c193", "#f1c9a5"][Math.floor(r() * 5)], ph: r() * 6, flag: r() < .05, mood: 0, moodT: 0 }); }
    }
  }
  function crowdReact(side, mood, secs) { S.crowd.forEach(function (f) { if (side == null || f.side === side) { f.mood = mood; f.moodT = (secs || 3) + Math.random(); } }); }

  /* ---------- nets: spring cloth on the back (outer) net ---------- */
  var NC = 7, NR = 9;
  function buildNets() { S.nets = [0, 1].map(function () { var a = []; for (var i = 0; i < NC * NR; i++) a.push({ o: 0, v: 0 }); return a; }); }
  function netPoke(side, by, depth, speed) { // by: ball height (m); depth 0..1 across the net; speed: how hard
    var net = S.nets[side];
    for (var c = 0; c < NC; c++) for (var r = 0; r < NR; r++) { var py = (r + .5) / NR * GH, pz = (c + .5) / NC, d = Math.hypot((py - by) / GH * 1.6, pz - depth);
      if (d < .45) net[r * NC + c].v += speed * (1 - d / .45) * 28; }
  }
  function netStep(dt) {
    S.nets.forEach(function (net) {
      for (var r = 0; r < NR; r++) for (var c = 0; c < NC; c++) { var p = net[r * NC + c], s = 0, n = 0;
        [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]].forEach(function (q) { if (q[0] >= 0 && q[0] < NC && q[1] >= 0 && q[1] < NR) { s += net[q[1] * NC + q[0]].o; n++; } });
        p.v += (-70 * p.o + 50 * (s / n - p.o)) * dt - p.v * 3.2 * dt; }
      var mx = 0; net.forEach(function (p) { p.o = Math.max(-4, Math.min(30, p.o + p.v * dt)); mx = Math.max(mx, Math.abs(p.o), Math.abs(p.v) * .05); }); net.live = mx > .4;
    });
  }

  /* ---------- actions ---------- */
  var ACTIONS = [
    { id: "left", label: "Move left (double-tap to dash)", keys: ["KeyA"], touch: { label: "◀", x: 8, y: 90, s: .85 } },
    { id: "right", label: "Move right (double-tap to dash)", keys: ["KeyD"], touch: { label: "▶", x: 22, y: 90, s: .85 } },
    { id: "jump", label: "Jump", keys: ["KeyW"], touch: { label: "⤒", x: 64, y: 90, s: .85 } },
    { id: "kick", label: "Low kick (25°)", keys: ["KeyS"], touch: { label: "K", x: 78, y: 90, s: .85 } },
    { id: "lob", label: "Lob (55°)", keys: ["KeyQ"], touch: { label: "L", x: 92, y: 90, s: .85 } },
    { id: "dash", label: "Dash", keys: ["ShiftLeft"], touch: { label: "»", x: 36, y: 90, s: .85 } },
    { id: "power", label: "Superpower", keys: ["KeyE"], touch: { label: "★", x: 92, y: 77, s: .85 } },
    { id: "p2left", label: "Player 2 left", keys: ["ArrowLeft"], touch: { label: "◀", x: 8, y: 10, s: .85 } },
    { id: "p2right", label: "Player 2 right", keys: ["ArrowRight"], touch: { label: "▶", x: 22, y: 10, s: .85 } },
    { id: "p2jump", label: "Player 2 jump", keys: ["ArrowUp"], touch: { label: "⤒", x: 64, y: 10, s: .85 } },
    { id: "p2kick", label: "Player 2 kick", keys: ["ArrowDown"], touch: { label: "K", x: 78, y: 10, s: .85 } },
    { id: "p2lob", label: "Player 2 lob", keys: ["Slash"], touch: { label: "L", x: 92, y: 10, s: .85 } },
    { id: "p2dash", label: "Player 2 dash", keys: ["ShiftRight"], touch: { label: "»", x: 36, y: 10, s: .85 } },
    { id: "p2power", label: "Player 2 superpower", keys: ["Period"], touch: { label: "★", x: 92, y: 23, s: .85 } }
  ];

  /* ---------- kicking ---------- */
  function kick(api, p, lob) {
    if (p.kcool > 0 || p.stun > 0 || p.ko > 0) return false;
    p.leg = .24; p.kcool = .28; speak(api, p, p.power > 0 ? "shoot" : "kick");
    var o = S.p[1 - p.side];
    if (o && o.ko <= 0) { var odx = (o.x - p.x) * p.face; if (odx > 0 && odx < 1.15 && Math.abs(o.y - p.y) < 1.1) hitRival(api, p, o, lob ? 1.2 : 1, false); }
    var b = S.ball, dx = (b.x - p.x) * p.face, dy = b.y - p.y;
    var wide = S.assist && !p.cpu;
    if (b.hold || dx < (wide ? -.8 : -.55) || dx > (wide ? 1.7 : 1.45) || dy > 1.7 || dy < -.6) return false;
    b.shot = null; S.lastKick = p;
    var th = lob ? LOB : DRIVE, v = KICK_V * p.c.power * (p.fx.superkick > 0 ? 1.4 : 1) * (S.kickMul || 1);
    if (p.power > 0) { // power shot
      var P = p.P; v *= 1.45; th = lob ? 38 : 14; b.shot = { type: P.shot, t: 1.6, owner: p.side, col: P.col, jumped: false }; S.stats.shots += p.cpu ? 0 : 1;
      if (P.shot === "fire") { b.photon = .5; p.vx -= p.face * 7; p.vy = Math.max(p.vy, 1.5); }
      api.sound.sfx("boom"); api.kick(9); api.hitstop(.07); zm(api, .06, sx(b.x), sy(b.y)); if (!p.cpu) api.buzz([15, 20, 40]);
    } else { api.sound.sfx("kick"); api.kick(2); if (!p.cpu) api.buzz(12); }
    b.vx = Math.cos(deg(th)) * v * p.face; b.vy = Math.sin(deg(th)) * v; b.y = Math.max(b.y, BR + .01); squash(b, -p.face, 0, v / 20); S.lastTouch = p;
    var R = v * v * Math.sin(deg(2 * th)) / G, Hm = Math.pow(v * Math.sin(deg(th)), 2) / (2 * G);
    S.ghost = { x: b.x, y: b.y, vx: b.vx, vy: b.vy, life: 1.4, v: v, th: th, R: R, H: Hm, photon: b.photon > 0, power: !!b.shot };
    if (!p.cpu) { S.stats.kicks++; S.stats[lob ? "lob" : "drive"]++; S.stats.longest = Math.max(S.stats.longest, R); }
    api.burst(sx(b.x), sy(b.y), b.shot ? b.shot.col : "#fff", b.shot ? 18 : 6, b.shot ? 300 : 160);
    return true;
  }
  function hitRival(api, p, o, k, shot) {
    if (!shot && o.imm > 0 && o.stun <= 0) return; // a short grace after a stun: no stun-locks
    var J = (shot ? 420 : 260) * k * (p.power > 0 && pw(p) === "kai" ? 2.2 : 1) / (o.c.defence || 1), dv = J / o.c.mass, dir = shot ? (S.ball.vx >= 0 ? 1 : -1) : p.face;
    o.vx += dv * dir; o.vy = Math.max(o.vy, shot ? 4 : 2.5); o.stun = Math.max(o.stun, shot ? 1.1 : .45); o.daze += shot ? 1.5 : 1; o.hurt = .4; o.wobble = 1;
    o.imm = o.stun + .35; if (o.daze >= 3) o.bleed = Math.max(o.bleed, 4);
    speak(api, o, o.daze >= 4 ? "ko" : "hurt");
    api.sound.sfx(o.daze >= 4 || shot ? "heavy" : "hit"); api.hitstop(shot ? .1 : .05); api.kick(shot ? 9 : 5); api.burst(sx(o.x), sy(o.y + 1.3), shot ? "#fff3c4" : "#ffd86b", shot ? 20 : 10, 260);
    pop("J = " + Math.round(J) + " N·s → Δv = " + dv.toFixed(1) + " m/s", o.x, o.y + 2.6, "#ffe9a8");
    if (o.daze >= 4) { o.ko = 3; o.daze = 1; o.stun = 0; api.sound.sfx("ko"); pop("Knocked out!", o.x, o.y + 3.1, "#ff8080"); if (!o.cpu) api.buzz([60, 40, 120]); crowdReact(p.side, 1, 2.5); api.sound.roar(false); }
    if (!o.cpu) { api.flash("#ff2a2a", .22); api.buzz(30); }
  }
  function squash(b, nx, ny, amt) { b.nx = nx; b.ny = ny; b.squash = Math.min(.4, Math.max(b.squash, amt)); b.sqv = 0; }

  function power(api, p) {
    if (p.meter < 1 || p.power > 0 || p.ko > 0 || S.state !== "play") return;
    var P = p.P; p.meter = 0; p.power = P.dur; p.powerMax = P.dur;
    S.intro = { p: p, P: P, t: 0, dur: api.reduce ? .4 : .85 }; S.state = "intro";
    speak(api, p, "power", P.name); comment(p.c.name.split(" ")[0] + " unleashes " + P.name + "!"); api.sound.sfx("special"); api.flash("#ffffff", .12); if (!p.cpu) api.buzz([20, 30, 20]);
  }
  function startPower(api, p) {
    var P = p.P, o = S.p[1 - p.side], b = S.ball, id = pw(p);
    S.flash = { text: P.name, idea: P.idea, t: 3.4, col: P.col };
    if (id === "tesla") { p.coilT = .2; if (Math.abs(b.x - p.x) < 5) { b.vx = 16 * p.face; b.vy = 3; S.lastTouch = p; } S.ray = { from: p, t: .55 }; api.sound.sfx("laser"); }
    if (id === "newton" && o) S.apple = { x: o.x, y: 9, vy: 0, target: o };
    if (id === "bohr") { p.x = Math.max(1, Math.min(WM - 1, b.x - p.face * .8)); api.burst(sx(p.x), sy(1.3), P.col, 24, 300); }
    if (id === "curie") b.glow = P.dur;
    api.burst(sx(p.x), sy(p.y + 1.3), P.col, 30, 340);
  }

  function control(api, p, dt) {
    if (S.state !== "play" || (S.mode === "demo" && false)) { p.vx *= .85; return; }
    var L, R, J, K, Q, X, D = false, dl = false, dr = false, pre = p.side === 0 ? "" : "p2";
    if (p.cpu) { var a = ai(p, dt); L = a.l; R = a.r; J = a.j; K = a.k; Q = a.q; X = a.x; dl = a.dl; dr = a.dr; }
    else {
      L = api.down(pre + "left"); R = api.down(pre + "right"); J = api.hit(pre + "jump"); K = api.hit(pre + "kick"); Q = api.hit(pre + "lob"); X = api.hit(pre + "power"); D = api.hit(pre + "dash");
      dl = api.double(pre + "left"); dr = api.double(pre + "right");
      if (S.mode !== "duo" && p.side === 0) { L = L || api.down("p2left"); R = R || api.down("p2right"); J = J || api.hit("p2jump", "Space"); K = K || api.hit("p2kick"); Q = Q || api.hit("p2lob"); X = X || api.hit("p2power"); D = D || api.hit("p2dash"); dl = dl || api.double("p2left"); dr = dr || api.double("p2right"); }
    }
    if (p.ko > 0 || p.fx.freeze > 0) { p.vx *= .88; return; }
    if (p.stun > 0) { p.vx *= .95; return; }
    var slow = 1; if (p.fx.slowT) { p.fx.slowT += dt; slow = 1 - .6 * Math.pow(.5, p.fx.slowT); if (p.fx.slowT > 5) p.fx.slowT = 0; }
    var glide = p.power > 0 && pw(p) === "groove", sp = 6.3 * p.c.speed * slow * (p.fx.boots > 0 ? 1.35 : 1) * (glide ? 1.7 : 1) * (p.daze >= 3 ? .85 : 1);
    var home = p.side ? -1 : 1, bdx = S.ball.x - p.x; if (p.leg <= 0 && p.dash <= 0) p.face = (bdx * home < -.6 && Math.abs(bdx) < 3) ? -home : home; // turn to play a ball that is behind you
    if (p.power > 0 && pw(p) === "dash") { sp *= 1.45; p.dashCool = Math.min(p.dashCool, .15); }
    if ((dl || dr || D) && p.dashCool <= 0) { p.dash = .18; p.dashDir = dl ? -1 : dr ? 1 : (R ? 1 : L ? -1 : p.face); p.dashCool = .7 / (p.c.stamina || 1); api.sound.sfx("dash"); speak(api, p, "effort"); api.burst(sx(p.x), GY - 6, "#d8c9a8", 10, 140); }
    if (p.dash > 0) { p.dash -= dt; p.vx = p.dashDir * 14.5 * p.c.speed; }
    else { var want = (R ? sp : 0) - (L ? sp : 0); p.vx += (want - p.vx) * Math.min(1, dt * (p.y > 0 ? 10 : glide ? 7 : 32)); }
    p.coyote = p.y <= 0 ? .08 : p.coyote - dt; if (J) p.jumpBuf = .12; else p.jumpBuf -= dt;
    if (p.jumpBuf > 0 && p.coyote > 0) { p.vy = 6.4 * p.c.jump; p.jumpBuf = 0; p.coyote = 0; api.sound.sfx("jump"); speak(api, p, "jump"); }
    if (K || Q) kick(api, p, Q);
    if (X) power(api, p);
  }

  function ai(p, dt) {
    var b = S.ball, out = {}, s = p.skill, own = p.side ? WM : 0, aim = p.side ? -1 : 1, o = S.p[1 - p.side];
    p.react -= dt; if (p.react > 0) return p.lastAI || out;
    p.react = Math.max(.03, .2 - s * .15);
    var t = .32, px = b.x + b.vx * t, behind = px - aim * .7;
    if (Math.abs(b.x - own) < 4.2 && (b.x - p.x) * aim < 0) behind = b.x - aim * 1.0;
    var tx = (b.vy < -2 && b.y > 3) ? px - aim * .5 : behind;
    if (s < .5 && Math.random() < .3) tx = p.x;
    out.r = tx > p.x + .2; out.l = tx < p.x - .2;
    var dx = (b.x - p.x) * aim;
    out.j = Math.abs(b.x - p.x) < 1.3 && b.y > 1.9 && b.y < 3.7 && b.vy < 2 && Math.random() < .45 + s * .45;
    var fromGoal = Math.abs(b.x - (p.side ? 0 : WM));
    out.k = dx > -.3 && dx < 1.2 && b.y < 1.4 && Math.random() < .3 + s * .6;
    if (o && o.ko <= 0 && Math.abs(o.x - p.x) < 1.1 && Math.random() < .06 + s * .1) out.k = true;
    out.q = out.k && fromGoal > 9 && Math.random() < .5; if (out.q) out.k = false;
    out.x = p.meter >= 1 && (fromGoal < 9 || Math.random() < .01) && Math.random() < .05 + s * .08;
    if (Math.abs(tx - p.x) > 4 && p.dashCool <= 0 && Math.random() < s * .3) { if (tx > p.x) out.dr = true; else out.dl = true; }
    p.lastAI = out; return out;
  }

  function collideCircle(b, cx, cy, r, vx, vy, e, api, who) {
    var dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), m = r + BR;
    if (d >= m || d === 0) return false;
    var nx = dx / d, ny = dy / d; b.x = cx + nx * m; b.y = cy + ny * m;
    var rvx = b.vx - vx, rvy = b.vy - vy, vn = rvx * nx + rvy * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; if (-vn > 2.5) { api.sound.sfx("bounce"); squash(b, nx, ny, -vn / 24); if (who && who.head && who.p && !who.p.cpu && who.p.side === 0) S.stats.headers++; } }
    return true;
  }
  function collideSeg(b, ax, ay, bx2, by2, api) {
    var ex = bx2 - ax, ey = by2 - ay, t = Math.max(0, Math.min(1, ((b.x - ax) * ex + (b.y - ay) * ey) / (ex * ex + ey * ey)));
    if (collideCircle(b, ax + ex * t, ay + ey * t, .07, 0, 0, .6, api)) { if (Math.hypot(b.vx, b.vy) > 6) { api.sound.sfx("block"); api.kick(3); } }
  }
  function headR(p) { return HR * (p.fx.bighead > 0 ? 1.4 : 1); }

  function ballStep(api, dt, k) {
    var b = S.ball; if (b.hold) { b.y = 2.7 + Math.sin(S.t * 6) * .06; b.spin += dt * 2; return; }
    var sub = 3, h = dt * k / sub;
    for (var i = 0; i < sub; i++) {
      if (b.photon > 0) b.photon -= h; else b.vy -= S.g * h;
      if (S.wind && b.y > BR + .05) b.vx += S.wind * h;
      if (b.shot) { b.shot.t -= h; if (b.shot.t <= 0) b.shot = null; }
      if (b.shot && b.shot.type === "magnet") { var tgx = b.shot.owner ? .4 : WM - .4; b.vx += Math.sign(tgx - b.x) * 9 * h; b.vy += (1.3 - b.y) * 3 * h; }
      if (b.shot && b.shot.type === "curve") { var cgx = b.shot.owner ? .4 : WM - .4; b.vx += Math.sign(cgx - b.x) * 5 * h; b.vy += (1.1 - b.y) * 2.2 * h; }
      if (b.shot && b.shot.type === "quantum" && !b.shot.jumped && Math.abs(b.vx) > 3) { b.shot.jumped = true; S.qflash = { x: b.x, y: b.y, t: .3 }; b.x = Math.max(GW + .6, Math.min(WM - GW - .6, b.x + Math.sign(b.vx) * 2.2)); api.sound.sfx("zap"); }
      if (S.storm > 0 && Math.random() < .007) { var ang = Math.atan2(b.vy, b.vx) + (Math.random() - .5) * 1.6, spd = Math.hypot(b.vx, b.vy); b.vx = Math.cos(ang) * spd; b.vy = Math.sin(ang) * spd; }
      var spd2 = Math.hypot(b.vx, b.vy); if (spd2 > VMAX) { b.vx *= VMAX / spd2; b.vy *= VMAX / spd2; }
      b.x += b.vx * h; b.y += b.vy * h;
      var W = S.arena.weather, eg = W === "rain" ? .78 : W === "snow" ? .55 : .7, roll = W === "rain" ? .45 : W === "snow" ? 1.5 : .8;
      if (b.y < BR) { b.y = BR; if (b.vy < -1.5) { api.sound.sfx("bounce"); squash(b, 0, 1, -b.vy / 28); } b.vy = -b.vy * eg; if (Math.abs(b.vy) < .6) b.vy = 0; var dec = roll * h; b.vx = Math.abs(b.vx) <= dec ? 0 : b.vx - Math.sign(b.vx) * dec; }
      if (b.y > 9.6) { b.y = 9.6; b.vy = -Math.abs(b.vy) * .8; }
      if (b.x < BR + .12) { b.x = BR + .12; if (b.y < GH) netPoke(0, b.y, .5, Math.abs(b.vx) / 8); b.vx = Math.abs(b.vx) * (b.y < GH ? .12 : .4); }
      if (b.x > WM - BR - .12) { b.x = WM - BR - .12; if (b.y < GH) netPoke(1, b.y, .5, Math.abs(b.vx) / 8); b.vx = -Math.abs(b.vx) * (b.y < GH ? .12 : .4); }
      collideSeg(b, 0, GH, GW, GH, api); collideSeg(b, WM - GW, GH, WM, GH, api);
      var touch = [false, false];
      S.p.forEach(function (p) {
        if (!p) return; var lying = p.ko > 0, before = b.shot;
        if (!lying && collideCircle(b, p.x, p.y + 1.25, headR(p), p.vx, p.vy, Math.min(.9, .78 * (.9 + .1 * (p.c.header || 1))), api, { head: true, p: p })) { touch[p.side] = true; S.lastKick = null; }
        if (collideCircle(b, p.x, lying ? .3 : p.y + .45, lying ? .5 : .38, p.vx, p.vy, .5, api)) { touch[p.side] = true; S.lastKick = null; }
        if (touch[p.side] && before && before.owner !== p.side && !before.hitDone) { before.hitDone = true; hitRival(api, S.p[before.owner], p, 1, true); b.vx *= -.35; }
        if (touch[p.side]) S.lastTouch = p;
        if (p.power > 0 && pw(p) === "well" && b.y < 3) { var wx = p.x + p.face * .6 - b.x; if (Math.abs(wx) < 3.5) b.vx += Math.sign(wx) * 6 * h; }
        if (p.power > 0 && pw(p) === "magnet" && b.y < 1.2 && Math.abs(p.x + p.face * .55 - b.x) < 1) { b.vx += ((p.x + p.face * .55 - b.x) * 40 - (b.vx - p.vx) * 6) * h; }
        if (p.power > 0 && pw(p) === "bohr") [-1, 1].forEach(function (g) { var gx = (p.side ? WM - 2.2 : 2.2) + g * .9; collideCircle(b, gx, 1.5 + Math.sin(S.t * 3 + g) * .5, HR, 0, 0, .8, api, { head: true }); });
        if (p.power > 0 && pw(p) === "faraday") { var cx0 = p.side ? WM - GW - .1 : GW + .1; if (Math.abs(b.x - cx0) < BR + .06 && b.y < GH + .5 && (b.vx * (p.side ? 1 : -1)) > 0) { b.vx = -b.vx * .9; b.x = cx0 + (p.side ? -1 : 1) * (BR + .07); api.sound.sfx("zap"); squash(b, p.side ? -1 : 1, 0, .2); S.cageHit = .3; } }
      });
      if (touch[0] && touch[1]) { var top = Math.max(S.p[0].y, S.p[1].y) + 1.25 + HR + BR; b.y = Math.max(b.y, top); b.vy = Math.max(b.vy, 5.5); b.vx *= .3; }
      S.p.forEach(function (p) { if (p && touch[p.side] && b.glow > 0 && S.p[1 - p.side] && pw(S.p[1 - p.side]) === "curie" && !p.fx.slowT) { p.fx.slowT = .0001; pop("Slowed: recovers by half each second", p.x, p.y + 2.6, "#3dd68c"); } });
      if (b.x < GW && b.y < GH) b.vx *= .985; if (b.x > WM - GW && b.y < GH) b.vx *= .985;
    }
    b.spin += b.vx * dt * 3;
    b.sqv += (-170 * b.squash - 9 * b.sqv) * dt; b.squash += b.sqv * dt; if (Math.abs(b.squash) < .002 && Math.abs(b.sqv) < .01) b.squash = 0;
    b.trail.push([b.x, b.y]); if (b.trail.length > 16) b.trail.shift();
    if ((b.x < GW || b.x > WM - GW) && b.y > GH - .1 && b.y < GH + BR + .4 && Math.abs(b.vx) < .6 && Math.abs(b.vy) < .6) { S.roofT = (S.roofT || 0) + dt; if (S.roofT > 1.2) { S.roofT = 0; b.vx = (b.x < WM / 2 ? 1 : -1) * 4; b.vy = 3; } } else S.roofT = 0; // never stuck on a goal roof
    if (b.glow > 0) b.glow -= dt;
    if (S.state === "play") {
      if (b.x < GW - BR * .6 && b.y < GH - BR) goal(api, 1);
      else if (b.x > WM - GW + BR * .6 && b.y < GH - BR) goal(api, 0);
    }
  }

  function physics(api, dt) {
    var ein = S.p.filter(function (p) { return p && p.power > 0 && pw(p) === "einstein"; })[0], tk = ein ? .35 : 1;
    S.storm = S.p.some(function (p) { return p && p.power > 0 && pw(p) === "entropy"; }) ? 1 : 0;
    S.p.forEach(function (p) {
      if (!p) return; var k = ein && ein !== p ? tk : 1, d = dt * k;
      control(api, p, d);
      if (S.state === "celebrate") celebrateMove(api, p, d);
      p.vy -= S.g * d; p.x += p.vx * d; p.y += p.vy * d; p.imm = Math.max(0, p.imm - d);
      if (p.y < 0) { if (p.vy < -4) api.sound.sfx("stomp"); p.y = 0; p.vy = 0; }
      if (p.x < .5 || p.x > WM - .5) { p.x = Math.max(.5, Math.min(WM - .5, p.x)); p.vx *= -.2; }
      p.leg = Math.max(0, p.leg - d); p.kcool -= d; p.dashCool -= d; p.stun -= d; p.hurt -= d; p.wobble *= Math.pow(.05, d); p.breath += d;
      p.mouth = Math.max(0, p.mouth - d * 1.6); if (p.mouth <= .02 && p.ko <= 0) p.expr = "";
      if (p.ko > 0) { p.ko -= d; if (p.ko <= 0) { pop("Back up!", p.x, 2.6, "#fff"); speak(api, p, "effort"); } }
      if (p.bleed > 0) { p.bleed -= d; if (Math.random() < .2) S.drops.push({ x: p.x + p.face * .12, y: p.y + 1.15, vx: p.face * .3 + (Math.random() - .5) * .3, vy: .5, life: 1 }); }
      p.daze = Math.max(0, p.daze - d * .08);
      if (p.power > 0 && S.state === "play") { p.power -= d; if (pw(p) === "tesla") teslaZap(api, p, d); if (pw(p) === "kai") kaiPush(api, p); if (p.power <= 0) pop(p.P.name + " ended", p.x, 2.8, "#cfe"); }
      for (var f in p.fx) if (f !== "slowT" && p.fx[f] > 0) p.fx[f] -= d;
      if (S.mode !== "tut" && !S.noPowers && p.power <= 0 && S.state === "play") p.meter = Math.min(1, p.meter + d / (13 / (p.c.stamina || 1)));
    });
    var a = S.p[0], c = S.p[1];
    if (a && c && Math.abs(a.x - c.x) < 1.05 && Math.abs(a.y - c.y) < 1.6 && a.ko <= 0 && c.ko <= 0) { var push = (1.05 - Math.abs(a.x - c.x)) / 2 * Math.sign(a.x - c.x || 1); a.x += push; c.x -= push; }
    var touchedByEin = ein && S.lastTouch === ein;
    ballStep(api, dt, ein && !touchedByEin ? tk : 1);
    if (S.apple) { S.apple.vy -= S.g * dt; S.apple.y += S.apple.vy * dt; var at = S.apple.target; if (S.apple.y > at.y + 4) S.apple.x += (at.x - S.apple.x) * Math.min(1, dt * 2.5); if (S.apple.y < at.y + 1.9 && Math.abs(S.apple.x - at.x) > .8) { S.apple = null; pop("Dodged the apple!", at.x, 3, "#cfe"); } else if (S.apple.y < at.y + 1.9) { at.stun = 1.2; at.daze += 1; speak(api, at, "hurt"); api.sound.sfx("stomp"); api.burst(sx(at.x), sy(at.y + 1.9), "#d62828", 14, 220); pop("Apple! W = mg", at.x, at.y + 3, "#ff9b9b"); S.apple = null; } }
    S.drops.forEach(function (d) { d.vy -= G * dt * .6; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; if (d.y < .02) { d.y = .02; d.vx = 0; d.vy = 0; } }); S.drops = S.drops.filter(function (d) { return d.life > 0; });
    if (S.state !== "play") return;
    S.itemT -= dt;
    if (!S.item && S.itemT <= 0 && S.mode !== "tut") { var it = ITEMS[Math.floor(Math.random() * ITEMS.length)]; S.item = { it: it, x: 4 + Math.random() * (WM - 8), y: 3.2, t: 0 }; }
    if (S.item) { S.item.t += dt; S.p.forEach(function (p) { if (p && S.item && Math.hypot(p.x - S.item.x, p.y + 1.3 - S.item.y) < .9) grab(api, p); });
      if (S.item && Math.hypot(S.ball.x - S.item.x, S.ball.y - S.item.y) < .7 && S.lastTouch) grab(api, S.lastTouch);
      if (S.item && S.item.t > 9) { S.item = null; S.itemT = 10; } }
  }
  function grab(api, p) {
    var it = S.item.it, o = S.p[1 - p.side]; S.item = null; S.itemT = 12 + Math.random() * 6; api.sound.sfx("coin"); speak(api, p, "laugh");
    if (it.id === "freeze") { if (o) { o.fx.freeze = it.dur; pop("Frozen!", o.x, o.y + 2.8, "#9fe8ff"); } }
    else if (it.id === "power") p.meter = Math.min(1, p.meter + .5);
    else p.fx[it.id] = it.dur;
    pop(it.label, p.x, p.y + 3, it.col);
  }
  function teslaZap(api, p, dt) {
    p.coilT = (p.coilT || 0) - dt; var o = S.p[1 - p.side];
    if (p.coilT <= 0 && o && Math.abs(o.x - p.x) < 9 && o.ko <= 0) { p.coilT = 1.25; o.stun = Math.max(o.stun, .6); o.daze += .4; speak(api, o, "hurt"); S.bolts.push({ x1: p.side ? WM - 1 : 1, y1: 3.6, x2: o.x, y2: o.y + 1.3, t: .28, seed: Math.random() }); api.sound.sfx("zap"); api.flash("#cfe9ff", .08); }
  }
  function kaiPush(api, p) { var o = S.p[1 - p.side]; if (o && o.ko <= 0 && o.stun <= 0 && Math.abs(o.x - p.x) < 1.15 && Math.abs(o.y - p.y) < 1) { hitRival(api, p, o, 1.4, false); S.shock = { x: p.x + p.face * .6, y: p.y + 1, t: .4 }; } }

  /* ---------- goals, celebrations and the restart ---------- */
  function goal(api, who) {
    if (S.mode === "tut") { if (S.tut === 3 && who === 0) tutNext(api); resetPositions(0); S.ball.hold = false; S.ball.x = 6; return; }
    if (who === 1 && (CT.wall || heroOn()) && (S.mode === "cup" || S.mode === "quick" || S.mode === "career")) { S.ball.x = GW + .9; S.ball.vx = 7; S.ball.vy = 3; api.sound.sfx("block"); return; } // sealed goal: the shot bounces out
    if (S.mode === "demo") { netPoke(who ? 0 : 1, S.ball.y, .5, 3); resetPositions(1 - who); S.ball.hold = false; return; } // the menu demo never scores, ends or reports
    var lt = S.lastTouch, own = !!(lt && lt.side !== who && S.lastKick === lt), scorer = own ? lt : S.p[who];
    S.score[who]++; S.p[who].goals++; S.lastScorer = who; S.goalLog.push({ who: who, own: own, t: Math.round(S.time) });
    S.state = "celebrate"; S.stateT = 2.7; S.goalWho = who;
    var mine = S.mode === "duo" || who === 0, name = scorer.c.name.split(" ").pop();
    S.p[1 - who].meter = Math.min(1, S.p[1 - who].meter + .3);
    S.p[who].celebrate = 2.6; speak(api, S.p[who], "win"); var gm = S.matchId; setTimeout(function () { if (S.matchId === gm && S.p[1 - who]) speak(api, S.p[1 - who], "sad"); }, 500);
    api.slowmo(.5, .35); zm(api, .1, sx(who ? GW * .5 : WM - GW * .5), sy(1.2)); api.kick(10);
    netPoke(who ? 0 : 1, S.ball.y, .5, 3);
    var sub = own ? "Own goal by " + name : name + " scores!"; comment(sub + " " + S.score[0] + " – " + S.score[1]);
    if (mine) { api.banner(own ? "OWN GOAL!" : "GOAL!", { col: "#ffd84a", edge: "#8a4b00", size: 150, sub: sub, dur: 2.4 }); api.confetti(110); api.sound.sfx("goal"); api.sound.roar(false); api.sound.say(own ? "Own goal!" : "Goal!", { pitch: 1.15, rate: 1.05, queue: true }); crowdReact(who, 1, 3); crowdReact(1 - who, -1, 2.5); api.buzz([40, 30, 80]); S.fireworks = 2.2; }
    else { api.banner(own ? "OWN GOAL" : "GOAL", { col: "#ff6b6b", edge: "#5a0b0b", size: 130, sub: own ? "Own goal by " + name : name + " scores against you", dur: 2.4, sad: true }); api.sound.roar(true); api.sound.say(own ? "Own goal." : "Goal.", { pitch: .75, rate: .9, queue: true }); crowdReact(1, 1, 3); crowdReact(0, -1, 3); api.flash("#5a0000", .35); api.buzz(180); }
    S.excite = 1;
  }
  function celebrateMove(api, p, dt) {
    if (p.celebrate > 0) { p.celebrate -= dt; if (p.y <= 0 && Math.random() < dt * 5) { p.vy = 4.6 + Math.random() * 1.4; } p.vx += ((p.x < WM / 2 - 1.5 ? 2.6 : p.x > WM / 2 + 1.5 ? -2.6 : Math.sin(S.t * 5) * 2) - p.vx) * dt * 4; }
  }
  function afterGoal(api) {
    var loser = 1 - S.goalWho; resetPositions(loser); S.state = "kickoff"; S.stateT = 1.1; S.fade = .35;
    if (S.golden || S.score[0] >= 5 || S.score[1] >= 5) { S.state = "over"; end(api); }
  }

  var TUT = [
    ["Move and dash", "Walk with your move keys. Double-tap a direction (or press Dash) to dash.", function (p) { return p.dash > 0; }],
    ["Jump", "Jump. Your big head is the best part of you here.", function (p) { return p.y > .8; }],
    ["Two kicks", "Low kick flies at 25°, lob at 55°. Same speed, different angle: watch the range in the dotted arc.", function () { return S.stats.drive > 0 && S.stats.lob > 0; }],
    ["Score", "Put the ball in the right-hand goal. Watch the net bulge when it goes in.", function () { return false; }]
  ];
  function tutNext(api) {
    S.tut++; api.sound.sfx("power"); api.confetti(40);
    if (S.tut >= TUT.length) { A.store("kick-tut", true); S.over = true; api.confetti(100);
      api.show("<h2>You're ready</h2><p>You used the range equation without writing it down. On flat ground a 45° kick goes furthest; 25° and 55° land shorter, at almost the same distance, because sin 2θ is nearly equal for them.</p><p class='gm-formula'>R = v² sin 2θ / g</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='cup'>Start the cup</button><button class='gm-btn' data-act='menu'>Menu</button></div>", menuAct(api)); }
  }

  var CUP = [
    { name: "Group match", skill: .35, arena: "campus" }, { name: "Group match", skill: .5, arena: "night" }, { name: "Last 16", skill: .6, arena: "sunset" },
    { name: "Quarter-final", skill: .72, arena: "rain" }, { name: "Semi-final", skill: .84, arena: "snow" }, { name: "The final", skill: .96, arena: "void", boss: true }
  ];
  function end(api) {
    if (S.mode === "demo" || S.mode === "menu" || S.mode === "tut") return;
    S.over = true; S.state = "over"; var me = S.score[0], them = S.score[1], duo = S.mode === "duo", win = me > them, st = S.stats;
    if (!duo && me === them && !S.golden && !S.drawOK) { S.golden = true; S.time = Infinity; S.over = false; S.state = "kickoff"; S.stateT = 1.6; resetPositions(null); api.banner("GOLDEN GOAL", { col: "#ffe9a8", edge: "#6a4a00", size: 90, sub: "Next goal wins", dur: 1.8 }); api.sound.say("Golden goal!"); return; }
    if (S.mode === "career" && window.KickCareerUI) { S.over = true; S.state = "over"; return window.KickCareerUI.end(api, me, them); }
    var cup = S.mode === "cup", final = cup && S.round === CUP.length - 1;
    api.sound.sfx("whistle");
    var wi = duo ? (me === them ? -1 : me > them ? 0 : 1) : win ? 0 : 1, champ = final && win;
    if (cup) { cupRun.length = Math.min(cupRun.length, S.round); cupRun.push({ name: CUP[S.round].name, opp: S.p[1].c.name.split(" ").pop(), me: me, them: them }); }
    S.post = { t: 0, win: wi, champ: champ, podium: 0 };
    if (wi >= 0) { crowdReact(duo ? null : wi, 1, 14); if (!duo) crowdReact(1 - wi, -1, 9); speak(api, S.p[wi], "win"); var m0 = S.matchId; setTimeout(function () { if (S.matchId === m0 && S.p[1 - wi]) speak(api, S.p[1 - wi], "sad"); }, 700); }
    else crowdReact(null, 1, 4);
    if (cup && win) A.store("cup-best", Math.max(A.store("cup-best") || 0, S.round + 1));
    var pts = win ? 300 + (me - them) * 100 + me * 25 + (cup ? S.round * 150 : 0) : me * 25;
    A.report("momentum-cup", duo ? { result: "draw", mode: "duo", stage: 1, score: 0 } : { result: win ? "win" : me === them ? "draw" : "lose", stage: cup ? S.round + 1 : 1, score: pts });
    var head = duo ? (me === them ? "Draw" : S.p[me > them ? 0 : 1].c.name + " wins") : win ? (final ? "Cup champions!" : "You win") : cup ? "Knocked out in the " + CUP[S.round].name.toLowerCase() : "Not this time";
    var log = S.goalLog.map(function (g) { return (g.own ? "Own goal (" : "") + S.p[g.who].c.name.split(" ").pop() + (g.own ? ")" : ""); }).join(", ");
    var gf = 0, ga = 0, bigW = null; cupRun.forEach(function (r) { gf += r.me; ga += r.them; if (r.me > r.them && (!bigW || r.me - r.them > bigW.me - bigW.them)) bigW = r; });
    var path = cup ? "<p style='display:flex;flex-wrap:wrap;gap:6px;justify-content:center'>" + cupRun.map(function (r) { return "<span class='gm-chip'>" + A.esc(r.name) + ": <b>" + r.me + "–" + r.them + "</b> v " + A.esc(r.opp) + "</span>"; }).join("") + "</p>" : "";
    var quote = champ ? ["“Physics did the talking. I only held the clipboard.”", "“Six rounds, one parabola at a time. Proud of you.”", "“Entropy always wins in the end. Not today.”"][me % 3] : win ? ["“Good. Now do it again.”", "“That lob was pure sin 2θ.”", "“Keep your head moving into the ball.”"][(me + them) % 3] : ["“Heads up. We learn the angles and we come back.”", "“You made them work for it. Next season is ours.”", "“One bounce went against us. That is football.”"][(me + them) % 3];
    var body = (log ? "<p>Goals: " + A.esc(log) + "</p>" : "") + (champ || (cup && !win) ? path : "") + (duo ? "" : "<p><i>Manager: " + quote + "</i></p>") +
      (champ ? "<p><b>Count Entropy's Disorder XI is beaten.</b> Entropy's Void is now open for quick matches. " + A.esc(S.p[0].c.name) + " top-scored with " + gf + " goals; the cup conceded just " + ga + ".</p>" : "") +
      (cup && !win ? "<p>The cup starts again next season. Your best run so far: round " + (A.store("cup-best") || 0) + " of " + CUP.length + ".</p>" : "") +
      "<details><summary>The physics you just used</summary><p>Every kick was a projectile: the horizontal speed stays constant while the vertical speed falls by 9.8 m/s each second. A header is a collision: the ball leaves faster when your head moves into it, and some energy is lost each bounce.</p>" +
      "<p class='gm-formula'>R = v² sin 2θ / g &nbsp; H = v² sin²θ / 2g &nbsp; T = 2v sinθ / g</p></details>";
    var acts = duo ? "<button class='gm-btn gm-btn--go' data-act='duo-again'>Rematch</button>" :
      cup ? (win && !final ? "<button class='gm-btn gm-btn--go' data-act='next'>Next round</button>" : win ? "<button class='gm-btn gm-btn--go' data-act='cup'>Defend the cup</button>" : "<button class='gm-btn gm-btn--go' data-act='retry'>Try again</button>")
        : "<button class='gm-btn gm-btn--go' data-act='quick-again'>Play again</button>";
    var kind = duo ? (wi < 0 ? "draw" : "win") : win ? (champ ? "champion" : "win") : cup ? "eliminated" : "lose", wc = S.p[wi < 0 ? 0 : wi].c;
    var tips = ["Lob (55°) over a rival who rushes you; drive (25°) when the goal is open.", "Dash into the ball: a moving head adds its speed to the header.", "Save your superpower for when the ball is in their half.", "Stand a step off your line: a rebound off the bar is yours."];
    var stats = champ ? [["Cup goals", gf + " for, " + ga + " against"], ["Biggest win", bigW ? bigW.me + "–" + bigW.them + " v " + bigW.opp : "–"], ["Longest kick", st.longest.toFixed(1) + " m"]]
      : [["Full time", me + " – " + them], ["Longest kick", st.longest.toFixed(1) + " m"], ["Headers", st.headers], ["Power shots", st.shots]];
    api.banner("FULL TIME", { size: 84, sub: me + " – " + them, dur: 1.25, y: 236, col: win || duo ? "#ffd84a" : "#cbd5e1", edge: win || duo ? "#8a4b00" : "#1e293b", sad: !win && !duo });
    var mid = S.matchId;
    setTimeout(function () {
      if (S.matchId !== mid || S.mode === "menu") return;
      if (champ) api.sound.say("Champions!", { queue: true });
      api.ceremony(kind, { title: duo && wi >= 0 ? wc.name.split(" ").pop().toUpperCase() + " WINS!" : champ ? "CUP CHAMPIONS!" : win ? "YOU WIN!" : cup ? "KNOCKED OUT" : "FULL TIME", sub: (cup ? CUP[S.round].name + " · " : "") + me + " – " + them,
        colors: [wc.coat, "#ffffff", "#f6c445", wc.coat, "#7ef0ff"], draw: function () {}, dim: .2, grey: .6, scoreY: 512, score: duo ? null : pts, scoreLabel: "Match points", stats: stats,
        line: win ? (st.longest > 0 ? "Best moment: a " + st.longest.toFixed(1) + " m kick." : "A clean win.") : duo ? "" : me > 0 ? "You scored " + me + " and made them sweat." : "They kept you out today, but you read the bounces better by the end.",
        tip: duo ? "" : tips[(me + them + S.round) % tips.length],
        then: function () { if (S.matchId !== mid || S.mode === "menu") return; api.show("<h2>" + head + "</h2>" + body + "<div class='gm-actions'>" + acts + "<button class='gm-btn' data-act='menu'>Menu</button></div>", menuAct(api)); } });
    }, api.reduce ? 0 : 1250);
  }
  // After the whistle: the winner runs, jumps and (after a cup final) climbs the podium with the cup; the loser walks off, head down.
  var cupRun = [];
  function postStep(api, dt) {
    var P = S.post, mid = WM / 2; P.t += dt;
    S.p.forEach(function (p) {
      if (!p) return; p.breath += dt; p.leg = 0; p.stun = 0; p.ko = 0; p.dash = 0; p.wobble = 0;
      var won = P.win === p.side, lost = P.win >= 0 && !won, tx = p.x, g0 = 0, sp = 4.2, hop = 0;
      if (won) { p.celebrate = 1; p.gloom = 0;
        if (P.champ && P.t > 1.8) { tx = mid; if (Math.abs(p.x - mid) < .2) { P.podium = Math.min(1, P.podium + dt * 1.6); g0 = .6 * P.podium; hop = P.podium >= 1 && (P.t % 1.3) < dt ? 3.2 : 0; } else hop = p.y <= 0 && Math.random() < dt * 2 ? 4 : 0; }
        else { tx = mid + (p.side ? 1.6 : -1.6) + Math.sin(P.t * 1.5) * 3.4; hop = p.y <= 0 && Math.random() < dt * 2.6 ? 4.4 + Math.random() * 1.6 : 0; } }
      else if (lost) { p.celebrate = 0; p.gloom = 1; tx = p.side ? WM - 2.3 : 2.3; sp = 1.1; }
      else { p.celebrate = 0; tx = p.side ? mid + 1.2 : mid - 1.2; sp = 1.6; }
      p.vx = Math.max(-sp, Math.min(sp, (tx - p.x) * 3)); p.x += p.vx * dt; if (Math.abs(p.vx) > .4) p.face = p.vx > 0 ? 1 : -1; else if (!won) p.face = p.side ? -1 : 1;
      if (hop && p.y <= g0 + .01) p.vy = hop;
      p.vy -= G * dt; p.y += p.vy * dt; if (p.y <= g0) { p.y = g0; if (p.vy < 0) p.vy = 0; }
    });
    S.ball.vx *= .97; S.excite = 1;
  }
  function drawPodium(x, api) {
    var P = S.post, k = P.podium, cx = sx(WM / 2), h = .6 * PX * k; if (k <= 0) return;
    x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(cx, GY + 4, 150, 10, 0, 0, 7); x.fill();
    [[-92, .55, "#c9ced6", "2"], [92, .4, "#c98a4a", "3"], [0, 1, "#f6c445", "1"]].forEach(function (s) { var hh = h * s[1] + 4, g = x.createLinearGradient(0, GY - hh, 0, GY); g.addColorStop(0, "#fff"); g.addColorStop(.12, s[2]); g.addColorStop(1, "rgba(0,0,0,.35)");
      x.fillStyle = s[2]; x.fillRect(cx + s[0] - 46, GY - hh, 92, hh); x.fillStyle = g; x.globalAlpha = .55; x.fillRect(cx + s[0] - 46, GY - hh, 92, hh); x.globalAlpha = 1;
      if (hh > 22) { x.fillStyle = "rgba(0,0,0,.45)"; x.font = "900 20px system-ui, sans-serif"; x.textAlign = "center"; x.fillText(s[3], cx + s[0], GY - hh + 24); } });
  }

  /* ---------- career: profile, squad, leagues, cups, rankings and the Legends ladder (rules live in kickoff-career.js) ---------- */
  var CUI = (function () {
    var MC = window.MomentumCareer, KEY = "kick-career", MALEV = ["newton", "faraday", "tesla", "einstein", "bohr", "groove", "kai"];
    var KITS = [["#22c55e", "#ffffff"], ["#2563eb", "#facc15"], ["#dc2626", "#ffffff"], ["#7c3aed", "#f0abfc"], ["#0f172a", "#f6c445"], ["#f97316", "#1f2937"], ["#0891b2", "#ecfeff"], ["#ffffff", "#16a34a"]];
    var esc = A.esc, P = null, F = null, lastRes = null;
    function load() { if (!MC) return null; if (P) return P; var raw = A.store(KEY); if (raw) P = MC.migrate(raw, {}); return P; }
    function save() { if (P) A.store(KEY, P); }
    function crest(c, size) { size = size || 40; var w = (c.name || "FC").replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map(function (s) { return s[0]; }).join("").toUpperCase() || "FC";
      return "<span aria-hidden='true' style='display:inline-grid;place-items:center;width:" + size + "px;height:" + size + "px;border-radius:" + (size * .25) + "px " + (size * .25) + "px " + (size * .5) + "px " + (size * .5) + "px;background:" + c.c1 + ";color:" + c.c2 + ";border:3px solid " + c.c2 + ";font:900 " + Math.round(size * .36) + "px system-ui;vertical-align:middle'>" + esc(w) + "</span>"; }
    function clubOf(id) { return id === "you" ? { name: P.club.name, c1: P.club.c1, c2: P.club.c2 } : MC.clubById(id) || { name: "?", c1: "#888", c2: "#fff" }; }
    function chip(t, bg, fg) { return "<span class='gm-chip' style='background:" + (bg || "rgba(255,255,255,.12)") + ";color:" + (fg || "inherit") + "'>" + t + "</span>"; }
    var RCOL = { common: "#94a3b8", rare: "#38bdf8", epic: "#c084fc", legendary: "#f6c445" };
    // a career player as a match character, in the club's kit
    function careerChar(id, lvl, club, mult) {
      var b = MC.byId[id], m = (1 + .02 * ((lvl || 1) - 1)) * (mult || 1), c;
      if (b) { var pw = MC.POWERS[b.pw];
        c = { id: b.id, name: b.name, life: "player", skin: b.skin, hair: b.hair, style: b.style, coat: club.c1, trim: club.c2, eye: b.eye, mass: b.mass, guest: true,
          fact: "An original Momentum Cup player.", src: "Original EE Hub character", special: pw.name, idea: "",
          speed: Math.min(1.35, b.speed * m), jump: Math.min(1.3, b.jump * m), power: Math.min(1.45, b.shot * m), header: Math.min(1.4, b.header * m), defence: Math.min(1.5, b.defence * m), stamina: Math.min(1.45, b.stamina * m),
          pw: pw.engine, powerName: pw.name, voice: b.fem ? "curie" : MALEV[MC.hash(b.id) % MALEV.length] };
      } else { var o = A.byId[id]; if (!o) return null; c = Object.assign({}, o, { coat: id === "mib" ? o.coat : club.c1 });
        if (id !== "mib" && mult && mult !== 1) { c.speed = Math.min(1.35, c.speed * mult); c.power = Math.min(1.45, c.power * mult); c.jump = Math.min(1.3, c.jump * mult); } }
      return c;
    }
    function owned() { var ids = Object.keys(P.roster).concat(P.originals); if (A.byId.mib) ids.push("mib"); return ids; }
    function nameOf(id) { var b = MC.byId[id]; return b ? b.name : A.byId[id] ? A.byId[id].name : id; }
    function rateOf(id) { var b = MC.byId[id]; return b ? MC.rating(b, (P.roster[id] || {}).lvl) : id === "mib" ? 99 : 84; }
    function powOf(id) { var b = MC.byId[id]; return b ? MC.POWERS[b.pw].name : POWERS[id] ? POWERS[id].name : ""; }
    function fixtureName(f) { if (!f) return ""; if (f.type === "league") return MC.TIERS[P.season.tier].name + " · round " + (f.round + 1) + " of 10"; if (f.type === "cup") return MC.TIERS[P.season.tier].cup + " · " + f.name; return f.name; }
    function modsText(ms) { return (ms || []).map(function (m) { return chip(esc(MC.MODS[m].name), "#3b2a5a", "#e9d5ff"); }).join(" "); }

    function open(api) { if (!MC) { api.toast ? api.toast("Career mode did not load.") : 0; return menu(api); } if (!load()) return create(api); hub(api); }
    function create(api) {
      var kit = 0, old = { cupBest: A.store("cup-best") || 0, fav: A.store("kick-p1") };
      function draw() {
        api.show("<h2>Start your career</h2><p>Build a club from the Campus League to the World League, then take on the endless Legends ladder.</p>" +
          "<label style='display:block;margin:8px 0'>Manager name <input data-in='name' maxlength='24' value='Manager' style='width:100%;font:inherit;padding:8px;border-radius:8px'></label>" +
          "<label style='display:block;margin:8px 0'>Club name <input data-in='club' maxlength='28' value='Momentum FC' style='width:100%;font:inherit;padding:8px;border-radius:8px'></label>" +
          "<h3>Kit</h3><div class='gm-actions' style='justify-content:flex-start'>" + KITS.map(function (k, i) { return "<button class='gm-btn gm-btn--sm' data-act='kit' data-i='" + i + "' aria-pressed='" + (i === kit) + "' aria-label='Kit " + (i + 1) + "' style='min-width:48px;min-height:48px;background:" + k[0] + ";color:" + k[1] + ";border:3px solid " + k[1] + "'>" + (i === kit ? "✓" : "") + "</button>"; }).join("") + "</div>" +
          (old.cupBest >= 6 ? "<p class='gm-small'>Your classic cup win joins your trophy cabinet, with 500 coins.</p>" : "") +
          "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='make'>Create club</button><button class='gm-btn' data-act='menu'>Back</button></div>",
          function (act, el) {
            if (act === "kit") { kit = +el.getAttribute("data-i"); return draw(); }
            if (act === "menu") return menu(api);
            if (act === "make") { var q = function (k) { var e = document.querySelector("[data-in='" + k + "']"); return e ? e.value.trim() : ""; };
              P = MC.migrate(MC.create({ name: q("name") || "Manager", club: q("club") || "Momentum FC", c1: KITS[kit][0], c2: KITS[kit][1], seed: Date.now() & 0xffff }), old); save(); hub(api); }
          });
      }
      draw();
    }
    function hub(api) {
      menuMusic(api); var s = P.season, f = MC.next(P), gf = MC.grandFinal(P), lf = MC.legendsFixture(P), ord = MC.sorted(s.table), pos = ord.indexOf("you") + 1, t = MC.TIERS[s.tier], st = P.stats;
      var next = gf || f, od = next ? MC.odds(P, next) : null, oc = next ? (next.opp === "entropy" ? MC.VILLAIN_CLUB : MC.clubById(next.opp)) : null;
      api.show("<h2 style='display:flex;align-items:center;gap:10px;justify-content:center'>" + crest(P.club, 44) + esc(P.club.name) + "</h2>" +
        "<p style='display:flex;flex-wrap:wrap;gap:6px;justify-content:center'>" + chip("Manager " + esc(P.name)) + chip("Level " + P.level) + chip("🪙 " + P.coins) + chip(esc(t.name), t.col, "#04140d") + chip("Season " + (P.seasonNo + 1)) + (s.table.you.p ? chip("Position " + pos + " of 6") : chip("Season starts")) + chip("Trophies " + P.cabinet.length) + "</p>" +
        (next ? "<div class='gm-card-note' style='text-align:left'><b>" + (gf ? "The Grand Final" : "Next: " + esc(fixtureName(next))) + "</b><br>" + crest(oc, 26) + " v <b>" + esc(oc.name) + "</b> · your win chance about <b>" + od.win + "%</b> " + modsText(next.mods) + "</div>" : "") +
        "<p class='gm-small'>Played " + st.played + " · won " + st.won + " · drawn " + st.drawn + " · lost " + st.lost + " · goals " + st.gf + "–" + st.ga + " · best streak " + st.bestStreak + " · career matches " + P.matches + "</p>" +
        "<div class='gm-actions'>" + (gf ? "<button class='gm-btn gm-btn--go' data-act='grand'>Play the Grand Final</button>" : "") + (f ? "<button class='gm-btn" + (gf ? "" : " gm-btn--go") + "' data-act='play'>Play next match</button>" : "") +
        (lf ? "<button class='gm-btn' data-act='legends'>Legends rung " + (P.legends.rung + 1) + "</button>" : "") +
        "<button class='gm-btn' data-act='squad'>Squad</button><button class='gm-btn' data-act='scout'>Scout</button><button class='gm-btn' data-act='table'>League table</button><button class='gm-btn' data-act='rank'>Rankings</button><button class='gm-btn' data-act='cabinet'>Trophy cabinet</button><button class='gm-btn' data-act='opts'>Options</button><button class='gm-btn' data-act='menu'>Menu</button></div>",
        function (act) {
          if (act === "play") return prematch(api, f); if (act === "grand") return prematch(api, gf); if (act === "legends") return prematch(api, lf);
          if (act === "squad") return squad(api); if (act === "scout") return scout(api); if (act === "table") return table(api); if (act === "rank") return rank(api); if (act === "cabinet") return cabinet(api); if (act === "opts") return opts(api);
          if (act === "menu") return menu(api);
        });
    }
    function menuMusic(api) { if (S.mode !== "menu") { S.matchId = (S.matchId || 0) + 1; S.over = true; S.mode = "menu"; S.state = "menu"; S.post = null; api.useActions([]); api.music(A.song(300, "funk", { bpm: 112 })); } }
    function back() { return "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='hub'>Back to club</button></div>"; }
    function squad(api) {
      var ids = owned().sort(function (a, b) { var ia = P.squad.indexOf(a), ib = P.squad.indexOf(b); if (ia >= 0 || ib >= 0) return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib); return rateOf(b) - rateOf(a); });
      api.show("<h2>Squad</h2><p>Pick up to three. Your first pick starts; the others can come on at half-time. Training adds 2% to every stat per level (up to level 10).</p><div style='display:grid;gap:8px;text-align:left'>" +
        ids.map(function (id) { var b = MC.byId[id], lvl = (P.roster[id] || {}).lvl || 1, inS = P.squad.indexOf(id), cost = b ? MC.trainCost(P, id) : 0;
          return "<div class='gm-card-note' style='display:flex;flex-wrap:wrap;gap:8px;align-items:center'><b style='flex:1 1 180px'>" + (inS >= 0 ? (inS === 0 ? "★ " : "• ") : "") + esc(nameOf(id)) + "</b>" + chip(b ? b.rarity : id === "mib" ? "maker" : "classic", RCOL[b ? b.rarity : "legendary"], "#04140d") + chip("Rating " + rateOf(id)) + chip(esc(powOf(id))) + (b ? chip("Lv " + lvl) : "") +
            "<button class='gm-btn gm-btn--sm' data-act='pick' data-id='" + id + "'>" + (inS >= 0 ? "Leave out" : "Pick") + "</button>" + (cost ? "<button class='gm-btn gm-btn--sm' data-act='train' data-id='" + id + "'" + (P.coins < cost ? " disabled" : "") + ">Train · " + cost + " 🪙</button>" : "") + "</div>"; }).join("") + "</div>" + back(),
        function (act, el) { var id = el && el.getAttribute("data-id");
          if (act === "pick") { var q = P.squad.slice(), i = q.indexOf(id); if (i >= 0) { if (q.length > 1) q.splice(i, 1); } else { if (q.length >= 3) q.pop(); q.push(id); } MC.setSquad(P, q); save(); return squad(api); }
          if (act === "train") { if (MC.train(P, id)) { api.sound.sfx("coin"); save(); } return squad(api); }
          if (act === "hub") return hub(api); });
    }
    function scout(api) {
      var list = MC.PLAYERS.filter(function (p) { return !P.roster[p.id]; });
      api.show("<h2>Scouting</h2><p>🪙 " + P.coins + " · Rares open in the Regional League, epics in the National League. Legends are earned, never bought.</p><div style='display:grid;gap:8px;text-align:left'>" +
        list.map(function (p) { var ok = MC.scoutable(P, p), why = p.rarity === "legendary" ? esc(p.unlock.text) : "Reach the " + MC.TIERS[p.need].name;
          return "<div class='gm-card-note' style='display:flex;flex-wrap:wrap;gap:8px;align-items:center'><b style='flex:1 1 180px'>" + esc(p.name) + "</b>" + chip(p.rarity, RCOL[p.rarity], "#04140d") + chip("Rating " + MC.rating(p)) + chip(esc(MC.POWERS[p.pw].name)) +
            (ok ? "<button class='gm-btn gm-btn--sm' data-act='buy' data-id='" + p.id + "'" + (P.coins < p.cost ? " disabled" : "") + ">Sign · " + p.cost + " 🪙</button>" : "<span class='gm-small'>🔒 " + why + "</span>") + "</div>"; }).join("") + "</div>" + back(),
        function (act, el) { if (act === "buy") { if (MC.scout(P, el.getAttribute("data-id"))) { api.sound.sfx("coin"); api.confetti(40); save(); } return scout(api); } if (act === "hub") return hub(api); });
    }
    function table(api) {
      var s = P.season, ord = MC.sorted(s.table);
      api.show("<h2>" + esc(MC.TIERS[s.tier].name) + " · season " + (P.seasonNo + 1) + "</h2><p class='gm-small'>Top two go up. Sixth goes down" + (s.tier === 0 ? " (not from the Campus League)" : "") + ".</p><div style='overflow-x:auto'><table style='width:100%;border-collapse:collapse;font-size:15px'><tr><th style='text-align:left'>#</th><th style='text-align:left'>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>" +
        ord.map(function (id, i) { var r = s.table[id], c = clubOf(id), me = id === "you"; return "<tr style='" + (me ? "background:rgba(61,214,140,.18);font-weight:800;" : "") + (i < 2 && s.tier < 4 ? "border-left:4px solid #3dd68c;" : i === 5 && s.tier > 0 ? "border-left:4px solid #ef4444;" : "") + "'><td>" + (i + 1) + "</td><td style='text-align:left'>" + crest(c, 20) + " " + esc(c.name) + "</td><td>" + r.p + "</td><td>" + r.w + "</td><td>" + r.d + "</td><td>" + r.l + "</td><td>" + (r.gf - r.ga) + "</td><td><b>" + r.pts + "</b></td></tr>"; }).join("") + "</table></div>" + back(),
        function (act) { if (act === "hub") hub(api); });
    }
    function rank(api) {
      var all = MC.ranking(P), me = all.findIndex(function (r) { return r.id === "you"; });
      api.show("<h2>World club rankings</h2><p>Your club is <b>#" + (me + 1) + "</b> of " + all.length + ".</p><ol style='text-align:left;max-height:50vh;overflow:auto'>" + all.map(function (r) { var c = clubOf(r.id); return "<li style='" + (r.id === "you" ? "font-weight:800;color:#3dd68c" : "") + "'>" + crest(c, 18) + " " + esc(c.name) + "</li>"; }).join("") + "</ol>" + back(), function (act) { if (act === "hub") hub(api); });
    }
    function cabinet(api) {
      var st = P.stats;
      api.show("<h2>Trophy cabinet</h2>" + (P.cabinet.length ? "<div style='display:flex;flex-wrap:wrap;gap:8px;justify-content:center'>" + P.cabinet.map(function (t) { return "<div class='gm-card-note' style='min-width:150px'>🏆 <b>" + esc(t.name) + "</b><br><span class='gm-small'>Season " + t.season + "</span></div>"; }).join("") + "</div>" : "<p>No trophies yet. Win a league or a cup.</p>") +
        "<p>Season points best " + st.bestSeasonPts + " · longest winning streak " + st.bestStreak + " · career goals " + st.gf + " · Legends best rung " + P.legends.best + "</p>" + back(), function (act) { if (act === "hub") hub(api); });
    }
    function opts(api) {
      var o = P.options;
      function row(label, key, vals) { return "<h3>" + label + "</h3><div class='gm-actions' style='justify-content:flex-start'>" + vals.map(function (v) { return "<button class='gm-btn gm-btn--sm' data-act='set' data-k='" + key + "' data-v='" + JSON.stringify(v[0]) + "' aria-pressed='" + (o[key] === v[0]) + "'>" + v[1] + "</button>"; }).join("") + "</div>"; }
      api.show("<h2>Career options</h2>" + row("Match length", "len", [[45, "45 s"], [60, "60 s"], [75, "75 s"], [90, "90 s"], [120, "120 s"]]) + row("Difficulty", "diff", [[-2, "Much easier"], [-1, "Easier"], [0, "Standard"], [1, "Harder"], [2, "Brutal"]]) +
        row("Kick assist", "assists", [[true, "On"], [false, "Off"]]) + row("Superpowers", "powers", [[true, "On"], [false, "Off"]]) + row("Camera", "camera", [["dynamic", "Zoom on shots"], ["static", "Still"]]) + row("Commentary text", "commentary", [[true, "On"], [false, "Off"]]) +
        (api.settings && api.settings.add ? "<p class='gm-small'>These are also in ⚙ Settings → Gameplay.</p>" : "") +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='hub'>Done</button><button class='gm-btn' data-act='reset'>Start a new career</button></div>",
        function (act, el) { if (act === "set") { var k = el.getAttribute("data-k"), v = JSON.parse(el.getAttribute("data-v")), map = { len: "mcLen", diff: "mcDiff", assists: "mcAssist", powers: "mcPowers", camera: "mcCamera", commentary: "mcComm" }; o[k] = v; if (api.settings && api.settings.set && map[k]) api.settings.set(map[k], v); save(); return opts(api); } if (act === "reset") { if (window.confirm && !window.confirm("Delete this career and start again?")) return opts(api); P = null; A.store(KEY, null); return create(api); } if (act === "hub") hub(api); });
    }
    function prematch(api, f) {
      F = f; var od = MC.odds(P, f), o = od.opp, oc = o.club, starter = P.squad[0], oppName = o.villain ? A.VILLAIN.name : o.base.name;
      api.show("<h2>" + esc(f.type === "grand" ? "The Grand Final" : fixtureName(f)) + "</h2><p style='display:flex;align-items:center;gap:10px;justify-content:center;font-size:18px'>" + crest(P.club, 40) + "<b>" + esc(P.club.name) + "</b> v <b>" + esc(oc.name) + "</b>" + crest(oc, 40) + "</p>" +
        "<p>Your starter: <b>" + esc(nameOf(starter)) + "</b> (" + rateOf(starter) + ") · their star: <b>" + esc(oppName) + "</b>" + (o.base ? " (" + Math.round(MC.rating(o.base) * o.stat) + ")" : "") + "</p>" +
        "<p>Win chance about <b>" + od.win + "%</b> · arena: " + esc((AR[o.arena] || AR.campus).name) + " " + modsText(o.mods) + (f.knock ? " " + chip("Knockout: no draws") : "") + "</p>" +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Kick off</button><button class='gm-btn' data-act='squad'>Change squad</button><button class='gm-btn' data-act='hub'>Back</button></div>",
        function (act) { if (act === "go") return start(api, f, o); if (act === "squad") return squad(api); hub(api); });
    }
    function start(api, f, o) {
      var my = careerChar(P.squad[0], (P.roster[P.squad[0]] || {}).lvl, P.club, 1), opp = o.villain ? Object.assign({}, A.VILLAIN) : careerChar(o.base.id, 1, o.club, o.stat);
      if (!my) { MC.setSquad(P, Object.keys(P.roster)); my = careerChar(P.squad[0], 1, P.club, 1); }
      newMatch(player(my, 0), player(opp, 1, true, o.skill), "career", { arena: AR[o.arena] || AR.campus, len: P.options.len, mods: o.mods, draws: f.type === "league" || f.type === "event", fixture: f, opt: P.options });
      S.cTier = P.tier; api.hide(); S.over = false; playPad(api, false); kickoffCall(api);
    }
    function halftime(api) {
      var subs = P.squad.filter(function (id) { return id !== S.p[0].c.id; }); if (!subs.length) return;
      api.show("<h2>Half-time · " + S.score[0] + " – " + S.score[1] + "</h2><p>Make a change?</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='keep'>Keep " + esc(S.p[0].c.name.split(" ")[0]) + "</button>" +
        subs.map(function (id) { return "<button class='gm-btn' data-act='sub' data-id='" + id + "'>Bring on " + esc(nameOf(id).split(" ")[0]) + " (" + rateOf(id) + ")</button>"; }).join("") + "</div>",
        function (act, el) { if (act === "sub") { var id = el.getAttribute("data-id"), old = S.p[0], c = careerChar(id, (P.roster[id] || {}).lvl, P.club, 1), np = player(c, 0); np.x = old.x; np.y = old.y; np.goals = old.goals; np.meter = old.meter; S.p[0] = np; comment(c.name.split(" ")[0] + " comes on."); } api.hide(); });
    }
    function rating(gf, ga, win) { return Math.max(3, Math.min(10, 6 + gf * .8 - ga * .4 + (win ? 1 : 0) + Math.min(1, S.stats.headers * .1))).toFixed(1); }
    function end(api, me, them) {
      var f = S.fixture;
      if (f && f.knock && me === them) { S.over = false; S.state = "kickoff"; S.stateT = 1.6; S.golden = true; S.time = Infinity; resetPositions(null); api.banner("SUDDEN DEATH", { col: "#ffe9a8", edge: "#6a4a00", size: 90, sub: "Next goal wins", dur: 1.8 }); return; }
      var win = me > them, draw = me === them, tier = P.tier, cfg = api.config || {};
      var res = MC.record(P, f, me, them, { cheated: !!api.cheated, boards: !!cfg.cheatsOnBoards }); save(); lastRes = res;
      var pts = win ? 300 + (me - them) * 100 + me * 25 + tier * 60 : me * 25;
      A.report("momentum-cup", { result: win ? "win" : draw ? "draw" : "lose", stage: f.type === "grand" || f.type === "legends" ? 6 : Math.min(5, tier + 1), score: pts });
      var ev = res.events, trophy = ev.filter(function (e) { return e.kind === "trophy"; })[0], out = ev.some(function (e) { return e.kind === "cupOut"; });
      api.sound.sfx("whistle"); S.post = { t: 0, win: win ? 0 : draw ? -1 : 1, champ: !!trophy, podium: 0 };
      if (win) { crowdReact(0, 1, 14); crowdReact(1, -1, 9); speak(api, S.p[0], "win"); } else if (!draw) { crowdReact(1, 1, 10); speak(api, S.p[0], "sad"); }
      var kind = trophy ? "champion" : win ? "win" : draw ? "draw" : out ? "eliminated" : "lose", c = S.p[0].c;
      var lines = ev.map(function (e) {
        if (e.kind === "trophy") return "🏆 <b>" + esc(e.trophy.name) + "</b>"; if (e.kind === "promoted") return "⬆ Promoted to the <b>" + esc(MC.TIERS[e.tier].name) + "</b>"; if (e.kind === "relegated") return "⬇ Relegated to the " + esc(MC.TIERS[e.tier].name);
        if (e.kind === "seasonEnd") return "Season over: you finished <b>" + e.pos + "</b> of 6 with " + e.pts + " points"; if (e.kind === "grandFinal") return "🔥 <b>The Grand Final</b> awaits: Count Entropy's Disorder XI";
        if (e.kind === "unlock") return "✨ New legend signed: <b>" + esc(nameOf(e.id)) + "</b>"; if (e.kind === "original") return "Classic player joins: <b>" + esc(nameOf(e.id)) + "</b>";
        if (e.kind === "level") return "Manager level " + e.level; if (e.kind === "rung") return "Legends rung " + e.rung + " cleared"; if (e.kind === "cupOut") return "Out of the " + esc(e.name); return ""; }).filter(Boolean);
      var title = trophy ? trophy.trophy.name.toUpperCase() : win ? "YOU WIN!" : draw ? "DRAW" : out ? "KNOCKED OUT" : "FULL TIME";
      api.banner("FULL TIME", { size: 84, sub: me + " – " + them, dur: 1.25, y: 236, col: win ? "#ffd84a" : "#cbd5e1", edge: win ? "#8a4b00" : "#1e293b", sad: !win && !draw });
      var mid = S.matchId;
      setTimeout(function () {
        if (S.matchId !== mid || S.mode !== "career") return;
        api.ceremony(kind, { title: title, sub: fixtureName(f) + " · " + me + " – " + them, colors: [P.club.c1, P.club.c2, "#f6c445", "#ffffff"], draw: function () {}, dim: .2, grey: .6, scoreY: 512, score: pts, scoreLabel: "Match points",
          stats: [["Your rating", rating(me, them, win)], ["Coins", "+" + res.coins], ["XP", "+" + res.xp]], line: lines[0] ? lines[0].replace(/<[^>]+>/g, "") : (win ? "Three points in the bag." : "Regroup and go again."), tip: win ? "" : "Train your squad or sign a new player before the next match.",
          then: function () { if (S.matchId !== mid || S.mode !== "career") return;
            api.show("<h2>" + (win ? "Victory" : draw ? "A point" : "Defeat") + " · " + me + " – " + them + "</h2><p>" + esc(c.name) + " rated <b>" + rating(me, them, win) + "</b> · +" + res.coins + " 🪙 · +" + res.xp + " XP</p>" + (lines.length ? "<ul style='text-align:left'>" + lines.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul>" : "") +
              "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='hub'>Continue</button><button class='gm-btn' data-act='menu'>Menu</button></div>", function (act) { if (act === "menu") return menu(api); hub(api); }); } });
      }, api.reduce ? 0 : 1250);
    }
    return { open: open, end: end, halftime: halftime, hub: hub, load: load, get P() { return P; }, set P(v) { P = v; }, careerChar: careerChar, prematch: prematch, start: start, last: function () { return lastRes; } };
  })();
  window.KickCareerUI = CUI;

  // game options live in the shared Settings screen (⚙ → Gameplay); career matches read them through OPT
  var OPT = { len: 75, diff: 0, assists: true, powers: true, camera: "dynamic", commentary: true };
  function registerOptions(api) {
    if (!api.settings || !api.settings.add) return;
    function put(k) { return function (v) { OPT[k] = v; var P = CUI.load && CUI.load(); if (P) { P.options[k] = v; A.store("kick-career", P); } }; }
    var sec = "Momentum Cup";
    api.settings.add({ id: "mcLen", tab: "gameplay", section: sec, label: "Career match length", type: "choice", default: 75, choices: [[45, "45 s"], [60, "60 s"], [75, "75 s"], [90, "90 s"], [120, "120 s"]], apply: put("len") });
    api.settings.add({ id: "mcDiff", tab: "gameplay", section: sec, label: "Career difficulty", type: "choice", default: 0, choices: [[-2, "Much easier"], [-1, "Easier"], [0, "Standard"], [1, "Harder"], [2, "Brutal"]], apply: put("diff") });
    api.settings.add({ id: "mcAssist", tab: "gameplay", section: sec, label: "Kick assist", type: "toggle", default: true, help: "A slightly wider kick window for you, never for the CPU.", apply: put("assists") });
    api.settings.add({ id: "mcPowers", tab: "gameplay", section: sec, label: "Superpowers", type: "toggle", default: true, apply: put("powers") });
    api.settings.add({ id: "mcCamera", tab: "display", section: sec, label: "Match camera", type: "choice", default: "dynamic", choices: [["dynamic", "Zoom on shots and goals"], ["static", "Still"]], apply: put("camera") });
    api.settings.add({ id: "mcComm", tab: "gameplay", section: sec, label: "Commentary text", type: "toggle", default: true, apply: put("commentary") });
  }

  /* ---------- menus ---------- */
  var pick = { a: A.store("kick-p1") || "einstein", b: "curie", opp: "tesla", arena: "campus", diff: .6, len: 75 };
  function menu(api) {
    S.matchId = (S.matchId || 0) + 1; S.over = true; S.mode = "menu"; S.state = "menu"; S.post = null; S.intro = null; S.apple = null; S.ray = null; S.bolts = []; S.item = null; api.music(A.song(300, "funk", { bpm: 112 })); api.useActions([]);
    var best = A.store("cup-best") || 0;
    api.show("<h2>Momentum Cup</h2><p>Head-football for scientists. Every kick is a projectile and every header is a collision, with real SI numbers on screen. Start a career and climb from the Campus League to the World League, or play the classic six-round cup.</p>" +
      "<div class='gm-actions'>" + (window.MomentumCareer ? "<button class='gm-btn gm-btn--go' data-act='career'>Career" + (CUI.load() ? " (" + A.esc(CUI.P.club.name) + ")" : "") + "</button>" : "") + "<button class='gm-btn" + (window.MomentumCareer ? "" : " gm-btn--go") + "' data-act='cup'>Classic cup" + (best ? " (best: round " + best + ")" : "") + "</button><button class='gm-btn' data-act='quick'>Quick match</button><button class='gm-btn' data-act='duo'>Two players, one device</button><button class='gm-btn' data-act='tut'>How to play</button></div>" +
      "<p style='font-size:13px;opacity:.75'>Unlock arenas and guest players with coins in the arcade shop. Online matches with friends are planned but not built yet.</p>", menuAct(api));
  }
  function choose(api, who, next) {
    var cur = who === "b" ? pick.b : pick.a;
    api.show("<h2>" + (who === "b" ? "Player 2" : "Pick your scientist") + "</h2>" + A.picker(api, cur, "Each has a different speed, jump, kick, voice and superpower.") +
      "<div data-note></div><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Next</button><button class='gm-btn' data-act='menu'>Back</button></div>",
      function (act, el) {
        if (act === "pick") { cur = el.getAttribute("data-id"); [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); }); note(); api.sound.voice(VOICE[cur], "laugh"); }
        else if (act === "go") { if (who === "b") pick.b = cur; else { pick.a = cur; A.store("kick-p1", cur); } next(); }
        else menuAct(api)(act);
      });
    function note() { var c = A.byId[cur], P = POWERS[cur]; document.querySelector("[data-note]").innerHTML = A.card(c) + "<p style='font-size:13px'><b>Superpower: " + A.esc(P.name) + "</b> (" + P.dur + " s, plus a power shot). " + A.esc(P.idea) + "</p>"; }
    note(); A.paintFaces(document.querySelector("[data-gm-overlay]"));
  }
  function quickSetup(api) {
    var opps = A.cast.filter(function (c) { return c.id !== pick.a; }).concat([A.VILLAIN]);
    if (pick.opp === pick.a || !opps.some(function (c) { return c.id === pick.opp; })) pick.opp = opps[0].id;
    api.show("<h2>Quick match</h2><div class='gm-set'><section><h3>Opponent</h3><div class='gm-actions' style='justify-content:flex-start'>" + opps.map(function (c) { return "<button class='gm-btn gm-btn--sm' data-act='opp' data-id='" + c.id + "' aria-pressed='" + (pick.opp === c.id) + "'>" + A.esc(c.name.split(" ").pop()) + "</button>"; }).join("") + "</div></section>" +
      "<section><h3>Arena</h3><div class='gm-actions' style='justify-content:flex-start'>" + ARENAS.map(function (a) { var ok = arenaOpen(a); return "<button class='gm-btn gm-btn--sm' data-act='" + (ok ? "arena" : "noarena") + "' data-id='" + a.id + "' aria-pressed='" + (pick.arena === a.id) + "'" + (ok ? "" : " disabled") + ">" + A.esc(a.name) + (ok ? "" : a.price ? " · " + a.price + " coins" : " · win the cup") + "</button>"; }).join("") + "</div></section>" +
      "<section><h3>Difficulty</h3><div class='gm-actions' style='justify-content:flex-start'>" + [[.35, "Easy"], [.6, "Normal"], [.85, "Hard"], [1, "Expert"]].map(function (d) { return "<button class='gm-btn gm-btn--sm' data-act='diff' data-v='" + d[0] + "' aria-pressed='" + (pick.diff === d[0]) + "'>" + d[1] + "</button>"; }).join("") + "</div>" +
      "<h3>Length</h3><div class='gm-actions' style='justify-content:flex-start'>" + [60, 75, 90, 120].map(function (l) { return "<button class='gm-btn gm-btn--sm' data-act='len' data-v='" + l + "' aria-pressed='" + (pick.len === l) + "'>" + l + " s</button>"; }).join("") + "</div></section></div>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='kickoff'>Kick off</button><button class='gm-btn' data-act='menu'>Back</button></div>",
      function (act, el) {
        if (act === "opp") pick.opp = el.getAttribute("data-id"); else if (act === "arena") pick.arena = el.getAttribute("data-id");
        else if (act === "diff") pick.diff = +el.getAttribute("data-v"); else if (act === "len") pick.len = +el.getAttribute("data-v");
        if (act === "kickoff") return startQuick(api); if (act === "menu") return menu(api);
        if (el && el.parentNode) [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); });
      });
  }
  function startQuick(api) { newMatch(player(A.byId[pick.a], 0), player(A.byId[pick.opp], 1, true, pick.diff), "quick", { arena: AR[pick.arena], len: pick.len }); api.hide(); playPad(api, false); kickoffCall(api); }
  function startRound(api, r) { try { if (window.MIBPlay) MIBPlay.level(r + 1); } catch (mibErr) {} /* MIB-Hub: play tracking */
    if (r === 0) cupRun.length = 0;
    var pool = A.cast.filter(function (c) { return c.id !== pick.a && !c.guest; }), R = CUP[r], opp = R.boss ? A.VILLAIN : pool[(r * 2 + pick.a.length) % pool.length];
    newMatch(player(A.byId[pick.a], 0), player(opp, 1, true, R.skill), "cup", { round: r, arena: AR[R.arena], len: 75 }); S.over = true; S.state = "menu";
    var ladder = CUP.map(function (c, i) { return "<span class='gm-chip' style='" + (i === r ? "background:var(--gm-a);color:#04140d" : i < r ? "opacity:.55" : "") + "'>" + (i + 1) + ". " + A.esc(c.name) + "</span>"; }).join(" ");
    api.show("<h2>" + (R.boss ? "The final: Count Entropy's Disorder XI" : R.name + " · round " + (r + 1) + " of " + CUP.length) + "</h2><p style='display:flex;flex-wrap:wrap;gap:6px;justify-content:center'>" + ladder + "</p><p>" + A.esc(A.byId[pick.a].name) + " vs " + A.esc(opp.name) + " at " + A.esc(AR[R.arena].name) + ". First to 5, or most goals in 75 seconds." + (R.boss ? " Entropy's Disorder Storm scatters the ball." : "") + "</p>" + A.card(opp) +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='play'>Play</button></div>", function (a) { if (a === "play") { api.hide(); S.over = false; S.state = "kickoff"; S.stateT = 1.3; playPad(api, false); kickoffCall(api); } });
  }
  function kickoffCall(api) { api.banner("KICK OFF", { size: 80, dur: 1.1, y: 220 }); api.sound.say("Kick off!", { rate: 1.1 }); }
  function playPad(api, duo) { api.useActions(duo ? ["left", "right", "jump", "kick", "lob", "dash", "power", "p2left", "p2right", "p2jump", "p2kick", "p2lob", "p2dash", "p2power"] : ["left", "right", "jump", "kick", "lob", "dash", "power"]); }
  function menuAct(api) {
    return function (act) {
      if (act === "menu") menu(api);
      else if (act === "career") CUI.open(api);
      else if (act === "cup") { if (!A.store("kick-tut")) startTut(api); else choose(api, "a", function () { startRound(api, 0); }); }
      else if (act === "next") startRound(api, S.round + 1);
      else if (act === "retry") startRound(api, S.round);
      else if (act === "quick") choose(api, "a", function () { quickSetup(api); });
      else if (act === "quick-again") startQuick(api);
      else if (act === "tut") startTut(api);
      else if (act === "duo") choose(api, "a", function () { choose(api, "b", function () { startDuo(api); }); });
      else if (act === "duo-again") startDuo(api);
    };
  }
  function startDuo(api) { newMatch(player(A.byId[pick.a], 0), player(A.byId[pick.b], 1), "duo", { arena: AR[pick.arena] && arenaOpen(AR[pick.arena]) ? AR[pick.arena] : AR.night, len: pick.len }); api.hide(); S.over = false; playPad(api, true); kickoffCall(api); }
  function startTut(api) { newMatch(player(A.byId[pick.a], 0), null, "tut", { arena: AR.campus }); api.hide(); S.over = false; playPad(api, false); }

  /* ---------- drawing: a cached background, a 20 Hz crowd layer, cached faces and HUD, then the live scene ---------- */
  var headCache = {}, headCount = 0;
  function head(x, c, cx, cy, r, f, o) {
    o = o || {}; var m = o.mouth > .05 ? Math.min(3, Math.ceil(o.mouth * 3)) : 0, R = Math.round(r);
    var key = c.id + c.coat + "|" + R + "|" + f + "|" + (o.mood || "") + "|" + (o.expr || "") + "|" + (o.blink ? 1 : 0) + "|" + m;
    var spr = headCache[key];
    if (!spr) {
      if (headCount > 260) { headCache = {}; headCount = 0; }
      var k = 2, cv = document.createElement("canvas"); cv.width = Math.ceil(R * 3 * k); cv.height = Math.ceil(R * 3.8 * k);
      var cx2 = cv.getContext("2d"); cx2.scale(k, k); A.drawHead(cx2, c, R * 1.5, R * 2, R, f, { mood: o.mood, expr: o.expr, blink: o.blink, mouth: m / 3 });
      spr = headCache[key] = { cv: cv, ox: R * 1.5, oy: R * 2, w: R * 3, h: R * 3.8 }; headCount++;
    }
    var jx = o.hit ? (Math.random() - .5) * 4 : 0;
    x.drawImage(spr.cv, cx - spr.ox + jx, cy - spr.oy, spr.w, spr.h);
  }
  var pops = [];
  function pop(t, x, y, col) { pops.push({ t: t, x: x, y: y, col: col || "#fff", life: 1.8 }); }
  function layer() { var c = document.createElement("canvas"); c.width = 960; c.height = 540; return c; }
  function buildBg() {
    var c = layer(), x = c.getContext("2d"), a = S.arena;
    var g = x.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, a.sky[0]); g.addColorStop(1, a.sky[1]); x.fillStyle = g; x.fillRect(0, 0, 960, 300);
    if (a.night) { x.fillStyle = "#fff"; for (var i = 0; i < 50; i++) { x.globalAlpha = .3 + .5 * ((i * 37) % 10) / 10; x.fillRect((i * 151) % 960, (i * 53) % 110, 2, 2); } x.globalAlpha = 1; }
    else { x.fillStyle = "rgba(255,255,255,.55)"; for (var cl = 0; cl < 4; cl++) { var cx = 90 + cl * 260; x.beginPath(); x.ellipse(cx, 44 + cl * 9, 70, 18, 0, 0, 7); x.ellipse(cx + 40, 36 + cl * 9, 46, 16, 0, 0, 7); x.fill(); } }
    if (a.id === "sunset") { var sun = x.createRadialGradient(480, 150, 10, 480, 150, 170); sun.addColorStop(0, "rgba(255,200,110,.95)"); sun.addColorStop(1, "rgba(255,120,60,0)"); x.fillStyle = sun; x.fillRect(300, 0, 360, 300); }
    x.fillStyle = a.night ? "#0b1220" : "#3a4552"; x.fillRect(0, 98, 960, 20);
    for (var t = 0; t < 7; t++) { x.fillStyle = t % 2 ? (a.night ? "#141d2c" : "#5b6673") : (a.night ? "#182335" : "#66717e"); x.fillRect(0, 122 + t * 22, 960, 22); }
    x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, 276, 960, 8);
    x.fillStyle = a.night ? "#0e2236" : "#1f2a36"; x.fillRect(0, 284, 960, 22);
    var top = 306;
    for (var s = 0; s < 12; s++) { var t0 = s / 12, t1 = (s + 1) / 12; x.fillStyle = a.turf[s % 2]; x.beginPath(); x.moveTo(-200 + t0 * 1360, 540); x.lineTo(60 + t0 * 840, top); x.lineTo(60 + t1 * 840, top); x.lineTo(-200 + t1 * 1360, 540); x.fill(); }
    x.fillStyle = a.turf[0]; x.fillRect(0, top, 60, 234); x.fillRect(900, top, 60, 234);
    var shade = x.createLinearGradient(0, top, 0, 540); shade.addColorStop(0, "rgba(0,0,0,.28)"); shade.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = shade; x.fillRect(0, top, 960, 234);
    x.strokeStyle = a.weather === "snow" ? "rgba(180,40,40,.6)" : "rgba(255,255,255,.55)"; x.lineWidth = 2;
    x.beginPath(); x.moveTo(60, top + 2); x.lineTo(900, top + 2); x.moveTo(480, top); x.lineTo(480, 540); x.stroke();
    x.beginPath(); x.ellipse(480, 420, 150, 40, 0, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, GY + 3); x.lineTo(960, GY + 3); x.stroke();
    // penalty boxes in perspective
    [[0, 1], [960, -1]].forEach(function (e) { x.beginPath(); x.moveTo(e[0] + e[1] * 140, 540); x.lineTo(e[0] + e[1] * 175, top + 30); x.lineTo(e[0] + e[1] * 40, top + 30); x.stroke(); });
    if (a.night) [[60, 86], [900, 86], [250, 84], [710, 84]].forEach(function (l) { var r = x.createRadialGradient(l[0], l[1], 4, l[0], l[1] + 60, 280); r.addColorStop(0, "rgba(255,255,220,.3)"); r.addColorStop(1, "rgba(255,255,220,0)"); x.fillStyle = r; x.fillRect(l[0] - 280, l[1] - 20, 560, 460); });
    [[60, 86], [900, 86], [250, 84], [710, 84]].forEach(function (l) { x.fillStyle = "#2a323d"; x.fillRect(l[0] - 2, l[1], 4, 14); x.fillStyle = a.night ? "#fffbe0" : "#e6e9ee"; x.fillRect(l[0] - 20, l[1] - 8, 40, 10); });
    drawGoalBack(x, 0); drawGoalBack(x, 1);
    S.restCloth = layer(); var rc = S.restCloth.getContext("2d"); drawGoalCloth(rc, 0, true); drawGoalCloth(rc, 1, true);
    return c;
  }
  function drawCrowd(api) {
    if (!S.crowdCv) S.crowdCv = layer();
    var x = S.crowdCv.getContext("2d"), ex = S.excite || 0; x.clearRect(0, 0, 960, 300);
    S.crowd.forEach(function (f, i) {
      var cheer = f.mood > 0, boo = f.mood < 0, bob = api.reduce ? 0 : cheer ? Math.abs(Math.sin(api.t * 9 + f.ph)) * 7 * f.s : Math.sin(api.t * 2.4 + f.ph) * (1 + ex * 2) * f.s;
      var fx = f.x, fy = f.y + 16 - bob, s = f.s * 7;
      x.fillStyle = f.col; x.fillRect(fx - s * .7, fy - s * .2, s * 1.4, s * 1.6);
      x.fillStyle = f.skin; x.beginPath(); x.arc(fx, fy - s * .6, s * .55, 0, 7); x.fill();
      if (cheer || ex > .75) { x.strokeStyle = f.skin; x.lineWidth = s * .35; x.beginPath(); x.moveTo(fx - s * .6, fy); x.lineTo(fx - s * .9, fy - s * 1.4); x.moveTo(fx + s * .6, fy); x.lineTo(fx + s * .9, fy - s * 1.4); x.stroke(); }
      else if (boo) { x.strokeStyle = f.skin; x.lineWidth = s * .35; x.beginPath(); x.moveTo(fx - s * .6, fy); x.lineTo(fx - s * .5, fy + s * .9); x.moveTo(fx + s * .6, fy); x.lineTo(fx + s * .5, fy + s * .9); x.stroke(); }
      if (f.flag) { x.strokeStyle = "#ddd"; x.lineWidth = 1; x.beginPath(); x.moveTo(fx + s, fy); x.lineTo(fx + s, fy - s * 3); x.stroke(); x.fillStyle = f.col; x.beginPath(); x.moveTo(fx + s, fy - s * 3); x.quadraticCurveTo(fx + s * 2.4, fy - s * (3.4 + Math.sin(api.t * 6 + i) * .3), fx + s * 3.6, fy - s * 2.8); x.lineTo(fx + s, fy - s * 2); x.fill(); }
    });
    if (S.fireworks > 0 && !api.reduce) { for (var k = 0; k < 3; k++) { var fx2 = 200 + k * 280, fy2 = 50 + (k % 2) * 20, rr = (2.2 - S.fireworks) * 90; x.strokeStyle = ["#f6c445", "#7ef0ff", "#ff6b9a"][k]; x.globalAlpha = Math.max(0, S.fireworks / 2.2); x.lineWidth = 2; for (var q = 0; q < 12; q++) { var an = q / 12 * 6.283; x.beginPath(); x.moveTo(fx2 + Math.cos(an) * rr * .6, fy2 + Math.sin(an) * rr * .6); x.lineTo(fx2 + Math.cos(an) * rr, fy2 + Math.sin(an) * rr); x.stroke(); } } x.globalAlpha = 1; }
  }
  // goal geometry: the near plane is the pitch line; the far plane is pulled 13% towards a vanishing point
  function far(p) { return [p[0] + (VP[0] - p[0]) * .13, p[1] + (VP[1] - p[1]) * .13]; }
  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function mesh(x, P00, P10, P01, P11, nu, nv, off) { // quad mesh, P00..P11 corners; off(u,v) → [dx,dy]
    function at(u, v) { var a = lerp2(P00, P10, u), b = lerp2(P01, P11, u), p = lerp2(a, b, v), o = off ? off(u, v) : null; return o ? [p[0] + o[0], p[1] + o[1]] : p; }
    for (var i = 0; i <= nu; i++) { x.beginPath(); for (var j = 0; j <= nv * 2; j++) { var q = at(i / nu, j / (nv * 2)); if (j) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); } x.stroke(); }
    for (var j2 = 0; j2 <= nv; j2++) { x.beginPath(); for (var i2 = 0; i2 <= nu * 2; i2++) { var q2 = at(i2 / (nu * 2), j2 / nv); if (i2) x.lineTo(q2[0], q2[1]); else x.moveTo(q2[0], q2[1]); } x.stroke(); }
  }
  function goalPts(side) {
    var outer = side ? 960 - 8 : 8, inner = side ? sx(WM - GW) : sx(GW), top = sy(GH);
    var nOutB = [outer, GY], nOutT = [outer, top + 6], nInB = [inner, GY], nInT = [inner, top];
    return { nOutB: nOutB, nOutT: nOutT, nInB: nInB, nInT: nInT, fOutB: far(nOutB), fOutT: far(nOutT), fInB: far(nInB), fInT: far(nInT) };
  }
  function drawGoalCloth(x, side, force) {
    var g = goalPts(side), net = S.nets[side]; if (!force && !net.live) return;
    x.lineWidth = 1; x.strokeStyle = "rgba(255,255,255,.3)";
    mesh(x, g.nOutT, g.fOutT, g.nOutB, g.fOutB, 6, 8, function (u, v) {
      var c = Math.min(NC - 1, Math.floor(u * NC)), r = Math.min(NR - 1, Math.floor((1 - v) * NR)), o = net[r * NC + c].o * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      return [(side ? 1 : -1) * o * .6, o * .15];
    });
  }
  function drawGoalBack(x, side) {
    var g = goalPts(side), net = S.nets[side];
    x.fillStyle = "rgba(0,0,0,.22)"; x.beginPath(); x.moveTo(g.nOutB[0], g.nOutB[1] + 3); x.lineTo(g.nInB[0], g.nInB[1] + 3); x.lineTo(g.fInB[0], g.fInB[1] + 3); x.lineTo(g.fOutB[0], g.fOutB[1] + 3); x.fill();
    x.lineWidth = 1; x.strokeStyle = "rgba(255,255,255,.28)";
    mesh(x, g.fOutT, g.fInT, g.fOutB, g.fInB, 7, 8);                         // far side net (the outer net is the live cloth)
    x.strokeStyle = "rgba(255,255,255,.22)"; mesh(x, g.nOutT, g.nInT, g.fOutT, g.fInT, 7, 5);   // roof net
    x.strokeStyle = "#cfd5dc"; x.lineWidth = 4; x.lineCap = "round";
    x.beginPath(); x.moveTo(g.fInB[0], g.fInB[1]); x.lineTo(g.fInT[0], g.fInT[1]); x.lineTo(g.fOutT[0], g.fOutT[1]); x.lineTo(g.fOutB[0], g.fOutB[1]); x.stroke();
  }
  function drawGoalFrontStatic(x, side) {
    var g = goalPts(side);
    x.lineWidth = 1; x.strokeStyle = "rgba(255,255,255,.2)"; mesh(x, g.nOutT, g.nInT, g.nOutB, g.nInB, 7, 8); // near side net, in front of the ball
    x.lineCap = "round";
    [[g.nInB, g.nInT], [g.nInT, g.fInT], [g.nOutT, g.nInT], [g.nOutT, g.fOutT]].forEach(function (seg, i) {
      x.strokeStyle = "rgba(0,0,0,.3)"; x.lineWidth = 8; x.beginPath(); x.moveTo(seg[0][0] + 2, seg[0][1] + 2); x.lineTo(seg[1][0] + 2, seg[1][1] + 2); x.stroke();
      x.strokeStyle = i < 2 ? "#ffffff" : "#e6eaee"; x.lineWidth = i === 0 ? 8 : 6; x.beginPath(); x.moveTo(seg[0][0], seg[0][1]); x.lineTo(seg[1][0], seg[1][1]); x.stroke();
    });
    x.strokeStyle = "rgba(150,160,170,.6)"; x.lineWidth = 2; x.beginPath(); x.moveTo(g.nInB[0] + (side ? 3 : -3), g.nInB[1]); x.lineTo(g.nInT[0] + (side ? 3 : -3), g.nInT[1] + 3); x.stroke();
  }
  function drawGoalFront(x, side) {
    if (!S.front) { S.front = layer(); var fx = S.front.getContext("2d"); drawGoalFrontStatic(fx, 0); drawGoalFrontStatic(fx, 1); }
    if (side === 0) x.drawImage(S.front, 0, 0);
    var g = goalPts(side);
    var fp = S.p.filter(function (p) { return p && p.power > 0 && pw(p) === "faraday" && p.side === side; })[0];
    if (fp) { var cx = side ? g.nInB[0] - 8 : g.nInB[0] + 8, al = .5 + .3 * Math.sin(S.t * 10) + (S.cageHit > 0 ? .3 : 0); x.strokeStyle = "rgba(126,240,255," + al + ")"; x.lineWidth = 2;
      x.beginPath(); x.arc(cx + (side ? 30 : -30), GY, 150, side ? Math.PI : -Math.PI / 2, side ? Math.PI * 1.5 : 0); x.stroke();
      for (var m = 0; m < 10; m++) { x.beginPath(); x.moveTo(cx - 8, GY - m * 16); x.lineTo(cx + 8, GY - m * 16 - 16); x.moveTo(cx + 8, GY - m * 16); x.lineTo(cx - 8, GY - m * 16 - 16); x.stroke(); } }
  }
  function drawPlayer(x, api, p) {
    var px = sx(p.x), py = sy(p.y), f = p.face, c = p.c, r = headR(p) * PX, talk = p.mouth > 0 ? p.mouth * (.55 + .45 * Math.abs(Math.sin(api.t * 22))) : 0;
    x.fillStyle = "rgba(0,0,0,.32)"; x.beginPath(); x.ellipse(px, GY + 6, 28 - p.y * 4, 6, 0, 0, 7); x.fill();
    if (p.ko > 0) {
      x.save(); x.translate(px, GY - 18); x.rotate(-f * Math.PI / 2 * .92);
      x.fillStyle = c.coat; x.fillRect(-14, -20, 28, 30); head(x, c, 0, -42, r * .85, f, { mood: "sad", expr: "hurt", mouth: talk }); x.restore();
      for (var s = 0; s < 4; s++) { var an = api.t * 3 + s * 1.57; x.fillStyle = "#ffe48a"; x.font = "16px system-ui"; x.fillText("★", px - f * 40 + Math.cos(an) * 26, GY - 60 + Math.sin(an) * 8); }
      return;
    }
    if (p.power > 0) { var P = p.P, pr = p.power / p.powerMax; x.strokeStyle = P.col; x.globalAlpha = .9; x.lineWidth = 4; x.beginPath(); x.arc(px, py - 70, r + 16, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); x.stroke();
      if (!api.reduce) { x.globalAlpha = .18 + .08 * Math.sin(api.t * 8); x.fillStyle = P.col; x.beginPath(); x.arc(px, py - 70, r + 22, 0, 7); x.fill(); } x.globalAlpha = 1; }
    if (p.dash > 0 && !api.reduce) { x.globalAlpha = .25; head(x, c, px - p.dashDir * 26, py - 74, r, f, {}); x.globalAlpha = 1; }
    if (p.fx.freeze > 0) { x.fillStyle = "rgba(160,230,255,.45)"; x.fillRect(px - 32, py - 124, 64, 124); }
    var celebrating = p.celebrate > 0, sad = (S.state === "celebrate" && S.goalWho !== p.side) || p.gloom === 1;
    var wob = p.wobble * Math.sin(api.t * 30) * .2 + (p.daze >= 3 ? Math.sin(api.t * 4) * .08 : 0) + (sad ? .12 * f : 0);
    x.save(); x.translate(px, py); x.rotate(wob);
    var running = Math.abs(p.vx) > .3 && p.y === 0, swing = p.leg > 0 ? Math.sin((1 - p.leg / .24) * Math.PI) * 1.25 : running ? Math.sin(api.t * 15) * .5 : 0;
    x.strokeStyle = "#20252b"; x.lineWidth = 8; x.lineCap = "round";
    var legs = p.y > 0 && p.leg <= 0 ? [[-6, .5], [6, -.3]] : [[-6, -swing * .4], [6, swing]];
    legs.forEach(function (l) { var ang = l[1] * f; x.beginPath(); x.moveTo(l[0] * .5, -28); x.lineTo(l[0] * .5 + Math.sin(ang) * 23, -28 + Math.cos(ang) * 23); x.stroke();
      x.fillStyle = p.fx.boots > 0 ? "#7ef0ff" : "#f4f4f4"; x.beginPath(); x.ellipse(l[0] * .5 + Math.sin(ang) * 23 + f * 5, -28 + Math.cos(ang) * 23, 10, 5.5, 0, 0, 7); x.fill(); });
    var breathe = 1 + Math.sin(p.breath * 3) * .02, sq = p.y === 0 && p.leg <= 0 ? breathe : 1 + Math.min(.12, Math.abs(p.vy) * .015);
    x.scale(1 / sq, sq);
    // arms
    x.strokeStyle = c.skin; x.lineWidth = 6;
    var armA = celebrating ? -2.6 + Math.sin(api.t * 12) * .3 : sad ? .2 : running ? Math.sin(api.t * 15) * .6 : p.leg > 0 ? -.9 : .3;
    [-1, 1].forEach(function (s) { var a = armA * (celebrating ? 1 : s); x.beginPath(); x.moveTo(s * 13, -48); x.lineTo(s * 13 + Math.sin(a) * 16 * s, -48 + Math.cos(a) * 16); x.stroke(); });
    x.fillStyle = c.coat; x.beginPath(); x.roundRect ? x.roundRect(-16, -54, 32, 30, 9) : x.rect(-16, -54, 32, 30); x.fill();
    x.fillStyle = "rgba(255,255,255,.85)"; x.font = "800 13px system-ui"; x.textAlign = "center"; x.fillText(p.side ? "2" : "1", 0, -35);
    x.restore();
    var hy = py - 76 + (sad ? 4 : 0) + (celebrating ? -Math.abs(Math.sin(api.t * 10)) * 3 : 0), mood = celebrating ? "happy" : sad ? "sad" : p.daze >= 2 ? "sad" : "";
    head(x, c, px, hy, r, f, { blink: (api.t + p.side) % 3.2 < .12, mood: mood, hit: p.hurt > 0, mouth: talk, expr: p.expr });
    if (p.daze > .6) { x.save(); x.beginPath(); x.arc(px, hy, r, 0, 7); x.clip(); x.fillStyle = "rgba(120,40,160," + Math.min(.38, (p.daze - .6) * .14) + ")"; x.fillRect(px - r, hy - r, r * 2, r * 2);
      if (p.daze >= 2) { x.fillStyle = "rgba(70,20,90,.55)"; x.beginPath(); x.ellipse(px + f * r * .46, hy - r * .03, r * .24, r * .22, 0, 0, 7); x.fill(); }
      if (p.daze >= 2.5) { x.fillStyle = "rgba(255,120,120,.5)"; x.beginPath(); x.ellipse(px - f * r * .5, hy + r * .25, r * .22, r * .16, 0, 0, 7); x.fill(); }
      x.restore(); }
    if (p.bleed > 0) { x.fillStyle = "#c81d25"; x.beginPath(); x.ellipse(px + f * r * .2, hy + r * .3, 2.5, 6, 0, 0, 7); x.fill(); }
    if (p.hurt > 0 && !api.reduce) { x.fillStyle = "rgba(160,220,255,.9)"; x.beginPath(); x.ellipse(px - f * r * .9, hy - r * .4, 3, 5, 0, 0, 7); x.fill(); }
    if (p.stun > 0 || p.daze >= 3) for (var s2 = 0; s2 < 3; s2++) { var a2 = api.t * 4 + s2 * 2.1; x.fillStyle = "#ffe48a"; x.font = "14px system-ui"; x.fillText("★", px + Math.cos(a2) * r * 1.1, hy - r * 1.05 + Math.sin(a2) * 6); }
    if (talk > .2 && (p.expr === "hurt" || p.celebrate > 0)) { x.fillStyle = "#fff"; x.font = "800 14px system-ui"; x.textAlign = "center"; x.fillText(p.expr === "hurt" ? "Oof!" : "Yes!", px + f * r * 1.3, hy - r * 1.2); }
  }
  function drawTesla(x, api, p) {
    var cx = sx(p.side ? WM - 1 : 1); x.fillStyle = "#3a3f4a"; x.fillRect(cx - 9, GY - 120, 18, 120);
    x.fillStyle = "#c08a3e"; for (var k = 0; k < 10; k++) x.fillRect(cx - 12, GY - 112 + k * 10, 24, 5);
    var g = x.createRadialGradient(cx - 6, GY - 134, 2, cx, GY - 128, 26); g.addColorStop(0, "#fff"); g.addColorStop(1, "#8a95a3"); x.fillStyle = g; x.beginPath(); x.ellipse(cx, GY - 128, 26, 12, 0, 0, 7); x.fill();
    if (!api.reduce) { x.strokeStyle = "rgba(200,225,255,.7)"; x.lineWidth = 1.5; for (var s = 0; s < 3; s++) { x.beginPath(); x.moveTo(cx, GY - 132); var a = api.t * 7 + s * 2; for (var k2 = 1; k2 < 5; k2++) x.lineTo(cx + Math.cos(a + k2) * k2 * 10, GY - 132 + Math.sin(a * 1.3 + k2) * k2 * 8); x.stroke(); } }
  }
  function bolt(x, x1, y1, x2, y2, seed, w, col) {
    var r = A.rng(Math.floor(seed * 1e6) + Math.floor(S.t * 30)); x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x1, y1);
    for (var k = 1; k <= 10; k++) { var f = k / 10; x.lineTo(x1 + (x2 - x1) * f + (k < 10 ? (r() - .5) * 30 : 0), y1 + (y2 - y1) * f + (k < 10 ? (r() - .5) * 30 : 0)); } x.stroke();
  }
  function drawBall(x, api) {
    var b = S.ball, bx = sx(b.x), by = sy(b.y), r = BR * PX, glow = b.glow > 0, shot = b.shot;
    if (b.hold) { var sp = x.createRadialGradient(bx, by, 4, bx, by, 60); sp.addColorStop(0, "rgba(255,255,230,.55)"); sp.addColorStop(1, "rgba(255,255,230,0)"); x.fillStyle = sp; x.fillRect(bx - 60, by - 60, 120, 120);
      x.fillStyle = "#ffe9a8"; x.font = "800 18px system-ui"; x.textAlign = "center"; x.fillText(S.toss === 0 ? "◀" : "▶", bx + (S.toss === 0 ? -34 : 34), by + 6); }
    var tcol = shot ? shot.col : b.photon > 0 ? "#fffbe0" : glow ? "#3dd68c" : (A.trail() || "#dff");
    b.trail.forEach(function (t, i) { x.globalAlpha = (shot ? .55 : .25) * i / 16; x.fillStyle = shot && shot.type === "disco" ? "hsl(" + ((i * 25 + S.t * 400) % 360) + ",90%,65%)" : tcol; x.beginPath(); x.arc(sx(t[0]), sy(t[1]), r * (shot ? 1.3 : 1) * i / 16, 0, 7); x.fill(); }); x.globalAlpha = 1;
    x.fillStyle = "rgba(0,0,0,.32)"; x.beginPath(); x.ellipse(bx, GY + 4, r * (1.1 - Math.min(.6, b.y * .08)), 3.5, 0, 0, 7); x.fill();
    if (glow || shot) { var g = x.createRadialGradient(bx, by, 2, bx, by, r * 3.4); g.addColorStop(0, shot ? shot.col : "rgba(61,214,140,.8)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.globalAlpha = .75; x.fillStyle = g; x.fillRect(bx - r * 3.4, by - r * 3.4, r * 6.8, r * 6.8); x.globalAlpha = 1; }
    if (shot && shot.type === "fire" && !api.reduce) for (var fl = 0; fl < 6; fl++) { x.fillStyle = ["#ffd166", "#ff8a3d", "#ff3d3d"][fl % 3]; x.beginPath(); x.arc(bx - Math.sign(b.vx) * (fl * 6 + Math.random() * 6), by + (Math.random() - .5) * 10, r * (1 - fl * .13), 0, 7); x.fill(); }
    if (shot && shot.type === "bolt") for (var bl = 0; bl < 3; bl++) bolt(x, bx, by, bx + (Math.random() - .5) * 60, by + (Math.random() - .5) * 60, Math.random(), 1.5, "rgba(210,230,255,.9)");
    if (shot && shot.type === "time") { x.strokeStyle = "rgba(160,200,255,.7)"; x.lineWidth = 2; x.beginPath(); x.arc(bx, by, r + 8 + Math.sin(S.t * 20) * 3, 0, 7); x.stroke(); }
    if (shot && shot.type === "shock") { x.strokeStyle = "rgba(246,196,69,.8)"; x.lineWidth = 3; x.beginPath(); x.arc(bx, by, r + ((S.t * 60) % 20), 0, 7); x.stroke(); }
    x.save(); x.translate(bx, by);
    var ang = Math.atan2(-b.ny, b.nx), s = b.squash; x.rotate(ang); x.scale(1 - s, 1 + s * .7); x.rotate(-ang); x.rotate(b.spin);
    var sh = x.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r); sh.addColorStop(0, "#ffffff"); sh.addColorStop(1, glow ? "#b9f5d6" : "#cfd6dd"); x.fillStyle = sh; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
    x.fillStyle = "#1c2430"; x.beginPath(); for (var k = 0; k < 5; k++) { var a = -Math.PI / 2 + k / 5 * 6.283; x.lineTo(Math.cos(a) * r * .32, Math.sin(a) * r * .32); } x.fill();
    for (var q = 0; q < 5; q++) { var a3 = -Math.PI / 2 + q / 5 * 6.283; x.beginPath(); x.arc(Math.cos(a3) * r * .82, Math.sin(a3) * r * .82, r * .22, 0, 7); x.fill(); }
    x.restore();
  }
  function drawGhost(x) {
    var g = S.ghost; if (!g || g.life <= 0) return;
    x.globalAlpha = Math.min(1, g.life); x.fillStyle = "rgba(255,255,255,.8)";
    for (var t = 0; t < 3; t += .06) { var gx = g.x + g.vx * t, gy = g.y + g.vy * t - (g.photon ? 0 : .5 * G * t * t); if (gy < 0 || gx < 0 || gx > WM) break; x.beginPath(); x.arc(sx(gx), sy(gy), 2, 0, 7); x.fill(); }
    x.font = "600 13px ui-monospace, monospace"; x.textAlign = "center"; x.fillStyle = "rgba(0,0,0,.5)"; x.fillRect(240, 322, 480, 22); x.fillStyle = g.power ? "#ffe48a" : "#fff";
    x.fillText((g.power ? "POWER SHOT  " : "") + "v = " + g.v.toFixed(1) + " m/s  θ = " + g.th + "°  R = " + g.R.toFixed(1) + " m  H = " + g.H.toFixed(1) + " m", 480, 338);
    x.globalAlpha = 1;
  }
  function drawWeather(x, api) {
    var w = S.arena.weather; if (!w || api.reduce) return;
    while (S.weather.length < (w === "rain" ? 120 : 80)) S.weather.push({ x: Math.random() * 1000, y: Math.random() * 540, v: w === "rain" ? 600 + Math.random() * 300 : 40 + Math.random() * 40 });
    x.strokeStyle = "rgba(200,220,255,.45)"; x.fillStyle = "rgba(255,255,255,.85)"; x.lineWidth = 1;
    S.weather.forEach(function (d) { d.y += d.v / 60; d.x += (w === "rain" ? -2 : Math.sin(api.t + d.v) * .6); if (d.y > 540) { d.y = -10; d.x = Math.random() * 1000; }
      if (w === "rain") { x.beginPath(); x.moveTo(d.x, d.y); x.lineTo(d.x - 4, d.y + 12); x.stroke(); } else { x.beginPath(); x.arc(d.x, d.y, 2, 0, 7); x.fill(); } });
  }
  function drawIntro(x, api) {
    var I = S.intro, p = I.p, k = Math.min(1, I.t / .2), out = Math.max(0, (I.t - (I.dur - .15)) / .15), side = p.side ? -1 : 1;
    x.globalAlpha = .55 * (1 - out); x.fillStyle = "#000"; x.fillRect(0, 0, 960, 540); x.globalAlpha = 1 - out;
    if (!api.reduce) { x.strokeStyle = I.P.col; x.globalAlpha = .35 * (1 - out); x.lineWidth = 3; for (var i = 0; i < 24; i++) { var a = i / 24 * 6.283 + I.t; x.beginPath(); x.moveTo(480 + Math.cos(a) * 120, 270 + Math.sin(a) * 80); x.lineTo(480 + Math.cos(a) * 700, 270 + Math.sin(a) * 500); x.stroke(); } }
    x.globalAlpha = 1 - out;
    var bx = side > 0 ? -400 + k * 420 : 960 + 400 - k * 420 - 520;
    x.fillStyle = "rgba(10,14,24,.92)"; x.beginPath(); x.moveTo(bx, 190); x.lineTo(bx + 520, 190); x.lineTo(bx + 500, 350); x.lineTo(bx - 20, 350); x.fill();
    x.fillStyle = I.P.col; x.fillRect(bx, 190, 520, 6); x.fillRect(bx - 20, 344, 520, 6);
    head(x, p.c, bx + 90, 270, 62, side, { mood: "fight", mouth: .5 + .5 * Math.abs(Math.sin(api.t * 20)) });
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "900 40px system-ui, sans-serif"; x.fillText(I.P.name.toUpperCase(), bx + 175, 268);
    x.font = "600 15px system-ui"; x.fillStyle = I.P.col; x.fillText(p.c.name + " · " + I.P.dur + " s · power shot ready", bx + 178, 298);
    x.globalAlpha = 1;
  }
  var hudCv = null, hudKey = "";
  // phones: the 960-wide canvas shrinks a lot, so small HUD text grows (up to 24 canvas px) to stay readable
  function hudK() { var cv = S.api && S.api.x && S.api.x.canvas, w = (cv && cv.clientWidth) || 960; return Math.max(1, Math.min(2.2, 640 / w)); }
  function fz(n) { var k = hudK(), st = S.api && S.api.settings && S.api.settings.get ? (+S.api.settings.get("textScale") || 1) : 1; return Math.round(Math.max(n, Math.min(n * k, 24)) * st); }
  function hud(x, api) {
    var key = [hudK().toFixed(2), S.mode, S.score[0], S.score[1], S.golden ? "g" : Math.ceil(Math.max(0, S.time)), S.time < 10 && Math.floor(api.t * 3) % 2, S.arena.id,
      S.p.map(function (p) { return p ? [p.c.id, p.cpu, Math.round((p.power > 0 ? p.power / p.powerMax : p.meter) * 150), p.power > 0, p.meter >= 1 && Math.floor(api.t * 4) % 2].join(":") : "-"; }).join("/"),
      S.flash && S.flash.t > 0 && S.state === "play" ? S.flash.text + Math.round(Math.min(1, S.flash.t) * 10) : "", S.mode === "tut" ? S.tut : "", S.hint && S.hint.t > 0 ? S.hint.text + Math.round(Math.min(1, S.hint.t) * 10) : ""].join("|");
    if (!hudCv) { hudCv = layer(); }
    if (key !== hudKey) { hudKey = key; var hx = hudCv.getContext("2d"); hx.clearRect(0, 0, 960, 540); hudStatic(hx, api); }
    x.drawImage(hudCv, 0, 0);
    hudLive(x, api);
  }
  function hudStatic(x, api) {
    x.textAlign = "center"; x.fillStyle = "rgba(4,12,18,.8)"; x.beginPath(); x.roundRect ? x.roundRect(350, 10, 260, 56, 14) : x.rect(350, 10, 260, 56); x.fill();
    if (S.mode === "tut") { x.fillStyle = "#fff"; x.font = "700 " + fz(18) + "px system-ui"; x.fillText("Practice", 480, 44); }
    else { x.fillStyle = "#fff"; x.font = "900 " + fz(32) + "px system-ui"; x.fillText(S.score[0], 410, 50); x.fillText(S.score[1], 550, 50); x.font = "700 " + fz(15) + "px ui-monospace, monospace"; x.fillStyle = S.time < 10 && Math.floor(api.t * 3) % 2 ? "#ff8080" : "#ffe9a8"; x.fillText(S.golden ? "GOLDEN" : Math.ceil(Math.max(0, S.time)) + "s", 480, 44); x.font = "" + fz(11) + "px system-ui"; x.fillStyle = "rgba(255,255,255,.7)"; x.fillText(S.arena.name, 480, 60); }
    S.p.forEach(function (p, i) {
      if (!p) return; var bx = i ? 630 : 30, w = 300;
      x.textAlign = i ? "right" : "left"; x.font = "800 " + fz(14) + "px system-ui"; x.fillStyle = "#fff"; x.fillText(p.c.name + (p.cpu ? " (CPU)" : i ? " (P2)" : " (You)"), i ? bx + w : bx, 26);
      x.fillStyle = "rgba(255,255,255,.15)"; x.fillRect(bx, 34, w, 9);
      var full = p.meter >= 1, v = p.power > 0 ? p.power / p.powerMax : p.meter, P = p.P; x.fillStyle = p.power > 0 ? P.col : full ? (Math.floor(api.t * 4) % 2 ? "#f6c445" : "#fff3c4") : "#7ef0ff"; x.fillRect(i ? bx + w * (1 - v) : bx, 34, w * v, 9);
      x.font = "" + fz(12) + "px system-ui"; x.fillStyle = "rgba(255,255,255,.85)"; x.fillText(p.power > 0 ? P.name + " active: power shots on" : full ? P.name + " ready! (" + api.keyName(i && S.mode === "duo" ? "p2power" : "power") + ")" : P.name, i ? bx + w : bx, 58);
    });
    if (S.flash && S.flash.t > 0 && S.state === "play") { x.globalAlpha = Math.min(1, S.flash.t); x.fillStyle = "rgba(4,12,18,.85)"; x.fillRect(130, 78, 700, 50); x.fillStyle = S.flash.col; x.font = "800 " + fz(16) + "px system-ui"; x.textAlign = "center"; x.fillText(S.flash.text + " (game metaphor)", 480, 98); x.fillStyle = "#dfe"; x.font = "" + fz(12.5) + "px system-ui"; x.fillText(S.flash.idea.length > 112 ? S.flash.idea.slice(0, 110) + "…" : S.flash.idea, 480, 118); x.globalAlpha = 1; }
    if (S.mode === "tut" && TUT[S.tut]) { x.fillStyle = "rgba(4,12,18,.85)"; x.fillRect(110, 78, 740, 56); x.fillStyle = "#7ef0ff"; x.font = "700 " + fz(16) + "px system-ui"; x.textAlign = "center"; x.fillText("Step " + (S.tut + 1) + " of 4: " + TUT[S.tut][0], 480, 100); x.fillStyle = "#fff"; x.font = "" + fz(13.5) + "px system-ui"; x.fillText(TUT[S.tut][1].slice(0, 112), 480, 122); }
    if (S.hint && S.hint.t > 0) { var hx = S.hint.x, hy = 196; x.globalAlpha = Math.min(1, S.hint.t); x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(hx - 92, hy - 40, 184, 30, 10) : x.rect(hx - 92, hy - 40, 184, 30); x.fill(); x.beginPath(); x.moveTo(hx - 6, hy - 10); x.lineTo(hx, hy); x.lineTo(hx + 6, hy - 10); x.fill(); x.fillStyle = "#14202c"; x.font = "700 " + fz(12.5) + "px system-ui"; x.textAlign = "center"; x.fillText(S.hint.text, hx, hy - 21); x.globalAlpha = 1; }
  }
  function hudLive(x, api) {
    if (S.comm && S.comm.life > 0) { var ck = hudK(); x.globalAlpha = Math.min(1, S.comm.life); x.font = "700 " + Math.round(14 * ck) + "px system-ui"; x.textAlign = "center"; var cw = x.measureText(S.comm.t).width + 28; x.fillStyle = "rgba(4,12,18,.82)"; x.fillRect(480 - cw / 2, 500 - 20 * ck, cw, 26 * ck); x.fillStyle = "#ffe9a8"; x.fillText(S.comm.t, 480, 500 - 2 * ck); x.globalAlpha = 1; }
    pops.forEach(function (p) { x.globalAlpha = Math.min(1, p.life); x.font = "700 " + fz(13) + "px system-ui"; x.textAlign = "center"; var tx = Math.max(120, Math.min(840, sx(p.x))), ty = sy(p.y); x.fillStyle = "rgba(0,0,0,.55)"; var tw = x.measureText(p.t).width + 14; x.fillRect(tx - tw / 2, ty - 15, tw, 21); x.fillStyle = p.col; x.fillText(p.t, tx, ty); });
    x.globalAlpha = 1;
    if (S.state === "kickoff" && S.mode !== "tut") { var n = Math.ceil((S.stateT - .22) / .36); x.font = "900 " + fz(40) + "px system-ui"; x.textAlign = "center"; x.fillStyle = "rgba(0,0,0,.35)"; x.fillText(n > 0 ? String(n) : "GO!", 483, 183); x.fillStyle = "#fff"; x.fillText(n > 0 ? String(n) : "GO!", 480, 180);
      x.font = "700 " + fz(13) + "px system-ui"; x.fillStyle = "#ffe9a8"; x.fillText(S.toss === 0 ? "◀ Ball to " + S.p[0].c.name.split(" ").pop() : "Ball to " + S.p[1].c.name.split(" ").pop() + " ▶", 480, 204); }
    if (S.item) { var it = S.item, ix = sx(it.x), iy = sy(it.y + Math.sin(api.t * 3) * .15); x.fillStyle = it.it.col; x.globalAlpha = .9; x.beginPath(); x.arc(ix, iy, 16, 0, 7); x.fill(); x.globalAlpha = 1; x.fillStyle = "#0b1620"; x.font = "800 " + fz(11) + "px system-ui"; x.textAlign = "center"; x.fillText("?", ix, iy + 4); x.fillStyle = "#fff"; x.fillText(it.it.label, ix, iy - 22); }
  }
  var HINTS = ["Get under it and head it!", "Lob it! 55° flies higher", "Low kick: 25° goes fast", "Dash! Double-tap", "Use your superpower!", "Defend the goal!", "Power shots knock keepers back!"];
  function crowdHints(api, dt) {
    if (S.mode === "duo" || S.mode === "tut" || S.state !== "play") return;
    S.hintT -= dt; if (S.hint) S.hint.t -= dt;
    if (S.hintT <= 0) { S.hintT = 9 + Math.random() * 6; var p = S.p[0], b = S.ball, h;
      if (p.meter >= 1) h = HINTS[4]; else if (b.x < 5 && b.vx < 0) h = HINTS[5]; else if (b.y > 2 && Math.abs(b.x - p.x) < 3) h = HINTS[0]; else if (Math.abs(b.x - WM) > 10) h = HINTS[1]; else h = HINTS[Math.floor(Math.random() * HINTS.length)];
      var fans = S.crowd.filter(function (f) { return f.side === 0 && f.y > 220; }); var fan = fans[Math.floor(Math.random() * fans.length)] || { x: 240 };
      S.hint = { text: h, x: Math.max(100, Math.min(860, fan.x)), t: 3 }; if (Math.random() < .35) api.sound.chant(); }
  }

  var frame = 0;
  var game = {
    song: A.song(300, "funk", { bpm: 112 }), actions: ACTIONS,
    menu: function (api) { menu(api); },
    init: function (api) {
      S.api = api; S.drops = []; S.bolts = []; S.t = 0;
      api.panel(
        "<p>Each kick launches the ball with speed <span class='gm-eq'>v</span> at angle <span class='gm-eq'>θ</span>. With no air drag the path is a parabola:</p>" +
        "<table><tr><td>Range</td><td><span class='gm-eq'>R = v² sin 2θ / g</span> (m)</td></tr><tr><td>Max height</td><td><span class='gm-eq'>H = v² sin²θ / 2g</span> (m)</td></tr><tr><td>Flight time</td><td><span class='gm-eq'>T = 2v sinθ / g</span> (s)</td></tr><tr><td>Bounce</td><td><span class='gm-eq'>e = v_after / v_before</span></td></tr><tr><td>Kicking a rival</td><td><span class='gm-eq'>Δv = J / m</span> (m/s)</td></tr></table>" +
        "<p class='gm-small'>Model: g = 9.8 m/s², 1 m = 55 px, no air drag or spin, players far heavier than the ball; the turf's bounce and roll change with rain and snow. Range figures assume launch and landing at the same height. Superpowers, power shots and items are labelled game metaphors. Course: PHYS 111, motion in 2D and collisions.</p>",
        "<p class='gm-small'>After each goal the ball is thrown to the side that conceded. Phones: move the buttons in Settings; turn sideways or use Full screen.</p>");
      newMatch(player(A.byId.einstein, 0, true, .5), player(A.byId.curie, 1, true, .5), "demo", { arena: AR.night }); S.state = "play"; S.ball.hold = false;
      setupCheats(api); registerOptions(api); menu(api); S.mode = "demo";
    },
    update: function (dt, api) {
      S.t += dt; if ((CT.power || heroOn()) && S.p && S.p[0] && S.state === "play" && S.p[0].power <= 0) S.p[0].meter = 1;
      pops.forEach(function (p) { p.life -= dt; p.y += dt * .3; }); pops = pops.filter(function (p) { return p.life > 0; });
      if (S.comm) S.comm.life -= dt; if (S.ghost) S.ghost.life -= dt; if (S.flash) S.flash.t -= dt; if (S.fireworks > 0) S.fireworks -= dt; if (S.cageHit > 0) S.cageHit -= dt; if (S.fade > 0) S.fade -= dt;
      if (S.qflash) { S.qflash.t -= dt; if (S.qflash.t <= 0) S.qflash = null; } if (S.shock) { S.shock.t -= dt; if (S.shock.t <= 0) S.shock = null; }
      S.crowd.forEach(function (f) { if (f.moodT > 0) { f.moodT -= dt; if (f.moodT <= 0) f.mood = 0; } });
      S.bolts.forEach(function (b) { b.t -= dt; }); S.bolts = S.bolts.filter(function (b) { return b.t > 0; }); if (S.ray) { S.ray.t -= dt; if (S.ray.t <= 0) S.ray = null; }
      netStep(dt);
      var demo = S.mode === "demo";
      if (S.post && S.state === "over" && !demo) { postStep(api, dt); return; }
      if (!demo && (api.overlayOpen() || S.over)) return;
      if (demo && !api.overlayOpen()) { S.mode = "menu"; return; }
      if (S.state === "intro") { S.intro.t += dt; if (S.intro.t >= S.intro.dur) { S.state = "play"; startPower(api, S.intro.p); S.intro = null; } return; }
      if (S.state === "kickoff") { S.stateT -= dt; physics(api, dt); if (S.stateT <= 0) { S.state = "play"; releaseBall(); api.sound.sfx("whistle"); } return; }
      if (S.state === "celebrate") { S.stateT -= dt; physics(api, dt); api.sound.crowd(1); if (S.stateT <= 0) afterGoal(api); return; }
      if (S.state !== "play") return;
      physics(api, dt);
      var b = S.ball, danger = Math.min(1, Math.max(0, 1 - Math.min(b.x, WM - b.x) / 6)); S.excite += ((.25 + danger * .7) - S.excite) * dt * 1.5; api.sound.crowd(demo ? 0 : S.excite);
      crowdHints(api, dt);
      if (S.mode === "tut" && TUT[S.tut] && TUT[S.tut][2](S.p[0])) tutNext(api);
      if (S.mode === "cup" || S.mode === "duo" || S.mode === "quick" || S.mode === "career") { S.time -= dt; if (S.time <= 0 && !S.over && S.state === "play") end(api);
        else if (!S.halfDone && isFinite(S.len) && S.time <= S.len / 2) { S.halfDone = true; api.sound.sfx("whistle"); api.banner("HALF-TIME", { size: 72, sub: S.score[0] + " – " + S.score[1], dur: 1.5, y: 214, col: "#dbeafe", edge: "#1e3a5f" }); comment("Half-time: " + S.score[0] + " – " + S.score[1] + ".");
          if (S.mode === "career" && window.KickCareerUI) window.KickCareerUI.halftime(api); } }
    },
    draw: function (api) {
      var x = api.x; frame++;
      if (!S.bg) S.bg = buildBg();
      x.drawImage(S.bg, 0, 0);
      if (!S.crowdCv || frame % 3 === 0) drawCrowd(api);
      x.drawImage(S.crowdCv, 0, 0);
      x.font = "800 13px system-ui, sans-serif"; x.textAlign = "center"; ["EE HUB ARCADE", "R = v² sin 2θ / g", "PHYS 111", "e = v₂ / v₁", "MOMENTUM CUP"].forEach(function (t, i) { x.fillStyle = ["#3dd68c", "#f6c445", "#7ef0ff", "#ff9d5c", "#ffffff"][i]; x.fillText(t, ((i * 200 + api.t * 20) % 1000) - 20, 300); });
      if (!S.nets[0].live || !S.nets[1].live) { if (!S.nets[0].live && !S.nets[1].live) x.drawImage(S.restCloth, 0, 0); else { x.save(); x.beginPath(); x.rect(S.nets[0].live ? 480 : 0, 0, 480, 540); x.clip(); x.drawImage(S.restCloth, 0, 0); x.restore(); } }
      drawGoalCloth(x, 0); drawGoalCloth(x, 1); drawGhost(x);
      S.drops.forEach(function (d) { x.fillStyle = "#c81d25"; x.beginPath(); x.arc(sx(d.x), sy(d.y), 2, 0, 7); x.fill(); });
      S.p.forEach(function (p) { if (p && p.power > 0 && pw(p) === "tesla") drawTesla(x, api, p); });
      if (S.post && S.state === "over") drawPodium(x, api);
      S.p.forEach(function (p) { if (!p) return; drawPlayer(x, api, p); if (S.post && S.state === "over" && S.post.champ && S.post.win === p.side && S.post.t > 1.8 && api.trophy) api.trophy("cup", sx(p.x), sy(p.y) - 158 - Math.abs(Math.sin(api.t * 5)) * 6, .62, api.t); if (p.power > 0 && pw(p) === "bohr") [-1, 1].forEach(function (g) { var gx = (p.side ? WM - 2.2 : 2.2) + g * .9; x.globalAlpha = .45 + .2 * Math.sin(api.t * 6 + g); head(x, p.c, sx(gx), sy(1.5 + Math.sin(S.t * 3 + g) * .5), HR * PX, p.face, { mood: "happy" }); x.globalAlpha = 1; }); });
      if (S.apple) { var ax = sx(S.apple.x), ay = sy(S.apple.y); x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(ax, GY + 4, 14, 4, 0, 0, 7); x.fill(); x.fillStyle = "#d62828"; x.beginPath(); x.arc(ax, ay, 20, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.4)"; x.beginPath(); x.arc(ax - 6, ay - 6, 6, 0, 7); x.fill(); x.fillStyle = "#3b7a2a"; x.fillRect(ax - 2, ay - 28, 4, 10); x.beginPath(); x.ellipse(ax + 8, ay - 24, 8, 4, .4, 0, 7); x.fill(); }
      drawBall(x, api);
      if (S.qflash) { x.strokeStyle = "rgba(198,182,255," + S.qflash.t * 3 + ")"; x.lineWidth = 3; x.beginPath(); x.arc(sx(S.qflash.x), sy(S.qflash.y), 20 + (1 - S.qflash.t * 3) * 30, 0, 7); x.stroke(); }
      if (S.shock) { x.strokeStyle = "rgba(246,196,69," + S.shock.t * 2 + ")"; x.lineWidth = 4; x.beginPath(); x.arc(sx(S.shock.x), sy(S.shock.y), 10 + (1 - S.shock.t / .4) * 60, 0, 7); x.stroke(); }
      S.bolts.forEach(function (bo) { var a1 = sx(bo.x1), b1 = sy(bo.y1), a2 = sx(bo.x2), b2 = sy(bo.y2); bolt(x, a1, b1, a2, b2, bo.seed, 7, "rgba(140,190,255," + bo.t * 2 + ")"); bolt(x, a1, b1, a2, b2, bo.seed, 2.5, "rgba(255,255,255," + bo.t * 3.5 + ")"); });
      if (S.ray) { var rp = S.ray.from; x.strokeStyle = "rgba(255,80,80," + S.ray.t + ")"; x.lineWidth = 14; x.beginPath(); x.moveTo(sx(rp.x), sy(rp.y + 1.3)); x.lineTo(rp.face > 0 ? 960 : 0, sy(1.2)); x.stroke(); x.strokeStyle = "rgba(255,240,240," + S.ray.t + ")"; x.lineWidth = 4; x.stroke(); }
      drawGoalFront(x, 0); drawGoalFront(x, 1);
      var ein = S.p.filter(function (p) { return p && p.power > 0 && pw(p) === "einstein"; })[0];
      if (ein) { x.fillStyle = "rgba(90,140,255,.13)"; x.fillRect(0, 0, 960, 540); if (!api.reduce) { x.strokeStyle = "rgba(160,200,255,.35)"; x.lineWidth = 2; for (var k2 = 0; k2 < 3; k2++) { x.beginPath(); x.arc(sx(ein.x), sy(ein.y + 1.2), ((api.t * 80 + k2 * 90) % 270), 0, 7); x.stroke(); } } }
      if (S.storm) { x.fillStyle = "rgba(120,40,180,.1)"; x.fillRect(0, 0, 960, 540); }
      drawWeather(x, api);
      if (S.fade > 0) { x.fillStyle = "rgba(0,0,0," + Math.min(.8, S.fade * 2.3) + ")"; x.fillRect(0, 0, 960, 540); }
      if (S.mode !== "demo" && S.mode !== "menu") hud(x, api);
      if (S.state === "intro" && S.intro) drawIntro(x, api);
    }
  };
  A.run(game);
  window.MomentumCup = { dbg: { drawGoalCloth: drawGoalCloth, drawGoalBack: drawGoalBack, drawGoalFront: drawGoalFront, drawPlayer: drawPlayer, drawBall: drawBall, hud: hud, drawCrowd: drawCrowd, drawWeather: drawWeather }, S: S, kick: kick, player: player, POWERS: POWERS, ARENAS: ARENAS, CUP: CUP, VOICE: VOICE, constants: { G: G, DRIVE: DRIVE, LOB: LOB, KICK_V: KICK_V } };
})();
