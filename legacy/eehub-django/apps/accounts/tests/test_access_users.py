"""Users: create with registration-number validation, passwords, profiles, overrides, import."""
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.urls import reverse

from accounts.access import effective_permissions, invalidate
from accounts.models import PermissionOverride, User
from department.models import Level, Programme
from people.models import LecturerProfile, StudentProfile


@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


@pytest.fixture
def admin(seeded, client):
    client.force_login(User.objects.get(email="admin@demo.eehub"))
    return client


def _student_post(**over):
    prog = Programme.objects.get(code="beng-ee")
    data = {"email": "new.student@demo.eehub", "title": "", "first_name": "Zainab", "last_name": "Testfield",
            "gender": "female", "p-kind": "student", "p-reg_number": "u26ee1201", "p-programme": prog.pk,
            "p-level": Level.objects.get(programme=prog, number=100).pk}
    data.update(over)
    return data


def test_create_student_with_valid_reg_number(admin):
    r = admin.post(reverse("access:user_create"), _student_post())
    assert r.status_code == 302
    u = User.objects.get(email="new.student@demo.eehub")
    st = StudentProfile.objects.get(person=u.person)
    assert st.reg_number == "U26EE1201"
    assert st.reg_category and st.reg_category.code == "beng-undergraduate"
    assert u.login_id == "U26EE1201" and u.must_change_password
    page = admin.get(r["Location"])
    pw = page.context["temp_password"]
    assert pw and pw in page.content.decode()
    assert u.check_password(pw)
    # shown only once
    assert admin.get(r["Location"]).context["temp_password"] is None


def test_create_student_rejects_bad_reg_number(admin):
    r = admin.post(reverse("access:user_create"), _student_post(**{"p-reg_number": "EE/12/3"}))
    assert r.status_code == 200
    assert "does not match any registration-number format" in str(r.context["pform"].errors)
    assert not User.objects.filter(email="new.student@demo.eehub").exists()


def test_create_student_rejects_duplicate_and_wrong_programme(admin):
    r = admin.post(reverse("access:user_create"), _student_post(**{"p-reg_number": "U24EE1031"}))
    assert "already in use" in str(r.context["pform"].errors)
    msc = Programme.objects.get(code="msc-ee")
    r = admin.post(reverse("access:user_create"), _student_post(**{"p-programme": msc.pk}))
    assert "belongs to" in str(r.context["pform"].errors)


def test_create_lecturer_needs_staff_number(admin):
    base = {"email": "new.lect@demo.eehub", "first_name": "Musa", "last_name": "Fictional", "p-kind": "lecturer"}
    r = admin.post(reverse("access:user_create"), base)
    assert "staff number is required" in str(r.context["pform"].errors)
    r = admin.post(reverse("access:user_create"), {**base, "p-staff_number": "sp9001", "p-rank": "Lecturer I"})
    assert r.status_code == 302
    lp = LecturerProfile.objects.get(person__user__email="new.lect@demo.eehub")
    assert lp.staff_number == "SP9001" and lp.rank == "Lecturer I"


def test_reset_password_and_toggle_active(admin):
    u = User.objects.get(email="fresher@demo.eehub")
    r = admin.post(reverse("access:user_reset_password", args=[u.pk]), {"method": "generate", "force_change": "on"})
    assert r.status_code == 302
    page = admin.get(r["Location"])
    u.refresh_from_db()
    assert u.must_change_password and u.check_password(page.context["temp_password"])
    admin.post(reverse("access:user_toggle_active", args=[u.pk]))
    u.refresh_from_db()
    assert not u.is_active
    me = User.objects.get(email="admin@demo.eehub")
    admin.post(reverse("access:user_toggle_active", args=[me.pk]))
    me.refresh_from_db()
    assert me.is_active


def test_edit_user(admin):
    u = User.objects.get(email="fresher@demo.eehub")
    r = admin.post(reverse("access:user_edit", args=[u.pk]), {"email": u.email, "login_id": u.login_id or "",
                                                               "first_name": "Renamed", "last_name": "Person"})
    assert r.status_code == 302
    u.refresh_from_db()
    assert u.person.first_name == "Renamed"


def test_profiles_add_and_close(admin):
    u = User.objects.get(email="student@demo.eehub")
    url = reverse("access:user_profiles", args=[u.pk])
    r = admin.post(url, {"action": "add", "p-kind": "staff", "p-staff_number": "SS7777", "p-designation": "Library assistant"})
    assert r.status_code == 302
    invalidate(u)
    from accounts.access import available_profiles
    assert {"student", "staff"} <= {p.kind for p in available_profiles(u)}
    sp = u.person.staff_profile
    admin.post(url, {"action": "close", "kind": "staff", "profile": sp.pk})
    sp.refresh_from_db()
    assert sp.is_deleted
    admin.post(url, {"action": "reopen", "kind": "staff", "profile": sp.pk})
    sp.refresh_from_db()
    assert not sp.is_deleted


def test_overrides_grant_and_revoke(admin):
    u = User.objects.get(email="student@demo.eehub")
    url = reverse("access:user_overrides", args=[u.pk])
    r = admin.post(url, {"action": "add", "permission": "accounts.results_view_all", "effect": "grant", "reason": "Pilot"})
    assert r.status_code == 302
    invalidate(u)
    assert "accounts.results_view_all" in effective_permissions(u, "student")
    admin.post(url, {"action": "add", "permission": "accounts.results_view_all", "effect": "revoke", "reason": "Pilot over"})
    invalidate(u)
    assert "accounts.results_view_all" not in effective_permissions(u, "student")
    o = PermissionOverride.objects.get(user=u)
    admin.post(url, {"action": "remove", "override": o.pk})
    assert not PermissionOverride.objects.filter(user=u).exists()
    r = admin.post(url, {"action": "add", "permission": "", "effect": "grant", "reason": ""})
    assert r.status_code == 200 and r.context["form"].errors


def test_import_csv_preview_then_commit(admin):
    csv = ("E-mail,First name,Surname,Profile,Registration number,Level\n"
           "imp.one@demo.eehub,Ada,Sample,student,U26EE1301,100\n"
           "imp.two@demo.eehub,Bala,Sample,student,BAD/NUMBER,100\n"
           "imp.three@demo.eehub,Chi,Sample,lecturer,,\n")
    f = SimpleUploadedFile("people.csv", csv.encode(), content_type="text/csv")
    r = admin.post(reverse("access:user_import"), {"action": "preview", "file": f})
    assert r.status_code == 200
    res = r.context["result"]
    assert res.created == 1 and len(res.rejected) == 2
    assert not User.objects.filter(email="imp.one@demo.eehub").exists()  # dry run
    r = admin.post(reverse("access:user_import"), {"action": "commit"})
    assert r.status_code == 200 and r.context["stage"] == "done"
    u = User.objects.get(email="imp.one@demo.eehub")
    assert u.person.student_profiles.get().reg_number == "U26EE1301"
    assert not User.objects.filter(email="imp.two@demo.eehub").exists()


def test_import_template_and_wizard_registration(admin):
    from core.importexport import REGISTRY
    assert "users" in REGISTRY["import"] and "users" in REGISTRY["export"]
    r = admin.get(reverse("access:user_import"), {"template": "1"})
    assert r.status_code == 200 and r["Content-Type"].startswith("application/vnd.openxmlformats")
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(r.content))
    header = [c.value for c in wb.worksheets[0][1]]
    assert "Registration number" in header
