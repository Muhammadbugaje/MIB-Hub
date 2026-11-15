"""Game Settings: who may open it, cheat-code hashing and overrides, the secret character's code, the
cheats-on-leaderboards switch and the export."""
import hashlib
import json

import pytest
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.test import Client
from django.urls import reverse

from games import cheats as C
from games import progress as P
from games import views as V
from games.models import ArcadeScore, GameSettings
from memos.tests.helpers import as_user, set_setting, world  # noqa: F401

SLUG = "momentum-cup"
DEFAULTS = {"cheats": [{"id": "coins", "label": "Pocket money", "typed": "Rich Kid", "dial": "*7391*44#", "note": "1000 coins"},
                       {"id": "win", "label": "Win the match", "typed": "finalwhistle", "dial": ""}],
            "hero": {"name": "M.I. BUGAJE", "combo": "Up Up Down Down", "swipe": "Draw a Z"},
            "rules": [{"key": "goals", "label": "Goals to win", "type": "int", "default": 5, "min": 1, "max": 9},
                      {"key": "wind", "label": "Wind", "type": "bool", "default": False},
                      {"key": "pace", "label": "Pace", "type": "choice", "default": "normal", "choices": ["slow", "normal", "fast"]},
                      {"key": "bad", "label": "Broken rule", "type": "nonsense", "default": 1}]}


@pytest.fixture
def on(world, tmp_path, monkeypatch):
    set_setting("features.games", True)
    (tmp_path / f"{SLUG}.json").write_text(json.dumps(DEFAULTS), encoding="utf-8")
    (tmp_path / "volt-city.json").write_text("{ not json", encoding="utf-8")
    monkeypatch.setattr(C, "DEFAULTS_DIR", tmp_path)
    cache.clear()
    return world


def boss(on):
    u = on["admin"]
    u.is_superuser = True
    u.is_staff = True
    u.save()
    return u


def url(name="games:settings", *a):
    return reverse(name, args=a)


def test_only_permitted_people_can_open_it(on):
    pages = [url(), url("games:settings_game", SLUG), url("games:settings_export", SLUG), url("games:settings_export_all"),
             url("games:settings_codes"), url("games:settings_guide"), url("games:settings_audit")]
    lecturer = on["lecturer"]
    for client in (Client(), as_user(on["student"], "student"), as_user(lecturer, "lecturer")):
        for p in pages:
            assert client.get(p).status_code == 404, p
        assert client.post(url(), {"action": "defaults", "cheats_on_boards": "on"}).status_code == 404
    plain = as_user(lecturer, "lecturer")
    for page in (reverse("games:index"), reverse("games:play", args=[SLUG]), reverse("dashboards:home")):
        assert b"Arcade Management" not in plain.get(page).content and b"/arcade/settings/" not in plain.get(page).content, page
    assert not GameSettings.objects.exists()  # nobody without access created or changed anything

    su = as_user(boss(on))
    for p in pages:
        assert su.get(p).status_code == 200, p
    for page in (reverse("games:index"), reverse("games:play", args=[SLUG]), reverse("dashboards:home"), "/admin/"):
        assert b"/arcade/settings/" in su.get(page).content, page  # arcade home, every game page, the sidebar, Django admin
    assert su.get(reverse("games:manage")).status_code == 302

    lecturer.user_permissions.add(Permission.objects.get(codename="manage_game_settings", content_type__app_label="games"))
    from accounts.models import User
    granted = as_user(User.objects.get(pk=lecturer.pk), "lecturer")
    assert granted.get(url()).status_code == 200
    assert granted.get(url("games:settings_game", SLUG) + "?tab=cheats").status_code == 200


