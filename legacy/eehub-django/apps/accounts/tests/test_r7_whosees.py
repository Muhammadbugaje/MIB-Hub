"""A5 + F5: Appendix B (who sees what) as tests, where the data exists today.

The Course Allocation Officer's office adds class lists, reps, tutors and class broadcasts —
and nothing else: for chats, course forms, results, welfare and requests the officer gets
exactly what the same person gets without the office. Likewise a class rep gets nothing
about other students' course forms or results that a plain classmate does not get.
"""
import pytest
from django.urls import NoReverseMatch, reverse

from accounts import appointing

# Pages of private student business (Appendix B rows: course forms, results, welfare, requests, chats).
STUDENT_BUSINESS = ["registration:review", "registration:desk", "registration:lists", "results:sheets",
                    "results:pipeline", "results:students", "results:broadsheet", "results:corrections",
                    "welfare:queue", "welfare:fines", "requests:queue", "messaging:archived"]


def _status(client, name):
    try:
        url = reverse(name)
    except NoReverseMatch:
        return None
    return client.get(url).status_code


@pytest.fixture
def officer(r7):
    u = r7.make("alloc.r7@demo.eehub", "lecturer", first="Allocation", last="Officer")
    r7.appoint(u, "course-allocation-officer", "lecturer")
    plain = r7.make("plain.r7@demo.eehub", "lecturer", first="Plain", last="Lecturer")
    return u, plain


def test_allocation_officer_sees_class_lists_reps_and_tutors(r7, client, officer):
    u, plain = officer
    r7.login(client, u, "lecturer")
    r = client.get(reverse("access:classes"))
    assert r.status_code == 200
    body = r.content.decode()
    assert "Musa Abdullahi" in body                       # the 400L class rep from seed_demo
    lvl = r7.level(400)
    r = client.get(reverse("access:class_detail", args=[lvl.pk]))
    assert r.status_code == 200 and r.context["contacts"] is False
    assert "0800 000 0000" not in r.content.decode()      # D-23: no phone numbers
    assert client.get(reverse("access:broadcast")).status_code == 200
    client.logout()
    r7.login(client, plain, "lecturer")
    assert client.get(reverse("access:classes")).status_code == 403
    assert client.get(reverse("access:broadcast")).status_code == 403


def test_allocation_office_adds_no_student_business(r7, client, officer):
    u, plain = officer
    r7.login(client, plain, "lecturer")
    baseline = {n: _status(client, n) for n in STUDENT_BUSINESS}
    client.logout()
    r7.login(client, u, "lecturer")
    got = {n: _status(client, n) for n in STUDENT_BUSINESS}
    widened = {n: (baseline[n], got[n]) for n in STUDENT_BUSINESS if got[n] == 200 and baseline[n] != 200}
    assert not widened, f"The Course Allocation Officer office opens student business: {widened}"


def test_allocation_officer_permissions_boundary(r7, officer):
    u, _ = officer
    u._ee_active_kind = "lecturer"
    for p in ("accounts.results_view_all", "accounts.welfare_cases", "accounts.requests_approve",
              "accounts.requests_verify", "accounts.academics_sign_forms", "accounts.student_contacts_view",
              "accounts.users_manage", "accounts.welfare_confidential"):
        assert not u.has_perm(p), p
    for p in ("accounts.classes_view", "accounts.class_broadcast", "accounts.academics_allocate"):
        assert u.has_perm(p), p


def test_allocation_officer_cannot_act_for_students(r7, client, officer):
    u, _ = officer
    r7.login(client, u, "lecturer")
    student = r7.user("student@demo.eehub")
    assert client.post(reverse("core:impersonate_start", args=[student.pk])).status_code == 403
    assert client.get(reverse("core:impersonate_pick")).status_code == 403


def test_broadcast_reaches_only_that_class(r7, client, officer):
    from notifications.models import Notification
    u, _ = officer
    r7.login(client, u, "lecturer")
    lvl = r7.level(400)
    data = {"audience": "level", "level": lvl.pk, "title": "Allocation published", "body": "See the timetable.",
            "kind": "announcement"}
    r = client.post(reverse("access:broadcast"), data)
    assert r.status_code == 200 and r.context["preview"]["count"] >= 1          # check step first
    assert not Notification.objects.filter(title__contains="Allocation published").exists()
    r = client.post(reverse("access:broadcast"), {**data, "confirm": "1"})
    assert r.status_code == 302
    got = Notification.objects.filter(title__contains="Allocation published").select_related("recipient__person")
    assert got.exists()
    for n in got:
        assert n.recipient.person.student_profiles.filter(level=lvl, status="active").exists()
    assert not got.filter(recipient=r7.user("student@demo.eehub")).exists()       # a 200L student


def test_level_coordinator_sees_own_level_only(r7, client):
    from accounts.access_r7_views import visible_levels
    co = r7.make("lc.r7@demo.eehub", "lecturer")
    r7.appoint(co, "level-coordinator", "lecturer", r7.level(300))
    co._ee_active_kind = "lecturer"
    assert list(visible_levels(co)) == [r7.level(300)]
    r7.login(client, co, "lecturer")
    assert client.get(reverse("access:class_detail", args=[r7.level(400).pk])).status_code == 404
    r = client.get(reverse("access:class_detail", args=[r7.level(300).pk]))
    assert r.status_code == 200 and r.context["contacts"] is True                # Appendix B: level contacts


def test_students_see_no_class_lists_or_access_screens(r7, client):
    r7.login(client, r7.user("fresher@demo.eehub"))
    for name in ("access:classes", "access:broadcast", "access:access_log", "access:review_appointments",
                 "access:delegation", "access:grants"):
        assert client.get(reverse(name)).status_code == 403, name
    assert client.get(reverse("access:my_access")).status_code == 200


def test_class_rep_gets_no_more_student_business_than_a_classmate(r7, client):
    rep = r7.user("classrep@demo.eehub")
    mate = r7.make("mate400@demo.eehub", "student", level=400)
    r7.login(client, mate, "student")
    baseline = {n: _status(client, n) for n in STUDENT_BUSINESS}
    client.logout()
    r7.login(client, rep, "student")
    got = {n: _status(client, n) for n in STUDENT_BUSINESS}
    widened = {n: (baseline[n], got[n]) for n in STUDENT_BUSINESS if got[n] == 200 and baseline[n] != 200}
    known_elsewhere = {"requests:queue"}       # D-10 / C8 (R7C): the rep's request step, reported, not fixed here
    assert not {k for k in widened if k not in known_elsewhere}, widened


def test_who_may_hold_and_appoint_matches_plan_table(r7):
    """Plan section 4 'Appointed by' column, as delegation rules."""
    hod = r7.user("hod@demo.eehub")
    hod._ee_active_kind = "lecturer"
    for code in ("deputy-hod", "exam-officer", "registration-officer", "course-allocation-officer", "timetable-officer",
                 "level-coordinator", "siwes-coordinator", "quality-assurance", "staff-adviser-eesa", "lab-officer",
                 "secretary", "electoral-committee"):
        assert appointing.can_appoint(hod, r7.office(code)), code
