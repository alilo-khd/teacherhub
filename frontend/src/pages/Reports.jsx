import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const CHECK_STATUS = { ok: ["مكتمل", "text-bg-success"], warning: ["تنبيه", "text-bg-warning"], missing: ["ناقص", "text-bg-danger"] };
const INCLUDES = [["reports", "كشوف متابعة فردية لكل تلميذ"], ["certificates", "شهادات المتفوقين"], ["council", "تقرير مجلس الفوج"], ["bulletin", "نشرة أولياء الفوج"]];

export default function ReportsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState(1);
  const [overview, setOverview] = useState([]);
  const [classId, setClassId] = useState(null);
  const [pack, setPack] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [include, setInclude] = useState({ reports: true, certificates: true, council: true, bulletin: true });
  const [certMode, setCertMode] = useState("threshold");
  const [minAverage, setMinAverage] = useState(14);
  const [topN, setTopN] = useState(3);
  const [skipExisting, setSkipExisting] = useState(true);

  const loadOverview = useCallback(async () => {
    try {
      const data = await api(`/term-packs/?term=${term}`);
      setOverview(data.classes || []);
      setClassId((current) => current && (data.classes || []).some((row) => row.class.id === current) ? current : (data.classes?.[0]?.class.id ?? null));
    } catch (error) { toast(error.message, "danger"); }
  }, [term, toast]);

  const loadPack = useCallback(async () => {
    if (!classId) { setPack(null); return; }
    setLoading(true);
    try { setPack(await api(`/classes/${classId}/term-pack/?term=${term}`)); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [classId, term, toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadPack(); }, [loadPack]);

  const generate = async () => {
    const selected = Object.entries(include).filter(([, v]) => v).map(([k]) => k);
    if (!selected.length) { toast(t("اختر نوع وثيقة واحدًا على الأقل"), "danger"); return; }
    setGenerating(true); setResult(null);
    try {
      const data = await api(`/classes/${classId}/term-pack/generate/`, {
        method: "POST",
        body: { term, include: selected, skip_existing: skipExisting, certificate_mode: certMode, min_average: Number(minAverage), top_n: Number(topN) },
      });
      setResult(data); setPack(data.pack);
      toast(`${t("وُلّدت")} ${data.created_count} ${t("وثيقة")} • ${t("تُخطّيت")} ${data.skipped_count}`);
      await loadOverview();
    } catch (error) { toast(error.message, "danger"); }
    setGenerating(false);
  };

  const readiness = pack?.readiness;
  const readinessColor = !readiness ? "secondary" : readiness.score >= 85 ? "success" : readiness.score >= 65 ? "primary" : readiness.score >= 40 ? "warning" : "danger";

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز تقارير الثلاثي واختتامه")}</h3>
          <p className="text-secondary mb-0">{t("تحققوا من جاهزية كل فوج لإغلاق الثلاثي، ثم ولّدوا باقة كاملة: كشوف فردية، شهادات متفوقين، تقرير مجلس ونشرة أولياء — كلها قابلة للتحرير والطباعة.")}</p>
        </div>
        <select className="form-select w-auto" value={term} onChange={(e) => { setTerm(Number(e.target.value)); setResult(null); }}>
          {TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}
        </select>
      </div>

      <div className="row g-3 mb-4">
        {overview.map((row) => (
          <div className="col-12 col-md-6 col-xl-4" key={row.class.id}>
            <button type="button" className={`card border-0 shadow-sm w-100 text-start pack-class-card ${row.class.id === classId ? "active" : ""}`} onClick={() => { setClassId(row.class.id); setResult(null); }}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div><h6 className="fw-bold mb-1">{row.class.name}</h6><div className="small text-secondary">{row.class.level}</div></div>
                  <span className={`badge ${row.readiness_score >= 85 ? "text-bg-success" : row.readiness_score >= 65 ? "text-bg-primary" : row.readiness_score >= 40 ? "text-bg-warning" : "text-bg-danger"}`}>{row.readiness_score}٪</span>
                </div>
                <div className="small text-secondary mt-2">{te(row.readiness_label)} • {t("النقاط")} {row.graded}/{row.class.students} • {t("كشوف مولّدة")} {row.generated_reports}/{row.class.students}</div>
                <div className="small text-secondary">{t("معدل الثلاثي")}: {row.term_average ?? "—"} • {t("نقاط تحقق مفتوحة")}: {row.open_checks}</div>
              </div>
            </button>
          </div>
        ))}
        {!overview.length && <div className="col-12"><EmptyState title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا أولًا من صفحة الأقسام والتقدم.")} /></div>}
      </div>

      {loading && !pack ? <Spinner /> : pack && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-12 col-xl-4">
              <div className="card border-0 shadow-sm h-100"><div className="card-body text-center">
                <div className={`display-5 fw-bold text-${readinessColor}`}>{readiness.score}٪</div>
                <div className="fw-semibold mb-3">{te(readiness.label)}</div>
                {readiness.components.map((row) => (
                  <div key={row.key} className="text-start mb-2">
                    <div className="d-flex justify-content-between small"><span>{te(row.label)}</span><span className="fw-semibold">{row.value}٪</span></div>
                    <div className="progress readiness-bar"><div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, row.value))}%` }} /></div>
                  </div>
                ))}
                <div className="row text-center mt-3 small">
                  <div className="col-4"><div className="fw-bold">{pack.summary.term_average ?? "—"}</div><div className="text-secondary">{t("معدل الثلاثي")}</div></div>
                  <div className="col-4"><div className="fw-bold">{pack.summary.attendance_rate ?? "—"}٪</div><div className="text-secondary">{t("الحضور")}</div></div>
                  <div className="col-4"><div className="fw-bold">{pack.summary.assignment_completion}٪</div><div className="text-secondary">{t("تسليم المهام")}</div></div>
                </div>
              </div></div>
            </div>
            <div className="col-12 col-xl-8">
              <div className="card border-0 shadow-sm h-100"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("قائمة التحقق قبل إغلاق الثلاثي")}</h6>
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

          <div className="card border-0 shadow-sm mb-4"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("توليد باقة الثلاثي")}</h6>
            <div className="d-flex flex-wrap gap-3 mb-3">
              {INCLUDES.map(([key, label]) => (
                <label key={key} className="form-check">
                  <input type="checkbox" className="form-check-input" checked={include[key]} onChange={(e) => setInclude((x) => ({ ...x, [key]: e.target.checked }))} />
                  <span className="form-check-label">{t(label)}</span>
                </label>
              ))}
            </div>
            {include.certificates && (
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <select className="form-select w-auto" value={certMode} onChange={(e) => setCertMode(e.target.value)}>
                  <option value="threshold">{t("حسب حد أدنى للمعدل")}</option>
                  <option value="top">{t("أوائل الفوج فقط")}</option>
                </select>
                {certMode === "threshold"
                  ? <span className="d-flex align-items-center gap-2"><label className="small text-secondary">{t("الحد الأدنى")}</label><input type="number" className="form-control pack-num" min="0" max="20" step="0.5" value={minAverage} onChange={(e) => setMinAverage(e.target.value)} /></span>
                  : <span className="d-flex align-items-center gap-2"><label className="small text-secondary">{t("عدد الأوائل")}</label><input type="number" className="form-control pack-num" min="1" max="20" value={topN} onChange={(e) => setTopN(e.target.value)} /></span>}
              </div>
            )}
            <label className="form-check mb-3">
              <input type="checkbox" className="form-check-input" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
              <span className="form-check-label">{t("تخطّي الوثائق المولّدة سابقًا لهذا الثلاثي")}</span>
            </label>
            <div>
              <button className="btn btn-primary rounded-pill px-4" disabled={generating} onClick={generate}>
                {generating ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="sparkle" size={16} /> {t("توليد الباقة")}</>}
              </button>
            </div>
            {result && (
              <div className="mt-3">
                {result.created.map((doc) => (
                  <div key={doc.id} className="d-flex flex-wrap gap-2 align-items-center py-1">
                    <span className="badge text-bg-success">{t("وُلّدت")}</span><span>{doc.title}</span>
                    <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(`/editor/${doc.id}`)}>{t("فتح في المحرر")}</button>
                  </div>
                ))}
                {result.skipped.map((row, i) => (
                  <div key={i} className="d-flex flex-wrap gap-2 align-items-center py-1 text-secondary">
                    <span className="badge text-bg-secondary">{t("تُخطّيت")}</span><span>{row.name}</span><span className="small">{row.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div></div>

          <div className="card border-0 shadow-sm mb-4"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("تلاميذ الفوج وكشوفهم")} ({pack.generated_reports}/{pack.students.length})</h6>
            <div className="table-responsive"><table className="table align-middle">
              <thead><tr><th>{t("الترتيب")}</th><th>{t("التلميذ")}</th><th>{t("معدل الثلاثي")}</th><th>{t("المعدل السنوي")}</th><th>{t("الحضور")}</th><th>{t("تسليم المهام")}</th><th>{t("المخاطرة")}</th><th>{t("الكشف")}</th></tr></thead>
              <tbody>
                {pack.students.map((row) => (
                  <tr key={row.student_id}>
                    <td>{row.rank ?? "—"}</td>
                    <td><button className="btn btn-link p-0 text-decoration-none fw-semibold" onClick={() => navigate(`/students/${row.student_id}`)}>{row.student_name}</button></td>
                    <td>{row.term_average ?? "—"}</td><td>{row.annual_average ?? "—"}</td>
                    <td>{row.attendance_rate != null ? `${row.attendance_rate}٪` : "—"}</td>
                    <td>{row.assignment_completion}٪</td>
                    <td><span className={`badge ${row.risk_score >= 50 ? "text-bg-danger" : row.risk_score >= 25 ? "text-bg-warning" : "text-bg-success"}`}>{row.risk_score}/100</span></td>
                    <td>{row.has_report
                      ? <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(`/editor/${row.report_document_id}`)}>{t("فتح الكشف")}</button>
                      : <span className="badge text-bg-light border">{t("غير مولّد")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div></div>

          {!!pack.existing_documents.length && (
            <div className="card border-0 shadow-sm"><div className="card-body">
              <h6 className="fw-bold mb-3">{t("وثائق باقة هذا الثلاثي")}</h6>
              {pack.existing_documents.map((doc) => (
                <div key={doc.id} className="d-flex flex-wrap gap-2 align-items-center py-1 border-bottom">
                  <span className="flex-grow-1">{doc.title}</span>
                  <span className="small text-secondary">{doc.updated_at?.slice(0, 10)}</span>
                  <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(`/editor/${doc.id}`)}>{t("فتح في المحرر")}</button>
                </div>
              ))}
            </div></div>
          )}
        </>
      )}
    </>
  );
}
