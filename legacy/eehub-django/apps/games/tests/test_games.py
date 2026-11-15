"""Learning arcade: module switch, level locks, server-side progression rules, puzzle solvability."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from django.urls import reverse

from games import progress as P
from games.catalogue import BY_SLUG, GAMES
from memos.tests.helpers import as_user, set_setting, world  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def on(world):
    set_setting("features.games", True)
    return world


def student_level(user):
    from people.models import StudentProfile
    return StudentProfile.objects.filter(person__user=user).first()


def test_switch_is_off_by_default(world):
    from core import features
    assert features.FEATURES["games"].default is False
    assert not features.enabled("games")
    r = as_user(world["student"], "student").get(reverse("games:index"))
    assert r.status_code in (200, 403, 404) and b"Learning arcade</h1>" not in r.content
    assert as_user(world["student"], "student").get(reverse("games:play", args=["momentum-cup"])).status_code != 200 or \
        b"data-gm-canvas" not in as_user(world["student"], "student").get(reverse("games:play", args=["momentum-cup"])).content


def test_index_and_play_render_when_on(on):
    c = as_user(on["student"], "student")
    r = c.get(reverse("games:index"))
    assert r.status_code == 200 and b"Momentum Cup" in r.content and b"Leaderboards" in r.content
    level = student_level(on["student"]).level.number
    for g in GAMES:
        if g.playable:
            page = c.get(reverse("games:play", args=[g.slug]))
            if g.level <= level:
                assert page.status_code == 200, g.slug
                assert f"js/games/{g.script}".encode() in page.content
            else:
                assert page.status_code == 403, g.slug  # above this student's level


def test_roadmap_shape():
    assert 10 <= len(GAMES) <= 20
    assert sum("Open-world" in g.genre for g in GAMES) >= 3
    assert BY_SLUG["momentum-cup"].planned_online and BY_SLUG["impulse-arena"].planned_online
    for g in GAMES:  # every playable script and fieldsim exist
        if g.playable:
            assert (ROOT / "static/js/games" / f"{g.script}.js").exists()


def test_planned_game_is_404(on, monkeypatch):
    from games import catalogue
    monkeypatch.setitem(catalogue.BY_SLUG, "planned", catalogue.Game("planned", "Planned", "x", 100, ("PHYS 111",), (), "", ""))
    assert as_user(on["student"], "student").get(reverse("games:play", args=["planned"])).status_code == 404


def test_higher_level_is_locked_server_side(on, monkeypatch):
    from games import catalogue
    hard = catalogue.Game("hard", "Hard", "x", 500, ("EEEN 524",), (), "", "", playable=True, script="kickoff")
    monkeypatch.setitem(catalogue.BY_SLUG, "hard", hard)
    sp = student_level(on["student"])
    assert sp and sp.level and sp.level.number < 500
    r = as_user(on["student"], "student").get(reverse("games:play", args=["hard"]))
    assert r.status_code == 403 and b"opens at 500 level" in r.content


def test_student_without_level_gets_help_state(on):
    sp = student_level(on["student"])
    sp.level = None
    sp.save()
    c = as_user(on["student"], "student")
    assert b"can&#x27;t tell which level" in c.get(reverse("games:index")).content or b"can't tell which level" in c.get(reverse("games:index")).content
    assert c.get(reverse("games:play", args=["momentum-cup"])).status_code == 403


def post(c, name, data):
    return c.post(reverse(name), json.dumps(data), content_type="application/json")


def test_result_rewards_are_server_side_and_rate_limited(on):
    c = as_user(on["student"], "student")
    r = post(c, "games:api_result", {"game": "momentum-cup", "result": "win", "stage": 1, "score": 999999, "coins": 10 ** 6})
    body = r.json()
    assert r.status_code == 200 and body["earned_coins"] == 35 and body["coins"] == 35 and body["xp"] == 70
    assert any(b["id"] == "first-win" for b in body["new_badges"])
    assert P.ArcadeScore.objects.get(profile__user=on["student"]).score == P.MAX_SCORE  # clamped
    again = post(c, "games:api_result", {"game": "momentum-cup", "result": "win", "stage": 1, "score": 5})
    assert again.status_code == 400 and "15 seconds" in again.json()["error"]


@pytest.mark.parametrize("bad", [{"game": "nope", "result": "win"}, {"game": "volt-city", "result": "won"},
                                 {"game": "volt-city", "result": "win", "stage": 13},{"game": "volt-city", "result": "win", "stage": "x"}])
def test_invalid_results_rejected(on, bad):
    assert post(as_user(on["student"], "student"), "games:api_result", bad).status_code == 400


def test_badges_levels_and_boss(on):
    u = on["student"]
    t = 1000.0
    assert P.MAX_STAGE["volt-city"] == 12  # six inner districts (the badge needs all of them) + the six-district Outer Ring
    for stage in (1, 2, 3, 4, 5, 6):
        out = P.record(u, {"game": "volt-city", "result": "win", "stage": stage, "score": 100}, now=t)
        if stage == 4:
            assert not any(b["id"] == "city-restored" for b in out["badges"])
        t += 20
    assert any(b["id"] == "city-restored" for b in out["badges"])
    out = P.record(u, {"game": "impulse-arena", "result": "win", "stage": 10, "score": 100}, now=t)
    assert any(b["id"] == "arena-champion" for b in out["badges"])
    out = P.record(u, {"game": "momentum-cup", "result": "win", "stage": 6, "score": 100}, now=t)
    ids = {b["id"] for b in out["badges"]}
    assert {"cup-champion", "all-rounder"} <= ids
    assert P.level_for(0) == 1 and P.level_for(100) == 2 and P.level_for(300) == 3


def test_duo_halves_rewards_and_skips_leaderboard(on):
    out = P.record(on["student"], {"game": "momentum-cup", "result": "win", "stage": 1, "score": 400, "mode": "duo"}, now=1.0)
    assert out["earned_coins"] == 17 and not P.ArcadeScore.objects.exists()


def test_shop_buy_equip_and_privacy(on):
    u, c = on["student"], as_user(on["student"], "student")
    assert post(c, "games:api_buy", {"item": "kit-gold"}).status_code == 400  # no coins
    prof = P.profile_for(u)
    prof.coins = 500
    prof.save()
    assert post(c, "games:api_equip", {"item": "kit-volt"}).status_code == 400  # not owned
    r = post(c, "games:api_buy", {"item": "kit-volt"})
    assert r.status_code == 200 and r.json()["coins"] == 380
    assert post(c, "games:api_buy", {"item": "kit-volt"}).status_code == 400  # owned already
    assert post(c, "games:api_equip", {"item": "kit-volt"}).json()["equipped"] == {"kit": "kit-volt"}
    P.record(u, {"game": "volt-city", "result": "win", "stage": 1, "score": 250}, now=5.0)
    board = P.leaderboard("volt-city")
    assert board[0]["score"] == 250 and "@" not in board[0]["name"]
    post(c, "games:api_privacy", {"on_leaderboard": False})
    assert P.leaderboard("volt-city") == []


def test_api_blocked_when_off_and_needs_sign_in(world):
    from django.test import Client
    c = as_user(world["student"], "student")
    off = post(c, "games:api_result", {"game": "volt-city", "result": "win"})
    assert "application/json" not in off.get("Content-Type", "")  # the friendly switched-off page answers instead
    assert not P.ArcadeProfile.objects.exists()
    set_setting("features.games", True)
    assert Client().get(reverse("games:api_me")).status_code in (302, 401)


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_every_volt_city_puzzle_is_solvable():
    script = """
