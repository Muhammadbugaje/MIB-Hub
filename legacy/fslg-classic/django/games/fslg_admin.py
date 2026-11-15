"""Freshers School Life (FSLG): what the super admin can change for every player without touching code
(docs/MASTER_GAME_GUIDE.md §5 config, §5.4 super admin, §7 credits; docs/story/ENGINE.md §16).

- **Game config**: name, short name, initials (auto from the name, or a 1–6 character override), tagline, colours,
  currency name. The game resolves {{GAME_NAME}}, {{GAME_INITIALS}}, {{TAGLINE}}, {{CURRENCY}}, {{PLAYER_NAME}} with it.
- **Characters**: per person, only the fields that differ from the game's data (identity, looks, attitude, voice,
  edited lines). Deleting the row brings the defaults back.
- **Credits**: sections with entries; an entry reaches players only when it is visible *and* approved (consent).

Approach (§5.4 option 1, backend-authenticated): only accounts.access.is_super_admin may write; any player of the arcade
may read the one small bundle the game fetches at start-up (/arcade/api/fslg/). Every save is validated here (schema,
sizes, safe text, tokens), writes an FSLGContentVersion (history, rollback) and an audit entry with the old and new values.
Text is stored as plain text: tags are removed, and every page and the game escape it on display."""
import json
import re
import unicodedata
from functools import wraps

from django.db import transaction
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from accounts.access import is_super_admin

from .access import current_guest
from .models import FSLGContent, FSLGContentVersion

SCHEMA = 1
SLUG = "samaru-days"


class Invalid(ValueError):
    pass


# ---------- defaults: static/js/games/fslg.config.js is the one place the default name is written (§5.2) ----------
def _load_defaults():
    from pathlib import Path
    p = Path(__file__).resolve().parent.parent / "static" / "js" / "games" / "fslg.config.js"
    try:
        line = next(ln for ln in p.read_text(encoding="utf-8").splitlines() if ln.startswith('{"gameName"'))
        d = json.loads(line)
    except (OSError, StopIteration, ValueError):
        d = {}
    base = {"gameName": "Campus Life", "gameShortName": "Game", "initialsOverride": "", "tagline": "", "author": "",
            "primaryColour": "#f59e0b", "secondaryColour": "#0f766e", "currencyName": "naira", "currencySymbol": ""}
    base.update({k: v for k, v in d.items() if k in base})
    return base


DEFAULT_CONFIG = _load_defaults()
CONFIG_FIELDS = {
    "gameName": (1, 60), "gameShortName": (1, 12), "initialsOverride": (0, 6), "tagline": (0, 120), "author": (0, 80),
    "primaryColour": "colour", "secondaryColour": "colour", "currencyName": (1, 20), "currencySymbol": (0, 3),
}
TOKENS = {"GAME_NAME", "GAME_SHORT", "GAME_INITIALS", "TAGLINE", "CURRENCY", "PLAYER_NAME", "AUTHOR"}
TOKEN_RE = re.compile(r"\{\{([A-Z_]+)(?:\|(upper|lower))?\}\}")
COLOUR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
ID_RE = re.compile(r"^[a-z0-9_]{1,40}$")
PLACE_RE = re.compile(r"^@?[a-z0-9_]{1,24}$")
WORN_RE = re.compile(r"^[a-z0-9]{1,20}\.\d{1,2}$")
LINE_KEY_RE = re.compile(r"^v[0-9a-f]{8}[0-9a-z]{1,4}$")

HAIRS = ("low", "fade", "bald", "waves", "afro", "afrobig", "coily", "cornrows", "twists", "braidshort", "braids", "locs", "bun",
         "ponytail", "puff", "cap", "hijab")
MODES = ("tee", "kaftan", "ankara", "jersey", "coat")
SLOTS = ("head", "eye", "top", "bottom", "one", "outer", "shoes")
PRESETS = ("friendly", "grumpy", "funny", "shy", "serious", "flirty", "calm", "loud", "wise", "proud")
MOODS = ("cheerful", "relaxed", "tired", "stressed", "moody", "excited")
REACT_BUMP = ("", "shrug", "complain", "shove", "flee")
REACT_HIT = ("", "flee", "hit_back", "stand_up")
REACT_HONK = ("", "jump", "shout", "ignore")
TONES = ("natural", "deep", "warm", "bright")
VOICE_ROLES = ("", "player_m", "player_f", "bature_m", "firdausi_f", "bolaji_m", "men_a", "men_b", "men_c", "women_a", "women_b",
               "lecturer_m", "staff_f", "staff_m", "traders_m", "traders_f", "dj", "crowd", "maker_m")
