/**
 * The campaign: plays Missions 1-10 in story order.
 *
 *  - A new game starts Mission 1 at once (the opening film, then the room).
 *  - After a mission, the next one's start appears on the map as a marker
 *    ("Next: Queue Theory · the Senate"); walking into it sets the day and
 *    the hour (a calendar card) and starts it.
 *  - Every step is a checkpoint: closing the game mid-mission resumes at
 *    the start of that step.
 *  - The journal (J) lists missions, clues, legends and contacts.
 *  - With ?debug=1, a mission select replays any mission or any step, and
 *    switches the special characters on or off (their kill switches).
 */
import { MISSION_DEFS, MISSION_ORDER, type MissionDef } from "./scripts.ts";
import { Abort, type StoryGame, type Target } from "../story-game.ts";
import { nextMission, passMission } from "../save.ts";
import type { StoryMission } from "../../story/parse.ts";

export class Campaign {
  private running: string | null = null;
  onSpecials: ((s: { jiya: boolean; taty: boolean; madison: boolean }) => void) | null = null;

  constructor(private g: StoryGame, private story: StoryMission[], private debug: boolean) {}

  title(id: string): string {
    return this.story.find((m) => m.key === id)?.title ?? id;
  }

  /** Begin play: resume a checkpoint, start Mission 1, or point to the next mission. */
  start(): void {
    const p = this.g.progress;
    if (p.current && MISSION_ORDER.includes(p.current.mission)) {
      const def = MISSION_DEFS.find((d) => d.id === p.current!.mission)!;
      const idx = Math.max(0, def.steps.findIndex((s, i) => i === p.current!.step));
      void this.run(def, idx < 0 ? 0 : idx, true);
      return;
    }
    const next = nextMission(p.done, MISSION_ORDER);
    if (next === "m001") void this.run(MISSION_DEFS[0]!, 0, false);
    else this.offerNext();
  }

  /** Show the next mission's start on the map and wait for the player to walk in. */
  offerNext(): void {
    const g = this.g;
    const next = nextMission(g.progress.done, MISSION_ORDER);
    g.newRun();
    g.keepDoors();
    if (!next) {
      g.setObjective("Year 1", "Missions 1–10 done. More of Year 1 is coming. Explore.", null);
      return;
    }
    const def = MISSION_DEFS.find((d) => d.id === next)!;
    const start: Target = def.start(g);
    g.setObjective(`Next · M${Number(next.slice(1))}`, `${this.title(next)} · go to ${start.label ?? "the marker"}`, start);
    void g.reach(start, 3.2).then(() => this.run(def, 0, false)).catch((e) => {
      if (!(e instanceof Abort)) console.error(e);
    });
  }

  /** Play a mission from a step (index into its steps). */
  async run(def: MissionDef, from: number, resumed: boolean): Promise<void> {
    const g = this.g;
    g.newRun();
    g.keepDoors();
    g.clearCast();
    g.clearObjective();
    this.running = def.id;
    g.progress.current = { mission: def.id, step: from };
    const n = Number(def.id.slice(1));
    try {
      const first = def.steps[from]!;
      if (from === 0 && first.n === 0 && !resumed) {
        // Missions that open with a film: the card comes after it (or straight away for the rest).
        if (def.id !== "m001") this.startCard(def, n);
      } else this.startCard(def, n);
      if (from > 0 || resumed || first.setup) {
        if (first.setup) await g.fadeThrough(() => first.setup!(g), 0.4);
      } else g.hours = def.hour;
      if (from === 0 && !first.setup) g.hours = def.hour;
      for (let i = from; i < def.steps.length; i++) {
        g.progress.current = { mission: def.id, step: i };
        g.save();
        await def.steps[i]!.run(g);
        if (def.id === "m001" && i === 0) this.startCard(def, n);
      }
      // Passed.
      let rewards: string[] = [];
      const paid = passMission(g.progress, def.id, (p) => {
        rewards = def.reward(p);
      });
      g.ui.setMoney(g.progress.money);
      g.sfxs.play("mission_pass");
      g.ui.showCard("Mission passed", this.title(def.id), paid ? "" : "Replayed: rewards were already yours.", rewards.map((r) => r.replace("{{ROOMIE}}", g.ctx.roomie)), 5200);
      g.clearObjective();
      g.save();
      this.running = null;
      await g.sleep(4.5);
      this.offerNext();
    } catch (e) {
      if (!(e instanceof Abort)) {
        console.error(e);
        g.ui.showCard("Something went wrong", this.title(def.id), "The mission was reset to its last checkpoint.", [], 4000);
      }
    }
  }

