/* Impulse Arena: a 2.5D scientist fighter (PHYS 111: Newton's laws, impulse and momentum).
 * Rules, frame data, specials, finishers and the CPU live in clashdata.js (ClashData) so Node can test them.
 * This file draws the arenas and fighters, reads the remappable inputs, runs the menus (tower, versus, two players,
 * training, move lists, tutorial) and turns simulation events into sound, camera and HUD feedback.
 * Physics on screen: J = FΔt = mΔv, Δv = J/m, F̄ = J/Δt, a = μg. Specials are labelled game metaphors. Cartoon damage only. */
(function () {
  "use strict";
  var A = window.Arcade, D = window.ClashData, PH = D.PHYS, PX = 100, GY = 468, FB = 330, W = 960;
  var store = A.store, esc = A.esc, C = window.ClashCareer;

  /* ---------- actions: P1 (keyboard + phone buttons), P2 (keyboard, or top phone buttons in two-player), training keys ---------- */
  var ACTIONS = [
    { id: "left", label: "Move left (double-tap: dash/back-dash)", keys: ["KeyA", "ArrowLeft"], touch: { label: "◀", x: 9, y: 92, s: 0.9 } },
    { id: "right", label: "Move right (double-tap: dash/back-dash)", keys: ["KeyD", "ArrowRight"], touch: { label: "▶", x: 40, y: 92, s: 0.9 } },
    { id: "up", label: "Jump", keys: ["KeyW", "ArrowUp"], touch: { label: "▲", x: 24.5, y: 78, s: 0.9 } },
    { id: "down", label: "Crouch", keys: ["KeyS", "ArrowDown"], touch: { label: "▼", x: 24.5, y: 92, s: 0.9 } },
    { id: "lp", label: "Low punch (LP)", keys: ["KeyJ", "KeyF"], touch: { label: "LP", x: 75.5, y: 92, s: 0.9 } },
    { id: "hp", label: "High punch (HP)", keys: ["KeyU", "KeyR"], touch: { label: "HP", x: 75.5, y: 78, s: 0.9 } },
    { id: "lk", label: "Low kick (LK)", keys: ["KeyK", "KeyG"], touch: { label: "LK", x: 92, y: 92, s: 0.9 } },
    { id: "hk", label: "High kick (HK)", keys: ["KeyI", "KeyT"], touch: { label: "HK", x: 92, y: 78, s: 0.9 } },
    { id: "block", label: "Block (hold; with crouch to block low)", keys: ["KeyL", "KeyH", "Space"], touch: { label: "🛡", x: 59, y: 92, s: 0.9 } },
    { id: "special", label: "Special (with a direction: shortcut; alone: arm Super)", keys: ["KeyO", "KeyY"], touch: { label: "★", x: 59, y: 78, s: 0.9 } },
    { id: "p2left", label: "P2 move left", keys: ["ArrowLeft"], touch: { label: "◀", x: 9, y: 22, s: 0.9 } },
    { id: "p2right", label: "P2 move right", keys: ["ArrowRight"], touch: { label: "▶", x: 40, y: 22, s: 0.9 } },
    { id: "p2up", label: "P2 jump", keys: ["ArrowUp"], touch: { label: "▲", x: 24.5, y: 8, s: 0.9 } },
    { id: "p2down", label: "P2 crouch", keys: ["ArrowDown"], touch: { label: "▼", x: 24.5, y: 22, s: 0.9 } },
    { id: "p2lp", label: "P2 low punch", keys: ["KeyJ", "Numpad1"], touch: { label: "LP", x: 75.5, y: 22, s: 0.9 } },
    { id: "p2hp", label: "P2 high punch", keys: ["KeyU", "Numpad4"], touch: { label: "HP", x: 75.5, y: 8, s: 0.9 } },
    { id: "p2lk", label: "P2 low kick", keys: ["KeyK", "Numpad2"], touch: { label: "LK", x: 92, y: 22, s: 0.9 } },
    { id: "p2hk", label: "P2 high kick", keys: ["KeyI", "Numpad5"], touch: { label: "HK", x: 92, y: 8, s: 0.9 } },
    { id: "p2block", label: "P2 block", keys: ["KeyL", "Numpad3"], touch: { label: "🛡", x: 59, y: 22, s: 0.9 } },
    { id: "p2special", label: "P2 special", keys: ["KeyO", "Numpad6"], touch: { label: "★", x: 59, y: 8, s: 0.9 } },
    { id: "tr1", label: "Training: reset positions", keys: ["Digit1"] },
    { id: "tr2", label: "Training: change dummy", keys: ["Digit2"] },
    { id: "tr3", label: "Training: freeze / unfreeze", keys: ["Digit3"] },
    { id: "tr4", label: "Training: step one frame (while frozen)", keys: ["Digit4"] }
  ];
  var ACT = {}; ACTIONS.forEach(function (a) { ACT[a.id] = a; });
  var P1_IDS = ["left", "right", "up", "down", "lp", "hp", "lk", "hk", "block", "special"];
  var P2_IDS = P1_IDS.map(function (id) { return "p2" + id; });
  function codes(id) { var s = A.settings && A.settings.keys && A.settings.keys[id]; return s && s.length ? s : ACT[id].keys; }

  var S = { mode: "menu", m: null, cam: 2.4, t: 0, fx: [], pops: [], cap: null, read: null, hurt: 0, excite: 0.2, shakeBar: [0, 0], combo: [null, null],
    inputs: [], later: [], frozen: false, dummy: "stand", tut: -1, look: [], arena: D.ARENAS[0], human: [true, false], ended: false, armed: [0, 0], lastHit: null,
    pick: { p1: store("clash-p1") || "newton", p2: "tesla", diff: store("clash-diff") || "normal", arena: "random", weapons: store("clash-wpn") !== false, start: store("clash-start") || "" } };
  var DUMMIES = ["stand", "crouch", "jump", "guard", "cpu"];
  var DUMMY_NAME = { stand: "Stand still", crouch: "Crouch", jump: "Jump", guard: "Block everything", cpu: "Fight back (CPU)" };

  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["06495abb0acb59a8ad05ed03b97c938a961cba82425e26f7dacec6346c143770","5c8c1783f6f7c4fc2e3dbf2824da39ed44b2c512696a38afc139f317ed114f27"],"god":["b8ea2bd682486c20ffb5e625220277436e8f63fec54e9ed16a0cc45cb79b76d4","7d1303945ce72d3843e6cc6c3a750e444adef73e7ab845cf0f52c1286d908527"],"onehit":["5dcbe5233f792aa9205d44f21f0fe462fdc4c61f6307bbac24abb7579ed8f6d5","cdaaaa0b80dee2008672e2611edcd7a73e9f2ef6e9276b6efc65dd266536a07f"],"meter":["24bd6efe52bd18fd41ca4c7d662542fa9f3c25038a74983a14c0deba5ec6843c","4524d7c23c190bee7005bfd436475ac7f2989fa2ad53041f46286eb6ab4ec6b3"],"heal":["bdf6521b2d3d0d8543605fdc02f66317bc3d666d981e9be0b9eb4d1b6c5ba535","7638dd370c848301203e323869ee1536cc5f183061b69760e48e55056c2a3efe"],"bosses":["b2360555c6d9a1e4bfd4fb8138e42c911361a7bc334117a99fde9bc117d7111f","0aff3f587d403bd151551f06eba1d08e8144b770ff7da7518852a3fadf45e419"],"tower":["9d04c0978fbb97d5d0cf6549fbe884f0f1c146962d89622ee0fcfa884ad8f49e","3b884b6b0b74f4e21e5a44ef87f8281b7707975692121a7f08cc3bb8c7fac504"],"roster":["364a873e6d8f918cb2f7bdf61e7e97abe22aba3e2d33bf21b8079b0070617f4a","13cebe5461ab872d35395c2818173f2dced57edf626a427d89ef0dfb0bce7a9a"],"slow":["9534b7444e0ec753b7aab35942aea2bef37e3cf3a96080f2870d787d7367555b","7f3b73701eaa40b894d48fecc3d3ff26e477b42d3b48b4a7a611527b3d65f644"],"party":["962aeeb60cbaa901f30a24a87a5c79d9b7c975591178bdca773def1a88ada77d","695c81c234337716931725fe45b845f22b00223de3a050b127ce9040bc580139"],"_combo":"b670c7f60ee93712eaca66a56630be99cd102467589ff5fd178186c0502f690c","_swipe":"dc2f25efa42ed3166471f0d9cbafb578c964d52ada61de4bfc1cfec5e4484076"}/*]CH*/, CT = {}, HX = false;
  function heroOn() { return !!(HX && api0 && api0.hero.active && S.human && S.human[0] && S.mode !== "duo"); }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Win this round", h: CH.skip, run: function () { if (S.m && !S.ended) D.forceRound(S.m, 0); } },
      god: { label: "Take no damage", h: CH.god, run: function () { CT.god = 1; } },
      onehit: { label: "One-hit knockouts", h: CH.onehit, run: function () { CT.one = 1; } },
      meter: { label: "Super meter always full", h: CH.meter, run: function () { CT.meter = 1; } },
      heal: { label: "Full health now", h: CH.heal, run: function () { if (S.m) S.m.f[0].hp = PH.hp; } },
      bosses: { label: "Bosses playable", h: CH.bosses, run: function () { var p = prog(); ["inertia", "entropy", "overload"].forEach(function (b) { p.unlocked[b] = 1; }); saveProg(); } },
      tower: { label: "Jump to this chapter's boss", h: CH.tower, run: function () { var p = prog(); p.g = Math.floor((p.g - 1) / 10) * 10 + 10; saveProg(); } },
      roster: { label: "Every fighter unlocked", h: CH.roster, run: function () { CT.roster = 1; } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function (ok) { if (ok) HX = true; menu(api); } });
  }
  function cheatTick(api) {
    if (!S.m || !S.m.f || !S.human || !S.human[0] || S.mode === "duo") return;
    var f = S.m.f[0], hx = heroOn(); f.god = !!(CT.god || hx); f.oneHit = !!(CT.one || hx); if (CT.meter || hx) f.meter = 100;
  }
  function look(id, side, mirror) {
    var c = A.byId[id] || D.FIGHTERS[id].look;
    if (side === 0 && heroOn()) return Object.assign({}, c, A.HERO, { name: "M.I. Bugaje" });
    if (side === 0 && S.human[0] && !mirror) c = A.styled(c);
    if (!mirror && (side === 0 || S.mode === "duo")) c = C.dress(c, (prog().costume || {})[id] | 0);
    if (mirror) c = Object.assign({}, c, { name: "Mirror " + c.name.split(" ").pop(), coat: "#20232b", eye: "#ff3355" });
    return c;
  }
  function shortName(f) { return S.look[f.side].name.split(" ").pop(); }
  function sx(x) { return (x - S.cam) * PX; }
  function sy(y) { return GY - y * PX; }
  function glyphs(inp) { return D.seqString(inp); }

  /* ---------- input ---------- */
  function readSide(api, side) {
    var ids = side ? P2_IDS : P1_IDS, duo = S.mode === "duo", excl = null;
    if (side === 0 && duo) { excl = []; P2_IDS.forEach(function (id) { excl = excl.concat(codes(id)); }); }
    function dn(i) { var id = ids[i]; if (!excl) return api.down(id); if (api.down("@" + id)) return true; return codes(id).some(function (c) { return excl.indexOf(c) < 0 && api.down(c); }); }
    function ht(i) { var id = ids[i]; if (!excl) return api.hit(id); if (api.hit("@" + id)) return true; return codes(id).some(function (c) { return excl.indexOf(c) < 0 && api.hit(c); }); }
    var c = { l: dn(0), r: dn(1), u: dn(2), d: dn(3), blk: dn(8), sp: dn(9), h: { LP: dn(4), HP: dn(5), LK: dn(6), HK: dn(7) }, p: { LP: ht(4), HP: ht(5), LK: ht(6), HK: ht(7), SP: ht(9) } };
    if (ht(2)) c.u = true;
    return c;
  }
  function recordInput(c, f) {
    var fw = f.face > 0 ? c.r : c.l, bk = f.face > 0 ? c.l : c.r;
    var arrow = { "": "•", D: "↓", U: "↑", F: "→", B: "←", DF: "↘", DB: "↙", UF: "↗", UB: "↖" }[(c.d ? "D" : c.u ? "U" : "") + (fw ? "F" : bk ? "B" : "")] || "•";
    var b = ["LP", "HP", "LK", "HK"].filter(function (k) { return c.p[k]; }); if (c.p.SP) b.push("SP"); if (c.blk && !S.wasBlk) b.push("BLK"); S.wasBlk = c.blk;
    var tok = arrow + (b.length ? " " + b.join("+") : "");
    var last = S.inputs[S.inputs.length - 1];
    if (!last || b.length || last.a !== arrow) { S.inputs.push({ a: arrow, s: tok, t: S.t }); if (S.inputs.length > 13) S.inputs.shift(); }
  }

  /* ---------- match lifecycle ---------- */
  function arenaById(id) { return D.ARENA[id] || D.ARENAS[0]; }
  function startMatch(api, o) {
    S.mode = o.mode; S.human = [!o.cpu0, !o.cpu1]; S.rung = o.rung || 0; S.ended = false; S.fx = []; S.pops = []; S.cap = null; S.read = null; S.combo = [null, null];
    S.inputs = []; S.frozen = false; S.maxCombo = 0; S.finisherDone = false; S.tutHold = 0;
    var start = o.mode === "circuit" || o.mode === "versus" || o.mode === "survival" ? (S.pick.start && A.owns("wpn-" + S.pick.start) ? S.pick.start : null) : null;
    var assist = o.mode !== "demo" && !!opt("ia_assist", false), tmr = +opt("ia_timer", 60);
    S.m = D.create({ p1: o.p1, p2: o.p2, mode: o.mode === "training" || o.mode === "tutorial" || o.mode === "trial" ? "training" : o.mode, seed: (Date.now() & 0xffff) + 1, weapons: o.weapons && opt("ia_drops", true) !== false,
      rounds: o.rounds || 2, roundTime: o.mode === "demo" ? 60 : tmr,
      p1o: { cpu: !!o.cpu0, skill: o.s0, weapon: start, takeMul: (o.p1take || 1) * (assist && o.mode !== "duo" ? 0.85 : 1) }, p2o: { cpu: !!o.cpu1, skill: o.skill, mirror: o.mirror, takeMul: o.p2take || 1 } });
    S.look = [look(o.p1, 0, false), look(o.p2, 1, o.mirror)];
    if (o.mirror) S.m.f[1].mirror = true;
    S.arena = arenaById(o.arena); S.cam = 1.2;
    if (o.mode === "demo") { api.useActions([]); return; }
    api.music(A.song(S.arena.seed, S.arena.style, { bpm: S.arena.bpm }));
    api.useActions(o.mode === "duo" ? P1_IDS.concat(P2_IDS) : P1_IDS);
    if (o.mode === "trial") { S.m.dummy = "stand"; S.m.trainMeter = true; S.m.f[1].cpu = null; }
    else S.trial = null;
    if (o.mode === "training" || o.mode === "tutorial") { S.m.dummy = o.mode === "tutorial" ? "tut" : S.dummy; S.m.trainMeter = o.mode === "training"; S.m.f[1].cpu = S.dummy === "cpu" && o.mode === "training" ? { s: 0.45, t: 0.5, q: [], hold: null, holdT: 0 } : null; }
    api.hide();
  }
  function demo(api) {
    var ids = D.ORDER, a = ids[Math.floor(Math.random() * ids.length)], b = ids[(ids.indexOf(a) + 1 + Math.floor(Math.random() * 7)) % ids.length];
    startMatch(api, { mode: "demo", p1: a, p2: b, cpu0: true, cpu1: true, s0: 0.6, skill: 0.6, arena: D.ARENAS[Math.floor(Math.random() * 5)].id, weapons: true });
  }

  /* ---------- events → feedback ---------- */
  function wx(e) { return sx(e.x); }
  function onEvent(api, e) {
    var m = S.m, demoMode = S.mode === "demo", R = api.reduce;
    var say = function (t) { if (!demoMode) api.sound.say(t); };
    switch (e.type) {
      case "round": {
        var last = m.f[0].wins === 1 && m.f[1].wins === 1;
        var name = last ? "FINAL ROUND" : "ROUND " + e.n;
        if (!demoMode) { api.banner(name, { col: "#ffd84a", edge: "#8a4b00", size: 96, dur: 1.4, y: 230 }); say(last ? "Final round" : "Round " + ["one", "two", "three", "four"][e.n - 1]); }
        break; }
      case "fight": if (!demoMode) { api.banner("FIGHT!", { col: "#ff6b6b", edge: "#6b0d0d", size: 130, dur: 0.9 }); say("Fight"); api.sound.sfx("whistle"); } break;
      case "jump": if (!demoMode) api.sound.sfx("jump"); break;
      case "dash": case "backdash": api.sound.sfx("dash"); dust(m.f[e.side].x, 0.3); break;
      case "move": break;
      case "hit": {
        var h = e.heavy, def = m.f[e.def], att = m.f[e.att];
        api.sound.sfx(h ? "heavy" : "hit");
        api.burst(sx(e.x), sy(e.y), h ? "#ffd166" : "#fff3c4", R ? 4 : h ? 22 : 10, h ? 340 : 220);
        S.fx.push({ k: "ring", x: e.x, y: e.y, t: 0, d: 0.25, col: h ? "#ffd166" : "#fff", r: h ? 70 : 40 });
        if (h) { api.hitstop(e.ko ? 0.14 : 0.07); api.kick(9); api.zoom(0.05, sx(e.x), sy(e.y)); } else api.kick(3);
        S.excite = Math.min(1, S.excite + (h ? 0.25 : 0.08));
        S.shakeBar[e.def] = 0.35;
        S.read = { label: e.label, J: e.J, dt: e.dt, F: e.F, m: e.m, dv: e.dv, blocked: false, t: 4, side: e.att, dmg: e.dmg, combo: e.combo, armored: e.armored };
        S.lastHit = Object.assign({ mv: att.mv && !e.proj ? att.mv : null }, S.read);
        pop("Δv " + e.dv.toFixed(1) + " m/s", e.x, e.y + 0.5, h ? "#ffd166" : "#fff");
        if (e.combo >= 2) { S.combo[e.att] = { n: e.combo, dmg: Math.round(def.comboDmg), t: 1.6 }; S.maxCombo = Math.max(S.maxCombo, e.combo); if (e.combo === 3 || e.combo === 5) api.sound.sfx("coin"); }
        if (S.human[e.def] && !S.human[e.att] && !demoMode) { S.hurt = h ? 0.5 : 0.3; api.buzz(h ? 40 : 18); }
        if (e.armored) pop("Armour: no knockback", e.x, e.y + 0.9, "#ff9d5c");
        break; }
      case "block":
        api.sound.sfx("block"); api.burst(sx(e.x), sy(e.y), "#7ef0ff", R ? 3 : 8, 200);
        S.fx.push({ k: "shield", x: e.x, y: e.y, t: 0, d: 0.2, face: m.f[e.def].face });
        S.read = { label: e.label, J: e.J, dt: e.dt, F: e.F, m: e.m, dv: e.dv, blocked: true, t: 4, side: e.att, dmg: e.dmg };
        S.lastHit = Object.assign({ mv: m.f[e.att].mv && !e.proj ? m.f[e.att].mv : null }, S.read);
        pop("Blocked: Δt ×4 → F̄ ÷4", e.x, e.y + 0.5, "#7ef0ff");
        break;
      case "special": {
        var f = m.f[e.side];
        api.sound.sfx({ proj: "zap", beam: "laser", rush: "dash", rise: "special", field: "power", shield: "power", buff: "power", tele: "laser", drop: "special", trap: "zap", aura: "zap", strike: "special", hop: "jump" }[e.kind] || "special");
        if (e.ex) { api.sound.sfx("power"); api.flash("#fff3a6", 0.15); }
        if (e.kind === "beam") { api.flash("#bfefff", 0.2); api.kick(5); }
        S.cap = { side: e.side, name: e.name, cap: e.cap, idea: e.idea, ex: e.ex, t: 3.2, who: S.look[e.side].name };
        S.excite = Math.min(1, S.excite + 0.15);
        api.burst(sx(f.x), sy(f.y + 1.2), D.FIGHTERS[f.id].col, R ? 4 : 16, 260);
        break; }
      case "proj": break;
      case "field":
        if (e.effect === "slow") pop("Their clock: ½ speed (γ = 2)", m.f[1 - e.side].x, 2.3, "#fff3a6");
        if (e.effect === "brake") pop("Motion opposed: μ ×3, speed ×0.45", m.f[1 - e.side].x, 2.3, "#a78bfa");
        if (e.effect === "scramble") pop("Left ⇄ right scrambled!", m.f[1 - e.side].x, 2.3, "#c084fc");
        if (e.effect === "drain") pop("−" + e.amount + " % super meter", m.f[1 - e.side].x, 2.3, "#c084fc");
        api.sound.sfx("zap"); break;
      case "shield": pop({ reflect: "Third law: ready to return any push", cage: "Field inside = 0", orbit: "3 electrons on allowed orbits", armor: "Armour", glide: "μ = 0.1" }[e.effect] || "", m.f[e.side].x, 2.4, "#7ef0ff"); break;
      case "counter": api.sound.sfx("block"); api.sound.sfx("heavy"); api.hitstop(0.08); pop("Equal and opposite: Δv = " + e.dv.toFixed(1) + " m/s back", e.x, 2.5, "#f6c445"); api.burst(sx(e.x), sy(1.2), "#f6c445", R ? 4 : 18, 300); break;
      case "reflect": api.sound.sfx("block"); pop("Reflected: v → −v", e.x, 2.0, "#f6c445"); break;
      case "absorb": api.sound.sfx("block"); pop(e.cage ? "Stopped by the cage" : "Electron absorbed the hit (" + e.left + " left)", e.x, 2.2, "#7ef0ff"); break;
      case "armor": break;
      case "tele": api.sound.sfx("laser"); S.fx.push({ k: "poof", x: e.x, y: 1, t: 0, d: 0.4 }); break;
      case "drop": pop("h = " + e.h + " m → lands at √(2gh) ≈ " + Math.sqrt(2 * PH.g * e.h).toFixed(1) + " m/s", e.x, 3.1, "#ffd166"); break;
      case "bonk": api.sound.sfx("stomp"); break;
      case "thud": api.sound.sfx("stomp"); dust(e.x, 0.6); break;
      case "dot": pop("Half-life damage: " + e.d0.toFixed(0) + " HP, halving each second", m.f[e.side].x, 2.7, "#3dd68c"); break;
      case "clash": api.sound.sfx("boom"); api.burst(sx(e.x), sy(e.y), "#fff", R ? 4 : 20, 300); break;
      case "chain": pop(e.name + "!", m.f[e.side].x, 2.8, "#ffd84a"); break;
      case "comboEnd": break;
      case "throw": api.sound.sfx("kick"); break;
      case "land": if (e.hard) { api.sound.sfx("stomp"); dust(e.x, 1); api.kick(4); } break;
      case "dust": break;
      case "tech": api.sound.sfx("block"); api.sound.sfx("click"); pop("Throw escaped! Equal and opposite.", e.x, 2.6, "#7ef0ff"); break;
      case "projbusy": if (S.human[e.side]) pop("One shot at a time", m.f[e.side].x, 2.6, "#aab"); break;
      case "super": {
        var sf = m.f[e.side]; api.banner(e.name.toUpperCase(), { col: D.FIGHTERS[sf.id].col, edge: "#111", size: 70, dur: 1.4, y: 170, sub: "SUPER" });
        if (!R) { api.flash("#ffffff", 0.25); api.slowmo(0.35, 0.5); } api.kick(10); api.sound.sfx("special"); api.sound.sfx("power"); S.excite = 1;
        S.cap = { side: e.side, name: e.name, cap: e.cap, idea: e.idea, ex: false, t: 3.6, who: S.look[e.side].name }; break; }
      case "armed": api.sound.sfx("power"); S.armed[e.side] = 1.5; pop("SUPER armed: next special is enhanced", m.f[e.side].x, 2.6, "#ffd84a"); break;
      case "nometer": if (S.human[e.side]) pop("Super needs 50 % meter (hold a direction for a shortcut)", m.f[e.side].x, 2.6, "#aab"); break;
      case "whiff": pop("Out of range", m.f[e.side].x, 2.3, "#aab"); break;
      case "wspawn": pop("A " + D.WEAPONS[e.id].name.toLowerCase() + " drops in!", S.cam + 4.8, 3.2, "#ffd84a"); api.sound.sfx("whistle"); break;
      case "pickup": api.sound.sfx("coin"); S.cap = { side: e.side, name: e.name + " picked up", cap: "Your HP becomes a " + e.name.toLowerCase() + " swing until it breaks or you are knocked down.", idea: e.idea, t: 3.2, who: S.look[e.side].name, weapon: true }; break;
      case "wdrop": pop("Dropped the " + D.WEAPONS[e.id].name.toLowerCase(), m.f[e.side].x, 2.2, "#ccc"); break;
      case "wbreak": api.sound.sfx("block"); pop(D.WEAPONS[e.id].name + " broke!", m.f[e.side].x, 2.4, "#ccc"); break;
      case "clink": api.sound.sfx("click"); break;
      case "finale": {
        var wn = m.f[e.winner];
        S.finaleAt = S.t;
        api.banner("FINALE!", { col: "#c084fc", edge: "#3d1f5c", size: 120, dur: 1.6, sub: S.human[e.winner] && !demoMode ? "Enter " + glyphs(e.input) + "  (or ↑ + ★)" : "" });
        say("Finale"); api.sound.sfx("ko"); S.excite = 1; void wn; break; }
      case "finisher": {
        var delay = Math.max(0, (S.finaleAt || 0) + 1.65 - S.t), nm = e.name.toUpperCase();
        S.later.push({ at: S.t + delay, fn: function () { api.banner(nm, { col: "#ffd84a", edge: "#8a4b00", size: 56, dur: 2.4, y: 84 }); } });
        S.cap = { side: e.side, name: e.name + " · comic finisher", cap: "", idea: e.text + " Nobody gets hurt.", t: 3.6, who: S.look[e.side].name, weapon: true };
        S.read = null; api.sound.sfx("special"); api.sound.roar(false); S.finisherDone = S.human[e.side]; break; }
      case "ko": case "finisherKO":
        api.sound.sfx("ko"); api.sound.roar(false);
        if (!demoMode) { api.banner("K.O.", { col: "#ff4d4d", edge: "#5a0000", size: 150, dur: 2.2 }); say("K.O."); }
        api.slowmo(0.3, 1.2); api.kick(10); S.excite = 1; break;
      case "timeup": if (!demoMode) { api.banner("TIME", { col: "#7ef0ff", edge: "#0b3a4a", size: 120, dur: 1.8 }); say("Time"); } break;
      case "draw": if (!demoMode) { api.banner("DOUBLE K.O.", { col: "#ffd84a", edge: "#5a3a00", size: 90, dur: 2 }); say("Double K.O."); } break;
      case "over": if (!demoMode) matchOver(api); else setTimeout(function () { if (S.mode === "demo") demo(api); }, 600); break;
    }
  }
  function pop(text, x, y, col) { if (!text) return; var busy = S.pops.filter(function (p) { return p.life > 1.3; }).length; S.pops.push({ t: text, x: x, y: y + busy * 0.3, col: col || "#fff", life: 1.9 }); if (S.pops.length > 8) S.pops.shift(); }
  function dust(x, k) { for (var i = 0; i < (S.reduce ? 2 : 6) * k; i++) S.fx.push({ k: "dust", x: x + (Math.random() - 0.5) * 0.5, y: 0.05, vx: (Math.random() - 0.5) * 1.6, vy: Math.random() * 0.8, t: 0, d: 0.6 + Math.random() * 0.3 }); }

  /* ---------- end of match ---------- */
  /* ---------- the player's profile (levels, unlocks, Circuit progress); old tower saves migrate in ---------- */
  var PROG = null;
  function prog() { if (!PROG) { PROG = C.migrate(store("clash-prog"), store("clash-tower"), store("clash-champ")); saveProg(); } return PROG; }
  function saveProg() { if (PROG) store("clash-prog", PROG); }
  function nameOf(id) { var c = A.byId[id] || D.FIGHTERS[id].look; return c.name; }
  function short(id) { return nameOf(id).split(" ").pop(); }
  function opt(id, dflt) { try { var v = api0 && api0.settings && api0.settings.get ? api0.settings.get(id) : undefined; return v === undefined || v === null ? dflt : v; } catch (e) { return dflt; } }
  function roundsFor(dflt) { var v = opt("ia_rounds", "auto"); return v === "auto" ? dflt : +v; }

  function matchOver(api) {
    if (S.ended) return; S.ended = true;
    var m = S.m, a = m.f[0], b = m.f[1], w = m.winner, duo = S.mode === "duo", won = w === 0, p = prog();
    var hp = Math.round(m.f[w >= 0 ? w : 0].hp), rung = Math.min(S.rung || 0, 100);
    var score = Math.min(5000, won ? 500 + hp * 5 + rung * 30 + S.maxCombo * 20 + (S.finisherDone ? 300 : 0) : a.wins * 100 + rung * 10);
    if (w >= 0) api.sound.say(S.look[w].name.split(" ").pop() + " wins");
    var info = { mode: S.mode, char: a.id, won: won, draw: w < 0, perfect: won && a.hp >= PH.hp * .999, finisher: S.finisherDone, combo: S.maxCombo, rung: S.rung }, rec = null, kind, title, sub = "Rounds " + a.wins + " – " + b.wins, trophy = won ? "medal" : "none";
    if (S.mode === "circuit") {
      A.report("impulse-arena", { result: won ? "win" : w < 0 ? "draw" : "lose", stage: C.reportStage(info), score: score, mode: "solo" });
      rec = C.record(p, info); saveProg();
      var chapterDone = won && S.rung % 10 === 0;
      kind = w < 0 ? "draw" : won ? (chapterDone ? "champion" : "win") : "eliminated";
      title = w < 0 ? "DRAW" : chapterDone ? "CHAPTER CLEARED!" : won ? (a.hp >= PH.hp * .999 ? "PERFECT!" : "K.O.! YOU WIN") : "KNOCKED BACK";
      sub += " · " + C.chapterName(Math.floor((S.rung - 1) / 10)) + " · rung " + ((S.rung - 1) % 10 + 1) + " of 10"; if (chapterDone) trophy = "crown";
    } else if (S.mode === "survival") {
      if (won) { S.surv.k++; S.surv.hp = Math.min(PH.hp, a.hp + 30); S.surv.wins++; }
      info.streak = S.surv.wins; info.won = won;
      rec = C.record(p, info); saveProg();
      if (!won) A.report("impulse-arena", { result: S.surv.wins > 0 ? "win" : "lose", stage: 1, score: Math.min(5000, S.surv.wins * 200), mode: "solo" });
      kind = won ? "win" : "eliminated"; title = won ? "SURVIVED · " + S.surv.wins : "OUT AFTER " + S.surv.wins + (S.surv.wins === 1 ? " WIN" : " WINS"); sub = won ? "Health carried: " + Math.round(S.surv.hp) + " (+30 after each win)" : "Best streak " + p.survival;
    } else if (S.mode === "timeattack") {
      if (won) { S.ta.i++; S.ta.t += m.t; }
      var finished = won && S.ta.i >= C.TA_COUNT;
      if (finished) { info.seconds = Math.round(S.ta.t * 10) / 10; rec = C.record(p, info); saveProg(); A.report("impulse-arena", { result: "win", stage: 1, score: Math.max(100, Math.min(5000, Math.round(6000 - S.ta.t * 10))), mode: "solo" }); }
      else if (!won) { rec = C.record(p, info); saveProg(); A.report("impulse-arena", { result: "lose", stage: 1, score: S.ta.i * 100, mode: "solo" }); }
      kind = finished ? "champion" : won ? "win" : "eliminated"; title = finished ? "TIME ATTACK CLEAR · " + fmtT(S.ta.t) : won ? "SPLIT " + S.ta.i + " · " + fmtT(S.ta.t) : "TIME ATTACK OVER"; if (finished) trophy = "cup";
    } else if (S.mode === "versus") {
      A.report("impulse-arena", { result: w < 0 ? "draw" : won ? "win" : "lose", stage: 1, score: won ? score : 0, mode: "solo" });
      rec = C.record(p, info); saveProg(); kind = w < 0 ? "draw" : won ? "win" : "lose"; title = w < 0 ? "DRAW" : won ? (a.hp >= PH.hp * .999 ? "PERFECT!" : "K.O.! YOU WIN") : "DEFEATED";
    } else if (duo) {
      A.report("impulse-arena", { result: "draw", mode: "duo", stage: 1, score: 0 }); rec = C.record(p, { mode: "duo", char: a.id }); saveProg();
      kind = w < 0 ? "draw" : "win"; title = w < 0 ? "DRAW" : S.look[w].name.split(" ").pop().toUpperCase() + " WINS!";
    } else { kind = won ? "win" : "lose"; title = won ? "YOU WIN" : "DEFEATED"; }
    S.lastRec = rec;
    var extra = [], stats = [["Rounds", a.wins + " – " + b.wins], ["Best combo", (S.maxCombo || 1) + (S.maxCombo > 1 ? " hits" : " hit")], ["Health left", Math.max(0, Math.round(m.f[w >= 0 ? w : 0].hp))]].concat(S.finisherDone ? [["Finisher", "+300"]] : []);
    if (rec) {
      if (rec.xp) stats.push(["XP", "+" + rec.xp]);
      if (rec.levelUp) extra.push(short(a.id) + " reached level " + rec.levelUp + "!");
      rec.unlocks.forEach(function (u) { extra.push("New fighter unlocked: " + nameOf(u) + "!"); });
      rec.titles.forEach(function (t) { extra.push("New title: " + C.titleName(t) + "."); });
    }
    var tips = ["Block (hold back) cuts damage to a quarter: the same impulse over four times the contact time.", "Heavy fighters move less per hit (Δv = J/m). Use that: trade blows when you are the heavy one.", "Jump-ins beat fireballs; a crouching kick beats a jump-in that lands short.", "Do not mash: a whiffed heavy leaves you open, and the CPU now punishes it.", "A full meter is a super: ↓→↓→ + HK, or ★ + block on a phone.", "Press buttons a moment early: the game remembers them for 6 frames."];
    var mid = S.m, line = extra.length ? extra.join(" ") : won ? (S.finisherDone ? "You ended it with a finisher." : S.maxCombo >= 3 ? "Best moment: a " + S.maxCombo + "-hit combo." : "A clean win.") : w < 0 ? "Dead level. Nobody blinked." : duo ? "" : a.wins > 0 ? "You took a round off them. That is the hard part done." : "They were quicker today. You landed enough to know it is close.";
    if (S.mode === "survival" && won) line = "Next: " + nameOf(C.survivalOpp(S.surv.k, a.id, S.surv.seed).opp) + ". " + line;
    setTimeout(function () {
      if (S.m !== mid || !S.ended) return;
      api.ceremony(kind, { title: title, sub: sub, hero: S.look[duo && w === 1 ? 1 : 0], rival: S.look[duo && w === 1 ? 0 : 1], trophy: trophy,
        colors: w >= 0 ? [S.look[w].coat || "#f6c445", "#ffffff", "#f6c445", "#ff6b9a"] : null, score: duo ? null : score, stats: stats, line: line,
        tip: duo ? "" : tips[((S.rung || 0) + a.wins + b.wins) % tips.length], then: function () { if (S.m === mid && S.ended) results(api, w, score); } });
    }, api.reduce ? 300 : 1300);
  }
  function fmtT(s) { var mm = Math.floor(s / 60), ss = s - mm * 60; return mm + ":" + (ss < 10 ? "0" : "") + ss.toFixed(1); }
  function physicsRecap() {
    var a = S.m.f[0], b = S.m.f[1], J = 200;
    return "<p>The same 200 N·s kick moves " + esc(S.look[0].name) + " (" + a.m + " kg) at Δv = " + (J / a.m).toFixed(1) + " m/s and " + esc(S.look[1].name) + " (" + b.m + " kg) at " + (J / b.m).toFixed(1) +
      " m/s, because Δv = J/m. A block keeps the impulse but stretches the contact time 4×, so the average force F̄ = J/Δt and the damage fall to ¼. Sliding stops at a = μg ≈ " + (PH.mu * PH.g).toFixed(1) + " m/s².</p><p class='gm-formula'>J = FΔt = mΔv · F̄ = J/Δt · a = μg</p>";
  }
  function results(api, w, score) {
    var m = S.m, a = m.f[0], b = m.f[1], won = w === 0, html, acts = "", p = prog(), rec = S.lastRec;
    var gained = rec ? "<p class='gm-small'>" + esc(short(a.id)) + " · level " + C.level(p.xp[a.id] || 0) + " (" + (p.xp[a.id] || 0) + " XP)" + (rec.xp ? " · +" + rec.xp + " XP" : "") + "</p>" : "";
    if (S.mode === "duo") {
      html = "<h2>" + (w < 0 ? "Draw" : esc(S.look[w].name) + " wins") + "</h2><p>Rounds " + a.wins + " – " + b.wins + ".</p>";
      acts = "<button class='gm-btn gm-btn--go' data-act='rematch'>Rematch</button><button class='gm-btn' data-act='duo'>Change fighters</button>";
    } else if (S.mode === "circuit") {
      var cleared = won && S.rung % 10 === 0, c = Math.floor((S.rung - 1) / 10);
      html = "<h2>" + (cleared ? esc(C.CHAPTERS[c % 10].name) + " cleared!" : won ? "Rung " + ((S.rung - 1) % 10 + 1) + " cleared" : "Knocked back at rung " + ((S.rung - 1) % 10 + 1)) + "</h2><p>Rounds " + a.wins + " – " + b.wins + " · score " + score + (S.maxCombo > 1 ? " · best combo " + S.maxCombo + " hits" : "") + (S.finisherDone ? " · finisher!" : "") + "</p>" + gained +
        (rec && rec.unlocks.length ? "<p><b>Unlocked:</b> " + rec.unlocks.map(function (u) { return esc(nameOf(u)); }).join(", ") + "</p>" : "") +
        (cleared && c + 1 >= C.CHAPTERS.length && C.prestigeOf(c) === 0 ? "<p>The whole Circuit is done. It now loops as <b>Prestige</b>: the same chapters with sharper, tougher opponents, for as long as you can last.</p>" : "");
      acts = won ? "<button class='gm-btn gm-btn--go' data-act='retry'>Next fight</button><button class='gm-btn' data-act='towerview'>Circuit</button>" : "<button class='gm-btn gm-btn--go' data-act='retry'>Try again</button><button class='gm-btn' data-act='towerview'>Circuit</button>";
    } else if (S.mode === "survival") {
      html = won ? "<h2>Streak: " + S.surv.wins + "</h2><p>Health carried into the next fight: " + Math.round(S.surv.hp) + ".</p>" + gained : "<h2>Survival over</h2><p>You won " + S.surv.wins + " in a row. Best: " + p.survival + ".</p>" + gained;
      acts = won ? "<button class='gm-btn gm-btn--go' data-act='survnext'>Next opponent</button><button class='gm-btn' data-act='menu'>Stop here</button>" : "<button class='gm-btn gm-btn--go' data-act='survival'>Again</button>";
    } else if (S.mode === "timeattack") {
      var done = won && S.ta.i >= C.TA_COUNT;
      html = done ? "<h2>Clear: " + fmtT(S.ta.t) + "</h2><p>Best for " + esc(short(a.id)) + ": " + fmtT(p.ta[a.id] || S.ta.t) + ".</p>" + gained : won ? "<h2>" + S.ta.i + " of " + C.TA_COUNT + "</h2><p>Time so far " + fmtT(S.ta.t) + ".</p>" : "<h2>Time attack over</h2><p>" + S.ta.i + " of " + C.TA_COUNT + " beaten.</p>";
      acts = won && !done ? "<button class='gm-btn gm-btn--go' data-act='tanext'>Next</button>" : "<button class='gm-btn gm-btn--go' data-act='timeattack'>Again</button>";
    } else {
      html = "<h2>" + (w < 0 ? "Draw" : won ? "You win" : "You lose") + "</h2><p>Rounds " + a.wins + " – " + b.wins + (S.maxCombo > 1 ? " · best combo " + S.maxCombo + " hits" : "") + ".</p>" + gained;
      acts = "<button class='gm-btn gm-btn--go' data-act='rematch'>Rematch</button><button class='gm-btn' data-act='versus'>Change setup</button>";
    }
    api.show(html + physicsRecap() + "<div class='gm-actions'>" + acts + "<button class='gm-btn' data-act='menu'>Menu</button></div>", menuAct(api));
  }

  /* ---------- menus ---------- */
  function locked(id, asRival) {
    if (asRival) return false; // you can fight anyone; you play who you have unlocked
    var c = A.byId[id]; if (c && c.guest && !A.owns("char-" + id)) return true;
    if (CT.roster) return false;
    return !C.isUnlocked(prog(), id);
  }
  function lockNote(id) { var c = A.byId[id]; return c && c.guest && !A.owns("char-" + id) ? "300 coins in the shop" : C.howToUnlock(id); }
  function faceBtn(id, chosen, act, small, asRival) {
    var c = A.byId[id] || D.FIGHTERS[id].look, lk = locked(id, asRival), lv = C.level((prog().xp || {})[id] || 0);
    return "<button type='button' class='gm-pick" + (lk ? " is-locked" : "") + "' data-act='" + (lk ? "locked" : act) + "' data-id='" + id + "' aria-pressed='" + (id === chosen) + "'" + (lk ? " disabled aria-disabled='true'" : "") + ">" +
      "<canvas width='144' height='144' data-cface='" + id + "'></canvas><b>" + esc(c.name.split(" ").pop()) + "</b>" + (small ? "" : "<small>" + (lk ? esc(lockNote(id)) : "Lv " + lv + " · " + D.FIGHTERS[id].mass + " kg") + "</small>") + "</button>";
  }
  function paintFaces() {
    var ov = document.querySelector("[data-gm-overlay]"); if (!ov) return;
    [].forEach.call(ov.querySelectorAll("canvas[data-cface]"), function (cv) { var x = cv.getContext("2d"), id = cv.getAttribute("data-cface"); x.clearRect(0, 0, 144, 144); A.drawHead(x, A.byId[id] || D.FIGHTERS[id].look, 72, 66, 46, 1, { mood: "happy" }); });
  }
  function menu(api) {
    api.sound.crowd(0);
    var wasDemo = S.mode === "demo" && S.m, p = prog();
    S.mode = "menu"; api.useActions([]); api.music(A.song(4100, "synthwave", { bpm: 118 }));
    if (!wasDemo) demo(api); S.mode = "demo";
    var c = Math.floor((p.g - 1) / 10), open = D.ORDER.concat(D.BOSSES).filter(function (id) { return !locked(id); }).length;
    api.show("<h2>Impulse Arena</h2><p>A one-on-one scientist fighter where every hit is an impulse. Heavy fighters really are harder to shove, a block spreads the force over more time, and every special is a labelled physics metaphor.</p>" +
      "<p class='gm-small'>" + esc(C.titleName(p.title)) + " · " + open + " of " + (D.ORDER.length + D.BOSSES.length) + " fighters · Circuit " + esc(C.chapterName(c)) + ", rung " + ((p.g - 1) % 10 + 1) + "</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='tower'>Circuit</button><button class='gm-btn' data-act='survival'>Survival</button><button class='gm-btn' data-act='timeattack'>Time attack</button><button class='gm-btn' data-act='versus'>Versus CPU</button><button class='gm-btn' data-act='duo'>Two players</button></div>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--sm' data-act='training'>Training room</button><button class='gm-btn gm-btn--sm' data-act='trials'>Combo trials</button><button class='gm-btn gm-btn--sm' data-act='profile'>Profile</button><button class='gm-btn gm-btn--sm' data-act='moves'>Move lists</button><button class='gm-btn gm-btn--sm' data-act='how'>How to play</button><button class='gm-btn gm-btn--sm' data-act='tutorial'>Tutorial</button></div>" +
      "<p class='gm-small'>Stylised, fictional avatars of real scientists. Cartoon knockabout only: nobody gets hurt.</p>", menuAct(api));
  }
  function needTut(api, next) {
    if (store("clash-tut3")) return next();
    api.show("<h2>First time here?</h2><p>A two-minute tutorial teaches moving, blocking high and low, a combo, an uppercut and a special, with the physics readout explained.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='tutorial'>Teach me</button><button class='gm-btn' data-act='skiptut'>Skip</button></div>",
      function (a) { if (a === "skiptut") { store("clash-tut3", true); next(); } else menuAct(api)(a); });
  }
  function choose(api, title, cur, next, back, opts) {
    opts = opts || {};
    var ids = D.ORDER.concat(D.BOSSES);
    if (locked(cur)) cur = "newton";
    function wpnRow() {
      var owned = Object.keys(D.WEAPONS).filter(function (k) { return A.owns(D.WEAPONS[k].shop); });
      if (!opts.weapon) return "";
      if (!owned.length) return "<p class='gm-small'>Starting weapons (metre rule, wrench, coil staff, tuning fork) are in the arcade shop. Weapons also drop into fights at random.</p>";
      return "<p><b>Starting weapon</b></p><div class='gm-actions'>" + [""].concat(owned).map(function (k) { return "<button class='gm-btn gm-btn--sm' data-act='wpn' data-id='" + k + "' aria-pressed='" + (S.pick.start === k) + "'>" + (k ? esc(D.WEAPONS[k].name) : "None") + "</button>"; }).join("") + "</div>";
    }
    function draw() {
      api.show("<h2>" + esc(title) + "</h2><div class='gm-picks'>" + ids.map(function (id) { return faceBtn(id, cur, "pick"); }).join("") + "</div><div data-note></div>" + wpnRow() +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>" + esc(opts.go || "Fight") + "</button><button class='gm-btn' data-act='mvlist'>Move list</button>" + (api.hero && api.hero.active && !opts.rival ? "<button class='gm-btn' data-act='mib' aria-pressed='" + HX + "' style='border-color:#f6c445'>M.I. BUGAJE: " + (HX ? "on" : "off") + "</button>" : "") + "<button class='gm-btn' data-act='back'>Back</button></div>",
        function (act, el) {
          if (act === "mib") { HX = !HX; draw(); }
          else if (act === "pick") { cur = el.getAttribute("data-id"); [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); }); note(); }
          else if (act === "costume") { var p = prog(); p.costume[cur] = +el.getAttribute("data-i"); saveProg(); note(); }
          else if (act === "wpn") { S.pick.start = el.getAttribute("data-id"); store("clash-start", S.pick.start); draw(); }
          else if (act === "go") { if (!locked(cur)) next(cur); }
          else if (act === "mvlist") moveList(api, cur, function () { draw(); });
          else if (act === "back") back();
        });
      note(); paintFaces();
    }
    function note() {
      var c = A.byId[cur] || D.FIGHTERS[cur].look, d = D.FIGHTERS[cur], el = document.querySelector("[data-note]"), p = prog(); if (!el) return;
      var xp = p.xp[cur] || 0, lv = C.level(xp), nxt = lv < C.MAX_LEVEL ? C.xpForLevel(lv + 1) : xp, sel = p.costume[cur] | 0;
      var card = A.byId[cur] ? A.card(c) : "<div class='gm-card-note'><b>" + esc(c.name) + "</b>" + (c.life ? " (" + esc(c.life) + ")" : "") + ": " + esc(c.fact) + "<small>" + esc(c.src || "Original character.") + "</small></div>";
      var cos = C.costumes(p, cur).map(function (k) { return "<button class='gm-btn gm-btn--sm' data-act='" + (k.open ? "costume" : "locked") + "' data-i='" + k.i + "' aria-pressed='" + (k.i === sel) + "'" + (k.open ? "" : " disabled style='opacity:.4'") + ">" + esc(k.name) + (k.open ? "" : " · Lv " + k.lvl) + "</button>"; }).join("");
      el.innerHTML = card + "<p class='gm-small'>Level " + lv + " · " + xp + (lv < C.MAX_LEVEL ? " / " + nxt : "") + " XP · mass " + d.mass + " kg · walk ×" + d.speed + " · power ×" + d.power + " · style: " + esc(d.ai || "balanced") + " · Δv from a 200 N·s kick = " + (200 / d.mass).toFixed(1) + " m/s</p>" +
        "<p class='gm-small'>Specials: " + D.SPECIALS[cur].map(function (s) { return esc(s.name); }).join(", ") + (D.SUPERS[cur] ? " · Super: " + esc(D.SUPERS[cur].name) : "") + "</p>" +
        (locked(cur) ? "<p class='gm-small'>Locked: " + esc(lockNote(cur)) + ".</p>" : "<div class='gm-actions' aria-label='Costume'>" + cos + "</div>");
    }
    draw();
  }
  /* ---------- the Circuit: 10 chapters × 10 rungs, then endless prestige ---------- */
  function circuitView(api) {
    var p = prog(), g = p.g, c = Math.floor((g - 1) / 10), rungs = C.circuit(c, p.char), ch = C.CHAPTERS[c % C.CHAPTERS.length];
    var rows = rungs.slice().reverse().map(function (r) {
      var cc = A.byId[r.opp] || D.FIGHTERS[r.opp].look, cur = r.g === g, bars = Math.round(r.skill * 10);
      var label = { boss: "Chapter boss", rival: "Rival", mirror: "Mirror match", spotlight: "Spotlight", fight: "Fight " + r.n }[r.kind];
      return "<li style='display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:12px;" + (cur ? "background:rgba(246,196,69,.18);outline:2px solid #f6c445;" : r.g < g ? "opacity:.6;" : "") + (r.kind === "boss" || r.kind === "rival" ? "border-left:4px solid " + (r.kind === "boss" ? "#c084fc" : "#fde047") + ";" : "") + "'>" +
        "<b style='width:26px;text-align:right'>" + r.n + "</b><canvas width='88' height='88' data-cface='" + r.opp + "' style='width:40px;height:40px" + (r.mirror ? ";filter:invert(.85) hue-rotate(180deg)" : "") + "'></canvas>" +
        "<span style='flex:1;text-align:left'>" + esc(r.mirror ? "Mirror " + cc.name.split(" ").pop() : cc.name) + " <small style='opacity:.7'>· " + label + " · " + esc(D.ARENA[r.arena].name) + "</small></span>" +
        "<span aria-label='difficulty " + bars + " of 10' style='font-family:monospace;color:#ff9d5c'>" + "▮".repeat(bars) + "<span style='opacity:.25'>" + "▮".repeat(10 - bars) + "</span></span>" + (r.g < g ? " ✓" : cur ? " ◀ you" : "") + "</li>";
    }).join("");
    var unlockLine = C.isUnlocked(p, ch.unlock) ? "" : " Clear it to recruit <b>" + esc(nameOf(ch.unlock)) + "</b>.";
    api.show("<h2>" + esc(C.chapterName(c)) + "</h2><p>" + esc(ch.blurb) + unlockLine + (C.prestigeOf(c) ? " Prestige opponents shrug off " + Math.round((1 - C.cpuTake(c)) * 100) + " % of every hit." : "") + "</p>" +
      "<p class='gm-small'>Climbing as " + esc(nameOf(p.char)) + " (level " + C.level(p.xp[p.char] || 0) + ") · Circuit rung " + g + (g > 100 ? "" : " of 100") + " · best " + p.best + " · chapters cleared " + p.chapters + "</p>" +
      "<ol style='list-style:none;margin:0;padding:0;display:grid;gap:4px;max-height:46vh;overflow:auto'>" + rows + "</ol>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='climb'>Fight rung " + ((g - 1) % 10 + 1) + "</button><button class='gm-btn' data-act='newtower'>Change fighter</button><button class='gm-btn' data-act='menu'>Menu</button></div>",
      function (a) {
        if (a === "climb") circuitFight(api);
        else if (a === "newtower") choose(api, "Who climbs the Circuit?", p.char, function (id) { p.char = id; S.pick.p1 = id; store("clash-p1", id); saveProg(); circuitView(api); }, function () { circuitView(api); }, { weapon: true, go: "Climb with them" });
        else menuAct(api)(a);
      });
    paintFaces();
  }
  var TAUNTS = ["Static Sule: \"Fresher, are you lost? The library is that way.\"", "Static Sule: \"I read the textbook. Twice. You?\"", "Static Sule: \"My hair is standing up because I'm excited, not scared.\"",
    "Static Sule: \"Last time was luck. This time it's physics.\"", "Static Sule: \"I've been rubbing balloons all week for this.\""];
  function circuitFight(api) {
    var p = prog(), g = p.g, r = C.rungAt(g, p.char), c = A.byId[r.opp] || D.FIGHTERS[r.opp].look, ch = C.CHAPTERS[r.chapter % C.CHAPTERS.length];
    var intro = r.kind === "boss" ? (r.opp === "entropy" ? "Count Entropy has scrambled the arena. His Disorder Scramble swaps your left and right, and his Entropy Drain steals your super meter." :
        r.opp === "inertia" ? "Professor Inertia weighs 110 kg: your hits move him less (Δv = J/m) and his charges carry huge momentum. Use throws and keep moving." :
        r.opp === "overload" ? "Baron Overload has 100 kg and a fuse that never blows. Bait his armoured surges, block, then punish the long recovery." :
        "The chapter boss. " + ch.blurb) + (r.rounds > 2 ? " Best of five." : "") :
      r.kind === "rival" ? TAUNTS[r.chapter % TAUNTS.length] : r.mirror ? "Your own moves, used against you." : r.kind === "spotlight" ? "Spotlight: " + c.name + ". Clear this chapter and they join you." : "Best of three rounds.";
    api.show("<h2>Rung " + r.n + ": " + esc(r.mirror ? "Mirror " + c.name.split(" ").pop() : c.name) + "</h2><p>" + esc(intro) + "</p>" + (A.byId[r.opp] && !r.mirror ? A.card(c) : "") +
      "<p class='gm-small'>" + esc(C.chapterName(r.chapter)) + " · " + esc(D.ARENA[r.arena].name) + " · CPU skill " + Math.round(r.skill * 100) + " % · mass " + D.FIGHTERS[r.opp].mass + " kg</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Fight!</button><button class='gm-btn' data-act='towerview'>Back</button></div>",
      function (a) { if (a === "go") startMatch(api, { mode: "circuit", rung: g, p1: p.char, p2: r.opp, cpu1: true, skill: r.skill, arena: r.arena, weapons: S.pick.weapons, mirror: r.mirror, rounds: roundsFor(r.rounds), p2take: r.cpuTake }); else menuAct(api)(a); });
  }
  /* ---------- survival and time attack ---------- */
  function survival(api) {
    choose(api, "Survival: who goes in?", S.pick.p1, function (id) { S.pick.p1 = id; store("clash-p1", id); S.surv = { char: id, k: 1, hp: PH.hp, wins: 0, seed: (Date.now() & 0xffff) + 1 }; survivalFight(api); }, function () { menu(api); }, { go: "Start" });
  }
  function survivalFight(api) {
    var s = S.surv, o = C.survivalOpp(s.k, s.char, s.seed);
    startMatch(api, { mode: "survival", rung: s.k, p1: s.char, p2: o.opp, cpu1: true, skill: o.skill, arena: o.arena, weapons: S.pick.weapons, rounds: 1, p2take: o.cpuTake });
    S.m.f[0].hp = S.m.f[0].ghost = s.hp;
  }
  function timeAttack(api) {
    choose(api, "Time attack: " + C.TA_COUNT + " one-round fights, against the clock", S.pick.p1, function (id) { S.pick.p1 = id; store("clash-p1", id); S.ta = { char: id, i: 0, t: 0, list: C.timeAttack(id) }; taFight(api); }, function () { menu(api); }, { go: "Start the clock" });
  }
  function taFight(api) { var o = S.ta.list[S.ta.i]; startMatch(api, { mode: "timeattack", rung: o.i, p1: S.ta.char, p2: o.opp, cpu1: true, skill: o.skill, arena: o.arena, weapons: false, rounds: 1 }); }
  /* ---------- combo trials ---------- */
  function trials(api) {
    choose(api, "Combo trials: choose a fighter", S.pick.p1, function (id) { S.pick.p1 = id; store("clash-p1", id); trialList(api, id); }, function () { menu(api); }, { go: "See trials" });
  }
  function trialList(api, id) {
    var list = C.trialsFor(id), done = prog().trials[id] || [];
    api.show("<h2>" + esc(nameOf(id)) + ": combo trials</h2><ol style='text-align:left;max-width:560px;margin:0 auto'>" + list.map(function (t) { return "<li><b>" + esc(t.name) + "</b>" + (done.indexOf(t.id) >= 0 ? " ✓" : "") + "<br><small>" + esc(t.hint) + "</small></li>"; }).join("") + "</ol>" +
      "<p class='gm-small'>Land every step in one combo. The meter stays full; the dummy stands still. Each trial passed for the first time is worth 80 XP.</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='trialgo'>Start</button><button class='gm-btn' data-act='trials'>Other fighter</button><button class='gm-btn' data-act='menu'>Menu</button></div>",
      function (a) { if (a === "trialgo") { var first = 0; while (first < list.length - 1 && done.indexOf(list[first].id) >= 0) first++; startTrial(api, id, first); } else menuAct(api)(a); });
  }
  function startTrial(api, id, i) {
    S.trial = { id: id, list: C.trialsFor(id), i: i, hits: [], lastN: -1, n: 0, okT: 0 };
    startMatch(api, { mode: "trial", p1: id, p2: id === "bohr" ? "newton" : "bohr", arena: "coil", weapons: false });
    S.m.dummy = "stand";
  }
  function trialEvent(api, e) {
    var T = S.trial; if (!T || T.okT > 0) return;
    if ((e.type === "move" || e.type === "special") && e.side === 0) T.n++;
    if (e.type === "hit" && e.att === 0) {
      var id = S.m.f[0].mv && S.m.f[0].mv.id ? S.m.f[0].mv.id : null; if (e.proj) id = T.lastSpec;
      if (e.combo === 1) T.hits = [];
      if (T.n !== T.lastN && id) { T.hits.push(id); T.lastN = T.n; }
      var t = T.list[T.i], k = C.trialProgress(t, T.hits);
      if (k < T.hits.length) { T.hits = T.hits.slice(-1); if (C.trialProgress(t, T.hits) < 1) T.hits = []; }
      if (C.trialProgress(t, T.hits) >= t.steps.length) {
        T.okT = 1.6; api.sound.sfx("coin"); api.banner("TRIAL CLEAR", { col: "#3dd68c", edge: "#0b3d22", size: 80, dur: 1.4 });
        var p = prog(), done = p.trials[T.id] || (p.trials[T.id] = []), first = done.indexOf(t.id) < 0; if (first) done.push(t.id);
        var rec = C.record(p, { mode: "trial", char: T.id, firstTime: first }); saveProg();
        if (rec.xp) pop("+" + rec.xp + " XP", S.m.f[0].x, 3, "#3dd68c");
        S.later.push({ at: S.t + 1.6, fn: function () { if (S.trial !== T) return; if (T.i + 1 < T.list.length) { T.i++; T.hits = []; T.okT = 0; trainAct(api, "reset"); } else { S.trial = null; trialList(api, T.id); } } });
      }
    }
    if (e.type === "special" && e.side === 0) T.lastSpec = e.id;
    if (e.type === "comboEnd" && e.side === 0) T.hits = [];
  }
  function versus(api) {
    function draw() {
      var opp = S.pick.p2, ids = D.ORDER.concat(D.BOSSES);
      api.show("<h2>Versus CPU</h2><div class='gm-set'><section><h3>Opponent</h3><div class='gm-picks'>" + ids.map(function (id) { return faceBtn(id, opp, "opp", true, true); }).join("") + "</div></section>" +
        "<section><h3>Difficulty</h3><div class='gm-actions' style='justify-content:flex-start'>" + D.DIFFICULTY.map(function (d) { return "<button class='gm-btn gm-btn--sm' data-act='diff' data-id='" + d.id + "' aria-pressed='" + (S.pick.diff === d.id) + "'>" + d.name + "</button>"; }).join("") + "</div>" +
        "<h3>Arena</h3><div class='gm-actions' style='justify-content:flex-start'>" + [{ id: "random", name: "Random" }].concat(D.ARENAS).map(function (a) { return "<button class='gm-btn gm-btn--sm' data-act='arena' data-id='" + a.id + "' aria-pressed='" + (S.pick.arena === a.id) + "'>" + esc(a.name) + "</button>"; }).join("") + "</div>" +
        "<h3>Weapon drops</h3><div class='gm-actions' style='justify-content:flex-start'><button class='gm-btn gm-btn--sm' data-act='wdrop' data-v='1' aria-pressed='" + S.pick.weapons + "'>On</button><button class='gm-btn gm-btn--sm' data-act='wdrop' data-v='0' aria-pressed='" + !S.pick.weapons + "'>Off</button></div></section></div>" +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Choose your fighter</button><button class='gm-btn' data-act='menu'>Back</button></div>",
        function (a, el) {
          if (a === "opp") { S.pick.p2 = el.getAttribute("data-id"); draw(); }
          else if (a === "diff") { S.pick.diff = el.getAttribute("data-id"); store("clash-diff", S.pick.diff); draw(); }
          else if (a === "arena") { S.pick.arena = el.getAttribute("data-id"); draw(); }
          else if (a === "wdrop") { S.pick.weapons = el.getAttribute("data-v") === "1"; store("clash-wpn", S.pick.weapons); draw(); }
          else if (a === "go") choose(api, "Choose your fighter", S.pick.p1, function (id) { S.pick.p1 = id; store("clash-p1", id); startVersus(api); }, draw, { weapon: true });
          else menuAct(api)(a);
        });
      paintFaces();
    }
    draw();
  }
  /* ---------- profile: levels, costumes, titles and records ---------- */
  function profile(api) {
    var p = prog(), mine = C.titles(p), ids = D.ORDER.concat(D.BOSSES);
    var rows = ids.map(function (id) { var xp = p.xp[id] || 0, lv = C.level(xp), lk = locked(id), pct = lv >= C.MAX_LEVEL ? 100 : Math.round(100 * (xp - C.xpForLevel(lv)) / (C.xpForLevel(lv + 1) - C.xpForLevel(lv)));
      return "<li style='display:flex;align-items:center;gap:8px;padding:4px 0'><canvas width='88' height='88' data-cface='" + id + "' style='width:34px;height:34px" + (lk ? ";opacity:.35" : "") + "'></canvas><span style='flex:1;text-align:left'>" + esc(short(id)) + (lk ? " <small>· " + esc(lockNote(id)) + "</small>" : "") + "</span>" +
        (lk ? "" : "<span style='width:120px;height:8px;background:rgba(255,255,255,.12);border-radius:4px;overflow:hidden'><i style='display:block;height:100%;width:" + pct + "%;background:#ffd84a'></i></span><b style='width:48px;text-align:right'>Lv " + lv + "</b>") + "</li>"; }).join("");
    var tas = Object.keys(p.ta).map(function (k) { return esc(short(k)) + " " + fmtT(p.ta[k]); }).join(" · ") || "none yet";
    api.show("<h2>Your profile</h2><p><b>" + esc(C.titleName(p.title)) + "</b> · " + p.wins + " wins, " + p.losses + " losses · Circuit best rung " + p.best + " · chapters " + p.chapters + " · survival best " + p.survival + " · trials " + C.trialsDone(p) + "</p>" +
      "<p class='gm-small'>Time attack bests: " + tas + "</p><h3>Title</h3><div class='gm-actions'>" + C.TITLES.map(function (t) { var has = mine.indexOf(t.id) >= 0; return "<button class='gm-btn gm-btn--sm' data-act='" + (has ? "title" : "locked") + "' data-id='" + t.id + "' aria-pressed='" + (p.title === t.id) + "'" + (has ? "" : " disabled style='opacity:.4'") + ">" + (has ? "" : "🔒 ") + esc(t.name) + "</button>"; }).join("") + "</div>" +
      "<h3>Fighters</h3><ul style='list-style:none;margin:0 auto;padding:0;max-width:560px;max-height:40vh;overflow:auto'>" + rows + "</ul>" +
      "<p class='gm-small'>Fighters level up as you play them (to level " + C.MAX_LEVEL + "). Costumes open at levels " + C.COSTUMES.slice(1).map(function (k) { return k.lvl; }).join(", ") + "; pick one on the fighter screen.</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='menu'>Back</button></div>",
      function (a, el) { if (a === "title") { p.title = el.getAttribute("data-id"); saveProg(); profile(api); } else menuAct(api)(a); });
    paintFaces();
  }
  function pickArena(p2) { return S.pick.arena === "random" ? D.ARENAS[Math.floor(Math.random() * D.ARENAS.length)].id : S.pick.arena || D.FIGHTERS[p2].arena; }
  function startVersus(api) { var d = D.DIFFICULTY.filter(function (x) { return x.id === S.pick.diff; })[0] || D.DIFFICULTY[1]; startMatch(api, { mode: "versus", p1: S.pick.p1, p2: S.pick.p2, cpu1: true, skill: d.s, arena: pickArena(S.pick.p2), weapons: S.pick.weapons, rounds: roundsFor(2) }); }
  var HANDI = [[1.5, "60 %"], [1.25, "80 %"], [1, "100 %"], [0.8, "125 %"], [0.67, "150 %"]]; // shown as health; applied as damage taken (×1/health)
  function duo(api) {
    choose(api, "Player 1: choose a fighter", S.pick.p1, function (a) { S.pick.p1 = a;
      choose(api, "Player 2: choose a fighter", S.pick.p2, function (b) { S.pick.p2 = b; duoHandicap(api); }, function () { duo(api); }, { go: "Next", rival: true });
    }, function () { menu(api); }, { go: "Next" });
  }
  function duoHandicap(api) {
    S.pick.h1 = S.pick.h1 || 1; S.pick.h2 = S.pick.h2 || 1;
    function row(k) { return "<div class='gm-actions' style='justify-content:flex-start'>" + HANDI.map(function (h) { return "<button class='gm-btn gm-btn--sm' data-act='h" + k + "' data-v='" + h[0] + "' aria-pressed='" + (S.pick["h" + k] === h[0]) + "'>" + h[1] + "</button>"; }).join("") + "</div>"; }
    api.show("<h2>Handicap</h2><p>Give the stronger player less health so the fight stays close.</p><div class='gm-set'><section><h3>P1 · " + esc(short(S.pick.p1)) + "</h3>" + row(1) + "</section><section><h3>P2 · " + esc(short(S.pick.p2)) + "</h3>" + row(2) + "</section></div>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Fight</button><button class='gm-btn' data-act='duo'>Back</button></div>",
      function (a, el) { if (a === "h1" || a === "h2") { S.pick[a] = +el.getAttribute("data-v"); duoHandicap(api); } else if (a === "go") startDuo(api); else menuAct(api)(a); });
  }
  function startDuo(api) { startMatch(api, { mode: "duo", p1: S.pick.p1, p2: S.pick.p2, arena: pickArena(S.pick.p2), weapons: S.pick.weapons, rounds: roundsFor(2), p1take: S.pick.h1 || 1, p2take: S.pick.h2 || 1 }); }
  function training(api) { choose(api, "Training room: choose a fighter", S.pick.p1, function (id) { S.pick.p1 = id; store("clash-p1", id); startMatch(api, { mode: "training", p1: id, p2: S.pick.p2 === id ? "bohr" : S.pick.p2, arena: "coil", weapons: false }); }, function () { menu(api); }, { go: "Train" }); }
  function moveList(api, id, back) {
    var ids = D.ORDER.concat(D.BOSSES);
    function draw() {
      var c = A.byId[id] || D.FIGHTERS[id].look, sp = D.SPECIALS[id], fin = D.FINISHERS[id], mass = D.FIGHTERS[id].mass;
      var td = "style='padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.1);vertical-align:top'";
      var spRows = sp.map(function (s) {
        var dv = s.J ? " · Δv on 70 kg = " + (s.J / 70).toFixed(1) + " m/s" : "";
        return "<tr><td " + td + "><b>" + esc(s.name) + "</b><br><small>Game metaphor: " + esc(s.cap) + "</small><br><small style='color:#ffd84a'>Real physics: " + esc(s.idea) + "</small></td><td " + td + " style='white-space:nowrap;font-family:monospace;padding:4px 6px'>" + esc(glyphs(s.in)) + (s.sc ? "<br><small>or " + { F: "→", B: "←", D: "↓", U: "↑" }[s.sc] + " + ★</small>" : "") +
          "</td><td " + td + "><small>" + s.st + "/" + s.act + "/" + s.rec + "f" + (s.J ? "<br>J " + s.J + " N·s" : "") + dv + "</small></td></tr>";
      }).join("");
      var nRows = Object.keys(D.NORMALS).map(function (k) { var n = D.NORMALS[k], adv = D.advantage(n);
        return "<tr><td " + td + ">" + esc(n.name) + "</td><td " + td + "><small>" + n.st + "/" + n.act + "/" + n.rec + "f · " + n.lvl + "</small></td><td " + td + "><small>J " + n.J + " N·s · Δv " + (n.J / mass).toFixed(1) + " m/s on " + esc(c.name.split(" ").pop()) + (n.lvl !== "throw" ? " · " + (adv.hit >= 0 ? "+" : "") + adv.hit + " on hit / " + (adv.block >= 0 ? "+" : "") + adv.block + " on block" : "") + "</small></td></tr>"; }).join("");
      api.show("<h2>Move list</h2><div class='gm-actions'>" + ids.map(function (k) { var l = A.byId[k] || D.FIGHTERS[k].look; return "<button class='gm-btn gm-btn--sm' data-act='who' data-id='" + k + "' aria-pressed='" + (k === id) + "'>" + esc(l.name.split(" ").pop()) + "</button>"; }).join("") + "</div>" +
        "<div style='text-align:left;max-height:52vh;overflow:auto;font-size:13.5px'><h3 style='margin:4px 0'>" + esc(c.name) + " · " + mass + " kg</h3><table style='width:100%;border-collapse:collapse'><tr><th " + td + ">Special</th><th " + td + ">Input</th><th " + td + ">Frames · impulse</th></tr>" + spRows + "</table>" +
        "<p><b>Enhanced special:</b> with 50 % meter, press ★ alone to arm, then any special is enhanced (×1.35 damage and impulse).</p>" +
        (D.SUPERS[id] ? "<p><b>Super — " + esc(D.SUPERS[id].name) + ":</b> with a full meter, <span style='font-family:monospace'>↓→↓→ + HK</span> (phone: ★ + 🛡). " + esc(D.SUPERS[id].cap) + " <small style='color:#ffd84a'>Real physics: " + esc(D.SUPERS[id].idea) + "</small></p>" : "") +
        "<p><b>FINALE! finisher — " + esc(fin.name) + ":</b> <span style='font-family:monospace'>" + esc(glyphs(fin.in)) + "</span> (or ↑ + ★) while the beaten rival is dizzy. " + esc(fin.text) + "</p>" +
        "<h3 style='margin:8px 0 4px'>Everyone's moves</h3><table style='width:100%;border-collapse:collapse'>" + nRows + "</table>" +
        "<p><b>Combo strings:</b> " + D.CHAINS.map(function (ch) { return esc(ch.name) + " (" + ch.seq.map(function (s) { return s.toUpperCase(); }).join(", ") + ")"; }).join(" · ") + ". Press the next button as the hit lands. Damage scales down 10 % per extra hit (to 35 %). Juggle off the uppercut.</p>" +
        "<p class='gm-small'>Frames are startup/active/recovery at 60 fps. Double-tap → to dash, ← to back-dash. Close + LP throws. ← + LK sweeps. ↓ + HP uppercuts.</p></div>" +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='back'>Back</button></div>",
        function (a, el) { if (a === "who") { id = el.getAttribute("data-id"); draw(); } else if (a === "back") back(); });
    }
    draw();
  }
  function how(api) {
    api.show("<h2>How to play</h2><div class='gm-set'><section><h3>Keyboard (one player)</h3><p class='gm-small'>Move <kbd>WASD</kbd>/arrows · <kbd>U</kbd> HP · <kbd>I</kbd> HK · <kbd>J</kbd> LP · <kbd>K</kbd> LK · <kbd>L</kbd>/<kbd>Space</kbd> block · <kbd>O</kbd> special. Two players: P1 <kbd>WASD</kbd> + <kbd>R T Y</kbd>/<kbd>F G H</kbd>, P2 arrows + <kbd>U I O</kbd>/<kbd>J K L</kbd> (or numpad 1–6). Remap in Settings.</p></section>" +
      "<section><h3>Phone</h3><p class='gm-small'>D-pad on the left, LP/HP/LK/HK on the right, 🛡 block and ★ special. ★ + a direction is a special shortcut; ★ alone arms Super. Drag buttons in Settings → Move buttons.</p></section>" +
      "<section><h3>Fighting</h3><p class='gm-small'>Standing block stops high, mid and air attacks; crouch-block stops lows. High attacks whiff over crouchers. Close + LP throws (unblockable, but never a blocking rival; press LP the moment you are grabbed to escape). Double-tap to dash. Knock-downs drop weapons. One of your projectiles on screen at a time. Buttons pressed a moment early still come out. Full meter: super (↓→↓→ + HK, or ★ + 🛡).</p></section>" +
      "<section><h3>Modes</h3><p class='gm-small'>Circuit: 10 chapters × 10 rungs with a rival, a mirror match and a chapter boss each, then endless Prestige. Survival: one round each, health carries over. Time attack: 8 fights against the clock. Combo trials: six per fighter. Fighters level up to 50 and open costumes; chapters recruit new fighters.</p></section>" +
      "<section><h3>The physics</h3><p class='gm-small'>Each hit is an impulse J (N·s): Δv = J/m, so heavy fighters fly less. Blocking keeps J but makes Δt 4× longer, so F̄ = J/Δt and damage drop to ¼. Friction a = μg (μ = 0.6) stops slides. Impulses are scaled ~5–10× a real punch so you can see them.</p></section></div>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='menu'>Back</button></div>", menuAct(api));
  }
  function menuAct(api) {
    return function (a) {
      if (a === "menu") { S.trial = null; menu(api); }
      else if (a === "tower" || a === "circuit") needTut(api, function () { circuitView(api); });
      else if (a === "towerview") circuitView(api);
      else if (a === "retry") circuitFight(api);
      else if (a === "survival") needTut(api, function () { survival(api); });
      else if (a === "survnext") survivalFight(api);
      else if (a === "timeattack") needTut(api, function () { timeAttack(api); });
      else if (a === "tanext") taFight(api);
      else if (a === "versus") needTut(api, function () { versus(api); });
      else if (a === "rematch") { if (S.mode === "duo") startDuo(api); else startVersus(api); }
      else if (a === "duo") duo(api);
      else if (a === "training") training(api);
      else if (a === "trials") trials(api);
      else if (a === "profile") profile(api);
      else if (a === "tutorial") startTutorial(api);
      else if (a === "moves") moveList(api, S.pick.p1, function () { menu(api); });
      else if (a === "how") how(api);
    };
  }

  /* ---------- tutorial (guided, in the training room) ---------- */
  var TUT = [
    { t: "Walk", d: "Walk forward and back: ◀ ▶ (A/D).", ok: function () { return S.tw.l && S.tw.r; } },
    { t: "Jump", d: "Jump with ▲ (W). Hold ◀ or ▶ as you jump to jump forward or back.", ev: function (e) { return e.type === "jump" && e.side === 0; } },
    { t: "Crouch", d: "Hold ▼ (S) to crouch. High attacks pass over you.", ok: function () { return S.m.f[0].st === "crouch" && S.m.f[0].stateT > 0.4; } },
    { t: "High punch", d: "Walk up and press HP (U). Watch the readout: J, Δt, F̄ and Δv = J/m.", ev: function (e) { return e.type === "hit" && e.att === 0 && /High punch/.test(e.label); } },
    { t: "Low kick", d: "Press LK (K). Lows must be blocked crouching.", ev: function (e) { return (e.type === "hit" || e.type === "block") && e.att === 0 && /Low kick/.test(e.label); } },
    { t: "Block high", d: "The dummy throws high punches. Hold 🛡 Block (L or Space) to block.", ev: function (e) { return e.type === "block" && e.def === 0; }, dummy: "high" },
    { t: "Block low", d: "Now low kicks: hold ▼ and 🛡 together to crouch-block.", ev: function (e) { return e.type === "block" && e.def === 0 && e.lvl === "low"; }, dummy: "low" },
    { t: "Combo", d: "String HP, HP, LP quickly as the hits land (Lab Jab).", ev: function (e) { return e.type === "chain" && e.side === 0; } },
    { t: "Uppercut", d: "Hold ▼ and press HP to launch them into the air.", ev: function (e) { return e.type === "hit" && e.att === 0 && /Uppercut/.test(e.label); } },
    { t: "Special move", d: "Do a special: ↓ → + HP or the shortcut → + ★. Read the game-metaphor caption.", ev: function (e) { return e.type === "special" && e.side === 0; } },
    { t: "Throw", d: "Walk right up close and press LP to throw. Throws beat blocking.", ev: function (e) { return e.type === "throw" && e.side === 0; } }
  ];
  function startTutorial(api) {
    S.tut = 0; S.tw = {};
    startMatch(api, { mode: "tutorial", p1: S.pick.p1, p2: "bohr", arena: "coil", weapons: false });
    S.look[1] = Object.assign({}, S.look[1], { name: "Practice Bot", coat: "#5b6170" });
  }
  function tutDummy(m) {
    var f = m.f[1], o = m.f[0], c = { h: {}, p: {} }, step = TUT[S.tut], d = Math.abs(o.x - f.x);
    if (!step || !step.dummy) return c;
    if (d > 1.0) { if (f.face > 0) c.r = true; else c.l = true; return c; }
    S.tutT = (S.tutT || 0) + 1 / 120;
    if (S.tutT > 1.1 && D.isFree(f)) { S.tutT = 0; if (step.dummy === "high") c.p.HP = true; else { c.d = true; c.p.LK = true; } }
    return c;
  }
  function tutCheck(api, e) {
    var step = TUT[S.tut]; if (!step) return;
    var ok = e ? step.ev && step.ev(e) : step.ok && step.ok();
    if (!ok) return;
    S.tut++; api.sound.sfx("coin"); pop("✓ " + step.t, S.m.f[0].x, 2.9, "#3dd68c");
    if (S.tut >= TUT.length) {
      store("clash-tut3", true); S.mode = "tutdone";
      setTimeout(function () {
        api.show("<h2>Ready to fight</h2><p>A heavier fighter gets less knockback from the same impulse because Δv = J/m. A block doesn't make the impulse vanish: it spreads it over 4× the time, so the average force F̄ = J/Δt, and the damage, drop to a quarter. Car crumple zones, helmets and airbags use exactly this idea.</p><p class='gm-formula'>J = FΔt = mΔv</p>" +
          "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='tower'>Start the tower</button><button class='gm-btn' data-act='versus'>Versus CPU</button><button class='gm-btn' data-act='menu'>Menu</button></div>", menuAct(api));
      }, 700);
    }
  }

  /* ---------- arenas: sky, far and mid parallax layers, perspective floor, foreground ---------- */
  function lg(x, y0, y1, stops) { var g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); }); return g; }
  function crowd(x, api, y, n, spread, scale, cols, off, opts) {
    opts = opts || {}; var ex = S.excite, t = api.reduce ? 0 : S.t;
    for (var i = 0; i < n; i++) {
      var px = ((i * spread + off) % (W + 400)) - 200, ph = i * 1.7, bob = Math.abs(Math.sin(t * (3 + ex * 5) + ph)) * (2 + ex * 9) * scale, col = cols[i % cols.length];
      var hy = y - 20 * scale - bob + (i % 3) * 4 * scale;
      x.fillStyle = col; x.beginPath(); x.ellipse(px, hy + 22 * scale, 13 * scale, 15 * scale, 0, Math.PI, 0); x.fill();
      x.fillStyle = opts.head || "rgba(0,0,0,.55)"; x.beginPath(); x.arc(px, hy, 8 * scale, 0, 7); x.fill();
      if (opts.eyes) { x.fillStyle = opts.eyes; x.fillRect(px - 4 * scale, hy - 1, 2.5 * scale, 2 * scale); x.fillRect(px + 2 * scale, hy - 1, 2.5 * scale, 2 * scale); }
      if ((i % 4 === 0 && ex > 0.35) || i % 9 === 0) { x.strokeStyle = col; x.lineWidth = 4 * scale; x.lineCap = "round"; var wv = Math.sin(t * 8 + ph) * 0.5; x.beginPath(); x.moveTo(px + 9 * scale, hy + 12 * scale); x.lineTo(px + (14 + wv * 8) * scale, hy - 14 * scale); x.stroke();
        if (opts.stick) { x.fillStyle = opts.stick; x.beginPath(); x.arc(px + (14 + wv * 8) * scale, hy - 16 * scale, 4 * scale, 0, 7); x.fill(); } }
    }
  }
  function floor(x, api, A1, A2, lineCol, kind) {
    var cam = S.cam * PX;
    x.fillStyle = lg(x, FB, 540, [A1, A2]); x.beginPath(); x.moveTo(0, FB); x.lineTo(W, FB); x.lineTo(W, 540); x.lineTo(0, 540); x.fill();
    var k = function (y) { return 0.5 + 0.5 * (y - FB) / (GY - FB); }, vx = 480;
    x.strokeStyle = lineCol; x.lineWidth = 1.5;
    var step = kind === "tiles" ? 100 : kind === "plates" ? 150 : kind === "bricks" ? 50 : 120;
    for (var wxm = -600; wxm <= 1800; wxm += step) {
      var fx = wxm - cam, xb = vx + (fx - vx) * k(FB), xf = vx + (fx - vx) * k(540);
      if (Math.max(xb, xf) < -50 || Math.min(xb, xf) > W + 50) continue;
      x.beginPath(); x.moveTo(xb, FB); x.lineTo(xf, 540); x.stroke();
    }
    for (var i = 1; i < 9; i++) { var yy = FB + (540 - FB) * Math.pow(i / 9, 1.5); x.globalAlpha = 0.5 + i / 18; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    x.globalAlpha = 1;
    // soft light pool where the fighters stand
    var g = x.createRadialGradient(480, GY, 40, 480, GY, 460); g.addColorStop(0, "rgba(255,255,255,.10)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, FB, W, 540 - FB);
    x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, FB, W, 4);
  }
  var ARTS = {
    coil: function (x, api, layer) {
      var t = api.reduce ? 0 : S.t, cam = S.cam * PX;
      if (layer === "back") {
        x.fillStyle = lg(x, 0, FB, ["#060a1c", "#141a3a", "#22204a"]); x.fillRect(0, 0, W, FB);
        var o = -cam * 0.15;
        for (var i = 0; i < 6; i++) { var wx0 = 40 + i * 190 + o; x.fillStyle = "#0d1230"; x.beginPath(); x.moveTo(wx0, 230); x.lineTo(wx0, 90); x.arc(wx0 + 50, 90, 50, Math.PI, 0); x.lineTo(wx0 + 100, 230); x.fill();
          x.fillStyle = (!api.reduce && Math.floor(t * 0.7 + i * 1.3) % 7 === 0 && (t * 10 % 1) < 0.3) ? "#9ec9ff" : "#1b2756"; x.fillRect(wx0 + 8, 95, 84, 128); x.strokeStyle = "#0d1230"; x.lineWidth = 4; x.beginPath(); x.moveTo(wx0 + 50, 60); x.lineTo(wx0 + 50, 225); x.moveTo(wx0 + 8, 160); x.lineTo(wx0 + 92, 160); x.stroke(); }
        x.fillStyle = "#1a1f3f"; x.fillRect(0, 232, W, 14);
        o = -cam * 0.45;
        crowd(x, api, 228, 36, 40, 0.8, ["#28407a", "#3b2f6b", "#1f5c66", "#5b2a55"], 20 + o, { stick: "#7ef0ff" });
        x.fillStyle = "#2b3150"; x.fillRect(0, 244, W, 10);
        [-120, 1080].forEach(function (cx0, j) {
          var cx = cx0 + 240 - cam * 0.7;
          x.fillStyle = "#2b2f3a"; x.fillRect(cx - 18, 140, 36, FB - 140); x.fillStyle = "#c08a3e"; for (var r = 0; r < 12; r++) x.fillRect(cx - 22, 150 + r * 13, 44, 6);
          x.fillStyle = "#aeb8c8"; x.beginPath(); x.ellipse(cx, 134, 54, 20, 0, 0, 7); x.fill(); x.fillStyle = "#e8eef7"; x.beginPath(); x.ellipse(cx - 14, 128, 20, 6, 0, 0, 7); x.fill();
          if (!api.reduce && (Math.floor(t * 4 + j * 2) % 3 === 0)) { x.strokeStyle = "rgba(170,220,255,.9)"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, 120); var px = cx, py = 120; for (var s = 0; s < 7; s++) { px += (j ? -1 : 1) * 22 + (Math.random() - 0.5) * 30; py += (Math.random() - 0.65) * 24; x.lineTo(px, py); } x.stroke(); }
          var g = x.createRadialGradient(cx, 130, 4, cx, 130, 120); g.addColorStop(0, "rgba(126,240,255,.25)"); g.addColorStop(1, "rgba(126,240,255,0)"); x.fillStyle = g; x.fillRect(cx - 120, 10, 240, 240);
        });
        floor(x, api, "#2a3142", "#11141c", "rgba(126,240,255,.16)", "plates");
      } else {
        var o2 = -cam * 1.25; x.fillStyle = "rgba(10,12,22,.85)"; for (var b = 0; b < 4; b++) { var bx = ((b * 420 + o2) % 1680 + 1680) % 1680 - 300; x.fillRect(bx, 500, 28, 40); x.fillRect(bx - 20, 498, 68, 8); }
      }
    },
    quad: function (x, api, layer) {
      var cam = S.cam * PX, t = api.reduce ? 0 : S.t;
      if (layer === "back") {
        x.fillStyle = lg(x, 0, FB, ["#3b1e5a", "#c2476b", "#f59e5b", "#ffd28a"]); x.fillRect(0, 0, W, FB);
        x.fillStyle = "rgba(255,240,200,.85)"; x.beginPath(); x.arc(700 - cam * 0.05, 210, 44, 0, 7); x.fill();
        var o = -cam * 0.15; x.fillStyle = "#3a2140";
        x.fillRect(150 + o, 120, 560, 140); x.beginPath(); x.moveTo(130 + o, 122); x.lineTo(430 + o, 60); x.lineTo(730 + o, 122); x.fill();
        x.fillStyle = "#4a2a50"; for (var c = 0; c < 8; c++) x.fillRect(180 + c * 68 + o, 135, 22, 120);
        x.fillStyle = "#ffe9b0"; x.beginPath(); x.arc(430 + o, 100, 16, 0, 7); x.fill(); x.strokeStyle = "#3a2140"; x.lineWidth = 2; x.beginPath(); x.moveTo(430 + o, 100); x.lineTo(430 + o, 90); x.moveTo(430 + o, 100); x.lineTo(438 + o, 104); x.stroke();
        [60, 820, 1010].forEach(function (px, i) { var bx = px - cam * 0.3, sw = Math.sin(t * 0.8 + i) * 4; x.strokeStyle = "#2a1630"; x.lineWidth = 8; x.beginPath(); x.moveTo(bx, 260); x.quadraticCurveTo(bx + 6, 190, bx + sw, 140); x.stroke(); x.fillStyle = "#2a1630"; for (var l = 0; l < 6; l++) { x.beginPath(); x.ellipse(bx + sw + Math.cos(l) * 34, 140 + Math.sin(l * 2) * 6, 36, 8, l, 0, 7); x.fill(); } });
        o = -cam * 0.45;
        crowd(x, api, 286, 40, 36, 0.95, ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#f8f9fa"], o);
        x.fillStyle = "#5a2e2e"; x.fillRect(0, 296, W, 36); x.fillStyle = "#ffd166"; x.font = "800 18px system-ui, sans-serif"; x.textAlign = "center";
        ["EE HUB", "PHYS 111", "J = FΔt", "GO TEAM", "Δv = J/m"].forEach(function (s, i) { var bx = ((i * 260 + o * 1.1) % 1300 + 1300) % 1300 - 160; x.fillStyle = i % 2 ? "#118ab2" : "#ef476f"; x.fillRect(bx - 70, 299, 140, 28); x.fillStyle = "#fff"; x.fillText(s, bx, 319); });
        floor(x, api, "#9b4a3a", "#4a1f1a", "rgba(40,10,10,.35)", "bricks");
      } else {
        x.strokeStyle = "rgba(30,10,20,.8)"; x.lineWidth = 2; x.beginPath(); for (var k = 0; k <= 960; k += 40) x.lineTo(k, 26 + Math.sin(k / 160) * 10); x.stroke();
        for (var q = 0; q < 24; q++) { var lx = q * 40, ly = 30 + Math.sin(q * 40 / 160) * 10; x.fillStyle = ["#ffd166", "#ff6b6b", "#7ef0ff"][q % 3]; x.globalAlpha = api.reduce ? 0.8 : 0.6 + 0.4 * Math.sin(t * 3 + q); x.beginPath(); x.arc(lx, ly + 6, 5, 0, 7); x.fill(); }
        x.globalAlpha = 1;
      }
    },
    orchard: function (x, api, layer) {
      var cam = S.cam * PX, t = api.reduce ? 0 : S.t;
      if (layer === "back") {
        x.fillStyle = lg(x, 0, FB, ["#6fb7ff", "#a8dcff", "#e8f7ff"]); x.fillRect(0, 0, W, FB);
        x.fillStyle = "rgba(255,255,255,.9)"; [[120, 70], [520, 50], [820, 90]].forEach(function (c, i) { var cx = ((c[0] + t * 6 * (i + 1) - cam * 0.05) % 1100) - 70; x.beginPath(); x.arc(cx, c[1], 26, 0, 7); x.arc(cx + 30, c[1] - 10, 32, 0, 7); x.arc(cx + 64, c[1], 24, 0, 7); x.fill(); });
        var o = -cam * 0.15; x.fillStyle = "#7cc36a"; x.beginPath(); x.moveTo(0, 250); for (var h = 0; h <= 1200; h += 60) x.lineTo(h + o, 220 - Math.sin(h / 170) * 40); x.lineTo(W, FB); x.lineTo(0, FB); x.fill();
        x.fillStyle = "#5fa552"; x.beginPath(); x.moveTo(0, 280); for (var h2 = 0; h2 <= 1300; h2 += 50) x.lineTo(h2 - cam * 0.3, 262 - Math.sin(h2 / 120 + 1) * 22); x.lineTo(W, FB); x.lineTo(0, FB); x.fill();
        o = -cam * 0.45;
        for (var tr = 0; tr < 7; tr++) { var tx = tr * 190 + o - 40, sw = Math.sin(t + tr) * 3; x.fillStyle = "#6b4226"; x.fillRect(tx - 9, 190, 18, 120); x.fillStyle = "#2f8a3e"; x.beginPath(); x.arc(tx + sw, 170, 62, 0, 7); x.arc(tx - 40 + sw, 195, 40, 0, 7); x.arc(tx + 42 + sw, 195, 42, 0, 7); x.fill();
          x.fillStyle = "#e63946"; for (var ap = 0; ap < 6; ap++) { x.beginPath(); x.arc(tx + sw + Math.cos(ap * 2.1 + tr) * 44, 168 + Math.sin(ap * 1.7) * 28, 7, 0, 7); x.fill(); } }
        x.fillStyle = "#8b5a2b"; x.fillRect(0, 300, W, 8); for (var p = 0; p < 30; p++) x.fillRect(((p * 40 + o) % 1200 + 1200) % 1200 - 120, 286, 7, 36);
        crowd(x, api, 290, 22, 52, 0.85, ["#f4a261", "#2a9d8f", "#e9c46a", "#264653", "#e76f51"], o + 15);
        floor(x, api, "#6aa84f", "#3d6b2c", "rgba(30,60,20,.25)", "grass");
        x.fillStyle = "rgba(140,100,60,.45)"; x.beginPath(); x.ellipse(480 - (S.cam - 1.2) * PX * 0.2, 470, 470, 60, 0, 0, 7); x.fill();
      } else {
        x.fillStyle = "rgba(40,90,30,.9)"; for (var gr = 0; gr < 40; gr++) { var gx = ((gr * 47 - cam * 1.25) % 1200 + 1200) % 1200 - 120; x.beginPath(); x.moveTo(gx, 540); x.lineTo(gx + 6, 512 - (gr % 3) * 6); x.lineTo(gx + 12, 540); x.fill(); }
      }
    },
    observatory: function (x, api, layer) {
      var cam = S.cam * PX, t = api.reduce ? 0 : S.t;
      if (layer === "back") {
        x.fillStyle = lg(x, 0, FB, ["#020412", "#0b1636", "#1d2a55"]); x.fillRect(0, 0, W, FB);
        for (var s = 0; s < 90; s++) { var stx = (s * 97.3 % 1100) - cam * 0.03, sty = s * 53.1 % 230; x.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s)); x.fillStyle = "#fff"; x.fillRect(stx, sty, 2, 2); }
        x.globalAlpha = 1; x.fillStyle = "#f5f3ce"; x.beginPath(); x.arc(780 - cam * 0.05, 70, 30, 0, 7); x.fill(); x.fillStyle = "#0b1636"; x.beginPath(); x.arc(768 - cam * 0.05, 62, 26, 0, 7); x.fill();
        var o = -cam * 0.15;
        for (var b = 0; b < 16; b++) { var bx = b * 72 + o - 40, bh = 70 + (b * 37 % 90); x.fillStyle = "#0a1028"; x.fillRect(bx, 270 - bh, 64, bh + 30); x.fillStyle = "#ffd86b"; for (var w = 0; w < 10; w++) if ((b * 7 + w * 3) % 4 === 0) x.fillRect(bx + 8 + (w % 3) * 18, 280 - bh + Math.floor(w / 3) * 18, 8, 8); }
        o = -cam * 0.45;
        x.fillStyle = "#c9ced6"; x.beginPath(); x.arc(760 + o, 250, 90, Math.PI, 0); x.fill(); x.fillStyle = "#1a1f2e"; x.fillRect(745 + o, 160, 30, 90);
        x.save(); x.translate(760 + o, 200); x.rotate(-0.6); x.fillStyle = "#e9edf2"; x.fillRect(-10, -90, 22, 100); x.restore();
        x.strokeStyle = "#8a93a6"; x.lineWidth = 3; x.beginPath(); x.moveTo(140 + o, 255); x.lineTo(140 + o, 140); x.moveTo(120 + o, 160); x.lineTo(160 + o, 160); x.stroke();
        if (!api.reduce && Math.floor(t * 2) % 2) { x.fillStyle = "#ff4d4d"; x.beginPath(); x.arc(140 + o, 138, 4, 0, 7); x.fill(); }
        crowd(x, api, 286, 30, 44, 0.85, ["#3b4a7a", "#5a4a8a", "#2f6b7a"], o, { stick: "#ffd86b" });
        x.fillStyle = "#3a4258"; x.fillRect(0, 300, W, 6); for (var r = 0; r < 26; r++) x.fillRect(((r * 48 + o) % 1250 + 1250) % 1250 - 120, 290, 4, 40);
        floor(x, api, "#3d4357", "#1a1d29", "rgba(255,216,107,.10)", "tiles");
      } else {
        x.strokeStyle = "rgba(20,20,30,.9)"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 18); x.quadraticCurveTo(480, 60, 960, 18); x.stroke();
        for (var q = 0; q < 20; q++) { var u = q / 19, lx = u * 960, ly = 18 + 4 * u * (1 - u) * 42; x.fillStyle = "#ffd86b"; x.globalAlpha = api.reduce ? 0.8 : 0.5 + 0.5 * Math.sin(t * 2 + q); x.beginPath(); x.arc(lx, ly + 5, 4, 0, 7); x.fill(); }
        x.globalAlpha = 1;
      }
    },
    accel: function (x, api, layer) {
      var cam = S.cam * PX, t = api.reduce ? 0 : S.t;
      if (layer === "back") {
        x.fillStyle = lg(x, 0, FB, ["#04121a", "#0b2a3a", "#0e3446"]); x.fillRect(0, 0, W, FB);
        for (var r = 7; r >= 1; r--) { var k = r / 7, cx = 480 - cam * 0.2 * (1 - k), w = 900 * k, h = 330 * k; x.strokeStyle = "rgba(126,240,255," + (0.08 + 0.12 * (1 - k)) + ")"; x.lineWidth = 6 * k + 1; x.beginPath(); x.ellipse(cx, 300 - h * 0.35, w / 2, h / 2, 0, Math.PI, 0); x.stroke(); }
        var o = -cam * 0.45;
        x.fillStyle = "#1c3a4a"; x.fillRect(0, 196, W, 26); x.fillStyle = "#7ef0ff"; var pulse = ((t * 900) % 1600) - 300; var g = x.createLinearGradient(pulse - 120, 0, pulse + 20, 0); g.addColorStop(0, "rgba(126,240,255,0)"); g.addColorStop(1, "rgba(220,255,255,.95)"); x.fillStyle = g; x.fillRect(pulse - 120, 203, 140, 12);
        for (var m2 = 0; m2 < 9; m2++) { var mx = m2 * 150 + o - 60; x.fillStyle = "#c0392b"; x.fillRect(mx, 186, 50, 46); x.fillStyle = "#e74c3c"; x.fillRect(mx + 4, 190, 42, 8); }
        x.fillStyle = "rgba(126,240,255,.10)"; x.fillRect(100 + o, 238, 760, 60); x.strokeStyle = "rgba(126,240,255,.4)"; x.lineWidth = 2; x.strokeRect(100 + o, 238, 760, 60);
        x.save(); x.beginPath(); x.rect(100 + o, 238, 760, 60); x.clip(); crowd(x, api, 290, 22, 38, 0.8, ["#ecf0f1", "#dfe6e9", "#b2bec3"], 110 + o, { head: "#f1c9a5" }); x.restore();
        floor(x, api, "#22303a", "#0c1218", "rgba(126,240,255,.22)", "plates");
      } else {
        x.fillStyle = "rgba(255,200,0,.85)"; for (var s = 0; s < 30; s++) { var hx = ((s * 60 - cam * 1.25) % 1800 + 1800) % 1800 - 200; x.beginPath(); x.moveTo(hx, 540); x.lineTo(hx + 30, 520); x.lineTo(hx + 60, 520); x.lineTo(hx + 30, 540); x.fill(); }
      }
    },
    foundry: function (x, api, layer) {
      var cam = S.cam * PX, t = api.reduce ? 0 : S.t;
      if (layer === "back") {
        x.fillStyle = lg(x, 0, FB, ["#1a0a05", "#3a1608", "#6a2a0c"]); x.fillRect(0, 0, W, FB);
        var o = -cam * 0.15;
        for (var c = 0; c < 5; c++) { var cx = c * 230 + o; x.fillStyle = "#221008"; x.fillRect(cx + 20, 30, 40, 220); x.fillRect(cx, 230, 200, 60); var g = x.createRadialGradient(cx + 100, 260, 4, cx + 100, 260, 90); g.addColorStop(0, "rgba(255,170,60," + (api.reduce ? 0.6 : 0.5 + 0.2 * Math.sin(t * 6 + c)) + ")"); g.addColorStop(1, "rgba(255,120,40,0)"); x.fillStyle = g; x.fillRect(cx, 170, 200, 120); }
        o = -cam * 0.45;
        var fx = 480 + o, fy = 170, ang = t * 0.9;
        x.strokeStyle = "#5a5f6a"; x.lineWidth = 16; x.beginPath(); x.arc(fx, fy, 120, 0, 7); x.stroke(); x.lineWidth = 8;
        for (var s = 0; s < 6; s++) { var a = ang + s * Math.PI / 3; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + Math.cos(a) * 118, fy + Math.sin(a) * 118); x.stroke(); }
        x.fillStyle = "#8a909c"; x.beginPath(); x.arc(fx, fy, 18, 0, 7); x.fill();
        x.fillStyle = "#ffd166"; x.font = "700 16px system-ui"; x.textAlign = "center"; x.fillText("E = ½Iω²", fx, fy + 150);
        crowd(x, api, 292, 30, 44, 0.9, ["#c2410c", "#a16207", "#57534e", "#ea580c"], o, { head: "#2a1a10" });
        x.fillStyle = "#3a2a20"; x.fillRect(0, 300, W, 10);
        floor(x, api, "#4a3a30", "#1c140f", "rgba(255,170,60,.16)", "plates");
      } else {
        if (!api.reduce) for (var sp = 0; sp < 10; sp++) { var ph = (t * 0.7 + sp * 0.37) % 1; x.fillStyle = "rgba(255,190,80," + (1 - ph) + ")"; x.fillRect(((sp * 97 - cam * 1.25) % 1100 + 1100) % 1100 - 70, 60 + ph * 420, 3, 6); }
        x.fillStyle = "#1a1a1a"; for (var hz = 0; hz < 34; hz++) { x.fillStyle = hz % 2 ? "#facc15" : "#1a1a1a"; var hx = ((hz * 40 - cam * 1.25) % 1360 + 1360) % 1360 - 200; x.beginPath(); x.moveTo(hx, 540); x.lineTo(hx + 20, 524); x.lineTo(hx + 60, 524); x.lineTo(hx + 40, 540); x.fill(); }
      }
    },
    clock: function (x, api, layer) {
      var cam = S.cam * PX, t = api.reduce ? 0 : S.t;
      if (layer === "back") {
        x.fillStyle = lg(x, 0, FB, ["#0d0518", "#2a0f3d", "#4a1f63"]); x.fillRect(0, 0, W, FB);
        if (!api.reduce && (t % 5) < 0.12) { x.fillStyle = "rgba(220,200,255,.35)"; x.fillRect(0, 0, W, FB); }
        var o = -cam * 0.15, cx = 480 + o, cy = 150;
        x.fillStyle = "#1a0b2a"; x.beginPath(); x.arc(cx, cy, 128, 0, 7); x.fill(); x.fillStyle = "#e8dff5"; x.beginPath(); x.arc(cx, cy, 112, 0, 7); x.fill();
        x.fillStyle = "#2a0f3d"; x.font = "700 20px Georgia, serif"; x.textAlign = "center"; x.textBaseline = "middle";
        for (var n = 1; n <= 12; n++) { var a = n / 12 * Math.PI * 2 - Math.PI / 2 + (n % 3 ? Math.sin(n * 7) * 0.25 : 0); x.fillText(String((n * 7) % 12 + 1), cx + Math.cos(a) * 90, cy + Math.sin(a) * 90); }
        x.textBaseline = "alphabetic";
        x.strokeStyle = "#2a0f3d"; x.lineWidth = 6; x.lineCap = "round"; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(t * 1.3) * 60, cy + Math.sin(t * 1.3) * 60); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(-t * 2.9 + Math.sin(t)) * 85, cy + Math.sin(-t * 2.9 + Math.sin(t)) * 85); x.stroke();
        [[150, 110, 60, 1], [820, 220, 80, -1], [260, 250, 40, -1]].forEach(function (gq) { gear(x, gq[0] + o * 2, gq[1], gq[2], t * 0.6 * gq[3]); });
        o = -cam * 0.45;
        for (var tl = 0; tl < 8; tl++) { var fy = 60 + (tl * 41 % 160) + Math.sin(t + tl) * 8; x.save(); x.translate(((tl * 140 + o) % 1200 + 1200) % 1200 - 100, fy); x.rotate(Math.sin(t * 0.7 + tl) * 0.6); x.fillStyle = tl % 2 ? "#3a1f55" : "#e8dff5"; x.fillRect(-14, -14, 28, 28); x.restore(); }
        crowd(x, api, 292, 34, 40, 0.9, ["#1a0b2a", "#24103a", "#2e1448"], o, { head: "#140822", eyes: "#ff3355" });
        x.fillStyle = "#24103a"; x.fillRect(0, 300, W, 10);
        floor(x, api, "#3d2a55", "#140a20", "rgba(232,223,245,.18)", "tiles");
        x.strokeStyle = "rgba(10,0,20,.6)"; x.lineWidth = 2; x.beginPath(); x.moveTo(300 - cam, 380); x.lineTo(340 - cam, 420); x.lineTo(320 - cam, 470); x.moveTo(820 - cam, 360); x.lineTo(780 - cam, 430); x.stroke();
      } else {
        x.fillStyle = "rgba(20,5,30,.85)"; for (var k = 0; k < 5; k++) { var px = ((k * 320 - cam * 1.25) % 1600 + 1600) % 1600 - 200; x.save(); x.translate(px, 528); gear(x, 0, 0, 40, t * 0.4 * (k % 2 ? 1 : -1), "rgba(20,5,30,.85)"); x.restore(); }
      }
    }
  };
  function gear(x, cx, cy, r, a, col) {
    x.save(); x.translate(cx, cy); x.rotate(a); x.fillStyle = col || "#3a1f55"; x.beginPath();
    for (var i = 0; i < 12; i++) { var b = i / 12 * Math.PI * 2; x.lineTo(Math.cos(b) * r, Math.sin(b) * r); x.lineTo(Math.cos(b + 0.13) * (r + 10), Math.sin(b + 0.13) * (r + 10)); x.lineTo(Math.cos(b + 0.38) * (r + 10), Math.sin(b + 0.38) * (r + 10)); x.lineTo(Math.cos(b + 0.52) * r, Math.sin(b + 0.52) * r); }
    x.fill(); x.fillStyle = "rgba(0,0,0,.4)"; x.beginPath(); x.arc(0, 0, r * 0.35, 0, 7); x.fill(); x.restore();
  }

  /* ---------- fighters: articulated pose, squash/stretch, cartoon damage ---------- */
  var TH = 44, SH = 44, TL = 52, UA = 30, FA = 30;
  var GUARD = { lean: 0.08, aF: [0.75, 1.75], aB: [0.5, 1.85], lF: [0.22, -0.12], lB: [-0.2, -0.06], rot: 0 };
  function pz(o) { var p = { lean: GUARD.lean, aF: GUARD.aF.slice(), aB: GUARD.aB.slice(), lF: GUARD.lF.slice(), lB: GUARD.lB.slice(), rot: 0 }; for (var k in o) p[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; return p; }
  function mix(a, b, k) { var o = { lean: a.lean + (b.lean - a.lean) * k, rot: (a.rot || 0) + ((b.rot || 0) - (a.rot || 0)) * k }; ["aF", "aB", "lF", "lB"].forEach(function (n) { o[n] = [a[n][0] + (b[n][0] - a[n][0]) * k, a[n][1] + (b[n][1] - a[n][1]) * k]; }); return o; }
  var CR = { lean: 0.3, lF: [1.45, -2.25], lB: [0.55, -2.1], aF: [0.95, 1.6], aB: [0.7, 1.7] };
  var TUCK = { lF: [1.1, -1.7], lB: [0.5, -1.5], aF: [1.2, 1.2], aB: [0.9, 1.4], lean: 0.1 };
  var ATK = {
    lp: { aF: [1.5, 0.05], lean: 0.14 }, hp: { aF: [1.78, 0.05], lean: 0.2, aB: [0.4, 1.9] }, lk: { lF: [0.95, 0], lB: [-0.15, -0.05], lean: -0.1 }, hk: { lF: [1.95, 0], lB: [-0.25, 0], lean: -0.38, aF: [0.6, 1.2], aB: [-0.4, 1.0] },
    c_lp: Object.assign({}, CR, { aF: [1.5, 0.05] }), c_lk: Object.assign({}, CR, { lF: [1.5, 0], lean: 0.05 }), c_hk: Object.assign({}, CR, { lF: [1.52, 0], lB: [0.4, -2.3], lean: -0.15 }),
    upper: { aF: [3.0, 0.05], lean: -0.15, lF: [0.15, 0], lB: [-0.15, 0] }, sweep: { lean: 0.55, lB: [0.4, -2.3], lF: [1.56, 0], aF: [0.4, 0.3], aB: [-0.3, 0.3] },
    j_p: Object.assign({}, TUCK, { aF: [1.15, 0.05] }), j_k: Object.assign({}, TUCK, { lF: [1.25, 0], lB: [0.25, -1.7] }),
    throw: { aF: [1.6, 0.4], aB: [1.55, 0.5], lean: 0.2 }, wpn: { aF: [1.3, 0.05], lean: 0.25 }
  };
  var SPK = {
    proj: { aF: [1.6, 0], aB: [1.5, 0.1], lean: 0.18 }, beam: { aF: [1.62, 0], aB: [1.58, 0], lean: 0.1, lF: [0.4, -0.2], lB: [-0.35, -0.1] }, rush: { aF: [1.5, 0], aB: [-0.6, 0.4], lean: 0.5, lF: [0.7, -0.6], lB: [-0.6, -0.3] },
    rise: { aF: [3.0, 0], aB: [0.3, 1.2], lean: -0.1, lF: [1.3, -1.8], lB: [-0.1, 0] }, strike: { aF: [1.55, 0], aB: [0.2, 1.4], lean: 0.32, lF: [0.5, -0.3], lB: [-0.45, 0] },
    field: { aF: [2.4, 0.2], aB: [-2.4, -0.2], lean: -0.05 }, shield: { aF: [1.9, 1.5], aB: [1.7, 1.6], lean: 0 }, buff: { aF: [2.6, 0.2], aB: [-2.6, -0.2], lean: -0.1 },
    tele: { aF: [0.3, 0.2], aB: [-0.3, 0.2] }, drop: { aF: [2.95, 0], aB: [0.6, 1.5], lean: -0.15 }, trap: Object.assign({}, CR, { aF: [0.9, 0], lean: 0.6 }), aura: { aF: [0.9, 0], aB: [-0.9, 0], lean: -0.05 }, hop: TUCK
  };
  function ext(f) { var mv = f.mv; if (!mv) return 0; var a = f.t * 60; return a < mv.st ? a / mv.st : a < mv.st + mv.act ? 1 : Math.max(0, 1 - (a - mv.st - mv.act) / Math.max(1, mv.rec)); }
  function poseOf(f) {
    var t = S.t + f.side * 1.3, st = f.st, base = pz({}), p;
    if (f.y > 0.05 && st !== "juggle") base = pz(TUCK);
    else if (f.crouch && st !== "attack") base = pz(CR);
    var breath = Math.sin(t * 3) * 0.04;
    switch (st) {
      case "idle": case "intro": p = pz({ lean: 0.08 + breath, aF: [0.75 + breath, 1.75], aB: [0.5, 1.85 + breath] }); break;
      case "walk": case "run": { var r = st === "run", ph = Math.sin(t * (r ? 14 : 9)) * (r ? 0.8 : 0.45); p = pz({ lean: r ? 0.38 : 0.1, lF: [0.1 + ph, -0.2 - Math.max(0, -ph) * 0.9], lB: [0.1 - ph, -0.2 - Math.max(0, ph) * 0.9], aF: r ? [0.9 - ph, 1.6] : GUARD.aF, aB: r ? [0.6 + ph, 1.6] : GUARD.aB }); break; }
      case "crouch": p = pz(CR); break;
      case "block": case "blockstun": p = pz(Object.assign({}, f.crouch ? CR : {}, { aF: [1.95, 1.35], aB: [1.8, 1.45], lean: st === "blockstun" ? -0.12 : f.crouch ? 0.25 : 0.02 })); break;
      case "air": p = f.vy > 2 ? pz({ lF: [0.3, -0.5], lB: [-0.2, -0.4], aF: [2.4, 0.5], aB: [2.0, 0.6], lean: 0 }) : pz(TUCK); break;
      case "attack": { var tgt = ATK[f.mv ? f.mv.id : "lp"] || ATK.lp, from = f.mv && (f.mv.crouch) ? pz(CR) : f.mv && f.mv.air ? pz(TUCK) : pz({}); var e = ext(f);
        if (f.mv && f.mv.id === "wpn") { p = mix(pz({ aF: [2.8, 0.4], lean: -0.05 }), pz(tgt), e); }
        else p = mix(from, pz(Object.assign({}, from, tgt)), e); break; }
      case "throw": p = f.t < 0.3 ? pz(ATK.throw) : pz({ aF: [2.7, 0.2], aB: [2.5, 0.3], lean: -0.3 }); break;
      case "special": { var s = f.mv || {}, k = SPK[s.kind] || SPK.proj, e2 = ext(f);
        if (s.art === "spin" || s.art === "flurry") { var sp = S.t * (s.art === "spin" ? 22 : 30); p = pz({ aF: [1.6 + Math.sin(sp) * 0.6, 0], aB: [1.4 + Math.cos(sp) * 0.6, 0], lean: 0.15 }); }
        else p = mix(pz(s.kind === "trap" ? CR : {}), pz(k), Math.max(0.25, e2)); break; }
      case "hitstun": { var q = Math.max(0, 1 - f.t / Math.max(0.1, f.stunT)); p = pz(Object.assign({}, f.crouch ? CR : {}, { lean: -0.45 * q + 0.05, aF: [0.3, 0.7], aB: [-0.3, 0.6] })); break; }
      case "juggle": p = pz({ lF: [0.9, -0.4], lB: [0.5, -0.2], aF: [2.4, 0.3], aB: [2.0, 0.3], rot: -f.face * Math.min(1.7, 0.5 + f.t * 3.2) }); break;
      case "knockdown": case "ko": p = pz({ lF: [0.15, 0], lB: [-0.05, 0], aF: [2.3, 0.4], aB: [2.6, 0.3], rot: -f.face * 1.48 }); break;
      case "getup": p = pz({ rot: -f.face * 1.48 * Math.max(0, 1 - f.t / 0.4), lF: [0.6, -1], lB: [0.2, -0.8] }); break;
      case "dizzy": p = pz({ lean: Math.sin(S.t * 3) * 0.18, aF: [0.15, 0.1], aB: [-0.12, 0.1], rot: Math.sin(S.t * 2.2) * 0.08 }); break;
      case "victim": { var fa = S.m.fin ? S.m.fin.art : "", ft = S.m.pt;
        if (fa === "old" && ft > 0.5 && ft < 2.9) p = pz({ lean: 0.55, aF: [0.9, 0.3], aB: [0.2, 0.3], lF: [0.3, -0.4], lB: [-0.1, -0.3] });
        else if (fa === "disco" && ft > 0.5) { var beat = Math.floor(S.t * 4) % 2; p = pz({ aF: beat ? [2.9, 0.2] : [1.0, 1.5], aB: beat ? [1.0, 1.5] : [2.9, 0.2], lean: beat ? 0.15 : -0.15, lF: beat ? [0.5, -0.8] : [0.1, 0], rot: (beat ? 0.08 : -0.08) * f.face }); }
        else if ((fa === "nightlight" && ft > 1) || (fa === "flick" && ft > 2.4)) p = pz({ lF: [0.15, 0], lB: [-0.05, 0], aF: [2.3, 0.4], aB: [2.6, 0.3], rot: -f.face * 1.48 });
        else if (fa === "bulb" || fa === "cage") p = pz({ aF: [2.7, 0.3], aB: [2.5, 0.3], lean: -0.1 });
        else p = pz({ lean: Math.sin(S.t * 3) * 0.18, aF: [0.15, 0.1], aB: [-0.12, 0.1], rot: Math.sin(S.t * 2.2) * 0.08 });
        break; }
      case "win": { var j = Math.abs(Math.sin(S.t * 5)); p = pz({ aF: [2.9, 0.2 + j * 0.4], aB: [2.7, 0.3], lean: -0.05 }); break; }
      case "lose": p = pz({ lean: 0.45, aF: [0.1, 0.1], aB: [-0.05, 0.1] }); break;
      case "finisher": p = pz({ aF: [1.9, 0], aB: [2.6, 0.3], lean: -0.1 }); break;
      case "held": p = pz({ aF: [2.2, 0.8], aB: [1.8, 0.6], lean: -0.3, rot: -f.face * 0.3 }); break;
      case "backdash": p = pz({ lean: -0.25, lF: [0.5, -0.8], lB: [-0.3, -0.3] }); break;
      default: p = base;
    }
    var L = f.look;
    p.lean -= L.recoil * 0.35 * (st === "hitstun" ? 1 : 0.5);
    if (f.hp < 25 && D.isFree(f) && !api0.reduce) p.rot += Math.sin(S.t * 3.4 + f.side) * 0.05;
    return p;
  }
  var api0 = { reduce: false };
  function limb(x, ox, oy, a1, a2, l1, l2, face, w1, w2, c1, c2) {
    var kx = ox + face * Math.sin(a1) * l1, ky = oy + Math.cos(a1) * l1, ex = kx + face * Math.sin(a1 + a2) * l2, ey = ky + Math.cos(a1 + a2) * l2;
    x.strokeStyle = c1; x.lineWidth = w1; x.beginPath(); x.moveTo(ox, oy); x.lineTo(kx, ky); x.stroke();
    x.strokeStyle = c2; x.lineWidth = w2; x.beginPath(); x.moveTo(kx, ky); x.lineTo(ex, ey); x.stroke();
    return [ex, ey, a1 + a2];
  }
  function legExt(l) { return TH * Math.cos(l[0]) + SH * Math.cos(l[0] + l[1]); }
  function drawFighter(x, api, f) {
    var m = S.m, c = S.look[f.side], p = poseOf(f), face = f.face, px = sx(f.x), py = sy(f.y);
    var mass = f.m, sc = (0.92 + (mass - 70) * 0.004) * 1.18, wd = 1 + (mass - 70) * 0.012;
    var grounded = f.y <= 0.02 && f.st !== "juggle";
    var hip = grounded ? Math.max(legExt(p.lF), legExt(p.lB), 18) : 84;
    var L = f.look, sq = L.sq * L.sqA, sxx = 1 + sq * 0.2, syy = 1 - sq * 0.17;
    if (f.st === "air" && f.vy > 1) { sxx *= 0.94; syy *= 1.07; }
    if (f.st === "victim" && m.fin) { var ft2 = m.pt, art2 = m.fin.art;
      if (art2 === "ball" && ft2 > 1.1 && ft2 < 2.7) { syy *= 0.3; sxx *= 1.6; }
      if (art2 === "apple" && ft2 > 0.9 && ft2 < 1.3) { syy *= 0.75; sxx *= 1.2; }
      if (art2 === "cage" && ft2 > 0.6 && !api.reduce) py -= Math.abs(Math.sin(ft2 * 7)) * 22; }
    var alpha = 1;
    if (f.st === "special" && f.mv && f.mv.kind === "tele") { var k = f.t * 60; alpha = k < f.mv.st ? 1 - k / f.mv.st : Math.min(1, (k - f.mv.st) / 6); }
    if (f.inv > 0 && f.st === "getup" && !api.reduce) alpha = 0.6 + 0.4 * Math.sin(S.t * 40);
    if (S.mode === "tutorial" && f.side === 1) alpha *= 0.95;
    // shadow on the floor (smaller and fainter the higher you are)
    var sh = 1 / (1 + f.y * 0.8); x.fillStyle = "rgba(0,0,0," + (0.38 * sh).toFixed(2) + ")"; x.beginPath(); x.ellipse(px, GY + 4, 44 * sh * wd, 9 * sh, 0, 0, 7); x.fill();
    x.save(); x.globalAlpha = alpha; x.translate(px, py); x.rotate(p.rot || 0); x.scale(sxx * sc, syy * sc);
    if (f.st === "knockdown" || f.st === "ko") x.translate(0, -8);
    var hipY = -hip, lean = p.lean, shX = face * Math.sin(lean) * TL, shY = hipY - Math.cos(lean) * TL;
    var trousers = "#2a2d36", coat = f.flash > 0 ? "#fff" : c.coat, skin = c.skin, dark = shadeHex(coat, -0.25);
    x.lineCap = "round"; x.lineJoin = "round";
    // back leg, back arm
    var fb = limb(x, -face * 5, hipY, p.lB[0], p.lB[1], TH, SH, face, 16 * wd, 14 * wd, shadeHex(trousers, -0.2), shadeHex(trousers, -0.2)); shoe(x, fb, face, "#0d0d10");
    var ab = limb(x, shX - face * 8 * wd, shY + 6, p.aB[0], p.aB[1], UA, FA, face, 12 * wd, 11 * wd, dark, dark); x.fillStyle = shadeHex(skin, -0.15); x.beginPath(); x.arc(ab[0], ab[1], 7, 0, 7); x.fill();
    // torso: lab coat with tails that flutter
    var tail = Math.max(-14, Math.min(14, -f.vx * 3)) * face, tw = 22 * wd;
    x.fillStyle = coat; x.beginPath();
    x.moveTo(shX - tw, shY + 2); x.lineTo(shX + tw, shY + 2); x.lineTo(face * 4 + tw + 2, hipY + 4); x.lineTo(tw + 4 + tail, hipY + 34); x.lineTo(-tw - 4 + tail, hipY + 34); x.lineTo(-tw - 2, hipY + 4); x.closePath(); x.fill();
    x.strokeStyle = dark; x.lineWidth = 2; x.beginPath(); x.moveTo((shX + face * 4), shY + 6); x.lineTo(face * 4, hipY + 30); x.stroke();
    x.fillStyle = "#f4f4f0"; x.beginPath(); x.moveTo(shX - 7, shY + 2); x.lineTo(shX + face * 2, shY + 20); x.lineTo(shX + 7, shY + 2); x.fill();
    // torn coat (accumulated damage)
    var w = L.wear;
    if (w > 0.4) { x.fillStyle = shadeHex(coat, -0.45); x.beginPath(); x.moveTo(-tw + tail, hipY + 34); x.lineTo(-tw + 8 + tail, hipY + 22); x.lineTo(-tw + 13 + tail, hipY + 33); x.lineTo(-tw + 19 + tail, hipY + 25); x.lineTo(-tw + 24 + tail, hipY + 34); x.fill(); }
    if (w > 0.6) { x.strokeStyle = shadeHex(coat, -0.5); x.lineWidth = 2; x.beginPath(); x.moveTo(shX - face * 10, shY + 18); x.lineTo(shX - face * 4, shY + 24); x.lineTo(shX - face * 11, shY + 30); x.lineTo(shX - face * 5, shY + 36); x.stroke(); x.fillStyle = "#e8e0d0"; x.fillRect(shX - face * 14 - 4, shY + 34, 9, 7); }
    if (w > 0.8) { x.fillStyle = shadeHex(coat, -0.5); x.beginPath(); x.arc(face * 10, hipY + 14, 5, 0, 7); x.fill(); }
    // front leg
    var ff = limb(x, face * 5, hipY, p.lF[0], p.lF[1], TH, SH, face, 16 * wd, 14 * wd, trousers, trousers); shoe(x, ff, face, "#141418");
    // head (with the shared drawHead) and cartoon damage overlays
    var hx = shX + face * Math.sin(lean) * 26, hy = shY - Math.cos(lean) * 26 - 6, r = 28;
    var mood = f.st === "win" ? "happy" : (f.hp <= 0 || f.st === "ko" || f.st === "dizzy" || f.st === "lose" || f.st === "victim") ? "sad" : "fight";
    var cc = c; if (m.fin && m.phase === "finisher" && f.st === "victim" && m.fin.art === "old" && m.pt > 0.5 && m.pt < 2.9) cc = Object.assign({}, c, { hair: "#eeeeee", style: c.style === "tophat" ? "tophat" : "wild" });
    A.drawHead(x, cc, hx, hy, r, face, { mood: mood, hit: L.sq > 0.6 && !api.reduce, blink: (S.t + f.side * 1.7) % 3.3 < 0.12 });
    faceDamage(x, f, hx, hy, r, face);
    // front arm and weapon
    var af = limb(x, shX + face * 8 * wd, shY + 6, p.aF[0], p.aF[1], UA, FA, face, 12 * wd, 11 * wd, coat, coat);
    if (f.wpn) weaponArt(x, af, face, f.wpn.id);
    x.fillStyle = skin; x.beginPath(); x.arc(af[0], af[1], 7.5, 0, 7); x.fill();
    if (f.buf.cage > 0 || f.buf.reflect > 0 || f.orbit > 0 || f.buf.armor > 0 || f.buf.glide > 0 || f.buf.aura > 0 || f.buf.slow > 0 || f.buf.brake > 0 || f.buf.scramble > 0 || f.dot) auras(x, api, f, hipY, shY);
    x.restore();
    // dizzy stars and sweat (screen space, upright)
    var headW = { x: px + (hx * Math.cos(p.rot || 0) - hy * Math.sin(p.rot || 0)) * sc, y: py + (hx * Math.sin(p.rot || 0) + hy * Math.cos(p.rot || 0)) * sc };
    if (f.st === "dizzy" || f.st === "victim" || (f.st === "getup") || (f.st === "hitstun" && f.stunT > 0.6)) stars(x, api, headW.x, headW.y - r * sc - 6);
    if ((f.hp < 50 || f.st === "run") && D.isFree(f) && !api.reduce) { var dph = (S.t * 1.4 + f.side) % 1; x.fillStyle = "rgba(160,220,255," + (1 - dph) + ")"; x.beginPath(); x.ellipse(headW.x - face * (r + 4), headW.y - 10 + dph * 26, 3.5, 5.5, 0, 0, 7); x.fill(); }
    if (S.armed[f.side] > 0) { x.strokeStyle = "rgba(255,216,74,.8)"; x.lineWidth = 3; x.beginPath(); x.ellipse(px, py - 90, 54, 104, 0, 0, 7); x.stroke(); }
  }
  function shoe(x, e, face, col) { x.fillStyle = col; x.beginPath(); x.ellipse(e[0] + face * 6, e[1] + 2, 12, 6, 0, 0, 7); x.fill(); }
  function shadeHex(hex, p) { if (hex.charAt(0) !== "#") return hex; var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = p < 0 ? 0 : 255, a = Math.abs(p); return "rgb(" + Math.round(r + (t - r) * a) + "," + Math.round(g + (t - g) * a) + "," + Math.round(b + (t - b) * a) + ")"; }
  function faceDamage(x, f, hx, hy, r, face) {
    var w = f.look.wear; if (w < 0.08) return;
    x.save(); x.translate(hx, hy);
    x.fillStyle = "rgba(120,48,170," + Math.min(0.34, w * 0.4).toFixed(3) + ")"; x.beginPath(); x.ellipse(face * r * 0.08, r * 0.12, r * 0.84, r * 0.78, 0, 0, 7); x.fill();
    if (w > 0.28) { var sw = r * (0.12 + w * 0.12); x.fillStyle = "#b46aa8"; x.beginPath(); x.arc(face * r * 0.62, r * 0.28, sw, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.arc(face * r * 0.58, r * 0.2, sw * 0.35, 0, 7); x.fill(); }
    if (w > 0.45) { x.fillStyle = "#c27bb6"; x.beginPath(); x.arc(-face * r * 0.15, -r * 0.7, r * 0.2, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.4)"; x.beginPath(); x.arc(-face * r * 0.2, -r * 0.78, r * 0.07, 0, 7); x.fill(); }
    if (w > 0.55) { x.strokeStyle = "rgba(60,20,70,.85)"; x.lineWidth = r * 0.09; x.beginPath(); x.arc(face * r * 0.46, -r * 0.05, r * 0.22, 0, 7); x.stroke(); }
    if (w > 0.65) { // cartoon nosebleed drip
      var ph = (S.t * 0.8 + f.side) % 1; x.strokeStyle = "#e63946"; x.lineWidth = r * 0.07; x.beginPath(); x.moveTo(face * r * 0.3, r * 0.26); x.lineTo(face * r * 0.3, r * 0.4); x.stroke();
      if (!api0.reduce) { x.fillStyle = "#e63946"; x.beginPath(); x.arc(face * r * 0.3, r * 0.45 + ph * r * 0.9, r * 0.06, 0, 7); x.fill(); } }
    if (w > 0.8) { x.save(); x.translate(-face * r * 0.55, r * 0.3); x.rotate(0.5 * face); x.fillStyle = "#f2d2a0"; x.fillRect(-r * 0.28, -r * 0.08, r * 0.56, r * 0.16); x.rotate(-1); x.fillRect(-r * 0.28, -r * 0.08, r * 0.56, r * 0.16); x.restore(); }
    x.restore();
  }
  function stars(x, api, cx, cy) {
    for (var i = 0; i < 4; i++) { var a = (api.reduce ? 0 : S.t * 4) + i * Math.PI / 2, px = cx + Math.cos(a) * 26, py = cy + Math.sin(a) * 8;
      x.fillStyle = i % 2 ? "#ffd84a" : "#fff"; x.beginPath(); for (var k = 0; k < 10; k++) { var rr = k % 2 ? 3 : 7, b = k / 10 * Math.PI * 2; x.lineTo(px + Math.cos(b) * rr, py + Math.sin(b) * rr); } x.fill(); }
  }
  function weaponArt(x, hand, face, id) {
    var w = D.WEAPONS[id], ang = hand[2], len = w.len * 70, ex = hand[0] + face * Math.sin(ang) * len, ey = hand[1] + Math.cos(ang) * len;
    x.lineCap = "round";
    if (id === "rule") { x.strokeStyle = w.col; x.lineWidth = 7; x.beginPath(); x.moveTo(hand[0], hand[1]); x.lineTo(ex, ey); x.stroke(); x.strokeStyle = "#5a4a20"; x.lineWidth = 1; for (var i = 1; i < 10; i++) { var u = i / 10; x.beginPath(); x.moveTo(hand[0] + (ex - hand[0]) * u, hand[1] + (ey - hand[1]) * u); x.lineTo(hand[0] + (ex - hand[0]) * u + 3, hand[1] + (ey - hand[1]) * u + 3); x.stroke(); } }
    else if (id === "wrench") { x.strokeStyle = w.col; x.lineWidth = 8; x.beginPath(); x.moveTo(hand[0], hand[1]); x.lineTo(ex, ey); x.stroke(); x.fillStyle = w.col; x.beginPath(); x.arc(ex, ey, 11, 0, 7); x.fill(); x.fillStyle = "#1a1a1a"; x.fillRect(ex - 4, ey - 12, 8, 10); }
    else if (id === "staff") { x.strokeStyle = w.col; x.lineWidth = 6; x.beginPath(); x.moveTo(hand[0], hand[1]); x.lineTo(ex, ey); x.stroke(); x.strokeStyle = "#7ef0ff"; x.lineWidth = 2; for (var k = 0; k < 6; k++) { var v = 0.4 + k * 0.1; x.beginPath(); x.arc(hand[0] + (ex - hand[0]) * v, hand[1] + (ey - hand[1]) * v, 5, 0, 7); x.stroke(); } }
    else { x.strokeStyle = w.col; x.lineWidth = 4; var mx = hand[0] + (ex - hand[0]) * 0.45, my = hand[1] + (ey - hand[1]) * 0.45; x.beginPath(); x.moveTo(hand[0], hand[1]); x.lineTo(mx, my); x.stroke(); x.beginPath(); x.moveTo(mx - 5, my); x.lineTo(ex - 5, ey); x.moveTo(mx + 5, my); x.lineTo(ex + 5, ey); x.stroke(); }
  }
  function auras(x, api, f, hipY, shY) {
    var t = api.reduce ? 0 : S.t, cy = (hipY + shY) / 2 - 10;
    if (f.buf.cage > 0) { x.strokeStyle = "rgba(200,210,230,.85)"; x.lineWidth = 2.5; for (var i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(i * 16, 6); x.lineTo(i * 14, -200); x.stroke(); } x.beginPath(); x.ellipse(0, -200, 50, 10, 0, 0, 7); x.stroke(); x.beginPath(); x.ellipse(0, 6, 54, 10, 0, 0, 7); x.stroke(); }
    if (f.buf.reflect > 0) { x.strokeStyle = "rgba(246,196,69,.9)"; x.lineWidth = 5; x.beginPath(); x.arc(f.face * 30, cy, 70, -1.1, 1.1); x.stroke(); }
    if (f.orbit > 0) for (var e = 0; e < f.orbit; e++) { var a = t * 4 + e * 2.1; x.fillStyle = "#7ef0ff"; x.beginPath(); x.arc(Math.cos(a) * 60, cy + Math.sin(a) * 26, 7, 0, 7); x.fill(); x.strokeStyle = "rgba(126,240,255,.35)"; x.lineWidth = 1.5; x.beginPath(); x.ellipse(0, cy, 60, 26, 0, 0, 7); x.stroke(); }
    if (f.buf.armor > 0) { x.strokeStyle = "rgba(255,157,92,.75)"; x.lineWidth = 4; x.beginPath(); x.ellipse(0, cy, 52, 100, 0, 0, 7); x.stroke(); }
    if (f.buf.glide > 0) { x.fillStyle = "rgba(180,230,255,.35)"; x.beginPath(); x.ellipse(0, 4, 70, 9, 0, 0, 7); x.fill(); }
    if (f.buf.aura > 0) { x.strokeStyle = "rgba(170,220,255,.9)"; x.lineWidth = 2; for (var z = 0; z < 5; z++) { var b = t * 9 + z * 1.3; x.beginPath(); x.moveTo(Math.cos(b) * 30, cy + Math.sin(b) * 60); x.lineTo(Math.cos(b) * 70 + (Math.random() - 0.5) * 10, cy + Math.sin(b) * 90); x.stroke(); } }
    if (f.buf.slow > 0) { x.strokeStyle = "rgba(255,243,166,.8)"; x.lineWidth = 3; x.beginPath(); x.arc(0, cy - 120, 18, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, cy - 120); x.lineTo(Math.cos(t * 0.8) * 13, cy - 120 + Math.sin(t * 0.8) * 13); x.stroke(); }
    if (f.buf.brake > 0) { x.strokeStyle = "rgba(167,139,250,.8)"; x.lineWidth = 2; for (var q = 0; q < 3; q++) { x.beginPath(); x.ellipse(0, cy, 40 + q * 12, 80 + q * 10, 0, 0, 7); x.stroke(); } }
    if (f.buf.scramble > 0) { x.fillStyle = "#c084fc"; x.font = "700 22px system-ui"; x.textAlign = "center"; x.save(); x.scale(1, 1); x.fillText("⇄", 0, cy - 140); x.restore(); }
    if (f.dot) { var g = x.createRadialGradient(0, cy, 10, 0, cy, 90); var a2 = Math.min(0.45, f.dot.d0 * Math.pow(0.5, f.dot.t) / 30); g.addColorStop(0, "rgba(61,214,140," + a2 + ")"); g.addColorStop(1, "rgba(61,214,140,0)"); x.fillStyle = g; x.fillRect(-90, cy - 110, 180, 220); }
  }

  /* ---------- projectiles, drops, traps, items, finisher art ---------- */
  function drawObjects(x, api) {
    var m = S.m, t = api.reduce ? 0 : S.t;
    m.traps.forEach(function (tr) { var px = sx(tr.x); x.strokeStyle = "#c08a3e"; x.lineWidth = 3; for (var i = 0; i < 4; i++) { x.beginPath(); x.ellipse(px, GY - 4 - i * 4, 22, 5, 0, 0, 7); x.stroke(); } if (!api.reduce && Math.floor(t * 6) % 2) { x.strokeStyle = "#7ef0ff"; x.beginPath(); x.moveTo(px - 10, GY - 18); x.lineTo(px, GY - 30); x.lineTo(px + 8, GY - 20); x.stroke(); } });
    m.items.forEach(function (it) { var px = sx(it.x), py = sy(it.y) - 6; x.save(); x.translate(px, py); x.rotate(it.y > 0 ? it.t * 6 : 0.1); weaponArt(x, [-25, 0, Math.PI / 2], 1, it.id); x.restore(); if (it.y <= 0 && !api.reduce) { x.strokeStyle = "rgba(255,216,74," + (0.5 + 0.5 * Math.sin(t * 6)) + ")"; x.lineWidth = 2; x.beginPath(); x.ellipse(px, GY, 34, 8, 0, 0, 7); x.stroke(); } });
    m.proj.forEach(function (q) {
      var px = sx(q.x), py = sy(q.y), r = q.r * PX, dir = Math.sign(q.v);
      x.save();
      switch (q.art) {
        case "bolt": case "spark": x.strokeStyle = q.art === "bolt" ? "#bfefff" : "#ffd166"; x.lineWidth = 4; x.shadowColor = "#7ef0ff"; x.shadowBlur = api.reduce ? 0 : 14; x.beginPath(); x.moveTo(px - dir * 60, py); for (var i = 1; i <= 6; i++) x.lineTo(px - dir * 60 + dir * i * 12, py + (i % 2 ? -1 : 1) * (6 + Math.random() * 8)); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(px, py, r * 0.6, 0, 7); x.fill(); break;
        case "ball": x.fillStyle = "#2b2f3a"; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.arc(px - r * 0.3, py - r * 0.3, r * 0.3, 0, 7); x.fill(); x.strokeStyle = "rgba(255,255,255,.25)"; x.lineWidth = 3; x.beginPath(); x.moveTo(px - dir * r * 1.2, py - 8); x.lineTo(px - dir * r * 2.6, py - 8); x.moveTo(px - dir * r * 1.2, py + 8); x.lineTo(px - dir * r * 2.4, py + 8); x.stroke(); break;
        case "photon": { var g = x.createLinearGradient(px - dir * 110, 0, px, 0); g.addColorStop(0, "rgba(255,250,200,0)"); g.addColorStop(1, "#fffbd0"); x.strokeStyle = g; x.lineWidth = 9; x.beginPath(); x.moveTo(px - dir * 110, py); x.lineTo(px, py); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(px, py, 8, 0, 7); x.fill(); break; }
        case "ac": x.strokeStyle = "#f6c445"; x.lineWidth = 3; x.beginPath(); for (var k = -30; k <= 30; k += 3) x.lineTo(px + k, py + Math.sin(k / 5 + t * 20) * 14); x.stroke(); break;
        case "cloud": { var g2 = x.createRadialGradient(px, py, 6, px, py, r * 1.2); g2.addColorStop(0, "rgba(140,255,170,.65)"); g2.addColorStop(1, "rgba(61,214,140,0)"); x.fillStyle = g2; x.beginPath(); x.arc(px, py, r * 1.2, 0, 7); x.fill(); x.fillStyle = "rgba(200,255,210,.7)"; for (var s = 0; s < 5; s++) { x.beginPath(); x.arc(px + Math.cos(t * 2 + s * 1.3) * r * 0.6, py + Math.sin(t * 1.7 + s) * r * 0.5, 4, 0, 7); x.fill(); } break; }
        case "glow": case "glow2": { var g3 = x.createRadialGradient(px, py, 2, px, py, r * 2); g3.addColorStop(0, "#eaffd0"); g3.addColorStop(0.4, "rgba(120,255,150,.8)"); g3.addColorStop(1, "rgba(61,214,140,0)"); x.fillStyle = g3; x.beginPath(); x.arc(px, py, r * 2, 0, 7); x.fill(); break; }
        case "wave": x.strokeStyle = "rgba(126,240,255,.9)"; x.lineWidth = 3; for (var wv = 0; wv < 4; wv++) { x.beginPath(); x.arc(px - dir * wv * 14, py, 16 + wv * 6, dir > 0 ? -0.9 : Math.PI - 0.9, dir > 0 ? 0.9 : Math.PI + 0.9); x.stroke(); } break;
        case "bubble": x.strokeStyle = "rgba(200,240,255,.9)"; x.lineWidth = 2; x.fillStyle = "rgba(200,240,255,.15)"; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(px - r * 0.35, py - r * 0.35, 4, 0, 7); x.fill(); break;
        case "sound": x.strokeStyle = "#ff3d8b"; x.lineWidth = 4; for (var sw = 0; sw < 3; sw++) { x.beginPath(); x.ellipse(px - dir * sw * 16, GY - 8, 10 + sw * 4, 26 + sw * 6, 0, dir > 0 ? -1.4 : Math.PI - 1.4, dir > 0 ? 0 : Math.PI); x.stroke(); } break;
        case "palm": x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 4; for (var pw = 0; pw < 3; pw++) { x.beginPath(); x.arc(px - dir * pw * 12, py, 20 + pw * 8, dir > 0 ? -1 : Math.PI - 1, dir > 0 ? 1 : Math.PI + 1); x.stroke(); } break;
        case "orb": { var g4 = x.createRadialGradient(px, py, 3, px, py, r * 1.6); g4.addColorStop(0, "#fff"); g4.addColorStop(0.35, "#c084fc"); g4.addColorStop(1, "rgba(61,20,92,0)"); x.fillStyle = g4; x.beginPath(); x.arc(px, py, r * 1.6, 0, 7); x.fill(); break; }
        default: x.fillStyle = "#fff"; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      }
      x.restore();
    });
    m.drops.forEach(function (d) { drawApple(x, sx(d.x), sy(d.y), 34, d.t * 3); });
    // beams and strikes (drawn from the attacker during the active frames)
    m.f.forEach(function (f) {
      if (f.st !== "special" || !f.mv) return; var s = f.mv, px = sx(f.x), py = sy(f.y), a = f.t * 60, on = a >= s.st && a < s.st + s.act;
      if (s.kind === "beam" && on) { var y0 = py - s.h * PX, len = s.reach * PX; x.save(); var g = x.createLinearGradient(0, y0 - 16, 0, y0 + 16); g.addColorStop(0, "rgba(126,240,255,0)"); g.addColorStop(0.5, s.art === "ray2" ? "rgba(220,170,255,.95)" : "rgba(220,255,255,.95)"); g.addColorStop(1, "rgba(126,240,255,0)"); x.fillStyle = g; x.fillRect(f.face > 0 ? px + 30 : px - 30 - len, y0 - 16, len, 32); x.restore(); }
      if (s.kind === "strike" && on && s.both) { x.strokeStyle = s.art === "quake" ? "rgba(255,216,74,.8)" : "rgba(255,255,255,.7)"; x.lineWidth = 4; var rr = (a - s.st) / s.act; x.beginPath(); x.ellipse(px, s.art === "quake" ? GY : py - 100, s.reach * PX * rr + 20, s.art === "quake" ? 14 : 80 * rr + 10, 0, 0, 7); x.stroke(); }
      if (s.art === "prism" && on) { ["#ff4d4d", "#ffa94d", "#ffe066", "#69db7c", "#4dabf7", "#9775fa"].forEach(function (col, i) { x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); x.moveTo(px + f.face * 40, py - 120); x.lineTo(px + f.face * 160, py - 170 + i * 18); x.stroke(); }); }
      if (s.art === "push" && on) { x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = 3; for (var k = 0; k < 3; k++) { x.beginPath(); x.arc(px + f.face * (70 + k * 14), py - 120, 16 + k * 10, f.face > 0 ? -1 : Math.PI - 1, f.face > 0 ? 1 : Math.PI + 1); x.stroke(); } }
      if ((s.kind === "rush" || s.kind === "rise") && on && !api.reduce) { x.fillStyle = D.FIGHTERS[f.id].col; x.globalAlpha = 0.35; for (var tr = 1; tr <= 3; tr++) { x.fillRect(px - f.face * tr * 22 - 16, py - 160 + tr * 6, 32, 140); } x.globalAlpha = 1; }
      if (s.kind === "field" && a < s.st + 20) { x.strokeStyle = D.FIGHTERS[f.id].col; x.lineWidth = 3; x.globalAlpha = 0.7; var rr2 = Math.min(1, a / s.st) * s.range * PX; x.beginPath(); x.ellipse(px, py - 90, rr2, rr2 * 0.4, 0, 0, 7); x.stroke(); x.globalAlpha = 1; }
    });
  }
  function drawApple(x, px, py, r, spin) {
    x.save(); x.translate(px, py); x.rotate(Math.sin(spin) * 0.2);
    x.fillStyle = "#d62828"; x.beginPath(); x.arc(-r * 0.32, 0, r * 0.72, 0, 7); x.arc(r * 0.32, 0, r * 0.72, 0, 7); x.fill();
    x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.ellipse(-r * 0.4, -r * 0.3, r * 0.18, r * 0.3, -0.4, 0, 7); x.fill();
    x.strokeStyle = "#5a3a1a"; x.lineWidth = r * 0.12; x.beginPath(); x.moveTo(0, -r * 0.6); x.lineTo(r * 0.1, -r * 1.0); x.stroke();
    x.fillStyle = "#2f8a3e"; x.beginPath(); x.ellipse(r * 0.35, -r * 0.9, r * 0.3, r * 0.14, -0.4, 0, 7); x.fill(); x.restore();
  }
  function drawFinisher(x, api) {
    var m = S.m; if (m.phase !== "finisher" || !m.fin) return;
    var v = m.f[1 - m.fin.side], w = m.f[m.fin.side], px = sx(v.x), py = sy(v.y), t = m.pt, R = api.reduce;
    x.save();
    switch (m.fin.art) {
      case "apple": { var fall = Math.min(1, t / 0.9), ay = -80 + (py - 210 + 80) * fall * fall; if (t < 1.6) drawApple(x, px, t < 0.9 ? ay : py - 210 - Math.sin((t - 0.9) * 6) * 60, 80, t); if (t > 0.9) { stars(x, api, px, py - 200); bubble(x, px, py - 250, "BOING!"); } break; }
      case "bulb": { var g = x.createRadialGradient(px, py - 150, 10, px, py - 150, 160); g.addColorStop(0, "rgba(255,240,150," + (R ? 0.6 : 0.5 + 0.4 * Math.abs(Math.sin(t * 7))) + ")"); g.addColorStop(1, "rgba(255,240,150,0)"); x.fillStyle = g; x.fillRect(px - 160, py - 310, 320, 320);
        if (t > 0.5) { x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = 3; x.beginPath(); x.arc(px, py - 152, 44, Math.PI * 0.8, Math.PI * 2.2); x.stroke(); x.strokeStyle = "#ffb703"; x.beginPath(); x.moveTo(px - 10, py - 140); x.lineTo(px - 5, py - 160); x.lineTo(px, py - 140); x.lineTo(px + 5, py - 160); x.lineTo(px + 10, py - 140); x.stroke(); bubble(x, px, py - 230, "DING! Bright idea."); } break; }
      case "old": if (t > 0.5 && t < 2.9) { x.strokeStyle = "#6b4226"; x.lineWidth = 5; x.lineCap = "round"; x.beginPath(); x.moveTo(px + v.face * 40, py - 70); x.lineTo(px + v.face * 46, py); x.moveTo(px + v.face * 40, py - 70); x.quadraticCurveTo(px + v.face * 40, py - 84, px + v.face * 28, py - 80); x.stroke(); bubble(x, px, py - 230, "Back in my day, momentum was conserved!"); }
        if (t < 0.6 || (t > 2.8 && t < 3.2)) { x.fillStyle = "rgba(255,255,255,.75)"; for (var c = 0; c < 7; c++) { x.beginPath(); x.arc(px + Math.cos(c) * 50, py - 100 + Math.sin(c * 2) * 50, 26, 0, 7); x.fill(); } } break;
      case "nightlight": { var g2 = x.createRadialGradient(px, py - 100, 10, px, py - 100, 150); g2.addColorStop(0, "rgba(140,255,170,.45)"); g2.addColorStop(1, "rgba(61,214,140,0)"); x.fillStyle = g2; x.fillRect(px - 150, py - 250, 300, 300); x.fillStyle = "#cfe"; x.font = "700 26px system-ui"; x.textAlign = "center"; for (var z = 0; z < 3; z++) { var zt = (t * 0.8 + z * 0.33) % 1; x.globalAlpha = 1 - zt; x.fillText("z", px + 40 + zt * 40, py - 200 - zt * 70); } x.globalAlpha = 1; break; }
      case "cage": { var drop = Math.min(1, t / 0.5); x.strokeStyle = "#c8d2e6"; x.lineWidth = 4; var top = py - 240 - (1 - drop) * 300; for (var i = -4; i <= 4; i++) { x.beginPath(); x.moveTo(px + i * 18, top); x.lineTo(px + i * 18, top + 250); x.stroke(); } x.beginPath(); x.ellipse(px, top, 76, 14, 0, 0, 7); x.stroke();
        if (drop >= 1 && !R) { x.strokeStyle = "#7ef0ff"; x.lineWidth = 2; for (var z2 = 0; z2 < 3; z2++) { var a = S.t * 5 + z2 * 2; x.beginPath(); x.moveTo(px + Math.cos(a) * 90, py - 120 + Math.sin(a) * 110); x.lineTo(px + Math.cos(a) * 120, py - 120 + Math.sin(a) * 120); x.stroke(); } } if (drop >= 1) bubble(x, px, py - 290, "Safe inside! (field = 0)"); break; }
      case "copies": if (t < 2.6) { [-80, 80].forEach(function (o, i) { x.globalAlpha = R ? 0.4 : 0.25 + 0.3 * Math.abs(Math.sin(t * 9 + i)); A.drawHead(x, S.look[v.side], px + o, py - 150, 28, v.face, { mood: "sad" }); }); x.globalAlpha = 1; bubble(x, px, py - 240, "Which one is the real me?"); } break;
      case "disco": { var by = Math.min(60, t * 200); x.strokeStyle = "#999"; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, by); x.stroke(); x.fillStyle = "#cfd6e0"; x.beginPath(); x.arc(px, by + 24, 24, 0, 7); x.fill(); if (!R) for (var sp = 0; sp < 8; sp++) { x.fillStyle = ["#ff3d8b", "#7ef0ff", "#ffd84a", "#3dd68c"][sp % 4]; x.globalAlpha = 0.5; x.beginPath(); x.arc(px + Math.cos(S.t * 3 + sp) * 200, GY - 40 - Math.abs(Math.sin(S.t * 2 + sp)) * 200, 10, 0, 7); x.fill(); } x.globalAlpha = 1; bubble(x, px, py - 240, "Can't… stop… grooving!"); break; }
      case "flick": { var edge = v.x > w.x ? sx(PH.stageW) - 40 : sx(0) + 40; x.fillStyle = "#f4a261"; for (var cu = 0; cu < 4; cu++) { x.beginPath(); x.ellipse(edge + (cu % 2) * 30 - 15, GY - 14 - cu * 20, 44, 16, 0, 0, 7); x.fill(); } x.fillStyle = "#e76f51"; x.beginPath(); x.ellipse(edge, GY - 90, 30, 12, 0.3, 0, 7); x.fill(); if (t > 0.4) bubble(x, px, py - 230, "μ ≈ 0: whee!"); break; }
      case "ball": { var bx = sx(v.x) + (v.x > w.x ? -1 : 1) * (400 - t * 300); x.fillStyle = "#4dabf7"; x.beginPath(); x.arc(bx, GY - 110, 110, 0, 7); x.fill(); x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = 6; x.beginPath(); x.arc(bx, GY - 110, 80, t * 3, t * 3 + 1.5); x.stroke(); if (t > 1.4) bubble(x, px, py - 200, "Pancake!"); break; }
      case "mess": if (!R) for (var pp = 0; pp < 10; pp++) { x.save(); x.translate(px + Math.cos(S.t * 2 + pp) * 120, py - 150 + Math.sin(S.t * 1.6 + pp * 2) * 100); x.rotate(S.t * 3 + pp); x.fillStyle = "#f8f9fa"; x.fillRect(-12, -16, 24, 32); x.fillStyle = "#adb5bd"; x.fillRect(-8, -10, 16, 2); x.fillRect(-8, -4, 16, 2); x.restore(); }
        x.strokeStyle = "#6b4226"; x.lineWidth = 2; x.beginPath(); for (var n = 0; n < 30; n++) x.lineTo(px + Math.cos(n * 2.3) * 34, py - 190 + Math.sin(n * 1.7) * 18 - 10); x.stroke(); bubble(x, px, py - 260, "Maximum disorder!"); break;
    }
    x.restore();
  }
  function bubble(x, cx, cy, text) {
    x.font = "700 17px system-ui, sans-serif"; var w = x.measureText(text).width + 22; cx = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, cx));
    x.fillStyle = "rgba(255,255,255,.95)"; x.beginPath(); if (x.roundRect) x.roundRect(cx - w / 2, cy - 18, w, 32, 14); else x.rect(cx - w / 2, cy - 18, w, 32); x.fill();
    x.fillStyle = "#1a1a1a"; x.textAlign = "center"; x.fillText(text, cx, cy + 4);
  }
  function drawFx(x, api, dt) {
    S.fx = S.fx.filter(function (e) { return e.t < e.d; });
    S.fx.forEach(function (e) {
      var k = e.t / e.d;
      if (e.k === "ring") { x.strokeStyle = e.col; x.globalAlpha = 1 - k; x.lineWidth = 4 * (1 - k) + 1; x.beginPath(); x.arc(sx(e.x), sy(e.y), e.r * (0.3 + k), 0, 7); x.stroke(); }
      else if (e.k === "shield") { x.strokeStyle = "#7ef0ff"; x.globalAlpha = 1 - k; x.lineWidth = 5; x.beginPath(); x.arc(sx(e.x) - e.face * -10, sy(e.y), 40, e.face > 0 ? -1.2 : Math.PI - 1.2, e.face > 0 ? 1.2 : Math.PI + 1.2); x.stroke(); }
      else if (e.k === "dust") { x.fillStyle = "rgba(200,190,170," + (0.5 * (1 - k)) + ")"; x.beginPath(); x.arc(sx(e.x + e.vx * e.t), sy(e.y + e.vy * e.t), 8 + k * 14, 0, 7); x.fill(); }
      else if (e.k === "poof") { x.fillStyle = "rgba(220,230,255," + (0.8 * (1 - k)) + ")"; for (var i = 0; i < 6; i++) { x.beginPath(); x.arc(sx(e.x) + Math.cos(i) * 30 * (1 + k), sy(e.y) + Math.sin(i * 2) * 50 * (1 + k), 18 * (1 - k * 0.5), 0, 7); x.fill(); } }
      x.globalAlpha = 1;
    });
  }

  /* ---------- HUD ---------- */
  function hud(x, api) {
    var m = S.m;
    m.f.forEach(function (f, i) {
      var c = S.look[i], bx = i ? 542 : 78, w = 340, by = 18, sh = S.shakeBar[i] > 0 && !api.reduce ? (Math.random() - 0.5) * 8 * S.shakeBar[i] : 0;
      x.save(); x.translate(sh, sh * 0.4);
      x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(bx - 3, by - 3, w + 6, 30);
      var gw = w * Math.max(0, f.ghost) / 100, hw = w * Math.max(0, f.hp) / 100;
      x.fillStyle = "#ffe3e3"; x.fillRect(i ? bx + w - gw : bx, by, gw, 24);
      var col = f.hp > 60 ? ["#3dd68c", "#7ef0ff"] : f.hp > 30 ? ["#f6c445", "#ff9d5c"] : ["#ff4d4d", "#ff8080"];
      var hg = x.createLinearGradient(bx, 0, bx + w, 0); hg.addColorStop(i ? 1 : 0, col[0]); hg.addColorStop(i ? 0 : 1, col[1]);
      x.globalAlpha = f.hp < 25 && !api.reduce ? 0.65 + 0.35 * Math.sin(S.t * 10) : 1; x.fillStyle = hg; x.fillRect(i ? bx + w - hw : bx, by, hw, 24); x.globalAlpha = 1;
      x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(bx, by, w, 6);
      x.restore();
      // portrait
      x.save(); x.fillStyle = "rgba(0,0,0,.55)"; x.beginPath(); x.arc(i ? 920 : 40, 34, 32, 0, 7); x.fill(); x.beginPath(); x.arc(i ? 920 : 40, 34, 30, 0, 7); x.clip(); A.drawHead(x, c, i ? 920 : 40, 40, 22, i ? -1 : 1, { mood: f.hp < 30 ? "sad" : "fight", hit: S.shakeBar[i] > 0.2 }); x.restore();
      var z = S.ui || 1; x.fillStyle = "#fff"; x.font = "800 " + Math.round(20 * z) + "px system-ui, sans-serif"; x.textAlign = i ? "right" : "left";
      x.fillText(c.name.split(" ").pop().toUpperCase() + (S.mode === "duo" ? (i ? " · P2" : " · P1") : S.mode === "demo" ? "" : S.m.training && i ? " · DUMMY" : S.human[i] ? " · YOU" : " · CPU"), i ? bx + w : bx, 66);
      x.font = "600 " + Math.round(15 * z) + "px system-ui, sans-serif"; x.fillStyle = "rgba(255,255,255,.75)"; if (z < 1.35) x.fillText(f.m + " kg" + (f.wpn ? " · " + D.WEAPONS[f.wpn.id].name + " ×" + f.wpn.uses : ""), i ? bx + w - (f.wins ? 50 : 0) : bx + (f.wins ? 50 : 0), 86);
      for (var k = 0; k < f.wins; k++) { x.fillStyle = "#ffd84a"; x.beginPath(); x.arc(i ? bx + w - 10 - k * 22 : bx + 10 + k * 22, 81, 8, 0, 7); x.fill(); x.strokeStyle = "#8a4b00"; x.lineWidth = 2; x.stroke(); }
      // super meter
      var mx = i ? 600 : 30, mw = 330, my = 506;
      x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(mx - 2, my - 2, mw + 4, 16);
      var mg = x.createLinearGradient(mx, 0, mx + mw, 0); mg.addColorStop(0, "#7ef0ff"); mg.addColorStop(1, f.meter >= 50 ? "#ffd84a" : "#a78bfa");
      x.fillStyle = mg; var mwid = mw * f.meter / 100; x.fillRect(i ? mx + mw - mwid : mx, my, mwid, 12);
      x.fillStyle = "rgba(0,0,0,.8)"; x.fillRect(mx + mw / 2 - 1, my - 2, 2, 16);
      x.font = "800 " + Math.round(15 * z) + "px system-ui, sans-serif"; x.textAlign = i ? "right" : "left"; x.fillStyle = f.meter >= 50 ? "#ffd84a" : "#cfd6e0";
      x.fillText((f.meter >= 100 ? "SUPER READY" : "METER " + (f.meter >= 50 ? "×1" : Math.floor(f.meter) + " %")), i ? mx + mw : mx, my - 6);
      if (S.combo[i] && S.combo[i].t > 0) { var cb = S.combo[i], s = 1 + Math.max(0, cb.t - 1.4) * 2; x.save(); x.translate(i ? 840 : 120, 190); x.scale(s, s); x.textAlign = "center"; x.font = "900 46px system-ui, sans-serif"; x.lineWidth = 6; x.strokeStyle = "#5a2a00"; x.strokeText(cb.n + " HITS", 0, 0); x.fillStyle = "#ffd84a"; x.fillText(cb.n + " HITS", 0, 0); x.font = "800 18px system-ui"; x.fillStyle = "#fff"; x.fillText(cb.dmg + " damage · scaled", 0, 24); x.restore(); }
    });
    // timer
    x.textAlign = "center"; x.fillStyle = "rgba(0,0,0,.6)"; x.beginPath(); x.arc(480, 34, 32, 0, 7); x.fill();
    x.fillStyle = m.time < 10 ? "#ff6b6b" : "#fff"; x.font = "900 " + Math.round(32 * Math.min(S.ui || 1, 1.4)) + "px system-ui, sans-serif"; x.fillText(m.training ? "∞" : Math.ceil(Math.max(0, m.time)), 480, 46);
    // special / weapon caption (game metaphor)
    if (S.cap && S.cap.t > 0) {
      x.globalAlpha = Math.min(1, S.cap.t * 2); var tr = S.mode === "training", cw = tr ? 540 : 780, cx0 = tr ? 140 : 90, cy0 = 128;
      x.fillStyle = "rgba(4,12,18,.86)"; x.fillRect(cx0, cy0, cw, 70); x.fillStyle = D.FIGHTERS[m.f[S.cap.side].id].col; x.fillRect(cx0, cy0, 6, 70);
      var zc = Math.min(S.ui || 1, 1.6); x.textAlign = "left"; x.font = "800 " + Math.round(20 * zc) + "px system-ui, sans-serif"; x.fillStyle = "#ffd84a";
      x.fillText((S.cap.ex ? "ENHANCED " : "") + S.cap.name + (S.cap.weapon ? "" : "  ·  game metaphor"), cx0 + 18, cy0 + 26);
      x.font = Math.round(15 * zc) + "px system-ui, sans-serif"; x.fillStyle = "#e6f6ff"; if (zc < 1.3) wrap(x, (S.cap.weapon ? "" : S.cap.cap + " Real physics: ") + S.cap.idea, cx0 + 18, cy0 + 47, cw - 30, 18, 2);
      x.globalAlpha = 1;
    }
    // impulse readout
    if (S.read && S.read.t > 0 && opt("ia_readout", true) !== false) {
      var r = S.read; x.globalAlpha = Math.min(1, r.t);
      if ((S.ui || 1) >= 1.3) { var short1 = (r.blocked ? "BLOCKED · " : "") + "Δv = " + r.dv.toFixed(1) + " m/s"; x.font = "800 " + Math.round(15 * S.ui) + "px system-ui"; var tw1 = x.measureText(short1).width + 24; x.fillStyle = "rgba(4,12,18,.8)"; x.fillRect(480 - tw1 / 2, 96, tw1, 30 * Math.min(S.ui, 1.6)); x.fillStyle = r.blocked ? "#7ef0ff" : "#fff"; x.textAlign = "center"; x.fillText(short1, 480, 96 + 22 * Math.min(S.ui, 1.6)); x.globalAlpha = 1; r = null; }
      if (r) {
      var txt = r.blocked ? "BLOCKED " + r.label + ": J = " + Math.round(r.J) + " N·s over Δt = " + (r.dt * 1000).toFixed(0) + " ms → F̄ = " + (r.F / 1000).toFixed(1) + " kN (¼), Δv = " + r.dv.toFixed(2) + " m/s"
        : r.label + ": J = " + Math.round(r.J) + " N·s, Δt = " + (r.dt * 1000).toFixed(0) + " ms → F̄ = J/Δt = " + (r.F / 1000).toFixed(1) + " kN · Δv = J/m = " + Math.round(r.J) + "/" + r.m + " = " + r.dv.toFixed(2) + " m/s";
      x.font = "600 15px ui-monospace, Menlo, monospace"; var tw = Math.min(900, x.measureText(txt).width + 24);
      x.fillStyle = "rgba(4,12,18,.8)"; x.fillRect(480 - tw / 2, 96, tw, 26); x.fillStyle = r.blocked ? "#7ef0ff" : "#fff"; x.textAlign = "center"; x.fillText(txt, 480, 115, 880);
      x.globalAlpha = 1; }
    }
    if (opt("ia_input", false) && S.mode !== "training" && S.inputs && S.inputs.length) { x.textAlign = "left"; x.font = "600 " + Math.round(15 * Math.min(S.ui || 1, 1.5)) + "px ui-monospace, Menlo, monospace"; S.inputs.slice(-6).reverse().forEach(function (e, k) { x.globalAlpha = Math.max(0.3, 1 - k * 0.12); x.fillStyle = "rgba(4,12,18,.7)"; x.fillRect(10, 128 + k * 22, 110, 20); x.fillStyle = "#fff"; x.fillText(e.s, 16, 143 + k * 22); }); x.globalAlpha = 1; }
    // floating pops
    S.pops.forEach(function (p) { x.globalAlpha = Math.min(1, p.life); x.font = "700 " + Math.round(16 * Math.min(S.ui || 1, 1.6)) + "px system-ui, sans-serif"; var tx = Math.max(130, Math.min(830, sx(p.x))), ty = sy(p.y); var w = x.measureText(p.t).width + 16; x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(tx - w / 2, ty - 17, w, 23); x.fillStyle = p.col; x.textAlign = "center"; x.fillText(p.t, tx, ty); });
    x.globalAlpha = 1;
    if (m.phase === "finale" && m.pt > 2.3 && S.human[m.winner] && S.mode !== "demo") { x.textAlign = "center"; x.font = "800 22px system-ui"; x.fillStyle = "#e9d5ff"; var left = Math.max(0, PH.finaleT - m.pt); x.fillText("FINALE! " + glyphs(D.FINISHERS[m.f[m.winner].id].in) + "  or  ↑ + ★   (" + left.toFixed(1) + " s)", 480, 220); }
    if (m.f[0].buf.scramble > 0 && S.human[0]) { x.textAlign = "center"; x.font = "800 20px system-ui"; x.fillStyle = "#c084fc"; x.fillText("Left and right are swapped! " + m.f[0].buf.scramble.toFixed(1) + " s", 480, 222); }
  }
  function wrap(x, text, x0, y0, maxW, lh, maxLines) {
    var words = text.split(" "), line = "", n = 0;
    for (var i = 0; i < words.length; i++) { var test = line ? line + " " + words[i] : words[i]; if (x.measureText(test).width > maxW && line) { x.fillText(line, x0, y0 + n * lh); n++; line = words[i]; if (n >= maxLines - 1) { var rest = words.slice(i).join(" "); while (x.measureText(rest + "…").width > maxW && rest.length) rest = rest.slice(0, -1); x.fillText(rest + (rest.length < words.slice(i).join(" ").length ? "…" : ""), x0, y0 + n * lh); return; } } else line = test; }
    if (line) x.fillText(line, x0, y0 + n * lh);
  }
  function trialHud(x, api) {
    var T = S.trial; if (!T) return; var t = T.list[T.i], k = C.trialProgress(t, T.hits), z = S.ui || 1;
    x.save(); x.textAlign = "left"; var w = Math.min(560, 260 * z + t.steps.length * 60), h = 74 * Math.min(z, 1.6);
    x.fillStyle = "rgba(4,12,18,.86)"; x.fillRect(480 - w / 2, 126, w, h); x.fillStyle = "#3dd68c"; x.font = "800 " + Math.round(16 * z) + "px system-ui";
    x.fillText("TRIAL " + (T.i + 1) + "/" + T.list.length + ": " + t.name, 480 - w / 2 + 12, 126 + 22 * Math.min(z, 1.6), w - 24);
    x.font = "700 " + Math.round(15 * z) + "px ui-monospace, Menlo, monospace";
    var label = t.steps.map(function (s2, i) { return (i < k ? "✓ " : "") + s2.toUpperCase(); }).join("  →  ");
    x.fillStyle = "#fff"; x.fillText(label, 480 - w / 2 + 12, 126 + 50 * Math.min(z, 1.6), w - 24); x.restore();
  }
  function trainingHud(x, api) {
    var m = S.m;
    // input display
    x.fillStyle = "rgba(4,12,18,.75)"; x.fillRect(10, 132, 120, 18 + S.inputs.length * 20); x.font = "700 13px system-ui"; x.fillStyle = "#7ef0ff"; x.textAlign = "left"; x.fillText("INPUTS", 18, 146);
    x.font = "600 16px ui-monospace, Menlo, monospace";
    S.inputs.slice().reverse().forEach(function (e, i) { x.globalAlpha = Math.max(0.3, 1 - i * 0.06); x.fillStyle = "#fff"; x.fillText(e.s, 18, 166 + i * 20); }); x.globalAlpha = 1;
    // frame-by-frame impulse readout
    var h = S.lastHit, px0 = 690, py0 = 132, pw = 260, ph = 214;
    x.fillStyle = "rgba(4,12,18,.82)"; x.fillRect(px0, py0, pw, ph); x.fillStyle = "#7ef0ff"; x.font = "700 13px system-ui"; x.fillText("LAST HIT · IMPULSE · dummy: " + DUMMY_NAME[S.dummy].toLowerCase(), px0 + 10, py0 + 18, pw - 20);
    if (h) {
      x.fillStyle = "#fff"; x.font = "600 13px ui-monospace, Menlo, monospace";
      var mv = h.mv, lines = [h.label + (h.blocked ? " (blocked)" : ""), mv ? "frames " + mv.st + "/" + mv.act + "/" + mv.rec + " (st/act/rec)" : "projectile / effect",
        "J  = " + Math.round(h.J) + " N·s", "Δt = " + (h.dt * 1000).toFixed(0) + " ms" + (h.blocked ? " (×4 by the block)" : ""), "F̄  = J/Δt = " + (h.F / 1000).toFixed(1) + " kN",
        "F_peak ≈ πJ/(2Δt) = " + (Math.PI * h.J / (2 * h.dt) / 1000).toFixed(1) + " kN", "Δv = J/m = " + h.dv.toFixed(2) + " m/s (" + h.m + " kg)", "damage " + h.dmg.toFixed(1) + " HP" + (h.combo > 1 ? " (combo ×" + Math.max(0.35, 1 - 0.1 * (h.combo - 1)).toFixed(2) + ")" : "")];
      lines.forEach(function (l, i) { x.fillText(l.length > 34 ? l.slice(0, 33) + "…" : l, px0 + 10, py0 + 38 + i * 16); });
      // F(t) pulse: half-sine, area = J
      var gx = px0 + 10, gy = py0 + ph - 12, gw = pw - 20, gh = 34; x.strokeStyle = "rgba(255,255,255,.3)"; x.lineWidth = 1; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + gw, gy); x.stroke();
      x.fillStyle = h.blocked ? "rgba(126,240,255,.5)" : "rgba(255,216,74,.6)"; x.beginPath(); x.moveTo(gx, gy); var span = h.dt / 0.04 * gw, peak = Math.min(1, (Math.PI * h.J / (2 * h.dt)) / 60000) * gh;
      for (var k = 0; k <= 20; k++) x.lineTo(gx + span * k / 20, gy - Math.sin(Math.PI * k / 20) * peak); x.lineTo(gx + span, gy); x.fill();
      x.fillStyle = "#cfd6e0"; x.font = "11px system-ui"; x.fillText("F(t) over 40 ms · shaded area = J", gx + 60, gy - 22);
    } else { x.fillStyle = "#cfd6e0"; x.font = "14px system-ui"; x.fillText("Hit the dummy to see the numbers.", px0 + 10, py0 + 44); }
    // training buttons (tap or keys 1–4)
    var bts = TRAIN_BTNS(); bts.forEach(function (b) { x.fillStyle = b.on ? "rgba(246,196,69,.9)" : "rgba(255,255,255,.14)"; x.fillRect(b.x, b.y, b.w, b.h); x.fillStyle = b.on ? "#1a1200" : "#fff"; x.font = "700 13px system-ui"; x.textAlign = "center"; x.fillText(b.t, b.x + b.w / 2, b.y + 18); });
    x.textAlign = "left";
    if (S.frozen) { x.fillStyle = "#ffd84a"; x.font = "800 18px system-ui"; x.textAlign = "center"; x.fillText("FROZEN · step 1 frame with [4] or ▸1f", 480, 300); }
  }
  function TRAIN_BTNS() {
    if (S.mode !== "training") return [];
    return [{ id: "reset", t: "↺ reset [1]", x: 690, y: 352, w: 84, h: 26 }, { id: "dummy", t: "Dummy: " + DUMMY_NAME[S.dummy].split(" ")[0] + " [2]", x: 778, y: 352, w: 172, h: 26 },
      { id: "freeze", t: S.frozen ? "▶ run [3]" : "❚❚ freeze [3]", x: 690, y: 382, w: 120, h: 26, on: S.frozen }, { id: "step", t: "▸1f [4]", x: 814, y: 382, w: 60, h: 26 }, { id: "moves", t: "Moves", x: 878, y: 382, w: 72, h: 26 }];
  }
  function trainAct(api, id) {
    var m = S.m;
    if (id === "reset") { m.f[0].x = 4.4; m.f[1].x = 7.6; m.f.forEach(function (f) { f.vx = f.vy = 0; f.y = 0; f.hp = 100; f.st = "idle"; f.mv = null; f.buf = {}; f.dot = null; f.look.wear = 0; }); m.proj = []; m.drops = []; m.traps = []; }
    else if (id === "dummy") { S.dummy = DUMMIES[(DUMMIES.indexOf(S.dummy) + 1) % DUMMIES.length]; m.dummy = S.dummy; m.f[1].cpu = S.dummy === "cpu" ? { s: 0.45, t: 0.5, q: [], hold: null, holdT: 0 } : null; pop("Dummy: " + DUMMY_NAME[S.dummy], m.f[1].x, 2.6, "#7ef0ff"); }
    else if (id === "freeze") S.frozen = !S.frozen;
    else if (id === "step") { if (S.frozen) S.stepN = 2; }
    else if (id === "moves") moveList(api, m.f[0].id, function () { api.hide(); });
  }

  /* ---------- game object ---------- */
  var game = {
    song: A.song(4100, "synthwave", { bpm: 118 }), actions: ACTIONS,
    init: function (api) {
      api0 = api; S.reduce = api.reduce; setupCheats(api);
      if (api.settings && api.settings.add) { // per-game options (docs/ARCADE_SETTINGS.md)
        var G = "Impulse Arena";
        api.settings.add({ id: "ia_rounds", tab: "gameplay", section: G, label: "Rounds", type: "choice", default: "auto", choices: [["auto", "Mode default"], ["1", "Best of 1"], ["2", "Best of 3"], ["3", "Best of 5"]] });
        api.settings.add({ id: "ia_timer", tab: "gameplay", section: G, label: "Round timer", type: "choice", default: 60, choices: [[30, "30 s"], [60, "60 s"], [99, "99 s"]] });
        api.settings.add({ id: "ia_diff", tab: "gameplay", section: G, label: "Versus CPU difficulty", type: "choice", default: S.pick.diff, choices: D.DIFFICULTY.map(function (d) { return [d.id, d.name]; }), apply: function (v) { S.pick.diff = v; store("clash-diff", v); } });
        api.settings.add({ id: "ia_drops", tab: "gameplay", section: G, label: "Stage hazards (weapon drops)", type: "toggle", default: true });
        api.settings.add({ id: "ia_assist", tab: "gameplay", section: G, label: "Assist mode", type: "toggle", default: false, help: "You take 15 % less damage. ★ + a direction still fires each special without the motion." });
        api.settings.add({ id: "ia_input", tab: "display", section: G, label: "Show inputs in every fight", type: "toggle", default: false });
        api.settings.add({ id: "ia_readout", tab: "display", section: G, label: "Physics readouts on hits", type: "toggle", default: true });
      }
      api.panel("<p>Every hit is an <b>impulse</b> <span class='gm-eq'>J</span>: a force acting for a short contact time. It changes the defender's momentum, so a lighter fighter flies further from the same hit.</p>" +
        "<table><tr><td>Impulse</td><td><span class='gm-eq'>J = F̄Δt = mΔv</span> (N·s)</td></tr><tr><td>Knockback</td><td><span class='gm-eq'>Δv = J / m</span> (m/s)</td></tr><tr><td>Average force</td><td><span class='gm-eq'>F̄ = J / Δt</span> (N); a half-sine pulse peaks at πJ/(2Δt)</td></tr>" +
        "<tr><td>Blocking</td><td>same J, Δt ×4 → F̄ ÷4 (damage ∝ F̄)</td></tr><tr><td>Sliding to rest</td><td><span class='gm-eq'>a = μg</span>, μ = 0.6 → 5.9 m/s²</td></tr><tr><td>Falling apple</td><td><span class='gm-eq'>v = √(2gh)</span>, g = 9.8 m/s²</td></tr><tr><td>Half-life cloud</td><td><span class='gm-eq'>A = A₀(½)^(t/T½)</span>, T½ = 1 s in game</td></tr></table>" +
        "<p class='gm-small'>Simplified model: 1 m = 100 px; impulses are about 5–10× a real punch (~20–40 N·s) so the knockback is visible; damage is proportional to the average force; masses are each avatar's game stat. Specials and finishers are labelled game metaphors (no real death rays, time machines or teleporters). Course: PHYS 111, Newton's laws, impulse and momentum.</p>",
        "<table><tr><td>Move · jump · crouch</td><td><kbd>A</kbd><kbd>D</kbd> · <kbd>W</kbd> · <kbd>S</kbd> (or arrows)</td></tr><tr><td>Punches</td><td><kbd>J</kbd> low · <kbd>U</kbd> high</td></tr><tr><td>Kicks</td><td><kbd>K</kbd> low · <kbd>I</kbd> high</td></tr><tr><td>Block / special</td><td><kbd>L</kbd> or <kbd>Space</kbd> / <kbd>O</kbd></td></tr>" +
        "<tr><td>Dash / back-dash</td><td>double-tap → / ←</td></tr><tr><td>Throw · uppercut · sweep</td><td>close + LP · ↓ + HP · ← + LK</td></tr><tr><td>Specials</td><td>motions such as ↓→ + HP, or ★ + direction</td></tr><tr><td>Pause</td><td><kbd>P</kbd> / <kbd>Esc</kbd></td></tr></table>");
      menu(api);
    },
    update: function (dt, api) {
      cheatTick(api);
      S.t += dt; S.hurt = Math.max(0, S.hurt - dt); S.excite = Math.max(0.15, S.excite - dt * 0.15);
      S.fx.forEach(function (e) { e.t += dt; });
      S.pops.forEach(function (p) { p.life -= dt; p.y += dt * 0.25; }); S.pops = S.pops.filter(function (p) { return p.life > 0; });
      if (S.cap) S.cap.t -= dt; if (S.read) S.read.t -= dt; S.shakeBar[0] = Math.max(0, S.shakeBar[0] - dt); S.shakeBar[1] = Math.max(0, S.shakeBar[1] - dt);
      S.combo.forEach(function (c) { if (c) c.t -= dt; }); S.armed[0] = Math.max(0, S.armed[0] - dt); S.armed[1] = Math.max(0, S.armed[1] - dt);
      for (var li = S.later.length - 1; li >= 0; li--) if (S.t >= S.later[li].at) { var job = S.later[li]; S.later.splice(li, 1); job.fn(); }
      if (S.t - (S.uiT || -9) > 0.5) { S.uiT = S.t; var cw = 960; try { cw = api.x.canvas.getBoundingClientRect().width || 960; } catch (e) {} S.ui = Math.max(1, Math.min(2.1, 620 / cw)) * (+opt("hudScale", 1) || 1); }
      var m = S.m; if (!m) return;
      var isDemo = S.mode === "demo";
      if (!isDemo && api.overlayOpen()) return;
      if (S.mode === "tutdone") return;
      if (S.mode === "training") {
        if (api.hit("tr1")) trainAct(api, "reset"); if (api.hit("tr2")) trainAct(api, "dummy"); if (api.hit("tr3")) trainAct(api, "freeze"); if (api.hit("tr4")) trainAct(api, "step");
        if (S.frozen) { if (!S.stepN) return; S.stepN--; }
      }
      var c0 = S.human[0] ? readSide(api, 0) : {}, c1 = S.mode === "duo" ? readSide(api, 1) : {};
      if (S.mode === "tutorial") { c1 = tutDummy(m); if (c0.l) S.tw.l = 1; if (c0.r) S.tw.r = 1; }
      if (S.human[0] && !isDemo) recordInput(c0, m.f[0]);
      D.step(m, [c0, c1], dt);
      var evs = m.ev; m.ev = [];
      for (var i = 0; i < evs.length; i++) { onEvent(api, evs[i]); if (S.mode === "tutorial") tutCheck(api, evs[i]); if (S.mode === "trial") trialEvent(api, evs[i]); }
      if (S.mode === "trial") { m.f[0].meter = 100; if (S.trial && S.trial.okT > 0) S.trial.okT = Math.max(0.001, S.trial.okT - dt); }
      if (S.mode === "tutorial") tutCheck(api, null);
      if (m.f[0].ex > 0) S.armed[0] = m.f[0].ex; if (m.f[1].ex > 0) S.armed[1] = m.f[1].ex;
      var mid = (m.f[0].x + m.f[1].x) / 2, target = Math.max(0, Math.min(PH.stageW - PH.view, mid - PH.view / 2));
      S.cam += (target - S.cam) * Math.min(1, dt * 4);
      if (S.t - (S.crowdT || 0) > 0.25) { S.crowdT = S.t; api.sound.crowd(!isDemo && m.phase !== "over" ? 0.12 + S.excite * 0.4 : 0); }
    },
    draw: function (api) {
      var x = api.x, m = S.m;
      if (!m) { x.fillStyle = "#0b1015"; x.fillRect(0, 0, 960, 540); return; }
      var art = ARTS[S.arena.id] || ARTS.coil;
      art(x, api, "back");
      // traps, items, fighters (attacker drawn last so the hit reads clearly)
      var order = m.f.slice().sort(function (a, b) { var aa = a.st === "attack" || a.st === "special" || a.st === "throw" ? 1 : 0, bb = b.st === "attack" || b.st === "special" || b.st === "throw" ? 1 : 0; return aa - bb; });
      order.forEach(function (f) { drawFighter(x, api, f); });
      drawObjects(x, api);
      drawFinisher(x, api);
      drawFx(x, api);
      art(x, api, "fore");
      // vignette and red edge flash when the human player is hit
      var v = x.createRadialGradient(480, 280, 260, 480, 280, 620); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.45)"); x.fillStyle = v; x.fillRect(0, 0, 960, 540);
      if (S.hurt > 0) { var hv = x.createRadialGradient(480, 270, 280, 480, 270, 600); hv.addColorStop(0, "rgba(255,0,0,0)"); hv.addColorStop(1, "rgba(255,30,30," + Math.min(0.75, S.hurt * 1.5).toFixed(2) + ")"); x.fillStyle = hv; x.fillRect(0, 0, 960, 540); }
      if (S.mode === "demo") { x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, 0, 960, 540); return; }
      hud(x, api);
      if (S.mode === "training") trainingHud(x, api);
      if (S.mode === "trial") trialHud(x, api);
      if (S.mode === "tutorial" && TUT[S.tut]) { var st = TUT[S.tut]; x.fillStyle = "rgba(4,12,18,.88)"; x.fillRect(150, 132, 660, 66); x.fillStyle = "#7ef0ff"; x.textAlign = "center"; x.font = "800 20px system-ui"; x.fillText("Tutorial " + (S.tut + 1) + " of " + TUT.length + ": " + st.t, 480, 158); x.fillStyle = "#fff"; x.font = "16px system-ui"; x.fillText(st.d, 480, 184, 640); x.font = "600 13px system-ui"; x.fillStyle = "rgba(255,255,255,.7)"; x.fillText("Pause → Quit to menu to skip", 480, 214); }
    },
    click: function (px, py, api) {
      if (S.mode !== "training" || api.overlayOpen()) return;
      TRAIN_BTNS().forEach(function (b) { if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) trainAct(api, b.id); });
    },
    menu: function (api) { S.mode = "menu"; menu(api); }
  };
  A.run(game);
  window.ImpulseArena = { S: S, D: D, prog: function () { return prog(); }, start: function (o) { startMatch(window.EEArcadeDebug.api, o); }, menu: function () { menu(window.EEArcadeDebug.api); }, tutorial: function () { startTutorial(window.EEArcadeDebug.api); }, trainAct: function (id) { trainAct(window.EEArcadeDebug.api, id); } };
})();
