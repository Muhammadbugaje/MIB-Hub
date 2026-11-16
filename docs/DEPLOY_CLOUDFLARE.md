# Deploying MIB-Hub to Cloudflare (Free plan)

The live site runs on **Cloudflare Workers, Free plan**. It needs **no payment card**: no R2, no Workers Paid plan. After the one-time setup below, putting a new version online is just:

```
git push
```

Cloudflare sees the push, builds the site and puts it live, usually in two or three minutes.

## 1. How it fits together

| Piece | Locally (`npm run dev`) | On Cloudflare (Free) |
|---|---|---|
| The website code | Node on your Mac | A Cloudflare Worker named `mib-hub` |
| Database | `apps/web/.data/dev.sqlite` | D1 database `mib-hub` (binding `DB`) |
| Uploaded images and sounds | `apps/web/.data/uploads/` (files) | **Inside the D1 database** (the `blob` table) |
| Pictures, scripts, game files | `apps/web/public/` | Cloudflare's static file hosting (from `apps/web/dist/`) |
| Settings and secrets | `.env` | `vars` in `apps/web/wrangler.jsonc`, plus secrets |

The code picks the right side by itself. The files that differ are `apps/web/src/platform/node.ts` (your Mac) and `apps/web/src/platform/workers.ts` (Cloudflare). Everything else is shared.

All Cloudflare settings live in `apps/web/wrangler.jsonc`. It has one database binding (`DB`) and the static files (`ASSETS`). Nothing else is needed.

### Why uploads live in the database

Cloudflare's file storage (R2) asks for a payment card, even for its free allowance. This site uploads only a few small files (people's photos, avatars, post covers, replacement game sounds), and most of its pictures are made in code. So uploads are stored as rows in D1, which is free (5 GB):

- A file is cut into parts of up to 1 MB, one row each, because D1 allows about 2 MB per value. Images can be up to 4 MB (4 parts) and sounds up to 2 MB.
- Each file keeps its type, size and SHA-256 checksum. The checksum is the file's ETag, so a browser that already has a picture gets a tiny "not changed" reply.
- Upload names are random and never reused, so browsers keep pictures for a year.
- The code: `packages/db/src/blob-store.ts`, table `blob` (migration `0003_blob_storage.sql`).

### Passwords on the Free plan

The Free plan stops a request after **10 ms of CPU time**. Better Auth's usual password hashing (scrypt) needs far more than that, so sign-in and registration would fail with error 1102. The site therefore hashes passwords with **PBKDF2-SHA256 through Web Crypto**, which Cloudflare runs as fast native code:

- Stored as `pbkdf2-sha256$<rounds>$<salt>$<hash>`. The rounds are written into each hash.
- **20,000 rounds.** Measured: about 15 ms on this 2015 MacBook Air (1.8 GHz, no SHA hardware), so roughly 3 ms on Cloudflare's servers, which are several times faster and have SHA instructions. That leaves room for the rest of the sign-in inside 10 ms. Workers refuse more than 100,000 rounds in any case.
- **The trade-off.** OWASP recommends 600,000 rounds for PBKDF2-SHA256. 20,000 rounds makes each password about 30 times cheaper to guess **if someone stole a copy of the database**. It makes no difference to someone guessing through the sign-in form. The minimum password length is 8. If you ever move to the Paid plan, raise `PBKDF2_ITERATIONS` in `packages/db/src/crypto.ts`: every account then upgrades by itself at its next sign-in.
- **Older hashes still work.** Accounts made before 16 November 2026 have scrypt hashes. They still sign in, and the hash is replaced by a PBKDF2 one at that moment. Checking one scrypt hash costs more than 10 ms, so that one sign-in could fail on Free. For that reason the owner account on the live database has already been re-hashed (see step 7). Any other old account just tries again.
- **Hero codes** use the same hasher. The two hero codes imported from the old Django site use 1,200,000 rounds, which Workers cannot check. On the live site, set each hero code again under **Admin, then Games, then the game**. The new code is stored in the new format. On your Mac (`npm run dev`) the old codes still work, and they upgrade on first use.

## 2. One-time setup

Do these steps once, in order. Run every command in Terminal, after:

```
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
cd ~/Downloads/MIB-Hub/apps/web
```

### Step 1. Sign Wrangler in to your Cloudflare account

```
npx wrangler login
```

A browser window opens. Click **Allow**.

### Step 2. Create the database (done)

```
npx wrangler d1 create mib-hub
```

It prints a block with `"database_id": "…"`. That id is already in `apps/web/wrangler.jsonc`. The id is not a secret, so it is fine in git.

### Step 3. Set the site address (done)

In `apps/web/wrangler.jsonc`, under `vars`, `SITE_URL` is the address the site uses. Sign-in only works from this exact address. It is now the free `workers.dev` address. When you add your own domain later, change `SITE_URL` to it and push again.

### Step 4. Set the secret

```
npx wrangler secret put BETTER_AUTH_SECRET
```

When asked, paste a long random value. You can make one with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Use a **new** value, not the one in your `.env`. Secrets are stored by Cloudflare only and never go into git. If the Worker does not exist yet, Wrangler offers to create it. Say yes.

### Step 5. Create the tables in the database

```
npm run d1:migrate
```

This runs the same migration files the local database uses (`packages/db/migrations`). Run it again whenever a new migration is added. (Done up to `0003_blob_storage`.)

### Step 6. Load the starting data (done)

The starting data is the games, roles, settings, cheats, heroes and **your owner account** (taken from `OWNER_NAME`, `OWNER_EMAIL` and `OWNER_PASSWORD` in your `.env`).

```
npm run d1:seed-sql
npx wrangler d1 execute mib-hub --remote --file=.data/d1-seed.sql
```

