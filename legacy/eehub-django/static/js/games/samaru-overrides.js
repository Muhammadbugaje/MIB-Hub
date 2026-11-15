/* The game config and what the super admin changed for everyone, applied over the game's own data
   (docs/MASTER_GAME_GUIDE.md §5 config, §7 credits; docs/story/ENGINE.md §16).

   window.GameConfig (also Z.resolveText, Z.config, Z.onConfig, Z.rollCredits once the game is loaded):
     cfg()                      the live config (D.CONFIG): gameName, gameShortName, initials, initialsOverride, tagline,
                                primaryColour, secondaryColour, currencyName, configVersion. Defaults: fslg.config.js
     resolveText(t, extra)      {{GAME_NAME}} {{GAME_SHORT}} {{GAME_INITIALS}} {{TAGLINE}} {{CURRENCY}} {{PLAYER_NAME}} {{AUTHOR}},
                                with |upper or |lower ("{{GAME_NAME|upper}}"). Unknown tokens are left as they are.
     setConfig(c)               change it live: data text, signs, menus, page title all follow (on() listeners)
     on(fn)                     fn(cfg) after every change; return false from fn to stop listening
     applyBundle(b)             apply the server's bundle { schema, v, config, credits, characters }; false if it is bad
     catalogue()                every person with their defaults and spoken lines (the editor uses this)
     creditLines(credits, cfg)  the end-credits scroll as plain rows; rollCredits(opts) plays it
   The bundle comes from /arcade/api/fslg/ at start-up, is kept in IndexedDB and in localStorage (the last good copy), and
   is applied before the campus people spawn. Missing or corrupt: the game's own data, and the game carries on.
   Load-time safe: nothing here touches window, document or storage until Z.setup runs. */
