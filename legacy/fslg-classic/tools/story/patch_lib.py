"""Small helpers for revising mission scripts in place: add beats to a mission, replace a whole mission."""
import re
from pathlib import Path
S = Path(__file__).resolve().parents[2] / "docs" / "story" / "scripts"

def _span(s, mid):
    i = s.index("\n### " + mid + " ")
    j = s.find("\n### ", i + 5)
    return i, (len(s) if j < 0 else j)

def add(fname, mid, text, before=("**Choice.**", "**If it goes wrong.**", "**Rewards.**")):
    p = S / fname; s = p.read_text(encoding="utf8"); i, j = _span(s, mid); sec = s[i:j]
    k = min([sec.find("\n" + b) for b in before if sec.find("\n" + b) > 0] or [len(sec)])
    sec = sec[:k].rstrip("\n") + "\n" + text.strip("\n") + "\n" + sec[k:]
    p.write_text(s[:i] + sec + s[j:], encoding="utf8")

def after(fname, mid, block_label, text):
    """Append lines at the end of a labelled block such as '**Around it.**'."""
    p = S / fname; s = p.read_text(encoding="utf8"); i, j = _span(s, mid); sec = s[i:j]
    k = sec.find(block_label); assert k > 0, (mid, block_label)
    m = re.search(r"\n\n|\n---|\Z", sec[k:]); e = k + m.start()
    sec = sec[:e] + "\n" + text.strip("\n") + sec[e:]
    p.write_text(s[:i] + sec + s[j:], encoding="utf8")

def replace(fname, mid, new):
    p = S / fname; s = p.read_text(encoding="utf8"); i, j = _span(s, mid)
    p.write_text(s[:i] + "\n" + new.strip("\n") + "\n" + s[j:], encoding="utf8")

def sub(fname, old, new):
    p = S / fname; s = p.read_text(encoding="utf8"); assert old in s, old[:50]
    p.write_text(s.replace(old, new, 1), encoding="utf8")
