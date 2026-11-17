# منصة الأستاذ — TeacherHub

Full-stack teacher workspace: **Django 5 + DRF** API, **React 18 + Vite + Bootstrap 5 (RTL)** UI,
SQLite persistence. Built around a **theme library**: curated + auto-generated visual
identities you can apply to your **daily journal, lesson plans, note books**, and more.

## Quick start (local)

```bash
# 1) backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py generate_themes     # 12 curated + 48 auto-generated themes
python manage.py seed_demo           # realistic demo content
python manage.py runserver           # http://127.0.0.1:8000

# 2) frontend (new terminal)
cd frontend
npm install
npm run dev                          # http://127.0.0.1:5173  (proxies /api → :8000)
```

Or simply: `bash run.sh` from the project root.

**No sign-in:** the app runs in local single-user mode — it opens straight into the
workspace (seeded with 3 journals, 9 real informatics lesson plans, 2 note books
with entries, 60+ themes). All data belongs to one local teacher profile.

## Features

- **Local single-user mode** — authentication removed entirely; open and use.
- **Dashboard** — stat cards, recent journals & lesson plans, latest note entries, spotlight theme.
- **Theme library** — search + style/source filters, palette swatches, usage counters,
  *“✨ توليد سمات جديدة آليًا”* button (same generator as the CLI script), theme preview
  on a sample lesson plan, and **apply-to…** flow targeting any journal/plan/notebook.
- **Full CRUD** — journals, lesson plans (with 5-phase structure), note books and their
  entries, all with Bootstrap modals, confirm dialogs, **optimistic updates with rollback**,
  skeleton loading states, empty states and toasts.
- **Live document preview** (`/preview/:type/:id`) — the document re-renders instantly in
  any selected theme (CSS variables), then one click applies it persistently.
- **Responsive** — off-canvas sidebar on mobile, RTL Arabic UI throughout.

## Teaching Studio (dynamic alignment)

The home page is a **Teaching Studio** built around one loop: *teach → log → everything aligns*.

- **سجلّ الحصص (Sessions)** — log each taught session by class, date/time and curriculum
  lesson. The form pre-suggests the class's next untaught lesson and pre-checks its key
  points (النقاط التي كتبها التلاميذ); on save, the matching lesson plan and the current
  journal are attached automatically, and a toast shows the class's new progress + next lesson.
- **الأقسام والتقدّم (Classes)** — per-class weekly timetable slots plus a live
  curriculum×class matrix (✓ taught • ⏭ next suggested), progress bars and last session.
- **المقرر الدراسي (Courses)** — the ordered curriculum; each lesson carries its key
  points, an optional content theme, and shows exactly which classes have covered it,
  for whom it is next, and a link to its lesson plan (or one-click plan creation).
- **Dynamic links everywhere** — lesson plans link to a curriculum course (they
  auto-attach to its sessions), notebook entries can be attached to a class / course /
  taught session and filtered by class, and journal previews list the sessions the
  journal has absorbed with their covered points.
- **Insights** — `/api/studio/alignment/` flags progress gaps between classes,
  curriculum lessons still missing a plan, and your last-7-days teaching pace;
  `/api/studio/today/` powers today's schedule + per-class next-lesson cards.

## Languages (العربية / English / Français)

The whole interface is trilingual. Use the **العربية | English | Français**
switch at the bottom of the sidebar; the choice is remembered
(`localStorage`) and flips the layout direction (RTL for Arabic, LTR for
English/French). The default UI language is **English**. Only interface
chrome is translated — your lesson titles, student names, key points and
other content stay exactly as you wrote them (Arabic included), and the
printed PDF documents remain Arabic, as official school documents should.

## Filters, sorting & print control

Every list in the platform has a persistent filter/sort bar (choices are kept in
`localStorage`), and **what you see is what you print** — the same filters drive
the PDF exports:

- **Sessions** — filter by class, status, lesson and date range; sort by date,
  start time, absentees or duration; the PDF log and a CSV export follow suit.
- **Students / grade book** — search, sort by term or annual average, "needs
  support (<10)" and "ungraded only" switches, a mark-distribution chart
  (0–5 / 5–10 / 10–15 / 15–20), CSV export, and grade-book printing for a single
  term ranked by name or average.
- **Classes, courses, journals, plans, notebooks, themes, calendar,
  inspection** — per-page filters (progress, domain, taught/planned status,
  theme, tag, kind, upcoming-only, minimum observation score…) with matching
  sort orders. Notebook entries filter by tag / class / lesson / date range and
  print exactly that selection.
- **Print center settings** — page orientation (portrait/landscape), print date
  range and order, grade-book term + student ranking, and notebook
  tag/class/lesson filters apply to every export where they make sense
  (export endpoints accept `orientation`, `from`, `to`, `order`, `term`,
  `sort`, `tag`, `class`, `course`, `status` query parameters).
- **Global search** — the top-bar search (or `Ctrl+K`) queries classes, lessons,
  students, plans, journals, notebooks (including entry text), institutions
  and sessions at once via `GET /api/search/?q=…`.

## Annual Year Review & Final Synthesis Centre

- A dedicated centre (`/year-review`, الحصيلة السنوية) synthesises the whole school year for every class in one place.
- Per class it shows the three term results side by side (average, success rate, graded students), the overall annual average, and the year's trajectory (first-to-last term change).
- Student honours are computed across the year: top students by annual average, the most improved students (term trend), and suggested summer-support cases (low annual average or high risk) — every name opens the student's 360° dossier.
- Year activity is totalled per class: taught sessions, curriculum completion, assignment completion, annual attendance, support plans, parent communications, documented meetings and completed action tasks, with auto-written year highlights and next-year recommendations.
- One click generates the **annual review report** (تقرير الحصيلة السنوية) for a single class or all classes in one document (`source_type="year-review"`), ready to print or archive before the school-year rollover.
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`YearReviewTests`); no database migration is required.

## Class Council & Meetings Centre

