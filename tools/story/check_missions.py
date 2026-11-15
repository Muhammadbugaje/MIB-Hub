"""Mechanical checks for the mission scripts (docs/plan/missions/Y1.md to Y5.md).

Run from the repo root with any Python 3.10+ (standard library only):
    python3 tools/story/check_missions.py            # human-readable report
    python3 tools/story/check_missions.py --json     # machine-readable
    python3 tools/story/check_missions.py --errors   # errors only

Exit code 1 when any ERROR is found, 0 otherwise. WARNINGs never fail the run.
The allowed moods, anims, light presets and clue ids are read from FORMAT.md,
so updating FORMAT.md updates the checker.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / "docs" / "plan"
MISSIONS = PLAN / "missions"
YEAR_FILES = [MISSIONS / f"Y{n}.md" for n in range(1, 6)]
FORMAT = MISSIONS / "FORMAT.md"
BIBLE = PLAN / "STORY_BIBLE_V2.md"
QUOTES = ROOT / "docs" / "legacy" / "story" / "QUOTES.md"

REQUIRED = ["**When:**", "**Where:**", "**Who:**", "**Connects to:**", "**Mystery:**", "**Story.**",
            "**Steps.**", "**Special characters.**", "**Cutscenes.**", "**Reward:**"]
SPECIAL_PREFIX = {"special.jiya": "j", "special.taty": "t", "special.madison": "d", "special.mib": "b"}
DAYS = {d: i for i, d in enumerate(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])}
BANNED = [  # (pattern, why)
    (r"\bKaltume\b", "Kaltume is renamed Helen"),
    (r"\bAhmadu Bello\b|\bABU\b|\bZaria\b|\bSamaru\b", "real university or town name"),
]
ZAINAB_DARK = re.compile(r"dark[- ]skinned|dark skin|deep[- ]skinned|deep brown skin|ebony", re.I)
PLACEHOLDER = re.compile(r"\[RUMI_Q\d+[^\]]*\]|\bTODO\b|\bTBD\b|\bXXX\b|\?\?\?")
LINE_ID = re.compile(r"^m(\d{3})_(open|mid\d|close\d?|play|film[a-e]?)_([a-z]?)(\d{2})$")
CUT_ID = re.compile(r"^cut_m(\d{3})_(open|close|close_\d+|mid_\d+|film_[a-e])$")


@dataclass
class Finding:
    level: str  # ERROR | WARN
    code: str
    where: str
    msg: str


@dataclass
class Cutscene:
    id: str
    line: int
    max_duration: float | None
    cast: dict[str, str]
    entries: list[dict]  # {at, key, body, cond, line}
    end_state: str


@dataclass
class Mission:
    num: int
    title: str
    file: str
    line: int
    text: str
    sections: dict[str, str] = field(default_factory=dict)
    cutscenes: list[Cutscene] = field(default_factory=list)

    @property
    def tag(self) -> str:
        return f"M{self.num:03d} ({self.file}:{self.line})"


# ---------------------------------------------------------------- reference data

def format_lists(text: str) -> dict[str, set[str]]:
    def after(label: str) -> set[str]:
        m = re.search(label + r"[^\n]*?one of `([^\n]+)", text)
        return set(re.findall(r"[a-z_]+", m.group(1).split("`")[0])) if m else set()
    out = {
        "anim": after(r"`actor\.anim \{ who, anim \}` with anim"),
        "mood": after(r"`say \{ who, id, text, mood \}` with mood"),
    }
    m = re.search(r"`light\.set \{ preset \}` \(([^)]*)\)", text)
    out["light"] = set(re.findall(r"[a-z_]+", m.group(1))) if m else set()
    m = re.search(r"\{ shot: ([a-z_]+(?:\|[a-z_]+)+)", text)
    out["shot"] = set(m.group(1).split("|")) if m else set()
    sec = text.split("### 3.4", 1)[-1].split("## 4.", 1)[0]
    out["clue"] = set(re.findall(r"`(C-[A-Z0-9]+)`", sec))
    return out


def bible_sightings(text: str) -> dict[int, set[int]]:
    """Muhammad tracker (bible §10.6): sighting number -> mission numbers."""
    sec = text.split("### 10.6", 1)[-1].split("\n## ", 1)[0]
    out: dict[int, set[int]] = {}
    for row in re.findall(r"^\| (\d+) \| ([^|]+)\|", sec, re.M):
        nums = [int(n) for n in re.findall(r"M(\d+)", row[1])]
        if len(nums) == 2 and "–" in row[1]:
            nums = list(range(nums[0], nums[1] + 1))
        out[int(row[0])] = set(nums)
    return out


def rumi_quotes(text: str) -> dict[str, list[str]]:
    out = {}
    for qid, body in re.findall(r"^\| (Q\d+) \| \"(.+?)\" \|", text, re.M):
        out[qid] = [part.strip() for part in body.split(" / ")]
    return out


# ---------------------------------------------------------------- parsing

def unescape(s: str) -> str:
    return s.replace('\\"', '"')


def norm(s: str) -> str:
    """Lower-case words only, for comparing quotations across line breaks and punctuation."""
    return " ".join(re.findall(r"[a-z0-9']+", s.lower().replace("’", "'")))


def parse_cutscene(block: str, start_line: int) -> Cutscene:
    cid = (re.search(r"^id: *(\S+)", block, re.M) or [None, ""])[1]
    md = re.search(r"^maxDuration: *([\d.]+)", block, re.M)
    cast_m = re.search(r"^cast: *\{(.*)\}", block, re.M)
    cast = {}
    if cast_m:
        for k, v in re.findall(r"([A-Z_0-9]+\??): *([\w.]+)", cast_m.group(1)):
            cast[k] = v
    entries, cond_stack = [], []  # cond_stack: [(indent, cond)]
    lines = block.split("\n")
    for i, raw in enumerate(lines):
        indent = len(raw) - len(raw.lstrip())
        while cond_stack and indent <= cond_stack[-1][0] and not raw.strip().startswith(("then:", "else:")):
            cond_stack.pop()
        mi = re.match(r"\s*- if: *(\S+)", raw)
        if mi:
            cond_stack.append((indent, mi.group(1)))
            continue
        ma = re.match(r"\s*- at: *([\d.]+) +([a-z_.]+): *(.*)$", raw)
        if ma:
            entries.append({"at": float(ma.group(1)), "key": ma.group(2), "body": ma.group(3),
                            "cond": cond_stack[-1][1] if cond_stack else None, "line": start_line + i})
    es = re.search(r"^endState: *(.*)$", block, re.M)
    return Cutscene(cid, start_line, float(md.group(1)) if md else None, cast, entries, es.group(1) if es else "")


def parse_file(path: Path) -> list[Mission]:
    text = path.read_text(encoding="utf-8")
    heads = list(re.finditer(r"^#### M(\d{3}) · (.+)$", text, re.M))
    out = []
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        body = text[h.start():end]
        line = text.count("\n", 0, h.start()) + 1
        m = Mission(int(h.group(1)), h.group(2).strip(), path.name, line, body)
        for label in REQUIRED:
            idx = body.find(label)
            if idx >= 0:
                nxt = [body.find(l, idx + len(label)) for l in REQUIRED if body.find(l, idx + len(label)) > 0]
                m.sections[label] = body[idx + len(label): min(nxt) if nxt else len(body)]
        for cb in re.finditer(r"```cutscene\n(.*?)```", body, re.S):
            m.cutscenes.append(parse_cutscene(cb.group(1), line + body.count("\n", 0, cb.start()) + 1))
        out.append(m)
    return out


def when_key(when: str):
    """(phase, week, day) from a When line, or None when it cannot be placed."""
    w = when.lower()
    day = next((DAYS[d] for d in DAYS if re.search(rf"\b{d}", w.split("·")[2] if w.count("·") >= 2 else w)), 0)
    if "freshers' week" in w:
        return (0, 0, day)
    if m := re.search(r"resumed s1 wk (\d+)", w):
        return (2, int(m.group(1)), day)
    if "first day after the strike" in w:
        return (2, 0, day)
    if m := re.search(r"strike wk (\d+)", w):
        return (1, int(m.group(1)), day)
    if m := re.search(r"\bs1 wk (\d+)", w):
        return (0, int(m.group(1)), day)
    if m := re.search(r"\bs2 wk (\d+)", w):
        return (3, int(m.group(1)), day)
    if "after exams" in w or "compressed exam" in w or "after s2 exams" in w:
        return (4, 0, day)
    return None


# ---------------------------------------------------------------- checks

def check(missions: list[Mission], fmt: dict[str, set[str]], sightings: dict[int, set[int]],
          quotes: dict[str, list[str]]) -> tuple[list[Finding], dict]:
    F: list[Finding] = []
    add = lambda lvl, code, where, msg: F.append(Finding(lvl, code, where, msg))  # noqa: E731

    nums = [m.num for m in missions]
    for n in range(1, 121):
        if nums.count(n) != 1:
            add("ERROR", "numbering", f"M{n:03d}", f"appears {nums.count(n)} times")
    if nums != sorted(nums):
        add("ERROR", "numbering", "all", "missions are out of order")

    say_ids: dict[str, str] = {}
    cut_ids: dict[str, str] = {}
    sighting_seen: dict[int, set[int]] = {}
    specials: dict[int, set[str]] = {}
    seals_prev, heist_prev, when_prev = 0, 0, {}
    seal_items: dict[str, int] = {}
    say_text: dict[str, str] = {}

    def register(sid: str, txt: str, where: str) -> None:
        """A line id may be listed twice (bullet + cutscene) only with the same words."""
        if sid in say_ids and norm(say_text[sid]) != norm(txt):
            add("ERROR", "line-id-dup", where, f"{sid} reused with different words (first at {say_ids[sid]})")
        say_ids.setdefault(sid, where)
        say_text.setdefault(sid, txt)

    for m in missions:
        t = m.tag
        for label in REQUIRED:
            if label not in m.sections:
                add("ERROR", "section", t, f"missing {label}")
        # Story length
        words = len(re.findall(r"\b[\w'’-]+\b", m.sections.get("**Story.**", "")))
        if not 400 <= words <= 800:
            add("WARN", "story-length", t, f"story is {words} words (target 400–800)")
        # Steps
        steps = re.findall(r"^\d+\. (?:\*\([^)]*\)\* )?`([^`]*)`", m.sections.get("**Steps.**", ""), re.M)
        if not 4 <= len(steps) <= 9:
            add("WARN", "steps", t, f"{len(steps)} steps (target 4–9)")
        for s in steps:
            if len(s) >= 60:
                add("WARN", "objective-length", t, f"objective {len(s)} chars: {s[:50]}…")
        # Special characters: every IF needs an ELSE
        sc = m.sections.get("**Special characters.**", "")
        ifs = {s for grp in re.findall(r"\[IF (special\.[a-z]+(?: */ *special\.[a-z]+)*)\]", sc)
               for s in re.findall(r"special\.[a-z]+", grp)}
        specials[m.num] = ifs | {e["cond"] for c in m.cutscenes for e in c.entries if e["cond"]}
        if ifs and "[ELSE]" not in sc:
            add("ERROR", "else", t, "has [IF special.*] but no [ELSE]")
        for sid, txt in re.findall(r"`(m\d{3}_[a-z0-9]+_[a-z]?\d{2})` *[\"“]([^\"”]*)", sc):
            register(sid, txt, t)
        # Mystery line: clue ids and sightings
        myst = m.sections.get("**Mystery:**", "")
        for cid in set(re.findall(r"\bC-[A-Z0-9]+\b", myst)) - fmt["clue"]:
            add("ERROR", "clue-id", t, f"unknown clue id {cid}")
        for ms in re.findall(r"\bMS-(\d+)", myst):
            sighting_seen.setdefault(int(ms), set()).add(m.num)
            if m.num not in sightings.get(int(ms), {m.num}):
                add("ERROR", "sighting", t, f"MS-{ms} is not in this mission per bible §10.6")
        # Calendar order within a year
        when = m.sections.get("**When:**", "")
        year = re.search(r"\bY(\d)\b", when)
        key = when_key(when)
        if year and key:
            prev = when_prev.get(year.group(1))
            if prev and key < prev[1] and key[0] == prev[1][0]:
                add("ERROR", "calendar", t, f"dated before M{prev[0]:03d} ({when.split('**')[0].strip()[:60]})")
            when_prev[year.group(1)] = (m.num, key)
        # Heist numbering
        if hm := re.search(r"\(Heist (\d+)\)", m.title):
            if int(hm.group(1)) != heist_prev + 1:
                add("ERROR", "heist", t, f"Heist {hm.group(1)} follows Heist {heist_prev}")
            heist_prev = int(hm.group(1))
        # Text-wide rules
        for pat, why in BANNED:
            for hit in re.finditer(pat, m.text):
                add("ERROR", "banned", t, f"'{hit.group(0)}': {why}")
        for hit in PLACEHOLDER.finditer(m.text):
            add("ERROR", "placeholder", t, f"placeholder left in: {hit.group(0)}")
        for para in m.text.split("\n"):
            if "Zainab" in para and ZAINAB_DARK.search(para):
                add("ERROR", "zainab", t, "Zainab described near a dark-skin phrase; she is very fair")
            if "Muhammad" in para and re.search(r"\bghost|\bspirit\b|time travel", para, re.I):
                add("WARN", "muhammad-words", t, "'ghost/spirit/time travel' near Muhammad (bible §13.5.6)")
        # Seals
        for sh in re.findall(r"seals_held: *(\d+)", m.text):
            if int(sh) < seals_prev:
                add("ERROR", "seals", t, f"seals_held drops to {sh} from {seals_prev}")
            seals_prev = max(seals_prev, int(sh))
        for item in set(re.findall(r"\b(seal_[a-z]+): *1\b", m.text)):
            seal_items.setdefault(item, m.num)
        if re.search(r"Fit the [A-Za-z ]*Seal", m.text) and m.num != 114:
            add("ERROR", "seals", t, "a seal is fitted before M114 (seals are kept until the bronze door)")
        # Rumi flags must carry the verbatim lines
        for q in re.findall(r"rumi_(q\d+): *true", m.text):
            qid = q.upper()
            spoken = norm(" ".join(unescape(x) for x in re.findall(r'text: *"((?:[^"\\]|\\.)*)"', m.text)))
            for part in quotes.get(qid, []):
                if norm(part) not in spoken:
                    add("ERROR", "rumi", t, f"{qid} not verbatim: missing “{part[:40]}…”")
        # Cutscenes
        has_open = any(c.id.endswith(("_open", "_film_a")) for c in m.cutscenes)
        has_close = any(re.search(r"_close(_\d+)?$", c.id) for c in m.cutscenes)
        if not (has_open and has_close):
            add("ERROR", "cutscene", t, "needs an open and a close cutscene")
        for c in m.cutscenes:
            ct = f"{c.id or '?'} ({m.file}:{c.line})"
            cm = CUT_ID.match(c.id or "")
            if not cm or int(cm.group(1)) != m.num:
                add("ERROR", "cutscene-id", ct, f"bad id for M{m.num:03d}")
            if c.id in cut_ids:
                add("ERROR", "cutscene-id", ct, f"duplicate of {cut_ids[c.id]}")
            cut_ids[c.id] = ct
            if c.max_duration is None or c.max_duration > 40:
                add("ERROR", "duration", ct, f"maxDuration {c.max_duration} (cap 40)")
            for e in c.entries:
                et = f"{c.id} ({m.file}:{e['line']})"
                if c.max_duration and e["at"] > c.max_duration:
                    add("WARN", "timing", et, f"at {e['at']} is past maxDuration {c.max_duration}")
                who = re.search(r"who: *([A-Z_0-9]+)", e["body"])
                if who:
                    role = who.group(1)
                    if role not in c.cast and role + "?" not in c.cast:
                        add("ERROR", "cast", et, f"{role} is not in cast")
                    if role + "?" in c.cast and not e["cond"]:
                        add("ERROR", "optional-role", et, f"optional {role} acts outside an if: block")
                if e["key"] == "say":
                    sid = (re.search(r"id: *([\w]+)", e["body"]) or [None, ""])[1]
                    txt = unescape((re.search(r'text: *"(.*)", *mood', e["body"]) or [None, ""])[1])
                    mood = (re.search(r"mood: *([a-z_]+)", e["body"]) or [None, ""])[1]
                    lm = LINE_ID.match(sid)
                    if not lm or int(lm.group(1)) != m.num:
                        add("ERROR", "line-id", et, f"bad line id {sid}")
                    elif who:
                        actor = c.cast.get(who.group(1) + "?") or c.cast.get(who.group(1), "")
                        want = SPECIAL_PREFIX.get(actor)
                        if want and lm.group(3) != want:
                            add("WARN", "line-id", et, f"{sid}: {actor} lines use prefix '{want}'")
                    register(sid, txt, et)
                    if len(txt) > 90:
                        add("ERROR", "line-length", et, f"{len(txt)} chars: {txt[:50]}…")
                    if mood not in fmt["mood"]:
                        add("ERROR", "mood", et, f"mood '{mood}' not in FORMAT.md")
                elif e["key"] == "actor.anim":
                    a = (re.search(r"anim: *([a-z_]+)", e["body"]) or [None, ""])[1]
                    if a not in fmt["anim"]:
                        add("ERROR", "anim", et, f"anim '{a}' not in FORMAT.md")
                elif e["key"] == "light.set":
                    p = (re.search(r"preset: *([a-z_]+)", e["body"]) or [None, ""])[1]
                    if p not in fmt["light"]:
                        add("WARN", "light", et, f"light preset '{p}' not in FORMAT.md")
                elif e["key"].startswith("camera.") and "shot:" in e["body"]:
                    s = (re.search(r"shot: *([a-z_]+)", e["body"]) or [None, ""])[1]
                    if s not in fmt["shot"]:
                        add("WARN", "shot", et, f"shot '{s}' not in FORMAT.md")

    for n, mset in sightings.items():
        for mn in mset:
            if n not in sighting_seen or mn not in sighting_seen[n]:
                # #28 is an absence spread over four missions; one mention is enough
                if n == 28 and n in sighting_seen:
                    continue
                add("WARN", "sighting", f"MS-{n:02d}", f"tracker puts it in M{mn:03d}; that Mystery line does not list it")

    summary = {
        "missions": len(missions),
        "say_lines": len(say_ids),
        "cutscenes": len(cut_ids),
        "seal_items": dict(sorted(seal_items.items(), key=lambda kv: kv[1])),
        "special_appearances": {s: sorted(n for n, v in specials.items() if s in v) for s in SPECIAL_PREFIX},
    }
    return F, summary


def run(files=None) -> tuple[list[Finding], dict]:
    fmt = format_lists(FORMAT.read_text(encoding="utf-8"))
    sightings = bible_sightings(BIBLE.read_text(encoding="utf-8"))
    quotes = rumi_quotes(QUOTES.read_text(encoding="utf-8"))
    missions = [m for f in (files or YEAR_FILES) for m in parse_file(Path(f))]
    return check(missions, fmt, sightings, quotes)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--errors", action="store_true", help="show errors only")
    a = ap.parse_args(argv)
    findings, summary = run()
    if a.errors:
        findings = [f for f in findings if f.level == "ERROR"]
    errors = sum(f.level == "ERROR" for f in findings)
    if a.json:
        print(json.dumps({"summary": summary, "findings": [f.__dict__ for f in findings]}, indent=2, ensure_ascii=False))
    else:
        for f in findings:
            print(f"{f.level:5} [{f.code}] {f.where}: {f.msg}")
        print(f"\n{summary['missions']} missions, {summary['cutscenes']} cutscenes, {summary['say_lines']} spoken lines.")
        print("Seals first held:", ", ".join(f"{k} M{v:03d}" for k, v in summary["seal_items"].items()))
        for s, ms in summary["special_appearances"].items():
            if ms:
                print(f"{s}: {len(ms)} missions ({', '.join(f'M{n}' for n in ms)})")
        print(f"{errors} error(s), {sum(f.level == 'WARN' for f in findings)} warning(s).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
