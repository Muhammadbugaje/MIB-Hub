#!/bin/sh
# usage: render_set.sh who  -> out/<who>_turn_*.png, _portrait, _outfitN
cd "$(dirname "$0")"; P=/Users/macbookair/Downloads/eehub-2/.venv/bin/python; w=$1; bg=${2:-efe3d6}
$P shoot.py "http://localhost:8851/studio.html?who=$w&o=0&w=600&h=1000&bg=$bg" 600 1000 out/${w}_turn 'full|{"rot":0}' 'full|{"rot":0.65}' 'full|{"rot":1.5708}' 'full|{"rot":3.1416}'
$P shoot.py "http://localhost:8851/studio.html?who=$w&o=0&w=900&h=1100&bg=$bg" 900 1100 out/${w}_portrait 'portrait|{"rot":0.25}' 'portrait|{"rot":0}'
for o in 0 1 2; do $P shoot.py "http://localhost:8851/studio.html?who=$w&o=$o&w=700&h=1000&bg=$bg" 700 1000 out/${w}_outfit$o 'full|{"rot":0.45}'; done