  private startCard(def: MissionDef, n: number): void {
    const m = this.story.find((x) => x.key === def.id);
    this.g.ui.showCard(`Mission ${n}`, m?.title ?? def.id, def.calendar, [], 3800);
  }

  /* ------------------------------------------------------------ journal */

  journal(): void {
    const g = this.g, p = g.progress;
    const s = g.ui.sheet();
    const h = (t: string) => {
      const e = document.createElement("h3");
      e.textContent = t;
      s.append(e);
    };
    const list = (items: string[], empty: string) => {
      const ul = document.createElement("ul");
      for (const i of items.length ? items : [empty]) {
        const li = document.createElement("li");
        li.textContent = i.replace("{{ROOMIE}}", g.ctx.roomie);
        ul.append(li);
      }
      s.append(ul);
    };
    const t = document.createElement("h2");
    t.textContent = `${p.name}'s journal`;
    s.append(t);
    h("Missions");
    list(MISSION_ORDER.map((id, i) => `${p.done.includes(id) ? "✓" : p.current?.mission === id ? "▶" : "·"} M${i + 1} ${this.title(id)}`), "");
    h("The Note and other things");
    list(p.journal.entries, "Nothing yet.");
    h("Legends to investigate");
    list(p.journal.legends, "Mai Shayi knows a few.");
    h("Contacts");
    list(p.journal.contacts, "Nobody yet.");
    h("Pockets");
    list([`₦${p.money.toLocaleString("en-GB")}`, ...Object.entries(p.items).map(([k, v]) => `${k.replace(/_/g, " ")}${v > 1 ? ` ×${v}` : ""}`)], "");
    const close = document.createElement("button");
    close.textContent = "Close (J)";
    close.className = "primary";
    close.onclick = () => g.ui.closeSheet();
    s.append(close);
  }

  /* ------------------------------------------------------------ debug mission select (?debug=1) */

  debugMenu(): void {
    if (!this.debug) return;
    const g = this.g;
    const s = g.ui.sheet();
    const t = document.createElement("h2");
    t.textContent = "Missions (debug)";
    s.append(t);
    const sp = g.ctx.specials;
    const row = document.createElement("div");
    row.className = "row";
    const b = document.createElement("b");
    b.textContent = "Special characters (kill switches):";
    row.append(b);
    for (const k of ["jiya", "taty", "madison"] as const) {
      const btn = document.createElement("button");
      btn.textContent = `${k} ${sp[k] ? "ON" : "off"}`;
      if (sp[k]) btn.className = "primary";
      btn.onclick = () => {
        sp[k] = !sp[k];
        this.onSpecials?.(sp);
        this.debugMenu();
      };
      row.append(btn);
    }
    s.append(row);
    MISSION_DEFS.forEach((def, i) => {
      const r = document.createElement("div");
      r.className = "row";
      const name = document.createElement("b");
      name.textContent = `M${i + 1} ${this.title(def.id)}${g.progress.done.includes(def.id) ? " ✓" : ""}`;
      r.append(name);
      def.steps.forEach((st, k) => {
        const btn = document.createElement("button");
        btn.textContent = k === 0 ? "Play" : `Step ${st.n}`;
        if (k === 0) btn.className = "primary";
        btn.onclick = () => {
          g.ui.closeSheet();
          void this.run(def, k, k > 0);
        };
        r.append(btn);
      });
      s.append(r);
    });
    const r2 = document.createElement("div");
    r2.className = "row";
    for (const [label, f] of [
      ["Mark M1–M10 done", () => {
        g.progress.done = [...MISSION_ORDER];
        g.progress.current = null;
        g.save();
        this.offerNext();
      }],
      ["Reset progress", () => {
        g.progress.done = [];
        g.progress.paid = [];
        g.progress.current = null;
        g.save();
        void this.run(MISSION_DEFS[0]!, 0, false);
      }],
      ["Close", () => undefined],
    ] as const) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.onclick = () => {
        g.ui.closeSheet();
        f();
      };
      r2.append(btn);
    }
    s.append(r2);
  }

  get current(): string | null {
    return this.running;
  }
}
