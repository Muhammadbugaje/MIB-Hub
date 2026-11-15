"""Arcade cheat defaults: the plain codes live only here and in docs/ARCADE_CHEATS.md.
Run `python games/cheat_defaults/build.py` after editing: it writes <slug>.json, refreshes the hash tables inside each
game's script (between /*CH[*/ and /*]CH*/) and rewrites the docs page. Shipped JavaScript only ever holds hashes."""
import hashlib, json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
HERO = {"name": "M.I. BUGAJE", "full": "Muhammad Iliyasu Bugaje", "combo": "Up Up Down Down Left Right M I B", "swipe": "Up Up Down Left Right"}
COMMON = [("slow", "Slow motion for a while", "{p}slow3", "*{n}3#", "Cosmetic and helpful."),
          ("party", "Confetti storm", "{p}yay5", "*{n}5#", "Cosmetic only.")]
GAMES = {
    "momentum-cup": ("kickoff.js", "Momentum Cup", "mc", "21", [
        ("skip", "Win this match", "mcwin9", "*219#", "Ends the match with you one goal ahead. Also the maker's skip key."),
        ("goal", "Free goal", "mcgol1", "*211#", "Adds one goal to your score."),
        ("power", "Superpower always ready", "mcpow7", "*217#", "Your power meter stays full."),
        ("wall", "Your goal is sealed", "mcwal4", "*214#", "Shots at your goal bounce out."),
        ("freeze", "Rival frozen for 8 s", "mcice8", "*218#", ""),
        ("time", "+30 seconds", "mctim6", "*216#", ""),
        ("arenas", "Every arena open", "mcall2", "*212#", "Until you leave the page."),
        ("coins", "+5,000 career coins", "mccash5", "*2150#", "Career mode: added to your club's bank."),
        ("squad", "Every non-legend player signed", "mcsign3", "*2130#", "Career mode: legends still have to be earned.")],
     "Maxed speed, jump and kick; superpower always ready; his goal is sealed, so he cannot concede; every arena open."),
    "impulse-arena": ("clash.js", "Impulse Arena", "ia", "42", [
        ("skip", "Win this round", "iawin9", "*429#", "Knocks the rival out now. Also the maker's skip key."),
        ("god", "Take no damage", "iagod1", "*421#", ""),
        ("onehit", "One-hit knockouts", "iaone7", "*427#", ""),
        ("meter", "Super meter always full", "iamet4", "*424#", ""),
        ("heal", "Full health now", "iahp08", "*428#", ""),
        ("bosses", "Bosses playable", "iabos6", "*426#", "Unlocks Inertia, Entropy and Baron Overload."),
        ("tower", "Jump to this chapter's boss", "iatop2", "*422#", "Moves your Circuit run to rung 10 of the current chapter."),
        ("roster", "Every fighter unlocked", "iaall3", "*420#", "Until you leave the page.")],
     "Wears white and gold over the fighter you pick; takes no damage, knocks out in one hit, super meter always full."),
    "kinetic-kingdom": ("platformer.js", "Kinetic Kingdom", "kk", "55", [
        ("skip", "Clear this level", "kkwin9", "*559#", "Also the maker's skip key."),
        ("god", "Cannot be hurt", "kkgod1", "*551#", ""),
        ("lives", "99 lives", "kkliv7", "*557#", ""),
        ("time", "The clock never runs out", "kktim4", "*554#", ""),
        ("unlock", "Every level open", "kkall8", "*558#", "Until you leave the page."),
        ("shield", "Shield for 30 s", "kkshd6", "*556#", "")],
     "Cannot be hurt, never runs out of lives or time, every level open."),
    "wavefront": ("shooter.js", "Wavefront", "wf", "73", [
        ("skip", "Clear this stage", "wfwin9", "*739#", "Also the maker's skip key."),
        ("god", "Cannot be hurt", "wfgod1", "*731#", ""),
        ("guns", "Every weapon at level 3", "wfgun7", "*737#", ""),
        ("lives", "9 lives", "wfliv4", "*734#", ""),
        ("cont", "9 continues", "wfcon8", "*738#", ""),
        ("unlock", "Every stage open", "wfall6", "*736#", "All 12 stages.")],
     "Cannot be hurt, carries every weapon at level 3, every stage open."),
    "induction-dash": ("dash.js", "Induction Dash", "id", "36", [
        ("skip", "Finish this run", "idwin9", "*369#", "Also the maker's skip key."),
        ("god", "Hits cost no hearts", "idgod1", "*361#", ""),
        ("hearts", "Hearts refilled", "idhrt7", "*367#", ""),
        ("boost", "Top speed now", "idbst4", "*364#", ""),
        ("energy", "Target energy banked", "idjul8", "*368#", ""),
        ("unlock", "Every track and cart open", "idall6", "*366#", "Opens all 30 tracks and all five carts.")],
     "Hits cost no hearts, always above cruising speed, every track and cart open."),
    "volt-city": ("fieldbound.js", "Volt City", "vc", "84", [
        ("skip", "Restore the next district", "vcwin9", "*849#", "Also the maker's skip key."),
        ("god", "Cannot be hurt", "vcgod1", "*841#", ""),
        ("heal", "Battery full", "vchp07", "*847#", ""),
        ("dash", "Dash never cools down", "vcdsh4", "*844#", "")],
     "Cannot be hurt, dash never cools down, can restore any district at once."),
    "light-bender": ("bender.js", "Light Bender", "lb", "17", [
        ("skip", "Solve and finish this level", "lbwin9", "*179#", "Also the maker's skip key."),
        ("solve", "Show the solution", "lbsol1", "*171#", "Turns the mirrors to a working answer."),
        ("moves", "Reset the turn counter", "lbmov7", "*177#", ""),
        ("stars", "Three stars for this level", "lbstr4", "*174#", ""),
        ("last", "Jump to the last level", "lbend8", "*178#", "")],
     "No characters here: maker mode shows the solution, skips any level and jumps anywhere."),
    "circuit-forge": ("forge.js", "Circuit Forge", "cf", "62", [
        ("skip", "Solve and finish this circuit", "cfwin9", "*629#", "Also the maker's skip key."),
        ("solve", "Fit the right parts", "cfsol1", "*621#", "Fills every slot with a working answer."),
        ("tries", "Reset the switch-on counter", "cftry7", "*627#", ""),
        ("stars", "Three stars for this circuit", "cfstr4", "*624#", ""),
        ("last", "Jump to the last circuit", "cfend8", "*628#", "")],
     "No characters here: maker mode fits the right parts, skips any circuit and jumps anywhere."),
    "logic-labyrinth": ("logic.js", "Logic Labyrinth", "ll", "95", [
        ("skip", "Solve and finish this room", "llwin9", "*959#", "Also the maker's skip key."),
        ("solve", "Wire the answer", "llsol1", "*951#", "Places a working set of gates."),
        ("moves", "Reset the move counter", "llmov7", "*957#", ""),
        ("stars", "Three stars for this room", "llstr4", "*954#", ""),
        ("last", "Jump to the last room", "llend8", "*958#", "")],
     "Maker mode wires the answer, skips any room and jumps anywhere; he also appears as a selectable avatar."),
    "signal-surfer": ("surfer.js", "Signal Surfer", "ss", "77", [
        ("skip", "Deliver this message", "sswin9", "*779#", "Also the maker's skip key."),
        ("battery", "Battery refilled", "ssbat4", "*774#", ""),
        ("time", "+20 seconds", "sstim6", "*776#", ""),
        ("clear", "Interference cleared", "ssclr2", "*772#", "Removes every interferer from this channel."),
        ("engineer", "Auto-engineer for 30 s", "sseng7", "*777#", "Picks frequency, power and rate for you."),
        ("unlock", "Every channel open", "ssall8", "*778#", "")],
     "Surfs on the auto-engineer: frequency, power and rate set for him every half second; every channel open."),
    "maglev-rescue": ("maglev.js", "Maglev Rescue", "mr", "64", [
        ("skip", "Deliver this pod", "mrwin9", "*649#", "Also the maker's skip key."),
        ("design", "Engineer's gains fitted", "mrpid1", "*641#", "Pole-placement gains for this line."),
        ("shield", "Rail contact forgiven", "mrshd7", "*647#", ""),
        ("calm", "Gusts and sensor noise off", "mrcal4", "*644#", ""),
        ("light", "Payloads removed", "mrlit2", "*642#", ""),
        ("unlock", "Every line open", "mrall8", "*648#", "")],
     "Holds the gap with pole-placement gains on every line; every line open."),
    "drive-room": ("driveroom.js", "Drive Room", "dr", "53", [
        ("skip", "Job done", "drwin9", "*539#", "Also the maker's skip key."),
        ("auto", "Engineer's settings fitted", "draut1", "*531#", "Cheapest suitable converter and a tuned speed loop."),
        ("budget", "+1000 budget", "drcsh7", "*537#", ""),
        ("notrip", "Overcurrent trip off", "drtrp4", "*534#", ""),
        ("tol", "Tolerance tripled", "drtol2", "*532#", ""),
        ("unlock", "Every job open", "drall8", "*538#", "")],
     "Gets the engineer's converter and gains on every job; every job open."),
}


