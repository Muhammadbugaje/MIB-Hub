#!/bin/sh
cd "$(dirname "$0")"; P=/Users/macbookair/Downloads/eehub-2/.venv/bin/python; OUT=/Users/macbookair/Downloads/eehub-2/docs/plan/characters/fable; mkdir -p $OUT out
v=$(date +%s); sed -i '' -E "s/\?v=[0-9]+/?v=$v/g" studio.html
U=http://localhost:8852/studio.html
for w in ${1:-jiya taty zainab madison}; do ( $P shoot.py "$U?who=$w&o=0&w=800&h=1100" 800 1100 out/$w 'bust|{"rot":0.18}' 'full|{"rot":0}' 2>&1 | grep -v saved; mv out/${w}_0.jpg $OUT/${w}_portrait.jpg; mv out/${w}_1.jpg $OUT/${w}_full.jpg ) ; done
wait
$P shoot.py "$U?who=jiya,taty,zainab,madison&o=0,0,0,0&w=1600&h=900" 1600 900 out/lineup 'lineup|{"gap":0.72,"rots":[0.25,0.1,-0.1,-0.25]}' 2>&1 | grep -v saved; mv out/lineup_0.jpg $OUT/lineup.jpg
$P - <<'EOF'
from PIL import Image
O='/Users/macbookair/Downloads/eehub-2/docs/plan/characters/fable/'; N=['jiya','taty','zainab','madison']
for kind in ('portrait','full'):
    s=Image.new('RGB',(1600,550))
    for i,n in enumerate(N): s.paste(Image.open(O+n+'_'+kind+'.jpg').resize((400,550)),(i*400,0))
    s.save('out/sheet_'+kind+'.jpg',quality=85)
EOF
ls -la $OUT
