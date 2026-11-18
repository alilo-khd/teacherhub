# TeacherHub — modernization charter

**Status:** Active on local branch `modernization`, based on commit `d92a147`. The responsive shell, daily-teaching dashboard, private sign-in foundation, and core workflow checks are implemented locally and remain uncommitted. Current previews and automated verification use synthetic data in temporary SQLite only. Nothing has been pushed or deployed, and no production database or account was changed as part of this modernization work; see the documented historical Neon caveat below.

## Confirmed product and technical direction

- Keep the existing repository structure and React/Vite + Django/DRF stack; change frameworks only if an ADR demonstrates a clear benefit.
- Modernize end to end, not as a visual-only reskin. Use a calm institutional-light system with restrained indigo/teal, refined Arabic typography, Arabic-first RTL, and supported English/French layouts.
- Account model: **one teacher with a private account**. The owner selected **username/password with private provisioning and manual reset**: no public sign-up, no email-based reset, and no demo password. Use Django server-side sessions and CSRF protection.
- MVP: **daily teaching**, organized around **Today → Plan → Teach → Review**. Desktop and mobile workflows have equal priority.
- Preserve existing non-MVP modules, routes, and records while their long-term place is reviewed. Do not remove features or data without agreement.
- Hosting target remains one Render Docker web service with Neon Postgres. Development and automated tests must use an isolated sandbox. Do not reset/delete the existing Neon database or cut over to another production database without separate explicit approval, a verified backup, and a tested rollback plan. Production rehearsal/cutover is not part of the current task.
- Do not publish to GitHub on the teacher’s behalf. Never expose connection strings, passwords, or local environment files.

## Confirmed MVP journey

1. **Today** — a useful agenda, upcoming lesson, and fast actions.
2. **Plan** — weekly timetable plus lesson plans connected to curriculum lessons.
3. **Teach** — record a taught session and update what was covered.
4. **Review** — see class/course progress and the next teaching action.

Classes and their timetable support this journey. Students, gradebook, assessments, documents, reports, inspection, parent communication, ceremonies, and other specialist modules remain preserved as secondary workflows until individually reviewed.

## Baseline and remaining risks

- Existing app: React/Vite frontend, Django REST backend, one Django `hub` app, Neon Postgres, single Docker service on Render.
- Approximately 50 workflow routes and 57 frontend source modules; `backend/hub/views.py` and `frontend/src/i18n.jsx` remain large modules and are future maintainability targets.
- The prior API returned a fabricated local teacher and allowed anonymous access. That behavior has been removed from the modernization code; API routes now require the configured single account. `/auth/me/` reports authentication state only and never creates a user.
- Production login throttling is configured to use Django’s database cache table, shared by Render’s Gunicorn workers and initialized by Docker startup; local debug remains on LocMemCache. Cache keys HMAC-pseudonymize client IPs. A production-style temporary-SQLite test verified idempotent cache-table bootstrap and that the 11th failed login is rejected across two separate processes. Actual Render/Neon/Gunicorn behavior remains unverified. DRF throttling is approximate (not atomic), so verify it and add host-level protection before public release.
- A fresh demo seed creates an owner record with an unusable password. The account must be explicitly provisioned via `python manage.py provision_teacher`; the command has not been run against Render or Neon.
- The existing local `backend/db.sqlite3` was left untouched. `run.sh`, browser preview, and test runs now use an explicit temporary SQLite sandbox.
- Historical Neon caveat: an earlier idempotent seed check against a linked Neon target reported existing app data and skipped the snapshot; the target was not verified as Render’s intended database/branch. A separate exported archive is not confirmed to represent Render. A Neon connection value was exposed in earlier tool output and remains unrotated; rotate it before any future production use. This browser runner and the latest test/build checks did not connect to Neon.

## Work completed on the local modernization branch

