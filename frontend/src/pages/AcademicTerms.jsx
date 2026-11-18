import { useState } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

function TermModal({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", sequence: 1, start_date: "", end_date: "", status: "planned" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) setForm({ name: initial.name || "", sequence: initial.sequence || 1, start_date: initial.start_date || "", end_date: initial.end_date || "", status: initial.status || "planned" });
  }, [initial]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell title={initial?.id ? t("تعديل الفصل الدراسي") : t("فصل دراسي جديد")} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); onClose(); } catch { setBusy(false); } }}>
        <div className="row g-3">
          <div className="col-12"><label className="form-label fw-semibold small">{t("اسم الفصل *")}</label>
            <input className="form-control" value={form.name} required onChange={(e) => set("name", e.target.value)} placeholder="الثلاثي الأول" /></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("التسلسل")}</label>
            <input type="number" className="form-control" min={1} value={form.sequence} onChange={(e) => set("sequence", Number(e.target.value) || 1)} /></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("تاريخ البداية *")}</label>
            <input type="date" className="form-control" value={form.start_date} required onChange={(e) => set("start_date", e.target.value)} /></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("تاريخ النهاية *")}</label>
            <input type="date" className="form-control" value={form.end_date} required onChange={(e) => set("end_date", e.target.value)} /></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="planned">مخطط</option>
              <option value="active">مفعّل</option>
              <option value="closed">مقفول</option>
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

export default function AcademicTermsPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/academic-terms/");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  const [f, setF] = usePersistentState("terms-filters", { q: "", status: "" });

  const shown = items.filter((term) =>
    (!f.q.trim() || term.name.includes(f.q.trim())) &&
    (!f.status || term.status === f.status)
  ).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("الفصول الدراسية (الثلاثيات)")}</h3>
          <p className="text-secondary mb-0">{t("وحدات الوقت داخل السنة الدراسية.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>+ {t("فصل جديد")}</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا فصول دراسية بعد")} hint={t("أضف أول فصل لتوزيع التقييمات والسجلات.")}
          actionLabel={"+ " + t("فصل جديد")} onAction={() => setModal({})} />
      ) : (
      <div className="mt-4">
      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
        onReset={() => setF({ q: "", status: "" })}>
        <div className="form-check form-check-inline mb-0">
          <select className="form-select form-select-sm" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
            <option value="">{t("كل الحالات")}</option>
            <option value="planned">{t("مخطط")}</option>
            <option value="active">{t("مفعّل")}</option>
            <option value="closed">{t("مقفول")}</option>
          </select>
        </div>
      </FilterBar>
      {shown.map((term) => (
        <div key={term.id} className="card border-0 shadow-sm mb-3 term-card">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0"> {term.name}</h5>
                <span className="badge bg-secondary text-white">{t("التسلسل")} {term.sequence}</span>
                <span className="text-secondary small mt-1 d-block">{t(term.status)} • {new Date(term.start_date).toLocaleDateString()} → {new Date(term.end_date).toLocaleDateString()}</span>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(term)}>{t("تعديل")}</button>
                <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(term)}>{t("حذف")}</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {modal !== null && <TermModal initial={modal} onClose={() => setModal(null)}
        onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))} />}
      {confirm && <ConfirmModal title={t("حذف الفصل الدراسي")} body={t("سيتم حذف الفصل الدراسي وكل البيانات المرتبطة به.")}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </div>)}
    </>
  );
}
