# MIB-Hub port spec: visual design of the old site

Source: the Django site at `/Users/macbookair/Downloads/eehub-2` ("EE Hub", Department of Electrical
Engineering, Ahmadu Bello University, Zaria). All paths below are relative to that folder unless
they start with `MIB-Hub/`. Values are quoted exactly from the source files. Nothing in the old
site was changed to write this.

Contents

1. Design in one paragraph
2. Page shells (base layouts) and their regions
3. Partials
4. Guides hub
5. Learning arcade pages
6. Responsive behaviour
7. CSS inventory and load order
8. Design tokens (light and dark)
9. Theme toggle and flash prevention
10. Motion: keyframes, transitions, reduced motion
11. Icons, images, fonts, logo
12. Intent from the design docs
13. Screenshot-worthy pages
14. Surprises and traps
15. Token map for MIB-Hub

---

## 1. Design in one paragraph

Three faces share one token set (`static/css/tokens.css`):

- **Public website** (`base_public.html`): dark-green, "electric" look. It has a frosted sticky
  header with the ABU crest, the gear-and-bolt EE mark and a two-line lockup. Heroes are full-bleed
  and dark (circuit art, WebGL scenes), headline words carry a gold→cyan gradient, primary buttons
  are a gold gradient, and the footer has a gold/cyan sine wave.
- **Portal** (`base.html`): calm and Apple-like ("Phase 6 Apple Liquid Glass", `static/css/apple.css`).
  The ground is warm paper (`#f5f2ed` light / `#070b09` dark) with white cards, hairline borders
  and soft shadows. The sidebar uses frosted glass and coloured gradient icon tiles per nav group.
  The topbar is glass with a search pill. Below 1024px a floating glass tab bar appears at the bottom.
- **Auth** (`base_auth.html`): split screen, with circuit art on the left and a card on the right.

Typography: Inter for body text, Poppins for headings (bold, negative tracking), JetBrains Mono
for code and "terminal" accents. All three fonts are self-hosted. The brand colours are ABU green
(`#1a6b45`, deep `#0f3d2e`), ABU gold (`#c8a951`) and "volt" cyan (`#38e1f5`).

---

## 2. Page shells

### 2.1 `templates/partials/head.html` (shared by all three shells)

The head loads these, in this order:

- meta charset and viewport (`viewport-fit=cover`), and `color-scheme: light dark`.
- Two `theme-color` metas: `#f5f2ed` for light and `#070b09` for dark.
- OG tags, a favicon from `{% url 'config:favicon' %}?v=ee6` (SVG), `favicon-32.png`, a manifest and
  `apple-touch-icon`. A view can override `app_manifest`, `app_icon` and `app_title`, so each arcade
  game installs as its own PWA.
- `pwa.css` and `pwa.js` (deferred).
- A preload of `fonts/inter-var.woff2`.
- For signed-in users, an inline `window.EE_PREFS={theme:"…",motion:true|false}`, followed by the
  synchronous `js/theme-init.js` (section 9).
- The CSS core in this order: `fonts.css` → `tokens.css` → `base.css` → `layout.css` →
  `components.css` → `utilities.css` → `animations.css`.

### 2.2 Portal shell: `templates/base.html`

```
<html data-view="auto">                      (data-theme / data-motion added by theme-init.js)
body.ee-app[.impersonating]
 ├─ a.skip-link → #app-content
 ├─ impersonation banner (partials/impersonation_banner.html, amber band)
 ├─ .ee-site-banner--{tone}  (optional site-wide message, megaphone icon)
 ├─ #page-loader .page-loader  (logo 44px + indeterminate bar; hidden by default since Phase 6)
 ├─ .app-shell  (CSS grid)
 │   ├─ .app-sidebar-backdrop
 │   ├─ partials/sidebar.html   → aside.app-sidebar.ee-sidebar
 │   └─ .app-main (flex column)
 │       ├─ partials/topbar.html → header.app-topbar
 │       ├─ main.app-content#app-content  (profile nudge + {% block content %})
 │       └─ footer.app-footer  (© year · dept · org · footer_note + view switch)
 ├─ partials/mobile_tabbar.html  (authenticated only)
 └─ partials/toasts.html
```

The page adds these stylesheets after head.html: `notifications.css`, `users.css`, `search.css`,
`{% block extra_css %}`, then `apple.css`, `polish.css`, `ee.css`, `forms.css`, `tiles.css`,
`shell.css`, `alive.css`, `a11y.css`, `standards.css`, `sweep.css`. Note that module CSS comes
before the design layers, so the design layers win.

Scripts are htmx (`static/vendor/htmx.min.js`), `app.js`, `ui.js`, `dialog.js`,
`notifications.js`, `apple.js`, `ee.js`, the extra JS block, `polish.js`, `shell.js`, `alive.js`,
`ux_scripts.html`, `a11y.js` and `sweep.js`. All are deferred.

Grid (`static/css/layout.css`):

- `.app-shell` is `grid-template-columns: minmax(0,1fr)` with `min-height: 100dvh` and
  `background: var(--bg)`.
- At 1024px and up it becomes `var(--sidebar-w) minmax(0,1fr)` (`--sidebar-w: 260px`). The
  collapsed state is `68px minmax(0,1fr)`.
- **Sidebar below 1024px** is an off-canvas drawer. It is `position: fixed`, `width: min(18rem, 86vw)`
  and `transform: translateX(-104%)`, and it opens with `.app-shell.sidebar-open`. The transition is
  `transform var(--dur-slow) var(--ease-emphasized)`, the shadow is `--shadow-xl`, and the backdrop
  uses `var(--overlay)` with `blur(8px)`.
- **Sidebar from 1024px** is `position: sticky; top: 0`. Its background is `var(--surface-glass)`
  with `backdrop-filter: saturate(180%) blur(18px)`.
- **Topbar** is sticky, `height: var(--topbar-h)` (64px), with `background: var(--surface-glass)`,
  `saturate(180%) blur(18px)` and a bottom hairline. apple.css makes the hairline transparent until
  the page scrolls.
- **Content** is `max-width: var(--content-full)` (1440px). Padding is
  `var(--space-5) var(--space-4) var(--space-8)`, then `space-6/5/8` at 768px or wider, and
  `padding-inline: var(--space-7)` at 1280px or wider.
- **Footer** is a flex row with wrapping, `font-size: var(--fs-xs)`, `color: var(--text-subtle)`, a
  top border of `var(--divider)` and padding that respects the bottom safe area.

### 2.3 Public shell: `templates/base_public.html`

```
body.public-body.pub[.is-calm]  data-fx-motion=full|reduced|off  data-fx-text=1|0  data-fx-scroll=1|0
 ├─ skip-link → #main, impersonation banner, site banner
 ├─ header.pub-nav [data-pub-nav]  (block nav_class; the home page adds .pub-nav--overlay)
 │   ├─ .pub-nav__bar  (max 1320px, 68px tall)
 │   │   ├─ a.pub-brand: ABU crest (light + white variants, 44px) · rule · EE mark 52px ·
 │   │   │               lockup "<b>Electrical Engineering</b><small>Ahmadu Bello University, Zaria</small>"
 │   │   ├─ nav.pub-links: Home · About▾ · Academics▾ · Students▾ · Community▾ · (config top links) · Contact
 │   │   │     each ▾ is .pub-menu with a .pub-menu__panel dropdown (icon 16 + label rows)
 │   │   └─ .pub-actions: Ask button (assistant) · theme toggle (sun/moon) ·
 │   │                    Sign in (gold, opens the quick sign-in modal) / Dashboard · burger
 │   └─ .pub-drawer (mobile): right panel, lockup + theme toggle + close, grouped links, gold CTA foot
 ├─ main#main.pub-main
 ├─ footer.pub-footer
 │   ├─ svg.pub-footer__wave  (two sine paths, stroke #c8a951 and #38e1f5, 1.5px)
 │   └─ .pub-wrap > .pub-footer__grid: about (EE mark 72, lockup, white crest 52, address,
 │        mail/phone/clock list) · Department · Academics · Community · "EE Hub portal" (gold CTA)
 │      .pub-footer__bottom: © line · footer note · "Powered by EE Hub" with a 22px mark
 ├─ #ee-signin  quick sign-in dialog (crest + mark, identifier/password, remember, forgot)
 └─ toasts
```

The page adds `apple.css`, `polish.css`, `ee.css`, `public.css` (148 KB, the largest file),
`fx.css`, the extra CSS block, then `a11y.css`, `standards.css` and `sweep.css`.

Scripts are `app.js`, `dialog.js`, `ee.js`, `public.js`, `fx/reveal.js`, the extra JS block,
`polish.js`, `a11y.js` and `sweep.js`.

Public layout variables (`static/css/public.css` lines 7–17):

- `--pub-wrap: 1240px`
- `--pub-gutter: clamp(16px, 4vw, 40px)`
- `--pub-nav-h: 68px`
- `--pub-radius: 22px`

`.pub-wrap` is `width: min(var(--pub-wrap), 100% - 2*var(--pub-gutter))`.

Header details:

- `.pub-nav::before` is the glass layer: `var(--pub-glass)` with `blur(18px) saturate(150%)` and a
  bottom border.
- The **overlay variant** (`.pub-nav--overlay`, home page) is `position: fixed` and starts 18px from
  the top. Its bar is a rounded (20px) dark pill with
  `linear-gradient(180deg, rgba(10,34,27,.78), rgba(7,26,21,.7))`, white text and a gold
  `inset 0 -2px 0` underline on the active link. It becomes glass once `.is-scrolled` is set.
- Dropdown panels are 250px minimum width, 8px padding and 16px radius. Their rows have an 11px
  radius, 13.5px / 550 type, and turn `--primary-subtle` on hover.

Buttons:

- `.pub-btn` is 44px high, 18px padding, 13px radius, weight 650, 14px text.
- `--gold` uses `linear-gradient(135deg, #f0dc9c, var(--gold-500) 60%, #b8963d)` with text
  `#1d1503`.
- `--glass` uses `rgba(19,196,220,.10)` with border `rgba(126,240,255,.45)` and text `#dffbff`.

### 2.4 Auth shell: `templates/base_auth.html`

`body.ee-auth` is a two-column page:

- `.ee-auth__art` (decorative) holds `img/hero-scene.svg` plus copy: a crest with the EE mark 46px,
  the organisation as the kicker, the department and the tagline.
- `main.ee-auth__main` holds a "← Back to the website" link, then `.ee-auth__card` (block content),
  then a foot line.

The page adds `apple.css`, `ee.css`, `auth-ee.css` (2 KB), `ux.css`, the extra CSS block and
`a11y.css`. `auth.css` (17.5 KB) is the older auth sheet and is loaded by individual pages.
Scripts are `app.js`, `ee.js`, `password-tools.js` and `a11y.js`. There is no sidebar and no
theme toggle; the theme follows `theme-init.js`.

### 2.5 Other shells (for completeness)

