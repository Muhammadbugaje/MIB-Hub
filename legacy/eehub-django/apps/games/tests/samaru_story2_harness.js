/* Headless checks for the phase 2 story systems: script choices and their consequences, rumours, companion switching,
   cutscene metadata, friendship and romance, prosperity, cooking, the workshop and the cliff tower, the Maker, weather and
   world life. Usage: node samaru_story2_harness.js <static/js/games dir> [section]. Prints one JSON object.
   Reuses the boot section of samaru_harness.js (stub DOM, fixed random seed, simulated clock), so it loads the same files. */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8");
const boot = src.slice(0, src.indexOf("const out = { log: [] }"));
const parts = fs.readdirSync(__dirname).filter((f) => /^story2_\w+\.part\.js$/.test(f)).sort().map((f) => fs.readFileSync(path.join(__dirname, f), "utf8"));
const mine = String.raw`
const out = { ok: true }, ONLY = process.argv[3] || "";
const K = Z.kit, ST = Z.story;
function fresh(char, name) { const p = S.newPlayer(char || "tunde", name || "Tester"); api._open = false; Z.begin(p, true); if (Z.intro && Z.intro.on && Z.intro.end) Z.intro.end(); run(.1); api._open = false; return Z.P; }
function days(n) { for (let i = 0; i < n; i++) { Z.P.day++; run(.05); } }
function press(id) { const on = api._on; if (!on) throw new Error("no dialog open for " + id); on(id, { disabled: false, getAttribute: () => id, style: {}, classList: { add: noop } }); }
function goStep(mid, pred) { const P = Z.P, m = D.MISSIONS.find((q) => q.id === mid); const i = m.steps.findIndex(pred); if (i < 0) throw new Error(mid + ": step not found"); P.m.active = mid; P.m.step = i; P.m.n = 0; ST.ctx = {}; if (Z.stepStart) Z.stepStart(); api._open = false; return { m, i }; }
function near(o, x, y, r) { return Math.hypot(o.x - x, o.y - y) < (r || 1.5); }
function section(name, fn) { if (ONLY && ONLY !== name) return; try { K.strict = true; out[name] = fn() || {}; } catch (e) { out.ok = false; out[name] = { error: String(e && e.stack || e).split("\n").slice(0, 5).join(" | ") }; } finally { K.strict = false; } }
try { run(.5);
${"${PARTS}"}
out.kitErrors = K.errs.slice(0, 5);
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1);
`.replace("${PARTS}", () => parts.join("\n"));
eval(boot + mine);
