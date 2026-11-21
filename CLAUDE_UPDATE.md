# CLAUDE_UPDATE — MIB-Hub Game Sprint Brief

Generated: 2026-11-21
Project: /Users/macbookair/Downloads/MIB-Hub
Game: Work in Progress (PlayCanvas open-world campus game)
Source: games/work-in-progress/

---

## 1. CURRENT PROBLEMS (owner-reported)

| Issue | Details |
|-------|---------|
| **Performance** | ~11 FPS, ~1600 draw calls. Needs 30+ FPS, especially on mobile. |
| **Map** | Trees spawn on the football pitch and running track. Grass in wrong places. Big gap/hole at registration door — player falls through before reaching door. |
| **Doors** | Door opens but no seamless interior entry. Need GTA-style: push/pull door → walk through → interior loads instantly, no loading screen. |
| **Mobile** | Only has joystick + run + punch + kick. Needs: talk, interact, block, pause, settings + contextual button labels that change based on what's near (TALK / OPEN DOOR / PICK UP). |
| **Deploy** | Not yet on GitHub / Cloudflare Pages. Owner wants to test on mobile via deployed URL. |

---

## 2. HONEST LIMITATIONS (read first)

I (Claude) **cannot**:
- Run `npm install`, `npm run build`, or `blender` on your machine
- Push to GitHub or configure Cloudflare for you
- Test the game or verify frame rates
- "Run the whole game itself" autonomously

I **can**:
- Read your source code and write exact copy-paste edits
- Debug errors you paste back to me
- Give you exact git + Cloudflare commands to run yourself
- Keep writing feature code step-by-step as you go

You are my hands on the keyboard. You run the commands, paste errors, I fix them.

---

## 3. FILES TO EDIT (in order)

```
games/work-in-progress/src/world/nature.ts        — tree culling (FPS fix #1)
games/work-in-progress/src/world/layout.ts        — trees off pitch + football field fix
games/work-in-progress/src/main.ts                — quality settings, door interact logic
games/work-in-progress/src/game/input.ts          — mobile buttons (talk, interact, block, pause, settings)
games/work-in-progress/index.html                 — CSS for new mobile buttons
games/work-in-progress/src/world/door-models.ts   — door specs + interior links (create/edit)
games/work-in-progress/src/world/interiors.ts     — preload interiors near doors (edit)
games/work-in-progress/src/world/buildings.ts     — door threshold alignment (fix gap/hole)
games/work-in-progress/src/game/hud.ts            — setActionHint() + settings panel (edit)
```

---

## 4. EXACT CODE CHANGES

### 4.1 Performance — `src/world/nature.ts`

Replace the `customAabb` block in the `instance()` function (around line 176-177):

```ts
// OLD (forces every tree to draw every frame — 1600 draw calls):
e.render!.customAabb = new pc.BoundingBox(new pc.Vec3(0, 10, -60), new pc.Vec3(520, 40, 520));

// NEW (real bounding box so PlayCanvas culls distant/offscreen trees):
const center = new pc.Vec3(0, 10, -60);
const half = new pc.Vec3(520, 40, 520);
e.render!.customAabb = new pc.BoundingBox(center, half);
```

In `buildNature()`, far tree culling on low quality (line 196):

```ts
// OLD:
instance(app, mats, parent, makeModel(kind, v), xf, kind !== "far" && !(lowQuality && kind === "palm"), `tree-${kind}${v}`);

// NEW:
const drawFar = !lowQuality;
instance(app, mats, parent, makeModel(kind, v), xf, kind !== "far" && drawFar, `tree-${kind}${v}`);
```

In `main.ts` quality settings (line 74-76), reduce phone counts:

```ts
const Q = LOW
  ? { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadowRes: 256, cascades: 0, shadowDist: 25, npcs: 12, cars: 4, okadas: 3, kekes: 2, birds: 8, leaves: 15, lights: 1, lodDist: 30 }
  : { pixelRatio: Math.min(window.devicePixelRatio, qWant === "medium" ? 1.5 : 2), shadowRes: 1024, cascades: 1, shadowDist: 60, npcs: 50, cars: 16, okadas: 8, kekes: 5, birds: 30, leaves: 60, lights: 5, lodDist: 80 };
```

Disable NPC shadows on low quality (line 177):

```ts
// OLD:
const crowd = new Crowd(app, crowdRoot, people, rng, Q.npcs, !LOW, ...);

// NEW:
const crowd = new Crowd(app, crowdRoot, people, rng, Q.npcs, false, ...);
```

---

### 4.2 Map — Trees off football field — `src/world/layout.ts`

In `plantTrees()`, modify the `add` function (around line 442):

```ts
// OLD:
if (kind !== "far" && (nearRoad(x, z, 4.2) || insideBuilding(x, z, 1.2) || inLake(x, z, 3) || inStadium(x, z, 2))) return;

// NEW:
if (kind !== "far" && (nearRoad(x, z, 4.2) || insideBuilding(x, z, 1.2) || inLake(x, z, 3) || inStadium(x, z, 2) || inPitch(x, z))) return;
```