def test_hash_formula_and_page_config_has_no_plain_codes(on):
    assert C.sha(SLUG, " Rich Kid ") == hashlib.sha256(b"momentum-cup:richkid").hexdigest()
    cfg = C.page_config(SLUG)
    assert cfg["cheats"][0] == {"id": "coins", "typed": hashlib.sha256(b"momentum-cup:richkid").hexdigest(),
                                "dial": hashlib.sha256(b"momentum-cup:*7391*44#").hexdigest()}
    assert cfg["cheats"][1]["dial"] == ""  # no dial code, so nothing to match
    assert cfg["rules"] == {"goals": 5, "wind": False, "pace": "normal"}  # the broken rule is dropped
    assert cfg["hero"] == {"enabled": True, "name": "M.I. BUGAJE", "combo": "Up Up Down Down", "swipe": "Draw a Z"}
    html = as_user(on["lecturer"], "lecturer").get(reverse("games:play", args=[SLUG])).content.decode()
    assert "data-gm-config=" in html and "data-gm-slug=" in html
    for plain in ("Rich Kid", "richkid", "finalwhistle", "7391"):
        assert plain not in html
    # a game with a missing or broken defaults file still plays, with nothing to cheat with
    assert C.page_config("volt-city")["cheats"] == [] and C.page_config("light-bender")["rules"] == {}
    assert as_user(on["lecturer"], "lecturer").get(reverse("games:play", args=["volt-city"])).status_code == 200


def test_edit_validate_and_reset_cheats(on):
    su = as_user(boss(on))
    page = url("games:settings_game", SLUG)
    ok = {"action": "cheats", "tab": "cheats", "typed-coins": "Big Money", "dial-coins": "*7391*44#", "typed-win": "finalwhistle", "dial-win": "*88*1#",
          "on-coins": "on", "on-win": "on"}
    assert su.post(page, ok).status_code == 302
    rows = {c["id"]: c for c in C.cheats(SLUG)}
    assert rows["coins"]["typed"] == "Big Money" and rows["coins"]["changed"] and rows["win"]["dial"] == "*88*1#"
    assert C.page_config(SLUG)["cheats"][0]["typed"] == C.sha(SLUG, "bigmoney")
    from core.models import AuditLogEntry
    entry = AuditLogEntry.objects.filter(model_label="games.GameSettings").first()
    assert entry and "Big Money" not in json.dumps(entry.changes)  # logged, without the codes themselves

    for bad, msg in (({"typed-coins": "abc"}, b"at least 4"), ({"typed-coins": "final whistle"}, b"already used"),
                     ({"dial-coins": "12ab"}, b"digits"), ({"typed-win": "", "dial-win": ""}, b"give it a typed code")):
        r = su.post(page, dict(ok, **bad))
        assert r.status_code == 200 and msg in r.content, bad
    assert {c["id"]: c for c in C.cheats(SLUG)}["coins"]["typed"] == "Big Money"  # a rejected save changes nothing

    assert su.post(page, dict(ok, reset="coins")).status_code == 302
    rows = {c["id"]: c for c in C.cheats(SLUG)}
    assert rows["coins"]["typed"] == "Rich Kid" and rows["win"]["dial"] == "*88*1#"
    assert su.post(page, {"action": "cheats", "reset": "*"}).status_code == 302
    assert not any(c["changed"] for c in C.cheats(SLUG))


def test_rules_form(on):
    su = as_user(boss(on))
    page = url("games:settings_game", SLUG)
    assert b"Goals to win" in su.get(page + "?tab=rules").content
    assert su.post(page, {"action": "rules", "tab": "rules", "rule-goals": "7", "rule-wind": "on", "rule-pace": "fast"}).status_code == 302
    assert C.page_config(SLUG)["rules"] == {"goals": 7, "wind": True, "pace": "fast"}
    for bad in ({"rule-goals": "99"}, {"rule-goals": "x"}, {"rule-pace": "warp"}):
        r = su.post(page, dict({"action": "rules", "rule-goals": "7", "rule-pace": "fast"}, **bad))
        assert r.status_code == 200 and b"gs-errors" in r.content
    assert C.page_config(SLUG)["rules"]["goals"] == 7
    assert su.post(page, {"action": "rules", "rule-goals": "7", "rule-pace": "fast", "reset": "goals"}).status_code == 302
    assert C.page_config(SLUG)["rules"] == {"goals": 5, "wind": False, "pace": "fast"}
    assert su.post(page, {"action": "rules", "reset": "*"}).status_code == 302
    assert C.page_config(SLUG)["rules"] == {"goals": 5, "wind": False, "pace": "normal"}


