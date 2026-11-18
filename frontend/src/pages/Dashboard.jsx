import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const STATS = [
  { key: "classes", label: "الأقسام", icon: "school", to: "/classes" },
  { key: "courses", label: "دروس المقرر", icon: "book", to: "/courses" },
  { key: "lesson_plans", label: "خطط الدروس", icon: "layers", to: "/lesson-plans" },
  { key: "sessions", label: "حصص مسجلة", icon: "calendar", to: "/sessions" },
];

function SectionHeading({ eyebrow, title, action }) {
  const { t } = useLang();
  return (
    <div className="th-section-heading">
      <div>
        {eyebrow && <div className="th-section-eyebrow">{t(eyebrow)}</div>}
        <h2>{t(title)}</h2>
      </div>
      {action}
    </div>
  );
}

export default function Dashboard() {
  const { t, te } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    Promise.all([api("/dashboard/"), api("/studio/today/"), api("/studio/alignment/")])
      .then(([dashboard, today, alignment]) => {
        if (active) setData({ dashboard, today, alignment });
      })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [retry]);

  if (error) {
    return (
      <section className="th-state-panel" role="alert">
        <span className="th-state-icon"><Icon name="bell" size={23} /></span>
        <h1>{t("تعذّر تحميل مساحة التدريس")}</h1>
        <p>{error}</p>
        <button className="th-button th-button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>
          {t("إعادة المحاولة")}
        </button>
      </section>
    );
  }

  if (!data) {
    return (
      <div className="th-loading-state" role="status" aria-live="polite">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>{t("جارٍ تحضير مساحة التدريس…")}</span>
      </div>
    );
  }

  const { dashboard, today, alignment } = data;
  const schedule = today.schedule || [];
  const suggestions = today.suggestions || [];
  const matrix = alignment.matrix || [];

  return (
    <div className="th-home">
      <section className="th-welcome-panel">
        <div className="th-welcome-decoration" aria-hidden="true"><span /><span /></div>
        <div className="th-welcome-copy">
          <div className="th-welcome-meta">
            <span className="th-date-pill"><Icon name="calendar" size={16} /> {te(today.weekday_name)} · {today.date}</span>
            <span className="th-private-label"><span className="th-status-dot" />{t("مساحة الأستاذ")}</span>
          </div>
          <h1>{t("مساحة التدريس اليومية")}</h1>
          <p>{t("خطّط بهدوء، سجّل ما أُنجز، واعرف الخطوة التالية لكل فوج.")}</p>
        </div>
        <div className="th-welcome-actions">
          <Link to="/sessions" className="th-button th-button-primary">
            <Icon name="plus" size={18} /> {t("سجّل حصة")}
          </Link>
          <Link to="/planner" className="th-button th-button-glass">{t("افتح التخطيط الأسبوعي")}</Link>
        </div>
      </section>

      <section className="th-stats-grid" aria-label={t("ملخص مساحة التدريس")}>
        {STATS.map((item) => (
          <Link className="th-stat-card" to={item.to} key={item.key}>
            <span className="th-stat-icon"><Icon name={item.icon} size={19} /></span>
            <span className="th-stat-copy">
              <span className="th-stat-value">{dashboard.counts?.[item.key] ?? 0}</span>
              <span className="th-stat-label">{t(item.label)}</span>
            </span>
            <span className="th-stat-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
      </section>

      <div className="th-home-grid">
        <section className="th-panel th-agenda-panel">
          <SectionHeading
            eyebrow="إيقاع اليوم"
            title="حصص اليوم"
            action={<Link className="th-text-link" to="/planner">{t("عرض الجدول")} <span aria-hidden="true">←</span></Link>}
          />
          {schedule.length === 0 ? (
            <div className="th-empty-schedule">
              <span className="th-empty-icon"><Icon name="calendar" size={24} /></span>
              <div>
                <h3>{t("لا توجد حصة في جدول اليوم")}</h3>
                <p>{t("أضف مواعيد الأقسام الأسبوعية ليظهر برنامجك هنا.")}</p>
                <Link to="/classes" className="th-inline-action">{t("إعداد استعمال الزمن")} <span aria-hidden="true">←</span></Link>
              </div>
            </div>
          ) : (
            <div className="th-agenda-list">
              {schedule.map((item, index) => (
                <article className="th-agenda-row" key={item.slot.id || `${item.slot.school_class}-${index}`}>
                  <div className="th-agenda-time">
                    <span>{String(item.slot.start_time || "—").slice(0, 5)}</span>
                    <span className="th-agenda-line" aria-hidden="true" />
                  </div>
                  <div className="th-agenda-main">
                    <div className="th-agenda-title-row">
                      <h3>{item.class_name}</h3>
                      <span className="th-room-label">{item.slot.room || t("قاعة غير محددة")}</span>
                    </div>
                    <p>{t("الدرس التالي")} · <strong>{item.next_course?.title || t("لم يُحدّد بعد")}</strong></p>
                    <div className="th-agenda-progress" aria-label={`${item.progress?.percent || 0}%`}>
                      <span style={{ width: `${item.progress?.percent || 0}%` }} />
                    </div>
                  </div>
                  <Link to={`/sessions?cls=${item.slot.school_class}`} className={`th-agenda-cta${item.logged ? " is-done" : ""}`}>
                    {item.logged ? t("تم التسجيل") : t("سجّل الحصة")}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="th-panel th-next-panel">
          <SectionHeading eyebrow="الخطوة التالية" title="ماذا أُدرّس بعد ذلك؟" />
          {suggestions.length === 0 ? (
            <div className="th-simple-empty">
              <p>{t("أضف فوجًا ومقررًا لتظهر هنا الخطوة التعليمية المقترحة.")}</p>
              <Link to="/courses" className="th-inline-action">{t("استعراض المقرر")} <span aria-hidden="true">←</span></Link>
            </div>
          ) : (
            <div className="th-next-list">
              {suggestions.slice(0, 4).map((item) => (
                <article className="th-next-item" key={item.class_id}>
                  <div className="th-next-topline">
                    <span className="th-class-chip">{item.class_name}</span>
                    <span className="th-progress-label">{item.percent}% {t("من المقرر")}</span>
                  </div>
                  <h3>{item.next_course?.title || t("اكتمل المقرر")}</h3>
                  <div className="th-next-points">
                    {(item.key_points || []).slice(0, 3).map((point, pointIndex) => (
                      <span key={`${point}-${pointIndex}`}>{point}</span>
                    ))}
                  </div>
                  <div className="th-next-actions">
                    <Link to={`/sessions?cls=${item.class_id}`} className="th-button th-button-primary th-button-small">
                      {t("سجّل الحصة")}
                    </Link>
                    {item.has_plan && (
                      <Link to={`/preview/lesson-plan/${item.plan_id}`} className="th-button th-button-secondary th-button-small">
                        {t("خطة الدرس")}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="th-panel th-progress-panel">
        <SectionHeading
          eyebrow="متابعة التقدم"
          title="تقدّم الأفواج في المقرر"
          action={<Link className="th-text-link" to="/classes">{t("كل الأقسام")} <span aria-hidden="true">←</span></Link>}
        />
        {matrix.length === 0 ? (
          <div className="th-simple-empty"><p>{t("ستظهر مقارنة التقدم بعد إضافة الأقسام.")}</p></div>
        ) : (
          <div className="th-progress-list">
            {matrix.map((row) => (
              <div className="th-progress-row" key={row.class.id}>
                <div className="th-progress-class">
                  <span className="th-class-avatar">{row.class.name.slice(0, 1)}</span>
                  <span><strong>{row.class.name}</strong><small>{t("دروس مكتملة")}: {row.progress.done_count}/{row.progress.total_courses}</small></span>
                </div>
                <div className="th-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={row.progress.percent} aria-label={`${row.class.name} ${row.progress.percent}%`}>
                  <span style={{ width: `${row.progress.percent}%` }} />
                </div>
                <div className="th-progress-next">{row.progress.next_course?.title || t("اكتمل المقرر")}</div>
                <strong className="th-progress-percent">{row.progress.percent}%</strong>
              </div>
            ))}
          </div>
        )}
        {(alignment.insights || []).length > 0 && (
          <div className="th-insights-list">
            {alignment.insights.slice(0, 3).map((insight, index) => (
              <div className="th-insight" key={`${insight.text}-${index}`}>
                <Icon name="sparkle" size={16} /> <span>{insight.text}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="th-quick-actions">
        <div>
          <div className="th-section-eyebrow">{t("إجراءات سريعة")}</div>
          <h2>{t("ابدأ من هنا")}</h2>
        </div>
        <div className="th-quick-action-list">
          <Link to="/courses/new" className="th-quick-action"><Icon name="book" size={18} /><span>{t("إضافة درس")}</span><span aria-hidden="true">↗</span></Link>
          <Link to="/lesson-plans/new" className="th-quick-action"><Icon name="layers" size={18} /><span>{t("إنشاء خطة درس")}</span><span aria-hidden="true">↗</span></Link>
          <Link to="/classes" className="th-quick-action"><Icon name="school" size={18} /><span>{t("إدارة الأقسام")}</span><span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </div>
  );
}
