"""FSLG characters, game config and credits (games/fslg_admin.py, static/js/games/samaru-overrides.js,
static/js/games/fslg-admin.js): permissions, validation, history and rollback, the audit log, the bundle the game reads,
the Node harness (overrides apply, corrupt data falls back, tokens, live rename, credits with 0/1/300 entries), and a
check that FSLG player-facing code has no hard-coded game name."""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from games import fslg_admin as FA
from games.models import FSLGContent, FSLGContentVersion

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / "static" / "js" / "games"
NVM = sorted(Path.home().glob(".nvm/versions/node/*/bin/node"))
NODE = shutil.which("node") or (str(NVM[-1]) if NVM else None)


@pytest.fixture
def arcade_on(db):
    from django.core.management import call_command

    from memos.tests.helpers import set_setting
    call_command("seed_config", verbosity=0)
    set_setting("features.games", True)


@pytest.fixture
def owner(db, arcade_on):
    return get_user_model().objects.create_superuser(email="owner@example.com", password="pw-123456789")


@pytest.fixture
def player(db, arcade_on):
    return get_user_model().objects.create_user(email="student@example.com", password="pw-123456789")


def post(client, name, body):
    return client.post(reverse(name), data=json.dumps(body), content_type="application/json")


# ---------- permissions ----------
def test_anonymous_cannot_read_or_write(client, arcade_on):
    assert client.get(reverse("games:api_fslg")).status_code == 403
    assert post(client, "games:api_fslg_save", {"kind": "config", "data": {"gameName": "X"}}).status_code == 403


def test_player_reads_only(client, player):
    client.force_login(player)
    r = client.get(reverse("games:api_fslg"))
    assert r.status_code == 200
    b = r.json()
    assert b["schema"] == 1 and b["config"]["gameName"] == "Freshers School Life" and b["can_edit"] is False
    for name, body in (("games:api_fslg_save", {"kind": "config", "data": {"gameName": "Hacked"}}), ("games:api_fslg_reset", {"kind": "config"}),
                       ("games:api_fslg_rollback", {"kind": "config", "version": 1})):
        assert post(client, name, body).status_code == 403
    assert client.get(reverse("games:api_fslg_history") + "?kind=config").status_code == 403
    for page in ("games:fslg_characters", "games:fslg_config", "games:fslg_credits"):
        assert client.get(reverse(page)).status_code == 404
    assert FA.config()["gameName"] == "Freshers School Life"


def test_super_admin_pages_and_nav(client, owner):
    client.force_login(owner)
    for page in ("games:fslg_characters", "games:fslg_config", "games:fslg_credits"):
        r = client.get(reverse(page))
        assert r.status_code == 200, page
        html = r.content.decode()
        assert "FSLG Characters" in html and "samaru-overrides" in html and "fslg-admin" in html
    assert "FSLG Characters" in client.get(reverse("games:settings_sounds")).content.decode()


def test_nav_hides_fslg_editors_from_managers(client, arcade_on):
    from django.contrib.auth.models import Permission
    u = get_user_model().objects.create_user(email="mgr@example.com", password="pw-123456789")
    u.user_permissions.add(Permission.objects.get(codename="manage_game_settings"))
    client.force_login(u)
    r = client.get(reverse("games:settings_sounds"))
    if r.status_code == 200:
        assert "FSLG Characters" not in r.content.decode()
    assert client.get(reverse("games:fslg_config")).status_code == 404


# ---------- validation ----------
@pytest.mark.parametrize("data,msg", [
    ({"gameName": ""}, "cannot be empty"),
    ({"gameName": "x" * 61}, "limit is 60"),
    ({"gameName": "Ok", "initialsOverride": "TOOLONG"}, "limit is 6"),
    ({"gameName": "Ok", "initialsOverride": "A-B"}, "1 to 6 letters"),
    ({"gameName": "Ok", "primaryColour": "red"}, "colour like"),
    ({"gameName": "Ok", "tagline": "Hi {{NAME}}"}, "unknown token"),
    ({"gameName": "Ok {{GAME_NAME}}"}, "cannot contain tokens"),
    ({"gameName": "Ok", "evil": 1}, "unknown field"),
])
def test_config_validation(data, msg):
    with pytest.raises(FA.Invalid) as e:
        FA.validate_config(data)
    assert msg in str(e.value)


