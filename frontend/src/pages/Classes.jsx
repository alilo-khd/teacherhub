import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, downloadPdf, listOf } from "../api";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

// backend convention: 0=الأحد … 6=السبت
const WEEKDAYS = [["0", "الأحد"], ["1", "الاثنين"], ["2", "الثلاثاء"], ["3", "الأربعاء"], ["4", "الخميس"], ["5", "الجمعة"], ["6", "السبت"]];

function ClassModal({ initial, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [form, setForm] = useState({ name: "", level: "أولى ثانوي ج م ع", students_count: 32 });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initial?.id) setForm({ name: initial.name || "", level: initial.level || "", students_count: initial.students_count ?? 0 });
  }, [initial]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ModalShell title={initial?.id ? t("تعديل الفوج") : t("فوج جديد")} onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await onSubmit({ ...form, students_count: Number(form.students_count || 0) }); onClose(); } catch { setBusy(false); } }}>
        <div className="row g-3">
          <div className="col-12"><label className="form-label fw-semibold small">{t("اسم الفوج *")}</label>
            <input className="form-control" value={form.name} required onChange={(e) => set("name", e.target.value)} placeholder={t("مثال: 1 ج م ع 1")} /></div>
          <div className="col-12 col-md-8"><label className="form-label fw-semibold small">{t("المستوى")}</label>
            <input className="form-control" value={form.level} onChange={(e) => set("level", e.target.value)} /></div>
          <div className="col-12 col-md-4"><label className="form-label fw-semibold small">{t("عدد التلاميذ")}</label>
            <input type="number" className="form-control" min={0} value={form.students_count} onChange={(e) => set("students_count", e.target.value)} /></div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>{busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ")}</button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function SlotModal({ cls, onClose, onDone }) {
  const { t, te } = useLang();
  const [form, setForm] = useState({ weekday: "1", start_time: "08:00", room: "مخبر الإعلام الآلي" });
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => api(`/timetable/?school_class=${cls.id}`).then((d) => setSlots(listOf(d))).catch(() => {});
  useEffect(() => { load(); }, [cls.id]);

  const add = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api("/timetable/", { method: "POST", body: { ...form, school_class: cls.id, weekday: Number(form.weekday) } });
      await load(); onDone();
    } finally { setBusy(false); }
  };
  const del = async (id) => { await api(`/timetable/${id}/`, { method: "DELETE" }); await load(); onDone(); };

  return (
    <ModalShell title={` استعمال زمن ${cls.name}`} onClose={onClose}>
      {slots.length === 0
        ? <p className="text-secondary small">{t("لا مواعيد بعد — أضف أول موعد أسبوعي.")}</p>
        : slots.map((s) => (
          <div key={s.id} className="d-flex justify-content-between align-items-center border rounded-3 px-3 py-2 mb-2">
            <span> {s.weekday_name} <b>{String(s.start_time).slice(0, 5)}</b> • {s.room}</span>
            <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => del(s.id)}>{t("حذف")}</button>
          </div>))}
      <form onSubmit={add} className="row g-2 mt-2">
        <div className="col-5">
          <select className="form-select" value={form.weekday} onChange={(e) => set("weekday", e.target.value)}>
            {WEEKDAYS.map(([v, l]) => <option key={v} value={v}>{te(l)}</option>)}
          </select>
        </div>
        <div className="col-3"><input type="time" className="form-control" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} /></div>
        <div className="col-4"><input className="form-control" placeholder={t("القاعة")} value={form.room} onChange={(e) => set("room", e.target.value)} /></div>
        <div className="col-12"><button className="btn btn-primary rounded-pill w-100" disabled={busy}>+ {t("إضافة موعد أسبوعي")}</button></div>
      </form>
    </ModalShell>
  );
}

