"""Round 7 access screens (R7A): appointments to review (A1/F6), grants (A3), delegation
rules (A4), my access, the access log (A14), class lists and class broadcast (F5),
and the "How access works" page.

Every check here is `user.has_perm(...)` (the resolver) or a rule from
accounts.appointing / accounts.grants — no raw superuser or group tests."""
from datetime import timedelta

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import Permission
from django.core.exceptions import PermissionDenied
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.pagination import paginate

from . import accesslog, appointing
from . import grants as G
from .access import is_super_admin
from .access_forms import BroadcastForm, DelegationRuleForm, GrantForm
from .access_views import capability_catalogue, need
from .models import AccessGrant, AccessLogEntry, Appointment, DelegationRule, Office, User

TUTOR_CODES = ("class-tutor",)
REP_CODES = ("class-rep", "assistant-class-rep")


def _today():
    return timezone.localdate()


def _current_q(prefix=""):
    today = _today()
    return (Q(**{f"{prefix}is_deleted": False, f"{prefix}start_date__lte": today})
            & (Q(**{f"{prefix}end_date__isnull": True}) | Q(**{f"{prefix}end_date__gte": today})))


# ---------------------------------------------------------------------------
# How it works
# ---------------------------------------------------------------------------
@login_required
def how(request):
    return render(request, "access/r7/how.html", {})


# ---------------------------------------------------------------------------
# A1 / F6: appointments that break the eligibility rules
# ---------------------------------------------------------------------------
@need("accounts.offices_appoint", "accounts.offices_manage")
def review_appointments(request):
    rows = []
    for a, why in appointing.wrong_appointments():
        rows.append({"a": a, "why": why, "can_end": appointing.can_appoint(request.user, a.office, scope_level=a.scope_level)})
    return render(request, "access/r7/review.html", {"rows": rows})


@need("accounts.offices_appoint", "accounts.offices_manage")
@require_POST
def review_end_all(request):
    n = 0
    for a, _why in appointing.wrong_appointments():
        if appointing.can_appoint(request.user, a.office, scope_level=a.scope_level):
            appointing.end_appointment(actor=request.user, appointment=a, reason="not eligible for this office")
            n += 1
    messages.success(request, f"{n} appointment{'s' if n != 1 else ''} ended." if n else "Nothing to end.")
    return redirect("access:review_appointments")


# ---------------------------------------------------------------------------
# A3: grants
# ---------------------------------------------------------------------------
def _grant_rows(qs, actor):
    return [{"g": g, "status": g.status, "can_revoke": g.status in ("active", "upcoming") and G.can_revoke(actor, g)}
            for g in qs]


@login_required
def grants(request):
    if not G.can_manage_grants(request.user):
        raise PermissionDenied
    status = request.GET.get("status") or "current"
    q = (request.GET.get("q") or "").strip()
    now = timezone.now()
    qs = AccessGrant.objects.select_related("user__person", "office", "granted_by__person", "revoked_by",
                                            "scope_level", "granted_via__grantor_office").prefetch_related("permissions")
    if not G.sees_all_grants(request.user):
        qs = qs.filter(Q(granted_by=request.user) | Q(user=request.user))
    counts = {
        "current": qs.filter(revoked_at__isnull=True, ends_at__gt=now).count(),
        "ended": qs.filter(revoked_at__isnull=True, ends_at__lte=now).count(),
        "revoked": qs.filter(revoked_at__isnull=False).count(),
    }
    if status == "ended":
        qs = qs.filter(revoked_at__isnull=True, ends_at__lte=now)
    elif status == "revoked":
        qs = qs.filter(revoked_at__isnull=False)
    elif status != "all":
        status = "current"
        qs = qs.filter(revoked_at__isnull=True, ends_at__gt=now)
    for term in q.split()[:4]:
        qs = qs.filter(Q(user__email__icontains=term) | Q(user__person__first_name__icontains=term)
                       | Q(user__person__last_name__icontains=term) | Q(reason__icontains=term)
                       | Q(office__name__icontains=term))
    page = paginate(request, qs.order_by("ends_at" if status == "current" else "-ends_at"), 25)
    return render(request, "access/r7/grants.html", {
        "page": page, "rows": _grant_rows(page.object_list, request.user), "status": status, "q": q, "counts": counts,
        "can_give": bool(G.grantable_permissions(request.user) or appointing.appointable_offices(request.user)),
        "sees_all": G.sees_all_grants(request.user),
    })


