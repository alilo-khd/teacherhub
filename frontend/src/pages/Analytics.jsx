import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const COMPONENTS = [["continuous", "التقويم المستمر"], ["supervised", "الفروض المحروسة"], ["exam", "الاختبار"]];
const fmt = (value, suffix = "") => value == null ? "—" : `${value}${suffix}`;
const healthBadge = (score) => score == null ? "text-bg-secondary" : score >= 85 ? "text-bg-success" : score >= 70 ? "text-bg-primary" : score >= 50 ? "text-bg-warning" : "text-bg-danger";
const riskBadge = (level) => level === "high" ? "text-bg-danger" : level === "medium" ? "text-bg-warning" : "text-bg-success";

function Bar({ value, max = 100, label, display }) {
  const percent = Math.max(0, Math.min(100, ((value || 0) / max) * 100));
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between small mb-1"><span className="fw-semibold">{label}</span><span>{display ?? fmt(value)}</span></div>
      <div className="progress analytics-progress"><div className="progress-bar" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function StudentRows({ rows, mode, navigate, t, te }) {
  if (!rows?.length) return <p className="text-secondary small mb-0">{t("لا بيانات كافية بعد.")}</p>;
  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0 analytics-table">
        <thead><tr><th>{t("التلميذ")}</th><th>{mode === "improved" ? t("التطور") : t("معدل الثلاثي")}</th><th>{t("الحضور")}</th><th>{t("المهام")}</th><th>{t("المخاطرة")}</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.student_id}>
            <td><button type="button" className="student-profile-link" onClick={() => navigate(`/students/${row.student_id}`)}>{row.student_name}</button></td>
            <td>{mode === "improved" ? fmt(row.trend) : fmt(row.term_average)}</td>
            <td>{fmt(row.attendance_rate, "٪")}</td>
            <td>{row.assignment_completion}٪</td>
            <td><span className={`badge ${riskBadge(row.risk_level)}`}>{row.risk_score}/100</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [clsId, setClsId] = useState(searchParams.get("class") || "");
  const [term, setTerm] = useState(1);
  const [range, setRange] = useState({ from: "", to: "" });
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState("");

  const load = useCallback(async () => {
    if (!clsId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ term: String(term) });
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const [detail, comparison] = await Promise.all([
        api(`/classes/${clsId}/analytics/?${params.toString()}`),
        api(`/analytics/classes/?term=${term}`),
      ]);
      setData(detail); setOverview(comparison.classes || []);
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [clsId, term, range.from, range.to, toast]);

  useEffect(() => {
    api("/classes/").then(listOf).then((rows) => {
      setClasses(rows);
      if (!clsId && rows[0]) setClsId(String(rows[0].id));
    }).catch((error) => toast(error.message, "danger"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const selectClass = (id) => {
    setClsId(String(id));
    setSearchParams({ class: String(id) });
  };

  const generate = async (type) => {
    if (!clsId) return;
    setGenerating(type);
    try {
      const doc = await api(`/analytics/classes/${clsId}/generate-report/`, {
        method: "POST",
        body: { term, from: range.from || null, to: range.to || null, type },
      });
      toast(type === "bulletin" ? t("وُلّدت نشرة أولياء الفوج") : t("وُلّد تقرير تحليلات الفوج"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setGenerating("");
  };

  const selected = data?.marks?.selected || {};
  const health = data?.health || {};
  const statCards = data ? [
    [health.score == null ? "—" : `${health.score}`, "مؤشر صحة الفوج"],
    [fmt(selected.average), "معدل الثلاثي"],
    [fmt(selected.success_rate, "٪"), "نسبة النجاح"],
    [fmt(data.attendance.attendance_rate, "٪"), "نسبة حضور الفوج"],
    [`${data.assignments.completion_rate}٪`, "تسليم المهام"],
    [`${data.curriculum.percent}٪`, "تقدم المقرر"],
  ] : [];

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز تحليلات الفوج ومراجعة الثلاثي")}</h3>
          <p className="text-secondary mb-0">{t("صورة شاملة عن النقاط والحضور والمهام والدعم وتقدم المقرر، مع مقارنات وتوصيات وتقارير جاهزة لمجالس الأقسام والأولياء.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-light rounded-pill" disabled={!clsId || generating === "bulletin"} onClick={() => generate("bulletin")}>{generating === "bulletin" ? <span className="spinner-border spinner-border-sm" /> : t("نشرة أولياء الفوج")}</button>
          <button className="btn btn-primary rounded-pill" disabled={!clsId || generating === "council"} onClick={() => generate("council")}>{generating === "council" ? <span className="spinner-border spinner-border-sm" /> : t("تقرير مجلس الفوج")}</button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3"><div className="card-body">
        <div className="d-flex flex-wrap gap-3 align-items-end">
          <div><label className="form-label small fw-semibold">{t("الفوج")}</label><div className="d-flex flex-wrap gap-2">{classes.map((cls) => <button key={cls.id} className={`btn btn-sm rounded-pill ${String(cls.id) === clsId ? "btn-dark" : "btn-outline-dark"}`} onClick={() => selectClass(cls.id)}>{cls.name}</button>)}</div></div>
          <div><label className="form-label small fw-semibold">{t("الثلاثي")}</label><div className="d-flex gap-2">{TERMS.map(([value, label]) => <button key={value} className={`btn btn-sm rounded-pill ${term === value ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTerm(value)}>{te(label)}</button>)}</div></div>
          <div><label className="form-label small fw-semibold">{t("من تاريخ")}</label><input type="date" className="form-control" value={range.from} onChange={(e) => setRange((x) => ({ ...x, from: e.target.value }))} /></div>
          <div><label className="form-label small fw-semibold">{t("إلى تاريخ")}</label><input type="date" className="form-control" value={range.to} onChange={(e) => setRange((x) => ({ ...x, to: e.target.value }))} /></div>
          <button className="btn btn-outline-secondary rounded-pill" onClick={() => setRange({ from: "", to: "" })}>{t("كل الفترة")}</button>
        </div>
      </div></div>

      {loading && !data ? <Spinner label={t("جارٍ حساب تحليلات الفوج…")} /> : !classes.length ? <EmptyState title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا وأضف تلاميذه أولًا من صفحة الأقسام والتلاميذ.")} /> : !data ? <Spinner /> : (
        <>
          <div className="row g-3 mb-3">
            {statCards.map(([value, label], index) => (
              <div className="col-6 col-md-4 col-xl-2" key={label}><div className="stat-mini analytics-stat"><div className="stat-mini-num">{value}{index === 0 && health.label ? <span className={`badge ${healthBadge(health.score)} ms-2 align-middle`}>{te(health.label)}</span> : null}</div><div className="stat-mini-label">{t(label)}</div></div></div>
            ))}
          </div>

          <div className="card border-0 shadow-sm mb-3"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("مقارنة الأفواج في هذا الثلاثي")}</h6>
            <div className="table-responsive"><table className="table table-hover align-middle mb-0 analytics-table">
              <thead><tr><th>{t("الفوج")}</th><th>{t("التلاميذ")}</th><th>{t("معدل الثلاثي")}</th><th>{t("النجاح")}</th><th>{t("الحضور")}</th><th>{t("المهام")}</th><th>{t("المخاطرة")}</th><th>{t("صحة الفوج")}</th><th>{t("المقرر")}</th></tr></thead>
              <tbody>{overview.map((row) => (
                <tr key={row.class_id} className={String(row.class_id) === clsId ? "table-warning" : ""} onClick={() => selectClass(row.class_id)} style={{ cursor: "pointer" }}>
                  <td className="fw-bold">{row.class_name}</td><td>{row.students}</td><td>{fmt(row.term_average)}</td><td>{fmt(row.success_rate, "٪")}</td><td>{fmt(row.attendance_rate, "٪")}</td><td>{row.assignment_completion}٪</td><td>{fmt(row.average_risk)}</td><td><span className={`badge ${healthBadge(row.health_score)}`}>{fmt(row.health_score)}</span></td><td>{row.curriculum_percent}٪</td>
                </tr>
              ))}</tbody>
            </table></div>
          </div></div>

          <div className="row g-3">
            <div className="col-12 col-xl-4">
              <div className="card border-0 shadow-sm h-100"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("تحليل مكوّنات النقطة")}</h6>
                {COMPONENTS.map(([key, label]) => <Bar key={key} value={selected.components?.[key] || 0} max={20} label={te(label)} display={fmt(selected.components?.[key], "/20")} />)}
                <hr />
                <h6 className="fw-bold mb-3">{t("توزيع معدلات الفوج")}</h6>
                {data.marks.distribution.map((row) => <Bar key={row.label} value={row.percent} label={row.label} display={`${row.count} • ${row.percent}٪`} />)}
                <div className="follow-help">{t("أعلى معدل")} {fmt(selected.highest)} • {t("أدنى معدل")} {fmt(selected.lowest)} • {selected.graded}/{data.class.students} {t("تلميذًا مُنقَّطًا")}</div>
              </div></div>
            </div>

            <div className="col-12 col-xl-4">
              <div className="card border-0 shadow-sm mb-3"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("أوائل الفوج")}</h6>
                <StudentRows rows={data.top_performers} mode="top" navigate={navigate} t={t} te={te} />
              </div></div>
              <div className="card border-0 shadow-sm"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("الأكثر تحسنًا بين الثلاثيات")}</h6>
                <StudentRows rows={data.most_improved} mode="improved" navigate={navigate} t={t} te={te} />
              </div></div>
            </div>

            <div className="col-12 col-xl-4">
              <div className="card border-0 shadow-sm h-100 analytics-recommendations"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("توصيات مراجعة الثلاثي")}</h6>
                {data.recommendations.map((row, index) => (
                  <div className={`analytics-recommendation ${row.severity}`} key={index}>
                    <strong>{row.title}</strong><p>{row.text}</p>
                  </div>
                ))}
                <hr />
                <h6 className="fw-bold mb-3">{t("توزيع المخاطرة")}</h6>
                <Bar value={data.support.risk_distribution.high} max={Math.max(1, data.class.students)} label={t("مخاطرة عالية")} display={String(data.support.risk_distribution.high)} />
                <Bar value={data.support.risk_distribution.medium} max={Math.max(1, data.class.students)} label={t("مخاطرة متوسطة")} display={String(data.support.risk_distribution.medium)} />
                <Bar value={data.support.risk_distribution.low} max={Math.max(1, data.class.students)} label={t("مخاطرة منخفضة")} display={String(data.support.risk_distribution.low)} />
              </div></div>
            </div>

            <div className="col-12 col-xl-7">
              <div className="card border-0 shadow-sm"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("تلاميذ يحتاجون متابعة فورية")}</h6>
                {data.needs_support.filter((row) => row.risk_score > 0).length === 0 ? <p className="text-secondary mb-0">{t("لا تلاميذ بمؤشرات مخاطرة حاليًا.")}</p> : (
                  <div className="table-responsive"><table className="table align-middle mb-0 analytics-table">
                    <thead><tr><th>{t("التلميذ")}</th><th>{t("المخاطرة")}</th><th>{t("المعدل السنوي")}</th><th>{t("غيابات")}</th><th>{t("مهام مفقودة")}</th><th>{t("أهم الأسباب")}</th></tr></thead>
                    <tbody>{data.needs_support.filter((row) => row.risk_score > 0).map((row) => <tr key={row.student_id}><td><button className="student-profile-link" onClick={() => navigate(`/students/${row.student_id}`)}>{row.student_name}</button></td><td><span className={`badge ${riskBadge(row.risk_level)}`}>{row.risk_score}/100</span></td><td>{fmt(row.annual_average)}</td><td>{row.absences}</td><td>{row.assignment_missing}</td><td><div className="risk-reasons">{row.reasons.slice(0, 3).map((reason, i) => <span key={i}>{reason}</span>)}</div></td></tr>)}</tbody>
                  </table></div>
                )}
              </div></div>
            </div>

            <div className="col-12 col-xl-5">
              <div className="card border-0 shadow-sm mb-3"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("الحضور والمتابعة اليومية")}</h6>
                <div className="row text-center mb-3">
                  <div className="col"><strong className="d-block fs-5">{data.attendance.recorded_days}</strong><span className="small text-secondary">{t("يوم مسجل")}</span></div>
                  <div className="col"><strong className="d-block fs-5">{data.attendance.counts.absent}</strong><span className="small text-secondary">{t("غياب")}</span></div>
                  <div className="col"><strong className="d-block fs-5">{data.attendance.counts.late}</strong><span className="small text-secondary">{t("تأخر")}</span></div>
                  <div className="col"><strong className="d-block fs-5">{data.follow_up.total}</strong><span className="small text-secondary">{t("سجل متابعة")}</span></div>
                </div>
                {Object.entries(data.follow_up.by_category).map(([key, value]) => <Bar key={key} value={value.average || 0} max={5} label={te(value.label)} display={`${fmt(value.average, "/5")} • ${value.count}`} />)}
              </div></div>

              <div className="card border-0 shadow-sm"><div className="card-body">
                <h6 className="fw-bold mb-3">{t("تقدم المقرر والحصة")}</h6>
                <Bar value={data.curriculum.percent} label={t("الدروس المنجزة")} display={`${data.curriculum.done_count}/${data.curriculum.total_courses} • ${data.curriculum.percent}٪`} />
                <p className="mb-1"><strong>{t("الدرس التالي:")}</strong> {data.curriculum.next_course?.title || t("أُنهي المقرر")}</p>
                <p className="text-secondary small mb-0">{data.curriculum.sessions_in_period} {t("حصة في الفترة المحددة")}{data.curriculum.last_session ? ` • ${t("آخر حصة")} ${data.curriculum.last_session.date}` : ""}</p>
              </div></div>
            </div>

            <div className="col-12">
              <div className="card border-0 shadow-sm"><div className="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><h6 className="fw-bold mb-0">{t("مهام تحتاج متابعة")}</h6><button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate("/assignments")}>{t("فتح مركز المهام")}</button></div>
                {data.assignment_concerns.length === 0 ? <p className="text-secondary mb-0">{t("لا مهام نشطة أو مغلقة بعد.")}</p> : <div className="table-responsive"><table className="table align-middle mb-0 analytics-table"><thead><tr><th>{t("المهمة")}</th><th>{t("الأجل")}</th><th>{t("الإنجاز")}</th><th>{t("غير المسلّم")}</th><th>{t("متأخر")}</th><th>{t("متوسط النقاط")}</th></tr></thead><tbody>{data.assignment_concerns.map((row) => <tr key={row.id}><td><strong>{row.title}</strong><div className="small text-secondary">{row.course_title || ""}</div></td><td>{row.due_date || "—"}</td><td><div className="d-flex align-items-center gap-2"><div className="progress analytics-progress flex-grow-1"><div className="progress-bar" style={{ width: `${row.completion_rate}%` }} /></div><span>{row.completion_rate}٪</span></div></td><td>{row.missing}</td><td>{row.late}</td><td>{fmt(row.average_score_percent, "٪")}</td></tr>)}</tbody></table></div>}
              </div></div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
