/**
 * The story parser: reads the mission scripts (docs/plan/missions/Y1.md and
 * friends, format in docs/plan/missions/FORMAT.md) into plain data the game
 * plays directly. It is a TypeScript port of the parsing half of
 * tools/story/check_missions.py, extended to read every field the game needs:
 *
 *   - the header (When, Where, Who, Special helpers, Connects to, Mystery);
 *   - the numbered Steps (objective text, place id, completeWhen, fail);
 *   - the [IF special.x] / [ELSE] blocks and their draft lines;
 *   - every ```cutscene block: id, type, skippable, maxDuration, playOnce,
 *     cast (optional roles end in "?"), the timeline (each entry's time, key
 *     and arguments, plus its `if:` condition and then/else branch), and the
 *     endState, all parsed from the YAML-like flow syntax;
 *   - the Reward / System taught / Calendar fit line.
 *
 * Pure functions, no engine, no Node APIs: the Vite plugin (tools/story-plugin.ts)
 * runs it at build time, and the tests run it against the real files, so the
 * game's missions always come straight from Y1.md.
 */

export type FlowValue = string | number | boolean | FlowMap;
export interface FlowMap { [k: string]: FlowValue }

export interface StoryStep {
  n: number;
  /** HUD objective text (tokens like {{ROOMIE}} still in it). */
  objective: string;
  /** Place ids mentioned for the step (loc.x.y), in order. */
  places: string[];
  completeWhen: string;
  fail: string;
  /** "(bargain)" / "(refuse)" style branch label, or "" for every path. */
  branch: string;
  optional: boolean;
}

export interface TimelineEntry {
  at: number;
  key: string;
  args: FlowMap;
  /** `if:` condition (e.g. "special.jiya"), or null. */
  cond: string | null;
  /** Which side of the `if:` this entry is on. */
  branch: "then" | "else" | null;
  line: number;
}

export interface StoryCutscene {
  id: string;
  type: string;
  skippable: boolean;
  maxDuration: number;
  playOnce: boolean;
  /** Role -> cast id; optional roles are listed without the "?" here and in `optional`. */
  cast: Record<string, string>;
  optional: string[];
  timeline: TimelineEntry[];
  endState: FlowMap;
  endStateRaw: string;
  line: number;
}

export interface DraftLine { id: string; text: string; note: string }

export interface SpecialBlock {
  /** "special.jiya" etc.; "else" for the fallback paragraph that follows. */
  who: string;
  text: string;
  lines: DraftLine[];
}

export interface StoryMission {
  num: number;
  /** "m001" */
  key: string;
  title: string;
  file: string;
  line: number;
  when: string;
  where: string;
  who: string;
  helpers: string;
  connects: string;
  mystery: string;
  story: string;
  steps: StoryStep[];
  specials: SpecialBlock[];
  cutscenes: StoryCutscene[];
  reward: string;
  system: string;
  calendar: string;
}

/* ------------------------------------------------------------ flow maps */

/**
 * Parse the YAML flow mapping the cutscene blocks use:
 *   { who: DAD, id: m001_film_01, text: "This is not the main gate.", mood: stern }
 *   { PLAYER: { at: queue_end, items: { naira: "+1000" } }, flags: { a: true } }
 * Values: "quoted strings" (with \" escapes), nested maps, numbers, true/false,
 * and bare words (ids, anchors, roles). Throws on malformed input.
 */
