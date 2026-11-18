import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";
import { computerLabApi, seatApi } from "../api/v2";

function SeatModal({ initial, labs, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    lab: "", seat_number: "", row: "", column: 1, status: "available", notes: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) {
      setForm({
        lab: initial.lab || "", seat_number: initial.seat_number || "",
        row: initial.row || "", column: initial.column || 1,
        status: initial.status || "available", notes: initial.notes || "",
      });
    } else {
      setForm({ lab: "", seat_number: "", row: "", column: 1, status: "available", notes: "" });
    }
  }, [initial]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell
      title={initial?.id ? t("تعديل المقعد") : t("مقعد جديد")}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSubmit(form);
            onClose();
          } catch {
            setBusy(false);
          }
        }}
      >
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">{t("المختبر *")}</label>
            <select className="form-select" value={form.lab} required
              onChange={(e) => set("lab", e.target.value)}>
              <option value="">{t("اختر مختبراً…")}</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("رقم المقعد *")}</label>
            <input className="form-control" value={form.seat_number} required
              onChange={(e) => set("seat_number", e.target.value)} placeholder="A1" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("الصف")}</label>
            <input className="form-control" value={form.row}
              onChange={(e) => set("row", e.target.value)} placeholder="A" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("العمود")}</label>
            <input type="number" className="form-control" value={form.column || 1}
              onChange={(e) => set("column", Number(e.target.value) || 1)} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status}
              onChange={(e) => set("status", e.target.value)}>
              <option value="available">{t("متوفر")}</option>
              <option value="occupied">{t("مشغول")}</option>
              <option value="maintenance">{t("صيانة")}</option>
              <option value="broken">{t("معطل")}</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold small">{t("ملاحظات")}</label>
            <textarea className="form-control" value={form.notes}
              onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>
            {busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ")}
          </button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>
            {t("إلغاء")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function SeatsPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/seats/");
  const [labs, setLabs] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  const [f, setF] = usePersistentState("seats-filters", { q: "", status: "", lab: "" });

  useEffect(() => {
    computerLabApi.list().then((d) => setLabs(d)).catch(() => {});
  }, []);

  const shown = items.filter((s) =>
    (!f.q.trim() || s.seat_number.includes(f.q.trim())) &&
    (!f.status || s.status === f.status) &&
    (!f.lab || s.lab === f.lab)
  ).sort((a, b) => a.seat_number.localeCompare(b.seat_number, "ar"));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("المقاعد")}</h3>
          <p className="text-secondary mb-0">{t("إدارة المقاعد داخل مختبرات الكمبيوتر.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>
          + {t("مقعد جديد")}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon="" title={t("لا مقاعد بعد")}
          hint={t("أضف أول مقعد لهذا المختبر.")}
          actionLabel={"+ " + t("مقعد جديد")} onAction={() => setModal({})} />
      ) : (
        <div className="mt-4">
          <FilterBar search={f.q}
            onSearch={(v) => setF((x) => ({ ...x, q: v }))}
            count={shown.length}
            onReset={() => setF({ q: "", status: "", lab: "" })}>
            <div className="form-check form-check-inline mb-0">
              <select className="form-select form-select-sm" value={f.lab}
                onChange={(e) => setF((x) => ({ ...x, lab: e.target.value }))}>
                <option value="">{t("كل المختبرات")}</option>
                {labs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="form-check form-check-inline mb-0">
              <select className="form-select form-select-sm" value={f.status}
                onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
                <option value="">{t("كل الحالات")}</option>
                <option value="available">{t("متوفر")}</option>
                <option value="occupied">{t("مشغول")}</option>
                <option value="maintenance">{t("صيانة")}</option>
                <option value="broken">{t("معطل")}</option>
              </select>
            </div>
          </FilterBar>
          <div className="row g-3">
            {shown.map((seat) => {
              const lab = labs.find((l) => l.id === seat.lab);
              return (
                <div key={seat.id} className="col-12 col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h5 className="fw-bold mb-1">{seat.seat_number}</h5>
                          <span className="badge bg-secondary text-small">{lab ? lab.name : "—"}</span>
                        </div>
                        <span className={`badge ${
                          seat.status === "available" ? "bg-success" :
                          seat.status === "occupied" ? "bg-warning text-dark" :
                          seat.status === "broken" ? "bg-danger" : "bg-secondary"
                        }`}>
                          {t(seat.status)}
                        </span>
                      </div>
                      <div className="mb-2">
                        <span className="text-muted small d-block">
                          {t("الصف")}: {seat.row || "—"} · {t("العمود")}: {seat.column}
                        </span>
                        {seat.notes && (
                          <span className="text-muted small d-block">{seat.notes}</span>
                        )}
                      </div>
                      <div className="mt-auto d-flex gap-2">
                        <button className="btn btn-sm btn-outline-secondary rounded-pill flex-1"
                          onClick={() => setModal(seat)}>{t("تعديل")}</button>
                        <button className="btn btn-sm btn-outline-danger rounded-pill flex-1"
                          onClick={() => setConfirm(seat)}>{t("حذف")}</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal !== null && (
        <SeatModal initial={modal} labs={labs} onClose={() => setModal(null)}
          onSubmit={(p) => modal.id ? update(modal.id, p) : create(p)} />
      )}
      {confirm && (
        <ModalShell title={t("حذف المقعد")} onClose={() => setConfirm(null)}
          footerButtons={
            <>
              <button className="btn btn-light rounded-pill px-4" onClick={() => setConfirm(null)}>
                {t("إلغاء")}
              </button>
              <button className="btn btn-danger rounded-pill px-4"
                onClick={() => { remove(confirm.id); setConfirm(null); }}
              >{t("حذف")}</button>
            </>
          }>
          {t("سيُحذف المقعد «")}{confirm.seat_number}{t("」 من مختبره.")}
        </ModalShell>
      )}
    </>
  );
}
