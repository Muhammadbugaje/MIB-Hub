/* Freshers School Life — wardrobe: what everybody wears, the shops that sell it, and the fitting room.
   Data lives in samaru-data.js (D.WARDROBE, D.BRANDS, D.FITS); the rules (S.fitClean, S.fitPack, S.randomFit,
   S.modest) in samaru-sim.js. This file turns an outfit into a "spec" the character rig draws (W.spec), gives prints
   their textures (W.tex), draws the invented brand logos (W.logo), and runs buying, the closet and the editor.
   Other modules call: W.editor(mode, onDone, opts)  mode = "create" | "closet" | "shop" (opts.store);
   W.stock(storeId), W.buy(itemId), W.lookOf(P, ch), W.key(P). */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData, W = Z.wardrobe = {}, BY = {}, BR = {};
  D.WARDROBE.forEach(function (it) { BY[it.id] = it; }); D.BRANDS.forEach(function (b) { BR[b.id] = b; });
  var FREE = { tee: 1, trousers: 1, sneaklow: 1, bathslip: 1 }, PANTS = ["#1f2937", "#1e3a5f", "#3b2f2f", "#374151", "#26324a"], SHOES = ["#f8fafc", "#111827", "#dc2626", "#2563eb", "#f59e0b"];
  W.item = function (id) { return BY[S.wornId(id)] || null; };
  W.brand = function (id) { return BR[id] || null; };
  W.prim = function (c) { c = String(c || "#888888"); return c.indexOf("|") < 0 ? c : c.split("|")[1]; }; // the main colour of a plain colour or a print
  function colOf(v) { var it = W.item(v); return it ? it.cols[Math.min(it.cols.length - 1, S.wornCol(v))] : "#888888"; }
  function part(v) { var it = W.item(v); return it ? { kind: it.kind, c: colOf(v), trim: it.trim || "" } : null; }

  /* ---------- outfit → what the rig draws ---------- */
  // top kind → [sleeves, collar, front detail, tunic length]
  var TOPS = { tee: ["short", "ring", "", 0], polo: ["short", "polo", "", 0], shirt: ["long", "shirt", "buttons", 0], hoodie: ["long", "hood", "pocket", 0], jersey: ["short", "v", "jersey", 0], sweater: ["long", "thick", "", 0], dashiki: ["wide", "v", "yoke", .3], senator: ["long", "mandarin", "buttons", .42], kurta: ["long", "mandarin", "buttons", .6], tang: ["long", "mandarin", "frogs", .12], wrap: ["wide", "wrap", "", .2] };
  // full outfit kind → [sleeves, collar, front, shell kind, shell length]
  var ONES = { kaftan: ["long", "mandarin", "buttons", "robe", .74], jalabiya: ["long", "ring", "", "robe", .9], abaya: ["wide", "ring", "", "robe", .9], gown: ["long", "ring", "", "robe", .9], native: ["wide", "ring", "", "skirt", .88], agbada: ["wide", "mandarin", "", "robe", .9], khaki: ["long", "shirt", "buttons", "", 0], grad: ["wide", "ring", "stole", "robe", .9] };
  var OUTERS = { blazer: [.2, "lapel"], labcoat: [.62, "lapel"], cardigan: [.18, ""], jacket: [.08, "mandarin"] };
  var HIDE = { hijab: 1, hijablong: 1, turban: 1, gele: 1, scarf: 1 };
  function compose(look, p) {
    var s = { skin: look.skin, hair: p.hair || "low", hairCol: p.hairCol || "#1a1210", beard: p.beard || "", brow: p.brow || "flat", eyes: p.eyes || "round", head: p.head || null, eye: p.eye || null, acc: p.acc || [], shell: null, wings: false, open: null, front: "", trim: "", shorts: false, sleeveC: "", shoe: p.shoes || { kind: "low", c: "#f8fafc" } };
    s.hideHair = !!(s.head && HIDE[s.head.kind]);
    if (p.one) { var o = ONES[p.one.kind] || ONES.gown; s.torso = p.one.c; s.legs = p.one.kind === "khaki" ? p.one.c : W.prim(p.one.c); s.sleeves = o[0]; s.collar = o[1]; s.front = o[2]; s.trim = p.one.trim || (p.one.kind === "grad" ? "#fde047" : ""); if (o[3]) s.shell = { k: o[3], c: p.one.c, len: o[4] }; s.wings = p.one.kind === "agbada"; if (p.one.kind === "kaftan") s.legs = p.one.c; }
    else {
      var t = p.top || { kind: "tee", c: "#2563eb" }, b = p.bottom || { kind: "trousers", c: "#1f2937" }, tk = TOPS[t.kind] || TOPS.tee;
      s.torso = t.c; s.sleeves = tk[0]; s.collar = tk[1]; s.front = tk[2]; s.trim = t.trim || ""; s.text = t.text || ""; s.legs = b.c; s.shorts = b.kind === "shorts";
      if (b.kind === "skirt") { s.shell = { k: "skirt", c: b.c, len: .86 }; s.legs = W.prim(b.c); if (tk[3] > .3) tk = [tk[0], tk[1], tk[2], .3]; }
      if (tk[3] && !s.shell) s.shell = { k: "tunic", c: t.c, len: tk[3] }; else if (tk[3] && s.shell) s.tunic2 = { c: t.c, len: tk[3] };
      if (p.outer) { var ok = OUTERS[p.outer.kind] || OUTERS.blazer; s.sleeves = "long"; s.sleeveC = p.outer.c; s.text = ""; if (p.outer.kind === "jacket") { s.torso = p.outer.c; s.collar = "mandarin"; s.front = "zip"; } else { s.open = t.c; s.torso = p.outer.c; s.front = ok[1] ? "lapel" : ""; s.collar = s.collar === "hood" ? "hood" : "ring"; } s.trim = p.outer.trim || s.trim; if (ok[0] > .1 && (!s.shell || s.shell.k === "tunic")) s.shell = { k: "tunic", c: p.outer.c, len: Math.max(ok[0], s.shell ? s.shell.len : 0), open: true }; }
    }
    return s;
  }
  function seedOf(look) { var t = String(look.skin) + String(look.top) + String(look.hair) + String(look.pitch || ""), h = 7; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
  function partsOf(fit, look) {
    return { hair: fit.hair, hairCol: D.HAIR_COLS[fit.hc | 0] || look.hairCol, beard: fit.beard, brow: fit.brow, eyes: fit.eyes, head: part(fit.head), eye: part(fit.eye), top: (function (t) { if (t && fit.txt && W.item(fit.top).custom) t.text = fit.txt; return t; })(part(fit.top)), bottom: part(fit.bottom), one: part(fit.one), outer: part(fit.outer), shoes: part(fit.shoes), acc: (fit.acc || []).map(part).filter(Boolean) };
  }
  function legacy(look, mode) { // people defined the old way: a hair style, a top colour and one of five modes
    var sd = seedOf(look), p = { hair: look.hair, hairCol: look.hairCol, shoes: { kind: "low", c: SHOES[(sd >> 3) % SHOES.length] }, bottom: { kind: "trousers", c: PANTS[sd % PANTS.length] } };
    if (look.hair === "hijab") { p.head = { kind: "hijab", c: look.hairCol || "#7c3aed" }; p.hair = "low"; p.hairCol = "#1a1210"; }
    else if (look.hair === "cap") { p.head = { kind: "kufi", c: look.hairCol || "#f8fafc" }; p.hair = "low"; p.hairCol = "#1a1210"; }
    if (mode === "kaftan") { p.one = { kind: "kaftan", c: look.top }; p.shoes = { kind: "slipper", c: "#3b2a1a" }; }
    else if (mode === "ankara") p.top = { kind: "dashiki", c: "ankara|" + look.top + "|#111827" };
    else if (mode === "jersey") p.top = { kind: "jersey", c: look.top };
    else if (mode === "coat") { p.top = { kind: "polo", c: look.top }; p.outer = { kind: "labcoat", c: "#f8fafc" }; }
    else p.top = { kind: "tee", c: look.top };
    return p;
  }
  // The spec for anyone: a chosen outfit (look.fit), a random one for walkers, or the old look-and-mode.
  W.spec = function (look, mode) {
    var fit = look.fit, k = (typeof fit === "string" ? fit : fit ? S.fitPack(fit) : "") + "|" + (mode || "");
    if (look._sp && look._spk === k) return look._sp;
    if (typeof fit === "string") fit = S.fitClean(S.fitUnpack(fit), D.WARDROBE);
    if (!fit && look.mode && look.voice && !look.sig) fit = S.randomFit(D.WARDROBE, seedOf(look), { sex: look.voice === "female" ? "f" : "m", hijab: look.hair === "hijab", hair: look.hair === "hijab" || look.hair === "cap" ? "low" : look.hair });
    var sp = compose(look, fit ? partsOf(fit, look) : legacy(look, mode));
    try { look._sp = sp; look._spk = k; } catch (e) {}
    return sp;
  };
  // A flat description for the 2D drawings: the nearest of the old hair styles plus glasses and beard.
  W.flat = function (look) {
    var sp = W.spec(look, look.mode), hk = sp.head && sp.head.kind, hair = { afrobig: "afro", cornrows: "low", twists: "coily", waves: "low", bun: "puff", ponytail: "puff", braidshort: "locs" }[sp.hair] || sp.hair, col = sp.hairCol;
    if (hk) { if (HIDE[hk]) { hair = "hijab"; col = W.prim(sp.head.c); } else { hair = "cap"; col = W.prim(sp.head.c); } }
    return { skin: sp.skin, hair: hair, hairCol: col, top: W.prim(sp.torso), glasses: sp.eye ? sp.eye.kind : "", glassCol: sp.eye ? W.prim(sp.eye.c) : "", beard: sp.beard, beardCol: sp.hairCol, mode: look.mode };
  };

  /* ---------- prints and logos ---------- */
  var texs = {};
  function paintPrint(x, n, str) {
    var a = str.split("|"), k = a[0], c1 = a[1], c2 = a[2], i, j; x.fillStyle = c1; x.fillRect(0, 0, n, n); x.fillStyle = c2; x.strokeStyle = c2;
    if (k === "stripe") { for (i = 0; i < 4; i++) x.fillRect(0, i * n / 4, n, n / 8); }
    else if (k === "check") { x.globalAlpha = .55; for (i = 0; i < 4; i++) { x.fillRect(i * n / 4, 0, n / 8, n); x.fillRect(0, i * n / 4, n, n / 8); } x.globalAlpha = 1; }
    else if (k === "adire") { x.lineWidth = n / 32; for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) { var cx = (i + .5) * n / 2, cy = (j + .5) * n / 2; for (var q = 1; q <= 3; q++) { x.beginPath(); x.arc(cx, cy, q * n / 14, 0, 7); x.stroke(); } } x.fillRect(0, n / 2 - 1, n, 2); x.fillRect(n / 2 - 1, 0, 2, n); }
    else { for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) { var px = (i + .5) * n / 2, py = (j + .5) * n / 2; x.beginPath(); x.arc(px, py, n / 6, 0, 7); x.fill(); x.fillStyle = c1; x.beginPath(); x.arc(px, py, n / 13, 0, 7); x.fill(); x.fillStyle = c2; for (var t = 0; t < 8; t++) { x.beginPath(); x.arc(px + Math.cos(t * .785) * n / 4.3, py + Math.sin(t * .785) * n / 4.3, n / 40, 0, 7); x.fill(); } } x.fillRect(0, 0, n, n / 32); x.fillRect(0, n / 2, n, n / 32); }
  }
  W.tex = function (T, str) { if (texs[str]) return texs[str]; var c = document.createElement("canvas"); c.width = c.height = 64; paintPrint(c.getContext("2d"), 64, str); var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 2); if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; return (texs[str] = t); };
  // The words on a custom shirt, as a small transparent texture (ink chosen to show on the shirt colour).
  W.textTex = function (T, text, shirt) { var k = "txt|" + text + "|" + shirt; if (texs[k]) return texs[k]; var c = document.createElement("canvas"); c.width = 256; c.height = 64; var x = c.getContext("2d"), h = parseInt(String(shirt).replace("#", ""), 16) || 0, lum = ((h >> 16) & 255) * .3 + ((h >> 8) & 255) * .59 + (h & 255) * .11, s = 44, t = String(text).toUpperCase();
    x.clearRect(0, 0, 256, 64); x.textAlign = "center"; x.textBaseline = "middle"; do { x.font = "900 " + s + "px system-ui, 'Arial Black', sans-serif"; s -= 2; } while (x.measureText(t).width > 240 && s > 14); x.fillStyle = lum > 150 ? "#b8860b" : "#fde047"; x.fillText(t, 128, 34);
    var tx = new T.CanvasTexture(c); if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace; return (texs[k] = tx); };
  // A walker says hello: a stable first name from D.NAMES and a line in their own voice.
  W.nameOf = function (o) { if (o.def && o.def.name) return o.def.name; if (!o.nm) o.nm = S.nameFor(D.NAMES, seedOf(o.look || {}) + ((o.k | 0) * 131), (o.look || {}).voice === "female" ? "f" : "m"); return o.nm; };
  var HELLO = ["I'm {n}. You are new here, abi?", "{n}. 200 level. Welcome to {{GAME_INITIALS}}.", "They call me {n}. How far?", "{n} is the name. See you in class.", "I'm {n}. Have you eaten at Shinkafi yet?", "{n}. Don't be late for the 8 o'clock."];
  W.greet = function (o) { var n = W.nameOf(o), line = HELLO[(seedOf(o.look || {}) + n.length) % HELLO.length].replace("{n}", n), lk = o.look || {}; o.wave = 1.6; o.a = Math.atan2(Z.me.y - o.y, Z.me.x - o.x); if (Z.sub) Z.sub("", n + ": " + line, 3.5); if (Z.api) Z.api.sound.say(line, { voice: lk.voice, pitch: lk.pitch }); return n; };
  W.swatch = function (c) { c = String(c); if (c.indexOf("|") < 0) return "background:" + c; var a = c.split("|"); return a[0] === "stripe" ? "background:repeating-linear-gradient(0deg," + a[1] + " 0 4px," + a[2] + " 4px 8px)" : a[0] === "check" ? "background:repeating-linear-gradient(90deg," + a[2] + "88 0 3px,transparent 3px 8px),repeating-linear-gradient(0deg," + a[2] + "88 0 3px," + a[1] + " 3px 8px)" : "background:radial-gradient(circle at 50% 50%," + a[1] + " 0 18%," + a[2] + " 19% 46%," + a[1] + " 47%)"; };
  // An invented mark for each brand: a simple shape and its initials. Nothing here imitates a real logo.
  W.logo = function (x, id, cx, cy, r) {
    var b = BR[id]; if (!b) return; x.save(); x.fillStyle = b.col; x.strokeStyle = b.ink; x.lineWidth = Math.max(1, r * .12); x.beginPath();
    if (b.shape === "diamond") { x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); }
    else if (b.shape === "square" || b.shape === "tag") { x.rect(cx - r * .9, cy - r * .9, r * 1.8, r * 1.8); }
    else if (b.shape === "shield" || b.shape === "crest") { x.moveTo(cx - r * .85, cy - r * .9); x.lineTo(cx + r * .85, cy - r * .9); x.lineTo(cx + r * .85, cy + r * .1); x.quadraticCurveTo(cx + r * .7, cy + r * .8, cx, cy + r); x.quadraticCurveTo(cx - r * .7, cy + r * .8, cx - r * .85, cy + r * .1); x.closePath(); }
    else if (b.shape === "arch") { x.moveTo(cx - r * .8, cy + r * .9); x.lineTo(cx - r * .8, cy - r * .1); x.arc(cx, cy - r * .1, r * .8, Math.PI, 0); x.lineTo(cx + r * .8, cy + r * .9); x.closePath(); }
    else if (b.shape === "bolt") { x.moveTo(cx - r * .9, cy - r * .6); x.lineTo(cx + r * .9, cy - r * .9); x.lineTo(cx + r * .6, cy + r * .6); x.lineTo(cx - r * .9, cy + r * .9); x.closePath(); }
    else if (b.shape === "sole") { x.ellipse(cx, cy, r * .7, r, 0, 0, 7); }
    else x.arc(cx, cy, r, 0, 7);
    x.fill(); x.stroke(); if (b.shape === "ring") { x.beginPath(); x.arc(cx, cy, r * .62, 0, 7); x.stroke(); } if (b.shape === "crest") { x.beginPath(); x.moveTo(cx - r * .55, cy - r * .62); x.lineTo(cx + r * .55, cy - r * .62); x.stroke(); }
    x.fillStyle = b.ink; x.textAlign = "center"; x.textBaseline = "middle"; x.font = "900 " + Math.round(r * (b.glyph.length > 2 ? .62 : b.glyph.length > 1 ? .8 : 1.1)) + "px system-ui, sans-serif"; x.fillText(b.glyph, cx, cy + r * .08); x.restore();
  };

  /* ---------- owning, wearing, buying ---------- */
  function P() { return Z.P; }
  W.owns = function (id, p) { p = p || P(); var it = BY[id]; if (!it) return false; if (it.locked) return !!p && p.char === it.locked; return !!FREE[id] || !!(p && p.closet && p.closet[id]) || (S.isHero(p) && it.brand === "mib"); };
  W.fromLook = function (ch, mode, skinOnly) { // an outfit in wardrobe items that matches an old look-and-mode
    var hair = ch.hair === "hijab" || ch.hair === "cap" ? "low" : ch.hair || "low", fit = { hair: hair, hc: 0, acc: [] };
    if (ch.id === "bugaje") return S.fitClean(Object.assign({ hair: "coily" }, D.FITS.maker), D.WARDROBE);
    if (ch.hair === "hijab") fit.head = "hijab.0"; else if (ch.hair === "cap") fit.head = "kufi.0";
    if (mode === "kaftan") { fit.one = "kaftan.0"; fit.shoes = "palms.0"; } else if (mode === "ankara") fit.top = "dashiki.0"; else if (mode === "jersey") fit.top = "jersey.0"; else if (mode === "coat") { fit.top = "polo.2"; fit.outer = "labcoat.0"; } else fit.top = "tee.1";
    void skinOnly; return S.fitClean(fit, D.WARDROBE);
  };
  W.fitOf = function (p) { p = p || P(); if (p.fit) return p.fit; var ch = Z.charOf(p.char); return W.fromLook(ch, (D.OUTFITS[p.outfit || 0] || {}).mode); };
  W.key = function (p) { return p && p.fit ? S.fitPack(p.fit) : ""; };
  var looks = {};
  W.lookOf = function (p, ch) { if (!p.fit && ch.id !== "bugaje") return ch; var fit = p.fit || W.fitOf(p), k = ch.id + "|" + ch.skin + "|" + S.fitPack(fit); if (!looks[k]) { looks = {}; var o = Object.create(ch); o.fit = fit; looks[k] = o; } return looks[k]; };
  W.peerLook = function (ch, packed) { if (!packed) return ch; var k = "peer|" + ch.id + "|" + packed, o = looks[k]; if (!o) { o = looks[k] = Object.create(ch); o.fit = packed; } return o; };
  W.adopt = function (p, fit) { p.fit = S.fitClean(fit, D.WARDROBE); p.closet = p.closet || {}; ["head", "eye", "top", "bottom", "one", "outer", "shoes"].forEach(function (k) { if (p.fit[k]) p.closet[S.wornId(p.fit[k])] = 1; }); p.fit.acc.forEach(function (v) { p.closet[S.wornId(v)] = 1; }); return p.fit; };
  W.stock = function (storeId) { // the items a shop sells, cheapest first
    var brands = D.WARD_STORES[storeId] || (BR[storeId] ? [storeId] : null);
    if (!brands) { var h = 0, s = String(storeId); for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; var pool = D.BRANDS.filter(function (b) { return b.id !== "mib"; }); brands = [pool[h % pool.length].id, pool[(h >> 4) % pool.length].id]; }
    return D.WARDROBE.filter(function (it) { return brands.indexOf(it.brand) >= 0 && !it.locked; }).sort(function (a, b) { return a.price - b.price; });
  };
  W.canBuy = function (id, p) { p = p || P(); var it = BY[id]; if (!it || it.locked) return "Not for sale."; if (W.owns(id, p)) return "You already own this."; if (p.lvl < it.lvl) return "Needs level " + it.lvl + "."; if (p.money < it.price) return "You need ₦" + (it.price - p.money).toLocaleString() + " more."; return ""; };
  W.buy = function (id) { var p = P(), why = W.canBuy(id, p), it = BY[id]; if (why) { if (Z.api) Z.api.sound.sfx("block"); return { ok: false, why: why }; } if (Z.money) Z.money(-it.price); else p.money -= it.price; p.closet = p.closet || {}; p.closet[id] = 1; if (Z.emit) Z.emit({ t: "buy", item: id }); if (Z.save) Z.save(); return { ok: true, item: it }; };
  W.wear = function (fit, v) { // put an item on a working outfit, following the slot rules
    var it = W.item(v); if (!it) return fit; fit = JSON.parse(JSON.stringify(fit));
    if (it.slot === "acc") { fit.acc = (fit.acc || []).filter(function (o) { var q = W.item(o); return q && q.kind !== it.kind; }); fit.acc.push(v); if (fit.acc.length > 3) fit.acc.shift(); }
    else { fit[it.slot] = v; if (it.slot === "one") { delete fit.top; delete fit.bottom; delete fit.outer; } else if (it.slot === "top" || it.slot === "bottom" || it.slot === "outer") { if (fit.one) { delete fit.one; } } }
    return S.fitClean(fit, D.WARDROBE);
  };
  W.takeOff = function (fit, slot, id) { fit = JSON.parse(JSON.stringify(fit)); if (slot === "acc") fit.acc = (fit.acc || []).filter(function (o) { return S.wornId(o) !== id; }); else delete fit[slot]; return S.fitClean(fit, D.WARDROBE); };
  W.saveSlot = function (i, fit) { var p = P(); p.fits = p.fits || []; p.fits[i] = S.fitPack(fit); if (Z.save) Z.save(); };
  W.loadSlot = function (i) { var p = P(), s = (p.fits || [])[i]; return s ? S.fitClean(S.fitUnpack(s), D.WARDROBE) : null; };
  W.unowned = function (fit, p) { var out = []; ["head", "eye", "top", "bottom", "one", "outer", "shoes"].forEach(function (k) { if (fit[k] && !W.owns(S.wornId(fit[k]), p)) out.push(S.wornId(fit[k])); }); (fit.acc || []).forEach(function (v) { if (!W.owns(S.wornId(v), p)) out.push(S.wornId(v)); }); return out; };

  /* ---------- the fitting room ---------- */
  var ed = null, css = false;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function style() { if (css || !document.head) return; css = true; var st = document.createElement("style"); st.textContent =
    "[data-gm-overlay].fw-open{background:linear-gradient(90deg,rgba(5,12,20,0) 0,rgba(5,12,20,0) 38%,rgba(5,12,20,.55) 60%)!important;padding:8px!important;place-items:stretch!important;align-items:stretch!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}[data-gm-overlay].fw-open .gm-dlg{animation:none!important;opacity:1!important;transform:none!important;width:100%!important;max-width:none!important;height:100%!important;padding:0!important;display:block!important;background:none!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}" +
    ".fw{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,54%);gap:10px;width:100%;height:100%;text-align:left;align-items:stretch}.fw-view{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;min-width:0}.fw-view canvas{width:min(150px,70%);height:auto;border-radius:16px}.fw-panel{background:rgba(8,18,28,.86);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:0;max-height:100%}.fw-tabs{display:flex;gap:6px;overflow-x:auto;flex:none;padding-bottom:2px}.fw-tabs button{flex:none}.fw-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:6px;overflow-y:auto;min-height:60px;flex:1;align-content:start;grid-auto-rows:min-content}.fw-it{display:grid;grid-template-columns:22px 1fr;gap:2px 6px;align-items:center;text-align:left;padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:13px;cursor:pointer}.fw-it[aria-pressed=true]{border-color:#fde047;background:rgba(253,224,71,.14)}.fw-it small{grid-column:2;opacity:.8;font-size:11px}.fw-it i{width:20px;height:20px;border-radius:6px;border:1px solid rgba(255,255,255,.4);grid-row:span 2}.fw-cols{display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:none}.fw-cols button{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.35);cursor:pointer;padding:0}.fw-cols button[aria-pressed=true]{border-color:#fde047;box-shadow:0 0 0 2px #fde04766}.fw-foot{display:flex;gap:6px;flex-wrap:wrap;flex:none;align-items:center}.fw-foot .gm-btn{padding:8px 12px}.fw-note{font-size:12px;opacity:.85;flex:1;min-width:120px}.fw-brand{display:flex;gap:8px;align-items:center;font-size:12px;opacity:.9;flex:none}.fw-brand canvas{width:28px;height:28px;flex:none}" +
    "@media (max-width:620px),(max-height:430px){.fw{gap:6px}.fw-panel{padding:6px;gap:5px}.fw-list{grid-template-columns:repeat(auto-fill,minmax(112px,1fr))}.fw-it{font-size:12px;padding:5px 6px}.fw-foot .gm-btn{padding:6px 9px;font-size:13px}.fw-view canvas{width:84px}}@media (max-width:520px) and (orientation:portrait){.fw{grid-template-columns:1fr;grid-template-rows:minmax(90px,30%) 1fr}}";
    document.head.appendChild(st); }
  function tabs() { var t = [["hair", "Hair"], ["face", "Face"]].concat(D.WARD_SLOTS); if (ed.mode !== "create") t.push(["saved", "Saved"]); if (ed.mode === "shop") t = D.WARD_SLOTS.filter(function (s) { return ed.stock.some(function (it) { return it.slot === s[0]; }); }); return t; }
  function pool(slot) { var p = P(); if (ed.mode === "shop") return ed.stock.filter(function (it) { return it.slot === slot; }); if (ed.mode === "create") return D.WARDROBE.filter(function (it) { return it.slot === slot && ed.starter[it.id]; }); return D.WARDROBE.filter(function (it) { return it.slot === slot && W.owns(it.id, p); }); }
  function wornIn(slot, id) { var f = ed.fit; return slot === "acc" ? (f.acc || []).filter(function (v) { return S.wornId(v) === id; })[0] : (S.wornId(f[slot]) === id ? f[slot] : ""); }
  function render() {
    var p = P(), tb = tabs(), t = ed.tab, html = "", body = "", foot = "", f = ed.fit; if (!tb.some(function (q) { return q[0] === t; })) t = ed.tab = tb[0][0];
    function btn(act, label, on, sw, sub) { return "<button type='button' class='fw-it' data-act='" + act + "' aria-pressed='" + !!on + "'>" + (sw ? "<i style='" + sw + "'></i>" : "<i></i>") + "<b>" + esc(label) + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</button>"; }
    if (t === "hair") { body = D.HAIRS.map(function (h) { return btn("h:" + h[0], h[1], f.hair === h[0], "background:" + D.HAIR_COLS[f.hc | 0]); }).join(""); foot = "<div class='fw-cols'>" + D.HAIR_COLS.map(function (c, i) { return "<button type='button' data-act='hc:" + i + "' aria-pressed='" + ((f.hc | 0) === i) + "' aria-label='Hair colour " + (i + 1) + "' style='background:" + c + "'></button>"; }).join("") + "</div>"; }
    else if (t === "face") body = D.BEARDS.map(function (b) { return btn("b:" + b[0], b[1], (f.beard || "") === b[0]); }).join("") + D.BROWS.map(function (b) { return btn("w:" + b[0], b[1], (f.brow || "flat") === b[0]); }).join("") + D.EYES.map(function (b) { return btn("y:" + b[0], b[1], (f.eyes || "round") === b[0]); }).join("");
    else if (t === "saved") body = [0, 1, 2, 3, 4].map(function (i) { var has = (p.fits || [])[i]; return btn("l:" + i, "Outfit " + (i + 1), false, "", has ? "Tap to wear" : "Empty") + btn("s:" + i, "Save here", false, "", "Keeps what you have on"); }).join("");
    else {
      var list = pool(t); body = list.map(function (it) { var w = wornIn(t, it.id), own = W.owns(it.id, p) || ed.mode === "create"; return btn("i:" + it.id, it.name, !!w, W.swatch(it.cols[w ? S.wornCol(w) : 0]), own ? (w ? "Wearing" : ed.mode === "shop" ? "Owned" : (W.brand(it.brand) || {}).name) : "₦" + it.price.toLocaleString() + (p && p.lvl < it.lvl ? " · level " + it.lvl : "")); }).join("") || "<p class='fw-note'>Nothing here yet. The shops in the market and the MIB Store sell more.</p>";
      var sel = BY[ed.sel]; if (sel && sel.slot === t) { var sw = wornIn(t, sel.id), b = W.brand(sel.brand);
        foot = "<div class='fw-brand'><canvas width='56' height='56' data-fwlogo='" + sel.brand + "'></canvas><span><b>" + esc(b.name) + "</b> · " + esc(sel.name) + "<br>" + esc(b.line) + "</span></div><div class='fw-cols'>" + sel.cols.map(function (c, i) { return "<button type='button' data-act='c:" + i + "' aria-pressed='" + (!!sw && S.wornCol(sw) === i) + "' aria-label='Colour " + (i + 1) + "' style='" + W.swatch(c) + "'></button>"; }).join("") + (sw && t !== "top" && t !== "bottom" && t !== "shoes" ? "<button type='button' class='gm-btn gm-btn--sm' data-act='off' style='width:auto;height:auto;border-radius:10px;padding:4px 10px'>Take off</button>" : "") + "</div>" +
          (sel.custom && sw ? "<div class='fw-cols'><input type='text' data-fwtext maxlength='12' value='" + esc((f.txt || "").toUpperCase()) + "' placeholder='YOUR TEXT' aria-label='Shirt text' style='flex:1;min-width:120px;padding:8px 10px;border-radius:10px;border:1px solid rgba(253,224,71,.6);background:rgba(255,255,255,.08);color:#fff;font:inherit;text-transform:uppercase'><button type='button' class='gm-btn gm-btn--sm' data-act='x:' style='width:auto;height:auto;border-radius:10px;padding:6px 12px'>Print</button></div>" : ""); }
    }
    var need = ed.mode === "create" ? [] : W.unowned(f, p), cost = need.reduce(function (a, id) { return a + BY[id].price; }, 0), block = need.map(function (id) { return W.canBuy(id, p); }).filter(function (w) { return w && w.indexOf("more") < 0; })[0] || (need.length && p.money < cost ? "You need ₦" + (cost - p.money).toLocaleString() + " more." : "");
    html = "<div class='fw'><div class='fw-view'>" + (ed.mode === "create" || !Z.r3 || !Z.r3.ready ? "<canvas width='240' height='240' data-fwface></canvas>" : "") + "<small class='fw-note' style='text-align:center;flex:none'>" + (ed.mode === "shop" ? esc(ed.title) + " · ₦" + Math.round(p.money).toLocaleString() : ed.mode === "create" ? "Pick how you start" : "Your closet") + "</small></div><div class='fw-panel'><div class='fw-tabs'>" + tb.map(function (q) { return "<button type='button' class='gm-btn gm-btn--sm' data-act='t:" + q[0] + "' aria-pressed='" + (q[0] === t) + "'>" + q[1] + "</button>"; }).join("") + "</div><div class='fw-list'>" + body + "</div>" + foot +
      "<div class='fw-foot'>" + (need.length ? "<button type='button' class='gm-btn gm-btn--go' data-act='buy'" + (block ? " disabled style='opacity:.5'" : "") + ">Buy " + need.length + " · ₦" + cost.toLocaleString() + "</button><span class='fw-note'>" + esc(block || "Trying on: " + need.map(function (id) { return BY[id].name; }).join(", ")) + "</span>" : "<span class='fw-note'>" + esc(ed.msg || "") + "</span>") + "<button type='button' class='gm-btn" + (need.length ? "" : " gm-btn--go") + "' data-act='done'>" + (need.length ? "Leave without them" : "Done") + "</button></div></div></div>";
    Z.api.show(html, act); paint(); ed.msg = "";
    if (ed.mode !== "create" && p) { p.fit = f; } // what you try on is what the 3D view shows
  }
  function paint() {
    var root = document.querySelector && document.querySelector("[data-gm-overlay]"); if (!root || !root.querySelectorAll) return;
    [].forEach.call(root.querySelectorAll("canvas[data-fwlogo]"), function (cv) { var x = cv.getContext("2d"); x.clearRect(0, 0, 56, 56); W.logo(x, cv.getAttribute("data-fwlogo"), 28, 28, 24); });
    var fc = root.querySelector("canvas[data-fwface]"); var G = window.SamaruDraw; if (fc && G && G.face) { var x = fc.getContext("2d"), lk = Object.create(ed.ch); lk.fit = ed.fit; x.clearRect(0, 0, 240, 240); G.face(x, lk, 120, 110, 66); }
  }
  function act(a) {
    var k = a.split(":")[0], v = a.slice(k.length + 1), f = ed.fit, p = P();
    if (k === "t") ed.tab = v; else if (k === "h") { f.hair = v; ed.fit = S.fitClean(f, D.WARDROBE); } else if (k === "hc") f.hc = +v; else if (k === "b") f.beard = v; else if (k === "w") f.brow = v; else if (k === "y") f.eyes = v;
    else if (k === "i") { var it = BY[v], w = wornIn(it.slot, v); ed.sel = v; if (!w) ed.fit = W.wear(f, v + ".0"); }
    else if (k === "c") { var s = BY[ed.sel]; if (s) ed.fit = W.wear(f, s.id + "." + v); }
    else if (k === "x") { var inp = document.querySelector && document.querySelector("[data-gm-overlay] [data-fwtext]"), raw = v || (inp ? inp.value : ""), tx = S.shirtText(raw); if (raw && !tx) ed.msg = "Those words cannot go on a shirt. Try something else."; else { f.txt = tx; ed.fit = S.fitClean(f, D.WARDROBE); ed.msg = tx ? "Printed: " + tx.toUpperCase() : "Text removed."; } }
    else if (k === "off") { var q = BY[ed.sel]; if (q) ed.fit = W.takeOff(f, q.slot, q.id); }
    else if (k === "s") { if (W.unowned(f, p).length) ed.msg = "Buy what you are trying on first."; else { W.saveSlot(+v, f); ed.msg = "Saved as outfit " + (+v + 1) + "."; } }
    else if (k === "l") { var g = W.loadSlot(+v); if (g && !W.unowned(g, p).length) ed.fit = g; else ed.msg = g ? "You no longer own all of that outfit." : "That slot is empty."; }
    else if (k === "buy") { var ids = W.unowned(f, p), bad = ""; ids.forEach(function (id) { var r = W.buy(id); if (!r.ok) bad = r.why; }); ed.msg = bad || "Bought. Wear it well."; if (!bad && Z.api.confetti) Z.api.confetti(40); }
    else if (k === "done") return finish();
    render();
  }
  function finish() {
    var p = P(), e = ed, fit = e.fit; ed = null; if (e.spin) cancelAnimationFrame(e.spin);
    if (e.mode !== "create" && p) { // anything not paid for goes back on the rail
      W.unowned(fit, p).forEach(function (id) { var it = BY[id]; fit = it.slot === "acc" ? W.takeOff(fit, "acc", id) : (e.base[it.slot] && W.owns(S.wornId(e.base[it.slot]), p) ? W.wear(fit, e.base[it.slot]) : W.takeOff(fit, it.slot, id)); });
      if (W.unowned(fit, p).length) fit = e.base; p.fit = S.fitClean(fit, D.WARDROBE); if (Z.save) Z.save();
      if (Z.r3 && e.cam) { Z.r3.zoom = e.cam.zoom; Z.r3.pitch = e.cam.pitch; Z.r3.yaw = e.cam.yaw; Z.r3.manual = 0; }
    }
    Z.api.hide(); var root = document.querySelector && document.querySelector("[data-gm-overlay]"); if (root && root.classList) root.classList.remove("fw-open"); slide(false);
    if (e.done) e.done(e.mode === "create" ? S.fitClean(fit, D.WARDROBE) : p.fit);
  }
  // mode "create": choose a starter look (no player yet; opts.char, opts.fit). "closet": what you own. "shop": opts.store.
  W.editor = function (mode, onDone, opts) {
    opts = opts || {}; style(); var p = P(), ch = opts.char || (p ? Z.charOf(p.char) : D.CAST[0]), base;
    if (mode === "create") base = opts.fit || W.fromLook(ch, (D.OUTFITS[opts.outfit || 0] || {}).mode); else { base = W.fitOf(p); if (!p.fit) W.adopt(p, base); }
    ed = { mode: mode, done: onDone, ch: ch, base: JSON.parse(JSON.stringify(base)), fit: S.fitClean(base, D.WARDROBE), tab: mode === "shop" ? "top" : "hair", sel: "", msg: "", starter: {}, stock: [], title: opts.title || (BR[opts.store] ? BR[opts.store].name : "Shop") };
    if (mode === "shop") { ed.stock = W.stock(opts.store || "market"); ed.tab = (ed.stock[0] || {}).slot || "top"; }
    if (mode === "create") { D.WARDROBE.forEach(function (it) { if (it.lvl <= 1 && it.price <= 3000 && it.brand !== "mib") ed.starter[it.id] = 1; }); D.STARTERS.forEach(function (s) { var f = D.FITS[s[0]]; Object.keys(f).forEach(function (k) { [].concat(f[k]).forEach(function (v) { ed.starter[S.wornId(v)] = 1; }); }); }); if (ch.id === "bugaje") D.WARDROBE.forEach(function (it) { if (it.brand === "mib") ed.starter[it.id] = 1; }); }
    if (mode !== "create" && Z.r3 && Z.r3.ready) { ed.cam = { zoom: Z.r3.zoom, pitch: Z.r3.pitch, yaw: Z.r3.yaw }; Z.r3.zoom = .5; Z.r3.pitch = .16; Z.r3.manual = 1e6; var spin = function () { if (!ed) return; Z.r3.yaw += .012; ed.spin = requestAnimationFrame(spin); }; if (typeof requestAnimationFrame === "function") ed.spin = requestAnimationFrame(spin); }
    var root = document.querySelector && document.querySelector("[data-gm-overlay]"); if (root && root.classList) root.classList.add("fw-open");
    if (mode !== "create") slide(true);
    render(); return ed;
  };
  function slide(on) { var cv = document.querySelector && document.querySelector("[data-gm-stage] canvas:not([data-gm-canvas])"); if (cv && cv.style) { cv.style.transform = on ? "translateX(-24%)" : ""; } } // move the 3D view left so you stand beside the panel
  W.editing = function () { return ed; };
  W.act = act; // for tests
})();