BARK_KINDS = ("bump", "hit", "honk", "flee", "fight", "yield")
TALKS = ("", "dreams", "books", "football", "music", "exams", "gossip")

MAX_CHAR_BYTES = 96 * 1024
MAX_CREDIT_BYTES = 256 * 1024
MAX_LINES = 800
MAX_SECTIONS = 30
MAX_ENTRIES = 1000
MAX_HISTORY = 50


# ---------- text ----------
_TAG_RE = re.compile(r"<[^>]{0,200}>")


def clean_text(value, limit, field="Text", required=False, multiline=False):
    """Plain, safe text: no control characters, no tags, no angle brackets, trimmed, within `limit` characters."""
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise Invalid(f"{field} must be text.")
    s = unicodedata.normalize("NFC", value)
    s = "".join(ch for ch in s if ch in ("\n",) and multiline or unicodedata.category(ch)[0] != "C")
    s = _TAG_RE.sub("", s).replace("<", "").replace(">", "")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s).strip() if multiline else re.sub(r"\s+", " ", s).strip()
    if required and not s:
        raise Invalid(f"{field} cannot be empty.")
    if len(s) > limit:
        raise Invalid(f"{field} is {len(s)} characters; the limit is {limit}.")
    return s


def tokens_in(text):
    return {m.group(1) for m in TOKEN_RE.finditer(text or "")}


def check_tokens(text, field="Text"):
    """Every {{TOKEN}} must be known, and no stray braces or unbalanced brackets may remain."""
    for m in TOKEN_RE.finditer(text):
        if m.group(1) not in TOKENS:
            raise Invalid(f"{field}: unknown token {{{{{m.group(1)}}}}}. Known: " + ", ".join("{{%s}}" % t for t in sorted(TOKENS)) + ".")
    rest = TOKEN_RE.sub("", text)
    if "{" in rest or "}" in rest:
        raise Invalid(f"{field}: a token is broken. Write it exactly like {{{{PLAYER_NAME}}}}.")
    depth = {"(": 0, "[": 0}
    pairs = {")": "(", "]": "["}
    for ch in rest:
        if ch in depth:
            depth[ch] += 1
        elif ch in pairs:
            depth[pairs[ch]] -= 1
            if depth[pairs[ch]] < 0:
                raise Invalid(f"{field}: a closing bracket '{ch}' has no opening one.")
    if any(depth.values()):
        raise Invalid(f"{field}: a bracket is opened and never closed.")
    return text


def initials_of(name):
    """First letter of each word, in capitals, at most 6: "Freshers School Life Game" -> "FSLG"."""
    words = re.findall(r"[^\W\d_]+|\d+", name or "")
    return "".join(w[0] for w in words).upper()[:6] or "G"


def _colour(v, field):
    if not isinstance(v, str) or not COLOUR_RE.match(v):
        raise Invalid(f"{field} must be a colour like #f59e0b.")
    return v.lower()


def _num(v, lo, hi, field):
    try:
        f = float(v)
    except (TypeError, ValueError):
        raise Invalid(f"{field} must be a number.")
    if not (lo <= f <= hi):
        raise Invalid(f"{field} must be between {lo} and {hi}.")
    return round(f, 3)


def _enum(v, allowed, field):
    v = "" if v is None else v
    if v not in allowed:
        raise Invalid(f"{field}: '{str(v)[:20]}' is not one of the choices.")
    return v


def _bool(v):
    return None if v is None else bool(v)


def _obj(v, field):
    if v is None:
        return {}
    if not isinstance(v, dict):
        raise Invalid(f"{field} must be an object.")
    return v


def _list(v, field, most):
    if v is None:
        return []
    if not isinstance(v, list):
        raise Invalid(f"{field} must be a list.")
    if len(v) > most:
        raise Invalid(f"{field}: at most {most}.")
    return v