export function parseFlow(src: string): FlowMap {
  let i = 0;
  const s = src.trim();
  const ws = () => {
    while (i < s.length && /\s/.test(s[i]!)) i++;
  };
  const fail = (msg: string): never => {
    throw new Error(`flow map: ${msg} at ${i} in ${src}`);
  };
  const map = (): FlowMap => {
    ws();
    if (s[i] !== "{") fail("expected {");
    i++;
    const out: FlowMap = {};
    ws();
    if (s[i] === "}") {
      i++;
      return out;
    }
    for (;;) {
      ws();
      const k0 = i;
      while (i < s.length && s[i] !== ":" && s[i] !== "}" && s[i] !== ",") i++;
      const key = s.slice(k0, i).trim();
      if (!key) fail("empty key");
      if (s[i] !== ":") fail(`expected : after ${key}`);
      i++;
      ws();
      out[key] = value();
      ws();
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === "}") {
        i++;
        return out;
      }
      fail("expected , or }");
    }
  };
  const value = (): FlowValue => {
    ws();
    if (s[i] === "{") return map();
    if (s[i] === '"') {
      i++;
      let out = "";
      while (i < s.length && s[i] !== '"') {
        if (s[i] === "\\" && i + 1 < s.length) {
          out += s[i + 1];
          i += 2;
        } else out += s[i++];
      }
      if (s[i] !== '"') fail("unterminated string");
      i++;
      return out;
    }
    const v0 = i;
    while (i < s.length && s[i] !== "," && s[i] !== "}") i++;
    const raw = s.slice(v0, i).trim();
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    return raw;
  };
  const out = map();
  ws();
  if (i < s.length) fail("trailing text");
  return out;
}

/* ------------------------------------------------------------ cutscenes */

export function parseCutscene(block: string, startLine: number): StoryCutscene {
  const field = (name: string) => (new RegExp(`^${name}: *(.*)$`, "m").exec(block)?.[1] ?? "").trim();
  const id = field("id");
  const castRaw = field("cast");
  const cast: Record<string, string> = {};
  const optional: string[] = [];
  if (castRaw) {
    for (const m of castRaw.matchAll(/([A-Z_0-9]+)(\??): *([\w.]+)/g)) {
      cast[m[1]!] = m[3]!;
      if (m[2] === "?") optional.push(m[1]!);
    }
  }
  const timeline: TimelineEntry[] = [];
  // Stack of open `if:` blocks: indent of the "- if:" line, its condition, and the current side.
  const stack: { indent: number; cond: string; side: "then" | "else" | null }[] = [];
  const lines = block.split("\n");
  lines.forEach((raw, k) => {
    if (!raw.trim()) return;
    const indent = raw.length - raw.trimStart().length;
    const t = raw.trim();
    // Leaving an if-block: a line at or left of the "- if:" indent that is not its then/else.
    while (stack.length && indent <= stack[stack.length - 1]!.indent && !/^(then|else):/.test(t)) stack.pop();
    const mi = /^- if: *(\S+)/.exec(t);
    if (mi) {
      stack.push({ indent, cond: mi[1]!, side: null });
      return;
    }
    const mb = /^(then|else):/.exec(t);
    if (mb && stack.length) {
      stack[stack.length - 1]!.side = mb[1] as "then" | "else";
      return;
    }
    const ma = /^- at: *([\d.]+) +([a-z_.]+): *(.*)$/.exec(t);
    if (ma) {
      const top = stack[stack.length - 1];
      timeline.push({
        at: Number(ma[1]),
        key: ma[2]!,
        args: ma[3]!.trim().startsWith("{") ? parseFlow(ma[3]!) : {},
        cond: top ? top.cond : null,
        branch: top ? top.side ?? "then" : null,
        line: startLine + k,
      });
    }
  });
  const endRaw = field("endState");
  return {
    id,
    type: field("type") || "full",
    skippable: field("skippable") !== "false",
    maxDuration: Number(field("maxDuration")) || 40,
    playOnce: field("playOnce") !== "false",
    cast,
    optional,
    timeline,
    endState: endRaw.startsWith("{") ? parseFlow(endRaw) : {},
    endStateRaw: endRaw,
    line: startLine,
  };
}

/* ------------------------------------------------------------ missions */

const LABELS = ["**When:**", "**Where:**", "**Who:**", "**Special helpers (if enabled):**", "**Connects to:**", "**Mystery:**", "**Story.**", "**Steps.**", "**Special characters.**", "**Cutscenes.**", "**Reward:**", "**System taught:**", "**Calendar fit:**"];