def hero(client, code, slug=SLUG):
    return client.post(reverse("games:api_hero"), json.dumps({"slug": slug, "code": code}), content_type="application/json")


def test_secret_code_first_run_change_and_verify(on):
    su = as_user(boss(on))
    first = su.get(url())
    code = first.context["shown_code"]
    assert code and len(C.norm(code)) >= 12 and code.encode() in first.content
    assert su.get(url()).context["shown_code"] is None  # shown once
    stored = GameSettings.objects.get(slug="*").data["hero_hash"]
    assert code not in stored and C.norm(code) not in stored

    player = as_user(on["lecturer"], "lecturer")
    assert hero(Client(), code).status_code == 401
    assert hero(player, "wrong").json() == {"ok": False}
    assert hero(player, code.lower().replace("-", " - ")).json()["ok"] is True
    assert hero(player, code, slug="nope").status_code == 400

    assert su.post(url(), {"action": "hero_set", "code": "short", "code2": "short"}).status_code == 200
    assert hero(player, code).json()["ok"] is True  # too short: unchanged
    su.post(url(), {"action": "hero_set", "code": "Tesla Coil 1943", "code2": "Tesla Coil 1943"})
    assert hero(player, code).json()["ok"] is False and hero(player, "teslacoil1943").json()["ok"] is True

    page = url("games:settings_game", SLUG)
    su.post(page, {"action": "hero_set", "tab": "hero", "code": "only-for-the-cup", "code2": "only-for-the-cup"})
    assert hero(player, "teslacoil1943").json()["ok"] is False and hero(player, "only-for-the-cup").json()["ok"] is True
    assert hero(player, "teslacoil1943", slug="volt-city").json()["ok"] is True
    su.post(page, {"action": "hero_clear", "tab": "hero"})
    assert hero(player, "teslacoil1943").json()["ok"] is True

    su.post(page, {"action": "general", "enabled": "on", "cheats_enabled": "on", "cheats_on_boards": "", "hero_enabled": "off"})
    assert hero(player, "teslacoil1943").json()["ok"] is False and C.page_config(SLUG)["hero"]["combo"] == ""
    new = su.post(url(), {"action": "hero_new"}, follow=True).context["shown_code"]
    assert new and hero(player, new, slug="volt-city").json()["ok"] is True


def test_secret_code_guesses_are_limited(on):
    C.set_hero_code(C.GLOBAL, "the-real-code")
    player = as_user(on["lecturer"], "lecturer")
    for _ in range(V.HERO_TRIES):
        assert hero(player, "guess").json() == {"ok": False}
    blocked = hero(player, "the-real-code").json()
    assert blocked["ok"] is False and blocked["wait"] is True
    cache.clear()
    assert hero(player, "the-real-code").json()["ok"] is True


