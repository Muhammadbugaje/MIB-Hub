/**
 * Missions 1-10 of Year 1, in story order, as playable scripts.
 *
 * Each mission follows its **Steps** in docs/plan/missions/Y1.md: the HUD shows
 * the step's own objective text (read from the parsed file, tokens filled), the
 * step completes the way its `completeWhen` says (reach, talk, use, choice,
 * minigame, ride, escort, cutscene.end), and every cutscene block is played by
 * id. Each step is a checkpoint: `setup` puts the world back for that step when
 * you resume or replay from it (rule X8), `run` plays it.
 *
 * Lines the game adds that are not in Y1.md (bible §3 lines with no id yet,
 * barks that react to your choices) have ids starting "wip_", so the voice
 * scripts can pick them up later.
 */
import type { StoryMission } from "../../story/parse.ts";
import { PLACES } from "../../world/layout.ts";
import type { A3 } from "../director.ts";
import { addItem, type Progress } from "../save.ts";
import type { StoryGame, Target } from "../story-game.ts";
import { B, bySign, frontOf, hall, inYaw, outYaw } from "./places.ts";
import { placeOf } from "../nav-routes.ts";

const PI = Math.PI;

export interface StepDef {
  /** Story step number (Y1.md), 0 for the mission's opening film. */
  n: number;
  /** Put the world in place when starting here (resume, replay, debug). */
  setup?: (g: StoryGame) => void | Promise<void>;
  run: (g: StoryGame) => Promise<void>;
}

export interface MissionDef {
  id: string;
  /** Where the mission starts (the marker you walk into), and when. */
  start: (g: StoryGame) => Target;
  hour: number;
  calendar: string;
  steps: StepDef[];
  reward: (p: Progress) => string[];
}

/** The story data (set by main.ts from the build-time bundle). */
let MISSIONS: StoryMission[] = [];
export function setStory(m: StoryMission[]): void {
  MISSIONS = m;
}

const W = (pos: A3, label?: string): Target => ({ pos, where: "world", label });

/** The HUD objective for step n of a mission, straight from Y1.md. */
function obj(g: StoryGame, id: string, n: number): void {
  const m = MISSIONS.find((x) => x.key === id);
  const st = m?.steps.find((s) => s.n === n);
  g.setObjective(`M${Number(id.slice(1))} · ${m?.title ?? ""}`, st?.objective ?? "", null);
}

function aim(g: StoryGame, target: Target | (() => Target)): void {
  if (g.objective) g.objective.target = typeof target === "function" ? target : () => target;
}

/** Long trips (rule X5: not too much walking): offer an okada for a little money; it fades you there. */
async function maybeOkada(g: StoryGame, to: Target, yaw: number, cost = 150): Promise<void> {
  if (g.place !== "world" && to.where === "world") return;
  const here = g.playerAt();
  const d = here.where === to.where ? Math.hypot(here.pos[0] - to.pos[0], here.pos[2] - to.pos[2]) : 999;
  if (d < 150 || g.progress.money < cost) return;
  const i = await g.ask("It's a long way. An okada is waiting by the road.", [`Take an okada (₦${cost})`, "Walk (and see the campus)"]);
  if (i !== 0) return;
  g.progress.money -= cost;
  g.ui.setMoney(g.progress.money);
  await g.fadeThrough(() => g.teleport(to, yaw), 0.5);
}

const ROOMIE = "npc.roomie";

/* ====================================================================== M1 */

const m001: MissionDef = {
  id: "m001",
  hour: 7.0,
  calendar: "Mon 16 Sep · Freshers' Week · Resumption day",
  start: (g) => ({ pos: g.at("hostel_bed_stand", "hostel"), where: "hostel" }),
  reward: (p) => {
    p.money += 500;
    addItem(p, "kola_vigour");
    addItem(p, "bicycle_loan");
    p.stats.stamina += 1;
    p.journal.entries.push("The Note");
    p.clues.push("C-NOTE", "C-SYMBOL", "C-CLOCK", "C-HUM", "C-GOAT", "MS-01");
    return ["₦500 from Malam Sule", "Kola of Vigour (+stamina)", "Bicycle (loan)", "Journal: The Note"];
  },
  steps: [
    {
      n: 0,
      run: async (g) => {
        for (const id of ["cut_m001_film_a", "cut_m001_film_b", "cut_m001_film_c", "cut_m001_film_d", "cut_m001_film_e"]) await g.cutscene(id, { fadeIn: id === "cut_m001_film_a" });
      },
    },
    {
      n: 1,
      setup: (g) => {
        g.teleport({ pos: g.at("hostel_bed_stand", "hostel"), where: "hostel" }, PI / 2);
        // Standing by the window wall, out of your way (the seated pose is the cutscene's).
        const rb = g.at("roomie_bed_sit", "hostel");
        g.put(ROOMIE, { pos: [rb[0] + 0.2, 0, rb[2] - 0.9], where: "hostel" }, PI);
        g.hours = 7.8;
      },
      run: async (g) => {
        obj(g, "m001", 1);
        const win: Target = { pos: g.at("room_window", "hostel"), where: "hostel" };
        aim(g, win);
        await g.reach(win, 0.75);
        // The window: the campus, the clock that says 6:06, the water beyond (bible §3, 3:00-3:30).
        await vista(g, "window_view", [-60, 9, -150], [
          [ROOMIE, "wip_m001_win_01", "Come and see your kingdom. Twin Theatres. Engineering."],
          [ROOMIE, "wip_m001_win_02", "That clock has said 6:06 since before my uncle came here."],
          [ROOMIE, "wip_m001_win_03", "It is right twice a day. More than our lecturers."],
        ], [0, 18, -128]);
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport({ pos: g.at("room_window", "hostel"), where: "hostel" }, PI);
        g.put(ROOMIE, { pos: g.at("room_door", "hostel"), where: "hostel" }, 0);
        g.hours = 8.0;
      },
      run: async (g) => {
        obj(g, "m001", 2);
        const r = g.npc(ROOMIE)!;
        g.bark(ROOMIE, "wip_m001_walk_01", "Come. Breakfast. You're paying. Don't argue, I've decided.", "amused");
        // The roommate leads you: out of the room through its door, down the corridor, down the
        // stairs and out of the hall's front door, then along the footpaths to the Spot. A real
        // path all the way (never through a wall); waits and waves if you fall behind.
        const h = hall(g.ctx.female);
        aim(g, () => g.whereIs(r));
        void g.reach({ pos: frontOf(h, 2.4), where: "world" }, 5).then(
          () => g.bark(ROOMIE, "wip_m001_walk_02", "Lecture-day rule: at eight this place is empty. A crowd after eight means something free.", "neutral"),
          () => undefined,
        );
        const route: Target[] = NAV_ROUTES.m001_lead(g.ctx.female, (n, w) => g.at(n, w)).route.map((p) => ({ pos: p, where: placeOf(p[0], p[2]) }));
        await g.walk(r, route, { lead: 12, speed: 2.1 });
        obj(g, "m001", 2);
        const counter = W(g.at("spot_counter"), "the Spot");
        aim(g, counter);
        await g.reach(counter, 1.6);
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport(W([-19.2, 0, -80.6]), PI / 2);
        g.put(ROOMIE, W([-18.6, 0, -79.0]), PI / 2);
        g.hours = 8.2;
      },
      run: async (g) => {
        obj(g, "m001", 3);
        const nk = g.put("npc.mama_nkechi", W(g.at("nkechi_spot")), -PI / 2);
        void nk;
        g.put("npc.suya_man", W(g.at("suya_man_spot")), -PI / 2);
        aim(g, W(g.at("nkechi_spot")));
        await g.talk("npc.mama_nkechi", "Order food");
        await g.barks([
          ["npc.mama_nkechi", "wip_m001_spot_01", "New face. You have eaten? Don't lie to me.", "warm"],
          [ROOMIE, "wip_m001_spot_02", "My friend is paying. We agreed. In my head.", "amused"],
        ]);
        const i = await g.ask("Two plates of jollof, ₦300 each.", ["Pay for two (₦600)", `Pay for one… ({{ROOMIE}} looks at you)`]);
        if (i === 1) g.bark(ROOMIE, "wip_m001_spot_03", "One? For two people? Ehn. Two.", "dry");
        g.progress.money = Math.max(0, g.progress.money - 600);
        g.ui.setMoney(g.progress.money);
        g.sfxs.play("pickup");
        // Sit and eat at the bench table (the hunger bar is shown once).
        await g.fadeThrough(() => {
          g.teleport(W(g.at("spot_eat")), PI);
          g.player.person.act("sit");
          g.player.person.act("eat");
          g.put(ROOMIE, W(g.at("roomie_eat")), PI, "sit");
          g.npc(ROOMIE)!.act("eat");
        });
        g.ui.showCard("Hunger", "Full", "Food keeps you going. You'll need it.", [], 2400);
        await g.sleep(3.2);
        await g.cutscene("cut_m001_mid_1");
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport(W(g.at("spot_eat")), PI);
        g.goat.visible = true;
        g.goat.place(-10.5, 0, -88, PI / 2);
        g.hours = 8.5;
      },
      run: async (g) => {
        obj(g, "m001", 4);
        g.player.person.act("stand");
        aim(g, () => W(g.goat.root.getPosition().toArray() as A3, "the goat"));
        // The senior filming (or Taty, jogging past the other way, if she's switched on).
        const filmer = g.ctx.specials.taty ? "special.taty" : "crowd.students";
        g.put(filmer, W([-14, 0, -66]), PI);
        g.put(ROOMIE, W([-20.6, 0, -84.6]), PI / 2);
        const pts = NAV_ROUTES.m001_goat().route.map((p) => W(p));
        await g.chaseGoat(pts, (i) => {
          if (i === 0) {
            if (g.ctx.specials.taty) g.bark("special.taty", "m001_play_t01", "Bora! Run, fresher, the goat is winning!", "excited");
            else g.bark("crowd.students", "wip_m001_play_01", "Fresher, smile!", "amused");
          }
          if (i === 1) {
            g.bark(ROOMIE, "wip_m001_chase_01", "Left! Your other left!", "excited");
            if (g.ctx.specials.taty) setTimeout(() => g.bark("special.taty", "m001_play_t02", "Don't look at me, I'm on lap six!", "amused"), 2600);
          }
          if (i === 2) g.bark("player", "wip_m001_chase_p01", "…That goat is looking at me.", "dry");
        });
        await g.use("goat", "Catch the goat", () => W(g.goat.root.getPosition().toArray() as A3), 2.2, 3);
        g.sfxs.play("goat_bell_fast");
        g.put(filmer, null);
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport(W([-40.2, 0, -50.2]), -PI / 2);
        g.goat.visible = true;
        g.goat.place(-41, 0, -48.6, 0);
        g.hours = 8.8;
      },
      run: async (g) => {
        obj(g, "m001", 5);
        const bikeAt: A3 = [-44, 0, -48.0];
        g.bike.visible = true;
        g.bike.root.setPosition(bikeAt[0], 0.05, bikeAt[2]);
        g.bike.root.setEulerAngles(0, 90, 0);
        g.bike.update(0, 0.14);
        g.put(ROOMIE, W([-38.8, 0, -51.4]), -PI / 2);
        g.bark(ROOMIE, "wip_m001_bike_01", "A bicycle. Borrow it. Everybody does.", "amused");
        aim(g, W(bikeAt, "the bicycle"));
        await g.use("bike", "Ride the bicycle", () => W(bikeAt), 2.4, 3);
        g.teleport(W(bikeAt), PI);
        const gate = W(g.at("farm_gate"), "the farm");
        aim(g, gate);
        // The ride: the roommate jogs alongside, narrating badly (bible §3, 6:30-8:00).
        let said = 0;
        const narration = setInterval(() => {
          if (g.mode !== "bike") return;
          const z = g.player.z;
          const lines: [number, string, string][] = [
            [-120, "wip_m001_ride_01", "That's the clock. It doesn't work."],
            [-170, "wip_m001_ride_02", "That's Engineering. They don't sleep."],
            [-205, "wip_m001_ride_03", "That's the garden. Don't ask."],
          ];
          const next = lines[said];
          if (next && z < next[0]) {
            g.bark(ROOMIE, next[1], next[2], "excited");
            said++;
            if (said === 3) setTimeout(() => g.bark("player", "wip_m001_ride_p01", "What's in the garden?", "neutral"), 2800);
            if (said === 3) setTimeout(() => g.bark(ROOMIE, "wip_m001_ride_04", "I said don't ask.", "stern"), 5200);
          }
        }, 250);
        try {
          await g.ride(gate, { goat: true, companion: ROOMIE });
        } finally {
          clearInterval(narration);
        }
        await g.cutscene("cut_m001_mid_2");
      },
    },
    {
      n: 6,
      setup: (g) => {
        g.teleport(W(g.at("farm_gate")), PI);
        g.put("npc.malam_sule", W(g.at("sule_spot")), 0);
        g.hours = 11.2;
      },
      run: async (g) => {
        obj(g, "m001", 6);
        const stone = W(g.at("kola_stone"), "the old kola tree");
        aim(g, stone);
        await g.reach(stone, 3);
        await g.use("stone", "Lift the loose stone", () => stone, 2, 3);
        g.tin.enabled = true;
        g.tin.setPosition(stone.pos[0], 0.05 + g.ground(stone.pos[0], stone.pos[2]), stone.pos[2]);
        g.sfxs.play("pickup");
        g.player.person.act("kneel");
        g.ui.showCard("Found", "Kola of Vigour", "Scratched inside the lid: six dots in a ring, and a seventh in the middle.", ["+ Stamina, for good"], 4200);
        await g.sleep(2.4);
        g.player.person.act("stand");
        g.bark(ROOMIE, "wip_m001_kola_01", "You found treasure on day one? I've been here a week. I found a sock.", "amused");
        await g.sleep(3);
        g.tin.enabled = false;
      },
    },
    {
      n: 7,
      setup: (g) => {
        g.teleport(W(g.at("kola_stone")), PI);
        g.hours = 18.0;
      },
      run: async (g) => {
        obj(g, "m001", 7);
        // Time passes: the afternoon goes, the sun goes down.
        await g.fadeThrough(() => {
          g.hours = 18.05;
          g.light("dusk");
          g.clearCast();
          g.teleport(W(frontOf(hall(g.ctx.female), 9)), inYaw(hall(g.ctx.female)));
        }, 0.6);
        g.ui.calendar("Mon · Sunset");
        setTimeout(() => g.ui.calendar(null), 3600);
        const corridor: Target = { pos: g.at("room_door", "hostel"), where: "hostel", label: "your room" };
        aim(g, corridor);
        await g.reach(corridor, 2.4);
        await g.cutscene("cut_m001_close");
      },
    },
  ],
};

