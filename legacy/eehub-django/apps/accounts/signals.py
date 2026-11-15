from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver

from .models import Office, ProfileRole


@receiver(m2m_changed, sender=Office.permissions.through)
@receiver(m2m_changed, sender=ProfileRole.permissions.through)
def _perms_changed(sender, instance, action, **kwargs):
    if action in ("post_add", "post_remove", "post_clear"):
        from core import audit
        try:
            pks = list(kwargs.get("pk_set") or [])
            audit.log("update", instance, changes={"permissions": {"action": action, "permission_ids": pks}},
                      note="permission matrix changed")
        except Exception:
            pass
