"""A1 / F6: office eligibility through accounts.appointing, in every door."""
import pytest
from django.urls import reverse

from accounts import appointing
from accounts.models import Appointment


def test_defaults_from_plan(r7):
    assert appointing.allowed_profile_kinds(r7.office("hod")) == ["lecturer"]
    assert appointing.allowed_profile_kinds(r7.office("course-allocation-officer")) == ["lecturer"]
    assert appointing.allowed_profile_kinds(r7.office("lab-officer")) == ["staff"]
    assert set(appointing.allowed_profile_kinds(r7.office("class-tutor"))) == {"student", "lecturer"}
    assert appointing.allowed_profile_kinds(r7.office("alumni-mentor")) == ["alumni"]
    assert r7.office("class-rep").level_must_match and not r7.office("class-tutor").level_must_match


@pytest.mark.parametrize("kind", ["student", "alumni"])
def test_students_and_alumni_cannot_hold_staff_offices(r7, kind):
    u = r7.make(f"x-{kind}@demo.eehub", kind)
    for code in ("exam-officer", "hod", "lab-officer", "secretary"):
        with pytest.raises(appointing.EligibilityError):
            appointing.appoint(actor=None, person=u.person, office=r7.office(code), check_actor=False)
        assert appointing.eligible_profile_kinds(u.person, r7.office(code)) == []


def test_staff_cannot_hold_lecturer_office_but_lecturer_can(r7):
    staff = r7.make("x-staff@demo.eehub", "staff")
    lect = r7.make("x-lect@demo.eehub", "lecturer")
    with pytest.raises(appointing.EligibilityError, match="lecturers"):
        appointing.appoint(actor=None, person=staff.person, office=r7.office("timetable-officer"), check_actor=False)
    a = appointing.appoint(actor=None, person=lect.person, office=r7.office("timetable-officer"), check_actor=False)
    assert a.profile_kind == "lecturer" and a.is_current


def test_class_rep_must_be_active_student_of_that_level(r7):
    s300 = r7.make("s300@demo.eehub", "student", level=300)
    deferred = r7.make("sdef@demo.eehub", "student", level=300, status="deferred")
    rep = r7.office("class-rep")
    with pytest.raises(appointing.EligibilityError, match="not a student of"):
        appointing.appoint(actor=None, person=s300.person, office=rep, scope_level=r7.level(400), check_actor=False)
    with pytest.raises(appointing.EligibilityError, match="serves one level"):
        appointing.appoint(actor=None, person=s300.person, office=rep, check_actor=False)
    with pytest.raises(appointing.EligibilityError, match="no active student"):
        appointing.appoint(actor=None, person=deferred.person, office=rep, profile_kind="student",
                           scope_level=r7.level(300), check_actor=False)
    a = appointing.appoint(actor=None, person=s300.person, office=rep, scope_level=r7.level(300), check_actor=False)
    assert a.scope_programme == r7.level(300).programme


def test_tutor_may_be_from_another_level_or_a_lecturer(r7):
    s400 = r7.make("s400@demo.eehub", "student", level=400)
    lect = r7.make("tlect@demo.eehub", "lecturer")
    tutor = r7.office("class-tutor")
    assert appointing.appoint(actor=None, person=s400.person, office=tutor, scope_level=r7.level(300),
                              check_actor=False).profile_kind == "student"
    assert appointing.appoint(actor=None, person=lect.person, office=tutor, profile_kind="lecturer",
                              scope_level=r7.level(300), check_actor=False).profile_kind == "lecturer"


def test_wrong_appointments_listed_and_ended_by_hod(r7, client):
    alum = r7.make("walum@demo.eehub", "alumni")
    # A wrong appointment made before the rules existed (straight into the table).
    bad = Appointment.objects.create(person=alum.person, office=r7.office("exam-officer"), profile_kind="alumni")
    rows = appointing.wrong_appointments()
    assert any(a.pk == bad.pk for a, _ in rows)
    hod = r7.user("hod@demo.eehub")
    r7.login(client, hod)
    r = client.get(reverse("access:review_appointments"))
    assert r.status_code == 200 and "walum" not in r.content.decode() and alum.person.plain_name in r.content.decode()
    r = client.post(reverse("access:appointment_end", args=[bad.pk]), {"next": reverse("access:review_appointments")})
    assert r.status_code == 302
    bad.refresh_from_db()
    assert not bad.is_current
    assert not any(a.pk == bad.pk for a, _ in appointing.wrong_appointments())


