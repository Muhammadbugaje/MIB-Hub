"""Momentum Cup career: bot careers through the rules, and one real match through the game (games/tests/momentum_career_harness.js)."""
import json, pathlib, shutil, subprocess
import pytest

JS = pathlib.Path(__file__).resolve().parents[2] / "static" / "js" / "games"
HARNESS = pathlib.Path(__file__).with_name("momentum_career_harness.js")


@pytest.fixture(scope="module")
def run():
    node = shutil.which("node")
    if not node:
        pytest.skip("node not installed")
    res = subprocess.run([node, str(HARNESS), str(JS)], capture_output=True, text=True, timeout=600)
    assert res.returncode == 0, res.stderr[-2000:]
    return json.loads(res.stdout.strip().splitlines()[-1])


def test_content_is_big_enough(run):
    assert run["players"] >= 60 and run["uniqueNames"] == run["players"] and run["clubs"] >= 24 and run["powers"] >= 12
    assert run["rarity"] == {"common": 24, "rare": 20, "epic": 12, "legendary": 8}


def test_about_200_matches_to_the_grand_final_for_an_even_player(run):
    even = [c["grandAt"] for c in run["careers"]["0"] if c["grandAt"]]
    assert len(even) >= 4 and 120 <= sorted(even)[len(even) // 2] <= 300  # median of five seeded careers
    strong = [c["grandAt"] for c in run["careers"]["0.1"]]
    assert all(0 < g < min(even) + 60 for g in strong)                    # a better player gets there sooner
    for c in run["careers"]["0"]:
        assert c["level"] < 40 and c["trophies"] >= 5 and c["roster"] >= 6


def test_difficulty_rises_and_never_stops(run):
    curve = run["curve"]
    assert curve[0]["skill"] < curve[2]["skill"] < curve[-1]["skill"]
    leg = run["legends"]
    assert all(b[2] > a[2] for a, b in zip(leg, leg[1:]))                 # stats keep climbing on the Legends ladder
    assert leg[-1][1] >= 1.2 and leg[-1][3] == 4


def test_seeded_and_unlock_rules(run):
    assert run["repeat"] is True
    u = run["unlock"]
    assert u == {"rareAtCampus": False, "legendBuy": False, "rareAtRegional": True, "legendByTrophy": True}


def test_old_saves_migrate(run):
    assert run["migrate"] == {"classic": True, "fav": True, "season": True, "v": 1, "fills": True}


def test_a_real_career_match(run):
    assert run["menuHasCareer"] and run["createScreen"] and run["hub"] and run["saved"] and run["prematch"]
    m = run["match"]
    assert m["mode"] == "career" and m["kit"] and m["played"]
    assert run["cer"] == "win" and run["post"] and run["backToHub"]
    assert run["after"] == {"played": 1, "won": 1, "coins": run["after"]["coins"], "pts": 3} and run["after"]["coins"] > 400
    assert run["draw"] is True                                              # league matches can end level


def test_every_superpower_runs_in_a_match(run):
    assert len(run["powersRun"]) == 12
    for k, (engine, ok, finite) in run["powersRun"].items():
        assert ok is True and finite, k