/* ====================================================================== M2 */

const m002: MissionDef = {
  id: "m002",
  hour: 8.3,
  calendar: "Tue 17 Sep · Freshers' Week · Registration",
  start: () => W(frontOf(B.senate, 6), "the Senate"),
  reward: (p) => {
    addItem(p, "student_id");
    p.flags.bank_account = true;
    p.journal.contacts.push("Mum", "Dad", "{{ROOMIE}}", "Aleeya");
    p.stats.street += 1;
    p.clues.push("C-DOOR7", "MS-02");
    return ["Student ID", "Bank account", "Contacts: Mum, Dad, your roommate, Aleeya", "+ Street sense"];
  },
  steps: [
    {
      n: 1,
      setup: (g) => {
        g.teleport(W(frontOf(B.senate, 6)), inYaw(B.senate));
        g.hours = 8.3;
      },
      run: async (g) => {
        obj(g, "m002", 1);
        await g.barks([[ROOMIE, "wip_m002_tip_01", "Carry water. Carry a pen. Carry yourself.", "warm"]]);
        const q: Target = { pos: g.at("senate_enter", "senate"), where: "senate" };
        aim(g, q);
        await g.reach(q, 2.6);
        await g.cutscene("cut_m002_open");
        g.put("npc.aleeya", { pos: g.at("aleeya_queue", "senate"), where: "senate" }, PI);
        g.put("npc.mrs_adebayo", { pos: g.at("clerk_spot", "senate"), where: "senate" }, 0);
        g.crowd([{ n: 5, x: -4, z: -2.2, hx: 0.2, hz: 2.0, face: PI, rows: true }], "senate");
        await g.minigame(() => g.mini.queue(8, 24));
        g.clearCrowd();
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport({ pos: g.at("queue_end", "senate"), where: "senate" }, PI);
        g.put("npc.mrs_adebayo", { pos: g.at("clerk_spot", "senate"), where: "senate" }, 0);
        g.hours = 9.6;
      },
      run: async (g) => {
        obj(g, "m002", 2);
        const clerk: Target = { pos: g.at("registry_window", "senate"), where: "senate" };
        aim(g, clerk);
        await g.talk("npc.mrs_adebayo", "Hand in your form", 2.6);
        g.bark("npc.mrs_adebayo", "wip_m002_reg_01", "Four passports. Not three. Four. Next.", "bored");
        const kiosk = W(g.at("photo_kiosk"), "Ring Road Cyber & Print");
        aim(g, kiosk);
        await g.reach({ pos: frontOf(B.senate, 3), where: "world" }, 3);
        await maybeOkada(g, W(frontOf(B.photo, 4)), inYaw(B.photo));
        await g.reach(kiosk, 2.2);
        // Pay for passport photos at the kiosk
        g.progress.money -= 400;
        g.ui.setMoney(g.progress.money);
        // Show player taking photos at the kiosk
        g.player.person.act("eat");  // Using eat as "take photo" pose
        await g.sleep(1.5);
        g.player.person.act("idle");
        addItem(g.progress, "passport_x4");
        g.ui.showCard("Item", "Four passport photographs", "You look surprised in all four.", [], 2600);
        g.sfxs.play("camera_shutter");
        // Step 3: Mum calls while you walk back.
        await phoneMum(g);
        aim(g, clerk);
        await maybeOkada(g, W(frontOf(B.senate, 4)), inYaw(B.senate));
        await g.reach(clerk, 2.6);
        await g.talk("npc.mrs_adebayo", "Give Mrs. Adebayo the photos", 2.6);
        addItem(g.progress, "passport_x4", -1);
        g.bark("npc.mrs_adebayo", "wip_m002_reg_02", "Hm. Four. Stamp. Bursary next.", "bored");
        g.sfxs.play("rubber_stamp");
      },
    },
    {
      n: 4,
      setup: async (g) => {
        g.teleport({ pos: g.at("queue_end", "senate"), where: "senate" }, PI);
        g.hours = 11.4;
        // Show people moving in queue - simulate queue progress
        for (let i = 0; i < 5; i++) {
          await g.sleep(0.8);
          g.bark("crowd.queue", "wip_m002_queue_0" + i, "...", "neutral");
        }
      },
      run: async (g) => {
        obj(g, "m002", 4);
        const bank: Target = { pos: g.at("bank_window", "senate"), where: "senate", label: "the bank window" };
        aim(g, bank);
        await g.reach(bank, 2.2);
        await g.use("bank", "Open a bank account", () => bank, 2.4, 3);
        g.progress.flags.bank_account = true;
        g.sfxs.play("bank_alert");
        // Show player signing documents at bank
        g.player.person.act("sign");
        g.ui.showCard("Bank", "Account opened", "Dad's money arrives with a lecture attached.", [], 2600);
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport({ pos: g.at("bank_window", "senate"), where: "senate" }, PI);
        g.hours = 13.1;
      },
      run: async (g) => {
        obj(g, "m002", 5);
        const bq: Target = { pos: g.at("bursary_queue", "senate"), where: "senate" };
        aim(g, bq);
        await g.reach(bq, 1.6);
        await g.cutscene("cut_m002_mid_1");
        // The choice: the shortcut behind the Bursary, or the long way round.
        const c = await g.ask("The Bursary clerk wants a receipt from the bank's other branch. The quick way is the lane behind the Bursary.", ["Take the shortcut", "Go round"]);
        g.progress.flags.m002_shortcut = c === 0 ? "shortcut" : "round";
        if (c === 0) {
          await g.fadeThrough(() => (g.hours += 1), 0.7);
          g.ui.showCard("The shortcut", "Locked on Tuesdays", "A narrow lane. A locked gate. A goat. An hour gone.", [], 3400);
          await g.sleep(1.2);
          g.bark("crowd.students", "wip_m002_fine_01", "Trespass on a path. Five hundred naira.", "stern");
          await g.sleep(2.6);
          if (g.ctx.specials.jiya) {
            await g.barks([
              ["special.jiya", "m002_play_j02", "Trespass on a path. A *path*. Mate, that's what paths are for.", "dry"],
              ["special.jiya", "m002_play_j03", "With respect, officer, and I mean a great deal of it: which regulation?", "dry"],
            ]);
            g.ui.showCard("Legal Immunity", "Fine cancelled", "Jiya walked you back to the security man. He remembered somewhere else to be.", [], 3000);
          } else {
            g.progress.money = Math.max(0, g.progress.money - 500);
            g.ui.setMoney(g.progress.money);
            g.ui.showCard("Fine", "−₦500", "\"Trespass on a path.\" You pay. Muhammad was right.", [], 3000);
          }
        }
        // The fee notice and its "sundry charges".
        if (g.ctx.specials.jiya) {
          await g.barks([
            ["special.jiya", "m002_play_j05", "I'm Jiya. I did law. Then I got better.", "amused"],
            ["special.jiya", "m002_play_j01", "Right. 'Sundry charges.' Sundry what, precisely?", "dry"],
          ]);
        } else g.bark("npc.aleeya", "wip_m002_sundry_01", "Psst. The 'sundry charges' are optional. Don't tell them I said.", "whisper");
        g.progress.money += 300;
        g.ui.setMoney(g.progress.money);
        g.put("npc.mr_clement", { pos: g.at("clement_spot", "senate"), where: "senate" }, 0);
        const bw: Target = { pos: g.at("bursary_window", "senate"), where: "senate", label: "the Bursary" };
        aim(g, bw);
        await g.talk("npc.mr_clement", "Pay at the Bursary", 2.6);
        g.sfxs.play("rubber_stamp");
      },
    },
    {
      n: 6,
      setup: (g) => {
        g.teleport({ pos: g.at("bursary_queue", "senate"), where: "senate" }, PI);
        g.hours = 15.6;
      },
      run: async (g) => {
        obj(g, "m002", 6);
        g.put("npc.garba", { pos: g.at("garba_spot", "senate"), where: "senate" }, -PI / 2, "sit");
        const desk: Target = { pos: g.at("basement_player", "senate"), where: "senate", label: "Malam Garba" };
        aim(g, desk);
        await g.reach({ pos: g.at("senate_basement_stair", "senate"), where: "senate" }, 2.2);
        await g.cutscene("cut_m002_close");
      },
    },
  ],
};

