/**
 * Voices: who sounds like what, until real recordings exist.
 *
 * Order of preference for every spoken line (mission `say`, play barks):
 *   1. a recorded file named by the line id (assets/voice/<id>.ogg|mp3|m4a,
 *      listed at build time, so a missing file never causes a 404);
 *   2. the browser's speech synthesis with that character's own profile:
 *      a ranked list of preferred voices (by name, across Chrome, Edge,
 *      Safari and Firefox), language fallbacks, pitch, rate, volume and
 *      pauses, so no two characters in a scene share the same sound;
 *   3. subtitles alone (always shown anyway).
 *
 * Profiles are data. `VOICE_PROFILES` has one entry per cast id that speaks
 * in Missions 1 to 10 (a test checks every speaker has one). Special
 * characters' profiles are placeholders until the real people record: their
 * voices are theirs alone and never reused.
 */

export type Gender = "f" | "m";

export interface VoiceProfile {
  /** Name shown over subtitles. */
  name: string;
  gender: Gender;
  /** Rough age, for the casting note. */
  age: number;
  /** What the real recording should sound like (casting note and accent hint). */
  accent: string;
  /**
   * Preferred synthetic voices, best first. Each entry is matched against the
   * voice's name (case-insensitive, substring). Lists mix browsers on purpose:
   * Edge ("Microsoft Abeo Online (Natural) - English (Nigeria)"), Chrome
   * ("Google UK English Male"), Safari/macOS ("Daniel", "Samantha").
   */
  prefer: string[];
  /** Acceptable languages, best first (BCP 47 prefixes). */
  langs: string[];
  /** 0.5..2 (1 = the voice's own). */
  pitch: number;
  /** 0.5..2 (1 = normal speed). */
  rate: number;
  /** 0..1 */
  volume: number;
  /** Extra pause after a sentence or an ellipsis, seconds. */
  pause: number;
}

/** Names of common system voices by sex, so a woman is never read by "Daniel" (fallback scoring). */
export const KNOWN_FEMALE = /(samantha|karen|moira|tessa|fiona|victoria|veena|serena|kate|susan|allison|ava|zoe|nicky|martha|catherine|female|woman|libby|sonia|maisie|hazel|zira|aria|jenny|ezinne|neerja|clara|natasha|emily|sara|amy|salli|joanna|kimberly|ivy|kendra|leah|olivia|heera|google uk english female|google us english)/i;
export const KNOWN_MALE = /(daniel|alex|fred|ralph|rishi|oliver|arthur|thomas|ryan|guy|davis|tony|george|male|man|abeo|prabhat|liam|william|brian|matthew|joey|justin|russell|google uk english male|aaron|albert|bruce|junior)/i;

const EN = ["en-NG", "en-GB", "en-ZA", "en-IE", "en-IN", "en-AU", "en-US", "en"];

const p = (name: string, gender: Gender, age: number, accent: string, prefer: string[], pitch: number, rate: number, extra: Partial<VoiceProfile> = {}): VoiceProfile => ({
  name, gender, age, accent, prefer, langs: EN, pitch, rate, volume: 0.92, pause: 0.12, ...extra,
});

