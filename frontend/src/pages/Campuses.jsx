import { useState } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

function CampusModal({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", code: "", status: "active", address: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) setForm({ name: initial.name || "", code: initial.code || "", status: initial.status || "active", address: initial.address || "" });
  }, [initial]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell title={initial?.id ? t("تعديل الحرم الجامعي") : t("حرم جامعي جديد")} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); onClose(); } catch { setBusy(false); } }}>
        <div className="row g-3">
          <div className="col-12"><label className="form-label fw-semibold small">{t("اسم الحرم *")}</label>
            <input className="form-control" value={form.name} required onChange={(e) => set("name", e.target.value)} placeholder={t("مثال: الحرم الرئيسي")} /></div>
          <div className="col-12 col-md-6"><label className="form-label fw-semibold small">{t("الكود الفريد *")}</label>
            <input className="form-control" value={form.code} required onChange={(e) => set("code", e.target.value)} placeholder="main-campus" /></div>
          <div className="col-12 col-md-6"><label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">مفعّل</option>
              <option value="closed">مقفول</option>
            </select></div>
          <div className="col-12"><label className="form-label fw-semibold small">{t("العنوان")}</label>
            <input className="form-control" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ")}</button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function CampusesPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/campuses/");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  const [f, setF] = usePersistentState("campuses-filters", { q: "", status: "" });

  const shown = items.filter((c) =>
    (!f.q.trim() || c.name.includes(f.q.trim())) &&
    (!f.status || c.status === f.status)
  ).sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("المقرات والساحات")}</h3>
          <p className="text-secondary mb-0">{t("المواقع الفيزيائية التي تستضيف الفصول والقاعات.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>+ {t("حرم جديد")}</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا مقرات بعد")} hint={t("أضف أول مقر لتحديد مواقع الفصول والقاعات.")}
          actionLabel={"+ " + t("حرم جديد")} onAction={() => setModal({})} />
      ) : (
      <div className="mt-4">
      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
        onReset={() => setF({ q: "", status: "" })}>
        <div className="form-check form-check-inline mb-0">
          <select className="form-select form-select-sm" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
            <option value="">{t("كل الحالات")}</option>
            <option value="active">{t("مفعّل")}</option>
            <option value="closed">{t("مقفول")}</option>
          </select>
        </div>
      </FilterBar>
      {shown.map((campus) => (
        <div key={campus.id} className="card border-0 shadow-sm mb-3 campus-card">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0"> {campus.name}</h5>
                <span className="badge bg-secondary text-white">{campus.code}</span>
                <span className="text-secondary small mt-1 d-block">{t(campus.status)} {campus.address ? `• ${campus.address}` : ""}</span>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(campus)}>{t("تعديل")}</button>
                <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(campus)}>{t("حذف")}</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {modal !== null && <CampusModal initial={modal} onClose={() => setModal(null)}
        onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))} />}
      {confirm && <ConfirmModal title={t("حذف المقر")} body={t("سيتم حذف المقر وكل البيانات المرتبطة به.")}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </div>)}
    </>
  );
}
