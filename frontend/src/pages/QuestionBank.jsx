import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf } from "../api";
import { useResource } from "../hooks";
import { Spinner, EmptyState } from "../components/States";
import FilterBar from "../components/FilterBar";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const QTYPES = ["سؤال قصير", "اختيار من متعدد", "صح / خطأ", "سؤال مقالي", "أكمل الفراغ", "تصنيف", "نشاط تطبيقي"];
const DIFFICULTIES = ["سهل", "متوسط", "صعب"];
const difficultyClass = (d) => d === "صعب" ? "text-bg-danger" : d === "سهل" ? "text-bg-success" : "text-bg-warning";

function QuestionForm({ initial, courses, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [form, setForm] = useState({
    prompt: initial?.prompt || "",
    course: initial?.course ? String(initial.course) : "",
    qtype: initial?.qtype || "سؤال قصير",
    difficulty: initial?.difficulty || "متوسط",
    points: initial?.points ?? 2,
    lines: initial?.lines ?? 3,
    answer: initial?.answer || "",
    explanation: initial?.explanation || "",
    optionsText: (initial?.options || []).join("\n"),
    tagsText: (initial?.tags || []).join("، "),
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await onSubmit({
        prompt: form.prompt.trim(),
        course: form.course ? Number(form.course) : null,
        qtype: form.qtype,
        difficulty: form.difficulty,
        points: Number(form.points || 0),
        lines: Number(form.lines || 0),
        answer: form.answer,
        explanation: form.explanation,
        options: form.optionsText.split("\n").map((x) => x.trim()).filter(Boolean),
        tags: form.tagsText.split(/[,،]/).map((x) => x.trim()).filter(Boolean),
      });
      onClose();
    } catch { setBusy(false); }
  };
  return (
    <ModalShell title={initial ? t("تعديل سؤال") : t("سؤال جديد")} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label small fw-semibold">{t("نص السؤال")} *</label>
            <textarea className="form-control" rows={3} required value={form.prompt} onChange={(e) => set("prompt", e.target.value)} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold">{t("الدرس المرتبط")}</label>
            <select className="form-select" value={form.course} onChange={(e) => set("course", e.target.value)}>
              <option value="">{t("بدون درس محدد")}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold">{t("نوع السؤال")}</label>
            <select className="form-select" value={form.qtype} onChange={(e) => set("qtype", e.target.value)}>
              {QTYPES.map((x) => <option key={x} value={x}>{te(x)}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold">{t("الصعوبة")}</label>
            <select className="form-select" value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
              {DIFFICULTIES.map((x) => <option key={x} value={x}>{te(x)}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold">{t("النقطة")}</label>
            <input type="number" min="0" max="100" step="0.5" className="form-control" value={form.points} onChange={(e) => set("points", e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold">{t("أسطر الإجابة")}</label>
            <input type="number" min="0" max="12" className="form-control" value={form.lines} onChange={(e) => set("lines", e.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">{t("الخيارات — خيار في كل سطر")}</label>
            <textarea className="form-control" rows={4} value={form.optionsText} onChange={(e) => set("optionsText", e.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">{t("الإجابة الصحيحة / عناصر التصحيح")}</label>
            <textarea className="form-control" rows={4} value={form.answer} onChange={(e) => set("answer", e.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">{t("شرح الإجابة")}</label>
            <textarea className="form-control" rows={3} value={form.explanation} onChange={(e) => set("explanation", e.target.value)} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold">{t("الوسوم")}</label>
            <input className="form-control" value={form.tagsText} placeholder={t("أساسيات، فهم، تطبيق…")} onChange={(e) => set("tagsText", e.target.value)} />
          </div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ السؤال")}</button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function QuestionBankPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const { items, loading, error, create, update, remove, load } = useResource("/question-bank/");
  const [courses, setCourses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [f, setF] = useState({ q: "", course: "", qtype: "", difficulty: "", tag: "", sort: "-updated" });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState("");
  const [importDoc, setImportDoc] = useState({ document_id: "", course_id: "" });
  const [gen, setGen] = useState({ kind: "exam", course_id: "", difficulty: "", qtype: "", strategy: "random", count: 10, target_points: "", balance_difficulty: false, include_answer_key: true, title: "" });
  const setG = (k, v) => setGen((x) => ({ ...x, [k]: v }));
  const [quotas, setQuotas] = useState({});
  const [seedVariants, setSeedVariants] = useState(3);

  useEffect(() => {
    Promise.all([api("/courses/").then(listOf).catch(() => []), api("/documents/").then(listOf).catch(() => [])])
      .then(([c, d]) => {
        setCourses(c); setDocuments(d.filter((x) => !x.is_archived));
      });
  }, []);

  const [availableByCourse, setAvailableByCourse] = useState({});
  useEffect(() => {
    const params = new URLSearchParams();
    if (gen.difficulty) params.set("difficulty", gen.difficulty);
    if (gen.qtype) params.set("qtype", gen.qtype);
    api(`/question-bank/counts-by-course/?${params}`).then((rows) => {
      const map = {};
      (rows || []).forEach((row) => { map[row.course_id] = row.available; });
      setAvailableByCourse(map);
    }).catch(() => {});
  }, [gen.difficulty, gen.qtype, items]);
  const quotaEntries = Object.entries(quotas).map(([courseId, count]) => ({ course_id: Number(courseId), count: Number(count || 0) })).filter((x) => x.count > 0);
  const quotaRequested = quotaEntries.reduce((sum, x) => sum + x.count, 0);
  const quotaAvailable = quotaEntries.reduce((sum, x) => sum + Math.min(x.count, availableByCourse[x.course_id] || 0), 0);
  const toggleLesson = (course) => setQuotas((current) => {
    const next = { ...current };
    if (next[course.id] !== undefined) delete next[course.id];
    else next[course.id] = Math.min(10, availableByCourse[course.id] || 0) || 5;
    return next;
  });

  useEffect(() => { api("/question-bank/stats/").then(setStats).catch(() => {}); }, [items]);
  useEffect(() => { setSelected((ids) => ids.filter((id) => items.some((x) => x.id === id))); }, [items]);

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const tag = f.tag.trim().toLowerCase();
    return items.filter((x) => (!q || x.prompt.toLowerCase().includes(q) || (x.answer || "").toLowerCase().includes(q) || (x.course_title || "").toLowerCase().includes(q))
      && (!f.course || String(x.course) === String(f.course))
      && (!f.qtype || x.qtype === f.qtype)
      && (!f.difficulty || x.difficulty === f.difficulty)
      && (!tag || (x.tags || []).some((v) => String(v).toLowerCase().includes(tag))))
      .sort((a, b) => f.sort === "points_desc" ? (b.points || 0) - (a.points || 0)
        : f.sort === "points_asc" ? (a.points || 0) - (b.points || 0)
        : f.sort === "prompt" ? a.prompt.localeCompare(b.prompt, "ar")
        : f.sort === "updated" ? String(a.updated_at).localeCompare(String(b.updated_at))
        : String(b.updated_at).localeCompare(String(a.updated_at)));
  }, [items, f]);

  const selectedQuestions = items.filter((x) => selected.includes(x.id));
  const selectedPoints = selectedQuestions.reduce((sum, x) => sum + Number(x.points || 0), 0);
  const toggle = (id) => setSelected((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  const seed = async () => {
    setBusy("seed");
    try {
      const r = await api("/question-bank/seed-from-courses/", { method: "POST", body: {} });
      toast(`${t("أُضيف")} ${r.created} ${t("سؤالًا من نقاط المقرر")}`); await load();
    } catch (e) { toast(e.message, "danger"); }
    setBusy("");
  };

  const importFromDocument = async () => {
    if (!importDoc.document_id) return;
    setBusy("import");
    try {
      const r = await api("/question-bank/import-from-document/", { method: "POST", body: { document_id: Number(importDoc.document_id), course_id: importDoc.course_id ? Number(importDoc.course_id) : null } });
      toast(`${t("استُورد")} ${r.created} ${t("سؤالًا")} • ${t("تُجاوز")} ${r.skipped_duplicates} ${t("مكرر")}`); await load();
    } catch (e) { toast(e.message, "danger"); }
    setBusy("");
  };

  const generate = async (useSelected = false) => {
    setBusy(useSelected ? "gen-selected" : "gen");
    try {
      const payload = useSelected ? { ids: selected, kind: gen.kind, include_answer_key: gen.include_answer_key, title: gen.title }
        : quotaEntries.length ? { kind: gen.kind, lesson_counts: quotaEntries, difficulty: gen.difficulty, qtype: gen.qtype, strategy: gen.strategy, balance_difficulty: gen.balance_difficulty, include_answer_key: gen.include_answer_key, title: gen.title }
        : { ...gen, course_id: gen.course_id ? Number(gen.course_id) : null, count: Number(gen.count), target_points: gen.target_points === "" ? null : Number(gen.target_points) };
      const doc = await api("/question-bank/generate-document/", { method: "POST", body: payload });
      const shortfalls = (doc.breakdown || []).filter((row) => row.delivered < row.requested);
      toast(shortfalls.length
        ? `${t("وُلّدت وثيقة من بنك الأسئلة")} • ${doc.questions_used} ${t("سؤالًا")} — ${shortfalls.map((row) => `${row.title}: ${row.delivered}/${row.requested}`).join("، ")}`
        : t("وُلّدت وثيقة من بنك الأسئلة"));
      navigate(`/editor/${doc.id}`);
    } catch (e) { toast(e.message, "danger"); }
    setBusy("");
  };

  const duplicate = async (x) => {
    try { await api(`/question-bank/${x.id}/duplicate/`, { method: "POST", body: {} }); toast(t("تمت نسخة السؤال")); await load(); }
    catch (e) { toast(e.message, "danger"); }
  };

  return (
    <>
      <div className="studio-hero d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div style={{ maxWidth: 720 }}>
          <h3 className="fw-bold mb-2">{t("بنك الأسئلة")}</h3>
          <p className="mb-0">{t("أسئلة قابلة لإعادة الاستخدام مع الإجابات والشروحات والنقاط والصعوبة والوسوم والدروس المرتبطة — لبناء اختبارات وأوراق عمل متوازنة في دقائق.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-light rounded-pill" onClick={seed} disabled={busy === "seed"}>{busy === "seed" ? <span className="spinner-border spinner-border-sm" /> : t("توليد من نقاط المقرر")}</button>
          <button className="btn btn-primary rounded-pill px-4" onClick={() => { setEditing(null); setShowForm(true); }}>+ {t("سؤال جديد")}</button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {[
          [stats?.total ?? items.length, "سؤال في البنك", "book"],
          [stats?.with_answers ?? 0, "سؤال له إجابة", "check"],
          [stats?.multiple_choice ?? 0, "اختيار من متعدد", "clipboard"],
          [stats?.courses_covered ?? 0, "دروس مشمولة", "layers"],
        ].map(([value, label, icon]) => (
          <div className="col-6 col-xl-3" key={label}>
            <div className="card border-0 shadow-sm h-100"><div className="card-body d-flex align-items-center gap-3">
              <span className="print-icon mb-0"><Icon name={icon} size={23} /></span>
              <span><span className="d-block fs-4 fw-bold">{value}</span><span className="text-secondary small">{t(label)}</span></span>
            </div></div>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100 generator-card">
            <div className="card-body">
              <div className="fw-bold mb-1"><Icon name="sparkle" size={18} /> {t("بناء اختبار أو ورقة عمل من البنك")}</div>
              <p className="text-secondary small">{t("اختر درسًا واحدًا أو عدة دروس وحدّد عدد الأسئلة من كل درس، أو اترك الاختيار فارغًا للتوليد من كل البنك بعدد إجمالي أو نقاط مستهدفة.")}</p>
              <div className="row g-2 align-items-end">
                <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("النوع")}</label><select className="form-select" value={gen.kind} onChange={(e) => setG("kind", e.target.value)}><option value="exam">{t("اختبار / فرض")}</option><option value="worksheet">{t("ورقة عمل / نشاط")}</option></select></div>
                <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الصعوبة")}</label><select className="form-select" value={gen.difficulty} onChange={(e) => setG("difficulty", e.target.value)}><option value="">{t("الكل")}</option>{DIFFICULTIES.map((x) => <option key={x} value={x}>{te(x)}</option>)}</select></div>
                <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("عدد الأسئلة (بدون اختيار دروس)")}</label><input type="number" min="1" max="200" className="form-control" disabled={quotaEntries.length > 0} value={gen.count} onChange={(e) => setG("count", e.target.value)} /></div>
                <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("النقاط المستهدفة")}</label><input type="number" min="0" step="0.5" className="form-control" disabled={quotaEntries.length > 0} value={gen.target_points} onChange={(e) => setG("target_points", e.target.value)} placeholder="20" /></div>
                <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("طريقة الاختيار")}</label><select className="form-select" value={gen.strategy} onChange={(e) => setG("strategy", e.target.value)}><option value="random">{t("عشوائي")}</option><option value="sequential">{t("حسب النص")}</option><option value="difficulty">{t("حسب الصعوبة")}</option><option value="points_desc">{t("الأعلى نقاطًا")}</option></select></div>
                <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("عنوان الوثيقة")}</label><input className="form-control" value={gen.title} onChange={(e) => setG("title", e.target.value)} placeholder={t("يُولّد تلقائيًا")} /></div>
                <div className="col-6 col-md-3"><div className="form-check"><input className="form-check-input" type="checkbox" checked={gen.balance_difficulty} onChange={(e) => setG("balance_difficulty", e.target.checked)} /><label className="form-check-label small fw-semibold">{t("موازنة الصعوبة")}</label></div><div className="form-check"><input className="form-check-input" type="checkbox" checked={gen.include_answer_key} onChange={(e) => setG("include_answer_key", e.target.checked)} /><label className="form-check-label small fw-semibold">{t("إرفاق مفتاح الإجابة")}</label></div></div>
                <div className="col-12 col-md-3"><button className="btn btn-primary rounded-pill w-100" disabled={busy === "gen"} onClick={() => generate(false)}>{busy === "gen" ? <span className="spinner-border spinner-border-sm" /> : t("توليد وفتح المحرّر")}</button></div>
              </div>
              <div className="lesson-quota-picker mt-3">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="fw-semibold small">{t("اختيار الدروس وعدد الأسئلة من كل درس")}</span>
                  <span className="badge rounded-pill text-bg-light border">{quotaEntries.length} {t("درس")} • {quotaRequested} {t("مطلوب")} • {quotaAvailable} {t("متاح")}</span>
                  <span className="ms-auto d-flex gap-1">
                    <button type="button" className="btn btn-sm btn-light rounded-pill" onClick={() => { const next = {}; courses.forEach((c) => { const avail = availableByCourse[c.id] || 0; if (avail) next[c.id] = Math.min(10, avail); }); setQuotas(next); }}>{t("تحديد الكل")}</button>
                    <button type="button" className="btn btn-sm btn-light rounded-pill" onClick={() => setQuotas({})}>{t("مسح الاختيار")}</button>
                  </span>
                </div>
                {courses.length === 0 ? <p className="text-secondary small mb-0">{t("لا دروس في المقرر بعد.")}</p> : (
                  <div className="lesson-quota-list">
                    {courses.map((c) => {
                      const avail = availableByCourse[c.id] || 0;
                      const checked = quotas[c.id] !== undefined;
                      return (
                        <div key={c.id} className={`lesson-quota-row ${checked ? "active" : ""}`}>
                          <label className="d-flex align-items-center gap-2 flex-grow-1 mb-0">
                            <input type="checkbox" className="form-check-input mt-0" checked={checked} disabled={!avail} onChange={() => toggleLesson(c)} />
                            <span className="fw-semibold small">{c.order}. {c.title}</span>
                          </label>
                          <span className={`badge rounded-pill ${avail ? "text-bg-light border" : "text-bg-warning"}`}>{avail} {t("سؤال متاح")}</span>
                          {checked && <span className="d-flex align-items-center gap-1">
                            <input type="number" min="1" max={Math.max(avail, 1)} className="form-control form-control-sm lesson-quota-input"
                              value={quotas[c.id]} onChange={(e) => setQuotas((cur) => ({ ...cur, [c.id]: e.target.value }))} />
                            <button type="button" className="btn btn-sm btn-light rounded-pill text-nowrap" onClick={() => setQuotas((cur) => ({ ...cur, [c.id]: avail }))}>{t("كل المتاح")}</button>
                          </span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="small text-secondary mt-1">{t("إذا اخترت دروسًا تُستخدم حصصها بدل العدد الإجمالي؛ وعند طلب أكثر من المتاح يُسلَّم كل المتاح ويُذكر النقص بعد التوليد.")}</div>
              </div>
              {selected.length > 0 && <div className="selected-question-bar">
                <span><b>{selected.length}</b> {t("أسئلة محددة")} • <b>{selectedPoints}</b> {t("نقطة")}</span>
                <button className="btn btn-sm btn-dark rounded-pill" disabled={busy === "gen-selected"} onClick={() => generate(true)}>{t("توليد من المحدد فقط")}</button>
                <button className="btn btn-sm btn-light rounded-pill" onClick={() => setSelected([])}>{t("إلغاء التحديد")}</button>
              </div>}
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="fw-bold mb-1"><Icon name="upload" size={18} /> {t("استيراد أسئلة من وثيقة موجودة")}</div>
              <p className="text-secondary small">{t("تُستخرج كل كتل الأسئلة من اختبار أو ورقة عمل قابلة للتحرير وتُحفظ في البنك، مع تجاوز الأسئلة المكررة.")}</p>
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-5"><label className="form-label small fw-semibold">{t("الوثيقة")}</label><select className="form-select" value={importDoc.document_id} onChange={(e) => setImportDoc((x) => ({ ...x, document_id: e.target.value }))}><option value="">{t("اختر وثيقة…")}</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></div>
                <div className="col-12 col-md-4"><label className="form-label small fw-semibold">{t("ربطها بدرس")}</label><select className="form-select" value={importDoc.course_id} onChange={(e) => setImportDoc((x) => ({ ...x, course_id: e.target.value }))}><option value="">{t("بدون درس محدد")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}</select></div>
                <div className="col-12 col-md-3"><button className="btn btn-dark rounded-pill w-100" disabled={!importDoc.document_id || busy === "import"} onClick={importFromDocument}>{busy === "import" ? <span className="spinner-border spinner-border-sm" /> : t("استيراد الأسئلة")}</button></div>
              </div>
              <div className="question-bank-note">{t("يمكنك أيضًا حفظ أي سؤال في بنك الأسئلة مباشرة من محرّر الوثائق أثناء تحرير كتلة أسئلة.")}</div>
            </div>
          </div>
        </div>
      </div>

      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
        sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
        sortOptions={[["-updated", "الأحدث تعديلًا"], ["updated", "الأقدم تعديلًا"], ["points_desc", "الأعلى نقاطًا"], ["points_asc", "الأقل نقاطًا"], ["prompt", "نص السؤال"]]}
        onReset={() => setF({ q: "", course: "", qtype: "", difficulty: "", tag: "", sort: "-updated" })}>
        <select className="form-select" value={f.course} onChange={(e) => setF((x) => ({ ...x, course: e.target.value }))}><option value="">{t("كل الدروس")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <select className="form-select" value={f.qtype} onChange={(e) => setF((x) => ({ ...x, qtype: e.target.value }))}><option value="">{t("كل الأنواع")}</option>{QTYPES.map((x) => <option key={x} value={x}>{te(x)}</option>)}</select>
        <select className="form-select" value={f.difficulty} onChange={(e) => setF((x) => ({ ...x, difficulty: e.target.value }))}><option value="">{t("كل الصعوبات")}</option>{DIFFICULTIES.map((x) => <option key={x} value={x}>{te(x)}</option>)}</select>
        <input className="form-control" style={{ maxWidth: 160 }} value={f.tag} placeholder={t("تصفية بوسم…")} onChange={(e) => setF((x) => ({ ...x, tag: e.target.value }))} />
      </FilterBar>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon="" title={t("لا أسئلة مطابقة")} hint={t("أضف سؤالًا جديدًا، ولّد أسئلة من نقاط المقرر، أو استوردها من اختبار موجود.")} />
      ) : (
        <div className="row g-3">
          {shown.map((x) => (
            <div className="col-12 col-xl-6" key={x.id}>
              <div className={`card border-0 shadow-sm h-100 question-bank-card ${selected.includes(x.id) ? "selected" : ""}`}>
                <div className="card-body d-flex flex-column">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <input className="form-check-input mt-0" type="checkbox" checked={selected.includes(x.id)} onChange={() => toggle(x.id)} aria-label={t("تحديد السؤال")} />
                    <span className="badge rounded-pill text-bg-primary">{te(x.qtype)}</span>
                    <span className={`badge rounded-pill ${difficultyClass(x.difficulty)}`}>{te(x.difficulty)}</span>
                    <span className="badge rounded-pill text-bg-light border">{x.points} {t("نقطة")}</span>
                    {x.course_title && <span className="badge rounded-pill text-bg-light border">{x.course_title}</span>}
                  </div>
                  <h6 className="fw-bold question-prompt">{x.prompt}</h6>
                  {(x.options || []).length > 0 && <div className="question-options-preview">{x.options.map((o, i) => <span key={i}>{String.fromCharCode(1571 + i)}. {o}</span>)}</div>}
                  {x.answer && <div className="question-answer-preview"><b>{t("الإجابة:")}</b> {x.answer}</div>}
                  {x.explanation && <p className="text-secondary small mb-2">{x.explanation}</p>}
                  {(x.tags || []).length > 0 && <div className="document-tags mt-0 mb-2">{x.tags.map((tag) => <span key={tag} className="badge rounded-pill text-bg-light border">#{tag}</span>)}</div>}
                  <div className="d-flex flex-wrap gap-2 mt-auto pt-2">
                    <button className="btn btn-sm btn-primary rounded-pill flex-grow-1" onClick={() => { setEditing(x); setShowForm(true); }}>{t("تحرير")}</button>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => duplicate(x)}>{t("نسخ")}</button>
                    <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(x)}>{t("حذف")}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <QuestionForm initial={editing} courses={courses} onClose={() => { setShowForm(false); setEditing(null); }}
        onSubmit={async (payload) => { if (editing) await update(editing.id, payload); else await create(payload); }} />}
      {confirm && <ConfirmModal title={t("حذف السؤال")} body={`${t("سيُحذف هذا السؤال من البنك نهائيًا:")} «${confirm.prompt.slice(0, 90)}»`}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </>
  );
}
