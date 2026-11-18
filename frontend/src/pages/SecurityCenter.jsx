import { useState, useEffect } from "react";
import { useResource } from "../hooks";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";
import Icon from "../components/Icon";
import { securityApi } from "../api/v2";

const ACTION_LABELS = {
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  export: "تصدير",
  import: "استيراد",
  view: "عرض",
  approve: "اعتماد",
  reject: "رفض",
  publish: "نشر",
  void: "إلغاء",
  submit: "إرسال",
  failed_login: "فشل تسجيل دخول",
  access_denied: "رفض وصول",
  data_change: "تغيير بيانات",
  system_event: "حدث نظام",
};

const RESOURCE_LABELS = {
  user: "مستخدم",
  student: "تلميذ",
  class: "فوج",
  course: "مقرر",
  "lesson-plan": "خطة درس",
  session: "حصص",
  "grade-ruleset": "مجموعة قواعد حساب",
  "calculated-result": "نتيجة حساب",
  "computer-lab": "مختبر كمبيوتر",
  seat: "مقعد",
  "seating-assignment": "تكليف مقعد",
  organization: "منظمة",
  school: "مدرسة",
  campus: "حرم",
  "academic-year": "سنة دراسية",
  "academic-term": "ثلاثي",
  enrollment: "تسجيل",
  document: "وثيقة",
  backup: "نسخة احتياطية",
  system: "نظام",
};

const ACTION_BADGE = {
  login: "bg-success",
  logout: "bg-secondary",
  create: "bg-info text-dark",
  update: "bg-primary",
  delete: "bg-danger",
  export: "bg-warning text-dark",
  import: "bg-warning text-dark",
  view: "bg-light border",
  approve: "bg-success",
  reject: "bg-danger",
  publish: "bg-success",
  void: "bg-danger",
  submit: "bg-primary",
  failed_login: "bg-danger",
  access_denied: "bg-danger",
  data_change: "bg-warning text-dark",
  system_event: "bg-secondary",
};

