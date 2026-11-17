import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const CHECK_STATUS = { ok: ["مكتمل", "text-bg-success"], warning: ["تنبيه", "text-bg-warning"], missing: ["ناقص", "text-bg-danger"] };

export default function BackupPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importPayload, setImportPayload] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState({});
  const [yearLabel, setYearLabel] = useState("2026 / 2027");
  const [copyStudents, setCopyStudents] = useState(true);
  const [copySlots, setCopySlots] = useState(true);
  const [rolloverResult, setRolloverResult] = useState(null);
  const [rolling, setRolling] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setInfo(await api("/backup/info/")); }
    catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const exportBackup = async () => {
    setExporting(true);
    try {
      const data = await api("/backup/export/");
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `teacherhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast(`${t("نُسخت")} ${data.records} ${t("سجلًا في ملف النسخة الاحتياطية")}`);
    } catch (error) { toast(error.message, "danger"); }
    setExporting(false);
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.format !== "teacherhub-backup" || !Array.isArray(parsed.data)) throw new Error("invalid");
      setImportPayload(parsed);
    } catch { toast(t("ملف نسخة احتياطية غير صالح"), "danger"); }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const result = await api("/backup/import/", { method: "POST", body: importPayload });
      toast(`${t("استُوردت")} ${result.imported} ${t("سجلًا بنجاح")}`);
      setImportPayload(null);
      await load();
    } catch (error) { toast(error.message, "danger"); }
    setImporting(false);
  };

  const runRollover = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    if (!ids.length) { toast(t("اختر فوجًا واحدًا على الأقل"), "danger"); return; }
    if (!yearLabel.trim()) { toast(t("اكتب تسمية السنة الجديدة"), "danger"); return; }
    setRolling(true); setRolloverResult(null);
    try {
      const result = await api("/backup/rollover/", { method: "POST", body: { class_ids: ids, year_label: yearLabel.trim(), copy_students: copyStudents, copy_slots: copySlots } });
      setRolloverResult(result);
      toast(`${t("أُنشئ")} ${result.created_count} ${t("فوج للسنة الجديدة")}`);
      await load();
    } catch (error) { toast(error.message, "danger"); }
    setRolling(false);
  };

  if (loading && !info) return <Spinner />;
  if (!info) return null;
  const countEntries = Object.entries(info.counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز النسخ الاحتياطي والأرشفة والانتقال")}</h3>
          <p className="text-secondary mb-0">{t("احموا عمل سنة كاملة: نسخة احتياطية كاملة بضغطة واحدة، فحص لسلامة البيانات، وانتقال منظم بأفواجكم وقوائم تلاميذكم إلى السنة الدراسية الجديدة.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill" disabled={exporting} onClick={exportBackup}>
          {exporting ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="download" size={16} /> {t("تنزيل نسخة احتياطية كاملة")}</>}
        </button>
      </div>

      <div className="row g-3 mb-4">
        {[[info.total_records, "سجل محفوظ في المنصة"], [info.database_size_bytes ? `${(info.database_size_bytes / 1024).toFixed(0)} KB` : "—", "حجم قاعدة البيانات"], [info.classes.length, "الأفواج الحالية"], [`${info.backup_format} v${info.backup_version}`, "صيغة النسخة الاحتياطية"]].map(([value, label]) => (
          <div className="col-6 col-xl-3" key={label}><div className="stat-mini"><div className="stat-mini-num">{value}</div><div className="stat-mini-label">{t(label)}</div></div></div>
        ))}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm h-100"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("محتويات المنصة")}</h6>
            {countEntries.map(([key, value]) => (
              <div key={key} className="d-flex justify-content-between py-1 border-bottom">
                <span>{key}</span><span className="badge text-bg-light border">{value}</span>
              </div>
            ))}
            <h6 className="fw-bold mt-4 mb-2">{t("استيراد نسخة احتياطية")}</h6>
            <p className="small text-secondary">{t("الاستيراد يستعيد السجلات بمعرفاتها الأصلية داخل هذه المنصة نفسها. يُنصح بتنزيل نسخة حالية أولًا قبل أي استيراد.")}</p>
            <input ref={fileRef} type="file" accept="application/json,.json" className="d-none" onChange={onFile} />
            <button className="btn btn-light rounded-pill" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} /> {t("اختيار ملف نسخة احتياطية…")}</button>
          </div></div>
        </div>
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm h-100"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("فحص سلامة البيانات")}</h6>
            {info.checks.map((row) => {
              const [label, badge] = CHECK_STATUS[row.status] || CHECK_STATUS.warning;
              return (
                <div key={row.key} className="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom">
                  <span className={`badge ${badge}`}>{te(label)}</span>
                  <span className="fw-semibold">{te(row.label)}</span>
                  <span className="badge text-bg-light border">{row.value}</span>
                  <span className="text-secondary small flex-grow-1">{row.detail}</span>
                  {row.status !== "ok" && <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(row.route)}>{t("معالجة")}</button>}
                </div>
              );
            })}
          </div></div>
        </div>
      </div>

      <div className="card border-0 shadow-sm"><div className="card-body">
        <h6 className="fw-bold mb-1">{t("الانتقال إلى سنة دراسية جديدة")}</h6>
        <p className="text-secondary small">{t("يُنشئ نسخة من الأفواج المختارة باسم السنة الجديدة، مع نسخ جدول التوقيت الأسبوعي وقوائم التلاميذ (دون النقاط والسجلات، لتبدأ السنة الجديدة نظيفة). الأفواج الحالية تبقى كما هي أرشيفًا.")}</p>
        <div className="mb-3">
          {info.classes.map((cls) => (
            <label key={cls.id} className="form-check d-flex align-items-center gap-2 py-1">
              <input type="checkbox" className="form-check-input" checked={!!selected[cls.id]} onChange={(e) => setSelected((x) => ({ ...x, [cls.id]: e.target.checked }))} />
              <span className="form-check-label fw-semibold">{cls.name}</span>
              <span className="small text-secondary">{cls.students} {t("تلميذ")} • {cls.slots} {t("حصص أسبوعية")}</span>
            </label>
          ))}
        </div>
        <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
          <span className="d-flex align-items-center gap-2"><label className="small text-secondary">{t("تسمية السنة الجديدة")}</label>
            <input className="form-control backup-year" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} placeholder="2026 / 2027" /></span>
          <label className="form-check"><input type="checkbox" className="form-check-input" checked={copyStudents} onChange={(e) => setCopyStudents(e.target.checked)} /><span className="form-check-label">{t("نسخ قوائم التلاميذ")}</span></label>
          <label className="form-check"><input type="checkbox" className="form-check-input" checked={copySlots} onChange={(e) => setCopySlots(e.target.checked)} /><span className="form-check-label">{t("نسخ جدول التوقيت")}</span></label>
        </div>
        <button className="btn btn-primary rounded-pill px-4" disabled={rolling} onClick={runRollover}>
          {rolling ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="plus" size={16} /> {t("إنشاء أفواج السنة الجديدة")}</>}
        </button>
        {rolloverResult && (
          <div className="mt-3">
            {rolloverResult.created.map((row) => (
              <div key={row.id} className="d-flex flex-wrap gap-2 align-items-center py-1">
                <span className="badge text-bg-success">{t("أُنشئ")}</span><span>{row.name}</span>
                <span className="small text-secondary">{row.students_copied} {t("تلميذ منسوخ")} • {row.slots_copied} {t("حصص")}</span>
              </div>
            ))}
            {rolloverResult.skipped.map((row, i) => (
              <div key={i} className="d-flex flex-wrap gap-2 align-items-center py-1 text-secondary">
                <span className="badge text-bg-secondary">{t("تُخطّي")}</span><span>{row.name || row.class_id}</span><span className="small">{row.reason}</span>
              </div>
            ))}
            {!!rolloverResult.created.length && <button className="btn btn-light rounded-pill mt-2" onClick={() => navigate("/classes")}>{t("فتح الأقسام والتقدم")}</button>}
          </div>
        )}
      </div></div>

      {importPayload && (
        <div className="card border-warning shadow-sm mt-4"><div className="card-body">
          <h6 className="fw-bold">{t("تأكيد استيراد النسخة الاحتياطية")}</h6>
          <p className="text-secondary">{t("سيتم استيراد")} {importPayload.data.length} {t("سجلًا من ملف نسخة احتياطية")} ({importPayload.exported_at?.slice(0, 10) || "—"}). {t("قد تُحدَّث سجلات موجودة بنفس المعرفات. هل تريدون المتابعة؟")}</p>
          <div className="d-flex gap-2">
            <button className="btn btn-warning rounded-pill px-4" disabled={importing} onClick={runImport}>{importing ? <span className="spinner-border spinner-border-sm" /> : t("استيراد الآن")}</button>
            <button className="btn btn-light rounded-pill px-4" disabled={importing} onClick={() => setImportPayload(null)}>{t("إلغاء")}</button>
          </div>
        </div></div>
      )}
    </>
  );
}
