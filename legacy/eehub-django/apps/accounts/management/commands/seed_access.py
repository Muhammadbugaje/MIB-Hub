from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand

from accounts.catalogue import DELEGATIONS, ELIGIBILITY, EXTRA_OFFICE_PERMS, OFFICES, PROFILE_ROLES
from accounts.models import DelegationRule, Office, ProfileRole


def perms(labels):
    out = []
    for label in labels:
        app, code = label.split(".", 1)
        p = Permission.objects.filter(content_type__app_label=app, codename=code).first()
        if p is None:
            raise SystemExit(f"Unknown permission {label}. Run migrate first.")
        out.append(p)
    return out


def ensure_delegations(sync=False):
    """Create the shipped delegation rules for grantor offices that have none (all of them with --sync)."""
    made = 0
    for (grantor, offices, cats, excepts, plist, any_held, scope, max_days, note) in DELEGATIONS:
        g = Office.objects.filter(code=grantor).first()
        if g is None:
            continue
        rule = DelegationRule.objects.filter(grantor_office=g).order_by("pk").first()
        if rule is not None and not sync:
            continue
        if rule is None:
            rule = DelegationRule(grantor_office=g)
            made += 1
        rule.office_categories, rule.any_held_permission = list(cats), any_held
        rule.scope_rule, rule.max_days, rule.note, rule.is_active = scope, max_days, note, True
        rule.save()
        rule.offices.set(list(Office.objects.filter(code__in=offices)))
        rule.except_offices.set(list(Office.objects.filter(code__in=excepts)))
        rule.permissions.set(perms(plist))
    return made


class Command(BaseCommand):
    help = ("Create profile roles, the default offices and office templates, who may hold each office and the "
            "delegation rules (never removes admin changes unless --sync).")

    def add_arguments(self, parser):
        parser.add_argument("--sync", action="store_true", help="Reset shipped offices' permissions and widgets to defaults.")

    def handle(self, *args, **opts):
        for kind, (name, desc, plist, widgets) in PROFILE_ROLES.items():
            role, created = ProfileRole.objects.get_or_create(kind=kind, defaults={"name": name, "description": desc,
                                                                                 "dashboard_widgets": widgets})
            if created or opts["sync"]:
                role.permissions.set(perms(plist))
                if opts["sync"]:
                    role.dashboard_widgets = widgets
                    role.save()
        n_new = 0
        for (code, name, short, cat, kind, scope, rank, icon, color, plist, widgets, desc, is_template) in OFFICES:
            kinds, level_match = ELIGIBILITY.get(code, ([] if kind == "any" else [kind], False))
            office, created = Office.objects.get_or_create(code=code, defaults=dict(
                name=name, short_name=short, category=cat, profile_kind=kind, scope_kind=scope, rank=rank, icon=icon,
                color=color, dashboard_widgets=widgets, description=desc, is_template=is_template, is_system=True,
                allowed_profile_kinds=list(kinds), level_must_match=level_match))
            if created or opts["sync"]:
                office.permissions.set(perms(plist + EXTRA_OFFICE_PERMS.get(code, [])))
                if opts["sync"] and not created:
                    office.dashboard_widgets = widgets
                    office.allowed_profile_kinds = list(kinds)
                    office.level_must_match = level_match
                    office.save()
            elif not office.allowed_profile_kinds and kinds:
                office.allowed_profile_kinds = list(kinds)
                office.level_must_match = level_match
                office.save(update_fields=["allowed_profile_kinds", "level_must_match", "updated_at"])
            n_new += int(created)
        n_rules = ensure_delegations(sync=opts["sync"])
        self.stdout.write(self.style.SUCCESS(f"Access ready: {ProfileRole.objects.count()} profile roles, "
                                             f"{Office.objects.count()} offices ({n_new} new), "
                                             f"{DelegationRule.objects.count()} delegation rules ({n_rules} new)."))
