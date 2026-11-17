import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { inspectionSimApi } from "../api";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

function barColor(percent) {
  return percent >= 80 ? "bg-success" : percent >= 65 ? "bg-info" : percent >= 50 ? "bg-warning" : "bg-danger";
}
function levelBadge(level) {
  return level === "ممتاز" ? "text-bg-success" : level === "جيد" ? "text-bg-info" : level === "مقبول" ? "text-bg-warning" : "text-bg-danger";
}

export default function InspectionSimulationPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await inspectionSimApi.get()); }
    catch (error) { toast(error.message, "danger"); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try {
      const doc = await inspectionSimApi.generateReport();
      toast(t("وُلّد تقرير محاكاة التفتيش"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy(false);
  };

  if (!data) return <Spinner />;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("محاكاة التفتيش — تقييمك الذاتي")}</h3>
          <p className="text-secondary mb-0">{t("كيف سيراك المفتش لو زارك اليوم؟ درجة محاكاة من 20 محسوبة من أدلة منصتك الحقيقية: خططك، حصصك، نقاطك، متابعتك ووثائقك — مع شبكة ملاحظة حصة محاكاة وخطة تحسين.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" disabled={busy} onClick={generate}>
          {busy ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={16} /> {t("تقرير المحاكاة")}</>}
        </button>
      </div>

      <div className="card border-0 shadow-sm mb-4 sim-overall">
        <div className="card-body d-flex flex-wrap align-items-center gap-4">
          <div className="sim-score">
            <div className="sim-score-num">{data.overall}<span>/20</span></div>
            <div className="badge text-bg-warning fs-6">{t(data.appreciation)}</div>
          </div>
          <div className="flex-grow-1">
            <div className="progress exam-progress mb-2">
              <div className={`progress-bar ${barColor(data.overall_percent)}`} style={{ width: `${data.overall_percent}%` }} />
            </div>
            <div className="d-flex flex-wrap gap-1">
              <span className="badge text-bg-light border">{data.counts.classes} {t("فوج")}</span>
              <span className="badge text-bg-light border">{data.counts.students} {t("تلميذ")}</span>
              <span className="badge text-bg-light border">{data.counts.sessions_done} {t("حصة منفذة")}</span>
              <span className="badge text-bg-light border">{data.counts.documents} {t("وثائق")}</span>
              <span className="badge text-bg-light border">{data.counts.bank_questions} {t("سؤال بنك")}</span>
            </div>
            <p className="text-secondary small mb-0 mt-2">{t("ملاحظة: هذه محاكاة للتقييم الذاتي مبنية على ما هو موثق في المنصة، وليست تقييمًا رسميًا.")}</p>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {data.domains.map((domain) => (
          <div className="col-12 col-md-6 col-xl-4" key={domain.key}>
            <div className="card border-0 shadow-sm h-100"><div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-bold">{domain.label}</span>
                <span className="badge text-bg-dark">{domain.score}/20</span>
              </div>
              <div className="progress exam-progress mb-3">
                <div className={`progress-bar ${barColor(domain.percent)}`} style={{ width: `${domain.percent}%` }} />
              </div>
              {domain.indicators.filter((i) => i.value !== null).map((indicator) => (
                <div key={indicator.label} className="mb-2">
                  <div className="d-flex justify-content-between small">
                    <span className="text-secondary">{indicator.label}</span><span className="fw-bold">{indicator.value}٪</span>
                  </div>
                  <div className="progress sim-mini-progress">
                    <div className={`progress-bar ${barColor(indicator.value)}`} style={{ width: `${indicator.value}%` }} />
                  </div>
                </div>
              ))}
            </div></div>
          </div>
        ))}
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm h-100"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("شبكة ملاحظة الحصة — محاكاة")}</h6>
            <div className="table-responsive">
              <table className="table table-sm align-middle exam-table mb-0">
                <thead><tr><th>{t("المعيار")}</th><th>{t("الدرجة")}</th><th>{t("المستوى")}</th></tr></thead>
                <tbody>
                  {data.grid.map((row) => (
                    <tr key={row.criterion}>
                      <td>{row.criterion}</td>
                      <td className="fw-bold">{row.score}/20</td>
                      <td><span className={`badge rounded-pill ${levelBadge(row.level)}`}>{t(row.level)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div></div>
        </div>
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm mb-3"><div className="card-body">
            <h6 className="fw-bold mb-2">✓ {t("نقاط القوة")}</h6>
            {data.strengths.length
              ? <ul className="small mb-0">{data.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              : <p className="text-secondary small mb-0">{t("لا نقاط قوة بارزة بعد — ابدأ بخطط الدروس وتوثيق الحصص.")}</p>}
          </div></div>
          <div className="card border-0 shadow-sm"><div className="card-body">
            <h6 className="fw-bold mb-2"> {t("خطة التحسين قبل الزيارة")}</h6>
            {data.weaknesses.length
              ? data.weaknesses.map((w) => (
                <div key={w.domain} className="exam-risk-row mb-2">
                  <div className="fw-bold small">{w.domain}</div>
                  <div className="text-secondary small">{w.text} — {w.recommendation}</div>
                </div>
              ))
              : <p className="text-secondary small mb-0">{t("لا ملاحظات جوهرية — واصل بنفس النسق.")}</p>}
          </div></div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        <h6 className="fw-bold mb-3">{t("أدلة تعرضها على المفتش")}</h6>
        <div className="row g-2">
          {data.evidence.map((row) => (
            <div className="col-12 col-md-6" key={row.item}>
              <div className={`sim-evidence ${row.available ? "ok" : ""}`}>
                <span>{row.available ? "✓" : "○"}</span>
                <span className="flex-grow-1 small fw-bold">{row.item}</span>
                <button className="btn btn-sm btn-light border rounded-pill" onClick={() => navigate(row.link)}>{t("فتح")}</button>
              </div>
            </div>
          ))}
        </div>
      </div></div>
    </>
  );
}
