section("switch", () => {
  const o = {}; let P = fresh("tunde", "Switcher"); const SW = Z.sw, me = Z.me;
  const b = Z.npc("bature"), ax = me.x, ay = me.y; b.x = me.x + 20; b.y = me.y + 4; b.hx = b.x; b.hy = b.y; const bx = b.x, by = b.y, look0 = Z.charOf(P.char).skin;
  o.to = SW.to("bature"); run(.1);
  o.cur = SW.cur; o.atFriend = near(me, bx, by, 2.5); o.friendHidden = b.hidden === true; o.lookIsFriend = Z.charOf(P.char).skin === K.npcDef("bature").skin && Z.charOf(P.char).voice === K.npcDef("bature").voice;
  const self = Z.npc("sw_self"); o.selfStands = !!self && near(self, ax, ay, 2.5) && self.look.skin === look0; o.rigKeyChanges = !Z.wardrobe || /sw:bature/.test(Z.wardrobe.key(P));
  o.chip = K.chipList().some((c) => /Playing as Bature/.test(c.text) && typeof c.tap === "function"); o.speed = S.speedFactor(P) > 1;
  // his skill: a riddle stops whatever hears it
  Z.foes.push({ x: me.x + 3, y: me.y, a: 0, frozen: 0, def: { r: 1 }, k: "shade", hp: 5, st: "" }); o.used = SW.use(); o.stunned = Z.foes[Z.foes.length - 1].frozen > 2; o.cooldown = SW.use() === false; Z.foes.length = 0;
  o.prompt = /riddle/i.test(SW.skill("bature").name);
  // walk as him, swap back: he stays where you took him, you are back where you waited
  me.x += 6; const fx = me.x, fy = me.y; run(.2); o.back = SW.back(); run(.1);
  o.backAtSelf = near(me, ax, ay, 2.5) && SW.cur === ""; o.friendWhereLeft = near(b, fx, fy, 3) && !b.hidden; o.selfGone = !Z.npc("sw_self"); o.lookRestored = Z.charOf(P.char).skin === look0;
  // refused in a vehicle; nobody to cycle to alone
  me.veh = { type: "bike", speed: 0, x: me.x, y: me.y, a: 0 }; o.noSwapOnBike = SW.to("bature", { quiet: true }) === false; me.veh = null; o.cycleAlone = SW.cycle() === false;
  // a story [switch] beat (m38): the HUD says who, the hold task completes only as Bature, control comes back, the step advances
  P = fresh("tunde", "Beat"); const g = goStep("m38", (s) => s.t === "switch"); run(.3);
  o.stepText = /Bature/.test(g.m.steps[g.i].text); o.broughtNear = near(Z.npc("bature"), Z.me.x, Z.me.y, 14); o.objSwap = /Swap to Bature/.test(Z.objective().text);
  run(6); o.notDoneAsMe = Z.P.m.step === g.i; SW.cycle(); run(.2); o.objAsHim = /^As Bature/.test(Z.objective().text); run(5);
  o.advanced = Z.P.m.active === "m38" && Z.P.m.step === g.i + 1; o.handedBack = SW.cur === "" && !Z.npc("sw_self");
  // a skill task (m41): the move must be used
  P = fresh("tunde", "Skill"); const g2 = goStep("m41", (s) => s.t === "switch"); run(.3); SW.cycle(); run(1); o.skillWaits = Z.P.m.step === g2.i; SW.use(); run(.3); o.skillDone = Z.P.m.step === g2.i + 1 && SW.cur === "";
  // optional beats ask first and can be declined with nothing lost
  P = fresh("tunde", "Opt"); const g3 = goStep("m43", (s) => s.t === "switch"); run(.1); ST.queue.length = 0; ST.sayT = 0; run(.6); o.optionalAsks = !!api._open && /Swap to Jega/.test(K.open.title); press("stay"); run(.3); o.declined = Z.P.m.step === g3.i + 1 && SW.cur === "";
  // the heist (m55): three people, any order, swap freely
  P = fresh("tunde", "Heist"); const g4 = goStep("m55", (s) => s.t === "switch" && s.team); run(.3);
  o.team = SW.options().join(","); o.teamPinned = near(Z.npc("yusuf"), Z.me.x, Z.me.y, 14) && near(Z.npc("bature"), Z.me.x, Z.me.y, 14);
  run(4.5); const seen = []; SW.cycle(); seen.push(SW.cur); run(.2); SW.use(); run(.3); SW.cycle(); seen.push(SW.cur); run(.2); o.stillRunning = Z.P.m.step === g4.i; SW.use(); run(.4);
  o.cycled = seen.join(","); o.heistDone = Z.P.m.step === g4.i + 1 && SW.cur === "" && !SW.team; o.swaps = SW.log.length;
  // free roam: a friend walking with you can be swapped to, and "you" follow
  P = fresh("tunde", "Roam"); const fr = Z.npc("bature"); fr.x = Z.me.x + 2; fr.y = Z.me.y; P.friends.bature = 60; Z.friends.follow(fr, 600); run(.2);
  o.roamOptions = SW.options().join(","); SW.cycle(); run(.2); const sf = Z.npc("sw_self"); o.roamSwapped = SW.cur === "bature" && !!sf && sf.follow === true; Z.emit({ t: "talk", npc: "sw_self" }); run(.2); o.talkSwapsBack = SW.cur === "";
  // the solver still finishes every switch step (the campaign test relies on it), and a reload mid-swap is clean
  P = fresh("tunde", "Solve"); const g5 = goStep("m87", (s) => s.t === "switch"); run(.2); SW.cycle(); run(.1); const sv = JSON.parse(JSON.stringify(Z.P)); api._open = false; Z.begin(sv, false); run(.2); o.reloadClean = SW.cur === "" && !Z.npc("sw_self") && Z.charOf(Z.P.char).skin === look0;
  ST.solve("main", 0); run(.1); o.solved = Z.P.m.step === g5.i + 1;
  // old saves: a step index is moved past the beats slotted in front of it
  const m55 = D.MISSIONS.find((m) => m.id === "m55"), plain = m55.steps.filter((s) => !s.ov); o.shift = [0, 3, plain.length - 1].map((k) => m55.steps[ST.shiftIndex(m55, k)] === plain[k]).join(",");
  const old = JSON.parse(JSON.stringify(Z.P)); old.story.ver = 2; old.m.active = "m55"; old.m.step = 3; api._open = false; Z.begin(old, false); run(.1); o.migrated = D.MISSIONS.find((m) => m.id === "m55").steps[Z.P.m.step] === plain[3] && Z.P.story.ver === ST.SAVE_VERSION;
  o.switchSteps = D.MISSIONS.concat(D.SIDE).reduce((a, m) => a + m.steps.filter((s) => s.t === "switch").length, 0); o.teamSteps = D.MISSIONS.reduce((a, m) => a + m.steps.filter((s) => s.t === "switch" && s.team).length, 0);
  o.everySkill = D.MISSIONS.concat(D.SIDE).every((m) => m.steps.every((s) => s.t !== "switch" || (s.team || [s.npc]).every((id) => Z.sw.SKILLS[ST.tok(Z.P, id)])));
  return o;
});
