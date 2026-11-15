"""Tell holders and grantors that a time-boxed grant ends soon (Settings access.grant_expiry_notice_days).
Run daily (the scheduler or cron). Each grant is announced once (marked in the audit log)."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.urls import reverse
from django.utils import timezone


class Command(BaseCommand):
    help = "Notify people whose access grants end within the notice period."

    def handle(self, *args, **opts):
        import config
        from accounts.models import AccessGrant
        from core import audit
        from core.models import AuditLogEntry
        from notifications.services import notify

        days = int(config.get("access.grant_expiry_notice_days", 3) or 0)
        if days <= 0:
            self.stdout.write("Expiry notices are switched off.")
            return
        now = timezone.now()
        n = 0
        for g in (AccessGrant.objects.filter(revoked_at__isnull=True, starts_at__lte=now, ends_at__gt=now,
                                             ends_at__lte=now + timedelta(days=days))
                  .select_related("user", "granted_by", "office").prefetch_related("permissions")):
            if AuditLogEntry.objects.filter(model_label="accounts.AccessGrant", object_pk=str(g.pk),
                                            note="expiry notice sent").exists():
                continue
            when = timezone.localtime(g.ends_at).strftime("%d %b %Y")
            notify(g.user, title=f"Your extra access ends on {when}", body=f"{g.what}. Reason: {g.reason}",
                   url=reverse("access:my_access"), category="account", level="warning")
            if g.granted_by_id and g.granted_by_id != g.user_id:
                notify(g.granted_by, title=f"Access you gave ends on {when}",
                       body=f"{g.user.get_full_name()}: {g.what}", url=reverse("access:grants"), category="account")
            audit.log("other", g, note="expiry notice sent")
            n += 1
        self.stdout.write(self.style.SUCCESS(f"{n} expiry notice(s) sent."))
