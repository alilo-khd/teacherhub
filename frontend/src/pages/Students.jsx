import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, downloadPdf, listOf } from "../api";
import { EmptyState, Spinner } from "../components/States";
import { ConfirmModal, ModalShell } from "../components/Modals";
import { useToast } from "../components/Toast";
import FilterBar from "../components/FilterBar";
import { usePersistentState } from "../hooks";
import { useLang } from "../i18n";

const TERMS = [[1, "الثلاثي الأول"], [2, "الثلاثي الثاني"], [3, "الثلاثي الثالث"]];
const num = (v) => (v === "" || v == null ? null : Number(v));

function avgOf(m) {
  if (!m || m.continuous == null || m.supervised == null || m.exam == null) return null;
  return Math.round(((m.continuous + m.supervised + m.exam * 2) / 4) * 100) / 100;
}

function BulkModal({ cls, onClose, onDone }) {
  const { t, te } = useLang();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const submit = async () => {
    const names = text.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    try {
      const res = await api("/students/bulk/", { method: "POST", body: { school_class: cls.id, names } });
      toast(`${t("أُضيف")} ${res.created} ${t("تلميذًا")} ${t("إلى")} ${cls.name}`);
      onDone(); onClose();
    } catch (e) { toast(e.message, "danger"); setBusy(false); }
  };
  return (
    <ModalShell title={`إضافة جماعية — ${cls.name}`} wide onClose={onClose}>
      <p className="text-secondary small">{t("الصق قائمة الأسماء (اسم في كل سطر) وستُنشأ بطاقات التلاميذ دفعة واحدة.")}</p>
      <textarea className="form-control" rows={10} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"أمين بن عمر\nخديجة مرابط\n..."} />
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary rounded-pill px-4" disabled={busy} onClick={submit}>
          {busy ? <span className="spinner-border spinner-border-sm" /> : t("إضافة القائمة")}
        </button>
        <button className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
      </div>
    </ModalShell>
  );
}