/** One profile per speaking cast id in M1..M10 (and the extra lines the game adds). */
export const VOICE_PROFILES: Record<string, VoiceProfile> = {
  // The family and the first day.
  "npc.mum": p("Mum", "f", 48, "Northern Nigerian mother; quick, loving, every sentence an instruction", ["Ezinne", "Nigeria", "Moira", "Google UK English Female", "Sonia", "Karen", "Samantha"], 1.12, 1.06),
  "npc.dad": p("Dad", "m", 52, "Nigerian father; slow, proud, deep, enjoys his own stories", ["Abeo", "Nigeria", "Daniel", "Google UK English Male", "Ralph", "Thomas"], 0.78, 0.9),
  "npc.gate_guard": p("Gate guard", "m", 45, "Hausa-accented security man; bored, unhurried", ["Rishi", "Abeo", "Fred", "Google UK English Male", "Alex"], 0.7, 0.86),
  "npc.baba_porter": p("Baba Porter", "m", 60, "Older Nigerian porter; gruff, exact, short breath between phrases", ["Abeo", "Ralph", "Daniel", "Google UK English Male"], 0.66, 0.84, { pause: 0.22 }),
  "npc.roomie.m": p("Bature", "m", 19, "Young Hausa-English joker; quick, playful, rises on punchlines", ["Rishi", "Abeo", "Google US English", "Alex", "Aaron", "Fred"], 1.08, 1.1),
  "npc.roomie.f": p("Firdausi", "f", 19, "Brisk young northern woman; teasing, protective", ["Ezinne", "Tessa", "Google UK English Female", "Samantha", "Libby"], 1.16, 1.08),
  "npc.mama_nkechi": p("Mama Nkechi", "f", 50, "Igbo buka owner; warm, loud, threatens with love", ["Ezinne", "Moira", "Karen", "Google UK English Female"], 0.94, 1.0),
  "npc.suya_man": p("Suya man", "m", 40, "Hausa grill man; panicked shout", ["Rishi", "Abeo", "Fred", "Google UK English Male"], 1.0, 1.15, { volume: 1 }),
  "npc.malam_sule": p("Malam Sule", "m", 55, "Hausa farmhand; weary, dry, kind underneath", ["Abeo", "Daniel", "Ralph", "Google UK English Male"], 0.74, 0.86, { pause: 0.2 }),
  "crowd.freshers": p("Freshers", "m", 18, "A crowd shout", ["Google US English", "Alex", "Fred"], 1.1, 1.1, { volume: 1 }),
  "crowd.students": p("A senior", "m", 21, "A senior student with a phone; amused", ["Google US English", "Aaron", "Alex", "Guy"], 1.04, 1.08),
  // Registration.
  "npc.aleeya": p("Aleeya", "f", 19, "Architecture student; supportive, then the punchline; laughs first", ["Libby", "Sonia", "Tessa", "Google UK English Female", "Samantha"], 1.06, 1.02),
  "npc.mrs_adebayo": p("Mrs. Adebayo", "f", 55, "Yoruba registry clerk; bored, flat, final", ["Ezinne", "Karen", "Moira", "Google UK English Female"], 0.86, 0.88, { pause: 0.2 }),
  "npc.mr_clement": p("Mr. Clement", "m", 50, "Bursary officer; one word at a time", ["Thomas", "Daniel", "Google UK English Male", "Ralph"], 0.84, 0.82),
  "npc.muhammad": p("Muhammad", "m", 20, "Soft-spoken, unhurried, apologetic; nearly a whisper", ["Rishi", "Oliver", "Daniel", "Google UK English Male", "Alex"], 0.96, 0.86, { volume: 0.72, pause: 0.3 }),
  "npc.garba": p("Malam Garba", "m", 62, "Senate porter; 'Hm.' is a paragraph", ["Ralph", "Abeo", "Daniel", "Google UK English Male"], 0.62, 0.8, { pause: 0.35 }),
  // Belle First.
  "npc.idris": p("Idris", "m", 18, "Shy fresher; small voice", ["Alex", "Aaron", "Google US English"], 1.06, 0.9, { volume: 0.75 }),
  "prop.radio": p("The radio", "f", 60, "A woman's voice through static; calm, amused, counting", ["Moira", "Kate", "Serena", "Fiona", "Google UK English Female"], 0.9, 0.78, { volume: 0.7, pause: 0.45 }),
  // Matric Fit.
  "npc.needle": p("Alhaji Needle", "m", 60, "Hausa tailor; warm, unbothered, blessing everything", ["Abeo", "Daniel", "Ralph", "Google UK English Male"], 0.8, 0.88),
  "npc.mubarak": p("Mubarak", "m", 19, "Pidgin-English salesman; fast, bright, everything is premium", ["Abeo", "Google US English", "Guy", "Aaron", "Alex"], 1.04, 1.16),
  "npc.lyzzy": p("Lyzzy", "f", 19, "Mass Comm twin; delighted, quick, loud", ["Google US English", "Ava", "Aria", "Samantha", "Jenny"], 1.2, 1.14, { volume: 1 }),
  "npc.lily": p("Lily", "f", 19, "Botany twin; very soft, slow, sure", ["Fiona", "Serena", "Tessa", "Google UK English Female", "Sonia"], 1.1, 0.84, { volume: 0.7, pause: 0.3 }),
  "npc.maryam": p("Maryam", "f", 20, "English student at the bookshop; thoughtful, teasing", ["Sonia", "Kate", "Google UK English Female", "Victoria"], 1.04, 0.98),
  // First Lecture.
  "npc.law_lecturer": p("Law lecturer", "m", 58, "Dry senior lecturer; enjoys the room's laughter", ["Daniel", "Arthur", "Google UK English Male", "Thomas"], 0.82, 0.9),
  "npc.shamsu": p("Shamsu", "m", 19, "Earnest genius; precise diction, a whisper that explains too much", ["Rishi", "Prabhat", "Oliver", "Google UK English Male", "Daniel"], 1.0, 1.04),
  "npc.nusaiba": p("Nusaiba", "f", 19, "Law student; clear, complete sentences, courtroom polite", ["Sonia", "Neerja", "Google UK English Female", "Kate", "Serena"], 1.02, 0.98),
  "npc.okonkwo": p("Dr. Okonkwo", "f", 45, "Igbo engineering lecturer; brisk, dry, fair", ["Ezinne", "Karen", "Moira", "Google UK English Female"], 0.9, 0.98),
  "npc.wednesday": p("Wednesday", "f", 20, "Calm, uncanny, kind; never looks up", ["Fiona", "Tessa", "Google UK English Female", "Samantha"], 0.94, 0.82, { volume: 0.75, pause: 0.3 }),
  "npc.abbas": p("Abbas", "m", 20, "Patient mechanic-engineer; flat and exact, like a clock", ["Thomas", "Daniel", "Google UK English Male", "Fred"], 0.88, 0.9),
  // Mai Shayi Knows.
  "npc.mai_shayi": p("Mai Shayi Audu", "m", 70, "Old Hausa tea seller; slow, warm, story-teller's pauses", ["Abeo", "Ralph", "Daniel", "Google UK English Male"], 0.7, 0.8, { pause: 0.4 }),
  "npc.maker": p("The Maker", "m", 75, "Quiet, exact, dry; every word weighed", ["Daniel", "Arthur", "Ralph", "Google UK English Male"], 0.58, 0.78, { volume: 0.8, pause: 0.5 }),
  "npc.tanko": p("Tanko", "m", 45, "Riddler at the gate; deep, amused, gives nothing", ["Fred", "Abeo", "Ralph", "Google UK English Male"], 0.72, 0.88, { pause: 0.3 }),
  // Fresher Tax.
  "npc.bolaji": p("Big Sly (Bolaji)", "m", 25, "Huge, performative, third person; secretly gentle", ["Ralph", "Abeo", "Guy", "Google UK English Male", "Daniel"], 0.55, 0.92),
  "npc.hassan": p("Hassan", "m", 20, "Thin deputy with a notebook; bored clerk voice", ["Aaron", "Alex", "Google US English"], 1.12, 1.02),
  "npc.big_baby": p("Big Baby", "f", 26, "Tiny salon owner; quiet, final, terrifying", ["Ezinne", "Karen", "Google UK English Female", "Moira"], 0.88, 0.78, { pause: 0.4 }),
  // Left Boot First.
  "npc.jega": p("Jega", "m", 19, "Hausa-English footballer; warm, quick, code-switches", ["Abeo", "Rishi", "Google UK English Male", "Guy", "Alex"], 0.92, 1.06),
  "npc.danladi": p("Coach Danladi", "m", 50, "Football coach; shouts in proverbs", ["Abeo", "Ralph", "Fred", "Google UK English Male"], 0.76, 1.0, { volume: 1 }),
  // Doctor's Orders.
  "npc.hauwa": p("Nurse Hauwa", "f", 40, "Night nurse; unshockable, flat", ["Ezinne", "Karen", "Moira", "Google UK English Female"], 0.9, 0.9),
  "npc.zainab": p("Dr. Zainab", "f", 25, "Young house officer; warm, quick, clinical when it matters (placeholder until Zainab records)", ["Sonia", "Libby", "Google UK English Female", "Serena", "Samantha"], 1.08, 1.06),
  // The Plug.
  "npc.hajiya_ladi": p("Hajiya Ladi", "f", 58, "Head of the market traders; formidable, fair, measured", ["Ezinne", "Moira", "Karen", "Google UK English Female"], 0.8, 0.86, { pause: 0.25 }),
  "npc.kb": p("KB", "m", 45, "Corner-shop owner; sly, pricing by your face", ["Fred", "Abeo", "Google UK English Male"], 0.9, 1.0),
  "npc.sophomore": p("A customer", "m", 20, "A second-year with a complaint", ["Aaron", "Alex", "Google US English", "Guy"], 0.98, 1.0),
  "npc.sug_porter": p("SUG porter", "m", 58, "Older porter back from the mosque", ["Ralph", "Daniel", "Google UK English Male"], 0.72, 0.88),
  // Special characters (placeholders until the real people record their own voices).
  "special.jiya": p("Jiya", "f", 27, "Calm British delivery; never shouts; polite, long roasts", ["Sonia", "Kate", "Serena", "Google UK English Female", "Libby", "Fiona"], 1.0, 1.0, { langs: ["en-GB", "en"] }),
  "special.taty": p("Taty", "f", 24, "Brazilian, warm, cheeky, competitive; laughs while lapping you", ["Luciana", "Francisca", "Joana", "Samantha", "Google US English", "Ava", "Jenny"], 1.14, 1.1, { langs: ["en-US", "en", "pt-BR"] }),
  "special.madison": p("Madison", "f", 22, "Very fast; Mandarin and English mid-sentence; narrates her life", ["Google US English", "Aria", "Jenny", "Samantha", "Ava"], 1.24, 1.24, { langs: ["en-US", "en"] }),
  // The player (both voices; the free character-editor voices come later).
  "player.m": p("You", "m", 18, "The fresher; short lines", ["Google UK English Male", "Oliver", "Daniel", "Alex", "Guy"], 1.0, 1.0),
  "player.f": p("You", "f", 18, "The fresher; short lines", ["Google UK English Female", "Libby", "Samantha", "Tessa", "Aria"], 1.05, 1.0),
};

