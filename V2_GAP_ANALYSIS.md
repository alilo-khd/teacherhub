# TeacherHub → SchoolOS Teacher Workspace (v2) Gap Analysis

## Reference (screenshot): "أستاذي – دفتر الأستاذ الرقمي"

The screenshot shows an Arabic RTL desktop teacher register with:
- Right-hand vertical sidebar, top app bar, central dashboard
- **16 sidebar modules**: Dashboard, Gradebook, Daily Register, Absence & Behavior, Lesson Plan Builder, Weekly Timetable, Seating Planner, Computer Science Lab, Statistics, Personal Information, Backup, Security, Print Center, Grade Submission, License, Settings
- **14 KPI cards** (total students, classes, male/female, absent/late today, warnings, rewards, institution avg, success rate, highest/lowest, assignments/tests entered)
- **3 charts**: Gender distribution, Overall success rate, Average distribution
- Academic year 2026–2027, date 17 Nov 2026
- "No backup has yet been created" status strip (decorative in reference)

## What TeacherHub v1 currently has (verified working)

| Area | Status | Evidence |
|------|--------|----------|
| RTL Arabic + French LTR | ✅ | `index.css`, `i18n.jsx`, bootstrap.rtl, E2E RTL checks |
| Responsive (320–1440px) | ✅ | E2E: 9 widths, no overflow on all 37 sidebar routes |
| Single-teacher auth | ✅ | `provision_teacher`, `LoginView`, CSRF, throttling, permissions |
| Dashboard | ✅ | `Dashboard.jsx`, E2E core flow |
| Classes / Students | ✅ | `SchoolClass`, `Student`, `Classes.jsx`, `Students.jsx` |
| Courses / Lesson plans | ✅ | `Course`, `LessonPlan`, `PlanEditor.jsx` |
| Sessions (taught record) | ✅ | `Session`, `Sessions.jsx`, Today→Plan→Teach→Review flow |
| Marks / Gradebook | ✅ | `Mark`, `Gradebook.jsx` (simple continuous/supervised/exam avg) |
| Attendance | ✅ | `AttendanceRecord` |
| Assignments + submissions | ✅ | `Assignment`, `AssignmentSubmission`, `Assignments.jsx` |
| Assessments + results | ✅ | `Assessment`, `AssessmentResult`, `Assessments.jsx` |
| Question bank | ✅ | `QuestionBankItem`, `QuestionBank.jsx` |
| Custom documents | ✅ | `CustomDocument`, `DocumentRevision`, `CreatorStudio.jsx` |
| Teacher tasks | ✅ | `TeacherTask`, `Tasks.jsx` |
| Calendar-ish (Holiday/Seminar) | ✅ | `Holiday`, `Seminar` |
| Parent communication | ✅ | `ParentCommunication` |
| Support plans | ✅ | `SupportPlan` |
| Meetings / parent meetings | ✅ | `Meeting`, `ParentMeetingDay`, `ParentAppointment` |
| Backup page | ⚠️ Decorative only | `Backup.jsx` exists but no BackupJob/RestoreJob models |
| Security page | ⚠️ Partial | throttling + permissions, no session/MFA/audit-log UI |
| Print center | ⚠️ Partial | `PrintCenter.jsx`, `pdf.py`, `docx_export.py`, no template system |
| Seating planner | ❌ | `CustomDocument` kind="seating" exists, no layout/assignment models |
| Computer lab | ❌ | No lab/workstation/inventory models |
| Grade submission/approval | ❌ | Marks entered directly; no draft→submit→review→approve→publish |
| Multi-tenancy (Org/School/Campus) | ❌ | Everything is `owner = User` FK; no org/school scoping |
| AcademicYear/AcademicTerm | ❌ | `school_year` is a free-text CharField on Journal |
| Enrollment with effective dates | ❌ | `Student.school_class` is a direct FK; no enrollment history |
| Versioned calculation engine | ❌ | `Mark.average` is a hardcoded Python property |
| Timetable conflict detection | ❌ | `TimetableSlot` exists, no backend conflict validation |
| Parent/student portals | ❌ | No portal account models or views |
| Resource library | ⚠️ Partial | `CustomDocument` but no folders/tags/sharing/quotas |
| Notifications system | ❌ | No Notification model or delivery |
| Audit log | ❌ | No AuditEvent model |
| License/subscription | ❌ | No LicenseSubscription/Entitlement model |
| API versioning | ❌ | No `/api/v1/` versioning |
| Barcode/QR scanning | ❌ | Not implemented |
| Offline/PWA | ❌ | Not implemented |

## What the screenshot establishes vs what the spec proposes

The screenshot is the **reference product** — a compact teacher digital register. The Master Specification proposes a **substantially broader** SchoolOS Teacher Workspace that connects modules through shared students, enrollments, classes, subjects, academic years, assessments, attendance, lesson records, documents, and permissions.

## Top v2 improvement priorities

### Phase 1 — Academic foundation (foundational, unblocks everything else)
1. **Organization / School / Campus models** — multi-tenancy instead of single-user ownership
2. **AcademicYear / AcademicTerm models** — replace free-text `school_year`
3. **Enrollment model** — effective-dated student placement (replaces direct `Student.school_class`)
4. **Role/scope permission model** — replace single-account permission with org/school/class/subject scoping

### Phase 2 — Core academic workflows
5. **Versioned grade calculation engine** — configurable rulesets, weights, coefficients, term/annual aggregation
6. **Grade submission/approval workflow** — draft → submitted → under review → approved → published
7. **Timetable conflict detection** — backend validation (teacher/room/class double-booking)
8. **Seating planner** — SeatingLayout/Seat/SeatAssignment models + UI

### Phase 3 — Operations & compliance
9. **Backup/restore** — BackupJob/RestoreJob models, scheduled + manual, verification
10. **Security center + audit log** — AuditEvent model, session management, MFA option
11. **Print center** — document templates, generation jobs, Arabic PDF verification
12. **Computer lab** — room/workstation/inventory models

### Phase 4 — Portals & communication
13. **Parent/student portals** — portal account models, publication controls
14. **Notifications** — Notification model, in-app + email/SMS options
15. **Resource library** — folders, tags, sharing, quotas, malware scanning

### Phase 5 — Advanced
16. **Question bank paper generator** — variants, answer keys, print-ready output
17. **Barcode/QR scanning**
18. **Offline/PWA**
19. **AI teaching assistant** (optional, with guardrails)
20. **License/subscription entitlements**
