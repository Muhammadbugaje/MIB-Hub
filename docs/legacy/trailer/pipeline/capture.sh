#!/bin/sh
# Freeze a copy of the game, capture every moving shot, then:  $WORK/venv/bin/python build.py
# usage: sh capture.sh [shot,names]     (WORK defaults to /tmp/fslg-trailer; set FSLG_WORK to change)
PIPE=$(cd "$(dirname "$0")" && pwd); P=$(cd "$PIPE/../../.." && pwd); WORK=${FSLG_WORK:-/tmp/fslg-trailer}; export FSLG_WORK=$WORK
mkdir -p "$WORK"; F="$WORK/frozen"
if [ -z "$KEEP" ] && { [ ! -d "$F" ] || [ -z "$1" ]; }; then rm -rf "$F"; mkdir -p "$F/js" "$F/vendor" "$F/css"; cp -R "$P/static/js/games" "$F/js/"; mkdir -p "$F/audio"; cp -R "$P/static/audio/"* "$F/audio/" 2>/dev/null; cp -R "$P/static/vendor/three@0.158.0" "$F/vendor/"; cp "$P/static/css/games.css" "$F/css/"
  sed -i '' 's/renderer.toneMappingExposure = 1.08;/renderer.toneMappingExposure = 1.08; R.renderer = renderer;/' "$F/js/games/samaru-3d.js"; fi
cp "$PIPE/helpers.js" "$F/"
DEPS=$(grep -o '"deps": \[[^]]*\]' "$P/games/catalogue.py" | grep fslg | tr -d '",[]' | sed 's/deps: //')
{ cat <<EOT
<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/games.css"><style>html,body{margin:0;background:#000;overflow:hidden}.gm-page{padding:0!important;margin:0!important;max-width:none!important}.gm-stage{width:1920px!important;height:1080px!important;max-height:none!important;max-width:none!important;aspect-ratio:auto!important;border-radius:0!important;margin:0!important}[data-gm-pause],[data-gm-settings],[data-gm-full],[data-gm-mute],[data-gm-vol],[data-gm-concept],[data-gm-controls]{display:none}</style></head><body>
<div class="gm-page gm-play" style="--gm-a:#f59e0b"><button data-gm-pause><span>Pause</span></button><button data-gm-settings><span>S</span></button><button data-gm-full><span>F</span></button><button data-gm-mute><span>M</span></button><input type="range" data-gm-vol>
<div class="gm-stage" data-gm-stage data-gm-slug="samaru-days" data-gm-three="vendor/three@0.158.0/build/three.module.min.js"><canvas class="gm-canvas" data-gm-canvas tabindex="0"></canvas><div class="gm-hud" data-gm-hud></div><div class="gm-overlay" data-gm-overlay hidden></div><div class="gm-touch" data-gm-touch></div></div>
<div data-gm-concept></div><div data-gm-controls></div></div>
<script>window.onerror=function(m,s,l,c,e){(window.__err=window.__err||[]).push(m+" @"+String(s).split("/").pop()+":"+l+":"+c);};</script>
EOT
for f in arcade $(echo $DEPS) samaru; do echo "<script src=\"js/games/$f.js\"></script>"; done; echo "<script src=\"helpers.js?v=$(date +%s)\"></script></body></html>"; } > "$F/t.html"
pkill -f "http.server 8779"; (cd "$F" && python3 -m http.server 8779 >/dev/null 2>&1 &); sleep 1
"$P/.venv/bin/python" "$PIPE/cap.py" "$PIPE/${SHOTS:-shots.json}" $1; pkill -f "http.server 8779"
