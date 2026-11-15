"""People and access: who may open what, and every screen renders."""
import pytest
from django.core.management import call_command
from django.urls import reverse

from accounts.models import Appointment, Office, RegNumberCategory, User


@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


def _all_get_urls():
    u = User.objects.get(email="lecturer@demo.eehub")
    cat = RegNumberCategory.objects.first()
    return [
        reverse("access:home"), reverse("access:users"), reverse("access:users") + "?q=demo&kind=student&active=1",
        reverse("access:users") + "?kind=none", reverse("access:users") + "?office=hod",
        reverse("access:user_create"), reverse("access:user_import"), reverse("access:user_import") + "?template=1",
        reverse("access:user_detail", args=[u.pk]), reverse("access:user_edit", args=[u.pk]),
        reverse("access:user_reset_password", args=[u.pk]), reverse("access:user_profiles", args=[u.pk]),
        reverse("access:user_overrides", args=[u.pk]), reverse("access:person_search") + "?q=demo",
        reverse("access:offices"), reverse("access:offices") + "?show=templates&category=leadership&q=h",
        reverse("access:office_create"), reverse("access:office_create") + "?from=template-coordinator",
        reverse("access:office_create") + "?from=hod",
        reverse("access:office_edit", args=["hod"]), reverse("access:office_appoint", args=["class-rep"]),
        reverse("access:matrix"), reverse("access:matrix") + "?category=all&q=result&roles=0",
        reverse("access:matrix_holders"), reverse("access:matrix_holders") + "?col=office:hod",
        reverse("access:matrix_holders") + "?col=role:student", reverse("access:matrix_holders") + "?perm=accounts.users_manage",
        reverse("access:profile_role_edit", args=["lecturer"]),
        reverse("access:regno_list"), reverse("access:regno_create"), reverse("access:regno_edit", args=[cat.pk]),
        reverse("access:regno_preview"), reverse("access:regno_preview") + "?samples=U21EE1031&auto_pattern=on&test=U2EE",
        reverse("access:regno_preview") + "?mode=identify&test=U21EE1031",
    ]


def test_admin_sees_every_screen(seeded, client):
    client.force_login(User.objects.get(email="admin@demo.eehub"))
    for url in _all_get_urls():
        r = client.get(url)
        assert r.status_code == 200, url


def test_hod_can_manage_access(seeded, client):
    client.force_login(User.objects.get(email="hod@demo.eehub"))
    for name in ("access:home", "access:users", "access:offices", "access:matrix", "access:regno_list"):
        assert client.get(reverse(name)).status_code == 200, name


def test_student_gets_403_everywhere(seeded, client):
    client.force_login(User.objects.get(email="student@demo.eehub"))
    for url in _all_get_urls():
        assert client.get(url).status_code == 403, url
    appt = Appointment.objects.first()
    u = User.objects.get(email="lecturer@demo.eehub")
    for url in (reverse("access:matrix_toggle"), reverse("access:user_toggle_active", args=[u.pk]),
                reverse("access:appointment_end", args=[appt.pk]), reverse("access:office_create"),
                reverse("access:regno_preview")):
        assert client.post(url, {"col": "office:hod", "perm": 1}).status_code == 403, url
    assert User.objects.get(pk=u.pk).is_active


def test_anonymous_is_sent_to_sign_in(seeded, client):
    r = client.get(reverse("access:users"))
    assert r.status_code == 302


def test_lecturer_without_offices_is_refused(seeded, client):
    client.force_login(User.objects.get(email="lecturer@demo.eehub"))
    assert client.get(reverse("access:users")).status_code == 403
    assert client.get(reverse("access:matrix")).status_code == 403


def test_users_list_filters(seeded, client):
    client.force_login(User.objects.get(email="admin@demo.eehub"))
    r = client.get(reverse("access:users"), {"q": "U24EE1031"})
    rows = r.context["rows"]
    assert [row["u"].email for row in rows] == ["student@demo.eehub"]
    r = client.get(reverse("access:users"), {"kind": "lecturer"})
    emails = {row["u"].email for row in r.context["rows"]}
    assert "lecturer@demo.eehub" in emails and "student@demo.eehub" not in emails
    r = client.get(reverse("access:users"), {"office": "class-rep"})
    assert {row["u"].email for row in r.context["rows"]} == {"classrep@demo.eehub"}
