import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf } from "../api";
import { Spinner, EmptyState } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TYPES = [["homework", "واجب منزلي"], ["classwork", "نشاط صفي"], ["project", "مشروع"], ["research", "بحث"], ["revision", "مراجعة"], ["exercise", "تمرين تطبيقي"], ["other", "أخرى"]];
const STATUSES = [["draft", "مسودة"], ["active", "جارية"], ["closed", "مغلقة"], ["archived", "مؤرشفة"]];
const SUBMISSION_STATUSES = [["not_submitted", "لم يُسلّم بعد"], ["submitted", "سُلّم"], ["late", "سُلّم متأخرًا"], ["reviewed", "تمت مراجعته"], ["excused", "معذور"]];
const labelOf = (rows, key) => rows.find(([k]) => k === key)?.[1] || key;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const statusBadge = (status) => status === "active" ? "text-bg-primary" : status === "closed" ? "text-bg-success" : status === "archived" ? "text-bg-dark" : "text-bg-secondary";
const submissionBadge = (status) => status === "reviewed" ? "text-bg-success" : status === "submitted" ? "text-bg-primary" : status === "late" ? "text-bg-warning" : status === "excused" ? "text-bg-info" : "text-bg-danger";

function dueBadge(assignment, t) {
  if (!assignment.due_date) return <span className="badge text-bg-light border">{t("بدون أجل")}</span>;
  if (assignment.is_overdue) return <span className="badge text-bg-danger">{t("فات الأجل منذ")} {Math.abs(assignment.days_left)} {t("يوم")}</span>;
  if (assignment.days_left === 0) return <span className="badge text-bg-warning">{t("الأجل اليوم")}</span>;
  if (assignment.days_left <= 7) return <span className="badge text-bg-warning">{t("متبقٍ")} {assignment.days_left} {t("يوم")}</span>;
  return <span className="badge text-bg-light border">{t("الأجل")} {assignment.due_date}</span>;
}

function AssignmentForm({ initial, classes, courses, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    school_class: initial?.school_class ? String(initial.school_class) : (classes[0] ? String(classes[0].id) : ""),
    course: initial?.course ? String(initial.course) : "",
    title: initial?.title || "",
    assignment_type: initial?.assignment_type || "homework",
    status: initial?.status || "active",
    assigned_date: initial?.assigned_date || today(),
    due_date: initial?.due_date || "",
    instructions: initial?.instructions || "",
    success_criteria: initial?.success_criteria || "",
    max_score: initial?.max_score ?? 20,
    estimated_minutes: initial?.estimated_minutes ?? 30,
    allow_late: initial?.allow_late ?? true,
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await onSubmit({
        school_class: Number(form.school_class),
        course: form.course ? Number(form.course) : null,
        title: form.title.trim(),
        assignment_type: form.assignment_type,
        status: form.status,
        assigned_date: form.assigned_date,
        due_date: form.due_date || null,
        instructions: form.instructions,
        success_criteria: form.success_criteria,
        max_score: Number(form.max_score || 20),
        estimated_minutes: Number(form.estimated_minutes || 0),
        allow_late: !!form.allow_late,
      });
      onClose();
    } catch { setBusy(false); }
  };

  return (
    <ModalShell title={initial?.id ? t("تعديل المهمة") : t("مهمة جديدة")} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12 col-md-8"><label className="form-label small fw-semibold">{t("عنوان المهمة")} *</label><input className="form-control" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("مثال: واجب حول وظائف نظام التشغيل")} /></div>
          <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("النوع")}</label><select className="form-select" value={form.assignment_type} onChange={(e) => set("assignment_type", e.target.value)}>{TYPES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("الحالة")}</label><select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select></div>
          <div className="col-12 col-md-4"><label className="form-label small fw-semibold">{t("الفوج")} *</label><select className="form-select" required value={form.school_class} onChange={(e) => set("school_class", e.target.value)}>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></div>
          <div className="col-12 col-md-8"><label className="form-label small fw-semibold">{t("الدرس المرتبط")}</label><select className="form-select" value={form.course} onChange={(e) => set("course", e.target.value)}><option value="">{t("بدون درس محدد")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.order}. {course.title}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("تاريخ الإسناد")}</label><input type="date" className="form-control" required value={form.assigned_date} onChange={(e) => set("assigned_date", e.target.value)} /></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("آخر أجل للتسليم")}</label><input type="date" className="form-control" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("النقطة القصوى")}</label><input type="number" min="1" step="0.5" className="form-control" value={form.max_score} onChange={(e) => set("max_score", e.target.value)} /></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("المدة التقديرية (د)")}</label><input type="number" min="0" className="form-control" value={form.estimated_minutes} onChange={(e) => set("estimated_minutes", e.target.value)} /></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("تعليمات المهمة")}</label><textarea className="form-control" rows={4} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder={t("اشرح المطلوب من التلاميذ وخطوات الإنجاز وطريقة التسليم…")} /></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("معايير إنجاز ناجح — معيار في كل سطر")}</label><textarea className="form-control" rows={3} value={form.success_criteria} onChange={(e) => set("success_criteria", e.target.value)} placeholder={t("إجابات واضحة، أمثلة صحيحة، تنظيم جيد…")} /></div>
          <div className="col-12"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="allow-late" checked={form.allow_late} onChange={(e) => set("allow_late", e.target.checked)} /><label className="form-check-label" htmlFor="allow-late">{t("السماح بالتسليم المتأخر")}</label></div></div>
        </div>
        <div className="d-flex gap-2 mt-4"><button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ المهمة")}</button><button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button></div>
      </form>
    </ModalShell>
  );
}

