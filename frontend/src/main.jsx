import { lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, ProtectedRoute } from "./auth";
import { LangProvider } from "./i18n";
import { ToastProvider } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";

// Load each workflow only when it is opened. The previous eager imports put
// every screen into one ~900 KB JavaScript entry bundle.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ThemesPage = lazy(() => import("./pages/Themes"));
const JournalsPage = lazy(() => import("./pages/Resources").then((m) => ({ default: m.JournalsPage })));
const LessonPlansPage = lazy(() => import("./pages/Resources").then((m) => ({ default: m.LessonPlansPage })));
const NoteBooksPage = lazy(() => import("./pages/Resources").then((m) => ({ default: m.NoteBooksPage })));
const SessionsPage = lazy(() => import("./pages/Sessions"));
const ClassesPage = lazy(() => import("./pages/Classes"));
const CoursesPage = lazy(() => import("./pages/Courses"));
const StudentsPage = lazy(() => import("./pages/Students"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const InspectionPage = lazy(() => import("./pages/Inspection"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const PrintCenterPage = lazy(() => import("./pages/PrintCenter"));
const PreviewPage = lazy(() => import("./pages/Preview"));
const CreatorStudioPage = lazy(() => import("./pages/CreatorStudio"));
const DocumentEditorPage = lazy(() => import("./pages/DocumentEditor"));
const QuestionBankPage = lazy(() => import("./pages/QuestionBank"));
const FollowUpPage = lazy(() => import("./pages/FollowUp"));
const SupportPage = lazy(() => import("./pages/Support"));
const AssignmentsPage = lazy(() => import("./pages/Assignments"));
const StudentDossierPage = lazy(() => import("./pages/StudentDossier"));
const AnalyticsPage = lazy(() => import("./pages/Analytics"));
const ActionsPage = lazy(() => import("./pages/Actions"));
const ReportsPage = lazy(() => import("./pages/Reports"));
const PortfolioPage = lazy(() => import("./pages/Portfolio"));
const BackupPage = lazy(() => import("./pages/Backup"));
const ProgressionPage = lazy(() => import("./pages/Progression"));
const CampaignsPage = lazy(() => import("./pages/Campaigns"));
const PlannerPage = lazy(() => import("./pages/Planner"));
const GradebookPage = lazy(() => import("./pages/Gradebook"));
const MeetingsPage = lazy(() => import("./pages/Meetings"));
const ExamSeasonPage = lazy(() => import("./pages/ExamSeason"));
const CeremonyPage = lazy(() => import("./pages/Ceremony"));
const ParentMeetingsPage = lazy(() => import("./pages/ParentMeetings"));
const AssistantPage = lazy(() => import("./pages/Assistant"));
const OpeningPage = lazy(() => import("./pages/Opening"));
const InspectionSimulationPage = lazy(() => import("./pages/InspectionSimulation"));
const RemedialPage = lazy(() => import("./pages/Remedial"));
const PlanEditorPage = lazy(() => import("./pages/PlanEditor"));
const CourseEditorPage = lazy(() => import("./pages/CourseEditor"));
const YearReviewPage = lazy(() => import("./pages/YearReview"));
const AssessmentsPage = lazy(() => import("./pages/Assessments"));

async function startApp() {
  let savedLang = "en";
  try {
    savedLang = localStorage.getItem("teacherhub-lang") || "en";
  } catch {
    // Private browsing may disable localStorage; English remains the fallback.
  }

  if (savedLang === "ar") await import("bootstrap/dist/css/bootstrap.rtl.min.css");
  else await import("bootstrap/dist/css/bootstrap.min.css");
  await import("./index.css");

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <LangProvider>
          <AuthProvider>
            <ErrorBoundary>
              <ToastProvider>
                <Routes>
                  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/sessions" element={<SessionsPage />} />
                    <Route path="/classes" element={<ClassesPage />} />
                    <Route path="/students" element={<StudentsPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/inspection" element={<InspectionPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/print" element={<PrintCenterPage />} />
                    <Route path="/courses" element={<CoursesPage />} />
                    <Route path="/themes" element={<ThemesPage />} />
                    <Route path="/journals" element={<JournalsPage />} />
                    <Route path="/lesson-plans" element={<LessonPlansPage />} />
                    <Route path="/notebooks" element={<NoteBooksPage />} />
                    <Route path="/preview/:type/:id" element={<PreviewPage />} />
                    <Route path="/creator" element={<CreatorStudioPage />} />
                    <Route path="/editor/:id" element={<DocumentEditorPage />} />
                    <Route path="/question-bank" element={<QuestionBankPage />} />
                    <Route path="/follow-up" element={<FollowUpPage />} />
                    <Route path="/support" element={<SupportPage />} />
                    <Route path="/assignments" element={<AssignmentsPage />} />
                    <Route path="/students/:id" element={<StudentDossierPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/actions" element={<ActionsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/backup" element={<BackupPage />} />
                    <Route path="/progression" element={<ProgressionPage />} />
                    <Route path="/campaigns" element={<CampaignsPage />} />
                    <Route path="/planner" element={<PlannerPage />} />
                    <Route path="/gradebook" element={<GradebookPage />} />
                    <Route path="/meetings" element={<MeetingsPage />} />
                    <Route path="/year-review" element={<YearReviewPage />} />
                    <Route path="/exam-season" element={<ExamSeasonPage />} />
                    <Route path="/ceremony" element={<CeremonyPage />} />
                    <Route path="/parent-meetings" element={<ParentMeetingsPage />} />
                    <Route path="/assistant" element={<AssistantPage />} />
                    <Route path="/opening" element={<OpeningPage />} />
                    <Route path="/inspection-simulation" element={<InspectionSimulationPage />} />
                    <Route path="/remedial" element={<RemedialPage />} />
                    <Route path="/lesson-plans/new" element={<PlanEditorPage />} />
                    <Route path="/lesson-plans/:id/edit" element={<PlanEditorPage />} />
                    <Route path="/courses/new" element={<CourseEditorPage />} />
                    <Route path="/courses/:id/edit" element={<CourseEditorPage />} />
                    <Route path="/assessments" element={<AssessmentsPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ToastProvider>
            </ErrorBoundary>
          </AuthProvider>
        </LangProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

startApp();
