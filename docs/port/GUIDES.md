# Port spec: in-app guides

Source: the old Django site at `~/Downloads/eehub-2` (read-only). This file lists every in-app guide and guide-like
page, where its words come from, and how to turn them into MIB-Hub user guides. Paths are relative to `eehub-2/`
unless they start with `MIB-Hub/`. Read on 15 Nov 2026.

No personal data is copied. The guide sources name demo accounts (e-mails and person names used to take the
screenshots); those are not repeated here.

---

## 0. Summary

| Family | Where the words live | Count | Served at | Audience |
|---|---|---|---|---|
| **Help and how-to guides** (illustrated) | Python data in `content/guide_content/*.py` | 61 | `/guides/`, `/guides/<slug>/`, `/guides/<slug>/guide.pdf` | Students, lecturers and staff, officers and admin, everyone |
| Help guide registered by another app (text blocks) | `assistant/guides.py` (`ask-ee-hub`) | 1 | same | Everyone |
| Handbooks (combined PDFs) | built from the guides above | 2 | `/guides/handbook/<students\|staff>.pdf` | Students; staff |
| **Arcade secret-character guide** (owner) | computed from `games/cheat_defaults/<slug>.json` + live settings | 1 page, one section per playable game | `/arcade/settings/secret-character/` (+ A2 hero tab, + exports) | Arcade managers |
| Arcade Management help box | inline in `templates/games/settings_home.html` | 1 | `/arcade/settings/` | Arcade managers |
| "How it works" pages of other modules | templates per app | 10 | `/<module>/how-it-works/`, `/access/how/` | Users of each module |
| Developer / owner docs | `docs/*.md` | see section 5 | not served | Owner, developers |

**Guide count: 62 served help guides (61 illustrated + 1 text) + 2 handbooks + 1 arcade secret-character guide +
10 "how it works" pages.**

There are **no guide tables in the database**. `db.sqlite3` (opened read-only) has no `*guide*` table; the
`content_page` table (5 rows: about, history, exam-guidelines, academic-regulations, student-handbook) holds CMS
pages, not how-to guides. All guide words are in Python source, so they port as files.

---

## 1. The guides app (`content`)

### 1.1 URLs and views (`content/urls.py:14-17`, `content/guide_views.py`)

| URL | URL name | View | Behaviour |
|---|---|---|---|
| `/guides/` | `content:guides` | `guide_views.guides` (line 31) | Signed in: `guides/hub.html` (portal layout), every guide, "For you" filter from the active profile, "Start here" picks. Signed out: `guides/hub_public.html` (public layout), public guides only, fixed "Popular guides" (signing-in, register-courses, computer-based-tests, install-the-app), only the student handbook |
| `/guides/<slug>/` | `content:guide_detail` | `guide_views.guide_detail` (line 49) | 404 if unknown; a non-public guide redirects anonymous users to sign-in. `guides/detail.html` or `guides/detail_public.html`. Previous/next = neighbours with the same audience. "Go to the page" button = `reverse(g["page"])` (signed in only) |
| `/guides/<slug>/guide.pdf` | `content:guide_pdf` | `guide_views.guide_pdf` (line 86) | Branded A4 PDF from `content/guide_pdf.py`, cached in `PROTECTED_MEDIA_ROOT/guides/` keyed by a hash of the words, pictures and site address. `?download=1` = attachment |
| `/guides/handbook/<key>.pdf` | `content:guide_handbook` | `guide_views.handbook_pdf` (line 96) | `students` is public; `staff` needs sign-in. Cover + contents with page numbers + every guide of the handbook's audiences, grouped by area |

No permission codename gates the guides: the only rule is `public` (default true) vs sign-in. The 12 officer guides
are `public=False`.

Legacy, not routed: `content/views.py:234 guides` and `:244 guide_detail` with `templates/content/guides.html` and
`guide_detail.html` (an older text-only hub). Ignore when porting.

### 1.2 The registry (`content/guides.py`)

- `GUIDES` = `{slug: dict}`; `ORDER` = illustrated slugs in data order (module order in
  `content/guide_content/__init__.py`: everyone, students, lecturers, officers, round7). Other apps add text guides at
  start-up with `GUIDES.setdefault(...)` (`assistant/guides.py`; `cbt/guides.py` also tries, but both of its slugs,
  `computer-based-tests` and `setting-cbt-tests`, already exist as illustrated guides, so its text versions never
  show).
