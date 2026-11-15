"""Freshers School Life: the content validator (MASTER_GAME_GUIDE §4.6), the replay bot and the monkey bot (§15.1).

Errors the validator already knows about carry a KNOWN_ISSUES.md id (KI-xxx); a *new* error fails the suite at once.
Since 14 Nov all tracked errors and bot problems are fixed, so every check here is a hard failure again.
Run: export PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"; .venv/bin/python -m pytest games/tests/test_fslg_validator.py -q
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
JS = HERE.parents[1] / "static" / "js" / "games"
VALIDATOR = HERE / "fslg_validator.js"
BOT = HERE / "fslg_bot.js"
MONKEY_SEED = 424242  # logged in every report; change only on purpose

pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


def _node(script, *args, env=None, timeout=600):
    res = subprocess.run(["node", str(script), str(JS), *map(str, args)], capture_output=True, text=True, timeout=timeout,
                         env=dict(os.environ, **(env or {})))
    lines = res.stdout.strip().splitlines()
    assert lines, res.stderr[-3000:]
    return json.loads(lines[-1])


@pytest.fixture(scope="module")
def report():
    return _node(VALIDATOR)


@pytest.fixture(scope="module")
def injected():
    return _node(VALIDATOR, env={"FSLG_VALIDATOR_INJECT": "1"})


@pytest.fixture(scope="module")
def replay():
    return _node(BOT, "story", 10)


@pytest.fixture(scope="module")
def monkey():
    return _node(BOT, "monkey", MONKEY_SEED, 300)


# ---------------- validator ----------------

def test_validator_runs_and_sees_the_whole_story(report):
    assert report["ok"], report.get("error")
    st = report["stats"]["missions"]
    assert st["main"] == 120 and st["steps"] > 800
    assert report["stats"]["liveStepsChecked"] == st["steps"]  # every step was asked for its arrow and marker


def test_no_new_errors(report):
    new = [e for e in report["errors"] if not e.get("known")]
    assert new == [], "\n".join("%s %s: %s (owner: %s)" % (e["code"], e["where"], e["msg"], e["owner"]) for e in new)


def test_tracked_errors_stay_fixed(report):  # was xfail; all fixed on 14 Nov, so a tracked one coming back fails
    known = [e for e in report["errors"] if e.get("known")]
    assert known == [], "\n".join("%s %s %s: %s" % (e["known"], e["code"], e["where"], e["msg"]) for e in known)


def test_ids_and_references_are_clean(report):
    hard = {"DUP_ID", "DUP_NPC", "DUP_PLACE", "BAD_TYPE", "BAD_PLACE", "BAD_NPC", "BAD_ITEM", "BAD_ENEMY", "BAD_RACE", "BAD_VEH",
            "BAD_EMOTE", "BAD_SPEAKER", "BAD_NEED", "LOOP", "UNREACHABLE", "DEAD_END", "FLAG_NEVER_SET", "BAD_RESUME", "BAD_CHOICE",
            "STEP_START_THROWS", "TARGET_THROWS", "MAP_THROWS", "CUT_META", "VEH_ANCHOR", "VEH_HEAD", "TOKEN_UNRESOLVED", "BAD_ANIM"}
    bad = [e for e in report["errors"] if e["code"] in hard]
    assert bad == [], bad[:20]


def test_guide_map_and_step_agree(report):
    bad = [e for e in report["errors"] if e["code"] in {"NO_MAP_MARKER", "MARKER_DIFFERS"}]
    assert bad == [], bad[:20]


def test_travel_report_lists_the_worst_fifteen(report):
    worst = report["travel"][:15]
    assert len(worst) == 15 and all(t["metres"] >= t["tour"] for t in worst)


def test_validator_catches_every_review_finding(injected):
    """Put back each bug from docs/FSLG_REVIEW.md and check the validator names it."""
    assert injected["ok"], injected.get("error")
    keys = {e["key"] for e in injected["errors"]}

    def has(prefix):
        return any(k.startswith(prefix) for k in keys)

    assert injected["probes"]["goWhileStanding"] == "stalls"           # §2 engine probe sees the cached-place stall
    for at in ("m8.1", "m9.3"):                                           # §2.2 confirmed cases
        assert has("GO_STALL:" + at), at
    assert has("DEFAULT_GATE:m1.") and has("FIND_OFF_SCENE:m1.")         # §1.1 backpack at the gate
    assert has("DEFAULT_GATE:m4.") and has("FIND_OFF_SCENE:m4.")         # §1.1 torch at the gate
    assert has("DEFAULT_GATE:m10.") and has("DEFAULT_GATE:m32.")         # §1.2 statues, winding
    assert has("NPC_AT:npc.maryam")                                       # §1.3 Maryam at the Fire Station
    assert has("FIND_BEACON_OFF_GEM:")                                    # §3.1 arrow at the place, not the item


def test_validator_is_deterministic(report):
    again = _node(VALIDATOR)
    assert [e["key"] for e in again["errors"]] == [e["key"] for e in report["errors"]]
    assert again["travel"][:15] == report["travel"][:15]


# ---------------- replay bot (m1–m10) ----------------

KNOWN_BOT = {"HUD_TOKEN": "KI-004", "STALL": "KI-013", "RELOAD_ITEM": "KI-014", "RELOAD_COLLECT": "KI-014"}


def test_replay_bot_finishes_m1_to_m10(replay):
    assert replay["ok"], replay.get("error")
    s = replay["story"]
    assert s["finishedAll"], s
    assert s["byPlay"] >= 40  # most steps are done by walking to the arrow and acting, not by the solver


def test_save_versions(replay):
    sv = replay["story"]["saveVersions"]
    assert sv["oldLoads"] and sv["oldPlays"], sv       # a save without saveVersion migrates and plays on
    assert sv["newerRefused"] and sv["untouched"], sv  # a newer save is never loaded into older structures


def test_replay_bot_no_new_problems(replay):
    def known(p):  # a stalled *go* or *find* is a regression of KI-003/KI-012, never "known"
        return p["kind"] in KNOWN_BOT and (p["kind"] != "STALL" or p["msg"].startswith(("talk", "collect")))
    new = [p for p in replay["story"]["problems"] if not known(p)]
    assert new == [], new


def test_replay_bot_has_no_problems(replay):
    assert replay["story"]["problems"] == []


# ---------------- monkey bot ----------------

def test_monkey_no_crash_softlock_or_fall(monkey):
    assert monkey["ok"], monkey.get("error")
    m = monkey["monkey"]
    assert m["seed"] == MONKEY_SEED and m["gameSeconds"] == 300
    assert m["crashes"] == [], m["crashes"]
    assert m["softlocks"] == [], m["softlocks"]
    assert m["nan"] == 0 and m["fellCount"] == 0, m["fell"]
    assert m["distance"] > 500  # it really moved about


def test_monkey_never_stuck(monkey):
    assert monkey["monkey"]["stuck"] == []
