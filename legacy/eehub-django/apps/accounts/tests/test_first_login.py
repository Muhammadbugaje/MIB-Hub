"""Forced password change at first sign-in."""
import pytest
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse

from accounts.models import User
from core.models import AuditLogEntry
from department.models import Level, Programme

PW = "EEHub@2026"
NEW = "Volt-Meter-Kaduna-26"


@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


@pytest.fixture
def fresher(seeded):
    u = User.objects.get(email="fresher@demo.eehub")
    u.must_change_password = True
    u.save()
    return u


def _set_config(key, value):
    from config.models import ConfigEntry
    from config.registry import invalidate

    entry = ConfigEntry.objects.get(key=key, scope="global")
    entry.value = value
    entry.save()
    invalidate(key)


def _sign_in(client, ident="fresher@demo.eehub", **extra):
    return client.post(reverse("accounts:login"), {"identifier": ident, "password": PW, "remember": "on"}, **extra)


def test_sign_in_goes_to_first_password_page(client, fresher):
    r = _sign_in(client)
    assert r.status_code == 302 and r["Location"] == reverse("accounts:first_password")
    page = client.get(r["Location"])
    assert page.status_code == 200
    body = page.content.decode()
    assert "Choose your own password" in body and "U26EE1102" in body


def test_quick_signin_json_returns_first_password_url(client, fresher):
    r = _sign_in(client, HTTP_ACCEPT="application/json", HTTP_X_REQUESTED_WITH="fetch")
    assert r.status_code == 200
    assert r.json()["redirect"].startswith(reverse("accounts:first_password"))


def test_sign_in_keeps_next_through_first_password(client, fresher):
    r = client.post(reverse("accounts:login") + "?next=/notifications/",
                    {"identifier": "fresher@demo.eehub", "password": PW, "next": "/notifications/"})
    assert r["Location"] == reverse("accounts:first_password") + "?next=%2Fnotifications%2F"


@pytest.mark.parametrize("path", ["/dashboard/", "/notifications/", "/accounts/profile/", "/academics/courses/"])
def test_every_other_page_is_blocked(client, fresher, path):
    client.force_login(fresher)
    r = client.get(path)
    assert r.status_code == 302 and r["Location"].startswith(reverse("accounts:first_password"))


def test_blocked_htmx_and_json_requests(client, fresher):
    client.force_login(fresher)
    r = client.get("/notifications/", HTTP_HX_REQUEST="true")
    assert r.status_code == 204 and r["HX-Redirect"].startswith(reverse("accounts:first_password"))
    r = client.get(reverse("notifications:bell"), HTTP_ACCEPT="application/json")
    assert r.status_code == 403 and r.json()["redirect"].startswith(reverse("accounts:first_password"))


def test_allowed_paths_still_work(client, fresher):
    client.force_login(fresher)
    assert client.get(reverse("core:health")).status_code == 200
    assert client.get(reverse("config:favicon")).status_code == 200
    r = client.post(reverse("accounts:logout"))
    assert r.status_code == 302 and "first" not in r["Location"]


@pytest.mark.parametrize("pw, message", [
    ("short1", "at least"),
    (PW, "different from your temporary"),
    ("fresher@demo.eehub-2026", "e-mail address or registration"),
    ("u26ee1102-volt-meter", "e-mail address or registration"),
    ("U26-EE-1102-volt", "e-mail address or registration"),
    ("12345678901234", "entirely numeric"),
])
def test_rules(client, fresher, pw, message):
    client.force_login(fresher)
    r = client.post(reverse("accounts:first_password"), {"new_password1": pw, "new_password2": pw})
    assert r.status_code == 200
    assert message in r.content.decode().replace("&#x27;", "'")
    fresher.refresh_from_db()
    assert fresher.must_change_password


def test_mismatch(client, fresher):
    client.force_login(fresher)
    r = client.post(reverse("accounts:first_password"), {"new_password1": NEW, "new_password2": NEW + "x"})
    assert "don&#x27;t match" in r.content.decode()


def test_min_length_comes_from_settings(client, fresher):
    _set_config("security.password_min_length", "16")
    client.force_login(fresher)
    r = client.post(reverse("accounts:first_password"), {"new_password1": "Volt-Meter-26", "new_password2": "Volt-Meter-26"})
    assert "Use at least 16 characters" in r.content.decode()