- `AUDIENCES` = Students, Lecturers and staff, Officers and admin, Everyone (with icon, tone, label in
  `AUDIENCE_META`).
- `AREAS` (hub sections, in order, with icon, tone, blurb): Getting started; Courses and registration; Tests and
  results; Class and communication; Requests and help; SIWES and projects; Community and careers; Teaching;
  Department offices; System administration; anything else falls into "More help".
- `KIND_AUDIENCES`: which audiences a profile sees as "For you" (student → Students, Everyone; lecturer → Lecturers
  and staff, Officers and admin, Everyone; staff → Officers and admin, Lecturers and staff, Everyone; alumni →
  Students, Everyone; admin → all four).
- `HANDBOOKS`: `students` = Everyone + Students; `staff` = Everyone + Lecturers and staff + Officers and admin.
- `get(slug)` adds each step's picture info from `static/img/guides/manifest.json`
  (`static/img/guides/<slug>/NN.webp` desktop and `NN-phone.webp`; 201 webp files in 50 folders).
- Every guide also carries `blocks` (derived for illustrated guides) so the assistant's retrieval
  (`assistant/retrieval.py`) indexes them.

### 1.3 Guide data format (`content/guide_content/_dsl.py`)

```
guide(slug, title, summary, *, audience, area, icon, tone, minutes, as_, who,
      before=[...], steps=[step(...)], tips=[(title, text)], problems=[(question, answer)],
      related=[slugs], page="<url name>", public=True, keywords="")
step(title, text, url, hl, as_=..., do=[actions], crop="auto|top|full", phone=True|{...})
```
`url`/`hl`/`do`/`as_` are screenshot instructions only (page to open, Playwright selector to ring, clicks before the
shot, which demo account). Text-only guides use `blocks`: `("p", text)`, `("h", text)`, `("steps", [..])`,
`("bullets", [..])`, `("tip"|"important"|"note"|"soon", title, text)`.

Screenshots are re-shot by `manage.py build_guides` (`content/management/commands/build_guides.py`) against a running
server with demo data, using Playwright. Its `--password` option defaults to the demo accounts' shared password
written in plain text (`build_guides.py:43`); do not carry that pattern over. Note for MIB-Hub: Playwright does not run on the owner's macOS 12 machine;
use the offscreen WebKit pipeline instead.

### 1.4 Templates (`templates/guides/`)

