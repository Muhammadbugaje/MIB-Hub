/* Freshers School Life — menus: title and character creator, places (hostel, class, food, shop, bank, jobs, races),
   talking, dates. The phone itself is the handset in samaru-phone.js (U.phone toggles it); U.phoneMenu is a fallback. */
(function () {
  "use strict";
  var S = window.SamaruSim, D = window.SamaruData, G = window.SamaruDraw, Z = window.SamaruGame, U = Z.ui, rnd = S.rng((Date.now() >>> 3) | 1);
  Z.CHAT = ["How far!", "Follow me.", "Race you!", "Wait for me.", "Let's go and chop.", "Shades! Help!", "You win this round!", "Nice one!", "Meet at the Senate.", "Sannu!"];
  function esc(s) { return Z.api.esc(s); }
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function root() { return document.querySelector("[data-gm-overlay]"); }
  function paint() { [].forEach.call(root().querySelectorAll("canvas[data-sface]"), function (cv) { var id = cv.getAttribute("data-sface"), lk = Z.charOf(id).id === id ? Z.charOf(id) : (Z.npc(id) || {}).def, c = cv.getContext("2d"); if (!lk) return; c.clearRect(0, 0, 144, 144); c.fillStyle = "rgba(255,255,255,.06)"; c.beginPath(); c.arc(72, 72, 70, 0, 6.3); c.fill(); c.save(); c.beginPath(); c.arc(72, 72, 70, 0, 6.3); c.clip(); G.face(c, lk, 72, 64, 40); c.restore(); }); }
  function show(html, on) { Z.api.show(html, on); paint(); }
  function close() { Z.api.hide(); }
  // A titled list of buttons. items: [{label, sub, act, off}]
  function menu(title, intro, items, on, back) {
    show("<h2>" + title + "</h2>" + (intro ? "<p>" + intro + "</p>" : "") + "<div class='gm-actions' style='flex-direction:column;align-items:stretch;max-width:520px;margin:0 auto;width:100%'>" + items.map(function (it, i) { return "<button class='gm-btn" + (it.go ? " gm-btn--go" : "") + "' data-act='i" + i + "'" + (it.off ? " disabled style='opacity:.45'" : "") + "><b style='color:inherit'>" + it.label + "</b>" + (it.sub ? "<br><small style='opacity:.85'>" + it.sub + "</small>" : "") + "</button>"; }).join("") + "<button class='gm-btn' data-act='back'>" + (back ? "Back" : "Close") + "</button></div>",
      function (a) { if (a === "back") { if (back) back(); else close(); return; } var it = items[+a.slice(1)]; if (it && !it.off) on(it); });
  }
  U.menu = menu;

  /* ---------- title and character creator ---------- */
  U.title = function () {
    U.heroArm();
    var save = Z.load(); Z.mode = "title";
    show("<h2 style='font-size:clamp(30px,7vw,58px);letter-spacing:-.03em;overflow-wrap:anywhere'>" + esc(Z.resolveText ? Z.resolveText("{{GAME_NAME|upper}}") : String((D.CONFIG || {}).gameName || "").toUpperCase()) + "</h2><p>Your first year at the most beautiful school in the north. Go to class, chop MACD at Shinkafi, ride okada, make friends, fall in love, and find out who keeps taking the light.</p><div class='gm-actions'>" +
      (save ? "<button class='gm-btn gm-btn--go' data-act='cont'>Continue · " + esc(save.name || Z.charOf(save.char).name) + " · level " + save.lvl + " · day " + save.day + "</button>" : "") + "<button class='gm-btn" + (save ? "" : " gm-btn--go") + "' data-act='new'>New student</button>" + (Z.saves ? "<button class='gm-btn' data-act='saves'>Saves</button>" : "") + "<button class='gm-btn' data-act='how'>How to play</button>" + (Z.rollCredits ? "<button class='gm-btn' data-act='credits'>Credits</button>" : "") + "</div><p><b>A game by " + esc(D.CREATOR.short) + "</b></p><p class='gm-small'>" + esc(Z.resolveText ? Z.resolveText("{{GAME_INITIALS}}") : (D.CONFIG || {}).initials || "") + ". The students and staff in the story are fictional.</p>",
      function (a) { if (a === "saves" && Z.saves) { Z.saves.open(U.title); return; } if (a === "credits") { close(); Z.rollCredits({ onEnd: U.title }); return; } if (a === "cont") { close(); Z.begin(save); } else if (a === "new") { if (save) menu("Start again?", "Your saved student (" + esc(save.name || "") + ", level " + save.lvl + ") will be replaced.", [{ label: "Yes, new student", act: "y", go: true }], function () { creator({}); }, U.title); else creator({}); } else U.help(U.title); });
  };
  function creator(c) {
    c.char = c.char || "tunde"; if (c.skin == null) c.skin = "light"; /* the owner's default: a light-skinned fresher (any tone can be picked) */ c.outfit = c.outfit || 0; c.tone = c.tone || 0; if (c.name == null) c.name = "";
    var ch = Z.charOf(c.char), LF = Z.life; if (!c.sex) c.sex = ch.voice === "female" ? "f" : "m"; c.dept = c.dept || "elect"; c.faith = c.faith || "none";
    var homes = LF.hostels(c.sex); if (!homes.length) homes = Z.placeList.filter(function (p) { return p.role === "home"; }); if (!homes.some(function (h) { return h.id === c.home; })) c.home = homes[0].id;
    function row(title, key, list, cur, note) { return "<div>" + title + "<div class='gm-actions' style='justify-content:flex-start'>" + list.map(function (o) { return "<button class='gm-btn gm-btn--sm' data-act='" + key + ":" + o[0] + "' aria-pressed='" + (o[0] === cur) + "'>" + esc(o[1]) + "</button>"; }).join("") + "</div>" + (note ? "<small>" + note + "</small>" : "") + "</div>"; }
    U.inCreator = c; if (c.char === D.HERO.id && !U.heroOpen()) c.char = "tunde"; ch = Z.charOf(c.char);
    show("<h2>Who are you?</h2><div class='gm-picks'>" + D.CAST.concat(U.heroSeen() ? [D.HERO] : []).map(function (k) { return "<button type='button' class='gm-pick' data-act='c:" + k.id + "' aria-pressed='" + (k.id === c.char) + "'><canvas width='144' height='144' data-sface='" + k.id + "'></canvas><b>" + esc(k.name.split(" ")[0]) + "</b><small>" + esc(k.from) + "</small></button>"; }).join("") + "</div>" +
      "<p><b>" + esc(ch.name) + "</b>, from " + esc(ch.from) + ". " + esc(ch.blurb) + " <small>Bonus: " + { charm: "friends warm to you faster", brain: "extra XP from classes", drive: "better handling", fit: "runs longer before tiring" }[ch.perk] + ".</small></p>" +
      "<div class='gm-set' style='display:grid;gap:10px;max-width:520px;margin:0 auto;text-align:left'><label>Name on your ID card <input type='text' maxlength='16' data-name value='" + esc(c.name) + "' placeholder='" + esc(ch.name.split(" ")[0]) + "' style='width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:inherit'></label>" +
      row("I am a", "x", [["m", "Male student"], ["f", "Female student"]], c.sex) +
      row("Hostel", "h", homes.map(function (h) { return [h.id, h.name + (LF.phase2(h.id) ? " (Phase 2)" : "")]; }), c.home, LF.phase2(c.home) ? "Phase 2 is a shuttle ride away from the lecture halls." : "") +
      row("Department · 100 level", "d", LF.DEPTS.map(function (d) { return [d.id, d.name.replace(" Engineering", " Eng.")]; }), c.dept, "Your timetable, your department lectures and your registration all follow this.") +
      (D.SKINS ? row("Skin tone", "k", [["", "Character's own"]].concat(D.SKINS.map(function (s) { return [s.id, s.name]; })), c.skin || "", "<canvas width='144' height='144' data-sface='" + ch.id + "' style='width:56px;height:56px;vertical-align:middle'></canvas> This is how you will look.") : "") +
      row("Faith (optional)", "f", [["none", "Prefer not to say"], ["muslim", "Muslim"], ["christian", "Christian"]], c.faith, "Only adds optional prayer or service times to your timetable.") +
      "<div>Clothes<div class='gm-actions' style='justify-content:flex-start'>" + D.OUTFITS.map(function (o, i) { return "<button class='gm-btn gm-btn--sm' data-act='o:" + i + "' aria-pressed='" + (i === c.outfit) + "'>" + esc(o.name) + "</button>"; }).join("") + "</div></div>" +
      "<div>Voice<div class='gm-actions' style='justify-content:flex-start'>" + ["Natural", "Deep", "Bright"].map(function (o, i) { return "<button class='gm-btn gm-btn--sm' data-act='v:" + i + "' aria-pressed='" + (i === c.tone) + "'>" + o + "</button>"; }).join("") + "<button class='gm-btn gm-btn--sm' data-act='hear'>Hear it</button></div><small>Voices use your device's speech. Turn sound on to hear them.</small></div></div>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Start semester</button><button class='gm-btn' data-act='back'>Back</button></div>",
      function (a) {
        var inp = root().querySelector("[data-name]"); if (inp) c.name = inp.value.replace(/[<>&"]/g, "").trim().slice(0, 16);
        if (a === "back") { U.inCreator = null; return U.title(); } if (a === "c:" + D.HERO.id && !U.heroOpen()) return U.heroAsk(c, creator); if (a === "hear") { Z.api.sound.say("How far! My name is " + (c.name || ch.name.split(" ")[0]) + ".", { voice: ch.voice, pitch: ch.pitch * [1, .8, 1.25][c.tone] }); return; }
        if (a === "go") { var p = S.newPlayer(c.char, c.name || ch.name.split(" ")[0]); p.home = c.home; p.outfit = c.outfit; p.voiceTone = c.tone; p.skills[ch.perk] = 8; p.life = { sex: c.sex, dept: c.dept, faith: c.faith, acad: 100 }; if (c.skin) p.skin = c.skin; var g = Z.places.gate || Z.places[c.home]; p.x = g.mx; p.y = g.my + 6; /* Year 1 opens at the Main Gate with your bag (m1) */ p.guide = { s: 0, hints: {} }; if (S.isHero(p)) { if (!U.heroOpen()) return; p.outfit = D.HERO.outfit; if (!c.name) p.name = D.HERO.name; } U.inCreator = null; close(); Z.begin(p, true); return; }
        var k = a.slice(0, 1), v = a.slice(2); if (k === "c") { c.char = v; c.sex = Z.charOf(v).voice === "female" ? "f" : "m"; } else if (k === "x") c.sex = v; else if (k === "k") c.skin = v; else if (k === "d") c.dept = v; else if (k === "f") c.faith = v; else if (k === "h") c.home = v; else if (k === "o") c.outfit = +v; else if (k === "v") c.tone = +v; creator(c);
      });
  }
  U.help = function (back) {
    var k = Z.api.keyName;
    show("<h2>How to play</h2><div style='text-align:left;max-width:600px;margin:0 auto;display:grid;gap:8px'><p><b>Move</b> " + k("up") + " " + k("left") + " " + k("down") + " " + k("right") + " · <b>run</b> " + k("run") + " · <b>jump</b> " + k("jump") + " (clears open gutters) · double-tap a direction to <b>dodge</b>.</p><p><b>" + k("act") + "</b> does everything: talk, enter a place, get on or off a vehicle. On a phone, the left stick moves (push it far to sprint); drag a finger on the right side of the screen to look around. Tap the minimap to open the full map.</p><p><b>Driving</b>: up accelerates, down brakes and reverses, " + k("drift") + " is the handbrake: hold it with steering to slide the tail, let go to straighten. " + k("jump") + " hops a bicycle or skateboard (on everything else it is a second handbrake). " + k("run") + " on a bicycle stands on the pedals. " + k("horn") + " horn, " + k("radio") + " radio. Licences come with levels: bicycle and skateboard 1, scooter 2, okada 3, keke 4, car 5, sports car 8, aircraft 10.</p><p><b>Stay alive</b>: eat when FOOD is low, sit (" + k("emote3") + ") or sleep at your hostel when ENERGY is low. Run out and you only get slow and cannot sprint until you rest or eat; nobody collapses.</p><p><b>Level up</b> by attending classes (08:00 to 18:00), doing jobs, winning races, finishing the story and finding kola nuts.</p><p><b>Night</b>: when the light goes, shades come. Shine the torch (" + k("torch") + ") to freeze them and hit (" + k("attack") + "). " + k("throw") + " throws a slipper once you own one.</p><p><b>Phone</b> (" + k("phone") + "): your student pulls it out and you can keep walking. Goals, map, jobs, contacts, messages, friends, bank, dial codes, camera, radio, multiplayer, timetable and more. Arrows or a tap pick an app, Enter opens, Esc goes back. On a bike or in a car it only works hands-free when you are stopped or slow. <b>Map</b> " + k("map") + ". Wave " + k("emote1") + ", dance " + k("emote2") + ".</p><p><b>Texts and money</b>: friends text you; pick a quick reply. Low on cash? Bank → ask Mum, Dad or Uncle Sule (once a day; good attendance helps). The money comes later as a credit alert.</p><p><b>Pockets</b> (" + k("pocket") + ", or 🎒 on a phone): food, drinks, gifts and things you pick up, 15 slots to start and more as you level up. Eat, drop, gift to a friend standing next to you, or drag to move. Shops sell food for later: <b>🎒 Buy for your pockets</b>. Keys " + k("hot1") + " " + k("hot2") + " " + k("hot3") + " (or hold 🎒) eat from the first three slots.</p><p><b>Phone snatchers</b>: a phone held out in a crowd, especially at night, can be snatched. Chase and tackle the thief, report it at the Main Gate security post or through a friend, or buy a cheap replacement.</p></div><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Got it</button>" + (Z.guide && Z.mode === "play" ? "<button class='gm-btn' data-act='tut'>" + (Z.guide.active() ? "Skip the walkthrough" : "Replay the walkthrough") + "</button>" : "") + "</div>" + (Z.mode === "play" ? "" : "<p class='gm-small'>New students get a short hands-on walkthrough at the Main Gate. You can skip it, and replay it later from the phone.</p>"), function (a) { if (a === "tut" && Z.guide) { close(); if (Z.guide.active()) Z.guide.skip(); else Z.guide.start(); return; } if (back) back(); else close(); });
  };

  /* ---------- places ---------- */
  U.place = function (pl) {
    if (Z.guide) Z.guide.note("place", pl);
    var P = Z.P, h = P.time / 60, items = [], d = pl.def;
    if (pl.role === "home") { if (pl.id === P.home) items.push({ label: "Sleep until 06:30", sub: "Restores energy and health, saves the game", act: "sleep", go: true }, { label: "Sit and rest a while", sub: "One hour, +35 energy", act: "rest" }, { label: "Change clothes", sub: D.OUTFITS[P.outfit || 0].name, act: "outfit" }); else items.push({ label: "Not your hostel", sub: "Your room is at " + Z.place("@home").name, off: true }); }
    if (pl.role === "class") { var open = h >= 8 && h < (d.study ? 22 : 18); items.push({ label: (d.study ? "Study session: " : "Attend class: ") + D.SUBJECTS[d.subject], sub: open ? "Five questions, about one hour" : "Closed. Hours are 08:00 to " + (d.study ? "22:00" : "18:00"), act: "class", off: !open, go: open }); }
    if (Z.life) Z.life.placeItems(pl, items);
    if (Z.inv && Z.inv.placeItems) Z.inv.placeItems(pl, items); if (Z.phone && Z.phone.placeItems) Z.phone.placeItems(pl, items); // pockets shop rows, the stolen-phone report
    (d.menu || []).forEach(function (id) { var f = D.FOOD[id]; items.push({ label: f.name + " · " + naira(f.price), sub: (f.hunger ? "+" + f.hunger + " food  " : "") + (f.energy ? "+" + f.energy + " energy" : ""), act: "eat", id: id, off: P.money < f.price }); });
    (d.stock || []).forEach(function (id) { var it = D.ITEMS[id], own = P.inv[id] && !it.gift && id !== "airtime"; items.push({ label: it.name + " · " + naira(it.price), sub: own ? "You have one" : it.text || (it.gift ? "A gift" : ""), act: "buy", id: id, off: own || P.money < it.price }); });
    if (pl.role === "heal") items.push({ label: "See Nurse Hauwa · " + naira(500), sub: "Full health", act: "heal", off: P.money < 500 || P.hp >= P.maxHp });
    if (pl.role === "bank") items.push({ label: "Check for an alert from home", sub: P.flags.allow === P.day ? "Nothing new today" : "Once a day", act: "allow", off: P.flags.allow === P.day, go: true });
    if (pl.role === "jobs") items.push({ label: "Job board", sub: "Deliveries, taxi runs, lost property, errands", act: "jobs", go: true });
    if (pl.role === "race") items.push({ label: "Race events", sub: "8 routes × 8 machines × 3 cups", act: "race", go: true }, { label: "Buy a machine", sub: "Owned machines never charge hire", act: "garage" });
    if (pl.id === "enggarden") items.push({ label: "Read the plaques", sub: "Tesla, Faraday, Maxwell, Ohm, Ampère, and the maker of this game", act: "hall", go: true });
    if (pl.id === "radio") { if (!P.eggs.radio) Z.egg("radio", "DJ Kabiru slipped you a secret frequency: 8-Bit Buka is now on your radio."); }
    var intro = { senate: "The tallest building on campus. Malam Garba keeps the door.", sculpture: "Stone figures stand among the neem trees. They seem closer than last time.", dam: "The water is wide and still. Sit here at sunrise some time.", strip: "A windsock, a strip of cut grass and one small aircraft.", court: "Sneakers squeak. Somebody is always watching from the fence.", chapel: "The bell tower throws a long shadow.", mosque: "The minaret catches the last light.", gate: "A white arch, a row of palms, and every okada in town. The whole world passes through here.", market: "Smoke from the suya spot, music from three shops at once.", quarters: "Quiet bungalows and mango trees." }[pl.id] || d.text || "";
    if (!items.length && !intro) intro = "Nothing to do here right now.";
    menu(esc(pl.name), intro + " <small>" + naira(P.money) + " · " + S.clock(P) + "</small>", items, function (it) {
      if (it.run) return it.run();
      if (it.act === "lecture") { Z.life.lecture(pl, it.entry); }
      else if (it.act === "sleep") { close(); Z.sleep(); }
      else if (it.act === "rest") { S.advance(P, 60); P.energy = Math.min(100, P.energy + 35); close(); Z.toast("You rested for an hour."); }
      else if (it.act === "outfit") { P.outfit = ((P.outfit || 0) + 1) % D.OUTFITS.length; U.place(pl); }
      else if (it.act === "class") quiz(pl);
      else if (it.act === "eat") { Z.eat(it.id); if (P.job && P.job.kind === "errand" && P.job.stage === 0 && P.job.a.id === pl.id) { /* errand pick-up happens on arrival */ } U.place(pl); }
      else if (it.act === "buy") { Z.money(-D.ITEMS[it.id].price); P.inv[it.id] = (P.inv[it.id] || 0) + 1; Z.api.sound.sfx("coin"); Z.emit({ t: "buy", item: it.id }); U.place(pl); }
      else if (it.act === "heal") { Z.money(-500); P.hp = P.maxHp; Z.say(Z.npc("hauwa"), "Drink water. Sleep. Eat."); close(); }
      else if (it.act === "allow") { P.flags.allow = P.day; var amt = 1500 + P.lvl * 100; close(); Z.money(amt); Z.bark("money"); Z.toast("<b>Credit alert:</b> " + naira(amt) + " from home. \"Read your books.\""); }
      else if (it.act === "jobs") jobs(pl);
      else if (it.act === "race") races({ veh: "bike" });
      else if (it.act === "garage") garage(pl);
      else if (it.act === "hall") hall(pl);
    });
  };
  function hall(pl) {
    menu("The Tesla coil", "Six brass plaques stand around the coil.", D.HALL.map(function (h) { return { label: h.name, sub: h.years, h: h, go: !!h.me }; }), function (it) {
      var P = Z.P; if (!P.flags["hall_" + it.h.name]) { P.flags["hall_" + it.h.name] = 1; Z.xp(25); }
      if (it.h.me) { Z.api.confetti(140); Z.api.sound.sfx("win"); }
      show("<h2>" + esc(it.h.name) + "</h2><p class='gm-small'>" + esc(it.h.years) + "</p><p style='text-align:left'>" + esc(it.h.text) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='b'>Back to the plaques</button></div>", function () { hall(pl); });
    }, function () { U.place(pl); });
  }
  function quiz(pl) {
    if (Z.guide) Z.guide.note("quiz");
    var P = Z.P, qs = S.pickQuestions(D.QUESTIONS, rnd, 5, pl.def.subject, P.seenQ), i = 0, right = 0, spare = P.inv.calculator ? 1 : 0;
    function ask() {
      if (i >= qs.length) return end();
      var q = qs[i], order = [0, 1, 2, 3].sort(function () { return rnd() - .5; });
      show("<p class='gm-small'>" + esc(pl.name) + " · " + D.SUBJECTS[q.s] + " · question " + (i + 1) + " of " + qs.length + "</p><h2 style='font-size:clamp(18px,3.4vw,26px)'>" + esc(q.q) + "</h2><div class='gm-actions' style='flex-direction:column;align-items:stretch;max-width:520px;margin:0 auto;width:100%'>" + order.map(function (o) { return "<button class='gm-btn' data-act='" + o + "'>" + esc(q.o[o]) + "</button>"; }).join("") + "</div>",
        function (a, el) { if (el.disabled) return; var ok = +a === q.a; P.seenQ[q.id] = 1; [].forEach.call(root().querySelectorAll("button"), function (b) { b.disabled = true; if (+b.getAttribute("data-act") === q.a) b.classList.add("gm-btn--go"); });
          if (ok) { right++; Z.api.sound.sfx("coin"); } else if (spare) { spare = 0; right++; Z.api.sound.sfx("block"); Z.toast("Your calculator saved that one."); } else { Z.api.sound.sfx("lose"); el.style.background = "#7f1d1d"; }
          i++; setTimeout(ask, ok ? 550 : 1300); });
    }
    function end() {
      var ch = Z.charOf(P.char), r = S.classReward(P, right, qs.length), bonus = ch.perk === "brain" ? Math.round(r.xp * .2) : 0; if (bonus) S.addXp(P, bonus);
      S.advance(P, 60); P.energy = Math.max(1, P.energy - 6); P.hunger = Math.max(1, P.hunger - 5);
      show("<h2>" + right + " / " + qs.length + "</h2><p>" + (right === qs.length ? "Perfect. The lecturer actually smiled." : r.pass ? "Solid. You understood the class." : "Rough one. Read the notes and come again.") + "</p><p><b>+" + (r.xp + bonus) + " XP</b>" + (r.pass ? " · brain skill up" : "") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Leave class</button></div>", function () { close(); if (r.levels > 0) Z.levelUp(); Z.emit({ t: "class", score: right, place: pl.id }); Z.save(); });
    }
    ask();
  }
  function jobs(pl) {
    var P = Z.P; if (P.job) return menu("Job in progress", S.jobText(P.job), [{ label: "Cancel this job", sub: "The job vehicle goes back; finished stops are paid", act: "drop" }], function () { if (Z.jobs) Z.jobs.cancel(true); else P.job = null; jobs(pl); });
    var offers = Z.offers(pl);
    menu("Job board", "Pay grows with distance and your level. Finish fast for a 25% bonus.", offers.map(function (j) { return { label: { delivery: "Delivery", taxi: "Taxi run", lost: "Lost property", errand: "Errand" }[j.kind] + " · " + naira(j.pay), sub: (j.kind === "lost" ? "Find " + j.what + " near " + j.b.name : j.kind === "taxi" ? j.a.name + " → " + j.b.name + " (needs okada, keke or car)" : j.a.name + " → " + j.b.name) + " · +" + j.xp + " XP", j: j }; }), function (it) { close(); Z.takeJob(it.j); });
  }
  U.jobs = jobs;
  function races(o) {
    var P = Z.P, vehs = S.VEH_ORDER.filter(function (v) { return P.lvl >= S.VEH[v].lvl; }); if (vehs.indexOf(o.veh) < 0) o.veh = vehs[0];
    var won = Object.keys(P.races).length;
    show("<h2>Race events</h2><p class='gm-small'>" + won + " of 192 won. Win Bronze to open the next route and the Silver cup; win Silver for Gold. The club lends you the machine.</p><div class='gm-actions'>" + S.VEH_ORDER.map(function (v) { var ok = vehs.indexOf(v) >= 0; return "<button class='gm-btn gm-btn--sm' data-act='v:" + v + "' aria-pressed='" + (v === o.veh) + "'" + (ok ? "" : " disabled style='opacity:.4'") + ">" + S.VEH[v].name + (ok ? "" : " L" + S.VEH[v].lvl) + "</button>"; }).join("") + "</div><div style='display:grid;gap:6px;max-width:600px;margin:0 auto;width:100%'>" +
      D.ROUTES.map(function (r, ri) { return "<div style='display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap'><b style='text-align:left;flex:1 1 150px'>" + esc(r.name) + "</b>" + S.CUPS.map(function (c, ci) { var id = S.raceId(r.id, o.veh, c.id), open = S.raceOpen(P, ri, o.veh, ci, D.ROUTES), best = P.races[id]; return "<button class='gm-btn gm-btn--sm" + (open && !best ? " gm-btn--go" : "") + "' data-act='r:" + ri + ":" + ci + "'" + (open ? "" : " disabled style='opacity:.35'") + ">" + c.name + (best ? " ✓ " + best + "s" : "") + "</button>"; }).join("") + "</div>"; }).join("") + "</div><div class='gm-actions'><button class='gm-btn' data-act='back'>Close</button></div>",
      function (a) { if (a === "back") return close(); var p = a.split(":"); if (p[0] === "v") { o.veh = p[1]; races(o); } else { close(); Z.startRace(D.ROUTES[+p[1]], o.veh, S.CUPS[+p[2]].id); } });
  }
  U.races = races;
  function garage(pl) {
    var P = Z.P; menu("Buy a machine", "Once you own a type, hiring one anywhere is free.", S.VEH_ORDER.filter(function (v) { return S.VEH[v].rent; }).map(function (v) { var sp = S.VEH[v], price = sp.rent * 40, own = P.flags["own_" + v]; return { label: sp.name + " · " + (own ? "owned" : naira(price)), sub: "Top speed " + Math.round(sp.max * 3.6) + " km/h · licence level " + sp.lvl, v: v, price: price, off: own || P.money < price || P.lvl < sp.lvl }; }), function (it) { Z.money(-it.price); P.flags["own_" + it.v] = 1; Z.api.confetti(60); Z.api.sound.sfx("win"); garage(pl); }, function () { U.place(pl); });
  }

  /* ---------- people ---------- */
  U.talk = function (n) {
    var P = Z.P, st = Z.step(), d = n.def, storyLine = st && st.t === "talk" && st.npc === n.id && st.say;
    n.a = Math.atan2(Z.me.y - n.y, Z.me.x - n.x); if (!P.friends[n.id]) S.bond(P, n.id, 1);
    if (storyLine) { Z.sub(st.say[0], st.say[1]); Z.api.sound.say(st.say[1], { voice: d.voice, pitch: d.pitch, vi: n.k }); Z.emit({ t: "talk", npc: n.id }); return; }
    Z.emit({ t: "talk", npc: n.id });
    var hi = d.hi[Math.floor(rnd() * d.hi.length)], aff = S.affinity(P, n.id), gifts = Object.keys(P.inv).filter(function (k) { return P.inv[k] > 0 && (Z.inv ? Z.inv.droppable(k) && /^(gift|food|drink)$/.test(Z.inv.def(k).kind) : D.ITEMS[k] && D.ITEMS[k].gift); }), items = [];
    Z.api.sound.say(hi, { voice: d.voice, pitch: d.pitch, vi: n.k });
    items.push({ label: "Chat", sub: P.flags["c_" + n.id] === P.day ? "You already had a good talk today" : "Once a day: friendship grows", act: "chat", off: P.flags["c_" + n.id] === P.day, go: true });
    if (gifts.length) items.push({ label: "Give a gift", sub: gifts.map(function (g) { return Z.inv ? Z.inv.def(g).name : D.ITEMS[g].name; }).join(", "), act: "gift" });
    if (n.id !== "sly" || P.flags.slyAlly) items.push({ label: n.follow ? "Go your way" : "Walk with me", sub: aff >= 20 ? "Walk, ride, eat and dance together" : "Needs Friend (20). You are at " + Math.round(aff), act: "hang", off: aff < 20 && !n.follow });
    if (Z.friends) Z.friends.items(n, items);
    if (Z.phone && Z.phone.talkItems) Z.phone.talkItems(n, items);
    if (d.date) { items.push({ label: "Ask on a date", sub: aff >= 50 ? "Pick a spot and take them there" : "Needs Close friend (50)", act: "date", off: aff < 50 }); if (P.partner !== n.id) items.push({ label: "Ask to be official", sub: aff >= 80 ? "Deep breath" : "Needs Bestie (80)", act: "ask", off: aff < 80 }); }
    menu("<canvas width='144' height='144' data-sface='" + n.id + "' style='width:72px;height:72px;vertical-align:middle'></canvas> " + esc(d.name), "<i>“" + esc(hi) + "”</i><br><small>" + esc(d.role) + " · " + S.friendTier(aff) + " (" + Math.round(aff) + "/100)" + (P.partner === n.id ? " · your " + (d.voice === "female" ? "girlfriend" : "boyfriend") : "") + "</small>", items, function (it) {
      if (it.run) return it.run();
      if (it.act === "chat") { P.flags["c_" + n.id] = P.day; S.bond(P, n.id, 4); Z.xp(5); U.talk(n); }
      else if (it.act === "gift" && Z.inv) menu("Give what?", "From your pockets.", gifts.map(function (g) { return { label: Z.inv.def(g).name + (P.inv[g] > 1 ? " × " + P.inv[g] : ""), sub: Z.inv.effect(g), g: g }; }), function (g) { close(); Z.inv.give(n, g.g); }, function () { U.talk(n); });
      else if (it.act === "gift") menu("Give what?", "", gifts.map(function (g) { return { label: D.ITEMS[g].name, g: g }; }), function (g) { P.inv[g.g]--; var liked = d.likes && d.likes.gift === g.g; S.bond(P, n.id, liked ? 15 : 7); close(); Z.say(n, liked ? "How did you know?! I love it!" : "For me? Thank you."); Z.api.sound.sfx("power"); }, function () { U.talk(n); });
      else if (it.act === "hang") { close(); if (n.follow) { if (Z.friends) Z.friends.release(n, "Later!"); else { n.follow = false; Z.say(n, "Later!"); } } else Z.hangout(n); }
      else if (it.act === "f_lead") { if (n.lead) { close(); Z.friends.release(n, "Okay. You know the way now."); } else menu("Lead me where?", esc(d.name) + " will walk ahead and show you.", Z.friends.places(), function (p) { close(); Z.friends.lead(n, p.id); }, function () { U.talk(n); }); }
      else if (it.act === "date") menu("Where to?", esc(d.name) + " is waiting for your idea.", D.DATE_SPOTS.map(function (s) { return { label: Z.place(s).name, s: s }; }), function (s) { close(); Z.date = { npc: n, spot: s.s }; Z.hangout(n, true); }, function () { U.talk(n); });
      else if (it.act === "ask") { close(); P.partner = n.id; Z.api.confetti(160); Z.api.sound.sfx("win"); Z.api.banner("IT'S OFFICIAL", { col: "#f9a8d4", edge: "#831843", size: 80, sub: "You and " + d.name, dur: 3 }); Z.say(n, "Yes. Yes! I thought you would never ask."); Z.save(); }
    });
  };
  U.dateScene = function () {
    var P = Z.P, dt = Z.date, n = dt.npc, d = n.def, gifts = Object.keys(P.inv).filter(function (k) { return P.inv[k] > 0 && D.ITEMS[k] && D.ITEMS[k].gift; }), pickGift = "";
    function talk() { menu("What do you talk about?", "You and " + esc(d.name) + " at " + esc(Z.place(dt.spot).name) + ".", Object.keys(D.TALK).map(function (k) { return { label: D.TALK[k], k: k }; }), function (t) {
      if (pickGift) P.inv[pickGift]--; var sc = S.dateScore(d, dt.spot, pickGift, t.k), gain = sc * 4; S.bond(P, n.id, gain); P.stats.dates++; S.advance(P, 90); Z.date = null; n.follow = false;
      show("<h2>" + (sc >= 5 ? "A perfect evening" : sc >= 3 ? "A good date" : sc >= 1 ? "It was... fine" : "Awkward") + "</h2><p>" + esc(d.name) + (sc >= 5 ? " laughed the whole time and walked back slowly." : sc >= 3 ? " had a nice time." : sc >= 1 ? " kept checking the time." : " remembered an assignment and left early.") + "</p><p><b>" + (gain >= 0 ? "+" : "") + gain + " friendship</b> · now " + Math.round(S.affinity(P, n.id)) + "/100</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Walk home</button></div>", function () { close(); Z.xp(20 + sc * 10); Z.save(); }); }); }
    if (!gifts.length) return talk();
    menu("Bring a gift?", "", gifts.map(function (g) { return { label: D.ITEMS[g].name, g: g }; }).concat([{ label: "No gift", g: "" }]), function (g) { pickGift = g.g; talk(); });
  };

  /* ---------- phone ---------- */
  // The phone key pulls the handset out of your pocket (samaru-phone.js: every app lives there now). The plain
  // menu below is only the fallback for a build without samaru-phone.js.
  U.phone = function () { if (Z.guide) Z.guide.note("phone"); if (Z.phone && Z.phone.toggle) return Z.phone.toggle(); return U.phoneMenu(); };
  U.phoneMenu = function () {
    var P = Z.P, sp = S.storyProgress(P, D.MISSIONS);
    menu("Phone", "Day " + P.day + " · " + S.clock(P) + " · " + naira(P.money) + " · level " + P.lvl + " " + S.title(P.lvl), [
      { label: "Goals", sub: "Story " + sp.done + "/" + sp.total + " · kola nuts " + P.stats.tokens + "/" + S.TOKEN_COUNT, act: "goals", go: true }, { label: "Contacts", sub: Object.keys(P.friends).length + " people", act: "contacts" }, { label: "Timetable", sub: (function () { var n = Z.life && Z.life.next(); return n ? "Next: " + n.label + " · " + n.placeName : "Lectures, breaks and your evening"; })(), act: "life" },
      { label: "Jobs", sub: P.job ? S.jobText(P.job) : "Find paid work from anywhere", act: "jobs" },
      ].concat(Z.city && Z.city.active() ? [{ label: "Report to security", sub: "Trouble nearby: they come faster and know where to look", act: "report" }] : []).concat([{ label: "Radio", sub: "Plays while you ride or drive", act: "radio" },
      { label: "Multiplayer", sub: Z.net.on ? "Room " + Z.net.code + " · " + (Object.keys(Z.net.peers).length + 1) + " of 6" : "Up to 6 friends on the same Wi-Fi", act: "net" },
      { label: "Games", sub: "Table Smash, Kola Stack, Fresher Run, Harmattan Patrol, Ayo", act: "mini" }, { label: "Dial a code", sub: "Service codes", act: "dial" }, { label: "Me", sub: "Stats, clothes, voice", act: "me" }, { label: "How to play", sub: Z.guide && Z.guide.active() ? "Controls, or skip the walkthrough" : "Controls, and replay the walkthrough", act: "help" }, { label: "Save and go to the title screen", act: "quit" }]),
      function (it) { ({ mini: function () { Z.api.hide(); if (Z.mini) Z.mini.open(null, { free: true, frame: "tv" }); }, life: function () { Z.life.menu(U.phone); }, goals: goals, contacts: contacts, jobs: function () { jobs(null); }, report: function () { close(); if (Z.city) Z.city.report(); }, radio: radioMenu, net: netMenu, dial: dial, me: meMenu, help: function () { U.help(U.phone); }, quit: function () { Z.save(); Z.netLeave(); U.title(); } })[it.act](); });
  };
  function goals() {
    if (Z.guide) Z.guide.note("goals");
    var P = Z.P, m = Z.mission(), st = Z.step(), next = D.MISSIONS.filter(function (q) { return !q.side && !P.m.done[q.id]; })[0];
    show("<h2>Goals</h2><div style='text-align:left;max-width:600px;margin:0 auto;display:grid;gap:8px'>" + (m ? "<p><b>Chapter " + m.ch + ": " + esc(m.title) + "</b><br>" + esc(st.text) + "</p>" : next ? "<p><b>Next: " + esc(next.title) + "</b><br>" + (next.need && next.need.lvl > P.lvl ? "Opens at level " + next.need.lvl + ". You are level " + P.lvl + "." : "Starting soon.") + "</p>" : "<p><b>The story is complete.</b> The long goals below are all that is left. Good luck.</p>") +
      Z.goalList().map(function (g) { return "<p style='margin:0'><b>" + esc(g.m.title) + "</b> <small>" + esc(g.m.steps[0].text) + "</small><br><progress max='" + g.need + "' value='" + g.have + "' style='width:100%'></progress> <small>" + g.have + " / " + g.need + " · " + naira(g.m.reward.cash) + "</small></p>"; }).join("") + "</div><div class='gm-actions'><button class='gm-btn' data-act='b'>Back</button></div>", U.phone);
  }
  function contacts() {
    var P = Z.P, ids = Object.keys(P.friends).filter(function (id) { return Z.npc(id); }).sort(function (a, b) { return P.friends[b] - P.friends[a]; });
    menu("Contacts", ids.length ? "Calling costs ₦50 of airtime. Friends (20+) will come and find you." : "Talk to people around campus to get their numbers.", ids.map(function (id) { var n = Z.npc(id), a = P.friends[id]; return { label: n.def.name + (P.partner === id ? " ♥" : ""), sub: n.def.role + " · " + S.friendTier(a) + " " + Math.round(a) + "/100" + (a < 20 ? " · not close enough to call out" : ""), n: n, off: a < 20 || P.money < 50 || n.follow || (id === "sly" && !P.flags.slyAlly) }; }), function (it) { Z.money(-50); close(); Z.api.sound.sfx("click"); Z.hangout(it.n); }, U.phone);
  }
  function radioMenu() { var P = Z.P; menu("Radio", "Every bicycle, scooter, okada, keke and car has one. Press " + Z.api.keyName("radio") + " while riding to change station.", D.RADIO.filter(function (r) { return !r.secret || P.eggs.radio; }).map(function (r) { return { label: r.name, sub: r.style, r: r }; }), function (it) { Z.api.music(Arcade.song(it.r.seed, it.r.style, it.r.o)); }, U.phone); }
  function dial() {
    if (S.isHero(Z.P)) return U.cheats(); // the Maker gets every cheat as a button
    show("<h2>Dial</h2><p>Type a service code, then Call.</p><input type='text' data-dial inputmode='tel' maxlength='24' placeholder='Service code' style='font-size:26px;text-align:center;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;width:min(320px,100%);margin:0 auto'><div class='gm-actions' style='max-width:300px;margin:0 auto'>" + ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(function (k) { return "<button class='gm-btn' style='flex:1 0 28%' data-act='k" + k + "'>" + k + "</button>"; }).join("") + "</div><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='call'>Call</button><button class='gm-btn' data-act='clr'>Clear</button><button class='gm-btn' data-act='back'>Back</button></div>",
      function (a) { var inp = root().querySelector("[data-dial]"); if (a === "back") return U.phone(); if (a === "clr") { inp.value = ""; return; } if (a[0] === "k") { inp.value += a.slice(1); return; }
        var c = S.cheatMatch(Z.cheatTable(), inp.value, "dial"); if (!c) { Z.api.sound.sfx("block"); inp.value = ""; inp.placeholder = "Invalid MMI code"; return; } close(); Z.cheat(c); });
  }
  function meMenu() {
    var P = Z.P, s = P.stats, ch = Z.charOf(P.char);
    show("<h2><canvas width='144' height='144' data-sface='" + ch.id + "' style='width:72px;height:72px;vertical-align:middle'></canvas> " + esc(P.name) + "</h2><p>Level " + P.lvl + " " + S.title(P.lvl) + " · " + P.xp.toLocaleString() + " XP · next level at " + S.xpForLevel(P.lvl + 1).toLocaleString() + "</p><p class='gm-small'>Day " + P.day + " · " + s.km.toFixed(1) + " km travelled · " + s.classes + " classes · " + s.jobs + " jobs · " + s.races + " race events won · " + s.shades + " shades · " + s.dates + " dates · " + s.tokens + " kola nuts · " + Object.keys(P.eggs).length + "/8 easter eggs · fainted " + s.faints + " times" + (P.partner ? " · with " + esc(Z.npc(P.partner).def.name) : "") + (P.cheated ? " · <b>codes used: off the leaderboard</b>" : "") + "</p><div class='gm-actions'><button class='gm-btn' data-act='outfit'>Clothes: " + D.OUTFITS[P.outfit || 0].name + "</button><button class='gm-btn' data-act='tone'>Voice: " + ["Natural", "Deep", "Bright"][P.voiceTone || 0] + "</button><button class='gm-btn' data-act='vi'>Speaker " + ((P.voiceI || 0) + 1) + "</button><button class='gm-btn' data-act='hear'>Hear it</button>" + (Z.r3 && Z.r3.ready ? "<button class='gm-btn' data-act='gfx'>Graphics: " + (Z.r3.tierName ? Z.r3.tierName() : Z.r3.quality === "high" ? "High" : "Fast") + "</button>" : "") + (Z.touch ? "<button class='gm-btn' data-act='look'>Look stick: " + Z.touch.sensName() + "</button>" : "") + (Z.guide ? "<button class='gm-btn' data-act='tut'>" + (Z.guide.active() ? "Skip the walkthrough" : "Replay the walkthrough") + "</button>" : "") + "<button class='gm-btn' data-act='back'>Back</button></div>",
      function (a) { if (a === "back") return U.phone(); if (a === "tut") { close(); if (Z.guide.active()) Z.guide.skip(); else Z.guide.start(); return; } if (a === "look") { Z.touch.cycleSens(); return meMenu(); } if (a === "gfx") { if (Z.r3.cycle) Z.r3.cycle(); else Z.r3.setQuality(Z.r3.quality === "high" ? "low" : "high"); return meMenu(); } if (a === "outfit") P.outfit = ((P.outfit || 0) + 1) % D.OUTFITS.length; else if (a === "tone") P.voiceTone = ((P.voiceTone || 0) + 1) % 3; else if (a === "vi") P.voiceI = ((P.voiceI || 0) + 1) % 6; else if (a === "hear") { Z.bark("wave"); return; } meMenu(); });
  }
  function netMenu() {
    var N = Z.net, P = Z.P, peers = Object.keys(N.peers);
    if (!N.on) return show("<h2>Multiplayer</h2><p>Up to six players share one campus. Everyone opens this game on the same Wi-Fi (the same EE Hub address) and types the same room code.</p>" + (N.err ? "<p style='color:#fca5a5'>" + esc(N.err) + "</p>" : "") + "<input type='text' data-room maxlength='8' placeholder='ROOM CODE' value='" + esc(N.code) + "' style='font-size:24px;text-align:center;text-transform:uppercase;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;width:min(320px,100%);margin:0 auto'><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='join'>Join or create</button><button class='gm-btn' data-act='back'>Back</button></div><p class='gm-small'>You see each other walk, ride, wave and dance; you can chat with quick phrases, race together and spar (press " + Z.api.keyName("emote4") + "). Shades, jobs and story stay your own.</p>",
      function (a) { if (a === "back") return U.phone(); var v = root().querySelector("[data-room]").value; if (Z.netJoin(v)) { close(); Z.toast("Joining room <b>" + esc(Z.net.code) + "</b>…"); } else { N.err = "Use at least 3 letters or numbers."; netMenu(); } });
    var inv = N.invite && N.invite.at > Date.now() + N.offset ? N.invite : null;
    show("<h2>Room " + esc(N.code) + "</h2><p>" + (peers.length ? "With you: " + peers.map(function (id) { return "<b>" + esc(N.peers[id].name) + "</b> (L" + (N.peers[id].lvl || 1) + ")"; }).join(", ") : "Nobody else yet. Share the code.") + "</p><div class='gm-actions'>" + Z.CHAT.map(function (c, i) { return "<button class='gm-btn gm-btn--sm' data-act='c" + i + "'>" + esc(c) + "</button>"; }).join("") + "</div><div class='gm-actions'>" + (inv ? "<button class='gm-btn gm-btn--go' data-act='joinrace'>Join the race</button>" : "") + "<button class='gm-btn' data-act='race'>Start a group race (bicycles, Theatre Loop)</button><button class='gm-btn gm-btn--go' data-act='coop'>Friends missions</button><button class='gm-btn' data-act='leave'>Leave room</button><button class='gm-btn' data-act='back'>Back</button></div>",
      function (a) { if (a === "back") return U.phone(); if (a === "leave") { Z.netLeave(); return netMenu(); }
        if (a[0] === "c") { var i = +a.slice(1); N.out.push({ k: "chat", p: i }); close(); Z.say("me", Z.CHAT[i]); return; }
        if (a === "coop") { if (window.FSLGCoop) return FSLGCoop.menu(netMenu); return; }
        if (a === "race") { var at = Date.now() + N.offset + 8000; N.out.push({ k: "race", r: 0, at: at }); close(); Z.startRace(D.ROUTES[0], "bike", "bronze", at); return; }
        if (a === "joinrace") { close(); Z.startRace(D.ROUTES[inv.r || 0], "bike", "bronze", inv.at); N.invite = null; } });
    void P;
  }
  /* ---------- the secret student, the quick cheat menu and the mission picker ---------- */
  var heroSeen = false, heroBuf = "", heroArmed = false;
  U.heroOpen = function () { return !!Z.api.store("fslg-hero"); };          // unlocked with the code on this device
  U.heroSeen = function () { return heroSeen || U.heroOpen(); };            // revealed on the character screen
  function heroHashes() { var h = (Z.api.config && Z.api.config.hero) || {}, ok = function (v) { return /^[0-9a-f]{64}$/.test(v || ""); }; return { combo: ok(h.combo) ? h.combo : S.HERO_DEFAULT.combo, swipe: ok(h.swipe) ? h.swipe : S.HERO_DEFAULT.swipe }; }
  U.heroReveal = function () { if (U.heroSeen() || !U.inCreator) return; heroSeen = true; Z.api.sound.sfx("special"); Z.api.flash("#fde047", .4); if (Z.api.confetti) Z.api.confetti(80); creator(U.inCreator); };
  U.heroToken = function (tok) { // one key or swipe on the character screen: u d l r or a letter
    if (!U.inCreator || U.heroSeen()) return false; heroBuf = (heroBuf + tok).slice(-12); var h = heroHashes();
    if (S.seqMatch(heroBuf, h.combo) || S.seqMatch(heroBuf, h.swipe)) { heroBuf = ""; U.heroReveal(); return true; } return false;
  };
  U.heroVerify = function (code) { var hv = Z.api.hero && Z.api.hero.verify; try { if (hv) return Promise.resolve(hv.call(Z.api.hero, code)).then(function (ok) { return !!ok; }, function () { return false; }); } catch (e) { return Promise.resolve(false); } void code; return Promise.resolve(false); }; // only the server can say yes: no code is stored in the page
  U.heroAsk = function (c, back) {
    show("<h2><canvas width='144' height='144' data-sface='" + D.HERO.id + "' style='width:72px;height:72px;vertical-align:middle'></canvas> " + esc(D.HERO.name) + "</h2><p>" + esc(D.HERO.full) + ". " + esc(D.HERO.blurb) + "</p><p>This student is locked. Enter the secret code.</p><input type='password' data-hero maxlength='40' autocomplete='off' style='font-size:22px;text-align:center;padding:12px;border-radius:12px;border:1px solid rgba(253,224,71,.6);background:rgba(255,255,255,.08);color:#fff;width:min(320px,100%);margin:0 auto'><p class='gm-small' data-hero-msg></p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Unlock</button><button class='gm-btn' data-act='back'>Back</button></div>",
      function (a) { if (a === "back") return back(c); var inp = root().querySelector("[data-hero]"), msg = root().querySelector("[data-hero-msg]"), code = inp ? inp.value : "";
        return U.heroVerify(code).then(function (ok) { if (ok) { Z.api.store("fslg-hero", 1); Z.api.sound.sfx("win"); c.char = D.HERO.id; c.outfit = D.HERO.outfit; back(c); } else { Z.api.sound.sfx("block"); if (inp) inp.value = ""; if (msg) msg.textContent = "Wrong code."; } }); });
  };
  U.heroArm = function () { // listen for the reveal: a key combo on PC, a swipe pattern on phones. Only the character screen reacts.
    if (heroArmed || !document.addEventListener) return; heroArmed = true; var sx = 0, sy = 0, sid = null, ARROW = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r" };
    document.addEventListener("keydown", function (e) { if (!U.inCreator || Z.mode === "play" || (e.target && e.target.closest && e.target.closest("input, textarea"))) return; var t = ARROW[e.code] || (e.key && e.key.length === 1 && /[a-z0-9]/i.test(e.key) ? e.key.toLowerCase() : ""); if (t && U.heroToken(t) && e.preventDefault) e.preventDefault(); });
    document.addEventListener("pointerdown", function (e) { if (!U.inCreator || e.pointerType === "mouse") return; sid = e.pointerId; sx = e.clientX; sy = e.clientY; });
    document.addEventListener("pointerup", function (e) { if (e.pointerId !== sid) return; sid = null; var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 48) return; U.heroToken(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u")); });
    try { var hc = Z.api.config && Z.api.config.hero; if (Z.api.secret && hc && hc.combo) Z.api.secret({ combo: hc.combo, swipe: hc.swipe, onReveal: function () { U.heroReveal(); } }); } catch (err) {}
  };
  U.cheats = function () { // every cheat as a button: the secret student's quick menu
    if (!S.isHero(Z.P)) return; menu("Maker's menu", "Skip a mission step with <b>\\</b>, open this menu with <b>]</b>.", S.CHEATS.map(function (q) { return { label: q.label, sub: q.text, c: q }; }), function (it) { close(); Z.cheat(it.c); }, null);
  };
  U.missions = function () { // jump to any story mission; everything before it is marked done
    var P = Z.P, main = D.MISSIONS.filter(function (m) { return !m.side; });
    menu("Pick a mission", "Earlier missions are marked as done. Their rewards are not paid.", main.map(function (m, i) { return { label: (i + 1) + ". " + m.title, sub: "Chapter " + m.ch + (P.m.done[m.id] ? " · done" : P.m.active === m.id ? " · current" : ""), m: m, i: i }; }), function (it) {
      P.cheated = true; main.forEach(function (m, i) { if (i < it.i) P.m.done[m.id] = 1; else delete P.m.done[m.id]; }); var need = it.m.need && it.m.need.lvl; if (need && P.lvl < need) { P.xp = S.xpForLevel(need); S.addXp(P, 0); }
      Z.foes = Z.foes.filter(function (f) { return !f.quest; }); Z.quest = null; P.m.active = ""; S.startMission(P, it.m); close(); Z.stepStart(); Z.api.banner(it.m.title.toUpperCase(), { col: "#7ef0ff", edge: "#0b4a5c", size: Math.min(84, 1200 / it.m.title.length), sub: "Chapter " + it.m.ch, dur: 3 }); Z.save(); }, null);
  };
})();
