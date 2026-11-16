/**
 * The sound manager: inventory extraction from the game scripts, override
 * resolution, upload checks (type sniffing, size, length) and the editor maths.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { audioSeconds, checkSoundFile, sniffAudio, SOUND_LIMITS } from "../src/games/sounds/audio-file.ts";
import { applyEdit, encodeWav, fitRate, peaks, soundEnd } from "../src/games/sounds/dsp.ts";
import { buildInventory, extractSoundCalls, fanfareName, findSong, groupOf, literals, parseLegacyDesc } from "../src/games/sounds/extract.ts";
import { registerSoundInventory, soundEntry, soundInventory, soundInventoryCounts } from "../src/games/sounds/index.ts";
import { resolveOverrides, soundFileUrl, soundRows } from "../src/games/sounds/overrides.ts";
import { LEGACY_GAMES } from "../src/games/legacy.ts";

const PUB = join(dirname(fileURLToPath(import.meta.url)), "../public/play/_shared");

describe("inventory extraction", () => {
  it("reads sfx calls, ternaries and skips compared strings", () => {
    const src = `function goal() { api.sound.sfx("goal"); }
      function step(act) { api.sound.sfx(act === "touch" ? "zap" : act === "ground" || act === "unground" ? "click" : "dash"); }
      function x(n) { api.sound.sfx(n); }`;
    const calls = extractSoundCalls("g.js", src);
    expect(calls.map((c) => c.id)).toEqual(["goal", "zap", "click", "dash"]);
    expect(calls[0]).toMatchObject({ file: "g.js", line: 1, fn: "goal" });
    expect(calls[1]!.line).toBe(2);
    expect(literals(`k === "oneup" ? "power" : "special"`)).toEqual(["power", "special"]);
  });

  it("maps roar, fanfare, ceremony, voice and sample players to their sound names", () => {
    const src = `api.sound.roar(false); api.sound.roar(true); S.roar(x);
      api.ceremony(win ? "champion" : "lose", {}); Sound.fanfare("draw");
      api.sound.voice(p.v, "laugh"); x.play("land", {}); X.loop("eng_car"); Sound.play(song); el.play();`;
    const ids = extractSoundCalls("g.js", src).map((c) => c.id);
    expect(ids).toEqual(["crowd_cheer", "crowd_groan", "crowd_cheer", "crowd_groan", "fanfare_champion", "fanfare_lose", "fanfare_draw", "grunt_laugh", "land", "eng_car"]);
    expect(fanfareName("stageClear")).toBe("fanfare_win");
    expect(fanfareName("whatever")).toBe("fanfare_lose");
  });

  it("finds the game's theme song", () => {
    expect(findSong([`var x = A.song(5, "calm"); game = { song: A.song(4100, "synthwave", { bpm: 118 }) }`])).toEqual([4100, "synthwave", { bpm: 118 }]);
    expect(findSong([`api.music(Arcade.song(7, "dub"))`])).toEqual([7, "dub", {}]);
    expect(findSong(["nothing"])).toBeUndefined();
  });

  it("builds an inventory: groups, sources, usage, pack names and shared calls", () => {
    const inv = buildInventory({
      slug: "demo",
      title: "Demo",
      scripts: [{ file: "demo.js", text: `function hit() { api.sound.sfx("kick"); api.sound.sfx("coin"); } var g = { song: A.song(1, "funk") };` }],
      shared: [{ id: "click", file: "arcade.js", line: 3, fn: "" }],
      manifest: { core: { coin: { f: ["core/coin_1"] } }, packs: { demo: { thud: { f: ["demo/thud"] } } } },
      generic: { kick: { name: "Kick", desc: "A kick" }, thud: { desc: "A dull thud" } },
      usage: { kick: ["Demo → kicking the ball"] },
      sharedUsage: { click: "Every menu button" },
    });
    const by = Object.fromEntries(inv.sounds.map((s) => [s.id, s]));
    expect(Object.keys(by).sort()).toEqual(["click", "coin", "kick", "music", "thud"]);
    expect(by.kick).toMatchObject({ name: "Kick", group: "gameplay", source: "synth", preview: "synth", usage: ["Demo → kicking the ball"] });
    expect(by.coin).toMatchObject({ group: "rewards", source: "sample", preview: "file", files: ["core/coin_1"] });
    expect(by.thud).toMatchObject({ source: "file", usage: ["Demo → a dull thud"] });
    expect(by.click).toMatchObject({ group: "menus", usage: ["Every menu button"] });
    expect(by.music).toMatchObject({ group: "music", source: "composed", preview: "song", song: [1, "funk", {}] });
    expect(inv.sounds[0]!.group).toBe("menus"); // sorted by group
    expect(groupOf("amb_birds")).toBe("ambience");
  });

  it("reads arcade-sounds.js's descriptions", () => {
    const d = parseLegacyDesc(readFileSync(join(PUB, "js/games/arcade-sounds.js"), "utf8"));
    expect(d.click).toEqual({ group: "menus", desc: "A button press in menus" });
    expect(d.amb_birds?.group).toBe("ambience");
  });

  it("has a generated inventory for all 16 legacy games, each id valid and with usage", () => {
    const counts = soundInventoryCounts();
    for (const slug of Object.keys(LEGACY_GAMES)) {
      expect(counts[slug], slug).toBeGreaterThan(5);
      for (const s of soundInventory(slug)!.sounds) {
        expect(s.id).toMatch(/^[a-z0-9_][a-z0-9_.:-]{0,79}$/);
        expect(s.usage.length, `${slug}/${s.id}`).toBeGreaterThan(0);
      }
    }
    expect(soundEntry("momentum-cup", "goal")?.usage[0]).toMatch(/goal scored/);
    expect(soundEntry("kinetic-kingdom", "coin")?.usage.join(" ")).toMatch(/coin pickup/);
  });

  it("lets a new game register its own sounds", () => {
    registerSoundInventory({ slug: "wip-test", title: "WIP", kind: "registered", sounds: [
      { id: "door", name: "Door", group: "gameplay", usage: ["A door"], source: "file", files: [], calls: [], preview: "none" },
      { id: "Bad Id", name: "Bad", group: "gameplay", usage: ["x"], source: "file", files: [], calls: [], preview: "none" },
    ] });
    expect(soundInventory("wip-test")?.sounds.map((s) => s.id)).toEqual(["door"]);
  });
});

describe("override resolution", () => {
  const at = new Date(1000);
  it("maps rows to URLs with versions and volumes, and lists the files to precache", () => {
    const map = resolveOverrides("momentum-cup", [{ name: "goal", version: 3, contentType: "audio/wav", size: 9, duration: 1, updatedAt: at }], [
      { name: "goal", volume: 0.5 },
      { name: "kick", volume: 1.5 },
      { name: "click", volume: 1 },
    ]);
    expect(map.sounds[0]).toMatchObject({ name: "goal", v: 3, vol: 0.5, url: "/api/games/arcade/sounds/momentum-cup/file/goal?v=3" });
    expect(map.vols).toEqual({ goal: 0.5, kick: 1.5 });
    expect(map.files).toEqual([soundFileUrl("momentum-cup", "goal", 3)]);
    expect(soundFileUrl("a b", "voice:x", 1)).toBe("/api/games/arcade/sounds/a%20b/file/voice%3Ax?v=1");
  });

  it("gives every inventory sound a status, and lists stray overrides too", () => {
    const inv = soundInventory("momentum-cup")!.sounds;
    const map = resolveOverrides("momentum-cup", [
      { name: "goal", version: 2, contentType: "audio/wav", size: 9, duration: 1, updatedAt: at },
      { name: "old_name", version: 1, contentType: "audio/wav", size: 9, duration: 1, updatedAt: at },
    ], [{ name: "kick", volume: 0.3 }]);
    const rows = soundRows(inv, map, { goal: 2 });
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.goal).toMatchObject({ status: "custom", versions: 2 });
    expect(by.kick).toMatchObject({ status: "original", volume: 0.3 });
    expect(by.old_name).toMatchObject({ status: "custom" });
    expect(rows.length).toBe(inv.length + 1);
  });
});

/* --------------------------------------------------------- upload checks */

