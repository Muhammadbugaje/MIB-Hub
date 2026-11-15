#!/bin/sh
cd "$(dirname "$0")"; P=/Users/macbookair/Downloads/eehub-2/.venv/bin/python
avail=$(df -m /System/Volumes/Data | tail -1 | awk '{print $4}'); echo "free MB $avail"; [ "$avail" -lt 300 ] && { echo LOWDISK; exit 1; }
for w in jiya:efe3d6 taty:e6e1ea; do n=${w%%:*}; b=${w##*:}
 for o in 1 2; do
  $P shoot.py "http://localhost:8851/studio.html?who=$n&o=$o&w=800&h=1100&bg=$b&nc=$(date +%s)" 800 1100 out/o_${n}_$o 'full|{"rot":0}' 'portrait|{"rot":0.2}'
 done
done
echo BATCHDONE