/* ====================================================================== M3 */

const m003: MissionDef = {
  id: "m003",
  hour: 17.9,
  calendar: "Wed 18 Sep · Freshers' Week · Evening",
  start: (g) => ({ pos: g.at("desk_stand", "hostel"), where: "hostel", label: "your room" }),
  reward: (p) => {
    addItem(p, "recipe_jollof");
    addItem(p, "recipe_garri");
    addItem(p, "hotplate");
    p.stats.health += 1;
    p.rel["npc.idris"] = (p.rel["npc.idris"] ?? 0) + 1;
    p.clues.push("C-BROADCAST", "C-KB");
    return ["Recipes: jollof, soaked garri", "+ Health", "The hotplate", "Idris: a corridor friend"];
  },
  steps: [
    {
      n: 0,
      setup: (g) => {
        g.teleport({ pos: g.at("desk_stand", "hostel"), where: "hostel" }, 0);
        g.hours = 18.0;
      },
      run: async (g) => {
        await g.cutscene("cut_m003_open");
      },
    },
    {
      n: 1,
      setup: (g) => {
        g.teleport({ pos: g.at("room_door", "hostel"), where: "hostel" }, PI);
        g.hours = 18.05;
      },
      run: async (g) => {
        obj(g, "m003", 1);
        const shop = bySignNear("Mama Ladi Provisions");
        const t = W(frontOf(shop, 1.6), "Mama Ladi Provisions");
        aim(g, t);
        if (g.place !== "world") await g.reach({ pos: frontOf(hall(g.ctx.female), 2.4), where: "world" }, 4);
        await maybeOkada(g, W(frontOf(shop, 4)), inYaw(shop));
        await g.reach(t, 2.4);
        await g.use("kit", "Buy rice, tomato, pepper, onions (₦1,500)", () => t, 2.4, 3);
        g.progress.money = Math.max(0, g.progress.money - 1500);
        g.ui.setMoney(g.progress.money);
        addItem(g.progress, "jollof_kit");
        g.ui.showCard("Item", "Jollof kit", "And a stock cube, because you are not an animal.", [], 2600);
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport({ pos: g.at("kitchen_door", "hostel"), where: "hostel" }, PI);
        g.hours = 19.2;
      },
      run: async (g) => {
        obj(g, "m003", 2);
        const k: Target = { pos: g.at("kitchen_counter", "hostel"), where: "hostel", label: "the kitchen" };
        aim(g, k);
        await maybeOkada(g, W(frontOf(hall(g.ctx.female), 4)), inYaw(hall(g.ctx.female)));
        await g.reach(k, 1.6);
        g.put(ROOMIE, { pos: g.at("kitchen_stool_a", "hostel"), where: "hostel" }, PI, "sit");
        g.crowd([{ n: 4, x: -11.6, z: -4.1, hx: 0.6, hz: 0.6, face: PI / 2 }, { n: 3, x: -8.2, z: -4.3, hx: 0.5, hz: 0.5, face: -PI / 2 }], "hostel");
        g.hours = Math.max(g.hours, 19.4);
        await g.minigame(() => g.mini.timing({ title: "Cook jollof", text: "Chop. Fry the tomato till it stops shouting. Time the stir.", beats: 4, stopAfter: 2, zone: [0.38, 0.62] }));
        g.clearCrowd();
        // 19:40: NEPA takes the light.
        await g.cutscene("cut_m003_mid_1");
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport({ pos: g.at("kitchen_counter", "hostel"), where: "hostel" }, PI);
        g.light("torch");
        g.hours = 19.8;
      },
      run: async (g) => {
        obj(g, "m003", 3);
        g.light("torch");
        for (;;) {
          const w = await g.ask("Soaked garri. The water:", ["Cold water", "Hot water"]);
          if (w === 0) break;
          g.bark(ROOMIE, "wip_m003_garri_01", "STOP. Hot water? That is eba. I said cold. Again.", "sharp");
          await g.sleep(2.6);
        }
        await g.minigame(() => g.mini.timing({ title: "Soak the garri", text: "Cold water, sugar, groundnut if you are rich. Stir, don't drown it.", beats: 3, zone: [0.32, 0.68], speed: 0.9 }));
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport({ pos: g.at("kitchen_counter", "hostel"), where: "hostel" }, PI);
        g.light("torch");
        g.hours = 20.0;
      },
      run: async (g) => {
        obj(g, "m003", 4);
        g.light("torch");
        const sugar: Target = { pos: g.at("sugar_shelf", "hostel"), where: "hostel", label: "your room" };
        aim(g, sugar);
        await g.reach(sugar, 1.4);
        await g.use("sugar", "Take the sugar", () => sugar, 1.6, 3);
        addItem(g.progress, "sugar");
        g.sfxs.play("pickup");
        // Back down the corridor: at the far end the dark is thicker than dark should be.
        await g.reach({ pos: g.at("room_door", "hostel"), where: "hostel" }, 1.3);
        await g.cutscene("cut_m003_mid_2");
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport({ pos: g.at("idris_door", "hostel"), where: "hostel" }, 0);
        g.light("torch");
        g.hours = 20.4;
      },
      run: async (g) => {
        obj(g, "m003", 5);
        g.light("torch");
        g.put("npc.idris", { pos: [g.at("idris_door", "hostel")[0], 0, g.at("idris_door", "hostel")[2] + 2.2], where: "hostel" }, PI);
        await g.talk("npc.idris", "Knock: \"We have garri.\"", 2.6);
        g.bark("player", "wip_m003_idris_p01", "We have garri.", "warm");
        await g.sleep(2.2);
        g.bark("npc.idris", "wip_m003_idris_01", "…Really? For me too?", "shy");
        await g.sleep(2.4);
        // Escort: Idris follows you to the kitchen (he waits if you go too fast).
        const idris = g.npc("npc.idris")!;
        const kitchen: Target = { pos: g.at("kitchen_circle", "hostel"), where: "hostel", label: "the kitchen" };
        aim(g, kitchen);
        const following = g.escort(idris, 1.1, 2.8);
        try {
          await g.reach(kitchen, 2.2);
        } finally {
          following.stop();
        }
        await g.cutscene("cut_m003_close");
        g.light("day");
        g.hours = 22.9;
      },
    },
  ],
};

