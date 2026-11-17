import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf } from "../api";
import { Spinner, EmptyState } from "../components/States";
import FilterBar from "../components/FilterBar";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const CATEGORIES = [["academic", "دعم دراسي"], ["attendance", "متابعة الحضور"], ["homework", "متابعة الواجبات"], ["behaviour", "السلوك والانضباط"], ["mixed", "دعم شامل"], ["other", "أخرى"]];
const PRIORITIES = [["low", "منخفضة"], ["medium", "متوسطة"], ["high", "عالية"]];
const STATUSES = [["planned", "مخططة"], ["active", "جارية"], ["monitoring", "قيد المراقبة"], ["completed", "مكتملة"], ["cancelled", "ملغاة"]];
const CHANNELS = [["letter", "رسالة مكتوبة"], ["phone", "مكالمة هاتفية"], ["meeting", "لقاء"], ["message", "رسالة قصيرة / تطبيق"], ["other", "أخرى"]];
const labelOf = (rows, key) => rows.find(([k]) => k === key)?.[1] || key;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const priorityClass = (p) => p === "high" ? "text-bg-danger" : p === "medium" ? "text-bg-warning" : "text-bg-success";
const riskClass = (level) => level === "high" ? "text-bg-danger" : level === "medium" ? "text-bg-warning" : "text-bg-success";

