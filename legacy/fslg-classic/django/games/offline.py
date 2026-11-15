"""Offline packages: what a browser must keep to play one arcade game with no network.

The play page offers "Download for offline". The browser asks for /arcade/api/package/<slug>/ (this module), then
fetches the play page itself plus every file listed here into a Cache Storage cache named "ee-arcade-<slug>". The
site's service worker (static/sw.js) answers from that cache when the network is gone, and serves pictures, sounds
and content-hashed scripts straight from it even when online, which is what takes load off the server.

`version` is a hash of every listed file's bytes (and of the play-page template), so any change to the game shows
"Update available" on devices that downloaded an older copy. Nothing personal is in the package; the play page
copy is stored separately and refreshed whenever the player opens the game online.
"""
import hashlib
import json
import re
from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles import finders
from django.templatetags.static import static
from django.urls import reverse

from . import bundle
from .catalogue import BY_SLUG, GAMES

# Files every game page loads (see templates/games/play.html), plus the offline helpers themselves.
COMMON = ("css/games.css", "js/games/arcade.js", "js/games/arcade-settings.js", "js/games/arcade-audio.js", "js/games/arcade-sounds.js", "js/games/arcade-offline.js")
LAN = ("js/games/arcade-lan.js", "vendor/qrcode-generator@1.4.4/qrcode.js")
THREE = "vendor/three@0.158.0/build/three.module.min.js"
SFX_DIR = "audio/sfx/"
VOICE_DIR = "audio/voice/"
# Games whose multiplayer can run over a local Wi-Fi with no internet (WebRTC, static/js/games/arcade-lan.js).
LAN_GAMES = {"samaru-days"}
_URL_RE = re.compile(r"""url\(\s*['"]?([^'")]+?)['"]?\s*\)""")
_cache = {}


def _path(rel):
    p = finders.find(rel)
    return Path(p) if p else None


def _css_refs(rel):
    """Relative url(...) references inside a stylesheet (fonts, images), as static paths."""
    p = _path(rel)
    if not p or not rel.endswith(".css"):
        return []
    base = rel.rsplit("/", 1)[0] + "/" if "/" in rel else ""
    out = []
    for ref in _URL_RE.findall(p.read_text(encoding="utf-8", errors="ignore")):
        ref = ref.split("#")[0].split("?")[0]
        if not ref or ref.startswith(("data:", "http:", "https:", "//", "/")):
            continue
        parts = []
        for seg in (base + ref).split("/"):
            if seg == "..":
                if parts:
                    parts.pop()
            elif seg and seg != ".":
                parts.append(seg)
        out.append("/".join(parts))
    return out


_STATIC_TAG = re.compile(r"""{%\s*static\s+['"]([^'"]+)['"]\s*%}""")
_INCLUDE_TAG = re.compile(r"""{%\s*(?:include|extends|optional_include)\s+['"]([^'"]+)['"]""")
PAGE_TEMPLATES = ("games/play.html", "games/base_app.html", "games/base_guest.html")


def _template_file(name):
    from django.template.loader import get_template
    try:
        origin = get_template(name).origin.name
        return Path(origin) if origin else None
    except Exception:
        return None


def _inclusion_tags():
    """{tag name: template} for every inclusion tag in the project (a page can pull in files through one)."""
    if "incl" in _cache:
        return _cache["incl"]
    out = {}
    pat = re.compile(r"""@register\.inclusion_tag\(\s*['"]([^'"]+)['"][^)]*\)\s*\ndef\s+(\w+)""")
    for p in Path(settings.BASE_DIR).glob("*/templatetags/*.py"):
        for tpl, fn in pat.findall(p.read_text(encoding="utf-8", errors="ignore")):
            out[fn] = tpl
    _cache["incl"] = out
    return out