- `templates/cbt/base_exam.html`: a distraction-free exam screen.
- `templates/university/base.html`: the `/abu/` microsite.
- `templates/knowledge/tools/base.html`.
- `templates/emails/base_email.html` and `templates/email/base_email.html`.
- `templates/games/base_app.html` and `base_guest.html` (section 5).
- `templates/games/lan.html`, which is standalone (section 5).

---

## 3. Partials (`templates/partials/`)

| File | Lines | Role |
|---|---:|---|
| `head.html` | 34 | See 2.1. |
| `sidebar.html` | 71 | `aside.app-sidebar.ee-sidebar`. Header: lockup `a.app-brand.ee-lockup` (EE mark 46px + "Electrical Engineering" / "Ahmadu Bello University") and a close button. `profile_switch.html` (segmented control) when the user has 2+ profiles. An `.ee-acting` "Acting as" card with an `.ee-tile` and office chips `.ee-chip--{color}` (3 at most, then "+N"). `nav.app-nav.ee-nav`: top items, then collapsible `.app-nav-group[data-tone]`, each with a gradient `.ee-tile--sm` icon (14px glyph), a title, a count badge and a chevron. Items take the group's tone, and office items get their own `.ee-tile--xs`. Footer: Django admin (staff), Public website, "Install EE Hub" (PWA, hidden until available), and the view switch. |
| `topbar.html` | 102 | Burger (`.mobile-only`); `.app-topbar-title`; `form.app-topsearch` (search icon, input "Search people, pages, news…", `kbd` "/", shortcut `/` or Ctrl/⌘+K); Ask button; phone search button; `.ee-swap` one-tap profile swap; notification bell with `.notif-badge` and dropdown (skeleton rows while loading); theme toggle; `.app-user.ee-switcher` (avatar or initials, "Acting as" + label, chevrons) with a dropdown of profiles (forms), My profile, Change password, guide link, Install, an Act-as search (superusers), and Sign out (danger). Signed out: a "Sign in" pill. |
| `mobile_tabbar.html` | 45 | `nav.app-tabbar.ee-tabbar` with `.app-tabbar__inner`, tabs from `core/nav.py` TABBAR (22px icon, label, red badge capped at "99+"), a Switch tab (2 profiles: one-tap form; 3 or more: a `<details>` sheet), and a final "Menu" tab that opens the drawer. It hides on scroll down (`shell.js`). |
| `view_switch.html` | 7 | Segmented "Layout: Auto · Desktop · Mobile" (sets `html[data-view]`, stored as `ee-view`). |
| `toasts.html` | 1 | Turns Django messages into hidden `span[data-toast]`; JS turns those into toasts. |
| `page_header.html` | 7 | `{% page_header title description eyebrow icon_name %}` inclusion. |
| `empty_state.html` | 15 | Empty state (icon + text + action). |
| `field.html`, `form_fields.html` | 13 / 1 | Form field rendering. |
| `pager.html` | 8 | Pagination. |
| `profile_nudge.html` | 15 | "Complete your profile" nudge at the top of content. |
| `profile_switch.html` | 21 | Sidebar segmented profile control. |
| `impersonation_banner.html` | 12 | Amber band (`--impersonation-band`, text `--amber-ink #1a1200`). |
| `community_hub.html`, `ux_scripts.html` | 6 / 5 | Misc. |

There are other `partials/` folders under `research/`, `cbt/`, `association/`, `content/`
(including `fx_scene.html` and `fx_marquee.html`), `university/`, `messaging/` and `elections/`.
These are module-level and not part of the shell.

---

## 4. Guides hub

- `templates/guides/hub.html` extends `base.html` (portal).
- `templates/guides/hub_public.html` extends `base_public.html` and wraps the body in
  `.gd-public > .gd-wrap`.
- `.gd-public` has `padding: 26px 0 60px`.
- `.gd-wrap` is `width: min(1180px, calc(100% - 32px))`.
- Both pages include `templates/guides/_hub_body.html`, styled by `static/css/guides.css` (15 KB,
  prefix `.gd-`).

Structure of `_hub_body.html`:

1. **`.gd-hero`**
   - Shape: 24px radius, padding `28px clamp(18px,4vw,40px)`.
   - Background: `radial-gradient(120% 140% at 100% 0%, rgba(200,169,81,.35), transparent 55%), linear-gradient(135deg, var(--brand-700), var(--brand-500))`, white text, `--shadow-md`.
   - Contents:
     - A huge `life-buoy` icon (220px) at 14% opacity in the bottom-right corner.
     - An eyebrow in gold `#f3dc94`: 12px / 700, `.08em` tracking, uppercase.
     - H1 in Poppins at `clamp(24px,3.4vw,34px)`, personalised when signed in ("How can we help, X?").
     - A search field: 50px high, 14px radius, white, gold focus outline `#e8c45a`.
     - Handbook PDF buttons (`.gd-book`).
2. **`.gd-filters`**: pill chips (`.gd-chip`). The pressed chip is `--brand-700` with white text:
   For you · All (count) · per-audience.
3. **Featured** ("Start here" or "Popular guides"): `.gd-featured` holds compact `.gd-feat` rows with
   a 34px icon, a title and "N steps · M min".
4. **Areas** (`.gd-area.gd-tone-{tone}`):
   - A head with a 46px tinted icon square (`.gd-ic`, 14px radius, background `var(--tb)`, colour
     `var(--t)`), an H2 and a blurb.
   - A `.gd-grid` (`repeat(auto-fill, minmax(270px,1fr))`, gap 14px) of `.gd-card`.
   - Cards have an 18px radius and `--shadow-xs`, and on hover `translateY(-3px)` with `--shadow-md`.
   - Card foot: an audience pill, "N steps", "with pictures", "M min", and a lock for staff-only guides.
5. Empty search state and a "Still stuck?" help line.

Guide tones (`guides.css` lines 4–13), as `--t` / `--tb`:

| Tone | `--t` | `--tb` |
|---|---|---|
| green | `#1a6b45` | `rgba(26,107,69,.12)` |
| gold | `#a87b12` | `rgba(200,169,81,.18)` |
| volt and teal | `#0e7c86` | `rgba(14,124,134,.13)` |
| plum and purple | `#7a3db8` | `rgba(122,61,184,.12)` |
| blue | `#2563c9` | `rgba(37,99,201,.12)` |
| indigo | `#4b4fc4` | `rgba(75,79,196,.12)` |
| pink | `#c23a7a` | `rgba(194,58,122,.12)` |
| orange | `#c25a12` | `rgba(194,90,18,.13)` |
| slate | `#4a5a66` | `rgba(74,90,102,.13)` |
| red | `#b42318` | `rgba(180,35,24,.12)` |

In dark mode every `--t` becomes `#8fd6b0`, so all tones turn mint and the tints stay as they are.
JS (`js/guides.js`) filters cards live by search and audience. Each guide has illustrated steps
under `static/img/guides/<slug>/` (51 folders).

---

## 5. Learning arcade (`/arcade/`)

Stylesheet: `static/css/games.css` (26.5 KB, prefix `.gm-`; `.fs-` for the FSLG game; `.gm-cer-`
for the ceremony overlay), plus `games-settings.css` (7.6 KB, `.gs-`) and `fslg-admin.css`.
The game chrome uses site tokens. The game stage is always a dark "screen".

The templates differ only in their base:

- `templates/games/base_app.html` extends `base.html`. `{% block arcade_wrap %}` sits inside
  `content`, so you get the portal shell with sidebar, topbar and tab bar.
- `templates/games/base_guest.html` extends `base_public.html`. It wraps the content in
  `main.gm-guest-shell` (`width: min(1180px, 100% - 32px); margin: 24px auto 48px; grid gap 20px`)
  with a `.gm-guest-bar` ("Playing as **name** (guest)" + Sign out).
- Each page does `{% extends base_template|default:"games/base_app.html" %}`. The view picks one.

| Template | What it shows |
|---|---|
| `index.html` | `.gm-page` (grid, gap 22px, `--gm-a: #3dd68c`). See the rows below. |
| `guest.html` | Extends `base_public.html` directly: guest hero (`.gm-hero--guest`), then `.gm-two` with two `.gm-panel.gm-form` forms ("I've played before" / "New guest player", name + reg number + 4–6 digit PIN), a closed state and `.gm-alert` errors. |
| `leaderboard.html` | `.gm-bar` (back button, H1, All time / This week segmented control), an XP table `.gm-board--wide`, and a grid of per-game `.gm-panel`s each tinted by `--gm-a`. |
| `locked.html` | A single `.ee-empty` message ("opens at N level"). |
| `play.html` | `.gm-page.gm-play` with `--gm-a` set to the game accent. See the rows below. |
| `lan.html` | **Standalone HTML** with its own inline tokens: light `--bg #f6f7fb`, `--card #fff`, `--ink #14213d`, `--muted #5b6475`, `--acc #f59e0b`, `--line #e3e6ee`; dark `#0f1420 / #171e2d / #eef2f8 / #a3adbf / --line #2a3346`. system-ui font, 520px card, amber 44px button. It receives a Wi-Fi pairing code via BroadcastChannel `ee-arcade-lan`. |

`index.html`, from top to bottom:

- **`.gm-hero`**:
  - Two columns: text, plus a 420×200 `canvas[data-gm-cast]` with the animated cast.
  - Shape and colour: 18px radius, text `#e8fff4`.
  - Background: `radial-gradient(80% 140% at 85% 30%, rgba(61,214,140,.22), transparent 60%), linear-gradient(135deg, #0c4a35, #08291f 50%, #061423)`.
  - H1: `clamp(26px,4vw,38px)`.
  - Note pill: `rgba(255,255,255,.08)`.
  - "Arcade Management" link for managers.
- **`.gm-me`** profile strip (`grid auto 1fr auto`):
  - Level number.
  - Rank, plus an XP bar `.gm-xp` that is 10px high and filled with
    `linear-gradient(90deg, #3dd68c, #7ef0ff)`. The width animates over 1s with `cubic-bezier(.2,.8,.2,1)`.
  - Coins.
- **`.gm-story`**: a villain canvas (96px) and story text on purple
  (`radial-gradient(... rgba(192,132,252,.28) ...), linear-gradient(135deg, #1a0b2e, #2d1450)`,
  text `#efe6ff`).
- **`.gm-filters`**: pill buttons (13.5px, 999px radius). The active one (`.is-on`) is filled with
  `--primary`. Filters: Explore · Quick play · Puzzle · Physics · Versus · Open worlds · My level.
- **Shelves per level**:
  - `.gm-shelf` has an H2 with "Opens when…". A locked shelf drops to 0.62 opacity.
  - `.gm-grid` is `repeat(auto-fill, minmax(260px,1fr))` with gap 16px.
  - `.gm-card` is a 150px art row plus a body, with a 16px radius. `.is-ready:hover` lifts by 3px,
    takes `--gm-a` as the border colour and adds a `--gm-a` glow shadow.
  - The art is drawn on a canvas (`data-gm-art`) over `linear-gradient(160deg, #0b1f2a, #071018)`.
  - The body holds the genre (in the accent colour), title, pitch, course chips (`.gm-chip`), mode
    chips, a time chip, controls, and "Play now" (`.btn.btn-primary.btn-sm`) or a lock status.