def norm(code):
    return re.sub(r"\s+", "", code.lower())


def h(slug, code):
    return hashlib.sha256((slug + ":" + norm(code)).encode()).hexdigest()


def tokens(seq):
    """'Up Up Down Left' -> 'uudl': the form the runtime hashes for the reveal combo and swipe."""
    m = {"up": "u", "down": "d", "left": "l", "right": "r"}
    return "".join(m.get(w, w if len(w) == 1 else "") for w in re.split(r"[\s,]+", seq.lower()))


def table(slug):
    """What a page config or a game's built-in defaults hold: hashes only."""
    _, _, p, n, cheats, _ = GAMES[slug]
    out = {}
    for cid, _, typed, dial, _ in cheats + [(c[0], c[1], c[2].format(p=p), c[3].format(n=n), c[4]) for c in COMMON]:
        out[cid] = [h(slug, typed), h(slug, dial)]
    out["_combo"] = hashlib.sha256((slug + ":combo:" + tokens(HERO["combo"])).encode()).hexdigest()
    out["_swipe"] = hashlib.sha256((slug + ":swipe:" + tokens(HERO["swipe"])).encode()).hexdigest()
    return out


def main():
    doc = ["# Arcade cheat codes and the hidden maker character", "",
           "Private to the owner. The shipped JavaScript holds only SHA-256 hashes of `slug:code`; the plain codes are in this file and in `games/cheat_defaults/*.json`.", "",
           "**How to enter a code.** On a keyboard, type it while playing (not in a menu). On a phone, open Settings in the game toolbar and use the Code box; the `*…#` dial form is easier there. A small \"Cheat on\" note confirms it. A session that used a code or the maker character does not save its result or reach the leaderboard unless `cheatsOnBoards` is switched on in the page config.", "",
           "**The hidden character, M.I. BUGAJE (Muhammad Iliyasu Bugaje).** White and gold, initials MIB on his headband. On any game's title or character-select screen, press **Up, Up, Down, Down, Left, Right, M, I, B** on a keyboard, or swipe **up, up, down, left, right** on a phone. A box asks for the maker's code; the server checks it (`/arcade/api/hero/`), and once it passes he is remembered on that device and appears in every character picker. While he is in play a gold **MIB ⏭** button (or the backquote key) skips to the end of the current match, level or puzzle.", "",
           "Freshers School Life has its own list in `docs/FSLG_CHEATS.md`.", ""]
    for slug, (js, title, p, n, cheats, hero) in GAMES.items():
        allc = cheats + [(c[0], c[1], c[2].format(p=p), c[3].format(n=n), c[4]) for c in COMMON]
        data = {"cheats": [{"id": c[0], "label": c[1], "typed": c[2], "dial": c[3], "note": c[4]} for c in allc],
                "hero": dict(HERO, powers=hero)}
        (HERE / (slug + ".json")).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
        path = ROOT / "static" / "js" / "games" / js
        src = path.read_text(encoding="utf8")
        new, k = re.subn(r"/\*CH\[\*/.*?/\*\]CH\*/", lambda m: "/*CH[*/" + json.dumps(table(slug), separators=(",", ":")) + "/*]CH*/", src, flags=re.S)
        if k == 1 and new != src:
            path.write_text(new, encoding="utf8")
        doc += ["## " + title + " (`" + slug + "`)", "", "| Effect | Type | Dial | Note |", "|---|---|---|---|"]
        doc += ["| " + c[1] + " | `" + c[2] + "` | `" + c[3] + "` | " + c[4] + " |" for c in allc]
        doc += ["", "**M.I. BUGAJE here:** " + hero, ""]
    (ROOT / "docs" / "ARCADE_CHEATS.md").write_text("\n".join(doc), encoding="utf8")


if __name__ == "__main__":
    main()
