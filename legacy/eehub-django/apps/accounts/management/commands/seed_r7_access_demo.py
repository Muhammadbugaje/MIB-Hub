"""Round 7 access demo (R7A): time-boxed grants, a delegated tutor appointment and a few
access-log entries, all fictional and DemoTag-tagged.

    manage.py seed_r7_access_demo            # create what is missing (idempotent)
    manage.py seed_r7_access_demo --remove   # delete exactly what this command made

Needs seed_access, seed_demo and seed_rich_activity first (it uses their demo people).
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import DemoTag

MARK = "[demo r7a]"


def _user(email):
    from accounts.models import User
    return User.objects.filter(email=email).select_related("person").first()


class Command(BaseCommand):
    help = "Fictional demo data for access grants, delegation and the access log (round 7)."

    def add_arguments(self, parser):
        parser.add_argument("--remove", action="store_true")

    def handle(self, *args, remove=False, **opts):
        if remove:
            return self.remove()
        with transaction.atomic():
            made = self.grants() + self.log()
        self.stdout.write(self.style.SUCCESS(f"R7 access demo ready ({made} new rows)."))

    # ------------------------------------------------------------------
    def grants(self):
        from accounts import appointing
        from accounts import grants as G
        from accounts.models import AccessGrant, Office
        from people.models import StudentProfile

        now = timezone.now()
        hod = _user("hod@demo.eehub")
        made = 0

        def exists(reason):
            return AccessGrant.objects.filter(reason__startswith=reason).exists()

        rows = [
            ("f.odeh@demo.eehub", ["accounts.results_view_all"], None,
             "Checking 400 level result sheets before the Senate meeting", 0, 14),
            ("t.aluko@demo.eehub", ["accounts.feedback_run", "accounts.memo_circular"], None,
             "Running the first-semester teaching survey for the department", -2, 21),
            ("r.sambo@demo.eehub", [], "exam-officer",
             "Acting Exam Officer while Dr. Tukur attends a conference", 0, 10),
        ]
        for email, perms, office_code, reason, start_days, days in rows:
            u = _user(email)
            if u is None or hod is None or exists(reason):
                continue
            office = Office.objects.filter(code=office_code).first() if office_code else None
            try:
                g = G.give(actor=hod, user=u, reason=reason, permissions=perms, office=office,
                           start=now + timedelta(days=start_days) if start_days else None,
                           until=(now + timedelta(days=days)).date(), check_actor=False)
            except (G.GrantError, appointing.EligibilityError) as exc:
                self.stderr.write(f"skipped grant for {email}: {exc}")
                continue
            DemoTag.tag(g)
            if g.appointment_id:
                DemoTag.tag(g.appointment)
            made += 1
        # History: one ended, one revoked.
        u = _user("timetable@demo.eehub")
        if u is not None and hod is not None and not exists("Exam timetable clash check"):
            g = AccessGrant.objects.create(user=u, reason="Exam timetable clash check for 300 level",
                                           starts_at=now - timedelta(days=40), ends_at=now - timedelta(days=26),
                                           granted_by=hod)
            g.permissions.set(list(_perms(["accounts.directory_view"])))
            DemoTag.tag(g)
            made += 1
        u = _user("secretary@demo.eehub")
        if u is not None and hod is not None and not exists("Publish the open-day news"):
            g = AccessGrant.objects.create(user=u, reason="Publish the open-day news while the webmaster is away",
                                           starts_at=now - timedelta(days=9), ends_at=now + timedelta(days=5),
                                           granted_by=hod, revoked_at=now - timedelta(days=2), revoked_by=hod,
                                           revoke_reason="The webmaster is back")
            g.permissions.set(list(_perms(["accounts.content_news"])))
            DemoTag.tag(g)
            made += 1
        # Delegation in action: the 400L class rep makes a classmate a tutor for the semester.
        rep = _user("classrep@demo.eehub")
        if rep is not None:
            rep._ee_active_kind = "student"
            appt = next((a for r, a in appointing.delegation_rules_for(rep) if a.office.code == "class-rep"), None)
            level = appt.scope_level if appt else None
            if level is not None and not exists("Tutorials for the 400 level class"):
                mate = (StudentProfile.objects.filter(level=level, status="active", is_deleted=False,
                                                      person__user__isnull=False)
                        .exclude(person=rep.person).exclude(person__appointments__office__code="class-tutor")
                        .select_related("person__user").order_by("reg_number").first())
                tutor = Office.objects.filter(code="class-tutor").first()
                if mate is not None and tutor is not None:
                    try:
                        g = G.give(actor=rep, user=mate.person.user, office=tutor, scope_level=level,
                                   reason="Tutorials for the 400 level class (power systems)",
                                   until=(now + timedelta(days=90)).date())
                    except (G.GrantError, appointing.EligibilityError, appointing.DelegationError) as exc:
                        self.stderr.write(f"skipped tutor grant: {exc}")
                    else:
                        DemoTag.tag(g)
                        DemoTag.tag(g.appointment)
                        made += 1
        return made

    def log(self):
        from accounts.models import AccessLogEntry, User
        if AccessLogEntry.objects.filter(note__startswith=MARK).exists():
            return 0
        now = timezone.now()
        rows = [("hod@demo.eehub", "lecturer", "staff_contact", "f.odeh@demo.eehub", "Staff record", 3),
                ("exams@demo.eehub", "lecturer", "results", "classrep@demo.eehub", "Result statement, 2025/2026", 20),
                ("registration@demo.eehub", "staff", "course_form", "student@demo.eehub", "Course form, first semester", 50),
                ("hod@demo.eehub", "lecturer", "student_contact", "classrep@demo.eehub", "Class list with contacts: B.Eng 400L", 120),
                ("hod@demo.eehub", "lecturer", "welfare", "student@demo.eehub", "Welfare case", 300)]
        n = 0
        for viewer, kind, what, subject, label, minutes in rows:
            v, s = User.objects.filter(email=viewer).first(), User.objects.filter(email=subject).first()
            if v is None or s is None:
                continue
            e = AccessLogEntry.objects.create(at=now - timedelta(minutes=minutes), user=v, user_repr=v.get_full_name(),
                                              profile_kind=kind, kind=what, object_repr=label,
                                              subject=s.person_or_none, path="/", note=f"{MARK} {label}")
            DemoTag.tag(e)
            n += 1
        return n

    # ------------------------------------------------------------------
    @transaction.atomic
    def remove(self):
        from django.contrib.contenttypes.models import ContentType

        from accounts.models import AccessGrant, AccessLogEntry, Appointment

        n = 0
        ct = ContentType.objects.get_for_model(AccessGrant)
        ids = list(DemoTag.objects.filter(content_type=ct).values_list("object_id", flat=True))
        qs = AccessGrant.objects.filter(pk__in=ids)
        appt_ids = list(qs.exclude(appointment__isnull=True).values_list("appointment_id", flat=True))
        n += qs.count()
        qs.delete()
        for a in Appointment.all_objects.filter(pk__in=appt_ids):
            a.hard_delete()
        DemoTag.objects.filter(content_type=ct, object_id__in=ids).delete()
        DemoTag.objects.filter(content_type=ContentType.objects.get_for_model(Appointment),
                               object_id__in=[str(i) for i in appt_ids]).delete()
        # Acting appointments this command made whose grant is already gone.
        act = ContentType.objects.get_for_model(Appointment)
        left = list(DemoTag.objects.filter(content_type=act).values_list("object_id", flat=True))
        for a in Appointment.all_objects.filter(pk__in=left, note__startswith="Grant:"):
            a.hard_delete()
            DemoTag.objects.filter(content_type=act, object_id=str(a.pk)).delete()
        ct = ContentType.objects.get_for_model(AccessLogEntry)
        ids = list(DemoTag.objects.filter(content_type=ct).values_list("object_id", flat=True))
        n += AccessLogEntry.objects.filter(pk__in=ids, note__startswith=MARK).count()
        AccessLogEntry.objects.filter(pk__in=ids, note__startswith=MARK)._raw_delete(AccessLogEntry.objects.db)
        DemoTag.objects.filter(content_type=ct, object_id__in=ids).delete()
        self.stdout.write(self.style.SUCCESS(f"Removed {n} R7 access demo rows."))


def _perms(labels):
    from django.contrib.auth.models import Permission
    for label in labels:
        app, code = label.split(".", 1)
        p = Permission.objects.filter(content_type__app_label=app, codename=code).first()
        if p is not None:
            yield p
