import { useEffect, useState } from "react";
import { useLang } from "../i18n";
import { api } from "../api";
import { EmptyState } from "../components/States";

export default function ClassReassignmentPage() {
  const { t } = useLang();
  const [currentClasses, setCurrentClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/classes/")
      .then((data) => {
        const results = Array.isArray(data) ? data : data.results || [];
        setCurrentClasses(results);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || t("فشل تحميل الفصول"));
        setLoading(false);
      });
  }, []);

  return (
    <div className="container py-4">
      {/* Hero */}
      <div className="text-center mb-5">
        <h1 className="display-5 fw-bold text-primary">{t("تغيير الإسناد")}</h1>
        <p className="text-muted">
          {t("فصول كانت تخصني سابقاً، وفصول تخصني الآن")}
        </p>
      </div>

      <div className="row g-4">
        {/* Formerly mine */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-light text-dark fw-bold">
              {t("فصول كانت تخصني سابقاً")}
            </div>
            <div className="card-body">
              <EmptyState
                icon=""
                title={t("لا توجد فصول تم نقل ملكيتها")}
                hint={t(
                  "لم يتم تسجيل أي نقل ملكية لفصول كانت تخصك مسبقاً."
                )}
              />
            </div>
          </div>
        </div>

        {/* Now mine */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-light text-dark fw-bold">
              {t("فصول تخصني الآن")}
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-3">
                  <span className="spinner-border spinner-border-sm" /> {t("جاري التحميل…")}
                </div>
              ) : error ? (
                <div className="text-danger text-center small">{error}</div>
              ) : currentClasses.length === 0 ? (
                <EmptyState
                  icon=""
                  title={t("لا فصول مسجلة باسمك بعد")}
                  hint={t("ابدأ بإنشاء فصل جديد ليظهر هنا.")}
                />
              ) : (
                <table className="table table-sm table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "35%" }}>{t("اسم الفصل")}</th>
                      <th style={{ width: "20%" }}>{t("المستوى")}</th>
                      <th style={{ width: "25%" }}>{t("عدد التلاميذ")}</th>
                      <th style={{ width: "20%" }}>{t("الحالة")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentClasses.map((cls) => (
                      <tr key={cls.id}>
                        <td>
                          <span className="fw-semibold">{cls.name}</span>
                        </td>
                        <td>{cls.level}</td>
                        <td>
                          <span className="badge bg-secondary">
                            {cls.students_count ?? 0}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-success">{t("ملكي الآن")}</span>
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
    </div>
  );
}
