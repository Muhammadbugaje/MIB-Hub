"""Extended trailer (about 3:25 at 100 bpm): shot recipes -> shots_ext.json; edit list is in build_ext.py (MOVES)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); FPB = 18  # frames per beat at 100 bpm, 30 fps
def S(name, beats, setup, pre="keys([])", post="", **kw):
    d = {"name": name, "n": beats * FPB + 8, "setup": setup, "pre": pre, "post": post}; d.update(kw); return d
H = "cam(H2+lerp(-.35,.35,k),.45,1.6)"  # interior drift
shots = [
 # 1 Arrival
 S("gate_dawn", 10, "settle(250); putp('gate',H2,38,6.3)", "cam(H2); keys(['up'])", "cam(H2, lerp(.04,.3,k), lerp(1.1,2.4,k))"),
 S("hero_walk", 4, "put(4,-735,H2,6.6)", "cam(H2); keys(['up'])", "cam(H2+PI-.25,.06,lerp(.9,.75,k))"),
 S("boulevard_sprint", 4, "put(4,-650,H2,7.4)", "cam(H2); keys(['up','run'])", "cam(H2+lerp(2.5,2.1,k),.07,.85)"),
 S("fountain_orbit", 6, "put(0,-322,H2,8.2)", "keys([])", "cam(lerp(H2-.9,H2+.6,k),.27,1.9)"),
 S("letters", 4, "putp('senate',H2,74,8.8)", "cam(H2); keys(['up'])", "cam(H2,.12,lerp(1.9,1.2,k))"),
 S("senate_rise", 4, "putp('senate',H2,30,9.2)", "cam(H2); keys([])", "cam(H2, lerp(.05,.42,k), lerp(1.4,2.4,k))"),
 # 2 Campus
 S("aerial_campus", 8, "put(0,-420,H2,9.6)", "keys([])", "cam(H2+lerp(-.2,.2,k),lerp(.85,.95,k),lerp(7,8.5,k))"),
 S("p2_aerial", 6, "putp('dangote',H2,20,10)", "keys([])", "cam(H2+lerp(-.4,.2,k),lerp(.75,.6,k),lerp(7,5.5,k))"),
 S("phase2", 4, "putp('dangote',H2,40,10.2)", "cam(H2); keys(['up'])", "cam(H2+lerp(-.2,.2,k),.25,2.2)"),
 S("eng_quad", 6, "putp('kt',-H2,30,10.4)", "cam(-H2); keys(['up'])", "cam(-H2+lerp(-.3,.3,k),lerp(.5,.3,k),lerp(2.8,2.0,k))"),
 S("coil_day", 4, "putp('enggarden',H2,16,10.6)", "keys([])", "cam(H2+lerp(-.4,.4,k),.12,1.1)"),
 # 3 Study
 S("lec_walk", 4, "window.R1=inside('kt',9.0)", "keys(['up'])", "cam(H2,.3,lerp(1.4,1.1,k))", info="R1"),
 S("lec_board", 8, "window.R1=lecture()", "keys([])", "cam(H2+lerp(-.15,.15,k),.22,lerp(1.4,1.0,k))", info="R1+' '+R2+' '+(Z.interior.lec&&Z.interior.lec.phase)"),
 S("library", 4, "window.R1=inside('library',11)", pre="keys(i<8?['up']:[])", post=H, info="R1"),
 S("hostel_room", 4, "window.R1=inside('ribadu',21)", pre="keys(i<8?['up']:[])", post="cam(H2+lerp(-.3,.3,k),.32,.95)", info="R1"),
 S("canteen", 4, "window.R1=inside(['shinkafi','buka'],13)", pre="keys(i<8?['up']:[])", post=H, info="R1"),
 S("senate_lobby", 4, "window.R1=inside('senate',10)", pre="keys(i<8?['up']:[])", post=H, info="R1"),
 S("lab", 4, "window.R1=inside(['dept_elect','ee'],11)", pre="keys(i<8?['up']:[])", post=H, info="R1"),
 S("sickbay", 4, "window.R1=inside('sickbay',12)", pre="keys(i<8?['up']:[])", post=H, info="R1"),
 S("library_night", 4, "window.R1=inside('library',21.5)", pre="keys([])", post="cam(H2+lerp(.3,-.3,k),.5,1.8)", info="R1"),
 # 4 Mall
 S("mall_atrium", 6, "window.R1=mall('market',12)", "keys(['up'])", "cam(H2+lerp(-.4,.3,k),.5,lerp(2.6,2.0,k))", info="R1"),
 S("mall_fashion", 4, "window.R1=mall('mk_fashion',12)", "keys(i<12?['up']:[])", H, info="R1"),
 S("fitting", 4, "window.R1=mall('mk_fashion',12); try{Z.wardrobe.editor('shop',function(){})}catch(e){R1+=' ERR '+e.message}", "keys([])", "", dom=True, info="R1+' '+ui()"),
 S("mib_store", 4, "window.R1=inside('mibstore',12)", "keys(i<10?['up']:[])", H, info="R1"),
 S("arcade_room", 4, "window.R1=mall('mk_arcade',15)", "keys([])", "cam(H2+lerp(-.4,.4,k),.4,1.7)", info="R1"),
] + [S("mini_" + g, 2, "fresh(14); Z.mini.open('%s',{free:true}); settle(2)" % g, "keys(i==2?['jump']:i>10?[['left'],['right'],['up'],['jump']][Math.floor(i/5)%4]:[])" , "", hud=True, no3d=True, info="Z.mini.screen()") for g in ("tabletennis", "kola", "run", "patrol", "ayo")] + [
 S("dance_floor", 8, "window.R1=mall('mk_dance',21); pals()", "keys(i==2?['emote2']:[])", "cam(H2+lerp(-.5,.5,k),.38,1.6)", info="R1"),
 # 5 Friends and life
 S("bigmap", 6, "put(4,-700,H2,10); D.press('map'); D.step(2); D.release('map'); D.step(2)", "if(i>12&&Z.bigmap.isOpen)Z.bigmap.zoom(1.012)", "", hud=True, info="'open='+Z.bigmap.isOpen"),
 S("friends_walk", 4, "put(4,-520,H2,13); window.R1=pals()", "cam(H2); keys(['up'])", "cam(H2+PI-.35,.1,1.0)", info="R1"),
 S("pillion", 4, "put(4,-600,H2,13.3); pals(); settle(10); ride('okada'); roll(20)", "keys(['up'])", "cam(hd()+2.4,.12,.95)", info="Z.npcs.filter(function(n){return n.riding}).length+' riding'"),
 S("job", 4, "put(4,-600,H2,13.6); var o=Z.offers(); if(o[0])Z.takeJob(o[0]); settle(10)", "keys(['up','run'])", "cam(H2+PI-.3,.18,1.1)", hud=True, info="Z.P.job&&Z.P.job.kind"),
 S("phone", 6, "put(4,-700,H2,14); Z.ui.phone()", "", "", dom=True, info="ui()"),
 S("celebrate", 4, "put(0,-322,H2,14.5); pals(); Z.moment('mission',{title:'Welcome, fresher',cash:1500,xp:200}); settle(6)", "keys(i==20?['emote2']:[])", "cam(H2+k*.9,.25,1.25)", hud=True),
 S("friends_dance", 4, "put(0,-322,H2,15.5); pals(); settle(10)", "keys(i==1?['emote2']:[])", "cam(H2+2.6+k*.6,.2,1.2)"),
 # 6 Day to night
 S("pier_date", 6, "solo(); putp('dam',H2,-34,17.6); pals()", "keys([])", "cam(H2+lerp(-.25,.15,k),.12,lerp(1.8,1.4,k))"),
 S("courts", 4, "solo(); putp('social',-.6,4,17.0)", "keys([])", "cam(-.6+lerp(-.3,.3,k),.8,4.6)"),
 S("lake_lapse", 8, "putp('dam',H2,-40,17.4)", "Z.P.time=(17.4+2.6*k)*60; keys([])", "cam(H2+lerp(-.2,.2,k),.12,1.6)"),
 S("shinkafi_night", 6, "putp('shinkafi',1.2,-26,19.2); expo(2.1); settle(100)", "Z.P.time=19.2*60; keys([])", "cam(1.2+PI+lerp(-.2,.2,k),.22,2.6)"),
 S("social_night", 4, "putp('social',-.6,4,19.6); expo(2.1); settle(200)", "Z.P.time=19.6*60; keys([])", "cam(-.6+k*.4,.85,4.4)"),
 S("coil_night", 4, "putp('enggarden',H2,16,20.2); expo(2.1)", "Z.P.time=20.2*60; keys([])", "cam(H2+k*.3,.14,1.1)"),
 # 7 Trouble
 S("fight", 8, "solo(); put(8,-700,H2,12); settle(30); window.R1=rival(); Z.me.a=H2", "cam(H2); keys((i>=2&&i<5)?['attack']:(i>=14&&i<70)?['block']:(i>=74&&i<77)||(i>=92&&i<95)||(i>=110&&i<113)?['kick']:[])", "cam(H2+2.0,.14,.8)", hud=True, info="R1+' st='+(window.RV&&RV.st)+' hp='+(window.RV&&RV.hp)"),
 S("security", 8, "put(4,-560,H2,11); try{Z.P.sec.warns=5; Z.P.sec.since=0;}catch(e){} Z.P.char='musa'; Z.offend('hitPed'); Z.guards.push({x:Z.me.x+2,y:Z.me.y-12,a:H2,spd:0,walk:0,st:'chase',hold:0}); Z.guards.push({x:Z.me.x-3,y:Z.me.y-18,a:H2,spd:0,walk:0,st:'chase',hold:0})", "cam(H2); keys(['up','run'])", "cam(H2+2.9,.2,1.3)", hud=True, info="JSON.stringify(Z.P.sec&&Z.P.sec.state)+Z.guards.length"),
 S("bike_sprint", 4, "Z.P.char=SamaruData.HERO.id; put(4,-600,H2,9.5); ride('bike'); roll(30)", "keys(['up','run'])", "cam(hd()+lerp(2.5,2.0,k),.1,.85)"),
 S("okada", 4, "put(-160,-300,0,10); ride('okada'); roll(30)", "keys(i<30?['up']:['up','left'])", "cam(hd()+lerp(.7,-.2,k),.14,.9)"),
 S("keke", 3, "put(-350,-220,H2,10.5); ride('keke'); roll(25)", "keys(['up'])", "cam(hd()+2.6,.12,.9)"),
 S("drift", 8, "put(700,-300,H2,12); settle(30); ride('sport'); window.A0=H2; crowd(62); roll(40)", "if(i==6)Z.peds.forEach(function(p){p.flee=1.6}); keys(i<26?['up']:['up','left','jump'])", "if(i<62)cam(A0+PI-.5,.2,1.4); else cam(A0+2.3,.22,1.1)"),
 S("sport", 3, "put(-700,-380,H2,11.5); ride('sport'); roll(40)", "keys(['up'])", "cam(hd()+lerp(2.9,2.3,k),.1,.9)"),
 S("takeoff", 8, "put(-668,560,0,12.5); ride('plane')", "keys(['up'])", "cam(hd()+lerp(2.5,2.9,k), lerp(.1,.04,k), 1.4)", sub=5, n2=190, info="'alt='+Z.me.alt"),
 S("bank", 4, "1", "keys(['up','left'])", "cam(hd()+lerp(-.2,-.5,k),.4,2.0)", info="'alt '+Z.me.alt"),
 S("wild_hills", 4, "var w=wildPt(350); put(w.x,w.y,H2,16.5)", "keys(['up','run'])", "cam(H2+lerp(2.3,2.7,k),lerp(.3,.18,k),lerp(3,2,k))"),
 S("patrol", 4, "var w=wildPt(470); Z.P.char='musa'; put(w.x,w.y,H2,16.8); settle(40)", "keys(['up'])", "cam(H2+2.6,.22,1.5)", hud=True, info="'wild='+(Z.wild.st&&Z.wild.st.stage)"),
 # 8 Story tease (mood)
 S("tease_coil", 8, "Z.P.char=SamaruData.HERO.id; putp('enggarden',H2,10,21.5); expo(1.6)", "Z.P.time=21.5*60; keys([])", "cam(H2+lerp(-.2,.2,k),lerp(.05,.18,k),lerp(.9,1.5,k))"),
 S("tease_hall", 8, "window.R1=inside('kt',17.9)", "keys([])", "cam(H2+lerp(.15,-.15,k),.3,lerp(2.0,1.3,k))", info="R1"),
 S("tease_lake", 8, "solo(); Z.npcs.forEach(function(n){if(Math.hypot(n.x-Z.me.x,n.y-Z.me.y)<60){n.x+=200;}}); putp('dam',H2,-40,20.5); expo(1.5)", "Z.P.time=20.5*60; keys([])", "cam(H2+lerp(-.1,.1,k),.1,2.4)"),
 S("tease_senate", 8, "putp('senate',H2,60,18.7)", "Z.P.time=(18.7+.4*k)*60; keys(['up'])", "cam(H2,.08,lerp(1.6,1.2,k))"),
 S("tease_gate", 8, "putp('gate',-H2,20,19.2); expo(1.8)", "keys(['up'])", "cam(-H2+PI,.06,lerp(.9,1.6,k))"),
]
for s in shots:
    if "n2" in s: s["n"] = s.pop("n2")
json.dump(shots, open(os.path.join(HERE, "shots_ext.json"), "w"), indent=0)
print(len(shots), "shots,", sum(s["n"] for s in shots), "frames")
