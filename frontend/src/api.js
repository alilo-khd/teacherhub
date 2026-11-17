// Tiny API client (local single-user mode — no auth headers needed).
import { tr } from "./i18n";
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || tr("حدث خطأ غير متوقع."));
  return data;
}

export const listOf = (data) => (Array.isArray(data) ? data : data.results || []);

/** Upload one file (plus optional text fields) to an API endpoint. */
export async function uploadFile(path, file, fields = {}) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, value);
  });
  const res = await fetch(`/api${path}`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || tr("حدث خطأ غير متوقع."));
  return data;
}

/** Download any export endpoint (PDF, DOCX…) as a file. */
export async function downloadFile(path, filename = "document.pdf") {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(tr("تعذّر توليد الملف."));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** POST JSON to an endpoint and download the binary response (ZIP archives…). */
export async function downloadPost(path, body, filename = "download.zip") {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || tr("تعذّر توليد الملف."));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Download a PDF export endpoint as a file. */
export async function downloadPdf(path, filename = "document.pdf") {
  return downloadFile(path, filename);
}

export const profileApi = {
  me: () => api("/auth/me/"),
};

export const themeApi = {
  list: (params = "") => api(`/themes/${params}`),
  apply: (themeId, resource_type, resource_id) =>
    api(`/themes/${themeId}/apply/`, { method: "POST", body: { resource_type, resource_id } }),
  generate: (count) => api("/themes/generate/", { method: "POST", body: { count } }),
  create: (body) => api("/themes/", { method: "POST", body }),
  update: (id, body) => api(`/themes/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/themes/${id}/`, { method: "DELETE" }),
  duplicate: (id) => api(`/themes/${id}/duplicate/`, { method: "POST", body: {} }),
};

export const examSeasonApi = {
  overview: (term) => api(`/exam-season/?term=${term}`),
  detail: (classId, term) => api(`/exam-season/class/${classId}/?term=${term}`),
  generatePack: (body) => api("/exam-season/generate-pack/", { method: "POST", body }),
  generateMockExam: (body) => api("/exam-season/generate-mock-exam/", { method: "POST", body }),
};

export const ceremonyApi = {
  overview: (term) => api(`/ceremony/?term=${term}`),
  detail: (classId, term) => api(`/ceremony/class/${classId}/?term=${term}`),
  generateCertificates: (body) => api("/ceremony/generate-certificates/", { method: "POST", body }),
  generateHonourBoard: (body) => api("/ceremony/generate-honour-board/", { method: "POST", body }),
};

export const parentMeetingApi = {
  list: () => api("/parent-meeting-days/"),
  create: (body) => api("/parent-meeting-days/", { method: "POST", body }),
  remove: (id) => api(`/parent-meeting-days/${id}/`, { method: "DELETE" }),
  buildSchedule: (id, body) => api(`/parent-meeting-days/${id}/build-schedule/`, { method: "POST", body }),
  setStatus: (id, appointmentId, body) => api(`/parent-meeting-days/${id}/appointments/${appointmentId}/status/`, { method: "POST", body }),
  generateInvitations: (id) => api(`/parent-meeting-days/${id}/generate-invitations/`, { method: "POST", body: {} }),
  generateAgenda: (id) => api(`/parent-meeting-days/${id}/generate-agenda/`, { method: "POST", body: {} }),
};

export const assistantApi = {
  digest: () => api("/assistant/digest/"),
  createTasks: (body) => api("/assistant/digest/create-tasks/", { method: "POST", body }),
};

export const openingApi = {
  status: () => api("/opening/status/"),
  quickClass: (body) => api("/opening/quick-class/", { method: "POST", body }),
  importStudents: (body) => api("/opening/import-students/", { method: "POST", body }),
  quickSlot: (body) => api("/opening/quick-slot/", { method: "POST", body }),
  quickJournal: (body) => api("/opening/quick-journal/", { method: "POST", body }),
  generateChecklist: () => api("/opening/generate-checklist/", { method: "POST", body: {} }),
};

export const inspectionSimApi = {
  get: () => api("/inspection-simulation/"),
  generateReport: () => api("/inspection-simulation/generate-report/", { method: "POST", body: {} }),
};

export const remedialApi = {
  overview: (term) => api(`/remedial/?term=${term}`),
  detail: (classId, term) => api(`/remedial/?class=${classId}&term=${term}`),
  groups: (classId) => api(`/support-groups/?school_class=${classId}`),
  createGroup: (body) => api("/support-groups/", { method: "POST", body }),
  updateGroup: (id, body) => api(`/support-groups/${id}/`, { method: "PATCH", body }),
  removeGroup: (id) => api(`/support-groups/${id}/`, { method: "DELETE" }),
  schedule: (id, body) => api(`/support-groups/${id}/schedule/`, { method: "POST", body }),
  generateWorksheet: (id, body) => api(`/support-groups/${id}/generate-worksheet/`, { method: "POST", body }),
  createPlans: (id) => api(`/support-groups/${id}/create-plans/`, { method: "POST", body: {} }),
};

export const designApi = {
  sections: () => api("/design/sections/"),
};

export const assessmentApi = {
  list: (params = "") => api(`/assessments/${params}`),
  create: (body) => api("/assessments/", { method: "POST", body }),
  update: (id, body) => api(`/assessments/${id}/`, { method: "PATCH", body }),
  remove: (id) => api(`/assessments/${id}/`, { method: "DELETE" }),
  duplicate: (id) => api(`/assessments/${id}/duplicate/`, { method: "POST", body: {} }),
  results: (id) => api(`/assessments/${id}/results/`),
  saveResults: (id, rows) => api(`/assessments/${id}/results/`, { method: "POST", body: { rows } }),
  generatePaper: (id, body = {}) => api(`/assessments/${id}/generate-paper/`, { method: "POST", body }),
  generateAnalysis: (id) => api(`/assessments/${id}/generate-analysis/`, { method: "POST", body: {} }),
  syncPreview: (classId, term, component) => api(`/assessments/gradebook-sync/preview/?class_id=${classId}&term=${term}&component=${component}`),
  syncApply: (body) => api("/assessments/gradebook-sync/apply/", { method: "POST", body }),
  get: (id) => api(`/assessments/${id}/`),
  createSupportGroup: (id, body) => api(`/assessments/${id}/create-support-group/`, { method: "POST", body }),
};