- **`.gm-two`**:
  - Shop: swatches, buy/wear buttons, coin prices.
  - Badges.
- **Leaderboards panel**:
  - Rank badges are gold `#f6c445/#3a2a00`, silver `#cfd6de/#222` and bronze `#d79a63/#2a1606`.
  - The player's own row is `.is-me`.
  - Guest and "cheat" tags.
  - An opt-out checkbox.

`play.html`, from top to bottom:

- **`.gm-bar`** toolbar: back, title, course chips, Manage, offline/install slots, Wi-Fi play
  (FSLG only), Pause, Settings, Full screen, Sound on/off, a volume slider.
- **`.gm-stage`**:
  - Size and colour: 16:9, `max-height: 78vh`, 18px radius, `#050c12`.
  - At 760px or narrower it switches to `aspect-ratio: auto; height: min(70vh,120vw)` with full
    bleed (`margin: 0 -16px`, no radius).
  - Contents: `canvas.gm-canvas`, `.gm-hud` (`aria-live`), `.gm-overlay` (dialogs `.gm-dlg`) and
    `.gm-touch` (on-screen controls).
- **`.gm-under`**: two panels, "The physics" and "Controls".

Per-game accents (`games/catalogue.py`, the `accent` field; default `#3dd68c`):

| Game | Accent |
|---|---|
| Momentum Cup | `#3dd68c` |
| Impulse Arena | `#f6c445` |
| Volt City | `#7ef0ff` |
| Kinetic Kingdom | `#4ade80` |
| Wavefront | `#7ef0ff` |
| Freshers School Life (`samaru-days`) | `#f59e0b` |
| Motorworks Trails | `#f6c445` |
| Gridkeepers: Storm Map | `#ffd84a` |
| Induction Dash | `#ffd86b` |
| Logic Labyrinth | `#7ef0ff` |
| Signal Surfer | `#7ef0ff` |
| Circuit Forge | `#e9c46a` |
| Light Bender | `#ff8080` |
| Maglev Rescue | `#a78bfa` |
| Algorithm Garage | `#7ef0ff` |
| Drive Room | `#ffb347` |

---

## 6. Responsive behaviour

Documented breakpoints (in a comment in `tokens.css`): sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1536.

**Portal.**

- From 1024px up, the sidebar is persistent.
- Below 1024px:
  - The sidebar is a drawer.
  - The floating tab bar appears (`apple.css` §5): `position: fixed`, inset 10px, bottom
    `max(10px, safe-area)`, `max-width: 520px`, radius 30px, padding 6px, `--surface-glass` with
    `saturate(180%) blur(22px)`, a 55% white border, and shadow
    `0 1px 0 rgba(255,255,255,.5) inset, 0 2px 8px rgba(0,0,0,.08), 0 18px 48px rgba(0,0,0,.16)`.
  - Tabs are at least 52px tall with a 24px radius. Labels are 11px / semibold. The active tab is
    `color: var(--primary)` on `color-mix(primary 11%)`. Pressing a tab scales it to 0.92.
  - The bar hides on scroll down (`translateY(calc(100% + 24px))`, 420ms emphasized).
  - `.app-main` gets `padding-bottom: calc(84px + safe-area)`.
  - The topbar burger and the footer view switch are hidden.
- Topbar gaps grow at 480 and 768.
- Content padding grows at 768 and 1280.

**Layout override.**

- `html[data-view="desktop"|"mobile"]` (stored in `localStorage["ee-view"]`) forces
  `.only-mobile` and `.only-desktop` regardless of width (`layout.css` around line 539).

**Public site.** `public.css` is desktop-first with 58 `max-width` queries. The main ones:

- 1180px: `.pub-links` hidden, burger shown, so the drawer takes over.
- 1100px and 1000px: grid collapses.
- 860, 760, 700, 640, 600 and 560: card and hero stacking.
- 600: `.pub-brand__long` is hidden and `.pub-brand__short` is shown.
- 520 and below.

**Arcade.**

- At 760px or narrower:
  - `.gm-me` collapses to two columns, with coins on their own row.
  - `.gm-two` becomes a single column.
  - The stage is full-bleed.
- At `max-height: 480px` (landscape phones), FSLG gets compact dialogs.
- At 480px, the button rows wrap.

**Accessibility phone pass** (`docs/ACCESSIBILITY.md`): no horizontal scroll at 360×740 or 390×844,
and every primary control is at least 44px (`--tap-min: 44px`).

---

## 7. CSS inventory and load order

`static/css/` holds **104 files, 2.3 MB** in total. About 797 distinct custom-property names are
defined across them (452 in `tokens.css` alone), along with 149 distinct `@keyframes` and 69
reduced-motion blocks. There is also `static/admin-ee/ee-admin.css` (Django admin skin).

**Layers** (from comments in `ee.css` and `apple.css`):

| Layer | Files |
|---|---|
| Core | `fonts.css` → `tokens.css` → `base.css` → `layout.css` → `components.css` → `utilities.css` → `animations.css` |
| Design layers | `apple.css` (Phase 6 Liquid Glass) → `polish.css` → `ee.css` (EE Hub components: logos, chips, acting card) → `forms.css` → `tiles.css` (icon-tile gradients) → `shell.css` (nav tiles, profile switch, tab bar) → `alive.css` (micro-motion) |
| Last-loaded correction layers | `a11y.css` (WCAG contrast token overrides), `standards.css` (button groups, logo swap, overflow guards), `sweep.css` |

Module sheets are loaded per page through `{% block extra_css %}`.

Full list (bytes; custom properties defined; keyframes; reduced-motion or `data-motion` rules):

| File | Bytes | Custom props defined | @keyframes | Reduced-motion rules |
|---|---:|---:|---:|---:|
| `a11y.css` | 13248 | 9 | 0 | 0 |
| `academics.css` | 6439 | 0 | 0 | 0 |
| `access.css` | 31581 | 0 | 0 | 0 |
| `access_r7.css` | 8543 | 0 | 0 | 1 |
| `action-queue.css` | 15722 | 0 | 0 | 0 |
| `alive.css` | 13464 | 0 | 11 | 8 |
| `animations.css` | 6562 | 0 | 29 | 4 |
| `app-shell.css` | 3010 | 0 | 0 | 0 |
| `appearance.css` | 6590 | 0 | 0 | 0 |
| `apple.css` | 17883 | 4 | 0 | 1 |
| `assistant.css` | 13925 | 0 | 2 | 1 |
| `association.css` | 8903 | 0 | 0 | 0 |
| `audit-log.css` | 13599 | 0 | 0 | 0 |
| `auth-ee.css` | 1994 | 0 | 0 | 0 |
| `auth.css` | 17550 | 0 | 5 | 0 |
| `awaiting-action.css` | 8802 | 0 | 0 | 0 |
| `backups.css` | 20172 | 2 | 2 | 1 |
| `base.css` | 7945 | 0 | 0 | 5 |
| `brand-lockup.css` | 1035 | 0 | 0 | 0 |
| `careers.css` | 1148 | 0 | 0 | 0 |
| `catalogue.css` | 9532 | 1 | 4 | 2 |
| `cbt-exam.css` | 19319 | 0 | 1 | 1 |
| `cbt.css` | 28031 | 1 | 1 | 1 |
| `cgpa.css` | 7845 | 2 | 0 | 1 |
| `chat.css` | 48395 | 20 | 5 | 1 |
| `classroom.css` | 37945 | 4 | 0 | 1 |
| `community.css` | 7297 | 0 | 0 | 0 |
| `complaints-desk.css` | 9856 | 0 | 0 | 0 |
| `complaints.css` | 13057 | 1 | 1 | 1 |
| `components.css` | 53408 | 2 | 0 | 0 |
| `contact-inbox.css` | 7134 | 0 | 0 | 0 |
| `course-pages.css` | 39170 | 23 | 4 | 2 |
| `curriculum.css` | 12132 | 1 | 0 | 0 |
| `dashboards-self-service.css` | 21937 | 0 | 0 | 1 |
| `dashboards.css` | 25761 | 0 | 0 | 0 |
| `ee.css` | 17216 | 4 | 2 | 1 |
| `elections.css` | 34708 | 3 | 1 | 1 |
| `elibrary.css` | 3230 | 0 | 0 | 0 |
| `errors.css` | 1934 | 0 | 0 | 1 |
| `feedback.css` | 6688 | 0 | 0 | 0 |
| `files.css` | 8162 | 0 | 0 | 0 |
| `fonts.css` | 1185 | 0 | 0 | 0 |
| `forms.css` | 39705 | 17 | 0 | 0 |
| `fslg-admin.css` | 7351 | 0 | 0 | 0 |
| `fx.css` | 11026 | 4 | 1 | 2 |
| `gallery.css` | 35093 | 0 | 3 | 0 |
| `games-settings.css` | 7592 | 0 | 0 | 0 |
| `games.css` | 26538 | 2 | 5 | 5 |
| `groups.css` | 15416 | 0 | 0 | 1 |
| `guides.css` | 15135 | 6 | 0 | 1 |
| `handbook.css` | 37410 | 4 | 4 | 2 |
| `home.css` | 26028 | 0 | 0 | 0 |
| `impersonate.css` | 4478 | 0 | 0 | 0 |
| `knowledge-tools.css` | 23599 | 27 | 0 | 1 |
| `knowledge.css` | 59922 | 17 | 4 | 3 |
| `labs.css` | 13506 | 0 | 0 | 0 |
| `layout.css` | 18992 | 0 | 0 | 1 |
| `lifecycle.css` | 8520 | 0 | 0 | 0 |
| `manage-confirm.css` | 4896 | 0 | 1 | 1 |
| `manage.css` | 92979 | 8 | 0 | 1 |
| `matlab.css` | 56526 | 53 | 3 | 1 |
| `memo.css` | 42837 | 0 | 0 | 0 |
| `memo_manage.css` | 48640 | 18 | 0 | 0 |
| `memos.css` | 18511 | 2 | 0 | 0 |
| `messaging-ee.css` | 5033 | 0 | 0 | 0 |
| `messaging.css` | 40642 | 10 | 6 | 3 |
| `notifications.css` | 17143 | 0 | 1 | 0 |
| `p6.css` | 14249 | 0 | 0 | 0 |
| `people.css` | 19076 | 0 | 0 | 1 |
| `polish.css` | 27384 | 2 | 5 | 4 |
| `print.css` | 14732 | 9 | 0 | 1 |
| `profile.css` | 17126 | 0 | 2 | 0 |
| `programme-2021.css` | 4967 | 0 | 0 | 0 |
| `programmes.css` | 21100 | 2 | 0 | 0 |
| `projects.css` | 12034 | 2 | 0 | 1 |
| `public.css` | 147721 | 30 | 24 | 13 |
| `pwa.css` | 9496 | 0 | 0 | 2 |
| `registration.css` | 15025 | 0 | 1 | 1 |
| `reminders.css` | 4240 | 0 | 0 | 0 |
| `research.css` | 10275 | 0 | 0 | 0 |
| `results.css` | 25500 | 0 | 0 | 0 |
| `search.css` | 12565 | 0 | 1 | 1 |
| `settings.css` | 8513 | 0 | 0 | 0 |
| `shell.css` | 15108 | 2 | 1 | 1 |
| `showcase.css` | 30930 | 3 | 1 | 1 |
| `signature.css` | 6400 | 2 | 0 | 0 |
| `siwes.css` | 36562 | 2 | 0 | 1 |
| `staff-avatar.css` | 954 | 0 | 0 | 0 |
| `standards.css` | 3629 | 0 | 0 | 0 |
| `studentrequests.css` | 19962 | 1 | 0 | 0 |
| `sweep.css` | 30728 | 4 | 0 | 2 |
| `system.css` | 29261 | 3 | 1 | 1 |
| `tasks.css` | 91686 | 42 | 7 | 0 |
| `teaching.css` | 34406 | 2 | 0 | 0 |
| `tiles.css` | 3522 | 24 | 0 | 0 |
| `timetable.css` | 9870 | 0 | 0 | 1 |
| `tokens.css` | 21636 | 452 | 0 | 0 |
| `university.css` | 48414 | 1 | 1 | 1 |
| `users.css` | 12427 | 0 | 0 | 0 |
| `utilities.css` | 11950 | 1 | 0 | 0 |
| `ux.css` | 32750 | 3 | 6 | 4 |
| `welfare.css` | 5108 | 0 | 0 | 0 |
| `wizard.css` | 12454 | 0 | 1 | 0 |
| `workflow.css` | 51423 | 14 | 3 | 0 |

