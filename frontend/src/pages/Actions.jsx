import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const CATEGORIES = [["support", "دعم التلاميذ"], ["assignment", "المهام والواجبات"], ["parent", "تواصل الأولياء"], ["attendance", "الحضور"], ["lesson", "تحضير الدروس"], ["calendar", "التنظيم والتقويم"], ["inspection", "التفتيش والمتابعة"], ["document", "الوثائق"], ["general", "عامة"]];
const PRIORITIES = [["low", "منخفضة"], ["medium", "متوسطة"], ["high", "عالية"]];
const STATUSES = [["pending", "قيد الانتظار"], ["in_progress", "قيد الإنجاز"], ["done", "منجزة"], ["cancelled", "ملغاة"]];
const labelOf = (rows, key) => rows.find(([k]) => k === key)?.[1] || key;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const priorityBadge = (priority) => priority === "high" ? "text-bg-danger" : priority === "medium" ? "text-bg-warning" : "text-bg-success";
const statusBadge = (status) => status === "done" ? "text-bg-success" : status === "in_progress" ? "text-bg-primary" : status === "cancelled" ? "text-bg-dark" : "text-bg-secondary";

function dueInfo(task, t) {
  if (!task.due_date) return <span className="badge text-bg-light border">{t("بدون أجل")}</span>;
  if (task.is_overdue) return <span className="badge text-bg-danger">{t("متأخرة منذ")} {Math.abs(task.days_left)} {t("يوم")}</span>;
  if (task.days_left === 0) return <span className="badge text-bg-warning">{t("تستحق اليوم")}</span>;
  if (task.days_left <= 7) return <span className="badge text-bg-warning">{t("خلال")} {task.days_left} {t("يوم")}</span>;
  return <span className="badge text-bg-light border">{task.due_date}</span>;
}

function bucketOf(task) {
  if (["done", "cancelled"].includes(task.status)) return "closed";
  if (!task.due_date) return "nodate";
  if (task.is_overdue) return "overdue";
  if (task.days_left === 0) return "today";
  if (task.days_left <= 7) return "week";
  return "later";
}

function TaskForm({ initial, classes, students, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    category: initial?.category || "general",
    priority: initial?.priority || "medium",
    status: initial?.status || "pending",
    due_date: initial?.due_date || "",
    student: initial?.student ? String(initial.student) : "",
    school_class: initial?.school_class ? String(initial.school_class) : "",
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const visibleStudents = students.filter((student) => !form.school_class || String(student.school_class) === form.school_class);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const student = students.find((row) => String(row.id) === form.student);
      await onSubmit({
        title: form.title.trim(), description: form.description, category: form.category, priority: form.priority,
        status: form.status, due_date: form.due_date || null,
        student: form.student ? Number(form.student) : null,
        school_class: form.school_class ? Number(form.school_class) : (student ? student.school_class : null),
        source_type: initial?.source_type || "", source_id: initial?.source_id || null, origin: initial?.origin || "manual",
      });
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <ModalShell title={initial?.id ? t("تعديل المهمة الإجرائية") : t("مهمة إجرائية جديدة")} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12"><label className="form-label small fw-semibold">{t("عنوان المهمة")} *</label><input className="form-control" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("مثال: الاتصال بولي تلميذ كثير الغياب")} /></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الصنف")}</label><select className="form-select" value={form.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الأولوية")}</label><select className="form-select" value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الحالة")}</label><select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("تاريخ الاستحقاق")}</label><input type="date" className="form-control" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></div>
          <div className="col-12 col-md-6"><label className="form-label small fw-semibold">{t("الفوج المرتبط")}</label><select className="form-select" value={form.school_class} onChange={(e) => { set("school_class", e.target.value); set("student", ""); }}><option value="">{t("بدون فوج محدد")}</option>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></div>
          <div className="col-12 col-md-6"><label className="form-label small fw-semibold">{t("التلميذ المرتبط")}</label><select className="form-select" value={form.student} onChange={(e) => set("student", e.target.value)}><option value="">{t("بدون تلميذ محدد")}</option>{visibleStudents.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}</select></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("وصف المهمة وخطواتها")}</label><textarea className="form-control" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("ما الذي يجب فعله؟ وما النتيجة المتوقعة؟")} /></div>
        </div>
        <div className="d-flex gap-2 mt-4"><button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ المهمة")}</button><button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button></div>
      </form>
    </ModalShell>
  );
}

