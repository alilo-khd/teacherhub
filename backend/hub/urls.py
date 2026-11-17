from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("themes", views.ThemeViewSet, basename="themes")
router.register("journals", views.JournalViewSet, basename="journals")
router.register("lesson-plans", views.LessonPlanViewSet, basename="lesson-plans")
router.register("notebooks", views.NoteBookViewSet, basename="notebooks")
router.register("note-entries", views.NoteEntryViewSet, basename="note-entries")
router.register("classes", views.SchoolClassViewSet, basename="classes")
router.register("timetable", views.TimetableSlotViewSet, basename="timetable")
router.register("courses", views.CourseViewSet, basename="courses")
router.register("sessions", views.SessionViewSet, basename="sessions")
router.register("students", views.StudentViewSet, basename="students")
router.register("marks", views.MarkViewSet, basename="marks")
router.register("holidays", views.HolidayViewSet, basename="holidays")
router.register("seminars", views.SeminarViewSet, basename="seminars")
router.register("institutions", views.InstitutionViewSet, basename="institutions")
router.register("visits", views.VisitViewSet, basename="visits")
router.register("observations", views.ObservationViewSet, basename="observations")
router.register("documents", views.CustomDocumentViewSet, basename="documents")
router.register("question-bank", views.QuestionBankItemViewSet, basename="question-bank")
router.register("attendance", views.AttendanceRecordViewSet, basename="attendance")
router.register("follow-ups", views.StudentFollowUpRecordViewSet, basename="follow-ups")
router.register("support-plans", views.SupportPlanViewSet, basename="support-plans")
router.register("parent-communications", views.ParentCommunicationViewSet, basename="parent-communications")
router.register("assignments", views.AssignmentViewSet, basename="assignments")
router.register("assignment-submissions", views.AssignmentSubmissionViewSet, basename="assignment-submissions")
router.register("meetings", views.MeetingViewSet, basename="meetings")
router.register("parent-meeting-days", views.ParentMeetingDayViewSet, basename="parent-meeting-days")
router.register("support-groups", views.SupportGroupViewSet, basename="support-groups")
router.register("tasks", views.TeacherTaskViewSet, basename="tasks")
router.register("assessments", views.AssessmentViewSet, basename="assessments")

urlpatterns = [
    path("auth/me/", views.me),
    path("profile/", views.TeacherProfileView.as_view()),
    path("dashboard/", views.DashboardView.as_view()),
    path("studio/today/", views.StudioTodayView.as_view()),
    path("studio/alignment/", views.StudioAlignmentView.as_view()),
    path("search/", views.SearchView.as_view()),
    path("classes/<int:pk>/stats/", views.SchoolClassStatsView.as_view()),
    path("classes/<int:pk>/analytics/", views.ClassAnalyticsView.as_view()),
    path("analytics/classes/", views.ClassAnalyticsOverviewView.as_view()),
    path("analytics/classes/<int:pk>/generate-report/", views.ClassAnalyticsReportView.as_view()),
    path("classes/<int:pk>/term-pack/", views.TermPackView.as_view()),
    path("classes/<int:pk>/term-pack/generate/", views.TermPackGenerateView.as_view()),
    path("term-packs/", views.TermPacksOverviewView.as_view()),
    path("portfolio/", views.PortfolioView.as_view()),
    path("portfolio/generate/", views.PortfolioGenerateView.as_view()),
    path("backup/info/", views.BackupInfoView.as_view()),
    path("backup/export/", views.BackupExportView.as_view()),
    path("backup/import/", views.BackupImportView.as_view()),
    path("backup/rollover/", views.SchoolYearRolloverView.as_view()),
    path("classes/<int:pk>/progression/", views.ProgressionView.as_view()),
    path("classes/<int:pk>/progression/generate-document/", views.ProgressionDocumentView.as_view()),
    path("progressions/", views.ProgressionsOverviewView.as_view()),
    path("classes/<int:pk>/parent-campaign/", views.ParentCampaignPreviewView.as_view()),
    path("classes/<int:pk>/parent-campaign/generate/", views.ParentCampaignGenerateView.as_view()),
    path("planner/week/", views.PlannerWeekView.as_view()),
    path("planner/week/generate-document/", views.PlannerDocumentView.as_view()),
    path("assessments/gradebook-sync/preview/", views.GradebookSyncPreviewView.as_view()),
    path("assessments/gradebook-sync/apply/", views.GradebookSyncApplyView.as_view()),
    path("classes/<int:pk>/gradebook/", views.GradebookView.as_view()),
    path("classes/<int:pk>/gradebook/save/", views.GradebookSaveView.as_view()),
    path("classes/<int:pk>/gradebook/export/", views.GradebookExportView.as_view()),
    path("classes/<int:pk>/gradebook/import/", views.GradebookImportView.as_view()),
    path("meetings/council-brief/<int:pk>/", views.CouncilBriefView.as_view()),
    path("year-review/", views.YearReviewView.as_view()),
    path("year-review/generate-document/", views.YearReviewDocumentView.as_view()),
    path("design/sections/", views.DesignSectionsView.as_view()),
    path("exam-season/", views.ExamSeasonOverviewView.as_view()),
    path("exam-season/class/<int:pk>/", views.ExamSeasonClassView.as_view()),
    path("exam-season/generate-pack/", views.ExamSeasonPackView.as_view()),
    path("exam-season/generate-mock-exam/", views.ExamSeasonMockExamView.as_view()),
    path("ceremony/", views.CeremonyOverviewView.as_view()),
    path("assistant/digest/", views.AssistantDigestView.as_view()),
    path("opening/status/", views.OpeningStatusView.as_view()),
    path("inspection-simulation/", views.InspectionSimulationView.as_view()),
    path("remedial/", views.RemedialSuggestionsView.as_view()),
    path("inspection-simulation/generate-report/", views.InspectionSimulationReportView.as_view()),
    path("opening/quick-class/", views.OpeningQuickClassView.as_view()),
    path("opening/import-students/", views.OpeningImportStudentsView.as_view()),
    path("opening/quick-slot/", views.OpeningQuickSlotView.as_view()),
    path("opening/quick-journal/", views.OpeningQuickJournalView.as_view()),
    path("opening/generate-checklist/", views.OpeningChecklistView.as_view()),
    path("assistant/digest/create-tasks/", views.AssistantCreateTasksView.as_view()),
    path("ceremony/class/<int:pk>/", views.CeremonyClassView.as_view()),
    path("ceremony/generate-certificates/", views.CeremonyCertificatesView.as_view()),
    path("ceremony/generate-honour-board/", views.CeremonyHonourBoardView.as_view()),
    path("exports/journal/<int:pk>/", views.export_journal),
    path("exports/inspector/", views.export_inspector),
    path("exports/gradebook/<int:pk>/", views.export_gradebook),
    path("exports/lesson-plan/<int:pk>/", views.export_lesson_plan),
    path("exports/course/<int:pk>/", views.export_course),
    path("exports/class-report/<int:pk>/", views.export_class_report),
    path("exports/sessions/", views.export_sessions),
    path("exports/timetable/", views.export_timetable),
    path("exports/notebook/<int:pk>/", views.export_notebook),
    path("exports/observation/<int:pk>/", views.export_observation),
    path("exports/custom/<int:pk>/", views.export_custom),
    path("exports/custom/<int:pk>/docx/", views.export_custom_docx),
    path("", include(router.urls)),
]
