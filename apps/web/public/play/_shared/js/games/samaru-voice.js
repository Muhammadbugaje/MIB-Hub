/* Freshers School Life — recorded human voices. Lines are looked up by a hash of their normalised text in
   static/audio/voice/manifest.json (written by tools/voice/cut.py from real people's recordings). A line with no
   recording keeps its words in the speech bubble and, by default, plays a recorded filler phrase that fits the speaker
   and the moment ("Haba!", "How far?", a laugh). With no filler that fits, a short wordless murmur. A machine voice
   only if the player picks "Fill unrecorded lines with: robot voice". */
(function () {
  "use strict";
  var Z = (typeof window !== "undefined" ? window : globalThis).SamaruGame; if (!Z) return;
  var V = Z.voice = { manifest: null, state: "", base: "", buffers: {}, order: [], live: {}, stats: { clip: 0, filler: 0, blip: 0, robot: 0 }, MAX: 90 };
  var src = ""; try { src = (document.currentScript && document.currentScript.src) || ""; } catch (e) {}
  V.base = src ? src.replace(/js\/games\/(samaru-voice|fslg\.bundle)(\.[0-9a-f]{6,})?\.js.*$/, "audio/voice/") : "";

  // The same two functions exist in tools/voice/make_script.js; ids must match exactly.
  V.norm = function (t) { var s = String(t == null ? "" : t).toLowerCase(); try { s = s.normalize("NFKD"); } catch (e) {} return s.replace(/[^a-z0-9]+/g, " ").replace(/^ +| +$/g, ""); };
  V.id = function (t) { var s = V.norm(t), h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return "v" + ("0000000" + h.toString(16)).slice(-8) + s.length.toString(36); };
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }

  V.setManifest = function (m) { V.manifest = m && m.clips ? m : { clips: {} }; V.fillers = null; V.state = "ready"; };
  V.tags = {};
  V.load = function () {
    if (V.state) return; V.state = "loading";
    try { fetch(V.base + "manifest.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(V.setManifest, function () { V.setManifest(null); }); } catch (e) { V.setManifest(null); }
    try { fetch(V.base + "tags.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (t) { if (t) V.tags = t; }, function () {}); } catch (e) {}
  };

  /* ---------- stand-in phrases for lines nobody has recorded ---------- */
  // What a line is doing (use) and how it feels (mood), from the tone note written beside it in the script when there
  // is one (tags.json), otherwise from its words and punctuation.
  var USES = [["greet", /^(how far|hello|hi\b|hey\b|good (morning|afternoon|evening)|sannu|ina (kwana|wuni)|kedu|bawo|welcome|assalamu|morning\b)/],
    ["bye", /\b(later|bye|see you|walk well|good night|sai (an|go)|take care|i('m| am) (off|going))\b/], ["thanks", /\b(thank|nagode|na gode|well done|god bless)\b/],
    ["sorry", /\b(sorry|my bad|forgive|no vex|excuse me)\b/], ["prayer", /\b(pray|mosque|church|service|allah|amen|juma)/], ["warn", /\b(careful|watch out|mind (yourself|your)|stop (there|it)|don'?t touch|i('m| am) warning|behave|look road|slow down|last time i)\b/],
    ["hurry", /\b(hurry|quick|faster|we are late|move!|oya|come on|wait for me|sharp sharp)\b/], ["fight", /\b(fight|hit|punch|slap|square up|collect|assault|beat)\b/], ["broke", /\b(garri|broke|money|naira|₦|alert|pay|owe)\b/],
    ["exam", /\b(exam|test|read|carry.?over|past question|cgpa|grade|result)\b/], ["food", /\b(chop|eat|food|hungry|jollof|suya|rice|tea|belle|buka|shawarma)\b/], ["night", /\b(dark|night|light|nepa|torch|shade|sleep)\b/],
    ["drive", /\b(drive|driver|keke|okada|bike|car|road|shuttle|hold body)\b/], ["phone", /\b(phone|call me|network|battery|whatsapp)\b/], ["lecture", /\b(lecture|class|attendance|board|hall|lecturer)\b/],
    ["shop", /\b(customer|buy|sell|price|how much|change)\b/], ["weather", /\b(sun|heat|harmattan|rain|dust|cold)\b/], ["encourage", /\b(you can|keep going|don'?t give up|try again|good job|nice one|sharp guy)\b/],
    ["agree", /^(yes|okay|ok\b|sure|no wahala|fine|correct|exactly|deal|alright)/], ["refuse", /^(no\b|never|not (now|today)|i can'?t|leave (it|that))/], ["ask", /\?$/]];
  var MOODS = [["angry-light", /(!\?|\?!|\b(are you (mad|blind)|wetin|stupid|how dare|you dare|idiot)\b)/], ["flirty", /\b(beautiful|fine (girl|boy)|date|cute|my love|sweet(heart)?)\b/], ["sad", /\b(sorry|miss|lost|cry|alone|gone|died|chai|ewo)\b/],
    ["worried", /\b(careful|help|please|abeg|scared|dark|shade|what was that|hurry)\b/], ["tired", /\b(tired|sleep|my legs|hungry|garri|weak|resign)\b/], ["happy", /\b(great|nice|good|thank|love|welcome|congrat|well done|sweet)\b/], ["excited", /!/], ["annoyed", /\b(haba|abeg|why|again)\b/]];
  V.infer = function (text, o) {
    o = o || {}; var t = V.tags[V.id(text)], mood = o.mood || "", use = o.use || "", s = String(text || "").toLowerCase().trim(), i;
    if (t) { t = t.split("|"); mood = mood || t[0]; use = use || t[1]; }
    for (i = 0; !use && i < USES.length; i++) if (USES[i][1].test(s)) use = USES[i][0];
    for (i = 0; !mood && i < MOODS.length; i++) if (MOODS[i][1].test(s)) mood = MOODS[i][0];
    return { mood: mood || "neutral", use: use || "react" };
  };
  function fillerList() {
    if (V.fillers) return V.fillers; var L = []; if (!V.manifest) return L;
    Object.keys(V.manifest.clips).forEach(function (id) { V.manifest.clips[id].forEach(function (c) { if (c.k === "filler" || /^filler(_[mf])?(@|$)/.test(c.g)) L.push(c); }); });
    return (V.fillers = L);
  }
  V.recent = {};
  // Choose a recorded phrase for this speaker: right voice (male/female), then the best match on use and mood, never
  // the same phrase twice within a minute for the same speaker, and one recorder per character so a voice stays put.
  V.pickFiller = function (text, o, now) {
    o = o || {}; var fem = o.voice === "female", list = fillerList().filter(function (c) { var g = c.g.split("@")[0]; return g === "filler" || (g === "filler_f") === fem; });
    if (!list.length) return null; now = now == null ? Date.now() : now;
    var who = V.speaker(o), want = V.infer(text, o), seenAt = V.recent[who] || (V.recent[who] = {}), h = hash(who), gs = [];
    list.forEach(function (c) { if (gs.indexOf(c.g) < 0) gs.push(c.g); }); gs.sort();
    var mine = gs[h % gs.length], best = null, bs = 0, salt = hash(V.norm(text) + who);
    list.forEach(function (c) {
      if (seenAt[c.id] && now - seenAt[c.id] < 60000) return;
      var t = c.t || ["", ""], sc = (t[1] === want.use ? 3 : 0) + (t[0] === want.mood ? 2 : 0) + (t[1] === "react" && (t[0] === "neutral" || t[0] === want.mood) ? .6 : 0);
      if (!sc) return; sc += (c.g === mine ? 1.5 : 0) + ((hash(c.id) ^ salt) % 997) / 997 * .4;
      if (sc > bs) { bs = sc; best = c; }
    });
    if (!best) return null; seenAt[best.id] = now;
    var vs = best.v && best.v.length ? best.v : [""], v = vs[(h >>> 8) % vs.length];
    return { clip: best, variant: v, url: V.base + best.g + "/" + best.id + (v ? "." + v : "") + "." + V.ext(), key: best.g + "/" + best.id + "." + v, filler: true, want: want };
  };
  V.filler = function (text, o, ctx) { var pk = V.pickFiller(text, o); if (!pk) return null; pk.text = text; V.play(pk, o, ctx); V.stats.filler = (V.stats.filler || 0) + 1; return pk; };
  V.ext = function () { if (V._ext) return V._ext; var e = "m4a"; try { var a = document.createElement("audio"); if (a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"')) e = "ogg"; } catch (err) {} return (V._ext = e); };

  // Who is speaking: stable per character, so one NPC always gets the same recorded speaker and variant.
  V.speaker = function (o) { return o.who || ((o.voice || "male") + ":" + (o.vi || 0) + ":" + Math.round((o.pitch || 1) * 20)); };
  // Pick one recording of this line: prefer a group of the right sex and kind, then spread speakers and variants by a stable hash.
  V.pick = function (text, o) {
    var m = V.manifest, list = m && m.clips[V.id(text)]; if (!list || !list.length) return null; o = o || {};
    var fem = o.voice === "female", want = o.group || "", pool = list.filter(function (c) { return want && (c.k === want || c.g.split("@")[0] === want); });
    if (!pool.length) pool = list.filter(function (c) { return /(_f|female)(@|$)/.test(c.g) ? fem : /(_m|male)(@|$)/.test(c.g) ? !fem : true; });
    if (!pool.length) pool = list;
    // c.v: plain variety takes ("" = as recorded, lo, hi); c.fx: a treatment this group always wears (radio, hall); c.x: optional ones (mega).
    var h = hash(V.speaker(o)), c = pool[h % pool.length], vs = c.v && c.v.length ? c.v : [""], v = o.fx && c.x && c.x.indexOf(o.fx) >= 0 ? o.fx : c.fx ? c.fx : vs[(h >>> 8) % vs.length];
    return { clip: c, variant: v, url: V.base + c.g + "/" + c.id + (v ? "." + v : "") + "." + V.ext(), key: c.g + "/" + c.id + "." + v };
  };
  V.buffer = function (pk, ac) {
    if (V.buffers[pk.key]) return V.buffers[pk.key];
    var p = fetch(pk.url).then(function (r) { if (!r.ok) throw new Error("no clip"); return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (ok, no) { var q = ac.decodeAudioData(ab, ok, no); if (q && q.then) q.then(ok, no); }); });
    V.buffers[pk.key] = p; V.order.push(pk.key); if (V.order.length > V.MAX) delete V.buffers[V.order.shift()];
    p.catch(function () { delete V.buffers[pk.key]; }); return p;
  };
  // Where the voice comes from: volume by distance and left/right by the camera, when the caller gives a world position.
  V.place = function (o) {
    if (!(isFinite(o.x) && isFinite(o.y)) || !Z.me) return { gain: 1, pan: 0 };
    var dx = o.x - Z.me.x, dy = o.y - Z.me.y, d = Math.hypot(dx, dy), yaw = Z.r3 && isFinite(Z.r3.yaw) ? Z.r3.yaw : 0;
    return { gain: Math.max(.08, 1 / (1 + Math.pow(d / 14, 1.6))), pan: d < .5 ? 0 : Math.max(-1, Math.min(1, Math.sin(Math.atan2(dy, dx) - yaw) * Math.min(1, d / 6))) };
  };
  function chain(ctx, o) {
    var ac = ctx.ac, g = ac.createGain(), pl = V.place(o); g.gain.value = (o.vol == null ? 1 : o.vol) * pl.gain;
    if (ac.createStereoPanner && pl.pan) { var pn = ac.createStereoPanner(); pn.pan.value = pl.pan; g.connect(pn); pn.connect(ctx.out); } else g.connect(ctx.out);
    return g;
  }
  function stop(key) { var l = V.live[key]; if (l) { try { l.stop(); } catch (e) {} delete V.live[key]; } }
  function duck(ctx, dur) {
    if (!ctx.music || !ctx.ac) return; var t = ctx.ac.currentTime, base = ctx.musicVol == null ? ctx.music.gain.value : ctx.musicVol;
    try { ctx.music.gain.cancelScheduledValues(t); ctx.music.gain.setTargetAtTime(base * .55, t, .05); ctx.music.gain.setTargetAtTime(base, t + dur + .15, .25); } catch (e) {}
  }
  // A wordless murmur: a few soft pitched syllables. Not speech, and never pretends to be.
  V.blip = function (text, o, ctx) {
    var ac = ctx.ac; if (!ac) return 0; var key = V.speaker(o); stop(key);
    var n = Math.max(2, Math.min(9, Math.round(V.norm(text).split(" ").length * 1.2))), f0 = (o.voice === "female" ? 235 : 140) * (o.pitch || 1), h = hash(V.norm(text) + key), out = chain(ctx, o), t = ac.currentTime + .01, nodes = [];
    for (var i = 0; i < n; i++) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; var f = f0 * (1 + ((h % 100) / 100 - .5) * .28) * (i === n - 1 ? .9 : 1), os = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(), d = .07 + (h % 7) * .006;
      os.type = "triangle"; os.frequency.setValueAtTime(f, t); os.frequency.linearRampToValueAtTime(f * (1 + ((h >>> 9) % 3 - 1) * .06), t + d); lp.type = "lowpass"; lp.frequency.value = 900 + (h % 500);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.16, t + .012); g.gain.linearRampToValueAtTime(0, t + d); os.connect(lp); lp.connect(g); g.connect(out); os.start(t); os.stop(t + d + .02); nodes.push(os); t += d + .028; }
    V.live[key] = { stop: function () { nodes.forEach(function (x) { try { x.stop(); } catch (e) {} }); } }; V.stats.blip++; return n;
  };
  V.play = function (pk, o, ctx) {
    var key = V.speaker(o); stop(key); var tok = V.live[key] = { stop: function () { tok.dead = true; if (tok.src) try { tok.src.stop(); } catch (e) {} } };
    V.buffer(pk, ctx.ac).then(function (buf) {
      if (tok.dead || V.live[key] !== tok) return; var s = ctx.ac.createBufferSource(); s.buffer = buf; if (o.rate && o.rate !== 1.05 && o.rate !== 1.1) s.playbackRate.value = Math.max(.9, Math.min(1.1, o.rate));
      s.connect(chain(ctx, o)); s.onended = function () { if (V.live[key] === tok) delete V.live[key]; }; tok.src = s; s.start(); duck(ctx, buf.duration);
    }, function () { if (!tok.dead && V.live[key] === tok) { delete V.live[key]; V.blip(pk.text || "", o, ctx); } });
    V.stats.clip++; V.warm(ctx);
  };
  // After the first spoken line, quietly fetch the lines heard all the time (tier A).
  V.warm = function (ctx) {
    if (V.warmed || !V.manifest) return; V.warmed = true; var ids = Object.keys(V.manifest.clips), todo = [], i = 0;
    ids.forEach(function (id) { V.manifest.clips[id].forEach(function (c) { if (c.p === "A" && todo.length < 60) todo.push({ url: V.base + c.g + "/" + c.id + (c.fx ? "." + c.fx : "") + "." + V.ext(), key: c.g + "/" + c.id + "." + (c.fx || "") }); }); });
    (function next() { if (i >= todo.length) return; var pk = todo[i++]; try { V.buffer(pk, ctx.ac).then(next, next); } catch (e) {} })();
  };
  // The hook arcade.js calls from Sound.say. Returns "clip", "filler", "blip", or "robot" (let speech synthesis read it).
  V.provider = function (text, o, ctx) {
    o = o || {}; ctx = ctx || {}; if (!V.state) V.load();
    var pk = V.state === "ready" ? V.pick(text, o) : null;
    if (pk && ctx.ac) { pk.text = text; V.play(pk, o, ctx); return "clip"; }
    var fill = ctx.fill || (ctx.robot ? "robot" : "phrases");
    if (fill === "robot") { V.stats.robot++; return "robot"; }
    if (fill === "phrases" && ctx.ac && V.state === "ready" && V.filler(text, o, ctx)) return "filler";
    V.blip(text, o, ctx); return "blip";
  };
  // What security shouts. The game shows these moments as text; with recordings in the "guards" group they are heard too.
  V.GUARD = {
    warn: ["Hey! Take it easy there!", "You! Behave yourself!", "I am watching you, my friend.", "Slow down! This is a school!"],
    final: ["I will not tell you again."],
    wanted: ["Stop there! Security!", "Hold it! Come back here!", "You! Stop!"],
    escaped: ["Where did that one go?", "Leave am. Next time."],
    caught: ["Got you. Come and explain yourself.", "You will pay a fine for this."],
    seen: ["There! By the road!"]
  };
  V.guard = function (kind, far) { var l = V.GUARD[kind]; if (!l || !Z.api || !Z.api.sound) return; V.gi = (V.gi || 0) + 1; Z.api.sound.say(l[V.gi % l.length], { voice: "male", pitch: .85, group: "guards", who: "guard", fx: far ? "mega" : "" }); };
  V.init = function (api) {
    try { if (!api || !api.sound || V.on) return; V.on = true; api.sound.provider = V.provider; V.load();
      var sub = Z.sub; if (sub) Z.sub = function (who, text, dur) { var r = sub.apply(Z, arguments); try { var m = /^Security: "(.+)"$/.exec(text || ""); if (m) api.sound.say(m[1], { voice: "male", pitch: .85, group: "guards", who: "guard" }); } catch (e) {} return r; };
      var emit = Z.emit; if (emit) Z.emit = function (ev) { var r = emit.apply(Z, arguments); try { if (ev && V.GUARD[ev.t] && !(ev.t === "warn" && ev.final)) V.guard(ev.t, ev.t === "wanted"); } catch (e) {} return r; };
    } catch (e) {}
  };
  // samaru-core's setup runs before this file loads its api, so hook in on the first frame instead of editing core.
  var tries = 0; (function arm() { if (Z.api && Z.api.sound) return V.init(Z.api); if (++tries < 200 && typeof setTimeout === "function") setTimeout(arm, 50); })();
})();
