"""Creator Studio: block templates for new tools + snapshots of existing docs.

A block is a small dict rendered identically (as far as the medium allows)
by the PDF builder (hub.pdf.custom_doc) and the DOCX builder
(hub.docx_export.build_docx). The visual editor edits these blocks.
"""
from . import pdf as pdfdocs
from .models import (Course, Holiday, Institution, Journal, LessonPlan, NoteBook,
                     Observation, SchoolClass, Seminar, Session, Theme,
                     TimetableSlot, Visit, WEEKDAY_NAMES)
from .serializers import class_progress


# ---------------------------------------------------------------- block makers
def cover(title, subtitle="", meta=None):
    return {"type": "cover", "title": title, "subtitle": subtitle, "meta": meta or []}


def heading(text):
    return {"type": "heading", "text": text}


def text(body):
    return {"type": "text", "text": body}


def fields(rows, title=""):
    return {"type": "fields", "title": title, "rows": [[str(a), str(b)] for a, b in rows]}


def table(headers, rows, title=""):
    return {"type": "table", "title": title, "headers": [str(h) for h in headers],
            "rows": [[str(c) for c in r] for r in rows]}


def checklist(items, title=""):
    return {"type": "checklist", "title": title, "items": [str(i) for i in items]}


def signatures(roles):
    return {"type": "signatures", "roles": [str(r) for r in roles]}


def questions(items, title="الأسئلة", show_answers=False):
    return {"type": "questions", "title": title, "show_answers": show_answers, "questions": items}


def pagebreak():
    return {"type": "pagebreak"}


def wrap(blocks):
    return {"blocks": blocks}


