import { useEffect, useState } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

function OrgModal({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", code: "", locale: "ar", status: "active" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) setForm({ name: initial.name || "", code: initial.code || "", locale: initial.locale || "ar", status: initial.status || "active" });
  }, [initial]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell title={initial?.id ? t("تعديل المنظمة") : t("منظمة جديدة")} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); onClose(); } catch { setBusy(false); } }}>
        <div className="row g-3">
          <div className="col-12"><label className="form-label fw-semibold small">{t("اسم المنظمة *")}</label>
            <input className="form-control" value={form.name} required onChange={(e) => set("name", e.target.value)} placeholder={t("مثال: مدرسة الشرق الخاصة")} /></div>
          <div className="col-12 col-md-6"><label className="form-label fw-semibold small">{t("الكود الفريد *")}</label>
            <input className="form-control" value={form.code} required onChange={(e) => set("code", e.target.value)} placeholder="algiers-schools" /></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("اللغة الافتراضية")}</label>
            <select className="form-select" value={form.locale} onChange={(e) => set("locale", e.target.value)}>
              <option value="ar">العربية (RTL)</option>
              <option value="fr">Français (LTR)</option>
            </select></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">مفعّلة</option>
              <option value="closed">مقفلة</option>
              <option value="archived">مؤرّفة</option>
            </select></div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ")}</button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function OrganizationsPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/organizations/");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  const [f, setF] = usePersistentState("orgs-filters", { q: "", status: "" });

  const shown = items.filter((o) =>
    (!f.q.trim() || o.name.includes(f.q.trim())) &&
    (!f.status || o.status === f.status)
  ).sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("المنظمات والمجموعات التعليمية")}</h3>
          <p className="text-secondary mb-0">{t("حاضنات المدارس والفصول ضمن SchoolOS.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>+ {t("منظمة جديدة")}</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا organizations بعد")} hint={t("أضف أول منظمة لتكون حاضنة للمدارس والفصول.")}
          actionLabel={"+ " + t("منظمة جديدة")} onAction={() => setModal({})} />
      ) : (
      <div className="mt-4">
      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
        onReset={() => setF({ q: "", status: "" })}>
        <div className="form-check form-check-inline mb-0">
          <select className="form-select form-select-sm" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
            <option value="">{t("كل الحالات")}</option>
            <option value="active">{t("مفعّلة")}</option>
            <option value="closed">{t("مقفلة")}</option>
            <option value="archived">{t("مؤرّفة")}</option>
          </select>
        </div>
      </FilterBar>
      {shown.map((org) => (
        <div key={org.id} className="card border-0 shadow-sm mb-3 org-card">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0"> {org.name}</h5>
                <span className="badge bg-secondary text-white">{org.code}</span>
                <span className="text-secondary small mt-1 d-block">{org.locale === "ar" ? "العربية (RTL)" : "Français (LTR)"} • {t(org.status)}</span>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge rounded-pill text-bg-light border">{org.school_count || 0} {t("مدرسة")}</span>
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(org)}>{t("تعديل")}</button>
                <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(org)}>{t("حذف")}</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {modal !== null && <OrgModal initial={modal} onClose={() => setModal(null)}
        onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))} />}
      {confirm && <ConfirmModal title={t("حذف المنظمة")} body={t("سيتم حذف المنظمة وكل المدارس المرتبطة بها.")}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </div>)}
    </>
  );
}
