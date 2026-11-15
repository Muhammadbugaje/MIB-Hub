"""Remove access-log entries older than Settings access.log_retention_days (append-only otherwise)."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Delete access-log entries past the retention period."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, dry_run=False, **opts):
        import config
        from accounts.models import AccessLogEntry
        days = int(config.get("access.log_retention_days", 730) or 0)
        if days <= 0:
            self.stdout.write("Retention is unlimited (0).")
            return
        qs = AccessLogEntry.objects.filter(at__lt=timezone.now() - timedelta(days=days))
        n = qs.count()
        if not dry_run:
            qs._raw_delete(qs.db)
        self.stdout.write(self.style.SUCCESS(f"{n} entr{'y' if n == 1 else 'ies'} {'would be ' if dry_run else ''}removed."))
