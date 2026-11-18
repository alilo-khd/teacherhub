import datetime

from django.conf import settings
from django.db import models


class Theme(models.Model):
    """A visual identity that can be applied to journals, lesson plans, note books…"""
    slug = models.SlugField(max_length=80, unique=True)
    name_ar = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True)
    tagline = models.CharField(max_length=200, blank=True)
    # palette
    deep = models.CharField(max_length=9, default="#1F2A44")
    deeper = models.CharField(max_length=9, default="#131B2E")
    ink = models.CharField(max_length=9, default="#22304D")
    accent = models.CharField(max_length=9, default="#C9A227")
    accent2 = models.CharField(max_length=9, default="#8C6A15")
    soft = models.CharField(max_length=9, default="#F4F1EA")
    soft2 = models.CharField(max_length=9, default="#FBF9F4")
    line = models.CharField(max_length=9, default="#DAD5C5")
    paper = models.CharField(max_length=9, default="#FFFFFF")
    heading_font = models.CharField(max_length=60, default="Tajawal")
    body_font = models.CharField(max_length=60, default="IBM Plex Sans Arabic")
    pattern = models.CharField(max_length=20, default="none",
                               choices=[("none", "بدون نقش"), ("dots", "نقاط"), ("grid", "شبكة"),
                                        ("diagonal", "خطوط مائلة"), ("waves", "تموّجات"), ("diamonds", "معيّنات")])
    cover_style = models.CharField(max_length=20, default="classic",
                                   choices=[("classic", "كلاسيكي مؤطر"), ("bold", "عريض ملوّن"), ("minimal", "بسيط أنيق")])
    style_type = models.CharField(max_length=30, default="كلاسيكية",
                                  choices=[("كلاسيكية", "كلاسيكية"), ("عصرية", "عصرية"),
                                           ("دافئة", "دافئة"), ("باردة", "باردة"), ("أحادية", "أحادية")])
    source = models.CharField(max_length=20, default="curated",
                              choices=[("curated", "مصممة"), ("generated", "مولّدة آليًا"), ("custom", "مخصصة")])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name_ar"]

    def __str__(self):
        return self.name_ar

    @property
    def css_vars(self):
        return {
            "--th-deep": self.deep, "--th-deeper": self.deeper, "--th-ink": self.ink,
            "--th-accent": self.accent, "--th-accent2": self.accent2,
            "--th-soft": self.soft, "--th-soft2": self.soft2, "--th-line": self.line,
            "--th-paper": self.paper, "--th-heading-font": self.heading_font,
            "--th-body-font": self.body_font,
        }

    @property
    def pattern_label(self):
        return dict(self._meta.get_field("pattern").choices).get(self.pattern, self.pattern)


class Journal(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="journals")
    title = models.CharField(max_length=160)
    institution = models.CharField(max_length=160, blank=True)
    school_year = models.CharField(max_length=20, blank=True, default="2025 / 2026")
    teacher_name = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    page_config = models.JSONField(default=dict, blank=True,
                                   help_text="تخصيص أقسام دفتر PDF: {sections: [...], notes_rows: 12}")
    cover_config = models.JSONField(default=dict, blank=True,
                                    help_text="تصميم الغلاف: {image, layout, motto, title_override, show_institution, show_year, show_teacher}")
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True, related_name="journals")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class LessonPlan(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_plans")
    title = models.CharField(max_length=160)
    subject = models.CharField(max_length=80, default="الإعلام الآلي")
    level = models.CharField(max_length=80, blank=True, default="أولى ثانوي ج م ع")
    domain = models.CharField(max_length=160, blank=True)
    unit = models.CharField(max_length=160, blank=True)
    duration = models.PositiveIntegerField(default=60, help_text="بالدقائق")
    objectives = models.TextField(blank=True)
    phases = models.JSONField(default=list, blank=True,
                              help_text="[{phase, minutes, teacher, learners}]")
    course = models.ForeignKey("Course", on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="plans", help_text="الدرس من المقرر المرتبطة به هذه الخطة")
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True, related_name="lesson_plans")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class NoteBook(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notebooks")
    title = models.CharField(max_length=160)
    class_name = models.CharField(max_length=80, blank=True)
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True, related_name="notebooks")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class NoteEntry(models.Model):
    notebook = models.ForeignKey(NoteBook, on_delete=models.CASCADE, related_name="entries")
    date = models.DateField()
    title = models.CharField(max_length=160)
    content = models.TextField(blank=True)
    tag = models.CharField(max_length=30, default="عامة",
                           choices=[("عامة", "عامة"), ("مهمة", "مهمة"), ("متابعة", "متابعة"), ("إدارية", "إدارية")])
    # contextual links (a note can belong to a class / course / taught session)
    school_class = models.ForeignKey("SchoolClass", on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name="notes")
    course = models.ForeignKey("Course", on_delete=models.SET_NULL,
                               null=True, blank=True, related_name="notes")
    session = models.ForeignKey("Session", on_delete=models.SET_NULL,
                                null=True, blank=True, related_name="notes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]


# ------------------------------------------------------------------ studio
WEEKDAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]


class SchoolClass(models.Model):
    """A class / group (فوج) the teacher teaches."""
    organization = models.ForeignKey("Organization", on_delete=models.CASCADE, related_name="classes", null=True, blank=True)
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="classes", null=True, blank=True)
    campus = models.ForeignKey("Campus", on_delete=models.SET_NULL, null=True, blank=True, related_name="classes")
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="classes", null=True, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="classes")
    name = models.CharField(max_length=80)                       # e.g. 1 ج م ع 1
    level = models.CharField(max_length=80, blank=True, default="أولى ثانوي ج م ع")
    students_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["school", "academic_year", "name"]),
        ]

    def __str__(self):
        return self.name


class TimetableSlot(models.Model):
    """A weekly recurring slot: this class, this weekday, this time."""
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="slots")
    weekday = models.PositiveSmallIntegerField(default=0,
                                               help_text="0=الأحد … 4=الخميس (أسبوع الدراسة الجزائري)")
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    room = models.CharField(max_length=80, blank=True, default="مخبر الإعلام الآلي")

    class Meta:
        ordering = ["weekday", "start_time"]


