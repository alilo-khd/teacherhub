import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadFile, downloadPost, listOf, uploadFile } from "../api";
import { useResource } from "../hooks";
import { Spinner, EmptyState } from "../components/States";
import FilterBar from "../components/FilterBar";
import { ConfirmModal } from "../components/Modals";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";
import { KIND_LABELS, TOOL_GROUPS } from "../docTools";

const SOURCES = [
  { value: "journal", label: "الدفتر اليومي", endpoint: "/journals/", labelOf: (x) => x.title },
  { value: "inspector", label: "دفتر المفتش", endpoint: null, labelOf: () => "دفتر المفتش الكامل" },
  { value: "lesson-plan", label: "خطة درس", endpoint: "/lesson-plans/", labelOf: (x) => x.title },
  { value: "notebook", label: "دفتر ملاحظات", endpoint: "/notebooks/", labelOf: (x) => x.title },
  { value: "gradebook", label: "دفتر تنقيط فوج", endpoint: "/classes/", labelOf: (x) => x.name },
  { value: "class-report", label: "تقرير تقدم فوج", endpoint: "/classes/", labelOf: (x) => x.name },
  { value: "course", label: "مذكرة درس", endpoint: "/courses/", labelOf: (x) => `${x.order}. ${x.title}` },
  { value: "sessions", label: "سجل حصص (فوج أو الكل)", endpoint: "/classes/", labelOf: (x) => x.name, optional: true },
  { value: "timetable", label: "برنامج العمل الأسبوعي", endpoint: null, labelOf: () => "كل الأفواج" },
  { value: "observation", label: "شبكة ملاحظة حصة", endpoint: "/observations/", labelOf: (x) => `${x.date} — ${x.teacher_name || "ملاحظة"}` },
];