def test_config_cleaning_and_initials():
    c = FA.validate_config({"gameName": "  <b>Zaria</b>  Uni\x00 Days ", "initialsOverride": "zud"})
    assert c["gameName"] == "Zaria Uni Days" and c["initialsOverride"] == "ZUD"
    assert FA.initials_of("Freshers School Life Game") == "FSLG" and FA.initials_of("one two three four five six seven") == "OTTFFS"


def test_character_validation():
    ok = FA.validate_character("ada", {"name": " Adaeze <script>x</script>", "look": {"hair": "afro", "skin": "#7D4E2E", "fit": {"top": "tee.2"}, "acc": ["watch.0"], "scale": 1.1},
                                       "att": {"hit": "flee", "romance": True, "routine": [["library", 14], ["buka", 8]], "likes": ["kilishi"]},
                                       "voice": {"pitch": 1.2, "tone": "bright", "role": "women_b"},
                                       "lines": {"v0123abcd1a": {"t": "Hello {{PLAYER_NAME}} (again)", "o": "Hello {{PLAYER_NAME}}"}}})
    assert ok["name"] == "Adaeze x" and ok["look"]["skin"] == "#7d4e2e" and ok["att"]["routine"] == [["buka", 8.0], ["library", 14.0]]
    assert ok["att"]["romance"] is True and ok["lines"]["v0123abcd1a"]["t"] == "Hello {{PLAYER_NAME}} (again)"
    bad = [
        ({"lines": {"v0123abcd1a": {"t": "Hello you", "o": "Hello {{PLAYER_NAME}}"}}}, "keep it"),
        ({"lines": {"v0123abcd1a": {"t": "Hi {{PLAYER}}", "o": "Hi"}}}, "unknown token"),
        ({"lines": {"v0123abcd1a": {"t": "Hi {{PLAYER_NAME}", "o": "Hi"}}}, "broken"),
        ({"lines": {"v0123abcd1a": {"t": "Hi (there", "o": "Hi"}}}, "never closed"),
        ({"lines": {"v0123abcd1a": {"t": "Hi] there", "o": "Hi"}}}, "no opening"),
        ({"lines": {"../../x": {"t": "Hi", "o": "Hi"}}}, "not valid"),
        ({"look": {"hair": "mohawk"}}, "not one of the choices"),
        ({"look": {"fit": {"top": "<x>"}}}, "not a wardrobe item"),
        ({"att": {"speed": 9}}, "between"),
        ({"att": {"romance": "f", "routine": [["library"]]}}, "place and an hour"),
        ({"bio": "x" * 401}, "limit is 400"),
        ({"hack": 1}, "unknown field"),
    ]
    for data, msg in bad:
        with pytest.raises(FA.Invalid) as e:
            FA.validate_character("ada", data)
        assert msg in str(e.value), (data, str(e.value))
    with pytest.raises(FA.Invalid):
        FA.validate_character("../ada", {})
    many = {"v%08x1a" % i: {"t": "x" * 390, "o": "y"} for i in range(400)}
    with pytest.raises(FA.Invalid) as e:
        FA.validate_character("ada", {"lines": many})
    assert "KB" in str(e.value)


