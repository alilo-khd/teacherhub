import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { examSeasonApi } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];

function readinessColor(score) {
  return score >= 80 ? "bg-success" : score >= 60 ? "bg-info" : score >= 40 ? "bg-warning" : "bg-danger";
}

function ReadinessBar({ score, label }) {
  return (
    <div>
      <div className="d-flex justify-content-between small mb-1">
        <span className="fw-bold">{label}</span><span>{score}٪</span>
      </div>
      <div className="progress exam-progress">
        <div className={`progress-bar ${readinessColor(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function ExamSeasonPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState(1);
  const [overview, setOverview] = useState(null);
  const [classId, setClassId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [examCount, setExamCount] = useState(10);
  const [includeAnswers, setIncludeAnswers] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await examSeasonApi.overview(term);
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
    examSeasonApi.detail(classId, term).then(setDetail).catch((error) => toast(error.message, "danger"));
  }, [classId, term, toast]);

  const generatePack = async () => {
    setBusy("pack");
    try {
      const doc = await examSeasonApi.generatePack({ class_id: classId, term });
      toast(t("وُلّدت حزمة المراجعة والامتحانات"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const generateMockExam = async () => {
    setBusy("exam");
    try {
      const doc = await examSeasonApi.generateMockExam({ class_id: classId, term, count: examCount, include_answers: includeAnswers });
      toast(`${t("وُلّد اختبار تجريبي")} — ${doc.questions_used} ${t("سؤالًا من بنك الأسئلة")}`);
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  if (loading && !overview) return <Spinner />;
  if (!overview) return null;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز المراجعة وموسم الامتحانات")}</h3>
          <p className="text-secondary mb-0">{t("جاهزية كل فوج للاختبارات: اكتمال النقاط، تغطية بنك الأسئلة للدروس، أولويات المراجعة حسب قدم الدرس، والتلاميذ الذين يحتاجون دعمًا قبل الاختبار — مع توليد حزمة مراجعة واختبار تجريبي بضغطة واحدة.")}</p>
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
                    <div className="text-secondary small">{row.class.level} • {row.stats.students} {t("تلميذ")}</div>
                  </div>
                  <span className={`badge rounded-pill ${row.readiness.score >= 60 ? "text-bg-success" : row.readiness.score >= 40 ? "text-bg-warning" : "text-bg-danger"}`}>
                    {row.readiness.score}٪
                  </span>
                </div>
                <ReadinessBar score={row.readiness.score} label={row.readiness.label} />
                <div className="d-flex flex-wrap gap-1 mt-3">
                  <span className="badge text-bg-light border">{row.stats.lessons_taught} {t("درس دُرّس")}</span>
                  <span className="badge text-bg-light border">{row.stats.bank_questions} {t("سؤال بنك")}</span>
                  <span className="badge text-bg-light border">{row.at_risk_count} {t("يحتاج اهتمامًا")}</span>
                  {row.stats.average !== null && <span className="badge text-bg-light border">{t("المعدل:")} {row.stats.average}</span>}
                </div>
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
                <select className="form-select form-select-sm exam-count-select" value={examCount} onChange={(e) => setExamCount(Number(e.target.value))}>
                  {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n} {t("أسئلة")}</option>)}
                </select>
                <label className="form-check form-check-inline small mb-0">
                  <input type="checkbox" className="form-check-input" checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} /> {t("مع مفتاح الإجابة")}
                </label>
                <button className="btn btn-sm btn-outline-primary rounded-pill" disabled={busy === "exam"} onClick={generateMockExam}>
                  {busy === "exam" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="clipboard" size={15} /> {t("اختبار تجريبي")}</>}
                </button>
                <button className="btn btn-sm btn-primary rounded-pill" disabled={busy === "pack"} onClick={generatePack}>
                  {busy === "pack" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={15} /> {t("حزمة المراجعة")}</>}
                </button>
              </div>
            </div>

            <div className="row g-3 mb-4">
              {[[`${detail.readiness.score}٪`, detail.readiness.label], [detail.stats.students, "التلاميذ"],
                [detail.stats.graded_complete, "معدلات مكتملة"], [detail.stats.average ?? "—", "معدل الفوج"],
                [detail.stats.success_rate !== null ? `${detail.stats.success_rate}٪` : "—", "نسبة النجاح"],
                [detail.at_risk_count, "يحتاج اهتمامًا"]].map(([value, label]) => (
                <div className="col-6 col-md-4 col-xl-2" key={label}>
                  <div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div>
                </div>
              ))}
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12 col-lg-4"><ReadinessBar score={detail.readiness.parts.marks_completeness} label={t("اكتمال النقاط (تقويم + فروض)")} /></div>
              <div className="col-12 col-lg-4"><ReadinessBar score={detail.readiness.parts.questions_coverage} label={t("تغطية بنك الأسئلة للدروس")} /></div>
              <div className="col-12 col-lg-4"><ReadinessBar score={detail.readiness.parts.students_clear} label={t("تلاميذ خارج قائمة الاهتمام")} /></div>
            </div>

            <div className="row g-4">
              <div className="col-12 col-xl-7">
                <h6 className="fw-bold mb-2">{t("أولويات مراجعة الدروس")}</h6>
                {!detail.lessons.length
                  ? <p className="text-secondary small">{t("لا حصص منفذة موثقة في هذا الثلاثي بعد — وثّق حصصك من سجلّ الحصص.")}</p>
                  : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle exam-table">
                        <thead><tr><th>{t("الدرس")}</th><th>{t("آخر تدريس")}</th><th>{t("أسئلة البنك")}</th><th>{t("الأولوية")}</th></tr></thead>
                        <tbody>
                          {detail.lessons.map((lesson) => (
                            <tr key={lesson.course_id}>
                              <td className="fw-bold">{lesson.title}<div className="text-secondary fw-normal small">{lesson.domain}</div></td>
                              <td>{lesson.last_taught}<div className="text-secondary small">{t("منذ")} {lesson.days_since} {t("يوم")}</div></td>
                              <td>{lesson.questions_count === 0
                                ? <span className="badge text-bg-warning">{t("بدون أسئلة")}</span>
                                : lesson.questions_count}</td>
                              <td><span className={`badge rounded-pill ${lesson.priority === "عالية" ? "text-bg-danger" : lesson.priority === "متوسطة" ? "text-bg-warning" : "text-bg-success"}`}>{t(lesson.priority)}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
              <div className="col-12 col-xl-5">
                <h6 className="fw-bold mb-2">{t("تلاميذ يحتاجون دعمًا قبل الاختبار")}</h6>
                {!detail.at_risk.length
                  ? <p className="text-secondary small">{t("لا تلاميذ في قائمة الاهتمام — أحسنت.")}</p>
                  : (
                    <div className="d-flex flex-column gap-2">
                      {detail.at_risk.map((row) => (
                        <div key={row.student_id} className="exam-risk-row">
                          <div className="d-flex justify-content-between">
                            <span className="fw-bold small">{row.student_name}</span>
                            <span className="badge text-bg-light border">{row.average !== null ? row.average : "—"}</span>
                          </div>
                          <div className="text-secondary small">{row.reasons.join("؛ ")}</div>
                        </div>
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
