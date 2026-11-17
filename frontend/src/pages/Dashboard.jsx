import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/States";
import ThemeCard from "../components/ThemeCard";
import Icon from "../components/Icon";
import { useLang } from "../i18n";

const STATS = [
  { key: "sessions", label: "حصة منفَّذة", icon: "calendar", to: "/sessions", cls: "stat-b" },
  { key: "classes", label: "الأقسام", icon: "chart", to: "/classes", cls: "stat-c" },
  { key: "students", label: "تلميذ", icon: "users", to: "/students", cls: "stat-a" },
  { key: "courses", label: "دروس المقرر", icon: "book", to: "/courses", cls: "stat-a" },
  { key: "lesson_plans", label: "خطط الدروس", icon: "layers", to: "/lesson-plans", cls: "stat-d" },
  { key: "institutions", label: "مؤسسة للمتابعة", icon: "school", to: "/inspection", cls: "stat-c" },
  { key: "visits", label: "زيارة تفتيشية", icon: "search", to: "/inspection", cls: "stat-b" },
  { key: "themes", label: "سمة جاهزة للطباعة", icon: "palette", to: "/print", cls: "stat-d" },
];

export default function Dashboard() {
  const { t, te } = useLang();
  const [dash, setDash] = useState(null);
  const [today, setToday] = useState(null);
  const [align, setAlign] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/dashboard/"), api("/studio/today/"), api("/studio/alignment/")])
      .then(([d, t, a]) => { setDash(d); setToday(t); setAlign(a); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!dash || !today || !align) return <Spinner label={t("جارٍ تحضير استوديو التدريس…")} />;

  return (
    <>
      <div className="studio-hero d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div style={{ maxWidth: 640 }}>
          <h3 className="fw-bold mb-2">{t("استوديو التدريس")}</h3>
          <p className="mb-0">
            {te(today.weekday_name)} {today.date} — {t("درّس، سجّل الحصة، ودَع المنصة تزامن خططك وتقدّم أقسامك.")}
          </p>
        </div>
        <Link to="/sessions" className="btn btn-primary rounded-pill px-4">{t("سجّل حصة الآن")}</Link>
      </div>

      <div className="row g-3 mb-4">
        {STATS.map((s) => (
          <div className="col-6 col-md-4 col-xl-3" key={s.key}>
            <Link to={s.to} className={`stat-card ${s.cls}`}>
              <span className="stat-icon"><Icon name={s.icon} size={21} /></span>
              <span className="stat-num">{dash.counts[s.key]}</span>
              <span className="stat-label">{t(s.label)}</span>
            </Link>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <h5 className="fw-bold mb-3"> {t("حصص اليوم")} ({te(today.weekday_name)})</h5>
          {today.schedule.length === 0 ? (
            <div className="empty-state text-center py-4 mb-4">
              <div className="empty-icon"></div>
              <div className="fw-bold">{t("لا حصص مجدولة اليوم في استعمال الزمن")}</div>
              <div className="text-secondary small">{t("أضف مواعيد أقسامك الأسبوعية من صفحة الأقسام لتظهر هنا.")}</div>
            </div>
          ) : (
            <div className="row g-3 mb-4">
              {today.schedule.map((s, i) => (
                <div className="col-12 col-md-6" key={i}>
                  <div className="card border-0 shadow-sm h-100 mini-card">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <h6 className="fw-bold mb-1"> {s.class_name}</h6>
                        <span className="badge rounded-pill text-bg-light border">
                          {String(s.slot.start_time).slice(0, 5)} • {s.slot.room}
                        </span>
                      </div>
                      <p className="text-secondary small mb-2">
                        {t("الدرس التالي المقترح:")} <b className="text-dark">{s.next_course?.title || t("أُنهي المقرر —")}</b>
                      </p>
                      <div className="progress mb-2" style={{ height: 8 }}>
                        <div className="progress-bar bg-success" style={{ width: `${s.progress.percent}%` }} />
                      </div>
                      {s.logged ? (
                        <span className="badge rounded-pill text-bg-success">✓ {t("سُجّلت حصة اليوم لهذا الفوج")}</span>
                      ) : (
                        <Link to={`/sessions?cls=${s.slot.school_class}`} className="btn btn-sm btn-primary rounded-pill">
                          سجّل حصة اليوم
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h5 className="fw-bold mb-3"> {t("محاذاة الأقسام مع المقرر")}</h5>
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              {align.matrix.map((m) => (
                <div key={m.class.id} className="align-row">
                  <div className="d-flex justify-content-between">
                    <span className="fw-bold"> {m.class.name}</span>
                    <span className="small text-secondary">
                      {m.progress.done_count}/{m.progress.total_courses} {t("دروس • التالي:")} {m.progress.next_course?.title || "—"}
                    </span>
                  </div>
                  <div className="progress" style={{ height: 10 }}>
                    <div className="progress-bar" style={{ width: `${m.progress.percent}%` }} />
                  </div>
                </div>
              ))}
              {align.insights.map((ins, i) => (
                <div key={i} className="insight"> {ins.text}</div>
              ))}
              <Link to="/classes" className="btn btn-sm btn-outline-primary rounded-pill mt-2">{t("مصفوفة التقدّم الكاملة")}</Link>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <h5 className="fw-bold mb-3"> {t("الدرس التالي لكل فوج")}</h5>
          {today.suggestions.map((s) => (
            <div className="card border-0 shadow-sm mb-3 next-card" key={s.class_id}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <h6 className="fw-bold mb-1">{s.class_name}</h6>
                  <span className="badge rounded-pill text-bg-light border">{s.percent}% {t("من المقرر")}</span>
                </div>
                <div className="next-course">{s.next_course.title}</div>
                <div className="d-flex flex-wrap gap-1 my-2">
                  {s.key_points.slice(0, 4).map((p, i) => (
                    <span key={i} className="point-chip">{p}</span>
                  ))}
                </div>
                <div className="d-flex gap-2">
                  <Link to={`/sessions?cls=${s.class_id}`} className="btn btn-sm btn-primary rounded-pill flex-grow-1">
                    سجّل هذه الحصة
                  </Link>
                  {s.has_plan && (
                    <Link to={`/preview/lesson-plan/${s.plan_id}`} className="btn btn-sm btn-outline-secondary rounded-pill">
                      خطة الدرس
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Link to="/print" className="card border-0 shadow-sm mb-3 print-cta text-decoration-none">
            <div className="card-body d-flex align-items-center gap-3">
              <span className="print-cta-icon"><Icon name="printer" size={26} /></span>
              <div>
                <div className="fw-bold text-dark">{t("مركز الطباعة PDF")}</div>
                <div className="small text-secondary">{t("الدفتر اليومي، دفتر المفتش، دفتر التنقيط، خطط ومذكرات — كلها جاهزة للتنزيل والطباعة")}</div>
              </div>
            </div>
          </Link>

          <h5 className="fw-bold mb-3 mt-4">{t("سمة مميزة")}</h5>
          {dash.spotlight_theme && (
            <ThemeCard theme={dash.spotlight_theme}
              footer={<Link to="/themes" className="btn btn-sm btn-primary rounded-pill w-100">{t("جرّبها على دفاترك")}</Link>} />
          )}
        </div>
      </div>
    </>
  );
}
