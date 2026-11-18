import { useEffect, useMemo, useState } from "react";
import { api, designApi, listOf, themeApi } from "../api";
import { useThemes } from "../hooks";
import { EmptyState, SkeletonCards } from "../components/States";
import ThemeCard from "../components/ThemeCard";
import DocPreview from "../components/DocPreview";
import { ApplyThemeModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

const STYLES = ["", "كلاسيكية", "عصرية", "دافئة", "باردة", "أحادية"];
const STYLE_TYPES = [["classical", "كلاسيكية"], ["modern", "عصرية"], ["warm", "دافئة"],
                     ["cool", "باردة"], ["administrative", "إدارية"], ["youthful", "شبابية"]];
const COLOR_FIELDS = [
  ["deep", "اللون الأساسي"], ["deeper", "اللون الأعمق"], ["ink", "لون الحبر"],
  ["accent", "لون التمييز"], ["accent2", "اللون الثانوي"], ["soft", "خلفية ناعمة"],
  ["soft2", "خلفية أفتح"], ["line", "لون الحدود"], ["paper", "لون الصفحة"],
];
const DEFAULT_NEW = {
  name_ar: "سمتي الجديدة", name_en: "My Theme", tagline: "سمة من تصميمي الخاص",
  deep: "#1F4D5A", deeper: "#123039", ink: "#1C2B30", accent: "#D9A441", accent2: "#4E7CA1",
  soft: "#E7F0F2", soft2: "#F4F8F9", line: "#CBDEE3", paper: "#FFFFFF",
  heading_font: "Tajawal", body_font: "IBM Plex Sans Arabic",
  style_type: "modern", pattern: "none", cover_style: "classic",
};

function patternStyle(theme) {
  const c = encodeURIComponent(theme.line || "#ddd");
  const svgs = {
    dots: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='2' cy='2' r='1.4' fill='${theme.line}'/></svg>`,
    grid: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M16 0H0V16' fill='none' stroke='${theme.line}'/></svg>`,
    diagonal: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M0 16L16 0' stroke='${theme.line}'/></svg>`,
    waves: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M0 8 Q4 2 8 8 T16 8' fill='none' stroke='${theme.line}'/></svg>`,
    diamonds: `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M8 1 L15 8 L8 15 L1 8 Z' fill='none' stroke='${theme.line}'/></svg>`,
  };
  void c;
  if (!theme.pattern || theme.pattern === "none" || !svgs[theme.pattern]) return {};
  return { backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svgs[theme.pattern])}")`, backgroundSize: "16px" };
}

function MiniPreview({ theme }) {
  const bold = theme.cover_style === "bold";
  const minimal = theme.cover_style === "minimal";
  return (
    <div className="studio-preview" style={{ background: theme.paper, ...patternStyle(theme) }}>
      <div className="studio-cover"
        style={{
          border: minimal ? "none" : `2px solid ${theme.deep}`, borderTop: minimal ? `4px solid ${theme.accent}` : undefined,
          background: bold ? `linear-gradient(160deg, ${theme.deep}, ${theme.deeper})` : theme.soft2,
          color: bold ? "#fff" : theme.ink,
        }}>
        <div className="small fw-bold" style={{ color: bold ? theme.accent : theme.accent, fontFamily: theme.body_font }}>DAILY JOURNAL OF INFORMATICS</div>
        <div className="studio-cover-title" style={{ fontFamily: theme.heading_font, color: bold ? "#fff" : theme.deep }}>الدفتر اليومي</div>
        <div style={{ color: bold ? theme.accent : theme.accent, fontFamily: theme.heading_font }}>— ◆ —</div>
        <div className="fw-bold" style={{ fontFamily: theme.heading_font }}>مادة الإعلام الآلي</div>
        <div className="small">السنة الدراسية: 2026 / 2027</div>
      </div>
      <div className="studio-band" style={{ background: theme.deep, color: "#fff", fontFamily: theme.heading_font }}>بطاقة الحالة الشخصية والمهنية</div>
      <p className="small mb-1" style={{ color: theme.ink, fontFamily: theme.body_font }}>
        فقرة نموذجية بخط النصوص لمعاينة القراءة والمظهر العام داخل الصفحات.
      </p>
      <div className="d-flex gap-1">
        {[theme.deep, theme.accent, theme.accent2, theme.soft, theme.line].map((hex, i) => (
          <span key={i} className="swatch" style={{ background: hex }} title={hex} />
        ))}
      </div>
    </div>
  );
}

