import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { remedialApi } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const BAND_STYLES = { intensive: "text-bg-danger", support: "text-bg-warning", boost: "text-bg-info", attendance: "text-bg-secondary" };

export default function RemedialPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [term, setTerm] = useState(1);
  const [overview, setOverview] = useState(null);
  const [classId, setClassId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [plans, setPlans] = useState({});

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await remedialApi.overview(term);
      setOverview(data);
      if (data.classes.length && !data.classes.some((row) => row.class.id === classId)) {
        setClassId(data.classes[0].class.id);
      }
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, toast]);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  const loadDetail = useCallback(async () => {
    if (!classId) { setDetail(null); setGroups([]); return; }
    try {
      const [detailData, groupData] = await Promise.all([
        remedialApi.detail(classId, term), remedialApi.groups(classId),
      ]);
      setDetail(detailData);
      setGroups(groupData.results || groupData || []);
    } catch (error) { toast(error.message, "danger"); }
  }, [classId, term, toast]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const createGroup = async (band) => {
    setBusy(band.band);
    try {
      const group = await remedialApi.createGroup({
        school_class: classId, term, band: band.band,
        title: `${band.label} — ${detail.class.name}`,
        focus: band.focus, member_ids: band.students.map((s) => s.student_id),
      });
      setGroups((xs) => [group, ...xs]);
      toast(t("تكوّنت المجموعة — حدّد موعدها وولّد ورقة العمل"));
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const schedule = async (group) => {
    const draft = plans[group.id] || {};
    try {
      const updated = await remedialApi.schedule(group.id, { date: draft.date ?? group.planned_date ?? "", time: draft.time ?? (group.planned_time || "").slice(0, 5) });
      setGroups((xs) => xs.map((g) => (g.id === updated.id ? updated : g)));
      toast(t("حُدّد موعد حصة الاستدراك"));
    } catch (error) { toast(error.message, "danger"); }
  };

  const worksheet = async (group) => {
    setBusy(`sheet-${group.id}`);
    try {
      const doc = await remedialApi.generateWorksheet(group.id, {});
      toast(t("وُلّدت ورقة العمل الداعمة"));
      loadDetail();
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const createPlans = async (group) => {
    setBusy(`plans-${group.id}`);
    try {
      const res = await remedialApi.createPlans(group.id);
      toast(`${t("أُنشئت")} ${res.created} ${t("خطة فردية")} • ${t("تُخطّي")} ${res.skipped}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const toggleDone = async (group) => {
    try {
      const updated = await remedialApi.updateGroup(group.id, { status: group.status === "done" ? "active" : "done" });
      setGroups((xs) => xs.map((g) => (g.id === updated.id ? updated : g)));
    } catch (error) { toast(error.message, "danger"); }
  };

  const removeGroup = async (group) => {
    if (!window.confirm(t("حذف هذه المجموعة؟"))) return;
    try {
      await remedialApi.removeGroup(group.id);
      setGroups((xs) => xs.filter((g) => g.id !== group.id));
    } catch (error) { toast(error.message, "danger"); }
  };

  if (loading && !overview) return <Spinner />;
  if (!overview) return null;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز مجموعات الدعم والاستدراك")}</h3>
          <p className="text-secondary mb-0">{t("حوّل نتائج الثلاثي إلى مجموعات دعم جاهزة: مكثف لمن دون 8 أو بلا نقاط، دعم لمن بين 8 و10، تعزيز لمن بين 10 و12، ومتابعة حضور للغائبين — مع أوراق عمل من بنك الأسئلة وخطط فردية بضغطة واحدة.")}</p>
        </div>
        <select className="form-select exam-term-select" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
          {TERMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {!overview.classes.length && <EmptyState title={t("لا أفواج بعد")} hint={t("أنشئ فوجًا أولًا من صفحة الأقسام والتقدم.")} />}

      <div className="row g-3 mb-4">
        {overview.classes.map((row) => (
          <div className="col-12 col-md-6 col-xl-4" key={row.class.id}>
            <button type="button" onClick={() => setClassId(row.class.id)}
              className={`card border-0 shadow-sm h-100 w-100 text-start exam-class-card ${classId === row.class.id ? "active" : ""}`}>
              <div className="card-body">
                <div className="fw-bold mb-2">{row.class.name}</div>
                <div className="d-flex flex-wrap gap-1">
                  {Object.entries(row.counts).map(([band, count]) => (
                    <span key={band} className={`badge rounded-pill ${BAND_STYLES[band]}`}>
                      {count} {t({ intensive: "مكثف", support: "دعم", boost: "تعزيز", attendance: "حضور" }[band])}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {detail && (
        <>
          <div className="row g-3 mb-4">
            {detail.bands.map((band) => (
              <div className="col-12 col-xl-6" key={band.band}>
                <div className="card border-0 shadow-sm h-100"><div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <h6 className="fw-bold mb-0">{band.label} <span className={`badge rounded-pill ${BAND_STYLES[band.band]}`}>{band.count}</span></h6>
                    <button className="btn btn-sm btn-primary rounded-pill" disabled={!band.count || busy === band.band} onClick={() => createGroup(band)}>
                      {busy === band.band ? <span className="spinner-border spinner-border-sm" /> : t("تكوين مجموعة")}
                    </button>
                  </div>
                  <p className="text-secondary small">{band.focus}</p>
                  {!band.students.length
                    ? <p className="text-secondary small mb-0">{t("لا تلاميذ في هذه الفئة.")}</p>
                    : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle exam-table mb-0">
                          <thead><tr><th>{t("التلميذ")}</th><th>{t("المعدل")}</th><th>{t("أضعف مكوّن")}</th><th>{t("الغيابات")}</th></tr></thead>
                          <tbody>
                            {band.students.map((row) => (
                              <tr key={row.student_id}>
                                <td className="fw-bold">{row.student_name}</td>
                                <td>{row.average ?? "—"}</td>
                                <td>{row.weak_component ? `${row.weak_component} (${row.weak_value})` : "—"}</td>
                                <td>{row.absences}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div></div>
              </div>
            ))}
          </div>

          <h5 className="fw-bold mb-3">{t("مجموعاتي المشكّلة")}</h5>
          {!groups.length
            ? <p className="text-secondary">{t("لا مجموعات بعد — كوّن أول مجموعة من الفئات أعلاه.")}</p>
            : (
              <div className="d-flex flex-column gap-2 mb-4">
                {groups.map((group) => (
                  <div key={group.id} className="pm-row">
                    <div className="flex-grow-1">
                      <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                        <span className={`badge rounded-pill ${BAND_STYLES[group.band]}`}>{group.band_label}</span>
                        <span className="fw-bold">{group.title}</span>
                        <span className="badge text-bg-light border">{group.members_detail.length} {t("تلميذ")}</span>
                        {group.status === "done" && <span className="badge text-bg-success">{t("منتهية")}</span>}
                        {group.source_assessment_title && <span className="badge text-bg-light border">{t("من تقويم")}: {group.source_assessment_title}</span>}
                        {group.worksheet_document && <span className="badge text-bg-light border"> {t("الورقة جاهزة")}</span>}
                      </div>
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        {group.members_detail.map((m) => <span key={m.id} className="badge text-bg-light border fw-normal">{m.name}</span>)}
                      </div>
                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <input type="date" className="form-control form-control-sm remedial-date"
                          value={(plans[group.id]?.date ?? group.planned_date) || ""}
                          onChange={(e) => setPlans({ ...plans, [group.id]: { ...plans[group.id], date: e.target.value } })} />
                        <input type="time" className="form-control form-control-sm remedial-date"
                          value={(plans[group.id]?.time ?? (group.planned_time || "").slice(0, 5)) || ""}
                          onChange={(e) => setPlans({ ...plans, [group.id]: { ...plans[group.id], time: e.target.value } })} />
                        <button className="btn btn-sm btn-light border rounded-pill" onClick={() => schedule(group)}>{t("حفظ الموعد")}</button>
                      </div>
                    </div>
                    <div className="d-flex flex-column gap-1">
                      <button className="btn btn-sm btn-outline-primary rounded-pill text-nowrap" disabled={busy === `sheet-${group.id}`} onClick={() => worksheet(group)}>
                        {busy === `sheet-${group.id}` ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="clipboard" size={14} /> {t("ورقة عمل داعمة")}</>}
                      </button>
                      <button className="btn btn-sm btn-outline-success rounded-pill text-nowrap" disabled={busy === `plans-${group.id}`} onClick={() => createPlans(group)}>
                        {busy === `plans-${group.id}` ? <span className="spinner-border spinner-border-sm" /> : t("إنشاء خطط فردية")}
                      </button>
                      <button className="btn btn-sm btn-light border rounded-pill" onClick={() => toggleDone(group)}>{group.status === "done" ? t("إعادة فتح") : t("إنهاء المجموعة")}</button>
                      <button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => removeGroup(group)}>{t("حذف")}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </>
      )}
    </>
  );
}
