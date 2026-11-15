"""Count lines per side-mission section in SIDE.md and refuse spoken lines over 90 characters."""
import re, sys
p = "docs/story/scripts/SIDE.md"
txt = open(p, encoding="utf8").read().split("\n")
secs, cur, bad = {}, None, []
for i, l in enumerate(txt, 1):
    m = re.match(r"^### (s\d+) ", l)
    if m: cur = m.group(1); secs[cur] = 0
    elif l.startswith("## ") or l.startswith("---"):
        cur = None if l.startswith("## ") else cur
    if cur and l.strip() and not l.startswith("---"): secs[cur] += 1
    s = re.match(r"^\s*-\s*(?:\d+\.\s*\[[^\]]*\]\s*-\s*)?([A-Z@][A-Z0-9 .'@()/-]+):\s*(.*?)\s*\[v:[^\]]*\]\s*$", l)
    if s and len(s.group(2)) > 90: bad.append((i, len(s.group(2))))
n = list(secs.values())
print("missions", len(n), "min", min(n), "avg", round(sum(n) / len(n), 1), "max", max(n))
short = [k for k, v in secs.items() if v < 25]
print("under 25:", len(short), " ".join(short))
print("over 40:", " ".join(k for k, v in secs.items() if v > 40))
if bad: print("LINES OVER 90:", bad); sys.exit(1)
