import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const CHECK_STATUS = { ok: ["مكتمل", "text-bg-success"], warning: ["تنبيه", "text-bg-warning"], missing: ["ناقص", "text-bg-danger"] };

export default function PortfolioPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api(`/portfolio/?term=${term}`)); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [term, toast]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const doc = await api("/portfolio/generate/", { method: "POST", body: { term } });
      toast(t("وُلّد ملف التفتيش والجاهزية المهنية"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setGenerating(false);
  };

  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const { profile, readiness, totals } = data;
  const scoreColor = readiness.score >= 85 ? "success" : readiness.score >= 65 ? "primary" : readiness.score >= 40 ? "warning" : "danger";

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز ملف التفتيش والجاهزية المهنية")}</h3>
          <p className="text-secondary mb-0">{t("صورة شاملة عن جاهزيتكم لأي زيارة تفتيش أو متابعة: البطاقة المهنية، خطط الدروس، سجل الحصص، دفتر التنقيط، التكوين والزيارات — وملف جاهز للطباعة بضغطة واحدة.")}</p>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select w-auto" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
            {TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}
          </select>
          <button className="btn btn-primary rounded-pill" disabled={generating} onClick={generate}>
            {generating ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={16} /> {t("توليد ملف التفتيش")}</>}
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm h-100"><div className="card-body text-center">
            <div className={`display-5 fw-bold text-${scoreColor}`}>{readiness.score}٪</div>
            <div className="fw-semibold mb-3">{te(readiness.label)}</div>
            {readiness.components.map((row) => (
              <div key={row.key} className="text-start mb-2">
                <div className="d-flex justify-content-between small"><span>{te(row.label)}</span><span className="fw-semibold">{row.value}٪</span></div>
                <div className="progress readiness-bar"><div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, row.value))}%` }} /></div>
              </div>
            ))}
            <div className="border-top pt-3 mt-3 text-start small">
              <div className="fw-bold">{profile.full_name || "—"}</div>
              <div className="text-secondary">{profile.job_title} • {profile.specialty}</div>
              <div className="text-secondary">{profile.current_school || "—"}</div>
              <div className="text-secondary">{t("مقاطعة التفتيش")}: {profile.inspection_district || "—"} • {profile.echelon || ""}</div>
            </div>
          </div></div>
        </div>
        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm h-100"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("قائمة تحقق الجاهزية")}</h6>
            {readiness.checks.map((row) => {
              const [label, badge] = CHECK_STATUS[row.status] || CHECK_STATUS.warning;
              return (
                <div key={row.key} className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom">
                  <span className={`badge ${badge}`}>{te(label)}</span>
                  <span className="fw-semibold">{te(row.label)}</span>
                  <span className="badge text-bg-light border">{row.value}</span>
                  <span className="text-secondary small flex-grow-1">{row.detail}</span>
                  {row.status !== "ok" && <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(row.route)}>{t("معالجة")}</button>}
                </div>
              );
            })}
          </div></div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {[[totals.classes, "الأفواج"], [totals.students, "التلاميذ"], [totals.sessions_done, "حصص منفذة"], [totals.lesson_plans, "خطط دروس"], [totals.documents, "وثائق الاستوديو"], [totals.seminars, "أنشطة تكوينية"], [totals.visits, "زيارات موثقة"]].map(([value, label]) => (
          <div className="col-6 col-md-4 col-xl" key={label}><div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>
        ))}
      </div>

      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        <h6 className="fw-bold mb-3">{t("الأفواج ومؤشرات الثلاثي")}</h6>
        <div className="table-responsive"><table className="table align-middle">
          <thead><tr><th>{t("الفوج")}</th><th>{t("التلاميذ")}</th><th>{t("تقدم المقرر")}</th><th>{t("حصص منفذة")}</th><th>{t("معدل الثلاثي")}</th><th>{t("النجاح")}</th><th>{t("الحضور")}</th><th>{t("صحة الفوج")}</th><th></th></tr></thead>
          <tbody>
            {data.classes.map((row) => (
              <tr key={row.id}>
                <td className="fw-semibold">{row.name}</td><td>{row.students}</td>
                <td>{row.curriculum_percent}٪ ({row.done_courses}/{row.total_courses})</td>
                <td>{row.sessions_done}</td><td>{row.term_average ?? "—"}</td>
                <td>{row.success_rate != null ? `${row.success_rate}٪` : "—"}</td>
                <td>{row.attendance_rate != null ? `${row.attendance_rate}٪` : "—"}</td>
                <td>{row.health_score ?? "—"}</td>
                <td><button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate("/analytics")}>{t("التحليلات")}</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div></div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("أحدث الحصص المنفذة")}</h6>
            {data.recent_sessions.length ? data.recent_sessions.map((row) => (
              <div key={row.id} className="d-flex flex-wrap gap-2 align-items-center py-2 border-bottom">
                <span className="badge text-bg-light border">{row.date}</span>
                <span className="fw-semibold">{row.course_title || "—"}</span>
                <span className="text-secondary small">{row.class_name}</span>
                <span className={`badge ${row.has_lesson_plan ? "text-bg-success" : "text-bg-warning"}`}>{row.has_lesson_plan ? t("خطة درس مرتبطة") : t("بدون خطة مرتبطة")}</span>
              </div>
            )) : <p className="text-secondary mb-0">{t("لا حصص منفذة مسجلة بعد.")}</p>}
          </div></div>
        </div>
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("التكوين والندوات")}</h6>
            {data.training.length ? data.training.map((row) => (
              <div key={row.id} className="d-flex flex-wrap gap-2 align-items-center py-2 border-bottom">
                <span className="badge text-bg-light border">{row.date}</span>
                <span className="fw-semibold">{row.title}</span>
                <span className="badge text-bg-light border">{te(row.kind)}</span>
                <span className="text-secondary small">{row.place}</span>
              </div>
            )) : <p className="text-secondary mb-0">{t("لا أنشطة تكوينية موثقة بعد.")}</p>}
            {!!data.visits.length && <>
              <h6 className="fw-bold mt-4 mb-2">{t("زيارات التفتيش والمتابعة")}</h6>
              {data.visits.map((row) => (
                <div key={row.id} className="py-2 border-bottom">
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="badge text-bg-light border">{row.date}</span>
                    <span className="fw-semibold">{te(row.visit_type)}</span>
                    <span className="text-secondary small">{row.institution}</span>
                  </div>
                  {row.recommendations && <div className="small text-secondary mt-1">{row.recommendations}</div>}
                </div>
              ))}
            </>}
          </div></div>
        </div>
      </div>

      <div className="card border-0 shadow-sm"><div className="card-body">
        <h6 className="fw-bold mb-3">{t("ملفات تفتيش مولّدة سابقًا")}</h6>
        {data.existing_portfolios.length ? data.existing_portfolios.map((doc) => (
          <div key={doc.id} className="d-flex flex-wrap gap-2 align-items-center py-2 border-bottom">
            <span className="flex-grow-1">{doc.title}</span>
            <span className="small text-secondary">{doc.updated_at?.slice(0, 10)}</span>
            <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(`/editor/${doc.id}`)}>{t("فتح في المحرر")}</button>
          </div>
        )) : <p className="text-secondary mb-0">{t("لا ملفات مولّدة بعد — ولّدوا أول ملف من الزر أعلاه.")}</p>}
        <div className="small text-secondary mt-3">{t("وثائق الاستوديو حسب النوع")}: {data.documents_summary.by_kind.map((row) => `${te(row.label)} (${row.count})`).join(" • ") || "—"}</div>
      </div></div>
    </>
  );
}
