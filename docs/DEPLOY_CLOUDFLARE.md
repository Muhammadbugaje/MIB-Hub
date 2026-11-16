# Deploying MIB-Hub to Cloudflare

The live site runs on **Cloudflare Workers**. After the one-time setup below, putting a new version online is just:

```
git push
```

Cloudflare sees the push, builds the site and puts it live, usually in two or three minutes.

## 1. How it fits together

| Piece | Locally (`npm run dev`) | On Cloudflare |
|---|---|---|
| The website code | Node on your Mac | A Cloudflare Worker named `mib-hub` |
| Database | `apps/web/.data/dev.sqlite` | D1 database `mib-hub` (binding `DB`) |
| Uploaded images and sounds | `apps/web/.data/uploads/` | R2 bucket `mib-hub-uploads` (binding `UPLOADS`) |
| Pictures, scripts, game files | `apps/web/public/` | Cloudflare's static file hosting (from `apps/web/dist/`) |
| Settings and secrets | `.env` | `vars` in `apps/web/wrangler.jsonc`, plus secrets |

The code picks the right side by itself. The files that differ are `apps/web/src/platform/node.ts` (your Mac) and `apps/web/src/platform/workers.ts` (Cloudflare). Everything else is shared.

All Cloudflare settings live in `apps/web/wrangler.jsonc`.

## 2. One-time setup

Do these steps once, in order. Run every command from the repo folder, in Terminal, after:

```
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
cd ~/Downloads/MIB-Hub/apps/web
```

### Step 1. Sign Wrangler in to your Cloudflare account

```
npx wrangler login
```

A browser window opens. Click **Allow**.

### Step 2. Create the database

```
npx wrangler d1 create mib-hub
```

It prints a block with `"database_id": "…"`. Copy that long id. Open `apps/web/wrangler.jsonc` and replace `PASTE-YOUR-D1-DATABASE-ID-HERE` with it. The id is not a secret, so it is fine in git.

### Step 3. Create the uploads bucket

```
npx wrangler r2 bucket create mib-hub-uploads
```

If Cloudflare asks you to turn on R2 first, do so in the dashboard (**R2 Object Storage**, then **Get started**) and run the command again. R2 has a free allowance.

### Step 4. Set the site address

In `apps/web/wrangler.jsonc`, under `vars`, replace `https://PASTE-YOUR-SITE-ADDRESS-HERE` with the address the site will use. Sign-in only works from this exact address.

- If you are not using your own domain yet, use the free one: `https://mib-hub.<your-subdomain>.workers.dev`. Your subdomain is shown in the dashboard under **Workers & Pages**, on the right.
- When you add your own domain later, change `SITE_URL` to it and push again.

### Step 5. Set the secret

```
npx wrangler secret put BETTER_AUTH_SECRET
```

When asked, paste a long random value. You can make one with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Use a **new** value, not the one in your `.env`. Secrets are stored by Cloudflare only and never go into git.

If the Worker does not exist yet, Wrangler offers to create it. Say yes.

### Step 6. Create the tables in the database

```
npm run d1:migrate
```

This runs the same migration files the local database uses (`packages/db/migrations`). Run it again whenever a new migration is added.

### Step 7. Load the starting data

The starting data is the games, roles, settings, cheats, heroes and **your owner account** (taken from `OWNER_NAME`, `OWNER_EMAIL` and `OWNER_PASSWORD` in your `.env`).

```
npm run d1:seed-sql
npx wrangler d1 execute mib-hub --remote --file=.data/d1-seed.sql
```

The first command builds the data into a SQL file, `apps/web/.data/d1-seed.sql`. That file contains your email and password hash, so it stays in the git-ignored `.data` folder: never share it. Running both commands again is safe, because rows that are already there are skipped.

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

You can leave "Build output directory" out: `wrangler.jsonc` already says where the built files are (`dist/`).

Cloudflare installs the packages itself before building. It finds the repo's `package-lock.json` one folder up, so the shared packages (`@mib/db`, `@mib/ui`) are installed too.

If you already made a **Pages** project for MIB-Hub, delete it or leave it unused. This site is a **Workers** project, which is Cloudflare's newer way of running a full site.

### Step 9. Push

```
git push
```

Watch the build under **Workers & Pages**, then **mib-hub**, then **Deployments**. When it is done, open your `SITE_URL` and sign in with your owner account.

## 3. Every day after that

- **Change code:** commit and `git push`. That is all.
- **New database migration** (a new file in `packages/db/migrations`): run `npm run d1:migrate` from `apps/web`, **before** pushing the code that needs it.
- **See errors:** go to **Workers & Pages**, then **mib-hub**, then **Logs**.
- **Try the Cloudflare version on your Mac** (optional): run `npm run build -w @mib/web`, then `npm run preview -w @mib/web`. It starts at http://localhost:8787 and uses a *local* copy of D1 and R2 in `apps/web/.wrangler/`. First set it up once from `apps/web`:
  - `npx wrangler d1 migrations apply mib-hub --local`
  - `npx wrangler d1 execute mib-hub --local --file=.data/d1-seed.sql`
  - Make a file `apps/web/.dev.vars` (git-ignored) with `BETTER_AUTH_SECRET=<any 32+ characters>` and `SITE_URL=http://localhost:8787`.

  Wrangler warns that macOS 12 is older than it supports. It still worked on this Mac in testing.

## 4. Good to know

- **Plan.** Password hashing (scrypt) takes more CPU time than the Workers **Free** plan allows for one request (10 ms), so sign-in and registration may fail with error 1102 on Free. The **Workers Paid** plan (5 US dollars a month) allows much more and is recommended before real players arrive. Check Cloudflare's current limits on the day.
- **Email.** `MAIL_DRIVER` is `console`, so password-reset emails are only written to the Worker's logs, not sent. A real email provider is still to do (see `apps/web/src/lib/mailer.ts`).
- **Rate limits** (for example on `/api/track`) are counted per Cloudflare server copy, not across the whole world. That is fine for now. It can move to a KV store or Cloudflare's rate-limiting binding later.
- **Size limits.** Each static file must be 25 MiB or smaller, with at most 20,000 files. The Worker itself is about 0.85 MiB compressed, well under the 3 MiB limit on Free (10 MiB on Paid).
- **Uploads made on your Mac** stay on your Mac. Upload images again through the live admin panel, or copy them with `npx wrangler r2 object put mib-hub-uploads/<folder>/<file> --file=<path> --remote`.
- **Running the site as a plain Node server** is still possible: `ASTRO_ADAPTER=node npm run build -w @mib/web`.
