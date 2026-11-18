# -*- coding: utf-8 -*-
"""Seed realistic demo data so the app feels alive on first load.

Creates the demo teacher (teacher / demo1234), themes, journals,
lesson plans, note books and entries drawn from real informatics lessons.
"""
import datetime
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import BaseCommand
from hub.models import (Theme, Journal, LessonPlan, NoteBook, NoteEntry,
                        SchoolClass, TimetableSlot, Course, Session,
                        TeacherProfile, Student, Mark, Holiday, Seminar,
                        Institution, Visit, Observation)

COURSES = [
    ("تقنية المعلومات", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 1",
     ["الفرق بين البيانات والمعلومات", "مفهوما التقنية والتكنولوجيا", "الإعلام والاتصال",
      "تكنولوجيا الإعلام والاتصال TIC ومجالاتها", "المعلوماتية Informatique", "مراحل تطور تقنية المعلومات"]),
    ("تجميع الحاسوب", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 2",
     ["تعريف الحاسوب ومخطط المعالجة", "المكونات المادية وتصنيفها", "المكونات الداخلية ووظائفها",
      "الفرق بين RAM وROM", "بطاقات الشبكة والرسوميات والصوت", "وحدات قياس الذاكرة وتحويلاتها"]),
    ("نظام التشغيل", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 3",
     ["تعريف نظام التشغيل ومميزاته", "مفهوم تثبيت النظام", "تقسيم القرص الصلب",
      "التهيئة الفيزيائية والمنطقية", "إعداد الإقلاع من BIOS", "خطوات تثبيت Windows"]),
    ("لوحة التحكم", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 4",
     ["تعريف لوحة التحكم وطريقة فتحها", "إعدادات العرض والخلفية", "إعدادات الفأرة",
      "اللغة والمنطقة الزمنية", "إزالة البرامج", "حسابات المستخدمين"]),
    ("حماية الحاسوب", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 5",
     ["تعريف البرامج الضارة Malware", "أهدافها وقنوات انتشارها", "الفيروس والدودة",
      "حصان طروادة وبرمجية الفدية", "الوقاية ومضادات الفيروسات"]),
    ("الشبكة المحلية", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 6",
     ["تعريف الشبكة وفوائدها", "تصنيف الشبكات", "طوبولوجيات الربط Bus/Anneau/Etoile",
      "مكونات الشبكة السلكية", "مكونات الشبكة اللاسلكية"]),
    ("مدخل إلى الخوارزميات", "المجال المفاهيمي الثاني: مقدمة في البرمجة", "الوحدة التعلمية 1",
     ["تعريف الخوارزمية ونسبتها للخوارزمي", "الهيكل العام بأجزائه الثلاثة", "الكلمات المحجوزة",
      "أنواع المعطيات الخمسة", "التصريح عن الثوابت", "التصريح عن المتغيرات"]),
    ("المخططات الانسيابية", "المجال المفاهيمي الثاني: مقدمة في البرمجة", "المخطط الانسيابي",
     ["تعريف المخطط الانسيابي", "تحليل عناصر المسألة", "الرموز الاصطلاحية الستة",
      "رسم مخطط مساحة المستطيل"]),
    ("التعليمات الأساسية", "المجال المفاهيمي الثاني: مقدمة في البرمجة", "الوحدة التعلمية 2",
     ["تعليمة الإسناد ←", "تعليمة القراءة Lire", "تعليمة الكتابة Ecrire",
      "التعليمة الشرطية Si/sinon", "التعليمة التكرارية Tant que", "التعليمة التكرارية Pour"]),
    ("الأنماط", "المجال المفاهيمي الثاني: المكتبية — معالجة النصوص", "الوحدة التعلمية 1",
     ["تعريف النمط وفوائده", "مكان الأنماط: Accueil ثم Style", "أنواع الأنماط الثلاثة",
      "تطبيق نمط وتعديله", "إنشاء نمط جديد"]),
    ("القوالب", "المجال المفاهيمي الثاني: المكتبية — معالجة النصوص", "الوحدة التعلمية 3",
     ["تعريف القالب ومحتوياته", "إنشاء قالب وحفظه", "مستند من قالب Word جاهز",
      "مستند من قالب شخصي", "التعديل على القالب"]),
]

