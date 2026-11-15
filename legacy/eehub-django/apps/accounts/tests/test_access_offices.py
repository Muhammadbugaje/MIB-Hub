"""Offices built on the fly, appointments and the permission matrix."""
import pytest
from django.contrib.auth.models import Permission
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone

from accounts.access import effective_permissions, invalidate
from accounts.models import Appointment, Office, Person, ProfileRole, User
from core.models import AuditLogEntry
from department.models import Level


@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


@pytest.fixture
def admin(seeded, client):
    client.force_login(User.objects.get(email="admin@demo.eehub"))
    return client


def _perm(code):
    return Permission.objects.get(content_type__app_label="accounts", codename=code)


def test_office_from_template_copies_everything(admin):
    tpl = Office.objects.get(code="template-coordinator")
    r = admin.post(reverse("access:office_create"), {"template": tpl.pk, "name": "Laboratory Safety Coordinator", "short_name": "Lab Safety"})
    assert r.status_code == 302
    o = Office.objects.get(code="laboratory-safety-coordinator")
    assert o.created_from == tpl and not o.is_template and not o.is_system
    assert set(o.permissions.all()) == set(tpl.permissions.all()) and o.permissions.exists()
    assert o.dashboard_widgets == tpl.dashboard_widgets
    assert (o.icon, o.color, o.scope_kind, o.profile_kind) == (tpl.icon, tpl.color, tpl.scope_kind, tpl.profile_kind)
    assert r["Location"] == reverse("access:office_edit", args=[o.code])


def test_copy_existing_office_and_unique_code(admin):
    hod = Office.objects.get(code="hod")
    admin.post(reverse("access:office_create"), {"copy_from": hod.pk, "name": "Head of Department"})
    o = Office.objects.get(code="head-of-department")
    assert o.created_from == hod and o.permissions.count() == hod.permissions.count()
    admin.post(reverse("access:office_create"), {"name": "Head of Department"})
    assert Office.objects.filter(code="head-of-department-2", created_from__isnull=True).exists()


def test_office_edit_saves_permissions_and_widget_order(admin):
    o = Office.objects.get(code="seminar-coordinator")
    data = {"name": o.name, "short_name": "Seminars", "description": "x", "category": o.category, "profile_kind": o.profile_kind,
            "scope_kind": o.scope_kind, "rank": 41, "max_holders": 1, "icon": "presentation", "color": "plum", "is_active": "on",
            "perms": ["accounts.content_events", "accounts.memo_circular", "core.view_audit_log"],
            "widgets": ["calendar", "quick_actions", "not_a_widget", "calendar"]}
    r = admin.post(reverse("access:office_edit", args=[o.code]), data)
    assert r.status_code == 302
    o.refresh_from_db()
    labels = {f"{p.content_type.app_label}.{p.codename}" for p in o.permissions.select_related("content_type")}
    assert labels == {"accounts.content_events", "accounts.memo_circular", "core.view_audit_log"}
    assert o.dashboard_widgets == ["calendar", "quick_actions"]
    assert o.color == "plum" and o.max_holders == 1
    data["icon"] = "no-such-icon-anywhere"
    r = admin.post(reverse("access:office_edit", args=[o.code]), data)
    assert r.status_code == 200 and "icon" in r.context["form"].errors


def test_system_office_cannot_be_deleted(admin):
    admin.post(reverse("access:office_edit", args=["hod"]), {"action": "delete"})
    assert Office.objects.filter(code="hod").exists()
    o = Office.objects.create(code="temp-office", name="Temporary office")
    admin.post(reverse("access:office_edit", args=["temp-office"]), {"action": "delete"})
    assert not Office.objects.filter(pk=o.pk).exists()


