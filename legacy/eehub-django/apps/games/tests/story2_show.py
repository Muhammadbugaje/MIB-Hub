"""Print a short pass/fail summary of samaru_story2_harness.js output (reads JSON on stdin)."""
import json
import sys

d = json.loads(sys.stdin.read().strip().splitlines()[-1])
for k, v in d.items():
    if isinstance(v, dict):
        bad = {a: b for a, b in v.items() if b is False or a == "error"}
        print(k, "FAIL" if bad else "ok", bad or "", {a: b for a, b in v.items() if not isinstance(b, bool) and a != "error"})
    else:
        print(k, v)
