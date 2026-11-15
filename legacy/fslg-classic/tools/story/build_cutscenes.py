"""Build the cutscene data files from the screenplay blocks in the mission scripts.

    python tools/story/build_cutscenes.py                 # writes static/js/games/fslg-cutscenes-*.js + docs/story/CUTSCENE_LIST.md
    python tools/story/build_cutscenes.py --check FILE…   # parses only, prints problems, writes nothing (exit 1 on problems)

Format: docs/story/CUTSCENE_FORMAT.md. A block is "#### cut_<id> — title", one or two "- Key: value · Key: value" header lines,
then "> directions" and "- SPEAKER: line [v: ]". The output is data only, played by static/js/games/samaru-cutscene.js.
build_y1.py imports blocks()/hooks() from here to put cutsceneBefore/After/OnEnter on the Year 1 steps.
"""
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_y1 as Y  # noqa: E402  (speaker and place tables, the character sheets)

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "docs/story/scripts"
OUTDIR = ROOT / "static/js/games"
SOURCES = [("y1", ["Y1.md", "Y1b.md"]), ("y2", ["Y2.md"]), ("y3", ["Y3.md"]), ("y4", ["Y4.md"]), ("y5", ["Y5.md"]), ("side", ["SIDE.md"]),
           ("world", ["CUTSCENES.md"])]
TYPES = {"brief", "result", "full", "entry", "vehicle", "event", "ambient", "finale"}
HEAD_KEYS = {"type", "hook", "trigger", "stage", "cast", "extras", "end", "once", "lock", "needs", "mission", "max"}
POSES = {"waves": "wave", "cheers": "cheer", "slumps": "sad", "dances": "dance", "sits": "sit", "stands": "stand", "points": "point", "nods": "nod",
         "shakes head": "no", "shrugs": "shrug", "salutes": "salute", "claps": "clap", "thinks": "think", "laughs": "laugh", "gasps": "gasp",
         "bows": "bow", "facepalms": "facepalm", "phones": "phone", "hands on hips": "hips", "hugs": "hug"}
SHOTS = {"wide", "two", "close", "over", "low", "high", "orbit", "follow", "place"}
NEED_ROLE = {"close", "over", "low", "follow"}
EVENTS = {"blackout", "lightback", "rain", "morning", "night", "swim", "levelup"}
VEHS = {"skate", "bike", "scooter", "okada", "keke", "car", "sport", "plane", "bus", "taxi"}
SFX = {"power", "special", "coin", "lose", "whistle", "click", "horn"}
GENERIC = re.compile(r"^(FRIEND_[1-3]|LECTURER|GIVER)$")
PLACES = set(Y.PLACES) | {"damcentre", "@hostel", "@dept", "@home", "@hostelshop"}
_known = None


def known():
    global _known
    if _known is None:
        _known = set(Y.people(Y.SHEETS.read_text(encoding="utf8"))) | {"porter", "bola"}
    return _known


def role_of(name, ctx, problems, speaking=False):
    """A script name → the id the Director casts: me, FRIEND_1, @roomie, an npc id, or a bodiless voice (phone:mum, radio:kabiru, crowd:x)."""
    raw = name.strip()
    w = re.sub(r"\(.*?\)", "", raw).strip()
    if w.upper() == "PLAYER":
        return "me"
    if GENERIC.match(w.upper().replace(" ", "_")):
        return w.upper().replace(" ", "_")
    before = len(Y.issues)
    r = Y.npc_of(raw, known(), ctx)
    del Y.issues[before:]
    if r.startswith("@"):
        return r.lower()
    if r.startswith("crowd:") and not speaking:
        problems.append(f"{ctx}: nobody called '{raw}' (use a name from the scripts, PLAYER, @ROOMIE or FRIEND_1)")
    return r


