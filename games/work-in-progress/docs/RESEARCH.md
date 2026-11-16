# Work in Progress: engine notes and the mistakes we design against

Written 16 Nov 2026 for the first slice. This is what we looked up, what we decided, and where in the code each decision lives.

## 1. Draw calls and batching (PlayCanvas)

- PlayCanvas's own guidance is about **100-200 draw calls on a low-end phone**; desktops can take far more. Static scenery should be merged (batched) and repeated objects drawn with **hardware instancing**. [PlayCanvas optimisation guidelines](https://developer.playcanvas.com/user-manual/optimization/guidelines/), [instancing vs batching (forum)](https://forum.playcanvas.com/t/what-are-the-differences-between-hardware-instancing-and-batching-in-playcanvas/31448), [WebXR optimising](https://developer.playcanvas.com/user-manual/xr/optimizing-webxr)
- **What we do:**
  - All static scenery (ground, roads, buildings, props) is built by `src/gfx/builder.ts` and merged per material and per 64 m chunk (`src/world/static.ts`). The whole town is a few hundred meshes, and the chunks still let the camera skip what is behind it.
  - Trees, bushes, birds and falling leaves are instanced (`src/world/nature.ts`, `src/world/sky.ts`).
  - Each person and each car is one mesh (one draw call). The materials were merged at build time by `tools/pack-character.ts`, and a 16-pixel palette texture recolours them.
  - The HUD shows draws and fps.

## 2. Fixed time step with interpolation

- Glenn Fiedler's "Fix Your Timestep!" is the standard reference. The game advances in fixed steps out of an accumulator and draws a blend of the last two states. [gafferongames.com](https://gafferongames.com/post/fix_your_timestep/), [Bevy example](https://cocalc.com/github/bevyengine/bevy/blob/main/examples/movement/physics_in_fixed_timestep.rs), [input in a fixed timestep](https://jakubtomsu.github.io/posts/input_in_fixed_timestep)
- **What we do:** `src/main.ts` runs player, crowd and traffic at 60 Hz, with at most 6 steps per frame so a hitch never causes a spiral. The player, the people and the vehicles are drawn interpolated (`render(alpha)`).
  - Input is queued and read once per frame, so a tap between frames is not lost.
  - A test checks that traffic gives the same result whatever the frame rate.

## 3. Vehicles: jitter, wobble, sinking, riding backwards