/* ====================================================================== M4 */

const m004: MissionDef = {
  id: "m004",
  hour: 8.0,
  calendar: "Fri · Week 2 · Matriculation",
  start: () => W(frontOf(B.needle, 5), "Alhaji Needle Tailoring"),
  reward: (p) => {
    addItem(p, "matric_photo");
    p.stats.charm += 1;
    p.journal.contacts.push("Mubarak", "Lyzzy", "Lily", "Maryam");
    p.clues.push("MS-03", "C-PHOTO");
    return ["Matric photograph (photo mode)", "+ Charm", "Mubarak's number", "Contacts: Lyzzy, Lily, Maryam"];
  },
  steps: [
    {
      n: 1,
      setup: (g) => {
        g.teleport(W(frontOf(B.needle, 5)), inYaw(B.needle));
        g.hours = 8.0;
      },
      run: async (g) => {
        obj(g, "m004", 1);
        g.put("npc.needle", W(g.at("needle_spot")), outYaw(B.needle) - 0.3, "sit");
        aim(g, W(g.at("needle_spot")));
        await g.talk("npc.needle", "Ask for your gown");
        await g.cutscene("cut_m004_open");
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport({ pos: g.at("sug_hall_table", "sug"), where: "sug" }, PI);
        g.hours = 8.4;
      },
      run: async (g) => {
        obj(g, "m004", 2);
        g.put("npc.mubarak", { pos: g.at("mubarak_hall", "sug"), where: "sug" }, 0);
        const r = await g.minigame(() => g.mini.bargain({ seller: "Mubarak", item: "A premium matric gown (rental)", start: 800, floor: 300, charm: g.progress.stats.charm }));
        g.progress.money = Math.max(0, g.progress.money - r.price);
        g.ui.setMoney(g.progress.money);
        g.progress.flags.gown_price = r.price;
        g.showPropPublic("prop.gown_huge", true);
        g.bark("npc.mubarak", "wip_m004_gown_01", `₦${r.price}. Premium. Don't look down.`, "proud");
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport(W(frontOf(B.spot, 3)), outYaw(B.spot));
        g.showPropPublic("prop.gown_huge", true);
        g.hours = 8.7;
      },
      run: async (g) => {
        obj(g, "m004", 3);
        g.put("npc.lily", W(g.at("lily_spot")), PI);
        const lily = W(g.at("lily_spot"), "the gate flowers");
        aim(g, lily);
        g.bark("npc.gate_guard", "wip_m004_guard_01", "Ha! Fresher, is that a gown or a tent? …Sorry. Ha!", "amused");
        await maybeOkada(g, W([16, 0, -54]), PI, 100);
        await g.talk("npc.lily", "Ask the girl watering the flowers");
        g.player.person.act("stand");
        await g.barks([["npc.lily", "wip_m004_lily_01", "…Hold still.", "shy"], ["npc.lily", "wip_m004_lily_02", "It will be windy at ten.", "shy"]]);
        addItem(g.progress, "safety_pins");
        g.sfxs.play("pickup");
        if (g.ctx.specials.madison) {
          g.put("special.madison", W([18.4, 0, -51.2]), PI);
          await g.barks([
            ["special.madison", "m004_play_d01", "Aiya! That's not a gown, that's a tent. I love it. Don't move.", "excited"],
            ["special.madison", "m004_play_d02", "Wait wait wait, film this. Okay: knot. Shoulder. Attitude.", "excited"],
            ["special.madison", "m004_play_d03", "It's not too big, it's oversized. Different word, different price.", "amused"],
          ]);
          g.ui.showCard("Trend Setter", "A look", "Madison knotted the spare cloth over one shoulder. Half the back row copies it.", ["+ Charm today"], 3200);
          g.progress.stats.charm += 1;
        } else {
          g.put("npc.maryam", W(g.at("maryam_spot")), inYaw(B.bookshop) + PI);
          const shop = W(g.at("bookshop"), "Campus Books & Stationery");
          aim(g, shop);
          await maybeOkada(g, W(frontOf(B.bookshop, 4)), inYaw(B.bookshop), 100);
          await g.talk("npc.maryam", "Ask the girl at the bookshop door");
          await g.barks([
            ["npc.maryam", "wip_m004_maryam_01", "Here. My belt. Have you read anything good?", "warm"],
            ["player", "wip_m004_maryam_p01", "The fee notice.", "dry"],
            ["npc.maryam", "wip_m004_maryam_02", "Ha! That's a tragedy in three parts.", "amused"],
          ]);
        }
        addItem(g.progress, "belt");
        g.showPropPublic("prop.gown_belted", true);
        g.ui.showCard("Outfit", "Gown: fixed", "Pinned at the hem, belted at the waist. Charm changes how people answer you.", [], 3000);
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport(W([-60, 0, -171]), -PI / 2);
        g.showPropPublic("prop.gown_belted", true);
        g.hours = 9.6;
      },
      run: async (g) => {
        obj(g, "m004", 4);
        const lawn = W(g.at("lawn_row"), "the theatre lawn");
        aim(g, lawn);
        await maybeOkada(g, W([-60, 0, -171]), -PI / 2, 150);
        if (g.hours < 9.5) g.hours = 9.5;
        await g.reach(lawn, 3);
        if (g.hours > 10.05) g.progress.flags.matric_late = true;
        g.hours = 10.0;
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport(W(g.at("lawn_row")), 0);
        g.showPropPublic("prop.gown_belted", true);
        g.hours = 10.0;
      },
      run: async (g) => {
        await g.cutscene("cut_m004_mid_1");
      },
    },
    {
      n: 6,
      setup: (g) => {
        g.teleport(W(g.at("lawn_row")), 0);
        g.hours = 10.5;
      },
      run: async (g) => {
        obj(g, "m004", 6);
        g.showPropPublic("prop.gown_huge", false);
        g.put("npc.lyzzy", W([-77.0, 0, -166.6]), -PI / 2 + 0.3);
        aim(g, W([-77.0, 0, -166.6]));
        await g.talk("npc.lyzzy", "Ask Lyzzy to see the photo");
        await g.cutscene("cut_m004_close");
      },
    },
  ],
};

/* ====================================================================== M5 */

