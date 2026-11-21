---
name: combat-system
description: Fight mechanics design and implementation plan
metadata:
  type: project
---

# Combat System Plan

## What exists already
- `AnimName` includes `punch`, `kick`, `block`, `hit`, `fall` (people.ts:348-350)
- `ACT_CLIPS` has punch→shove, kick→kick, block→block, hit→flinch, fall→knock_down (people.ts:385-390)
- `InputState.punch`/`kick` wired: f=punch, g=kick, edge-queued; touch P/K buttons (input.ts:21-24, 102-126)
- director.ts handles `actor.punch`/`actor.kick`/`actor.block` cutscene commands (director.ts:386-399)
- M7 scuffle minigame maps events to animations but no real hit/damage (scripts.ts:1068-1090)
- `stats.health` exists in save.ts but is not tied to combat
- `Animator.bump()` provides hit impulse/stagger; `knockDown()` provides ragdoll-lite (animator.ts)

## What's missing (to build)
1. **Combat mode** on StoryGame: `combatTarget`, `combatState` (idle/telegraph/attacking/blocked/hit/ko)
2. **Input wiring**: consume `inp.pressed.has("punch"/"kick"/"block")` in story-game step/frame
3. **Hitboxes/hurtboxes**: attack hitbox in front of player, hurtbox on NPCs; use existing CollisionWorld circle/box
4. **Damage/health**: reduce NPC health on hit, player takes damage when hit, KO at 0, health UI
5. **Combat UI**: enemy health bar above head, combat prompt ("Punch/Kick/Block")
6. **Combat reactions**: victim plays `hit`/`fall`, attacker plays `punch`/`kick`, block plays `block`
7. **Mission integration**: M7 scuffle becomes real combat; other missions can use combat

## Files to create/edit
- NEW: `src/game/combat.ts` — Combat class (state machine, hitboxes, damage)
- EDIT: `src/game/story-game.ts` — add combat fields, wire input, add combat to step/frame
- EDIT: `src/game/input.ts` — ensure block input is wired (currently missing!)
- EDIT: `src/game/hud.ts` — add enemy health bar + combat prompt
- EDIT: `src/world/people.ts` — ensure `block`/`hit`/`fall` act properly
- EDIT: `src/game/missions/scripts.ts` — M7 real combat integration
