import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf } from "../api";
import { Spinner, EmptyState } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const ATTENDANCE = [
  ["present", "حاضر", "✓", "success"],
  ["absent", "غائب", "غ", "danger"],
  ["late", "متأخر", "ت", "warning"],
  ["excused", "غياب مبرر", "م", "info"],
  ["left_early", "غادر مبكرًا", "خ", "secondary"],
];
const CATEGORIES = [
  ["homework", "الواجب المنزلي"],
  ["behaviour", "السلوك والانضباط"],
  ["participation", "المشاركة"],
  ["support", "الدعم والملاحظات"],
];
const FOLLOW_STATUSES = {
  homework: ["أنجز", "جزئي", "لم ينجز", "غير مطلوب"],
  behaviour: ["ممتاز", "جيد", "يحتاج تنبيه", "يحتاج تدخل"],
  participation: ["فعال", "جيد", "محدود", "لم يشارك"],
  support: ["تم الدعم", "قيد المتابعة", "يحتاج تدخل", "ملاحظة فقط"],
};
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const monthRange = (date) => {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
};

export default function FollowUpPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [clsId, setClsId] = useState("");
  const [date, setDate] = useState(localToday());
  const [tab, setTab] = useState("attendance");
  const [day, setDay] = useState(null);
  const [attendanceEdits, setAttendanceEdits] = useState({});
  const [followCategory, setFollowCategory] = useState("homework");
  const [followCourse, setFollowCourse] = useState("");
  const [followEdits, setFollowEdits] = useState({});
  const [range, setRange] = useState(() => monthRange(localToday()));
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [followSummary, setFollowSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cls = classes.find((c) => String(c.id) === String(clsId));
  const students = day?.students || [];

  useEffect(() => {
    Promise.all([api("/classes/").then(listOf), api("/courses/").then(listOf)])
      .then(([cl, co]) => { setClasses(cl); setCourses(co); if (cl[0]) setClsId(String(cl[0].id)); })
      .catch((e) => toast(e.message, "danger"));
  }, []); // eslint-disable-line

  const loadDay = useCallback(async () => {
    if (!clsId || !date) return;
    setLoading(true);
    try {
      const data = await api(`/attendance/day/?class=${clsId}&date=${date}`);
      setDay(data);
      const edits = {};
      data.students.forEach((s) => {
        edits[s.id] = s.attendance ? { status: s.attendance.status, note: s.attendance.note || "" } : { status: "present", note: "" };
      });
      setAttendanceEdits(edits);

      const params = new URLSearchParams({ class: clsId, date, category: followCategory });
      if (followCourse) params.set("course", followCourse);
      const records = listOf(await api(`/follow-ups/?${params.toString()}`));
      const byStudent = Object.fromEntries(records.map((r) => [r.student, r]));
      const fEdits = {};
      data.students.forEach((s) => {
        const r = byStudent[s.id];
        fEdits[s.id] = r ? { score: r.score ?? "", status: r.status || "", note: r.note || "" } : { score: "", status: "", note: "" };
      });
      setFollowEdits(fEdits);
    } catch (e) { toast(e.message, "danger"); }
    setLoading(false);
  }, [clsId, date, followCategory, followCourse, toast]);

  useEffect(() => { loadDay(); }, [loadDay]);

  const loadSummary = useCallback(async () => {
    if (!clsId) return;
    setLoading(true);
    try {
      const [a, f] = await Promise.all([
        api(`/attendance/summary/?class=${clsId}&from=${range.from}&to=${range.to}`),
        api(`/follow-ups/summary/?class=${clsId}&from=${range.from}&to=${range.to}`),
      ]);
      setAttendanceSummary(a); setFollowSummary(f);
    } catch (e) { toast(e.message, "danger"); }
    setLoading(false);
  }, [clsId, range, toast]);

  useEffect(() => { if (tab === "summary") loadSummary(); }, [tab, loadSummary]);

  const setAttendance = (id, patch) => setAttendanceEdits((x) => ({ ...x, [id]: { ...(x[id] || {}), ...patch } }));
  const setFollow = (id, patch) => setFollowEdits((x) => ({ ...x, [id]: { ...(x[id] || {}), ...patch } }));
  const markAll = (status) => {
    const edits = {};
    students.forEach((s) => { edits[s.id] = { ...(attendanceEdits[s.id] || {}), status }; });
    setAttendanceEdits(edits);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const data = await api("/attendance/mark-bulk/", { method: "POST", body: {
        class_id: Number(clsId), date,
        records: students.map((s) => ({ student_id: s.id, ...(attendanceEdits[s.id] || { status: "present", note: "" }) })),
      }});
      setDay(data); toast(`${t("حُفظ حضور")} ${data.saved} ${t("تلميذًا")}`);
    } catch (e) { toast(e.message, "danger"); }
    setSaving(false);
  };

  const saveFollow = async () => {
    setSaving(true);
    try {
      const r = await api("/follow-ups/bulk-save/", { method: "POST", body: {
        class_id: Number(clsId), date, category: followCategory, course_id: followCourse ? Number(followCourse) : null,
        records: students.map((s) => ({ student_id: s.id, ...(followEdits[s.id] || {}) })),
      }});
      toast(`${t("حُفظت")} ${r.saved} ${t("سجلات متابعة")}`); await loadDay();
    } catch (e) { toast(e.message, "danger"); }
    setSaving(false);
  };

  const generateRegister = async () => {
    setSaving(true);
    try {
      const doc = await api("/attendance/generate-register/", { method: "POST", body: { class_id: Number(clsId), month: date.slice(0, 7) } });
      toast(t("وُلّد سجل الحضور الفعلي")); navigate(`/editor/${doc.id}`);
    } catch (e) { toast(e.message, "danger"); }
    setSaving(false);
  };

  const generateFollowDoc = async () => {
    setSaving(true);
    try {
      const doc = await api("/follow-ups/generate-document/", { method: "POST", body: { class_id: Number(clsId), from: range.from, to: range.to } });
      toast(t("وُلّد تقرير المتابعة الفعلي")); navigate(`/editor/${doc.id}`);
    } catch (e) { toast(e.message, "danger"); }
    setSaving(false);
  };

  const attendanceCounts = useMemo(() => {
    const counts = Object.fromEntries(ATTENDANCE.map(([k]) => [k, 0]));
    students.forEach((s) => { const k = attendanceEdits[s.id]?.status || "present"; counts[k] = (counts[k] || 0) + 1; });
    return counts;
  }, [students, attendanceEdits]);

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز الحضور ومتابعة التلاميذ")}</h3>
          <p className="text-secondary mb-0">{t("سجّل الحضور والغياب والواجبات والسلوك والمشاركة يوميًا، ثم حوّل البيانات الفعلية إلى سجلات وتقارير قابلة للتحرير والطباعة.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-light rounded-pill" onClick={() => navigate("/support")}>{t("الدعم وتواصل الأولياء")}</button>
          <button className="btn btn-light rounded-pill" onClick={() => navigate("/assignments")}>{t("المهام والواجبات")}</button>
          <button className="btn btn-outline-primary rounded-pill" disabled={!clsId || saving} onClick={generateRegister}>{t("سجل حضور الشهر")}</button>
          <button className="btn btn-primary rounded-pill" disabled={!clsId || saving} onClick={generateFollowDoc}>{t("تقرير متابعة الفترة")}</button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label small fw-semibold">{t("الفوج")}</label>
              <div className="d-flex flex-wrap gap-2">
                {classes.map((c) => <button key={c.id} className={`btn btn-sm rounded-pill ${String(c.id) === clsId ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setClsId(String(c.id))}>{c.name}</button>)}
              </div>
            </div>
            <div>
              <label className="form-label small fw-semibold">{t("تاريخ اليوم الدراسي")}</label>
              <input type="date" className="form-control" value={date} onChange={(e) => { setDate(e.target.value); setRange(monthRange(e.target.value)); }} />
            </div>
            <div className="ms-auto d-flex gap-2">
              <button className={`btn btn-sm rounded-pill ${tab === "attendance" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("attendance")}>{t("الحضور اليومي")}</button>
              <button className={`btn btn-sm rounded-pill ${tab === "followup" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("followup")}>{t("الواجب والسلوك والمشاركة")}</button>
              <button className={`btn btn-sm rounded-pill ${tab === "summary" ? "btn-primary" : "btn-light"}`} onClick={() => setTab("summary")}>{t("الملخص والمخاطر")}</button>
            </div>
          </div>
        </div>
      </div>

      {loading && !day ? <Spinner /> : !cls ? <EmptyState icon="" title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا وأضف تلاميذه أولًا من صفحة الأقسام والتلاميذ.")} /> : tab === "attendance" ? (
        <>
          <div className="row g-3 mb-3">
            {ATTENDANCE.map(([key, label]) => (
              <div className="col-6 col-md" key={key}><div className="stat-mini"><div className="stat-mini-num">{attendanceCounts[key] || 0}</div><div className="stat-mini-label">{te(label)}</div></div></div>
            ))}
            <div className="col-6 col-md"><div className="stat-mini"><div className="stat-mini-num">{day?.recorded || 0}/{day?.students_count || 0}</div><div className="stat-mini-label">{t("محفوظ فعليًا")}</div></div></div>
          </div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <span className="small fw-semibold align-self-center">{t("تحديد سريع للجميع:")}</span>
            {ATTENDANCE.map(([key, label]) => <button key={key} className="btn btn-sm btn-light rounded-pill" onClick={() => markAll(key)}>{te(label)}</button>)}
            <button className="btn btn-dark rounded-pill px-4 ms-auto" disabled={saving || !students.length} onClick={saveAttendance}>{saving ? <span className="spinner-border spinner-border-sm" /> : t("حفظ حضور اليوم")}</button>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table align-middle mb-0 follow-table">
                <thead><tr><th>#</th><th>{t("التلميذ")}</th><th>{t("حالة الحضور")}</th><th>{t("ملاحظة")}</th><th>{t("تراكمي")}</th></tr></thead>
                <tbody>
                  {students.map((s, i) => {
                    const v = attendanceEdits[s.id] || { status: "present", note: "" };
                    return <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td><b>{s.full_name}</b><div className="small text-secondary">{cls.level}</div></td>
                      <td><div className="status-picker">
                        {ATTENDANCE.map(([key, label, symbol, color]) => <button key={key} type="button" title={te(label)}
                          className={`btn btn-sm ${v.status === key ? `btn-${color}` : "btn-outline-secondary"}`} onClick={() => setAttendance(s.id, { status: key })}>{symbol} {te(label)}</button>)}
                      </div></td>
                      <td><input className="form-control form-control-sm" value={v.note || ""} placeholder={t("سبب الغياب أو ملاحظة…")} onChange={(e) => setAttendance(s.id, { note: e.target.value })} /></td>
                      <td><span className="badge rounded-pill text-bg-light border">{t("غ")} {s.totals?.absent || 0} • {t("ت")} {s.totals?.late || 0}</span></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            {students.length === 0 && <div className="p-4"><EmptyState icon="" title={t("لا تلاميذ في هذا الفوج")} hint={t("أضف قائمة التلاميذ من صفحة التلاميذ والنقاط.")} /></div>}
          </div>
        </>
      ) : tab === "followup" ? (
        <>
          <div className="card border-0 shadow-sm mb-3"><div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-3"><label className="form-label small fw-semibold">{t("صنف المتابعة")}</label><select className="form-select" value={followCategory} onChange={(e) => setFollowCategory(e.target.value)}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{te(l)}</option>)}</select></div>
              <div className="col-12 col-md-4"><label className="form-label small fw-semibold">{t("الدرس المرتبط (اختياري)")}</label><select className="form-select" value={followCourse} onChange={(e) => setFollowCourse(e.target.value)}><option value="">{t("بدون درس محدد")}</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}</select></div>
              <div className="col-12 col-md-5"><div className="follow-help">{t("امنح نقطة من 5، اختر حالة مختصرة، واكتب ملاحظة عند الحاجة. اترك النقطة فارغة إذا لم تُقيّم التلميذ اليوم.")}</div></div>
            </div>
          </div></div>
          <div className="d-flex justify-content-end mb-3"><button className="btn btn-dark rounded-pill px-4" disabled={saving || !students.length} onClick={saveFollow}>{saving ? <span className="spinner-border spinner-border-sm" /> : t("حفظ متابعة اليوم")}</button></div>
          <div className="card border-0 shadow-sm"><div className="table-responsive">
            <table className="table align-middle mb-0 follow-table">
              <thead><tr><th>#</th><th>{t("التلميذ")}</th><th>{t("النقطة /5")}</th><th>{t("الحالة")}</th><th>{t("ملاحظة المتابعة")}</th></tr></thead>
              <tbody>{students.map((s, i) => {
                const v = followEdits[s.id] || { score: "", status: "", note: "" };
                return <tr key={s.id}><td>{i + 1}</td><td className="fw-semibold">{s.full_name}</td>
                  <td><div className="score-picker"><button type="button" className={`btn btn-sm ${v.score === "" ? "btn-dark" : "btn-light"}`} onClick={() => setFollow(s.id, { score: "" })}>—</button>{[0, 1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={`btn btn-sm ${Number(v.score) === n && v.score !== "" ? "btn-primary" : "btn-light"}`} onClick={() => setFollow(s.id, { score: n })}>{n}</button>)}</div></td>
                  <td><select className="form-select form-select-sm" value={v.status || ""} onChange={(e) => setFollow(s.id, { status: e.target.value })}><option value="">{t("بدون حالة")}</option>{(FOLLOW_STATUSES[followCategory] || []).map((x) => <option key={x} value={x}>{te(x)}</option>)}</select></td>
                  <td><input className="form-control form-control-sm" value={v.note || ""} placeholder={t("ما الذي يحتاج متابعة؟")} onChange={(e) => setFollow(s.id, { note: e.target.value })} /></td></tr>;
              })}</tbody>
            </table>
          </div></div>
        </>
      ) : (
        <>
          <div className="card border-0 shadow-sm mb-3"><div className="card-body d-flex flex-wrap gap-2 align-items-end">
            <div><label className="form-label small fw-semibold">{t("من تاريخ")}</label><input type="date" className="form-control" value={range.from} onChange={(e) => setRange((x) => ({ ...x, from: e.target.value }))} /></div>
            <div><label className="form-label small fw-semibold">{t("إلى تاريخ")}</label><input type="date" className="form-control" value={range.to} onChange={(e) => setRange((x) => ({ ...x, to: e.target.value }))} /></div>
            <button className="btn btn-dark rounded-pill" onClick={loadSummary}>{t("تحديث الملخص")}</button>
            <span className="text-secondary small">{t("يُعلَّم التلميذ للمتابعة إذا بلغت غياباته 3 أو نقصت نسبة حضوره عن 80٪، أو كان متوسط واجبه/سلوكه/مشاركته أقل من 2.5/5.")}</span>
          </div></div>
          <div className="row g-3">
            <div className="col-12 col-xl-6"><div className="card border-0 shadow-sm h-100"><div className="card-body">
              <h6 className="fw-bold">{t("ملخص الحضور")} {attendanceSummary ? `• ${attendanceSummary.recorded_days} ${t("أيام مسجلة")}` : ""}</h6>
              <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>{t("التلميذ")}</th><th>{t("الحضور")}</th><th>{t("غائب")}</th><th>{t("متأخر")}</th><th>{t("تنبيه")}</th></tr></thead><tbody>
                {(attendanceSummary?.students || []).map((x) => <tr key={x.student_id}><td className="fw-semibold">{x.student_name}</td><td>{x.attendance_rate == null ? "—" : `${x.attendance_rate}٪`}</td><td>{x.counts.absent}</td><td>{x.counts.late}</td><td>{x.needs_follow_up ? <span className="badge text-bg-danger">{t("يحتاج متابعة")}</span> : <span className="badge text-bg-success">{t("منتظم")}</span>}</td></tr>)}
              </tbody></table></div>
            </div></div></div>
            <div className="col-12 col-xl-6"><div className="card border-0 shadow-sm h-100"><div className="card-body">
              <h6 className="fw-bold">{t("ملخص الواجبات والسلوك والمشاركة")} {followSummary ? `• ${followSummary.total_records} ${t("سجلًا")}` : ""}</h6>
              <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>{t("التلميذ")}</th><th>{t("الواجب")}</th><th>{t("السلوك")}</th><th>{t("المشاركة")}</th><th>{t("تنبيه")}</th></tr></thead><tbody>
                {(followSummary?.students || []).map((x) => <tr key={x.student_id}><td className="fw-semibold">{x.student_name}</td><td>{x.by_category.homework.average ?? "—"}</td><td>{x.by_category.behaviour.average ?? "—"}</td><td>{x.by_category.participation.average ?? "—"}</td><td>{x.needs_support ? <span className="badge text-bg-warning">{x.support_reasons.map((r) => te(r)).join("، ")}</span> : <span className="badge text-bg-success">{t("جيد")}</span>}</td></tr>)}
              </tbody></table></div>
            </div></div></div>
          </div>
        </>
      )}
    </>
  );
}
