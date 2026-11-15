"""A2: one resolver. Permission checks go through user.has_perm() (accounts.access);
code asks "is this the super admin?" through accounts.access.is_super_admin().

This test scans the code for raw permission bypasses — reading `.is_superuser`, `.groups`
or `user_permissions` directly — and:
* FAILS for the access engine's own files (accounts/, core/features.py, config/features.py);
* FAILS for every other app too (round 7, R7K). PENDING_R7G below can hold apps still being
  switched over (reported, not failed); it is empty.
A line may carry `# resolver-ok: <why>` when it is about the TARGET user, not the actor
(e.g. "a non-superuser may not reset a superuser's password").
"""
import re
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATTERN = re.compile(r"\.is_superuser\b(?!\s*=)|\.groups\.|\bgroups__|\.user_permissions\b")
SKIP_PARTS = {".venv", "migrations", "tests", "management", "node_modules", "static", "templates", "templates_nbte",
              "media", "protected_media", "backups"}
SKIP_FILES = {"conftest.py"}
# The resolver itself and Django's own user/admin plumbing may read the flags.
ALLOWED = {"accounts/access.py", "accounts/models.py", "accounts/admin.py", "accounts/backends.py"}
OWNED_PREFIXES = ("accounts/", "core/features.py", "config/features.py", "core/templatetags/feature_tags.py")


def scan():
    hits = []
    for path in ROOT.rglob("*.py"):
        rel = path.relative_to(ROOT).as_posix()
        parts = set(rel.split("/")[:-1])
        if parts & SKIP_PARTS or path.name in SKIP_FILES or rel.startswith(("eehub/settings", "docs/")):
            continue
        if rel in ALLOWED:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for n, line in enumerate(text.splitlines(), 1):
            code = line.split("#", 1)[0]
            if PATTERN.search(code) and "resolver-ok" not in line:
                hits.append((rel, n, line.strip()))
    return hits


def test_access_engine_files_have_no_raw_permission_checks():
    own = [h for h in scan() if h[0].startswith(OWNED_PREFIXES)]
    assert not own, "Raw permission checks in access-engine files:\n" + "\n".join(f"{f}:{n}: {l}" for f, n, l in own)


# Apps still being switched over by their builder: reported, not failed. Empty since R7K
# switched messaging and classroom too (5 Nov 2026); keep it empty.
PENDING_R7G = ()


def test_no_raw_permission_checks_outside_the_resolver(capsys):
    """Every other app asks the resolver. Justified exceptions carry `# resolver-ok: <why>`."""
    hits = [h for h in scan() if not h[0].startswith(OWNED_PREFIXES)]
    pending = [h for h in hits if PENDING_R7G and h[0].startswith(PENDING_R7G)]
    others = [h for h in hits if not (PENDING_R7G and h[0].startswith(PENDING_R7G))]
    if pending:
        by_file = {}
        for f, n, l in pending:
            by_file.setdefault(f, []).append(n)
        report = "\n".join(f"  {f}: lines {', '.join(map(str, ns))}" for f, ns in sorted(by_file.items()))
        print(f"\nA2 report: {len(pending)} raw permission check(s) still pending in R7G's apps:\n{report}")
        warnings.warn(f"{len(pending)} raw permission checks pending in messaging/classroom", stacklevel=1)
    assert not others, ("Raw permission checks outside the access engine — use user.has_perm() or "
                        "accounts.access.is_super_admin() (or mark `# resolver-ok: <why>`):\n"
                        + "\n".join(f"{f}:{n}: {l}" for f, n, l in others))


def test_is_super_admin_and_backend_agree(db):
    from accounts.access import is_super_admin
    from accounts.models import User
    su = User.objects.create_superuser(email="su@demo.eehub", password="x")
    u = User.objects.create_user(email="plain@demo.eehub", password="x")
    assert is_super_admin(su) and not is_super_admin(u)
    su.is_active = False
    assert not is_super_admin(su)
    assert u.has_perm("accounts.users_manage") is False
