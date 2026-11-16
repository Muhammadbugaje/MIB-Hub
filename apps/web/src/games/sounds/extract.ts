/**
 * Sound inventory: finds every sound a game makes by reading its scripts.
 *
 * The old EE Hub games make sound in three ways, all through the shared
 * runtime (public/play/_shared/js/games/):
 *
 *   - arcade.js `Sound.sfx(name)`: a named effect SYNTHESISED with Web Audio
 *     oscillators and noise (kick, coin, goal, ...);
 *   - arcade-audio.js wraps it: when audio/sfx/manifest.json has a recorded
 *     sample for the name (the game's own pack first, then the shared "core"
 *     set) the sample plays instead, else the synth;
 *   - named specials: `roar()` (crowd_cheer / crowd_groan), `fanfare(kind)`
 *     (fanfare_win, ...), `voice(v, kind)` (grunt_<kind>), the composed music
 *     (`music`), and looping samples played by name (`Audio.loop("eng_car")`).
 *
 * Every one of these goes through Arcade.Audio.route(name), which is where an
 * override ("global" layer, uploaded in the admin) replaces it. So the sound
 * id here is exactly the name the runtime routes.
 *
 * This file is pure (no file system), so it runs in tests and in the
 * generator script (scripts/gen-sound-inventory.ts) alike.
 */

export type SoundGroup = "menus" | "gameplay" | "rewards" | "ambience" | "music";
export const SOUND_GROUPS: { id: SoundGroup; label: string }[] = [
  { id: "menus", label: "Menus and buttons" },
  { id: "gameplay", label: "Gameplay" },
  { id: "rewards", label: "Rewards and results" },
  { id: "ambience", label: "Ambience and crowds" },
  { id: "music", label: "Music and stings" },
];

/**
 * How the game makes the sound today:
 *   synth   the Web Audio synth in arcade.js (no file)
 *   sample  a recorded file from audio/sfx (the synth covers it until it loads)
 *   file    a recorded file with no synth fallback (loops, intro music)
 *   composed  music written live by arcade.js's composer
 */
export type SoundSource = "synth" | "sample" | "file" | "composed";

export interface SoundCall {
  id: string;
  file: string;
  line: number;
  /** The enclosing function, when one is named (e.g. "scoreGoal"). */
  fn: string;
}

export interface SoundEntry {
  id: string;
  name: string;
  group: SoundGroup;
  /** Plain-English list of where the game uses it ("Goal scored", ...). */
  usage: string[];
  source: SoundSource;
  /** For samples: the recorded file stems (audio/sfx/<stem>.ogg|m4a). */
  files: string[];
  /** Where in the code (for developers). */
  calls: { file: string; line: number; fn: string }[];
  /**
   * How the admin can play the original in the browser: "synth" (arcade.js's
   * synth), "file" (the recorded file), "song" (compose `song`), or "none"
   * (made by the game's own code while playing; hear it in the game).
   */
  preview: "synth" | "file" | "song" | "none";
  /** For music: Arcade.song(seed, style, { bpm }) of the game's main theme. */
  song?: [number, string, { bpm?: number }];
}

export interface GameSoundInventory {
  slug: string;
  title: string;
  /** "legacy" (scanned from the EE Hub scripts) or "registered" (a game that lists its own). */
  kind: "legacy" | "registered";
  sounds: SoundEntry[];
}

/** audio/sfx/manifest.json: { core: {name: {f: [stems], bus, ...}}, packs: {slug: {...}} }. */
export interface SfxManifest {
  core?: Record<string, { f?: string[]; bus?: string; lazy?: boolean }>;
  packs?: Record<string, Record<string, { f?: string[]; bus?: string; lazy?: boolean }>>;
}

/** The names arcade.js can synthesise (Sound.sfx's table). */
export const SYNTH_NAMES = [
  "kick", "bounce", "jump", "dash", "hit", "heavy", "block", "special", "zap", "laser",
  "boom", "coin", "stomp", "power", "goal", "win", "lose", "whistle", "click", "ko",
] as const;

