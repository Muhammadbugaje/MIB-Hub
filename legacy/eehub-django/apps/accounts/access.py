"""Profiles, the Acting-as switcher and the permission resolver.

effective permissions =
    base role of the ACTIVE profile kind
  ∪ every current office appointment that sits in that profile kind (or 'any')
  ∪ the user's direct Django permissions and groups
  ∪ personal grants (PermissionOverride, effect=grant, not expired)
  ∪ time-boxed access grants running now for this profile (AccessGrant, round 7 A3)
  − personal revokes
Superusers hold everything.

This is THE resolver (round 7, A2): every permission check in EE Hub is
`user.has_perm(...)`, which the EEHubBackend answers from here. Code that needs
"is this the super admin?" calls `is_super_admin(user)` instead of reading
`user.is_superuser` itself (accounts/tests/test_r7_resolver.py scans for that).

Caching: the result is kept per user + profile in the shared cache, made stale by
any database write (core.perf generation) and, because grants and overrides start
and end with the clock, never kept past the next start/expiry moment.
"""
import time
from dataclasses import dataclass, field

from django.db.models import Q
from django.utils import timezone

SESSION_KEY = "ee_active_profile"


@dataclass
class ProfileRef:
    kind: str           # student | lecturer | staff | alumni | admin
    pk: int | None
    label: str
    sublabel: str = ""
    obj: object = None
    offices: list = field(default_factory=list)

    @property
    def key(self):
        return f"{self.kind}:{self.pk or 0}"

    @property
    def icon(self):
        return {"student": "graduation-cap", "lecturer": "presentation", "staff": "briefcase",
                "alumni": "award", "admin": "shield-check"}.get(self.kind, "user")


def current_appointments_all(person):
    """Every current appointment of `person` (any office, active or not), with
    office and scope loaded. One query per person object, reused by the
    profile switcher, the permission resolver and the sidebar checks
    (registration, student requests, CBT tutors) instead of one query each."""
    cached = getattr(person, "_ee_current_appts", None)
    if cached is None:
        today = timezone.localdate()
        cached = list(person.appointments.filter(is_deleted=False, start_date__lte=today)
                      .filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
                      .select_related("office", "scope_level", "scope_programme"))
        person._ee_current_appts = cached
    return cached


def _current_appointments(person):
    return [a for a in current_appointments_all(person) if a.office.is_active]


def _prefetch_person(user):
    """Load user.person with its lecturer/staff/alumni profiles in one query
    (instead of four), unless it is already loaded."""
    from .models import Person, User

    if not isinstance(user, User) or user.pk is None or "person" in user._state.fields_cache:
        return
    person = (Person._base_manager.select_related("lecturer_profile", "staff_profile", "alumni_profile")
              .filter(user_id=user.pk).first())
    User.person.related.set_cached_value(user, person)
    if person is not None:
        Person.user.field.set_cached_value(person, user)


def available_profiles(user):
    """Every profile this user can act as, in a stable order."""
    if not getattr(user, "is_authenticated", False):
        return []
    cached = getattr(user, "_ee_profiles", None)
    if cached is not None:
        return cached
    refs = []
    _prefetch_person(user)
    person = getattr(user, "person_or_none", None)
    if person is not None:
        appts = list(_current_appointments(person))
        by_kind = {}
        for a in appts:
            by_kind.setdefault(a.profile_kind, []).append(a)
        lp = getattr(person, "lecturer_profile", None) if hasattr(person, "lecturer_profile") else None
        try:
            lp = person.lecturer_profile
        except Exception:
            lp = None
        if lp and not lp.is_deleted:
            refs.append(ProfileRef("lecturer", lp.pk, "Lecturer", lp.rank, lp, by_kind.get("lecturer", [])))
        try:
            sp = person.staff_profile
        except Exception:
            sp = None
        if sp and not sp.is_deleted:
            refs.append(ProfileRef("staff", sp.pk, "Staff", sp.designation, sp, by_kind.get("staff", [])))
        for st in person.student_profiles.filter(is_deleted=False).exclude(status="graduated").select_related("programme", "level"):
            sub = st.reg_number
            refs.append(ProfileRef("student", st.pk, st.label, sub, st, by_kind.get("student", [])))
        try:
            al = person.alumni_profile
        except Exception:
            al = None
        if al and not al.is_deleted:
            refs.append(ProfileRef("alumni", al.pk, al.label, al.programme_name, al, by_kind.get("alumni", [])))
    if user.is_superuser or (not refs and user.is_staff):
        refs.append(ProfileRef("admin", None, "Administrator", "System administration"))
    user._ee_profiles = refs
    return refs