def test_credits_validation_and_players_see_only_approved(db):
    with pytest.raises(FA.Invalid) as e:
        FA.validate_credits({"sections": [{"title": "A", "entries": [{"name": "Bob", "link": "javascript:alert(1)"}]}]})
    assert "https://" in str(e.value)
    with pytest.raises(FA.Invalid):
        FA.validate_credits({"sections": [{"title": "A", "entries": [{"name": ""}]}]})
    c = FA.credits()
    names = [e["name"] for s in c["sections"] for e in s["entries"]]
    assert names == ["M.I. BUGAJE"]  # the seeded friends wait for approval
    everyone = FA.credits(all_entries=True)
    voices = [s for s in everyone["sections"] if s["id"] == "voices"][0]["entries"]
    assert len(voices) > 20 and not any(e["approved"] for e in voices)
    assert all(e["approved"] for e in [s for s in everyone["sections"] if s["id"] == "created"][0]["entries"])
    warn = FA.credit_warnings(FA.validate_credits({"sections": [{"title": "A", "entries": [{"name": "Bob", "role": "x"}, {"name": "Bob", "role": "x"}, {"name": "Ann"}]}]}))
    assert any("appears 2 times" in w for w in warn) and any("no role" in w for w in warn)


# ---------- saving, history, rollback, audit ----------
def test_save_rollback_reset_and_audit(client, owner):
    from core.models import AuditLogEntry
    client.force_login(owner)
    r1 = post(client, "games:api_fslg_save", {"kind": "config", "data": {"gameName": "Zaria Uni Days", "gameShortName": "ZUD"}, "note": "first"})
    assert r1.status_code == 200 and r1.json()["config"]["initials"] == "ZUD"
    r2 = post(client, "games:api_fslg_save", {"kind": "config", "data": {"gameName": "Samaru Life", "gameShortName": "SL"}})
    assert r2.json()["version"] == 2 and FA.config()["gameName"] == "Samaru Life"
    h = client.get(reverse("games:api_fslg_history") + "?kind=config").json()["history"]
    assert [x["version"] for x in h] == [2, 1] and h[1]["note"] == "first" and "owner@example.com" in h[0]["by"]
    r3 = post(client, "games:api_fslg_rollback", {"kind": "config", "key": "", "version": 1})
    assert r3.status_code == 200 and r3.json()["version"] == 3 and FA.config()["gameName"] == "Zaria Uni Days"
    assert "Rolled back to version 1" in FSLGContentVersion.objects.filter(kind="config").first().note
    assert post(client, "games:api_fslg_rollback", {"kind": "config", "version": 99}).status_code == 400
    log = AuditLogEntry.objects.filter(model_label="games.FSLGContent", note__startswith="FSLG game config saved")
    assert log.count() == 3
    first = log.order_by("id").first()
    assert first.actor == owner and first.changes["gameName"] == [None, "Zaria Uni Days"]
    assert log.order_by("-id").first().changes["gameName"] == ["Samaru Life", "Zaria Uni Days"]
    # a character, then reset to the game's own
    rc = post(client, "games:api_fslg_save", {"kind": "character", "key": "ada", "data": {"name": "Adaeze"}})
    assert rc.status_code == 200 and client.get(reverse("games:api_fslg")).json()["characters"]["ada"]["name"] == "Adaeze"
    assert post(client, "games:api_fslg_reset", {"kind": "character", "key": "ada"}).status_code == 200
    assert "ada" not in client.get(reverse("games:api_fslg")).json()["characters"]
    assert AuditLogEntry.objects.filter(note__contains="ada reset to defaults").exists()
    bad = post(client, "games:api_fslg_save", {"kind": "character", "key": "ada", "data": {"lines": {"v0123abcd1a": {"t": "x {{NOPE}}", "o": "x"}}}})
    assert bad.status_code == 400 and "unknown token" in bad.json()["error"]
    assert post(client, "games:api_fslg_save", {"kind": "secrets", "data": {}}).status_code == 400


def test_bundle_is_versioned_with_etag(client, owner, player):
    client.force_login(player)
    r = client.get(reverse("games:api_fslg"))
    tag = r["ETag"]
    assert client.get(reverse("games:api_fslg"), HTTP_IF_NONE_MATCH=tag).status_code == 304
    FA.save("config", "", {"gameName": "New Name", "gameShortName": "NN"}, owner)
    r2 = client.get(reverse("games:api_fslg"), HTTP_IF_NONE_MATCH=tag)
    assert r2.status_code == 200 and r2.json()["v"] > r.json()["v"] and r2.json()["config"]["gameName"] == "New Name"


