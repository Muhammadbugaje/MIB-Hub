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
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "story"))
import check_missions as cm  # noqa: E402

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
    "player": "The Player (every playable fresher)", "npc.roomie": "{{ROOMIE}} (Bature and Firdausi)",
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


def display(actor: str) -> str:
    if actor in NAMES:
        return NAMES[actor]
    base = actor.split(".", 1)[-1]
    return " ".join(w.capitalize() for w in base.split("_"))


def story_lines() -> list[Line]:
    out: list[Line] = []
    seen: set[str] = set()
    for f in cm.YEAR_FILES:
        for m in cm.parse_file(f):
            tag = f"M{m.num:03d} {m.title}"
            for c in m.cutscenes:
                prev = ""
                for e in c.entries:
                    if e["key"] != "say":
                        continue
                    who = re.search(r"who: *([A-Z_0-9]+)", e["body"]).group(1)
                    actor = c.cast.get(who) or c.cast.get(who + "?") or who
                    sid = re.search(r"id: *(\w+)", e["body"]).group(1)
                    text = cm.unescape((re.search(r'text: *"(.*)", *mood', e["body"]) or [None, ""])[1])
                    mood = (re.search(r"mood: *([a-z_]+)", e["body"]) or [None, ""])[1]
                    if sid not in seen:
                        out.append(Line(sid, actor, mood, text, f"{tag} · {c.id}", prev))
                        seen.add(sid)
                    prev = f"{display(actor)}: {text}"
            sc = m.sections.get("**Special characters.**", "")
            for sid, letter, text in re.findall(r"`(m\d{3}_[a-z0-9]+_([a-z])\d{2})` *[\"“]([^\"”]*)", sc):
                if sid in seen or letter not in SPECIAL_BY_PREFIX:
                    continue
                out.append(Line(sid, SPECIAL_BY_PREFIX[letter], "neutral", text, f"{tag} · gameplay"))
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


def esc(s: str) -> str:
    return s.replace("|", "\\|")


def script_md(title: str, actor_ids: list[str], voice: str, story: list[Line], barks: list[Line]) -> str:
    out = [f"# Voice script: {title}", "",
           f"**Cast id:** {', '.join(f'`{a}`' for a in actor_ids)} · **Story lines:** {len(story)} · "
           f"**Barks and filler:** {len(barks)} · **Total:** {len(story) + len(barks)}", ""]
    if voice:
        out += [f"**Voice:** {voice}", ""]
    out += [GUIDE, ""]
    if story:
        out += ["## 1. Story lines (in story order)", ""]
        mission = None
        for ln in story:
            ms = ln.where.split(" · ")[0]
            if ms != mission:
                out += ["", f"### {ms}", "", "| Id | Mood | Cue | Line |", "|---|---|---|---|"]
                mission = ms
            out.append(f"| `{ln.id}` | {ln.mood} | {esc(ln.cue) or '—'} | {esc(ln.text)} |")
        out.append("")
    if barks:
        out += ["## 2. Barks, filler and replies", "",
                "These are said in the open world, not in cutscenes: greetings, replies in choice wheels, reactions, "
                "and lines that change with the year and the calendar.", ""]
        stage = None
        for ln in barks:
            st, cat = ln.where.split(" · ")
            if st != stage:
                out += ["", f"### {st}", "", "| Id | Kind | Mood | Line | When |", "|---|---|---|---|---|"]
                stage = st
            out.append(f"| `{ln.id}` | {cat} | {ln.mood} | {esc(ln.text)} | {esc(ln.when) or '—'} |")
        out.append("")
    special = any(x.startswith("special.") for x in actor_ids)
    out += agreement(title, special)
    return "\n".join(out)


GUIDE = """## How to use this script

Thank you for lending your voice to the game. This guide takes ten minutes to read and saves hours later.

**1. Set up (once).**
- Find the quietest room you have. A wardrobe full of clothes, or a small room with curtains and a bed, is better than a big empty room: soft things stop echo.
- Switch off fans, air conditioning and the TV. Put your phone on silent (if you record on it, use aeroplane mode).
- Use a phone voice-recorder app or a microphone. Choose the highest quality it offers (WAV if possible, 48 kHz).
- Hold the phone or microphone about 20 cm (one hand-span) from your mouth, a little to the side so your breath does not hit it. Keep the same distance for every line.

**2. Read the table.**
- **Id:** the line's name. Name your file with it, for example `m002_open_01.wav` or `bk_jega_f_greet_01.wav`.
- **Mood:** how to say it. *warm* friendly, *amused* smiling, *dry* deadpan, *stern* firm, *sharp* quick and pointed, *shy* soft and hesitant, *proud* chest out, *scared* tense, *sad* low, *excited* fast and bright, *bored* flat, *whisper* quiet but clear, *neutral* your normal voice.
- **Cue:** the line said just before yours, so you know the moment. Do not record the cue.
- **Words in [square brackets]** are the English translation. Do not say them.
- `{{PLAYER_NAME}}` means the player's name: leave a short natural pause there instead of a name. `{{ROOMIE}}` is the roommate's name: say "Bature" for one take and "Firdausi" for another, or pause.
- **Barks** (section 2) are short lines heard in the open world. Say them as if someone just walked past you.

**3. Record.**
- Say each line **three times**, with a one-second silence before and after each take. We pick the best.
- If you stumble, just say the line again. Do not stop the recording to delete it.
- Drink water, take breaks every 20 minutes, and stop if your voice gets tired. Shouting lines last.
- If a line does not sound like you, or a phrase in another language is wrong, write your version down. Every line is a draft and we change it for you.

**4. Send it back.**
- Put all your files in one folder named with your name and character (for example `Amina_Jega`).
- Send the folder, with the signed agreement on the last page, to the person who gave you this script (a Google Drive or WeTransfer link is easiest).
- Ask anything at any time. There is no deadline pressure: a few lines a day is perfect.
"""


