import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useResource, useThemes, usePersistentState } from "../hooks";
import { EmptyState, SkeletonCards, Spinner } from "../components/States";
import { ConfirmModal, ModalShell, ResourceFormModal } from "../components/Modals";
import { api, designApi, downloadPdf, listOf } from "../api";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { useLang } from "../i18n";


function useListFilter(items, key) {
  const [f, setF] = usePersistentState(key, { q: "", theme: "", sort: "-updated" });
  const shown = items.filter((x) =>
    (!f.q.trim() || (x.title || "").includes(f.q.trim())) &&
    (!f.theme || String(x.theme ?? "") === f.theme)
  ).sort((a, b) =>
    f.sort === "title" ? (a.title || "").localeCompare(b.title || "", "ar")
    : f.sort === "updated" ? String(a.updated_at).localeCompare(String(b.updated_at))
    : String(b.updated_at).localeCompare(String(a.updated_at)));
  return { f, setF, shown };
}

function PageHead({ title, sub, onAdd }) {
  const { t, te } = useLang();
  return (
    <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
      <div>
        <h3 className="fw-bold mb-1">{title}</h3>
        <p className="text-secondary mb-0">{sub}</p>
      </div>
      <button className="btn btn-primary rounded-pill px-4" onClick={onAdd}>+ إضافة جديد</button>
    </div>
  );
}

function ThemeBadge({ theme }) {
  const { t, te } = useLang();
  if (!theme) return <span className="badge rounded-pill text-bg-light border">{t("بدون سمة")}</span>;
  return (
    <span className="badge rounded-pill theme-name-badge"
      style={{ background: theme.soft, color: theme.deep, border: `1px solid ${theme.line}` }}>
       {theme.name_ar}
    </span>
  );
}

function CardActions({ onEdit, onDelete, previewTo }) {
  const { t, te } = useLang();
  return (
    <div className="d-flex gap-2 mt-3">
      <Link to={previewTo} className="btn btn-sm btn-primary rounded-pill flex-grow-1">{t("معاينة وتطبيق سمة")}</Link>
      <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={onEdit}>{t("تعديل")}</button>
      <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={onDelete}>{t("حذف")}</button>
    </div>
  );
}

/* ---------------------------------------------------------- journals */
const JOURNAL_FIELDS = [
  { name: "title", label: "عنوان الدفتر", required: true, wide: true },
  { name: "institution", label: "المؤسسة" },
  { name: "school_year", label: "السنة الدراسية" },
  { name: "teacher_name", label: "الأستاذ(ة)" },
  { name: "description", label: "وصف مختصر", type: "textarea", wide: true },
];



