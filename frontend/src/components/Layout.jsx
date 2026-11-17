import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useLang, LANGS } from "../i18n";
import Icon from "./Icon";

const GROUPS = [
  {
    label: "نظرة عامة",
    links: [
      { to: "/", label: "استوديو التدريس", icon: "grid", end: true },
      { to: "/assistant", label: "المساعد الذكي", icon: "sparkle" },
      { to: "/opening", label: "معالج افتتاح السنة", icon: "school" },
      { to: "/analytics", label: "تحليلات الفوج والثلاثي", icon: "chart" },
      { to: "/actions", label: "مركز الإجراءات", icon: "bell" },
      { to: "/reports", label: "تقارير الثلاثي", icon: "file" },
      { to: "/year-review", label: "الحصيلة السنوية", icon: "chart" },
      { to: "/exam-season", label: "موسم الامتحانات والمراجعة", icon: "clock" },
      { to: "/ceremony", label: "حفل التكريم والشهادات", icon: "sparkle" },
    ],
  },
  {
    label: "التدريس",
    links: [
      { to: "/planner", label: "التخطيط الأسبوعي", icon: "calendar" },
      { to: "/sessions", label: "سجلّ الحصص", icon: "calendar" },
      { to: "/classes", label: "الأقسام والتقدّم", icon: "chart" },
      { to: "/students", label: "التلاميذ والنقاط", icon: "users" },
      { to: "/gradebook", label: "إدخال النقاط", icon: "check" },
      { to: "/assessments", label: "الفروض والاختبارات", icon: "clipboard" },
      { to: "/follow-up", label: "الحضور ومتابعة التلاميذ", icon: "check" },
      { to: "/support", label: "الدعم وتواصل الأولياء", icon: "users" },
      { to: "/remedial", label: "مجموعات الدعم والاستدراك", icon: "users" },
      { to: "/campaigns", label: "تواصل الأولياء الجماعي", icon: "pen" },
      { to: "/parent-meetings", label: "يوم لقاء الأولياء", icon: "users" },
      { to: "/assignments", label: "المهام والواجبات", icon: "clipboard" },
      { to: "/courses", label: "الدروس والمقرر الدراسي", icon: "book" },
      { to: "/progression", label: "التوزيع السنوي والتقدم", icon: "layers" },
    ],
  },
  {
    label: "الوثائق",
    links: [
      { to: "/lesson-plans", label: "خطط الدروس", icon: "layers" },
      { to: "/journals", label: "الدفاتر اليومية", icon: "notebook" },
      { to: "/notebooks", label: "دفاتر الملاحظات", icon: "pen" },
      { to: "/themes", label: "استوديو السمات", icon: "palette" },
    ],
  },
  {
    label: "الإبداع والأدوات",
    links: [
      { to: "/creator", label: "استوديو الإنشاء والتحرير", icon: "sparkle" },
      { to: "/question-bank", label: "بنك الأسئلة", icon: "clipboard" },
    ],
  },
  {
    label: "التنظيم والطباعة",
    links: [
      { to: "/calendar", label: "العطل والندوات", icon: "sun" },
      { to: "/inspection", label: "التفتيش والمتابعة", icon: "search" },
      { to: "/portfolio", label: "ملف التفتيش والجاهزية", icon: "id" },
      { to: "/inspection-simulation", label: "محاكاة التفتيش", icon: "search" },
      { to: "/meetings", label: "مجالس الأقسام والاجتماعات", icon: "users" },
      { to: "/profile", label: "البطاقة المهنية", icon: "id" },
      { to: "/print", label: "مركز الطباعة PDF", icon: "printer" },
      { to: "/backup", label: "النسخ الاحتياطي والأرشفة", icon: "download" },
    ],
  },
];
const ALL_LINKS = GROUPS.flatMap((g) => g.links);