def _unknown(d, allowed, field):
    extra = set(d) - set(allowed)
    if extra:
        raise Invalid(f"{field}: unknown field(s) " + ", ".join(sorted(extra)[:5]) + ".")


def _size(data, limit, what):
    n = len(json.dumps(data, ensure_ascii=False).encode("utf-8"))
    if n > limit:
        raise Invalid(f"{what} is {n // 1024} KB; the limit is {limit // 1024} KB.")


# ---------- config ----------
def validate_config(d):
    d = _obj(d, "Config")
    _unknown(d, list(CONFIG_FIELDS) + ["initials", "configVersion"], "Config")
    out = {}
    for k, rule in CONFIG_FIELDS.items():
        v = d.get(k, DEFAULT_CONFIG.get(k, ""))
        if rule == "colour":
            out[k] = _colour(v, k)
            continue
        lo, hi = rule
        out[k] = check_tokens(clean_text(v, hi, k, required=lo > 0), k) if k == "tagline" else clean_text(v, hi, k, required=lo > 0)
        if k != "tagline" and TOKEN_RE.search(out[k]):
            raise Invalid(f"{k} cannot contain tokens.")
    io = out["initialsOverride"]
    if io and not re.match(r"^[A-Za-z0-9]{1,6}$", io):
        raise Invalid("Initials must be 1 to 6 letters or digits (or empty to use the automatic ones).")
    out["initialsOverride"] = io.upper()
    return out


def config():
    """The live config: defaults, then the saved row, plus computed initials and the version."""
    row = FSLGContent.objects.filter(kind="config", key="").first()
    c = dict(DEFAULT_CONFIG)
    if row and isinstance(row.data, dict):
        c.update({k: v for k, v in row.data.items() if k in CONFIG_FIELDS})
    c["initials"] = initials_of(c["gameName"])
    c["configVersion"] = row.version if row else 0
    return c


def shown_initials(c=None):
    c = c or config()
    return c.get("initialsOverride") or c.get("initials") or "G"


def game_title():
    try:
        return config()["gameName"]
    except Exception:  # the table may not exist yet (migrations), or the DB is down: the default keeps pages working
        return DEFAULT_CONFIG["gameName"]


def short_name():
    try:
        c = config()
        return (c.get("gameShortName") or shown_initials(c))[:12]
    except Exception:
        return DEFAULT_CONFIG["gameShortName"]


# ---------- credits ----------
ENTRY_FIELDS = ("id", "name", "role", "note", "link", "characterName", "order", "visible", "approved")


def _link(v):
    v = clean_text(v, 200, "Link")
    if v and not re.match(r"^https?://[^\s\"']+$", v):
        raise Invalid("A link must start with http:// or https://.")
    return v


def validate_credits(d):
    d = _obj(d, "Credits")
    _unknown(d, ["sections", "outro"], "Credits")
    out = {"sections": [], "outro": check_tokens(clean_text(d.get("outro"), 200, "Closing line"), "Closing line")}
    total, seen_ids = 0, set()
    for i, s in enumerate(_list(d.get("sections"), "Sections", MAX_SECTIONS)):
        s = _obj(s, "Section")
        _unknown(s, ["id", "title", "order", "visible", "entries"], "Section")
        sid = str(s.get("id") or f"s{i + 1}")[:24]
        if not re.match(r"^[a-z0-9_-]{1,24}$", sid) or sid in seen_ids:
            sid = f"s{i + 1}x"
        seen_ids.add(sid)
        sec = {"id": sid, "title": clean_text(s.get("title"), 60, f"Section {i + 1} title", required=True),
               "order": int(_num(s.get("order", i), -9999, 9999, "Order")), "visible": s.get("visible", True) is not False, "entries": []}
        for j, e in enumerate(_list(s.get("entries"), f"Entries in {sec['title']}", MAX_ENTRIES)):
            e = _obj(e, "Entry")
            _unknown(e, ENTRY_FIELDS, "Entry")
            where = f"{sec['title']}, entry {j + 1}"
            sec["entries"].append({
                "id": str(e.get("id") or f"{sid}-{j + 1}")[:32], "name": clean_text(e.get("name"), 80, where + " name", required=True),
                "role": clean_text(e.get("role"), 120, where + " role"), "note": clean_text(e.get("note"), 200, where + " note"),
                "link": _link(e.get("link")), "characterName": clean_text(e.get("characterName"), 60, where + " character"),
                "order": int(_num(e.get("order", j), -99999, 99999, "Order")), "visible": e.get("visible", True) is not False,
                "approved": e.get("approved") is True})
            total += 1
        if total > MAX_ENTRIES:
            raise Invalid(f"At most {MAX_ENTRIES} credit entries in all.")
        out["sections"].append(sec)
    _size(out, MAX_CREDIT_BYTES, "The credits")
    return out