| Template | Role |
|---|---|
| `hub.html` | Signed-in hub: extends `base.html`, includes `_hub_body.html`, loads `css/guides.css`, `js/guides.js` |
| `hub_public.html` | Public hub: extends `base_public.html`, wraps `_hub_body.html` in `.gd-public .gd-wrap`, meta description |
| `_hub_body.html` | Hero (greeting with the user's short name, or "How-to guides for EE Hub"), live search box (`data-guides-search`, client-side over title, summary, keywords, audience), handbook buttons, audience filter chips ("For you", "All N", one per audience), "Start here" / "Popular guides" (up to 6 featured), one section per area with cards (icon, title, summary, audience, step count, "with pictures", minutes, lock icon for staff-only guides), empty-search message, "Still stuck?" links (report a problem / message the department, or the contact page when signed out) |
| `detail.html` / `detail_public.html` | Guide page, portal or public layout, includes `_guide_body.html` |
| `_guide_body.html` | Breadcrumb (Help and how-to › area), title, summary, meta (audience, steps, pictures, minutes); actions Download PDF, Open to print, Go to the page. Illustrated: "Who this is for", "Before you start", numbered steps with desktop and phone screenshots (click to enlarge in a `<dialog>` lightbox), Tips, Common problems (`<details>`). Text guides: rendered `blocks`. Then Related guides, Previous/Next, and a sticky aside with the step list and "Keep it" (this guide PDF, student handbook, staff handbook if signed in, all guides) |
| `widget.html` | Dashboard widget "How-to guides" (`content/widgets.py`): up to 4 picks for the active profile (`PICKS`), "All N →", "Find a guide", the profile's handbook PDF. Added to every profile's default dashboard |

Other entry points: `{% guide_link "slug" %}` (`content/templatetags/guide_tags.py`) puts "Full guide with
pictures → · PDF" on workflow pages (with `ALIASES` for shared SIWES partials), and the user menu item "Help and
how-to".

### 1.5 Dashboard picks per profile (`content/widgets.py:5`)

| Profile | Picks |
|---|---|
| student | register-courses, course-form-and-exam-card, computer-based-tests, my-class, timetable-and-reminders |
| lecturer | my-courses-and-allocation, setting-cbt-tests, score-sheets, assignments-and-marking, signature-upload |
| staff | reviewing-course-forms, registration-desk, timetable-editor, messages-and-chat |
| alumni | careers-and-cv, alumni-sign-up, messages-and-chat |
| admin | settings-and-appearance, users-and-permissions, act-as-another-user, import-export, backups |

---

## 2. Every help guide

Each illustrated guide has the same sections: **Who this is for**, **Before you start** (bullets), **numbered steps**
(title + one or two sentences + desktop picture, sometimes a phone picture), **Tips**, **Common problems**, **Related
guides**. The table gives the step outline; "Tips / problems" gives how many of each. "Workflow page" is the Django URL name the guide's
"Go to the page" button opens.

Sources: `everyone.py` (8), `students.py` (17), `lecturers.py` (12), `officers.py` (12), `round7.py` (12).

### Getting started (9)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `signing-in` | Signing in and choosing your password | Everyone | 3 | 1. Open the sign-in window; 2. Type your sign-in name and password; 3. Keep me signed in, only on your own device; 4. Choose your own password the first time; 5. Forgot your password? | 2 / 3 | public | `accounts:login` |
| `switching-profiles` | Switching between your profiles | Everyone | 2 | 1. See who you are acting as; 2. Open the profile menu and choose a profile; 3. Switch in one click; 4. The menu follows the profile | 2 / 2 | public | — |
| `completing-your-profile` | Completing your profile and photo | Everyone | 3 | 1. Open My profile; 2. Upload your photo; 3. Check your name and contact details; 4. Choose your preferences and save | 2 / 2 | public | `accounts:profile` |
| `notifications` | Notifications, alerts and the daily digest | Everyone | 2 | 1. Watch the bell; 2. Open the latest; 3. See them all and clear them | 2 / 2 | public | `notifications:list` |
| `install-the-app` | Install EE Hub on your phone and use it offline | Everyone | 2 | 1. Open EE Hub in your phone's browser; 2. Install; 3. Offline | 1 / 2 | public | — |
| `keeping-your-account-safe` | Keeping your account safe | Everyone | 2 | 1. Change your password; 2. Sign out on shared computers | 2 / 1 | public | `accounts:password_change` |
| `getting-started-students` | Your first day on EE Hub (students) | Students | 3 | 1. Sign in and choose your password; 2. Your dashboard; 3. The menu; 4. Help is always here | 1 / 1 | public | — |
| `getting-started-lecturers` | Your first day on EE Hub (lecturers) | Lecturers and staff | 3 | 1. Your dashboard; 2. Your courses; 3. The menu | 1 / 1 | public | — |
| `privacy-and-my-data` | Privacy and my data | Everyone | 2 | 1. Open Privacy and my data; 2. Download my data; 3. Staff: the public website; 4. Correct or ask | 1 / 1 | public | `core:privacy` |

### Courses and registration (6)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `register-courses` | Registering your courses | Students | 5 | 1. Open Course registration; 2. Compulsory courses are ticked for you; 3. Add carry-overs; 4. Watch the unit meter; 5. Save a draft, then submit; 6. Approved? Print it | 2 / 3 | public | `registration:mine` |
| `courses-from-other-departments` | Courses from other departments, earlier levels and overrides | Students | 3 | 1. Ask for a course from another department; 2. Type its details; 3. Owe a course from before EE Hub?; 4. Blocked by a rule? Ask for an override | 1 / 1 | public | `registration:mine` |
| `course-form-and-exam-card` | Printing your course form and examination card | Students | 3 | 1. Open your form; 2. The course form; 3. Your examination card | 1 / 2 | public | `registration:exam_card_mine` |
| `timetable-and-reminders` | Your timetable, reminders and calendar | Students | 3 | 1. Open My timetable; 2. Choose reminders; 3. Add it to your calendar; 4. Class and exam timetables | 1 / 1 | public | `timetable:mine` |
| `course-catalogue-and-materials` | The course catalogue and course materials | Students | 3 | 1. Search the catalogue; 2. Open a course; 3. Your shelves; 4. Open a shelf | 1 / 1 | public | `materials:index` |
| `course-study-pages` | Course study pages | Students | 2 | 1. Open a course; 2. Work through it; 3. Test yourself; 4. Suggest a fix | 1 / 0 | public | `knowledge:help` |

### Tests and results (3)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `computer-based-tests` | Taking a computer-based test (CBT) | Students | 4 | 1. Open My tests; 2. Read the rules and start; 3. Answer and move around; 4. Submit | 2 / 2 | public | `cbt:my_tests` |
| `results-and-statement` | Your results and result statement | Students | 2 | 1. Open My results; 2. GPA and CGPA; 3. Download a result statement | 1 / 2 | public | `results:mine` |
| `teaching-feedback` | Teaching feedback cards | Students | 2 | 1. Open Teaching feedback; 2. Fill a card | 1 / 1 | public | `feedback:mine` |

### Class and communication (2)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `messages-and-chat` | Messages, group chats and class chat | Everyone | 3 | 1. Open Messages; 2. Start a new message or group; 3. Act on many chats at once; 4. Your class chat | 2 / 2 | public | `messaging:inbox` |
| `my-class` | My class: classmates, notices, assignments and tutorials | Students | 4 | 1. Open My class; 2. Classmates and chat; 3. Assignments; 4. Submit your work; 5. Tutorials | 1 / 1 | public | `classroom:home` |

### Requests and help (2)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `reporting-an-issue` | Complaints, feedback and reporting a problem | Everyone | 3 | 1. Open Complaints and feedback; 2. Say what happened; 3. Stay anonymous if you need to; 4. Track the answer | 1 / 1 | public | `complaints:mine` |
| `student-requests` | Requests: leave, result queries and more | Students | 3 | 1. Open My requests; 2. Choose what you need; 3. Follow it | 1 / 1 | public | `studentrequests:mine` |

### SIWES and projects (9)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `siwes-applying` | SIWES: eligibility, forms and applying to companies | Students | 4 | 1. Open My SIWES; 2. Download the forms; 3. Answer a few questions; 4. Apply; 5. The department writes to the company | 1 / 1 | public | `siwes:mine` |
| `siwes-logbook` | SIWES: placement form and weekly logbook | Students | 3 | 1. Your placement; 2. The logbook, week by week; 3. Fill the week and get it signed | 1 / 1 | public | `siwes:mine` |
| `final-year-project` | Final-year project: submissions and the corrections loop | Students | 4 | 1. Open My final-year project; 2. Open a stage; 3. Read the corrections; 4. Fix and resubmit with proof; 5. Download everything | 1 / 1 | public | `projects:mine` |
| `supervising-projects` | Supervising final-year projects | Lecturers and staff | 3 | 1. Projects I supervise; 2. Review a stage; 3. Corrections or approval | 1 / 0 | public | `projects:supervision` |
| `siwes-supervision` | SIWES supervision | Lecturers and staff | 2 | 1. My SIWES students; 2. Review a placement | 0 / 0 | public | `siwes:supervision` |
| `siwes-profile` | Your SIWES profile | Students | 2 | 1. Open My SIWES profile; 2. Fill it in and send; 3. Corrections | 1 / 0 | public | `siwes:profile` |
| `siwes-desk-profiles` | SIWES desk: profile form, profiles and supervisors | Officers and admin | 3 | 1. Build the form; 2. Review profiles; 3. Assign supervisors | 0 / 0 | public | `siwes:profiles` |
| `siwes-hod-placements` | SIWES placements for the HOD | Officers and admin | 1 | 1. Open the placements; 2. Approve or return | 0 / 0 | public | `siwes:hod_placements` |
| `siwes-my-students` | My SIWES students (supervisors) | Lecturers and staff | 1 | 1. Open My SIWES students; 2. Plan and record visits | 1 / 0 | public | `siwes:my_students` |

### Community and careers (5)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `eesa-voting` | Voting in EESA elections | Students | 2 | 1. Open Elections; 2. Open the ballot; 3. Choose and confirm; 4. Copy your receipt; 5. Results | 2 / 2 | public | `elections:index` |
| `careers-and-cv` | Jobs, mentors and your CV | Students | 3 | 1. Jobs and internships; 2. Find a mentor; 3. Build your CV | 1 / 0 | public | `careers:jobs` |
| `alumni-sign-up` | After graduation: joining the alumni network | Students | 2 | 1. You get a notification; 2. Confirm your details; 3. Approved | 1 / 1 | public | `lifecycle:alumni_signup` |
| `running-eesa-elections` | Running an EESA election | Officers and admin | 3 | 1. Set it up; 2. HOD approval; 3. Screen candidates; 4. Voting and results | 1 / 0 | public | `elections:how` |
| `eesa-executive-team` | EESA executives and permissions | Students | 2 | 1. Who changes EESA information; 2. The President's team; 3. Handover | 1 / 0 | public | `association:how` |

### Teaching (10)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `my-courses-and-allocation` | My courses and asking to be assigned a course | Lecturers and staff | 3 | 1. Open My courses; 2. Who teaches what; 3. Ask for a course; 4. The course page | 1 / 1 | public | `academics:mine` |
| `course-materials-upload` | Course shelves: uploading materials | Lecturers and staff | 3 | 1. Open the shelf; 2. Add to the shelf; 3. Approve tutor uploads | 1 / 1 | public | `materials:index` |
| `signature-upload` | Uploading your signature | Lecturers and staff | 2 | 1. Open My profile → My signature; 2. Add a new signature; 3. Exam Officer and HOD | 1 / 1 | public | `accounts:profile` |
| `score-sheets` | Score sheets: entering and filling scores | Lecturers and staff | 4 | 1. Open My score sheets; 2. Enter or upload scores; 3. Fill from CBT and assignments; 4. Submit for approval | 1 / 1 | public | `results:sheets` |
| `setting-cbt-tests` | Setting and running a CBT test | Lecturers and staff | 5 | 1. Open Tests; 2. Set the test up; 3. Sections and questions; 4. The eligible list; 5. Invigilate with the live monitor; 6. Results and publishing | 1 / 1 | public | `cbt:tests` |
| `question-banks` | Question banks | Lecturers and staff | 3 | 1. Open Question banks; 2. Add or import questions; 3. Filter and act on many | 1 / 0 | public | `cbt:banks` |
| `attendance-upload` | Uploading attendance | Lecturers and staff | 3 | 1. Open Attendance; 2. Download the sheet; 3. Upload it back; 4. Remind and export | 1 / 1 | public | `attendance:index` |
| `assignments-and-marking` | Class assignments and marking (with AI suggestions) | Lecturers and staff | 4 | 1. Open Classes; 2. Post an assignment; 3. Mark submissions; 4. AI suggestion and release | 1 / 0 | public | `classroom:picker` |
| `class-tutorials` | Tutorials for a class | Lecturers and staff | 2 | 1. Open the class tutorials; 2. Schedule a session; 3. Tutorial tests | 0 / 0 | public | `classroom:picker` |
| `labs-and-equipment` | Laboratories and equipment | Lecturers and staff | 2 | 1. Open a laboratory; 2. Report a fault; 3. Book for a practical | 1 / 0 | public | `labs:howto` |

### Department offices (8)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `course-allocation` | Allocating courses to lecturers | Officers and admin | 3 | 1. Open Course allocation; 2. Allocate a lecturer; 3. The assessment scheme | 1 / 0 | **required** | `academics:allocation` |
| `registration-desk` | The registration desk: outside courses and overrides | Officers and admin | 3 | 1. Open the Registration desk; 2. Confirm or decline; 3. Grant an override | 1 / 0 | **required** | `registration:desk` |
| `reviewing-course-forms` | Reviewing and approving course forms | Officers and admin | 3 | 1. Open Course forms; 2. Review a form; 3. Approve many at once | 1 / 0 | **required** | `registration:review` |
| `exam-officer-results` | Exam Officer: the results pipeline, release and broadsheet | Officers and admin | 4 | 1. The results pipeline; 2. Release results; 3. Corrections; 4. The broadsheet | 0 / 0 | **required** | `results:pipeline` |
| `siwes-coordinator` | SIWES Coordinator: eligibility, forms, application lists and approval | Officers and admin | 4 | 1. The SIWES desk; 2. Applications per company; 3. Send a list for approval; 4. Allocate supervisors | 1 / 0 | **required** | `siwes:desk` |
| `timetable-editor` | Timetable officer: editing and printing timetables | Officers and admin | 3 | 1. Open the Timetable editor; 2. Add a slot; 3. Print class timetables | 1 / 0 | **required** | `timetable:editor` |
| `graduation-and-alumni` | Graduation and alumni requests | Officers and admin | 3 | 1. Promotion and graduation; 2. Alumni requests | 1 / 0 | **required** | `lifecycle:home` |
| `course-form-routing` | Course form review and routing | Officers and admin | 2 | 1. The route is a setting; 2. Approve or return; 3. Sign and stamp | 0 / 1 | public | `registration:how` |

### System administration (7)

| Slug | Title | Audience | Min | Steps (outline) | Tips / problems | Sign-in | Workflow page |
|---|---|---|---|---|---|---|---|
| `act-as-another-user` | Acting as another user | Officers and admin | 2 | 1. Choose the person; 2. Act as, then stop | 0 / 0 | **required** | `core:impersonate_pick` |
| `settings-and-appearance` | Settings, appearance and themes | Officers and admin | 3 | 1. Settings; 2. Appearance and motion; 3. Branding | 1 / 0 | **required** | `config:settings` |
| `users-and-permissions` | Users, offices and permissions | Officers and admin | 3 | 1. Users; 2. Offices; 3. Permission matrix | 0 / 0 | **required** | `access:users` |
| `import-export` | Importing and exporting data | Officers and admin | 2 | 1. Choose what to import or export; 2. Template, preview, commit | 1 / 0 | **required** | `core:import_export` |
| `backups` | Backups | Officers and admin | 2 | 1. Backups; 2. History and drills | 0 / 0 | **required** | `backups:index` |
| `access-and-grants` | Access, offices and grants | Officers and admin | 3 | 1. See my access; 2. Appoint through a rule; 3. Give a time-boxed grant; 4. Read the access log | 1 / 1 | public | `access:how` |
| `people-directories` | People directories and staff records | Officers and admin | 3 | 1. Open a directory; 2. Contacts are need-to-know; 3. Propose a change; 4. Import from Excel | 1 / 0 | public | `people:how` |

### Text guide registered by another app

| Slug | Title | Audience | Source | Sections |
|---|---|---|---|---|
| `ask-ee-hub` | Ask EE Hub and the AI helpers | Everyone (area "More help") | `assistant/guides.py:9` (blocks; appended to `ORDER`) | Intro (what Ask EE Hub reads); **Ask a question** (4 steps: press Ask, type, read and check sources, rate); tip "When AI is off"; important "No personal questions"; **AI suggestions for staff** (bullets: memos, summaries, complaint replies, report summaries); note "You stay in charge" |

### Handbooks

| Key | Title | Contains | Access |
|---|---|---|---|
| `students` | Student handbook to EE Hub | Everyone + Students guides, grouped by area | public |
| `staff` | Staff handbook to EE Hub | Everyone + Lecturers and staff + Officers and admin guides | sign-in |

---

## 3. Arcade guides (the games area)

### 3.1 Secret character guide — `/arcade/settings/secret-character/`

- **View**: `games/settings_views.py:231 guide` (`@manager_required`: super admin or `games.manage_game_settings`,
  else 404). Template `templates/games/settings_guide.html`; per-game body `templates/games/_settings_guide.html`.
  Also shown on each game's "Secret character" tab (`/arcade/settings/<slug>/?tab=hero`) and included in every
  cheat-code export (PDF, DOCX, XLSX sheet "Secret character", print page) through `_guide_lines()` (line 258).
- **Audience**: arcade managers (owner-private). Not linked from the help hub.
- **Where the words come from**: `_guide(game)` (`settings_views.py:206`) merges
  1. the `hero` block of `games/cheat_defaults/<slug>.json` (`name`, `full`, `combo`, `swipe`, `powers`, `shortcuts`,
     `where`), with defaults from `HERO_DEFAULT` (`games/cheats.py:20`) and `GUIDE_EXTRAS` (powers and test shortcuts
     for the open-world game, `games/cheats.py:26`);
  2. live settings: hero on/off, own code or site-wide code, access rule and named people, leaderboard rule, and (on
     a DEBUG copy only) the starter code;
  3. fixed sentences in the template (how to change the code, lock-out after 8 wrong tries for 10 minutes).
- **Outline**: "The short version" (1. reveal move on the title or character screen; 2. choose him and confirm;
  3. type the code, Enter; unlocked for that visit). Then one section per playable game: Reveal (keyboard or
  controller) · Reveal (phone) · Enter the code · Which code · Who may use him · Powers · Test-run shortcuts (if any)
  · Leaderboards · Changing the code · If the code is refused. If the hero is off for a game the section says so.

### 3.2 "How to use Arcade Management" help box

Inline `<details>` in `templates/games/settings_home.html` (6 points: Games page, All cheat codes, editing a code, who
may cheat, the secret character guide, giving someone access via Django admin → user permissions). Audience: arcade
managers.

### 3.3 In-game help (not a guide page, for reference)

Each game's Settings screen (`static/js/games/arcade-settings.js`, documented in `docs/ARCADE_SETTINGS.md`) has a
Sounds tab and controls help; codes are typed during play or in Settings → Code box. Player-facing words for these
live in the game scripts and `docs/ARCADE_SETTINGS.md`, `docs/SOUND.md`; there is no player help page for the arcade
in the guides hub.

---

## 4. "How it works" pages of other modules

Short explainer pages linked from each module (all need sign-in through the module's own gate; not part of the
guides registry):

| URL | URL name | Module |
|---|---|---|
| `/access/how/` | `access:how` | Access: the formula, who may hold an office, delegation, grants, classes and announcements, access log, switching modules off (`templates/access/r7/how.html`) |
| `/registration/how-it-works/` | `registration:how` | Course registration and form routing |
| `/timetable/how-it-works/` | `timetable:how` | Timetables |
| `/messages/how-it-works/` | `messaging:how` | Messages and chats |
| `/elections/how-it-works/` | `elections:how` | EESA elections |
| `/community/eesa/how-it-works/` | `association:how` | EESA executive team |
| `/lifecycle/alumni/how-it-works/` | `lifecycle:how_alumni` | Alumni sign-up |
| `/study/how-it-works/` | `knowledge:help` | Course study pages |
| `/directory/how-it-works/` | `people:how` | People directories |
| `/labs/how-it-works/` | `labs:howto` | Laboratories |

Several illustrated guides point at these as their workflow page (round-7 guides).

---

## 5. Guide-like documents in `docs/` (not served)

| File | What it is | Port? |
|---|---|---|
| `docs/MASTER_GAME_GUIDE.md` (996 lines) | Master prompt and engineering rulebook for the open-world game: phases, session protocol, architecture, §5 dynamic config and super-admin settings (§5.4 security options), §6 cutscenes, §7 dynamic credits (consent via `approved`), performance, animation, physics, audio, testing, scope, kickoff | Already superseded in MIB-Hub by `docs/plan/MASTER_GAME_GUIDE_V2.md` and `_V3.md`. Not a user guide. §5.4 and §7.3 are the spec behind A10–A12 in `MANAGEMENT.md` |
| `docs/ARCADE_SETTINGS.md` | Developer API for the shared in-game Settings screen (options registry, built-in options, saves, hold-or-toggle, phone controls, Sounds tab, priority of sounds) | Source for a player guide "Game settings and sounds" and a developer page |
| `docs/SOUND.md` | How arcade sound effects work, replacing a sound, what plays when | Source for the admin guide "Sounds for everyone" |
| `docs/ARCADE_CHEATS.md`, `docs/FSLG_CHEATS.md` | Owner-private lists of plain cheat codes and the hidden character's reveal moves | **Do not publish.** Feed the restricted admin-only secret-character guide from data, as the old site does |
| `docs/WALKTHROUGH_SUPERADMIN.md` | Portal walkthrough for the super admin (act as, courses, CBT, demo) | Department portal only |
| `docs/DEMO_CREDENTIALS.md`, `docs/demo_credentials.csv` | Demo account credentials | Never port |

---

## 6. Recommended structure for MIB-Hub user guides

### 6.1 Scope

MIB-Hub is the game's own site, not the department portal. Of the 62 help guides, only the account-level ones carry
over in spirit; the rest (registration, CBT, results, SIWES, projects, offices, timetables, elections) belong to the
department portal and are **out of scope** unless that portal is ported too.

| Old guide | MIB-Hub guide |
|---|---|
| `signing-in`, `keeping-your-account-safe` | Player: Create an account and sign in (Better Auth: e-mail/password, magic link or social if enabled; password reset; sessions) |
| `completing-your-profile` | Player: Your profile, display name and avatar |
| `notifications` | Player: Notifications (if MIB-Hub has them) |
| `install-the-app` | Player: Install the game and play offline (PWA, service worker caches) |
| `privacy-and-my-data` | Player: Privacy and your data (leaderboard name opt-out = old `ArcadeProfile.on_leaderboard`; data download) |
| `reporting-an-issue` | Player: Report a bug or give feedback |
| `users-and-permissions`, `access-and-grants` | Admin: Users, roles and the permission matrix |
| `settings-and-appearance` | Admin: Site settings |
| Arcade secret-character guide | Admin (restricted): Secret character, per game, generated from data |
| Arcade Management help box | Admin: Arcade Management overview |

New guides with no old equivalent (write from `MANAGEMENT.md` and the docs above): Player — Playing your first game;
Controls and game settings; Sounds (switch off, replace your own); Leaderboards and fair play (cheat results are
tagged or kept off); Credits. Admin — Per-game settings and rules; Cheat codes and exports (owner); Sounds for
everyone; Game name and branding (config + tokens); Characters editor; Credits and consent; Change log and rollback.

### 6.2 Content model

Keep the old split of **words as data** and **pictures re-shot by a tool**, but as files Astro understands:

```
apps/web/src/content/guides/<audience>/<slug>.mdx      (one guide per file)
apps/web/src/content/config.ts                          (zod schema for the collection)
apps/web/public/img/guides/<slug>/NN.webp, NN-phone.webp
apps/web/public/img/guides/manifest.json                (sizes, written by the shooter)
scripts/guides/shoot.ts                                 (offscreen WebKit pipeline, not Playwright, on macOS 12)
```

Frontmatter (mirrors `_dsl.guide()`):

```yaml
slug: playing-your-first-game
title: Playing your first game
summary: One sentence for the card and the meta description.
audience: player            # player | editor | admin | everyone
area: getting-started       # fixed list, ordered (see 6.3)
icon: gamepad-2
minutes: 3
access: public              # public | signed-in | permission:arcade.manage | superadmin
page: /play                 # "Go to the page" target
related: [controls-and-settings, leaderboards]
keywords: start play first game controls
who: New players.
before: [An account (or play as a guest).]
tips: [{title: ..., text: ...}]
problems: [{q: ..., a: ...}]
```

Body: `<Step n={1} title="…" shot={{url: "/play", ring: "#start", crop: "auto", phone: true}}>text</Step>`
components, so the shooter reads the same file the page renders. Use `{{GAME_NAME}}`-style tokens resolved from the
live config (the old FSLG config rule), never the literal name.

### 6.3 Pages and routes

| Route | Content |
|---|---|
| `/help` | Hub: search (client-side over title, summary, keywords), audience chips with "For you" from the user's role, "Start here" picks per role, sections by area, "Still stuck?" link |
| `/help/[slug]` | Guide page: breadcrumb, meta, who/before, steps with desktop + phone pictures and lightbox, tips, problems, related, previous/next within the audience, sticky step list, PDF/print |
| `/help/[slug].pdf` or print CSS | One-guide PDF (or `@media print` page, simpler on Cloudflare) |
| `/help/handbook/[player\|admin]` | Combined handbook (print page or PDF) |
| `/admin/help` | Admin-only guides (restricted access values), linked from the admin sidebar |

Areas (hub order): Getting started · Playing · Settings and sound · Leaderboards and fair play · Your account and
privacy · Admin: arcade · Admin: game content · Admin: users and roles.

Access: enforce `access` on the server (Astro middleware with Better Auth session and role/permission check); hide
restricted guides from the hub for users who cannot open them, and return 404 for direct hits, as the old arcade
pages did. The secret-character guide must be rendered from server data (the cheat-default files and live
settings), never shipped as a static public page.

### 6.4 Carry-over checklist

1. Port the DSL fields one-to-one (the schema in 6.2) so old guides can be converted by a script if the portal is
   ever ported.
2. Keep "who this is for", "before you start", numbered steps with pictures, tips, common problems and related
   guides: the format worked and tests can check every guide has them.
3. Pictures: re-shoot against seeded demo data with the WebKit pipeline; no real people in screenshots.
4. A small dashboard/home widget "Help for you" with 4 picks per role (old `content/widgets.py` `PICKS`).
5. A `guide_link` component for workflow pages ("Full guide with pictures → · PDF").
6. Index the guide text for any assistant/search the same way the old `blocks` fed `assistant/retrieval.py`.
