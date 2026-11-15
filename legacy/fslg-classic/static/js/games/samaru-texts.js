/* Freshers School Life — texts and money from home.
   Friends text you through the day (where you dey, invites, sapa jokes), your partner checks on you, Mum and Dad
   send advice, and the story can text you too. Each text can carry two or three quick replies that move the
   friendship a little. Everything is seeded from the game clock (SamaruSim.hash), never Math.random, so the
   same day plays the same way. Money from home: text or call Mum, Dad or Uncle Sule from the Bank app. Whether
   they send, and how much, depends on how recently and how often you asked, your attendance, your level and the
   start of term; it arrives later as a credit alert. One ask a day across the family, so it is never a money tap.
   Messages live in the save as P.phone.msgs (see samaru-phone.js for P.phone). Story API (docs/story/ENGINE.md §14):
     Z.texts.send(from, text, { name, replies: [[label, friendship, answer]], then(i) }) → message
   Nothing runs at load time. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData; if (!Z || !Z.phone) return;
  var PH = Z.phone, X = Z.texts = {}, R = PH.R, H = PH.H;
  X.HOME = [{ id: "mum", name: "Mum", col: "#db2777", base: 2500, yes: .7 }, { id: "dad", name: "Dad", col: "#2563eb", base: 4000, yes: .55 }, { id: "uncle", name: "Uncle Sule", col: "#ca8a04", base: 6000, yes: .42 }];
  X.ASK_GAP = 24 * 60;      // one ask a day across the family
  X.REFUSE_GAP = 48 * 60;   // after a no, that person needs two days
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function P() { return Z.P; }
  function st() { return PH.state(); }
  function now() { return PH.absMin(); }
  function h(a, b) { return S.hash(a | 0, b | 0); }
  function pickH(list, a, b) { return list[Math.floor(h(a, b) * list.length) % list.length]; }
  function homeOf(id) { for (var i = 0; i < X.HOME.length; i++) if (X.HOME[i].id === id) return X.HOME[i]; return null; }
  X.nameOf = function (who) { var n = Z.npc(who), hm = homeOf(who), s = st(); if (n) return n.def.name; if (hm) return hm.name; if (who === "alert") return "Bank alert"; if (s && s.names && s.names[who]) return s.names[who]; return String(who).replace(/^story:/, ""); };
  function colOf(who) { var n = Z.npc(who), hm = homeOf(who); return n ? (n.look && n.look.top) || "#475569" : hm ? hm.col : who === "alert" ? "#16a34a" : "#7c3aed"; }

  /* ---------- the message store ---------- */
  function push(who, text, o) {
    var s = st(); o = o || {}; var m = { id: ++s.seq, who: who, text: String(text), at: o.at || now(), me: !!o.me, read: !!(o.me || o.read), replies: o.replies || null, replied: -1, kind: o.kind || "" };
    if (o.name) { s.names = s.names || {}; s.names[who] = o.name; } if (o.then) X.hooks[m.id] = o.then;
    s.msgs.push(m); if (s.msgs.length > 120) s.msgs.splice(0, s.msgs.length - 120); return m;
  }
  X.hooks = {};
  X.send = function (from, text, o) { // an incoming text from anyone; the story uses this for mission hooks
    var p = P(); if (!p) return null; o = o || {}; var m = push(from, text, o);
    if (!o.quiet && !PH.lost()) PH.notify(X.nameOf(from), text, o.kind === "money" ? "money" : "text");
    return m;
  };
  X.unread = function () { var s = st(); if (!s) return 0; var n = 0; for (var i = 0; i < s.msgs.length; i++) if (!s.msgs[i].read) n++; return n; };
  X.threads = function () {
    var s = st(), by = {}, out = []; s.msgs.forEach(function (m) { var t = by[m.who]; if (!t) { t = by[m.who] = { who: m.who, last: m, unread: 0 }; out.push(t); } t.last = m; if (!m.read) t.unread++; });
    return out.sort(function (a, b) { return b.last.at - a.last.at || b.last.id - a.last.id; });
  };
  X.thread = function (who) { return st().msgs.filter(function (m) { return m.who === who; }); };
  X.markRead = function (who) { st().msgs.forEach(function (m) { if (m.who === who) m.read = true; }); };
  X.reply = function (id, i) {
    var s = st(), m = null; s.msgs.forEach(function (q) { if (q.id === id) m = q; }); if (!m || !m.replies || m.replied >= 0 || !m.replies[i]) return false;
    var r = m.replies[i], p = P(), n = Z.npc(m.who); m.replied = i; m.read = true; push(m.who, r[0], { me: true });
    if (n && r[1]) { S.bond(p, n.id, r[1]); try { Z.float(Z.me.x, Z.me.y - 1.6, (r[1] > 0 ? "♥ +" : "♥ ") + r[1] + " " + n.def.name.split(" ")[0], r[1] > 0 ? "#f9a8d4" : "#94a3b8"); } catch (e) {} }
    if (homeOf(m.who) && r[1]) { s.home.goodwill = Math.max(-3, Math.min(3, (s.home.goodwill || 0) + (r[1] > 0 ? 1 : -1))); }
    if (r[2]) push(m.who, r[2], { at: now() + 1, read: true });
    if (r[3] === "invite" && n) X.come(n);
    if (r[3] === "ask" && homeOf(m.who)) X.ask(m.who, "text");
    if (X.hooks[m.id]) { try { X.hooks[m.id](i); } catch (e) {} delete X.hooks[m.id]; }
    try { Z.emit({ t: "text", npc: m.who, reply: i }); } catch (e) {} return true;
  };
  X.come = function (n) { var p = P(); if (!n || n.follow || S.affinity(p, n.id) < 20 || (n.id === "sly" && !p.flags.slyAlly)) return false; try { Z.hangout(n); } catch (e) { return false; } return true; };
  X.invite = function (id) {
    var n = Z.npc(id), p = P(), s = st(); if (!n) return false; s.inv8 = s.inv8 || {}; var t = now(); push(id, "Where you dey? Come and hang out!", { me: true });
    if (s.inv8[id] && t - s.inv8[id] < 60) { push(id, "You just asked me! Patience is a virtue o. 😅", { read: true }); return false; } s.inv8[id] = t;
    var hr = p.time / 60, busy = hr >= 23 || hr < 6 || h(t, id.length * 13) < .2;
    if (busy) { push(id, hr >= 23 || hr < 6 ? "Bros/sis, it's late. Tomorrow!" : "I'm in the middle of something. Next time!", { read: true }); PH.refresh(); return false; }
    push(id, pickH(["On my way!", "I dey come! Don't move.", "Oya, coming now."], t, 3), { read: true }); X.come(n); PH.refresh(); return true;
  };
  X.backOnline = function () { var n = X.unread(); if (n) setTimeout(function () { try { Z.toast("<b>Phone back online.</b> " + n + " new message" + (n > 1 ? "s" : "") + "."); } catch (e) {} }, 900); };

  /* ---------- what people text about ---------- */
  // [text, replies]; a reply is [label, friendship, their answer, action]
  var FRIEND = {
    morning: [["Una don wake? First lecture na 8 o.", [["I'm up!", 2, "Oya see you there."], ["5 more minutes…", 0, "Lecturer go mark you absent o."], ["Who be this?", -2, "Ehn?! So you don delete my number?"]]],
      ["Good morning! Did you see the new timetable? They moved everything again.", [["Again?!", 1, "Every week. Na their hobby."], ["I don't read timetables, I follow you", 2, "Then follow me well. 😂"]]]],
    lecture: [["Where you dey? Lecturer don enter!", [["On my way!", 2, "Run! I saved you a seat."], ["Sign attendance for me abeg", -1, "I no fit go jail for you o."], ["Coming", 1, "Hurry!"]]],
      ["This lecturer just said 'this one is very simple' and wrote one full board.", [["😂 we're finished", 2, "Finished and buried."], ["I understood everything", 1, "Liar. 😂"]]]],
    lunch: [["Sapa don hold me. You get ₦200 for garri?", [["Send account number 😂", 2, "Na joke I dey joke. Thank you sha!"], ["Me too I dey drink garri", 1, "Solidarity forever. 🤝"], ["Ignore", -1, "Seen. Okay o."]]],
      ["Garri + sugar + groundnut + cold water = the four food groups.", [["Add milk and you're rich", 2, "Bourgeoisie!"], ["Facts", 1, "Science."]]],
      ["Mama put just gave me extra meat. I think she likes me. Or she made a mistake.", [["Marry her daughter", 2, "😂 I'll think about it."], ["Enjoy it while it lasts", 1, "Already eaten."]]]],
    evening: [["Shinkafi tonight? They say shawarma don land.", [["I'm in!", 3, "Oya I'm coming to meet you.", "invite"], ["Next time", 0, "You always dey say next time."], ["Who's paying?", 1, "Everybody for himself, God for us all."]]],
      ["Football at the court. We need one more person. Even you.", [["'Even me'?! I'm coming", 3, "😂 Come and prove me wrong.", "invite"], ["My legs are on strike", 0, "Lazy bones."]]],
      ["Social Centre is lit tonight. You coming?", [["Let's go!", 3, "Meet me there!", "invite"], ["I have to read", 1, "Okay serious student."]]]],
    night: [["You don sleep? This assignment no get head or tail.", [["Send it, let's do it together", 3, "You are a real one!"], ["Sleep is free", 1, "Facts. Goodnight."], ["Copy from Ada", -1, "Na so una go all fail together."]]],
      ["NEPA has taken light. Water in the tank: also gone. Me: crying.", [["Ah! Again?", 1, "Again o."], ["Torch on, books open", 2, "Serious student!"]]]],
    any: [["I just saw a goat in the faculty. It looked more serious than our class rep.", [["😂😂", 2, "I'm not joking!"], ["Leave Yakubu alone", 1, "Lol"]]],
      ["Breaking news: my roommate used my bucket. War has been declared.", [["Peace talks?", 1, "Never!"], ["I'll bring popcorn", 2, "Bring two."]]],
      ["How far? Long time.", [["I dey o, you?", 2, "We move!"], ["Busy with school", 1, "Okay o, big man / big woman."]]]]
  };
  var PARTNER = [["Good morning ❤️ Did you eat?", [["Yes, thinking of you", 3, "Aww ❤️"], ["Not yet", 1, "Go and eat something abeg!"], ["Who is this? 😜", -1, "Oya continue. 😒"]]],
    ["Miss you. Come and see me after class?", [["I'm coming!", 3, "❤️", "invite"], ["Busy today", 0, "Okay… 😔"]]],
    ["I told my friends you're the best. Don't disgrace me. 😂", [["Never!", 3, "That's my person."], ["No pressure then 😅", 1, "Plenty pressure."]]]];
  var FAMILY = {
    mum: [["Have you eaten? Don't just drink garri every day.", [["Yes Mummy", 1, "Good. And read your books."], ["Please send money for food 🙏", 0, "Ehen. I knew it. Let me see what I can do.", "ask"]]],
      ["Your aunty said she saw you on Facebook dancing. Is that what you went to school for?", [["It was a lecture on rhythm, Mummy", 1, "Hmm. Rhythm. Okay o."], ["I'll call you later", 0, "You will explain."]]],
      ["Wear a jacket at night. Harmattan is not your friend.", [["Yes ma", 1, "Good child."], ["I'm fine, Mum!", 0, "That's what they all say."]]]],
    dad: [["How are your studies? Remember why you are there.", [["Focused, sir!", 1, "Good. Make me proud."], ["Daddy, about money…", 0, "We will talk. Read first.", "ask"]]],
      ["Check your oil and your grades. Both matter.", [["Yes sir", 1, "Good."], ["I don't have a car, sir", 0, "Then check your grades twice."]]]],
    uncle: [["My guy! How is the school? Are the girls/boys behaving?", [["Uncle, I'm focused 😂", 1, "Good boy/girl! Ha!"], ["Uncle, sapa is real", 0, "I hear you. Ask me properly.", "ask"]]]]
  };
  function slotOf(p) { var hr = p.time / 60; return hr < 6 ? "night" : hr < 9.5 ? "morning" : hr < 12 ? "lecture" : hr < 15 ? "lunch" : hr < 17.5 ? "lecture" : hr < 21.5 ? "evening" : "night"; }
  function quiet() { var p = P(); if (!p || Z.mode !== "play") return true; if (Z.intro && Z.intro.on) return true; if (Z.guide && Z.guide.active && Z.guide.active()) return true; if (PH.lost()) return true; if (Z.race) return true; return false; }
  // one scheduled text: who sends it depends on friendships, the hour and the day; seeded from the clock
  X.pickNext = function () {
    var p = P(), s = st(), t = now(), k = s.seq + 1, hr = p.time / 60, slot = slotOf(p), cands = [];
    Object.keys(p.friends).forEach(function (id) { var a = p.friends[id], n = Z.npc(id); if (!n || n.hidden || n.follow || a < 10 || id === "sly") return; cands.push({ who: id, w: a / 25 + (id === p.partner ? 2 : 0) }); });
    var fam = s.home.famAt || 0; if (t - fam > 2 * 1440 && hr >= 7 && hr < 21.5) cands.push({ who: X.HOME[Math.floor(h(t, 7) * 3) % 3].id, w: 3 });
    if (!cands.length) return null; var tot = cands.reduce(function (a, c) { return a + c.w; }, 0), r = h(t, k) * tot, c = cands[0];
    for (var i = 0; i < cands.length; i++) { r -= cands[i].w; if (r <= 0) { c = cands[i]; break; } }
    var who = c.who, tpl;
    if (homeOf(who)) { s.home.famAt = t; tpl = pickH(FAMILY[who], t, k + 3); return { who: who, text: tpl[0], replies: tpl[1], kind: "family" }; }
    if (who === p.partner && h(t, k + 5) < .6) { tpl = pickH(PARTNER, t, k + 6); return { who: who, text: tpl[0], replies: tpl[1] }; }
    var rum = Z.city && Z.city.rumours ? Z.city.rumours() : []; s.rumSeen = s.rumSeen || {}; var fresh = rum.filter(function (q) { return !s.rumSeen[q.id]; }).pop();
    if (fresh && h(t, k + 9) < .5) { s.rumSeen[fresh.id] = 1; return { who: who, text: "Did you hear? " + fresh.text, replies: [["Campus no dey carry last", 1, "Never!"], ["Gossip is not good", 0, "Okay pastor. 😂"]] }; }
    tpl = h(t, k + 11) < .3 ? pickH(FRIEND.any, t, k + 12) : pickH(FRIEND[slot], t, k + 13);
    if (slot === "lecture" && tpl === FRIEND.lecture[0] && !(Z.life && Z.life.next && Z.life.next())) tpl = FRIEND.any[0];
    return { who: who, text: tpl[0], replies: tpl[1] };
  };
  X.deliver = function () { var m = X.pickNext(); if (!m) return null; return X.send(m.who, m.text, { replies: m.replies, kind: m.kind }); };

  /* ---------- money from home ---------- */
  function attendance(p) { var lf = p.life || {}, a = lf.att || 0, m = lf.missed || 0; return a + m ? a / (a + m) : .7; }
  function term(p) { return (p.day - 1) % 60 < 5; }
  X.status = function (who) { // can you ask this person now? { ok, why }
    var p = P(), s = st(), t = now(), hm = s.home, last = hm.lastAsk || -1e9, ref = (hm.refused || {})[who] || -1e9;
    if (PH.lost()) return { ok: false, why: "Your phone is gone." };
    if ((hm.pend || []).length) return { ok: false, why: "Money is already on the way." };
    if (t - last < X.ASK_GAP) return { ok: false, why: "You asked " + (t - last < 120 ? "just now" : "today") + ". Ask again " + when(last + X.ASK_GAP) + "." };
    if (t - ref < X.REFUSE_GAP) return { ok: false, why: X.nameOf(who) + " said no. Give it until " + when(ref + X.REFUSE_GAP) + "." };
    return { ok: true, why: "" };
  };
  function when(abs) { var d = Math.floor(abs / 1440), m = abs % 1440; return "day " + d + ", " + String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0"); }
  X.odds = function (who) { // the chance of a yes, and the amount if they say yes
    var p = P(), s = st(), hm = s.home, f = homeOf(who), t = now(), recent = (hm.asks || []).filter(function (a) { return t - a < 7 * 1440; }).length, since = Math.min(10, (t - (hm.lastAsk || t - 10 * 1440)) / 1440);
    var c = f.yes + (term(p) ? .2 : 0) + (attendance(p) - .6) * .5 + Math.min(.2, since * .04) - recent * .12 + (hm.goodwill || 0) * .05 + Math.min(.08, (p.skills.brain || 0) * .004);
    var amt = (f.base + p.lvl * 100) * (term(p) ? 1.5 : 1) * (since >= 5 ? 1.2 : 1);
    return { p: Math.max(.08, Math.min(.92, c)), amt: Math.round(amt / 500) * 500, term: term(p), recent: recent };
  };
  var YES = { mum: ["Okay, I'm sending something. Eat well. Don't buy rubbish.", "Sent. And greet your roommate for me."], dad: ["Sent. Show me your results at the end of the semester.", "Okay. Spend it like it is your own money. Because it is mine."], uncle: ["My favourite! Something small is coming.", "Ah, you're lucky, I just got paid. Sending."] };
  var NO = { mum: ["Again? I sent money on Monday. Is it the garri that is eating money or you?", "My dear, money does not grow on mango trees. Manage what you have.", "Ask your father."],
    dad: ["When I was in school I trekked ten kilometres and ate once a day. And I graduated with a First Class.", "Budget. B-U-D-G-E-T. Look it up.", "Go and ask your mother."],
    uncle: ["Ah, my pocket is on strike this month. Next time!", "Who gave you my number? 😂 I'm joking. But no.", "Find work o. They say there are jobs on your phone."] };
  var ASKS = { text: ["Good evening 🙏 Please, small money for food…", "Sapa has entered my room. Please help 🙏", "Please, I need money for handouts and food 🙏"], call: [] };
  X.ask = function (who, how) {
    var p = P(), s = st(), f = homeOf(who); if (!p || !f) return { ok: false }; var ok = X.status(who); if (!ok.ok) return { ok: false, why: ok.why };
    var hm = s.home, t = now(), o = X.odds(who), k = (hm.asks || []).length + 1, roll = h(t + p.day * 7, k * 31 + who.length), yes = roll < o.p, extra = yes && roll < o.p * .2, amt = yes ? Math.round(o.amt * (extra ? 1.5 : 1) / 100) * 100 : 0;
    hm.asks = (hm.asks || []).filter(function (a) { return t - a < 14 * 1440; }); hm.asks.push(t); hm.lastAsk = t; hm.n = (hm.n || 0) + 1;
    var line = yes ? pickH(YES[who], t, k) + (extra ? " I added something extra. Don't tell anybody." : "") : pickH(NO[who], t, k + 1);
    if (how === "text") push(who, pickH(ASKS.text, t, k + 2), { me: true });
    push(who, line, { at: t + 1, read: true, kind: "family" });
    if (yes) { hm.pend = hm.pend || []; hm.pend.push({ id: s.seq, at: t + 30 + Math.floor(h(t, k + 5) * 120), amt: amt, from: who }); }
    else { hm.refused = hm.refused || {}; hm.refused[who] = t; }
    try { Z.emit({ t: "askHome", who: who, yes: yes, amt: amt }); } catch (e) {}
    return { ok: true, yes: yes, extra: extra, amt: amt, line: line, how: how };
  };
  X.pending = function () { var s = st(); return s && s.home.pend ? s.home.pend.map(function (q) { return { at: q.at, amt: q.amt, from: q.from, fromName: X.nameOf(q.from) }; }) : []; };
  function credit() {
    var s = st(), hm = s.home, t = now(); if (!hm.pend || !hm.pend.length) return;
    for (var i = hm.pend.length - 1; i >= 0; i--) { var q = hm.pend[i]; if (t < q.at) continue; hm.pend.splice(i, 1);
      try { Z.money(q.amt); } catch (e) { P().money += q.amt; } hm.hist = hm.hist || []; hm.hist.push({ at: t, amt: q.amt, from: q.from }); if (hm.hist.length > 12) hm.hist.shift();
      var nar = { mum: "Read your books", dad: "Upkeep. Spend wisely", uncle: "Enjoy small" }[q.from] || "Upkeep";
      X.send("alert", "Credit alert: " + naira(q.amt) + " from " + X.nameOf(q.from).toUpperCase() + ". Narration: \"" + nar + "\"", { kind: "money", quiet: PH.lost() });
      try { Z.bark("money"); } catch (e) {} }
  }

  /* ---------- the Messages and Bank apps ---------- */
  R.messages = function (top) {
    if (top.sub === "thread") return threadHtml(top.data);
    var th = X.threads();
    return PH.head("Messages") + "<div class='fp-body'>" + (th.length ? th.map(function (t) { var m = t.last; return "<button type='button' class='fp-row' data-pa='messages:open:" + t.who + "'>" + PH.avatar(X.nameOf(t.who), colOf(t.who)) + "<span class='fp-t'><b>" + esc(X.nameOf(t.who)) + "</b><small>" + (m.me ? "You: " : "") + esc(m.text.length > 46 ? m.text.slice(0, 44) + "…" : m.text) + "</small></span>" + (t.unread ? "<span class='fp-dot' style='position:static;box-shadow:none'>" + t.unread + "</span>" : "") + "</button>"; }).join("") : "<div class='fp-card'><p>No messages yet. Make friends and they will text you.</p></div>") + "</div>";
  };
  function threadHtml(who) {
    X.markRead(who); var list = X.thread(who).slice(-30), last = null; list.forEach(function (m) { if (!m.me) last = m; });
    var open = last && last.replies && last.replied < 0 && list[list.length - 1] === last, fam = !!homeOf(who);
    return PH.head(esc(X.nameOf(who))) + "<div class='fp-body'><div class='fp-bubbles'>" + list.map(function (m) { var mm = m.at % 1440; return "<div class='fp-bub" + (m.me ? " me" : "") + "'>" + esc(m.text) + "<small>Day " + Math.floor(m.at / 1440) + " · " + String(Math.floor(mm / 60)).padStart(2, "0") + ":" + String(Math.floor(mm % 60)).padStart(2, "0") + "</small></div>"; }).join("") + "</div>" +
      (open ? "<div class='fp-quick'>" + last.replies.map(function (r, i) { return "<button type='button' data-pa='messages:reply:" + last.id + ":" + i + "'>" + esc(r[0]) + "</button>"; }).join("") + "</div>" : "") +
      (fam ? PH.row("bank:who:" + who, "💸 Ask " + esc(X.nameOf(who)) + " for money", X.status(who).ok ? "Text or call" : esc(X.status(who).why)) : Z.npc(who) ? PH.row("friends:invite:" + who, "Invite to hang out", "They come and find you") : "") + "</div>";
  }
  H.messages = function (a) { var k = a.split(":"); if (k[0] === "open") { PH.go("thread", k[1]); return; } if (k[0] === "reply") { X.reply(+k[1], +k[2]); PH.render(); } };
  R.bank = function (top) {
    var p = P(), s = st(), hm = s.home;
    if (top.sub === "who") return whoHtml(top.data, top.res);
    var pend = X.pending(), hist = (hm.hist || []).slice(-5).reverse();
    return PH.head("Bank") + "<div class='fp-body'><div class='fp-bal'><small>Balance</small><b>" + naira(p.money) + "</b></div>" +
      "<div class='fp-card'><h4>Ask home for money</h4><p>One ask a day. Good attendance and not asking too often help. Start of term, everybody is generous.</p></div>" +
      X.HOME.map(function (f) { var ok = X.status(f.id); return PH.row("bank:who:" + f.id, esc(f.name), ok.ok ? "Text or call" : esc(ok.why), ok.ok ? "›" : "", "", false, PH.avatar(f.name, f.col)); }).join("") +
      (pend.length ? "<div class='fp-card'><h4>On the way</h4><p>" + pend.map(function (q) { return esc(q.fromName) + " is sending money"; }).join("<br>") + "</p></div>" : "") +
      (hist.length ? "<div class='fp-card'><h4>Recent credit alerts</h4><p>" + hist.map(function (q) { return naira(q.amt) + " from " + esc(X.nameOf(q.from)) + " · day " + Math.floor(q.at / 1440); }).join("<br>") + "</p></div>" : "") + "</div>";
  };
  function whoHtml(who, res) {
    var f = homeOf(who); if (!f) return PH.head("Bank") + "<div class='fp-body'></div>"; var ok = X.status(who), o = X.odds(who);
    var r = res ? "<div class='fp-card'><h4>" + (res.how === "call" ? "📞 " + esc(f.name) + " says:" : "💬 " + esc(f.name) + " replied:") + "</h4><p>“" + esc(res.line) + "”</p>" + (res.yes ? "<p class='fi-fx' style='color:#86efac;margin-top:6px'>A transfer is on the way. Watch for the credit alert.</p>" : "") + "</div>" : "";
    return PH.head(esc(f.name)) + "<div class='fp-body'><div class='fp-card' style='display:flex;gap:10px;align-items:center'>" + PH.avatar(f.name, f.col) + "<div><h4>" + esc(f.name) + "</h4><p>" + (o.term ? "Start of term: generous mood." : o.recent >= 2 ? "You have asked a lot this week." : "Family.") + "</p></div></div>" + r +
      (ok.ok ? PH.row("bank:text:" + who, "💬 Text: “Please, small money…”", "The answer comes by text") + PH.row("bank:call:" + who, "📞 Call", "Hear it straight away", "", "is-go") : "<div class='fp-card'><p>" + esc(ok.why) + "</p></div>") +
      PH.row("messages:open:" + who, "Messages", "Your chat with " + esc(f.name)) + "</div>";
  }
  H.bank = function (a, top) {
    var k = a.split(":");
    if (k[0] === "who") { PH.go("who", k[1]); return; }
    if (k[0] === "text" || k[0] === "call") { var res = X.ask(k[1], k[0]); if (top && top.sub === "who") top.res = res.ok ? res : null; if (res.ok) { try { Z.api.sound.sfx(res.yes ? "coin" : "block"); } catch (e) {} } PH.render(); }
  };

  /* ---------- per frame ---------- */
  var tickT = 0;
  X.tick = function (dt) {
    var p = P(); if (!p || Z.mode !== "play") return; tickT -= dt; if (tickT > 0) return; tickT = .5; var s = st(), t = now();
    credit();
    if (s.nextAt == null) s.nextAt = t + (p.day <= 1 && p.time < 600 ? 120 : 45);
    if (t < s.nextAt) return; if (quiet()) { s.nextAt = t + 20; return; }
    s.nextAt = t + 100 + Math.floor(h(t, s.seq + 77) * 160); X.deliver();
  };
  var oUpd = Z.update; if (oUpd) Z.update = function (dt) { var r = oUpd.apply(Z, arguments); try { X.tick(dt); } catch (e) { if (!X.uerr) { X.uerr = e; if (typeof console !== "undefined") console.error(e); } } return r; };
  void D;
})();
