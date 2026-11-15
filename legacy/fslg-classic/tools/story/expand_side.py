"""Apply tools/story/expand_side_text.py to docs/story/scripts/SIDE.md (additions only; skips missions already expanded)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import patch_lib as P
from expand_side_text import BEATS, AROUND
F = "SIDE.md"
BEFORE = ("**Choice.**", "**Outcome.**", "**If it goes wrong.**", "**Romance", "**Around it.**", "**Rewards.**")
done = 0
for mid in BEATS:
    s = (P.S / F).read_text(encoding="utf8"); i, j = P._span(s, mid); sec = s[i:j]
    first = BEATS[mid].strip().split("\n")[0]
    if first in sec:
        continue
    P.add(F, mid, BEATS[mid], before=BEFORE)
    line = AROUND.get(mid)
    if line:
        s = (P.S / F).read_text(encoding="utf8"); i, j = P._span(s, mid); sec = s[i:j]
        if "**Around it.**" in sec:
            P.after(F, mid, "**Around it.**", line)
        else:
            sec = sec.rstrip("\n") + "\n**Around it.**\n" + line + "\n"
            (P.S / F).write_text(s[:i] + sec + s[j:], encoding="utf8")
    done += 1
print("expanded", done)

# Second pass: tools/story/expand_side_text2.py (extra beats and ambient lines).
from expand_side_text2 import BEATS2, AROUND2
done2 = 0
for mid, text in BEATS2.items():
    s = (P.S / F).read_text(encoding="utf8"); i, j = P._span(s, mid)
    if text.strip().split("\n")[0] in s[i:j]:
        continue
    P.add(F, mid, text, before=BEFORE); done2 += 1
for mid, lines in AROUND2.items():
    for line in lines:
        s = (P.S / F).read_text(encoding="utf8"); i, j = P._span(s, mid)
        if line in s[i:j]:
            continue
        P.after(F, mid, "**Around it.**", line)
print("second pass beats", done2)