- A dedicated centre (`/meetings`, مجالس الأقسام والاجتماعات) prepares, documents and follows up class councils and other school meetings (coordination, parents, administration).
- The **council preparation panel** builds a brief straight from class analytics for any class and term: term average, success rate, attendance, assignment completion, class health and curriculum progress, plus a suggested agenda and suggested decisions naming the students whose cases should be discussed.
- One click creates the council meeting pre-filled with those suggestions; meetings are fully editable records (type, class, term, date, attendees, agenda, notes) with a structured **decision list** (text, responsible person, due date, done state) whose completion can be tracked inline.
- Decisions can be **pushed to the Action Centre** as tracked tasks (idempotently — each decision is pushed once and badged in the meeting), closing the loop between council decisions and daily follow-up.
- Any meeting generates a printable **minutes document** (محضر اجتماع, `meeting-minutes` kind, `source_type="meeting"`) that stays linked to the meeting and editable in the Creator Studio.
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`MeetingTests`), with migration `0012_meetings`.

## Gradebook Entry & Marks Import Centre

- A dedicated centre (`/gradebook`, إدخال النقاط) replaces one-by-one mark entry with a single fast grid per class and term: continuous assessment, supervised tests and exam columns for the whole roster at once.
- Term averages are computed live as you type — (continuous + supervised + exam × 2) ÷ 4 — with per-student status (complete / incomplete / empty), and class statistics (graded count, class average, highest, lowest, success rate) update on every save.
- One save upserts the whole grid safely: values are clamped to /20, incomplete rows keep their partial marks, and clearing all three fields removes a student's mark record.
- **CSV export** downloads the class gradebook (student ID, name, the three components and the computed average, Excel-friendly); **CSV import** accepts files by student ID or exact name, reports unmatched names, and works with both comma and semicolon files — ideal for marks collected in a spreadsheet.
- Student names open their 360° dossiers; the interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`GradebookTests`); no database migration is required.

## Weekly Work Planner

- A dedicated centre (`/planner`, التخطيط الأسبوعي) shows the whole teaching week (Sunday–Saturday) at a glance: every timetable slot with its class, time and room, joined with the sessions already logged that day.
- Each unlogged slot suggests the class's **next curriculum lesson**, and one click logs the session as taught — which instantly advances the class's curriculum progress, annual distribution and journal records everywhere else.
- Past slots without a logged session are flagged "awaiting logging", holidays recorded in the calendar appear on their days, and week navigation (previous / this week / next, or any date) makes planning ahead effortless.
- A printable **weekly plan document** (مخطط العمل الأسبوعي) can be generated for any week as an editable document with the week's programme and a session-completion checklist (`source_type="weekly-planner"`).
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`PlannerTests`); no database migration is required.

## Bulk Parent Communication Centre

- A dedicated centre (`/campaigns`, تواصل الأولياء الجماعي) turns follow-up indicators into print-ready parent letters in minutes, instead of writing the same letter dozens of times.
- Six ready-made audiences are computed live from class analytics: frequent absentees (configurable threshold), students with missing assignment submissions, term averages below 10, honour students (congratulation letters), students with open support plans, or the whole class.
- The preview lists every recipient with the indicator behind their selection (absence counts, missing work, averages, risk) and their last logged parent communication; recipients can be individually included or excluded.
- The letter subject and body are editable per campaign, with automatic per-student placeholders (`{name}`, `{class}`, `{average}`, `{absences}`, `{missing}`, `{attendance}`, `{plans}`, `{term}`).
- Generation produces **one printable letter pack** — a personalised letter per parent separated by page breaks (`source_type="parent-campaign"`) — and can log each letter into every student's parent-communication record automatically.
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`ParentCampaignTests`); no database migration is required.

## Annual Curriculum Distribution & Progression Centre

- A dedicated centre (`/progression`, التوزيع السنوي) answers two questions for every class: where exactly are we in the curriculum, and when will we finish?
- The annual distribution is computed from the real school calendar: the academic year runs September–June, each class advances on its own weekly timetable days, and recorded holidays/occasions are excluded from projections.
- Every lesson is listed in curriculum order with its domain/unit, status (completed / current / upcoming), actual teaching date or projected date, the term it falls in, and whether a lesson plan exists for it.
- A pace indicator compares curriculum completion against the share of teaching days already elapsed (ahead / on pace / behind), warns when the projected finish passes the end of the school year, and recommends concrete fixes (catch-up sessions, missing lesson plans).
- One click generates the official-style **annual distribution document** (التوزيع السنوي للمنهاج) as an editable, printable landscape document per class (`source_type="curriculum-progression"`), which updates automatically as new sessions are logged.
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`ProgressionTests`, including holiday-aware projection); no database migration is required.

## Backup, Archive & School-Year Rollover Centre

- A dedicated centre (`/backup`, النسخ الاحتياطي والأرشفة) protects a full year of work on this local, single-user installation: platform contents and record counts per model, database size, and a **data-integrity checklist** (taught sessions without a linked lesson or plan, students without marks, classes without a weekly timetable, empty documents, assignments without submissions, overdue action tasks).
- **Full backup export** downloads one JSON file (`teacherhub-backup` format) containing every user record — classes, students, marks, sessions, documents and revisions, question bank, attendance, support, assignments, tasks, calendar and inspection data — ordered so it can be restored safely.
- **Backup import** restores a backup file into the same installation with its original record IDs (existing records with the same ID are updated); the UI asks for explicit confirmation and reports how many records were imported per model.
- **School-year rollover** copies selected classes into the new year in one click: new class names carry the year label, weekly timetable slots and student rosters are copied, and marks/records start clean — the old classes remain untouched as an archive. Already-created year classes are skipped.
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`BackupTests`, including an export→delete→import roundtrip); no database migration is required.

## Inspection Readiness & Professional Portfolio Centre

- A dedicated centre (`/portfolio`, ملف التفتيش والجاهزية) measures how ready the teacher's professional file is for an inspection or follow-up visit with a transparent score: professional-card completeness (15%), lesson-plan coverage of taught lessons (25%), session-log documentation (20%), gradebook coverage (20%), attendance documentation (10%) and documented training (10%).
- A nine-item checklist covers the professional card, up-to-date journals, lesson plans for taught lessons, the documented session log, the gradebook, student attendance records, continuing training, recorded inspection visits and the document library — each item links to the page where it can be completed.
- The centre summarises every class (curriculum progress, sessions taught, term average, success, attendance, health index), the latest taught sessions with their lesson-plan status, seminars and training, inspection visits with their recommendations, and the document library by type.
- One click generates a print-ready **inspection portfolio** (ملف التفتيش والجاهزية المهنية) as an editable document: cover page, professional card, general indicators, class/term tables, session log, training record, visit history, documented strengths and improvement points, with signature rows for the teacher, the subject inspector and the administration.
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`PortfolioTests`); no database migration is required.