/** Sound ids: what arcade-audio.js routes (lower case, digits, _ . : -). */
export const SOUND_ID_RE = /^[a-z0-9_][a-z0-9_.:-]{0,79}$/;

const FANFARE: Record<string, string> = {
  champion: "fanfare_champion",
  gameComplete: "fanfare_champion",
  win: "fanfare_win",
  stageClear: "fanfare_win",
  newRecord: "fanfare_win",
  draw: "fanfare_draw",
  lose: "fanfare_lose",
  eliminated: "fanfare_lose",
};
/** arcade-audio.js X.fanfareName(kind). */
export function fanfareName(kind: string): string {
  return FANFARE[kind] ?? "fanfare_lose";
}

/** Text from `open` (an index just after "(") to its matching ")". */
function argsAt(text: string, open: number, limit = 600): string {
  let depth = 1;
  let quote = "";
  for (let i = open; i < text.length && i < open + limit; i++) {
    const c = text[i]!;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return text.slice(open, i);
    }
  }
  return "";
}

/** Split an argument list at top-level commas. */
function splitArgs(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < args.length; i++) {
    const c = args[i]!;
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      out.push(args.slice(start, i));
      start = i + 1;
    }
  }
  out.push(args.slice(start));
  return out.map((s) => s.trim());
}

/**
 * The string literals an expression can evaluate to ("a" or 'b'), in order.
 * Literals that are only compared (`act === "touch" ? "zap" : "dash"`) are
 * skipped, so that gives zap and dash.
 */
export function literals(expr: string): string[] {
  const out: string[] = [];
  for (const m of expr.matchAll(/"([^"\\]*)"|'([^'\\]*)'/g)) {
    const before = expr.slice(0, m.index).trimEnd();
    const after = expr.slice(m.index! + m[0].length).trimStart();
    if (/[!=]==?$/.test(before) || /^[!=]==?/.test(after)) continue;
    out.push(m[1] ?? m[2] ?? "");
  }
  return out;
}