class Course(models.Model):
    """A curriculum lesson (درس من المقرر) that can be taught, planned and tracked."""
    organization = models.ForeignKey("Organization", on_delete=models.CASCADE, related_name="courses", null=True, blank=True)
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="courses", null=True, blank=True)
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="courses", null=True, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="courses")
    title = models.CharField(max_length=160)
    domain = models.CharField(max_length=160, blank=True)
    unit = models.CharField(max_length=160, blank=True)
    level = models.CharField(max_length=80, blank=True, default="أولى ثانوي ج م ع")
    order = models.PositiveIntegerField(default=1)
    summary = models.TextField(blank=True)
    key_points = models.JSONField(default=list, blank=True,
                                  help_text="النقاط الأساسية للدرس (ما يُكتب على السبورة)")
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True, related_name="courses")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title


class Session(models.Model):
    """A taught class session logged in the journal (حصة منفَّذة)."""
    STATUS = [("done", "منفَّذة"), ("cancelled", "ملغاة"), ("postponed", "مؤجلة")]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions")
    journal = models.ForeignKey(Journal, on_delete=models.SET_NULL, null=True, blank=True, related_name="sessions")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="sessions")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="sessions")
    lesson_plan = models.ForeignKey("LessonPlan", on_delete=models.SET_NULL, null=True, blank=True, related_name="sessions")
    date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    duration = models.PositiveIntegerField(default=60)
    status = models.CharField(max_length=12, choices=STATUS, default="done")
    points_written = models.JSONField(default=list, blank=True,
                                      help_text="النقاط التي كتبها التلاميذ / غُطّيت في الحصة")
    board_summary = models.TextField(blank=True, help_text="ملخص ما كُتب على السبورة")
    homework = models.CharField(max_length=255, blank=True)
    absentees = models.PositiveIntegerField(default=0)
    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-start_time"]

    @property
    def weekday_index(self):
        # Python: Mon=0..Sun=6  →  ours: Sun(الأحد)=0..Sat=6
        return (self.date.weekday() + 1) % 7


# ------------------------------------------------------------------ people & marks
class TeacherProfile(models.Model):
    """بطاقة الحالة الشخصية والمهنية (personal & professional ID card)."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=160, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=120, blank=True)
    marital_status = models.CharField(max_length=40, blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    job_title = models.CharField(max_length=120, blank=True, default="أستاذ التعليم الثانوي")
    specialty = models.CharField(max_length=120, blank=True, default="الإعلام الآلي")
    diploma = models.CharField(max_length=200, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    current_school = models.CharField(max_length=200, blank=True)
    inspection_district = models.CharField(max_length=200, blank=True)
    echelon = models.CharField(max_length=40, blank=True, help_text="الدرجة / الصنف")
    notes = models.TextField(blank=True)
    inspector_page_config = models.JSONField(default=dict, blank=True,
                                             help_text="تخصيص أقسام دفتر المفتش PDF")
    cover_config = models.JSONField(default=dict, blank=True,
                                    help_text="تصميم غلاف دفتر المفتش (نفس بنية Cover الدفتر اليومي)")
    # Role for portal access: teacher (workspace), parent (view children), student (view own data)
    ROLE_CHOICES = [
        ("teacher", "معلم"),
        ("parent", "ولي أمر"),
        ("student", "تلميذ"),
    ]
    role = models.CharField(max_length=20, default="teacher", choices=ROLE_CHOICES,
                            help_text="دور المستخدم في بوابة المنصة")
    linked_student = models.ForeignKey("Student", on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name="portal_users", help_text="التلميذ المرتبط ببوابة ولي الأمر أو التلميذ")
    updated_at = models.DateTimeField(auto_now=True)


class Student(models.Model):
    organization = models.ForeignKey("Organization", on_delete=models.CASCADE, related_name="students", null=True, blank=True)
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="students", null=True, blank=True)
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="students")
    full_name = models.CharField(max_length=160)
    birth_date = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, blank=True, choices=[("M", "ذكر"), ("F", "أنثى")])
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["full_name"]


class Mark(models.Model):
    """One row per student per term — دفتر التنقيط columns."""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="marks")
    term = models.PositiveSmallIntegerField(default=1, choices=[(1, "الثلاثي الأول"), (2, "الثلاثي الثاني"), (3, "الثلاثي الثالث")])
    continuous = models.FloatField(null=True, blank=True, help_text="معدل التقويم المستمر /20")
    supervised = models.FloatField(null=True, blank=True, help_text="معدل الفروض المحروسة /20")
    exam = models.FloatField(null=True, blank=True, help_text="نقطة الاختبار /20")

    class Meta:
        unique_together = [("student", "term")]
        ordering = ["term"]

    @property
    def average(self):
        if None in (self.continuous, self.supervised, self.exam):
            return None
        return round((self.continuous + self.supervised + self.exam * 2) / 4, 2)


# ------------------------------------------------------------------ v2 grade calculation engine


class GradeRuleSet(models.Model):
    """Versioned calculation ruleset for grade aggregation.

    Schools configure the approved formula per subject/grade/term context.
    Never hardcode formulas in React components or scattered API views —
    all calculation logic lives here and is versioned.
    """
    organization = models.ForeignKey("Organization", on_delete=models.CASCADE, related_name="grade_rulesets", null=True, blank=True)
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="grade_rulesets", null=True, blank=True)
    name = models.CharField(max_length=160, help_text="e.g. المتوسط المستمر والفروض المحروسة - الثلاثي الأول")
    subject = models.ForeignKey("Course", on_delete=models.SET_NULL, null=True, blank=True, related_name="grade_rulesets", help_text="مادة محددة، أو فارغ للتعميم على جميع المواد")
    grade_level = models.CharField(max_length=80, blank=True, help_text="المستوى الدراسي، أو فارغ للتعميم")
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="grade_rulesets", null=True, blank=True)
    term = models.PositiveSmallIntegerField(null=True, blank=True, choices=[(1, "الثلاثي الأول"), (2, "الثلاثي الثاني"), (3, "الثلاثي الثالث")], help_text="الثلاثي المستهدف، أو فارغ لجميع الفصول")
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    is_approved = models.BooleanField(default=False, help_text="يجب اعتماد القواعد من قبل مسؤول المدرسة قبل الاستخدام")
    formula_config = models.JSONField(default=dict, help_text='{"component_weights": {"continuous": 0.3, "supervised": 0.3, "exam": 0.4}, "rounding": 2, "pass_threshold": 50}')
    component_max = models.JSONField(default=dict, help_text='{"continuous": 20, "supervised": 20, "exam": 20}')
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_grade_rulesets")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-version", "name"]
        unique_together = [("school", "name", "version")]
        indexes = [
            models.Index(fields=["school", "subject", "academic_year", "term", "is_active"]),
            models.Index(fields=["effective_from", "effective_to"]),
        ]

    def __str__(self):
        return f"{self.name} v{self.version}"


class CalculatedResult(models.Model):
    """Stored calculation result with full provenance for audit and reproducibility."""

    student = models.ForeignKey("Student", on_delete=models.CASCADE, related_name="calculated_results")
    school_class = models.ForeignKey("SchoolClass", on_delete=models.CASCADE, related_name="calculated_results")
    subject = models.ForeignKey("Course", on_delete=models.CASCADE, related_name="calculated_results")
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="calculated_results")
    term = models.PositiveSmallIntegerField()
    ruleset = models.ForeignKey(GradeRuleSet, on_delete=models.CASCADE, related_name="calculated_results")
    ruleset_version = models.PositiveIntegerField()
    input_snapshot = models.JSONField(default=dict, help_text="نسخة من الدرجات المدخلة وقت الحساب")
    calculated_value = models.FloatField(help_text="النتيجة المحسوبة النهائية")
    calculated_percent = models.FloatField(null=True, blank=True, help_text="النسبة المئوية")
    calculation_breakdown = models.JSONField(default=dict, help_text="تفاصيل الحساب لكل مكون")

    # Submission / approval workflow
    STATUS_CHOICES = [
        ("calculated", "محسوب"),
        ("submitted", "مقدم للمراجعة"),
        ("approved", "معتمد من المراجع"),
        ("rejected", "مرفوض"),
        ("published", "منشور"),
        ("voided", "ملغي"),
    ]
    status = models.CharField(max_length=20, default="calculated", choices=STATUS_CHOICES)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="submitted_results")
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_results")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_comment = models.TextField(blank=True, help_text="تعليق المراجع أو سبب الرفض")

    calculated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-calculated_at"]
        unique_together = [("student", "subject", "academic_year", "term", "ruleset_version")]
        indexes = [
            models.Index(fields=["school_class", "subject", "term", "status"]),
            models.Index(fields=["ruleset", "ruleset_version"]),
            models.Index(fields=["status", "submitted_at"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} — {self.subject.title} — {self.calculated_value}"

    def can_submit(self):
        return self.status == "calculated"

    def can_approve(self):
        return self.status == "submitted"

    def can_reject(self):
        return self.status == "submitted"

    def can_publish(self):
        return self.status == "approved"

    def can_void(self):
        return self.status in ("published", "approved", "submitted", "calculated")


# ------------------------------------------------------------------ attendance & follow-up
# ------------------------------------------------------------------ attendance & follow-up
class AttendanceRecord(models.Model):
    """One student's attendance state for one teaching day/session."""
    STATUSES = [
        ("present", "حاضر"), ("absent", "غائب"), ("late", "متأخر"),
        ("excused", "غياب مبرر"), ("left_early", "غادر مبكرًا"),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="attendance_records")
    date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUSES, default="present")
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "student__full_name"]
        constraints = [
            models.UniqueConstraint(fields=["student", "date", "session"], name="unique_student_day_session_attendance"),
        ]

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)


