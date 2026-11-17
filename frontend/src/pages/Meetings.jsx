import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TYPES = [["class_council", "مجلس قسم"], ["coordination", "اجتماع تنسيق"], ["parents", "لقاء أولياء"], ["administration", "اجتماع إداري"], ["other", "أخرى"]];
const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function MeetingForm({ initial, classes, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title || "",
    meeting_type: initial?.meeting_type || "class_council",
    school_class: initial?.school_class ? String(initial.school_class) : "",
    date: initial?.date || todayISO(),
    term: initial?.term ? String(initial.term) : "",
    agenda: initial?.agenda || "",
    attendees: (initial?.attendees || []).join("، "),
    notes: initial?.notes || "",
  });
  const [decisions, setDecisions] = useState((initial?.decisions || []).map((d) => ({ text: d.text || "", responsible: d.responsible || "", due: d.due || "", done: !!d.done, task_id: d.task_id || null })));
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setDecision = (index, key, value) => setDecisions((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));

  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await onSubmit({
        title: form.title.trim(),
        meeting_type: form.meeting_type,
        school_class: form.school_class ? Number(form.school_class) : null,
        date: form.date,
        term: form.term ? Number(form.term) : null,
        agenda: form.agenda,
        attendees: form.attendees.split(/[،,]/).map((x) => x.trim()).filter(Boolean),
        decisions: decisions.filter((row) => row.text.trim()),
        notes: form.notes,
      });
      onClose();
    } catch { setBusy(false); }
  };

  return (
    <ModalShell title={initial?.id ? t("تعديل الاجتماع") : t("اجتماع جديد")} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12 col-md-8"><label className="form-label small fw-semibold">{t("عنوان الاجتماع")} *</label><input className="form-control" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("مثال: مجلس قسم الثلاثي الأول")} /></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("التاريخ")}</label><input type="date" className="form-control" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("نوع الاجتماع")}</label><select className="form-select" value={form.meeting_type} onChange={(e) => set("meeting_type", e.target.value)}>{TYPES.map(([key, label]) => <option key={key} value={key}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("الفوج")}</label><select className="form-select" value={form.school_class} onChange={(e) => set("school_class", e.target.value)}><option value="">{t("بدون فوج محدد")}</option>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("الثلاثي")}</label><select className="form-select" value={form.term} onChange={(e) => set("term", e.target.value)}><option value="">—</option>{TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("الحاضرون (افصلوا بفاصلة)")}</label><input className="form-control" value={form.attendees} onChange={(e) => set("attendees", e.target.value)} placeholder={t("الأستاذ، مستشار التوجيه، إدارة المؤسسة…")} /></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("جدول الأعمال")}</label><textarea className="form-control" rows={4} value={form.agenda} onChange={(e) => set("agenda", e.target.value)} /></div>
        </div>

        <h6 className="fw-bold mt-4 mb-2">{t("القرارات والإجراءات")}</h6>
        {decisions.map((row, index) => (
          <div key={index} className="row g-2 align-items-center mb-2">
            <div className="col-12 col-md-6"><input className="form-control" placeholder={t("نص القرار أو الإجراء")} value={row.text} onChange={(e) => setDecision(index, "text", e.target.value)} /></div>
            <div className="col-6 col-md-3"><input className="form-control" placeholder={t("المسؤول")} value={row.responsible} onChange={(e) => setDecision(index, "responsible", e.target.value)} /></div>
            <div className="col-6 col-md-2"><input type="date" className="form-control" value={row.due || ""} onChange={(e) => setDecision(index, "due", e.target.value)} /></div>
            <div className="col-12 col-md-1 d-flex gap-2 align-items-center">
              <input type="checkbox" className="form-check-input" checked={row.done} onChange={(e) => setDecision(index, "done", e.target.checked)} title={t("أُنجز")} />
              <button type="button" className="btn btn-sm btn-light text-danger" onClick={() => setDecisions((c) => c.filter((_, i) => i !== index))}>×</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-light rounded-pill" onClick={() => setDecisions((c) => [...c, { text: "", responsible: "", due: "", done: false, task_id: null }])}><Icon name="plus" size={14} /> {t("إضافة قرار")}</button>

        <div className="mt-3"><label className="form-label small fw-semibold">{t("ملاحظات إضافية")}</label><textarea className="form-control" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ الاجتماع")}</button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function MeetingsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [meetings, setMeetings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [briefClass, setBriefClass] = useState(null);
  const [briefTerm, setBriefTerm] = useState(1);
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setMeetings(await api("/meetings/").then(listOf)); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    api("/classes/").then(listOf).then((rows) => { setClasses(rows); setBriefClass((c) => c ?? rows[0]?.id ?? null); }).catch((e) => toast(e.message, "danger"));
    load();
  }, [load, toast]);

  useEffect(() => {
    if (!briefClass) return;
    api(`/meetings/council-brief/${briefClass}/?term=${briefTerm}`).then(setBrief).catch((e) => toast(e.message, "danger"));
  }, [briefClass, briefTerm, toast]);

  const save = async (payload) => {
    if (form?.id) await api(`/meetings/${form.id}/`, { method: "PATCH", body: payload });
    else await api("/meetings/", { method: "POST", body: payload });
    toast(t("حُفظ الاجتماع"));
    await load();
  };

  const createCouncil = async () => {
    if (!brief) return;
    setBusy("council");
    try {
      const meeting = await api("/meetings/", { method: "POST", body: {
        school_class: brief.class.id, date: todayISO(), meeting_type: "class_council", term: briefTerm,
        title: `${t("مجلس قسم")} ${brief.term_label} — ${brief.class.name}`,
        agenda: brief.suggested_agenda.map((line, i) => `${i + 1}. ${line}`).join("\n"),
        attendees: [], decisions: brief.suggested_decisions, notes: "",
      } });
      toast(t("أُنشئ اجتماع مجلس القسم بالاقتراحات"));
      await load();
      setForm(meeting);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const toggleDecision = async (meeting, index) => {
    const decisions = meeting.decisions.map((row, i) => i === index ? { ...row, done: !row.done } : row);
    try {
      const updated = await api(`/meetings/${meeting.id}/`, { method: "PATCH", body: { decisions } });
      setMeetings((current) => current.map((row) => row.id === updated.id ? updated : row));
    } catch (error) { toast(error.message, "danger"); }
  };

  const generateMinutes = async (meeting) => {
    setBusy(`min-${meeting.id}`);
    try {
      const data = await api(`/meetings/${meeting.id}/generate-minutes/`, { method: "POST", body: {} });
      toast(t("وُلّد محضر الاجتماع"));
      navigate(`/editor/${data.document.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const pushDecisions = async (meeting) => {
    setBusy(`push-${meeting.id}`);
    try {
      const data = await api(`/meetings/${meeting.id}/push-decisions/`, { method: "POST", body: {} });
      toast(data.created_count ? `${t("أُضيفت")} ${data.created_count} ${t("قرارات إلى مركز الإجراءات")}` : t("لا قرارات جديدة لدفعها"));
      setMeetings((current) => current.map((row) => row.id === data.meeting.id ? data.meeting : row));
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز مجالس الأقسام والاجتماعات")}</h3>
          <p className="text-secondary mb-0">{t("حضّروا مجالس الأقسام من تحليلات الفوج مباشرة، وثّقوا القرارات وتابعوا تنفيذها، وحوّلوها إلى مهام في مركز الإجراءات، وولّدوا محاضر جاهزة للطباعة.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill" onClick={() => setForm({})}><Icon name="plus" size={16} /> {t("اجتماع جديد")}</button>
      </div>

      {brief && (
        <div className="card border-0 shadow-sm mb-4"><div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h6 className="fw-bold mb-0">{t("تحضير مجلس قسم")}</h6>
            <div className="d-flex gap-2">
              <select className="form-select w-auto" value={briefClass || ""} onChange={(e) => setBriefClass(Number(e.target.value))}>
                {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
              <select className="form-select w-auto" value={briefTerm} onChange={(e) => setBriefTerm(Number(e.target.value))}>
                {TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}
              </select>
            </div>
          </div>
          <div className="row g-3 mb-3">
            {[[brief.summary.term_average ?? "—", "معدل الثلاثي"], [brief.summary.success_rate != null ? `${brief.summary.success_rate}٪` : "—", "نسبة النجاح"], [brief.summary.attendance_rate != null ? `${brief.summary.attendance_rate}٪` : "—", "الحضور"], [`${brief.summary.assignment_completion}٪`, "تسليم المهام"], [brief.summary.health_score ?? "—", "صحة الفوج"], [`${brief.summary.curriculum_percent}٪`, "تقدم المقرر"]].map(([value, label]) => (
              <div className="col-6 col-md-4 col-xl-2" key={label}><div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>
            ))}
          </div>
          <div className="row g-3">
            <div className="col-12 col-xl-6">
              <h6 className="fw-semibold">{t("جدول أعمال مقترح")}</h6>
              <ol className="small text-secondary">{brief.suggested_agenda.map((line, i) => <li key={i} className="mb-1">{line}</li>)}</ol>
            </div>
            <div className="col-12 col-xl-6">
              <h6 className="fw-semibold">{t("قرارات مقترحة")}</h6>
              {brief.suggested_decisions.map((row, i) => <div key={i} className="small text-secondary mb-1">• {row.text}</div>)}
              {!!brief.needs_support.length && <div className="small text-secondary mt-2">{t("حالات تُناقش")}: {brief.needs_support.map((row) => `${row.student_name} (${row.risk_score}/100)`).join("، ")}</div>}
            </div>
          </div>
          <button className="btn btn-primary rounded-pill mt-2" disabled={busy === "council"} onClick={createCouncil}>
            {busy === "council" ? <span className="spinner-border spinner-border-sm" /> : t("إنشاء مجلس قسم بهذه الاقتراحات")}
          </button>
        </div></div>
      )}

      {loading && !meetings.length ? <Spinner /> : meetings.length === 0 ? (
        <EmptyState title={t("لا اجتماعات موثقة بعد")} hint={t("أنشئوا اجتماعًا جديدًا أو ولّدوا مجلس قسم من لوحة التحضير أعلاه.")} actionLabel={t("اجتماع جديد")} onAction={() => setForm({})} />
      ) : meetings.map((meeting) => (
        <article key={meeting.id} className="card border-0 shadow-sm mb-3"><div className="card-body">
          <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
            <h6 className="fw-bold mb-0">{meeting.title}</h6>
            <span className="badge text-bg-light border">{te(meeting.type_label)}</span>
            {meeting.class_name && <span className="badge text-bg-light border">{meeting.class_name}</span>}
            <span className="badge text-bg-light border">{meeting.date}</span>
            {meeting.term && <span className="badge text-bg-light border">{te(TERMS.find(([v]) => v === meeting.term)?.[1] || "")}</span>}
          </div>
          {meeting.agenda && <p className="text-secondary small mb-2 meeting-agenda">{meeting.agenda}</p>}
          {!!meeting.decisions?.length && (
            <div className="mb-2">
              <div className="small text-secondary mb-1">{t("القرارات")}: {meeting.decisions_done}/{meeting.decisions_total} {t("منجزة")}</div>
              {meeting.decisions.map((row, index) => (
                <label key={index} className="d-flex gap-2 align-items-center small py-1">
                  <input type="checkbox" className="form-check-input" checked={!!row.done} onChange={() => toggleDecision(meeting, index)} />
                  <span className={row.done ? "text-decoration-line-through text-secondary" : ""}>{row.text}</span>
                  {row.responsible && <span className="text-secondary">• {row.responsible}</span>}
                  {row.due && <span className="badge text-bg-light border">{row.due}</span>}
                  {row.task_id && <span className="badge text-bg-info">{t("في مركز الإجراءات")}</span>}
                </label>
              ))}
            </div>
          )}
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-sm btn-primary rounded-pill" disabled={busy === `min-${meeting.id}`} onClick={() => generateMinutes(meeting)}>{busy === `min-${meeting.id}` ? <span className="spinner-border spinner-border-sm" /> : t("توليد المحضر")}</button>
            <button className="btn btn-sm btn-light rounded-pill" disabled={busy === `push-${meeting.id}`} onClick={() => pushDecisions(meeting)}>{t("دفع القرارات إلى المهام")}</button>
            {meeting.minutes_document && <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(`/editor/${meeting.minutes_document}`)}>{t("فتح المحضر")}</button>}
            <span className="flex-grow-1" />
            <button className="btn btn-sm btn-light rounded-pill" onClick={() => setForm(meeting)}>{t("تعديل")}</button>
            <button className="btn btn-sm btn-light rounded-pill text-danger" onClick={() => setConfirmDelete(meeting)}>{t("حذف")}</button>
          </div>
        </div></article>
      ))}

      {form && <MeetingForm initial={form.id ? form : null} classes={classes} onSubmit={save} onClose={() => setForm(null)} />}
      {confirmDelete && <ConfirmModal title={t("حذف الاجتماع")} body={`${t("سيُحذف الاجتماع")} «${confirmDelete.title}».`} onConfirm={async () => { await api(`/meetings/${confirmDelete.id}/`, { method: "DELETE" }); toast(t("حُذف الاجتماع")); await load(); }} onClose={() => setConfirmDelete(null)} />}
    </>
  );
}