# ---------------------------------------------------------------- templates
def template_content(kind, title=""):
    """Starter blocks for every toolbox kind (also used for blank docs)."""
    t = title or "وثيقة جديدة"
    if kind == "exam":
        return wrap([
            fields([("المادة", "الإعلام الآلي"), ("المستوى / القسم", ""), ("المدة", "60 دقيقة"),
                    ("النقطة", "/20"), ("الأستاذ(ة)", "")], "بطاقة الاختبار"),
            text("التعليمات: أجب عن جميع الأسئلة بوضوح. تُمنح نقطة كل سؤال كما هو مبيّن بجانبه."),
            questions([
                {"prompt": "عرّف نظام التشغيل واذكر ثلاثًا من وظائفه.", "qtype": "سؤال قصير", "points": 4, "options": [], "answer": "", "lines": 4},
                {"prompt": "أيّ مما يلي يُعدّ وحدة إدخال؟", "qtype": "اختيار من متعدد", "points": 2, "options": ["الشاشة", "الفأرة", "الطابعة", "مكبر الصوت"], "answer": "الفأرة", "lines": 0},
                {"prompt": "صح أم خطأ: ذاكرة RAM تفقد محتواها عند إيقاف الحاسوب.", "qtype": "صح / خطأ", "points": 2, "options": ["صح", "خطأ"], "answer": "صح", "lines": 0},
                {"prompt": "اشرح الفرق بين المكونات المادية والبرمجيات مع مثال لكل منهما.", "qtype": "سؤال مقالي", "points": 6, "options": [], "answer": "", "lines": 6},
            ], "أسئلة الاختبار"),
            signatures(["إمضاء الأستاذ(ة)"]),
        ])
    if kind == "worksheet":
        return wrap([
            fields([("الدرس", ""), ("القسم", ""), ("اسم التلميذ", ""), ("التاريخ", "")], "ورقة عمل"),
            text("الهدف: طبّق ما تعلّمته في الدرس عبر الأنشطة التالية، واعمل بهدوء وبخط واضح."),
            questions([
                {"prompt": "أكمل الفراغات بما يناسب مما تعلّمته في الدرس.", "qtype": "أكمل الفراغ", "points": 5, "options": [], "answer": "", "lines": 3},
                {"prompt": "صنّف العناصر التالية في جدول من عمودين.", "qtype": "تصنيف", "points": 5, "options": [], "answer": "", "lines": 4},
                {"prompt": "نشاط تطبيقي: نفّذ الخطوات على الحاسوب ثم لخّص النتيجة.", "qtype": "نشاط تطبيقي", "points": 10, "options": [], "answer": "", "lines": 5},
            ], "أنشطة ورقة العمل"),
            checklist(["راجعت إجاباتي", "كتبت اسمي وقسمي", "سلّمت الورقة في الوقت"], "قبل التسليم"),
        ])
    if kind == "rubric":
        return wrap([
            fields([("المهمة / المشروع", ""), ("التلميذ / الفوج", ""), ("المقيّم", ""), ("التاريخ", "")], "شبكة تقويم"),
            table(["المعيار", "ممتاز (4)", "جيد (3)", "يحتاج دعمًا (1-2)", "النقطة"],
                  [["الفهم والدقة", "فهم كامل ودقيق", "فهم جيد مع أخطاء بسيطة", "فهم جزئي", ""],
                   ["التطبيق العملي", "تطبيق مستقل ومتقن", "تطبيق صحيح بمساعدة قليلة", "صعوبة في التطبيق", ""],
                   ["التنظيم والعرض", "عرض واضح ومنظم", "عرض مقبول", "عرض غير منظم", ""],
                   ["العمل الجماعي", "مشاركة فعالة وقيادية", "مشاركة جيدة", "مشاركة محدودة", ""]], "معايير التقويم"),
            text("ملاحظات المقيّم ونقاط التحسين:"),
        ])
    if kind == "flashcards":
        return wrap([
            {"type": "cards", "title": "بطاقات تعليمية — اطبع واقصص",
             "cards": [{"front": f"مصطلح {i}", "back": "التعريف أو الإجابة…"} for i in range(1, 9)]},
        ])
    if kind == "certificate":
        return wrap([
            {"type": "certificates", "title": "شهادة تقدير وتشجيع",
             "text": "تقديرًا لتفوقه(ا) وتميّزه(ا) في مادة الإعلام الآلي خلال هذا الثلاثي، مع تمنياتنا بمزيد من النجاح.",
             "names": ["اسم التلميذ الأول", "اسم التلميذ الثاني"], "signer": "الأستاذ(ة)", "date": ""},
        ])
    if kind == "seating":
        return wrap([
            {"type": "seating", "title": "مخطط جلوس القسم", "front": "السبورة / واجهة القسم",
             "rows": 4, "cols": 5, "seats": []},
            text("ملاحظات: يمكن تعبئة المقاعد تلقائيًا بأسماء تلاميذ أي فوج من محرّر الوثيقة."),
        ])
    if kind == "name-tags":
        return wrap([
            {"type": "labels", "title": "بطاقات أسماء التلاميذ", "subtitle": "مادة الإعلام الآلي",
             "names": ["اسم التلميذ", "اسم التلميذ", "اسم التلميذ", "اسم التلميذ", "اسم التلميذ", "اسم التلميذ"]},
        ])
    if kind == "poster":
        return wrap([
            {"type": "poster", "title": "قواعد مخبر الإعلام الآلي",
             "subtitle": "قسم الإعلام الآلي",
             "text": "1. أجلس في مكاني المخصص ولا أبدّل الحواسيب.\n2. لا آكل ولا أشرب داخل المخبر.\n3. أحفظ عملي قبل نهاية الحصة.\n4. أرفع يدي لطلب المساعدة.",
             "footer": "حافظ على جهازك — فهو أداتك للتعلم"},
        ])
    if kind == "parent-letter":
        return wrap([
            fields([("المؤسسة", ""), ("التاريخ", ""), ("إلى السيد(ة)", "ولي التلميذ(ة):"), ("الموضوع", "إشعار بخصوص متابعة التلميذ")], ""),
            text("تحية طيبة وبعد،\nنعلمكم أن ابنكم(تكم) … قد … . نرجو منكم متابعة الأمر معنا والاتصال بالمؤسسة عند الحاجة، شاكرين لكم تعاونكم الدائم لما فيه مصلحة التلميذ."),
            signatures(["الأستاذ(ة)", "إدارة المؤسسة"]),
        ])
    if kind == "meeting-minutes":
        return wrap([
            fields([("المؤسسة", ""), ("تاريخ الاجتماع", ""), ("المكان", ""), ("رئيس الجلسة", ""), ("المقرر", "")], "محضر اجتماع"),
            table(["الحاضرون", "الصفة"], [["", ""], ["", ""]], "الحضور"),
            heading("جدول الأعمال"),
            text("1. …\n2. …\n3. مختلفات."),
            table(["المحور", "القرار المتخذ", "المسؤول", "الأجل"], [["", "", "", ""]], "القرارات والتوصيات"),
            signatures(["رئيس الجلسة", "المقرر"]),
        ])
    if kind == "report-card":
        return wrap([
            fields([("التلميذ(ة)", ""), ("القسم", ""), ("الثلاثي", "الأول"), ("المعدل العام", "")], "تقرير / كشف تلميذ"),
            table(["المادة / المهارة", "النقطة /20", "التقدير", "ملاحظة الأستاذ"],
                  [["الإعلام الآلي — الجانب النظري", "", "", ""], ["الإعلام الآلي — الجانب التطبيقي", "", "", ""]], "النتائج"),
            heading("ملاحظة الأستاذ وتوجيهاته"),
            text("…"),
            signatures(["الأستاذ(ة)", "ولي التلميذ (اطّلع ووقّع)"]),
        ])
    if kind == "permission-slip":
        return wrap([
            fields([("المؤسسة", ""), ("التلميذ(ة)", ""), ("القسم", ""), ("تاريخ الخروج", ""), ("السبب", "")], "رخصة خروج / إذن غياب"),
            text("أصرّح أنا الموقّع(ة) أسفله، ولي التلميذ(ة) المذكور(ة) أعلاه، بتحمّل مسؤولية خروجه(ا) في التاريخ والسبب المبينين، وألتزم بإعادته(ا) في الوقت المحدد."),
            signatures(["ولي التلميذ", "إدارة المؤسسة"]),
        ])
    if kind == "invitation":
        return wrap([
            {"type": "poster", "title": "دعوة لحضور نشاط بيداغوجي",
             "subtitle": "يوم مفتوح لمادة الإعلام الآلي",
             "text": "يسرّنا دعوتكم لحضور عرض مشاريع التلاميذ في البرمجة والمخططات الانسيابية.\nالمكان: مخبر الإعلام الآلي — التاريخ: … على الساعة: …",
             "footer": "حضوركم يشجع أبناءنا — مرحبًا بالجميع"},
        ])
    if kind == "attendance-sheet":
        return wrap([
            fields([("القسم", ""), ("الشهر", ""), ("الأستاذ(ة)", "")], "سجل الحضور والغياب"),
            table(["#", "اسم التلميذ"] + [str(i) for i in range(1, 16)],
                  [[str(i), ""] + [""] * 15 for i in range(1, 21)], "سجل الحضور (✓ حاضر • غ غائب)"),
        ])
    if kind == "tracker-sheet":
        return wrap([
            fields([("القسم", ""), ("الفترة", ""), ("الأستاذ(ة)", "")], "سجل متابعة الواجبات والسلوك"),
            table(["#", "اسم التلميذ"] + [f"الأسبوع {i}" for i in range(1, 9)],
                  [[str(i), ""] + [""] * 8 for i in range(1, 21)], "المتابعة الأسبوعية"),
        ])
    if kind == "student-id-cards":
        return wrap([
            {"type": "idcards", "title": "بطاقات هوية التلاميذ",
             "cards": [{"name": "اسم التلميذ", "meta": "القسم: …", "footer": "السنة الدراسية: 2025 / 2026"}]},
        ])
    return wrap([
        cover(t, "وثيقة قابلة للتحرير", []),
        heading("عنوان القسم الأول"),
        text("اكتب محتوى وثيقتك هنا. يمكنك إضافة أقسام وجداول وقوائم وأسئلة وبطاقات وغيرها من محرّر الوثيقة، ثم تصديرها PDF أو DOCX."),
    ])