def place_of(word, ctx, problems):
    w = word.strip().lower()
    if w in PLACES:
        return "@home" if w == "@hostel" else w
    before = len(Y.issues)
    p = Y.place_of(word, ctx)
    if len(Y.issues) > before:
        del Y.issues[before:]
        problems.append(f"{ctx}: place '{word}' is not on the map")
    return p


def say_secs(text):
    return max(2.0, min(7.5, 1.3 + len(text) / 15.0))


def direction(d, ctx, problems):
    """One direction → a list of timeline ops."""
    d = d.strip().rstrip(".")
    if not d:
        return []
    low = d.lower()
    m = re.match(r"^shot (\w+)(?:\s+(.*))?$", d)
    if m:
        kind, arg = m.group(1).lower(), (m.group(2) or "").strip()
        if kind not in SHOTS:
            problems.append(f"{ctx}: unknown shot '{kind}'")
            return []
        if kind == "place":
            return [["shot", "place", place_of(arg, ctx, problems)]]
        if kind in NEED_ROLE and not arg:
            problems.append(f"{ctx}: 'shot {kind}' needs a person")
            return []
        return [["shot", kind, role_of(arg, ctx, problems) if arg else None]]
    if low in ("push in", "pull out"):
        return [["move", "push" if low == "push in" else "pull"]]
    m = re.match(r"^pan to (.*)$", d)
    if m:
        a = m.group(1).strip()
        return [["pan", place_of(a, ctx, problems) if a.lower() in PLACES or a == a.lower() else role_of(a, ctx, problems)]]
    if low == "shake":
        return [["shake"]]
    m = re.match(r"^caption (.*)$", d)
    if m:
        return [["cap", m.group(1).strip()]]
    m = re.match(r'^title "([^"]*)"(?:\s+"([^"]*)")?$', d)
    if m:
        return [["title", m.group(1), m.group(2) or ""]]
    if low in ("fade out", "fade in"):
        return [["fade", low.split()[1]]]
    m = re.match(r"^wait ([\d.]+)s?$", low)
    if m:
        return [["wait", min(8.0, float(m.group(1)))]]
    m = re.match(r"^sfx (\w+)$", low)
    if m:
        if m.group(1) not in SFX:
            problems.append(f"{ctx}: unknown sfx '{m.group(1)}'")
        return [["sfx", m.group(1)]]
    m = re.match(r"^music (\w+)$", d)
    if m:
        return [["music", m.group(1)]]
    m = re.match(r"^world (night|day)$", low)
    if m:
        return [["world", "time", 21 * 60 if m.group(1) == "night" else 10 * 60]]
    m = re.match(r"^world time (\d{1,2}):(\d\d)$", low)
    if m:
        return [["world", "time", int(m.group(1)) * 60 + int(m.group(2))]]
    m = re.match(r"^world (blackout|rain) (on|off)$", low)
    if m:
        return [["world", m.group(1), m.group(2) == "on"]]
    m = re.match(r"^extras (cheer|gasp|wave|dance)s?$", low)
    if m:
        return [["extras", {"cheer": "cheer", "gasp": "gasp", "wave": "wave", "dance": "dance"}[m.group(1)]]]
    # people: ROLE verb [target]
    verbs = ["walks to", "runs to", "faces", "enters", "exits"] + sorted(POSES, key=len, reverse=True)
    for v in verbs:
        m = re.match(r"^(.+?)\s+" + re.escape(v) + r"(?:\s+(.*))?$", d)
        if not m or not re.match(r"^[A-Z@]", m.group(1)) or m.group(1) != m.group(1).upper():
            continue
        who, arg = role_of(m.group(1), ctx, problems), (m.group(2) or "").strip()
        if v in ("walks to", "runs to", "faces"):
            if not arg:
                problems.append(f"{ctx}: '{d}' needs a target")
                return []
            tgt = arg.lower() if arg.lower() in ("centre", "center", "camera") else role_of(arg, ctx, problems)
            tgt = "centre" if tgt == "center" else tgt
            return [["face", who, tgt]] if v == "faces" else [["walk", who, tgt, v == "runs to"]]
        if v == "enters":
            return [["enter", who]]
        if v == "exits":
            return [["exit", who]]
        op = ["do", who, POSES[v]]
        if v == "hugs" and arg:
            op.append(role_of(arg, ctx, problems))
        return [op]
    problems.append(f"{ctx}: direction not understood: '{d}'")
    return []