class StudentFollowUpRecord(models.Model):
    """A dated homework / behaviour / participation observation for a student."""
    CATEGORIES = [
        ("homework", "الواجب المنزلي"), ("behaviour", "السلوك والانضباط"),
        ("participation", "المشاركة"), ("support", "الدعم والملاحظات"),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="follow_up_records")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="follow_up_records")
    session = models.ForeignKey(Session, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="follow_up_records")
    date = models.DateField()
    category = models.CharField(max_length=30, choices=CATEGORIES, default="homework")
    score = models.PositiveSmallIntegerField(null=True, blank=True, help_text="من 0 إلى 5")
    status = models.CharField(max_length=80, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "student__full_name", "category"]

    @property
    def category_label(self):
        return dict(self.CATEGORIES).get(self.category, self.category)


# ------------------------------------------------------------------ support & parent communication
class SupportPlan(models.Model):
    """A tracked intervention plan for a student who needs support."""
    CATEGORIES = [
        ("academic", "دعم دراسي"), ("attendance", "متابعة الحضور"),
        ("homework", "متابعة الواجبات"), ("behaviour", "السلوك والانضباط"),
        ("mixed", "دعم شامل"), ("other", "أخرى"),
    ]
    PRIORITIES = [("low", "منخفضة"), ("medium", "متوسطة"), ("high", "عالية")]
    STATUSES = [
        ("planned", "مخططة"), ("active", "جارية"), ("monitoring", "قيد المراقبة"),
        ("completed", "مكتملة"), ("cancelled", "ملغاة"),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="support_plans")
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=30, choices=CATEGORIES, default="academic")
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="medium")
    status = models.CharField(max_length=20, choices=STATUSES, default="planned")
    reason = models.TextField(blank=True)
    actions = models.JSONField(default=list, blank=True,
                               help_text="[{text, done, due}] — إجراءات الدعم القابلة للتتبع")
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    teacher_notes = models.TextField(blank=True)
    outcome = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    @property
    def progress_percent(self):
        actions = self.actions or []
        if not actions:
            return 0
        return round(sum(1 for a in actions if isinstance(a, dict) and a.get("done")) * 100 / len(actions))

    @property
    def category_label(self):
        return dict(self.CATEGORIES).get(self.category, self.category)

    @property
    def priority_label(self):
        return dict(self.PRIORITIES).get(self.priority, self.priority)

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)


class ParentCommunication(models.Model):
    """A dated log of communication with a student's parent/guardian."""
    CHANNELS = [
        ("letter", "رسالة مكتوبة"), ("phone", "مكالمة هاتفية"),
        ("meeting", "لقاء"), ("message", "رسالة قصيرة / تطبيق"),
        ("other", "أخرى"),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="parent_communications")
    support_plan = models.ForeignKey(SupportPlan, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="communications")
    date = models.DateField()
    channel = models.CharField(max_length=20, choices=CHANNELS, default="letter")
    subject = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    outcome = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    @property
    def channel_label(self):
        return dict(self.CHANNELS).get(self.channel, self.channel)




