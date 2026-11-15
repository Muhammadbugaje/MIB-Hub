"""A4: delegated granting from data (DelegationRule), used by appointing.can_appoint and grants."""
import pytest
from django.urls import reverse

from accounts import appointing
from accounts import grants as G
from accounts.models import DelegationRule


def test_shipped_rules_exist(r7):
    codes = set(DelegationRule.objects.values_list("grantor_office__code", flat=True))
    assert {"hod", "class-rep", "assistant-class-rep", "level-coordinator", "eesa-president"} <= codes


def test_superadmin_and_hod(r7):
    admin, hod = r7.user("admin@demo.eehub"), r7.user("hod@demo.eehub")
    assert appointing.can_appoint(admin, r7.office("hod"))
    assert appointing.can_appoint(hod, r7.office("exam-officer"))
    assert appointing.can_appoint(hod, r7.office("class-rep"), scope_level=r7.level(300))
    assert not appointing.can_appoint(hod, r7.office("hod")), "only the super admin appoints the HOD"


def test_class_rep_makes_tutors_for_own_level_only(r7):
    rep = r7.user("classrep@demo.eehub")              # class rep of B.Eng 400L in seed_demo
    rep._ee_active_kind = "student"
    tutor = r7.office("class-tutor")
    assert appointing.can_appoint(rep, tutor, scope_level=r7.level(400))
    assert not appointing.can_appoint(rep, tutor, scope_level=r7.level(300))
    assert not appointing.can_appoint(rep, tutor)
    assert not appointing.can_appoint(rep, r7.office("class-rep"), scope_level=r7.level(400))
    mate = r7.make("mate@demo.eehub", "student", level=300)
    with pytest.raises(appointing.DelegationError):
        appointing.appoint(actor=rep, person=mate.person, office=tutor, scope_level=r7.level(300))
    a = appointing.appoint(actor=rep, person=mate.person, office=tutor, scope_level=r7.level(400))
    assert a.appointed_by == rep


def test_class_rep_powers_do_not_follow_into_another_profile(r7):
    rep = r7.user("classrep@demo.eehub")
    rep._ee_active_kind = "alumni"
    assert not appointing.can_appoint(rep, r7.office("class-tutor"), scope_level=r7.level(400))


def test_eesa_president_inside_eesa_only(r7):
    pres = r7.make("pres@demo.eehub", "student", level=400)
    r7.appoint(pres, "eesa-president", "student")
    pres._ee_active_kind = "student"
    assert appointing.can_appoint(pres, r7.office("ieee-chair"))
    assert not appointing.can_appoint(pres, r7.office("eesa-president"))
    assert not appointing.can_appoint(pres, r7.office("staff-adviser-eesa"))
    assert not appointing.can_appoint(pres, r7.office("exam-officer"))
    labels = set(G.grantable_permissions(pres))
    assert labels == {"accounts.association_manage"}


def test_nobody_grants_what_they_do_not_hold(r7):
    hod = r7.user("hod@demo.eehub")
    hod._ee_active_kind = "lecturer"
    held = set(G.grantable_permissions(hod))
    assert "accounts.results_approve" in held
    assert "accounts.results_seal" not in held              # the Exam Officer's, not the HOD's
    other = r7.make("g1@demo.eehub", "lecturer")
    with pytest.raises(appointing.DelegationError):
        G.give(actor=hod, user=other, permissions=["accounts.results_seal"], reason="x", until=_days(5))


def test_rule_is_data_and_editable(r7, client):
    r7.login(client, r7.user("admin@demo.eehub"))
    rule = DelegationRule.objects.get(grantor_office__code="class-rep")
    r = client.get(reverse("access:delegation"))
    assert r.status_code == 200 and "Class Representative" in r.content.decode()
    data = {"grantor_office": rule.grantor_office_id, "offices": [r7.office("class-tutor").pk],
            "scope_rule": "same_level", "max_days": 30, "note": "Tutors for 30 days at most", "is_active": "on"}
    assert client.post(reverse("access:delegation_edit", args=[rule.pk]), data).status_code == 302
    rule.refresh_from_db()
    assert rule.max_days == 30
    data["is_active"] = ""
    client.post(reverse("access:delegation_edit", args=[rule.pk]), data)
    rep = r7.user("classrep@demo.eehub")
    rep._ee_active_kind = "student"
    assert not appointing.can_appoint(rep, r7.office("class-tutor"), scope_level=r7.level(400))


def test_delegated_appoint_screen_limits_levels(r7, client):
    rep = r7.user("classrep@demo.eehub")
    r7.login(client, rep, "student")
    r = client.get(reverse("access:office_appoint", args=["class-tutor"]))
    assert r.status_code == 200
    assert list(r.context["form"].fields["scope_level"].queryset) == [r7.level(400)]
    assert client.get(reverse("access:office_appoint", args=["exam-officer"])).status_code == 403
    r = client.get(reverse("access:my_access"))
    assert r.status_code == 200 and "Class Tutor" in r.content.decode()


def _days(n):
    from datetime import timedelta

    from django.utils import timezone
    return timezone.localdate() + timedelta(days=n)
