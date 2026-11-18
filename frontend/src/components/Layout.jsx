import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useLang, LANGS } from "../i18n";
import Icon from "./Icon";

const CORE_LINKS = [
  { to: "/", label: "اليوم", icon: "grid", end: true },
  { to: "/planner", label: "التخطيط الأسبوعي", icon: "calendar" },
  { to: "/courses", label: "المقرر الدراسي", icon: "book" },
  { to: "/lesson-plans", label: "خطط الدروس", icon: "layers" },
  { to: "/classes", label: "الأقسام", icon: "school" },
  { to: "/sessions", label: "سجلّ الحصص", icon: "check" },
  { to: "/analytics", label: "مراجعة التقدّم", icon: "chart" },
];

// Existing workflows remain reachable during the scope review; core teaching
// tasks stay visible, while specialist modules are grouped under More tools.
const TOOL_GROUPS = [
  {
    label: "التلاميذ والتقييم",
    links: [
      { to: "/students", label: "التلاميذ والنقاط", icon: "users" },
      { to: "/gradebook", label: "إدخال النقاط", icon: "check" },
      { to: "/assessments", label: "الفروض والاختبارات", icon: "clipboard" },
      { to: "/follow-up", label: "الحضور ومتابعة التلاميذ", icon: "check" },
      { to: "/support", label: "الدعم وتواصل الأولياء", icon: "users" },
      { to: "/remedial", label: "مجموعات الدعم والاستدراك", icon: "users" },
      { to: "/assignments", label: "المهام والواجبات", icon: "clipboard" },
    ],
  },
  {
    label: "المحتوى والوثائق",
    links: [
      { to: "/journals", label: "الدفاتر اليومية", icon: "notebook" },
      { to: "/notebooks", label: "دفاتر الملاحظات", icon: "pen" },
      { to: "/creator", label: "استوديو الإنشاء والتحرير", icon: "sparkle" },
      { to: "/question-bank", label: "بنك الأسئلة", icon: "clipboard" },
      { to: "/themes", label: "استوديو السمات", icon: "palette" },
      { to: "/print", label: "مركز الطباعة PDF", icon: "printer" },
    ],
  },
  {
    label: "التحليلات والتنظيم",
    links: [
      { to: "/actions", label: "مركز الإجراءات", icon: "bell" },
      { to: "/reports", label: "تقارير الثلاثي", icon: "file" },
      { to: "/progression", label: "التوزيع السنوي والتقدم", icon: "layers" },
      { to: "/year-review", label: "الحصيلة السنوية", icon: "chart" },
      { to: "/calendar", label: "العطل والندوات", icon: "sun" },
      { to: "/inspection", label: "التفتيش والمتابعة", icon: "search" },
      { to: "/portfolio", label: "ملف التفتيش والجاهزية", icon: "id" },
      { to: "/inspection-simulation", label: "محاكاة التفتيش", icon: "search" },
      { to: "/opening", label: "معالج افتتاح السنة", icon: "school" },
      { to: "/exam-season", label: "موسم الامتحانات والمراجعة", icon: "clock" },
      { to: "/ceremony", label: "حفل التكريم والشهادات", icon: "sparkle" },
      { to: "/campaigns", label: "تواصل الأولياء الجماعي", icon: "pen" },
      { to: "/parent-meetings", label: "يوم لقاء الأولياء", icon: "users" },
      { to: "/meetings", label: "مجالس الأقسام والاجتماعات", icon: "users" },
      { to: "/assistant", label: "المساعد الذكي", icon: "sparkle" },
      { to: "/profile", label: "البطاقة المهنية", icon: "id" },
      { to: "/backup", label: "النسخ الاحتياطي والأرشفة", icon: "download" },
    ],
  },
  {
    label: "الإدارة الأكاديمية (v2)",
    links: [
      { to: "/organizations", label: "المنظمات", icon: "school" },
      { to: "/schools", label: "المدارس", icon: "university" },
      { to: "/academic-years", label: "السنوات الدراسية", icon: "calendar" },
      { to: "/academic-terms", label: "الفصول الدراسية", icon: "layers" },
      { to: "/campuses", label: "المقرات والساحات", icon: "map" },
      { to: "/enrollments", label: "التسجيلات", icon: "users" },
      { to: "/computer-labs", label: "مختبرات الكمبيوتر", icon: "desktop" },
      { to: "/seats", label: "المقاعد", icon: "chair" },
      { to: "/seating-assignments", label: "تكليفات المقاعد", icon: "users" },
      { to: "/security-center", label: "مركز الأمان", icon: "bell" },
      { to: "/parent-portal", label: "بوابة أولياء الأمور", icon: "users" },
      { to: "/student-portal", label: "بوابة التلميذ", icon: "user" },
      { to: "/class-reassignment", label: "تغيير الإسناد", icon: "exchange" },
    ],
  },
];

