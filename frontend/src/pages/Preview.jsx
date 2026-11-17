import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadPdf, listOf, themeApi } from "../api";
import { Spinner } from "../components/States";
import DocPreview from "../components/DocPreview";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import { usePersistentState } from "../hooks";

const ENDPOINTS = { journal: "/journals/", "lesson-plan": "/lesson-plans/", notebook: "/notebooks/", course: "/courses/" };
const LABELS = { journal: "الدفتر اليومي", "lesson-plan": "خطة الدرس", notebook: "دفتر الملاحظات", course: "الدرس" };
const BACK = { journal: "/journals", "lesson-plan": "/lesson-plans", notebook: "/notebooks", course: "/courses" };

export default function PreviewPage() {
  const { t, te } = useLang();
  const { type, id } = useParams();
  const [item, setItem] = useState(null);
  const [themes, setThemes] = useState([]);
  const [themeId, setThemeId] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [printSettings] = usePersistentState("print-settings", { orientation: "portrait" });
  const toast = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    Promise.all([api(`${ENDPOINTS[type]}${id}/`), api("/themes/")])
      .then(([it, th]) => {
        setItem(it);
        const list = listOf(th);
        setThemes(list);
        setThemeId(it.theme ? String(it.theme) : String(list[0]?.id ?? ""));
      })
      .catch((e) => setError(e.message));
  }, [type, id]);

  const theme = useMemo(
    () => themes.find((t) => String(t.id) === String(themeId)) || item?.theme_detail || themes[0],
    [themes, themeId, item]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!item || !theme) return <Spinner label={t("جارٍ تحضير المعاينة…")} />;

  const dirty = String(item.theme ?? "") !== String(themeId);

  const apply = async () => {
    setApplying(true);
    try {
      const res = await themeApi.apply(Number(themeId), type, Number(id));
      toast(res.detail);
      setItem((it) => ({ ...it, theme: Number(themeId), theme_detail: res.theme }));
    } catch (e) { toast(e.message, "danger"); }
    setApplying(false);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
        <div>
          <h3 className="fw-bold mb-1">{t("معاينة")} {t(LABELS[type])}</h3>
          <p className="text-secondary mb-0">{item.title} — {t("بدّل السمة وشاهد النتيجة مباشرة ثم طبّقها.")}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-dark rounded-pill px-4" disabled={editing} onClick={async () => {
            setEditing(true);
            try {
              const doc = await api("/documents/from-existing/", { method: "POST", body: { source_type: type, source_id: Number(id) } });
              navigate(`/editor/${doc.id}`);
            } catch (e) { toast(e.message, "danger"); setEditing(false); }
          }}>{editing ? <span className="spinner-border spinner-border-sm" /> : t("تحرير نسخة قابلة للتحرير")}</button>
          <button className="btn btn-primary rounded-pill px-4"
            onClick={() => downloadPdf(`/exports/${type === "lesson-plan" ? "lesson-plan" : type}/${id}/?theme=${themeId}${printSettings.orientation === "landscape" ? "&orientation=landscape" : ""}`, `${LABELS[type]}.pdf`)
              .then(() => toast("تم تنزيل ملف PDF")).catch((e) => toast(e.message, "danger"))}>
            ⬇ {t("تصدير PDF للطباعة")}
          </button>
          {type === "course" && item.plan && (
            <Link to={`/lesson-plans?plan=${item.plan.id}`} className="btn btn-success rounded-pill px-4">{t("فتح الخطة المرتبطة")}</Link>
          )}
          {type === "course" && !item.plan && (
            <Link to={`/lesson-plans?course=${item.id}`} className="btn btn-outline-success rounded-pill px-4">{t("أنشئ خطة لهذا الدرس")}</Link>
          )}
          <Link to={BACK[type]} className="btn btn-light rounded-pill px-4">← {t("عودة إلى القائمة")}</Link>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold small">{t("السمة المعروضة")}</label>
              <select className="form-select" value={themeId} onChange={(e) => setThemeId(e.target.value)}>
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name_ar} — {t.style_type}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <div className="d-flex gap-1 align-items-center h-100 pb-1">
                {[theme.deep, theme.accent, theme.accent2, theme.soft, theme.line].map((c, i) => (
                  <span key={i} className="swatch" style={{ background: c }} />
                ))}
                <span className="small text-secondary ms-1">{theme.heading_font}</span>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <button className="btn btn-primary rounded-pill w-100" onClick={apply} disabled={!dirty || applying}>
                {applying ? <span className="spinner-border spinner-border-sm" />
                  : dirty ? `تطبيق «${theme.name_ar}»` : "✓ السمة مطبّقة"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <DocPreview type={type} item={item} theme={theme} />

      {type === "journal" && (
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h5 className="fw-bold mb-0"> محاذاة هذا الدفتر مع حصصك ({item.sessions_count ?? 0} حصة منفَّذة)</h5>
              <Link to="/sessions" className="btn btn-sm btn-primary rounded-pill">{t("سجّل حصة جديدة")}</Link>
            </div>
            {(item.sessions_recent || []).length === 0 ? (
              <p className="text-secondary small mt-3 mb-0">{t("لا حصص مرتبطة بعد — كل حصة تُسجَّل تُرفق تلقائيًا بأحدث دفتر وتظهر هنا مع نقاطها.")}</p>
            ) : (
              <div className="d-flex flex-column gap-2 mt-3">
                {item.sessions_recent.map((s) => (
                  <div key={s.id} className="session-mini">
                    <span className="fw-semibold"> {s.date}</span>
                    <span className="badge rounded-pill text-bg-primary"> {s.class_name}</span>
                    <span>{s.course_title || t("حصة بدون درس")}</span>
                    {(s.points_written || []).slice(0, 3).map((p, i) => <span key={i} className="point-chip">✓ {p}</span>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {type === "lesson-plan" && (
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <div>
              <h5 className="fw-bold mb-1"> {t("محاذاة الخطة مع التدريس الفعلي")}</h5>
              <p className="text-secondary small mb-0">
                {item.course_title
                  ? <>مرتبطة بدرس المقرر «{item.course_title}» — وقد دُرّست في <b>{item.sessions_count ?? 0}</b> حصة منفَّذة حتى الآن. كل حصة جديدة لهذا الدرس تُرفق بهذه الخطة تلقائيًا.</>
                  : "هذه الخطة غير مرتبطة بدرس من المقرر بعد — اربطها من صفحة خطط الدروس لتُرفق تلقائيًا بكل حصة تُدرّسها."}
              </p>
            </div>
            <div className="d-flex gap-2">
              <Link to="/sessions" className="btn btn-sm btn-primary rounded-pill">{t("سجلّ الحصص")}</Link>
              <Link to="/courses" className="btn btn-sm btn-outline-primary rounded-pill">{t("المقرر الدراسي")}</Link>
            </div>
          </div>
        </div>
      )}

      {type === "notebook" && (item.latest_entries || []).length > 0 && (
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body">
            <h5 className="fw-bold mb-3"> {t("أحدث ملاحظات هذا الدفتر وروابطها السياقية")}</h5>
            <div className="d-flex flex-column gap-2">
              {item.latest_entries.map((e) => (
                <div key={e.id} className="session-mini">
                  <span className={`badge rounded-pill tag-${e.tag}`}>{e.tag}</span>
                  <span className="fw-semibold">{e.title}</span>
                  {e.class_name && <span className="point-chip"> {e.class_name}</span>}
                  {e.course_title && <span className="point-chip"> {e.course_title}</span>}
                  {e.session_label && <span className="point-chip"> {e.session_label}</span>}
                  <span className="text-secondary small">{e.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
