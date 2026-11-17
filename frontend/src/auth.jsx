import { createContext, useContext, useEffect, useState } from "react";
import { profileApi } from "./api";
import { useLang } from "./i18n";

// Local single-user mode: there is no sign-in. The "user" is simply the
// local teacher profile served by the API, used for display in the sidebar.
const AuthCtx = createContext({ user: null, loading: true });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const { t, te } = useLang();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi.me()
      .then(setUser)
      .catch(() => setUser({ username: "teacher", first_name: t("الأستاذ"), last_name: "" }))
      .finally(() => setLoading(false));
  }, []);

  return <AuthCtx.Provider value={{ user, loading }}>{children}</AuthCtx.Provider>;
}

export function ProtectedRoute({ children }) {
  const { t, te } = useLang();
  const { loading } = useAuth();
  if (loading)
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  return children;
}
