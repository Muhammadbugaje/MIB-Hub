# How to run MIB-Hub (one page)

Everything below is typed in the **Terminal** app. Each line in a grey box is one command: copy it, paste it, press Enter, and wait for it to finish before the next one.

## 1. Every time: open the project

```
cd ~/Downloads/MIB-Hub
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
```

The first line goes into the project folder. The second tells the Terminal which version of Node (the program that runs the site) to use. You need both in every new Terminal window.

## 2. Start the website

```
npm run dev
```

Wait until it prints `Local http://localhost:4321/`, then open **http://localhost:4321** in your browser. Leave this Terminal window open: closing it stops the site. To stop it on purpose, click the window and press **Control + C**.

| Page | Address |
|---|---|
| Home | http://localhost:4321 |
| Sign in | http://localhost:4321/auth/sign-in |
| Register | http://localhost:4321/auth/register |
| Your profile | http://localhost:4321/account/profile |
| Admin panel (owner and admins only) | http://localhost:4321/admin |

**Signing in as the owner:** use the `OWNER_EMAIL` and `OWNER_PASSWORD` written in the `.env` file in the project folder. Right now the email there is a placeholder, `owner@example.test`. To use your own: change those two lines in `.env`, then run `npm run db:reset` (this wipes the local test database and rebuilds it with your new owner account).

**Forgot password** emails are not really sent on your Mac: the reset link is printed in the Terminal window that is running the site.

## 3. Look inside the database

Open a **second** Terminal window, do step 1 again, then:

```
npm run db:studio
```

When it says `Drizzle Studio is up and running`, open **https://local.drizzle.studio** in your browser. You see every table (users, games, cheats, scores, settings…) and can click into any of them. The page is only a viewer program from the internet; your data stays on your Mac. Stop it with **Control + C**.

The database itself is one file: `apps/web/.data/dev.sqlite`. It is never put in git.

## 4. Database commands

| Command | What it does | When |
|---|---|---|
| `npm run db:migrate` | Creates or updates the tables | After pulling new code that changes the database |
| `npm run db:seed` | Adds the games, roles, cheats, heroes and the owner account (safe to repeat) | After migrate, or after changing `.env` |
| `npm run db:reset` | Deletes the local database and rebuilds it from scratch | When it is in a mess. **Deletes all local test accounts** |

## 5. Check that nothing is broken

Before saying something is finished, run all four. Each must end with no errors:

```
npm run typecheck
npm run lint
npm test
npm run build
```

## 6. The story tools

| Command | What it does |
|---|---|
| `python3 tools/story/check_missions.py` | Checks all 120 mission scripts for mistakes (ids, line lengths, dates, seals, Muhammad sightings, Rumi quotes and more). It must end with `0 error(s)` |
| `python3 -m unittest tools/story/test_check_missions.py` | Tests the checker itself |
| `.venv/bin/python tools/story/md2pdf.py` | Rebuilds the story PDFs in `docs/plan/` after any change to the scripts |

If `.venv` is missing (for example on a new computer), create it once: `python3 -m venv .venv` then `.venv/bin/pip install reportlab==4.4.4`.

## 7. If something goes wrong

- **"command not found: npm"**: you skipped the `export PATH=…` line in step 1.
- **"address already in use"**: the site is already running in another window. Use that one, or stop it with Control + C.
- **A page says 403**: you are signed in, but not as the owner or an admin.
- **The disk is full**: check with `df -h /System/Volumes/Data`. This Mac often has under 5 GB free.

The longer beginner guide, covering accounts, online databases and putting the site live, is `docs/SETUP_GUIDE.pdf`.