function TrackingModal({ assignment, tracking, edits, setEdits, saving, onSave, onClose }) {
  const { t, te } = useLang();
  const stats = tracking?.stats || assignment.stats || {};
  const setAll = (status) => {
    const next = {};
    (tracking?.students || []).forEach((row) => { next[row.student] = { ...(edits[row.student] || {}), status, submitted_date: ["submitted", "late", "reviewed"].includes(status) ? (edits[row.student]?.submitted_date || today()) : (edits[row.student]?.submitted_date || "") }; });
    setEdits((current) => ({ ...current, ...next }));
  };
  return (
    <ModalShell title={`${t("تتبع التسليم")} — ${assignment.title}`} onClose={onClose} wide>
      <div className="assignment-tracking-summary mb-3">
        <span><strong>{stats.submitted || 0}</strong>/{stats.expected || 0} {t("سُلّم")}</span>
        <span><strong>{stats.missing || 0}</strong> {t("لم يُسلّم")}</span>
        <span><strong>{stats.late || 0}</strong> {t("متأخر")}</span>
        <span><strong>{stats.completion_rate || 0}٪</strong> {t("نسبة الإنجاز")}</span>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <span className="small fw-semibold align-self-center">{t("تحديد سريع:")}</span>
        <button type="button" className="btn btn-sm btn-success rounded-pill" onClick={() => setAll("submitted")}>{t("الكل سلّم")}</button>
        <button type="button" className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setAll("not_submitted")}>{t("الكل لم يسلّم")}</button>
        <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => setAll("reviewed")}>{t("الكل تمت مراجعته")}</button>
      </div>
      <div className="table-responsive assignment-tracking-wrap">
        <table className="table align-middle assignment-tracking-table">
          <thead><tr><th>{t("التلميذ")}</th><th>{t("حالة التسليم")}</th><th>{t("النقطة")}</th><th>{t("تاريخ التسليم")}</th><th>{t("ملاحظة / تغذية راجعة")}</th></tr></thead>
          <tbody>
            {(tracking?.students || []).map((row) => {
              const edit = edits[row.student] || {};
              return (
                <tr key={row.student}>
                  <td><div className="fw-semibold">{row.student_name}</div>{!row.tracked && <span className="badge text-bg-light border">{t("غير متتبع بعد")}</span>}</td>
                  <td><select className="form-select form-select-sm" value={edit.status || "not_submitted"} onChange={(e) => setEdits((current) => ({ ...current, [row.student]: { ...(current[row.student] || {}), status: e.target.value, submitted_date: ["submitted", "late", "reviewed"].includes(e.target.value) ? (current[row.student]?.submitted_date || today()) : (current[row.student]?.submitted_date || "") } }))}>{SUBMISSION_STATUSES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select></td>
                  <td><div className="input-group input-group-sm assignment-score-input"><input type="number" min="0" max={assignment.max_score} step="0.25" className="form-control" value={edit.score ?? ""} onChange={(e) => setEdits((current) => ({ ...current, [row.student]: { ...(current[row.student] || {}), score: e.target.value } }))} /><span className="input-group-text">/ {assignment.max_score}</span></div></td>
                  <td><input type="date" className="form-control form-control-sm" value={edit.submitted_date || ""} onChange={(e) => setEdits((current) => ({ ...current, [row.student]: { ...(current[row.student] || {}), submitted_date: e.target.value } }))} /></td>
                  <td><input className="form-control form-control-sm" value={edit.feedback || ""} onChange={(e) => setEdits((current) => ({ ...current, [row.student]: { ...(current[row.student] || {}), feedback: e.target.value } }))} placeholder={t("ملاحظة سريعة…")} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="d-flex gap-2 mt-3"><button className="btn btn-primary rounded-pill px-4" disabled={saving} onClick={onSave}>{saving ? <span className="spinner-border spinner-border-sm" /> : t("حفظ تتبع التسليم")}</button><button className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إغلاق")}</button></div>
    </ModalShell>
  );
}

export default function AssignmentsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "", type: "", due: "" });
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [trackingAssignment, setTrackingAssignment] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [trackingEdits, setTrackingEdits] = useState({});
  const [savingTracking, setSavingTracking] = useState(false);
  const [busyId, setBusyId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = classFilter ? `?class=${classFilter}` : "";
      const [assignmentRows, overviewData] = await Promise.all([
        api(`/assignments/${params}`).then(listOf),
        api(`/assignments/overview/${params}`),
      ]);
      setAssignments(assignmentRows); setOverview(overviewData);
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [classFilter, toast]);

  useEffect(() => {
    Promise.all([api("/classes/").then(listOf), api("/courses/").then(listOf)])
      .then(([classRows, courseRows]) => { setClasses(classRows); setCourses(courseRows); })
      .catch((error) => toast(error.message, "danger"));
  }, [toast]);
  useEffect(() => { loadData(); }, [loadData]);

  const shownAssignments = useMemo(() => assignments.filter((assignment) => {
    const query = filters.q.trim().toLowerCase();
    const matchesQuery = !query || assignment.title.toLowerCase().includes(query) || (assignment.instructions || "").toLowerCase().includes(query) || (assignment.course_title || "").toLowerCase().includes(query) || assignment.class_name.toLowerCase().includes(query);
    const matchesDue = !filters.due || (filters.due === "overdue" && assignment.is_overdue) || (filters.due === "due_soon" && !assignment.is_overdue && assignment.days_left !== null && assignment.days_left >= 0 && assignment.days_left <= 7) || (filters.due === "missing" && assignment.stats.missing > 0) || (filters.due === "completed" && assignment.stats.completion_rate >= 80);
    return matchesQuery && (!filters.status || assignment.status === filters.status) && (!filters.type || assignment.assignment_type === filters.type) && matchesDue;
  }), [assignments, filters]);

  const saveAssignment = async (payload) => {
    if (assignmentForm?.id) await api(`/assignments/${assignmentForm.id}/`, { method: "PATCH", body: payload });
    else await api("/assignments/", { method: "POST", body: payload });
    toast(t("حُفظت المهمة")); await loadData();
  };

  const patchAssignment = async (assignment, patch) => {
    try { await api(`/assignments/${assignment.id}/`, { method: "PATCH", body: patch }); await loadData(); }
    catch (error) { toast(error.message, "danger"); }
  };

  const openTracking = async (assignment) => {
    setTrackingAssignment(assignment); setTracking(null); setTrackingEdits({});
    try {
      const data = await api(`/assignments/${assignment.id}/tracking/`);
      setTracking(data);
      const edits = {};
      data.students.forEach((row) => { edits[row.student] = { status: row.status, score: row.score ?? "", submitted_date: row.submitted_date || "", feedback: row.feedback || "" }; });
      setTrackingEdits(edits);
    } catch (error) { toast(error.message, "danger"); setTrackingAssignment(null); }
  };

  const saveTracking = async () => {
    if (!trackingAssignment || !tracking) return;
    setSavingTracking(true);
    try {
      const data = await api(`/assignments/${trackingAssignment.id}/bulk-save/`, { method: "POST", body: {
        records: tracking.students.map((row) => ({ student_id: row.student, ...(trackingEdits[row.student] || {}) })),
      }});
      setTracking(data);
      const edits = {};
      data.students.forEach((row) => { edits[row.student] = { status: row.status, score: row.score ?? "", submitted_date: row.submitted_date || "", feedback: row.feedback || "" }; });
      setTrackingEdits(edits); setTrackingAssignment(data.assignment);
      toast(`${t("حُفظ تتبع")} ${data.saved} ${t("تلميذًا")}`); await loadData();
    } catch (error) { toast(error.message, "danger"); }
    setSavingTracking(false);
  };

  const generateDocument = async (assignment, type) => {
    setBusyId(`${assignment.id}-${type}`);
    try {
      const doc = await api(`/assignments/${assignment.id}/generate-document/`, { method: "POST", body: { type } });
      toast(type === "worksheet" ? t("وُلّدت ورقة المهمة") : type === "report" ? t("وُلّد تقرير المهمة") : t("وُلّدت قائمة غير المسلّمين"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusyId("");
  };

  const createSupportPlans = async (assignment) => {
    setBusyId(`${assignment.id}-support`);
    try {
      const result = await api(`/assignments/${assignment.id}/support-missing/`, { method: "POST", body: {} });
      toast(`${t("أُنشئت")} ${result.created} ${t("خطط دعم")} • ${result.existing} ${t("موجودة سابقًا")}`);
      await loadData();
    } catch (error) { toast(error.message, "danger"); }
    setBusyId("");
  };

  const totals = overview?.totals || {};
  const statCards = [
    [overview?.assignments || 0, "مهمة"],
    [overview?.active || 0, "مهمة جارية"],
    [overview?.overdue || 0, "مهمة فائدة الأجل"],
    [`${totals.completion_rate || 0}٪`, "نسبة التسليم"],
    [totals.missing || 0, "تسليم مفقود"],
    [totals.average_score_percent == null ? "—" : `${totals.average_score_percent}٪`, "متوسط النقاط"],
  ];

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز المهام والواجبات")}</h3>
          <p className="text-secondary mb-0">{t("أنشئ مهامًا مرتبطة بالأفواج والدروس، تتبع تسليم كل تلميذ ونقاطه، وحوّل التأخرات إلى وثائق متابعة وخطط دعم.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-light rounded-pill" onClick={() => navigate("/follow-up")}>{t("الحضور ومتابعة التلاميذ")}</button>
          <button className="btn btn-light rounded-pill" onClick={() => navigate("/support")}>{t("الدعم وتواصل الأولياء")}</button>
          <button className="btn btn-primary rounded-pill" disabled={!classes.length} onClick={() => setAssignmentForm({})}><Icon name="plus" size={17} /> {t("مهمة جديدة")}</button>
        </div>
      </div>

      <div className="row g-3 mb-3">
        {statCards.map(([value, label]) => <div className="col-6 col-md-4 col-xl-2" key={label}><div className="stat-mini assignment-stat"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>)}
      </div>

      <div className="card border-0 shadow-sm mb-3"><div className="card-body">
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div><label className="form-label small fw-semibold">{t("الفوج")}</label><div className="d-flex flex-wrap gap-2"><button className={`btn btn-sm rounded-pill ${!classFilter ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setClassFilter("")}>{t("كل الأفواج")}</button>{classes.map((cls) => <button key={cls.id} className={`btn btn-sm rounded-pill ${String(cls.id) === classFilter ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setClassFilter(String(cls.id))}>{cls.name}</button>)}</div></div>
          <div className="ms-auto d-flex flex-wrap gap-2">
            <input className="form-control assignment-search" value={filters.q} onChange={(e) => setFilters((current) => ({ ...current, q: e.target.value }))} placeholder={t("بحث في المهام والدروس…")} />
            <select className="form-select w-auto" value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}><option value="">{t("كل الحالات")}</option>{STATUSES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select>
            <select className="form-select w-auto" value={filters.type} onChange={(e) => setFilters((current) => ({ ...current, type: e.target.value }))}><option value="">{t("كل الأنواع")}</option>{TYPES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select>
            <select className="form-select w-auto" value={filters.due} onChange={(e) => setFilters((current) => ({ ...current, due: e.target.value }))}><option value="">{t("كل الآجال")}</option><option value="overdue">{t("فات أجلها")}</option><option value="due_soon">{t("قريبة الأجل")}</option><option value="missing">{t("فيها غير مسلّمين")}</option><option value="completed">{t("إنجاز مرتفع")}</option></select>
          </div>
        </div>
      </div></div>

      {loading && !assignments.length ? <Spinner /> : !classes.length ? <EmptyState title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا وأضف تلاميذه أولًا من صفحة الأقسام والتلاميذ.")} /> : (
        <div className="row g-3">
          <div className="col-12 col-xl-8">
            {shownAssignments.length === 0 ? <EmptyState title={t("لا مهام مطابقة")} hint={t("أنشئ مهمة جديدة أو غيّر عوامل التصفية لعرض مهام أخرى.")} /> : shownAssignments.map((assignment) => {
              const stats = assignment.stats || {};
              return (
                <article className="card border-0 shadow-sm assignment-card mb-3" key={assignment.id}>
                  <div className="card-body">
                    <div className="d-flex flex-wrap align-items-start gap-2">
                      <div className="flex-grow-1">
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1"><h5 className="fw-bold mb-0">{assignment.title}</h5><span className="badge text-bg-light border">{te(labelOf(TYPES, assignment.assignment_type))}</span><span className={`badge ${statusBadge(assignment.status)}`}>{te(labelOf(STATUSES, assignment.status))}</span>{dueBadge(assignment, t)}</div>
                        <div className="text-secondary small">{assignment.class_name}{assignment.course_title ? ` • ${assignment.course_title}` : ""} • {t("أُسندت")} {assignment.assigned_date}{assignment.due_date ? ` • ${t("الأجل")} ${assignment.due_date}` : ""}</div>
                      </div>
                      <select className="form-select form-select-sm w-auto" value={assignment.status} onChange={(e) => patchAssignment(assignment, { status: e.target.value })} aria-label={t("حالة المهمة")}>{STATUSES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select>
                    </div>
                    {assignment.instructions && <p className="assignment-desc text-secondary mt-3 mb-2">{assignment.instructions}</p>}
                    <div className="assignment-progress progress my-3"><div className="progress-bar" role="progressbar" style={{ width: `${stats.completion_rate || 0}%` }} aria-valuenow={stats.completion_rate || 0} aria-valuemin="0" aria-valuemax="100" /></div>
                    <div className="d-flex flex-wrap gap-2 assignment-chips">
                      <span>{stats.submitted || 0}/{stats.expected || 0} {t("سُلّم")}</span><span>{stats.missing || 0} {t("لم يُسلّم")}</span><span>{stats.late || 0} {t("متأخر")}</span><span>{stats.reviewed || 0} {t("تمت مراجعته")}</span><span>{stats.average_score_percent == null ? "—" : `${stats.average_score_percent}٪`} {t("متوسط النقاط")}</span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <button className="btn btn-primary btn-sm rounded-pill" onClick={() => openTracking(assignment)}>{t("تتبع التسليم")}</button>
                      <button className="btn btn-light btn-sm rounded-pill" disabled={busyId === `${assignment.id}-worksheet`} onClick={() => generateDocument(assignment, "worksheet")}>{t("ورقة المهمة")}</button>
                      <button className="btn btn-light btn-sm rounded-pill" disabled={busyId === `${assignment.id}-report`} onClick={() => generateDocument(assignment, "report")}>{t("تقرير التسليم")}</button>
                      <button className="btn btn-light btn-sm rounded-pill" disabled={!stats.missing && !stats.late} onClick={() => generateDocument(assignment, "missing")}>{t("قائمة المتأخرين")}</button>
                      <button className="btn btn-outline-warning btn-sm rounded-pill" disabled={!stats.missing || busyId === `${assignment.id}-support`} onClick={() => createSupportPlans(assignment)}>{t("خطط دعم لغير المسلّمين")}</button>
                      <span className="flex-grow-1" />
                      <button className="btn btn-light btn-sm rounded-pill" onClick={() => setAssignmentForm(assignment)}>{t("تعديل")}</button>
                      <button className="btn btn-light btn-sm rounded-pill text-danger" onClick={() => setConfirmDelete(assignment)}>{t("حذف")}</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
              <h6 className="fw-bold mb-3">{t("مهام قريبة الأجل")}</h6>
              {(overview?.upcoming || []).length === 0 ? <p className="text-secondary small mb-0">{t("لا مهام قادمة مجدولة.")}</p> : overview.upcoming.map((assignment) => <button key={assignment.id} className="assignment-side-row" onClick={() => openTracking(assignment)}><span><strong>{assignment.title}</strong><small>{assignment.class_name} • {assignment.due_date}</small></span><span className="badge text-bg-warning">{assignment.days_left} {t("يوم")}</span></button>)}
            </div></div>

            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
              <h6 className="fw-bold mb-3">{t("تلاميذ لديهم مهام مفقودة")}</h6>
              {(overview?.missing_students || []).length === 0 ? <p className="text-secondary small mb-0">{t("لا مهام فائدة الأجل مفقودة حاليًا.")}</p> : overview.missing_students.slice(0, 8).map((row) => <button type="button" className="assignment-side-row" key={row.student_id} onClick={() => navigate(`/students/${row.student_id}`)}><span><strong>{row.student_name}</strong><small>{row.class_name} • {row.assignments.slice(0, 2).join("، ")}</small></span><span className="badge text-bg-danger">{row.missing} {t("مفقودة")}</span></button>)}
              {(overview?.missing_students || []).length > 0 && <button className="btn btn-outline-primary btn-sm rounded-pill mt-2" onClick={() => navigate("/support")}>{t("فتح مركز الدعم")}</button>}
            </div></div>

            <div className="card border-0 shadow-sm"><div className="card-body">
              <h6 className="fw-bold mb-3">{t("الإنجاز حسب الفوج")}</h6>
              {(overview?.by_class || []).length === 0 ? <p className="text-secondary small mb-0">{t("ستظهر نسب الإنجاز بعد إنشاء المهام.")}</p> : overview.by_class.map((row) => <div className="mb-3" key={row.class_id}><div className="d-flex justify-content-between small mb-1"><span className="fw-semibold">{row.class_name}</span><span>{row.completion_rate}٪ • {row.assignments} {t("مهمة")}</span></div><div className="progress assignment-progress"><div className="progress-bar" style={{ width: `${row.completion_rate}%` }} /></div></div>)}
            </div></div>
          </div>
        </div>
      )}

      {assignmentForm && <AssignmentForm initial={assignmentForm.id ? assignmentForm : null} classes={classes} courses={courses} onSubmit={saveAssignment} onClose={() => setAssignmentForm(null)} />}
      {trackingAssignment && <TrackingModal assignment={trackingAssignment} tracking={tracking} edits={trackingEdits} setEdits={setTrackingEdits} saving={savingTracking} onSave={saveTracking} onClose={() => { setTrackingAssignment(null); setTracking(null); }} />}
      {confirmDelete && <ConfirmModal title={t("حذف المهمة")} body={`${t("ستُحذف المهمة")} «${confirmDelete.title}» ${t("وكل سجلات تسليمها.")}`} onConfirm={async () => { await api(`/assignments/${confirmDelete.id}/`, { method: "DELETE" }); toast(t("حُذفت المهمة")); await loadData(); }} onClose={() => setConfirmDelete(null)} />}
    </>
  );
}