def test_success_clears_flag_keeps_session_and_audits(client, fresher):
    r = _sign_in(client)
    r = client.post(r["Location"], {"new_password1": NEW, "new_password2": NEW})
    assert r.status_code == 302 and r["Location"] == reverse("dashboards:home")
    fresher.refresh_from_db()
    assert not fresher.must_change_password and fresher.check_password(NEW)
    assert client.get(reverse("dashboards:home")).status_code == 200  # still signed in
    entry = AuditLogEntry.objects.filter(model_label="accounts.User", object_pk=str(fresher.pk),
                                         note="password chosen at first sign-in").first()
    assert entry is not None and entry.actor_id == fresher.pk
    # the page is no longer needed
    assert client.get(reverse("accounts:first_password"))["Location"] == reverse("dashboards:home")


def test_success_goes_to_next(client, fresher):
    client.force_login(fresher)
    r = client.post(reverse("accounts:first_password") + "?next=/notifications/",
                    {"new_password1": NEW, "new_password2": NEW, "next": "/notifications/"})
    assert r["Location"] == "/notifications/"


def test_unsafe_next_is_ignored(client, fresher):
    client.force_login(fresher)
    r = client.post(reverse("accounts:first_password"),
                    {"new_password1": NEW, "new_password2": NEW, "next": "https://evil.example.com/"})
    assert r["Location"] == reverse("dashboards:home")


def test_impersonation_is_not_blocked(client, seeded, fresher):
    admin = User.objects.get(email="admin@demo.eehub")
    client.force_login(admin)
    client.post(reverse("core:impersonate_start", args=[fresher.pk]))
    r = client.get(reverse("dashboards:home"))
    assert r.status_code == 200


# --- every account an administrator creates starts on a temporary password ---
@pytest.fixture
def admin_client(seeded, client):
    client.force_login(User.objects.get(email="admin@demo.eehub"))
    return client


def _student_post(email="first.login@demo.eehub", reg="u26ee1299"):
    prog = Programme.objects.get(code="beng-ee")
    return {"email": email, "title": "", "first_name": "Hauwa", "last_name": "Testline", "gender": "female",
            "p-kind": "student", "p-reg_number": reg, "p-programme": prog.pk,
            "p-level": Level.objects.get(programme=prog, number=100).pk}


def test_admin_created_user_must_change(admin_client):
    r = admin_client.post(reverse("access:user_create"), _student_post())
    assert r.status_code == 302
    assert User.objects.get(email="first.login@demo.eehub").must_change_password


def test_setting_off_means_new_accounts_are_not_forced(admin_client):
    _set_config("security.first_login_reset", "false")
    admin_client.post(reverse("access:user_create"), _student_post())
    assert not User.objects.get(email="first.login@demo.eehub").must_change_password


def test_admin_reset_always_forces_change(admin_client):
    u = User.objects.get(email="student@demo.eehub")
    assert not u.must_change_password
    r = admin_client.post(reverse("access:user_reset_password", args=[u.pk]), {"method": "generate"})
    assert r.status_code == 302
    u.refresh_from_db()
    assert u.must_change_password


def _import_one(client, email):
    from django.core.files.uploadedfile import SimpleUploadedFile

    csv = ("E-mail,First name,Surname,Profile,Registration number,Level\n"
           f"{email},Ibrahim,Importfield,student,U26EE1288,100\n")
    f = SimpleUploadedFile("people.csv", csv.encode(), content_type="text/csv")
    client.post(reverse("access:user_import"), {"action": "preview", "file": f})
    client.post(reverse("access:user_import"), {"action": "commit"})
    return User.objects.get(email=email)


def test_imported_users_must_change(admin_client):
    assert _import_one(admin_client, "imported.first@demo.eehub").must_change_password


def test_imported_users_setting_off(admin_client):
    _set_config("security.first_login_reset", "false")
    assert not _import_one(admin_client, "imported.second@demo.eehub").must_change_password


@override_settings(EE_DEMO_FIRST_LOGIN=True)
def test_seed_demo_marks_only_fresher(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)
    flagged = list(User.objects.filter(must_change_password=True).values_list("email", flat=True))
    assert flagged == ["fresher@demo.eehub"]


@pytest.mark.django_db
def test_user_added_in_django_admin_must_change_password(client):
    from accounts.models import User
    admin = User.objects.create_superuser("boss@example.com", "Boss-pw-12345")
    client.force_login(admin)
    client.post("/admin/accounts/user/add/", {"email": "new.person@example.com", "login_id": "",
                                              "password1": "Temp-pw-98765x", "password2": "Temp-pw-98765x"})
    assert User.objects.get(email="new.person@example.com").must_change_password is True