def agreement(character: str, special: bool) -> list[str]:
    likeness = ("\n6. **My likeness.** My character's look is inspired by me with my permission. My voice and likeness are "
                "used **only** for my own character, never for anyone else. I approve my character's lines and look, and "
                "I can ask for any line or look to be changed.") if special else ""
    return ["", "# Volunteer voice agreement", "",
            f"**Game:** the open-world game on MIB-Hub, created by Muhammad Iliyasu Bugaje (\"the creator\"). **Character:** {character}.",
            "",
            "Please read this, fill in the boxes, sign, and send a photo or scan of this page back with your recordings. "
            "If anything is unclear, ask before you sign.",
            "",
            "1. **I am volunteering.** I am recording these lines for free, as a favour and as part of a community project. "
            "I will not be paid now or later, and I will not receive royalties.",
            "2. **What I allow.** The creator may use, edit and publish my recordings of the lines in this script (and any "
            "lines we agree later) in the game, its updates, trailers, the MIB-Hub website and its promotion, anywhere in "
            "the world, for as long as the game is available.",
            "3. **No AI copies.** My recordings will not be used to train or create an artificial copy of my voice without "
            "my separate written permission.",
            "4. **Credit.** I will be credited in the game and on the website by the name I write below (or not at all, "
            "if I choose anonymous).",
            "5. **Changing my mind.** I can ask in writing to stop at any time. The creator will then stop any new use and "
            "remove my lines in the next update. Copies that have already been released (for example a trailer someone "
            "downloaded) cannot be called back." + likeness,
            "",
            "| | |", "|---|---|",
            "| Full name | |", "| Credit me as (or \"anonymous\") | |", "| Phone or email | |",
            "| Age 18 or over? (yes / no) | |", "| Signature | |", "| Date | |",
            "| If under 18: parent or guardian's name, signature and date | |",
            "| For the creator: name, signature and date | Muhammad Iliyasu Bugaje |",
            ""]


def slug(actor: str) -> str:
    return actor.split(".", 1)[-1].replace(".", "_") if not actor.startswith("special.") else actor.replace(".", "_")


def build(write: bool = True, pdf: bool = False) -> int:
    errors: list[str] = []
    voices, barks = load_barks(errors)
    if errors:
        print("\n".join(errors))
        print(f"{len(errors)} problem(s) in docs/voice/barks/")
        return 1
    if not write:
        print(f"Barks OK: {len(barks)} lines in {len(list(BARKS.glob('*.md')))} files.")
        return 0
    story = story_lines()
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
    actors = set(by_actor) | set(bark_by)
    for a in sorted(actors):
        if a in ("npc.roomie", "npc.bature", "npc.firdausi"):
            continue
        st, bk = by_actor.get(a, []), bark_by.get(a, [])
        if a.startswith(("crowd.", "prop.")) or (len(st) < MIN_DEDICATED and not bk):
            small += st + bk
            continue
        scripts[slug(a)] = (display(a), [a], voices.get(a, ""), st, bk)
    small.sort(key=lambda ln: (display(ln.who), ln.id))

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.md"):
        old.unlink()
    index = ["# Voice scripts: casting index", "",
             "Generated by `tools/voice/build_voice_scripts.py` from the mission scripts and `docs/voice/barks/`. "
             "Do not edit the scripts by hand: edit the missions or the bark packs and rebuild.", "",
             "| Script | Character | Story lines | Barks | Total |", "|---|---|---|---|---|"]
    rows = []
    for key, (title, ids, voice, st, bk) in scripts.items():
        (OUT / f"{key}.md").write_text(script_md(title, ids, voice, st, bk), encoding="utf-8")
        rows.append((len(st) + len(bk), f"| `{key}.md` | {title} | {len(st)} | {len(bk)} | {len(st) + len(bk)} |"))
    # small parts and crowds: one script, grouped by speaker
    sp = ["# Voice script: small parts, crowds and the public", "",
          "Short roles, grouped by speaker. One actor can voice several of these, but never a special character's "
          "lines (those are locked to the real person).", "", GUIDE]
    who = None
    for ln in small:
        if ln.who != who:
            sp += ["", f"## {display(ln.who)} (`{ln.who}`)", "", "| Id | Where | Mood | Line |", "|---|---|---|---|"]
            who = ln.who
        sp.append(f"| `{ln.id}` | {esc(ln.where)} | {ln.mood} | {esc(ln.text)} |")
    sp += agreement("small parts and crowd voices (the speakers you were asked to voice)", False)
    (OUT / "small_parts.md").write_text("\n".join(sp) + "\n", encoding="utf-8")
    rows.append((len(small), f"| `small_parts.md` | Small parts, crowds and public | — | — | {len(small)} |"))
    index += [r for _, r in sorted(rows, reverse=True)]
    index += ["", f"**Total:** {len(story)} story lines and {len(barks)} barks in {len(rows)} scripts."]
    (OUT / "INDEX.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} scripts + INDEX.md to docs/voice/scripts/ ({len(story)} story lines, {len(barks)} barks).")

    if pdf:
        sys.path.insert(0, str(ROOT / "tools" / "story"))
        import md2pdf
        PDF_OUT.mkdir(parents=True, exist_ok=True)
        md2pdf.PLAN = OUT
        md2pdf.BOOKS = {p.stem: ([p.name], "Voice Script: " + p.stem.replace("_", " ").title(), "docs/voice/pdf")
                        for p in sorted(OUT.glob("*.md"))}
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