## Term Reports & Closing Centre

- A dedicated centre (`/reports`, تقارير الثلاثي) shows, for every class and term, a transparent **readiness score** for closing the term: term-marks completeness (40%), attendance-record coverage (20%), assignment submission (25%) and a clear action centre (15%).
- A pre-closing checklist verifies complete term marks (naming students still missing an average), documented attendance, closed assignments, up-to-date support plans, open action-centre tasks, curriculum progress and generated reports — each item links to the page where it can be fixed.
- Students are ranked by term average with annual average, attendance, assignment completion and risk shown side by side, and each name opens the student's 360° dossier.
- One click generates the full **term pack** as editable documents: an individual report (كشف متابعة) per student, merit certificates (by minimum average or top-N), the class council report and the parent bulletin. Generation is idempotent — documents already generated for that term are skipped and reported.
- Generated documents live in the Creator Studio library (`source_type="term-pack"` / `"class-analytics"`) and export to themed PDF/DOCX like any other document.
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`TermPackTests`); no database migration is required.

## Teacher Action Centre & Smart Reminders

- A dedicated centre (`/actions`, مركز الإجراءات) turns overdue work, support deadlines, parent follow-ups, attendance gaps and planning alerts into one prioritised, trackable task list.
- Tasks (`TeacherTask`) have categories (support, assignment, parent, attendance, lesson, calendar, inspection, document, general), priorities (low/medium/high), statuses (pending, in progress, done, cancelled), optional student/class links, due dates and a manual or automatic origin.
- **Smart suggestions** are generated from open support plans, parent-communication follow-up dates, assignments with missing submissions, high-risk students without an open plan, recent completed sessions lacking attendance records, upcoming lessons without a lesson plan, and upcoming holidays, seminars and visits. Suggestions explain their reason, and accepting one is idempotent — the same source never creates duplicate open tasks; `generate-suggestions` bulk-accepts all new suggestions.
- The task list supports filtering by status, category, priority, student, class, free-text search and due bucket (overdue / today / this week / no date), groups tasks by urgency, and offers complete/reopen actions plus summary statistics (open, overdue, due today, this week, high priority, completion rate).
- Teachers can generate an editable **teacher action plan** tracker document (خطة عمل الأستاذ) from their open tasks and continue editing or printing it in the Creator Studio.
- Dashboard counters (`teacher_tasks`, `open_tasks`, `overdue_tasks`) and global search include tasks, and each task links back to its source page (student dossier, support, assignments, analytics, follow-up, courses, calendar or inspection).
- The interface is fully translated (العربية / English / Français); backend coverage lives in `backend/hub/tests.py` (`TeacherTaskTests`), with migration `0011_teacher_tasks`.

## Class Analytics & Term Review Centre

- A dedicated centre (`/analytics`, تحليلات الفوج والثلاثي) reviews each class by term and optional date period across marks, attendance, daily follow-up, assignments, support and curriculum progress.
- A transparent **class health index** combines term success, attendance, assignment completion and inverse average student risk, with the component values shown to the teacher.
- Mark analysis covers continuous assessment, supervised tests and exam component averages, term/annual averages, success rates and mark distribution bands.
- Student insight lists identify top performers, most improved students, immediate follow-up cases, attendance concerns and assignments with low completion; student names open their 360° dossiers.
- A comparison table ranks all classes by term average, success, attendance, assignment completion, average risk, health and curriculum progress.
- Teachers can generate an editable class council/term report with internal student follow-up tables, or a privacy-conscious parent bulletin that shares only aggregate class indicators and home-support guidance.
- Backend coverage lives in `backend/hub/tests.py`; no additional database migration is required.

## Student 360° Dossier & Individual Reports

- Every student now has a complete individual dossier at `/students/{id}` (ملف التلميذ), reachable from the grade book, risk overview, missing-assignment lists and global search.
- The dossier combines term and annual averages with average trend, actual attendance, homework/behaviour/participation follow-up, all class assignments and submission states, support plans, parent communications and generated individual documents.
- A unified timeline merges attendance, follow-up observations, assignments, support plans and parent communications in chronological order.
- The existing transparent risk engine is shown per student with reasons, detected strengths and concrete recommended next actions; dossiers can be filtered by date period.
- Teachers can generate an editable comprehensive individual report or a parent summary letter from live dossier data. Parent summaries can automatically log a parent-communication record.
- Backend coverage for aggregation and document generation lives in `backend/hub/tests.py`.

## Assignments & Homework Centre

- A dedicated centre (`/assignments`, المهام والواجبات) manages homework, class activities, projects, research, revision and practical exercises for every class, optionally linked to a curriculum lesson.
- Each assignment carries assigned/due dates, instructions, success criteria, maximum score, estimated duration, late-submission policy and draft/active/closed/archived status.
- A per-student tracking grid records submitted, late, reviewed, excused or missing work with score, submission date and teacher feedback; quick-mark controls and live completion statistics are built in.
- Overview analytics show active, overdue and due-soon assignments, class completion rates, average score percentages, upcoming deadlines and students with missing work.
- Teachers can generate editable assignment worksheets (using linked lesson key points when available), submission reports and late/missing follow-up lists through Creator Studio.
- Missing work can create idempotent homework support plans in the Support Centre, and overdue missing/late assignments now feed the student risk engine. Assignments are included in global search and dashboard counts, with backend coverage in `backend/hub/tests.py`.

## Support, Intervention & Parent Communication Centre

