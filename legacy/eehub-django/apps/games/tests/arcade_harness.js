/* Headless run of the real arcade runtime (arcade.js) with a stub DOM: the ceremony kit, cheats, the hidden-character gate,
   and Momentum Cup's win and lose endings. Usage: node arcade_harness.js <static/js/games dir> <cheat_defaults dir>.
   Prints one JSON object; exits 1 on any thrown error. */
const path = require("path"), fs = require("fs"), dir = process.argv[2], defs = process.argv[3];
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { const e = { style: {}, children: [], childNodes: [], hidden: true, innerHTML: "", value: "", textContent: "", classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, removeAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, insertBefore: noop, remove: noop, focus: noop, click: noop, closest: () => null, width: 960, height: 540 }; return e; }
const SLUG = "momentum-cup", ls = {}, listeners = {};
let dlg = null;
const ov = { hidden: true, onclick: null, classList: { add: noop, remove: noop }, _h: "",
  get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; dlg = v ? Object.assign(el(), { attrs: {}, html: v, setAttribute(k, x) { this.attrs[k] = x; }, removeAttribute(k) { delete this.attrs[k]; }, querySelector: () => null }) : null; },
  querySelector(sel) { if (this.hidden || !dlg) return null; if (sel === ".gm-dlg") return dlg; if (sel === "[data-cer]") return dlg.attrs["data-cer"] ? dlg : null; return null; } };
const stage = Object.assign(el(), { getAttribute: (k) => k === "data-gm-slug" ? SLUG : "", querySelector: (s) => s === "[data-gm-overlay]" ? ov : s === ".gm-hero-skip" ? null : el() });
global.window = global; global.self = global;
global.addEventListener = (n, f) => { (listeners[n] = listeners[n] || []).push(f); }; global.removeEventListener = noop;
global.matchMedia = () => ({ matches: false, addEventListener: noop }); global.requestAnimationFrame = noop; global.devicePixelRatio = 1;
global.localStorage = { getItem: (k) => k in ls ? ls[k] : null, setItem: (k, v) => { ls[k] = String(v); } };
global.performance = { now: () => Date.now() };
global.document = { documentElement: el(), body: el(), readyState: "complete", hidden: false, currentScript: null, head: el(), createElement: () => el(),
  addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
  querySelector: (s) => s === "[data-gm-stage]" ? stage : /gm-me|gm-cast|gm-api|gm-filters|gm-villain|privacy|gm-empty/.test(s) ? null : el(), querySelectorAll: () => [] };
function load(f) { (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8")); }
function click(act) { const on = ov.onclick; if (on) on({ target: { closest: () => ({ getAttribute: (k) => k === "data-act" ? act : "einstein", parentNode: { children: [] } }) } }); }
function key(k, code) { (listeners.keydown || []).forEach((f) => f({ key: k, code: code || "Key" + k.toUpperCase(), target: {}, preventDefault: noop })); }
const out = {};
try {
  load("arcade"); load("kickoff");
  const D = global.EEArcadeDebug, api = D.api, A = global.Arcade, M = global.MomentumCup, S = M.S, codes = JSON.parse(fs.readFileSync(path.join(defs, SLUG + ".json"), "utf8"));
  const cer = () => D.cer();
  out.hash = [A.hash("abc"), A.hash("momentum-cup:héllo*1#"), A.hash("x".repeat(200))];
  out.cheatIds = api.cheatIds().sort();
  // every ceremony kind plays, hands over to the game's dialog, and is cleaned up when that dialog closes
  out.kinds = {};
  ["win", "lose", "draw", "champion", "eliminated", "newRecord", "stageClear", "gameComplete"].forEach((k) => {
    let handed = 0; api.hide();
    api.ceremony(k, { score: 1234, stars: 2, stats: [["a", 1]], line: "x", tip: "y", then: () => { handed++; api.show("<h2>r</h2><div class='gm-actions'><button data-act='ok'>ok</button></div>", () => api.hide()); } });
    const started = !!cer(); D.step(120 * 9);
    const open = api.overlayOpen() && !!cer(); click("ok"); D.step(60);
    out.kinds[k] = [started, handed, open, !cer(), D.fx.confetti.length];
  });
  // another dialog (pause, menu) cancels a ceremony that has not handed over yet
  api.ceremony("win", { then: () => { out.lateHandOver = true; } }); api.show("<h2>menu</h2>"); out.cancelled = !cer(); api.hide(); D.step(120 * 8);
  // the hidden character cannot be reached without the server saying yes
  out.gate = { before: A.byId.mib === undefined, active: api.hero.active };
  ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight"].forEach((c) => { api.show("<h2>t</h2>"); key(c, c); });
  ["m", "i", "b"].forEach((c) => key(c)); out.gate.revealed = api.hero.revealed; api.hide();
  // Momentum Cup: a cup win and a cup loss each reach a ceremony and return control to the result dialog
  function match(score, round) {
    ls["ee-arcade-kick-tut"] = "true"; EEArcadeDebug.game.menu ? 0 : 0; click("menu"); click("cup"); click("go"); click("play"); D.step(300);
    S.round = round; S.score = score.slice(); S.time = .01; D.step(40);
    const whistle = S.state === "over" && !!S.post; return whistle;
  }
  const timers = []; const realST = global.setTimeout; global.setTimeout = (f) => { timers.push(f); return 0; };
  out.cup = {};
  [["champion", [3, 1], 5], ["eliminated", [0, 2], 2]].forEach(([want, sc, rd]) => {
    const whistle = match(sc, rd); timers.splice(0).forEach((f) => f());
    const kind = cer() && cer().kind; D.step(120 * 8); const dialog = api.overlayOpen() && !!dlg && /data-act='(cup|retry)'/.test(dlg.html);
    click("menu"); D.step(30); out.cup[want] = [whistle, kind, dialog, !cer()];
  });
  // the menu demo never ends a match or files a result
  let reports = 0; const rep = A.report; A.report = () => { reports++; return Promise.resolve(null); };
  click("menu"); S.mode = "demo"; S.score = [4, 4]; D.step(120 * 30); out.demoReports = reports; A.report = rep;
  // cheats: a wrong code does nothing, the typed and dial forms work, and a cheated session does not report
  click("menu"); click("cup"); click("go"); click("play"); D.step(300);
  const c0 = codes.cheats.find((c) => c.id === "goal");
  out.cheat = { wrong: api.enterCode("zzzz99"), before: api.cheated, typed: api.enterCode(" " + c0.typed.toUpperCase() + " "), dial: api.enterCode(c0.dial), score: S.score.slice(), after: api.cheated };
  api.hide(); "mctim6".split("").forEach((c) => key(c)); out.cheat.keyboard = S.time > 80;
  global.fetch = () => { out.cheat.fetched = true; return Promise.reject(new Error("x")); };
  A.report("momentum-cup", { result: "win", stage: 1, score: 10 }).then((r) => {
    out.cheat.blocked = r === null && !out.cheat.fetched;
    return api.hero.verify("anything");
  }).then((ok) => { out.gate.verifyOffline = ok; out.gate.after = A.byId.mib === undefined && !api.hero.active; console.log(JSON.stringify(out)); process.exit(0); });
  global.setTimeout = realST;
} catch (e) { console.error(e && e.stack || e); process.exit(1); }