---

## 8. Design tokens (`static/css/tokens.css`, v5)

The file has four layers: raw palette → semantic (light, dark) → scales → legacy aliases.
Components are supposed to use semantic names only. After that come the a11y overrides
(`static/css/a11y.css`), which are the values actually rendered.

### 8.1 Raw palette (theme-independent, `:root`)

| Group | Tokens |
|---|---|
| ABU gold | `--gold-300 #e6d39a` · `--gold-400 #d9be6e` · `--gold-500 #c8a951` · `--gold-600 #a88a35`. These are redefined later in the same block; see section 14. |
| Volt cyan | `--volt-300 #7ef0ff` · `--volt-400 #38e1f5` · `--volt-500 #13c4dc` · `--volt-600 #0b9db2` |
| Brand green (500 is the official colour) | `--brand-50 #ecf5ef` · `100 #d2e8da` · `200 #a6d1b6` · `300 #6fb38a` · `400 #3f8f63` · `500 #1a6b45` · `600 #14563a` · `700 #0f3d2e` · `800 #0a2b20` · `900 #051a13` |
| Brand glow (for dark grounds) | `--brand-glow-200 #9fdcb9` · `300 #6ccb98` · `400 #3dbb7d` · `500 #2fa36b` · `600 #2a925f` |
| Ink neutrals | `--ink-0 #ffffff` · `50 #f8f9fa` · `75 #f4f6f7` · `100 #eef0f2` · `150 #e6e9ec` · `200 #d9dce0` · `300 #b5bac1` · `400 #848b95` · `450 #626973` · `500 #5a616b` · `600 #3d434b` · `700 #282d33` · `800 #181c20` · `850 #161b20` · `900 #0a0d10` · `950 #0f1316` · `--white #ffffff` · `--black #000000` |
| Night (legacy dark) | `--night-600 #2a3346` · `700 #243044` · `800 #1a2434` · `850 #131a26` · `900 #0e141e` |
| Legacy v4 singles | `--gold-400 #d69e2e` · `--gold-500 #b7791f` · `--crimson-500 #c53030` · `--cobalt-500 #2b6cb0` |
| One-offs | `--amber-ink #1a1200` · `--amber-night #2a1f08` · `--orange-night #292018` · `--red-night #2a0f0f` · `--mac-red #ff5f57` · `--mac-yellow #febc2e` · `--mac-green #28c840` · `--sky-ink #2563a8` · `--honey-600 #9a6700` · `--honey-300 #e2b85e` · `--brick-500 #a64040` · `--coral-300 #f28b82` · `--cream-50 #fffdf5` |
| Tailwind v3 scales | The full 50–950 for `slate`, `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `grass` (Tailwind's `green`, renamed), `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`. The values are stock Tailwind v3, e.g. `--red-700 #b91c1c`, `--grass-700 #15803d`, `--amber-700 #b45309`, `--blue-700 #1d4ed8`. |

### 8.2 Semantic colours

Light is `:root, :root[data-theme="light"]`. Dark is `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and also `:root[data-theme="dark"]`.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f5f2ed` | `#070b09` |
| `--surface` | `#ffffff` | `#111815` |
| `--surface-2` | `#fbfaf7` | `#151e1a` |
| `--surface-sunken` | `#efebe4` | `#0b100e` |
| `--surface-glass` | `rgba(251, 250, 247, 0.74)` | `rgba(17, 24, 21, 0.74)` |
| `--surface-glass-strong` | `rgba(255, 255, 255, 0.92)` | `rgba(17, 24, 21, 0.92)` |
| `--text` | `#16201b` | `#f5f5f7` |
| `--text-muted` | `#5b6560` | `#aeaeb2` |
| `--text-subtle` | `#6f7a74` → **a11y: `#5d6862`** | `#98989d` → **a11y: `#a2a2a7`** |
| `--text-inverse` | `var(--ink-0)` | `var(--ink-950)` |
| `--link` / `--link-hover` | `brand-600` / `brand-700` | `brand-glow-400` / `brand-glow-200` |
| `--border` | `rgba(15, 61, 46, 0.10)` | `rgba(255, 255, 255, 0.1)` |
| `--border-strong` | `rgba(15, 61, 46, 0.20)` | `rgba(255, 255, 255, 0.2)` |
| `--divider` | `rgba(0, 0, 0, 0.07)` | `rgba(255, 255, 255, 0.08)` |
| `--primary` | `var(--brand-700)` `#0f3d2e` | `brand-glow-600` `#2a925f` → **a11y: `#1f7d50`** |
| `--primary-hover` | `brand-600` `#14563a` | `brand-glow-500` → **a11y: `#22865a`** |
| `--primary-active` | `brand-800` `#0a2b20` | `brand-500` → **a11y: `#1a6b45`** |
| `--primary-fg` | `#ffffff` | `#ffffff` |
| `--primary-subtle` | `brand-50` `#ecf5ef` | `rgba(79, 191, 128, 0.14)` |
| `--primary-subtle-fg` | `brand-700` | `#7ac896` |
| `--primary-ink` (a11y, primary used as text) | `var(--primary)` | `var(--brand-glow-400)` `#3dbb7d` |
| `--success` / `-subtle` / `-fg` | `grass-700` / `grass-100` / `grass-800` | `grass-400` / `rgba(74,222,128,.14)` / `grass-300` |
| `--warning` / `-subtle` / `-fg` | `amber-700` / `amber-100` / `amber-800` | `amber-400` / `rgba(251,191,36,.14)` / `amber-300` |
| `--danger` / `-hover` / `-subtle` / `-fg` | `red-700` / `red-800` / `red-100` / `red-800` | `red-400` / `red-300` / `rgba(248,113,113,.15)` / `red-300` |
| `--info` / `-subtle` / `-fg` | `blue-700` / `blue-100` / `blue-800` | `blue-400` / `rgba(96,165,250,.15)` / `blue-300` |
| `--neutral-subtle` / `--neutral-fg` | `ink-100` / `ink-600` | `rgba(255,255,255,.07)` / `#c4cad1` |
| `--accent` | `var(--gold-500)` | `var(--gold-400)` |
| `--accent-subtle` | `#f7efd8` | `rgba(217, 190, 110, 0.14)` |
| `--accent-fg` | `#6e5717` | `var(--gold-300)` |
| `--volt` | `volt-600` → **a11y: `#0a6b78`** | `volt-400` `#38e1f5` |
| `--volt-subtle` | `rgba(19, 196, 220, 0.13)` | `rgba(56, 225, 245, 0.14)` |
| `--badge-bg` (a11y) | `red-700` | `red-600` |
| `--overlay` | `rgba(0, 0, 0, 0.32)` | `rgba(0, 0, 0, 0.62)` |
| `--overlay-blur` | `blur(8px)` | (same) |
| `--skeleton-base` / `--skeleton-shine` | `#ebe7df` / `#f7f7f9` | `#1c2622` / `#26322d` |
| `--hero-gradient` | `linear-gradient(135deg, var(--brand-700) 0%, var(--brand-500) 55%, var(--brand-glow-500) 100%)` | `linear-gradient(135deg, var(--brand-900) 0%, var(--brand-700) 55%, var(--brand-500) 100%)` |
| `--hero-scrim` | `linear-gradient(180deg, rgba(6, 28, 14, 0.25) 0%, rgba(6, 28, 14, 0.72) 100%)` | (same) |
| `--portal-accent` | `brand-500` | `brand-glow-400` |
| `--impersonation-band` / `-fg` | `amber-400` / `--amber-ink` | `amber-500` / (same) |

`prefers-contrast: more` (`apple.css`) sets `--divider rgba(0,0,0,0.3)`, `--border rgba(0,0,0,0.45)`,
`--text-subtle #3a3a3c` and `--text-muted #2c2c2e`.
`prefers-reduced-transparency` replaces the glass bars with solid `--surface`.

### 8.3 Shadows

| Token | Light | Dark |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(0, 0, 0, 0.04)` | `0 1px 2px rgba(0, 0, 0, 0.4)` |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.05)` | `0 1px 2px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3)` |
| `--shadow-md` | `0 1px 3px rgba(0, 0, 0, 0.05), 0 14px 40px rgba(0, 0, 0, 0.06)` | `0 4px 12px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.3)` |
| `--shadow-lg` | `0 12px 32px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.04)` | `0 16px 40px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.4)` |
| `--shadow-xl` | `0 2px 8px rgba(0, 0, 0, 0.10), 0 30px 80px rgba(0, 0, 0, 0.22)` | `0 32px 80px rgba(0, 0, 0, 0.65)` |
| `--shadow-focus` | `0 0 0 3px var(--surface), 0 0 0 5px var(--gold-500)` (**gold ring**) | `0 0 0 3px var(--surface), 0 0 0 5px var(--brand-glow-400)` (green ring) |
| `--shadow-focus-danger` | `0 0 0 3px var(--surface), 0 0 0 5px var(--red-700)` | `… var(--red-400)` |

