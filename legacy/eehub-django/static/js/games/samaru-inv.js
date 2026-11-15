/* Freshers School Life — Pockets: a Minecraft-style inventory of stacks in slots.
   Counts stay canonical in P.inv ({ id: count }), the dictionary every other module already reads and writes
   (the story's parts, gifts, quest items). P.pockets.slots is only the layout: which stack sits in which slot.
   Z.inv.sync() reconciles the two, so a story step that does P.inv.cement = 3 still shows up in a slot.
   Tools and quest items (torch, slipper, calculator, airtime, the story's quest items) never take a slot and can
   never be dropped: they sit in the "On you" row. Capacity: 15 slots, +1 every two levels (to +10 at level 21),
   +5 with the school backpack, so 30 at most. API for other modules (documented in docs/story/ENGINE.md §14):
     Z.inv.add(id, n) → how many went in · has(id, n) · count(id) · take(id, n) → bool (all or nothing)
     Z.inv.give(npcId, id) → friendship gained, or false · Z.inv.fits(id, n) · Z.inv.def(id) · Z.inv.register(id, def)
     Z.inv.use(id) · Z.inv.drop(slot, n) · Z.inv.open() / close() / toggle()
   Nothing touches the DOM at load time; the panel is built the first time it opens in a real browser. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData; if (!Z) return;
  var I = Z.inv = {}, BASE = 15, MAXCAP = 30, BAG_SLOTS = 5, BAG_PRICE = 4500, DESPAWN = 300, COLS = 5;

  /* ---------- the catalogue ---------- */
  // kind: food | drink | ingr (cooking) | mat (raw material) | gift | collect | tool | key. Food values restore stats.
  var IT = I.ITEMS = {
    edrink: { name: "Energy drink", kind: "drink", price: 450, energy: 35, hunger: 2, icon: "can", col: "#16a34a", text: "Cold and fizzy. Wakes you up for real." },
    water: { name: "Sachet water", kind: "drink", price: 20, energy: 6, hunger: 3, hp: 2, stack: 10, icon: "sachet", col: "#38bdf8", text: "Pure water. Bite the corner, squeeze, done." },
    puffpuff: { name: "Puff-puff (5)", kind: "food", price: 200, hunger: 18, energy: 6, icon: "puff", col: "#d97706", text: "Five warm balls of happiness in a paper bag." },
    bread: { name: "Agege bread", kind: "food", price: 400, hunger: 26, energy: 6, icon: "loaf", col: "#f59e0b", text: "Soft, heavy, and it lasts all day." },
    suya: { name: "Suya wrap", kind: "food", price: 500, hunger: 35, energy: 4, icon: "skewer", col: "#b45309", text: "Spicy grilled beef in newspaper. Pepper included." },
    garri: { name: "Garri pack", kind: "food", price: 300, hunger: 30, energy: 4, icon: "sack", col: "#fef3c7", text: "Soak it, drink it, survive sapa. Every student's backup plan." },
    indomie: { name: "Indomie pack", kind: "food", price: 250, hunger: 16, energy: 2, icon: "noodles", col: "#facc15", text: "Raw and crunchy now, much better cooked. Also a cooking ingredient." },
    kunu: { name: "Kunu", kind: "drink", price: 250, hunger: 10, energy: 10, icon: "bottle", col: "#f5f5dc", text: "Millet drink, cold from the cooler." },
    zobo: { name: "Zobo", kind: "drink", price: 200, hunger: 5, energy: 12, icon: "bottle", col: "#9f1239", text: "Hibiscus, ginger, a little pineapple." },
    meatpie: { name: "Meat pie", kind: "food", price: 300, hunger: 20, icon: "pie", col: "#f59e0b", text: "Flaky pastry, minced meat, one potato cube." },
    voltmalt: { name: "Malt drink", kind: "drink", price: 500, hunger: 5, energy: 40, icon: "can", col: "#78350f", text: "Sweet malt. Big energy." },
    kilishi: { name: "Kilishi pack", kind: "food", gift: true, price: 700, hunger: 30, energy: 5, icon: "strips", col: "#7c2d12", text: "Dried spiced beef. A snack or a very good gift." },
    corn: { name: "Roasted corn", kind: "food", price: 150, hunger: 12, icon: "corn", col: "#eab308", text: "Charred on the coals by the roadside." },
    kosai: { name: "Kosai", kind: "food", price: 200, hunger: 15, icon: "puff", col: "#ca8a04", text: "Bean cakes, crisp outside." },
    masa: { name: "Masa", kind: "food", price: 300, hunger: 25, icon: "puff", col: "#fde68a", text: "Rice cakes with a little pepper sauce." },
    fura: { name: "Fura da nono", kind: "drink", price: 400, hunger: 25, energy: 10, icon: "bottle", col: "#fefce8", text: "Millet balls in fresh milk. Filling." },
    // cooking ingredients (the story's cooking missions take these)
    rice: { name: "Rice (small bag)", kind: "ingr", price: 900, icon: "sack", col: "#f8fafc", text: "For cooking. Jollof does not make itself." },
    oil: { name: "Groundnut oil", kind: "ingr", price: 600, icon: "jar", col: "#fbbf24", text: "For cooking." },
    pepper: { name: "Pepper", kind: "ingr", price: 150, icon: "veg", col: "#dc2626", text: "Scotch bonnet. Handle with respect." },
    tomato: { name: "Tomatoes", kind: "ingr", price: 200, icon: "veg", col: "#ef4444", text: "For stew." },
    onion: { name: "Onions", kind: "ingr", price: 150, icon: "veg", col: "#c084fc", text: "For everything." },
    egg: { name: "Eggs", kind: "ingr", price: 100, icon: "egg", col: "#fef3c7", text: "Boil one with your Indomie." },
    spice: { name: "Seasoning cubes", kind: "ingr", price: 50, stack: 16, icon: "cube", col: "#f97316", text: "The secret of every mama put." },
    // raw materials for missions and the workshop
    wood: { name: "Planks", kind: "mat", price: 600, stack: 16, icon: "planks", col: "#a16207", text: "Raw material for building and repairs." },
    sand: { name: "Sand", kind: "mat", price: 300, stack: 16, icon: "pile", col: "#d6b370", text: "Raw material. A bag of it, somehow in your pocket." },
    cement: { name: "Cement", kind: "mat", price: 1200, stack: 16, icon: "sack", col: "#9ca3af", text: "Raw material for building." },
    cable: { name: "Copper cable", kind: "mat", price: 800, stack: 16, icon: "coil", col: "#ea580c", text: "Raw material for the workshop and repairs." },
    nails: { name: "Nails", kind: "mat", price: 150, stack: 16, icon: "nails", col: "#94a3b8", text: "Raw material." },
    paint: { name: "Paint tin", kind: "mat", price: 900, stack: 16, icon: "tin", col: "#2563eb", text: "Raw material." },
    tape: { name: "Insulating tape", kind: "mat", price: 100, stack: 16, icon: "tape", col: "#111827", text: "Raw material. Fixes almost anything for a while." },
    bulb: { name: "Bulb", kind: "mat", price: 300, stack: 16, icon: "bulb", col: "#fde047", text: "Raw material." },
    cell: { name: "Battery cell", kind: "mat", price: 400, stack: 16, icon: "cell", col: "#16a34a", text: "Raw material for the workshop." },
    fabric: { name: "Ankara fabric", kind: "mat", price: 1500, stack: 16, icon: "cloth", col: "#7c3aed", text: "Raw material for the tailor." },
    // gifts
    flowers: { name: "Flowers", kind: "gift", price: 800, icon: "flowers", col: "#f472b6", text: "A small bunch from the market. Somebody will smile." },
    chocolate: { name: "Chocolate", kind: "gift", price: 600, hunger: 8, energy: 6, icon: "bar", col: "#78350f", text: "A gift, or a snack if nobody is looking." },
    perfume: { name: "Perfume oil", kind: "gift", price: 1500, icon: "perfume", col: "#a855f7", text: "A gift. Smells expensive." },
    notebook: { name: "Notebook", kind: "gift", price: 400, icon: "book", col: "#0ea5e9", text: "A gift for a hard-working friend." },
    novel: { name: "Novel", kind: "gift", price: 900, icon: "book", col: "#be123c", text: "A gift for a reader." },
    scarf: { name: "Ankara scarf", kind: "gift", price: 1200, icon: "cloth", col: "#ea580c", text: "A gift. Bright and soft." },
    voltshard: { name: "Volt shard", kind: "collect", icon: "gem", col: "#a78bfa", text: "It hums when you hold it." },
    // tools: on your belt, never dropped
    torch: { name: "Torch", kind: "tool", icon: "torch", col: "#fde047" }, slipper: { name: "Mama's slipper", kind: "tool", icon: "slipper", col: "#f97316" },
    calculator: { name: "Scientific calculator", kind: "tool", icon: "calc", col: "#475569" }, airtime: { name: "Airtime", kind: "tool", icon: "sim", col: "#22c55e" }
  };
  var STACK = { food: 8, drink: 8, ingr: 8, mat: 16, gift: 4, collect: 16, misc: 8 };
  // a menu item at a food place that packs well, by D.FOOD id → pocket id
  var PACK = { suya: "suya", kilishi: "kilishi", corn: "corn", meatpie: "meatpie", kosai: "kosai", masa: "masa", zobo: "zobo", kunu: "kunu", water: "water", voltmalt: "voltmalt", fura: "fura" };
  // what each counter sells into your pockets (place id first, then by role)
  var SHOPS = {
    market: ["puffpuff", "garri", "bread", "edrink", "water", "flowers", "rice", "oil", "pepper", "tomato", "onion", "egg", "spice", "wood", "nails", "paint", "cement", "fabric", "@bag", "@phone"],
    buka: ["puffpuff", "garri", "water", "@pack"], shayi: ["bread", "indomie", "egg", "water", "@pack"], p2canteen: ["puffpuff", "bread", "water", "@pack"], stalls: ["puffpuff", "water", "@pack"],
    shinkafi: ["edrink", "chocolate", "@pack"], pepsi: ["edrink", "puffpuff", "@pack"], social: ["edrink", "puffpuff", "@pack"],
    bookshop: ["edrink", "water", "bread", "indomie", "chocolate", "tape", "bulb", "cell", "cable", "@bag", "@phone"],
    p2shops: ["edrink", "water", "bread", "indomie", "garri", "chocolate", "tape", "bulb", "cell", "@bag", "@phone"],
    mk_gifts: ["flowers", "chocolate", "perfume", "scarf", "novel", "notebook"], mk_food: ["edrink", "@pack"], mk_supermarket: ["edrink", "water", "bread", "indomie", "garri", "rice", "oil", "spice", "chocolate", "@bag"], mk_electronics: ["cable", "bulb", "cell", "tape", "@phone"], mk_phones: ["@phone"]
  };
  I.SHOPS = SHOPS;
  I.register = function (id, def) { if (id && def && typeof def === "object") IT[id] = def; return IT[id]; }; // the story can add its own materials and gifts
  I.def = function (id) {
    var d = IT[id], it = D.ITEMS && D.ITEMS[id], f = D.FOOD && D.FOOD[id];
    if (d) return d;
    if (it) { var kind = it.quest ? "key" : it.gift ? "gift" : it.price ? "misc" : "collect"; return (IT[id] = { name: it.name || id, kind: kind, price: it.price || 0, text: it.text || "", icon: it.quest ? "key" : it.gift ? "box" : "box", col: it.quest ? "#fbbf24" : "#64748b", from: "data" }); }
    if (f) return (IT[id] = { name: f.name, kind: "food", price: f.price, hunger: f.hunger, energy: f.energy, hp: f.hp, icon: "puff", col: "#d97706", text: "" });
    return { name: String(id), kind: "misc", icon: "box", col: "#64748b", text: "", unknown: true };
  };
  function slotted(id) { var k = I.def(id).kind; return k !== "tool" && k !== "key"; }
  function stackOf(id) { var d = I.def(id); return d.stack || STACK[d.kind] || 8; }
  I.stackOf = stackOf;
  I.droppable = function (id) { return slotted(id); };
  I.edible = function (id) { var d = I.def(id); return !!(d.hunger || d.energy || d.hp) && d.kind !== "ingr" && d.kind !== "mat"; };

  /* ---------- state, capacity, migration ---------- */
  function P() { return Z.P; }
  I.state = function (p) {
    p = p || P(); if (!p) return null; if (!p.inv || typeof p.inv !== "object") p.inv = {};
    var s = p.pockets; if (!s || typeof s !== "object") s = p.pockets = {};
    if (!Array.isArray(s.slots)) s.slots = []; if (!(s.bag >= 0)) s.bag = 0; if (!s.hint || typeof s.hint !== "object") s.hint = {}; if (!s.gift || typeof s.gift !== "object") s.gift = {};
    if (!s.tut || typeof s.tut !== "object") s.tut = { s: 0 };
    return s;
  };
  I.capacity = function (p) { p = p || P(); if (!p) return BASE; var s = I.state(p); return Math.min(MAXCAP, BASE + Math.min(10, Math.floor(((p.lvl || 1) - 1) / 2)) + (s.bag ? BAG_SLOTS : 0)); };
  I.KIT = [["edrink", 2], ["water", 2], ["puffpuff", 1], ["bread", 1]];
  // every save gets the starter kit once (fresh students, and old saves the first time they load with pockets)
  I.ensure = function (p) {
    p = p || P(); if (!p) return null; var s = I.state(p), fresh = !s.v; s.v = 1;
    if (!s.kit) { s.kit = 1; I.KIT.forEach(function (k) { p.inv[k[0]] = (p.inv[k[0]] || 0) + k[1]; }); if (!fresh || p.day > 1 || (p.m && p.m.done && Object.keys(p.m.done).length)) s.tut.old = 1; }
    if (s.lastCap == null) s.lastCap = I.capacity(p);
    I.sync(p); return s;
  };

  /* ---------- keeping slots and counts in step ---------- */
  function sumSlots(s, id) { var n = 0; for (var i = 0; i < s.slots.length; i++) if (s.slots[i] && s.slots[i].id === id) n += s.slots[i].n; return n; }
  function placeIn(s, id, n, cap, overflow) { // stack onto matching slots, then the first empty slots; overflow past cap only when told to
    var mx = stackOf(id), i, sl, put = 0;
    for (i = 0; i < s.slots.length && n > 0; i++) { sl = s.slots[i]; if (sl && sl.id === id && sl.n < mx) { var k = Math.min(n, mx - sl.n); sl.n += k; n -= k; put += k; } }
    for (i = 0; n > 0 && (i < cap || overflow); i++) { if (i >= s.slots.length) s.slots.push(null); if (!s.slots[i]) { var q = Math.min(n, mx); s.slots[i] = { id: id, n: q }; n -= q; put += q; } if (i > 400) break; }
    return put;
  }
  function removeFrom(s, id, n) { for (var i = s.slots.length - 1; i >= 0 && n > 0; i--) { var sl = s.slots[i]; if (sl && sl.id === id) { var k = Math.min(n, sl.n); sl.n -= k; n -= k; if (sl.n <= 0) s.slots[i] = null; } } }
  function trim(s, cap) { while (s.slots.length > cap && !s.slots[s.slots.length - 1]) s.slots.pop(); while (s.slots.length < cap) s.slots.push(null); }
  I.sync = function (p) {
    p = p || P(); if (!p) return; var s = I.state(p), cap = I.capacity(p), id, have = {};
    for (var i = 0; i < s.slots.length; i++) { var sl = s.slots[i]; if (sl && (!sl.id || !(sl.n > 0) || !slotted(sl.id))) s.slots[i] = null; else if (sl) have[sl.id] = 1; }
    for (id in p.inv) { var want = Math.max(0, Math.floor(+p.inv[id] || 0)); if (!slotted(id)) continue; var got = sumSlots(s, id); if (got < want) placeIn(s, id, want - got, cap, true); else if (got > want) removeFrom(s, id, got - want); delete have[id]; }
    for (id in have) removeFrom(s, id, 1e9);
    trim(s, cap);
  };
  I.used = function (p) { var s = I.state(p); return s.slots.filter(Boolean).length; };
  I.over = function (p) { var s = I.state(p), cap = I.capacity(p); for (var i = cap; i < s.slots.length; i++) if (s.slots[i]) return true; return false; };

  /* ---------- the API other modules use ---------- */
  I.count = function (id) { var p = P(); return p && p.inv ? Math.max(0, Math.floor(+p.inv[id] || 0)) : 0; };
  I.has = function (id, n) { return I.count(id) >= (n == null ? 1 : n); };
  I.fits = function (id, n) { var p = P(); if (!p) return 0; if (!slotted(id)) return n; I.sync(p); var s = I.state(p), cap = I.capacity(p), mx = stackOf(id), room = 0; for (var i = 0; i < cap; i++) { var sl = s.slots[i]; room += !sl ? mx : sl.id === id ? Math.max(0, mx - sl.n) : 0; } return Math.min(n, room); };
  I.add = function (id, n, opt) { // → how many went in (tools and quest items always fit)
    var p = P(); if (!p || !id) return 0; n = Math.max(0, Math.floor(n == null ? 1 : n)); if (!n) return 0; opt = opt || {}; I.state(p);
    if (!slotted(id)) { p.inv[id] = I.count(id) + n; return n; }
    var k = opt.force ? n : I.fits(id, n); if (k > 0) { p.inv[id] = I.count(id) + k; placeIn(I.state(p), id, k, I.capacity(p), !!opt.force); }
    if (k < n && !opt.quiet) full(I.def(id).name, n - k); I.dirty = 1; return k;
  };
  I.take = function (id, n) { var p = P(); n = n == null ? 1 : n; if (!p || I.count(id) < n) return false; p.inv[id] = I.count(id) - n; if (slotted(id)) removeFrom(I.state(p), id, n); I.dirty = 1; return true; };
  function full(name, left) { toast("<b>Your pockets are full.</b> " + (left > 1 ? left + " × " : "") + esc(name) + " did not fit. Eat, drop or gift something" + (I.state().bag ? "." : ", or buy a school backpack at the market (+5 slots).")); sfx("block"); I.flashFull = 1.2; }

  /* ---------- using things ---------- */
  function lowNote() { var p = P(); return p ? "" : ""; }
  I.use = function (id, why) {
    var p = P(), d = I.def(id), me = Z.me; if (!p || !I.has(id)) return false;
    if (!I.edible(id)) { if (d.kind === "tool") { if (id === "torch" && me) { me.torch = !me.torch; sfx("click"); return true; } toast("<b>" + esc(d.name) + "</b>: " + esc(d.text || (D.ITEMS[id] || {}).text || "Always with you.")); return false; } toast(esc(d.name) + ": " + (d.kind === "gift" ? "give it to someone (Gift)." : d.kind === "mat" ? "a raw material. Missions and the workshop use it." : d.kind === "ingr" ? "a cooking ingredient." : "nothing to do with it here.")); return false; }
    if (me && me.veh && Math.abs(me.veh.speed || 0) > 3) { toast("Stop first, then eat."); return false; }
    I.take(id, 1); var hb = p.hunger, eb = p.energy;
    p.hunger = Math.min(100, (p.hunger || 0) + (d.hunger || 0)); p.energy = Math.min(100, (p.energy || 0) + (d.energy || 0)); p.hp = Math.min(p.maxHp || 100, (p.hp || 0) + (d.hp || 0) + 3);
    if (me) { me.eatT = 1.3; me.eatK = d.kind; if (me.sit === false && me.emote === "dance") me.emote = ""; }
    sfx("power"); try { if (Z.float && me) Z.float(me.x, me.y - 1.6, (p.hunger > hb ? "+" + Math.round(p.hunger - hb) + " food " : "") + (p.energy > eb ? "+" + Math.round(p.energy - eb) + " energy" : ""), "#fdba74"); } catch (e) {}
    try { if (Z.emit) Z.emit({ t: "eat", item: id, pocket: true }); } catch (e) {}
    var s = I.state(p); s.ate = (s.ate || 0) + 1; if (why !== "quiet" && Z.bark && Math.random() < .5) try { Z.bark("eat"); } catch (e) {}
    I.dirty = 1; return true;
  };
  I.hot = function (i) { var s = I.state(), sl = s && s.slots[i]; if (!sl) { toast("Quick slot " + (i + 1) + " is empty. The first three pocket slots are your quick slots."); return false; } if (I.edible(sl.id)) return I.use(sl.id); I.open(); I.sel = i; render(); return false; };

  /* ---------- the ground: dropped stacks you can pick up again ---------- */
  I.ground = [];
  I.drop = function (slot, n) {
    var p = P(), s = I.state(p), sl = s.slots[slot], me = Z.me; if (!sl) return false; if (!slotted(sl.id)) { toast("You cannot drop that."); return false; }
    n = Math.min(sl.n, n == null ? sl.n : n); var id = sl.id; sl.n -= n; if (sl.n <= 0) s.slots[slot] = null; p.inv[id] = I.count(id) - n;
    var a = me ? me.a : 0, x = me ? me.x + Math.cos(a) * 1.1 : 0, y = me ? me.y + Math.sin(a) * 1.1 : 0;
    try { if (S.push && Z.W) { var f = S.push(Z.W, x, y, .3); x = f.x; y = f.y; } } catch (e) {}
    I.ground.push({ id: id, n: n, x: x, y: y, t: 0, armed: false, inside: !!Z.inside }); if (I.ground.length > 40) I.ground.shift();
    sfx("click"); I.dirty = 1; return true;
  };
  I.pickup = function (g) { var k = I.add(g.id, g.n, { quiet: true }); if (k <= 0) { if (!g.warned) { g.warned = 1; toast("Pockets full: you cannot pick up <b>" + esc(I.def(g.id).name) + "</b>."); } return false; } g.n -= k; if (g.n <= 0) I.ground.splice(I.ground.indexOf(g), 1); sfx("coin"); toast("Picked up <b>" + esc(I.def(g.id).name) + (k > 1 ? " × " + k : "") + "</b>"); return true; };
  function groundTick(dt) {
    var me = Z.me; if (!me) return;
    for (var i = I.ground.length - 1; i >= 0; i--) { var g = I.ground[i]; g.t += dt; if (g.t > DESPAWN) { I.ground.splice(i, 1); continue; } var d = Math.hypot(g.x - me.x, g.y - me.y); if (!g.armed) { if (d > 2.4) g.armed = true; continue; } if (d < 1.3 && !me.veh) I.pickup(g); else if (d > 3) g.warned = 0; }
  }

  /* ---------- moving, swapping, splitting ---------- */
  I.move = function (a, b) {
    var s = I.state(), A = s.slots[a], B = s.slots[b], cap = I.capacity(); if (a === b || a < 0 || b < 0 || a >= s.slots.length || b >= cap || !A) return false;
    if (B && B.id === A.id) { var mx = stackOf(A.id), k = Math.min(A.n, mx - B.n); if (k <= 0) { s.slots[a] = B; s.slots[b] = A; } else { B.n += k; A.n -= k; if (A.n <= 0) s.slots[a] = null; } }
    else { s.slots[a] = B || null; s.slots[b] = A; }
    trim(s, cap); I.dirty = 1; return true;
  };
  I.split = function (a) { var s = I.state(), A = s.slots[a], cap = I.capacity(); if (!A || A.n < 2) return false; for (var i = 0; i < cap; i++) if (!s.slots[i]) { var h = Math.floor(A.n / 2); A.n -= h; s.slots[i] = { id: A.id, n: h }; I.dirty = 1; return i; } toast("No empty slot to split into."); return false; };

  /* ---------- gifts ---------- */
  I.nearby = function (r) { var me = Z.me, p = P(); if (!me || !p) return []; return Z.npcs.filter(function (n) { return !n.hidden && n.def && Math.hypot(n.x - me.x, n.y - me.y) < (r || 6) && (n.id !== "sly" || p.flags.slyAlly); }).sort(function (a, b) { return Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y); }); };
  I.giftValue = function (npc, id) { // how much a gift is worth to this person
    var d = I.def(id), nd = npc && npc.def || {}, lk = nd.likes || {}, p = P(), v;
    if (lk.gift === id) v = 15; else if (Array.isArray(lk.gifts) && lk.gifts.indexOf(id) >= 0) v = 12; else if (d.kind === "gift") v = 7; else if (d.kind === "food" || d.kind === "drink") v = 4; else if (d.kind === "ingr") v = 2; else v = 1;
    if (nd.hates && (nd.hates === id || (Array.isArray(nd.hates) && nd.hates.indexOf(id) >= 0))) v = -3;
    if (p && p.partner === npc.id && (id === "flowers" || id === "perfume" || id === "chocolate")) v = Math.round(v * 1.5);
    return v;
  };
  I.give = function (npcId, id) { // → friendship gained (0 or more), or false when it could not be given
    var p = P(), n = typeof npcId === "string" ? Z.npc(npcId) : npcId; if (!p || !n || !n.def || !I.has(id) || !slotted(id)) return false;
    var s = I.state(p), key = n.id + ":" + p.day, v = I.giftValue(n, id), lk = (n.def.likes || {}).gift === id; if (s.gift[key] >= 2 && v > 0) v = 1; // the third gift in a day is still kind, just less of a surprise
    I.take(id, 1); s.gift[key] = (s.gift[key] || 0) + 1; var before = S.affinity(p, n.id); S.bond(p, n.id, v); var gain = Math.round((S.affinity(p, n.id) - before) * 10) / 10;
    var d = I.def(id), line = v < 0 ? "Erm… thanks. I'll keep it somewhere." : lk ? "How did you know?! I love it!" : d.kind === "gift" ? "For me? Thank you!" : d.kind === "food" || d.kind === "drink" ? "Ah, you are a real one. Thank you!" : d.kind === "mat" ? "…" + d.name.toLowerCase() + "? Okay. Thank you, I guess." : "Thank you!";
    try { if (Z.say) Z.say(n, line); if (Z.float) Z.float(n.x, n.y - 1.7, gain >= 0 ? "♥ +" + gain : "♥ " + gain, "#f9a8d4"); n.wave = 1.2; } catch (e) {}
    sfx(v > 0 ? "power" : "block"); try { Z.emit({ t: "gift", npc: n.id, item: id }); } catch (e) {} I.dirty = 1; return Math.max(0, gain);
  };

  /* ---------- buying into your pockets ---------- */
  I.price = function (id) { var d = I.def(id); return d.price || 0; };
  I.buy = function (id, n) {
    var p = P(); n = n || 1; var cost = I.price(id) * n; if (!p || p.money < cost) { toast("You need " + naira(cost) + "."); sfx("block"); return false; }
    if (I.fits(id, n) < n) { full(I.def(id).name, n); return false; } p.money -= cost; I.add(id, n); sfx("coin"); try { Z.emit({ t: "buy", item: id }); } catch (e) {} return true;
  };
  I.buyBag = function () { var p = P(), s = I.state(p); if (s.bag) return false; if (p.money < BAG_PRICE) { toast("The school backpack is " + naira(BAG_PRICE) + "."); return false; } p.money -= BAG_PRICE; s.bag = 1; sfx("win"); I.sync(p); toast("<b>School backpack!</b> Your pockets now hold " + I.capacity(p) + " things."); return true; };
  // rows for a place menu (samaru-ui.js U.place calls this). Each row runs its own action.
  I.placeItems = function (pl, items) {
    var p = P(); if (!p || !pl) return; var d = pl.def || {}, list = SHOPS[pl.id] || (pl.role === "shop" ? SHOPS.bookshop : null), packs = (d.menu || []).filter(function (m) { return PACK[m]; });
    if (!list && !packs.length) return;
    var stock = (list || []).filter(function (x) { return x[0] !== "@"; }), pack = !list || list.indexOf("@pack") >= 0 || packs.length;
    if (pack) packs.forEach(function (m) { if (stock.indexOf(PACK[m]) < 0) stock.push(PACK[m]); });
    if (stock.length) items.push({ label: "🎒 Buy for your pockets", sub: "Food and drink for later, gifts, supplies · " + I.used(p) + "/" + I.capacity(p) + " slots used", run: function () { I.shopMenu(pl, stock); } });
    if (list && list.indexOf("@bag") >= 0 && !I.state(p).bag) items.push({ label: "School backpack · " + naira(BAG_PRICE), sub: "+5 pocket slots, for good", off: p.money < BAG_PRICE, run: function () { I.buyBag(); Z.ui.place(pl); } });
    if (list && list.indexOf("@phone") >= 0 && Z.phone && Z.phone.lost && Z.phone.lost()) items.push({ label: "Cheap replacement phone · " + naira(Z.phone.REPLACE), sub: "Your contacts come back from your SIM. Apps work again.", go: true, off: p.money < Z.phone.REPLACE, run: function () { Z.phone.replace(); Z.ui.place(pl); } });
  };
  I.shopMenu = function (pl, stock) {
    var p = P(); Z.ui.menu("🎒 " + esc(pl.name), "Buy now, eat later. " + I.used(p) + "/" + I.capacity(p) + " slots · " + naira(p.money), stock.map(function (id) { var d = I.def(id), have = I.count(id); return { label: d.name + " · " + naira(d.price), sub: effect(id) + (have ? " · you have " + have : ""), id: id, off: p.money < d.price }; }), function (it) { I.buy(it.id, 1); I.shopMenu(pl, stock); }, function () { Z.ui.place(pl); });
  };
  function effect(id) { var d = I.def(id); if (I.edible(id)) return [d.hunger ? "+" + d.hunger + " food" : "", d.energy ? "+" + d.energy + " energy" : ""].filter(Boolean).join(" · ") || "a snack"; return { gift: "a gift", mat: "raw material", ingr: "cooking ingredient", collect: "collectible", tool: "tool", key: "quest item" }[d.kind] || ""; }
  I.effect = effect;

  /* ---------- icons: small SVG pictures, one per kind of thing ---------- */
  function svg(inner) { return "<svg viewBox='0 0 40 40' width='100%' height='100%' aria-hidden='true'>" + inner + "</svg>"; }
  var ICON = {
    can: function (c) { return "<rect x='12' y='7' width='16' height='27' rx='4' fill='" + c + "'/><ellipse cx='20' cy='8' rx='8' ry='2.5' fill='#e2e8f0'/><rect x='12' y='15' width='16' height='8' fill='rgba(255,255,255,.85)'/><path d='M15 19h10' stroke='" + c + "' stroke-width='2.4' stroke-linecap='round'/>"; },
    sachet: function (c) { return "<path d='M8 12q12-6 24 0v16q-12 6-24 0z' fill='" + c + "' opacity='.55'/><path d='M8 12q12-6 24 0v16q-12 6-24 0z' fill='none' stroke='#e0f2fe' stroke-width='1.6'/><path d='M16 19q4-5 8 0q0 5-4 5t-4-5z' fill='#e0f2fe'/>"; },
    puff: function (c) { return "<path d='M7 21h26l-3 12H10z' fill='#fef3c7'/><circle cx='14' cy='18' r='5.5' fill='" + c + "'/><circle cx='25' cy='17' r='5.5' fill='" + c + "'/><circle cx='20' cy='12' r='5' fill='" + c + "'/><circle cx='13' cy='16' r='1.5' fill='rgba(255,255,255,.4)'/>"; },
    loaf: function (c) { return "<path d='M6 26q0-14 14-14t14 14v5H6z' fill='" + c + "'/><path d='M13 18l3 5M19 16l2 6M25 17l1 5' stroke='#fde68a' stroke-width='2' stroke-linecap='round'/>"; },
    skewer: function (c) { return "<path d='M6 34L34 6' stroke='#d6d3d1' stroke-width='2'/><rect x='10' y='22' width='8' height='8' rx='2' transform='rotate(-45 14 26)' fill='" + c + "'/><rect x='17' y='15' width='8' height='8' rx='2' transform='rotate(-45 21 19)' fill='" + c + "'/><rect x='24' y='8' width='8' height='8' rx='2' transform='rotate(-45 28 12)' fill='" + c + "'/><circle cx='20' cy='19' r='1.2' fill='#ef4444'/>"; },
    sack: function (c) { return "<path d='M12 12h16l3 20q-11 4-22 0z' fill='" + c + "' stroke='rgba(0,0,0,.25)'/><path d='M14 12q6-6 12 0' stroke='#92400e' stroke-width='2' fill='none'/><rect x='14' y='19' width='12' height='7' rx='1' fill='rgba(0,0,0,.18)'/>"; },
    noodles: function (c) { return "<rect x='7' y='10' width='26' height='20' rx='3' fill='" + c + "'/><path d='M11 17q2-3 4 0t4 0t4 0t4 0t4 0' stroke='#fff7ed' stroke-width='1.8' fill='none'/><path d='M11 23q2-3 4 0t4 0t4 0t4 0t4 0' stroke='#fff7ed' stroke-width='1.8' fill='none'/><rect x='7' y='10' width='26' height='4' fill='#dc2626'/>"; },
    bottle: function (c) { return "<rect x='17' y='5' width='6' height='5' fill='#94a3b8'/><path d='M16 10h8l2 5v18q0 2-2 2h-8q-2 0-2-2V15z' fill='" + c + "' stroke='rgba(255,255,255,.5)'/><rect x='14' y='20' width='12' height='7' fill='rgba(255,255,255,.55)'/>"; },
    pie: function (c) { return "<path d='M6 26a14 14 0 0 1 28 0z' fill='" + c + "'/><path d='M9 26q3-4 5 0q3-4 6 0q3-4 6 0q3-4 5 0' stroke='#b45309' stroke-width='1.6' fill='none'/>"; },
    strips: function (c) { return "<rect x='9' y='8' width='6' height='24' rx='2' fill='" + c + "' transform='rotate(-12 12 20)'/><rect x='17' y='8' width='6' height='24' rx='2' fill='" + c + "'/><rect x='25' y='8' width='6' height='24' rx='2' fill='" + c + "' transform='rotate(12 28 20)'/><circle cx='20' cy='14' r='1' fill='#fca5a5'/><circle cx='12' cy='22' r='1' fill='#fca5a5'/>"; },
    corn: function (c) { return "<ellipse cx='20' cy='18' rx='7' ry='13' fill='" + c + "'/><path d='M16 10v16M20 7v22M24 10v16' stroke='#78350f' stroke-width='1.3' opacity='.6'/><path d='M13 26q-4 6 2 9M27 26q4 6-2 9' stroke='#65a30d' stroke-width='3' fill='none'/>"; },
    jar: function (c) { return "<rect x='13' y='6' width='14' height='4' rx='1' fill='#dc2626'/><rect x='11' y='10' width='18' height='24' rx='4' fill='" + c + "' opacity='.9'/><rect x='14' y='17' width='12' height='8' fill='rgba(255,255,255,.6)'/>"; },
    veg: function (c) { return "<circle cx='15' cy='23' r='8' fill='" + c + "'/><circle cx='26' cy='22' r='7' fill='" + c + "' opacity='.85'/><path d='M15 15l-2-4M26 15l2-4' stroke='#16a34a' stroke-width='2.4' stroke-linecap='round'/>"; },
    egg: function (c) { return "<ellipse cx='15' cy='22' rx='7' ry='9' fill='" + c + "'/><ellipse cx='26' cy='23' rx='6.5' ry='8.5' fill='#fff7ed'/>"; },
    cube: function (c) { return "<rect x='11' y='11' width='18' height='18' rx='3' fill='" + c + "'/><path d='M11 17h18' stroke='#fff' stroke-width='2'/>"; },
    planks: function (c) { return "<rect x='6' y='9' width='28' height='6' rx='1' fill='" + c + "'/><rect x='6' y='17' width='28' height='6' rx='1' fill='" + c + "' opacity='.85'/><rect x='6' y='25' width='28' height='6' rx='1' fill='" + c + "'/><path d='M10 12h6M20 20h8M12 28h5' stroke='#78350f' stroke-width='1.2'/>"; },
    pile: function (c) { return "<path d='M5 32q15-26 30 0z' fill='" + c + "'/><circle cx='17' cy='24' r='1' fill='#a16207'/><circle cx='23' cy='27' r='1' fill='#a16207'/>"; },
    coil: function (c) { return "<circle cx='20' cy='20' r='12' fill='none' stroke='" + c + "' stroke-width='4'/><circle cx='20' cy='20' r='6' fill='none' stroke='" + c + "' stroke-width='3'/><path d='M32 20l4 8' stroke='" + c + "' stroke-width='3'/>"; },
    nails: function (c) { return "<path d='M12 8v24M20 8v24M28 8v24' stroke='" + c + "' stroke-width='2.4'/><path d='M9 8h6M17 8h6M25 8h6' stroke='" + c + "' stroke-width='3'/>"; },
    tin: function (c) { return "<rect x='9' y='12' width='22' height='21' rx='2' fill='#cbd5e1'/><rect x='9' y='17' width='22' height='10' fill='" + c + "'/><path d='M10 12q10-9 20 0' stroke='#64748b' stroke-width='1.6' fill='none'/>"; },
    tape: function (c) { return "<circle cx='20' cy='20' r='12' fill='" + c + "'/><circle cx='20' cy='20' r='5' fill='#e2e8f0'/>"; },
    bulb: function (c) { return "<circle cx='20' cy='16' r='9' fill='" + c + "'/><rect x='16' y='24' width='8' height='8' rx='1' fill='#94a3b8'/><path d='M17 16l3 4 3-4' stroke='#a16207' fill='none'/>"; },
    cell: function (c) { return "<rect x='13' y='8' width='14' height='26' rx='2' fill='" + c + "'/><rect x='17' y='5' width='6' height='3' fill='#cbd5e1'/><path d='M20 14v8M16 18h8' stroke='#fff' stroke-width='2'/>"; },
    cloth: function (c) { return "<path d='M6 12q7-5 14 0t14 0v18q-7 5-14 0t-14 0z' fill='" + c + "'/><circle cx='14' cy='20' r='2.5' fill='#fde047'/><circle cx='26' cy='22' r='2.5' fill='#22d3ee'/>"; },
    flowers: function (c) { return "<path d='M20 34V20M20 26l-6-6M20 26l6-6' stroke='#16a34a' stroke-width='2'/><circle cx='20' cy='13' r='5' fill='" + c + "'/><circle cx='12' cy='18' r='4' fill='#fbbf24'/><circle cx='28' cy='18' r='4' fill='#f87171'/><circle cx='20' cy='13' r='1.8' fill='#fde047'/>"; },
    bar: function (c) { return "<rect x='9' y='7' width='22' height='26' rx='2' fill='" + c + "'/><path d='M9 15h22M9 23h22M20 7v26' stroke='#451a03' stroke-width='1.6'/><path d='M9 27l22-6v12H9z' fill='#dc2626'/>"; },
    perfume: function (c) { return "<rect x='17' y='6' width='6' height='6' rx='1' fill='#fbbf24'/><rect x='11' y='12' width='18' height='22' rx='5' fill='" + c + "' opacity='.85'/><ellipse cx='16' cy='20' rx='2' ry='5' fill='rgba(255,255,255,.5)'/>"; },
    book: function (c) { return "<rect x='10' y='7' width='20' height='27' rx='2' fill='" + c + "'/><rect x='13' y='7' width='3' height='27' fill='rgba(0,0,0,.25)'/><rect x='18' y='12' width='9' height='3' rx='1' fill='#fff'/>"; },
    gem: function (c) { return "<path d='M20 5l11 11-11 19L9 16z' fill='" + c + "'/><path d='M9 16h22M20 5l-4 11 4 19 4-19z' stroke='#ede9fe' fill='none'/>"; },
    key: function (c) { return "<circle cx='14' cy='16' r='7' fill='none' stroke='" + c + "' stroke-width='4'/><path d='M19 21l12 12M26 28l3-3M29 31l3-3' stroke='" + c + "' stroke-width='4' stroke-linecap='round'/>"; },
    torch: function (c) { return "<rect x='8' y='16' width='20' height='9' rx='2' fill='#334155'/><path d='M28 14l6-3v19l-6-3z' fill='" + c + "'/><path d='M34 14l5-2M34 20h5M34 26l5 2' stroke='" + c + "' stroke-width='1.5'/>"; },
    slipper: function (c) { return "<path d='M8 26q0-12 14-14t12 10q-2 8-14 8t-12-4z' fill='" + c + "'/><path d='M16 15q6 8 14 2' stroke='#7c2d12' stroke-width='3' fill='none'/>"; },
    calc: function (c) { return "<rect x='10' y='6' width='20' height='28' rx='3' fill='" + c + "'/><rect x='13' y='9' width='14' height='6' fill='#a7f3d0'/><g fill='#e2e8f0'><rect x='13' y='18' width='4' height='3'/><rect x='18' y='18' width='4' height='3'/><rect x='23' y='18' width='4' height='3'/><rect x='13' y='23' width='4' height='3'/><rect x='18' y='23' width='4' height='3'/><rect x='23' y='23' width='4' height='3'/></g>"; },
    sim: function (c) { return "<path d='M11 6h13l6 6v22H11z' fill='" + c + "'/><rect x='15' y='18' width='10' height='9' rx='1' fill='#fde047'/>"; },
    phone: function (c) { return "<rect x='12' y='5' width='16' height='30' rx='3' fill='#0f172a' stroke='" + c + "' stroke-width='2'/><rect x='14' y='9' width='12' height='20' fill='#38bdf8'/>"; },
    kola: function () { return "<ellipse cx='16' cy='21' rx='8' ry='10' fill='#be123c'/><ellipse cx='24' cy='21' rx='7' ry='9' fill='#f472b6'/><path d='M20 12v18' stroke='#7f1d1d' stroke-width='1.6'/>"; },
    bag: function (c) { return "<rect x='9' y='12' width='22' height='22' rx='5' fill='" + c + "'/><path d='M14 12q0-7 6-7t6 7' stroke='" + c + "' stroke-width='3' fill='none'/><rect x='13' y='20' width='14' height='8' rx='2' fill='rgba(0,0,0,.25)'/>"; },
    box: function (c) { return "<rect x='9' y='11' width='22' height='20' rx='3' fill='" + c + "'/><path d='M9 17h22M20 11v20' stroke='rgba(255,255,255,.4)' stroke-width='2'/>"; }
  };
  I.icon = function (id) { var d = I.def(id), f = ICON[d.icon] || ICON.box; return svg(f(d.col || "#64748b")); };
  I.iconOf = function (name, col) { return svg((ICON[name] || ICON.box)(col || "#64748b")); };

  /* ---------- the panel ---------- */
  var box = null, built = false, opened = false, dragF = null;
  I.sel = -1; I.mode = ""; // mode: "" | "move" | "gift"
  I.html = "";
  function stageEl() { try { return document.querySelector("[data-gm-stage]"); } catch (e) { return null; } }
  function realDom() { return typeof document !== "undefined" && document.body && typeof document.body.insertBefore === "function" && typeof window.getComputedStyle === "function"; }
  var CSS = ".fi-pocket{position:absolute;z-index:6;box-sizing:border-box;width:min(340px,calc(100% - 24px));max-height:calc(100% - 20px);overflow:auto;padding:12px 12px 10px;border-radius:20px;background:linear-gradient(180deg,rgb(30,24,16),rgb(15,13,10));border:1px solid rgba(253,186,116,.35);box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.08);color:#fff7ed;font:500 13px/1.3 system-ui,-apple-system,sans-serif;transform-origin:50% 100%;transition:transform .2s cubic-bezier(.2,.9,.3,1.2),opacity .18s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none}" +
    ".fi-pocket h3,.fi-pocket h4,.fi-pocket p,.fi-pocket b,.fi-pocket small,.fi-pocket span,.fi-pocket em{color:inherit;letter-spacing:normal}.fi-pocket[hidden]{display:none}.fi-pocket.is-in{transform:none;opacity:1}.fi-pocket.is-out{transform:translateY(24px) scale(.96);opacity:0}" +
    ".fi-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}.fi-head h3{margin:0;font:800 16px/1 system-ui,sans-serif;letter-spacing:.02em;flex:1;display:flex;align-items:center;gap:7px}.fi-head h3 i{width:26px;height:26px;display:inline-block}.fi-cap{font-size:12px;opacity:.85;font-weight:700}.fi-kola{display:flex;align-items:center;gap:3px;font-weight:800;font-size:12px;color:#fda4af}.fi-kola i{width:20px;height:20px;display:inline-block}" +
    ".fi-x{min-width:44px;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font:700 18px system-ui;cursor:pointer}" +
    ".fi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.fi-slot{position:relative;aspect-ratio:1;min-width:44px;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);padding:6px;box-sizing:border-box;cursor:pointer;color:inherit;font:inherit;touch-action:none}" +
    ".fi-slot:hover{background:rgba(255,255,255,.11)}.fi-slot.is-hot{background:rgba(253,186,116,.12);border-color:rgba(253,186,116,.4)}.fi-slot.is-sel{outline:3px solid #fdba74;outline-offset:-1px;background:rgba(253,186,116,.2)}.fi-slot.is-over{border-color:#f87171;background:rgba(248,113,113,.15)}.fi-slot.is-target{outline:2px dashed #7dd3fc;outline-offset:-2px}" +
    ".fi-slot b{position:absolute;right:4px;bottom:2px;font:800 12px/1 system-ui;text-shadow:0 1px 2px #000,0 0 3px #000}.fi-slot em{position:absolute;left:4px;top:3px;font:800 9px/1 system-ui;font-style:normal;color:#fdba74;opacity:.9}.fi-slot.is-drag{opacity:.35}" +
    ".fi-ghost{position:fixed;z-index:50;width:48px;height:48px;pointer-events:none;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6))}" +
    ".fi-info{margin-top:10px;padding:10px;border-radius:14px;background:rgba(255,255,255,.06);min-height:62px}.fi-info h4{margin:0 0 3px;font:800 14px system-ui;display:flex;gap:8px;align-items:center}.fi-info h4 i{width:30px;height:30px;display:inline-block}.fi-info p{margin:0 0 6px;opacity:.88;font-size:12.5px}.fi-fx{color:#86efac;font-weight:700}" +
    ".fi-acts{display:flex;flex-wrap:wrap;gap:6px}.fi-acts button,.fi-who button{min-height:44px;padding:0 12px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font:700 13px system-ui;cursor:pointer;flex:1 1 auto}.fi-acts .is-go{background:#ea580c;border-color:#fb923c}.fi-acts button:disabled{opacity:.4;cursor:default}" +
    ".fi-who{display:grid;gap:6px;margin-top:6px}.fi-who button{text-align:left;display:flex;justify-content:space-between;align-items:center}.fi-who small{opacity:.8;font-weight:600}" +
    ".fi-keys{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.fi-key{display:flex;align-items:center;gap:5px;padding:3px 8px 3px 4px;border-radius:999px;background:rgba(255,255,255,.07);font-size:11.5px;font-weight:700}.fi-key i{width:22px;height:22px;display:inline-block}" +
    ".fi-tip{margin:8px 0 0;font-size:11.5px;opacity:.75}.fi-full{animation:fiShake .4s}@keyframes fiShake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}" +
    ".fi-pocket.is-compact{padding:8px 10px}.fi-pocket.is-compact .fi-head{margin-bottom:5px}.fi-pocket.is-compact .fi-grid{grid-template-columns:repeat(6,1fr);gap:5px}.fi-pocket.is-compact .fi-slot{padding:4px}.fi-pocket.is-compact .fi-info{margin-top:6px;padding:8px}.fi-pocket.is-compact .fi-tip{display:none}" +
    "@media (prefers-reduced-motion:reduce){.fi-pocket{transition:none}.fi-full{animation:none}}" +
    ".fi-hot{position:absolute;z-index:6;display:flex;gap:6px;padding:6px;border-radius:16px;background:rgba(14,12,9,.9);border:1px solid rgba(253,186,116,.4)}.fi-hot[hidden]{display:none}.fi-hot button{position:relative;width:56px;height:56px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);padding:6px;color:#fff}.fi-hot b{position:absolute;right:4px;bottom:2px;font:800 12px system-ui;text-shadow:0 1px 2px #000}";

  function build() {
    if (built || !realDom()) return !!box; var st = stageEl(); if (!st) return false; built = true;
    var css = document.createElement("style"); css.textContent = CSS; (document.head || document.body).appendChild(css);
    box = document.createElement("div"); box.className = "fi-pocket is-out"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Pockets"); st.appendChild(box);
    box.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-pi]"); if (!b || b.disabled) return; e.preventDefault(); e.stopPropagation(); if (dragF && dragF.moved) return; I.press(b.getAttribute("data-pi")); });
    box.addEventListener("pointerdown", function (e) { e.stopPropagation(); var b = e.target.closest && e.target.closest(".fi-slot"); if (!b) return; var i = +b.getAttribute("data-slot"); if (!(I.state().slots[i])) return; dragF = { i: i, x: e.clientX, y: e.clientY, moved: false, el: b, id: e.pointerId }; });
    window.addEventListener("pointermove", function (e) { if (!dragF || e.pointerId !== dragF.id) return; var d = Math.hypot(e.clientX - dragF.x, e.clientY - dragF.y); if (!dragF.moved && d > 10) { dragF.moved = true; dragF.el.classList.add("is-drag"); dragF.g = document.createElement("div"); dragF.g.className = "fi-ghost"; dragF.g.innerHTML = I.icon(I.state().slots[dragF.i].id); document.body.appendChild(dragF.g); } if (dragF.moved) { dragF.g.style.left = (e.clientX - 24) + "px"; dragF.g.style.top = (e.clientY - 24) + "px"; } }, true);
    window.addEventListener("pointerup", function (e) { if (!dragF || e.pointerId !== dragF.id) return; var f = dragF; if (f.moved) { if (f.g) f.g.remove(); var t = document.elementFromPoint(e.clientX, e.clientY), sl = t && t.closest ? t.closest(".fi-slot") : null; if (sl) { var j = +sl.getAttribute("data-slot"); if (I.move(f.i, j)) { I.sel = j; sfx("click"); } } render(); setTimeout(function () { dragF = null; }, 0); } else dragF = null; }, true);
    window.addEventListener("keydown", function (e) { if (!opened || (e.target && e.target.closest && e.target.closest("input, textarea"))) return; if (Z.phone && Z.phone.isOpen && Z.phone.isOpen()) return; var k = e.code, s = I.state(), cap = I.capacity(), i = I.sel < 0 ? 0 : I.sel, h = true;
      if (k === "ArrowRight") I.sel = Math.min(cap - 1, i + 1); else if (k === "ArrowLeft") I.sel = Math.max(0, i - 1); else if (k === "ArrowDown") I.sel = Math.min(cap - 1, i + COLS); else if (k === "ArrowUp") I.sel = Math.max(0, i - COLS);
      else if (k === "Enter") I.press(I.mode === "move" ? "slot:" + i : "use"); else if (k === "Escape" || k === "Backspace" || k === "KeyI") { if (I.mode) { I.mode = ""; } else I.close(); } else if (k === "Delete") I.press("drop1"); else if (k === "KeyG") I.press("gift"); else h = false;
      if (h) { e.preventDefault(); e.stopImmediatePropagation(); render(); } }, true);
    return true;
  }
  // where the panel sits: clear of the move stick and the right-thumb buttons (Z.phone.fit does the maths)
  function place() { if (!box) return; var r = Z.phone && Z.phone.fit ? Z.phone.fit(Math.min(340, (stageEl() || {}).clientWidth - 24 || 340), Math.max(box.scrollHeight || 0, 420), "pocket") : null; if (r) { box.style.left = r.x + "px"; box.style.top = r.y + "px"; box.style.width = r.w + "px"; box.style.maxHeight = r.h + "px"; box.classList.toggle("is-compact", r.h < 430 && r.w >= 300); } else { box.style.left = "50%"; box.style.top = "50%"; box.style.transform = "translate(-50%,-50%)"; } }
  function slotHtml(s, i, cap) {
    var sl = s.slots[i], over = i >= cap, hot = i < 3, cls = "fi-slot" + (hot ? " is-hot" : "") + (i === I.sel ? " is-sel" : "") + (over ? " is-over" : "") + (I.mode === "move" && i !== I.sel ? " is-target" : "");
    var d = sl ? I.def(sl.id) : null, tip = sl ? d.name + (sl.n > 1 ? " × " + sl.n : "") + " — " + (effect(sl.id) || d.kind) : "Empty slot";
    return "<button type='button' class='" + cls + "' data-pi='slot:" + i + "' data-slot='" + i + "' title='" + esc(tip) + "' aria-label='" + esc(tip) + "'>" + (hot ? "<em>" + (i + 5) + "</em>" : "") + (sl ? I.icon(sl.id) + (sl.n > 1 ? "<b>" + sl.n + "</b>" : "") : "") + "</button>";
  }
  function infoHtml(s) {
    var p = P(), sl = s.slots[I.sel];
    if (I.mode === "gift" && sl) { var ppl = I.nearby(6); return "<div class='fi-info'><h4><i>" + I.icon(sl.id) + "</i>Give " + esc(I.def(sl.id).name) + " to…</h4>" + (ppl.length ? "<div class='fi-who'>" + ppl.slice(0, 4).map(function (n) { var a = S.affinity(p, n.id), lk = (n.def.likes || {}).gift === sl.id; return "<button type='button' data-pi='to:" + n.id + "'><span>" + esc(n.def.name) + (p.partner === n.id ? " ♥" : "") + "</span><small>" + S.friendTier(a) + " " + Math.round(a) + (lk ? " · loves this" : "") + "</small></button>"; }).join("") + "</div>" : "<p>Nobody close enough. Walk up to a friend or your partner, then open your pockets.</p>") + "<div class='fi-acts' style='margin-top:6px'><button type='button' data-pi='cancel'>Cancel</button></div></div>"; }
    if (I.mode === "move" && sl) return "<div class='fi-info'><h4><i>" + I.icon(sl.id) + "</i>Move " + esc(I.def(sl.id).name) + "</h4><p>Tap the slot to move it to. Same item? The stacks merge. Something else? They swap.</p><div class='fi-acts'><button type='button' data-pi='cancel'>Cancel</button></div></div>";
    if (!sl) return "<div class='fi-info'><p>" + (s.slots.some(Boolean) ? "Tap something to see what it does. The first three slots are quick slots: keys <b>5 6 7</b>, or hold 🎒 on a phone." : "Your pockets are empty. Shops sell food for later: look for <b>🎒 Buy for your pockets</b>.") + "</p></div>";
    var d = I.def(sl.id), ed = I.edible(sl.id), near = I.nearby(6).length;
    return "<div class='fi-info'><h4><i>" + I.icon(sl.id) + "</i>" + esc(d.name) + (sl.n > 1 ? " × " + sl.n : "") + "</h4><p>" + esc(d.text || "") + (effect(sl.id) ? " <span class='fi-fx'>" + effect(sl.id) + "</span>" : "") + "</p><div class='fi-acts'>" +
      (ed ? "<button type='button' class='is-go' data-pi='use'>" + (d.kind === "drink" ? "Drink" : "Eat") + "</button>" : "") +
      "<button type='button' data-pi='gift'" + (near ? "" : " title='Walk up to a friend first'") + ">Gift</button>" + "<button type='button' data-pi='drop1'>Drop" + (sl.n > 1 ? " 1" : "") + "</button>" + (sl.n > 1 ? "<button type='button' data-pi='dropall'>Drop all</button><button type='button' data-pi='split'>Split</button>" : "") + "<button type='button' data-pi='move'>Move</button></div></div>";
    void p;
  }
  function render() {
    var p = P(); if (!p) return; I.sync(p); var s = I.state(p), cap = I.capacity(p), n = Math.max(cap, s.slots.length), i, g = "";
    for (i = 0; i < n; i++) g += slotHtml(s, i, cap);
    var keys = Object.keys(p.inv).filter(function (id) { return p.inv[id] > 0 && !slotted(id); }), tok = (p.stats && p.stats.tokens) || 0;
    var ph = Z.phone && Z.phone.lost && Z.phone.lost();
    var html = "<div class='fi-head'><h3><i>" + I.iconOf("bag", "#c2410c") + "</i>Pockets</h3><span class='fi-cap' data-pocket-cap>" + I.used(p) + "/" + cap + " slots</span><button type='button' class='fi-x' data-pi='close' aria-label='Close pockets'>✕</button></div>" +
      "<div class='fi-grid" + (I.flashFull > 0 ? " fi-full" : "") + "' data-pocket-grid>" + g + "</div>" + infoHtml(s) +
      "<div class='fi-keys'><span class='fi-key' title='Kola nuts found around campus'><i>" + I.iconOf("kola") + "</i>Kola nuts " + tok + "/" + (S.TOKEN_COUNT || 0) + "</span><span class='fi-key'><i>" + I.iconOf("phone", ph ? "#ef4444" : "#38bdf8") + "</i>" + (ph ? "Phone: stolen!" : "Phone") + "</span>" + keys.map(function (id) { var d = I.def(id); return "<span class='fi-key' title='" + esc(d.text || (D.ITEMS[id] || {}).text || d.name) + "'><i>" + I.icon(id) + "</i>" + esc(d.name) + (p.inv[id] > 1 ? " × " + p.inv[id] : "") + "</span>"; }).join("") + "</div>" +
      "<p class='fi-tip'>" + (s.bag ? "School backpack: +5 slots." : "More slots every two levels, and +5 with a school backpack.") + " Drag a slot onto another to move it.</p>";
    I.html = html; if (box) { box.innerHTML = html; }
  }
  I.render = render;
  I.isOpen = function () { return opened; };
  I.open = function (sel) {
    var p = P(); if (!p || Z.mode !== "play") return false; if (Z.intro && Z.intro.on) return false; if (Z.phone && Z.phone.isOpen && Z.phone.isOpen()) Z.phone.close(); I.sync(p); opened = true; I.mode = ""; if (sel != null) I.sel = sel; else if (I.sel < 0 || !I.state(p).slots[I.sel]) I.sel = I.state(p).slots.findIndex(Boolean);
    build(); render(); if (Z.phone && Z.phone.tools) Z.phone.tools("pocket"); if (box) { box.hidden = false; place(); box.classList.remove("is-in"); box.classList.add("is-out"); void box.offsetWidth; box.classList.remove("is-out"); box.classList.add("is-in"); }
    sfx("click"); try { if (Z.guide && Z.guide.note) Z.guide.note("pocket"); } catch (e) {} note("open"); return true;
  };
  I.close = function () { if (!opened) return; opened = false; I.mode = ""; if (Z.phone && Z.phone.tools && Z.phone._toolsKeep === "pocket") Z.phone.tools(""); if (box) { box.classList.remove("is-in"); box.classList.add("is-out"); var b = box; setTimeout(function () { if (!opened) b.hidden = true; }, 180); } };
  I.toggle = function () { return opened ? (I.close(), false) : I.open(); };
  // one press of a control in the panel, by id (the tests drive the panel this way too)
  I.press = function (a) {
    var p = P(), s = I.state(p), sl = s.slots[I.sel], k = a.split(":");
    if (a === "close") return I.close();
    if (k[0] === "slot") { var i = +k[1]; if (I.mode === "move" && I.sel >= 0 && i !== I.sel) { I.move(I.sel, i); I.sel = i; I.mode = ""; sfx("click"); } else { I.sel = i; I.mode = ""; } return render(); }
    if (a === "cancel") { I.mode = ""; return render(); }
    if (!sl) return render();
    if (a === "use") { I.use(sl.id); note("ate"); }
    else if (a === "drop1") I.drop(I.sel, 1); else if (a === "dropall") I.drop(I.sel);
    else if (a === "split") { var j = I.split(I.sel); if (j !== false) I.sel = j; }
    else if (a === "move") I.mode = "move";
    else if (a === "gift") I.mode = "gift";
    else if (k[0] === "to") { var g = I.give(k[1], sl.id); I.mode = ""; if (g === false) toast("Could not give that."); }
    render();
  };
  I.label = function (re) { var m = /data-pi='([^']+)'[^>]*>([\s\S]*?)<\/button>/g, r; while ((r = m.exec(I.html))) if (re.test(r[2].replace(/<[^>]+>/g, " "))) { I.press(r[1]); return r[1]; } return null; };

  /* ---------- the hotbar strip (long-press 🎒 on a phone) ---------- */
  var hotEl = null;
  I.hotShow = function (anchor) {
    if (!realDom()) return; var st = stageEl(); if (!st) return; if (!hotEl) { hotEl = document.createElement("div"); hotEl.className = "fi-hot"; hotEl.hidden = true; st.appendChild(hotEl); hotEl.addEventListener("pointerdown", function (e) { e.stopPropagation(); }); hotEl.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-hot]"); if (!b) return; e.stopPropagation(); I.hot(+b.getAttribute("data-hot")); I.hotHide(); }); }
    var s = I.state(); hotEl.innerHTML = [0, 1, 2].map(function (i) { var sl = s.slots[i]; return "<button type='button' data-hot='" + i + "' aria-label='" + (sl ? esc(I.def(sl.id).name) : "Empty") + "'>" + (sl ? I.icon(sl.id) + (sl.n > 1 ? "<b>" + sl.n + "</b>" : "") : "") + "</button>"; }).join("");
    hotEl.hidden = false; var r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null, sr = st.getBoundingClientRect(); if (r) { hotEl.style.left = Math.max(8, r.left - sr.left) + "px"; hotEl.style.top = (r.bottom - sr.top + 8) + "px"; } clearTimeout(I._hotT); I._hotT = setTimeout(I.hotHide, 4000);
  };
  I.hotHide = function () { if (hotEl) hotEl.hidden = true; };
  // samaru-touch.js forwards the 🎒 button here: a tap opens the pockets, a long press shows the quick slots
  var lp = null; I.btnDown = function (b) { lp = { t: setTimeout(function () { if (lp) { lp.long = 1; I.hotShow(b); try { Z.api.buzz(25); } catch (e) {} } }, 420) }; };
  I.btnUp = function () { if (!lp) return; clearTimeout(lp.t); var long = lp.long; lp = null; if (!long) I.toggle(); };

  /* ---------- nudges, and the pocket lesson after the walkthrough ---------- */
  function note(ev) { var s = I.state(); if (!s) return; if (ev === "open") s.opened = (s.opened || 0) + 1; if (ev === "ate") s.ateUI = 1; I.tutNote(ev); }
  function snack() { var s = I.state(); for (var i = 0; i < s.slots.length; i++) { var sl = s.slots[i]; if (sl && I.edible(sl.id)) return sl.id; } return ""; }
  function nudges(dt) {
    var p = P(), s = I.state(p); I._nudgeT = (I._nudgeT || 0) - dt; if (I._nudgeT > 0) return; I._nudgeT = 4;
    if (Z.intro && Z.intro.on) return; if (Z.guide && Z.guide.active && Z.guide.active()) return;
    var low = p.hunger < 28 ? "food" : p.energy < 24 ? "energy" : ""; if (!low) { s.hint.lowDay = 0; return; }
    var id = snack(); if (!id || s.hint.lowAt === p.day * 10 + (low === "food" ? 1 : 2)) return;
    if (s.hint.lastNudge != null && p.time - s.hint.lastNudge < 120 && s.hint.lastDay === p.day) return;
    s.hint.lowAt = p.day * 10 + (low === "food" ? 1 : 2); s.hint.lastNudge = p.time; s.hint.lastDay = p.day;
    var touch = Z.touch && Z.touch.active, key = ""; try { key = Z.api.keyName("pocket"); } catch (e) {}
    toast("<b>" + (low === "food" ? "Hungry?" : "Tired?") + "</b> You have " + esc(I.def(id).name.toLowerCase()) + " in your pocket — " + (touch ? "tap 🎒" : "press <b>" + (key || "I") + "</b>") + " to " + (I.def(id).kind === "drink" ? "drink" : "eat") + ".");
  }
  // The lesson: 0 wait → 1 "open your pockets" → 2 "eat or drink something" → 3 "buy ahead" (Got it) → done.
  var tutEl = null;
  I.TUT = ["open", "eat", "ahead"];
  I.tutActive = function () { var s = I.state(); return !!s && !s.tut.done && s.tut.s > 0; };
  I.tutNote = function (ev) { var s = I.state(); if (!s || s.tut.done || !s.tut.s) return; if (s.tut.s === 1 && ev === "open") s.tut.s = 2; else if (s.tut.s === 2 && ev === "ate") { s.tut.s = 3; sfx("coin"); } };
  I.tutSkip = function () { var s = I.state(); if (s) { s.tut.done = 1; s.tut.s = 0; } tutHide(); };
  function tutReady() {
    var p = P(); if (!p || Z.mode !== "play" || (Z.intro && Z.intro.on)) return false; if (Z.guide && Z.guide.active && Z.guide.active()) return false;
    if (Z.api.overlayOpen && Z.api.overlayOpen()) return false; if (Z.momentBusy && Z.momentBusy()) return false; if (Z.focus && Z.focus.current && Z.focus.current().kind !== "roam" && Z.focus.current().kind !== "mission") return false; return true;
  }
  function tutTick(dt) {
    var s = I.state(); if (s.tut.done) return tutHide();
    if (!s.tut.s) { if (!tutReady()) { s.tut.wait = 0; return; } s.tut.wait = (s.tut.wait || 0) + dt; if (s.tut.wait > (s.tut.old ? 20 : 8)) { s.tut.s = 1; sfx("click"); } else return; }
    if (!tutReady() && !opened) return tutHide();
    var step = s.tut.s, touch = Z.touch && Z.touch.active, key = ""; try { key = Z.api.keyName("pocket"); } catch (e) {}
    var id = snack(), body = step === 1 ? "Your pockets hold food, drinks, gifts and things you pick up. " + (touch ? "Tap the <b>🎒</b> button under PHONE." : "Press <b>" + esc(key || "I") + "</b> (or Phone → Pockets).")
      : step === 2 ? (id ? "Tap the " + esc(I.def(id).name.toLowerCase()) + ", then <b>" + (I.def(id).kind === "drink" ? "Drink" : "Eat") + "</b>. It fills FOOD or ENERGY on the spot." : "Your pockets are empty: buy a snack at any food spot.")
      : "Shops and food spots have <b>🎒 Buy for your pockets</b>: buy food in advance and eat it when you are hungry or tired, wherever you are. The first three slots are quick slots (" + (touch ? "hold 🎒" : "keys 5 6 7") + ").";
    tutShow("POCKETS " + step + " / 3", step === 1 ? "Your pockets" : step === 2 ? "Eat from your pocket" : "Buy food in advance", body, step === 3);
    if (touch && Z.touch.buttons && Z.touch.buttons.pocket && Z.touch.buttons.pocket.classList) Z.touch.buttons.pocket.classList.toggle("fg-pulse", step === 1);
  }
  function tutShow(top, title, body, ok) {
    var html = "<div class='fg-top'><span>" + top + "</span><span>" + (ok ? "<button type='button' class='fg-go' data-ft='ok'>Got it</button>" : "") + "<button type='button' class='fg-go' data-ft='skip' style='margin-left:6px'>Skip</button></span></div><div class='fg-body'><div class='fg-keys'><span style='display:inline-block;width:42px;height:42px'>" + I.iconOf("bag", "#c2410c") + "</span></div><div class='fg-text'><b>" + title + "</b><span>" + body + "</span></div></div>";
    I.tutHtml = html; if (!realDom()) return; var st = stageEl(); if (!st) return;
    if (!tutEl) { tutEl = document.createElement("div"); tutEl.className = "fg-card is-tip fi-tut"; tutEl.setAttribute("role", "status"); tutEl.style.pointerEvents = "auto"; st.appendChild(tutEl); tutEl.addEventListener("pointerdown", function (e) { e.stopPropagation(); }); tutEl.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-ft]"); if (!b) return; e.stopPropagation(); var s = I.state(); if (b.getAttribute("data-ft") === "skip") return I.tutSkip(); s.tut.done = 1; s.tut.s = 0; sfx("coin"); tutHide(); try { Z.save(); } catch (er) {} }); }
    if (tutEl._h !== html) { tutEl._h = html; tutEl.innerHTML = html; } tutEl.hidden = false;
  }
  function tutHide() { if (tutEl && !tutEl.hidden) tutEl.hidden = true; try { var b = Z.touch && Z.touch.buttons && Z.touch.buttons.pocket; if (b && b.classList) b.classList.remove("fg-pulse"); } catch (e) {} }
  I.tutOk = function () { var s = I.state(); if (s.tut.s === 3) { s.tut.done = 1; s.tut.s = 0; tutHide(); } };

  /* ---------- per frame ---------- */
  var syncT = 0;
  I.tick = function (dt) {
    var p = P(), me = Z.me; if (!p || Z.mode !== "play") { if (opened) I.close(); return; }
    if (me && me.eatT > 0) me.eatT = Math.max(0, me.eatT - dt);
    if (I.flashFull > 0) I.flashFull -= dt;
    syncT -= dt; if (syncT <= 0) { syncT = 1; I.sync(p); var s = I.state(p), cap = I.capacity(p); if (cap > s.lastCap) { toast("<b>Bigger pockets!</b> You can now carry " + cap + " things."); s.lastCap = cap; } else if (cap < s.lastCap) s.lastCap = cap; if (opened && I.dirty !== 2) render(); }
    if (I.dirty === 1) { I.dirty = 0; if (opened) render(); }
    if (Z.api.overlayOpen && Z.api.overlayOpen() && opened) I.close();
    if (Z.intro && Z.intro.on) { tutHide(); return; }
    groundTick(dt); nudges(dt); tutTick(dt);
    try { if (Z.api.hit("pocket")) I.toggle(); for (var h = 0; h < 3; h++) if (Z.api.hit("hot" + (h + 1))) I.hot(h); } catch (e) {}
    if (opened && box && !box.hidden && (I._placeT = (I._placeT || 0) - dt) <= 0) { I._placeT = .5; place(); }
  };

  /* ---------- hooks into the running game ---------- */
  var oBegin = Z.begin; if (oBegin) Z.begin = function (p) { try { I.ensure(p); } catch (e) { I.err = e; } I.ground = []; var r = oBegin.apply(Z, arguments); return r; };
  var oUpd = Z.update; if (oUpd) Z.update = function (dt) { var r = oUpd.apply(Z, arguments); try { I.tick(dt); } catch (e) { if (!I.uerr) { I.uerr = e; if (typeof console !== "undefined") console.error(e); } } return r; };

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function toast(h) { try { if (Z.toast) Z.toast(h); } catch (e) {} I.lastToast = h; }
  function sfx(n) { try { Z.api.sound.sfx(n); } catch (e) {} }
  I.esc = esc; void lowNote;
})();
