import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf, parentMeetingApi } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const AUDIENCES = [["at_risk", "المحتاجون أولًا (نقاط/غياب/دعم)"], ["watch", "المجتهدون على الحافة (10–12)"],
                   ["honours", "المتفوقون (≥14)"], ["all", "كل تلاميذ الفوج"]];
const STATUS_BUTTONS = [["scheduled", "مجدول", "btn-outline-secondary"], ["attended", "حضر", "btn-outline-success"],
                        ["no_show", "لم يحضر", "btn-outline-danger"], ["cancelled", "ملغي", "btn-outline-dark"]];

export default function ParentMeetingsPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [days, setDays] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dayId, setDayId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ school_class: "", date: "", start_time: "13:00", slot_minutes: 10, location: "", title: "يوم لقاء الأولياء" });
  const [audience, setAudience] = useState("at_risk");
  const [term, setTerm] = useState(1);
  const [outcomes, setOutcomes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dayData, classData] = await Promise.all([parentMeetingApi.list(), api("/classes/")]);
      const dayList = listOf(dayData);
      setDays(dayList);
      setClasses(listOf(classData));
      if (dayList.length && !dayList.some((d) => d.id === dayId)) setDayId(dayList[0].id);
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const day = days.find((d) => d.id === dayId) || null;

  const createDay = async () => {
    if (!form.school_class || !form.date) { toast(t("اختر الفوج والتاريخ أولًا"), "danger"); return; }
    setBusy("create");
    try {
      const created = await parentMeetingApi.create({ ...form, slot_minutes: Number(form.slot_minutes) || 10 });
      setDays((xs) => [created, ...xs]);
      setDayId(created.id);
      setShowForm(false);
      toast(t("أُنشئ يوم اللقاء — ابنِ جدول المواعيد الآن"));
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const build = async () => {
    setBusy("build");
    try {
      const res = await parentMeetingApi.buildSchedule(day.id, { audience, term });
      toast(`${t("بُني جدول المواعيد:")} ${res.created} ${t("موعدًا")}`);
      load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const setStatus = async (appointment, status, outcome) => {
    try {
      const updated = await parentMeetingApi.setStatus(day.id, appointment.id, { status, outcome: outcome ?? appointment.outcome ?? "" });
      setDays((xs) => xs.map((d) => d.id === day.id
        ? { ...d, appointments: d.appointments.map((a) => (a.id === updated.id ? updated : a)),
            stats: { ...d.stats,
              attended: d.appointments.filter((a) => (a.id === updated.id ? updated : a).status === "attended").length,
              no_show: d.appointments.filter((a) => (a.id === updated.id ? updated : a).status === "no_show").length,
              scheduled: d.appointments.filter((a) => (a.id === updated.id ? updated : a).status === "scheduled").length,
              total: d.appointments.length } }
        : d));
      if (status === "attended" && updated.communication) toast(t("سُجّل اللقاء في تواصل الأولياء"));
    } catch (error) { toast(error.message, "danger"); }
  };

  const generate = async (kind) => {
    setBusy(kind);
    try {
      const doc = kind === "invites" ? await parentMeetingApi.generateInvitations(day.id) : await parentMeetingApi.generateAgenda(day.id);
      toast(kind === "invites" ? t("وُلّدت دعوات اللقاء") : t("وُلّد جدول اليوم"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const removeDay = async () => {
    if (!window.confirm(t("حذف يوم اللقاء وكل مواعيده؟"))) return;
    try {
      await parentMeetingApi.remove(day.id);
      setDays((xs) => xs.filter((d) => d.id !== day.id));
      setDayId(null);
      toast(t("حُذف يوم اللقاء"));
    } catch (error) { toast(error.message, "danger"); }
  };

  if (loading && !days.length) return <Spinner />;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز يوم لقاء الأولياء")}</h3>
          <p className="text-secondary mb-0">{t("نظّم يوم استقبال الأولياء: ابنِ جدول مواعيد تلقائيًا حسب الأولوية (المحتاجون أولًا)، اطبع الدعوات وجدول اليوم، وسجّل حضور كل ولي وخلاصة لقائه — تُحفظ الخلاصات تلقائيًا في سجل تواصل الأولياء.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setShowForm((v) => !v)}>+ {t("يوم لقاء جديد")}</button>
      </div>

      {showForm && (
        <div className="card border-0 shadow-sm mb-4"><div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold">{t("الفوج")}</label>
              <select className="form-select" value={form.school_class} onChange={(e) => setForm({ ...form, school_class: e.target.value })}>
                <option value="">{t("اختر فوجًا…")}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold">{t("التاريخ")}</label>
              <input type="date" className="form-control" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold">{t("ساعة البدء")}</label>
              <input type="time" className="form-control" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-bold">{t("مدة اللقاء (دقيقة)")}</label>
              <input type="number" min="5" max="60" className="form-control" value={form.slot_minutes} onChange={(e) => setForm({ ...form, slot_minutes: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-bold">{t("المكان")}</label>
              <input className="form-control" placeholder={t("قاعة الأساتذة")} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-primary rounded-pill px-4" disabled={busy === "create"} onClick={createDay}>
                {busy === "create" ? <span className="spinner-border spinner-border-sm" /> : t("إنشاء اليوم")}
              </button>
              <button className="btn btn-light rounded-pill px-4" onClick={() => setShowForm(false)}>{t("إلغاء")}</button>
            </div>
          </div>
        </div></div>
      )}

      {!days.length && !showForm && <EmptyState title={t("لا أيام لقاء بعد")} hint={t("أنشئ أول يوم لقاء أولياء واختر فوجه وتاريخه.")} />}

      {days.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-4">
          {days.map((d) => (
            <button key={d.id} type="button" onClick={() => setDayId(d.id)}
              className={`btn rounded-pill ${d.id === dayId ? "btn-dark" : "btn-outline-dark"}`}>
              {d.class_name} — {d.date} ({d.stats.total} {t("موعدًا")})
            </button>
          ))}
        </div>
      )}

      {day && (
        <div className="card border-0 shadow-sm mb-4"><div className="card-body">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <h5 className="fw-bold mb-0">{day.title} — {day.class_name}</h5>
              <div className="text-secondary small">{day.date} • {String(day.start_time).slice(0, 5)} • {day.location || t("قاعة الأساتذة")}</div>
            </div>
            <div className="d-flex flex-wrap gap-1">
              <span className="badge text-bg-light border">{day.stats.total} {t("موعدًا")}</span>
              <span className="badge text-bg-success">{day.stats.attended} {t("حضر")}</span>
              <span className="badge text-bg-danger">{day.stats.no_show} {t("لم يحضر")}</span>
              <span className="badge text-bg-secondary">{day.stats.scheduled} {t("مجدول")}</span>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-center mb-4">
            <select className="form-select form-select-sm exam-count-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="form-select form-select-sm exam-count-select" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
              {TERMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button className="btn btn-sm btn-primary rounded-pill" disabled={busy === "build"} onClick={build}>
              {busy === "build" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="calendar" size={15} /> {t("بناء جدول المواعيد")}</>}
            </button>
            <button className="btn btn-sm btn-outline-primary rounded-pill" disabled={busy === "invites"} onClick={() => generate("invites")}>{t("طباعة الدعوات")}</button>
            <button className="btn btn-sm btn-outline-primary rounded-pill" disabled={busy === "agenda"} onClick={() => generate("agenda")}>{t("جدول اليوم")}</button>
            <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={removeDay}>{t("حذف اليوم")}</button>
          </div>

          {!day.appointments.length
            ? <p className="text-secondary small mb-0">{t("لا مواعيد بعد — اختر الجمهور والثلاثي ثم ابنِ الجدول.")}</p>
            : (
              <div className="d-flex flex-column gap-2">
                {day.appointments.map((appointment) => (
                  <div key={appointment.id} className={`pm-row pm-${appointment.status}`}>
                    <div className="pm-time">{String(appointment.start_time).slice(0, 5)}<span>{String(appointment.end_time).slice(0, 5)}</span></div>
                    <div className="flex-grow-1">
                      <div className="fw-bold small">{appointment.student_name}</div>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {(appointment.topics || []).map((topic, i) => <span key={i} className="badge text-bg-light border fw-normal">{topic}</span>)}
                      </div>
                      <div className="d-flex gap-2 mt-2">
                        <input className="form-control form-control-sm" placeholder={t("خلاصة اللقاء (تُحفظ في تواصل الأولياء عند الحضور)…")}
                          value={outcomes[appointment.id] ?? appointment.outcome ?? ""}
                          onChange={(e) => setOutcomes({ ...outcomes, [appointment.id]: e.target.value })} />
                        <button className="btn btn-sm btn-light border text-nowrap"
                          onClick={() => setStatus(appointment, appointment.status, outcomes[appointment.id] ?? appointment.outcome ?? "")}>
                          {t("حفظ الخلاصة")}
                        </button>
                      </div>
                    </div>
                    <div className="btn-group btn-group-sm pm-status">
                      {STATUS_BUTTONS.map(([value, label, cls]) => (
                        <button key={value} type="button"
                          className={`btn ${appointment.status === value ? cls.replace("outline-", "") && (value === "attended" ? "btn-success" : value === "no_show" ? "btn-danger" : value === "cancelled" ? "btn-dark" : "btn-secondary") : cls}`}
                          onClick={() => setStatus(appointment, value)}>{t(label)}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div></div>
      )}
    </>
  );
}
