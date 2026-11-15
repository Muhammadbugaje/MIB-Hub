"""A14: access log of restricted personal data."""
from django.test import RequestFactory
from django.urls import reverse

from accounts import accesslog
from accounts.models import AccessLogEntry


def _req(user, path="/x/"):
    r = RequestFactory().get(path)
    r.user = user
    r.active_profile = None
    return r


def test_record_dedupes_and_skips_own_data(r7):
    hod = r7.user("hod@demo.eehub")
    stud = r7.user("student@demo.eehub")
    e = accesslog.record(_req(hod), "student_record", stud.person, note="profile")
    assert e is not None and e.subject == stud.person and e.user == hod
    assert accesslog.record(_req(hod), "student_record", stud.person) is None          # within 10 minutes
    assert accesslog.record(_req(stud), "results", stud.person) is None                # own data
    assert accesslog.record(_req(hod), "nonsense", stud).kind == "other"


def test_log_switch(r7):
    from config.models import ConfigEntry
    ConfigEntry.objects.filter(key="access.log_enabled").update(value="false")
    from django.core.cache import cache
    cache.clear()
    assert accesslog.record(_req(r7.user("hod@demo.eehub")), "results", r7.user("student@demo.eehub")) is None


def test_user_detail_is_logged_and_log_screen(r7, client):
    admin, stud = r7.user("admin@demo.eehub"), r7.user("student@demo.eehub")
    r7.login(client, admin)
    assert client.get(reverse("access:user_detail", args=[stud.pk])).status_code == 200
    assert AccessLogEntry.objects.filter(user=admin, subject=stud.person, kind="account").exists()
    r = client.get(reverse("access:access_log"))
    assert r.status_code == 200 and stud.person.full_name in r.content.decode()


def test_log_screen_hod_only(r7, client):
    r7.login(client, r7.user("hod@demo.eehub"))
    assert client.get(reverse("access:access_log")).status_code == 200
    client.logout()
    r7.login(client, r7.user("exams@demo.eehub"))
    assert client.get(reverse("access:access_log")).status_code == 403


def test_append_only(r7):
    e = accesslog.record(_req(r7.user("hod@demo.eehub")), "welfare", r7.user("student@demo.eehub"))
    e.note = "changed"
    try:
        e.save()
    except PermissionError:
        return
    raise AssertionError("access log entries must be append-only")
