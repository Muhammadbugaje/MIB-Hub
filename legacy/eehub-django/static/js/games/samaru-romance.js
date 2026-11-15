/* Campus story systems: friendship, gifts and romance (story bible §10, character sheets).
   Friendship has five steps (Stranger, Hi-hi, Friend, Close, Family) and each step opens something real: they lend you
   money, share notes, let you swap places with them, send care packages. Gifts come out of your Pockets (Z.inv) and
   are judged against each person's own sheet: three things they love, three they like, three they cannot stand, and a
   gift lands best when you actually listened for it. Romance is optional, opposite-sex only, modest (walks, food,
   study dates, a garden bench) and honest: Friend → Talking → Dating → Steady, planned dates you must turn up for,
   anniversaries, jealousy in each person's own style. Either side can end it for a real reason (neglect, a cheating
   rumour left to grow, jealousy, standing them up) and says why. Being broke never ends it: turning up broke and
   saying so is the best thing you can do. After a break-up they may take you back once, or may not.
     Z.social.tier(id) · perks(id) · listen(id) · ask(id) · plan(id, spot, hour) · arrive() · end(id, why) · reunite(id)
     Z.social.day(P) (once per new day) · Z.social.canSwap(id) · Z.social.card(id) */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData, K = Z && Z.kit;
  if (!Z || !S || !D || !K) return;
  var SOC = Z.social = {}, ST = Z.story, LIKES = D.LIKES || {}, GIFTS = D.GIFTS || {};
  var TIERS = SOC.TIERS = [{ at: 0, name: "Stranger" }, { at: 5, name: "Hi-hi", perk: "They greet you and answer your texts." }, { at: 20, name: "Friend", perk: "Walks with you; lends you ₦500 till Friday." },
    { at: 50, name: "Close", perk: "Swap places with them (C); they share notes before a test." }, { at: 80, name: "Family", perk: "A care package every week; they tell you their secret." }];
  // what each interest values in you (standing tracks), their jealousy style and what they do when you are broke
  var HEART = SOC.HEART = {
    ada: { v: ["department", "academics"], jealous: "I'll say it straight: I saw you with {who}. Explain or don't. I have a timetable.", broke: "No money? Fine. We split everything in half, and here is a plan for the rest of the month.", give: ["notebook", 1] },
    fatima: { v: ["academics", "community"], jealous: "…I am not upset. I am reading. For several days.", broke: "I brought food. Don't say anything. Eat.", give: ["masa", 2] },
    emily: { v: ["community", "social"], jealous: "I went quiet. Then I baked. The baking did not help. Who is {who} to you?", broke: "The farm had extra. Take the basket. Waste is the only sin.", give: ["strawberries", 2] },
    joy: { v: ["social", "community"], jealous: "Tonight's dedication goes out to {who}. And to whoever keeps taking {who} to the gardens.", broke: "I found you a paid voice job. One advert. You say \"Buy it!\" twice.", cash: 1500 },
    maryam: { v: ["academics", "social"], jealous: "I wrote a story. A person, two umbrellas, one {who}. It is on the noticeboard.", broke: "Sit. I will read to you. It costs nothing and it is better than suya.", bond: 4 },
    yakubu: { v: ["department", "community"], jealous: "Good afternoon. I note, for the record, that you were seen with {who}.", broke: "I have made a budget for both of us. Column B is garri. It is a long column.", give: ["garri", 2] },
    kelechi: { v: ["social", "community"], jealous: "I carved for three days and said nothing. The statue looks like {who}. That is a problem.", broke: "No money for a gift? Then I will make one for us. Hold this clay.", bond: 4 },
    abdul: { v: ["department", "street"], jealous: "…Radio check. …Nothing further. …{who}. Over.", broke: "Take my meal ticket. I am on a flying diet anyway. Check.", give: ["bread", 2] },
    basit: { v: ["street", "social"], jealous: "Tell {who} to meet me at the arcade. Best of five. Loser stops texting you.", broke: "Broke? Come. I will win us both a prize at the Game Room. Watch a champion work.", cash: 800 },
    micheal: { v: ["social", "academics"], jealous: "O, that this too, too solid {who} would melt! …Sorry. But also not sorry.", broke: "A free date, then! I shall stage one. The stage is this bench. You are the audience.", bond: 4 },
    lyzzy: { v: ["social", "street"], jealous: "I saw the picture. Everybody saw the picture. I took the picture. Who is {who}?", broke: "Garri again? …Okay, I complained. I'm working on it. Pass the sugar.", bond: 2 },
    lily: { v: ["community", "academics"], jealous: "My plants are wilting. They do that when I am sad. Is it {who}?", broke: "I grew these. Money did not grow them. Take some.", give: ["flowers", 1] },
    nusaybah: { v: ["academics", "department"], jealous: "I noticed {who}. I notice everything. I would rather be told than notice.", broke: "You are broke and trying to hide it. I am a psychologist. Sit, eat, stop performing.", give: ["bread", 1] },
    aleeya: { v: ["social", "community"], jealous: "I made a joke about you and {who} on stage. It got a big laugh. I did not enjoy it.", broke: "Babe, I have outfits older than your problem. Come and eat; it is on the brand.", give: ["meatpie", 2] },
    wednesday: { v: ["academics", "street"], jealous: "Typical. {who}. I have seen this loop before. It ends badly for one of us.", broke: "Money is a Thursday problem. Today is Wednesday. Walk with me.", bond: 4 },
    svitlana: { v: ["department", "social"], jealous: "In my country we say: one seat, one pilot. Who is this {who} in the cockpit?", broke: "No money? In flying we call this \"gliding\". It is still flying. Here, tea.", give: ["tea", 2] },
    bature: { v: ["social", "community"], jealous: "Riddle me this: who has two eyes and still sees you with {who}? …Me. It was me.", broke: "Riddle me this: what is empty and still shared? My wallet. Come, I have garri.", give: ["garri", 2] },
    sadiq: { v: ["community", "street"], jealous: "Toh. I cooked for two. {who} can have yours.", broke: "You have not eaten. I can tell. The pot is on. We talk after.", give: ["rice", 1] },
    yusuf: { v: ["social", "street"], jealous: "People believe me when I say I'm fine. Do you? Because of {who}, I am not.", broke: "Doors open for me. Let me open one for you. Somebody owes me lunch for two.", give: ["meatpie", 2] },
    khalid: { v: ["community", "street"], jealous: "It is fine. …It is not fine. I am saying so. That is new for me. {who}?", broke: "I wrote it in my notebook: \"owed: nothing\". Eat with me.", give: ["bread", 2] },
    tunde: { v: ["social", "academics"], jealous: "I drew you this week. {who} kept ending up in the picture.", broke: "I have no money either. I have pencils. Sit still, this is the date.", bond: 4 },
    lucky: { v: ["fame", "social"], jealous: "Guys! Story time: my person and {who}. …I'm not posting this one.", broke: "Bro. I'm broke too. Don't tell my followers. Garri collab?", give: ["garri", 1] }
  };
  var DRIFTS = { basit: 1, lyzzy: 1 }; // written as the one who drifts when the fun stops, and says so; they can grow out of it
  var SPOTS = SOC.SPOTS = ["love", "facgarden", "selfie", "dam", "shinkafi", "buka", "library", "sculpture", "mk_cinema", "enggarden"];
  var TOPICS = [{ id: "plans", label: "Plans for after school" }, { id: "home", label: "Home and family" }, { id: "jokes", label: "The funniest thing this week" }, { id: "them", label: "Ask about the thing they love" }];

  function blk(P) { return K.block(P, "soc", { tier: {}, last: {}, heard: {}, debt: {}, notes: {}, listen: {}, pack: {} }); }
  function st(P) { return ST.state(P || Z.P); }
  function aff(id) { return S.affinity(Z.P, id) || 0; }
  function likes(id) { return LIKES[id] || {}; }
  function name(id) { return K.name(id); }
  function he(id) { var d = K.npcDef(id); return d && d.voice === "female" ? "she" : "he"; }
  function say(id, line, who) { line = String(line).replace(/\{who\}/g, who || "somebody"); SOC.lastLine = [id, line]; var n = Z.npc(id); try { if (n && Math.hypot(n.x - Z.me.x, n.y - Z.me.y) < 14 && Z.say) { Z.say(n, line); Z.sub(n.id, line); } else if (Z.texts && Z.texts.send) Z.texts.send(id, line, {}); } catch (e) {} }
  function text(id, line, opt) { SOC.lastText = [id, line]; try { if (Z.texts && Z.texts.send) return Z.texts.send(id, line, opt || {}); } catch (e) {} return null; }

  /* ---------- friendship: tiers and perks ---------- */
  SOC.tierIndex = function (a) { var k = 0; for (var i = 0; i < TIERS.length; i++) if (a >= TIERS[i].at) k = i; return k; };
  SOC.tier = function (id) { return TIERS[SOC.tierIndex(aff(id))]; };
  var oTier = S.friendTier; S.friendTier = function (a) { return TIERS[SOC.tierIndex(a || 0)].name; }; SOC._oldTier = oTier;
  SOC.perks = function (id) { var k = SOC.tierIndex(aff(id)); return TIERS.slice(1, k + 1).map(function (t) { return t.perk; }); };
  SOC.canSwap = function (id) { return aff(id) >= 50 || id === ST.tok(Z.P, "@roomie"); };
  function tierWatch(P) { // a new step is a small celebration, once
    var b = blk(P); for (var id in P.friends) { var k = SOC.tierIndex(P.friends[id]), was = b.tier[id] || 0; if (k > was) { b.tier[id] = k; if (k >= 2 && K.npcDef(id) && !SOC.quiet) { try { Z.api.banner(TIERS[k].name.toUpperCase(), { sub: name(id) + " · " + TIERS[k].perk, dur: 2.6, size: 62, col: "#f9a8d4", edge: "#831843" }); Z.api.confetti(70); } catch (e) {} K.sfx("win"); K.toast("<b>" + K.esc(name(id)) + "</b> is now <b>" + TIERS[k].name + "</b>. " + K.esc(TIERS[k].perk)); } K.emit({ t: "tier", npc: id, tier: k, story: true }); } }
  }
  SOC.borrow = function (id) { // Friend: ₦500 till Friday (7 days). One debt at a time per friend.
    var P = Z.P, b = blk(P); if (aff(id) < 20 || b.debt[id]) return false; b.debt[id] = { amt: 500, day: P.day }; try { Z.money(500); } catch (e) { P.money += 500; }
    say(id, K.pickBy(["Five hundred. Friday. I am writing it on my heart and also on paper.", "Take. Pay me Friday. Not \"a Friday\". This Friday.", "Lend me one cup, I'll pay two on Friday: that was you last week. Take the money."], P.day, id.length)); return true;
  };
  SOC.repay = function (id) { var P = Z.P, b = blk(P), d = b.debt[id]; if (!d || P.money < d.amt) return false; P.money -= d.amt; var late = P.day - d.day > 7; delete b.debt[id]; S.bond(P, id, late ? 1 : 3); say(id, late ? "At last. I had started telling people you relocated." : "On time! In this economy! You are a rare one."); return true; };
  SOC.notes = function (id) { var P = Z.P, b = blk(P); if (aff(id) < 50 || b.notes[id] === P.day) return false; b.notes[id] = P.day; K.block(P, "sw", {}).hint = 1; say(id, "My notes. Don't stain them. The next test, one wrong answer will look wrong to you."); return true; };
  function debts(P) { var b = blk(P); for (var id in b.debt) { var d = b.debt[id], late = P.day - d.day; if (late === 8) text(id, "Friday has come and gone. My ₦" + d.amt + " is asking after you."); if (late === 15) { S.bond(P, id, -8); text(id, "Two weeks. Keep the money. I'm keeping the lesson."); if (Z.rumours) Z.rumours.start("walletforgetter", { quiet: true }); d.day = P.day - 9; d.soured = 1; } } }
  function carePacks(P) { // Family: once a week, something they love to give
    var b = blk(P); for (var id in P.friends) { if (P.friends[id] < 80 || !K.npcDef(id)) continue; if (P.day - (b.pack[id] || 0) < 7) continue; b.pack[id] = P.day; var lk = likes(id), item = (lk.liked || []).filter(function (i) { var d = Z.inv && Z.inv.def(i); return d && (d.kind === "food" || d.kind === "drink"); })[0] || "garri";
      if (Z.inv && Z.inv.add(item, 1, { quiet: true })) { K.toast("<b>" + K.esc(name(id)) + "</b> left something at your door: " + K.esc(Z.inv.def(item).name) + ". <small>Family does that.</small>"); SOC.lastPack = [id, item]; break; } }
  }
  function neglectFriends(P) { var b = blk(P); for (var id in P.friends) { if (P.friends[id] <= 20 || !K.npcDef(id)) continue; var gap = P.day - (b.last[id] == null ? P.day : b.last[id]); if (b.last[id] == null) b.last[id] = P.day; if (gap > 12) P.friends[id] = Math.max(20, Math.round((P.friends[id] - .5) * 10) / 10); } }

  /* ---------- gifts: the sheets, made real ---------- */
  function setupGifts() {
    if (!Z.inv || SOC._gifts) return; SOC._gifts = 1; var I = Z.inv, sh = I.SHOPS || {};
    var ICON = { food: "puff", drink: "bottle", gift: "box" }, COL = { food: "#d97706", drink: "#7dd3fc", gift: "#f472b6" };
    for (var id in GIFTS) { var g = GIFTS[id]; if (I.def(id).unknown) I.register(id, { name: g.name, kind: g.kind === "food" || g.kind === "drink" ? g.kind : "gift", gift: true, price: g.price, hunger: g.kind === "food" ? 10 : g.kind === "drink" ? 4 : 0, energy: g.kind === "drink" ? 6 : 0, icon: ICON[g.kind] || "box", col: COL[g.kind] || "#f472b6", text: g.special ? "Somebody on campus loves this. The Gift Corner ordered it in." : "A small thing that makes the right person smile." });
      if (!g.special) { var where = g.kind === "food" || g.kind === "drink" ? ["market", "mk_supermarket", "p2shops"] : ["mk_gifts", "market"]; where.forEach(function (w) { if (sh[w] && sh[w].indexOf(id) < 0) sh[w].push(id); }); } }
    if (I.def("damwater").unknown) I.register("damwater", { name: "A glass of Dam water", kind: "gift", gift: true, price: 0, stack: 1, icon: "bottle", col: "#38bdf8", text: "Carried by hand from the Dam. One person on campus accepts this, once a year." });
    D.NPCS.forEach(function (d) { var lk = LIKES[d.id]; if (!lk || !lk.loved) return; d.likes = d.likes || {}; d.likes.gifts = lk.loved.slice(); d.likedGifts = (lk.liked || []).slice(); var h = [].concat(d.hates || []); (lk.hated || []).forEach(function (x) { if (h.indexOf(x) < 0) h.push(x); }); d.hates = h; });
    var og = I.giftValue; I.giftValue = function (npc, id) { var v = og.apply(I, arguments), lk = LIKES[npc && npc.id] || {}, P = Z.P; if (!lk.loved) return v; var partner = P && st(P).partner === npc.id;
      if (lk.hated && lk.hated.indexOf(id) >= 0) return -3; if (lk.loved.indexOf(id) >= 0) v = SOC.heard(npc.id, id) ? 15 : 10; else if (lk.liked && lk.liked.indexOf(id) >= 0) v = 9; else return v;
      return partner ? Math.round(v * 1.3) : v; };
    var ogive = I.give; I.give = function (npcId, id) { var n = typeof npcId === "string" ? Z.npc(npcId) : npcId; if (n && n.id === "maker") return SOC.makerGift(id); if (n && n.id === "sw_self") return false; return ogive.apply(I, arguments); };
  }
  SOC.heard = function (id, item) { var h = blk(Z.P).heard[id]; return !!(h && h[item]); };
  SOC.hear = function (id, item) { var b = blk(Z.P); (b.heard[id] = b.heard[id] || {})[item] = 1; var g = GIFTS[item], sh = Z.inv && Z.inv.SHOPS; if (g && g.special && sh && sh.mk_gifts && sh.mk_gifts.indexOf(item) < 0) sh.mk_gifts.push(item); }; // the Gift Corner orders in what you heard about
  function restock(P) { var h = blk(P).heard, sh = Z.inv && Z.inv.SHOPS; if (!sh || !sh.mk_gifts) return; for (var id in h) for (var it in h[id]) if (GIFTS[it] && GIFTS[it].special && sh.mk_gifts.indexOf(it) < 0) sh.mk_gifts.push(it); }
  // Listen: once a day they mention one thing from their sheet (a love, a like or a pet hate). This is how you learn gifts.
  SOC.listen = function (id) {
    var P = Z.P, b = blk(P), lk = likes(id); if (b.listen[id] === P.day) return null; b.listen[id] = P.day; b.last[id] = P.day; S.bond(P, id, 2);
    var pool = []; (lk.loved || []).forEach(function (it, i) { if (!SOC.heard(id, it)) pool.push({ it: it, t: "I have always wanted " + low(lk.lovedText && lk.lovedText[i] || itemName(it)) + ". Don't tell anybody." }); });
    (lk.liked || []).forEach(function (it) { if (!SOC.heard(id, it)) pool.push({ it: it, t: "You know what never fails? " + cap(itemName(it)) + ". Simple things." }); });
    var hk = "hate" + (Object.keys(b.heard[id] || {}).length % 3), hates = lk.hates || [];
    if (!pool.length) { var line = hates.length ? "One thing I cannot stand: " + low(hates[(P.day + id.length) % hates.length]) + "." : lk.loves ? "Honestly? I love " + low(lk.loves) + "." : "Nothing new. It is good to just sit."; say(id, line); return { line: line }; }
    var pk = pool[0]; SOC.hear(id, pk.it); say(id, pk.t); K.toast("<b>You listened.</b> " + K.esc(name(id)) + " likes <b>" + K.esc(itemName(pk.it)) + "</b>." + (GIFTS[pk.it] && GIFTS[pk.it].special ? " <small>The Gift Corner can order it.</small>" : "")); void hk; return { item: pk.it, line: pk.t };
  };
  function itemName(it) { try { return Z.inv.def(it).name; } catch (e) { return it; } }
  function low(s) { s = String(s); return s.charAt(0).toLowerCase() + s.slice(1); } function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  // The Maker accepts one thing, once a year: a glass of water from the Dam, brought by hand.
  SOC.makerGift = function (id) {
    var P = Z.P, s = st(P), yr = s.year || 1, b = blk(P); if (id !== "damwater") { say("maker", "Keep it. Somebody else needs it more than I do."); return false; }
    if (b.makerWater === yr) { say("maker", "One glass a year is enough. Drink that one yourself."); return false; } Z.inv.take("damwater", 1); b.makerWater = yr; S.bond(P, "maker", 20); P.flags.maker_water = 1; P.flags["maker_water_y" + yr] = 1;
    say("maker", ["Dam water. Carried by hand. …My sister used to bring me this.", "You carried it all this way and did not spill. Thank you.", "A glass of the Dam. Ai— …Somebody I knew would have liked you.", "Every year, one glass. You remembered. I had stopped expecting it.", "The last glass. I will drink it slowly."][Math.min(4, yr - 1)]); K.emit({ t: "gift", npc: "maker", item: "damwater", story: true }); return 20;
  };

  /* ---------- romance ---------- */
  SOC.canDate = function (P, id) { var lk = LIKES[id]; if (lk) return !!lk.romance && lk.romance === K.sex(P); return false; };
  ST.canDate = function (p, id) { return SOC.canDate(p, id); }; // the sheets are the authority: opposite sex only, no couples, no staff
  function rel(id) { var s = st(); return s.rel[id] || null; }
  SOC.stage = function (id) { var s = st(), r = s.rel[id]; if (r && s.partners.indexOf(id) >= 0) return r.stage || "dating"; if (s.exes.indexOf(id) >= 0) return "ex"; return ""; };
  SOC.valued = function (id) { var h = HEART[id] || { v: ["social", "community"] }, s = st().standing; return Math.max(s[h.v[0]] || 0, s[h.v[1]] || 0); };
  // Ask them out (Friend → Talking). Nobody is won by pestering: a "not now" means a week.
  SOC.ask = function (id) {
    var P = Z.P, s = st(P), b = blk(P), a = aff(id); if (!SOC.canDate(P, id)) return { ok: false, why: "no" };
    if (SOC.stage(id) === "ex") return SOC.reunite(id); if (s.partners.indexOf(id) >= 0) return { ok: true, why: "already" };
    var cool = b["no_" + id]; if (cool && P.day - cool < 7) { S.bond(P, id, -3); say(id, "I said not now. Asking again so soon is how \"not now\" becomes \"no\"."); return { ok: false, why: "pester" }; }
    var bad = Z.rumours ? Z.rumours.heat("cheat") : 0, ok = a >= 35 && (SOC.valued(id) >= 8 || a >= 50) && bad < 30;
    if (!ok) { b["no_" + id] = P.day; say(id, bad >= 30 ? "I heard things about you. Maybe they are not true. Not now." : a < 35 ? "We barely know each other. Not now. Keep being around." : "Not now. Be somebody on this campus first; then ask me again."); return { ok: false, why: bad >= 30 ? "rumour" : a < 35 ? "friendship" : "standing" }; }
    ST.date(P, id); var r = s.rel[id]; r.stage = "talking"; r.dates = 0; r.missed = 0; r.jeal = 0; r.anniv = 0; r.std0 = SOC.valued(id); P.partner = id;
    say(id, K.pickBy(["Yes. But slowly. Walk me to class tomorrow; we start there.", "I thought you would never ask. …Yes. Don't make it weird.", "Okay. One date. If you are late I will leave, with love."], P.day, id.length));
    try { Z.api.banner("TALKING", { sub: "You and " + name(id) + " · plan a date", dur: 2.6, size: 70, col: "#f9a8d4", edge: "#831843" }); } catch (e) {} K.emit({ t: "romance", npc: id, stage: "talking", story: true }); return { ok: true };
  };
  // Plan a date: a place and an hour today or tomorrow. You have to turn up.
  SOC.plan = function (id, spot, hour, dayOff) {
    var P = Z.P, r = rel(id); if (!r || st(P).partners.indexOf(id) < 0 || !Z.place(spot)) return false; var day = P.day + (dayOff || 0); if (!dayOff && hour * 60 <= P.time) day++;
    r.appt = { day: day, hour: hour, spot: spot }; say(id, "It's a date. " + Z.place(spot).name + ", " + hour + ":00" + (day > P.day ? " tomorrow" : " today") + ". Don't be late."); return true;
  };
  SOC.appt = function () { var s = st(), out = null; s.partners.forEach(function (id) { var r = s.rel[id]; if (r && r.appt && (!out || r.appt.day < out.day)) out = { id: id, day: r.appt.day, hour: r.appt.hour, spot: r.appt.spot }; }); return out; };
  function together(id, kind) { var P = Z.P, r = rel(id); if (!r) return; r.last = P.day; r.warn = 0; r.jeal = Math.max(0, (r.jeal || 0) - 25); if (kind) r.today = P.day; }
  // You arrived for the date in time: a short scene, three small decisions, and how it went.
  SOC.arrive = function (pick) {
    var P = Z.P, a = SOC.appt(); if (!a || a.day !== P.day) return false; var pl = Z.place(a.spot), h = P.time / 60; if (h < a.hour - .5 || h > a.hour + 1.5 || !pl || Math.hypot(pl.mx - Z.me.x, pl.my - Z.me.y) > 18) return false;
    var id = a.id, r = rel(id), lk = likes(id), n = Z.npc(id); r.appt = null; if (n) { var f = S.push(Z.W, Z.me.x + 1.6, Z.me.y + .6, .5); n.x = n.hx = f.x; n.y = n.hy = f.y; n.wave = 1.5; }
    var gifts = Z.inv ? Object.keys(P.inv).filter(function (k) { return P.inv[k] > 0 && Z.inv.droppable(k) && /^(gift|food|drink)$/.test(Z.inv.def(k).kind); }).slice(0, 5) : [];
    function finish(topic, gift) {
      var sc = 2, lines = []; if (h <= a.hour + .25) { sc += 1; lines.push("You were on time."); } else lines.push("You were late, and " + he(id) + " noticed.");
      if (gift) { var v = Z.inv.give(id, gift); if (v === false) v = 0; sc += v >= 12 ? 2 : v >= 7 ? 1 : v < 0 ? -2 : 0; lines.push(v >= 12 ? "The gift was exactly right." : v < 0 ? "The gift was… a choice." : "The gift was kind."); }
      if (topic === "them") { sc += 2; lines.push("You asked about " + low(lk.loves || "what they love") + " and listened for a long time."); } else if (topic === "jokes") { sc += 1; lines.push("You both laughed till the bench shook."); } else sc += 1;
      if (P.money < 500) { sc += 1; lines.push("You said plainly that you are broke. " + cap(he(id)) + " laughed and shared " + (HEART[id] && HEART[id].give ? low(itemName(HEART[id].give[0])) : "garri") + ". The best kind of date."); P.flags.garri_date_free = 1; }
      var gain = sc * 2.5; S.bond(P, id, gain); r.dates = (r.dates || 0) + 1; together(id, "date"); P.stats.dates = (P.stats.dates || 0) + 1; r.missed = Math.max(0, (r.missed || 0) - 1);
      if (r.stage === "talking" && r.dates >= 2 && aff(id) >= 55) { r.stage = "dating"; lines.push("<b>You are dating now.</b>"); K.emit({ t: "romance", npc: id, stage: "dating", story: true }); }
      SOC.lastDate = { id: id, score: sc, gain: gain, stage: r.stage }; try { S.advance(P, 75); } catch (e) {} K.sfx("power");
      K.card(sc >= 6 ? "A perfect evening" : sc >= 4 ? "A good date" : "It was… fine", "You and " + K.esc(name(id)) + " at " + K.esc(pl.name) + ".<br>" + lines.join("<br>") + "<br><b>+" + gain + " friendship</b>", "Walk " + (K.npcDef(id).voice === "female" ? "her" : "him") + " back", function () { if (Z.xp) Z.xp(15 + sc * 5); if (Z.save) Z.save(); });
      K.emit({ t: "date", npc: id, score: sc, story: true });
    }
    if (pick) { finish(pick.topic || "them", pick.gift || ""); return true; }
    K.panel("💬 " + K.esc(name(id)) + " at " + K.esc(pl.name), "What do you talk about?", TOPICS.map(function (t) { return { id: t.id, label: t.label }; }), function (topic) {
      if (!gifts.length) return finish(topic, "");
      K.panel("Bring out a gift?", "From your pockets.", gifts.map(function (g) { return { id: g, label: K.esc(itemName(g)) }; }).concat([{ id: "-", label: "No gift. Just you." }]), function (g) { finish(topic, g === "-" ? "" : g); }, { first: false });
    });
    return true;
  };
  // Dating → Steady: time, closeness, and proof that you listened (you gave something they love after hearing it).
  SOC.steady = function (id) {
    var P = Z.P, r = rel(id); if (!r || r.stage !== "dating") return { ok: false, why: "stage" }; var lk = likes(id), listened = (lk.loved || []).some(function (it) { return SOC.heard(id, it) && r.gaveLoved; });
    if (P.day - r.since < 20) { say(id, "We are fine as we are. Ask me again when we have had more ordinary days."); return { ok: false, why: "time" }; }
    if (aff(id) < 80) { say(id, "Soon. Not yet. I want to be sure, and so should you."); return { ok: false, why: "friendship" }; }
    if (!listened) { say(id, "Do you actually know me? What I love? Find out. Then ask."); return { ok: false, why: "listened" }; }
    r.stage = "steady"; say(id, "Yes. Officially, properly, yes."); try { Z.api.confetti(160); Z.api.banner("STEADY", { sub: "You and " + name(id), dur: 3, size: 80, col: "#f9a8d4", edge: "#831843" }); } catch (e) {} K.sfx("win"); K.emit({ t: "romance", npc: id, stage: "steady", story: true }); return { ok: true };
  };
  // Either side can end it, and says why. They keep their dignity; you keep the friendship, after a while.
  var WHY = { neglect: "Too long without a word. I am not angry. I am just not waiting any more.", rumour: "I asked you about what I heard. You said nothing. Silence is an answer.", jealousy: "I should not have to compete for my own person. I'm done.", noshow: "Three times I waited. I have counted. There will not be a fourth.", cheat: "Both of us? At once? Goodbye. We are having lunch together, by the way. Without you.", you: "Okay. Thank you for saying it to my face. I mean that." };
  SOC.end = function (id, why) {
    var P = Z.P, s = st(P), r = s.rel[id]; if (s.partners.indexOf(id) < 0) return false; var keep = { why: why, day: P.day, std: SOC.valued(id), stage: r && r.stage, asked: false };
    if (why !== "you") say(id, WHY[why] || WHY.neglect); else say(id, WHY.you);
    ST.breakup(P, id, why === "cheat" ? "cheat" : "neglect"); blk(P)["ex_" + id] = keep; P.partner = s.partner || "";
    if (why !== "you" && !SOC.quiet) K.toast("<b>" + K.esc(name(id)) + " has ended it.</b> " + ({ neglect: "You were away too long.", rumour: "A rumour you never answered.", jealousy: "Jealousy you never eased.", noshow: "Three missed dates.", cheat: "They found out about each other." }[why] || ""));
    K.emit({ t: "breakup", npc: id, why: why, story: true }); return true;
  };
  // Getting back together: once, after two cool weeks, and only if something real has changed. It may still be a no.
  SOC.reunite = function (id) {
    var P = Z.P, b = blk(P), x = b["ex_" + id]; if (!x || SOC.stage(id) !== "ex") return { ok: false, why: "notex" };
    if (x.asked) { say(id, "You asked once. I answered. Let us be good friends."); return { ok: false, why: "asked" }; }
    if (P.day - x.day < 14) { say(id, "It has not even been two weeks. Give it time."); return { ok: false, why: "soon" }; }
    var changed = SOC.valued(id) - (x.std || 0) >= 4 || (x.why !== "cheat" && b["exgift_" + id]), confessed = x.why !== "cheat" || P.flags.twotimed_confessed;
    if (!changed || !confessed || aff(id) < 45) { say(id, !confessed ? "You never even said sorry properly." : aff(id) < 45 ? "We are barely friends again. Start there." : "What has changed? Nothing I can see. Show me, don't tell me."); return { ok: false, why: !confessed ? "sorry" : aff(id) < 45 ? "friendship" : "change" }; }
    x.asked = true; var chance = (x.why === "cheat" ? .3 : x.why === "you" ? .7 : .6) + (aff(id) - 45) / 200, roll = S.hash(P.day * 7 + id.length, id.charCodeAt(0));
    if (roll > chance) { say(id, "No. But thank you for asking properly. I mean it: no."); K.emit({ t: "reunion", npc: id, ok: false, story: true }); return { ok: false, why: "no", roll: roll, chance: chance }; }
    var s = st(P); s.exes = s.exes.filter(function (e) { return e !== id; }); ST.date(P, id); var r = s.rel[id]; r.stage = "dating"; r.dates = 0; r.missed = 0; r.jeal = 0; r.anniv = 0; r.again = 1; P.partner = id;
    say(id, "…Yes. Once. We do it better this time, or not at all."); try { Z.api.banner("AGAIN", { sub: "You and " + name(id), dur: 2.6, size: 80, col: "#f9a8d4", edge: "#831843" }); } catch (e) {} K.emit({ t: "reunion", npc: id, ok: true, story: true }); return { ok: true, roll: roll, chance: chance };
  };
  function jealous(id, of) { // attention you gave another person you could be courting
    var s = st(), P = Z.P; s.partners.forEach(function (p) { if (p === id) return; var r = s.rel[p]; if (!r) return; r.jeal = (r.jeal || 0) + of; if (r.jeal >= 40 && r.jealDay !== P.day) { r.jealDay = P.day; var h = HEART[p]; say(p, h ? h.jealous : "I saw you with {who}. Should I be worried?", name(id)); } if (Z.rumours && of >= 30) Z.rumours.start("seenwith", { about: id, quiet: true }); });
  }
  // once per new day: neglect, missed dates, anniversaries, rumours, jealousy, two-timing, and the kindness of being broke together
  SOC.day = function (P) {
    var s = st(P), b = blk(P), out = []; tierWatch(P); debts(P); carePacks(P); neglectFriends(P);
    s.partners.slice().forEach(function (id) {
      var r = s.rel[id] || (s.rel[id] = { since: P.day, last: P.day, warn: 0 }), gap = P.day - r.last, h = HEART[id] || {};
      if (r.appt && r.appt.day < P.day) { r.appt = null; r.missed = (r.missed || 0) + 1; S.bond(P, id, -8); if (Z.rumours) Z.rumours.start("stoodup", { about: id, quiet: true }); text(id, r.missed >= 3 ? "I waited. Again." : "I waited an hour. Alone. With two drinks. What happened?"); out.push(["missed", id]); if (r.missed >= 3) { SOC.end(id, "noshow"); out.push(["leave", id, "noshow"]); return; } }
      var months = Math.floor((P.day - r.since) / 30); if (months > (r.anniv || 0) && (P.day - r.since) % 30 === 0) { r.anniv = months; r.annivDay = P.day; r.annivKept = 0; text(id, (months === 1 ? "One month" : months + " months") + " today. Do you know what today is? I do."); out.push(["anniversary", id, months]); }
      if (r.annivDay != null && P.day === r.annivDay + 1) { if (r.annivKept) { S.bond(P, id, 6); text(id, "You remembered. I am keeping yesterday."); } else { S.bond(P, id, -8); r.jeal = (r.jeal || 0) + 15; text(id, "Yesterday was our day. You forgot. I am not angry. I am a little angry."); out.push(["forgot", id]); } r.annivDay = null; }
      if (gap >= 7 && !r.warn) { r.warn = 1; text(id, "You have been scarce. Seven days. Are we still a thing?"); out.push(["warn", id]); }
      if (gap >= 14 && (P.money < 500 || gap >= 21)) { SOC.end(id, "neglect"); out.push(["leave", id, "neglect"]); return; } // being broke alone never does it; broke AND absent does, sooner
      var heat = Z.rumours ? Z.rumours.heat("cheat") : 0; if (heat >= 60) { r.rum = (r.rum || 0) + 1; if (r.rum === 1) text(id, "People are saying things about you. Is any of it true? Talk to me.", { replies: [["It is not true. Ask me anything.", 2, "…Okay. I believe you. Tell the twins, though."], ["I'm sorry. Some of it is.", -4, "Thank you for not lying. I need a few days."]], then: function (i) { r.rum = -3; if (i === 0 && Z.rumours && !s.twoTiming) { Z.rumours.list().forEach(function (q) { Z.rumours.squash(q.key, 30); }); } } }); if (r.rum >= 4) { SOC.end(id, "rumour"); out.push(["leave", id, "rumour"]); return; } } else if (r.rum > 0) r.rum = 0;
      if ((r.jeal || 0) >= 100) { SOC.end(id, "jealousy"); out.push(["leave", id, "jealousy"]); return; } r.jeal = Math.max(0, (r.jeal || 0) - 4);
      if (DRIFTS[id] && P.money < 300 && gap >= 3 && r.drift !== 1 && aff(id) < 85) { r.drift = 1; S.bond(P, id, -3); text(id, "I'll be honest: it is less fun when you're broke AND busy. I know that is my flaw. Come and see me."); out.push(["drift", id]); }
    });
    if (s.twoTiming && s.partners.length > 1 && S.hash(P.day, s.partners.length * 7) < .3) { var all = s.partners.slice(); all.forEach(function (id) { SOC.end(id, "cheat"); }); P.flags.twotimed_caught = 1; if (Z.rumours) Z.rumours.start("twotimer"); K.toast("<b>They found out about each other.</b> The twins noticed first. Both of them are done with you."); out.push(["caught", all]); }
    P.partner = s.partner || ""; return out;
  };
  // talking to your partner when you are broke: their own "broke" scene (once every ten days). It deepens things.
  function brokeScene(id) { var P = Z.P, r = rel(id), h = HEART[id]; if (!r || !h || P.money >= 500 || (r.brokeDay && P.day - r.brokeDay < 10)) return false; r.brokeDay = P.day; say(id, h.broke); S.bond(P, id, 3 + (h.bond || 0)); if (h.give && Z.inv) Z.inv.add(h.give[0], h.give[1], { quiet: true }); if (h.cash) { try { Z.money(h.cash); } catch (e) { P.money += h.cash; } } P.flags.honest_broke_scene = 1; together(id); K.emit({ t: "brokescene", npc: id, story: true }); return true; }

  /* ---------- events ---------- */
  K.on("talk", function (ev, P) { var id = ev.npc, b = blk(P); if (!K.npcDef(id)) return; b.last[id] = P.day; if (st(P).partners.indexOf(id) >= 0) { together(id); brokeScene(id); } });
  K.on("gift", function (ev, P) { var id = ev.npc, b = blk(P), lk = likes(id), s = st(P); if (!id || id === "maker") return; b.last[id] = P.day; if (lk.loved && lk.loved.indexOf(ev.item) >= 0) { var r0 = s.rel[id]; if (r0 && SOC.heard(id, ev.item)) r0.gaveLoved = 1; SOC.hear(id, ev.item); if (SOC.stage(id) === "ex") b["exgift_" + id] = 1; }
    if (s.partners.indexOf(id) >= 0) { together(id); var r = s.rel[id]; if (r.annivDay === P.day) r.annivKept = 1; } else if (SOC.canDate(P, id) && s.partners.length) jealous(id, /^(flowers|perfume|chocolate)$/.test(ev.item) ? 35 : 15); });
  K.on("date", function (ev, P) { var r = st(P).rel[ev.npc]; if (r && r.annivDay === P.day) r.annivKept = 1; });
  K.on("eat", function (ev, P) { var s = st(P); (Z.npcs || []).forEach(function (n) { if (n.follow && s.partners.indexOf(n.id) >= 0 && Math.hypot(n.x - Z.me.x, n.y - Z.me.y) < 12) together(n.id); }); });

  /* ---------- every frame / load ---------- */
  K.begin(function (P) { setupGifts(); restock(P); var s = st(P), b = blk(P); SOC.quiet = true; tierWatch(P); SOC.quiet = false; SOC.tw = 0; SOC.dates0 = P.stats ? P.stats.dates || 0 : 0;
    if (P.partner && !s.partner) { if (SOC.canDate(P, P.partner)) { ST.date(P, P.partner); s.rel[P.partner].stage = "steady"; } else P.partner = ""; } void b; });
  K.daily(function (P) { SOC.lastDay = SOC.day(P); });
  K.tick(function (dt, P) {
    var s = st(P); SOC.tw = (SOC.tw || 0) - dt; if (SOC.tw <= 0) { SOC.tw = 1.5; tierWatch(P);
      if (P.partner !== (s.partner || "")) { if (P.partner && SOC.canDate(P, P.partner) && s.partners.indexOf(P.partner) < 0) { ST.date(P, P.partner); var r = s.rel[P.partner]; r.stage = "steady"; r.dates = r.dates || 0; } P.partner = s.partner || ""; } // the old "official" button obeys the same rules
      if (P.stats && (P.stats.dates || 0) > SOC.dates0) { SOC.dates0 = P.stats.dates; s.partners.forEach(function (id) { var n = Z.npc(id); if (n && Math.hypot(n.x - Z.me.x, n.y - Z.me.y) < 20) together(id, "date"); }); (Z.npcs || []).forEach(function (n) { if (Math.hypot(n.x - Z.me.x, n.y - Z.me.y) < 8 && s.partners.length && s.partners.indexOf(n.id) < 0 && SOC.canDate(P, n.id)) jealous(n.id, 45); }); }
      var a = SOC.appt(); if (a) { var h = P.time / 60, n2 = Z.npc(a.id), pl = Z.place(a.spot); if (a.day === P.day && h >= a.hour - 1 && h <= a.hour + 1.5 && n2 && pl) { n2.hx = pl.mx + 1.5; n2.hy = pl.my + 1.5; if (!n2.follow && Math.hypot(n2.x - n2.hx, n2.y - n2.hy) > 60 && Math.hypot(n2.x - Z.me.x, n2.y - Z.me.y) > 60) { n2.x = n2.hx; n2.y = n2.hy; n2.rt = null; } SOC.pinDate = a.id; if (!a.told && h >= a.hour - 1) { var r2 = rel(a.id); r2.appt.told = 1; K.toast("<b>Date in an hour:</b> " + K.esc(name(a.id)) + " at " + K.esc(pl.name) + ", " + a.hour + ":00."); } } } }
    if (SOC.pinDate) { var pn = Z.npc(SOC.pinDate), ap = SOC.appt(); if (!ap || ap.id !== SOC.pinDate || ap.day !== P.day || P.time / 60 > ap.hour + 1.5 || P.time / 60 < ap.hour - 1) SOC.pinDate = ""; else if (pn && !pn.follow && Math.hypot(pn.x - pn.hx, pn.y - pn.hy) < 3) { pn.x = pn.hx; pn.y = pn.hy; pn.spd = 0; pn.rt = null; } }
  });
  K.spot({ id: "soc_date", x: 0, y: 0, r: 16, when: function (sp) { var a = SOC.appt(), P = Z.P; if (!a || a.day !== P.day) return false; var pl = Z.place(a.spot), h = P.time / 60; if (!pl || h < a.hour - .5 || h > a.hour + 1.5) return false; sp.x = pl.mx; sp.y = pl.my; return true; }, label: function () { var a = SOC.appt(); return "Start the date with " + name(a.id); }, act: function () { SOC.arrive(); } });
  K.spot({ id: "soc_damwater", x: 0, y: 0, r: 9, when: function (sp) { var pl = Z.place("dam"); if (!pl || !Z.inv || Z.inv.count("damwater") > 0) return false; sp.x = pl.mx; sp.y = pl.my; return !!(Z.P.flags.met_maker || Z.P.flags.sister_line_1 || Z.P.m.done.m11); }, label: "Fill a glass from the Dam", act: function () { if (Z.inv.add("damwater", 1)) K.toast("<b>A glass of Dam water.</b> Carry it by hand. One person accepts this, once a year."); } });
  K.chip(function () { var a = SOC.appt(), P = Z.P; if (!a) return null; var pl = Z.place(a.spot); return { text: "♥ " + name(a.id) + " · " + (a.day === P.day ? "today" : a.day === P.day + 1 ? "tomorrow" : "day " + a.day) + " " + a.hour + ":00 · " + (pl ? pl.name : ""), col: "#f9a8d4" }; });

  /* ---------- the friend card and the talk menu ---------- */
  SOC.card = function (id) {
    var P = Z.P, e = K.esc, a = aff(id), t = SOC.tier(id), k = SOC.tierIndex(a), lk = likes(id), b = blk(P), h = b.heard[id] || {}, nx = TIERS[k + 1], stage = SOC.stage(id), r = rel(id);
    var known = Object.keys(h).map(itemName), lovedN = (lk.loved || []).length + (lk.liked || []).length;
    var body = "<b>" + t.name + "</b> · " + Math.round(a) + "/100" + (nx ? " <small>(" + nx.name + " at " + nx.at + ")</small>" : "") +
      (stage ? "<br>♥ " + ({ talking: "Talking", dating: "Dating", steady: "Steady", ex: "You were together once" }[stage]) + (r && stage !== "ex" ? " · day " + (P.day - r.since + 1) + " · " + (r.dates || 0) + " date" + ((r.dates || 0) === 1 ? "" : "s") + ((r.missed || 0) ? " · " + r.missed + " missed" : "") : "") : "") +
      "<br><br><b>Perks</b><br>" + (SOC.perks(id).map(function (p) { return "• " + e(p); }).join("<br>") || "<small>None yet. Chat, listen, share food.</small>") + (nx ? "<br><small>Next: " + e(nx.perk) + "</small>" : "") +
      "<br><br><b>What you know</b><br>" + (known.length ? "Likes: " + e(known.join(", ")) : "<small>Nothing yet. Listen to them.</small>") + (lovedN ? " <small>(" + known.length + " of " + lovedN + ")</small>" : "") +
      (k >= 2 && lk.loves ? "<br>Loves: " + e(lk.loves) : "") + (k >= 3 && lk.quirk ? "<br>Quirk: " + e(lk.quirk) : "") + (k >= 2 && lk.hates && lk.hates.length ? "<br>Cannot stand: " + e(lk.hates.slice(0, k - 1).join("; ")) : "") +
      (b.debt[id] ? "<br><br>You owe " + e(name(id)) + " " + K.naira(b.debt[id].amt) + "." : "");
    K.panel(e(name(id)), body, [{ id: "ok", label: "Back", go: true }], function () { try { var n = Z.npc(id); if (n && Z.ui.talk) Z.ui.talk(n); } catch (er) {} });
  };
  function hours() { var P = Z.P, h = Math.ceil(P.time / 60) + 1, out = []; [12, 14, 16, 17, 18, 19, 20].forEach(function (x) { out.push({ h: x, off: x >= h ? 0 : 1 }); }); return out; }
  SOC.planMenu = function (id) {
    K.panel("Plan a date with " + K.esc(name(id)), "Pick a place. Then turn up.", SPOTS.filter(function (s) { return Z.place(s); }).slice(0, 8).map(function (s) { return { id: s, label: K.esc(Z.place(s).name) }; }), function (spot) {
      K.panel("What time?", K.esc(Z.place(spot).name), hours().map(function (o) { return { id: o.h + ":" + o.off, label: o.h + ":00 " + (o.off ? "tomorrow" : "today") }; }), function (a) { var p = String(a).split(":"); SOC.plan(id, spot, +p[0], +p[1]); }, { first: false }); }, { first: false });
  };
  SOC.items = function (n, items) {
    var P = Z.P, id = n.id, d = n.def || {}; if (!K.npcDef(id) || d.temp || d.sw) return; var b = blk(P), a = aff(id), stage = SOC.stage(id), can = SOC.canDate(P, id);
    function close() { K.close(); }
    if (LIKES[id]) items.push({ label: "Listen", sub: b.listen[id] === P.day ? "They have said their piece today" : "Let them talk. You may learn what they like", off: b.listen[id] === P.day, run: function () { close(); SOC.listen(id); } });
    items.push({ label: "What I know about " + d.name, sub: SOC.tier(id).name + " · perks, likes" + (stage ? ", you two" : ""), run: function () { SOC.card(id); } });
    if (b.debt[id]) items.push({ label: "Pay back " + K.naira(b.debt[id].amt), sub: P.money >= b.debt[id].amt ? "Clear your debt" : "You don't have it yet", off: P.money < b.debt[id].amt, run: function () { close(); SOC.repay(id); } });
    else if (a >= 20 && LIKES[id]) items.push({ label: "Borrow ₦500", sub: "Till Friday. Pay it back", run: function () { close(); SOC.borrow(id); } });
    if (a >= 50 && LIKES[id]) items.push({ label: "Ask for notes", sub: b.notes[id] === P.day ? "Already shared today" : "One wrong answer struck out in your next quiz", off: b.notes[id] === P.day, run: function () { close(); SOC.notes(id); } });
    if (!can) return;
    if (!stage) items.push({ label: "Ask " + (d.voice === "female" ? "her" : "him") + " out", sub: a >= 35 ? "Honestly, and once" : "Needs more friendship (35). You are at " + Math.round(a), off: a < 35, run: function () { close(); SOC.ask(id); } });
    else if (stage === "ex") items.push({ label: "Ask to try again", sub: "Once. Only if something has really changed", run: function () { close(); SOC.reunite(id); } });
    else { var r = rel(id); items.push({ label: r.appt ? "Change the date" : "Plan a date", sub: r.appt ? "Now: " + r.appt.hour + ":00, " + (Z.place(r.appt.spot) || {}).name : "A place and a time. Then turn up", run: function () { SOC.planMenu(id); } });
      if (stage === "dating") items.push({ label: "Ask to go steady", sub: "Needs time, Family (80) and proof you listened", run: function () { close(); SOC.steady(id); } });
      items.push({ label: "End it kindly", sub: "To their face. They may or may not take you back", run: function () { K.panel("End it with " + K.esc(d.name) + "?", "This is real. " + K.esc(d.name) + " stays in your story as a friend, after a while.", [{ id: "no", label: "No. Stay.", go: true }, { id: "yes", label: "Yes. End it kindly." }], function (x) { if (x === "yes") SOC.end(id, "you"); }); } }); }
  };
  K.tick(function () { var F = Z.friends; if (!F || F._soc || !F.items) return; F._soc = 1; var oi = F.items; F.items = function (n, items) { oi.apply(F, arguments); try { for (var i = items.length - 1; i >= 0; i--) if (/^(Ask on a date|Ask to be official)$/.test(items[i].label) && n && !SOC.canDate(Z.P, n.id)) items.splice(i, 1); if (n) SOC.items(n, items); } catch (e) { K.errs.push(String(e)); } }; });
})();
