import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

export default function YearReviewPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api("/year-review/")); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const generate = async (classId, key) => {
    setBusy(key);
    try {
      const doc = await api("/year-review/generate-document/", { method: "POST", body: classId ? { class_id: classId } : {} });
      toast(t("وُلّد تقرير الحصيلة السنوية"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const totals = data.totals;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز الحصيلة السنوية")} — {data.school_year}</h3>
          <p className="text-secondary mb-0">{t("حصيلة السنة كاملة لكل فوج: نتائج الثلاثيات ومسارها، أوائل السنة، أكثر التلاميذ تحسنًا، من يحتاج دعمًا صيفيًا، وكل نشاط السنة في تقرير واحد.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill" disabled={busy === "all"} onClick={() => generate(null, "all")}>
          {busy === "all" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={16} /> {t("تقرير كل الأفواج")}</>}
        </button>
      </div>

      <div className="row g-3 mb-4">
        {[[totals.classes, "الأفواج"], [totals.students, "التلاميذ"], [totals.sessions_done, "حصة منفذة"], [totals.documents, "وثائق مولّدة"], [totals.support_plans, "خطط دعم"], [totals.communications, "تواصل أولياء"], [totals.meetings, "اجتماعات"], [`${totals.tasks_done}/${totals.tasks_total}`, "مهام منجزة"]].map(([value, label]) => (
          <div className="col-6 col-md-4 col-xl" key={label}><div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>
        ))}
      </div>

      {!data.classes.length && <EmptyState title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا أولًا من صفحة الأقسام والتقدم.")} />}

      {data.classes.map((row) => (
        <div key={row.class.id} className="card border-0 shadow-sm mb-4"><div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h5 className="fw-bold mb-0">{row.class.name}</h5>
              <div className="small text-secondary">{row.class.level} • {row.students_count} {t("تلميذ")} • {t("المعدل السنوي العام")}: <span className="fw-bold">{row.annual_average ?? "—"}</span>
                {row.year_trend !== null && <> • {t("مسار السنة")}: <span className={`fw-bold ${row.year_trend > 0 ? "text-success" : row.year_trend < 0 ? "text-danger" : ""}`}>{row.year_trend > 0 ? "+" : ""}{row.year_trend}</span></>}
              </div>
            </div>
            <button className="btn btn-light rounded-pill" disabled={busy === `c-${row.class.id}`} onClick={() => generate(row.class.id, `c-${row.class.id}`)}>
              {busy === `c-${row.class.id}` ? <span className="spinner-border spinner-border-sm" /> : t("تقرير هذا الفوج")}
            </button>
          </div>

          <div className="row g-3 mb-3">
            {[1, 2, 3].map((term) => {
              const termRow = row.terms[String(term)];
              return (
                <div className="col-12 col-md-4" key={term}>
                  <div className="border rounded-3 p-3 h-100">
                    <div className="small text-secondary">{te(termRow.label)}</div>
                    <div className="d-flex justify-content-between align-items-end">
                      <span className="fs-4 fw-bold">{termRow.average ?? "—"}</span>
                      <span className="small text-secondary">{termRow.success_rate != null ? `${termRow.success_rate}٪ ${t("نجاح")}` : ""}</span>
                    </div>
                    <div className="progress readiness-bar mt-1"><div className="progress-bar" style={{ width: `${termRow.average ? termRow.average * 5 : 0}%` }} /></div>
                    <div className="small text-secondary mt-1">{termRow.graded} {t("تلميذ مقيّم")}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="row g-3">
            <div className="col-12 col-xl-4">
              <h6 className="fw-semibold">{t("أوائل السنة")}</h6>
              {row.top_year.length ? row.top_year.map((item, i) => (
                <div key={item.student_id} className="d-flex justify-content-between py-1 border-bottom small">
                  <button className="btn btn-link p-0 text-decoration-none" onClick={() => navigate(`/students/${item.student_id}`)}>{i + 1}. {item.student_name}</button>
                  <span className="fw-bold">{item.annual_average}</span>
                </div>
              )) : <p className="small text-secondary">{t("لا معدلات سنوية بعد.")}</p>}
            </div>
            <div className="col-12 col-xl-4">
              <h6 className="fw-semibold">{t("الأكثر تحسنًا")}</h6>
              {row.most_improved.length ? row.most_improved.map((item) => (
                <div key={item.student_id} className="d-flex justify-content-between py-1 border-bottom small">
                  <button className="btn btn-link p-0 text-decoration-none" onClick={() => navigate(`/students/${item.student_id}`)}>{item.student_name}</button>
                  <span className="badge text-bg-success">+{item.trend}</span>
                </div>
              )) : <p className="small text-secondary">{t("لا بيانات تحسن كافية بعد (يلزم ثلاثيان).")}</p>}
            </div>
            <div className="col-12 col-xl-4">
              <h6 className="fw-semibold">{t("دعم صيفي مقترح")}</h6>
              {row.summer_support.length ? row.summer_support.map((item) => (
                <div key={item.student_id} className="d-flex justify-content-between py-1 border-bottom small">
                  <button className="btn btn-link p-0 text-decoration-none" onClick={() => navigate(`/students/${item.student_id}`)}>{item.student_name}</button>
                  <span><span className="fw-bold">{item.annual_average ?? "—"}</span> <span className={`badge ${item.risk_score >= 50 ? "text-bg-danger" : "text-bg-warning"}`}>{item.risk_score}/100</span></span>
                </div>
              )) : <p className="small text-secondary">{t("لا حالات دعم صيفي مقترحة.")}</p>}
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3 small">
            {[[`${row.activity.curriculum_percent}٪`, "تقدم المقرر"], [`${row.activity.assignment_completion}٪`, "تسليم المهام"], [row.activity.attendance_rate != null ? `${row.activity.attendance_rate}٪` : "—", "الحضور السنوي"], [row.activity.support_plans, "خطط دعم"], [row.activity.communications, "تواصل أولياء"], [row.activity.meetings, "اجتماعات"]].map(([value, label]) => (
              <span key={label} className="badge text-bg-light border fs-6">{label}: {value}</span>
            ))}
          </div>
          {!!row.highlights.length && <div className="mt-3">{row.highlights.map((line, i) => <div key={i} className="small text-secondary">• {line}</div>)}</div>}
        </div></div>
      ))}
    </>
  );
}