export default function ActionsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("tasks");
  const [tasks, setTasks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "", category: "", priority: "", due: "" });
  const [taskForm, setTaskForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const [taskRows, summaryData, suggestionData] = await Promise.all([
        api(`/tasks/${params.toString() ? `?${params.toString()}` : ""}`).then(listOf),
        api("/tasks/summary/"),
        api("/tasks/suggestions/"),
      ]);
      setTasks(taskRows); setSummary(summaryData); setSuggestions(suggestionData.suggestions || []);
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [filters, toast]);

  useEffect(() => {
    Promise.all([api("/classes/").then(listOf), api("/students/").then(listOf)])
      .then(([classRows, studentRows]) => { setClasses(classRows); setStudents(studentRows); })
      .catch((error) => toast(error.message, "danger"));
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const saveTask = async (payload) => {
    if (taskForm?.id) await api(`/tasks/${taskForm.id}/`, { method: "PATCH", body: payload });
    else await api("/tasks/", { method: "POST", body: payload });
    toast(t("حُفظت المهمة الإجرائية")); await load();
  };

  const patchTask = async (task, patch) => {
    try { await api(`/tasks/${task.id}/`, { method: "PATCH", body: patch }); await load(); }
    catch (error) { toast(error.message, "danger"); }
  };

  const toggleComplete = async (task) => {
    try {
      await api(`/tasks/${task.id}/${task.status === "done" ? "reopen" : "complete"}/`, { method: "POST", body: {} });
      toast(task.status === "done" ? t("أُعيد فتح المهمة") : t("أُنجزت المهمة"));
      await load();
    } catch (error) { toast(error.message, "danger"); }
  };

  const acceptSuggestion = async (suggestion) => {
    setBusy(suggestion.key);
    try {
      await api("/tasks/accept-suggestion/", { method: "POST", body: suggestion });
      toast(t("أُضيف الاقتراح إلى مهامك")); await load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const acceptAllSuggestions = async () => {
    setBusy("all");
    try {
      const result = await api("/tasks/generate-suggestions/", { method: "POST", body: {} });
      toast(`${t("أُضيفت")} ${result.created} ${t("مهام ذكية")} • ${result.existing} ${t("موجودة سابقًا")}`);
      await load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const generatePlan = async () => {
    setBusy("plan");
    try {
      const doc = await api("/tasks/generate-document/", { method: "POST", body: { only_open: true } });
      toast(t("وُلّدت خطة عمل الأستاذ")); navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const grouped = useMemo(() => {
    const groups = { overdue: [], today: [], week: [], later: [], nodate: [], closed: [] };
    tasks.forEach((task) => groups[bucketOf(task)].push(task));
    return groups;
  }, [tasks]);
  const groupLabels = { overdue: "متأخرة", today: "تستحق اليوم", week: "هذا الأسبوع", later: "قادمة", nodate: "بدون أجل", closed: "منجزة أو مغلقة" };
  const newSuggestions = suggestions.filter((row) => !row.already_added);

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز إجراءات الأستاذ والتنبيهات الذكية")}</h3>
          <p className="text-secondary mb-0">{t("كل ما يحتاج تصرفًا في مكان واحد: خطط دعم، مهام متأخرة، متابعات أولياء، حضور غير مسجل، تحضير دروس وأحداث قريبة.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-light rounded-pill" disabled={busy === "plan" || !(summary?.open)} onClick={generatePlan}>{busy === "plan" ? <span className="spinner-border spinner-border-sm" /> : t("خطة عمل قابلة للتحرير")}</button>
          <button className="btn btn-primary rounded-pill" onClick={() => setTaskForm({})}><Icon name="plus" size={17} /> {t("مهمة جديدة")}</button>
        </div>
      </div>

      <div className="row g-3 mb-3">
        {[[summary?.open || 0, "مهمة مفتوحة"], [summary?.overdue || 0, "مهمة متأخرة"], [summary?.today || 0, "تستحق اليوم"], [summary?.this_week || 0, "هذا الأسبوع"], [summary?.high_priority || 0, "أولوية عالية"], [`${summary?.completion_rate || 0}٪`, "نسبة إنجاز المهام"]].map(([value, label]) => <div className="col-6 col-md-4 col-xl-2" key={label}><div className="stat-mini action-stat"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>)}
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className={`btn btn-sm rounded-pill ${tab === "tasks" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("tasks")}>{t("مهامي")} ({summary?.open || 0})</button>
        <button className={`btn btn-sm rounded-pill ${tab === "suggestions" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("suggestions")}>{t("اقتراحات ذكية")} ({newSuggestions.length})</button>
        {tab === "suggestions" && <button className="btn btn-sm btn-dark rounded-pill ms-auto" disabled={!newSuggestions.length || busy === "all"} onClick={acceptAllSuggestions}>{busy === "all" ? <span className="spinner-border spinner-border-sm" /> : t("إضافة كل الاقتراحات الجديدة")}</button>}
      </div>

      {tab === "tasks" && (
        <>
          <div className="card border-0 shadow-sm mb-3"><div className="card-body py-3">
            <div className="d-flex flex-wrap gap-2">
              <input className="form-control action-search" placeholder={t("بحث في المهام والتلاميذ…")} value={filters.q} onChange={(e) => setFilters((x) => ({ ...x, q: e.target.value }))} />
              <select className="form-select w-auto" value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}><option value="">{t("كل الحالات")}</option>{STATUSES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select>
              <select className="form-select w-auto" value={filters.category} onChange={(e) => setFilters((x) => ({ ...x, category: e.target.value }))}><option value="">{t("كل الأصناف")}</option>{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select>
              <select className="form-select w-auto" value={filters.priority} onChange={(e) => setFilters((x) => ({ ...x, priority: e.target.value }))}><option value="">{t("كل الأولويات")}</option>{PRIORITIES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select>
              <select className="form-select w-auto" value={filters.due} onChange={(e) => setFilters((x) => ({ ...x, due: e.target.value }))}><option value="">{t("كل الآجال")}</option><option value="overdue">{t("متأخرة")}</option><option value="today">{t("اليوم")}</option><option value="week">{t("هذا الأسبوع")}</option><option value="none">{t("بدون أجل")}</option></select>
              <button className="btn btn-light rounded-pill" onClick={() => setFilters({ q: "", status: "", category: "", priority: "", due: "" })}>{t("إعادة تعيين")}</button>
            </div>
          </div></div>

          {loading && !tasks.length ? <Spinner /> : tasks.length === 0 ? <EmptyState title={t("لا مهام مطابقة")} hint={t("أنشئ مهمة يدوية أو اقبل اقتراحات ذكية من تبويب الاقتراحات.")} actionLabel={t("مهمة جديدة")} onAction={() => setTaskForm({})} /> : Object.entries(grouped).map(([bucket, rows]) => rows.length ? (
            <section key={bucket} className="mb-4">
              <h6 className="fw-bold mb-2">{t(groupLabels[bucket])} <span className="text-secondary">({rows.length})</span></h6>
              {rows.map((task) => (
                <article className={`card border-0 shadow-sm action-card ${task.status === "done" ? "done" : ""}`} key={task.id}>
                  <div className="card-body">
                    <div className="d-flex gap-3 align-items-start">
                      <input className="form-check-input action-check" type="checkbox" checked={task.status === "done"} onChange={() => toggleComplete(task)} aria-label={t("إنجاز المهمة")} />
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <h6 className="fw-bold mb-0">{task.title}</h6>
                          <span className="badge text-bg-light border">{te(labelOf(CATEGORIES, task.category))}</span>
                          <span className={`badge ${priorityBadge(task.priority)}`}>{te(labelOf(PRIORITIES, task.priority))}</span>
                          <span className={`badge ${statusBadge(task.status)}`}>{te(labelOf(STATUSES, task.status))}</span>
                          {dueInfo(task, t)}
                          {task.origin === "auto" && <span className="badge text-bg-info">{t("اقتراح ذكي")}</span>}
                        </div>
                        {task.description && <p className="text-secondary mb-2 mt-2 action-description">{task.description}</p>}
                        <div className="small text-secondary">{task.student_name || task.class_name || t("بدون ارتباط محدد")}{task.due_date ? ` • ${t("الأجل")} ${task.due_date}` : ""}</div>
                      </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(task.route)}>{t("فتح المصدر")}</button>
                      <select className="form-select form-select-sm w-auto" value={task.status} onChange={(e) => patchTask(task, { status: e.target.value })}>{STATUSES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select>
                      <span className="flex-grow-1" />
                      <button className="btn btn-sm btn-light rounded-pill" onClick={() => setTaskForm(task)}>{t("تعديل")}</button>
                      <button className="btn btn-sm btn-light rounded-pill text-danger" onClick={() => setConfirmDelete(task)}>{t("حذف")}</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : null)}
        </>
      )}

      {tab === "suggestions" && (
        loading && !suggestions.length ? <Spinner /> : suggestions.length === 0 ? <EmptyState title={t("لا اقتراحات حاليًا")} hint={t("لا توجد آجال قريبة أو مؤشرات تحتاج إجراءً فوريًا.")} /> : (
          <div className="row g-3">
            {suggestions.map((suggestion) => (
              <div className="col-12 col-xl-6" key={suggestion.key}>
                <article className={`card border-0 shadow-sm h-100 suggestion-card ${suggestion.already_added ? "added" : ""}`}>
                  <div className="card-body">
                    <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                      <span className="badge text-bg-light border">{te(suggestion.category_label)}</span>
                      <span className={`badge ${priorityBadge(suggestion.priority)}`}>{te(suggestion.priority_label)}</span>
                      {suggestion.due_date && <span className="badge text-bg-warning">{suggestion.due_date}</span>}
                      {suggestion.already_added && <span className="badge text-bg-success">{t("أُضيف سابقًا")}</span>}
                    </div>
                    <h6 className="fw-bold">{suggestion.title}</h6>
                    <p className="text-secondary action-description">{suggestion.description}</p>
                    <div className="suggestion-reason">{suggestion.reason}</div>
                    <div className="small text-secondary mt-2">{suggestion.student_name || suggestion.class_name || ""}</div>
                    <button className="btn btn-primary btn-sm rounded-pill mt-3" disabled={suggestion.already_added || busy === suggestion.key} onClick={() => acceptSuggestion(suggestion)}>{busy === suggestion.key ? <span className="spinner-border spinner-border-sm" /> : suggestion.already_added ? t("موجود في مهامي") : t("إضافة إلى مهامي")}</button>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )
      )}

      {taskForm && <TaskForm initial={taskForm.id ? taskForm : null} classes={classes} students={students} onSubmit={saveTask} onClose={() => setTaskForm(null)} />}
      {confirmDelete && <ConfirmModal title={t("حذف المهمة الإجرائية")} body={`${t("ستُحذف المهمة")} «${confirmDelete.title}».`} onConfirm={async () => { await api(`/tasks/${confirmDelete.id}/`, { method: "DELETE" }); toast(t("حُذفت المهمة")); await load(); }} onClose={() => setConfirmDelete(null)} />}
    </>
  );
}
