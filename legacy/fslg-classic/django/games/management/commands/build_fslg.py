from django.core.management.base import BaseCommand

from games import bundle


class Command(BaseCommand):
    help = "Join the Freshers School Life scripts into static/js/games/fslg.bundle.js for production."

    def handle(self, *args, **options):
        r = bundle.build()
        self.stdout.write("%(files)d files, %(raw)d bytes raw (%(gzip_separate)d gzip as separate files) -> bundle %(bundle)d bytes (%(bundle_gzip)d gzip)" % r)
