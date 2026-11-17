from django.contrib.auth.models import User
from rest_framework import serializers
from .models import (Theme, Journal, LessonPlan, NoteBook, NoteEntry,
                     SchoolClass, TimetableSlot, Course, Session, WEEKDAY_NAMES,
                     TeacherProfile, Student, Mark, Holiday, Seminar,
                     Institution, Visit, Observation, CustomDocument, DocumentRevision, QuestionBankItem, AttendanceRecord, StudentFollowUpRecord, SupportPlan, ParentCommunication, Assignment, AssignmentSubmission, TeacherTask, Meeting, ParentMeetingDay, ParentAppointment, SupportGroup, Assessment, AssessmentResult)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


class ThemeSerializer(serializers.ModelSerializer):
    css_vars = serializers.ReadOnlyField()
    usage = serializers.SerializerMethodField()

    class Meta:
        model = Theme
        fields = ["id", "slug", "name_ar", "name_en", "tagline", "deep", "deeper", "ink",
                  "accent", "accent2", "soft", "soft2", "line", "paper", "heading_font",
                  "body_font", "style_type", "source", "pattern", "cover_style",
                  "css_vars", "usage", "created_at"]
        read_only_fields = ["slug", "source", "created_at"]

    def get_usage(self, obj):
        return {
            "journals": obj.journals.count(),
            "lesson_plans": obj.lesson_plans.count(),
            "notebooks": obj.notebooks.count(),
        }