def test_cheated_results_and_the_leaderboard_switch(on):
    clean, cheat = P.profile_for(user=on["student"]), P.profile_for(user=on["lecturer"])
    P.record(clean, {"game": SLUG, "result": "win", "stage": 1, "score": 300})
    out = P.record(cheat, {"game": SLUG, "result": "win", "stage": 1, "score": 900, "cheated": True})
    assert out["cheated"] and out["counted"] is False and out["earned_coins"] == 0 and out["new_badges"] == []
    assert ArcadeScore.objects.get(profile=cheat).cheated is True  # saved all the same
    assert [r["score"] for r in P.leaderboard(SLUG)] == [300]
    assert P.my_rank(SLUG, cheat) is None and P.my_rank(SLUG, clean)["rank"] == 1
    cheat.refresh_from_db()
    assert cheat.xp == 0 and cheat.stats[SLUG]["wins"] == 0 and cheat.stats[SLUG]["best"] == 0

    C.update(C.GLOBAL, cheats_on_boards=True)
    rows = P.leaderboard(SLUG)
    assert [(r["score"], r["cheated"]) for r in rows] == [(900, True), (300, False)]
    assert P.my_rank(SLUG, clean)["rank"] == 2
    out = P.record(cheat, {"game": SLUG, "result": "win", "stage": 2, "score": 100, "hero": True}, now=1e12)
    assert out["counted"] is True and out["earned_coins"] > 0  # the secret character follows the same switch
    page = as_user(on["student"], "student").get(reverse("games:leaderboard")).content
    assert b">cheat</em>" in page

    C.update(SLUG, cheats_on_boards=False)  # one game can opt out of the site default
    assert [r["score"] for r in P.leaderboard(SLUG)] == [300] and C.page_config(SLUG)["cheatsOnBoards"] is False
    assert C.page_config("volt-city")["cheatsOnBoards"] is True


def test_switching_a_game_off(on):
    su, player = as_user(boss(on)), as_user(on["lecturer"], "lecturer")
    assert su.post(url(), {"action": "toggle", "slug": SLUG}).status_code == 302
    assert player.get(reverse("games:play", args=[SLUG])).status_code == 404
    assert su.get(reverse("games:play", args=[SLUG])).status_code == 200
    r = player.post(reverse("games:api_result"), json.dumps({"game": SLUG, "result": "win", "stage": 1}), content_type="application/json")
    assert r.status_code == 400
    su.post(url(), {"action": "toggle", "slug": SLUG})
    assert player.get(reverse("games:play", args=[SLUG])).status_code == 200


def test_export(on):
    su = as_user(boss(on))
    su.post(url("games:settings_game", SLUG), {"action": "cheats", "typed-coins": "Big Money", "dial-coins": "*7391*44#", "typed-win": "finalwhistle",
                                               "dial-win": "", "on-coins": "on", "how-coins": "Type it on the team screen"})
    import io
    import zipfile
    for target in (url("games:settings_export", SLUG), url("games:settings_export_all")):
        pdf = su.get(target)
        assert pdf.status_code == 200 and pdf["Content-Type"] == "application/pdf" and pdf.content[:5] == b"%PDF-"
        assert "attachment" in pdf["Content-Disposition"] and len(pdf.content) > 1500
        html = su.get(target + "?format=html").content.decode()
        assert "Big Money" in html and "Confidential" in html and "Up Up Down Down" in html and "Momentum Cup" in html
        assert "Type it on the team screen" in html and "8 wrong tries" in html
        word = su.get(target + "?format=docx")
        assert word.status_code == 200 and word["Content-Disposition"].endswith('.docx"')
        xml = zipfile.ZipFile(io.BytesIO(word.content)).read("word/document.xml").decode()
        assert "Big Money" in xml and "Up Up Down Down" in xml and "Type it on the team screen" in xml
        excel = su.get(target + "?format=xlsx")
        assert excel.status_code == 200 and excel["Content-Disposition"].endswith('.xlsx"')
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(excel.content))
        rows = list(wb["Cheat codes"].iter_rows(values_only=True))
        assert rows[0][3] == "Typed code" and ("Momentum Cup", "Pocket money", "1000 coins", "Big Money", "*7391*44#", "Type it on the team screen", "On") in rows
        assert [r for r in rows if r[1] == "Win the match"][0][6] == "Off"  # switched off in the form above
        assert any(r[1] == "Reveal on a phone" and r[2] == "Draw a Z" for r in wb["Secret character"].iter_rows(values_only=True))
        assert b"Big Money" in su.get(target + "?format=csv").content
        assert su.get(target + "?format=exe").status_code == 404
    assert su.get(url("games:settings_export", "nope")).status_code == 404