const S = require(process.argv[1]);
const out = S.LEVELS.map(L => {
  const used = new Set([L.src + "", L.dst + "", ...L.walls.map(String), ...L.fixed.map(f => [f.c, f.r] + "")]);
  const cells = []; for (let c = 0; c < 12; c++) for (let r = 0; r < 7; r++) if (!used.has([c, r] + "")) { cells.push({c, r, s: 1}); cells.push({c, r, s: -1}); }
  for (let i = 0; i < cells.length; i++) { if (S.simulate(L, L.fixed.concat([cells[i]])).ok) return true;
    for (let j = i + 1; j < cells.length; j++) if (cells[j].c !== cells[i].c || cells[j].r !== cells[i].r) if (S.simulate(L, L.fixed.concat([cells[i], cells[j]])).ok) return true; }
  return S.simulate(L, L.fixed).ok;
});
console.log(JSON.stringify(out));"""
    res = subprocess.run(["node", "-e", script, str(ROOT / "static/js/games/fieldsim.js")], capture_output=True, text=True, timeout=300)
    assert json.loads(res.stdout) == [True, True, True, True], res.stderr
    unsolved = subprocess.run(["node", "-e", "const S=require(process.argv[1]);console.log(S.LEVELS.every(L=>!S.simulate(L,L.fixed).ok))",
                               str(ROOT / "static/js/games/fieldsim.js")], capture_output=True, text=True)
    assert unsolved.stdout.strip() == "true"  # no puzzle solves itself


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_game_scripts_parse():
    for f in (ROOT / "static/js/games").glob("*.js"):
        assert subprocess.run(["node", "--check", str(f)], capture_output=True).returncode == 0, f.name