def template_statics(names=PAGE_TEMPLATES):
    """Every {% static %} path in the given templates and everything they include or extend, recursively: the files
    the play page itself loads (the site's layout, fonts, icons, sidebar pictures)."""
    seen, out, todo = set(), [], list(names)
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        p = _template_file(name)
        if not p:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        out += [r for r in _STATIC_TAG.findall(text) if r not in out]
        todo += [n for n in _INCLUDE_TAG.findall(text) if n not in seen]
        incl = _inclusion_tags()
        todo += [incl[t] for t in re.findall(r"{%\s*(\w+)", text) if t in incl and incl[t] not in seen]
    return out


def _shell():
    out = []
    try:
        from core.views_pwa import shell_assets
        out = list(shell_assets())
    except Exception:  # the site shell is a nice-to-have; the game runs without it
        pass
    return out + [r for r in template_statics() if r not in out and r != "sw.js"]


ASSET_DIR = Path(__file__).resolve().parent / "offline_assets"


def declared_assets(game):
    """Files a game loads by itself (data, images, extra sounds), declared in the catalogue (extra["assets"]) or in
    games/offline_assets/<slug>.txt, one static path per line. A path ending in "/" takes every file in that folder."""
    names = list(game.extra.get("assets", []))
    f = ASSET_DIR / (game.slug + ".txt")
    if f.exists():
        names += [l.strip() for l in f.read_text(encoding="utf-8").splitlines() if l.strip() and not l.lstrip().startswith("#")]
    out = []
    for rel in names:
        rel = rel.lstrip("/")
        if rel.startswith("static/"):
            rel = rel[len("static/"):]
        if rel.endswith("/"):
            base = None
            for d in settings.STATICFILES_DIRS:
                if (Path(d) / rel).is_dir():
                    base = Path(d)
                    break
            if base:
                out += sorted(str(p.relative_to(base)).replace("\\", "/") for p in (base / rel).rglob("*") if p.is_file() and not p.name.startswith("."))
        else:
            out.append(rel)
    return out


def _sfx(slug):
    """Sound stems this game can play (shared core set + its own pack), the core ones, and the manifest itself."""
    p = _path(SFX_DIR + "manifest.json")
    if not p:
        return [], set(), None
    try:
        man = json.loads(p.read_text(encoding="utf-8"))
    except ValueError:
        return [], set(), None
    stems, core = set(), set()
    for i, group in enumerate((man.get("core") or {}, (man.get("packs") or {}).get(slug) or {})):
        for entry in group.values():
            for stem in (entry or {}).get("f") or []:
                stems.add(stem)
                if i == 0:
                    core.add(stem)
    return sorted(stems), core, SFX_DIR + "manifest.json"


def _voices():
    p = _path(VOICE_DIR + "manifest.json")
    if not p:
        return [], None
    try:
        man = json.loads(p.read_text(encoding="utf-8"))
    except ValueError:
        return [], VOICE_DIR + "manifest.json"
    stems = set()
    for clips in (man.get("clips") or {}).values():
        for c in clips or []:
            if c.get("g") and c.get("id"):
                stems.add("%s/%s%s" % (c["g"], c["id"], ".fx" if c.get("fx") else ""))
    return sorted(stems), VOICE_DIR + "manifest.json"


def shared_files():
    """Files every game uses (the site shell, the arcade runtime): kept once on the device, not once per game."""
    rels = list(COMMON) + _shell()
    for rel in list(rels):
        rels += _css_refs(rel)
    return {r for r in rels if _path(r)}


def static_files(game):
    """Every static path (relative to STATIC_URL) the game needs, in a stable order, without sound clips."""
    rels = list(COMMON)
    if game.slug in LAN_GAMES:
        rels += list(LAN)
    names = bundle.scripts(game, settings.DEBUG) + [s for s, _ in game.extra.get("packs", {}).values()] + [game.script]
    rels += [("%s.js" if "/" in n else "js/games/%s.js") % n for n in names if n]  # "js/matlab/mlab" = a full static path
    if game.extra.get("three"):
        rels.append(THREE)
    from . import icons
    rels += [icons.rel(game.slug, n, m) for n in icons.SIZES for m in (False, True)]  # the home-screen icon
    rels += declared_assets(game)
    rels += _shell()
    for rel in list(rels):
        rels += _css_refs(rel)
    seen, out = set(), []
    for rel in rels:
        if rel not in seen and _path(rel):
            seen.add(rel)
            out.append(rel)
    return out


