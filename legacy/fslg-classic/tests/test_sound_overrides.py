"""Settings → Sounds: per-player and for-everyone replacements of arcade sounds (games/sounds.py, arcade-sounds.js,
the playing order in arcade-audio.js)."""
import base64
import json
import shutil
import struct
import subprocess
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from games import sounds as SND
from games.models import GlobalSound

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
NVM = sorted(Path.home().glob(".nvm/versions/node/*/bin/node"))
NODE = shutil.which("node") or (str(NVM[-1]) if NVM else None)
SLUG = "samaru-days"


def wav(seconds, rate=8000):
    n = int(seconds * rate)
    return (b"RIFF" + struct.pack("<I", 36 + n * 2) + b"WAVE" + b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
            + b"data" + struct.pack("<I", n * 2) + b"\x00\x01" * n)


def mp3(frames=40):
    # MPEG-1 Layer III, 128 kbit/s, 44.1 kHz, no padding: 417-byte frames of 1152 samples
    hdr = bytes([0xFF, 0xFB, 0x90, 0x00])
    return b"ID3\x03\x00\x00\x00\x00\x00\x00" + (hdr + b"\x00" * 413) * frames


def m4a(seconds):
    mvhd = b"\x00\x00\x00\x00" + struct.pack(">IIII", 0, 0, 1000, int(seconds * 1000)) + b"\x00" * 80
    hdlr = b"\x00" * 8 + b"soun" + b"\x00" * 12
    moov_body = struct.pack(">I", 8 + len(mvhd)) + b"mvhd" + mvhd + struct.pack(">I", 8 + len(hdlr)) + b"hdlr" + hdlr
    return struct.pack(">I", 20) + b"ftypM4A " + b"\x00\x00\x00\x00" + b"isom" + struct.pack(">I", 8 + len(moov_body)) + b"moov" + moov_body


def up(data, name="s.wav", ctype="audio/wav"):
    return SimpleUploadedFile(name, data, content_type=ctype)


@pytest.fixture
def arcade_on(db):
    from django.core.management import call_command

    from memos.tests.helpers import set_setting
    call_command("seed_config", verbosity=0)
    set_setting("features.games", True)


@pytest.fixture
def superadmin(db, arcade_on):
    return get_user_model().objects.create_superuser(email="owner@example.com", password="pw-123456789")


@pytest.fixture
def player(db, arcade_on):
    return get_user_model().objects.create_user(email="student@example.com", password="pw-123456789")


# ---------- the playing order (Node harness) ----------
@pytest.fixture(scope="module")
def harness():
    if not NODE:
        pytest.skip("node not installed")
    res = subprocess.run([NODE, str(Path(__file__).with_name("sound_override_harness.js")), str(JS)], capture_output=True, text=True, timeout=120)
    assert res.returncode == 0, res.stdout[-2000:] + res.stderr[-2000:]
    return json.loads(res.stdout.strip().splitlines()[-1])


def test_priority_off_personal_global_default_synth(harness):
    assert harness["ok"], harness.get("fail") or harness.get("error")
    c = harness["checks"]
    for k in ("default_file", "global_over_default", "personal_over_global", "personal_removed_back_to_global", "global_removed_back_to_default",
              "synth_fallback", "override_beats_synth"):
        assert c[k], k


def test_disabled_sounds_play_nothing_anywhere(harness):
    c = harness["checks"]
    for k in ("disabled_is_silent", "disabled_play_reports_handled", "disabled_synth_is_silent", "disabled_loop_silent_handle", "fanfare_off", "crowd_off",
              "voice_off", "prefs_saved", "preview_ignores_off", "off_restored_after_preview"):
        assert c[k], k


