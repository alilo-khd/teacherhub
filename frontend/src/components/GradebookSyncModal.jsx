import { useCallback, useEffect, useState } from "react";
import { api, assessmentApi, listOf } from "../api";
import { Spinner } from "./States";
import { ModalShell } from "./Modals";
import { useToast } from "./Toast";
import { useLang } from "../i18n";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const COMPONENTS = [["continuous", "تقويم مستمر"], ["supervised", "فرض محروس"], ["exam", "اختبار"]];
const ACTION_LABEL = { fill: "يُملأ", replace: "يُستبدل", same: "متطابق", no_data: "لا نتائج" };
const ACTION_BADGE = { fill: "text-bg-success", replace: "text-bg-warning", same: "text-bg-light border", no_data: "text-bg-light border" };

/** Preview assessment-derived component marks, moderate, and apply them to the official gradebook. */
export default function GradebookSyncModal({ initialClass = "", initialTerm = 1, initialComponent = "supervised", onClose, onApplied }) {
  const { t, te } = useLang();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(initialClass ? String(initialClass) : "");
  const [term, setTerm] = useState(initialTerm || 1);
  const [component, setComponent] = useState(initialComponent || "supervised");
  const [preview, setPreview] = useState(null);
  const [mode, setMode] = useState("fill");
  const [included, setIncluded] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/classes/").then(listOf).then((rows) => {
      setClasses(rows);
      setClassId((current) => current || (rows[0] ? String(rows[0].id) : ""));
    }).catch((error) => toast(error.message, "danger"));
  }, [toast]);

  const loadPreview = useCallback(async () => {
    if (!classId) { setPreview(null); return; }
    setLoading(true);
    try {
      const data = await assessmentApi.syncPreview(classId, term, component);
      setPreview(data);
      setIncluded(data.rows.filter((row) => row.computed !== null && row.action !== "same").map((row) => row.student_id));
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [classId, term, component, toast]);
  useEffect(() => { loadPreview(); }, [loadPreview]);

  const toggle = (studentId) => setIncluded((current) => current.includes(studentId) ? current.filter((x) => x !== studentId) : [...current, studentId]);

  const apply = async () => {
    setBusy(true);
    try {
      const data = await assessmentApi.syncApply({ class_id: Number(classId), term, component, mode, student_ids: included });
      toast(`${t("طُبّقت المزامنة")}: ${data.updated} ${t("تلميذ")} • ${t("تُخطّي")} ${data.skipped_existing + data.skipped_same + data.skipped_no_data}`);
      setPreview(data);
      setIncluded(data.rows.filter((row) => row.computed !== null && row.action !== "same").map((row) => row.student_id));
      if (onApplied) onApplied(data);
    } catch (error) { toast(error.message, "danger"); }
    setBusy(false);
  };

  const applicable = preview ? preview.rows.filter((row) => included.includes(row.student_id) && row.computed !== null && row.action !== "same" && (mode === "overwrite" || row.action === "fill")) : [];

  return (
    <ModalShell title={t("مزامنة دفتر التنقيط من التقويمات")} onClose={onClose} wide>
      <p className="text-secondary small">{t("تُحسب نقطة المكوّن لكل تلميذ من متوسط نسب نتائجه في التقويمات المصحَّحة من النوع المقابل (محوّلة إلى /20). راجعوا المعاينة، استبعدوا من تشاؤون، ثم طبّقوا — لا يتغير دفتر التنقيط قبل التأكيد.")}</p>
      <div className="row g-2 align-items-end mb-3">
        <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الفوج")}</label><select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)}>{classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}</select></div>
        <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("الثلاثي")}</label><select className="form-select" value={term} onChange={(e) => setTerm(Number(e.target.value))}>{TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select></div>
        <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("مكوّن دفتر التنقيط")}</label><select className="form-select" value={component} onChange={(e) => setComponent(e.target.value)}>{COMPONENTS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}</select></div>
        <div className="col-6 col-md-3"><label className="form-label small fw-semibold">{t("عند وجود نقطة رسمية")}</label><select className="form-select" value={mode} onChange={(e) => setMode(e.target.value)}><option value="fill">{t("املأ الفارغ فقط")}</option><option value="overwrite">{t("استبدل بالمحسوبة")}</option></select></div>
      </div>

      {loading || !preview ? <Spinner /> : (
        <>
          {preview.assessments.length === 0 ? (
            <div className="alert alert-warning">{t("لا تقويمات مصحَّحة من هذا النوع لهذا الفوج والثلاثي بعد — سجّلوا النتائج في مركز التقويمات أولًا.")}</div>
          ) : (
            <>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {preview.assessments.map((item) => <span key={item.id} className="badge rounded-pill text-bg-light border">{item.title} • {item.date}{item.gradebook_synced_at ? ` • ${t("مُزامَن")}` : ""}</span>)}
              </div>
              <div className="table-responsive assessment-results-wrap">
                <table className="table table-sm align-middle exam-table mb-0">
                  <thead><tr><th style={{ width: 34 }}></th><th>{t("التلميذ")}</th><th>{t("الرسمية الحالية")}</th><th>{t("المحسوبة من التقويمات")}</th><th>{t("المصادر")}</th><th>{t("الإجراء")}</th></tr></thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.student_id} className={row.computed === null ? "text-secondary" : ""}>
                        <td><input type="checkbox" className="form-check-input" disabled={row.computed === null || row.action === "same"} checked={included.includes(row.student_id)} onChange={() => toggle(row.student_id)} /></td>
                        <td className="fw-semibold">{row.student_name}</td>
                        <td>{row.current === null || row.current === undefined ? "—" : row.current}</td>
                        <td>{row.computed === null || row.computed === undefined ? "—" : <b>{row.computed}</b>}</td>
                        <td className="small">{row.sources.map((s) => `${s.title}: ${s.score_20}`).join("، ") || "—"}</td>
                        <td><span className={`badge rounded-pill ${ACTION_BADGE[row.action]}`}>{te(ACTION_LABEL[row.action])}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                <button className="btn btn-primary rounded-pill px-4" disabled={busy || !applicable.length} onClick={apply}>{busy ? <span className="spinner-border spinner-border-sm" /> : `${t("تطبيق المزامنة")} (${applicable.length})`}</button>
                <span className="small text-secondary">{preview.summary.will_fill} {t("يُملأ")} • {preview.summary.will_replace} {t("يُستبدل")} • {preview.summary.same} {t("متطابق")} • {preview.summary.no_data} {t("لا نتائج")}</span>
                <button type="button" className="btn btn-light rounded-pill px-4 ms-auto" onClick={onClose}>{t("إغلاق")}</button>
              </div>
            </>
          )}
        </>
      )}
    </ModalShell>
  );
}