def _plain(rel):
    """The un-hashed static URL. The sound code builds its URLs from the folder name, so it asks for these even in
    production (collectstatic keeps an un-hashed copy of every file)."""
    su = settings.STATIC_URL or "/static/"
    if "://" in su:
        return su.rstrip("/") + "/" + rel
    return "/" + su.strip("/") + "/" + rel


def _size(rel):
    p = _path(rel)
    try:
        return p.stat().st_size if p else 0
    except OSError:
        return 0


def build(slug):
    """The package description for one game: {slug, version, size, files[], sounds{}, voices{}, page, lan}."""
    game = BY_SLUG.get(slug)
    if game is None or not game.playable:
        raise KeyError(slug)
    rels = static_files(game)
    stems, core, sfx_man = _sfx(slug)
    shared = shared_files() | ({sfx_man} if sfx_man else set())
    vstems, voice_man = _voices() if slug == "samaru-days" else ([], None)
    h = hashlib.sha256()
    tpl = Path(settings.BASE_DIR) / "templates" / "games" / "play.html"
    if tpl.exists():
        h.update(tpl.read_bytes())
    files = []
    manifests = [r for r in (sfx_man, voice_man) if r]
    for rel in rels + manifests:
        p = _path(rel)
        data = p.read_bytes() if p else b""
        h.update(rel.encode() + b"\0" + data)
        # pages reference scripts through {% static %} (hashed in production); the sound code asks for its
        # manifests by plain name
        files.append({"u": _plain(rel) if rel in manifests else static(rel), "b": len(data), "s": 1 if rel in shared else 0})

    def clips(base, names):
        out = {}
        for ext in ("ogg", "m4a"):
            lst = []
            for stem in names:
                rel = "%s%s.%s" % (base, stem, ext)
                if _path(rel):
                    lst.append({"u": _plain(rel), "b": _size(rel), "s": 1 if stem in core and base == SFX_DIR else 0})
                    h.update(rel.encode() + b"\0" + str(_size(rel)).encode())
            out[ext] = lst
        return out

    sounds, voices = clips(SFX_DIR, stems), clips(VOICE_DIR, vstems)
    version = h.hexdigest()[:12]
    base = sum(f["b"] for f in files)
    return {
        "slug": slug, "title": game.title, "version": version,
        "page": reverse("games:play", args=[slug]), "lan_page": reverse("games:lan"),
        "lan": slug in LAN_GAMES,
        "files": files,
        "sounds": sounds, "voices": voices,
        # sizes shown before downloading: files + the device's sound format (ogg is the smaller estimate)
        "size": base + sum(f["b"] for f in sounds["ogg"] or sounds["m4a"]),
        "shared_size": sum(f["b"] for f in files if f["s"]) + sum(f["b"] for f in (sounds["ogg"] or sounds["m4a"]) if f["s"]),
        "voice_size": sum(f["b"] for f in voices["ogg"] or voices["m4a"]),
    }


def package(slug):
    """Cached once per process outside DEBUG (the files only change on deploy)."""
    if settings.DEBUG or slug not in _cache:
        _cache[slug] = build(slug)
    return _cache[slug]


def all_packages(slugs=None):
    out = []
    for g in GAMES:
        if g.playable and (slugs is None or g.slug in slugs):
            p = package(g.slug)
            out.append({"slug": g.slug, "title": g.title, "version": p["version"], "size": p["size"], "shared_size": p["shared_size"], "page": p["page"]})
    return out
