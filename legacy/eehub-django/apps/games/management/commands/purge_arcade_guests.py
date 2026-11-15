"""Delete expired guest players (and, by cascade, their arcade profile and scores). Run yearly or from cron."""
from django.core.management.base import BaseCommand
from django.utils import timezone

from games.models import GuestPlayer


class Command(BaseCommand):
    help = "Delete arcade guest players whose expiry date has passed."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Delete every guest player now (start of a new year).")

    def handle(self, *args, **opts):
        qs = GuestPlayer.objects.all() if opts["all"] else GuestPlayer.objects.filter(expires_at__lte=timezone.now())
        n = qs.count()
        qs.delete()
        self.stdout.write(f"Deleted {n} guest player(s).")
