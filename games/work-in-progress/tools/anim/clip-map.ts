/**
 * Which Mixamo download becomes which game clip (plan §4.1 ids), in which
 * pack, and how it is processed. The owner's file names are Mixamo's own
 * ("Breathing Idle.fbx", "Walking.fbx", "Sitting Idle-2.fbx"...). Settings
 * are not trusted from the names: the build measures each file (skin or not,
 * frame rate, root travel) and reports what it found.
 *
 * Modes:
 *   inplace  a locomotion loop that travels: the steady travel is removed
 *            (the controller moves the body) and measured as the clip's
 *            stride speed; the hips keep their natural sway (rule A1);
 *   root     a one-shot that moves the body (starts, stops, turns, pivots,
 *            stand-ups): travel and turn are moved onto the Root node as
 *            root motion, which the controller applies with collisions;
 *   static   plays where it stands (gestures, idles, seated loops);
 *   ground   an airborne clip (jumps, falls, landings): flight height is
 *            taken out of the hips (the controller owns the jump arc) while
 *            the crouch and the landing squash stay; any travel is removed.
 *
 * Packs (lazy-loaded except locomotion): locomotion, social, action,
 * sports, vehicles, dance.
 */

export type Mode = "inplace" | "root" | "static" | "ground";

export interface ClipSpec {
  id: string;
  /** Path under the Mixamo folder ("AA/" = Action Adventure Pack, "SG/" = Soccer Game Pack). */
  file: string;
  pack: "locomotion" | "social" | "action" | "sports" | "vehicles" | "dance";
  kind: "loop" | "once" | "pose";
  mode: Mode;
  /** Keep only [start, end] seconds of a long take. */
  trim?: [number, number];
  /** For loops cut out of long takes: search the loop end within this many seconds of the trim end. */
  autoLoop?: boolean;
  /** Turn a stance that faces off to one side back to face forward (radians removed from the root). */
  face?: boolean;
  layer?: "full" | "upper" | "arms" | "head";
  /** A held part of a once clip (seconds), e.g. the seated part of a sit. */
  hold?: [number, number];
  notes?: string;
}

const AA = "Action Adventure Pack/";
const SG = "Soccer Game Pack/";