def credit_warnings(c):
    """Duplicates and empty fields, for the editor (not errors: a person may have several roles)."""
    warn, names = [], {}
    for s in c.get("sections", []):
        if not s["entries"]:
            warn.append(f"Section '{s['title']}' has no entries.")
        for e in s["entries"]:
            key = (s["id"], e["name"].lower(), e["role"].lower())
            names[key] = names.get(key, 0) + 1
            if not e["role"]:
                warn.append(f"{e['name']} ({s['title']}) has no role.")
    for (sid, n, r), k in names.items():
        if k > 1:
            warn.append(f"'{n}' appears {k} times with the same role in one section.")
    return warn


def _seed_credits():
    friends = [  # docs/story/02_BIBLE.md §21: characters carry the owner's friends' first names; voice roles in docs/voice
        ("Ahmad", "Ahmad", "men_b"), ("Jega", "Jega", "men_c"), ("Mubarak", "Mubarak", "men_a"), ("Maryam", "Maryam", "women_b"),
        ("Firdausi", "Firdausi", "firdausi_f"), ("Lyzzy", "Lyzzy", "women_a"), ("Lily", "Lily", "women_b"), ("Joy", "Joy", "women_a"),
        ("Muktar", "Muktar", "men_a"), ("Sadiya", "Comrade Sadiya", "women_b"), ("Amina", "Amina", "women_a"), ("Fatima", "Fatima", "women_a"),
        ("Aisha", "Aisha", "women_b"), ("Muhammad", "Muhammad", "men_b"), ("Ibrahim", "Ibrahim", "men_a"), ("Hassan", "Hassan", "bolaji_m"),
        ("Abbas", "Abbas", "men_b"), ("Abdul", "AB", "men_c"), ("Auwal", "Ustaz Auwal", "lecturer_m"), ("Aminu", "Aminu", "crowd"),
        ("Asiya", "Aunty Asiya", "traders_f"), ("Khadija", "Dr. Khadija", "staff_f"), ("Bilkisu", "Sgt. Bilkisu", "staff_f"),
        ("Micheal", "Micheal", "men_a"), ("Clemantine", "Clemantine", "traders_f"), ("Svitlana", "Svitlana", "women_b"),
        ("Jasmin", "Jasmin", "women_b"), ("Shamsu", "Shamsu", "men_a"), ("Aliyu", "Engr. Aliyu", "staff_m"), ("Sugar", "DJ Sugar", "dj"),
        ("Basit", "Basit", "men_c"), ("Lucky", "Lucky", "men_c"), ("Bolaji", "Bolaji", "bolaji_m")]
    voice = [{"id": f"v{i + 1}", "name": n, "role": f"Voice of {ch} (role to confirm: {r})", "note": "",
              "link": "", "characterName": ch, "order": i, "visible": True, "approved": False} for i, (n, ch, r) in enumerate(friends)]
    return {"outro": "Thank you for playing {{GAME_NAME}}.", "sections": [
        {"id": "created", "title": "Created by", "order": 0, "visible": True, "entries": [
            {"id": "mib", "name": "M.I. BUGAJE", "role": "Game design, code, story and direction", "note": "Muhammad Iliyasu Bugaje",
             "link": "", "characterName": "The Maker", "order": 0, "visible": True, "approved": True}]},
        {"id": "voices", "title": "Voice cast", "order": 1, "visible": True, "entries": voice},
        {"id": "thanks", "title": "Special thanks", "order": 2, "visible": True, "entries": []}]}


