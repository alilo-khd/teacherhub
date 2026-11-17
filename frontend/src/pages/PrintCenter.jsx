import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadPdf, listOf } from "../api";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";
import { usePersistentState } from "../hooks";

const PRINT_ICONS = { journal: "notebook", inspector: "search", gradebook: "users", classreport: "chart", plan: "layers", course: "book", sessions: "calendar", notebook: "pen", observation: "clipboard", timetable: "clock" };

export default function PrintCenterPage() {
  const { t, te } = useLang();
  const [data, setData] = useState(null);
  const [theme, setTheme] = useState("");
  const [sel, setSel] = useState({ journal: "", plan: "", course: "", notebook: "", cls: "", observation: "", sessCls: "" });
  const [busy, setBusy] = useState("");
  const [pr, setPr] = usePersistentState("print-settings", { orientation: "portrait", from: "", to: "", order: "newest", term: "", sort: "name", nbTag: "", nbClass: "", nbCourse: "" });
  const setP = (k, v) => setPr((x) => ({ ...x, [k]: v }));
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api("/themes/"), api("/journals/"), api("/lesson-plans/"), api("/courses/"),
      api("/notebooks/"), api("/classes/"), api("/observations/")])
      .then(([t, j, p, c, n, cl, o]) => {
        const d = { themes: listOf(t), journals: listOf(j), plans: listOf(p), courses: listOf(c),
                    notebooks: listOf(n), classes: listOf(cl), observations: listOf(o) };
        setData(d);
        setSel({ journal: d.journals[0]?.id ?? "", plan: d.plans[0]?.id ?? "", course: d.courses[0]?.id ?? "",
                 notebook: d.notebooks[0]?.id ?? "", cls: d.classes[0]?.id ?? "",
                 observation: d.observations[0]?.id ?? "", sessCls: d.classes[0]?.id ?? "" });
      })
      .catch((e) => toast(e.message, "danger"));
  }, []);

  if (!data) return <Spinner label={t("جارٍ تحضير مركز الطباعة…")} />;
  const tq = theme ? `?theme=${theme}` : "";
  const set = (k, v) => setSel((s) => ({ ...s, [k]: v }));
  const withSettings = (url) => {
    const qs = new URLSearchParams(url.split("?")[1] || "");
    if (pr.orientation && pr.orientation !== "portrait") qs.set("orientation", pr.orientation);
    if (pr.from) qs.set("from", pr.from);
    if (pr.to) qs.set("to", pr.to);
    qs.set("order", pr.order);
    if (pr.term) qs.set("term", pr.term);
    if (pr.sort && pr.sort !== "name") qs.set("sort", pr.sort);
    if (theme && !qs.has("theme")) qs.set("theme", theme);
    const base = url.split("?")[0];
    return `${base}?${qs.toString()}`;
  };

  const go = async (key, path, name) => {
    setBusy(key);
    try { await downloadPdf(path, name); toast("تم تنزيل ملف PDF — جاهز للطباعة"); }
    catch (e) { toast(e.message, "danger"); }
    setBusy("");
  };
  const btn = (key) => (busy === key ? <span className="spinner-border spinner-border-sm" /> : "⬇ تنزيل PDF");
  const EDIT_SOURCES = {
    journal: ["journal", sel.journal], inspector: ["inspector", null],
    gradebook: ["gradebook", sel.cls], classreport: ["class-report", sel.cls],
    plan: ["lesson-plan", sel.plan], course: ["course", sel.course],
    sessions: ["sessions", sel.sessCls || null], notebook: ["notebook", sel.notebook],
    observation: ["observation", sel.observation], timetable: ["timetable", null],
  };
  const editCopy = async (key) => {
    const [source_type, source_id] = EDIT_SOURCES[key] || [];
    if (!source_type) return;
    setBusy(`edit-${key}`);
    try {
      const doc = await api("/documents/from-existing/", { method: "POST", body: { source_type, source_id: source_id ? Number(source_id) : null } });
      navigate(`/editor/${doc.id}`);
    } catch (e) { toast(e.message, "danger"); setBusy(""); }
  };

  const selectCls = "form-select form-select-sm";
  const cards = [
    {
      key: "journal", icon: "", title: t("الدفتر اليومي الكامل"),
      desc: t("غلاف + البطاقة المهنية + العطل + الندوات + برنامج العمل الأسبوعي + سجل الحصص المنفذة + ملاحظات."),
      control: <select className={selectCls} value={sel.journal} onChange={(e) => set("journal", e.target.value)}>
        {data.journals.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>,
      action: () => sel.journal && go("journal", withSettings(`/exports/journal/${sel.journal}/`), "الدفتر اليومي.pdf"),
    },
    {
      key: "inspector", icon: "", title: t("دفتر المفتش الكامل"),
      desc: t("غلاف + البطاقة + مؤسسات المقاطعة + العطل والندوات + سجل الزيارات + شبكة ملاحظة الحصة + سجل المتابعة."),
      control: null,
      action: () => go("inspector", withSettings(`/exports/inspector/`), "دفتر المفتش.pdf"),
    },
    {
      key: "gradebook", icon: "", title: t("دفتر التنقيط لفوج"),
      desc: t("شبكات الثلاثيات الثلاث مع المعدلات المحسوبة آليًا + ملخص المعدلات السنوية."),
      control: <select className={selectCls} value={sel.cls} onChange={(e) => set("cls", e.target.value)}>
        {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>,
      action: () => sel.cls && go("gradebook", withSettings(`/exports/gradebook/${sel.cls}/`), "دفتر التنقيط.pdf"),
    },
    {
      key: "classreport", icon: "", title: t("تقرير تقدم فوج"),
      desc: t("حالة المقرر درسًا بدرس، سجل الحصص، معدلات الفوج، والدرس التالي المقترح."),
      control: <select className={selectCls} value={sel.cls} onChange={(e) => set("cls", e.target.value)}>
        {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>,
      action: () => sel.cls && go("classreport", withSettings(`/exports/class-report/${sel.cls}/`), "تقرير تقدم الفوج.pdf"),
    },
    {
      key: "plan", icon: "", title: "خطة درس",
      desc: t("بطاقة معلومات + الأهداف + جدول المراحل الخمس + توقيع وملاحظات ما بعد الدرس."),
      control: <select className={selectCls} value={sel.plan} onChange={(e) => set("plan", e.target.value)}>
        {data.plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>,
      action: () => sel.plan && go("plan", withSettings(`/exports/lesson-plan/${sel.plan}/`), "خطة الدرس.pdf"),
    },
    {
      key: "course", icon: "", title: t("مذكرة درس للتلاميذ"),
      desc: t("غلاف الدرس + المحتوى + قائمة النقاط الأساسية للمتابعة + خطة الدرس المرتبطة + سجل تدريسه."),
      control: <select className={selectCls} value={sel.course} onChange={(e) => set("course", e.target.value)}>
        {data.courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}</select>,
      action: () => sel.course && go("course", withSettings(`/exports/course/${sel.course}/`), "مذكرة الدرس.pdf"),
    },
    {
      key: "sessions", icon: "", title: t("سجل الحصص المنفذة"),
      desc: t("كل حصص فوج مع الدروس والنقاط المكتوبة والواجبات والغائبين."),
      control: <select className={selectCls} value={sel.sessCls} onChange={(e) => set("sessCls", e.target.value)}>
        {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>,
      action: () => sel.sessCls && go("sessions", withSettings(`/exports/sessions/?class=${sel.sessCls}`), "سجل الحصص.pdf"),
    },
    {
      key: "notebook", icon: "", title: "دفتر ملاحظات",
      desc: t("غلاف + كل الملاحظات مرتبة مع روابطها (فوج/درس/حصة)."),
      control: <select className={selectCls} value={sel.notebook} onChange={(e) => set("notebook", e.target.value)}>
        {data.notebooks.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</select>,
      action: () => {
        if (!sel.notebook) return;
        const qs = new URLSearchParams(withSettings(`/exports/notebook/${sel.notebook}/`).split("?")[1] || "");
        if (pr.nbTag) qs.set("tag", pr.nbTag);
        if (pr.nbClass) qs.set("class", pr.nbClass);
        if (pr.nbCourse) qs.set("course", pr.nbCourse);
        go("notebook", `/exports/notebook/${sel.notebook}/?${qs.toString()}`, "دفتر الملاحظات.pdf");
      },
    },
    {
      key: "observation", icon: "", title: t("شبكة ملاحظة حصة"),
      desc: t("شبكة التقييم بعناصرها وعلاماتها + نقاط القوة والتحسين + الإمضاءات."),
      control: <select className={selectCls} value={sel.observation} onChange={(e) => set("observation", e.target.value)}>
        {data.observations.map((o) => <option key={o.id} value={o.id}>{o.date} — {o.teacher_name} ({o.percent}٪)</option>)}</select>,
      action: () => sel.observation && go("observation", withSettings(`/exports/observation/${sel.observation}/`), "شبكة الملاحظة.pdf"),
    },
    {
      key: "timetable", icon: "", title: t("برنامج العمل الأسبوعي"),
      desc: t("جدول كل الأفواج الأسبوعي في صفحة واحدة للتعليق أو الحفظ."),
      control: null,
      action: () => go("timetable", withSettings(`/exports/timetable/`), "برنامج العمل الأسبوعي.pdf"),
    },
  ];

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4 gap-2">
        <div>
          <h3 className="fw-bold mb-1"> مركز الطباعة والتصدير</h3>
          <p className="text-secondary mb-0">{t("كل وثائق المنصة تخرج ملفات PDF عربية A4 بهوية السمة المختارة، جاهزة للطباعة مباشرة.")}</p>
        </div>
        <div style={{ minWidth: 260 }}>
          <label className="form-label fw-semibold small mb-1">{t("سمة التصدير (تتجاوز سمة كل وثيقة)")}</label>
          <select className="form-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">{t("سمة كل وثيقة / البدلة الكحلية افتراضيًا")}</option>
            {data.themes.map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
          </select>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="fw-bold mb-3"><Icon name="printer" size={18} /> {t("إعدادات الطباعة")}</div>
          <div className="row g-3">
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("اتجاه الصفحة")}</label>
              <select className="form-select form-select-sm" value={pr.orientation} onChange={(e) => setP("orientation", e.target.value)}>
                <option value="portrait">{t("عمودي (Portrait)")}</option>
                <option value="landscape">{t("أفقي (Landscape)")}</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("نطاق التاريخ للطباعة")}</label>
              <input type="date" className="form-control form-control-sm" value={pr.from} onChange={(e) => setP("from", e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">&nbsp;</label>
              <input type="date" className="form-control form-control-sm" value={pr.to} onChange={(e) => setP("to", e.target.value)} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("ترتيب الطباعة")}</label>
              <select className="form-select form-select-sm" value={pr.order} onChange={(e) => setP("order", e.target.value)}>
                <option value="newest">{t("الأحدث أولًا")}</option>
                <option value="oldest">{t("الأقدم أولًا")}</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("ثلاثي دفتر التنقيط")}</label>
              <select className="form-select form-select-sm" value={pr.term} onChange={(e) => setP("term", e.target.value)}>
                <option value="">{t("كل الثلاثيات")}</option>
                <option value="1">1</option><option value="2">2</option><option value="3">3</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("فرز التلاميذ في دفتر التنقيط")}</label>
              <select className="form-select form-select-sm" value={pr.sort} onChange={(e) => setP("sort", e.target.value)}>
                <option value="name">{t("حسب الاسم")}</option>
                <option value="average_desc">{t("المعدل (الأعلى أولًا)")}</option>
                <option value="average_asc">{t("المعدل (الأدنى أولًا)")}</option>
                <option value="annual_desc">{t("المعدل السنوي (الأعلى أولًا)")}</option>
              </select>
            </div>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("وسم دفتر الملاحظات")}</label>
              <select className="form-select form-select-sm" value={pr.nbTag} onChange={(e) => setP("nbTag", e.target.value)}>
                <option value="">{t("كل الوسوم")}</option>
                {["عامة", "مهمة", "متابعة", "إدارية"].map((tag) => <option key={tag} value={tag}>{te(tag)}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("فوج دفتر الملاحظات")}</label>
              <select className="form-select form-select-sm" value={pr.nbClass} onChange={(e) => setP("nbClass", e.target.value)}>
                <option value="">{t("الكل")}</option>
                {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold">{t("درس دفتر الملاحظات")}</label>
              <select className="form-select form-select-sm" value={pr.nbCourse} onChange={(e) => setP("nbCourse", e.target.value)}>
                <option value="">{t("كل الدروس")}</option>
                {data.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>
          <div className="small text-secondary mt-2">{t("ستُطبع الوثائق التالية بهذه الإعدادات أينما ينطبق ذلك.")}</div>
        </div>
      </div>
      <div className="row g-3">
        {cards.map((c) => (
          <div className="col-12 col-md-6 col-xl-4" key={c.key}>
            <div className="card border-0 shadow-sm h-100 print-card">
              <div className="card-body d-flex flex-column">
                <div className="print-icon"><Icon name={PRINT_ICONS[c.key] || "file"} size={27} /></div>
                <h6 className="fw-bold">{c.title}</h6>
                <p className="text-secondary small flex-grow-1">{c.desc}</p>
                {c.control}
                <button className="btn btn-primary rounded-pill w-100 mt-3" disabled={busy === c.key} onClick={c.action}>
                  {btn(c.key)}
                </button>
                <button className="btn btn-outline-dark rounded-pill w-100 mt-2" disabled={busy === `edit-${c.key}`} onClick={() => editCopy(c.key)}>
                  {busy === `edit-${c.key}` ? <span className="spinner-border spinner-border-sm" /> : t("تحرير نسخة قابلة للتحرير")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