/** The profile key for a cast id, resolving the roommate and the player by the player's sex. */
export function profileKey(castId: string, playerFemale: boolean): string {
  if (castId === "npc.roomie") return playerFemale ? "npc.roomie.f" : "npc.roomie.m";
  if (castId === "player") return playerFemale ? "player.f" : "player.m";
  return castId;
}

/* ------------------------------------------------------------ choosing a synthetic voice */

export interface SynthVoice { name: string; lang: string; default?: boolean; localService?: boolean }

/**
 * Score every available voice for a profile and return the best, avoiding
 * voices already taken by other characters in the scene when another good
 * one exists (so Dad and the guard never share a voice).
 */
export function pickVoice<V extends SynthVoice>(prof: VoiceProfile, voices: readonly V[], taken: ReadonlySet<string> = new Set()): V | null {
  let best: V | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const lang = v.lang.replace("_", "-");
    const li = prof.langs.findIndex((l) => lang.toLowerCase().startsWith(l.toLowerCase()));
    if (li < 0) continue;
    let s = 100 - li * 6;
    const ni = prof.prefer.findIndex((n) => v.name.toLowerCase().includes(n.toLowerCase()));
    if (ni >= 0) s += 200 - ni * 12;
    const female = KNOWN_FEMALE.test(v.name), male = KNOWN_MALE.test(v.name) && !female;
    if (prof.gender === "f" && male) s -= 400;
    if (prof.gender === "m" && female) s -= 400;
    if (/natural|neural|online/i.test(v.name)) s += 25; // the better-sounding cloud voices
    if (/(bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|jester|organ|superstar|hysterical|deranged|albert|bahh|good news|wobble)/i.test(v.name)) s -= 1000; // novelty voices
    if (taken.has(v.name)) s -= 450;
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

/** Pitch, rate and volume for a line, from the profile and the line's mood (FORMAT.md §5 moods). */
export function deliver(prof: VoiceProfile, mood: string): { pitch: number; rate: number; volume: number } {
  let { pitch, rate, volume } = prof;
  switch (mood) {
    case "whisper": volume *= 0.55; rate *= 0.9; pitch *= 0.96; break;
    case "excited": rate *= 1.1; pitch *= 1.08; volume = Math.min(1, volume * 1.1); break;
    case "scared": rate *= 1.12; pitch *= 1.1; break;
    case "stern": rate *= 0.94; pitch *= 0.95; break;
    case "sharp": rate *= 1.04; pitch *= 1.02; volume = Math.min(1, volume * 1.08); break;
    case "sad": rate *= 0.88; pitch *= 0.94; break;
    case "dry": rate *= 0.95; pitch *= 0.97; break;
    case "bored": rate *= 0.9; pitch *= 0.95; break;
    case "shy": rate *= 0.94; volume *= 0.8; break;
    case "proud": rate *= 0.98; pitch *= 1.03; break;
    case "amused": pitch *= 1.04; break;
    case "warm": rate *= 0.97; break;
  }
  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
  return { pitch: clamp(pitch, 0.1, 2), rate: clamp(rate, 0.5, 1.8), volume: clamp(volume, 0, 1) };
}

/**
 * Spoken text from a subtitle: translations in brackets and parentheses are
 * not read aloud ("Mu je! (Let's go!)" is said "Mu je!"), stage directions
 * like "(Trust the Plug.)" are whispered as written, and ellipses become pauses.
 */
export function speakable(text: string): string[] {
  let t = text.trim();
  t = /^\(.*\)$/.test(t) ? t.slice(1, -1) : t.replace(/\s*\([^)]*\)/g, "");
  t = t.replace(/\[[^\]]*\]/g, "");
  return t.split(/…|\.\.\./).map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Seconds a subtitle should stay up for a line (reading speed with a floor). */
