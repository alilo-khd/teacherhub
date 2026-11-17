import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, ProtectedRoute } from "./auth";
import { LangProvider } from "./i18n";
import { ToastProvider } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ThemesPage from "./pages/Themes";
import { JournalsPage, LessonPlansPage, NoteBooksPage } from "./pages/Resources";
import SessionsPage from "./pages/Sessions";
import ClassesPage from "./pages/Classes";
import CoursesPage from "./pages/Courses";
import StudentsPage from "./pages/Students";
import CalendarPage from "./pages/Calendar";
import InspectionPage from "./pages/Inspection";
import ProfilePage from "./pages/Profile";
import PrintCenterPage from "./pages/PrintCenter";
import PreviewPage from "./pages/Preview";
import CreatorStudioPage from "./pages/CreatorStudio";
import DocumentEditorPage from "./pages/DocumentEditor";
import QuestionBankPage from "./pages/QuestionBank";
import FollowUpPage from "./pages/FollowUp";
import SupportPage from "./pages/Support";
import AssignmentsPage from "./pages/Assignments";
import StudentDossierPage from "./pages/StudentDossier";
import AnalyticsPage from "./pages/Analytics";
import ActionsPage from "./pages/Actions";
import ReportsPage from "./pages/Reports";
import PortfolioPage from "./pages/Portfolio";
import BackupPage from "./pages/Backup";
import ProgressionPage from "./pages/Progression";
import CampaignsPage from "./pages/Campaigns";
import PlannerPage from "./pages/Planner";
import GradebookPage from "./pages/Gradebook";
import MeetingsPage from "./pages/Meetings";
import ExamSeasonPage from "./pages/ExamSeason";
import CeremonyPage from "./pages/Ceremony";
import ParentMeetingsPage from "./pages/ParentMeetings";
import AssistantPage from "./pages/Assistant";
import OpeningPage from "./pages/Opening";
import InspectionSimulationPage from "./pages/InspectionSimulation";
import RemedialPage from "./pages/Remedial";
import PlanEditorPage from "./pages/PlanEditor";
import CourseEditorPage from "./pages/CourseEditor";
import YearReviewPage from "./pages/YearReview";
import AssessmentsPage from "./pages/Assessments";

async function startApp() {
  let savedLang = "en";
  try { savedLang = localStorage.getItem("teacherhub-lang") || "en"; } catch { /* private mode */ }
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
