/* Freshers School Life — the parts of the sound that only this game needs. The shared sample player is
   arcade-audio.js (Arcade.Audio); the recordings and their licences are in static/audio/sfx/.
   Here: an engine loop per vehicle type steered by speed, tyre screech and brake squeal, wind, the engines of nearby
   traffic, footsteps by surface, landings and falls, doors, horns per vehicle, the security siren during a chase,
   and day, night, water and indoor ambience. Everything hangs off one tick that runs after the game's own update,
   so the game code is not touched; without Arcade.Audio (the Node tests) every function here does nothing. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim; if (!Z) return;
  var A = Z.audio = { on: false, amb: false, engines: false, hint: "", stepD: 0, wasZ: 0, wasFall: 0, eng: null, engType: "", wind: null, siren: null, near: {}, loops: {}, prevSp: 0, scr: null, t: 0 };
  var ENG = { car: "eng_car", sport: "eng_sport", okada: "eng_okada", scooter: "eng_scooter", keke: "eng_keke", plane: "eng_plane", bike: "bike_tick", skate: "skate_roll", taxi: "eng_car", pickup: "eng_car", bus: "eng_car" };
  var HORN = { car: "horn_car", sport: "horn_sport", okada: "horn_okada", scooter: "horn_scooter", keke: "horn_keke", bike: "horn_bike", skate: "horn_skate", plane: "horn_bus", bus: "horn_bus" };
  function X() { var a = window.Arcade && window.Arcade.Audio; return a && a.man ? a : null; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function playing() { return Z.mode === "play" && Z.api && !Z.api.overlayOpen(); }

  /* ---- surface under the feet ---- */
  A.surface = function (x, y) {
    if (Z.inside) return "step_floor"; var W = Z.W; if (!W || !S) return "step_road";
    try { if (S.onRoad(W, x, y)) return "step_road"; var a = S.areaAt ? S.areaAt(W, x, y) : null, k = a ? String(a.k || a.kind || a.t || "") : "";
      if (/pier|wood|deck|bridge/.test(k)) return "step_wood"; if (/court|plaza|pav|yard|strip|runway/.test(k)) return "step_road"; } catch (e) {}
    return "step_grass";
  };

  /* ---- sound names changed by what is going on (a kick is not a punch; a car hitting a wall is not a fist) ---- */
  function remap(n) {
    var me = Z.me;
    if (n === "hit" || n === "heavy") { if (A.hint === "kick") return "kick"; if (A.hint === "car" || A.hint === "ped") return "hit_person"; if (me && me.veh && !A.hint) return ""; }
    return n;
  }
  function hookSfx() {
    var snd = Z.api && Z.api.sound; if (!snd || A.hooked || !snd.sfx) return; A.hooked = true; var base = snd.sfx;
    snd.sfx = function (n, o) { var m = X() ? remap(n) : n; if (m === "") return; return base.call(this, m, o); };
    for (var k in base) snd.sfx[k] = base[k];
  }
  function wrap(obj, name, before, after) { if (!obj || typeof obj[name] !== "function" || obj[name]._snd) return; var f = obj[name]; obj[name] = function () { var r; if (before) { try { before.apply(this, arguments); } catch (e) {} } r = f.apply(this, arguments); if (after) { try { after.apply(this, [r].concat([].slice.call(arguments))); } catch (e) {} } return r; }; obj[name]._snd = 1; }
  function one(name, o) { var x = X(); return x ? x.play(name, o) : false; }

  function hooks() {
    if (A.wired) return; A.wired = true;
    wrap(Z.fx, "hit", function (o, ang, heavy, kind) { A.hint = kind === "kick" || kind === "car" || kind === "ped" ? kind : "punch"; }, function () { A.hint = ""; });
    wrap(Z.fx, "crash", null, function (r, x, y, nx, ny, imp) { if (Z.veh && Z.veh.crashSounds) return; /* samaru-veh.js plays crashes by material */ var o = { x: x, y: y, ref: 22 }; if (imp > 11) { one("crash_heavy", o); one("crash_metal", o); if (imp > 16) one("glass", { x: x, y: y, ref: 22, delay: .06 }); } else if (imp > 5) one("crash_light", o); else one("kerb", { x: x, y: y, ref: 22, gain: .7 }); });
    wrap(Z, "enter", null, function (r, v) { var me = Z.me; if (!me || !me.veh) return; var t = me.veh.type, x = X(); if (!x) return; x.preload([ENG[t], HORN[t], "wind", "handbrake"]);
      if (t === "car" || t === "sport" || t === "keke") { if (!me.quickIn) one("car_door_open"); one("car_door_close", { delay: me.quickIn ? .1 : .65 }); one("car_start", { delay: me.quickIn ? .2 : .8, rate: t === "keke" ? 1.25 : 1 }); }
      else if (t === "okada" || t === "scooter") one("car_start", { rate: 1.5, gain: .7 }); else if (t === "skate") one("guard", { gain: .5 }); else one("getup", { gain: .7 }); });
    wrap(Z, "exit", function () { var me = Z.me; A.leftType = me && me.veh ? me.veh.type : ""; }, function () { var t = A.leftType; if (!t || (Z.me && Z.me.veh)) return; if (t === "car" || t === "sport" || t === "keke") { one("car_off", { rate: t === "keke" ? 1.25 : 1 }); one("car_door_open", { delay: .15 }); one("car_door_close", { delay: .6 }); } else if (t === "okada" || t === "scooter") one("car_off", { rate: 1.5, gain: .6 }); });
    wrap(Z.interior, "enter", null, function (r) { if (r) { one("door_open"); one("door_close", { delay: .55 }); } });
    wrap(Z.interior, "exit", null, function (r) { if (r !== false) { one("door_open"); one("door_close", { delay: .55 }); } });
    wrap(Z, "emit", function (ev) { if (!ev) return; if (ev.t === "find") one("pickup"); else if (ev.t === "buy") one("till"); else if (ev.t === "class") one("class_bell", { gain: .6 }); });
  }

  /* ---- a horn for each machine (the game falls back to its beep while the file is still loading) ---- */
  A.horn = function (v) { var x = X(); if (!x || !v) return false; var n = HORN[v.type] || "horn_car"; if (!x.has(n)) return false; var h = loopFor("horn", n, { bus: "vehicles" }); if (h) { h.set(1, 1); A.hornOn = true; return true; } return x.play(n, { gain: 1 }); }; // sounds for as long as it is held (stopped in vehicles())

  /* ---- screech and squeal: no clean-licence recording was found, so these two are shaped noise ---- */
  function noiseBed(x) {
    if (A.scr || !Z.api.sound.ac) return A.scr; var ac = Z.api.sound.ac;
    try { var len = ac.sampleRate, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0), i; for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ac.createBufferSource(); src.buffer = buf; src.loop = true; var out = x.bus.vehicles || x.out;
      var mk = function (type, f, q) { var fl = ac.createBiquadFilter(), g = ac.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(out); return { f: fl, g: g }; };
      A.scr = { tyre: mk("bandpass", 1700, 9), tyre2: mk("bandpass", 2350, 14), brake: mk("bandpass", 3100, 22), dirt: mk("lowpass", 650, .7) }; src.start(); } catch (e) { A.scr = null; }
    return A.scr;
  }
  function setG(n, v, t) { try { n.g.gain.setTargetAtTime(v, t, .05); } catch (e) {} }

  function loopFor(key, name, o) { var x = X(), h = A.loops[key]; if (h && h.alive && h.name === name) return h; if (h && h.alive) h.stop(.15); A.loops[key] = h = x.loop(name, o) || null; return h; }
  function stopLoop(key, fade) { var h = A.loops[key]; if (h && h.alive) h.stop(fade || .25); A.loops[key] = null; }

  function vehicles(dt, x) {
    var me = Z.me, v = me.veh, ac = Z.api.sound.ac, t = ac.currentTime, bed = noiseBed(x), on = playing() && v;
    A.engines = true;
    if (!on) { stopLoop("eng", .3); stopLoop("wind", .4); if (A.hornOn) { A.hornOn = false; stopLoop("horn", .06); } if (bed) { setG(bed.tyre, 0, t); setG(bed.tyre2, 0, t); setG(bed.brake, 0, t); setG(bed.dirt, 0, t); } A.prevSp = 0; return; }
    var spec = S.VEH[v.type] || { max: 20 }, sp = Math.abs(v.speed || 0), k = clamp(sp / (spec.max || 20), 0, 1.3), th = Math.abs(v.th == null ? ((Z.api.down("up") ? 1 : 0) - (Z.api.down("down") ? 1 : 0)) : v.th), name = ENG[v.type] || "eng_car", h = loopFor("eng", name, { bus: "vehicles" });
    A.load = (A.load || 0) + ((th > 0 ? 1 : 0) - (A.load || 0)) * Math.min(1, dt * 5); // throttle eases in so the note does not jump
    if (h) {
      if (v.type === "bike") h.set(clamp(sp / 5, 0, 1) * (v.sprint ? 1 : .8), .7 + k * 1.1);
      else if (v.type === "skate") h.set(clamp(sp / 4, 0, 1) * (me.alt > .1 || me.z > .1 ? 0 : 1), .7 + k * .8);
      else if (v.type === "plane") h.set(.55 + .45 * A.load + k * .2, .7 + k * .75 + A.load * .12);
      else h.set(.45 + .4 * A.load + k * .25, (v.type === "sport" ? .62 : .7) + k * (v.type === "sport" ? 1.25 : 1) + A.load * .1);
    }
    var fast = v.type === "plane" ? sp > 14 : sp > 16; if (fast) { var w = loopFor("wind", "wind", { bus: "vehicles" }); if (w) w.set(clamp((sp - 12) / (v.type === "plane" ? 40 : 30), 0, 1) * .8, .8 + k * .4); } else stopLoop("wind", .6);
    if (bed) { // tyres let go on the handbrake or in a slide; the foot brake squeals when it is stamped on at speed
      var slide = Math.abs(v.slide || 0), grounded = !(me.alt > .05), road = A.surface(v.x, v.y) === "step_road", scr = grounded && v.type !== "plane" && (v.lock || slide > 2.4) ? clamp((slide - 1) / 7 + (v.lock ? .35 : 0), 0, 1) : 0, light = v.type === "bike" || v.type === "skate" ? .45 : 1;
      var dec = (A.prevSp - sp) / Math.max(dt, .001), brk = grounded && !v.lock && dec > 9 && sp > 6 && v.type !== "plane" ? clamp((dec - 9) / 14, 0, 1) : 0;
      setG(bed.tyre, road ? scr * .11 * light : 0, t); setG(bed.tyre2, road ? scr * .07 * light : 0, t); setG(bed.dirt, road ? 0 : scr * .2, t); setG(bed.brake, road ? brk * .035 * light : 0, t);
      try { bed.tyre.f.frequency.setTargetAtTime(1500 + sp * 22, t, .08); bed.tyre2.f.frequency.setTargetAtTime(2150 + sp * 26, t, .08); } catch (e) {}
      if (v.lock && !A.wasLock) one("handbrake", { gain: .6 }); A.wasLock = !!v.lock;
    }
    if (A.hornOn && !Z.api.down("horn")) { A.hornOn = false; stopLoop("horn", .06); }
    A.prevSp = sp;
  }

  function traffic(x) { // the three nearest moving vehicles get a quiet engine of their own, placed in the world
    var me = Z.me, cars = Z.cars || [], best = [], i, c, d, keep = {};
    if (playing() && !Z.inside) for (i = 0; i < cars.length; i++) { c = cars[i]; if (c === me.veh || !(Math.abs(c.speed || 0) > 1.5)) continue; d = Math.hypot(c.x - me.x, c.y - me.y); if (d < 70) best.push({ c: c, d: d }); }
    best.sort(function (a, b) { return a.d - b.d; }); best = best.slice(0, 3);
    for (i = 0; i < best.length; i++) { c = best[i].c; var key = "t" + (c.id == null ? i : c.id), nm = ENG[c.type] || "eng_car", h = A.near[key]; keep[key] = 1;
      if (!h || !h.alive) h = A.near[key] = x.loop(nm, { bus: "vehicles", pos: 1 }); if (!h) continue;
      var rvx = (c.vx || 0) - (me.veh ? me.veh.vx || 0 : 0), rvy = (c.vy || 0) - (me.veh ? me.veh.vy || 0 : 0), dx = me.x - c.x, dy = me.y - c.y, dl = Math.max(1, best[i].d), toward = (rvx * dx + rvy * dy) / dl;
      h.set(.5, (.75 + Math.abs(c.speed || 0) / 28) * (1 + clamp(toward / 120, -.12, .12)), { x: c.x, y: c.y, ref: 9, max: 75 }); }
    for (var k in A.near) if (!keep[k] && A.near[k]) { if (A.near[k].alive) A.near[k].stop(.4); delete A.near[k]; }
  }

  function feet(dt, x) {
    var me = Z.me; if (!playing() || me.veh) { A.stepD = 0; A.wasZ = 0; return; }
    var sp = me.cs != null ? Math.abs(me.cs) : Math.abs(me.speed || 0), air = (me.z || 0) > .05, run = S && S.FOOT ? sp > (S.FOOT.walk + S.FOOT.run) / 2 : sp > 6;
    if (Z.anim && Z.anim.on && !A.stepHook) { A.stepHook = 1; A.stepQ = 0; Z.anim.on("step", function (e) { if (e.o === Z.me) { A.stepQ = Math.min(2, A.stepQ + 1); A.stepRun = !!e.run; } }); } /* footfalls come from the animation (heel strike), not a distance timer */
    if (A.stepHook) { if (!air && !me.fall && !me.sit && sp > .6) for (; A.stepQ > 0; A.stepQ--) x.play(A.surface(me.x, me.y), { gain: A.stepRun ? 1 : .6, rate: A.stepRun ? 1.06 : 1 }); A.stepQ = 0; }
    else if (!air && !me.fall && !me.sit && sp > .6) { A.stepD += sp * dt; var stride = run ? 1.45 : .82; if (A.stepD >= stride) { A.stepD -= stride; x.play(A.surface(me.x, me.y), { gain: run ? 1 : .6, rate: run ? 1.06 : 1 }); } }
    if (A.wasZ > .25 && !air) x.play("land", { gain: clamp(A.wasZ / 1.2, .4, 1) }); A.wasZ = air ? Math.max(A.wasZ, me.z) : 0;
    var f = me.fall > 0 ? 1 : 0; if (f && !A.wasFall) x.play("fall"); else if (!f && A.wasFall) x.play("getup", { gain: .8 }); A.wasFall = f;
    if (Z.api.hit && Z.api.hit("attack")) x.play("whoosh", { gain: .55 });
  }

  function world(dt, x) {
    var me = Z.me, P = Z.P, sec = P && P.sec, st = playing() && sec ? sec.state : "", dk = S && S.darkness ? S.darkness(P.time) : 0, inside = Z.inside, quiet = !playing();
    if (st === "chase" || st === "search") { var s = loopFor("siren", "siren", { bus: "world" }); if (s) s.set(st === "chase" ? 1 : .4, 1); } else stopLoop("siren", .8);
    var veh = me.veh ? .35 : 1, day = quiet || inside ? 0 : clamp(1 - dk / .45, 0, 1) * veh, night = quiet || inside ? 0 : clamp((dk - .35) / .3, 0, 1) * veh * (Z.blackout ? 1.2 : 1);
    var df = Math.hypot(me.x, me.y + 300), dl = Math.max(0, Math.hypot(me.x, (me.y - 525) * 2) - 235), wat = quiet || inside ? 0 : clamp(1 - Math.min(df, dl * .8) / 55, 0, 1) * veh;
    var crowd = !quiet && inside && /lecture|canteen|social|hall|food/.test(String(inside.type || "")) ? 1 : 0, h, any = false;
    var set = function (key, name, g, rate) { if (g > .01) { h = loopFor(key, name, { bus: "ambience" }); if (h) { h.set(g, rate || 1); any = true; } } else stopLoop(key, 1.2); };
    set("birds", "amb_birds", day); set("crickets", "amb_crickets", night); set("water", "amb_water", wat, df < dl ? 1.15 : .8); set("crowd", "amb_crowd", crowd * .8);
    if (any) A.amb = true;
    if (Z.api.hit && Z.api.hit("phone")) x.play("phone_open");
  }

  A.tick = function (dt) {
    var x = X(); if (!x || !Z.api || !Z.api.sound || !Z.api.sound.ac || !Z.me || !Z.P) return;
    if (!A.on) { A.on = true; hookSfx(); hooks(); x.listener = function () { var m = Z.me; return m ? { x: m.x, y: m.y, yaw: Z.r3 ? Z.r3.yaw || 0 : 0 } : null; }; x.preload(["step_road", "step_grass", "land", "fall", "whoosh", "amb_birds", "amb_crickets"]); }
    A.last = Date.now();
    try { vehicles(dt, x); feet(dt, x); world(dt, x); A.t += dt; if (A.t > .12) { A.t = 0; traffic(x); } } catch (e) { if (!A.err) { A.err = e; if (window.console) console.warn("Game audio", e); } }
  };
  A.stopAll = function () { for (var k in A.loops) stopLoop(k, .2); for (var n in A.near) if (A.near[n] && A.near[n].alive) A.near[n].stop(.2); A.near = {}; };

  // If the game stops updating (paused, tab hidden, back at the title) nothing may keep droning.
  if (typeof setInterval === "function" && typeof document !== "undefined") setInterval(function () { if (A.on && A.last && Date.now() - A.last > 450) { A.last = 0; A.stopAll(); var b = A.scr, ac = Z.api && Z.api.sound && Z.api.sound.ac; if (b && ac) for (var k in b) setG(b[k], 0, ac.currentTime); } }, 300);
  // Run after the game's own update, and after the title/menu call that leaves play.
  if (typeof Z.update === "function" && !Z.update._snd) { var up = Z.update; Z.update = function (dt) { var r = up.apply(this, arguments); A.tick(dt); return r; }; Z.update._snd = 1; }
})();
