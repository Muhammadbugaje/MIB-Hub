"""Round 7 (R7A) fixtures shared by accounts/tests/test_r7_*.py."""
import pytest
from django.core.management import call_command

PASSWORD = "EEHub@2026"


@pytest.fixture
def r7(db):
    """seed_config + seed_access + seed_department + seed_demo, plus a few extra fictional people."""
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)
    return R7World()


class R7World:
    """Helpers to make people and appointments quickly (all fictional)."""

    def user(self, email):
        from accounts.models import User
        return User.objects.select_related("person").get(email=email)

    def level(self, number, programme="beng-ee"):
        from department.models import Level
        return Level.objects.get(programme__code=programme, number=number)

    def office(self, code):
        from accounts.models import Office
        return Office.objects.get(code=code)

    def make(self, email, kind, level=None, status="active", first="Test", last="Person"):
        from accounts.models import Person, User
        from department.models import Programme
        from people.models import AlumniProfile, LecturerProfile, StaffProfile, StudentProfile

        n = User.objects.count() + 1
        u = User.objects.create_user(email=email, password=PASSWORD)
        p = Person.objects.create(user=u, first_name=first, last_name=f"{last}{n}")
        if kind == "student":
            prog = Programme.objects.get(code="beng-ee")
            StudentProfile.objects.create(person=p, reg_number=f"U23EE9{n:03d}", programme=prog,
                                          level=self.level(level or 300), status=status)
        elif kind == "lecturer":
            LecturerProfile.objects.create(person=p, staff_number=f"SP9{n:03d}")
        elif kind == "staff":
            StaffProfile.objects.create(person=p, staff_number=f"SS9{n:03d}")
        elif kind == "alumni":
            AlumniProfile.objects.create(person=p, programme_name="B.Eng", graduation_year=2020, is_verified=True)
        return u

    def appoint(self, user, code, kind, level=None):
        from accounts import appointing
        return appointing.appoint(actor=None, person=user.person, office=self.office(code), profile_kind=kind,
                                  scope_level=level, check_actor=False)

    def login(self, client, user, kind=None):
        from accounts.access import SESSION_KEY, available_profiles
        client.force_login(user)
        if kind:
            ref = next(r for r in available_profiles(user) if r.kind == kind)
            s = client.session
            s[SESSION_KEY] = ref.key
            s.save()
        return client
