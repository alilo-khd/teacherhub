import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { assistantApi } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const SEVERITY = { high: ["عالية", "text-bg-danger"], medium: ["متوسطة", "text-bg-warning"], low: ["منخفضة", "text-bg-secondary"] };

export default function AssistantPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [category, setCategory] = useState("");
  const [dismissed, setDismissed] = usePersistentState("assistant-dismissed", []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await assistantApi.digest()); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    data.items.forEach((item) => map.set(item.category, item.category_label));
    return [...map.entries()];
  }, [data]);

  const visible = useMemo(() => {
    if (!data) return [];
    return data.items.filter((item) => !dismissed.includes(item.key) && (!category || item.category === category));
  }, [data, dismissed, category]);

  const addTask = async (item) => {
    setBusy(item.key);
    try {
      const res = await assistantApi.createTasks({ keys: [item.key] });
      if (res.created) toast(t("أُضيفت إلى مركز الإجراءات"));
      load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const addAll = async () => {
    setBusy("all");
    try {
      const res = await assistantApi.createTasks({});
      toast(`${t("أُضيفت")} ${res.created} ${t("مهمة إلى مركز الإجراءات")}`);
      load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const counts = data.counts;

  const renderItem = (item, highlight = false) => {
    const [sevLabel, sevClass] = SEVERITY[item.severity] || SEVERITY.low;
    return (
      <div key={item.key} className={`assistant-item ${highlight ? "focus" : ""} ${item.already_added ? "added" : ""}`}>
        <div className="flex-grow-1">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className={`badge rounded-pill ${sevClass}`}>{t(sevLabel)}</span>
            <span className="badge text-bg-light border">{item.category_label}</span>
            <span className="fw-bold">{item.title}</span>
            {item.already_added && <span className="badge text-bg-success">✓ {t("في المهام")}</span>}
          </div>
          <p className="text-secondary small mb-1">{item.detail}</p>
          <div className="text-secondary assistant-reason">{t("السبب:")} {item.reason}{item.due_date ? ` • ${t("الأجل:")} ${item.due_date}` : ""}</div>
        </div>
        <div className="assistant-actions">
          <button className="btn btn-sm btn-outline-primary rounded-pill text-nowrap" onClick={() => navigate(item.link)}>
            <Icon name="search" size={14} /> {t("فتح المركز")}
          </button>
          {!item.already_added && (
            <button className="btn btn-sm btn-primary rounded-pill text-nowrap" disabled={busy === item.key} onClick={() => addTask(item)}>
              {busy === item.key ? <span className="spinner-border spinner-border-sm" /> : t("إضافة كمهمة")}
            </button>
          )}
          <button className="btn btn-sm btn-light rounded-pill" title={t("تخطي")} onClick={() => setDismissed((xs) => [...xs, item.key])}>✕</button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("المساعد الذكي — موجزك الأسبوعي")}</h3>
          <p className="text-secondary mb-0">
            {t("كل ما يحتاج انتباهك هذا الأسبوع من كل المراكز في مكان واحد:")} {data.week_from} ← {data.week_to} • {data.term_label}
          </p>
        </div>
        <div className="d-flex gap-2">
          {dismissed.length > 0 && (
            <button className="btn btn-light rounded-pill" onClick={() => setDismissed([])}>{t("إظهار المتخطاة")} ({dismissed.length})</button>
          )}
          <button className="btn btn-primary rounded-pill px-4" disabled={busy === "all" || counts.new === 0} onClick={addAll}>
            {busy === "all" ? <span className="spinner-border spinner-border-sm" /> : `${t("إضافة كل الجديد كمهام")} (${counts.new})`}
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        {[[counts.new, "إشارات جديدة"], [counts.high, "أولوية عالية"], [counts.open_tasks, "مهام مفتوحة"], [counts.overdue_tasks, "مهام متأخرة"], [counts.total, "كل الإشارات"]].map(([value, label]) => (
          <div className="col-6 col-md-4 col-xl" key={label}>
            <div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div>
          </div>
        ))}
      </div>

      {data.focus.length > 0 && (
        <>
          <h5 className="fw-bold mb-2"> {t("أولويات هذا الأسبوع")}</h5>
          <div className="d-flex flex-column gap-2 mb-4">
            {data.focus.filter((item) => !dismissed.includes(item.key)).map((item) => renderItem(item, true))}
          </div>
        </>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className={`btn btn-sm rounded-pill ${!category ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setCategory("")}>{t("كل الفئات")}</button>
        {categories.map(([value, label]) => (
          <button key={value} className={`btn btn-sm rounded-pill ${category === value ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setCategory(value)}>{label}</button>
        ))}
      </div>

      {!visible.length
        ? <EmptyState title={t("لا إشارات حاليًا")} hint={t("كل شيء تحت السيطرة — عد لاحقًا أو أظهر الإشارات المتخطاة.")} />
        : <div className="d-flex flex-column gap-2">{visible.map((item) => renderItem(item))}</div>}
    </>
  );
}