### 8.4 Scales (theme-independent)

**Type**

- Families:
  - `--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", "Helvetica Neue", sans-serif`
  - `--font-display: "Poppins", "Inter", -apple-system, …`
  - `--font-mono: "JetBrains Mono", ui-monospace, "SF Mono", SFMono-Regular, …, Menlo, Consolas, monospace`
- Sizes:
  - `--fs-2xs 0.6875rem` (11px)
  - `--fs-xs 0.75rem` (12px)
  - `--fs-sm 0.875rem` (14px, the default UI size)
  - `--fs-md 1rem` (16px, the body size)
  - `--fs-lg 1.125rem` (18px)
  - `--fs-xl 1.375rem` (22px)
  - `--fs-2xl 1.75rem` (28px)
  - `--fs-3xl clamp(1.875rem, 1.4rem + 1.6vw, 2.5rem)`
  - `--fs-display clamp(2.25rem, 1.4rem + 3vw, 3.5rem)`
- Line heights: `--lh-tight 1.15`, `--lh-snug 1.3`, `--lh-normal 1.5`, `--lh-loose 1.7`.
- Weights: `--fw-regular 400`, `--fw-medium 500`, `--fw-semibold 600`, `--fw-bold 700`. In practice
  the CSS also uses 550, 650 and 750 freely with Inter variable.
- Tracking: `--tracking-tight -0.022em`, `--tracking-tighter -0.035em`, `--tracking-normal 0`,
  `--tracking-wide 0.04em`, `--tracking-widest 0.12em`.
- Headings (`apple.css` §1): `font-family: var(--font-display)`, weight bold. Per level:
  - h1 `-0.035em`
  - h2 `-0.028em`
  - h3 and h4 `-0.02em` at semibold
- Body: `letter-spacing: -0.003em`, antialiased. Tables, badges and `time` use `tabular-nums`.
- Eyebrows are sentence case, never uppercase, in the portal (`.qa-eyebrow`). The public site and the
  guides hero do use uppercase eyebrows.

**Spacing** (4px base):

| Token | Value |
|---|---|
| `--space-0` | `0` |
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-5` | `1.5rem` |
| `--space-6` | `2rem` |
| `--space-7` | `3rem` |
| `--space-8` | `4rem` |
| `--space-9` | `6rem` |
| `--space-10` | `8rem` |
| `--space-11` | `10rem` |
| `--space-12` | `12rem` |

Steps 5 and above are not linear.

**Radii**

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | `6px` | chips |
| `--radius-sm` | `10px` | inputs |
| `--radius-md` | `12px` | rows, nav |
| `--radius-lg` | `18px` | cards |
| `--radius-xl` | `22px` | panels |
| `--radius-2xl` | `26px` | hero |
| `--radius-pill` | `999px` | |
| `--radius-round` | `50%` | |

Buttons (`.btn`) are **pills**: `border-radius: var(--radius-pill)`, `min-height: var(--tap-min)`,
padding `0 var(--space-5)`, `--fs-sm` semibold and `--shadow-xs`. Cards (`.card`) use `--space-5`
padding, a 1px `--border`, `--radius-lg`, `--surface` and `--shadow-xs`. On hover they move
`translateY(-2px)` and take `--shadow-md`.

**Motion**

- Durations: `--dur-fast 120ms`, `--dur 200ms`, `--dur-slow 320ms`, `--dur-hero 900ms`.
- Easings:
  - `--ease-standard cubic-bezier(.25, 1, .5, 1)`
  - `--ease-emphasized cubic-bezier(.32, .72, 0, 1)`
  - `--ease-spring cubic-bezier(.32, .72, 0, 1)`
  - `--ease-linear linear`
- Legacy names:
  - `--ease-in-out cubic-bezier(.65, 0, .35, 1)`
  - `--duration-instant 100ms`
  - `--duration-base 260ms`
  - `--duration-slower 600ms`

**Z-index**

| Token | Value |
|---|---|
| `--z-base` | `1` |
| `--z-raised` | `10` |
| `--z-sticky` | `20` |
| `--z-drawer` | `40` |
| `--z-dropdown` | `60` |
| `--z-modal` | `100` |
| `--z-toast` | `200` |
| `--z-tooltip` | `300` |
| `--z-loader` | `1000` |

**Layout**

| Token | Value |
|---|---|
| `--sidebar-w` | `260px` |
| `--topbar-h` | `64px` |
| `--content-narrow` | `640px` |
| `--content-default` | `900px` |
| `--content-wide` | `1200px` |
| `--content-full` | `1440px` |
| `--tap-min` | `44px` |
| `--nav-height` (legacy) | `68px` |

### 8.5 Component-level token sets outside tokens.css

**Icon tiles** (`static/css/tiles.css`): there are 11 tones, each with a flat `--qa-c-*` colour and a
gradient `--qa-tile-*`. The gradients are `linear-gradient(160deg, A 0%, B 100%)`, and the same
values apply in both themes.

| Tone | `--qa-c-*` | Gradient A | Gradient B |
|---|---|---|---|
| slate | `#7c7c84` | `#a3a3ab` | `#6b6b73` |
| green | `#23885a` | `#3fb57a` | `#14653f` |
| teal | `#1b9e98` | `#4fd1c5` | `#148a85` |
| blue | `#2f7cf6` | `#5aa9ff` | `#1e66e6` |
| indigo | `#5b5bd6` | `#8a87ff` | `#4f4cc9` |
| purple | `#9a4fd0` | `#c27cf2` | `#8a3fc2` |
| orange | `#f08a00` | `#ffb547` | `#f07800` |
| pink | `#e2456e` | `#ff7a98` | `#d93462` |
| red | `#e5484d` | `#ff7b72` | `#d93a3f` |
| gold | `#b8912a` | `#e9c766` | `#b08622` |
| volt | `#0aa5bd` | `#49dcf0` | `#0b93a9` |

The tiles hold white glyphs. Active or hover tiles scale to 1.06–1.08 and get the shadow
`inset 0 1px 0 rgba(255,255,255,.3), 0 3px 8px color-mix(in srgb, var(--tc) 45%, transparent)`.

**Public site**: `--pub-dark-1 #06150f`, `--pub-ink-on-dark #eef6f2`, `--pub-muted-on-dark #b9d0c5`.
These tokens differ by theme:

| Token | Light | Dark |
|---|---|---|
| `--pub-glass` | `color-mix(in srgb, var(--surface) 78%, transparent)` | 72% |
| `--pub-tint` | `color-mix(in srgb, var(--primary) 4%, var(--bg))` | `color-mix(in srgb, #ffffff 2.5%, var(--bg))` |
| `--pub-hl` (headline gradient text) | `linear-gradient(100deg, var(--gold-600), var(--volt-600))` | `… var(--gold-400), var(--volt-400)` |

**Logo inks** (`ee.css`): `.ee-logo { --ink: var(--brand-700); --sub: var(--text-muted); --tile: var(--surface) }`.
In dark mode `--ink` is `#eef3f0` and `--sub` is `#a3b0aa`. Inside the sidebar, `--sub` is `#9fbcad`.

**Scene backgrounds** (`fx.css`, `--fx-bg` per scene):

| Scene | `--fx-bg` |
|---|---|
| classic | `radial-gradient(60% 70% at 70% 50%, #0d3a33 0%, #04100c 70%)` |
| waves | `linear-gradient(180deg, #04100c 0%, #071a14 55%, #0b2a20 100%)` |
| others | radial gradients ending in `#04100c`, `#04050c` or `#000` |

---

## 9. Theme toggle and flash prevention

**Storage.** `localStorage["ee-theme"]` holds `"light"` or `"dark"`. `localStorage["ee-theme-os"]`
records the OS scheme at the moment the user pressed the toggle. A signed-in user's profile
preference arrives as `window.EE_PREFS.theme` (`system|light|dark`) and `EE_PREFS.motion`.

**Attribute.** The toggle sets `<html data-theme="light|dark">`. Related attributes are
`data-motion="reduce"`, `data-view="auto|desktop|mobile"` and the class `js`.

**Flash prevention.** `static/js/theme-init.js` is loaded **synchronously** in `<head>`, before any
CSS paints:

```js
var os = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
var t = localStorage.getItem("ee-theme");
if ((t !== "light" && t !== "dark") || localStorage.getItem("ee-theme-os") !== os) t = os;
var p = window.EE_PREFS || {};
if ((p.theme === "light" || p.theme === "dark") && !localStorage.getItem("ee-theme")) t = p.theme;
d.setAttribute("data-theme", t);
if (p.motion) d.setAttribute("data-motion", "reduce");
// + ee-view → data-view, ee-motion=reduce → data-motion
d.className += " js";
```

If storage is blocked, the CSS falls back to `@media (prefers-color-scheme: dark)
:root:not([data-theme="light"])`. Each dark block is therefore written twice (media query plus
attribute), and MIB-Hub must keep both or replace them with a single `[data-theme]` strategy that
has a no-JS fallback.

**Rule: the device wins when it changes.** In `static/js/app.js` (`Theme`, lines 82–160):

- A manual choice is remembered only while the OS scheme stays as it was when the toggle was
  pressed. When the OS switches (a `matchMedia` change event, or a change between visits), the
  choice is forgotten and the page follows the device.
- `toggle()` flips the theme. If the result equals the system scheme it calls `forget()`;
  otherwise it remembers the choice.
- `apply(theme, {animate})` adds `body.no-transition` (which sets `transition: none !important` on
  every element) for two animation frames, so everything changes colour at once.
- It dispatches `window` `theme:change` with `{detail:{theme}}`.
- It syncs across tabs through the `storage` event.
- It is exposed as `window.EETheme`.

**Button.** `button.theme-toggle[data-theme-toggle][aria-pressed]` holds both
`{% icon "sun" 18 "icon-sun" %}` and `{% icon "moon" 18 "icon-moon" %}`, and CSS shows one of them
by theme. `public.js` binds the public header and drawer toggles to `EETheme`; `ui.js` binds the
portal ones.

---

## 10. Motion

**Core keyframes** (`static/css/animations.css`, 29):

| Group | Keyframes |
|---|---|
| Entry and exit | `fade-in`, `fade-out`, `fade-up` (8px), `page-in` (6px) |
| Overlays and panels | `dialog-in`, `sheet-up`, `panel-slide-down` |
| Toasts | `toast-in`, `toast-out`, `toast-timer` |
| Navigation | `nav-group-in`, `nav-indicator-in` |
| Feedback | `ripple`, `shake`, `draw-check`, `check-pop`, `field-error-in`, `badge-pop`, `bell-wobble`, `focus-ring-in` |
| Loading and progress | `spin`, `shimmer` (skeletons), `logo-pulse`, `bar-slide` (loader), `progress-grow` |
| Decorative | `ken-burns` (carousel), `float-soft`, `error-orbit` |

The rule stated in its header: at most 320ms except deliberate hero and carousel motions.