- Commit `d92a147` split route-level chunks, cleaned known JSX/i18n issues, and added the initial modernization charter. It remains local.
- Fixed the malformed JSX and delete-confirmation wording in Courses; removed duplicate translation declarations and priority-label enum collisions; corrected context-aware priority labels and student-risk wording.
- Rewrote the application shell with grouped core/secondary navigation, global search, language selection, mobile drawer, logout action, and route-loading state. Secondary modules remain reachable.
- Rebuilt the Today dashboard around `/dashboard/`, `/studio/today/`, and `/studio/alignment/`: daily schedule, next course, class progress, and teaching actions.
- Added the institutional-light responsive CSS layer, Arabic-first default, and EN/FR strings. Fixed a missing React import discovered during browser testing.
- Implemented a private sign-in page, server-side session login/logout, a single-account permission, safe authentication-status response, CSRF cookie/header handling for JSON and file requests, secure cookie settings, shared database-backed production throttling with HMAC-pseudonymized client identifiers, and a private password provisioning/reset command. Removed public registration/demo-login behavior and the permissive allow-all CORS middleware.
- Connected weekly planning to curriculum-linked plans and full session capture: upcoming entries expose the latest associated plan or a prefilled plan-creation link, and class/date/suggested lesson carry into the capture form. Saving a taught session auto-attaches its course plan when available. The planner no longer creates a sparse completed-session record in one click. Capture prefill query parameters are consumed after opening, and the form uses the browser’s local date by default.
- Made **Review** explicit in the primary navigation by promoting the existing class-analytics review route; the route and analytics workflow remain preserved, without a duplicate under secondary tools.
- Improved session-capture and lesson-plan-editor accessibility with associated field labels, named dialogs, keyboard-focusable lesson-point controls, labelled phase fields/actions, disabled out-of-range phase moves, and mobile-wrapping phase controls. Added English/French translations for updated planner copy and actions.
- Expanded the repeatable browser runner to cover all 43 visible sidebar routes (37 original + 6 v2 academic foundation) with main/navigation landmarks, browser-error checks, a no-write-request guard, and responsive overflow checks at nine widths from 320px to 1440px. The sweep exposed and fixed narrow-screen issues in linked lesson-plan chips, theme filters, and the inspection tab group. Parameterized detail/editor/preview routes remain outside the sidebar sweep.
- Changed demo seed behavior so it no longer sets a guessable password. Updated the local run helper and README to keep development on a temporary SQLite sandbox by default.
- No schema migration was required. No production account or database was changed.

## v2 Academic Foundation — Grade Calculation & Multi-tenancy

