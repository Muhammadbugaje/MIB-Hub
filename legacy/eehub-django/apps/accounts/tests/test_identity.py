"""Phase 0 foundation: reg-number regex, profiles, the Acting-as switcher and the permission resolver."""
import pytest
from django.core.management import call_command
from django.urls import reverse

from accounts import regno
from accounts.access import available_profiles, effective_permissions, invalidate
from accounts.models import Appointment, Office, Person, RegNumberCategory, User


# --- registration numbers -------------------------------------------------
@pytest.mark.parametrize("samples,expected", [
    (["U21EE1047"], r"^U\d{2}EE\d{4}$"),
    (["U21EE1047", "U20PR2015"], r"^U\d{2}[A-Z]{2}\d{4}$"),
    (["PGS/2024/0012"], r"^PGS/\d{4}/\d{4}$"),
])
def test_pattern_from_samples(samples, expected):
    assert regno.pattern_from_samples(samples) == expected


def test_mixed_shapes_become_alternatives():
    p = regno.pattern_from_samples(["U21EE1047", "PGS/2024/0012"])
    import re
    assert re.fullmatch(p, "U22EE1000") and re.fullmatch(p, "PGS/2025/0100")
    assert not re.fullmatch(p, "U22EE100")


def test_example_and_explain_are_consistent():
    p = regno.pattern_from_samples(["U21EE1047"])
    import re
    assert re.fullmatch(p, regno.example_for(p))
    assert regno.explain(p)


@pytest.mark.django_db
def test_category_builds_pattern_on_save():
    cat = RegNumberCategory.objects.create(name="Test", code="t", samples="U21EE1047\nU20PR2015")
    assert cat.pattern == r"^U\d{2}[A-Z]{2}\d{4}$"
    assert cat.matches("u23ee0001")
    assert not cat.matches("EE/123")


# --- profiles and permissions ---------------------------------------------
@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


def test_multi_profile_person(seeded):
    u = User.objects.get(email="lecturer@demo.eehub")
    kinds = [p.kind for p in available_profiles(u)]
    assert kinds == ["lecturer", "student"]


def test_permissions_follow_the_active_profile(seeded):
    u = User.objects.get(email="classrep@demo.eehub")
    rep = Office.objects.get(code="class-rep")
    perm = rep.permissions.first()
    assert perm is not None, "class rep office should carry permissions"
    label = f"{perm.content_type.app_label}.{perm.codename}"
    assert label in effective_permissions(u, "student")
    invalidate(u)
    assert label not in effective_permissions(u, "alumni")


def test_ended_appointment_removes_permissions(seeded):
    from django.utils import timezone
    u = User.objects.get(email="exams@demo.eehub")
    office = Office.objects.get(code="exam-officer")
    only_here = set()
    for p in office.permissions.select_related("content_type"):
        only_here.add(f"{p.content_type.app_label}.{p.codename}")
    before = effective_permissions(u, "lecturer")
    assert only_here <= before
    Appointment.objects.filter(person=u.person, office=office).update(end_date=timezone.localdate() - timezone.timedelta(days=1))
    invalidate(u)
    after = effective_permissions(u, "lecturer")
    others = set()
    for a in u.person.appointments.exclude(office=office):
        others |= {f"{p.content_type.app_label}.{p.codename}" for p in a.office.permissions.select_related("content_type")}
    from accounts.models import ProfileRole
    base = {f"{p.content_type.app_label}.{p.codename}" for p in ProfileRole.objects.get(kind="lecturer").permissions.select_related("content_type")}
    assert not (only_here - others - base) & after


def test_switch_profile_view(seeded, client):
    u = User.objects.get(email="lecturer@demo.eehub")
    client.force_login(u)
    student = [p for p in available_profiles(u) if p.kind == "student"][0]
    r = client.post(reverse("accounts:switch_profile"), {"key": student.key})
    assert r.status_code in (200, 302)
    assert client.session["ee_active_profile"] == student.key


def test_cannot_switch_to_someone_elses_profile(seeded, client):
    u = User.objects.get(email="student@demo.eehub")
    client.force_login(u)
    client.post(reverse("accounts:switch_profile"), {"key": "lecturer:1"})
    assert client.session.get("ee_active_profile") != "lecturer:1"


# --- sign in ----------------------------------------------------------------
def test_login_with_reg_number_json(seeded, client):
    r = client.post(reverse("accounts:login"), {"identifier": "u24ee1031", "password": "EEHub@2026"},
                    HTTP_ACCEPT="application/json", HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_login_page_renders(seeded, client):
    assert client.get(reverse("accounts:login")).status_code == 200


def test_bad_password_rejected(seeded, client):
    r = client.post(reverse("accounts:login"), {"identifier": "student@demo.eehub", "password": "nope"},
                    HTTP_ACCEPT="application/json", HTTP_X_REQUESTED_WITH="XMLHttpRequest")
    assert r.status_code in (200, 400, 401)
    assert not r.json().get("ok")


def test_demo_remove_cleans_up(seeded):
    n_people = Person.objects.count()
    assert n_people >= 9
    call_command("seed_demo", "--remove", verbosity=0)
    assert not User.objects.filter(email__endswith="@demo.eehub").exists()
    assert Person.all_objects.count() == 0