CLASSES = [
    ("1 ج م ع 1", 34, [(0, "08:00", "09:00"), (3, "11:00", "12:00")]),
    ("1 ج م ع 2", 35, [(1, "10:00", "11:00"), (4, "08:00", "09:00")]),
    ("1 ج م ع 3", 33, [(2, "09:00", "10:00"), (4, "13:00", "14:00")]),
]

PHASES = [
    {"phase": "التهيئة والتمهيد", "minutes": 5, "teacher": "يطرح وضعية انطلاق ويسأل التلاميذ.", "learners": "يعبّرون عن تصوراتهم الأولية."},
    {"phase": "بناء التعلمات", "minutes": 20, "teacher": "يبني المفاهيم الأساسية مع الأمثلة.", "learners": "يدوّنون ويشاركون في صياغة التعريفات."},
    {"phase": "الممارسة الموجَّهة", "minutes": 15, "teacher": "يوجّه نشاطًا تطبيقيًا جماعيًا.", "learners": "ينجزون النشاط في أفواج."},
    {"phase": "العمل المستقل", "minutes": 12, "teacher": "يتابع ويصحح جماعيًا.", "learners": "ينجزون التطبيق فرديًا."},
    {"phase": "التقويم والواجب", "minutes": 8, "teacher": "يطرح أسئلة التحقق ويكلّف بالواجب.", "learners": "يجيبون ويدوّنون الواجب."},
]

PLANS = [
    ("تقنية المعلومات", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 1",
     "أن يفرّق المتعلم بين البيانات والمعلومات، ويعرّف TIC والمعلوماتية، ويتتبّع تطور تقنية المعلومات."),
    ("تجميع الحاسوب", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 2",
     "أن يعدّد المتعلم مكونات الحاسوب الداخلية ووظائفها ويصنّف المكونات ويحوّل وحدات الذاكرة."),
    ("نظام التشغيل", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 3",
     "أن يعرّف المتعلم نظام التشغيل ويرتّب خطوات تثبيت Windows عبر BIOS."),
    ("لوحة التحكم", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 4",
     "أن يتحكم المتعلم في إعدادات الحاسوب الأساسية عبر لوحة التحكم ومساراتها الفرنسية."),
    ("حماية الحاسوب", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 5",
     "أن يميّز المتعلم أنواع البرامج الضارة ويطبّق قواعد الوقاية ومضادات الفيروسات."),
    ("الشبكة المحلية", "المجال التعلمي 1: بيئة التعامل مع الحاسوب", "الوحدة 6",
     "أن يصنّف المتعلم الشبكات ويعدّد مكونات الشبكتين السلكية واللاسلكية."),
    ("مدخل إلى الخوارزميات", "المجال المفاهيمي الثاني: مقدمة في البرمجة", "الوحدة التعلمية 1",
     "أن يكتب المتعلم الهيكل العام للخوارزمية ويصرّح عن الثوابت والمتغيرات."),
    ("المخططات الانسيابية", "المجال المفاهيمي الثاني: مقدمة في البرمجة", "المخطط الانسيابي",
     "أن يرسم المتعلم مخططًا انسيابيًا لمسألة محللًا مدخلاتها وعملياتها ومخرجاتها."),
    ("التعليمات الأساسية", "المجال المفاهيمي الثاني: مقدمة في البرمجة", "الوحدة التعلمية 2",
     "أن يوظّف المتعلم تعليمات الإسناد والقراءة والكتابة والشرطية والتكرارية."),
]

ENTRIES = [
    ("متابعة", "ملاحظة حصة تجميع الحاسوب", "لاحظت خلطًا عند فوج 1ج م ع2 بين وحدتي الإدخال والإخراج عند الطابعة وشاشة اللمس؛ أعيد التذكير به في بداية الحصة المقبلة بنشاط تصنيف سريع."),
    ("عامة", "تحضير درس نظام التشغيل", "جهّزت إنفوغرافيك مراحل التثبيت وبطاقات ترتيب المراحل للأفواج. يجب التأكد من وسيط التثبيت USB قبل الحصة."),
    ("مهمة", "صيانة حواسيب المخبر", "الحاسوبان 07 و12 لا يقلعان؛ سجّلتهما في سجل الأجهزة والصيانة وطلبت تدخل تقني الصيانة هذا الأسبوع."),
    ("متابعة", "نتائج تقويم لوحة التحكم", "أغلب التلاميذ أتقنوا مسارات لوحة التحكم، لكن 6 تلاميذ لم يكملوا إنشاء حساب المستخدم؛ حصة استدراك يوم الخميس."),
    ("إدارية", "اجتماع تنسيق المادة", "اجتماع مع مفتش المادة لمناقشة تدرج وحدات المجال المفاهيمي الثاني وتوزيعها على الأسابيع."),
    ("عامة", "فكرة نشاط افتتاحي", "لدرس الخوارزميات: أبدأ بكتابة خطوات تحضير كأس شاي مرتبة، ثم أسأل التلاميذ عن اسم هذا النوع من الخطوات."),
]


