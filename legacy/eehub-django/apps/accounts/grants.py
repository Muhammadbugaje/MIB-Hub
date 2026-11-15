"""Time-boxed access grants (round 7, A3) and delegated granting (A4).

    from accounts import grants
    g = grants.give(actor=request.user, user=tutor, permissions=["accounts.academics_materials"],
                    reason="Tutorials for EEEN 301", until=end_of_semester, source=offering)
    grants.revoke(g, actor=request.user, reason="Tutorials finished")
    grants.close_for_source(offering, reason="Offering closed")   # when the work is done

Who may grant what
* The super admin: any permission, any office, anywhere.
* A holder of `accounts.grants_manage` (the HOD by default): any permission they hold
  themselves, and any office the delegation rules let them appoint to.
* Anyone whose office has a delegation rule: the rule's permissions (or, with
  "any held permission", any they hold) — always only those they hold — and the rule's
  offices, inside the rule's scope.
Nobody can grant beyond the site limit (Settings `access.grant_max_days`) or the rule's own
`max_days`. Every grant and revocation is audited.
"""
from datetime import datetime, time, timedelta

from django.contrib.auth.models import Permission
from django.db import transaction
from django.utils import timezone

from . import appointing
from .access import effective_permissions, invalidate, is_super_admin


class GrantError(ValueError):
    pass


def _label(p):
    return f"{p.content_type.app_label}.{p.codename}"


def _site_max_days():
    try:
        import config
        return int(config.get("access.grant_max_days", 180) or 0)
    except Exception:
        return 180


def _held(actor):
    """Every permission the actor holds in ANY of their profiles (a grantor's power does not
    depend on which profile they are acting as when they grant)."""
    from .access import available_profiles

    names = set()
    kinds = {r.kind for r in available_profiles(actor)} or {None}
    for k in kinds:
        names |= effective_permissions(actor, k)
    return names


def grantable_permissions(actor):
    """{label: (Permission, rule or None)} the actor may grant."""
    if actor is None or not getattr(actor, "is_authenticated", False):
        return {}
    perms = {_label(p): p for p in Permission.objects.select_related("content_type")
             .filter(content_type__app_label__in=["accounts", "core", "config", "registration"])}
    if is_super_admin(actor):
        return {k: (p, None) for k, p in perms.items()}
    held = _held(actor)
    out = {}
    if actor.has_perm("accounts.grants_manage"):
        for k, p in perms.items():
            if k in held:
                out[k] = (p, None)
    for rule, _appt in appointing.delegation_rules_for(actor):
        if rule.any_held_permission:
            for k, p in perms.items():
                if k in held:
                    out.setdefault(k, (p, rule))
        for p in rule.permissions.all():
            k = _label(p)
            if k in held:
                out.setdefault(k, (p, rule))
    return out


def can_manage_grants(actor):
    """May open the Grants screen at all (see everything, or at least the grants they gave)."""
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return (is_super_admin(actor) or actor.has_perm("accounts.grants_manage")
            or actor.has_perm("accounts.matrix_edit") or appointing.has_delegation_rules(actor))


def sees_all_grants(actor):
    return is_super_admin(actor) or actor.has_perm("accounts.grants_manage") or actor.has_perm("accounts.matrix_edit")


def _max_days_for(actor, rule):
    site = _site_max_days()
    if is_super_admin(actor):
        return site
    if rule is not None and rule.max_days:
        return min(site, rule.max_days) if site else rule.max_days
    return site


def _as_dt(value, end=False):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if timezone.is_aware(value) else timezone.make_aware(value)
    return timezone.make_aware(datetime.combine(value, time(23, 59, 59) if end else time(0, 0)))


