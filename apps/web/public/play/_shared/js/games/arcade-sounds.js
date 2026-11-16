/* Settings → Sounds, for every arcade game (docs/ARCADE_SETTINGS.md, "Sounds"). Lists every sound the page knows
   (Arcade.Audio.registry(): the engine's names, this game's pack, built-in synth effects, music and stings, spoken lines,
   and names a game registers), grouped and searchable. For each one: play, switch off, its own volume, replace it with a
   file from the device or a recording (trimmed before saving), and reset. The game's own file is never touched.

   Where things live: on/off and volume in localStorage "ee-arcade-snd-<slug>" (arcade-audio.js); the player's own files
   in IndexedDB "ee-arcade-sounds" (key "p|<slug>|<name>"); files a super admin set for everyone come from
   /arcade/api/sounds/<slug>/ and are kept in the same IndexedDB (key "g|<slug>|<name>", list "m|<slug>") so they also
   play offline. Order: off > the player's file > everyone's file > the default recording > the synth.
   Nothing runs at load time in Node (no document). */
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;
  var GROUPS = [["ui", "Menus and buttons"], ["vehicles", "Vehicles"], ["crashes", "Crashes and impacts"], ["feet", "Footsteps and movement"],
    ["fighting", "Fighting and sport"], ["world", "Around the world"], ["ambience", "Ambience and crowds"], ["music", "Music and stings"], ["voices", "Voices"], ["other", "Other"]];
  // group|what it is. Names not listed here are grouped by their prefix and bus (see classify).
  var DESC = {
    click: "ui|A button press in menus", back: "ui|Going back or closing a menu", confirm: "ui|Confirming a choice", error: "ui|Something is not allowed",
    block: "fighting|A blocked hit, or a refused action", toggle: "ui|A switch flipped on or off", hover: "ui|Pointing at a menu item", coin: "ui|Picking up money or a reward",
    pop: "ui|A small pop when something appears", power: "ui|A power-up or a cheat switched on", special: "fighting|A special move", win: "music|Short jingle for a win",
    lose: "music|Short jingle for a loss", goal: "fighting|A goal, a target reached or a job done", pluck: "ui|A soft plucked note", zap: "fighting|An electric zap or an enemy defeated",
    laser: "fighting|A laser shot", boom: "crashes|An explosion", bounce: "fighting|A springy bounce", jump: "feet|Jumping", dash: "feet|A quick dash or a skid",
    hit: "fighting|Taking a hit", heavy: "fighting|A heavy hit", kick: "fighting|A kick: a ball or an opponent", ko: "fighting|A knockout", stomp: "feet|A stomp or a hard landing",
    swish: "feet|A fast swish through the air", thump: "crashes|A dull thump", whistle: "fighting|A referee or security whistle", whistle_long: "fighting|A long whistle: full time",
    bell: "world|A bell", applause: "ambience|Applause after a win", aww: "ambience|A disappointed crowd", cheer: "ambience|A crowd cheering", net: "fighting|The ball hitting the net",
    guard: "fighting|Guarding against an attack", glass: "crashes|Glass breaking", metal: "crashes|Metal hit", metal_heavy: "crashes|A heavy metal crash", wood: "crashes|Wood knocked or broken",
    land: "feet|Landing after a jump", _amb: "ambience|This game's background ambience",
    amb_birds: "ambience|Birds in the trees by day", amb_crickets: "ambience|Crickets at night", amb_crowd: "ambience|People talking nearby", amb_water: "ambience|Water: the dam and the river",
    wind: "ambience|Wind in the open", siren: "vehicles|A siren", bike_tick: "vehicles|Bicycle wheel ticking", book: "world|A book opened or put down", brake: "vehicles|Brakes squeal",
    car_door_close: "vehicles|A car door closing", car_door_open: "vehicles|A car door opening", car_off: "vehicles|Engine switched off", car_start: "vehicles|Engine starting",
    class_bell: "world|The class bell", crash_heavy: "crashes|A heavy crash", crash_light: "crashes|A light bump", crash_metal: "crashes|A metal crash", dial: "world|Phone keypad",
    door_close: "world|A door closing", door_open: "world|A door opening", eng_car: "vehicles|Car engine (loops while you drive)", eng_keke: "vehicles|Keke (tricycle) engine",
    eng_okada: "vehicles|Okada (motorbike) engine", eng_plane: "vehicles|Plane engine", eng_scooter: "vehicles|Scooter engine", eng_sport: "vehicles|Sports car engine",
    fall: "feet|Falling over", getup: "feet|Getting back up", handbrake: "vehicles|Handbrake pulled", hit_person: "crashes|A vehicle hitting someone",
    horn_bike: "vehicles|Bicycle bell", horn_bus: "vehicles|Bus horn", horn_car: "vehicles|Car horn", horn_keke: "vehicles|Keke horn", horn_okada: "vehicles|Okada horn",
    horn_scooter: "vehicles|Scooter horn", horn_skate: "vehicles|Skateboard: a whistle to clear the way", horn_sport: "vehicles|Sports car horn", kerb: "vehicles|Wheels hitting the kerb",
    phone_close: "ui|Phone put away", phone_open: "ui|Phone taken out", pickup: "world|Picking something up", punch: "fighting|A punch", punch_heavy: "fighting|A heavy punch",
    screech: "vehicles|Tyres screeching", shove: "fighting|A shove", skate_roll: "vehicles|Skateboard wheels rolling", skid_dirt: "vehicles|Skidding on dirt", slap: "fighting|A slap",
    step_floor: "feet|Footsteps indoors", step_grass: "feet|Footsteps on grass", step_road: "feet|Footsteps on the road", step_wood: "feet|Footsteps on wood", till: "world|A shop till",
    whoosh: "fighting|A swing through the air",
    music: "music|The game's background music (composed live while you play)", fanfare_win: "music|Fanfare for a win or a new record", fanfare_champion: "music|Fanfare for a title or finishing the game",
    fanfare_draw: "music|Sting for a draw", fanfare_lose: "music|Sting for a loss", crowd_cheer: "ambience|The crowd roars", crowd_groan: "ambience|The crowd groans",
    grunt_jump: "voices|Fighter's voice: jump", grunt_kick: "voices|Fighter's voice: kick", grunt_shoot: "voices|Fighter's voice: shot", grunt_hurt: "voices|Fighter's voice: hurt",
    grunt_ko: "voices|Fighter's voice: knocked out", grunt_power: "voices|Fighter's voice: power move", grunt_win: "voices|Fighter's voice: win", grunt_sad: "voices|Fighter's voice: sad",
    grunt_effort: "voices|Fighter's voice: effort", grunt_laugh: "voices|Fighter's voice: laugh"
  };
  var RULES = [[/^crash|^glass|^metal|^boom|^thump|^wood|^smash|^impact|^debris|^scrape/, "crashes", "Crash or impact"], [/^(eng|horn|car|tyre|tire|skid|brake|siren|bike|skate|gear|bus|keke|okada)_?/, "vehicles", "Vehicle sound"],
    [/^step|^foot|^land|^jump|^fall|^getup|^dash|^swish|^run/, "feet", "Movement"], [/^punch|^slap|^shove|^hit|^kick|^ko$|^block|^guard|^whoosh|^grunt_/, "fighting", "Fight sound"],
    [/^amb|^_amb|^wind|^rain|^crowd|^cheer|^applause/, "ambience", "Ambience"], [/^music|^fanfare|^song|^radio/, "music", "Music"], [/^voice:|^grunt_|^say_|^line_/, "voices", "Voice"]];
  var LIM = { personal: 8 * 1024 * 1024, input: 30 * 1024 * 1024, seconds: 300, record: 30, globalBytes: 2 * 1024 * 1024, globalSeconds: 120 };

  function human(n) { var s = String(n).replace(/^_/, "").replace(/[_-]+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  /* {group, label, desc} for one registry item. */
  function classify(it) {
    var n = it.name, d = (it.desc || "") && (it.group || "") ? it.group + "|" + it.desc : DESC[n], g, desc;
    if (it.kind === "voice" || n.indexOf("voice:") === 0) return { group: "voices", label: "Spoken line", desc: it.text ? "“" + it.text + "”" : "A spoken line" };
    if (d) { g = d.split("|")[0]; desc = d.slice(g.length + 1); }
    else if (it.desc) { desc = it.desc; }
    if (!g) for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(n)) { g = RULES[i][1]; desc = desc || RULES[i][2] + ": " + human(n).toLowerCase(); break; }
    if (!g) g = it.group || (it.bus === "ui" ? "ui" : it.bus === "vehicles" ? "vehicles" : it.bus === "feet" ? "feet" : it.bus === "impacts" ? "crashes" : it.bus === "ambience" ? "ambience" : it.bus === "world" ? "world" : "other");
    return { group: g, label: it.label || human(n), desc: desc || (it.synth && !it.file ? "Built-in effect" : "Sound effect") };
  }

  /* ---------- IndexedDB: every access wrapped, a failure just means "not stored" ---------- */
  var DBN = "ee-arcade-sounds", ST = "files", dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok) {
      try { if (!root.indexedDB) return ok(null); var r = root.indexedDB.open(DBN, 1);
        r.onupgradeneeded = function () { try { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST); } catch (e) {} };
        r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ok(null); }; r.onblocked = function () { ok(null); };
      } catch (e) { ok(null); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (ok) {
        try { var t = d.transaction(ST, mode), req = fn(t.objectStore(ST)); t.oncomplete = function () { ok(req && "result" in req ? req.result : true); };
          t.onerror = function () { ok(null); }; t.onabort = function () { ok(null); }; } catch (e) { ok(null); }
      });
    }).catch(function () { return null; });
  }
  var idb = {
    get: function (k) { return tx("readonly", function (s) { return s.get(k); }); },
    put: function (k, v) { return tx("readwrite", function (s) { s.put(v, k); return null; }); },
    del: function (k) { return tx("readwrite", function (s) { s.delete(k); return null; }); },
    keys: function (pre) { return tx("readonly", function (s) { return s.getAllKeys ? s.getAllKeys() : null; }).then(function (ks) { return (ks || []).filter(function (k) { return String(k).indexOf(pre) === 0; }); }); }
  };

  /* ---------- audio helpers (pure, also used by the Node harness) ---------- */
  var DEC = null;
  function decoder() {
    var X = root.Arcade && root.Arcade.Sound; if (X && X.ac) return X.ac;
    if (DEC) return DEC;
    try { var O = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (O) return (DEC = new O(1, 44100, 44100)); } catch (e) {}
    try { var A = root.AudioContext || root.webkitAudioContext; if (A) return (DEC = new A()); } catch (e) {}
    return null;
  }
  function decode(ab) {
    var ac = decoder(); if (!ac) return Promise.reject(new Error("no audio"));
    return new Promise(function (ok, no) { try { var q = ac.decodeAudioData(ab.slice(0), ok, no); if (q && q.then) q.then(ok, no); } catch (e) { no(e); } });
  }
  /* Mono samples of [t0, t1) seconds of an AudioBuffer-like {sampleRate, numberOfChannels, getChannelData}, at `rate`, with
     5 ms fades so the cut does not click. */
  function cut(buf, t0, t1, rate) {
    var sr = buf.sampleRate, a = Math.max(0, Math.floor(t0 * sr)), z = Math.min(buf.length || buf.getChannelData(0).length, Math.ceil(t1 * sr)), ch = buf.numberOfChannels || 1, chans = [];
    for (var c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    var n = Math.max(0, Math.floor((z - a) * rate / sr)), out = new Float32Array(n), step = sr / rate, fade = Math.max(1, Math.floor(rate * .005));
    for (var j = 0; j < n; j++) {
      var p = a + j * step, i0 = Math.floor(p), f = p - i0, i1 = Math.min(z - 1, i0 + 1), s = 0;
      for (c = 0; c < ch; c++) s += chans[c][i0] * (1 - f) + chans[c][i1] * f;
      s /= ch; if (j < fade) s *= j / fade; else if (j > n - fade) s *= (n - j) / fade; out[j] = s;
    }
    return out;
  }
  function wav(samples, rate) {
    var n = samples.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), i;
    function str(o, s) { for (var k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) { var s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true); }
    return b;
  }
  /* The smallest good WAV of the cut that fits `max` bytes: 44.1, 32, 22.05, 16 then 11.025 kHz. null when none fits. */
  function fit(buf, t0, t1, max) {
    var rates = [44100, 32000, 22050, 16000, 11025].filter(function (r) { return r <= Math.max(11025, buf.sampleRate); });
    for (var i = 0; i < rates.length; i++) if (44 + (t1 - t0) * rates[i] * 2 <= max) return { ab: wav(cut(buf, t0, t1, rates[i]), rates[i]), type: "audio/wav", rate: rates[i] };
    return null;
  }
  var GLOBAL_TYPES = /^audio\/(mpeg|mp3|mp4|x-m4a|aac|m4a|wav|x-wav|wave|vnd\.wave)$/;

  /* ---------- state shared by boot and the panel ---------- */
  var S = { X: null, slug: "", api: "", csrf: "", can: false, glob: {}, gv: {}, limits: null, ready: false, ui: null, booted: false };
  function key(layer, name) { return (layer === "personal" ? "p|" : "g|") + S.slug + "|" + name; }

  function boot(X) {
    if (S.booted || !X) return; S.booted = true; S.X = X; var stage = null;
    try { stage = document.querySelector("[data-gm-stage]"); } catch (e) {}
    S.slug = (stage && stage.getAttribute("data-gm-slug")) || X.slug || "arcade"; S.api = (stage && stage.getAttribute("data-gm-api")) || ""; S.csrf = (stage && stage.getAttribute("data-csrf")) || "";
    // the player's own files
    idb.keys("p|" + S.slug + "|").then(function (ks) {
      return Promise.all(ks.map(function (k) { return idb.get(k).then(function (r) { if (r && r.ab) X.setOverride("personal", String(k).split("|").slice(2).join("|"), r.ab); }); }));
    }).then(function () { S.ready = true; refresh(); }, function () { S.ready = true; });
    syncGlobal();
  }
  function applyGlobalList(list, fetchMissing) {
    var X = S.X, want = {}; S.glob = {};
    (list || []).forEach(function (g) { S.glob[g.name] = g; want[g.name] = 1; });
    function drop(n) { X.setOverride("global", n, null); delete S.gv[n]; }
    return idb.keys("g|" + S.slug + "|").then(function (ks) {
      ks.forEach(function (k) { var n = String(k).split("|").slice(2).join("|"); if (!want[n]) { idb.del(k); drop(n); } });
      Object.keys(X.raw.global).concat(Object.keys(X.ov.global)).forEach(function (n) { if (!want[n]) drop(n); });
      return Promise.all((list || []).map(function (g) {
        if (S.gv[g.name] === g.v) return null; // already playing this version
        return idb.get(key("global", g.name)).then(function (r) {
          if (r && r.ab && r.v === g.v) { X.setOverride("global", g.name, r.ab); S.gv[g.name] = g.v; return; }
          if (!fetchMissing || typeof fetch !== "function") { if (r && r.ab) X.setOverride("global", g.name, r.ab); return; }
          return fetch(g.url, { credentials: "same-origin" }).then(function (res) { if (!res.ok) throw new Error("file"); return res.arrayBuffer(); }).then(function (ab) {
            X.setOverride("global", g.name, ab); S.gv[g.name] = g.v; return idb.put(key("global", g.name), { ab: ab, v: g.v, type: g.type, size: ab.byteLength, at: g.at });
          }).catch(function () { if (r && r.ab) X.setOverride("global", g.name, r.ab); });
        });
      }));
    }).then(refresh, refresh);
  }
  function syncGlobal() {
    if (!S.api || typeof fetch !== "function") return idb.get("m|" + S.slug).then(function (m) { S.X.gvol = (m && m.vols) || {}; return applyGlobalList(m && m.sounds, false); });
    return fetch(S.api + "sounds/" + S.slug + "/", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("list"); return r.json(); })
      .then(function (j) { S.can = !!j.can_global; S.limits = j; S.X.gvol = j.vols || {}; idb.put("m|" + S.slug, { sounds: j.sounds || [], vols: j.vols || {}, at: Date.now() }); return applyGlobalList(j.sounds || [], true); })
      .catch(function () { return idb.get("m|" + S.slug).then(function (m) { S.X.gvol = (m && m.vols) || {}; return applyGlobalList(m && m.sounds, false); }); }); // MIB-Hub: vols = staff per-sound volume
  }

  /* ---------- the panel ---------- */
  var CSS = ".snd-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px}.snd-top input[type=search]{flex:1 1 180px;min-width:0;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:#13233a;color:#fff;font:inherit}" +
    ".snd-count{color:rgba(232,246,255,.7);font-size:.88em}.snd-g{margin:0 0 12px}.snd-g h3{position:sticky;top:-12px;z-index:1;margin:0;padding:8px 0 6px;background:#0d1726;font-size:.78em;letter-spacing:.09em;text-transform:uppercase;color:#7ef0ff}" +
    ".snd-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06)}.snd-row[hidden],.snd-g[hidden]{display:none}" +
    ".snd-info{min-width:0}.snd-info b{font-weight:700}.snd-info code,.snd-ed-box code{margin-left:6px;padding:0;border:0;background:none;font:600 .78em ui-monospace,monospace;color:rgba(232,246,255,.55);overflow-wrap:anywhere}.snd-info small{display:block;color:rgba(232,246,255,.66);font-size:.86em;overflow-wrap:anywhere}" +
    ".snd-tag{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;font-size:.74em;font-weight:800;vertical-align:1px;background:#1e3a5f;color:#bfe9ff}.snd-tag--off{background:#4b1d1d;color:#fecaca}.snd-tag--me{background:#14532d;color:#bbf7d0}.snd-tag--all{background:#4a3a07;color:#fde68a}" +
    ".snd-ctl{display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:nowrap}.snd-ctl output{min-width:3em}.snd-b{min-width:44px;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#1b2c44;color:#fff;font:inherit;font-weight:700;cursor:pointer}" +
    ".snd-b[hidden]{display:none}.snd-play{font-size:1.05em;padding:0;width:44px}.snd-b:disabled{opacity:.45;cursor:default}.snd-b--go{background:#22c55e;border-color:#22c55e;color:#04220f}.snd-b--rec{background:#7f1d1d;border-color:#ef4444}" +
    ".snd-ctl input[type=range]{width:min(130px,30vw)}.snd-empty{color:rgba(232,246,255,.7);padding:12px 0}" +
    ".snd-ed{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom));background:rgba(4,10,20,.82)}" +
    ".snd-ed-box{width:min(560px,100%);max-height:100%;overflow:auto;background:#0d1726;border:1px solid rgba(126,240,255,.3);border-radius:16px;padding:14px;color:#e8f6ff;box-shadow:0 20px 60px rgba(0,0,0,.5)}" +
    ".snd-ed-box h3{margin:0 0 2px;font-size:1.15em;color:#fff;letter-spacing:-.01em}.snd-ed-box p{margin:4px 0 10px;color:rgba(232,246,255,.75);font-size:.92em;line-height:1.4}.snd-ed-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}" +
    ".snd-ed canvas{display:block;width:100%;height:84px;border-radius:10px;background:#0a1220;border:1px solid rgba(255,255,255,.1)}.snd-ed label{display:flex;align-items:center;gap:8px;font-weight:600}" +
    ".snd-ed .snd-trim{display:grid;grid-template-columns:3.2em minmax(0,1fr) 4.2em;gap:8px;align-items:center;margin:6px 0}.snd-ed .snd-trim input{width:100%}.snd-ed output{color:#fde047;font-weight:700;font-variant-numeric:tabular-nums}" +
    ".snd-ed-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}.snd-msg{min-height:1.3em;color:#86efac;font-weight:700}.snd-msg--bad{color:#fca5a5}" +
    ".snd-ed label.snd-all{align-items:flex-start;padding:10px;border-radius:10px;background:#2a2108;border:1px solid #a16207;margin-top:8px;min-height:44px;cursor:pointer}.snd-all input{-webkit-appearance:checkbox;appearance:auto;flex:0 0 24px;width:24px;height:24px;margin:0;accent-color:#f59e0b}" +
    "@media (min-width:541px){.snd-ctl [data-s=reset][hidden]{display:inline-block;visibility:hidden}}" + // keep the columns lined up
    "@media (max-width:540px){.snd-row{grid-template-columns:1fr}.snd-ctl{justify-content:flex-start;flex-wrap:wrap;gap:8px 6px}.snd-ctl input[type=range]{flex:1 1 56px;min-width:56px;width:auto}.snd-ctl output{min-width:2.6em;font-size:.9em}.snd-ctl [data-s=rep]{padding:0 10px}}" +
    "@media (prefers-reduced-motion:reduce){.snd-ed,.snd-ed *,.snd-row *{transition:none!important;animation:none!important}}";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pct(v) { return Math.round(v * 100) + "%"; }
  function items() {
    var X = S.X; if (!X || !X.registry) return [];
    return X.registry().map(function (it) { var c = classify(it); it.group = c.group; it.label = c.label; it.desc = c.desc; return it; })
      .sort(function (a, b) { return (b.pack - a.pack) || (b.heard - a.heard) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0); });
  }
  function tags(it) {
    var t = "";
    if (it.off) t += "<span class='snd-tag snd-tag--off'>Off</span>";
    if (it.personal) t += "<span class='snd-tag snd-tag--me'>Your file</span>"; else if (it.global) t += "<span class='snd-tag snd-tag--all'>Everyone's file</span>";
    if (!it.off && it.vol !== 1) t += "<span class='snd-tag'>" + pct(it.vol) + "</span>";
    return t;
  }
  function rowHtml(it) {
    var id = "snd-" + it.name.replace(/[^a-z0-9_-]/gi, "_"), changed = it.off || it.personal || it.vol !== 1, q = (it.name + " " + it.label + " " + it.desc + " " + it.group).toLowerCase();
    return "<div class='snd-row' data-n='" + esc(it.name) + "' data-q='" + esc(q) + "' data-ch='" + (changed || it.global ? 1 : 0) + "'>" +
      "<div class='snd-info'><b id='" + id + "'>" + esc(it.label) + "</b>" + (it.kind === "voice" ? "" : "<code>" + esc(it.name) + "</code>") + "<span data-tags>" + tags(it) + "</span><small>" + esc(it.desc) + "</small></div>" +
      "<div class='snd-ctl'><button class='snd-b snd-play' data-s='play' aria-label='Play " + esc(it.label) + "' title='Play'>▶</button>" +
      "<span class='gms-sw'><input type='checkbox' role='switch' data-s='on'" + (it.off ? "" : " checked") + " aria-label='" + esc(it.label) + " on or off'><i></i></span>" +
      "<input type='range' min='0' max='1.5' step='0.05' value='" + it.vol + "' data-s='vol' aria-label='Volume of " + esc(it.label) + "'><output data-vo>" + pct(it.vol) + "</output>" +
      "<button class='snd-b' data-s='rep' aria-label='Replace " + esc(it.label) + "'>Replace</button>" +
      "<button class='snd-b' data-s='reset' aria-label='Reset " + esc(it.label) + " to default'" + (changed ? "" : " hidden") + ">Reset</button>" +
      "<button class='snd-b' data-s='unall' aria-label='Remove the file everyone hears for " + esc(it.label) + "'" + (S.can && it.global ? "" : " hidden") + ">Remove for all</button>" +
      "</div></div>";
  }
  function find(name) { return items().filter(function (i) { return i.name === name; })[0]; }
  function refresh() { // update rows in place (tags, switches, buttons) so focus, search and scroll stay where they are
    var u = S.ui; if (!u || !u.el || !u.el.isConnected) return;
    var list = items(), by = {}, have = {}; list.forEach(function (i) { by[i.name] = i; });
    [].forEach.call(u.el.querySelectorAll(".snd-row"), function (r) {
      var it = by[r.getAttribute("data-n")]; if (!it) return; have[it.name] = 1; var changed = it.off || it.personal || it.vol !== 1;
      r.querySelector("[data-tags]").innerHTML = tags(it); r.setAttribute("data-ch", changed || it.global ? 1 : 0);
      r.querySelector("[data-s=on]").checked = !it.off; r.querySelector("[data-s=reset]").hidden = !changed; r.querySelector("[data-s=unall]").hidden = !(S.can && it.global);
      var v = r.querySelector("[data-s=vol]"); if (document.activeElement !== v) { v.value = it.vol; r.querySelector("[data-vo]").textContent = pct(it.vol); }
    });
    if (list.some(function (i) { return !have[i.name]; }) && !u.el.contains(document.activeElement)) return draw();
    filter();
  }
  function draw() {
    var u = S.ui; if (!u) return; var list = items(), by = {};
    list.forEach(function (i) { (by[i.group] = by[i.group] || []).push(i); });
    var q = u.q || "", only = u.only;
    u.el.innerHTML = "<div class='snd-top'><input type='search' data-s='q' placeholder='Search sounds' aria-label='Search sounds' value='" + esc(q) + "' autocomplete='off'>" +
      "<button class='snd-b' data-s='only' aria-pressed='" + !!only + "'>" + (only ? "Show all" : "Changed only") + "</button><span class='snd-count' data-count role='status'></span></div>" +
      "<p class='gms-note'>Tap ▶ to listen. Switch a sound off, set its own volume, or <b>Replace</b> it with a file or a recording. Your choices stay on this device and work offline; <b>Reset</b> brings the game's own sound back." +
      (S.can ? " As a super admin you can also <b>use a replacement for everyone</b>." : "") + "</p>" +
      GROUPS.filter(function (g) { return by[g[0]]; }).map(function (g) { return "<section class='snd-g' data-g='" + g[0] + "'><h3>" + esc(g[1]) + " <span data-gc></span></h3>" + by[g[0]].map(rowHtml).join("") + "</section>"; }).join("") +
      "<p class='snd-empty' data-none hidden>No sound matches that search.</p>";
    filter();
  }
  function filter() {
    var u = S.ui; if (!u || !u.el) return; var q = (u.q || "").toLowerCase().trim(), words = q ? q.split(/\s+/) : [], shown = 0, total = 0;
    [].forEach.call(u.el.querySelectorAll(".snd-g"), function (g) {
      var n = 0; [].forEach.call(g.querySelectorAll(".snd-row"), function (r) { total++; var hay = r.getAttribute("data-q") || "", ok = words.every(function (w) { return hay.indexOf(w) >= 0; }) && (!u.only || r.getAttribute("data-ch") === "1"); r.hidden = !ok; if (ok) n++; });
      g.hidden = !n; shown += n; var gc = g.querySelector("[data-gc]"); if (gc) gc.textContent = "(" + n + ")";
    });
    var c = u.el.querySelector("[data-count]"); if (c) c.textContent = shown === total ? total + " sounds" : shown + " of " + total;
    var none = u.el.querySelector("[data-none]"); if (none) none.hidden = !!shown;
  }
  function say(m, bad) { if (S.ui && S.ui.flash) S.ui.flash(m); var e = S.ui && S.ui.ed && S.ui.ed.querySelector("[data-e-msg]"); if (e && S.ui.edOpen) { e.textContent = m; e.className = "snd-msg" + (bad ? " snd-msg--bad" : ""); } }
  function setPref(name, k, v) {
    var X = S.X, p = Object.assign({}, X.prefs[name] || {}); if (k === "off") { if (v) p.off = true; else delete p.off; } else { if (Math.abs(v - 1) < .001) delete p.vol; else p.vol = v; }
    if (Object.keys(p).length) X.prefs[name] = p; else delete X.prefs[name]; X.savePrefs();
  }
  function play(name, which) {
    var r = S.X.preview(name, which || null);
    if (r === "muted") say("Sound is muted. Turn it on with the speaker button first.", true);
    else if (r === "loading") say("Loading that sound. Tap ▶ again in a moment.");
    else if (r === "none") say(name === "music" ? "This game has no music playing right now." : "Nothing to play for that one yet.");
  }

  function mount(el, o) {
    if (!el) return; o = o || {}; if (o.X) S.X = o.X; if (!S.X) S.X = root.Arcade && root.Arcade.Audio; if (!S.X) { el.innerHTML = "<p class='gms-note'>Sounds are not available on this page.</p>"; return; }
    if (!S.slug) boot(S.X);
    if (!document.getElementById("snd-css")) { var st = document.createElement("style"); st.id = "snd-css"; st.textContent = CSS; document.head.appendChild(st); }
    var u = S.ui = { el: el, q: S.ui ? S.ui.q : "", only: S.ui ? S.ui.only : false, flash: o.flash, layer: (el.closest && el.closest(".gms")) || el.parentNode };
    draw();
    S.X.onover = function () { refresh(); };
    el.addEventListener("input", function (e) {
      var t = e.target, s = t.getAttribute("data-s"); if (s === "q") { u.q = t.value; filter(); return; }
      var row = t.closest(".snd-row"); if (!row) return; var n = row.getAttribute("data-n");
      if (s === "vol") { setPref(n, "vol", +t.value); var out = row.querySelector("[data-vo]"); if (out) out.textContent = pct(+t.value); }
    });
    el.addEventListener("change", function (e) {
      var t = e.target, s = t.getAttribute("data-s"), row = t.closest(".snd-row"); if (!row) return; var n = row.getAttribute("data-n");
      if (s === "on") { setPref(n, "off", !t.checked); say(t.checked ? "On." : "Switched off: the game plays nothing for this sound."); refresh(); }
      if (s === "vol") { refresh(); if (+t.value > 0) play(n); }
    });
    el.addEventListener("click", function (e) {
      var b = e.target.closest("[data-s]"); if (!b || b.disabled) return; var s = b.getAttribute("data-s"), row = b.closest(".snd-row"), n = row && row.getAttribute("data-n");
      if (s === "only") { u.only = !u.only; draw(); var f = el.querySelector("[data-s=only]"); if (f) f.focus(); return; }
      if (!n) return;
      if (s === "play") return play(n);
      if (s === "rep") return editor(n);
      if (s === "reset") return reset(n);
      if (s === "unall") return unGlobal(n);
    });
  }
  function reset(name) {
    var X = S.X; delete X.prefs[name]; X.savePrefs(); X.setOverride("personal", name, null); idb.del(key("personal", name));
    say(S.glob[name] ? "Reset. You hear the sound set for everyone." : "Reset to the game's own sound."); refresh();
    var r = S.ui && S.ui.el.querySelector(".snd-row[data-n='" + cssq(name) + "'] [data-s=rep]"); if (r) r.focus();
  }
  function cssq(s) { return String(s).replace(/['\\]/g, "\\$&"); }
  function post(path, form) {
    return fetch(S.api + "sounds/" + S.slug + "/" + path, { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": S.csrf, Accept: "application/json" }, body: form })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "The server said no (" + r.status + ")."); return j; }); });
  }
  function unGlobal(name) {
    if (!S.can) return; if (typeof confirm === "function" && !confirm("Remove the replacement everyone hears for this sound? The game's own sound comes back for everyone.")) return;
    var f = new FormData(); f.append("name", name);
    post("revert/", f).then(function () { say("Removed for everyone."); return syncGlobal(); }, function (e) { say(e.message || "Could not reach the server.", true); });
  }

  /* ---------- Replace: a file or a recording, preview, trim, save ---------- */
  function editor(name) {
    var u = S.ui, it = find(name) || { name: name, label: name, desc: "" }; if (!u) return; closeEditor();
    var host = u.layer || u.el, ed = document.createElement("div"), stG = S.limits || {}, gB = stG.max_bytes || LIM.globalBytes, gS = stG.max_seconds || LIM.globalSeconds;
    ed.className = "snd-ed"; ed.setAttribute("role", "dialog"); ed.setAttribute("aria-modal", "true"); ed.setAttribute("aria-labelledby", "snd-ed-h");
    var canRec = !!(root.MediaRecorder && root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    ed.innerHTML = "<div class='snd-ed-box'><h3 id='snd-ed-h'>Replace: " + esc(it.label) + "</h3><p>" + esc(it.desc) + (it.kind === "voice" ? "" : " <code>" + esc(name) + "</code>") + "</p>" +
      "<div class='snd-ed-row'><button class='snd-b' data-e='file'>Choose a file</button><input type='file' accept='audio/*,.mp3,.m4a,.wav,.ogg,.oga,.opus,.webm,.aac,.flac' data-e-file hidden>" +
      (canRec ? "<button class='snd-b snd-b--rec' data-e='rec' aria-pressed='false'>● Record</button><output data-e-rt></output>" : "<small>Recording is not available in this browser.</small>") + "</div>" +
      "<div data-e-wave hidden><canvas width='640' height='120' aria-hidden='true'></canvas>" +
      "<div class='snd-trim'><label for='snd-ts'>Start</label><input id='snd-ts' type='range' min='0' max='1' step='0.01' value='0' data-e='start'><output data-e-so>0.00 s</output></div>" +
      "<div class='snd-trim'><label for='snd-te'>End</label><input id='snd-te' type='range' min='0' max='1' step='0.01' value='1' data-e='end'><output data-e-eo>0.00 s</output></div>" +
      "<div class='snd-ed-row'><button class='snd-b' data-e='prev'>▶ Preview</button><button class='snd-b' data-e='orig'>▶ Current sound</button><span class='snd-count' data-e-len></span></div></div>" +
      "<p class='snd-msg' data-e-msg role='status' aria-live='polite'></p>" +
      (S.can ? "<label class='snd-all'><input type='checkbox' data-e='all'> Use for everyone: every player of this game hears it (WAV, MP3 or M4A, up to " + Math.round(gB / 1048576) + " MB and " + Math.round(gS) + " s)</label>" : "") +
      "<div class='snd-ed-foot'><button class='snd-b' data-e='cancel'>Cancel</button><button class='snd-b snd-b--go' data-e='save' disabled>Save</button></div></div>";
    host.appendChild(ed); u.ed = ed; u.edOpen = true; u.edFor = name;
    var st = { buf: null, ab: null, type: "", fromFile: false, t0: 0, t1: 0, rec: null, stream: null, timer: 0, src: null };
    u.edState = st;
    var msg = function (m, bad) { var e = ed.querySelector("[data-e-msg]"); e.textContent = m; e.className = "snd-msg" + (bad ? " snd-msg--bad" : ""); };
    function show() {
      var w = ed.querySelector("[data-e-wave]"), d = st.buf.duration, s = ed.querySelector("[data-e=start]"), e = ed.querySelector("[data-e=end]");
      w.hidden = false; s.max = e.max = d.toFixed(2); s.step = e.step = d > 30 ? "0.1" : "0.01"; s.value = st.t0 = 0; e.value = st.t1 = d; marks(); wave();
      ed.querySelector("[data-e=save]").disabled = false;
    }
    function marks() {
      ed.querySelector("[data-e-so]").textContent = st.t0.toFixed(2) + " s"; ed.querySelector("[data-e-eo]").textContent = st.t1.toFixed(2) + " s";
      ed.querySelector("[data-e-len]").textContent = "Length " + (st.t1 - st.t0).toFixed(2) + " s"; wave();
    }
    function wave() {
      var c = ed.querySelector("canvas"); if (!c || !st.buf) return; var g = c.getContext && c.getContext("2d"); if (!g) return; var W = c.width, H = c.height, d = st.buf.getChannelData(0), n = d.length, dur = st.buf.duration;
      g.clearRect(0, 0, W, H); g.fillStyle = "rgba(126,240,255,.12)"; g.fillRect(st.t0 / dur * W, 0, (st.t1 - st.t0) / dur * W, H); g.fillStyle = "#7ef0ff";
      for (var x = 0; x < W; x++) { var a = Math.floor(x / W * n), z = Math.floor((x + 1) / W * n), m = 0; for (var i = a; i < z; i += Math.max(1, Math.floor((z - a) / 64))) m = Math.max(m, Math.abs(d[i])); var h = Math.max(1, m * H * .9); g.fillRect(x, (H - h) / 2, 1, h); }
      g.fillStyle = "#fde047"; g.fillRect(st.t0 / dur * W, 0, 2, H); g.fillRect(st.t1 / dur * W - 2, 0, 2, H);
    }
    function load(ab, type, fromFile) {
      if (ab.byteLength > LIM.input) { msg("That file is too big (" + (ab.byteLength / 1048576).toFixed(1) + " MB). Use one under " + LIM.input / 1048576 + " MB.", true); return; }
      msg("Reading…");
      decode(ab).then(function (buf) {
        if (!buf || !buf.duration || buf.duration < .03) throw new Error("empty");
        if (buf.duration > LIM.seconds) { msg("That sound is " + Math.round(buf.duration) + " s long. Trim it to " + LIM.seconds / 60 + " minutes or less after loading.", true); }
        else msg("Loaded " + buf.duration.toFixed(2) + " s. Trim it if you like, preview, then Save.");
        st.buf = buf; st.ab = ab; st.type = type || ""; st.fromFile = !!fromFile; show();
      }).catch(function () { msg("This browser cannot play that file. Try MP3, M4A or WAV.", true); });
    }
    function stopRec() {
      if (st.timer) clearInterval(st.timer); st.timer = 0;
      try { if (st.rec && st.rec.state !== "inactive") st.rec.stop(); } catch (e) {}
      try { if (st.stream) st.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} st.stream = null;
      var b = ed.querySelector("[data-e=rec]"); if (b) { b.textContent = "● Record"; b.setAttribute("aria-pressed", "false"); }
    }
    function rec() {
      if (st.rec && st.rec.state === "recording") return stopRec();
      msg("Allow the microphone when asked…");
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }).then(function (stream) {
        if (!u.edOpen) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        var types = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"], mt = "";
        for (var i = 0; i < types.length; i++) try { if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { mt = types[i]; break; } } catch (e) {}
        var r = mt ? new MediaRecorder(stream, { mimeType: mt }) : new MediaRecorder(stream), chunks = [], t0 = Date.now();
        st.rec = r; st.stream = stream;
        r.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
        r.onstop = function () { var blob = new Blob(chunks, { type: r.mimeType || mt || "audio/webm" }); blob.arrayBuffer ? blob.arrayBuffer().then(function (ab) { load(ab, "", false); }) : msg("Could not read the recording.", true); };
        r.start(); var b = ed.querySelector("[data-e=rec]"); b.textContent = "■ Stop"; b.setAttribute("aria-pressed", "true"); msg("Recording… tap Stop when done.");
        st.timer = setInterval(function () { var s = (Date.now() - t0) / 1000, o = ed.querySelector("[data-e-rt]"); if (o) o.textContent = s.toFixed(1) + " s"; if (s >= LIM.record || !u.edOpen || !ed.isConnected) stopRec(); }, 100);
      }, function () { msg("The microphone was not allowed or is not available.", true); });
    }
    function preview(fromStart) {
      var A = root.Arcade && root.Arcade.Sound; if (!st.buf || !A) return; if (A.muted) { msg("Sound is muted. Turn it on with the speaker button first.", true); return; }
      try { A.ensure(); if (A.ac.state === "suspended") A.ac.resume(); if (st.src) try { st.src.stop(); } catch (e) {}
        var s = A.ac.createBufferSource(), g = A.ac.createGain(); s.buffer = st.buf; g.gain.value = 1; s.connect(g); g.connect(A.fx || A.ac.destination); s.start(0, st.t0, Math.max(.02, st.t1 - st.t0)); st.src = s; } catch (e) { msg("Could not play it here.", true); }
    }
    function save() {
      if (!st.buf) return; var len = st.t1 - st.t0, all = S.can && ed.querySelector("[data-e=all]") && ed.querySelector("[data-e=all]").checked;
      if (len < .03) return msg("That is too short. Move Start and End apart.", true);
      if (len > LIM.seconds) return msg("Trim it to " + LIM.seconds / 60 + " minutes or less.", true);
      var whole = st.fromFile && st.t0 < .01 && st.t1 > st.buf.duration - .01, out;
      if (all) {
        if (len > gS) return msg("For everyone the limit is " + Math.round(gS) + " s. Trim it a little.", true);
        out = whole && GLOBAL_TYPES.test(st.type) && st.ab.byteLength <= gB ? { ab: st.ab, type: st.type } : fit(st.buf, st.t0, st.t1, gB);
        if (!out) return msg("Too long to share with everyone. Trim it a little.", true);
        var ext = /mpeg|mp3/.test(out.type) ? "mp3" : /wav|wave/.test(out.type) ? "wav" : "m4a", f = new FormData();
        f.append("name", name); f.append("file", new Blob([out.ab], { type: out.type }), name.replace(/[^a-z0-9_-]/gi, "_") + "." + ext);
        msg("Uploading for everyone…"); ed.querySelector("[data-e=save]").disabled = true;
        post("", f).then(function () { return syncGlobal(); }).then(function () { closeEditor(); say("Saved for everyone. Every player of this game now hears it." + (S.X.raw.personal[name] ? " You still hear your own file here; Reset it to hear this one." : "")); }, function (e) { ed.querySelector("[data-e=save]").disabled = false; msg(e.message || "Could not reach the server. Try again when online.", true); });
        return;
      }
      out = whole && st.ab.byteLength <= LIM.personal ? { ab: st.ab, type: st.type } : fit(st.buf, st.t0, st.t1, LIM.personal);
      if (!out) return msg("That is too long to keep. Trim it a little.", true);
      ed.querySelector("[data-e=save]").disabled = true;
      idb.put(key("personal", name), { ab: out.ab, type: out.type, size: out.ab.byteLength, dur: len, at: Date.now() }).then(function (ok) {
        if (!ok) { ed.querySelector("[data-e=save]").disabled = false; return msg("Could not save it on this device (storage full or private mode).", true); }
        S.X.setOverride("personal", name, out.ab); var p = S.X.prefs[name]; if (p && p.off) setPref(name, "off", false);
        closeEditor(); say("Saved. The game now plays your sound."); refresh();
      });
    }
    ed.addEventListener("click", function (e) {
      if (e.target === ed) return closeEditor();
      var b = e.target.closest("[data-e]"); if (!b || b.disabled) return; var a = b.getAttribute("data-e");
      if (a === "file") ed.querySelector("[data-e-file]").click();
      else if (a === "rec") rec();
      else if (a === "prev") preview();
      else if (a === "orig") play(name);
      else if (a === "save") save();
      else if (a === "cancel") closeEditor();
    });
    ed.addEventListener("change", function (e) {
      var t = e.target; if (!t.hasAttribute("data-e-file") || !t.files || !t.files[0]) return; var file = t.files[0];
      if (file.size > LIM.input) return msg("That file is too big (" + (file.size / 1048576).toFixed(1) + " MB).", true);
      var rd = new FileReader(); rd.onload = function () { load(rd.result, file.type || "", true); }; rd.onerror = function () { msg("Could not read that file.", true); }; rd.readAsArrayBuffer(file);
      t.value = "";
    });
    ed.addEventListener("input", function (e) {
      var t = e.target, a = t.getAttribute("data-e"); if (!st.buf) return;
      if (a === "start") { st.t0 = Math.min(+t.value, st.t1 - .03); t.value = st.t0; marks(); }
      if (a === "end") { st.t1 = Math.max(+t.value, st.t0 + .03); t.value = st.t1; marks(); }
    });
    ed.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeEditor(); } });
    u.stopRec = stopRec;
    var first = ed.querySelector("[data-e=file]"); if (first) first.focus();
  }
  function closeEditor() {
    var u = S.ui; if (!u || !u.ed) return; if (u.stopRec) try { u.stopRec(); } catch (e) {} if (u.edState && u.edState.src) try { u.edState.src.stop(); } catch (e) {}
    var name = u.edFor; u.ed.remove(); u.ed = null; u.edOpen = false; u.edState = null;
    var b = name && u.el && u.el.querySelector(".snd-row[data-n='" + cssq(name) + "'] [data-s=rep]"); if (b) try { b.focus({ preventScroll: true }); } catch (e) {}
  }
  function closed() { closeEditor(); }

  root.ArcadeSounds = { GROUPS: GROUPS, DESC: DESC, classify: classify, boot: boot, mount: mount, closed: closed, cut: cut, wav: wav, fit: fit, idb: idb, sync: syncGlobal, state: S, LIM: LIM };
  if (typeof document !== "undefined" && root.Arcade && root.Arcade.Audio) { try { boot(root.Arcade.Audio); } catch (e) {} }
})();
