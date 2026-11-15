"""Your room holds the roommate you chose, and only them: for every room option of both sexes and "Let fate decide",
on entering, after sleeping, and after saving and loading. Old saves keep the roommate they had."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_only_the_chosen_roommate_is_in_your_room():
    res = subprocess.run(["node", str(Path(__file__).with_name("samaru_roomie_harness.js")), str(JS)], capture_output=True, text=True, timeout=900)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["ok"], out.get("error")
    cases = out["cases"]
    assert len(cases) == 12  # five rooms + fate, for each sex
    bad = [(c["sex"], c["option"], c["roomie"], c["first"], c["afterSleep"], c["afterLoad"]) for c in cases if not c["ok"]]
    assert not bad, bad
    assert {c["roomie"] for c in cases if c["sex"] == "m" and not c["fate"]} == {"bature", "sadiq", "muktar", "yusuf", "khalid"}
    assert {c["roomie"] for c in cases if c["sex"] == "f" and not c["fate"]} == {"firdausi", "nusaybah", "aleeya", "emily", "lily"}
    assert out["old"] == {"roomie": "sadiq", "room": ["sadiq"]}