def resolve_active(request):
    user = request.user
    profiles = available_profiles(user)
    if not profiles:
        return None
    wanted = request.session.get(SESSION_KEY) or getattr(user, "default_profile", "") or ""
    for p in profiles:
        if p.key == wanted:
            return p
    return profiles[0]


def switch_profile(request, key):
    for p in available_profiles(request.user):
        if p.key == key:
            request.session[SESSION_KEY] = key
            invalidate(request.user)
            return p
    return None


# ---------------------------------------------------------------------------
# Permission resolution
# ---------------------------------------------------------------------------
def _perm_names(qs):
    return {f"{ct}.{code}" for ct, code in qs.values_list("content_type__app_label", "codename")}


def is_super_admin(user):
    """THE super-admin test (all powers, Act as another user, eligibility overrides)."""
    return bool(getattr(user, "is_authenticated", False) and getattr(user, "is_active", False)
                and getattr(user, "is_superuser", False))


PERM_CACHE_TTL = 60


def effective_permissions(user, kind=None):
    from django.contrib.auth.models import Permission

    if not user.is_active:
        return set()
    if user.is_superuser:
        cached = getattr(user, "_ee_perm_cache_superuser", None)
        if cached is None:
            from core import perf
            cached = perf.memo(("perms", "superuser"), lambda: _perm_names(Permission.objects.all()), ttl=300)
            user._ee_perm_cache_superuser = cached
        return cached
    kind = kind or getattr(user, "_ee_active_kind", None)
    cache_attr = f"_ee_perm_cache_{kind}"
    cached = getattr(user, cache_attr, None)
    if cached is not None:
        return cached
    perms = _cached_permissions(user, kind)
    setattr(user, cache_attr, perms)
    return perms


def _cached_permissions(user, kind):
    """Shared-cache copy of `_compute_permissions`, stale after any write (core.perf) and
    never served past the next moment a grant or override starts or ends."""
    from django.core.cache import cache

    from core import perf

    if not perf.enabled() or perf.request_dirty():
        return _compute_permissions(user, kind)[0]
    ck = "ee:perms:%s:%s:%s" % (perf.generation(), user.pk, kind)
    hit = cache.get(ck)
    now = time.time()
    if hit is not None:
        perms, valid_until = hit
        if valid_until is None or now < valid_until:
            return perms
    perms, boundary = _compute_permissions(user, kind)
    ttl = PERM_CACHE_TTL
    valid_until = None
    if boundary is not None:
        valid_until = boundary.timestamp()
        ttl = max(1, min(ttl, int(valid_until - now) + 1))
    if not perf.request_dirty():
        cache.set(ck, (perms, valid_until), ttl)
    return perms


def _active_grants(user, kind, now):
    """(grants running now that count for `kind`, the next start/end moment or None)."""
    from .models import AccessGrant

    rows = list(AccessGrant.objects.filter(user=user, revoked_at__isnull=True, ends_at__gt=now)
                .filter(Q(profile_kind="") | Q(profile_kind=kind or ""))
                .prefetch_related("permissions__content_type"))
    boundary = None
    running = []
    for g in rows:
        if g.starts_at > now:
            boundary = g.starts_at if boundary is None else min(boundary, g.starts_at)
            continue
        boundary = g.ends_at if boundary is None else min(boundary, g.ends_at)
        running.append(g)
    return running, boundary


