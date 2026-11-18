import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";
import {
  gradeCalcApi,
  schoolApi,
  academicYearApi,
  enrollmentApi,
} from "../api/v2";

function RuleSetModal({ initial, onSubmit, onClose }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: "", school: "", subject: "", academic_year: "", term: "",
    version: 1, is_active: true, is_approved: false,
    formula_config: { component_weights: { continuous: 0.3, supervised: 0.3, exam: 0.4 }, rounding: 2, pass_threshold: 50 },
    component_max: { continuous: 20, supervised: 20, exam: 20 },
    effective_from: "", effective_to: "",
  });
  const [busy, setBusy] = useState(false);
  const [schools, setSchools] = useState([]);
  const [years, setYears] = useState([]);
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    Promise.all([
      schoolApi.list().then((d) => setSchools(d)),
      academicYearApi.list().then((d) => setYears(d)),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    if (initial?.id) {
      setForm({
        name: initial.name || "", school: initial.school || "",
        subject: initial.subject || "", academic_year: initial.academic_year || "",
        term: initial.term || "", version: initial.version || 1,
        is_active: initial.is_active !== undefined ? initial.is_active : true,
        is_approved: initial.is_approved !== undefined ? initial.is_approved : false,
        formula_config: initial.formula_config || form.formula_config,
        component_max: initial.component_max || form.component_max,
        effective_from: initial.effective_from || "",
        effective_to: initial.effective_to || "",
      });
    } else {
      setForm({
        name: "", school: "", subject: "", academic_year: "", term: "",
        version: 1, is_active: true, is_approved: false,
        formula_config: { component_weights: { continuous: 0.3, supervised: 0.3, exam: 0.4 }, rounding: 2, pass_threshold: 50 },
        component_max: { continuous: 20, supervised: 20, exam: 20 },
        effective_from: "", effective_to: "",
      });
    }
  }, [initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (section, key, val) =>
    setForm((f) => ({
      ...f,
      [section]: { ...f[section], [key]: val },
    }));

  return (
    <ModalShell
      title={initial?.id ? t("تعديل مجموعة قواعد الحساب") : t("مجموعة قواعد حساب جديدة")}
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
            <label className="form-label fw-semibold small">{t("اسم مجموعة القواعد *")}</label>
            <input
              className="form-control"
              value={form.name}
              required
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("مثال: المتوسط المستمر والفروض المحروسة - الثلاثي الأول")}
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">{t("المدرسة *")}</label>
            <select
              className="form-select"
              value={form.school}
              required
              onChange={(e) => set("school", e.target.value)}
            >
              <option value="">{t("اختر مدرسة…")}</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("السنة الدراسية *")}</label>
            <select
              className="form-select"
              value={form.academic_year}
              required
              onChange={(e) => set("academic_year", e.target.value)}
            >
              <option value="">{t("اختر السنة…")}</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("الثلاثي *")}</label>
            <select
              className="form-select"
              value={String(form.term || "")}
              onChange={(e) => set("term", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("جميع الفصول (افتراضي)")}</option>
              <option value="1">{t("الثلاثي الأول")}</option>
              <option value="2">{t("الثلاثي الثاني")}</option>
              <option value="3">{t("الثلاثي الثالث")}</option>
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("تاريخ السريان من")}</label>
            <input
              type="date"
              className="form-control"
              value={form.effective_from}
              onChange={(e) => set("effective_from", e.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("تاريخ السريان حتى")}</label>
            <input
              type="date"
              className="form-control"
              value={form.effective_to}
              onChange={(e) => set("effective_to", e.target.value)}
            />
          </div>
        </div>

        <div className="card bg-light mt-4 p-3">
          <h6 className="fw-bold mb-3">{t("أوزان المكونات")}</h6>
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold small">{t("التقويم المستمر")}</label>
              <input
                type="number"
                className="form-control"
                min={0}
                max={1}
                step={0.05}
                value={form.formula_config.component_weights.continuous || 0}
                onChange={(e) =>
                  setNested("formula_config", "component_weights", {
                    ...form.formula_config.component_weights,
                    continuous: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold small">{t("الفروض المحروسة")}</label>
              <input
                type="number"
                className="form-control"
                min={0}
                max={1}
                step={0.05}
                value={form.formula_config.component_weights.supervised || 0}
                onChange={(e) =>
                  setNested("formula_config", "component_weights", {
                    ...form.formula_config.component_weights,
                    supervised: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold small">{t("الاختبار")}</label>
              <input
                type="number"
                className="form-control"
                min={0}
                max={1}
                step={0.05}
                value={form.formula_config.component_weights.exam || 0}
                onChange={(e) =>
                  setNested("formula_config", "component_weights", {
                    ...form.formula_config.component_weights,
                    exam: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <div className="row g-3 mt-2">
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold small">{t("تقريب الأرقام (أرقام عشريّة)")}</label>
              <input
                type="number"
                className="form-control"
                min={0}
                max={4}
                value={form.formula_config.rounding || 2}
                onChange={(e) =>
                  setNested("formula_config", "rounding", Number(e.target.value) || 2)
                }
              />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label fw-semibold small">{t("حد النجاح (٪)")}</label>
              <input
                type="number"
                className="form-control"
                min={0}
                max={100}
                value={form.formula_config.pass_threshold || 50}
                onChange={(e) =>
                  setNested("formula_config", "pass_threshold", Number(e.target.value) || 50)
                }
              />
            </div>
          </div>
          <div className="form-check mt-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="isApproved"
              checked={form.is_approved}
              onChange={(e) => set("is_approved", e.target.checked)}
            />
            <label className="form-check-label" htmlFor="isApproved">
              {t("معتمد")}{" "}
              <span className="text-danger small">{t("يجب الاعتماد قبل الاستخدام في الحسابات الرسمية")}</span>
            </label>
          </div>
          <div className="form-check mt-1">
            <input
              className="form-check-input"
              type="checkbox"
              id="isActive"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            <label className="form-check-label" htmlFor="isActive">
              {t("مفعّلة")}
            </label>
          </div>
        </div>

        <div className="d-flex gap-2 mt-4">
          <button
            className="btn btn-primary rounded-pill px-4"
            disabled={busy}
          >
            {busy ? (
              <span className="spinner-border spinner-border-sm" />
            ) : t("حفظ")}
          </button>
          <button
            type="button"
            className="btn btn-light rounded-pill px-4"
            onClick={onClose}
          >
            {t("إلغاء")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function GradebookCalculationPage() {
  const { t } = useLang();
  const { items, loading, error, create, update, remove, load } =
    useResource("/grade-rule-sets/");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [calcView, setCalcView] = useState(null);
  const toast = useToast();

  const [f, setF] = usePersistentState("gradecalc-filters", { q: "", status: "" });

  const shown = items.filter(
    (r) =>
      (!f.q.trim() || r.name.includes(f.q.trim())) &&
      (!f.status ||
        (f.status === "approved" ? r.is_approved : f.status === "active" ? r.is_active : true))
  ).sort((a, b) => (b.version || 0) - (a.version || 0));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("محرك حساب التقديرات (v2)")}</h3>
          <p className="text-secondary mb-0">
            {t("قواعد حساب قابلة للتكوين وإصدارها — لا تُكتب الصيغ في واجهة المستخدم.")}
          </p>
        </div>
        <button
          className="btn btn-primary rounded-pill px-4"
          onClick={() => setModal({})}
        >
          + {t("قاعدة حساب جديدة")}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon=""
          title={t("لا قواعد حساب بعد")}
          hint={t("أضف أول مجموعة قواعد لحساب التقديرات.")}
          actionLabel={"+ " + t("قاعدة حساب جديدة")}
          onAction={() => setModal({})}
        />
      ) : (
        <>
          <FilterBar
            search={f.q}
            onSearch={(v) => setF((x) => ({ ...x, q: v }))}
            count={shown.length}
            onReset={() => setF({ q: "", status: "" })}
          >
            <div className="form-check form-check-inline mb-0">
              <select
                className="form-select form-select-sm"
                value={f.status}
                onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}
              >
                <option value="">{t("كل الحالات")}</option>
                <option value="active">{t("مفعّلة")}</option>
                <option value="approved">{t("معتمدة")}</option>
              </select>
            </div>
          </FilterBar>
          {shown.map((rs) => (
            <div
              key={rs.id}
              className="card border-0 shadow-sm mb-3 rule-card"
            >
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                  <div>
                    <h5 className="fw-bold mb-1">{rs.name}</h5>
                    <span className="badge bg-secondary text-white">
                      v{rs.version}
                    </span>{" "}
                    <span className={`badge ${rs.is_approved ? "bg-success" : "bg-warning text-dark"}`}>
                      {rs.is_approved ? t("معتمدة") : t("لم تُعتمد")}
                    </span>{" "}
                    <span className={`badge ${rs.is_active ? "bg-info text-dark" : "bg-secondary"}`}>
                      {rs.is_active ? t("مفعّلة") : t("موقوفة")}
                    </span>
                    <div className="mt-2">
                      <span className="text-muted small d-block">
                        {t("الأوزان:")} continuous {rs.formula_config?.component_weights?.continuous}, supervised {rs.formula_config?.component_weights?.supervised}, exam {rs.formula_config?.component_weights?.exam}
                      </span>
                      <span className="text-muted small d-block">
                        {t("الحد الأدنى للنجاح:")} {rs.formula_config?.pass_threshold}٪
                      </span>
                    </div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-sm btn-outline-secondary rounded-pill"
                      onClick={() => setModal(rs)}
                    >
                      {t("تعديل")}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-primary rounded-pill"
                      onClick={() => setCalcView(rs)}
                    >
                      {t("حساب التقديرات")}
                    </button>
                    {!rs.is_approved && (
                      <button
                        className="btn btn-sm btn-outline-success rounded-pill"
                        onClick={() =>
                          update(rs.id, { ...rs, is_approved: true })
                        }
                      >
                        {t("اعتماد")}
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-outline-danger rounded-pill"
                      onClick={() => setConfirm(rs)}
                    >
                      {t("حذف")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {modal !== null && (
        <RuleSetModal
          initial={modal}
          onClose={() => setModal(null)}
          onSubmit={(p) =>
            modal.id ? update(modal.id, p) : create(p)
          }
        />
      )}
      {confirm && (
        <ModalShell
          title={t("حذف مجموعة القواعد")}
          onClose={() => setConfirm(null)}
          footerButtons={
            <>
              <button
                className="btn btn-light rounded-pill px-4"
                onClick={() => setConfirm(null)}
              >
                {t("إلغاء")}
              </button>
              <button
                className="btn btn-danger rounded-pill px-4"
                onClick={() => {
                  remove(confirm.id);
                  setConfirm(null);
                }}
              >
                {t("حذف")}
              </button>
            </>
          }
        >
          {t("سيُحذف «")}{confirm.name}{t("」 وكل نتائج الحساب المرتبطة بها.")}
        </ModalShell>
      )}

      {calcView && (
        <CalculationView
          ruleset={calcView}
          onClose={() => setCalcView(null)}
          onRefresh={() => load()}
        />
      )}
    </>
  );
}

function CalculationView({ ruleset, onClose, onRefresh }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [rejectResultId, setRejectResultId] = useState(null);
  const [rejectComment, setRejectComment] = useState("");
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      schoolApi.list().then((d) => setClasses(d)),
    ]).catch(() => {});
  }, []);

  const handleCalculate = async () => {
    if (!selectedClass) {
      toast(t("اختر فصلاً أولاً"), "danger");
      return;
    }
    setBusy(true);
    try {
      const data = await gradeCalcApi.calculateRuleSet(ruleset.id, {
        school_class_id: selectedClass,
        term: ruleset.term || 1,
      });
      setResults(data.results || []);
      toast(t("تم حساب التقديرات لعدد ") + (data.results?.length || 0) + t(" تلميذ"));
      onRefresh();
    } catch (e) {
      toast(e.message || t("فشل الحساب"), "danger");
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedStudent || !selectedClass) {
      toast(t("اختر تلميذاً وفصلاً"), "danger");
      return;
    }
    setBusy(true);
    try {
      const data = await gradeCalcApi.previewRuleSet(ruleset.id, {
        student_id: selectedStudent,
        school_class_id: selectedClass,
        term: ruleset.term || 1,
      });
      setPreview(data);
    } catch (e) {
      toast(e.message || t("فشل المعاينة"), "danger");
    } finally {
      setBusy(false);
    }
  };

  const handleWorkflow = async (action, resultId, comment = "") => {
    setBusy(true);
    try {
      let res;
      switch (action) {
        case "submit":
          res = await gradeCalcApi.submitResult(resultId);
          break;
        case "approve":
          res = await gradeCalcApi.approveResult(resultId, { comment });
          break;
        case "reject":
          res = await gradeCalcApi.rejectResult(resultId, { comment });
          break;
        case "publish":
          res = await gradeCalcApi.publishResult(resultId);
          break;
        case "void":
          res = await gradeCalcApi.voidResult(resultId, { comment });
          break;
      }
      if (res && res.status) {
        toast(
          {
            submitted: t("تم الإرسال للمراجعة"),
            approved: t("تم اعتماد النتيجة"),
            rejected: t("تم رفض النتيجة"),
            published: t("تم نشر النتيجة"),
            voided: t("تم إلغاء النتيجة"),
          }[action] || t("تم التحديث"),
          "success"
        );
        setResults(
          results.map((r) =>
            r.id === resultId ? { ...r, status: res.status } : r
          )
        );
        if (action === "reject") {
          setRejectResultId(null);
          setRejectComment("");
        }
      }
    } catch (e) {
      toast(e.message || t("فشل التحديث"), "danger");
    } finally {
      setBusy(false);
    }
  };

  const statusConfig = {
    calculated: { label: t("محسوب"), color: "bg-info text-dark", actions: ["submit"] },
    submitted: { label: t("مقدم للمراجعة"), color: "bg-warning text-dark", actions: ["approve", "reject"] },
    approved: { label: t("معتمد من المراجع"), color: "bg-success", actions: ["publish", "void"] },
    rejected: { label: t("مرفوض"), color: "bg-danger", actions: ["void"] },
    published: { label: t("منشور"), color: "bg-success", actions: ["void"] },
    voided: { label: t("ملغي"), color: "bg-secondary", actions: [] },
  };

  return (
    <ModalShell
      title={t("حساب التقديرات — ") + ruleset.name}
      onClose={onClose}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card p-3">
            <h6 className="fw-bold mb-3">{t("تشغيل الحساب للفصل")}</h6>
            <div className="mb-3">
              <label className="form-label fw-semibold small">{t("الفصل *")}</label>
              <select
                className="form-select"
                value={selectedClass || ""}
                onChange={(e) => setSelectedClass(e.target.value || null)}
              >
                <option value="">{t("اختر فصلاً…")}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary rounded-pill w-100"
              disabled={busy || !selectedClass}
              onClick={handleCalculate}
            >
              {busy ? (
                <span className="spinner-border spinner-border-sm" />
              ) : t("حساب التقديرات لجميع التلاميذ")}
            </button>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card p-3">
            <h6 className="fw-bold mb-3">{t("معاينة حساب تلميذ")}</h6>
            <div className="mb-3">
              <label className="form-label fw-semibold small">{t("التلميذ *")}</label>
              <select
                className="form-select"
                value={selectedStudent || ""}
                onChange={(e) => setSelectedStudent(e.target.value || null)}
              >
                <option value="">{t("اختر تلميذاً…")}</option>
              </select>
            </div>
            <button
              className="btn btn-outline-primary rounded-pill w-100"
              disabled={busy || !selectedStudent || !selectedClass}
              onClick={handlePreview}
            >
              {busy ? (
                <span className="spinner-border spinner-border-sm" />
              ) : t("معاينة الحساب")}
            </button>
          </div>
          {preview && (
            <div className="card mt-3 p-3">
              <h6 className="fw-bold mb-3">{t("نتيجة المعاينة")}</h6>
              <div className="row g-3">
                <div className="col-12 col-md-4">
                  <div className="text-center p-3 bg-light rounded">
                    <div className="h2 fw-bold text-primary">
                      {preview.calculated_value ?? "—"}
                    </div>
                    <div className="text-muted small">{t("من 20")}</div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="text-center p-3 bg-light rounded">
                    <div className="h2 fw-bold text-success">
                      {preview.calculated_percent ?? "—"}٪
                    </div>
                    <div className="text-muted small">{t("النسبة المئوية")}</div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="text-center p-3 bg-light rounded">
                    <div className={`h2 fw-bold ${preview.calculation_breakdown?.passed ? "text-success" : "text-danger"}`}>
                      {preview.calculation_breakdown?.passed ? t("ناجح") : t("راسب")}
                    </div>
                    <div className="text-muted small">{t("حد النجاح: ") + preview.calculation_breakdown?.pass_threshold + "٪"}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <h7 className="fw-bold small">{t("تفاصيل الحساب")}</h7>
                <table className="table table-sm table-bordered mt-2">
                  <thead>
                    <tr>
                      <th>{t("المكون")}</th>
                      <th>{t("النسبة (%)")}</th>
                      <th>{t("الوزن")}</th>
                      <th>{t("المساهمة")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(preview.calculation_breakdown?.components || {}).map(
                      ([key, comp]) => (
                        <tr key={key}>
                          <td>{key}</td>
                          <td>{comp.percent ?? "—"}</td>
                          <td>{comp.weight}</td>
                          <td>
                            {comp.percent != null &&
                              (comp.percent * comp.weight).toFixed(2)}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      {results.length > 0 && results.map((r) => {
        const cfg = statusConfig[r.status] || statusConfig.calculated;
        const pendingAction = rejectResultId === r.id;
        return (
          <div key={r.id} className="mt-3 card p-3 border-start border-4">
            <h6 className="fw-bold mb-2">{r.student_name}</h6>
            <div className="row g-2 mb-2">
              <div className="col-6">
                <span className="badge bg-info text-dark">{t("القيمة")}: {r.calculated_value}</span>
              </div>
              <div className="col-6">
                <span className="badge bg-secondary">{t("النسبة (%)")}: {r.calculated_percent ?? "—"}</span>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2 align-items-start">
              <span className={`badge ${cfg.color}`}>{cfg.label}</span>
              {cfg.actions.map((act) => (
                <button
                  key={act}
                  className="btn btn-sm btn-outline-primary rounded-pill"
                  disabled={busy || pendingAction}
                  onClick={() =>
                    act === "reject" ? setRejectResultId(r.id) : handleWorkflow(act, r.id)
                  }
                >
                  {pendingAction && act === "reject" ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : act === "reject" ? (
                    t("رفض النتيجة")
                  ) : act === "approve" ? (
                    t("اعتماد النتيجة")
                  ) : act === "publish" ? (
                    t("نشر النتيجة")
                  ) : act === "submit" ? (
                    t("إرسال للمراجعة")
                  ) : t("إلغاء النتيجة")}
                </button>
              ))}
              {pendingAction && (
                <button
                  className="btn btn-sm btn-outline-secondary rounded-pill"
                  onClick={() => setRejectResultId(null)}
                >
                  {t("إلغاء")}
                </button>
              )}
            </div>
            {r.review_comment && (
              <div className="mt-2">
                <span className="text-muted small">
                  {t("أضف تعليقاً للمراجع")}: {r.review_comment}
                </span>
              </div>
            )}
            <span className="text-muted small ms-2 mt-1 d-block">{r.calculated_at}</span>
          </div>
        );
      })}
      {rejectResultId && (
        <ModalShell
          title={t("رفض النتيجة")}
          onClose={() => setRejectResultId(null)}
          footerButtons={
            <>
              <button
                className="btn btn-light rounded-pill px-4"
                onClick={() => setRejectResultId(null)}
              >
                {t("إلغاء")}
              </button>
              <button
                className="btn btn-danger rounded-pill px-4"
                disabled={busy || !rejectComment.trim()}
                onClick={() => {
                  handleWorkflow("reject", rejectResultId, rejectComment);
                  setRejectResultId(null);
                  setRejectComment("");
                }}
              >
                {busy ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : t("تأكيد الرفض")}
              </button>
            </>
          }
        >
          {t("سبب الرفض مطلوب")}
          <textarea
            className="form-control mt-2"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            placeholder={t("أضف تعليقاً للمراجع")}
          />
        </ModalShell>
      )}
    </ModalShell>
  );
}

CalculationView.propTypes = {};