function GlobalSearch() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setGroups([]); return; }
    const id = setTimeout(() => {
      api(`/search/?q=${encodeURIComponent(q.trim())}`)
        .then((d) => { setGroups(d.groups || []); setOpen(true); })
        .catch(() => setGroups([]));
    }, 240);
    return () => clearTimeout(id);
  }, [q]);

  const go = (route) => { setOpen(false); setQ(""); navigate(route); };
  useEffect(() => { setOpen(false); }, [location.pathname]);
  const first = groups[0]?.results?.[0];

  return (
    <div className="global-search">
      <Icon name="search" size={16} className="global-search-icon" />
      <input ref={inputRef} className="form-control global-search-input" value={q}
        placeholder={t("ابحث في كل شيء… (Ctrl+K)")}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => groups.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && first) go(first.route);
          if (e.key === "Escape") setOpen(false);
        }} />
      {open && q.trim().length >= 2 && (
        <div className="search-dropdown">
          {groups.length === 0 ? (
            <div className="search-empty">{t("لا نتائج")}</div>
          ) : groups.map((g) => (
            <div key={g.key} className="search-group">
              <div className="search-group-label">{t(g.label)}</div>
              {g.results.map((r) => (
                <button key={`${g.key}-${r.id}`} type="button" className="search-item"
                  onMouseDown={(e) => { e.preventDefault(); go(r.route); }}>
                  <span className="search-item-title">{r.title}</span>
                  {r.subtitle && <span className="search-item-sub">{r.subtitle}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { t, lang, setLang } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current = ALL_LINKS.find((l) =>
    l.end ? location.pathname === l.to : location.pathname.startsWith(l.to) && l.to !== "/")
    || (location.pathname.startsWith("/preview") ? { label: "معاينة" }
      : location.pathname.startsWith("/editor") ? { label: "محرّر الوثائق" } : ALL_LINKS[0]);

  const sidebar = (
    <div className="sidebar-inner">
      <div className="brand">
        <div className="brand-mark">TH</div>
        <div className="brand-text">
          <div className="brand-name">TeacherHub</div>
          <div className="brand-sub">{{ ar: "منصة الأستاذ · الإعلام الآلي", en: "Teaching Studio · Informatics", fr: "Studio pédagogique · Informatique" }[lang]}</div>
        </div>
      </div>

      <nav className="side-nav">
        {GROUPS.map((g) => (
          <div className="nav-group" key={g.label}>
            <div className="nav-group-label">{t(g.label)}</div>
            {g.links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
                <Icon name={l.icon} size={19} className="side-icon" />
                <span>{t(l.label)}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="lang-label">{t("اختر لغة الواجهة")}</div>
        <div className="lang-switch" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.code} type="button"
              className={`lang-btn ${lang === l.code ? "active" : ""}`}
              onClick={() => setLang(l.code)}>{l.label}</button>
          ))}
        </div>
        <div className="user-chip">
          <div className="avatar">{(user?.first_name || user?.username || "T")[0]}</div>
          <div className="user-meta">
            <div className="user-name">{user?.first_name} {user?.last_name}</div>
            <div className="user-sub">{t("وضع محلي — بدون تسجيل دخول")}</div>
          </div>
          <span className="live-dot" title={t("يعمل محليًا")} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar d-none d-lg-flex">{sidebar}</aside>
      <div className={`offcanvas offcanvas-start sidebar-off ${open ? "show" : ""}`} tabIndex="-1"
        style={{ visibility: open ? "visible" : "hidden" }}>
        <div className="offcanvas-header pb-0">
          <button type="button" className="btn-close btn-close-white" onClick={() => setOpen(false)}
            aria-label={t("إغلاق")} />
        </div>
        {sidebar}
      </div>
      {open && <div className="offcanvas-backdrop fade show" onClick={() => setOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="btn btn-light d-lg-none icon-btn" onClick={() => setOpen(true)}
            aria-label={t("القائمة")}>
            <Icon name="grid" size={19} />
          </button>
          <div className="topbar-crumb">
            <span className="crumb-app">TeacherHub</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-page">{t(current.label)}</span>
          </div>
          <GlobalSearch />
          <div className="topbar-actions">
            <select className="form-select form-select-sm lang-select" value={lang}
              onChange={(e) => setLang(e.target.value)} aria-label="Language">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <span className="local-badge"><span className="live-dot" /> {t("يعمل محليًا")}</span>
          </div>
        </header>
        <div className="content-wrap">
          <Suspense fallback={
            <div className="d-flex align-items-center justify-content-center gap-2 py-5 text-secondary" role="status" aria-live="polite">
              <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
              <span>{t("جارٍ التحميل…")}</span>
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
