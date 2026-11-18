import { useState } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

function YearModal({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", status: "planned" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) setForm({ name: initial.name || "", start_date: initial.start_date || "", end_date: initial.end_date || "", status: initial.status || "planned" });
  }, [initial]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell title={initial?.id ? t("تعديل السنة الدراسية") : t("سنة دراسية جديدة")} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); onClose(); } catch { setBusy(false); } }}>
        <div className="row g-3">
          <div className="col-12"><label className="form-label fw-semibold small">{t("اسم السنة *")}</label>
            <input className="form-control" value={form.name} required onChange={(e) => set("name", e.target.value)} placeholder="2026 / 2027" /></div>
          <div className="col-12 col-md-4"><label className="form-label fw-semibold small">{t("تاريخ البداية *")}</label>
            <input type="date" className="form-control" value={form.start_date} required onChange={(e) => set("start_date", e.target.value)} /></div>
          <div className="col-12 col-md-4"><label className="form-label fw-semibold small">{t("تاريخ النهاية *")}</label>
            <input type="date" className="form-control" value={form.end_date} required onChange={(e) => set("end_date", e.target.value)} /></div>
          <div className="col-12 col-md-4"><label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="planned">مخطط</option>
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

export default function AcademicYearsPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/academic-years/");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  const [f, setF] = usePersistentState("years-filters", { q: "", status: "" });

  const shown = items.filter((y) =>
    (!f.q.trim() || y.name.includes(f.q.trim())) &&
    (!f.status || y.status === f.status)
  ).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("السنوات الدراسية")}</h3>
          <p className="text-secondary mb-0">{t("الفترات الزمنية التي تُنظَّم فيها الفصول والتسجيل.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>+ {t("سنة جديدة")}</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا سنوات دراسية بعد")} hint={t("أضف أول سنة دراسية لتبدأ بالتسجيل والتقويم.")}
          actionLabel={"+ " + t("سنة جديدة")} onAction={() => setModal({})} />
      ) : (
      <div className="mt-4">
      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
        onReset={() => setF({ q: "", status: "" })}>
        <div className="form-check form-check-inline mb-0">
          <select className="form-select form-select-sm" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
            <option value="">{t("كل الحالات")}</option>
            <option value="planned">{t("مخطط")}</option>
            <option value="active">{t("مفعّلة")}</option>
            <option value="closed">{t("مقفلة")}</option>
            <option value="archived">{t("مؤرّفة")}</option>
          </select>
        </div>
      </FilterBar>
      {shown.map((year) => (
        <div key={year.id} className="card border-0 shadow-sm mb-3 year-card">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0"> {year.name}</h5>
                <span className="badge bg-secondary text-white">{new Date(year.start_date).toLocaleDateString()} → {new Date(year.end_date).toLocaleDateString()}</span>
                <span className="text-secondary small mt-1 d-block">{t(year.status)} • {year.term_count || 0} {t("فصل")}</span>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(year)}>{t("تعديل")}</button>
                <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(year)}>{t("حذف")}</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {modal !== null && <YearModal initial={modal} onClose={() => setModal(null)}
        onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))} />}
      {confirm && <ConfirmModal title={t("حذف السنة الدراسية")} body={t("سيتم حذف السنة الدراسية وكل البيانات المرتبطة بها.")}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </div>)}
    </>
  );
}
