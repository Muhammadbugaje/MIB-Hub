"""Revision 4: insert an "Expanded beats" block into each main mission of Y4.md and Y5.md.

Idempotent: a mission that already has the block is skipped. Every spoken line must be <= 90 characters
(the part between "NAME:" and "[v: ]"); the script refuses to write if one is longer.
Run: .venv/bin/python tools/story/expand_y45.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "docs" / "story" / "scripts"
MARK = "**Expanded beats (rev 4).**"

sys.path.insert(0, str(Path(__file__).parent))
from expand_y4_text import Y4  # noqa: E402
from expand_y5_text import Y5  # noqa: E402


def check(blocks):
    bad = []
    for mid, text in blocks.items():
        for ln in text.strip("\n").split("\n"):
            m = re.match(r"\s*- ([A-Z][A-Z .'()@/-]+): (.*) \[v: \]$", ln)
            if m and len(m.group(2)) > 90:
                bad.append((mid, len(m.group(2)), m.group(2)))
    return bad


def insert(path, blocks, mark=MARK):
    lines = path.read_text(encoding="utf8").split("\n")
    out, i, done = [], 0, []
    cur = None
    while i < len(lines):
        ln = lines[i]
        h = re.match(r"### (m\d+)\b", ln)
        if h:
            cur = h.group(1)
            seen_beats = False
        if cur and (ln.startswith("**Beats**") or ln.startswith("**Version")):
            seen_beats = True
        if (cur in blocks and seen_beats and re.match(r"\*\*(Choice|If it goes wrong|Rewards)", ln)):
            body = "\n".join(lines[max(0, i - 400):i])
            seg = body[body.rfind("### " + cur):]
            if mark not in seg:
                out.append(mark)
                out.extend(blocks[cur].strip("\n").split("\n"))
                out.append("")
                done.append(cur)
            cur = None
        out.append(ln)
        i += 1
    path.write_text("\n".join(out), encoding="utf8")
    return done


if __name__ == "__main__":
    bad = check(Y4) + check(Y5)
    if bad:
        for b in bad:
            print("TOO LONG", b)
        sys.exit(1)
    print("Y4", insert(SCRIPTS / "Y4.md", Y4))
    print("Y5", insert(SCRIPTS / "Y5.md", Y5))
    from expand_y45_extra import X
    if check(X):
        print("TOO LONG", check(X)); sys.exit(1)
    M2 = "**More beats (rev 4).**"
    print("X4", insert(SCRIPTS / "Y4.md", X, M2))
    print("X5", insert(SCRIPTS / "Y5.md", X, M2))
