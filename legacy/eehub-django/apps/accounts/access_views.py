"""People-and-access screens: users, profiles, offices, the permission matrix
and registration-number formats."""
import json
import re
import secrets
from datetime import datetime, time
from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import Permission
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from core import audit
from dashboards import widgets as widget_registry
from department.models import Level, Programme
from people.models import AlumniProfile, LecturerProfile, StaffProfile, StudentProfile

from . import accesslog, appointing
from . import catalogue as seed_catalogue
from . import first_login
from . import regno
from .access import available_profiles, effective_permissions, holders_of, invalidate, is_super_admin
from .access_forms import (AppointForm, OfficeCreateForm, OfficeForm, OverrideForm, ProfileForm, ProfileRoleForm,
                           RegNumberCategoryForm, UserCreateForm, UserEditForm)
from .models import (CAPABILITY_GROUPS, PROFILE_KINDS, AccessGrant, Appointment, Office, PermissionOverride, Person, ProfileRole,
                     RegNumberCategory, User)
from core.pagination import paginate

from . import grants as _grants

TEMP_PW_SESSION_KEY = "access_temp_password"
PER_PAGE = 25
KIND_ICONS = {"student": "graduation-cap", "lecturer": "presentation", "staff": "briefcase", "alumni": "award"}
KIND_TONES = {"student": "volt", "lecturer": "green", "staff": "slate", "alumni": "gold"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def need(*perms):
    """login_required + the user must hold ANY of these permissions."""
    def deco(fn):
        @wraps(fn)
        def inner(request, *args, **kwargs):
            if not any(request.user.has_perm(p) for p in perms):
                raise PermissionDenied
            return fn(request, *args, **kwargs)
        return login_required(inner)
    return deco


def _today():
    return timezone.localdate()


def _current_q(prefix=""):
    today = _today()
    return (Q(**{f"{prefix}is_deleted": False, f"{prefix}start_date__lte": today})
            & (Q(**{f"{prefix}end_date__isnull": True}) | Q(**{f"{prefix}end_date__gte": today})))


def _safe_next(request, fallback):
    nxt = request.POST.get("next") or request.GET.get("next")
    if nxt and url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}):
        return nxt
    return fallback


def _hx_toast(response, title, kind="success", body=""):
    response["HX-Trigger"] = json.dumps({"accessToast": {"type": kind, "title": title, "body": body}})
    return response


def _temp_password():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    return "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3))


def _stash_password(request, user, password):
    request.session[TEMP_PW_SESSION_KEY] = {"user": user.pk, "password": password}


def _pop_password(request, user):
    data = request.session.get(TEMP_PW_SESSION_KEY)
    if data and data.get("user") == user.pk:
        del request.session[TEMP_PW_SESSION_KEY]
        return data.get("password")
    return None


def _system_extra_labels():
    labels = set()
    for row in seed_catalogue.OFFICES:
        labels.update(p for p in row[9] if not p.startswith("accounts."))
    labels.update(["core.manage_files", "core.view_audit_log", "core.handle_contact_messages",
                   "core.use_import_export", "config.confirm_setting_change", "config.change_configentry"])
    return sorted(labels)


def capability_catalogue():
    """Groups of capabilities (from CAPABILITY_GROUPS) plus the system tools offices use."""
    perms = {(p.content_type.app_label, p.codename): p
             for p in Permission.objects.select_related("content_type")
             .filter(content_type__app_label__in=["accounts", "core", "config"])}
    groups = []
    for key, label, phase, items in CAPABILITY_GROUPS:
        rows = []
        for code, lbl in items:
            p = perms.get(("accounts", code))
            if p is not None:
                rows.append({"pk": p.pk, "code": code, "full": f"accounts.{code}", "label": lbl, "phase": phase})
        groups.append({"key": key, "label": label, "phase": phase, "items": rows})
    extra = []
    for full in _system_extra_labels():
        app, code = full.split(".", 1)
        p = perms.get((app, code))
        if p is not None:
            extra.append({"pk": p.pk, "code": code, "full": full, "label": p.name[:1].upper() + p.name[1:], "phase": 0})
    if extra:
        groups.append({"key": "system", "label": "System tools", "phase": 0, "items": extra})
    return groups


def _catalogue_index(groups):
    return {i["full"]: i for g in groups for i in g["items"]}, {i["pk"]: i for g in groups for i in g["items"]}


def _picker_context(groups, selected_pks):
    out = []
    for g in groups:
        items = [dict(i, on=i["pk"] in selected_pks) for i in g["items"]]
        out.append(dict(g, items=items, on_count=sum(1 for i in items if i["on"])))
    return out


def _save_permissions(obj, groups, posted):
    """Set obj.permissions from posted 'app.codename' values; keeps permissions outside the catalogue."""
    by_full, by_pk = _catalogue_index(groups)
    chosen = {by_full[f]["pk"] for f in posted if f in by_full}
    keep = set(obj.permissions.exclude(pk__in=list(by_pk)).values_list("pk", flat=True))
    before = set(obj.permissions.values_list("pk", flat=True))
    after = chosen | keep
    if before != after:
        obj.permissions.set(list(after))
    return len(after - before), len(before - after)


def _widget_picker(selected):
    reg = widget_registry.REGISTRY
    rows = []
    for code in selected or []:
        w = reg.get(code)
        if w:
            rows.append({"w": w, "on": True})
    for code, w in reg.items():
        if code not in (selected or []):
            rows.append({"w": w, "on": False})
    return rows


def _posted_widgets(request):
    seen, out = set(), []
    for code in request.POST.getlist("widgets"):
        if code in widget_registry.REGISTRY and code not in seen:
            seen.add(code)
            out.append(code)
    return out


def _profiles_of(person):
    """Every profile row of a person (open and closed), newest first per kind."""
    rows = []
    if person is None:
        return rows
    for st in StudentProfile.all_objects.filter(person=person).select_related("programme", "level"):
        rows.append({"kind": "student", "obj": st, "title": st.label, "sub": st.reg_number,
                     "status": "closed" if st.is_deleted else st.get_status_display(), "open": not st.is_deleted})
    for model, kind in ((LecturerProfile, "lecturer"), (StaffProfile, "staff"), (AlumniProfile, "alumni")):
        obj = model.all_objects.filter(person=person).first()
        if obj is None:
            continue
        if kind == "lecturer":
            sub = " · ".join(x for x in (obj.staff_number, obj.rank) if x)
        elif kind == "staff":
            sub = " · ".join(x for x in (obj.staff_number, obj.designation) if x)
        else:
            sub = " · ".join(str(x) for x in (obj.programme_name, obj.graduation_year) if x)
        status = "closed" if obj.is_deleted else (obj.get_status_display() if hasattr(obj, "get_status_display") else "Active")
        rows.append({"kind": kind, "obj": obj, "title": obj.label, "sub": sub, "status": status, "open": not obj.is_deleted})
    for r in rows:
        r["icon"] = KIND_ICONS[r["kind"]]
        r["tone"] = KIND_TONES[r["kind"]]
    return rows