def test_specials_volume_registry_and_wav_writer(harness):
    c = harness["checks"]
    for k in ("volume_applied", "loop_override", "fanfare_override", "voice_override", "voice_name_stable", "classify_groups", "registry_flags",
              "every_core_name_described", "wav_header", "fit_downsamples_to_limit", "muted_silent"):
        assert c[k], k
    assert all(v for k, v in c.items() if k.startswith("registry_has_")), c


def test_browser_wav_passes_server_validation(harness):
    kind, secs = SND.sniff(base64.b64decode(harness["wav"]))
    assert kind == "wav" and abs(secs - 0.5) < 0.01


# ---------- reading files ----------
def test_sniff_reads_wav_mp3_and_m4a_lengths():
    assert SND.sniff(wav(1.5)) == ("wav", 1.5)
    kind, secs = SND.sniff(mp3(40))
    assert kind == "mp3" and abs(secs - 40 * 1152 / 44100) < 0.01
    kind, secs = SND.sniff(m4a(3.25))
    assert kind == "m4a" and abs(secs - 3.25) < 0.001
    assert SND.sniff(b"hello, not audio" * 50) == (None, None)
    assert SND.sniff(b"OggS" + b"\x00" * 400) == (None, None)  # Ogg: older iPhones cannot play it, so it is refused


@pytest.mark.parametrize("data,msg", [
    (b"just text" * 100, "not a WAV, MP3 or M4A"),
    (wav(0.01), "too short"),
    (wav(SND.MAX_SECONDS + 5, rate=4000), "seconds long"),
    (b"RIFF" + b"\x00" * (SND.MAX_BYTES + 10), "MB"),
])
def test_validation_refuses_bad_files(data, msg):
    with pytest.raises(SND.Invalid) as e:
        SND.validate(up(data))
    assert msg in str(e.value)


def test_names_are_checked():
    assert SND.clean_name("voice:v1234abcd12") == "voice:v1234abcd12"
    for bad in ("", "../x", "a b", "X" * 90, "<script>"):
        with pytest.raises(SND.Invalid):
            SND.clean_name(bad)


# ---------- permissions and the API ----------
def test_anonymous_cannot_list_or_upload(client, arcade_on):
    url = reverse("games:api_sounds", args=[SLUG])
    assert client.get(url).status_code == 403
    assert client.post(url, {"name": "click", "file": up(wav(1))}).status_code == 403


def test_player_lists_but_cannot_upload_or_revert(client, player):
    client.force_login(player)
    url = reverse("games:api_sounds", args=[SLUG])
    j = client.get(url).json()
    assert j["can_global"] is False and j["sounds"] == [] and j["max_bytes"] == SND.MAX_BYTES
    r = client.post(url, {"name": "click", "file": up(wav(1))})
    assert r.status_code == 403 and not GlobalSound.objects.exists()
    GlobalSound.objects.create(slug=SLUG, name="click", file="games/sounds/x.wav", content_type="audio/wav")
    assert client.post(reverse("games:api_sound_revert", args=[SLUG]), {"name": "click"}).status_code == 403
    assert GlobalSound.objects.filter(name="click").exists()


