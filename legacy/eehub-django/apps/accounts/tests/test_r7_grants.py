"""A3: time-boxed grants, respected (and expired) by the resolver; screens."""
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from accounts import grants as G
from accounts.access import effective_permissions, invalidate
from accounts.models import AccessGrant


def _fresh(user):
    from accounts.models import User
    u = User.objects.get(pk=user.pk)
    u._ee_active_kind = "lecturer"
    return u


def test_grant_adds_permission_and_expiry_removes_it(r7):
    admin = r7.user("admin@demo.eehub")
    lect = r7.make("gl@demo.eehub", "lecturer")
    assert "accounts.results_view_all" not in effective_permissions(_fresh(lect), "lecturer")
    g = G.give(actor=admin, user=lect, permissions=["accounts.results_view_all"], reason="Senate checks",
               until=timezone.localdate() + timedelta(days=3))
    assert g.status == "active"
    assert _fresh(lect).has_perm("accounts.results_view_all")
    # Expiry: no write happens, only the clock moves. The cached result must not outlive the grant.
    AccessGrant.objects.filter(pk=g.pk).update(ends_at=timezone.now() + timedelta(seconds=1))
    assert _fresh(lect).has_perm("accounts.results_view_all")
    import time
    time.sleep(1.2)
    assert not _fresh(lect).has_perm("accounts.results_view_all")


def test_upcoming_grant_starts_later(r7):
    admin = r7.user("admin@demo.eehub")
    lect = r7.make("gl2@demo.eehub", "lecturer")
    g = G.give(actor=admin, user=lect, permissions=["accounts.results_view_all"], reason="Next week",
               start=timezone.localdate() + timedelta(days=2), until=timezone.localdate() + timedelta(days=4))
    assert g.status == "upcoming" and not _fresh(lect).has_perm("accounts.results_view_all")


def test_grant_limited_to_profile(r7):
    admin = r7.user("admin@demo.eehub")
    lect = r7.user("lecturer@demo.eehub")          # lecturer + M.Sc student
    G.give(actor=admin, user=lect, permissions=["accounts.results_view_all"], reason="As lecturer only",
           profile_kind="lecturer", until=timezone.localdate() + timedelta(days=3))
    assert "accounts.results_view_all" in effective_permissions(_fresh(lect), "lecturer")
    assert "accounts.results_view_all" not in effective_permissions(_fresh(lect), "student")


def test_revoke_and_close_for_source(r7):
    admin = r7.user("admin@demo.eehub")
    lect = r7.make("gl3@demo.eehub", "lecturer")
    src = r7.office("seminar-coordinator")     # any model works as the "work" the grant is for
    g1 = G.give(actor=admin, user=lect, permissions=["accounts.content_events"], reason="Seminar week",
                until=timezone.localdate() + timedelta(days=3), source=src)
    g2 = G.give(actor=admin, user=lect, permissions=["accounts.memo_circular"], reason="Circulars",
                until=timezone.localdate() + timedelta(days=3))
    assert G.close_for_source(src) == 1
    g1.refresh_from_db()
    assert g1.status == "revoked" and not _fresh(lect).has_perm("accounts.content_events")
    G.revoke(g2, actor=admin, reason="done")
    g2.refresh_from_db()
    assert g2.status == "revoked" and g2.revoked_by == admin


def test_office_grant_is_an_acting_appointment(r7):
    hod = r7.user("hod@demo.eehub")
    hod._ee_active_kind = "lecturer"
    lect = r7.make("acting@demo.eehub", "lecturer")
    g = G.give(actor=hod, user=lect, office=r7.office("exam-officer"), reason="Acting while away",
               until=timezone.localdate() + timedelta(days=7))
    assert g.appointment.is_acting and g.appointment.end_date == timezone.localdate(g.ends_at)
    assert _fresh(lect).has_perm("accounts.results_seal")
    G.revoke(g, actor=hod)
    assert not _fresh(lect).has_perm("accounts.results_seal")
    with pytest.raises(Exception):
        G.give(actor=hod, user=r7.make("stud9@demo.eehub", "student"), office=r7.office("exam-officer"),
               reason="no", until=timezone.localdate() + timedelta(days=7))


def test_site_limit_on_length(r7):
    admin = r7.user("admin@demo.eehub")
    lect = r7.make("gl4@demo.eehub", "lecturer")
    with pytest.raises(G.GrantError, match="at most"):
        G.give(actor=admin, user=lect, permissions=["accounts.memo_send"], reason="too long",
               until=timezone.localdate() + timedelta(days=400))


def test_grants_screens(r7, client):
    hod = r7.user("hod@demo.eehub")
    lect = r7.make("gl5@demo.eehub", "lecturer")
    r7.login(client, hod)
    assert client.get(reverse("access:grants")).status_code == 200
    assert client.get(reverse("access:grant_create")).status_code == 200
    today = timezone.localdate()
    r = client.post(reverse("access:grant_create"), {
        "user": lect.pk, "what": "perms", "permissions": ["accounts.feedback_reports"], "reason": "QA review",
        "starts_on": today.isoformat(), "ends_on": (today + timedelta(days=5)).isoformat()})
    assert r.status_code == 302, r.content[:3000]
    g = AccessGrant.objects.get(user=lect)
    assert g.granted_by == hod and _fresh(lect).has_perm("accounts.feedback_reports")
    from notifications.models import Notification
    assert Notification.objects.filter(recipient=lect, title__startswith="You have extra access").exists()
    assert client.post(reverse("access:grant_revoke", args=[g.pk])).status_code == 302
    g.refresh_from_db()
    assert g.status == "revoked"
    # The person sees it on My access.
    r7.login(client, lect)
    assert client.get(reverse("access:my_access")).status_code == 200


def test_student_cannot_open_grants(r7, client):
    r7.login(client, r7.user("fresher@demo.eehub"))
    assert client.get(reverse("access:grants")).status_code == 403
    assert client.get(reverse("access:grant_create")).status_code == 403


def test_matrix_holders_lists_grants(r7):
    from accounts.access import holders_of
    admin = r7.user("admin@demo.eehub")
    lect = r7.make("gl6@demo.eehub", "lecturer", first="Granted")
    G.give(actor=admin, user=lect, permissions=["accounts.cbt_publish"], reason="CBT week",
           until=timezone.localdate() + timedelta(days=3))
    assert any(r["via"].startswith("Grant until") for r in holders_of("accounts.cbt_publish"))
    invalidate(lect)
