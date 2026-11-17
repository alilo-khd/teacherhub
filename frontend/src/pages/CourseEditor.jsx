import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadPdf, listOf } from "../api";
import { Spinner } from "../components/States";
import DocPreview from "../components/DocPreview";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const EMPTY = { title: "", domain: "", unit: "", level: "أولى ثانوي ج م ع", order: 1, summary: "", key_points: [], theme: "" };

export default function CourseEditorPage() {
  const { t } = useLang();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const editing = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(null);
  const [pointsText, setPointsText] = useState("");
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    (async () => {
      try {
        const themeData = await api("/themes/");
        setThemes(listOf(themeData));
        if (editing) {
          const course = await api(`/courses/${id}/`);
          setLoaded(course);
          setForm({ ...EMPTY, ...course, theme: course.theme ? String(course.theme) : "" });
          setPointsText((course.key_points || []).join("\n"));
        } else {
          const all = await api("/courses/");
          setForm((f) => ({ ...f, order: listOf(all).length + 1 }));
        }
      } catch (error) { toast(error.message, "danger"); }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const theme = useMemo(() => themes.find((x) => String(x.id) === String(form.theme)) || themes[0], [themes, form.theme]);

  const save = async () => {
    if (!form.title.trim()) { toast(t("اكتب عنوان الدرس أولًا"), "danger"); return; }
    setSaving(true);
    try {
      const payload = { ...form, order: Number(form.order) || 1, theme: form.theme ? Number(form.theme) : null,
        key_points: pointsText.split("\n").map((x) => x.trim()).filter(Boolean) };
      const saved = editing
        ? await api(`/courses/${id}/`, { method: "PATCH", body: payload })
        : await api("/courses/", { method: "POST", body: payload });
      toast(editing ? t("حُفظ الدرس") : t("أُنشئ الدرس"));
      navigate(`/courses?lesson=${saved.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setSaving(false);
  };

  const remove = async () => {
    if (!window.confirm(t("حذف الدرس من المقرر؟ (لن تُحذف الحصص المسجلة)"))) return;
    try {
      await api(`/courses/${id}/`, { method: "DELETE" });
      toast(t("حُذف الدرس"));
      navigate("/courses");
    } catch (error) { toast(error.message, "danger"); }
  };

  if (loading) return <Spinner />;
  const previewItem = { ...form, key_points: pointsText.split("\n").map((x) => x.trim()).filter(Boolean), plan: loaded?.plan || null };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h3 className="fw-bold mb-1">{editing ? `${t("محرر الدرس")}: ${form.title}` : t("درس جديد في المقرر")}</h3>
          <p className="text-secondary mb-0">{t("محرر كامل بحجم الصفحة: محتوى الدرس ونقاطه الأساسية وسمته — مع معاينة حية لمذكرة التلاميذ.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {editing && (
            <>
              <Link to={`/preview/course/${id}`} className="btn btn-dark rounded-pill">{t("معاينة وطباعة")}</Link>
              <button className="btn btn-outline-dark rounded-pill" onClick={() => downloadPdf(`/exports/course/${id}/`, `${form.title}.pdf`).catch((e) => toast(e.message, "danger"))}>⬇ PDF</button>
              {loaded?.plan
                ? <Link to={`/lesson-plans/${loaded.plan.id}/edit`} className="btn btn-success rounded-pill">{t("فتح الخطة المرتبطة")}</Link>
                : <Link to={`/lesson-plans/new?course=${id}`} className="btn btn-outline-success rounded-pill">{t("أنشئ خطة لهذا الدرس")}</Link>}
              <button className="btn btn-outline-danger rounded-pill" onClick={remove}>{t("حذف")}</button>
            </>
          )}
          <Link to="/courses" className="btn btn-light rounded-pill">← {t("كل الدروس")}</Link>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm mb-3"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("بيانات الدرس")}</h6>
            <div className="row g-2">
              <div className="col-12 col-md-9">
                <label className="form-label small fw-bold">{t("عنوان الدرس")} *</label>
                <input className="form-control" value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold">{t("الترتيب في المقرر")}</label>
                <input type="number" className="form-control" value={form.order} onChange={(e) => set("order", e.target.value)} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">{t("المجال التعلمي")}</label>
                <input className="form-control" value={form.domain} onChange={(e) => set("domain", e.target.value)} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">{t("الوحدة")}</label>
                <input className="form-control" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">{t("المستوى")}</label>
                <input className="form-control" value={form.level} onChange={(e) => set("level", e.target.value)} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold">{t("سمة الدرس")}</label>
                <select className="form-select" value={form.theme} onChange={(e) => set("theme", e.target.value)}>
                  <option value="">{t("بدون سمة")}</option>
                  {themes.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label small fw-bold">{t("النقاط الأساسية التي يكتبها التلاميذ (واحدة في كل سطر)")}</label>
                <textarea className="form-control" rows="6" value={pointsText} onChange={(e) => setPointsText(e.target.value)}
                  placeholder={"البيانات هي حقائق خام\nالمعلومة هي بيانات معالجة"} />
              </div>
              <div className="col-12">
                <label className="form-label small fw-bold">{t("ملخص محتوى الدرس")}</label>
                <textarea className="form-control" rows="5" value={form.summary} onChange={(e) => set("summary", e.target.value)} />
              </div>
            </div>
            {editing && (loaded?.taught_in || []).length > 0 && (
              <div className="mt-3">
                <span className="small text-secondary">{t("دُرّس لدى:")} </span>
                {loaded.taught_in.map((row) => <span key={row.id} className="class-served">✓ {row.name}</span>)}
              </div>
            )}
          </div></div>

          <div className="d-flex gap-2 mb-4">
            <button className="btn btn-primary rounded-pill px-5" disabled={saving} onClick={save}>
              {saving ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="check" size={16} /> {editing ? t("حفظ الدرس") : t("إنشاء الدرس")}</>}
            </button>
            <Link to="/courses" className="btn btn-light rounded-pill px-4">{t("إلغاء")}</Link>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="editor-preview-sticky">
            <div className="text-secondary small fw-bold mb-2">{t("معاينة حية لمذكرة التلاميذ")}</div>
            {theme && <DocPreview type="course" item={previewItem} theme={theme} />}
          </div>
        </div>
      </div>
    </>
  );
}
