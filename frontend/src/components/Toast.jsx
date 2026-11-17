import { createContext, useCallback, useContext, useState } from "react";
import { useLang } from "../i18n";

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const { t, te } = useLang();
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, variant = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-container position-fixed bottom-0 start-0 p-3" style={{ zIndex: 2000 }}>
        {toasts.map((item) => (
          <div key={item.id} className={`toast show align-items-center text-bg-${item.variant} border-0 mb-2`} role="alert">
            <div className="d-flex">
              <div className="toast-body fw-semibold">{item.msg}</div>
              <button type="button" className="btn-close btn-close-white me-auto m-2"
                onClick={() => setToasts((x) => x.filter((y) => y.id !== item.id))} aria-label={t("إغلاق")} />
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