The first command builds the data into a SQL file, `apps/web/.data/d1-seed.sql`, with the owner's password already in the new PBKDF2 format. That file contains your email and password hash, so it stays in the git-ignored `.data` folder: never share it. Running both commands again is safe, because rows that are already there are skipped. That also means an owner row that is already there keeps its old password; step 7 fixes that.

### Step 7. Re-hash the owner's password (done 16 Nov 2026)

```
npm run d1:owner-password -- --remote
```

This stores `OWNER_PASSWORD` from your `.env` as a PBKDF2 hash on the owner's account in the live database. It changes that one row only, and it never prints the password or the hash. Run it again whenever you change `OWNER_PASSWORD` in `.env` and want the live site to match.

### Step 8. Connect GitHub to Cloudflare

In the Cloudflare dashboard, go to **Workers & Pages**, then **Create**, then **Import a repository**. Pick the MIB-Hub repository. Use these settings:

| Setting | Value |
|---|---|
| Project name | `mib-hub` (it must match `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| Root directory (path) | `apps/web` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Build variable | `NODE_VERSION` = `24.22.2` |

You can leave "Build output directory" out: `wrangler.jsonc` already says where the built files are (`dist/`). Cloudflare installs the packages itself before building. It finds the repo's `package-lock.json` one folder up, so the shared packages (`@mib/db`, `@mib/ui`) are installed too. Builds are free (Workers Builds: 3,000 build minutes a month on Free).

If you already made a **Pages** project for MIB-Hub, delete it or leave it unused. This site is a **Workers** project.

### Step 9. Push

```
git push
```

Watch the build under **Workers & Pages**, then **mib-hub**, then **Deployments**. When it is done, open your `SITE_URL` and sign in with your owner account.

## 3. Every day after that

- **Change code:** commit and `git push`. That is all.
- **New database migration** (a new file in `packages/db/migrations`): run `npm run d1:migrate` from `apps/web`, **before** pushing the code that needs it.
- **See errors:** go to **Workers & Pages**, then **mib-hub**, then **Logs**. Error 1102 means a request used too much CPU time.
- **Try the Cloudflare version on your Mac** (optional): from `apps/web`, run `npm run build`, then `CI=1 npx wrangler dev`. It starts at http://localhost:8787 (open it as `localhost`, not `127.0.0.1`, or sign-in forms are refused) and uses a *local* copy of D1 in `apps/web/.wrangler/`. First set it up once:
  - `CI=1 npx wrangler d1 migrations apply mib-hub --local`
  - `CI=1 npx wrangler d1 execute mib-hub --local --file=.data/d1-seed.sql`
  - A file `apps/web/.dev.vars` (git-ignored) with `BETTER_AUTH_SECRET=<any 32+ characters>` and `SITE_URL=http://localhost:8787`.

  `CI=1` is needed on this Mac: Wrangler refuses to start its local runtime on macOS 12, but the runtime itself works here. Only use it for these local commands.

## 4. Free plan limits that matter

Check Cloudflare's current limits on the day; these are the November 2026 numbers.

| Limit (Free) | What uses it here | Is it a worry? |
|---|---|---|
| **100,000 requests a day** (Worker) | Every page, every API call. Static files (pictures, game files, scripts) are free and do not count. | Not for starters. The daily count resets at midnight UTC. Past it, visitors see an error page until then. |
| **10 ms CPU time per request** | Password checks (about 3 ms), page rendering, upload saving. Waiting for the database does not count. | Covered by PBKDF2 (above). A 4 MB image upload is the heaviest request (reading the form and the checksum): keep pictures small (under 1 MB is best). |
| **D1: 5 million rows read a day** | Every page reads the session, switches and its own data. Admin analytics pages add up all play events in their time range. | Fine at first. Watch it in the dashboard (**D1, then mib-hub, then Metrics**) once play events reach the hundreds of thousands, since each analytics page view reads them all. |
| **D1: 100,000 rows written a day** | Each play-tracker event (`/api/track`) is 1 row plus its 3 index entries (about 4 rows written). A play sends a `start` and an `end`, and some games send level events too. Offline sync sends at most 40 items a batch. Uploads write 1 row per MB. | About 10,000 to 25,000 plays a day before the limit. Plenty for starters. Past it, writes fail until midnight UTC (pages still show). |
| **D1: 5 GB storage** (10 databases) | Everything, including uploads. | Years of headroom at a few uploads a week. |
| **D1: about 2 MB per value** | Uploads are cut into 1 MB parts. | Handled. |
| **Worker size: 3 MiB compressed** | The site's code. | About 0.85 MiB now (`npx wrangler deploy --dry-run` shows it). |
| **Static files: 25 MiB each, 20,000 files** | Game files, pictures. | Fine. Big videos (trailers) do not belong here: link to YouTube instead. |
| **50 outbound requests per request** | The site makes almost none (email will add one). | Fine. |

## 5. Good to know

- **Email.** `MAIL_DRIVER` is `console`, so password-reset emails are only written to the Worker's logs, not sent. A real email provider is still to do (see `apps/web/src/lib/mailer.ts`). Several have free tiers with no card.
- **Rate limits** (for example on `/api/track` and on sign-in) are counted per Cloudflare server copy, not across the whole world. That is fine for now.
- **Uploads made on your Mac** stay on your Mac (`apps/web/.data/uploads/`). Upload them again through the live admin panel.
- **Backups.** D1 keeps 30 days of history on Free ("Time Travel"): `npx wrangler d1 time-travel info mib-hub`. To keep a copy on your Mac: `npx wrangler d1 export mib-hub --remote --output=.data/backup.sql` (it holds password hashes and uploads: never share it).
- **Running the site as a plain Node server** is still possible: `ASTRO_ADAPTER=node npm run build -w @mib/web`.
