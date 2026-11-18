import { useEffect, useState, useRef, useCallback } from "react";
import { useLang } from "../i18n";
import { api } from "../api";

export default function ClassReassignmentPage() {
  const { t } = useLang();
  const [beforeClasses, setBeforeClasses] = useState([]);
  const [nowClasses, setNowClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [penColor, setPenColorState] = useState("#10233f");
  const [penWidth, setPenWidth] = useState(3.5);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    api("/classes/")
      .then((data) => {
        const results = Array.isArray(data) ? data : data.results || [];
        setNowClasses(results);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || t("فشل تحميل الأقسام"));
        setLoading(false);
      });
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = ctxRef.current;
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = penColor;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
  }, [penWidth, penColor]);

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr,
    };
  }, []);

  const startDrawing = useCallback((e) => {
    setDrawing(true);
    const p = getPos(e);
    setLastPos(p);
    const ctx = ctxRef.current;
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
  }, [getPos]);

  const draw = useCallback((e) => {
    if (!drawing) return;
    const p = getPos(e);
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setLastPos(p);
  }, [drawing, lastPos]);

  const stopDrawing = useCallback(() => setDrawing(false), []);

  const clearCanvas = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }, []);

  const handlePenColor = (color) => {
    setPenColorState(color);
    const ctx = ctxRef.current;
    if (ctx) ctx.strokeStyle = color;
  };

  const termLabel = (n) => {
    if (n === 1) return t("الثلاثي الأول");
    if (n === 2) return t("الثلاثي الثاني");
    if (n === 3) return t("الثلاثي الثالث");
    return String(n);
  };

  return (
    <div className="container py-4">
      {/* Hero — Journal K style */}
      <div
        className="d-flex flex-column align-items-center text-center"
        style={{
          background: "linear-gradient(120deg, #0d1d33 0%, #16324f 55%, #1d4a43 130%)",
          color: "#fff",
          borderRadius: "16px",
          padding: "28px 32px",
          marginBottom: "26px",
          boxShadow: "0 2px 4px rgba(16,35,63,0.06), 0 14px 34px rgba(16,35,63,0.1)",
        }}
      >
        <h1 className="fw-bold mb-2" style={{ fontSize: "28px" }}>
          {t("تغيير الإسناد")}
        </h1>
        <p className="mb-0" style={{ fontSize: "16px", color: "#cbd5e1", fontWeight: 500 }}>
          {t("أقسام كانت تخصني سابقاً، وأقسام تخصني الآن")}
        </p>
      </div>

      <div className="row g-4">
        {/* Card 1: Sections that belonged to me before */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <span
                className="badge"
                style={{
                  background: "#c2413a",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: "20px",
                }}
              >
                {t("الأقسام السابقة")}
              </span>
              <h5 className="fw-bold mt-3 mb-2">{t("أقسام كانت تخصني سابقاً")}</h5>
              <p className="text-muted small mb-3">
                {t("سجل الأقسام التي كانت تحت إسنادك قبل عملية النقل")}
              </p>
              <ul className="list-group list-group-flush">
                {beforeClasses.length === 0 ? (
                  <li className="list-group-item bg-transparent border-0 p-4 text-center">
                    <div className="text-muted" style={{ fontStyle: "italic" }}>
                      {t("لا توجد أقسام تم نقل ملكيتها.")}<br />
                      {t(
                        "لم يتم تسجيل أي نقل ملكية لأقسام كانت تخصك مسبقاً."
                      )}
                    </div>
                  </li>
                ) : (
                  beforeClasses.map((cls) => (
                    <li key={cls.id} className="list-group-item bg-light border-0">
                      <div className="d-flex justify-content-between align-items-start">
                        <span className="fw-semibold">{cls.name}</span>
                        <span className="badge bg-danger">سابقاً</span>
                      </div>
                      <div className="text-secondary small mt-1">
                        {cls.level} • {t("التلاميذ")}:{" "}
                        {cls.students_count ?? 0}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Card 2: Sections that belong to me now (with stylus writing) */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column">
              <span
                className="badge"
                style={{
                  background: "#177e6c",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: "20px",
                }}
              >
                {t("الأقسام الحالية")}
              </span>
              <h5 className="fw-bold mt-3 mb-2">{t("أقسام تخصني الآن")}</h5>
              <p className="text-muted small mb-3">
                {t(
                  "الأقسام المسجلة باسمك حالياً والمعتمدة للإسناد — مساحة للكتابة اليدوية بالقلم (Stylus)"
                )}
              </p>

              {/* Notes-style entry list (ملاحظات) */}
              <ul className="list-group list-group-flush entry-list mb-3">
                {nowClasses.length === 0 ? (
                  <li className="list-group-item bg-transparent border-0 p-3 text-center">
                    <div className="text-muted" style={{ fontStyle: "italic" }}>
                      {t("ابدأ بإضافة قسم جديد ليظهر هنا.")}
                    </div>
                  </li>
                ) : (
                  nowClasses.map((cls) => (
                    <li key={cls.id} className="list-group-item d-flex gap-3 align-items-start bg-transparent border-0">
                      <span
                        className="badge rounded-pill"
                        style={{
                          background: "#e5f3ef",
                          color: "#177e6c",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {t("حالياً")}
                      </span>
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{cls.name}</div>
                        <div className="text-secondary small mb-1">
                          {cls.level} • {t("التلاميذ")}:{" "}
                          {cls.students_count ?? 0}
                        </div>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {cls.term && (
                            <span className="point-chip">
                              {t("الثلاثي")} {termLabel(cls.term)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>

              {/* Stylus writing area — Notes (ملاحظات) style */}
              <h6 className="fw-bold mb-2">{t("ملاحظات الإسناد (اكتب بالقلم)")}</h6>
              <div
                className="position-relative"
                style={{
                  border: "2px dashed var(--line)",
                  borderRadius: "14px",
                  background: "#fff",
                  minHeight: "300px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  boxShadow:
                    "inset 0 2px 6px rgba(16,35,63,0.04)",
                  marginBottom: "14px",
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    cursor: "crosshair",
                    borderRadius: "12px",
                    boxShadow: "0 6px 18px rgba(16,35,63,0.10)",
                  }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseOut={stopDrawing}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startDrawing(e);
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    draw(e);
                  }}
                  onTouchEnd={stopDrawing}
                />
                {drawing ? null : (
                  <div
                    className="write-empty"
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: "46px 16px",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ width: "56px", height: "56px", marginBottom: "14px", color: "#94a3b8" }}
                    >
                      <path d="M19 21l-7-7 7-7" />
                      <path d="M22 12c0 4.714-3.482 8.583-7.934 9.067a5.01 5.01 0 01-4.133 0C9.482 20.583 6 16.714 6 12c0-2.09 1.062-3.96 2.72-5.198a2.39 2.39 0 011.648-.807c1.039 0 1.923.64 2.298 1.597C14.29 7.48 17 10.19 17 12c0 1.292-.236 2.537-.68 3.695a5.01 5.01 0 01-4.133 0C10.482 15.583 7 11.714 7 7c0-2.09 1.062-3.96 2.72-5.198a2.39 2.39 0 011.648-.807c1.039 0 1.923.64 2.298 1.597C13.29 2.48 16 4.19 16 7c0 2.866-2.482 5.583-5.934 6.067a5.01 5.01 0 01-4.133 0C6.482 10.583 3 8.714 3 7c0-2.09 1.062-3.96 2.72-5.198a2.39 2.39 0 011.648-.807c1.039 0 1.923.64 2.298 1.597C11.29 2.48 14 4.19 14 7c0 2.09-1.062 3.96-2.72 5.198a2.39 2.39 0 00-1.648.807c-1.039 0-1.923-.64-2.298-1.597C9.71 8.48 7 5.19 7 3c0-2.866 2.482-5.583 5.934-6.067a5.01 5.01 0 014.133 0C15.482 3.417 17 5.286 17 7c0 2.09-1.062 3.96-2.72 5.198a2.39 2.39 0 00-1.648.807c-1.039 0-1.923.64-2.298-1.597C10.71 10.48 8 12.19 8 12c0 4.714 3.482 8.583 7.934 9.067a5.01 5.01 0 004.133 0C18.518 20.583 22 16.714 22 12c0-2.09-1.062-3.96-2.72-5.198a2.39 2.39 0 00-1.648-.807c-1.039 0-1.923.64-2.298-1.597C12.71 10.48 10 12.19 10 12c0 2.09-1.062 3.96-2.72 5.198a2.39 2.39 0 001.648.807c1.039 0 1.923-.64 2.298-1.597C14.71 10.48 12 12.19 12 12z" />
                    </svg>
                    <p className="mb-0" style={{ fontSize: "15px" }}>
                      {t("اكتب هنا بالقلم (Stylus) أو الماوس — مساحة للكتابة اليدوية لتسجيل ملاحظات الإسناد")}
                    </p>
                  </div>
                )}
              </div>

              <div className="d-flex flex-wrap gap-2 justify-content-center mb-2">
                {["#10233f", "#c2413a", "#177e6c", "#1b3a63", "#c2a059"].map(
                  (color) => (
                    <button
                      key={color}
                      type="button"
                      className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                      style={{
                        background:
                          penColor === color ? color : "var(--surface)",
                        color: penColor === color ? "#fff" : "var(--ink-2)",
                        borderColor:
                          penColor === color ? color : "var(--line)",
                      }}
                      onClick={() => handlePenColor(color)}
                    >
                      {color === "#10233f" ? t("أسود") : color === "#c2413a" ? t("أحمر") : color === "#177e6c" ? t("أخضر") : color === "#1b3a63" ? t("أزرق") : t("ذهبي")}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger rounded-pill px-3"
                  onClick={clearCanvas}
                >
                  {t("مسح الكل")}
                </button>
              </div>
              <p className="text-muted small" style={{ textAlign: "center" }}>
                {t(
                  "استخدم القلم الرقمي (Stylus) أو إصبعك للكتابة على الورقة أعلاه — وليس في محرر PDF"
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