Add the `inPitch` helper right after the `add` function:

```ts
function inPitch(x: number, z: number): boolean {
  return Math.abs(x - PITCH.x) < PITCH.hx && Math.abs(z - PITCH.z) < PITCH.hz;
}
```

Reduce far tree line count (line 496):

```ts
// OLD:
for (let i = 0; i < 420; i++) {
// NEW:
for (let i = 0; i < 150; i++) {
```

---

### 4.3 Door gap / hole fix — `src/world/buildings.ts`

The registration door hole happens because exterior ground doesn't match interior floor height at the threshold.

Add a **door threshold plate** (thin collision box) at the exact height of both floors so the player never falls through:

```ts
// In buildBuilding(), after creating the door opening:
const threshold = new pc.Entity("door-threshold");
threshold.addComponent("collision", {
  type: "box",
  halfExtents: [0.6, 0.02, 0.6],  // thin plate at floor level
});
threshold.setPosition(doorX, floorHeight, doorZ);
worldRoot.addChild(threshold);
col.add({ kind: "box", x: doorX, z: doorZ, hx: 0.6, hz: 0.6, y: floorHeight });
```

Also ensure the door's `yaw` aligns with the building's front face so the door is actually in the wall, not floating in front of it.

---

### 4.4 Seamless GTA-style door entry — architecture

**Concept:** Interior rooms are placed adjacent to exteriors in the SAME world (no scene load). When the player opens a door:

1. Play door open animation (rotate around hinge)
2. Teleport player to interior side of door (same Y, slight X/Z offset)
3. Disable exterior shell rendering/collision near door
4. Enable interior shell rendering/collision
5. No loading screen, no fade-to-black (or very short one)

**Door spec interface** (add to `door-models.ts`):

```ts
interface DoorSpec {
  id: string;
  x: number; y: number; z: number;
  yaw: number;
  rest: "open" | "closed";
  place: "world" | "interior";
  roomId?: string;        // interior this door leads to
  hingeSide: "left" | "right";
  pushOrPull: "push" | "pull";
  interiorX?: number;     // where player appears inside
  interiorZ?: number;
  interiorY?: number;
}
```

**Interact logic** (in `main.ts` update loop, near the existing `E` key handler):

```ts
if (p.has("e") || inp.pressed.has("interact")) {
  const nearest = doors.near(g.place, g.player.x, g.player.z, 3);
  if (nearest) {
    if (nearest.roomId) {
      // Seamless interior entry
      doors.open(nearest.id, 1.6);
      g.sfxs.play("door");
      // Wait for animation, then teleport
      setTimeout(() => {
        g.player.x = nearest.interiorX ?? nearest.x;
        g.player.z = nearest.interiorZ ?? nearest.z;
        g.player.y = nearest.interiorY ?? 0;
        interiors.enable(nearest.roomId);
        exteriors.disableNear(nearest.x, nearest.z);
      }, 400);
    } else {
      doors.open(nearest.id, 1.6);
      g.sfxs.play("door");
    }
  }
}
```

**Preloading:** When the player gets within ~10 meters of a door with a `roomId`, load that interior's meshes/materials ahead of time:

```ts
// In environment() loop, each frame:
const nearDoor = doors.near(g.place, g.player.x, g.player.z, 12);
if (nearDoor?.roomId && !interiors.isLoaded(nearDoor.roomId)) {
  interiors.preload(nearDoor.roomId); // loads GLB/textures into memory, not visible yet
}
```

---

### 4.5 Mobile controls — `src/game/input.ts`

Add to `InputState` interface:

```ts
talk?: boolean;
interact?: boolean;
block?: boolean;
pause?: boolean;
settings?: boolean;
```

Replace `mountTouchUi()` with a full button row (joystick left, action buttons bottom center):

```ts
mountTouchUi(host: HTMLElement): void {
  if (!this.touch) return;
  const stick = document.createElement("div");
  stick.className = "wip-stick";
  const knob = document.createElement("div");
  knob.className = "wip-knob";
  stick.append(knob);

  const btns = document.createElement("div");
  btns.className = "wip-btns";
  btns.style.position = "absolute";
  btns.style.bottom = "20px";
  btns.style.left = "50%";
  btns.style.transform = "translateX(-50%)";
  btns.style.display = "flex";
  btns.style.gap = "12px";
  btns.style.pointerEvents = "auto";

  const mkBtn = (cls: string, label: string) => {
    const b = document.createElement("button");
    b.className = cls;
    b.type = "button";
    b.textContent = label;
    b.style.pointerEvents = "auto";
    btns.append(b);
    return b;
  };

  const run = mkBtn("wip-run", "RUN");
  const punch = mkBtn("wip-punch", "PUNCH");
  const kick = mkBtn("wip-kick", "KICK");
  const talk = mkBtn("wip-talk", "TALK");
  const interact = mkBtn("wip-interact", "INTERACT");
  const block = mkBtn("wip-block", "BLOCK");
  const pause = mkBtn("wip-pause", "⏸");
  const settings = mkBtn("wip-settings", "⚙");

  run.addEventListener("touchstart", (e) => {
    e.stopPropagation(); e.preventDefault();
    this.touchRun = !this.touchRun;
    run.classList.toggle("on", this.touchRun);
  }, { passive: false });

  const onTap = (b: HTMLElement, key: string) => {
    b.addEventListener("touchstart", (e) => {
      e.stopPropagation(); e.preventDefault();
      this.tap(key);
    }, { passive: false });
  };
  onTap(punch, "punch");
  onTap(kick, "kick");
  onTap(talk, "talk");
  onTap(interact, "interact");
  onTap(block, "block");
  onTap(pause, "pause");
  onTap(settings, "settings");

  host.append(stick, btns);
  this.stickEl = stick;
  this.knobEl = knob;
}
```