export const CLIP_SPECS: ClipSpec[] = [
  /* ---------------------------------------------------------------- locomotion (core pack) */
  { id: "idle_breathe", file: `${AA}idle.fbx`, pack: "locomotion", kind: "loop", mode: "static", face: true },
  { id: "idle_look_around", file: `${AA}idle (3).fbx`, pack: "locomotion", kind: "loop", mode: "static", face: true },
  { id: "idle_shift", file: `${AA}idle (2).fbx`, pack: "locomotion", kind: "loop", mode: "static", face: true, trim: [0, 10], autoLoop: true },
  { id: "walk_fwd", file: "Walking.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "walk_back", file: "Walking Backwards.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "walk_strafe_L", file: "Left Strafe Walking.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "walk_strafe_R", file: "Right Strafe Walking.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "walk_tired", file: "Injured Walking.fbx", pack: "locomotion", kind: "loop", mode: "inplace", notes: "low-stamina walk" },
  { id: "walk_phone", file: "Texting And Walking.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "jog_fwd", file: "Jog Forward.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "jog_back", file: `${SG}jog backward.fbx`, pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "jog_strafe_L", file: `${SG}jog strafe left.fbx`, pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "jog_strafe_R", file: `${SG}jog strafe right.fbx`, pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "run_fwd", file: `${AA}running.fbx`, pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "run_fast", file: "Running.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "sprint_fwd", file: "Sprint.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "walk_start", file: "Start Walking.fbx", pack: "locomotion", kind: "once", mode: "root" },
  { id: "walk_stop", file: "Stop Walking.fbx", pack: "locomotion", kind: "once", mode: "root" },
  { id: "run_stop", file: "Run To Stop.fbx", pack: "locomotion", kind: "once", mode: "root" },
  { id: "turn_90L", file: "Left Turn 90.fbx", pack: "locomotion", kind: "once", mode: "root" },
  { id: "turn_90R", file: "Right Turn 90.fbx", pack: "locomotion", kind: "once", mode: "root" },
  { id: "run_pivot_180", file: "Running Turn 180.fbx", pack: "locomotion", kind: "once", mode: "root" },
  { id: "jump_start", file: "Jumping Up.fbx", pack: "locomotion", kind: "once", mode: "ground" },
  { id: "fall_loop", file: "Falling Idle.fbx", pack: "locomotion", kind: "loop", mode: "static" },
  { id: "land_soft", file: "Falling To Landing.fbx", pack: "locomotion", kind: "once", mode: "ground" },
  { id: "land_hard", file: "Hard Landing.fbx", pack: "locomotion", kind: "once", mode: "ground" },
  { id: "jump_run", file: "Running Jump.fbx", pack: "locomotion", kind: "once", mode: "ground" },
  { id: "stairs_up", file: "Ascending Stairs.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "stairs_down", file: "Descending Stairs.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "stairs_run_up", file: "Running Up Stairs.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "crouch_idle", file: "Idle Crouching.fbx", pack: "locomotion", kind: "loop", mode: "static" },
  { id: "crouch_walk", file: "Crouched Walking.fbx", pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "crouch_walk_L", file: `${AA}crouched sneaking left.fbx`, pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "crouch_walk_R", file: `${AA}crouched sneaking right.fbx`, pack: "locomotion", kind: "loop", mode: "inplace" },
  { id: "carry_walk", file: "Box Walk Arc.fbx", pack: "locomotion", kind: "loop", mode: "inplace", notes: "box held in both hands" },

  /* ---------------------------------------------------------------- everyday and cutscene (social) */
  { id: "wave", file: "Waving.fbx", pack: "social", kind: "loop", mode: "static", layer: "upper" },
  { id: "point", file: "Pointing.fbx", pack: "social", kind: "once", mode: "static", layer: "upper" },
  { id: "nod", file: "Head Nod Yes.fbx", pack: "social", kind: "once", mode: "static", layer: "upper" },
  { id: "shake_head", file: "Shaking Head No.fbx", pack: "social", kind: "once", mode: "static", layer: "upper" },
  { id: "talk_1", file: "Talking.fbx", pack: "social", kind: "loop", mode: "static", layer: "upper" },
  { id: "talk_2", file: "Talking-2.fbx", pack: "social", kind: "loop", mode: "static", layer: "upper" },
  { id: "talk_argue_1", file: "Standing Arguing.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 8], autoLoop: true, layer: "upper" },
  { id: "talk_argue_2", file: "Standing Arguing-2.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 8], autoLoop: true, layer: "upper" },
  { id: "laugh", file: "Laughing.fbx", pack: "social", kind: "once", mode: "static", trim: [0, 5.5] },
  { id: "shock", file: "Surprised.fbx", pack: "social", kind: "once", mode: "static" },
  { id: "react_listen", file: "Reacting.fbx", pack: "social", kind: "once", mode: "static" },
  { id: "flinch", file: "Reaction.fbx", pack: "social", kind: "once", mode: "static", face: true },
  { id: "clap", file: "Clapping.fbx", pack: "social", kind: "loop", mode: "static", layer: "upper" },
  { id: "cheer", file: "Cheering.fbx", pack: "social", kind: "once", mode: "static" },
  { id: "victory", file: "Victory.fbx", pack: "social", kind: "once", mode: "static" },
  { id: "handshake_a", file: "Shaking Hands 1.fbx", pack: "social", kind: "once", mode: "static", notes: "paired with handshake_b" },
  { id: "handshake_b", file: "Shaking Hands 2.fbx", pack: "social", kind: "once", mode: "static", notes: "paired with handshake_a" },
  { id: "phone_call", file: "Talking On Phone.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 12], autoLoop: true, layer: "upper" },
  { id: "phone_call_2", file: "Talking On A Cell Phone.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 12], autoLoop: true, layer: "upper" },
  { id: "phone_text", file: "Texting While Standing.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 10], autoLoop: true, layer: "upper" },
  { id: "pick_up", file: "Picking Up.fbx", pack: "social", kind: "once", mode: "static", trim: [0, 3.2] },
  { id: "carry_idle", file: "Carrying.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 6], autoLoop: true },
  { id: "kneel_down", file: "Kneeling Down.fbx", pack: "social", kind: "once", mode: "static" },
  { id: "kneel", file: "Kneeling.fbx", pack: "social", kind: "loop", mode: "static" },
  { id: "yawn", file: "Yawn.fbx", pack: "social", kind: "once", mode: "static", trim: [0, 6] },
  { id: "facepalm", file: "Disappointed.fbx", pack: "social", kind: "once", mode: "static", notes: "disappointed / facepalm" },
  { id: "sit_idle", file: "Sitting Idle.fbx", pack: "social", kind: "loop", mode: "static" },
  { id: "sit_idle_2", file: "Sitting Idle-2.fbx", pack: "social", kind: "loop", mode: "static" },
  { id: "sit_idle_3", file: "Sitting.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 9.5], autoLoop: true },
  { id: "sit_stool", file: "Sitting-2.fbx", pack: "social", kind: "loop", mode: "static", notes: "high stool or bench edge" },
  { id: "sit_floor", file: "Sitting Idle-3.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 10.8], autoLoop: true },
  { id: "sit_talk", file: "Sitting Talking.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 10], autoLoop: true },
  { id: "sit_talk_2", file: "Sitting Talking-2.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 10], autoLoop: true },
  { id: "stand_up", file: "Stand Up.fbx", pack: "social", kind: "once", mode: "root", notes: "from a chair" },
  { id: "stand_up_floor", file: "Standing Up.fbx", pack: "social", kind: "once", mode: "root" },
  { id: "write", file: "Writing.fbx", pack: "social", kind: "loop", mode: "static", notes: "seated at a desk" },
  { id: "type_laptop", file: "Typing.fbx", pack: "social", kind: "loop", mode: "static", trim: [0, 8], autoLoop: true, notes: "seated" },
  { id: "drink", file: "Drinking.fbx", pack: "social", kind: "once", mode: "static", trim: [0, 5] },
  { id: "sleep", file: "Laying Sleeping.fbx", pack: "social", kind: "loop", mode: "static", notes: "lying on a bed" },
  { id: "lie_down", file: "Lying Down.fbx", pack: "social", kind: "once", mode: "root" },

  /* ---------------------------------------------------------------- action: climbs, falls, scuffles */
  { id: "climb_ledge", file: "Climbing Up Wall.fbx", pack: "action", kind: "once", mode: "root" },
  { id: "climb_ladder", file: "Climbing.fbx", pack: "action", kind: "once", mode: "root" },
  { id: "land_roll", file: `${AA}falling to roll.fbx`, pack: "action", kind: "once", mode: "root" },
  { id: "stumble_back", file: "Stumble Backwards.fbx", pack: "action", kind: "once", mode: "root" },
  { id: "knock_down", file: "Shoulder Hit And Fall.fbx", pack: "action", kind: "once", mode: "root" },
  { id: "hit_react_heavy", file: "Receiving A Big Uppercut.fbx", pack: "action", kind: "once", mode: "root" },
  { id: "get_up_back", file: "Getting Up.fbx", pack: "action", kind: "once", mode: "root" },
  { id: "get_up_front", file: "Getting Up-2.fbx", pack: "action", kind: "once", mode: "root" },
  { id: "get_up_sit", file: "Stand Up-2.fbx", pack: "action", kind: "once", mode: "root", notes: "knocked down: sitting -> up" },
  { id: "shove", file: "Release Hostage - Villain.fbx", pack: "action", kind: "once", mode: "root", notes: "a push-away (non-lethal scuffle)" },
  { id: "push_heavy", file: "Push.fbx", pack: "action", kind: "loop", mode: "inplace", trim: [0, 8], notes: "pushing a cart or car" },
  { id: "cover_idle", file: `${AA}idle (4).fbx`, pack: "action", kind: "loop", mode: "static" },
  { id: "stand_to_cover", file: `${AA}stand to cover.fbx`, pack: "action", kind: "once", mode: "root" },
  { id: "cover_to_stand", file: `${AA}cover to stand.fbx`, pack: "action", kind: "once", mode: "root" },
  { id: "sneak_wall_L", file: `${AA}left cover sneak.fbx`, pack: "action", kind: "loop", mode: "inplace" },
  { id: "sneak_wall_R", file: `${AA}right cover sneak.fbx`, pack: "action", kind: "loop", mode: "inplace" },

  /* ---------------------------------------------------------------- vehicles */
  { id: "car_drive", file: "Driving.fbx", pack: "vehicles", kind: "loop", mode: "static" },
  { id: "car_exit", file: "Exiting Car.fbx", pack: "vehicles", kind: "once", mode: "root" },
  { id: "skate", file: "Skateboarding.fbx", pack: "vehicles", kind: "loop", mode: "inplace" },

  /* ---------------------------------------------------------------- dance */
  { id: "dance_hiphop_1", file: "Hip Hop Dancing.fbx", pack: "dance", kind: "loop", mode: "static" },
  { id: "dance_hiphop_2", file: "Hip Hop Dancing-2.fbx", pack: "dance", kind: "loop", mode: "static", trim: [0, 9], autoLoop: true },
  { id: "dance_hiphop_3", file: "Hip Hop Dancing-3.fbx", pack: "dance", kind: "loop", mode: "static" },
  { id: "dance_hiphop_4", file: "Hip Hop Dancing-4.fbx", pack: "dance", kind: "loop", mode: "static" },
  { id: "dance_hiphop_5", file: "Hip Hop Dancing-5.fbx", pack: "dance", kind: "loop", mode: "static" },
  { id: "dance_hiphop_6", file: "Hip Hop Dancing-6.fbx", pack: "dance", kind: "loop", mode: "static", trim: [0, 9], autoLoop: true },
  { id: "dance_samba_1", file: "Samba Dancing.fbx", pack: "dance", kind: "loop", mode: "inplace", trim: [0, 9] },
  { id: "dance_samba_2", file: "Samba Dancing-2.fbx", pack: "dance", kind: "loop", mode: "static", trim: [0, 9], autoLoop: true },

  /* ---------------------------------------------------------------- football (owner's favourite) */
  { id: "dribble_run", file: "Dribble.fbx", pack: "sports", kind: "loop", mode: "inplace" },
  { id: "kick", file: "Kick Soccerball.fbx", pack: "sports", kind: "once", mode: "static" },
  { id: "kick_2", file: `${SG}kick soccerball (2).fbx`, pack: "sports", kind: "once", mode: "static" },
  { id: "kick_up", file: `${SG}kick up soccerball.fbx`, pack: "sports", kind: "once", mode: "static" },
  { id: "pass_short", file: "Soccer Pass.fbx", pack: "sports", kind: "once", mode: "static" },
  { id: "header_stand", file: "Header Soccerball.fbx", pack: "sports", kind: "once", mode: "static" },
  { id: "header_2", file: `${SG}header soccerball (2).fbx`, pack: "sports", kind: "once", mode: "static" },
  { id: "tackle_standing", file: "Soccer Tackle.fbx", pack: "sports", kind: "once", mode: "static" },
  { id: "tackle_slide", file: `${SG}soccer tackle.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "tackle_slide_2", file: `${SG}soccer tackle (2).fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "trip_fall", file: `${SG}soccer trip.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "fallen_idle", file: `${SG}fallen idle.fbx`, pack: "sports", kind: "loop", mode: "static" },
  { id: "get_up_pitch", file: `${SG}standing up.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "bicycle_kick", file: `${SG}scissor kick.fbx`, pack: "sports", kind: "once", mode: "root", notes: "Jega's Golden Boot (scissor kick)" },
  { id: "penalty_kick", file: `${SG}soccer penalty kick.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "first_touch_trap", file: `${SG}receive soccerball.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "knee_ball", file: `${SG}kneeing soccerball.fbx`, pack: "sports", kind: "once", mode: "static" },
  { id: "juggle_stall", file: `${SG}stall soccerball.fbx`, pack: "sports", kind: "once", mode: "static" },
  { id: "throw_in", file: `${SG}throw in.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "strike_jog", file: `${SG}strike foward jog.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "football_idle", file: `${SG}offensive idle.fbx`, pack: "sports", kind: "loop", mode: "static", trim: [0, 10], autoLoop: true },
  { id: "jog_diag_fwd_L", file: `${SG}jog forward diagonal.fbx`, pack: "sports", kind: "loop", mode: "inplace" },
  { id: "jog_diag_fwd_R", file: `${SG}jog forward diagonal (2).fbx`, pack: "sports", kind: "loop", mode: "inplace" },
  { id: "jog_diag_back_L", file: `${SG}jog backward diagonal.fbx`, pack: "sports", kind: "loop", mode: "inplace" },
  { id: "jog_diag_back_R", file: `${SG}jog backward diagonal (2).fbx`, pack: "sports", kind: "loop", mode: "inplace" },
  { id: "keeper_idle", file: `${SG}goalkeeper idle.fbx`, pack: "sports", kind: "loop", mode: "static" },
  { id: "keeper_idle_2", file: `${SG}goalkeeper idle (2).fbx`, pack: "sports", kind: "loop", mode: "static" },
  { id: "keeper_catch", file: "Goalkeeper Catch.fbx", pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_catch_2", file: `${SG}goalkeeper catch (2).fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_catch_3", file: `${SG}goalkeeper catch (4).fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_dive_L", file: "Goalkeeper Diving Save.fbx", pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_dive_R", file: `${SG}goalkeeper diving save.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_block", file: `${SG}goalkeeper body block.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_miss", file: `${SG}goalkeeper miss.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_throw", file: `${SG}goalkeeper overhand throw.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_kick", file: `${SG}goalkeeper drop kick.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_pass", file: `${SG}goalkeeper pass.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_scoop", file: `${SG}goalkeeper scoop.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_place_ball", file: `${SG}goalkeeper placing ball.fbx`, pack: "sports", kind: "once", mode: "root" },
  { id: "keeper_direct", file: `${SG}goalkeeper directing.fbx`, pack: "sports", kind: "once", mode: "root", trim: [0, 4] },
  { id: "keeper_sidestep_L", file: `${SG}goalkeeper sidestep.fbx`, pack: "sports", kind: "loop", mode: "inplace" },
  { id: "keeper_sidestep_R", file: `${SG}goalkeeper sidestep (2).fbx`, pack: "sports", kind: "loop", mode: "inplace" },
];

/**
 * Every clip the plan (§4.1) names for the slice and the mission scripts
 * (FORMAT.md actor.anim), for the coverage report. "Made" ids are built by
 * tools/anim/made.ts; anything else missing is listed as still missing.
 */
export const PLAN_CLIPS: string[] = [
  "idle_breathe", "idle_look_around", "idle_impatient", "idle_phone_check", "idle_tired",
  "walk_fwd", "walk_back", "walk_strafe_L", "walk_strafe_R", "jog_fwd", "run_fwd", "sprint_fwd",
  "walk_start", "run_start", "walk_stop", "run_stop", "sprint_skid_stop", "turn_90L", "turn_90R", "turn_180", "run_pivot_180",
  "stairs_up", "stairs_down", "carry_walk", "carry_idle", "carry_on_head", "push_wheelbarrow",
  "jump_start", "jump_air", "fall_loop", "land_soft", "land_hard", "land_run", "vault_low", "climb_ledge", "drop_down", "stumble_fwd", "stumble_back",
  "crouch_idle", "crouch_walk",
  "sit_down", "sit_idle", "stand_up", "sit_floor", "sit_think", "hug", "handshake", "high_five", "wave", "wave_from_car", "point", "nod", "shake_head",
  "talk_1", "talk_2", "laugh", "shock", "facepalm", "cheer", "clap", "kneel", "write", "throw_cap",
  "phone_call", "phone_text", "phone_photo", "eat_stand", "eat_seated", "eat_suya", "drink", "pick_up", "put_down", "give", "receive",
  "sleep", "lie_down", "wake_up", "yawn", "pray", "horns", "dance_hiphop_1", "dance_samba_1",
  "shove", "hit_react_heavy", "hit_react_light", "knock_down", "dazed_shake_head", "get_up_sit", "get_up_front", "get_up_back", "guard_idle", "block", "dodge_L",
  "car_enter", "car_exit", "car_drive", "car_passenger_idle",
  "bike_mount", "bike_dismount", "cycle", "cycle_freewheel", "cycle_foot_down", "bike_fall",
  "okada_ride", "okada_foot_down", "okada_pillion", "keke_drive", "keke_passenger",
  "kick", "pass_short", "header_stand", "dribble_run", "tackle_slide", "keeper_dive_L", "keeper_catch", "celebrate", "bicycle_kick",
  "type_laptop", "cook_stir", "sweep", "farm_hoe", "raise_hand",
];
