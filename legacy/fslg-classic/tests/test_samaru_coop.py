"""Friends missions (static/js/games/fslg-story-coop.js): 2, 3 and 6 simulated players play every mission and
every session set through an in-process copy of the room relay, and the relay itself carries the events."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from games import rooms

HERE = Path(__file__).resolve().parent
JS = HERE.parents[1] / "static" / "js" / "games"


def _node():
    node = shutil.which("node")
    if node:
        return node
    for p in sorted((Path.home() / ".nvm" / "versions" / "node").glob("*/bin/node")):
        return str(p)
    return None


NODE = _node()


@pytest.fixture(scope="module")
def coop():
    if not NODE:
        pytest.skip("node not installed")
    res = subprocess.run([NODE, str(HERE / "samaru_coop_harness.js"), str(JS)], capture_output=True, text=True, timeout=900)
    lines = res.stdout.strip().splitlines()
    assert lines, res.stderr[-2000:]
    return json.loads(lines[-1])


def test_every_friends_mission_finishes_and_everyone_agrees(coop):
    assert coop["ok"], coop.get("error") or coop["fails"]
    assert coop["missions"] == 25 and coop["riddles"] >= 50 and coop["photos"] >= 60
    # 23 missions run for 2 players (two need 3+), all 25 for 3 and for 6
    assert coop["runs"] == 23 + 25 + 25
    assert not coop["fails"]


def test_session_sets_twists_late_joiners_and_a_host_who_leaves(coop):
    sets = {r["id"]: r for r in coop["setRuns"]}
    assert sets["sports"]["missions"] == ["F17", "F18", "F16", "F19"]
    assert sets["night"]["missions"] == ["F21", "F22", "F23"] and sets["night"]["night"]
    assert len(sets["tour"]["missions"]) == 6 and len(sets["quick"]["missions"]) == 3
    assert all(r["agree"] and not r["dropped"] for r in coop["setRuns"])
    assert coop["mutators"]["swapped"] and coop["mutators"]["agree"]
    assert coop["late"]["synced"] and coop["late"]["spectator"]
    assert coop["hostLeft"]["stale"]


def test_the_host_referees_claims(coop):
    assert coop["referee"] == {"far": True, "close": True, "teleportIgnored": True, "photosRejected": True}
    assert all(coop["clean"].values())


def test_room_relay_carries_friends_mission_events():
    ev = rooms.clean_event({"k": "co", "o": "SX", "d": '{"v":1}\x00'}, 0)
    assert ev == {"k": "co", "o": "SX", "d": '{"v":1}'}
    assert rooms.clean_event({"k": "co", "o": "S", "d": "x" * (rooms.CO_MAX + 1)}, 0) is None
    assert rooms.clean_event({"k": "co", "o": 5, "d": "{}"}, 0) is None
    assert rooms.clean_event({"k": "co", "o": "S", "d": {"not": "text"}}, 0) is None
