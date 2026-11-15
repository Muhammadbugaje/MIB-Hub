# Credits and licences: FSLG visual prototype (throwaway spike)

Every third-party asset here is **CC0 1.0 (public domain)**. I checked the licence on the page or in the archive each one came from on 15 Nov 2026.

## Engine
- Babylon.js 7.54.0 (core, loaders, materials) from cdn.jsdelivr.net/npm/babylonjs@7.54.0. Apache-2.0 licence. It is loaded from the CDN and not stored here.

## Poly Haven (https://polyhaven.com/license: all assets CC0)
HDRIs (2k .hdr):
- belfast_sunset_puresky: https://polyhaven.com/a/belfast_sunset_puresky (Greg Zaal, Dimitrios Savva, Jarod Guest)
- industrial_sunset_02_puresky: https://polyhaven.com/a/industrial_sunset_02_puresky (Jarod Guest, Sergej Majboroda)
- kloppenheim_02_puresky: https://polyhaven.com/a/kloppenheim_02_puresky (Greg Zaal, Jarod Guest)

PBR textures (1k jpg: diff, nor_gl, arm):
- red_laterite_soil_stones: https://polyhaven.com/a/red_laterite_soil_stones (Amal Kumar)
- red_dirt_mud_01: https://polyhaven.com/a/red_dirt_mud_01 (Rob Tuytel)
- sparse_grass: https://polyhaven.com/a/sparse_grass (Amal Kumar)
- painted_plaster_wall: https://polyhaven.com/a/painted_plaster_wall (Amal Kumar)
- concrete_wall_008: https://polyhaven.com/a/concrete_wall_008 (Dario Barresi, Charlotte Baglioni)
- concrete_floor_worn_001: https://polyhaven.com/a/concrete_floor_worn_001 (Dimitrios Savva, Rico Cilliers)
- rusty_corrugated_iron: https://polyhaven.com/a/rusty_corrugated_iron (Charlotte Baglioni)
- Downloaded but not used: withered_grass, white_plaster_02, corrugated_iron, mud_cracked_dry_03

Models (1k glTF):
- island_tree_02: https://polyhaven.com/a/island_tree_02 (Rob Tuytel, Rico Cilliers). Stands in for neem and mango; it is not either species.
- painted_wooden_bench: https://polyhaven.com/a/painted_wooden_bench (Kirill Sannikov)
- plastic_monobloc_chair_01: https://polyhaven.com/a/plastic_monobloc_chair_01 (Kuutti Siitonen)
- portable_generator: https://polyhaven.com/a/portable_generator (James Ray Cock)
- street_lamp_01: https://polyhaven.com/a/street_lamp_01 (Josh Dean)
- grass_bermuda_01: https://polyhaven.com/a/grass_bermuda_01 (Rico Cilliers)
- shrub_02: https://polyhaven.com/a/shrub_02 (Rico Cilliers)
- plastic_crate_01: https://polyhaven.com/a/plastic_crate_01 (PierreB3D)

## Quaternius: Ultimate Animated Character Pack (CC0)
Licence: CC0 1.0. This is stated on https://quaternius.com/packs/ultimatedanimatedcharacter.html and in the pack's License.txt, a copy of which is in assets/chars2/.
- Downloaded from the pack's official Google Drive folder, which is linked from that page.
- Used: Casual_Male, Casual_Female, Casual2_Male, Casual2_Female, Casual3_Female, Casual_Bald, Suit_Male, Suit_Female and Worker_Male.
- These are rigged characters with built-in Idle and Walk clips. Downloaded but not used: Casual3_Male, OldClassy_Male, Worker_Female and Doctor_Female_Young.
- The materials are flat colours. In code I changed:
  - skin tones (from light to deep) and clothes colours;
  - body width, to make chubby and lean builds;
  - eyes: I added dark pupils, catch-lights and dark brows on top of the pack's white eye shapes.
- I first tried Quaternius "Universal Base Characters" with the "Universal Animation Library" (both CC0). The owner rejected that bodybuilder look, so it was removed.
- I also checked Kenney "Mini Characters" (CC0, kenney.nl). I did not use it: its characters are too blocky for the brief.

## Made for this prototype (my own work, CC0)
- `assets/gen/water_nor.png`: a procedural tileable water normal map (a sum of sines, generated with Pillow).
- All buildings, the kiosk, the signs, the reeds, the hills and the dam crest are built in code from boxes, tubes and spheres.
- The sign text is fictional. "MAMA T PROVISIONS" is a made-up kiosk name; no brands are used.
