#!/bin/sh
# One command after recording: refresh the script and the hand-out PDFs, cut every file in voice_in/, write the review page.
# First run creates a private Python environment in tools/voice/.venv with numpy and a bundled ffmpeg (needs internet once).
set -e
cd "$(dirname "$0")/../.."
V=tools/voice/.venv
if [ ! -x "$V/bin/python" ]; then python3 -m venv "$V" && "$V/bin/pip" -q install numpy imageio-ffmpeg; fi
NODE="$(command -v node || ls "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | tail -1 || true)"
if [ -n "$NODE" ]; then "$NODE" tools/voice/make_script.js >/dev/null; fi
mkdir -p voice_in
if [ -x .venv/bin/python ]; then .venv/bin/python tools/voice/make_pdfs.py >/dev/null 2>&1 || echo "(PDF hand-outs not rebuilt: reportlab missing from .venv)"; fi
"$V/bin/python" tools/voice/cut.py --review "$@"
