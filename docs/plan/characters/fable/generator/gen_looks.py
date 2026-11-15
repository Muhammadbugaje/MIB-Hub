import json, copy, os
d = os.path.dirname(os.path.abspath(__file__))
J = json.load(open(d + '/base_jiya.json')); T = json.load(open(d + '/base_taty.json'))
def face_up(f, **kw):
    f.update(eyeR=0.0212, lidUp=0.5, lidLo=0.5, eyePm=1.2, lashes=4); f['brow']['w'] = min(f['brow'].get('w', 0.005), 0.005); f.update(kw)
def hair_up(h, **kw):
    h.pop('layers', None); h.update(locks=4, lockW=0.02, thick=0.005, lockStart=0.3); h.update(kw)
J['headScale'] = 1.1; face_up(J['face'], w=0.075, jaw=0.68)
hair_up(J['hair'], wave=0.6, grad=0.4, tip='#b27a48', cap=0.004, volume=0.3)
Z = copy.deepcopy(J); M = copy.deepcopy(J)
J['outfits'] = [J['outfits'][0]]
print('TATY', {k: v for k, v in T.items() if k not in ('outfits', 'face', 'hair')}, '\nface', T['face'], '\nhair', T['hair'], '\noutfits', [(o['id'], [i['type'] for i in o['items']]) for o in T['outfits']])
T['headScale'] = 1.1; T['body'] = dict(slim=0.5, curvy=0.55, fat=0, muscle=0)
face_up(T['face'], lidUp=0.44, wing=0.9); T['face']['mouth']['full'] = 1.35
hair_up(T['hair'], wave=0.04)
o = [x for x in T['outfits'] if any(i['type'] == 'choker' for i in x['items'])] or T['outfits'][:1]
for it in o[0]['items']:
    if it['type'] == 'dress': print('DRESS', it); it['flareTop'] = min(it.get('flareTop', 0.56), 0.46)
T['outfits'] = [o[0]]
Z.update(name='Zainab', height=1.66, seed=5, body=dict(slim=0.75, curvy=0.2, fat=0, muscle=0), skin='#f6dccd', blush=0.3, blushCol='#eda09a')
f = Z['face']; f.update(shadow='#dfb8a8', iris='#2a1710', irisIn='#6a4026', noEars=True, lidUp=0.46, tilt=0.08, wing=0.3)
f['brow'].update(col='#2a1a14', w=0.0044, arch=0.3, tilt=-0.02); f['mouth'].update(smile=0.6, open=0.0, lip='#c26462', w=0.022, full=1.15)
Z['hair'] = dict(none=True, root='#120c0a', rough=0.8)
Z['outfits'] = [dict(id='doctor', label='House officer', items=[
    dict(type='dress', col='#2c4f6e', neck='crew', neckDepth=0.004, off=0.004, bottom=0.07, flare=0.03, flareTop=0.5),
    dict(type='gown', col='#f7f6f2', neck='crew', neckDepth=0.0, off=0.012, bottom=0.3, flare=0.02, flareTop=0.5, openFront=[0.2, 0.3], sleeve=dict(len=0.93, flare=0.004), rough=0.8),
    dict(type='hijab', col='#2f7f7a'), dict(type='stethoscope'), dict(type='shoes', style='flats', col='#2a2224')])]
M.update(name='Madison', height=1.63, seed=9, body=dict(slim=0.6, curvy=0.25, fat=0, muscle=0), skin='#f1d0b6', blush=0.3, blushCol='#e8908a')
f = M['face']; f.update(w=0.075, jaw=0.72, cheek=0.35, tilt=0.1, lidUp=0.45, crease=0, wing=0.25, iris='#2a1710', irisIn='#5c3a22', shadow='#dcae96')
f['brow'].update(col='#1a1210', w=0.0042, arch=0.15); f['mouth'].update(smile=0.7, open=0.3, w=0.021, lip='#c9665f')
M['hair'].update(root='#141114', tip='#141114', gradAmt=0, wave=0.04, endY=0.80, endJitter=0.004, backLonger=0.0, cap=0.006, volume=0.6, spread=0.02, locks=3, gloss=0.35, rough=0.45, sheen='#8a90b0', partTone=0, fringe=dict(el=19, az=60))
M['outfits'] = [dict(id='street', label='Hoodie + wide trousers', items=[
    dict(type='top', col='#b9a6e0', neck='crew', neckDepth=0.006, off=0.012, loose=0.006, bottom=0.455, hood=True, sleeve=dict(len=0.94, flare=0.003)),
    dict(type='pants', col='#3a3d46', off=0.006, hem=0.04, minR=0.04, top=0.555),
    dict(type='shoes', style='sneakers', col='#f5f3ef', sole='#ffffff', laces='#ffffff'), dict(type='phone')])]
for n, x in (('jiya', J), ('taty', T), ('zainab', Z), ('madison', M)): json.dump(x, open(d + '/%s.json' % n, 'w'), indent=1)
