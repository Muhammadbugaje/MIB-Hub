"""Arcade game settings: cheat codes, per-game rules, the secret character and the cheats-on-leaderboards switch.

Defaults live in games/cheat_defaults/<slug>.json (see the README there). The owner's overrides live in
games.GameSettings (one row per game, plus the row with slug "*" for site-wide values). The play page only ever
receives sha256 hashes of cheat codes; the secret character's code is checked on the server (views.api_hero)."""
import hashlib
import json
import re
import secrets
from pathlib import Path

from django.contrib.auth.hashers import check_password, make_password

from .catalogue import BY_SLUG

DEFAULTS_DIR = Path(__file__).resolve().parent / "cheat_defaults"
GLOBAL = "*"
MIN_CODE = 4
PERM = "games.manage_game_settings"
HERO_DEFAULT = {"name": "M.I. BUGAJE", "full": "Muhammad Iliyasu Bugaje", "combo": "", "swipe": "", "powers": "", "shortcuts": "", "where": ""}
CHEAT_ACCESS = (("everyone", "Everyone who can play"), ("signed", "Signed-in accounts only (no guests)"), ("staff", "Staff and lecturers only"),
                ("named", "Only the people named below"))
HERO_ACCESS = (("code", "Anyone who knows the reveal move and the code"), ("signed", "Signed-in accounts with the code (no guests)"),
               ("staff", "Staff and lecturers with the code"), ("named", "Only the people named below, with the code"))
# Test-run shortcuts and powers for games whose defaults file does not describe them.
GUIDE_EXTRAS = {"samaru-days": {"shortcuts": "] opens the cheat menu (every cheat as a button). \\ skips the current mission step.",
                                "powers": "Cannot be hurt or arrested, never tires or gets hungry, fastest on foot and in every vehicle, "
                                          "every vehicle and the plane unlocked, unlimited money."}}
RULE_TYPES = ("int", "float", "bool", "choice")
_ID = re.compile(r"^[A-Za-z0-9_.-]{1,40}$")


def norm(code):
    """How a code is compared: lower-cased, all whitespace removed."""
    return "".join(str(code or "").lower().split())


def sha(slug, code):
    return hashlib.sha256((slug + ":" + norm(code)).encode("utf-8")).hexdigest()


def can_manage(user):
    from accounts.access import is_super_admin
    return bool(getattr(user, "is_authenticated", False) and (is_super_admin(user) or user.has_perm(PERM)))


# ---------- defaults (files) ----------
def _clean_rule(r):
    if not isinstance(r, dict) or not _ID.match(str(r.get("key", ""))) or r.get("type") not in RULE_TYPES:
        return None
    out = {"key": str(r["key"]), "label": str(r.get("label") or r["key"])[:80], "type": r["type"], "default": r.get("default")}
    if r["type"] in ("int", "float"):
        for k in ("min", "max"):
            if isinstance(r.get(k), (int, float)) and not isinstance(r.get(k), bool):
                out[k] = r[k]
    if r["type"] == "choice":
        out["choices"] = [str(c) for c in (r.get("choices") or []) if isinstance(c, (str, int, float))]
        if not out["choices"]:
            return None
    try:
        out["default"] = coerce(out, out["default"])
    except ValueError:
        return None
    if r.get("help"):
        out["help"] = str(r["help"])[:200]
    out["group"] = str(r.get("group") or "")[:60]
    return out