function lineOf(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** The nearest named function before `index` (within ~1500 characters). */
function enclosingFn(text: string, index: number): string {
  const from = Math.max(0, index - 1500);
  const chunk = text.slice(from, index);
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(|([A-Za-z_$][\w$]*)\s*[:=]\s*function\s*\(/g;
  let last = "";
  for (const m of chunk.matchAll(re)) last = m[1] ?? m[2] ?? last;
  return last;
}

/**
 * Find the sound calls in one script. Recognises:
 *   *.sfx("a" | cond ? "a" : "b", ...)            -> a, b
 *   *.Audio.play("a") / X.play("a") / *.loop("a")   -> a  (sample players)
 *   *.roar(true|false|x)                            -> crowd_groan / crowd_cheer
 *   *.fanfare("kind") / api.ceremony("kind", ...)   -> fanfare_<...>
 *   *.voice(v, "kind")                              -> grunt_<kind>
 * Calls with a computed name (`sfx(name)`) are skipped: the manifest pack and
 * the runtime registry cover those.
 */
export function extractSoundCalls(file: string, text: string): SoundCall[] {
  const out: SoundCall[] = [];
  const add = (id: string, at: number) => {
    if (!SOUND_ID_RE.test(id)) return;
    out.push({ id, file, line: lineOf(text, at), fn: enclosingFn(text, at) });
  };
  const re = /\.(sfx|play|loop|roar|fanfare|ceremony|voice)\s*\(/g;
  for (const m of text.matchAll(re)) {
    const kind = m[1]!;
    const at = m.index!;
    const before = text.slice(Math.max(0, at - 24), at);
    const args = splitArgs(argsAt(text, at + m[0].length));
    const first = args[0] ?? "";
    if (kind === "sfx") {
      // sfx.synth(...) is the raw synth; it still routes by name.
      for (const s of literals(first)) add(s, at);
    } else if (kind === "play" || kind === "loop") {
      // Only the sample players (Arcade.Audio / X / A.Audio), not Sound.play(song) or audio elements.
      if (!/(Audio|\bX|\bx)$/.test(before)) continue;
      for (const s of literals(first)) add(s, at);
    } else if (kind === "roar") {
      if (/^(true|!0|1)$/.test(first)) add("crowd_groan", at);
      else if (/^(false|!1|0|)$/.test(first)) add("crowd_cheer", at);
      else {
        add("crowd_cheer", at);
        add("crowd_groan", at);
      }
    } else if (kind === "fanfare" || kind === "ceremony") {
      if (kind === "ceremony" && !/api$|API$/.test(before)) continue;
      const lits = literals(first);
      if (lits.length === 0) {
        add("fanfare_win", at);
        add("fanfare_lose", at);
      }
      for (const s of lits) add(fanfareName(s), at);
    } else if (kind === "voice") {
      const lits = literals(args[1] ?? "");
      for (const s of lits) add("grunt_" + s, at);
      if (args.length > 1 && lits.length === 0) add("grunt_effort", at);
    }
  }
  return out;
}

/** The game's main theme: the first `song: A.song(seed, "style", { bpm })` (else any A.song call). */
export function findSong(texts: string[]): [number, string, { bpm?: number }] | undefined {
  const re = /(?:\bA|Arcade)\.song\(\s*(\d+)\s*,\s*"([a-z]+)"\s*(?:,\s*\{\s*bpm:\s*(\d+))?/;
  for (const pref of [true, false]) {
    for (const t of texts) {
      const m = pref ? t.match(new RegExp("song:\\s*" + re.source)) : t.match(re);
      if (m) return [Number(m[1]), m[2]!, m[3] ? { bpm: Number(m[3]) } : {}];
    }
  }
  return undefined;
}

/** Does this script set a background song (arcade.js composes it live)? */
export function usesMusic(text: string): boolean {
  return /\bsong\s*:/.test(text) || /\.play\(\s*(api\._song|game\.song|song|sg)\b/.test(text) || /\bsong\(/.test(text);
}

/** One `DESC` entry from arcade-sounds.js: "group|what it is". */
export interface GenericInfo {
  name?: string;
  group?: SoundGroup;
  desc?: string;
}

const REWARD_IDS = new Set(["coin", "power", "goal", "win", "lose", "applause", "fanfare_win", "fanfare_champion", "fanfare_draw", "fanfare_lose", "pop", "confirm"]);
const MENU_IDS = new Set(["click", "back", "confirm", "error", "toggle", "hover", "pluck", "phone_open", "phone_close", "dial"]);

/** Which admin group a sound id belongs in. `legacyGroup` is arcade-sounds.js's group, when known. */
export function groupOf(id: string, legacyGroup?: string): SoundGroup {
  if (id === "music" || id.startsWith("intro_")) return "music";
  if (REWARD_IDS.has(id)) return "rewards";
  if (MENU_IDS.has(id)) return "menus";
  if (legacyGroup === "ambience" || /^(_amb|amb_|crowd_|cheer$|aww$|wind$)/.test(id)) return "ambience";
  if (legacyGroup === "music" || id.startsWith("fanfare_")) return "music";
  if (legacyGroup === "ui") return "menus";
  return "gameplay";
}

/** "crash_car_light" -> "Crash car light". */
export function humanName(id: string): string {
  const s = id.replace(/^_/, "").replace(/[_:.-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface BuildInput {
  slug: string;
  title: string;
  /** The game's own scripts (entry, dependencies, level packs). */
  scripts: { file: string; text: string }[];
  /** Calls every legacy game gets from the shared runtime (arcade.js). */
  shared: SoundCall[];
  manifest: SfxManifest;
  /** Generic name/group/description per id (arcade-sounds.js DESC plus our own). */
  generic: Record<string, GenericInfo>;
  /** Hand-written usage per id for this game ("Goal scored"), from catalog.ts. */
  usage?: Record<string, string[]>;
  /** Shared usage per id, for the shared runtime's calls ("Menu button press"). */
  sharedUsage?: Record<string, string>;
  /** Extra ids the game makes in other ways (intro music, ...). */
  extra?: Record<string, { source: SoundSource; files?: string[]; usage: string[]; name?: string; group?: SoundGroup }>;
}

/** Build one game's inventory: every sound id with its name, group, usage and how it is made. */
export function buildInventory(input: BuildInput): GameSoundInventory {
  const calls = new Map<string, SoundCall[]>();
  const push = (c: SoundCall) => {
    const list = calls.get(c.id) ?? [];
    list.push(c);
    calls.set(c.id, list);
  };
  for (const s of input.scripts) for (const c of extractSoundCalls(s.file, s.text)) push(c);
  for (const c of input.shared) push(c);
  const pack = input.manifest.packs?.[input.slug] ?? {};
  // Every recorded sound in the game's own pack is played by name somewhere (often a computed name).
  for (const id of Object.keys(pack)) if (!calls.has(id)) calls.set(id, []);
  if (input.scripts.some((s) => usesMusic(s.text))) if (!calls.has("music")) calls.set("music", []);
  for (const id of Object.keys(input.extra ?? {})) if (!calls.has(id)) calls.set(id, []);

  const sounds: SoundEntry[] = [];
  const theme = findSong(input.scripts.map((s) => s.text));
  for (const [id, list] of calls) {
    const extra = input.extra?.[id];
    const sample = pack[id] ?? input.manifest.core?.[id];
    const synth = (SYNTH_NAMES as readonly string[]).includes(id) || id.startsWith("fanfare_") || id.startsWith("crowd_") || id.startsWith("grunt_");
    const source: SoundSource = extra?.source ?? (id === "music" ? "composed" : sample?.f?.length ? (synth ? "sample" : "file") : "synth");
    const g = input.generic[id] ?? {};
    const usage = [...(input.usage?.[id] ?? extra?.usage ?? [])];
    const ownCalls = list.filter((c) => !c.file.startsWith("arcade"));
    // A generic description, said for this game ("Freshers School Life → car horn").
    const said = g.desc ? `${input.title} → ${g.desc.charAt(0).toLowerCase()}${g.desc.slice(1)}` : "";
    if (usage.length === 0 && (ownCalls.length > 0 || pack[id]) && said) usage.push(said);
    if (list.some((c) => c.file.startsWith("arcade")) && input.sharedUsage?.[id]) usage.push(input.sharedUsage[id]!);
    if (usage.length === 0) usage.push(g.desc ?? humanName(id));
    sounds.push({
      id,
      name: extra?.name ?? g.name ?? humanName(id),
      group: extra?.group ?? g.group ?? groupOf(id),
      usage: [...new Set(usage)],
      source,
      files: extra?.files ?? sample?.f ?? [],
      calls: list.map((c) => ({ file: c.file, line: c.line, fn: c.fn })),
      preview:
        source === "composed" ? (theme ? "song" : "none") : source === "synth" ? (synth ? "synth" : "none") : "file",
      ...(id === "music" && theme ? { song: theme } : {}),
    });
  }
  const order = SOUND_GROUPS.map((x) => x.id);
  sounds.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name));
  return { slug: input.slug, title: input.title, kind: "legacy", sounds };
}

/**
 * Read arcade-sounds.js's DESC table ("name: 'group|what it is'") without
 * running the script. Returns generic info per id.
 */
export function parseLegacyDesc(text: string): Record<string, GenericInfo> {
  const start = text.indexOf("var DESC = {");
  if (start < 0) return {};
  const body = argsAt(text, start + "var DESC = {".length, 20000);
  const out: Record<string, GenericInfo> = {};
  for (const m of body.matchAll(/([a-z_][a-z0-9_]*)\s*:\s*"([a-z]+)\|([^"]*)"/g)) {
    out[m[1]!] = { group: groupOf(m[1]!, m[2]), desc: m[3]! };
  }
  return out;
}
