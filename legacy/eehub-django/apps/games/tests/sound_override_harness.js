/* Headless check of the Sounds tab's playing rules in arcade-audio.js (+ the pure helpers in arcade-sounds.js):
   switched off > the player's own file > a file set for everyone > the default recording > the built-in synth.
   Usage: node sound_override_harness.js <static/js/games dir>. Prints one JSON object; exits 1 on any thrown error.
   Deterministic: a fake AudioContext whose clock only moves when the harness says so. */
const fs = require("fs"), path = require("path"), dir = process.argv[2];
const SRC = { audio: fs.readFileSync(path.join(dir, "arcade-audio.js"), "utf8"), sounds: fs.readFileSync(path.join(dir, "arcade-sounds.js"), "utf8") };
const noop = () => {};
const played = [], synth = [], gains = [];
let now = 10;
class AudioBuffer { constructor(tag, dur) { this.tag = tag; this.duration = dur || .2; this.sampleRate = 8000; this.numberOfChannels = 1; this.length = Math.round(this.duration * 8000); } getChannelData() { return new Float32Array(this.length); } }
function param(v) { return { value: v || 0, setValueAtTime(x) { gains.push(x); this.value = x; }, setTargetAtTime(x) { this.value = x; }, cancelScheduledValues: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop }; }
function node() { return { connect: noop, disconnect: noop, gain: param(1), pan: param(0) }; }
const ac = {
  get currentTime() { return now; }, state: "running", resume: noop, destination: node(),
  createGain: () => node(), createStereoPanner: () => node(),
  createDynamicsCompressor: () => Object.assign(node(), { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
  createBufferSource: () => Object.assign(node(), { buffer: null, playbackRate: param(1), loop: false, start() { played.push(this.buffer && this.buffer.tag); if (this.onended) this.onended(); }, stop: noop }),
  decodeAudioData: (ab, ok) => { const tag = new TextDecoder().decode(new Uint8Array(ab)); ok(new AudioBuffer(tag)); }
};
const Sound = { ac, muted: false, fx: node(), music: node(), lastSfx: {}, song: null, timer: 0,
  ensure() { return true; }, unlock: noop,
  sfx(name) { synth.push(name); }, fanfare(kind) { synth.push("fanfare:" + kind); }, say(text) { synth.push("say:" + text); },
  voice(v, kind) { synth.push("grunt:" + kind); }, roar(sad) { synth.push(sad ? "groan" : "cheer"); }, loop() { synth.push("compose"); } };
const ls = {};
global.window = global; global.AudioBuffer = AudioBuffer;
global.localStorage = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } };
const stage = { getAttribute: (k) => ({ "data-gm-slug": "test-game", "data-gm-api": "" }[k] || null) };
global.document = { currentScript: null, querySelector: (s) => (s === "[data-gm-stage]" ? stage : null), createElement: () => ({ canPlayType: () => "probably" }), getElementById: () => null };
global.Arcade = { Sound, settings: { voice: true } };
const ab = (s) => new TextEncoder().encode(s).buffer;

const out = { checks: {} };
function check(name, cond, info) { out.checks[name] = !!cond; if (!cond) out.fail = (out.fail || []).concat(name + (info ? " " + JSON.stringify(info) : "")); }
function last(fn) { played.length = 0; synth.length = 0; now += 1; fn(); return { played: played.slice(), synth: synth.slice() }; }

