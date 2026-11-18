import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

function LabModal({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: "", code: "", capacity: 20, room_number: "", status: "active",
    computers_count: 0, operating_system: "", software_list: [], notes: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) {
      setForm({
        name: initial.name || "", code: initial.code || "",
        capacity: initial.capacity || 20, room_number: initial.room_number || "",
        status: initial.status || "active", computers_count: initial.computers_count || 0,
        operating_system: initial.operating_system || "",
        software_list: initial.software_list || [], notes: initial.notes || "",
      });
    } else {
      setForm({
        name: "", code: "", capacity: 20, room_number: "", status: "active",
        computers_count: 0, operating_system: "", software_list: [], notes: "",
      });
    }
  }, [initial]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell
      title={initial?.id ? t("تعديل مختبر الكمبيوتر") : t("مختبر كمبيوتر جديد")}
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
            <label className="form-label fw-semibold small">{t("اسم المختبر *")}</label>
            <input className="form-control" value={form.name} required
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("مثال: مخبر الإعلام الآلي 1")} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">{t("الكود الفريد *")}</label>
            <input className="form-control" value={form.code} required
              onChange={(e) => set("code", e.target.value)} placeholder="lab-1" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("السعة")}</label>
            <input type="number" className="form-control" value={form.capacity || ""}
              onChange={(e) => set("capacity", Number(e.target.value) || 20)} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("رقم الغرفة")}</label>
            <input className="form-control" value={form.room_number}
              onChange={(e) => set("room_number", e.target.value)} placeholder="101" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status}
              onChange={(e) => set("status", e.target.value)}>
              <option value="active">{t("مفعل")}</option>
              <option value="closed">{t("مقفول")}</option>
              <option value="maintenance">{t("صيانة")}</option>
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("عدد الأجهزة")}</label>
            <input type="number" className="form-control" value={form.computers_count || ""}
              onChange={(e) => set("computers_count", Number(e.target.value) || 0)} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("نظام التشغيل")}</label>
            <input className="form-control" value={form.operating_system}
              onChange={(e) => set("operating_system", e.target.value)}
              placeholder="Windows 11" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">{t("قائمة البرامج")}</label>
            <input className="form-control" value={form.software_list.join(", ")}
              onChange={(e) => set("software_list", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="Word, Excel, PowerPoint" />
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

export default function ComputerLabsPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/computer-labs/");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  const [f, setF] = usePersistentState("computer-labs-filters", { q: "", status: "" });

  const shown = items.filter((l) =>
    (!f.q.trim() || l.name.includes(f.q.trim())) &&
    (!f.status || l.status === f.status)
  ).sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مختبرات الكمبيوتر")}</h3>
          <p className="text-secondary mb-0">{t("إدارة مختبرات الحاسوب والمقاعد والتكوينات.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>
          + {t("مختبر كمبيوتر جديد")}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon="" title={t("لا مختبرات بعد")}
          hint={t("أضف أول مختبر لتحديد مواقع المقاعد.")}
          actionLabel={"+ " + t("مختبر كمبيوتر جديد")} onAction={() => setModal({})} />
      ) : (
        <div className="mt-4">
          <FilterBar search={f.q}
            onSearch={(v) => setF((x) => ({ ...x, q: v }))}
            count={shown.length}
            onReset={() => setF({ q: "", status: "" })}>
            <div className="form-check form-check-inline mb-0">
              <select className="form-select form-select-sm" value={f.status}
                onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
                <option value="">{t("كل الحالات")}</option>
                <option value="active">{t("مفعل")}</option>
                <option value="closed">{t("مقفول")}</option>
                <option value="maintenance">{t("صيانة")}</option>
              </select>
            </div>
          </FilterBar>
          <div className="row g-3">
            {shown.map((lab) => (
              <div key={lab.id} className="col-12 col-md-6 col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h5 className="fw-bold mb-1">{lab.name}</h5>
                        <span className="badge bg-secondary text-white">{lab.code}</span>
                      </div>
                      <span className={`badge ${lab.status === "active" ? "bg-success" : lab.status === "closed" ? "bg-danger" : "bg-warning text-dark"}`}>
                        {t(lab.status)}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="text-muted small d-block">
                        {t("السعة")}: {lab.capacity} · {t("عدد الأجهزة")}: {lab.computers_count}
                      </span>
                      {lab.room_number && (
                        <span className="text-muted small d-block">{t("رقم الغرفة")}: {lab.room_number}</span>
                      )}
                      {lab.operating_system && (
                        <span className="text-muted small d-block">{t("نظام التشغيل")}: {lab.operating_system}</span>
                      )}
                    </div>
                    <div className="mt-auto d-flex gap-2">
                      <button className="btn btn-sm btn-outline-secondary rounded-pill flex-1"
                        onClick={() => setModal(lab)}>{t("تعديل")}</button>
                      <button className="btn btn-sm btn-outline-danger rounded-pill flex-1"
                        onClick={() => setConfirm(lab)}>{t("حذف")}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal !== null && (
        <LabModal initial={modal} onClose={() => setModal(null)}
          onSubmit={(p) => modal.id ? update(modal.id, p) : create(p)} />
      )}
      {confirm && (
        <ModalShell title={t("حذف مختبر الكمبيوتر")} onClose={() => setConfirm(null)}
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
          {t("سيُحذف «")}{confirm.name}{t("」 وجميع مقاعده وتكليفاته.")}
        </ModalShell>
      )}
    </>
  );
}

