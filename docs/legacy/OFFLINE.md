# Playing the arcade without internet

## What students see

- **On every game page:** a **Download for offline** button with the size. While it downloads there is a progress bar. Afterwards it shows **Offline ✓** and the size, with a **Remove** button. When the game has changed on the website, the button reads **Update offline copy**.
- **On the arcade home page:** **Download all games**, showing how many games are already saved and how much space the site is using on the phone.
- **Opening a saved game with no internet:** the address is the same as always. The game opens from the phone, and a banner says *"Offline — playing from your device"* for 15 seconds, then goes away.
- **Playing offline:** results are kept on the phone. When the phone is back online, the banner says *"Back online — syncing"* and the results are added to the student's record. Each result is counted once, even if it is sent twice.

## Pinning a game to the home screen

Every game page installs as its own app: its own name, icon and colour, opening straight into that game, full screen.
The arcade home page installs the whole arcade.

- **On the page:** an **Install this game** button. Where the browser allows it (Chrome and Edge on Android and desktop), the button opens the browser's install prompt. Accepting also downloads the game for offline play.
- **On iPhone and iPad** (which have no install prompt): the button shows the steps: **Share → Add to Home Screen → Add**, in Safari. On Android without a prompt, it shows **⋮ menu → Install app**.
- **Icons:** drawn by `python manage.py build_game_icons` into `static/img/games/<slug>-{192,512}.png`, plus maskable versions. The colour comes from the game's catalogue colour and the lettering from its initials, or `GLYPHS` in `games/icons.py` (Freshers School Life uses "FSLG"). Run it again after adding a game; a test fails if a playable game has no icon.
- **Manifests:** `/arcade/play/<slug>/manifest.webmanifest` for each game (scope is that game's page, display is full screen) and `/arcade/manifest.webmanifest` for the arcade. The page sets them through `app_manifest`, `app_icon` and `app_title` in `templates/partials/head.html`.

## Adding content to a game without breaking offline play

The package is built from:
- the catalogue (`deps`, `packs`, the game script, 3D engine);
- every `{% static %}` file in the play page and in all the templates it includes, extends or pulls in through an inclusion tag;
- the game's icons;
- the sound manifests;
- whatever the game declares in `extra["assets"]` in `games/catalogue.py`, or in `games/offline_assets/<slug>.txt` (one static path per line; a folder ending in `/` takes every file in it).

`games/tests/test_offline.py` fails when:
- a game page refers to a static file that is not in its package;
- a game script names a static file that is not in its package;
- a game has no icon or manifest.

For Freshers School Life in production, the one-file bundle (`python manage.py build_fslg`) is used, and packaged, only while it is newer than every source file. Otherwise the separate files are used and packaged.

## What works offline and what needs internet once

| Works offline | Needs internet once |
|---|---|
| Every game that was downloaded, with sounds | Downloading or updating a game |
| Saving results on the phone (sent later) | Signing in (the play page needs a signed-in session or a guest pass) |
| The secret character, once he has been unlocked on that phone | Unlocking the secret character for the first time (the code is checked by the server) |
| Wi-Fi play in Freshers School Life | Buying or equipping items from the arcade shop |
| Cheat codes and game rules (saved with the game) | Leaderboards: offline results appear after syncing |

Limits on offline results, so they cannot be farmed:
- **Batch size:** at most 40 are sent at once.
- **Daily cap:** at most 60 are accepted per player per day.
- **Age:** results older than 14 days are not counted.
- **Spacing:** the usual rule of one counted result per game every 15 seconds still applies, using the time each result was played.

## Sizes (measured)

Shared files (the site shell, the arcade runtime and the common sounds) are stored once on the phone, however many games are saved. The first game downloads them; later games only add their own files.

| Game | First game saved on a phone | Added when another game is already saved |
|---|---|---|
| Freshers School Life | 4.7 MB | 2.7 MB |
| Momentum Cup, Impulse Arena, Volt City, Kinetic Kingdom, Wavefront | 2.2 MB | about 0.2 MB |
| Induction Dash, Logic Labyrinth, Circuit Forge, Light Bender | 2.0–2.1 MB | under 0.15 MB |
| **All ten games** | | **about 5.8 MB in total** (2.0 MB of it shared) |

iPhones download the `.m4a` sound files, which are about 50% larger than the `.ogg` files Android uses. Recorded voices for Freshers School Life are an optional extra download once they exist.

## Wi-Fi play without internet (Freshers School Life)

Phones play together directly, with no server, for up to 6 players.

1. **Get on one network.** Every phone joins the same Wi-Fi, or, better, one phone turns on its **hotspot** and the others join it. A hotspot needs no data.
2. **Host.** One person taps **Wi-Fi play → Host a game**. Their phone shows a QR code.
3. **Join.** A friend points their phone camera at that QR code. It opens a small page that passes the invite to their game, which must already be open in the same browser. If that does not work, they paste the invite text instead.
4. **Answer.** The friend's game shows an answer QR code. The host scans it with their camera, or pastes the answer text.
5. **Play.** Both phones are now in the same campus. Repeat steps 3–4 for each friend.

**If it says "Could not connect":** the Wi-Fi is probably blocking phones from talking to each other ("client isolation"). Campus, hotel and public Wi-Fi often do this. Use a phone hotspot instead.

**iPhone:** if the game was added to the Home Screen, the camera opens Safari, which cannot pass the code to the Home Screen app. Use the copy-and-paste text instead.

**Other games:** their two-player modes are on one device, so they already work offline. Only Freshers School Life has multi-phone play.

## Requirements and checks for the live site

- **HTTPS.** Offline saving (service workers) and Wi-Fi play (WebRTC) only work on `https://` (or `localhost`). Production settings already force HTTPS (`SECURE_SSL_REDIRECT`, HSTS). To confirm on the live site, open a game. In Chrome, open DevTools → Application → Service Workers: `/sw.js` should be "activated and running". Cache Storage should list `ee-arcade-<game>` after downloading.
- **Static files.** Run `collectstatic` as usual. Downloaded games refer to the same hashed file names, so a deploy shows **Update offline copy** to students who have an older copy.
- **Database migration.** `games/0004_offline_submissions` must be applied. It stores the ids of synced offline results so a result is never counted twice.

## How this reduces load on the server

- **Saved files stay on the phone.** Once a game is saved, the service worker serves its pictures, sounds, 3D engine and content-hashed scripts from the phone, even when online.
- **Online visits stay small.** A player who is online still asks the server for the play page (it carries their name and settings), with a 4-second limit before the saved copy is used.
- **Wi-Fi play costs the server nothing.** Room traffic goes phone to phone. With the website relay, each player sends 4 requests a second to the server.
- **Offline results arrive in batches.** They come in when the phone reconnects, not as one request per game.

## Files

| File | What it does |
|---|---|
| `games/offline.py` | Builds the package manifest: files, sizes, version hash |
| `games/views.py` | `api_package`, `api_packages`, `api_sync` (the outbox), `lan_page` |
| `games/models.py` | `OfflineSubmission`: ids of synced results |
| `static/js/games/arcade-offline.js` | Download button, the banner, the outbox |
| `static/js/games/arcade-lan.js` | Wi-Fi play (WebRTC, pairing codes, the host's room) |
| `static/vendor/qrcode-generator@1.4.4/` | QR code drawing (MIT licence, see `LICENSE`) |
| `static/sw.js` | The site service worker, with the "Arcade games saved for offline play" section |
| `templates/games/lan.html` | The small page a pairing QR code opens |
| Tests | `games/tests/test_offline.py`, `lan_harness.js`, `sw_harness.js` |