- A dedicated centre (`/support`, الدعم وتواصل الأولياء) combines term/annual averages, actual attendance and homework/behaviour/participation follow-up into a transparent **student risk score** with human-readable Arabic reasons.
- Risk alerts become trackable **support plans** with category, priority, status, start/due dates, reason, teacher notes, outcome and a checklist of support actions with progress percentage.
- Each plan can generate an editable support-plan document or a formal **parent letter**; generating a letter can also create a parent-communication log automatically.
- A separate communication register records letters, calls, meetings and messages with subject, summary, agreement/outcome and later follow-up date.
- Support plans and communications are included in global search and dashboard counts, and covered by backend tests.

## Attendance & Student Follow-up Centre — actual classroom records

- A dedicated centre (`/follow-up`, الحضور ومتابعة التلاميذ) records **actual daily attendance** per student: present, absent, late, excused absence or left early, with notes and quick-mark controls for the whole class.
- Teachers also record dated **homework, behaviour, participation and support** observations out of 5, optionally linked to a syllabus lesson.
- Period summaries flag students who need attention (3+ absences, attendance below 80%, or a follow-up average below 2.5/5).
- Saved data can be turned into editable documents through Creator Studio: an actual monthly **attendance register** with daily symbols and risk table, and a **student follow-up report** with category averages and recent observations. Both export through the themed PDF/DOCX pipeline.
- The data is searchable through existing student records, included in dashboard counts, and covered by backend tests in `backend/hub/tests.py`.

## Question Bank — reusable assessment questions

- A dedicated **Question Bank** (`/question-bank`, بَنْك الأسئلة) stores reusable questions with prompt, type, difficulty, points, answer, explanation, answer lines, options, tags and an optional linked syllabus lesson.
- Seed starter questions from every syllabus lesson's key points (idempotently), import all question blocks from an existing editable exam/worksheet, or save individual questions to the bank while editing a document.
- Build an exam or worksheet from filters (lesson/type/difficulty/tags), a target number of questions or target total points, random/sequential/difficulty/points ordering, automatic difficulty balancing and an optional answer key — or select exact questions manually and generate from the selection only.
- Generated documents open directly in the visual editor and export through the existing themed PDF/DOCX pipeline. The bank is included in global search and dashboard counts, with backend coverage in `backend/hub/tests.py`.

## Creator Studio phase 4 — portable document library

- **Import real files into the visual editor**: drag-and-drop or choose **PDF, DOCX, TXT, Markdown, CSV or TeacherHub JSON** in Creator Studio. Text, headings and tables are converted into editable blocks; scanned/image-only PDFs report that OCR is required instead of silently producing an empty document.
- **Portable JSON backups**: every editable document can be downloaded as a `*.teacherhub.json` file from the library or the editor, then imported again as a new document with its blocks, kind, theme reference and tags preserved.
- **Document organisation**: tags, favourites and archive states are available in both the library and editor. Library filters cover active/favourite/archived/all scopes and tag text.
- **Bulk operations**: select documents to favourite, archive/unarchive, duplicate or delete them together, or download a ZIP archive containing PDF, DOCX or JSON versions (up to 30 documents per export).
- **Direction-correct interface builds**: the app now loads Bootstrap RTL for Arabic and Bootstrap LTR for English/French; switching across the RTL/LTR boundary reloads once so layout utilities and the sidebar behave correctly in all three languages.
- New backend coverage lives in `backend/hub/tests.py` (JSON round-trip, Markdown/DOCX/PDF imports, invalid-block rejection, bulk actions and ZIP export).

## Creator Studio phase 3 — smart data generators, versions & editor workflow

- **Smart generators from live platform data** in Creator Studio: generate editable class **report cards** from actual marks, **honour certificates** by threshold/top-N average, landscape **attendance registers**, weekly **homework/behaviour trackers**, **student ID cards**, smart **seating plans** (alphabetical/random/performance), and **tests/worksheets generated from any syllabus lesson's summary, objectives and key points**.
- **Document version history**: every meaningful save keeps the previous version; manual snapshots can be created in the editor and any version can be restored safely (restoring also snapshots the current state first).
- **Refresh from live source**: editable copies created from journals/plans/gradebooks/etc. can rebuild their blocks from the newest platform data in one click, after saving a safety version.
- **Editor workflow upgrades**: autosave, undo/redo (Ctrl+Z / Ctrl+Y), drag-and-drop block reordering, collapse blocks, insert below, hide/show blocks in print, preview zoom, and a live last-saved indicator.
- A new **`Certifications et modèles`/`idcards` block type** plus three new document kinds (attendance sheet, tracker sheet, student ID cards) render identically in the live preview, PDF and DOCX exports; hidden blocks are excluded from exports.

## Creator Studio — editable documents & toolbox (`/creator`, `/editor/:id`)

Every document can now become a **visually editable copy**: pick any existing
document (teacher/inspector journal, lesson plan, notebook, grade book, class
report, course handout, session log, timetable, observation grid) in the
Creator Studio, from a document preview, or from the Print Center, and it is
snapshotted into editable content blocks — cover, headings, texts, info
fields, tables, checklists, questions, flashcards, certificates, seating
grids, name labels, posters, signatures and page breaks. Reorder blocks with
the arrows, edit them with a live print preview, choose any of the platform
themes and page orientation, save with Ctrl+S, then export the same document
as a print-ready **PDF** or an editable **DOCX** (Word). The original live
document is never changed by editing a copy.

The Studio also adds a toolbox of document makers that did not exist before:

- **Assessment pack** — exam/test builder (with optional answer key),
  worksheet builder, rubric maker, flashcards.
- **Classroom pack** — batch certificates, seating charts (auto-filled from
  any class roster), student name tags, classroom posters.
- **Admin & communication pack** — parent letters/notices, meeting minutes,
  student report cards, permission slips, activity invitations.

Smart helpers inside the editor fill certificate/label/seating name lists
from a class roster and generate worksheet/exam questions from a course's
recorded key points. API: `GET/POST /api/documents/`,
`POST /api/documents/from-existing/`, `POST /api/documents/{id}/duplicate/`,
`GET /api/exports/custom/{id}/` (PDF) and `GET /api/exports/custom/{id}/docx/`.

## Full document suite (everything printable)

The studio now contains every document family produced for this project, as live
data — not static files:

