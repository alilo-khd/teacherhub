import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";

const FIELDS = [
  ["full_name", "الاسم الكامل"], ["job_title", "الوظيفة"], ["specialty", "التخصص"],
  ["birth_place", "مكان الازدياد"], ["marital_status", "الحالة العائلية"],
  ["current_school", "المؤسسة الحالية"], ["inspection_district", "مقاطعة التفتيش"],
  ["diploma", "الشهادة"], ["echelon", "الدرجة / الصنف"], ["phone", "الهاتف"], ["address", "العنوان", "wide"],
];
const DATES = [["birth_date", "تاريخ الازدياد"], ["hire_date", "تاريخ التوظيف"]];

export default function ProfilePage() {
  const { t, te } = useLang();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { api("/profile/").then(setForm).catch((e) => toast(e.message, "danger")); }, []);
  if (!form) return <Spinner label={t("جارٍ تحميل البطاقة المهنية…")} />;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try { setForm(await api("/profile/", { method: "PUT", body: form })); toast("حُفظت البطاقة — دفاترك المطبوعة محدّثة"); }
    catch (e) { toast(e.message, "danger"); }
    setBusy(false);
  };

  return (
    <>
      <div className="mb-4">
        <h3 className="fw-bold mb-1"> {t("بطاقة الحالة الشخصية والمهنية")}</h3>
        <p className="text-secondary mb-0">{t("هذه البيانات تُطبع تلقائيًا في صدارة الدفتر اليومي ودفتر المفتش وكل تقاريرك.")}</p>
      </div>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3">
            {FIELDS.map(([k, label, w]) => (
              <div className={w ? "col-12" : "col-12 col-md-6"} key={k}>
                <label className="form-label fw-semibold small">{label}</label>
                <input className="form-control" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
            {DATES.map(([k, label]) => (
              <div className="col-12 col-md-6" key={k}>
                <label className="form-label fw-semibold small">{label}</label>
                <input type="date" className="form-control" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
            <div className="col-12">
              <label className="form-label fw-semibold small">{t("ملاحظات")}</label>
              <textarea className="form-control" rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <button className="btn btn-primary rounded-pill px-4" disabled={busy} onClick={save}>
              {busy ? <span className="spinner-border spinner-border-sm" /> : " حفظ البطاقة"}
            </button>
            <Link to="/print" className="btn btn-outline-primary rounded-pill px-4"> {t("الذهاب إلى مركز الطباعة")}</Link>
          </div>
        </div>
      </div>
    </>
  );
}