export default function ClassesPage() {
  const { t, te } = useLang();
  const { items, loading, error, create, update, remove, load } = useResource("/classes/");
  const [courses, setCourses] = useState([]);
  const [modal, setModal] = useState(null);
  const [slotCls, setSlotCls] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api("/courses/").then((d) => setCourses(listOf(d))).catch(() => {});
  }, []);

  const [f, setF] = usePersistentState("classes-filters", { q: "", sort: "name", lagging: false });
  const [printSettings] = usePersistentState("print-settings", { orientation: "portrait" });
  const shownClasses = items.filter((c) =>
    (!f.q.trim() || c.name.includes(f.q.trim())) &&
    (!f.lagging || (c.progress?.percent ?? 0) < 50)
  ).sort((a, b) =>
    f.sort === "progressDesc" ? (b.progress?.percent ?? 0) - (a.progress?.percent ?? 0)
    : f.sort === "progressAsc" ? (a.progress?.percent ?? 0) - (b.progress?.percent ?? 0)
    : f.sort === "students" ? (b.students_count ?? 0) - (a.students_count ?? 0)
    : a.name.localeCompare(b.name, "ar"));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("الأقسام ومحاذاة المقرر")}</h3>
          <p className="text-secondary mb-0">{t("مصفوفة حيّة: ما أُدرّس لكل فوج، ما تبقّى، والدرس التالي المقترح.")}</p>
        </div>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>+ {t("فوج جديد")}</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="" title={t("لا أفواج بعد")} hint={t("أنشئ أول فوج مع استعمال زمنه الأسبوعي لتبدأ المحاذاة.")}
          actionLabel={"+ " + t("فوج جديد")} onAction={() => setModal({})} />
      ) : (<>
      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shownClasses.length}
        sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
        onReset={() => setF({ q: "", sort: "name", lagging: false })}
        sortOptions={[["name", "الاسم (أ-ي)"], ["progressDesc", "التقدّم (الأعلى)"], ["progressAsc", "التقدّم (الأدنى)"], ["students", "عدد التلاميذ"]]}>
        <div className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" id="lagSw" checked={f.lagging}
            onChange={(e) => setF((x) => ({ ...x, lagging: e.target.checked }))} />
          <label className="form-check-label small fw-semibold" htmlFor="lagSw">{t("المتأخرون فقط (<50٪)")}</label>
        </div>
      </FilterBar>
      {shownClasses.map((cls) => {
        const doneIds = new Set(cls.progress?.done_course_ids || []);
        const next = cls.progress?.next_course;
        return (
          <div key={cls.id} className="card border-0 shadow-sm mb-4 class-card">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <div>
                  <h5 className="fw-bold mb-0"> {cls.name}</h5>
                  <span className="text-secondary small">{cls.level} • {cls.students_count} {t("تلميذًا")}</span>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  {next && <Link to={`/sessions?cls=${cls.id}`} className="btn btn-sm btn-primary rounded-pill">{t("سجّل الدرس التالي:")} {next.title}</Link>}
<Link to={`/analytics?class=${cls.id}`} className="btn btn-sm btn-outline-dark rounded-pill">{t("تحليلات الفوج")}</Link>
                  <button className="btn btn-sm btn-outline-success rounded-pill"
                    onClick={() => downloadPdf(`/exports/class-report/${cls.id}/${printSettings.orientation === "landscape" ? "?orientation=landscape" : ""}`, `تقرير ${cls.name}.pdf`).then(() => toast("تم تنزيل تقرير التقدّم PDF")).catch((e) => toast(e.message, "danger"))}>
                     {t("تقرير PDF")}
                  </button>
                  <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => setSlotCls(cls)}> {t("استعمال الزمن")}</button>
                  <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(cls)}>{t("تعديل")}</button>
                  <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(cls)}>{t("حذف")}</button>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 mt-3">
                <div className="progress flex-grow-1" style={{ height: 12 }}>
                  <div className="progress-bar bg-success" style={{ width: `${cls.progress?.percent ?? 0}%` }} />
                </div>
                <span className="small fw-bold">{cls.progress?.done_count}/{cls.progress?.total_courses} • {cls.progress?.percent}%</span>
              </div>

              <div className="d-flex flex-wrap gap-1 mt-3">
                {(cls.slots || []).map((t) => (
                  <span key={t.id} className="badge rounded-pill text-bg-light border"> {t.weekday_name} {String(t.start_time).slice(0, 5)} • {t.room}</span>
                ))}
                {(!cls.slots || cls.slots.length === 0) && <span className="text-secondary small">{t("لا مواعيد في استعمال الزمن بعد")}</span>}
              </div>

              <div className="matrix-grid mt-3">
                {courses.map((c) => (
                  <span key={c.id} className={`matrix-cell ${doneIds.has(c.id) ? "done" : next?.id === c.id ? "next" : ""}`}>
                    {doneIds.has(c.id) ? "✓ " : next?.id === c.id ? " " : ""}{c.order}. {c.title}
                  </span>
                ))}
              </div>
              <div className="small text-secondary mt-2">✓ الأخضر = أُدرّس • المميّز = الدرس التالي المقترح • آخر {t("حصة:")} {cls.progress?.last_session ? `${cls.progress.last_session.date}${cls.progress.last_session.course_title ? ` (${cls.progress.last_session.course_title})` : ""}` : "—"}</div>
            </div>
          </div>
        );
      })}

      </>)}
      {modal !== null && <ClassModal initial={modal} onClose={() => setModal(null)}
        onSubmit={(p) => (modal.id ? update(modal.id, p) : create(p))} />}
      {slotCls && <SlotModal cls={slotCls} onClose={() => setSlotCls(null)} onDone={() => { load(); toast("تم تحديث استعمال الزمن"); }} />}
      {confirm && <ConfirmModal title={t("حذف الفوج")} body={`سيُحذف فوج «${confirm.name}» ومواعيده وحصصه.`}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </>
  );
}
