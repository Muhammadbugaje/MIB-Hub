"""The 120-mission campaign: every content file loads, validates and plays to the end headlessly, on both choice branches."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static" / "js" / "games"
HARNESS = Path(__file__).with_name("samaru_story_harness.js")


def _run(pick):
    res = subprocess.run(["node", str(HARNESS), str(JS), str(pick)], capture_output=True, text=True, timeout=900)
    lines = res.stdout.strip().splitlines()
    assert lines, res.stderr[-2000:]
    return json.loads(lines[-1])


@pytest.fixture(scope="module")
def first():
    return _run(0)


pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


def test_campaign_loads_and_validates(first):
    assert first["ok"], first.get("error")
    assert first["ids"] == ["m%d" % i for i in range(1, 121)]
    assert first["unknownTypes"] == []
    assert first["problems"] == [], first["problems"][:20]


def test_campaign_plays_to_the_end(first):
    assert first["stuck"] == [], first["stuck"][:20]
    f = first["final"]
    assert f["done"] == f["total"] == 120
    assert 100 <= f["lvl"] <= 150  # the story itself carries you through the five years
    assert first["grindXp"] == 0
    years = first["years"]
    assert years["1"]["lvl"] < years["2"]["lvl"] < years["3"]["lvl"] < years["4"]["lvl"] < years["5"]["lvl"]
    assert first["makerFree"] and first["makerSays"]


def test_other_choice_branch_also_finishes():
    other = _run(1)
    assert other["ok"], other.get("error")
    assert other["stuck"] == [], other["stuck"][:20]
    assert other["final"]["done"] == 120


def test_relationship_rules(first):
    assert all(first["rel"].values()), first["rel"]


def test_old_saves_continue(first):
    assert first["migrate"]["story"] and first["migrate"]["next"] == "m37"
    assert first["migrate"]["mid"].startswith("m45/")
    y1 = first["migrate"]["y1"]
    assert y1["active"] == "m12" and y1["step"] == 0 and y1["paid"] >= 900


def test_new_game_starts_with_the_room_choice(first):
    room = first["room"]
    assert room["options"] and all(o in ("firdausi", "nusaybah", "aleeya", "emily", "lily", "fate") for o in room["options"])  # a woman sees the women's halls
    assert room["roomie"] == "nusaybah" and room["home"] == "amina"


def test_side_missions_and_encounters_run(first):
    side = first["side"]
    assert side["count"] >= 40 and side["ambient"] >= 30
    assert side["firstDone"] and side["ambientDone"]
    assert side["offerIsNotModal"] and side["whoSpawned"] and side["acceptedByTalk"]