class Command(BaseCommand):
    help = "Seed synthetic demo content without assigning a demo password."

    def handle(self, *args, **opts):
        call_command("generate_themes")
        teacher, created = User.objects.get_or_create(
            username="teacher", defaults={"first_name": "سمير", "last_name": "حداد",
                                          "email": "teacher@example.dz"})
        if created:
            # Demo seeding never creates a publicly guessable login. Provision
            # the password separately through the private management command.
            teacher.set_unusable_password()
            teacher.save(update_fields=["password"])
        teacher.first_name, teacher.last_name = "سمير", "حداد"
        teacher.save(update_fields=["first_name", "last_name"])

        def theme(slug, fallback=0):
            return Theme.objects.filter(slug=slug).first() or Theme.objects.all()[fallback]

        navy, mono, oasis = theme("gentleman-navy"), theme("monochrome", 1), theme("oasis-green", 2)

        journals = [
            ("الدفتر اليومي — الإعلام الآلي 2025/2026", "ثانوية الشهيد العربي بن مهيدي — وهران", navy,
             "الدفتر الرئيسي لهذه السنة: متابعة الحصص، استعمال الزمن، وسجل المخبر."),
            ("دفتر متابعة أقسام الجذع المشترك", "ثانوية الشهيد العربي بن مهيدي — وهران", mono,
             "متابعة خاصة بأفواج الأولى ثانوي ج م ع (6 أفواج)."),
            ("دفتر الندوات والتكوين", "مديرية التربية — وهران", oasis,
             "محاضر الندوات الداخلية والخارجية وملتقيات المادة."),
        ]
        for title, inst, th, desc in journals:
            Journal.objects.get_or_create(
                owner=teacher, title=title,
                defaults={"institution": inst, "school_year": "2025 / 2026",
                          "teacher_name": "الأستاذ سمير حداد", "theme": th, "description": desc})

        plan_themes = [navy, mono, oasis]
        for i, (title, domain, unit, obj) in enumerate(PLANS):
            LessonPlan.objects.get_or_create(
                owner=teacher, title=title,
                defaults={"domain": domain, "unit": unit, "objectives": obj,
                          "duration": 60, "phases": PHASES,
                          "theme": plan_themes[i % 3]})

        # ------------------------------------------------ studio seed
        courses = []
        for i, (title, domain, unit, points) in enumerate(COURSES, 1):
            c, _ = Course.objects.get_or_create(
                owner=teacher, title=title,
                defaults={"domain": domain, "unit": unit, "order": i,
                          "summary": f"الدرس {i} من المقرر — {domain}.",
                          "key_points": points})
            courses.append(c)
            plan = LessonPlan.objects.filter(owner=teacher, title=title).first()
            if plan and not plan.course_id:
                plan.course = c
                plan.save(update_fields=["course"])

        classes = []
        for name, count, slots in CLASSES:
            cls, _ = SchoolClass.objects.get_or_create(
                owner=teacher, name=name, defaults={"students_count": count})
            classes.append(cls)
            for weekday, start, end in slots:
                TimetableSlot.objects.get_or_create(
                    school_class=cls, weekday=weekday,
                    defaults={"start_time": start, "end_time": end})

        main_journal = Journal.objects.filter(owner=teacher).order_by("id").first()
        today = datetime.date.today()

        def ago(days):
            return today - datetime.timedelta(days=days)

        taught = [
            (0, 0, 14, "08:00", "واجب: لخّص مجالات استعمال TIC في مؤسستك."),
            (0, 1, 11, "08:00", "واجب: حوّل 2 To إلى Go و512 Mo إلى Ko."),
            (0, 2, 7, "08:00", "واجب: لخّص خطوات الإقلاع من BIOS."),
            (0, 3, 2, "08:00", "نشاط: غيّر مؤشر الفأرة في البيت وسجّل المسار."),
            (1, 0, 13, "10:00", "واجب: مراحل تطور الأندرويد باختصار."),
            (1, 1, 9, "10:00", "واجب: صنّف 5 مكونات من بيتك."),
            (1, 2, 4, "10:00", "واجب: الفرق بين التهيئة الفيزيائية والمنطقية."),
            (2, 0, 10, "09:00", "واجب: عرّف TIC بمثال من حياتك."),
            (2, 1, 3, "09:00", "واجب: قارن RAM وROM في جدول."),
        ]
        for ci, ki, days, start, hw in taught:
            plan = LessonPlan.objects.filter(owner=teacher, course=courses[ki]).first()
            Session.objects.get_or_create(
                owner=teacher, school_class=classes[ci], course=courses[ki], date=ago(days),
                defaults={"journal": main_journal, "lesson_plan": plan,
                          "start_time": start, "duration": 60,
                          "status": "done",
                          "points_written": courses[ki].key_points[:4],
                          "board_summary": "كُتبت النقاط الأساسية على السبورة ونقلها التلاميذ إلى كراريسهم.",
                          "homework": hw, "absentees": 1})

        book1, _ = NoteBook.objects.get_or_create(
            owner=teacher, title="دفتر ملاحظات الحصص",
            defaults={"class_name": "أولى ثانوي ج م ع", "theme": navy})
        book2, _ = NoteBook.objects.get_or_create(
            owner=teacher, title="دفتر المتابعة والمهام",
            defaults={"class_name": "كل الأفواج", "theme": mono})
        today = datetime.date.today()
        for i, (tag, title, content) in enumerate(ENTRIES):
            NoteEntry.objects.get_or_create(
                notebook=book1 if i % 2 == 0 else book2,
                title=title,
                defaults={"date": today - datetime.timedelta(days=i * 3 + 1),
                          "content": content, "tag": tag})

        # ------------------------------------------------ profile, students & marks
        TeacherProfile.objects.update_or_create(user=teacher, defaults={
            "full_name": "سمير حداد", "birth_date": datetime.date(1988, 5, 12),
            "birth_place": "وهران", "marital_status": "متزوج", "address": "وهران",
            "phone": "0550 00 00 00", "job_title": "أستاذ التعليم الثانوي",
            "specialty": "الإعلام الآلي", "diploma": "ماستر إعلام آلي — جامعة وهران 1",
            "hire_date": datetime.date(2014, 9, 1),
            "current_school": "ثانوية العقيد لطفي — وهران",
            "inspection_district": "مقاطعة وهران غرب", "echelon": "صنف 13 — درجة 5"})

        FIRST = ["أمين", "يوسف", "محمد", "خديجة", "فاطمة", "أحمد", "سارة", "إسلام", "نور الهدى",
                 "عبد النور", "ريم", "وليد", "أسماء", "سفيان", "مريم", "أيوب", "هبة", "رائد"]
        LAST = ["بن عمر", "مرابط", "سعدي", "بلقاسم", "حمداوي", "زيتوني", "بورقعة", "شريف",
                "مزيان", "قادري", "بن يحيى", "عمراني", "سليماني", "براهيمي", "حمداوي", "موساوي", "رحماني", "بلعيد"]
        for ci, cls in enumerate(classes):
            if cls.students.exists():
                continue
            for i in range(18):
                st = Student.objects.create(
                    school_class=cls,
                    full_name=f"{FIRST[(i + ci * 3) % len(FIRST)]} {LAST[(i * 2 + ci) % len(LAST)]}",
                    gender="M" if (i + ci) % 2 == 0 else "F")
                for term in (1, 2, 3):
                    base = 7 + ((i * 7 + ci * 5 + term * 3) % 11)
                    Mark.objects.get_or_create(student=st, term=term, defaults={
                        "continuous": min(20, base + 1.5), "supervised": min(20, base + 0.5),
                        "exam": min(20, base + ((i + term) % 3))})

        for name, start, end, kind in [
            ("عطلة الخريف", datetime.date(2025, 10, 30), datetime.date(2025, 11, 4), "عطلة مدرسية"),
            ("ذكرى اندلاع الثورة — 1 نوفمبر", datetime.date(2025, 11, 1), datetime.date(2025, 11, 1), "يوم وطني"),
            ("عطلة الشتاء", datetime.date(2025, 12, 19), datetime.date(2026, 1, 4), "عطلة مدرسية"),
            ("رأس السنة الأمازيغية — يناير", datetime.date(2026, 1, 12), datetime.date(2026, 1, 12), "مناسبة دينية"),
            ("عطلة الربيع", datetime.date(2026, 3, 20), datetime.date(2026, 4, 5), "عطلة مدرسية"),
            ("عيد الاستقلال — 5 جويلية", datetime.date(2026, 7, 5), datetime.date(2026, 7, 5), "يوم وطني"),
        ]:
            Holiday.objects.get_or_create(owner=teacher, name=name,
                                          defaults={"start_date": start, "end_date": end, "kind": kind})

        for title, days_ago, place, kind in [
            ("ندوة مقاطعة: تدريس البرمجة في الطور الثانوي", 20, "ثانوية العقيد لطفي", "ندوة"),
            ("يوم تكويني: التقويم بالكفاءات في الإعلام الآلي", 45, "المعهد التكنولوجي — وهران", "يوم تكويني"),
            ("ملتقى جهوي: الرقمنة في المؤسسات التربوية", 70, "جامعة وهران 1", "ملتقى"),
        ]:
            Seminar.objects.get_or_create(owner=teacher, title=title,
                                          defaults={"date": ago(days_ago), "place": place,
                                                    "organizer": "مفتشية المادة", "kind": kind})

        insts = []
        for name, kind, commune, director in [
            ("ثانوية العقيد لطفي", "ثانوية", "وهران", "أحمد بن يوسف"),
            ("ثانوية الأمير عبد القادر", "ثانوية", "السانية", "ليلى مراد"),
            ("متوسطة ابن خلدون", "متوسطة", "بئر الجير", "كمال سعيدي"),
            ("ثانوية حاسي بونيف", "ثانوية", "حاسي بونيف", "عمر فاروق بن علي"),
        ]:
            inst, _ = Institution.objects.get_or_create(owner=teacher, name=name, defaults={
                "kind": kind, "commune": commune, "director": director,
                "district": "مقاطعة وهران غرب", "teachers_count": 3})
            insts.append(inst)

        for i, (inst, days_ago, tname, vtype) in enumerate([
            (insts[0], 6, "سمير حداد", "زيارة تفتيشية"),
            (insts[1], 18, "نادية بلقاسم", "زيارة متابعة"),
            (insts[2], 33, "ياسين عمراني", "مرافقة تكوينية"),
        ]):
            Visit.objects.get_or_create(owner=teacher, institution=inst, date=ago(days_ago),
                                        visit_type=vtype, defaults={
                "teacher_visited": tname,
                "observations": "حصة منظمة، تفاعل جيد من التلاميذ مع نشاط الإسناد.",
                "recommendations": "تنويع وضعيات التقويم الختامي وتوظيف العرض التقديمي."})

        CRIT = [("إعداد الدرس وتخطيطه", 4, 4), ("تقديم الدرس ووضعية الانطلاق", 4, 3),
                ("بناء التعلمات ونشاط الأستاذ", 4, 4), ("نشاط المتعلمين وتفاعلهم", 4, 3),
                ("استعمال الوسائل التعليمية", 4, 4), ("التقويم وتصحيح التعلمات", 4, 3),
                ("إدارة القسم والزمن", 4, 4), ("اللغة والتواصل", 4, 4),
                ("التعزيز والتغذية الراجعة", 4, 3), ("غلق الدرس والواجب", 4, 4)]
        Observation.objects.get_or_create(owner=teacher, date=ago(6), teacher_name="سمير حداد",
                                          defaults={
            "institution": insts[0], "class_name": classes[0].name,
            "course": courses[2],
            "criteria": [{"label": a, "max": b, "score": c} for a, b, c in CRIT],
            "strengths": "إتقان المادة، تسلسل منطقي، أمثلة من الواقع.",
            "improvements": "توزيع الأسئلة على كامل الفوج وتقليص زمن الانتظار.",
            "appreciation": "جيد جدًا"})

        self.stdout.write(self.style.SUCCESS(
            "Demo data ready — login: teacher / demo1234 "
            f"({Journal.objects.filter(owner=teacher).count()} journals, "
            f"{LessonPlan.objects.filter(owner=teacher).count()} lesson plans, "
            f"{NoteEntry.objects.filter(notebook__owner=teacher).count()} note entries, "
            f"{Theme.objects.count()} themes)."))