DEFAULT_CREDITS = _seed_credits()


def credits(all_entries=False):
    row = FSLGContent.objects.filter(kind="credits", key="").first()
    c = row.data if row and isinstance(row.data, dict) and row.data.get("sections") is not None else DEFAULT_CREDITS
    c = json.loads(json.dumps(c))
    c["version"] = row.version if row else 0
    if not all_entries:  # players see only what is visible and approved (consent, §7.3)
        secs = []
        for s in c["sections"]:
            if s.get("visible") is False:
                continue
            ents = [e for e in s["entries"] if e.get("visible") is not False and e.get("approved") is True]
            for e in ents:
                e.pop("approved", None), e.pop("visible", None)
            if ents:
                secs.append(dict(s, entries=sorted(ents, key=lambda e: e.get("order", 0))))
        c["sections"] = sorted(secs, key=lambda s: s.get("order", 0))
    return c


# ---------- characters ----------
CHAR_FIELDS = ("name", "nick", "role", "bio", "look", "att", "barks", "voice", "lines", "base")


def validate_character(key, d):
    if not ID_RE.match(key or ""):
        raise Invalid("Unknown character.")
    d = _obj(d, "Character")
    _unknown(d, CHAR_FIELDS, "Character")
    out = {}
    if "name" in d:
        out["name"] = clean_text(d["name"], 40, "Display name", required=True)
    if "nick" in d:
        out["nick"] = [n for n in (clean_text(x, 24, "Nickname") for x in _list(d["nick"], "Nicknames", 4)) if n]
    if "role" in d:
        out["role"] = clean_text(d["role"], 60, "Role")
    if "bio" in d:
        out["bio"] = clean_text(d["bio"], 400, "Short bio", multiline=True)
    if "look" in d:
        lk, o = _obj(d["look"], "Looks"), {}
        _unknown(lk, ("skin", "hair", "hairCol", "top", "mode", "fit", "acc", "beard", "brow", "eyes", "scale"), "Looks")
        for k in ("skin", "hairCol", "top"):
            if lk.get(k):
                o[k] = _colour(lk[k], {"skin": "Skin tone", "hairCol": "Hair colour", "top": "Main colour"}[k])
        if lk.get("hair"):
            o["hair"] = _enum(lk["hair"], HAIRS, "Hair style")
        if lk.get("mode"):
            o["mode"] = _enum(lk["mode"], MODES, "Outfit style")
        for k, allowed in (("beard", ("", "moustache", "goatee", "full")), ("brow", ("", "flat", "arch", "thick")), ("eyes", ("", "round", "wide", "calm"))):
            if lk.get(k):
                o[k] = _enum(lk[k], allowed, k)
        fit = _obj(lk.get("fit"), "Wardrobe")
        _unknown(fit, SLOTS, "Wardrobe")
        fit = {k: v for k, v in fit.items() if v}
        for k, v in fit.items():
            if not isinstance(v, str) or not WORN_RE.match(v):
                raise Invalid(f"Wardrobe {k}: not a wardrobe item.")
        if fit:
            o["fit"] = fit
        acc = [a for a in _list(lk.get("acc"), "Accessories", 3) if a]
        for a in acc:
            if not isinstance(a, str) or not WORN_RE.match(a):
                raise Invalid("Accessories: not a wardrobe item.")
        if acc:
            o["acc"] = acc
        if lk.get("scale") not in (None, "", 1, 1.0):
            o["scale"] = _num(lk["scale"], .85, 1.2, "Height")
        out["look"] = o
    if "att" in d:
        a, o = _obj(d["att"], "Attitude"), {}
        _unknown(a, ("preset", "mood", "bump", "hit", "honk", "speed", "friend", "romance", "routine", "likes", "dislikes", "hateTopic"), "Attitude")
        for k, allowed in (("preset", ("",) + PRESETS), ("mood", ("",) + MOODS), ("bump", REACT_BUMP), ("hit", REACT_HIT), ("honk", REACT_HONK), ("hateTopic", TALKS)):
            if a.get(k):
                o[k] = _enum(a[k], allowed, k)
        if a.get("speed") not in (None, "", 1, 1.0):
            o["speed"] = _num(a["speed"], .6, 1.6, "Walk speed")
        for k in ("friend", "romance"):  # romance is a yes/no: the game lets only the opposite sex date them (owner's rule)
            if a.get(k) is not None:
                o[k] = _bool(a[k])
        rt = []
        for r in _list(a.get("routine"), "Daily routine", 8):
            if not isinstance(r, list) or len(r) != 2 or not isinstance(r[0], str) or not PLACE_RE.match(r[0]):
                raise Invalid("Daily routine: each stop is a place and an hour.")
            rt.append([r[0], _num(r[1], 0, 23.75, "Routine hour")])
        if rt:
            o["routine"] = sorted(rt, key=lambda r: r[1])
        for k in ("likes", "dislikes"):
            items = [x for x in _list(a.get(k), "Gifts", 6) if x]
            for x in items:
                if not isinstance(x, str) or not re.match(r"^[a-z0-9_]{1,24}$", x):
                    raise Invalid("Gifts: not an item.")
            if items:
                o[k] = items
        out["att"] = o
    if "barks" in d:
        b, o = _obj(d["barks"], "Reactions"), {}
        _unknown(b, BARK_KINDS, "Reactions")
        for k in BARK_KINDS:
            ls = [check_tokens(clean_text(x, 120, f"{k} line"), f"{k} line") for x in _list(b.get(k), f"{k} lines", 4)]
            ls = [x for x in ls if x]
            if ls:
                o[k] = ls
        out["barks"] = o
    if "voice" in d:
        v, o = _obj(d["voice"], "Voice"), {}
        _unknown(v, ("sex", "pitch", "tone", "role"), "Voice")
        if v.get("sex"):
            o["sex"] = _enum(v["sex"], ("male", "female"), "Voice")
        if v.get("pitch") not in (None, ""):
            o["pitch"] = _num(v["pitch"], .5, 1.6, "Pitch")
        if v.get("tone"):
            o["tone"] = _enum(v["tone"], TONES, "Tone")
        if v.get("role"):
            o["role"] = _enum(v["role"], VOICE_ROLES, "Voice role")
        out["voice"] = o
    if "lines" in d:
        ls = _obj(d["lines"], "Lines")
        if len(ls) > MAX_LINES:
            raise Invalid(f"At most {MAX_LINES} edited lines per character.")
        o = {}
        for k, v in ls.items():
            if not LINE_KEY_RE.match(k):
                raise Invalid("A line id is not valid.")
            v = _obj(v, "Line")
            _unknown(v, ("t", "o", "g"), "Line")
            orig = clean_text(v.get("o"), 400, "Original line")
            text = check_tokens(clean_text(v.get("t"), 400, "Line", required=True), "Line")
            missing = tokens_in(orig) - tokens_in(text)
            if missing:
                raise Invalid("The original line uses " + ", ".join("{{%s}}" % t for t in sorted(missing)) + "; keep it in your version.")
            if text != orig:
                o[k] = {"t": text, "o": orig, "g": clean_text(v.get("g"), 80, "Line group")}
        out["lines"] = o
    if "base" in d:  # what the editor saw as the default (for the change log only)
        b = _obj(d["base"], "Base")
        out["base"] = {"name": clean_text(b.get("name"), 60, "Base name"), "sex": _enum(b.get("sex") or "", ("", "male", "female"), "Base sex")}
    out = {k: v for k, v in out.items() if v not in ({}, [], "")} if out else {}
    _size(out, MAX_CHAR_BYTES, "This character's changes")
    return out


