import { useLang } from "../i18n";
export default function ThemeCard({ theme, onApply, onPreview, footer }) {
  const { t, te } = useLang();
  const v = theme.css_vars;
  const usage = theme.usage || {};
  const totalUse = (usage.journals || 0) + (usage.lesson_plans || 0) + (usage.notebooks || 0);
  return (
    <div className="card theme-card border-0 shadow-sm h-100" style={v}>
      <div className="theme-cover" style={{ background: `linear-gradient(135deg, ${theme.deeper}, ${theme.deep} 60%, ${theme.accent2})` }}>
        {theme.pattern && theme.pattern !== "none" && <span className="theme-pattern" data-pattern={theme.pattern} />}
        <span className="theme-chip" style={{ fontFamily: theme.heading_font }}>{theme.name_ar}</span>
        <span className="theme-en">{theme.name_en}</span>
        <span className="theme-badge">{theme.source === "generated" ? t("مولّدة آليًا") : theme.source === "custom" ? t("مخصصة") : t("مصممة")}</span>
      </div>
      <div className="card-body d-flex flex-column">
        <div className="d-flex gap-1 mb-2" aria-hidden>
          {[theme.deep, theme.accent, theme.accent2, theme.soft, theme.line].map((c, i) => (
            <span key={i} className="swatch" style={{ background: c }} title={c} />
          ))}
        </div>
        <p className="small text-secondary flex-grow-1 mb-2">{theme.tagline}</p>
        <div className="d-flex flex-wrap gap-1 mb-3">
          <span className="badge text-bg-light border">{te(theme.style_type)}</span>
          <span className="badge text-bg-light border">{t("العنوان:")} {theme.heading_font}</span>
          {totalUse > 0 && <span className="badge text-bg-warning border">{t("مستعملة في")} {totalUse}</span>}
        </div>
        {footer ?? (
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-primary rounded-pill flex-grow-1" onClick={() => onApply?.(theme)}>
              {t("تطبيق على…")}
            </button>
            <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => onPreview?.(theme)}>
              {t("معاينة")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