def play_cfg(client, slug=SLUG):
    import html as H
    import re
    page = client.get(reverse("games:play", args=[slug])).content.decode()
    return json.loads(H.unescape(re.search(r'data-gm-config="([^"]*)"', page).group(1)))


def test_cheat_switches(on):
    su, player = as_user(boss(on)), as_user(on["lecturer"], "lecturer")
    page = url("games:settings_game", SLUG)
    assert [c["id"] for c in play_cfg(player)["cheats"]] == ["coins", "win"]
    form = {"action": "cheats", "typed-coins": "Rich Kid", "dial-coins": "*7391*44#", "typed-win": "finalwhistle", "dial-win": "", "on-coins": "on"}
    assert su.post(page, form).status_code == 302  # "win" unticked
    assert [c["id"] for c in play_cfg(player)["cheats"]] == ["coins"]
    assert b"gs-off" in su.get(page + "?tab=cheats").content
    su.post(page, {"action": "cheats", "reset": "*"})
    assert len(play_cfg(player)["cheats"]) == 2

    su.post(url(), {"action": "toggle_cheats", "slug": SLUG})  # this game only
    cfg = play_cfg(player)
    assert cfg["cheats"] == [] and cfg["cheatsEnabled"] is False and len(C.page_config("volt-city")["cheats"]) == 0
    su.post(url(), {"action": "toggle_cheats", "slug": SLUG})
    assert len(play_cfg(player)["cheats"]) == 2

    su.post(url(), {"action": "defaults", "hero_enabled": "on", "cheat_access": "everyone", "hero_access": "code"})  # master switch unticked
    assert play_cfg(player)["cheats"] == [] and C.cheats_enabled(SLUG) is False
    su.post(url(), {"action": "defaults", "cheats_enabled": "on", "hero_enabled": "on", "cheat_access": "everyone", "hero_access": "code"})
    assert len(play_cfg(player)["cheats"]) == 2


def test_who_may_cheat_and_who_may_be_the_secret_character(on):
    from games.tests.test_guests import join
    su = as_user(boss(on))
    staff, student, guest = as_user(on["lecturer"], "lecturer"), as_user(on["student"], "student"), Client()
    join(guest)
    C.set_hero_code(C.GLOBAL, "the-real-code")
    base = {"action": "defaults", "cheats_enabled": "on", "hero_enabled": "on", "cheat_access": "everyone", "hero_access": "code"}

    def seen():
        return [bool(play_cfg(c)["cheats"]) for c in (staff, student, guest)], [hero(c, "the-real-code").json()["ok"] for c in (staff, student, guest)]

    assert seen() == ([True, True, True], [True, True, True])
    su.post(url(), dict(base, cheat_access="signed", hero_access="signed"))
    assert seen() == ([True, True, False], [True, True, False])
    su.post(url(), dict(base, cheat_access="staff", hero_access="staff"))
    assert seen() == ([True, False, False], [True, False, False])
    assert play_cfg(student)["hero"]["enabled"] is False and play_cfg(student)["hero"]["combo"] == ""

    r = su.post(url(), dict(base, cheat_access="named", cheat_users="nobody@nowhere.example", hero_access="code"))
    assert r.status_code == 200 and b"No account has this e-mail" in r.content
    assert su.post(url(), dict(base, cheat_access="named", cheat_users="", hero_access="code")).status_code == 200  # nobody named
    su.post(url(), dict(base, cheat_access="named", cheat_users=on["student"].email.upper(), hero_access="named", hero_users=on["student"].email))
    assert seen() == ([False, True, False], [False, True, False])
    assert on["student"].email.encode() in su.get(url()).content

    # one game can set its own rule; the others keep the site-wide one
    page = url("games:settings_game", SLUG)
    su.post(page, {"action": "general", "enabled": "on", "cheats_enabled": "on", "cheat_access": "everyone", "hero_access": "staff"})
    assert seen() == ([True, True, True], [True, False, False])
    assert bool(play_cfg(staff, "volt-city")["cheats"]) is False and C.access("volt-city", "cheat")[0] == "named"
    su.post(page, {"action": "general", "enabled": "on", "cheats_enabled": "on", "cheat_access": "", "hero_access": ""})
    assert seen() == ([False, True, False], [False, True, False])


