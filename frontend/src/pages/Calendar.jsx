import { useState } from "react";
import { useResource, usePersistentState } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ResourceFormModal } from "../components/Modals";
import FilterBar from "../components/FilterBar";
import { useLang } from "../i18n";

const HOLIDAY_FIELDS = [
  { name: "name", label: "اسم العطلة / المناسبة", required: true, wide: true },
  { name: "start_date", label: "من تاريخ", type: "date", required: true },
  { name: "end_date", label: "إلى تاريخ", type: "date", required: true },
  { name: "kind", label: "النوع", type: "select", options: ["عطلة مدرسية", "يوم وطني", "مناسبة دينية"] },
];
const SEMINAR_FIELDS = [
  { name: "title", label: "عنوان الندوة / اليوم التكويني", required: true, wide: true },
  { name: "date", label: "التاريخ", type: "date", required: true },
  { name: "kind", label: "النوع", type: "select", options: ["ندوة", "يوم تكويني", "ملتقى", "يوم دراسي"] },
  { name: "place", label: "المكان" },
  { name: "organizer", label: "الجهة المنظمة" },
  { name: "notes", label: "ملاحظات", type: "textarea", wide: true },
];

export default function CalendarPage() {
  const { t, te } = useLang();
  const holidays = useResource("/holidays/");
  const seminars = useResource("/seminars/");
  const [hModal, setHModal] = useState(null);
  const [sModal, setSModal] = useState(null);
  const [confirm, setConfirm] = useState(null); // {type, item}

  const [cf, setCf] = usePersistentState("calendar-filters", { q: "", sort: "dateAsc", upcoming: false });
  const vis = (x) => !cf.upcoming || String(x.start_date || x.date) >= new Date().toISOString().slice(0, 10);
  const hShown = holidays.items.filter((h) => vis(h) && (!cf.q.trim() || h.name.includes(cf.q.trim())))
    .sort((a, b) => cf.sort === "dateDesc" ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date));
  const sShown = seminars.items.filter((x) => vis(x) && (!cf.q.trim() || x.title.includes(cf.q.trim())))
    .sort((a, b) => cf.sort === "dateDesc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

  return (
    <>
      <div className="mb-4">
        <h3 className="fw-bold mb-1"> {t("العطل والندوات — أجندة السنة الدراسية")}</h3>
        <p className="text-secondary mb-0">{t("كل ما يُطبع في دفاترك: العطل المدرسية والمناسبات، والندوات والملتقيات والأيام التكوينية.")}</p>
      </div>

      <FilterBar search={cf.q} onSearch={(v) => setCf((x) => ({ ...x, q: v }))} count={hShown.length + sShown.length}
        sort={cf.sort} onSort={(v) => setCf((x) => ({ ...x, sort: v }))}
        onReset={() => setCf({ q: "", sort: "dateAsc", upcoming: false })}
        sortOptions={[["dateAsc", "التاريخ (الأقدم)"], ["dateDesc", "التاريخ (الأحدث)"]]}>
        <div className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" id="upSw" checked={cf.upcoming}
            onChange={(e) => setCf((x) => ({ ...x, upcoming: e.target.checked }))} />
          <label className="form-check-label small fw-semibold" htmlFor="upSw">{t("القادمة فقط")}</label>
        </div>
      </FilterBar>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0"> {t("العطل والمناسبات")}</h5>
        <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => setHModal({ kind: "عطلة مدرسية" })}>+ {t("عطلة")}</button>
      </div>
      {holidays.error && <div className="alert alert-danger">{holidays.error}</div>}
      {holidays.loading ? <Spinner /> : holidays.items.length === 0 ? (
        <EmptyState icon="" title={t("لا عطل مسجلة")} hint={t("أضف عطل السنة الدراسية وستظهر في دفاترك المطبوعة تلقائيًا.")}
          actionLabel={t("إضافة عطلة")} onAction={() => setHModal({ kind: "عطلة مدرسية" })} />
      ) : (
        <div className="card border-0 shadow-sm mb-5">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>{t("المناسبة")}</th><th>{t("من")}</th><th>{t("إلى")}</th><th>{t("المدة")}</th><th>{t("النوع")}</th><th></th></tr></thead>
              <tbody>
                {hShown.map((h) => (
                  <tr key={h.id} className={h._temp ? "is-temp" : ""}>
                    <td className="fw-semibold">{h.name}</td><td>{h.start_date}</td><td>{h.end_date}</td>
                    <td><span className="badge rounded-pill text-bg-light border">{h.days} {t("يوم")}</span></td>
                    <td>{h.kind}</td>
                    <td className="text-nowrap">
                      <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setHModal(h)}>{t("تعديل")}</button>{" "}
                      <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm({ type: "h", item: h })}>{t("حذف")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0"> {t("الندوات والملتقيات والتكوين")}</h5>
        <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => setSModal({ kind: "يوم تكويني" })}>+ {t("نشاط")}</button>
      </div>
      {seminars.loading ? <Spinner /> : seminars.items.length === 0 ? (
        <EmptyState icon="" title={t("لا ندوات مسجلة")} hint={t("سجّل الندوات والأيام التكوينية التي تحضرها طوال السنة.")}
          actionLabel={t("إضافة نشاط")} onAction={() => setSModal({ kind: "يوم تكويني" })} />
      ) : (
        <div className="row g-3">
          {sShown.map((s) => (
            <div className="col-12 col-md-6 col-xl-4" key={s.id}>
              <div className={`card border-0 shadow-sm h-100 resource-card ${s._temp ? "is-temp" : ""}`}>
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between">
                    <span className="badge rounded-pill text-bg-primary">{s.kind}</span>
                    <span className="small text-secondary">{s.date}</span>
                  </div>
                  <h6 className="fw-bold mt-2">{s.title}</h6>
                  <p className="text-secondary small flex-grow-1">{s.place}{s.organizer ? ` • ${s.organizer}` : ""}</p>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setSModal(s)}>{t("تعديل")}</button>
                    <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm({ type: "s", item: s })}>{t("حذف")}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hModal !== null && (
        <ResourceFormModal title={hModal.id ? t("تعديل العطلة") : t("عطلة / مناسبة جديدة")} fields={HOLIDAY_FIELDS}
          initial={hModal} onSubmit={(p) => (hModal.id ? holidays.update(hModal.id, p) : holidays.create(p))}
          onClose={() => setHModal(null)} />
      )}
      {sModal !== null && (
        <ResourceFormModal title={sModal.id ? t("تعديل النشاط") : t("نشاط تكويني جديد")} fields={SEMINAR_FIELDS}
          initial={sModal} onSubmit={(p) => (sModal.id ? seminars.update(sModal.id, p) : seminars.create(p))}
          onClose={() => setSModal(null)} />
      )}
      {confirm && (
        <ConfirmModal title={t("حذف العنصر")} body={`سيُحذف «${confirm.item.name || confirm.item.title}» نهائيًا.`}
          onConfirm={() => (confirm.type === "h" ? holidays.remove(confirm.item.id) : seminars.remove(confirm.item.id))}
          onClose={() => setConfirm(null)} />
      )}
    </>
  );
}