def _perm_choices(actor):
    allowed = G.grantable_permissions(actor)
    names = {}
    for grp in capability_catalogue():
        for i in grp["items"]:
            names[i["full"]] = (grp["label"], i["label"])
    groups = {}
    for label, (p, _rule) in allowed.items():
        if label not in names:
            continue
        g, lbl = names[label]
        groups.setdefault(g, []).append((label, lbl))
    order = [g["label"] for g in capability_catalogue()]
    return [(g, sorted(groups[g], key=lambda t: t[1])) for g in order if g in groups]


@login_required
def grant_create(request):
    if not G.can_manage_grants(request.user):
        raise PermissionDenied
    perm_groups = _perm_choices(request.user)
    flat = [c for _g, items in perm_groups for c in items]
    offices = [o for o, _lv in appointing.appointable_offices(request.user)]
    if not flat and not offices:
        messages.info(request, "Your offices do not let you grant anything.")
        return redirect("access:grants")
    today = _today()
    initial = {"starts_on": today, "ends_on": today + timedelta(days=14), "what": "perms" if flat else "office"}
    form = GrantForm(request.POST or None, actor=request.user, perm_choices=flat, offices=offices, initial=initial)
    chosen = None
    if form.is_bound and form.data.get("user"):
        chosen = User.objects.select_related("person").filter(pk=form.data.get("user")).first()
    if request.method == "POST" and form.is_valid():
        cd = form.cleaned_data
        start = cd["starts_on"]
        try:
            g = G.give(actor=request.user, user=cd["user"], reason=cd["reason"], until=cd["ends_on"],
                       start=None if start <= today else start, permissions=cd.get("permissions") or (),
                       office=cd.get("office"), scope_level=cd.get("scope_level"),
                       profile_kind=cd.get("profile_kind") or "")
        except (G.GrantError, appointing.EligibilityError, appointing.DelegationError) as exc:
            form.add_error(None, str(exc))
        else:
            messages.success(request, f"{g.user.get_full_name()} has {g.what.lower() if g.office_id else 'the access'} "
                                      f"until {timezone.localtime(g.ends_at):%d %b %Y}.")
            return redirect("access:grants")
    return render(request, "access/r7/grant_form.html", {
        "form": form, "perm_groups": perm_groups, "offices": offices, "chosen": chosen,
        "search_office": "" if (request.user.has_perm("accounts.grants_manage") or request.user.has_perm("accounts.matrix_edit")
                                or is_super_admin(request.user) or not offices) else offices[0].code,
        "max_days": G._site_max_days(), "posted_perms": set(form.data.getlist("permissions")) if form.is_bound else set(),
    })


@login_required
@require_POST
def grant_revoke(request, pk):
    g = get_object_or_404(AccessGrant, pk=pk)
    if not G.can_revoke(request.user, g):
        raise PermissionDenied
    G.revoke(g, actor=request.user, reason=(request.POST.get("reason") or "").strip()[:255] or "revoked by hand")
    messages.success(request, f"Access of {g.user.get_full_name()} revoked.")
    nxt = request.POST.get("next") or ""
    return redirect(nxt if nxt.startswith("/") and not nxt.startswith("//") else reverse("access:grants"))


