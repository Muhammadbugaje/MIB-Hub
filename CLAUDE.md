# MIB-Hub: instructions for Claude

Read `READ-CLAUDE.md` before doing anything. It has the project map, what's done, the next steps in order, and the owner's rules.

Key rules (details in READ-CLAUDE.md §5):

- **Old Django project:** never edit `~/Downloads/eehub-2`. It is frozen.
- **Privacy:**
  - Never put real people's photos into git or anywhere online. Use first names only.
  - Never import real users' data.
- **Special characters** (Jiya, Taty, Zainab, Madison) appear only in conditional blocks with fallbacks. Zainab is very fair-skinned ("Snow White").
- **No secrets in git:**
  - `.env` and `data/seed/private/` stay local.
  - Cheat codes and hero passwords are hashed.
- **Code:**
  - Make small, exact edits.
  - Add tests for every system.
  - Pin exact dependency versions.
  - Run typecheck, lint, test and build before claiming something is done.
- **Commit messages** end with the co-author line.
- **Screenshots:** Playwright doesn't work on this Mac (macOS 12). Use `scripts/screenshot.py`.
- **Disk:** it is often nearly full. Check `df -h /System/Volumes/Data` before installs and renders.
- **The owner** is new to TypeScript. Explain plainly. Give documents they read as PDFs.
