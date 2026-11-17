import { useLang } from "../i18n";
import Icon from "./Icon";
export function EmptyState({ icon = "", title, hint, actionLabel, onAction }) {
  const { t, te } = useLang();
  return (
    <div className="text-center py-5 px-3 empty-state">
      <div className="empty-icon mb-3">{icon ? <span>{icon}</span> : <Icon name="sparkle" size={26} />}</div>
      <h5 className="fw-bold">{title}</h5>
      {hint && <p className="text-secondary mb-3">{hint}</p>}
      {actionLabel && (
        <button className="btn btn-primary rounded-pill px-4" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  const { t, te } = useLang();
  return (
    <div className="row g-3">
      {Array.from({ length: count }).map((_, i) => (
        <div className="col-12 col-sm-6 col-xl-4" key={i}>
          <div className="card border-0 shadow-sm skeleton-card">
            <div className="sk sk-cover" />
            <div className="card-body">
              <div className="sk sk-line w-75" />
              <div className="sk sk-line w-50" />
              <div className="sk sk-line w-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label }) {
  const { t } = useLang();
  return (
    <div className="d-flex align-items-center gap-2 text-secondary py-4 justify-content-center">
      <div className="spinner-border spinner-border-sm" role="status" />
      <span>{label ?? t("جارٍ التحميل…")}</span>
    </div>
  );
}