# ---------------------------------------------------------------------------
# My access: what I hold, what I was granted, what I can appoint and grant
# ---------------------------------------------------------------------------
@login_required
def my_access(request):
    user = request.user
    ref = getattr(request, "active_profile", None)
    person = user.person_or_none
    appts = []
    if person is not None:
        appts = list(person.appointments.filter(_current_q()).select_related("office", "scope_level"))
    my_grants = list(G.active_for(user))
    given = list(AccessGrant.objects.filter(granted_by=user, revoked_at__isnull=True, ends_at__gt=timezone.now())
                 .select_related("user__person", "office").prefetch_related("permissions")[:20])
    appointable = appointing.appointable_offices(user) if not is_super_admin(user) else []
    rules = appointing.delegation_rules_for(user)
    return render(request, "access/r7/my_access.html", {
        "ref": ref, "appts": appts, "my_grants": my_grants, "given": _grant_rows(given, user),
        "appointable": appointable, "rules": rules, "is_super": is_super_admin(user),
        "can_grant": G.can_manage_grants(user) and bool(G.grantable_permissions(user) or appointable or is_super_admin(user)),
    })


# ---------------------------------------------------------------------------
# A4: delegation rules (data, editable)
# ---------------------------------------------------------------------------
def _perm_qs():
    return (Permission.objects.select_related("content_type")
            .filter(content_type__app_label="accounts", content_type__model="capability").order_by("name"))


@need("accounts.matrix_edit", "accounts.offices_manage")
def delegation(request):
    rules = (DelegationRule.objects.select_related("grantor_office")
             .prefetch_related("offices", "except_offices", "permissions"))
    rows = []
    for r in rules:
        rows.append({"r": r, "offices": list(r.office_queryset().order_by("-rank", "name")),
                     "perms": list(r.permissions.all())})
    return render(request, "access/r7/delegation.html", {"rows": rows, "can_edit": request.user.has_perm("accounts.matrix_edit")})


@need("accounts.matrix_edit")
def delegation_edit(request, pk=None):
    rule = get_object_or_404(DelegationRule, pk=pk) if pk else None
    form = DelegationRuleForm(request.POST or None, instance=rule, perm_qs=_perm_qs(),
                              initial=None if rule else {"scope_rule": "any", "is_active": True})
    if rule is not None and not form.is_bound:
        form.fields["office_categories"].initial = rule.office_categories
    if request.method == "POST":
        if rule is not None and request.POST.get("action") == "delete":
            rule.delete()
            messages.success(request, "Delegation rule deleted.")
            return redirect("access:delegation")
        if form.is_valid():
            obj = form.save(commit=False)
            obj.office_categories = list(form.cleaned_data.get("office_categories") or [])
            obj.save()
            form.save_m2m()
            from .access import invalidate
            invalidate(request.user)
            messages.success(request, f"Rule for {obj.grantor_office.name} saved.")
            return redirect("access:delegation")
    return render(request, "access/r7/delegation_form.html", {"form": form, "rule": rule})


# ---------------------------------------------------------------------------
# A14: access log
# ---------------------------------------------------------------------------
@need("accounts.access_log_view")
def access_log(request):
    qs = AccessLogEntry.objects.select_related("user", "subject", "impersonator")
    kind = request.GET.get("kind") or ""
    q = (request.GET.get("q") or "").strip()
    days = request.GET.get("days") or "30"
    if kind:
        qs = qs.filter(kind=kind)
    for term in q.split()[:4]:
        qs = qs.filter(Q(user_repr__icontains=term) | Q(object_repr__icontains=term)
                       | Q(subject__first_name__icontains=term) | Q(subject__last_name__icontains=term))
    if days.isdigit() and int(days) > 0:
        qs = qs.filter(at__gte=timezone.now() - timedelta(days=int(days)))
    page = paginate(request, qs, 40)
    since = timezone.now() - timedelta(days=7)
    top = (AccessLogEntry.objects.filter(at__gte=since).values("user_repr").annotate(n=Count("id")).order_by("-n")[:5])
    return render(request, "access/r7/access_log.html", {
        "page": page, "kinds": AccessLogEntry.KINDS, "kind": kind, "q": q, "days": days, "top": top,
        "periods": [("7", "Last 7 days"), ("30", "Last 30 days"), ("90", "Last 90 days"), ("0", "Everything")],
        "week": AccessLogEntry.objects.filter(at__gte=since).count(),
    })


