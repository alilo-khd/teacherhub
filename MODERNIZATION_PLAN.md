# TeacherHub — modernization charter (draft)

**Status:** Phase 0 started on local branch `modernization`, based on `6cb1cac`. Nothing has been pushed or deployed from this branch. No production database or student data has been altered.

## Confirmed direction

- Keep the existing repository layout and start with the current React/Vite + Django/DRF stack; change frameworks only if an ADR demonstrates a clear benefit.
- Do a phased, end-to-end modernization rather than a visual-only skin.
- Use a calm, premium institutional-light design, Arabic-first with correct RTL; retain English and French.
- Re-scope the product before removing or rewriting business modules.
- Plan a fresh database as a separate cutover. Do **not** reset or delete the current Neon database without a separate explicit confirmation, a verified backup, and a tested rollback plan.

## Baseline audit

- React/Vite frontend, Django REST backend, one Django `hub` app, PostgreSQL through Neon, single Docker service on Render.
- Approximately 50 workflow routes and 57 frontend source modules; the sidebar currently exposes a long list of independent destinations.
- `hub/views.py` is about 5,900 lines and the translation module about 4,100 lines; business logic and translations need clearer boundaries.
- The current auth provider explicitly describes a **single-user, no-sign-in** mode. That is not adequate for a public enterprise deployment containing student records. Authentication, authorization, school/data isolation, and auditability are first-class architecture decisions—not decorative later work.
- Backend baseline: **90 tests pass**.
- Initial frontend build completed but showed a JSX warning, duplicate translation keys, and one eager JavaScript bundle around 897 KB (248 KB gzip). These were the first safe cleanup targets.

## Work already started on this branch

1. Converted workflow pages to route-level lazy loading and added a page-level loading fallback. The main JS entry is now about **399 KB (133 KB gzip)**; the build no longer emits the prior JSX/duplicate-key warnings.
2. Fixed the extra JSX close in the Courses page and its broken delete-confirmation interpolation.
3. Corrected the school-level/priority translation collision for «متوسطة» and removed duplicate enum declarations.
4. Re-ran the backend suite: **90 tests pass**. No data migrations or production writes were made.

## Proposed TeacherHub 2.0 product shape — needs approval

A focused teacher workspace with five primary areas:

1. **Today** — timetable, next lesson, urgent follow-ups, and fast actions.
2. **Teaching** — curriculum, lesson plans, weekly planning, and taught-session log.
3. **Learners** — classes, student records, attendance, gradebook, assessments, and remediation.
4. **Create & report** — question bank, reusable documents, print/PDF, and term/year reports.
5. **Workspace settings** — school year, profile, access, privacy, backup, and audit history.

Potential specialist features (inspection administration, ceremonies, mass parent campaigns, simulations, and similar flows) should be mapped as **keep / merge / archive / retire** before implementation. “Archive” means hide/deprecate in the UI while preserving records and routes during transition; it does not delete data.

## Delivery sequence

### Phase 0 — guardrails and product brief
- Map every existing workflow and API to the five areas; agree primary user, roles, and MVP.
- Preserve the existing database; verify the current backup and keep rollback instructions.
- Work on an isolated branch and use synthetic data for previews/tests.

### Phase 1 — secure foundation
- Decide single-teacher account versus school teams and role model.
- Add real authentication, authorization, session/CSRF protections, least-privilege API access, and school/data boundaries as required.
- Add audit events for sensitive student/grade changes, validated backup/restore, health checks, and operational logging.
- Keep data/schema changes additive; test migrations on a copy before any cutover.

### Phase 2 — design system and product shell
- Define semantic color/type/spacing tokens, Arabic-capable typography, focus states, keyboard behavior, responsive layouts, and accessible reusable controls.
- Replace the long flat navigation with a small number of task-based sections and a clear page hierarchy.
- Rebuild Today/dashboard and the shared list/detail/form patterns before applying the system across modules.

### Phase 3 — core workflows
- Rebuild the approved MVP journeys in vertical slices: API contract → backend validation/service → UI states → tests → accessibility/browser verification.
- Keep existing route/API behavior during transition where practical; map or deprecate old workflows deliberately.

### Phase 4 — quality and operations
- Add frontend component/integration tests and browser smoke coverage; retain the 90 backend tests.
- Set measurable performance, accessibility, error-state, observability, and backup/restore targets.
- Run a production-style rehearsal against a **separate empty database**, compare record counts, then plan an explicit cutover/rollback. Existing Neon remains untouched until that approval.

## Decisions still needed from the product owner

1. **Primary user and access model:** one teacher with a private account, multiple teachers in one school, or a school/district platform with roles?
2. **MVP workflows:** which three areas are essential for the first polished release? Which existing areas should be merged or archived?
3. **Fresh database meaning:** an isolated new database for rehearsal/cutover (recommended), or a new database intended to become production? The existing database will remain preserved either way until a final cutover approval.
4. **Devices:** should the first release be desktop-first, or must teachers be able to complete the core workflows on phones/tablets?
