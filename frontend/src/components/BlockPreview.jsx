/** Live print-style preview of Creator Studio blocks (mirrors the PDF). */
const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

function Paras({ text }) {
  return String(text || "…").split("\n").filter((x) => x.trim() !== "").map((line, i) => (
    <p key={i} className="doc-text">{line}</p>
  ));
}

export default function BlockPreview({ blocks = [], theme, title = "", orientation = "portrait" }) {
  const v = theme?.css_vars;
  let qno = 0;
  const answers = [];
  return (
    <div className={`doc-page block-preview ${orientation === "landscape" ? "is-landscape" : ""}`} style={v}>
      {blocks.length === 0 && <p className="doc-text">وثيقة فارغة — أضف كتل محتوى من المحرّر.</p>}
      {blocks.map((b, i) => {
        if (b.hidden) return null;
        switch (b.type) {
          case "cover":
            return (
              <div key={i} className="doc-cover-frame block-cover">
                <div className="doc-cover-en">TEACHERHUB DOCUMENT</div>
                <h2 className="doc-cover-title" style={{ fontFamily: theme?.heading_font }}>{b.title || title}</h2>
                <div className="doc-flourish">— ◆ —</div>
                {b.subtitle && <div className="doc-cover-name">{b.subtitle}</div>}
                <div className="doc-cover-meta">{(b.meta || []).map((m, j) => <div key={j}>{m}</div>)}</div>
              </div>
            );
          case "heading":
            return <div key={i} className="doc-band" style={{ fontFamily: theme?.heading_font }}>{b.text}</div>;
          case "text":
            return <div key={i}><Paras text={b.text} /></div>;
          case "fields":
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                <table className="table table-bordered block-table"><tbody>
                  {(b.rows || []).map((r, j) => <tr key={j}><th>{r[0]}</th><td>{r[1] || ""}</td></tr>)}
                </tbody></table>
              </div>
            );
          case "table":
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                <table className="table table-bordered block-table">
                  <thead><tr>{(b.headers || []).map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
                  <tbody>{(b.rows || []).map((r, j) => <tr key={j}>{(b.headers || r).map((_, k) => <td key={k}>{r[k] || ""}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          case "checklist":
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                <ul className="block-check">{(b.items || []).map((x, j) => <li key={j}>☐ {x}</li>)}</ul>
              </div>
            );
          case "questions": {
            const start = qno;
            const rendered = (b.questions || []).map((q, j) => {
              qno += 1;
              const n = qno;
              if (q.answer) answers.push([n, q]);
              return (
                <div key={j} className="block-question">
                  <div className="block-q-head"><span>{n}. {q.prompt}</span>{q.points !== "" && q.points != null && <span className="block-q-points">{q.points} ن</span>}</div>
                  {(q.options || []).filter(Boolean).length > 0 && (
                    <div className="block-q-options">{q.options.filter(Boolean).map((o, k) => <span key={k}>{LETTERS[k] || k + 1}. {o}</span>)}</div>
                  )}
                  {Number(q.lines) > 0 && <div>{Array.from({ length: Number(q.lines) }).map((_, k) => <div key={k} className="block-write-line" />)}</div>}
                </div>
              );
            });
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                {rendered}
                {b.show_answers && answers.length > 0 && (
                  <>
                    <div className="doc-band doc-band-sm">مفتاح الإجابة / عناصر التصحيح</div>
                    <table className="table table-bordered block-table"><tbody>
                      {answers.splice(0, answers.length).map(([n, q]) => <tr key={n}><th>{n}</th><td>{q.prompt}</td><td><b>{q.answer}</b></td></tr>)}
                    </tbody></table>
                    <span hidden>{start}</span>
                  </>
                )}
              </div>
            );
          }
          case "cards":
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                <div className="block-cards">{(b.cards || []).map((c, j) => (
                  <div key={j} className="block-flash"><div className="block-flash-front">{c.front}</div><div>{c.back}</div></div>
                ))}</div>
              </div>
            );
          case "certificates":
            return (b.names || []).map((name, j) => (
              <div key={`${i}-${j}`} className="block-cert">
                <div className="block-cert-title" style={{ fontFamily: theme?.heading_font }}>{b.title}</div>
                <div>تُمنح هذه الشهادة إلى</div>
                <div className="block-cert-name">{name}</div>
                <p>{b.text}</p>
                <div className="block-sign-row"><span>التاريخ: {b.date || "…………"}</span><span>الإمضاء: {b.signer || "…………"}</span></div>
              </div>
            ));
          case "seating": {
            const rows = Math.max(1, Number(b.rows) || 4), cols = Math.max(1, Number(b.cols) || 5);
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                <div className="block-seat-front">{b.front || "السبورة"}</div>
                <table className="table table-bordered block-seat-table"><tbody>
                  {Array.from({ length: rows }).map((_, r) => (
                    <tr key={r}>{Array.from({ length: cols }).map((_, c) => <td key={c}>{(b.seats || [])[r * cols + c] || "·"}</td>)}</tr>
                  ))}
                </tbody></table>
              </div>
            );
          }
          case "idcards":
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                <div className="block-idcards">{(b.cards || []).map((c, j) => (
                  <div key={j} className="block-idcard"><div className="block-label-name">{c.name}</div><div className="fw-semibold">{c.meta}</div><div className="small">{c.footer}</div></div>
                ))}</div>
              </div>
            );
          case "labels":
            return (
              <div key={i}>
                {b.title && <div className="doc-band doc-band-sm">{b.title}</div>}
                <div className="block-labels">{(b.names || []).map((name, j) => (
                  <div key={j} className="block-label"><div className="block-label-name">{name}</div><div className="small">{b.subtitle}</div></div>
                ))}</div>
              </div>
            );
          case "poster":
            return (
              <div key={i} className="block-poster">
                <div className="block-poster-title" style={{ fontFamily: theme?.heading_font }}>{b.title}</div>
                {b.subtitle && <div className="block-poster-sub">{b.subtitle}</div>}
                <div className="block-poster-text"><Paras text={b.text} /></div>
                {b.footer && <div className="doc-cover-theme">{b.footer}</div>}
              </div>
            );
          case "signatures":
            return (
              <div key={i} className="block-signatures">{(b.roles || []).map((r, j) => (
                <div key={j}><div>{r}</div><div className="block-sign-line" /></div>
              ))}</div>
            );
          case "pagebreak":
            return <div key={i} className="block-pagebreak">— فاصل صفحة —</div>;
          default:
            return null;
        }
      })}
    </div>
  );
}