def header(lines, cid, mid, problems):
    h = {}
    for ln in lines:
        for part in re.split(r"\s+·\s+", ln[2:].strip()):
            k, _, v = part.partition(":")
            k = k.strip().lower()
            if k not in HEAD_KEYS:
                problems.append(f"{cid}: unknown header key '{k}'")
                continue
            h[k] = v.strip()
    c = {"id": cid, "type": (h.get("type") or "full").lower()}
    if c["type"] not in TYPES:
        problems.append(f"{cid}: unknown type '{c['type']}'")
        c["type"] = "full"
    mid = h.get("mission") or mid
    hook = (h.get("hook") or "").lower()
    if hook:
        if not mid:
            problems.append(f"{cid}: a hook needs a mission section")
        m = re.match(r"^(before|after|enter) (beat|step) (\d+)$", hook)
        if hook == "brief":
            c["attach"] = {"mission": mid, "when": "before", "step": "first"}
        elif hook == "result":
            c["attach"] = {"mission": mid, "when": "after", "step": "last"}
        elif m:
            c["attach"] = {"mission": mid, "when": m.group(1), m.group(2): int(m.group(3))}
        else:
            problems.append(f"{cid}: hook '{hook}' not understood")
    if mid:
        c["mission"] = mid
    trg = (h.get("trigger") or "").lower()
    if trg:
        t = trg.split()
        if t[0] == "go" and len(t) == 2:
            c["trigger"] = {"on": {"t": "go", "place": place_of(t[1], cid, problems)}}
        elif t[0] == "ride" and len(t) == 2 and t[1] in VEHS:
            c["trigger"] = {"on": {"t": "ride", "veh": t[1]}}
        elif t[0] == "event" and len(t) == 2 and t[1] in EVENTS:
            c["trigger"] = {"event": t[1]}
        elif t[0] == "near" and len(t) in (2, 3):
            c["trigger"] = {"near": [place_of(t[1], cid, problems), float(t[2]) if len(t) == 3 else 25.0]}
        else:
            problems.append(f"{cid}: trigger '{trg}' not understood")
    if not hook and not trg:
        problems.append(f"{cid}: needs a Hook or a Trigger")
    st = (h.get("stage") or "here").strip()
    sm = re.match(r"^(here|at|cutaway)(?:\s+(.+))?$", st, re.I)
    if not sm or (sm.group(1).lower() != "here" and not sm.group(2)):
        problems.append(f"{cid}: stage '{st}' not understood")
        c["stage"] = {"mode": "here"}
    else:
        c["stage"] = {"mode": sm.group(1).lower()}
        if sm.group(2):
            c["stage"]["place"] = place_of(sm.group(2), cid, problems)
    cast, optional = {}, []
    for pair in [p for p in re.split(r",\s*", h.get("cast") or "") if p.strip()]:
        k, _, v = pair.partition("=")
        k = k.strip().upper().replace(" ", "_")
        if not GENERIC.match(k):
            problems.append(f"{cid}: Cast is only for FRIEND_1–3, LECTURER and GIVER (got '{k}')")
            continue
        cands = [x.strip() for x in v.split("|") if x.strip()]
        if "?" in cands or not cands:
            optional.append(k)
        cast[k] = [role_of(x, cid, problems) for x in cands if x != "?"]
    if cast:
        c["cast"] = cast
    if optional:
        c["optional"] = optional
    if h.get("extras"):
        c["extras"] = max(0, min(10, int(re.sub(r"\D", "", h["extras"]) or 0)))
    end = {"player": "stay"}
    for i, part in enumerate([p.strip() for p in (h.get("end") or "stays").split(";") if p.strip()]):
        pl = part.lower()
        if pl in ("stays", "stay"):
            end["player"] = "stay"
        elif pl == "at mark":
            end["player"] = "mark"
        elif pl.startswith("at "):
            end["player"] = {"place": place_of(part[3:], cid, problems)}
        elif pl.startswith("faces "):
            end["face"] = role_of(part[6:], cid, problems)
        elif pl.startswith("sets "):
            end["flags"] = re.findall(r"[a-z0-9_]+", pl[5:])
        elif re.match(r"^time \d{1,2}:\d\d$", pl):
            hh, mm = pl[5:].split(":")
            end["time"] = int(hh) * 60 + int(mm)
        else:
            problems.append(f"{cid}: End part '{part}' not understood")
    c["endState"] = end
    c["skippable"] = True
    c["playOnce"] = (h.get("once") or "yes").lower() != "no"
    lock = (h.get("lock") or "").lower()
    c["lock"] = (lock == "yes") if lock else c["type"] != "ambient"
    needs = {}
    for part in [p.strip().lower() for p in re.split(r"[;,]", h.get("needs") or "") if p.strip()]:
        if part in ("companion", "day", "night"):
            needs[part] = True
        elif part.startswith("flag "):
            needs.setdefault("flags", []).append(part[5:].strip())
        elif part.startswith("noflag "):
            needs.setdefault("notFlags", []).append(part[7:].strip())
        else:
            problems.append(f"{cid}: Needs part '{part}' not understood")
    if needs:
        c["needs"] = needs
    if h.get("max"):
        c["maxDuration"] = int(re.sub(r"\D", "", h["max"]) or 40)
    return c