def characters():
    return {r.key: r.data for r in FSLGContent.objects.filter(kind="character") if r.data}


# ---------- saving, history, rollback ----------
VALIDATE = {"config": lambda k, d: validate_config(d), "credits": lambda k, d: validate_credits(d), "character": validate_character}


def _key_ok(kind, key):
    if kind not in VALIDATE:
        raise Invalid("Unknown kind.")
    if kind == "character":
        if not ID_RE.match(key or ""):
            raise Invalid("Unknown character.")
        return key
    return ""


def _diff(old, new, path="", out=None, limit=60):
    out = {} if out is None else out
    if len(out) >= limit:
        return out
    if isinstance(old, dict) and isinstance(new, dict):
        for k in sorted(set(old) | set(new)):
            _diff(old.get(k), new.get(k), f"{path}.{k}" if path else str(k), out, limit)
    elif old != new:
        short = lambda v: v if isinstance(v, (int, float, bool)) or v is None else v[:300] if isinstance(v, str) else json.dumps(v, ensure_ascii=False)[:300]
        out[path or "*"] = [short(old), short(new)]
    return out


def _audit(row, actor, changes, note):
    try:
        from core import audit as A
        from core.models import AuditLogEntry
        A.log(AuditLogEntry.UPDATE, row, actor=actor, changes=changes, note=note[:255])
    except Exception:
        pass