const m005: MissionDef = {
  id: "m005",
  hour: 7.66,
  calendar: "Mon · Week 3 · Lecture day",
  start: (g) => W(frontOf(hall(g.ctx.female), 4), "outside your hall"),
  reward: (p) => {
    addItem(p, "timetable");
    addItem(p, "lab_pass");
    p.journal.contacts.push("Shamsu", "Nusaiba");
    p.clues.push("C-PAGE41", "C-SEVENTH", "C-SNITCH");
    return [`+ Smarts`, "The timetable", "The lab pass", "Contacts: Shamsu, Nusaiba"];
  },
  steps: [
    {
      n: 1,
      setup: (g) => {
        g.teleport(W(frontOf(hall(g.ctx.female), 4)), outYaw(hall(g.ctx.female)));
        g.hours = 7.7;
      },
      run: async (g) => {
        obj(g, "m005", 1);
        // The signs are swapped by tradition: the theatre you choose with confidence is the wrong one.
        const door = W(frontOf(B.yamma, 4.6), "the theatre with EEE 101 on the notice");
        aim(g, door);
        await maybeOkada(g, W(frontOf(B.yamma, 9)), inYaw(B.yamma), 100);
        await g.reach({ pos: g.at("aisle_door", "yamma"), where: "yamma" }, 3);
        g.hours = 8.05;
        await g.cutscene("cut_m005_open");
        if (g.ctx.specials.jiya) g.bark("special.jiya", "m005_play_j01", "A cake. Right. He's not wrong about some of the case law.", "amused");
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport(W(frontOf(B.yamma, 6)), outYaw(B.yamma));
        g.hours = 8.1;
      },
      run: async (g) => {
        obj(g, "m005", 2);
        const t: Target = { pos: g.at("aisle_door", "gabas"), where: "gabas", label: "Theatre Gabas" };
        aim(g, t);
        await g.reach(t, 3);
        g.hours = 8.13;
        await g.cutscene("cut_m005_mid_1");
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport({ pos: g.at("row6_seat", "gabas"), where: "gabas" }, PI);
        g.hours = 8.3;
      },
      run: async (g) => {
        obj(g, "m005", 3);
        g.player.person.act("sit");
        g.put("npc.okonkwo", { pos: g.at("stage_spot", "gabas"), where: "gabas" }, 0);
        g.put("npc.shamsu", { pos: g.at("row6_seat_b", "gabas"), where: "gabas" }, PI, "sit");
        g.put("npc.nusaiba", { pos: g.at("row3_seat_b", "gabas"), where: "gabas" }, PI, "sit");
        const r = await g.minigame(() => g.mini.lecture());
        const gain = r.score < 0.3 ? 1 : r.score < 0.7 ? 2 : 3;
        g.progress.stats.smarts += gain;
        if (r.score < 0.3) g.bark("npc.shamsu", "wip_m005_notes_01", "Simple. Take my notes. In sha Allah, you will pass.", "warm");
        g.ui.showCard("Lecture", `Smarts +${gain}`, r.score < 0.3 ? "Shamsu lends you his notes." : "Dr. Okonkwo almost smiles.", [], 2800);
        await g.sleep(1.6);
        g.bark("npc.okonkwo", "wip_m005_fuse_01", "The demonstration board needs a fuse. The late one may fetch it. From the lab.", "dry");
        g.player.person.act("stand");
        await g.sleep(3);
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport({ pos: g.at("aisle_door", "gabas"), where: "gabas" }, 0);
        g.hours = 9.4;
      },
      run: async (g) => {
        obj(g, "m005", 4);
        g.clearCast();
        g.put("npc.abbas", { pos: g.at("abbas_spot", "lab"), where: "lab" }, PI);
        g.put("npc.wednesday", { pos: g.at("wednesday_spot", "lab"), where: "lab" }, 0);
        const ab: Target = { pos: g.at("abbas_spot", "lab"), where: "lab", label: "the electrical lab" };
        aim(g, ab);
        await g.reach(ab, 3);
        g.bark("crowd.students", "wip_m005_jc_01", "John Carter! Fix your face!", "amused");
        await g.sleep(1.8);
        await g.talk("npc.abbas", "Ask for a fuse");
        await g.barks([["npc.abbas", "wip_m005_abbas_01", "My name is Abbas. The fuses are in the drawer. Under the logbook.", "neutral"]]);
        const drawer: Target = { pos: g.at("fuse_drawer", "lab"), where: "lab", label: "the fuse drawer" };
        aim(g, drawer);
        await g.use("fuse", "Take a 13 A fuse", () => drawer, 1.8, 3);
        addItem(g.progress, "fuse_13a");
        g.sfxs.play("pickup");
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport({ pos: g.at("fuse_drawer", "lab"), where: "lab" }, -PI / 2);
        g.hours = 9.55;
      },
      run: async (g) => {
        obj(g, "m005", 5);
        const book: Target = { pos: g.at("logbook_stand", "lab"), where: "lab", label: "the logbook" };
        aim(g, book);
        await g.use("logbook", "Look at the logbook", () => book, 1.8, 3);
        await g.cutscene("cut_m005_close");
      },
    },
    {
      n: 6,
      setup: (g) => {
        g.teleport({ pos: g.at("logbook_stand", "lab"), where: "lab" }, 0);
        g.hours = 9.75;
      },
      run: async (g) => {
        obj(g, "m005", 6);
        g.clearCast();
        g.put("npc.okonkwo", { pos: g.at("stage_spot", "gabas"), where: "gabas" }, 0);
        const ok: Target = { pos: g.at("stage_spot", "gabas"), where: "gabas", label: "Dr. Okonkwo" };
        aim(g, ok);
        await g.reach(ok, 4);
        await g.talk("npc.okonkwo", "Give Dr. Okonkwo the fuse", 2.6);
        addItem(g.progress, "fuse_13a", -1);
        g.bark("npc.okonkwo", "wip_m005_fuse_02", "Thank you. Sit in front on Wednesday.", "dry");
        await g.sleep(2.6);
      },
    },
  ],
};

/* ====================================================================== M6 */

const m006: MissionDef = {
  id: "m006",
  hour: 19.0,
  calendar: "Thu · Week 3 · Evening",
  start: (g) => W(g.at("mai_shayi_bench"), "Mai Shayi's bench"),
  reward: (p) => {
    p.journal.legends.push("The corridor that cries", "The lecturer who never ages", "The okada at 3 a.m.");
    addItem(p, "garden_fast_travel");
    p.clues.push("C-BENCH", "C-STATUE", "C-TANKO", "C-CATS");
    return ["Three legends in the journal", "Garden fast-travel point", "Mai Shayi's bench: nightly gist"];
  },
  steps: [
    {
      n: 1,
      setup: (g) => {
        g.teleport(W([-97, 0, -97]), PI);
        g.hours = 19.1;
      },
      run: async (g) => {
        obj(g, "m006", 1);
        g.put("npc.mai_shayi", W(g.at("shayi_spot")), 0, "sit");
        g.put(ROOMIE, W([-94.2, 0, -101.2]), PI);
        aim(g, W(g.at("shayi_spot")));
        await g.talk("npc.mai_shayi", "Show Mai Shayi the note");
      },
    },
    {
      n: 2,
      run: async (g) => {
        await g.cutscene("cut_m006_open");
        g.ui.showCard("Journal", "Three legends", "A corridor that cries · A lecturer who never ages · An okada at 3 a.m.", [], 3600);
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport(W([-95.6, 0, -101.8]), PI);
        g.hours = 20.0;
      },
      run: async (g) => {
        obj(g, "m006", 3);
        g.put("npc.mai_shayi", W(g.at("shayi_spot")), 0, "sit");
        const pond = W(g.at("sculpture_garden_pond"), "the Sculpture Garden");
        aim(g, pond);
        await g.reach(pond, 3);
        g.bark(ROOMIE, "wip_m006_garden_01", "Forty stone people waiting for a bus. Don't look at them too long.", "whisper");
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport(W(g.at("sculpture_garden_pond")), PI);
        g.hours = 20.2;
      },
      run: async (g) => {
        obj(g, "m006", 4);
        g.showPropPublic("prop.cats_ring", true);
        g.put("npc.maker", W(g.at("maker_crate")), PI, "sit");
        g.put("npc.tanko", W(g.at("tanko_spot")), 0.3);
        if (g.ctx.specials.taty) {
          g.put("special.taty", W([-69.6, 0, -229.4]), -PI / 2);
        }
        const gate = W(g.at("garden_gate_outside"), "the Engineering Garden");
        aim(g, gate);
        await g.reach(gate, 3);
        g.sfxs.play("coil_hum_low");
        if (g.ctx.specials.taty) {
          await g.barks([
            ["special.taty", "m006_play_t01", "Pixel. Pixel! We live together. You can't just join a cult.", "amused"],
            ["special.taty", "m006_play_t02", "They do this every evening. Nobody knows why. Pixel won't say.", "neutral"],
          ]);
        }
        const maker: Target = { pos: [-76.6, 0, -230.8], where: "world", label: "the Maker" };
        aim(g, maker);
        await g.talk("npc.maker", "Greet the Maker (don't touch the fence)", 2.6);
        await g.cutscene("cut_m006_mid_1");
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport(W(g.at("garden_gate_outside")), PI);
        g.showPropPublic("prop.cats_ring", true);
        g.hours = 20.9;
      },
      run: async (g) => {
        obj(g, "m006", 5);
        g.put("npc.tanko", W(g.at("tanko_spot")), 0.3);
        g.put(ROOMIE, W([-76.4, 0, -237.0]), PI);
        aim(g, W(g.at("tanko_spot")));
        await g.talk("npc.tanko", "Listen to the man by the gate");
        // The close plays Tanko's riddle, then the walk home past the pond (step 6 ends with it).
        obj(g, "m006", 6);
        await g.cutscene("cut_m006_close");
      },
    },
  ],
};

/* ====================================================================== M7 */

