/**
 * Cheat codes system (GTA-style).
 *
 * Players can type cheat codes on keyboard during gameplay or enter them
 * in the phone. Typing letters buffers the last 15 keystrokes and matches
 * against known cheat keywords.
 *
 * Cheats are configured in cheats-config.json and loaded at startup.
 *
 * Available cheats (from config):
 *   - HESOYAM / HEALTH: Full health + stamina + ₦2,500
 *   - CATCHME / SPEED: 60s of Turbo Sneakers speed boost
 *   - KACHING / MONEY: Add ₦10,000
 *   - GOD / BAGUVIX: Toggle invincible mode
 *   - FIGHT: Start fight with nearest NPC
 *   - HOSPITAL: Teleport to Teaching Hospital
 *   - GATE: Teleport to Main Gate
 *   - DAY / NIGHT: Flip time of day
 */

import type { StoryGame } from "./story-game.ts";
import { surfaceHeight } from "../world/surface.ts";
import cheatsConfig from "./cheats-config.json";

export interface Cheat {
  code: string;
  name: string;
  desc: string;
  action: (sg: StoryGame) => string;
}

export class CheatManager {
  private buffer = "";
  private maxLen = 15;
  private godMode = false;

  readonly cheats: Cheat[] = cheatsConfig.cheats.map((c) => ({
    code: c.code,
    name: c.name,
    desc: c.desc,
    action: (sg) => {
      const action = c.action as string;
      // Map action names to story-game methods
      switch (action) {
        case "health_wealth": {
          if (sg.combat) {
            const p = sg.combat.fighters.get("player");
            if (p) p.health = 1;
          }
          sg.stamina = 1;
          if (sg.progress) sg.progress.money = (sg.progress.money || 0) + 2500;
          return "Cheat Activated: Full Health + ₦2,500!";
        }
        case "restore_health": {
          if (sg.combat) {
            const p = sg.combat.fighters.get("player");
            if (p) p.health = 1;
          }
          sg.stamina = 1;
          return "Cheat Activated: Full Health!";
        }
        case "turbo_speed": {
          sg.boosts.turbo = 60;
          return "Cheat Activated: Turbo Speed (60s)!";
        }
        case "super_sprint": {
          sg.boosts.turbo = 90;
          sg.boosts.zobo = 90;
          sg.stamina = 1;
          return "Cheat Activated: Super Sprint!";
        }
        case "instant_cash": {
          if (sg.progress) sg.progress.money = (sg.progress.money || 0) + 10000;
          return "Cheat Activated: +₦10,000 Added!";
        }
        case "big_money": {
          if (sg.progress) sg.progress.money = (sg.progress.money || 0) + 50000;
          return "Cheat Activated: +₦50,000 Big Money!";
        }
        case "god_mode": {
          this.godMode = !this.godMode;
          sg.godMode = this.godMode;
          if (this.godMode) {
            sg.stamina = 1;
            sg.boosts.zobo = 99999;
            return "Cheat Activated: God Mode ON!";
          }
          sg.boosts.zobo = 0;
          return "Cheat Activated: God Mode OFF!";
        }
        case "brawl_nearby": {
          let nearest: string | null = null;
          let minDist = 15;
          for (const [id, p] of sg.npcs.entries()) {
            if (!p.visible) continue;
            const pos = p.root.getPosition();
            const d = Math.hypot(pos.x - sg.player.x, pos.z - sg.player.z);
            if (d < minDist) {
              minDist = d;
              nearest = id;
            }
          }
          if (nearest) {
            sg.fight(nearest);
            return `Cheat Activated: Fight started with ${nearest}!`;
          }
          return "No one nearby to fight!";
        }
        case "warp_hospital": {
          const x = 95, z = -104;
          sg.teleport({ pos: [x, surfaceHeight(x, z), z], where: "world" }, 0);
          return "Cheat Activated: Teleported to Hospital!";
        }
        case "warp_gate": {
          const x = 0, z = -40;
          sg.teleport({ pos: [x, surfaceHeight(x, z), z], where: "world" }, Math.PI);
          return "Cheat Activated: Teleported to Main Gate!";
        }
        case "set_day": {
          sg.hours = 10.0;
          return "Cheat Activated: Time set to 10:00 AM!";
        }
        case "set_night": {
          sg.hours = 21.0;
          return "Cheat Activated: Time set to 9:00 PM!";
        }
        default: return `Unknown cheat action: ${action}`;
      }
    },
  }));

  /** Call on each key press to check if a cheat code was matched. */
  feed(char: string, sg: StoryGame): string | null {
    if (char.length !== 1 || !/[a-zA-Z]/.test(char)) return null;
    this.buffer = (this.buffer + char.toUpperCase()).slice(-this.maxLen);

    for (const c of this.cheats) {
      if (this.buffer.endsWith(c.code)) {
        this.buffer = "";
        const msg = c.action(sg);
        sg.ui.say(msg);
        sg.sfxs.play("power_down_whine");
        return msg;
      }
    }
    return null;
  }

  /** Run a cheat directly by code (from phone or menu). */
  execute(code: string, sg: StoryGame): string {
    const norm = code.trim().toUpperCase();
    const c = this.cheats.find((x) => x.code === norm);
    if (!c) return `Unknown cheat: ${code}`;
    const msg = c.action(sg);
    sg.ui.say(msg);
    sg.sfxs.play("power_down_whine");
    return msg;
  }
}