function StudioModal({ initial, design, onSave, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const patterns = design?.patterns || [{ key: "none", label: "بدون نقش" }];
  const coverStyles = design?.cover_styles || [{ key: "classic", label: "كلاسيكي مؤطر" }];
  return (
    <ModalShell title={form.id ? `${t("استوديو السمة:")} ${form.name_ar}` : t("سمة جديدة من تصميمك")} wide onClose={onClose}>
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <MiniPreview theme={form} />
          <label className="form-label small fw-bold mt-3 mb-1">{t("الاسم بالعربية")}</label>
          <input className="form-control form-control-sm" value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} />
          <label className="form-label small fw-bold mt-2 mb-1">{t("الاسم بالإنجليزية")}</label>
          <input className="form-control form-control-sm" dir="ltr" value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
          <label className="form-label small fw-bold mt-2 mb-1">{t("وصف قصير")}</label>
          <input className="form-control form-control-sm" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          <div className="row g-2 mt-1">
            <div className="col-6">
              <label className="form-label small fw-bold mb-1">{t("خط العناوين")}</label>
              <select className="form-select form-select-sm" value={form.heading_font} onChange={(e) => set("heading_font", e.target.value)}>
                {(design?.heading_fonts || [form.heading_font]).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small fw-bold mb-1">{t("خط النصوص")}</label>
              <select className="form-select form-select-sm" value={form.body_font} onChange={(e) => set("body_font", e.target.value)}>
                {(design?.body_fonts || [form.body_font]).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold mb-1">{t("نقش الخلفية")}</label>
              <select className="form-select form-select-sm" value={form.pattern} onChange={(e) => set("pattern", e.target.value)}>
                {patterns.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold mb-1">{t("أسلوب الغلاف")}</label>
              <select className="form-select form-select-sm" value={form.cover_style} onChange={(e) => set("cover_style", e.target.value)}>
                {coverStyles.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="col-4">
              <label className="form-label small fw-bold mb-1">{t("الأسلوب")}</label>
              <select className="form-select form-select-sm" value={form.style_type} onChange={(e) => set("style_type", e.target.value)}>
                {STYLE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="fw-bold small mb-2">{t("لوحة الألوان")}</div>
          <div className="d-flex flex-column gap-2">
            {COLOR_FIELDS.map(([key, label]) => (
              <div className="d-flex align-items-center gap-2" key={key}>
                <input type="color" className="form-control form-control-color studio-color" value={form[key] || "#000000"}
                  onChange={(e) => set(key, e.target.value)} />
                <span className="small flex-grow-1">{t(label)}</span>
                <input className="form-control form-control-sm studio-hex" dir="ltr" value={form[key] || ""}
                  onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="alert alert-light border small mt-3 mb-0">
            {t("تلميح: تتحدث المعاينة مباشرة أثناء التعديل. احفظ لتصبح السمة متاحة للتطبيق على الدفاتر والخطط والمنشورات.")}
          </div>
        </div>
      </div>
      <div className="d-flex gap-2 mt-4">
        <button className="btn btn-primary rounded-pill px-4" onClick={() => onSave(form)}>{t("حفظ السمة")}</button>
        <button className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
      </div>
    </ModalShell>
  );
}

export default function ThemesPage() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [style, setStyle] = useState("");
  const [source, setSource] = useState("");
  const [applyTheme, setApplyTheme] = useState(null);
  const [previewTheme, setPreviewTheme] = useState(null);
  const [editing, setEditing] = useState(null);
  const [design, setDesign] = useState(null);
  const [resources, setResources] = useState({ journals: [], plans: [], books: [], courses: [] });
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  useEffect(() => { designApi.sections().then(setDesign).catch(() => {}); }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (style) p.set("style", style);
    if (source) p.set("source", source);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [q, style, source]);

  const { themes, setThemes, loading } = useThemes(params);
  const [tsort, setTsort] = usePersistentState("themes-sort", "name");
  const shownThemes = [...themes].sort((a, b) =>
    tsort === "nameDesc" ? b.name_ar.localeCompare(a.name_ar, "ar") : a.name_ar.localeCompare(b.name_ar, "ar"));

  const openApply = async (theme) => {
    const [j, p, b, c] = await Promise.all([
      api("/journals/"), api("/lesson-plans/"), api("/notebooks/"), api("/courses/"),
    ]);
    setResources({ journals: listOf(j), plans: listOf(p), books: listOf(b), courses: listOf(c) });
    setApplyTheme(theme);
  };

  const doApply = async (themeId, resource_type, resource_id) => {
    const res = await themeApi.apply(themeId, resource_type, resource_id);
    toast(res.detail);
    setThemes((xs) => xs.map((x) => (x.id === themeId ? res.theme : x)));
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await themeApi.generate(12);
      toast(`وُلّدت ${res.created} سمة جديدة آليًا`);
      if (res.created) setThemes((xs) => [...res.themes, ...xs]);
    } catch (e) { toast(e.message, "danger"); }
    setGenerating(false);
  };

  const saveStudio = async (form) => {
    try {
      const { id, slug, source: _s, css_vars, usage, created_at, ...payload } = form;
      const saved = id ? await themeApi.update(id, payload) : await themeApi.create(payload);
      setThemes((xs) => id ? xs.map((x) => (x.id === id ? saved : x)) : [saved, ...xs]);
      setEditing(null);
      toast("حُفظت السمة — أصبحت متاحة للتطبيق على دفاترك ومنشوراتك");
    } catch (e) { toast(e.message, "danger"); }
  };

  const duplicate = async (theme) => {
    try {
      const copy = await themeApi.duplicate(theme.id);
      setThemes((xs) => [copy, ...xs]);
      toast("نُسخت السمة — يمكنك الآن تعديل النسخة بحرية");
    } catch (e) { toast(e.message, "danger"); }
  };

  const removeTheme = async (theme) => {
    if (!window.confirm(`حذف السمة المخصصة «${theme.name_ar}» نهائيًا؟`)) return;
    try {
      await themeApi.remove(theme.id);
      setThemes((xs) => xs.filter((x) => x.id !== theme.id));
      toast("حُذفت السمة المخصصة");
    } catch (e) { toast(e.message, "danger"); }
  };

  const demoItem = { title: "تجميع الحاسوب", subject: "الإعلام الآلي", level: "أولى ثانوي ج م ع",
    domain: "المجال التعلمي 1: بيئة التعامل مع الحاسوب", unit: "الوحدة 2", duration: 60,
    objectives: "أن يعدّد المتعلم مكونات الحاسوب الداخلية ووظائفها ويصنّف المكونات.",
    institution: "ثانوية الشهيد العربي بن مهيدي — وهران", school_year: "2025 / 2026", teacher_name: "الأستاذ سمير حداد",
    phases: [{ phase: "بناء التعلمات", minutes: 20, teacher: "يشرح المكونات الداخلية قطعة قطعة.", learners: "يدوّنون ويجيبون عن الأسئلة." }] };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-3">
        <div>
          <h3 className="fw-bold mb-1">{t("استوديو السمات")}</h3>
          <p className="text-secondary mb-0">{themes.length} سمة — اختر سمة وطبّقها، انسخها وحرّر ألوانها وخطوطها ونقش خلفيتها، أو صمّم سمتك الخاصة من الصفر.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary rounded-pill px-4" onClick={() => setEditing({ ...DEFAULT_NEW })}>+ {t("سمة جديدة")}</button>
          <button className="btn btn-dark rounded-pill px-4" onClick={generate} disabled={generating}>
            {generating ? <span className="spinner-border spinner-border-sm" /> : " " + t("توليد سمات جديدة آليًا")}
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="row g-2">
            <div className="col-12 col-md-5">
              <input className="form-control" aria-label={t("ابحث باسم السمة…")} placeholder={" " + t("ابحث باسم السمة…")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" aria-label={t("كل الأساليب")} value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="">{t("كل الأساليب")}</option>
                {STYLES.slice(1).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-4">
              <div className="d-flex flex-wrap gap-2" role="group" aria-label={t("مصدر السمات")}>
                {[["", t("الكل")], ["curated", t("مصممة")], ["generated", t("مولّدة آليًا")], ["custom", t("مخصصة")]].map(([v, l]) => (
                  <button key={v} className={`btn ${source === v ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setSource(v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? <SkeletonCards count={6} />
        : themes.length === 0 ? (
          <EmptyState icon="" title={t("لا سمات مطابقة")} hint={t("جرّب تعديل البحث أو صمّم سمة جديدة من استوديو السمات.")}
            actionLabel={" " + t("سمة جديدة")} onAction={() => setEditing({ ...DEFAULT_NEW })} />
        ) : (<>
          <FilterBar search="" onSearch={undefined} count={shownThemes.length}
            sort={tsort} onSort={setTsort}
            sortOptions={[["name", "الاسم (أ-ي)"], ["nameDesc", "الاسم (ي-أ)"]]} />
          <div className="row g-3">
            {shownThemes.map((theme) => (
              <div className="col-12 col-sm-6 col-xl-4" key={theme.id}>
                <ThemeCard theme={theme} onApply={openApply} onPreview={setPreviewTheme}
                  footer={(
                    <div className="d-flex flex-wrap gap-1">
                      <button className="btn btn-sm btn-primary rounded-pill flex-grow-1" onClick={() => openApply(theme)}>{t("تطبيق على…")}</button>
                      <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setPreviewTheme(theme)}>{t("معاينة")}</button>
                      <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => duplicate(theme)}>{t("نسخ")}</button>
                      {theme.source === "custom" && (
                        <>
                          <button className="btn btn-sm btn-outline-dark rounded-pill" onClick={() => setEditing(theme)}>{t("تحرير")}</button>
                          <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => removeTheme(theme)}>{t("حذف")}</button>
                        </>
                      )}
                    </div>
                  )} />
              </div>
            ))}
          </div>
        </>)}

      {applyTheme && (
        <ApplyThemeModal theme={applyTheme} resources={resources} onApply={doApply}
          onClose={() => setApplyTheme(null)} />
      )}

      {previewTheme && (
        <ModalShell title={`معاينة: ${previewTheme.name_ar}`} wide onClose={() => setPreviewTheme(null)}>
          <DocPreview type="lesson-plan" item={demoItem} theme={previewTheme} />
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-primary rounded-pill px-4"
              onClick={() => { setPreviewTheme(null); openApply(previewTheme); }}>
              تطبيق هذه السمة على…
            </button>
            <button className="btn btn-light rounded-pill px-4" onClick={() => setPreviewTheme(null)}>{t("إغلاق")}</button>
          </div>
        </ModalShell>
      )}

      {editing && <StudioModal initial={editing} design={design} onSave={saveStudio} onClose={() => setEditing(null)} />}
    </>
  );
}
