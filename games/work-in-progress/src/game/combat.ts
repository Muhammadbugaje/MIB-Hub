/**
 * Combat system for Missions 1-10 — reworked for visceral, satisfying brawling.
 *
 * Real-time hand-to-hand combat with light/heavy attacks, dodge rolls, counters,
 * weapon pickups (bat, stick, shovel), knockback, stun, and hit stop.
 *
 * Modes per fighter:
 *   idle      — not acting; can start an attack or dodge
 *   telegraph — winding up (0.25s light / 0.5s heavy): opponent can react
 *   attacking — swing connects: damage applied if in range
 *   dodging   — invincible roll (0.35s), can counter-attack out of it
 *   blocked   — guarding: can parry (counter) or break guard with heavy
 *   counter   — riposte after a parry: guaranteed hit
 *   hit       — flinching from damage: 0.5s recovery
 *   stunned   — dazed from heavy hit or guard break: 1.2s, vulnerable
 *   ko        — down: fight ends when only one side is standing
 *
 * Weapons (picked up from the world):
 *   bat    — heavy, slow, high damage, knockback
 *   stick  — medium speed, medium damage
 *   shovel — slowest, highest damage, stuns on heavy hit
 *
 * Rules:
 *   - Blocking reduces damage; heavy attacks break guard (→ stunned).
 *   - Parry (block during enemy telegraph) → counter (guaranteed hit).
 *   - Dodge has i-frames; rolling into an attack avoids it.
 *   - Special characters never take real damage in scripted fights.
 */

import * as pc from "playcanvas";
import type { Person, AnimName } from "../world/people.ts";
import type { StoryGame } from "./story-game.ts";
import { surfaceHeight } from "../world/surface.ts";

/** Fine deducted when the player is knocked out and taken to hospital or the station. */
export const KO_FINE = 500;

/** Where the player wakes up: hospital garden or gatehouse (police station). */
export const WAKE_POSITIONS: [number, number][] = [[95, -104], [-21, -84]];

/** Melee weapons that can be picked up from the world. */
export type WeaponKind = "none" | "bat" | "stick" | "shovel";

export interface WeaponDef {
  kind: WeaponKind;
  /** Display name. */
  name: string;
  /** Base damage multiplier. */
  dmgMult: number;
  /** Reach in metres. */
  reach: number;
  /** Swing speed (seconds per attack). */
  swing: number;
  /** Knockback force multiplier. */
  knock: number;
  /** Stun chance on heavy hit (0..1). */
  stunChance: number;
}

export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  none:   { kind: "none", name: "Fists", dmgMult: 1.0, reach: 2.2, swing: 0.45, knock: 0.8, stunChance: 0 },
  bat:    { kind: "bat",  name: "Bat",    dmgMult: 1.6, reach: 2.6, swing: 0.75, knock: 1.8, stunChance: 0.25 },
  stick:  { kind: "stick",name: "Stick",  dmgMult: 1.2, reach: 2.4, swing: 0.55, knock: 1.2, stunChance: 0.1 },
  shovel: { kind: "shovel",name: "Shovel",dmgMult: 2.0, reach: 2.8, swing: 0.9,  knock: 2.4, stunChance: 0.4 },
};

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
  mode: "idle" | "telegraph" | "attacking" | "dodging" | "blocked" | "counter" | "hit" | "stunned" | "ko";
  /** Seconds left in the current mode. */
  t: number;
  /** Who this combatant is attacking (cast id). */
  target: string;
  /** The attack they're winding up: "light" | "heavy". */
  windup: "light" | "heavy" | null;
  /** Weapon currently equipped. */
  weapon: WeaponKind;
  /** True if this combatant is the player. */
  isPlayer: boolean;
  /** Facing (radians). */
  yaw: number;
  /** Invincible frames remaining (dodge). */
  iframes: number;
  /** Knockback velocity being applied. */
  kx: number;
  /** Knockback velocity being applied. */
  kz: number;
}