def test_starter_code_guide_all_codes_and_log(on, tmp_path):
    d = dict(DEFAULTS, hero=dict(DEFAULTS["hero"], code="Starter#1", powers="Cannot concede."),
             rules=[dict(DEFAULTS["rules"][0], group="Match"), dict(DEFAULTS["rules"][1], group="Weather"), dict(DEFAULTS["rules"][2], group="Weather")])
    (tmp_path / f"{SLUG}.json").write_text(json.dumps(d), encoding="utf-8")
    su, player = as_user(boss(on)), as_user(on["lecturer"], "lecturer")
    from django.test import override_settings
    with override_settings(DEBUG=False):  # the live site never accepts a stand-in code
        assert hero(player, "starter#1").json()["ok"] is False and C.starter_code(SLUG) is None
    with override_settings(DEBUG=True):
        assert "Starter#1" not in json.dumps(play_cfg(player))
        assert hero(player, "starter#1").json()["ok"] is True  # local copy, no real code set yet
        assert hero(player, "starter#1", slug="volt-city").json()["ok"] is False
        assert "Starter#1" in su.get(url("games:settings_game", SLUG) + "?tab=hero").content.decode()
        C.set_hero_code(C.GLOBAL, "the-real-code")  # once a real code exists the stand-in stops working, even locally
        assert hero(player, "starter#1").json()["ok"] is False and hero(player, "the-real-code").json()["ok"] is True
        C.set_hero_code(C.GLOBAL, "")
        assert hero(player, "starter#1").json()["ok"] is True
    C.set_hero_code(C.GLOBAL, "the-real-code")

    page = url("games:settings_game", SLUG)
    tab = su.get(page + "?tab=hero").content.decode()
    for text in ("Up Up Down Down", "Draw a Z", "Cannot concede.", "8 wrong tries"):
        assert text in tab, text
    assert "Starter#1" not in tab  # a real code is set, so the stand-in is neither shown nor accepted
    su.post(page, {"action": "starter_off", "tab": "hero"})
    assert hero(player, "starter#1").json()["ok"] is False and hero(player, "the-real-code").json()["ok"] is True

    guide = su.get(url("games:settings_guide")).content.decode()
    assert "Starter#1" not in guide and "Momentum Cup" in guide and "Cannot concede." in guide and "Volt City" in guide
    rules = su.get(page + "?tab=rules").content.decode()
    assert rules.index(">Match<") < rules.index("Goals to win") < rules.index(">Weather<") < rules.index("Pace")

    codes = su.get(url("games:settings_codes")).content.decode()
    assert "Rich Kid" in codes and "finalwhistle" in codes
    found = su.get(url("games:settings_codes") + "?q=whistle").content.decode()
    assert "finalwhistle" in found and "Rich Kid" not in found and "1 code" in found
    assert "Nothing matches" in su.get(url("games:settings_codes") + "?q=zzzz").content.decode()

    log = su.get(url("games:settings_audit")).content.decode()
    assert "generated the first time Arcade Management is opened" in guide
    assert "starter secret code retired" in log and "Momentum Cup" in log and "the-real-code" not in log and "pbkdf2" not in log
    assert "How to use Arcade Management" in su.get(url()).content.decode()


def test_shipped_files_hold_no_secret_character_code():
    from pathlib import Path
    for f in (Path(C.__file__).parent / "cheat_defaults").glob("*.json"):
        assert "code" not in json.loads(f.read_text(encoding="utf-8")).get("hero", {}), f.name
    assert "Iliyasu#1" not in (Path(C.__file__).parents[1] / "docs" / "FSLG_CHEATS.md").read_text(encoding="utf-8")