(function (root, f) { var m = f(root); if (typeof module === "object" && module.exports) module.exports = m; root.GameConfig = m; })(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";
  var F = {}, D = root.SamaruData, Z = root.SamaruGame, S = root.SamaruSim;
  var DEF0 = root.GameConfigDefault || {}, DEFAULT = { gameName: DEF0.gameName || "Campus Life", gameShortName: DEF0.gameShortName || "Game", initialsOverride: DEF0.initialsOverride || "",
    tagline: DEF0.tagline || "", author: DEF0.author || "", primaryColour: DEF0.primaryColour || "#f59e0b", secondaryColour: DEF0.secondaryColour || "#0f766e", currencyName: DEF0.currencyName || "naira",
    currencySymbol: DEF0.currencySymbol || "", configVersion: 0 };
  var FIELDS = { gameName: 60, gameShortName: 12, initialsOverride: 6, tagline: 120, author: 80, primaryColour: 7, secondaryColour: 7, currencyName: 20, currencySymbol: 3 };
  var TOKEN = /\{\{([A-Z_]+)(?:\|(upper|lower))?\}\}/g, CONFIG_TOKENS = { GAME_NAME: 1, GAME_SHORT: 1, GAME_INITIALS: 1, TAGLINE: 1, CURRENCY: 1, AUTHOR: 1 };
  var listeners = [], state = { v: -1, bundle: null, credits: null, applied: {}, source: "defaults" };
  F.DEFAULT = DEFAULT; F.state = state;

  /* ---------- config and tokens ---------- */
  F.initialsOf = function (name) { var w = String(name || "").match(/[A-Za-zÀ-ɏ]+|\d+/g) || []; return (w.map(function (x) { return x.charAt(0); }).join("").toUpperCase().slice(0, 6)) || "G"; };
  function cfgObj() { if (D) { if (!D.CONFIG) D.CONFIG = {}; return D.CONFIG; } return F._cfg || (F._cfg = {}); }
  function fill(c) { for (var k in DEFAULT) if (c[k] == null || c[k] === "") { if (k !== "initialsOverride" && k !== "currencySymbol" && k !== "tagline") c[k] = DEFAULT[k]; } c.initials = F.initialsOf(c.gameName); return c; }
  F.cfg = function () { return fill(cfgObj()); };
  F.shownInitials = function (c) { c = c || F.cfg(); return c.initialsOverride || c.initials; };
  F.resolveText = function (t, extra) {
    var c = F.cfg(), P = (Z && Z.P) || {};
    return String(t == null ? "" : t).replace(TOKEN, function (m, k, mod) {
      var v = extra && extra[k] != null ? extra[k] : { GAME_NAME: c.gameName, GAME_SHORT: c.gameShortName, GAME_INITIALS: F.shownInitials(c), TAGLINE: c.tagline, AUTHOR: c.author, CURRENCY: c.currencyName, PLAYER_NAME: P.name || "Fresher" }[k];
      if (v == null) return m; v = String(v); return mod === "upper" ? v.toUpperCase() : mod === "lower" ? v.toLowerCase() : v;
    });
  };
  // config tokens only: {{PLAYER_NAME}} stays for the moment the line is spoken
  function resolveCfg(t) { return F.resolveText(String(t).replace(/\{\{PLAYER_NAME((?:\|[a-z]+)?)\}\}/g, "\u0001$1\u0002"), null).replace(/\u0001([^\u0002]*)\u0002/g, "{{PLAYER_NAME$1}}"); }
  F.resolveCfg = resolveCfg;
  // Text written before the config existed: the old name and initials become tokens (MASTER_GAME_GUIDE §5.3)
  var OLD_NAME = /Freshers\s+School\s+Life(?:\s+Game)?/gi, OLD_INIT = /\bF[S]LG\b/g;
  F.tokenise = function (s) {
    if (typeof s !== "string" || !/reshers|RESHERS|F[S]LG/.test(s)) return s;
    return s.replace(OLD_NAME, function (m) { return m === m.toUpperCase() ? "{{GAME_NAME|upper}}" : "{{GAME_NAME}}"; }).replace(OLD_INIT, "{{GAME_INITIALS}}");
  };
  function cleanColour(v) { return /^#[0-9a-fA-F]{6}$/.test(v || "") ? String(v).toLowerCase() : ""; }
  function plain(v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n); }
  F.checkConfig = function (c) { // the same rules as games/fslg_admin.validate_config, for live feedback
    var err = []; c = c || {};
    if (!plain(c.gameName, 99)) err.push("The game needs a name."); else if (plain(c.gameName, 99).length > 60) err.push("The name is longer than 60 characters.");
    if (c.initialsOverride && !/^[A-Za-z0-9]{1,6}$/.test(c.initialsOverride)) err.push("Initials must be 1 to 6 letters or digits.");
    if (!plain(c.gameShortName, 99)) err.push("The short name cannot be empty."); else if (plain(c.gameShortName, 99).length > 12) err.push("The short name is longer than 12 characters.");
    ["primaryColour", "secondaryColour"].forEach(function (k) { if (c[k] && !cleanColour(c[k])) err.push(k + " must be a colour like #f59e0b."); });
    if (!plain(c.currencyName, 99)) err.push("The currency needs a name.");
    if (/\{\{|\}\}|[<>]/.test((c.gameName || "") + (c.gameShortName || ""))) err.push("The name cannot contain tokens or angle brackets.");
    return err;
  };
  F.setConfig = function (c, quiet) {
    if (!c || typeof c !== "object") return false; var o = cfgObj(), before = JSON.stringify(o);
    for (var k in FIELDS) if (c[k] != null) { var v = k.indexOf("Colour") > 0 ? cleanColour(c[k]) : plain(c[k], FIELDS[k]); if (v || k === "initialsOverride" || k === "tagline" || k === "currencySymbol") o[k] = k === "initialsOverride" ? v.toUpperCase().replace(/[^A-Z0-9]/g, "") : v; }
    if (c.configVersion != null) o.configVersion = +c.configVersion || 0;
    fill(o); if (!quiet && JSON.stringify(o) !== before) F.changed(); return true;
  };
  F.on = function (fn) { if (typeof fn === "function") listeners.push(fn); return fn; };
  F.changed = function () { retext(); var c = F.cfg(); listeners = listeners.filter(function (fn) { try { return fn(c) !== false; } catch (e) { warn("listener", e); return true; } }); };
  function warn(what, e) { try { if (root.console) console.warn("Game config: " + what, e || ""); } catch (x) {} }

  /* ---------- text slots: every data string that holds a token (or the old name), and every spoken line ---------- */
  var slots = [], lineSlot = typeof WeakMap === "function" ? new WeakMap() : null, scanned = false;
  function slot(o, k, base, line, raw) { var s = { o: o, k: k, base: base, raw: raw == null ? base : raw, over: null, line: line || null, dirty: false, group: "" }; slots.push(s); return s; }
  // Every spoken line in the game's data: [speakerId, text, voiceId?, flag?] arrays and the people's greetings.
  F.walkLines = function (cb) {
    if (!D) return;
    function lines(arr, group, ctx) { (arr || []).forEach(function (l) { if (Array.isArray(l) && typeof l[1] === "string" && typeof l[0] === "string") cb(l[0], l, 1, group, ctx); }); }
    function mission(m, kind) {
      if (!m || !m.steps) return; var g = (kind === "side" ? "Side " : "") + m.id + " · " + (m.title || "");
      m.steps.forEach(function (st, i) { if (!st) return; lines(st.lines, g, "step " + (i + 1)); lines(st.linesLost, g, "step " + (i + 1) + " (after losing)"); if (Array.isArray(st.say)) lines([st.say], g, "step " + (i + 1));
        (st.options || []).forEach(function (o) { lines(o && o.lines, g, "choice: " + (o && o.label || "")); }); });
      var a = m.around || {}; lines(a.radio, g, "radio while active"); lines(a.phone, g, "phone while active");
    }
    (D.MISSIONS || []).forEach(function (m) { mission(m, m.side ? "side" : "main"); });
    (D.SIDE || []).forEach(function (m) { if ((D.MISSIONS || []).indexOf(m) < 0) mission(m, "side"); });
    (D.NPCS || []).forEach(function (n) { (n.hi || []).forEach(function (t, i) { if (typeof t === "string") cb(n.id, n.hi, i, "Greetings", "greeting " + (i + 1)); }); });
  };
  function scan() {
    if (scanned || !D) return; scanned = true;
    F.walkLines(function (sp, holder, i) { var t = holder[i], tk = F.tokenise(t), s = slot(holder, i, tk, sp, t); if (lineSlot) { var m = lineSlot.get(holder); if (!m) lineSlot.set(holder, m = {}); m[i] = s; } if (tk !== t) s.dirty = true; });
    var seen = typeof WeakSet === "function" ? new WeakSet() : null, n = 0;
    function walk(o, depth) {
      if (!o || typeof o !== "object" || depth > 7 || n > 400000) return; if (seen) { if (seen.has(o)) return; seen.add(o); }
      var isLine = lineSlot && lineSlot.get(o);
      for (var k in o) { if (!Object.prototype.hasOwnProperty.call(o, k)) continue; var v = o[k]; n++;
        if (typeof v === "string") { if (k === "id" || (isLine && isLine[k])) continue; var tk = F.tokenise(v); if (tk.indexOf("{{") >= 0) { var s = slot(o, k, tk); s.dirty = true; } }
        else if (v && typeof v === "object") walk(v, depth + 1); }
    }
    ["PLACES", "ITEMS", "WARDROBE", "MISSIONS", "SIDE", "AMBIENT", "COOP", "HALL", "CAST", "HERO", "NPCS", "BRANDS", "CREATOR", "TALK"].forEach(function (k) { if (D[k]) walk(D[k], 0); });
    // map texts (the giant letters, the gate sign) keep their tokens: samaru-3d.js resolves them as it paints, and repaints on change
  }
  function retext() { scan(); for (var i = 0; i < slots.length; i++) { var s = slots[i]; if (!s.dirty && s.over == null) continue; try { s.o[s.k] = resolveCfg(s.over != null ? s.over : s.base); } catch (e) {} if (s.over == null && s.base.indexOf("{{") < 0) s.dirty = false; } }
  F.slots = function () { scan(); return slots; };

  /* ---------- the voice ids (same as samaru-voice.js V.id and tools/voice/make_script.js) ---------- */
  F.norm = function (t) { var s = String(t == null ? "" : t).toLowerCase(); try { s = s.normalize("NFKD"); } catch (e) {} return s.replace(/[^a-z0-9]+/g, " ").replace(/^ +| +$/g, ""); };
  F.lineKey = function (t) { var s = F.norm(t), h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return "v" + ("0000000" + h.toString(16)).slice(-8) + s.length.toString(36); };

  /* ---------- people ---------- */
  var BASE = {}, KEEP = ["name", "role", "nick", "bio", "skin", "hair", "hairCol", "top", "fit", "mode", "scale", "voice", "pitch", "voiceRole", "tone", "date", "romance", "friend", "likes", "hates",
    "routine", "walk", "attitude", "barks"];
  function snap(n) { if (!BASE[n.id]) { var b = {}; KEEP.forEach(function (k) { if (n[k] !== undefined) b[k] = n[k] && typeof n[k] === "object" ? JSON.parse(JSON.stringify(n[k])) : n[k]; }); BASE[n.id] = b; } return BASE[n.id]; }
  F.base = function (id) { var n = npc(id); return n ? snap(n) : null; };
  function npc(id) { var L = (D && D.NPCS) || []; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  var TONE = { deep: .88, warm: .96, natural: 1, bright: 1.1 }, MOOD_OF_HIT = { flee: 0, hit_back: 1, stand_up: 2 };
  F.storyIds = function () { var out = {}; ((D && D.STORY) || []).forEach(function (r) { (r.npcs || []).forEach(function (n) { if (n && n.id && !out[n.id]) out[n.id] = r.file; }); for (var k in (r.patch || {})) if (!out[k]) out[k] = r.file + " (changed)"; }); return out; };
  F.kindOf = function (n) {
    var r = String((n.role || "") + " " + (n.name || "")).toLowerCase();
    if (/\b(mum|mother|dad|father|uncle|aunt|aunty|sister|brother|grand|cousin|niece|nephew|kaka)\b/.test(r) && !/aunty asiya/.test(r)) return "family";
    if (/\bstudent\b|fresher|course ?mate|class rep|roommate|undergrad/.test(r)) return "student";
    if (/lecturer|\bdr\.?\b|prof|porter|nurse|security|sgt|coach|engr|works|registr|bursar|librar|ranger|guard|teacher|ustaz|pastor|captain|officer|\bhod\b|dean|warden|adviser|lifeguard|keeper|supervisor|staff|matron|chief|foreman|corporal/.test(r)) return "staff";
    if (/trader|seller|owner|shop|buka|market|okada|keke|rider|driver|fisher|mai shayi|vendor|manager|tailor|barber|mechanic|store|stall|cook|dj\b|radio|business|suya|mallam|alhaji|hajiya|mama/.test(r)) return "trader";
    return "student";
  };
  // apply one character's changes over its defaults (o = {} puts the defaults back)
  function applyChar(n, o) {
    var b = snap(n), lk = o.look || {}, at = o.att || {}, vo = o.voice || {}, k;
    KEEP.forEach(function (k2) { if (b[k2] === undefined) delete n[k2]; else n[k2] = b[k2] && typeof b[k2] === "object" ? JSON.parse(JSON.stringify(b[k2])) : b[k2]; });
    if (o.name) n.name = plain(o.name, 40); if (o.role != null && o.role !== "") n.role = plain(o.role, 60); if (o.nick) n.nick = o.nick.map(function (x) { return plain(x, 24); }); if (o.bio) n.bio = plain(o.bio, 400);
    ["skin", "hairCol", "top"].forEach(function (k2) { if (cleanColour(lk[k2])) n[k2] = lk[k2]; }); if (lk.hair) n.hair = lk.hair; if (lk.mode) n.mode = lk.mode; if (lk.scale) n.scale = Math.max(.85, Math.min(1.2, +lk.scale || 1));
    if (lk.fit || lk.acc || lk.beard || lk.brow || lk.eyes) { var fit = { acc: (lk.acc || []).slice(0, 3), hair: n.hair === "cap" || n.hair === "hijab" ? "low" : n.hair }; for (k in (lk.fit || {})) fit[k] = lk.fit[k]; ["beard", "brow", "eyes"].forEach(function (k2) { if (lk[k2]) fit[k2] = lk[k2]; }); n.fit = fit; }
    if (vo.sex === "male" || vo.sex === "female") n.voice = vo.sex; if (vo.pitch || vo.tone) n.pitch = Math.round((+vo.pitch || b.pitch || 1) * (TONE[vo.tone] || 1) * 1000) / 1000; if (vo.tone) n.tone = vo.tone; if (vo.role) n.voiceRole = vo.role;
    if (at.preset || at.mood || at.bump || at.hit || at.honk) n.attitude = { preset: at.preset || "", mood: at.mood || "", bump: at.bump || "", hit: at.hit || "", honk: at.honk || "" };
    if (at.speed) n.walk = Math.round(3 * Math.max(.6, Math.min(1.6, +at.speed)) * 100) / 100;
    if (at.friend === true) n.friend = true; else if (at.friend === false) n.friend = false;
    // romance: yes or no only. Who may date them always follows the owner's rule: the opposite sex of the character.
    if (at.romance === true) { n.date = true; n.romance = n.voice === "female" ? "m" : "f"; } else if (at.romance === false) { n.date = false; delete n.romance; }
    else if (n.date && n.romance && vo.sex) n.romance = n.voice === "female" ? "m" : "f";
    if (at.likes && at.likes.length) { n.likes = JSON.parse(JSON.stringify(n.likes || {})); n.likes.gift = at.likes[0]; n.likes.gifts = at.likes.slice(0, 6); }
    var topic = at.hateTopic || (typeof b.hates === "string" ? b.hates : "");
    if (at.dislikes && at.dislikes.length) n.hates = at.dislikes.slice(0, 6).concat(topic ? [topic] : []); else if (at.hateTopic) n.hates = at.hateTopic;
    if (at.routine && at.routine.length) n.routine = at.routine.filter(function (r) { return r && typeof r[0] === "string"; }).map(function (r) { return [r[0], +r[1] || 0]; }).sort(function (a, c) { return a[1] - c[1]; });
    if (o.barks) { n.barks = {}; for (k in o.barks) n.barks[k] = (o.barks[k] || []).map(function (x) { return plain(x, 120); }).filter(Boolean); }
    // lines
    scan(); var L = o.lines || {};
    slots.forEach(function (s) { if (s.line !== n.id) return; var t = L[F.lineKey(s.raw)]; var nv = t && t.t ? plain(t.t, 400) : null; if (nv !== s.over) { s.over = nv; s.dirty = true; } });
    // greetings are lines too (keys of the original text), kept in step with the slots above
  }
  function refreshPeople(ids) {
    if (!Z || !Z.npcs) return; var swap = Z.mode !== "play";
    for (var i = 0; i < Z.npcs.length; i++) { var e = Z.npcs[i], d = e && e.def; if (!d || (ids && !ids[d.id])) continue;
      var look = { skin: d.skin, hair: d.hair, hairCol: d.hairCol, top: d.top }; if (d.fit) look.fit = d.fit;
      if (d.mode) e.mode = d.mode; var mood = d.attitude && MOOD_OF_HIT[d.attitude.hit];
      if (mood != null) { e.mood = mood; e.maxHp = e.hp = mood === 0 ? 3 : mood === 1 ? 6 : 10; e.back = e.back || 0; e.cd = e.cd || 0; if (e.st == null) e.st = ""; } // the same fields samaru-brawl.js init() sets
      if (JSON.stringify(look) !== JSON.stringify({ skin: e.look.skin, hair: e.look.hair, hairCol: e.look.hairCol, top: e.look.top, fit: e.look.fit })) {
        if (swap) { var c = {}; for (var k in e) c[k] = e[k]; c.look = look; Z.npcs[i] = c; } else { e.look = look; e.lookNew = true; } } // a new object is drawn fresh by the 3D view
    }
  }
  F.applyCharacters = function (chars) {
    if (!D || !D.NPCS) return 0; chars = chars && typeof chars === "object" ? chars : {}; var n = 0, ids = {};
    D.NPCS.forEach(function (d) { var o = chars[d.id], had = state.applied[d.id]; if (!o && !had) return; try { applyChar(d, o && typeof o === "object" ? o : {}); ids[d.id] = 1; n++; } catch (e) { warn("character " + d.id, e); } state.applied[d.id] = !!o; });
    retext(); refreshPeople(ids); return n;
  };

  /* ---------- the bundle ---------- */
  F.valid = function (b) { return !!(b && typeof b === "object" && b.schema === 1 && typeof b.v === "number" && b.config && typeof b.config === "object" && (!b.characters || typeof b.characters === "object") && (!b.credits || Array.isArray(b.credits.sections))); };
  F.applyBundle = function (b, source) {
    if (!F.valid(b)) { warn("ignored a bundle that is missing or corrupt"); return false; }
    try { F.setConfig(b.config, true); state.credits = b.credits || null; F.applyCharacters(b.characters || {}); state.v = b.v; state.bundle = b; state.source = source || "server"; F.changed(); return true; }
    catch (e) { warn("could not apply", e); return false; }
  };
  F.reset = function () { F.applyCharacters({}); var o = cfgObj(); for (var k in FIELDS) delete o[k]; F.setConfig(DEFAULT, true); state.v = -1; state.credits = null; F.changed(); };

  /* ---------- the editor's view of everybody ---------- */
  F.catalogue = function () {
    if (!D) return []; scan(); var story = F.storyIds(), by = {}, keyed = {};
    var out = (D.NPCS || []).map(function (n) { var b = snap(n); var c = { id: n.id, name: b.name || n.name, role: b.role || n.role || "", kind: F.kindOf(b.name ? b : n), story: story[n.id] || "", retired: !!n.retired, at: n.at,
      base: b, lines: [] }; by[n.id] = c; return c; });
    F.walkLines(function (sp, holder, i, group, ctx) { var m = lineSlot && lineSlot.get(holder), s = m && m[i]; if (s) s.group = group + " \u2014 " + ctx; });
    slots.forEach(function (s) { if (!s.line || !by[s.line]) return; var key = F.lineKey(s.raw), id = s.line + ":" + key, ent = keyed[id];
      if (!ent) { ent = keyed[id] = { key: key, text: s.base, groups: [] }; by[s.line].lines.push(ent); } if (s.group && ent.groups.indexOf(s.group) < 0) ent.groups.push(s.group); });
    out.forEach(function (c) { c.lines.forEach(function (l) { l.group = (l.groups[0] || "Other").split(" \u2014 ")[0]; }); });
    return out;
  };

  /* ---------- end credits ---------- */
  F.creditLines = function (cr, cfg) {
    cfg = cfg || F.cfg(); var rows = [{ k: "title", t: cfg.gameName }]; if (cfg.tagline) rows.push({ k: "tag", t: resolveCfg(cfg.tagline) }); rows.push({ k: "gap" });
    var secs = cr && Array.isArray(cr.sections) ? cr.sections.slice() : [], shown = 0;
    secs.sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).forEach(function (s) {
      if (!s || s.visible === false) return; var es = (s.entries || []).filter(function (e) { return e && e.visible !== false && e.approved !== false && plain(e.name, 80); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      if (!es.length) return; rows.push({ k: "section", t: plain(s.title, 60) });
      es.forEach(function (e) { shown++; rows.push({ k: "name", t: plain(e.name, 80) }); var sub = [plain(e.role, 120), e.characterName ? "as " + plain(e.characterName, 60) : ""].filter(Boolean).join(" · "); if (sub) rows.push({ k: "role", t: sub }); if (e.note) rows.push({ k: "note", t: plain(e.note, 200) }); });
      rows.push({ k: "gap" });
    });
    if (!shown) rows.push({ k: "role", t: "Made with care by " + (cfg.author || "its maker") + "." }, { k: "gap" });
    rows.push({ k: "outro", t: resolveCfg(plain(cr && cr.outro, 200) || "Thank you for playing {{GAME_NAME}}.") });
    return rows;
  };
  // The scroll itself. opts: { root (element to cover), credits, onEnd, speed (px per second) }. Text only (textContent), never HTML.
  F.rollCredits = function (opts) {
    opts = opts || {}; var doc = root.document, hostEl = doc && (opts.root || (doc.querySelector && doc.querySelector("[data-gm-stage]")) || doc.body);
    var dom = !!(doc && typeof doc.createElement === "function" && typeof doc.createDocumentFragment === "function" && hostEl && typeof hostEl.appendChild === "function" && typeof root.requestAnimationFrame === "function"); // no frames = headless
    function done0() { if (opts.onEnd) try { opts.onEnd(); } catch (e) { warn("credits end", e); } if (Z && Z.emit && !opts.quiet) try { Z.emit({ t: "credits", done: true, skipped: false, dom: false }); } catch (e) {} }
    if (!dom) { done0(); return null; } // headless (Node harness) or no page: nothing to draw, the end still happens
    var host = hostEl, rows = F.creditLines(opts.credits || state.credits, F.cfg()), c = F.cfg();
    var wrap = doc.createElement("div"); wrap.className = "fslg-credits"; wrap.setAttribute("role", "dialog"); wrap.setAttribute("aria-label", "Credits");
    wrap.style.cssText = "position:absolute;inset:0;z-index:60;overflow:hidden;background:radial-gradient(circle at 50% 30%," + (c.secondaryColour || "#0f766e") + "66,transparent 70%),#05080b;color:#fff;font-family:system-ui,sans-serif;text-align:center";
    var list = doc.createElement("div"); list.style.cssText = "position:absolute;left:0;right:0;top:0;padding:0 16px;will-change:transform";
    var ST = { title: "font:900 clamp(28px,6vw,54px)/1.05 system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 8px;color:" + (c.primaryColour || "#f59e0b"), tag: "font:600 clamp(15px,2.6vw,20px)/1.3 system-ui;opacity:.85",
      section: "font:800 13px/1.2 system-ui;letter-spacing:.18em;text-transform:uppercase;margin:34px 0 10px;color:" + (c.primaryColour || "#f59e0b"), name: "font:800 clamp(18px,3.4vw,26px)/1.2 system-ui;margin-top:12px",
      role: "font:500 clamp(13px,2.2vw,16px)/1.35 system-ui;opacity:.85", note: "font:400 13px/1.35 system-ui;opacity:.65", gap: "height:28px", outro: "font:700 clamp(16px,3vw,22px)/1.3 system-ui;margin:40px 0 0" };
    var frag = doc.createDocumentFragment(); rows.forEach(function (r) { var d = doc.createElement(r.k === "title" ? "h2" : "div"); d.style.cssText = ST[r.k] || ""; if (r.t) d.textContent = r.t; frag.appendChild(d); }); list.appendChild(frag); wrap.appendChild(list);
    var skip = doc.createElement("button"); skip.type = "button"; skip.textContent = "Skip"; skip.setAttribute("data-fslg-skip", "");
    skip.style.cssText = "position:absolute;right:12px;top:12px;min-width:64px;min-height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.45);color:#fff;font:700 15px system-ui;z-index:2;cursor:pointer";
    wrap.appendChild(skip); if (root.getComputedStyle && host !== doc.body && root.getComputedStyle(host).position === "static") host.style.position = "relative"; host.appendChild(wrap);
    var reduce = false; try { reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    var H = wrap.clientHeight || 540, LH = list.scrollHeight || rows.length * 30, speed = opts.speed || Math.max(40, Math.min(90, H / 9)), y = H, last = 0, raf = 0, done = false;
    function end(skipped) { if (done) return; done = true; if (Z && Z.emit && !opts.quiet) try { Z.emit({ t: "credits", done: true, skipped: skipped === true }); } catch (e) {} if (raf) cancelAnimationFrame(raf); doc.removeEventListener("keydown", key, true); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); if (opts.onEnd) try { opts.onEnd(); } catch (e) { warn("credits end", e); } }
    function key(e) { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); end(true); } }
    function frame(t) { if (done) return; var dt = last ? Math.min(.1, (t - last) / 1000) : 0; last = t; y -= speed * dt; list.style.transform = "translateY(" + y.toFixed(1) + "px)"; if (y < -LH - 20) { end(); return; } raf = requestAnimationFrame(frame); }
    skip.addEventListener("click", function () { end(true); }); doc.addEventListener("keydown", key, true);
    if (reduce || !root.requestAnimationFrame) { wrap.style.overflowY = "auto"; list.style.position = "static"; list.style.padding = "64px 16px 40px"; skip.textContent = "Close"; }
    else { list.style.transform = "translateY(" + H + "px)"; raf = requestAnimationFrame(frame); }
    try { skip.focus(); } catch (e) {}
    return { end: end, el: wrap, rows: rows };
  };

  /* ---------- canvas signs: auto-fit text for in-world signs (samaru-3d.js uses this through Z.r3 helpers) ---------- */
  F.fitText = function (x, text, maxW, size, minSize, weight) { var fs = size; do { x.font = (weight || 900) + " " + fs + "px system-ui, 'Arial Black', sans-serif"; if (x.measureText(text).width <= maxW) return fs; fs -= 2; } while (fs > (minSize || 12)); return fs; };
  F.live = function (paint) { if (typeof paint !== "function") return paint; F.on(function () { return paint(); }); return paint; };

  /* ---------- storage: IndexedDB, and the last good copy in localStorage ---------- */
  var LS = "fslg-overrides-v1";
  function lsGet() { try { var s = root.localStorage && root.localStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function lsSet(b) { try { root.localStorage.setItem(LS, JSON.stringify(b)); } catch (e) {} }
  function idb(fn) { try { if (!root.indexedDB) return Promise.resolve(null); return new Promise(function (ok) { var r = root.indexedDB.open("fslg", 1); r.onupgradeneeded = function () { r.result.createObjectStore("kv"); }; r.onerror = function () { ok(null); }; r.onsuccess = function () { try { fn(r.result, ok); } catch (e) { ok(null); } }; }); } catch (e) { return Promise.resolve(null); } }
  F.idbGet = function () { return idb(function (db, ok) { var q = db.transaction("kv").objectStore("kv").get("bundle"); q.onsuccess = function () { ok(q.result || null); }; q.onerror = function () { ok(null); }; }); };
  F.idbSet = function (b) { return idb(function (db, ok) { var tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(b, "bundle"); tx.oncomplete = function () { ok(true); }; tx.onerror = function () { ok(false); }; }); };
  F.keep = function (b) { lsSet(b); return F.idbSet(b); };
  F.cached = function () { var b = lsGet(); return F.valid(b) ? b : null; };

  F.url = function () { var st = root.document && root.document.querySelector("[data-gm-api]"); return (st ? st.getAttribute("data-gm-api") : "/arcade/api/") + "fslg/"; };
  F.fetch = function () {
    if (typeof root.fetch !== "function") return Promise.resolve(false); var etag = state.bundle && state.bundle._etag;
    return root.fetch(F.url(), { credentials: "same-origin", headers: etag ? { "If-None-Match": etag } : {} }).then(function (r) {
      if (r.status === 304) return "same"; if (!r.ok) throw new Error("HTTP " + r.status); var tag = r.headers && r.headers.get && r.headers.get("ETag");
      return r.json().then(function (b) { if (!F.valid(b)) throw new Error("corrupt bundle"); b._etag = tag || ""; if (b.v !== state.v || state.source !== "server") { F.applyBundle(b, "server"); F.keep(b); } else { state.bundle._etag = b._etag; state.source = "server"; } return true; });
    }).catch(function (e) {
      return F.idbGet().then(function (b) { if (F.valid(b) && b.v > state.v) F.applyBundle(b, "idb"); return false; });
    });
  };

  /* ---------- the game ---------- */
  function hookGame() {
    if (!Z || Z._fslgHooked) return; Z._fslgHooked = true; Z.resolveText = F.resolveText; Z.config = F.cfg; Z.onConfig = F.on;
    var setup = Z.setup;
    if (setup) Z.setup = function (api) {
      var b = F.cached(); if (b) F.applyBundle(b, "local"); else retext(); // before anybody spawns
      var r = setup.apply(this, arguments); F.applyCharacters(state.bundle ? state.bundle.characters : {}); startGame(api); return r;
    };
    // what people say: {{PLAYER_NAME}} filled in, and each character's own reactions
    var say = Z.say; if (say) Z.say = function (who, text, quiet) { var t = text; try { t = bark(who, text); if (t === null) return; t = F.resolveText(t); } catch (e) { t = text; } return say.call(this, who, t, quiet); };
    var sub = Z.sub; if (sub) Z.sub = function (who, text, dur) { return sub.call(this, who, F.resolveText(text), dur); };
    var emit = Z.emit; if (emit) Z.emit = function (ev) { var r = emit.apply(this, arguments); try { finale(); } catch (e) {} return r; };
    Z.npcRoutine = routineAt; Z.rollCredits = F.rollCredits;
  }
  var GENTLE = { bump: ["Ah, sorry.", "It's okay.", "No wahala."], shove: ["Watch where you are going!", "Ehn?! Are you blind?", "Move!"] };
  function bark(who, text) {
    var d = who && who.def, B = Z.brawl && Z.brawl.SAY; if (!d || !B) return text; var a = d.attitude || {}, my = d.barks || {};
    var kind = (B.hurt || []).indexOf(text) >= 0 ? "hit" : (B.up || []).indexOf(text) >= 0 ? "bump" : (B.dodge || []).indexOf(text) >= 0 || (B.car || []).indexOf(text) >= 0 ? "honk" : (B.scared || []).indexOf(text) >= 0 ? "flee" : (B.back || []).indexOf(text) >= 0 || (B.tough || []).indexOf(text) >= 0 ? "fight" : (B.yield || []).indexOf(text) >= 0 ? "yield" : "";
    if (!kind) return text; var mine = my[kind];
    if (mine && mine.length) return mine[text.length % mine.length];
    if (kind === "honk" && a.honk === "ignore") return null;
    if (kind === "honk" && a.honk === "shout") return (B.car || [text])[text.length % (B.car || [text]).length];
    if (kind === "bump" && a.bump === "shrug") return GENTLE.bump[text.length % 3];
    if (kind === "bump" && a.bump === "shove") return GENTLE.shove[text.length % 3];
    if (kind === "bump" && a.bump === "flee") return (B.scared || [text])[0];
    return text;
  }
  // a person's own day: [[placeId, hour], ...] → where they should be now (samaru-friends.js and the post-keeping below)
  function routineAt(n, time) {
    var r = n && n.def && n.def.routine; if (!r || !r.length || !Z.place) return null; var h = (time || 0) / 60, i = r.length - 1;
    for (var k = 0; k < r.length; k++) if (h >= r[k][1]) i = k; var pl = Z.place(r[i][0]); return pl ? { i: i, place: pl, kind: "post" } : null;
  }
  var posts = 0;
  function keepPosts(dt) { // people who are not friends walk to their routine's place (core walks them to hx/hy)
    posts -= dt; if (posts > 0 || !Z.P || !Z.npcs) return; posts = 2;
    Z.npcs.forEach(function (n) { if (!n.def || !n.def.routine || (Z.friends && Z.friends.isFriend && Z.friends.isFriend(n)) || n.follow || n.lead) return; var r = routineAt(n, Z.P.time); if (!r || n.rti === r.i) return; n.rti = r.i;
      var a = (n.k || 0) * 2.4, f = S && S.push && Z.W ? S.push(Z.W, r.place.mx + Math.cos(a) * 3, r.place.my + Math.sin(a) * 3, .6) : { x: r.place.mx, y: r.place.my }; n.hx = f.x; n.hy = f.y; });
  }
  function finale() { var P = Z.P; if (!P || !P.flags || !P.flags.story_done || P.flags.credits_seen) return; P.flags.credits_seen = 1; var go = function () { try { F.rollCredits({}); } catch (e) { warn("credits", e); } }; if (typeof setTimeout === "function") setTimeout(go, 6000); else go(); }
  function startGame(api) {
    var doc = root.document; if (!doc) return; F.api = api;
    var shown = String(F.cfg().gameName).toUpperCase();
    var page = function (c) { try { var up = String(c.gameName).toUpperCase(); if (up !== shown) { [].forEach.call(doc.querySelectorAll("[data-gm-overlay] h2"), function (h) { if (h.textContent === shown) h.textContent = up; }); shown = up; } doc.title = c.gameName; var h = doc.querySelector(".gm-bar h1"); if (h) h.textContent = c.gameName; var st = doc.querySelector("[data-gm-stage]"); if (st && c.primaryColour) { st.style.setProperty("--gm-a", c.primaryColour); var pg = st.closest && st.closest(".gm-page"); if (pg) pg.style.setProperty("--gm-a", c.primaryColour); } } catch (e) {} };
    F.on(page); page(F.cfg());
    var update = Z.update; if (update && !update._fslg) { Z.update = function (dt) { var r = update.apply(this, arguments); try { keepPosts(dt); } catch (e) {} return r; }; Z.update._fslg = 1; }
    F.fetch();
    // a change saved in Arcade Management reaches open games: at once in this browser, within two minutes elsewhere
    try { if (root.BroadcastChannel && !(root.process && root.process.versions && root.process.versions.node)) { var bc = new BroadcastChannel("fslg"); bc.onmessage = function () { F.fetch(); }; } } catch (e) {}
    try { doc.addEventListener("visibilitychange", function () { if (!doc.hidden) F.fetch(); }); } catch (e) {}
    try { setInterval(function () { if (!doc.hidden && root.navigator && root.navigator.onLine !== false) F.fetch(); }, 120000); } catch (e) {}
  }
  // the game's own copy of the defaults wins over any older one written by another file (one config object, §5.2)
  if (D) { var c0 = cfgObj(); for (var k0 in FIELDS) c0[k0] = DEFAULT[k0]; c0.configVersion = 0; fill(c0); }
  if (Z) hookGame();
  return F;
});
