"""Missions play through the real update loop (FSLG_REVIEW.md §9): go steps fire where you stand, search items lie at
their scene on dry ground and can be picked up, every step gives the guide a target; and Year 1's generated search
steps sit where the scripts place the scene."""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
node = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


@node
def test_every_mission_replays_through_the_update_loop():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_replay_harness.js")), str(JS)], capture_output=True, text=True, timeout=1800)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    assert out["missions"] == 120 and out["counts"]["go"] > 100 and out["counts"]["find"] > 20
    for k in ("goStall", "findFar", "findWet", "findStuck", "collectFar", "noTarget"):
        assert out[k] == [], (k, out[k][:10])


def _y1():
    s = (JS / "fslg-story-y1.js").read_text(encoding="utf8")
    return {m["id"]: m for m in json.loads(s[s.index("D.STORY.push(") + 13:s.rindex(");\n})")])["missions"]}


def test_year1_search_steps_are_where_the_scene_is():
    ms = _y1()
    want = {("m1", "backpack"): "@hostel", ("m4", "torch"): "@hostel", ("m10", "statue"): "sculpture", ("m25", "ledger"): "mk_books",
            ("m32", "winding"): "chemeng", ("m32", "sparkgap"): "physics", ("m32", "rubbing"): "enggarden"}
    for (mid, item), at in want.items():
        st = [s for s in ms[mid]["steps"] if s.get("item") == item and s["t"] in ("find", "collect")]
        assert st and st[0]["at"] == at, (mid, item, st and st[0].get("at"))
    # the general rule: a search step happens where the mission last took you, unless the script names the place
    scripts = (ROOT / "docs/story/scripts/Y1.md").read_text(encoding="utf8") + (ROOT / "docs/story/scripts/Y1b.md").read_text(encoding="utf8")
    tagged = set(re.findall(r"\[(?:find|collect): [^\]]*? at ([@\w]+)\]", scripts))
    for mid, m in ms.items():
        last = None
        for s in m["steps"]:
            if s["t"] in ("find", "collect"):
                assert s["at"] in tagged or last is None or s["at"] == last, (mid, s["item"], s["at"], last)
            elif s.get("place"):
                last = s["place"]
    hassan = [s for s in ms["m7"]["steps"] if s.get("npc") == "hassan"][0]
    assert hassan.get("npcAt") == "@hostel"  # "Hassan is outside your hostel"
