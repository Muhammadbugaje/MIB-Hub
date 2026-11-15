"""R6I: the Reset password button only shows when the reset page will open."""
import pytest
from django.core.management import call_command
from django.urls import reverse

from accounts.models import User


@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


def test_reset_button_hidden_for_superuser_targets(seeded, client):
    hod = User.objects.get(email="hod@demo.eehub")
    if not hod.has_perm("accounts.users_reset_password"):
        pytest.skip("HOD has no reset capability in this seed")
    admin = User.objects.filter(is_superuser=True).first()
    other = User.objects.get(email="student@demo.eehub")
    client.force_login(hod)
    for target, ok in ((admin, False), (other, True)):
        url = reverse("access:user_reset_password", args=[target.pk])
        page = client.get(reverse("access:user_detail", args=[target.pk]))
        assert page.status_code == 200
        assert (url.encode() in page.content) is ok
        assert client.get(url).status_code == (200 if ok else 403)
