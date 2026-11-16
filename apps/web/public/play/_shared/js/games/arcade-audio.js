/* EE Hub Arcade — sampled sound effects for every game.
   Loaded after arcade.js. It wraps Arcade.Sound.sfx(name): when static/audio/sfx/manifest.json has a recorded sample
   for that name (a per-game pack first, then the shared core set) the sample plays, with a little random pitch and
   level so repeats do not sound mechanical; otherwise the original synthesized effect plays, exactly as before.
   Samples are CC0 recordings (see static/audio/sfx/CREDITS.md). To replace one, drop a file with the same name in
   static/audio/sfx/<folder>/ (both .ogg and .m4a). Nothing here runs in the Node test harnesses. */
(function () {
  "use strict";
  var A = window.Arcade, S = A && A.Sound; if (!S || typeof document === "undefined") return;
  var src = ""; try { src = (document.currentScript && document.currentScript.src) || ""; } catch (e) {}
  var stage = document.querySelector("[data-gm-stage]"), slug = stage ? (stage.getAttribute("data-gm-slug") || "") : "";
  var X = A.Audio = { base: src ? src.replace(/js\/games\/arcade-audio(\.[0-9a-f]{6,})?\.js.*$/, "audio/sfx/") : "", slug: slug, man: null, ready: false, buf: {}, bus: {}, live: 0, per: {}, last: {}, listener: null, extra: {} };
  var ext = "ogg"; try { var au = document.createElement("audio"); if (!au.canPlayType || !au.canPlayType('audio/ogg; codecs="opus"')) ext = "m4a"; } catch (e) { ext = "m4a"; }
  X.ext = ext;
  var GAP = { bounce: .09, hit: .05, click: .03, zap: .06, kick: .06, step: .04 }, BUSES = ["ui", "feet", "impacts", "vehicles", "world", "ambience"], MAXV = 26;

  function entry(name) { var m = X.man; if (X.extra[name]) return X.extra[name]; if (!m) return null; var p = m.packs && m.packs[slug]; return (p && p[name]) || (m.core && m.core[name]) || null; }
  function has0(name) { var e = entry(name); return !!(e && e.f && e.f.length); }
  X.entry = entry;

  /* ---------- the Sounds tab (static/js/games/arcade-sounds.js): on/off, volume and a replacement file for each sound.
     Order: switched off (silent) > the player's own file > a file a super admin set for everyone > the default recording >
     the built-in synthesised effect. Choices live in localStorage "ee-arcade-snd-<slug>"; files in IndexedDB. ---------- */
  var PKEY = "ee-arcade-snd-" + (slug || "arcade");
  X.prefs = {}; try { X.prefs = JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; } catch (e) { X.prefs = {}; }
  X.savePrefs = function () { try { localStorage.setItem(PKEY, JSON.stringify(X.prefs)); } catch (e) {} };
  X.ov = { personal: {}, global: {} }; X.raw = { personal: {}, global: {} }; X.forced = null; X.heard = {}; X.reg = {};
  X.route = function (name) {
    var f = X.forced, p = X.prefs[name], b;
    if (!f && p && p.off) return { how: "off" };
    if (!f || f === "personal") { b = X.ov.personal[name]; if (b && b !== 1) return { how: "personal", buf: b }; }
    if (!f || f === "global") { b = X.ov.global[name]; if (b && b !== 1) return { how: "global", buf: b }; }
    return { how: has0(name) ? "file" : "synth" };
  };
  X.gvol = {}; // MIB-Hub: per-sound volume staff set for everyone (admin sound manager; filled by arcade-sounds.js)
  X.vol = function (name) { var p = X.prefs[name], g = X.gvol[name]; g = g != null && isFinite(g) ? Math.max(0, Math.min(2, +g)) : 1; return (p && p.vol != null && isFinite(p.vol) ? Math.max(0, Math.min(2, +p.vol)) : 1) * g; };
  X.has = function (name) { return X.route(name).how !== "synth"; };
  function decodeOv(layer, name) {
    var ab = X.raw[layer][name]; if (!ab || !S.ac || X.ov[layer][name] === 1) return; X.ov[layer][name] = 1;
    try { var copy = ab.slice(0); new Promise(function (ok, no) { var q = S.ac.decodeAudioData(copy, ok, no); if (q && q.then) q.then(ok, no); })
      .then(function (bf) { if (X.raw[layer][name] === ab) X.ov[layer][name] = bf; else delete X.ov[layer][name]; if (X.onover) try { X.onover(layer, name); } catch (e) {} },
        function () { delete X.ov[layer][name]; }); } catch (e) { delete X.ov[layer][name]; }
  }
  /* layer "personal" or "global"; data an ArrayBuffer of an audio file (or an AudioBuffer already decoded), null removes it. */
  X.setOverride = function (layer, name, data) {
    if (!X.ov[layer] || !name) return; delete X.ov[layer][name]; delete X.raw[layer][name];
    if (!data) return; if (typeof AudioBuffer !== "undefined" && data instanceof AudioBuffer) { X.ov[layer][name] = data; return; }
    X.raw[layer][name] = data; if (S.ac) decodeOv(layer, name); else X.pend = true;
  };
  X.decodeAll = function () { if (!S.ac) return; X.pend = false; ["personal", "global"].forEach(function (l) { for (var n in X.raw[l]) if (!X.ov[l][n]) decodeOv(l, n); }); };

  function mixer() { // buses -> limiter -> the runtime's existing effects volume
    if (X.out || !S.ac || !S.fx) return !!X.out; var a = S.ac;
    try { var lim = a.createDynamicsCompressor(); lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = .003; lim.release.value = .18;
      X.out = a.createGain(); X.out.gain.value = 1; X.out.connect(lim); lim.connect(S.fx);
      BUSES.forEach(function (b) { var g = a.createGain(); g.gain.value = b === "ambience" ? .8 : 1; g.connect(X.out); X.bus[b] = g; }); } catch (e) { X.out = null; }
    return !!X.out;
  }
  function load(stem, cb) {
    var b = X.buf[stem]; if (b && b !== 1) { if (cb) cb(b); return; } if (b === 1 || !S.ac || !X.base) return; X.buf[stem] = 1;
    try { fetch(X.base + stem + "." + ext).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (ok, no) { try { var p = S.ac.decodeAudioData(ab, ok, no); if (p && p.then) p.then(ok, no); } catch (e) { no(e); } }); }).then(function (bf) { X.buf[stem] = bf; if (cb) cb(bf); }, function () { X.buf[stem] = 0; }); } catch (e) { X.buf[stem] = 0; }
  }
  X.preload = function (names) { if (!S.ac) return; (names || []).forEach(function (n) { var e = entry(n); if (e && e.f) e.f.forEach(function (s) { load(s); }); }); };
  function warm() { // after the first tap or key: fetch the small sounds this game will need at once
    if (X.pend && S.ac) X.decodeAll(); if (X.warmed || !X.man || !S.ac) return; X.warmed = true; mixer(); var m = X.man, k, names = [];
    for (k in (m.core || {})) if (!m.core[k].lazy) names.push(k); var p = m.packs && m.packs[slug]; if (p) for (k in p) if (!p[k].lazy || k === "_amb") names.push(k);
    X.preload(names);
    if (p && p._amb && !X.amb) { // a quiet background loop for this game (a stadium murmur, say), started once it has decoded
      var tries = 0, iv = setInterval(function () { if (X.amb || ++tries > 40) return clearInterval(iv); var h = X.loop("_amb", { bus: "ambience" }); if (h) { X.amb = h; h.set(1, 1); clearInterval(iv); } }, 500); }
  }
  function place(o) { // level and left/right from where the sound is in the world, when a game supplies a listener
    if (!o || !isFinite(o.x) || !isFinite(o.y) || !X.listener) return { g: 1, pan: 0 };
    var L = X.listener(); if (!L) return { g: 1, pan: 0 }; var dx = o.x - L.x, dy = o.y - L.y, d = Math.sqrt(dx * dx + dy * dy), ref = o.ref || 12;
    return { g: Math.max(0, 1 / (1 + Math.pow(d / ref, 1.7))) * (d > (o.max || 140) ? 0 : 1), pan: d < .6 ? 0 : Math.max(-1, Math.min(1, Math.sin(Math.atan2(dy, dx) - (L.yaw || 0)) * Math.min(1, d / 8))) };
  }
  function chain(e, o, pl) {
    var a = S.ac, g = a.createGain(), bus = X.bus[(o && o.bus) || e.bus || "world"] || X.out; g.gain.value = 0;
    if (a.createStereoPanner && pl.pan) { var pn = a.createStereoPanner(); pn.pan.value = pl.pan; g.connect(pn); pn.connect(bus); g._pan = pn; } else g.connect(bus);
    return g;
  }
  /* One shot. Returns true when a sample was started (so the synth must stay quiet). */
  X.play = function (name, o) {
    var r = X.route(name), e = entry(name), n, i = 0, bf; X.heard[name] = 1; if (r.how === "off") return true; // switched off: silent, synth too
    if (r.buf) { if (S.muted || !S.ac || !mixer()) return false; o = o || {}; e = { f: [""], g: 1, p: 0, bus: (e && e.bus) || o.bus, max: (e && e.max) || 4 }; bf = r.buf; }
    else {
    if (!e || !e.f || !e.f.length || S.muted || !S.ac || !mixer()) return false; o = o || {};
    n = e.f.length; i = Math.floor(Math.random() * n); if (n > 1 && i === X.last[name]) i = (i + 1) % n; bf = X.buf[e.f[i]];
    if (!bf || bf === 1) { // not decoded yet: try another variation that is, else let the synth cover this one
      for (var j = 0; j < n && (!bf || bf === 1); j++) { bf = X.buf[e.f[j]]; if (bf && bf !== 1) i = j; }
      if (!bf || bf === 1) { e.f.forEach(function (s) { load(s); }); return false; } }
    }
    var pl = place(o); if (pl.g < .012) return true; if (X.live >= MAXV || (X.per[name] || 0) >= (e.max || 4)) return true;
    X.last[name] = i; var a = S.ac, t = a.currentTime, s = a.createBufferSource(), g = chain(e, o, pl), pv = e.p == null ? .05 : e.p;
    s.buffer = bf; s.playbackRate.value = (o.rate || 1) * (r.buf ? 1 : e.r || 1) * (1 + (Math.random() * 2 - 1) * pv);
    g.gain.setValueAtTime((e.g == null ? 1 : e.g) * (o.gain == null ? 1 : o.gain) * X.vol(name) * pl.g * (r.buf ? 1 : .92 + Math.random() * .16), t); s.connect(g); X.lastSrc = s;
    X.live++; X.per[name] = (X.per[name] || 0) + 1; s.onended = function () { X.live--; X.per[name]--; try { g.disconnect(); if (g._pan) g._pan.disconnect(); } catch (er) {} };
    try { s.start(t + (o.delay || 0)); } catch (er) { X.live--; X.per[name]--; return false; } return true;
  };
  /* A loop a game steers every frame: handle.set(gain, rate, {x, y}) and handle.stop(). null until the file is decoded. */
  X.loop = function (name, o) {
    var r = X.route(name), e = entry(name), bf; X.heard[name] = 1;
    if (r.how === "off") return { name: name, alive: true, off: true, set: function () {}, stop: function () { this.alive = false; } }; // switched off: a silent handle
    if (r.buf) { if (!S.ac || !mixer()) return null; o = o || {}; e = { f: [""], g: 1, bus: (e && e.bus) || o.bus }; bf = r.buf; }
    else { if (!e || !e.f || !e.f.length || !S.ac || !mixer()) return null; o = o || {}; bf = X.buf[e.f[0]]; if (!bf || bf === 1) { load(e.f[0]); return null; } }
    var a = S.ac, s = a.createBufferSource(), g = chain(e, o, { pan: 0 }), base = (e.g == null ? 1 : e.g) * X.vol(name), pan = null, h;
    if (a.createStereoPanner && o.pos) { try { g.disconnect(); pan = a.createStereoPanner(); g.connect(pan); pan.connect(X.bus[o.bus || e.bus || "world"] || X.out); } catch (er) { pan = null; } }
    s.buffer = bf; s.loop = true; s.connect(g); try { s.start(a.currentTime, Math.random() * Math.max(0, bf.duration - .05)); } catch (er) { return null; }
    h = { name: name, alive: true, set: function (gain, rate, at) { if (!h.alive) return; var t = a.currentTime, pl = at ? place(at) : { g: 1, pan: 0 };
        g.gain.setTargetAtTime(S.muted ? 0 : Math.max(0, gain) * base * pl.g, t, .06); if (rate) s.playbackRate.setTargetAtTime(Math.max(.25, Math.min(3.5, rate * (e.r || 1))), t, .07); if (pan) pan.pan.setTargetAtTime(pl.pan, t, .08); },
      stop: function (fade) { if (!h.alive) return; h.alive = false; var t = a.currentTime; g.gain.setTargetAtTime(0, t, (fade || .12) / 3); try { s.stop(t + (fade || .12) + .05); } catch (er) {} setTimeout(function () { try { g.disconnect(); if (pan) pan.disconnect(); } catch (er) {} }, ((fade || .12) + .2) * 1000); } };
    return h;
  };
  /* Pull everything down for a moment (speech, a ceremony), then let it back up. */
  X.duck = function (to, secs) { if (!X.out || !S.ac) return; var t = S.ac.currentTime, g = X.out.gain; try { g.cancelScheduledValues(t); g.setTargetAtTime(to == null ? .45 : to, t, .05); g.setTargetAtTime(1, t + (secs || 1.2), .25); } catch (e) {} };
  /* A game adds or overrides names at run time: Sound.pack({ thud: ["mygame/thud_1", "mygame/thud_2"] }). */
  S.pack = X.pack = function (map) { for (var k in (map || {})) { var v = map[k]; X.extra[k] = Array.isArray(v) ? { f: v } : v; } if (S.ac) X.preload(Object.keys(map || {})); };

  var synth = S.sfx;
  // The synthesised effect, at this sound's own volume from the Sounds tab (the synth reads S.fx when it is called).
  function synthAt(name, o, fn, args) {
    var v = X.vol(name); fn = fn || synth; args = args || [name, o]; if (v === 1 || !S.fx || !S.ac) return fn.apply(S, args);
    var keep = S.fx, g = null; try { g = S.ac.createGain(); g.gain.value = v; g.connect(keep); S.fx = g; return fn.apply(S, args); }
    finally { S.fx = keep; if (g) setTimeout(function () { try { g.disconnect(); } catch (e) {} }, 6000); }
  }
  S.sfx = function (name, o) {
    if (this.muted || !this.ac) return; if (!X.warmed || X.pend) warm(); X.heard[name] = 1;
    var r = X.route(name); if (r.how === "off") return;
    var e = r.buf ? { f: [1] } : entry(name); if (!e || !e.f || !e.f.length) return synthAt(name, o);
    var t = this.ac.currentTime, lastT = X["t_" + name] || 0; if (t - lastT < (GAP[name] || 0)) return;
    if (X.play(name, o)) { X["t_" + name] = t; if (e.both) synthAt(name, o); return; } return synthAt(name, o);
  };
  S.sfx.synth = function (name, o) { return synth.call(S, name, o); };
  /* Sounds that are not sfx names get names too, so the Sounds tab can switch off or replace them:
     fanfare_* (result stings), crowd_cheer / crowd_groan, grunt_<kind> (fighters' voices), music (a game's tune), and
     voice:<id> for one spoken line (the id is the FSLG voice id of the line's text). */
  function special(name, o, fn, args) { // returns true when an override or "off" handled it
    X.heard[name] = 1; var r = X.route(name); if (r.how === "off") return true;
    if (r.buf) { if (S.muted || !S.ac) return true; mixer(); X.play(name, o || { bus: "world" }); return true; }
    if (fn) synthAt(name, null, fn, args); return false;
  }
  X.special = special;
  X.fanfareName = function (kind) { return /champion|gameComplete/.test(kind || "") ? "fanfare_champion" : /win|stageClear|newRecord/.test(kind || "") ? "fanfare_win" : kind === "draw" ? "fanfare_draw" : "fanfare_lose"; };
  function vnorm(t) { var s = String(t == null ? "" : t).toLowerCase(); try { s = s.normalize("NFKD"); } catch (e) {} return s.replace(/[^a-z0-9]+/g, " ").replace(/^ +| +$/g, ""); }
  X.voiceName = function (text) { var s = vnorm(text), h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return "voice:v" + ("0000000" + h.toString(16)).slice(-8) + s.length.toString(36); };
  X.lines = {}; // voice:<id> -> the words, for the Sounds tab
  /* A game names extra sounds for the Sounds tab: api.sound.register({ door_creak: { group: "world", desc: "Old door" } }). */
  S.register = X.register = function (map) { for (var k in (map || {})) X.reg[k] = typeof map[k] === "string" ? { desc: map[k] } : (map[k] || {}); };
  var SYNTH = ["kick", "bounce", "jump", "dash", "hit", "heavy", "block", "special", "zap", "laser", "boom", "coin", "stomp", "power", "goal", "win", "lose", "whistle", "click", "ko"];
  /* Every sound this page knows: the engine's names, this game's pack, the built-in synth effects, the named specials,
     spoken lines heard so far (and FSLG's known lines) and names the game registered. */
  X.registry = function () {
    var out = {}, m = X.man || {}, p = (m.packs && m.packs[slug]) || {}, k;
    function add(n, kind, extra) { if (!n || out[n]) return; var e = entry(n) || {}; out[n] = Object.assign({ name: n, kind: kind, bus: e.bus || "", file: has0(n), lazy: !!e.lazy,
      personal: !!(X.raw.personal[n] || X.ov.personal[n]), global: !!(X.raw.global[n] || X.ov.global[n]), off: !!(X.prefs[n] && X.prefs[n].off), vol: X.vol(n), pack: !!p[n], heard: !!X.heard[n] }, extra || {}); }
    for (k in p) add(k, k === "_amb" ? "loop" : "sfx"); for (k in (m.core || {})) add(k, "sfx"); for (k in X.extra) add(k, "sfx");
    SYNTH.forEach(function (n) { add(n, "sfx", { synth: true }); });
    add("music", "music"); ["fanfare_win", "fanfare_champion", "fanfare_draw", "fanfare_lose", "crowd_cheer", "crowd_groan"].forEach(function (n) { add(n, "special"); });
    ["jump", "kick", "shoot", "hurt", "ko", "power", "win", "sad", "effort", "laugh"].forEach(function (n) { add("grunt_" + n, "special"); });
    var Z = window.SamaruGame && window.SamaruGame.voice, said = {};
    if (Z) { try { var G = Z.GUARD || {}; Object.keys(G).forEach(function (g) { G[g].forEach(function (t) { said[X.voiceName(t)] = t; }); }); } catch (e) {} }
    for (k in X.lines) said[k] = X.lines[k]; for (k in said) add(k, "voice", { text: said[k] });
    for (k in X.reg) add(k, X.reg[k].kind || "sfx", X.reg[k]);
    for (k in X.prefs) add(k, k.indexOf("voice:") === 0 ? "voice" : "sfx"); ["personal", "global"].forEach(function (l) { for (k in X.raw[l]) add(k, k.indexOf("voice:") === 0 ? "voice" : "sfx"); });
    return Object.keys(out).map(function (n) { return out[n]; });
  };
  /* Play one sound for the Sounds tab, from a chosen source: "default" (the game's own), "personal", "global", or null
     (what the game would play now). Ignores "off" so a switched-off sound can still be heard here. */
  X.preview = function (name, which) {
    if (S.muted) return "muted"; try { S.ensure(); if (S.ac && S.ac.state === "suspended") S.ac.resume(); } catch (e) {} if (!S.ac) return "none"; mixer(); X.decodeAll();
    var keepOff = X.prefs[name], r; X.forced = which || null; if (keepOff && keepOff.off) X.prefs[name] = Object.assign({}, keepOff, { off: false });
    try {
      r = X.route(name);
      if (which && which !== "default" && !r.buf) return "none";
      if (name.indexOf("voice:") === 0) { if (r.buf) X.play(name, { bus: "world" }); else say.call(S, X.lines[name] || "", {}); }
      else if (name === "music") { if (r.buf) X.play(name, { bus: "world", gain: .8 }); else if (S.song) { S.next = S.ac.currentTime + .05; compose.call(S); setTimeout(function () { clearTimeout(S.timer); }, 5000); } else return "none"; }
      else if (/^fanfare_/.test(name)) { if (r.buf) X.play(name, { bus: "world" }); else synthAt(name, null, ff, [{ fanfare_win: "win", fanfare_champion: "champion", fanfare_draw: "draw", fanfare_lose: "lose" }[name]]); }
      else if (/^crowd_/.test(name)) { if (r.buf) X.play(name, { bus: "world" }); else synthAt(name, null, roar, [name === "crowd_groan"]); }
      else if (/^grunt_/.test(name)) { if (r.buf) X.play(name, { bus: "world" }); else synthAt(name, null, grunt, [{ id: "pv", f0: 150, gain: 1 }, name.slice(6)]); }
      else { X["t_" + name] = 0; S.lastSfx[name] = 0; if (r.buf || r.how === "file") { if (!X.play(name, { bus: "ui" })) { if (r.how === "file") { (entry(name).f || []).forEach(function (s) { load(s); }); return "loading"; } } } else synthAt(name, {}); }
      return r.buf ? r.how : r.how === "file" ? "file" : "synth";
    } finally { X.forced = null; if (keepOff) X.prefs[name] = keepOff; }
  };
  if (S.voice) { var grunt = S.voice; S.voice = function (v, kind) { if (this.muted || !this.ac || !v) return; special("grunt_" + (kind || "effort"), null, grunt, [v, kind]); }; }
  if (S.roar) { var roar = S.roar; S.roar = function (sad) { if (this.muted || !this.ac) return; special(sad ? "crowd_groan" : "crowd_cheer", null, roar, [sad]); }; }
  if (S.loop) { // music: when the player replaced or switched off the tune, the composer stays quiet and a looped file plays instead
    var compose = S.loop, mus = null;
    var musStop = function () { if (mus) { try { mus.g.gain.setTargetAtTime(0, S.ac.currentTime, .08); mus.s.stop(S.ac.currentTime + .4); } catch (e) {} mus = null; } };
    S.loop = function () {
      var r = X.route("music"); if (r.how === "composer" || (r.how !== "off" && !r.buf) || !this.ac) { musStop(); return compose.apply(this, arguments); }
      clearTimeout(this.timer); if (!this.song || this.muted || r.how === "off") { musStop(); return; } X.heard.music = 1;
      if (!mus || mus.buf !== r.buf) { musStop(); try { var a = this.ac, s = a.createBufferSource(), g = a.createGain(); g.gain.value = X.vol("music"); s.buffer = r.buf; s.loop = true; s.connect(g); g.connect(this.music); s.start(); mus = { s: s, g: g, buf: r.buf }; } catch (e) { mus = null; } }
      var T = this; if (mus) mus.t = Date.now(); this.timer = setTimeout(function () { T.loop(); }, 250); // the game pauses music by clearing this timer
    };
    setInterval(function () { if (mus && Date.now() - mus.t > 900) musStop(); }, 400);
  }
  if (S.fanfare) { var ff = S.fanfare; S.fanfare = function (kind) { var r; if (this.muted || !this.ac) return; special(X.fanfareName(kind), null, ff, [kind]); try { if (!X.warmed) warm(); if (/win|champion|gameComplete|newRecord/.test(kind || "")) { X.play("applause", { gain: kind === "champion" || kind === "gameComplete" ? 1 : .7, delay: .25 }); X.play("pop", { delay: .1 }); } else if (/lose|eliminated/.test(kind || "")) X.play("aww", { gain: .8, delay: .2 }); } catch (e) {} return r; }; }
  if (S.say) { var say = S.say; S.say = function (text, o) {
    var nm = X.voiceName(text), r = X.route(nm), A0 = window.Arcade || {}; X.lines[nm] = String(text || "").slice(0, 160); X.heard[nm] = 1;
    if (r.how === "off") return; // that line is switched off: no voice, no filler (the subtitle still shows)
    if (r.buf) { if (this.muted || (A0.settings && A0.settings.voice === false)) return; try { this.ensure(); mixer(); X.duck(.55, r.buf.duration + .3); X.play(nm, Object.assign({ bus: "world" }, o && isFinite(o.x) ? { x: o.x, y: o.y } : {})); } catch (e) {} return; }
    try { X.duck(.55, 1.6); } catch (e) {} return say.apply(this, arguments); }; }
  if (S.unlock) { var un = S.unlock; S.unlock = function () { var r = un.apply(this, arguments); try { warm(); } catch (e) {} return r; }; }

  X.setManifest = function (m) { X.man = m && typeof m === "object" ? m : null; X.ready = true; try { warm(); } catch (e) {} if (X.onready) { try { X.onready(); } catch (e) {} } };
  if (X.base && typeof fetch === "function") { try { fetch(X.base + "manifest.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(X.setManifest, function () { X.setManifest(null); }); } catch (e) { X.setManifest(null); } } else X.setManifest(null);
})();
