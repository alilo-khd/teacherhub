import { useLang } from "../i18n";
import Icon from "./Icon";

/** Shared filter / sort toolbar. Children are extra <select>/<input> controls. */
export default function FilterBar({
  search, onSearch, searchPlaceholder,
  sort, onSort, sortOptions,
  count, onReset, children, extra,
}) {
  const { t, te } = useLang();
  return (
    <div className="filter-bar">
      {onSearch && (
        <div className="filter-search">
          <Icon name="search" size={17} className="filter-search-icon" />
          <input className="form-control" value={search ?? ""}
            placeholder={searchPlaceholder || t("بحث…")}
            onChange={(e) => onSearch(e.target.value)} />
        </div>
      )}
      {children}
      {sortOptions && (
        <label className="filter-sort">
          <span>{t("فرز حسب")}</span>
          <select className="form-select" value={sort} onChange={(e) => onSort?.(e.target.value)}>
            {sortOptions.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
        </label>
      )}
      {typeof count === "number" && (
        <span className="filter-count">{count} {t("نتيجة")}</span>
      )}
      {extra}
      {onReset && (
        <button type="button" className="btn btn-sm btn-light filter-reset" onClick={onReset}>
          {t("إعادة تعيين")}
        </button>
      )}
    </div>
  );
}
