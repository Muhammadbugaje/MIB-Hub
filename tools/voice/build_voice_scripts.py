"""Build one voice script per character from the mission scripts and the bark packs.

Run from the repo root (standard library only for --check; the PDFs need the repo's .venv with reportlab):
    python3 tools/voice/build_voice_scripts.py --check        # validate docs/voice/barks/*.md only
    python3 tools/voice/build_voice_scripts.py                # write docs/voice/scripts/*.md
    .venv/bin/python tools/voice/build_voice_scripts.py --pdf # ...and docs/voice/pdf/*.pdf

Sources:
  * story lines: every `say` in the cutscenes of docs/plan/missions/Y1-Y5.md, plus the special characters'
    play lines listed in each mission's "Special characters" section;
  * barks: docs/voice/barks/<name>.md, in the format of docs/voice/BARKS_FORMAT.md.
Lines spoken by `npc.roomie` go into both Bature's and Firdausi's scripts (each records them).
Characters with fewer than MIN_DEDICATED story lines and no bark pack go into "Small parts".

The scripts are written for the people recording, in the story-pack style of tools/story/md2pdf.py (a designed
cover, coloured bars, numbered lines with a small "how to say it"). They never show a line id or a condition
code. The ids live beside each script in docs/voice/scripts/<name>.lines.json, which maps
(section, line number) to the game's line id so recordings can be matched later.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "story"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_missions as cm  # noqa: E402
from voice_data import CHARACTERS, MISSIONS, SMALL_NAMES  # noqa: E402

BARKS = ROOT / "docs" / "voice" / "barks"
OUT = ROOT / "docs" / "voice" / "scripts"
PDF_OUT = ROOT / "docs" / "voice" / "pdf"
MIN_DEDICATED = 8
MAX_LEN = 90
STAGES = {"Filler": "f", "Year 1": "y1", "Year 2": "y2", "Year 3": "y3", "Year 4": "y4", "Year 5": "y5",
          "Post-game": "post", "Events": "ev"}
CATEGORIES = set("""greet bye thanks sorry compliment tease follow wait lost yes no maybe confused agree refuse joke ask
hit fall win lose blackout light_back rain heat food money gift_like gift_dislike gift_love idle night callback
ev_freshers ev_exam ev_results ev_strike ev_ramadan ev_christmas ev_cup ev_elections ev_valentine ev_harmattan
ev_convocation ev_allowance ev_market_day""".split())
BARK_LINE = re.compile(r'^- `(bk_[a-z0-9_]+)` \(([a-z_]+)\) "(.*)"(?: · when: (.+))?$')
SPECIAL_BY_PREFIX = {"j": "special.jiya", "t": "special.taty", "d": "special.madison", "b": "special.mib"}
NAMES = {
    "player": "The Fresher", "npc.roomie": "The roommate",
    "npc.maker": "The Maker", "npc.zainab": "Dr. Zainab", "npc.okonkwo": "Dr. Okonkwo", "npc.khadija": "Dr. Khadija",
    "npc.dr_minus": "Dr. Minus", "npc.nwachukwu": "Prof. Nwachukwu (voice on tape)", "npc.bello": "Prof. Bello",
    "special.jiya": "Jiya", "special.taty": "Taty", "special.madison": "Madison", "special.mib": "M.I. BUGAJE",
    "npc.mrs_adebayo": "Mrs. Adebayo", "npc.mr_clement": "Mr. Clement", "npc.mrs_shehu": "Mrs. Shehu",
    "npc.ab": "AB", "npc.kb": "KB", "npc.cmd": "The Chief Medical Director", "npc.dj_sugar": "DJ Sugar",
    "npc.garba": "Malam Garba", "npc.hauwa": "Nurse Hauwa", "npc.megawatt": "Chief Megawatt",
    "npc.aliyu": "Engr. Aliyu", "npc.kabiru": "DJ Kabiru", "npc.lawal": "Ranger Lawal", "npc.bilkisu": "Sgt. Bilkisu",
    "npc.danladi": "Coach Danladi", "npc.ngozi": "Coach Ngozi", "npc.pastor_sam": "Pastor Sam",
    "npc.ustaz_auwal": "Ustaz Auwal", "npc.malam_sule": "Malam Sule", "npc.big_baby": "Big Baby",
}


@dataclass
class Line:
    id: str
    who: str
    mood: str
    text: str
    where: str  # mission or bark stage/category
    cue: str = ""
    when: str = ""
    mission: int = 0      # story lines: the mission number
    title: str = ""       # story lines: the mission title
    cue_who: str = ""     # story lines: who spoke just before (a cast id), if it was somebody else
    cue_text: str = ""
    to: str = ""          # story lines: who the line is said to, when the scene makes that certain
    note: str = ""        # special characters' play lines: the writer's bracketed direction, e.g. "to Jega"
    order: int = 0


PLACEHOLDER = re.compile(r"^\[[A-Z_]+_LINE:")  # a line the game picks at run time; nothing to record yet
SPECIAL_PLAY = re.compile(r"`(m\d{3}_[a-z0-9]+_([a-z])\d{2})`\s*(?:\(([^)]*)\)\s*)?[\"“]([^\"”]*)")


def display(actor: str) -> str:
    if actor in CHARACTERS:
        return CHARACTERS[actor][0]
    if actor in NAMES:
        return NAMES[actor]
    if actor in SMALL_NAMES:
        return SMALL_NAMES[actor]
    base = actor.split(".", 1)[-1]
    return " ".join(w.capitalize() for w in base.split("_"))


def story_lines() -> list[Line]:
    out: list[Line] = []
    seen: set[str] = set()
    for f in cm.YEAR_FILES:
        for m in cm.parse_file(f):
            tag = f"M{m.num:03d} {m.title}"
            for c in m.cutscenes:
                says = []
                for e in c.entries:
                    if e["key"] != "say":
                        continue
                    who = re.search(r"who: *([A-Z_0-9]+)", e["body"]).group(1)
                    actor = c.cast.get(who) or c.cast.get(who + "?") or who
                    sid = re.search(r"id: *(\w+)", e["body"]).group(1)
                    text = cm.unescape((re.search(r'text: *"(.*)", *mood', e["body"]) or [None, ""])[1])
                    mood = (re.search(r"mood: *([a-z_]+)", e["body"]) or [None, ""])[1]
                    says.append((sid, actor, mood, text, e["cond"]))
                speakers = {a for _, a, _, _, _ in says}
                prev = ""
                for k, (sid, actor, mood, text, cond) in enumerate(says):
                    if sid not in seen:
                        ln = Line(sid, actor, mood, text, f"{tag} · {c.id}", prev, mission=m.num, title=m.title,
                                  order=len(out))
                        # the cue: the line just before, if somebody else said it and it always plays before this one
                        if k and says[k - 1][1] != actor and says[k - 1][4] in (None, cond) \
                                and not PLACEHOLDER.match(says[k - 1][3]):
                            ln.cue_who, ln.cue_text = says[k - 1][1], says[k - 1][3]
                        if len(speakers) == 2:
                            ln.to = next(a for a in speakers if a != actor)
                        out.append(ln)
                        seen.add(sid)
                    prev = f"{display(actor)}: {text}"
            sc = m.sections.get("**Special characters.**", "")
            # `id` "line", or `id` (a direction) "line"
            for sid, letter, note, text in SPECIAL_PLAY.findall(sc):
                if sid in seen or letter not in SPECIAL_BY_PREFIX:
                    continue
                out.append(Line(sid, SPECIAL_BY_PREFIX[letter], "neutral", text, f"{tag} · gameplay", mission=m.num,
                                title=m.title, note=note.strip(), order=len(out)))
                seen.add(sid)
    return out


def parse_barks(path: Path, errors: list[str]) -> tuple[str, str, list[Line]]:
    text = path.read_text(encoding="utf-8")
    actor = (re.search(r"^\*\*Id:\*\* *(\S+)", text, re.M) or [None, ""])[1]
    voice = (re.search(r"^\*\*Voice:\*\* *(.+)$", text, re.M) or [None, ""])[1]
    if not actor:
        errors.append(f"{path.name}: missing **Id:** line")
    if not voice:
        errors.append(f"{path.name}: missing **Voice:** line")
    stage = cat = None
    lines: list[Line] = []
    for n, raw in enumerate(text.split("\n"), 1):
        loc = f"{path.name}:{n}"
        if raw.startswith("## "):
            stage = raw[3:].strip()
            if stage not in STAGES:
                errors.append(f"{loc}: unknown stage '{stage}' (use {', '.join(STAGES)})")
            cat = None
        elif raw.startswith("### "):
            cat = raw[4:].strip()
            if cat not in CATEGORIES:
                errors.append(f"{loc}: unknown category '{cat}'")
        elif raw.startswith("- `bk_") or raw.startswith("- `"):
            m = BARK_LINE.match(raw.rstrip())
            if not m:
                errors.append(f"{loc}: line is not in the form - `id` (mood) \"text\"")
                continue
            bid, mood, body, when = m.groups()
            if not stage or not cat:
                errors.append(f"{loc}: line outside a ## stage / ### category")
                continue
            want = f"_{STAGES.get(stage, '?')}_{cat}_"
            # Events: "bk_x_ev_strike_01" (preferred) and "bk_x_ev_ev_strike_01" are both accepted.
            ok = want in bid or (stage == "Events" and cat.startswith("ev_") and f"_{cat}_" in bid)
            if not ok or not re.fullmatch(r"bk_[a-z0-9_]+_\d{2}", bid):
                errors.append(f"{loc}: id {bid} should look like bk_<who>{want}NN")
            if mood not in cm.format_lists(cm.FORMAT.read_text(encoding="utf-8"))["mood"]:
                errors.append(f"{loc}: mood '{mood}' not in FORMAT.md")
            if len(body) > MAX_LEN:
                errors.append(f"{loc}: {len(body)} characters (max {MAX_LEN})")
            if re.search(r"\bKaltume\b|\bAhmadu Bello\b|\bABU\b|\bZaria\b|\bSamaru\b", body):
                errors.append(f"{loc}: banned name")
            lines.append(Line(bid, actor, mood, body, f"{stage} · {cat}", when=when or ""))
    return actor, voice, lines


def load_barks(errors: list[str]) -> tuple[dict[str, str], list[Line]]:
    voices: dict[str, str] = {}
    lines: list[Line] = []
    for p in sorted(BARKS.glob("*.md")):
        actor, voice, ls = parse_barks(p, errors)
        if actor:
            voices[actor] = voice
        lines += ls
    seen: dict[str, str] = {}
    for ln in lines:
        if ln.id in seen:
            errors.append(f"duplicate bark id {ln.id} ({seen[ln.id]} and {ln.where})")
        seen[ln.id] = ln.where
    return voices, lines


# ---------------------------------------------------------------- plain English for the people recording

MOODS = {"neutral": "", "warm": "warm", "amused": "amused", "bored": "bored, flat", "stern": "firm", "sharp": "sharp, quick",
         "shy": "shy", "proud": "proud", "scared": "scared", "sad": "sad, low", "excited": "excited",
         "dry": "dry, deadpan", "whisper": "a whisper"}
TOKENS = {"{{PLAYER_NAME}}": "(name)", "{{ROOMIE}}": "Bature/Firdausi", "{{PARTNER}}": "(partner's name)",
          "{{TOWN}}": "(town)", "{{UNI_NAME}}": "(university)", "{{UNI_SHORT}}": "(university)", "{{GAME_NAME}}": "(the game)"}
CONDITIONS = {"night": "only at night", "raining": "when it's raining", "blackout": "during a power cut",
              "strike": "during the strike", "exam_week": "in exam week", "ramadan": "in Ramadan", "heat": "on a hot day",
              "results_good": "after good results", "results_bad": "after bad results",
              "player_male": "to a male player", "player_female": "to a female player",
              "friendship>=3": "once you're good friends", "blackout_soon": "the day before a power cut",
              "hard_night_soon": "the day before a bad night", "maker_away": "when the Maker is away",
              "lang_pt": "a Portuguese slip"}
# (heading, small note, categories). A pack's "Filler" lines are grouped like this, in this order.
GROUPS = [
    ("Saying hello", "The player has just walked up.", ["greet"]),
    ("Saying goodbye", "", ["bye"]),
    ("Thank-yous and sorries", "", ["thanks", "sorry"]),
    ("Being nice", "Compliments. Mean them.", ["compliment"]),
    ("Teasing", "Friendly. The joke is never unkind.", ["tease"]),
    ("Walking with the player", "Keeping up, waiting, and when the player goes the wrong way.", ["follow", "wait", "lost"]),
    ("Quick answers", "The player asks something and gets one of these back.",
     ["yes", "no", "maybe", "confused", "agree", "refuse"]),
    ("Jokes and questions", "", ["joke", "ask"]),
    ("Winning and losing", "After a game, a match or a bet.", ["win", "lose"]),
    ("When something goes wrong", "Bumps, falls, power cuts, rain and heat. NEPA is what everybody calls the power "
     "company, and so every power cut.", ["hit", "fall", "blackout", "light_back", "rain", "heat"]),
    ("Food and money", "", ["food", "money"]),
    ("Getting a present", "The player hands over a present. Some go down better than others.",
     ["gift_love", "gift_like", "gift_dislike"]),
    ("Talking to yourself", "Said to nobody in particular as the player walks past.", ["idle"]),
    ("Late at night", "After dark. Quieter.", ["night"]),
    ("Remember when", "Little nods to things that have already happened in the story.", ["callback"]),
    ("Special days: term time", "Days on the campus calendar. Allowance day is when money from home arrives.",
     ["ev_freshers", "ev_exam", "ev_results", "ev_allowance", "ev_market_day"]),
    ("Special days: the big ones", "Save any shouting for last.", ["ev_strike", "ev_cup", "ev_elections", "ev_convocation"]),
    ("Special days: seasons and holidays", "Harmattan is the dry, dusty season.",
     ["ev_ramadan", "ev_christmas", "ev_valentine", "ev_harmattan"]),
]
KIND = {"greet": "hello", "bye": "goodbye", "thanks": "thank you", "sorry": "sorry", "compliment": "being nice",
        "tease": "teasing", "follow": "walking along", "wait": "waiting for the player", "lost": "the player went the wrong way",
        "yes": "yes", "no": "no", "maybe": "maybe", "confused": "confused", "agree": "agreeing", "refuse": "refusing",
        "joke": "a joke", "ask": "a question", "hit": "bumped into", "fall": "after a fall", "win": "after winning",
        "lose": "after losing", "blackout": "the lights go out", "light_back": "the lights come back", "rain": "rain",
        "heat": "a hot day", "food": "food", "money": "money", "gift_like": "likes the present",
        "gift_dislike": "not keen on the present", "gift_love": "loves the present", "idle": "to yourself",
        "night": "late at night", "callback": "looking back", "ev_freshers": "freshers' week", "ev_exam": "exam week",
        "ev_results": "results day", "ev_strike": "the strike", "ev_ramadan": "Ramadan", "ev_christmas": "Christmas",
        "ev_cup": "cup final day", "ev_elections": "election week", "ev_valentine": "Valentine's Day",
        "ev_harmattan": "harmattan", "ev_convocation": "graduation day", "ev_allowance": "allowance day",
        "ev_market_day": "market day"}
YEARS = {"Year 1": ("Year 1: arriving", "Everything is new. Queues, friends, the first power cuts."),
         "Year 2": ("Year 2: the mall", "A shiny new mall has opened, and the lights keep going off."),
         "Year 3": ("Year 3: the strike", "The lecturers are on strike. No lectures, an empty campus, no money."),
         "Year 4": ("Year 4: fame", "Viral videos, an election, and work placements."),
         "Year 5": ("Year 5: leaving", "Final year. Projects, job offers, and everyone counting the days."),
         "Post-game": ("After graduation", "The story is over. The player has come back to visit.")}
SOLO = {"idle", "night", "callback"}  # said to nobody; split off when a year has many lines
SPLIT_AT = 16
GAME = """It's a game you play in a web browser, about surviving five years at a Nigerian university. Please don't expect GTA. Nobody steals a car. The most dangerous vehicle in it is a three-wheeled keke taxi with a married couple arguing in the back, and the nearest thing to a boss fight is a queue.

