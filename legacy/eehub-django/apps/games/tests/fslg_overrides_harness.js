/* Headless checks for static/js/games/samaru-overrides.js inside the real game (the boot of samaru_harness.js, plus the
   overrides file after samaru-story as in the catalogue). Usage: node fslg_overrides_harness.js <js dir> [mode]
   mode "cached" (default): a good bundle waits in localStorage; "corrupt": localStorage holds garbage; "none": nothing. */
const fs = require("fs"), path = require("path");
const MODE = process.argv[3] || "cached";
const LSDATA = {};
global.localStorage = { getItem: (k) => (k in LSDATA ? LSDATA[k] : null), setItem: (k, v) => { LSDATA[k] = String(v); }, removeItem: (k) => { delete LSDATA[k]; } };
// a good bundle, written the way the game keeps it
const CHAR = { ada: { name: "Adaeze", nick: ["Ada"], look: { hair: "afro", top: "#123456" }, att: { hit: "flee", romance: true, speed: 1.2, routine: [["library", 8], ["buka", 13]] },
  barks: { hit: ["Ouch, my brother!"] }, voice: { pitch: 1.2, tone: "bright" }, lines: {} } };
const BUNDLE = { schema: 1, v: 7, config: { gameName: "Lagos Campus Life", gameShortName: "LCL", initialsOverride: "", tagline: "Live it.", currencyName: "naira", primaryColour: "#2563eb", secondaryColour: "#111827" },
  credits: { sections: [{ id: "c", title: "Created by", order: 0, entries: [{ name: "M.I. BUGAJE", role: "Everything", order: 0 }] }] }, characters: CHAR };
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8");
let boot = src.slice(0, src.indexOf("const out = { log: [] }"));
if (boot.indexOf('"samaru-story", "samaru-overrides"') < 0) boot = boot.replace('"samaru-story", ', '"samaru-story", "samaru-overrides", ');
const mine = String.raw`
const out = { ok: true, mode: MODE, c: {} }; const c = out.c;
try {
  const F = global.GameConfig; c.loaded = !!F;
  run(.5); // title screen: Z.setup has run, the people have spawned
  if (MODE === "cached") {
    c.cachedApplied = F.state.v === 7 && F.state.source === "local";
    c.renamed = F.cfg().gameName === "Lagos Campus Life" && F.shownInitials() === "LCL";
    const ada = D.NPCS.find((n) => n.id === "ada"), e = Z.npcs.find((n) => n.id === "ada");
    c.adaName = ada.name === "Adaeze" && e.def.name === "Adaeze";
    c.adaLook = e.look.hair === "afro" && e.look.top === "#123456";
    c.adaFlees = e.mood === 0 && e.hp === 3;
    c.romanceOppositeSex = ada.date === true && ada.romance === (ada.voice === "female" ? "m" : "f");
    c.walk = ada.walk === 3.6;
    c.routine = !!Z.npcRoutine && JSON.stringify(ada.routine) === '[["library",8],["buka",13]]' && Z.npcRoutine(e, 9 * 60).place.id === "library" && Z.npcRoutine(e, 14 * 60).place.id === "buka";
    c.pitch = Math.abs(ada.pitch - 1.32) < .01;
    const sel = D.PLACES.find((p) => p.id === "selfie"); c.dataText = /LCL letters/.test(sel.text) && !/FSLG/.test(sel.text);
    c.mapLetters = (global.SamaruMap.p || []).filter((q) => q.k === "letters").every((q) => Z.resolveText(q.text) === "LCL");
    // say: own reaction lines, and the player's name filled in at the moment of speaking
    const p = S.newPlayer("tunde", "Tester"); api._open = false; Z.begin(p, true); run(.2);
    const e2 = Z.npcs.find((n) => n.id === "ada"); Z.say(e2, Z.brawl.SAY.hurt[0]); c.ownBark = Z.bubbles[Z.bubbles.length - 1].text === "Ouch, my brother!";
    Z.say(e2, "Hello {{PLAYER_NAME}}, welcome to {{GAME_NAME}}."); c.playerName = Z.bubbles[Z.bubbles.length - 1].text === "Hello Tester, welcome to Lagos Campus Life.";
  }
  if (MODE === "corrupt") { c.defaultsKept = F.cfg().gameName === "Freshers School Life" && F.state.v === -1 && D.NPCS.find((n) => n.id === "ada").name === "Ada"; c.cachedNull = F.cached() === null; }
  if (MODE === "none") {
    c.defaults = F.cfg().gameName === "Freshers School Life" && F.shownInitials() === "FSLG";
    // tokens
    c.tokens = F.resolveText("{{GAME_NAME|upper}} · {{GAME_INITIALS}} · {{TAGLINE}} · {{CURRENCY}} · {{PLAYER_NAME}} · {{NOPE}}") === "FRESHERS SCHOOL LIFE · FSLG · One school, a thousand stories. · naira · Fresher · {{NOPE}}";
    c.initials = F.initialsOf("Freshers School Life Game") === "FSLG" && F.initialsOf("a b c d e f g h") === "ABCDEF" && F.initialsOf("") === "G";
    c.checkConfig = F.checkConfig({ gameName: "", gameShortName: "x", currencyName: "n" }).length > 0 && F.checkConfig({ gameName: "Ok", gameShortName: "OK", currencyName: "naira", initialsOverride: "TOOLONG1" }).length === 1;
    // corrupt bundles are refused and change nothing
    c.corruptRefused = [null, {}, { schema: 2, v: 1, config: {} }, { schema: 1, v: "x", config: {} }, { schema: 1, v: 1, config: {}, credits: { sections: "no" } }].every((b) => F.applyBundle(b) === false) && F.cfg().gameName === "Freshers School Life";
    // the catalogue lists every person with their lines, and an edited line flows into the data
    const cat = F.catalogue(); const ada = cat.find((x) => x.id === "ada"); c.catalogue = cat.length >= 30 && cat.every((x) => x.id && x.kind) && ada && ada.lines.length >= 3;
    c.kinds = ["student", "staff", "trader"].every((k) => cat.some((x) => x.kind === k)) && cat.some((x) => x.story);
    const withLines = cat.filter((x) => x.lines.length > 3 && !x.retired).sort((a, b) => b.lines.length - a.lines.length)[0]; const L = withLines.lines.find((l) => l.groups.some((g) => /^m\d/.test(g)));
    out.who = withLines.id; out.line = L && L.text.slice(0, 60);
    const holders = []; F.walkLines((sp, h, i) => { if (sp === withLines.id && F.lineKey(h[i]) === L.key) holders.push([h, i]); });
    let heard = 0; F.on(() => { heard++; });
    const ok = F.applyBundle({ schema: 1, v: 3, config: { gameName: "Freshers School Life" }, characters: { [withLines.id]: { lines: { [L.key]: { t: "EDITED for {{PLAYER_NAME}}", o: L.text } } } } });
    c.lineEdited = ok && holders.length > 0 && holders.every(([h, i]) => h[i] === "EDITED for {{PLAYER_NAME}}");
    F.applyBundle({ schema: 1, v: 4, config: { gameName: "Freshers School Life" }, characters: {} });
    c.lineReverted = holders.every(([h, i]) => h[i] === F.resolveCfg(F.tokenise(L.text)) || h[i] === L.text);
    // rename live: data text, the letters, listeners — no restart
    const sel = D.PLACES.find((p) => p.id === "selfie"); const before = sel.text; heard = 0;
    F.setConfig({ gameName: "Zaria Uni Days", initialsOverride: "" }); c.renameLive = heard === 1 && /ZUD letters/.test(sel.text) && before !== sel.text && F.shownInitials() === "ZUD";
    const long = "A Very Long Game Name That Goes On And On For Ever And Ever Until It Stops";
    F.setConfig({ gameName: long }); c.longName = F.cfg().gameName.length <= 60 && F.shownInitials().length <= 6;
    F.setConfig({ gameName: "X" }); c.shortName = F.shownInitials() === "X";
    const t0 = Date.now(); F.setConfig({ gameName: "Freshers School Life", initialsOverride: "FSLG" }); c.backToDefault = /FSLG letters/.test(sel.text);
    // credits: zero, one and three hundred entries; unapproved and hidden people never show
    const sec = (n, extra) => ({ sections: [{ id: "a", title: "Voices", entries: Array.from({ length: n }, (_, i) => Object.assign({ name: "Person " + i, role: "Voice", order: n - i }, extra)) }] });
    const r0 = F.creditLines(sec(0)), r1 = F.creditLines(sec(1)), t1 = Date.now(); const r300 = F.creditLines(sec(300)); const ms = Date.now() - t1;
    c.credits0 = r0.length >= 4 && r0.some((r) => /Made with care/.test(r.t || "")) && r0[0].t === "Freshers School Life";
    c.credits1 = r1.filter((r) => r.k === "name").length === 1 && r1.some((r) => r.k === "section" && r.t === "Voices");
    c.credits300 = r300.filter((r) => r.k === "name").length === 300 && r300.find((r) => r.k === "name").t === "Person 299" && ms < 200;
    c.creditsHidden = F.creditLines(sec(5, { approved: false })).filter((r) => r.k === "name").length === 0 && F.creditLines(sec(5, { visible: false })).filter((r) => r.k === "name").length === 0;
    c.creditsTextOnly = F.creditLines({ sections: [{ title: "<b>x</b>", entries: [{ name: "<img src=x onerror=alert(1)>Bob" }] }] }).every((r) => !/[<>]/.test(r.t || ""));
    c.rollStubDom = (() => { let ended = false, ev = 0; const oe = Z.emit; Z.emit = function (e) { if (e && e.t === "credits") ev++; return oe.apply(this, arguments); }; let r = null; try { r = F.rollCredits({ onEnd: () => { ended = true; } }); if (r) r.end(true); } catch (e) { Z.emit = oe; return false; } Z.emit = oe; return ended && ev === 1; })(); // a stub DOM (Node) never throws, and the end event fires once
    c.rollWithoutDom = (() => { let ended = false; const d = global.document; delete global.document; const r = F.rollCredits({ onEnd: () => { ended = true; } }); global.document = d; return r === null && ended; })();
  }
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
console.log(JSON.stringify(out)); process.exit(0);
`;
if (MODE === "cached") LSDATA["fslg-overrides-v1"] = JSON.stringify(BUNDLE);
if (MODE === "corrupt") LSDATA["fslg-overrides-v1"] = "{not json";
eval(boot + mine);
