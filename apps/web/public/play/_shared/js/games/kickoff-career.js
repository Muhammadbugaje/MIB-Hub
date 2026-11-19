/* Momentum Cup career: profile, roster, clubs, leagues, seasons, rankings and the endless Legends ladder.
 * Pure rules with no DOM, so the same file runs in the browser (window.MomentumCareer) and in the Node tests.
 * Everything random is seeded, so a career replays the same way from the same save. Clubs and players are invented. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MomentumCareer = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var C = {};
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  C.rng = rng; C.hash = hash;

  /* ---------- tiers: each league is harder, pays more and has its own cup ---------- */
  C.TIERS = [
    { id: "campus", name: "Campus League", cup: "Freshers Shield", skill: .32, stat: .93, coins: 70, arena: "campus", col: "#3dd68c" },
    { id: "regional", name: "Regional League", cup: "Savannah Cup", skill: .46, stat: .98, coins: 100, arena: "sunset", col: "#7ef0ff" },
    { id: "national", name: "National League", cup: "National Cup", skill: .6, stat: 1.03, coins: 140, arena: "night", col: "#f6c445" },
    { id: "continental", name: "Continental League", cup: "Continental Cup", skill: .74, stat: 1.08, coins: 190, arena: "rain", col: "#ff9d5c" },
    { id: "world", name: "World League", cup: "World Cup of Clubs", skill: .86, stat: 1.13, coins: 260, arena: "grand", col: "#a78bfa" }
  ];
  /* ---------- 30 invented clubs, six per tier ---------- */
  var CLUB_NAMES = [
    ["Faraday Hall FC", "#3dd68c", "#0b3d2a"], ["Kola Nut Rovers", "#c2410c", "#fde68a"], ["Senate Strikers", "#f97316", "#1f2937"], ["Harmattan United", "#eab308", "#78350f"], ["Library Lions", "#2563eb", "#fef3c7"], ["Shinkafi Stars", "#db2777", "#fdf2f8"],
    ["Sahel Sparks", "#facc15", "#1e3a8a"], ["Benue Ripples", "#0ea5e9", "#f0f9ff"], ["Baobab Athletic", "#65a30d", "#3f2a14"], ["Dune Rangers", "#d97706", "#fffbeb"], ["Savanna Gusts", "#84cc16", "#1a2e05"], ["Rift Rockets", "#ef4444", "#111827"],
    ["Lagoon Lancers", "#06b6d4", "#083344"], ["Delta Dynamos", "#16a34a", "#fefce8"], ["Granite Giants", "#64748b", "#f8fafc"], ["Niger Current", "#1d4ed8", "#facc15"], ["Ember City", "#dc2626", "#fde047"], ["Atlas Orbit", "#7c3aed", "#ede9fe"],
    ["Equator Eclipse", "#0f172a", "#fbbf24"], ["Cape Cyclones", "#0891b2", "#ecfeff"], ["Nile Neutrons", "#059669", "#ecfdf5"], ["Kalahari Kelvins", "#ea580c", "#431407"], ["Sahara Solstice", "#ca8a04", "#fff7ed"], ["Atlantic Amperes", "#2563eb", "#e0f2fe"],
    ["Polaris Pulse", "#38bdf8", "#0c4a6e"], ["Aurora Athletic", "#22d3ee", "#4c1d95"], ["Meridian Magnetos", "#e11d48", "#fff1f2"], ["Quasar Republic", "#a855f7", "#faf5ff"], ["Tidal Torque", "#0d9488", "#f0fdfa"], ["Zenith Galaxy", "#f59e0b", "#1e1b4b"]
  ];
  C.CLUBS = CLUB_NAMES.map(function (c, i) { var t = Math.floor(i / 6); return { id: "c" + i, name: c[0], short: c[0].split(" ")[0], c1: c[1], c2: c[2], tier: t, rating: +(.9 + t * .12 + (5 - i % 6) * .012).toFixed(3) }; });
  C.VILLAIN_CLUB = { id: "entropy", name: "Disorder XI", short: "Disorder", c1: "#3d1f5c", c2: "#c084fc", tier: 5, rating: 1.6 };
  function clubById(id) { if (id === "entropy") return C.VILLAIN_CLUB; return C.CLUBS[+String(id).slice(1)] || null; }
  C.clubById = clubById;

  /* ---------- superpowers: each maps onto one of the match engine's effects, with its own name ---------- */
  C.POWERS = {
    inertia: { name: "Inertia Cannon", engine: "newton", cd: 11 }, cage: { name: "Shield Wall", engine: "faraday", cd: 13 },
    glow: { name: "Half-life Glow", engine: "curie", cd: 11 }, coil: { name: "Lightning Coil", engine: "tesla", cd: 12 },
    slowmo: { name: "Time-slow Volley", engine: "einstein", cd: 13 }, leap: { name: "Quantum Step", engine: "bohr", cd: 11 },
    glide: { name: "Ice Glide", engine: "groove", cd: 10 }, push: { name: "One-inch Push", engine: "kai", cd: 10 },
    curve: { name: "Curve Shot", engine: "curve", cd: 10 }, well: { name: "Gravity Well", engine: "well", cd: 12 },
    dash: { name: "Lightning Dash", engine: "dash", cd: 9 }, magnet: { name: "Magnetic Dribble", engine: "magnet", cd: 11 }
  };
  var PKEYS = Object.keys(C.POWERS);

  /* ---------- 64 original players: invented names, campus and physics nicknames ---------- */
  var FIRST = ["Adaeze", "Bayo", "Chidi", "Danjuma", "Efe", "Funmi", "Garba", "Halima", "Ifeoma", "Jide", "Kemi", "Lanre", "Musa", "Ngozi", "Obinna", "Patience",
    "Rukayya", "Seun", "Tamuno", "Uche", "Victoria", "Wale", "Yetunde", "Zainab", "Amara", "Bello", "Chiamaka", "Dayo", "Ese", "Fatima", "Gbenga", "Hadiza",
    "Ikenna", "Jumoke", "Kunle", "Lami", "Mairo", "Nnamdi", "Oluchi", "Precious", "Rahma", "Sola", "Tobi", "Usman", "Vivian", "Yusuf", "Zara", "Aisha",
    "Emeka", "Folake", "Hassan", "Idris", "Joy", "Kayode", "Lucky", "Mubarak", "Nkem", "Osas", "Rita", "Segun", "Tunde", "Uduak", "Yemi", "Zubair"];
  var FEMALE = { Adaeze: 1, Funmi: 1, Halima: 1, Ifeoma: 1, Kemi: 1, Ngozi: 1, Patience: 1, Rukayya: 1, Victoria: 1, Yetunde: 1, Zainab: 1, Amara: 1, Chiamaka: 1, Ese: 1, Fatima: 1, Hadiza: 1, Jumoke: 1, Lami: 1, Mairo: 1, Oluchi: 1, Precious: 1, Rahma: 1, Vivian: 1, Zara: 1, Aisha: 1, Folake: 1, Joy: 1, Nkem: 1, Rita: 1, Uduak: 1 };
  var NICK = ["Quark", "Vector", "Joule", "Ohm", "Photon", "Torque", "Gauss", "Prism", "Neutrino", "Kelvin", "Volt", "Lumen", "Tesla", "Hertz", "Apex", "Orbit",
    "Pulse", "Flux", "Spin", "Ion", "Comet", "Delta", "Sigma", "Echo", "Nova", "Rocket", "Static", "Wave", "Boson", "Ember", "Zero", "Max"];
  var LAST = ["Okafor", "Adeyemi", "Bello", "Eze", "Ibrahim", "Okon", "Danladi", "Nwosu", "Lawal", "Obi", "Yusuf", "Ogun", "Abubakar", "Uche", "Bassey", "Musa"];
  var SKIN = ["#4a2e1c", "#6b4226", "#8d5a3b", "#a8714a", "#c68642", "#dcab80", "#e8c193"];
  var HAIR = ["#151515", "#2b1b12", "#3d2414", "#5a3a22", "#1a1a2e", "#7a4a2a"];
  var STYLES = ["band", "bun", "coily", "dj", "receding", "slick", "whiskers", "wig", "wild"];
  var RARITY = { common: { n: 24, lo: .9, hi: 1.0, cost: 300, mult: 1 }, rare: { n: 20, lo: .97, hi: 1.07, cost: 900, mult: 1.4 }, epic: { n: 12, lo: 1.04, hi: 1.13, cost: 2400, mult: 1.9 }, legendary: { n: 8, lo: 1.11, hi: 1.2, cost: 0, mult: 2.6 } };
  C.RARITY = RARITY;
  // the eight legends are earned, never bought
  C.LEGEND_UNLOCK = [
    { kind: "trophy", tier: 0, text: "Win the Campus League" }, { kind: "trophy", tier: 1, text: "Win the Regional League" },
    { kind: "trophy", tier: 2, text: "Win the National League" }, { kind: "trophy", tier: 3, text: "Win the Continental League" },
    { kind: "trophy", tier: 4, text: "Win the World League" }, { kind: "goals", n: 150, text: "Score 150 career goals" },
    { kind: "streak", n: 10, text: "Win 10 matches in a row" }, { kind: "legends", n: 10, text: "Reach Legends rung 10" }
  ];
  C.PLAYERS = (function () {
    var r = rng(20261113), out = [], order = ["common", "rare", "epic", "legendary"], k = 0;
    order.forEach(function (rar) {
      var R = RARITY[rar];
      for (var i = 0; i < R.n; i++, k++) {
        var first = FIRST[k], fem = !!FEMALE[first], nick = NICK[k % NICK.length], last = LAST[Math.floor(r() * LAST.length)];
        if (last === first) last = LAST[(LAST.indexOf(last) + 1) % LAST.length];
        function st() { return +(R.lo + r() * (R.hi - R.lo)).toFixed(3); }
        var pw = PKEYS[(k * 5 + 3) % PKEYS.length];
        var p = { id: "k" + k, name: first + " “" + nick + "” " + last, short: first, nick: nick, fem: fem, rarity: rar,
          skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)], style: fem ? ["bun", "wig", "coily", "band"][Math.floor(r() * 4)] : STYLES[Math.floor(r() * STYLES.length)],
          eye: "#1a1010", coat: "#3b82f6", mass: Math.round(60 + r() * 22),
          speed: st(), jump: st(), shot: st(), header: st(), defence: st(), stamina: st(), pw: pw, power: 0,
          cost: rar === "legendary" ? 0 : Math.round(R.cost * (.8 + r() * .5) / 50) * 50,
          need: rar === "rare" ? 1 : rar === "epic" ? 2 : 0 };
        p.power = p.shot;
        if (rar === "legendary") p.unlock = C.LEGEND_UNLOCK[i];
        out.push(p);
      }
    });
    return out;
  })();
  var BY = {}; C.PLAYERS.forEach(function (p) { BY[p.id] = p; });
  C.byId = BY;
  C.STARTERS = ["k0", "k1", "k2"];
  C.ORIGINALS = ["newton", "faraday", "curie", "tesla", "einstein", "bohr", "groove", "kai"]; // the classic cast: one joins after each completed season
  // Economy rates from the owner's Game Studio (1 = as designed). setRates keeps them in one place.
  C.COIN_RATE = 1; C.XP_RATE = 1;
  C.setRates = function (coins, xp) { C.COIN_RATE = +coins > 0 ? +coins : 1; C.XP_RATE = +xp > 0 ? +xp : 1; };
  C.rating = function (p, lvl) { var m = 1 + .02 * ((lvl || 1) - 1); return Math.round(((p.speed + p.jump + p.shot + p.header + p.defence + p.stamina) / 6) * m * 80); };

  /* ---------- special events and Legends modifiers ---------- */
  C.MODS = {
    night: { name: "Night match", arena: "night" }, rain: { name: "Rain", arena: "rain" }, snow: { name: "Snow", arena: "snow" },
    lowgrav: { name: "Low gravity", g: .6 }, giant: { name: "Giant ball", ball: 1.6 }, golden: { name: "Golden goal", golden: true },
    wind: { name: "Crosswind", wind: 1.6 }, quick: { name: "Short match", len: .66 }, fast: { name: "Fast ball", kick: 1.18 }
  };
  var MKEYS = Object.keys(C.MODS);

  /* ---------- club upgrades: bought once, kept for ever. They lift your whole squad, not one player. ---------- */
  C.UPGRADES = [
    { id: "power", name: "Boot tech", desc: "Harder kicks: +4% shot speed a level", per: .04, max: 5, base: 300 },
    { id: "speed", name: "Sprint coach", desc: "Faster running: +3% speed a level", per: .03, max: 5, base: 300 },
    { id: "jump", name: "Springboard", desc: "Higher jumps: +3% jump a level", per: .03, max: 5, base: 250 },
    { id: "header", name: "Heading drill", desc: "Bouncier headers: +4% a level", per: .04, max: 5, base: 280 },
    { id: "defence", name: "Defence unit", desc: "Shrug off hits: +4% defence a level", per: .04, max: 5, base: 280 },
    { id: "stamina", name: "Fitness lab", desc: "Superpowers charge 5% faster a level", per: .05, max: 5, base: 350 }
  ];
  C.upgrades = function (P) { var out = {}; C.UPGRADES.forEach(function (u) { out[u.id] = Math.max(0, Math.min(u.max, (P.upgrades || {})[u.id] || 0)); }); return out; };
  C.upgradeLevel = function (P, id) { return C.upgrades(P)[id]; };
  C.upgradeCost = function (P, id) { var u = C.UPGRADES.filter(function (q) { return q.id === id; })[0], l = C.upgradeLevel(P, id); if (!u || l >= u.max) return 0; return Math.round(u.base * Math.pow(l + 1, 1.35) / 10) * 10; };
  C.buyUpgrade = function (P, id) {
    var c = C.upgradeCost(P, id); if (!c || P.coins < c) return false;
    P.coins -= c; P.upgrades = P.upgrades || {}; P.upgrades[id] = C.upgradeLevel(P, id) + 1; return true;
  };
  // one multiplier per stat, for the match engine's character build
  C.upgradeMult = function (P, stat) {
    var out = 1, u = C.UPGRADES.filter(function (q) { return q.id === stat; })[0];
    if (!u) return out; return +(1 + u.per * C.upgradeLevel(P, stat)).toFixed(4);
  };

  /* ---------- outfits: club kits bought once, then swapped whenever you like ---------- */
  C.KITS = [
    { id: "k0", name: "Home green", c1: "#22c55e", c2: "#ffffff", price: 0 },
    { id: "k1", name: "Royal blue", c1: "#2563eb", c2: "#facc15", price: 250 },
    { id: "k2", name: "Crimson", c1: "#dc2626", c2: "#ffffff", price: 400 },
    { id: "k3", name: "Ultraviolet", c1: "#7c3aed", c2: "#f0abfc", price: 600 },
    { id: "k4", name: "Midnight gold", c1: "#0f172a", c2: "#f6c445", price: 900 },
    { id: "k5", name: "Sunset orange", c1: "#f97316", c2: "#1f2937", price: 900 },
    { id: "k6", name: "Ice teal", c1: "#0891b2", c2: "#ecfeff", price: 1200 },
    { id: "k7", name: "Away white", c1: "#ffffff", c2: "#16a34a", price: 1500 }
  ];
  C.kitById = function (id) { return C.KITS.filter(function (k) { return k.id === id; })[0] || null; };
  C.ownsKit = function (P, id) { return ((P && P.kits) || ["k0"]).indexOf(id) >= 0; };
  C.buyKit = function (P, id) { var k = C.kitById(id); if (!k || C.ownsKit(P, id) || P.coins < k.price) return false; P.coins -= k.price; P.kits = (P.kits || ["k0"]).concat([id]); return true; };
  C.equipKit = function (P, id) { var k = C.kitById(id); if (!k || !C.ownsKit(P, id)) return false; P.club.c1 = k.c1; P.club.c2 = k.c2; return true; };

  /* ---------- custom players: designed by the manager, signed with coins or a secret code ---------- */
  C.SKINS = ["#4a2e1c", "#6b4226", "#8d5a3b", "#a8714a", "#c68642", "#dcab80", "#e8c193"];
  C.HAIRS = ["#151515", "#2b1b12", "#3d2414", "#5a3a22", "#1a1a2e", "#7a4a2a", "#d9c07a"];
  C.CUSTOM_STYLES = ["band", "bun", "coily", "dj", "receding", "slick", "whiskers", "wig", "wild"];
  C.CUSTOM_MAX = 8; C.CUSTOM_NAME_MAX = 22; C.CUSTOM_BIO_MAX = 160;
  function onList(v, list, dflt) { return list.indexOf(v) >= 0 ? v : dflt; }
  function money(v, lo, hi) { v = Math.round(+v || 0); return Math.max(lo, Math.min(hi, v)); }
  C.customSpec = function (o) {
    o = o || {};
    var name = String(o.name || "New Signing").replace(/[<>]/g, "").slice(0, C.CUSTOM_NAME_MAX) || "New Signing";
    var power = C.POWERS[o.power] ? o.power : "curve";
    return { id: String(o.id || "").replace(/[^a-z0-9:_-]/gi, "").slice(0, 32), name: name,
      skin: onList(o.skin, C.SKINS, C.SKINS[2]), hair: onList(o.hair, C.HAIRS, C.HAIRS[0]), style: onList(o.style, C.CUSTOM_STYLES, "slick"),
      power: power, bio: String(o.bio || "").replace(/[<>]/g, "").slice(0, C.CUSTOM_BIO_MAX),
      price: money(o.price, 0, 20000), unlocked: !!o.unlocked, studio: !!o.studio,
      unlockHash: /^[0-9a-f]{64}$/.test(o.unlockHash || "") ? o.unlockHash : "" };
  };
  // a custom player as a match char: better with a bigger price tag, so signing feels worth it
  C.customPlayer = function (spec) {
    var base = .9 + Math.min(.34, (spec.price || 0) / 12000), m = C.POWERS[spec.power] || C.POWERS.curve;
    return { id: spec.id, name: spec.name, short: spec.name.split(" ")[0], nick: "Custom", fem: false, rarity: spec.studio ? "signature" : "custom",
      skin: spec.skin, hair: spec.hair, style: spec.style, eye: "#1a1010", coat: "#3b82f6", trim: "#ffffff", mass: 70,
      speed: base, jump: base, shot: base, header: base, defence: base, stamina: base, power: base, pw: spec.power,
      powerName: m.name, powerIdea: m.idea, cost: spec.price, need: 0, bio: spec.bio, custom: true, engine: m.engine };
  };
  C.custom = function (P, id) { var list = (P && P.custom) || []; for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
  C.customPlayerOf = function (P, id) { var s = C.custom(P, id); return s ? C.customPlayer(s) : null; };
  C.customList = function (P) { return ((P && P.custom) || []).slice(); };
  C.makeCustom = function (P, o) {
    P.custom = P.custom || [];
    if (P.custom.length >= C.CUSTOM_MAX) return null;
    o = o || {};
    var id = "x" + (P.custom.length + 1) + "-" + (hash(String(o.name || "") + (P.seed || 0) + P.custom.length) % 46656).toString(36);
    var spec = C.customSpec(Object.assign({}, o, { id: id })); P.custom.push(spec); return spec;
  };
  // the owner's studio characters: the look and the price can change, a signed player stays signed
  C.syncStudio = function (P, list) {
    if (!list || !list.length) return 0; P.custom = P.custom || [];
    list.forEach(function (o) {
      if (!o || !o.id) return;
      var had = C.custom(P, o.id), spec = C.customSpec(Object.assign({}, o, { id: o.id, studio: true }));
      if (had) { var keep = had.unlocked; for (var k in spec) had[k] = spec[k]; had.studio = true; if (keep) had.unlocked = true; }
      else P.custom.push(spec);
    });
    return P.custom.length;
  };
  C.customPrice = function (P, id) { var s = C.custom(P, id); return s && !s.unlocked ? s.price : 0; };
  C.signCustom = function (P, id) {
    var s = C.custom(P, id); if (!s || s.unlocked) return false;
    if (P.coins < (s.price || 0)) return false; P.coins -= s.price || 0; s.unlocked = true; return true;
  };
  C.unlockCustom = function (P, id) { var s = C.custom(P, id); if (!s) return false; s.unlocked = true; return true; };
  C.customOwned = function (P, id) { var s = C.custom(P, id); return !!(s && s.unlocked); };

  /* ---------- profile ---------- */
  C.VERSION = 1;
  C.create = function (o) {
    o = o || {}; var seed = hash((o.name || "Manager") + "|" + (o.club || "My Club") + "|" + (o.seed || 1));
    var P = { v: C.VERSION, seed: seed, name: String(o.name || "Manager").slice(0, 24), club: { name: String(o.club || "My Club FC").slice(0, 28), c1: o.c1 || "#22c55e", c2: o.c2 || "#ffffff", crest: o.crest || "shield" },
      level: 1, xp: 0, coins: 400, tier: 0, seasonNo: 0, matches: 0,
      stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, streak: 0, bestStreak: 0, seasonPts: 0, bestSeasonPts: 0 },
      cabinet: [], roster: {}, squad: C.STARTERS.slice(), originals: [], custom: [], kits: ["k0"], season: null, finalWon: false, legends: { rung: 0, best: 0, open: false },
      options: { len: 75, diff: 0, assists: true, powers: true, camera: "dynamic", commentary: true, guide: true }, upgrades: {}, history: [] };
    C.STARTERS.forEach(function (id) { P.roster[id] = { lvl: 1 }; });
    C.startSeason(P); return P;
  };
  // old saves: the classic cup's best round and favourite scientist carry over
  C.migrate = function (P, old) {
    old = old || {};
    if (!P || typeof P !== "object") P = C.create({ name: old.name || "Manager", club: old.club });
    if (!P.v || P.v < 1) { P.v = 1; }
    P.options = Object.assign({ len: 75, diff: 0, assists: true, powers: true, camera: "dynamic", commentary: true, guide: true }, P.options || {});
    P.upgrades = Object.assign({}, P.upgrades || {});
    P.legends = Object.assign({ rung: 0, best: 0, open: false }, P.legends || {});
    P.originals = P.originals || []; P.cabinet = P.cabinet || []; P.history = P.history || []; P.custom = (P.custom || []).map(C.customSpec);
    P.kits = (P.kits || ["k0"]).filter(function (id) { return !!C.kitById(id); }); if (!P.kits.length) P.kits = ["k0"];
    if (old.cupBest >= 6 && !P.cabinet.some(function (t) { return t.id === "classic"; })) { P.cabinet.push({ id: "classic", name: "Classic Momentum Cup", season: 0, tier: -1 }); P.coins += 500; }
    if (old.fav && C.ORIGINALS.indexOf(old.fav) >= 0 && P.originals.indexOf(old.fav) < 0) P.originals.push(old.fav);
    if (!P.season) C.startSeason(P);
    return P;
  };

  /* ---------- seasons: 10 league matches, a 4-round cup and one special event, interleaved ---------- */
  function leagueClubs(P) { var t = P.tier, pool = C.CLUBS.filter(function (c) { return c.tier === t; }); var drop = pool[(P.seasonNo * 7 + P.seed) % pool.length]; return pool.filter(function (c) { return c !== drop; }); }
  C.startSeason = function (P) {
    var r = rng(P.seed + P.seasonNo * 977), clubs = leagueClubs(P), ids = ["you"].concat(clubs.map(function (c) { return c.id; }));
    var table = {}; ids.forEach(function (id) { table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
    // double round robin (circle method) for six teams: 10 rounds
    var rounds = [], arr = ids.slice();
    for (var rd = 0; rd < 5; rd++) { var pairs = []; for (var i = 0; i < 3; i++) pairs.push([arr[i], arr[5 - i]]); rounds.push(pairs); arr.splice(1, 0, arr.pop()); }
    rounds = rounds.concat(rounds.map(function (ps) { return ps.map(function (p) { return [p[1], p[0]]; }); }));
    var fixtures = [];
    rounds.forEach(function (ps, i) { var mine = ps.filter(function (p) { return p[0] === "you" || p[1] === "you"; })[0]; fixtures.push({ type: "league", round: i, opp: mine[0] === "you" ? mine[1] : mine[0], home: mine[0] === "you", pairs: ps }); });
    var cupPool = C.CLUBS.filter(function (c) { return c.tier === P.tier || c.tier === Math.min(4, P.tier + 1); });
    var cupNames = ["Cup round 1", "Cup quarter-final", "Cup semi-final", "Cup final"], cup = [];
    for (var k = 0; k < 4; k++) cup.push({ type: "cup", round: k, name: cupNames[k], opp: cupPool[Math.floor(r() * cupPool.length)].id, home: k % 2 === 0, knock: true });
    var ev = { type: "event", name: "Special event", opp: clubs[Math.floor(r() * clubs.length)].id, mods: [MKEYS[Math.floor(r() * MKEYS.length)]] };
    // interleave: cup ties after league rounds 2, 4, 7, 9; the special event after round 5
    var list = []; fixtures.forEach(function (f, i) { list.push(f); if (i === 1) list.push(cup[0]); if (i === 3) list.push(cup[1]); if (i === 4) list.push(ev); if (i === 6) list.push(cup[2]); if (i === 8) list.push(cup[3]); });
    list.forEach(function (f, i) { f.i = i; f.done = false; if (!f.mods) f.mods = r() < .18 ? [["night", "rain", "snow", "wind"][Math.floor(r() * 4)]] : []; });
    P.season = { no: P.seasonNo, tier: P.tier, table: table, list: list, at: 0, cupAlive: true, done: false };
    return P.season;
  };
  C.next = function (P) {
    var s = P.season; if (!s || s.done) return null;
    while (s.at < s.list.length && (s.list[s.at].done || (s.list[s.at].type === "cup" && !s.cupAlive))) { if (!s.list[s.at].done) s.list[s.at].skipped = true; s.list[s.at].done = true; s.at++; }
    return s.list[s.at] || null;
  };
  C.squadPower = function (P) {
    var ps = P.squad.map(function (id) { return C.player(P, id); }).filter(Boolean);
    if (!ps.length) return 1; var sum = 0; ps.forEach(function (p) { sum += C.rating(p, (P.roster[p.id] || {}).lvl) / 80; });
    var up = C.upgrades(P), bonus = 0; C.UPGRADES.forEach(function (u) { bonus += up[u.id]; });
    return (sum / ps.length) * (1 + bonus * .01); // club upgrades lift the whole squad, so they show in the odds
  };
  C.upgradeTotal = function (P) { var up = C.upgrades(P), n = 0; C.UPGRADES.forEach(function (u) { n += up[u.id]; }); return n; };
  C.player = function (P, id) { return BY[id] || C.customPlayerOf(P, id) || (C.ORIGINALS.indexOf(id) >= 0 && P.originals.indexOf(id) >= 0 ? { id: id, original: true } : null); };
  // what the match engine needs for a fixture: opponent club, its player, skill, stat multiplier, modifiers and arena
  C.opponent = function (P, f) {
    var club = clubById(f.opp), t = C.TIERS[Math.min(4, P.tier)], leg = f.type === "legends", grand = f.type === "grand";
    var r = rng(P.seed + P.seasonNo * 131 + (f.i || 0) * 17 + (leg ? f.rung * 7919 : 0));
    var pool = C.PLAYERS.filter(function (p) { return p.rarity !== "legendary"; }), base = pool[Math.floor(r() * pool.length)];
    var tierBoost = club ? (club.rating - .9) * .5 : .3, cupBoost = f.type === "cup" ? f.round * .02 : 0;
    var skill = grand ? .97 : leg ? Math.min(1.3, .9 + f.rung * .006) : clamp(t.skill + tierBoost * .25 + cupBoost + (P.seasonNo % 3) * .01, .2, .98);
    var stat = grand ? 1.22 : leg ? 1.14 + Math.min(50, f.rung) * .006 + Math.max(0, f.rung - 50) * .002 : t.stat + tierBoost * .1;
    skill = clamp(skill + (P.options.diff || 0) * .08, .15, leg ? 1.3 : 1); stat = Math.max(.8, stat + (P.options.diff || 0) * .03);
    var arena = f.mods.map(function (m) { return C.MODS[m] && C.MODS[m].arena; }).filter(Boolean)[0] || (grand ? "void" : leg ? ["grand", "night", "void", "sunset"][f.rung % 4] : t.arena);
    return { club: grand ? C.VILLAIN_CLUB : club, base: grand ? null : base, skill: skill, stat: stat, mods: f.mods.slice(), arena: arena, villain: grand };
  };
  C.odds = function (P, f) { var o = C.opponent(P, f), me = C.squadPower(P) * (1 + .004 * Math.min(40, P.level)), them = o.stat * (.8 + o.skill * .3); var d = me - them; return { win: Math.round(clamp(.5 + d * 1.2, .06, .9) * 100), opp: o }; };

  /* ---------- results, rewards and the season's end ---------- */
  function simGoals(r, a, b) { // rating-weighted goal counts for matches the player does not play
    var lam = 1.6 * Math.pow(a / b, 1.8); var g = 0, L = Math.exp(-lam), p = 1; do { g++; p *= r(); } while (p > L && g < 9); return g - 1;
  }
  function addRes(tab, a, b, ga, gb) {
    var A = tab[a], B = tab[b]; A.p++; B.p++; A.gf += ga; A.ga += gb; B.gf += gb; B.ga += ga;
    if (ga > gb) { A.w++; B.l++; A.pts += 3; } else if (ga < gb) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
  }
  C.sorted = function (tab) { return Object.keys(tab).sort(function (a, b) { var A = tab[a], B = tab[b]; return B.pts - A.pts || (B.gf - B.ga) - (A.gf - A.ga) || B.gf - A.gf || (a < b ? -1 : 1); }); };
  C.levelFor = function (xp) { return Math.floor(Math.sqrt(xp / 120)) + 1; };
  // record a played match; returns rewards and events (promotion, trophies, unlocks) for the screens to show
  C.record = function (P, f, gf, ga, o) {
    o = o || {}; var s = P.season, t = C.TIERS[Math.min(4, P.tier)], win = gf > ga, draw = gf === ga, ev = [];
    var mult = f.type === "legends" ? Math.min(2.5, 1.5 + f.rung * .02) : f.type === "grand" ? 4 : f.type === "cup" ? 1.2 + f.round * .15 : f.type === "event" ? 1.3 : 1;
    var coins = Math.round(t.coins * mult * (win ? 1 + Math.min(4, gf - ga) * .1 : draw ? .45 : .2)) * C.COIN_RATE;
    coins = Math.round(coins / 10) * 10;
    var xp = Math.round((40 + gf * 12 + (win ? 30 : 0)) * (1 + P.tier * .15) * C.XP_RATE);
    if (o.cheated && !o.boards) { coins = Math.round(coins * .25); }
    P.coins += coins; P.xp += xp; var lv = C.levelFor(P.xp); if (lv > P.level) { ev.push({ kind: "level", level: lv }); P.level = lv; }
    var S = P.stats; S.played++; S.gf += gf; S.ga += ga; P.matches++;
    if (win) { S.won++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); } else { S.streak = 0; if (draw) S.drawn++; else S.lost++; }
    f.done = true; f.res = [gf, ga];
    if (f.type === "league") {
      addRes(s.table, "you", f.opp, gf, ga);
      var r = rng(P.seed + s.no * 31 + f.round * 7);
      f.pairs.forEach(function (pr) { if (pr[0] === "you" || pr[1] === "you") return; var A = clubById(pr[0]).rating, B = clubById(pr[1]).rating; addRes(s.table, pr[0], pr[1], simGoals(r, A, B), simGoals(r, B, A)); });
      S.seasonPts = s.table.you.pts;
    }
    if (f.type === "cup") { if (!win) { s.cupAlive = false; ev.push({ kind: "cupOut", name: C.TIERS[s.tier].cup }); } else if (f.round === 3) { ev.push(trophy(P, "cup", C.TIERS[s.tier].cup)); } }
    if (f.type === "grand") { if (win) { P.finalWon = true; P.legends.open = true; ev.push(trophy(P, "grand", "The Grand Final")); } }
    if (f.type === "legends") { if (win) { P.legends.rung++; P.legends.best = Math.max(P.legends.best, P.legends.rung); ev.push({ kind: "rung", rung: P.legends.rung }); } }
    if (f.type !== "legends" && f.type !== "grand") { s.at = Math.max(s.at, f.i + 1); if (!C.next(P)) ev = ev.concat(C.endSeason(P)); }
    ev = ev.concat(C.unlocks(P));
    P.history.push({ s: P.seasonNo, t: f.type, opp: f.opp, r: [gf, ga] }); if (P.history.length > 60) P.history.shift();
    return { coins: coins, xp: xp, events: ev };
  };
  function trophy(P, kind, name) { var t = { id: kind + "-" + P.seasonNo + "-" + (P.season ? P.season.tier : 0), kind: kind, name: name, season: P.seasonNo + 1, tier: P.season ? P.season.tier : P.tier }; P.cabinet.push(t); P.coins += kind === "grand" ? 3000 : kind === "league" ? 800 + P.tier * 400 : 500 + P.tier * 250; return { kind: "trophy", trophy: t }; }
  C.endSeason = function (P) {
    var s = P.season, ord = C.sorted(s.table), pos = ord.indexOf("you") + 1, ev = [{ kind: "seasonEnd", pos: pos, tier: s.tier, pts: s.table.you.pts }];
    P.stats.bestSeasonPts = Math.max(P.stats.bestSeasonPts, s.table.you.pts);
    if (pos === 1) ev.push(trophy(P, "league", C.TIERS[s.tier].name + " champions"));
    if (pos <= 2 && P.tier < 4) { P.tier++; ev.push({ kind: "promoted", tier: P.tier }); }
    else if (pos === 1 && P.tier === 4 && !P.finalWon) { P.grandDue = true; ev.push({ kind: "grandFinal" }); }
    else if (pos === 6 && P.tier > 0) { P.tier--; ev.push({ kind: "relegated", tier: P.tier }); }
    s.done = true; s.pos = pos;
    var orig = C.ORIGINALS.filter(function (id) { return P.originals.indexOf(id) < 0; })[0]; if (orig) { P.originals.push(orig); ev.push({ kind: "original", id: orig }); }
    P.seasonNo++; C.startSeason(P);
    return ev;
  };
  C.grandFinal = function (P) { return P.grandDue && !P.finalWon ? { type: "grand", name: "The Grand Final", opp: "entropy", mods: ["golden"], i: 999 } : null; };
  C.legendsFixture = function (P) {
    if (!P.legends.open) return null; var n = P.legends.rung, r = rng(P.seed + n * 104729), k = Math.min(4, 1 + Math.floor(n / 5)), mods = [], pool = MKEYS.slice();
    for (var i = 0; i < k; i++) mods.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return { type: "legends", rung: n, name: "Legends rung " + (n + 1), opp: C.CLUBS[Math.floor(r() * 30)].id, mods: mods, i: 1000 + n };
  };
  // players earned by progress: legends by achievement, rares and epics become scoutable as you climb
  C.unlocks = function (P) {
    var ev = [];
    C.PLAYERS.forEach(function (p) {
      if (P.roster[p.id] || !p.unlock) return; var u = p.unlock, ok = false;
      if (u.kind === "trophy") ok = P.cabinet.some(function (t) { return t.kind === "league" && t.tier === u.tier; });
      if (u.kind === "goals") ok = P.stats.gf >= u.n; if (u.kind === "streak") ok = P.stats.bestStreak >= u.n; if (u.kind === "legends") ok = P.legends.best >= u.n;
      if (ok) { P.roster[p.id] = { lvl: 1 }; ev.push({ kind: "unlock", id: p.id }); }
    });
    return ev;
  };
  C.scoutable = function (P, p) { return !P.roster[p.id] && p.rarity !== "legendary" && P.tier >= p.need; };
  C.scout = function (P, id) { var p = BY[id]; if (!p || !C.scoutable(P, p) || P.coins < p.cost) return false; P.coins -= p.cost; P.roster[id] = { lvl: 1 }; return true; };
  C.trainCost = function (P, id) { var p = BY[id], r = P.roster[id]; if (!p || !r || r.lvl >= 10) return 0; return Math.round(150 * r.lvl * RARITY[p.rarity].mult / 10) * 10; };
  C.train = function (P, id) { var c = C.trainCost(P, id); if (!c || P.coins < c) return false; P.coins -= c; P.roster[id].lvl++; return true; };
  C.setSquad = function (P, ids) { ids = ids.filter(function (id, i) { return ids.indexOf(id) === i && (P.roster[id] || P.originals.indexOf(id) >= 0 || C.customOwned(P, id)); }).slice(0, 3); if (!ids.length) return false; P.squad = ids; return true; };
  // world ranking: every club by tier and rating, with the player's club placed by its tier, level and trophies
  C.ranking = function (P) {
    var me = { id: "you", name: P.club.name, score: P.tier * 100 + C.squadPower(P) * 40 + P.cabinet.length * 6 + P.level };
    var all = C.CLUBS.map(function (c) { return { id: c.id, name: c.name, score: c.tier * 100 + c.rating * 40 }; }).concat([me]);
    all.sort(function (a, b) { return b.score - a.score; }); return all;
  };

  /* ---------- a bot career, for tests and tuning: the bot's win chance follows the same odds the player sees ---------- */
  C.simulate = function (seed, botSkill, cap) {
    var P = C.create({ name: "Bot", club: "Bot FC", seed: seed }), r = rng(seed * 13 + 7), curve = [], grandAt = 0, trainEvery = 4;
    for (var n = 0; n < (cap || 400); n++) {
      var f = C.grandFinal(P) || (P.finalWon && n % 2 ? C.legendsFixture(P) : null) || C.next(P); if (!f) break;
      var od = C.odds(P, f), pw = clamp(od.win / 100 + botSkill, .03, .97), roll = r();
      var gf, ga; if (roll < pw) { ga = Math.floor(r() * 3); gf = ga + 1 + Math.floor(r() * 2); } else if (roll < pw + .12 && f.type === "league") { gf = ga = Math.floor(r() * 3); } else { gf = Math.floor(r() * 3); ga = gf + 1 + Math.floor(r() * 2); }
      if (f.knock && gf === ga) gf++;
      C.record(P, f, gf, ga);
      if (f.type === "grand" && gf > ga) grandAt = P.matches;
      // spend coins like a sensible player: train the squad, then scout the best affordable player
      if (n % trainEvery === 0) { P.squad.forEach(function (id) { if (BY[id]) C.train(P, id); }); var best = C.PLAYERS.filter(function (p) { return C.scoutable(P, p) && p.cost <= P.coins; }).sort(function (a, b) { return C.rating(b) - C.rating(a); })[0]; if (best && C.rating(best) > Math.min.apply(null, P.squad.map(function (id) { return BY[id] ? C.rating(BY[id], P.roster[id].lvl) : 99; }))) { C.scout(P, best.id); P.squad = P.squad.slice(0, 2).concat([best.id]); } }
      curve.push({ m: P.matches, tier: P.tier, skill: +od.opp.skill.toFixed(3), stat: +od.opp.stat.toFixed(3), coins: P.coins, level: P.level });
    }
    return { P: P, curve: curve, grandAt: grandAt };
  };
  return C;
});
