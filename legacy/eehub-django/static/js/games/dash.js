/* Induction Dash: magnet-cart runner (PHYS 122: electromagnetic induction, Faraday's and Lenz's laws; ENGG 205 e = Blv).
 * Each coil you pass through harvests E = N B²L²vd/R joules and brakes the cart by Δv = N B²L²d/(mR). Physics and tracks: inductionsim.js
 * 30 tracks in six zones, five carts with real B and m, ghost races against your best run, medals, and an endless mode. */
(function () {
  "use strict";
  var A = window.Arcade, I = window.InductionSim, PX = 40, LANES = [300, 385, 470], S = {}, API = null;
  var save = Object.assign({ best: {}, cleared: 0, tut: false, who: A.store("kick-p1") || "faraday", medals: {}, ghosts: {}, endless: [], carts: ["basic"], cart: "basic", opt: {} }, A.store("dash") || {});
  /* save migration: version 1 had three stages keyed by name and no medals, ghosts, carts or endless board */
  if (!save.medals || typeof save.medals !== "object") save.medals = {}; if (!save.ghosts || typeof save.ghosts !== "object") save.ghosts = {};
  if (!Array.isArray(save.endless)) save.endless = []; if (!Array.isArray(save.carts) || !save.carts.length) save.carts = ["basic"]; if (!save.cart) save.cart = "basic"; if (!save.opt) save.opt = {};
  save.cleared = Math.max(0, Math.min(I.TRACKS.length, save.cleared | 0));
  function persist() { A.store("dash", save); }
  function opt(k, d) { var v = API && API.settings && API.settings.get ? API.settings.get("dash_" + k) : undefined; if (v !== undefined && v !== null) return v; return save.opt[k] === undefined ? d : save.opt[k]; }
  function medalCount() { var n = 0; for (var k in save.medals) n += save.medals[k] | 0; return n; }
  function cartOf(id) { return I.CARTS.filter(function (c) { return c.id === id; })[0] || I.CARTS[0]; }
  function cartOpen(c) { return save.carts.indexOf(c.id) >= 0 || medalCount() >= c.need || !!(API && API.hero && API.hero.active); }
  function refreshCarts() { I.CARTS.forEach(function (c) { if (medalCount() >= c.need && save.carts.indexOf(c.id) < 0) { save.carts.push(c.id); if (API) { API.banner("NEW CART", { sub: c.name, size: 64, y: 140, col: "#ffd86b" }); API.sound.sfx("goal"); } } }); }

  /* ---------- Starting a run ---------- */
  function baseRun(cart) {
    var c = cartOf(cart);
    return { cart: c, dist: 0, v: c.cruise, cruise: c.cruise, lane: 1, ly: LANES[1], z: 0, vz: 0, hearts: c.hearts, maxHearts: c.hearts, energy: 0, meter: 0, meterT: 0, hurt: 0, pops: [], over: false, win: false, run: true,
      coils: 0, hits: 0, time: 0, shield: 0, magnet: 0, combo: 0, comboT: 0, rec: [], recT: 0, ghost: null, tutT: 0 };
  }
  function start(k, cart) {
    var st = I.TRACKS[k], z = I.ZONES[st.zone];
    if (cart) { save.cart = cart; persist(); }
    S = Object.assign(baseRun(save.cart), { mode: "track", k: k, st: st, items: I.track(st) });
    S.cruise = Math.max(S.cart.cruise, st.cruise + (S.cart.cruise - I.CRUISE)); S.v = S.cruise;
    S.tutT = !save.tut && k === 0 && opt("tips", true) ? 9 : 0;
    var g = save.ghosts[st.id]; S.ghost = g && g.c === S.cart.id && opt("ghost", true) ? g.d : (g && opt("ghost", true) ? g.d : null);
    API.useActions(["up", "down", "jump"]); API.music(A.song(400 + k * 7, z.song));
    API.show("<h2>" + A.esc(z.name) + " " + (st.idx + 1) + ": " + A.esc(st.name) + "</h2>" + (st.fresh ? "<p class='gm-card-note'><b>New here:</b> " + A.esc(st.fresh) + ".</p>" : "") +
      "<p>Harvest at least <b>" + st.target.toLocaleString() + " J</b> before the " + st.len + " m beacon. Medals: bronze " + st.medals[0].toLocaleString() + ", silver " + st.medals[1].toLocaleString() + ", gold " + st.medals[2].toLocaleString() + " J." + (S.ghost ? " Your best run rides with you as a ghost." : "") + "</p>" +
      "<p class='gm-formula'>ε = NBLv &nbsp; E = NB²L²vd / R &nbsp; Δv = NB²L²d / (mR)</p><p style='font-size:13px;opacity:.8'>" + A.esc(S.cart.name) + ": " + A.esc(S.cart.text) + " Every coil brakes you (Lenz's law); your motor pulls you back to " + S.cruise.toFixed(1) + " m/s.</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Go!</button><button class='gm-btn' data-act='map'>Tracks</button></div>",
      function (a) { if (a === "map") return menu(API); API.hide(); API.banner(z.name.toUpperCase(), { size: 80, sub: st.name, dur: 1.4 }); API.sound.say(st.name); });
  }
  function startEndless(cart) {
    if (cart) { save.cart = cart; persist(); }
    var seed = 1 + Math.floor(Math.random() * 99991);
    S = Object.assign(baseRun(save.cart), { mode: "endless", k: -1, seed: seed, chunk: 0, items: [], st: { id: "endless", name: "Endless line", len: 1e9, target: 0, sky: I.ZONES[0].sky, ground: I.ZONES[0].ground, zone: 0 } });
    S.cruise = I.endlessCruise(0) + (S.cart.cruise - I.CRUISE); S.v = S.cruise; feedEndless();
    API.useActions(["up", "down", "jump"]); API.music(A.song(471, "breaks", { bpm: 140 }));
    API.show("<h2>Endless line</h2><p>The rail never ends. Every 100 m the motor's cruising speed rises by " + I.ENDLESS.cruiseStep + " m/s, and the zones change as you go: drones, plates, double coils, lightning. How far can you get?</p>" +
      "<p class='gm-small'>Score = metres + joules ÷ 20. " + (save.endless[0] ? "Best on this device: " + save.endless[0].score.toLocaleString() + " (" + save.endless[0].dist + " m)." : "") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Go!</button><button class='gm-btn' data-act='map'>Tracks</button></div>",
      function (a) { if (a === "map") return menu(API); API.hide(); API.banner("ENDLESS", { size: 90, dur: 1.2 }); });
  }
  function feedEndless() { while (S.chunk * I.ENDLESS.chunk < S.dist + 260) { S.items = S.items.concat(I.endlessChunk(S.chunk, S.seed)); S.chunk++; } S.items = S.items.filter(function (o) { return o.x > S.dist - 20; }); var z = I.ZONES[Math.min(5, Math.floor(S.chunk / 6))]; S.st.sky = z.sky; S.st.ground = z.ground; S.st.zone = I.ZONES.indexOf(z); }
  function pop(t, col) { if (S.pops.length > 6) S.pops.shift(); S.pops.push({ t: t, col: col || "#fff", life: 1.4, y: 0 }); }

  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["986675d7c50ad2f73caad4cfe1a6a72167716adc7012e2f485d31d476aba97d5","658a051874e5954a880ac24515bf25c5ae5df96f146fc3e17612a97bb1336c57"],"god":["96470a83b34ca8b3149d68c5224f56f66dc78456c2c302e43fb5f12c0d0435f8","516b773ff6cb9149a2b713be443c0375ab154aa5754f0ad379165d4a1c96af2a"],"hearts":["e96f8174544ded5b73bde41ae12801f1e5776df1f2fc21a329f88c647cdbdd47","67970c88f6cd8f97a2ab76e649642442f32e9120f498f64dfa22b785d21a0076"],"boost":["009bf9364da2c3c6be435884572b7ee9f373883b448757727a106aecb64d3bc4","9b3bad126832139f140dd0853ab277faee0d9dfc1b10d4cf87a37c2cbd1b820f"],"energy":["0b9c41fae37e502d378113cf8047bc485008a8e8ceb8a05d77277286ced4f164","b1cf3c46cfe5646633240c1144c22f2b7864d6fa9ba41b96c7d45c0441483411"],"unlock":["fdd6d572c12a5f38be805ca38b96f6ebfae0b22267a70868b1b7b91764b7dc79","53273986a560636940737e5dcb2fe45220be1ef27479a0a7c998fb70dc147c23"],"slow":["003b3020602279b387e0c9e329c269f379800756ccb4cdef4b3f77928568bf78","4cb43c90e37babb3c91fe6e1815e0cf06c63b1b1102fdf2193160ddb4299f7d4"],"party":["ca5c0a9c5f09b2305925817522e0451bfbe6560c687ce271cf76534ac5be629d","97da96b91bce65271266c28e5809916f0df328910d98235747111a168383f088"],"_combo":"57961ae2d23e3e3b330eb0e84a8a8d4c30f1492b5dccb0d31fcee3cede2b2689","_swipe":"09bfd1405ce8eb8c7c33d186ceaf7e7385a85b17a2016c64333c4444cb46b85b"}/*]CH*/, CT = {};
  function heroOn() { return !!(API && API.hero.active && save.who === "mib"); }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Finish this run", h: CH.skip, run: function () { if (S.run && !S.over && S.mode === "track") { S.energy = Math.max(S.energy, S.st.medals[2]); finish(true, "Skipped to the finish."); } } },
      god: { label: "Hits cost no hearts", h: CH.god, run: function () { CT.god = 1; } },
      hearts: { label: "Hearts refilled", h: CH.hearts, run: function () { S.hearts = S.maxHearts || 3; } },
      boost: { label: "Top speed now", h: CH.boost, run: function () { S.v = (S.cruise || 14) + 8; } },
      energy: { label: "Target energy banked", h: CH.energy, run: function () { if (S.st) S.energy = Math.max(S.energy, S.st.target); } },
      unlock: { label: "Every track and cart open", h: CH.unlock, run: function () { save.cleared = I.TRACKS.length; I.CARTS.forEach(function (c) { if (save.carts.indexOf(c.id) < 0) save.carts.push(c.id); }); persist(); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { menu(api); } });
  }

  /* ---------- Endings ---------- */
  function finish(win, why) {
    if (S.over) return; S.over = true; S.run = false; S.win = win; var api = API;
    if (S.mode === "endless") return endlessOver(why);
    var st = S.st, k = S.k, E = Math.round(S.energy), prev = save.best[st.id] || 0, rec = win && E > prev && prev > 0, medal = win ? (E >= st.medals[2] ? 3 : E >= st.medals[1] ? 2 : 1) : 0;
    var hero = A.styled(A.byId[save.who] || A.cast[0]), zoneEnd = st.idx === 4, last = k === I.TRACKS.length - 1, before = medalCount();
    if (win) {
      save.cleared = Math.max(save.cleared, k + 1); save.tut = true;
      if (E > prev) { save.best[st.id] = E; save.ghosts[st.id] = { c: S.cart.id, d: S.rec.slice(0, 3000) }; }
      save.medals[st.id] = Math.max(save.medals[st.id] || 0, medal); refreshCarts(); persist();
    }
    A.report("induction-dash", { result: win ? "win" : "lose", stage: k + 1, score: Math.round(E / 10) + (win ? 200 : 0) + S.hearts * 50 });
    var next = win && k + 1 < I.TRACKS.length, pct = Math.round(100 * Math.min(1, E / st.target)), names = ["", "Bronze", "Silver", "Gold"];
    var kind = win ? (last ? "gameComplete" : rec ? "newRecord" : zoneEnd ? "champion" : "stageClear") : "lose";
    api.ceremony(kind, { title: win ? (last ? "ALL BEACONS LIT!" : rec ? "NEW RECORD!" : zoneEnd ? I.ZONES[st.zone].name.toUpperCase() + " LIT!" : names[medal].toUpperCase() + " MEDAL") : "RUN OVER", sub: st.name, hero: hero,
      trophy: win ? (last || zoneEnd ? "crown" : medal === 3 ? "star" : "medal") : "none", score: E, scoreLabel: "Joules harvested", stars: win ? medal : null,
      stats: [["Coils", S.coils], ["Target", st.target.toLocaleString() + " J"], ["Hearts left", S.hearts], ["Cart", S.cart.name]],
      line: win ? (medal === 3 ? "Gold: every lane choice paid off." : medal === 2 ? "Silver. Gold needs " + (st.medals[2] - E).toLocaleString() + " J more." : "Beacon lit. Silver needs " + (st.medals[1] - E).toLocaleString() + " J more.") : "You reached " + pct + "% of the target before the run ended.",
      tip: "Energy per coil grows with speed (ε = BLv), so hit a boost arrow before a cluster of coils. A heavier cart loses less speed per coil.",
      then: function () {
        var gained = medalCount() - before;
        api.show("<h2>" + (win ? (last ? "Every beacon on Entropy's Rail is lit!" : "Beacon powered!") : "Run over") + "</h2><p>" + A.esc(why) + "</p><p>You harvested <b>" + E.toLocaleString() + " J</b> from " + S.coils + " coils (target " + st.target.toLocaleString() + " J)." + (win ? " Medal: <b>" + names[medal] + "</b>" + (gained > 0 ? " (+" + gained + ")" : "") + "." : "") + "</p>" +
          "<p>Every joule came from your kinetic energy: the coil's current pushes back on the magnet (Lenz's law), and the motor tops your speed back up. A bicycle dynamo and every power-station generator work on the same principle, ε = BLv.</p>" +
          "<div class='gm-actions'>" + (next ? "<button class='gm-btn gm-btn--go' data-act='next'>Next track</button>" : "") + "<button class='gm-btn" + (next ? "" : " gm-btn--go") + "' data-act='retry'>" + (win ? "Race your ghost" : "Try again") + "</button><button class='gm-btn' data-act='map'>Tracks</button></div>",
          function (a) { if (a === "next") start(k + 1); else if (a === "retry") start(k); else menu(api); });
      } });
  }
  function endlessOver(why) {
    var api = API, score = Math.round(S.dist) + Math.round(S.energy / 20), row = { score: score, dist: Math.round(S.dist), E: Math.round(S.energy), cart: S.cart.name, who: (A.byId[save.who] || A.cast[0]).name, when: new Date().toISOString().slice(0, 10) };
    var prevTop = save.endless[0]; save.endless.push(row); save.endless.sort(function (a, b) { return b.score - a.score; }); save.endless = save.endless.slice(0, 10); var rank = save.endless.indexOf(row); persist();
    A.report("induction-dash", { result: "lose", stage: 1, score: Math.min(5000, Math.round(score / 4)) });
    var rec = rank === 0 && !!prevTop;
    api.ceremony(rec ? "newRecord" : "lose", { title: rec ? "NEW RECORD!" : "DERAILED", sub: "Endless line · " + row.dist + " m", hero: A.styled(A.byId[save.who] || A.cast[0]), score: score, scoreLabel: "Endless score",
      stats: [["Distance", row.dist + " m"], ["Energy", row.E.toLocaleString() + " J"], ["Top cruise", S.cruise.toFixed(1) + " m/s"]], line: rec ? "Further than you have ever gone." : "Each run pushes the motor a little faster. Next time, take the boosts early.",
      tip: "At high speed, change lanes earlier: the same 14 m gap between rows passes in under a second.", then: function () {
        var board = save.endless.map(function (r, i) { return "<tr" + (i === rank ? " style='font-weight:800'" : "") + "><td>" + (i + 1) + "</td><td>" + A.esc(r.who) + "</td><td>" + r.dist + " m</td><td>" + r.score.toLocaleString() + "</td></tr>"; }).join("");
        api.show("<h2>Endless: " + row.dist + " m</h2><p>" + A.esc(why) + " Score <b>" + score.toLocaleString() + "</b>.</p><table class='gm-board'><tr><th>#</th><th>Rider</th><th>Distance</th><th>Score</th></tr>" + board + "</table>" +
          "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>Go again</button><button class='gm-btn' data-act='map'>Tracks</button></div>", function (a) { if (a === "again") startEndless(); else menu(api); });
      } });
  }

  /* ---------- Menu: zones, tracks, carts, endless ---------- */
  function menu(api) {
    S.run = false; api.useActions([]); refreshCarts();
    var mc = medalCount(), hero = !!(api.hero && api.hero.active);
    var zones = I.ZONES.map(function (z, zi) {
      var tracks = I.TRACKS.filter(function (t) { return t.zone === zi; }).map(function (t) { var k = I.TRACKS.indexOf(t), open = k <= save.cleared || hero, m = save.medals[t.id] | 0;
        return "<button class='gm-btn gm-btn--sm" + (open ? " gm-btn--go" : "") + "' data-act='" + (open ? "st" : "no") + "' data-k='" + k + "'" + (open ? "" : " disabled") + ">" + (t.idx + 1) + ". " + A.esc(t.name) + (m ? " " + ["", "🥉", "🥈", "🥇"][m] : open ? "" : " 🔒") + "</button>"; }).join("");
      return "<p><b>" + A.esc(z.name) + "</b> <span class='gm-small'>adds " + A.esc(z.adds) + "</span></p><div class='gm-actions' style='flex-wrap:wrap'>" + tracks + "</div>";
    }).join("");
    var carts = I.CARTS.map(function (c) { var open = cartOpen(c); return "<button class='gm-btn gm-btn--sm' data-act='" + (open ? "cart" : "no") + "' data-id='" + c.id + "' aria-pressed='" + (save.cart === c.id) + "'" + (open ? "" : " disabled") + " title='" + A.esc(c.text) + "'>" + A.esc(c.name) + (open ? "" : " · " + c.need + " medals") + "</button>"; }).join("");
    api.show("<h2>Induction Dash</h2><p>Count Entropy has drained the beacons along the rail line. Ride a magnet cart through copper coils to generate the energy back, track by track. <b>" + mc + "</b> medal" + (mc === 1 ? "" : "s") + " so far.</p>" +
      A.picker(api, save.who, "Pick your rider") + "<p><b>Cart</b> <span class='gm-small'>" + A.esc(cartOf(save.cart).text) + "</span></p><div class='gm-actions' style='flex-wrap:wrap'>" + carts + "</div>" + zones +
      "<p><b>Endless line</b></p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='endless'>Ride the endless line" + (save.endless[0] ? " · best " + save.endless[0].dist + " m" : "") + "</button></div>",
      function (a, el) {
        if (a === "pick") { save.who = el.getAttribute("data-id"); persist(); [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); }); }
        else if (a === "cart") { save.cart = el.getAttribute("data-id"); persist(); menu(api); }
        else if (a === "st") start(+el.getAttribute("data-k"));
        else if (a === "endless") startEndless();
      });
    A.paintFaces(document.querySelector("[data-gm-overlay]"));
  }

  /* ---------- Simulation ---------- */
  function droneLane(o, t) { // drones hold a lane, then glide to the other; returns a continuous lane position and the lane it is heading to
    var ph = ((t + o.x * .37) % o.period) / o.period, a = o.lanes[0], b = o.lanes[1], f = ph < .5 ? 0 : ph < .62 ? (ph - .5) / .12 : ph < .88 ? 1 : ph < 1 ? 1 - (ph - .88) / .12 : 0;
    f = f * f * (3 - 2 * f); var next = ph < .5 ? b : ph < .88 ? a : b, warn = (ph > .36 && ph < .5) || (ph > .74 && ph < .88);
    return { pos: a + (b - a) * f, warn: warn, to: next };
  }
  function laneOf(o, t) { return o.kind === "drone" ? Math.round(droneLane(o, t).pos) : o.lane; }
  function moveLane(d) { S.lane = Math.max(0, Math.min(2, S.lane + d)); }
  function jump() { if (S.z <= 0) { S.vz = 5.2; API.sound.sfx("jump"); } }
  function hurtCart(o) {
    if (S.shield > 0) { S.shield = 0; pop("Shield absorbed it", "#7ef0ff"); API.sound.sfx("block"); return; }
    if (!(CT.god || heroOn())) S.hearts--; S.hits++; S.v = Math.max(5, S.v - 4); S.hurt = .5; S.combo = 0;
    API.sound.sfx("hit"); API.kick(8); API.buzz(60); API.flash("#ff2a2a", .2); API.hitstop(.05); API.burst(180, S.ly - 30, o.kind === "drone" ? "#c084fc" : o.kind === "bolt" ? "#fde047" : "#ff9d5c", 16, 260);
    pop(o.kind === "drone" ? "Entropy drone hit!" : o.kind === "bolt" ? "Lightning strike!" : "Crate hit!", "#ff8080");
  }
  function step(api, dt) {
    var st = S.st, c = S.cart; S.time += dt;
    if (api.hit("up")) moveLane(-1);
    if (api.hit("down")) moveLane(1);
    if (api.hit("jump")) jump();
    S.ly += (LANES[S.lane] - S.ly) * Math.min(1, dt * 14);
    S.vz -= 9.8 * dt; S.z = Math.max(0, S.z + S.vz * dt); if (S.z === 0 && S.vz < 0) S.vz = 0;
    if (S.mode === "endless") { S.cruise = I.endlessCruise(S.dist) + (c.cruise - I.CRUISE); feedEndless(); }
    var top = S.cruise + 8; S.v += (S.cruise - S.v) * Math.min(1, dt * 0.35); S.v = Math.min(S.v, top); // motor and drag settle the cart at cruising speed
    S.dist += S.v * dt; S.hurt = Math.max(0, S.hurt - dt); S.meterT = Math.max(0, S.meterT - dt); S.comboT -= dt; S.tutT = Math.max(0, S.tutT - dt); S.shield = Math.max(0, S.shield - dt * 0); S.magnet = Math.max(0, S.magnet - dt);
    if ((S.recT -= dt) <= 0) { S.recT = .1; S.rec.push(Math.round(S.dist * 10), S.lane, Math.round(S.z * 10)); }
    var laneNow = Math.round((S.ly - LANES[0]) / (LANES[1] - LANES[0])), t = S.time;
    for (var i = 0; i < S.items.length; i++) {
      var o = S.items[i]; if (o.done || Math.abs(o.x - S.dist) > .8) continue;
      var lane = laneOf(o, t), near = lane === laneNow || (o.kind === "coil" && S.magnet > 0 && Math.abs(lane - laneNow) === 1);
      if (!near) continue;
      if (o.kind === "coil") {
        if (S.z > .6) continue; o.done = true; var n = o.n || 1, E = I.energy(S.v, c, n), eps = I.emf(S.v, c, n);
        S.energy += E; S.v = Math.max(4, S.v - I.dv(c, n)); S.coils++; S.meter = eps; S.meterT = 1.2; o.glow = 1;
        api.sound.sfx("zap"); api.buzz(10); api.burst(180, S.ly - 20, "#ffd86b", 8, 180); S.combo = (S.comboT > 0 ? S.combo + 1 : 1); S.comboT = 1.6;
        if (S.combo >= 3) pop("Coil streak ×" + S.combo, "#7ef0ff"); pop("+" + Math.round(E) + " J  ε = " + eps.toFixed(0) + " V" + (n > 1 ? " (N = 2)" : ""), "#ffd86b");
      } else if (o.kind === "boost") { o.done = true; S.v = Math.min(top, S.v + 4); api.sound.sfx("power"); pop("Boost +4 m/s", "#7ef0ff"); }
      else if (o.kind === "ramp") { if (S.z > .3) continue; o.done = true; S.vz = 6.6; api.sound.sfx("jump"); pop("Ramp!", "#7ef0ff"); }
      else if (o.kind === "shield") { o.done = true; S.shield = 1; api.sound.sfx("power"); pop("Insulating shield: blocks one hit", "#7ef0ff"); }
      else if (o.kind === "magnet") { o.done = true; S.magnet = 5; api.sound.sfx("power"); pop("Wide field: coils one lane away count for 5 s", "#c084fc"); }
      else if (o.kind === "plate") { if (S.z > .5) { o.done = true; pop("Cleared the plate", "#3dd68c"); continue; } o.done = true; var pd = I.plateDv(c); S.v = Math.max(4, S.v - pd); api.sound.sfx("block"); pop("Eddy brake −" + pd.toFixed(1) + " m/s (lost as heat)", "#c9d2dc"); }
      else if (o.kind === "block") { o.done = true; if (S.z < .5) hurtCart(o); else pop("Clean jump", "#3dd68c"); }
      else if (o.kind === "drone" || o.kind === "bolt") { o.done = true; hurtCart(o); }
    }
    S.pops.forEach(function (p) { p.life -= dt; p.y += dt * 40; }); S.pops = S.pops.filter(function (p) { return p.life > 0; });
    if (S.hearts <= 0) return finish(false, S.mode === "endless" ? "The cart took too many hits." : "The cart took too many hits.");
    if (S.mode === "track" && S.dist >= st.len) return S.energy >= st.target ? finish(true, "You reached the beacon with enough energy.") : finish(false, "You reached the end, but the beacon needs " + Math.round(st.target - S.energy) + " J more. Take more coils, and boost before them: energy per coil grows with speed.");
  }
  /* A simple lane-picking driver, used by the tests (and handy for attract mode): avoid what will hurt, take coils and boosts. */
  function bot() {
    if (!S.run || S.over) return; var t = S.time, look = Math.max(10, S.v * 1.25), score = [0, 0, 0];
    S.items.forEach(function (o) { if (o.done) return; var ahead = o.x - S.dist; if (ahead < -.5 || ahead > look) return; var at = t + Math.max(0, ahead) / S.v, l = laneOf(o, at), w = 1 + (look - ahead) / look * 2;
      if (o.kind === "coil") score[l] += 6 * (o.n || 1) * w; else if (o.kind === "boost" || o.kind === "shield" || o.kind === "magnet") score[l] += 3 * w;
      else if (o.kind === "block") score[l] -= ahead < 3 && S.z <= 0 ? 4 : 2; else if (o.kind === "plate") score[l] -= 5 * w; else if (o.kind === "drone" || o.kind === "bolt") score[l] -= 60 * w; else if (o.kind === "ramp") score[l] += 1; });
    var best = S.lane; [S.lane - 1, S.lane + 1].forEach(function (l) { if (l >= 0 && l <= 2 && score[l] > score[best] + 2) best = l; });
    if (best !== S.lane) { var d = best > S.lane ? 1 : -1, mid = S.lane + d; if (Math.abs(best - S.lane) === 2 && score[mid] < -30) best = S.lane; else moveLane(d); }
    var blk = S.items.filter(function (o) { return !o.done && o.kind === "block" && laneOf(o, t) === S.lane && o.x - S.dist > 0 && o.x - S.dist < S.v * .45; })[0];
    if (blk && S.z <= 0) { S.vz = 5.2; }
  }

  /* ---------- Drawing ---------- */
  function hudScale() { var cv = document.querySelector("[data-gm-canvas]"), cr = cv && cv.getBoundingClientRect ? cv.getBoundingClientRect() : null, w = cr ? Math.min(cr.width, cr.height * 16 / 9 || cr.width) : 960, base = w < 620 ? Math.min(2.2, Math.max(1.4, 11 / (14 * w / 960))) : 1; var hs = API && API.settings && API.settings.get ? +API.settings.get("hudScale") || 1 : 1; return base * hs * (opt("bigHud", false) ? 1.25 : 1); }
  function drawCart(x, cy, cz, cart, who, alpha, mood) {
    x.save(); x.globalAlpha = alpha; x.translate(180, cy - cz);
    x.fillStyle = "#26303c"; x.fillRect(-30, -12, 60, 18); x.fillStyle = cart.col[0]; x.fillRect(-30, -12, 30, 8); x.fillStyle = cart.col[1]; x.fillRect(0, -12, 30, 8);
    x.fillStyle = "#fff"; x.font = "800 9px system-ui"; x.textAlign = "center"; x.fillText("N", -15, -5); x.fillText("S", 15, -5);
    x.fillStyle = "#111"; x.beginPath(); x.arc(-18, 8, 7, 0, 7); x.arc(18, 8, 7, 0, 7); x.fill();
    if (who) { x.fillStyle = who.coat; x.fillRect(-10, -30, 20, 18); A.drawHead(x, who, 0, -46, 17, 1, { mood: mood }); }
    x.restore();
  }
  function draw(api) {
    var x = api.x, st = S.st || I.TRACKS[0], t = api.t, d = S.dist || t * 8, tt = S.time || t;
    var g = x.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[1]); x.fillStyle = g; x.fillRect(0, 0, 960, 260);
    if (st.zone === 4 && !api.reduce && Math.floor(t * 1.7) % 9 === 0) { x.strokeStyle = "rgba(230,210,255,.85)"; x.lineWidth = 2; x.beginPath(); x.moveTo(640, 0); x.lineTo(620, 60); x.lineTo(650, 80); x.lineTo(625, 150); x.stroke(); }
    x.fillStyle = "rgba(0,0,0,.18)"; for (var h = 0; h < 6; h++) { var hx = ((h * 230 - d * 4) % 1380 + 1380) % 1380 - 210; x.beginPath(); x.moveTo(hx, 260); x.quadraticCurveTo(hx + 115, 150 + (h % 3) * 20, hx + 230, 260); x.fill(); }
    x.strokeStyle = "rgba(20,25,35,.7)"; x.lineWidth = 3; var pyl = [];
    for (var p = 0; p < 6; p++) { var px = ((p * 240 - d * 10) % 1440 + 1440) % 1440 - 240; pyl.push(px); x.beginPath(); x.moveTo(px, 255); x.lineTo(px + 14, 150); x.lineTo(px + 28, 255); x.moveTo(px - 6, 165); x.lineTo(px + 34, 165); x.stroke(); }
    x.lineWidth = 1.2; pyl.sort(function (a, b) { return a - b; }); for (var q = 0; q < pyl.length - 1; q++) { x.beginPath(); x.moveTo(pyl[q] - 6, 165); x.quadraticCurveTo((pyl[q] + pyl[q + 1]) / 2 + 14, 185, pyl[q + 1] - 6, 165); x.stroke(); }
    x.fillStyle = st.ground; x.fillRect(0, 255, 960, 285);
    LANES.forEach(function (ly) { x.fillStyle = "rgba(0,0,0,.25)"; x.fillRect(0, ly - 6, 960, 26); x.fillStyle = "#6d5a45"; for (var s = ((-d * PX) % 40 + 40) % 40; s < 960; s += 40) x.fillRect(s, ly - 4, 10, 22); x.fillStyle = "#c9ced6"; x.fillRect(0, ly - 2, 960, 3); x.fillRect(0, ly + 14, 960, 3); });
    var items = (S.items || []).filter(function (o) { var sx = 180 + (o.x - d) * PX; return sx > -60 && sx < 1020; });
    function itemDraw(o, front) {
      var sx = 180 + (o.x - d) * PX, dl = o.kind === "drone" ? droneLane(o, tt) : null, ly = dl ? LANES[0] + (LANES[1] - LANES[0]) * dl.pos : LANES[o.lane];
      if (o.kind === "coil") { var n = o.n || 1; x.strokeStyle = o.glow ? "#ffd86b" : n > 1 ? "#e0a050" : "#c77d3a"; x.lineWidth = n > 1 ? 10 : 7; x.beginPath(); x.ellipse(sx, ly - 22, 16, 44, 0, front ? -Math.PI / 2 : Math.PI / 2, front ? Math.PI / 2 : Math.PI * 1.5); x.stroke();
        if (n > 1 && !front) { x.lineWidth = 3; x.strokeStyle = "#7a4a1a"; x.beginPath(); x.ellipse(sx + 6, ly - 22, 14, 40, 0, Math.PI / 2, Math.PI * 1.5); x.stroke(); }
        if (o.glow && front) { o.glow = Math.max(0, o.glow - .02); x.strokeStyle = "rgba(255,216,107," + o.glow + ")"; x.lineWidth = 14; x.stroke(); } }
      if (front) return;
      if (o.done) return;
      if (o.kind === "block") { x.fillStyle = "#e07a2e"; x.fillRect(sx - 16, ly - 30, 32, 34); x.fillStyle = "#fff"; x.fillRect(sx - 16, ly - 18, 32, 6); }
      else if (o.kind === "boost") { x.fillStyle = "#7ef0ff"; for (var c = 0; c < 3; c++) { x.beginPath(); x.moveTo(sx - 18 + c * 12, ly - 4); x.lineTo(sx - 8 + c * 12, ly + 6); x.lineTo(sx - 18 + c * 12, ly + 16); x.fill(); } }
      else if (o.kind === "ramp") { x.fillStyle = "#8b5a2b"; x.beginPath(); x.moveTo(sx - 24, ly + 14); x.lineTo(sx + 20, ly + 14); x.lineTo(sx + 20, ly - 14); x.closePath(); x.fill(); x.fillStyle = "#fde047"; x.fillRect(sx - 2, ly + 2, 18, 3); }
      else if (o.kind === "plate") { x.fillStyle = "rgba(200,210,225,.9)"; x.fillRect(sx - 22, ly - 2, 44, 16); x.strokeStyle = "#64748b"; x.lineWidth = 2; x.strokeRect(sx - 22, ly - 2, 44, 16); x.fillStyle = "#334155"; x.font = "700 10px system-ui"; x.textAlign = "center"; x.fillText("Al", sx, ly + 10); }
      else if (o.kind === "shield" || o.kind === "magnet") { x.fillStyle = o.kind === "shield" ? "#7ef0ff" : "#c084fc"; x.beginPath(); x.arc(sx, ly - 20 + Math.sin(tt * 5 + o.x) * 3, 11, 0, 7); x.fill(); x.fillStyle = "#0b1020"; x.font = "800 12px system-ui"; x.textAlign = "center"; x.fillText(o.kind === "shield" ? "S" : "M", sx, ly - 16); }
      else if (o.kind === "bolt") { var ahead = o.x - d, warnB = ahead < S.v * 1.2 + 4; x.fillStyle = "rgba(253,224,71," + (warnB ? .25 + .25 * Math.sin(tt * 30) : .12) + ")"; x.fillRect(sx - 20, 0, 40, ly + 14);
        x.strokeStyle = "#fde047"; x.lineWidth = 3; x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx - 10, ly * .4); x.lineTo(sx + 8, ly * .55); x.lineTo(sx - 4, ly); x.stroke(); }
      else if (o.kind === "drone") { var bob = Math.sin(tt * 8 + o.x) * 3; if (dl.warn) { var ty = LANES[dl.to]; x.strokeStyle = "rgba(255,51,85,.8)"; x.setLineDash([5, 5]); x.lineWidth = 2; x.strokeRect(sx - 24, ty - 74, 48, 26); x.setLineDash([]); }
        x.fillStyle = "#3d1f5c"; x.beginPath(); x.ellipse(sx, ly - 62 + bob, 22, 12, 0, 0, 7); x.fill(); x.fillStyle = "#ff3355"; x.beginPath(); x.arc(sx - 6, ly - 62 + bob, 4, 0, 7); x.fill(); x.strokeStyle = "#c084fc"; x.lineWidth = 2; x.beginPath(); x.moveTo(sx - 26, ly - 74 + bob); x.lineTo(sx + 26, ly - 74 + bob); x.stroke(); }
    }
    items.forEach(function (o) { itemDraw(o, false); });
    var cart = S.cart || I.CARTS[0], who = A.styled(A.byId[save.who] || A.cast[0]);
    // ghost: your best run on this track, replayed by time
    if (S.ghost && S.run) { var gi = Math.floor(S.time / .1) * 3; if (gi + 2 < S.ghost.length) { var gd = S.ghost[gi] / 10, gl = S.ghost[gi + 1], gz = S.ghost[gi + 2] / 10, gx = 180 + (gd - d) * PX;
      if (gx > -40 && gx < 1000) { x.save(); x.translate(gx - 180, 0); drawCart(x, LANES[gl], gz * PX, cart, null, .35); x.restore(); } } }
    var cy = S.ly || LANES[1], cz = (S.z || 0) * PX, flick = S.hurt > 0 && Math.floor(t * 20) % 2;
    if (!flick) { x.fillStyle = "rgba(0,0,0,.3)"; x.beginPath(); x.ellipse(180, cy + 14, 30 - cz * .1, 6, 0, 0, 7); x.fill(); drawCart(x, cy, cz, cart, who, 1, S.hurt > 0 ? "sad" : "happy");
      if (S.shield > 0) { x.strokeStyle = "rgba(126,240,255,.8)"; x.lineWidth = 3; x.beginPath(); x.arc(180, cy - cz - 20, 46, 0, 7); x.stroke(); }
      if (S.magnet > 0) { x.strokeStyle = "rgba(192,132,252,.6)"; x.setLineDash([4, 6]); x.lineWidth = 2; x.beginPath(); x.ellipse(180, cy - 10, 60, 100, 0, 0, 7); x.stroke(); x.setLineDash([]); } }
    items.forEach(function (o) { if (o.kind === "coil") itemDraw(o, true); });
    if (!S.st || !S.items) return;
    if (S.hurt > 0 && api.settings && api.settings.get && api.settings.get("flashes") !== false) { var v = x.createRadialGradient(480, 270, 280, 480, 270, 600); v.addColorStop(0, "rgba(255,0,0,0)"); v.addColorStop(1, "rgba(255,40,40," + (S.hurt * 1.1).toFixed(2) + ")"); x.fillStyle = v; x.fillRect(0, 0, 960, 540); }
    // HUD, scaled up on narrow screens so its text stays readable
    var fs = hudScale(), endless = S.mode === "endless", W1 = 380 * fs;
    x.save(); x.fillStyle = "rgba(4,12,18,.72)"; x.fillRect(16, 14, W1, 66 * fs); x.fillStyle = "#fff"; x.font = "700 " + 14 * fs + "px system-ui"; x.textAlign = "left";
    x.fillText(endless ? Math.round(S.dist) + " m · " + Math.round(S.energy).toLocaleString() + " J" : "Energy " + Math.round(S.energy).toLocaleString() + " / " + st.target.toLocaleString() + " J", 28, 14 + 22 * fs);
    if (!endless) { var pct = Math.min(1, S.energy / st.medals[2]); x.fillStyle = "rgba(255,255,255,.15)"; x.fillRect(28, 14 + 30 * fs, W1 - 24, 10 * fs); x.fillStyle = S.energy >= st.target ? "#3dd68c" : "#ffd86b"; x.fillRect(28, 14 + 30 * fs, (W1 - 24) * pct, 10 * fs);
      st.medals.forEach(function (m, i) { var mx = 28 + (W1 - 24) * m / st.medals[2]; x.fillStyle = ["#cd7f32", "#c0c0c0", "#ffd700"][i]; x.fillRect(mx - 2, 14 + 27 * fs, 4, 16 * fs); });
      x.fillStyle = "rgba(255,255,255,.15)"; x.fillRect(28, 14 + 48 * fs, W1 - 24, 6 * fs); x.fillStyle = "#7ef0ff"; x.fillRect(28, 14 + 48 * fs, (W1 - 24) * Math.min(1, S.dist / st.len), 6 * fs); }
    else { x.fillStyle = "#7ef0ff"; x.font = "600 " + 12 * fs + "px system-ui"; x.fillText("Cruise " + S.cruise.toFixed(1) + " m/s · zone: " + I.ZONES[S.st.zone].name, 28, 14 + 44 * fs); }
    for (var hh = 0; hh < S.maxHearts; hh++) { var on = hh < S.hearts; x.fillStyle = on ? "#ff4d6d" : "rgba(255,255,255,.2)"; x.font = 22 * fs + "px system-ui"; x.fillText("♥", 32 + W1 + hh * 26 * fs, 14 + 30 * fs); }
    var mx2 = 880, my = 70, val = S.meterT > 0 ? S.meter : 0, ang = Math.PI * (1 + Math.min(1, val / 60)), ms = Math.min(fs, 1.5);
    x.translate(mx2, my); x.scale(ms, ms); x.fillStyle = "rgba(4,12,18,.75)"; x.beginPath(); x.arc(0, 0, 52, Math.PI, 0); x.fill(); x.strokeStyle = "#7ef0ff"; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 46, Math.PI, 0); x.stroke();
    x.strokeStyle = "#ffd86b"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(ang) * 40, Math.sin(ang) * 40); x.stroke();
    x.fillStyle = "#fff"; x.font = "600 12px ui-monospace, monospace"; x.textAlign = "center"; x.fillText("ε " + val.toFixed(0) + " V", 0, 16); x.fillText(S.v.toFixed(1) + " m/s", 0, 32); x.restore();
    S.pops.forEach(function (p, i) { x.globalAlpha = Math.min(1, p.life * 1.4); x.fillStyle = p.col; x.font = "700 " + 15 * Math.min(fs, 1.6) + "px system-ui"; x.textAlign = "left"; x.fillText(p.t, 220, S.ly - 70 - p.y - i * 2); }); x.globalAlpha = 1;
    if (S.tutT > 0) { x.fillStyle = "rgba(4,12,18,.85)"; x.fillRect(160, 110 + 40 * (fs - 1), 640, 34 * fs); x.fillStyle = "#7ef0ff"; x.textAlign = "center"; x.font = "600 " + 14 * fs + "px system-ui"; x.fillText(S.tutT > 6 ? "▲ / ▼ (or swipe) change lane." : S.tutT > 3 ? "Drive through the copper coils to generate energy." : "Jump (tap) over the orange crates.", 480, 110 + 40 * (fs - 1) + 23 * fs); }
  }

  /* swipe to change lane, tap to jump (phones; switchable in Settings) */
  function swipes() {
    var cv = document.querySelector("[data-gm-canvas]"); if (!cv || !cv.addEventListener) return; var sx = 0, sy = 0, st0 = 0, id = null;
    cv.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse" || !S.run || !opt("swipe", true)) return; id = e.pointerId; sx = e.clientX; sy = e.clientY; st0 = Date.now(); });
    cv.addEventListener("pointerup", function (e) { if (e.pointerId !== id) return; id = null; var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx)) moveLane(dy < 0 ? -1 : 1); else if (Math.abs(dx) < 16 && Math.abs(dy) < 16 && Date.now() - st0 < 300) jump(); });
  }
  function settings(api) {
    if (!api.settings || !api.settings.add) return;
    api.settings.add({ id: "dash_ghost", tab: "gameplay", label: "Ghost of your best run", type: "toggle", default: true, help: "A see-through cart replays your best run on each track." });
    api.settings.add({ id: "dash_swipe", tab: "controls", label: "Swipe to change lane", type: "toggle", default: true, help: "Phones: swipe up or down to change lane, tap to jump.", when: function () { return typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches; } });
    api.settings.add({ id: "dash_tips", tab: "gameplay", label: "Tutorial tips", type: "toggle", default: true });
    api.settings.add({ id: "dash_bigHud", tab: "display", label: "Large energy panel", type: "toggle", default: false });
  }

  var game = { song: A.song(399, "funk"), savePrefix: ["ee-arcade-dash"], menu: function (api) { S.run = false; menu(api); },
    actions: [{ id: "up", label: "Lane up", keys: ["ArrowUp", "KeyW"], touch: { label: "▲", x: 9, y: 66 } }, { id: "down", label: "Lane down", keys: ["ArrowDown", "KeyS"], touch: { label: "▼", x: 9, y: 86 } },
      { id: "jump", label: "Jump", keys: ["Space", "KeyJ"], touch: { label: "⤒", x: 90, y: 80 } }],
    init: function (api) {
      API = api; setupCheats(api); settings(api); swipes();
      api.panel("<p>Moving a magnet through a coil changes the magnetic flux, which induces an emf (Faraday's law). The induced current pushes back against the motion (Lenz's law), so the energy you collect is taken from your motion.</p><table><tr><td>Motional emf</td><td><span class='gm-eq'>ε = NBLv</span> (V)</td></tr><tr><td>Braking force</td><td><span class='gm-eq'>F = NB²L²v / R</span> (N)</td></tr><tr><td>Energy per coil</td><td><span class='gm-eq'>E = Fd = NB²L²vd / R</span> (J)</td></tr><tr><td>Speed lost</td><td><span class='gm-eq'>Δv = NB²L²d / (mR)</span> (m/s)</td></tr><tr><td>Eddy brake plate</td><td><span class='gm-eq'>Δv = B²L²d / (mR<sub>Al</sub>)</span>, energy lost as heat</td></tr></table>" +
        "<p class='gm-small'>Model: game-world values B = 1.8–2.6 T by cart, L = 1 m, coil width d = 2 m, R = 0.5 Ω per turn (so an N-turn coil has N times the resistance), aluminium plates R = 0.25 Ω over 1 m, carts 14–32 kg, a motor that returns you to cruising speed. The formulas are exact; the magnets are far stronger than real ones so the effect is visible. Course: PHYS 122, electromagnetic induction; ENGG 205, e = Blv.</p>",
        "<p class='gm-small'>Phones: lane buttons on the left and jump on the right, or swipe up/down and tap. Move or resize the buttons in Settings.</p>");
      menu(api);
    },
    update: function (dt, api) { if (api.hero.inUse !== heroOn()) api.hero.use(heroOn()); if (api.overlayOpen() || !S.run || S.over) return; if (heroOn()) S.v = Math.max(S.v, (S.cruise || 14) + 6); step(api, dt); },
    draw: draw
  };
  A.run(game);
  window.InductionDash = { get S() { return S; }, save: save, start: function (k, cart) { start(k, cart); }, startEndless: function (cart) { startEndless(cart); }, bot: bot };
})();