function PlanForm({ initial, students, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [form, setForm] = useState({
    student: initial?.student ? String(initial.student) : (students[0] ? String(students[0].id) : ""),
    title: initial?.title || "",
    category: initial?.category || "academic",
    priority: initial?.priority || "medium",
    status: initial?.status || "planned",
    reason: initial?.reason || "",
    actionsText: (initial?.actions || []).map((a) => a.text || "").join("\n"),
    start_date: initial?.start_date || today(),
    due_date: initial?.due_date || "",
    teacher_notes: initial?.teacher_notes || "",
    outcome: initial?.outcome || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const old = initial?.actions || [];
    try {
      await onSubmit({
        student: Number(form.student), title: form.title.trim(), category: form.category, priority: form.priority,
        status: form.status, reason: form.reason,
        actions: form.actionsText.split("\n").map((line) => line.trim()).filter(Boolean).map((text, i) => {
          const prev = old.find((a) => a.text === text) || old[i] || {};
          return { text, done: !!prev.done, due: prev.due || "" };
        }),
        start_date: form.start_date || null, due_date: form.due_date || null,
        teacher_notes: form.teacher_notes, outcome: form.outcome,
      });
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <ModalShell title={initial?.id ? t("تعديل خطة الدعم") : t("خطة دعم جديدة")} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12 col-md-4"><label className="form-label small fw-semibold">{t("التلميذ")} *</label><select className="form-select" required value={form.student} onChange={(e) => set("student", e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></div>
          <div className="col-12 col-md-8"><label className="form-label small fw-semibold">{t("عنوان الخطة")} *</label><input className="form-control" required value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("صنف الدعم")}</label><select className="form-select" value={form.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{te(l)}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الأولوية")}</label><select className="form-select" value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("حالة الخطة")}</label><select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{te(l)}</option>)}</select></div>
          <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الأجل")}</label><input type="date" className="form-control" value={form.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("سبب وضع الخطة")}</label><textarea className="form-control" rows={3} value={form.reason} onChange={(e) => set("reason", e.target.value)} /></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("إجراءات الدعم — إجراء في كل سطر")}</label><textarea className="form-control" rows={5} value={form.actionsText} onChange={(e) => set("actionsText", e.target.value)} placeholder={t("اتصال بالولي، مراجعة أسبوعية، واجبات قصيرة متدرجة…")} /></div>
          <div className="col-12 col-md-6"><label className="form-label small fw-semibold">{t("ملاحظات الأستاذ")}</label><textarea className="form-control" rows={3} value={form.teacher_notes} onChange={(e) => set("teacher_notes", e.target.value)} /></div>
          <div className="col-12 col-md-6"><label className="form-label small fw-semibold">{t("النتيجة عند الإغلاق")}</label><textarea className="form-control" rows={3} value={form.outcome} onChange={(e) => set("outcome", e.target.value)} /></div>
        </div>
        <div className="d-flex gap-2 mt-4"><button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ الخطة")}</button><button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button></div>
      </form>
    </ModalShell>
  );
}

export default function SupportPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [clsId, setClsId] = useState("");
  const [tab, setTab] = useState("risk");
  const [risk, setRisk] = useState(null);
  const [plans, setPlans] = useState([]);
  const [comms, setComms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planForm, setPlanForm] = useState(null);
  const [confirmPlan, setConfirmPlan] = useState(null);
  const [confirmComm, setConfirmComm] = useState(null);
  const [f, setF] = useState({ q: "", status: "", priority: "", category: "" });
  const [commForm, setCommForm] = useState({ id: null, student: "", date: today(), channel: "letter", support_plan: "", subject: "", summary: "", outcome: "", follow_up_date: "" });

  const loadStudents = useCallback(async () => {
    if (!clsId) return;
    const rows = listOf(await api(`/students/?class=${clsId}`)); setStudents(rows);
  }, [clsId]);

  const loadAll = useCallback(async () => {
    if (!clsId) return;
    setLoading(true);
    try {
      const [r, p, c] = await Promise.all([
        api(`/support-plans/risk-overview/?class=${clsId}`),
        api(`/support-plans/?class=${clsId}`).then(listOf),
        api(`/parent-communications/?class=${clsId}`).then(listOf),
      ]);
      setRisk(r); setPlans(p); setComms(c);
    } catch (e) { toast(e.message, "danger"); }
    setLoading(false);
  }, [clsId, toast]);

  useEffect(() => { api("/classes/").then(listOf).then((rows) => { setClasses(rows); if (rows[0]) setClsId(String(rows[0].id)); }).catch(() => {}); }, []);
  useEffect(() => { loadStudents().catch(() => {}); loadAll(); }, [loadStudents, loadAll]);

  const shownPlans = useMemo(() => plans.filter((p) => (!f.q.trim() || p.title.includes(f.q.trim()) || p.student_name.includes(f.q.trim()) || (p.reason || "").includes(f.q.trim()))
    && (!f.status || p.status === f.status) && (!f.priority || p.priority === f.priority) && (!f.category || p.category === f.category)), [plans, f]);

  const openRiskPlan = (row) => setPlanForm({
    student: row.student_id, title: `${t("خطة دعم")} — ${row.student_name}`, category: "mixed",
    priority: row.risk_level === "high" ? "high" : "medium", status: "planned",
    reason: row.reasons.join("؛ "), actions: [
      { text: "لقاء أو اتصال بولي التلميذ لمناقشة الخطة", done: false, due: "" },
      { text: "متابعة أسبوعية للمؤشرات المعنية وتسجيل التقدم", done: false, due: "" },
      { text: "مراجعة الخطة بعد أسبوعين وتعديل الإجراءات", done: false, due: "" },
    ], start_date: today(), due_date: "", teacher_notes: "", outcome: "",
  });

  const savePlan = async (payload) => {
    if (planForm?.id) await api(`/support-plans/${planForm.id}/`, { method: "PATCH", body: payload });
    else await api("/support-plans/", { method: "POST", body: payload });
    toast(t("حُفظت خطة الدعم")); await loadAll();
  };

  const patchPlan = async (plan, patch) => {
    try { await api(`/support-plans/${plan.id}/`, { method: "PATCH", body: patch }); await loadAll(); }
    catch (e) { toast(e.message, "danger"); }
  };

  const generate = async (plan, type) => {
    try {
      const r = await api(`/support-plans/${plan.id}/generate-document/`, { method: "POST", body: { type } });
      toast(type === "letter" ? t("وُلّدت رسالة الولي وسُجّل التواصل") : t("وُلّدت وثيقة خطة الدعم"));
      await loadAll(); navigate(`/editor/${r.document.id}`);
    } catch (e) { toast(e.message, "danger"); }
  };

  const saveComm = async () => {
    if (!commForm.student || !commForm.subject.trim()) { toast(t("اختر التلميذ واكتب موضوع التواصل"), "warning"); return; }
    const payload = { student: Number(commForm.student), date: commForm.date, channel: commForm.channel,
      support_plan: commForm.support_plan ? Number(commForm.support_plan) : null, subject: commForm.subject,
      summary: commForm.summary, outcome: commForm.outcome, follow_up_date: commForm.follow_up_date || null };
    try {
      if (commForm.id) await api(`/parent-communications/${commForm.id}/`, { method: "PATCH", body: payload });
      else await api("/parent-communications/", { method: "POST", body: payload });
      setCommForm({ id: null, student: "", date: today(), channel: "letter", support_plan: "", subject: "", summary: "", outcome: "", follow_up_date: "" });
      toast(t("حُفظ سجل التواصل")); await loadAll();
    } catch (e) { toast(e.message, "danger"); }
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div><h3 className="fw-bold mb-1">{t("مركز الدعم والتدخل وتواصل الأولياء")}</h3><p className="text-secondary mb-0">{t("محرك مخاطر يجمع المعدلات والحضور والواجبات والسلوك، ثم يحوّل التنبيهات إلى خطط دعم ورسائل أولياء وسجل تواصل قابل للتتبع.")}</p></div>
        <button className="btn btn-primary rounded-pill px-4" disabled={!students.length} onClick={() => setPlanForm({})}>+ {t("خطة دعم جديدة")}</button>
      </div>

      <div className="card border-0 shadow-sm mb-3"><div className="card-body d-flex flex-wrap gap-2 align-items-center">
        <span className="fw-bold small">{t("الفوج")}</span>
        {classes.map((c) => <button key={c.id} className={`btn btn-sm rounded-pill ${String(c.id) === clsId ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setClsId(String(c.id))}>{c.name}</button>)}
        <span className="ms-auto d-flex gap-2">
          <button className={`btn btn-sm rounded-pill ${tab === "risk" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("risk")}>{t("محرك المخاطر")}</button>
          <button className={`btn btn-sm rounded-pill ${tab === "plans" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("plans")}>{t("خطط الدعم")} ({plans.length})</button>
          <button className={`btn btn-sm rounded-pill ${tab === "comms" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("comms")}>{t("تواصل الأولياء")} ({comms.length})</button>
        </span>
      </div></div>

      {loading && !risk ? <Spinner /> : tab === "risk" ? (
        <>
          <div className="row g-3 mb-3">
            {[[risk?.students_at_risk || 0, "تلميذ يحتاج انتباهًا"], [risk?.high || 0, "مخاطرة عالية"], [risk?.medium || 0, "مخاطرة متوسطة"], [plans.filter((p) => !["completed", "cancelled"].includes(p.status)).length, "خطط مفتوحة"]].map(([v, l]) => <div className="col-6 col-md-3" key={l}><div className="stat-mini"><div className="stat-mini-num">{v}</div><div className="stat-mini-label">{t(l)}</div></div></div>)}
          </div>
          {!risk?.students?.length ? <EmptyState icon="" title={t("لا تنبيهات حالية")} hint={t("ستظهر هنا التنبيهات عند تسجيل نقاط منخفضة أو غيابات متكررة أو متوسطات متابعة ضعيفة.")} /> : (
            <div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table align-middle mb-0 follow-table">
              <thead><tr><th>{t("التلميذ")}</th><th>{t("درجة المخاطرة")}</th><th>{t("المعدل السنوي")}</th><th>{t("الحضور")}</th><th>{t("أسباب التنبيه")}</th><th>{t("خطط مفتوحة")}</th><th></th></tr></thead>
              <tbody>{risk.students.map((r) => <tr key={r.student_id}><td className="fw-bold"><button type="button" className="student-profile-link" onClick={() => navigate(`/students/${r.student_id}`)}>{r.student_name}</button></td><td><span className={`badge rounded-pill ${riskClass(r.risk_level)}`}>{r.risk_score}/100</span></td><td>{r.annual_average ?? "—"}</td><td>{r.attendance_rate == null ? "—" : `${r.attendance_rate}٪`} <span className="text-secondary">({r.attendance_counts.absent} {t("غياب")})</span></td><td><div className="risk-reasons">{r.reasons.map((x, i) => <span key={i}>{x}</span>)}</div></td><td>{r.open_plans}</td><td><button className="btn btn-sm btn-primary rounded-pill text-nowrap" onClick={() => openRiskPlan(r)}>+ {t("إنشاء خطة")}</button></td></tr>)}</tbody>
            </table></div></div>
          )}
        </>
      ) : tab === "plans" ? (
        <>
          <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shownPlans.length} onReset={() => setF({ q: "", status: "", priority: "", category: "" })}>
            <select className="form-select" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}><option value="">{t("كل الحالات")}</option>{STATUSES.map(([k, l]) => <option key={k} value={k}>{te(l)}</option>)}</select>
            <select className="form-select" value={f.priority} onChange={(e) => setF((x) => ({ ...x, priority: e.target.value }))}><option value="">{t("كل الأولويات")}</option>{PRIORITIES.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
            <select className="form-select" value={f.category} onChange={(e) => setF((x) => ({ ...x, category: e.target.value }))}><option value="">{t("كل الأصناف")}</option>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{te(l)}</option>)}</select>
          </FilterBar>
          {!shownPlans.length ? <EmptyState icon="" title={t("لا خطط دعم مطابقة")} hint={t("أنشئ خطة من محرك المخاطر أو بزر خطة دعم جديدة.")} /> : <div className="row g-3">{shownPlans.map((p) => (
            <div className="col-12 col-xl-6" key={p.id}><div className="card border-0 shadow-sm h-100 support-card"><div className="card-body d-flex flex-column">
              <div className="d-flex flex-wrap gap-2 align-items-center mb-2"><span className="badge rounded-pill text-bg-primary">{te(labelOf(CATEGORIES, p.category))}</span><span className={`badge rounded-pill ${priorityClass(p.priority)}`}>{t(labelOf(PRIORITIES, p.priority))}</span><span className="badge rounded-pill text-bg-light border">{p.student_name}</span><span className="ms-auto small text-secondary">{p.due_date ? `${t("الأجل")}: ${p.due_date}` : ""}</span></div>
              <h6 className="fw-bold">{p.title}</h6>
              {p.reason && <p className="text-secondary small">{p.reason}</p>}
              <div className="d-flex align-items-center gap-2 mb-2"><div className="progress flex-grow-1 support-progress"><div className="progress-bar" style={{ width: `${p.progress_percent}%` }} /></div><b>{p.progress_percent}٪</b></div>
              <div className="support-actions-list">{(p.actions || []).map((a, i) => <label key={i} className="form-check"><input className="form-check-input" type="checkbox" checked={!!a.done} onChange={(e) => patchPlan(p, { actions: p.actions.map((x, j) => j === i ? { ...x, done: e.target.checked } : x) })} /><span className={a.done ? "done" : ""}>{a.text}</span></label>)}</div>
              <div className="d-flex flex-wrap gap-2 mt-auto pt-3">
                <select className="form-select form-select-sm" style={{ width: 145 }} value={p.status} onChange={(e) => patchPlan(p, { status: e.target.value })}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{te(l)}</option>)}</select>
                <button className="btn btn-sm btn-primary rounded-pill" onClick={() => setPlanForm(p)}>{t("تحرير")}</button>
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => generate(p, "plan")}>{t("وثيقة الخطة")}</button>
                <button className="btn btn-sm btn-outline-dark rounded-pill" onClick={() => generate(p, "letter")}>{t("رسالة ولي")}</button>
                <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirmPlan(p)}>{t("حذف")}</button>
              </div>
            </div></div></div>))}
          </div>}
        </>
      ) : (
        <>
          <div className="card border-0 shadow-sm mb-3"><div className="card-body">
            <h6 className="fw-bold">{commForm.id ? t("تعديل سجل تواصل") : t("تسجيل تواصل جديد")}</h6>
            <div className="row g-2 align-items-end">
              <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("التلميذ")}</label><select className="form-select" value={commForm.student} onChange={(e) => setCommForm((x) => ({ ...x, student: e.target.value, support_plan: "" }))}><option value="">{t("اختر…")}</option>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></div>
              <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("التاريخ")}</label><input type="date" className="form-control" value={commForm.date} onChange={(e) => setCommForm((x) => ({ ...x, date: e.target.value }))} /></div>
              <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("القناة")}</label><select className="form-select" value={commForm.channel} onChange={(e) => setCommForm((x) => ({ ...x, channel: e.target.value }))}>{CHANNELS.map(([k, l]) => <option key={k} value={k}>{te(l)}</option>)}</select></div>
              <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("خطة مرتبطة")}</label><select className="form-select" value={commForm.support_plan} onChange={(e) => setCommForm((x) => ({ ...x, support_plan: e.target.value }))}><option value="">{t("بدون خطة")}</option>{plans.filter((p) => !commForm.student || String(p.student) === String(commForm.student)).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
              <div className="col-12 col-md-4"><label className="form-label small fw-semibold">{t("الموضوع")}</label><input className="form-control" value={commForm.subject} onChange={(e) => setCommForm((x) => ({ ...x, subject: e.target.value }))} /></div>
              <div className="col-12 col-md-5"><label className="form-label small fw-semibold">{t("ملخص التواصل")}</label><input className="form-control" value={commForm.summary} onChange={(e) => setCommForm((x) => ({ ...x, summary: e.target.value }))} /></div>
              <div className="col-12 col-md-4"><label className="form-label small fw-semibold">{t("النتيجة / الاتفاق")}</label><input className="form-control" value={commForm.outcome} onChange={(e) => setCommForm((x) => ({ ...x, outcome: e.target.value }))} /></div>
              <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("متابعة لاحقة")}</label><input type="date" className="form-control" value={commForm.follow_up_date} onChange={(e) => setCommForm((x) => ({ ...x, follow_up_date: e.target.value }))} /></div>
              <div className="col-6 col-md-1"><button className="btn btn-dark rounded-pill w-100" onClick={saveComm}>{commForm.id ? t("حفظ") : t("إضافة")}</button></div>
            </div>
          </div></div>
          {!comms.length ? <EmptyState icon="" title={t("لا سجلات تواصل بعد")} hint={t("وثّق المكالمات واللقاءات والرسائل لتتبع تعاون الأولياء ونتائجه.")} /> : <div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table align-middle mb-0 follow-table"><thead><tr><th>{t("التاريخ")}</th><th>{t("التلميذ")}</th><th>{t("القناة")}</th><th>{t("الموضوع")}</th><th>{t("النتيجة")}</th><th>{t("متابعة")}</th><th></th></tr></thead><tbody>{comms.map((c) => <tr key={c.id}><td>{c.date}</td><td className="fw-bold">{c.student_name}</td><td>{te(labelOf(CHANNELS, c.channel))}</td><td>{c.subject}<div className="small text-secondary">{c.summary}</div></td><td>{c.outcome || "—"}</td><td>{c.follow_up_date || "—"}</td><td><div className="d-flex gap-1"><button className="btn btn-sm btn-light rounded-pill" onClick={() => setCommForm({ id: c.id, student: String(c.student), date: c.date, channel: c.channel, support_plan: c.support_plan ? String(c.support_plan) : "", subject: c.subject, summary: c.summary || "", outcome: c.outcome || "", follow_up_date: c.follow_up_date || "" })}>{t("تحرير")}</button><button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirmComm(c)}>{t("حذف")}</button></div></td></tr>)}</tbody></table></div></div>}
        </>
      )}

      {planForm && <PlanForm initial={planForm.id ? planForm : Object.keys(planForm).length ? planForm : null} students={students} onClose={() => setPlanForm(null)} onSubmit={savePlan} />}
      {confirmPlan && <ConfirmModal title={t("حذف خطة الدعم")} body={`${t("ستُحذف خطة")} «${confirmPlan.title}» ${t("نهائيًا.")}`} onConfirm={async () => { await api(`/support-plans/${confirmPlan.id}/`, { method: "DELETE" }); await loadAll(); }} onClose={() => setConfirmPlan(null)} />}
      {confirmComm && <ConfirmModal title={t("حذف سجل التواصل")} body={`${t("سيُحذف سجل")} «${confirmComm.subject}» ${t("نهائيًا.")}`} onConfirm={async () => { await api(`/parent-communications/${confirmComm.id}/`, { method: "DELETE" }); await loadAll(); }} onClose={() => setConfirmComm(null)} />}
    </>
  );
}
