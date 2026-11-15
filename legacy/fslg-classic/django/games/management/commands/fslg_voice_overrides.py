"""Write docs/voice/line_overrides.json: every line the super admin edited in Arcade Management → FSLG Characters, so
tools/voice/make_script.js puts the new words in the recording script, marked NEEDS RE-RECORD.

    python manage.py fslg_voice_overrides && node tools/voice/make_script.js
"""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from games import fslg_admin


class Command(BaseCommand):
    help = "Export the FSLG lines edited by the super admin for the voice script (needs re-record)."

    def add_arguments(self, parser):
        parser.add_argument("--out", default=str(Path(settings.BASE_DIR) / "docs" / "voice" / "line_overrides.json"))

    def handle(self, *args, **opts):
        lines = {}
        for who, data in sorted(fslg_admin.characters().items()):
            role = (data.get("voice") or {}).get("role", "")
            for key, ln in sorted((data.get("lines") or {}).items()):
                lines[key] = {"t": ln.get("t", ""), "o": ln.get("o", ""), "speaker": who, "role": role, "where": ln.get("g", "")}
        out = Path(opts["out"])
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"note": "Written by manage.py fslg_voice_overrides. Do not edit by hand.", "lines": lines}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        self.stdout.write(f"{len(lines)} edited line(s) written to {out}")