def defaults(slug):
    """{"cheats": [...], "hero": {...}, "rules": [...]} for a game; empty lists when the file is missing or broken."""
    out = {"cheats": [], "hero": dict(HERO_DEFAULT), "rules": []}
    if not _ID.match(slug or ""):
        return out
    try:
        raw = json.loads((DEFAULTS_DIR / f"{slug}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return out
    if not isinstance(raw, dict):
        return out
    seen = set()
    for c in raw.get("cheats") or []:
        if not isinstance(c, dict) or not _ID.match(str(c.get("id", ""))) or c["id"] in seen:
            continue
        seen.add(c["id"])
        out["cheats"].append({"id": str(c["id"]), "label": str(c.get("label") or c["id"])[:80], "typed": str(c.get("typed") or "")[:40],
                              "dial": str(c.get("dial") or "")[:40], "note": str(c.get("note") or "")[:200], "how": str(c.get("how") or "")[:200]})
    hero = raw.get("hero")
    if isinstance(hero, dict):
        for k in HERO_DEFAULT:
            if hero.get(k):
                out["hero"][k] = str(hero[k])[:400]
        if hero.get("code"):
            out["hero"]["code"] = str(hero["code"])[:80]  # a starter code shipped with the game; never sent to the page
    for k, v in GUIDE_EXTRAS.get(slug, {}).items():
        out["hero"][k] = out["hero"].get(k) or v
    seen = set()
    for r in raw.get("rules") or []:
        r = _clean_rule(r)
        if r and r["key"] not in seen:
            seen.add(r["key"])
            out["rules"].append(r)
    return out


def coerce(rule, value):
    """Turn a submitted value into the rule's type, or raise ValueError with a message for the form."""
    t = rule["type"]
    if t == "bool":
        if isinstance(value, str):
            return value.strip().lower() in ("1", "true", "on", "yes")
        return bool(value)
    if t == "choice":
        if str(value) not in rule["choices"]:
            raise ValueError(f"{rule['label']}: choose one of {', '.join(rule['choices'])}.")
        return str(value)
    try:
        n = int(str(value).strip()) if t == "int" else float(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError(f"{rule['label']}: enter a {'whole ' if t == 'int' else ''}number.")
    if n != n or n in (float("inf"), float("-inf")):
        raise ValueError(f"{rule['label']}: enter a number.")
    if "min" in rule and n < rule["min"]:
        raise ValueError(f"{rule['label']}: the smallest allowed value is {rule['min']}.")
    if "max" in rule and n > rule["max"]:
        raise ValueError(f"{rule['label']}: the largest allowed value is {rule['max']}.")
    return n


# ---------- stored overrides ----------
def _row(slug, create=False):
    from .models import GameSettings
    if create:
        return GameSettings.objects.get_or_create(slug=slug)[0]
    return GameSettings.objects.filter(slug=slug).first()


def _data(slug):
    row = _row(slug)
    return dict(row.data) if row and isinstance(row.data, dict) else {}


def global_settings():
    d = _data(GLOBAL)
    return {"cheats_on_boards": bool(d.get("cheats_on_boards", False)), "hero_enabled": bool(d.get("hero_enabled", True)),
            "hero_set": bool(d.get("hero_hash")), "cheats_enabled": bool(d.get("cheats_enabled", True)),
            "cheat_access": d.get("cheat_access") if d.get("cheat_access") in dict(CHEAT_ACCESS) else "everyone",
            "cheat_users": _ids(d.get("cheat_users")),
            "hero_access": d.get("hero_access") if d.get("hero_access") in dict(HERO_ACCESS) else "code",
            "hero_users": _ids(d.get("hero_users"))}


def _ids(v):
    return [int(x) for x in v if isinstance(x, int) and not isinstance(x, bool)] if isinstance(v, list) else []


def cheats_enabled(slug):
    """Cheat codes work in this game: the site-wide switch AND the game's own switch."""
    g = global_settings()
    return g["cheats_enabled"] and _flag(slug, "cheats_enabled", True)


def access(slug, kind):
    """(mode, [user ids]) for kind "cheat" or "hero": the game's own rule if it set one, else the site-wide rule."""
    d, g = _data(slug), global_settings()
    choices = dict(CHEAT_ACCESS if kind == "cheat" else HERO_ACCESS)
    if d.get(kind + "_access") in choices:
        return d[kind + "_access"], _ids(d.get(kind + "_users"))
    return g[kind + "_access"], g[kind + "_users"]


def allowed(slug, kind, request):
    """May this visitor use cheat codes (kind "cheat") or the secret character (kind "hero") in this game?"""
    mode, ids = access(slug, kind)
    if mode in ("everyone", "code"):
        return True
    user = getattr(request, "user", None)
    if not getattr(user, "is_authenticated", False):
        return False
    if mode == "signed":
        return True
    if mode == "staff":
        from .access import viewer
        from accounts.access import is_super_admin
        return bool(is_super_admin(user) or user.is_staff or viewer(request)[0] == "staff")
    return user.pk in ids


def users_from_text(text):
    """Turn a box of e-mail addresses (one per line or comma-separated) into (ids, unknown addresses)."""
    from django.contrib.auth import get_user_model
    U = get_user_model()
    ids, unknown = [], []
    for raw in re.split(r"[\s,;]+", text or ""):
        if not raw:
            continue
        u = U.objects.filter(email__iexact=raw).first()
        if u is None:
            unknown.append(raw)
        elif u.pk not in ids:
            ids.append(u.pk)
    return ids, unknown


def users_text(ids):
    from django.contrib.auth import get_user_model
    return "\n".join(get_user_model().objects.filter(pk__in=ids or []).order_by("email").values_list("email", flat=True))


def _flag(slug, key, fallback):
    v = _data(slug).get(key)
    return fallback if v is None else bool(v)


def cheats_on_boards(slug):
    return _flag(slug, "cheats_on_boards", global_settings()["cheats_on_boards"])


def hero_enabled(slug):
    return _flag(slug, "hero_enabled", global_settings()["hero_enabled"])


def game_enabled(slug):
    return _flag(slug, "enabled", True)


def cheats(slug):
    """The effective cheat list for a game: defaults with the owner's overrides applied (plain codes; staff only)."""
    over = _data(slug).get("cheats") or {}
    out = []
    for c in defaults(slug)["cheats"]:
        o = over.get(c["id"]) if isinstance(over.get(c["id"]), dict) else {}
        row = dict(c, default_typed=c["typed"], default_dial=c["dial"])
        if "typed" in o:
            row["typed"] = str(o["typed"])
        if "dial" in o:
            row["dial"] = str(o["dial"])
        if "how" in o:
            row["how"] = str(o["how"])
        row["on"] = not o.get("off")
        row["default_how"] = c["how"]
        row["how_text"] = row["how"] or how_default(row)
        row["changed"] = row["typed"] != c["typed"] or row["dial"] != c["dial"] or row["how"] != c["how"]
        out.append(row)
    return out


def how_default(c):
    parts = []
    if norm(c.get("typed")):
        parts.append("type it on the keyboard during play")
    if norm(c.get("dial")):
        parts.append("dial it on the in-game phone")
    parts.append("or enter it in Settings \u2192 Code box")
    text = ", ".join(parts)
    return text[:1].upper() + text[1:] + "."


def rules(slug):
    """The rule schema with each rule's current value."""
    over = _data(slug).get("rules") or {}
    out = []
    for r in defaults(slug)["rules"]:
        val = r["default"]
        if r["key"] in over:
            try:
                val = coerce(r, over[r["key"]])
            except ValueError:
                val = r["default"]
        out.append(dict(r, value=val, changed=val != r["default"]))
    return out


def page_config(slug, request=None):
    """What the play page receives in data-gm-config. No plain codes. Cheats that are switched off, or that this
    visitor may not use, are simply left out; with no `request` the access rules are not applied."""
    d = defaults(slug)
    hero_on = hero_enabled(slug) and (request is None or allowed(slug, "hero", request))
    cheats_on = cheats_enabled(slug) and (request is None or allowed(slug, "cheat", request))
    return {"cheats": [{"id": c["id"], "typed": sha(slug, c["typed"]) if norm(c["typed"]) else "",
                        "dial": sha(slug, c["dial"]) if norm(c["dial"]) else ""} for c in cheats(slug) if cheats_on and c["on"]],
            "cheatsEnabled": cheats_on,
            "cheatsOnBoards": cheats_on_boards(slug), "rules": {r["key"]: r["value"] for r in rules(slug)},
            "hero": {"enabled": hero_on, "name": d["hero"]["name"], "combo": d["hero"]["combo"] if hero_on else "",
                     "swipe": d["hero"]["swipe"] if hero_on else ""}}


def validate_cheats(slug, submitted):
    """`submitted` is {id: {"typed": str, "dial": str}}. Returns (clean overrides, errors)."""
    base = {c["id"]: c for c in defaults(slug)["cheats"]}
    errors, clean, seen = [], {}, {}
    for cid, c in base.items():
        s = submitted.get(cid) or {}
        typed = " ".join(str(s.get("typed", c["typed"])).split())[:40]
        dial = "".join(str(s.get("dial", c["dial"])).split())[:40]
        for kind, code in (("typed", typed), ("dial", dial)):
            n = norm(code)
            if not n:
                continue
            if len(n) < MIN_CODE:
                errors.append(f"{c['label']}: the {kind} code needs at least {MIN_CODE} characters.")
            if kind == "dial" and not re.fullmatch(r"[0-9*#]+", n):
                errors.append(f"{c['label']}: a dial code can only use digits, * and #.")
            if n in seen and seen[n] != cid:
                errors.append(f"{c['label']}: the code '{code}' is already used by {base[seen[n]]['label']}.")
            seen.setdefault(n, cid)
        if not norm(typed) and not norm(dial):
            errors.append(f"{c['label']}: give it a typed code or a dial code.")
        o = {}
        if typed != c["typed"]:
            o["typed"] = typed
        if dial != c["dial"]:
            o["dial"] = dial
        how = " ".join(str(s.get("how", c["how"])).split())[:200]
        if how != c["how"]:
            o["how"] = how
        if s.get("off"):
            o["off"] = True
        if o:
            clean[cid] = o
    return clean, errors


def update(slug, actor=None, note="", **changes):
    """Merge `changes` into a game's stored settings (None removes a key) and write one audit entry."""
    row = _row(slug, create=True)
    data = dict(row.data or {})
    diff = {}
    for k, v in changes.items():
        old = data.get(k)
        if v is None:
            data.pop(k, None)
        else:
            data[k] = v
        if old != v:
            diff[k] = ["(set)" if old else "(not set)", "(changed)" if v else "(cleared)"] if k in ("hero_hash", "cheats") else [old, v]
    if not diff:
        return row
    row.data = data
    row.save()
    try:
        from core import audit
        from core.models import AuditLogEntry
        audit.log(AuditLogEntry.UPDATE, row, actor=actor, changes=diff, note=note or "Arcade game settings changed")
    except Exception:  # the audit trail must never block saving a setting
        pass
    return row


# ---------- the secret character's code ----------
def new_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3))


def set_hero_code(slug, code, actor=None):
    update(slug, actor=actor, note="Secret character code changed", hero_hash=make_password(norm(code)) if code else None)


def ensure_hero_code(actor=None):
    """Create the site-wide code the first time the settings are opened. Returns the plain code once, else None."""
    if _data(GLOBAL).get("hero_hash"):
        return None
    code = new_code()
    set_hero_code(GLOBAL, code, actor=actor)
    return code


# Stand-in codes for local development only. They are never accepted when settings.DEBUG is False, nor once any
# real code (site-wide or for the game) has been set, nor after the starter is retired in Arcade Management.
DEBUG_STARTERS = {"samaru-days": "Iliyasu#1"}


def starter_code(slug):
    """The stand-in code still accepted for a game on a local development copy, or None."""
    from django.conf import settings
    if not settings.DEBUG:
        return None
    d = _data(slug)
    code = defaults(slug)["hero"].get("code") or DEBUG_STARTERS.get(slug)
    if not code or d.get("hero_hash") or d.get("starter_off") or _data(GLOBAL).get("hero_hash"):
        return None
    return code


def check_hero(slug, code, request=None):
    if slug not in BY_SLUG or not hero_enabled(slug) or (request is not None and not allowed(slug, "hero", request)):
        return False
    stored = _data(slug).get("hero_hash") or _data(GLOBAL).get("hero_hash")
    ok = False
    if stored:
        ok = check_password(norm(code), stored)
    else:
        make_password("x")  # spend comparable time whether or not a code exists
    starter = starter_code(slug)
    if starter and secrets.compare_digest(norm(starter).encode(), norm(code).encode()):
        ok = True
    return ok
