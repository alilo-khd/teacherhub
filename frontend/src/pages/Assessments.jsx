import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, assessmentApi, downloadFile, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import FilterBar from "../components/FilterBar";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";
import GradebookSyncModal from "../components/GradebookSyncModal";

const KINDS = [["diagnostic", "تقويم تشخيصي"], ["formative", "تقويم تكويني"], ["supervised", "فرض محروس"], ["exam", "اختبار"], ["mock", "اختبار تجريبي"]];
const STATUSES = [["planned", "مخطط"], ["prepared", "الموضوع جاهز"], ["administered", "أُجري"], ["corrected", "صُحّح"], ["returned", "سُلّم للتلاميذ"], ["archived", "مؤرشف"]];
const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const RESULT_STATUSES = [["unmarked", "غير مسجل"], ["present", "حاضر"], ["absent", "غائب"], ["excused", "غائب بعذر"]];
const STATUS_BADGE = { planned: "text-bg-secondary", prepared: "text-bg-info", administered: "text-bg-warning", corrected: "text-bg-success", returned: "text-bg-primary", archived: "text-bg-dark" };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const pct = (v) => (v === null || v === undefined ? "—" : `${v}٪`);

function AssessmentForm({ initial, classes, courses, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title || "",
    school_class: initial?.school_class ? String(initial.school_class) : (classes[0] ? String(classes[0].id) : ""),
    course: initial?.course ? String(initial.course) : "",
    term: initial?.term ? String(initial.term) : "1",
    assessment_kind: initial?.assessment_kind || "supervised",
    date: initial?.date || todayISO(),
    duration_minutes: initial?.duration_minutes ?? 60,
    max_score: initial?.max_score ?? 20,
    status: initial?.status || "planned",
    instructions: initial?.instructions || "",
    notes: initial?.notes || "",
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      await onSubmit({
        title: form.title.trim(),
        school_class: Number(form.school_class),
        course: form.course ? Number(form.course) : null,
        term: Number(form.term),
        assessment_kind: form.assessment_kind,
        date: form.date,
        duration_minutes: Number(form.duration_minutes || 60),
        max_score: Number(form.max_score || 20),
        status: form.status,
        instructions: form.instructions,
        notes: form.notes,
      });
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <ModalShell title={initial?.id ? t("تعديل التقويم") : t("تقويم جديد")} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12 col-md-8"><label className="form-label small fw-semibold">{t("عنوان التقويم")} *</label><input className="form-control" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("مثال: فرض محروس رقم 1 — مكونات الحاسوب")} /></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("التاريخ")}</label><input type="date" className="form-control" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("الفوج")} *</label><select className="form-select" required value={form.school_class} onChange={(e) => set("school_class", e.target.value)}>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("الدرس المرتبط")}</label><select className="form-select" value={form.course} onChange={(e) => set("course", e.target.value)}><option value="">{t("بدون درس محدد")}</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.order}. {course.title}</option>)}</select></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("نوع التقويم")}</label><select className="form-select" value={form.assessment_kind} onChange={(e) => set("assessment_kind", e.target.value)}>{KINDS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("الثلاثي")}</label><select className="form-select" value={form.term} onChange={(e) => set("term", e.target.value)}>{TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-4"><label className="form-label small fw-semibold">{t("الحالة")}</label><select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select></div>
          <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("المدة (دقيقة)")}</label><input type="number" min="1" max="600" className="form-control" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} /></div>
          <div className="col-6 col-md-2"><label className="form-label small fw-semibold">{t("النقطة القصوى")}</label><input type="number" min="1" max="100" step="0.5" className="form-control" value={form.max_score} onChange={(e) => set("max_score", e.target.value)} /></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("تعليمات الموضوع")}</label><textarea className="form-control" rows={2} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder={t("تظهر في أعلى موضوع الاختبار المولّد…")} /></div>
          <div className="col-12"><label className="form-label small fw-semibold">{t("ملاحظات الأستاذ")}</label><textarea className="form-control" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ التقويم")}</button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResultsModal({ assessment, onClose, onSaved }) {
  const { t, te } = useLang();
  const toast = useToast();
  const [payload, setPayload] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [threshold, setThreshold] = useState(50);
  const [includeAbsent, setIncludeAbsent] = useState(false);
  const [band, setBand] = useState("support");
  const [creating, setCreating] = useState(false);
  const [createdGroup, setCreatedGroup] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentApi.results(assessment.id)
      .then((data) => { setPayload(data); setRows(data.students); })
      .catch((error) => toast(error.message, "danger"));
  }, [assessment.id, toast]);

  const setRow = (studentId, patch) => setRows((current) => current.map((row) => {
    if (row.student !== studentId) return row;
    const next = { ...row, ...patch };
    if (["absent", "excused", "unmarked"].includes(next.status)) next.score = "";
    return next;
  }));
  const live = useMemo(() => {
    const present = rows.filter((row) => row.status === "present");
    const scored = present.filter((row) => row.score !== "" && row.score !== null && row.score !== undefined);
    const percents = scored.map((row) => (Number(row.score) / Number(assessment.max_score || 20)) * 100);
    return {
      recorded: rows.filter((row) => row.status !== "unmarked").length,
      scored: scored.length,
      average: percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null,
      success: percents.length ? Math.round((percents.filter((v) => v >= 50).length * 1000) / percents.length) / 10 : null,
    };
  }, [rows, assessment.max_score]);

  const supportCandidates = useMemo(() => {
    const low = [], absent = [];
    rows.forEach((row) => {
      if (row.status === "present" && row.score !== "" && row.score !== null && row.score !== undefined) {
        const pctVal = (Number(row.score) / Number(assessment.max_score || 20)) * 100;
        if (pctVal < threshold) low.push({ id: row.student, name: row.student_name, pct: Math.round(pctVal * 10) / 10 });
      } else if (row.status === "absent") absent.push({ id: row.student, name: row.student_name });
    });
    return { low, absent };
  }, [rows, threshold, assessment.max_score]);

  const createSupport = async () => {
    setCreating(true);
    try {
      const data = await assessmentApi.createSupportGroup(assessment.id, { threshold, include_absent: includeAbsent, band });
      toast(data.created ? `${t("أُنشئت مجموعة دعم")} — ${data.member_count} ${t("تلميذ")}` : t("توجد مجموعة دعم نشطة لهذا التقويم"));
      setCreatedGroup(data.group);
      const fresh = await assessmentApi.get(assessment.id);
      onSaved(fresh);
    } catch (error) { toast(error.message, "danger"); }
    setCreating(false);
  };

  const persist = () => assessmentApi.saveResults(assessment.id, rows.map((row) => ({
    student: row.student, status: row.status,
    score: row.score === "" ? null : Number(row.score), comment: row.comment || "",
  })));

  const save = async () => {
    setBusy(true);
    try {
      const data = await persist();
      toast(t("حُفظت نتائج التقويم"));
      onSaved(data.assessment);
      onClose();
    } catch (error) { toast(error.message, "danger"); setBusy(false); }
  };

  const openSupport = async () => {
    setBusy(true);
    try {
      const data = await persist();
      onSaved(data.assessment);
      setShowSupport(true);
    } catch (error) { toast(error.message, "danger"); }
    setBusy(false);
  };

  return (
    <ModalShell title={`${t("نتائج")} — ${assessment.title}`} onClose={onClose} wide>
      {!payload ? <Spinner /> : (
        <>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <span className="badge rounded-pill text-bg-light border">{assessment.class_name}</span>
            <span className="badge rounded-pill text-bg-light border">{te(assessment.kind_label)} • {assessment.date}</span>
            <span className="badge rounded-pill text-bg-light border">{t("مسجل")}: {live.recorded}/{rows.length}</span>
            <span className="badge rounded-pill text-bg-light border">{t("مصحَّح")}: {live.scored}</span>
            <span className="badge rounded-pill text-bg-primary">{t("المعدل")}: {pct(live.average)}</span>
            <span className="badge rounded-pill text-bg-success">{t("نسبة النجاح")}: {pct(live.success)}</span>
            <button type="button" className="btn btn-sm btn-light rounded-pill ms-auto" onClick={() => setRows((current) => current.map((row) => ({ ...row, status: row.status === "unmarked" ? "present" : row.status })))}>{t("اعتبار الكل حاضرًا")}</button>
          </div>
          <div className="table-responsive assessment-results-wrap">
            <table className="table table-sm align-middle exam-table mb-0">
              <thead><tr><th style={{ width: 36 }}>#</th><th>{t("التلميذ")}</th><th style={{ width: 140 }}>{t("الحالة")}</th><th style={{ width: 110 }}>{t("النقطة")} /{assessment.max_score}</th><th style={{ width: 90 }}>٪</th><th>{t("ملاحظة")}</th></tr></thead>
              <tbody>
                {rows.map((row, index) => {
                  const percentValue = row.score === "" || row.score === null || row.score === undefined ? null : Math.round((Number(row.score) / Number(assessment.max_score || 20)) * 1000) / 10;
                  return (
                    <tr key={row.student}>
                      <td>{index + 1}</td>
                      <td className="fw-semibold">{row.student_name}</td>
                      <td><select className="form-select form-select-sm" value={row.status} onChange={(e) => setRow(row.student, { status: e.target.value })}>{RESULT_STATUSES.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select></td>
                      <td><input type="number" min="0" max={assessment.max_score} step="0.25" className="form-control form-control-sm" disabled={row.status !== "present"} value={row.score ?? ""} onChange={(e) => setRow(row.student, { score: e.target.value })} /></td>
                      <td>{percentValue === null ? "—" : <span className={`badge rounded-pill ${percentValue >= 50 ? "text-bg-success" : "text-bg-danger"}`}>{percentValue}٪</span>}</td>
                      <td><input className="form-control form-control-sm" value={row.comment || ""} onChange={(e) => setRow(row.student, { comment: e.target.value })} placeholder={t("ملاحظة سريعة…")} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {showSupport && (
            <div className="border rounded-4 p-3 mt-3 bg-light-subtle">
              <div className="fw-bold mb-2">{t("مجموعة دعم للمتعثرين في هذا التقويم")}</div>
              {createdGroup || assessment.support_group_id ? (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="badge rounded-pill text-bg-success">{t("لهذا التقويم مجموعة دعم نشطة")}</span>
                  <span className="fw-semibold">{createdGroup ? createdGroup.title : ""}</span>
                  <button type="button" className="btn btn-sm btn-primary rounded-pill ms-auto" onClick={() => navigate("/remedial")}>{t("فتح الدعم والاستدراك")}</button>
                </div>
              ) : (
                <>
                  <div className="row g-2 align-items-end">
                    <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("عتبة التعثر")}</label><select className="form-select" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>{[40, 50, 60].map((v) => <option key={v} value={v}>{t("دون")} {v}٪</option>)}</select></div>
                    <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("نوع الدعم")}</label><select className="form-select" value={band} onChange={(e) => setBand(e.target.value)}>{[["support", "دعم ومواكبة"], ["intensive", "دعم مكثف"], ["boost", "تعزيز وتثبيت"]].map(([v, l]) => <option key={v} value={v}>{te(l)}</option>)}</select></div>
                    <div className="col-12 col-md-3"><div className="form-check"><input className="form-check-input" type="checkbox" id="inc-absent" checked={includeAbsent} onChange={(e) => setIncludeAbsent(e.target.checked)} /><label className="form-check-label small" htmlFor="inc-absent">{t("ضمّ الغائبين أيضًا")}</label></div></div>
                    <div className="col-12 col-md-3"><button type="button" className="btn btn-primary rounded-pill w-100" disabled={creating || (!supportCandidates.low.length && !(includeAbsent && supportCandidates.absent.length))} onClick={createSupport}>{creating ? <span className="spinner-border spinner-border-sm" /> : `${t("إنشاء المجموعة")} (${supportCandidates.low.length + (includeAbsent ? supportCandidates.absent.length : 0)})`}</button></div>
                  </div>
                  <div className="d-flex flex-wrap gap-1 mt-2">
                    {supportCandidates.low.map((c) => <span key={c.id} className="badge rounded-pill text-bg-warning">{c.name} • {c.pct}٪</span>)}
                    {includeAbsent && supportCandidates.absent.map((c) => <span key={c.id} className="badge rounded-pill text-bg-danger">{c.name} • {t("غائب")}</span>)}
                    {!supportCandidates.low.length && !supportCandidates.absent.length && <span className="small text-secondary">{t("لا نتائج مسجلة بعد — سجّلوا النقاط أولًا.")}</span>}
                    {supportCandidates.absent.length > 0 && !includeAbsent && <span className="small text-secondary">{supportCandidates.absent.length} {t("غائب غير مضمّن")}</span>}
                  </div>
                  <p className="small text-secondary mb-0 mt-2">{t("تُحفظ النتائج الحالية أولًا، ثم تُبنى المجموعة منها في مركز الدعم والاستدراك حيث يمكن جدولة الحصص وتوليد أوراق العمل.")}</p>
                </>
              )}
            </div>
          )}
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-primary rounded-pill px-4" disabled={busy} onClick={save}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ النتائج")}</button>
            <button type="button" className="btn btn-light rounded-pill px-4" onClick={async () => { try { await downloadFile(`/assessments/${assessment.id}/results/export/`, `assessment-${assessment.id}-results.csv`); } catch (error) { toast(error.message, "danger"); } }}><Icon name="download" size={16} /> {t("تصدير النتائج CSV")}</button>
            <button type="button" className="btn btn-outline-primary rounded-pill px-4" disabled={busy} onClick={openSupport}><Icon name="users" size={16} /> {t("مجموعة دعم للمتعثرين")}</button>
            <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إغلاق")}</button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function PaperModal({ assessment, courses, onClose, onGenerated }) {
  const { t } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [quotas, setQuotas] = useState({});
  const [includeKey, setIncludeKey] = useState(true);
  const [busy, setBusy] = useState(false);
  const [availableByCourse, setAvailableByCourse] = useState({});

  useEffect(() => {
    api("/question-bank/counts-by-course/").then((rows) => {
      const map = {};
      (rows || []).forEach((row) => { map[row.course_id] = row.available; });
      setAvailableByCourse(map);
      setItems(rows);
      if (assessment.course) {
        setQuotas({ [assessment.course]: Math.min(10, map[assessment.course] || 0) || 5 });
      }
    }).catch((error) => toast(error.message, "danger"));
  }, [assessment.course, toast]);
  const entries = Object.entries(quotas).map(([courseId, count]) => ({ course_id: Number(courseId), count: Number(count || 0) })).filter((x) => x.count > 0);
  const requested = entries.reduce((sum, x) => sum + x.count, 0);

  const generate = async () => {
    setBusy(true);
    try {
      const data = await assessmentApi.generatePaper(assessment.id, {
        lesson_counts: entries.length ? entries : undefined,
        count: 10, include_answer_key: includeKey,
      });
      toast(`${t("وُلّد موضوع التقويم")} • ${data.questions_used} ${t("سؤالًا")}`);
      onGenerated(data.assessment);
      onClose();
      navigate(`/editor/${data.document.id}`);
    } catch (error) { toast(error.message, "danger"); setBusy(false); }
  };

  return (
    <ModalShell title={`${t("توليد الموضوع")} — ${assessment.title}`} onClose={onClose} wide>
      {!items ? <Spinner /> : (
        <>
          <p className="text-secondary small">{t("اختر درسًا واحدًا أو عدة دروس وحدّد عدد الأسئلة من كل درس؛ أو اترك الاختيار فارغًا لاستخدام درس التقويم المرتبط (أو كل البنك).")}</p>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="badge rounded-pill text-bg-light border">{entries.length} {t("درس")} • {requested} {t("مطلوب")}</span>
            <span className="ms-auto d-flex gap-1">
              <button type="button" className="btn btn-sm btn-light rounded-pill" onClick={() => { const next = {}; courses.forEach((c) => { const avail = availableByCourse[c.id] || 0; if (avail) next[c.id] = Math.min(10, avail); }); setQuotas(next); }}>{t("تحديد الكل")}</button>
              <button type="button" className="btn btn-sm btn-light rounded-pill" onClick={() => setQuotas({})}>{t("مسح الاختيار")}</button>
            </span>
          </div>
          <div className="lesson-quota-list">
            {courses.map((c) => {
              const avail = availableByCourse[c.id] || 0;
              const checked = quotas[c.id] !== undefined;
              return (
                <div key={c.id} className={`lesson-quota-row ${checked ? "active" : ""}`}>
                  <label className="d-flex align-items-center gap-2 flex-grow-1 mb-0">
                    <input type="checkbox" className="form-check-input mt-0" checked={checked} disabled={!avail}
                      onChange={() => setQuotas((cur) => { const next = { ...cur }; if (next[c.id] !== undefined) delete next[c.id]; else next[c.id] = Math.min(10, avail) || 5; return next; })} />
                    <span className="fw-semibold small">{c.order}. {c.title}</span>
                  </label>
                  <span className={`badge rounded-pill ${avail ? "text-bg-light border" : "text-bg-warning"}`}>{avail} {t("سؤال متاح")}</span>
                  {checked && <span className="d-flex align-items-center gap-1">
                    <input type="number" min="1" max={Math.max(avail, 1)} className="form-control form-control-sm lesson-quota-input" value={quotas[c.id]} onChange={(e) => setQuotas((cur) => ({ ...cur, [c.id]: e.target.value }))} />
                    <button type="button" className="btn btn-sm btn-light rounded-pill text-nowrap" onClick={() => setQuotas((cur) => ({ ...cur, [c.id]: avail }))}>{t("كل المتاح")}</button>
                  </span>}
                </div>
              );
            })}
          </div>
          <div className="form-check mt-3">
            <input className="form-check-input" type="checkbox" checked={includeKey} onChange={(e) => setIncludeKey(e.target.checked)} />
            <label className="form-check-label small fw-semibold">{t("إرفاق مفتاح الإجابة")}</label>
          </div>
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-primary rounded-pill px-4" disabled={busy} onClick={generate}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("توليد وفتح المحرّر")}</button>
            <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

export default function AssessmentsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [assessments, setAssessments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [resultsFor, setResultsFor] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const [busy, setBusy] = useState("");
  const [highlight, setHighlight] = useState(null);
  const deepLinkDone = useRef(false);
  const [filters, setFilters] = useState({ q: "", term: "", school_class: "", assessment_kind: "", status: "", sort: "-date" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, cls, crs] = await Promise.all([
        assessmentApi.list().then(listOf), api("/classes/").then(listOf), api("/courses/").then(listOf),
      ]);
      setAssessments(rows); setClasses(cls); setCourses(crs);
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const targetId = searchParams.get("assessment");
    if (!targetId || deepLinkDone.current || !assessments.length) return;
    const target = assessments.find((item) => String(item.id) === String(targetId));
    if (!target) return;
    deepLinkDone.current = true;
    setFilters({ q: "", term: String(target.term), school_class: "", assessment_kind: "", status: "", sort: "-date" });
    setHighlight(target.id);
    setTimeout(() => document.getElementById(`assessment-card-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
    setTimeout(() => setHighlight(null), 3200);
  }, [assessments, searchParams]);

  const replace = (updated) => setAssessments((current) => current.map((item) => (item.id === updated.id ? updated : item)));

  const save = async (payload) => {
    if (form?.id) { replace(await assessmentApi.update(form.id, payload)); toast(t("حُفظ التقويم")); }
    else { const created = await assessmentApi.create(payload); setAssessments((current) => [created, ...current]); toast(t("أُنشئ التقويم")); }
  };

  const remove = async () => {
    await assessmentApi.remove(confirm.id);
    setAssessments((current) => current.filter((item) => item.id !== confirm.id));
    toast(t("حُذف التقويم ونتائجه"), "warning");
    setConfirm(null);
  };

  const changeStatus = async (item, statusValue) => {
    try { replace(await assessmentApi.update(item.id, { status: statusValue })); }
    catch (error) { toast(error.message, "danger"); }
  };

  const [paperFor, setPaperFor] = useState(null);
  const paper = (item, regenerate = false) => {
    if (item.paper_document && !regenerate) { navigate(`/editor/${item.paper_document}`); return; }
    setPaperFor(item);
  };

  const analysis = async (item, regenerate = false) => {
    if (item.analysis_document && !regenerate) { navigate(`/editor/${item.analysis_document}`); return; }
    setBusy(`analysis-${item.id}`);
    try {
      const data = await assessmentApi.generateAnalysis(item.id);
      replace(data.assessment);
      toast(t("وُلّدت وثيقة تحليل النتائج"));
      navigate(`/editor/${data.document.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const duplicate = async (item) => {
    try {
      const copy = await assessmentApi.duplicate(item.id);
      setAssessments((current) => [copy, ...current]);
      toast(t("نُسخ التقويم كمسودة مخططة جديدة"));
    } catch (error) { toast(error.message, "danger"); }
  };

  const shown = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return assessments.filter((item) => (!q || item.title.toLowerCase().includes(q) || (item.course_title || "").toLowerCase().includes(q) || (item.class_name || "").toLowerCase().includes(q))
      && (!filters.term || String(item.term) === filters.term)
      && (!filters.school_class || String(item.school_class) === filters.school_class)
      && (!filters.assessment_kind || item.assessment_kind === filters.assessment_kind)
      && (!filters.status || item.status === filters.status))
      .sort((a, b) => (filters.sort === "date" ? String(a.date).localeCompare(String(b.date))
        : filters.sort === "title" ? a.title.localeCompare(b.title, "ar")
        : filters.sort === "average" ? (b.stats?.average_percent ?? -1) - (a.stats?.average_percent ?? -1)
        : String(b.date).localeCompare(String(a.date))));
  }, [assessments, filters]);

  const headerStats = useMemo(() => {
    const scoped = filters.term ? assessments.filter((item) => String(item.term) === filters.term) : assessments;
    const withScores = scoped.filter((item) => item.stats?.scored > 0);
    return {
      total: scoped.length,
      upcoming: scoped.filter((item) => ["planned", "prepared"].includes(item.status) && (item.days_left ?? -1) >= 0).length,
      overdue: scoped.filter((item) => item.is_overdue).length,
      toCorrect: scoped.filter((item) => item.status === "administered" || (item.stats?.present > 0 && item.stats?.correction_progress < 100)).length,
      average: withScores.length ? Math.round((withScores.reduce((sum, item) => sum + item.stats.average_percent, 0) / withScores.length) * 10) / 10 : null,
    };
  }, [assessments, filters.term]);

  return (
    <>
      <div className="studio-hero d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div style={{ maxWidth: 760 }}>
          <h3 className="fw-bold mb-2">{t("مركز الفروض والاختبارات والتقويمات")}</h3>
          <p className="mb-0">{t("خططوا لكل تقويم: نوعه وفوجه ودرسه وتاريخه، ولّدوا موضوعه من بنك الأسئلة، سجّلوا نتائج التلاميذ جماعيًا، ثم حلّلوا الأداء في وثيقة قابلة للتحرير — دون المساس بدفتر التنقيط الرسمي.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-light rounded-pill px-4" onClick={() => setShowSync(true)}><Icon name="check" size={16} /> {t("مزامنة دفتر التنقيط")}</button>
          <button className="btn btn-primary rounded-pill px-4" onClick={() => setForm({})}><Icon name="plus" size={16} /> {t("تقويم جديد")}</button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {[
          [headerStats.total, "تقويم مخطط", "clipboard"],
          [headerStats.upcoming, "تقويم قادم", "calendar"],
          [headerStats.toCorrect, "ينتظر التصحيح أو الاستكمال", "clock"],
          [headerStats.average === null ? "—" : `${headerStats.average}٪`, "متوسط نجاح التقويمات المصححة", "chart"],
        ].map(([value, label, icon]) => (
          <div className="col-6 col-xl-3" key={label}>
            <div className="card border-0 shadow-sm h-100"><div className="card-body d-flex align-items-center gap-3">
              <span className="print-icon mb-0"><Icon name={icon} size={23} /></span>
              <span><span className="d-block fs-4 fw-bold">{value}</span><span className="text-secondary small">{t(label)}</span></span>
            </div></div>
          </div>
        ))}
      </div>
      {headerStats.overdue > 0 && <div className="alert alert-warning py-2">{headerStats.overdue} {t("تقويم(ات) فات تاريخها وما زالت مخططة — حدّثوا حالتها أو أعيدوا برمجتها.")}</div>}

      <FilterBar search={filters.q} onSearch={(v) => setFilters((x) => ({ ...x, q: v }))} count={shown.length}
        sort={filters.sort} onSort={(v) => setFilters((x) => ({ ...x, sort: v }))}
        sortOptions={[["-date", "الأحدث تاريخًا"], ["date", "الأقدم تاريخًا"], ["average", "الأعلى معدلًا"], ["title", "العنوان"]]}
        onReset={() => setFilters({ q: "", term: "", school_class: "", assessment_kind: "", status: "", sort: "-date" })}>
        <select className="form-select" value={filters.term} onChange={(e) => setFilters((x) => ({ ...x, term: e.target.value }))}><option value="">{t("كل الثلاثيات")}</option>{TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select>
        <select className="form-select" value={filters.school_class} onChange={(e) => setFilters((x) => ({ ...x, school_class: e.target.value }))}><option value="">{t("كل الأفواج")}</option>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select>
        <select className="form-select" value={filters.assessment_kind} onChange={(e) => setFilters((x) => ({ ...x, assessment_kind: e.target.value }))}><option value="">{t("كل الأنواع")}</option>{KINDS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select>
        <select className="form-select" value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}><option value="">{t("كل الحالات")}</option>{STATUSES.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select>
      </FilterBar>

      {loading ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon="" title={t("لا تقويمات مطابقة")} hint={t("أنشئوا أول فرض أو اختبار، ثم ولّدوا موضوعه وسجّلوا نتائجه من هنا.")} actionLabel={t("تقويم جديد")} onAction={() => setForm({})} />
      ) : (
        <div className="row g-3">
          {shown.map((item) => (
            <div className="col-12 col-xl-6" key={item.id}>
              <article id={`assessment-card-${item.id}`} className={`card border-0 shadow-sm h-100 ${highlight === item.id ? "highlight-card" : ""}`}>
                <div className="card-body d-flex flex-column">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <span className="badge rounded-pill text-bg-primary">{te(item.kind_label)}</span>
                    <span className={`badge rounded-pill ${STATUS_BADGE[item.status] || "text-bg-secondary"}`}>{te(item.status_label)}</span>
                    <span className="badge rounded-pill text-bg-light border">{te(TERMS.find(([value]) => value === item.term)?.[1] || "")}</span>
                    <span className="badge rounded-pill text-bg-light border">{item.class_name}</span>
                    {item.is_overdue && <span className="badge rounded-pill text-bg-danger">{t("فات تاريخه")}</span>}
                    {item.gradebook_synced_at && <span className="badge rounded-pill text-bg-success">{t("مُزامَن مع دفتر التنقيط")}</span>}
                    {item.support_group_id && <span className="badge rounded-pill text-bg-info">{t("لها مجموعة دعم")}</span>}
                    <select className="form-select form-select-sm assessment-status-select ms-auto" value={item.status} onChange={(e) => changeStatus(item, e.target.value)} title={t("تغيير الحالة")}>
                      {STATUSES.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}
                    </select>
                  </div>
                  <h5 className="fw-bold mb-1">{item.title}</h5>
                  <div className="text-secondary small mb-2">
                    {item.date} • {item.duration_minutes} {t("دقيقة")} • /{item.max_score}
                    {item.course_title && <> • {item.course_title}</>}
                    <> • {t("يقابل في دفتر التنقيط:")} {te(item.grade_component_label)}</>
                  </div>
                  <div className="assessment-progress-row">
                    <span>{t("التسجيل")} {item.stats.recorded}/{item.stats.expected}</span>
                    <span>{t("التصحيح")} {item.stats.correction_progress}٪</span>
                    <span>{t("المعدل")} {pct(item.stats.average_percent)}{item.stats.average_20 !== null && item.stats.average_20 !== undefined ? ` (${item.stats.average_20}/20)` : ""}</span>
                    <span>{t("النجاح")} {pct(item.stats.success_rate)}</span>
                  </div>
                  <div className="progress assessment-progress mb-2"><div className="progress-bar" style={{ width: `${item.stats.correction_progress}%` }} /></div>
                  {item.stats.scored > 0 && <div className="assessment-distribution mb-2">
                    {item.stats.distribution.map((band) => <span key={band.key} className="badge rounded-pill text-bg-light border">{te(band.label)}: {band.count}</span>)}
                    {!!item.stats.absent && <span className="badge rounded-pill text-bg-warning">{t("غائب")}: {item.stats.absent}</span>}
                  </div>}
                  {(item.paper_document || item.analysis_document) && <div className="d-flex flex-wrap gap-1 mb-2">
                    {item.paper_document && <span className="badge rounded-pill text-bg-light border"> {item.paper_document_title}</span>}
                    {item.analysis_document && <span className="badge rounded-pill text-bg-light border"> {item.analysis_document_title}</span>}
                  </div>}
                  <div className="d-flex flex-wrap gap-2 mt-auto pt-2">
                    <button className="btn btn-sm btn-primary rounded-pill flex-grow-1" onClick={() => setResultsFor(item)}>{t("إدخال النتائج")}</button>
                    <button className="btn btn-sm btn-outline-primary rounded-pill" disabled={busy === `paper-${item.id}`} onClick={() => paper(item)}>{busy === `paper-${item.id}` ? <span className="spinner-border spinner-border-sm" /> : item.paper_document ? t("فتح الموضوع") : t("توليد الموضوع")}</button>
                    {item.paper_document && <button className="btn btn-sm btn-light rounded-pill" disabled={busy === `paper-${item.id}`} onClick={() => paper(item, true)} title={t("توليد موضوع جديد من بنك الأسئلة")}>{t("موضوع جديد")}</button>}
                    <button className="btn btn-sm btn-outline-dark rounded-pill" disabled={busy === `analysis-${item.id}`} onClick={() => analysis(item)}>{busy === `analysis-${item.id}` ? <span className="spinner-border spinner-border-sm" /> : item.analysis_document ? t("فتح التحليل") : t("تحليل النتائج")}</button>
                    {item.analysis_document && <button className="btn btn-sm btn-light rounded-pill" disabled={busy === `analysis-${item.id}`} onClick={() => analysis(item, true)} title={t("توليد تحليل جديد بأحدث النتائج")}>{t("تحليل جديد")}</button>}
                    <button className="btn btn-sm btn-light rounded-pill" onClick={() => duplicate(item)}>{t("نسخ")}</button>
                    <button className="btn btn-sm btn-light rounded-pill" onClick={() => setForm(item)}>{t("تعديل")}</button>
                    <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(item)}>{t("حذف")}</button>
                  </div>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}

      {form && <AssessmentForm initial={form.id ? form : null} classes={classes} courses={courses} onClose={() => setForm(null)} onSubmit={save} />}
      {resultsFor && <ResultsModal assessment={resultsFor} onClose={() => setResultsFor(null)} onSaved={replace} />}
      {paperFor && <PaperModal assessment={paperFor} courses={courses} onClose={() => setPaperFor(null)} onGenerated={replace} />}
      {showSync && <GradebookSyncModal initialClass={filters.school_class || ""} initialTerm={filters.term ? Number(filters.term) : 1} onClose={() => setShowSync(false)} onApplied={() => load()} />}
      {confirm && <ConfirmModal title={t("حذف التقويم")} body={`${t("سيُحذف هذا التقويم وكل نتائجه المسجلة نهائيًا:")} «${confirm.title}»`} onConfirm={remove} onClose={() => setConfirm(null)} />}
    </>
  );
}
