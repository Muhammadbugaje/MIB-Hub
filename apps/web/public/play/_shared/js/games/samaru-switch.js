/* Campus story systems: companion switching. At a script's [switch] beat, or any time a close friend walks with you,
   control passes to the friend: the camera lifts, glides across and settles behind them, the HUD says who you are, and
   you move, talk and act as them, with their look, their voice and their own skill. "You" wait (or follow) as a
   person in the world; walk up and press E, press C, or tap the swap chip to change back. Heists and other team
   missions give you two or three people to cycle between, each with a job only they can do. There is never a timer.

   Story data (docs/story/ENGINE.md §16):
     { t: "switch", npc: "bature", text: "…", optional: true, task: { t: "go" | "skill" | "hold", place, npc, secs, r, lines, set } }
     { t: "switch", team: ["yusuf", "bature"], tasks: [{ who: "yusuf" | "me", t: …, place, npc, text, lines, set }], text: "…" }
   API: Z.sw.to(id) · Z.sw.back() · Z.sw.cycle() · Z.sw.cur · Z.sw.skill(id) · Z.sw.use() · Z.sw.can(id) */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData, K = Z && Z.kit;
  if (!Z || !S || !D || !K) return;
  var SW = Z.sw = { cur: "", team: null, pins: {}, cd: 0, boost: 0, swoop: null, log: [] }, SELF = "sw_self";

  /* ---------- who can do what ---------- */
  // speed: walking pace as them · move: their signature (E when nothing else is near, or the task's "skill")
  var SKILLS = SW.SKILLS = {
    bature: { tag: "The Riddler", speed: 1.04, move: "stun", name: "Ask a riddle", line: ["Riddle me this: what runs but never walks?", "Riddle me this: what has keys and opens nothing?", "Riddle me this: who is tall when young and short when old?"], text: "Anything that hears a riddle stops to think. Shades too." },
    firdausi: { tag: "Knows Everybody", speed: 1.02, move: "cheer", name: "Greet everybody", line: ["Ah-ah! Is that not my person?", "You! How is your mother? And the shop?"], text: "Everybody nearby is suddenly her cousin. Friendship grows." },
    khalid: { tag: "The Strong One", speed: .96, move: "shove", name: "Clear the way", line: ["Excuse me. Sorry. Excuse me.", "Let me carry that."], text: "Carries double and moves what will not move.", carry: 2 },
    yusuf: { tag: "The Charmer", speed: 1, move: "calm", name: "Charm them", line: ["Officer! That uniform. Who ironed it? An artist.", "My brother, come, let me tell you something sweet."], text: "Guards and angry people forget why they came." },
    sadiq: { tag: "The Cook", speed: .98, move: "feed", name: "Share food", line: ["Toh. Eat first. Problems later."], text: "Shares what he has: a little food for you and whoever is near." },
    muktar: { tag: "The Chairman", speed: 1, move: "calm", name: "Point of order", line: ["Point of order! We shall form a committee.", "Order! One at a time. I am taking minutes."], text: "A committee forms. Nobody can stay angry in a committee." },
    nusaybah: { tag: "The Noticer", speed: 1.02, move: "spot", name: "Look closely", line: ["There. You all walked past it.", "Somebody moved this. Recently."], text: "Finds what the mission is looking for." },
    aleeya: { tag: "The Funniest", speed: 1.02, move: "cheer", name: "Tell the joke", line: ["So I told the lecturer: sir, even NEPA gives notice.", "My outfit has a carry-over. It is repeating next week."], text: "The whole place laughs. Friendship grows." },
    emily: { tag: "The Farmer", speed: 1, move: "feed", name: "Share strawberries", line: ["Strawberry? I'm just offering as a person."], text: "Strawberries for everyone near: a little food, a lot of goodwill." },
    lily: { tag: "The Gentle One", speed: 1, move: "calm", name: "Speak softly", line: ["It is all right. Breathe. Look at this leaf."], text: "Calms people, guards and one very large eel." },
    abbas: { tag: "John Carter", speed: 1, move: "fix", name: "Fix it", line: ["Hold the torch. No, higher. Don't touch that.", "It is only a loose neutral. Everything is a loose neutral."], text: "Repairs what is broken: sockets, beacons, a keke." },
    bola: { tag: "Big Sly", speed: .94, move: "shove", name: "Stand tall", line: ["Sly has rules.", "You people should disperse. Politely."], text: "One look, one step forward, and the crowd gives way." },
    jega: { tag: "The Captain", speed: 1.12, move: "sprint", name: "Burst of pace", line: ["Watch the run!"], text: "The fastest feet on campus for a few seconds." },
    fatima: { tag: "The Reader", speed: 1, move: "teach", name: "Explain it", line: ["Actually, it is simpler than the book makes it.", "Page forty. I marked it."], text: "Explains it so well that your next quiz loses a wrong answer." },
    ada: { tag: "The Planner", speed: 1.02, move: "teach", name: "Draw the plan", line: ["Step one. Step two. No step three: we will be done."], text: "A plan on paper: your next quiz loses a wrong answer." },
    shamsu: { tag: "Professor Shamsu", speed: 1, move: "teach", name: "Give a tutorial", line: ["Are we together? Good. From first principles, then.", "Sheikh Biru will explain it once, slowly, and then you will never forget it."], text: "The brilliant one. A two-minute tutorial that actually works." },
    abdul: { tag: "AB", speed: 1, move: "spot", name: "Read the instruments", line: ["Heading two-seven-zero. Check.", "Check. Altitude steady."], text: "Reads what is in front of him, exactly." },
    yakubu: { tag: "The Class Rep", speed: 1, move: "calm", name: "Read the rules", line: ["According to the handbook, section nine…"], text: "Nobody argues with the handbook." },
    kelechi: { tag: "The Sculptor", speed: 1, move: "fix", name: "Mend it by hand", line: ["Patience. Clay does not like to be rushed."], text: "Mends things with his hands and a little clay." },
    lula: { tag: "Half of the Ajakas", speed: 1, move: "cheer", name: "Tell the long joke", line: ["So this man enters a keke. Wait. It gets longer."], text: "A joke so long people forget their post." },
    faty: { tag: "The Joke Book", speed: 1, move: "cheer", name: "Read page nine", line: ["Page nine. Everybody be quiet. …No, you have to see it."], text: "Page nine never fails." },
    basit: { tag: "The Champion", speed: 1.06, move: "sprint", name: "Speed run", line: ["Any percent. Watch."], text: "Treats the campus like a level he has memorised." },
    joy: { tag: "The Voice", speed: 1, move: "calm", name: "Use the radio voice", line: ["Good evening. You are listening to calm."], text: "The night-radio voice. People slow down to listen." },
    maryam: { tag: "The Storyteller", speed: 1, move: "cheer", name: "Tell a story", line: ["Once, in a bookshop not far from here…"], text: "People gather. People always gather." },
    tanko: { tag: "The Riddler-in-Chief", speed: .98, move: "stun", name: "Ask \"Which?\"", line: ["Which door? The one that remembers.", "Which? …No. The other which."], text: "Deep riddles. Even the dark stops to work them out." },
    wednesday: { tag: "Only on Wednesdays", speed: 1, move: "spot", name: "Remember the loop", line: ["I have done this one eleven times. It is behind you.", "Typical. It is where it was last time."], text: "She has been here before. She knows where things are." },
    bigbaby: { tag: "Big Baby", speed: 1, move: "calm", name: "Say his name", line: ["Bolaji.", "Everybody. Sit."], text: "One word from her and the largest man on campus sits down." },
    tunde: { tag: "The Artist", speed: 1, move: "spot", name: "Sketch the scene", line: ["Hold still. No, everything. The whole street."], text: "Sees the one detail that matters and draws it." }
  };
  var DEFAULT = { tag: "Friend", speed: 1, move: "cheer", name: "Say hello", line: ["How far, everybody?"], text: "A friendly face." };
  SW.skill = function (id) { return SKILLS[id] || DEFAULT; };
  function me() { return Z.me; }
  function tok(id) { try { return Z.story.tok(Z.P, id); } catch (e) { return id; } }
  function npc(id) { return id ? Z.npc(tok(id)) : null; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function nameOf(id) { return id === "me" || !id ? (Z.P.name || "You") : K.name(tok(id)); }

  /* ---------- looks: while switched, "you" are drawn and voiced as the friend ---------- */
  var oChar = Z.charOf, lookCache = {};
  Z.charOf = function (id) {
    var ch = oChar.apply(Z, arguments); if (!SW.cur || !Z.P || id !== Z.P.char) return ch; var d = K.npcDef(SW.cur); if (!d) return ch;
    var k = SW.cur + "|" + ch.id, o = lookCache[k]; if (!o) { o = lookCache[k] = Object.create(ch); o.skin = d.skin; o.hair = d.hair; o.hairCol = d.hairCol || null; o.top = d.top; o.voice = d.voice || ch.voice; o.pitch = d.pitch || 1; o.swName = d.name; o.fit = null; } return o;
  };
  function wrapWardrobe() { var Wd = Z.wardrobe; if (!Wd || Wd._sw) return; Wd._sw = 1; var ok = Wd.key, ol = Wd.lookOf; if (ok) Wd.key = function (p) { return ok.apply(Wd, arguments) + (SW.cur ? "|sw:" + SW.cur : ""); }; if (ol) Wd.lookOf = function (p, ch) { return SW.cur ? ch : ol.apply(Wd, arguments); }; }
  var oSpeed = S.speedFactor; S.speedFactor = function (p) { var f = oSpeed.apply(S, arguments); if (SW.cur && Z.P === p) f *= SW.skill(SW.cur).speed || 1; if (SW.boost > 0 && Z.P === p) f *= 1.4; return f; };

  /* ---------- the stand-in: you, waiting, when you are somebody else ---------- */
  function selfNpc() { return Z.npc(SELF); }
  function makeSelf(x, y, a) {
    var P = Z.P, base = Z.npcs[0]; if (!base) return null; var old = selfNpc(); if (old) Z.npcs.splice(Z.npcs.indexOf(old), 1);
    var cur = SW.cur; SW.cur = ""; var ch = oChar.call(Z, P.char), lk = ch; try { if (Z.wardrobe && Z.wardrobe.lookOf) lk = Z.wardrobe.lookOf(P, Z.charOf(P.char)); } catch (e) {} SW.cur = cur;
    var mode = "tee"; try { mode = D.OUTFITS[P.outfit || 0].mode; } catch (e2) {}
    var def = { id: SELF, name: (P.name || "You") + " (you)", role: "Swap back", at: "gate", skin: lk.skin, hair: lk.hair, hairCol: lk.hairCol, top: lk.top, voice: ch.voice || "male", pitch: 1, hi: ["It's you. Swap back?"], friend: false, sw: true, scale: 1 / 1.12 };
    var n = {}; for (var k in base) n[k] = base[k]; n.id = SELF; n.def = def; n.look = lk; n.mode = mode; n.x = n.hx = x; n.y = n.hy = y; n.a = a || 0; n.follow = false; n.lead = null; n.coming = false; n.story = ""; n.k = Z.npcs.length; n.sw = true; n.rt = null; n.hidden = false; n.spd = 0;
    Z.npcs.push(n); return n;
  }
  function dropSelf() { var n = selfNpc(); if (n) Z.npcs.splice(Z.npcs.indexOf(n), 1); }

  /* ---------- switching ---------- */
  SW.can = function (id) { id = tok(id); if (id === "me") return !!SW.cur; var n = Z.npc(id), m = me(); return !!(n && n.def && !n.def.retired && !n.def.temp && id !== SW.cur && m && !m.veh && !m.fall && !Z.inside && !Z.race && !(Z.water && Z.water.swimming && Z.water.swimming())); };
  SW.why = function (id) { var m = me(); if (!m) return "Not now."; if (m.veh) return "Get off first."; if (Z.inside) return "Step outside first."; if (Z.race) return "Finish the race first."; if (Z.water && Z.water.swimming && Z.water.swimming()) return "Get out of the water first."; return nameOf(id) + " is not around."; };
  function swoopTo(ax, ay, bx, by) { // GTA-style: up, across, down behind the new person (only with the 3D renderer; instant headless)
    var R = Z.r3; SW.swoop = null; if (!R || !R.ready || (Z.api && Z.api.reduce)) return; var d = Math.hypot(bx - ax, by - ay); if (d < 1.5) return;
    SW.swoop = { t: 0, dur: K.clamp(.75 + d / 60, .9, 1.7), ax: ax, ay: ay, bx: bx, by: by, yaw: R.yaw || 0, top: K.clamp(10 + d * .35, 12, 46) };
  }
  function swoopTick(dt) {
    var w = SW.swoop, R = Z.r3; if (!w) return; if (!R || !R.ready) { SW.swoop = null; return; } w.t += dt; var k = Math.min(1, w.t / w.dur), e = k * k * (3 - 2 * k), up = Math.sin(Math.PI * e);
    var fx = w.ax + (w.bx - w.ax) * e, fy = w.ay + (w.by - w.ay) * e, back = 6.5 + up * 9;
    R.shot = { x: fx - Math.cos(w.yaw) * back, y: fy - Math.sin(w.yaw) * back, h: 3.3 + up * w.top, tx: fx, ty: fy, th: 1.5 };
    if (k >= 1) { R.shot = null; SW.swoop = null; }
  }
  function announce(id) {
    var sk = SW.skill(id), who = nameOf(id);
    try { Z.api.banner(id === "me" ? "YOU" : who.toUpperCase(), { sub: id === "me" ? "Back to yourself" : sk.tag + " · " + sk.name + " (E)", dur: 1.6, size: 64, col: "#7ef0ff", edge: "#0b4a5c" }); } catch (e) {}
    K.sfx("power"); try { Z.api.flash("#e0f2fe", .18); } catch (e2) {}
  }
  // Take control of a friend ("me" hands it back). Returns true when the switch happened.
  SW.to = function (id, opt) {
    opt = opt || {}; id = tok(id); var m = me(), P = Z.P; if (!m || !P) return false; if (id === "me" || id === SELF) return SW.back(opt);
    if (!SW.can(id)) { if (!opt.quiet) K.toast(SW.why(id)); return false; } wrapWardrobe();
    var n = Z.npc(id), ax = m.x, ay = m.y, aa = m.a, bx = n.x, by = n.y, ba = n.a, prev = SW.cur;
    if (n.follow && Z.friends && Z.friends.release) { try { Z.friends.release(n); } catch (e) {} }
    if (prev) { var pn = Z.npc(prev); if (pn) { pn.x = pn.hx = ax; pn.y = pn.hy = ay; pn.a = aa; pn.hidden = false; pn.sw = false; SW.pins[prev] = { x: ax, y: ay, a: aa }; } } // the one you were stays where they stood
    else { var s = makeSelf(ax, ay, aa); if (s && opt.follow) { s.follow = true; s.ft = 1e9; } else SW.pins[SELF] = { x: ax, y: ay, a: aa }; }
    delete SW.pins[id]; SW.cur = id; n.hidden = true; n.sw = true; n.follow = false; n.lead = null; n.coming = false;
    m.x = bx; m.y = by; m.a = ba; m.vx = m.vy = 0; m.sit = false; m.emote = ""; SW.cd = 0; SW.free = !!opt.follow;
    swoopTo(ax, ay, bx, by); if (!opt.quiet) announce(id); SW.log.push(id); K.emit({ t: "swap", npc: id, story: true }); return true;
  };
  SW.back = function (opt) {
    opt = opt || {}; var m = me(), id = SW.cur; if (!m || !id) return false; var n = Z.npc(id), s = selfNpc(), ax = m.x, ay = m.y, aa = m.a;
    var bx = s ? s.x : ax, by = s ? s.y : ay, ba = s ? s.a : aa;
    if (n) { n.x = n.hx = ax; n.y = n.hy = ay; n.a = aa; n.hidden = false; n.sw = false; n.rt = null; if (SW.team || opt.pin) SW.pins[id] = { x: ax, y: ay, a: aa }; else if (SW.free && Z.friends && Z.friends.follow) { try { Z.friends.follow(n, 300); } catch (e) {} } }
    SW.cur = ""; dropSelf(); delete SW.pins[SELF]; m.x = bx; m.y = by; m.a = ba; m.vx = m.vy = 0; SW.free = false; SW.boost = 0;
    swoopTo(ax, ay, bx, by); if (!opt.quiet) announce("me"); SW.log.push("me"); K.emit({ t: "swap", npc: "me", story: true }); return true;
  };
  SW.options = function () { // who the swap key cycles through right now
    var out = [], st = Z.step && Z.step(), r = SW.ctx;
    if (SW.team) out = ["me"].concat(SW.team.map(tok));
    else if (r && r.who) out = ["me", r.who];
    else if (SW.cur) out = ["me", SW.cur];
    else if (Z.friends && SW.perk()) Z.friends.companions().forEach(function (n) { if (out.indexOf(n.id) < 0 && SW.allowed(n.id)) { if (!out.length) out.push("me"); out.push(n.id); } });
    void st; return out;
  };
  SW.perk = function () { return true; };
  SW.allowed = function (id) { try { return !Z.social || Z.social.canSwap(id); } catch (e) { return true; } }; // friendship perk: Close friends let you swap
  SW.cycle = function () {
    var list = SW.options(); if (list.length < 2) { K.toast("Nobody to swap with. Ask a close friend to walk with you."); return false; }
    var i = list.indexOf(SW.cur || "me"), nx = list[(i + 1) % list.length], free = !SW.team && !(SW.ctx && SW.ctx.who);
    return nx === "me" ? SW.back() : SW.to(nx, { follow: free });
  };

  /* ---------- signature moves ---------- */
  SW.use = function () {
    var id = SW.cur, m = me(), P = Z.P; if (!id || !m) return false; var sk = SW.skill(id); if (SW.cd > 0) { K.toast(sk.name + ": give it a moment."); return false; }
    SW.cd = 8; var line = K.pickBy(sk.line, P.day + SW.log.length, P.time | 0); try { Z.say("me", line); } catch (e) {} SW.lastMove = sk.move; var hit = 0;
    if (sk.move === "stun" || sk.move === "shove") (Z.foes || []).forEach(function (f) { var d = dist(f, m); if (d < (sk.move === "stun" ? 10 : 5)) { hit++; if (sk.move === "stun") f.frozen = Math.max(f.frozen || 0, 3.5); else { var a = Math.atan2(f.y - m.y, f.x - m.x), q = S.push(Z.W, f.x + Math.cos(a) * 4.5, f.y + Math.sin(a) * 4.5, .5); f.x = q.x; f.y = q.y; f.frozen = Math.max(f.frozen || 0, 1.2); } } });
    if (sk.move === "calm") { hit = (Z.guards || []).length; if (Z.guards) Z.guards.length = 0; try { if (P.sec) { P.sec.warn = 0; P.sec.state = ""; } } catch (e3) {} }
    if (sk.move === "cheer" || sk.move === "feed") (Z.npcs || []).forEach(function (n) { if (n.hidden || n.sw || !n.def || dist(n, m) > 9) return; n.wave = 1.4; var key = "swc_" + n.id; if (P.flags[key] !== P.day) { P.flags[key] = P.day; S.bond(P, n.id, sk.move === "feed" ? 2 : 1); hit++; } });
    if (sk.move === "feed") { P.hunger = Math.min(100, P.hunger + 8); }
    if (sk.move === "sprint") SW.boost = 5;
    if (sk.move === "teach") { K.block(P, "sw", {}).hint = 1; hit = 1; }
    if (sk.move === "spot") { var q2 = Z.quest; if (q2) { var d2 = Math.round(Math.hypot(q2.x - m.x, q2.y - m.y)); K.toast("<b>" + nameOf(id) + "</b> has seen it: " + d2 + " m away. Follow the gem."); Z.quest.r = 6; hit = 1; } }
    if (sk.move === "fix") { try { Z.api.burst && Z.api.burst(480, 300, "#fde047", 14); } catch (e4) {} hit = 1; }
    K.sfx(sk.move === "shove" ? "block" : "power"); K.emit({ t: "skill", npc: id, move: sk.move, n: hit, story: true });
    if (SW.ctx) SW.ctx.used = (SW.ctx.used || 0) + 1; return true;
  };
  // the story quiz asks whether a tutorial is in force (Fatima, Ada, Shamsu): one wrong answer is struck out, once
  SW.takeHint = function () { var b = K.block(Z.P, "sw", {}); if (!b.hint) return false; b.hint = 0; return true; };

  /* ---------- story steps ---------- */
  function tasksOf(st) { var out = (st.tasks || (st.task ? [st.task] : [{ t: "skill" }])).map(function (q) { var o = {}; for (var k in q) o[k] = q[k]; o.who = tok(o.who || st.npc || (st.team && st.team[0])); return o; }); return out; }
  function taskText(q) { if (q.text) return q.text; var pl = q.place ? Z.place(tok(q.place)) : null, n = q.npc ? npc(q.npc) : null, sk = SW.skill(q.who); return q.t === "go" ? "go to " + (pl ? pl.name : "the spot") : q.t === "hold" ? "hold " + (pl ? pl.name : "the spot") : sk.name.toLowerCase() + (n ? " beside " + n.def.name : pl ? " at " + pl.name : ""); }
  function taskSpot(q) { var n = q.npc ? npc(q.npc) : null, pl = q.place ? Z.place(tok(q.place)) : null; return n ? { x: n.x, y: n.y } : pl ? { x: pl.mx, y: pl.my } : null; }
  SW.begin = function (c, r, st) { // called by the story engine when a switch step starts
    var P = Z.P, m = me(); r.sw = 1; r.tasks = tasksOf(st); r.done = {}; r.who = st.team ? "" : tok(st.npc); r.asked = false; SW.ctx = r; SW.team = st.team ? st.team.slice() : null; SW.pins = {};
    var ids = st.team ? st.team.map(tok) : [r.who];
    ids.forEach(function (id, i) { var n = Z.npc(id); if (!n) return; n.hidden = false; if (n.def && n.def.cameo) n.hidden = false; var want = null; r.tasks.forEach(function (q) { if (q.who === id && q.from) want = Z.place(tok(q.from)); });
      if (want) { var f0 = S.push(Z.W, want.mx + 2, want.my + 2, .6); n.x = n.hx = f0.x; n.y = n.hy = f0.y; }
      else if (dist(n, m) > 14 || n.follow) { if (n.follow && Z.friends && Z.friends.release) { try { Z.friends.release(n); } catch (e) {} } var a = m.a + 1.2 + i * 1.1, f = S.push(Z.W, m.x + Math.cos(a) * 3.2, m.y + Math.sin(a) * 3.2, .6); n.x = n.hx = f.x; n.y = n.hy = f.y; n.a = Math.atan2(m.y - f.y, m.x - f.x); }
      SW.pins[id] = { x: n.x, y: n.y, a: n.a }; });
    void P;
  };
  SW.leave = function (r) { if (SW.cur) SW.back({ quiet: true }); SW.team = null; SW.pins = {}; if (SW.ctx === r) SW.ctx = null; };
  function finish(c, r, st) { var who = r.who; if (SW.cur && st.back !== false) SW.back(); SW.team = null; SW.pins = {}; SW.ctx = null; r.sw = 0; Z.story.fire(c, { t: "switch", npc: st.npc ? tok(st.npc) : undefined }); void who; }
  SW.drive = function (c, r, dt, st) {
    var m = me(), P = Z.P; if (!r.tasks) SW.begin(c, r, st); SW.ctx = r;
    if (st.optional && !r.asked && !SW.cur) { if (K.busy() || Z.story.busy()) return; r.asked = true; var who = nameOf(r.who), sk = SW.skill(r.who);
      K.panel("Swap to " + K.esc(who) + "?", K.esc(st.text || "") + "<br><small>" + K.esc(sk.tag) + ": " + K.esc(sk.text) + "</small>", [{ id: "swap", label: "Play as " + K.esc(who), sub: K.esc(taskText(r.tasks[0])), go: true }, { id: "stay", label: "Stay as yourself", sub: "Carry on. Nothing is lost." }],
        function (a) { if (a === "swap") SW.to(r.who); else { r.skip = true; } }); return; }
    if (r.skip) { r.skip = false; return finish(c, r, st); }
    if (!r.told && !K.busy()) { r.told = 1; var key = "C"; K.toast("<b>Swap:</b> press <b>" + key + "</b> or tap the swap chip to play as " + K.esc(SW.team ? SW.team.map(nameOf).join(" or ") : nameOf(r.who)) + "."); }
    var left = 0;
    r.tasks.forEach(function (q, i) {
      if (r.done[i]) return; left++; if ((SW.cur || "me") !== q.who) return; var sp = taskSpot(q), near = !sp || Math.hypot(sp.x - m.x, sp.y - m.y) < (q.r || (q.t === "go" ? 13 : 7)), ok = false;
      if (q.t === "go") ok = near; else if (q.t === "hold") { if (near) { q._n = (q._n || 0) + dt; ok = q._n >= (q.secs || 6); } } else { if (near && r.used) ok = true; else if (!near) r.used = 0; /* the move only counts where the job is */ }
      if (near && q.t !== "go" && q.t !== "hold" && !r.used && !q._hint) { q._hint = 1; K.toast("Press <b>E</b>: " + K.esc(SW.skill(q.who).name) + "."); }
      if (ok) { r.done[i] = 1; r.used = 0; left--; if (q.lines) Z.story.say(q.lines); [].concat(q.set || []).forEach(function (f) { P.flags[f] = 1; }); K.sfx("coin"); if (left > 0) K.toast("<b>Done:</b> " + K.esc(taskText(q)) + ". " + left + " to go."); }
    });
    if (!r.tasks.some(function (q, i) { return !r.done[i] && q.who === (SW.cur || "me") && q.t !== "go" && q.t !== "hold"; })) r.used = 0;
    if (left <= 0) finish(c, r, st);
  };
  // what the HUD and the guide arrow should say while a switch step runs
  SW.objective = function () {
    var r = SW.ctx; if (!r || !r.tasks) return null; var cur = SW.cur || "me", mine = null, other = null;
    r.tasks.forEach(function (q, i) { if (r.done[i]) return; if (q.who === cur) mine = mine || q; else other = other || q; });
    if (mine) { var sp = taskSpot(mine); return { text: "As " + nameOf(cur) + ": " + taskText(mine), target: sp ? { x: sp.x, y: sp.y, name: taskText(mine) } : null }; }
    if (other) { var n = other.who === "me" ? selfNpc() : Z.npc(other.who); return { text: "Swap to " + nameOf(other.who) + " (C)", target: n ? { x: n.x, y: n.y, name: nameOf(other.who) } : null }; }
    return null;
  };

  /* ---------- every frame ---------- */
  K.tick(function (dt) {
    var m = me(); swoopTick(dt); if (SW.cd > 0) SW.cd -= dt; if (SW.boost > 0) SW.boost -= dt;
    if (SW.closeUi) { SW.closeUi = 0; K.close(); }
    if (SW.cur) { var n = Z.npc(SW.cur); if (n) { n.hidden = true; n.x = m.x; n.y = m.y; n.a = m.a; n.spd = 0; n.follow = false; } else { SW.cur = ""; dropSelf(); }
      if (m.veh || Z.inside) { /* they do not drive or go indoors as someone else: quietly hand back */ if (!SW.ctx) SW.back({ quiet: true }); } }
    else if (selfNpc()) dropSelf();
    for (var id in SW.pins) { var p = SW.pins[id], q = Z.npc(id); if (!q || id === SW.cur) continue; q.x = q.hx = p.x; q.y = q.hy = p.y; q.spd = 0; q.sit = false; q.rt = null; if (dist(q, m) < 7) q.a += S.angDiff(Math.atan2(m.y - q.y, m.x - q.x), q.a) * Math.min(1, dt * 5); else q.a = p.a; }
    if (SW.ctx && !(Z.step && Z.step() && Z.step().t === "switch") && !sideSwitch()) { SW.leave(SW.ctx); }
    try { if (Z.api.hit && Z.api.hit("swap")) SW.cycle(); } catch (e) {}
    if (SW.keyHit) { SW.keyHit = 0; if (!K.busy()) SW.cycle(); }
  });
  function sideSwitch() { try { var sd = Z.story.state(Z.P).side, sm = sd && Z.story.sideDef(sd.id); return !!(sm && sm.steps[sd.step] && sm.steps[sd.step].t === "switch"); } catch (e) { return false; } }
  K.begin(function () { SW.cur = ""; SW.team = null; SW.pins = {}; SW.ctx = null; SW.swoop = null; dropSelf(); if (Z.r3 && Z.r3.shot && SW._shot) Z.r3.shot = null; listen(); });
  K.on("talk", function (ev) { if (ev.npc === SELF) { SW.closeUi = 1; SW.back(); } });
  function listen() { if (SW._key || typeof window === "undefined" || !window.addEventListener || typeof document === "undefined" || !document.body) return; SW._key = 1; try { window.addEventListener("keydown", function (e) { if (e.code !== "KeyC" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return; if (e.target && e.target.closest && e.target.closest("input, textarea")) return; if (Z.mode === "play") SW.keyHit = 1; }); } catch (e) {} }

  /* ---------- prompts, HUD, objective ---------- */
  K.spot({ id: "sw_move", x: 0, y: 0, r: 3, when: function (s) { var m = me(); s.x = m.x; s.y = m.y; return !!SW.cur && SW.cd <= 0; }, label: function () { return SW.skill(SW.cur).name; }, act: function () { SW.use(); } });
  K.chip(function () {
    var list = SW.options(); if (SW.cur) { var sk = SW.skill(SW.cur); return { text: "Playing as " + nameOf(SW.cur), sub: sk.tag + " · tap or C to swap", col: "#7ef0ff", bg: "rgba(6,30,40,.85)", tap: function () { SW.cycle(); } }; }
    if (list.length > 1) return { text: "Swap to " + nameOf(list[1]), sub: SW.skill(list[1]).tag + " · tap or C", col: "#7ef0ff", bg: "rgba(6,30,40,.8)", tap: function () { SW.cycle(); } };
    return null;
  });
  var oObj = Z.objective; if (oObj) Z.objective = function () { var o = oObj.apply(Z, arguments), s = SW.ctx && Z.step && Z.step() && Z.step().t === "switch" ? SW.objective() : null; if (s && o) { var c = {}; for (var k in o) c[k] = o[k]; c.text = s.text; if (s.target) { c.target = s.target; c.marker = { x: s.target.x, y: s.target.y, name: s.target.name || "" }; } return c; } return o; };
  // talk menu: "Swap places" with a friend who is walking with you (a friendship perk)
  K.tick(function () { var F = Z.friends; if (!F || F._sw || !F.items) return; F._sw = 1; var oi = F.items; F.items = function (n, items) { oi.apply(F, arguments); if (n && n.follow && !SW.cur && n.id !== SELF) { var ok = SW.allowed(n.id); items.push({ label: "Swap places", sub: ok ? "Play as " + n.def.name + " (" + SW.skill(n.id).tag + ")" : "Needs Close friend (50)", off: !ok, run: function () { K.close(); SW.to(n.id, { follow: true }); } }); } }; });
})();