# ---------------------------------------------------------------------------
# F5: class lists, reps and tutors; class broadcast
# ---------------------------------------------------------------------------
def visible_levels(user):
    """Levels whose class lists `user` may open: all, or only the levels of the
    level-scoped offices that give them `accounts.classes_view` (level coordinators)."""
    from django.contrib.auth.models import Permission as P

    from department.models import Level
    from .access import _current_appointments

    levels = Level.objects.select_related("programme")
    if is_super_admin(user):
        return levels
    if not user.has_perm("accounts.classes_view"):
        return levels.none()
    perm = P.objects.filter(content_type__app_label="accounts", codename="classes_view").first()
    person = user.person_or_none
    kind = getattr(user, "_ee_active_kind", None)
    via = [a for a in (_current_appointments(person) if person else [])
           if (not kind or a.profile_kind == kind or a.office.profile_kind == "any")
           and a.office.permissions.filter(pk=getattr(perm, "pk", 0)).exists()]
    if via and all(a.scope_level_id for a in via) and not _has_classes_view_elsewhere(user, kind, perm):
        return levels.filter(pk__in=[a.scope_level_id for a in via])
    return levels


def _has_classes_view_elsewhere(user, kind, perm):
    from .models import PermissionOverride, ProfileRole
    if perm is None:
        return False
    if kind and ProfileRole.objects.filter(kind=kind, permissions=perm).exists():
        return True
    if PermissionOverride.objects.filter(user=user, permission=perm, effect="grant").filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).exists():
        return True
    now = timezone.now()
    return AccessGrant.objects.filter(user=user, permissions=perm, revoked_at__isnull=True, starts_at__lte=now,
                                      ends_at__gt=now).exists()


def _class_officers(level_ids):
    out = {}
    for a in (Appointment.objects.filter(_current_q(), office__code__in=REP_CODES + TUTOR_CODES, scope_level_id__in=level_ids)
              .select_related("office", "person").order_by("-office__rank", "person__last_name")):
        d = out.setdefault(a.scope_level_id, {"reps": [], "tutors": []})
        (d["tutors"] if a.office.code in TUTOR_CODES else d["reps"]).append(a)
    return out


@need("accounts.classes_view")
def classes(request):
    from people.models import StudentProfile

    levels = list(visible_levels(request.user).annotate(
        n=Count("students", filter=Q(students__is_deleted=False, students__status="active"))))
    officers = _class_officers([l.pk for l in levels])
    rows = [{"l": l, "n": l.n, **officers.get(l.pk, {"reps": [], "tutors": []})} for l in levels]
    total = StudentProfile.objects.filter(is_deleted=False, status="active", level__in=[l.pk for l in levels]).count()
    return render(request, "access/r7/classes.html", {
        "rows": rows, "total": total, "can_broadcast": request.user.has_perm("accounts.class_broadcast")})


@need("accounts.classes_view")
def class_detail(request, pk):
    from people.models import StudentProfile

    level = get_object_or_404(visible_levels(request.user), pk=pk)
    q = (request.GET.get("q") or "").strip()
    qs = (StudentProfile.objects.filter(level=level, is_deleted=False).exclude(status="graduated")
          .select_related("person", "programme").order_by("person__last_name", "person__first_name"))
    for term in q.split()[:3]:
        qs = qs.filter(Q(person__first_name__icontains=term) | Q(person__last_name__icontains=term)
                       | Q(reg_number__icontains=term))
    page = paginate(request, qs, 50)
    contacts = request.user.has_perm("accounts.student_contacts_view")
    if contacts:
        accesslog.record(request, "student_contact", level, note=f"Class list with contacts: {level}")
    officers = _class_officers([level.pk]).get(level.pk, {"reps": [], "tutors": []})
    return render(request, "access/r7/class_detail.html", {
        "level": level, "page": page, "q": q, "contacts": contacts, **officers,
        "can_broadcast": request.user.has_perm("accounts.class_broadcast")})