export function subtitleSeconds(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2.2, Math.min(7, 0.95 + words * 0.36));
}

/* ------------------------------------------------------------ the voice player (browser) */

export interface VoiceRequest { id: string; castId: string; text: string; mood: string }

/**
 * Plays lines: a recorded file when one exists, else speech synthesis with the
 * character's profile. One line at a time; a new line stops the previous one.
 */
export class VoicePlayer {
  enabled = true;
  /** Voice volume from the settings (0..1). */
  volume = 1;
  private audio: HTMLAudioElement | null = null;
  private assigned = new Map<string, string>();
  private voices: SpeechSynthesisVoice[] = [];
  playerFemale = false;

  constructor(private recorded: Record<string, string>, private base = "voice/") {
    try {
      if (typeof speechSynthesis !== "undefined") {
        this.voices = speechSynthesis.getVoices();
        speechSynthesis.addEventListener?.("voiceschanged", () => {
          this.voices = speechSynthesis.getVoices();
          this.assigned.clear();
        });
      }
    } catch {
      /* no speech */
    }
  }

  /** The synthetic voice a character uses (stable for the session, distinct from others where possible). */
  voiceFor(castId: string): SpeechSynthesisVoice | null {
    // Firefox may never fire voiceschanged: ask again when the list is still empty.
    if (!this.voices.length && typeof speechSynthesis !== "undefined") this.voices = speechSynthesis.getVoices();
    const key = profileKey(castId, this.playerFemale);
    const prof = VOICE_PROFILES[key];
    if (!prof || !this.voices.length) return null;
    const name = this.assigned.get(key);
    if (name) return this.voices.find((v) => v.name === name) ?? null;
    const v = pickVoice(prof, this.voices, new Set(this.assigned.values()));
    if (v) this.assigned.set(key, v.name);
    return v;
  }