export interface AttackResult {
  hit: boolean;
  blocked: boolean;
  parried: boolean;
  damage: number;
  ko: boolean;
  stun: boolean;
  knockback: { x: number; z: number } | null;
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
  private hitStop = 0; // seconds of frozen time on a big hit
  private combatMusic = false;

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
      mode: "idle", t: 0, target: opponent, windup: null, weapon: "none", isPlayer: true, yaw: playerYaw, iframes: 0, kx: 0, kz: 0,
    });
    this.fighters.set(opponent, {
      id: opponent, castId: opponent, person: p, health: 1, maxHealth: 1,
      mode: "idle", t: 0, target: "player", windup: null, weapon: "none", isPlayer: false, yaw: enemyYaw, iframes: 0, kx: 0, kz: 0,
    });
    // Face each other.
    player.root.setLocalEulerAngles(0, playerYaw * 180 / Math.PI, 0);
    p.root.setLocalEulerAngles(0, enemyYaw * 180 / Math.PI, 0);
    this.state = "active";
    this.sg.ui.setActionHint("Light · Heavy · Block · Dodge · Weapon");
    this.sg.sfxs.play("door"); // fight start sting
    this.combatMusic = true;
    this.sg.sfxs.music("plug_theme");
  }

  /** End the current fight. */
  end(): void {
    this.state = "idle";
    this.playerId = null;
    this.winner = null;
    this.fighters.clear();
    this.sg.ui.setActionHint(null);
    this.sg.sfxs.music(null);
    this.combatMusic = false;
  }

  /* ---------------------------------------------------------------- player input */

  /** Call once per sim step: consume player punch/kick/block/dodge input. */
  playerInput(inp: {
    punch?: boolean; kick?: boolean; block?: boolean; dodge?: boolean;
    heavy?: boolean; weapon?: boolean;
  }): void {
    if (this.state !== "active" || !this.playerId) return;
    const player = this.fighters.get(this.playerId)!;
    if (player.mode !== "idle" && player.mode !== "blocked" && player.mode !== "dodging") return;

    const enemyId = [...this.fighters.keys()].find((k) => k !== this.playerId)!;
    const enemy = this.fighters.get(enemyId)!;

    // Dodge roll: i-frames, quick recovery, can counter out of it.
    if (inp.dodge && player.mode !== "dodging") {
      player.mode = "dodging";
      player.t = 0.35;
      player.iframes = 0.45;
      player.person.act("roll"); // roll animation
      this.sg.sfxs.play("fight_punch_whoosh");
      return;
    }

    // Block / parry stance.
    if (inp.block) {
      player.mode = "blocked";
      player.t = 0.6;
      player.person.act("block");
      this.sg.sfxs.play("fight_block");
      return;
    }

    const kind = inp.heavy ? "heavy" : "light";
    this.attack(player, enemy, kind);
  }

  /** Perform an attack from `a` against `b`. */
  private attack(a: Combatant, b: Combatant, kind: "light" | "heavy"): AttackResult {
    const w = WEAPONS[a.weapon];
    const damageBase = kind === "light" ? 0.25 : 0.45;
    const damage = damageBase * w.dmgMult;
    const reach = kind === "light" ? w.reach : w.reach + 0.3;
    const swing = kind === "light" ? w.swing : w.swing * 1.3;

    const ax = a.person.root.getPosition().x;
    const az = a.person.root.getPosition().z;
    const bx = b.person.root.getPosition().x;
    const bz = b.person.root.getPosition().z;
    const d = Math.hypot(ax - bx, az - bz);
    const facing = Math.atan2(bx - ax, bz - az);
    const dAng = Math.atan2(Math.sin(facing - a.yaw), Math.cos(facing - a.yaw));
    const inRange = d <= reach && Math.abs(dAng) < 1.0;

    const clip: AnimName = kind === "light" ? "punch" : "kick";
    a.person.act(clip);
    a.mode = "attacking";
    a.t = swing;
    a.windup = kind;

    const result: AttackResult = {
      hit: false, blocked: false, parried: false, damage: 0, ko: false, stun: false,
      knockback: null,
    };

    if (inRange && b.iframes <= 0) {
      result.hit = true;

      // Parry: defender was blocking during attacker's telegraph (already resolved here since attack is instant).
      const blocked = b.mode === "blocked";
      if (blocked) {
        // Heavy breaks guard → stun; light just gets blocked.
        if (kind === "heavy" && w.knock > 1.2) {
          result.parried = false;
          b.mode = "stunned";
          b.t = 1.2;
          b.person.act("hit");
          b.kx = Math.sin(a.yaw) * w.knock;
          b.kz = Math.cos(a.yaw) * w.knock;
          this.sg.sfxs.play("fight_kick_hit");
          this.camShake = 0.2;
          this.hitStop = 0.1;
          result.stun = true;
        } else {
          result.blocked = true;
          b.mode = "blocked";
          b.t = 0.5;
          b.person.act("block");
          a.t = 0.7; // attacker staggers slightly on block
          this.sg.sfxs.play("fight_block");
          this.hitStop = 0.05;
        }
      } else {
        result.damage = damage;
        result.ko = this.applyDamage(b, damage, kind);
        result.knockback = {
          x: Math.sin(a.yaw) * w.knock * (kind === "heavy" ? 1.5 : 1.0),
          z: Math.cos(a.yaw) * w.knock * (kind === "heavy" ? 1.5 : 1.0),
        };
        a.t = kind === "light" ? 0.35 : 0.5;
        this.sg.sfxs.play(kind === "light" ? "fight_punch_hit" : "fight_kick_hit");
        this.camShake = kind === "light" ? 0.1 : 0.18;
        this.hitStop = kind === "light" ? 0.04 : 0.08;
      }
    } else if (inRange && b.iframes > 0) {
      // Dodge avoided the attack entirely.
      this.sg.sfxs.play("fight_punch_whoosh");
      a.t = 0.4;
    } else {
      a.t = 0.25; // whiff: quick recovery
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
      f.iframes = Math.max(0, f.iframes - dt);

      // Apply knockback decay.
      if (f.kx !== 0 || f.kz !== 0) {
        const p = f.person.root.getPosition();
        const nx = p.x + f.kx * dt;
        const nz = p.z + f.kz * dt;
        f.person.place(nx, surfaceHeight(nx, nz), nz, f.yaw);
        f.kx *= 0.6;
        f.kz *= 0.6;
        if (Math.abs(f.kx) < 0.01 && Math.abs(f.kz) < 0.01) { f.kx = 0; f.kz = 0; }
      }

      if (f.t <= 0) {
        switch (f.mode) {
          case "telegraph": {
            // Decide light/heavy based on health and distance.
            const player = this.fighters.get(this.playerId!)!;
            const inRange = this.inRange(f, player);
            const heavy = inRange && Math.random() < 0.35;
            f.mode = "attacking";
            f.t = heavy ? 0.7 : 0.4;
            f.windup = heavy ? "heavy" : "light";
            f.person.act(heavy ? "kick" : "punch");
            break;
          }
          case "attacking": {
            const player = this.fighters.get(this.playerId!)!;
            const inRange = this.inRange(f, player);
            if (inRange && player.iframes <= 0) {
              const blocked = player.mode === "blocked";
              if (blocked) {
                // Player blocked: heavy breaks guard, light just parried.
                const heavy = f.windup === "heavy";
                if (heavy) {
                  player.mode = "stunned";
                  player.t = 1.2;
                  player.person.act("hit");
                  player.kx = Math.sin(f.yaw) * 1.8;
                  player.kz = Math.cos(f.yaw) * 1.8;
                  this.sg.sfxs.play("fight_kick_hit");
                  this.camShake = 0.2;
                } else {
                  player.mode = "blocked";
                  player.t = 0.5;
                  player.person.act("block");
                  this.sg.sfxs.play("fight_block");
                }
              } else {
                this.applyDamage(player, f.windup === "heavy" ? 0.45 : 0.3, f.windup ?? "light");
              }
              f.t = 0.4;
            } else {
              f.t = 0.2; // whiff
            }
            f.mode = "idle";
            f.windup = null;
            break;
          }
          case "blocked": {
            f.mode = "telegraph";
            f.t = 0.8;
            f.windup = Math.random() < 0.6 ? "light" : "heavy";
            f.person.act("gesture");
            break;
          }
          case "hit": {
            f.mode = "idle";
            f.person.act("stand");
            break;
          }
          case "stunned": {
            f.mode = "idle";
            f.person.act("stand");
            break;
          }
          case "dodging": {
            f.mode = "idle";
            f.person.act("stand");
            break;
          }
          case "ko": {
            this.state = "ended";
            this.winner = f.isPlayer ? "enemy" : "player";
            this.sg.ui.setActionHint(null);
            this.sg.sfxs.play("ko");
            // Player KO'd: blackout → hospital/police station → wake up with a fine.
            if (f.isPlayer) this.sg.speakKO();
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
    return d <= 3.0 && Math.abs(dAng) < 1.0;
  }

  /* ---------------------------------------------------------------- damage */

  /** Apply damage to a fighter. Returns true if they are KO'd. */
  private applyDamage(f: Combatant, damage: number, kind: "light" | "heavy"): boolean {
    // God mode (cheat): the player shrugs off every hit.
    if (f.isPlayer && this.sg.godMode) {
      f.mode = "hit";
      f.t = 0.2;
      f.person.act("hit");
      return false;
    }
    // Special characters never take real damage in scripted fights.
    const special = ["special.jiya", "special.taty", "special.madison", "special.zainab"];
    if (special.includes(f.castId)) {
      f.mode = "hit";
      f.t = 0.5;
      f.person.act("hit");
      this.camShake = 0.1;
      return false;
    }
    f.health = Math.max(0, f.health - damage);
    f.mode = "hit";
    f.t = 0.5;
    f.person.act("hit");
    this.camShake = kind === "heavy" ? 0.2 : 0.12;
    this.hitStop = kind === "heavy" ? 0.08 : 0.04;
    this.sg.sfxs.play(kind === "light" ? "fight_punch_hit" : "fight_kick_hit");

    // Chance to stun on heavy hit.
    if (kind === "heavy" && Math.random() < 0.2 && f.health > 0) {
      f.mode = "stunned";
      f.t = 1.0;
      f.person.act("fall");
    }

    if (f.health <= 0) {
      f.mode = "ko";
      f.t = 1.5;
      f.person.act("fall");
      const others = [...this.fighters.values()].filter((x) => x !== f);
      const alive = others.some((x) => x.health > 0);
      if (!alive) {
        this.state = "ended";
        this.winner = f.isPlayer ? "enemy" : "player";
        if (f.isPlayer) this.sg.speakKO();
        return true;
      }
      return true;
    }
    return false;
  }

  /** Equip a weapon for the player (picked up from the world). */
  equipWeapon(kind: WeaponKind): string {
    if (!this.playerId) return "Not in a fight.";
    const f = this.fighters.get(this.playerId)!;
    f.weapon = kind;
    const w = WEAPONS[kind];
    this.sg.ui.say(`Equipped ${w.name}.`);
    this.sg.sfxs.play("pickup");
    return `Equipped ${w.name}.`;
  }

  /** Current weapon for the player. */
  playerWeapon(): WeaponKind {
    if (!this.playerId) return "none";
    return this.fighters.get(this.playerId)!.weapon;
  }

  /** Health fraction (0..1) for a combatant by cast id. */
  healthOf(castId: string): number | null {
    const f = this.fighters.get(castId);
    return f ? f.health : null;
  }

  /** Is hit stop active (brief freeze on impact)? */
  hitStopActive(): boolean { return this.hitStop > 0; }

  /** Consume hit stop time. */
  tickHitStop(dt: number): void { this.hitStop = Math.max(0, this.hitStop - dt); }

  /** Current camera shake. */
  camShakeAmt(): number { return this.camShake; }
  tickCamShake(dt: number): void { this.camShake = Math.max(0, this.camShake - dt); }
}