const m007: MissionDef = {
  id: "m007",
  hour: 16.0,
  calendar: "Sat · Week 4 · Market day",
  start: () => W([-96, 0, -60], "the basketball court"),
  reward: (p) => {
    addItem(p, "hassan_receipt");
    p.flags.court_known = true;
    p.clues.push("C-SYMBOL");
    return ["Hassan's receipt (collectible)", "The court, as a place", "Reputation: you stood your ground (or you didn't)"];
  },
  steps: [
    {
      n: 1,
      setup: (g) => {
        g.teleport(W([-96, 0, -60]), PI / 2);
        g.hours = 16.0;
      },
      run: async (g) => {
        obj(g, "m007", 1);
        g.put(ROOMIE, W([-97.4, 0, -61.2]), PI / 2);
        g.put("npc.bolaji", W(g.at("sly_spot")), -PI / 2);
        g.put("npc.hassan", W(g.at("hassan_spot")), -PI / 2);
        const c = W(g.at("court_centre"), "the court");
        aim(g, c);
        await g.reach({ pos: [-90.6, 0, -57.6], where: "world" }, 2.6);
        await g.cutscene("cut_m007_open");
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport(W(g.at("court_centre")), PI / 2);
        g.put("npc.bolaji", W(g.at("sly_spot")), -PI / 2);
        g.hours = 16.1;
      },
      run: async (g) => {
        obj(g, "m007", 2);
        const c = await g.ask("\"Sly is wondering if the fresher has noticed the toll.\" ₦200.", ["Pay the ₦200", "Bargain", "Refuse"]);
        g.progress.flags.m007_tax = ["pay", "bargain", "refuse"][c]!;
        if (c === 0) {
          g.progress.money = Math.max(0, g.progress.money - 200);
          g.ui.setMoney(g.progress.money);
          g.bark("npc.hassan", "wip_m007_receipt_01", "Receipt. Court maintenance. That's a ball.", "bored");
          await g.sleep(2.6);
        } else if (c === 1) {
          obj(g, "m007", 3);
          if (g.ctx.specials.jiya) {
            g.put("special.jiya", W([-79.2, 0, -63.6]), PI);
            await g.barks([
              ["special.jiya", "m007_play_j01", "Sorry, quick question. Is this a levy, a toll or a donation?", "dry"],
              ["special.jiya", "m007_play_j02", "Because a levy needs a by-law, a toll needs a road, and a donation needs consent.", "dry"],
              ["special.jiya", "m007_play_j03", "So what we have here is a large man standing near money. Which is not a legal category.", "dry"],
              ["special.jiya", "m007_play_j04", "Lovely receipts, though. Who drew the ball?", "amused"],
            ]);
            g.ui.showCard("Objection!", "Toll: ₦0", "Legal Immunity, shown working.", [], 2800);
          } else {
            const r = await g.minigame(() => g.mini.bargain({ seller: "Big Sly", item: "The court toll", start: 200, floor: 50, charm: g.progress.stats.charm }));
            if (r.price <= 60) {
              g.bark(ROOMIE, "wip_m007_riddle_01", "Riddle: what has a court but no judge? …This place. Fifty and a riddle.", "amused");
              await g.sleep(3);
            }
            g.progress.money = Math.max(0, g.progress.money - r.price);
            g.ui.setMoney(g.progress.money);
          }
        } else {
          obj(g, "m007", 4);
          const sly = g.npc("npc.bolaji")!;
          // Face each other for the fight.
          const pp = g.player.person.root.getPosition();
          const sp = sly.root.getPosition();
          g.player.person.root.setLocalEulerAngles(0, Math.atan2(sp.x - pp.x, sp.z - pp.z) * 180 / Math.PI, 0);
          sly.root.setLocalEulerAngles(0, Math.atan2(pp.x - sp.x, pp.z - sp.z) * 180 / Math.PI, 0);
          g.fight("npc.bolaji");
          // Wait for the fight to end.
          while (g.combat!.state === "active") {
            await g.sleep(0.1);
          }
          g.endFight();
          g.progress.stats.strength += 1;
          g.progress.flags.scuffle_knocks = 0;
          // A guard arrives to fine you for fighting.
          if (g.ctx.specials.jiya) {
            g.put("special.jiya", W([-79.2, 0, -63.6]), PI);
            g.bark("special.jiya", "m007_play_j05", "He was pushed, officer. Gravity isn't an offence. I've checked.", "dry");
            await g.sleep(3.4);
          }
          g.player.person.act("sit");
        }
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport(W([-81.6, 0, -57.2]), PI / 2);
        g.hours = 16.3;
      },
      run: async (g) => {
        obj(g, "m007", 5);
        await g.cutscene("cut_m007_close");
        g.clearCast();
      },
    },
    {
      n: 6,
      setup: (g) => {
        g.teleport(W(g.at("court_centre")), PI / 2);
        g.hours = 16.6;
      },
      run: async (g) => {
        obj(g, "m007", 6);
        const c = W([-79.0, 0, -57.2], "the centre circle");
        aim(g, c);
        const i = await Promise.race([
          g.use("circle", "Look at the centre circle", () => c, 2.2, 3).then(() => 0),
          g.reach(W([-60, 0, -52]), 3).then(() => 1),
        ]);
        if (i === 0) {
          g.player.person.act("kneel");
          g.ui.showCard("Journal", "The symbol, again", "Under years of paint: six dots in a ring, a seventh in the middle. Not a coincidence any more.", [], 4200);
          g.progress.journal.entries.push("Court: the symbol");
          await g.sleep(3);
          g.player.person.act("stand");
        }
      },
    },
  ],
};

/* ====================================================================== M8 */

const PITCH_LAP: A3[] = [[-186, 0, -203], [-134, 0, -203], [-134, 0, -227], [-186, 0, -227]];

const m008: MissionDef = {
  id: "m008",
  hour: 16.9,
  calendar: "Tue · Week 5 · 17:00 · Football hour",
  start: (g) => W(g.at("sports_gate"), "the training pitch"),
  reward: (p) => {
    p.rel["npc.jega"] = Math.max(1, p.rel["npc.jega"] ?? 0);
    p.flags.football_unlocked = true;
    p.stats.stamina += 1;
    addItem(p, "bib");
    p.clues.push("C-GOAT", "C-IDK");
    return ["Jega's friendship (tier 1)", "Football: a daily activity", "+ Stamina", "The bib"];
  },
  steps: [
    {
      n: 1,
      setup: (g) => {
        g.teleport(W(g.at("sports_gate")), -PI / 2);
        g.hours = 16.9;
      },
      run: async (g) => {
        obj(g, "m008", 1);
        const p = W([-160.6, 0, -210.6], "the training pitch");
        aim(g, p);
        await g.reach(p, 6);
        if (g.hours > 17.1) g.progress.flags.m008_late = true;
        g.hours = 17.0;
        await g.cutscene("cut_m008_open");
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport(W([-160.6, 0, -210.6]), PI);
        g.hours = 17.05;
      },
      run: async (g) => {
        obj(g, "m008", 2);
        const taty = g.ctx.specials.taty;
        if (taty) {
          g.put("special.taty", W([-182, 0, -203]), PI / 2);
          g.bark("special.taty", "m008_play_t01", "Bora! One lap. Easy lap. Baby lap.", "excited");
        } else {
          g.put("npc.danladi", W(g.at("coach_spot")), PI);
          g.sfxs.play("whistle");
          g.bark("npc.danladi", "wip_m008_warm_01", "Half a lap! Then we talk!", "stern");
        }
        const pts = taty ? [...PITCH_LAP, PITCH_LAP[0]!] : PITCH_LAP.slice(0, 3);
        for (let i = 0; i < pts.length; i++) {
          const t = W(pts[i]!, `lap ${i + 1}/${pts.length}`);
          aim(g, t);
          await g.reach(t, 3.5);
          if (taty && i === 1) g.bark("special.taty", "m008_play_t02", "I lied. Two.", "amused");
          if (taty && i === 3) g.bark("special.taty", "m008_play_t03", "You're not dying. I've seen dying. This is Tuesday.", "amused");
        }
        if (taty) {
          g.ui.showCard("Never Tired", "Stamina bonus", "Running beside Taty rubs off on you, for the rest of the evening.", [], 2600);
          g.stamina = 1;
        }
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport(W([-160.6, 0, -210.6]), PI);
        g.hours = 17.2;
      },
      run: async (g) => {
        obj(g, "m008", 3);
        const jega = g.put("npc.jega", W([-160.4, 0, -218.6]), 0)!;
        g.teleport(W([-160.4, 0, -210.6]), PI);
        let good = 0;
        while (good < 5) {
          const r = await g.minigame(() => g.mini.timing({ title: "Passing drill with Jega", text: "Short passes. Weight it right: in the green.", beats: 5 - good, zone: [0.36, 0.64], need: 5 - good, onBeat: (_i, ok) => {
            g.player.person.act("punch");
            g.sfxs.play("kick");
            if (ok) jega.act("nod");
          } }));
          good += r.good;
          if (good < 5) g.bark("npc.jega", "wip_m008_pass_01", "Haba, not there, there is nobody there. Pass to a person. Again.", "amused");
          else g.bark("npc.jega", "wip_m008_pass_02", "Yauwa! Good. Again… no, that was enough. Good.", "excited");
          await g.sleep(1.5);
        }
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport(W([-178, 0, -215]), -PI / 2);
        g.hours = 17.35;
      },
      run: async (g) => {
        obj(g, "m008", 4);
        g.teleport(W([-178, 0, -215]), -PI / 2);
        for (;;) {
          const r = await g.minigame(() => g.mini.timing({ title: "Shooting drill", text: "Five shots. Two in the net. Aim low, hit through it.", beats: 5, zone: [0.44, 0.58], speed: 1.35, need: 2, onBeat: () => {
            g.player.person.act("punch");
            g.sfxs.play("kick");
          } }));
          if (r.good >= 2) break;
          g.bark("npc.danladi", "wip_m008_shoot_01", "Is the goal your enemy? Again!", "stern");
          await g.sleep(1.4);
        }
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport(W([-160.6, 0, -210.6]), PI);
        g.hours = 17.5;
      },
      run: async (g) => {
        obj(g, "m008", 5);
        // The scrimmage (shortened from three minutes: a run of passing moments in the match).
        g.crowd([{ n: 8, x: -160, z: -215, hx: 18, hz: 9, face: PI / 2 }], "world");
        g.put("npc.shamsu", W([-170, 0, -212]), -PI / 2);
        g.put("npc.jega", W([-150, 0, -216]), -PI / 2);
        const r = await g.minigame(() => g.mini.timing({ title: "Scrimmage", text: "Find Jega. Find space. Pass to a person.", beats: 6, zone: [0.34, 0.66], onBeat: () => g.sfxs.play("kick") }));
        g.progress.flags.scrimmage_passes = r.good;
        g.clearCrowd();
        await g.cutscene("cut_m008_mid_1");
      },
    },
    {
      n: 6,
      setup: (g) => {
        g.teleport(W([-187, 0, -228.6]), 0.6);
        g.hours = 17.9;
      },
      run: async (g) => {
        obj(g, "m008", 6);
        const corner = W([-187.6, 0, -229.2], "the corner flag");
        aim(g, corner);
        await g.reach(corner, 3);
        g.put("npc.jega", W([-183, 0, -217]), PI);
        let scored = false;
        for (let attempt = 0; attempt < 2 && !scored; attempt++) {
          const r = await g.minigame(() => g.mini.timing({ title: "Take the corner", text: "One cross. Jega is waiting. He will head anything.", beats: 1, zone: [0.42, 0.6], speed: 1.2 }));
          scored = r.good === 1;
          if (!scored && attempt === 0) g.bark("npc.jega", "wip_m008_corner_01", "Again! Mu sake!", "excited");
        }
        g.npc("npc.jega")!.act("cheer");
        g.ui.showCard("GOAL", scored ? "Jega, from your corner" : "Jega, from open play", "Your side wins.", [], 2600);
        g.sfxs.play("whistle");
        await g.sleep(2.6);
      },
    },
    {
      n: 7,
      setup: (g) => {
        g.teleport(W([-160.6, 0, -229.2]), 0);
        g.hours = 18.2;
      },
      run: async (g) => {
        obj(g, "m008", 7);
        g.put("npc.jega", W([-159.4, 0, -229.6]), PI / 2);
        g.put("npc.helen", W(g.at("helen_spot")), PI, "write");
        await g.talk("npc.jega", "Talk to Jega");
        await g.cutscene("cut_m008_close");
      },
    },
  ],
};