def rev():
    """One number that changes whenever anything here changes (the bundle's version)."""
    last = FSLGContentVersion.objects.order_by("-id").values_list("id", flat=True).first()
    return int(last or 0)


def save(kind, key, data, actor, note=""):
    key = _key_ok(kind, key)
    clean = VALIDATE[kind](key, data)
    with transaction.atomic():
        row = FSLGContent.objects.select_for_update().filter(kind=kind, key=key).first()
        old = row.data if row else {}
        if row is None:
            row = FSLGContent(kind=kind, key=key, version=0)
        row.version += 1
        row.data, row.updated_by = clean, actor
        row.save()
        FSLGContentVersion.objects.create(kind=kind, key=key, version=row.version, data=clean, note=clean_text(note, 200, "Note") or "Saved", by=actor)
        _trim(kind, key)
    what = {"config": "game config", "credits": "credits"}.get(kind, f"character {key}")
    _audit(row, actor, _diff(old, clean), f"FSLG {what} saved (v{row.version})" + (f": {note}" if note else ""))
    return row


def reset(kind, key, actor):
    """Back to the game's defaults (the row's data becomes {}; history keeps what it was)."""
    key = _key_ok(kind, key)
    with transaction.atomic():
        row = FSLGContent.objects.select_for_update().filter(kind=kind, key=key).first()
        if row is None:
            return None
        old = row.data
        row.version += 1
        row.data, row.updated_by = {}, actor
        row.save()
        FSLGContentVersion.objects.create(kind=kind, key=key, version=row.version, data={}, note="Reset to defaults", by=actor)
    _audit(row, actor, _diff(old, {}), f"FSLG {kind} {key} reset to defaults (v{row.version})".replace("  ", " "))
    return row


def rollback(kind, key, version, actor):
    key = _key_ok(kind, key)
    old = FSLGContentVersion.objects.filter(kind=kind, key=key, version=int(version)).first()
    if old is None:
        raise Invalid("That version does not exist.")
    if not old.data:
        return reset(kind, key, actor)
    return save(kind, key, old.data, actor, note=f"Rolled back to version {old.version}")


def _trim(kind, key):
    ids = list(FSLGContentVersion.objects.filter(kind=kind, key=key).values_list("id", flat=True)[MAX_HISTORY:])
    if ids:
        FSLGContentVersion.objects.filter(id__in=ids).delete()


def _who(user):
    if user is None:
        return "—"
    return (getattr(user, "get_full_name", lambda: "")() or "") or getattr(user, "email", "") or str(user)


def history(kind, key):
    key = _key_ok(kind, key)
    return [{"version": h.version, "note": h.note, "by": _who(h.by), "at": timezone.localtime(h.created).strftime("%d %b %Y %H:%M"),
             "data": h.data} for h in FSLGContentVersion.objects.filter(kind=kind, key=key).select_related("by")[:MAX_HISTORY]]


def bundle(all_entries=False):
    """Everything the game applies at start-up, in one small versioned JSON."""
    return {"schema": SCHEMA, "v": rev(), "config": config(), "credits": credits(all_entries), "characters": characters()}


# ---------- HTTP ----------
def _player(request):
    return request.user.is_authenticated or current_guest(request) is not None


def _err(msg, status=400):
    return JsonResponse({"error": msg}, status=status)


def super_admin_page(view):
    @wraps(view)
    def wrapped(request, *a, **k):
        if not is_super_admin(request.user):
            raise Http404()
        resp = view(request, *a, **k)
        resp["Cache-Control"] = "no-store"
        return resp
    return wrapped