def test_appoint_respects_scope_and_max_holders(admin):
    o = Office.objects.get(code="level-coordinator")
    o.max_holders = 1
    o.save()
    lvl = Level.objects.get(programme__code="beng-ee", number=300)
    lect = Person.objects.get(user__email="lecturer@demo.eehub")
    hod = Person.objects.get(user__email="hod@demo.eehub")
    url = reverse("access:office_appoint", args=[o.code])
    base = {"profile_kind": "lecturer", "start_date": timezone.localdate().isoformat()}
    r = admin.post(url, {**base, "person": lect.pk})
    assert r.status_code == 200 and "scope_level" in r.context["form"].errors
    r = admin.post(url, {**base, "person": lect.pk, "scope_level": lvl.pk})
    assert r.status_code == 302
    a = Appointment.objects.get(person=lect, office=o, scope_level=lvl)
    assert a.scope_programme_id == lvl.programme_id and a.appointed_by.email == "admin@demo.eehub"
    r = admin.post(url, {**base, "person": hod.pk, "scope_level": lvl.pk})
    assert r.status_code == 200 and "allows 1 holder" in str(r.context["form"].non_field_errors())
    # wrong profile
    r = admin.post(url, {**base, "person": lect.pk, "scope_level": lvl.pk, "profile_kind": "staff"})
    assert r.status_code == 200
    # end it
    r = admin.post(reverse("access:appointment_end", args=[a.pk]))
    assert r.status_code == 302
    a = Appointment.all_objects.get(pk=a.pk)
    assert not a.is_current        # round 7: ending takes the office away at once (same-day start = cancelled)
    invalidate(lect.user)


def test_appointment_end_requires_post(admin):
    a = Appointment.objects.first()
    assert admin.get(reverse("access:appointment_end", args=[a.pk])).status_code == 405


def test_matrix_toggle_grants_removes_and_audits(admin):
    perm = _perm("cbt_publish")
    o = Office.objects.get(code="seminar-coordinator")
    assert not o.permissions.filter(pk=perm.pk).exists()
    before = AuditLogEntry.objects.count()
    r = admin.post(reverse("access:matrix_toggle"), {"col": "office:seminar-coordinator", "perm": perm.pk}, HTTP_HX_REQUEST="true")
    assert r.status_code == 200 and 'aria-pressed="true"' in r.content.decode()
    assert "accessToast" in r["HX-Trigger"]
    assert o.permissions.filter(pk=perm.pk).exists()
    assert AuditLogEntry.objects.count() > before
    assert AuditLogEntry.objects.filter(model_label="accounts.Office", object_pk=str(o.pk), note__contains="cbt_publish").exists()
    r = admin.post(reverse("access:matrix_toggle"), {"col": "office:seminar-coordinator", "perm": perm.pk})
    assert 'aria-pressed="false"' in r.content.decode()
    assert not o.permissions.filter(pk=perm.pk).exists()


def test_matrix_toggle_on_profile_role_changes_effective_permissions(admin):
    perm = _perm("cbt_bank")
    u = User.objects.get(email="student@demo.eehub")
    assert "accounts.cbt_bank" not in effective_permissions(u, "student")
    admin.post(reverse("access:matrix_toggle"), {"col": "role:student", "perm": perm.pk})
    assert ProfileRole.objects.get(kind="student").permissions.filter(pk=perm.pk).exists()
    invalidate(u)
    assert "accounts.cbt_bank" in effective_permissions(u, "student")


def test_matrix_toggle_rejects_unknown(admin):
    assert admin.post(reverse("access:matrix_toggle"), {"col": "office:nope", "perm": 1}).status_code == 404
    assert admin.post(reverse("access:matrix_toggle"), {"col": "office:hod", "perm": "x"}).status_code == 404
    other = Permission.objects.get(codename="add_user")
    assert admin.post(reverse("access:matrix_toggle"), {"col": "office:hod", "perm": other.pk}).status_code == 404


def test_matrix_holders_panel(admin):
    r = admin.get(reverse("access:matrix_holders"), {"col": "office:class-rep"})
    assert r.status_code == 200 and r.context["rows"]
    r = admin.get(reverse("access:matrix_holders"), {"perm": "accounts.requests_verify"})
    assert any("Class Representative" in row["via"] for row in r.context["rows"])


def test_profile_role_edit(admin):
    r = admin.post(reverse("access:profile_role_edit", args=["alumni"]),
                   {"name": "Alumni", "description": "Every alumnus", "perms": ["accounts.directory_view"],
                    "widgets": ["latest_news", "welcome"]})
    assert r.status_code == 302
    role = ProfileRole.objects.get(kind="alumni")
    assert role.dashboard_widgets == ["latest_news", "welcome"]
    assert list(role.permissions.values_list("codename", flat=True)) == ["directory_view"]
    assert admin.get(reverse("access:profile_role_edit", args=["wizard"])).status_code == 404
