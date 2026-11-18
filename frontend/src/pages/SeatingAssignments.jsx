import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";
import { computerLabApi, seatApi } from "../api/v2";

function AssignmentModal({ initial, labs, students, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    student: "", lab: "", seat: "", academic_year: "", term: 1,
  });
  const [seats, setSeats] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) {
      setForm({
        student: initial.student || "", lab: initial.lab || "",
        seat: initial.seat || "", academic_year: initial.academic_year || "",
        term: initial.term || 1,
      });
    } else {
      setForm({ student: "", lab: "", seat: "", academic_year: "", term: 1 });
    }
  }, [initial]);
  useEffect(() => {
    if (form.lab) {
      seatApi.list(`?lab=${form.lab}`).then((d) => setSeats(d)).catch(() => {});
    } else {
      setSeats([]);
    }
  }, [form.lab]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell
      title={initial?.id ? t("تعديل تكليف المقعد") : t("تكليف جديد")}
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
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("التلميذ *")}</label>
            <select className="form-select" value={form.student} required
              onChange={(e) => set("student", e.target.value)}>
              <option value="">{t("اختر تلميذاً…")}</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("المختبر *")}</label>
            <select className="form-select" value={form.lab} required
              onChange={(e) => set("lab", e.target.value)}>
              <option value="">{t("اختر مختبراً…")}</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("المقعد *")}</label>
            <select className="form-select" value={form.seat} required
              onChange={(e) => set("seat", e.target.value)}>
              <option value="">{t("اختر مقعداً…")}</option>
              {seats.map((s) => (
                <option key={s.id} value={s.id}>{s.seat_number}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("السنة الدراسية *")}</label>
            <select className="form-select" value={form.academic_year} required
              onChange={(e) => set("academic_year", e.target.value)}>
              <option value="">{t("اختر السنة…")}</option>
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("الثلاثي")}</label>
            <select className="form-select" value={String(form.term || 1)}
              onChange={(e) => set("term", Number(e.target.value))}>
              <option value="1">{t("الثلاثي الأول")}</option>
              <option value="2">{t("الثلاثي الثاني")}</option>
              <option value="3">{t("الثلاثي الثالث")}</option>
            </select>
          </div>
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

export default function SeatingAssignmentsPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/seating-assignments/");
  const [labs, setLabs] = useState([]);
  const [students, setStudents] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();
  const [f, setF] = usePersistentState("seating-assignments-filters", { q: "", lab: "", term: "" });

  useEffect(() => {
    Promise.all([
      computerLabApi.list().then((d) => setLabs(d)),
    ]).catch(() => {});
  }, []);

  const shown = items.filter((a) =>
    (!f.q.trim() || (a.student_name || "").includes(f.q.trim())) &&
    (!f.lab || a.lab === f.lab) &&
    (!f.term || String(a.term) === f.term)
  ).sort((a, b) => (a.student_name || "").localeCompare(b.student_name || "", "ar"));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("تكليفات المقاعد")}</h3>
          <p className="text-secondary mb-0">{t("تعيين التلاميذ إلى مقاعد محددة في مختبرات الكمبيوتر لكل ثلاثي.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>
          + {t("تكليف جديد")}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState icon="" title={t("لا تكليفات بعد")}
          hint={t("أضف أول تكليف مقعد لطالب.")}
          actionLabel={"+ " + t("تكليف جديد")} onAction={() => setModal({})} />
      ) : (
        <div className="mt-4">
          <FilterBar search={f.q}
            onSearch={(v) => setF((x) => ({ ...x, q: v }))}
            count={shown.length}
            onReset={() => setF({ q: "", lab: "", term: "" })}>
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
              <select className="form-select form-select-sm" value={f.term}
                onChange={(e) => setF((x) => ({ ...x, term: e.target.value }))}>
                <option value="">{t("كل الفصول")}</option>
                <option value="1">{t("الثلاثي الأول")}</option>
                <option value="2">{t("الثلاثي الثاني")}</option>
                <option value="3">{t("الثلاثي الثالث")}</option>
              </select>
            </div>
          </FilterBar>
          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th>{t("التلميذ")}</th>
                  <th>{t("المختبر")}</th>
                  <th>{t("المقعد")}</th>
                  <th>{t("الثلاثي")}</th>
                  <th>{t("مخصص لـ")}</th>
                  <th className="text-end">{t("الإجراءات")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id}>
                    <td>{a.student_name || "—"}</td>
                    <td>{a.lab_name || "—"}</td>
                    <td><span className="badge bg-secondary">{a.seat_number || "—"}</span></td>
                    <td>
                      {a.term === 1 ? t("الثلاثي الأول") : a.term === 2 ? t("الثلاثي الثاني") : t("الثلاثي الثالث")}
                    </td>
                    <td>{a.academic_year_name || "—"}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setModal(a)}>
                        {t("تعديل")}
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setConfirm(a)}>
                        {t("حذف")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal !== null && (
        <AssignmentModal initial={modal} labs={labs} students={students}
          onClose={() => setModal(null)}
          onSubmit={(p) => modal.id ? update(modal.id, p) : create(p)} />
      )}
      {confirm && (
        <ModalShell title={t("حذف تكليف المقعد")} onClose={() => setConfirm(null)}
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
          {t("سيُحذف تكليف المقعد للتلميذ «")}{confirm.student_name}{t("」.")}
        </ModalShell>
      )}
    </>
  );
}
