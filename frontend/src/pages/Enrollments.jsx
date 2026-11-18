import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { api, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

function EnrollmentModal({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({ student: "", school: "", academic_year: "", class_section: "", campus: "", start_date: "", end_date: "", status: "active" });
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);

  useEffect(() => {
    Promise.all([
      api("/students/").then((d) => setStudents(listOf(d))),
      api("/classes/").then((d) => setClasses(listOf(d))),
      api("/academic-years/").then((d) => setYears(listOf(d))),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    if (initial?.id) setForm({ student: initial.student, school: initial.school, academic_year: initial.academic_year, class_section: initial.class_section, campus: initial.campus || "", start_date: initial.start_date || "", end_date: initial.end_date || "", status: initial.status || "active" });
  }, [initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell title={initial?.id ? t("تعديل التسجيل") : t("تسجيل جديد")} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit(form); onClose(); } catch { setBusy(false); } }}>
        <div className="row g-3">
          <div className="col-12 col-md-4"><label className="form-label fw-semibold small">{t("التلميذ *")}</label>
            <select className="form-select" value={form.student} required onChange={(e) => set("student", e.target.value)}>
              <option value="">{t("اختر تلميذاً…")}</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("السنة الدراسية *")}</label>
            <select className="form-select" value={form.academic_year} required onChange={(e) => set("academic_year", e.target.value)}>
              <option value="">{t("اختر السنة…")}</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("الفصل *")}</label>
            <select className="form-select" value={form.class_section} required onChange={(e) => set("class_section", e.target.value)}>
              <option value="">{t("اختر الفصل…")}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="col-12 col-md-2"><label className="form-label fw-semibold small">{t("تاريخ البداية *")}</label>
            <input type="date" className="form-control" value={form.start_date} required onChange={(e) => set("start_date", e.target.value)} /></div>
          <div className="col-12 col-md-2"><label className="form-label fw-semibold small">{t("تاريخ النهاية")}</label>
            <input type="date" className="form-control" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
          <div className="col-12 col-md-3"><label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">نشط</option>
              <option value="completed">مكتمل</option>
              <option value="transferred">منقول</option>
              <option value="withdrawn">منسحب</option>
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

export default function EnrollmentsPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/enrollments/");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  const [f, setF] = usePersistentState("enrollments-filters", { q: "", status: "" });

  const shown = items.filter((e) =>
    (!f.q.trim() || (e.student_name || "").includes(f.q.trim()) || (e.class_name || "").includes(f.q.trim())) &&
    (!f.status || e.status === f.status)
  ).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("التسجيلات والفصول")}</h3>
          <p className="text-secondary mb-0">{t("ربط التلاميذ بالفصول والسواحل للسنة الدراسية.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>+ {t("تسجيل جديد")}</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا تسجيلات بعد")} hint={t("سجّل التلاميذ في الفصول للسنة الدراسية الحالية.")}
          actionLabel={"+ " + t("تسجيل جديد")} onAction={() => setModal({})} />
      ) : (
      <div className="mt-4">
      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shown.length}
        onReset={() => setF({ q: "", status: "" })}>
        <div className="form-check form-check-inline mb-0">
          <select className="form-select form-select-sm" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
            <option value="">{t("كل الحالات")}</option>
            <option value="active">{t("نشط")}</option>
            <option value="completed">{t("مكتمل")}</option>
            <option value="transferred">{t("منقول")}</option>
            <option value="withdrawn">{t("منسحب")}</option>
          </select>
        </div>
      </FilterBar>
      {shown.map((enr) => (
        <div key={enr.id} className="card border-0 shadow-sm mb-3 enr-card">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0"> {enr.student_name || t("تلميذ")}</h5>
                <span className="badge bg-secondary text-white">{enr.class_name || t("فصل")}</span>
                <span className="text-secondary small mt-1 d-block">{enr.academic_year_name || t("سنة")} • {t(enr.status)}</span>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge rounded-pill text-bg-light border">{enr.campus || "—"}</span>
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(enr)}>{t("تعديل")}</button>
                <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(enr)}>{t("حذف")}</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {modal !== null && <EnrollmentModal initial={modal} onClose={() => setModal(null)}
        onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))} />}
      {confirm && <ConfirmModal title={t("حذف التسجيل")} body={`سيُحذف ربط «${enr ? enr.student_name : ""}» بالفصل.`}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </div>)}
    </>
  );
}
