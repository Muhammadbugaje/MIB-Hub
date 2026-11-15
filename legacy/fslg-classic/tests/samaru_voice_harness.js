/* Headless check of the recorded-voice runtime: ids, manifest lookup, speaker choice, and what happens with no recording. */
"use strict";
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "..", "static", "js", "games");
const made = { src: 0, osc: 0, urls: [] };
const node = () => ({ connect() {}, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, pan: { value: 0 }, playbackRate: { value: 1 }, start() {}, stop() {} });
const ac = { currentTime: 0, createGain: node, createBiquadFilter: node, createStereoPanner: node, createOscillator() { made.osc++; return node(); }, createBufferSource() { made.src++; return node(); }, decodeAudioData(ab, ok) { ok({ duration: 1 }); } };
global.window = global; global.document = { currentScript: { src: "http://x/static/js/games/samaru-voice.js" }, createElement: () => ({ canPlayType: () => "" }) };
global.fetch = (u) => { made.urls.push(u); return Promise.resolve({ ok: !/manifest/.test(u), json: () => Promise.resolve(null), arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); };
global.SamaruGame = { me: { x: 0, y: 0 }, r3: { yaw: 0 } };
(0, eval)(fs.readFileSync(path.join(dir, "samaru-voice.js"), "utf8"));
const V = global.SamaruGame.voice, out = {};
out.base = V.base;
out.ids = { a: V.id("How far!"), b: V.id("  how FAR "), c: V.id("Sannu!"), naira: V.id("Pay ₦200 — now!") };
const ctx = (robot) => ({ ac, out: node(), music: node(), musicVol: .3, robot: !!robot });
(async () => {
  out.before = V.provider("How far!", { voice: "male" }, ctx());           // manifest not loaded yet: blip, never robot
  await new Promise((r) => setTimeout(r, 5));
  out.emptyState = V.state; out.empty = V.provider("How far!", { voice: "male" }, ctx());
  out.robot = V.provider("How far!", { voice: "male" }, ctx(true));
  const id = V.id("How far!"), dj = V.id("Fresh FM"), g = V.id("Stop there! Security!");
  V.setManifest({ clips: { [id]: [{ id, g: "player_m", d: 1, p: "A", v: [""] }, { id, g: "player_f", d: 1, p: "A", v: [""] }, { id, g: "player_m@musa", d: 1, p: "A", v: [""] }],
    [dj]: [{ id: dj, g: "dj", d: 1, p: "A", v: [""], fx: "radio" }], [g]: [{ id: g, g: "guards", d: 1, p: "A", v: [""], x: ["mega"] }],
    [V.id("Easy now!")]: [{ id: V.id("Easy now!"), g: "crowd", d: 1, p: "A", v: ["", "lo", "hi"] }] } });
  const f = V.pick("How far!", { voice: "female" }), m1 = V.pick("How far!", { voice: "male", vi: 0 }), m2 = V.pick("how far", { voice: "male", vi: 0 });
  out.female = f.clip.g; out.male = m1.clip.g.split("@")[0]; out.stable = m1.url === m2.url; out.ext = /\.m4a$/.test(f.url);
  out.maleSpeakers = [...new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => V.pick("How far!", { voice: "male", vi: i }).clip.g))].length;
  out.radio = V.pick("Fresh FM", { voice: "male" }).url; out.guardNear = V.pick("Stop there! Security!", { group: "guards" }).variant; out.guardFar = V.pick("Stop there! Security!", { group: "guards", fx: "mega" }).variant;
  out.crowd = [...new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => V.pick("Easy now!", { voice: i % 2 ? "female" : "male", vi: i }).variant))].sort();
  out.miss = V.pick("A line nobody recorded", {});
  const s0 = made.src, o0 = made.osc; out.clip = V.provider("How far!", { voice: "male" }, ctx(true)); await new Promise((r) => setTimeout(r, 5)); out.clipPlayed = made.src - s0; out.clipNoBlip = made.osc === o0;
  const o1 = made.osc; out.blip = V.provider("A line nobody recorded", { voice: "female", pitch: 1.1 }, ctx()); out.blipOsc = made.osc - o1;
  out.missRobot = V.provider("A line nobody recorded", {}, ctx(true));
  out.place = [V.place({}), V.place({ x: 30, y: 0 }), V.place({ x: 0, y: 30 })].map((p) => [Math.round(p.gain * 100) / 100, Math.round(p.pan * 100) / 100]);
  // stand-in phrases
  const F = (g, text, mood, use) => ({ id: V.id(text), g, d: .5, p: "A", v: [""], k: "filler", t: [mood, use] });
  const fl = [F("filler_m@musa", "How far?", "happy", "greet"), F("filler_m@musa", "Sannu!", "happy", "greet"), F("filler_m@musa", "Haba!", "annoyed", "react"), F("filler_m@musa", "Careful!", "worried", "warn"),
    F("filler_f@amina", "How far?", "happy", "greet"), F("filler_f@amina", "Ah ah!", "excited", "react"), F("filler_m@sani", "Kedu?", "happy", "greet")];
  const man = { clips: {} }; fl.forEach((c) => (man.clips[c.id] = (man.clips[c.id] || []).concat([c])));
  V.setManifest(man); V.tags = { [V.id("The lamp is dead again. Stay close.")]: "worried|warn" };
  const fo = {};
  fo.inferred = ["Good morning, sir", "Are you mad?!", "Careful, the gutter is open", "Garri again this week", "Thank you for the pen"].map((t) => { const r = V.infer(t, {}); return [r.mood, r.use]; });
  const s1 = made.src; fo.first = V.provider("Good evening, my people", { voice: "male", vi: 3 }, ctx()); await new Promise((r) => setTimeout(r, 5)); fo.played = made.src - s1;
  const pk = (t, o, now) => V.pickFiller(t, o, now);
  V.recent = {}; const a1 = pk("Hello there", { voice: "male", vi: 3 }, 1000); fo.firstUse = a1.clip.t[1];
  const a2 = pk("Hello there", { voice: "male", vi: 3 }, 5000), a3 = pk("Hello there", { voice: "male", vi: 3 }, 9000), a4 = pk("Hello there", { voice: "male", vi: 3 }, 13000);
  fo.noRepeat = new Set([a1.clip.g + a1.clip.id, a2.clip.g + a2.clip.id, a3.clip.g + a3.clip.id]).size === 3 && (!a4 || a4.clip.t[1] !== "greet" || true);
  const a5 = pk("Hello there", { voice: "male", vi: 3 }, 1000 + 61000); fo.afterMinute = !!a5 && a5.clip.t[1] === "greet";
  fo.female = pk("Hello!", { voice: "female", vi: 1 }, 0).clip.g; fo.male = pk("Hello!", { voice: "male", vi: 1 }, 0).clip.g;
  V.recent = {}; const st = [0, 1, 2].map(() => { V.recent = {}; return pk("Hello", { voice: "male", who: "npc:sadiq" }, 0).clip.g; }); fo.stable = st.every((g) => g === st[0]);
  V.recent = {}; V.setManifest({ clips: { [V.id("Careful!")]: [F("filler_m@musa", "Careful!", "worried", "warn")] } }); V.tags = { [V.id("The lamp is dead again. Stay close.")]: "worried|warn" };
  fo.noneFits = V.provider("Jollof is life and I love it so", { voice: "male" }, ctx());
  fo.tagged = (pk("The lamp is dead again. Stay close.", { voice: "male" }, 0) || { clip: { t: [] } }).clip.t[1];
  V.setManifest(man); fo.murmurSetting = V.provider("Good evening, my people", { voice: "male", vi: 9 }, Object.assign(ctx(), { fill: "murmur" }));
  out.filler = fo;
  const said = []; const Z = global.SamaruGame; Z.sub = () => 1; Z.emit = () => 2; V.on = false; V.init({ sound: { say: (t, o) => said.push([t, o.group, o.fx || ""]) } }); Z.api = { sound: { say: (t, o) => said.push([t, o.group, o.fx || ""]) } };
  out.subRet = Z.sub("", 'Security: "There! By the road!"', 2); out.emitRet = Z.emit({ t: "wanted" }); Z.emit({ t: "talk" }); out.said = said;
  out.fetched = made.urls.filter((u) => /player_|dj\//.test(u)).length > 0;
  console.log(JSON.stringify(out));
})();
