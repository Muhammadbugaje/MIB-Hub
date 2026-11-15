/* Freshers School Life — the opening film, played once before m1 in the game's own 3D world (not a video).
   Script: docs/story/scripts/INTRO.md. Five acts:
     1 aerial   title cold open: slow flights over seven landmarks, a caption for each, the score's title cue;
     2 arrival  the family car comes through the Main Gate; Mum, Dad and you get out with the bags; Baba Porter
                carries them; you choose your room (m1's own choice step); at the hostel the bags go down and your
                roommate greets you; you hug both parents; they drive away while you wave;
     3 freshers the camera pulls back: other families unloading, hugs, suitcases dragged, a lost fresher, seniors heckling;
     4 brief    gameplay-style shots with one caption card each: the story, vehicles, a plane taking off, lectures
                indoors, security, friends, sundown into night, the market;
     5 logo     the game's name ({{GAME_NAME}}) over the Main Gate at golden hour, the music hit, then a smooth hand-off to
                control at the hostel with your roommate in front of you (m1 continues).
   The narration is the owner's own voice (static/audio/voice/intro/, cut by tools/intro/cut_narration.py); the score
   is original (static/audio/fslg-intro/, tools/intro/score.py) and ducks under him. Letterbox bars, captions,
   subtitles, the logo and a SKIP button (tap, or Esc) are DOM layers over the whole stage, so they fit phones in
   either orientation. Old saves skip it; Settings → "Replay opening" plays it again and changes nothing in the save. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData;
  if (!Z || !S) return;
  var I = Z.intro = { on: false }, TAU = Math.PI * 2, HP = Math.PI / 2;
  var LINES = {
    drive: [["intro_dad", "There it is. The gate. I drove through this same gate thirty years ago."], ["intro_mum", "You drove through it on a bicycle. Don't start."]],
    out: [["intro_mum", "Hold the suitcase properly. It has your whole life in it. And my good pot."], ["me", "Mum, why is the pot in my suitcase?"], ["intro_mum", "Because you will want soup at night, and I will not be here."]],
    porter: [["porter", "Welcome, welcome. Give me that. Your mother packed this? I can tell."], ["porter", "Come. Choose your room before the queue of mothers eats us."]],
    room: [["porter", "Room delivered. Bags delivered. Child delivered. My work is finished."]],
    hugs: [["intro_mum", "Eat. Read. Pray. Call me. In that order, but call me first."], ["intro_dad", "Don't follow bad friends. Follow good ones. Lead some."], ["me", "I will. Go before Mum cries."], ["intro_mum", "I'm not crying. It's the harmattan."]],
    away: [["intro_dad", "Bye! Bring back the Tupperware!"]],
    seniors: [["fx_senior1", "Fresher! Your mother is still at the gate!"], ["fx_lost", "Excuse me… which way is the Senate?"], ["fx_senior2", "Follow the orange building. You can't miss it. Everybody misses it."]]
  };
  var NARR = { legend: "Every legend on this campus started the same way, as a fresher.", stories: "One school, a thousand stories. So, which one is yours?",
    vehicles: "A variety of vehicles for you to ride and also drive.", fly: "Whoa, watch out there, whoa. And then sometimes you could even fly, so you could have the view from the top.",
    security: "Dodge security, bring your guys.", friends: "You can also play with friends, and when the sun goes down, the music changes, and there are lots of places you can visit at night.",
    welcome: "{{GAME_NAME}}, welcome to school." }; // his recording says the name; the subtitle follows the config
  var NDUR = { legend: 6.3, stories: 5.3, vehicles: 6.0, fly: 6.9, security: 2.85, friends: 8.2, welcome: 3.3 };
  I.LINES = LINES; I.NARR = NARR;
  // MASTER_GAME_GUIDE §6.4: every cutscene declares these. endState is what both watching and skipping leave behind.
  I.META = { id: "opening", skippable: true, playOnce: true, maxDuration: 420, requires: "a new game, m1 at its first step, the 3D view",
    endState: "you stand at your hostel door facing your roommate (the room you chose), parents and porter gone, the bags in your room, m1 at 'Greet your roommate', time of day restored, normal camera, HUD and music; a replay changes nothing" };
  I.endState = function () { var P = Z.P, me = Z.me, s = ST() && ST().state(P), h = P && Z.place(P.home), rm = ST() && Z.npc(ST().roomie()), st = Z.step && Z.step();
    return { roomie: s ? s.roomie || "" : "", home: P ? P.home : "", atHome: !!(h && Math.hypot(me.x - h.mx, me.y - h.my) < 12), roomieNear: !!(rm && Math.hypot(rm.x - me.x, rm.y - me.y) < 6), step: P ? P.m.active + ":" + (st ? st.t : "") : "", introDone: !!(s && s.introDone),
      tempsGone: !Z.npcs.some(function (n) { return n.temp; }) && !Z.cars.some(function (c) { return c.intro; }), inVehicle: !!me.veh, cameraFree: !(Z.r3 && Z.r3.shot), time: P ? P.time : 0 }; };
  function ST() { return Z.story; }
  function T(s) { return Z.text ? Z.text(s) : String(s); }
  function say(k) { if (ST()) ST().say(LINES[k]); }
  function busy() { return ST() && ST().busy(); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function W() { return Z.W; }

  /* ---------- audio: the owner's narration and the score, on the game's own Web Audio graph ---------- */
  var base = ""; try { var cs = document.currentScript && document.currentScript.src; if (cs) base = cs.replace(/js\/games\/(samaru-intro|fslg\.bundle)(\.[0-9a-f]{6,})?\.js.*$/, "audio/"); } catch (e) {}
  var A = { buf: {}, cue: null, mus: null };
  function snd() { var s = window.Arcade && Arcade.Sound; if (!s || s.muted) return null; try { if (!s.ac && s.ensure) s.ensure(); } catch (e) {} return s.ac ? s : null; }
  function ext() { if (A.ext) return A.ext; var e = "m4a"; try { var a = document.createElement("audio"); if (a.canPlayType && a.canPlayType('audio/ogg; codecs="opus"')) e = "ogg"; } catch (er) {} return (A.ext = e); }
  function load(path) {
    var s = snd(); if (!s || !base || typeof fetch !== "function") return null; if (A.buf[path]) return A.buf[path];
    A.buf[path] = fetch(base + path + "." + ext()).then(function (r) { if (!r.ok) throw new Error("missing"); return r.arrayBuffer(); }).then(function (ab) { return new Promise(function (ok, no) { var q = s.ac.decodeAudioData(ab, ok, no); if (q && q.then) q.then(ok, no); }); });
    A.buf[path].catch(function () {}); return A.buf[path];
  }
  function preload() { ["fslg-intro/title", "fslg-intro/bed", "fslg-intro/brief", "fslg-intro/logo"].concat(Object.keys(NARR).map(function (k) { return "voice/intro/" + k; })).forEach(load); }
  function musicBus() { var s = snd(); if (!s) return null; if (!A.mus) { A.mus = s.ac.createGain(); A.mus.gain.value = .9; A.mus.connect(s.music || s.master); } return A.mus; }
  function playCue(name, loop) { // crossfade to a score cue
    if (I.alog) I.alog.push([I.clock || 0, "cue", name, !!loop]); // what played when (the preview renderer and tests read it)
    var s = snd(), bus = musicBus(); if (!s || !bus) return; var old = A.cue, t = s.ac.currentTime;
    if (old) { try { old.g.gain.setTargetAtTime(0, t, .35); old.src.stop(t + 1.6); } catch (e) {} }
    var tok = A.cue = { name: name }; var p = load("fslg-intro/" + name); if (!p) return;
    p.then(function (b) { if (A.cue !== tok || !I.on) return; var src = s.ac.createBufferSource(), g = s.ac.createGain(); src.buffer = b; src.loop = !!loop; g.gain.value = 0; g.gain.setTargetAtTime(1, s.ac.currentTime, .25); src.connect(g); g.connect(bus); src.start(); tok.src = src; tok.g = g; }, function () {});
  }
  function duck(on) { var s = snd(); if (!s || !A.mus) return; try { A.mus.gain.setTargetAtTime(on ? .32 : .9, s.ac.currentTime, on ? .08 : .45); } catch (e) {} }
  function narrate(k) { // his voice, its subtitle, the music ducked under it
    I.narr = { k: k, until: I.clock + (NDUR[k] || 4) + .3 }; if (I.alog) I.alog.push([I.clock, "voice", k]); sub("", T(NARR[k]), NDUR[k] + .3, true); duck(true);
    var s = snd(), p = load("voice/intro/" + k); if (!s || !p) return;
    p.then(function (b) { if (!I.on || !I.narr || I.narr.k !== k) return; var src = s.ac.createBufferSource(), g = s.ac.createGain(); src.buffer = b; g.gain.value = 1.15; src.connect(g); g.connect(s.fx || s.master); src.onended = function () { if (I.narr && I.narr.k === k) duck(false); }; src.start(); A.voice = src; }, function () {});
  }
  function audioStop() { var s = snd(); if (A.voice) { try { A.voice.stop(); } catch (e) {} A.voice = null; } if (A.cue && A.cue.g && s) { try { A.cue.g.gain.setTargetAtTime(0, s.ac.currentTime, .4); A.cue.src.stop(s.ac.currentTime + 2); } catch (e) {} } A.cue = null; if (A.mus && s) { try { A.mus.gain.setTargetAtTime(.9, s.ac.currentTime, .5); } catch (e) {} } }
  function gameMusicOff() { var s = window.Arcade && Arcade.Sound; if (!s) return; s.song = null; try { clearTimeout(s.timer); } catch (e) {} }

  /* ---------- the film's own screen layers (DOM, over the whole stage) ---------- */
  var L = null;
  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent && parent.appendChild) parent.appendChild(e); return e; }
  var CSS = ".fslg-film{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#fff}" +
    ".fslg-film .bar{position:absolute;left:0;right:0;height:min(11vh,8.5vw);background:#000;transform-origin:top}.fslg-film .bar.t{top:0}.fslg-film .bar.b{bottom:0;transform-origin:bottom}" +
    ".fslg-film .fg-hide{display:none}" +
    ".fslg-film .fade{position:absolute;inset:0;background:#000;opacity:0}" +
    ".fslg-film .cap{position:absolute;left:max(16px,4vw);bottom:calc(min(11vh,8.5vw) + 14px);opacity:0;text-shadow:0 2px 12px rgba(0,0,0,.7)}" +
    ".fslg-film .cap.on{}.fslg-film .cap b{display:block;font-weight:800;letter-spacing:.18em;font-size:clamp(13px,1.7vmin + 6px,24px)}.fslg-film .cap i{display:block;font-style:normal;opacity:.82;letter-spacing:.08em;font-size:clamp(11px,1.1vmin + 5px,16px);margin-top:3px}" +
    ".fslg-film .cap:before{content:'';display:block;width:34px;height:3px;background:#f59e0b;margin-bottom:8px;border-radius:2px}" +
    ".fslg-film .card{position:absolute;left:50%;top:calc(min(11vh,8.5vw) + 18px);transform:translateX(-50%);opacity:0;padding:8px 18px;border-radius:999px;background:rgba(8,14,22,.62);border:1px solid rgba(253,224,71,.45);white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;font-weight:800;letter-spacing:.14em;font-size:clamp(12px,1.4vmin + 6px,20px);color:#fde68a}" +
    
    ".fslg-film .sub{position:absolute;left:50%;bottom:calc(min(11vh,8.5vw) + 12px);transform:translateX(-50%);width:min(92vw,820px);text-align:center;opacity:0;font-size:clamp(14px,1.6vmin + 8px,26px);line-height:1.3;text-shadow:0 2px 8px rgba(0,0,0,.9),0 0 2px #000}" +
    ".fslg-film .sub em{font-style:normal;color:#fde047;font-weight:800;margin-right:.4em}.fslg-film .sub.narr{font-style:italic;color:#fef3c7}" +
    ".fslg-film .logo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0}" +
    ".fslg-film .logo svg{width:min(34vmin,260px);height:auto;filter:drop-shadow(0 8px 30px rgba(0,0,0,.55))}" +
    ".fslg-film .logo h1{margin:.3em 0 0;font-weight:900;letter-spacing:.16em;font-size:clamp(22px,4.6vmin + 6px,64px);background:linear-gradient(180deg,#fff7d6,#f7b44a);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;text-align:center;line-height:1.05}" +
    ".fslg-film .logo p{margin:.6em 0 0;letter-spacing:.3em;font-size:clamp(10px,1vmin + 6px,15px);opacity:.85;text-transform:uppercase;text-align:center}" +
    ".fslg-skip{position:absolute;top:max(10px,calc(min(11vh,8.5vw) - 46px));right:max(12px,2vw);pointer-events:auto;min-width:96px;min-height:44px;padding:0 18px;border-radius:22px;border:1px solid rgba(255,255,255,.5);background:rgba(15,23,42,.6);color:#fff;font:800 15px system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;z-index:7}" +
    "";
  var EMBLEM = '<svg viewBox="0 0 1080 760" aria-hidden="true"><defs><linearGradient id="fslgSun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#f05a1f"/></linearGradient></defs>' +
    '<circle cx="540" cy="430" r="325" fill="url(#fslgSun)"/><rect x="264" y="254" width="552" height="82" rx="14" fill="#0c0d12"/><rect x="297" y="330" width="64" height="356" fill="#0c0d12"/><rect x="719" y="330" width="64" height="356" fill="#0c0d12"/>' +
    '<polygon points="523,480 556,480 666,686 414,686" fill="#0c0d12"/><g stroke="#0c0d12" stroke-width="12" fill="none"><path d="M210 686 L192 462 M192 462 L88 490 M192 462 L118 410 M192 462 L166 376 M192 462 L222 376 M192 462 L268 410 M192 462 L296 490"/>' +
    '<path d="M870 686 L888 462 M888 462 L992 490 M888 462 L962 410 M888 462 L914 376 M888 462 L858 376 M888 462 L812 410 M888 462 L784 490"/></g><rect x="135" y="684" width="810" height="24" fill="#f59e0b"/></svg>';
  function layers() {
    if (L || typeof document === "undefined") return L; try {
      var stage = document.querySelector("[data-gm-stage]"); if (!stage || !stage.appendChild) return null;
      if (!document.getElementById || !document.getElementById("fslg-film-css")) { var st = el("style", "", document.head || stage); st.id = "fslg-film-css"; st.textContent = CSS; }
      var root = el("div", "fslg-film", stage); L = { root: root, top: el("div", "bar t", root), bot: el("div", "bar b", root), cap: el("div", "cap", root), card: el("div", "card", root), sub: el("div", "sub", root),
        logo: el("div", "logo", root, EMBLEM + "<h1>" + esc(T("{{GAME_NAME}}")).toUpperCase().replace(" ", "<br>") + "</h1><p>" + esc(T("A game by {{AUTHOR}}")) + "</p>"), fade: el("div", "fade", root), skip: el("button", "fslg-skip", stage, "Skip ▸") };
      L.skip.setAttribute("aria-label", "Skip the opening"); L.skip.addEventListener("click", function (e) { if (e && e.stopPropagation) e.stopPropagation(); I.skip(); });
      L.skip.addEventListener("pointerdown", function (e) { if (e && e.stopPropagation) e.stopPropagation(); });
      document.querySelectorAll(".gm-touch").forEach(function (t) { t.setAttribute("data-film-hid", t.style.display || "-"); t.style.display = "none"; });
    } catch (e) { L = null; } return L;
  }
  function layersOff() { if (!L) return; try { if (L.root.parentNode) L.root.parentNode.removeChild(L.root); if (L.skip.parentNode) L.skip.parentNode.removeChild(L.skip); document.querySelectorAll("[data-film-hid]").forEach(function (t) { var v = t.getAttribute("data-film-hid"); t.style.display = v === "-" ? "" : v; t.removeAttribute("data-film-hid"); }); } catch (e) {} L = null; }
  function cls(e, c, on) { if (e && e.classList) e.classList[on ? "add" : "remove"](c); }
  function bars(on) { I.barsOn = on; }
  function fade(v, now) { I.fadeV = v; if (now) TW.fade = v; }
  var TW = {}; // current shown values, eased toward their targets on the game clock (CSS transitions do not run in every renderer)
  function tw(k, target, rate, dt) { var c = TW[k] == null ? target : TW[k]; c += (target - c) * (1 - Math.exp(-dt * rate)); if (Math.abs(target - c) < .004) c = target; TW[k] = c; return c; }
  function tween(dt) {
    var red = Z.api && Z.api.reduce, r = function (x) { return red ? 60 : x; };
    var b = tw("bars", I.barsOn ? 1 : 0, r(3.2), dt), f = I.fadeDirect != null ? (TW.fade = I.fadeDirect) : tw("fade", I.fadeV || 0, r(9), dt), c = tw("cap", I.capText ? 1 : 0, r(3.5), dt), k = tw("card", I.cardText ? 1 : 0, r(6), dt), s = tw("sub", I.subText ? 1 : 0, r(14), dt), l = tw("logo", I.logoOn ? 1 : 0, r(1.8), dt);
    I.logoS = I.logoOn ? Math.max(1, (I.logoS || 1.08) - dt * .03) : 1.08;
    if (!L) return; try {
      L.top.style.transform = L.bot.style.transform = "scaleY(" + b.toFixed(3) + ")"; L.fade.style.opacity = f.toFixed(3); L.cap.style.opacity = c.toFixed(3); L.cap.style.transform = "translateY(" + ((1 - c) * 8).toFixed(1) + "px)";
      L.card.style.opacity = k.toFixed(3); L.sub.style.opacity = s.toFixed(3); L.logo.style.opacity = l.toFixed(3); L.logo.style.transform = "scale(" + (I.logoS || 1).toFixed(4) + ")";
    } catch (e) {}
  }
  function caption(title, line) { I.capText = title ? T(title) : ""; if (!L) return; if (!title) { cls(L.cap, "on", false); return; } L.cap.innerHTML = "<b>" + esc(T(title)) + "</b>" + (line ? "<i>" + esc(T(line)) + "</i>" : ""); cls(L.cap, "on", true); }
  function card(text) { I.cardText = text || ""; if (!L) return; if (!text) { cls(L.card, "on", false); return; } L.card.textContent = text; cls(L.card, "on", true); }
  function logo(on) { I.logoOn = on; if (L) cls(L.logo, "on", on); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sub(who, text, dur, narr) { // every spoken line gets a subtitle
    I.subText = text; I.subUntil = I.clock + (dur || Math.max(2.2, 1.2 + String(text).length * .055)); I.subLog.push((who ? who + ": " : "") + text);
    if (!L) return; L.sub.innerHTML = (who && !narr ? "<em>" + esc(who) + "</em>" : "") + esc(text); cls(L.sub, "narr", !!narr); cls(L.sub, "on", true);
  }
  function subTick() { if (I.subText && I.clock > I.subUntil) { I.subText = ""; if (L) cls(L.sub, "on", false); } }

  /* ---------- people, vehicles and props used only by the film ---------- */
  function person(id, name, look) {
    var b0 = Z.npcs && Z.npcs[0]; if (!b0) return null; var old = Z.npc(id); if (old) Z.npcs.splice(Z.npcs.indexOf(old), 1);
    var n = {}; for (var k in b0) n[k] = b0[k];
    n.id = id; n.def = { id: id, name: name, role: "", at: "gate", skin: look.skin, hair: look.hair, hairCol: look.hairCol, top: look.top, voice: look.voice || "male", pitch: look.voice === "female" ? 1.05 : .9, hi: ["…"], temp: true };
    n.look = { skin: look.skin, hair: look.hair, hairCol: look.hairCol, top: look.top, pants: look.pants }; n.mode = look.mode || "tee"; n.temp = true; n.k = Z.npcs.length;
    n.follow = n.lead = false; n.hidden = false; n.wave = 0; n.hug = false; n.carry = false; n.sit = false; n.dance = false; n.film = false; n.st = ""; n.spd = 0; n.rideV = null; n.x = n.hx = 0; n.y = n.hy = 0; n.a = 0;
    Z.npcs.push(n); I.temps.push(n); return n;
  }
  var SKINS = ["#d6a67c", "#a06a42", "#c48f65", "#85532f", "#e0b088", "#6b4226", "#b07a4f", "#7a4a2b"], TOPS = ["#0ea5e9", "#f97316", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#14b8a6", "#f43f5e", "#e5e7eb", "#1d4ed8"];
  function extra(id, i, o) { o = o || {}; var f = o.female != null ? o.female : i % 2 === 1; return person(id, o.name || "Student", { skin: SKINS[i % SKINS.length], hair: o.hair || (f ? ["braids", "hijab", "bun", "afro"][i % 4] : ["low", "fade", "cap", "coily"][i % 4]), top: o.top || TOPS[(i * 3) % TOPS.length], pants: o.pants, voice: f ? "female" : "male", mode: o.mode || (i % 3 === 0 ? "ankara" : "tee") }); }
  function cast(id, npcId) { var d = (D.NPCS || []).filter(function (n) { return n.id === npcId; })[0] || {}; return person(id, d.name || "Friend", { skin: d.skin || "#6b4226", hair: d.hair || "low", hairCol: d.hairCol, top: d.top || "#0ea5e9", voice: d.voice, mode: "tee" }); }
  function at(n, x, y, a) { if (!n) return n; var f = S.push(W(), x, y, .5); n.x = n.hx = f.x; n.y = n.hy = f.y; if (a != null) n.a = a; return n; }
  function shade(hex, k) { var v = parseInt(String(hex).replace("#", ""), 16); if (!isFinite(v)) return hex; var c = [v >> 16 & 255, v >> 8 & 255, v & 255].map(function (q) { return Math.max(0, Math.min(255, Math.round(q * k))); }); return "#" + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1); }
  function walkTo(n, x, y, sp, dt) { var dx = x - n.x, dy = y - n.y, d = Math.hypot(dx, dy); if (d < .08) { n.spd = 0; return 0; } var s = Math.min(d, sp * dt); n.x += dx / d * s; n.y += dy / d * s; n.hx = n.x; n.hy = n.y; n.a = Math.atan2(dy, dx); n.spd = sp; n.walk = (n.walk || 0) + s; return d - s; }
  function face(n, o) { if (n && o) n.a = Math.atan2(o.y - n.y, o.x - n.x); }
  var VCOL = { bike: "#2563eb", okada: "#dc2626", keke: "#facc15", car: "#1d4ed8", sport: "#ef4444", plane: "#f59e0b", scooter: "#10b981" };
  function vehicle(type, x, y, a, col) { var c = { id: Z.cars.length, type: type, x: x, y: y, a: a || 0, vx: 0, vy: 0, speed: 0, col: col || VCOL[type] || "#e5e7eb", hx: x, hy: y, ha: a || 0, free: false, intro: true }; Z.cars.push(c); I.tcars.push(c); return c; }
  function drop(c) { var i = Z.cars.indexOf(c); if (i >= 0) Z.cars.splice(i, 1); }
  function guard(x, y) { var g = { x: x, y: y, a: 0, st: "chase", spd: 0, intro: true, t: 0 }; (Z.guards || (Z.guards = [])).push(g); return g; }
  // a stretch of road near a point, as a list of points about `len` metres long
  function road(x, y, len, flip) {
    var nr = S.nearRoad(W(), x, y, 250, true); if (!nr || !nr.r || !nr.r.p) return [{ x: x - len / 2, y: y }, { x: x + len / 2, y: y }];
    var p = nr.r.p, pts = [], best = 0, bd = 1e9, i; for (i = 0; i < p.length; i += 2) { var d = Math.hypot(p[i] - nr.x, p[i + 1] - nr.y); if (d < bd) { bd = d; best = i; } }
    var dir = flip ? -2 : 2, tot = 0; pts.push({ x: nr.x, y: nr.y });
    for (i = best; i >= 0 && i < p.length && tot < len; i += dir) { var q = { x: p[i], y: p[i + 1] }, l = pts[pts.length - 1]; if (Math.hypot(q.x - l.x, q.y - l.y) < .5) continue; tot += Math.hypot(q.x - l.x, q.y - l.y); pts.push(q); }
    if (tot < len * .5) return road(x, y, len, !flip && true);
    return pts;
  }
  function along(pts, s) { for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], b = pts[i], l = Math.hypot(b.x - a.x, b.y - a.y); if (s <= l || i === pts.length - 1) { var k = l ? Math.min(1, s / l) : 0; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: Math.atan2(b.y - a.y, b.x - a.x) }; } s -= l; } var z = pts[pts.length - 1]; return { x: z.x, y: z.y, a: 0 }; }
  // luggage: boxes in the 3D scene hanging from whoever carries them, or standing on the ground
  function bag(kind, holder) {
    var b = { holder: holder || null, at: null, kind: kind }; I.bags.push(b); meshBag(b); return b;
  }
  var BAGS = [[.42, .58, .2, 0x7c2d12, 0x1f2937], [.5, .34, .26, 0x1e3a8a, 0xfacc15], [.3, .36, .16, 0x166534, 0x1f2937], [.44, .62, .22, 0x6d28d9, 0x111827], [.46, .3, .24, 0xb91c1c, 0x111827]];
  function meshBag(b) {
    var R = Z.r3, K = R && R.ready && R.kit; if (!K || b.m) return; var T = K.T, s = BAGS[b.kind % BAGS.length], m = new T.Group();
    var body = new T.Mesh(new T.BoxGeometry(s[0], s[1], s[2]), new T.MeshLambertMaterial({ color: s[3] })); body.position.y = s[1] / 2; body.castShadow = true; m.add(body);
    var hd = new T.Mesh(new T.BoxGeometry(s[0] * .45, .05, .05), new T.MeshLambertMaterial({ color: s[4] })); hd.position.y = s[1] + .04; m.add(hd); K.scene.add(m); b.m = m; b.h = s[1];
  }
  function bagsStep() {
    var me = Z.me; me.carry = false; I.temps.forEach(function (n) { n.carry = false; }); if (I.porter) I.porter.carry = false; if (I.mum) I.mum.carry = false; if (I.dad) I.dad.carry = false;
    I.bags.forEach(function (b, i) {
      var h = b.holder; if (h) h.carry = true; meshBag(b); if (!b.m) return; var x, y, z = 0, a = 0;
      if (h && !h.hidden) { a = h.a || 0; var side = a + HP * (b.left ? -1 : 1), drag = b.drag ? .55 : 0; x = h.x + Math.cos(side) * .34 - Math.cos(a) * drag; y = h.y + Math.sin(side) * .34 - Math.sin(a) * drag; z = b.drag ? 0 : Math.max(0, .62 - b.h * .5); }
      else if (b.at) { x = b.at.x; y = b.at.y; a = b.at.a || 0; } else { b.m.visible = false; return; }
      var gy = W() && W().flat && S.wildH ? S.wildH(W(), x, y) : 0; b.m.visible = true; b.m.position.set(x, gy + .02 + z, y); b.m.rotation.set(b.drag ? -.5 : 0, -a, 0);
    });
  }
  function bagsClear() { I.bags.forEach(function (b) { if (b.m && b.m.parent) b.m.parent.remove(b.m); }); I.bags = []; }

  /* ---------- camera ---------- */
  // free shots: position and target ease toward `want`; scripted shots set both ends and are interpolated
  function want(x, h, y, tx, th, ty, cut) { var R = Z.r3; if (!R) return; var c = safe(x, y, { x: tx, y: ty }, h); I.want = { x: c.x, h: h, y: c.y, tx: tx, th: th, ty: ty }; if (cut || !R.shot) { R.shot = {}; for (var k in I.want) R.shot[k] = I.want[k]; } }
  function camStep(dt, rate) { var R = Z.r3, s = R && R.shot, w = I.want; if (!s || !w) return; var k = 1 - Math.exp(-dt * (rate || 2.2)); for (var q in w) s[q] += (w[q] - s[q]) * k; }
  function dolly(sh, t) { var e = ease(t), a = sh.from, b = sh.to, la = sh.look, lb = sh.look2 || sh.look; var R = Z.r3; if (!R) return; var px = lerp(a[0], b[0], e), py = lerp(a[2], b[2], e), c = safe(px, py, { x: lerp(la[0], lb[0], e), y: lerp(la[2], lb[2], e) }, lerp(a[1], b[1], e));
    R.shot = { x: c.x, h: lerp(a[1], b[1], e), y: c.y, tx: lerp(la[0], lb[0], e), th: lerp(la[1], lb[1], e), ty: lerp(la[2], lb[2], e) }; I.want = null; }
  function safe(x, y, from, h) { // never inside a building (above its roof is fine): walk the camera toward its subject until clear
    var cx = x, cy = y; for (var i = 0; i < 14; i++) { var b = S.insideBuilding(W(), cx, cy); if (!b || (h != null && h > (b.h3 || b.h || 12) + 1.5)) break; cx += (from.x - cx) * .2; cy += (from.y - cy) * .2; } return { x: cx, y: cy };
  }
  function orbit(o, r, h, ang, th) { return [o.x + Math.cos(ang) * r, h, o.y + Math.sin(ang) * r]; }
  function P_(id) { return Z.place(id) || Z.places.gate; }

  /* ---------- act 1: aerial ---------- */
  // subjects are the buildings (map coordinates: the gate is south, campus runs north); camera angles are around them
  var AERIAL = [
    { c: [0, -712], lh: 5, t: "MAIN GATE", l: "{{AUTHOR}} presents", r: 52, h: 20, a0: -1.95, a1: -1.35 },
    { c: [0, 30], lh: 18, t: "SENATE BUILDING", l: "Where every file begins", r: 100, h: 50, a0: -2.15, a1: -1.45 },
    { c: [0, 215], lh: 7, t: "KASHIM IBRAHIM LIBRARY", l: "Quiet, mostly", r: 135, h: 24, a0: -1.9, a1: -1.35 },
    { c: [-438, 140], lh: 6, t: "ENGINEERING QUAD", l: "KT · WT · the Tesla coil", r: 110, h: 44, a0: -.25, a1: .35 },
    { c: [0, 470], lh: 0, t: "THE DAM", l: "Baba Dam fishes here at dawn", r: 150, h: 55, a0: -1.85, a1: -1.3 },
    { c: [-40, -890], lh: 4, t: "SAMARU MARKET", l: "Everything has a price. Everything.", r: 95, h: 40, a0: 1.25, a1: 1.8 },
    { c: [1550, 237], lh: 6, t: "PHASE 2 HOSTELS", l: "Far. Very far. Bring a bicycle.", r: 125, h: 46, a0: -1.25, a1: -.65 }];
  var AER_DUR = 4.4;
  function aerialStep(dt) {
    var i = Math.floor(I.t / AER_DUR), t = (I.t % AER_DUR) / AER_DUR; if (i >= AERIAL.length) return next("arrive", 0);
    var s = AERIAL[i], c = { x: s.c[0], y: s.c[1] };
    if (I.aeri !== i) { I.aeri = i; caption(s.t, s.l); }
    var a = lerp(s.a0, s.a1, ease(t)), r = lerp(s.r, s.r * .82, ease(t));
    dolly({ from: orbit(c, s.r, s.h, s.a0), to: orbit(c, s.r * .82, s.h * .86, s.a1), look: [c.x, s.lh, c.y] }, t); void a; void r;
    var tin = I.t % AER_DUR; I.fadeDirect = i === 0 ? Math.max(0, 1 - I.t / 1.2) : tin < .35 ? 1 - tin / .35 : tin > AER_DUR - .35 ? (tin - (AER_DUR - .35)) / .35 : 0;
    if (tin > AER_DUR - .6) caption("");
  }

  /* ---------- act 2: arrival ---------- */
  function arriveInit() {
    var me = Z.me, G = Z.places.gate, F = Z.places.selfie || Z.places.senate, dx = F.mx - G.mx, dy = F.my - G.my, dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    var px = -dy, py = dx, nr = S.nearRoad(W(), G.mx, G.my, 60, true), rx = nr ? nr.x : G.mx, ry = nr ? nr.y : G.my;
    I.dir = { x: dx, y: dy }; I.perp = { x: px, y: py }; I.from = { x: rx - dx * 70, y: ry - dy * 70 }; var pk = S.push(W(), rx + dx * 16 + px * 4, ry + dy * 16 + py * 4, 1.4); I.park = { x: pk.x, y: pk.y };
    I.car = vehicle("car", I.from.x, I.from.y, Math.atan2(dy, dx), "#1d4ed8"); I.car.speed = 11; me.veh = I.car; me.x = I.car.x; me.y = I.car.y; me.a = I.car.a; me.emote = ""; me.sit = false; me.fall = 0; me.alt = 0;
    var pl = Z.charOf ? Z.charOf(Z.P.char) : {}, sk = (pl && pl.skin) || "#d6a67c", dk = shade(sk, .82); // Mum matches you; Dad is a shade deeper
    I.mum = person("intro_mum", "Mum", { skin: sk, hair: "hijab", hairCol: "#7c2d12", top: "#9d174d", pants: "#3f1d38", voice: "female", mode: "kaftan" }); I.mum.hidden = true;
    I.dad = person("intro_dad", "Dad", { skin: dk, hair: "cap", hairCol: "#f8fafc", top: "#e5e7eb", pants: "#e5e7eb", voice: "male", mode: "kaftan" }); I.dad.hidden = true;
    I.porter = Z.npc("porter"); if (I.porter) { I.porterHome = { x: I.porter.x, y: I.porter.y, hx: I.porter.hx, hy: I.porter.hy }; at(I.porter, I.park.x - px * 6 + dx * 4, I.park.y - py * 6 + dy * 4); face(I.porter, I.park); }
    I.fbags = [bag(0), bag(1), bag(2)]; I.fbags[1].left = true;
  }
  function arriveStep(dt) {
    var me = Z.me, c = I.car, mum = I.mum, dad = I.dad, po = I.porter;
    if (me.veh === c) { me.x = c.x; me.y = c.y; me.a = c.a; }
    switch (I.k) {
      case 0: { // the car drives through the gate and parks by the lodge
        var d = dist(c, I.park), a = Math.atan2(I.park.y - c.y, I.park.x - c.x); c.speed = Math.max(1.2, Math.min(11, d * .55)); if (d < .6) c.speed = 0;
        c.a += ((((a - c.a) % TAU) + TAU * 1.5) % TAU - Math.PI) * Math.min(1, dt * 3); c.vx = Math.cos(c.a) * c.speed; c.vy = Math.sin(c.a) * c.speed; c.x += c.vx * dt; c.y += c.vy * dt;
        want(c.x + I.perp.x * 9 - I.dir.x * 6, 3.2, c.y + I.perp.y * 9 - I.dir.y * 6, c.x + I.dir.x * 3, 1, c.y + I.dir.y * 3);
        if (I.t > 6.6 && !I.saidDrive) { I.saidDrive = 1; say("drive"); }
        if (d < .6 && I.t > 7.5 && I.saidDrive && !busy()) { c.speed = 0; c.vx = c.vy = 0; kstep(1); }
        break; }
      case 1: { // out of the car, with the luggage
        if (once()) {
          me.veh = null; var side = c.a + HP, fm = S.push(W(), c.x + Math.cos(side) * 1.6, c.y + Math.sin(side) * 1.6, .5); me.x = fm.x; me.y = fm.y; me.a = side;
          mum.hidden = dad.hidden = false; at(mum, c.x + Math.cos(side) * 1.7 + Math.cos(c.a) * 1.4, c.y + Math.sin(side) * 1.7 + Math.sin(c.a) * 1.4); at(dad, c.x - Math.cos(side) * 1.7 - Math.cos(c.a) * 1.6, c.y - Math.sin(side) * 1.7 - Math.sin(c.a) * 1.6);
          I.fbags[0].holder = me; I.fbags[1].holder = dad; I.fbags[2].holder = mum; say("out");
        }
        if (I.t < 2.5) walkTo(dad, c.x + Math.cos(c.a + HP) * 2.8 - Math.cos(c.a) * .9, c.y + Math.sin(c.a + HP) * 2.8 - Math.sin(c.a) * .9, 1.3, dt); else { dad.spd = 0; face(dad, me); }
        face(mum, me); if (I.t > .2) face(me, mum);
        var mid = { x: (me.x + mum.x) / 2, y: (me.y + mum.y) / 2 }; want(mid.x + Math.cos(c.a + HP) * 6.5 + Math.cos(c.a) * 3, 2.1, mid.y + Math.sin(c.a + HP) * 6.5 + Math.sin(c.a) * 3, mid.x, 1.3, mid.y);
        if (I.t > 3 && !busy()) kstep(2);
        break; }
      case 2: { // Baba Porter takes the bags
        if (once()) say("porter");
        if (po) { var left = walkTo(po, me.x + Math.cos(me.a) * 1.3, me.y + Math.sin(me.a) * 1.3, 2.6, dt); if (left < .1) { po.spd = 0; face(po, me); } face(me, po);
          if (left < .1 && I.t > 1.5 && I.fbags[0].holder !== po) { I.fbags[0].holder = po; I.fbags[1].holder = po; I.fbags[1].left = true; I.fbags[2].holder = dad; } }
        want(me.x + Math.cos(me.a + HP) * 5 - Math.cos(me.a) * 3, 2.2, me.y + Math.sin(me.a + HP) * 5 - Math.sin(me.a) * 3, (me.x + (po ? po.x : me.x)) / 2, 1.3, (me.y + (po ? po.y : me.y)) / 2);
        if (I.t > 4 && !busy()) kstep(I.replay ? 4 : 3);
        break; }
      case 3: { // the room choice (m1's own choice step, so the story records it)
        var st = ST(); if (!st) { kstep(4); break; }
        if (!I.asked) { I.asked = 1; toChoice(); var step = Z.step(); if (step && step.t === "choice" && !(Z.api.overlayOpen && Z.api.overlayOpen())) st.ask({ which: "main", id: "m1", i: Z.P.m.step, m: Z.mission(), st: step }, step); }
        if (st.state(Z.P).roomie && !(Z.api.overlayOpen && Z.api.overlayOpen())) kstep(4);
        break; }
      case 4: { // fade; inside your room the porter sets the bags down by the bed and your roommate is there; then back out
        if (once()) { fade(1); I.fadeAt = I.clock + .5; I.inRoom = 0; }
        if (I.fadeAt && I.clock >= I.fadeAt) { I.fadeAt = 0; atHostel(); intoRoom(); }
        if (I.inRoom === 1 && Z.inside) { I.inRoom = 2; I.roomT = I.t; roomSet(); fade(0); }
        if (I.inRoom === 1 && I.t > 4) { I.inRoom = 3; fade(0); } // the room would not open: stay outside
        if (I.inRoom === 2) { roomCam(dt); if (!I.greeted && I.t > I.roomT + .6) { I.greeted = 1; say("room"); greet(); } if (I.greeted && I.t > I.roomT + 3 && !busy() && !I.outAt) { fade(1); I.outAt = I.clock + .5; } }
        if (I.outAt && I.clock >= I.outAt) { I.outAt = 0; outOfRoom(); fade(0); I.inRoom = 3; I.outT = I.t; }
        if (I.inRoom === 3 && I.t > (I.outT || 0) + .6) kstep(5);
        if (I.inRoom === 3 && I.greeted === 0) { I.greeted = 1; say("room"); greet(); }
        break; }
      case 5: { // hugs
        var who = I.t < 3.4 ? mum : dad, oth = who === mum ? dad : mum, ang = Math.atan2(who.y - me.y, who.x - me.x), tx = who.x - Math.cos(ang) * .44 + Math.cos(ang + HP) * .17, ty = who.y - Math.sin(ang) * .44 + Math.sin(ang + HP) * .17;
        if (who !== I.hugWho) { I.hugWho = who; I.hugSide = null; } var gap = dist(me, who); if (dist(me, { x: tx, y: ty }) > .06) walkTo(me, tx, ty, 1.3, dt); else me.spd = 0; face(me, who); face(who, me); face(oth, me);
        me.emote = gap < .7 ? "hug" : ""; mum.hug = who === mum && gap < .7; dad.hug = who === dad && gap < .7;
        if (once()) { say("hugs"); I.hugCut = 1; }
        var m2 = { x: (me.x + who.x + oth.x) / 3, y: (me.y + who.y + oth.y) / 3 }, sd = I.hugSide; if (sd == null) { var pa = { x: m2.x + Math.cos(ang + HP) * 4.2, y: m2.y + Math.sin(ang + HP) * 4.2 }, pb = { x: m2.x - Math.cos(ang + HP) * 4.2, y: m2.y - Math.sin(ang + HP) * 4.2 }; sd = I.hugSide = !c || dist(pa, c) >= dist(pb, c) ? 1 : -1; } /* side-on to the hug, away from the car, both parents in frame */
        want(m2.x + Math.cos(ang + HP) * 5.6 * sd - Math.cos(ang) * 1.2, 2, m2.y + Math.sin(ang + HP) * 5.6 * sd - Math.sin(ang) * 1.2, m2.x, 1.25, m2.y, !!I.hugCut); I.hugCut = 0;
        if (I.t > 7.2 && !busy()) { me.emote = ""; mum.hug = dad.hug = false; I.hugWho = null; kstep(6); }
        break; }
      case 6: { // they drive away; you wave until the car is gone
        if (once()) { say("away"); I.fbags[2].holder = null; }
        var door = { x: c.x + Math.cos(c.a + HP) * 1.5, y: c.y + Math.sin(c.a + HP) * 1.5 }, l1 = walkTo(mum, door.x, door.y, 1.5, dt), l2 = walkTo(dad, door.x - Math.cos(c.a) * 1.2, door.y - Math.sin(c.a) * 1.2, 1.5, dt);
        if (l1 < .1) mum.hidden = true; if (l2 < .1) dad.hidden = true;
        if (mum.hidden && dad.hidden) { c.speed = Math.min(12, (c.speed || 0) + dt * 3.5); c.vx = Math.cos(c.a) * c.speed; c.vy = Math.sin(c.a) * c.speed; c.x += c.vx * dt; c.y += c.vy * dt; }
        face(me, c); me.emote = "wave"; me.emoteT = 1;
        want(me.x - Math.cos(me.a) * 3.4 + Math.cos(me.a + HP) * 1.2, 2.3, me.y - Math.sin(me.a) * 3.4 + Math.sin(me.a + HP) * 1.2, c.x, 1.2, c.y);
        if (dist(c, me) > 55 || I.t > 14) { me.emote = ""; next("freshers", 0); }
        break; }
    }
    camStep(dt);
  }
  function kstep(k) { I.k = k; I.t = 0; I.did = -1; }
  function once() { if (I.did === I.k) return false; I.did = I.k; return true; } // the first tick of a beat
  // advance m1 to its room choice (gate and porter are done by the film)
  function toChoice() { var P = Z.P, st = ST(); if (!st || P.m.active !== "m1") return; for (var g = 0; g < 4; g++) { var s = Z.step(); if (!s || s.t === "choice") break; Z.emit(st.auto(s)); } }
  function atHostel() {
    var me = Z.me, H = Z.place("@home") || Z.places.gate, c = I.car, nr = S.nearRoad(W(), H.mx, H.my, 80, true);
    var rx = nr ? nr.x : H.mx + 8, ry = nr ? nr.y : H.my + 8, ra = nr && nr.r ? Math.atan2(nr.r.p[3] - nr.r.p[1], nr.r.p[2] - nr.r.p[0]) : 0;
    if (c) { var ca = isFinite(ra) ? ra : 0, cf = S.push(W(), rx + Math.cos(ca) * 12, ry + Math.sin(ca) * 12, 1.2); c.x = c.hx = cf.x; c.y = c.hy = cf.y; c.a = ca; c.speed = 0; c.vx = c.vy = 0; }
    var dir = Math.atan2(H.my - ry, H.mx - rx), sp = S.push(W(), H.mx - Math.cos(dir) * 3, H.my - Math.sin(dir) * 3, .5); me.x = sp.x; me.y = sp.y; me.a = dir; me.veh = null; me.alt = 0;
    if (I.mum) { at(I.mum, me.x - Math.cos(dir) * 1.4 + Math.cos(dir + HP) * 1.2, me.y - Math.sin(dir) * 1.4 + Math.sin(dir + HP) * 1.2); I.mum.hidden = false; }
    if (I.dad) { at(I.dad, me.x - Math.cos(dir) * 1.6 - Math.cos(dir + HP) * 1.3, me.y - Math.sin(dir) * 1.6 - Math.sin(dir + HP) * 1.3); I.dad.hidden = false; }
    var po = I.porter; if (po) { at(po, H.mx + Math.cos(dir + HP) * 1.8, H.my + Math.sin(dir + HP) * 1.8); face(po, me); }
    (I.fbags || []).forEach(function (b, i) { b.holder = null; b.at = { x: H.mx + Math.cos(dir + HP) * (.5 + i * .55) - Math.cos(dir) * .4, y: H.my + Math.sin(dir + HP) * (.5 + i * .55) - Math.sin(dir) * .4, a: dir }; }); // set down at the door of your room
    var rid = ST() ? ST().roomie() : "", rm = rid && Z.npc(rid); if (rm) { at(rm, H.mx - Math.cos(dir + HP) * 1.2, H.my - Math.sin(dir + HP) * 1.2); face(rm, me); rm.wave = 2; }
    I.roomieNpc = rm || null; if (I.mum) face(me, I.mum); I.home = { x: me.x, y: me.y, a: dir, H: H };
    want(me.x - Math.cos(dir) * 6 + Math.cos(dir + HP) * 3, 2.6, me.y - Math.sin(dir) * 6 + Math.sin(dir + HP) * 3, H.mx, 1.4, H.my, true);
  }
  function intoRoom() { // you, the porter (with the bags) and your roommate go in
    var me = Z.me, H = I.home.H; noVeh(); if (I.porter) { I.porter.x = me.x + .8; I.porter.y = me.y; }
    if (Z.interior && Z.interior.enter && Z.interior.typeOf && Z.interior.typeOf(H) === "hostel" && Z.interior.enter(H)) I.inRoom = 1; else { I.inRoom = 3; I.greeted = 0; }
  }
  function roomSet() {
    var c = Z.inside, me = Z.me, bed = (c.room.spots || []).filter(function (s) { return s.label === "Your bed"; })[0] || { x: 1.5, y: 4 }, po = I.porter;
    I.bed = { x: c.ox + bed.x, y: c.oy + bed.y };
    if (po) { var pp = { x: I.bed.x + 1.25, y: I.bed.y - .7 }; po.x = po.hx = pp.x; po.y = po.hy = pp.y; face(po, me); }
    (I.fbags || []).forEach(function (b, i) { b.holder = null; b.at = { x: I.bed.x - .7 + i * .48, y: I.bed.y - .55, a: 0 }; }); // down by the bed
    var rm = I.roomieNpc; if (rm && Math.abs(rm.y - c.oy) > 60) { rm.x = rm.hx = c.ox + 1.9; rm.y = rm.hy = c.oy + 5.4; } if (rm) { face(rm, me); rm.wave = 2; }
    face(me, rm || po);
  }
  function tall() { try { var st = document.querySelector("[data-gm-stage]"); return !!st && st.clientHeight > st.clientWidth * 1.05; } catch (e) { return false; } }
  function roomCam(dt) { var c = Z.inside, me = Z.me; if (!c || !I.bed) return; var w = c.room.w || 6, d = c.room.d || 8, mx = (me.x + I.bed.x) / 2, my = (me.y + I.bed.y) / 2;
    if (tall()) want(c.ox + w * .3, 2.9, c.oy + .7, I.bed.x + .5, .8, I.bed.y - .5, !I.rcam); /* a phone held upright: from the door, past you, to the bags by the bed and the porter */
    else want(c.ox - w * .38, 2.1, c.oy + .7, mx, 1.1, my, !I.rcam); I.rcam = 1; camStep(dt, 6); }
  function outOfRoom() { // back outside at the door for the goodbye; the bags stay in the room
    if (Z.interior && Z.inside) Z.interior.leaveNow(); I.rcam = 0; var me = Z.me, h = I.home; me.x = h.x; me.y = h.y; me.a = h.a;
    (I.fbags || []).forEach(function (b) { b.holder = null; b.at = null; });
    if (I.porter && I.porterHome) { var ph = I.porterHome; I.porter.x = ph.x; I.porter.y = ph.y; I.porter.hx = ph.hx; I.porter.hy = ph.hy; } // back to his lodge
    var rm = I.roomieNpc; if (rm) { at(rm, h.H.mx - Math.cos(h.a + HP) * 3.4, h.H.my - Math.sin(h.a + HP) * 3.4); face(rm, me); }
    if (I.mum) { at(I.mum, me.x - Math.cos(h.a) * 1.5 + Math.cos(h.a + HP) * .9, me.y - Math.sin(h.a) * 1.5 + Math.sin(h.a + HP) * .9); face(I.mum, me); }
    if (I.dad) { at(I.dad, me.x - Math.cos(h.a) * 1.7 - Math.cos(h.a + HP) * .9, me.y - Math.sin(h.a) * 1.7 - Math.sin(h.a + HP) * .9); face(I.dad, me); }
    face(me, I.mum); me.a = h.a + Math.PI;
  }
  function greet() { // the chosen roommate's own opening lines from m1
    var rid = ST() && ST().roomie(), m1 = (D.MISSIONS || []).filter(function (m) { return m.id === "m1"; })[0]; if (!m1 || !rid) return;
    var st = m1.steps.filter(function (s) { return s.t === "go" && s.place === "@hostel"; })[0]; if (!st || !st.lines) return;
    ST().say(st.lines.filter(function (l) { return l[3] === "room_" + rid; }).slice(0, 2));
  }

  /* ---------- act 3: other freshers arriving ---------- */
  function freshersInit() {
    var me = Z.me, H = I.home ? I.home.H : P_("@home"), a = I.home ? I.home.a : 0, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    function spot(f, s) { return { x: H.mx - ux * f + vx * s, y: H.my - uy * f + vy * s }; }
    var c1 = spot(16, -9), c2 = spot(18, 10); I.fc1 = vehicle("car", c1.x, c1.y, a + HP, "#e5e7eb"); I.fc2 = vehicle("car", c2.x, c2.y, a - HP, "#16a34a");
    var fam = [extra("fx_f1", 0, { female: false }), extra("fx_m1", 1, { female: true, hair: "hijab", mode: "kaftan", top: "#7c3aed" }), extra("fx_d1", 2, { female: false, hair: "cap", mode: "kaftan", top: "#f8fafc" })];
    at(fam[0], c1.x + vx * 1.6, c1.y + vy * 1.6, a); at(fam[1], c1.x + vx * 1.6 + ux * .8, c1.y + vy * 1.6 + uy * .8); at(fam[2], c1.x + vx * 2.4 - ux * 1.5, c1.y + vy * 2.4 - uy * 1.5); face(fam[0], fam[1]); face(fam[1], fam[0]); fam[0].hug = fam[1].hug = true;
    bag(3, fam[2]); bag(4).at = { x: c1.x + vx * 2.2, y: c1.y + vy * 2.2, a: a };
    var drag = [extra("fx_s1", 3, { female: true }), extra("fx_s2", 4, { female: false })]; at(drag[0], c2.x - vx * 2, c2.y - vy * 2); at(drag[1], c2.x - vx * 3.5 + ux * 2, c2.y - vy * 3.5 + uy * 2);
    drag.forEach(function (n, i) { var b = bag(i === 0 ? 3 : 0, n); b.drag = true; n.goal = spot(4 + i * 2, i ? 3 : -3); });
    I.lost = at(extra("fx_lost", 5, { female: false, top: "#fde047", name: "Lost fresher" }), H.mx - ux * 9 + vx * 2, H.my - uy * 9 + vy * 2, a); I.lost.film = true; bag(1, I.lost).left = true;
    I.sen = [at(extra("fx_senior1", 6, { female: false, top: "#111827", mode: "ankara", name: "Senior" }), H.mx - ux * 6 + vx * 6.5, H.my - uy * 6 + vy * 6.5), at(extra("fx_senior2", 7, { female: true, top: "#be123c", name: "Senior" }), H.mx - ux * 6.8 + vx * 7.6, H.my - uy * 6.8 + vy * 7.6)];
    I.sen.forEach(function (n) { face(n, I.lost); }); I.drag = drag; I.fam = fam;
    playCue("bed", true); narrate("stories");
  }
  function freshersStep(dt) {
    var me = Z.me, H = I.home ? I.home.H : P_("@home"), a = I.home ? I.home.a : 0, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    if (once2("fr")) freshersInit();
    I.drag.forEach(function (n) { if (walkTo(n, n.goal.x, n.goal.y, 1.1, dt) < .1) n.spd = 0; });
    if (I.t > 5.8) { I.lost.film = false; I.lost.a += dt * 1.6; } // turning round, lost
    if (I.t > 5.2 && !I.saidSen) { I.saidSen = 1; say("seniors"); }
    if (I.t > 1 && I.t < 4.5) I.sen.forEach(function (n) { n.wave = 1; }); else I.sen.forEach(function (n) { n.wave = 0; });
    // camera: crane up and back from you, then drift across the forecourt
    var cx = H.mx - ux * 9, cy = H.my - uy * 9, k = ease(I.t / 14);
    var fx = H.mx - ux * 15, fy = H.my - uy * 15; // between the two families' cars
    var rd = I.froad || (I.froad = S.nearRoad(W(), H.mx, H.my, 80, true) || { x: fx, y: fy }), ra2 = rd.r && rd.r.p ? Math.atan2(rd.r.p[3] - rd.r.p[1], rd.r.p[2] - rd.r.p[0]) : Math.atan2(vy, vx), sg = Math.cos(ra2) * vx + Math.sin(ra2) * vy >= 0 ? 1 : -1, rvx = Math.cos(ra2) * sg, rvy = Math.sin(ra2) * sg; // stand on the road itself, looking along the frontage
    var cxa = rd.x + rvx * 26, cya = rd.y + rvy * 26, cxb = rd.x + rvx * 19, cyb = rd.y + rvy * 19, lx = (rd.x + H.mx) / 2 - rvx * 2, ly = (rd.y + H.my) / 2 - rvy * 2;
    if (I.t < 3) { var e = ease(I.t / 3); want(lerp(me.x - ux * 3.4, cxa, e), lerp(3.4, 5, e), lerp(me.y - uy * 3.4, cya, e), lerp(me.x, lx, e), 1.2, lerp(me.y, ly, e)); camStep(dt, 3); }
    else { want(lerp(cxa, cxb, k), lerp(5, 3.8, k), lerp(cya, cyb, k), lx, 1.3, ly); camStep(dt, 1.2); }
    if (I.t > 13.5 && !busy()) next("brief", 0);
  }
  function once2(k) { if (I.once2 === I.ph + k) return false; I.once2 = I.ph + k; return true; }

  /* ---------- act 4: the brief ---------- */
  // each shot: d = seconds, card text, n = narration to start, time = clock time (minutes), init/step
  var BRIEF = [
    { d: 3.6, card: "120 MISSIONS · FIVE YEARS · ONE CAMPUS", time: 17 * 60 + 10, init: function (s) { s.crew = crew(3, -62, HP); }, step: function (s, t, dt) { walkCrew(s, dt, 1.4); var me = Z.me; dolly({ from: [me.x + 2.5, 1.5, me.y - 9], to: [me.x + 1.8, 1.4, me.y - 7], look: [0, 16, 30], look2: [0, 20, 30] }, t); } },
    { d: 1.6, card: "RIDE AND DRIVE", n: "vehicles", time: 9 * 60, init: function (s) { ride(s, "bike", "library", 7); }, step: rideStep },
    { d: 1.5, time: 9 * 60 + 30, init: function (s) { ride(s, "okada", "market", 13); }, step: rideStep },
    { d: 1.5, time: 10 * 60, init: function (s) { ride(s, "keke", "gate", 10); }, step: rideStep },
    { d: 1.7, time: 10 * 60 + 30, init: function (s) { ride(s, "car", "fslt", 16); }, step: rideStep },
    { d: 2.6, card: "WATCH OUT", n: "fly", time: 13 * 60, init: function (s) { ride(s, "sport", "selfie", 17, true); var a = along(s.path, 26), ux = Math.cos(a.a), uy = Math.sin(a.a); s.peds = [0, 1, 2].map(function (i) { return at(extra("fx_p" + i, i + 2), a.x - uy * (3.6 + i * .5) + ux * (i - 1) * 1.1, a.y + ux * (3.6 + i * .5) + uy * (i - 1) * 1.1, a.a + HP); }); },
      step: function (s, t, dt) { rideStep(s, t, dt); var me = Z.me; s.peds.forEach(function (n) { var d = dist(n, me); n.st = d < 9 ? "yield" : ""; if (d < 9) face(n, me); }); if (me.veh) me.veh.a = me.a + Math.sin(Math.min(1, t * 1.6) * Math.PI) * .55; } },
    { d: 4.4, card: "FLY", time: 16 * 60 + 30, init: function (s) { var me = Z.me; s.c = vehicle("plane", -650, 560, 0); me.veh = s.c; me.x = s.c.x; me.y = s.c.y; me.a = 0; me.alt = 0; s.v = 6; },
      step: function (s, t, dt) { var me = Z.me, c = s.c; s.v = Math.min(34, s.v + dt * 14); c.speed = s.v; c.x += s.v * dt; c.vx = s.v; me.x = c.x; me.y = c.y; me.a = 0; c.a = 0; me.alt = t > .42 ? Math.min(.5, me.alt + dt * .16) : 0; I.hideMe = true;
        var alt = me.alt * 38; want(c.x - 7 + 10 * t, 1.8 + alt * .8, 560 + 8.5 - 2 * t, c.x + 3, 1.3 + alt, 560, t === 0); camStep(dt, 5); } },
    { d: 3.4, card: "LECTURES · LABS · HALLS YOU WALK INTO", time: 10 * 60 + 15, init: function (s) { var me = Z.me; noVeh(); var pl = P_("theatre"); me.x = pl.mx; me.y = pl.my + 2; me.a = -HP; s.ok = Z.interior && Z.interior.enter && Z.interior.enter(pl); s.pl = pl; s.sat = 0; },
      step: function (s, t, dt) { var c = Z.inside; if (c && c.room && !s.sat) { s.sat = 1; (c.room.seats || []).filter(function (q) { return (q.h || 0) < .4; }).slice(0, 16).forEach(function (q, k) { var n = extra("fx_t" + k, k + 1); n.x = n.hx = c.ox + q.x; n.y = n.hy = c.oy + q.y; n.a = HP; n.sit = true; }); }
        if (c && c.room) { var w = c.room.w || 14, d = c.room.d || 20; dolly({ from: [c.ox + w * .42, 2.6, c.oy + d * .93], to: [c.ox + w * .3, 2.3, c.oy + d * .9], look: [c.ox - w * .12, 1.4, c.oy + d * .55] }, t); } else { var p = s.pl; dolly({ from: [p.mx + 20, 8, p.my + 20], to: [p.mx + 12, 5, p.my + 14], look: [p.mx, 3, p.my] }, t); } },
      done: function () { if (Z.interior && Z.inside) Z.interior.leaveNow(); } },
    { d: 2.2, card: "DODGE SECURITY", n: "security", time: 15 * 60, init: function (s) { var me = Z.me; noVeh(); s.path = road(P_("selfie").mx, P_("selfie").my, 60); var a = along(s.path, 4); me.x = a.x; me.y = a.y; me.a = a.a; s.g = [guard(0, 0), guard(0, 0)]; s.g.forEach(function (g, i) { var b = along(s.path, 0); g.x = b.x - Math.cos(b.a + HP) * (i - .5) * 1.4; g.y = b.y - Math.sin(b.a + HP) * (i - .5) * 1.4; g.a = b.a; }); s.s = 4; },
      step: function (s, t, dt) { var me = Z.me; s.s += 7.6 * dt; var a = along(s.path, s.s); me.x = a.x; me.y = a.y; me.a = a.a; me.cs = 7.6; me.speed = 7.6; s.g.forEach(function (g, i) { var b = along(s.path, s.s - 4.2 - i * 1.3); g.x = b.x + Math.cos(b.a + HP) * (i - .5) * 1.3; g.y = b.y + Math.sin(b.a + HP) * (i - .5) * 1.3; g.a = b.a; g.spd = 7.4; });
        var ahead = along(s.path, s.s + 7); want(ahead.x + Math.cos(ahead.a + HP) * 2.2, 1.7, ahead.y + Math.sin(ahead.a + HP) * 2.2, me.x, 1.2, me.y, t === 0); camStep(dt, 6); },
      done: function () { Z.me.cs = 0; Z.me.speed = 0; Z.guards = (Z.guards || []).filter(function (g) { return !g.intro; }); } },
    { d: 1.8, card: "BRING YOUR GUYS", time: 15 * 60 + 20, init: function (s) { var p = P_("enggarden"); s.crew = crew(p.mx + 6, p.my + 8, .6); Z.me.x = s.crew.lead.x; Z.me.y = s.crew.lead.y; },
      step: function (s, t, dt) { walkCrew(s, dt, 1.7); var me = Z.me, a = s.crew.dir; want(me.x + Math.cos(a) * 6.5 + Math.cos(a + HP) * 1.5, 1.8, me.y + Math.sin(a) * 6.5 + Math.sin(a + HP) * 1.5, me.x, 1.3, me.y, t === 0); camStep(dt, 5); } },
    { d: 2.6, card: "PLAY WITH FRIENDS", n: "friends", time: 16 * 60 + 40, init: function (s) { var me = Z.me, p = P_("social"); noVeh(); me.x = p.mx + 3; me.y = p.my + 9; me.a = HP; me.emote = "dance"; me.emoteT = 9;
        s.f = ["bature", "firdausi", "abbas", "nusaybah"].map(function (id, i) { var n = cast("fx_c" + i, id); var ang = i / 4 * TAU; return at(n, me.x + Math.cos(ang) * 2.2, me.y + Math.sin(ang) * 2.2); }); s.f.forEach(function (n) { n.dance = true; face(n, me); }); s.c = { x: me.x, y: me.y }; },
      step: function (s, t, dt) { var c = s.c, ang = .4 + t * 1.2; dolly({ from: orbit(c, 7.5, 2.6, ang), to: orbit(c, 6.5, 2.2, ang + .5), look: [c.x, 1.2, c.y] }, t); },
      done: function () { Z.me.emote = ""; } },
    { d: 3.2, card: "THE SUN GOES DOWN…", time: 17 * 60 + 25, init: function () { noVeh(); Z.me.x = 3; Z.me.y = -150; }, step: function (s, t) { Z.P.time = lerp(17 * 60 + 25, 19 * 60 + 45, ease(t)); dolly({ from: [-78, 34, -118], to: [-60, 26, -98], look: [0, 20, 30] }, t); } },
    { d: 2.8, card: "…AND THE NIGHT STARTS", time: 20 * 60 + 5, init: function (s) { var p = P_("social"), me = Z.me; s.p = p; noVeh(); me.x = p.mx; me.y = p.my - 4; me.a = -HP; me.emote = "dance"; me.emoteT = 9; s.f = [0, 1, 2, 3, 4, 5].map(function (i) { var ang = i / 6 * TAU, n = extra("fx_n" + i, i + 1); at(n, me.x + Math.cos(ang) * 2.6, me.y + Math.sin(ang) * 2.6); n.dance = i % 3 !== 2; n.a = ang + Math.PI; return n; }); },
      step: function (s, t) { var me = Z.me; dolly({ from: [me.x + 9, 3.2, me.y + 8], to: [me.x + 6, 2.4, me.y + 5.5], look: [me.x, 1.4, me.y - 1] }, t); }, done: function () { Z.me.emote = ""; } },
    { d: 3.4, card: "THE MARKET AND THE MALL", time: 11 * 60, init: function (s) { var p = { mx: -82, my: -836 }; s.p = p; noVeh(); Z.me.x = -60; Z.me.y = -826; s.f = [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { var n = extra("fx_m" + i, i + 3); var ang = i * 2.3; at(n, p.mx + Math.cos(ang) * (5 + i), p.my + Math.sin(ang) * (5 + i)); n.goal = { x: p.mx + Math.cos(ang + 2) * (6 + i), y: p.my + Math.sin(ang + 2) * (6 + i) }; if (i % 3 === 0) bag(1 + (i % 2), n); return n; }); },
      step: function (s, t, dt) { var p = s.p; s.f.forEach(function (n) { if (walkTo(n, n.goal.x, n.goal.y, 1.3, dt) < .1) n.spd = 0; }); dolly({ from: [p.mx + 34, 9, p.my + 22], to: [p.mx + 22, 5.5, p.my + 12], look: [p.mx, 2.5, p.my - 10], look2: [p.mx + 10, 5, p.my - 70] }, t); } },
    { d: 3.0, time: 18 * 60 + 35, init: function () { noVeh(); Z.me.x = 3; Z.me.y = -560; }, step: function (s, t) { dolly({ from: [8, 14, -560], to: [3, 6, -628], look: [0, 6, -712] }, t); } }];
  function noVeh() { var me = Z.me; if (me.veh) { if (me.veh.intro) drop(me.veh); me.veh = null; } me.alt = 0; me.emote = ""; me.sit = false; }
  function ride(s, type, place, v, fast) { var me = Z.me, p = P_(place); noVeh(); s.path = road(p.mx, p.my, v * 6 + 30); s.v = v; s.s = 6; var a = along(s.path, s.s); s.c = vehicle(type, a.x, a.y, a.a); me.veh = s.c; me.x = a.x; me.y = a.y; me.a = a.a; s.side = fast ? -1 : 1; }
  function rideStep(s, t, dt) { I.hideMe = s.c && (s.c.type === "car" || s.c.type === "plane"); var me = Z.me, c = s.c; s.s += s.v * dt; var a = along(s.path, s.s); c.x = c.hx = a.x; c.y = c.hy = a.y; c.a = a.a; c.speed = s.v; c.vx = Math.cos(a.a) * s.v; c.vy = Math.sin(a.a) * s.v; me.x = c.x; me.y = c.y; me.a = a.a;
    var ux = Math.cos(a.a), uy = Math.sin(a.a), sd = s.side, dd = 4.4 + s.v * .12; want(me.x + ux * (2 - t * 3) - uy * dd * sd, 1.5 + s.v * .03, me.y + uy * (2 - t * 3) + ux * dd * sd, me.x + ux * 2, 1.1, me.y + uy * 2, t === 0); camStep(dt, 7); }
  function crew(x, y, dir) { var me = Z.me, ids = ["bature", "abbas", "firdausi"], f = ids.map(function (id, i) { return cast("fx_w" + i, id); }); me.x = x; me.y = y; me.a = dir; noVeh();
    f.forEach(function (n, i) { at(n, x - Math.cos(dir) * (1 + (i >> 1)) + Math.cos(dir + HP) * (i % 2 ? 1.2 : -1.2), y - Math.sin(dir) * (1 + (i >> 1)) + Math.sin(dir + HP) * (i % 2 ? 1.2 : -1.2), dir); }); f.lead = { x: x, y: y }; f.dir = dir; return f; }
  function walkCrew(s, dt, v) { var me = Z.me, c = s.crew, a = c.dir; me.x += Math.cos(a) * v * dt; me.y += Math.sin(a) * v * dt; me.a = a; me.cs = v; c.forEach(function (n, i) { var tx = me.x - Math.cos(a) * (1 + (i >> 1)) + Math.cos(a + HP) * (i % 2 ? 1.2 : -1.2), ty = me.y - Math.sin(a) * (1 + (i >> 1)) + Math.sin(a + HP) * (i % 2 ? 1.2 : -1.2); walkTo(n, tx, ty, v * 1.2, dt); n.a = a; n.spd = v; }); }
  function briefStep(dt) {
    if (once2("b")) { playCue("brief"); I.bi = -1; I.bt = 0; }
    var i = I.bi, s = BRIEF[i];
    if (i < 0 || I.bt >= s.d) {
      if (s) { if (s.done) try { s.done(s); } catch (e) {} clearShot(); } I.hideMe = false;
      i = ++I.bi; I.bt = 0; s = BRIEF[i]; if (!s) return next("logo", 0);
      if (s.time != null) Z.P.time = s.time; card(s.card || I.cardText); if (s.card === undefined && i > 0 && BRIEF[i - 1].card) card(BRIEF[i - 1].card); if (s.n) narrate(s.n);
      try { s.init(s); } catch (e) { if (typeof console !== "undefined") console.warn("Opening film shot", i, e); }
      fade(1, true); fade(0);
    }
    try { s.step(s, Math.min(1, I.bt / s.d), dt); } catch (e) {} I.bt += dt;
  }
  function clearShot() { // temp people, cars and guards from the last shot go; bags in their hands too
    var keep = [I.mum, I.dad]; I.temps = I.temps.filter(function (n) { if (keep.indexOf(n) >= 0) return true; var k = Z.npcs.indexOf(n); if (k >= 0) Z.npcs.splice(k, 1); return false; });
    I.bags = I.bags.filter(function (b) { if (b.holder && b.holder.temp && keep.indexOf(b.holder) < 0) { if (b.m && b.m.parent) b.m.parent.remove(b.m); return false; } return true; });
    I.tcars = I.tcars.filter(function (c) { if (c === I.car) return true; drop(c); if (Z.me.veh === c) Z.me.veh = null; return false; });
  }

  /* ---------- act 5: the logo, then you ---------- */
  function logoStep(dt) {
    var p = P_("gate");
    if (once2("l")) { clearShot(); card(""); caption(""); Z.P.time = 18 * 60 + 40; playCue("logo"); I.logoT = 0; fade(0); setTimeout(function () { if (I.on && I.ph === "logo") narrate("welcome"); }, 700); logo(true); }
    void p; dolly({ from: [3, 6, -628], to: [1, 4.6, -650], look: [0, 7, -712] }, Math.min(1, I.t / 6));
    if (I.t > 5.6) { logo(false); next("hand", 0); }
  }
  function handStep(dt) {
    var me = Z.me, R = Z.r3;
    if (once2("h")) { fade(1); I.handAt = I.clock + .5; }
    if (I.handAt && I.clock >= I.handAt) { I.handAt = 0; home(); fade(0); var h = I.home; want(me.x - Math.cos(h.a) * 4 + Math.cos(h.a + HP) * 3.2, 3, me.y - Math.sin(h.a) * 4 + Math.sin(h.a + HP) * 3.2, me.x + Math.cos(h.a) * 2, 1.4, me.y + Math.sin(h.a) * 2, true); I.handT = 0; }
    if (!I.handAt && I.home) {
      I.handT += dt; var yaw = I.home.a, cd = 6.2, pit = .3, fx = me.x, fy = me.y;
      want(fx - Math.cos(yaw) * cd * Math.cos(pit), 1.75 + cd * Math.sin(pit), fy - Math.sin(yaw) * cd * Math.cos(pit), fx + Math.cos(yaw) * 2.5, 1.45, fy + Math.sin(yaw) * 2.5); camStep(dt, 1.8);
      if (I.handT > .8) bars(false);
      if (I.handT > 2.6) I.end();
    }
  }
  function home() { // back where the arrival left you: at your hostel, your roommate in front of you
    clearShot(); noVeh(); var me = Z.me; if (!I.home) atHostel(); var h = I.home; me.x = h.x; me.y = h.y; me.a = h.a; me.emote = "";
    if (I.mum) I.mum.hidden = true; if (I.dad) I.dad.hidden = true; if (I.car) { drop(I.car); I.car = null; }
    var rm = I.roomieNpc; if (rm) { at(rm, me.x + Math.cos(h.a) * 2.2, me.y + Math.sin(h.a) * 2.2); face(rm, me); rm.wave = 2; }
    Z.P.time = I.saved.time;
  }

  /* ---------- the driver ---------- */
  function next(ph, k) { I.ph = ph; I.t = 0; I.k = k || 0; I.did = -1; }
  I.start = function (replay) {
    var P = Z.P, me = Z.me; if (!P || !me || I.on) return false;
    if (ST()) { ST().queue.length = 0; ST().sayT = 0; }
    I.replay = !!replay; I.on = true; I.skipping = false; I.dog = 0; I.ph = "aerial"; I.k = 0; I.t = 0; I.did = -1; I.clock = 0; I.asked = 0; I.greeted = 0; I.froad = null; I.hugSide = null; I.hugWho = null; I.inRoom = 0; I.outAt = 0; I.rcam = 0; I.saidDrive = 0; I.saidSen = 0; I.fadeAt = 0; I.handAt = 0; I.once2 = ""; I.aeri = -1; I.home = null; I.narr = null;
    I.temps = []; I.tcars = []; I.bags = []; I.subLog = []; I.alog = []; I.fadeDirect = 1; I.logoOn = false; I.capText = I.cardText = ""; for (var tk in TW) delete TW[tk]; I.subText = ""; I.saved = { x: me.x, y: me.y, a: me.a, time: P.time, home: P.home };
    if (me.veh) { try { Z.exit(true); } catch (e) { me.veh = null; } }
    if (Z.peds) Z.peds.length = 0; if (Z.traffic) Z.traffic.length = 0; Z.foes = (Z.foes || []).filter(function (f) { return f.quest; });
    P.time = 7 * 60 + 40; layers(); bars(true); fade(1, true); try { document.querySelectorAll(".fg-card").forEach(function (c) { c.classList.add("fslg-film-hide"); c.setAttribute("data-film-card", c.hidden ? "1" : "0"); c.hidden = true; }); } catch (e) {} gameMusicOff(); preload(); playCue("title");
    I.osub = Z.sub; Z.sub = function (who, text, dur) { var n = who && Z.npc(who); sub(n ? n.def.name : who === "me" ? (P.name || "You") : "", text, dur); };
    I.otoast = Z.toast; Z.toast = function () {}; if (!Z.target._film) { var ot = Z.target; Z.target = function () { return I.on ? null : ot.apply(this, arguments); }; Z.target._film = 1; }
    // the arrival's people are made now so the aerial shots never show them; the car waits off the gate road
    arriveInit(); I.car.x = I.from.x; I.car.y = I.from.y; me.x = I.car.x; me.y = I.car.y; I.car.speed = 0; I.arrivalReady = true;
    keys(); return true;
  };
  function keys() { if (I.keyed || typeof document === "undefined" || !document.addEventListener) return; I.keyed = 1; document.addEventListener("keydown", function (e) { if (I.on && (e.key === "Escape" || e.code === "Escape")) { I.skip(); if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); } }, true); }
  I.tick = function (dt) {
    if (!I.on) return; I.t += dt; I.clock += dt; subTick(); if (I.clock > I.META.maxDuration && !I.dog) { I.dog = 1; if (typeof console !== "undefined") console.warn("Opening film: watchdog"); I.skip(); return; } /* never traps the player */
    if (I.skipping) { if (ST() && ST().state(Z.P).roomie && !(Z.api.overlayOpen && Z.api.overlayOpen())) { home(); I.end(); } return; } if (I.narr && I.clock > I.narr.until) { I.narr = null; duck(false); }
    switch (I.ph) {
      case "aerial": aerialStep(dt); if (I.ph === "arrive") { caption(""); I.fadeDirect = null; fade(0, true); I.k = 0; I.t = 0; I.did = -1; narrate("legend"); playCue("bed", true); var G = Z.places.gate; want(G.mx + I.dir.x * 26 + I.perp.x * 12, 5.5, G.my + I.dir.y * 26 + I.perp.y * 12, G.mx, 1.4, G.my, true); } break;
      case "arrive": arriveStep(dt); break;
      case "freshers": freshersStep(dt); break;
      case "brief": briefStep(dt); break;
      case "logo": logoStep(dt); break;
      case "hand": handStep(dt); break;
    }
    bagsStep(); tween(dt); if (Z.bubbles) Z.bubbles.length = 0;
  };
  I.end = function () {
    var P = Z.P, me = Z.me; if (!I.on) return; I.on = false; I.ph = "done"; I.hideMe = false; I.skipping = false; I.fadeDirect = null;
    if (Z.inside && Z.interior) try { Z.interior.leaveNow(); } catch (e) {}
    clearShot(); bagsClear(); I.temps.forEach(function (n) { var k = Z.npcs.indexOf(n); if (k >= 0) Z.npcs.splice(k, 1); }); I.temps = []; I.mum = I.dad = null;
    I.tcars.forEach(drop); I.tcars = []; I.car = null; Z.guards = (Z.guards || []).filter(function (g) { return !g.intro; });
    if (I.porter && I.porterHome) { var ph = I.porterHome; I.porter.x = ph.x; I.porter.y = ph.y; I.porter.hx = ph.hx; I.porter.hy = ph.hy; } if (I.porter) I.porter.carry = false;
    me.carry = false; me.emote = ""; me.veh = null; me.alt = 0; me.cs = 0; me.speed = 0;
    if (Z.r3) { Z.r3.shot = null; Z.r3.yaw = me.a; Z.r3.pitch = .3; Z.r3.tx = me.x; Z.r3.ty = me.y; Z.r3.dist = 6.2; Z.r3.cd = 6.2; } I.want = null;
    if (I.osub) { Z.sub = I.osub; I.osub = null; } if (I.otoast) { Z.toast = I.otoast; I.otoast = null; }
    audioStop(); layersOff(); if (Z.bubbles) Z.bubbles.length = 0; I.pending = false; if (!I.replay) try { Z.api.banner("WELCOME, FRESHER", { col: "#7ef0ff", edge: "#0b4a5c", size: 70, sub: "Chapter 1", dur: 3 }); } catch (e) {} try { document.querySelectorAll("[data-film-card]").forEach(function (c) { c.hidden = c.getAttribute("data-film-card") === "1"; c.removeAttribute("data-film-card"); }); } catch (e) {}
    if (I.replay) { me.x = I.saved.x; me.y = I.saved.y; me.a = I.saved.a; P.time = I.saved.time; }
    else { P.time = I.saved.time; var s = ST() && ST().state(P); if (s) s.introDone = 1; var step = Z.step(); if (P.m.active === "m1" && step && step.t === "go" && (step.place === "@hostel" || step.place === "@home")) Z.emit({ t: "go", place: "@home" }); }
    try { if (Z.anim && Z.anim.snap) Z.anim.snap(); } catch (e) {} /* everyone jumps straight to their end pose (after a skip or the last beat) */
    if (Z.r3) { Z.r3.yaw = me.a; Z.r3.tx = me.x; Z.r3.ty = me.y; } if (Z.save) Z.save();
  };
  I.skip = function () {
    if (!I.on) return; var P = Z.P, me = Z.me, chosen = ST() && ST().state(P).roomie;
    try { if (Z.api.overlayOpen && Z.api.overlayOpen() && I.ph === "arrive" && I.k === 3) Z.api.hide(); } catch (e) {}
    if (ST()) { ST().queue.length = 0; ST().sayT = 0; }
    if (!I.replay && chosen) { home(); I.end(); return; } // past the choice: you are at your hostel, your roommate in front of you, as if it had played
    if (!I.replay) { // before the choice: ask it now (over black), then land exactly where watching would
      clearShot(); noVeh(); bars(false); card(""); caption(""); logo(false); fade(1, true); I.fadeDirect = 1; audioStop(); I.skipping = true; toChoice(); var step = Z.step(), st2 = ST();
      if (st2 && step && step.t === "choice") { if (!(Z.api.overlayOpen && Z.api.overlayOpen())) st2.ask({ which: "main", id: "m1", i: Z.P.m.step, m: Z.mission(), st: step }, step); return; }
      home(); I.end(); return; }
    I.end();
  };
  I.draw = function () {}; // everything the film shows on screen is in its DOM layers
  I.click = function (px, py) { if (px >= 818 && py <= 70) I.skip(); return true; }; // during the film every tap belongs to it

  /* ---------- when it plays ---------- */
  I.wanted = function (p, fresh) { var s = p && p.story; return !!fresh && !(s && s.introDone) && !!(p.m && p.m.active === "m1" && !p.m.step && !p.m.done.m1); };
  if (Z.begin && !Z.begin._intro) { var ob = Z.begin; Z.begin = function (p, fresh) { if (I.on) { I.replay = true; try { I.end(); } catch (e) { I.on = false; } } /* a new game or a load ends any film still running */ I.pending = I.wanted(p, fresh) && !I.noAuto && !!(Z.r3 && Z.r3.ready && Z.r3.kit); var out = ob.apply(this, arguments); I.register(Z.api); if (!I.pending) I.pending = false; if (I.wanted(Z.P, fresh) && !I.noAuto && Z.r3 && Z.r3.ready && Z.r3.kit) { /* only with the real 3D renderer, never a test stand-in */ /* the film needs the 3D view; the flat map view starts at the gate */ try { I.start(false); } catch (e) { I.on = false; if (typeof console !== "undefined") console.warn("Opening film:", e); } } return out; }; Z.begin._intro = 1; }
  I.register = function (api) {
    if (I.reg || !api || !api.settings || typeof api.settings.add !== "function") return; I.reg = 1;
    api.settings.add({ id: "replayIntro", tab: "gameplay", section: Z.resolveText ? Z.resolveText("{{GAME_NAME}}") : "This game", label: "Replay opening", type: "toggle", default: false, help: "Switch on to watch the opening film again; it switches itself off and changes nothing in your save.",
      apply: function (v) { if (!v) return; try { if (api.settings.set) api.settings.set("replayIntro", false); } catch (e) {} if (Z.P && Z.mode === "play" && !I.on) setTimeout(function () { I.start(true); }, 50); } });
  };
})();