def test_superadmin_uploads_replaces_serves_and_reverts(client, superadmin, player):
    client.force_login(superadmin)
    url = reverse("games:api_sounds", args=[SLUG])
    assert client.get(url).json()["can_global"] is True
    r = client.post(url, {"name": "horn_car", "file": up(wav(1.0))})
    assert r.status_code == 200, r.content
    s = r.json()["sound"]
    assert s["name"] == "horn_car" and s["v"] == 1 and s["type"] == "audio/wav" and abs(s["dur"] - 1.0) < 0.01
    row = GlobalSound.objects.get(slug=SLUG, name="horn_car")
    first = row.file.name
    assert row.uploaded_by == superadmin and "horn_car" not in first  # stored under a random name
    # replacing bumps the version and removes the old file
    r = client.post(url, {"name": "horn_car", "file": up(mp3(20), "h.mp3", "audio/mpeg")})
    assert r.json()["sound"]["v"] == 2 and r.json()["sound"]["type"] == "audio/mpeg"
    row.refresh_from_db()
    assert not row.file.storage.exists(first)
    # bad files are refused with a message
    r = client.post(url, {"name": "horn_car", "file": up(b"nope" * 100, "x.wav")})
    assert r.status_code == 400 and "WAV, MP3 or M4A" in r.json()["error"]
    # a player hears it: listed and served
    client.force_login(player)
    listed = client.get(url).json()["sounds"]
    assert [x["name"] for x in listed] == ["horn_car"]
    f = client.get(listed[0]["url"])
    assert f.status_code == 200 and f["Content-Type"] == "audio/mpeg" and b"".join(f.streaming_content)[:3] == b"ID3"
    # revert
    client.force_login(superadmin)
    path = row.file.name
    r = client.post(reverse("games:api_sound_revert", args=[SLUG]), {"name": "horn_car"})
    assert r.json()["ok"] is True and not GlobalSound.objects.exists() and not row.file.storage.exists(path)
    assert client.get(listed[0]["url"]).status_code == 404


def test_upload_is_audited(client, superadmin):
    from core.models import AuditLogEntry
    client.force_login(superadmin)
    client.post(reverse("games:api_sounds", args=[SLUG]), {"name": "click", "file": up(wav(.5))})
    assert AuditLogEntry.objects.filter(model_label="games.GlobalSound", note__icontains="replaced for everyone").exists()


# ---------- Arcade Management ----------
def test_management_page_lists_plays_downloads_and_reverts(client, superadmin):
    client.force_login(superadmin)
    SND.save(SLUG, "click", up(wav(.5)), superadmin)
    page = client.get(reverse("games:settings_sounds"))
    html = page.content.decode()
    assert page.status_code == 200 and "<code>click</code>" in html and "<audio controls" in html and "download=1" in html and "Revert" in html
    assert 'href="' + reverse("games:settings_sounds") + '"' in client.get(reverse("games:settings")).content.decode()  # in the nav
    dl = client.get(reverse("games:sound_file", args=[SLUG, "click"]) + "?download=1")
    assert "attachment" in dl["Content-Disposition"]
    for fmt, ctype in (("pdf", "application/pdf"), ("docx", "wordprocessingml"), ("xlsx", "spreadsheetml")):
        r = client.get(reverse("games:settings_sounds") + "?format=" + fmt)
        assert r.status_code == 200 and ctype in r["Content-Type"], fmt
    assert b"click" in client.get(reverse("games:settings_sounds") + "?format=html").content
    r = client.post(reverse("games:settings_sounds"), {"action": "revert", "slug": SLUG, "name": "click"})
    assert r.status_code == 302 and not GlobalSound.objects.exists()
    r = client.post(reverse("games:settings_sounds"), {"action": "upload", "slug": SLUG, "name": "coin", "file": up(wav(.4))})
    assert r.status_code == 302 and GlobalSound.objects.filter(name="coin").exists()


def test_management_page_hidden_from_players(client, player):
    client.force_login(player)
    assert client.get(reverse("games:settings_sounds")).status_code == 404
    assert client.post(reverse("games:settings_sounds"), {"action": "upload", "slug": SLUG, "name": "coin", "file": up(wav(.4))}).status_code == 404
    assert not GlobalSound.objects.exists()


# ---------- wiring ----------
def test_panel_script_is_on_every_game_page_and_offline():
    play = (ROOT / "templates" / "games" / "play.html").read_text()
    assert play.index("js/games/arcade-audio.js") < play.index("js/games/arcade-sounds.js") < play.index("{% for s in scripts %}")
    from games import offline
    assert "js/games/arcade-sounds.js" in offline.COMMON
    settings_js = (JS / "arcade-settings.js").read_text()
    assert '["sounds", "Sounds"]' in settings_js and "ArcadeSounds.mount" in settings_js