function wav(seconds: number, rate = 8000): Uint8Array {
  return encodeWav([new Float32Array(Math.round(seconds * rate))], rate);
}
function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

describe("upload validation", () => {
  it("sniffs WAV, MP3, OGG and M4A from their bytes, not their names", () => {
    expect(sniffAudio(wav(0.1))).toBe("audio/wav");
    expect(sniffAudio(new Uint8Array([...ascii("ID3"), 4, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("audio/mpeg");
    expect(sniffAudio(new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("audio/mpeg");
    expect(sniffAudio(new Uint8Array([...ascii("OggS"), 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("audio/ogg");
    expect(sniffAudio(new Uint8Array([0, 0, 0, 0x20, ...ascii("ftypM4A "), 0, 0]))).toBe("audio/mp4");
    expect(sniffAudio(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull(); // a PNG
    expect(sniffAudio(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });

  it("reads the length from WAV, MP3 (CBR), OGG and M4A headers", () => {
    expect(audioSeconds(wav(1.5), "audio/wav")).toBeCloseTo(1.5, 3);
    // MP3: 128 kbps MPEG-1 layer III frames at 44.1 kHz, 16000 bytes of frames = 1 s
    const mp3 = new Uint8Array(16000);
    mp3.set([0xff, 0xfb, 0x90, 0x00]);
    expect(audioSeconds(mp3, "audio/mpeg")).toBeCloseTo(1, 2);
    // OGG Vorbis: identification header (rate 44100) and a last page with granule 88200 = 2 s
    const ogg = new Uint8Array(200);
    ogg.set(ascii("OggS"));
    ogg.set([1, ...ascii("vorbis"), 0, 0, 0, 0, 1, 0x44, 0xac, 0, 0], 28);
    ogg.set(ascii("OggS"), 120);
    new DataView(ogg.buffer).setUint32(126, 88200, true);
    expect(audioSeconds(ogg, "audio/ogg")).toBeCloseTo(2, 3);
    // M4A: mvhd version 0, timescale 1000, duration 2500 = 2.5 s
    const m4a = new Uint8Array(80);
    m4a.set(ascii("ftypM4A "), 4);
    m4a.set(ascii("mvhd"), 20);
    const dv = new DataView(m4a.buffer);
    dv.setUint32(20 + 4 + 4 + 8, 1000);
    dv.setUint32(20 + 4 + 4 + 12, 2500);
    expect(audioSeconds(m4a, "audio/mp4")).toBeCloseTo(2.5, 3);
  });

  it("rejects empty, too big, wrong-type, too short and too long files", () => {
    expect(checkSoundFile(new Uint8Array())).toEqual({ ok: false, error: "Choose a sound file." });
    expect(checkSoundFile(new Uint8Array(SOUND_LIMITS.maxBytes + 1)).ok).toBe(false);
    expect(checkSoundFile(new TextEncoder().encode("not a sound at all")).ok).toBe(false);
    const short = checkSoundFile(wav(0.01));
    expect(short.ok).toBe(false);
    expect(!short.ok && short.error).toMatch(/between 0.05 and 120/);
    expect(checkSoundFile(wav(121, 2000)).ok).toBe(false);
    expect(checkSoundFile(wav(0.5))).toEqual({ ok: true, type: "audio/wav", ext: "wav", seconds: 0.5 });
  });

  it("uses the browser's measured length only when the header cannot be read", () => {
    const odd = new Uint8Array(400);
    odd.set(ascii("OggS")); // no codec header: length unreadable
    expect(checkSoundFile(odd).ok).toBe(false);
    expect(checkSoundFile(odd, 3)).toMatchObject({ ok: true, type: "audio/ogg", seconds: 3 });
    expect(checkSoundFile(wav(1), 99)).toMatchObject({ seconds: 1 }); // the file wins
  });
});

describe("editor maths", () => {
  const rate = 1000;
  const ramp = () => [Float32Array.from({ length: 1000 }, () => 0.5)];
  it("trims, fades, normalises and applies gain", () => {
    const out = applyEdit(ramp(), rate, { start: 0.1, end: 0.6, fadeIn: 0.1, fadeOut: 0.1, gain: 1, normalise: true })[0]!;
    expect(out.length).toBe(500);
    expect(out[0]).toBe(0);
    expect(out[250]).toBeCloseTo(0.891, 3);
    expect(out[499]).toBe(0);
    const loud = applyEdit(ramp(), rate, { start: 0, end: 1, fadeIn: 0, fadeOut: 0, gain: 4, normalise: false })[0]!;
    expect(Math.max(...loud)).toBe(1); // clipped, never over
  });
  it("finds the end of the sound, draws peaks, and encodes a WAV", () => {
    const ch = new Float32Array(1000);
    ch.fill(0.5, 0, 300);
    expect(soundEnd([ch], rate, 0.002, 0)).toBeCloseTo(0.3, 3);
    const p = peaks(ch, 10);
    expect(p.length).toBe(10);
    expect(p[0]).toEqual({ min: 0, max: 0.5 });
    const w = encodeWav([ch], rate);
    expect(w.length).toBe(44 + 2000);
    expect(audioSeconds(w, "audio/wav")).toBe(1);
  });
  it("picks a sample rate that fits the size limit", () => {
    expect(fitRate(10, 48000, 2 * 1024 * 1024)).toBe(48000);
    expect(fitRate(30, 48000, 2 * 1024 * 1024)).toBe(22050);
    expect(fitRate(500, 48000, 2 * 1024 * 1024)).toBeNull();
  });
});