You play a brand-new student, the Fresher. You register (four offices, four queues, four passport photographs), go broke by week three, live on garri, make friends for life, sit exams by torchlight because the power has gone again, and one day you graduate. Under the jokes there is a mystery: why the lights keep going off, and why a quiet old man has spent forty years in a garden keeping one of them on. Nobody gets hurt. The cure for the monster is company.

The university and the town are made up. The voices are friends and family, recording on their phones. Thank you for being one of them."""


def show(text: str) -> str:
    """A line as the reader sees it: no {{TOKENS}}, no pipes or backticks that would upset the page."""
    for k, v in TOKENS.items():
        text = text.replace(k, v)
    text = re.sub(r"\{\{[A-Z_]+\}\}", "(name)", text)
    return text.replace("|", "/").replace("`", "'").strip()


def clip(text: str, n: int = 120) -> str:
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


def plain_condition(when: str, titles: dict[int, str]) -> str:
    """'night, m017_done' -> 'only at night, after "Keke Grand Prix"'. Raises ValueError on a flag it does not know."""
    out = []
    for c in (x.strip() for x in when.split(",") if x.strip()):
        m = re.fullmatch(r"m(\d{3})_done", c)
        if m and int(m.group(1)) in titles:
            out.append(f"after “{show(titles[int(m.group(1))])}”")
        elif c in CONDITIONS:
            out.append(CONDITIONS[c])
        else:
            raise ValueError(f"unknown condition '{c}' (add it to CONDITIONS in build_voice_scripts.py)")
    return ", ".join(out)


def when_text(when: str) -> str:
    """'Y3 · Strike wk 5 · Mon–Wed' -> 'Year 3, during the strike'."""
    w = when.strip()
    low = w.lower()
    y = re.match(r"Y(\d)", w)
    if not y:
        return "Some years later"
    year = f"Year {y.group(1)}"
    if "freshers' week" in low:
        return f"{year}, the first week"
    if "first day after the strike" in low:
        return f"{year}, the day the strike ends"
    if "strike" in low:
        return f"{year}, during the strike"
    if "resumed" in low:
        return f"{year}, after the strike"
    if "convocation day" in low:
        return f"{year}, graduation day"
    if "the day after" in low:
        return f"{year}, the day after graduation"
    sem = "first semester" if re.search(r"\bS1\b", w) else "second semester" if re.search(r"\bS2\b", w) else ""
    extra = "exam time" if "exam" in low and "after exams" not in low else "test week" if "test" in low else \
        "after exams" if "after exams" in low else ""
    return ", ".join(x for x in (year, sem, extra) if x)


def mission_info() -> dict[int, tuple[str, str]]:
    """mission number -> (title, when in plain words)."""
    out = {}
    for f in cm.YEAR_FILES:
        for m in cm.parse_file(f):
            when = m.sections.get("**When:**", "").split("**")[0]
            out[m.num] = (m.title.replace("{{PLAYER_NAME}}", "(Name)"), when_text(when))
    return out


def story_tag(ln: Line) -> str:
    """The small 'how to say it' above a story line."""
    parts = [MOODS.get(ln.mood, ln.mood)]
    if ln.note:
        parts.append(re.sub(r"\byou\b", "the Fresher", re.sub(r"\byour\b", "the Fresher's", ln.note)))
    elif ln.to:
        parts.append("to " + ("the Fresher" if ln.to == "player" else re.sub(r"^(The|A|An) ", lambda m: m.group(1).lower() + " ", display(ln.to))))
    if re.fullmatch(r"\[[^\]]+\]", ln.text):
        parts.append("say it in English")
    tag = ", ".join(p for p in parts if p)
    return (tag or ("in play" if ln.where.endswith("gameplay") else "your normal voice")).replace("|", "/")


def story_text(ln: Line) -> str:
    text = show(ln.text)
    if re.fullmatch(r"\[[^\]]+\]", text):  # a whole line in brackets is the English of the line before: it is spoken
        text = text[1:-1]
    if ln.cue_text:
        who = "The Fresher" if ln.cue_who == "player" else display(ln.cue_who)
        cue = clip(show(ln.cue_text)).replace("((", "(").replace("))", ")")
        return f"(({who}: “{cue}”)) {text}"
    return text


def words(lines: list[Line]) -> int:
    return sum(len(re.sub(r"\[[^\]]*\]", " ", show(ln.text)).split()) for ln in lines)


def minutes(n_words: int, n_lines: int) -> str:
    m = n_words / 150 + n_lines * 3 / 60  # speaking, plus a pause after each line
    if m < 8:
        return f"about {max(2, round(m))} minutes"
    return f"about {int(round(m / 5) * 5)} minutes"


@dataclass
class Section:
    key: str      # "Mission 3", "Common 2", or a small part's name: the recording is named after this
    title: str
    note: str
    rows: list  # (tag, text, Line)


def story_sections(story: list[Line], info: dict[int, tuple[str, str]]) -> tuple[list[Section], list[Line]]:
    """One section per mission, in story order. Lines the game fills in at run time are returned as pending."""
    pending = [ln for ln in story if PLACEHOLDER.match(ln.text)]
    out: list[Section] = []
    last = None
    for ln in sorted((x for x in story if not PLACEHOLDER.match(x.text)), key=lambda x: (x.mission, x.order)):
        if ln.mission != last:
            title, when = info.get(ln.mission, (ln.title, ""))
            blurb = MISSIONS.get(ln.mission, "")
            out.append(Section(f"Mission {len(out) + 1}", title, " ".join(x for x in (when + "." if when else "", blurb) if x), []))
            last = ln.mission
        out[-1].rows.append((story_tag(ln), story_text(ln), ln))
    return out, pending


def bark_sections(barks: list[Line], titles: dict[int, str]) -> list[Section]:
    """Common lines under plain headings: the everyday ones by kind, then each year, then special days."""
    def tag(ln: Line, with_kind: bool) -> str:
        cat = ln.where.split(" · ")[1]
        parts = [KIND[cat] if with_kind else "", MOODS.get(ln.mood, ln.mood), plain_condition(ln.when, titles)]
        return ", ".join(p for p in parts if p) or "your normal voice"

    by_stage: dict[str, list[Line]] = defaultdict(list)
    for ln in barks:
        by_stage[ln.where.split(" · ")[0]].append(ln)
    raw: list[tuple[str, str, list, bool]] = []
    grouped = by_stage.get("Filler", []) + by_stage.get("Events", [])
    for title, note, cats in GROUPS[:15]:
        ls = [ln for ln in by_stage.get("Filler", []) if ln.where.split(" · ")[1] in cats]
        if ls:
            raw.append((title, note, ls, len({ln.where for ln in ls}) > 1))
    for stage, (title, note) in YEARS.items():
        ls = by_stage.get(stage, [])
        solo = [ln for ln in ls if ln.where.split(" · ")[1] in SOLO]
        if len(ls) > SPLIT_AT and solo and len(solo) < len(ls):
            raw.append((title, note, [ln for ln in ls if ln not in solo], True))
            raw.append((title + ", to yourself", "Said to nobody in particular as the player walks past.", solo, True))
        elif ls:
            raw.append((title, note, ls, True))
    for title, note, cats in GROUPS:  # special days: wherever the pack filed them
        if not cats[0].startswith("ev_"):
            continue
        ls = [ln for ln in grouped if ln.where.split(" · ")[1] in cats]
        ls.sort(key=lambda ln: cats.index(ln.where.split(" · ")[1]))
        if ls:
            raw.append((title, note, ls, True))
    placed = {ln.id for _, _, ls, _ in raw for ln in ls}
    rest = [ln for ln in barks if ln.id not in placed]
    if rest:
        raw.append(("More lines", "", rest, True))
    return [Section(f"Common {i}", title, note, [(tag(ln, kinds), show(ln.text), ln) for ln in ls])
            for i, (title, note, ls, kinds) in enumerate(raw, 1)]


def render(sections: list[Section]) -> list[str]:
    out = []
    for s in sections:
        head = s.title if s.key == s.title else f"{s.key} · {s.title}"
        out.append(f"::: {head.replace('|', '/')}" + (f" | {s.note.replace('|', '/')}" if s.note else ""))
        out += [f":: {n} | {tag} | {text}" for n, (tag, text, _) in enumerate(s.rows, 1)]
        out.append("")
    return out


def line_map(name: str, sections: list[Section], pending: list[Line]) -> dict:
    """What the game needs to match a recording to a line: (section, number) -> id."""
    return {"character": name,
            "sections": [{"section": s.key, "title": s.title, "file": f"{name} - {s.key}",
                          "lines": [{"n": n, "id": ln.id, "text": ln.text} for n, (_, _, ln) in enumerate(s.rows, 1)]}
                         for s in sections],
            "pending": [{"id": ln.id, "text": ln.text} for ln in pending]}


def guide(name: str, n_story: int, n_barks: int, n_words: int, first: str, crowd: bool = False) -> list[str]:
    total = n_story + n_barks
    split = (f" That's {n_story} mission line{'s' if n_story != 1 else ''} and {n_barks} common "
             f"line{'s' if n_barks != 1 else ''}.") if n_story and n_barks else ""
    out = ["# How to record", "",
           f"**What you've got.** **{total} lines**, about **{n_words:,} words**.{split} Read straight through, it's "
           f"**{minutes(n_words, total)}** of talking. Nobody should do it in one sitting. A few sections a day is perfect.", "",
           "**Change any word so it sounds like you.** Honestly. If a line doesn't sound right in your mouth, say it your "
           "way. If you think of a funnier one, record that as well. " +
           ("**More voices are welcome:** it's a crowd, so share the lines out among friends and family." if crowd
            else f"You are the expert on how {name} talks."), ""]
    out += ["#### Getting set up", "",
            "- **A phone is fine.** Use its voice recorder app on the best quality setting, in aeroplane mode so nothing pings.",
            "- **Pick a quiet, soft room.** A wardrobe full of clothes is the best studio in any house. Switch off fans and the TV.",
            "- **Hold the phone about a hand-span from your mouth,** slightly to one side, and keep it there.", "",
            "#### Reading the page", "",
            "- **The big black words are your line.** Say only those.",
            "- **The small orange words above a line are how to say it,** and sometimes who you are talking to. Don't read them out.",
            "- **Small grey words are what somebody else says just before you,** so you know the moment. Don't read them out.",
            "- **Words in [square brackets] are the English meaning.** Don't say them. If the Hausa, Pidgin or any other "
            "language is wrong, fix it. You know better than I do.",
            "- **(name)** is where the game drops in the player's name: leave a short pause. **Bature/Firdausi** is the "
            "player's roommate: say the line once with each name.",
            "- **Three dots (...) mean a beat of silence.**", "",
            "#### Recording", "",
            "- **One recording per coloured bar.** Start recording, read that bar's lines in order, stop. Then the next bar.",
            "- **Leave about two seconds of silence between lines.** That's where I cut. No need to say the line numbers.",
            "- **If you fluff a line,** pause and say it again. Don't stop the recording.",
            "- **Got the energy?** Say a line twice, two different ways, and I'll pick the best one.",
            "- **Shouting lines last,** and drink water.", "",
            "#### Sending it", "",
            f"- Name each file after its coloured bar, like this: *{name} - {first}*.",
            "- Put everything in one folder and send me a Google Drive or WeTransfer link, with a photo of the signed last "
            "page. There is no deadline.", ""]
    return out


def clean_voice(voice: str) -> str:
    voice = re.sub(r"\s*\(bible §[^)]*\)", "", voice)
    voice = re.sub(r"\s*\(the engine[^)]*\)", "", voice)
    return show(voice)


def script_md(title: str, actor_ids: list[str], voice: str, story: list[Line], barks: list[Line],
              info: dict[int, tuple[str, str]] | None = None) -> tuple[str, dict]:
    """One character's script, and the map from its numbered lines to the game's line ids."""
    info = info if info is not None else mission_info()
    main = actor_ids[-1]
    name, tagline, who, *own_voice = CHARACTERS.get(main, (title, "A voice in the game.", ""))
    voice = clean_voice(own_voice[0] if own_voice else voice)
    crowd = main.startswith("crowd.")
    special = main.startswith("special.")
    missions, pending = story_sections(story, info)
    common = bark_sections(barks, {n: t for n, (t, _) in info.items()})
    said = [ln for s in missions + common for _, _, ln in s.rows]
    n_story = sum(len(s.rows) for s in missions)
    n_barks = sum(len(s.rows) for s in common)
    inside = "  ·  ".join(x for x in (f"meet {name}", "how to record", f"{n_story} mission lines" if n_story else "",
                                      f"{n_barks} common lines" if n_barks else "", "the agreement") if x)
    out = ["<!-- pack-style: roomy -->", f"<!-- cover: {name} | {tagline} -->", "<!-- cover-label: Your Voice Script -->",
           f"<!-- cover-inside: Inside: {inside} -->",
           f"# Meet {name}", "", f"> {tagline}", ""]
    if who:
        out += [who, ""]
    if main in ("special.jiya", "special.taty"):
        out += [f"**You also have a Story Pack.** It has my letter to you, the whole story and your missions. This is the "
                "plain recording copy of your lines. Record from one or the other, not both, and tell me which one you "
                "used, because the two are numbered differently.", ""]
    if voice:
        out += ["### The voice", "", voice, ""]
    out += ["### What is this game?", "", GAME, ""]
    first = (missions or common)[0].key if (missions or common) else "Mission 1"
    out += guide(name, n_story, n_barks, words(said), first, crowd)
    if missions:
        out += ["# Mission lines", "",
                "In story order. Each coloured bar is one mission: its name, when it happens and what is going on. "
                "One recording per bar.", ""] + render(missions)
    if common:
        out += [("# " if n_story > 12 or not n_story else "## ") + "Common lines", "",
                f"These are the short lines {name} says around campus, outside the story: when the player walks up, bumps "
                "into you, hands you a present, or just passes by. The game picks one each time, so they never play in a "
                "row. Say each as if someone has just walked past.", ""] + render(common)
    out += agreement(name, special)
    return "\n".join(out) + "\n", line_map(name, missions + common, pending)


def small_parts_md(small: list[Line], info: dict[int, tuple[str, str]]) -> tuple[str, dict]:
    """Short roles in one script: a coloured bar per speaker."""
    by: dict[str, list[Line]] = defaultdict(list)
    for ln in sorted(small, key=lambda x: (x.mission, x.order)):
        by[ln.who].append(ln)
    sections, pending = [], []
    for who in sorted(by, key=lambda a: display(a).lower().removeprefix("the ").removeprefix("a ").removeprefix("an ")):
        real = [ln for ln in by[who] if not PLACEHOLDER.match(ln.text)]
        pending += [ln for ln in by[who] if PLACEHOLDER.match(ln.text)]
        if not real:
            continue
        seen_in = []
        for ln in real:
            t = info.get(ln.mission, (ln.title, ""))[0]
            if t not in seen_in:
                seen_in.append(t)
        years = sorted({info.get(ln.mission, ("", ""))[1].split(",")[0] for ln in real} - {""})
        note = ("In " + ", ".join(f"“{t}”" for t in seen_in[:3]) + (" and more" if len(seen_in) > 3 else "") +
                (f" ({', '.join(years)})." if years else "."))
        rows = []
        for ln in real:
            tag = story_tag(ln)
            if len(seen_in) > 1:
                tag = f"in “{info.get(ln.mission, (ln.title, ''))[0]}”, {tag}"
            rows.append((tag, story_text(ln), ln))
        sections.append(Section(display(who), display(who), note, rows))
    said = [ln for s in sections for _, _, ln in s.rows]
    name = "Small Parts"
    out = ["<!-- pack-style: roomy -->",
           f"<!-- cover: {name} | One line, one scene, and the whole campus quotes you for a year. -->",
           "<!-- cover-label: Your Voice Script -->",
           f"<!-- cover-inside: Inside: {len(sections)} small parts  ·  how to record  ·  {len(said)} lines  ·  the agreement -->",
           "# Small parts", "", "> One line, one scene, and the whole campus quotes you for a year.", "",
           "These are the short roles: the tailor who says \"Thursday\", the examiner in the keke, the deans, the "
           "invigilator, the voice on the radio. Each has a coloured bar of its own with a handful of lines. You will "
           "have been asked to voice one or more of them, and one person can happily do several. Find your bars and "
           "ignore the rest.", "",
           "### What is this game?", "", GAME, ""]
    out += guide("the part", len(said), 0, words(said), sections[0].key if sections else "Mission 1")
    out = [x.replace("*the part - ", "*Small part - ").replace("how the part talks", "how your part talks") for x in out]
    out += ["# The parts", "", "In alphabetical order. One recording per coloured bar, named after the bar.", ""]
    out += ["| Part | Lines | Where |", "|---|---|---|"]
    out += [f"| {s.title} | {len(s.rows)} | {s.note} |" for s in sections] + [""]
    out += render(sections)
    out += agreement("small parts (the ones I was asked to voice)", False)
    return "\n".join(out) + "\n", line_map(name, sections, pending)


def index_md(rows: list[tuple[str, str, int, int]], n_story: int, n_barks: int) -> str:
    """The cast list: every script, with its tagline and line counts. No file names, no ids."""
    rows = sorted(rows, key=lambda r: -(r[2] + r[3]))
    out = ["<!-- pack-style: roomy -->", f"<!-- cover: The Cast | {len(rows)} scripts, one made-up campus, and every voice a friend. -->",
           "<!-- cover-label: Voice Scripts -->",
           f"<!-- cover-inside: Inside: every part  ·  {n_story:,} mission lines  ·  {n_barks:,} common lines -->",
           "# The cast list", "",
           f"**{len(rows)} scripts. {n_story + n_barks:,} lines.** That's {n_story:,} mission lines (said in the story's "
           f"scenes) and {n_barks:,} common lines (said around campus). Each part below has a script of its own, with "
           "a cover, a page about the character, a recording guide and an agreement to sign.", "",
           "Biggest parts first.", "",
           "| Part | In one line | Mission lines | Common lines | All |", "|---|---|---|---|---|"]
    out += [f"| **{name}** | {tag.replace('|', '/')} | {st or '—'} | {bk or '—'} | {st + bk} |" for name, tag, st, bk in rows]
    return "\n".join(out) + "\n"


def agreement(character: str, special: bool) -> list[str]:
    likeness = ("\n6. **My likeness.** My character's look is inspired by me with my permission. My voice and likeness are "
                "used **only** for my own character, never for anyone else. I approve my character's lines and look, and "
                "I can ask for any line or look to be changed.") if special else ""
    out = ["", "# Volunteer voice agreement", "",
           f"**Game:** the open-world browser game on MIB-Hub, created by Muhammad (\"the creator\"). **Character:** {character}.",
           "",
           "Please read this, fill in the boxes, sign, and send a photo or scan of this page back with your recordings. "
           "If anything is unclear, ask before you sign.",
           "",
           "1. **I am volunteering.** I am recording these lines for free, as a favour and as part of a community project. "
           "I will not be paid now or later, and I will not receive royalties.",
           "2. **What I allow.** The creator may use, edit and publish my recordings of the lines in this script (and any "
           "lines we agree later) in this game, its updates, its trailers and its promotion, including on the MIB-Hub "
           "website, for as long as the game is available. They will not be used for anything else.",
           "3. **No AI copies.** My recordings will not be used to train or create an artificial copy of my voice without "
           "my separate written permission.",
           "4. **Credit.** I will be credited by first name only, by the name I write below, or not at all if I choose "
           "\"anonymous\".",
           "5. **Changing my mind.** I can ask in writing to stop at any time. The creator will then stop any new use and "
           "remove my lines in the next update. Copies already released (for example a trailer someone has downloaded) "
           "cannot be called back." + likeness,
           ""]
    def blank(label: str, room: int = 68) -> str:
        """The label and a rule to write on. `room` is the width of both in underscores, so the rules end together."""
        wide = sum(0.5 if c in " il.,:;'()/tfjrI\"" else 1.25 if c in "mwMW" else 1.0 for c in label + ": ")
        return f"**{label}:** " + "_" * max(10, room - round(wide))

    for label in ("Full name", "Credit me as (first name, or \"anonymous\")", "Phone or email",
                  "Age 18 or over? (yes / no)", "If under 18, a parent or guardian signs here"):
        out += ["---", "", blank(label), ""]
    out += ["---", "", blank("Signature", 42) + " " + blank("Date", 25), "",
            "---", "", "### For the creator", "", "---", "",
            blank("Name", 23) + " " + blank("Signature", 26) + " " + blank("Date", 17), ""]
    return out


def slug(actor: str) -> str:
    if actor.startswith("crowd."):
        return "public_" + actor.split(".", 1)[1]
    return actor.split(".", 1)[-1].replace(".", "_") if not actor.startswith("special.") else actor.replace(".", "_")


def plan(story: list[Line], barks: list[Line], voices: dict[str, str]):
    """Decide which script every line goes into. Returns ({key: (title, ids, voice, story, barks)}, small parts)."""
    by_actor: dict[str, list[Line]] = defaultdict(list)
    for ln in story:
        by_actor[ln.who].append(ln)
    bark_by: dict[str, list[Line]] = defaultdict(list)
    for ln in barks:
        bark_by[ln.who].append(ln)
    scripts: dict[str, tuple[str, list[str], str, list[Line], list[Line]]] = {}
    # The two roommates record the roomie lines plus their own.
    for name, own in (("bature", "npc.bature"), ("firdausi", "npc.firdausi")):
        scripts[name] = (display(own), ["npc.roomie", own], voices.get(own, voices.get("npc.roomie", "")),
                         by_actor.get("npc.roomie", []) + by_actor.get(own, []),
                         bark_by.get("npc.roomie", []) + bark_by.get(own, []))
    small: list[Line] = []
    for a in sorted(set(by_actor) | set(bark_by)):
        if a in ("npc.roomie", "npc.bature", "npc.firdausi"):
            continue
        st, bk = by_actor.get(a, []), bark_by.get(a, [])
        if not bk and (a.startswith(("crowd.", "prop.")) or len(st) < MIN_DEDICATED):
            small += st
            continue
        scripts[slug(a)] = (display(a), [a], voices.get(a, ""), st, bk)
    return scripts, small


def build(write: bool = True, pdf: bool = False) -> int:
    errors: list[str] = []
    voices, barks = load_barks(errors)
    info = mission_info()
    titles = {n: t for n, (t, _) in info.items()}
    for ln in barks:
        try:
            plain_condition(ln.when, titles)
        except ValueError as e:
            errors.append(f"{ln.id}: {e}")
    if errors:
        print("\n".join(errors))
        print(f"{len(errors)} problem(s) in docs/voice/barks/")
        return 1
    if not write:
        print(f"Barks OK: {len(barks)} lines in {len(list(BARKS.glob('*.md')))} files.")
        return 0
    story = story_lines()
    scripts, small = plan(story, barks, voices)

    OUT.mkdir(parents=True, exist_ok=True)
    for old in list(OUT.glob("*.md")) + list(OUT.glob("*.lines.json")):
        old.unlink()
    rows, books = [], {}

    def emit(key: str, md: str, lines: dict, book_title: str):
        (OUT / f"{key}.md").write_text(md, encoding="utf-8")
        (OUT / f"{key}.lines.json").write_text(json.dumps(lines, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        books[key] = book_title

    for key, (title, ids, voice, st, bk) in scripts.items():
        md, lines = script_md(title, ids, voice, st, bk, info)
        emit(key, md, lines, f"{title}: Voice Script")
        n_st = sum(len(s["lines"]) for s in lines["sections"] if s["section"].startswith("Mission"))
        n_bk = sum(len(s["lines"]) for s in lines["sections"] if s["section"].startswith("Common"))
        rows.append((title, CHARACTERS.get(ids[-1], ("", ""))[1], n_st, n_bk))
    md, lines = small_parts_md(small, info)
    emit("small_parts", md, lines, "Small Parts: Voice Script")
    rows.append(("Small parts", f"{len(lines['sections'])} short roles in one script.",
                 sum(len(s["lines"]) for s in lines["sections"]), 0))
    real = sum(1 for ln in story if not PLACEHOLDER.match(ln.text))
    (OUT / "INDEX.md").write_text(index_md(rows, real, len(barks)), encoding="utf-8")
    books["INDEX"] = "The Cast: Voice Scripts"
    print(f"Wrote {len(rows)} scripts + INDEX.md to docs/voice/scripts/ ({len(story)} story lines, {len(barks)} barks).")

    if pdf:
        import md2pdf
        PDF_OUT.mkdir(parents=True, exist_ok=True)
        for old in PDF_OUT.glob("*.pdf"):
            if old.stem not in books:
                old.unlink()
        md2pdf.PLAN = OUT
        md2pdf.BOOKS = {k: ([k + ".md"], t, "docs/voice/pdf") for k, t in sorted(books.items())}
        for k in md2pdf.BOOKS:
            md2pdf.build(k)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="validate the bark packs only")
    ap.add_argument("--pdf", action="store_true", help="also build PDFs (needs reportlab)")
    a = ap.parse_args(argv)
    return build(write=not a.check, pdf=a.pdf)


if __name__ == "__main__":
    sys.exit(main())