/* ====================================================================== M9 */

const m009: MissionDef = {
  id: "m009",
  hour: 20.2,
  calendar: "Wed · Week 5 · Night",
  start: () => W([-176, 0, -219], "the pitch, under one floodlight"),
  reward: (p) => {
    p.journal.contacts.push("Dr. Z, do NOT call for nonsense");
    p.stats.health += 2;
    p.rel["npc.jega"] = Math.max(2, p.rel["npc.jega"] ?? 0);
    addItem(p, "paracetamol", 2);
    p.flags.hospital_unlocked = true;
    p.clues.push("C-BENCH", "C-AWAY");
    return ["Dr. Zainab in your contacts", "+ Health (max)", "The hospital unlocked", "Jega's friendship (tier 2)"];
  },
  steps: [
    {
      n: 0,
      setup: (g) => {
        g.teleport(W([-176, 0, -219]), -PI / 2);
        g.hours = 20.4;
        g.light("night");
      },
      run: async (g) => {
        g.light("night");
        await g.cutscene("cut_m009_open");
      },
    },
    {
      n: 1,
      setup: (g) => {
        g.teleport(W([-185.6, 0, -213]), -PI / 2);
        g.hours = 20.5;
      },
      run: async (g) => {
        obj(g, "m009", 1);
        const jega = g.put("npc.jega", W([-187.4, 0, -212.4]), PI / 2)!;
        const gate = W(g.at("sports_gate"), "the sports gate (keke)");
        aim(g, gate);
        g.keke.enabled = true;
        const kp = g.at("sports_gate");
        g.keke.setPosition(kp[0] + 3, 0.1, kp[2] - 1.6);
        g.keke.setEulerAngles(0, 90, 0);
        // Escort: Jega follows you, holding a football sock to his head.
        g.bark("npc.jega", "wip_m009_sock_01", "Ba matsala. I'll just hold this sock here. For style.", "amused");
        const following = g.escort(jega, 1.2, 2.6);
        try {
          await g.reach(gate, 4.5);
        } finally {
          following.stop();
        }
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport(W(g.at("sports_gate")), PI / 2);
        g.hours = 20.6;
      },
      run: async (g) => {
        obj(g, "m009", 2);
        const jega = g.npc("npc.jega")!;
        jega.visible = true;
        g.ui.showCard("Keke", "Your turn to drive", "Drive the keke to the hospital. Jega rides with you.", [], 2400);
        void g.barks([["npc.jega", "wip_m009_keke_01", "You drive, I hold the sock. Don't crash.", "amused"]]);
        g.put("npc.jega", { pos: [-128.6, 0, -189.4], where: "world" }, -PI / 2);
        await g.drive({ pos: [99.4, 0, -82.6], where: "world" }, "keke");
        g.teleport(W(g.at("ae_entrance")), PI / 2);
        jega.place(98.6, 0, -82.4, PI / 2);
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport(W(g.at("ae_entrance")), PI / 2);
        g.hours = 20.7;
      },
      run: async (g) => {
        obj(g, "m009", 3);
        g.put("npc.jega", { pos: g.at("jega_waiting", "ae"), where: "ae" }, PI / 2, "sit");
        g.put("npc.hauwa", { pos: g.at("hauwa_spot", "ae"), where: "ae" }, 0);
        const desk: Target = { pos: g.at("hauwa_spot", "ae"), where: "ae", label: "Nurse Hauwa" };
        aim(g, desk);
        await g.reach(desk, 3.6);
        await g.talk("npc.hauwa", "Report to the nurse", 2.8);
        await g.cutscene("cut_m009_mid_1");
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport({ pos: g.at("ae_bay_bedside", "ae"), where: "ae" }, PI);
        g.light("torch");
        g.hours = 21.0;
      },
      run: async (g) => {
        obj(g, "m009", 4);
        g.light("torch");
        g.put("npc.jega", { pos: g.at("jega_bed", "ae"), where: "ae" }, PI / 2, "sit");
        g.put("npc.zainab", { pos: g.at("zainab_spot", "ae"), where: "ae" }, PI / 2 + 0.4);
        g.player.person.act("hold_torch");
        const r = await g.minigame(() => g.mini.steady(4));
        g.progress.flags.stitch_retries = r.retries;
        g.sfxs.play("light_back");
        g.light("night");
        g.player.person.act("stand");
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport({ pos: g.at("ae_bay_bedside", "ae"), where: "ae" }, PI);
        g.light("night");
        g.hours = 22.3;
      },
      run: async (g) => {
        obj(g, "m009", 5);
        g.put("npc.zainab", { pos: g.at("zainab_chair", "ae"), where: "ae" }, -PI / 2 + 0.3);
        await g.talk("npc.zainab", "Take the prescription", 2.4);
        // Step 6, "Look out of the window", is the last shot of this scene.
        obj(g, "m009", 6);
        await g.cutscene("cut_m009_close");
      },
    },
  ],
};

/* ====================================================================== M10 */