const ALL_LINKS = [
  ...CORE_LINKS,
  ...TOOL_GROUPS.flatMap((group) => group.links),
];

function GlobalSearch() {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api(`/search/?q=${encodeURIComponent(trimmed)}`)
        .then((data) => { setGroups(data.groups || []); setOpen(true); })
        .catch(() => setGroups([]));
    }, 240);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const firstResult = groups.flatMap((group) => group.results || [])[0];
  const go = (route) => {
    setOpen(false);
    setQuery("");
    navigate(route);
  };

  return (
    <div className="global-search">
      <Icon name="search" size={17} className="global-search-icon" />
      <input
        ref={inputRef}
        className="form-control global-search-input"
        value={query}
        placeholder={t("ابحث في كل شيء… (Ctrl+K)")}
        aria-label={t("ابحث في كل شيء… (Ctrl+K)")}
        aria-expanded={open && query.trim().length >= 2}
        aria-controls="global-search-results"
        role="combobox"
        aria-autocomplete="list"
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => groups.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && firstResult) go(firstResult.route);
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && query.trim().length >= 2 && (
        <div className="search-dropdown" id="global-search-results" role="listbox">
          {groups.length === 0 ? (
            <div className="search-empty">{t("لا نتائج")}</div>
          ) : groups.map((group) => (
            <div key={group.key} className="search-group">
              <div className="search-group-label">{t(group.label)}</div>
              {group.results.map((result) => (
                <button
                  key={`${group.key}-${result.id}`}
                  type="button"
                  className="search-item"
                  role="option"
                  onMouseDown={(event) => { event.preventDefault(); go(result.route); }}
                >
                  <span className="search-item-title">{result.title}</span>
                  {result.subtitle && <span className="search-item-sub">{result.subtitle}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({ link, t, onNavigate }) {
  return (
    <NavLink
      to={link.to}
      end={link.end}
      onClick={onNavigate}
      className={({ isActive }) => `th-nav-link${isActive ? " is-active" : ""}`}
    >
      <span className="th-nav-icon"><Icon name={link.icon} size={18} /></span>
      <span className="th-nav-text">{t(link.label)}</span>
    </NavLink>
  );
}

function SidebarContent({ t, user, toolsOpen, setToolsOpen, onNavigate, onLogout, logoutError, logoutBusy }) {
  const initial = (user?.first_name || user?.username || "T").slice(0, 1);
  return (
    <div className="th-sidebar-content">
      <div className="th-brand">
        <div className="th-brand-mark" aria-hidden="true"><span>t</span></div>
        <div className="th-brand-copy">
          <div className="th-brand-name">TeacherHub</div>
          <div className="th-brand-subtitle">{t("مساحة التدريس")}</div>
        </div>
      </div>

      <div className="th-workspace-label">{t("مساحة العمل")}</div>
      <nav className="th-primary-nav" aria-label={t("التنقل الرئيسي")}>
        {CORE_LINKS.map((link) => <SidebarLink key={link.to} link={link} t={t} onNavigate={onNavigate} />)}
      </nav>

      <button
        type="button"
        className={`th-more-toggle${toolsOpen ? " is-open" : ""}`}
        aria-expanded={toolsOpen}
        aria-controls="th-secondary-nav"
        onClick={() => setToolsOpen((value) => !value)}
      >
        <span className="th-more-icon"><Icon name="grid" size={17} /></span>
        <span>{t("أدوات إضافية")}</span>
        <span className="th-more-count">{TOOL_GROUPS.reduce((n, group) => n + group.links.length, 0)}</span>
        <span className="th-chevron" aria-hidden="true">{toolsOpen ? "−" : "+"}</span>
      </button>

      {toolsOpen && (
        <nav className="th-secondary-nav" id="th-secondary-nav" aria-label={t("أدوات إضافية")}>
          {TOOL_GROUPS.map((group) => (
            <section className="th-tool-group" key={group.label}>
              <h2 className="th-tool-heading">{t(group.label)}</h2>
              {group.links.map((link) => <SidebarLink key={link.to} link={link} t={t} onNavigate={onNavigate} />)}
            </section>
          ))}
        </nav>
      )}

      <div className="th-sidebar-footer">
        <div className="th-user-card">
          <span className="th-avatar" aria-hidden="true">{initial}</span>
          <span className="th-user-copy">
            <span className="th-user-name">{[user?.first_name, user?.last_name].filter(Boolean).join(" ") || t("الأستاذ")}</span>
            <span className="th-user-role">{t("مساحة الأستاذ")}</span>
          </span>
        </div>
        {logoutError && <div className="th-logout-error" role="alert">{logoutError}</div>}
        <button className="th-logout-button" type="button" onClick={onLogout} disabled={logoutBusy}>
          <Icon name="logout" size={17} />
          <span>{t(logoutBusy ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج")}</span>
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const { t, lang, setLang } = useLang();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutError("");
    setLogoutBusy(true);
    try {
      await logout();
      setMobileOpen(false);
      navigate("/login", { replace: true });
    } catch {
      setLogoutError(t("تعذّر تسجيل الخروج. حاول مرة أخرى."));
      setLogoutBusy(false);
    }
  };

  const current = ALL_LINKS.find((link) =>
    link.end ? location.pathname === link.to : location.pathname.startsWith(link.to) && link.to !== "/")
    || (location.pathname.startsWith("/preview") ? { label: "معاينة" }
      : location.pathname.startsWith("/editor") ? { label: "محرّر الوثائق" } : CORE_LINKS[0]);
  const secondaryActive = TOOL_GROUPS.some((group) => group.links.some((link) =>
    location.pathname === link.to || location.pathname.startsWith(`${link.to}/`)));

  useEffect(() => {
    if (secondaryActive) setToolsOpen(true);
    setMobileOpen(false);
  }, [location.pathname, secondaryActive]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const sidebar = (
    <SidebarContent
      t={t}
      user={user}
      toolsOpen={toolsOpen}
      setToolsOpen={setToolsOpen}
      onNavigate={() => setMobileOpen(false)}
      onLogout={handleLogout}
      logoutError={logoutError}
      logoutBusy={logoutBusy}
    />
  );

  return (
    <div className="th-app-shell">
      <aside className={`th-sidebar${mobileOpen ? " is-open" : ""}`} aria-label={t("التنقل الرئيسي")}>
        {sidebar}
      </aside>
      <button
        className={`th-sidebar-backdrop${mobileOpen ? " is-visible" : ""}`}
        type="button"
        tabIndex={mobileOpen ? 0 : -1}
        aria-label={t("إغلاق القائمة")}
        onClick={() => setMobileOpen(false)}
      />

      <main className="th-main">
        <header className="th-topbar">
          <button
            type="button"
            className="th-icon-button th-menu-button"
            aria-label={t("فتح القائمة")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="grid" size={19} />
          </button>
          <div className="th-page-identity">
            <span className="th-page-kicker">{t("TeacherHub · مساحة التدريس")}</span>
            <span className="th-page-title">{t(current.label)}</span>
          </div>
          <GlobalSearch />
          <div className="th-topbar-actions">
            <label className="visually-hidden" htmlFor="interface-language">{t("اختر لغة الواجهة")}</label>
            <select
              id="interface-language"
              className="th-language-select"
              value={lang}
              onChange={(event) => setLang(event.target.value)}
            >
              {LANGS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
            <span className="th-topbar-avatar" aria-hidden="true">{(user?.first_name || user?.username || "T").slice(0, 1)}</span>
          </div>
        </header>

        <div className="th-content-wrap">
          <Suspense fallback={
            <div className="th-route-loading" role="status" aria-live="polite">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
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
