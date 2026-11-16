/* Freshers School Life — the running game: player, vehicles, traffic, campus people, shades and bosses, story glue,
   jobs, races, day and night, multiplayer sync, and the frame's draw order. Menus live in samaru-ui.js. */
(function () {
  "use strict";
  var S = window.SamaruSim, D = window.SamaruData, G = window.SamaruDraw, M = window.SamaruMap, TAU = Math.PI * 2;
  var Z = window.SamaruGame = { ui: {}, mode: "title", places: {}, placeList: [], npcs: [], peds: [], traffic: [], cars: [], foes: [], shots: [], drops: [], tokens: [], hazards: [], floats: [], bubbles: [], marks: [], guards: [], tele: [],
    cam: { x: 0, y: 0, s: 14 }, route: null, race: null, blackout: false, stick: { on: false, x: 0, y: 0 }, net: { on: false, code: "", peers: {}, since: 0, t: 0, out: [], offset: 0, me: 0, spar: 100 }, typed: "", konami: 0, retro: false };
  var W, P, api, me, rnd = S.rng(Date.now() & 0xffff | 1), cam = Z.cam, saveT = 0, routeT = 0, goalT = 0, spawnT = 0, subtitle = null, engine = null, lastSong = "", radio = 0, big = null, guardT = 0, eggT = 0, waves = 0, waveT = 0;
  var SKINS = ["#7a4a2b", "#8a5633", "#5e3a22", "#94603a", "#6b4226", "#a06a42", "#4f301c", "#85532f", "#c48f65", "#d6a67c"], HAIRS = ["low", "fade", "afro", "braids", "hijab", "cap", "locs", "puff", "coily"], TOPS = ["#1f8a5b", "#f1e9ff", "#d9482b", "#fde68a", "#f59e0b", "#e11d74", "#e2e8f0", "#2563eb", "#22d3ee", "#84cc16", "#a855f7", "#fb923c", "#0ea5e9", "#f8fafc", "#ef4444"], HIJ = ["#7c3aed", "#0e7490", "#be123c", "#0f766e", "#f59e0b", "#1d4ed8", "#111827"], MODES = ["tee", "tee", "kaftan", "ankara", "jersey"];
  var VCOL = { skate: "#f97316", bike: "#2563eb", scooter: "#10b981", okada: "#dc2626", keke: "#facc15", car: "#e5e7eb", sport: "#ef4444", plane: "#f59e0b" };
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function look(seed) { var h = function (n) { return S.hash(seed, n); }, hair = HAIRS[Math.floor(h(1) * HAIRS.length)]; return { skin: SKINS[Math.floor(h(2) * SKINS.length)], hair: hair, hairCol: hair === "hijab" ? HIJ[Math.floor(h(3) * HIJ.length)] : hair === "cap" ? ["#f8fafc", "#1e293b", "#7dd3fc", "#a16207"][Math.floor(h(3) * 4)] : null, top: TOPS[Math.floor(h(4) * TOPS.length)], mode: MODES[Math.floor(h(5) * MODES.length)], voice: hair === "hijab" || hair === "braids" || hair === "puff" ? "female" : "male", pitch: .8 + h(6) * .5 }; }
  Z.lookOf = look;
  Z.charOf = function (id) { if (D.HERO && id === D.HERO.id) return D.HERO; for (var i = 0; i < D.CAST.length; i++) if (D.CAST[i].id === id) return D.CAST[i]; return D.CAST[0]; };
  Z.npc = function (id) { for (var i = 0; i < Z.npcs.length; i++) if (Z.npcs[i].id === id) return Z.npcs[i]; return null; };
  Z.place = function (id) { return Z.places[id === "@home" ? (P && P.home) || "akenzua" : id]; };

  /* ---------- set-up ---------- */
  Z.setup = function (a) {
    api = Z.api = a; W = Z.W = S.buildWorld(M); G.init(W); try { S.setRules(a.config && a.config.rules); } catch (e) {}
    D.PLACES.forEach(function (pl) {
      var p = { id: pl.id, name: pl.name, role: pl.role || "", def: pl, x: pl.x, y: pl.y }, nr = S.nearRoad(W, pl.x, pl.y, 140);
      if (nr) { var dx = pl.x - nr.x, dy = pl.y - nr.y, l = Math.hypot(dx, dy) || 1, off = nr.r.w / 2 + 3; p.mx = nr.x + dx / l * Math.min(off, l); p.my = nr.y + dy / l * Math.min(off, l); } else { p.mx = pl.x; p.my = pl.y; }
      var f = S.push(W, p.mx, p.my, 1.4); p.mx = f.x; p.my = f.y; Z.places[p.id] = p; Z.placeList.push(p);
    });
    Z.tokens = S.placeTokens(W);
    var hr = S.rng(4242), i, q;
    for (i = 0; i < 70; i++) { q = S.randomRoadPoint(W, hr, true); if (q) Z.hazards.push({ k: "pothole", x: q.x + (hr() - .5) * q.r.w * .6, y: q.y + (hr() - .5) * q.r.w * .6, r: 1.1 }); }
    for (i = 0; i < 50; i++) { q = S.randomRoadPoint(W, hr, true); if (q) { var gx = q.x + Math.cos(q.a + 1.57) * (q.r.w / 2 + 1.6), gy = q.y + Math.sin(q.a + 1.57) * (q.r.w / 2 + 1.6); if (!S.insideBuilding(W, gx, gy)) Z.hazards.push({ k: "gutter", x: gx, y: gy, r: 1.0, a: q.a }); } }
    if (W.designed) Z.hazards = Z.hazards.filter(function (h) { return h.y < W.townY - 10; }); // the school is kept tidy; the town roads are not
    Z.hazards = Z.hazards.filter(function (h) { return !Z.placeList.some(function (p) { return Math.hypot(p.mx - h.x, p.my - h.y) < 9; }); });
    var kinds = ["water", "pie", "card", "glucose", "agbo"];
    for (i = 0; i < 48; i++) { q = S.randomRoadPoint(W, hr, false); if (q) { var f2 = S.push(W, q.x + Math.cos(q.a + 1.57) * (q.r.w / 2 + 2.5), q.y + Math.sin(q.a + 1.57) * (q.r.w / 2 + 2.5), 1); Z.drops.push({ i: i, k: kinds[i % 5], x: f2.x, y: f2.y }); } }
    function park(type, x, y, a) { var f3 = S.push(W, x, y, 1.2); Z.cars.push({ id: Z.cars.length, type: type, x: f3.x, y: f3.y, a: a || 0, vx: 0, vy: 0, speed: 0, col: type === "car" ? pick(["#e5e7eb", "#1d4ed8", "#16a34a", "#7c3aed", "#111827", "#f59e0b"]) : VCOL[type], hx: f3.x, hy: f3.y, ha: a || 0 }); }
    Z.placeList.forEach(function (p) {
      (p.def.rent || []).forEach(function (t, n) { park(t, p.mx + 5 + n * 3.4, p.my + (n % 2 ? 4 : -4), n); });
      if (p.role === "home" || p.id === "library" || p.id === "court" || p.id === "fslt") { park("bike", p.mx - 4, p.my + 3, 1); park("skate", p.mx - 5.5, p.my - 2.5, 2); }
    });
    [["okada", 9], ["keke", 5], ["car", 8], ["scooter", 6], ["bike", 8], ["sport", 2]].forEach(function (t) { for (var n = 0; n < t[1]; n++) { var r = S.randomRoadPoint(W, hr, true); if (r) park(t[0], r.x + Math.cos(r.a + 1.57) * (r.r.w / 2 + 1.2), r.y + Math.sin(r.a + 1.57) * (r.r.w / 2 + 1.2), r.a); } });
    D.NPCS.forEach(function (n, k) { Z.npcs.push({ id: n.id, def: n, look: { skin: n.skin, hair: n.hair, hairCol: n.hairCol, top: n.top }, x: 0, y: 0, a: 0, hx: 0, hy: 0, k: k, mode: n.hair === "cap" ? "kaftan" : k % 3 === 0 ? "ankara" : "tee", walk: 0, wave: 0 }); });
    var st3 = document.querySelector("[data-gm-three]"), url3 = st3 && st3.getAttribute("data-gm-three");
    if (url3 && Z.r3 && !api.store("samaru-flat")) Z.r3.init(url3, W).catch(function (e) { Z.r3.ready = false; Z.r3err = String(e && e.message || e); if (window.console) console.warn("3D view unavailable, using the map view.", e); });
    me = Z.me = { x: 6, y: -60, a: 1.57, vx: 0, vy: 0, z: 0, vz: 0, walk: 0, veh: null, speed: 0, emote: "", emoteT: 0, fall: 0, punch: 0, cool: 0, inv: 0, torch: false, alt: 0, sit: false, dash: 0, boost: 0, shield: 0, combo: 0 };
    cam.x = 6; cam.y = -40; cam.s = 7;
    var cv = document.querySelector("[data-gm-canvas]");
    if (Z.touch && Z.touch.init) Z.touch.init(api); // thumb sticks, phone buttons and gamepad live in samaru-touch.js
    document.addEventListener("keydown", function (e) { // typed cheats, the Konami egg
      if (Z.mode !== "play" || (e.target.closest && e.target.closest("input, textarea"))) return;
      var seq = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
      Z.konami = e.code === seq[Z.konami] ? Z.konami + 1 : e.code === seq[0] ? 1 : 0; if (Z.konami === seq.length) { Z.konami = 0; Z.retro = !Z.retro; Z.egg("retro", "Retro mode " + (Z.retro ? "on" : "off") + "."); }
      if (S.isHero(P) && !e.repeat && (e.code === "Backslash" || e.code === "BracketRight")) { if (e.code === "Backslash") Z.cheat(S.cheatById("skip")); else if (Z.ui.cheats) Z.ui.cheats(); return; }
      if (e.key && e.key.length === 1 && /[a-z0-9]/i.test(e.key) && !e.ctrlKey && !e.metaKey) { Z.typed = (Z.typed + e.key.toUpperCase()).slice(-24); if (Z.typed.slice(-5) === "EEHUB") Z.egg("credits", (Z.resolveText || String)("{{GAME_NAME}}") + " — designed and built by " + D.CREATOR.full + " for the EE Hub arcade."); var c = S.cheatMatch(Z.cheatTable(), Z.typed, "typed"); if (c) { Z.typed = ""; Z.cheat(c); } }
    });
  };
  // Save versions (MASTER_GAME_GUIDE §4.5). saveVersion is the one number for the whole save:
  //   0 (missing) = before versioning: S.migrate fills new fields (P.v → 2); the story block is migrated by ST.migrate
  //                 inside Z.begin (story.ver 1 → 2: the Year 1 rewrite).
  //   1           = P.v 2 (current); the story block keeps its own story.ver (ST.SAVE_VERSION, migrated in Z.begin).
  // A save from a newer build is not loaded into older structures: Z.load returns null and says why.
  Z.SAVE_VERSION = 1;
  Z.SAVE_MIGRATIONS = { 0: function (p) { S.migrate(p); return p; } };
  Z.load = function () { return Z.upgrade(api.store("fslg-save")); };
  Z.upgrade = function (p) { // any stored save (the last-played one or a slot, samaru-saves.js) → current structures, or null
    Z.loadError = ""; if (!p || typeof p !== "object") return null;
    var v = +p.saveVersion || 0; if (v > Z.SAVE_VERSION) { Z.loadError = "This save is from a newer version of the game (save " + v + ", game " + Z.SAVE_VERSION + "). It was left untouched."; if (window.console) console.warn(Z.loadError); return null; }
    while (v < Z.SAVE_VERSION) { p = (Z.SAVE_MIGRATIONS[v] || function (q) { return q; })(p) || p; v++; }
    p = S.migrate(p); if (p) p.saveVersion = Z.SAVE_VERSION; return p;
  };
  Z.save = function () { if (!P) return; P.x = me.x; P.y = me.y; P.a = me.a; P.saveVersion = Z.SAVE_VERSION; api.store("fslg-save", P); };
  Z.begin = function (p, fresh) {
    P = Z.P = p; Z.mode = "play"; me.x = P.x; me.y = P.y; me.a = P.a || 0; me.veh = null; me.fall = 0; me.alt = 0; cam.x = me.x; cam.y = me.y; cam.s = 14;
    var free = S.push(W, me.x, me.y, .6); me.x = free.x; me.y = free.y;
    Z.npcs.forEach(function (n) { var pl = Z.place(n.def.at), ang = S.hash(n.k, 5) * TAU, r = 2.5 + S.hash(n.k, 9) * 2.5, f = S.push(W, pl.mx + Math.cos(ang) * r, pl.my + Math.sin(ang) * r, .6); n.x = n.hx = f.x; n.y = n.hy = f.y; n.a = ang + Math.PI; n.follow = false; }); if (Z.friends) Z.friends.reset(); if (Z.crowd) Z.crowd.reset(); if (Z.city) Z.city.reset();
    Z.foes.length = 0; Z.shots.length = 0; Z.guards.length = 0; Z.race = null; Z.route = null; routeT = 0;
    api.useActions(["act", "attack", "jump", "run", "phone", "torch", "emote1", "emote2"]);
    if (Z.r3) Z.r3.yaw = me.a;
    if (fresh) { P.x = me.x; P.y = me.y; }
    if (!P.m.active) Z.nextStory(true);
    else Z.stepStart();
    Z.save();
  };

  /* ---------- talking, text, sound ---------- */
  Z.say = function (who, text, quiet) {
    var o = who === "me" || !who ? me : who, lk = who === "me" || !who ? Z.charOf(P.char) : (who.def || who.look || {});
    Z.bubbles = Z.bubbles.filter(function (b) { return b.o !== o; }); Z.bubbles.push({ o: o, text: text, t: 0, dur: 1.6 + text.length * .06 });
    if (!quiet) api.sound.say(text, { voice: lk.voice || "male", pitch: (lk.pitch || 1) * (o === me ? [1, .8, 1.25][P.voiceTone || 0] : 1), vi: o === me ? (P.voiceI || 0) : (o.k || 0), queue: false, x: o === me ? undefined : o.x, y: o === me ? undefined : o.y });
  };
  Z.bark = function (kind) { var l = D.BARKS[kind]; if (l) Z.say("me", pick(l)); };
  Z.sub = function (who, text, dur) { subtitle = { who: who, text: text, t: 0, dur: dur || Math.max(4, text.length * .075) }; };
  Z.float = function (x, y, text, col) { Z.floats.push({ x: x, y: y, text: text, col: col || "#fff", t: 0 }); };
  Z.toast = function (html) { if (window.Arcade && Arcade.toast) Arcade.toast(html); };
  Z.egg = function (id, text) { if (P && !P.eggs[id]) { P.eggs[id] = 1; api.confetti(80); api.sound.sfx("power"); Z.toast("<b>Easter egg found!</b><br>" + text + "<br><small>" + Object.keys(P.eggs).length + " of 8</small>"); } else Z.toast(text); };
  Z.money = function (n, why) { P.money += n; if (n > 0) { api.sound.sfx("coin"); Z.float(me.x, me.y - 1.5, "+₦" + n.toLocaleString(), "#86efac"); } else if (n < 0) Z.float(me.x, me.y - 1.5, "−₦" + (-n).toLocaleString(), "#fca5a5"); void why; };
  Z.xp = function (n) { var lv = S.addXp(P, n); if (n > 0) Z.float(me.x, me.y - 2.3, "+" + n + " XP", "#fde047"); if (lv > 0) Z.levelUp(); };
  Z.levelUp = function () {
    var got = []; S.VEH_ORDER.forEach(function (t) { if (S.VEH[t].lvl === P.lvl) { got.push(S.VEH[t].name); Z.toast("<b>New licence:</b> " + S.VEH[t].name); } });
    var nx = S.VEH_ORDER.filter(function (t) { return S.VEH[t].lvl > P.lvl; }).sort(function (a, b) { return S.VEH[a].lvl - S.VEH[b].lvl; })[0];
    Z.moment("level", { lvl: P.lvl, title: S.title(P.lvl), unlocks: got, next: nx ? S.VEH[nx].name + " licence at level " + S.VEH[nx].lvl : "" }); Z.bark("levelup");
  };
  function song(key, seed, style, o, title) { if (lastSong === key) return; lastSong = key; if (api.settings) { api.settings.musicMul = key.indexOf("radio") === 0 ? (Z.opt ? Z.opt("radioVol", 1) : 1) : 1; if (api.sound.applySet) api.sound.applySet(); } api.music(Arcade.song(seed, style, o)); if (title && Z.mode === "play" && !api.sound.muted) Z.toast("♪ <b>" + title + "</b>"); }
  var zone = { id: "", want: "", t: 0 };
  function bucket() { var h = P.time / 60, b = 3; for (var i = 0; i < D.TIMES.length; i++) if (h >= D.TIMES[i][0]) b = i; return h < D.TIMES[0][0] ? 3 : b; }
  function music() {
    if (Z.mode !== "play") return song("title", 500, "afro", { bpm: 100, scale: "major" });
    if (Z.foes.some(function (f) { return f.def.boss; })) return song("boss", 520, "boss", { bpm: 138 }, "Boss Fight");
    if (Z.race && Z.race.go) return song("race", 521, "breaks", { bpm: 134 }, "Green Light");
    if (Z.blackout) return song("dark", 522, "dub", { bpm: 84, scale: "minor" }, "No Light");
    if (me.veh && me.veh.type !== "skate" && P.flags.radioOff !== 1) { var r = D.RADIO[radio]; return song("radio" + radio, r.seed, r.style, r.o); }
    // on foot: the nearest landmark sets the mood, and it has to hold for a few seconds before the band changes
    var best = "", bd = 150; Z.placeList.forEach(function (p) { if (!p.def.zone) return; var d = Math.hypot(p.mx - me.x, p.my - me.y); if (d < bd) { bd = d; best = p.def.zone; } });
    if (!best) best = me.y < W.townY ? "market" : "garden";
    if (best !== zone.want) { zone.want = best; zone.t = 0; } zone.t += 1 / 120; if (!zone.id || (zone.id !== zone.want && zone.t > 3.5)) zone.id = zone.want;
    var z = D.ZONES[zone.id] || D.ZONES.garden, b = bucket(), night = b === 3;
    song("z" + zone.id + b, z.seed + b * 7, night && z.style !== "calm" ? (z.style === "afro" || z.style === "amapiano" ? "amapiano" : "dub") : z.style, { bpm: z.bpm + [4, 0, -6, -14][b], scale: b === 2 ? "dorian" : night ? "minor" : z.scale }, z.name + " · " + D.TIMES[b][1]);
  }
  Z.radioNext = function () { var n = D.RADIO.length; do { radio = (radio + 1) % n; } while (D.RADIO[radio].secret && !P.eggs.radio); P.flags.radioOff = 0; Z.toast("Radio: <b>" + D.RADIO[radio].name + "</b>"); api.sound.say(D.RADIO[radio].dj, { voice: "male", pitch: 1.1, rate: 1.1 }); };
  // ambience: birds by day, crickets by night, water near the fountain and the lake
  var amb = { t: 2, water: null };
  function ambience(dt) {
    var snd = api.sound; if (!snd.ac || snd.muted || Z.mode !== "play" || (Z.audio && Z.audio.amb)) { if (amb.water) amb.water.g.gain.value = 0; return; } // recorded birds, crickets and water take over when loaded
    var ac = snd.ac, out = snd.fx || ac.destination, dk = S.darkness(P.time), now = ac.currentTime;
    if (!amb.water) { try { var len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = buf; src.loop = true; f.type = "bandpass"; f.frequency.value = 1400; f.Q.value = .6; g.gain.value = 0; src.connect(f); f.connect(g); g.connect(out); src.start(); amb.water = { g: g, f: f }; } catch (e) { amb.water = { g: { gain: {} }, f: { frequency: {} } }; } }
    var df = Math.hypot(me.x, me.y + 300), dl = Math.max(0, Math.hypot(me.x, (me.y - 525) * 2) - 235), near = Math.min(df, dl * .8); amb.water.g.gain.value = me.veh ? 0 : Math.max(0, .05 * (1 - near / 60)); amb.water.f.frequency.value = df < dl ? 2200 : 700;
    amb.t -= dt; if (amb.t > 0 || me.veh || Z.blackout) return;
    function chirp(f0, f1, at, dur, vol) { try { var o = ac.createOscillator(), g2 = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(f0, now + at); o.frequency.exponentialRampToValueAtTime(f1, now + at + dur); g2.gain.setValueAtTime(.0001, now + at); g2.gain.exponentialRampToValueAtTime(vol, now + at + dur * .3); g2.gain.exponentialRampToValueAtTime(.0001, now + at + dur); o.connect(g2); g2.connect(out); o.start(now + at); o.stop(now + at + dur + .02); } catch (e) {} }
    if (dk < .4) { amb.t = 1.5 + rnd() * 4; if (me.y > W.townY) { var base = 2400 + rnd() * 1800, n = 2 + Math.floor(rnd() * 3); for (var k = 0; k < n; k++) chirp(base, base * (1.2 + rnd() * .5), k * .13, .09, .012); } }
    else { amb.t = .5 + rnd() * .9; for (var c = 0; c < 3; c++) chirp(4300, 4250, c * .07, .04, .006); }
  }
  function engineSound() {
    var snd = api.sound; if (!snd.ac || snd.muted || (Z.audio && Z.audio.engines)) { if (engine) engine.g.gain.value = 0; return; } // samaru-audio.js plays recorded engine loops when it is running
    if (!engine) { try { var o = snd.ac.createOscillator(), g = snd.ac.createGain(), f = snd.ac.createBiquadFilter(); o.type = "sawtooth"; f.type = "lowpass"; f.frequency.value = 500; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(snd.fx || snd.ac.destination); o.start(); engine = { o: o, g: g }; } catch (e) { return; } }
    var v = me.veh, on = Z.mode === "play" && v && v.type !== "skate" && v.type !== "bike" && !api.overlayOpen(), sp = v ? Math.abs(v.speed) : 0;
    engine.g.gain.value = on ? .035 + Math.min(.05, sp * .002) : 0; if (on) engine.o.frequency.value = (v.type === "plane" ? 70 : v.type === "okada" || v.type === "scooter" ? 85 : 55) + sp * (v.type === "sport" ? 5 : 4);
  }

  /* ---------- story glue ---------- */
  Z.mission = function () { if (!P.m.active) return null; for (var i = 0; i < D.MISSIONS.length; i++) if (D.MISSIONS[i].id === P.m.active) return D.MISSIONS[i]; return null; };
  Z.step = function () { var m = Z.mission(); return m ? m.steps[P.m.step] : null; };
  Z.nextStory = function (quiet) {
    var m = S.nextMission(P, D.MISSIONS); if (!m) return null;
    S.startMission(P, m); if ((!quiet || m.id === "m1") && !(Z.intro && Z.intro.pending)) { api.banner(m.title.toUpperCase(), { col: "#7ef0ff", edge: "#0b4a5c", size: Math.min(84, 1200 / m.title.length), sub: "Chapter " + m.ch, dur: 3 }); Z.sub("", m.intro, 6); }
    Z.stepStart(); return m;
  };
  Z.stepStart = function () {
    var st = Z.step(); Z.quest = null; routeT = 0; Z.lastPlace = null; /* a new step re-checks where you stand */ if (!st) return;
    if (st.say && st.t !== "talk") Z.sub(st.say[0], st.say[1]);
    if (st.t === "find") { var pl = Z.place(st.at), ang = S.hash(P.m.step, pl.mx | 0) * TAU, r = 16 + S.hash(pl.my | 0, 3) * 16, f = S.push(W, pl.mx + Math.cos(ang) * r, pl.my + Math.sin(ang) * r, 1); for (var fk = 1; fk < 12 && (S.inWater(W, f.x, f.y) || S.insideBuilding(W, f.x, f.y)); fk++) { var a2 = ang + fk * 2.4, r2 = Math.max(6, r - fk * 2.5); f = S.push(W, pl.mx + Math.cos(a2) * r2, pl.my + Math.sin(a2) * r2, 1); } /* on dry ground, outdoors */ Z.quest = { item: st.item, x: f.x, y: f.y, cx: pl.mx, cy: pl.my, r: 42 }; }
  };
  Z.target = function () { // where the yellow line leads
    if (Z.race) return null; if (window.FSLGCoop && FSLGCoop.active()) { var ct = FSLGCoop.target(); if (ct) return ct; }
    if (P.job) { var j = P.job; return j.kind === "lost" ? j.b : j.stage === 0 ? j.a : j.b; }
    if (Z.date && Z.date.spot) { var dp = Z.place(Z.date.spot); return { x: dp.mx, y: dp.my, name: dp.name }; }
    var st = Z.step(); if (!st) return Z.waypoint;
    var sn = st.npc ? Z.npc(Z.story && Z.story.tok ? Z.story.tok(P, st.npc) : st.npc) : null; // @roomie, @best… resolve to the person
    var id = st.place || (typeof st.at === "string" && st.at) || (sn && sn.def.at) || (st.t === "sleep" ? "@home" : st.t === "race" ? "club" : st.t === "buy" ? "market" : st.t === "ride" ? (st.veh === "plane" ? "strip" : st.veh === "keke" ? "gate" : "") : st.t === "class" ? "@dept" : st.t === "eat" ? nearRole("food") : st.t === "job" ? nearRole("jobs") : "");
    if (sn && !sn.hidden) return { x: sn.x, y: sn.y, name: sn.def.name };
    if (!id) return Z.waypoint; var p = Z.place(id); return p ? { x: p.mx, y: p.my, name: p.name } : Z.waypoint;
  };
  function nearRole(role) { var b = null, bd = 1e9; Z.placeList.forEach(function (q) { var d = Math.hypot(q.mx - me.x, q.my - me.y); if (q.role === role && d < bd) { bd = d; b = q; } }); return b ? b.id : ""; }
  // The one objective reader (MASTER_GAME_GUIDE §4.1): HUD text, distance readout, minimap star, 2D beacon, 3D beam and the
  // full map all show this, so they cannot disagree. text has every token resolved (@roomie → the name, {{GAME_NAME}} → config).
  Z.objText = function (st) {
    if (!st || !st.text) return ""; var ST = Z.story, t = String(st.text).replace("your hostel", (Z.place("@home") || {}).name || "your hostel");
    t = t.replace(/[@$][a-z_]+/g, function (k) { var id = ST && ST.tok ? ST.tok(P, k) : k; if (id === k) return k; var n = Z.npc(id), pl = n ? null : Z.place(k); return n ? n.def.name : pl ? pl.name : k; });
    if (Z.resolveText) { try { t = Z.resolveText(t); } catch (e) {} } else if (Z.text) t = Z.text(t);
    return t;
  };
  Z.objective = function () {
    var st = Z.step(), tg = Z.target(), m = Z.mission ? Z.mission() : null;
    return { stepId: st && m ? m.id + "." + (P.m.step + 1) : "", text: st ? Z.objText(st) : "", target: tg || null, marker: tg ? { x: tg.x, y: tg.y, name: tg.name || "" } : null };
  };
  Z.emit = function (ev) {
    if (!P) return;
    if (Z.guide) Z.guide.on(ev);
    var st = Z.step(), r = S.missionEvent(P, D.MISSIONS, ev);
    if (!r) return;
    if (r.progress) { Z.toast(r.mission.title + ": " + r.progress + " / " + r.of); return; }
    if (st && st.give) { P.inv[st.give] = (P.inv[st.give] || 0) + 1; Z.toast("You got: <b>" + D.ITEMS[st.give].name + "</b><br><small>" + (D.ITEMS[st.give].text || "") + "</small>"); }
    api.sound.sfx("power");
    if (r.step) { Z.stepStart(); Z.toast("<b>Next:</b> " + r.step.text); }
    if (r.done) {
      var rw = r.reward, storyOver = !r.done.side && !D.MISSIONS.some(function (m) { return !m.side && !P.m.done[m.id]; });
      Z.moment("mission", { title: r.done.title, cash: rw.cash || 0, xp: rw.xp || 0 });
      if (r.levels > 0) Z.levelUp();
      if (storyOver) Z.moment("finale", { sub: r.done.title });
      if (rw.flag === "restored") { P.flags.nepa = 0; Z.toast("<b>The grid is back.</b> Semester two begins: races, jobs, classes, 150 kola nuts and the long road to level 150."); }
      Z.report(); Z.save(); Z.quest = null;
      setTimeout(function () { if (Z.mode === "play" && !P.m.active) { var n = Z.nextStory(); if (!n) { var w = D.MISSIONS.filter(function (m) { return !m.side && !P.m.done[m.id]; })[0]; if (w && w.need && w.need.lvl > P.lvl) Z.toast("<b>Next chapter at level " + w.need.lvl + ".</b> Attend classes, take jobs, win races."); } } }, storyOver ? 15500 : r.levels > 0 ? 7800 : 4400);
    }
  };
  Z.report = function () { // arcade profile: stage = story missions finished. Cheated saves stay off the board.
    if (!Z.boardsOpen() || !window.Arcade) return; var n = S.storyProgress(P, D.MISSIONS).done; if (n < 1 || n <= P.reported) return; P.reported = n;
    Arcade.report("samaru-days", { result: "win", stage: Math.min(36, n), score: Math.min(5000, P.lvl * 40 + P.stats.tokens * 8 + P.stats.jobs * 5 + P.stats.races * 15) });
  };
  function statOf(k) { return k === "level" ? P.lvl : k === "besties" ? Object.keys(P.friends).filter(function (f) { return P.friends[f] >= 80; }).length : P.stats[k] || 0; }
  function goals() { // long-haul goals complete in the background
    D.MISSIONS.forEach(function (m) { if (!m.side || !S.missionOpen(P, m)) return; var st = m.steps[0]; if (!S.stepMatches(st, { t: "stat", stat: st.stat, value: statOf(st.stat) })) return;
      P.m.done[m.id] = 1; P.money += m.reward.cash || 0; Z.moment("goal", { title: m.title, cash: m.reward.cash || 0, xp: m.reward.xp || 0 }); if (m.reward.xp) Z.xp(m.reward.xp); Z.save(); });
    if (!P.m.active && Z.mode === "play") Z.nextStory();
  }
  Z.goalList = function () { return D.MISSIONS.filter(function (m) { return m.side && S.missionOpen(P, m); }).map(function (m) { var st = m.steps[0]; return { m: m, have: Math.min(st.val, statOf(st.stat)), need: st.val }; }); };

  /* ---------- cheats ---------- */
  Z.cheatTable = function () { var cf = api.config; return cf && cf.cheats && cf.cheats.length ? cf.cheats : S.CHEAT_DEFAULT; };
  Z.boardsOpen = function () { return !P.cheated || !!(api.config && api.config.cheatsOnBoards); }; // cheated saves report only when the site allows it
  Z.cheat = function (c) {
    if (!c || !P) return; if (c.id === "missions") { api.sound.sfx("special"); if (Z.ui.missions) Z.ui.missions(); return; }
    S.applyCheat(P, c.id); api.sound.sfx("special"); api.flash("#fde047", .25); api.banner("CHEAT", { size: 60, col: "#f0abfc", edge: "#581c87", sub: c.text, dur: 2.4, y: 150 });
    var spawn = { skate: 1, okada: 1, keke: 1, car: 1, sport: 1, plane: 1 }[c.id];
    if (spawn) { var f = S.push(W, me.x + Math.cos(me.a + 1.2) * 3.5, me.y + Math.sin(me.a + 1.2) * 3.5, 1.2); Z.cars.push({ id: Z.cars.length, type: c.id, x: f.x, y: f.y, a: me.a, vx: 0, vy: 0, speed: 0, col: VCOL[c.id], hx: f.x, hy: f.y, ha: me.a, free: true }); }
    if (c.id === "nepa") { P.flags.nepa = 1; P.flags.light = 0; } if (c.id === "light") { P.flags.nepa = 0; P.flags.light = P.day; Z.foes = Z.foes.filter(function (f) { if (f.k === "shade" && !f.quest) { api.burst(Z.px(f.x, f.y), Z.py(f.x, f.y), "#c4b5fd", 10); return false; } return true; }); }
    if (c.id === "calm" || c.id === "calloff") { Z.guards.length = 0; if (Z.callOff) Z.callOff(); }
    if (c.id === "level" || c.id === "max" || c.id === "toplvl") Z.levelUp();
    if (c.id === "skip" && Z.story && Z.story.solve && Z.step()) { Z.foes = Z.foes.filter(function (f) { return !f.quest; }); Z.story.solve("main", 0); }
    else if (c.id === "skip") { var st = Z.step(); if (st) { var m = Z.mission(), left = (st.n || 1) - P.m.n; P.m.n += left - 1; var fake = { t: st.t, place: st.place, npc: st.npc, item: st.item, enemy: st.enemy, veh: st.veh, emote: st.emote, race: st.race, night: true, score: 9 }; Z.foes = Z.foes.filter(function (f) { return !f.quest; }); Z.emit(fake); void m; } }
    Z.save();
  };

  /* ---------- player actions ---------- */
  Z.emote = function (e) {
    if (me.veh || me.fall) return; me.emote = e; me.emoteT = e === "sit" ? 1e9 : e === "dance" ? 4 : 1.6; me.sit = e === "sit";
    if (e === "wave") { Z.bark("wave"); var hit = false; Z.npcs.concat(Z.peds).forEach(function (n) { if (dist(n, me) < 9 && !n.fall) { n.wave = 1.6; n.a = Math.atan2(me.y - n.y, me.x - n.x); if (n.def) { var k = "w_" + n.id; if (P.flags[k] !== P.day) { P.flags[k] = P.day; S.bond(P, n.id, 2); Z.float(n.x, n.y - 1.6, "♥", "#f9a8d4"); hit = true; } } else if (n.waved !== P.day) { n.waved = P.day; hit = true; } } }); if (hit) Z.xp(2);
      var sc = Z.places.sculpture; if (Math.hypot(sc.mx - me.x, sc.my - me.y) < 30) { waves = waveT > 0 ? waves + 1 : 1; waveT = 8; if (waves >= 5) { waves = 0; Z.egg("statue", "A statue waved back. It left you ₦2,000."); if (P.eggs.statue === 1) { P.eggs.statue = 2; Z.money(2000); } } } }
    if (e === "dance") { Z.bark("dance"); api.sound.sfx("special"); Z.npcs.forEach(function (n) { if (dist(n, me) < 7 && n.follow) S.bond(P, n.id, 1.5); }); var h = P.time / 60, pl = Z.near(26); if (pl && pl.id === "senate" && (h >= 23.5 || h < 1.5)) Z.egg("senate", "Midnight dance at the Senate. The security men clapped."); }
    var np = Z.near(26); Z.emit({ t: "emote", emote: e, place: np ? np.id : "" }); if (Z.net.on) Z.net.out.push({ k: "emote", e: e });
  };
  Z.near = function (r) { var best = null, bd = r || 6; Z.placeList.forEach(function (p) { var d = Math.hypot(p.mx - me.x, p.my - me.y); if (d < bd) { bd = d; best = p; } }); return best; };
  Z.hurt = function (d, from) {
    if (me.inv > 0 || P.god || me.shield > 0 || Z.mode !== "play") return; P.hp -= d; me.inv = .7; api.kick(8); api.flash("#ef4444", .18); api.sound.sfx("hit"); if (from && from.x != null) { var ha = Math.atan2(me.y - from.y, me.x - from.x); me.hitT = .35; me.hitA = ha; if (!me.veh) Z.fx.knock(me, ha, 3); Z.fx.sparks(me.x, 1.2, me.y, 8, 0xfca5a5); Z.fx.camKick(ha, .2); } api.buzz(40); Z.float(me.x, me.y - 1.4, "−" + Math.round(d), "#fca5a5"); if (rnd() < .4) Z.bark("hit");
    if (from) { var a = Math.atan2(me.y - from.y, me.x - from.x); me.x += Math.cos(a) * .8; me.y += Math.sin(a) * .8; }
    if (P.hp <= 0) Z.faint();
  };
  Z.faint = function () {
    // only a lost fight puts you down, and only for a moment: you get up a few steps away with most of your health
    if (me.fall > 50) return; if (me.veh) Z.exit(true); me.fall = 99; Z.bark("faint"); var near = null, nd = 1e9; Z.foes.forEach(function (f) { var d = dist(f, me); if (d < nd) { nd = d; near = f; } });
    var ba = near ? Math.atan2(me.y - near.y, me.x - near.x) : me.a + Math.PI, kx = me.x, ky = me.y;
    Z.moment("ko", { text: pick(["Shake it off. They got lucky.", "Everybody falls. Stand up.", "Catch your breath, then go again.", "No wahala. Round two."]) });
    setTimeout(function () { S.faint(P); var q = S.nearRoad ? S.nearRoad(W, kx + Math.cos(ba) * 16, ky + Math.sin(ba) * 16) : null, sp = S.push(W, q && q.x != null ? q.x : kx + Math.cos(ba) * 12, q && q.y != null ? q.y : ky + Math.sin(ba) * 12, .5); me.x = sp.x; me.y = sp.y; me.fall = 0; me.inv = 2.5; me.cs = 0; cam.x = me.x; cam.y = me.y; Z.foes.length = 0; Z.tele.length = 0; Z.shots.length = 0; Z.save(); }, 1100);
  };
  Z.enter = function (v) {
    if (v.job && !(P.job && P.job.veh === v)) { Z.toast("That one is for a job. Take the job first."); api.sound.sfx("block"); return; }
    var spec = S.VEH[v.type]; if (P.lvl < spec.lvl && !v.job && !v.coop) { Z.toast("<b>" + spec.name + "</b> needs a level " + spec.lvl + " licence. You are level " + P.lvl + "."); api.sound.sfx("block"); return; }
    if (spec.rent && !v.free && !P.flags["own_" + v.type] && !v.paid) { if (P.money < spec.rent) { Z.toast("Hire costs ₦" + spec.rent + ". You have ₦" + P.money + "."); api.sound.sfx("block"); return; } Z.money(-spec.rent); v.paid = true; }
    me.quickIn = (me.cs || 0) > S.FOOT.walk * 1.15; me.veh = v; v.vx = v.vy = 0; v.doorT = me.quickIn ? 0 : .8; me.av = 0; me.emote = ""; me.sit = false; me.torch = false; api.sound.sfx("click"); if (rnd() < .3) Z.bark("ride"); Z.emit({ t: "ride", veh: v.type });
    api.useActions(spec.two ? ["act", "jump", "drift", "run", "phone", "horn", "radio"] : ["act", "drift", "phone", "horn", "radio"]);
  };
  Z.exit = function (force) {
    var v = me.veh; if (!v) return; if (me.alt > .05 && !force) { Z.toast("Land first."); return; }
    me.veh = null; me.alt = 0; me.av = 0; v.doorT = force ? 0 : .8; v.hz = 0; v.sprint = v.tuck = false; v.lock = false; var f = S.push(W, v.x + Math.cos(v.a - 1.57) * (S.VEH[v.type].wid / 2 + .9), v.y + Math.sin(v.a - 1.57) * (S.VEH[v.type].wid / 2 + .9), .5); me.x = f.x; me.y = f.y; v.vx = v.vy = 0; v.speed = 0;
    api.useActions(["act", "attack", "jump", "run", "phone", "torch", "emote1", "emote2"]);
  };
  Z.eat = function (id) { var f = D.FOOD[id]; if (!f || P.money < f.price) return false; Z.money(-f.price); P.hunger = Math.min(100, P.hunger + (f.hunger || 0)); P.energy = Math.min(100, P.energy + (f.energy || 0)); P.hp = Math.min(P.maxHp, P.hp + (f.hp || 0) + 5); api.sound.sfx("power"); if (rnd() < .6) Z.bark("eat"); Z.emit({ t: "eat", item: id }); Z.npcs.forEach(function (n) { if (n.follow && dist(n, me) < 12) { S.bond(P, n.id, 3); Z.float(n.x, n.y - 1.6, "♥", "#f9a8d4"); } }); return true; };
  Z.sleep = function () { var h = S.sleep(P); api.flash("#000", 1.4); Z.bark("sleep"); Z.emit({ t: "sleep" }); Z.foes.length = 0; newDay(); Z.save(); Z.toast("You slept " + Math.round(h) + " hours. Day " + P.day + "."); };
  function newDay() { Z.traffic.length = 0; Z.peds.length = 0; }

  /* ---------- enemies ---------- */
  Z.spawnFoe = function (k, x, y, quest) { var d = D.ENEMIES[k], f = S.push(W, x, y, d.r); Z.foes.push({ k: k, def: d, x: f.x, y: f.y, a: 0, hp: d.hp * (k === "shade" ? 1 + P.lvl * .06 : 1), max: d.hp * (k === "shade" ? 1 + P.lvl * .06 : 1), st: "chase", t: 0, cd: 2 + rnd() * 2, quest: !!quest, frozen: 0, flash: 0, walk: 0, look: d.human ? look(Math.floor(rnd() * 1e6)) : null }); if (d.boss) { api.banner(d.name.toUpperCase(), { col: "#f87171", edge: "#450a0a", size: 80, dur: 2.4 }); api.sound.sfx("boom"); } return Z.foes[Z.foes.length - 1]; };
  Z.hitFoe = function (f, dmg, ang, heavy) { hitFoe(f, dmg, ang, heavy); };
  function hitFoe(f, dmg, ang, heavy) {
    if (f.frozen > 0) dmg *= 2; if (P.flags.onehit) dmg = 1e6; f.hp -= dmg; f.flash = .15; Z.fx.knock(f, ang, (heavy ? 9 : 4.5) * (f.def.boss ? .3 : 1)); Z.fx.hit(f, ang, heavy, f.def.human ? (heavy ? "kick" : "punch") : "shade");
    Z.float(f.x, f.y - 1.2, Math.round(dmg) + "", heavy ? "#fde047" : "#fff"); if (!(Z.r3 && Z.r3.ready)) api.burst(Z.px(f.x, f.y), Z.py(f.x, f.y), f.def.human ? "#fff" : "#a78bfa", heavy ? 10 : 5);
    if (f.hp <= 0) { f.dead = true; api.burst(Z.px(f.x, f.y), Z.py(f.x, f.y), f.def.human ? "#fde047" : "#c4b5fd", 22, 260); api.sound.sfx(f.def.boss ? "ko" : "zap"); Z.xp(f.def.xp); if (f.k === "shade") { P.stats.shades++; if (rnd() < .15) Z.money(50 + Math.floor(rnd() * 150)); } if (f.def.boss) { api.slowmo(.25, 1.4); api.confetti(140); api.banner(f.def.human ? "RESPECT!" : "DEFEATED", { col: "#fde047", dur: 2.4, size: 90 }); Z.foes.forEach(function (o) { if (o.k === "shade") o.hp = 0, o.dead = true; }); Z.tele.length = 0; Z.shots = Z.shots.filter(function (s) { return s.mine; }); }
      Z.emit({ t: "fight", enemy: f.k }); }
  }
  // Can a blow from a reach b? No hits through walls: the line between them must not cross a building.
  Z.clearReach = function (a, b) { var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), n = Math.max(2, Math.ceil(d / .3)); for (var i = 1; i < n; i++) if (S.insideBuilding(W, a.x + dx * i / n, a.y + dy * i / n)) return false; return true; };
  // Walk o toward (tx, ty): straight when it can see the target, by the paths when it cannot, re-planned as the target moves;
  // pressed against a wall, it goes out the way it can see first. Shared by guards' logic and every enemy. Returns metres moved.
  Z.pursue = function (o, tx, ty, sp, dt, rad, others) {
    var gd = Math.hypot(tx - o.x, ty - o.y), wx = tx, wy = ty, clear = gd < 45 && S.los(W, o.x, o.y, tx, ty); if (clear && !(o.rp && o.rp.out)) o.rp = null;
    if (!clear) { o.rpT = (o.rpT || 0) - dt; if (!o.rp || o.rpT <= 0 || Math.hypot(o.rp.tx - tx, o.rp.ty - ty) > 10) { var rp = S.route(W, o.x, o.y, tx, ty, false); o.rp = { p: rp && rp.length >= 4 ? rp : [o.x, o.y, tx, ty], i: 2, tx: tx, ty: ty }; o.rpT = 1.5; } }
    if (o.rp) { var pp = o.rp.p; while (o.rp.i < pp.length - 2 && Math.hypot(pp[o.rp.i] - o.x, pp[o.rp.i + 1] - o.y) < 2.2) o.rp.i += 2; if (o.rp.i < pp.length - 2) { wx = pp[o.rp.i]; wy = pp[o.rp.i + 1]; } else if (o.rp.out) o.rp = null; }
    var mv = S.walkTo(W, o, wx, wy, sp, dt, others || null, rad || .45);
    if (mv < sp * dt * .2 && gd > 3) { o.stk = (o.stk || 0) + dt; if (o.stk > .5) { o.stk = 0; var ex = Z.wayOut(o.x, o.y, tx, ty); if (ex) { var rq = S.route(W, ex.x, ex.y, tx, ty, false); o.rp = { p: [o.x, o.y, ex.x, ex.y].concat(rq && rq.length >= 4 ? rq.slice(2) : [tx, ty]), i: 2, tx: tx, ty: ty, out: 1 }; o.rpT = 4; } else if (o.rp) o.rp.i += 2; } } else o.stk = 0;
    return mv;
  };
  function foes(dt) {
    var st = Z.step();
    if (st && st.t === "fight") { var pl = Z.place(st.at), alive = Z.foes.filter(function (f) { return f.quest && f.k === st.enemy; }).length, left = (st.n || 1) - P.m.n; if (Math.hypot(pl.mx - me.x, pl.my - me.y) < 45 && alive < Math.min(left, st.enemy === "shade" ? 4 : 3)) { var a = rnd() * TAU, r = 9 + rnd() * 6; Z.spawnFoe(st.enemy, pl.mx + Math.cos(a) * r, pl.my + Math.sin(a) * r, true); } }
    if (Z.blackout) { spawnT -= dt; var cap = Math.min(12, 3 + Math.floor(P.lvl / 4)); if (spawnT <= 0 && Z.foes.filter(function (f) { return f.k === "shade" && !f.quest; }).length < cap && !me.alt) { spawnT = Math.max(2.5, 7 - P.lvl * .1); var a2 = rnd() * TAU, r2 = 20 + rnd() * 10; if (!S.insideBuilding(W, me.x + Math.cos(a2) * r2, me.y + Math.sin(a2) * r2)) Z.spawnFoe("shade", me.x + Math.cos(a2) * r2, me.y + Math.sin(a2) * r2); } }
    for (var i = Z.foes.length - 1; i >= 0; i--) {
      var f = Z.foes[i]; if (f.dead || (!Z.blackout && f.k === "shade" && !f.quest) || dist(f, me) > 140) { Z.foes.splice(i, 1); continue; }
      f.flash = Math.max(0, f.flash - dt); f.cd -= dt; f.t += dt; var dx = me.x - f.x, dy = me.y - f.y, d = Math.hypot(dx, dy) || 1, sp = f.def.speed * (f.hp < f.max * .5 && f.def.boss ? 1.25 : 1);
      if (f.frozen > 0) { f.frozen -= dt; continue; }
      if (me.veh && Math.abs(me.veh.speed) > 6 && d < f.def.r + 1.6 && !me.alt && !(f.ramCd > api.t)) { var rsp = Math.hypot(me.veh.vx, me.veh.vy); f.ramCd = api.t + .35; hitFoe(f, Math.round(Math.min(40, 8 + rsp * 1.4) * (Z.veh && Z.veh.mass ? Math.min(1.3, Math.sqrt(Z.veh.mass(me.veh) / 1300)) : 1)), Math.atan2(-dy, -dx), true); me.veh.vx *= .7; me.veh.vy *= .7; continue; } /* one hit per contact, scaled by speed and weight */
      if (f.st === "chase") {
        if (!f.rp) f.a = Math.atan2(dy, dx); var leash = f.k === "leviathan" ? Z.places.dam : null, step = sp * dt;
        if (leash && Math.hypot(f.x - leash.mx, f.y - leash.my) > 16 && d > 3) step = 0;
        if (d > f.def.r + .9 && step > 0) { f.walk += Z.pursue(f, me.x, me.y, sp, dt, f.def.r, Z.foes) * 3; if (!f.rp) f.a = Math.atan2(me.y - f.y, me.x - f.x); } /* round buildings, not into them */
        if (d < f.def.r + 1.2 && f.cd <= 0) { f.st = "wind"; f.t = 0; }
        if (f.k === "sly" && f.cd <= -2.5 && d > 4 && d < 14) { f.st = "aim"; f.t = 0; f.ca = f.a; }
        if (f.k === "leviathan" && f.cd <= 0) { f.cd = 2.6; for (var q = 0; q < 3; q++) Z.tele.push({ x: me.x + (q ? (rnd() - .5) * 9 : 0), y: me.y + (q ? (rnd() - .5) * 9 : 0), r: 2.6, t: 0, at: .95, dmg: f.def.dmg }); if (rnd() < .3) Z.spawnFoe("shade", f.x + (rnd() - .5) * 8, f.y + (rnd() - .5) * 8, false); }
        if (f.k === "entropy" && f.cd <= 0) { f.cd = f.hp < f.max * .5 ? 2.4 : 3.4; var n8 = f.hp < f.max * .5 ? 12 : 8, off = rnd() * TAU; for (var o = 0; o < n8; o++) Z.shots.push({ x: f.x, y: f.y, vx: Math.cos(off + o * TAU / n8) * 7.5, vy: Math.sin(off + o * TAU / n8) * 7.5, life: 3, dmg: f.def.dmg * .7, r: .45 }); api.sound.sfx("laser");
          if (rnd() < .45) { var ta = rnd() * TAU; var tp = S.push(W, me.x + Math.cos(ta) * 7, me.y + Math.sin(ta) * 7, 1); api.burst(Z.px(f.x, f.y), Z.py(f.x, f.y), "#c084fc", 14); f.x = tp.x; f.y = tp.y; } if (rnd() < .35) Z.spawnFoe("shade", f.x + (rnd() - .5) * 10, f.y + (rnd() - .5) * 10, false); }
      } else if (f.st === "wind") { if (f.t > .42) { if (d < f.def.r + 1.7 && Z.clearReach(f, me)) Z.hurt(f.def.dmg, f); f.st = "chase"; f.cd = 1.1 + rnd() * .8; }
      } else if (f.st === "aim") { if (f.t > .7) { f.st = "charge"; f.t = 0; api.sound.sfx("dash"); }
      } else if (f.st === "charge") { var c = S.push(W, f.x + Math.cos(f.ca) * 17 * dt, f.y + Math.sin(f.ca) * 17 * dt, f.def.r); f.x = c.x; f.y = c.y; f.a = f.ca; if (dist(f, me) < 1.5 && Z.clearReach(f, me)) Z.hurt(f.def.dmg * 1.5, f); if (f.t > .6 || c.hit) { f.st = "tired"; f.t = 0; if (c.hit) api.kick(8); }
      } else if (f.st === "tired") { if (f.t > 1.3) { f.st = "chase"; f.cd = 1; } }
    }
    for (i = Z.tele.length - 1; i >= 0; i--) { var t = Z.tele[i]; t.t += dt; if (t.t >= t.at && !t.done) { t.done = true; api.sound.sfx("zap"); api.kick(5); if (Math.hypot(t.x - me.x, t.y - me.y) < t.r && me.z < .3) Z.hurt(t.dmg, t); } if (t.t > t.at + .25) Z.tele.splice(i, 1); }
    for (i = Z.shots.length - 1; i >= 0; i--) {
      var s = Z.shots[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.mine) { s.spin = (s.spin || 0) + dt * 20; if (s.life < .35) { var bx = me.x - s.x, by = me.y - s.y, bl = Math.hypot(bx, by) || 1; s.vx = bx / bl * 16; s.vy = by / bl * 16; if (bl < 1) { Z.shots.splice(i, 1); continue; } s.life = Math.max(s.life, .05); }
        for (var k = 0; k < Z.foes.length; k++) { var e = Z.foes[k]; if (!e.dead && !(s.hitIds || (s.hitIds = {}))[k] && Math.hypot(e.x - s.x, e.y - s.y) < e.def.r + .5) { s.hitIds[k] = 1; hitFoe(e, 14 + P.lvl, Math.atan2(s.vy, s.vx), false); } }
      } else { if (Math.hypot(s.x - me.x, s.y - me.y) < s.r + .45 && me.z < .3) { Z.hurt(s.dmg, s); s.life = 0; } if (s.life <= 0 || S.insideBuilding(W, s.x, s.y)) { Z.shots.splice(i, 1); continue; } }
    }
  }
  function attack() {
    if (me.cool > 0 || me.veh || me.fall) return; me.combo = me.cool > -.5 ? (me.combo + 1) % 3 : 0; var heavy = me.combo === 2; me.cool = heavy ? .42 : .26; me.punch = .18; me.emote = ""; me.sit = false; api.sound.sfx("kick");
    var base = (10 + P.lvl * 1.3 + P.skills.fit * .15) * (heavy ? 1.8 : 1), any = false;
    Z.foes.forEach(function (f) { var a = Math.atan2(f.y - me.y, f.x - me.x), da = Math.abs(((a - me.a + Math.PI * 3) % TAU) - Math.PI); if (!f.dead && dist(f, me) < f.def.r + 1.7 && da < 1.3 && Z.clearReach(me, f)) { hitFoe(f, base, a, heavy); any = true; } });
    if (Z.net.on) Object.keys(Z.net.peers).forEach(function (id) { var r = Z.net.peers[id]; if (r.emote === "spar" && me.emote2 === "spar" && Math.hypot(r.x - me.x, r.y - me.y) < 2) Z.net.out.push({ k: "hit", to: +id, d: heavy ? 18 : 10 }); });
    if (!any && Z.brawl) Z.brawl.strike(heavy, heavy ? "kick" : "punch"); else if (!any) Z.peds.forEach(function (p) { if (!p.fall && dist(p, me) < 1.6) { var pa = Math.atan2(p.y - me.y, p.x - me.x); p.fall = 2; p.kv = 1; p.kx = Math.cos(pa) * (heavy ? 6 : 3.4); p.ky = Math.sin(pa) * (heavy ? 6 : 3.4); p.kz = heavy ? 4.2 : 2.6; p.air = .05; Z.offend("shove"); Z.say(p, pick(D.BARKS.ped)); Z.fx.hit(p, pa, heavy, "ped"); } });
  }

  /* ---------- per-frame update ---------- */
  Z.update = function (dt) {
    if (Z.guide && !(Z.intro && Z.intro.on)) Z.guide.tick(dt); /* the tutorial waits until the opening film is over */
    music(); engineSound(); ambience(dt); if (Z.momentTick) Z.momentTick(dt); if (Z.story && Z.story.tick) Z.story.tick(dt); if (Z.intro && Z.intro.on) { Z.intro.tick(dt); return; } if (window.FSLGCoop) FSLGCoop.tick(dt);
    if (Z.mode !== "play") { cam.x += dt * 6; if (cam.x > 500) cam.x = -500; return; }
    if (api.overlayOpen()) return;
    var mins = S.advance(P, dt * S.MIN_PER_SEC), i; if (mins) newDay();
    var dk = S.darkness(P.time), tonight = !P.flags.restored ? (P.m.done.m3 || P.m.active === "m4") && (S.hash(P.day, 77) < .5 || /^(m4|m6|m14|m17)$/.test(P.m.active)) : S.hash(P.day, 77) < .3;
    Z.blackout = !!P.flags.nepa || (dk > .6 && tonight && P.flags.light !== P.day && P.flags.light !== P.day - 1);
    me.cool -= dt; me.punch = Math.max(0, me.punch - dt); me.inv = Math.max(0, me.inv - dt); me.boost = Math.max(0, me.boost - dt); me.shield = Math.max(0, me.shield - dt); waveT -= dt;
    if (me.emoteT > 0) { me.emoteT -= dt; if (me.emoteT <= 0) me.emote = ""; }
    if (me.fall > 0 && me.fall < 50) { me.fall -= dt; if (me.fall <= 0) me.fall = 0; }
    if (Z.touch && Z.touch.step) Z.touch.step(dt);
    var ix = (api.down("right") ? 1 : 0) - (api.down("left") ? 1 : 0) + Z.stick.x, iy = (api.down("down") ? 1 : 0) - (api.down("up") ? 1 : 0) + Z.stick.y, mag = Math.hypot(ix, iy); if (mag > 1) { ix /= mag; iy /= mag; mag = 1; }
    if (Z.r3 && Z.r3.ready) { if (api.down("camL")) Z.r3.turn(-dt * 2.2); if (api.down("camR")) Z.r3.turn(dt * 2.2); if (!me.veh || Z.stick.on) { var yw = Z.r3.yaw, f0 = -iy, r0 = ix; ix = Math.cos(yw) * f0 - Math.sin(yw) * r0; iy = Math.sin(yw) * f0 + Math.cos(yw) * r0; } }
    if (api.hit("phone")) { Z.ui.phone(); return; }
    if (api.hit("map")) { big = big ? null : {}; }
    if (big) { cameraStep(dt); return; }
    if (me.veh) drive(dt, ix, iy, mag); else walk(dt, ix, iy, mag);
    if (api.hit("act") && !(Z.momentAct && Z.momentAct()) && !(Z.friends && Z.friends.act())) interact();
    var moving = me.veh ? Math.abs(me.veh.speed) > 1 : mag > .1, ev = S.tickNeeds(P, dt, { run: !me.veh && mag > .1 && (api.down("run") || Z.runLock) && S.canSprint(P), sit: me.sit, veh: me.veh ? me.veh.type : "", dance: me.emote === "dance", moving: moving });
    for (i = 0; i < ev.length; i++) { if (ev[i] === "faint") Z.faint(); else if (ev[i] === "exhausted") { Z.bark("tired"); Z.toast("<b>Out of breath.</b> You can still walk. Stand or sit a moment, or eat something, and you can sprint again."); } else Z.bark(ev[i]); }
    if (Z.prof) { var pf = Z.prof, pn = pf.now, p0 = pn(), p1; people(dt); p1 = pn(); pf.people += p1 - p0; trafficStep(dt); p0 = pn(); pf.traffic += p0 - p1; foes(dt); things(dt); p1 = pn(); pf.foes += p1 - p0; jobStep(dt); raceStep(dt); security(dt); p0 = pn(); pf.security += p0 - p1; netStep(dt); dateStep(dt); }
    else { people(dt); trafficStep(dt); foes(dt); things(dt); jobStep(dt); if (Z.jobs) Z.jobs.tick(dt); raceStep(dt); security(dt); netStep(dt); dateStep(dt); }
    var pl = Z.near(13); if (pl !== Z.lastPlace) { Z.lastPlace = pl; /* cache first: an emit may start the next step */ if (pl) { Z.emit({ t: "go", place: pl.id, night: S.isNight(P) }); if (pl.id === P.home) Z.emit({ t: "go", place: "@home", night: S.isNight(P) }); } }
    var st = Z.step(); if (st && st.t === "go" && st.night && pl && (pl.id === st.place || (st.place === "@home" && pl.id === P.home)) && S.isNight(P)) Z.emit({ t: "go", place: st.place, night: true });
    routeT -= dt; if (routeT <= 0) { routeT = 1.2; var tg = Z.objective().target; Z.route = tg && Math.hypot(tg.x - me.x, tg.y - me.y) > 12 ? S.route(W, me.x, me.y, tg.x, tg.y, !!me.veh && me.veh.type !== "bike" && me.veh.type !== "skate") : null; }
    goalT -= dt; if (goalT <= 0) { goalT = 2.5; goals(); }
    saveT += dt; if (saveT > 15) { saveT = 0; Z.save(); }
    eggT -= dt; if (eggT <= 0) { eggT = 1; eggs(); }
    for (i = Z.floats.length - 1; i >= 0; i--) { Z.floats[i].t += dt; if (Z.floats[i].t > 1.2) Z.floats.splice(i, 1); }
    for (i = Z.bubbles.length - 1; i >= 0; i--) { Z.bubbles[i].t += dt; if (Z.bubbles[i].t > Z.bubbles[i].dur) Z.bubbles.splice(i, 1); }
    if (subtitle) { subtitle.t += dt; if (subtitle.t > subtitle.dur) subtitle = null; }
    Z.fx.update(dt); cameraStep(dt);
  };
  function cameraStep(dt) {
    var v = me.veh, sp = v ? Math.abs(v.speed) : 0, ts = me.alt > .1 ? 3.2 : v ? Math.max(6.2, 12.5 - sp * .26) : 14, k = 1 - Math.exp(-3 * dt);
    cam.s += (ts - cam.s) * (1 - Math.exp(-1.6 * dt)); var lx = v ? v.vx * .45 : 0, ly = v ? v.vy * .45 : 0; cam.x += (me.x + lx - cam.x) * k * 2; cam.y += (me.y + ly - cam.y) * k * 2;
  }
  function walk(dt, ix, iy, mag) {
    if (me.fall) { me.cs = me.speed = 0; return; }
    var run = (api.down("run") || Z.runLock) && S.canSprint(P), sp = (run ? S.FOOT.run : S.FOOT.walk) * S.speedFactor(P) * (me.boost > 0 ? 1.45 : 1), swim = S.inWater(W, me.x, me.y); if (swim) { sp *= .42; P.energy = Math.max(0, P.energy - dt * .12); }
    ["left", "right", "up", "down"].forEach(function (d) { if (api.double(d) && me.dash <= 0 && P.energy > 4) { me.dash = .2; me.inv = Math.max(me.inv, .3); me.da = { left: Math.PI, right: 0, up: -1.57, down: 1.57 }[d] + (Z.r3 && Z.r3.ready ? Z.r3.yaw + 1.57 : 0); P.energy -= 1; api.sound.sfx("dash"); } });
    if (me.dash > 0) { me.dash -= dt; ix = Math.cos(me.da); iy = Math.sin(me.da); mag = 1; sp = 17; }
    /* feet take a moment to get up to speed and to stop; the body keeps drifting the way it was going */
    var cs0 = me.cs || 0, tv = mag > .1 ? sp : 0, cs = me.dash > 0 ? sp : cs0 < tv ? Math.min(tv, cs0 + Math.max(sp, 5) / .25 * dt) : Math.max(tv, Math.min(cs0, sp * 1.15) - Math.max(sp, 6) / .2 * dt);
    if (mag > .1) { if (me.sit || me.emote === "dance") { me.sit = false; me.emote = ""; } var ta = Math.atan2(iy, ix), da = ((ta - me.a + Math.PI * 3) % TAU) - Math.PI; me.a += da * Math.min(1, dt * 14); me.mx = ix; me.my = iy;
      if (cs0 < .8 || (run && !me.ran && cs0 < sp * .65)) me.startT = .3; me.ran = run; me.coast = false; }
    else { if (!me.coast && cs0 > 2.6) { me.stopT = .3; me.stopV = cs0; } me.coast = true; me.ran = false; }
    if (cs > .01 && !me.sit) { var mx = me.mx == null ? Math.cos(me.a) : me.mx, my = me.my == null ? Math.sin(me.a) : me.my, n = S.push(W, me.x + mx * cs * dt, me.y + my * cs * dt, .45); P.stats.km += Math.hypot(n.x - me.x, n.y - me.y) / 1000; me.x = n.x; me.y = n.y; me.walk += cs * dt * 2.6; if (run && mag > .1 && Math.floor(me.walk / 3.14) !== Math.floor((me.walk - cs * dt * 2.6) / 3.14)) { P.skills.fit += .004; } }
    else cs = 0;
    me.cs = cs; me.speed = cs * (mag > .1 ? mag : 1); me.gait = Z.anim ? Z.anim.gait(cs) : cs / 3.5;
    if (me.startT > 0) me.startT -= dt; if (me.stopT > 0) me.stopT -= dt; if (me.throwT > 0) me.throwT -= dt;
    if (api.hit("jump") && me.z === 0) { me.vz = 5.4 * (P.flags.sjump ? 1.9 : 1); api.sound.sfx("jump"); me.sit = false; }
    if (me.z > 0 || me.vz > 0) { me.z += me.vz * dt; me.vz -= 17 * dt; if (me.z <= 0) { me.z = 0; me.vz = 0; } }
    if (api.hit("attack") || Z.mouseHit) attack(); Z.mouseHit = false;
    if (api.hit("throw") && P.inv.slipper && !Z.shots.some(function (s) { return s.mine; })) { Z.shots.push({ mine: true, x: me.x, y: me.y, vx: Math.cos(me.a) * 15, vy: Math.sin(me.a) * 15, life: 1.05, r: .4 }); me.throwT = .3; api.sound.sfx("dash"); }
    if (api.hit("torch")) { if (P.inv.torch) { me.torch = !me.torch; api.sound.sfx("click"); } else Z.toast("You have no torch yet. The Bookshop sells one."); }
    if (api.hit("run") && Z.stick.on) Z.runLock = !Z.runLock;
    if (api.hit("emote1")) Z.emote("wave"); if (api.hit("emote2")) Z.emote("dance"); if (api.hit("emote3")) Z.emote(me.sit ? "" : "sit"); if (api.hit("emote4")) { me.emote2 = me.emote2 === "spar" ? "" : "spar"; Z.toast(me.emote2 ? "Sparring stance: friends in your room who also press 4 can trade punches." : "Sparring off."); }
    if (me.torch) Z.foes.forEach(function (f) { if (f.k !== "shade") return; var a = Math.atan2(f.y - me.y, f.x - me.x), da = Math.abs(((a - me.a + Math.PI * 3) % TAU) - Math.PI); if (dist(f, me) < 9.5 && da < .5) f.frozen = .35; });
  }
  function drive(dt, ix, iy, mag) {
    var v = me.veh, spec = S.VEH[v.type], inp = { throttle: (api.down("up") ? 1 : 0) - (api.down("down") ? 1 : 0), steer: (api.down("right") ? 1 : 0) - (api.down("left") ? 1 : 0), brake: false }, hops = v.type === "bike" || v.type === "skate";
    // Handbrake is its own input. Space doubles as one only on machines that cannot hop, so the two never share a key.
    inp.brake = api.down("drift") || (!hops && api.down("jump"));
    // stick: steer toward where it points, with a dead zone so small camera movement cannot make the bars twitch
    if (Z.stick.on) { if (mag > .15) { var ta = Math.atan2(iy, ix), da = ((ta - v.a + Math.PI * 3) % TAU) - Math.PI; da = Math.abs(da) < .07 ? 0 : da - Math.sign(da) * .07; inp.steer = S.clamp(da * 1.5, -1, 1) * (v.speed < -.5 ? -1 : 1); inp.throttle = Math.abs(da) < 2.3 ? mag : -.7; } else { inp.throttle = 0; inp.steer = 0; } }
    var road = S.onRoad(W, v.x, v.y), flying = me.alt > .05, surf = flying ? 1 : road ? 1 : v.type === "skate" ? .38 : v.type === "plane" ? .75 : .62, ox = v.x, oy = v.y;
    // Run on a bicycle is standing on the pedals (faster, costs energy); on a scooter or okada it is a full-throttle tuck.
    var runK = api.down("run") || Z.runLock; v.sprint = v.type === "bike" && runK && inp.throttle > 0 && P.energy > 6; v.tuck = (v.type === "scooter" || v.type === "okada") && runK && inp.throttle > 0;
    if (v.sprint) P.energy = Math.max(0, P.energy - dt * .5);
    // Space on a bicycle or skateboard is a hop
    if (hops && Math.abs(v.speed) > 1.5 && api.hit("jump") && !(v.hz > 0)) { v.hvz = v.type === "skate" ? 3.2 : 3.7; v.hz = .001; api.sound.sfx("jump"); }
    if (v.hz > 0) { inp.brake = false; v.hvz -= 11 * dt; v.hz += v.hvz * dt; if (v.hz <= 0) { v.hz = 0; v.hvz = 0; api.sound.sfx("stomp"); api.buzz(25); } }
    // a long clean slide earns a little pop
    if (v.slide > 2.2 && Math.abs(v.speed) > 6 && me.alt < .05) { v.dr = (v.dr || 0) + Math.hypot(v.vx, v.vy) * dt; if (rnd() < dt * 8) api.buzz(8); } else if (v.dr) { if (v.dr > 14) { var pts = Math.round(v.dr); Z.float(v.x, v.y - 2.2, "Drift " + pts + " m", "#fde047"); api.sound.sfx("power"); P.stats.drift = Math.max(P.stats.drift || 0, pts); } v.dr = 0; }
    v.boost = (me.boost > 0 ? 1.3 : 1) * (P.zoom ? 1.6 : 1) * (1 + Math.min(.12, P.skills.drive * .002)) * (v.sprint ? 13 / 9 : v.tuck ? 1.08 : 1); v.push = v.sprint ? 1.7 : v.tuck ? 1.15 : 1; v.thr = inp.throttle;
    S.stepVehicle(v, spec, inp, dt, surf);
    if (v.type === "plane") {
      // Height is flown, not switched: lift grows with speed past take-off, the climb eases in and levels off at the
      // ceiling, the descent flares close to the ground, and a hard touchdown gives one small bounce.
      var to = spec.takeoff, wantV = v.speed > to ? S.clamp((v.speed - to) / (to * .3), .3, 1) * .46 * S.clamp((1 - me.alt) / .16, .06, 1) : v.speed < to * .85 ? -S.clamp((to * .85 - v.speed) / (to * .3), .25, 1) * .36 : me.alt > 0 ? -.03 : 0;
      if (wantV < 0 && me.alt < .16) wantV = Math.max(wantV, -.045 - me.alt * .9); if (me.alt <= 0 && wantV < 0) wantV = 0;
      me.av = (me.av || 0) + (wantV - (me.av || 0)) * (1 - Math.exp(-dt * 2.4)); var pAlt = me.alt; me.alt = S.clamp(me.alt + me.av * dt, 0, 1);
      if (me.alt >= 1 && me.av > 0) me.av = 0;
      if (me.alt <= 0 && pAlt > 0) { if (me.av < -.1 && !me.bounced) { me.alt = .003; me.av = -me.av * .3; me.bounced = 1; api.sound.sfx("stomp"); api.kick(4); } else { me.av = 0; me.bounced = 0; } }
      if (me.alt > .05) { var hb2 = S.insideBuilding(W, v.x, v.y); if (hb2 && me.alt * 38 < (hb2.h3 || 8) + 1.2) { v.x = ox; v.y = oy; v.vx *= -.35; v.vy *= -.35; api.kick(10); api.sound.sfx("heavy"); api.buzz(60); Z.hurt(6); Z.toast("Too low. Climb before you cross the buildings."); } }
      if (flying && me.alt <= .05) { if (S.insideBuilding(W, v.x, v.y) || S.inWater(W, v.x, v.y)) { api.sound.sfx("boom"); api.kick(18); api.flash("#fff", .4); api.burst(480, 270, "#f97316", 40, 400); var st = Z.places.strip; me.alt = 0; Z.exit(true); v.x = v.hx; v.y = v.hy; v.a = v.ha; var nr = S.nearRoad(W, me.x, me.y, 300); if (nr) { me.x = nr.x; me.y = nr.y; } Z.hurt(40); Z.toast("Rough landing. The aircraft was towed back to " + st.name + "."); return; } else api.sound.sfx("stomp"); }
      if (me.alt > .5 && Math.hypot(v.x - 0, v.y - 30) < 45) Z.egg("hat", "From up here you can see it: a tall hat on the Senate roof.");
    }
    if (me.alt < .05) {
      var r = Math.max(.6, Math.min(1.5, spec.len * .34)), n = Z.veh && Z.veh.wall ? (Z.veh.wall(v, dt), { hit: false }) : S.push(W, v.x, v.y, r); // samaru-veh.js: walls by shape, sound by material
      if (n.hit) { var imp = -(v.vx * n.nx + v.vy * n.ny); if (imp > 0) { v.vx += n.nx * imp * 1.35; v.vy += n.ny * imp * 1.35; if (imp > 5) { api.kick(Math.min(16, imp)); api.sound.sfx("heavy"); api.buzz(60); Z.fx.crash(n.x, n.y, n.nx, n.ny, imp); if (imp > 9) Z.hurt((imp - 9) * 1.2); } } v.x = n.x; v.y = n.y; }
      if (S.inWater(W, v.x, v.y) && !(Z.water && Z.water.wade && Z.water.wade(v))) { v.x = ox; v.y = oy; v.vx *= -.3; v.vy *= -.3; api.sound.sfx("bounce"); } // samaru-water.js lets it roll in, stall and be towed
      if (!road && Math.abs(v.speed) > 8 && rnd() < dt * 20) api.burst(Z.px(v.x, v.y), Z.py(v.x, v.y), "#d6b98c", 1, 60);
      if (v.slide > 4 && rnd() < dt * 30) { api.burst(Z.px(v.x, v.y), Z.py(v.x, v.y), "#e5e7eb", 1, 40); if (rnd() < .2) api.sound.sfx("dash"); }
    }
    P.stats.km += Math.hypot(v.x - ox, v.y - oy) / 1000; P.skills.drive += Math.hypot(v.x - ox, v.y - oy) / 1000;
    me.x = v.x; me.y = v.y; me.a = v.a; me.speed = v.speed;
    if (api.hit("horn")) { if (!(Z.audio && Z.audio.horn && Z.audio.horn(v))) api.sound.tone(v.type === "keke" ? 520 : 400, .25, "square", .12); if (Z.veh && Z.veh.horn) Z.veh.horn(v); else Z.peds.forEach(function (p) { if (dist(p, me) < 14) p.flee = 1.2; }); /* samaru-veh.js: people look round and step aside, traffic gives way */ }
    if (api.hit("radio")) Z.radioNext();
  }
  // who E talks to: the person the current step needs if they are within reach, else the nearest; never a hidden or retired one
  function talkable(onlyNeeded) { // onlyNeeded: just the step's person (they win over a parked vehicle too)
    var st = Z.step && Z.step(), want = st && st.npc ? (Z.story && Z.story.tok ? Z.story.tok(P, st.npc) : st.npc) : "", best = null, bd = 3;
    for (var i = 0; i < Z.npcs.length; i++) { var n = Z.npcs[i], d = dist(n, me); if (d >= 3 || n.hidden || n.def.retired) continue; if (n.id === want) return n; if (d < bd) { bd = d; best = n; } }
    return onlyNeeded ? null : best;
  }
  function interact() {
    if (Z.interior && Z.interior.act()) return;
    if (me.veh) { if (Math.abs(me.veh.speed) > 3 && me.alt < .05) { Z.toast("Slow down first."); return; } Z.exit(); return; }
    if (me.fall) return;
    var need = talkable(true); if (need) { Z.ui.talk(need); return; }
    var i, best = null, bd = 2.6; for (i = 0; i < Z.cars.length; i++) { var c = Z.cars[i], d = dist(c, me) - S.VEH[c.type].len * .3; if (d < bd) { bd = d; best = c; } } if (best) { Z.enter(best); return; }
    if (Z.date && Z.date.spot) { var ds = Z.place(Z.date.spot); if (Math.hypot(ds.mx - me.x, ds.my - me.y) < 14) { Z.ui.dateScene(); return; } }
    var tn = talkable(); if (tn) { Z.ui.talk(tn); return; }
    if (Z.wardrobe && Z.wardrobe.greet) for (i = 0; i < Z.peds.length; i++) if (!Z.peds[i].fall && dist(Z.peds[i], me) < 2.2) { Z.wardrobe.greet(Z.peds[i]); return; } // a passer-by: they tell you their name
    if (Z.cameo && dist(Z.cameo, me) < 3) { Z.say(Z.cameo, "If I have seen further, it is by standing on the shoulders of giants."); Z.egg("newton", "Sir Isaac is visiting the Physics department. Mind the apple."); return; }
    var pl = Z.near(7); if (pl) { if (Z.interior && Z.interior.enter(pl)) return; Z.ui.place(pl); return; }
  }
  Z.prompt = function () {
    if (me.veh) return Math.abs(me.veh.speed) < 3 && me.alt < .05 ? "Get off" : ""; var i, need = talkable(true); if (need) return "Talk to " + need.def.name;
    for (i = 0; i < Z.cars.length; i++) { var c = Z.cars[i]; if (dist(c, me) - S.VEH[c.type].len * .3 < 2.6) { var sp = S.VEH[c.type]; return P.lvl < sp.lvl ? sp.name + " (level " + sp.lvl + ")" : "Ride " + sp.name + (sp.rent && !c.free && !c.paid && !P.flags["own_" + c.type] ? " (₦" + sp.rent + ")" : ""); } }
    if (Z.date && Z.date.spot) { var ds = Z.place(Z.date.spot); if (Math.hypot(ds.mx - me.x, ds.my - me.y) < 14) return "Start the date"; }
    var tn = talkable(); if (tn) return "Talk to " + tn.def.name;
    if (Z.cameo && dist(Z.cameo, me) < 3) return "Talk";
    var pl = Z.near(7); return pl ? pl.name : "";
  };

  // New walkers and cars appear far down the view or behind the camera, never popping up in front of you.
  function unseen(q, far2d, ahead, behind) { var dx = q.x - me.x, dy = q.y - me.y, d = Math.hypot(dx, dy); if (!(Z.r3 && Z.r3.ready)) return d > far2d; var yw = Z.r3.yaw || 0; return (dx * Math.cos(yw) + dy * Math.sin(yw)) / (d || 1) > .15 ? d > ahead : d > behind; }
  function people(dt) {
    var i, n, target = Math.round((Z.blackout ? 5 : S.darkness(P.time) > .6 ? (P.time >= 1110 && P.time < 1350 ? 18 : 8) : 24) * (Z.opt ? Z.opt("crowd", 1) : 1)), far = 480 / cam.s + 8;
    if (Z.peds.length < target && !me.alt) { var q = S.randomRoadPoint(W, rnd, false, me, 150); if (q && (Z.brawl ? Z.brawl.okSpawn(q, 135, far) : unseen(q, far, 95, 40))) { var w = S.wanderStart(W, rnd, q, false), sd = Math.floor(rnd() * 1e6), sd0 = (rnd() < .5 ? 1 : -1) * (q.r.w / 2 + .6 + rnd() * 1.4), psp = 1.2 + rnd() * .9; S.wanderStep(W, w, 0, rnd, sd0); var pq = S.push(W, w.x, w.y, .4); if ((!Z.brawl || (Z.brawl.okSpawn(pq, 135, far) && !Z.brawl.onRoad(pq.x, pq.y))) && !S.insideBuilding(W, pq.x, pq.y)) Z.peds.push({ w: w, x: pq.x, y: pq.y, a: w.a, spd: psp, look: look(sd), sp: psp, side: sd0, walk: rnd() * 6, fall: 0, wave: 0, flee: 0, k: sd % 7 }); } }
    var crowd = me.veh || me.fall ? Z.peds : Z.peds.concat(Z.npcs, [me]);
    for (i = Z.peds.length - 1; i >= 0; i--) {
      n = Z.peds[i]; if (n.pax) continue; /* a fare waiting for you: the job moves them */
      var d = dist(n, me); if (d > 170 || n.gone) { Z.peds.splice(i, 1); continue; }
      n.wave = Math.max(0, n.wave - dt);
      if (n.cr && Z.city) { if (Z.brawl) Z.brawl.downed(n, dt); continue; } /* part of an incident: the city module moves them */
      if (Z.brawl) { if (Z.brawl.ped(n, dt, d)) continue; if (Z.city && Z.city.ped(n, dt, d)) continue; if (Z.crowd && Z.crowd.ped(n, dt, d)) continue; } else {
      if (n.fall > 0) { n.fall = Math.max(0, n.fall - dt); if (n.kv) { var kp = S.push(W, n.x + n.kx * dt, n.y + n.ky * dt, .4); n.x = kp.x; n.y = kp.y; n.kx *= 1 - dt * 2.5; n.ky *= 1 - dt * 2.5; n.kz -= 18 * dt; n.air = Math.max(0, (n.air || 0) + n.kz * dt); if (n.air <= 0) n.kv = 0; } continue; }
      if (n.scT > 0) n.scT -= dt; else if (me.veh && me.alt < .05 && d < 4.5 && Math.abs(me.veh.speed) > 13) { n.scT = 8; n.flee = Math.max(n.flee, .9); Z.offend("reckless"); } // tearing past someone at speed
      if (me.veh && me.alt < .05 && d < S.VEH[me.veh.type].len * .4 + .8) { if (Math.abs(me.veh.speed) > 4.5) { n.fall = 2.6; n.kv = 1; n.kx = me.veh.vx * .7; n.ky = me.veh.vy * .7; n.kz = 4 + Math.abs(me.veh.speed) * .22; n.air = .05; Z.offend("hitPed"); Z.fx.hit(n, Math.atan2(me.veh.vy, me.veh.vx), true, "car"); Z.say(n, pick(D.BARKS.ped)); } else n.flee = .8; }
      if (n.flee > 0) { n.flee -= dt; var fa = Math.atan2(n.y - me.y, n.x - me.x), f = S.push(W, n.x + Math.cos(fa) * 5 * dt, n.y + Math.sin(fa) * 5 * dt, .4); n.x = f.x; n.y = f.y; n.a = fa; n.walk += dt * 12; continue; }
      }
      if (n.wave > 0) continue;
      // each walker follows a point that moves along the pavement a little ahead of them, and steps round other people
      if (n.dT > 0) { n.dT -= dt; n.walk += S.walkTo(W, n, n.dx, n.dy, n.sp, dt, crowd, .38) * 2.6; continue; } // boxed in: step out to the nearest path first
      var lead = Math.hypot(n.w.x - n.x, n.w.y - n.y); if (lead < 2.2) S.wanderStep(W, n.w, n.sp * dt * (lead < 1 ? 1.6 : 1), rnd, n.side);
      if (n.ax == null || Math.hypot(n.x - n.ax, n.y - n.ay) > 1.5) { n.ax = n.x; n.ay = n.y; n.pt = 0; n.reset = 0; } else if ((n.pt += dt) > 10) { /* no headway at all: start again from the path, or leave when nobody is looking */
        if (n.pt > 16 && (!Z.brawl || Z.brawl.okSpawn(n, 135, 45))) { n.gone = true; continue; } var tries8 = Math.floor((n.pt - 10) / 4); if ((n.reset || 0) <= tries8) { n.reset = tries8 + 1; n.side = 0; if (tries8 % 2) n.w.fwd = !n.w.fwd; S.wanderStep(W, n.w, 0, rnd, 0); var nr8 = S.nearRoad(W, n.x, n.y, 60); if (nr8) { n.dx = nr8.x; n.dy = nr8.y; n.dT = 2; } } } /* every 4 s: back to the path, and every other time the other way */
      var pace = n.sp * (Z.brawl ? Z.brawl.pace(n) : 1), mvd = S.walkTo(W, n, n.w.x, n.w.y, pace * (lead > 1.6 ? 1.25 : 1), dt, crowd, .38); n.walk += mvd * 2.6;
      if (mvd < pace * dt * .25) { n.stuck = (n.stuck || 0) + dt; if (n.stuck > 1.2) { n.stuck = 0; n.side *= .5; n.stucks = (n.stucks || 0) + 1; if (n.stucks < 3 && (lead < 3 || (lead < 9 && S.insideBuilding(W, n.w.x, n.w.y)))) { S.wanderStep(W, n.w, 2.5, rnd, n.side); if (S.insideBuilding(W, n.w.x, n.w.y)) n.side = 0; } else { n.stucks = 0; n.jams = (n.jams || 0) + 1; var nr9 = S.nearRoad(W, n.x, n.y, 60); if (nr9) { n.dx = nr9.x; n.dy = nr9.y; n.dT = 1.2; var rp9 = nr9.r.p, rd9 = Math.hypot(nr9.x - rp9[nr9.s], nr9.y - rp9[nr9.s + 1]); for (var k9 = 0; k9 < nr9.s; k9 += 2) rd9 += Math.hypot(rp9[k9 + 2] - rp9[k9], rp9[k9 + 3] - rp9[k9 + 1]); n.w.road = nr9.r.i; n.w.fwd = n.jams % 2 === 1 ? !n.w.fwd : n.w.fwd; n.w.d = n.w.fwd ? rd9 : nr9.r.len - rd9; S.wanderStep(W, n.w, 0, rnd, n.side); } /* start again from the nearest path, the other way */ if (n.jams > 2 && (!Z.brawl || Z.brawl.okSpawn(n, 135, 45))) n.gone = true; } } } else n.stuck = 0;
    }
    if (Z.friends) Z.friends.tick(dt); if (Z.brawl) Z.brawl.tick(dt); if (Z.crowd) Z.crowd.tick(dt); if (Z.city) Z.city.tick(dt);
    for (i = 0; i < Z.npcs.length; i++) {
      n = Z.npcs[i]; n.wave = Math.max(0, n.wave - dt); n.hidden = false; var dd = dist(n, me);
      if (Z.brawl && Z.brawl.npc(n, dt, dd)) continue; // knocked over: down, then up again (samaru-brawl.js)
      if (Z.friends && Z.friends.step(n, dt, dd)) continue; // friends keep their own day (samaru-friends.js)
      if (n.follow) { if (me.veh) { n.hidden = (S.VEH[me.veh.type].seats || 0) > 0 && dd < 30; if (n.hidden) { n.x = me.x; n.y = me.y; continue; } } if (dd > 70) { var tp = S.push(W, me.x - Math.cos(me.a) * 3, me.y - Math.sin(me.a) * 3, .5); n.x = tp.x; n.y = tp.y; } else if (dd > 2.4) { n.walk += S.walkTo(W, n, me.x - Math.cos(me.a) * 1.6, me.y - Math.sin(me.a) * 1.6, Math.min(S.FOOT.run * 1.05, 1.5 + (dd - 2.4) * 1.6), dt, null, .45) * 2.6; } else n.spd = (n.spd || 0) * Math.exp(-10 * dt); n.ft -= dt; if (n.ft <= 0) { n.follow = false; Z.say(n, "I have to go. Later!"); } continue; }
      var hd = Math.hypot(n.hx - n.x, n.hy - n.y); if (hd > 1) { n.walk += S.walkTo(W, n, n.hx, n.hy, n.def.walk || 3, dt, Z.peds, .42) * 2.6; n.lost = (n.spd || 0) < .4 ? (n.lost || 0) + dt : 0; if (n.lost > 4 && dd > 60) { n.x = n.hx; n.y = n.hy; n.lost = 0; } }
      else if (dd < 7) { var ta = Math.atan2(me.y - n.y, me.x - n.x), da = ((ta - n.a + Math.PI * 3) % TAU) - Math.PI; n.a += da * Math.min(1, dt * 5); }
    }
    var h = P.time / 60, ph = Z.places.physics; Z.cameo = h >= 12 && h < 14 ? (Z.cameo || { x: ph.mx + 6, y: ph.my + 4, a: 2, look: { skin: "#e8c4a0", hair: "afro", hairCol: "#e5e7eb", top: "#7c2d12" }, def: { voice: "male", pitch: .8 }, k: 3 }) : null;
  }
  function trafficStep(dt) {
    var target = Math.round((Z.blackout ? 3 : S.darkness(P.time) > .6 ? 5 : 11) * (Z.opt ? Z.opt("traffic", 1) : 1)), i, far = 480 / cam.s + 20;
    if (Z.traffic.length < target && !Z.race) { var q = S.randomRoadPoint(W, rnd, true, me, 320); if (q && (Z.brawl ? Z.brawl.okSpawn(q, 265, far) : unseen(q, far, 150, 60))) { var ty = pick(["okada", "okada", "keke", "keke", "car", "car", "car", "scooter"]), w0 = S.wanderStart(W, rnd, q, true); S.wanderStep(W, w0, 0, rnd, q.r.w * .23); q.x = w0.x; q.y = w0.y; q.a = w0.a; if ((!Z.brawl || Z.brawl.okSpawn(q, 265, far)) && !Z.traffic.some(function (o) { return Math.hypot(o.x - q.x, o.y - q.y) < 14; }) && !Z.cars.some(function (o) { return Math.hypot(o.x - q.x, o.y - q.y) < 6; })) Z.traffic.push({ w: w0, type: ty, col: ty === "car" ? pick(["#e5e7eb", "#1d4ed8", "#16a34a", "#9ca3af", "#111827", "#b45309"]) : VCOL[ty], sp: Math.min(S.VEH[ty].max * .5, 6 + rnd() * 5), v: 0, x: q.x, y: q.y, a: q.a, pri: (Z.carSeq = (Z.carSeq || 0) + 1), look: look(Math.floor(rnd() * 1e6)) }); } }
    var blockers = [Z.traffic, Z.cars, Z.peds, Z.guards, me.alt < .05 ? [me.veh || me] : []];
    for (i = Z.traffic.length - 1; i >= 0; i--) {
      var t = Z.traffic[i], d = dist(t, me); if (d > 360) { Z.traffic.splice(i, 1); continue; } if (Z.veh && Z.veh.stunned && Z.veh.stunned(t, dt)) continue; if (t.city && Z.city && Z.city.car(t, dt)) continue;
      var dx = me.x - t.x, dy = me.y - t.y, ahead = dx * Math.cos(t.a) + dy * Math.sin(t.a), side = Math.abs(-dx * Math.sin(t.a) + dy * Math.cos(t.a)), want = ahead > 0 && ahead < 11 && side < 2.6 && me.alt < .05 ? 0 : t.sp;
      // keep a gap to whatever is in the lane ahead (other traffic, parked machines, walkers); brake harder than it pulls away
      if (t.ghost > 0) t.ghost -= dt; else want = Math.min(want, S.gapSpeed(t, t.sp, blockers));
      t.v += (want - t.v) * (1 - Math.exp(-(want < t.v ? 5 : 1.6) * dt)); if (want === 0 && ahead > 0 && ahead < 11 && side < 2.6 && t.v < .5 && rnd() < dt * .5) api.sound.tone(430, .2, "square", .06);
      // a queue behind you just waits; a parked machine in the lane is squeezed past; a true jam clears itself out of sight
      var bk = t.blk, mine = !bk || bk === me || bk === me.veh, jam = bk && bk.pri != null;
      if (t.v < .4 && want < .4 && !mine) { t.wait = (t.wait || 0) + dt; if (t.wait > (jam ? 9 : 2.5)) { t.wait = 0; if (jam && d > 60) { Z.traffic.splice(i, 1); continue; } t.ghost = jam ? 2 : 3; } } else t.wait = 0;
      // the car steers at a point that runs along its lane a few metres ahead, so bends and junctions are driven, not snapped
      var rd = W.roads[t.w.road], lead = Math.hypot(t.w.x - t.x, t.w.y - t.y); if (lead < 5) S.wanderStep(W, t.w, Math.max(t.v, 2) * dt * (lead < 3 ? 1.7 : 1), rnd, rd.w * .23);
      S.carTo(t, t.w.x, t.w.y, t.w.a, dt); t.speed = t.spd;
      if (!(t.ghost > 0)) for (var tj = 0; tj < Z.traffic.length; tj++) { var o2 = Z.traffic[tj]; if (o2 === t || o2.ghost > 0 || o2.pri > t.pri) continue; var ox = t.x - o2.x, oy = t.y - o2.y, od = Math.hypot(ox, oy); if (od < 2.2 && od > .01) { t.x += ox / od * (2.2 - od); t.y += oy / od * (2.2 - od); t.v *= .5; } } // never inside another car
      var rr = S.VEH[t.type].len * .4 + (me.veh ? S.VEH[me.veh.type].len * .35 : .4);
      if (d < rr && me.alt < .05) { var pa = Math.atan2(me.y - t.y, me.x - t.x);
        if (me.veh) { if (Z.veh && Z.veh.tick) continue; /* samaru-veh.js solves machine against machine */ var v = me.veh, imp = Math.hypot(v.vx, v.vy); v.x = t.x + Math.cos(pa) * rr; v.y = t.y + Math.sin(pa) * rr; v.vx = Math.cos(pa) * imp * .4; v.vy = Math.sin(pa) * imp * .4; if (imp > 5) { api.kick(Math.min(14, imp)); api.sound.sfx("heavy"); t.v = 0; if (imp > 11) { Z.offend("crash"); Z.hurt((imp - 11) * .8); } } }
        else if (t.v > 2 && me.z < .2 && !me.fall) { me.fall = 1.4; Z.hurt(8, t); t.v = 0; } else if (!me.fall) { me.x = t.x + Math.cos(pa) * rr; me.y = t.y + Math.sin(pa) * rr; } }
    }
    if (Z.veh && Z.veh.tick) Z.veh.tick(dt); // crashes, spilled riders, machines sliding to a stop (samaru-veh.js)
  }
  function things(dt) {
    var i, t, d;
    if (me.alt > .05) return;
    for (i = 0; i < Z.tokens.length; i++) { if (P.tokens[i]) continue; t = Z.tokens[i]; if (Math.abs(t.x - me.x) < 2 && Math.abs(t.y - me.y) < 2) { P.tokens[i] = 1; P.stats.tokens++; api.sound.sfx("coin"); api.burst(Z.px(t.x, t.y), Z.py(t.x, t.y), "#b45309", 14); Z.xp(15); Z.money(100); Z.toast("Kola nut <b>" + P.stats.tokens + " / " + S.TOKEN_COUNT + "</b>"); if (P.stats.tokens === 1) Z.bark("token"); } }
    for (i = 0; i < Z.drops.length; i++) { t = Z.drops[i]; if (P.flags["d" + t.i] === P.day) continue; if (Math.abs(t.x - me.x) < 1.8 && Math.abs(t.y - me.y) < 1.8) { P.flags["d" + t.i] = P.day; api.sound.sfx("power");
      if (t.k === "water") { P.energy = Math.min(100, P.energy + 20); Z.float(t.x, t.y, "Pure water +energy", "#7dd3fc"); } else if (t.k === "pie") { P.hunger = Math.min(100, P.hunger + 20); Z.float(t.x, t.y, "Meat pie +food", "#fdba74"); } else if (t.k === "card") Z.money(200); else if (t.k === "glucose") { me.boost = 20; Z.float(t.x, t.y, "Glucose! Speed ×1.5", "#fde047"); } else { me.shield = 12; Z.float(t.x, t.y, "Agbo! Shield 12 s", "#86efac"); } } }
    for (i = 0; i < Z.hazards.length; i++) { t = Z.hazards[i]; d = Math.hypot(t.x - me.x, t.y - me.y); if (d > t.r + .3 || t.cool > api.t) continue;
      if (t.k === "pothole" && me.veh && Math.abs(me.veh.speed) > 5 && !(me.veh.hz > .05)) { /* a hop clears it */ t.cool = api.t + 1.5; me.veh.vx *= .55; me.veh.vy *= .55; api.kick(7); api.sound.sfx("stomp"); api.buzz(30); }
      else if (t.k === "gutter" && !me.veh && me.z < .25 && !me.fall && me.dash <= 0) { t.cool = api.t + 3; me.fall = 1.5; Z.hurt(4); Z.say("me", "Gutter! Who left this thing open?"); } }
    var qs = Z.quest; if (qs && Math.hypot(qs.x - me.x, qs.y - me.y) < 1.8) { Z.quest = null; P.inv[qs.item] = 1; api.sound.sfx("goal"); api.confetti(40, Z.px(qs.x, qs.y), Z.py(qs.x, qs.y)); Z.toast("Found: <b>" + D.ITEMS[qs.item].name + "</b>"); Z.emit({ t: "find", item: qs.item }); }
  }
  function eggs() {
    var h = P.time / 60, dm = Z.places.dam; if (me.sit && h >= 5.5 && h < 7.5 && Math.hypot(dm.mx - me.x, dm.my - me.y) < 40) { Z.sunT = (Z.sunT || 0) + 1; if (Z.sunT > 15 && !P.eggs.fish) { Z.egg("fish", "You watched the sunrise over the dam. Baba Dam left you a golden fish worth ₦5,000."); Z.money(5000); } } else Z.sunT = 0;
  }

  /* ---------- jobs ---------- */
  Z.offers = function (from) { var pts = Z.placeList.map(function (p) { return { id: p.id, name: p.name, x: p.mx, y: p.my }; }), out = []; for (var i = 0; i < 3; i++) out.push(S.makeJob(pts, rnd, P.lvl, S.JOBS[(i + Math.floor(rnd() * 4)) % 4], from ? { id: from.id, name: from.name, x: from.mx, y: from.my } : null)); return out; };
  Z.takeJob = function (j) { P.job = j; routeT = 0; Z.toast("<b>Job:</b> " + S.jobText(j) + (j.need ? "<br><small>You need an okada, keke or car.</small>" : "")); api.sound.sfx("click"); };
  function jobStep(dt) {
    var j = P.job; if (!j) return; if (j.stage > 0 || j.kind === "lost") j.time += dt;
    var seat = me.veh && S.VEH[me.veh.type].seats, slow = !me.veh || Math.abs(me.veh.speed) < 3;
    if (j.kind === "lost") { if (Math.hypot(j.hide.x - me.x, j.hide.y - me.y) < 1.8 && !me.alt) done(true); return; }
    var tg = j.stage === 0 ? j.a : j.b; if (Math.hypot(tg.x - me.x, tg.y - me.y) > 8 || !slow || me.alt > .05) { if (j.limit && j.stage > 0 && j.time > j.limit) done(false); return; }
    if (j.kind === "taxi" && !seat) { if (!j.warned) { j.warned = 1; Z.toast("Your passenger needs a seat: come back on an okada, keke or car."); } return; }
    if (j.stage > 0 && Z.jobs && Z.jobs.nextLeg(j)) { routeT = 0; return; }
    if (j.stage === 0) { j.stage = 1; j.time = 0; routeT = 0; api.sound.sfx("click"); Z.toast(S.jobText(j) + (j.limit ? " <b>" + j.limit + " s</b>" : "")); if (j.kind === "taxi") Z.sub("", pick(["Driver, abeg fast fast.", "Oga, I dey late for lecture.", "Take am easy for bump o."]), 3); } else done(true);
    function done(ok) { var r = S.finishJob(P, j, ok), ex = Z.jobs ? Z.jobs.settle(j, r, ok) : null; if (ok) { api.sound.sfx("goal"); Z.moment("job", { cash: ex ? ex.cash : r.cash, xp: r.xp, fast: r.fast, stars: ex && ex.stars, tip: ex && ex.tip, fee: ex && ex.fee, legs: ex && ex.legs, total: ex && ex.total }); Z.float(me.x, me.y - 2.3, "+" + r.xp + " XP", "#fde047"); if (r.levels) Z.levelUp(); Z.emit({ t: "job" }); } else { Z.moment("fail", { banner: "TOO SLOW", title: "The job is gone", text: pick(["The clock won this one. There is always another job.", "Next time take the short cut by the gardens.", "No wahala. Fresh jobs are on your phone."]), retryLabel: "Find another job", retry: function () { if (Z.ui && Z.ui.phone) Z.ui.phone(); } }); } Z.save(); }
  }

  /* ---------- races ---------- */
  Z.startRace = function (route, veh, cup, at) {
    var pts = {}; Z.placeList.forEach(function (p) { pts[p.id] = { x: p.mx, y: p.my }; });
    var R = S.buildRace(W, route, veh, cup, pts); if (R.gates.length < 2) return;
    if (me.veh) Z.exit(true); var s0 = S.along(R.line, 4), s1 = S.along(R.line, 12), a = Math.atan2(s1.y - s0.y, s1.x - s0.x), car = { id: Z.cars.length, type: veh, x: s0.x, y: s0.y, a: a, vx: 0, vy: 0, speed: 0, col: "#22d3ee", hx: s0.x, hy: s0.y, ha: a, free: true }; Z.cars.push(car); me.x = s0.x; me.y = s0.y; me.veh = car; me.alt = 0; api.useActions(["act", "jump", "phone", "horn", "radio"]);
    R.gate = 0; R.t = -3.2; R.go = false; R.count = 4; R.ai = [0, 1, 2].map(function (i) { var sk = R.cup.skill * (.93 + i * .035); return { d: 10 + i * 6, sp: S.VEH[veh].max * .66 * sk, v: 0, x: s0.x, y: s0.y, a: a, col: ["#f97316", "#a855f7", "#84cc16"][i], side: (i - 1) * 2.6, done: 0, look: look(i * 977 + 5), name: ["Danjuma", "Razor", "Chioma"][i] }; });
    R.startAt = at || 0; R.args = [route, veh, cup]; Z.race = R; Z.traffic.length = 0; Z.route = null; cam.x = me.x; cam.y = me.y;
  };
  function raceStep(dt) {
    var R = Z.race; if (!R) return; var v = me.veh;
    if (!v) { Z.race = null; Z.toast("You left the race."); return; }
    if (R.startAt && Z.net.on) { var left = (R.startAt - (Date.now() + Z.net.offset)) / 1000; R.t = Math.min(R.t, -left); if (left > 3.2) { v.vx = v.vy = 0; v.x = v.hx; v.y = v.hy; return; } R.startAt = 0; R.t = -left; }
    R.t += dt;
    if (!R.go) { v.vx = v.vy = 0; v.x = v.hx; v.y = v.hy; v.a = v.ha; var c = Math.ceil(-R.t); if (c !== R.count && c > 0 && c <= 3) { R.count = c; api.banner(String(c), { size: 150, dur: .8, col: "#fff" }); api.sound.sfx("click"); } if (R.t >= 0) { R.go = true; api.banner("GO!", { size: 150, dur: .9, col: "#86efac" }); api.sound.sfx("whistle"); } return; }
    R.ai.forEach(function (o) { if (o.done) return; var p0 = S.along(R.line, o.d), p1 = S.along(R.line, o.d + 14), turn = Math.abs(((p1.a - p0.a + Math.PI * 3) % TAU) - Math.PI), want = o.sp * (1 - Math.min(.5, turn * .6)) * (me.alt > .05 || veh(o) ? 1 : 1); o.v += (want - o.v) * Math.min(1, dt * 1.2); o.d += o.v * dt; o.x = p0.x + Math.cos(p0.a + 1.57) * o.side; o.y = p0.y + Math.sin(p0.a + 1.57) * o.side; o.a = p0.a; if (o.d >= R.len) o.done = R.t;
      if (me.alt < .05 && Math.hypot(o.x - v.x, o.y - v.y) < S.VEH[R.veh].len * .7) { var pa = Math.atan2(v.y - o.y, v.x - o.x); v.vx += Math.cos(pa) * 3; v.vy += Math.sin(pa) * 3; o.v *= .9; } });
    function veh() { return false; }
    var g = R.gates[R.gate]; if (Math.hypot(g.x - v.x, g.y - v.y) < (R.veh === "plane" ? 26 : 11)) { R.gate++; api.sound.sfx("coin"); api.burst(Z.px(g.x, g.y), Z.py(g.x, g.y), "#fde047", 12);
      if (R.gate >= R.gates.length) { var beat = R.ai.every(function (o) { return !o.done; }); finishRace(R, beat); } }
    if (R.t > R.par * 2.5) finishRace(R, false);
  }
  function finishRace(R, won) {
    Z.race = null; var first = !P.races[R.id];
    if (Z.net.on) Z.net.out.push({ k: "fin", id: R.id, time: Math.round(R.t * 10) / 10 });
    if (won) { if (first || R.t < P.races[R.id]) P.races[R.id] = Math.round(R.t * 10) / 10; if (first) P.stats.races++; P.stats.wins++; var cash = first ? R.pay : Math.round(R.pay * .2), xp = first ? R.xp : Math.round(R.xp * .2); P.money += cash;
      Z.moment("raceWin", { name: R.name, cup: R.cup.name, cash: cash, time: Math.round(R.t * 10) / 10, best: P.races[R.id] === Math.round(R.t * 10) / 10 && !first, podium: podium() }); Z.xp(xp); Z.bark("win"); Z.emit({ t: "race", race: R.route }); }
    else { var pd = podium(), place = 1; pd.forEach(function (e, i) { if (e.me) place = i + 1; }); var args = R.args;
      Z.moment("raceLose", { name: R.name, place: place, podium: pd, text: pick(["So close. Brake before the bend, then power out.", "You had the pace. Hold the inside line next time.", "They know this road. Now you do too.", "Lift early, turn in, then full power."]), retry: args && !R.startAt ? function () { Z.startRace(args[0], args[1], args[2]); } : null }); }
    function podium() { var fin = R.gate >= R.gates.length, l = R.ai.map(function (o) { return { name: o.name, t: o.done || 0, d: o.d }; }); l.push({ name: P.name || "You", me: 1, t: fin ? R.t : 0, d: R.len * R.gate / R.gates.length }); l.sort(function (a, b) { return a.t && b.t ? a.t - b.t : a.t ? -1 : b.t ? 1 : b.d - a.d; }); return l.map(function (e) { return { name: e.name, me: e.me, time: e.t ? Math.round(e.t * 10) / 10 : 0 }; }); }
    Z.save();
  }

  /* ---------- campus security (wanted) ---------- */
  // Security is patient. Offences raise a heat meter; heat earns warnings; only another offence soon after the last
  // warning starts a chase. Guards are on foot, a little slower than your sprint, and need to see you: break their
  // line of sight, outrun them, slip into a building or a garden, or change clothes, and they search, then give up.
  var WARN = ["Hey! Easy there.", "You! Behave yourself.", "We are watching you, fresher.", "This is a school, not a motor park.", "Last time I am telling you.", "Do you want to see the Dean?"], secT = 0;
  Z.offend = function (kind) {
    if (window.FSLGCoop) FSLGCoop.offend(kind);
    if (!P || P.god || Z.mode !== "play") return null; var s = S.sec(P), r = S.offend(P, kind); if (!r) return null;
    if (r.warn) { api.sound.sfx("whistle"); Z.toast("<b>Warning " + r.warn + " of " + r.of + ".</b> " + (r.warn >= r.of ? "That was the last one. Keep calm for a while." : "Security noticed that. Take it easy.")); Z.sub("", "Security: \"" + WARN[Math.min(WARN.length - 1, r.warn - 1)] + "\"", 3); Z.emit({ t: "warn", n: r.warn, of: r.of }); }
    else if (r.final) { api.sound.sfx("whistle"); Z.toast("<b>Final warning.</b> Do that again soon and they will come for you."); Z.sub("", "Security: \"I will not tell you again.\"", 3); Z.emit({ t: "warn", n: S.RULES.warnings, of: S.RULES.warnings, final: true }); }
    else if (r.chase) { s.lx = me.x; s.ly = me.y; s.lost = 0; s.srch = 0; s.t = 0; s.outfit = P.outfit || 0; P.wanted = 1; secT = api.t; api.sound.sfx("whistle"); api.banner("SECURITY!", { size: 76, col: "#93c5fd", edge: "#1e3a8a", sub: "Outrun them or get out of sight", dur: 2.2 }); Z.sub("", "Campus security: \"You there! Stop!\"", 3); Z.emit({ t: "wanted" }); }
    return r;
  };
  // Send everyone home: no heat, no warnings, no guards. (The NOWAHALA cheat and the admin page use this.)
  Z.callOff = function () { if (!P) return; S.secClear(P); Z.guards.length = 0; };
  function secEnd(caught) {
    var R = S.RULES, fine = 0; Z.guards.forEach(function (g) { g.st = "leave"; g.lt = 0; g.hold = 0; });
    if (caught) { fine = Math.min(Math.max(0, P.money), R.fine); if (fine) P.money -= fine; S.secClear(P); Z.sub("", "Security: \"Walk and drive with sense. You are a student, not a tout." + (fine ? " Fine: ₦" + fine + "." : "") + "\"", 4); Z.emit({ t: "caught", fine: fine }); Z.moment("caught", { fine: fine }); }
    else { S.secClear(P, Math.max(0, R.warnings - 2)); Z.bark("win"); Z.emit({ t: "escaped" }); Z.moment("escaped", { text: caught === 0 ? "You slipped out of sight. They walked right past." : "They gave up. Keep your head down for a while." }); }
    Z.save();
  }
  // A point you can walk straight to from (x, y) that leads towards (tx, ty) and onto a path. Null if boxed in.
  Z.wayOut = function (x, y, tx, ty) {
    var best = null, bs = -1e9, ta = Math.atan2(ty - y, tx - x);
    for (var r = 4; r <= 22 && !best; r += 6) for (var k = 0; k < 12; k++) { var a = ta + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .5236, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (S.insideBuilding(W, px, py) || S.inWater(W, px, py) || !S.los(W, x, y, px, py)) continue; var nr = S.nearRoad(W, px, py, 40), ok = nr && S.los(W, px, py, nr.x, nr.y), sc = -Math.hypot(tx - px, ty - py) + (ok ? 20 : 0);
      if (sc > bs) { bs = sc; best = ok ? { x: nr.x, y: nr.y, via: { x: px, y: py } } : { x: px, y: py }; } }
    return best && best.via ? best.via : best;
  };
  function security(dt) {
    var R = S.RULES, s = S.sec(P), i, g, d, gap = api.t - (secT || api.t), gs = S.FOOT.run * R.guardSpeed; secT = api.t;
    for (i = Z.guards.length - 1; i >= 0; i--) { g = Z.guards[i]; if (g.st !== "leave") continue; g.lt += dt; d = dist(g, me); var aw = Math.atan2(g.y - me.y, g.x - me.x); S.walkTo(W, g, g.x + Math.cos(aw) * 20, g.y + Math.sin(aw) * 20, gs * .5, dt, null, .45); if (g.lt > 2.5 && (d > 60 || g.lt > 16)) Z.guards.splice(i, 1); }
    if (!s.state) { var e = S.secTick(P, dt, Z.guards.some(function (q) { return dist(q, me) < R.sight && S.los(W, q.x, q.y, me.x, me.y); })); if (e && e.expired != null && Z.mode === "play") Z.toast(e.expired ? "Security let one warning go. <b>" + e.expired + "</b> left on you." : "Security has forgotten about you."); P.wanted = 0; return; }
    s.t += dt;
    var act = Z.guards.filter(function (q) { return q.st !== "leave"; }), near = 1e9, any = false, ar = S.areaAt(W, me.x, me.y), flying = me.alt > .05;
    act.forEach(function (q) { near = Math.min(near, dist(q, me)); });
    // hiding: indoors (you were in a place menu), still among the garden hedges, or in different clothes
    if (gap > 1.2 && Z.near(18) && near > 6) { secEnd(0); return; }
    var hidden = near > 10 && ((ar && (ar.k === "garden" || ar.k === "park") && !me.veh && (me.speed || 0) < 1.5) || (P.outfit || 0) !== s.outfit), fast = (me.veh ? Math.abs(me.veh.speed) : me.speed || 0) > S.FOOT.run * 1.2;
    if (s.state === "chase" && act.length < Math.min(R.guards, 1 + (s.t > 10 ? 1 : 0) + (s.t > 25 ? 1 : 0))) { var q0 = S.randomRoadPoint(W, rnd, false, me, 95), qd = q0 ? Math.hypot(q0.x - me.x, q0.y - me.y) : 0; if (q0 && qd > 40 && (qd > 65 || !S.los(W, q0.x, q0.y, me.x, me.y))) { var gp = S.push(W, q0.x, q0.y, .5); Z.guards.push({ x: gp.x, y: gp.y, a: Math.atan2(me.y - gp.y, me.x - gp.x), spd: 0, walk: 0, st: "chase", hold: 0, guard: 1 }); } }
    for (i = 0; i < act.length; i++) { g = act[i]; d = dist(g, me); if (!hidden && !flying && d < R.sight && S.los(W, g.x, g.y, me.x, me.y)) any = true; }
    if (any) { s.lx = me.x; s.ly = me.y; s.lost = 0; if (s.state === "search") { s.state = "chase"; Z.sub("", "Security: \"There! By the road!\"", 2.5); api.sound.sfx("whistle"); } }
    else { var rate = (fast ? 2 : 1) * (hidden ? 2 : 1) * (flying ? 3 : 1); s.lost += dt * rate; if (near > R.range && act.length) s.lost = Math.max(s.lost, R.lostAfter + .01);
      // they head for where you were last seen; the search starts once one of them gets there (or you are simply gone)
      var there = act.some(function (q) { return Math.hypot(q.x - s.lx, q.y - s.ly) < 12; }), gone = Math.hypot(me.x - s.lx, me.y - s.ly) > R.range || near > R.range;
      if (s.state === "chase" && act.length && ((s.lost > R.lostAfter && (there || gone)) || s.lost > 30)) { s.state = "search"; s.srch = 0; Z.toast("They lost sight of you. <b>Stay out of view</b> until the circle on the map closes."); }
      if (s.state === "search") { s.srch += dt * rate; if (s.srch >= R.search) { secEnd(); return; } } }
    var rr = 8 + 30 * (1 - Math.min(1, (s.srch || 0) / R.search));
    for (i = 0; i < act.length; i++) { g = act[i]; d = dist(g, me); if (Z.brawl && Z.brawl.downed(g, dt)) continue;
      if (s.state === "chase") { var tx = any ? me.x : s.lx, ty = any ? me.y : s.ly, gd = Math.hypot(tx - g.x, ty - g.y), wx2 = tx, wy2 = ty;
        // a clear line: straight at you. Otherwise round by the paths, re-planned as you move (never walk into a wall again and again)
        var clear = gd < 45 && S.los(W, g.x, g.y, tx, ty); if (clear && !(g.rp && g.rp.out)) g.rp = null;
        if (!clear) { g.rpT = (g.rpT || 0) - dt; if (!g.rp || g.rpT <= 0 || Math.hypot(g.rp.tx - tx, g.rp.ty - ty) > 10) { var rp = S.route(W, g.x, g.y, tx, ty, false); g.rp = { p: rp && rp.length >= 4 ? rp : [g.x, g.y, tx, ty], i: 2, tx: tx, ty: ty }; g.rpT = 1.5; }
          var pp = g.rp.p; while (g.rp.i < pp.length - 2 && Math.hypot(pp[g.rp.i] - g.x, pp[g.rp.i + 1] - g.y) < 2.2) g.rp.i += 2; if (g.rp.i < pp.length - 2) { wx2 = pp[g.rp.i]; wy2 = pp[g.rp.i + 1]; }
          }
        var mv = S.walkTo(W, g, wx2, wy2, gs, dt, act, .45); g.walk += mv * 2.6;
        // pressed against a wall (a route's first leg can cut through a building): go out the way you can see, then on by the paths
        if (mv < gs * dt * .2 && gd > 3) { g.stuck = (g.stuck || 0) + dt; if (g.stuck > .5) { g.stuck = 0; var ex = Z.wayOut(g.x, g.y, tx, ty); if (ex) { var rq = S.route(W, ex.x, ex.y, tx, ty, false); g.rp = { p: [g.x, g.y, ex.x, ex.y].concat(rq && rq.length >= 4 ? rq.slice(2) : [tx, ty]), i: 2, tx: tx, ty: ty, out: 1 }; g.rpT = 4; } else if (g.rp) g.rp.i += 2; } } else g.stuck = 0;
      } else { g.st2 = (g.st2 || 0) - dt; if (g.st2 <= 0 || Math.hypot(g.sx - g.x, g.sy - g.y) < 1.5) { g.st2 = 2.5; var sa = rnd() * TAU, sr = rnd() * rr, sp2 = S.push(W, s.lx + Math.cos(sa) * sr, s.ly + Math.sin(sa) * sr, .5); g.sx = sp2.x; g.sy = sp2.y; } g.walk += S.walkTo(W, g, g.sx, g.sy, gs * .5, dt, act, .45) * 2.6; }
      if (any && d < 2.4 && !flying && (me.veh ? Math.abs(me.veh.speed) < 3 : (me.speed || 0) < S.FOOT.walk + .3)) { g.hold += dt; if (g.hold > R.catchTime) { secEnd(true); return; } } else g.hold = Math.max(0, g.hold - dt); }
    P.wanted = s.state === "chase" ? Math.max(1, Math.min(3, act.length)) : 1;
  }

  /* ---------- dates and hangouts ---------- */
  Z.hangout = function (n, date) { if (Z.friends) { if (!Z.friends.canJoin(n)) return; if (dist(n, me) > 12) { Z.friends.call(n); return; } Z.friends.follow(n, date ? 900 : 0); } else { n.follow = true; n.ft = 240; var f = S.push(W, me.x - Math.cos(me.a) * 4, me.y - Math.sin(me.a) * 4, .5); if (dist(n, me) > 30) { n.x = f.x; n.y = f.y; } } Z.say(n, date ? "I'm ready. Where are we going?" : pick(["I dey come!", "Oya, let's go.", "Where the party at?"])); if (!date) { S.bond(P, n.id, 2); Z.toast(n.def.name + " is hanging out with you. Eat together, dance (2), ride around: your friendship grows."); } };
  function dateStep(dt) { Z.npcs.forEach(function (n) { if (n.follow && dist(n, me) < 14) { n.bt = (n.bt || 0) + dt; if (n.bt > 20) { n.bt = 0; S.bond(P, n.id, 1); } } }); }

  /* ---------- multiplayer over the same network (the site relays; up to 6 in a room) ---------- */
  Z.netJoin = function (code) { var N = Z.net; N.code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); N.on = N.code.length >= 3; N.peers = {}; N.since = 0; N.t = 0; N.err = ""; N.spar = 100; return N.on; };
  Z.netLeave = function () { Z.net.on = false; Z.net.peers = {}; };
  function netStep(dt) {
    var N = Z.net, id; for (id in N.peers) S.netStep(N.peers[id], dt);
    if (!N.on) return; N.t -= dt; if (N.t > 0 || N.busy) return; N.t = .25; N.busy = true;
    var cfg = document.querySelector("[data-gm-api]"); if (!cfg) { N.busy = false; return; }
    var st = S.pack(P, { x: me.x, y: me.y, a: me.a, veh: me.veh ? me.veh.type : "", speed: me.speed, emote: me.emote2 === "spar" ? "spar" : me.emote || (me.phoneK > .5 ? "phone" : ""), z: me.alt > .05 }), ev = N.out.splice(0, 5);
    fetch(cfg.getAttribute("data-gm-api") + "room/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": cfg.getAttribute("data-csrf") }, body: JSON.stringify({ code: N.code, name: (P.name || Z.charOf(P.char).name).slice(0, 16), st: st, ev: ev, since: N.since }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Room error"); return j; }); })
      .then(function (j) { N.busy = false; N.err = ""; N.me = j.me; N.offset = j.now - Date.now(); var seen = {};
        j.players.forEach(function (p) { seen[p.id] = 1; var r = N.peers[p.id] || (N.peers[p.id] = { name: p.n }); if (!r.joined) { r.joined = 1; Z.toast("<b>" + api.esc(p.n) + "</b> joined the room."); } r.name = p.n; S.netApply(r, p.st); });
        Object.keys(N.peers).forEach(function (k) { if (!seen[k]) { Z.toast("<b>" + api.esc(N.peers[k].name) + "</b> left."); delete N.peers[k]; } });
        j.ev.forEach(function (e) { N.since = Math.max(N.since, e.i); if (e.f === N.me) return; var r = N.peers[e.f]; if (!r) return;
          if (e.k === "chat") { if (Z.CHAT[e.p]) Z.bubbles.push({ o: r, text: Z.CHAT[e.p], t: 0, dur: 4 }); }
          else if (e.k === "race") { N.invite = e; Z.toast("<b>" + api.esc(r.name) + "</b> started a race: open your phone → Multiplayer to join."); api.sound.sfx("whistle"); }
          else if (e.k === "co") { if (window.FSLGCoop) FSLGCoop.onEvent(e, r); }
          else if (e.k === "fin") Z.toast("<b>" + api.esc(r.name) + "</b> finished in " + e.time + " s.");
          else if (e.k === "hit" && e.to === N.me && me.emote2 === "spar") { N.spar -= e.d; me.inv = .2; api.kick(5); api.sound.sfx("hit"); Z.float(me.x, me.y - 1.4, "spar −" + e.d, "#fca5a5"); if (N.spar <= 0) { N.spar = 100; me.fall = 2; me.emote2 = ""; N.out.push({ k: "chat", p: 6 }); Z.toast(api.esc(r.name) + " wins the spar."); } } });
      }).catch(function (e) { N.busy = false; N.err = e.message; if (/full|closed|sign/i.test(e.message)) { N.on = false; Z.toast(api.esc(e.message)); } });
  }

  /* ---------- drawing ---------- */
  function wx(v) { return (v - cam.x) * cam.s + 480; } function wy(v) { return (v - cam.y) * cam.s + 270; }
  Z.px = function (x, y) { if (Z.r3 && Z.r3.ready) { var q = Z.r3.project(x, 1.2, y); return q ? q.x : -999; } return wx(x); };
  Z.py = function (x, y) { if (Z.r3 && Z.r3.ready) { var q = Z.r3.project(x, 1.2, y); return q ? q.y : -999; } return wy(y); };
  function draw3d(x, t) { // the world is WebGL underneath; this canvas only carries labels and the HUD
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, x.canvas.width, x.canvas.height); x.restore();
    if (Z.mode !== "play") return; var q, R3 = Z.r3, st = Z.step();
    function label(o, h, text, col, font) { if (Math.hypot(o.x - me.x, o.y - me.y) > 45) return; q = R3.project(o.x, h, o.y); if (!q || q.x < -50 || q.x > 1010 || q.y < 0 || q.y > 540) return; x.font = font || "700 11px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.75)"; x.strokeText(text, q.x, q.y); x.fillStyle = col; x.fillText(text, q.x, q.y); }
    Z.npcs.forEach(function (n) { if (!n.hidden) label(n, 2.6, n.def.name, st && st.npc === n.id ? "#fde047" : "#e2e8f0"); });
    Z.placeList.forEach(function (p) { label({ x: p.mx, y: p.my }, 3.2, p.name, "#fff", "800 12px system-ui, sans-serif"); });
    if (Z.race) Z.race.ai.forEach(function (o) { label(o, 2.6, o.name, "#fff"); });
    Object.keys(Z.net.peers).forEach(function (id) { var r = Z.net.peers[id]; if (r.x != null) label(r, r.z ? 42 : 2.8, r.name + " · L" + (r.lvl || 1) + (r.emote === "spar" ? " ⚔" : ""), r.char === S.HERO_ID ? "#fde047" : "#67e8f9", "800 12px system-ui, sans-serif"); });
    Z.foes.forEach(function (f) { if (f.def.boss || f.hp >= f.max) return; q = R3.project(f.x, 2.4, f.y); if (!q) return; x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(q.x - 16, q.y, 32, 4); x.fillStyle = "#f87171"; x.fillRect(q.x - 16, q.y, 32 * Math.max(0, f.hp / f.max), 4); });
    Z.floats.forEach(function (f) { q = R3.project(f.x, 2.2 + f.t * 1.6, f.y); if (!q) return; x.globalAlpha = 1 - f.t / 1.2; x.font = "800 16px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText(f.text, q.x, q.y); x.fillStyle = f.col; x.fillText(f.text, q.x, q.y); x.globalAlpha = 1; });
    Z.bubbles.forEach(function (b) { q = R3.project(b.o.x, 2.9, b.o.y); if (q) bubble(x, q.x, q.y, b.text, Math.min(1, b.t * 6, (b.dur - b.t) * 4)); });
    if (Z.retro) { x.fillStyle = "rgba(20,80,30,.22)"; x.fillRect(0, 0, 960, 540); x.fillStyle = "rgba(0,0,0,.22)"; for (var i = 0; i < 540; i += 4) x.fillRect(0, i, 960, 2); }
    if (big) drawBig(x, t); else { hud(x, t); if (window.FSLGCoop) FSLGCoop.hud(x, t); }
  }
  function vis(o, m) { var px = wx(o.x), py = wy(o.y); m = m || 40; return px > -m && px < 960 + m && py > -m && py < 540 + m; }
  Z.draw = function () {
    var x = api.x, t = api.t, s = cam.s, i, o, dk = P ? S.darkness(P.time) : 0, lights = [];
    if (Z.r3 && Z.r3.ready && Z.r3.render(t)) { if (!(Z.intro && Z.intro.on)) draw3d(x, t); return; } /* the opening film has no HUD */
    G.ground(x, cam, t); G.treeShadows(x, cam);
    // hazards, markers, pickups
    for (i = 0; i < Z.hazards.length; i++) { o = Z.hazards[i]; if (!vis(o)) continue; if (o.k === "pothole") { x.fillStyle = "rgba(30,25,20,.55)"; x.beginPath(); x.ellipse(wx(o.x), wy(o.y), o.r * s, o.r * s * .7, i, 0, TAU); x.fill(); } else { x.save(); x.translate(wx(o.x), wy(o.y)); x.rotate(o.a); x.fillStyle = "#3b3026"; x.fillRect(-1.6 * s, -.45 * s, 3.2 * s, .9 * s); x.fillStyle = "#8b8378"; x.fillRect(-2.2 * s, -.5 * s, .6 * s, s); x.fillRect(1.6 * s, -.5 * s, .6 * s, s); x.restore(); } }
    if (Z.mode === "play") {
      Z.placeList.forEach(function (p) { if (!vis({ x: p.mx, y: p.my }, 80)) return; var px = wx(p.mx), py = wy(p.my), pul = 1 + Math.sin(t * 3 + p.mx) * .08, col = p.role === "food" ? "#fb923c" : p.role === "home" ? "#60a5fa" : p.role === "class" ? "#a78bfa" : p.role === "shop" || p.role === "bank" ? "#4ade80" : p.role === "heal" ? "#f87171" : "#fde047";
        x.strokeStyle = col; x.lineWidth = 3; x.globalAlpha = .85; x.beginPath(); x.ellipse(px, py, 2.2 * s * pul, 1.7 * s * pul, 0, 0, TAU); x.stroke(); x.globalAlpha = .18; x.fillStyle = col; x.fill(); x.globalAlpha = 1; });
      for (i = 0; i < Z.tokens.length; i++) { o = Z.tokens[i]; if (P.tokens[i] || !vis(o)) continue; var bob = Math.sin(t * 3 + i) * 2; x.fillStyle = "rgba(0,0,0,.25)"; x.beginPath(); x.ellipse(wx(o.x), wy(o.y) + 4, 5, 2.5, 0, 0, TAU); x.fill(); x.fillStyle = "#7c2d12"; x.beginPath(); x.ellipse(wx(o.x), wy(o.y) - 4 + bob, .42 * s, .34 * s, .4, 0, TAU); x.fill(); x.fillStyle = "#fed7aa"; x.beginPath(); x.ellipse(wx(o.x) - 1, wy(o.y) - 5 + bob, .16 * s, .1 * s, .4, 0, TAU); x.fill(); }
      for (i = 0; i < Z.drops.length; i++) { o = Z.drops[i]; if (P.flags["d" + o.i] === P.day || !vis(o)) continue; var c = { water: "#7dd3fc", pie: "#fdba74", card: "#4ade80", glucose: "#fde047", agbo: "#86efac" }[o.k], b2 = Math.sin(t * 4 + i) * 2; x.fillStyle = c; G.rr(x, wx(o.x) - .35 * s, wy(o.y) - .45 * s + b2, .7 * s, .9 * s, 3); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 1.5; x.stroke(); }
      if (Z.quest && vis(Z.quest)) { o = Z.quest; if (dist(o, me) < 40) { G.star(x, wx(o.x), wy(o.y) + Math.sin(t * 5) * 3, .5 * s * (1 + Math.sin(t * 8) * .15)); } }
      if (P.job && P.job.kind === "lost" && dist(P.job.hide, me) < 16) G.star(x, wx(P.job.hide.x), wy(P.job.hide.y) + Math.sin(t * 5) * 3, .5 * s);
      if (P.job && P.job.kind !== "lost") { var jt = P.job.stage === 0 ? P.job.a : P.job.b; beacon(x, jt.x, jt.y, "#4ade80", t); }
      var tg = Z.objective().target; if (tg && !P.job && !Z.race) beacon(x, tg.x, tg.y, "#fde047", t);
      if (Z.race) { var R = Z.race; for (i = R.gate; i < Math.min(R.gate + 3, R.gates.length); i++) { var g = R.gates[i], last = i === R.gates.length - 1; x.strokeStyle = last ? "#fff" : i === R.gate ? "#fde047" : "rgba(253,224,71,.4)"; x.lineWidth = i === R.gate ? 5 : 3; x.beginPath(); x.arc(wx(g.x), wy(g.y), 5 * s * (i === R.gate ? 1 + Math.sin(t * 6) * .06 : 1), 0, TAU); x.stroke(); } }
      Z.tele.forEach(function (tl) { var k = Math.min(1, tl.t / tl.at); x.fillStyle = tl.done ? "rgba(255,255,255,.8)" : "rgba(239,68,68," + (.15 + k * .35) + ")"; x.beginPath(); x.arc(wx(tl.x), wy(tl.y), tl.r * s, 0, TAU); x.fill(); x.strokeStyle = "#ef4444"; x.lineWidth = 2; x.beginPath(); x.arc(wx(tl.x), wy(tl.y), tl.r * s * k, 0, TAU); x.stroke(); });
    }
    // ground things sorted by y: vehicles, people, foes
    var list = [];
    Z.cars.forEach(function (c) { if (vis(c, 80) && !(c === me.veh && me.alt > .05)) list.push({ y: c.y, f: function () { G.vehicle(x, wx(c.x), wy(c.y), c.a, c.type, c.col, s, { t: t }); if (c === me.veh && c.type !== "car" && c.type !== "sport" && c.type !== "keke" && c.type !== "plane") rider(x, c, Z.charOf(P.char), P); } }); });
    Z.traffic.forEach(function (c) { if (vis(c, 80)) list.push({ y: c.y, f: function () { G.vehicle(x, wx(c.x), wy(c.y), c.a, c.type, c.col, s); if (c.type === "okada" || c.type === "scooter") G.person(x, wx(c.x), wy(c.y), c.a, c.look, { sit: true, outfit: c.look.mode }, s * .9); } }); });
    Z.guards.forEach(function (c) { if (vis(c, 80)) list.push({ y: c.y, f: function () { G.person(x, wx(c.x), wy(c.y), c.a, { skin: "#5e3a22", hair: "cap", hairCol: "#1e3a8a", top: "#1e3a8a" }, { sit: true }, s * .9); if (Math.floor(c.t * 6) % 2) { x.fillStyle = "#ef4444"; x.beginPath(); x.arc(wx(c.x), wy(c.y) - s, 3, 0, TAU); x.fill(); } } }); });
    if (Z.race) Z.race.ai.forEach(function (c) { if (vis(c, 80)) list.push({ y: c.y, f: function () { G.vehicle(x, wx(c.x), wy(c.y), c.a, Z.race.veh, c.col, s, { t: t }); tag(x, c, c.name, "#fff"); } }); });
    Z.peds.forEach(function (p) { if (vis(p)) list.push({ y: p.y, f: function () { G.person(x, wx(p.x), wy(p.y), p.a, p.look, { walk: p.walk, fall: p.fall, wave: p.wave, outfit: p.look.mode }, s); } }); });
    Z.npcs.forEach(function (n) { if (Z.mode === "play" && !n.hidden && vis(n)) list.push({ y: n.y, f: function () { G.person(x, wx(n.x), wy(n.y), n.a, n.look, { walk: n.walk, wave: n.wave, outfit: n.mode, big: n.id === "sly" }, s * (n.id === "sly" ? 1.15 : 1)); tag(x, n, n.def.name, st && st.npc === n.id ? "#fde047" : "#e2e8f0"); } }); });
    var st = P ? Z.step() : null;
    if (Z.cameo && vis(Z.cameo)) list.push({ y: Z.cameo.y, f: function () { G.person(x, wx(Z.cameo.x), wy(Z.cameo.y), Z.cameo.a, Z.cameo.look, { sit: true, outfit: "coat" }, s); x.fillStyle = "#dc2626"; x.beginPath(); x.arc(wx(Z.cameo.x) + 8, wy(Z.cameo.y) - 14 + (t * 30 % 14), 3, 0, TAU); x.fill(); } });
    Z.foes.forEach(function (f) { if (vis(f, 60)) list.push({ y: f.y, f: function () { foe(x, f, t, s); } }); });
    Object.keys(Z.net.peers).forEach(function (id) { var r = Z.net.peers[id]; if (r.x == null || !vis(r, 80) || r.z) return; list.push({ y: r.y, f: function () { peer(x, r, s, t); } }); });
    if (Z.mode === "play" && !me.veh) list.push({ y: me.y, f: function () { var ch = Z.charOf(P.char); if (me.inv > 0 && Math.floor(t * 20) % 2) x.globalAlpha = .5; G.person(x, wx(me.x), wy(me.y), me.a, ch, { walk: me.walk, z: me.z, sit: me.sit, fall: me.fall ? (me.fall > 50 ? t : me.fall) : 0, dance: me.emote === "dance" ? t : 0, wave: me.emote === "wave" ? t : 0, punch: me.punch ? 1 - me.punch / .18 : 0, torch: me.torch, big: P.flags.bighead, outfit: D.OUTFITS[P.outfit || 0].mode }, s); x.globalAlpha = 1;
      if (me.shield > 0) { x.strokeStyle = "rgba(134,239,172,.8)"; x.lineWidth = 2; x.beginPath(); x.arc(wx(me.x), wy(me.y), s * 1.1, 0, TAU); x.stroke(); } if (S.inWater(W, me.x, me.y)) { x.strokeStyle = "rgba(255,255,255,.6)"; x.lineWidth = 2; x.beginPath(); x.arc(wx(me.x), wy(me.y), s * (.8 + (t % 1) * .6), 0, TAU); x.stroke(); } } });
    list.sort(function (a, b) { return a.y - b.y; }); for (i = 0; i < list.length; i++) list[i].f();
    Z.shots.forEach(function (sh) { if (sh.mine) { x.save(); x.translate(wx(sh.x), wy(sh.y)); x.rotate(sh.spin || 0); x.fillStyle = "#e11d48"; G.rr(x, -.45 * s, -.2 * s, .9 * s, .4 * s, 3); x.fill(); x.restore(); } else { x.fillStyle = "#c084fc"; x.shadowColor = "#c084fc"; x.shadowBlur = 10; x.beginPath(); x.arc(wx(sh.x), wy(sh.y), sh.r * s, 0, TAU); x.fill(); x.shadowBlur = 0; } });
    G.buildings(x, cam, null); G.treeTops(x, cam, t);
    if (P && wx(6) > -200 && wx(6) < 1160 && me.alt > .4) { var hx = 480 + (wx(6) - 480) * 1.66, hy = 270 + (wy(-4) - 270) * 1.66; x.fillStyle = "#2a1f3d"; x.beginPath(); x.ellipse(hx, hy, 5 * s, 5 * s, 0, 0, TAU); x.fill(); x.fillStyle = "#1a1228"; x.beginPath(); x.arc(hx, hy, 3 * s, 0, TAU); x.fill(); x.strokeStyle = "#ff3355"; x.lineWidth = 2; x.beginPath(); x.arc(hx, hy, 3.1 * s, 0, TAU); x.stroke(); }
    if (Z.mode === "play") {
      if (me.veh && me.alt > .05) { G.vehicle(x, wx(me.x), wy(me.y), me.a, "plane", me.veh.col, s, { alt: me.alt, t: t }); }
      Object.keys(Z.net.peers).forEach(function (id) { var r = Z.net.peers[id]; if (r.x != null && r.z && vis(r, 120)) peer(x, r, s, t); });
      // the player is always findable, even behind a wall
      x.strokeStyle = "rgba(34,211,238,.9)"; x.lineWidth = 2; x.setLineDash([4, 4]); x.beginPath(); x.arc(wx(me.x), wy(me.y), Math.max(10, s * 1.25), t * 2, t * 2 + TAU); x.stroke(); x.setLineDash([]);
      // lights
      if (dk > .02) {
        if (!Z.blackout) { var L = G.lamps(); for (i = 0; i < L.length; i++) { if (Math.abs(L[i].x - cam.x) < 520 / s && Math.abs(L[i].y - cam.y) < 310 / s) lights.push({ x: wx(L[i].x), y: wy(L[i].y), r: 13 * s, a: .8 }); } Z.placeList.forEach(function (p) { if (vis({ x: p.mx, y: p.my }, 200)) lights.push({ x: wx(p.mx), y: wy(p.my), r: 9 * s, a: .7 }); }); }
        lights.push({ x: wx(me.x), y: wy(me.y), r: (Z.blackout ? 4.5 : 6) * s, a: .75 });
        if (me.torch && !me.veh) lights.push({ x: wx(me.x), y: wy(me.y), r: 11 * s, a: 1, cone: .5, dir: me.a });
        if (me.veh && me.veh.type !== "skate" && me.veh.type !== "bike") lights.push({ x: wx(me.x), y: wy(me.y), r: 24 * s, a: 1, cone: .42, dir: me.a });
        Z.traffic.forEach(function (c) { if (vis(c, 200)) lights.push({ x: wx(c.x), y: wy(c.y), r: 14 * s, a: .9, cone: .45, dir: c.a }); });
        Z.foes.forEach(function (f) { if (f.def.boss) lights.push({ x: wx(f.x), y: wy(f.y), r: 7 * s, a: .6 }); });
        Z.shots.forEach(function (sh) { lights.push({ x: wx(sh.x), y: wy(sh.y), r: 2.5 * s, a: .8 }); });
        G.night(x, dk, lights, Z.blackout ? "rgba(6,4,24,1)" : "rgba(10,14,44,1)");
      }
      if (P.flags.harmattan) { x.fillStyle = "rgba(226,200,150,.32)"; x.fillRect(0, 0, 960, 540); }
      Z.foes.forEach(function (f) { if (f.k === "shade" && vis(f)) { x.fillStyle = "#f0abfc"; x.beginPath(); x.arc(wx(f.x) - .2 * s, wy(f.y) - .15 * s, 2, 0, TAU); x.arc(wx(f.x) + .2 * s, wy(f.y) - .15 * s, 2, 0, TAU); x.fill(); } });
      Z.floats.forEach(function (f) { x.globalAlpha = 1 - f.t / 1.2; x.font = "800 16px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText(f.text, wx(f.x), wy(f.y) - f.t * 34); x.fillStyle = f.col; x.fillText(f.text, wx(f.x), wy(f.y) - f.t * 34); x.globalAlpha = 1; });
      Z.bubbles.forEach(function (b) { bubble(x, wx(b.o.x), wy(b.o.y) - s * 1.6, b.text, Math.min(1, b.t * 6, (b.dur - b.t) * 4)); });
      if (Z.retro) { x.fillStyle = "rgba(20,80,30,.22)"; x.fillRect(0, 0, 960, 540); x.fillStyle = "rgba(0,0,0,.22)"; for (i = 0; i < 540; i += 4) x.fillRect(0, i, 960, 2); }
      if (big) drawBig(x, t); else { hud(x, t); if (window.FSLGCoop) FSLGCoop.hud(x, t); }
    }
  };
  function beacon(x, bx, by, col, t) { var px = wx(bx), py = wy(by); if (px < -60 || px > 1020 || py < -60 || py > 600) return; var g = x.createLinearGradient(0, py - 150, 0, py); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, col); x.globalAlpha = .55 + Math.sin(t * 4) * .15; x.fillStyle = g; x.fillRect(px - 5, py - 150, 10, 150); x.globalAlpha = 1; x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.ellipse(px, py, 22 + Math.sin(t * 4) * 3, 15 + Math.sin(t * 4) * 2, 0, 0, TAU); x.stroke(); }
  function rider(x, c, ch, p) { G.person(x, wx(c.x), wy(c.y), c.a + (c.type === "skate" ? .9 : 0), ch, { sit: c.type !== "skate", big: p.flags.bighead, outfit: D.OUTFITS[p.outfit || 0].mode }, cam.s * .92); }
  function tag(x, o, name, col) { if (cam.s < 9) return; x.font = "700 11px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText(name, wx(o.x), wy(o.y) - cam.s * 1.15); x.fillStyle = col; x.fillText(name, wx(o.x), wy(o.y) - cam.s * 1.15); }
  function peer(x, r, s, t) { var ch = Z.charOf(r.char), px = wx(r.x), py = wy(r.y); if (r.veh) { G.vehicle(x, px, py, r.a, r.veh, VCOL[r.veh] || "#fff", s, { alt: r.z ? 1 : 0, t: t }); if (r.veh === "skate" || r.veh === "bike" || r.veh === "okada" || r.veh === "scooter") G.person(x, px, py, r.a, ch, { sit: true, outfit: D.OUTFITS[r.outfit || 0].mode }, s * .92); } else G.person(x, px, py, r.a, ch, { walk: t * (r.ts || 0) * 2.6, dance: r.emote === "dance" ? t : 0, wave: r.emote === "wave" ? t : 0, sit: r.emote === "sit", outfit: D.OUTFITS[r.outfit || 0].mode }, s);
    x.font = "800 12px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 3; x.strokeStyle = "rgba(0,0,0,.75)"; var label = r.name + " · L" + (r.lvl || 1) + (r.emote === "spar" ? " ⚔" : ""); x.strokeText(label, px, py - s * 1.3); x.fillStyle = r.char === S.HERO_ID ? "#fde047" : "#67e8f9"; x.fillText(label, px, py - s * 1.3); }
  function foe(x, f, t, s) {
    var px = wx(f.x), py = wy(f.y), r = f.def.r * s;
    if (f.def.human) { if (f.st === "aim") { x.strokeStyle = "rgba(239,68,68,.7)"; x.lineWidth = 3; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(f.ca) * 10 * s, py + Math.sin(f.ca) * 10 * s); x.stroke(); x.setLineDash([]); }
      G.person(x, px, py, f.a, f.k === "sly" ? { skin: "#4f301c", hair: "fade", top: "#111827" } : f.look, { walk: f.walk, punch: f.st === "wind" ? f.t / .42 : 0, fall: f.st === "tired" ? 0 : 0, big: false, outfit: "jersey" }, s * (f.k === "sly" ? 1.25 : 1)); if (f.st === "tired") { for (var q = 0; q < 3; q++) G.star(x, px + Math.cos(t * 5 + q * 2.1) * r * 1.6, py - r * 1.6 + Math.sin(t * 5 + q * 2.1) * 4, 4); } }
    else if (f.k === "shade") { x.globalAlpha = f.frozen > 0 ? .95 : .82; x.fillStyle = f.flash > 0 ? "#fff" : f.frozen > 0 ? "#6d5bd0" : "#140a2e"; x.beginPath(); for (var a = 0; a < TAU; a += .5) { var rr = r * (1.25 + Math.sin(a * 3 + t * 6 + f.x) * .22); x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.closePath(); x.fill(); x.globalAlpha = 1; x.fillStyle = "#f0abfc"; x.beginPath(); x.arc(px - r * .35, py - r * .2, r * .16, 0, TAU); x.arc(px + r * .35, py - r * .2, r * .16, 0, TAU); x.fill(); if (f.st === "wind") { x.strokeStyle = "#ef4444"; x.lineWidth = 2; x.beginPath(); x.arc(px, py, r * (1.4 + f.t), 0, TAU); x.stroke(); } }
    else if (f.k === "leviathan") { x.strokeStyle = f.flash > 0 ? "#fff" : "#0e7490"; x.lineWidth = r * .9; x.lineCap = "round"; x.beginPath(); for (var k = 0; k < 9; k++) { var ex = px - Math.cos(f.a) * k * r * .6 + Math.sin(t * 4 + k * .8) * r * .5 * Math.sin(f.a), ey = py - Math.sin(f.a) * k * r * .6 - Math.sin(t * 4 + k * .8) * r * .5 * Math.cos(f.a); if (k) x.lineTo(ex, ey); else x.moveTo(ex, ey); } x.stroke(); x.strokeStyle = "#67e8f9"; x.lineWidth = r * .2; x.stroke(); x.fillStyle = "#fde047"; x.beginPath(); x.arc(px + Math.cos(f.a + .5) * r * .4, py + Math.sin(f.a + .5) * r * .4, r * .16, 0, TAU); x.arc(px + Math.cos(f.a - .5) * r * .4, py + Math.sin(f.a - .5) * r * .4, r * .16, 0, TAU); x.fill(); }
    else { x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(px + 3, py + 4, r * 1.3, r, 0, 0, TAU); x.fill(); x.fillStyle = f.flash > 0 ? "#fff" : "#3d1f5c"; x.beginPath(); x.arc(px, py, r * 1.5, 0, TAU); x.fill(); x.fillStyle = "#2a1f3d"; x.beginPath(); x.arc(px, py, r * 1.05, 0, TAU); x.fill(); x.fillStyle = "#120a1f"; x.beginPath(); x.arc(px, py, r * .7, 0, TAU); x.fill(); x.strokeStyle = "#ff3355"; x.lineWidth = 2; x.beginPath(); x.arc(px, py, r * .74, 0, TAU); x.stroke(); x.strokeStyle = "rgba(192,132,252,.5)"; x.beginPath(); x.arc(px, py, r * (2 + Math.sin(t * 5) * .3), 0, TAU); x.stroke(); }
    if (f.def.boss || f.hp < f.max) { var w = f.def.boss ? 0 : 30; if (w) { x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(px - w / 2, py - r - 16, w, 4); x.fillStyle = "#f87171"; x.fillRect(px - w / 2, py - r - 16, w * Math.max(0, f.hp / f.max), 4); } }
  }
  function bubble(x, px, py, text, a) {
    x.font = "600 13px system-ui, sans-serif"; var w = Math.min(260, x.measureText(text).width + 18), lines = wrap(x, text, 244), h = lines.length * 16 + 10; px = S.clamp(px, w / 2 + 6, 954 - w / 2); py = Math.max(h + 12, py);
    x.globalAlpha = Math.max(0, a); x.fillStyle = "rgba(255,255,255,.96)"; G.rr(x, px - w / 2, py - h - 8, w, h, 9); x.fill(); x.beginPath(); x.moveTo(px - 6, py - 9); x.lineTo(px, py); x.lineTo(px + 6, py - 9); x.fill(); x.fillStyle = "#0f172a"; x.textAlign = "center"; lines.forEach(function (l, i) { x.fillText(l, px, py - h + 9 + i * 16); }); x.globalAlpha = 1;
  }
  function wrap(x, text, w) { var words = text.split(" "), lines = [], cur = ""; words.forEach(function (wd) { if (x.measureText(cur + " " + wd).width > w && cur) { lines.push(cur); cur = wd; } else cur = cur ? cur + " " + wd : wd; }); if (cur) lines.push(cur); return lines; }
  Z.wrap = wrap;
  function bar(x, bx, by, w, v, col, label) { x.fillStyle = "rgba(0,0,0,.55)"; G.rr(x, bx, by, w, 12, 6); x.fill(); x.fillStyle = col; G.rr(x, bx + 2, by + 2, Math.max(4, (w - 4) * S.clamp(v, 0, 1)), 8, 4); x.fill(); x.font = "800 9px system-ui, sans-serif"; x.textAlign = "left"; x.fillStyle = "#fff"; x.fillText(label, bx + 6, by + 9.5); }
  function marks() {
    var m = [], st = Z.step(); Z.placeList.forEach(function (p) { if (p.role) m.push(Z.bigmap && Z.bigmap.mark ? Z.bigmap.mark(p) : { x: p.mx, y: p.my, col: p.role === "food" ? "#fb923c" : p.role === "home" ? (p.id === P.home ? "#2563eb" : "#93c5fd") : p.role === "class" ? "#a78bfa" : p.role === "heal" ? "#f87171" : "#4ade80", sq: p.role === "home" }); });
    if (P.flags.mappa) Z.tokens.forEach(function (t, i) { if (!P.tokens[i]) m.push({ x: t.x, y: t.y, col: "#7c2d12", r: 2.5 }); });
    Z.foes.forEach(function (f) { m.push({ x: f.x, y: f.y, col: f.def.boss ? "#ef4444" : "#7c3aed", r: f.def.boss ? 5 : 2.5 }); });
    Z.guards.forEach(function (g) { m.push({ x: g.x, y: g.y, col: "#1d4ed8", r: 4 }); }); if (Z.city) Z.city.marks(m); var sc = P.sec; if (sc && sc.state === "search") m.push({ x: sc.lx, y: sc.ly, col: "#60a5fa", ring: 8 + 30 * (1 - Math.min(1, (sc.srch || 0) / S.RULES.search)) });
    Object.keys(Z.net.peers).forEach(function (id) { var r = Z.net.peers[id]; if (r.x != null) m.push({ x: r.x, y: r.y, col: "#22d3ee", r: 4.5, pin: true }); });
    Z.npcs.forEach(function (n) { if (n.follow) m.push({ x: n.x, y: n.y, col: "#f9a8d4", r: 4 }); });
    if (Z.race) { var g = Z.race.gates[Z.race.gate]; m.push({ x: g.x, y: g.y, star: true, pin: true }); Z.race.ai.forEach(function (o) { m.push({ x: o.x, y: o.y, col: o.col, r: 4 }); }); }
    if (Z.life) Z.life.marks(m);
    var tg = Z.objective().target; if (tg) m.push({ x: tg.x, y: tg.y, star: true, pin: true }); void st;
    return m;
  }
  function hud(x, t) {
    var st = Z.step(), m = Z.mission();
    bar(x, 14, 12, 150, P.hp / P.maxHp, "#ef4444", "HEALTH"); bar(x, 14, 28, 150, P.hunger / 100, P.hunger < 25 ? (Math.floor(t * 4) % 2 ? "#fb923c" : "#fed7aa") : "#fb923c", "FOOD"); bar(x, 14, 44, 150, P.energy / 100, P.energy < 20 ? (Math.floor(t * 4) % 2 ? "#38bdf8" : "#bae6fd") : "#38bdf8", "ENERGY");
    var l0 = S.xpForLevel(P.lvl), l1 = S.xpForLevel(P.lvl + 1); bar(x, 14, 60, 150, (P.xp - l0) / (l1 - l0), "#fde047", "LEVEL " + P.lvl + " · " + S.title(P.lvl).toUpperCase());
    x.font = "800 18px system-ui, sans-serif"; x.textAlign = "left"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.7)"; var cash = "₦" + Math.floor(P.money).toLocaleString(); x.strokeText(cash, 14, 96); x.fillStyle = "#86efac"; x.fillText(cash, 14, 96);
    var sec = P.sec; if (sec && (sec.heat > 1 || sec.warns || sec.state)) { // the eye: how much security has noticed you
      var hk = Math.min(1, sec.heat / 100), hc = sec.state === "chase" ? "#ef4444" : sec.state === "search" ? "#60a5fa" : hk < .36 ? "#86efac" : hk < .72 ? "#fbbf24" : "#f87171", ex = 28, ey = 114, pulse = sec.state === "chase" ? 1 + Math.sin(t * 9) * .12 : 1;
      x.save(); x.lineWidth = 3; x.strokeStyle = "rgba(4,12,20,.75)"; x.beginPath(); x.arc(ex, ey, 12, 0, TAU); x.stroke(); x.fillStyle = "rgba(4,12,20,.6)"; x.fill(); x.strokeStyle = hc; x.beginPath(); x.arc(ex, ey, 12, -Math.PI / 2, -Math.PI / 2 + TAU * (sec.state ? 1 : hk)); x.stroke();
      x.fillStyle = hc; x.beginPath(); x.ellipse(ex, ey, 7.5 * pulse, 4.4 * pulse, 0, 0, TAU); x.fill(); x.fillStyle = "#04121a"; x.beginPath(); x.arc(ex, ey, 2.4 * pulse, 0, TAU); x.fill();
      var lab = sec.state === "chase" ? "SECURITY! Get out of sight" : sec.state === "search" ? "Searching… stay hidden " + Math.max(0, Math.ceil(S.RULES.search - (sec.srch || 0))) + "s" : sec.warns ? "Warning " + sec.warns + " of " + S.RULES.warnings : ""; if (lab) { x.font = "800 12px system-ui, sans-serif"; x.textAlign = "left"; x.lineWidth = 3; x.strokeStyle = "rgba(4,12,20,.8)"; x.strokeText(lab, ex + 18, ey + 4); x.fillStyle = hc; x.fillText(lab, ex + 18, ey + 4); } x.restore(); }
    if (me.boost > 0 || me.shield > 0 || P.god) { x.font = "700 11px system-ui, sans-serif"; x.fillStyle = "#fde047"; x.fillText((P.god ? "ODESHI  " : "") + (me.boost > 0 ? "SPEED " + Math.ceil(me.boost) + "s  " : "") + (me.shield > 0 ? "SHIELD " + Math.ceil(me.shield) + "s" : ""), 14, 134); }
    // clock
    x.textAlign = "center"; x.font = "800 15px system-ui, sans-serif"; var ck = "Day " + P.day + "  " + S.clock(P) + (Z.blackout ? "  ⚡ NO LIGHT" : ""); x.lineWidth = 4; x.strokeText(ck, 480, 22); x.fillStyle = Z.blackout ? "#f0abfc" : "#fff"; x.fillText(ck, 480, 22);
    // objective
    var obj = Z.race ? Z.race.name + " · gate " + (Z.race.gate + 1) + "/" + Z.race.gates.length + " · " + Math.max(0, Z.race.t).toFixed(1) + " s" : P.job ? S.jobText(P.job) + (P.job.limit && P.job.stage ? "  (" + Math.max(0, Math.ceil(P.job.limit - P.job.time)) + " s)" : "") : Z.date && Z.date.spot ? "Take " + Z.date.npc.def.name + " to " + Z.place(Z.date.spot).name : st ? Z.objText(st) + (st.n > 1 ? "  (" + P.m.n + "/" + st.n + ")" : "") : "Free roam: classes, jobs, races, friends. Phone (Q) for goals.";
    x.font = "700 14px system-ui, sans-serif"; var ow = Math.min(560, x.measureText(obj).width + 28); x.fillStyle = "rgba(4,12,20,.72)"; G.rr(x, 480 - ow / 2, 32, ow, 26, 13); x.fill(); x.fillStyle = Z.race ? "#fde047" : P.job ? "#86efac" : "#fef9c3"; x.fillText(obj.length > 74 ? obj.slice(0, 72) + "…" : obj, 480, 50);
    if (m && !Z.race && !P.job) { x.font = "600 10px system-ui, sans-serif"; x.fillStyle = "rgba(255,255,255,.75)"; x.strokeText(m.title.toUpperCase(), 480, 70); x.fillText(m.title.toUpperCase(), 480, 70); }
    // boss bar
    var boss = Z.foes.filter(function (f) { return f.def.boss; })[0]; if (boss) { x.fillStyle = "rgba(0,0,0,.6)"; G.rr(x, 280, 500, 400, 16, 8); x.fill(); x.fillStyle = "#ef4444"; G.rr(x, 283, 503, 394 * Math.max(.01, boss.hp / boss.max), 10, 5); x.fill(); x.font = "800 12px system-ui, sans-serif"; x.fillStyle = "#fff"; x.strokeText(boss.def.name.toUpperCase(), 480, 495); x.fillText(boss.def.name.toUpperCase(), 480, 495); }
    // speedo
    if (me.veh && (!Z.opt || Z.opt("hudSpeed", true))) { var mph = Z.opt && Z.opt("units", "kmh") === "mph", kmh = Math.round(Math.abs(me.veh.speed) * (mph ? 2.237 : 3.6)); x.textAlign = "right"; x.font = "900 30px system-ui, sans-serif"; x.strokeText(kmh, 930, 500); x.fillStyle = "#fff"; x.fillText(kmh, 930, 500); x.font = "700 11px system-ui, sans-serif"; x.strokeText((mph ? "mph · " : "km/h · ") + S.VEH[me.veh.type].name + (me.alt > .05 ? " · airborne" : ""), 930, 516); x.fillText((mph ? "mph · " : "km/h · ") + S.VEH[me.veh.type].name + (me.alt > .05 ? " · airborne" : ""), 930, 516); if (me.veh.type !== "skate") { x.fillStyle = "#fde68a"; x.fillText("♪ " + D.RADIO[radio].name, 930, 530); } }
    // minimap
    var r3 = Z.r3 && Z.r3.ready, mR = r3 ? 78 : 66, mY = r3 ? 96 : 84; if (!Z.opt || Z.opt("hudMap", true)) G.minimap(x, 868, mY, mR, me, marks(), Z.route, me.alt > .05 ? 420 : me.veh ? 260 : 170, r3 && (!Z.opt || Z.opt("mapRot", true)) ? Z.r3.yaw : null);
    var tgd = Z.race ? Z.race.gates[Z.race.gate] : Z.objective().target; if (tgd && (!Z.opt || Z.opt("hudGoal", true))) { var dd = Math.hypot(tgd.x - me.x, tgd.y - me.y), dtx = dd >= 1000 ? (dd / 1000).toFixed(1) + " km" : Math.round(dd / 5) * 5 + " m"; x.font = "800 13px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText((tgd.name ? tgd.name + " · " : "") + dtx, 868, mY + mR + 18); x.fillStyle = "#fde047"; x.fillText((tgd.name ? tgd.name + " · " : "") + dtx, 868, mY + mR + 18); }
    if (Z.quest) { x.font = "700 10px system-ui, sans-serif"; x.textAlign = "center"; x.fillStyle = "#fde047"; x.fillText(dist(Z.quest, me) < 45 ? "It is close. Look for the gold gem." : "", 868, 210); }
    if (Z.net.on) { x.font = "700 11px system-ui, sans-serif"; x.textAlign = "right"; x.fillStyle = Z.net.err ? "#fca5a5" : "#67e8f9"; x.strokeText("Room " + Z.net.code + " · " + (Object.keys(Z.net.peers).length + 1) + "/6", 946, 226); x.fillText("Room " + Z.net.code + " · " + (Object.keys(Z.net.peers).length + 1) + "/6", 946, 226); }
    // prompt
    var pr = Z.prompt(); if (pr) { x.font = "700 14px system-ui, sans-serif"; x.textAlign = "center"; var pw = x.measureText(pr).width + 60; x.fillStyle = "rgba(4,12,20,.8)"; G.rr(x, 480 - pw / 2, 440, pw, 30, 15); x.fill(); x.fillStyle = "#22d3ee"; G.rr(x, 480 - pw / 2 + 5, 445, 30, 20, 6); x.fill(); x.fillStyle = "#04140d"; x.fillText(api.keyName("act").split(" ")[0], 480 - pw / 2 + 20, 460); x.fillStyle = "#fff"; x.fillText(pr, 480 + 16, 460); }
    // subtitle
    if (subtitle && (!Z.opt || Z.opt("subs", true))) { var who = subtitle.who ? (Z.npc(subtitle.who) || {}).def : null; x.font = "600 " + Math.round(15 * (Z.opt ? Z.opt("subSize", 1) : 1)) + "px system-ui, sans-serif"; var lines = wrap(x, subtitle.text, 620), h = lines.length * 20 + (who ? 34 : 18), sy = 428 - h, al = Math.min(1, subtitle.t * 5, (subtitle.dur - subtitle.t) * 3); x.globalAlpha = Math.max(0, al); x.fillStyle = "rgba(4,12,20,.86)"; G.rr(x, 140, sy, 680, h, 14); x.fill(); x.textAlign = "left";
      if (who) { x.save(); x.beginPath(); x.arc(176, sy + h / 2, 24, 0, TAU); x.fillStyle = "#1e293b"; x.fill(); x.clip(); G.face(x, who, 176, sy + h / 2 - 2, 15); x.restore(); x.font = "800 12px system-ui, sans-serif"; x.fillStyle = "#fde047"; x.fillText(who.name.toUpperCase(), 212, sy + 20); }
      x.font = "600 15px system-ui, sans-serif"; x.fillStyle = "#fff"; lines.forEach(function (l, i) { x.fillText(l, who ? 212 : 160, sy + (who ? 40 : 24) + i * 20); }); x.globalAlpha = 1; }
    if (Z.brawl) Z.brawl.draw(x);
    if (Z.jobs) Z.jobs.draw(x);
    if (Z.momentDraw) Z.momentDraw(x); if (Z.intro && Z.intro.on) Z.intro.draw(x);
    if (Z.guide) Z.guide.draw(x, t);
  }
  function drawBig(x, t) {
    var labels = Z.placeList.map(function (p) { return { x: p.mx, y: p.my, name: p.name + (Z.interior && Z.interior.closed && Z.interior.closed(p) ? " (closed)" : "") }; }); big.tf = G.bigmap(x, me, marks(), Z.route, labels);
    x.font = "800 18px system-ui, sans-serif"; x.textAlign = "left"; x.fillStyle = "#fff"; x.fillText((Z.resolveText || String)("{{GAME_NAME}}"), 16, 28); x.font = "600 12px system-ui, sans-serif"; x.fillStyle = "rgba(255,255,255,.8)"; x.fillText("Tap a place to set a waypoint · " + api.keyName("map") + " to close · Kola nuts " + P.stats.tokens + "/" + S.TOKEN_COUNT, 16, 46); x.textAlign = "right"; x.fillText("A game by " + D.CREATOR.short, 944, 530); void t;
  }
  Z.bigOpen = function () { return !!big; };
  Z.bigSet = function (v) { big = v ? big || {} : null; }; Z.reroute = function () { routeT = 0; }; // the full map (samaru-map.js) closes itself and asks for a fresh GPS line
  Z.click = function (px, py) {
    if (Z.intro && Z.intro.on && Z.intro.click(px, py)) return;
    if (Z.momentClick && Z.momentClick(px, py)) return;
    if (window.FSLGCoop && FSLGCoop.click(px, py)) return;
    if (Z.jobs && Z.jobs.click(px, py)) return;
    if (!big || !big.tf) return; var wxp = (px - big.tf.ox) / big.tf.k, wyp = (py - big.tf.oy) / big.tf.k, best = null, bd = 60;
    Z.placeList.forEach(function (p) { var d = Math.hypot(p.mx - wxp, p.my - wyp); if (d < bd) { bd = d; best = p; } });
    Z.waypoint = best ? { x: best.mx, y: best.my, name: best.name } : { x: wxp, y: wyp, name: "Waypoint" }; routeT = 0; api.sound.sfx("click"); Z.toast("Waypoint: <b>" + Z.waypoint.name + "</b>"); big = null;
  };
})();