/** The text after `label` up to the next known label (or the end). */
function section(body: string, label: string): string {
  const idx = body.indexOf(label);
  if (idx < 0) return "";
  let end = body.length;
  for (const l of LABELS) {
    if (l === label) continue;
    const j = body.indexOf(l, idx + label.length);
    if (j > 0 && j < end) end = j;
  }
  return body.slice(idx + label.length, end).trim().replace(/\.\s*$/, ".");
}

/** Strip trailing separators the header lines carry ("… . **Where:**"). */
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();

export function parseSteps(text: string): StoryStep[] {
  const out: StoryStep[] = [];
  for (const line of text.split("\n")) {
    const m = /^(\d+)\. +(.*)$/.exec(line.trim());
    if (!m) continue;
    const rest = m[2]!;
    const branch = /^\*\(([^)]+)\)\*/.exec(rest)?.[1] ?? "";
    const optional = /\*\(optional\)\*/.test(rest);
    const objective = /`([^`]+)`/.exec(rest)?.[1] ?? "";
    const parts = rest.split(" · ");
    const places = [...(parts[1] ?? "").matchAll(/`(loc\.[\w.]+|prop\.[\w.]+)`/g)].map((x) => x[1]!);
    const cw = rest.indexOf("completeWhen:");
    const fl = rest.indexOf("· fail:");
    const completeWhen = cw >= 0 ? rest.slice(cw + "completeWhen:".length, fl > cw ? fl : undefined).trim() : "";
    const fail = fl >= 0 ? rest.slice(fl + "· fail:".length).trim() : "";
    out.push({ n: Number(m[1]), objective, places, completeWhen, fail, branch: branch === "optional" ? "" : branch, optional });
  }
  return out;
}

/** Draft lines in a special-character paragraph: `m001_play_t01` "Bora! …" (optionally with a "(to Jega)" note). */
export function draftLines(text: string): DraftLine[] {
  const out: DraftLine[] = [];
  for (const m of text.matchAll(/`(m\d{3}_[a-z0-9]+_[a-z]?\d{2})`(?: *\(([^)]*)\))? *"((?:[^"\\]|\\.)*)"/g)) out.push({ id: m[1]!, note: m[2] ?? "", text: m[3]!.replace(/\\"/g, '"') });
  return out;
}

export function parseSpecials(text: string): SpecialBlock[] {
  const out: SpecialBlock[] = [];
  const re = /\*\*\[(IF (special\.[a-z]+)|ELSE)\]\*\*/g;
  const hits = [...text.matchAll(re)];
  hits.forEach((h, k) => {
    const start = h.index! + h[0].length;
    const end = k + 1 < hits.length ? hits[k + 1]!.index! : text.length;
    const body = text.slice(start, end).replace(/^\s*[-*]?\s*/, "").trim();
    out.push({ who: h[2] ?? "else", text: body.replace(/\n- *$/, "").trim(), lines: draftLines(body) });
  });
  return out;
}

/** Parse one mission file (the text of Y1.md etc.). */
export function parseMissionFile(text: string, file = "Y1.md"): StoryMission[] {
  const heads = [...text.matchAll(/^#### M(\d{3}) · (.+)$/gm)];
  return heads.map((h, k) => {
    const start = h.index!;
    const end = k + 1 < heads.length ? heads[k + 1]!.index! : text.length;
    const body = text.slice(start, end);
    const line = text.slice(0, start).split("\n").length;
    const cutscenes: StoryCutscene[] = [];
    for (const cb of body.matchAll(/```cutscene\n([\s\S]*?)```/g)) {
      cutscenes.push(parseCutscene(cb[1]!, line + body.slice(0, cb.index!).split("\n").length));
    }
    const num = Number(h[1]);
    return {
      num,
      key: `m${h[1]}`,
      title: h[2]!.trim(),
      file,
      line,
      when: clean(section(body, "**When:**")),
      where: clean(section(body, "**Where:**")),
      who: clean(section(body, "**Who:**")),
      helpers: clean(section(body, "**Special helpers (if enabled):**")),
      connects: clean(section(body, "**Connects to:**")),
      mystery: clean(section(body, "**Mystery:**")),
      story: section(body, "**Story.**").trim(),
      steps: parseSteps(section(body, "**Steps.**")),
      specials: parseSpecials(section(body, "**Special characters.**")),
      cutscenes,
      reward: clean(section(body, "**Reward:**")),
      system: clean(section(body, "**System taught:**")),
      calendar: clean(section(body, "**Calendar fit:**").replace(/\n---[\s\S]*$/, "")),
    };
  });
}

/** Every spoken line in a mission: cutscene `say` entries plus the draft play lines, with the speaking cast id. */
export interface SpokenLine { id: string; text: string; role: string; castId: string; mood: string; cutscene: string | null; cond: string | null }

export function spokenLines(m: StoryMission): SpokenLine[] {
  const out: SpokenLine[] = [];
  for (const c of m.cutscenes)
    for (const e of c.timeline) {
      if (e.key !== "say") continue;
      const role = String(e.args.who ?? "");
      out.push({ id: String(e.args.id ?? ""), text: String(e.args.text ?? ""), role, castId: role === "PLAYER" ? "player" : c.cast[role] ?? role.toLowerCase(), mood: String(e.args.mood ?? "neutral"), cutscene: c.id, cond: e.cond });
    }
  const prefix: Record<string, string> = { j: "special.jiya", t: "special.taty", d: "special.madison", b: "special.mib" };
  for (const s of m.specials)
    for (const l of s.lines) {
      const who = /_[a-z]+_([a-z])\d{2}$/.exec(l.id)?.[1];
      const castId = (who && prefix[who]) || (s.who !== "else" ? s.who : "crowd");
      out.push({ id: l.id, text: l.text, role: castId.split(".")[1]!.toUpperCase(), castId, mood: "neutral", cutscene: null, cond: s.who !== "else" ? s.who : null });
    }
  return out;
}

/* ------------------------------------------------------------ barks */

export interface Bark { id: string; mood: string; text: string; when: string; stage: string; category: string }
export interface BarkPack { title: string; id: string; voice: string; barks: Bark[] }

/** Parse one barks file (docs/voice/barks/*.md, format in docs/voice/BARKS_FORMAT.md). */
export function parseBarks(text: string): BarkPack {
  const title = (/^# Barks: (.+)$/m.exec(text)?.[1] ?? "").trim();
  const id = (/^\*\*Id:\*\* *(\S+)/m.exec(text)?.[1] ?? "").trim();
  const voice = (/^\*\*Voice:\*\* *(.+)$/m.exec(text)?.[1] ?? "").trim();
  const barks: Bark[] = [];
  let stage = "", category = "";
  for (const line of text.split("\n")) {
    const st = /^## (.+)$/.exec(line);
    if (st) {
      stage = st[1]!.trim();
      continue;
    }
    const ca = /^### (.+)$/.exec(line);
    if (ca) {
      category = ca[1]!.trim();
      continue;
    }
    const b = /^- `([a-z0-9_]+)` \(([a-z]+)\) "((?:[^"\\]|\\.)*)"(?: · when: (.+))?$/.exec(line.trim());
    if (b) barks.push({ id: b[1]!, mood: b[2]!, text: b[3]!, when: (b[4] ?? "").trim(), stage, category });
  }
  return { title, id, voice, barks };
}

/* ------------------------------------------------------------ tokens */

export interface TokenCtx { playerName: string; roomie: string; uniName: string; uniShort: string; town: string; gameName: string; partner?: string }

export function fillTokens(s: string, t: TokenCtx): string {
  return s
    .replace(/\{\{PLAYER_NAME\}\}/g, t.playerName)
    .replace(/\{\{ROOMIE\}\}/g, t.roomie)
    .replace(/\{\{UNI_NAME\}\}/g, t.uniName)
    .replace(/\{\{UNI_SHORT\}\}/g, t.uniShort)
    .replace(/\{\{TOWN\}\}/g, t.town)
    .replace(/\{\{GAME_NAME\}\}/g, t.gameName)
    .replace(/\{\{PARTNER\}\}/g, t.partner ?? t.roomie);
}