# ------------------------------------------------------------------ assignments & homework
class Assignment(models.Model):
    """A homework / classwork task assigned to one class, optionally linked to a lesson."""
    TYPES = [
        ("homework", "واجب منزلي"), ("classwork", "نشاط صفي"),
        ("project", "مشروع"), ("research", "بحث"),
        ("revision", "مراجعة"), ("exercise", "تمرين تطبيقي"), ("other", "أخرى"),
    ]
    STATUSES = [
        ("draft", "مسودة"), ("active", "جارية"),
        ("closed", "مغلقة"), ("archived", "مؤرشفة"),
    ]
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="assignments")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="assignments")
    title = models.CharField(max_length=200)
    assignment_type = models.CharField(max_length=30, choices=TYPES, default="homework")
    status = models.CharField(max_length=20, choices=STATUSES, default="active")
    assigned_date = models.DateField(default=datetime.date.today)
    due_date = models.DateField(null=True, blank=True)
    instructions = models.TextField(blank=True)
    success_criteria = models.TextField(blank=True, help_text="معايير إنجاز المهمة، سطر لكل معيار")
    max_score = models.FloatField(default=20)
    estimated_minutes = models.PositiveSmallIntegerField(default=30)
    allow_late = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "-created_at"]

    def __str__(self):
        return self.title

    @property
    def type_label(self):
        return dict(self.TYPES).get(self.assignment_type, self.assignment_type)

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)

    @property
    def is_overdue(self):
        return bool(self.due_date and self.due_date < datetime.date.today()
                    and self.status in ("draft", "active"))

    @property
    def days_left(self):
        if not self.due_date:
            return None
        return (self.due_date - datetime.date.today()).days

    @property
    def stats(self):
        submissions = list(self.submissions.all())
        expected = self.school_class.students.count() if self.school_class_id else 0
        tracked = len(submissions)
        submitted_statuses = ("submitted", "late", "reviewed")
        submitted = sum(1 for r in submissions if r.status in submitted_statuses)
        late = sum(1 for r in submissions if r.status == "late")
        reviewed = sum(1 for r in submissions if r.status == "reviewed")
        excused = sum(1 for r in submissions if r.status == "excused")
        explicit_missing = sum(1 for r in submissions if r.status == "not_submitted")
        untracked = max(expected - tracked, 0)
        denominator = max(expected - excused, 0)
        scored = [r for r in submissions if r.score is not None]
        average_percent = (round(sum((r.score / self.max_score * 100 if self.max_score else 0)
                                     for r in scored) / len(scored), 1) if scored else None)
        return {
            "expected": expected, "tracked": tracked, "submitted": submitted,
            "late": late, "reviewed": reviewed, "excused": excused,
            "explicit_missing": explicit_missing, "untracked": untracked,
            "missing": explicit_missing + untracked,
            "completion_rate": round(submitted * 100 / denominator, 1) if denominator else 0,
            "average_score_percent": average_percent,
            "scored": len(scored),
        }


class AssignmentSubmission(models.Model):
    """One student's submission state and result for one assignment."""
    STATUSES = [
        ("not_submitted", "لم يُسلّم بعد"), ("submitted", "سُلّم"),
        ("late", "سُلّم متأخرًا"), ("reviewed", "تمت مراجعته"), ("excused", "معذور"),
    ]
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name="submissions")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="assignment_submissions")
    status = models.CharField(max_length=20, choices=STATUSES, default="not_submitted")
    submitted_date = models.DateField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True, help_text="نقطة المهمة")
    feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["student__full_name"]
        constraints = [
            models.UniqueConstraint(fields=["assignment", "student"], name="unique_assignment_student_submission"),
        ]

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)




# ------------------------------------------------------------------ teacher action centre
class TeacherTask(models.Model):
    """A trackable teacher action, created manually or accepted from smart suggestions."""
    CATEGORIES = [
        ("support", "دعم التلاميذ"), ("assignment", "المهام والواجبات"),
        ("parent", "تواصل الأولياء"), ("attendance", "الحضور"),
        ("lesson", "تحضير الدروس"), ("calendar", "التنظيم والتقويم"),
        ("inspection", "التفتيش والمتابعة"), ("document", "الوثائق"),
        ("general", "عامة"),
    ]
    PRIORITIES = [("low", "منخفضة"), ("medium", "متوسطة"), ("high", "عالية")]
    STATUSES = [("pending", "قيد الانتظار"), ("in_progress", "قيد الإنجاز"),
                ("done", "منجزة"), ("cancelled", "ملغاة")]
    ORIGINS = [("manual", "يدوية"), ("auto", "اقتراح ذكي")]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher_tasks")
    title = models.CharField(max_length=220)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=30, choices=CATEGORIES, default="general")
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="medium")
    status = models.CharField(max_length=20, choices=STATUSES, default="pending")
    due_date = models.DateField(null=True, blank=True)
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name="teacher_tasks")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.SET_NULL, null=True, blank=True, related_name="teacher_tasks")
    source_type = models.CharField(max_length=40, blank=True)
    source_id = models.PositiveIntegerField(null=True, blank=True)
    origin = models.CharField(max_length=20, choices=ORIGINS, default="manual")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "-updated_at"]

    def __str__(self):
        return self.title

    @property
    def category_label(self):
        return dict(self.CATEGORIES).get(self.category, self.category)

    @property
    def priority_label(self):
        return dict(self.PRIORITIES).get(self.priority, self.priority)

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)

    @property
    def is_overdue(self):
        return bool(self.due_date and self.due_date < datetime.date.today() and self.status in ("pending", "in_progress"))

    @property
    def days_left(self):
        if not self.due_date:
            return None
        return (self.due_date - datetime.date.today()).days


# ------------------------------------------------------------------ calendar & inspection
class Holiday(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="holidays")
    name = models.CharField(max_length=160)
    start_date = models.DateField()
    end_date = models.DateField()
    kind = models.CharField(max_length=30, default="عطلة مدرسية",
                            choices=[("عطلة مدرسية", "عطلة مدرسية"), ("يوم وطني", "يوم وطني"), ("مناسبة دينية", "مناسبة دينية")])

    class Meta:
        ordering = ["start_date"]