function CoverDesignerModal({ title, theme, initial, onSave, onClose }) {
  const { t } = useLang();
  const toast = useToast();
  const [image, setImage] = useState(initial?.image || "");
  const [layout, setLayout] = useState(initial?.layout || "none");
  const [motto, setMotto] = useState(initial?.motto || "");
  const [titleOverride, setTitleOverride] = useState(initial?.title_override || "");
  const [showInstitution, setShowInstitution] = useState(initial?.show_institution !== false);
  const [showYear, setShowYear] = useState(initial?.show_year !== false);
  const [showTeacher, setShowTeacher] = useState(initial?.show_teacher !== false);

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setImage(canvas.toDataURL("image/jpeg", 0.82));
      if (layout === "none") setLayout("top");
    };
    img.onerror = () => toast(t("تعذّرت قراءة الصورة"), "danger");
    img.src = url;
  };

  const save = async () => {
    try {
      await onSave({ image, layout: image ? layout : "none", motto, title_override: titleOverride,
                     show_institution: showInstitution, show_year: showYear, show_teacher: showTeacher });
      toast(t("حُفظ تصميم الغلاف — جرّبه في تصدير PDF"));
      onClose();
    } catch (e) { toast(e.message, "danger"); }
  };

  const deep = theme?.deep || "#1F4D5A";
  const accent = theme?.accent || "#D9A441";
  const paper = theme?.paper || "#fff";
  const headingFont = theme?.heading_font || "Tajawal";
  const previewText = (
    <>
      <div className="small fw-bold" style={{ color: accent }}>DAILY JOURNAL OF INFORMATICS</div>
      <div className="studio-cover-title" style={{ fontFamily: headingFont, color: deep }}>{titleOverride || t("الدفتر اليومي")}</div>
      <div style={{ color: accent }}>— ◆ —</div>
      <div className="fw-bold small">{t("مادة الإعلام الآلي")}</div>
      {motto && <div className="fw-bold small" style={{ color: accent }}>{motto}</div>}
      {showInstitution && <div className="small text-secondary">{t("المؤسسة:")} …</div>}
      {showYear && <div className="small text-secondary">{t("السنة الدراسية:")} …</div>}
      {showTeacher && <div className="small text-secondary">{t("الأستاذ(ة):")} …</div>}
    </>
  );

  return (
    <ModalShell title={title} wide onClose={onClose}>
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="cover-design-preview" style={{ background: paper, borderColor: theme?.line || "#ddd" }}>
            {layout === "top" && image && <img src={image} alt="" className="cover-design-img-top" />}
            {layout === "full" && image
              ? <div className="cover-design-full" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,.84), rgba(255,255,255,.84)), url(${image})` }}>{previewText}</div>
              : layout === "side" && image
                ? <div className="d-flex gap-3 align-items-center text-center"><img src={image} alt="" className="cover-design-img-side" /><div className="flex-grow-1">{previewText}</div></div>
                : <div className="text-center">{previewText}</div>}
          </div>
          <label className="btn btn-outline-primary rounded-pill w-100 mt-3">
             {t("رفع صورة / شعار")}
            <input type="file" accept="image/*" hidden onChange={onFile} />
          </label>
          {image && <button className="btn btn-light rounded-pill w-100 mt-2" onClick={() => { setImage(""); setLayout("none"); }}>{t("إزالة الصورة")}</button>}
        </div>
        <div className="col-12 col-lg-6">
          <label className="form-label small fw-bold">{t("موضع الصورة")}</label>
          <div className="btn-group w-100 mb-3" role="group">
            {[["none", "بدون"], ["top", "أعلى الغلاف"], ["side", "جانبية"], ["full", "خلفية كاملة"]].map(([value, label]) => (
              <button key={value} type="button" disabled={!image && value !== "none"}
                className={`btn btn-sm ${layout === value ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setLayout(value)}>{t(label)}</button>
            ))}
          </div>
          <label className="form-label small fw-bold">{t("شعار / عبارة على الغلاف")}</label>
          <input className="form-control form-control-sm mb-3" value={motto} onChange={(e) => setMotto(e.target.value)} placeholder={t("مثال: العلم نور")} />
          <label className="form-label small fw-bold">{t("عنوان بديل للغلاف (اختياري)")}</label>
          <input className="form-control form-control-sm mb-3" value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)} />
          <div className="fw-bold small mb-2">{t("ما يظهر على الغلاف")}</div>
          {[["المؤسسة", showInstitution, setShowInstitution], ["السنة الدراسية", showYear, setShowYear], ["اسم الأستاذ", showTeacher, setShowTeacher]].map(([label, value, setter]) => (
            <label key={label} className="form-check d-flex gap-2 align-items-center mb-2">
              <input type="checkbox" className="form-check-input" checked={value} onChange={(e) => setter(e.target.checked)} />
              <span className="small">{t(label)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="d-flex gap-2 mt-4">
        <button className="btn btn-primary rounded-pill px-4" onClick={save}>{t("حفظ تصميم الغلاف")}</button>
        <button className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
      </div>
    </ModalShell>
  );
}

function SectionComposer({ title, meta, defaults, initial, onSave, onClose }) {
  const { t } = useLang();
  const toast = useToast();
  const [keys, setKeys] = useState(() => {
    const chosen = (initial?.sections || []).filter((k) => meta.some((m) => m.key === k));
    return chosen.length ? chosen : [...defaults];
  });
  const [notesRows, setNotesRows] = useState(initial?.notes_rows ?? 12);
  const move = (index, dir) => {
    const next = [...keys];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setKeys(next);
  };
  const toggle = (key, checked) => {
    setKeys((prev) => {
      if (key === "cover") return prev;
      if (checked) {
        const rest = meta.map((m) => m.key).filter((k) => [...prev, key].includes(k));
        return rest;
      }
      return prev.filter((k) => k !== key);
    });
  };
  const save = async () => {
    try {
      await onSave({ sections: keys, notes_rows: Number(notesRows) || 0 });
      toast("حُفظ تخصيص الصفحات — سيظهر في التصدير الموالي لدفترك");
      onClose();
    } catch (e) { toast(e.message, "danger"); }
  };
  return (
    <ModalShell title={title} wide onClose={onClose}>
      <p className="text-secondary small">{t("فعّل الأقسام التي تريدها في دفترك المطبوع، ورتّبها بالأسهم — القسم الأول بعد الغلاف هو صفحتك الثانية. الغلاف ثابت دائمًا في المقدمة.")}</p>
      <div className="d-flex flex-column gap-2 mb-3">
        {meta.map((section) => {
          const index = keys.indexOf(section.key);
          const active = index >= 0;
          return (
            <div key={section.key} className={`composer-row ${active ? "" : "off"}`}>
              <input type="checkbox" className="form-check-input" checked={active} disabled={section.key === "cover"}
                onChange={(e) => toggle(section.key, e.target.checked)} />
              <span className="flex-grow-1 small fw-bold">{section.label}</span>
              {active && <span className="badge text-bg-light border">{index + 1}</span>}
              <button className="btn btn-sm btn-light border" disabled={!active || index <= 1} onClick={() => move(index, -1)}>↑</button>
              <button className="btn btn-sm btn-light border" disabled={!active || index < 0 || index >= keys.length - 1} onClick={() => move(index, 1)}>↓</button>
            </div>
          );
        })}
      </div>
      {keys.includes("notes") && (
        <div className="d-flex align-items-center gap-3 mb-3">
          <label className="form-label small fw-bold mb-0">{t("أسطر صفحة الملاحظات:")}</label>
          <input type="range" min="0" max="40" value={notesRows} onChange={(e) => setNotesRows(e.target.value)} className="flex-grow-1" />
          <span className="badge text-bg-primary">{notesRows}</span>
        </div>
      )}
      <div className="d-flex flex-wrap gap-2">
        <button className="btn btn-primary rounded-pill px-4" onClick={save}>{t("حفظ التخصيص")}</button>
        <button className="btn btn-outline-secondary rounded-pill px-4" onClick={() => { setKeys([...defaults]); setNotesRows(12); }}>{t("استعادة الافتراضي")}</button>
        <button className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إغلاق")}</button>
      </div>
    </ModalShell>
  );
}

export function JournalsPage() {
  const { t, te } = useLang();
  const { items, loading, error, create, update, remove } = useResource("/journals/");
  const { themes } = useThemes();
  const { f, setF, shown } = useListFilter(items, "journals-filters");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [design, setDesign] = useState(null);
  const [composerFor, setComposerFor] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [coverFor, setCoverFor] = useState(null);
  const [inspectorCoverOpen, setInspectorCoverOpen] = useState(false);
  const [inspectorCover, setInspectorCover] = useState({});
  const [inspectorConfig, setInspectorConfig] = useState({});
  const toast = useToast();

  useEffect(() => { designApi.sections().then(setDesign).catch(() => {}); }, []);
  useEffect(() => {
    api("/profile/").then((profile) => { setInspectorConfig(profile.inspector_page_config || {}); setInspectorCover(profile.cover_config || {}); }).catch(() => {});
  }, []);

  const saveInspectorCover = async (config) => {
    const profile = await api("/profile/");
    await api("/profile/", { method: "PUT", body: { ...profile, cover_config: config } });
    setInspectorCover(config);
  };

  const saveInspectorConfig = async (config) => {
    const profile = await api("/profile/");
    await api("/profile/", { method: "PUT", body: { ...profile, inspector_page_config: config } });
    setInspectorConfig(config);
  };

  return (
    <>
      <PageHead title={t("الدفاتر اليومية")} sub={t("دفاترك بصيغها وهوياتها المختلفة — خصّص أقسام كل دفتر وصفحاته من زر «تخصيص الصفحات».")}
        onAdd={() => setModal({})} />
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center gap-2 py-3">
          <span className="fs-5"></span>
          <div className="flex-grow-1">
            <div className="fw-bold">{t("دفتر المفتش")}</div>
            <div className="text-secondary small">{t("خصّص أقسام دفتر المفتش المطبوع وعدد أسطر ملاحظاته.")}</div>
          </div>
          <button className="btn btn-outline-primary rounded-pill px-4" onClick={() => setInspectorOpen(true)}>{t("تخصيص صفحات المفتش")}</button>
          <button className="btn btn-outline-dark rounded-pill px-4" onClick={() => setInspectorCoverOpen(true)}>{t("تصميم غلاف المفتش")}</button>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <SkeletonCards count={3} /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا دفاتر بعد")} hint={t("أنشئ دفترك اليومي الأول واختر له سمة من المكتبة.")}
          actionLabel={t("إنشاء دفتر")} onAction={() => setModal({})} />
      ) : (<>
        <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
          sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
          onReset={() => setF({ q: "", theme: "", sort: "-updated" })}
          sortOptions={[["-updated", "الأحدث تعديلًا"], ["updated", "الأقدم تعديلًا"], ["title", "العنوان (أ-ي)"]]}>
          <select className="form-select" value={f.theme} onChange={(e) => setF((x) => ({ ...x, theme: e.target.value }))}>
            <option value="">{t("كل السمات")}</option>
            {themes.map((th) => <option key={th.id} value={String(th.id)}>{th.name_ar}</option>)}
          </select>
        </FilterBar>
        <div className="row g-3">
          {shown.map((j) => (
            <div className="col-12 col-md-6 col-xl-4" key={j.id}>
              <div className={`card border-0 shadow-sm h-100 resource-card ${j._temp ? "is-temp" : ""}`}>
                <div className="resource-stripe" style={{ background: j.theme_detail ? `linear-gradient(90deg, ${j.theme_detail.deep}, ${j.theme_detail.accent})` : "#dee2e6" }} />
                <div className="card-body d-flex flex-column">
                  <h6 className="fw-bold">{j.title}</h6>
                  <p className="text-secondary small flex-grow-1">
                    {j.institution || "—"} • {j.school_year}<br />{j.teacher_name}
                  </p>
                  {typeof j.sessions_count === "number" && (
                    <span className="badge rounded-pill text-bg-light border mb-2 align-self-start">
                       {j.sessions_count} حصة منفَّذة مرتبطة بهذا الدفتر
                    </span>
                  )}
                  <ThemeBadge theme={j.theme_detail} />
                  <div className="d-flex flex-wrap gap-1 mb-2">
                    <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => setComposerFor(j)}>
                       {t("تخصيص الصفحات")}
                    </button>
                    <button className="btn btn-sm btn-outline-dark rounded-pill" onClick={() => setCoverFor(j)}>
                       {t("تصميم الغلاف")}
                    </button>
                  </div>
                  <CardActions previewTo={`/preview/journal/${j.id}`}
                    onEdit={() => setModal(j)} onDelete={() => setConfirm(j)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </>)}
      {modal !== null && (
        <ResourceFormModal title={modal.id ? t("تعديل الدفتر") : t("دفتر يومي جديد")}
          fields={JOURNAL_FIELDS} initial={modal} themes={themes}
          onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))}
          onClose={() => setModal(null)} />
      )}
      {confirm && (
        <ConfirmModal title={t("حذف الدفتر")} body={`سيُحذف «${confirm.title}» نهائيًا.`}
          onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />
      )}
      {composerFor && design && (
        <SectionComposer title={`${t("تخصيص صفحات:")} ${composerFor.title}`}
          meta={design.journal.sections} defaults={design.journal.default_sections}
          initial={composerFor.page_config || {}}
          onSave={(config) => update(composerFor.id, { page_config: config })}
          onClose={() => setComposerFor(null)} />
      )}
      {coverFor && (
        <CoverDesignerModal title={`${t("تصميم الغلاف:")} ${coverFor.title}`} theme={coverFor.theme_detail}
          initial={coverFor.cover_config || {}}
          onSave={(config) => update(coverFor.id, { cover_config: config })}
          onClose={() => setCoverFor(null)} />
      )}
      {inspectorCoverOpen && (
        <CoverDesignerModal title={t("تصميم غلاف دفتر المفتش")} theme={null}
          initial={inspectorCover}
          onSave={saveInspectorCover}
          onClose={() => setInspectorCoverOpen(false)} />
      )}
      {inspectorOpen && design && (
        <SectionComposer title={t("تخصيص صفحات دفتر المفتش")}
          meta={design.inspector.sections} defaults={design.inspector.default_sections}
          initial={inspectorConfig}
          onSave={saveInspectorConfig}
          onClose={() => setInspectorOpen(false)} />
      )}
    </>
  );
}