def blocks(text, src="", problems=None):
    """Every cutscene block in a script file → cutscene dicts (in file order)."""
    problems = problems if problems is not None else []
    out, mid = [], None
    parts = re.split(r"^(#{2,4} .*)$", text, flags=re.M)
    for i in range(1, len(parts), 2):
        head, body = parts[i], parts[i + 1]
        mm = re.match(r"^### ([ms]\d+) — ", head)
        if mm:
            mid = mm.group(1)
            continue
        cm = re.match(r"^#### (cut_[a-z0-9_]+) — (.*)$", head)
        if not cm:
            if head.startswith("## ") or (head.startswith("### ") and not mm):
                mid = None
            if head.startswith("#### cut"):
                problems.append(f"{src}: bad cutscene heading '{head}' (use '#### cut_name — Title')")
            continue
        cid, title = cm.group(1), cm.group(2).strip()
        body = re.split(r"^---\s*$", body, flags=re.M)[0]
        lines = [ln.rstrip() for ln in body.splitlines() if ln.strip()]
        hl = []
        while lines and re.match(r"^- (\w+):", lines[0]) and lines[0][2:].split(":")[0].strip().lower() in HEAD_KEYS and "[v:" not in lines[0]:
            hl.append(lines.pop(0))
        c = header(hl, cid, mid, problems)
        c["title"] = title
        c["src"] = src
        tl, est, spoken = [], 0.0, 0
        for ln in lines:
            if ln.startswith(">"):
                for d in ln[1:].split(";"):
                    for op in direction(d, cid, problems):
                        tl.append(op)
                        est += op[1] if op[0] == "wait" else say_secs(op[1]) if op[0] == "cap" else {"fade": .5, "title": 3.2, "enter": 1.2}.get(op[0], 0)
                continue
            m = re.match(r"^\s*-\s+([A-Z@][A-Za-z0-9@_ .'\-]*(?:\([^)]*\))?):\s+(.*?)\s*\[v:\s*\]\s*$", ln)
            if m:
                who, said = m.group(1).strip(), m.group(2).strip()
                if len(said) > 90:
                    problems.append(f"{cid}: line over 90 characters ({len(said)}): {said[:40]}…")
                tl.append(["say", role_of(who, cid, problems, speaking=True), said])
                est += say_secs(said)
                spoken += 1
                continue
            problems.append(f"{cid}: line not understood: {ln.strip()[:70]}")
        if not tl:
            problems.append(f"{cid}: empty cutscene")
        if c["lock"] and est > 45 and c["type"] != "finale":
            problems.append(f"{cid}: about {est:.0f} s long; keep cutscenes to 10–40 s")
        c["tl"] = tl
        c["est"] = round(est + 1.5, 1)
        c.setdefault("maxDuration", int(math.ceil(est * 1.6 + 10)))
        out.append(c)
    return out