class JournalSerializer(serializers.ModelSerializer):
    theme_detail = ThemeSerializer(source="theme", read_only=True)
    sessions_count = serializers.SerializerMethodField()
    sessions_recent = serializers.SerializerMethodField()

    class Meta:
        model = Journal
        fields = ["id", "title", "institution", "school_year", "teacher_name",
                  "description", "theme", "theme_detail", "sessions_count",
                  "sessions_recent", "page_config", "cover_config", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_sessions_count(self, obj):
        return obj.sessions.filter(status="done").count()

    def get_sessions_recent(self, obj):
        rows = obj.sessions.select_related("school_class", "course").all()[:8]
        return [{
            "id": s.id, "date": str(s.date),
            "class_name": s.school_class.name,
            "course_title": s.course.title if s.course else None,
            "status": s.status,
            "points_written": s.points_written,
        } for s in rows]


class LessonPlanSerializer(serializers.ModelSerializer):
    theme_detail = ThemeSerializer(source="theme", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    sessions_count = serializers.SerializerMethodField()

    class Meta:
        model = LessonPlan
        fields = ["id", "title", "subject", "level", "domain", "unit", "duration",
                  "objectives", "phases", "theme", "theme_detail", "course", "course_title",
                  "sessions_count", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_sessions_count(self, obj):
        return obj.sessions.filter(status="done").count()


class NoteEntrySerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True, default=None)
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    session_label = serializers.SerializerMethodField()

    class Meta:
        model = NoteEntry
        fields = ["id", "notebook", "date", "title", "content", "tag",
                  "school_class", "course", "session", "class_name", "course_title",
                  "session_label", "created_at"]
        read_only_fields = ["created_at"]

    def get_session_label(self, obj):
        if not obj.session_id:
            return None
        s = obj.session
        return f"{s.date} • {s.course.title if s.course else 'حصة'} • {s.school_class.name}"


# ------------------------------------------------------------------ studio
class TimetableSlotSerializer(serializers.ModelSerializer):
    weekday_name = serializers.SerializerMethodField()

    class Meta:
        model = TimetableSlot
        fields = ["id", "school_class", "weekday", "weekday_name", "start_time", "end_time", "room"]

    def get_weekday_name(self, obj):
        return WEEKDAY_NAMES[obj.weekday] if 0 <= obj.weekday < 7 else ""


def class_progress(school_class, courses=None):
    """Alignment engine: what this class has covered, and what's next."""
    if courses is None:
        courses = Course.objects.filter(owner=school_class.owner)
    courses = list(courses)
    done_ids = set(
        Session.objects.filter(school_class=school_class, status="done", course__isnull=False)
        .values_list("course_id", flat=True))
    total = len(courses)
    done = sum(1 for c in courses if c.id in done_ids)
    next_course = next((c for c in courses if c.id not in done_ids), None)
    last = (Session.objects.filter(school_class=school_class, status="done")
            .order_by("-date", "-start_time").first())
    return {
        "done_count": done,
        "done_course_ids": sorted(done_ids),
        "total_courses": total,
        "percent": round(done * 100 / total) if total else 0,
        "next_course": ({"id": next_course.id, "title": next_course.title,
                         "order": next_course.order} if next_course else None),
        "last_session": ({"id": last.id, "date": str(last.date),
                          "course_title": last.course.title if last.course else None}
                         if last else None),
    }


class SchoolClassSerializer(serializers.ModelSerializer):
    slots = TimetableSlotSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = SchoolClass
        fields = ["id", "name", "level", "students_count", "slots", "progress",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_progress(self, obj):
        return class_progress(obj)


class CourseSerializer(serializers.ModelSerializer):
    theme_detail = ThemeSerializer(source="theme", read_only=True)
    plan = serializers.SerializerMethodField()
    plans_count = serializers.SerializerMethodField()
    taught_in = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "title", "domain", "unit", "level", "order", "summary",
                  "key_points", "theme", "theme_detail", "plan", "plans_count", "taught_in",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_plan(self, obj):
        p = obj.plans.first()
        return {"id": p.id, "title": p.title} if p else None

    def get_plans_count(self, obj):
        return obj.plans.count()

    def get_taught_in(self, obj):
        rows = (Session.objects.filter(course=obj, status="done")
                .values("school_class__id", "school_class__name").distinct())
        return [{"id": r["school_class__id"], "name": r["school_class__name"]} for r in rows]


class SessionSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    course_domain = serializers.CharField(source="course.domain", read_only=True, default=None)
    plan_title = serializers.CharField(source="lesson_plan.title", read_only=True, default=None)
    weekday_name = serializers.SerializerMethodField()
    class_progress_after = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ["id", "journal", "school_class", "class_name", "course", "course_title",
                  "course_domain", "lesson_plan", "plan_title", "date", "weekday_name",
                  "start_time", "duration", "status", "points_written", "board_summary",
                  "homework", "absentees", "remarks", "class_progress_after",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_weekday_name(self, obj):
        return WEEKDAY_NAMES[obj.weekday_index]

    def get_class_progress_after(self, obj):
        return class_progress(obj.school_class)


class TeacherProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherProfile
        exclude = ["user"]


class MarkSerializer(serializers.ModelSerializer):
    average = serializers.ReadOnlyField()

    class Meta:
        model = Mark
        fields = ["id", "student", "term", "continuous", "supervised", "exam", "average"]


class StudentSerializer(serializers.ModelSerializer):
    marks = MarkSerializer(many=True, read_only=True)
    annual_average = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ["id", "school_class", "full_name", "birth_date", "gender",
                  "notes", "marks", "annual_average"]

    def get_annual_average(self, obj):
        avgs = [m.average for m in obj.marks.all() if m.average is not None]
        return round(sum(avgs) / len(avgs), 2) if avgs else None


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    class_id = serializers.IntegerField(source="student.school_class_id", read_only=True)
    class_name = serializers.CharField(source="student.school_class.name", read_only=True)
    status_label = serializers.ReadOnlyField()

    class Meta:
        model = AttendanceRecord
        fields = ["id", "student", "student_name", "class_id", "class_name", "session",
                  "date", "status", "status_label", "note", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_status(self, value):
        if value not in dict(AttendanceRecord.STATUSES):
            raise serializers.ValidationError("حالة حضور غير صالحة.")
        return value


class StudentFollowUpRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    class_id = serializers.IntegerField(source="student.school_class_id", read_only=True)
    class_name = serializers.CharField(source="student.school_class.name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    category_label = serializers.ReadOnlyField()

    class Meta:
        model = StudentFollowUpRecord
        fields = ["id", "student", "student_name", "class_id", "class_name", "course", "course_title",
                  "session", "date", "category", "category_label", "score", "status", "note",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_category(self, value):
        if value not in dict(StudentFollowUpRecord.CATEGORIES):
            raise serializers.ValidationError("صنف متابعة غير صالح.")
        return value

    def validate_score(self, value):
        if value is None:
            return None
        return min(max(int(value), 0), 5)


class SupportPlanSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    class_id = serializers.IntegerField(source="student.school_class_id", read_only=True)
    class_name = serializers.CharField(source="student.school_class.name", read_only=True)
    category_label = serializers.ReadOnlyField()
    priority_label = serializers.ReadOnlyField()
    status_label = serializers.ReadOnlyField()
    progress_percent = serializers.ReadOnlyField()
    communications_count = serializers.IntegerField(source="communications.count", read_only=True)

    class Meta:
        model = SupportPlan
        fields = ["id", "student", "student_name", "class_id", "class_name", "title", "category", "category_label",
                  "priority", "priority_label", "status", "status_label", "reason", "actions", "progress_percent",
                  "start_date", "due_date", "teacher_notes", "outcome", "communications_count", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_actions(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("إجراءات الدعم يجب أن تكون قائمة.")
        cleaned = []
        for item in value[:30]:
            if isinstance(item, dict):
                text = str(item.get("text") or "").strip()[:300]
                if text:
                    cleaned.append({"text": text, "done": bool(item.get("done")), "due": str(item.get("due") or "")[:10]})
            elif str(item).strip():
                cleaned.append({"text": str(item).strip()[:300], "done": False, "due": ""})
        return cleaned


class ParentCommunicationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    class_id = serializers.IntegerField(source="student.school_class_id", read_only=True)
    class_name = serializers.CharField(source="student.school_class.name", read_only=True)
    channel_label = serializers.ReadOnlyField()
    plan_title = serializers.CharField(source="support_plan.title", read_only=True, default=None)

    class Meta:
        model = ParentCommunication
        fields = ["id", "student", "student_name", "class_id", "class_name", "support_plan", "plan_title",
                  "date", "channel", "channel_label", "subject", "summary", "outcome", "follow_up_date",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]



class AssignmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    type_label = serializers.ReadOnlyField()
    status_label = serializers.ReadOnlyField()
    stats = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    days_left = serializers.ReadOnlyField()

    class Meta:
        model = Assignment
        fields = ["id", "school_class", "class_name", "course", "course_title", "title",
                  "assignment_type", "type_label", "status", "status_label", "assigned_date", "due_date",
                  "instructions", "success_criteria", "max_score", "estimated_minutes", "allow_late",
                  "stats", "is_overdue", "days_left", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        assigned = attrs.get("assigned_date", getattr(self.instance, "assigned_date", None))
        due = attrs.get("due_date", getattr(self.instance, "due_date", None))
        if assigned and due and due < assigned:
            raise serializers.ValidationError({"due_date": "تاريخ الأجل لا يمكن أن يسبق تاريخ الإسناد."})
        max_score = attrs.get("max_score", getattr(self.instance, "max_score", 20))
        if max_score is None or float(max_score) <= 0:
            raise serializers.ValidationError({"max_score": "النقطة القصوى يجب أن تكون أكبر من صفر."})
        return attrs


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    class_id = serializers.IntegerField(source="student.school_class_id", read_only=True)
    class_name = serializers.CharField(source="student.school_class.name", read_only=True)
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)
    status_label = serializers.ReadOnlyField()
    tracked = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentSubmission
        fields = ["id", "assignment", "assignment_title", "student", "student_name", "class_id", "class_name",
                  "status", "status_label", "submitted_date", "score", "feedback", "tracked",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_tracked(self, obj):
        return bool(obj.pk)

    def validate(self, attrs):
        assignment = attrs.get("assignment", getattr(self.instance, "assignment", None))
        score = attrs.get("score", getattr(self.instance, "score", None))
        if assignment is not None and score is not None and not 0 <= float(score) <= float(assignment.max_score):
            raise serializers.ValidationError({"score": f"النقطة يجب أن تكون بين 0 و{assignment.max_score}."})
        return attrs



class TeacherTaskSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True, default=None)
    class_name = serializers.CharField(source="school_class.name", read_only=True, default=None)
    category_label = serializers.ReadOnlyField()
    priority_label = serializers.ReadOnlyField()
    status_label = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    days_left = serializers.ReadOnlyField()
    route = serializers.SerializerMethodField()

    class Meta:
        model = TeacherTask
        fields = ["id", "title", "description", "category", "category_label", "priority", "priority_label",
                  "status", "status_label", "due_date", "student", "student_name", "school_class", "class_name",
                  "source_type", "source_id", "origin", "is_overdue", "days_left", "route",
                  "completed_at", "created_at", "updated_at"]
        read_only_fields = ["completed_at", "created_at", "updated_at"]

    def get_route(self, obj):
        if obj.source_type == "student" and (obj.source_id or obj.student_id):
            return f"/students/{obj.source_id or obj.student_id}"
        if obj.source_type in ("support-plan", "parent-communication") or obj.category in ("support", "parent"):
            return "/support"
        if obj.source_type == "assignment" or obj.category == "assignment":
            return "/assignments"
        if obj.source_type == "class-analytics" and obj.school_class_id:
            return f"/analytics?class={obj.school_class_id}"
        if obj.source_type == "attendance" or obj.category == "attendance":
            return "/follow-up"
        if obj.source_type in ("course", "lesson-plan") or obj.category == "lesson":
            return "/courses"
        if obj.category == "calendar":
            return "/calendar"
        if obj.category == "inspection":
            return "/inspection"
        if obj.student_id:
            return f"/students/{obj.student_id}"
        return "/actions"

    def validate(self, attrs):
        student = attrs.get("student", getattr(self.instance, "student", None))
        school_class = attrs.get("school_class", getattr(self.instance, "school_class", None))
        if student is not None and school_class is not None and student.school_class_id != school_class.id:
            raise serializers.ValidationError({"school_class": "الفوج لا يطابق فوج التلميذ."})
        return attrs


class HolidaySerializer(serializers.ModelSerializer):
    days = serializers.SerializerMethodField()

    class Meta:
        model = Holiday
        fields = ["id", "name", "start_date", "end_date", "kind", "days"]

    def get_days(self, obj):
        return (obj.end_date - obj.start_date).days + 1


class SeminarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seminar
        fields = ["id", "title", "date", "place", "organizer", "kind", "notes"]


class InstitutionSerializer(serializers.ModelSerializer):
    visits_count = serializers.IntegerField(source="visits.count", read_only=True)

    class Meta:
        model = Institution
        fields = ["id", "name", "kind", "commune", "district", "director",
                  "phone", "teachers_count", "notes", "visits_count"]


class VisitSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True, default="—")

    class Meta:
        model = Visit
        fields = ["id", "date", "institution", "institution_name", "visit_type",
                  "teacher_visited", "subject", "observations", "recommendations"]


class ObservationSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source="institution.name", read_only=True, default="—")
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    percent = serializers.ReadOnlyField()

    class Meta:
        model = Observation
        fields = ["id", "date", "institution", "institution_name", "teacher_name",
                  "class_name", "course", "course_title", "criteria", "percent",
                  "strengths", "improvements", "appreciation"]


class NoteBookSerializer(serializers.ModelSerializer):
    theme_detail = ThemeSerializer(source="theme", read_only=True)
    entries_count = serializers.IntegerField(source="entries.count", read_only=True)
    latest_entries = serializers.SerializerMethodField()

    class Meta:
        model = NoteBook
        fields = ["id", "title", "class_name", "theme", "theme_detail",
                  "entries_count", "latest_entries", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_latest_entries(self, obj):
        return NoteEntrySerializer(obj.entries.all()[:4], many=True).data


class CustomDocumentSerializer(serializers.ModelSerializer):
    theme_detail = ThemeSerializer(source="theme", read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    blocks_count = serializers.SerializerMethodField()
    revisions_count = serializers.IntegerField(source="revisions.count", read_only=True)

    class Meta:
        model = CustomDocument
        fields = ["id", "title", "kind", "kind_label", "theme", "theme_detail",
                  "orientation", "content", "tags", "is_favorite", "is_archived",
                  "source_type", "source_id", "blocks_count", "revisions_count",
                  "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_blocks_count(self, obj):
        return len(obj.blocks or [])

    def validate_tags(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("الوسوم يجب أن تكون قائمة نصوص.")
        cleaned = []
        for tag in value:
            text = str(tag).strip()[:40]
            if text and text not in cleaned:
                cleaned.append(text)
            if len(cleaned) >= 12:
                break
        return cleaned


class DocumentRevisionSerializer(serializers.ModelSerializer):
    theme_detail = ThemeSerializer(source="theme", read_only=True)
    blocks_count = serializers.SerializerMethodField()

    class Meta:
        model = DocumentRevision
        fields = ["id", "document", "label", "title", "kind", "theme", "theme_detail",
                  "orientation", "content", "blocks_count", "created_at"]
        read_only_fields = ["created_at"]

    def get_blocks_count(self, obj):
        return len((obj.content or {}).get("blocks", []))


class QuestionBankItemSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    source_title = serializers.CharField(source="source_document.title", read_only=True, default=None)

    class Meta:
        model = QuestionBankItem
        fields = ["id", "course", "course_title", "prompt", "qtype", "difficulty", "points",
                  "options", "answer", "explanation", "lines", "tags", "source_document",
                  "source_title", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def validate_options(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("الخيارات يجب أن تكون قائمة نصوص.")
        return [str(x).strip() for x in value if str(x).strip()][:12]

    def validate_tags(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("الوسوم يجب أن تكون قائمة نصوص.")
        cleaned = []
        for tag in value:
            text = str(tag).strip()[:40]
            if text and text not in cleaned:
                cleaned.append(text)
            if len(cleaned) >= 12:
                break
        return cleaned

    def validate_points(self, value):
        return min(max(float(value or 0), 0), 100)

    def validate_lines(self, value):
        return min(max(int(value or 0), 0), 12)


class SupportGroupSerializer(serializers.ModelSerializer):
    band_label = serializers.ReadOnlyField()
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    source_assessment_title = serializers.CharField(source="source_assessment.title", read_only=True, default=None)
    member_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    members_detail = serializers.SerializerMethodField()

    class Meta:
        model = SupportGroup
        fields = ["id", "school_class", "class_name", "term", "band", "band_label", "title", "focus",
                  "member_ids", "members_detail", "planned_date", "planned_time", "status",
                  "worksheet_document", "source_assessment", "source_assessment_title", "created_at", "updated_at"]

    def get_members_detail(self, obj):
        return [{"id": st.id, "name": st.full_name} for st in obj.members.all()]

    def create(self, validated_data):
        member_ids = validated_data.pop("member_ids", [])
        group = super().create(validated_data)
        if member_ids:
            group.members.set(Student.objects.filter(id__in=member_ids, school_class=group.school_class))
        return group

    def update(self, instance, validated_data):
        member_ids = validated_data.pop("member_ids", None)
        group = super().update(instance, validated_data)
        if member_ids is not None:
            group.members.set(Student.objects.filter(id__in=member_ids, school_class=group.school_class))
        return group


class ParentAppointmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    status_label = serializers.ReadOnlyField()

    class Meta:
        model = ParentAppointment
        fields = ["id", "day", "student", "student_name", "start_time", "end_time", "status",
                  "status_label", "topics", "outcome", "communication"]


class ParentMeetingDaySerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    appointments = ParentAppointmentSerializer(many=True, read_only=True)
    stats = serializers.SerializerMethodField()

    class Meta:
        model = ParentMeetingDay
        fields = ["id", "school_class", "class_name", "date", "start_time", "slot_minutes",
                  "location", "title", "notes", "appointments", "stats", "created_at", "updated_at"]

    def get_stats(self, obj):
        return obj.stats


class MeetingSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True, default=None)
    type_label = serializers.ReadOnlyField()
    decisions_total = serializers.IntegerField(read_only=True)
    decisions_done = serializers.IntegerField(read_only=True)

    class Meta:
        model = Meeting
        fields = ["id", "school_class", "class_name", "date", "title", "meeting_type", "type_label",
                  "term", "agenda", "attendees", "decisions", "decisions_total", "decisions_done",
                  "notes", "minutes_document", "created_at", "updated_at"]
        read_only_fields = ["minutes_document", "created_at", "updated_at"]


class AssessmentResultSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    class_id = serializers.IntegerField(source="student.school_class_id", read_only=True)
    status_label = serializers.ReadOnlyField()
    score_percent = serializers.ReadOnlyField()

    class Meta:
        model = AssessmentResult
        fields = ["id", "assessment", "student", "student_name", "class_id", "status",
                  "status_label", "score", "score_percent", "comment", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class AssessmentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True, default=None)
    kind_label = serializers.ReadOnlyField()
    status_label = serializers.ReadOnlyField()
    grade_component = serializers.ReadOnlyField()
    grade_component_label = serializers.ReadOnlyField()
    stats = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    days_left = serializers.ReadOnlyField()
    paper_document_title = serializers.CharField(source="paper_document.title", read_only=True, default=None)
    analysis_document_title = serializers.CharField(source="analysis_document.title", read_only=True, default=None)
    support_group_id = serializers.SerializerMethodField()

    def get_support_group_id(self, obj):
        groups = obj.support_groups.all() if hasattr(obj, "support_groups") else []
        active = [g for g in groups if g.status == "active"]
        return active[0].id if active else None

    class Meta:
        model = Assessment
        fields = ["id", "school_class", "class_name", "course", "course_title", "term",
                  "assessment_kind", "kind_label", "title", "date", "duration_minutes",
                  "max_score", "status", "status_label", "grade_component", "grade_component_label",
                  "instructions", "notes", "paper_document", "paper_document_title",
                  "analysis_document", "analysis_document_title", "stats", "is_overdue",
                  "days_left", "gradebook_synced_at", "support_group_id", "created_at", "updated_at"]
        read_only_fields = ["paper_document", "analysis_document", "gradebook_synced_at", "created_at", "updated_at"]

    def validate_term(self, value):
        if value not in (1, 2, 3):
            raise serializers.ValidationError("الثلاثي يجب أن يكون 1 أو 2 أو 3.")
        return value

    def validate_max_score(self, value):
        if value is None or value <= 0 or value > 100:
            raise serializers.ValidationError("النقطة القصوى يجب أن تكون بين 1 و100.")
        return value

    def validate_duration_minutes(self, value):
        if value < 1 or value > 600:
            raise serializers.ValidationError("المدة يجب أن تكون بين 1 و600 دقيقة.")
        return value
