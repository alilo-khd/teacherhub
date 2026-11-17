import { useEffect, useState } from "react";
import { api, downloadPdf, listOf } from "../api";
import { useResource, usePersistentState } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ResourceFormModal } from "../components/Modals";
import FilterBar from "../components/FilterBar";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";

const INST_FIELDS = [
  { name: "name", label: "اسم المؤسسة", required: true, wide: true },
  { name: "kind", label: "النوع", type: "select", options: ["ثانوية", "متوسطة", "ابتدائية", "معهد", "أخرى"] },
  { name: "commune", label: "البلدية" },
  { name: "district", label: "مقاطعة التفتيش" },
  { name: "director", label: "المدير(ة)" },
  { name: "phone", label: "الهاتف" },
  { name: "teachers_count", label: "عدد الأساتذة", type: "number" },
  { name: "notes", label: "ملاحظات", type: "textarea", wide: true },
];
const VISIT_FIELDS_BASE = [
  { name: "date", label: "تاريخ الزيارة", type: "date", required: true },
  { name: "visit_type", label: "نوع الزيارة", type: "select", options: ["زيارة تفتيشية", "زيارة متابعة", "مرافقة تكوينية", "زيارة إدارية"] },
  { name: "teacher_visited", label: "الأستاذ(ة) المُزار" },
  { name: "subject", label: "المادة", default: "الإعلام الآلي" },
  { name: "observations", label: "الملاحظات", type: "textarea", wide: true },
  { name: "recommendations", label: "التوصيات", type: "textarea", wide: true },
];
const OBS_FIELDS_BASE = [
  { name: "date", label: "التاريخ", type: "date", required: true },
  { name: "teacher_name", label: "الأستاذ(ة) المُزار" },
  { name: "class_name", label: "القسم" },
  {
    name: "criteria", label: "عناصر الشبكة — سطر لكل عنصر: العنصر | العلامة القصوى | العلامة المحققة",
    type: "textarea", wide: true,
    placeholder: "إعداد الدرس وتخطيطه | 4 | 3",
    serialize: (v) => String(v || "").split("\n").map((x) => x.trim()).filter(Boolean).map((line) => {
      const [label, max, score] = line.split("|").map((s) => (s || "").trim());
      return { label, max: Number(max || 4), score: score === "" || score == null ? null : Number(score) };
    }),
    deserialize: (v) => (Array.isArray(v) ? v.map((c) => `${c.label} | ${c.max} | ${c.score ?? ""}`).join("\n") : ""),
  },
  { name: "appreciation", label: "التقدير العام", type: "select", options: ["", "ممتاز", "جيد جدًا", "جيد", "مقبول", "يحتاج تحسين"] },
  { name: "strengths", label: "نقاط القوة", type: "textarea", wide: true },
  { name: "improvements", label: "نقاط للتحسين", type: "textarea", wide: true },
];

