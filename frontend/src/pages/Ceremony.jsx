import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ceremonyApi } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const TIERS = [
  ["امتياز", "text-bg-warning"], ["تهنئة", "text-bg-success"],
  ["تشجيع", "text-bg-info"], ["لوحة الشرف", "text-bg-secondary"],
];
const MEDALS = ["", "", ""];

export default function CeremonyPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState(1);
  const [overview, setOverview] = useState(null);
  const [classId, setClassId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [certMode, setCertMode] = useState("tiers");
  const [topN, setTopN] = useState(3);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ceremonyApi.overview(term);
      setOverview(data);
      if (data.classes.length && !data.classes.some((row) => row.class.id === classId)) {
        setClassId(data.classes[0].class.id);
      }
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (!classId) { setDetail(null); return; }
    ceremonyApi.detail(classId, term).then(setDetail).catch((error) => toast(error.message, "danger"));
  }, [classId, term, toast]);

  const generateCertificates = async () => {
    setBusy("certs");
    try {
      const doc = await ceremonyApi.generateCertificates({ class_id: classId, term, mode: certMode, top_n: topN });
      toast(`${t("وُلّدت شهادات التكريم")} — ${doc.certificates_count} ${t("شهادات")}`);
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const generateBoard = async () => {
    setBusy("board");
    try {
      const doc = await ceremonyApi.generateHonourBoard({ class_id: classId, term });
      toast(t("وُلّدت لوحة الشرف"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  if (loading && !overview) return <Spinner />;
  if (!overview) return null;

  const tierBadge = (label) => (TIERS.find(([name]) => name === label) || [null, "text-bg-light"])[1];

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز حفل التكريم والشهادات")}</h3>
          <p className="text-secondary mb-0">{t("احتفِ بمتفوقي كل ثلاثي: منصة التتويج، التقديرات الرسمية (امتياز، تهنئة، تشجيع، لوحة شرف)، أبطال التحسن، وجوائز الحضور — ثم اطبع الشهادات ولوحة الشرف بضغطة واحدة.")}</p>
        </div>
        <select className="form-select exam-term-select" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
          {TERMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {!overview.classes.length && <EmptyState title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا أولًا من صفحة الأقسام والتقدم.")} />}

      <div className="row g-3 mb-4">
        {overview.classes.map((row) => (
          <div className="col-12 col-md-6 col-xl-4" key={row.class.id}>
            <button type="button" onClick={() => setClassId(row.class.id)}
              className={`card border-0 shadow-sm h-100 w-100 text-start exam-class-card ${classId === row.class.id ? "active" : ""}`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <div className="fw-bold">{row.class.name}</div>
                    <div className="text-secondary small">{row.class.level} • {row.eligible} {t("متكرم")}</div>
                  </div>
                  {row.podium[0] && <span className="badge rounded-pill text-bg-warning"> {row.podium[0].student_name}</span>}
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {TIERS.map(([label, cls]) => (
                    <span key={label} className={`badge rounded-pill ${cls}`}>{t(label)}: {row.tier_counts[label] || 0}</span>
                  ))}
                </div>
                {row.improved_top && (
                  <div className="text-secondary small mt-2"> {t("أكثر تحسنًا:")} {row.improved_top.student_name} (+{row.improved_top.improvement})</div>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      {detail && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h5 className="fw-bold mb-0">{detail.class.name} — {detail.term_label}</h5>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <select className="form-select form-select-sm exam-count-select" value={certMode} onChange={(e) => setCertMode(e.target.value)}>
                  <option value="tiers">{t("شهادات حسب التقدير")}</option>
                  <option value="top">{t("أوائل الفوج فقط")}</option>
                </select>
                {certMode === "top" && (
                  <select className="form-select form-select-sm exam-count-select" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                    {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
                <button className="btn btn-sm btn-warning rounded-pill" disabled={busy === "certs"} onClick={generateCertificates}>
                  {busy === "certs" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="sparkle" size={15} /> {t("توليد الشهادات")}</>}
                </button>
                <button className="btn btn-sm btn-primary rounded-pill" disabled={busy === "board"} onClick={generateBoard}>
                  {busy === "board" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={15} /> {t("لوحة الشرف")}</>}
                </button>
              </div>
            </div>

            {detail.podium.length > 0 && (
              <div className="row g-3 mb-4">
                {detail.podium.map((row, index) => (
                  <div className="col-12 col-md-4" key={row.student_id}>
                    <div className={`podium-card podium-${index + 1}`}>
                      <div className="podium-medal">{MEDALS[index]}</div>
                      <div className="fw-bold">{row.student_name}</div>
                      <div className="podium-average">{row.average}</div>
                      <span className={`badge rounded-pill ${tierBadge(row.tier)}`}>{t(row.tier)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="row g-4">
              <div className="col-12 col-xl-7">
                <h6 className="fw-bold mb-2">{t("الترتيب الكامل للفوج")}</h6>
                {!detail.ranked.length
                  ? <p className="text-secondary small">{t("لا نقاط مكتملة في هذا الثلاثي بعد — أكمل إدخال النقاط من صفحة إدخال النقاط.")}</p>
                  : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle exam-table">
                        <thead><tr><th>#</th><th>{t("التلميذ")}</th><th>{t("المعدل")}</th><th>{t("التقدير")}</th><th>{t("التحسن")}</th></tr></thead>
                        <tbody>
                          {detail.ranked.map((row) => (
                            <tr key={row.student_id}>
                              <td>{MEDALS[row.rank - 1] || row.rank}</td>
                              <td className="fw-bold">{row.student_name}</td>
                              <td>{row.average}</td>
                              <td>{row.tier
                                ? <span className={`badge rounded-pill ${tierBadge(row.tier)}`}>{t(row.tier)}</span>
                                : <span className="text-secondary">—</span>}</td>
                              <td>{row.improvement !== null && row.improvement !== undefined
                                ? <span className={row.improvement >= 0 ? "text-success" : "text-danger"}>{row.improvement >= 0 ? "+" : ""}{row.improvement}</span>
                                : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
              <div className="col-12 col-xl-5">
                <h6 className="fw-bold mb-2"> {t("أبطال التحسن")}</h6>
                {!detail.improved.length
                  ? <p className="text-secondary small">{t("يظهر أبطال التحسن ابتداءً من الثلاثي الثاني بمقارنة المعدلات.")}</p>
                  : detail.improved.map((row) => (
                    <div key={row.student_id} className="exam-risk-row ceremony-improved-row">
                      <span className="fw-bold small">{row.student_name}</span>
                      <span className="text-secondary small">{row.previous_average} ← {row.average}</span>
                      <span className="badge text-bg-success">+{row.improvement}</span>
                    </div>
                  ))}
                <h6 className="fw-bold mt-4 mb-2"> {t("جوائز الحضور المنتظم")}</h6>
                {!detail.attendance_awards.length
                  ? <p className="text-secondary small">{t("لا جوائز حضور بعد (حضور ≥95٪ في 5 سجلات على الأقل).")}</p>
                  : (
                    <div className="d-flex flex-wrap gap-1">
                      {detail.attendance_awards.map((row) => (
                        <span key={row.student_id} className="badge rounded-pill text-bg-light border">{row.student_name} — {row.attendance_rate}٪</span>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