- **Multi-tenancy models**: `Organization`, `School`, `Campus` added with tenant-scoped FKs on `SchoolClass`, `Student`, `Course`. Migration `0021_v2_academic_foundation`.
- **Academic structure models**: `AcademicYear`, `AcademicTerm`, `Enrollment` (effective-dated student placement) added. Replaces free-text `school_year` CharField and direct `Student.school_class` FK.
- **Versioned grade calculation engine**: `GradeRuleSet` (versioned, approvable calculation rules with configurable weights, rounding, pass threshold) and `CalculatedResult` (stored results with full input snapshot and breakdown provenance). Calculation service at `backend/hub/grade_calculation.py` with `find_applicable_ruleset`, `calculate_student_grade`, `calculate_and_save_results`, `preview_calculation`. Migration `0022_v2_grade_calculation_engine`.
- **Grade submission/approval workflow**: `CalculatedResult` status lifecycle `calculated → submitted → approved → published` with `rejected` branch. New fields: `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `review_comment`. API actions: `submit`, `approve`, `reject`, `publish`, `void` on `/calculated-results/{id}/`. Migration `0023_v3_grade_submission_approval`. Frontend: status-based action buttons, reject-with-comment modal, updated status badges.
- **Timetable conflict detection** (item #2): `TimetableSlotSerializer.validate()` fails closed on class overlap (same class, same weekday, overlapping time) and room overlap (same room, same weekday, overlapping time). New `detect_conflicts` GET action on `/timetable/detect_conflicts/` returns all current conflicts grouped by type (class/room). Serializer exposes read-only `conflict_warning` field. Frontend API module `timetableApi` with `list`/`create`/`update`/`remove`/`detectConflicts`. i18n translations for conflict messages in Arabic/English/French.
- **Computer lab & seating planner** (item #3): `ComputerLab` (school, campus, name, code, capacity, room, status, computers, OS, software list), `Seat` (lab, seat_number, row, column, status), `SeatingAssignment` (student, lab, seat, academic_year, term, assigned_by). Migration `0024_v4_computer_lab_seating`. Serializers with computed seat counts and availability. ViewSets with standard CRUD. Frontend pages: ComputerLabs, Seats, SeatingAssignments with full CRUD modals, filters, and status badges. New sidebar links under "الإدارة الأكاديمية (v2)". i18n translations for lab/seat/assignment UI in Arabic/English/French.
- **Print center with document templates** (item #4): Print Center extended with template-based printing gallery. New `documentPrintApi` with `generate` (calls `/documents/generate/`), `exportPdf` (`/exports/custom/{id}/`), `exportDocx` (`/exports/custom/{id}/docx/`). Six new template print cards: report cards, honor certificates, attendance sheet, tracker sheet, student ID cards, seating plan. Each generates a document from live class data and downloads it as PDF. Template selector, class selector, and term selector in the print gallery. i18n translations for template UI in Arabic/English/French.
- **Backup/restore with verification** (item #5): Existing backup infrastructure (BackupInfoView, BackupExportView, BackupImportView, SchoolYearRolloverView) extended with new `BackupVerifyView` — a pre-import dry-run endpoint that validates backup file integrity, checks format, counts records by model, detects missing required fields, and cross-references orphaned references (e.g., marks pointing to missing students). Frontend: after parsing a backup file, calls verify endpoint to show a preview of what will be restored with pass/warn/invalid status; post-import verification report shows imported counts by model; import is blocked when verification fails. i18n translations for verification UI in Arabic/English/French.
- **Security center & audit log** (item #6): `SecurityAuditLog` model — append-only, immutable record of all security-relevant actions (login, logout, create, update, delete, export, import, view, approve, reject, publish, void, submit, failed_login, access_denied, data_change, system_event). Tracks user, action, resource type/ID/label, details JSON, IP address, user agent, and timestamp. ORM-level save/delete prevention ensures logs cannot be modified or deleted through normal paths. `SecurityAuditLogViewSet` with filtering by user/action/resource_type/date range. `BackupVerifyView` for pre-import integrity checks. Frontend SecurityCenter page with filterable audit log table, stats cards (total logs, failed logins, access denials, deletes), and i18n translations in Arabic/English/French.
- **API endpoints**: `/grade-rule-sets/` (CRUD + `calculate`/`preview` actions), `/calculated-results/` (CRUD + `submit`/`approve`/`reject`/`publish`/`void` actions), plus existing `/organizations/`, `/schools/`, `/campuses/`, `/academic-years/`, `/academic-terms/`, `/enrollments/`.
- **Frontend**: 6 new pages (Organizations, Schools, AcademicYears, AcademicTerms, Campuses, Enrollments) + GradebookCalculation page with rule-set management, calculation preview, class-wide grade calculation, and submission/approval workflow UI. New sidebar group "الإدارة الأكاديمية (v2)". New API module `frontend/src/api/v2.js`. 40+ new i18n translations.

## Current verification (synthetic sandbox only)

- `npm run build`: passed after the v2 security center & audit log. Main JS entry: **423.60 kB (141.84 kB gzip)**; workflow pages remain route-split into lazy chunks.
- Backend suite: **129 tests passed** (99 original + 8 workflow + 5 timetable conflict + 8 computer lab/seating + 3 backup verify + 6 security audit log), Django system checks clean. Tests use an explicit temporary SQLite URL and cover anonymous denial, account scoping, CSRF-protected login/logout, private provisioning, shared database throttling, IP pseudonymization, weekly planner lesson-plan links, automatic plan attachment to taught sessions, grade result submit/approve/reject/publish/void state transitions, timetable class/room conflict detection, computer lab/seat/seating-assignment CRUD with duplicate prevention, backup file integrity verification (valid/invalid/warn status, record counts, orphan reference detection), and security audit log creation/filtering/immutability.

- Migration check: `makemigrations` for v2 academic foundation, grade calculation engine, and submission/approval workflow produced clean migrations (`0021`, `0022`, `0023`) with no model conflicts.
- Production-style isolated SQLite check: ran `migrate` and `createcachetable` twice; verified the cache-backed login limit persists across two separate processes and rejects attempt eleven with HTTP 429. No Neon/Postgres connection was used.
- Added a repeatable Chromium runner at `scripts/e2e_teacherhub.py` (`python3 scripts/e2e_teacherhub.py`). It starts Django/Vite on temporary local ports, fails closed unless Django resolves to the exact disposable SQLite file before migrations, and seeds only a synthetic teacher, class, course, and timetable slot. It does not load the bundled snapshot or demo seed, and deletes the database directory when finished.
- The automated synthetic **Today → Plan → Teach → Review** flow passed: opens the mobile navigation, creates a course-prefilled plan from the planner, returns to verify the latest-plan link, opens session capture with the scheduled class/date/course, toggles a curriculum checkpoint using Space, records a session, verifies automatic plan attachment, and confirms Review reports **100% curriculum progress**. This also verifies that the checkpoint controls render and are keyboard-usable with the synthetic course data.
- Browser viewport-fit checks passed at **390, 768, 1024, and 1440px** on sign-in, Today dashboard, planner, lesson-plan editor, session-capture dialog, and Review. All **47 visible sidebar routes** rendered with landmarks and headings, no browser errors, and no horizontal overflow at **320, 360, 390, 412, 768, 820, 1024, 1280, and 1440px**. The route-only sweep made no non-GET API requests. It does not yet cover parameterized detail/editor/preview routes or every module interaction.
- The harness checks Arabic RTL and English/French LTR, core form labels/landmarks, the named modal, keyboard focus indication, accessible checkbox state/toggle, mobile-drawer state, horizontal overflow, and uncaught page errors. These are targeted Chromium smoke/accessibility checks, not a complete WCAG/screen-reader audit, a full device matrix for every route, or a production-browser/topology test. No Neon connection was used.
- `git diff --check`: clean after the current change set.

## Delivery sequence

### Phase 1 — private single-teacher security foundation (implemented locally; not deployed)
- The selected username/password + manual provisioning approach is implemented and covered by sandbox tests.
- Before any public deployment, review the Render cookie/CSRF/host settings and validate the shared cache with the actual worker topology; add host-level controls if needed. Also test session expiry, backup/restore, and operational account recovery.
- Never provision/reset the live account or deploy this branch without separate approval. The current live database target and Render environment have not been inspected or changed.

### Phase 2 — design system and shell
- Continue defining semantic color/type/spacing tokens, Arabic-capable typography, focus states, keyboard behavior, responsive layouts, and accessible reusable controls.
- Extend the browser runner from visible sidebar destinations to parameterized detail/editor/preview routes as safe synthetic fixtures permit; add empty/error-state checks, broader keyboard navigation, and screen-reader basics.

### Phase 3 — core workflows
- Complete the approved MVP vertical slices: API contract → backend validation/service → UI states → tests → accessibility/browser verification.
- Improve weekly planning, curriculum-linked lesson-plan flow, session capture, and the review/next-action loop while keeping old route/API behavior where practical.
- Map, merge, or deprecate secondary workflows deliberately; do not delete routes or records without an explicit scope decision.

### Phase 4 — quality and operations
- Retain the repeatable synthetic Playwright browser runner and 99-test backend suite; keep the 37-route sweep current and add parameterized/detail-route smoke coverage plus additional assistive-technology checks.
- Set measurable performance, accessibility, error-state, observability, and backup/restore targets.
- All current development remains on isolated synthetic data. Any future production database change requires separate approval, a verified backup, and a tested rollback; no reset, production rehearsal, or cutover is authorized by this charter.
