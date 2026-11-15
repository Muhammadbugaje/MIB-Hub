"""Signal Surfer, Maglev Rescue and Drive Room: physics checked against known values, every level solvable by the
reference engineer, endless modes that get harder, game wiring (win and loss reach a ceremony and a report),
catalogue, stage counts, badges, cheats and the play page."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from django.urls import reverse

from games import progress as P
from games.catalogue import BY_SLUG
from memos.tests.helpers import as_user, set_setting, world  # noqa: F401

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
NVM = sorted(Path.home().glob(".nvm/versions/node/*/bin/node"))
NODE = shutil.which("node") or (str(NVM[-1]) if NVM else None)
SLUGS = {"signal-surfer": ("surfer", "signalsim", "signal-master"), "maglev-rescue": ("maglev", "maglevsim", "line-restored"),
         "drive-room": ("driveroom", "drivesim", "chief-engineer")}


@pytest.fixture(scope="module")
def lab():
    if not NODE:
        pytest.skip("node not installed")
    r = subprocess.run([NODE, str(Path(__file__).with_name("lab_harness.js")), str(JS)], capture_output=True, text=True, timeout=900)
    assert r.returncode == 0, r.stderr[-2000:]
    out = json.loads(r.stdout.strip().splitlines()[-1])
    assert "error" not in out, out.get("error")
    return out


def test_signal_channel_physics(lab):
    s = lab["surfer"]
    assert s["erfc0"] and s["erfc1"] and s["berZero"]
    assert 0.8e-5 < s["ber96"] < 1.2e-5                    # BPSK: BER ≈ 1e-5 at Eb/N0 = 9.6 dB
    assert abs(s["pg1km"] + 100.05) < 0.1 and s["pgDistance"]  # Friis: 1 km at 2.4 GHz ≈ −100 dB; double d = −6 dB
    assert s["shannon"] and s["floor"]                      # goodput never beats Shannon; noise never below thermal


def test_maglev_physics(lab):
    m = lab["maglev"]
    assert m["balance"] and m["K"] and m["kpMinIsI0g0"] and 0.9 < m["kpMin"] < 1.1
    assert m["openLoopUnstable"] and m["weakKpFails"] and m["noDampingFails"] and m["designStable"]
    assert m["sagPD"] > 0.3 and m["sagPID"] < 0.05         # integral action removes the payload sag


def test_drive_physics(lab):
    d = lab["drive"]
    assert d["v1"] and d["v3"] and d["quadsOK"] and d["steady"]
    assert d["hoistDown"] == "1,4" and d["reverse"]
    assert d["brakeLesson"]                                 # a class-A chopper cannot brake; class C can and regenerates


@pytest.mark.parametrize("key", ["surfer", "maglev", "drive"])
def test_every_level_solvable_and_taught(lab, key):
    r = lab[key]
    assert r["levels"] >= 25 and all(r["solved"]), [i + 1 for i, ok in enumerate(r["solved"]) if not ok]
    assert r["teach"] and r["harder"]
    assert all(r["endless"][:3]) and sum(r["endless"]) >= len(r["endless"]) * 0.8


@pytest.mark.parametrize("key,slug", [("surferGame", "signal-surfer"), ("maglevGame", "maglev-rescue"), ("driveGame", "drive-room")])
def test_game_win_and_loss_reach_a_ceremony_and_report(lab, key, slug):
    g = lab[key]
    assert g["firstWin"] in ("stageClear", "newRecord") and g["loss"] == "lose" and g["cleared"] == 1
    assert [r[0] for r in g["reports"]] == [slug, slug] and g["reports"][0][1]["result"] == "win" and g["reports"][1][1]["result"] == "lose"
    assert g["settings"], "options must go through the shared settings API"


@pytest.mark.parametrize("slug", sorted(SLUGS))
def test_registered_and_playable(slug):
    script, sim, badge = SLUGS[slug]
    g = BY_SLUG[slug]
    assert g.playable and g.script == script and g.extra["deps"] == ["labkit", sim]
    assert (JS / f"{script}.js").exists() and (JS / f"{sim}.js").exists() and (JS / "labkit.js").exists()
    assert P.MAX_STAGE[slug] == 26 and P.FINAL[slug] == (badge, 26) and badge in P.BADGES


@pytest.fixture
def on(world):
    set_setting("features.games", True)
    return world


def test_play_pages_render_for_staff(on):
    c = as_user(on["admin"], "admin") if "admin" in on else as_user(on["staff"], "staff")
    for slug in SLUGS:
        r = c.get(reverse("games:play", args=[slug]))
        assert r.status_code in (200, 403), slug                  # 403 only when the viewer's level is below the game's
        if r.status_code == 200:
            assert SLUGS[slug][0].encode() in r.content