class Seminar(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="seminars")
    title = models.CharField(max_length=200)
    date = models.DateField()
    place = models.CharField(max_length=200, blank=True)
    organizer = models.CharField(max_length=200, blank=True)
    kind = models.CharField(max_length=30, default="يوم تكويني",
                            choices=[("ندوة", "ندوة"), ("يوم تكويني", "يوم تكويني"), ("ملتقى", "ملتقى"), ("يوم دراسي", "يوم دراسي")])
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["date"]


class Institution(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="institutions")
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=60, blank=True, default="ثانوية")
    commune = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=160, blank=True, help_text="مقاطعة التفتيش")
    director = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    teachers_count = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]


class Visit(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="visits")
    date = models.DateField()
    institution = models.ForeignKey(Institution, on_delete=models.SET_NULL, null=True, blank=True, related_name="visits")
    visit_type = models.CharField(max_length=40, default="زيارة تفتيشية",
                                  choices=[("زيارة تفتيشية", "زيارة تفتيشية"), ("زيارة متابعة", "زيارة متابعة"),
                                           ("مرافقة تكوينية", "مرافقة تكوينية"), ("زيارة إدارية", "زيارة إدارية")])
    teacher_visited = models.CharField(max_length=160, blank=True)
    subject = models.CharField(max_length=160, blank=True, default="الإعلام الآلي")
    observations = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)

    class Meta:
        ordering = ["-date"]


class Observation(models.Model):
    """شبكة ملاحظة الحصة وتقييمها — lesson observation & evaluation grid."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="observations")
    date = models.DateField()
    institution = models.ForeignKey(Institution, on_delete=models.SET_NULL, null=True, blank=True, related_name="observations")
    teacher_name = models.CharField(max_length=160, blank=True)
    class_name = models.CharField(max_length=80, blank=True)
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="observations")
    criteria = models.JSONField(default=list, blank=True,
                                help_text="[{label, max, score}]")
    strengths = models.TextField(blank=True)
    improvements = models.TextField(blank=True)
    appreciation = models.CharField(max_length=80, blank=True)

    class Meta:
        ordering = ["-date"]

    @property
    def percent(self):
        total_max = sum(c.get("max", 0) for c in self.criteria)
        total = sum(c.get("score", 0) or 0 for c in self.criteria)
        return round(total * 100 / total_max, 1) if total_max else 0


# ------------------------------------------------------------------ creator studio
class CustomDocument(models.Model):
    """A visually-editable, block-based document (Creator Studio).

    Existing platform documents can be snapshotted into this model as an
    editable copy; new toolbox documents (exams, certificates, letters…)
    are born here. `content` is {"blocks": [ ... ]} rendered to PDF/DOCX.
    """
    KINDS = [
        ("blank", "وثيقة فارغة"), ("editable-copy", "نسخة قابلة للتحرير"),
        ("exam", "اختبار / فرض"), ("worksheet", "ورقة عمل / نشاط"),
        ("rubric", "شبكة تقويم"), ("flashcards", "بطاقات تعليمية"),
        ("certificate", "شهادات تقدير"), ("seating", "مخطط جلوس"),
        ("name-tags", "بطاقات أسماء"), ("poster", "ملصق قسم"),
        ("parent-letter", "رسالة / إشعار لأولياء التلاميذ"), ("meeting-minutes", "محضر اجتماع"),
        ("report-card", "كشف / تقرير تلميذ"), ("permission-slip", "رخصة / إذن خروج"),
        ("invitation", "دعوة نشاط"), ("attendance-sheet", "سجل الحضور والغياب"),
        ("tracker-sheet", "سجل متابعة الواجبات والسلوك"), ("student-id-cards", "بطاقات هوية التلاميذ"), ("revision-pack", "حزمة مراجعة وامتحانات"),
    ]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="custom_documents")
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=30, choices=KINDS, default="blank")
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="custom_documents")
    orientation = models.CharField(max_length=12, default="portrait",
                                   choices=[("portrait", "عمودي"), ("landscape", "أفقي")])
    content = models.JSONField(default=dict, blank=True)
    tags = models.JSONField(default=list, blank=True, help_text="وسوم قصيرة لتنظيم مكتبة الوثائق")
    is_favorite = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    source_type = models.CharField(max_length=30, blank=True)
    source_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title

    @property
    def blocks(self):
        return (self.content or {}).get("blocks", [])


class DocumentRevision(models.Model):
    """A restorable snapshot of a CustomDocument (taken before saves/restores)."""
    document = models.ForeignKey(CustomDocument, on_delete=models.CASCADE, related_name="revisions")
    label = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=30, default="blank")
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="document_revisions")
    orientation = models.CharField(max_length=12, default="portrait")
    content = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


# ------------------------------------------------------------------ v2 multi-tenancy & academic foundation


class Organization(models.Model):
    """A school group, education organization, or customer account (tenant)."""
    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=60, unique=True, help_text="Unique organization code.")
    status = models.CharField(max_length=20, default="active")
    locale = models.CharField(max_length=10, default="ar", help_text="Default UI language.")
    time_zone = models.CharField(max_length=60, default="Africa/Algiers")
    configuration = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Organizations"

    def __str__(self):
        return self.name


class School(models.Model):
    """A specific school under an organization."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="schools")
    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=60, help_text="Unique within the organization.")
    logo = models.CharField(max_length=500, blank=True, help_text="Document/logo identity reference.")
    address = models.CharField(max_length=255, blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    contact_email = models.EmailField(blank=True)
    status = models.CharField(max_length=20, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("organization", "code")]
        verbose_name_plural = "Schools"

    def __str__(self):
        return self.name


class Campus(models.Model):
    """A physical site where classes or rooms may be located."""
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="campuses")
    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=60, help_text="Unique within the school.")
    address = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("school", "code")]
        verbose_name_plural = "Campuses"

    def __str__(self):
        return f"{self.school.name} — {self.name}"


class AcademicYear(models.Model):
    """A configurable academic period. Not assumed to match the Gregorian year."""
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="academic_years")
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="academic_years")
    name = models.CharField(max_length=80, help_text="e.g. 2026 / 2027")
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, default="planned", help_text="planned, active, closed, archived")
    configuration_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "name"]
        unique_together = [("school", "name")]

    def __str__(self):
        return f"{self.school.name} — {self.name}"


class AcademicTerm(models.Model):
    """A term/semester within an academic year."""
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="terms")
    name = models.CharField(max_length=80, help_text="e.g. الثلاثي الأول / Term 1")
    sequence = models.PositiveSmallIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, default="planned")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["academic_year", "sequence"]
        unique_together = [("academic_year", "sequence"), ("academic_year", "name")]

    def __str__(self):
        return f"{self.academic_year.name} — {self.name}"