export default function CreatorStudioPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const { items, loading, error, create, remove, load } = useResource("/documents/");
  const [lists, setLists] = useState({});
  const [sourceType, setSourceType] = useState("journal");
  const [sourceId, setSourceId] = useState("");
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [f, setF] = useState({ q: "", kind: "", sort: "-updated", scope: "active", tag: "" });
  const [selected, setSelected] = useState([]);
  const [importingFile, setImportingFile] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDelete, setBulkDelete] = useState(false);
  const fileInputRef = useRef(null);
  const [gen, setGen] = useState({ generator: "report-cards", class_id: "", term: 1, mode: "threshold", min_average: 14, top_n: 3, columns: 15, strategy: "alphabetical", course_id: "", period: "" });
  const [generating, setGenerating] = useState(false);
  const setG = (k, v) => setGen((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    Promise.all(["/journals/", "/lesson-plans/", "/notebooks/", "/classes/", "/courses/", "/observations/"]
      .map((e) => api(e).then(listOf).catch(() => [])))
      .then(([j, p, n, c, co, o]) => setLists({ "/journals/": j, "/lesson-plans/": p, "/notebooks/": n, "/classes/": c, "/courses/": co, "/observations/": o }));
  }, []);

  const source = SOURCES.find((s) => s.value === sourceType);
  const sourceItems = source?.endpoint ? (lists[source.endpoint] || []) : [];

  useEffect(() => {
    if (!source?.endpoint) { setSourceId(""); return; }
    if (sourceItems.length && !sourceItems.some((x) => String(x.id) === String(sourceId))) {
      setSourceId(source.optional ? "" : String(sourceItems[0].id));
    }
  }, [sourceType, sourceItems]); // eslint-disable-line

  const genClasses = lists["/classes/"] || [];
  const genCourses = lists["/courses/"] || [];
  useEffect(() => {
    setGen((x) => ({ ...x,
      class_id: x.class_id || (genClasses[0] ? String(genClasses[0].id) : ""),
      course_id: x.course_id || (genCourses[0] ? String(genCourses[0].id) : "") }));
  }, [genClasses, genCourses]); // eslint-disable-line

  useEffect(() => {
    setSelected((ids) => ids.filter((id) => items.some((d) => d.id === id)));
  }, [items]);

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const tag = f.tag.trim().toLowerCase();
    return items.filter((d) => {
      const inScope = f.scope === "all" ? true
        : f.scope === "archived" ? !!d.is_archived
        : f.scope === "favorites" ? !!d.is_favorite && !d.is_archived
        : !d.is_archived;
      return inScope
        && (!q || d.title.toLowerCase().includes(q) || (d.tags || []).some((x) => String(x).toLowerCase().includes(q)))
        && (!f.kind || d.kind === f.kind)
        && (!tag || (d.tags || []).some((x) => String(x).toLowerCase().includes(tag)));
    }).sort((a, b) => f.sort === "title" ? a.title.localeCompare(b.title, "ar")
      : f.sort === "updated" ? String(a.updated_at).localeCompare(String(b.updated_at))
      : f.sort === "created" ? String(a.created_at).localeCompare(String(b.created_at))
      : f.sort === "-created" ? String(b.created_at).localeCompare(String(a.created_at))
      : String(b.updated_at).localeCompare(String(a.updated_at)));
  }, [items, f]);
  const shownIds = shown.map((d) => d.id);
  const allShownSelected = shown.length > 0 && shown.every((d) => selected.includes(d.id));
  const toggleSelected = (id) => setSelected((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const toggleShown = () => setSelected((ids) => allShownSelected
    ? ids.filter((id) => !shownIds.includes(id))
    : [...new Set([...ids, ...shownIds])]);

  const createFromTool = async (tool) => {
    setCreating(tool.kind);
    try {
      const saved = await create({ title: t(tool.label) === tool.label ? tool.label : tool.label, kind: tool.kind });
      navigate(`/editor/${saved.id}`);
    } catch { /* toast handled */ }
    setCreating("");
  };

  const createBlank = async () => {
    setCreating("blank");
    try {
      const saved = await create({ title: "وثيقة فارغة جديدة", kind: "blank" });
      navigate(`/editor/${saved.id}`);
    } catch { /* toast handled */ }
    setCreating("");
  };

  const importExisting = async () => {
    setImporting(true);
    try {
      const doc = await api("/documents/from-existing/", {
        method: "POST",
        body: { source_type: sourceType, source_id: sourceId ? Number(sourceId) : null },
      });
      toast(t("أُنشئت نسخة قابلة للتحرير"));
      navigate(`/editor/${doc.id}`);
    } catch (e) { toast(e.message, "danger"); }
    setImporting(false);
  };

  const runGenerator = async () => {
    setGenerating(true);
    try {
      const payload = { ...gen, term: Number(gen.term), min_average: Number(gen.min_average), top_n: Number(gen.top_n), columns: Number(gen.columns),
        class_id: gen.class_id ? Number(gen.class_id) : null, course_id: gen.course_id ? Number(gen.course_id) : null };
      const doc = await api("/documents/generate/", { method: "POST", body: payload });
      toast(t("وُلّدت وثيقة ذكية من بيانات المنصة"));
      navigate(`/editor/${doc.id}`);
    } catch (e) { toast(e.message, "danger"); }
    setGenerating(false);
  };
  const needsClass = ["report-cards", "honor-certificates", "attendance-sheet", "tracker-sheet", "student-id-cards", "seating-plan"].includes(gen.generator);
  const needsCourse = ["course-exam", "course-worksheet"].includes(gen.generator);

  const importFile = async (file) => {
    if (!file) return;
    setImportingFile(true);
    try {
      const doc = await uploadFile("/documents/import-file/", file);
      toast(t("استُورد الملف كوثيقة قابلة للتحرير"));
      navigate(`/editor/${doc.id}`);
    } catch (e) { toast(e.message, "danger"); }
    setImportingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const bulkAction = async (action) => {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      const result = await api("/documents/bulk/", { method: "POST", body: { ids: selected, action } });
      toast(`${result.updated} ${t("وثيقة حُدّثت")}`);
      if (action === "delete") setSelected([]);
      await load();
    } catch (e) { toast(e.message, "danger"); }
    setBulkBusy(false); setBulkDelete(false);
  };

  const bulkExport = async (format) => {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      await downloadPost("/documents/bulk-export/", { ids: selected, format }, "teacherhub-documents.zip");
      toast(t("تم تنزيل أرشيف الوثائق ZIP"));
    } catch (e) { toast(e.message, "danger"); }
    setBulkBusy(false);
  };

  const toggleMeta = async (d, patch) => {
    try { await api(`/documents/${d.id}/`, { method: "PATCH", body: patch }); await load(); }
    catch (e) { toast(e.message, "danger"); }
  };

  const exportJson = (d) => {
    downloadFile(`/documents/${d.id}/export-json/`, `${d.title}.teacherhub.json`)
      .then(() => toast(t("تم تنزيل نسخة JSON الاحتياطية")))
      .catch((e) => toast(e.message, "danger"));
  };

  const duplicate = async (d) => {
    try { await api(`/documents/${d.id}/duplicate/`, { method: "POST" }); toast(t("تمت نسخة الوثيقة")); load(); }
    catch (e) { toast(e.message, "danger"); }
  };

  const exportAs = (d, fmt) => {
    const path = fmt === "pdf" ? `/exports/custom/${d.id}/` : `/exports/custom/${d.id}/docx/`;
    downloadFile(path, `${d.title}.${fmt}`).then(() => toast(fmt === "pdf" ? t("تم تنزيل ملف PDF") : t("تم تنزيل ملف DOCX"))).catch((e) => toast(e.message, "danger"));
  };

  return (
    <>
      <div className="studio-hero d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div style={{ maxWidth: 680 }}>
          <h3 className="fw-bold mb-2">{t("استوديو الإنشاء والتحرير")}</h3>
          <p className="mb-0">{t("حرّر أي وثيقة بصريًا — عناوين ونصوص وجداول وأسئلة وبطاقات — ثم صدّرها PDF للطباعة أو DOCX لمتابعة التحرير في Word.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-light rounded-pill px-4" onClick={() => navigate("/question-bank")}>{t("بنك الأسئلة")}</button>
          <button className="btn btn-primary rounded-pill px-4" onClick={createBlank} disabled={creating === "blank"}>
            {creating === "blank" ? <span className="spinner-border spinner-border-sm" /> : <>+ {t("وثيقة فارغة جديدة")}</>}
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="fw-bold mb-1"><Icon name="pen" size={18} /> {t("تحويل وثيقة موجودة إلى نسخة قابلة للتحرير")}</div>
          <p className="text-secondary small">{t("تُلتقط محتويات الوثيقة الحالية (دفتر، خطة، دفتر تنقيط، شبكة ملاحظة…) في كتل قابلة للتحرير دون تغيير الأصل، ثم تُصدَّر PDF/DOCX.")}</p>
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold">{t("نوع الوثيقة")}</label>
              <select className="form-select" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label small fw-semibold">{t("العنصر")}</label>
              <select className="form-select" value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={!source?.endpoint}>
                {source?.optional && <option value="">{t("كل الأفواج")}</option>}
                {sourceItems.map((x) => <option key={x.id} value={x.id}>{source.labelOf(x)}</option>)}
                {!source?.endpoint && <option value="">{t(source.labelOf())}</option>}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <button className="btn btn-dark rounded-pill w-100" onClick={importExisting} disabled={importing}>
                {importing ? <span className="spinner-border spinner-border-sm" /> : t("إنشاء النسخة وفتح المحرّر")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`card border-0 shadow-sm mb-4 import-drop-card ${draggingFile ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
        onDragLeave={() => setDraggingFile(false)}
        onDrop={(e) => { e.preventDefault(); setDraggingFile(false); importFile(e.dataTransfer.files?.[0]); }}>
        <div className="card-body d-flex flex-wrap align-items-center gap-3">
          <div className="flex-grow-1" style={{ minWidth: 260 }}>
            <div className="fw-bold mb-1"><Icon name="upload" size={18} /> {t("استيراد ملف إلى وثيقة قابلة للتحرير")}</div>
            <p className="text-secondary small mb-0">{t("اسحب ملف PDF أو DOCX أو TXT أو Markdown أو CSV أو JSON هنا، أو اختره من جهازك. يُحوَّل النص والعناوين والجداول إلى كتل قابلة للتحرير؛ ملفات PDF الممسوحة ضوئيًا تحتاج OCR أولًا.")}</p>
          </div>
          <input ref={fileInputRef} type="file" className="d-none" accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
            onChange={(e) => importFile(e.target.files?.[0])} />
          <button className="btn btn-dark rounded-pill px-4" disabled={importingFile} onClick={() => fileInputRef.current?.click()}>
            {importingFile ? <span className="spinner-border spinner-border-sm" /> : t("اختيار ملف للاستيراد")}
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4 generator-card">
        <div className="card-body">
          <div className="fw-bold mb-1"><Icon name="sparkle" size={18} /> {t("مولّدات ذكية من بيانات المنصة")}</div>
          <p className="text-secondary small">{t("وثائق جاهزة تُبنى تلقائيًا من قوائم التلاميذ ونقاطهم ودروس المقرر — كشوف جماعية، شهادات متفوقين، سجلات حضور ومتابعة، بطاقات هوية، مخططات جلوس، واختبارات من الدرس.")}</p>
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label small fw-semibold">{t("المولّد")}</label>
              <select className="form-select" value={gen.generator} onChange={(e) => setG("generator", e.target.value)}>
                <option value="report-cards">{t("كشوف نقاط جماعية لفوج")}</option>
                <option value="honor-certificates">{t("شهادات المتفوقين من النقاط")}</option>
                <option value="attendance-sheet">{t("سجل حضور وغياب لفوج")}</option>
                <option value="tracker-sheet">{t("سجل متابعة واجبات وسلوك")}</option>
                <option value="student-id-cards">{t("بطاقات هوية تلاميذ فوج")}</option>
                <option value="seating-plan">{t("مخطط جلوس من قائمة فوج")}</option>
                <option value="course-exam">{t("اختبار من درس في المقرر")}</option>
                <option value="course-worksheet">{t("ورقة عمل من درس في المقرر")}</option>
              </select>
            </div>
            {needsClass && <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("الفوج")}</label>
              <select className="form-select" value={gen.class_id} onChange={(e) => setG("class_id", e.target.value)}>
                {genClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>}
            {needsCourse && <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold">{t("الدرس")}</label>
              <select className="form-select" value={gen.course_id} onChange={(e) => setG("course_id", e.target.value)}>
                {genCourses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}
              </select>
            </div>}
            {["report-cards", "honor-certificates"].includes(gen.generator) && <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("الثلاثي")}</label>
              <select className="form-select" value={gen.term} onChange={(e) => setG("term", e.target.value)}>
                <option value="1">{t("الثلاثي الأول")}</option><option value="2">{t("الثلاثي الثاني")}</option><option value="3">{t("الثلاثي الثالث")}</option>
              </select>
            </div>}
            {gen.generator === "honor-certificates" && <>
              <div className="col-6 col-md-2">
                <label className="form-label small fw-semibold">{t("معيار التكريم")}</label>
                <select className="form-select" value={gen.mode} onChange={(e) => setG("mode", e.target.value)}>
                  <option value="threshold">{t("معدل أدنى")}</option><option value="top">{t("الأوائل")}</option>
                </select>
              </div>
              <div className="col-6 col-md-1">
                <label className="form-label small fw-semibold">{gen.mode === "top" ? t("العدد") : t("المعدل")}</label>
                <input type="number" className="form-control" value={gen.mode === "top" ? gen.top_n : gen.min_average}
                  onChange={(e) => setG(gen.mode === "top" ? "top_n" : "min_average", e.target.value)} />
              </div>
            </>}
            {["attendance-sheet", "tracker-sheet"].includes(gen.generator) && <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("عدد الأعمدة")}</label>
              <input type="number" min="3" max="31" className="form-control" value={gen.columns} onChange={(e) => setG("columns", e.target.value)} />
            </div>}
            {gen.generator === "seating-plan" && <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("توزيع المقاعد")}</label>
              <select className="form-select" value={gen.strategy} onChange={(e) => setG("strategy", e.target.value)}>
                <option value="alphabetical">{t("أبجدي")}</option><option value="random">{t("عشوائي")}</option><option value="performance">{t("حسب المعدل")}</option>
              </select>
            </div>}
            <div className="col-12 col-md-2">
              <button className="btn btn-primary rounded-pill w-100" onClick={runGenerator} disabled={generating || (needsClass && !gen.class_id) || (needsCourse && !gen.course_id)}>
                {generating ? <span className="spinner-border spinner-border-sm" /> : t("توليد وفتح المحرّر")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {TOOL_GROUPS.map((g) => (
        <div key={g.label}>
          <h5 className="fw-bold mb-3">{t(g.label)}</h5>
          <div className="row g-3 mb-4">
            {g.tools.map((tool) => (
              <div className="col-12 col-md-6 col-xl-3" key={tool.kind}>
                <div className="card border-0 shadow-sm h-100 tool-card">
                  <div className="card-body d-flex flex-column">
                    <div className="print-icon"><Icon name={tool.icon} size={26} /></div>
                    <h6 className="fw-bold">{t(tool.label)}</h6>
                    <p className="text-secondary small flex-grow-1">{t(tool.desc)}</p>
                    <button className="btn btn-outline-primary rounded-pill w-100" disabled={creating === tool.kind} onClick={() => createFromTool(tool)}>
                      {creating === tool.kind ? <span className="spinner-border spinner-border-sm" /> : <>+ {t("إنشاء")}</>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <h5 className="fw-bold mb-3">{t("وثائقي القابلة للتحرير")}</h5>
      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
        sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
        onReset={() => setF({ q: "", kind: "", sort: "-updated", scope: "active", tag: "" })}
        sortOptions={[["-updated", "الأحدث تعديلًا"], ["updated", "الأقدم تعديلًا"], ["-created", "الأحدث إنشاءً"], ["created", "الأقدم إنشاءً"], ["title", "العنوان (أ-ي)"]]}>
        <select className="form-select" value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}>
          <option value="">{t("الكل")}</option>
          {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
        </select>
        <select className="form-select" value={f.scope} onChange={(e) => setF((x) => ({ ...x, scope: e.target.value }))} aria-label={t("نطاق المكتبة")}>
          <option value="active">{t("النشطة")}</option>
          <option value="favorites">{t("المفضلة")}</option>
          <option value="archived">{t("الأرشيف")}</option>
          <option value="all">{t("الكل مع الأرشيف")}</option>
        </select>
        <input className="form-control" style={{ maxWidth: 170 }} value={f.tag} placeholder={t("تصفية بوسم…")}
          onChange={(e) => setF((x) => ({ ...x, tag: e.target.value }))} />
      </FilterBar>
      {selected.length > 0 && (
        <div className="bulk-toolbar">
          <span className="fw-bold">{selected.length} {t("محددة")}</span>
          <button className="btn btn-sm btn-light rounded-pill" disabled={bulkBusy} onClick={() => bulkAction("favorite")}>{t("تفضيل")}</button>
          <button className="btn btn-sm btn-light rounded-pill" disabled={bulkBusy} onClick={() => bulkAction("archive")}>{t("أرشفة")}</button>
          <button className="btn btn-sm btn-light rounded-pill" disabled={bulkBusy} onClick={() => bulkAction("unarchive")}>{t("إلغاء الأرشفة")}</button>
          <button className="btn btn-sm btn-light rounded-pill" disabled={bulkBusy} onClick={() => bulkAction("duplicate")}>{t("نسخ")}</button>
          <span className="bulk-separator" />
          <button className="btn btn-sm btn-outline-light rounded-pill" disabled={bulkBusy} onClick={() => bulkExport("pdf")}>ZIP PDF</button>
          <button className="btn btn-sm btn-outline-light rounded-pill" disabled={bulkBusy} onClick={() => bulkExport("docx")}>ZIP DOCX</button>
          <button className="btn btn-sm btn-outline-light rounded-pill" disabled={bulkBusy} onClick={() => bulkExport("json")}>ZIP JSON</button>
          <button className="btn btn-sm btn-outline-danger rounded-pill" disabled={bulkBusy} onClick={() => setBulkDelete(true)}>{t("حذف المحدد")}</button>
          <button className="btn btn-sm btn-link text-white" disabled={bulkBusy} onClick={() => setSelected([])}>{t("إلغاء التحديد")}</button>
        </div>
      )}
      {shown.length > 0 && <div className="form-check mb-3">
        <input className="form-check-input" type="checkbox" checked={allShownSelected} onChange={toggleShown} />
        <label className="form-check-label small fw-semibold">{t("تحديد كل النتائج المعروضة")}</label>
      </div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : shown.length === 0 ? (
        <EmptyState icon="" title={t("لا وثائق قابلة للتحرير بعد")} hint={t("أنشئ أول وثيقة من الأدوات أعلاه أو حوّل وثيقة موجودة إلى نسخة قابلة للتحرير.")} />
      ) : (
        <div className="row g-3">
          {shown.map((d) => (
            <div className="col-12 col-md-6 col-xl-4" key={d.id}>
              <div className="card border-0 shadow-sm h-100 resource-card">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <input className="form-check-input mt-0" type="checkbox" checked={selected.includes(d.id)} onChange={() => toggleSelected(d.id)} aria-label={t("تحديد الوثيقة")} />
                      <span className="badge rounded-pill text-bg-primary">{t(KIND_LABELS[d.kind] || d.kind_label || d.kind)}</span>
                    </div>
                    <div className="d-flex gap-1">
                      <button className={`btn btn-sm ${d.is_favorite ? "btn-warning" : "btn-light"}`} title={d.is_favorite ? t("إزالة من المفضلة") : t("إضافة إلى المفضلة")}
                        onClick={() => toggleMeta(d, { is_favorite: !d.is_favorite })}>★</button>
                      <span className="badge rounded-pill text-bg-light border">{d.blocks_count} {t("كتلة")}</span>
                    </div>
                  </div>
                  {(d.tags || []).length > 0 && <div className="document-tags">{d.tags.map((tag) => <span key={tag} className="badge rounded-pill text-bg-light border">#{tag}</span>)}</div>}
                  {d.is_archived && <div><span className="badge rounded-pill text-bg-secondary">{t("مؤرشفة")}</span></div>}
                  <h6 className="fw-bold mt-2">{d.title}</h6>
                  <p className="text-secondary small flex-grow-1">{d.theme_detail?.name_ar || "—"} • {d.orientation === "landscape" ? t("أفقي (Landscape)") : t("عمودي (Portrait)")} • {String(d.updated_at || "").slice(0, 10)}</p>
                  <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-sm btn-primary rounded-pill flex-grow-1" onClick={() => navigate(`/editor/${d.id}`)}>{t("تحرير")}</button>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => exportAs(d, "pdf")}>PDF</button>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => exportAs(d, "docx")}>DOCX</button>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => duplicate(d)}>{t("نسخ")}</button>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => exportJson(d)}>JSON</button>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => toggleMeta(d, { is_archived: !d.is_archived })}>{d.is_archived ? t("استعادة") : t("أرشفة")}</button>
                    <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(d)}>{t("حذف")}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm && <ConfirmModal title={t("حذف الوثيقة")} body={`${t("ستُحذف")} «${confirm.title}» ${t("نهائيًا.")}`}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
      {bulkDelete && <ConfirmModal title={t("حذف الوثائق المحددة")} body={`${t("ستُحذف")} ${selected.length} ${t("وثيقة نهائيًا. يمكن أرشفتها بدلًا من حذفها.")}`}
        onConfirm={() => bulkAction("delete")} onClose={() => setBulkDelete(false)} />}
    </>
  );
}
