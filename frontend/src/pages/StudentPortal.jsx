import { useEffect, useState } from "react";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import { studentPortalApi } from "../api/v2";
import { Spinner, EmptyState } from "../components/States";

export default function StudentPortalPage() {
  const { t } = useLang();
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [marks, setMarks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, m, a] = await Promise.all([
        studentPortalApi.summary(),
        studentPortalApi.marks(),
        studentPortalApi.attendance(),
      ]);
      setSummary(s);
      setMarks(m);
      setAttendance(a);
    } catch (e) {
      toast(e.message || t("فشل تحميل بيانات البوابة"), "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const termLabel = (tNum) => {
    if (tNum === 1) return t("الثلاثي الأول");
    if (tNum === 2) return t("الثلاثي الثاني");
    if (tNum === 3) return t("الثلاثي الثالث");
    return String(tNum);
  };

  if (loading) return <Spinner />;

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("بوابة التلميذ")}</h3>
          <p className="text-secondary mb-0">{t("مرحباً بك في بوابة التلميذ")}</p>
        </div>
        <button className="btn btn-outline-primary rounded-pill" onClick={load}>
          {t("تحديث")}
        </button>
      </div>

      {!summary ? (
        <EmptyState icon="" title={t("لا طالب مرتبط")}
          hint={t("لا طالب مرتبط بهذه البوابة.")} />
      ) : (
        <>
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-start gap-4">
                <div>
                  <h5 className="fw-bold mb-1">{summary.student?.full_name || "—"}</h5>
                  <p className="text-muted small mb-0">
                    {summary.school_class?.name || "—"} • {summary.school_class?.level || "—"}
                  </p>
                </div>
                <div className="text-end">
                  <div className="stat-mini">
                    <div className="stat-mini-num">{summary.marks_count}</div>
                    <div className="stat-mini-label">{t("عدد النقاط المسجلة")}</div>
                  </div>
                  <div className="stat-mini mt-2">
                    <div className="stat-mini-num">{summary.attendance_count}</div>
                    <div className="stat-mini-label">{t("عدد سجلات الحضور")}</div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <span className="badge bg-info text-dark">
                  {t("الفصول التي بها نقاط")}: {summary.terms_with_marks?.map(termLabel).join(", ") || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="fw-bold mb-3">{t("نقاطي")}</h6>
                  {marks.length === 0 ? (
                    <p className="text-muted small">{t("لا نقاط مسجلة بعد.")}</p>
                  ) : (
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th style={{ width: "30%" }}>{t("الثلاثي")}</th>
                          <th style={{ width: "23%" }}>{t("التقويم المستمر")}</th>
                          <th style={{ width: "23%" }}>{t("الفروض المحروسة")}</th>
                          <th style={{ width: "23%" }}>{t("الاختبار")}</th>
                          <th className="text-end">{t("المعدل")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marks.map((m) => {
                          const avg = m.continuous !== null && m.supervised !== null && m.exam !== null
                            ? ((m.continuous + m.supervised + m.exam * 2) / 4).toFixed(2)
                            : "—";
                          return (
                            <tr key={m.id}>
                              <td>{termLabel(m.term)}</td>
                              <td>{m.continuous ?? "—"}</td>
                              <td>{m.supervised ?? "—"}</td>
                              <td>{m.exam ?? "—"}</td>
                              <td className="text-end fw-semibold">{avg}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <h6 className="fw-bold mb-3">{t("حضوري وغيابي")}</h6>
                  {attendance.length === 0 ? (
                    <p className="text-muted small">{t("لا سجلات حضور بعد.")}</p>
                  ) : (
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>{t("التاريخ")}</th>
                          <th>{t("الحالة")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((r) => (
                          <tr key={r.id}>
                            <td>{r.date}</td>
                            <td>
                              <span className={`badge ${
                                r.status === "present" ? "bg-success" :
                                r.status === "absent" ? "bg-danger" :
                                r.status === "late" ? "bg-warning text-dark" :
                                r.status === "excused" ? "bg-info text-dark" :
                                "bg-secondary"
                              }`}>
                                {t(r.status) || r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