class Enrollment(models.Model):
    """Effective-dated student placement in a class for an academic year.

    A student may have historical enrollments across years but must not have
    two active class placements in the same scope unless the school model
    explicitly allows it.
    """
    student = models.ForeignKey("Student", on_delete=models.CASCADE, related_name="enrollments")
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="enrollments")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="enrollments")
    class_section = models.ForeignKey("SchoolClass", on_delete=models.CASCADE, related_name="enrollments")
    campus = models.ForeignKey(Campus, on_delete=models.SET_NULL, null=True, blank=True, related_name="enrollments")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default="active", help_text="active, completed, transferred, withdrawn")
    source = models.CharField(max_length=80, blank=True, help_text="transfer/source metadata")
    previous_placement = models.CharField(max_length=80, blank=True)
    next_placement = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "student__full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "academic_year", "class_section"],
                name="unique_student_year_class_enrollment",
                condition=models.Q(status="active"),
            ),
        ]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["academic_year", "class_section", "status"]),
            models.Index(fields=["start_date", "end_date"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} → {self.class_section.name} ({self.academic_year.name})"


# ------------------------------------------------------------------ v2 computer lab & seating planner


class ComputerLab(models.Model):
    """A computer lab room with seats and equipment."""

    STATUS_CHOICES = [
        ("active", "مفعل"),
        ("closed", "مقفول"),
        ("maintenance", "صيانة"),
    ]

    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="computer_labs")
    campus = models.ForeignKey("Campus", on_delete=models.SET_NULL, null=True, blank=True, related_name="computer_labs")
    name = models.CharField(max_length=160, help_text="مثال: مخبر الإعلام الآلي 1")
    code = models.SlugField(max_length=60, help_text="كود فريد داخل المدرسة")
    capacity = models.PositiveIntegerField(default=20, help_text="عدد المقاعد المتاحة")
    room_number = models.CharField(max_length=40, blank=True, help_text="رقم الغرفة")
    status = models.CharField(max_length=20, default="active", choices=STATUS_CHOICES)
    computers_count = models.PositiveIntegerField(default=0, help_text="عدد أجهزة الكمبيوتر الفعلية")
    operating_system = models.CharField(max_length=80, blank=True, help_text="نظام التشغيل المثبت")
    software_list = models.JSONField(default=list, blank=True, help_text="قائمة البرامج المثبتة")
    notes = models.TextField(blank=True, help_text="ملاحظات إضافية")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["school", "name"]
        unique_together = [("school", "code")]
        indexes = [
            models.Index(fields=["school", "campus", "status"]),
            models.Index(fields=["code"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code}) — {self.school.name}"


class Seat(models.Model):
    """An individual seat within a computer lab."""

    STATUS_CHOICES = [
        ("available", "متوفر"),
        ("occupied", "مشغول"),
        ("maintenance", "صيانة"),
        ("broken", "معطل"),
    ]

    lab = models.ForeignKey(ComputerLab, on_delete=models.CASCADE, related_name="seats")
    seat_number = models.CharField(max_length=20, help_text="مثال: A1، B5")
    row = models.CharField(max_length=10, blank=True, help_text="الصف، مثال: A")
    column = models.PositiveIntegerField(default=1, help_text="العمود، مثال: 1")
    status = models.CharField(max_length=20, default="available", choices=STATUS_CHOICES)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["lab", "row", "column"]
        unique_together = [("lab", "seat_number")]
        indexes = [
            models.Index(fields=["lab", "status"]),
            models.Index(fields=["lab", "row", "column"]),
        ]

    def __str__(self):
        return f"{self.lab.name} — {self.seat_number}"


class SeatingAssignment(models.Model):
    """Assignment of a student to a specific seat in a lab for a term."""

    student = models.ForeignKey("Student", on_delete=models.CASCADE, related_name="seating_assignments")
    lab = models.ForeignKey(ComputerLab, on_delete=models.CASCADE, related_name="seating_assignments")
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE, related_name="assignments")
    academic_year = models.ForeignKey("AcademicYear", on_delete=models.CASCADE, related_name="seating_assignments")
    term = models.PositiveSmallIntegerField(choices=[(1, "الثلاثي الأول"), (2, "الثلاثي الثاني"), (3, "الثلاثي الثالث")])
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="seating_assignments_created")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-assigned_at"]
        unique_together = [
            ("lab", "seat", "academic_year", "term"),
            ("student", "lab", "academic_year", "term"),
        ]
        indexes = [
            models.Index(fields=["student", "academic_year", "term"]),
            models.Index(fields=["lab", "academic_year", "term"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} → {self.seat.seat_number} ({self.lab.name}, {self.get_term_display()})"


# ------------------------------------------------------------------ v2 security center & audit log


class SecurityAuditLog(models.Model):
    """Immutable audit trail of security-relevant actions in the workspace.

    Records who did what, when, and from where — for accountability,
    incident investigation, and compliance review. Entries are append-only
    and never edited or deleted through normal UI paths.
    """

    ACTION_CHOICES = [
        ("login", "تسجيل دخول"),
        ("logout", "تسجيل خروج"),
        ("create", "إنشاء"),
        ("update", "تعديل"),
        ("delete", "حذف"),
        ("export", "تصدير"),
        ("import", "استيراد"),
        ("view", "عرض"),
        ("approve", "اعتماد"),
        ("reject", "رفض"),
        ("publish", "نشر"),
        ("void", "إلغاء"),
        ("submit", "إرسال"),
        ("failed_login", "فشل تسجيل دخول"),
        ("access_denied", "رفض وصول"),
        ("data_change", "تغيير بيانات"),
        ("system_event", "حدث نظام"),
    ]

    RESOURCE_CHOICES = [
        ("user", "مستخدم"),
        ("student", "تلميذ"),
        ("class", "فوج"),
        ("course", "مقرر"),
        ("lesson-plan", "خطة درس"),
        ("session", "حصص"),
        ("grade-ruleset", "مجموعة قواعد حساب"),
        ("calculated-result", "نتيجة حساب"),
        ("computer-lab", "مختبر كمبيوتر"),
        ("seat", "مقعد"),
        ("seating-assignment", "تكليف مقعد"),
        ("organization", "منظمة"),
        ("school", "مدرسة"),
        ("campus", "حرم"),
        ("academic-year", "سنة دراسية"),
        ("academic-term", "ثلاثي"),
        ("enrollment", "تسجيل"),
        ("document", "وثيقة"),
        ("backup", "نسخة احتياطية"),
        ("system", "نظام"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    resource_type = models.CharField(max_length=40, choices=RESOURCE_CHOICES, blank=True)
    resource_id = models.PositiveIntegerField(null=True, blank=True)
    resource_label = models.CharField(max_length=200, blank=True, help_text="وصف مورد قابل للقراءة من قبل الإنسان")
    details = models.JSONField(default=dict, blank=True, help_text="تفاصيل إضافية عن العملية")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["resource_type", "resource_id"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        user_name = self.user.username if self.user else "النظام"
        return f"{user_name} — {self.get_action_display()} — {self.created_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        # Audit logs are append-only: prevent updates through the ORM
        if self.pk is not None:
            raise ValueError("سجلات التدقيق غير قابلة للتعديل بعد الإنشاء")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Prevent deletion through normal UI paths
        raise ValueError("سجلات التدقيق غير قابلة للحذف")


# ------------------------------------------------------------------ question bank
class Meeting(models.Model):
    """A class council / coordination meeting with tracked decisions."""

    TYPES = [
        ("class_council", "مجلس قسم"), ("coordination", "اجتماع تنسيق"),
        ("parents", "لقاء أولياء"), ("administration", "اجتماع إداري"), ("other", "أخرى"),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="meetings")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.SET_NULL, null=True, blank=True, related_name="meetings")
    date = models.DateField()
    title = models.CharField(max_length=200)
    meeting_type = models.CharField(max_length=20, choices=TYPES, default="class_council")
    term = models.PositiveSmallIntegerField(null=True, blank=True)
    agenda = models.TextField(blank=True)
    attendees = models.JSONField(default=list, blank=True, help_text="قائمة أسماء الحاضرين")
    decisions = models.JSONField(default=list, blank=True,
                                 help_text="[{text, responsible, due, done, task_id}]")
    notes = models.TextField(blank=True)
    minutes_document = models.ForeignKey("CustomDocument", on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name="source_meetings")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return self.title

    @property
    def type_label(self):
        return dict(self.TYPES).get(self.meeting_type, self.meeting_type)

    @property
    def decisions_total(self):
        return len(self.decisions or [])

    @property
    def decisions_done(self):
        return sum(1 for row in (self.decisions or []) if row.get("done"))


class SupportGroup(models.Model):
    """A remedial/support group of students formed from term evidence."""

    BANDS = [("intensive", "دعم مكثف"), ("support", "دعم ومواكبة"), ("boost", "تعزيز وتثبيت"), ("attendance", "متابعة الحضور")]
    STATUSES = [("active", "نشطة"), ("done", "منتهية")]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_groups")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="support_groups")
    term = models.PositiveSmallIntegerField(default=1)
    band = models.CharField(max_length=20, choices=BANDS, default="support")
    title = models.CharField(max_length=200)
    focus = models.TextField(blank=True, help_text="محور التركيز في حصص الاستدراك")
    members = models.ManyToManyField(Student, related_name="support_groups", blank=True)
    planned_date = models.DateField(null=True, blank=True)
    planned_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=STATUSES, default="active")
    worksheet_document = models.ForeignKey("CustomDocument", on_delete=models.SET_NULL, null=True, blank=True,
                                           related_name="source_support_groups")
    source_assessment = models.ForeignKey("Assessment", on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name="support_groups")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title

    @property
    def band_label(self):
        return dict(self.BANDS).get(self.band, self.band)


class ParentMeetingDay(models.Model):
    """A scheduled parent-meeting day for one class, with timed appointments."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="parent_meeting_days")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="parent_meeting_days")
    date = models.DateField()
    start_time = models.TimeField(default="13:00")
    slot_minutes = models.PositiveSmallIntegerField(default=10)
    location = models.CharField(max_length=160, blank=True, help_text="مكان اللقاء (قاعة الأساتذة…)")
    title = models.CharField(max_length=200, default="يوم لقاء الأولياء")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.title} — {self.date}"

    @property
    def stats(self):
        rows = list(self.appointments.all())
        return {
            "total": len(rows),
            "attended": sum(1 for row in rows if row.status == "attended"),
            "no_show": sum(1 for row in rows if row.status == "no_show"),
            "scheduled": sum(1 for row in rows if row.status == "scheduled"),
        }


class ParentAppointment(models.Model):
    """One parent's timed appointment within a ParentMeetingDay."""

    STATUSES = [("scheduled", "مجدول"), ("attended", "حضر"), ("no_show", "لم يحضر"), ("cancelled", "ملغي")]

    day = models.ForeignKey(ParentMeetingDay, on_delete=models.CASCADE, related_name="appointments")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="parent_appointments")
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUSES, default="scheduled")
    topics = models.JSONField(default=list, blank=True, help_text="أسباب الدعوة / مواضيع النقاش")
    outcome = models.TextField(blank=True, help_text="خلاصة اللقاء")
    communication = models.ForeignKey(ParentCommunication, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name="source_appointments")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_time", "id"]

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)