@transaction.atomic
def give(*, actor, user, reason, until, permissions=(), office=None, start=None, scope_level=None, scope_label="",
         profile_kind="", source=None, source_label="", check_actor=True):
    """Create a grant. `permissions` are labels ('accounts.x') or Permission objects; or give `office`."""
    from django.contrib.contenttypes.models import ContentType

    from .models import AccessGrant

    reason = (reason or "").strip()
    if not reason:
        raise GrantError("Say why this access is needed.")
    starts = _as_dt(start) or timezone.now()
    ends = _as_dt(until, end=True)
    if ends is None:
        raise GrantError("A grant needs an end date.")
    if ends <= starts:
        raise GrantError("The end is before the start.")
    labels = [p if isinstance(p, str) else _label(p) for p in permissions or ()]
    if not labels and office is None:
        raise GrantError("Choose at least one permission or an office.")
    if labels and office is not None:
        raise GrantError("Grant either permissions or an office, not both.")
    rule = None
    if office is not None:
        if check_actor and not appointing.can_appoint(actor, office, scope_level=scope_level, scope_label=scope_label):
            raise appointing.DelegationError(f"You cannot give {office.name}"
                                             + (f" for {scope_level}" if scope_level else "") + ".")
        if check_actor and not is_super_admin(actor):
            rule = appointing.rule_for(actor, office, scope_level=scope_level)
    perm_objs = []
    if labels:
        allowed = grantable_permissions(actor) if check_actor else None
        for lab in labels:
            if allowed is not None:
                if lab not in allowed:
                    raise appointing.DelegationError(f"You cannot grant “{lab}”: you do not hold it, or it is outside your area.")
                p, r = allowed[lab]
                rule = rule or r
            else:
                app, code = lab.split(".", 1)
                p = Permission.objects.filter(content_type__app_label=app, codename=code).first()
                if p is None:
                    raise GrantError(f"Unknown permission {lab}.")
            perm_objs.append(p)
    limit = _max_days_for(actor, rule) if check_actor else 0
    if limit and (ends - starts) > timedelta(days=limit, hours=23, minutes=59, seconds=59):
        raise GrantError(f"A grant can last at most {limit} days.")
    appt = None
    if office is not None:
        person = getattr(user, "person_or_none", None)
        if person is None:
            raise GrantError("This user has no person record.")
        appt = appointing.appoint(actor=actor, person=person, office=office, profile_kind=profile_kind or None,
                                  scope_level=scope_level, scope_label=scope_label,
                                  start_date=timezone.localdate(starts), end_date=timezone.localdate(ends),
                                  is_acting=True, note=f"Grant: {reason}"[:255], check_actor=False)
        profile_kind = appt.profile_kind
    g = AccessGrant.objects.create(
        user=user, profile_kind=profile_kind or "", office=office, appointment=appt, scope_level=scope_level,
        scope_label=scope_label or "", reason=reason[:255], starts_at=starts, ends_at=ends,
        granted_by=actor if getattr(actor, "pk", None) else None, granted_via=rule,
        source_type=ContentType.objects.get_for_model(type(source)) if source is not None else None,
        source_id=str(source.pk) if source is not None else "",
        source_label=(source_label or (str(source) if source is not None else ""))[:160])
    if perm_objs:
        g.permissions.set(perm_objs)
    invalidate(user)
    _notify(user, g, actor)
    return g


def _notify(user, g, actor):
    try:
        from django.urls import reverse

        from notifications.services import notify
        notify(user, title=f"You have extra access until {timezone.localtime(g.ends_at):%d %b %Y}",
               body=f"{g.what}. Reason: {g.reason}", url=reverse("access:my_access"), category="account", actor=actor)
    except Exception:
        pass


def can_revoke(actor, g):
    if is_super_admin(actor) or actor.has_perm("accounts.grants_manage"):
        return True
    if g.granted_by_id and g.granted_by_id == getattr(actor, "pk", None):
        return True
    if g.office_id:
        return appointing.can_appoint(actor, g.office, scope_level=g.scope_level)
    return False


@transaction.atomic
def revoke(g, *, actor, reason="", check_actor=True):
    if g.revoked_at:
        return g
    if check_actor and not can_revoke(actor, g):
        raise appointing.DelegationError("You cannot revoke this grant.")
    g.revoked_at = timezone.now()
    g.revoked_by = actor if getattr(actor, "pk", None) else None
    g.revoke_reason = (reason or "")[:255]
    g.save(update_fields=["revoked_at", "revoked_by", "revoke_reason", "updated_at"])
    if g.appointment_id and g.appointment and g.appointment.is_current:
        appointing.end_appointment(actor=actor, appointment=g.appointment, reason=reason or "grant revoked",
                                   check_actor=False)
    elif g.appointment_id and g.appointment and g.appointment.start_date > timezone.localdate():
        g.appointment.delete()
    invalidate(g.user)
    return g


def close_for_source(source, *, reason="The work this access was for has closed", actor=None):
    """Revoke every running or upcoming grant given for `source` (e.g. a course offering, a case)."""
    from django.contrib.contenttypes.models import ContentType

    from .models import AccessGrant

    ct = ContentType.objects.get_for_model(type(source))
    n = 0
    for g in AccessGrant.objects.filter(source_type=ct, source_id=str(source.pk), revoked_at__isnull=True,
                                        ends_at__gt=timezone.now()):
        revoke(g, actor=actor, reason=reason, check_actor=False)
        n += 1
    return n


def active_for(user):
    from .models import AccessGrant
    now = timezone.now()
    return (AccessGrant.objects.filter(user=user, revoked_at__isnull=True, ends_at__gt=now)
            .select_related("office", "granted_by", "scope_level").prefetch_related("permissions"))
