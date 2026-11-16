# Mixamo download list (for the owner)

**What this is.** Mixamo is Adobe's free library of character animations made with motion capture. It is free to use in games, but you need a free Adobe account to download from it, and only you can sign in. This guide lists exactly what to download for the first part of the game (the movement engine, the first missions and the cutscenes). It takes about 20 to 30 minutes.

**Where to save everything:** `~/Downloads/games-files/mixamo/` (make the folder). Not inside the MIB-Hub folder: these raw files stay outside git. The game build converts them into small game files.

## 1. Set up (once)

1. Go to **mixamo.com** and sign in with a free Adobe account (make one if you have none).
2. Click **Characters** at the top, search **Y Bot**, click it. This is the "mannequin" every animation is made for.
3. Click **Download** with these settings, and save it as `ybot.fbx`:
   - **Format:** FBX Binary (.fbx)
   - **Pose:** T-pose

## 2. How to download each animation

For every row below:

1. Click **Animations** at the top and type the **Search** words.
2. Click the animation whose name matches (or the closest one, if the name has changed slightly). It plays on the Y Bot so you can check it.
3. If the right-hand panel has an **In Place** tick box and the row says **In place: yes**, tick it.
4. Leave the other sliders as they are, unless the row says otherwise.
5. Click **Download** with:
   - **Format:** FBX Binary (.fbx)
   - **Skin:** Without Skin
   - **Frames per second:** 30
   - **Keyframe reduction:** none
6. Save the file with the **Save as** name from the table. The exact name matters: the game finds clips by these names.

If you can't find one, skip it and write the name down. I'll find a replacement or make it myself.

## 3. Movement (the most important: please do all of these)

| # | Search for | In place | Save as |
|---|---|---|---|
| 1 | Breathing Idle | – | idle_breathe.fbx |
| 2 | Looking Around | – | idle_look_around.fbx |
| 3 | Bored | – | idle_impatient.fbx |
| 4 | Tired (or "Out Of Breath") | – | idle_tired.fbx |
| 5 | Walking | yes | walk_fwd.fbx |
| 6 | Walking Backwards | yes | walk_back.fbx |
| 7 | Left Strafe Walking | yes | walk_strafe_L.fbx |
| 8 | Right Strafe Walking | yes | walk_strafe_R.fbx |
| 9 | Jog Forward | yes | jog_fwd.fbx |
| 10 | Running | yes | run_fwd.fbx |
| 11 | Fast Run (or "Sprint") | yes | sprint_fwd.fbx |
| 12 | Start Walking | no | walk_start.fbx |
| 13 | Stop Walking | no | walk_stop.fbx |
| 14 | Run To Stop | no | run_stop.fbx |
| 15 | Left Turn 90 | no | turn_90L.fbx |
| 16 | Right Turn 90 | no | turn_90R.fbx |
| 17 | Running Turn 180 | no | run_pivot_180.fbx |
| 18 | Jumping Up (standing jump) | yes | jump_start.fbx |
| 19 | Falling Idle | – | fall_loop.fbx |
| 20 | Falling To Landing | yes | land_soft.fbx |
| 21 | Hard Landing | yes | land_hard.fbx |
| 22 | Running Jump | yes | jump_run.fbx |
| 23 | Ascending Stairs | yes | stairs_up.fbx |
| 24 | Descending Stairs | yes | stairs_down.fbx |
| 25 | Crouch Idle | – | crouch_idle.fbx |
| 26 | Crouched Walking | yes | crouch_walk.fbx |
| 27 | Stumble Backwards | no | stumble_back.fbx |
| 28 | Climbing (Ledge Climb) | no | climb_ledge.fbx |

## 4. Everyday life and cutscenes

| # | Search for | Save as |
|---|---|---|
| 29 | Sitting (sit down onto a chair) | sit_down.fbx |
| 30 | Sitting Idle | sit_idle.fbx |
| 31 | Sitting Talking | sit_talk.fbx |
| 32 | Stand Up | stand_up.fbx |
| 33 | Waving | wave.fbx |
| 34 | Pointing | point.fbx |
| 35 | Head Nod Yes | nod.fbx |
| 36 | Shaking Head No | shake_head.fbx |
| 37 | Talking (pick 2 different ones) | talk_1.fbx, talk_2.fbx |
| 38 | Arguing | talk_argue.fbx |
| 39 | Laughing | laugh.fbx |
| 40 | Surprised | shock.fbx |
| 41 | Clapping | clap.fbx |
| 42 | Cheering | cheer.fbx |
| 43 | Hug (or "Hugging") | hug.fbx |
| 44 | Shaking Hands | handshake.fbx |
| 45 | Texting While Standing | phone_text.fbx |
| 46 | Talking On Phone | phone_call.fbx |
| 47 | Eating | eat.fbx |
| 48 | Drinking | drink.fbx |
| 49 | Picking Up | pick_up.fbx |
| 50 | Carrying (box carry walk; tick In Place) | carry_walk.fbx |
| 51 | Kneeling | kneel.fbx |
| 52 | Writing | write.fbx |
| 53 | Yawn | yawn.fbx |
| 54 | Lying Down / Sleeping Idle | sleep.fbx |
| 55 | Thinking | think.fbx |
| 56 | Facepalm (or "Disappointed") | facepalm.fbx |

## 5. Rides, fun and the first scuffles

| # | Search for | Save as |
|---|---|---|
| 57 | Driving | car_drive.fbx |
| 58 | Sitting (in a car, passenger; any relaxed seated idle) | car_passenger.fbx |
| 59 | Hip Hop Dancing | dance_1.fbx |
| 60 | Samba Dancing | dance_2.fbx |
| 61 | Silly Dancing | dance_3.fbx |
| 62 | Victory (or "Fist Pump") | victory.fbx |
| 63 | Push (pushing someone, light) | shove.fbx |
| 64 | Hit Reaction | hit_react.fbx |
| 65 | Getting Up | get_up.fbx |
| 66 | Soccer Pass | pass_short.fbx |
| 67 | Soccer Kick (strike) | shot_power.fbx |
| 68 | Goalkeeper Diving Save | keeper_dive.fbx |

## 6. When you're done

Tell me "Mixamo is in games-files". I will then:

- **Convert and clean the files:** retarget to our own skeleton, cut file sizes, and check that every foot plants without sliding.
- **Build the movement engine:** smooth blends, starts and stops, jumps, steps and slopes, feet that adapt to the ground.
- **Make the extra motions Mixamo lacks:** okada and keke rides, carrying a bucket on the head, pounding yam, goat chases, Taty's "horns".

**Licence note.** Mixamo animations are royalty-free inside games and films. The raw files can't be shared on their own (for example, uploaded as a pack), so they stay in `games-files` and only the converted, in-game versions go into the game.
