"""Round 7 (A1, A3, A4, A14, F5): fill the new access data on an existing database.

* who may hold each shipped office (only where nobody has chosen yet);
* the five new capabilities, added (never removed) to the shipped offices that need them;
* the shipped delegation rules, for grantor offices that have none yet.

A fresh install has no offices at this point; `seed_access` does the same work when it
creates them. Additive only: nothing an administrator chose is changed.
"""
from django.db import migrations

NEW_CAPS = [
    ("grants_manage", "Give and revoke time-boxed access grants"),
    ("access_log_view", "See who viewed restricted personal data (access log)"),
    ("classes_view", "See class lists, class reps and tutors"),
    ("class_broadcast", "Send an announcement to a whole class or a course's students"),
    ("student_contacts_view", "See students' phone numbers and personal e-mails"),
]


def forwards(apps, schema_editor):
    from accounts.catalogue import DELEGATIONS, ELIGIBILITY, EXTRA_OFFICE_PERMS

    Office = apps.get_model("accounts", "Office")
    DelegationRule = apps.get_model("accounts", "DelegationRule")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")

    ct, _ = ContentType.objects.get_or_create(app_label="accounts", model="capability")
    for code, name in NEW_CAPS:
        Permission.objects.get_or_create(content_type=ct, codename=code, defaults={"name": name})

    def perm(label):
        app, code = label.split(".", 1)
        return Permission.objects.filter(content_type__app_label=app, codename=code).first()

    for code, (kinds, level_match) in ELIGIBILITY.items():
        office = Office.objects.filter(code=code).first()
        if office is None or office.allowed_profile_kinds:
            continue
        office.allowed_profile_kinds = list(kinds)
        office.level_must_match = level_match
        office.save(update_fields=["allowed_profile_kinds", "level_must_match"])
    # Custom offices: write down what they had implicitly ('any' = every kind).
    for office in Office.objects.filter(allowed_profile_kinds=[]):
        office.allowed_profile_kinds = (["student", "lecturer", "staff", "alumni"] if office.profile_kind == "any"
                                        else [office.profile_kind])
        office.save(update_fields=["allowed_profile_kinds"])

    for code, labels in EXTRA_OFFICE_PERMS.items():
        office = Office.objects.filter(code=code).first()
        if office is None:
            continue
        for label in labels:
            p = perm(label)
            if p is not None:
                office.permissions.add(p)

    # F5: the Course Allocation Officer's dashboard shows the classes widget.
    alloc = Office.objects.filter(code="course-allocation-officer").first()
    if alloc is not None and "class_lists" not in (alloc.dashboard_widgets or []):
        alloc.dashboard_widgets = (alloc.dashboard_widgets or [])[:1] + ["class_lists"] + (alloc.dashboard_widgets or [])[1:]
        alloc.save(update_fields=["dashboard_widgets"])

    for (grantor, offices, cats, excepts, perms, any_held, scope, max_days, note) in DELEGATIONS:
        g = Office.objects.filter(code=grantor).first()
        if g is None or DelegationRule.objects.filter(grantor_office=g).exists():
            continue
        rule = DelegationRule.objects.create(grantor_office=g, office_categories=list(cats), any_held_permission=any_held,
                                             scope_rule=scope, max_days=max_days, note=note)
        rule.offices.set(list(Office.objects.filter(code__in=offices)))
        rule.except_offices.set(list(Office.objects.filter(code__in=excepts)))
        rule.permissions.set([p for p in (perm(l) for l in perms) if p is not None])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_r7_access_engine"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