def _row_chips(user):
    """Profile and office chips for a user row, from prefetched data."""
    person = user.person_or_none
    chips, offices = [], []
    if person is None:
        return chips, offices
    for st in person.student_profiles.all():
        chips.append({"kind": "student", "label": f"Student · {st.reg_number}", "tone": "volt"})
    for rel, kind in (("lecturer_profile", "lecturer"), ("staff_profile", "staff"), ("alumni_profile", "alumni")):
        try:
            obj = getattr(person, rel)
        except Exception:
            obj = None
        if obj is not None and not obj.is_deleted:
            label = kind.title() + (f" · {obj.staff_number}" if getattr(obj, "staff_number", None) else "")
            chips.append({"kind": kind, "label": label, "tone": KIND_TONES[kind]})
    today = _today()
    for a in person.appointments.all():
        if a.start_date <= today and (a.end_date is None or a.end_date >= today) and a.office.is_active:
            offices.append(a.office)
    return chips, offices


def _perm_groups_for(perm_names, groups):
    by_full, _ = _catalogue_index(groups)
    out = []
    for g in groups:
        items = [i for i in g["items"] if i["full"] in perm_names]
        if items:
            out.append({"label": g["label"], "items": items})
    other = sorted(p for p in perm_names if p not in by_full)
    return out, other


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------
@need("accounts.users_manage", "accounts.offices_manage", "accounts.matrix_edit", "accounts.regno_manage")
def access_home(request):
    now = timezone.now()
    counts = {
        "users": User.objects.count(),
        "active": User.objects.filter(is_active=True).count(),
        "students": StudentProfile.objects.filter(status="active").count(),
        "lecturers": LecturerProfile.home(LecturerProfile.objects.filter(status="active")).count(),
        "staff": StaffProfile.objects.filter(status="active").count(),
        "alumni": AlumniProfile.objects.count(),
        "offices": Office.objects.filter(is_active=True).count(),
        "appointments": Appointment.objects.filter(_current_q()).count(),
        "formats": RegNumberCategory.objects.filter(is_active=True).count(),
        "overrides": PermissionOverride.objects.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).count(),
        "must_change": User.objects.filter(is_active=True, must_change_password=True).count(),
        "grants": AccessGrant.objects.filter(revoked_at__isnull=True, starts_at__lte=now, ends_at__gt=now).count(),
        "to_review": len(appointing.wrong_appointments()),
    }
    recent = (Appointment.objects.select_related("person", "office", "scope_level", "scope_programme")
              .order_by("-created_at")[:8])
    from core.models import AuditLogEntry
    activity = (AuditLogEntry.objects.filter(model_label__in=["accounts.Office", "accounts.ProfileRole", "accounts.Appointment",
                                                              "accounts.PermissionOverride", "accounts.RegNumberCategory"])
                .select_related("actor")[:8])
    shortcuts = [
        ("Add a user", "access:user_create", "user-plus", "accounts.users_manage", "green"),
        ("Import users", "access:user_import", "file-spreadsheet", "accounts.users_import", "green"),
        ("All users", "access:users", "users", "accounts.users_manage", "volt"),
        ("Offices", "access:offices", "badge-check", "accounts.offices_manage", "gold"),
        ("New office", "access:office_create", "circle-plus", "accounts.offices_manage", "gold"),
        ("Permission matrix", "access:matrix", "grid-3x3", "accounts.matrix_edit", "plum"),
        ("Registration numbers", "access:regno_list", "id-card", "accounts.regno_manage", "ember"),
        ("Appointments to review", "access:review_appointments", "user-x", "accounts.offices_manage", "ember"),
        ("Access grants", "access:grants", "timer", "accounts.grants_manage", "volt"),
        ("Delegation", "access:delegation", "git-fork", "accounts.matrix_edit", "plum"),
        ("Access log", "access:access_log", "eye", "accounts.access_log_view", "slate"),
        ("Modules and features", "config:features", "toggle-right", "accounts.settings_edit", "green"),
    ]
    shortcuts = [{"label": l, "url": reverse(n), "icon": i, "tone": t} for l, n, i, p, t in shortcuts if request.user.has_perm(p)]
    return render(request, "access/home.html", {"counts": counts, "recent": recent, "activity": activity,
                                                "shortcuts": shortcuts, "today": _today()})


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@need("accounts.users_manage")
def users(request):
    q = (request.GET.get("q") or "").strip()
    kind = request.GET.get("kind") or ""
    active = request.GET.get("active") or ""
    office = request.GET.get("office") or ""
    qs = User.objects.select_related("person", "person__lecturer_profile", "person__staff_profile", "person__alumni_profile")
    for term in q.split()[:5]:
        qs = qs.filter(Q(email__icontains=term) | Q(login_id__icontains=term) | Q(person__first_name__icontains=term)
                       | Q(person__last_name__icontains=term) | Q(person__middle_name__icontains=term)
                       | Q(person__student_profiles__reg_number__icontains=term)
                       | Q(person__lecturer_profile__staff_number__icontains=term)
                       | Q(person__staff_profile__staff_number__icontains=term))
    if kind == "student":
        qs = qs.filter(person__student_profiles__is_deleted=False)
    elif kind in ("lecturer", "staff", "alumni"):
        qs = qs.filter(**{f"person__{kind}_profile__isnull": False, f"person__{kind}_profile__is_deleted": False})
    elif kind == "none":
        qs = qs.filter(Q(person__isnull=True) | (
            ~Q(person__student_profiles__is_deleted=False) & Q(person__lecturer_profile__isnull=True)
            & Q(person__staff_profile__isnull=True) & Q(person__alumni_profile__isnull=True)))
    elif kind == "superuser":
        qs = qs.filter(is_superuser=True)
    if active in ("1", "0"):
        qs = qs.filter(is_active=active == "1")
    if office:
        qs = qs.filter(person__appointments__office__code=office).filter(_current_q("person__appointments__"))
    qs = qs.distinct().order_by("person__last_name", "person__first_name", "email")
    qs = qs.prefetch_related(
        Prefetch("person__student_profiles", queryset=StudentProfile.objects.select_related("programme")),
        Prefetch("person__appointments", queryset=Appointment.objects.select_related("office")))
    page = paginate(request, qs, PER_PAGE)
    rows = []
    for u in page.object_list:
        chips, offices = _row_chips(u)
        rows.append({"u": u, "person": u.person_or_none, "chips": chips, "offices": offices})
    filtered = bool(q or kind or active or office)
    return render(request, "access/users.html", {
        "page": page, "rows": rows, "q": q, "kind": kind, "active": active, "office": office,
        "offices": Office.objects.filter(is_active=True).order_by("name"), "kinds": PROFILE_KINDS,
        "filtered": filtered, "total": page.paginator.count,
    })