  /**
   * iOS Safari only speaks after a speak() inside a user gesture: call this from
   * the Play button's click (a silent utterance unlocks speech for the session).
   */
  unlock(): void {
    try {
      if (typeof speechSynthesis === "undefined") return;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch {
      /* no speech */
    }
  }

  hasRecording(id: string): boolean {
    return id in this.recorded;
  }

  say(r: VoiceRequest): void {
    this.stop();
    if (!this.enabled) return;
    try {
      const file = this.recorded[r.id];
      if (file) {
        this.audio = new Audio(this.base + file);
        this.audio.volume = Math.max(0, Math.min(1, this.volume));
        void this.audio.play().catch(() => undefined);
        return;
      }
      if (typeof speechSynthesis === "undefined") return;
      const prof = VOICE_PROFILES[profileKey(r.castId, this.playerFemale)];
      if (!prof) return;
      const voice = this.voiceFor(r.castId);
      const d = deliver(prof, r.mood);
      const parts = speakable(r.text);
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        }
        u.pitch = d.pitch;
        u.rate = d.rate;
        u.volume = d.volume * this.volume;
        speechSynthesis.speak(u);
        // A short silent utterance acts as the profile's pause between sentences.
        if (i < parts.length - 1 && prof.pause > 0.15) {
          const gap = new SpeechSynthesisUtterance(" ");
          gap.volume = 0;
          gap.rate = 0.5;
          speechSynthesis.speak(gap);
        }
      });
    } catch {
      /* subtitles only */
    }
  }

  stop(): void {
    try {
      this.audio?.pause();
      this.audio = null;
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}
