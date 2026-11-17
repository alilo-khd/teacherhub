import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadFile, listOf } from "../api";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";
import BlockPreview from "../components/BlockPreview";
import { ConfirmModal } from "../components/Modals";
import { BLOCK_TYPES, KIND_LABELS, newBlock } from "../docTools";

const lines = (arr) => (arr || []).join("\n");
const parseLines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const rowsText = (rows) => (rows || []).map((r) => (Array.isArray(r) ? r.join(" | ") : String(r))).join("\n");
const parseRows = (s) => parseLines(s).map((line) => line.split("|").map((x) => x.trim()));
const cardsText = (cards) => (cards || []).map((c) => `${c.front || ""} | ${c.back || ""}`).join("\n");
const parseCards = (s) => parseLines(s).map((line) => { const [front, ...rest] = line.split("|"); return { front: front.trim(), back: rest.join("|").trim() }; });

function Field({ label, children }) {
  return <label className="d-block mb-2"><span className="form-label small fw-semibold">{label}</span>{children}</label>;
}

function QuestionEditor({ q, update, remove, saveToBank }) {
  const { t } = useLang();
  return (
    <div className="question-editor">
      <div className="d-flex gap-2">
        <input className="form-control" value={q.prompt || ""} placeholder={t("نص السؤال")} onChange={(e) => update({ prompt: e.target.value })} />
        <button type="button" className="btn btn-sm btn-outline-secondary" title={t("حفظ هذا السؤال في بنك الأسئلة")} onClick={saveToBank}>{t("حفظ في البنك")}</button>
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={remove}>{t("حذف")}</button>
      </div>
      <div className="row g-2 mt-1">
        <div className="col-6 col-md-3">
          <select className="form-select form-select-sm" value={q.qtype || "سؤال قصير"} onChange={(e) => update({ qtype: e.target.value })}>
            {["سؤال قصير", "اختيار من متعدد", "صح / خطأ", "سؤال مقالي", "أكمل الفراغ", "تصنيف", "نشاط تطبيقي"].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="col-3 col-md-2"><input type="number" min="0" step="0.5" className="form-control form-control-sm" value={q.points ?? ""} title={t("النقطة")} onChange={(e) => update({ points: e.target.value === "" ? "" : Number(e.target.value) })} /></div>
        <div className="col-3 col-md-2"><input type="number" min="0" max="12" className="form-control form-control-sm" value={q.lines ?? 0} title={t("أسطر الإجابة")} onChange={(e) => update({ lines: Number(e.target.value) })} /></div>
        <div className="col-12 col-md-5"><input className="form-control form-control-sm" value={q.answer || ""} placeholder={t("الإجابة الصحيحة (لمفتاح الإجابة)")} onChange={(e) => update({ answer: e.target.value })} /></div>
      </div>
      <textarea className="form-control form-control-sm mt-2" rows={2} value={lines(q.options)} placeholder={t("الخيارات — خيار في كل سطر (لأسئلة الاختيار)")} onChange={(e) => update({ options: parseLines(e.target.value) })} />
    </div>
  );
}

function BlockEditor({ block, update, classes, courses, fillNames, generateFromCourse, bankItems, importBankQuestions, saveQuestionToBank }) {
  const { t } = useLang();
  const [fillClass, setFillClass] = useState("");
  const [courseId, setCourseId] = useState("");
  const [bankCourseId, setBankCourseId] = useState("");
  const [bankQuestionId, setBankQuestionId] = useState("");
  const bankForCourse = (bankItems || []).filter((x) => !bankCourseId || String(x.course) === String(bankCourseId));
  const namesTool = ["certificates", "labels", "seating"].includes(block.type) && (
    <div className="d-flex gap-2 mt-2">
      <select className="form-select form-select-sm" value={fillClass} onChange={(e) => setFillClass(e.target.value)}>
        <option value="">{t("اختر فوجًا لتعبئة أسماء تلاميذه")}</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" disabled={!fillClass} onClick={() => fillNames(block, fillClass)}>{t("تعبئة الأسماء")}</button>
    </div>
  );
  switch (block.type) {
    case "cover":
      return <>
        <Field label={t("العنوان")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("العنوان الفرعي")}><input className="form-control" value={block.subtitle || ""} onChange={(e) => update({ subtitle: e.target.value })} /></Field>
        <Field label={t("سطور معلومات الغلاف")}><textarea className="form-control" rows={3} value={lines(block.meta)} onChange={(e) => update({ meta: parseLines(e.target.value) })} /></Field>
      </>;
    case "heading":
      return <Field label={t("نص العنوان")}><input className="form-control" value={block.text || ""} onChange={(e) => update({ text: e.target.value })} /></Field>;
    case "text":
    case "poster":
      return <>
        {block.type === "poster" && <>
          <Field label={t("عنوان الملصق")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
          <Field label={t("العنوان الفرعي")}><input className="form-control" value={block.subtitle || ""} onChange={(e) => update({ subtitle: e.target.value })} /></Field>
        </>}
        <Field label={t("النص")}><textarea className="form-control" rows={6} value={block.text || ""} onChange={(e) => update({ text: e.target.value })} /></Field>
        {block.type === "poster" && <Field label={t("سطر ختامي")}><input className="form-control" value={block.footer || ""} onChange={(e) => update({ footer: e.target.value })} /></Field>}
      </>;
    case "fields":
      return <>
        <Field label={t("عنوان القسم")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("الحقول — «التسمية | القيمة» في كل سطر")}><textarea className="form-control" rows={5} value={rowsText(block.rows)} onChange={(e) => update({ rows: parseRows(e.target.value) })} /></Field>
      </>;
    case "table":
      return <>
        <Field label={t("عنوان الجدول")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("رؤوس الأعمدة — مفصولة بـ |")}><input className="form-control" value={(block.headers || []).join(" | ")} onChange={(e) => update({ headers: e.target.value.split("|").map((x) => x.trim()) })} /></Field>
        <Field label={t("الصفوف — خلايا مفصولة بـ |")}><textarea className="form-control" rows={6} value={rowsText(block.rows)} onChange={(e) => update({ rows: parseRows(e.target.value) })} /></Field>
      </>;
    case "checklist":
      return <>
        <Field label={t("عنوان القائمة")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("العناصر — عنصر في كل سطر")}><textarea className="form-control" rows={5} value={lines(block.items)} onChange={(e) => update({ items: parseLines(e.target.value) })} /></Field>
      </>;
    case "questions":
      return <>
        <Field label={t("عنوان قسم الأسئلة")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <div className="form-check form-switch mb-2">
          <input className="form-check-input" type="checkbox" checked={!!block.show_answers} onChange={(e) => update({ show_answers: e.target.checked })} />
          <label className="form-check-label small fw-semibold">{t("إظهار مفتاح الإجابة في نهاية الوثيقة")}</label>
        </div>
        <div className="d-flex gap-2 mb-2">
          <select className="form-select form-select-sm" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">{t("توليد أسئلة من نقاط درس…")}</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}
          </select>
          <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" disabled={!courseId} onClick={() => generateFromCourse(block, courseId)}>{t("توليد")}</button>
        </div>
        <div className="question-bank-import">
          <div className="d-flex gap-2 mb-2">
            <select className="form-select form-select-sm" value={bankCourseId} onChange={(e) => { setBankCourseId(e.target.value); setBankQuestionId(""); }}>
              <option value="">{t("أسئلة البنك لكل الدروس")}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-outline-dark text-nowrap" disabled={!bankForCourse.length} onClick={() => importBankQuestions(bankForCourse)}>{t("إضافة كل المعروضة")}</button>
            <Link to="/question-bank" className="btn btn-sm btn-light text-nowrap">{t("فتح البنك")}</Link>
          </div>
          <div className="d-flex gap-2">
            <select className="form-select form-select-sm" value={bankQuestionId} onChange={(e) => setBankQuestionId(e.target.value)}>
              <option value="">{t("اختر سؤالًا من البنك…")}</option>
              {bankForCourse.map((x) => <option key={x.id} value={x.id}>{x.prompt.slice(0, 90)} ({x.points} ن)</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-outline-primary text-nowrap" disabled={!bankQuestionId}
              onClick={() => importBankQuestions(bankForCourse.filter((x) => String(x.id) === String(bankQuestionId)))}>{t("إضافة السؤال")}</button>
          </div>
        </div>
        {(block.questions || []).map((q, qi) => (
          <QuestionEditor key={qi} q={q}
            update={(patch) => update({ questions: block.questions.map((x, i) => i === qi ? { ...x, ...patch } : x) })}
            remove={() => update({ questions: block.questions.filter((_, i) => i !== qi) })}
            saveToBank={() => saveQuestionToBank(q)} />
        ))}
        <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => update({ questions: [...(block.questions || []), { prompt: "", qtype: "سؤال قصير", points: 2, options: [], answer: "", lines: 3 }] })}>+ {t("سؤال جديد")}</button>
      </>;
    case "cards":
      return <>
        <Field label={t("عنوان البطاقات")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("البطاقات — «الوجه | الظهر» في كل سطر")}><textarea className="form-control" rows={7} value={cardsText(block.cards)} onChange={(e) => update({ cards: parseCards(e.target.value) })} /></Field>
      </>;
    case "certificates":
      return <>
        <Field label={t("عنوان الشهادة")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("نص الشهادة")}><textarea className="form-control" rows={3} value={block.text || ""} onChange={(e) => update({ text: e.target.value })} /></Field>
        <div className="row g-2"><div className="col-6"><Field label={t("الموقّع")}><input className="form-control" value={block.signer || ""} onChange={(e) => update({ signer: e.target.value })} /></Field></div>
        <div className="col-6"><Field label={t("التاريخ")}><input className="form-control" value={block.date || ""} onChange={(e) => update({ date: e.target.value })} /></Field></div></div>
        <Field label={t("أسماء المكرَّمين — اسم في كل سطر (شهادة لكل اسم)")}><textarea className="form-control" rows={6} value={lines(block.names)} onChange={(e) => update({ names: parseLines(e.target.value) })} /></Field>
        {namesTool}
      </>;
    case "seating":
      return <>
        <Field label={t("عنوان المخطط")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("واجهة القسم")}><input className="form-control" value={block.front || ""} onChange={(e) => update({ front: e.target.value })} /></Field>
        <div className="row g-2"><div className="col-6"><Field label={t("الصفوف")}><input type="number" min="1" max="10" className="form-control" value={block.rows || 4} onChange={(e) => update({ rows: Number(e.target.value) })} /></Field></div>
        <div className="col-6"><Field label={t("الأعمدة")}><input type="number" min="1" max="10" className="form-control" value={block.cols || 5} onChange={(e) => update({ cols: Number(e.target.value) })} /></Field></div></div>
        <Field label={t("أسماء المقاعد بالترتيب — اسم في كل سطر")}><textarea className="form-control" rows={6} value={lines(block.seats)} onChange={(e) => update({ seats: parseLines(e.target.value) })} /></Field>
        {namesTool}
      </>;
    case "idcards":
      return <>
        <Field label={t("عنوان البطاقات")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("البطاقات — «الاسم | بيانات | سطر سفلي» في كل سطر")}><textarea className="form-control" rows={7}
          value={(block.cards || []).map((c) => `${c.name || ""} | ${c.meta || ""} | ${c.footer || ""}`).join("\n")}
          onChange={(e) => update({ cards: parseLines(e.target.value).map((line) => { const [name, meta, footer] = line.split("|").map((x) => (x || "").trim()); return { name, meta: meta || "", footer: footer || "" }; }) })} /></Field>
      </>;
    case "labels":
      return <>
        <Field label={t("عنوان البطاقات")}><input className="form-control" value={block.title || ""} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label={t("نص فرعي تحت الاسم")}><input className="form-control" value={block.subtitle || ""} onChange={(e) => update({ subtitle: e.target.value })} /></Field>
        <Field label={t("الأسماء — اسم في كل سطر")}><textarea className="form-control" rows={6} value={lines(block.names)} onChange={(e) => update({ names: parseLines(e.target.value) })} /></Field>
        {namesTool}
      </>;
    case "signatures":
      return <Field label={t("أدوار الإمضاء — دور في كل سطر")}><textarea className="form-control" rows={3} value={lines(block.roles)} onChange={(e) => update({ roles: parseLines(e.target.value) })} /></Field>;
    case "pagebreak":
      return <p className="text-secondary small mb-0">{t("يبدأ ما بعده في صفحة جديدة عند الطباعة.")}</p>;
    default:
      return null;
  }
}

export default function DocumentEditorPage() {
  const { t } = useLang();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [themes, setThemes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [bankItems, setBankItems] = useState([]);
  const [addType, setAddType] = useState("heading");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [revisions, setRevisions] = useState([]);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const [lastSaved, setLastSaved] = useState("");
  const [zoom, setZoom] = useState(100);
  const [dragIndex, setDragIndex] = useState(null);
  const [collapsed, setCollapsed] = useState([]);
  const [tagsText, setTagsText] = useState("");
  const historyRef = useRef({ past: [], future: [] });

  useEffect(() => {
    Promise.all([api(`/documents/${id}/`), api("/themes/"), api("/classes/"), api("/courses/"), api("/question-bank/").catch(() => [])])
      .then(([d, th, cl, co, qb]) => {
        setDoc(d); setBlocks(d.content?.blocks || []); setTagsText((d.tags || []).join("، "));
        setThemes(listOf(th)); setClasses(listOf(cl)); setCourses(listOf(co)); setBankItems(listOf(qb));
        api(`/documents/${d.id}/revisions/`).then(setRevisions).catch(() => {});
      }).catch((e) => setError(e.message));
  }, [id]);

  const theme = useMemo(() => themes.find((x) => String(x.id) === String(doc?.theme)) || doc?.theme_detail || themes[0], [themes, doc]);
  const touch = (fn) => {
    historyRef.current.past.push(JSON.stringify(blocks));
    if (historyRef.current.past.length > 60) historyRef.current.past.shift();
    historyRef.current.future = [];
    setBlocks((prev) => (typeof fn === "function" ? fn(prev) : fn));
    setDirty(true);
  };
  const undo = () => {
    const past = historyRef.current.past;
    if (!past.length) return;
    historyRef.current.future.push(JSON.stringify(blocks));
    setBlocks(JSON.parse(past.pop())); setDirty(true);
  };
  const redo = () => {
    const future = historyRef.current.future;
    if (!future.length) return;
    historyRef.current.past.push(JSON.stringify(blocks));
    setBlocks(JSON.parse(future.pop())); setDirty(true);
  };
  const reorder = (from, to) => {
    if (from === null || to === null || from === to) return;
    touch((xs) => { const c = [...xs]; const [moved] = c.splice(from, 1); c.splice(to, 0, moved); return c; });
  };
  const updateBlock = (i, patch) => touch((xs) => xs.map((b, j) => j === i ? { ...b, ...patch } : b));
  const move = (i, dir) => touch((xs) => { const c = [...xs]; const j = i + dir; if (j < 0 || j >= c.length) return xs; [c[i], c[j]] = [c[j], c[i]]; return c; });

  const save = useCallback(async (silent = false) => {
    if (!doc) return null;
    setSaving(true);
    try {
      const saved = await api(`/documents/${doc.id}/`, { method: "PATCH", body: { title: doc.title, kind: doc.kind, theme: doc.theme || null, orientation: doc.orientation, tags: doc.tags || [], is_favorite: !!doc.is_favorite, is_archived: !!doc.is_archived, content: { blocks } } });
      setDoc(saved); setDirty(false); setLastSaved(new Date().toLocaleTimeString());
      api(`/documents/${doc.id}/revisions/`).then(setRevisions).catch(() => {});
      if (!silent) toast(t("تم حفظ الوثيقة"));
      return saved;
    } catch (e) { toast(e.message, "danger"); return null; }
    finally { setSaving(false); }
  }, [doc, blocks, toast, t]);

  useEffect(() => {
    const fn = (e) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "s") { e.preventDefault(); save(); }
      else if ((e.ctrlKey || e.metaKey) && key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (key === "y" || (key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn);
  }); // undo/redo read latest state via refs/blocks each render

  useEffect(() => {
    if (!autosave || !doc || !dirty || saving) return;
    const id_ = setTimeout(() => { save(true); }, 1600);
    return () => clearTimeout(id_);
  }, [autosave, dirty, blocks, doc?.title, doc?.theme, doc?.orientation, doc?.tags, doc?.is_favorite, doc?.is_archived]); // eslint-disable-line

  const createSnapshot = async () => {
    try {
      await api(`/documents/${doc.id}/revisions/`, { method: "POST", body: { label: "لقطة يدوية من المحرّر" } });
      const rows = await api(`/documents/${doc.id}/revisions/`); setRevisions(rows); toast(t("حُفظت لقطة يدوية"));
    } catch (e) { toast(e.message, "danger"); }
  };
  const restoreRevision = async (rev) => {
    try {
      const saved = await api(`/documents/${doc.id}/revisions/${rev.id}/restore/`, { method: "POST", body: {} });
      setDoc(saved); setBlocks(saved.content?.blocks || []); setDirty(false);
      const rows = await api(`/documents/${doc.id}/revisions/`); setRevisions(rows); toast(t("استُعيدت النسخة"));
    } catch (e) { toast(e.message, "danger"); }
  };
  const refreshSource = async () => {
    setRefreshing(true);
    try {
      const saved = await api(`/documents/${doc.id}/refresh-source/`, { method: "POST", body: {} });
      setDoc(saved); setBlocks(saved.content?.blocks || []); setDirty(false);
      const rows = await api(`/documents/${doc.id}/revisions/`); setRevisions(rows); toast(t("حُدّثت الكتل من المصدر الحي"));
    } catch (e) { toast(e.message, "danger"); }
    setRefreshing(false);
  };

  const exportAs = async (fmt) => {
    const saved = await save(true);
    if (!saved) return;
    downloadFile(fmt === "pdf" ? `/exports/custom/${doc.id}/` : `/exports/custom/${doc.id}/docx/`, `${doc.title}.${fmt}`)
      .then(() => toast(fmt === "pdf" ? t("تم تنزيل ملف PDF") : t("تم تنزيل ملف DOCX")))
      .catch((e) => toast(e.message, "danger"));
  };

  const fillNames = async (blockIndex, clsId) => {
    try {
      const students = listOf(await api(`/students/?class=${clsId}`));
      const names = students.map((s) => s.full_name);
      if (!names.length) { toast(t("لا تلاميذ في هذا الفوج"), "warning"); return; }
      touch((xs) => xs.map((b, j) => {
        if (j !== blockIndex) return b;
        if (b.type === "seating") return { ...b, seats: names };
        return { ...b, names };
      }));
      toast(t("تمت تعبئة الأسماء"));
    } catch (e) { toast(e.message, "danger"); }
  };

  const generateFromCourse = (blockIndex, courseId) => {
    const course = courses.find((c) => String(c.id) === String(courseId));
    if (!course) return;
    const generated = (course.key_points || []).map((point) => ({ prompt: `اشرح المقصود بـ: ${point}`, qtype: "سؤال قصير", points: 2, options: [], answer: point, lines: 3 }));
    if (!generated.length) { toast(t("لا نقاط أساسية مسجلة لهذا الدرس"), "warning"); return; }
    touch((xs) => xs.map((b, j) => j === blockIndex ? { ...b, questions: [...(b.questions || []), ...generated] } : b));
    toast(t("وُلّدت الأسئلة من نقاط الدرس"));
  };

  const importBankQuestions = (blockIndex, selectedItems) => {
    if (!selectedItems?.length) { toast(t("لا أسئلة مطابقة في بنك الأسئلة"), "warning"); return; }
    const normalized = selectedItems.map((x) => ({ prompt: x.prompt, qtype: x.qtype, points: x.points, options: x.options || [], answer: x.answer || "", lines: x.lines ?? 3 }));
    touch((xs) => xs.map((b, j) => j === blockIndex ? { ...b, questions: [...(b.questions || []), ...normalized] } : b));
    toast(`${t("أُضيف")} ${normalized.length} ${t("سؤالًا من بنك الأسئلة")}`);
  };

  const saveQuestionToBank = async (q) => {
    if (!String(q.prompt || "").trim()) { toast(t("اكتب نص السؤال قبل حفظه في البنك"), "warning"); return; }
    try {
      const saved = await api("/question-bank/", { method: "POST", body: {
        prompt: q.prompt, qtype: q.qtype || "سؤال قصير", difficulty: "متوسط", points: Number(q.points || 2),
        options: q.options || [], answer: q.answer || "", explanation: "", lines: Number(q.lines || 3), tags: doc.tags || [],
      }});
      setBankItems((xs) => [saved, ...xs]); toast(t("حُفظ السؤال في بنك الأسئلة"));
    } catch (e) { toast(e.message, "danger"); }
  };

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!doc) return <Spinner label={t("جارٍ فتح محرّر الوثيقة…")} />;

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h3 className="fw-bold mb-1">{t("محرّر الوثائق")}</h3>
          <p className="text-secondary mb-0">{t(KIND_LABELS[doc.kind] || doc.kind_label)} {dirty ? `• ${t("توجد تغييرات غير محفوظة")}` : `• ${t("محفوظة")}`}{lastSaved ? ` • ${t("آخر حفظ")} ${lastSaved}` : ""}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/creator" className="btn btn-light rounded-pill">{t("استوديو الإنشاء")}</Link>
          <button className="btn btn-light rounded-pill" onClick={undo} title="Ctrl+Z">↩ {t("تراجع")}</button>
          <button className="btn btn-light rounded-pill" onClick={redo} title="Ctrl+Y">↪ {t("إعادة")}</button>
          <button className="btn btn-dark rounded-pill px-4" onClick={() => save()} disabled={saving || !dirty}>{saving ? <span className="spinner-border spinner-border-sm" /> : t("حفظ (Ctrl+S)")}</button>
          <button className="btn btn-outline-secondary rounded-pill" onClick={() => downloadFile(`/documents/${doc.id}/export-json/`, `${doc.title}.teacherhub.json`).then(() => toast(t("تم تنزيل نسخة JSON الاحتياطية"))).catch((e) => toast(e.message, "danger"))}>JSON</button>
          <button className="btn btn-outline-primary rounded-pill" onClick={() => exportAs("docx")}>DOCX</button>
          <button className="btn btn-primary rounded-pill px-4" onClick={() => exportAs("pdf")}>PDF</button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold">{t("عنوان الوثيقة")}</label>
            <input className="form-control" value={doc.title} onChange={(e) => { setDoc({ ...doc, title: e.target.value }); setDirty(true); }} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold">{t("سمة الوثيقة")}</label>
            <select className="form-select" value={doc.theme || ""} onChange={(e) => { setDoc({ ...doc, theme: e.target.value ? Number(e.target.value) : null }); setDirty(true); }}>
              <option value="">{t("البدلة الكحلية افتراضيًا")}</option>
              {themes.map((th) => <option key={th.id} value={th.id}>{th.name_ar}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold">{t("اتجاه الصفحة")}</label>
            <select className="form-select" value={doc.orientation} onChange={(e) => { setDoc({ ...doc, orientation: e.target.value }); setDirty(true); }}>
              <option value="portrait">{t("عمودي (Portrait)")}</option>
              <option value="landscape">{t("أفقي (Landscape)")}</option>
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-semibold">{t("وسوم الوثيقة")}</label>
            <input className="form-control" value={tagsText} placeholder={t("اختبارات، ثلاثي أول…")}
              onChange={(e) => { setTagsText(e.target.value); setDoc({ ...doc, tags: e.target.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean) }); setDirty(true); }} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-semibold">{t("تنظيم المكتبة")}</label>
            <div className="d-flex gap-3 pt-2">
              <label className="form-check small"><input className="form-check-input" type="checkbox" checked={!!doc.is_favorite} onChange={(e) => { setDoc({ ...doc, is_favorite: e.target.checked }); setDirty(true); }} /> {t("مفضلة")}</label>
              <label className="form-check small"><input className="form-check-input" type="checkbox" checked={!!doc.is_archived} onChange={(e) => { setDoc({ ...doc, is_archived: e.target.checked }); setDirty(true); }} /> {t("مؤرشفة")}</label>
            </div>
          </div>
          <div className="col-12 col-md-2">
            <span className="badge rounded-pill text-bg-light border w-100 py-2">{blocks.length} {t("كتلة")}</span>
            <div className="form-check form-switch mt-2">
              <input className="form-check-input" type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} />
              <label className="form-check-label small fw-semibold">{t("حفظ تلقائي")}</label>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <span className="fw-bold">{t("النسخ والاسترجاع")}</span>
                <span className="badge rounded-pill text-bg-light border">{revisions.length}</span>
              </div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={createSnapshot}>{t("حفظ لقطة يدوية")}</button>
                {doc.source_type && <button type="button" className="btn btn-sm btn-outline-dark rounded-pill" disabled={refreshing} onClick={refreshSource}>{refreshing ? <span className="spinner-border spinner-border-sm" /> : t("تحديث من المصدر الحي")}</button>}
              </div>
              {doc.source_type && <div className="small text-secondary mt-2">{t("التحديث من المصدر يعيد بناء الكتل من أحدث بيانات المنصة ويحفظ نسخة قبل التحديث.")}</div>}
              <div className="revision-list mt-2">
                {revisions.slice(0, 6).map((r) => (
                  <div key={r.id} className="revision-row">
                    <span className="flex-grow-1"><b>{r.label || t("لقطة")}</b> <span className="text-secondary">{String(r.created_at || "").replace("T", " ").slice(0, 16)} • {r.blocks_count} {t("كتلة")}</span></span>
                    <button type="button" className="btn btn-sm btn-light rounded-pill" onClick={() => setConfirmRestore(r)}>{t("استرجاع")}</button>
                  </div>
                ))}
                {revisions.length === 0 && <div className="small text-secondary">{t("لا نسخ محفوظة بعد — تُحفظ نسخة تلقائيًا قبل كل حفظ.")}</div>}
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="fw-bold mb-2">{t("إضافة كتلة محتوى")}</div>
              <div className="d-flex gap-2">
                <select className="form-select" value={addType} onChange={(e) => setAddType(e.target.value)}>
                  {BLOCK_TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                </select>
                <button className="btn btn-primary rounded-pill text-nowrap" onClick={() => touch((xs) => [...xs, newBlock(addType)])}>+ {t("إضافة")}</button>
              </div>
              <div className="small text-secondary mt-2">{t("رتّب الكتل بالأسهم، حرّر محتواها، وستتحدث المعاينة والتصدير فورًا.")}</div>
            </div>
          </div>

          {blocks.map((b, i) => (
            <div className={`card border-0 shadow-sm mb-3 block-card ${b.hidden ? "block-hidden" : ""} ${dragIndex === i ? "block-dragging" : ""}`} key={i}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); reorder(dragIndex, i); setDragIndex(null); }}>
              <div className="card-header bg-white d-flex align-items-center gap-2" draggable
                onDragStart={() => setDragIndex(i)} onDragEnd={() => setDragIndex(null)} title={t("اسحب لإعادة الترتيب")}>
                <span className="drag-handle">⠿</span>
                <span className="badge rounded-pill text-bg-dark">{i + 1}</span>
                <span className="fw-bold small flex-grow-1">{t(BLOCK_TYPES.find(([v]) => v === b.type)?.[1] || b.type)}{b.hidden ? ` • ${t("مخفية")}` : ""}</span>
                <button type="button" className="btn btn-sm btn-light" title={t("طي / توسيع")} onClick={() => setCollapsed((xs) => xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i])}>{collapsed.includes(i) ? "+" : "−"}</button>
                <button type="button" className="btn btn-sm btn-light" title={t("نقل لأعلى")} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="btn btn-sm btn-light" title={t("نقل لأسفل")} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="btn btn-sm btn-light" title={b.hidden ? t("إظهار في الطباعة") : t("إخفاء من الطباعة")} onClick={() => updateBlock(i, { hidden: !b.hidden })}>{b.hidden ? t("إظهار") : t("إخفاء")}</button>
                <button type="button" className="btn btn-sm btn-light" title={t("إضافة كتلة أسفل هذه")} onClick={() => touch((xs) => [...xs.slice(0, i + 1), newBlock(addType), ...xs.slice(i + 1)])}>+↓</button>
                <button type="button" className="btn btn-sm btn-light" title={t("تكرار الكتلة")} onClick={() => touch((xs) => [...xs.slice(0, i + 1), JSON.parse(JSON.stringify(b)), ...xs.slice(i + 1)])}><Icon name="plus" size={14} /></button>
                <button type="button" className="btn btn-sm btn-outline-danger" title={t("حذف الكتلة")} onClick={() => touch((xs) => xs.filter((_, j) => j !== i))}>{t("حذف")}</button>
              </div>
              {!collapsed.includes(i) && <div className="card-body">
                <BlockEditor block={b} update={(patch) => updateBlock(i, patch)} classes={classes} courses={courses}
                  fillNames={(blk, clsId) => fillNames(i, clsId)} generateFromCourse={(blk, cid) => generateFromCourse(i, cid)}
                  bankItems={bankItems} importBankQuestions={(selectedItems) => importBankQuestions(i, selectedItems)}
                  saveQuestionToBank={saveQuestionToBank} />
              </div>}
            </div>
          ))}
        </div>

        <div className="col-12 col-xl-7">
          <div className="editor-preview-wrap">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold"><Icon name="printer" size={17} /> {t("معاينة الطباعة الحية")}</span>
              <span className="d-flex align-items-center gap-2">
                <span className="small text-secondary">{doc.orientation === "landscape" ? t("أفقي (Landscape)") : t("عمودي (Portrait)")} • {theme?.name_ar}</span>
                <select className="form-select form-select-sm" style={{ width: 92 }} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} title={t("تكبير المعاينة")}>
                  {[75, 100, 125].map((z) => <option key={z} value={z}>{z}٪</option>)}
                </select>
              </span>
            </div>
            <div style={{ zoom: zoom / 100 }}>
              <BlockPreview blocks={blocks} theme={theme} title={doc.title} orientation={doc.orientation} />
            </div>
          </div>
        </div>
      </div>
      {confirmRestore && <ConfirmModal title={t("استرجاع نسخة سابقة")} body={`${t("ستُستبدل محتويات الوثيقة الحالية بنسخة")} «${confirmRestore.label || confirmRestore.created_at}». ${t("ستُحفظ نسخة من الحالة الحالية أولًا.")}`}
        onConfirm={async () => { await restoreRevision(confirmRestore); setConfirmRestore(null); }} onClose={() => setConfirmRestore(null)} />}
    </>
  );
}