# ---------------------------------------------------------------- snapshots
def _weekly_rows(slots):
    rows = []
    for wd in range(7):
        ds = [s for s in slots if s.weekday == wd]
        if ds:
            rows.append([WEEKDAY_NAMES[wd], "؛ ".join(
                f"{s.school_class.name} — {str(s.start_time)[:5]} • {s.room}" for s in sorted(ds, key=lambda x: x.start_time))])
    return rows


def _sessions_rows(sessions):
    return [[str(s.date), s.school_class.name, s.course.title if s.course else "—",
             "، ".join((s.points_written or [])[:4]) or "—", s.homework or "—", str(s.absentees)] for s in sessions]


SESS_HEADERS = ["التاريخ", "الفوج", "الدرس", "النقاط المكتوبة", "الواجب", "الغائبون"]


def snapshot_existing(source_type, source_id, user, profile):
    """Return (title, theme, blocks) — an editable copy of an existing document."""
    u = user
    prof_rows = pdfdocs.profile_fields(profile, u)
    default_theme = Theme.objects.filter(slug="gentleman-navy").first()

    def theme_of(obj):
        return getattr(obj, "theme", None) or default_theme

    slots = TimetableSlot.objects.filter(school_class__owner=u).select_related("school_class")
    holidays = Holiday.objects.filter(owner=u)
    seminars = Seminar.objects.filter(owner=u)

    if source_type == "journal":
        j = Journal.objects.get(pk=source_id, owner=u)
        sessions = list(j.sessions.select_related("school_class", "course").all())
        return (f"نسخة قابلة للتحرير — {j.title}", theme_of(j), [
            cover("الدفتر اليومي", "مادة الإعلام الآلي",
                  [f"المؤسسة: {j.institution}", f"السنة الدراسية: {j.school_year}", f"الأستاذ(ة): {j.teacher_name}"]),
            fields(prof_rows, "بطاقة الحالة الشخصية والمهنية"),
            table(["العطلة / المناسبة", "من", "إلى", "النوع"], [[h.name, str(h.start_date), str(h.end_date), h.kind] for h in holidays], "العطل المدرسية والمناسبات"),
            table(["التاريخ", "العنوان", "النوع", "المكان", "الجهة المنظمة"], [[str(s.date), s.title, s.kind, s.place, s.organizer] for s in seminars], "الندوات والملتقيات والأيام التكوينية"),
            table(["اليوم", "الحصص"], _weekly_rows(slots), "برنامج العمل الأسبوعي"),
            table(SESS_HEADERS, _sessions_rows(sessions), "سجلّ الحصص المنفَّذة"),
            table(["التاريخ", "الملاحظة"], [["", ""] for _ in range(8)], "ملاحظات"),
        ])
    if source_type == "inspector":
        institutions = Institution.objects.filter(owner=u)
        visits = Visit.objects.filter(owner=u).select_related("institution")
        obs = Observation.objects.filter(owner=u).select_related("institution", "course").first()
        return ("نسخة قابلة للتحرير — دفتر المفتش", default_theme, [
            cover("دفتر المفتش", "مادة الإعلام الآلي", [f"مقاطعة التفتيش: {profile.inspection_district}", f"المؤسسة: {profile.current_school}"]),
            fields(prof_rows, "بطاقة الحالة الشخصية والمهنية"),
            table(["المؤسسة", "النوع", "البلدية", "المدير", "الأساتذة"], [[i.name, i.kind, i.commune, i.director, str(i.teachers_count)] for i in institutions], "مؤسسات مقاطعة التفتيش"),
            table(["العطلة / المناسبة", "من", "إلى", "النوع"], [[h.name, str(h.start_date), str(h.end_date), h.kind] for h in holidays], "العطل المدرسية والمناسبات"),
            table(["التاريخ", "العنوان", "النوع", "المكان", "الجهة المنظمة"], [[str(s.date), s.title, s.kind, s.place, s.organizer] for s in seminars], "الندوات والملتقيات"),
            table(["اليوم", "الحصص"], _weekly_rows(slots), "برنامج العمل الأسبوعي"),
            table(["التاريخ", "المؤسسة", "النوع", "الأستاذ المُزار", "ملاحظات"], [[str(v.date), v.institution.name if v.institution else "—", v.visit_type, v.teacher_visited, (v.observations or "")[:90]] for v in visits], "سجلّ الزيارات التفتيشية"),
            fields([("الأستاذ(ة)", obs.teacher_name), ("المؤسسة", obs.institution.name if obs.institution else ""), ("القسم", obs.class_name), ("الدرس", obs.course.title if obs.course else ""), ("التاريخ", str(obs.date)), ("التقدير", f"{obs.percent}٪ — {obs.appreciation}")] if obs else [], "شبكة ملاحظة الحصة وتقييمها"),
            table(["#", "عنصر الملاحظة", "العلامة القصوى", "العلامة"], [[str(i), c.get("label", "") if isinstance(c, dict) else str(c), str(c.get("max", 4)) if isinstance(c, dict) else "4", str(c.get("score", "")) if isinstance(c, dict) else ""] for i, c in enumerate((obs.criteria if obs and obs.criteria else pdfdocs.DEFAULT_CRITERIA), 1)], ""),
            table(["التاريخ", "الملاحظة"], [["", ""] for _ in range(8)], "ملاحظات"),
        ])
    if source_type == "lesson-plan":
        p = LessonPlan.objects.get(pk=source_id, owner=u)
        return (f"نسخة قابلة للتحرير — {p.title}", theme_of(p), [
            cover("خطة الدرس", p.title),
            fields([("المادة", p.subject), ("المستوى", p.level), ("المجال", p.domain), ("الوحدة", p.unit), ("المدة", f"{p.duration} دقيقة"), ("الدرس من المقرر", p.course.title if p.course else "")]),
            heading("أهداف الدرس / الكفاية المستهدفة"), text(p.objectives or "…"),
            table(["المرحلة", "الزمن", "إجراءات الأستاذ", "أنشطة المتعلم"], [[x.get("phase", ""), f"{x.get('minutes', '')} د", x.get("teacher", ""), x.get("learners", "")] for x in (p.phases or [])], "خطوات تنفيذ الدرس"),
            signatures(["ملاحظات ما بعد الدرس", "إمضاء الأستاذ(ة)"]),
        ])
    if source_type == "notebook":
        b = NoteBook.objects.get(pk=source_id, owner=u)
        blocks = [cover("دفتر الملاحظات", b.title, [f"القسم: {b.class_name}" if b.class_name else ""])]
        for e in b.entries.select_related("school_class", "course", "session").all():
            blocks.append(heading(f"{e.date} — {e.title} ({e.tag})"))
            blocks.append(text(e.content or ""))
        if len(blocks) == 1:
            blocks.append(text("لا ملاحظات في هذا الدفتر بعد."))
        return (f"نسخة قابلة للتحرير — {b.title}", theme_of(b), blocks)
    if source_type == "gradebook":
        cls = SchoolClass.objects.get(pk=source_id, owner=u)
        students = list(cls.students.prefetch_related("marks").all())
        students.sort(key=lambda s: s.full_name)
        blocks = [cover("دفتر التنقيط", cls.name, [f"المستوى: {cls.level}", f"عدد التلاميذ: {len(students)}"]),
                  fields([("الفوج", cls.name), ("المستوى", cls.level), ("عدد التلاميذ", str(len(students)))] +
                         [(f"معدل الفوج — الثلاثي {t}", pdfdocs.fmt(pdfdocs.term_avg(students, t))) for t in (1, 2, 3)], "معلومات الفوج")]
        for term, label in [(1, "الثلاثي الأول"), (2, "الثلاثي الثاني"), (3, "الثلاثي الثالث")]:
            rows = []
            for i, st in enumerate(students, 1):
                m = next((x for x in st.marks.all() if x.term == term), None)
                rows.append([str(i), st.full_name, pdfdocs.fmt(m.continuous if m else None), pdfdocs.fmt(m.supervised if m else None), pdfdocs.fmt(m.exam if m else None), pdfdocs.fmt(m.average if m else None)])
            blocks.append(table(["#", "الاسم واللقب", "التقويم المستمر", "الفروض المحروسة", "الاختبار", "معدل الثلاثي"], rows, f"شبكة التنقيط — {label}"))
        rows = []
        for i, st in enumerate(students, 1):
            avgs = []
            for t in (1, 2, 3):
                m = next((x for x in st.marks.all() if x.term == t), None)
                avgs.append(m.average if m else None)
            rows.append([str(i), st.full_name] + [pdfdocs.fmt(a) for a in avgs] + [pdfdocs.fmt(pdfdocs.student_annual(st))])
        blocks.append(table(["#", "الاسم واللقب", "الثلاثي 1", "الثلاثي 2", "الثلاثي 3", "المعدل السنوي"], rows, "ملخص المعدلات السنوية"))
        return (f"نسخة قابلة للتحرير — دفتر تنقيط {cls.name}", default_theme, blocks)
    if source_type == "class-report":
        cls = SchoolClass.objects.get(pk=source_id, owner=u)
        courses = list(Course.objects.filter(owner=u).order_by("order"))
        progress = class_progress(cls, courses)
        done_ids = set(progress["done_course_ids"])
        blocks = [heading(f"تقرير تقدّم الفوج — {cls.name}"),
                  fields([("المستوى", cls.level), ("عدد التلاميذ", str(cls.students.count())), ("التقدم في المقرر", f"{progress['done_count']} / {progress['total_courses']} ({progress['percent']}٪)"), ("الدرس التالي المقترح", progress["next_course"]["title"] if progress["next_course"] else "أُنهي المقرر")]),
                  table(["#", "الدرس", "الحالة"], [[str(c.order), c.title, "✓ مُدرّس" if c.id in done_ids else "قيد الانتظار"] for c in courses], "حالة المقرر درسًا بدرس"),
                  table(SESS_HEADERS, _sessions_rows(list(cls.sessions.select_related("school_class", "course").all())), "سجل الحصص")]
        return (f"نسخة قابلة للتحرير — تقرير {cls.name}", default_theme, blocks)
    if source_type == "course":
        c = Course.objects.get(pk=source_id, owner=u)
        plan = c.plans.first()
        blocks = [cover(f"الدرس {c.order}", c.title, [f"الميدان: {c.domain}", f"الوحدة: {c.unit}", f"المستوى: {c.level}"], ),
                  heading("محتوى الدرس"), text(c.summary or "…"),
                  checklist(c.key_points or [], "النقاط الأساسية التي يكتبها التلاميذ")]
        if plan:
            blocks.append(fields([("الخطة", plan.title), ("المدة", f"{plan.duration} دقيقة"), ("الأهداف", plan.objectives)], "خطة الدرس المرتبطة"))
            blocks.append(table(["المرحلة", "الزمن", "إجراءات الأستاذ", "أنشطة المتعلم"], [[x.get("phase", ""), f"{x.get('minutes', '')} د", x.get("teacher", ""), x.get("learners", "")] for x in (plan.phases or [])], ""))
        taught = c.sessions.filter(status="done").select_related("school_class")
        blocks.append(table(["التاريخ", "الفوج", "الواجب"], [[str(s.date), s.school_class.name, s.homework or "—"] for s in taught], "دُرّس لدى"))
        return (f"نسخة قابلة للتحرير — {c.title}", theme_of(c), blocks)
    if source_type == "sessions":
        qs = Session.objects.filter(owner=u).select_related("school_class", "course")
        title = "سجلّ الحصص المنفَّذة"
        if source_id:
            qs = qs.filter(school_class_id=source_id)
            cls = SchoolClass.objects.filter(pk=source_id, owner=u).first()
            if cls:
                title = f"سجلّ حصص {cls.name}"
        return (f"نسخة قابلة للتحرير — {title}", default_theme, [heading(title), table(SESS_HEADERS, _sessions_rows(list(qs)), "")])
    if source_type == "timetable":
        return ("نسخة قابلة للتحرير — برنامج العمل الأسبوعي", default_theme,
                [heading("برنامج العمل الأسبوعي"), table(["اليوم", "الحصص"], _weekly_rows(slots), "")])
    if source_type == "observation":
        o = Observation.objects.get(pk=source_id, owner=u)
        return (f"نسخة قابلة للتحرير — شبكة ملاحظة {o.date}", default_theme, [
            heading("شبكة ملاحظة الحصة وتقييمها"),
            fields([("التاريخ", str(o.date)), ("المؤسسة", o.institution.name if o.institution else ""), ("الأستاذ(ة) المُزار", o.teacher_name), ("القسم", o.class_name), ("الدرس", o.course.title if o.course else ""), ("التقدير العام", f"{o.percent}٪ — {o.appreciation}")]),
            table(["#", "عنصر الملاحظة", "العلامة القصوى", "العلامة"], [[str(i), c.get("label", "") if isinstance(c, dict) else str(c), str(c.get("max", 4)) if isinstance(c, dict) else "4", str(c.get("score", "")) if isinstance(c, dict) else ""] for i, c in enumerate((o.criteria or pdfdocs.DEFAULT_CRITERIA), 1)], ""),
            heading("نقاط القوة"), text(o.strengths or "…"), heading("نقاط للتحسين"), text(o.improvements or "…"),
            signatures(["إمضاء الأستاذ(ة)", "إمضاء المفتش"]),
        ])
    raise ValueError("نوع مصدر غير معروف.")