def test_review_end_all(r7, client):
    alum = r7.make("walum2@demo.eehub", "alumni")
    bad = Appointment.objects.create(person=alum.person, office=r7.office("secretary"), profile_kind="alumni")
    r7.login(client, r7.user("admin@demo.eehub"))
    assert client.post(reverse("access:review_end_all")).status_code == 302
    bad.refresh_from_db()
    assert not bad.is_current


def test_appoint_view_refuses_ineligible_and_offers_only_allowed_kinds(r7, client):
    r7.login(client, r7.user("admin@demo.eehub"))
    stud = r7.make("vstud@demo.eehub", "student", level=300)
    url = reverse("access:office_appoint", args=["exam-officer"])
    r = client.get(url)
    choices = [c[0] for c in r.context["form"].fields["profile_kind"].choices]
    assert choices == ["lecturer"]
    r = client.post(url, {"person": stud.person.pk, "profile_kind": "lecturer", "start_date": "2026-10-01"})
    assert r.status_code == 200
    assert not Appointment.objects.filter(person=stud.person, office__code="exam-officer").exists()
    # The person picker hides people who may not hold the office.
    r = client.get(reverse("access:person_search"), {"q": "Person", "office": "exam-officer"})
    assert stud.person.full_name not in r.content.decode()


def test_admin_refuses_ineligible(r7, client):
    stud = r7.make("astud@demo.eehub", "student", level=300)
    r7.login(client, r7.user("admin@demo.eehub"))
    office = r7.office("hod")
    r = client.post(reverse("admin:accounts_appointment_add"), {
        "person": stud.person.pk, "office": office.pk, "profile_kind": "student", "start_date": "2026-10-01",
        "scope_label": "", "note": ""})
    assert r.status_code == 200
    assert "Only lecturers" in r.content.decode()
    assert not Appointment.objects.filter(person=stud.person, office=office).exists()


def test_import_refuses_ineligible(r7):
    from core.importexport import REGISTRY
    stud = r7.make("istud@demo.eehub", "student", level=300)
    lect = r7.make("ilect@demo.eehub", "lecturer")
    spec = REGISTRY["import"]["appointments"]()
    result = spec.run([{"email": stud.email, "office": "exam-officer"},
                       {"email": lect.email, "office": "exam-officer"}], dry_run=False)
    assert result.created == 1 and len(result.rejected) == 1
    assert "lecturers" in " ".join(result.rejected[0].errors)


def test_office_form_saves_allowed_kinds(r7, client):
    r7.login(client, r7.user("admin@demo.eehub"))
    o = r7.office("webmaster")
    data = {"name": o.name, "short_name": o.short_name, "description": o.description, "category": o.category,
            "profile_kind": o.profile_kind, "scope_kind": o.scope_kind, "rank": o.rank, "max_holders": 0,
            "icon": o.icon, "color": o.color, "is_active": "on", "allowed_kinds": ["staff"]}
    assert client.post(reverse("access:office_edit", args=[o.code]), data).status_code == 302
    o.refresh_from_db()
    assert o.allowed_profile_kinds == ["staff"]
    # A lecturer-profile office must allow lecturers.
    h = r7.office("hod")
    data.update(name=h.name, profile_kind="lecturer", allowed_kinds=["staff"], icon=h.icon)
    r = client.post(reverse("access:office_edit", args=[h.code]), data)
    assert r.status_code == 200
    h.refresh_from_db()
    assert h.allowed_profile_kinds == ["lecturer"]


def test_closing_profile_ends_its_appointments(r7, client):
    s = r7.make("cstud@demo.eehub", "student", level=300)
    a = r7.appoint(s, "class-rep", "student", r7.level(300))
    r7.login(client, r7.user("admin@demo.eehub"))
    prof = s.person.student_profiles.first()
    client.post(reverse("access:user_profiles", args=[s.pk]), {"action": "close", "kind": "student", "profile": prof.pk})
    a.refresh_from_db()
    assert not a.is_current
