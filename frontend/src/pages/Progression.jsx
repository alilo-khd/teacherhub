import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const STATUS = { done: ["منجز", "text-bg-success"], current: ["جارٍ الآن", "text-bg-primary"], upcoming: ["قادم", "text-bg-secondary"] };
const PACE = { ahead: "text-bg-success", on_track: "text-bg-primary", behind: "text-bg-danger" };

export default function ProgressionPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [overview, setOverview] = useState([]);
  const [classId, setClassId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api("/progressions/")
      .then((result) => {
        setOverview(result.classes || []);
        setClassId((current) => current ?? result.classes?.[0]?.class.id ?? null);
      })
      .catch((error) => toast(error.message, "danger"));
  }, [toast]);

  const load = useCallback(async () => {
    if (!classId) { setData(null); return; }
    setLoading(true);
    try { setData(await api(`/classes/${classId}/progression/`)); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [classId, toast]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const doc = await api(`/classes/${classId}/progression/generate-document/`, { method: "POST", body: {} });
      toast(t("وُلّد التوزيع السنوي للفوج"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setGenerating(false);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز التوزيع السنوي وتقدّم المقرر")}</h3>
          <p className="text-secondary mb-0">{t("أين وصل كل فوج في المقرر؟ ومتى سينتهي؟ توزيع سنوي محسوب من جدول التوقيت الفعلي والعطل المسجلة، مع تواريخ متوقعة للدروس القادمة وتنبيهات الإيقاع.")}</p>
        </div>
        {classId && <button className="btn btn-primary rounded-pill" disabled={generating} onClick={generate}>
          {generating ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={16} /> {t("توليد التوزيع السنوي")}</>}
        </button>}
      </div>

      <div className="row g-3 mb-4">
        {overview.map((row) => (
          <div className="col-12 col-md-6 col-xl-4" key={row.class.id}>
            <button type="button" className={`card border-0 shadow-sm w-100 text-start pack-class-card ${row.class.id === classId ? "active" : ""}`} onClick={() => setClassId(row.class.id)}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div><h6 className="fw-bold mb-1">{row.class.name}</h6><div className="small text-secondary">{row.class.level} • {row.school_year}</div></div>
                  <span className={`badge ${PACE[row.pace] || "text-bg-secondary"}`}>{te(row.pace_label)}</span>
                </div>
                <div className="progress readiness-bar my-2"><div className="progress-bar" style={{ width: `${row.percent}%` }} /></div>
                <div className="small text-secondary">{row.done_courses}/{row.total_courses} {t("دروس")} ({row.percent}٪) • {t("الدرس الجاري")}: {row.current_course || "—"}</div>
                <div className="small text-secondary">{t("الإنهاء المتوقع")}: {row.projected_finish || "—"}</div>
              </div>
            </button>
          </div>
        ))}
        {!overview.length && <div className="col-12"><EmptyState title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا أولًا من صفحة الأقسام والتقدم.")} /></div>}
      </div>

      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="row g-3 mb-4">
            {[[`${data.summary.percent}٪`, "تقدم المقرر"], [`${data.summary.done_courses}/${data.summary.total_courses}`, "دروس منجزة"], [data.summary.current_course || "—", "الدرس الجاري"], [data.summary.projected_finish || "—", "الإنهاء المتوقع"], [data.slots_per_week, "حصص أسبوعيًا"], [te(data.summary.pace_label), "الإيقاع السنوي"]].map(([value, label]) => (
              <div className="col-6 col-md-4 col-xl-2" key={label}><div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>
            ))}
          </div>

          <div className="card border-0 shadow-sm mb-4"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("توزيع الدروس على السنة")} — {data.class.name} ({data.school_year.label})</h6>
            <div className="table-responsive"><table className="table align-middle">
              <thead><tr><th>#</th><th>{t("الدرس")}</th><th>{t("المجال / الوحدة")}</th><th>{t("الحالة")}</th><th>{t("التاريخ")}</th><th>{t("الثلاثي")}</th><th>{t("خطة الدرس")}</th></tr></thead>
              <tbody>
                {data.courses.map((row) => {
                  const [label, badge] = STATUS[row.status] || STATUS.upcoming;
                  return (
                    <tr key={row.course_id} className={row.status === "current" ? "table-primary" : ""}>
                      <td>{row.order}</td>
                      <td className="fw-semibold">{row.title}</td>
                      <td className="text-secondary">{[row.domain, row.unit].filter(Boolean).join(" / ") || "—"}</td>
                      <td><span className={`badge ${badge}`}>{te(label)}</span></td>
                      <td>{row.date || "—"}{row.is_projected && <span className="text-secondary small"> ({t("متوقع")})</span>}</td>
                      <td>{row.term_label ? te(row.term_label) : "—"}</td>
                      <td>{row.has_lesson_plan ? <span className="badge text-bg-success">{t("جاهزة")}</span> : <span className="badge text-bg-light border">{t("غير موجودة")}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <p className="small text-secondary mb-0">{t("التواريخ القادمة تقديرية: تُحسب من أيام حصص الفوج في جدول التوقيت مع استبعاد العطل والمناسبات المسجلة، وتتحدث تلقائيًا عند تسجيل حصص جديدة.")}</p>
          </div></div>

          <div className="card border-0 shadow-sm"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("توصيات الإيقاع والتقدم")}</h6>
            {data.recommendations.map((row, i) => (
              <div key={i} className="d-flex flex-wrap gap-2 align-items-center py-2 border-bottom">
                <span className={`badge ${row.severity === "high" ? "text-bg-danger" : row.severity === "medium" ? "text-bg-warning" : "text-bg-success"}`}>{t(row.severity === "high" ? "أولوية عالية" : row.severity === "medium" ? "متوسطة" : "منخفضة")}</span>
                <span className="fw-semibold">{te(row.title)}</span>
                <span className="text-secondary small flex-grow-1">{row.text}</span>
              </div>
            ))}
          </div></div>
        </>
      )}
    </>
  );
}
