import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, listOf, openingApi } from "../api";
import { useThemes } from "../hooks";
import { Spinner } from "../components/States";
import { useToast } from "../components/Toast";
import { useLang } from "../i18n";
import Icon from "../components/Icon";

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function OpeningPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const { themes } = useThemes();
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState("");
  const [classForm, setClassForm] = useState({ name: "", level: "" });
  const [studentClass, setStudentClass] = useState("");
  const [names, setNames] = useState("");
  const [slotClass, setSlotClass] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotForm, setSlotForm] = useState({ weekday: 0, start_time: "08:00", end_time: "09:00", room: "مخبر الإعلام الآلي" });
  const [journalForm, setJournalForm] = useState({ title: "", theme_id: "" });

  const load = useCallback(async () => {
    try {
      const data = await openingApi.status();
      setStatus(data);
      if (data.classes.length) {
        setStudentClass((v) => v || String(data.classes[0].id));
        setSlotClass((v) => v || String(data.classes[0].id));
      }
    } catch (error) { toast(error.message, "danger"); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api("/timetable/").then((data) => setSlots(listOf(data))).catch(() => {});
  }, [status]);

  if (!status) return <Spinner />;
  const stepState = (key) => status.steps.find((s) => s.key === key);

  const addClass = async () => {
    if (!classForm.name.trim()) { toast(t("اكتب اسم الفوج أولًا"), "danger"); return; }
    setBusy("class");
    try {
      await openingApi.quickClass(classForm);
      setClassForm({ name: "", level: "" });
      toast(t("أُنشئ الفوج"));
      load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const importStudents = async () => {
    if (!studentClass || !names.trim()) { toast(t("اختر الفوج والصق أسماء التلاميذ"), "danger"); return; }
    setBusy("students");
    try {
      const res = await openingApi.importStudents({ class_id: Number(studentClass), names });
      toast(`${t("استُورد")} ${res.created} ${t("تلميذ")} • ${t("تُخطّي")} ${res.skipped} • ${t("المجموع:")} ${res.total_students}`);
      setNames("");
      load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const addSlot = async () => {
    if (!slotClass) { toast(t("اختر الفوج أولًا"), "danger"); return; }
    setBusy("slot");
    try {
      await openingApi.quickSlot({ class_id: Number(slotClass), ...slotForm, weekday: Number(slotForm.weekday) });
      toast(t("أُضيفت الحصة الأسبوعية"));
      load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const createJournal = async () => {
    setBusy("journal");
    try {
      const res = await openingApi.quickJournal({ title: journalForm.title || undefined, theme_id: journalForm.theme_id || undefined });
      toast(`${t("أُنشئ الدفتر اليومي:")} ${res.title}`);
      load();
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const generateChecklist = async () => {
    setBusy("doc");
    try {
      const doc = await openingApi.generateChecklist();
      toast(t("وُلّد دليل افتتاح السنة"));
      navigate(`/editor/${doc.id}`);
    } catch (error) { toast(error.message, "danger"); }
    setBusy("");
  };

  const stepDone = (keys) => keys.every((k) => stepState(k)?.done);
  const PANELS = [
    { keys: ["profile"], title: "البطاقة المهنية" },
    { keys: ["classes"], title: "الأفواج" },
    { keys: ["students"], title: "قوائم التلاميذ" },
    { keys: ["timetable"], title: "التوقيت الأسبوعي" },
    { keys: ["courses", "journal", "holidays"], title: "المقرر والدفتر والعطل" },
    { keys: [], title: "الإنهاء والدليل" },
  ];

  const classSlots = slots.filter((s) => String(s.school_class) === String(slotClass));

  return (
    <>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">{t("معالج افتتاح السنة الدراسية")} — {status.school_year}</h3>
          <p className="text-secondary mb-0">{t("جهّز سنتك الدراسية خطوة بخطوة: بطاقتك، أفواجك، قوائم تلاميذك، توقيتك، ودفترك اليومي — كل خطوة تُحفظ فورًا في المنصة.")}</p>
        </div>
        <div className="opening-progress">
          <div className="fw-bold">{status.readiness}٪</div>
          <div className="text-secondary small">{status.done}/{status.total} {t("خطوات")}</div>
        </div>
      </div>

      <div className="progress exam-progress mb-4">
        <div className="progress-bar bg-success" style={{ width: `${status.readiness}%` }} />
      </div>

      <div className="d-flex flex-wrap gap-2 mb-4">
        {PANELS.map((panel, index) => (
          <button key={panel.title} type="button" onClick={() => setStep(index)}
            className={`btn rounded-pill ${step === index ? "btn-dark" : "btn-outline-dark"}`}>
            {stepDone(panel.keys) && panel.keys.length ? "✓ " : `${index + 1}. `}{t(panel.title)}
          </button>
        ))}
      </div>

      <div className="card border-0 shadow-sm mb-4"><div className="card-body">
        {step === 0 && (
          <>
            <h5 className="fw-bold">{t("بطاقتك الشخصية والمهنية")}</h5>
            <p className="text-secondary">{t("تظهر بطاقتك في صفحة 2 من دفترك اليومي ودفتر المفتش وفي كل وثائقك الرسمية.")}</p>
            <div className="alert alert-light border d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span>{stepState("profile")?.done ? "✓" : "○"} {stepState("profile")?.detail}</span>
              <button className="btn btn-primary rounded-pill" onClick={() => navigate("/profile")}>{t("فتح البطاقة المهنية")}</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h5 className="fw-bold">{t("أفواج السنة الجديدة")}</h5>
            <div className="row g-2 align-items-end mb-3">
              <div className="col-12 col-md-5">
                <label className="form-label small fw-bold">{t("اسم الفوج")}</label>
                <input className="form-control" placeholder="1 ج م ع 1" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">{t("المستوى")}</label>
                <input className="form-control" placeholder={t("أولى ثانوي ج م ع")} value={classForm.level} onChange={(e) => setClassForm({ ...classForm, level: e.target.value })} />
              </div>
              <div className="col-12 col-md-3">
                <button className="btn btn-primary rounded-pill w-100" disabled={busy === "class"} onClick={addClass}>
                  {busy === "class" ? <span className="spinner-border spinner-border-sm" /> : `+ ${t("إنشاء فوج")}`}
                </button>
              </div>
            </div>
            <div className="d-flex flex-column gap-2">
              {status.classes.map((cls) => (
                <div key={cls.id} className="pm-row">
                  <span className="fw-bold flex-grow-1">{cls.name} <span className="text-secondary fw-normal small">{cls.level}</span></span>
                  <span className="badge text-bg-light border">{cls.students} {t("تلميذ")}</span>
                  <span className="badge text-bg-light border">{cls.slots} {t("حصة/أسبوع")}</span>
                </div>
              ))}
              {!status.classes.length && <p className="text-secondary small mb-0">{t("لا أفواج بعد — أنشئ أول فوج لهذه السنة.")}</p>}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h5 className="fw-bold">{t("استيراد قوائم التلاميذ")}</h5>
            <p className="text-secondary small">{t("الصق الأسماء اسمًا في كل سطر (أو مفصولة بفواصل) — الأسماء الموجودة تُتخطى تلقائيًا.")}</p>
            <div className="row g-2">
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">{t("الفوج")}</label>
                <select className="form-select" value={studentClass} onChange={(e) => setStudentClass(e.target.value)}>
                  {status.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name} ({cls.students})</option>)}
                </select>
              </div>
              <div className="col-12 col-md-8">
                <label className="form-label small fw-bold">{t("أسماء التلاميذ")}</label>
                <textarea className="form-control" rows="7" value={names} onChange={(e) => setNames(e.target.value)} placeholder={"أحمد بن يوسف\nسارة العلوي\nمحمد الأمين"} />
              </div>
            </div>
            <button className="btn btn-primary rounded-pill px-4 mt-3" disabled={busy === "students"} onClick={importStudents}>
              {busy === "students" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="upload" size={15} /> {t("استيراد الأسماء")}</>}
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h5 className="fw-bold">{t("التوقيت الأسبوعي لكل فوج")}</h5>
            <div className="row g-2 align-items-end mb-3">
              <div className="col-6 col-md-3">
                <label className="form-label small fw-bold">{t("الفوج")}</label>
                <select className="form-select" value={slotClass} onChange={(e) => setSlotClass(e.target.value)}>
                  {status.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small fw-bold">{t("اليوم")}</label>
                <select className="form-select" value={slotForm.weekday} onChange={(e) => setSlotForm({ ...slotForm, weekday: e.target.value })}>
                  {WEEKDAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small fw-bold">{t("من")}</label>
                <input type="time" className="form-control" value={slotForm.start_time} onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small fw-bold">{t("إلى")}</label>
                <input type="time" className="form-control" value={slotForm.end_time} onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })} />
              </div>
              <div className="col-12 col-md-3">
                <button className="btn btn-primary rounded-pill w-100" disabled={busy === "slot"} onClick={addSlot}>
                  {busy === "slot" ? <span className="spinner-border spinner-border-sm" /> : `+ ${t("إضافة حصة")}`}
                </button>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-1">
              {classSlots.map((slot) => (
                <span key={slot.id} className="badge text-bg-light border">{WEEKDAYS[slot.weekday]} {String(slot.start_time).slice(0, 5)}–{String(slot.end_time || "").slice(0, 5)}</span>
              ))}
              {!classSlots.length && <span className="text-secondary small">{t("لا حصص لهذا الفوج بعد.")}</span>}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h5 className="fw-bold">{t("المقرر والدفتر اليومي والعطل")}</h5>
            <div className="d-flex flex-column gap-2 mb-4">
              {[["courses", "/courses"], ["holidays", "/calendar"]].map(([key, link]) => (
                <div key={key} className="alert alert-light border d-flex justify-content-between align-items-center flex-wrap gap-2 mb-0">
                  <span>{stepState(key)?.done ? "✓" : "○"} <b>{stepState(key)?.label}</b> — {stepState(key)?.detail}</span>
                  <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => navigate(link)}>{t("فتح")}</button>
                </div>
              ))}
            </div>
            <h6 className="fw-bold">{t("إنشاء دفتر يومي للسنة")}</h6>
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-5">
                <label className="form-label small fw-bold">{t("عنوان الدفتر")}</label>
                <input className="form-control" placeholder={`${t("الدفتر اليومي")} ${status.school_year}`} value={journalForm.title} onChange={(e) => setJournalForm({ ...journalForm, title: e.target.value })} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold">{t("سمة الدفتر")}</label>
                <select className="form-select" value={journalForm.theme_id} onChange={(e) => setJournalForm({ ...journalForm, theme_id: e.target.value })}>
                  <option value="">{t("بدون سمة")}</option>
                  {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name_ar}</option>)}
                </select>
              </div>
              <div className="col-12 col-md-3">
                <button className="btn btn-primary rounded-pill w-100" disabled={busy === "journal"} onClick={createJournal}>
                  {busy === "journal" ? <span className="spinner-border spinner-border-sm" /> : t("إنشاء دفتر السنة")}
                </button>
              </div>
            </div>
            <div className="mt-2 small">{stepState("journal")?.done ? "✓" : "○"} {stepState("journal")?.detail}
              {" • "}<button className="btn btn-link btn-sm p-0" onClick={() => navigate("/themes")}>{t("استوديو السمات")}</button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h5 className="fw-bold">{t("مراجعة الافتتاح ودليله")}</h5>
            <div className="table-responsive">
              <table className="table table-sm align-middle exam-table">
                <tbody>
                  {status.steps.map((row) => (
                    <tr key={row.key}>
                      <td>{row.done ? "✓" : "○"}</td>
                      <td className="fw-bold">{row.label}</td>
                      <td className="text-secondary">{row.detail}</td>
                      <td><button className="btn btn-sm btn-light border rounded-pill" onClick={() => navigate(row.link)}>{t("فتح")}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn btn-primary rounded-pill px-4" disabled={busy === "doc"} onClick={generateChecklist}>
              {busy === "doc" ? <span className="spinner-border spinner-border-sm" /> : <><Icon name="printer" size={15} /> {t("توليد دليل افتتاح السنة")}</>}
            </button>
          </>
        )}

        <div className="d-flex justify-content-between mt-4">
          <button className="btn btn-light rounded-pill px-4" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>→ {t("السابق")}</button>
          <button className="btn btn-dark rounded-pill px-4" disabled={step === PANELS.length - 1} onClick={() => setStep((s) => s + 1)}>{t("التالي")} ←</button>
        </div>
      </div></div>
    </>
  );
}
