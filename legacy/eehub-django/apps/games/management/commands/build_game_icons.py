from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Draw the home-screen icons for every arcade game into static/img/games/ (games/icons.py)."

    def handle(self, *args, **opts):
        from games.icons import build
        files = build()
        self.stdout.write(self.style.SUCCESS("%d icons written to static/img/games/" % len(files)))
