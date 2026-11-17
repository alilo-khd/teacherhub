import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadFile, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";
import GradebookSyncModal from "../components/GradebookSyncModal";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const averageOf = (row) => {
  const values = [row.continuous, row.supervised, row.exam];
  if (values.some((v) => v === "" || v === null || v === undefined || Number.isNaN(Number(v)))) return null;
  return Math.round(((Number(row.continuous) + Number(row.supervised) + Number(row.exam) * 2) / 4) * 100) / 100;
};

export default function GradebookPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [term, setTerm] = useState(1);
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showSync, setShowSync] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api("/classes/").then(listOf).then((rows) => {
      setClasses(rows);
      setClassId((current) => current ?? rows[0]?.id ?? null);
    }).catch((error) => toast(error.message, "danger"));
  }, [toast]);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const payload = await api(`/classes/${classId}/gradebook/?term=${term}`);
      setData(payload);
      setRows(payload.rows.map((row) => ({
        ...row,
        continuous: row.continuous ?? "", supervised: row.supervised ?? "", exam: row.exam ?? "",
      })));
      setDirty(false);
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [classId, term, toast]);
  useEffect(() => { load(); }, [load]);

  const setCell = (index, key, value) => {
    setRows((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = await api(`/classes/${classId}/gradebook/save/`, {
        method: "POST",
        body: { term, rows: rows.map((row) => ({ student_id: row.student_id, continuous: row.continuous, supervised: row.supervised, exam: row.exam })) },
      });
      setData(payload);
      setRows(payload.rows.map((row) => ({ ...row, continuous: row.continuous ?? "", supervised: row.supervised ?? "", exam: row.exam ?? "" })));
      setDirty(false);
      toast(`${t("حُفظت النقاط")} • ${payload.saved} ${t("سجل نقاط")}`);
    } catch (error) { toast(error.message, "danger"); }
    setSaving(false);
  };

  const exportCsv = async () => {
    try { await downloadFile(`/classes/${classId}/gradebook/export/?term=${term}`, `gradebook-term${term}.csv`); }
    catch (error) { toast(error.message, "danger"); }
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const payload = await api(`/classes/${classId}/gradebook/import/`, { method: "POST", body: { term, csv: text } });
      setData(payload);
      setRows(payload.rows.map((row) => ({ ...row, continuous: row.continuous ?? "", supervised: row.supervised ?? "", exam: row.exam ?? "" })));
      setDirty(false);
      setImportResult(payload);
      toast(`${t("استُوردت")} ${payload.imported} ${t("سجلات نقاط من الملف")}`);
    } catch (error) { toast(error.message, "danger"); }
  };

  const stats = data?.stats;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز إدخال النقاط ودفتر التنقيط")}</h3>
          <p className="text-secondary mb-0">{t("جدول واحد لكل فوج وثلاثي: أدخلوا التقويم المستمر والفروض والاختبار، واحسبوا المعدلات فورًا، واحفظوا الكل بضغطة واحدة — أو استوردوا النقاط من ملف CSV.")}</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <select className="form-select w-auto" value={classId || ""} onChange={(e) => setClassId(Number(e.target.value))}>
            {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
          <select className="form-select w-auto" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
            {TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}
          </select>
        </div>
      </div>

      {stats && (
        <div className="row g-3 mb-4">
          {[[`${stats.graded}/${stats.students}`, "معدلات مكتملة"], [stats.average ?? "—", "معدل الفوج"], [stats.highest ?? "—", "أعلى معدل"], [stats.lowest ?? "—", "أدنى معدل"], [stats.success_rate != null ? `${stats.success_rate}٪` : "—", "نسبة النجاح (≥10)"]].map(([value, label]) => (
            <div className="col-6 col-md-4 col-xl" key={label}><div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>
          ))}
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className="btn btn-primary rounded-pill px-4" disabled={saving || !dirty} onClick={save}>
          {saving ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="check" size={16} /> {t("حفظ كل النقاط")}</>}
        </button>
        <button className="btn btn-light rounded-pill" onClick={exportCsv}><Icon name="download" size={16} /> {t("تصدير CSV")}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="d-none" onChange={onImportFile} />
        <button className="btn btn-light rounded-pill" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> {t("استيراد CSV…")}</button>
        <button className="btn btn-outline-primary rounded-pill" onClick={() => setShowSync(true)}><Icon name="clipboard" size={16} /> {t("استيراد من التقويمات")}</button>
        {dirty && <span className="badge text-bg-warning align-self-center">{t("توجد تعديلات غير محفوظة")}</span>}
      </div>

      {importResult && (
        <div className="alert alert-info">
          {t("استُوردت")} {importResult.imported} {t("سجلات نقاط من الملف")}
          {!!importResult.unmatched.length && <> • {t("أسماء غير مطابقة")}: {importResult.unmatched.join("، ")}</>}
        </div>
      )}

      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <EmptyState title={t("لا تلاميذ في هذا الفوج")} hint={t("أضيفوا التلاميذ أولًا من صفحة التلاميذ والنقاط.")} />
      ) : (
        <div className="card border-0 shadow-sm"><div className="card-body">
          <div className="table-responsive"><table className="table align-middle gradebook-table">
            <thead><tr>
              <th>#</th><th>{t("التلميذ")}</th><th>{t("التقويم المستمر /20")}</th><th>{t("الفروض المحروسة /20")}</th><th>{t("الاختبار /20")}</th><th>{t("معدل الثلاثي")}</th><th>{t("الحالة")}</th>
            </tr></thead>
            <tbody>
              {rows.map((row, index) => {
                const average = averageOf(row);
                const filled = [row.continuous, row.supervised, row.exam].filter((v) => v !== "" && v !== null).length;
                return (
                  <tr key={row.student_id}>
                    <td>{index + 1}</td>
                    <td><button className="btn btn-link p-0 text-decoration-none fw-semibold" onClick={() => navigate(`/students/${row.student_id}`)}>{row.student_name}</button></td>
                    {["continuous", "supervised", "exam"].map((key) => (
                      <td key={key}>
                        <input type="number" min="0" max="20" step="0.25" className="form-control gradebook-input"
                          value={row[key]} onChange={(e) => setCell(index, key, e.target.value)} placeholder="—" />
                      </td>
                    ))}
                    <td className="fw-bold">{average ?? "—"}</td>
                    <td>{average !== null
                      ? <span className={`badge ${average >= 10 ? "text-bg-success" : "text-bg-danger"}`}>{t("مكتمل")}</span>
                      : filled > 0
                        ? <span className="badge text-bg-warning">{t("ناقص")} ({filled}/3)</span>
                        : <span className="badge text-bg-light border">{t("فارغ")}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <p className="small text-secondary mb-0">{t("معدل الثلاثي = (التقويم المستمر + الفروض المحروسة + الاختبار × 2) ÷ 4. إفراغ الحقول الثلاثة لتلميذ يحذف سجل نقاطه عند الحفظ.")}</p>
        </div></div>
      )}
      {showSync && <GradebookSyncModal initialClass={classId || ""} initialTerm={term} onClose={() => setShowSync(false)} onApplied={() => load()} />}
    </>
  );
}
