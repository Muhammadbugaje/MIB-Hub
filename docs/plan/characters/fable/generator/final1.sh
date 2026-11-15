#!/bin/sh
cd "$(dirname "$0")"; P=/Users/macbookair/Downloads/eehub-2/.venv/bin/python
df -h /System/Volumes/Data | tail -1
for w in jiya:efe3d6 taty:e6e1ea; do n=${w%%:*}; b=${w##*:}
$P shoot.py "http://localhost:8851/studio.html?who=$n&o=0&w=800&h=1100&bg=$b" 800 1100 out/f_$n 'full|{"rot":0}' 'full|{"rot":0.65}' 'portrait|{"rot":0.2}'
done
$P shoot.py "http://localhost:8851/street.html?s=A&cc=jiya,taty&o=0,0&w=1600&h=900" 1600 900 out/f_street 'c|{"pos":[-6.3,1.25,-4.0],"tgt":[-6,0.9,0],"fov":0.6}' 'c|{"pos":[-8.5,1.5,-3.6],"tgt":[-5.6,1.0,0.5],"fov":0.62}'
echo BATCHDONE