const tick = () => new Promise((ok) => setImmediate(ok));
(async function main() {
try {
  (0, eval)(SRC.audio);
  const X = Arcade.Audio;
  X.setManifest({ core: { click: { f: ["core/click_1"], bus: "ui", g: 1 }, eng_car: { f: ["fslg/eng_car"], bus: "vehicles" } }, packs: {} });
  X.buf["core/click_1"] = new AudioBuffer("default"); X.buf["fslg/eng_car"] = new AudioBuffer("default-loop", 2);
  (0, eval)(SRC.sounds); // boots against Arcade.Audio (no IndexedDB here: nothing stored, nothing cleared)
  for (let i = 0; i < 8; i++) await tick(); // let its first (offline, empty) sync of the everyone-list finish

  let r = last(() => Sound.sfx("click"));
  check("default_file", r.played[0] === "default" && !r.synth.length, r);
  X.setOverride("global", "click", ab("global")); await tick();
  r = last(() => Sound.sfx("click"));
  check("global_over_default", r.played[0] === "global", r);
  X.setOverride("personal", "click", ab("personal")); await tick();
  r = last(() => Sound.sfx("click"));
  check("personal_over_global", r.played[0] === "personal", r);
  X.setOverride("personal", "click", null); await tick();
  r = last(() => Sound.sfx("click"));
  check("personal_removed_back_to_global", r.played[0] === "global", r);
  X.setOverride("global", "click", null); await tick();
  r = last(() => Sound.sfx("click"));
  check("global_removed_back_to_default", r.played[0] === "default", r);

  // synth fallback, and an override of a synth-only name
  r = last(() => Sound.sfx("zap"));
  check("synth_fallback", !r.played.length && r.synth[0] === "zap", r);
  X.setOverride("global", "zap", ab("zap-global")); await tick();
  r = last(() => Sound.sfx("zap"));
  check("override_beats_synth", r.played[0] === "zap-global" && !r.synth.length, r);

  // switched off: nothing at all, whatever is behind it
  X.setOverride("personal", "click", ab("personal")); await tick();
  X.prefs.click = { off: true }; X.savePrefs();
  r = last(() => { Sound.sfx("click"); X.play("click"); });
  check("disabled_is_silent", !r.played.length && !r.synth.length, r);
  check("disabled_play_reports_handled", X.play("click") === true);
  X.prefs.zap = { off: true };
  r = last(() => Sound.sfx("zap"));
  check("disabled_synth_is_silent", !r.played.length && !r.synth.length, r);
  check("prefs_saved", JSON.parse(ls["ee-arcade-snd-test-game"] || "{}").click.off === true);
  r = last(() => X.preview("click"));
  check("preview_ignores_off", r.played[0] === "personal", r);
  r = last(() => X.preview("click", "default"));
  check("preview_default", r.played[0] === "default", r);
  check("off_restored_after_preview", X.prefs.click.off === true);
  delete X.prefs.click; delete X.prefs.zap;

  // loops
  X.prefs.eng_car = { off: true };
  let h; r = last(() => { h = X.loop("eng_car"); });
  check("disabled_loop_silent_handle", h && h.off && typeof h.set === "function" && !r.played.length, r);
  delete X.prefs.eng_car; X.setOverride("personal", "eng_car", ab("my-engine")); await tick();
  r = last(() => { h = X.loop("eng_car"); });
  check("loop_override", r.played[0] === "my-engine" && h && !h.off, r);

  // own volume
  X.setOverride("personal", "click", null); await tick(); X.prefs.click = { vol: .5 }; gains.length = 0;
  r = last(() => Sound.sfx("click"));
  check("volume_applied", gains.some((g) => g > .4 && g < .6), gains);
  delete X.prefs.click;

  // specials: fanfares, crowd, fighters' voices, spoken lines
  r = last(() => Sound.fanfare("win"));
  check("fanfare_default", r.synth[0] === "fanfare:win", r);
  X.setOverride("global", "fanfare_win", ab("my-fanfare")); await tick();
  r = last(() => Sound.fanfare("newRecord"));
  check("fanfare_override", r.played[0] === "my-fanfare" && r.synth.indexOf("fanfare:newRecord") < 0, r);
  X.prefs.fanfare_lose = { off: true };
  r = last(() => Sound.fanfare("lose"));
  check("fanfare_off", r.synth.indexOf("fanfare:lose") < 0 && r.played.indexOf("my-fanfare") < 0, r);
  r = last(() => Sound.roar(false));
  check("crowd_default", r.synth[0] === "cheer", r);
  X.prefs.crowd_cheer = { off: true };
  r = last(() => Sound.roar(false));
  check("crowd_off", !r.synth.length && !r.played.length, r);
  r = last(() => Sound.voice({ id: 1, f0: 140 }, "hurt"));
  check("grunt_default", r.synth[0] === "grunt:hurt", r);
  const line = "Stop there! Security!", vn = X.voiceName(line);
  r = last(() => Sound.say(line, {}));
  check("voice_default", r.synth[0] === "say:" + line, r);
  check("voice_name_stable", vn === X.voiceName("stop there security") && /^voice:v[0-9a-f]{8}[0-9a-z]+$/.test(vn), vn);
  X.setOverride("personal", vn, ab("my-line")); await tick();
  r = last(() => Sound.say(line, {}));
  check("voice_override", r.played[0] === "my-line" && !r.synth.length, r);
  X.prefs[vn] = { off: true };
  r = last(() => Sound.say(line, {}));
  check("voice_off", !r.played.length && !r.synth.length, r);

  // the registry the panel lists
  Sound.register({ door_creak: { group: "world", desc: "An old door" } });
  const reg = X.registry(), names = reg.map((i) => i.name);
  ["click", "eng_car", "zap", "music", "fanfare_win", "crowd_cheer", "grunt_hurt", vn, "door_creak"].forEach((n) => check("registry_has_" + n.replace(/[^a-z_]/g, "_"), names.indexOf(n) >= 0));
  const one = reg.filter((i) => i.name === "zap")[0];
  check("registry_flags", one.global === true && one.synth === true, one);
  const AS = global.ArcadeSounds;
  check("classify_groups", AS.classify({ name: "crash_metal" }).group === "crashes" && AS.classify({ name: "step_road" }).group === "feet" &&
    AS.classify({ name: "eng_keke" }).group === "vehicles" && AS.classify({ name: vn, kind: "voice", text: line }).group === "voices" &&
    AS.classify({ name: "door_creak", group: "world", desc: "An old door" }).desc === "An old door");
  check("every_core_name_described", ["click", "back", "confirm", "coin", "boom", "glass", "punch", "step_grass", "amb_birds", "music"].every((n) => AS.DESC[n]));

  // muted: nothing plays
  Sound.muted = true;
  r = last(() => { Sound.sfx("click"); Sound.fanfare("win"); });
  check("muted_silent", !r.played.length && !r.synth.length, r);
  Sound.muted = false;

  // trimming and the WAV writer: 0.5 s of a 1 s buffer at 22050 Hz
  const src = { sampleRate: 44100, numberOfChannels: 2, length: 44100, getChannelData: (c) => new Float32Array(44100).map((_, i) => Math.sin(i / 20) * (c ? .5 : 1)) };
  const w = AS.wav(AS.cut(src, .25, .75, 22050), 22050), dv = new DataView(w);
  check("wav_header", String.fromCharCode(...new Uint8Array(w, 0, 4)) === "RIFF" && dv.getUint32(24, true) === 22050 && Math.abs(dv.getUint32(40, true) / 2 / 22050 - .5) < .001);
  const f = AS.fit(src, 0, 1, 30000);
  check("fit_downsamples_to_limit", f && f.ab.byteLength <= 30000 && f.rate <= 16000, f && { rate: f.rate, b: f.ab.byteLength });
  out.wav = Buffer.from(w).toString("base64");
} catch (e) {
  out.error = String(e && e.stack || e);
}
out.ok = !out.error && !out.fail;
process.stdout.write(JSON.stringify(out));
process.exit(out.error ? 1 : 0);
})();
