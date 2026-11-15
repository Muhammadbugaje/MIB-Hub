"""Registration-number formats: live preview, identify, create/edit."""
import pytest
from django.core.management import call_command
from django.urls import reverse

from accounts.access_views import pattern_tokens
from accounts.models import RegNumberCategory, User


@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


@pytest.fixture
def admin(seeded, client):
    client.force_login(User.objects.get(email="admin@demo.eehub"))
    return client


def test_preview_builds_pattern_explains_and_tests(admin):
    r = admin.post(reverse("access:regno_preview"), {"samples": "pgs/2024/0012\nPGS/2025/0100", "auto_pattern": "on", "test": "PGS/2025/01X0"},
                   HTTP_HX_REQUEST="true")
    assert r.status_code == 200
    p = r.context["p"]
    assert p["pattern"] == r"^PGS/\d{4}/\d{4}$"
    assert "4 digits" in p["explain"]
    assert p["example"] == "PGS/1234/1234"
    assert all(s["ok"] for s in p["samples"])
    assert p["test_ok"] is False and "position 10" in p["why"]["text"]
    html = r.content.decode()
    assert "does not fit" in html and "acc-tok--digits" in html


def test_preview_good_number_and_overlap(admin):
    r = admin.post(reverse("access:regno_preview"), {"samples": "U21EE1031", "auto_pattern": "on", "test": "u23ee0042"})
    p = r.context["p"]
    assert p["test_ok"] is True
    assert [c.code for c in p["also"]] == ["beng-undergraduate"]
    assert [c.code for c in p["overlaps"]] == ["beng-undergraduate"]


def test_preview_manual_pattern_and_errors(admin):
    r = admin.post(reverse("access:regno_preview"), {"pattern": "^SP\\d{4}$", "test": "SP12"})
    p = r.context["p"]
    assert not p["auto"] and p["test_ok"] is False
    r = admin.post(reverse("access:regno_preview"), {"pattern": "^(unclosed$"})
    assert r.context["p"]["error"]
    r = admin.get(reverse("access:regno_preview"))
    assert r.context["p"]["empty"]


def test_identify_mode(admin):
    r = admin.get(reverse("access:regno_preview"), {"mode": "identify", "test": "U22EE1004"})
    assert r.context["found"].code == "beng-undergraduate"
    r = admin.get(reverse("access:regno_preview"), {"mode": "identify", "test": "ZZZ"})
    assert r.context["found"] is None


def test_tokens_cover_alternatives():
    alts = pattern_tokens(r"^(?:U\d{2}EE\d{4}|PGS/\d{4}/\d{4})$")
    assert len(alts) == 2
    assert [t["kind"] for t in alts[0]] == ["literal", "digits", "literal", "digits"]
    assert [t["sample"] for t in alts[1]] == ["PGS", "/", "1234", "/", "1234"]


def test_create_and_edit_format(admin):
    r = admin.post(reverse("access:regno_create"), {"name": "PhD students", "code": "", "profile_kind": "student",
                                                    "samples": "p21eeph9001\nP22EEPH9002", "auto_pattern": "on", "priority": 5,
                                                    "is_active": "on"})
    assert r.status_code == 302
    c = RegNumberCategory.objects.get(code="phd-students")
    assert c.pattern == r"^P\d{2}EEPH\d{4}$" and c.samples == "P21EEPH9001\nP22EEPH9002"
    r = admin.post(reverse("access:regno_edit", args=[c.pk]), {"name": "PhD students", "code": c.code, "profile_kind": "student",
                                                               "samples": "P21EEPH9001", "pattern": "^P\\d{2}EE$", "priority": 5})
    assert r.status_code == 200 and "do not match" in str(r.context["form"].errors)
    r = admin.post(reverse("access:regno_edit", args=[c.pk]), {"name": "PhD students", "code": c.code, "profile_kind": "student",
                                                               "samples": "", "pattern": "", "auto_pattern": "on", "priority": 5})
    assert r.status_code == 200 and "samples" in r.context["form"].errors
    admin.post(reverse("access:regno_edit", args=[c.pk]), {"action": "delete"})
    assert not RegNumberCategory.objects.filter(pk=c.pk).exists()


def test_user_manager_may_identify_but_not_preview(seeded, client):
    from django.contrib.auth.models import Permission
    u = User.objects.get(email="lecturer@demo.eehub")
    u.user_permissions.add(Permission.objects.get(codename="users_manage"))
    client.force_login(u)
    assert client.get(reverse("access:regno_preview"), {"mode": "identify", "test": "U22EE1004"}).status_code == 200
    assert client.get(reverse("access:regno_preview"), {"samples": "U1"}).status_code == 403