- **التلاميذ والنقاط (grade book)** — rosters per class (single or bulk paste),
  per-term marks (التقويم المستمر / الفروض المحروسة / الاختبار) with the official
  formula `(continuous + supervised + exam×2) / 4`, annual averages, and per-term
  class statistics (average, highest/lowest, success rate).
- **العطل والندوات** — school holidays & occasions and seminars/training days,
  printed inside both journals automatically.
- **التفتيش والمتابعة** — inspection-district institutions, visit log, and lesson
  observation grids (شبكة ملاحظة الحصة) with criteria scoring and auto percent.
- **البطاقة المهنية** — the personal & professional ID card that heads every
  printed journal/report (name, diploma, hire date, school, district…).

## PDF print center (`/print`)

Ten print-ready A4 Arabic PDF exports (WeasyPrint, themed, page-numbered):
full **teacher journal**, full **inspector journal**, **grade book** per class,
**class progress report**, **lesson plan**, **course handout**, **session log**,
**notebook**, **observation grid**, and the **weekly timetable**. Any export can
override its theme; download buttons also live on preview, class, session,
student and inspection pages. Endpoints: `GET /api/exports/<kind>/…`.

## Theme engine

`backend/hub/theme_gen.py` holds 12 curated identities (البدلة الكحلية، مونوكروم، ذهب الأندلس…)
and a deterministic generator mixing 12 deep hues × 8 accents × 5 Arabic display fonts.

```bash
python manage.py generate_themes --extra 24   # grow the library any time
```

Applied themes are stored as a FK on each resource, so your print pipelines (Word/PDF)
can read the same palette + heading font from `/api/themes/`.

## API sketch

| Endpoint | Purpose |
|---|---|
| `GET /api/auth/me/` | local teacher profile (display only) |
| `GET /api/themes/?q=&style=&source=` | library w/ filters |
| `POST /api/themes/{id}/apply/` `{resource_type, resource_id}` | apply a theme |
| `POST /api/themes/generate/` `{count}` | generate more themes |
| `GET/POST/PATCH/DELETE /api/journals/` `lesson-plans/` `notebooks/` | CRUD |
| `GET/POST /api/notebooks/{id}/entries/`, `PATCH/DELETE /api/note-entries/{id}/` | entries (optionally linked to class/course/session) |
| `GET/POST/PATCH/DELETE /api/classes/` `timetable/` `courses/` `sessions/` | studio CRUD (`sessions/?class=&course=&from=&to=`) |
| `GET/PUT /api/profile/`, `/api/students/` (+`bulk/`), `/api/marks/upsert/`, `/api/classes/{id}/stats/` | profile, rosters, marks, class statistics |
| `GET/POST/PATCH/DELETE /api/holidays/` `seminars/` `institutions/` `visits/` `observations/` | calendar & inspection CRUD |
| `GET /api/exports/journal/{id}/` `inspector/` `gradebook/{id}/` `lesson-plan/{id}/` `course/{id}/` `class-report/{id}/` `sessions/` `timetable/` `notebook/{id}/` `observation/{id}/` | themed A4 PDF downloads (`?theme=` override) |
| `GET /api/studio/today/` | today's slots, logged sessions, next-lesson suggestions |
| `GET /api/studio/alignment/` | curriculum×classes matrix + insights |
| `GET /api/dashboard/` | counts + recents + spotlight |

## Layout

```
backend/   Django project (config/) + hub app (models, theme_gen, seed/generate commands)
frontend/  Vite React app (pages, components, hooks) — Arabic RTL Bootstrap
run.sh     launches both servers
```

## Theme Studio & Journal Page Designer (Phase 21)

The themes page is now a full **Theme Studio** (`/themes`, sidebar "استوديو السمات") and every printed journal has a **page composer**:

- **12 new curated themes** (74 total) via `seed_more_themes` — including patterned designs (Royal Oud, Peacock Teal, Sahara Sand with the newly-registered **Lalezar** font, Crimson Sovereign…).
- **Custom themes**: create your own theme, or duplicate any theme and edit the copy — 9 palette colours with colour pickers, heading/body fonts, 5 background patterns (dots, grid, diagonal, waves, diamonds) rendered subtly on PDF pages, and 3 cover styles (classic framed, bold coloured, minimal). Live mini-preview while you edit. Custom themes can be applied to journals, lesson plans and publications like any other theme; curated/generated themes are protected from editing/deletion.
- **Journal page composer**: every daily journal has a "تخصيص الصفحات" button — enable/disable and reorder 9 sections (cover, personal/professional card — your page 2 — holidays, seminars, weekly schedule, sessions log, **classes & curriculum progress**, **term results summary**, notes) and set the notes page line count (0–40). The composer is honoured by the journal PDF export; with no config the historical layout is kept.
- **Inspector page composer**: the same control for the inspector's journal (10 sections), stored on the teacher profile.

Endpoints: writable `/api/themes/` (custom-only edit/delete + `duplicate`), `GET /api/design/sections/`, `Journal.page_config`, `TeacherProfile.inspector_page_config` (migration 0013). Covered by `DesignerTests` (custom-theme lifecycle, journal composer, inspector composer).

## Revision & Exam Season Centre (Phase 22)

`/exam-season` (sidebar "موسم الامتحانات والمراجعة") prepares every class for term exams:

