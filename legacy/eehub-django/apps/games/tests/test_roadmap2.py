"""Roadmap batch 2: Motorworks Trails (EEEN 309), Gridkeepers: Storm Map (EEEN 327), Algorithm Garage (EEEN 316)."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from django.urls import reverse

from games import offline
from games import progress as P
from games.catalogue import BY_SLUG
from memos.tests.helpers import as_user, set_setting, world  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static/js/games"
node = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
SLUGS = {"motorworks": 30, "storm-map": 26, "algorithm-garage": 26}


@pytest.fixture(scope="module")
def H():
    res = subprocess.run(["node", str(Path(__file__).with_name("rm2_harness.js")), str(JS)], capture_output=True, text=True, timeout=900)
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert "error" not in out, out.get("error")
    return out


@pytest.fixture
def on(world):
    set_setting("features.games", True)
    return world


@node
def test_dc_machine_model(H):
    m = H["motor"]
    for k in ("kvl", "emf", "torque", "noLoad", "halfVolts", "fieldWeakening", "saturation", "seriesCharacteristic", "seriesRunaway",
              "generator", "directOnLineTrips", "brakeTooHard", "ideas", "nightTighter"):
        assert m[k] is True, k
    assert m["bays"] == 30 and m["halls"] == 5
    assert m["solved"] == [3] * 30  # every bay is finished by its reference setting, inside par, without a trip


@node
def test_grid_protection_interlocks_and_restoration(H):
    g = H["grid"]
    for k in ("tripped", "closeOntoFaultTrips", "earthRefused", "isolated", "earthOk", "interlock", "repaired", "voltage", "noLoops", "bigger", "lessons"):
        assert g[k] is True, k
    assert g["incidents"] == 26 and all(g["solved"]) and all(g["endless"])


@node
def test_algorithm_garage_runs_real_matlab(H):
    a = H["garage"]
    assert a["jobs"] == 26 and a["chapters"] == 5
    assert all(a["solved"]) and a["startersFail"]
    for k in ("deterministic", "wallError", "loopStopped", "typo", "matlabSemantics", "hiddenFloors"):
        assert a[k] is True, k
    assert all(a["workOrders"])


@node
@pytest.mark.parametrize("key,slug", [("motorGame", "motorworks"), ("stormGame", "storm-map"), ("garageGame", "algorithm-garage")])
def test_games_play_through_to_ceremony_and_report(H, key, slug):
    g = H[key]
    assert g["win"] == "stageClear" and g["stars"] == 3
    assert g["reports"] and g["reports"][0][0] == slug and g["reports"][0][1]["stage"] == 1
    assert g["settings"]  # each registers its own options with the shared settings screen
    if key != "garageGame":
        assert g["loss"] == "lose"
    else:
        assert g["failShown"]


def test_catalogue_progress_and_cheats():
    for slug, n in SLUGS.items():
        g = BY_SLUG[slug]
        assert g.playable and (JS / (g.script + ".js")).exists()
        assert P.MAX_STAGE[slug] == n and P.FINAL[slug][1] == n and P.FINAL[slug][0] in P.BADGES
        data = json.loads((ROOT / "games/cheat_defaults" / (slug + ".json")).read_text())
        src = (JS / (g.script + ".js")).read_text()
        for c in data["cheats"]:
            assert c["typed"] not in src and c["dial"] not in src  # only hashes ship
            assert '"%s":[' % c["id"] in src  # every default cheat id has a hash table entry in the game


def test_offline_package_includes_the_matlab_runner():
    urls = [f["u"] for f in offline.build("algorithm-garage")["files"]]
    assert any(u.split("?")[0].endswith("/js/matlab/mlab.js") for u in urls)
    assert any(u.split("?")[0].endswith("/js/matlab/mlab-lib.js") for u in urls)
    for slug in SLUGS:
        assert offline.build(slug)["size"] > 0


def test_play_pages_render(on):
    c = as_user(on["lecturer"], "lecturer")  # 300-level games: staff may open every level
    for slug, files in {"motorworks": ["motorsim", "motorworks"], "storm-map": ["gridsim", "stormmap"], "algorithm-garage": ["matlab/mlab", "matlab/mlab-lib", "garagesim", "garage"]}.items():
        r = c.get(reverse("games:play", args=[slug]))
        assert r.status_code == 200, slug
        for f in files:
            assert ("js/" + f if "/" in f else "js/games/" + f).encode() in r.content, f
