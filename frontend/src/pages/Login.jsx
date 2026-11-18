import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LANGS, useLang } from "../i18n";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { t, lang, setLang } = useLang();
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestedPath = typeof location.state?.from === "string" ? location.state.from : "/";
  const returnTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/";

  if (!loading && user) return <Navigate to={returnTo} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(returnTo, { replace: true });
    } catch {
      setError(t("تعذّر تسجيل الدخول. راجع اسم المستخدم وكلمة المرور ثم حاول مجددًا."));
      setBusy(false);
    }
  };

  return (
    <main className="th-auth-page">
      <section className="th-auth-layout" aria-labelledby="login-title">
        <div className="th-auth-intro">
          <div className="th-auth-brand">
            <span className="th-auth-mark" aria-hidden="true">t</span>
            <span>TeacherHub</span>
          </div>
          <span className="th-auth-eyebrow">{t("مساحة تعليمية خاصة")}</span>
          <h1>{t("يومك الدراسي، أكثر وضوحًا.")}</h1>
          <p>{t("خطّط لحصصك، سجّل ما أُنجز، وتابع تقدّم أفواجك في مساحة مخصّصة لك.")}</p>
          <div className="th-auth-assurance">
            <span className="th-auth-assurance-dot" />
            <span>{t("حساب واحد · لا يوجد تسجيل عام")}</span>
          </div>
        </div>

        <div className="th-auth-card">
          <div className="th-auth-card-top">
            <div>
              <div className="th-auth-eyebrow">{t("أهلًا بعودتك")}</div>
              <h2 id="login-title">{t("تسجيل الدخول")}</h2>
            </div>
            <label className="visually-hidden" htmlFor="auth-language">{t("اختر لغة الواجهة")}</label>
            <select
              id="auth-language"
              className="th-language-select"
              value={lang}
              onChange={(event) => setLang(event.target.value)}
              aria-label={t("اختر لغة الواجهة")}
            >
              {LANGS.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </div>

          <p className="th-auth-card-copy">{t("أدخل بيانات الحساب الخاص الذي تم إعداده لك.")}</p>

          <form className="th-login-form" onSubmit={submit}>
            <div className="th-auth-field">
              <label htmlFor="teacher-username">{t("اسم المستخدم")}</label>
              <input
                id="teacher-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="th-auth-field">
              <label htmlFor="teacher-password">{t("كلمة المرور")}</label>
              <input
                id="teacher-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && <div className="th-auth-error" role="alert">{error}</div>}

            <button className="th-button th-button-primary th-login-button" type="submit" disabled={busy || loading}>
              {busy ? t("جارٍ تسجيل الدخول…") : t("دخول آمن")}
            </button>
          </form>

          <div className="th-auth-recovery">
            <strong>{t("الحساب خاص")}</strong>
            <span>{t("لا يوجد تسجيل عام أو استعادة بريدية تلقائية. استعادة الوصول تتم عبر إجراء التهيئة الخاص بالحساب.")}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
