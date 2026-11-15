/* Headless check of the shared settings system: arcade.js (registry, layout lookups) + arcade-settings.js (screen, presets).
   Usage: node settings_harness.js <static/js/games dir>. Prints one JSON object; exits 1 on any thrown error. */
const path = require("path"), fs = require("fs"), dir = process.argv[2];
const noop = () => {};
const ls = {}, listeners = {};
function ctx2d() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
let W = 900, H = 500; // the stage, in CSS px (landscape first)
function el(tag) {
  const e = { tag: tag || "div", style: { setProperty(k, v) { this[k] = v; } }, children: [], attrs: {}, hidden: false, innerHTML: "", value: "", textContent: "", _ls: {},
    classList: { _c: new Set(), add(...c) { c.forEach((x) => this._c.add(x)); }, remove(...c) { c.forEach((x) => this._c.delete(x)); }, toggle(c, on) { if (on === undefined ? !this._c.has(c) : on) this._c.add(c); else this._c.delete(c); }, contains(c) { return this._c.has(c); } },
    addEventListener(n, f) { (this._ls[n] = this._ls[n] || []).push(f); }, removeEventListener: noop, getContext: ctx2d,
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); },
    querySelector: () => el(), querySelectorAll: () => [], contains: () => false, focus: noop, closest: () => null,
    getBoundingClientRect() { return { left: 0, top: 0, width: W, height: H }; } };
  return e;
}
const SLUG = "test-game";
const ov = Object.assign(el(), { hidden: true });
const touch = el(), cv = el("canvas");
const stage = el(); stage.attrs["data-gm-slug"] = SLUG;
const ctl = []; // fake on-screen controls with data-lay, used by the preset test
stage.querySelector = (s) => s === "[data-gm-overlay]" ? ov : s === "[data-gm-touch]" ? touch : s === "[data-gm-canvas]" ? cv : null;
stage.querySelectorAll = (s) => s === "[data-lay]" ? ctl : [];
global.window = global; global.self = global;
global.addEventListener = (n, f) => { (listeners[n] = listeners[n] || []).push(f); }; global.removeEventListener = noop;
global.matchMedia = () => ({ matches: false, addEventListener: noop }); global.requestAnimationFrame = noop; global.devicePixelRatio = 1;
global.localStorage = { getItem: (k) => k in ls ? ls[k] : null, setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; }, key: (i) => Object.keys(ls)[i], get length() { return Object.keys(ls).length; } };
global.performance = { now: () => Date.now() };
const byId = {};
global.document = { documentElement: el(), body: el(), head: el(), readyState: "complete", hidden: false, currentScript: null,
  createElement: (t) => el(t), getElementById: (id) => byId[id] || null,
  addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
  querySelector: (s) => s === "[data-gm-stage]" ? stage : /gm-me|gm-cast|gm-api|gm-filters|gm-villain|privacy|gm-empty|gm-title|^h1$/.test(s) ? null : el(), querySelectorAll: () => [] };
