"""One-file production bundle for Freshers School Life.

The game is about twenty script files. In DEBUG they are served one by one, which is what you want while
editing. For production, run

    python -m games.bundle            (or: python manage.py build_fslg)

to write static/js/games/fslg.bundle.js: the same files, in catalogue order, joined, with whole-line comments
and indentation removed. No JavaScript tooling is needed. `scripts()` hands the play view the bundle only when
it exists and is at least as new as every source file, so a stale bundle is never served. Build it before
collectstatic.
"""
import gzip
from pathlib import Path

SLUG = "samaru-days"
NAME = "fslg.bundle"
DIR = Path(__file__).resolve().parent.parent / "static" / "js" / "games"


def deps():
    from .catalogue import BY_SLUG
    return list(BY_SLUG[SLUG].extra.get("deps", []))


def squeeze(text):
    """Drop whole-line comments and leading indentation. Files that use template literals are left alone."""
    if "`" in text:
        return text
    out, block = [], False
    for line in text.split("\n"):
        s = line.strip()
        if block:
            if "*/" in s:
                block = False
                rest = s.split("*/", 1)[1].strip()
                if rest:
                    out.append(rest)
            continue
        if not s or s.startswith("//"):
            continue
        if s.startswith("/*"):
            if "*/" in s:
                rest = s.split("*/", 1)[1].strip()
                if rest:
                    out.append(rest)
            else:
                block = True
            continue
        out.append(s)
    return "\n".join(out)


def build(directory=DIR):
    names = deps()
    parts = ["/* Freshers School Life: built by games/bundle.py from %d files. Edit the sources, not this. */" % len(names)]
    raw = packed = 0
    for n in names:
        text = (directory / (n + ".js")).read_text(encoding="utf-8")
        raw += len(text.encode("utf-8"))
        packed += len(gzip.compress(text.encode("utf-8"), 9))
        parts.append("/* " + n + " */\n;" + squeeze(text))
    data = "\n".join(parts).encode("utf-8")
    (directory / (NAME + ".js")).write_bytes(data)
    return {"files": len(names), "raw": raw, "gzip_separate": packed, "bundle": len(data), "bundle_gzip": len(gzip.compress(data, 9))}


def fresh(directory=DIR):
    out = directory / (NAME + ".js")
    if not out.exists():
        return False
    stamp = out.stat().st_mtime
    try:
        return all((directory / (n + ".js")).stat().st_mtime <= stamp for n in deps())
    except OSError:
        return False


def scripts(game, debug):
    """The script names the play page should load for `game`."""
    names = list(game.extra.get("deps", []))
    if game.slug == SLUG and not debug and fresh():
        return [NAME]
    return names


if __name__ == "__main__":
    r = build()
    print("%(files)d files  %(raw)d bytes raw, %(gzip_separate)d gzip as separate files  ->  bundle %(bundle)d bytes, %(bundle_gzip)d gzip" % r)
