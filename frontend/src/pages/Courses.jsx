import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, downloadPdf, listOf } from "../api";
import { useToast } from "../components/Toast";
import { useResource } from "../hooks";
import { EmptyState, SkeletonCards } from "../components/States";
import { ConfirmModal } from "../components/Modals";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

export default function CoursesPage() {
  const { t, te } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const { items, loading, error, create, update, remove } = useResource("/courses/");
  const [themes, setThemes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [params, setParams] = useSearchParams();
  const lessonParam = params.get("lesson");

  useEffect(() => {
    api("/themes/").then((d) => setThemes(listOf(d))).catch(() => {});
    api("/classes/").then((d) => setClasses(listOf(d))).catch(() => {});
  }, [items]);

  const [f, setF] = usePersistentState("courses-filters", { domain: "", status: "", sort: "order" });
  const domains = [...new Set(items.map((c) => c.domain).filter(Boolean))];
  const shown = useMemo(() => {
    const rows = items.filter((c) =>
      (!search || c.title.includes(search) || (c.domain || "").includes(search)) &&
      (!f.domain || c.domain === f.domain) &&
      (!f.status ||
        (f.status === "taught" && (c.taught_in || []).length > 0) ||
        (f.status === "untaught" && (c.taught_in || []).length === 0) ||
        (f.status === "planned" && !!c.plan) ||
        (f.status === "unplanned" && !c.plan)));
    return [...rows].sort((a, b) =>
      f.sort === "title" ? a.title.localeCompare(b.title, "ar")
      : f.sort === "taught" ? (b.taught_in || []).length - (a.taught_in || []).length
      : (a.order - b.order));
  }, [items, search, f]);

  useEffect(() => {
    if (!lessonParam || !items.length) return;
    const target = items.find((c) => String(c.id) === lessonParam);
    if (target && !shown.some((c) => c.id === target.id)) {
      setF({ domain: "", status: "", sort: "order" });
      setSearch("");
    }
  }, [lessonParam, items, shown, setF]);

  useEffect(() => {
    if (!lessonParam || loading) return;
    const el = document.getElementById(`lesson-card-${lessonParam}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [lessonParam, loading, shown]);

  const targetLesson = lessonParam ? items.find((c) => String(c.id) === lessonParam) : null;


  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-3">
        <div>
          <h3 className="fw-bold mb-1"> {t("الدروس والمقرر الدراسي")}</h3>
          <p className="text-secondary mb-0">{t("كل درس يوزّع نقاطه وخطة درسه تلقائيًا على الحصص والأقسام — ومن كل درس تصل مباشرة إلى خطة درسه.")}</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/lesson-plans" className="btn btn-outline-dark rounded-pill px-4"> {t("خطط الدروس")}</Link>
          <button className="btn btn-primary rounded-pill px-4" onClick={() => navigate("/courses/new")}>+ {t("درس جديد")}</button>
        </div>
      </div>
      <FilterBar search={search} onSearch={setSearch} count={shown.length}
        searchPlaceholder={t("ابحث بعنوان الدرس أو ميدانه…")}
        sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
        onReset={() => { setF({ domain: "", status: "", sort: "order" }); setSearch(""); }}
        sortOptions={[["order", "الترتيب الأصلي"], ["title", "العنوان (أ-ي)"], ["taught", "الأكثر تدريسًا"]]}>
        <select className="form-select" value={f.domain} onChange={(e) => setF((x) => ({ ...x, domain: e.target.value }))}>
          <option value="">{t("الكل")}</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="form-select" value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>
          <option value="">{t("حالة التدريس")}</option>
          <option value="taught">{t("دُرّس")}</option>
          <option value="untaught">{t("لم يُدرّس بعد")}</option>
          <option value="planned">{t("له خطة")}</option>
          <option value="unplanned">{t("بلا خطة")}</option>
        </select>
      </FilterBar>

      {error && <div className="alert alert-danger">{error}</div>}
      {targetLesson && (
        <div className="alert alert-info d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span> {t("وصلت من خطة الدرس — هذا هو الدرس المرتبط:")} <b>{targetLesson.title}</b></span>
          <button className="btn btn-sm btn-outline-dark rounded-pill" onClick={() => setParams({})}>{t("عرض كل الدروس")}</button>
        </div>
      )}
      {loading ? <SkeletonCards /> : shown.length === 0 ? (
        <EmptyState icon="" title={t("لا دروس بعد")} hint={t("أضف دروس مقرر المادة بترتيبها وحدّد لكل درس نقاطه الأساسية.")}
          actionLabel={"+ " + t("درس جديد")} onAction={() => navigate("/courses/new")} />
      ) : (
        <div className="row g-3">
          {shown.map((c) => {
            const taughtIds = new Set((c.taught_in || []).map((t) => t.id));
            const nextFor = classes.filter((cl) => cl.progress?.next_course?.id === c.id && !taughtIds.has(cl.id));
            const pending = classes.filter((cl) => !taughtIds.has(cl.id) && cl.progress?.next_course?.id !== c.id);
            return (
              <div className="col-12 col-md-6 col-xl-4" key={c.id} id={`lesson-card-${c.id}`}>
                <div className={`card border-0 shadow-sm h-100 doc-card ${c._temp ? "is-temp" : ""} ${String(c.id) === lessonParam ? "highlight-card" : ""}`}>
                  <div className="course-cover"
                    style={{ background: `linear-gradient(135deg, ${c.theme_detail?.deep || "#2F5D50"}, ${c.theme_detail?.accent || "#C8A15A"})` }}>
                    <span className="course-order">{c.order}</span>
                    <div className="course-meta">{c.domain || "المقرر"} • {c.unit || ""}</div>
                    <h6 className="fw-bold mb-0 mt-1">{c.title}</h6>
                  </div>
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {(c.key_points || []).slice(0, 3).map((p, i) => <span key={i} className="point-chip">{p}</span>)}
                      {(c.key_points || []).length > 3 && <span className="point-chip">+{c.key_points.length - 3} {t("نقاط")}</span>}
                    </div>
                    {c.summary && <p className="text-secondary small">{c.summary.slice(0, 110)}{c.summary.length > 110 ? "…" : ""}</p>}
                    <div className="taught-row mt-auto">
                      <span className="small text-secondary">{t("الحالة لدى الأفواج:")}</span>
                      {(c.taught_in || []).map((t) => <span key={t.id} className="class-served">✓ {t.name}</span>)}
                      {nextFor.map((cl) => <span key={cl.id} className="class-served next-cls"> {t("التالي لدى")} {cl.name}</span>)}
                      {pending.map((cl) => <span key={cl.id} className="class-served muted">— {cl.name}</span>)}
                      {classes.length === 0 && <span className="text-secondary small">{t("لا أفواج بعد")}</span>}
                    </div>
                    <div className="d-flex gap-2 mt-3">
                      {c.plan
                        ? <>
                            <Link to={`/lesson-plans?plan=${c.plan.id}`} className="btn btn-sm btn-primary rounded-pill flex-grow-1">{t("فتح الخطة")}</Link>
                            <Link to={`/preview/lesson-plan/${c.plan.id}`} className="btn btn-sm btn-outline-primary rounded-pill">{t("معاينة")}</Link>
                          </>
                        : <Link to={`/lesson-plans?course=${c.id}`} className="btn btn-sm btn-outline-primary rounded-pill flex-grow-1">{t("أنشئ خطة لهذا الدرس")}</Link>}
                      <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={() => navigate(`/courses/${c.id}/edit`)}>{t("تعديل")}</button>
                      <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(c)}>{t("حذف")}</button>
                    </div>
                    <div className="d-flex gap-2 mt-2">
                      <Link to={`/preview/course/${c.id}`} className="btn btn-sm btn-dark rounded-pill flex-grow-1">{t("معاينة الدرس")}</Link>
                      <button className="btn btn-sm btn-outline-dark rounded-pill"
                        onClick={() => downloadPdf(`/exports/course/${c.id}/`, `${c.title}.pdf`)
                          .then(() => toast("تم تنزيل ملف PDF")).catch((e) => toast(e.message, "danger"))}>
                        ⬇ {t("تصدير PDF")}
                      </button>
                    </div>
                    <div className="small text-secondary mt-2">{c.level || "—"}{c.theme_detail ? ` •  ${c.theme_detail.name_ar}` : ""}{c.plans_count > 1 ? ` •  ${c.plans_count} ${t("خطط مرتبطة بهذا الدرس")}` : ""}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {confirm && <ConfirmModal title={t("حذف الدرس")}
        body={`سيُحذف درس «${confirm.title}» من المقرر (لن تُحذف الحصص المسجلة، بل ستُفصل عنه).`}
        onConfirm={() => remove(confirm.id)} onClose={() => setConfirm(null)} />}
    </>
  );
}
