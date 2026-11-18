import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, downloadPdf, listOf } from "../api";
import { Spinner } from "../components/States";
import DocPreview from "../components/DocPreview";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const DEFAULT_PHASES = [
  { phase: "التهيئة والتمهيد", minutes: 5, teacher: "", learners: "" },
  { phase: "بناء التعلمات", minutes: 20, teacher: "", learners: "" },
  { phase: "الممارسة الموجَّهة", minutes: 15, teacher: "", learners: "" },
  { phase: "العمل المستقل", minutes: 12, teacher: "", learners: "" },
  { phase: "التقويم والواجب", minutes: 8, teacher: "", learners: "" },
];
const EMPTY = { title: "", subject: "الإعلام الآلي", level: "أولى ثانوي ج م ع", domain: "", unit: "",
  duration: 60, objectives: "", course: "", theme: "", phases: DEFAULT_PHASES };

export default function PlanEditorPage() {
  const { t } = useLang();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const editing = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [courses, setCourses] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    (async () => {
      try {
        const [courseData, themeData] = await Promise.all([api("/courses/"), api("/themes/")]);
        const courseList = listOf(courseData);
        setCourses(courseList);
        setThemes(listOf(themeData));
        if (editing) {
          const plan = await api(`/lesson-plans/${id}/`);
          setForm({ ...EMPTY, ...plan, course: plan.course ? String(plan.course) : "", theme: plan.theme ? String(plan.theme) : "" });
        } else if (params.get("course")) {
          const course = courseList.find((c) => String(c.id) === params.get("course"));
          if (course) setForm((f) => ({ ...f, course: String(course.id), title: course.title, domain: course.domain || "", unit: course.unit || "", level: course.level || f.level }));
        }
      } catch (error) { toast(error.message, "danger"); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const theme = useMemo(() => themes.find((x) => String(x.id) === String(form.theme)) || themes[0], [themes, form.theme]);
  const totalMinutes = (form.phases || []).reduce((sum, p) => sum + (Number(p.minutes) || 0), 0);

  const setPhase = (index, key, value) => setForm((f) => ({
    ...f, phases: f.phases.map((p, i) => (i === index ? { ...p, [key]: value } : p)),
  }));
  const movePhase = (index, dir) => setForm((f) => {
    const phases = [...f.phases];
    const target = index + dir;
    if (target < 0 || target >= phases.length) return f;
    [phases[index], phases[target]] = [phases[target], phases[index]];
    return { ...f, phases };
  });

  const save = async () => {
    if (!form.title.trim()) { toast(t("اكتب عنوان الخطة أولًا"), "danger"); return; }
    setSaving(true);
    try {
      const payload = { ...form, duration: Number(form.duration) || 60,
        course: form.course ? Number(form.course) : null, theme: form.theme ? Number(form.theme) : null,
        phases: form.phases.map((p) => ({ ...p, minutes: Number(p.minutes) || 0 })) };
      const saved = editing
        ? await api(`/lesson-plans/${id}/`, { method: "PATCH", body: payload })
        : await api("/lesson-plans/", { method: "POST", body: payload });
      toast(editing ? t("حُفظت خطة الدرس") : t("أُنشئت خطة الدرس"));
      navigate(`/lesson-plans?plan=${saved.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setSaving(false);
  };

  const remove = async () => {
    if (!window.confirm(t("حذف خطة الدرس نهائيًا؟"))) return;
    try {
      await api(`/lesson-plans/${id}/`, { method: "DELETE" });
      toast(t("حُذفت الخطة"));
      navigate("/lesson-plans");
    } catch (error) { toast(error.message, "danger"); }
  };

  if (loading) return <Spinner />;
  const linkedCourse = courses.find((c) => String(c.id) === String(form.course));

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h3 className="fw-bold mb-1">{editing ? `${t("محرر خطة الدرس")}: ${form.title}` : t("خطة درس جديدة")}</h3>
          <p className="text-secondary mb-0">{t("محرر كامل بحجم الصفحة: البيانات، الأهداف، ومراحل الدرس — مع معاينة حية بالسمة المختارة.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {editing && (
            <>
              <Link to={`/preview/lesson-plan/${id}`} className="btn btn-dark rounded-pill">{t("معاينة وطباعة")}</Link>
              <button className="btn btn-outline-dark rounded-pill" onClick={() => downloadPdf(`/exports/lesson-plan/${id}/`, `${form.title}.pdf`).catch((e) => toast(e.message, "danger"))}>⬇ PDF</button>
              {linkedCourse && <Link to={`/courses?lesson=${linkedCourse.id}`} className="btn btn-outline-success rounded-pill">{t("فتح الدرس المرتبط")}</Link>}
              <button className="btn btn-outline-danger rounded-pill" onClick={remove}>{t("حذف")}</button>
            </>
          )}
          <Link to="/lesson-plans" className="btn btn-light rounded-pill">← {t("كل الخطط")}</Link>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm mb-3"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("بيانات الخطة")}</h6>
            <div className="row g-2">
              <div className="col-12">
                <label htmlFor="lesson-plan-title" className="form-label small fw-bold">{t("عنوان الدرس")} *</label>
                <input id="lesson-plan-title" className="form-control" value={form.title} required
                  onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="col-12">
                <label htmlFor="lesson-plan-course" className="form-label small fw-bold">{t("الدرس المرتبط من المقرر")}</label>
                <select id="lesson-plan-course" className="form-select" value={form.course} onChange={(e) => set("course", e.target.value)}>
                  <option value="">{t("— بدون ربط بدرس —")}</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label htmlFor="lesson-plan-subject" className="form-label small fw-bold">{t("المادة")}</label>
                <input id="lesson-plan-subject" className="form-control" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label htmlFor="lesson-plan-level" className="form-label small fw-bold">{t("المستوى")}</label>
                <input id="lesson-plan-level" className="form-control" value={form.level} onChange={(e) => set("level", e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label htmlFor="lesson-plan-duration" className="form-label small fw-bold">{t("المدة (دقيقة)")}</label>
                <input id="lesson-plan-duration" type="number" min="1" className="form-control" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label htmlFor="lesson-plan-theme" className="form-label small fw-bold">{t("سمة الخطة")}</label>
                <select id="lesson-plan-theme" className="form-select" value={form.theme} onChange={(e) => set("theme", e.target.value)}>
                  <option value="">{t("بدون سمة")}</option>
                  {themes.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label htmlFor="lesson-plan-domain" className="form-label small fw-bold">{t("المجال التعلمي")}</label>
                <input id="lesson-plan-domain" className="form-control" value={form.domain} onChange={(e) => set("domain", e.target.value)} />
              </div>
              <div className="col-12 col-md-6">
                <label htmlFor="lesson-plan-unit" className="form-label small fw-bold">{t("الوحدة")}</label>
                <input id="lesson-plan-unit" className="form-control" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
              </div>
              <div className="col-12">
                <label htmlFor="lesson-plan-objectives" className="form-label small fw-bold">{t("أهداف الدرس / الكفاية المستهدفة")}</label>
                <textarea id="lesson-plan-objectives" className="form-control" rows="4" value={form.objectives} onChange={(e) => set("objectives", e.target.value)} />
              </div>
            </div>
          </div></div>

          <div className="card border-0 shadow-sm mb-3"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold mb-0">{t("مراحل الدرس")}</h6>
              <span className={`badge rounded-pill ${totalMinutes === Number(form.duration) ? "text-bg-success" : "text-bg-warning"}`}>
                {t("مجموع المراحل:")} {totalMinutes} / {form.duration} {t("دقيقة")}
              </span>
            </div>
            <div className="d-flex flex-column gap-2">
              {(form.phases || []).map((phase, index) => (
                <div key={index} className="phase-row">
                  <div className="phase-toolbar mb-2">
                    <span className="badge text-bg-dark">{index + 1}</span>
                    <input className="form-control form-control-sm fw-bold phase-name-input" value={phase.phase}
                      aria-label={`${t("اسم المرحلة")} ${index + 1}`}
                      onChange={(e) => setPhase(index, "phase", e.target.value)} placeholder={t("اسم المرحلة")} />
                    <input type="number" min="0" className="form-control form-control-sm phase-minutes" value={phase.minutes}
                      aria-label={`${t("الدقائق")} ${index + 1}`}
                      onChange={(e) => setPhase(index, "minutes", e.target.value)} title={t("الدقائق")} />
                    <button type="button" className="btn btn-sm btn-light border" disabled={index === 0}
                      aria-label={`${t("نقل المرحلة للأعلى")} ${index + 1}`} onClick={() => movePhase(index, -1)}><span aria-hidden="true">↑</span></button>
                    <button type="button" className="btn btn-sm btn-light border" disabled={index === form.phases.length - 1}
                      aria-label={`${t("نقل المرحلة للأسفل")} ${index + 1}`} onClick={() => movePhase(index, 1)}><span aria-hidden="true">↓</span></button>
                    <button type="button" className="btn btn-sm btn-outline-danger"
                      aria-label={`${t("حذف المرحلة")} ${phase.phase || index + 1}`}
                      onClick={() => setForm((f) => ({ ...f, phases: f.phases.filter((_, i) => i !== index) }))}>
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <textarea className="form-control form-control-sm" rows="2" value={phase.teacher}
                        aria-label={`${t("إجراءات الأستاذ")} ${index + 1}`}
                        onChange={(e) => setPhase(index, "teacher", e.target.value)} placeholder={t("إجراءات الأستاذ")} />
                    </div>
                    <div className="col-12 col-md-6">
                      <textarea className="form-control form-control-sm" rows="2" value={phase.learners}
                        aria-label={`${t("أنشطة المتعلمين")} ${index + 1}`}
                        onChange={(e) => setPhase(index, "learners", e.target.value)} placeholder={t("أنشطة المتعلمين")} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-outline-primary rounded-pill mt-3"
              onClick={() => setForm((f) => ({ ...f, phases: [...f.phases, { phase: "", minutes: 10, teacher: "", learners: "" }] }))}>
              + {t("إضافة مرحلة")}
            </button>
          </div></div>

          <div className="d-flex gap-2 mb-4">
            <button type="button" className="btn btn-primary rounded-pill px-5" disabled={saving} onClick={save}>
              {saving ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="check" size={16} /> {editing ? t("حفظ الخطة") : t("إنشاء الخطة")}</>}
            </button>
            <Link to="/lesson-plans" className="btn btn-light rounded-pill px-4">{t("إلغاء")}</Link>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="editor-preview-sticky">
            <div className="text-secondary small fw-bold mb-2">{t("معاينة حية بالسمة المختارة")}</div>
            {theme && <DocPreview type="lesson-plan" item={form} theme={theme} />}
          </div>
        </div>
      </div>
    </>
  );
}
