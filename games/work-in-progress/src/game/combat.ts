/**
 * Combat system for Missions 1-10.
 *
 * Real-time brawling: the player punches/kicks/blocks, NPCs hit back, health
 * bars appear above heads, and a KO ends the fight. Built on the existing
 * animation clips (punch, kick, block, hit, fall) — no new physics engine.
 *
 * Modes per fighter:
 *   idle      — not acting; can start an attack
 *   telegraph — winding up (0.8s): gesture plays, player can block
 *   attacking — swing connects: damage applied if in range
 *   blocked   — player guarded: staggers 0.7s, can counter
 *   hit       — took damage: flinch 0.6s, then back to idle
 *   ko        — down: fight ends when only one side is standing
 *
 * Rules:
 *   - A fight is never unwinnable: blocking + countering beats raw attacking.
 *   - Special characters (Jiya, Taty, Zainab, Madison) go to "hit" then stand
 *     back up — they never take real damage in a scripted fight.
 */

import type { Person, AnimName } from "../world/people.ts";
import type { StoryGame } from "./story-game.ts";

/** Fine deducted when the player is knocked out and taken to hospital or the station. */
export const KO_FINE = 500;

/** Where the player wakes up: hospital garden or gatehouse (police station). */
export const WAKE_POSITIONS: [number, number][] = [[95, -104], [-21, -84]];

export interface Combatant {
  id: string;
  /** The cast id this combatant represents (for the player: "player"). */
  castId: string;
  person: Person;
  /** Health 0..1. */
  health: number;
  /** Max health. */
  maxHealth: number;
  /** Current mode. */
  mode: "idle" | "telegraph" | "attacking" | "blocked" | "hit" | "ko";
  /** Seconds left in the current mode. */
  t: number;
  /** Who this combatant is attacking (cast id). */
  target: string;
  /** The attack they're winding up: "punch" | "kick". */
  windup: "punch" | "kick" | null;
  /** True if this combatant is the player. */
  isPlayer: boolean;
  /** Facing (radians). */
  yaw: number;
}

export interface AttackResult {
  hit: boolean;
  blocked: boolean;
  damage: number;
  ko: boolean;
}

export class Combat {
  /** All combatants in the current fight, keyed by id. */
  readonly fighters = new Map<string, Combatant>();
  /** The player's combatant id (set when combat starts). */
  playerId: string | null = null;
  /** Current fight state. */
  state: "idle" | "active" | "ended" = "idle";
  /** Winner cast id, set when state === "ended". */
  winner: string | null = null;

  private sg: StoryGame;
  private camShake = 0;

  constructor(sg: StoryGame) {
    this.sg = sg;
  }

  /* ---------------------------------------------------------------- start / end */

  /** Begin a fight with the NPC at `opponent` cast id. */
  start(opponent: string): void {
    const p = this.sg.npc(opponent);
    if (!p) return;
    this.end();
    const player = this.sg.player.person;
    const pp = player.root.getPosition();
    const ep = p.root.getPosition();
    this.playerId = "player";
    const playerYaw = Math.atan2(ep.x - pp.x, ep.z - pp.z);
    const enemyYaw = Math.atan2(pp.x - ep.x, pp.z - ep.z);
    this.fighters.set(this.playerId, {
      id: this.playerId, castId: "player", person: player, health: 1, maxHealth: 1,
      mode: "idle", t: 0, target: opponent, windup: null, isPlayer: true, yaw: playerYaw,
    });
    this.fighters.set(opponent, {
      id: opponent, castId: opponent, person: p, health: 1, maxHealth: 1,
      mode: "telegraph", t: 0.8, target: "player", windup: null, isPlayer: false, yaw: enemyYaw,
    });
    // Face each other.
    player.root.setLocalEulerAngles(0, playerYaw * 180 / Math.PI, 0);
    p.root.setLocalEulerAngles(0, enemyYaw * 180 / Math.PI, 0);
    this.state = "active";
    this.sg.ui.setActionHint("Punch · Kick · Block");
  }

  /** End the current fight. */
  end(): void {
    this.state = "idle";
    this.playerId = null;
    this.winner = null;
    this.fighters.clear();
    this.sg.ui.setActionHint(null);
  }

  /* ---------------------------------------------------------------- player input */

  /** Call once per sim step: consume player punch/kick/block input. */
  playerInput(inp: { punch?: boolean; kick?: boolean; block?: boolean }): void {
    if (this.state !== "active" || !this.playerId) return;
    const player = this.fighters.get(this.playerId)!;
    if (player.mode !== "idle" && player.mode !== "blocked") return; // can't act while recovering

    const enemyId = [...this.fighters.keys()].find((k) => k !== this.playerId)!;
    const enemy = this.fighters.get(enemyId)!;

    if (inp.block) {
      player.mode = "blocked";
      player.t = 0.5;
      player.person.act("block");
      this.sg.sfxs.play("block");
      return;
    }
    if (inp.punch) this.attack(player, enemy, "punch");
    else if (inp.kick) this.attack(player, enemy, "kick");
  }