const m010: MissionDef = {
  id: "m010",
  hour: 10.9,
  calendar: "Sat · Week 5 · Late morning",
  start: () => W(frontOf(B.spot, 3.5), "the Student Union"),
  reward: (p) => {
    p.flags.plug_store_unlocked = true;
    p.journal.contacts.push("Hajiya Ladi");
    p.clues.push("C-KB");
    return ["The Plug Store unlocked", "One free Zobo Max", "₦1,000", "Hajiya Ladi's acquaintance"];
  },
  steps: [
    {
      n: 1,
      setup: (g) => {
        g.teleport(W(frontOf(B.spot, 3.5)), inYaw(B.spot));
        g.hours = 11.0;
      },
      run: async (g) => {
        obj(g, "m010", 1);
        g.ui.showCard("Text from Mubarak", "\"My guy. Business opportunity.\"", "\"SUG basement. Come alone. Bring legs.\"", [], 3600);
        g.sfxs.play("phone_text");
        g.put("npc.mubarak", { pos: g.at("mubarak_locker", "sug"), where: "sug" }, -PI / 2);
        g.plugSign.enabled = true;
        const [ox, oz] = [g.at("mubarak_locker", "sug")[0], g.at("mubarak_locker", "sug")[2]];
        g.plugSign.setPosition(ox - 0.4, 1.35, oz + 0.9);
        g.plugSign.setEulerAngles(0, 180, 0);
        const m: Target = { pos: g.at("locker_row", "sug"), where: "sug", label: "the SUG basement" };
        aim(g, m);
        await g.reach({ pos: g.at("basement_enter", "sug"), where: "sug" }, 2.2);
        await g.cutscene("cut_m010_open");
      },
    },
    {
      n: 2,
      setup: (g) => {
        g.teleport({ pos: g.at("locker_row", "sug"), where: "sug" }, PI / 2);
        g.hours = 11.2;
      },
      run: async (g) => {
        obj(g, "m010", 2);
        g.useBoost("turbo", 90);
        g.ui.showCard("Turbo Sneakers", "+45% speed", "The timer shows how long the feeling lasts.", [], 2600);
        const stall = W(g.at("ladi_stall"), "Hajiya Ladi's stall");
        aim(g, stall);
        await g.reach(stall, 2.6);
        g.boosts.turbo = 0;
      },
    },
    {
      n: 3,
      setup: (g) => {
        g.teleport(W(g.at("ladi_stall")), inYaw(B.ladi));
        g.hours = 11.9;
      },
      run: async (g) => {
        obj(g, "m010", 3);
        await g.cutscene("cut_m010_mid_1");
        g.put("npc.hajiya_ladi", W(g.at("ladi_spot")), outYaw(B.ladi));
        g.put("npc.mubarak", W(g.at("mubarak_market")), inYaw(B.ladi));
        let price: number;
        if (g.ctx.specials.madison) {
          g.put("special.madison", W(frontOf(B.ladi, 1.4, -1.8)), inYaw(B.ladi));
          await g.barks([
            ["special.madison", "m010_play_d01", "Aiya! Tai gui le! (Too expensive!) Hajiya, look at his belt. GUCCY. He's poor.", "excited"],
            ["special.madison", "m010_play_d02", "Okay okay okay, I take six, you give me price for ten. Deal? Deal.", "excited"],
            ["special.madison", "m010_play_d04", "You don't bargain, you beg. I'll teach you. It's free. Today.", "amused"],
          ]);
          price = 1400;
          g.ui.showCard("Trend Setter", "−30%", "Hajiya Ladi offers Madison a job.", [], 2600);
        } else {
          const r = await g.minigame(() => g.mini.bargain({ seller: "Hajiya Ladi", item: "End-of-line stock (two crates)", start: 3000, floor: 1800, charm: g.progress.stats.charm + g.progress.stats.street }));
          price = r.price;
          if (r.price > 2400) g.bark("npc.mubarak", "wip_m010_sigh_01", "Hajiya… (sigh) It's an investment.", "sad");
        }
        g.progress.flags.plug_stock_price = price;
        g.bark("npc.mubarak", "wip_m010_pay_01", "I pay. You carry. That's the business model.", "proud");
      },
    },
    {
      n: 4,
      setup: (g) => {
        g.teleport(W(g.at("ladi_stall")), inYaw(B.ladi));
        g.hours = 12.2;
      },
      run: async (g) => {
        obj(g, "m010", 4);
        await carryCrate(g, "zobo", 120);
      },
    },
    {
      n: 5,
      setup: (g) => {
        g.teleport({ pos: g.at("crate_drop", "sug"), where: "sug" }, PI);
        g.hours = 12.8;
      },
      run: async (g) => {
        obj(g, "m010", 5);
        g.useBoost("kola", 150);
        g.ui.showCard("Lucky Kola", "For the road", "Bins and lockers cough up better things than they should.", [], 2400);
        // Step 6 (optional): KB's corner shop, on the way.
        g.put("npc.kb", W(g.at("kb_spot")), outYaw(B.kb));
        const kb = W(g.at("kb_shop"), "KB's Corner Shop");
        void g.use("kb", "KB's blackboard (optional)", () => kb, 2.4, 2).then(async () => {
          g.ui.insert("kb_board");
          g.bark("npc.kb", "wip_m010_kb_01", "For your face today? ₦300. Batteries? Ah. Batteries are special today.", "amused");
          await g.sleep(3.4);
          g.ui.insert(null);
          const i = await g.ask("Torch batteries, ₦900 each. No reason.", ["Buy two (₦1,800)", "Leave it"]);
          if (i === 0 && g.progress.money >= 1800) {
            g.progress.money -= 1800;
            addItem(g.progress, "battery", 2);
            g.ui.setMoney(g.progress.money);
            g.bark("npc.kb", "wip_m010_kb_02", "Hm. Good. You'll need them.", "neutral");
          }
        }).catch(() => undefined);
        const stall = W(g.at("ladi_stall"), "the market");
        aim(g, stall);
        await g.reach(stall, 2.8);
        await carryCrate(g, "kola", 0);
        if (g.hours > 13.5) {
          g.ui.showCard("Late", "The porter is on the stairs", "Hide the crate behind the chairs.", [], 2600);
          const hide: Target = { pos: g.at("chairs_hide", "sug"), where: "sug", label: "behind the chairs" };
          aim(g, hide);
          await g.reach(hide, 1.6);
        }
      },
    },
    {
      n: 7,
      setup: (g) => {
        g.teleport({ pos: g.at("locker_row", "sug"), where: "sug" }, PI / 2);
        g.hours = 13.4;
      },
      run: async (g) => {
        obj(g, "m010", 7);
        g.put("npc.mubarak", { pos: g.at("mubarak_locker", "sug"), where: "sug" }, PI / 2);
        await g.cutscene("cut_m010_close");
        g.plugSign.enabled = false;
      },
    },
  ],
};

/** Carry a crate from the market to the SUG basement (boost: Zobo Max freezes stamina; Lucky Kola). */
async function carryCrate(g: StoryGame, boost: "zobo" | "kola", secs: number): Promise<void> {
  if (boost === "zobo") {
    g.useBoost("zobo", secs);
    g.ui.showCard("Zobo Max", "Stamina: frozen", "Your stamina bar simply stops going down.", [], 2600);
  }
  g.carrying = true;
  g.crate.enabled = true;
  g.player.person.act("carry");
  g.player.person.root.addChild(g.crate);
  g.crate.setLocalPosition(0, 1.02, 0.34);
  g.crate.setLocalEulerAngles(0, 0, 0);
  const drop: Target = { pos: g.at("crate_drop", "sug"), where: "sug", label: "the SUG basement" };
  aim(g, drop);
  try {
    await g.reach(drop, 1.8);
  } finally {
    g.carrying = false;
    g.app.root.addChild(g.crate);
    g.crate.enabled = false;
    g.player.person.act("stand");
  }
  g.sfxs.play("pickup");
  addItem(g.progress, boost === "zobo" ? "crate_stock" : "crate_stock_2");
}

/** Mum calls (M2 step 3): the phone, the first text, the bank alert. */
async function phoneMum(g: StoryGame): Promise<void> {
  const m = MISSIONS.find((x) => x.key === "m002");
  g.setObjective(`M2 · ${m?.title ?? ""}`, m?.steps.find((s) => s.n === 3)?.objective ?? "Answer Mum's call", null);
  g.sfxs.play("phone_ring");
  const ring = setInterval(() => g.sfxs.play("phone_ring"), 2200);
  try {
    await g.use("phone", "Answer the phone (Mum)", () => g.playerAt(), 9, 4);
  } finally {
    clearInterval(ring);
  }
  g.player.person.act("phone");
  await g.barks([
    ["npc.mum", "wip_m002_mum_01", "Hello? Hello? Have you eaten? Is this loudspeaker? Hello, everybody!", "excited"],
    ["player", "wip_m002_mum_p01", "Mummy. You're on speaker.", "shy"],
    ["npc.mum", "wip_m002_mum_02", "Good, let them hear. Eat. Call me.", "warm"],
  ]);
  g.player.person.act("stand");
  g.sfxs.play("phone_text");
  g.ui.showCard("Text from Mum", "\"Daddy sent something small. Don't finish it.\"", "", [], 3000);
  await g.sleep(2.2);
  g.sfxs.play("bank_alert");
  g.progress.money += 3000;
  g.ui.setMoney(g.progress.money);
  g.ui.showCard("Bank alert", "+₦3,000", "From: Dad. Narration: \"Manage it.\"", [], 3000);
}

/** A held view (no letterbox block in Y1.md for it): the camera at an anchor, lines over it. */
async function vista(g: StoryGame, from: string, look: A3, lines: [string, string, string][], lookEnd?: A3): Promise<void> {
  const a = g.anchor(from, "world");
  if (!a) return;
  const pos = Array.isArray(a) ? a : a.pos;
  g.mode = "cut";
  g.ui.setPlaying(false);
  const prev = g.cam.camera!.fov;
  g.cam.camera!.fov = 46;
  const t0 = performance.now();
  const tick = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / 9000);
    const L = lookEnd ? [look[0] + (lookEnd[0] - look[0]) * k, look[1] + (lookEnd[1] - look[1]) * k, look[2] + (lookEnd[2] - look[2]) * k] : look;
    g.cam.setPosition(pos[0], pos[1], pos[2]);
    g.cam.lookAt(L[0]!, L[1]!, L[2]!);
  }, 16);
  try {
    await g.barks(lines.map(([c, id, t]) => [c, id, t, "warm"]));
  } finally {
    clearInterval(tick);
    g.cam.camera!.fov = prev;
    g.mode = "play";
    g.ui.setPlaying(true);
  }
}

/** The route from the hall door to the Spot (along paths, round the court, clear of every tree and table). */
/**
 * The routes the story walks, in one place so the navigation tests walk
 * exactly what the missions walk (test/nav.test.ts).
 */
export const NAV_ROUTES = {
  /** M1 step 2: the roommate from the room door, down the corridor, out of the hall's front door, to the Spot. */
  m001_lead(female: boolean, at: (name: string, where: string) => A3): { from: A3; route: A3[] } {
    const h = hall(female);
    // Outside, the guide picks the way on the navigation grid (footpaths first) to the Spot; no hand-placed
    // marks on the lawn to drag them off the path.
    return { from: at("room_door", "hostel"), route: [at("corridor_west", "hostel"), frontOf(h, 3.4, 1.2), spotRoute(female).at(-1)!] };
  },
  /** M1 step 4: the goat's runs (it waits at each for you). */
  m001_goat(): { from: A3; route: A3[] } {
    return { from: [-10.5, 0, -88], route: [[-6, 0, -72], [-24, 0, -52], [-41, 0, -48.6]] };
  },
};

function spotRoute(female: boolean): A3[] {
  if (female) return [[100, 0, -150], [92, 0, -128], [60, 0, -122], [20, 0, -100], [5.4, 0, -96], [-8, 0, -90], [-12, 0, -82.6], [-18.4, 0, -79.4]];
  return [[-96, 0, -86], [-95, 0, -70], [-82, 0, -66.4], [-60, 0, -63], [-40, 0, -62.6], [-28, 0, -70], [-24, 0, -77.6], [-18.6, 0, -79.0]];
}

function bySignNear(sign: string) {
  return bySign(sign);
}

export const MISSION_DEFS: MissionDef[] = [m001, m002, m003, m004, m005, m006, m007, m008, m009, m010];
export const MISSION_ORDER = MISSION_DEFS.map((m) => m.id);

void PLACES;