# ---------------------------------------------------------------- smart generators
def _appreciation(avg):
    if avg is None:
        return "غير مقيّم بعد"
    if avg >= 16:
        return "ممتاز"
    if avg >= 14:
        return "جيد جدًا"
    if avg >= 12:
        return "جيد"
    if avg >= 10:
        return "مقبول — يحتاج مواصلة الجهد"
    return "يحتاج دعمًا ومتابعة"


def _term_mark(student, term):
    return next((m for m in student.marks.all() if m.term == term), None)


def generate_data_document(generator, data, user, profile):
    """Build a ready document from live platform data. Returns a dict for create()."""
    import random as _random

    def get_class():
        cls = SchoolClass.objects.get(pk=data.get("class_id"), owner=user)
        return cls, list(cls.students.prefetch_related("marks").order_by("full_name"))

    term = int(data.get("term") or 1)
    term_label = {1: "الثلاثي الأول", 2: "الثلاثي الثاني", 3: "الثلاثي الثالث"}.get(term, "الثلاثي الأول")
    teacher = profile.full_name if profile and profile.full_name else ""

    if generator == "report-cards":
        cls, students = get_class()
        blocks = []
        for i, st in enumerate(students):
            m = _term_mark(st, term)
            avg = m.average if m else None
            annual = pdfdocs.student_annual(st)
            comment = (f"ملاحظة الأستاذ: {_appreciation(avg)}. "
                       + ("واصل هذا المستوى الممتاز." if avg and avg >= 14 else
                          "نقترح مراجعة الدروس الأساسية وإنجاز الواجبات بانتظام." if avg is not None else
                          "لا توجد نقاط مسجلة بعد لهذا الثلاثي."))
            blocks += [
                fields([("التلميذ(ة)", st.full_name), ("القسم", cls.name), ("الثلاثي", term_label),
                        ("الأستاذ(ة)", teacher), ("المؤسسة", profile.current_school if profile else "")], f"كشف نقاط — {st.full_name}"),
                table(["التقويم المستمر /20", "الفروض المحروسة /20", "الاختبار /20", "معدل الثلاثي", "المعدل السنوي", "التقدير"],
                      [[pdfdocs.fmt(m.continuous if m else None), pdfdocs.fmt(m.supervised if m else None),
                        pdfdocs.fmt(m.exam if m else None), pdfdocs.fmt(avg), pdfdocs.fmt(annual), _appreciation(avg)]], "نتائج الإعلام الآلي"),
                text(comment),
                signatures(["الأستاذ(ة)", "ولي التلميذ (اطّلع ووقّع)"]),
            ]
            if i < len(students) - 1:
                blocks.append(pagebreak())
        return {"title": f"كشوف نقاط {cls.name} — {term_label}", "kind": "report-card",
                "orientation": "portrait", "content": wrap(blocks)}

    if generator == "honor-certificates":
        cls, students = get_class()
        scored = []
        for st in students:
            m = _term_mark(st, term)
            if m and m.average is not None:
                scored.append((m.average, st.full_name))
        scored.sort(key=lambda x: (-x[0], x[1]))
        mode = data.get("mode") or "threshold"
        if mode == "top":
            chosen = scored[:max(1, int(data.get("top_n") or 3))]
        else:
            minimum = float(data.get("min_average") or 14)
            chosen = [x for x in scored if x[0] >= minimum]
        if not chosen:
            raise ValueError("لا تلاميذ مطابقين لمعيار التكريم المختار.")
        cert_text = data.get("text") or f"تقديرًا لتفوقه(ا) في مادة الإعلام الآلي خلال {term_label} بقسم {cls.name}، مع تمنياتنا بمزيد من النجاح والتميز."
        return {"title": f"شهادات المتفوقين — {cls.name} ({term_label})", "kind": "certificate", "orientation": "landscape",
                "content": wrap([{"type": "certificates", "title": data.get("certificate_title") or "شهادة تقدير وتفوق",
                                  "text": cert_text, "names": [n for _, n in chosen],
                                  "signer": data.get("signer") or teacher or "الأستاذ(ة)", "date": data.get("date") or ""}])}

    if generator in ("attendance-sheet", "tracker-sheet"):
        cls, students = get_class()
        if generator == "attendance-sheet":
            cols = max(3, min(31, int(data.get("columns") or 15)))
            headers = ["#", "اسم التلميذ"] + [str(i) for i in range(1, cols + 1)]
            title = f"سجل الحضور والغياب — {cls.name}"
            top = fields([("القسم", cls.name), ("الشهر / الفترة", data.get("period") or ""), ("الأستاذ(ة)", teacher)], title)
            note = text("الرموز: ✓ حاضر • غ غائب • م مبرر • ت متأخر.")
            kind = "attendance-sheet"
        else:
            cols = max(2, min(16, int(data.get("columns") or 8)))
            headers = ["#", "اسم التلميذ"] + [f"الأسبوع {i}" for i in range(1, cols + 1)]
            title = f"سجل متابعة الواجبات والسلوك — {cls.name}"
            top = fields([("القسم", cls.name), ("الفترة", data.get("period") or ""), ("الأستاذ(ة)", teacher)], title)
            note = text("في كل خلية: نقطة الواجب/السلوك من 5 أو رمز مختصر متفق عليه مع التلاميذ.")
            kind = "tracker-sheet"
        rows = [[str(i), st.full_name] + [""] * cols for i, st in enumerate(students, 1)]
        return {"title": title, "kind": kind, "orientation": "landscape",
                "content": wrap([top, table(headers, rows, "قائمة التلاميذ"), note])}

    if generator == "student-id-cards":
        cls, students = get_class()
        school = profile.current_school if profile and profile.current_school else ""
        year = data.get("school_year") or "2025 / 2026"
        cards = [{"name": st.full_name, "meta": f"{cls.name} • {cls.level}", "footer": f"{school} — {year}"} for st in students]
        return {"title": f"بطاقات هوية تلاميذ {cls.name}", "kind": "student-id-cards", "orientation": "portrait",
                "content": wrap([{"type": "idcards", "title": "بطاقات هوية التلاميذ", "cards": cards}])}

    if generator == "seating-plan":
        cls, students = get_class()
        names = [st.full_name for st in students]
        strategy = data.get("strategy") or "alphabetical"
        if strategy == "random":
            _random.SystemRandom().shuffle(names)
        elif strategy == "performance":
            def avg_of(st):
                m = _term_mark(st, term)
                return m.average if m and m.average is not None else -1
            names = [st.full_name for st in sorted(students, key=lambda s: (-avg_of(s), s.full_name))]
        cols = max(2, min(10, int(data.get("cols") or 5)))
        rows = max(1, (len(names) + cols - 1) // cols)
        return {"title": f"مخطط جلوس {cls.name}", "kind": "seating", "orientation": "landscape",
                "content": wrap([{"type": "seating", "title": f"مخطط جلوس — {cls.name}", "front": data.get("front") or "السبورة / واجهة القسم", "rows": rows, "cols": cols, "seats": names},
                                 text("استراتيجية التوزيع: " + {"alphabetical": "أبجدية", "random": "عشوائية", "performance": "حسب معدل الثلاثي"}.get(strategy, strategy))])}

    if generator in ("course-exam", "course-worksheet"):
        course = Course.objects.get(pk=data.get("course_id"), owner=user)
        plan = course.plans.first()
        kind = "exam" if generator == "course-exam" else "worksheet"
        items = []
        for point in (course.key_points or []):
            items.append({"prompt": (f"اشرح المقصود بـ: {point}" if kind == "exam" else f"نشاط: طبّق ودوّن ما فهمته حول: {point}"),
                          "qtype": "سؤال قصير" if kind == "exam" else "نشاط تطبيقي",
                          "points": 2, "options": [], "answer": point, "lines": 3})
        if not items:
            items = [{"prompt": f"لخّص أهم ما تعلّمته في درس «{course.title}».", "qtype": "سؤال مقالي", "points": 5, "options": [], "answer": "", "lines": 5}]
        title = f"{'اختبار' if kind == 'exam' else 'ورقة عمل'} — {course.title}"
        blocks = [
            fields([("المادة", "الإعلام الآلي"), ("الدرس", course.title), ("المجال", course.domain), ("الوحدة", course.unit),
                    ("المستوى", course.level), ("القسم", ""), ("الأستاذ(ة)", teacher)], title),
        ]
        if course.summary:
            blocks.append(heading("تذكير بالدرس")); blocks.append(text(course.summary))
        if plan and plan.objectives:
            blocks.append(heading("الأهداف")); blocks.append(text(plan.objectives))
        blocks.append(questions(items, "أسئلة الاختبار" if kind == "exam" else "أنشطة ورقة العمل", show_answers=False))
        if kind == "worksheet":
            blocks.append(checklist(course.key_points or [], "تحقق قبل التسليم"))
        blocks.append(signatures(["إمضاء الأستاذ(ة)"] if kind == "exam" else ["اسم التلميذ", "تصحيح الأستاذ(ة)"]))
        return {"title": title, "kind": kind, "orientation": "portrait", "content": wrap(blocks)}

    raise ValueError("مولّد غير معروف.")