export default function StudentsPage() {
  const { t, te } = useLang();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [clsId, setClsId] = useState("");
  const [term, setTerm] = useState(1);
  const [students, setStudents] = useState(null);
  const [stats, setStats] = useState(null);
  const [edits, setEdits] = useState({});
  const [newName, setNewName] = useState("");
  const [bulk, setBulk] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const toast = useToast();

  const cls = classes.find((c) => String(c.id) === String(clsId));

  const load = useCallback(async () => {
    if (!clsId) return;
    const [st, ss] = await Promise.all([
      api(`/students/?class=${clsId}`), api(`/classes/${clsId}/stats/`)]);
    const rows = listOf(st);
    setStudents(rows); setStats(ss);
    const e = {};
    rows.forEach((s) => (s.marks || []).forEach((m) => {
      e[`${s.id}-${m.term}`] = { continuous: m.continuous ?? "", supervised: m.supervised ?? "", exam: m.exam ?? "" };
    }));
    setEdits(e);
  }, [clsId]);

  useEffect(() => {
    api("/classes/").then((d) => {
      const rows = listOf(d);
      setClasses(rows);
      if (rows[0]) setClsId(String(rows[0].id));
    }).catch(() => {});
  }, []);
  useEffect(() => { load().catch(() => setStudents([])); }, [load]);

  const setMark = (sid, field, value) =>
    setEdits((e) => ({ ...e, [`${sid}-${term}`]: { ...(e[`${sid}-${term}`] || {}), [field]: value } }));

  const saveMark = async (sid) => {
    const v = edits[`${sid}-${term}`] || {};
    try {
      await api("/marks/upsert/", {
        method: "POST",
        body: { student: sid, term, continuous: num(v.continuous), supervised: num(v.supervised), exam: num(v.exam) },
      });
      load();
    } catch (e) { toast(e.message, "danger"); }
  };

  const addStudent = async () => {
    if (!newName.trim() || !clsId) return;
    await api("/students/", { method: "POST", body: { school_class: Number(clsId), full_name: newName.trim() } });
    setNewName(""); load(); toast("أُضيف التلميذ");
  };

  const delStudent = async (s) => {
    await api(`/students/${s.id}/`, { method: "DELETE" });
    load(); toast(t("حُذف التلميذ"), "warning");
  };

  const [f, setF] = usePersistentState("students-filters", { q: "", sort: "name", risk: false, ungraded: false });
  const avgTermOf = (st) => avgOf(((st.marks || []).find((m) => m.term === term)) || {});
  const shownStudents = (students || []).filter((st) => {
    if (f.q.trim() && !st.full_name.includes(f.q.trim())) return false;
    const a = avgTermOf(st);
    if (f.risk && !(a != null && a < 10)) return false;
    if (f.ungraded && a != null) return false;
    return true;
  }).sort((a, b) => {
    if (f.sort === "avgDesc") return (avgTermOf(b) ?? -1) - (avgTermOf(a) ?? -1);
    if (f.sort === "avgAsc") return (avgTermOf(a) ?? 99) - (avgTermOf(b) ?? 99);
    if (f.sort === "annual") return (b.annual_average ?? -1) - (a.annual_average ?? -1);
    return a.full_name.localeCompare(b.full_name, "ar");
  });
  const dist = (() => {
    const bins = [[0, 5, "0–5"], [5, 10, "5–10"], [10, 15, "10–15"], [15, 20.01, "15–20"]];
    return bins.map(([lo, hi, label], i) => ({
      label, cls: i === 0 ? "weak" : i === 1 ? "mid" : "",
      n: (students || []).filter((st) => { const a = avgTermOf(st); return a != null && a >= lo && a < hi; }).length,
    }));
  })();
  const maxDist = Math.max(1, ...dist.map((d) => d.n));
  const exportCsv = () => {
    const head = ["student", "continuous", "supervised", "exam", "term_average", "annual_average"];
    const lines = shownStudents.map((st) => {
      const m = (st.marks || []).find((x) => x.term === term) || {};
      return [st.full_name, m.continuous ?? "", m.supervised ?? "", m.exam ?? "", avgTermOf(st) ?? "", st.annual_average ?? ""]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
    });
    const blob = new Blob(["\ufeff" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "marks.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(t("تم تصدير CSV"));
  };

  const tstat = stats?.stats?.[`term${term}`];

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1"> {t("التلاميذ ودفتر التنقيط")}</h3>
          <p className="text-secondary mb-0">بطاقات التلاميذ ونقاطهم — المعدل يُحسب آليًا: (التقويم المستمر + الفروض المحروسة + الاختبار × 2) ÷ 4.</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-light rounded-pill" disabled={!cls} onClick={() => navigate("/follow-up")}>{t("الحضور والمتابعة اليومية")}</button>
          <button className="btn btn-outline-primary rounded-pill" disabled={!cls} onClick={() => setBulk(true)}> {t("إضافة جماعية")}</button>
          <button className="btn btn-primary rounded-pill px-4" disabled={!cls}
            onClick={() => downloadPdf(`/exports/gradebook/${cls.id}/?term=${term}&sort=${f.sort === "avgDesc" ? "average_desc" : f.sort === "avgAsc" ? "average_asc" : f.sort === "annual" ? "annual_desc" : "name"}`, `دفتر التنقيط — ${cls.name}.pdf`).then(() => toast("تم تنزيل دفتر التنقيط PDF")).catch((e) => toast(e.message, "danger"))}>
             {t("دفتر التنقيط PDF")}
          </button>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap align-items-center">
        {classes.map((c) => (
          <button key={c.id} className={`btn btn-sm rounded-pill ${String(c.id) === clsId ? "btn-dark" : "btn-outline-dark"}`}
            onClick={() => setClsId(String(c.id))}>{c.name}</button>
        ))}
        <span className="mx-2 text-secondary">|</span>
        {TERMS.map(([termNo, label]) => (
          <button key={termNo} className={`btn btn-sm rounded-pill ${term === termNo ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setTerm(termNo)}>{t(label)}</button>
        ))}
      </div>

      {tstat && (
        <div className="row g-3 mb-3">
          {[[t("معدل الفوج"), tstat.average], [t("أعلى معدل"), tstat.highest], [t("أدنى معدل"), tstat.lowest],
            [t("نسبة النجاح (≥10)"), tstat.success_rate != null ? `${tstat.success_rate}٪` : "—"],
            [t("تلاميذ مُنقَّطون"), `${tstat.graded}/${stats.students}`]].map(([l, v], i) => (
            <div className="col-6 col-md" key={i}>
              <div className="stat-mini"><div className="stat-mini-num">{v ?? "—"}</div><div className="stat-mini-label">{t(l)}</div></div>
            </div>
          ))}
        </div>
      )}

      <FilterBar search={f.q} onSearch={(v) => setF((x) => ({ ...x, q: v }))} count={shownStudents.length}
        sort={f.sort} onSort={(v) => setF((x) => ({ ...x, sort: v }))}
        onReset={() => setF({ q: "", sort: "name", risk: false, ungraded: false })}
        sortOptions={[["name", "الاسم (أ-ي)"], ["avgDesc", "معدل الثلاثي (الأعلى)"], ["avgAsc", "معدل الثلاثي (الأدنى)"], ["annual", "المعدل السنوي (الأعلى)"]]}>
        <div className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" id="riskSw" checked={f.risk}
            onChange={(e) => setF((x) => ({ ...x, risk: e.target.checked }))} />
          <label className="form-check-label small fw-semibold" htmlFor="riskSw">{t("يحتاجون دعمًا (<10)")}</label>
        </div>
        <div className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" id="ungrSw" checked={f.ungraded}
            onChange={(e) => setF((x) => ({ ...x, ungraded: e.target.checked }))} />
          <label className="form-check-label small fw-semibold" htmlFor="ungrSw">{t("غير مُنقَّطين فقط")}</label>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv}>{t("تصدير CSV")}</button>
      </FilterBar>

      {students && students.length > 0 && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="fw-bold small mb-1">{t("توزيع نقاط الفوج — الثلاثي الحالي")}</div>
            <div className="dist-chart">
              {dist.map((d) => (
                <div key={d.label} className={`dist-col ${d.cls}`}>
                  <span className="dist-num">{d.n}</span>
                  <div className="dist-bar" style={{ height: `${Math.max(4, (d.n / maxDist) * 72)}px` }} />
                  <span className="dist-label">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="d-flex gap-2 mb-3">
        <input className="form-control rounded-pill" style={{ maxWidth: 320 }} placeholder={t("اسم تلميذ جديد…")}
          value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStudent()} />
        <button className="btn btn-dark rounded-pill px-4" onClick={addStudent}>+ {t("إضافة")}</button>
      </div>

      {students === null ? <Spinner /> : students.length === 0 ? (
        <EmptyState icon="‍" title={t("لا تلاميذ في هذا الفوج بعد")} hint={t("أضف الأسماء فرديًا أو الصق القائمة كاملة عبر «إضافة جماعية».")}
          actionLabel={" " + t("إضافة جماعية")} onAction={() => setBulk(true)} />
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 grade-table">
              <thead>
                <tr><th>#</th><th>{t("الاسم واللقب")}</th><th>{t("التقويم المستمر /20")}</th><th>{t("الفروض المحروسة /20")}</th>
                  <th>{t("الاختبار /20")}</th><th>{t("معدل الثلاثي")}</th><th>{t("المعدل السنوي")}</th><th></th></tr>
              </thead>
              <tbody>
                {shownStudents.map((s, i) => {
                  const v = edits[`${s.id}-${term}`] || {};
                  const cur = avgOf({ continuous: num(v.continuous), supervised: num(v.supervised), exam: num(v.exam) });
                  return (
                    <tr key={s.id}>
                      <td className="text-secondary">{i + 1}</td>
                      <td className="fw-semibold"><button type="button" className="student-profile-link" onClick={() => navigate(`/students/${s.id}`)}>{s.full_name}</button></td>
                      {["continuous", "supervised", "exam"].map((f) => (
                        <td key={f}>
                          <input type="number" min={0} max={20} step={0.25} className="form-control form-control-sm marks-input"
                            value={v[f] ?? ""} onChange={(e) => setMark(s.id, f, e.target.value)}
                            onBlur={() => saveMark(s.id)} placeholder="—" />
                        </td>
                      ))}
                      <td><span className={`avg-badge ${cur == null ? "none" : cur >= 10 ? "ok" : "low"}`}>{cur ?? "—"}</span></td>
                      <td>{s.annual_average ?? "—"}</td>
                      <td><div className="d-flex gap-1 flex-wrap"><button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => navigate(`/students/${s.id}`)}>{t("ملف التلميذ")}</button><button className="btn btn-sm btn-outline-danger rounded-pill" onClick={() => setConfirm(s)}>{t("حذف")}</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-footer bg-white border-0 small text-secondary">
            تُحفظ النقطة تلقائيًا عند مغادرة الخلية. النقاط على 20، والمعدل السنوي = معدل المعدلات الثلاثية المتوفرة.
          </div>
        </div>
      )}

      {bulk && cls && <BulkModal cls={cls} onClose={() => setBulk(false)} onDone={load} />}
      {confirm && (
        <ConfirmModal title={t("حذف التلميذ")} body={`سيُحذف «${confirm.full_name}» وكل نقاطه.`}
          onConfirm={() => delStudent(confirm)} onClose={() => setConfirm(null)} />
      )}
    </>
  );
}