class Assessment(models.Model):
    """A planned classroom assessment: diagnostic check, formative task,
    supervised test or term exam — with an optional generated paper and
    per-student results that stay separate from the official gradebook."""

    KINDS = [
        ("diagnostic", "تقويم تشخيصي"), ("formative", "تقويم تكويني"),
        ("supervised", "فرض محروس"), ("exam", "اختبار"),
        ("mock", "اختبار تجريبي"),
    ]
    STATUSES = [
        ("planned", "مخطط"), ("prepared", "الموضوع جاهز"),
        ("administered", "أُجري"), ("corrected", "صُحّح"),
        ("returned", "سُلّم للتلاميذ"), ("archived", "مؤرشف"),
    ]
    GRADE_COMPONENTS = {
        "diagnostic": ("continuous", "تقويم مستمر"),
        "formative": ("continuous", "تقويم مستمر"),
        "supervised": ("supervised", "فرض محروس"),
        "exam": ("exam", "اختبار"),
        "mock": ("exam", "اختبار"),
    }

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="assessments")
    school_class = models.ForeignKey(SchoolClass, on_delete=models.CASCADE, related_name="assessments")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="assessments")
    term = models.PositiveSmallIntegerField(default=1)
    assessment_kind = models.CharField(max_length=20, choices=KINDS, default="supervised")
    title = models.CharField(max_length=200)
    date = models.DateField(default=datetime.date.today)
    duration_minutes = models.PositiveSmallIntegerField(default=60)
    max_score = models.FloatField(default=20)
    status = models.CharField(max_length=20, choices=STATUSES, default="planned")
    instructions = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    gradebook_synced_at = models.DateTimeField(null=True, blank=True,
                                               help_text="آخر مرة ضُمّنت نتائج هذا التقويم في دفتر التنقيط")
    paper_document = models.ForeignKey("CustomDocument", on_delete=models.SET_NULL, null=True,
                                       blank=True, related_name="source_assessments")
    analysis_document = models.ForeignKey("CustomDocument", on_delete=models.SET_NULL, null=True,
                                          blank=True, related_name="analysis_assessments")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return self.title

    @property
    def kind_label(self):
        return dict(self.KINDS).get(self.assessment_kind, self.assessment_kind)

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)

    @property
    def grade_component(self):
        return self.GRADE_COMPONENTS.get(self.assessment_kind, ("continuous", "تقويم مستمر"))[0]

    @property
    def grade_component_label(self):
        return self.GRADE_COMPONENTS.get(self.assessment_kind, ("continuous", "تقويم مستمر"))[1]

    @property
    def days_left(self):
        return (self.date - datetime.date.today()).days if self.date else None

    @property
    def is_overdue(self):
        return bool(self.date and self.date < datetime.date.today()
                    and self.status in ("planned", "prepared"))

    @property
    def stats(self):
        rows = list(self.results.all())
        expected = self.school_class.students.count() if self.school_class_id else 0
        recorded_rows = [r for r in rows if r.status != "unmarked"]
        present_rows = [r for r in rows if r.status == "present"]
        scored_rows = [r for r in present_rows if r.score is not None]
        max_score = float(self.max_score or 20) or 20
        percents = [round(float(r.score) / max_score * 100, 1) for r in scored_rows]
        bands = [("needs_support", "دون 50٪", 0, 50), ("pass", "50٪ – 65٪", 50, 65),
                 ("good", "65٪ – 80٪", 65, 80), ("excellent", "80٪ فأكثر", 80, 100.01)]
        distribution = [{"key": key, "label": label, "count": sum(1 for p in percents if lo <= p < hi)}
                        for key, label, lo, hi in bands]
        average_percent = round(sum(percents) / len(percents), 1) if percents else None
        ordered = sorted(percents)
        median_percent = None
        if ordered:
            mid = len(ordered) // 2
            median_percent = ordered[mid] if len(ordered) % 2 else round((ordered[mid - 1] + ordered[mid]) / 2, 1)
        return {
            "expected": expected,
            "recorded": len(recorded_rows),
            "present": len(present_rows),
            "absent": sum(1 for r in rows if r.status == "absent"),
            "excused": sum(1 for r in rows if r.status == "excused"),
            "scored": len(scored_rows),
            "unscored": max(len(present_rows) - len(scored_rows), 0),
            "recording_progress": round(len(recorded_rows) * 100 / expected, 1) if expected else 0,
            "correction_progress": round(len(scored_rows) * 100 / len(present_rows), 1) if present_rows else 0,
            "average_score": round(sum(float(r.score) for r in scored_rows) / len(scored_rows), 2) if scored_rows else None,
            "average_percent": average_percent,
            "average_20": round(average_percent / 5, 2) if average_percent is not None else None,
            "median_percent": median_percent,
            "highest_percent": max(percents) if percents else None,
            "lowest_percent": min(percents) if percents else None,
            "success_rate": round(sum(1 for p in percents if p >= 50) * 100 / len(percents), 1) if percents else None,
            "distribution": distribution,
        }