@need("accounts.users_manage")
def user_create(request):
    form = UserCreateForm(request.POST or None)
    pform = ProfileForm(request.POST or None, prefix="p")
    if request.method == "POST":
        ok_user, ok_profile = form.is_valid(), pform.is_valid()
        if ok_user and ok_profile:
            cd = form.cleaned_data
            password = cd.get("password") or _temp_password()
            login_id = cd.get("login_id") or pform.login_number() or None
            if login_id and User.objects.filter(login_id=login_id.upper()).exists():
                login_id = None
            with transaction.atomic():
                user = User.objects.create_user(email=cd["email"], password=password, login_id=login_id,
                                                is_staff=cd.get("is_staff", False),
                                                must_change_password=first_login.required_for_new_accounts())
                person = Person.objects.create(user=user, title=cd.get("title") or "", first_name=cd["first_name"],
                                               middle_name=cd.get("middle_name") or "", last_name=cd["last_name"],
                                               gender=cd.get("gender") or "", phone=cd.get("phone") or "")
                pform.save(person)
            _stash_password(request, user, password)
            messages.success(request, f"{person.plain_name} can now sign in.")
            return redirect("access:user_detail", pk=user.pk)
    return render(request, "access/user_form.html", {
        "form": form, "pform": pform, "mode": "create",
        "levels": Level.objects.select_related("programme"),
        "formats": RegNumberCategory.objects.filter(is_active=True).select_related("programme"),
    })