**Other sheets:**

- `alive.css` (11): `alive-rise`, `alive-page`, `alive-fade`, `alive-bar`, `alive-shimmer`,
  `alive-pulse`, `alive-float`, `alive-tilt`, `alive-draw`, `alive-pop`, `alive-toast`.
- `public.css` (24): `pub-halo`, `pub-arc`, `pub-waves`, `pub-ping`, `pub-blink` (terminal caret),
  `pub-cue` (scroll cue), `pub-rise`, `pub-in`, `pub-fade`, `pub-marquee`, `pub-spark`, `pub-node`,
  `pub-rot` (gears), `pub-bus`, `pub-dash`, `pub-glyph`, `pub-cout`, `pub-cin-r`, `pub-cin-l`,
  `pub-ring`, `pub-sweep`, `lvInR`, `lvInL`, `pub-ring-o`.
- `games.css`: `gm-pop`, `fs-turn`, `gm-cer-up`, `gm-cer-star`, `gm-cer-pulse`.
- `polish.css`: `sh-flash`, `ee-watermark-drift`, `qi-glow`, `qi-ping`, `wb-glow`.
- `ux.css`: `fpv-spin`, `ux-return-flash`, `ux-reveal-ring`, `pn-in`, `uxb-pop`, `uxb-fade`.
- `ee.css`: `ee-fade`, `ee-rise`.
- `shell.css`: `ee-sheet-in`.
- `fx.css`: `fx-marq`.

**Typical transitions**

| Element | Transition |
|---|---|
| Buttons, topbar buttons | background and colour, `var(--dur) var(--ease-standard)` |
| Cards | `transform` and `box-shadow`, `var(--dur)`, lift `-2px` |
| Guide and game cards | lift `-3px`, `.15s` and `.25s` |
| Sidebar drawer | `--dur-slow` (320ms) `--ease-emphasized` |
| Tab bar hide | 420ms emphasized |
| Brand mark hover | `rotate(-10deg) scale(1.05)` over `.5s cubic-bezier(.19,1,.22,1)` |
| Nav tiles | scale over 200ms |

View transitions (`::view-transition-*`) are used and switched off under reduced motion.

**Public "fx" system** (`docs/APPEARANCE.md`, `static/css/fx.css`, `static/js/fx/`):

- Settings: `appearance.motion` (`full|reduced|off`), `text_animations`, `scroll_animations`,
  `marquee`, and the hero scene (`classic`, `fluid`, `particles`, `electric_field`, `waves`,
  `black_hole`, `galaxy`), all WebGL with webp posters in `static/img/fx/`.
- Hidden-before-reveal rules are gated by `html.fx-on`, which `reveal.js` sets only when motion is
  allowed, so with no JS everything is visible.
- Word-by-word headline rise uses `.fx-split .fx-w/.fx-wi`.
- Opt-in attributes: `data-fx-item`, `data-fx-parallax`, `data-fx-tilt`.
- A "Pause motion" button sits on the hero.

**Reduced motion**

- `base.css` lines 38–58: under `prefers-reduced-motion: reduce` **or** `:root[data-motion="reduce"]`
  (the in-app setting, `localStorage["ee-motion"]` or the profile), every element and pseudo-element
  gets `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important`, and `scroll-behavior: auto`.
- `animations.css`: `.reveal:not(.in)` shows immediately, ken-burns is off, and view transitions
  are off.
- 69 more `prefers-reduced-motion` blocks across the sheets switch off specific loops. Examples:
  `games.css` stops the dialog pop and the card hover, and `shell.css` stops tile transforms.
- Public: `body.is-calm` when `appearance.motion == "off"`. Scenes show their poster frame only.

---

## 11. Icons, images, fonts, logo

### Icons

- **Lucide**, server-inlined. `core/lucide_icons.json` (309 KB, **1,539 icons**) maps a name to the
  inner SVG markup. `{% icon name size css %}` (`core/templatetags/ee_tags.py` lines 30–42) emits:
  ```html
  <svg class="ee-icon {css}" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" focusable="false">…</svg>
  ```
  An unknown name falls back to `circle`. There is no sprite sheet and no icon font.
  **MIB-Hub: use `lucide-react` (same names) or `astro-icon` with `@iconify-json/lucide`.**
- Common names in the shells: `menu`, `x`, `search`, `bell`, `sun`, `moon`, `chevron-down`,
  `chevrons-up-down`, `log-in`, `log-out`, `layout-dashboard`, `house`, `crown`, `users`,
  `milestone`, `landmark`, `graduation-cap`, `life-buoy`, `newspaper`, `calendar-days`, `images`,
  `mail`, `phone`, `clock`, `globe`, `database`, `smartphone`, `ellipsis`, `arrow-left-right`,
  `megaphone`, `venetian-mask`, `key-round`, `circle-user-round`, `gamepad-2`, `coins`, `trophy`,
  `award`, `shopping-bag`, `zap`, `lock`, `play`, `pause`, `maximize`, `volume-x`, `wifi`,
  `sliders-horizontal`.
- **Arcade home-screen icons**: `games/icons.py` renders a coloured square with the game initials
  (or the `GLYPHS` override `{"samaru-days": "FSLG"}`). The fill is the catalogue accent and the ink
  is chosen by luminance (above 0.55 gives dark `(16,22,34)`, otherwise white). The arcade itself is
  `("arcade", "Learning arcade", "#0f3d2e")`. Output is `static/img/games/<slug>-{192,512}.png` plus
  `-maskable-` variants (64 files, 16 games plus the arcade), written by `manage.py build_game_icons`.
- In-card game art is **drawn live on canvas** by `js/games/arcade.js` (`data-gm-art`). It is not
  image files.

### Images (`static/img/`)

| Path | Contents |
|---|---|
| `brand/` | `ee-mark.svg` (primary "gearbolt"), `ee-sine.svg` and `-dark`, `ee-trace.svg` and `-dark`, `ee-seal.svg` (formal), `ee-app-icon.svg`, `ee-wordmark.svg` and `-dark`, `favicon.svg`, `abu-crest.svg`, `abu-crest-white.svg`, `abu-crest-mono.svg` (`currentColor`), and `png/` raster fallbacks (`ee-mark-96/192/512.png`, `ee-seal-512.png`, `ee-wordmark-480.png`, `ee-wordmark-dark-480.png`, crest PNGs) |
| (root) | `EE_logo.png`, `abu-crest.png` (official source, 327 KB), `abu-crest-white.png`, `ee-mark.svg`, `cover-art.svg` (172 KB), `hero-scene.svg` (124 KB, auth art), `hero-scene-mobile.svg` |
| `hero/` | Layered classic home hero: `desktop-base.svg`, `desktop-arc.svg`, `desktop-gear-1..4.svg`, `desktop-waves.svg`, `mobile-*` and `scene.json` (layers animated separately: gears `pub-rot`, arc, waves) |
| `fx/` | Scene posters `classic/fluid/particles/electric_field/waves/black_hole/galaxy.webp` |
| `guides/<slug>/` | 51 folders of guide step pictures, plus `manifest.json` |
| `icons/` | PWA icons `favicon-32.png`, `apple-touch-icon.png`, `icon-192/512.png`, `maskable-192/512.png`, `email-logo.png` |
| `games/` | Arcade PWA icons (above) |

Usage notes:

- `{% logo slot size %}` emits an SVG `<img>` light/dark pair, swapped with `.logo-swap--light/--dark`
  in `standards.css`.
- `{% crest size variant %}` emits the ABU crest (`auto` gives the colour version in light mode and
  the white one in dark).

### The logo (primary mark "gearbolt", `static/img/brand/ee-mark.svg`)

The mark is 240×240 and has three parts:

- A 24-tooth **gear** filled with a gold diagonal gradient (`#F0DC9C` → `#C8A951` → `#A88A35`).
- A **disc** (r=74) with a green radial gradient (`#1A6B45` → `#0A2B20`), inside a dashed cyan ring
  (`#7EF0FF` at 35% opacity, dash `3 7`).
- A **lightning bolt** with a cyan vertical gradient (`#7EF0FF` → `#13C4DC`) and a stroke of
  `#E8FDFF`.

Other details:

- The inline version (`{% brand_logo %}`, `config/branding.py` `active_logo_markup`) uses CSS
  variables `--ink`, `--sub` and `--tile` so it follows the theme.
- The active logo per slot (`primary | formal | app_icon | wordmark`) can be changed in
  Settings → Branding (`/settings/branding/`).
- In the sidebar lockup, the mark gets `drop-shadow(0 4px 10px rgba(200,169,81,.3))`.
- Lockup type is Poppins 14.5px / 750 at `-.025em` over 11.5px muted text (`brand-lockup.css`).

### Fonts (`static/fonts/`, self-hosted, OFL; **no Google Fonts call anywhere**)

| File | Family / weight | Bytes |
|---|---|---:|
| `inter-var.woff2` | Inter, variable 100–900 (preloaded) | 48,444 |
| `poppins-latin-500-normal.woff2` | Poppins 500 | 7,748 |
| `poppins-latin-600-normal.woff2` | Poppins 600 | 8,000 |
| `poppins-latin-700-normal.woff2` | Poppins 700 | 7,816 |
| `poppins-latin-800-normal.woff2` | Poppins 800 | 7,824 |
| `jetbrains-mono-latin-400-normal.woff2` | JetBrains Mono 400 | 21,088 |
| `jetbrains-mono-latin-600-normal.woff2` | JetBrains Mono 600 | 21,936 |

`@font-face` rules are in `static/css/fonts.css`, all with `font-display: swap` and latin subsets.
Note that Poppins has no 400 face. Display text is always 500 or heavier.

---

## 12. Intent from the design docs

- **`docs/APPEARANCE.md`**:
  - The public site has switchable animated hero scenes, scroll and text motion, a marquee and palettes
    (`brand`, `electric`, `ember`, `campus`, `custom`), all configured in Settings → Appearance
    (`/settings/appearance/`, with a preview at `/settings/appearance/preview/<scene>/`).
  - Reduced motion or the profile "reduce motion" setting always gives a still page.
  - Every public `<title>` starts "Electrical Engineering · ABU Zaria | …".
  - Icon and manifest URLs are versioned `?v=ee6`.
- **`docs/IMAGES.md`** (and `docs/SVG.md`, which only points to it):
  - Logos are SVG with light/dark pairs.
  - The ABU crest is auto-traced from the official PNG and is never redrawn by hand.
  - Uploads pick the lightest faithful format: photos go to AVIF or WebP, line art to SVG, with a
    1600px cap and 512px avatars.
- **`docs/ACCESSIBILITY.md`**:
  - The target is WCAG 2.2 AA. axe-core ran on 149 pages × 2 themes, and violations went from 2509
    to 8.
  - Contrast is fixed at the token level in `a11y.css`.
  - In dark mode, primary *text* uses `--primary-ink`.
  - Links in text are underlined, focus is always visible (gold ring in light, green in dark), and
    tap targets are at least 44px.
  - There must be no horizontal scroll at 360px.

