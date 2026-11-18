// V2 SchoolOS Teacher Workspace — academic foundation API
// Multi-tenancy: Organization, School, Campus, AcademicYear, AcademicTerm, Enrollment
import { api, listOf, downloadPdf } from "../api";

export const orgApi = {
  list: (params = "") => api(`/organizations/${params}`),
  create: (body) => api("/organizations/", { method: "POST", body }),
  update: (id, body) => api(`/organizations/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/organizations/${id}/`, { method: "DELETE" }),
};

export const schoolApi = {
  list: (params = "") => api(`/schools/${params}`),
  create: (body) => api("/schools/", { method: "POST", body }),
  update: (id, body) => api(`/schools/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/schools/${id}/`, { method: "DELETE" }),
};

export const campusApi = {
  list: (params = "") => api(`/campuses/${params}`),
  create: (body) => api("/campuses/", { method: "POST", body }),
  update: (id, body) => api(`/campuses/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/campuses/${id}/`, { method: "DELETE" }),
};

export const academicYearApi = {
  list: (params = "") => api(`/academic-years/${params}`),
  create: (body) => api("/academic-years/", { method: "POST", body }),
  update: (id, body) => api(`/academic-years/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/academic-years/${id}/`, { method: "DELETE" }),
};

export const academicTermApi = {
  list: (params = "") => api(`/academic-terms/${params}`),
  create: (body) => api("/academic-terms/", { method: "POST", body }),
  update: (id, body) => api(`/academic-terms/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/academic-terms/${id}/`, { method: "DELETE" }),
};

export const enrollmentApi = {
  list: (params = "") => api(`/enrollments/${params}`),
  create: (body) => api("/enrollments/", { method: "POST", body }),
  update: (id, body) => api(`/enrollments/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/enrollments/${id}/`, { method: "DELETE" }),
};

// V2 grade calculation engine API
export const gradeCalcApi = {
  // Grade rule sets
  listRuleSets: (params = "") => api(`/grade-rule-sets/${params}`),
  createRuleSet: (body) => api("/grade-rule-sets/", { method: "POST", body }),
  updateRuleSet: (id, body) => api(`/grade-rule-sets/${id}/`, { method: "PATCH", body }),
  removeRuleSet: (id) => api(`/grade-rule-sets/${id}/`, { method: "DELETE" }),
  calculateRuleSet: (id, body) =>
    api(`/grade-rule-sets/${id}/calculate/`, { method: "POST", body }),
  previewRuleSet: (id, body) =>
    api(`/grade-rule-sets/${id}/preview/`, { method: "POST", body }),

  // Calculated results
  listResults: (params = "") => api(`/calculated-results/${params}`),
  createResult: (body) => api("/calculated-results/", { method: "POST", body }),
  updateResult: (id, body) =>
    api(`/calculated-results/${id}/`, { method: "PATCH", body }),
  removeResult: (id) => api(`/calculated-results/${id}/`, { method: "DELETE" }),
  submitResult: (id, body = {}) =>
    api(`/calculated-results/${id}/submit/`, { method: "POST", body }),
  approveResult: (id, body = {}) =>
    api(`/calculated-results/${id}/approve/`, { method: "POST", body }),
  rejectResult: (id, body = {}) =>
    api(`/calculated-results/${id}/reject/`, { method: "POST", body }),
  publishResult: (id, body = {}) =>
    api(`/calculated-results/${id}/publish/`, { method: "POST", body }),
  voidResult: (id, body = {}) =>
    api(`/calculated-results/${id}/void/`, { method: "POST", body }),
};

// Computer lab & seating planner API
export const computerLabApi = {
  list: (params = "") => api(`/computer-labs/${params}`),
  create: (body) => api("/computer-labs/", { method: "POST", body }),
  update: (id, body) =>
    api(`/computer-labs/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/computer-labs/${id}/`, { method: "DELETE" }),
};

export const seatApi = {
  list: (params = "") => api(`/seats/${params}`),
  create: (body) => api("/seats/", { method: "POST", body }),
  update: (id, body) =>
    api(`/seats/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/seats/${id}/`, { method: "DELETE" }),
};

export const seatingAssignmentApi = {
  list: (params = "") => api(`/seating-assignments/${params}`),
  create: (body) => api("/seating-assignments/", { method: "POST", body }),
  update: (id, body) =>
    api(`/seating-assignments/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/seating-assignments/${id}/`, { method: "DELETE" }),
};

// Timetable conflict detection API
export const timetableApi = {
  list: (params = "") => api(`/timetable/${params}`),
  create: (body) => api("/timetable/", { method: "POST", body }),
  update: (id, body) =>
    api(`/timetable/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/timetable/${id}/`, { method: "DELETE" }),
  detectConflicts: () => api("/timetable/detect_conflicts/"),
};

// Document template print API — generates template-based documents and exports as PDF
export const documentPrintApi = {
  generate: (body) => api("/documents/generate/", { method: "POST", body }),
  exportPdf: (id) => `/exports/custom/${id}/`,
  exportDocx: (id) => `/exports/custom/${id}/docx/`,
};

// Backup verification API — pre-import integrity check and post-import reporting
export const backupApi = {
  verify: (body) => api("/backup/verify/", { method: "POST", body }),
};

// Security audit log API
export const securityApi = {
  list: (params = "") => api(`/security-audit-logs/${params}`),
};

// Parent / student portal API
export const parentPortalApi = {
  summary: () => api("/parent-portal/"),
  marks: () => api("/parent-portal/marks/"),
  attendance: () => api("/parent-portal/attendance/"),
  sessions: () => api("/parent-portal/sessions/"),
};

export const studentPortalApi = {
  summary: () => api("/student-portal/"),
  marks: () => api("/student-portal/marks/"),
  attendance: () => api("/student-portal/attendance/"),
};