- **Exam readiness score per class/term** (0–100 with label) from four parts: marks completeness (continuous + supervised entered), question-bank coverage of the term's taught lessons, share of students clear of the watch list, and attendance rate.
- **Lesson revision priorities**: every lesson taught that term (from the sessions log), ranked by a priority score combining how long ago it was taught and whether the question bank has questions for it — lessons with no bank questions are flagged.
- **Watch list**: students with an incomplete term mark, an average below 10, 3+ absences, or a support-risk score ≥ 50, each with Arabic reasons.
- **One-click documents**: a printable **revision pack** (`revision-pack` kind: readiness indicators, priority-ordered revision plan, watch list, exam-week checklist) and a **mock exam** generated from the question bank (round-robin across the term's lessons and difficulties, optional answer key, 400 with guidance when the bank is empty for the term).

Endpoints: `GET /api/exam-season/?term=`, `GET /api/exam-season/class/{id}/?term=`, `POST /api/exam-season/generate-pack/`, `POST /api/exam-season/generate-mock-exam/`. Covered by `ExamSeasonTests` (readiness maths, priorities, watch list, pack + mock-exam generation, empty-bank guard). Migration 0014 adds the `revision-pack` document kind.

> Note: while wiring this phase, the Phase 12–20 `<Route>` elements were found missing from `frontend/src/main.jsx` (imports and sidebar links existed, and SPA fallback masked it with HTTP 200s). All routes (`/actions`, `/reports`, `/portfolio`, `/backup`, `/progression`, `/campaigns`, `/planner`, `/gradebook`, `/meetings`, `/year-review`, `/exam-season`) are now restored inside the Layout route and verified in the production bundle.

## End-of-Term Ceremony & Certificates Centre (Phase 23)

`/ceremony` (sidebar "حفل التكريم والشهادات") turns term results into a celebration:

- **Official appreciation tiers** per class/term from complete term averages: امتياز (≥16), تهنئة (≥14), تشجيع (≥12), لوحة الشرف (≥10), with per-tier counts on every class card.
- **Podium & full ranking**: top-3 medal cards plus the complete ranked table with tier badges and per-student improvement vs the previous term.
- **Improvement champions** (from term 2, ranked by average gain) and **regular-attendance awards** (≥95% across ≥5 attendance records that term).
- **One-click generation**: tier-grouped printable **certificates** (one landscape certificate per honouree, tier-specific wording; or top-N mode) and a **honour-board poster** document with tier tables, full ranking, improvement champions and a ceremony checklist.

Endpoints: `GET /api/ceremony/?term=`, `GET /api/ceremony/class/{id}/?term=`, `POST /api/ceremony/generate-certificates/`, `POST /api/ceremony/generate-honour-board/`. Covered by `CeremonyTests` (tier maths, term-2 improvement, attendance awards, both generators). No migration needed (existing `certificate`/`poster` kinds).

## Parent Meeting Day Centre (Phase 24)

`/parent-meetings` (sidebar "يوم لقاء الأولياء") organises a full parents' reception day:

- **Meeting days** per class (date, start time, slot length, location) stored in new `ParentMeetingDay` / `ParentAppointment` models (migration 0015).
- **Automatic priority scheduling**: pick an audience — students in need first (incomplete marks, average <10, repeated absences, support risk), borderline 10–12, honours ≥14, or the whole class — and appointments are sequenced into timed slots with Arabic discussion topics per student. Rebuilding is blocked once any appointment is completed.
- **Day tracking**: mark each parent attended / no-show / cancelled and record the meeting outcome; attended outcomes are automatically logged as `ParentCommunication` records (channel "meeting", idempotent).
- **Printable documents**: per-parent **invitation slips** (student, time, place, topics) and a **day agenda** with the full timed schedule and preparation checklist.

Endpoints: router `/api/parent-meeting-days/` with `build-schedule`, `appointments/{id}/status`, `generate-invitations`, `generate-agenda` actions. Covered by `ParentMeetingTests` (audiences & slot maths, outcome→communication logging + rebuild guard, both documents).

## Smart Assistant — Weekly Digest (Phase 25)

`/assistant` (sidebar "المساعد الذكي", top of the overview group) is one digest of everything needing attention:

- **Aggregates the existing suggestion engine** (support plans, parent follow-ups, assignments, at-risk students, undocumented attendance, next-lesson plans, calendar events) with **new cross-centre signals**: low exam-readiness classes, lessons without question-bank questions, incomplete term marks per class, classes ready for ceremony certificates, meeting decisions near/past due, parent meeting days this week, and overdue tasks.
- Every signal carries a severity, due date, human-readable reason, and a **deep link to the centre that fixes it**.
- **One-click conversion to Action Centre tasks** (single or "add all new"), idempotent against open tasks; items can be dismissed (persisted locally), and the top-5 "focus" list leads the page.

Endpoints: `GET /api/assistant/digest/`, `POST /api/assistant/digest/create-tasks/`. Covered by `AssistantDigestTests` (cross-centre collection, idempotent task creation).

## School Year Opening Wizard (Phase 26)

`/opening` (sidebar "معالج افتتاح السنة") sets up a new school year step by step:

- **Live setup checklist** computed from real platform data: professional card, classes, student lists, weekly timetable, curriculum, this-year's daily journal, and the year's holidays — with a readiness percentage and per-step details.
- **Quick actions inside the wizard**: create classes, **bulk-import student names** (paste one per line; duplicates skipped, class roster count synced), add weekly timetable slots, and create the year's daily journal with a chosen theme — every step saves immediately.
- **Printable opening guide**: a checklist document with the setup status, class table and remaining steps.

Endpoints: `GET /api/opening/status/`, `POST /api/opening/quick-class/`, `POST /api/opening/import-students/`, `POST /api/opening/quick-slot/`, `POST /api/opening/quick-journal/`, `POST /api/opening/generate-checklist/`. Covered by `OpeningWizardTests` (full flow incl. duplicate skipping).

## Inspection Simulation Centre (Phase 27)

`/inspection-simulation` (sidebar "محاكاة التفتيش") answers "how would the inspector score me today?":

- **Six inspection domains** (planning, lesson delivery & documentation, assessment & gradebook, student follow-up & support, organisation & administrative documents, professional development), each scored /20 from weighted real-data indicators (plan coverage, session documentation, gradebook and term-marks completeness, support coverage, document richness, training, question-bank growth…).
- **Overall simulated mark /20 with appreciation** (ممتاز ≥16 … يحتاج مرافقة), clearly labelled a self-assessment, not an official evaluation.
- **Simulated lesson-observation grid**: the official 10 criteria, each level derived from the matching evidence stream.
- **Strengths, improvement plan with recommendations, and an evidence checklist** (what to show the inspector, with availability and deep links).
- **Printable simulation report** (domains, grid, plan, evidence, signatures).

Endpoints: `GET /api/inspection-simulation/`, `POST /api/inspection-simulation/generate-report/`. Covered by `InspectionSimulationTests`.

## Cover Designer (Phase 28)

Every daily journal (and the inspector's journal) now has a **cover designer** (Journals page → "تصميم الغلاف" / "تصميم غلاف المفتش"):

- **Upload a photo or logo** — resized in the browser (≤900px, JPEG) and stored in the database (`Journal.cover_config` / `TeacherProfile.cover_config`, migration 0016), so it travels with backups.
- **Four placements**: none, cover top, side, or full-bleed background (with a readability veil), honoured by the journal/inspector PDF `cover()` renderer alongside the theme's cover style.
- **Motto/phrase line, optional alternative cover title, and show/hide toggles** for institution, school year and teacher name on the cover.
- Live preview in the journal's own theme colours and heading font while designing.

Covered by `CoverDesignerTests` (image embedded on page 1, motto rendered, hidden meta lines, both journals).

## Support Groups & Remedial Centre (Phase 29)

`/remedial` (sidebar "مجموعات الدعم والاستدراك") turns term results into working support groups:

- **Evidence-based bands per class/term**: intensive (<8 or incomplete marks), support (8–10), boost (10–12), and attendance follow-up (≥3 term absences) — each student row shows their average, weakest mark component (continuous / supervised / exam), and absences.
- **One-click group formation** into persisted `SupportGroup` records (migration 0017) with a focus text per band.
- **Per group**: schedule the remedial session (date/time), generate a **support worksheet** from the question bank for the term's lessons, and **bulk-create individual SupportPlans** for members (skipping students who already have an open plan).

Endpoints: `GET /api/remedial/?class=&term=`, router `/api/support-groups/` with `schedule`, `generate-worksheet`, `create-plans` actions. Covered by `RemedialTests`.

## Lesson Parity (Phase 30)

Lessons (`/courses`, «الدروس والمقرر الدراسي») now have everything lesson plans had:

- **Themes apply to lessons** (`"course"` added to `RESOURCE_MAP`), so a lesson can take any of the 74 themes from the Themes page or its own preview.
- **Themed preview** at `/preview/course/:id` with live theme switching/applying, PDF export of the student handout (`GET /api/exports/course/{id}/`), and an **editable Creator Studio copy** (`source_type="course"`).
- **Card actions**: preview and PDF export directly from lesson cards, plus cross-navigation with linked plans (`/courses?lesson=`, `/lesson-plans?plan=` deep links with scroll + highlight).
- Covered by `CourseParityTests` (theme apply, handout PDF, editable snapshot).

## Full-page Editors (Phase 31)

The small create/edit modals for lessons and lesson plans are gone. Both resources now use **full-page editors** sized like the rest of the app:

- **Lesson plan editor** (`/lesson-plans/new`, `/lesson-plans/:id/edit`): all plan fields, linked-lesson selector, objectives, theme, and a real **phases editor** (add/remove/reorder phases with teacher/learner activities and minutes, total-vs-duration indicator) — the old modal could not edit phases at all. Sticky live preview in the chosen theme.
- **Lesson editor** (`/courses/new`, `/courses/:id/edit`): order/title/domain/unit/level, key-points and summary editing, theme, taught-in classes, linked-plan shortcuts, and a live preview of the student handout.
- Both support save, delete (when editing), preview/PDF actions and counterpart navigation; every entry point (cards, headers, empty states, deep links, "create plan for this lesson") lands in the full editor.

## Blank-page Fixes (Phase 32)

A "blank page after generating an exam" report led to a full audit (headless-browser sweep of all 45 routes plus click-through of toast-triggering flows):

- **Root cause**: variable shadowing in `Toast.jsx` — the toast list was mapped with `(t) => …` while also calling the translator `t("إغلاق")` inside, so **any action that showed a toast crashed the whole app to a blank page** (generate exam, saves, deletes…). The same trap in `Students.jsx` term buttons (`TERMS.map(([t, label]) => … {t(label)})`) crashed the Students page on load.
- **Missing imports** crashed two more pages on load: `FilterBar` in `Calendar.jsx` and `Inspection.jsx`, and `usePersistentState` in `Inspection.jsx`.
- A broken toast string in bulk student add (`{t("…")}` without `$`) is fixed.
- **Hardening**: a top-level `ErrorBoundary` now catches any future render error and shows a recoverable message (your data is safe · reload / back to dashboard) in Arabic/English/French instead of a silent blank page.

Verification: all 45 routes render with zero page errors; Question Bank → Generate → editor, in-editor question generation with live preview, document save, and Students term switching all exercised in a real browser. Backend suite still **75 tests OK**; test data created during verification was removed (documents back to 7, question bank back to 0).

## Tests, Exams & Assessment Centre (Phase 33)

`/assessments` (sidebar «الفروض والاختبارات») closes the assessment loop that the question bank started — plan the test, generate its paper, record results, analyse:

- **`Assessment` registry** (migration 0018): kind (diagnostic, formative, supervised test, term exam, mock exam), class, optional linked lesson, term, date, duration, maximum score, workflow status (planned → paper ready → administered → marked → returned → archived), paper instructions and teacher notes. Each kind maps to its official gradebook component (continuous / supervised / exam) for reference — results stay separate from the official gradebook.
- **Paper generation** from the question bank (balanced round-robin across easy/medium/hard, optional target points, optional answer key), saved as an editable `exam` document linked to the assessment; regenerating creates a fresh version.
- **Bulk results grid** for the whole class roster: present/absent/excused per student, score clamped to the maximum, comments, live average and success rate while typing. Absent/excused scores are cleared automatically; saving results advances the workflow status.
- **Live statistics per assessment**: recording/marking progress, average (percent and /20), median, success rate, and a four-band distribution (below 50%, 50–65%, 65–80%, 80%+).
- **Analysis document**: one click builds an editable report (indicators, distribution, ranked class table with appreciations, absentee and support lists, recommendations, signatures).
- Duplicate-as-new-draft, global-search integration (`/assessments?assessment={id}` deep link with highlight), dashboard counters (`assessments`, `upcoming_assessments`, `assessments_to_correct`), and full Arabic/English/French UI.

Endpoints: router `/api/assessments/` with `results` (GET/POST), `generate-paper`, `generate-analysis` and `duplicate` actions. Covered by `AssessmentCentreTests` (results/statistics, cross-class rejection, paper + analysis generation); suite now **78 tests**.

## Per-lesson Exam Quotas (Phase 34)

The exam generator no longer forces "one lesson or all lessons":

- **Pick any mix of lessons, with a question quota per lesson** — in the Question Bank generator (`lesson_counts: [{course_id, count}]`) and in the Assessment Centre's paper-generation modal. Each lesson shows its real available count (new `GET /api/question-bank/counts-by-course/`, since the bank list is paginated at 100), with "select all / clear / all available" helpers and a live requested-vs-available summary. Asking for more than a lesson has delivers everything available and reports the shortfall per lesson after generation. The old single-lesson/total-count/target-points modes still work when no lessons are picked, and the overall cap rose from 100 to 200 questions.
- **Richer seeding**: "generate from key points" now takes a variants multiplier (1×–4× per key point: explain / real-life example / short essay summary / practical activity), so a lesson can hold dozens of bank questions instead of one per key point (your 11 lessons: 60 → up to 240).

Covered by `QuestionGenerationQuotaTests` (quota delivery + shortfall breakdown, idempotent multi-variant seeding); suite now **80 tests**.

## Gradebook Sync & Moderation (Phase 35)

Assessment results now flow into the official gradebook — but only through an explicit, teacher-moderated sync:

- **Preview first, never silent writes** (`GET /api/assessments/gradebook-sync/preview/?class_id=&term=&component=`): for the chosen class, term and gradebook component, every student shows their current official mark, the computed candidate, the contributing assessments (title + score /20 each), and an action — **fill** (no official mark yet), **replace** (differs), **same**, or **no data**. A candidate is the mean of the student's score percents across eligible assessments (present + scored, kind mapped to the component: diagnostic/formative → continuous, supervised → supervised, exam/mock → exam), normalised to /20.
- **Moderated apply** (`POST /api/assessments/gradebook-sync/apply/`): `fill` mode (default) writes blanks only; overwriting an existing official mark requires the explicit `overwrite` mode. `student_ids` optionally restricts the write to ticked students. Only the chosen component of each `Mark` is touched, averages recompute automatically, contributing assessments get stamped `gradebook_synced_at`, and the response returns updated/skipped (existing, same, no-data) counts plus a fresh preview.
- **UI**: a shared sync modal opens from both the Assessment Centre («مزامنة دفتر التنقيط») and the Gradebook page («استيراد من التقويمات»), pre-set to the current class/term, with per-student tick boxes and a live «Apply sync (n)» counter. Synced assessments carry a green «مُزامَن مع دفتر التنقيط» badge. Full Arabic/English/French UI (migration 0019).

Covered by `GradebookSyncTests` (cross-assessment averaging, fill-only protection, overwrite + average recompute, component scoping); suite now **82 tests**. Verified in a real browser (fill → overwrite flow against a throwaway class): official marks updated exactly as previewed with zero page errors, and all test data removed afterwards (classes 3, students 54, marks 162, assessments 0, documents 7, question bank 0).

## Assessment History & Results Export (Phase 36)

Assessment Centre results (Phase 33) now surface everywhere a student's story is told, and can leave the app as a file:

- **Student 360° dossier**: `_build_student_dossier` gains an `assessment_results` section — every recorded result (title, kind, term, date, score /20, percent, appreciation ممتاز/جيد/مقبول/يحتاج دعمًا, gradebook-synced flag) — plus a `summary.assessments` block (recorded/present/absent/excused, average percent and /20, best percent). Scored results join the unified timeline («تقويم» events, tone by percent), strengths/next-actions react to assessment averages, and the generated individual report document (ملف تلميذ فردي) now includes a «نتائج التقويمات والفروض» table.
- **Dossier page**: the Marks tab adds a «سجل التقويمات والفروض» card with summary badges and the full history table, deep-linking back to the Assessment Centre.
- **Results CSV export**: `GET /api/assessments/{id}/results/export/` streams the whole roster (Arabic headers: التلميذ، الحالة، النقطة، من أصل، على 20، النسبة ٪، التقدير، ملاحظة) as a UTF-8-BOM CSV; the results modal in the Assessment Centre gets a «تصدير النتائج CSV» download button. Full Arabic/English/French UI; no migration needed.

Covered by `AssessmentHistoryExportTests` (dossier history + summary, CSV export content, dossier-document table); suite now **85 tests**. Verified in a real browser (dossier history card, timeline event, CSV download with correct filename/content, zero page errors); the throwaway verification class was deleted afterwards (real data untouched: classes 3, students 54, marks 162, assessments 0).

## From Results to Remediation (Phase 37)

The assessment loop now closes into intervention: weak results become a working support group in two clicks.

- **Backend** (migration 0020): `SupportGroup.source_assessment` links a group to the assessment that produced it. `POST /api/assessments/{id}/create-support-group/` builds the group from **saved** results — students present and scored below `threshold` (percent, default 50), optionally including absent students (`include_absent`; excused are never included) — with a sensible auto title («دعم واستدراك — …») and focus text naming the assessment, lesson and cohort size. Creating twice is idempotent: the existing active group is returned instead of a duplicate. `AssessmentSerializer.support_group_id` and `SupportGroupSerializer.source_assessment_title` expose the link both ways.
- **Assessment Centre**: the results modal gains a «مجموعة دعم للمتعثرين» panel — it saves the current grid first (so the group always matches what the teacher sees), then offers threshold (40/50/60٪), support band (دعم ومواكبة / دعم مكثف / تعزيز وتثبيت), an include-absent toggle, and live candidate chips with percents. After creation it deep-links into the Support & Remediation centre, where the group carries a «من تقويم: …» source badge and can be scheduled and given worksheets as usual. Assessment cards show a «لها مجموعة دعم» badge. Full Arabic/English/French UI.

Covered by `AssessmentSupportGroupTests` (threshold selection, absent inclusion, idempotency, empty-candidate 400, serializer link); suite now **87 tests**. Verified in a real browser (candidates → create → remedial group with source badge → card badge, zero page errors); the throwaway verification class was deleted afterwards (real data untouched: classes 3, students 54, marks 162, assessments 0, support groups 0).