---

## 13. Screenshot-worthy pages

URLs come from `eehub/urls.py`, `content/urls.py`, `games/urls.py` and others. Screenshot paths are
under `docs/screenshots/`.

| Page | URL | Why | Existing screenshots |
|---|---|---|---|
| Public home | `/` (`content:home`) | The signature look: overlay glass nav pill, dark circuit hero with gears and arc, gold→cyan gradient headline word, `>_` mono caret, gold and glass CTAs, stat tiles with coloured top rules, three-phase readout, Pause motion. | `checkpoint6/01-home.png`, `landing-desktop-light.png`, `landing-desktop-dark.png`, `landing-desktop-light-full.png`, `landing-mobile-light.png`, `landing-mobile-dark.png`, `checkpoint4/01-home-hero.png`, `checkpoint4/02-home-courses-animated.png`, `checkpoint4/03-home-phone-dark.png`, `checkpoint5/home-hero-classic.jpg`, `home-courses-band.jpg`, `home-journey.jpg`, `home-scroll-about.jpg`, `home-scroll-courses.jpg`, `home-scroll-history.jpg`, `home-scroll-numbers.jpg`, `home-phone-dark.jpg` |
| Hero scenes | `/settings/appearance/preview/<scene>/` | The WebGL themes. | `checkpoint5/scene-black-hole.jpg`, `scene-electric-field.jpg`, `scene-electric-phone.jpg`, `scene-fluid.jpg`, `scene-fluid-phone.jpg`, `scene-galaxy.jpg`, `scene-galaxy-phone.jpg`, `scene-particles.jpg`, `appearance-settings.jpg` |
| Guides hub (public) | `/guides/` (`content:guide_detail` for one guide) | Green hero with gold glow, chips, tinted-icon card grid. Shows the public shell in dark. | `checkpoint5/guides-hub-public.jpg`, `guides-hub-student.jpg`, `guide-register-courses.jpg`, `guide-phone.jpg`, `guide-pdf-pages.jpg` |
| Student dashboard | `/dashboard/` | Portal shell: glass sidebar with gradient icon tiles and "Acting as" card, topbar search pill, dark-green greeting hero, white cards, status pills. | `checkpoint5/dashboard-student.jpg`, `checkpoint6/30-student-dash-phone.png`, `checkpoint4/16-student-dashboard-phone-dark.png`, `dashboard-lecturer.png`, `checkpoint5/dashboard-lecturer-dark.jpg`, `checkpoint4/15-lecturer-dashboard-switcher.png` |
| Phone tab bar and drawer | `/dashboard/` at 390px | Floating liquid-glass tab bar, drawer. | `checkpoint2/02-lecturer-phone-tabbar.png`, `checkpoint2/03-phone-menu-drawer.png`, `checkpoint2/01-lecturer-sidebar-switch.png` |
| Sign in | `/accounts/login/` (`accounts:login`) and the quick modal on public pages | Auth split layout, sign-in dialog. | `modal.png`, `checkpoint2/04-first-sign-in-password.png`, `checkpoint2/05-first-sign-in-phone-dark.png` |
| Learning arcade | `/arcade/` (`games:index`); guest `/arcade/guest/`; `/arcade/leaderboard/`; `/arcade/play/<slug>/` | Dark gradient hero with canvas cast, XP strip, purple story band, accent-tinted game cards, podium rank colours. | **None in `docs/screenshots/`.** These need to be taken fresh. |
| Study / course pages | `/study/…`, course page | Rich content pages. | `checkpoint6/02-study-409.png`, `03-study-409-phone.png`, `06-study-hub.png`, `checkpoint4/04-course-page-eeen409.png`, `checkpoint5/course-*.jpg` |
| News, events, gallery | `/news/`, `/events/<slug>/`, `/gallery/` | Public content cards. | `checkpoint4/19-news-with-covers.png`, `20-event-countdown.png`, `21-gallery.png` |
| Branding | `/settings/branding/` | Logo variants. | `branding-dark.png` |
| Errors and offline | `/offline/`, 404 | Error art (`error-orbit`). | `checkpoint5/error-404.jpg`, `error-csrf.jpg`, `checkpoint4/22-offline-page.png` |
| Focus ring | any | Gold focus ring. | `checkpoint4/26-focus-ring-keyboard.png` |
| CBT exam (dark) | `/cbt/…` | Exam shell. | `checkpoint3/09-cbt-exam-dark.png` |

---

## 14. Surprises and traps

1. **Gold is defined twice in `tokens.css`.** Lines 30–31 set `--gold-400 #d9be6e` and
   `--gold-500 #c8a951`. Lines 83–84 ("Legacy single accents from tokens v4") later in the **same
   `:root` block** set `--gold-400 #d69e2e` and `--gold-500 #b7791f`. The later declaration wins, so
   **`var(--gold-500)` actually renders `#b7791f`** (a browner gold). Hard-coded places still use the
   intended ABU gold `#c8a951`: the logo SVG, the footer wave, `pub-btn--gold` end stop `#b8963d`,
   and `rgba(200,169,81,…)` glows. For MIB-Hub, pick one value deliberately. The recommendation is
   `#c8a951`, which matches the logo and the screenshots.
2. **`--accent` is redefined three times.** The semantic layer sets gold. The legacy layer (`:root`)
   sets `var(--primary)`, and its `--accent-subtle` is `var(--primary-subtle)`. Because
   `theme-init.js` always sets `data-theme`, the higher-specificity `:root[data-theme=…]` gold wins.
   **Without JS, `--accent` would be green.**
3. Every dark override in the codebase is written twice: once for the media query and once for the
   attribute.
4. `a11y.css`, loaded last, changes the actual dark primary to `#1f7d50` and light `--text-subtle`
   to `#5d6862`. Port the **a11y values**, not the tokens.css values.
5. `tokens.css` and `animations.css` reference `DESIGN_TOKENS.md` and `ANIMATIONS.md`. **Neither file
   exists** in the repo.
6. The CSS is 2.3 MB across 104 files. `public.css` is 148 KB, and `manage.css` and `tasks.css` are
   about 92 KB each. A huge amount is module-specific and much of it is layered overrides
   (`polish`, `sweep`, `ux`, `p6`, `alive`).
7. `lan.html` is the only page with its own private palette (amber `#f59e0b` accent, navy ink). It
   ignores the site tokens.
8. There are no arcade screenshots in `docs/screenshots`.
9. `color-mix()` is used widely (`--pub-glass`, `--pub-tint`, tab bar, tiles). This matters for the
   macOS 12 WKWebView screenshot pipeline, which lacks `color-mix`.

---

## 15. Token map for MIB-Hub

The proposal is a **CSS-variable source of truth with a Tailwind theme on top**. For Tailwind v4,
declare the tokens in `@theme`. For v3, `theme.extend` points at the same `var(--…)`. Keep the
old semantic names so ported markup reads the same, and drop the legacy and Tailwind-raw layers.
Dark mode uses `[data-theme="dark"]` on `<html>`, plus a `prefers-color-scheme` fallback for
`:not([data-theme="light"])`. Configure Tailwind with
`@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` (v4) or
`darkMode: ['selector','[data-theme="dark"]']` (v3).

### 15.1 Colour tokens

Values marked † are the post-a11y effective values.

| MIB-Hub CSS var | Tailwind key | Old token | Light | Dark |
|---|---|---|---|---|
| `--color-bg` | `bg-bg` | `--bg` | `#f5f2ed` | `#070b09` |
| `--color-surface` | `bg-surface` | `--surface` | `#ffffff` | `#111815` |
| `--color-surface-2` | `bg-surface-2` | `--surface-2` | `#fbfaf7` | `#151e1a` |
| `--color-sunken` | `bg-sunken` | `--surface-sunken` | `#efebe4` | `#0b100e` |
| `--color-glass` | `bg-glass` | `--surface-glass` | `rgba(251,250,247,.74)` | `rgba(17,24,21,.74)` |
| `--color-glass-strong` | `bg-glass-strong` | `--surface-glass-strong` | `rgba(255,255,255,.92)` | `rgba(17,24,21,.92)` |
| `--color-text` | `text-fg` | `--text` | `#16201b` | `#f5f5f7` |
| `--color-muted` | `text-muted` | `--text-muted` | `#5b6560` | `#aeaeb2` |
| `--color-subtle` | `text-subtle` | `--text-subtle` † | `#5d6862` | `#a2a2a7` |
| `--color-border` | `border-line` | `--border` | `rgba(15,61,46,.10)` | `rgba(255,255,255,.10)` |
| `--color-border-strong` | `border-line-strong` | `--border-strong` | `rgba(15,61,46,.20)` | `rgba(255,255,255,.20)` |
| `--color-divider` | `border-divider` | `--divider` | `rgba(0,0,0,.07)` | `rgba(255,255,255,.08)` |
| `--color-primary` | `bg-primary` | `--primary` † | `#0f3d2e` | `#1f7d50` |
| `--color-primary-hover` | `bg-primary-hover` | `--primary-hover` † | `#14563a` | `#22865a` |
| `--color-primary-active` | `bg-primary-active` | `--primary-active` † | `#0a2b20` | `#1a6b45` |
| `--color-primary-fg` | `text-primary-fg` | `--primary-fg` | `#ffffff` | `#ffffff` |
| `--color-primary-ink` | `text-primary-ink` | `--primary-ink` † | `#0f3d2e` | `#3dbb7d` |
| `--color-primary-subtle` | `bg-primary-subtle` | `--primary-subtle` | `#ecf5ef` | `rgba(79,191,128,.14)` |
| `--color-primary-subtle-fg` | `text-primary-subtle-fg` | `--primary-subtle-fg` | `#0f3d2e` | `#7ac896` |
| `--color-link` | `text-link` | `--link` | `#14563a` | `#3dbb7d` |
| `--color-link-hover` | `text-link-hover` | `--link-hover` | `#0f3d2e` | `#9fdcb9` |
| `--color-accent` | `bg-accent` | `--accent` (gold) | `#c8a951` (see §14.1) | `#d9be6e` |
| `--color-accent-subtle` | `bg-accent-subtle` | `--accent-subtle` | `#f7efd8` | `rgba(217,190,110,.14)` |
| `--color-accent-fg` | `text-accent-fg` | `--accent-fg` | `#6e5717` | `#e6d39a` |
| `--color-volt` | `text-volt` | `--volt` † | `#0a6b78` | `#38e1f5` |
| `--color-volt-subtle` | `bg-volt-subtle` | `--volt-subtle` | `rgba(19,196,220,.13)` | `rgba(56,225,245,.14)` |
| `--color-success` | `text-success` | `--success` | `#15803d` | `#4ade80` |
| `--color-success-subtle` | `bg-success-subtle` | `--success-subtle` | `#dcfce7` | `rgba(74,222,128,.14)` |
| `--color-success-fg` | `text-success-fg` | `--success-fg` | `#166534` | `#86efac` |
| `--color-warning` | `text-warning` | `--warning` | `#b45309` | `#fbbf24` |
| `--color-warning-subtle` | `bg-warning-subtle` | `--warning-subtle` | `#fef3c7` | `rgba(251,191,36,.14)` |
| `--color-warning-fg` | `text-warning-fg` | `--warning-fg` | `#92400e` | `#fcd34d` |
| `--color-danger` | `text-danger` | `--danger` | `#b91c1c` | `#f87171` |
| `--color-danger-hover` | `bg-danger-hover` | `--danger-hover` | `#991b1b` | `#fca5a5` |
| `--color-danger-subtle` | `bg-danger-subtle` | `--danger-subtle` | `#fee2e2` | `rgba(248,113,113,.15)` |
| `--color-danger-fg` | `text-danger-fg` | `--danger-fg` | `#991b1b` | `#fca5a5` |
| `--color-info` | `text-info` | `--info` | `#1d4ed8` | `#60a5fa` |
| `--color-info-subtle` | `bg-info-subtle` | `--info-subtle` | `#dbeafe` | `rgba(96,165,250,.15)` |
| `--color-info-fg` | `text-info-fg` | `--info-fg` | `#1e40af` | `#93c5fd` |
| `--color-neutral-subtle` | `bg-neutral-subtle` | `--neutral-subtle` | `#eef0f2` | `rgba(255,255,255,.07)` |
| `--color-neutral-fg` | `text-neutral-fg` | `--neutral-fg` | `#3d434b` | `#c4cad1` |
| `--color-badge` | `bg-badge` | `--badge-bg` † | `#b91c1c` | `#dc2626` |
| `--color-overlay` | `bg-overlay` | `--overlay` | `rgba(0,0,0,.32)` | `rgba(0,0,0,.62)` |
| `--color-skeleton` | `bg-skeleton` | `--skeleton-base` | `#ebe7df` | `#1c2622` |
| `--color-skeleton-shine` | `bg-skeleton-shine` | `--skeleton-shine` | `#f7f7f9` | `#26322d` |