def test_play_page_and_manifest_follow_the_config(client, owner):
    FA.save("config", "", {"gameName": "Zaria Uni Days", "gameShortName": "ZUD"}, owner)
    m = client.get(reverse("games:game_manifest", args=["samaru-days"])).json()
    assert m["name"] == "Zaria Uni Days" and m["short_name"] == "ZUD"
    client.force_login(owner)
    html = client.get(reverse("games:play", args=["samaru-days"])).content.decode()
    assert "<title>Zaria Uni Days" in html and "samaru-overrides" in html


def test_history_is_trimmed(owner):
    for i in range(FA.MAX_HISTORY + 5):
        FA.save("character", "ada", {"name": f"Ada {i}"}, owner)
    assert FSLGContentVersion.objects.filter(kind="character", key="ada").count() == FA.MAX_HISTORY
    assert FSLGContent.objects.get(kind="character", key="ada").version == FA.MAX_HISTORY + 5


# ---------- the game (Node harness) ----------
@pytest.fixture(scope="module")
def runs():
    if not NODE:
        pytest.skip("node not installed")
    out = {}
    for mode in ("cached", "corrupt", "none"):
        res = subprocess.run([NODE, str(Path(__file__).with_name("fslg_overrides_harness.js")), str(JS), mode], capture_output=True, text=True, timeout=300)
        assert res.returncode == 0, res.stdout[-2000:] + res.stderr[-2000:]
        out[mode] = json.loads(res.stdout.strip().splitlines()[-1])
        assert out[mode]["ok"], out[mode].get("error")
    return out


def _all(c, keys):
    for k in keys:
        assert c.get(k) is True, k


def test_overrides_apply_before_people_spawn(runs):
    _all(runs["cached"]["c"], ["loaded", "cachedApplied", "renamed", "adaName", "adaLook", "adaFlees", "romanceOppositeSex", "walk", "routine", "pitch",
                               "dataText", "mapLetters", "ownBark", "playerName"])


def test_corrupt_overrides_fall_back_to_defaults(runs):
    _all(runs["corrupt"]["c"], ["defaultsKept", "cachedNull"])
    _all(runs["none"]["c"], ["corruptRefused", "defaults"])


def test_tokens_lines_and_live_rename(runs):
    _all(runs["none"]["c"], ["tokens", "initials", "checkConfig", "catalogue", "kinds", "lineEdited", "lineReverted", "renameLive", "longName", "shortName", "backToDefault"])


def test_credits_render_with_0_1_and_300_entries(runs):
    _all(runs["none"]["c"], ["credits0", "credits1", "credits300", "creditsHidden", "creditsTextOnly", "rollWithoutDom", "rollStubDom"])


# ---------- no hard-coded game name in FSLG player-facing code ----------
# fslg.config.js is the one file allowed to hold the default name (MASTER_GAME_GUIDE §5.2); the bundle is built output.
DATA = {"fslg.bundle.js"}


def _code(text):  # comments are not player-facing: drop block comments (also multi-line ones), keep the line count
    text = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)
    return text.splitlines()


def test_no_hard_coded_game_name_in_fslg_code():
    bad = []
    files = [p for p in sorted(JS.glob("*.js")) if re.match(r"^(samaru|fslg)-", p.name) and p.name not in DATA]
    for p in files:
        for i, ln in enumerate(_code(p.read_text(encoding="utf-8")), 1):
            ln = re.sub(r"^\s*(//|\*).*$", "", ln)
            if re.search(r"Freshers School Life|FRESHERS SCHOOL LIFE|\bFSLG\b", ln):
                bad.append(f"{p.name}: {ln.strip()[:120]}")
    for p in (ROOT / "templates" / "games").glob("*.html"):
        if re.search(r"Freshers School Life|\bFSLG\b", p.read_text(encoding="utf-8")) and not p.name.startswith(("fslg_", "_settings_nav", "_fslg")):
            bad.append(p.name)
    assert not bad, "Use {{GAME_NAME}} / {{GAME_INITIALS}} (Z.resolveText) instead:\n" + "\n".join(bad)
