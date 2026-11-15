"""Round 7 (R7A) sidebar entries: my access, grants, delegation, review, access log,
classes and broadcast, module switches. Imported from AccountsConfig.ready()."""
from core import nav
from core.nav import Item


def _can_grant(user, kind):
    from . import grants
    return grants.can_manage_grants(user)


nav.add("me", Item("My access", "access:my_access", icon="shield-check", match=("access:my_access", "access:how")))
nav.add("access",
        Item("Appointments to review", "access:review_appointments", icon="user-x",
             perm=("accounts.offices_manage", "accounts.offices_appoint"), match=("access:review*",)),
        Item("Access grants", "access:grants", icon="timer", check=_can_grant, match=("access:grant*",)),
        Item("Delegation", "access:delegation", icon="git-fork", perm=("accounts.matrix_edit", "accounts.offices_manage"),
             match=("access:delegation*",)),
        Item("Access log", "access:access_log", icon="eye", perm="accounts.access_log_view"))
nav.add("academics",
        Item("Classes, reps and tutors", "access:classes", icon="school", perm="accounts.classes_view",
             match=("access:class*", "access:broadcast")))
nav.add("system", Item("Modules and features", "config:features", icon="toggle-right",
                       perm=("accounts.settings_edit", "config.change_configentry"), match=("config:feature*",)))
nav.ALWAYS_VISIBLE.update({"access:how", "access:my_access"})