def strip(text):
    """The script text without its cutscene blocks (for parsers that read beats and lines)."""
    return re.sub(r"^#### cut_[\s\S]*?(?=^#{2,4} |^---\s*$|\Z)", "", text, flags=re.M)


def hooks(text):
    """{mission: [(when, 'first'|'last'|beat number, cutscene id)]} for the blocks hooked with 'beat' (Year 1)."""
    out = {}
    for c in blocks(text):
        a = c.get("attach")
        if a and ("beat" in a or a.get("step") in ("first", "last")):
            out.setdefault(a["mission"], []).append((a["when"], a.get("beat", a.get("step")), c["id"]))
    return out


def main(argv):
    check = "--check" in argv
    files = [a for a in argv if not a.startswith("--")]
    problems, total, listing = [], 0, []
    ids = {}
    for name, srcs in SOURCES:
        cuts = []
        for s in srcs:
            p = SCRIPTS / s
            if files and not any(Path(f).name == s for f in files):
                continue
            if not p.exists():
                continue
            cuts += blocks(p.read_text(encoding="utf8"), s, problems)
        for c in cuts:
            if c["id"] in ids:
                problems.append(f"{c['id']}: defined twice ({ids[c['id']]} and {c['src']})")
            ids[c["id"]] = c["src"]
        total += len(cuts)
        listing += cuts
        if check or files or not cuts:
            continue
        js = ("/* Freshers School Life — cutscenes (" + name + "), generated by tools/story/build_cutscenes.py from docs/story/scripts/" + ", ".join(srcs) + ".\n"
              "   Do not edit by hand: edit the script blocks (docs/story/CUTSCENE_FORMAT.md) and re-run. Data only. */\n"
              "(function () {\n  \"use strict\";\n  var D = window.SamaruData; D.CUTSCENES = D.CUTSCENES || [];\n  D.CUTSCENES.push(" + json.dumps({"file": name, "cuts": cuts}, ensure_ascii=False, indent=0) + ");\n})();\n")
        (OUTDIR / f"fslg-cutscenes-{name}.js").write_text(js, encoding="utf8")
    if not check and not files:
        rows = ["# Cutscene list", "", "Generated by `tools/story/build_cutscenes.py`. " + str(total) + " cutscenes.", "",
                "| id | title | type | mission / trigger | stage | lines | about (s) | script |", "|---|---|---|---|---|---|---|---|"]
        for c in listing:
            a, t = c.get("attach"), c.get("trigger")
            where = (a["mission"] + " " + a["when"] + " " + str(a.get("beat", a.get("step")))) if a else json.dumps(t, ensure_ascii=False)
            rows.append(f"| `{c['id']}` | {c['title']} | {c['type']} | {where} | {c['stage']['mode']} {c['stage'].get('place', '')} | {sum(1 for o in c['tl'] if o[0] == 'say')} | {c['est']} | {c['src']} |")
        (ROOT / "docs/story/CUTSCENE_LIST.md").write_text("\n".join(rows) + "\n", encoding="utf8")
    print(f"cutscenes {total}, problems {len(problems)}" + (" (check only)" if check or files else ""))
    for p in problems:
        print("  -", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
