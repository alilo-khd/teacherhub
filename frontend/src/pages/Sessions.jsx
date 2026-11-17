import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, downloadPdf, listOf } from "../api";
import { useResource, usePersistentState } from "../hooks";
import { EmptyState, SkeletonCards, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { useLang } from "../i18n";

const STATUS = { done: ["منفَّذة", "success"], cancelled: ["ملغاة", "danger"], postponed: ["مؤجلة", "warning"] };
const todayISO = () => new Date().toISOString().slice(0, 10);

function SessionModal({ initial, classes, courses, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [form, setForm] = useState(() => ({
    school_class: initial?.school_class ?? "",
    course: initial?.course ?? "",
    date: initial?.date ?? todayISO(),
    start_time: initial?.start_time?.slice(0, 5) ?? "08:00",
    duration: initial?.duration ?? 60,
    status: initial?.status ?? "done",
    homework: initial?.homework ?? "",
    absentees: initial?.absentees ?? 0,
    board_summary: initial?.board_summary ?? "",
    remarks: initial?.remarks ?? "",
  }));
  const [points, setPoints] = useState(initial?.points_written ?? []);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const course = useMemo(() => courses.find((c) => String(c.id) === String(form.course)), [courses, form.course]);

  // dynamic alignment: choosing a class pre-fills its next suggested course
  const pickClass = (id) => {
    set("school_class", id);
    const cls = classes.find((c) => String(c.id) === String(id));
    if (cls?.progress?.next_course && !initial?.id) {
      set("course", String(cls.progress.next_course.id));
    }
  };
  const pickCourse = (id) => {
    set("course", id);
    const c = courses.find((x) => String(x.id) === String(id));
    if (c && !initial?.id) setPoints(c.key_points.slice(0, 4));
  };

  const togglePoint = (p) =>
    setPoints((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p]));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        school_class: Number(form.school_class),
        course: form.course === "" ? null : Number(form.course),
        duration: Number(form.duration || 60),
        absentees: Number(form.absentees || 0),
        points_written: points,
      });
      onClose();
    } catch { setBusy(false); }
  };

  return (
    <ModalShell title={initial?.id ? t("تعديل الحصة") : t("تسجيل حصة منفَّذة")} wide onClose={onClose}>
      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">{t("القسم / الفوج *")}</label>
            <select className="form-select" value={form.school_class} required
              onChange={(e) => pickClass(e.target.value)}>
              <option value="">— {t("اختر الفوج —")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (أنجز {c.progress?.done_count ?? 0}/{c.progress?.total_courses ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold small">{t("الدرس (من المقرر) — يُقترح التالي تلقائيًا")}</label>
            <select className="form-select" value={form.course} onChange={(e) => pickCourse(e.target.value)}>
              <option value="">— {t("بدون درس محدد —")}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.order}. {c.title}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small">{t("التاريخ *")}</label>
            <input type="date" className="form-control" value={form.date} required
              onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small">{t("وقت البداية")}</label>
            <input type="time" className="form-control" value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small">{t("المدة (د)")}</label>
            <input type="number" className="form-control" value={form.duration} min={15} step={15}
              onChange={(e) => set("duration", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label fw-semibold small">{t("الحالة")}</label>
            <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="done">{t("منفَّذة")}</option>
              <option value="postponed">{t("مؤجلة")}</option>
              <option value="cancelled">{t("ملغاة")}</option>
            </select>
          </div>

          <div className="col-12">
            <label className="form-label fw-semibold small">
              {t("النقاط التي كتبها التلاميذ في هذه الحصة")} {course && <span className="text-secondary">(نقاط «{course.title}» الأساسية — علّم ما غُطّي فعلًا)</span>}
            </label>
            {course?.key_points?.length ? (
              <div className="points-box">
                {course.key_points.map((p) => (
                  <label key={p} className={`point-check ${points.includes(p) ? "on" : ""}`}>
                    <input type="checkbox" className="d-none" checked={points.includes(p)}
                      onChange={() => togglePoint(p)} />
                    {points.includes(p) ? "✓ " : ""}{p}
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-secondary small mb-2">{t("اختر درسًا لعرض نقاطه الأساسية، أو أضف نقاطًا يدويًا.")}</div>
            )}
            <div className="d-flex gap-2 mt-2">
              <input className="form-control" placeholder={t("نقطة إضافية كتبها التلاميذ…")}
                value={custom} onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (custom.trim()) { setPoints((xs) => [...xs, custom.trim()]); setCustom(""); } } }} />
              <button type="button" className="btn btn-outline-primary rounded-pill px-3"
                onClick={() => { if (custom.trim()) { setPoints((xs) => [...xs, custom.trim()]); setCustom(""); } }}>
                إضافة
              </button>
            </div>
            {points.filter((p) => !course?.key_points?.includes(p)).map((p) => (
              <span key={p} className="point-chip me-1 mt-2 d-inline-block">
                {p} <button type="button" className="btn-close btn-close-sm ms-1" style={{ fontSize: 8 }}
                  onClick={() => togglePoint(p)} aria-label={t("حذف")} />
              </span>
            ))}
          </div>

          <div className="col-12 col-md-8">
            <label className="form-label fw-semibold small">{t("الواجب المنزلي")}</label>
            <input className="form-control" value={form.homework}
              onChange={(e) => set("homework", e.target.value)} placeholder={t("مثال: لخّص خطوات الإقلاع من BIOS")} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold small">{t("عدد الغائبين")}</label>
            <input type="number" className="form-control" value={form.absentees} min={0}
              onChange={(e) => set("absentees", e.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold small">{t("ملخص ما كُتب على السبورة")}</label>
            <textarea className="form-control" rows={2} value={form.board_summary}
              onChange={(e) => set("board_summary", e.target.value)} />
          </div>
          <div className="col-12">
            <label className="form-label fw-semibold small">{t("ملاحظات الحصة")}</label>
            <textarea className="form-control" rows={2} value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)} placeholder={t("صعوبات، تفاعل التلاميذ، ما يجب استدراكه…")} />
          </div>
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy || !form.school_class}>
            {busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ الحصة ومزامنة التقدّم")}
          </button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function SessionsPage() {
  const { t, te } = useLang();
  const { items, loading, error, create, update, remove } = useResource("/sessions/");
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [filterClass, setFilterClass] = useState("");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [params] = useSearchParams();
  const openedRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api("/classes/"), api("/courses/")]).then(([c, k]) => {
      setClasses(listOf(c)); setCourses(listOf(k));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const cls = params.get("cls");
    if (cls && classes.length && !openedRef.current) {
      openedRef.current = true;
      const c = classes.find((x) => String(x.id) === cls);
      setModal({ school_class: cls, course: c?.progress?.next_course?.id ?? "" });
    }
  }, [params, classes]);

  const [f, setF] = usePersistentState("sessions-filters", { q: "", status: "", course: "", from: "", to: "", sort: "-date" });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const shown = useMemo(() => {
    const q = f.q.trim();
    const rows = items.filter((s) =>
      (!filterClass || String(s.school_class) === filterClass) &&
      (!f.status || s.status === f.status) &&
      (!f.course || String(s.course) === f.course) &&
      (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to) &&
      (!q || (s.course_title || "").includes(q) || s.class_name.includes(q) ||
        (s.points_written || []).join(" ").includes(q) || (s.homework || "").includes(q)));
    const by = {
      "-date": (a, b) => b.date.localeCompare(a.date),
      "date": (a, b) => a.date.localeCompare(b.date),
      "start_time": (a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")),
      "absentees": (a, b) => (b.absentees || 0) - (a.absentees || 0),
      "duration": (a, b) => (b.duration || 0) - (a.duration || 0),
    }[f.sort] || (() => 0);
    return [...rows].sort(by);
  }, [items, filterClass, f]);

  const printParams = () => {
    const p_ = new URLSearchParams();
    if (filterClass) p_.set("class", filterClass);
    if (f.status) p_.set("status", f.status);
    if (f.course) p_.set("course", f.course);
    if (f.from) p_.set("from", f.from);
    if (f.to) p_.set("to", f.to);
    p_.set("order", f.sort === "date" ? "oldest" : f.sort === "-date" ? "newest" : f.sort);
    return p_.toString();
  };
  const exportCsv = () => {
    const head = ["date", "class", "lesson", "status", "points", "homework", "absentees"];
    const lines = shown.map((x) => [x.date, x.class_name, x.course_title || "", x.status,
      (x.points_written || []).join("؛ "), x.homework || "", x.absentees]
      .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob(["\ufeff" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "sessions.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t("تم تصدير CSV"));
  };

  const submit = async (payload, id) => {
    const saved = id ? await update(id, payload) : await create(payload);
    const p = saved.class_progress_after;
    if (p) toast(` ${saved.class_name}: أُنجز ${p.done_count}/${p.total_courses} — التالي: ${p.next_course?.title || "أُنهي المقرر "}`);
    return saved;
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("سجلّ الحصص — دفتر الأستاذ الحي")}</h3>
          <p className="text-secondary mb-0">{t("كل حصة تُدرّسها تُسجَّل هنا وتُزامَن تلقائيًا مع خطة الدرس وتقدّم الفوج.")}</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary rounded-pill" onClick={exportCsv}>
            {t("تصدير CSV")}
          </button>
          <button className="btn btn-outline-primary rounded-pill"
            onClick={() => downloadPdf(`/exports/sessions/?${printParams()}`, "سجل الحصص.pdf")
              .then(() => toast(t("تم تنزيل سجل الحصص PDF"))).catch((e) => toast(e.message, "danger"))}>
             {t("سجل PDF")}
          </button>
          <button className="btn btn-primary rounded-pill px-4" onClick={() => setModal({})}>+ {t("تسجيل حصة")}</button>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <button className={`btn btn-sm rounded-pill ${!filterClass ? "btn-dark" : "btn-outline-dark"}`}
          onClick={() => setFilterClass("")}>{t("كل الأفواج")}</button>
        {classes.map((c) => (
          <button key={c.id} className={`btn btn-sm rounded-pill ${filterClass === String(c.id) ? "btn-dark" : "btn-outline-dark"}`}
            onClick={() => setFilterClass(String(c.id))}>
            {c.name} • {c.progress?.done_count ?? 0}/{c.progress?.total_courses ?? 0}
          </button>
        ))}
      </div>

      <FilterBar search={f.q} onSearch={(v) => set("q", v)} count={shown.length}
        sort={f.sort} onSort={(v) => set("sort", v)}
        onReset={() => setF({ q: "", status: "", course: "", from: "", to: "", sort: "-date" })}
        sortOptions={[["-date", "التاريخ (الأحدث)"], ["date", "التاريخ (الأقدم)"], ["start_time", "وقت البداية"], ["absentees", "عدد الغائبين (الأعلى)"], ["duration", "المدة (الأطول)"]]}>
        <select className="form-select" value={f.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">{t("كل الحالات")}</option>
          <option value="done">{t("منفَّذة")}</option>
          <option value="postponed">{t("مؤجلة")}</option>
          <option value="cancelled">{t("ملغاة")}</option>
        </select>
        <select className="form-select" value={f.course} onChange={(e) => set("course", e.target.value)}>
          <option value="">{t("كل الدروس")}</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <input type="date" className="form-control" value={f.from} onChange={(e) => set("from", e.target.value)} aria-label={t("من تاريخ")} />
        <input type="date" className="form-control" value={f.to} onChange={(e) => set("to", e.target.value)} aria-label={t("إلى تاريخ")} />
      </FilterBar>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <SkeletonCards count={3} /> : shown.length === 0 ? (
        <EmptyState icon="" title={t("لا حصص مسجلة بعد")} hint={t("سجّل أول حصة درّستها وستُبنى عليها محاذاة المقرر كاملة.")}
          actionLabel={"+ " + t("تسجيل حصة")} onAction={() => setModal({})} />
      ) : (
        <div className="d-flex flex-column gap-3">
          {shown.map((s) => (
            <div key={s.id} className={`card border-0 shadow-sm session-card ${s._temp ? "is-temp" : ""}`}>
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="session-date"> {te(s.weekday_name)} {s.date}{s.start_time ? ` • ${String(s.start_time).slice(0, 5)}` : ""}</span>
                    <span className="badge rounded-pill text-bg-primary"> {s.class_name}</span>
                    <span className={`badge rounded-pill text-bg-${STATUS[s.status]?.[1]}`}>{t(STATUS[s.status]?.[0] || "")}</span>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => setModal(s)}>{t("تعديل")}</button>
                    <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(s)}>{t("حذف")}</button>
                  </div>
                </div>
                <h5 className="fw-bold mt-2 mb-1">{s.course_title || t("حصة بدون درس محدد")}</h5>
                {s.plan_title && (
                  <Link to={`/preview/lesson-plan/${s.lesson_plan}`} className="plan-link">
                     {t("مرتبطة بخطة:")} {s.plan_title} — {t("معاينة")} الخطة
                  </Link>
                )}
                {s.points_written?.length > 0 && (
                  <div className="mt-2">
                    <span className="small fw-semibold text-secondary">{t("النقاط التي كتبها التلاميذ:")}</span>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {s.points_written.map((p, i) => <span key={i} className="point-chip">✓ {p}</span>)}
                    </div>
                  </div>
                )}
                <div className="d-flex flex-wrap gap-3 mt-2 small text-secondary">
                  {s.homework && <span> {s.homework}</span>}
                  <span> {t("الغائبون:")} {s.absentees}</span>
                  {s.class_progress_after && (
                    <span> {t("تقدّم الفوج:")} {s.class_progress_after.done_count}/{s.class_progress_after.total_courses}
                      {s.class_progress_after.next_course ? ` — التالي: ${s.class_progress_after.next_course.title}` : " — أُنهي المقرر "}
                    </span>
                  )}
                </div>
                {s.remarks && <p className="small mt-2 mb-0 text-secondary"> {s.remarks}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <SessionModal initial={modal} classes={classes} courses={courses}
          onSubmit={(p) => submit(p, modal.id)} onClose={() => setModal(null)} />
      )}
      {confirm && (
        <ConfirmModal title={t("حذف الحصة")} body={`ستُحذف حصة ${confirm.date} (${confirm.class_name}) وسيُعاد حساب تقدّم الفوج.`}
          onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />
      )}
    </>
  );
}
