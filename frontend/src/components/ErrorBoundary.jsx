import { Component } from "react";
import { tr } from "../i18n";

/** Last-resort guard: a render error shows a recoverable message instead of a blank page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the details available for debugging without breaking the UI.
    console.error("TeacherHub render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container py-5" style={{ maxWidth: 560 }}>
          <div className="alert alert-danger shadow-sm">
            <div className="fw-bold mb-1">{tr("عذرًا، حدث خطأ في عرض هذه الصفحة")}</div>
            <div className="small">{tr("بياناتك محفوظة ولن تضيع. أعد تحميل الصفحة للمتابعة، وإذا تكرر الخطأ أخبرنا بما كنت تفعله.")}</div>
            <div className="small text-secondary mt-2">{String(this.state.error?.message || this.state.error || "")}</div>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-primary rounded-pill px-4" onClick={() => window.location.reload()}>{tr("إعادة تحميل الصفحة")}</button>
            <a className="btn btn-light rounded-pill px-4" href="/">{tr("العودة إلى لوحة القيادة")}</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