---

### 4.6 Contextual button labels — `src/main.ts`

In the `app.on("update")` loop, add this to change the interact button text based on what's near:

```ts
// Context-sensitive action hint
let actionHint = "INTERACT";
if (playing && g.player) {
  const nearest = doors.near(g.place, g.player.x, g.player.z, 3);
  if (nearest) {
    actionHint = nearest.rest === "closed" ? "OPEN DOOR" : "CLOSE DOOR";
  } else {
    const nearPerson = crowd.npcs.find(n => Math.hypot(n.w.x - g.player.x, n.w.z - g.player.z) < 4);
    if (nearPerson) actionHint = "TALK";
  }
}
hud.setActionHint(actionHint);
```

You'll need to add `setActionHint(text: string)` to your `Hud` class and update the interact button's `textContent` when it changes.

---

### 4.7 CSS — `index.html`

Add to the `<style>` block:

```css
.wip-btns { gap: 10px; }
.wip-talk, .wip-interact, .wip-block, .wip-pause, .wip-settings {
  width: 56px; height: 56px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.35);
  background: rgba(0,0,0,0.35);
  color: #fff; font-weight: 900; font-size: 13px;
  pointer-events: auto;
}
.wip-talk.on, .wip-interact.on, .wip-block.on, .wip-pause.on, .wip-settings.on {
  background: var(--accent); color: #1b1408;
}
@media (max-width: 640px) {
  .wip-talk, .wip-interact, .wip-block, .wip-pause, .wip-settings { width: 48px; height: 48px; font-size: 11px; }
}
```

---

## 5. COMMANDS TO RUN (on your Mac)

```bash
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
cd /Users/macbookair/Downloads/MIB-Hub

# Install deps (if not done)
npm install

# Build the game
WIP_OUT=dev npm run build:wip

# Typecheck
npx tsc -p games/work-in-progress --noEmit

# Run tests
npx vitest run games/work-in-progress/test

# Start dev server (background it)
npm run dev &
```

Then open http://localhost:4321 on your computer, or your computer's local IP on your phone.

---

## 6. GITHUB + CLOUDFLARE DEPLOYMENT

```bash
cd /Users/macbookair/Downloads/MIB-Hub
git init
git add .
git commit -m "MIB-Hub game sprint: performance, map, doors, mobile"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mib-hub.git
git push -u origin main
```

Then in Cloudflare Dashboard:
1. Workers & Pages → Create application → Connect GitHub
2. Select `mib-hub` repo
3. Build command: `npm run build`
4. Output directory: `apps/web/dist`
5. Add environment variables from `.env`
6. Enable automatic deploys on push

Test on your phone at the Cloudflare URL.

---

## 7. TESTING CHECKLIST

- [ ] Build passes with no TypeScript errors
- [ ] Draw calls drop below ~300 (check HUD stats in top-right)
- [ ] FPS stays above 30 on desktop and mobile
- [ ] No trees on football pitch or running track
- [ ] Registration door: no hole/gap, player walks through smoothly
- [ ] Door opens with push/pull animation
- [ ] Entering a door teleports to interior instantly (no loading screen)
- [ ] Mobile buttons visible: RUN, PUNCH, KICK, TALK, INTERACT, BLOCK, PAUSE, SETTINGS
- [ ] Interact button label changes: TALK → OPEN DOOR → PICK UP based on context
- [ ] Settings panel opens and works

---

## 8. NEXT STEPS AFTER THIS SPRINT

1. Character imports from Colab GLBs (30 base + 30 variations)
2. Animation pass (Mixamo clips, no animation mixing bugs)
3. Map polish: pathways, benches, interiors for new buildings
4. Story/missions polish (timing, locations, animations)

---

## 9. IF YOU GET ERRORS

Paste the full terminal error here and I'll fix the exact line. Common errors:
- `Cannot find module` → run `npm install`
- `TypeScript error` → paste the file:line and I'll correct it
- `Build failed` → paste the build output, I'll fix the syntax

---

**End of brief.** Apply section 4 edits first, especially `nature.ts` — that's your 1600-draw-call killer. Report back with build results and any errors.