export default function SecurityCenterPage() {
  const { t } = useLang();
  const { items, loading, error, load } = useResource("/security-audit-logs/");
  const [f, setF] = usePersistentState("security-audit-filters", {
    q: "", user: "", action: "", resource_type: "", from: "", to: "",
  });
  const toast = useToast();

  const shown = items.filter((log) => {
    const q = f.q.trim().toLowerCase();
    return (
      (!q ||
        (log.resource_label || "").toLowerCase().includes(q) ||
        (log.user_name || "").toLowerCase().includes(q)) &&
      (!f.user || String(log.user) === f.user) &&
      (!f.action || log.action === f.action) &&
      (!f.resource_type || log.resource_type === f.resource_type) &&
      (!f.from || (log.created_at || "").slice(0, 10) >= f.from) &&
      (!f.to || (log.created_at || "").slice(0, 10) <= f.to)
    );
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Unique filter values
  const users = [...new Set(items.map((l) => l.user).filter(Boolean))];
  const actions = [...new Set(items.map((l) => l.action))];
  const resourceTypes = [...new Set(items.map((l) => l.resource_type).filter(Boolean))];

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز الأمان")}</h3>
          <p className="text-secondary mb-0">{t("سجل attività النظام — سجل لا يمكن تعديله أو حذفه لكل الإجراءات الأمنية في المنصة.")}</p>
        </div>
        <button className="btn btn-outline-primary rounded-pill" onClick={load}>
          {t("تحديث")}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-xl-3">
              <div className="stat-mini">
                <div className="stat-mini-num">{items.length}</div>
                <div className="stat-mini-label">{t("سجل تدقيق")}</div>
              </div>
            </div>
            <div className="col-xl-3">
              <div className="stat-mini">
                <div className="stat-mini-num">{shown.filter((l) => l.action === "failed_login").length}</div>
                <div className="stat-mini-label text-danger">{t("فشل تسجيل دخول")}</div>
              </div>
            </div>
            <div className="col-xl-3">
              <div className="stat-mini">
                <div className="stat-mini-num">{shown.filter((l) => l.action === "access_denied").length}</div>
                <div className="stat-mini-label text-warning">{t("رفض وصول")}</div>
              </div>
            </div>
            <div className="col-xl-3">
              <div className="stat-mini">
                <div className="stat-mini-num">{shown.filter((l) => l.action === "delete").length}</div>
                <div className="stat-mini-label text-danger">{t("حذف")}</div>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <FilterBar search={f.q}
              onSearch={(v) => setF((x) => ({ ...x, q: v }))}
              count={shown.length}
              onReset={() => setF({ q: "", user: "", action: "", resource_type: "", from: "", to: "" })}>
              <div className="form-check form-check-inline mb-0">
                <select className="form-select form-select-sm" value={f.user}
                  onChange={(e) => setF((x) => ({ ...x, user: e.target.value }))}>
                  <option value="">{t("كل المستخدمين")}</option>
                  {users.map((uid) => (
                    <option key={uid} value={uid}>{`مستخدم #${uid}`}</option>
                  ))}
                </select>
              </div>
              <div className="form-check form-check-inline mb-0">
                <select className="form-select form-select-sm" value={f.action}
                  onChange={(e) => setF((x) => ({ ...x, action: e.target.value }))}>
                  <option value="">{t("كل العمليات")}</option>
                  {actions.map((act) => (
                    <option key={act} value={act}>{t(act) || act}</option>
                  ))}
                </select>
              </div>
              <div className="form-check form-check-inline mb-0">
                <select className="form-select form-select-sm" value={f.resource_type}
                  onChange={(e) => setF((x) => ({ ...x, resource_type: e.target.value }))}>
                  <option value="">{t("كل أنواع الموارد")}</option>
                  {resourceTypes.map((rt) => (
                    <option key={rt} value={rt}>{t(rt) || rt}</option>
                  ))}
                </select>
              </div>
              <div className="form-check form-check-inline mb-0 d-flex align-items-center gap-2">
                <label className="form-label small mb-0">{t("من")}</label>
                <input type="date" className="form-control form-control-sm" value={f.from}
                  onChange={(e) => setF((x) => ({ ...x, from: e.target.value }))} />
                <label className="form-label small mb-0 ms-2">{t("إلى")}</label>
                <input type="date" className="form-control form-control-sm" value={f.to}
                  onChange={(e) => setF((x) => ({ ...x, to: e.target.value }))} />
              </div>
            </FilterBar>
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState icon="" title={t("لا توجد سجلات تدقيق بعد")}
          hint={t("ابدأ باستخدام المنصة لتسجيل الأنشطة الأمنية.")} />
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle">
            <thead>
              <tr>
                <th>{t("تاريخ الإنشاء")}</th>
                <th>{t("المستخدم")}</th>
                <th>{t("العملية")}</th>
                <th>{t("نوع المورد")}</th>
                <th>{t("تسمية المورد")}</th>
                <th className="text-end">{t("تفاصيل")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="text-muted small">{new Date(log.created_at).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </td>
                  <td>
                    <span className="badge text-bg-light border">{log.user_name || `مستخدم #${log.user}`}</span>
                  </td>
                  <td>
                    <span className={`badge ${ACTION_BADGE[log.action] || "bg-secondary"}`}>
                      {t(log.action) || log.action}
                    </span>
                  </td>
                  <td>
                    <span className="text-muted small">{t(log.resource_type) || log.resource_type || "—"}</span>
                  </td>
                  <td>
                    <span className="text-truncate d-inline-block" style={{ maxWidth: "180px" }}>{log.resource_label || "—"}</span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                      alert(JSON.stringify(log.details, null, 2));
                    }} title={t("تفاصيل")}>
                      <span className="visually-hidden">{t("تفاصيل")}</span>
                      <Icon name="search" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="alert alert-info mt-4">
        <span className="badge bg-secondary me-2">{t("سجلات لا يمكن تعديلها أو حذفها")}</span>
        {t("سجلات التدقيق لا يمكن تعديلها أو حذفها من خلال واجهة المستخدم — هي سجل لا يمكن مسحه للمساءلة والتحقيق.")}
      </div>
    </>
  );
}