@require_GET
def api_bundle(request):
    """GET /arcade/api/fslg/ — players read the bundle (ETag = its version, so an unchanged copy costs one 304)."""
    if not _player(request):
        return _err("Sign in to play.", 403)
    sup = is_super_admin(request.user)
    v = rev()
    etag = f'"fslg-{SCHEMA}-{v}-{int(sup)}"'
    if request.headers.get("If-None-Match") == etag:
        resp = HttpResponse(status=304)
    else:
        data = bundle(all_entries=sup and request.GET.get("all") == "1")
        data["can_edit"] = sup
        resp = JsonResponse(data, json_dumps_params={"ensure_ascii": False, "separators": (",", ":")})
    resp["ETag"] = etag
    resp["Cache-Control"] = "private, no-cache"
    return resp


def _body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise Invalid("The request is not valid JSON.")


@require_POST
def api_save(request):
    """POST {kind, key, data, note} — super admin only."""
    if not is_super_admin(request.user):
        return _err("Only a super admin can change the game for everyone.", 403)
    if len(request.body) > 400 * 1024:
        return _err("That is too much to save at once.", 413)
    try:
        b = _body(request)
        row = save(b.get("kind"), b.get("key") or "", b.get("data"), request.user, b.get("note") or "")
    except Invalid as e:
        return _err(str(e))
    out = {"ok": True, "version": row.version, "v": rev(), "data": row.data}
    if row.kind == "credits":
        out["warnings"] = credit_warnings(row.data)
    if row.kind == "config":
        out["config"] = config()
    return JsonResponse(out)


@require_POST
def api_reset(request):
    if not is_super_admin(request.user):
        return _err("Only a super admin can change the game for everyone.", 403)
    try:
        b = _body(request)
        row = reset(b.get("kind"), b.get("key") or "", request.user)
    except Invalid as e:
        return _err(str(e))
    return JsonResponse({"ok": True, "version": row.version if row else 0, "v": rev()})


@require_POST
def api_rollback(request):
    if not is_super_admin(request.user):
        return _err("Only a super admin can change the game for everyone.", 403)
    try:
        b = _body(request)
        row = rollback(b.get("kind"), b.get("key") or "", b.get("version"), request.user)
    except (Invalid, TypeError, ValueError) as e:
        return _err(str(e) or "That version does not exist.")
    return JsonResponse({"ok": True, "version": row.version if row else 0, "v": rev(), "data": row.data if row else {}})


@require_GET
def api_history(request):
    if not is_super_admin(request.user):
        return _err("Only a super admin can see the change history.", 403)
    try:
        return JsonResponse({"history": history(request.GET.get("kind"), request.GET.get("key") or "")})
    except Invalid as e:
        return _err(str(e))


# ---------- the pages (Arcade Management → FSLG) ----------
# The editors load the game's own data files, so they list exactly the people and lines the game has.
DATA_SCRIPTS = ["fslg-map", "samaru-sim", "samaru-data", "fslg.config", "fslg-story-y1", "fslg-story-y2", "fslg-story-y3", "fslg-story-y4", "fslg-story-y5",
                "fslg-story-side", "fslg-story-coop", "samaru-draw", "samaru-core", "samaru-story", "samaru-overrides", "samaru-wardrobe", "samaru-anim"]


def _page(request, template, at, **extra):
    from django.templatetags.static import static
    ctx = {"at": at, "sup": True, "api": "/arcade/api/fslg/", "three": static("vendor/three@0.158.0/build/three.module.min.js"),
           "scripts": DATA_SCRIPTS, "cfg": config(), "limits": {"lines": MAX_LINES}, **extra}
    return render(request, template, ctx)


@super_admin_page
def page_characters(request):
    return _page(request, "games/fslg_characters.html", "fslg_chars", voice_roles=[r for r in VOICE_ROLES if r], presets=PRESETS, moods=MOODS)


@super_admin_page
def page_config(request):
    return _page(request, "games/fslg_config.html", "fslg_config", defaults=json.dumps(DEFAULT_CONFIG, ensure_ascii=False))


@super_admin_page
def page_credits(request):
    return _page(request, "games/fslg_credits.html", "fslg_credits")
