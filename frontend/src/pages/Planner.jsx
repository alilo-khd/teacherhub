import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function PlannerPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [anchor, setAnchor] = useState(() => toISO(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api(`/planner/week/?date=${anchor}`)); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [anchor, toast]);
  useEffect(() => { load(); }, [load]);

  const shift = (days) => {
    const d = new Date(`${anchor}T12:00:00`);
    d.setDate(d.getDate() + days);
    setAnchor(toISO(d));
  };

  const logSession = async (day, entry) => {
    const key = `${day.date}-${entry.slot_id}`;
    setBusyKey(key);
    try {
      await api("/sessions/", { method: "POST", body: { school_class: entry.class_id, course: entry.next_course?.id || null, date: day.date, status: "done", start_time: entry.start_time || undefined } });
      toast(t("سُجّلت الحصة وانتقل الفوج إلى الدرس الموالي"));
      await load();
    } catch (error) { toast(error.message, "danger"); }
    setBusyKey("");
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const doc = await api("/planner/week/generate-document/", { method: "POST", body: { date: anchor } });
      toast(t("وُلّد مخطط الأسبوع"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setGenerating(false);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز التخطيط الأسبوعي")}</h3>
          <p className="text-secondary mb-0">{t("أسبوعكم بنظرة واحدة: حصص جدول التوقيت، الدرس الجاري لكل فوج، الحصص التي تحتاج تسجيلًا — وسجّلوا أي حصة بضغطة واحدة ليتقدم المقرر تلقائيًا.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill" disabled={generating || !data} onClick={generate}>
          {generating ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={16} /> {t("توليد مخطط الأسبوع")}</>}
        </button>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <button className="btn btn-light rounded-pill" onClick={() => shift(-7)}>← {t("الأسبوع السابق")}</button>
        <button className="btn btn-light rounded-pill" onClick={() => setAnchor(toISO(new Date()))}>{t("هذا الأسبوع")}</button>
        <button className="btn btn-light rounded-pill" onClick={() => shift(7)}>{t("الأسبوع الموالي")} →</button>
        <input type="date" className="form-control w-auto" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
        {data && <span className="fw-semibold">{data.week_start} ← {data.week_end}</span>}
      </div>

      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="row g-3 mb-4">
            {[[data.summary.slots, "حصة في جدول التوقيت"], [data.summary.logged, "حصة مسجلة هذا الأسبوع"], [data.summary.needs_log, "حصة تنتظر التسجيل"], [data.summary.sessions_this_week, "حصة منفذة هذا الأسبوع"]].map(([value, label]) => (
              <div className="col-6 col-xl-3" key={label}><div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>
            ))}
          </div>

          <div className="row g-3">
            {data.days.map((day) => (
              <div className="col-12 col-md-6 col-xl" key={day.date}>
                <div className={`card border-0 shadow-sm h-100 planner-day ${day.is_today ? "today" : ""}`}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <h6 className="fw-bold mb-0">{te(day.weekday_name)}</h6>
                      {day.is_today && <span className="badge text-bg-primary">{t("اليوم")}</span>}
                    </div>
                    <div className="small text-secondary mb-2">{day.date}</div>
                    {day.holiday && <div className="badge text-bg-warning mb-2">{day.holiday}</div>}
                    {!day.entries.length && !day.holiday && <p className="small text-secondary mb-0">{t("لا حصص مجدولة")}</p>}
                    {day.entries.map((entry) => (
                      <div key={entry.slot_id} className="planner-entry">
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                          <span className="badge text-bg-light border">{entry.start_time || ""}</span>
                          <span className="fw-semibold small">{entry.class_name}</span>
                        </div>
                        <div className="small text-secondary">{entry.room}</div>
                        {entry.session ? (
                          <div className="mt-1">
                            <span className="badge text-bg-success">{t("مسجلة")}</span>
                            <span className="small fw-semibold"> {entry.session.course_title || "—"}</span>
                            <span className="badge text-bg-light border ms-1">{te(entry.session.status_label)}</span>
                          </div>
                        ) : (
                          <div className="mt-1">
                            <div className="small">{t("الدرس الموالي")}: <span className="fw-semibold">{entry.next_course?.title || "—"}</span></div>
                            {entry.needs_log && <span className="badge text-bg-danger">{t("تنتظر التسجيل")}</span>}
                            {entry.next_course && (
                              <button className="btn btn-sm btn-primary rounded-pill mt-2" disabled={busyKey === `${day.date}-${entry.slot_id}`} onClick={() => logSession(day, entry)}>
                                {busyKey === `${day.date}-${entry.slot_id}` ? <span className="spinner-border spinner-border-sm" /> : t("تسجيل كحصة منفذة")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