def _compute_permissions(user, kind):
    """(permission names, next clock boundary or None)."""
    from django.contrib.auth.models import Permission

    from .models import PermissionOverride

    # Direct, group, profile-role and office permissions in ONE query (a UNION).
    sources = [Permission.objects.filter(user=user), Permission.objects.filter(group__user=user)]
    if kind and kind != "admin":
        sources.append(Permission.objects.filter(ee_profile_roles__kind=kind))
    person = getattr(user, "person_or_none", None)
    if person is not None:
        office_ids = {a.office_id for a in current_appointments_all(person)
                      if a.office.is_active and (not kind or a.profile_kind == kind or a.office.profile_kind == "any")}
        if office_ids:
            sources.append(Permission.objects.filter(ee_offices__in=list(office_ids)))
    vals = [q.order_by().values_list("content_type__app_label", "codename") for q in sources]
    perms = {f"{ct}.{code}" for ct, code in vals[0].union(*vals[1:])}
    now = timezone.now()
    boundary = None
    overrides = list(PermissionOverride.objects.filter(user=user).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)).select_related("permission__content_type"))
    for o in overrides:
        if o.expires_at is not None:
            boundary = o.expires_at if boundary is None else min(boundary, o.expires_at)
    for o in overrides:
        name = f"{o.permission.content_type.app_label}.{o.permission.codename}"
        if o.effect == PermissionOverride.GRANT:
            perms.add(name)
    grants, g_boundary = _active_grants(user, kind, now)
    for g in grants:
        for p in g.permissions.all():
            perms.add(f"{p.content_type.app_label}.{p.codename}")
    if g_boundary is not None:
        boundary = g_boundary if boundary is None else min(boundary, g_boundary)
    for o in overrides:
        name = f"{o.permission.content_type.app_label}.{o.permission.codename}"
        if o.effect == PermissionOverride.REVOKE:
            perms.discard(name)
    if kind == "lecturer" and person is not None and _is_service_lecturer(person):
        # A lecturer of another department teaches our courses (materials, tests, scores) but is
        # not department staff: no department memos, no staff directory, no department offices' tools
        # beyond what an explicit grant or override gave them.
        explicit = {f"{o.permission.content_type.app_label}.{o.permission.codename}"
                    for o in overrides if o.effect == PermissionOverride.GRANT}
        perms -= (DEPARTMENT_ONLY_PERMS - explicit)
    return perms, boundary


DEPARTMENT_ONLY_PERMS = {"accounts.memo_send", "accounts.directory_view"}


def _is_service_lecturer(person):
    try:
        lp = person.lecturer_profile
    except Exception:
        return False
    return bool(lp and not lp.is_deleted and lp.is_external)


def invalidate(user):
    """Forget what was worked out for `user` (this object and the shared cache)."""
    from core import perf
    perf.bump()
    for attr in list(vars(user)):
        if attr.startswith("_ee_perm_cache_") or attr in ("_ee_profiles", "_ee_delegations"):
            delattr(user, attr)
    person = user._state.fields_cache.get("person") if hasattr(user, "_state") else None
    if person is not None:
        for attr in ("_ee_current_appts", "_ee_active_students"):
            if hasattr(person, attr):
                delattr(person, attr)


def holders_of(perm_label):
    """People who effectively hold a permission (for the matrix side panel)."""
    from django.contrib.auth.models import Permission

    from .models import Appointment, PermissionOverride, ProfileRole, User

    app_label, codename = perm_label.split(".", 1)
    perm = Permission.objects.filter(content_type__app_label=app_label, codename=codename).first()
    if perm is None:
        return []
    today = timezone.localdate()
    rows = []
    for a in (Appointment.objects.filter(is_deleted=False, office__permissions=perm, office__is_active=True,
                                         start_date__lte=today)
              .filter(Q(end_date__isnull=True) | Q(end_date__gte=today)).select_related("person", "office")):
        rows.append({"name": a.person.full_name, "via": f"Office: {a.office.name}", "scope": a.scope_text})
    for role in ProfileRole.objects.filter(permissions=perm):
        rows.append({"name": f"Every {role.name.lower()}", "via": "Profile role", "scope": ""})
    for o in PermissionOverride.objects.filter(permission=perm, effect="grant").select_related("user"):
        if o.is_active:
            rows.append({"name": o.user.get_full_name(), "via": "Personal grant", "scope": o.reason})
    from .models import AccessGrant
    now = timezone.now()
    for g in (AccessGrant.objects.filter(permissions=perm, revoked_at__isnull=True, starts_at__lte=now, ends_at__gt=now)
              .select_related("user")):
        rows.append({"name": g.user.get_full_name(), "via": f"Grant until {timezone.localtime(g.ends_at):%d %b %Y}",
                     "scope": g.reason})
    for u in User.objects.filter(is_superuser=True, is_active=True):
        rows.append({"name": u.get_full_name(), "via": "Superuser", "scope": ""})
    return rows