@need("accounts.users_import")
def user_import(request):
    """Upload -> preview (dry run) -> commit, using the 'users' spec that is
    also listed in the shared import/export wizard."""
    from core.importexport import REGISTRY
    spec = REGISTRY["import"]["users"]()
    ctx = {"spec": spec, "stage": "upload",
           "wizard_url": reverse("core:import_export_spec", args=["users"]) if request.user.has_perm("core.use_import_export") else ""}
    if request.GET.get("template"):
        resp = HttpResponse(spec.template_xlsx(),
                            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = 'attachment; filename="ee-hub-users-template.xlsx"'
        return resp
    if request.method == "POST":
        action = request.POST.get("action", "preview")
        rows = None
        if action == "preview":
            upload = request.FILES.get("file")
            if not upload:
                messages.error(request, "Choose a file to upload.")
                return render(request, "access/user_import.html", ctx)
            try:
                rows = _read_upload(upload)
            except Exception as exc:
                messages.error(request, f"Could not read the file: {exc}")
                return render(request, "access/user_import.html", ctx)
            if not rows:
                messages.error(request, "The file has no rows under the header.")
                return render(request, "access/user_import.html", ctx)
            if len(rows) > 2000:
                messages.error(request, "Import at most 2,000 rows at a time.")
                return render(request, "access/user_import.html", ctx)
            request.session["access_import_rows"] = _jsonable_rows(rows)
            request.session["access_import_name"] = upload.name
            result = spec.run(rows, dry_run=True)
            ctx.update(stage="preview", result=result, rows=rows[:200], filename=upload.name,
                       columns=spec.columns, rejected_numbers={r.row_number: r.errors for r in result.rejected})
            return render(request, "access/user_import.html", ctx)
        if action == "commit":
            rows = request.session.pop("access_import_rows", None)
            name = request.session.pop("access_import_name", "")
            if not rows:
                messages.error(request, "Your upload has expired. Upload the file again.")
                return redirect("access:user_import")
            result = spec.run(rows, dry_run=False)
            invalidate(request.user)
            audit.log("other", request.user, note=f"Imported users from {name}: {result.created} created, "
                                                  f"{result.updated} updated, {len(result.rejected)} skipped")
            messages.success(request, f"Import finished: {result.created} created, {result.updated} updated"
                                      + (f", {len(result.rejected)} skipped" if result.rejected else "") + ".")
            ctx.update(stage="done", result=result, filename=name, columns=spec.columns)
            return render(request, "access/user_import.html", ctx)
    return render(request, "access/user_import.html", ctx)


def _read_upload(upload):
    name = (upload.name or "").lower()
    if name.endswith(".csv"):
        import csv
        import io
        text = upload.read().decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        return [{k.strip(): (v or "").strip() for k, v in r.items() if k} for r in reader
                if any((v or "").strip() for v in r.values())]
    if name.endswith((".xlsx", ".xlsm")):
        from core import excel
        return list(excel.read_rows(upload))
    raise ValueError("use an .xlsx or .csv file")


def _jsonable_rows(rows):
    out = []
    for r in rows:
        out.append({str(k): (v if isinstance(v, (str, int, float, bool)) or v is None else str(v)) for k, v in r.items()})
    return out


@need("accounts.users_manage")
def user_detail(request, pk):
    user = get_object_or_404(User.objects.select_related("person"), pk=pk)
    person = user.person_or_none
    groups = capability_catalogue()
    refs = available_profiles(user)
    perm_views = []
    for ref in refs:
        names = effective_permissions(user, ref.kind)
        grouped, other = _perm_groups_for(names, groups)
        perm_views.append({"ref": ref, "count": len([n for n in names if n.startswith("accounts.")]) + len(other),
                           "groups": grouped, "other": other})
    appts = []
    if person is not None:
        appts = list(Appointment.objects.filter(person=person).select_related("office", "scope_level", "scope_programme")
                     .order_by("-start_date"))
    from core.models import AuditLogEntry
    history = AuditLogEntry.objects.filter(model_label="accounts.User", object_pk=str(user.pk)).select_related("actor")[:8]
    accesslog.record(request, "account", user, subject=person)
    return render(request, "access/user_detail.html", {
        "u": user, "person": person, "profiles": _profiles_of(person), "refs": refs, "perm_views": perm_views,
        "appointments": appts, "today": _today(), "overrides": user.permission_overrides.select_related("permission", "granted_by"),
        "temp_password": _pop_password(request, user), "history": history,
        "can_reset_password": can_reset_password(request.user, user),
    })


@need("accounts.users_manage")
def user_edit(request, pk):
    user = get_object_or_404(User, pk=pk)
    person = user.person_or_none
    initial = {"email": user.email, "login_id": user.login_id or "", "is_staff": user.is_staff}
    if person:
        initial.update({f: getattr(person, f) for f in ("title", "first_name", "middle_name", "last_name", "gender",
                                                         "phone", "personal_email")})
    form = UserEditForm(request.POST or None, initial=initial, user=user)
    if request.method == "POST" and form.is_valid():
        cd = form.cleaned_data
        with transaction.atomic():
            user.email = cd["email"]
            user.login_id = cd.get("login_id") or None
            if is_super_admin(request.user):
                user.is_staff = cd.get("is_staff", False)
            user.save()
            if person is None:
                person = Person(user=user)
            for f in ("title", "first_name", "middle_name", "last_name", "gender", "phone", "personal_email"):
                setattr(person, f, cd.get(f) or "")
            person.save()
        messages.success(request, "Changes saved.")
        return redirect("access:user_detail", pk=user.pk)
    return render(request, "access/user_edit.html", {"form": form, "u": user})


def can_reset_password(actor, target):
    """THE rule for resetting someone's password (the view and the Reset password button)."""
    return actor.has_perm("accounts.users_reset_password") and (is_super_admin(actor) or not target.is_superuser)  # resolver-ok: target check


@need("accounts.users_reset_password")
def user_reset_password(request, pk):
    user = get_object_or_404(User, pk=pk)
    if not can_reset_password(request.user, user):
        raise PermissionDenied
    error = ""
    if request.method == "POST":
        method = request.POST.get("method", "generate")
        password = (request.POST.get("password") or "").strip() if method == "set" else _temp_password()
        if len(password) < 8:
            error = "Use at least 8 characters."
        else:
            user.set_password(password)
            user.must_change_password = True  # an administrator's reset is always temporary
            user.save()
            audit.log("update", user, note="password reset by an administrator")
            _stash_password(request, user, password)
            messages.success(request, "Password reset. Give the user the temporary password below.")
            return redirect("access:user_detail", pk=user.pk)
    return render(request, "access/user_reset_password.html", {"u": user, "error": error})


@need("accounts.users_manage")
@require_POST
def user_toggle_active(request, pk):
    user = get_object_or_404(User, pk=pk)
    if user.pk == request.user.pk:
        messages.error(request, "You cannot lock your own account.")
    elif user.is_superuser and not is_super_admin(request.user):  # resolver-ok: target check
        raise PermissionDenied
    else:
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        name = user.get_full_name()
        messages.success(request, f"{name} can sign in again." if user.is_active else f"{name} is locked out.")
    return redirect(_safe_next(request, reverse("access:user_detail", args=[user.pk])))


@need("accounts.users_manage")
def user_profiles(request, pk):
    user = get_object_or_404(User, pk=pk)
    person = user.person_or_none
    if person is None:
        person = Person.objects.create(user=user, first_name=user.email.split("@")[0].title(), last_name="-")
    form = ProfileForm(None, prefix="p", person=person, require_kind=True)
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add":
            form = ProfileForm(request.POST, prefix="p", person=person, require_kind=True)
            if form.is_valid():
                with transaction.atomic():
                    prof = form.save(person)
                    if not user.login_id and form.login_number() and \
                            not User.objects.filter(login_id=form.login_number()).exists():
                        user.login_id = form.login_number()
                        user.save(update_fields=["login_id"])
                invalidate(user)
                messages.success(request, f"{prof.label} profile added.")
                return redirect("access:user_profiles", pk=user.pk)
        elif action in ("close", "reopen"):
            kind = request.POST.get("kind")
            model = {"student": StudentProfile, "lecturer": LecturerProfile, "staff": StaffProfile,
                     "alumni": AlumniProfile}.get(kind)
            if model is None:
                raise Http404
            obj = get_object_or_404(model.all_objects, pk=request.POST.get("profile"), person=person)
            if action == "close":
                with transaction.atomic():
                    obj.delete()
                    still_open = any(r["open"] and r["kind"] == kind for r in _profiles_of(person))
                    ended = 0
                    if not still_open:
                        for a in Appointment.objects.filter(person=person, profile_kind=kind).filter(_current_q()):
                            appointing.end_appointment(actor=request.user, appointment=a, reason="profile closed",
                                                       check_actor=False)
                            ended += 1
                invalidate(user)
                messages.success(request, f"{obj.label} profile closed" + (f" and {ended} appointment{'s' if ended != 1 else ''} ended." if ended else "."))
            else:
                if kind == "student":
                    clash = StudentProfile.objects.filter(reg_number=obj.reg_number).exclude(pk=obj.pk).exists()
                    if clash:
                        messages.error(request, "Another open profile uses this registration number.")
                        return redirect("access:user_profiles", pk=user.pk)
                obj.restore()
                invalidate(user)
                messages.success(request, f"{obj.label} profile reopened.")
            return redirect("access:user_profiles", pk=user.pk)
    return render(request, "access/user_profiles.html", {
        "u": user, "person": person, "profiles": _profiles_of(person), "form": form,
        "formats": RegNumberCategory.objects.filter(is_active=True).select_related("programme"),
    })


@need("accounts.matrix_edit", "accounts.users_manage")
def user_overrides(request, pk):
    user = get_object_or_404(User, pk=pk)
    groups = capability_catalogue()
    by_full, _ = _catalogue_index(groups)
    data = request.POST if request.method == "POST" and request.POST.get("action") == "add" else None
    form = OverrideForm(data, catalogue=groups)
    if request.method == "POST":
        if not request.user.has_perm("accounts.matrix_edit"):
            raise PermissionDenied
        action = request.POST.get("action")
        if action == "add" and form.is_valid():
            cd = form.cleaned_data
            item = by_full.get(cd["permission"])
            if item is None:
                form.add_error("permission", "Choose a permission from the list.")
            else:
                expires = None
                if cd.get("expires_on"):
                    expires = timezone.make_aware(datetime.combine(cd["expires_on"], time(23, 59)))
                PermissionOverride.objects.update_or_create(
                    user=user, permission_id=item["pk"],
                    defaults={"effect": cd["effect"], "reason": cd["reason"], "expires_at": expires,
                              "granted_by": request.user})
                invalidate(user)
                verb = "granted to" if cd["effect"] == "grant" else "revoked from"
                messages.success(request, f"“{item['label']}” {verb} {user.get_full_name()}.")
                return redirect("access:user_overrides", pk=user.pk)
        elif action == "remove":
            o = get_object_or_404(PermissionOverride, pk=request.POST.get("override"), user=user)
            o.delete()
            invalidate(user)
            messages.success(request, "Override removed.")
            return redirect("access:user_overrides", pk=user.pk)
    rows = []
    for o in user.permission_overrides.select_related("permission__content_type", "granted_by").order_by("-created_at"):
        full = f"{o.permission.content_type.app_label}.{o.permission.codename}"
        rows.append({"o": o, "full": full, "label": by_full.get(full, {}).get("label", o.permission.name)})
    return render(request, "access/user_overrides.html", {"u": user, "form": form, "rows": rows,
                                                          "can_edit": request.user.has_perm("accounts.matrix_edit")})


@login_required
def person_search(request):
    """HTMX: people matching ?q= for the appointment and grant pickers.
    With ?office=<code>, only people who may hold that office, with their eligible profiles."""
    office = Office.objects.filter(code=request.GET.get("office") or "").first()
    if office is not None:
        if not (appointing.can_appoint(request.user, office)
                or any(o.pk == office.pk for o, _lv in appointing.appointable_offices(request.user))):
            raise PermissionDenied
    elif not (request.user.has_perm("accounts.offices_appoint") or request.user.has_perm("accounts.users_manage")
              or request.user.has_perm("accounts.grants_manage") or request.user.has_perm("accounts.matrix_edit")):
        # Delegated grantors (a class rep) only ever search inside an office's eligible people.
        raise PermissionDenied
    q = (request.GET.get("q") or "").strip()
    people = []
    if len(q) >= 2:
        qs = Person.objects.select_related("user", "lecturer_profile", "staff_profile", "alumni_profile")
        if office is not None:
            qs = appointing.eligible_people(office, qs)
        for term in q.split()[:4]:
            qs = qs.filter(Q(first_name__icontains=term) | Q(last_name__icontains=term) | Q(user__email__icontains=term)
                           | Q(student_profiles__reg_number__icontains=term) | Q(lecturer_profile__staff_number__icontains=term)
                           | Q(staff_profile__staff_number__icontains=term))
        for p in qs.distinct()[:12]:
            if office is not None:
                kinds = appointing.eligible_profile_kinds(p, office)
            else:
                kinds = [r.kind for r in available_profiles(p.user)] if p.user_id else []
            people.append({"p": p, "kinds": [k for k in kinds if k != "admin"]})
    return render(request, "access/_person_results.html", {"people": people, "q": q, "office": office,
                                                           "need_user": request.GET.get("need") == "user"})


# ---------------------------------------------------------------------------
# Offices
# ---------------------------------------------------------------------------
@need("accounts.offices_manage")
def offices(request):
    q = (request.GET.get("q") or "").strip()
    cat = request.GET.get("category") or ""
    show = request.GET.get("show") or ""
    qs = Office.objects.annotate(
        holders=Count("appointments", filter=_current_q("appointments__"), distinct=True),
        perm_count=Count("permissions", distinct=True))
    if q:
        qs = qs.filter(Q(name__icontains=q) | Q(short_name__icontains=q) | Q(code__icontains=q) | Q(description__icontains=q))
    if cat:
        qs = qs.filter(category=cat)
    if show == "templates":
        qs = qs.filter(is_template=True)
    elif show == "inactive":
        qs = qs.filter(is_active=False)
    grouped = []
    labels = dict(Office.CATEGORIES)
    by_cat = {}
    for o in qs.order_by("-rank", "name"):
        by_cat.setdefault(o.category, []).append(o)
    for key, label in Office.CATEGORIES:
        if key in by_cat:
            grouped.append({"key": key, "label": labels[key], "offices": by_cat[key]})
    return render(request, "access/offices.html", {
        "grouped": grouped, "q": q, "category": cat, "show": show, "categories": Office.CATEGORIES,
        "total": sum(len(g["offices"]) for g in grouped),
        "templates": Office.objects.filter(is_template=True, is_active=True),
    })


@need("accounts.offices_manage")
def office_create(request):
    initial = {}
    src = request.GET.get("from")
    tpl = Office.objects.filter(code=src).first() if src else None
    if tpl is not None:
        initial = {"template": tpl.pk} if tpl.is_template else {"copy_from": tpl.pk, "name": f"{tpl.name} (copy)"}
    form = OfficeCreateForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        cd = form.cleaned_data
        tpl = cd.get("template")
        with transaction.atomic():
            office = Office(code=cd["code"], name=cd["name"], short_name=cd.get("short_name") or "")
            if tpl is not None:
                for f in ("description", "category", "profile_kind", "scope_kind", "rank", "max_holders", "icon", "color"):
                    setattr(office, f, getattr(tpl, f))
                office.dashboard_widgets = list(tpl.dashboard_widgets or [])
                office.created_from = tpl
            else:
                office.dashboard_widgets = ["office_profile", "quick_actions", "office_holders", "calendar", "notifications"]
            office.is_template = False
            office.is_system = False
            office.save()
            if tpl is not None:
                office.permissions.set(list(tpl.permissions.all()))
        invalidate(request.user)
        messages.success(request, f"{office.name} created" + (f" from {tpl.name}" if tpl else "")
                         + ". Adjust its permissions and dashboard below.")
        return redirect("access:office_edit", code=office.code)
    tpls = Office.objects.filter(is_template=True, is_active=True).annotate(perm_count=Count("permissions"))
    copy_open = bool(form["copy_from"].value())
    return render(request, "access/office_create.html", {"form": form, "templates": tpls, "copy_open": copy_open})


@need("accounts.offices_manage")
def office_edit(request, code):
    office = get_object_or_404(Office, code=code)
    groups = capability_catalogue()
    can_matrix = request.user.has_perm("accounts.matrix_edit") or request.user.has_perm("accounts.offices_manage")
    form = OfficeForm(request.POST or None, instance=office)
    if request.method == "POST":
        if request.POST.get("action") == "delete":
            if office.is_system:
                messages.error(request, "Offices shipped with EE Hub cannot be deleted. Switch it off instead.")
            elif Appointment.all_objects.filter(office=office).exists():
                messages.error(request, "This office has appointment history, so it cannot be deleted. Switch it off instead.")
            else:
                name = office.name
                office.delete()
                messages.success(request, f"{name} deleted.")
                return redirect("access:offices")
            return redirect("access:office_edit", code=office.code)
        if form.is_valid():
            with transaction.atomic():
                office = form.save(commit=False)
                office.dashboard_widgets = _posted_widgets(request)
                office.save()
                added, removed = (0, 0)
                if can_matrix:
                    added, removed = _save_permissions(office, groups, request.POST.getlist("perms"))
            invalidate(request.user)
            extra = f" ({added} permission{'s' if added != 1 else ''} added, {removed} removed)" if added or removed else ""
            messages.success(request, f"{office.name} saved{extra}.")
            return redirect("access:office_edit", code=office.code)
    selected = set(office.permissions.values_list("pk", flat=True))
    holders = office.current_appointments().filter(is_deleted=False).select_related("person", "scope_level", "scope_programme")
    return render(request, "access/office_edit.html", {
        "office": office, "form": form, "picker": _picker_context(groups, selected), "selected_count": len(selected),
        "widgets": _widget_picker(office.dashboard_widgets), "holders": holders, "today": _today(),
        "hide_end": not appointing.can_appoint(request.user, office),
        "allowed_text": appointing.kinds_text(appointing.allowed_profile_kinds(office)),
        "copies": office.copies.all()[:6],
    })


@login_required
def office_appoint(request, code):
    """Appoint someone. Open to anyone the delegation rules let appoint to this office (A4);
    only eligible people and profiles are offered (A1); saved through appointing.appoint()."""
    office = get_object_or_404(Office, code=code)
    if not appointing.can_appoint(request.user, office) and not any(
            o.pk == office.pk for o, _lv in appointing.appointable_offices(request.user)):
        raise PermissionDenied
    data = request.POST if request.method == "POST" else None
    form = AppointForm(data, office=office, actor=request.user, initial={"start_date": _today()})
    if request.method == "POST" and form.is_valid():
        cd = form.cleaned_data
        try:
            appt = appointing.appoint(
                actor=request.user, person=cd["person"], office=office, profile_kind=cd["profile_kind"],
                scope_programme=cd.get("scope_programme"), scope_level=cd.get("scope_level"),
                scope_label=cd.get("scope_label") or "", start_date=cd["start_date"], end_date=cd.get("end_date"),
                is_acting=cd.get("is_acting", False), note=cd.get("note") or "")
        except (appointing.EligibilityError, appointing.DelegationError) as exc:
            form.add_error(None, str(exc))
        else:
            messages.success(request, f"{appt.person.plain_name} appointed {('acting ' if appt.is_acting else '')}{office.name}.")
            fallback = (reverse("access:office_edit", args=[office.code]) + "#holders"
                        if request.user.has_perm("accounts.offices_manage") else reverse("access:my_access"))
            return redirect(_safe_next(request, fallback))
    chosen = None
    if form.is_bound and form.data.get("person"):
        chosen = Person.objects.filter(pk=form.data.get("person")).first()
    holders = office.current_appointments().filter(is_deleted=False).select_related("person", "scope_level", "scope_programme")
    if getattr(form, "level_ids", None) is not None:
        holders = holders.filter(scope_level_id__in=form.level_ids)
    allowed = appointing.allowed_profile_kinds(office)
    return render(request, "access/office_appoint.html", {
        "office": office, "form": form, "holders": holders, "chosen": chosen,
        "allowed_kinds": allowed, "allowed_text": appointing.kinds_text(allowed),
        "hide_end": not (appointing.can_appoint(request.user, office) or getattr(form, "level_ids", None)),
        "picker_kind": allowed[0] if len(allowed) == 1 else "any",
        "full": bool(office.max_holders and office.scope_kind == "department" and holders.count() >= office.max_holders),
    })


@login_required
@require_POST
def appointment_end(request, pk):
    appt = get_object_or_404(Appointment.objects.select_related("office", "person", "scope_level"), pk=pk)
    if not appointing.can_appoint(request.user, appt.office, scope_level=appt.scope_level):
        raise PermissionDenied
    reason = (request.POST.get("reason") or "").strip()[:200]
    future = appt.start_date > _today()
    appointing.end_appointment(actor=request.user, appointment=appt, reason=reason)
    if future:
        messages.success(request, f"Future appointment of {appt.person.plain_name} as {appt.office.name} cancelled.")
    else:
        messages.success(request, f"{appt.person.plain_name} no longer holds {appt.office.name}.")
    return redirect(_safe_next(request, reverse("access:office_edit", args=[appt.office.code]) + "#holders"))


# ---------------------------------------------------------------------------
# Permission matrix
# ---------------------------------------------------------------------------
def _column(key):
    """'role:student' -> ProfileRole, 'office:hod' -> Office."""
    kind, _, ident = (key or "").partition(":")
    if kind == "role":
        return "role", ProfileRole.objects.filter(kind=ident).first()
    if kind == "office":
        return "office", Office.objects.filter(code=ident).first()
    return None, None


@need("accounts.matrix_edit")
def matrix(request):
    groups = capability_catalogue()
    cat = request.GET.get("category", "leadership")
    show_roles = request.GET.get("roles", "1") != "0"
    q = (request.GET.get("q") or "").strip().lower()
    cols = []
    if show_roles:
        for r in ProfileRole.objects.prefetch_related("permissions"):
            cols.append({"key": f"role:{r.kind}", "label": r.name, "short": r.name, "icon": KIND_ICONS.get(r.kind, "user"),
                         "tone": KIND_TONES.get(r.kind, "slate"), "type": "role", "obj": r,
                         "perm_ids": {p.pk for p in r.permissions.all()},
                         "edit_url": reverse("access:profile_role_edit", args=[r.kind])})
    oqs = Office.objects.filter(is_active=True).prefetch_related("permissions").annotate(
        holders=Count("appointments", filter=_current_q("appointments__"), distinct=True)).order_by("category", "-rank", "name")
    if cat and cat != "all":
        oqs = oqs.filter(category=cat)
    for o in oqs:
        cols.append({"key": f"office:{o.code}", "label": o.name, "short": o.label, "icon": o.icon, "tone": o.color,
                     "type": "office", "obj": o, "holders": o.holders, "perm_ids": {p.pk for p in o.permissions.all()},
                     "edit_url": reverse("access:office_edit", args=[o.code])})
    if q:
        groups = [dict(g, items=[i for i in g["items"] if q in i["label"].lower() or q in i["full"]]) for g in groups]
        groups = [g for g in groups if g["items"]]
    return render(request, "access/matrix.html", {
        "groups": groups, "cols": cols, "category": cat, "categories": Office.CATEGORIES, "show_roles": show_roles,
        "q": request.GET.get("q", ""), "ncols": len(cols) + 1, "roles": ProfileRole.objects.all(),
    })


@need("accounts.matrix_edit")
@require_POST
def matrix_toggle(request):
    ctype, obj = _column(request.POST.get("col"))
    if obj is None:
        raise Http404("Unknown column")
    groups = capability_catalogue()
    _, by_pk = _catalogue_index(groups)
    try:
        perm_pk = int(request.POST.get("perm"))
    except (TypeError, ValueError):
        raise Http404("Unknown permission")
    item = by_pk.get(perm_pk)
    if item is None:
        raise Http404("Unknown permission")
    has = obj.permissions.filter(pk=perm_pk).exists()
    if has:
        obj.permissions.remove(perm_pk)
    else:
        obj.permissions.add(perm_pk)
    audit.log("update", obj, changes={"permission": {"old": has, "new": not has, "code": item["full"]}},
              note=f"matrix: {'removed' if has else 'granted'} {item['full']}")
    invalidate(request.user)
    col = {"key": request.POST.get("col"), "label": str(obj)}
    resp = render(request, "access/_matrix_cell.html", {"col": col, "item": item, "on": not has})
    name = obj.name
    return _hx_toast(resp, f"{'Removed' if has else 'Granted'}: {item['label']}", "success" if not has else "info",
                     f"{'from' if has else 'to'} {name}")


@need("accounts.matrix_edit")
def matrix_holders(request):
    ctx = {"rows": [], "title": "", "mode": ""}
    col = request.GET.get("col")
    perm = request.GET.get("perm")
    if col:
        ctype, obj = _column(col)
        if obj is None:
            raise Http404
        ctx["mode"] = ctype
        ctx["title"] = obj.name
        ctx["obj"] = obj
        if ctype == "office":
            for a in obj.current_appointments().filter(is_deleted=False).select_related("person", "scope_level", "scope_programme"):
                ctx["rows"].append({"name": a.person.full_name, "via": "Acting" if a.is_acting else "Office",
                                    "scope": a.scope_text, "since": a.start_date, "user_id": a.person.user_id, "appt": a})
            ctx["perm_count"] = obj.permissions.count()
        else:
            kind = obj.kind
            if kind == "student":
                qs = StudentProfile.objects.filter(status="active").select_related("person")
            else:
                model = {"lecturer": LecturerProfile, "staff": StaffProfile, "alumni": AlumniProfile}[kind]
                qs = model.objects.select_related("person")
            ctx["total"] = qs.count()
            for prof in qs[:20]:
                ctx["rows"].append({"name": prof.person.full_name, "via": "Profile", "scope": getattr(prof, "reg_number", "") or "",
                                    "user_id": prof.person.user_id})
            ctx["perm_count"] = obj.permissions.count()
    elif perm:
        ctx["mode"] = "perm"
        _, by_pk = _catalogue_index(capability_catalogue())
        by_full = {i["full"]: i for i in by_pk.values()}
        item = by_full.get(perm)
        if item is None:
            raise Http404
        ctx["title"] = item["label"]
        ctx["code"] = item["full"]
        ctx["rows"] = holders_of(perm)
    return render(request, "access/_matrix_holders.html", ctx)


@need("accounts.matrix_edit")
def profile_role_edit(request, kind):
    if kind not in dict(PROFILE_KINDS):
        raise Http404
    role, _ = ProfileRole.objects.get_or_create(kind=kind, defaults={"name": dict(PROFILE_KINDS)[kind]})
    groups = capability_catalogue()
    form = ProfileRoleForm(request.POST or None, instance=role)
    if request.method == "POST" and form.is_valid():
        with transaction.atomic():
            role = form.save(commit=False)
            role.dashboard_widgets = _posted_widgets(request)
            role.save()
            added, removed = _save_permissions(role, groups, request.POST.getlist("perms"))
        invalidate(request.user)
        messages.success(request, f"{role.name} saved" + (f" ({added} added, {removed} removed)" if added or removed else "") + ".")
        return redirect("access:profile_role_edit", kind=kind)
    selected = set(role.permissions.values_list("pk", flat=True))
    return render(request, "access/profile_role_edit.html", {
        "role": role, "form": form, "picker": _picker_context(groups, selected), "selected_count": len(selected),
        "widgets": _widget_picker(role.dashboard_widgets or widget_registry.DEFAULT_PROFILE_WIDGETS.get(kind, [])),
        "icon": KIND_ICONS.get(kind, "user"), "tone": KIND_TONES.get(kind, "slate"),
        "roles": ProfileRole.objects.all(),
    })


# ---------------------------------------------------------------------------
# Registration numbers
# ---------------------------------------------------------------------------
@need("accounts.regno_manage")
def regno_list(request):
    cats = RegNumberCategory.objects.select_related("programme").annotate(n_students=Count("students"))
    rows = [{"c": c, "explain": regno.explain(c.pattern), "tokens": pattern_tokens(c.pattern)} for c in cats]
    return render(request, "access/regno_list.html", {"rows": rows})


def _regno_form_view(request, instance=None):
    form = RegNumberCategoryForm(request.POST or None, instance=instance,
                                 initial=None if instance else {"auto_pattern": True, "profile_kind": "student", "priority": 10})
    if request.method == "POST":
        if instance is not None and request.POST.get("action") == "delete":
            if instance.students.exists():
                messages.error(request, "Students are linked to this format. Switch it off instead.")
                return redirect("access:regno_edit", pk=instance.pk)
            name = instance.name
            instance.delete()
            messages.success(request, f"{name} deleted.")
            return redirect("access:regno_list")
        if form.is_valid():
            obj = form.save()
            messages.success(request, f"{obj.name} saved.")
            return redirect("access:regno_list")
    if request.method == "POST":
        samples, auto, pattern = (request.POST.get("samples", ""), request.POST.get("auto_pattern") == "on",
                                  request.POST.get("pattern", ""))
    elif instance is not None:
        samples, auto, pattern = instance.samples, instance.auto_pattern, instance.pattern
    else:
        samples, auto, pattern = "", True, ""
    preview = _regno_preview_context(samples, auto, pattern, "", instance.pk if instance else None,
                                     instance.profile_kind if instance else "student")
    return render(request, "access/regno_form.html", {"form": form, "obj": instance, "p": preview})


@need("accounts.regno_manage")
def regno_create(request):
    return _regno_form_view(request)


@need("accounts.regno_manage")
def regno_edit(request, pk):
    return _regno_form_view(request, get_object_or_404(RegNumberCategory, pk=pk))


_TOK = re.compile(r"\\d\{(\d+)(?:,(\d+))?\}|\\d\+|\\d|\[A-Z\]\{(\d+)(?:,(\d+))?\}|\[A-Z\]\+|\[A-Z\]|\\(.)|([A-Za-z0-9]+)|(.)")


def _split_alternatives(body):
    if body.startswith("(?:") and body.endswith(")"):
        inner, depth, parts, cur = body[3:-1], 0, [], ""
        for ch in inner:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch == "|" and depth == 0:
                parts.append(cur)
                cur = ""
            else:
                cur += ch
        parts.append(cur)
        if depth == 0:
            return parts
    return [body]


def pattern_tokens(pattern):
    """[[{kind, regex, label, sample}, ...], ...] one list per alternative."""
    body = (pattern or "").strip()
    if body.startswith("^"):
        body = body[1:]
    if body.endswith("$") and not body.endswith("\\$"):
        body = body[:-1]
    out = []
    for alt in _split_alternatives(body):
        toks = []
        for m in _TOK.finditer(alt):
            d_lo, d_hi, a_lo, a_hi, esc, lit, other = m.groups()
            raw = m.group(0)
            if d_lo or raw in ("\\d", "\\d+"):
                n = d_lo or ("1" if raw == "\\d" else None)
                label = (f"{d_lo}–{d_hi} digits" if d_hi else f"{n} digit{'s' if n != '1' else ''}") if n else "digits"
                toks.append({"kind": "digits", "regex": raw, "label": label, "sample": "0123456789"[1:int(n) + 1] if n and int(n) < 10 else "123"})
            elif a_lo or raw in ("[A-Z]", "[A-Z]+"):
                n = a_lo or ("1" if raw == "[A-Z]" else None)
                label = (f"{a_lo}–{a_hi} letters" if a_hi else f"{n} letter{'s' if n != '1' else ''}") if n else "letters"
                toks.append({"kind": "letters", "regex": raw, "label": label, "sample": "ABCDEFGHIJ"[:int(n)] if n and int(n) <= 10 else "AB"})
            elif esc is not None:
                toks.append({"kind": "literal" if esc.isalnum() else "sep", "regex": raw, "label": f"“{esc}”", "sample": esc})
            elif lit:
                toks.append({"kind": "literal", "regex": re.escape(lit), "label": f"exactly “{lit}”", "sample": lit})
            else:
                kind = "sep" if other in "/-. _" else "other"
                toks.append({"kind": kind, "regex": re.escape(other) if kind == "sep" else other,
                             "label": f"“{other}”" if kind == "sep" else other, "sample": other if kind == "sep" else "?"})
        out.append(toks)
    return out


def _diagnose(value, alts):
    """Why a value fails: furthest progress over the alternatives."""
    best = None
    for toks in alts:
        pos, failed = 0, None
        for t in toks:
            if t["kind"] == "other":
                return None
            m = re.compile(t["regex"]).match(value, pos)
            if not m:
                failed = t
                break
            pos = m.end()
        if failed is None and pos == len(value):
            return None
        score = pos
        if best is None or score > best[0]:
            best = (score, failed, toks)
    if best is None:
        return None
    pos, failed, _ = best
    if failed is None:
        return {"pos": pos, "ok_part": value[:pos], "bad_part": value[pos:], "text": f"Extra characters after “{value[:pos]}”."}
    found = value[pos:pos + 6] or "nothing"
    return {"pos": pos, "ok_part": value[:pos], "bad_part": value[pos:],
            "text": f"Expected {failed['label']} at position {pos + 1}, found “{found}”."}


def _regno_preview_context(samples_text, auto, pattern, test, exclude_pk=None, profile_kind="student"):
    samples = [s.strip().upper() for s in (samples_text or "").splitlines() if s.strip()]
    ctx = {"samples": [], "auto": auto, "test": (test or "").strip().upper(), "error": ""}
    if auto:
        pattern = regno.pattern_from_samples(samples) if samples else ""
    pattern = (pattern or "").strip()
    ctx["pattern"] = pattern
    if not pattern:
        ctx["empty"] = True
        return ctx
    try:
        rx = re.compile(pattern.strip("^$"))
    except re.error as exc:
        ctx["error"] = f"This is not a valid pattern: {exc}."
        return ctx
    ctx["explain"] = regno.explain(pattern)
    ctx["tokens"] = pattern_tokens(pattern)
    try:
        ex = regno.example_for(pattern)
        ctx["example"] = ex if rx.fullmatch(ex) else ""
    except Exception:
        ctx["example"] = ""
    ctx["samples"] = [{"value": s, "ok": bool(rx.fullmatch(s))} for s in samples]
    if ctx["test"]:
        ok = bool(rx.fullmatch(ctx["test"]))
        ctx["test_ok"] = ok
        if not ok:
            ctx["why"] = _diagnose(ctx["test"], ctx["tokens"])
        others = []
        for c in RegNumberCategory.objects.filter(is_active=True).exclude(pk=exclude_pk):
            if c.matches(ctx["test"]):
                others.append(c)
        ctx["also"] = others
    probe = ctx.get("example") or (samples[0] if samples else "")
    if probe:
        ctx["overlaps"] = [c for c in RegNumberCategory.objects.filter(is_active=True, profile_kind=profile_kind or "student")
                           .exclude(pk=exclude_pk) if c.matches(probe)]
    return ctx


@need("accounts.regno_manage", "accounts.users_manage")
def regno_preview(request):
    """HTMX: live pattern, explanation, example and test result.
    mode=identify (also open to user managers) says which format a number belongs to."""
    src = request.POST if request.method == "POST" else request.GET
    if src.get("mode") != "identify" and not request.user.has_perm("accounts.regno_manage"):
        raise PermissionDenied
    if src.get("mode") == "identify":
        value = (src.get("test") or "").strip().upper()
        found = regno.categorise(value) if value else None
        return render(request, "access/_regno_identify.html", {"value": value, "found": found,
                                                                "kind_label": dict(PROFILE_KINDS).get(getattr(found, "profile_kind", ""), "")})
    auto = src.get("auto_pattern") in ("on", "true", "1", "True")
    try:
        exclude = int(src.get("pk") or 0) or None
    except ValueError:
        exclude = None
    ctx = _regno_preview_context(src.get("samples", ""), auto, src.get("pattern", ""), src.get("test", ""), exclude,
                                 src.get("profile_kind") or "student")
    return render(request, "access/_regno_preview.html", {"p": ctx})
