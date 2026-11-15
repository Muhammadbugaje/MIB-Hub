section("choices", () => {
  const o = {}; const P = fresh("tunde", "Chooser");
  o.overlays = ST.merged.overlay; o.issues = ST.issues.slice(0, 5); o.validate = ST.validate().slice(0, 5);
  const sideWithChoice = D.SIDE.filter((m) => m.steps.some((s) => s.t === "choice")).length, mainWithChoice = D.MISSIONS.filter((m) => !m.side && m.steps.some((s) => /^(choice|choose|vote)$/.test(s.t))).length;
  o.sideWithChoice = sideWithChoice; o.mainWithChoice = mainWithChoice;
  o.everyOptionSets = D.SIDE.concat(D.MISSIONS).every((m) => m.steps.every((s) => s.t !== "choice" || !s.ov || s.options.every((q) => q.label && q.set && q.set.length)));
  // a side mission's script choice: play s2 to its last step, pick the first option, and the effects land and persist
  const s2 = D.SIDE.find((m) => m.id === "s2"); ST.state(P).side = null; P.m.active = ""; P.money = 5000; ST.startSide(s2);
  let g = 0; while (ST.state(P).side && ST.state(P).side.step < s2.steps.length - 1 && g++ < 40) { api._open = false; ST.solve("side", 0); run(.03); }
  o.sideChoiceIsLast = s2.steps[s2.steps.length - 1].t === "choice" && !!ST.state(P).side;
  const f0 = S.affinity(P, "sadiq"); run(.1); ST.queue.length = 0; ST.sayT = 0; run(.3); o.dialogShown = !!api._open; api._open = false; ST.solve("side", 0); run(.05);
  o.flagSet = !!P.flags.s2_paid_garri; o.moneyTaken = P.money === 4400; o.friendUp = S.affinity(P, "sadiq") > f0; o.logged = (ST.state(P).log || []).some((l) => l[0] === "s2"); o.sideEnded = !ST.state(P).side;
  // consequences arrive later, by themselves, and survive a save and reload
  o.notYet = !Z.conseq.ledger().find((l) => l.flag === "s2_paid_garri").done;
  const saved = JSON.parse(JSON.stringify(P)); api._open = false; Z.begin(saved, false); run(.1); days(8);
  const led = Z.conseq.ledger().find((l) => l.flag === "s2_paid_garri"); o.dueAfterReload = !!(led && led.done); o.textArrived = !!(Z.conseq.lastText && /soup/.test(Z.conseq.lastText[1]));
  o.textInPhone = Z.texts.thread("sadiq").some((m) => /soup/.test(m.text));
  // a main-story flag: greeting changes, a weekly gift, and people talk about it
  Z.P.flags.musa_squat = 1; const w0 = Z.inv.count("water"); days(4); o.hiChanged = /Senior/.test(K.npcDef("musa").hi[0]); days(8); o.weeklyItem = Z.inv.count("water") > w0;
  o.walkerLines = Z.conseq.walkerLines().some((l) => /Musa/.test(l));
  // rumours: start, sting, cool down, can be set straight; never duplicated
  const soc0 = ST.state(Z.P).standing.social; Z.rumours.start("twotimer"); Z.rumours.start("twotimer"); o.oneRumour = Z.rumours.list().filter((r) => r.id === "twotimer").length === 1; o.heat = Z.rumours.heat("cheat");
  days(2); o.costsStanding = ST.state(Z.P).standing.social < soc0; const h1 = Z.rumours.heat("twotimer"); Z.rumours.squash("twotimer", 45); o.squashed = Z.rumours.heat("twotimer") < h1 - 40; days(12); o.fades = Z.rumours.heat("twotimer") === 0;
  // the two-timing choice in m92 is only asked of a two-timer
  const m92 = D.MISSIONS.find((m) => m.id === "m92"), c92 = m92.steps.find((s) => s.t === "choice"); o.m92 = !!c92 && c92.if === "two_timing" && c92.options.length === 2;
  // the noticeboard is in the world and opens
  o.board = !!K.findProp("noticeboard") && K.useSpot("noticeboard") && !!api._open && /noticeboard/.test(K.open.title); api._open = false; K.open = null;
  return o;
});
section("scenes", () => {
  const o = {}; fresh("tunde", "Scenes");
  const all = D.MISSIONS.filter((m) => !m.side).concat(D.SIDE), beats = []; all.forEach((m) => m.steps.forEach((s) => { if (s.t === "turn" || s.turn || s.t === "awards" || s.title || s.t === "switch" || s.t === "phone" || /^(choice|choose|vote)$/.test(s.t) || (s.lines && s.lines.length)) beats.push(s); }));
  o.beats = beats.length; o.allMeta = beats.every((s) => s.scene && s.scene.endState && s.scene.maxDuration > 0 && s.scene.skippable === true);
  o.maxLongest = Math.max(...beats.map((s) => s.scene.maxDuration)); o.moments = Object.keys(ST.MOMENT_META).length; o.momentMeta = Object.values(ST.MOMENT_META).every((m) => m.endState && m.maxDuration > 0 && m.skippable === true);
  // skip reaches the same end state as watching: a turn beat with lines, watched and skipped
  const pick = D.MISSIONS.find((m) => !m.side && m.steps.some((s, i) => s.t === "turn" && s.lines && s.lines.length > 1 && i < m.steps.length - 1)), idx = pick.steps.findIndex((s, i) => s.t === "turn" && s.lines && s.lines.length > 1 && i < pick.steps.length - 1);
  function play(skip) { const P = fresh("tunde", "Cut"); goStep(pick.id, (s, i) => i === idx); run(.3); let t = .3; if (skip) { run(.5); ST.skipScene(); t += .5; } while (Z.P.m.active === pick.id && Z.P.m.step === idx && t < 200) { run(.5); t += .5; } return { t, step: Z.P.m.step, active: Z.P.m.active, flags: Object.keys(Z.P.flags).sort().join(","), x: Math.round(Z.me.x), y: Math.round(Z.me.y), queue: ST.queue.length }; }
  const a = play(false), b = play(true); o.watched = a.t; o.skipped = b.t; o.skipFaster = b.t < a.t; o.sameEnd = a.step === b.step && a.active === b.active && a.flags === b.flags && a.x === b.x && a.y === b.y;
  o.withinMax = a.t <= pick.steps[idx].scene.maxDuration + 1;
  // the watchdog: lines that never end cannot hold the player past maxDuration
  fresh("tunde", "Dog"); goStep(pick.id, (s, i) => i === idx); run(.2); let t = 0; while (Z.P.m.step === idx && t < 300) { for (let k = 0; k < 3; k++) ST.queue.push(["", "A line that keeps being added, to try to trap the player in the beat."]); run(1); t += 1; }
  o.watchdog = Z.P.m.step !== idx && t <= pick.steps[idx].scene.maxDuration + 2;
  return o;
});
