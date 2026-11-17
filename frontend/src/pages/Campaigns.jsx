import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];

export default function CampaignsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [audience, setAudience] = useState("absentees");
  const [term, setTerm] = useState(1);
  const [minAbsences, setMinAbsences] = useState(3);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [log, setLog] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api("/classes/").then(listOf).then((rows) => {
      setClasses(rows);
      setClassId((current) => current ?? rows[0]?.id ?? null);
    }).catch((error) => toast(error.message, "danger"));
  }, [toast]);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true); setResult(null);
    try {
      const data = await api(`/classes/${classId}/parent-campaign/?audience=${audience}&term=${term}&min_absences=${minAbsences}`);
      setPreview(data);
      setSelected(data.students.map((row) => row.student_id));
      setSubject(data.default_subject);
      setMessage(data.default_message);
    } catch (error) { toast(error.message, "danger"); }
    setLoading(false);
  }, [classId, audience, term, minAbsences, toast]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);

  const generate = async () => {
    if (!selected.length) { toast(t("اختر مستلمًا واحدًا على الأقل"), "danger"); return; }
    setGenerating(true);
    try {
      const data = await api(`/classes/${classId}/parent-campaign/generate/`, {
        method: "POST",
        body: { audience, term, min_absences: Number(minAbsences), student_ids: selected, subject, message, log },
      });
      setResult(data);
      toast(`${t("وُلّدت حزمة الرسائل")} • ${data.recipients} ${t("مستلم")} • ${t("سُجّلت")} ${data.logged} ${t("رسالة في سجل التواصل")}`);
      await load();
    } catch (error) { toast(error.message, "danger"); }
    setGenerating(false);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("مركز التواصل الجماعي مع الأولياء")}</h3>
          <p className="text-secondary mb-0">{t("حوّلوا مؤشرات الغياب والمهام والنتائج إلى رسائل أولياء جاهزة للطباعة: اختروا الجمهور، راجعوا القائمة، عدّلوا النص، وولّدوا حزمة رسائل واحدة مع تسجيل تلقائي لكل رسالة.")}</p>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select w-auto" value={classId || ""} onChange={(e) => setClassId(Number(e.target.value))}>
            {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
          <select className="form-select w-auto" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
            {TERMS.map(([value, label]) => <option key={value} value={value}>{te(label)}</option>)}
          </select>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {(preview?.audiences || []).map((row) => (
          <button key={row.key} className={`btn btn-sm rounded-pill ${audience === row.key ? "btn-primary" : "btn-light"}`} onClick={() => setAudience(row.key)}>{te(row.label)}</button>
        ))}
        {audience === "absentees" && (
          <span className="d-flex align-items-center gap-2 ms-2">
            <label className="small text-secondary">{t("غيابات على الأقل")}</label>
            <input type="number" min="1" max="30" className="form-control pack-num" value={minAbsences} onChange={(e) => setMinAbsences(e.target.value)} />
          </span>
        )}
      </div>

      {loading && !preview ? <Spinner /> : preview && (
        <>
          <div className="card border-0 shadow-sm mb-4"><div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <h6 className="fw-bold mb-0">{t("المستلمون")} ({selected.length}/{preview.students.length})</h6>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-light rounded-pill" onClick={() => setSelected(preview.students.map((r) => r.student_id))}>{t("تحديد الكل")}</button>
                <button className="btn btn-sm btn-light rounded-pill" onClick={() => setSelected([])}>{t("إلغاء التحديد")}</button>
              </div>
            </div>
            {preview.students.length === 0 ? (
              <EmptyState title={t("لا مستلمين في هذه الفئة")} hint={t("جرّبوا فئة أخرى أو عدّلوا العتبة.")} />
            ) : (
              <div className="table-responsive"><table className="table align-middle">
                <thead><tr><th></th><th>{t("التلميذ")}</th><th>{t("المؤشر")}</th><th>{t("آخر تواصل")}</th></tr></thead>
                <tbody>
                  {preview.students.map((row) => (
                    <tr key={row.student_id}>
                      <td><input type="checkbox" className="form-check-input" checked={selected.includes(row.student_id)} onChange={() => toggle(row.student_id)} /></td>
                      <td><button className="btn btn-link p-0 text-decoration-none fw-semibold" onClick={() => navigate(`/students/${row.student_id}`)}>{row.student_name}</button></td>
                      <td className="text-secondary">{row.detail}</td>
                      <td className="text-secondary small">{row.last_communication ? `${row.last_communication.date} — ${row.last_communication.subject}` : t("لا تواصل سابق")}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div></div>

          <div className="card border-0 shadow-sm mb-4"><div className="card-body">
            <h6 className="fw-bold mb-3">{t("نص الرسالة")}</h6>
            <div className="mb-3">
              <label className="form-label small fw-semibold">{t("موضوع الرسالة")}</label>
              <input className="form-control" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-semibold">{t("محتوى الرسالة")}</label>
              <textarea className="form-control" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <p className="small text-secondary">{t("عناصر تُستبدل تلقائيًا لكل تلميذ:")} <code>{"{name}"}</code> <code>{"{class}"}</code> <code>{"{average}"}</code> <code>{"{absences}"}</code> <code>{"{missing}"}</code> <code>{"{attendance}"}</code> <code>{"{plans}"}</code> <code>{"{term}"}</code></p>
            <label className="form-check mb-3">
              <input type="checkbox" className="form-check-input" checked={log} onChange={(e) => setLog(e.target.checked)} />
              <span className="form-check-label">{t("تسجيل كل رسالة في سجل تواصل الأولياء لكل تلميذ")}</span>
            </label>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <button className="btn btn-primary rounded-pill px-4" disabled={generating || !selected.length} onClick={generate}>
                {generating ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="pen" size={16} /> {t("توليد حزمة الرسائل")}</>}
              </button>
              {result && <button className="btn btn-light rounded-pill" onClick={() => navigate(`/editor/${result.document.id}`)}>{t("فتح الحزمة في المحرر")}</button>}
            </div>
            {result && <p className="small text-secondary mt-2 mb-0">{result.document.title} • {result.recipients} {t("مستلم")} • {result.logged} {t("رسالة مسجلة")}</p>}
          </div></div>

          {!!preview.recent_campaigns.length && (
            <div className="card border-0 shadow-sm"><div className="card-body">
              <h6 className="fw-bold mb-3">{t("حزم مراسلات سابقة لهذا الفوج")}</h6>
              {preview.recent_campaigns.map((doc) => (
                <div key={doc.id} className="d-flex flex-wrap gap-2 align-items-center py-2 border-bottom">
                  <span className="flex-grow-1">{doc.title}</span>
                  <span className="small text-secondary">{doc.updated_at?.slice(0, 10)}</span>
                  <button className="btn btn-sm btn-light rounded-pill" onClick={() => navigate(`/editor/${doc.id}`)}>{t("فتح في المحرر")}</button>
                </div>
              ))}
            </div></div>
          )}
        </>
      )}
    </>
  );
}