/* ---------------------------------------------------------- lesson plans */
export function LessonPlansPage({ newPlanSignal }) {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const { items, loading, error, create, update, remove } = useResource("/lesson-plans/");
  const { themes } = useThemes();
  const [courses, setCourses] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [params] = useSearchParams();
  const openedRef = useRef(false);
  const { f, setF, shown } = useListFilter(items, "plans-filters");

  useEffect(() => {
    api("/courses/").then((d) => setCourses(listOf(d))).catch(() => {});
  }, []);

  // opened from a course card: pre-link the new plan to that course
  useEffect(() => {
    const cid = params.get("course");
    if (cid && courses.length && !openedRef.current) {
      openedRef.current = true;
      const c = courses.find((x) => String(x.id) === cid);
      if (c) navigate(`/lesson-plans/new?course=${c.id}`);
    }
  }, [params, courses]);

  const planParam = params.get("plan");
  const targetPlan = planParam ? items.find((x) => String(x.id) === planParam) : null;
  useEffect(() => {
    if (!planParam || loading) return;
    const target = items.find((x) => String(x.id) === planParam);
    if (target && !shown.some((x) => x.id === target.id)) { setF({ q: "", theme: "", sort: "-updated" }); return; }
    const el = document.getElementById(`plan-card-${planParam}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [planParam, loading, items, shown, setF]);


  return (
    <>
      <PageHead title={t("خطط الدروس")} sub={t("خطط كاملة بأطوارها الخمسة — طبّق عليها أي سمة.")}
        onAdd={() => navigate("/lesson-plans/new")} />
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <Link to="/courses" className="btn btn-sm btn-outline-dark rounded-pill"> {t("الدروس والمقرر الدراسي")}</Link>
        <span className="text-secondary small">{t("من كل خطة تصل إلى درسها المرتبط في المقرر، ومن كل درس إلى خطته.")}</span>
      </div>
      {targetPlan && (
        <div className="alert alert-info d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span> {t("وصلت من الدرس — هذه هي الخطة المرتبطة:")} <b>{targetPlan.title}</b></span>
          <button className="btn btn-sm btn-outline-dark rounded-pill" onClick={() => navigate(`/lesson-plans/${targetPlan.id}/edit`)}>{t("تحرير الخطة")}</button>
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <SkeletonCards count={3} /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا خطط دروس بعد")} hint={t("اكتب خطة درسك الأولى وستظهر هنا جاهزة للمعاينة والتطبيق.")}
          actionLabel={t("إنشاء خطة")} onAction={() => navigate("/lesson-plans/new")} />
      ) : (<>
        <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
          sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
          onReset={() => setF({ q: "", theme: "", sort: "-updated" })}
          sortOptions={[["-updated", "الأحدث تعديلًا"], ["updated", "الأقدم تعديلًا"], ["title", "العنوان (أ-ي)"]]}>
          <select className="form-select" value={f.theme} onChange={(e) => setF((x) => ({ ...x, theme: e.target.value }))}>
            <option value="">{t("كل السمات")}</option>
            {themes.map((th) => <option key={th.id} value={String(th.id)}>{th.name_ar}</option>)}
          </select>
        </FilterBar>
        <div className="row g-3">
          {shown.map((p) => (
            <div className="col-12 col-md-6 col-xl-4" key={p.id} id={`plan-card-${p.id}`}>
              <div className={`card border-0 shadow-sm h-100 resource-card ${p._temp ? "is-temp" : ""} ${String(p.id) === planParam ? "highlight-card" : ""}`}>
                <div className="resource-stripe" style={{ background: p.theme_detail ? `linear-gradient(90deg, ${p.theme_detail.deep}, ${p.theme_detail.accent})` : "#dee2e6" }} />
                <div className="card-body d-flex flex-column">
                  <h6 className="fw-bold">{p.title}</h6>
                  <p className="text-secondary small flex-grow-1">
                    {p.domain}<br />{p.unit} • {p.duration} دقيقة
                  </p>
                  {p.course_title ? (
                    <Link to={`/courses?lesson=${p.course}`}
                      className="badge rounded-pill text-bg-light border mb-2 align-self-start text-decoration-none linked-chip">
                       {t("الدرس المرتبط:")} {p.course_title} — {t("فتح الدرس")} ↗ • {t("دُرّس في")} {p.sessions_count ?? 0} {t("حصة")}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => navigate(`/lesson-plans/${p.id}/edit`)}
                      className="badge rounded-pill text-bg-light border mb-2 align-self-start text-secondary linked-chip">
                      {t("ربط بدرس من المقرر…")}
                    </button>
                  )}
                  <ThemeBadge theme={p.theme_detail} />
                  <CardActions previewTo={`/preview/lesson-plan/${p.id}`}
                    onEdit={() => navigate(`/lesson-plans/${p.id}/edit`)} onDelete={() => setConfirm(p)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </>)}
      {confirm && (
        <ConfirmModal title={t("حذف خطة الدرس")} body={`ستُحذف خطة «${confirm.title}» نهائيًا.`}
          onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />
      )}
    </>
  );
}

/* ---------------------------------------------------------- note books */
const BOOK_FIELDS = [
  { name: "title", label: "عنوان الدفتر", required: true, wide: true },
  { name: "class_name", label: "القسم / الأفواج" },
];

const EMPTY_LINK = { school_class: "", course: "", session: "" };
const toId = (v) => (v === "" || v == null ? null : Number(v));

function EntriesModal({ book, onClose }) {
  const { t, te } = useLang();
  const [entries, setEntries] = useState(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), title: "", content: "", tag: "عامة", ...EMPTY_LINK });
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filterClass, setFilterClass] = useState("");
  const [ef, setEf] = useState({ q: "", tag: "", course: "", from: "", to: "", sort: "-date" });
  const setE = (k, v) => setEf((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = () => api(`/notebooks/${book.id}/entries/`).then((d) => setEntries(listOf(d)));
  useEffect(() => { load(); }, [book.id]);
  useEffect(() => {
    Promise.all([api("/classes/"), api("/courses/"), api("/sessions/")])
      .then(([c, k, s]) => { setClasses(listOf(c)); setCourses(listOf(k)); setSessions(listOf(s)); })
      .catch(() => {});
  }, []);

  const shownSessions = sessions.filter((s) => !form.school_class || String(s.school_class) === String(form.school_class));

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...form, school_class: toId(form.school_class), course: toId(form.course), session: toId(form.session) };
    const temp = { ...payload, id: `tmp-${Date.now()}`, _temp: true };
    setEntries((xs) => [temp, ...(xs || [])]);
    try {
      const saved = await api(`/notebooks/${book.id}/entries/`, { method: "POST", body: payload });
      setEntries((xs) => xs.map((x) => (x.id === temp.id ? saved : x)));
      setForm({ ...form, title: "", content: "" });
      toast(t("أُضيفت الملاحظة مرتبطة بسياقها"));
    } catch (err) {
      setEntries((xs) => xs.filter((x) => x.id !== temp.id));
      toast(err.message, "danger");
    }
    setBusy(false);
  };

  const del = async (id) => {
    let snap, idx;
    setEntries((xs) => { idx = xs.findIndex((x) => x.id === id); snap = xs[idx]; return xs.filter((x) => x.id !== id); });
    try { await api(`/note-entries/${id}/`, { method: "DELETE" }); toast(t("حُذفت الملاحظة"), "warning"); }
    catch (err) {
      setEntries((xs) => { const c = [...xs]; c.splice(idx, 0, snap); return c; });
      toast(err.message, "danger");
    }
  };

  const shownEntries = (entries || []).filter((e) =>
    (!filterClass || String(e.school_class) === filterClass) &&
    (!ef.tag || e.tag === ef.tag) &&
    (!ef.course || String(e.course) === ef.course) &&
    (!ef.from || e.date >= ef.from) && (!ef.to || e.date <= ef.to) &&
    (!ef.q.trim() || e.title.includes(ef.q.trim()) || (e.content || "").includes(ef.q.trim()))
  ).sort((a, b) =>
    ef.sort === "date" ? a.date.localeCompare(b.date)
    : ef.sort === "title" ? a.title.localeCompare(b.title, "ar")
    : b.date.localeCompare(a.date));
  const printEntries = () => {
    const qs = new URLSearchParams();
    if (ef.tag) qs.set("tag", ef.tag);
    if (filterClass) qs.set("class", filterClass);
    if (ef.course) qs.set("course", ef.course);
    if (ef.from) qs.set("from", ef.from);
    if (ef.to) qs.set("to", ef.to);
    qs.set("order", ef.sort === "date" ? "oldest" : "newest");
    downloadPdf(`/exports/notebook/${book.id}/?${qs.toString()}`, `دفتر ملاحظات — ${book.title}.pdf`)
      .then(() => toast(t("تم تنزيل دفتر الملاحظات PDF")))
      .catch((err) => toast(err.message, "danger"));
  };

  return (
    <ModalShell title={`ملاحظات: ${book.title}`} wide onClose={onClose}>
      <form onSubmit={add} className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <input type="date" className="form-control" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
            {["عامة", "مهمة", "متابعة", "إدارية"].map((tag) => <option key={tag} value={tag}>{te(tag)}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-6">
          <input className="form-control" placeholder={t("عنوان الملاحظة *")} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="col-12">
          <textarea className="form-control" rows={2} placeholder={t("نص الملاحظة…")}
            value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold small mb-1">{t("ربط بفوج (اختياري)")}</label>
          <select className="form-select" value={form.school_class}
            onChange={(e) => setForm({ ...form, school_class: e.target.value, session: "" })}>
            <option value="">— بدون ربط —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold small mb-1">{t("ربط بدرس (اختياري)")}</label>
          <select className="form-select" value={form.course}
            onChange={(e) => setForm({ ...form, course: e.target.value })}>
            <option value="">— بدون ربط —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-semibold small mb-1">{t("ربط بحصة منفَّذة (اختياري)")}</label>
          <select className="form-select" value={form.session}
            onChange={(e) => setForm({ ...form, session: e.target.value })}>
            <option value="">— بدون ربط —</option>
            {shownSessions.map((s) => (
              <option key={s.id} value={s.id}>{s.date} • {s.course_title || "حصة"} • {s.class_name}</option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>
            {busy ? <span className="spinner-border spinner-border-sm" /> : "+ إضافة الملاحظة"}
          </button>
        </div>
      </form>

      <FilterBar search={ef.q} onSearch={(v) => setE("q", v)} count={shownEntries.length}
        sort={ef.sort} onSort={(v) => setE("sort", v)}
        onReset={() => { setEf({ q: "", tag: "", course: "", from: "", to: "", sort: "-date" }); setFilterClass(""); }}
        sortOptions={[["-date", "التاريخ (الأحدث)"], ["date", "التاريخ (الأقدم)"], ["title", "العنوان (أ-ي)"]]}
        extra={<button type="button" className="btn btn-sm btn-outline-primary" onClick={printEntries}>{t("طباعة الملاحظات المفلترة PDF")}</button>}>
        <select className="form-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">{t("كل الملاحظات")}</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" value={ef.tag} onChange={(e) => setE("tag", e.target.value)}>
          <option value="">{t("كل الوسوم")}</option>
          {["عامة", "مهمة", "متابعة", "إدارية"].map((tag) => <option key={tag} value={tag}>{te(tag)}</option>)}
        </select>
        <select className="form-select" value={ef.course} onChange={(e) => setE("course", e.target.value)}>
          <option value="">{t("كل الدروس")}</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <input type="date" className="form-control" value={ef.from} onChange={(e) => setE("from", e.target.value)} aria-label={t("من تاريخ")} />
        <input type="date" className="form-control" value={ef.to} onChange={(e) => setE("to", e.target.value)} aria-label={t("إلى تاريخ")} />
      </FilterBar>

      {entries === null ? <Spinner /> : shownEntries.length === 0 ? (
        <EmptyState icon="" title={t("لا ملاحظات مطابقة للفلاتر")} hint={t("جرّب توسيع نطاق التاريخ أو إعادة تعيين الفلاتر، أو أضف ملاحظة جديدة من النموذج أعلاه.")} />
      ) : (
        <div className="list-group list-group-flush entry-list">
          {shownEntries.map((e) => (
            <div key={e.id} className={`list-group-item d-flex gap-3 align-items-start ${e._temp ? "is-temp" : ""}`}>
              <span className={`badge rounded-pill tag-${e.tag}`}>{te(e.tag)}</span>
              <div className="flex-grow-1">
                <div className="fw-semibold">{e.title}</div>
                <div className="text-secondary small">{e.content}</div>
                <div className="d-flex flex-wrap gap-1 mt-1">
                  {e.class_name && <span className="point-chip"> {e.class_name}</span>}
                  {e.course_title && <span className="point-chip"> {e.course_title}</span>}
                  {e.session_label && <span className="point-chip"> حصة: {e.session_label}</span>}
                </div>
                <div className="text-secondary entry-date">{e.date}</div>
              </div>
              <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => del(e.id)}>{t("حذف")}</button>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

export function NoteBooksPage() {
  const { t, te } = useLang();
  const { items, loading, error, create, update, remove } = useResource("/notebooks/");
  const { themes } = useThemes();
  const { f, setF, shown } = useListFilter(items, "notebooks-filters");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [entriesOf, setEntriesOf] = useState(null);

  return (
    <>
      <PageHead title={t("دفاتر الملاحظات")} sub={t("ركّز ملاحظات الحصص والمتابعة في دفاتر مخصصة.")}
        onAdd={() => setModal({})} />
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <SkeletonCards count={3} /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا دفاتر ملاحظات بعد")} hint={t("أنشئ دفترًا وابدأ تدوين ملاحظات حصصك.")}
          actionLabel={t("إنشاء دفتر")} onAction={() => setModal({})} />
      ) : (<>
        <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
          sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
          onReset={() => setF({ q: "", theme: "", sort: "-updated" })}
          sortOptions={[["-updated", "الأحدث تعديلًا"], ["updated", "الأقدم تعديلًا"], ["title", "العنوان (أ-ي)"]]}>
          <select className="form-select" value={f.theme} onChange={(e) => setF((x) => ({ ...x, theme: e.target.value }))}>
            <option value="">{t("كل السمات")}</option>
            {themes.map((th) => <option key={th.id} value={String(th.id)}>{th.name_ar}</option>)}
          </select>
        </FilterBar>
        <div className="row g-3">
          {shown.map((b) => (
            <div className="col-12 col-md-6 col-xl-4" key={b.id}>
              <div className={`card border-0 shadow-sm h-100 resource-card ${b._temp ? "is-temp" : ""}`}>
                <div className="resource-stripe" style={{ background: b.theme_detail ? `linear-gradient(90deg, ${b.theme_detail.deep}, ${b.theme_detail.accent})` : "#dee2e6" }} />
                <div className="card-body d-flex flex-column">
                  <h6 className="fw-bold">{b.title}</h6>
                  <p className="text-secondary small flex-grow-1">
                    {b.class_name || "—"} • {b.entries_count ?? 0} ملاحظة
                  </p>
                  <ThemeBadge theme={b.theme_detail} />
                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-sm btn-primary rounded-pill flex-grow-1" onClick={() => setEntriesOf(b)}>
                      الملاحظات
                    </button>
                    <Link to={`/preview/notebook/${b.id}`} className="btn btn-sm btn-outline-primary rounded-pill">{t("معاينة")}</Link>
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(b)}>{t("تعديل")}</button>
                    <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(b)}>{t("حذف")}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>)}
      {modal !== null && (
        <ResourceFormModal title={modal.id ? t("تعديل دفتر الملاحظات") : t("دفتر ملاحظات جديد")}
          fields={BOOK_FIELDS} initial={modal} themes={themes}
          onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))}
          onClose={() => setModal(null)} />
      )}
      {confirm && (
        <ConfirmModal title={t("حذف دفتر الملاحظات")} body={`سيُحذف «${confirm.title}» وكل ملاحظاته.`}
          onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />
      )}
      {entriesOf && <EntriesModal book={entriesOf} onClose={() => setEntriesOf(null)} />}
    </>
  );
}
