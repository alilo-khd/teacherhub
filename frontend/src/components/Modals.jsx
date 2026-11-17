import { useEffect, useState } from "react";
import { useLang } from "../i18n";

export function ModalShell({ title, children, onClose, wide }) {
  const { t, te } = useLang();
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${wide ? "modal-lg" : ""}`}>
          <div className="modal-content border-0 shadow-lg rounded-4">
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title fw-bold">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label={t("إغلاق")} />
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ResourceFormModal({ title, fields, initial, themes, onSubmit, onClose }) {
  const { t, te } = useLang();
  const [form, setForm] = useState(() => {
    const f = {};
    fields.forEach((x) => {
      const raw = initial?.[x.name] ?? x.default ?? "";
      f[x.name] = x.deserialize ? x.deserialize(raw) : raw;
    });
    if (themes) f.theme = initial?.theme ?? "";
    return f;
  });
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setForm((f) => ({ ...f, [k]: val }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...form };
    if (themes) payload.theme = form.theme === "" ? null : Number(form.theme);
    fields.forEach((x) => {
      if (x.type === "number") payload[x.name] = Number(payload[x.name] || 0);
      if (x.type === "select-id") payload[x.name] = payload[x.name] === "" || payload[x.name] == null ? null : Number(payload[x.name]);
      if (x.serialize) payload[x.name] = x.serialize(payload[x.name]);
    });
    try {
      await onSubmit(payload);
      onClose();
    } catch { setBusy(false); }
  };

  return (
    <ModalShell title={title} onClose={onClose} wide={fields.some((f) => f.type === "textarea")}>
      <form onSubmit={submit}>
        <div className="row g-3">
          {fields.map((f) => (
            <div className={f.wide ? "col-12" : "col-12 col-md-6"} key={f.name}>
              <label className="form-label fw-semibold small">{t(f.label)}{f.required && " *"}</label>
              {f.type === "textarea" ? (
                <textarea className="form-control" rows={f.type === "textarea" ? (f.rows || 3) : 3} value={form[f.name]}
                  onChange={(e) => set(f.name, e.target.value)} required={f.required} placeholder={f.placeholder ? t(f.placeholder) : undefined} />
              ) : f.type === "select" || f.type === "select-id" ? (
                <select className="form-select" value={form[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
                  {(f.options || []).map((o) => {
                    const [val, label] = Array.isArray(o) ? o : [o, o];
                    return <option key={String(val)} value={val}>{te(label)}</option>;
                  })}
                </select>
              ) : (
                <input className="form-control" type={f.type || "text"} value={form[f.name]}
                  onChange={(e) => set(f.name, e.target.value)} required={f.required} placeholder={f.placeholder ? t(f.placeholder) : undefined} />
              )}
            </div>
          ))}
          {themes && (
            <div className="col-12">
              <label className="form-label fw-semibold small">{t("السمة (الهوية البصرية)")}</label>
              <select className="form-select" value={form.theme} onChange={(e) => set("theme", e.target.value)}>
                <option value="">{t("بدون سمة —")}</option>
                {themes.map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="d-flex gap-2 mt-4">
          <button className="btn btn-primary rounded-pill px-4" disabled={busy}>
            {busy ? <span className="spinner-border spinner-border-sm" /> : t("حفظ")}
          </button>
          <button type="button" className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ConfirmModal({ title, body, onConfirm, onClose }) {
  const { t, te } = useLang();
  const [busy, setBusy] = useState(false);
  return (
    <ModalShell title={title} onClose={onClose}>
      <p className="text-secondary">{body}</p>
      <div className="d-flex gap-2">
        <button className="btn btn-danger rounded-pill px-4" disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } catch { setBusy(false); } }}>
          {busy ? <span className="spinner-border spinner-border-sm" /> : t("نعم، احذف")}
        </button>
        <button className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("تراجع")}</button>
      </div>
    </ModalShell>
  );
}

/** Pick one of the user's resources to apply a theme onto. */
export function ApplyThemeModal({ theme, resources, onApply, onClose }) {
  const { t, te } = useLang();
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const flat = [
    ...resources.journals.map((r) => ({ key: `journal:${r.id}`, label: ` دفتر: ${r.title}` })),
    ...resources.plans.map((r) => ({ key: `lesson-plan:${r.id}`, label: ` خطة درس: ${r.title}` })),
    ...resources.books.map((r) => ({ key: `notebook:${r.id}`, label: ` دفتر ملاحظات: ${r.title}` })),
    ...(resources.courses || []).map((r) => ({ key: `course:${r.id}`, label: ` درس: ${r.title}` })),
  ];
  return (
    <ModalShell title={`تطبيق سمة «${theme.name_ar}»`} onClose={onClose}>
      {flat.length === 0 ? (
        <p className="text-secondary mb-0">{t("لا توجد دفاتر أو خطط بعد — أنشئ واحدًا أولًا ثم طبّق عليه السمة.")}</p>
      ) : (
        <>
          <label className="form-label fw-semibold small">{t("اختر العنصر المستهدف")}</label>
          <select className="form-select mb-3" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">{t("اختر —")}</option>
            {flat.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <div className="d-flex gap-2">
            <button className="btn btn-primary rounded-pill px-4" disabled={!sel || busy}
              onClick={async () => {
                setBusy(true);
                const [resource_type, id] = sel.split(":");
                try { await onApply(theme.id, resource_type, Number(id)); onClose(); }
                catch { setBusy(false); }
              }}>
              {busy ? <span className="spinner-border spinner-border-sm" /> : t("تطبيق السمة")}
            </button>
            <button className="btn btn-light rounded-pill px-4" onClick={onClose}>{t("إلغاء")}</button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
