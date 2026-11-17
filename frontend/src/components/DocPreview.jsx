/** Renders a journal / lesson plan / note book mock page styled by a theme. */
export default function DocPreview({ type, item, theme }) {
  if (!item || !theme) return null;
  const v = theme.css_vars;
  if (type === "lesson-plan") {
    return (
      <div className="doc-page" style={v}>
        <div className="doc-band" style={{ fontFamily: theme.heading_font }}>خطة الدرس</div>
        <h4 className="doc-title" style={{ fontFamily: theme.heading_font }}>{item.title}</h4>
        <table className="table table-bordered doc-table">
          <tbody>
            <tr><th>المادة</th><td>{item.subject}</td><th>المستوى</th><td>{item.level}</td></tr>
            <tr><th>المجال</th><td>{item.domain}</td><th>الوحدة</th><td>{item.unit}</td></tr>
            <tr><th>المدة</th><td>{item.duration} دقيقة</td><th>السمة</th><td>{theme.name_ar}</td></tr>
          </tbody>
        </table>
        <div className="doc-band doc-band-sm">أهداف الدرس</div>
        <p className="doc-text">{item.objectives || "…"}</p>
        <div className="doc-band doc-band-sm">خطوات تنفيذ الدرس</div>
        <table className="table table-bordered doc-table">
          <thead><tr><th>المرحلة</th><th>الزمن</th><th>إجراءات الأستاذ</th><th>أنشطة المتعلم</th></tr></thead>
          <tbody>
            {(item.phases || []).map((p, i) => (
              <tr key={i}><td>{p.phase}</td><td>{p.minutes} د</td><td>{p.teacher}</td><td>{p.learners}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === "course") {
    return (
      <div className="doc-page" style={v}>
        <div className="doc-band" style={{ fontFamily: theme.heading_font }}>مذكرة الدرس — {item.order}</div>
        <h4 className="doc-title" style={{ fontFamily: theme.heading_font }}>{item.title}</h4>
        <table className="table table-bordered doc-table">
          <tbody>
            <tr><th>الميدان</th><td>{item.domain || "—"}</td><th>الوحدة</th><td>{item.unit || "—"}</td></tr>
            <tr><th>المستوى</th><td>{item.level || "—"}</td><th>السمة</th><td>{theme.name_ar}</td></tr>
          </tbody>
        </table>
        <div className="doc-band doc-band-sm">النقاط الأساسية التي يكتبها التلاميذ</div>
        {(item.key_points || []).length
          ? <ul className="doc-text">{item.key_points.map((point, i) => <li key={i}>{point}</li>)}</ul>
          : <p className="doc-text">…</p>}
        <div className="doc-band doc-band-sm">ملخص محتوى الدرس</div>
        <p className="doc-text">{item.summary || "…"}</p>
        {item.plan && <p className="doc-text"><b>خطة الدرس المرتبطة:</b> {item.plan.title}</p>}
      </div>
    );
  }
  const isJournal = type === "journal";
  return (
    <div className="doc-page doc-cover" style={v}>
      <div className="doc-cover-frame">
        <div className="doc-cover-en">D A I L Y &nbsp; J O U R N A L</div>
        <h2 className="doc-cover-title" style={{ fontFamily: theme.heading_font }}>
          {isJournal ? "الدفتر اليومي" : "دفتر الملاحظات"}
        </h2>
        <div className="doc-flourish">— ◆ —</div>
        <div className="doc-cover-name">{item.title}</div>
        <div className="doc-cover-meta">
          {isJournal ? (
            <>
              <div>المؤسسة: {item.institution || "…"}</div>
              <div>السنة الدراسية: {item.school_year || "…"}</div>
              <div>الأستاذ(ة): {item.teacher_name || "…"}</div>
            </>
          ) : (
            <div>القسم: {item.class_name || "…"}</div>
          )}
        </div>
        <div className="doc-cover-icons">▭ &nbsp; &lt;/&gt; &nbsp; ⚙ &nbsp; ▤ &nbsp; ⌁</div>
        <div className="doc-cover-theme">السمة: {theme.name_ar} • خط العنوان: {theme.heading_font}</div>
      </div>
    </div>
  );
}
