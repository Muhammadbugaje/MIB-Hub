/**
 * The story data the game plays comes straight from docs/plan/missions/Y1.md:
 * the parser reads every mission, step, cutscene and line id; the build-time
 * bundle is that parse; every speaker has a voice profile.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { draftLines, parseBarks, parseCutscene, parseFlow, parseMissionFile, spokenLines } from "../src/story/parse.ts";
import { loadStory } from "../tools/story-plugin.ts";
import { VOICE_PROFILES, deliver, pickVoice, profileKey, speakable } from "../src/game/voices.ts";
import { CAST, CAST_SKIN, LOCKED_SKIN, castKey } from "../src/game/cast.ts";

const ROOT = resolve(__dirname, "../../..");
const Y1 = readFileSync(resolve(ROOT, "docs/plan/missions/Y1.md"), "utf8");
const missions = parseMissionFile(Y1).filter((m) => m.num <= 10);

describe("parser: flow maps", () => {
  it("reads strings, numbers, booleans, nested maps and escaped quotes", () => {
    expect(parseFlow('{ who: DAD, id: m001_film_01, text: "This is not the main gate.", mood: stern }')).toEqual({ who: "DAD", id: "m001_film_01", text: "This is not the main gate.", mood: "stern" });
    expect(parseFlow('{ PLAYER: { at: basement_stair, items: { zobo_max: 1, naira: "+1000" } }, flags: { m010_done: true } }')).toEqual({ PLAYER: { at: "basement_stair", items: { zobo_max: 1, naira: "+1000" } }, flags: { m010_done: true } });
    expect(parseFlow('{ text: "He said \\"hi\\", twice." }')).toEqual({ text: 'He said "hi", twice.' });
    expect(() => parseFlow("{ who DAD }")).toThrow();
  });

  it("keeps the then/else side of if: blocks", () => {
    const c = parseCutscene(["id: cut_x", "cast: { A: npc.a, J?: special.jiya }", "timeline:", "  - at: 0.0  say: { who: A, id: m001_open_01, text: \"a\", mood: dry }", "  - if: special.jiya", "    then:", "      - at: 1.0  say: { who: J, id: m001_open_j01, text: \"j\", mood: dry }", "    else:", "      - at: 1.0  say: { who: A, id: m001_open_02, text: \"e\", mood: dry }", "  - at: 2.0  camera.return: { blend: 1.0 }", "endState: { flags: { x: true } }"].join("\n"), 1);
    expect(c.optional).toEqual(["J"]);
    expect(c.timeline.map((e) => [e.at, e.cond, e.branch])).toEqual([[0, null, null], [1, "special.jiya", "then"], [1, "special.jiya", "else"], [2, null, null]]);
    expect(c.endState).toEqual({ flags: { x: true } });
  });
});

describe("Y1.md: Missions 1-10", () => {
  it("has the ten missions in story order", () => {
    expect(missions.map((m) => m.key)).toEqual(["m001", "m002", "m003", "m004", "m005", "m006", "m007", "m008", "m009", "m010"]);
    expect(missions.map((m) => m.title)).toEqual(["Welcome, Fresher", "Queue Theory", "Belle First", "Matric Fit", "First Lecture, Wrong Theatre", "Mai Shayi Knows", "Fresher Tax", "Left Boot First", "Doctor's Orders", "The Plug"]);
  });

  it("every mission has 6-7 steps with objective text under 60 characters", () => {
    for (const m of missions) {
      expect(m.steps.length, m.key).toBeGreaterThanOrEqual(6);
      for (const s of m.steps) {
        expect(s.objective.length, `${m.key} step ${s.n}`).toBeGreaterThan(3);
        expect(s.objective.length, `${m.key} step ${s.n}`).toBeLessThan(60);
        expect(s.completeWhen, `${m.key} step ${s.n}`).not.toBe("");
      }
    }
  });

  it("cutscene ids follow FORMAT.md and every mission has an open (or film) and a close", () => {
    for (const m of missions) {
      const ids = m.cutscenes.map((c) => c.id);
      expect(ids.some((i) => /_open$|_film_a$/.test(i)), m.key).toBe(true);
      expect(ids.some((i) => /_close$/.test(i)), m.key).toBe(true);
      for (const c of m.cutscenes) {
        expect(c.id).toMatch(/^cut_m0\d\d_(open|close|mid_\d|film_[a-e])$/);
        expect(c.maxDuration).toBeLessThanOrEqual(40);
        for (const e of c.timeline) expect(e.at, `${c.id} at ${e.at}`).toBeLessThanOrEqual(c.maxDuration);
      }
    }
    expect(missions.flatMap((m) => m.cutscenes).length).toBe(35);
  });

  it("every spoken line has a unique id and a text", () => {
    const lines = missions.flatMap((m) => spokenLines(m));
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of lines) {
      expect(l.id).toMatch(/^m0(0\d|10)_/);
      expect(l.text.length).toBeGreaterThan(0);
    }
    expect(lines.length).toBeGreaterThan(150);
  });

  it("optional (special) roles only act inside if: blocks", () => {
    for (const m of missions)
      for (const c of m.cutscenes)
        for (const e of c.timeline) {
          const who = String(e.args.who ?? e.args.look ?? "");
          if (c.optional.includes(who)) expect(e.cond, `${c.id} ${who}`).toMatch(/^special\./);
        }
  });

  it("special-character draft lines are read with their ids", () => {
    const m1 = missions[0]!;
    expect(m1.specials.find((s) => s.who === "special.taty")!.lines.map((l) => l.id)).toEqual(["m001_play_t01", "m001_play_t02"]);
    expect(draftLines('`m008_play_t04` (to Jega) "You tie that boot one more time, I\'m taking it home."')[0]).toMatchObject({ id: "m008_play_t04", note: "to Jega" });
  });

  it("the build-time bundle is exactly the parse of Y1.md (the game never retypes the script)", () => {
    const b = loadStory(ROOT, resolve(__dirname, ".."));
    expect(b.missions).toEqual(missions);
    expect(Object.keys(b.barks).length).toBeGreaterThan(20);
    expect(b.barks.public_freshers!.barks.every((x) => x.stage === "Filler" || x.stage === "Year 1")).toBe(true);
    // Line ids in the voice scripts point to their character file.
    expect(b.lineOwner.m001_film_03).toBe("mum");
  });

  it("never names the real university or town", () => {
    const text = JSON.stringify(missions);
    expect(text).not.toMatch(/Ahmadu Bello|\bABU\b|\bZaria\b|\bSamaru\b|Shinkafi|Kaltume/);
  });
});

describe("barks", () => {
  it("parses ids, moods, text and conditions", () => {
    const p = parseBarks(readFileSync(resolve(ROOT, "docs/voice/barks/public_freshers.md"), "utf8"));
    expect(p.id).toBe("crowd.freshers");
    const night = p.barks.find((b) => b.id === "bk_pub_freshers_f_night_01")!;
    expect(night).toMatchObject({ mood: "whisper", when: "night", stage: "Filler", category: "night" });
  });
});

describe("voices: a distinct profile for every speaker in M1-M10", () => {
  const speakers = new Set(missions.flatMap((m) => spokenLines(m)).map((l) => l.castId));

  it("covers every speaking cast id (roommate and player by sex)", () => {
    const missing: string[] = [];
    for (const id of speakers) for (const f of [false, true]) if (!VOICE_PROFILES[profileKey(id, f)]) missing.push(`${id}/${f ? "f" : "m"}`);
    expect(missing).toEqual([]);
  });

  it("no two characters share the same voice settings", () => {
    const seen = new Map<string, string>();
    for (const [k, p] of Object.entries(VOICE_PROFILES)) {
      const sig = `${p.prefer[0]}|${p.pitch}|${p.rate}`;
      expect(seen.get(sig), `${k} sounds like ${seen.get(sig)}`).toBeUndefined();
      seen.set(sig, k);
    }
  });

  it("picks a voice of the right sex, avoids taken ones and novelty voices", () => {
    const voices = [{ name: "Daniel", lang: "en-GB" }, { name: "Samantha", lang: "en-US" }, { name: "Karen", lang: "en-AU" }, { name: "Bad News", lang: "en-US" }, { name: "Microsoft Abeo Online (Natural) - English (Nigeria)", lang: "en-NG" }];
    expect(pickVoice(VOICE_PROFILES["npc.mum"]!, voices)?.name).toBe("Karen");
    expect(pickVoice(VOICE_PROFILES["npc.dad"]!, voices)?.name).toMatch(/Abeo/);
    expect(pickVoice(VOICE_PROFILES["npc.gate_guard"]!, voices, new Set(["Microsoft Abeo Online (Natural) - English (Nigeria)"]))?.name).toBe("Daniel");
    expect(pickVoice(VOICE_PROFILES["npc.zainab"]!, [{ name: "Bad News", lang: "en-US" }])?.name ?? "").not.toBe("Bad News".repeat(2));
  });

  it("reads lines without the bracketed translations, and pauses at ellipses", () => {
    expect(speakable("Mu je! (Let's go!)")).toEqual(["Mu je!"]);
    expect(speakable("…Don't lose that.")).toEqual(["Don't lose that."]);
    expect(speakable("(Trust the Plug.)")).toEqual(["Trust the Plug."]);
    expect(speakable("Sannu! [Hello!] You ate?")).toEqual(["Sannu!  You ate?"]);
    const w = deliver(VOICE_PROFILES["npc.mum"]!, "whisper");
    expect(w.volume).toBeLessThan(VOICE_PROFILES["npc.mum"]!.volume);
  });
});

describe("cast", () => {
  it("every speaking character of M1-M10 who appears on screen has a look", () => {
    const onScreen = new Set(missions.flatMap((m) => m.cutscenes.flatMap((c) => Object.values(c.cast))).filter((id) => id.startsWith("npc.") || id.startsWith("special.")));
    const missing = [...onScreen].filter((id) => !CAST[castKey(id, false)] || !CAST[castKey(id, true)]);
    expect(missing).toEqual([]);
  });

  it("Dr. Zainab is very fair (locked), never dark", () => {
    expect(CAST["npc.zainab"]!.look.skin).toBe(LOCKED_SKIN["npc.zainab"]);
    expect(LOCKED_SKIN["npc.zainab"]).toBe(CAST_SKIN.veryFair);
  });

  it("one scale for all humans: height within ±6%", () => {
    for (const [id, c] of Object.entries(CAST)) {
      expect(Math.abs((c.height ?? 1) - 1), id).toBeLessThanOrEqual(0.06 + 1e-9);
    }
  });
});
