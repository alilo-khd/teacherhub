export const KIND_LABELS = {
  blank: "وثيقة فارغة",
  "editable-copy": "نسخة قابلة للتحرير",
  exam: "اختبار / فرض",
  worksheet: "ورقة عمل / نشاط",
  rubric: "شبكة تقويم",
  flashcards: "بطاقات تعليمية",
  certificate: "شهادات تقدير",
  seating: "مخطط جلوس",
  "name-tags": "بطاقات أسماء",
  poster: "ملصق قسم",
  "parent-letter": "رسالة / إشعار لأولياء التلاميذ",
  "meeting-minutes": "محضر اجتماع",
  "report-card": "كشف / تقرير تلميذ",
  "permission-slip": "رخصة / إذن خروج",
  invitation: "دعوة نشاط",
  "attendance-sheet": "سجل الحضور والغياب",
  "tracker-sheet": "سجل متابعة الواجبات والسلوك",
  "student-id-cards": "بطاقات هوية التلاميذ",
};

export const TOOL_GROUPS = [
  {
    label: "حزمة التقويم والأنشطة",
    tools: [
      { kind: "exam", label: "منشئ الاختبارات والفروض", desc: "أسئلة قصيرة واختيار من متعدد وصح/خطأ ومقالية مع مفتاح إجابة اختياري.", icon: "clipboard" },
      { kind: "worksheet", label: "منشئ أوراق العمل", desc: "أنشطة صفية قابلة للطباعة مع أسطر إجابة وقائمة مراجعة قبل التسليم.", icon: "pen" },
      { kind: "rubric", label: "منشئ شبكات التقويم", desc: "معايير ومستويات أداء لتقويم المشاريع والمهام العملية.", icon: "chart" },
      { kind: "flashcards", label: "بطاقات تعليمية", desc: "بطاقات وجه/ظهر للمراجعة والحفظ — اطبع واقصص.", icon: "layers" },
    ],
  },
  {
    label: "حزمة القسم والتنظيم",
    tools: [
      { kind: "certificate", label: "شهادات تقدير جماعية", desc: "شهادة لكل تلميذ من قائمة أسماء — صفحة لكل شهادة.", icon: "sparkle" },
      { kind: "seating", label: "مخطط جلوس القسم", desc: "شبكة مقاعد تُعبَّأ تلقائيًا بأسماء أي فوج.", icon: "grid" },
      { kind: "name-tags", label: "بطاقات أسماء", desc: "بطاقات أسماء التلاميذ للمقاعد أو الأنشطة الجماعية.", icon: "id" },
      { kind: "poster", label: "ملصقات القسم", desc: "قواعد المخبر وتعليمات ولوحات تعليق بخط كبير.", icon: "palette" },
      { kind: "student-id-cards", label: "بطاقات هوية التلاميذ", desc: "بطاقات هوية بأسماء التلاميذ وأقسامهم والمؤسسة والسنة الدراسية.", icon: "id" },
      { kind: "attendance-sheet", label: "سجل الحضور والغياب", desc: "جدول حضور شهري جاهز بأيام مرقمة وخانات فارغة.", icon: "calendar" },
      { kind: "tracker-sheet", label: "سجل متابعة الواجبات والسلوك", desc: "متابعة أسبوعية للواجبات والانضباط والمشاركة.", icon: "clipboard" },
    ],
  },
  {
    label: "حزمة الإدارة والتواصل",
    tools: [
      { kind: "parent-letter", label: "رسائل وإشعارات الأولياء", desc: "مراسلات رسمية لأولياء التلاميذ مع إمضاءات.", icon: "file" },
      { kind: "meeting-minutes", label: "محاضر الاجتماعات", desc: "حضور وجدول أعمال وقرارات وتوصيات موقعة.", icon: "users" },
      { kind: "report-card", label: "كشوف وتقارير التلاميذ", desc: "نقاط وتقديرات وملاحظات أستاذ قابلة للتعديل.", icon: "book" },
      { kind: "permission-slip", label: "رخص الخروج والغياب", desc: "تصاريح ولي التلميذ والإدارة بصيغة رسمية.", icon: "check" },
      { kind: "invitation", label: "دعوات الأنشطة", desc: "دعوات أيام مفتوحة ومعارض ونشاطات بيداغوجية.", icon: "sun" },
    ],
  },
];

export const BLOCK_TYPES = [
  ["cover", "غلاف"], ["heading", "عنوان قسم"], ["text", "نص"],
  ["fields", "حقول معلومات"], ["table", "جدول"], ["checklist", "قائمة مراجعة"],
  ["questions", "أسئلة"], ["cards", "بطاقات تعليمية"], ["certificates", "شهادات"],
  ["seating", "مخطط جلوس"], ["labels", "بطاقات أسماء"], ["idcards", "بطاقات هوية"], ["poster", "ملصق"],
  ["signatures", "إمضاءات"], ["pagebreak", "فاصل صفحة"],
];

export function newBlock(type) {
  switch (type) {
    case "cover": return { type, title: "عنوان الوثيقة", subtitle: "", meta: [] };
    case "heading": return { type, text: "عنوان القسم" };
    case "text": return { type, text: "اكتب النص هنا…" };
    case "fields": return { type, title: "معلومات", rows: [["الحقل", "القيمة"]] };
    case "table": return { type, title: "جدول", headers: ["العمود 1", "العمود 2"], rows: [["", ""]] };
    case "checklist": return { type, title: "قائمة مراجعة", items: ["عنصر أول", "عنصر ثانٍ"] };
    case "questions": return { type, title: "الأسئلة", show_answers: false, questions: [{ prompt: "اكتب السؤال هنا؟", qtype: "سؤال قصير", points: 2, options: [], answer: "", lines: 3 }] };
    case "cards": return { type, title: "بطاقات تعليمية", cards: [{ front: "الوجه", back: "الظهر" }] };
    case "certificates": return { type, title: "شهادة تقدير وتشجيع", text: "تقديرًا للتميز والمثابرة.", names: ["اسم التلميذ"], signer: "الأستاذ(ة)", date: "" };
    case "seating": return { type, title: "مخطط جلوس القسم", front: "السبورة / واجهة القسم", rows: 4, cols: 5, seats: [] };
    case "labels": return { type, title: "بطاقات أسماء", subtitle: "", names: ["اسم التلميذ"] };
    case "idcards": return { type, title: "بطاقات هوية التلاميذ", cards: [{ name: "اسم التلميذ", meta: "القسم: …", footer: "السنة الدراسية: …" }] };
    case "poster": return { type, title: "عنوان الملصق", subtitle: "", text: "نص الملصق…", footer: "" };
    case "signatures": return { type, roles: ["الأستاذ(ة)", "الإدارة"] };
    case "pagebreak": return { type };
    default: return { type: "text", text: "" };
  }
}
