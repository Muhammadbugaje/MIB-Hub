"""Writes scenes3.json and ../SHOTLIST.md for trailer v3 from v3_timing.json (cuts sit on the half-bar grid of the score)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); TM = json.load(open(os.path.join(HERE, "v3_timing.json")))
hb = TM["beat"] * 2; ph = TM["phase"]; total = TM["total"]
# (name, half-bars, what happens, camera, needs from the game fixes)
S = [
 ("gate_dawn", 4, "Dawn at the Main Gate; students drift in; hero walks up, upright and fresh", "slow crane up and push through the arch", ""),
 ("hero_gate", 2, "Hero passes under the arch and looks up", "low front tracking, slight tilt up", "light-skinned M.I. BUGAJE look if available"),
 ("sprint", 2, "Sprint off the line down the palm boulevard, dust at the first step", "low side tracking; speed ramp fast-to-real on the cut", "energy and hunger full"),
 ("fountain", 2, "Fountain Circle and flags, students around", "orbit left to right; match cut on the circle", ""),
 ("letters", 2, "Giant FSLG letters, Senate tower behind", "push in from wide, letters reading correctly (shoot from the reading side)", ""),
 ("aerial", 2, "The whole campus from above, lake in the distance", "high crane drifting forward", ""),
 ("fight_swing", 1, "A bully squares up and swings first", "side-on two-shot, handheld sway", "opponents that fight back"),
 ("fight_pow", 1, "Hero's punch lands: sparks and the POW pop", "snap zoom, 2-frame freeze on impact", "hit sparks + POW pop on a real foe"),
 ("bike", 1, "Bicycle at speed, pedalling, sat properly", "wheel-level side tracking", "fixed seat positions"),
 ("car_chase", 1, "Sports car on the ring road", "low chase camera, slight roll", "fixed seat positions"),
 ("plane_rotate", 1, "Plane on the runway: nose lifts, wheels leave the ground", "front three-quarter, runway rushing", "plane take-off fix"),
 ("plane_bank", 1, "Climb and bank over the lake", "smooth chase camera behind and above", "plane take-off fix"),
 ("sec_warn", 2, "Whistle: security warning, the heat eye fills, a guard starts running (HUD on)", "over-shoulder to the guard, whip to hero", ""),
 ("sec_run", 2, "Hero sprints, cuts a corner, the guard gives up", "leading camera looking back; ramp on the corner", ""),
 ("friends", 2, "Busy street: hero walking with friends alongside, traffic passing", "front tracking at head height, out of the trees", "walkers alongside"),
 ("shuttle", 2, "Campus shuttle pulls up at the Phase 2 hostels; students get off", "static wide, bus enters frame", "shuttle + Phase 2 hostels"),
 ("shinkafi_gold", 3, "Shinkafi at golden hour: umbrellas, stalls, people (stop-down in the music)", "slow lateral dolly, camera clear of foliage, see-through fade off", "exposure/time tuned in the frozen copy"),
 ("lake_lapse", 2, "The Dam: sunset to night in two seconds", "locked-off on the pier; cross-dissolve in", ""),
 ("coil_night", 1, "Tesla coil arcing in the Engineering Garden at night", "tilt up the coil; flash on the arc into the big section", ""),
 ("slide", 1, "Handbrake slide, tyre smoke", "outside of the bend, low", ""),
 ("okada", 1, "Okada leaning through the roundabout", "inside of the bend, tracking", "fixed seat positions"),
 ("theatre_in", 1, "Hero walks into Kainji Theatre", "follow through the doorway (match cut on the door)", "walk-in interiors"),
 ("lecture", 1, "Inside: full lecture, lecturer at the board", "from the back row, slow push to the board", "walk-in interiors"),
 ("eng_quad", 1, "Engineering quad between the blocks", "crane down into the quad", "Engineering quad"),
 ("celebrate", 2, "MISSION PASSED: hero cheers, confetti (HUD on)", "orbit, ramp slow on the jump", ""),
 ("phone_hud", 2, "Phone, goals, radio, big map: four quick beats (HUD on)", "screen capture cuts on the quarter-bar", ""),
 ("courts", 1, "Social Centre courts and football field", "high sweep", ""),
 ("night_drive", 1, "Night drive, headlights on, lamps streaking", "bonnet-height chase", ""),
 ("hostel_dusk", 1, "Phase 2 hostels at dusk, windows lit", "slow rise", "Phase 2 hostels"),
 ("dance", 1, "Hero and friends dancing at the fountain", "orbit", "walkers alongside"),
 ("riser_cuts", 1, "Eight 3-frame flashes of the best moments", "hard cuts on the sixteenths", ""),
 ("logo", 4, "FSLG logo, 'A game by M.I. BUGAJE - Muhammad Iliyasu Bugaje'", "slow push; white flash in", ""),
 ("cta", 0, "Logo holds, 'Play it on EE Hub'; button hit, ring out, fade", "static", ""),
]
ph_at = [(p["at"], p["end"], p["i"], p["guess"]) for p in TM["phrases"]]
out = []; g = 0
for name, n, what, cam, need in S:
    st = 0.0 if g == 0 else ph + g * hb; en = total if n == 0 else ph + (g + n) * hb
    said = [i for a, e, i, _ in ph_at if a < en - .15 and e > st + .15]
    out.append({"name": name, "start": round(st, 2), "end": round(en, 2), "dur": round(en - st, 2), "frames": int(round((en - st) * 30)) + 3, "voice_phrases": said, "action": what, "camera": cam, "needs": need, "status": "to capture in phase 2"}); g += n
json.dump({"bpm": TM["bpm"], "half_bar": round(hb, 4), "total": total, "marks": TM["marks"], "shots": out}, open(os.path.join(HERE, "scenes3.json"), "w"), indent=1)
md = ["# Freshers School Life trailer v3: shot list", "", "Cut to the owner's own voiceover. Tempo %.2f bpm; every cut is on a half-bar (%.2f s). Planned length %.1f s. Nothing is captured yet: footage waits for the game fixes." % (TM["bpm"], hb, total), "",
      "Music marks: pulse %.1f s, groove %.1f, hit %.1f, stop-down %.1f, big section %.1f, logo %.1f, button %.1f." % tuple(TM["marks"][k] for k in ("pulse", "groove", "hit", "stop", "big", "logo", "button")), "",
      "## Voice phrases (found by silence detection, not by listening)", "", "| # | At | Length | Moved | Best guess | Confidence |", "|---|---|---|---|---|---|"]
for p in TM["phrases"]: md.append("| %d | %.2f | %.2f | %+.2f | %s | %s |" % (p["i"], p["at"], p["end"] - p["at"], p["nudge"], p["guess"], p["confidence"]))
md += ["", "## Shots", "", "| Time | Len | Shot | What happens | Camera | Voice | Waits for |", "|---|---|---|---|---|---|---|"]
for s in out: md.append("| %.1f | %.1f | %s | %s | %s | %s | %s |" % (s["start"], s["dur"], s["name"], s["action"], s["camera"], ", ".join(map(str, s["voice_phrases"])) or "-", s["needs"] or "-"))
open(os.path.join(os.path.dirname(HERE), "SHOTLIST.md"), "w").write("\n".join(md) + "\n")
print(len(out), "shots; longest", max(s["dur"] for s in out[1:-2]), "s; total", total, "; last grid", round(ph + g * hb, 2))