class AssessmentResult(models.Model):
    """One student's presence and score for one assessment."""

    STATUSES = [
        ("unmarked", "غير مسجل"), ("present", "حاضر"),
        ("absent", "غائب"), ("excused", "غائب بعذر"),
    ]

    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="results")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="assessment_results")
    status = models.CharField(max_length=20, choices=STATUSES, default="unmarked")
    score = models.FloatField(null=True, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["student__full_name"]
        constraints = [
            models.UniqueConstraint(fields=["assessment", "student"], name="unique_assessment_student_result"),
        ]

    @property
    def status_label(self):
        return dict(self.STATUSES).get(self.status, self.status)

    @property
    def score_percent(self):
        if self.score is None or not self.assessment_id or not self.assessment.max_score:
            return None
        return round(float(self.score) / float(self.assessment.max_score) * 100, 1)


class QuestionBankItem(models.Model):
    """A reusable assessment question shared by exams, worksheets and flashcards."""
    TYPES = [
        ("سؤال قصير", "سؤال قصير"), ("اختيار من متعدد", "اختيار من متعدد"),
        ("صح / خطأ", "صح / خطأ"), ("سؤال مقالي", "سؤال مقالي"),
        ("أكمل الفراغ", "أكمل الفراغ"), ("تصنيف", "تصنيف"),
        ("نشاط تطبيقي", "نشاط تطبيقي"),
    ]
    DIFFICULTIES = [("سهل", "سهل"), ("متوسط", "متوسط"), ("صعب", "صعب")]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="question_bank_items")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name="question_bank_items")
    prompt = models.TextField()
    qtype = models.CharField(max_length=40, choices=TYPES, default="سؤال قصير")
    difficulty = models.CharField(max_length=20, choices=DIFFICULTIES, default="متوسط")
    points = models.FloatField(default=2)
    options = models.JSONField(default=list, blank=True)
    answer = models.TextField(blank=True)
    explanation = models.TextField(blank=True)
    lines = models.PositiveSmallIntegerField(default=3)
    tags = models.JSONField(default=list, blank=True)
    source_document = models.ForeignKey(CustomDocument, on_delete=models.SET_NULL,
                                        null=True, blank=True, related_name="bank_questions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.prompt[:80]

    def as_block_question(self):
        return {
            "prompt": self.prompt,
            "qtype": self.qtype,
            "points": self.points,
            "options": list(self.options or []),
            "answer": self.answer or "",
            "lines": self.lines,
        }
