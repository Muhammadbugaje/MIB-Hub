# MIB-Hub Setup Guide

This guide is for someone new to TypeScript. It takes you from an empty terminal to a running MIB-Hub on your Mac, then shows how to put it online. Every command is typed in Terminal, inside the `MIB-Hub` folder.

---

## 1. What you are running

MIB-Hub is one website with three parts:

| Part | What it does | Where it lives |
|---|---|---|
| The website | Pages, sign-in, the games, the admin panel | `apps/web` |
| The database layer | Tables and the code that reads and writes them | `packages/db` |
| The design system | Colours, fonts, dark and light themes, animations | `packages/ui` |

It is written in **TypeScript**, which is JavaScript with types. Types let the editor warn you about mistakes before the site runs. The site uses **Astro**, a framework that builds fast pages, plus **React** for the interactive parts.

## 2. One-time setup on your Mac

### 2.1 Node.js

Node.js runs the site. It is already installed through nvm. Run this once in each new Terminal window:

```
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
node -v        # should print v24.22.2
```

To stop typing it every time, add that `export` line to the end of `~/.zshrc`.

### 2.2 Install the packages

```
cd ~/Downloads/MIB-Hub
npm install
```

This creates `node_modules`, the libraries the site needs. Disk is tight on this Mac, so check free space first with `df -h /System/Volumes/Data`. You need about 1 GB free.

### 2.3 Your settings file (.env)

```
cp .env.example .env
```

Open `.env` in VS Code and fill it in:

| Setting | What to put |
|---|---|
| `SITE_URL` | Leave `http://localhost:4321` on your Mac. |
| `DATABASE_DRIVER` | `sqlite` on your Mac. |
| `BETTER_AUTH_SECRET` | A long random string. Make one with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `MAIL_DRIVER` | `console` on your Mac: emails (such as password-reset links) are printed in the Terminal instead of being sent. |
| `OWNER_NAME`, `OWNER_EMAIL`, `OWNER_PASSWORD` | Your own admin account. Put quotes around anything with spaces, e.g. `OWNER_NAME="Your Name"`. |

**Never share or commit `.env`.** Git already ignores it.

### 2.4 Create the local database

```
npm run db:migrate     # creates the tables
npm run db:seed        # loads the 16 games, settings, cheats, heroes and your owner account
```

The database is a single file: `apps/web/.data/dev.sqlite`. To start fresh at any time, run `npm run db:reset`. It deletes that file and rebuilds it.

## 3. Everyday use

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site at http://localhost:4321. It reloads when you save a file. Stop it with Ctrl+C. |
| `npm test` | Runs the automated tests. |
| `npm run typecheck` | Checks the TypeScript for mistakes. |
| `npm run lint` | Checks code style. |
| `npm run build` | Builds the production version. Do this before deploying. |

**Signing in:** open http://localhost:4321, choose Sign in, and use the owner email and password from `.env`. The **Admin** link appears in the menu for owner and admin accounts.

**Roles:**

| Role | Can do |
|---|---|
| owner | Everything |
| admin | Everything except changing the owner |
| moderator | Leaderboards and player reports |
| player | Play, save, appear on leaderboards |
| guest | Play without an account |

## 4. Working with Claude

Open the `MIB-Hub` folder in VS Code and start a new Claude session there. Claude reads `READ-CLAUDE.md` first, which explains the whole project. Good first messages:

- "Read READ-CLAUDE.md and start step 1, the story audit."
- "Port the games next."
- "Build the management panel section for cheats and heroes."

## 5. Putting it online

You have two good choices. **Cloudflare is recommended:** the website, database and files all live in one place, and there is a generous free tier.

### Option A: Cloudflare (recommended)

| Need | Cloudflare product |
|---|---|
| Website | Cloudflare Pages / Workers |
| Database | **D1**. It is SQLite, so the same tables and migrations as on your Mac. |
| Files: videos, game assets | **R2** storage |

**Steps:**
1. Make a free Cloudflare account. Buy or connect your domain there.
2. In the project, install the Cloudflare tools. Claude can do this for you; the details are in `docs/DATABASE.md`, section 2.
3. Create the database: `npx wrangler d1 create mib-hub`.
4. Create the tables online: `npx wrangler d1 migrations apply mib-hub --remote`.
5. Add the secrets: `npx wrangler secret put BETTER_AUTH_SECRET`, and the same for `SITE_URL`.
6. Connect the GitHub repository to Cloudflare Pages, so each push deploys automatically.
7. Set up real email for password resets with a mail service such as Resend or Mailgun, and change `MAIL_DRIVER`.

### Option B: Supabase or Aiven (Postgres)

Use one of these if you later want a bigger database with more tools. Supabase also gives you a dashboard to browse the data. Switching needs a Postgres version of the tables; `docs/DATABASE.md`, section 3, explains how, and Claude can do it. The site's pages don't change, because they only talk to the repository layer.

**Which to choose?** Start with **Cloudflare D1**. Move to Supabase only if you outgrow it.

## 6. Where your other files are

| What | Where |
|---|---|
| Trailers, screenshots, notes, voice files, design art | `~/Downloads/games-files/` (see its `INDEX.md`) |
| The old Django site | `~/Downloads/eehub-2`. Frozen; no longer used. |
| Plain cheat codes (private) | `MIB-Hub/data/seed/private/cheats_plain.json`. Never share or commit it. |

## 7. Backups

- The code is saved in **git**. Each piece of work is a commit. Create a private GitHub repository and push to it, so there is a copy off this Mac:
  ```
  git remote add origin <your repo URL>
  git push -u origin main
  ```
- Your local database is one file. Copy `apps/web/.data/dev.sqlite` somewhere safe if it holds anything you need.
- Back up `~/Downloads/games-files` to an external drive or cloud storage. The videos are too big for git.

## 8. If something goes wrong

| Problem | Fix |
|---|---|
| `command not found: npm` | Run the `export PATH=...` line from 2.1. |
| `ENOSPC` or "no space left" | The disk is full. Free space, then try again. |
| Port 4321 already in use | Another dev server is running. Close that Terminal, or run `lsof -i :4321` and stop it. |
| Can't sign in as owner | Check `.env`, then run `npm run db:seed` again. |
| The site looks broken after pulling changes | Run `npm install`, then `npm run db:migrate`. |