### 15.2 Brand palette (theme-independent, `colors.brand/gold/volt`)

| Tailwind | Values |
|---|---|
| `brand-50…900` | `#ecf5ef #d2e8da #a6d1b6 #6fb38a #3f8f63 #1a6b45 #14563a #0f3d2e #0a2b20 #051a13` |
| `brand-glow-200…600` | `#9fdcb9 #6ccb98 #3dbb7d #2fa36b #2a925f` |
| `gold-300…600` | `#e6d39a #d9be6e #c8a951 #a88a35` (the intended ABU gold, not the v4 override) |
| `volt-300…600` | `#7ef0ff #38e1f5 #13c4dc #0b9db2` |
| `tile-{slate,green,teal,blue,indigo,purple,orange,pink,red,gold,volt}` | flat `--qa-c-*` values from §8.5. Expose gradients as `--tile-<tone>` CSS vars and use them via `bg-[image:var(--tile-green)]` or a small `.tile-<tone>` utility. |
| Tailwind default palette | Keep Tailwind's own `red/amber/blue/green…` (identical to the old `--red-*` etc.). The old `--grass-*` is Tailwind `green-*`. |

### 15.3 Gradients (as CSS vars, not Tailwind colours)

| Var | Value |
|---|---|
| `--grad-hero` | light `linear-gradient(135deg, #0f3d2e 0%, #1a6b45 55%, #2fa36b 100%)` / dark `linear-gradient(135deg, #051a13 0%, #0f3d2e 55%, #1a6b45 100%)` |
| `--grad-hero-scrim` | `linear-gradient(180deg, rgba(6,28,14,.25) 0%, rgba(6,28,14,.72) 100%)` |
| `--grad-headline` | light `linear-gradient(100deg, #a88a35, #0b9db2)` / dark `linear-gradient(100deg, #d9be6e, #38e1f5)` (`--pub-hl`, used with `background-clip: text`) |
| `--grad-gold-btn` | `linear-gradient(135deg, #f0dc9c, #c8a951 60%, #b8963d)`, text `#1d1503` |
| `--grad-guides-hero` | `radial-gradient(120% 140% at 100% 0%, rgba(200,169,81,.35), transparent 55%), linear-gradient(135deg, #0f3d2e, #1a6b45)` |
| `--grad-arcade-hero` | `radial-gradient(80% 140% at 85% 30%, rgba(61,214,140,.22), transparent 60%), linear-gradient(135deg, #0c4a35, #08291f 50%, #061423)` |
| `--grad-arcade-story` | `radial-gradient(60% 120% at 10% 50%, rgba(192,132,252,.28), transparent 70%), linear-gradient(135deg, #1a0b2e, #2d1450)` |
| `--grad-xp` | `linear-gradient(90deg, #3dd68c, #7ef0ff)` |
| `--arcade-stage` | `#050c12` |
| `--arcade-card-art` | `linear-gradient(160deg, #0b1f2a, #071018)` |
| `--rank-1/2/3` | `#f6c445`/`#3a2a00`, `#cfd6de`/`#222`, `#d79a63`/`#2a1606` |

### 15.4 Typography

| MIB-Hub var | Tailwind | Old | Value |
|---|---|---|---|
| `--font-sans` | `font-sans` | `--font-sans` | `"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Helvetica Neue", sans-serif` |
| `--font-display` | `font-display` | `--font-display` | `"Poppins", "Inter", -apple-system, …` |
| `--font-mono` | `font-mono` | `--font-mono` | `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace` |
| `--text-2xs` | `text-2xs` | `--fs-2xs` | `0.6875rem` |
| `--text-xs` | `text-xs` | `--fs-xs` | `0.75rem` |
| `--text-sm` | `text-sm` | `--fs-sm` | `0.875rem` |
| `--text-base` | `text-base` | `--fs-md` | `1rem` |
| `--text-lg` | `text-lg` | `--fs-lg` | `1.125rem` |
| `--text-xl` | `text-xl` | `--fs-xl` | `1.375rem` (differs from Tailwind's 1.25rem, so override it) |
| `--text-2xl` | `text-2xl` | `--fs-2xl` | `1.75rem` |
| `--text-3xl` | `text-3xl` | `--fs-3xl` | `clamp(1.875rem, 1.4rem + 1.6vw, 2.5rem)` |
| `--text-display` | `text-display` | `--fs-display` | `clamp(2.25rem, 1.4rem + 3vw, 3.5rem)` |
| `--leading-tight/snug/normal/loose` | `leading-*` | `--lh-*` | `1.15 / 1.3 / 1.5 / 1.7` |
| `--tracking-tight` | `tracking-tight` | `--tracking-tight` | `-0.022em` |
| `--tracking-tighter` | `tracking-tighter` | `--tracking-tighter` | `-0.035em` (h1) |
| `--tracking-h2` | `tracking-h2` | (apple.css) | `-0.028em` |
| `--tracking-h3` | `tracking-h3` | (apple.css) | `-0.02em` |
| `--tracking-wide` | `tracking-wide` | `--tracking-wide` | `0.04em` |
| `--tracking-widest` | `tracking-widest` | `--tracking-widest` | `0.12em` |

Copy the 7 woff2 files from `static/fonts/` with their `@font-face` rules from `fonts.css`
(`font-display: swap`), and preload `inter-var.woff2`. Do not add Google Fonts.

### 15.5 Spacing, radius, shadow, motion, z, layout

| Group | MIB-Hub vars and Tailwind keys | Values |
|---|---|---|
| Spacing | Keep Tailwind's 4px scale. Add aliases `--space-1…12` for ported CSS. | `.25 .5 .75 1 1.5 2 3 4 6 8 10 12` rem. Old `space-5` = Tailwind `6`, `space-6` = `8`, `space-7` = `12`, `space-8` = `16`. |
| Radius | `--radius-xs/sm/md/lg/xl/2xl/pill` → `rounded-xs…2xl`, `rounded-full` | `6px / 10px / 12px / 18px / 22px / 26px / 999px`. Override Tailwind's defaults; buttons are `rounded-full`. Public `--pub-radius` = `22px` (= `xl`); guides card `18px` (= `lg`); arcade cards `16px`, stage `18px`. |
| Shadow | `--shadow-xs/sm/md/lg/xl/focus/focus-danger` → `shadow-xs…xl`, `shadow-focus` | Exact light and dark values from §8.3. Shadows change per theme, so define them inside the theme blocks. |
| Focus | `ring` via `--shadow-focus` | Light: 3px surface gap plus a 5px **gold** ring. Dark: a 5px `#3dbb7d` ring. |
| Duration | `--duration-fast/base/slow/hero` → `duration-fast…` | `120ms / 200ms / 320ms / 900ms` |
| Easing | `--ease-standard/emphasized/in-out` → `ease-standard…` | `cubic-bezier(.25,1,.5,1)` / `cubic-bezier(.32,.72,0,1)` / `cubic-bezier(.65,0,.35,1)` |
| Z-index | `--z-sticky/drawer/dropdown/modal/toast/tooltip/loader` → `z-sticky…` | `20 / 40 / 60 / 100 / 200 / 300 / 1000` (plus `raised 10`, `base 1`) |
| Layout | `--sidebar-w`, `--topbar-h`, `--content-narrow/default/wide/full`, `--pub-wrap`, `--pub-nav-h`, `--tap-min` | `260px`, `64px`, `640 / 900 / 1200 / 1440px`, `1240px`, `68px`, `44px` |
| Breakpoints | `sm/md/lg/xl/2xl` | `480 / 768 / 1024 / 1280 / 1536px`. Tailwind's `sm` is 640, so override `sm` to `480px`. Add `pub-nav: 1180px` for the public burger switch. |
| Glass | utility `.glass` | `background: var(--color-glass); backdrop-filter: saturate(180%) blur(18px)` (tab bar: `blur(22px)`; public nav: `blur(18px) saturate(150%)`). Provide a solid fallback under `prefers-reduced-transparency`. |

### 15.6 Behaviour to carry over (not tokens, but part of the look)

- Copy `theme-init.js` verbatim as an inline `<script is:inline>` in the Astro `<head>`, keeping the
  same storage keys (`ee-theme`, `ee-theme-os`, `ee-view`, `ee-motion`) so users keep their choice.
  Port the `Theme` object from `app.js` into a small React hook or vanilla module, including the
  two-frame `.no-transition` swap and the `theme:change` event.
- Global reduced motion: keep the `base.css` lines 38–58 kill switch for both
  `prefers-reduced-motion` and `[data-motion="reduce"]`.
- Icons: `lucide-react` at `strokeWidth={2}` with `aria-hidden`. Sizes in use are 12, 13, 14, 15,
  16, 18, 20 and 22, plus 220 for decorative art.
- Logo: inline `ee-mark.svg` as an Astro component. Crest light and white variants come from
  `static/img/brand/`.
