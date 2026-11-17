import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const riskBadge = (level) => level === "high" ? "text-bg-danger" : level === "medium" ? "text-bg-warning" : "text-bg-success";
const riskLabel = (level) => level === "high" ? "عالية" : level === "medium" ? "متوسطة" : "منخفضة";
const toneBadge = (tone) => tone === "danger" ? "text-bg-danger" : tone === "warning" ? "text-bg-warning" : tone === "success" ? "text-bg-success" : "text-bg-info";
const fmt = (value, suffix = "") => value == null ? "—" : `${value}${suffix}`;
const ATTENDANCE_LABELS = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "غياب مبرر", left_early: "غادر مبكرًا" };

function MiniStat({ value, label }) {
  return <div className="col-6 col-md-4 col-xl-2"><div className="stat-mini dossier-stat"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{label}</div></div></div>;
}

function SectionTitle({ children, action }) {
  return <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><h6 className="fw-bold mb-0">{children}</h6>{action}</div>;
}

export default function StudentDossierPage() {
  const { id } = useParams();
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [dossier, setDossier] = useState(null);
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState({ from: "", to: "" });
  const [generating, setGenerating] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await api(`/students/${id}/dossier/${query}`);
      setDossier(data);
      const rows = listOf(await api(`/students/?class=${data.class.id}`));
      setClassmates(rows);
    } catch (e) { setError(e.message); setDossier(null); }
    setLoading(false);
  }, [id, range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const generate = async (type) => {
    setGenerating(type);
    try {
      const result = await api(`/students/${id}/generate-document/`, { method: "POST", body: { type } });
      toast(type === "parent" ? t("وُلّد ملخص الولي وسُجّل التواصل") : t("وُلّد التقرير الفردي للتلميذ"));
      navigate(`/editor/${result.document.id}`);
    } catch (e) { toast(e.message, "danger"); }
    setGenerating("");
  };

  if (loading && !dossier) return <Spinner label={t("جارٍ تحضير ملف التلميذ…")} />;
  if (error || !dossier) return <EmptyState title={t("تعذّر فتح ملف التلميذ")} hint={error || t("قد يكون التلميذ محذوفًا أو غير موجود.")} actionLabel={t("عودة إلى التلاميذ")} onAction={() => navigate("/students")} />;

  const student = dossier.student;
  const summary = dossier.summary;
  const risk = dossier.risk;
  const tabs = [["overview", "نظرة شاملة"], ["marks", "النقاط"], ["attendance", "الحضور والمتابعة"], ["assignments", "المهام"], ["support", "الدعم والتواصل"], ["timeline", "الخط الزمني"]];

  return (
    <>
      <div className="dossier-hero mb-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <button className="btn btn-light btn-sm rounded-pill mb-3" onClick={() => navigate("/students")}>← {t("عودة إلى التلاميذ والنقاط")}</button>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h3 className="fw-bold mb-0">{student.full_name}</h3>
              <span className={`badge rounded-pill ${riskBadge(risk.risk_level)}`}>{t("مخاطرة")} {te(riskLabel(risk.risk_level))} • {risk.risk_score}/100</span>
            </div>
            <p className="text-secondary mb-0 mt-2">{dossier.class.name} • {dossier.class.level}{student.birth_date ? ` • ${student.birth_date}` : ""}{student.notes ? ` • ${student.notes}` : ""}</p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <select className="form-select w-auto" value={String(student.id)} onChange={(e) => navigate(`/students/${e.target.value}`)} aria-label={t("اختيار تلميذ آخر")}>
              {classmates.map((row) => <option key={row.id} value={row.id}>{row.full_name}</option>)}
            </select>
            <button className="btn btn-light rounded-pill" onClick={() => navigate("/follow-up")}>{t("الحضور والمتابعة")}</button>
            <button className="btn btn-light rounded-pill" onClick={() => navigate("/support")}>{t("الدعم والتواصل")}</button>
            <button className="btn btn-outline-primary rounded-pill" disabled={generating === "parent"} onClick={() => generate("parent")}>{generating === "parent" ? <span className="spinner-border spinner-border-sm" /> : t("ملخص للولي")}</button>
            <button className="btn btn-primary rounded-pill" disabled={generating === "report"} onClick={() => generate("report")}>{generating === "report" ? <span className="spinner-border spinner-border-sm" /> : t("تقرير فردي قابل للتحرير")}</button>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3"><div className="card-body py-3">
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div><label className="form-label small fw-semibold">{t("من تاريخ")}</label><input type="date" className="form-control" value={range.from} onChange={(e) => setRange((x) => ({ ...x, from: e.target.value }))} /></div>
          <div><label className="form-label small fw-semibold">{t("إلى تاريخ")}</label><input type="date" className="form-control" value={range.to} onChange={(e) => setRange((x) => ({ ...x, to: e.target.value }))} /></div>
          <button className="btn btn-outline-secondary rounded-pill" onClick={() => setRange({ from: "", to: "" })}>{t("كل الفترة")}</button>
          <span className="text-secondary small ms-auto">{t("تؤثر الفترة في الحضور والمتابعة والمهام ودرجة المخاطرة المعروضة.")}</span>
        </div>
      </div></div>

      <div className="row g-3 mb-3">
        <MiniStat value={fmt(summary.marks.annual_average)} label={t("المعدل السنوي")} />
        <MiniStat value={summary.marks.trend == null ? "—" : `${summary.marks.trend > 0 ? "+" : ""}${summary.marks.trend}`} label={t("تطور المعدل")} />
        <MiniStat value={fmt(summary.attendance.attendance_rate, "٪")} label={t("نسبة الحضور")} />
        <MiniStat value={`${summary.assignments.completion_rate}٪`} label={t("تسليم المهام")} />
        <MiniStat value={summary.support.open} label={t("خطط دعم مفتوحة")} />
        <MiniStat value={summary.communications.total} label={t("تواصل مع الأولياء")} />
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {tabs.map(([key, label]) => <button key={key} className={`btn btn-sm rounded-pill ${tab === key ? "btn-primary" : "btn-light"}`} onClick={() => setTab(key)}>{t(label)}</button>)}
      </div>

      {loading && <Spinner />}

      {!loading && tab === "overview" && (
        <div className="row g-3">
          <div className="col-12 col-xl-8">
            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
              <SectionTitle action={<button className="btn btn-sm btn-light rounded-pill" onClick={() => setTab("marks")}>{t("كل النقاط")}</button>}>{t("النقاط والمعدلات")}</SectionTitle>
              <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>{t("الثلاثي")}</th><th>{t("التقويم المستمر")}</th><th>{t("الفروض المحروسة")}</th><th>{t("الاختبار")}</th><th>{t("المعدل")}</th></tr></thead><tbody>{dossier.marks.map((row) => <tr key={row.term}><td className="fw-semibold">{te(row.term_label)}</td><td>{fmt(row.continuous)}</td><td>{fmt(row.supervised)}</td><td>{fmt(row.exam)}</td><td><span className={`avg-badge ${row.average == null ? "none" : row.average >= 10 ? "ok" : "low"}`}>{fmt(row.average)}</span></td></tr>)}</tbody></table></div>
            </div></div>

            <div className="card border-0 shadow-sm mb-3"><div className="card-body">
              <SectionTitle>{t("متابعة الواجب والسلوك والمشاركة")}</SectionTitle>
              {Object.entries(summary.follow_up.by_category).map(([key, value]) => (
                <div className="mb-3" key={key}><div className="d-flex justify-content-between small mb-1"><span className="fw-semibold">{te(value.label)}</span><span>{value.count} {t("سجلًا")} • {fmt(value.average, "/5")}</span></div><div className="progress dossier-progress"><div className="progress-bar" style={{ width: `${(value.average || 0) * 20}%` }} /></div></div>
              ))}
            </div></div>

            <div className="card border-0 shadow-sm"><div className="card-body">
              <SectionTitle action={<button className="btn btn-sm btn-light rounded-pill" onClick={() => setTab("timeline")}>{t("الخط الزمني الكامل")}</button>}>{t("أحدث أحداث التلميذ")}</SectionTitle>
              {dossier.timeline.length === 0 ? <p className="text-secondary mb-0">{t("لا أحداث مسجلة بعد.")}</p> : dossier.timeline.slice(0, 8).map((event) => (
                <div className="dossier-timeline-row" key={event.id}><span className={`badge ${toneBadge(event.tone)}`}>{te(event.type_label)}</span><div><strong>{event.title}</strong><small>{event.date || "—"} • {event.detail}</small></div></div>
              ))}
            </div></div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="card border-0 shadow-sm mb-3 dossier-risk-card"><div className="card-body">
              <SectionTitle>{t("مؤشر المخاطرة والتوصيات")}</SectionTitle>
              <div className="d-flex align-items-center gap-3 mb-3"><div className="dossier-risk-score">{risk.risk_score}</div><div><div className="fw-bold">{t("درجة المخاطرة")} / 100</div><div className="text-secondary small">{t("مبنية على المعدلات والحضور والمتابعة والمهام.")}</div></div></div>
              {risk.reasons.length ? <div className="risk-reasons mb-3">{risk.reasons.map((reason, i) => <span key={i}>{reason}</span>)}</div> : <p className="text-success small">{t("لا مؤشرات مخاطرة حالية.")}</p>}
              <h6 className="fw-bold small">{t("نقاط القوة")}</h6>
              {dossier.recommendations.strengths.length ? <ul className="dossier-list">{dossier.recommendations.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="text-secondary small">{t("ستظهر نقاط القوة عند توفر بيانات كافية.")}</p>}
              <h6 className="fw-bold small mt-3">{t("الإجراءات المقترحة")}</h6>
              <ul className="dossier-list">{dossier.recommendations.next_actions.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div></div>

            <div className="card border-0 shadow-sm"><div className="card-body">
              <SectionTitle>{t("وثائق فردية مولّدة")}</SectionTitle>
              {dossier.generated_documents.length === 0 ? <p className="text-secondary small mb-0">{t("لا وثائق فردية مولّدة لهذا التلميذ بعد.")}</p> : dossier.generated_documents.map((doc) => (
                <button key={doc.id} className="assignment-side-row" onClick={() => navigate(`/editor/${doc.id}`)}><span><strong>{doc.title}</strong><small>{new Date(doc.updated_at).toLocaleDateString()}</small></span><Icon name="file" size={18} /></button>
              ))}
            </div></div>
          </div>
        </div>
      )}

      {!loading && tab === "marks" && (
        <>
        <div className="card border-0 shadow-sm"><div className="card-body">
          <SectionTitle action={<button className="btn btn-sm btn-primary rounded-pill" onClick={() => navigate("/students")}>{t("فتح دفتر التنقيط")}</button>}>{t("تفاصيل النقاط حسب الثلاثي")}</SectionTitle>
          <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>{t("الثلاثي")}</th><th>{t("التقويم المستمر /20")}</th><th>{t("الفروض المحروسة /20")}</th><th>{t("الاختبار /20")}</th><th>{t("معدل الثلاثي")}</th></tr></thead><tbody>{dossier.marks.map((row) => <tr key={row.term}><td className="fw-semibold">{te(row.term_label)}</td><td>{fmt(row.continuous)}</td><td>{fmt(row.supervised)}</td><td>{fmt(row.exam)}</td><td>{fmt(row.average)}</td></tr>)}</tbody></table></div>
          <div className="follow-help mt-3">{t("المعدل السنوي هو متوسط معدلات الثلاثيات المتوفرة، ويتغير تلقائيًا عند تحديث النقاط في دفتر التنقيط.")}</div>
        </div></div>

        <div className="card border-0 shadow-sm mt-3"><div className="card-body">
          <SectionTitle action={<button className="btn btn-sm btn-primary rounded-pill" onClick={() => navigate("/assessments")}>{t("فتح مركز التقويمات")}</button>}>{t("سجل التقويمات والفروض")}</SectionTitle>
          {(dossier.assessment_results || []).length === 0 ? <p className="text-secondary mb-0">{t("لا نتائج تقويمات مسجلة لهذا التلميذ بعد.")}</p> : (
            <>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="badge rounded-pill text-bg-primary">{t("متوسط التقويمات")}: {fmt((summary.assessments || {}).average_20, "/20")} ({fmt((summary.assessments || {}).average_percent, "٪")})</span>
                <span className="badge rounded-pill text-bg-light border">{t("حاضر")}: {(summary.assessments || {}).present ?? 0}</span>
                <span className="badge rounded-pill text-bg-light border">{t("غائب")}: {(summary.assessments || {}).absent ?? 0}</span>
                <span className="badge rounded-pill text-bg-light border">{t("غائب بعذر")}: {(summary.assessments || {}).excused ?? 0}</span>
              </div>
              <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>{t("التقويم")}</th><th>{t("النوع")}</th><th>{t("الثلاثي")}</th><th>{t("التاريخ")}</th><th>{t("النتيجة")}</th><th>{t("النسبة")}</th><th>{t("التقدير")}</th></tr></thead><tbody>
                {(dossier.assessment_results || []).map((row) => (
                  <tr key={row.result_id}>
                    <td className="fw-semibold">{row.title}{row.gradebook_synced && <span className="badge rounded-pill text-bg-success ms-2">{t("مُزامَن")}</span>}</td>
                    <td>{te(row.kind_label)}</td><td>{te(row.term_label)}</td><td>{row.date || "—"}</td>
                    <td>{row.score == null ? <span className="badge text-bg-light border">{te(row.status_label)}</span> : <>{row.score} /{row.max_score} <span className="text-secondary small">({row.score_20}/20)</span></>}</td>
                    <td>{row.percent == null ? "—" : `${row.percent}٪`}</td>
                    <td>{row.appreciation ? <span className={`badge rounded-pill ${row.percent >= 65 ? "text-bg-success" : row.percent >= 50 ? "text-bg-warning" : "text-bg-danger"}`}>{te(row.appreciation)}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody></table></div>
            </>
          )}
        </div></div>
        </>
      )}

      {!loading && tab === "attendance" && (
        <div className="row g-3">
          <div className="col-12 col-xl-5"><div className="card border-0 shadow-sm h-100"><div className="card-body">
            <SectionTitle>{t("ملخص الحضور")}</SectionTitle>
            <div className="dossier-count-grid">{Object.entries(summary.attendance.counts).map(([key, value]) => <div key={key}><strong>{value}</strong><span>{te(ATTENDANCE_LABELS[key] || key)}</span></div>)}</div>
            <div className="follow-help mt-3">{summary.attendance.recorded} {t("يومًا مسجلًا")} • {t("نسبة الحضور")} {fmt(summary.attendance.attendance_rate, "٪")}</div>
          </div></div></div>
          <div className="col-12 col-xl-7"><div className="card border-0 shadow-sm"><div className="card-body">
            <SectionTitle>{t("أحدث سجلات الحضور والمتابعة")}</SectionTitle>
            {dossier.attendance_records.length === 0 && dossier.follow_up_records.length === 0 ? <p className="text-secondary mb-0">{t("لا سجلات حضور أو متابعة في هذه الفترة.")}</p> : <>
              {dossier.attendance_records.slice(0, 10).map((row) => <div className="dossier-timeline-row" key={`a-${row.id}`}><span className={`badge ${toneBadge(row.status === "absent" ? "danger" : row.status === "present" ? "success" : "warning")}`}>{te(row.status_label)}</span><div><strong>{row.date}</strong><small>{row.note || t("حالة حضور مسجلة")}</small></div></div>)}
              {dossier.follow_up_records.slice(0, 10).map((row) => <div className="dossier-timeline-row" key={`f-${row.id}`}><span className="badge text-bg-info">{te(row.category_label)}</span><div><strong>{row.date} • {fmt(row.score, "/5")}</strong><small>{row.note || row.status || "—"}</small></div></div>)}
            </>}
          </div></div></div>
        </div>
      )}

      {!loading && tab === "assignments" && (
        <div className="card border-0 shadow-sm"><div className="card-body">
          <SectionTitle action={<button className="btn btn-sm btn-primary rounded-pill" onClick={() => navigate("/assignments")}>{t("فتح مركز المهام")}</button>}>{t("مهام الفوج وحالة التلميذ")}</SectionTitle>
          {dossier.assignments.length === 0 ? <p className="text-secondary mb-0">{t("لا مهام مرتبطة بفوج هذا التلميذ بعد.")}</p> : <div className="table-responsive"><table className="table align-middle mb-0 dossier-table"><thead><tr><th>{t("المهمة")}</th><th>{t("الأجل")}</th><th>{t("حالة التسليم")}</th><th>{t("النقطة")}</th><th>{t("ملاحظة الأستاذ")}</th></tr></thead><tbody>{dossier.assignments.map((row) => <tr key={row.id}><td><strong>{row.title}</strong><div className="small text-secondary">{row.course_title || te(row.type_label)}</div></td><td>{row.due_date || "—"}{row.is_overdue && <span className="badge text-bg-danger ms-2">{t("فات الأجل")}</span>}</td><td><span className={`badge ${toneBadge(row.submission_status === "not_submitted" ? "danger" : row.submission_status === "late" ? "warning" : "success")}`}>{te(row.submission_status_label)}</span></td><td>{row.score == null ? "—" : `${row.score}/${row.max_score}`}</td><td>{row.feedback || "—"}</td></tr>)}</tbody></table></div>}
        </div></div>
      )}

      {!loading && tab === "support" && (
        <div className="row g-3">
          <div className="col-12 col-xl-7">
            <SectionTitle>{t("خطط الدعم")}</SectionTitle>
            {dossier.support_plans.length === 0 ? <EmptyState title={t("لا خطط دعم لهذا التلميذ")} hint={t("يمكن إنشاء خطة من مركز الدعم أو من المهام غير المسلّمة.")} /> : dossier.support_plans.map((plan) => (
              <div className="card border-0 shadow-sm mb-3 support-card" key={plan.id}><div className="card-body">
                <div className="d-flex flex-wrap gap-2 align-items-center mb-2"><h6 className="fw-bold mb-0 flex-grow-1">{plan.title}</h6><span className="badge text-bg-light border">{te(plan.status_label)}</span><span className="badge text-bg-primary">{plan.progress_percent}٪</span></div>
                <p className="text-secondary small">{plan.reason || "—"}</p>
                <div className="progress support-progress"><div className="progress-bar" style={{ width: `${plan.progress_percent}%` }} /></div>
                <div className="support-actions-list mt-3">{(plan.actions || []).map((action, i) => <label key={i} className={action.done ? "done" : ""}>• {action.text}</label>)}</div>
              </div></div>
            ))}
          </div>
          <div className="col-12 col-xl-5">
            <SectionTitle>{t("تواصل الأولياء")}</SectionTitle>
            <div className="card border-0 shadow-sm"><div className="card-body">
              {dossier.communications.length === 0 ? <p className="text-secondary mb-0">{t("لا سجلات تواصل بعد.")}</p> : dossier.communications.map((row) => <div className="dossier-timeline-row" key={row.id}><span className="badge text-bg-info">{te(row.channel_label)}</span><div><strong>{row.subject}</strong><small>{row.date} • {row.outcome || row.summary || "—"}</small></div></div>)}
              <button className="btn btn-outline-primary btn-sm rounded-pill mt-2" onClick={() => navigate("/support")}>{t("فتح مركز الدعم والتواصل")}</button>
            </div></div>
          </div>
        </div>
      )}

      {!loading && tab === "timeline" && (
        <div className="card border-0 shadow-sm"><div className="card-body">
          <SectionTitle>{t("الخط الزمني الموحد لملف التلميذ")}</SectionTitle>
          {dossier.timeline.length === 0 ? <p className="text-secondary mb-0">{t("لا أحداث مسجلة بعد.")}</p> : <div className="dossier-timeline">{dossier.timeline.map((event) => <div className="dossier-timeline-row large" key={event.id}><span className={`badge ${toneBadge(event.tone)}`}>{te(event.type_label)}</span><div><strong>{event.title}</strong><small>{event.date || "—"} • {event.detail}</small></div></div>)}</div>}
        </div></div>
      )}
    </>
  );
}