  /** Perform an attack from `a` against `b`. Returns the result. */
  private attack(a: Combatant, b: Combatant, kind: "punch" | "kick"): AttackResult {
    const damage = kind === "punch" ? 0.3 : 0.45;
    const reach = kind === "punch" ? 2.2 : 2.6;

    const ax = a.person.root.getPosition().x;
    const az = a.person.root.getPosition().z;
    const bx = b.person.root.getPosition().x;
    const bz = b.person.root.getPosition().z;
    const d = Math.hypot(ax - bx, az - bz);
    const facing = Math.atan2(bx - ax, bz - az);
    const dAng = Math.atan2(Math.sin(facing - a.yaw), Math.cos(facing - a.yaw));
    const inRange = d <= reach && Math.abs(dAng) < 0.9;

    const clip: AnimName = kind === "punch" ? "punch" : "kick";
    a.person.act(clip);
    a.mode = "attacking";
    a.t = 0.5;
    a.windup = kind;

    const result: AttackResult = { hit: false, blocked: false, damage: 0, ko: false };

    if (inRange) {
      result.hit = true;
      const blocked = b.mode === "blocked";
      if (blocked) {
        result.blocked = true;
        b.mode = "blocked";
        b.t = 0.7;
        b.person.act("block");
        a.t = 0.9; // attacker staggers on parry
        this.sg.sfxs.play("block");
      } else {
        result.damage = damage;
        result.ko = this.applyDamage(b, damage, kind);
        a.t = 0.4;
        this.sg.sfxs.play(kind === "punch" ? "punch" : "kick");
      }
    } else {
      a.t = 0.3; // whiff: quick recovery
    }
    return result;
  }

  /* ---------------------------------------------------------------- enemy AI (fixed step) */

  /** Enemy turn: wind up, then attack. Call once per sim step while active. */
  enemyTurn(dt: number): void {
    if (this.state !== "active") return;
    for (const f of this.fighters.values()) {
      if (f.isPlayer) continue;
      f.t -= dt;
      if (f.t <= 0) {
        switch (f.mode) {
          case "telegraph": {
            f.mode = "attacking";
            f.t = 0.5;
            f.windup = Math.random() < 0.6 ? "punch" : "kick";
            f.person.act(f.windup as AnimName);
            break;
          }
          case "attacking": {
            const player = this.fighters.get(this.playerId!)!;
            const inRange = this.inRange(f, player);
            const blocked = player.mode === "blocked";
            if (inRange) {
              if (blocked) {
                player.mode = "blocked";
                player.t = 0.7;
                player.person.act("block");
                f.t = 0.9; // enemy staggers on parry
                this.sg.sfxs.play("block");
              } else {
                this.applyDamage(player, f.windup === "kick" ? 0.45 : 0.3, f.windup ?? "punch");
                f.t = 0.4;
              }
            } else {
              f.t = 0.3; // whiff
            }
            f.mode = "idle";
            f.windup = null;
            break;
          }
          case "blocked": {
            f.mode = "telegraph";
            f.t = 0.8;
            f.windup = Math.random() < 0.6 ? "punch" : "kick";
            f.person.act("gesture"); // taunt while winding up
            break;
          }
          case "hit": {
            f.mode = "telegraph";
            f.t = 0.8;
            f.windup = Math.random() < 0.6 ? "punch" : "kick";
            f.person.act("gesture");
            break;
          }
          case "ko": {
            this.state = "ended";
            this.winner = f.isPlayer ? "enemy" : "player";
            this.sg.ui.setActionHint(null);
            this.sg.sfxs.play("ko");
            return;
          }
        }
      }
    }
  }

  private inRange(a: Combatant, b: Combatant): boolean {
    const ax = a.person.root.getPosition().x;
    const az = a.person.root.getPosition().z;
    const bx = b.person.root.getPosition().x;
    const bz = b.person.root.getPosition().z;
    const d = Math.hypot(ax - bx, az - bz);
    const facing = Math.atan2(bx - ax, bz - az);
    const dAng = Math.atan2(Math.sin(facing - a.yaw), Math.cos(facing - a.yaw));
    return d <= 2.6 && Math.abs(dAng) < 0.9;
  }

  /* ---------------------------------------------------------------- damage */

  /** Apply damage to a fighter. Returns true if they are KO'd. */
  private applyDamage(f: Combatant, damage: number, kind: "punch" | "kick"): boolean {
    // Special characters never take real damage in scripted fights.
    const special = ["special.jiya", "special.taty", "special.madison", "special.zainab"];
    if (special.includes(f.castId)) {
      f.mode = "hit";
      f.t = 0.6;
      f.person.act("hit");
      this.camShake = 0.15;
      setTimeout(() => { if (f.mode === "hit") f.mode = "idle"; }, 600);
      return false;
    }
    f.health = Math.max(0, f.health - damage);
    f.mode = "hit";
    f.t = 0.6;
    f.person.act("hit");
    this.camShake = 0.15;
    this.sg.sfxs.play("punch");

    if (f.health <= 0) {
      f.mode = "ko";
      f.t = 1.5;
      f.person.act("fall");
      const others = [...this.fighters.values()].filter((x) => x !== f);
      const alive = others.some((x) => x.health > 0);
      if (!alive) {
        this.state = "ended";
        this.winner = f.isPlayer ? "enemy" : "player";
        // Player KO'd: blackout → hospital/police station → wake up with a fine.
        if (f.isPlayer) this.sg.speakKO();
        return true;
      }
      return true;
    }
    setTimeout(() => { if (f.mode === "hit") f.mode = "idle"; }, 600);
    return false;
  }

  /* ---------------------------------------------------------------- render / UI */

  /** Call once per rendered frame: cam shake. */
  render(dt: number): void {
    if (this.camShake > 0) {
      this.camShake -= dt;
      const c = this.sg.cam.getPosition();
      const k = this.camShake * 0.3;
      this.sg.cam.setPosition(c.x + (Math.random() - 0.5) * k, c.y + (Math.random() - 0.5) * k, c.z + (Math.random() - 0.5) * k);
    }
  }

  /** Health fraction (0..1) for a combatant by cast id. */
  healthOf(castId: string): number | null {
    const f = this.fighters.get(castId);
    return f ? f.health : null;
  }
}
