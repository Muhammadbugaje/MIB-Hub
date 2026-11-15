"""The shared arcade settings system: option registry, the screen layered above game dialogs, phone-control layouts."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
NODE = shutil.which("node")


@pytest.fixture(scope="module")
def out():
    if not NODE:
        pytest.skip("node not installed")
    res = subprocess.run([NODE, str(Path(__file__).with_name("settings_harness.js")), str(JS)], capture_output=True, text=True, timeout=120)
    data = json.loads(res.stdout.strip().splitlines()[-1])
    assert data["ok"], data.get("error")
    return data


def test_registered_option_round_trips_and_persists(out):
    assert out["default"] == "normal" and out["appliedAtAdd"] == ["normal"]
    assert out["after"] == "hard" and out["appliedOnSet"] == "hard" and out["savedValue"] == "hard"
    assert out["methodsNotSaved"] and out["reset"] == "normal"


def test_every_builtin_option_exists(out):
    assert out["builtins"] == [], out["builtins"]


def test_settings_open_above_a_game_dialog_without_destroying_it(out):
    assert out["uiOpen"] and out["dialogKept"] and out["screenInStage"]
    assert out["tabs"] == [], out["tabs"]
    assert out["closed"] and out["dialogStill"]


def test_layouts_are_per_orientation_and_presets_never_overlap(out):
    assert out["leftHanded"] == {"jumpX": 9, "stickX": 90}
    assert out["portraitEmpty"] and out["landStill"]
    assert out["oneHandedStickRight"] and not out["presetOverlap"]
    assert out["clashYes"] and not out["clashNo"]


def test_game_speed_option(out):
    assert out["speed"] == 0.8


def test_settings_script_is_on_every_game_page_and_in_offline_packages():
    play = (ROOT / "templates" / "games" / "play.html").read_text()
    assert "js/games/arcade-settings.js" in play
    assert play.index("arcade.js") < play.index("arcade-settings.js") < play.index("{% for s in scripts %}")
    assert "js/games/arcade-settings.js" in (ROOT / "games" / "offline.py").read_text()


def test_fslg_registers_its_options_and_marks_controls_editable():
    s = (JS / "samaru-settings.js").read_text()
    for opt in ("gfx", "draw", "shadows", "crowd", "traffic", "camDist", "camHeight", "fov", "follow", "radioVol", "fill", "mapRot", "units", "hudMap", "tips"):
        assert f'id: "{opt}"' in s, opt
    t = (JS / "samaru-touch.js").read_text()
    assert 'setAttribute("data-lay", "stick")' in t and "api.layout.register" in t