def _offering_choices(levels):
    from academics.models import CourseOffering
    from department.models import current_semester

    sem = current_semester()
    if sem is None:
        return [], {}
    qs = (CourseOffering.objects.filter(semester=sem, is_deleted=False, course__level__in=levels)
          .select_related("course").order_by("course__code"))
    offerings = {str(o.pk): o for o in qs}
    return [(k, f"{o.course.code} · {o.course.title}") for k, o in offerings.items()], offerings


def broadcast_recipients(audience, level=None, offering=None):
    """Users who receive a class broadcast: active students of the level, or students
    registered (submitted or approved) on the offering. Never staff, never chats."""
    from people.models import StudentProfile

    if audience == "level" and level is not None:
        sts = StudentProfile.objects.filter(level=level, is_deleted=False, status="active", person__user__isnull=False)
    elif audience == "offering" and offering is not None:
        sts = StudentProfile.objects.filter(registrations__offering=offering, registrations__is_deleted=False,
                                            registrations__status__in=["submitted", "approved"],
                                            is_deleted=False, person__user__isnull=False)
    else:
        return User.objects.none()
    return User.objects.filter(is_active=True, person__student_profiles__in=sts).distinct()


@need("accounts.class_broadcast")
def broadcast(request):
    import config
    from notifications.services import notify_many

    levels = visible_levels(request.user)
    choices, offerings = _offering_choices(levels)
    initial = {}
    if request.GET.get("level"):
        initial = {"audience": "level", "level": request.GET.get("level")}
    elif request.GET.get("offering"):
        initial = {"audience": "offering", "offering": request.GET.get("offering")}
    form = BroadcastForm(request.POST or None, levels=levels, offerings=choices, initial=initial)
    preview = None
    if request.method == "POST" and form.is_valid():
        cd = form.cleaned_data
        offering = offerings.get(cd.get("offering") or "") if cd["audience"] == "offering" else None
        level = cd.get("level") if cd["audience"] == "level" else None
        users = list(broadcast_recipients(cd["audience"], level, offering))
        cap = int(config.get("access.broadcast_max_recipients", 600) or 600)
        target = str(level) if level is not None else f"{offering.course.code} students"
        if not users:
            form.add_error(None, f"Nobody to send to: {target} has no students with a sign-in.")
        elif len(users) > cap:
            form.add_error(None, f"{len(users)} students is more than the limit of {cap} (Settings).")
        elif request.POST.get("confirm") != "1":
            preview = {"count": len(users), "target": target}
        else:
            word = "Reminder" if cd["kind"] == "reminder" else "Announcement"
            sender = request.user.get_full_name()
            notify_many(users, title=f"{word}: {cd['title']}"[:255], body=f"{cd['body']}\n\n— {sender}, to {target}",
                        url=reverse("notifications:list"), category="class_broadcast", actor=request.user,
                        level="warning" if cd["kind"] == "reminder" else "info",
                        metadata={"broadcast": True, "target": target, "kind": cd["kind"]})
            from core import audit
            audit.log("other", request.user, actor=request.user,
                      note=f"class broadcast to {target}: {len(users)} students — {cd['title']}"[:255])
            messages.success(request, f"Sent to {len(users)} student{'s' if len(users) != 1 else ''} of {target}.")
            return redirect("access:classes")
    return render(request, "access/r7/broadcast.html", {"form": form, "preview": preview,
                                                        "has_offerings": bool(choices)})
