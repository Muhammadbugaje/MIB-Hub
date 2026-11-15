"""Round 6: My profile -> My signature (upload + check + accept, draw on the
pad, remove). One store shared with results (results.OfficerSignature)."""
import base64
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.urls import reverse
from PIL import Image, ImageDraw

from accounts.models import User
from results.models import OfficerSignature

pytestmark = pytest.mark.django_db


@pytest.fixture
def seeded(db):
    for cmd in ("seed_config", "seed_access", "seed_department", "seed_demo"):
        call_command(cmd, verbosity=0)


def _drawing(empty=False):
    img = Image.new("RGBA", (600, 200), (0, 0, 0, 0))
    if not empty:
        d = ImageDraw.Draw(img)
        d.line([(40, 140), (120, 60), (200, 150), (300, 70), (420, 140), (540, 90)], fill=(20, 33, 74, 255), width=5)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def test_profile_shows_signature_section(seeded, client):
    client.force_login(User.objects.get(email="lecturer@demo.eehub"))
    html = client.get(reverse("accounts:profile")).content.decode()
    assert 'id="signature"' in html and "Upload a photo" in html and "data-sig-pad" in html


def test_upload_check_adjust_accept_and_shared_with_results(seeded, client):
    from results.signature import demo_photo, png_for
    user = User.objects.get(email="lecturer@demo.eehub")
    client.force_login(user)
    url = reverse("accounts:profile")
    r = client.post(url, {"section": "sig_upload", "sensitivity": "50", "ink": "navy",
                          "sig_photo": SimpleUploadedFile("sig.jpg", demo_photo(), "image/jpeg")})
    assert r.status_code == 302 and r["Location"].endswith("#signature")
    pending = OfficerSignature.objects.get(person=user.person)
    assert not pending.is_active and pending.source
    html = client.get(url).content.decode()
    assert "Check your signature" in html and reverse("results:signature_image", args=[pending.pk]) in html
    client.post(url, {"section": "sig_adjust", "sensitivity": "70", "ink": "blue"})
    pending.refresh_from_db()
    assert pending.sensitivity == 70 and pending.ink == "blue"
    client.post(url, {"section": "sig_accept"})
    pending.refresh_from_db()
    assert pending.is_active and pending.accepted_at and not pending.source
    assert png_for(user.person)[:8] == b"\x89PNG\r\n\x1a\n"
    # the results app sees the same signature (seal check uses active_signature)
    from results.services import active_signature
    assert active_signature(user.person) == pending
    # the owner can preview it; another user cannot
    assert client.get(reverse("results:signature_image", args=[pending.pk])).status_code == 200
    client.force_login(User.objects.get(email="student@demo.eehub"))
    assert client.get(reverse("results:signature_image", args=[pending.pk])).status_code == 403


def test_draw_replace_and_remove(seeded, client):
    user = User.objects.get(email="student@demo.eehub")
    client.force_login(user)
    url = reverse("accounts:profile")
    client.post(url, {"section": "sig_draw", "ink": "black", "sig_data": _drawing()})
    first = OfficerSignature.objects.get(person=user.person, is_active=True)
    img = Image.open(first.image.open("rb"))
    assert img.mode == "RGBA" and img.getpixel((0, 0))[3] == 0 and first.ink == "black"
    # drawing again replaces it; the old one is kept for documents already signed
    client.post(url, {"section": "sig_draw", "ink": "navy", "sig_data": _drawing()})
    assert OfficerSignature.objects.filter(person=user.person, is_active=True).count() == 1
    first.refresh_from_db()
    assert not first.is_active and first.retired_at
    # an empty pad is refused
    r = client.post(url, {"section": "sig_draw", "sig_data": _drawing(empty=True)}, follow=True)
    assert "pad is empty" in r.content.decode()
    client.post(url, {"section": "sig_remove"})
    assert not OfficerSignature.objects.filter(person=user.person, is_active=True).exists()


def test_signature_at_a_date_uses_the_one_then_active(seeded):
    import datetime

    from django.utils import timezone

    from results import signature as SIG
    user = User.objects.get(email="hod@demo.eehub")
    old = SIG.save_drawn(user.person, _drawing(), user)
    OfficerSignature.objects.filter(pk=old.pk).update(accepted_at=timezone.now() - datetime.timedelta(days=10))
    new = SIG.save_drawn(user.person, _drawing(), user, ink="blue")
    assert SIG.png_for(user.person, timezone.now() - datetime.timedelta(days=5)) == old.image.open("rb").read()
    assert SIG.png_for(user.person) == new.image.open("rb").read()


def test_demo_signature_is_generated_not_traced():
    from results.signature import demo_signature_png
    a, info = demo_signature_png("one")
    b, _ = demo_signature_png("two")
    assert a != b and info["width"] > 100
    assert Image.open(io.BytesIO(a)).mode == "RGBA"