document.head.appendChild = (c) => { if (c.id) byId[c.id] = c; return c; }; document.body.appendChild = (c) => { if (c.id) byId[c.id] = c; return c; };
function load(f) { (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8")); }
const out = {};
try {
  load("arcade"); load("arcade-settings");
  let applied = [];
  const game = {
    actions: [{ id: "left", label: "Left", keys: ["ArrowLeft"] }, { id: "jump", label: "Jump", keys: ["Space"], touch: { label: "J", x: 80, y: 80 } }, { id: "run", label: "Run", keys: ["ShiftLeft"], toggle: true, touch: { label: "R", x: 70, y: 86 } }],
    init(api) { api.settings.add({ id: "difficulty", tab: "gameplay", label: "Difficulty", type: "choice", default: "normal", choices: [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"]], apply: (v) => applied.push(v) }); },
    update: noop, draw: noop };
  const api = Arcade.run(game);
  // 1. registry: default, apply at registration, set → saved and applied, survives a reload of the values
  out.default = api.settings.get("difficulty"); out.appliedAtAdd = applied.slice();
  api.settings.set("difficulty", "hard"); out.after = api.settings.get("difficulty"); out.appliedOnSet = applied.slice(-1)[0];
  const saved = JSON.parse(ls["ee-arcade-set-" + SLUG]); out.savedValue = saved.o && saved.o.difficulty; out.methodsNotSaved = !("add" in saved) && !("get" in saved);
  out.builtins = ["music", "sfx", "subs", "res", "fps30", "cb", "flashes", "motion", "hudScale", "textScale", "contrast", "speed", "lookSens", "invertY", "padRumble", "bgMute"].filter((id) => !api.settings.list().some((o) => o.id === id));
  api.settings.reset("difficulty"); out.reset = api.settings.get("difficulty");
  // 2. the settings screen opens ABOVE a game dialog and leaves it untouched; pause state is restored on close
  api.show("<h2>Pick a level</h2>", noop); const before = ov.innerHTML;
  const D = global.EEArcadeDebug; let pausedSeen = null;
  api.settingsUI.open("audio"); out.uiOpen = api.settingsUI.isOpen(); out.dialogKept = ov.innerHTML === before && ov.hidden === false;
  const gms = stage.children.filter((c) => c.className === "gms")[0]; out.screenInStage = !!gms && gms.hidden === false && /Settings/.test(gms.innerHTML);
  out.tabs = ["Audio", "Display", "Controls", "Gameplay", "Accessibility", "Data", "About"].filter((t) => gms.innerHTML.indexOf(">" + t + "<") < 0);
  api.settingsUI.close(); out.closed = !api.settingsUI.isOpen() && gms.hidden === true; out.dialogStill = ov.innerHTML === before && ov.hidden === false;
  // 3. layouts: per orientation, presets refuse overlaps, the pure overlap check
  const mk = (id, x, y) => { const e = el("button"); e.attrs["data-lay"] = id; e.attrs["data-lay-label"] = id; e._x = x; e._y = y; e.getBoundingClientRect = () => ({ left: e._x - 30, top: e._y - 30, width: 60, height: 60 }); return e; };
  ctl.push(mk("jump", 820, 420), mk("run", 740, 450), mk("stick", 90, 410));
  api.settingsUI.preset("left");
  const land = (JSON.parse(ls["ee-arcade-set-" + SLUG]).layout || {}).land || {};
  out.leftHanded = land.jump && land.stick ? { jumpX: Math.round(land.jump.x), stickX: Math.round(land.stick.x) } : null;
  W = 400; H = 800; out.portraitEmpty = api.layout.get("jump") === null; W = 900; H = 500; out.landStill = !!api.layout.get("jump");
  api.settingsUI.preset("one"); const one = api.layout.get("stick"); out.oneHandedStickRight = one && one.x > 50;
  const r = (k, x, y, s) => ({ l: x - 30 * s, t: y - 30 * s, r: x + 30 * s, b: y + 30 * s });
  out.clashYes = ArcadeSettings.clash(r(0, 100, 100, 1), [r(0, 130, 110, 1)]); out.clashNo = ArcadeSettings.clash(r(0, 100, 100, 1), [r(0, 170, 100, 1)]);
  // no two controls overlap after the one-handed preset
  const lay = api.layout.get, rects = ["jump", "run", "stick"].map((id) => { const L = lay(id); return r(0, L.x / 100 * W, L.y / 100 * H, L.s); });
  out.presetOverlap = rects.some((a, i) => ArcadeSettings.clash(a, rects.filter((_, j) => j !== i)));
  // 4. game speed and the 30 fps cap are read by the loop
  api.settings.set("speed", .8); out.speed = api.settings.get("speed");
  out.ok = true;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
process.stdout.write(JSON.stringify(out) + "\n"); process.exit(out.ok ? 0 : 1);