export default function InspectionPage() {
  const { t, te } = useLang();
  const insts = useResource("/institutions/");
  const visits = useResource("/visits/");
  const obs = useResource("/observations/");
  const [courses, setCourses] = useState([]);
  const [iModal, setIModal] = useState(null);
  const [vModal, setVModal] = useState(null);
  const [oModal, setOModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [tab, setTab] = useState("institutions");
  const toast = useToast();

  useEffect(() => { api("/courses/").then((d) => setCourses(listOf(d))).catch(() => {}); }, []);

  const instOptions = [["", "— بدون مؤسسة —"], ...insts.items.map((i) => [String(i.id), i.name])];
  const visitFields = [...VISIT_FIELDS_BASE, { name: "institution", label: "المؤسسة", type: "select-id", options: instOptions }];
  const obsFields = [...OBS_FIELDS_BASE,
    { name: "institution", label: "المؤسسة", type: "select-id", options: instOptions },
    { name: "course", label: "الدرس الملاحَظ", type: "select-id", options: [["", "— بدون درس —"], ...courses.map((c) => [String(c.id), c.title])] }];

  const [inf, setInf] = usePersistentState("inspection-filters", { q: "", sort: "-date", min: "" });
  const [instF, setInstF] = usePersistentState("institution-filters", { q: "", kind: "", sort: "name" });
  const iShown = insts.items.filter((i) =>
    (!instF.q.trim() || i.name.includes(instF.q.trim()) || (i.commune || "").includes(instF.q.trim()) || (i.director || "").includes(instF.q.trim())) &&
    (!instF.kind || i.kind === instF.kind)
  ).sort((a, b) => instF.sort === "visits" ? (b.visits_count || 0) - (a.visits_count || 0)
    : instF.sort === "teachers" ? (b.teachers_count || 0) - (a.teachers_count || 0)
    : a.name.localeCompare(b.name, "ar"));
  const instKinds = [...new Set(insts.items.map((i) => i.kind).filter(Boolean))];
  const vShown = visits.items.filter((v) => !inf.q.trim() ||
    (v.institution_name || "").includes(inf.q.trim()) || (v.teacher_visited || "").includes(inf.q.trim()))
    .sort((a, b) => inf.sort === "date" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  const oShown = obs.items.filter((o) => (!inf.q.trim() || (o.teacher_name || "").includes(inf.q.trim())) &&
    (!inf.min || Number(o.percent) >= Number(inf.min)))
    .sort((a, b) => inf.sort === "percent" ? b.percent - a.percent : inf.sort === "date" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));

  const del = () => {
    if (confirm.kind === "i") return insts.remove(confirm.item.id);
    if (confirm.kind === "v") return visits.remove(confirm.item.id);
    return obs.remove(confirm.item.id);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("التفتيش والمتابعة")}</h3>
          <p className="text-secondary mb-0">{t("مؤسسات المقاطعة، سجلّ الزيارات، وشبكات ملاحظة الحصص — دفتر المفتش كاملًا داخل المنصة.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4"
          onClick={() => downloadPdf(`/exports/inspector/?order=${inf.sort === "date" ? "oldest" : "newest"}`, "دفتر المفتش.pdf").then(() => toast(t("تم تنزيل دفتر المفتش PDF"))).catch((e) => toast(e.message, "danger"))}>
           {t("دفتر المفتش PDF")}
        </button>
      </div>

      <div className="btn-group mb-4" role="group">
        {[["institutions", "", "المؤسسات"], ["visits", "", "الزيارات"], ["observations", "", "شبكات الملاحظة"]].map(([k, ic, l]) => (
          <button key={k} className={`btn ${tab === k ? "btn-dark" : "btn-outline-dark"}`} onClick={() => setTab(k)}>{ic} {t(l)}</button>
        ))}
      </div>

      {tab === "institutions" && (
        <>
          <FilterBar search={instF.q} onSearch={(v) => setInstF((x) => ({ ...x, q: v }))} count={iShown.length}
            sort={instF.sort} onSort={(v) => setInstF((x) => ({ ...x, sort: v }))}
            onReset={() => setInstF({ q: "", kind: "", sort: "name" })}
            sortOptions={[["name", "الاسم (أ-ي)"], ["visits", "عدد الزيارات (الأعلى)"], ["teachers", "عدد الأساتذة (الأعلى)"]]}>
            <select className="form-select" value={instF.kind} onChange={(e) => setInstF((x) => ({ ...x, kind: e.target.value }))}>
              <option value="">{t("الكل")}</option>
              {instKinds.map((k) => <option key={k} value={k}>{te(k)}</option>)}
            </select>
            <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => setIModal({ kind: "ثانوية" })}>+ {t("مؤسسة")}</button>
          </FilterBar>
          {insts.loading ? <Spinner /> : insts.items.length === 0 ? (
            <EmptyState icon="" title={t("لا مؤسسات بعد")} hint={t("أضف مؤسسات مقاطعة التفتيش لتظهر في دفتر المفتش وسجل المتابعة.")}
              actionLabel={t("مؤسسة")} onAction={() => setIModal({ kind: "ثانوية" })} />
          ) : (
            <div className="row g-3">
              {iShown.map((i) => (
                <div className="col-12 col-md-6 col-xl-4" key={i.id}>
                  <div className="card border-0 shadow-sm h-100 resource-card">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between">
                        <span className="badge rounded-pill text-bg-primary">{i.kind}</span>
                        <span className="badge rounded-pill text-bg-light border"> {i.visits_count} {t("زيارة")}</span>
                      </div>
                      <h6 className="fw-bold mt-2">{i.name}</h6>
                      <p className="text-secondary small flex-grow-1">
                        {i.commune} • {i.district}<br />{t("المدير:")} {i.director || "—"} • {i.teachers_count} {t("أستاذًا")}
                      </p>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setIModal(i)}>{t("تعديل")}</button>
                        <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm({ kind: "i", item: i })}>{t("حذف")}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "visits" && (
        <>
          <FilterBar search={inf.q} onSearch={(v) => setInf((x) => ({ ...x, q: v }))} count={vShown.length}
            sort={inf.sort} onSort={(v) => setInf((x) => ({ ...x, sort: v }))}
            onReset={() => setInf({ q: "", sort: "-date", min: "" })}
            sortOptions={[["-date", "التاريخ (الأحدث)"], ["date", "التاريخ (الأقدم)"]]}>
            <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => setVModal({ visit_type: "زيارة تفتيشية" })}>+ {t("زيارة")}</button>
          </FilterBar>
          {visits.loading ? <Spinner /> : visits.items.length === 0 ? (
            <EmptyState icon="" title={t("لا زيارات مسجلة")} hint={t("سجّل زياراتك التفتيشية والمتابعات وستُبنى عليها شبكات الملاحظة.")}
              actionLabel={t("زيارة")} onAction={() => setVModal({ visit_type: "زيارة تفتيشية" })} />
          ) : (
            <div className="d-flex flex-column gap-3">
              {vShown.map((v) => (
                <div key={v.id} className="card border-0 shadow-sm session-card">
                  <div className="card-body">
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                      <span className="fw-bold"> {v.date}</span>
                      <span className="badge rounded-pill text-bg-primary"> {v.institution_name}</span>
                      <span className="badge rounded-pill text-bg-light border">{v.visit_type}</span>
                      <span className="text-secondary small">{v.teacher_visited} • {v.subject}</span>
                      <span className="flex-grow-1" />
                      <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setVModal(v)}>{t("تعديل")}</button>
                      <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm({ kind: "v", item: v })}>{t("حذف")}</button>
                    </div>
                    {v.observations && <p className="small mt-2 mb-1"> {v.observations}</p>}
                    {v.recommendations && <p className="small mb-0 text-secondary"> {t("التوصيات:")} {v.recommendations}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "observations" && (
        <>
          <FilterBar search={inf.q} onSearch={(v) => setInf((x) => ({ ...x, q: v }))} count={oShown.length}
            sort={inf.sort} onSort={(v) => setInf((x) => ({ ...x, sort: v }))}
            onReset={() => setInf({ q: "", sort: "-date", min: "" })}
            sortOptions={[["-date", "التاريخ (الأحدث)"], ["date", "التاريخ (الأقدم)"], ["percent", "حسب النسبة"]]}>
            <input type="number" min="0" max="100" className="form-control" style={{ width: 110 }}
              placeholder="٪ ≥" value={inf.min} onChange={(e) => setInf((x) => ({ ...x, min: e.target.value }))} />
            <button className="btn btn-sm btn-primary rounded-pill px-3" onClick={() => setOModal({})}>+ {t("شبكة ملاحظة")}</button>
          </FilterBar>
          {obs.loading ? <Spinner /> : obs.items.length === 0 ? (
            <EmptyState icon="" title={t("لا شبكات ملاحظة بعد")} hint={t("أنشئ شبكة ملاحظة حصّة بعناصرها وعلاماتها وستُحسب نسبتها تلقائيًا.")}
              actionLabel={t("شبكة ملاحظة")} onAction={() => setOModal({})} />
          ) : (
            <div className="row g-3">
              {oShown.map((o) => (
                <div className="col-12 col-md-6 col-xl-4" key={o.id}>
                  <div className="card border-0 shadow-sm h-100 resource-card">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start">
                        <h6 className="fw-bold mb-1">{o.teacher_name || t("شبكة ملاحظة")}</h6>
                        <span className={`badge rounded-pill ${o.percent >= 75 ? "text-bg-success" : o.percent >= 50 ? "text-bg-warning" : "text-bg-danger"}`}>{o.percent}٪</span>
                      </div>
                      <p className="text-secondary small flex-grow-1">
                        {o.date} • {o.institution_name}<br />{o.class_name} — {o.course_title || "—"}<br />{t("التقدير:")} {o.appreciation || "—"}
                      </p>
                      <div className="progress mb-3" style={{ height: 8 }}>
                        <div className="progress-bar bg-success" style={{ width: `${o.percent}%` }} />
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-primary rounded-pill flex-grow-1"
                          onClick={() => downloadPdf(`/exports/observation/${o.id}/`, "شبكة ملاحظة.pdf").then(() => toast("تم تنزيل الشبكة PDF")).catch((e) => toast(e.message, "danger"))}>
                           PDF
                        </button>
                        <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setOModal(o)}>{t("تعديل")}</button>
                        <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm({ kind: "o", item: o })}>{t("حذف")}</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {iModal !== null && (
        <ResourceFormModal title={iModal.id ? t("تعديل المؤسسة") : t("مؤسسة جديدة")} fields={INST_FIELDS}
          initial={iModal} onSubmit={(p) => (iModal.id ? insts.update(iModal.id, p) : insts.create(p))}
          onClose={() => setIModal(null)} />
      )}
      {vModal !== null && (
        <ResourceFormModal title={vModal.id ? t("تعديل الزيارة") : t("زيارة جديدة")} fields={visitFields}
          initial={vModal} onSubmit={(p) => (vModal.id ? visits.update(vModal.id, p) : visits.create(p))}
          onClose={() => setVModal(null)} />
      )}
      {oModal !== null && (
        <ResourceFormModal title={oModal.id ? t("تعديل شبكة الملاحظة") : t("شبكة ملاحظة جديدة")} fields={obsFields}
          initial={oModal} onSubmit={(p) => (oModal.id ? obs.update(oModal.id, p) : obs.create(p))}
          onClose={() => setOModal(null)} />
      )}
      {confirm && (
        <ConfirmModal title={t("حذف العنصر")} body={t("سيُحذف هذا العنصر نهائيًا.")}
          onConfirm={del} onClose={() => setConfirm(null)} />
      )}
    </>
  );
}