- Forum post-mortems on raycast suspension point to three usual causes of jitter:
  - a missing or wrongly scaled damper;
  - springs too stiff for the simulation rate;
  - a variable time step.

  A fixed step and a damper tuned to the stiffness are the common fix. [Unreal forum](https://forums.unrealengine.com/t/making-ray-cast-suspension-framerate-independent/2688640), [gamedev.net](https://gamedev.net/forums/topic/678810-physics-ue4-implement-a-maximum-compression-for-vehicle-suspension/5292858/), [Godot forum](https://godotforums.org/d/23177-raycast-vehicle-suspension-not-stabilizing)
- The classic game's complaints were bikes ridden the wrong way, bikes sinking into the floor, and wobbling.
- **What we do in this slice** (AI traffic is kinematic: it follows lanes and does not need suspension):
  - **Never backwards.**
    - Every model's forward end is measured: for cars, from the headlight vertices at load (`analyseCar` in `src/world/vehicles.ts`); for the okada and keke, by a test.
    - The model is turned so that it faces +z.
    - One function turns +z to the direction of travel (`yawFor` in `src/sim/motion.ts`), and a test proves it.
  - **Never sinking.**
    - The lowest point of every car is measured and put at y = 0.
    - Okada and keke wheels start at their lowest vertex. A test checks the minimum y is exactly 0.
    - Vehicles stand on `surfaceHeight()`, the same numbers the road mesh is built from.
  - **No wobble.**
    - The okada's lean is a critically damped spring on the turn rate (no overshoot).
    - Yaw is unwrapped, so interpolation never spins the long way round.
    - A teleport at the end of a lane snaps the previous state too, so no streak appears.
- When the player can drive (next milestone), the plan is Rapier with our own raycast wheels: damper ≈ 2·√(k·m)·0.3 to 0.6, run on the same 60 Hz step, with the suspension force along the ground normal.

## 4. Character controller, kerbs and foot sliding

- **What we do** (`src/game/player.ts`):
  - **Kerbs.** The player is a circle against boxes and circles, and slides along walls. Kerbs are steps in `surfaceHeight()` that the body follows with a spring (fast up, gentle down), so there is no pop.
  - **Getting unstuck.** If the player is pushing but has not moved for 1.5 s, it is moved back to the last free spot. Out-of-world positions are recovered the same way.
  - **Foot sliding.**
    - `tools/pack-character.ts` evaluates the skeleton over the walk and run clips and measures how fast a planted foot moves backwards (the clip's true ground speed).
    - The game plays each clip at `ground speed / measured stride speed`, so feet do not slide. This is plan rule A1.
    - The same measurement tells us each model faces +z (tested).
  - **Blends.** All state changes cross-fade over 0.2 s (rule A9).

## 5. Shadows: acne and peter-panning

- Shadow acne comes from too little bias. Peter-panning comes from too much (the shadow detaches from the object). The usual fix is a small constant bias plus a **normal-offset bias**, with cascades sized to the view.
- **What we do:**
  - One directional light with PCF3 soft shadows.
  - Bias 0.25 and normal offset 0.06.
  - 2 cascades over 90 m on desktop, and 1 cascade over 55 m at 1024 px on phones.
  - Thin flat layers (roads, markings) do not cast shadows.

## 6. Z-fighting

- **What we do:**
  - Every flat layer has its own height, at least 1.2 cm apart (`Y` in `src/world/roads.ts`; tested).
  - Road markings also use a depth bias.
  - The near plane is 0.25 m, which keeps depth precision good out to the fog.
  - Overlapping road pieces never share a height: the roundabout ring is 1.5 cm above the straight roads.

## 7. Textures and mipmaps

- **What we do:**
  - All tiling textures are painted in code at load time (`src/gfx/textures.ts`), so there is no download.
  - They use mipmaps, trilinear filtering and 8× anisotropy, which avoids shimmering roads.
  - Phones get 256 px versions.
  - Normal maps are made from the same height fields.
  - Sign text lives in one atlas and is drawn from data (rule R4).
  - The next step, when real texture photos arrive, is KTX2/Basis via the PlayCanvas texture compressor.

## 8. Garbage-collection hitches and spawning

- **What we do:**
  - The per-frame loops reuse vectors and matrices; instance buffers are written in place.
  - People, vehicles, leaves and smoke are made once at load (pools) and recycled: leaves respawn, and cars re-enter their lane. Nothing is created while you play.
  - Far-away people stop evaluating animation but keep their pose.

## 9. Mobile

- `?quality=low` is chosen automatically on touch screens and small screens. It sets:
  - pixel ratio ≤ 1.5;
  - 1024 shadows, 1 cascade;
  - about 45 people, fewer cars, 28 birds, 60 leaves;
  - 4 real lights;
  - no shadows from palms and bushes.
- There is a touch joystick and a RUN toggle.

## 10. Hosting on Cloudflare (static assets)

- Every file must be under 25 MiB, and Pages allows 20,000 files.
- **What we do:**
  - The build is one JS file (about 2.2 MB, 0.6 MB gzipped) plus small GLBs (each under 1 MB).
  - A test fails if any file in `apps/web/public` is 25 MiB or more, or if the folder passes 15,000 files.
  - The Vite build refuses to finish if any output file is 25 MiB or more.
  - Nothing needs a server: voices are looked up in a static manifest, so missing files never cause 404s.
