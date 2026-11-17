from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (Theme, Journal, LessonPlan, NoteBook, NoteEntry,
                     SchoolClass, TimetableSlot, Course, Session, WEEKDAY_NAMES,
                     TeacherProfile, Student, Mark, Holiday, Seminar,
                     Institution, Visit, Observation, CustomDocument, DocumentRevision, QuestionBankItem, AttendanceRecord, StudentFollowUpRecord, SupportPlan, ParentCommunication, Assignment, AssignmentSubmission, TeacherTask, Meeting, ParentMeetingDay, ParentAppointment, SupportGroup, Assessment, AssessmentResult)
from .serializers import (ThemeSerializer, JournalSerializer, LessonPlanSerializer,
                          NoteBookSerializer, NoteEntrySerializer, UserSerializer,
                          SchoolClassSerializer, TimetableSlotSerializer,
                          CourseSerializer, SessionSerializer, class_progress,
                          TeacherProfileSerializer, StudentSerializer, MarkSerializer,
                          HolidaySerializer, SeminarSerializer, InstitutionSerializer,
                          VisitSerializer, ObservationSerializer, CustomDocumentSerializer, DocumentRevisionSerializer, QuestionBankItemSerializer, AttendanceRecordSerializer, StudentFollowUpRecordSerializer, SupportPlanSerializer, ParentCommunicationSerializer, AssignmentSerializer, AssignmentSubmissionSerializer, TeacherTaskSerializer, MeetingSerializer, ParentMeetingDaySerializer, ParentAppointmentSerializer, SupportGroupSerializer, AssessmentSerializer, AssessmentResultSerializer)
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from urllib.parse import quote
from . import pdf as pdfdocs
from . import documents as docs_builder
from . import document_exchange as doc_exchange
from . import docx_export
from .theme_gen import CURATED, generate_theme_dicts
import csv
import datetime
import io
import json
import os

RESOURCE_MAP = {
    "journal": ("journals", Journal),
    "lesson-plan": ("lesson_plans", LessonPlan),
    "notebook": ("notebooks", NoteBook),
    "course": ("courses", Course),
}


def local_user():
    """The single local teacher who owns everything (no sign-in mode)."""
    user, _ = User.objects.get_or_create(
        username="teacher",
        defaults={"first_name": "سمير", "last_name": "حداد", "email": "teacher@example.dz"})
    return user


# ------------------------------------------------------------------ auth
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    u, p = request.data.get("username", "").strip(), request.data.get("password", "")
    if not u or len(p) < 6:
        return Response({"detail": "اسم المستخدم وكلمة مرور (6 أحرف على الأقل) مطلوبان."},
                        status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username=u).exists():
        return Response({"detail": "اسم المستخدم مستعمل مسبقًا."}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(
        username=u, password=p,
        first_name=request.data.get("first_name", ""), last_name=request.data.get("last_name", ""),
        email=request.data.get("email", ""))
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    user = authenticate(username=request.data.get("username", ""),
                        password=request.data.get("password", ""))
    if not user:
        return Response({"detail": "بيانات الدخول غير صحيحة."}, status=status.HTTP_400_BAD_REQUEST)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data})


@api_view(["POST"])
@permission_classes([AllowAny])
def demo_login(request):
    """One-click demo session (local use): returns a token for the demo teacher."""
    user, created = User.objects.get_or_create(
        username="teacher",
        defaults={"first_name": "سمير", "last_name": "حداد", "email": "teacher@example.dz"})
    if created:
        user.set_password("demo1234")
        user.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": UserSerializer(user).data})


@api_view(["POST"])
def logout(request):
    request.user.auth_token.delete()
    return Response({"detail": "تم تسجيل الخروج."})


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    return Response(UserSerializer(local_user()).data)


# ------------------------------------------------------------------ themes
class ThemeViewSet(viewsets.ModelViewSet):
    queryset = Theme.objects.all()
    serializer_class = ThemeSerializer

    def create(self, request, *args, **kwargs):
        data = dict(request.data)
        data.pop("source", None); data.pop("slug", None)
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        base = slugify(serializer.validated_data.get("name_en") or "") or slugify(serializer.validated_data.get("name_ar") or "") or "custom"
        slug, counter = f"custom-{base}", 1
        while Theme.objects.filter(slug=slug).exists():
            counter += 1
            slug = f"custom-{base}-{counter}"
        theme = serializer.save(source="custom", slug=slug)
        return Response(ThemeSerializer(theme).data, status=201)

    def update(self, request, *args, **kwargs):
        if self.get_object().source != "custom":
            return Response({"detail": "يمكن تعديل السمات المخصصة فقط؛ انسخ السمة أولًا لتعديلها."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if self.get_object().source != "custom":
            return Response({"detail": "يمكن حذف السمات المخصصة فقط."}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        theme = self.get_object()
        base = slugify(theme.name_en or "") or slugify(theme.name_ar or "") or "theme"
        slug, counter = f"custom-{base}", 1
        while Theme.objects.filter(slug=slug).exists():
            counter += 1
            slug = f"custom-{base}-{counter}"
        copy = Theme.objects.create(
            slug=slug, name_ar=f"{theme.name_ar} — نسخة", name_en=theme.name_en,
            tagline=theme.tagline, deep=theme.deep, deeper=theme.deeper, ink=theme.ink,
            accent=theme.accent, accent2=theme.accent2, soft=theme.soft, soft2=theme.soft2,
            line=theme.line, paper=theme.paper, heading_font=theme.heading_font,
            body_font=theme.body_font, style_type=theme.style_type,
            pattern=theme.pattern, cover_style=theme.cover_style, source="custom")
        return Response(ThemeSerializer(copy).data, status=201)

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        style = self.request.query_params.get("style")
        source = self.request.query_params.get("source")
        if q:
            qs = qs.filter(name_ar__icontains=q) | qs.filter(name_en__icontains=q)
        if style:
            qs = qs.filter(style_type=style)
        if source:
            qs = qs.filter(source=source)
        return qs

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        """Apply this theme to a journal / lesson plan / note book."""
        theme = self.get_object()
        rtype = request.data.get("resource_type")
        rid = request.data.get("resource_id")
        if rtype not in RESOURCE_MAP:
            return Response({"detail": "resource_type غير صالح."}, status=400)
        _, model = RESOURCE_MAP[rtype]
        try:
            obj = model.objects.get(pk=rid, owner=local_user())
        except model.DoesNotExist:
            return Response({"detail": "العنصر غير موجود."}, status=404)
        obj.theme = theme
        obj.save(update_fields=["theme", "updated_at"])
        return Response({"detail": f"طُبّقت سمة «{theme.name_ar}» بنجاح.", "theme": ThemeSerializer(theme).data})

    @action(detail=False, methods=["post"])
    def generate(self, request):
        """Generate more themes automatically (same engine as the CLI script)."""
        try:
            count = min(max(int(request.data.get("count", 12)), 1), 60)
        except (TypeError, ValueError):
            count = 12
        offset = Theme.objects.filter(source="generated").count()
        created = []
        for data in generate_theme_dicts(count, offset=offset):
            obj, was = Theme.objects.get_or_create(slug=data["slug"], defaults=data)
            if was:
                created.append(obj)
        return Response({"created": len(created),
                         "themes": ThemeSerializer(created, many=True).data})


# ------------------------------------------------------------------ resources
class OwnedViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return self.queryset.filter(owner=local_user())

    def perform_create(self, serializer):
        serializer.save(owner=local_user())


class JournalViewSet(OwnedViewSet):
    queryset = Journal.objects.select_related("theme")
    serializer_class = JournalSerializer


class LessonPlanViewSet(OwnedViewSet):
    queryset = LessonPlan.objects.select_related("theme")
    serializer_class = LessonPlanSerializer


class NoteBookViewSet(OwnedViewSet):
    queryset = NoteBook.objects.select_related("theme").prefetch_related("entries")
    serializer_class = NoteBookSerializer

    @action(detail=True, methods=["get", "post"])
    def entries(self, request, pk=None):
        book = self.get_object()
        if request.method == "GET":
            return Response(NoteEntrySerializer(book.entries.all(), many=True).data)
        ser = NoteEntrySerializer(data={**request.data, "notebook": book.id})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=201)


class NoteEntryViewSet(viewsets.ModelViewSet):
    serializer_class = NoteEntrySerializer

    def get_queryset(self):
        return NoteEntry.objects.filter(notebook__owner=local_user())


# ------------------------------------------------------------------ studio
class SchoolClassViewSet(OwnedViewSet):
    queryset = SchoolClass.objects.prefetch_related("slots")
    serializer_class = SchoolClassSerializer


class TimetableSlotViewSet(viewsets.ModelViewSet):
    serializer_class = TimetableSlotSerializer

    def get_queryset(self):
        return TimetableSlot.objects.filter(school_class__owner=local_user())


class CourseViewSet(OwnedViewSet):
    queryset = Course.objects.select_related("theme").prefetch_related("plans")
    serializer_class = CourseSerializer


class SessionViewSet(OwnedViewSet):
    queryset = Session.objects.select_related("school_class", "course", "lesson_plan", "journal")
    serializer_class = SessionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        for param, field in (("class", "school_class_id"), ("course", "course_id"),
                             ("from", "date__gte"), ("to", "date__lte")):
            val = self.request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})
        return qs

    def perform_create(self, serializer):
        """Dynamic alignment: attach the lesson plan of this course and the
        current journal automatically, then save the taught session."""
        obj = serializer.save(owner=local_user())
        changed = []
        if obj.course and not obj.lesson_plan:
            plan = LessonPlan.objects.filter(owner=local_user(), course=obj.course).first()
            if plan:
                obj.lesson_plan = plan
                changed.append("lesson_plan")
        if not obj.journal:
            journal = Journal.objects.filter(owner=local_user()).order_by("-updated_at").first()
            if journal:
                obj.journal = journal
                changed.append("journal")
        if changed:
            obj.save(update_fields=changed)


class StudioTodayView(APIView):
    """Today's teaching: scheduled slots, logged sessions, and what's next."""

    def get(self, request):
        u = local_user()
        today = datetime.date.today()
        widx = (today.weekday() + 1) % 7
        slots = (TimetableSlot.objects.filter(school_class__owner=u, weekday=widx)
                 .select_related("school_class").order_by("start_time"))
        sessions_today = Session.objects.filter(owner=u, date=today)
        logged_class_ids = set(sessions_today.values_list("school_class_id", flat=True))
        courses = list(Course.objects.filter(owner=u))
        schedule = []
        for slot in slots:
            progress = class_progress(slot.school_class, courses)
            schedule.append({
                "slot": TimetableSlotSerializer(slot).data,
                "class_name": slot.school_class.name,
                "logged": slot.school_class_id in logged_class_ids,
                "next_course": progress["next_course"],
                "progress": progress,
            })
        suggestions = []
        for cls in SchoolClass.objects.filter(owner=u):
            p = class_progress(cls, courses)
            if p["next_course"]:
                nxt = next(c for c in courses if c.id == p["next_course"]["id"])
                plan = nxt.plans.first()
                suggestions.append({
                    "class_id": cls.id, "class_name": cls.name,
                    "next_course": p["next_course"],
                    "key_points": nxt.key_points,
                    "has_plan": bool(plan),
                    "plan_id": plan.id if plan else None,
                    "percent": p["percent"],
                })
        return Response({
            "date": str(today),
            "weekday_name": WEEKDAY_NAMES[widx],
            "schedule": schedule,
            "sessions_today": SessionSerializer(sessions_today, many=True).data,
            "suggestions": suggestions,
        })


class StudioAlignmentView(APIView):
    """Curriculum × classes alignment matrix + teaching insights."""

    def get(self, request):
        u = local_user()
        courses = list(Course.objects.filter(owner=u))
        classes = list(SchoolClass.objects.filter(owner=u))
        done_pairs = set(
            Session.objects.filter(owner=u, status="done", course__isnull=False)
            .values_list("school_class_id", "course_id"))
        plan_by_course = {p.course_id: p.id for p in
                          LessonPlan.objects.filter(owner=u, course__isnull=False)}
        matrix, insights = [], []
        progresses = {}
        for cls in classes:
            p = class_progress(cls, courses)
            progresses[cls.id] = p
            matrix.append({
                "class": {"id": cls.id, "name": cls.name},
                "progress": p,
                "cells": [{"course_id": c.id,
                           "state": "done" if (cls.id, c.id) in done_pairs else "pending",
                           "has_plan": c.id in plan_by_course}
                          for c in courses],
            })
        if progresses:
            ahead = max(progresses.values(), key=lambda p: p["done_count"])
            behind = min(progresses.values(), key=lambda p: p["done_count"])
            if ahead["done_count"] - behind["done_count"] >= 2:
                name_of = {c.id: c.name for c in classes}
                insights.append({
                    "type": "gap",
                    "text": f"فارق التقدّم بين الأفواج وصل إلى {ahead['done_count'] - behind['done_count']} دروس — "
                            f"الأكثر تقدّمًا عند {ahead['done_count']} دروس والمتأخر عند {behind['done_count']}.",
                })
        unplanned = [c.title for c in courses if c.id not in plan_by_course]
        if unplanned:
            insights.append({
                "type": "plans",
                "text": f"{len(unplanned)} دروس من المقرر بلا خطة درس مرتبطة بعد: " + "، ".join(unplanned[:4]) + ("…" if len(unplanned) > 4 else ""),
            })
        week_ago = datetime.date.today() - datetime.timedelta(days=7)
        recent = Session.objects.filter(owner=u, date__gte=week_ago, status="done").count()
        insights.append({"type": "pace", "text": f"أنجزت {recent} حصص منفَّذة خلال آخر 7 أيام."})
        return Response({
            "courses": [{"id": c.id, "title": c.title, "order": c.order,
                         "domain": c.domain, "has_plan": c.id in plan_by_course} for c in courses],
            "matrix": matrix,
            "insights": insights,
        })


# ------------------------------------------------------------------ people, marks, calendar, inspection
class TeacherProfileView(APIView):
    def get(self, request):
        prof, _ = TeacherProfile.objects.get_or_create(user=local_user())
        return Response(TeacherProfileSerializer(prof).data)

    def put(self, request):
        prof, _ = TeacherProfile.objects.get_or_create(user=local_user())
        ser = TeacherProfileSerializer(prof, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer

    def get_queryset(self):
        qs = Student.objects.prefetch_related("marks").filter(school_class__owner=local_user())
        cls = self.request.query_params.get("class")
        if cls:
            qs = qs.filter(school_class_id=cls)
        return qs

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["get"])
    def dossier(self, request, pk=None):
        student = self.get_object()
        date_from = _parse_iso_date(request.query_params.get("from"))
        date_to = _parse_iso_date(request.query_params.get("to"))
        return Response(_build_student_dossier(student, date_from, date_to))

    @action(detail=True, methods=["post"], url_path="generate-document")
    def generate_document(self, request, pk=None):
        student = self.get_object()
        dossier = _build_student_dossier(student)
        doc_type = request.data.get("type") or "report"
        profile = _profile()
        teacher = profile.full_name if profile and profile.full_name else ""
        school = profile.current_school if profile and profile.current_school else ""
        cls = student.school_class
        summary = dossier["summary"]
        risk = dossier["risk"]
        if doc_type == "parent":
            concerns = risk["reasons"] or ["لا توجد مؤشرات مقلقة بارزة في الفترة الحالية، والمتابعة مستمرة لضمان مزيد من التقدم."]
            strengths = dossier["recommendations"]["strengths"] or ["المواظبة والمتابعة المستمرة من التلميذ والولي."]
            actions = dossier["recommendations"]["next_actions"]
            blocks = [
                docs_builder.fields([("المؤسسة", school), ("التاريخ", str(datetime.date.today())), ("إلى السيد(ة)", "ولي التلميذ(ة)"),
                                     ("التلميذ(ة)", student.full_name), ("القسم", cls.name), ("الموضوع", "ملخص متابعة التلميذ وخطة دعمه")], "إشعار وملخص متابعة لولي التلميذ"),
                docs_builder.text(f"تحية طيبة وبعد،\nيسرّنا أن نشارككم ملخص متابعة ابنكم(تكم) {student.full_name} بقسم {cls.name}. "
                                  f"المعدل السنوي الحالي: {summary['marks']['annual_average'] if summary['marks']['annual_average'] is not None else 'غير متوفر بعد'}، "
                                  f"ونسبة الحضور: {summary['attendance']['attendance_rate'] if summary['attendance']['attendance_rate'] is not None else 'غير متوفرة بعد'}٪، "
                                  f"ونسبة تسليم المهام: {summary['assignments']['completion_rate']}٪."),
                docs_builder.heading("نقاط القوة"), docs_builder.checklist(strengths),
                docs_builder.heading("نقاط تحتاج متابعة مشتركة"), docs_builder.checklist(concerns),
                docs_builder.heading("ما نطلبه من الولي"), docs_builder.checklist(actions),
                docs_builder.fields([("درجة المخاطرة الحالية", f"{risk['risk_score']}/100"), ("الأستاذ(ة)", teacher), ("تاريخ الملخص", str(datetime.date.today()))], "معلومات المتابعة"),
                docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة", "ولي التلميذ (اطّلع ووقّع)"]),
            ]
            doc = CustomDocument.objects.create(
                owner=local_user(), title=f"ملخص ولي — {student.full_name} — {cls.name}", kind="parent-letter",
                orientation="portrait", content={"blocks": blocks}, tags=["ملف التلميذ", "تواصل الأولياء", cls.name],
                source_type="student-dossier", source_id=student.id)
            communication = None
            if request.data.get("log", True) not in (False, "false", "0"):
                communication = ParentCommunication.objects.create(
                    student=student, date=datetime.date.today(), channel="letter",
                    subject="ملخص متابعة التلميذ وخطة دعمه",
                    summary="؛ ".join(concerns), outcome="أُنشئ ملخص ولي قابل للتحرير والطباعة من ملف التلميذ.")
            return Response({"document": CustomDocumentSerializer(doc).data,
                             "communication": ParentCommunicationSerializer(communication).data if communication else None}, status=201)

        mark_rows = [[row["term_label"], str(row["continuous"] if row["continuous"] is not None else "—"),
                      str(row["supervised"] if row["supervised"] is not None else "—"),
                      str(row["exam"] if row["exam"] is not None else "—"),
                      str(row["average"] if row["average"] is not None else "—")] for row in dossier["marks"]]
        assignment_rows = [[row["title"], str(row["due_date"] or "—"), row["submission_status_label"],
                            f"{row['score']} / {row['max_score']}" if row["score"] is not None else "—",
                            (row["feedback"] or "—")[:80]] for row in dossier["assignments"][:15]]
        assessment_doc_rows = [[row["title"], row["kind_label"], row["term_label"],
                                f"{row['score']} / {row['max_score']}" if row["score"] is not None else row["status_label"],
                                f"{row['percent']}٪ ({row['appreciation']})" if row["percent"] is not None else "—"]
                               for row in dossier["assessment_results"][:15]]
        support_rows = [[row["title"], row["status_label"], row["priority_label"], f"{row['progress_percent']}٪",
                         str(row["due_date"] or "—")] for row in dossier["support_plans"]]
        timeline_rows = [[row["date"] or "—", row["type_label"], row["title"], row["detail"][:100]] for row in dossier["timeline"][:18]]
        blocks = [
            docs_builder.fields([("التلميذ(ة)", student.full_name), ("القسم", cls.name), ("المستوى", cls.level),
                                 ("المعدل السنوي", str(summary["marks"]["annual_average"] if summary["marks"]["annual_average"] is not None else "—")),
                                 ("نسبة الحضور", f"{summary['attendance']['attendance_rate']}٪" if summary["attendance"]["attendance_rate"] is not None else "—"),
                                 ("نسبة تسليم المهام", f"{summary['assignments']['completion_rate']}٪"),
                                 ("درجة المخاطرة", f"{risk['risk_score']}/100"), ("الأستاذ(ة)", teacher), ("المؤسسة", school)], f"ملف متابعة فردي — {student.full_name}"),
            docs_builder.table(["الثلاثي", "التقويم المستمر", "الفروض المحروسة", "الاختبار", "المعدل"], mark_rows, "النقاط والمعدلات"),
            docs_builder.fields([("أيام الحضور المسجلة", str(summary["attendance"]["recorded"])), ("الغيابات", str(summary["attendance"]["counts"].get("absent", 0))),
                                 ("التأخرات", str(summary["attendance"]["counts"].get("late", 0))), ("مهام مسلّمة", f"{summary['assignments']['submitted']}/{summary['assignments']['expected']}"),
                                 ("مهام مفقودة", str(summary["assignments"]["missing"])), ("خطط دعم مفتوحة", str(summary["support"]["open"])),
                                 ("سجلات تواصل الأولياء", str(summary["communications"]["total"]))], "ملخص المؤشرات"),
            docs_builder.table(["المهمة", "الأجل", "حالة التسليم", "النقطة", "ملاحظة"], assignment_rows, "المهام والواجبات"),
        ]
        if assessment_doc_rows:
            blocks.append(docs_builder.table(["التقويم", "النوع", "الثلاثي", "النتيجة", "النسبة (التقدير)"], assessment_doc_rows, "نتائج التقويمات والفروض"))
        if support_rows:
            blocks.append(docs_builder.table(["خطة الدعم", "الحالة", "الأولوية", "التقدم", "الأجل"], support_rows, "خطط الدعم والتدخل"))
        if risk["reasons"]:
            blocks.append(docs_builder.checklist(risk["reasons"], "مؤشرات تحتاج متابعة"))
        blocks.append(docs_builder.checklist(dossier["recommendations"]["next_actions"], "الإجراءات المقترحة"))
        if timeline_rows:
            blocks.append(docs_builder.table(["التاريخ", "النوع", "الحدث", "التفاصيل"], timeline_rows, "أحدث أحداث ملف التلميذ"))
        blocks.append(docs_builder.signatures(["الأستاذ(ة)", "ولي التلميذ", "ملاحظات إضافية"]))
        doc = CustomDocument.objects.create(
            owner=local_user(), title=f"ملف تلميذ فردي — {student.full_name} — {cls.name}", kind="report-card",
            orientation="portrait", content={"blocks": blocks}, tags=["ملف التلميذ", "تقرير فردي", cls.name],
            source_type="student-dossier", source_id=student.id)
        return Response({"document": CustomDocumentSerializer(doc).data, "communication": None}, status=201)

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """Paste a list of names → roster created in one go."""
        cls_id = request.data.get("school_class")
        names = [n.strip() for n in (request.data.get("names") or []) if str(n).strip()]
        try:
            cls = SchoolClass.objects.get(pk=cls_id, owner=local_user())
        except SchoolClass.DoesNotExist:
            return Response({"detail": "الفوج غير موجود."}, status=404)
        created = [Student.objects.create(school_class=cls, full_name=n) for n in names]
        return Response({"created": len(created),
                         "students": StudentSerializer(created, many=True).data}, status=201)


class MarkViewSet(viewsets.ModelViewSet):
    serializer_class = MarkSerializer

    def get_queryset(self):
        return Mark.objects.filter(student__school_class__owner=local_user())

    @action(detail=False, methods=["post"])
    def upsert(self, request):
        student_id, term = request.data.get("student"), int(request.data.get("term", 1))
        try:
            student = Student.objects.get(pk=student_id, school_class__owner=local_user())
        except Student.DoesNotExist:
            return Response({"detail": "التلميذ غير موجود."}, status=404)

        def num(k):
            v = request.data.get(k)
            return None if v in (None, "") else float(v)

        mark, _ = Mark.objects.update_or_create(
            student=student, term=term,
            defaults={"continuous": num("continuous"), "supervised": num("supervised"), "exam": num("exam")})
        return Response(MarkSerializer(mark).data)



# ------------------------------------------------------------------ attendance & student follow-up
def _owned_school_class(pk):
    try:
        return SchoolClass.objects.get(pk=pk, owner=local_user())
    except (SchoolClass.DoesNotExist, TypeError, ValueError):
        return None


def _parse_iso_date(value, fallback=None):
    if not value:
        return fallback
    try:
        return datetime.date.fromisoformat(str(value))
    except ValueError:
        return None


class AttendanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    queryset = AttendanceRecord.objects.select_related("student", "student__school_class", "session")

    def get_queryset(self):
        qs = self.queryset.filter(student__school_class__owner=local_user())
        params = self.request.query_params
        if params.get("class"):
            qs = qs.filter(student__school_class_id=params["class"])
        if params.get("student"):
            qs = qs.filter(student_id=params["student"])
        if params.get("date"):
            qs = qs.filter(date=params["date"])
        if params.get("from"):
            qs = qs.filter(date__gte=params["from"])
        if params.get("to"):
            qs = qs.filter(date__lte=params["to"])
        if params.get("status"):
            qs = qs.filter(status=params["status"])
        return qs

    def _day_payload(self, cls, day, session=None):
        students = list(cls.students.order_by("full_name"))
        records = {r.student_id: r for r in AttendanceRecord.objects.filter(
            student__school_class=cls, date=day).select_related("student")}
        totals_qs = AttendanceRecord.objects.filter(student__school_class=cls)
        totals = {}
        for r in totals_qs:
            row = totals.setdefault(r.student_id, {"recorded": 0, "absent": 0, "late": 0, "excused": 0})
            row["recorded"] += 1
            if r.status in row:
                row[r.status] += 1
        counts = {key: 0 for key, _ in AttendanceRecord.STATUSES}
        for r in records.values():
            counts[r.status] = counts.get(r.status, 0) + 1
        return {
            "class": {"id": cls.id, "name": cls.name, "level": cls.level},
            "date": str(day),
            "recorded": len(records),
            "students_count": len(students),
            "counts": counts,
            "students": [{
                "id": st.id, "full_name": st.full_name,
                "attendance": AttendanceRecordSerializer(records[st.id]).data if st.id in records else None,
                "totals": totals.get(st.id, {"recorded": 0, "absent": 0, "late": 0, "excused": 0}),
            } for st in students],
        }

    @action(detail=False, methods=["get"])
    def day(self, request):
        cls = _owned_school_class(request.query_params.get("class"))
        day = _parse_iso_date(request.query_params.get("date"), datetime.date.today())
        if not cls or not day:
            return Response({"detail": "فوج أو تاريخ غير صالح."}, status=400)
        return Response(self._day_payload(cls, day))

    @action(detail=False, methods=["post"], url_path="mark-bulk")
    def mark_bulk(self, request):
        cls = _owned_school_class(request.data.get("class_id"))
        day = _parse_iso_date(request.data.get("date"))
        if not cls or not day:
            return Response({"detail": "فوج أو تاريخ غير صالح."}, status=400)
        session = None
        if request.data.get("session_id"):
            session = Session.objects.filter(pk=request.data.get("session_id"), school_class=cls, owner=local_user()).first()
            if not session:
                return Response({"detail": "الحصة غير موجودة لهذا الفوج."}, status=404)
        students = {st.id: st for st in cls.students.all()}
        saved = 0
        for raw in (request.data.get("records") or [])[:200]:
            try:
                student = students.get(int(raw.get("student_id")))
            except (TypeError, ValueError, AttributeError):
                continue
            if not student:
                continue
            status_value = raw.get("status") or "present"
            if status_value not in dict(AttendanceRecord.STATUSES):
                continue
            AttendanceRecord.objects.update_or_create(
                student=student, date=day, session=session,
                defaults={"status": status_value, "note": str(raw.get("note") or "")[:255]})
            saved += 1
        payload = self._day_payload(cls, day, session)
        payload["saved"] = saved
        return Response(payload)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        cls = _owned_school_class(request.query_params.get("class"))
        if not cls:
            return Response({"detail": "الفوج غير موجود."}, status=400)
        qs = AttendanceRecord.objects.filter(student__school_class=cls).select_related("student")
        if request.query_params.get("from"):
            qs = qs.filter(date__gte=request.query_params["from"])
        if request.query_params.get("to"):
            qs = qs.filter(date__lte=request.query_params["to"])
        dates = sorted({r.date for r in qs})
        rows = []
        totals = {key: 0 for key, _ in AttendanceRecord.STATUSES}
        for st in cls.students.order_by("full_name"):
            records = [r for r in qs if r.student_id == st.id]
            counts = {key: 0 for key, _ in AttendanceRecord.STATUSES}
            for r in records:
                counts[r.status] += 1; totals[r.status] += 1
            recorded = len(records)
            attended = counts["present"] + counts["late"] + counts["left_early"]
            rate = round(attended * 100 / recorded, 1) if recorded else None
            rows.append({
                "student_id": st.id, "student_name": st.full_name, "recorded_days": recorded,
                "counts": counts, "attendance_rate": rate,
                "needs_follow_up": bool(recorded and (counts["absent"] >= 3 or (rate is not None and rate < 80))),
            })
        return Response({"class": {"id": cls.id, "name": cls.name}, "dates": [str(d) for d in dates],
                         "recorded_days": len(dates), "totals": totals, "students": rows})

    @action(detail=False, methods=["post"], url_path="generate-register")
    def generate_register(self, request):
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls:
            return Response({"detail": "الفوج غير موجود."}, status=400)
        month = str(request.data.get("month") or "")
        date_from = _parse_iso_date(request.data.get("from")); date_to = _parse_iso_date(request.data.get("to"))
        if month and len(month) == 7:
            try:
                year, mon = [int(x) for x in month.split("-")]
                date_from = datetime.date(year, mon, 1)
                date_to = datetime.date(year + (mon == 12), (mon % 12) + 1, 1) - datetime.timedelta(days=1)
            except ValueError:
                return Response({"detail": "الشهر غير صالح."}, status=400)
        qs = AttendanceRecord.objects.filter(student__school_class=cls).select_related("student")
        if date_from: qs = qs.filter(date__gte=date_from)
        if date_to: qs = qs.filter(date__lte=date_to)
        records = list(qs)
        if not records:
            return Response({"detail": "لا سجلات حضور محفوظة في هذه الفترة."}, status=400)
        dates = sorted({r.date for r in records})
        by_student = {}
        for r in records:
            by_student.setdefault(r.student_id, {})[r.date] = r
        symbols = {"present": "✓", "absent": "غ", "late": "ت", "excused": "م", "left_early": "خ"}
        rows, risk_rows = [], []
        for i, st in enumerate(cls.students.order_by("full_name"), 1):
            student_records = by_student.get(st.id, {})
            counts = {key: 0 for key, _ in AttendanceRecord.STATUSES}
            for r in student_records.values(): counts[r.status] += 1
            attended = counts["present"] + counts["late"] + counts["left_early"]
            rate = round(attended * 100 / len(student_records), 1) if student_records else 0
            rows.append([str(i), st.full_name] + [symbols.get(student_records[d].status, "") if d in student_records else "" for d in dates] + [str(counts["present"]), str(counts["absent"]), f"{rate}٪"])
            if counts["absent"] >= 3 or (student_records and rate < 80):
                risk_rows.append([st.full_name, str(counts["absent"]), str(counts["late"]), f"{rate}٪"])
        period = f"{date_from or dates[0]} — {date_to or dates[-1]}"
        blocks = [
            docs_builder.fields([("الفوج", cls.name), ("المستوى", cls.level), ("الفترة", period), ("عدد أيام التسجيل", str(len(dates)))], f"سجل الحضور والغياب — {cls.name}"),
            docs_builder.table(["#", "اسم التلميذ"] + [d.strftime("%d/%m") for d in dates] + ["حاضر", "غائب", "نسبة الحضور"], rows, "الحضور الفعلي المسجل"),
            docs_builder.text("الرموز: ✓ حاضر • غ غائب • ت متأخر • م غياب مبرر • خ غادر مبكرًا."),
        ]
        if risk_rows:
            blocks.append(docs_builder.table(["التلميذ", "الغيابات", "التأخرات", "نسبة الحضور"], risk_rows, "تلاميذ يحتاجون متابعة الحضور"))
        doc = CustomDocument.objects.create(
            owner=local_user(), title=f"سجل حضور فعلي — {cls.name} ({period})", kind="attendance-sheet",
            orientation="landscape", content={"blocks": blocks}, tags=["حضور فعلي", cls.name], source_type="attendance", source_id=cls.id)
        return Response(CustomDocumentSerializer(doc).data, status=201)


class StudentFollowUpRecordViewSet(viewsets.ModelViewSet):
    serializer_class = StudentFollowUpRecordSerializer
    queryset = StudentFollowUpRecord.objects.select_related("student", "student__school_class", "course", "session")

    def get_queryset(self):
        qs = self.queryset.filter(student__school_class__owner=local_user())
        params = self.request.query_params
        if params.get("class"): qs = qs.filter(student__school_class_id=params["class"])
        if params.get("student"): qs = qs.filter(student_id=params["student"])
        if params.get("date"): qs = qs.filter(date=params["date"])
        if params.get("from"): qs = qs.filter(date__gte=params["from"])
        if params.get("to"): qs = qs.filter(date__lte=params["to"])
        if params.get("category"): qs = qs.filter(category=params["category"])
        if params.get("course"): qs = qs.filter(course_id=params["course"])
        return qs

    @action(detail=False, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request):
        cls = _owned_school_class(request.data.get("class_id"))
        day = _parse_iso_date(request.data.get("date"))
        category = request.data.get("category") or "homework"
        if not cls or not day or category not in dict(StudentFollowUpRecord.CATEGORIES):
            return Response({"detail": "فوج أو تاريخ أو صنف متابعة غير صالح."}, status=400)
        course = None
        if request.data.get("course_id"):
            course = Course.objects.filter(pk=request.data.get("course_id"), owner=local_user()).first()
        students = {st.id: st for st in cls.students.all()}
        saved = 0
        for raw in (request.data.get("records") or [])[:200]:
            try: student = students.get(int(raw.get("student_id")))
            except (TypeError, ValueError, AttributeError): continue
            if not student: continue
            score = raw.get("score")
            try: score = None if score in (None, "") else min(max(int(score), 0), 5)
            except (TypeError, ValueError): score = None
            existing = StudentFollowUpRecord.objects.filter(
                student=student, date=day, category=category, course=course).order_by("id").first()
            values = {"score": score, "status": str(raw.get("status") or "")[:80], "note": str(raw.get("note") or "")}
            if existing:
                for key, value in values.items(): setattr(existing, key, value)
                existing.save(update_fields=list(values.keys()) + ["updated_at"])
            else:
                StudentFollowUpRecord.objects.create(student=student, date=day, category=category, course=course, **values)
            saved += 1
        rows = StudentFollowUpRecord.objects.filter(student__school_class=cls, date=day, category=category, course=course).select_related("student", "course")
        return Response({"saved": saved, "records": StudentFollowUpRecordSerializer(rows, many=True).data})

    @action(detail=False, methods=["get"])
    def summary(self, request):
        cls = _owned_school_class(request.query_params.get("class"))
        if not cls:
            return Response({"detail": "الفوج غير موجود."}, status=400)
        qs = self.get_queryset().filter(student__school_class=cls)
        rows = []
        for st in cls.students.order_by("full_name"):
            records = [r for r in qs if r.student_id == st.id]
            by_category = {}
            for key, label in StudentFollowUpRecord.CATEGORIES:
                selected = [r for r in records if r.category == key]
                scores = [r.score for r in selected if r.score is not None]
                by_category[key] = {"label": label, "count": len(selected),
                                    "average": round(sum(scores) / len(scores), 2) if scores else None}
            low_categories = [v["label"] for v in by_category.values() if v["average"] is not None and v["average"] < 2.5]
            latest = records[0] if records else None
            rows.append({"student_id": st.id, "student_name": st.full_name, "records": len(records),
                         "by_category": by_category, "needs_support": bool(low_categories),
                         "support_reasons": low_categories,
                         "latest_note": latest.note if latest else ""})
        return Response({"class": {"id": cls.id, "name": cls.name}, "total_records": qs.count(), "students": rows})

    @action(detail=False, methods=["post"], url_path="generate-document")
    def generate_document(self, request):
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls:
            return Response({"detail": "الفوج غير موجود."}, status=400)
        qs = StudentFollowUpRecord.objects.filter(student__school_class=cls).select_related("student", "course")
        if request.data.get("from"): qs = qs.filter(date__gte=request.data["from"])
        if request.data.get("to"): qs = qs.filter(date__lte=request.data["to"])
        records = list(qs.order_by("-date", "student__full_name"))
        if not records:
            return Response({"detail": "لا سجلات متابعة محفوظة في هذه الفترة."}, status=400)
        rows = []
        for st in cls.students.order_by("full_name"):
            selected = [r for r in records if r.student_id == st.id]
            averages = []
            for key, _label in StudentFollowUpRecord.CATEGORIES[:3]:
                scores = [r.score for r in selected if r.category == key and r.score is not None]
                averages.append(str(round(sum(scores) / len(scores), 2)) if scores else "—")
            latest_note = next((r.note for r in selected if r.note), "")
            rows.append([st.full_name] + averages + [str(len(selected)), latest_note[:80]])
        detail_rows = [[str(r.date), r.student.full_name, r.category_label,
                        str(r.score) if r.score is not None else "—", r.status or "—", (r.note or "")[:90]] for r in records[:60]]
        period = f"{request.data.get('from') or records[-1].date} — {request.data.get('to') or records[0].date}"
        blocks = [
            docs_builder.fields([("الفوج", cls.name), ("المستوى", cls.level), ("الفترة", period), ("عدد السجلات", str(len(records)))], f"تقرير متابعة التلاميذ — {cls.name}"),
            docs_builder.table(["التلميذ", "الواجب /5", "السلوك /5", "المشاركة /5", "عدد السجلات", "آخر ملاحظة"], rows, "ملخص المتابعة"),
            docs_builder.table(["التاريخ", "التلميذ", "الصنف", "النقطة", "الحالة", "الملاحظة"], detail_rows, "أحدث سجلات المتابعة"),
            docs_builder.signatures(["الأستاذ(ة)", "ملاحظات إضافية"]),
        ]
        doc = CustomDocument.objects.create(
            owner=local_user(), title=f"تقرير متابعة فعلي — {cls.name}", kind="tracker-sheet",
            orientation="landscape", content={"blocks": blocks}, tags=["متابعة فعلية", cls.name], source_type="follow-up", source_id=cls.id)
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ support plans & parent communication
def _student_risk(student, date_from=None, date_to=None):
    reasons = []
    score = 0
    term_avgs = [m.average for m in student.marks.all() if m.average is not None]
    annual = round(sum(term_avgs) / len(term_avgs), 2) if term_avgs else None
    if annual is not None and annual < 10:
        score += 35; reasons.append(f"المعدل السنوي {annual} أقل من 10")
    elif annual is not None and annual < 12:
        score += 18; reasons.append(f"المعدل السنوي {annual} يحتاج تحسينًا")

    attendance = list(student.attendance_records.all())
    if date_from: attendance = [r for r in attendance if r.date >= date_from]
    if date_to: attendance = [r for r in attendance if r.date <= date_to]
    counts = {key: sum(1 for r in attendance if r.status == key) for key, _ in AttendanceRecord.STATUSES}
    attended = counts["present"] + counts["late"] + counts["left_early"]
    attendance_rate = round(attended * 100 / len(attendance), 1) if attendance else None
    if counts["absent"] >= 3:
        score += 25; reasons.append(f"{counts['absent']} غيابات مسجلة")
    elif counts["absent"] >= 1:
        score += 8; reasons.append(f"{counts['absent']} غياب مسجل")
    if attendance_rate is not None and attendance_rate < 80:
        score += 20; reasons.append(f"نسبة الحضور {attendance_rate}٪ أقل من 80٪")
    if counts["late"] >= 3:
        score += 10; reasons.append(f"{counts['late']} تأخرات مسجلة")

    follow = list(student.follow_up_records.all())
    if date_from: follow = [r for r in follow if r.date >= date_from]
    if date_to: follow = [r for r in follow if r.date <= date_to]
    follow_averages = {}
    labels = dict(StudentFollowUpRecord.CATEGORIES)
    low_count = 0
    for key, label in StudentFollowUpRecord.CATEGORIES:
        scores = [r.score for r in follow if r.category == key and r.score is not None]
        avg = round(sum(scores) / len(scores), 2) if scores else None
        follow_averages[key] = avg
        if avg is not None and avg < 2.5:
            low_count += 1; reasons.append(f"متوسط {label} {avg}/5 منخفض")
    score += min(low_count * 12, 30)

    assignment_rows = list(student.assignment_submissions.all()) if hasattr(student, "assignment_submissions") else []
    today = datetime.date.today()
    relevant_assignments = [r for r in assignment_rows
                            if r.assignment.status in ("active", "closed")
                            and (not r.assignment.due_date or r.assignment.due_date <= today)]
    missing_assignments = sum(1 for r in relevant_assignments if r.status == "not_submitted")
    late_assignments = sum(1 for r in relevant_assignments if r.status == "late")
    submitted_assignments = sum(1 for r in relevant_assignments if r.status in ("submitted", "late", "reviewed"))
    if missing_assignments >= 3:
        score += 20; reasons.append(f"{missing_assignments} مهام واجبة لم تُسلّم بعد انقضاء أجلها")
    elif missing_assignments >= 1:
        score += 8; reasons.append(f"{missing_assignments} مهمة واجبة لم تُسلّم")
    if late_assignments >= 2:
        score += 6; reasons.append(f"{late_assignments} مهام سُلّمت متأخرة")
    score = min(score, 100)
    level = "high" if score >= 50 else "medium" if score >= 25 else "low"
    return {
        "student_id": student.id, "student_name": student.full_name,
        "class_id": student.school_class_id, "class_name": student.school_class.name,
        "annual_average": annual, "attendance_rate": attendance_rate,
        "attendance_counts": counts, "follow_averages": follow_averages,
        "follow_records": len(follow),
        "assignment_counts": {"missing": missing_assignments, "late": late_assignments, "submitted": submitted_assignments},
        "risk_score": score, "risk_level": level,
        "reasons": reasons,
        "open_plans": student.support_plans.exclude(status__in=["completed", "cancelled"]).count(),
        "total_plans": student.support_plans.count(),
    }



def _build_student_dossier(student, date_from=None, date_to=None):
    """Aggregate every student-centred record into one dossier payload."""
    cls = student.school_class
    risk = _student_risk(student, date_from, date_to)

    def in_range(value):
        if value is None: return True
        if date_from and value < date_from: return False
        if date_to and value > date_to: return False
        return True

    term_labels = {1: "الثلاثي الأول", 2: "الثلاثي الثاني", 3: "الثلاثي الثالث"}
    marks_by_term = {mark.term: mark for mark in student.marks.all()}
    marks = []
    for term in (1, 2, 3):
        mark = marks_by_term.get(term)
        marks.append({"term": term, "term_label": term_labels[term],
                      "continuous": mark.continuous if mark else None,
                      "supervised": mark.supervised if mark else None,
                      "exam": mark.exam if mark else None,
                      "average": mark.average if mark else None})
    available_averages = [row["average"] for row in marks if row["average"] is not None]
    annual_average = round(sum(available_averages) / len(available_averages), 2) if available_averages else None
    mark_trend = round(available_averages[-1] - available_averages[0], 2) if len(available_averages) >= 2 else None

    attendance = [row for row in student.attendance_records.all() if in_range(row.date)]
    attendance_counts = {key: sum(1 for row in attendance if row.status == key) for key, _ in AttendanceRecord.STATUSES}
    attended = attendance_counts["present"] + attendance_counts["late"] + attendance_counts["left_early"]
    attendance_rate = round(attended * 100 / len(attendance), 1) if attendance else None

    follow_records = [row for row in student.follow_up_records.select_related("course", "session") if in_range(row.date)]
    follow_summary = {}
    for key, label in StudentFollowUpRecord.CATEGORIES:
        selected = [row for row in follow_records if row.category == key]
        scores = [row.score for row in selected if row.score is not None]
        follow_summary[key] = {"label": label, "count": len(selected),
                               "average": round(sum(scores) / len(scores), 2) if scores else None,
                               "latest_date": str(selected[0].date) if selected else None}

    assignments = list(Assignment.objects.filter(school_class=cls).exclude(status="archived")
                       .select_related("course").order_by("-due_date", "-created_at"))
    submissions = {row.assignment_id: row for row in student.assignment_submissions.select_related("assignment", "assignment__course")}
    assignment_rows = []
    for assignment in assignments:
        if (date_from or date_to) and not (in_range(assignment.due_date) or in_range(assignment.assigned_date)):
            continue
        submission = submissions.get(assignment.id)
        assignment_rows.append({
            "id": assignment.id, "title": assignment.title, "course_title": assignment.course.title if assignment.course else None,
            "assignment_type": assignment.assignment_type, "type_label": assignment.type_label,
            "assignment_status": assignment.status, "assignment_status_label": assignment.status_label,
            "assigned_date": str(assignment.assigned_date), "due_date": str(assignment.due_date) if assignment.due_date else None,
            "max_score": assignment.max_score, "is_overdue": assignment.is_overdue,
            "submission_status": submission.status if submission else "not_submitted",
            "submission_status_label": submission.status_label if submission else "لم يُسلّم بعد",
            "submitted_date": str(submission.submitted_date) if submission and submission.submitted_date else None,
            "score": submission.score if submission else None,
            "feedback": submission.feedback if submission else "", "tracked": bool(submission),
        })
    relevant_assignments = [row for row in assignment_rows if row["assignment_status"] in ("active", "closed")]
    submitted_count = sum(1 for row in relevant_assignments if row["submission_status"] in ("submitted", "late", "reviewed"))
    excused_count = sum(1 for row in relevant_assignments if row["submission_status"] == "excused")
    assignment_percents = [row["score"] / row["max_score"] * 100 for row in relevant_assignments if row["score"] is not None and row["max_score"]]
    assignment_summary = {
        "expected": len(relevant_assignments), "submitted": submitted_count,
        "missing": sum(1 for row in relevant_assignments if row["submission_status"] == "not_submitted"),
        "late": sum(1 for row in relevant_assignments if row["submission_status"] == "late"),
        "reviewed": sum(1 for row in relevant_assignments if row["submission_status"] == "reviewed"),
        "excused": excused_count,
        "completion_rate": round(submitted_count * 100 / max(len(relevant_assignments) - excused_count, 0), 1) if len(relevant_assignments) - excused_count else 0,
        "average_score_percent": round(sum(assignment_percents) / len(assignment_percents), 1) if assignment_percents else None,
    }

    assessment_results = list(student.assessment_results.select_related("assessment")
                              .order_by("-assessment__date", "-created_at"))
    if date_from or date_to:
        assessment_results = [row for row in assessment_results if in_range(row.assessment.date)]
    assessment_rows = []
    for result in assessment_results:
        item = result.assessment
        percent = result.score_percent
        assessment_rows.append({
            "result_id": result.id, "assessment_id": item.id, "title": item.title,
            "kind": item.assessment_kind, "kind_label": item.kind_label,
            "term": item.term, "term_label": term_labels[item.term],
            "date": str(item.date) if item.date else None,
            "assessment_status": item.status, "status": result.status, "status_label": result.status_label,
            "score": result.score, "max_score": item.max_score, "percent": percent,
            "score_20": round(percent / 5, 2) if percent is not None else None,
            "appreciation": ("ممتاز" if percent >= 80 else "جيد" if percent >= 65 else "مقبول" if percent >= 50 else "يحتاج دعمًا") if percent is not None else None,
            "comment": result.comment, "gradebook_synced": bool(item.gradebook_synced_at),
        })
    scored_percents = [row["percent"] for row in assessment_rows if row["percent"] is not None]
    assessment_summary = {
        "recorded": len(assessment_rows),
        "present": sum(1 for row in assessment_rows if row["status"] == "present"),
        "absent": sum(1 for row in assessment_rows if row["status"] == "absent"),
        "excused": sum(1 for row in assessment_rows if row["status"] == "excused"),
        "average_percent": round(sum(scored_percents) / len(scored_percents), 1) if scored_percents else None,
        "average_20": round((sum(scored_percents) / len(scored_percents)) / 5, 2) if scored_percents else None,
        "best_percent": max(scored_percents) if scored_percents else None,
    }

    support_plans = list(student.support_plans.prefetch_related("communications").order_by("-updated_at"))
    communications = list(student.parent_communications.select_related("support_plan").order_by("-date", "-created_at"))
    generated_documents = list(CustomDocument.objects.filter(owner=local_user(), source_type="student-dossier", source_id=student.id).order_by("-updated_at")[:12])

    timeline = []
    for row in attendance:
        timeline.append({"id": f"attendance-{row.id}", "type": "attendance", "type_label": "الحضور",
                         "date": str(row.date), "title": row.status_label,
                         "detail": row.note or f"حالة الحضور في {row.date}", "tone": "danger" if row.status == "absent" else "warning" if row.status in ("late", "left_early") else "success"})
    for row in follow_records:
        timeline.append({"id": f"follow-{row.id}", "type": "follow_up", "type_label": "متابعة",
                         "date": str(row.date), "title": row.category_label,
                         "detail": f"{row.score}/5" if row.score is not None else (row.status or row.note or "ملاحظة متابعة"), "tone": "warning" if row.score is not None and row.score < 2.5 else "info"})
    for row in assignment_rows:
        timeline.append({"id": f"assignment-{row['id']}", "type": "assignment", "type_label": "مهمة",
                         "date": row["submitted_date"] or row["due_date"] or row["assigned_date"], "title": row["title"],
                         "detail": f"{row['submission_status_label']}" + (f" — {row['score']}/{row['max_score']}" if row["score"] is not None else ""),
                         "tone": "danger" if row["submission_status"] == "not_submitted" and row["is_overdue"] else "warning" if row["submission_status"] == "late" else "success"})
    for row in assessment_rows:
        timeline.append({"id": f"assessment-{row['result_id']}", "type": "assessment", "type_label": "تقويم",
                         "date": row["date"], "title": row["title"],
                         "detail": f"{row['score']}/{row['max_score']} ({row['percent']}٪)" if row["percent"] is not None else row["status_label"],
                         "tone": "success" if row["percent"] is not None and row["percent"] >= 65 else "warning" if row["percent"] is not None and row["percent"] >= 50 else "danger" if row["percent"] is not None else "info"})
    for plan in support_plans:
        event_date = plan.start_date or plan.created_at.date()
        timeline.append({"id": f"support-{plan.id}", "type": "support", "type_label": "خطة دعم",
                         "date": str(event_date), "title": plan.title,
                         "detail": f"{plan.status_label} — تقدم {plan.progress_percent}٪", "tone": "info"})
    for row in communications:
        timeline.append({"id": f"communication-{row.id}", "type": "communication", "type_label": "تواصل ولي",
                         "date": str(row.date), "title": row.subject,
                         "detail": row.outcome or row.summary or row.channel_label, "tone": "info"})
    timeline.sort(key=lambda row: (row["date"] or "", row["id"]), reverse=True)

    strengths = []
    if annual_average is not None and annual_average >= 15: strengths.append(f"معدل سنوي قوي ({annual_average}/20)")
    if attendance_rate is not None and attendance_rate >= 95: strengths.append(f"مواظبة ممتازة على الحضور ({attendance_rate}٪)")
    for value in follow_summary.values():
        if value["average"] is not None and value["average"] >= 4: strengths.append(f"أداء جيد في {value['label']} ({value['average']}/5)")
    if assignment_summary["expected"] and assignment_summary["completion_rate"] >= 90: strengths.append(f"التزام ممتاز بتسليم المهام ({assignment_summary['completion_rate']}٪)")
    if assessment_summary["average_percent"] is not None and assessment_summary["average_percent"] >= 80: strengths.append(f"نتائج تقويمات قوية (متوسط {assessment_summary['average_percent']}٪)")
    if any(plan.status == "completed" for plan in support_plans): strengths.append("أكمل خطة دعم بنجاح")

    next_actions = []
    if assignment_summary["missing"]: next_actions.append("مراجعة المهام غير المسلّمة وتحديد آجال تسليم جديدة قصيرة وواضحة.")
    if annual_average is not None and annual_average < 10: next_actions.append("وضع خطة دعم دراسي قصيرة مع مراجعة أسبوعية وتقييم للتقدم.")
    if attendance_counts["absent"] >= 3 or (attendance_rate is not None and attendance_rate < 80): next_actions.append("التواصل مع الولي حول الحضور ومتابعة أسباب الغياب.")
    low_categories = [value["label"] for value in follow_summary.values() if value["average"] is not None and value["average"] < 2.5]
    if low_categories: next_actions.append(f"متابعة أسبوعية لجانب: {'، '.join(low_categories)} وتسجيل التحسن.")
    if (assessment_summary["average_percent"] is not None and assessment_summary["average_percent"] < 50) or assessment_summary["absent"] >= 2: next_actions.append("مراجعة نتائج التقويمات الأخيرة مع التلميذ وتحديد دروس الاستدراك ذات الأولوية.")
    if any(plan.status in ("planned", "active", "monitoring") for plan in support_plans): next_actions.append("متابعة إجراءات خطط الدعم المفتوحة وتحديث نسبة التقدم.")
    if not next_actions: next_actions.append("مواصلة المتابعة الدورية وتوثيق التقدم في الحضور والواجبات والمشاركة.")

    return {
        "student": StudentSerializer(student).data,
        "class": {"id": cls.id, "name": cls.name, "level": cls.level},
        "risk": risk,
        "summary": {
            "marks": {"annual_average": annual_average, "trend": mark_trend, "graded_terms": len(available_averages)},
            "attendance": {"recorded": len(attendance), "counts": attendance_counts, "attendance_rate": attendance_rate},
            "follow_up": {"total": len(follow_records), "by_category": follow_summary},
            "assignments": assignment_summary,
            "support": {"total": len(support_plans), "open": sum(1 for plan in support_plans if plan.status in ("planned", "active", "monitoring")),
                        "completed": sum(1 for plan in support_plans if plan.status == "completed")},
            "communications": {"total": len(communications), "latest_date": str(communications[0].date) if communications else None},
            "assessments": assessment_summary,
        },
        "marks": marks,
        "attendance_records": AttendanceRecordSerializer(attendance[:30], many=True).data,
        "follow_up_records": StudentFollowUpRecordSerializer(follow_records[:40], many=True).data,
        "assignments": assignment_rows,
        "assessment_results": assessment_rows,
        "support_plans": SupportPlanSerializer(support_plans, many=True).data,
        "communications": ParentCommunicationSerializer(communications, many=True).data,
        "generated_documents": CustomDocumentSerializer(generated_documents, many=True).data,
        "timeline": timeline[:100],
        "recommendations": {"strengths": strengths, "concerns": risk["reasons"], "next_actions": next_actions},
    }


class SupportPlanViewSet(viewsets.ModelViewSet):
    serializer_class = SupportPlanSerializer
    queryset = SupportPlan.objects.select_related("student", "student__school_class").prefetch_related("communications")

    def get_queryset(self):
        qs = self.queryset.filter(student__school_class__owner=local_user())
        params = self.request.query_params
        if params.get("class"): qs = qs.filter(student__school_class_id=params["class"])
        if params.get("student"): qs = qs.filter(student_id=params["student"])
        if params.get("status"): qs = qs.filter(status=params["status"])
        if params.get("priority"): qs = qs.filter(priority=params["priority"])
        if params.get("category"): qs = qs.filter(category=params["category"])
        if params.get("q"):
            qs = qs.filter(Q(title__icontains=params["q"]) | Q(reason__icontains=params["q"]) | Q(student__full_name__icontains=params["q"]))
        return qs

    def create(self, request, *args, **kwargs):
        if not Student.objects.filter(pk=request.data.get("student"), school_class__owner=local_user()).exists():
            return Response({"detail": "التلميذ غير موجود."}, status=404)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.data.get("student") and not Student.objects.filter(pk=request.data.get("student"), school_class__owner=local_user()).exists():
            return Response({"detail": "التلميذ غير موجود."}, status=404)
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="risk-overview")
    def risk_overview(self, request):
        cls = None
        students = Student.objects.filter(school_class__owner=local_user()).select_related("school_class").prefetch_related("marks", "attendance_records", "follow_up_records", "support_plans", "assignment_submissions__assignment")
        if request.query_params.get("class"):
            cls = _owned_school_class(request.query_params.get("class"))
            if not cls: return Response({"detail": "الفوج غير موجود."}, status=400)
            students = students.filter(school_class=cls)
        date_from = _parse_iso_date(request.query_params.get("from")); date_to = _parse_iso_date(request.query_params.get("to"))
        rows = [_student_risk(st, date_from, date_to) for st in students]
        try: min_score = int(request.query_params.get("min_score") or 1)
        except ValueError: min_score = 1
        rows = [r for r in rows if r["risk_score"] >= min_score]
        rows.sort(key=lambda x: (-x["risk_score"], x["student_name"]))
        return Response({
            "class": {"id": cls.id, "name": cls.name} if cls else None,
            "students_at_risk": len(rows),
            "high": sum(1 for r in rows if r["risk_level"] == "high"),
            "medium": sum(1 for r in rows if r["risk_level"] == "medium"),
            "students": rows,
        })

    @action(detail=True, methods=["post"], url_path="generate-document")
    def generate_document(self, request, pk=None):
        plan = self.get_object()
        doc_type = request.data.get("type") or "plan"
        student = plan.student
        profile = _profile()
        teacher = profile.full_name if profile and profile.full_name else ""
        school = profile.current_school if profile and profile.current_school else ""
        action_items = [a.get("text", "") if isinstance(a, dict) else str(a) for a in (plan.actions or [])]
        if doc_type == "letter":
            reasons_text = plan.reason or "لوحظت مؤشرات تستدعي متابعة مشتركة بين الأستاذ والولي."
            actions_text = "؛ ".join(action_items) or "متابعة الواجبات والحضور والتواصل مع الأستاذ عند الحاجة"
            blocks = [
                docs_builder.fields([("المؤسسة", school), ("التاريخ", str(datetime.date.today())), ("إلى السيد(ة)", "ولي التلميذ(ة)"), ("التلميذ(ة)", student.full_name), ("القسم", student.school_class.name), ("الموضوع", f"متابعة ودعم التلميذ — {plan.title}")], "إشعار لولي التلميذ"),
                docs_builder.text(f"تحية طيبة وبعد،\nنعلمكم أننا نتابع وضعية ابنكم(تكم) {student.full_name} بقسم {student.school_class.name}. {reasons_text}\n\nولمساعدته(ا) على التحسن، وضعنا خطة دعم تتضمن: {actions_text}. نرجو منكم مواكبة هذه الخطة في البيت، ومراقبة الحضور وإنجاز الواجبات، والتواصل معنا عند الحاجة. هدفنا المشترك هو مصلحة التلميذ وتقدمه."),
                docs_builder.fields([("أولوية الخطة", plan.priority_label), ("تاريخ البداية", str(plan.start_date or "")), ("الأجل", str(plan.due_date or "")), ("الأستاذ(ة)", teacher)], "معلومات المتابعة"),
                docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة", "ولي التلميذ (اطّلع ووقّع)"]),
            ]
            doc = CustomDocument.objects.create(
                owner=local_user(), title=f"رسالة ولي — {student.full_name} — {plan.title}", kind="parent-letter",
                orientation="portrait", content={"blocks": blocks}, tags=["تواصل الأولياء", "خطة دعم", student.school_class.name],
                source_type="support-plan", source_id=plan.id)
            communication = None
            if request.data.get("log", True) not in (False, "false", "0"):
                communication = ParentCommunication.objects.create(
                    student=student, support_plan=plan, date=datetime.date.today(), channel="letter",
                    subject=f"متابعة ودعم التلميذ — {plan.title}", summary=reasons_text,
                    outcome="أُنشئت رسالة ولي قابلة للتحرير والطباعة.", follow_up_date=plan.due_date)
            return Response({"document": CustomDocumentSerializer(doc).data,
                             "communication": ParentCommunicationSerializer(communication).data if communication else None}, status=201)

        blocks = [
            docs_builder.fields([("التلميذ(ة)", student.full_name), ("القسم", student.school_class.name), ("عنوان الخطة", plan.title),
                                 ("الصنف", plan.category_label), ("الأولوية", plan.priority_label), ("الحالة", plan.status_label),
                                 ("تاريخ البداية", str(plan.start_date or "")), ("الأجل", str(plan.due_date or "")), ("الأستاذ(ة)", teacher)], "خطة دعم ومتابعة تلميذ"),
            docs_builder.heading("سبب وضع الخطة"), docs_builder.text(plan.reason or "—"),
            docs_builder.checklist(action_items, "إجراءات الدعم"),
            docs_builder.heading("ملاحظات الأستاذ"), docs_builder.text(plan.teacher_notes or "—"),
            docs_builder.heading("النتيجة والملاحظة الختامية"), docs_builder.text(plan.outcome or "تُملأ عند تقييم الخطة."),
            docs_builder.signatures(["الأستاذ(ة)", "ولي التلميذ", "إدارة المؤسسة"]),
        ]
        doc = CustomDocument.objects.create(
            owner=local_user(), title=f"خطة دعم — {student.full_name} — {plan.title}", kind="report-card",
            orientation="portrait", content={"blocks": blocks}, tags=["خطة دعم", student.school_class.name],
            source_type="support-plan", source_id=plan.id)
        return Response({"document": CustomDocumentSerializer(doc).data, "communication": None}, status=201)


class ParentCommunicationViewSet(viewsets.ModelViewSet):
    serializer_class = ParentCommunicationSerializer
    queryset = ParentCommunication.objects.select_related("student", "student__school_class", "support_plan")

    def get_queryset(self):
        qs = self.queryset.filter(student__school_class__owner=local_user())
        params = self.request.query_params
        if params.get("class"): qs = qs.filter(student__school_class_id=params["class"])
        if params.get("student"): qs = qs.filter(student_id=params["student"])
        if params.get("channel"): qs = qs.filter(channel=params["channel"])
        if params.get("from"): qs = qs.filter(date__gte=params["from"])
        if params.get("to"): qs = qs.filter(date__lte=params["to"])
        if params.get("q"):
            qs = qs.filter(Q(subject__icontains=params["q"]) | Q(summary__icontains=params["q"]) | Q(student__full_name__icontains=params["q"]))
        return qs

    def create(self, request, *args, **kwargs):
        if not Student.objects.filter(pk=request.data.get("student"), school_class__owner=local_user()).exists():
            return Response({"detail": "التلميذ غير موجود."}, status=404)
        return super().create(request, *args, **kwargs)



# ------------------------------------------------------------------ assignments & homework tracking
def _assignment_tracking_payload(assignment):
    students = list(assignment.school_class.students.order_by("full_name"))
    submissions = {r.student_id: r for r in assignment.submissions.select_related("student", "student__school_class")}
    rows = []
    for student in students:
        submission = submissions.get(student.id)
        if submission:
            data = AssignmentSubmissionSerializer(submission).data
        else:
            data = {"id": None, "assignment": assignment.id, "assignment_title": assignment.title,
                    "student": student.id, "student_name": student.full_name,
                    "class_id": assignment.school_class_id, "class_name": assignment.school_class.name,
                    "status": "not_submitted", "status_label": "لم يُسلّم بعد", "submitted_date": None,
                    "score": None, "feedback": "", "tracked": False, "created_at": None, "updated_at": None}
        rows.append(data)
    return {"assignment": AssignmentSerializer(assignment).data, "students": rows, "stats": assignment.stats}


def _assignment_missing_students(assignment):
    submissions = {r.student_id: r for r in assignment.submissions.all()}
    return [student for student in assignment.school_class.students.order_by("full_name")
            if student.id not in submissions or submissions[student.id].status == "not_submitted"]


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    queryset = Assignment.objects.select_related("school_class", "course").prefetch_related("submissions", "school_class__students")

    def get_queryset(self):
        qs = self.queryset.filter(school_class__owner=local_user())
        params = self.request.query_params
        if params.get("class"): qs = qs.filter(school_class_id=params["class"])
        if params.get("course"): qs = qs.filter(course_id=params["course"])
        if params.get("status"): qs = qs.filter(status=params["status"])
        if params.get("assignment_type"): qs = qs.filter(assignment_type=params["assignment_type"])
        if params.get("due_from"): qs = qs.filter(due_date__gte=params["due_from"])
        if params.get("due_to"): qs = qs.filter(due_date__lte=params["due_to"])
        if params.get("q"):
            qs = qs.filter(Q(title__icontains=params["q"]) | Q(instructions__icontains=params["q"]) |
                           Q(course__title__icontains=params["q"]) | Q(school_class__name__icontains=params["q"]))
        ordering = params.get("ordering")
        if ordering in ("due_date", "-due_date", "assigned_date", "-assigned_date", "title", "-title", "-updated_at"):
            qs = qs.order_by(ordering, "-created_at")
        return qs

    def _validate_links(self, data):
        if data.get("school_class") and not _owned_school_class(data.get("school_class")):
            return Response({"detail": "الفوج غير موجود."}, status=404)
        if data.get("course") not in (None, "") and not Course.objects.filter(pk=data.get("course"), owner=local_user()).exists():
            return Response({"detail": "الدرس غير موجود."}, status=404)
        return None

    def create(self, request, *args, **kwargs):
        return self._validate_links(request.data) or super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return self._validate_links(request.data) or super().update(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def overview(self, request):
        assignments = list(self.get_queryset())
        today = datetime.date.today()
        totals = {"expected": 0, "tracked": 0, "submitted": 0, "late": 0, "reviewed": 0,
                  "excused": 0, "missing": 0, "scored": 0}
        score_percents = []
        for assignment in assignments:
            stats = assignment.stats
            for key in totals: totals[key] += stats[key]
            for submission in assignment.submissions.all():
                if submission.score is not None and assignment.max_score:
                    score_percents.append(submission.score / assignment.max_score * 100)
        denominator = max(totals["expected"] - totals["excused"], 0)
        missing_by_student = {}
        for assignment in assignments:
            if assignment.status not in ("active", "closed") or (assignment.due_date and assignment.due_date > today):
                continue
            submissions = {r.student_id: r for r in assignment.submissions.all()}
            for student in assignment.school_class.students.all():
                submission = submissions.get(student.id)
                if not submission or submission.status == "not_submitted":
                    row = missing_by_student.setdefault(student.id, {
                        "student_id": student.id, "student_name": student.full_name,
                        "class_id": assignment.school_class_id, "class_name": assignment.school_class.name,
                        "missing": 0, "late": 0, "assignments": []})
                    row["missing"] += 1; row["assignments"].append(assignment.title)
                elif submission.status == "late":
                    row = missing_by_student.setdefault(student.id, {
                        "student_id": student.id, "student_name": student.full_name,
                        "class_id": assignment.school_class_id, "class_name": assignment.school_class.name,
                        "missing": 0, "late": 0, "assignments": []})
                    row["late"] += 1; row["assignments"].append(assignment.title)
        missing_students = sorted(missing_by_student.values(), key=lambda x: (-x["missing"], -x["late"], x["student_name"]))
        by_class = []
        classes = SchoolClass.objects.filter(owner=local_user()).prefetch_related("students")
        if request.query_params.get("class"):
            classes = classes.filter(pk=request.query_params["class"])
        for cls in classes:
            selected = [a for a in assignments if a.school_class_id == cls.id]
            class_stats = [a.stats for a in selected]
            expected = sum(x["expected"] for x in class_stats); submitted = sum(x["submitted"] for x in class_stats)
            excused = sum(x["excused"] for x in class_stats)
            by_class.append({"class_id": cls.id, "class_name": cls.name, "assignments": len(selected),
                             "expected": expected, "submitted": submitted,
                             "missing": sum(x["missing"] for x in class_stats),
                             "completion_rate": round(submitted * 100 / max(expected - excused, 0), 1) if expected - excused else 0})
        upcoming = [a for a in assignments if a.status in ("draft", "active") and a.due_date and a.due_date >= today]
        upcoming.sort(key=lambda a: (a.due_date, a.title))
        overdue = [a for a in assignments if a.is_overdue]
        return Response({
            "totals": {**totals, "completion_rate": round(totals["submitted"] * 100 / denominator, 1) if denominator else 0,
                       "average_score_percent": round(sum(score_percents) / len(score_percents), 1) if score_percents else None},
            "assignments": len(assignments), "active": sum(1 for a in assignments if a.status == "active"),
            "overdue": len(overdue), "due_soon": sum(1 for a in upcoming if a.days_left is not None and a.days_left <= 7),
            "closed": sum(1 for a in assignments if a.status == "closed"),
            "by_class": by_class, "missing_students": missing_students[:20],
            "upcoming": AssignmentSerializer(upcoming[:8], many=True).data,
            "overdue_assignments": AssignmentSerializer(overdue[:8], many=True).data,
        })

    @action(detail=True, methods=["get"])
    def tracking(self, request, pk=None):
        return Response(_assignment_tracking_payload(self.get_object()))

    @action(detail=True, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request, pk=None):
        assignment = self.get_object()
        students = {student.id: student for student in assignment.school_class.students.all()}
        saved = 0
        for raw in (request.data.get("records") or [])[:300]:
            if not isinstance(raw, dict): continue
            try: student = students.get(int(raw.get("student_id")))
            except (TypeError, ValueError): continue
            if not student: continue
            status_value = raw.get("status") or "not_submitted"
            if status_value not in dict(AssignmentSubmission.STATUSES): continue
            score = raw.get("score")
            try: score = None if score in (None, "") else min(max(float(score), 0), float(assignment.max_score))
            except (TypeError, ValueError): score = None
            submitted_date = _parse_iso_date(raw.get("submitted_date"))
            if status_value in ("submitted", "late", "reviewed") and not submitted_date:
                submitted_date = datetime.date.today()
            AssignmentSubmission.objects.update_or_create(
                assignment=assignment, student=student,
                defaults={"status": status_value, "submitted_date": submitted_date,
                          "score": score, "feedback": str(raw.get("feedback") or "")})
            saved += 1
        assignment = Assignment.objects.select_related("school_class", "course").prefetch_related(
            "submissions", "school_class__students").get(pk=assignment.pk)
        payload = _assignment_tracking_payload(assignment)
        payload["saved"] = saved
        return Response(payload)

    @action(detail=True, methods=["post"], url_path="generate-document")
    def generate_document(self, request, pk=None):
        assignment = self.get_object()
        doc_type = request.data.get("type") or "worksheet"
        cls = assignment.school_class
        tracking = _assignment_tracking_payload(assignment)
        if doc_type == "report":
            rows = [[str(i + 1), row["student_name"], row["status_label"],
                     str(row["submitted_date"] or "—"),
                     f"{row['score']} / {assignment.max_score}" if row["score"] is not None else "—",
                     (row["feedback"] or "—")[:100]] for i, row in enumerate(tracking["students"])]
            stats = tracking["stats"]
            blocks = [
                docs_builder.fields([("المهمة", assignment.title), ("الفوج", cls.name), ("الدرس", assignment.course.title if assignment.course else "—"),
                                     ("تاريخ الإسناد", str(assignment.assigned_date)), ("الأجل", str(assignment.due_date or "—")),
                                     ("نسبة الإنجاز", f"{stats['completion_rate']}٪"), ("المسلّم", str(stats["submitted"])), ("غير المسلّم", str(stats["missing"]))], f"تقرير متابعة المهمة — {assignment.title}"),
                docs_builder.table(["#", "التلميذ", "الحالة", "تاريخ التسليم", "النقطة", "ملاحظات الأستاذ"], rows, "نتائج التلاميذ"),
                docs_builder.signatures(["الأستاذ(ة)", "ملاحظات إضافية"]),
            ]
            doc = CustomDocument.objects.create(owner=local_user(), title=f"تقرير مهمة — {assignment.title} — {cls.name}",
                kind="tracker-sheet", orientation="landscape", content={"blocks": blocks},
                tags=["المهام والواجبات", "تقرير تسليم", cls.name], source_type="assignment", source_id=assignment.id)
            return Response(CustomDocumentSerializer(doc).data, status=201)
        if doc_type == "missing":
            rows = []
            for row in tracking["students"]:
                if row["status"] in ("not_submitted", "late"):
                    rows.append([row["student_name"], row["status_label"], str(assignment.due_date or "—"),
                                 "اتصال/تذكير بالولي عند الحاجة", "متابعة أسبوعية حتى التسليم"])
            if not rows:
                return Response({"detail": "لا تلاميذ متأخرين أو غير مسلّمين في هذه المهمة."}, status=400)
            blocks = [
                docs_builder.fields([("المهمة", assignment.title), ("الفوج", cls.name), ("الأجل", str(assignment.due_date or "—")), ("عدد المعنيين", str(len(rows)))], "قائمة متابعة المهام غير المسلّمة"),
                docs_builder.table(["التلميذ", "الحالة", "الأجل", "الإجراء المقترح", "المتابعة"], rows, "التلاميذ المعنيون"),
                docs_builder.signatures(["الأستاذ(ة)", "ملاحظات"]),
            ]
            doc = CustomDocument.objects.create(owner=local_user(), title=f"متابعة غير المسلّمين — {assignment.title} — {cls.name}",
                kind="tracker-sheet", orientation="portrait", content={"blocks": blocks},
                tags=["المهام والواجبات", "غير المسلّمين", cls.name], source_type="assignment", source_id=assignment.id)
            return Response(CustomDocumentSerializer(doc).data, status=201)

        criteria = [line.strip() for line in (assignment.success_criteria or "").splitlines() if line.strip()]
        blocks = [
            docs_builder.fields([("الفوج", cls.name), ("الدرس", assignment.course.title if assignment.course else "—"),
                                 ("تاريخ الإسناد", str(assignment.assigned_date)), ("آخر أجل للتسليم", str(assignment.due_date or "—")),
                                 ("النقطة", f"/ {assignment.max_score:g}"), ("المدة التقديرية", f"{assignment.estimated_minutes} دقيقة"),
                                 ("اسم التلميذ", ""), ("القسم", cls.name)], assignment.title),
            docs_builder.heading("تعليمات المهمة"),
            docs_builder.text(assignment.instructions or "أنجز المهمة المطلوبة بعناية، وبيّن خطوات عملك بوضوح."),
        ]
        if criteria:
            blocks.append(docs_builder.checklist(criteria, "معايير إنجاز ناجح"))
        if assignment.course and assignment.course.key_points:
            points = list(assignment.course.key_points)[:5]
            per_question = round(float(assignment.max_score) / max(len(points), 1), 1) if points else assignment.max_score
            blocks.append(docs_builder.questions([
                {"prompt": f"طبّق أو اشرح: {point}", "qtype": "نشاط تطبيقي", "points": per_question,
                 "options": [], "answer": "", "lines": 3} for point in points
            ], "أنشطة التطبيق"))
        else:
            blocks.append(docs_builder.questions([
                {"prompt": "أنجز المهمة المطلوبة أعلاه وبيّن خطوات عملك والنتيجة التي وصلت إليها.", "qtype": "نشاط تطبيقي",
                 "points": assignment.max_score, "options": [], "answer": "", "lines": 8}], "الإنجاز"))
        blocks.append(docs_builder.signatures(["إمضاء التلميذ", "ملاحظة الأستاذ"]))
        doc = CustomDocument.objects.create(owner=local_user(), title=f"ورقة مهمة — {assignment.title} — {cls.name}",
            kind="worksheet", orientation="portrait", content={"blocks": blocks},
            tags=["المهام والواجبات", cls.name], source_type="assignment", source_id=assignment.id)
        return Response(CustomDocumentSerializer(doc).data, status=201)

    @action(detail=True, methods=["post"], url_path="support-missing")
    def support_missing(self, request, pk=None):
        assignment = self.get_object()
        missing = _assignment_missing_students(assignment)
        created, existing, plans = 0, 0, []
        title = f"دعم إنجاز الواجبات — {assignment.title}"[:200]
        for student in missing:
            plan = student.support_plans.filter(status__in=["planned", "active", "monitoring"], title=title).first()
            if plan:
                existing += 1
            else:
                plan = SupportPlan.objects.create(
                    student=student, title=title, category="homework",
                    priority="high" if assignment.is_overdue else "medium", status="active",
                    reason=f"لم يُسلّم التلميذ مهمة «{assignment.title}» المستحقة بتاريخ {assignment.due_date or 'غير محدد'}.",
                    actions=[{"text": "تذكير التلميذ بالمهمة وتحديد موعد تسليم جديد", "done": False, "due": ""},
                             {"text": "تقسيم المهمة إلى خطوات قصيرة ومتابعة الإنجاز", "done": False, "due": ""},
                             {"text": "إشعار الولي عند تكرار عدم التسليم", "done": False, "due": ""}],
                    start_date=datetime.date.today(), due_date=assignment.due_date or (datetime.date.today() + datetime.timedelta(days=7)),
                    teacher_notes="أُنشئت تلقائيًا من مركز المهام والواجبات.")
                created += 1
            plans.append(plan)
        return Response({"created": created, "existing": existing, "students": len(missing),
                         "plans": SupportPlanSerializer(plans, many=True).data}, status=201 if created else 200)



class AssignmentSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSubmissionSerializer
    queryset = AssignmentSubmission.objects.select_related("assignment", "assignment__school_class", "student", "student__school_class")

    def get_queryset(self):
        qs = self.queryset.filter(student__school_class__owner=local_user())
        params = self.request.query_params
        if params.get("assignment"): qs = qs.filter(assignment_id=params["assignment"])
        if params.get("student"): qs = qs.filter(student_id=params["student"])
        if params.get("class"): qs = qs.filter(student__school_class_id=params["class"])
        if params.get("status"): qs = qs.filter(status=params["status"])
        return qs

    def _validate_pair(self, data):
        assignment_id = data.get("assignment", getattr(self.get_object(), "assignment_id", None) if self.kwargs.get("pk") else None)
        student_id = data.get("student", getattr(self.get_object(), "student_id", None) if self.kwargs.get("pk") else None)
        assignment = Assignment.objects.filter(pk=assignment_id, school_class__owner=local_user()).first()
        student = Student.objects.filter(pk=student_id, school_class__owner=local_user()).first()
        if assignment_id and not assignment:
            return Response({"detail": "المهمة غير موجودة."}, status=404)
        if student_id and not student:
            return Response({"detail": "التلميذ غير موجود."}, status=404)
        if assignment and student and student.school_class_id != assignment.school_class_id:
            return Response({"detail": "التلميذ لا ينتمي إلى فوج المهمة."}, status=400)
        return None

    def create(self, request, *args, **kwargs):
        return self._validate_pair(request.data) or super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return self._validate_pair(request.data) or super().update(request, *args, **kwargs)



# ------------------------------------------------------------------ teacher action centre & smart suggestions
def _task_suggestions():
    user = local_user()
    today = datetime.date.today()
    horizon = today + datetime.timedelta(days=7)
    open_tasks = TeacherTask.objects.filter(owner=user, status__in=["pending", "in_progress"])
    existing = {(task.source_type, task.source_id, task.title) for task in open_tasks}
    suggestions = []

    def add(key, title, description, category, priority, due_date, source_type="", source_id=None,
            student=None, school_class=None, reason=""):
        item = {
            "key": key, "title": title, "description": description, "category": category,
            "category_label": dict(TeacherTask.CATEGORIES).get(category, category), "priority": priority,
            "priority_label": dict(TeacherTask.PRIORITIES).get(priority, priority),
            "due_date": str(due_date) if due_date else None, "source_type": source_type,
            "source_id": source_id, "student": student.id if student else None,
            "student_name": student.full_name if student else None,
            "school_class": school_class.id if school_class else (student.school_class_id if student else None),
            "class_name": school_class.name if school_class else (student.school_class.name if student else None),
            "reason": reason or description,
        }
        item["already_added"] = (source_type, source_id, title) in existing
        suggestions.append(item)

    for plan in SupportPlan.objects.filter(student__school_class__owner=user).exclude(status__in=["completed", "cancelled"]).select_related("student", "student__school_class"):
        if (plan.due_date and plan.due_date <= horizon) or plan.priority == "high":
            add(f"support-plan:{plan.id}", f"متابعة خطة الدعم: {plan.title}",
                f"تقدم الخطة {plan.progress_percent}٪ ويجب مراجعة إجراءاتها وتحديث حالتها.", "support",
                "high" if (plan.due_date and plan.due_date < today) or plan.priority == "high" else plan.priority,
                plan.due_date or today + datetime.timedelta(days=3), "support-plan", plan.id, plan.student,
                reason="خطة دعم مفتوحة قريبة الأجل أو ذات أولوية عالية")

    for row in ParentCommunication.objects.filter(student__school_class__owner=user, follow_up_date__isnull=False, follow_up_date__lte=horizon).select_related("student", "student__school_class").order_by("follow_up_date")[:20]:
        add(f"parent-follow-up:{row.id}", f"متابعة تواصل الولي: {row.subject}",
            f"موعد المتابعة المتفق عليه مع ولي {row.student.full_name} بتاريخ {row.follow_up_date}.", "parent",
            "high" if row.follow_up_date < today else "medium", row.follow_up_date,
            "parent-communication", row.id, row.student, reason="وصل موعد متابعة تواصل سابق مع الولي")

    for assignment in Assignment.objects.filter(school_class__owner=user, status="active").select_related("school_class", "course").prefetch_related("submissions"):
        stats = assignment.stats
        if stats["missing"] and (assignment.is_overdue or (assignment.due_date and assignment.due_date <= today + datetime.timedelta(days=3))):
            add(f"assignment:{assignment.id}", f"متابعة تسليم المهمة: {assignment.title}",
                f"يوجد {stats['missing']} تلميذًا لم يسلّموا بعد، ونسبة الإنجاز الحالية {stats['completion_rate']}٪.", "assignment",
                "high" if assignment.is_overdue else "medium", assignment.due_date or today,
                "assignment", assignment.id, None, assignment.school_class,
                reason="مهمة فائدة الأجل أو قريبة الأجل وفيها تسليمات مفقودة")

    students = Student.objects.filter(school_class__owner=user).select_related("school_class").prefetch_related(
        "marks", "attendance_records", "follow_up_records", "support_plans", "assignment_submissions__assignment")
    for student in students:
        risk = _student_risk(student)
        if risk["risk_score"] >= 50 and risk["open_plans"] == 0:
            add(f"student-risk:{student.id}", f"إنشاء خطة دعم لـ {student.full_name}",
                "؛ ".join(risk["reasons"][:4]), "support", "high", today + datetime.timedelta(days=3),
                "student", student.id, student, reason=f"درجة مخاطرة التلميذ {risk['risk_score']}/100 ولا توجد خطة دعم مفتوحة")

    recent_sessions = Session.objects.filter(owner=user, status="done", date__gte=today - datetime.timedelta(days=14)).select_related("school_class", "course").order_by("-date")[:30]
    checked_session_ids = set()
    for session in recent_sessions:
        marker = (session.school_class_id, session.date)
        if marker in checked_session_ids: continue
        checked_session_ids.add(marker)
        if not AttendanceRecord.objects.filter(student__school_class=session.school_class, date=session.date).exists():
            add(f"attendance-session:{session.id}", f"تسجيل حضور حصة {session.school_class.name} بتاريخ {session.date}",
                f"سُجّلت حصة {session.course.title if session.course else ''} دون سجل حضور فعلي للتلاميذ.", "attendance",
                "medium", session.date, "session", session.id, None, session.school_class,
                reason="حصة منفذة حديثة بلا سجل حضور")
        if len(checked_session_ids) >= 8: break

    plan_course_ids = set(LessonPlan.objects.filter(owner=user, course__isnull=False).values_list("course_id", flat=True))
    for cls in SchoolClass.objects.filter(owner=user):
        progress = class_progress(cls)
        next_course = progress.get("next_course")
        if next_course and next_course["id"] not in plan_course_ids:
            add(f"lesson-plan:{cls.id}:{next_course['id']}", f"تحضير خطة درس: {next_course['title']} — {cls.name}",
                "الدرس التالي المقترح لهذا الفوج لا يملك خطة درس مرتبطة بعد.", "lesson", "medium",
                today + datetime.timedelta(days=7), "course", next_course["id"], None, cls,
                reason="الدرس التالي في تقدم الفوج بلا خطة")

    for holiday in Holiday.objects.filter(owner=user, start_date__gte=today, start_date__lte=today + datetime.timedelta(days=14)).order_by("start_date"):
        add(f"holiday:{holiday.id}", f"الاستعداد قبل: {holiday.name}", "عطلة أو مناسبة قريبة قد تؤثر في تخطيط الحصص والمهام.", "calendar", "low", holiday.start_date, "holiday", holiday.id, reason="حدث تقويم قريب")
    for seminar in Seminar.objects.filter(owner=user, date__gte=today, date__lte=horizon).order_by("date"):
        add(f"seminar:{seminar.id}", f"تحضير: {seminar.title}", seminar.place or "ندوة أو يوم تكويني قريب.", "calendar", "medium", seminar.date, "seminar", seminar.id, reason="نشاط تكويني خلال الأسبوع")
    for visit in Visit.objects.filter(owner=user, date__gte=today, date__lte=horizon).select_related("institution").order_by("date"):
        add(f"visit:{visit.id}", f"تحضير زيارة: {visit.visit_type}", f"{visit.institution.name if visit.institution else ''} — {visit.teacher_visited or ''}", "inspection", "medium", visit.date, "visit", visit.id, reason="زيارة أو متابعة قريبة")

    priority_rank = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda item: (item["already_added"], priority_rank.get(item["priority"], 1), item["due_date"] or "9999-12-31", item["title"]))
    return suggestions


class TeacherTaskViewSet(viewsets.ModelViewSet):
    serializer_class = TeacherTaskSerializer
    queryset = TeacherTask.objects.select_related("student", "school_class")

    def get_queryset(self):
        qs = self.queryset.filter(owner=local_user())
        params = self.request.query_params
        if params.get("status"): qs = qs.filter(status=params["status"])
        if params.get("category"): qs = qs.filter(category=params["category"])
        if params.get("priority"): qs = qs.filter(priority=params["priority"])
        if params.get("student"): qs = qs.filter(student_id=params["student"])
        if params.get("class"): qs = qs.filter(school_class_id=params["class"])
        if params.get("q"):
            qs = qs.filter(Q(title__icontains=params["q"]) | Q(description__icontains=params["q"]) | Q(student__full_name__icontains=params["q"]))
        today = datetime.date.today()
        due = params.get("due")
        if due == "overdue": qs = qs.filter(status__in=["pending", "in_progress"], due_date__lt=today)
        elif due == "today": qs = qs.filter(due_date=today)
        elif due == "week": qs = qs.filter(status__in=["pending", "in_progress"], due_date__gte=today, due_date__lte=today + datetime.timedelta(days=7))
        elif due == "none": qs = qs.filter(due_date__isnull=True)
        ordering = params.get("ordering")
        if ordering in ("due_date", "-due_date", "-updated_at", "created_at", "-created_at"):
            qs = qs.order_by(ordering)
        return qs

    def _validate_links(self, data):
        student_id = data.get("student")
        class_id = data.get("school_class")
        if student_id and not Student.objects.filter(pk=student_id, school_class__owner=local_user()).exists():
            return Response({"detail": "التلميذ غير موجود."}, status=404)
        if class_id and not _owned_school_class(class_id):
            return Response({"detail": "الفوج غير موجود."}, status=404)
        return None

    def create(self, request, *args, **kwargs):
        return self._validate_links(request.data) or super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return self._validate_links(request.data) or super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        task = serializer.save(owner=local_user())
        if task.status == "done" and not task.completed_at:
            task.completed_at = timezone.now(); task.save(update_fields=["completed_at"])

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        task = serializer.save()
        if task.status == "done" and old_status != "done":
            task.completed_at = timezone.now(); task.save(update_fields=["completed_at"])
        elif task.status != "done" and task.completed_at:
            task.completed_at = None; task.save(update_fields=["completed_at"])

    @action(detail=False, methods=["get"])
    def suggestions(self, request):
        rows = _task_suggestions()
        return Response({"count": len(rows), "new": sum(1 for row in rows if not row["already_added"]), "suggestions": rows})

    @action(detail=False, methods=["post"], url_path="accept-suggestion")
    def accept_suggestion(self, request):
        title = str(request.data.get("title") or "").strip()
        if not title: return Response({"detail": "عنوان المهمة مطلوب."}, status=400)
        source_type = str(request.data.get("source_type") or "")[:40]
        try: source_id = int(request.data.get("source_id")) if request.data.get("source_id") not in (None, "") else None
        except (TypeError, ValueError): source_id = None
        existing = TeacherTask.objects.filter(owner=local_user(), status__in=["pending", "in_progress"], source_type=source_type, source_id=source_id, title=title).first()
        if existing: return Response(TeacherTaskSerializer(existing).data, status=200)
        invalid = self._validate_links(request.data)
        if invalid: return invalid
        student = Student.objects.filter(pk=request.data.get("student"), school_class__owner=local_user()).first() if request.data.get("student") else None
        school_class = _owned_school_class(request.data.get("school_class")) if request.data.get("school_class") else (student.school_class if student else None)
        task = TeacherTask.objects.create(
            owner=local_user(), title=title[:220], description=str(request.data.get("description") or ""),
            category=request.data.get("category") if request.data.get("category") in dict(TeacherTask.CATEGORIES) else "general",
            priority=request.data.get("priority") if request.data.get("priority") in dict(TeacherTask.PRIORITIES) else "medium",
            status="pending", due_date=_parse_iso_date(request.data.get("due_date")), student=student,
            school_class=school_class, source_type=source_type, source_id=source_id, origin="auto")
        return Response(TeacherTaskSerializer(task).data, status=201)

    @action(detail=False, methods=["post"], url_path="generate-suggestions")
    def generate_suggestions(self, request):
        selected_keys = set(request.data.get("keys") or [])
        created, existing = [], []
        for suggestion in _task_suggestions():
            if selected_keys and suggestion["key"] not in selected_keys: continue
            if suggestion["already_added"]:
                task = TeacherTask.objects.filter(owner=local_user(), status__in=["pending", "in_progress"], source_type=suggestion["source_type"], source_id=suggestion["source_id"], title=suggestion["title"]).first()
                if task: existing.append(task)
                continue
            student = Student.objects.filter(pk=suggestion["student"], school_class__owner=local_user()).first() if suggestion["student"] else None
            school_class = _owned_school_class(suggestion["school_class"]) if suggestion["school_class"] else None
            created.append(TeacherTask.objects.create(
                owner=local_user(), title=suggestion["title"], description=suggestion["description"], category=suggestion["category"],
                priority=suggestion["priority"], status="pending", due_date=_parse_iso_date(suggestion["due_date"]),
                student=student, school_class=school_class, source_type=suggestion["source_type"], source_id=suggestion["source_id"], origin="auto"))
        return Response({"created": len(created), "existing": len(existing), "tasks": TeacherTaskSerializer(created + existing, many=True).data}, status=201 if created else 200)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = TeacherTask.objects.filter(owner=local_user())
        today = datetime.date.today()
        open_tasks = qs.filter(status__in=["pending", "in_progress"])
        done = qs.filter(status="done")
        total = qs.count()
        return Response({
            "total": total, "open": open_tasks.count(), "done": done.count(),
            "completion_rate": round(done.count() * 100 / total, 1) if total else 0,
            "overdue": open_tasks.filter(due_date__lt=today).count(),
            "today": open_tasks.filter(due_date=today).count(),
            "this_week": open_tasks.filter(due_date__gte=today, due_date__lte=today + datetime.timedelta(days=7)).count(),
            "high_priority": open_tasks.filter(priority="high").count(),
            "suggestions": len(_task_suggestions()),
            "new_suggestions": sum(1 for row in _task_suggestions() if not row["already_added"]),
            "by_category": {key: open_tasks.filter(category=key).count() for key, _label in TeacherTask.CATEGORIES},
            "by_status": {key: qs.filter(status=key).count() for key, _label in TeacherTask.STATUSES},
        })

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object(); task.status = "done"; task.completed_at = timezone.now(); task.save(update_fields=["status", "completed_at", "updated_at"])
        return Response(TeacherTaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        task = self.get_object(); task.status = "pending"; task.completed_at = None; task.save(update_fields=["status", "completed_at", "updated_at"])
        return Response(TeacherTaskSerializer(task).data)

    @action(detail=False, methods=["post"], url_path="generate-document")
    def generate_document(self, request):
        qs = self.get_queryset()
        if request.data.get("only_open", True) not in (False, "false", "0"):
            qs = qs.filter(status__in=["pending", "in_progress"])
        tasks = list(qs.order_by("due_date", "-updated_at")[:100])
        if not tasks: return Response({"detail": "لا مهام مطابقة لتوليد خطة العمل."}, status=400)
        rows = [[str(task.due_date or "—"), task.category_label, task.title, task.student.full_name if task.student else (task.school_class.name if task.school_class else "—"), task.priority_label, task.status_label] for task in tasks]
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""
        blocks = [
            docs_builder.fields([("الأستاذ(ة)", teacher), ("التاريخ", str(datetime.date.today())), ("عدد المهام", str(len(tasks))), ("منها متأخرة", str(sum(1 for task in tasks if task.is_overdue)))], "خطة عمل الأستاذ — مركز الإجراءات"),
            docs_builder.table(["الأجل", "الصنف", "المهمة", "التلميذ/الفوج", "الأولوية", "الحالة"], rows, "المهام المفتوحة حسب الأجل"),
            docs_builder.checklist([task.title for task in tasks[:30]], "قائمة إنجاز سريعة"),
            docs_builder.signatures(["الأستاذ(ة)", "ملاحظات نهاية الأسبوع"]),
        ]
        doc = CustomDocument.objects.create(owner=local_user(), title=f"خطة عمل الأستاذ — {datetime.date.today()}", kind="tracker-sheet",
            orientation="landscape", content={"blocks": blocks}, tags=["مركز الإجراءات", "خطة عمل"], source_type="teacher-tasks")
        return Response(CustomDocumentSerializer(doc).data, status=201)


class HolidayViewSet(OwnedViewSet):
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer


class SeminarViewSet(OwnedViewSet):
    queryset = Seminar.objects.all()
    serializer_class = SeminarSerializer


class InstitutionViewSet(OwnedViewSet):
    queryset = Institution.objects.prefetch_related("visits")
    serializer_class = InstitutionSerializer


class VisitViewSet(OwnedViewSet):
    queryset = Visit.objects.select_related("institution")
    serializer_class = VisitSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        inst = self.request.query_params.get("institution")
        if inst:
            qs = qs.filter(institution_id=inst)
        return qs


class ObservationViewSet(OwnedViewSet):
    queryset = Observation.objects.select_related("institution", "course")
    serializer_class = ObservationSerializer



class QuestionBankItemViewSet(OwnedViewSet):
    """Reusable question bank for exams, worksheets and future assessments."""
    queryset = QuestionBankItem.objects.select_related("course", "source_document")
    serializer_class = QuestionBankItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("q"):
            q = params["q"]
            qs = qs.filter(Q(prompt__icontains=q) | Q(answer__icontains=q) |
                           Q(explanation__icontains=q) | Q(course__title__icontains=q))
        if params.get("course"):
            qs = qs.filter(course_id=params["course"])
        if params.get("qtype"):
            qs = qs.filter(qtype=params["qtype"])
        if params.get("difficulty"):
            qs = qs.filter(difficulty=params["difficulty"])
        return qs

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = self.get_queryset()
        total = qs.count()
        answered = qs.exclude(answer="").count()
        return Response({
            "total": total,
            "with_answers": answered,
            "without_answers": total - answered,
            "total_points": round(sum((x.points or 0) for x in qs), 2),
            "multiple_choice": qs.filter(qtype="اختيار من متعدد").count(),
            "courses_covered": qs.exclude(course__isnull=True).values("course").distinct().count(),
            "by_difficulty": {label: qs.filter(difficulty=label).count() for label in ("سهل", "متوسط", "صعب")},
            "by_type": {label: qs.filter(qtype=label).count() for label, _ in QuestionBankItem.TYPES},
        })

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        obj = self.get_object()
        copy = QuestionBankItem.objects.create(
            owner=local_user(), course=obj.course, prompt=obj.prompt, qtype=obj.qtype,
            difficulty=obj.difficulty, points=obj.points, options=list(obj.options or []),
            answer=obj.answer, explanation=obj.explanation, lines=obj.lines,
            tags=list(obj.tags or []), source_document=obj.source_document)
        return Response(QuestionBankItemSerializer(copy).data, status=201)

    @action(detail=False, methods=["get"], url_path="counts-by-course")
    def counts_by_course(self, request):
        """Available questions per lesson (the bank list itself is paginated,
        so generators use this for accurate per-lesson counts)."""
        from django.db.models import Count
        qs = self.get_queryset().exclude(course__isnull=True)
        if request.query_params.get("difficulty"):
            qs = qs.filter(difficulty=request.query_params["difficulty"])
        if request.query_params.get("qtype"):
            qs = qs.filter(qtype=request.query_params["qtype"])
        rows = (qs.values("course_id", "course__title", "course__order")
                .annotate(available=Count("id")).order_by("course__order", "course_id"))
        return Response(list(rows))

    @action(detail=False, methods=["post"], url_path="seed-from-courses")
    def seed_from_courses(self, request):
        """Create starter questions from every syllabus lesson's key points.

        `variants` (1–4) controls how many different question shapes are
        generated per key point, so a lesson can hold dozens of questions
        instead of one per key point."""
        user = local_user()
        try: variants = int(request.data.get("variants") or 1)
        except (TypeError, ValueError): variants = 1
        variants = min(max(variants, 1), 4)
        templates = [
            ("اشرح المقصود بـ: {point}", "سؤال قصير", "متوسط", 2, 3),
            ("اذكر مثالًا من الواقع يوضّح: {point}", "سؤال قصير", "سهل", 2, 2),
            ("لخّص في فقرة قصيرة: {point}، مع إبراز أهم عناصره.", "سؤال مقالي", "متوسط", 4, 5),
            ("نشاط تطبيقي: طبّق «{point}» عمليًا على الحاسوب ودوّن خطواتك والنتيجة التي توصلت إليها.", "نشاط تطبيقي", "صعب", 4, 4),
        ][:variants]
        courses = Course.objects.filter(owner=user).order_by("order", "id")
        existing = {(x.course_id, x.prompt.strip()) for x in QuestionBankItem.objects.filter(owner=user)}
        created = []
        for course in courses:
            for point in (course.key_points or []):
                point = str(point).strip()
                if not point:
                    continue
                for template, qtype, difficulty, points, qlines in templates:
                    prompt = template.format(point=point)
                    if (course.id, prompt) in existing:
                        continue
                    created.append(QuestionBankItem(
                        owner=user, course=course, prompt=prompt, qtype=qtype,
                        difficulty=difficulty, points=points, options=[], answer=point,
                        explanation=(course.summary or "")[:500], lines=qlines,
                        tags=doc_exchange.clean_tags([course.domain, course.unit, "من المقرر"])))
                    existing.add((course.id, prompt))
        QuestionBankItem.objects.bulk_create(created)
        return Response({"created": len(created), "total": QuestionBankItem.objects.filter(owner=user).count()})

    @action(detail=False, methods=["post"], url_path="import-from-document")
    def import_from_document(self, request):
        try:
            doc = CustomDocument.objects.get(pk=request.data.get("document_id"), owner=local_user())
        except (CustomDocument.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "الوثيقة غير موجودة."}, status=404)
        course = None
        if request.data.get("course_id"):
            course = Course.objects.filter(pk=request.data.get("course_id"), owner=local_user()).first()
        existing = {x.prompt.strip() for x in QuestionBankItem.objects.filter(owner=local_user())}
        created, skipped = [], 0
        for block in (doc.content or {}).get("blocks", []):
            if block.get("type") != "questions":
                continue
            for raw in (block.get("questions") or []):
                prompt = str(raw.get("prompt") or "").strip()
                if not prompt:
                    continue
                if prompt in existing:
                    skipped += 1; continue
                try: points = min(max(float(raw.get("points") or 2), 0), 100)
                except (TypeError, ValueError): points = 2
                try: lines = min(max(int(raw.get("lines") or 3), 0), 12)
                except (TypeError, ValueError): lines = 3
                created.append(QuestionBankItem(
                    owner=local_user(), course=course, prompt=prompt,
                    qtype=raw.get("qtype") if raw.get("qtype") in dict(QuestionBankItem.TYPES) else "سؤال قصير",
                    difficulty="متوسط", points=points,
                    options=[str(x).strip() for x in (raw.get("options") or []) if str(x).strip()],
                    answer=str(raw.get("answer") or ""), explanation="", lines=lines,
                    tags=doc_exchange.clean_tags(doc.tags + ["من وثيقة"]), source_document=doc))
                existing.add(prompt)
        QuestionBankItem.objects.bulk_create(created)
        return Response({"created": len(created), "skipped_duplicates": skipped,
                         "questions": QuestionBankItemSerializer(created, many=True).data}, status=201)

    @action(detail=False, methods=["post"], url_path="generate-document")
    def generate_document(self, request):
        import random as _random
        data = request.data
        qs = QuestionBankItem.objects.filter(owner=local_user()).select_related("course")
        selected_ids = data.get("ids") or []
        if selected_ids:
            try:
                selected_ids = list(dict.fromkeys(int(x) for x in selected_ids))
            except (TypeError, ValueError):
                return Response({"detail": "قائمة الأسئلة المحددة غير صالحة."}, status=400)
            by_id = {x.id: x for x in qs.filter(pk__in=selected_ids)}
            items = [by_id[x] for x in selected_ids if x in by_id]
            if not items:
                return Response({"detail": "لا أسئلة محددة مطابقة."}, status=400)
            kind = "worksheet" if data.get("kind") == "worksheet" else "exam"
            profile = _profile()
            teacher = profile.full_name if profile and profile.full_name else ""
            title = str(data.get("title") or f"{'اختبار' if kind == 'exam' else 'ورقة عمل'} من بنك الأسئلة")[:200]
            total_points = round(sum(float(x.points or 0) for x in items), 2)
            doc = CustomDocument.objects.create(
                owner=local_user(), title=title, kind=kind, orientation="portrait",
                content={"blocks": [
                    docs_builder.fields([("المادة", "الإعلام الآلي"), ("القسم", ""), ("الأستاذ(ة)", teacher),
                                         ("عدد الأسئلة", str(len(items))), ("مجموع النقاط", str(total_points))], title),
                    docs_builder.text("التعليمات: اقرأ كل سؤال بعناية وأجب بخط واضح."),
                    docs_builder.questions([x.as_block_question() for x in items], "الأسئلة", show_answers=bool(data.get("include_answer_key"))),
                    docs_builder.signatures(["إمضاء الأستاذ(ة)"]),
                ]}, tags=doc_exchange.clean_tags(["بنك الأسئلة", "محددة يدويًا"]), source_type="question-bank")
            return Response(CustomDocumentSerializer(doc).data, status=201)

        # ---- per-lesson quotas: [{course_id, count}, ...] ----
        lesson_counts = data.get("lesson_counts") or []
        if lesson_counts:
            if not isinstance(lesson_counts, list):
                return Response({"detail": "قائمة الدروس وعدد الأسئلة غير صالحة."}, status=400)
            quotas = []
            seen_courses = set()
            for entry in lesson_counts:
                try:
                    cid = int(entry.get("course_id")); wanted = int(entry.get("count"))
                except (TypeError, ValueError, AttributeError):
                    return Response({"detail": "قائمة الدروس وعدد الأسئلة غير صالحة."}, status=400)
                if cid in seen_courses or wanted < 1:
                    continue
                seen_courses.add(cid)
                quotas.append((cid, min(wanted, 200)))
            if not quotas:
                return Response({"detail": "اختر درسًا واحدًا على الأقل مع عدد أسئلة أكبر من صفر."}, status=400)
            courses_by_id = {c.id: c for c in Course.objects.filter(owner=local_user(), pk__in=[cid for cid, _ in quotas])}
            missing = [cid for cid, _ in quotas if cid not in courses_by_id]
            if missing:
                return Response({"detail": "يوجد درس غير موجود في قائمة الدروس المطلوبة."}, status=400)

            def _ordered(pool):
                pool = list(pool)
                strategy = data.get("strategy") or "random"
                if strategy == "points_desc":
                    pool.sort(key=lambda x: (-(x.points or 0), x.prompt))
                elif strategy == "difficulty":
                    order = {"سهل": 0, "متوسط": 1, "صعب": 2}
                    pool.sort(key=lambda x: (order.get(x.difficulty, 1), x.prompt))
                elif strategy == "sequential":
                    pool.sort(key=lambda x: x.prompt)
                else:
                    _random.SystemRandom().shuffle(pool)
                if data.get("balance_difficulty") and not data.get("difficulty"):
                    grouped = {label: [] for label in ("سهل", "متوسط", "صعب")}
                    for item in pool:
                        grouped.setdefault(item.difficulty, []).append(item)
                    balanced = []
                    while any(grouped.values()):
                        for label in ("سهل", "متوسط", "صعب"):
                            if grouped.get(label):
                                balanced.append(grouped[label].pop(0))
                    pool = balanced
                return pool

            selected, breakdown = [], []
            for cid, wanted in quotas:
                pool = qs.filter(course_id=cid)
                if data.get("difficulty"):
                    pool = pool.filter(difficulty=data["difficulty"])
                if data.get("qtype"):
                    pool = pool.filter(qtype=data["qtype"])
                pool_items = _ordered(pool)
                wanted_tags = doc_exchange.clean_tags(data.get("tags") or [])
                if wanted_tags:
                    pool_items = [x for x in pool_items if any(tag in (x.tags or []) for tag in wanted_tags)]
                picked = pool_items[:wanted]
                selected.extend(picked)
                breakdown.append({"course_id": cid, "title": courses_by_id[cid].title,
                                  "requested": wanted, "delivered": len(picked), "available": len(pool_items)})
            if not selected:
                return Response({"detail": "لا أسئلة مطابقة في الدروس المختارة — أضف أسئلة إلى بنك الأسئلة أولًا."}, status=400)
            kind = "worksheet" if data.get("kind") == "worksheet" else "exam"
            profile = _profile()
            teacher = profile.full_name if profile and profile.full_name else ""
            total_points = round(sum(float(x.points or 0) for x in selected), 2)
            lessons_label = "، ".join(f"{row['title']} ({row['delivered']})" for row in breakdown)
            title = str(data.get("title") or f"{'اختبار' if kind == 'exam' else 'ورقة عمل'} من بنك الأسئلة — دروس مختارة")[:200]
            doc = CustomDocument.objects.create(
                owner=local_user(), title=title, kind=kind, orientation="portrait",
                content={"blocks": [
                    docs_builder.fields([
                        ("المادة", "الإعلام الآلي"), ("الدروس المشمولة", lessons_label),
                        ("القسم", ""), ("الأستاذ(ة)", teacher),
                        ("عدد الأسئلة", str(len(selected))), ("مجموع النقاط", str(total_points)),
                    ], title),
                    docs_builder.text("التعليمات: اقرأ كل سؤال بعناية، أجب بخط واضح، واحترم النقطة المخصصة لكل سؤال." if kind == "exam"
                                      else "التعليمات: أنجز الأنشطة التالية اعتمادًا على ما تعلّمته، ثم راجع إجاباتك قبل التسليم."),
                    docs_builder.questions([x.as_block_question() for x in selected], "أسئلة الاختبار" if kind == "exam" else "أنشطة ورقة العمل",
                                           show_answers=bool(data.get("include_answer_key"))),
                    docs_builder.signatures(["إمضاء الأستاذ(ة)"] if kind == "exam" else ["اسم التلميذ", "تصحيح الأستاذ(ة)"]),
                ]}, tags=doc_exchange.clean_tags(["بنك الأسئلة", "دروس مختارة"]), source_type="question-bank")
            return Response({**CustomDocumentSerializer(doc).data, "questions_used": len(selected),
                             "total_points": total_points, "breakdown": breakdown}, status=201)
        course = None
        if data.get("course_id"):
            course = Course.objects.filter(pk=data.get("course_id"), owner=local_user()).first()
            if not course:
                return Response({"detail": "الدرس غير موجود."}, status=404)
            qs = qs.filter(course=course)
        if data.get("difficulty"):
            qs = qs.filter(difficulty=data["difficulty"])
        if data.get("qtype"):
            qs = qs.filter(qtype=data["qtype"])
        items = list(qs)
        wanted_tags = doc_exchange.clean_tags(data.get("tags") or [])
        if wanted_tags:
            items = [x for x in items if any(tag in (x.tags or []) for tag in wanted_tags)]
        if not items:
            return Response({"detail": "لا أسئلة مطابقة لمعايير التوليد."}, status=400)

        strategy = data.get("strategy") or "random"
        if strategy == "random":
            _random.SystemRandom().shuffle(items)
        elif strategy == "points_desc":
            items.sort(key=lambda x: (-(x.points or 0), x.prompt))
        elif strategy == "difficulty":
            order = {"سهل": 0, "متوسط": 1, "صعب": 2}
            items.sort(key=lambda x: (order.get(x.difficulty, 1), x.prompt))
        else:
            items.sort(key=lambda x: x.prompt)

        if data.get("balance_difficulty") and not data.get("difficulty"):
            grouped = {label: [] for label in ("سهل", "متوسط", "صعب")}
            for item in items:
                grouped.setdefault(item.difficulty, []).append(item)
            balanced = []
            while any(grouped.values()):
                for label in ("سهل", "متوسط", "صعب"):
                    if grouped.get(label):
                        balanced.append(grouped[label].pop(0))
            items = balanced

        try: target_points = float(data.get("target_points")) if data.get("target_points") not in (None, "") else None
        except (TypeError, ValueError): target_points = None
        try: count = int(data.get("count")) if data.get("count") not in (None, "") else (100 if target_points else 10)
        except (TypeError, ValueError): count = 10
        count = min(max(count, 1), 200)
        selected, total_points = [], 0.0
        for item in items:
            if len(selected) >= count:
                break
            selected.append(item); total_points += float(item.points or 0)
            if target_points and total_points >= target_points:
                break
        if not selected:
            return Response({"detail": "لا أسئلة مطابقة لمعايير التوليد."}, status=400)

        kind = "worksheet" if data.get("kind") == "worksheet" else "exam"
        profile = _profile()
        teacher = profile.full_name if profile and profile.full_name else ""
        default_title = f"{'اختبار' if kind == 'exam' else 'ورقة عمل'} من بنك الأسئلة" + (f" — {course.title}" if course else "")
        title = str(data.get("title") or default_title)[:200]
        question_dicts = [x.as_block_question() for x in selected]
        blocks = [
            docs_builder.fields([
                ("المادة", "الإعلام الآلي"), ("الدرس", course.title if course else "بنك الأسئلة"),
                ("المستوى", course.level if course else ""), ("القسم", ""), ("الأستاذ(ة)", teacher),
                ("عدد الأسئلة", str(len(selected))), ("مجموع النقاط", str(round(total_points, 2))),
            ], title),
            docs_builder.text("التعليمات: اقرأ كل سؤال بعناية، أجب بخط واضح، واحترم النقطة المخصصة لكل سؤال." if kind == "exam"
                              else "التعليمات: أنجز الأنشطة التالية اعتمادًا على ما تعلّمته، ثم راجع إجاباتك قبل التسليم."),
            docs_builder.questions(question_dicts, "أسئلة الاختبار" if kind == "exam" else "أنشطة ورقة العمل",
                                   show_answers=bool(data.get("include_answer_key"))),
            docs_builder.signatures(["إمضاء الأستاذ(ة)"] if kind == "exam" else ["اسم التلميذ", "تصحيح الأستاذ(ة)"]),
        ]
        doc = CustomDocument.objects.create(
            owner=local_user(), title=title, kind=kind, orientation="portrait",
            content={"blocks": blocks}, tags=doc_exchange.clean_tags(["بنك الأسئلة", course.domain if course else ""]),
            source_type="question-bank", source_id=course.id if course else None)
        return Response(CustomDocumentSerializer(doc).data, status=201)


class CustomDocumentViewSet(OwnedViewSet):
    """Creator Studio documents: visual block editor + PDF/DOCX exports."""
    queryset = CustomDocument.objects.select_related("theme")
    serializer_class = CustomDocumentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("kind"):
            qs = qs.filter(kind=params["kind"])
        if params.get("archived") in ("1", "true", "yes"):
            qs = qs.filter(is_archived=True)
        elif params.get("archived") in ("0", "false", "no"):
            qs = qs.filter(is_archived=False)
        if params.get("favorite") in ("1", "true", "yes"):
            qs = qs.filter(is_favorite=True)
        if params.get("q"):
            qs = qs.filter(Q(title__icontains=params["q"]) | Q(kind__icontains=params["q"]))
        return qs

    def _snapshot(self, doc, label=""):
        import copy as _copy
        return DocumentRevision.objects.create(
            document=doc, label=label, title=doc.title, kind=doc.kind,
            theme=doc.theme, orientation=doc.orientation,
            content=_copy.deepcopy(doc.content or {}))

    def perform_update(self, serializer):
        import copy as _copy
        old = serializer.instance
        before = {"title": old.title, "kind": old.kind, "theme_id": old.theme_id,
                  "orientation": old.orientation, "content": _copy.deepcopy(old.content or {})}
        incoming = serializer.validated_data
        changed = any(
            (key in incoming and incoming[key] != before[key])
            for key in ("title", "kind", "orientation", "content")
        ) or ("theme" in incoming and getattr(incoming["theme"], "id", None) != before["theme_id"])
        if changed:
            DocumentRevision.objects.create(
                document=old, label="نسخة قبل الحفظ", title=before["title"], kind=before["kind"],
                theme_id=before["theme_id"], orientation=before["orientation"], content=before["content"])
        serializer.save()

    def perform_create(self, serializer):
        obj = serializer.save(owner=local_user())
        changed = []
        if not (obj.content or {}).get("blocks"):
            obj.content = docs_builder.template_content(obj.kind, obj.title)
            changed.append("content")
        if "orientation" not in self.request.data and obj.kind in ("seating", "certificate"):
            obj.orientation = "landscape"
            changed.append("orientation")
        if changed:
            obj.save(update_fields=changed)

    @action(detail=True, methods=["get"], url_path="export-json")
    def export_json(self, request, pk=None):
        doc = self.get_object()
        payload = doc_exchange.export_payload(doc)
        data = __import__("json").dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        resp = HttpResponse(data, content_type="application/json; charset=utf-8")
        ascii_name = slugify(doc.title) or "teacherhub-document"
        resp["Content-Disposition"] = (
            f'attachment; filename="{ascii_name}.teacherhub.json"; '
            f"filename*=UTF-8''{quote(doc.title + '.teacherhub.json')}")
        return resp

    @action(detail=False, methods=["post"], url_path="import-json",
            parser_classes=[JSONParser, MultiPartParser, FormParser])
    def import_json(self, request):
        try:
            upload = request.FILES.get("file") if hasattr(request, "FILES") else None
            if upload is not None:
                payload = __import__("json").loads(upload.read().decode("utf-8-sig"))
            elif isinstance(request.data, dict) and "payload" in request.data:
                raw = request.data.get("payload")
                payload = __import__("json").loads(raw) if isinstance(raw, str) else raw
            else:
                payload = request.data
            doc = CustomDocument.objects.create(
                owner=local_user(), **doc_exchange.document_kwargs_from_payload(payload))
        except Exception as exc:
            return Response({"detail": f"تعذّر استيراد الوثيقة: {exc}"}, status=400)
        return Response(CustomDocumentSerializer(doc).data, status=201)

    @action(detail=False, methods=["post"], url_path="import-file",
            parser_classes=[MultiPartParser, FormParser])
    def import_file(self, request):
        upload = request.FILES.get("file") if hasattr(request, "FILES") else None
        if upload is None:
            return Response({"detail": "اختر ملفًا للاستيراد."}, status=400)
        try:
            title, blocks, kind, json_kwargs = doc_exchange.extract_uploaded_file(upload.name, upload.read())
            if json_kwargs is not None:
                kwargs = json_kwargs
            else:
                kwargs = {
                    "title": (request.data.get("title") or title)[:200],
                    "kind": kind,
                    "orientation": "portrait",
                    "content": {"blocks": blocks},
                    "tags": doc_exchange.clean_tags(request.data.get("tags") or ["مستوردة"]),
                }
            doc = CustomDocument.objects.create(owner=local_user(), **kwargs)
        except Exception as exc:
            return Response({"detail": f"تعذّر استيراد الملف: {exc}"}, status=400)
        return Response(CustomDocumentSerializer(doc).data, status=201)

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        action_name = request.data.get("action")
        raw_ids = request.data.get("ids") or []
        try:
            ids = list(dict.fromkeys(int(x) for x in raw_ids))
        except (TypeError, ValueError):
            return Response({"detail": "قائمة الوثائق غير صالحة."}, status=400)
        if not ids or len(ids) > 100:
            return Response({"detail": "اختر من وثيقة واحدة إلى 100 وثيقة."}, status=400)
        docs = list(CustomDocument.objects.filter(owner=local_user(), pk__in=ids).select_related("theme"))
        if action_name == "delete":
            count = len(docs)
            CustomDocument.objects.filter(owner=local_user(), pk__in=[d.id for d in docs]).delete()
            return Response({"action": action_name, "updated": count, "documents": []})
        if action_name == "duplicate":
            created = []
            for doc in docs:
                created.append(CustomDocument.objects.create(
                    owner=local_user(), title=f"{doc.title} — نسخة", kind=doc.kind, theme=doc.theme,
                    orientation=doc.orientation, content=doc.content, tags=doc.tags,
                    is_favorite=doc.is_favorite, source_type=doc.source_type, source_id=doc.source_id))
            return Response({"action": action_name, "updated": len(created),
                             "documents": CustomDocumentSerializer(created, many=True).data}, status=201)
        updates = {
            "favorite": {"is_favorite": True}, "unfavorite": {"is_favorite": False},
            "archive": {"is_archived": True}, "unarchive": {"is_archived": False},
        }
        if action_name not in updates:
            return Response({"detail": "إجراء جماعي غير معروف."}, status=400)
        CustomDocument.objects.filter(owner=local_user(), pk__in=[d.id for d in docs]).update(**updates[action_name])
        docs = list(CustomDocument.objects.filter(owner=local_user(), pk__in=ids).select_related("theme"))
        by_id = {d.id: d for d in docs}
        ordered = [by_id[i] for i in ids if i in by_id]
        return Response({"action": action_name, "updated": len(ordered),
                         "documents": CustomDocumentSerializer(ordered, many=True).data})

    @action(detail=False, methods=["post"], url_path="bulk-export")
    def bulk_export(self, request):
        fmt = str(request.data.get("format") or "pdf").lower()
        if fmt not in ("pdf", "docx", "json"):
            return Response({"detail": "صيغة التصدير غير مدعومة."}, status=400)
        try:
            ids = list(dict.fromkeys(int(x) for x in (request.data.get("ids") or [])))
        except (TypeError, ValueError):
            return Response({"detail": "قائمة الوثائق غير صالحة."}, status=400)
        if not ids or len(ids) > 30:
            return Response({"detail": "اختر من وثيقة واحدة إلى 30 وثيقة للتصدير الجماعي."}, status=400)
        docs_by_id = {d.id: d for d in CustomDocument.objects.filter(owner=local_user(), pk__in=ids).select_related("theme")}
        docs = [docs_by_id[i] for i in ids if i in docs_by_id]
        if not docs:
            return Response({"detail": "لا وثائق مطابقة للتصدير."}, status=404)
        import io as _io, zipfile as _zipfile
        buffer = _io.BytesIO()
        used_names = set()
        with _zipfile.ZipFile(buffer, "w", _zipfile.ZIP_DEFLATED) as archive:
            for doc in docs:
                base = slugify(doc.title) or "document"
                name = f"{doc.id:03d}-{base}"
                suffix = 1
                while name in used_names:
                    suffix += 1; name = f"{doc.id:03d}-{base}-{suffix}"
                used_names.add(name)
                if fmt == "json":
                    data = __import__("json").dumps(doc_exchange.export_payload(doc), ensure_ascii=False, indent=2).encode("utf-8")
                    archive.writestr(f"{name}.teacherhub.json", data)
                elif fmt == "docx":
                    archive.writestr(f"{name}.docx", docx_export.build_docx(doc, doc.theme))
                else:
                    from weasyprint import HTML as _HTML
                    theme = doc.theme or Theme.objects.filter(slug="gentleman-navy").first() or Theme.objects.first()
                    body = pdfdocs.custom_doc(doc, theme, _profile(), local_user())
                    html = pdfdocs.html_doc(theme, doc.title, body, doc.orientation)
                    archive.writestr(f"{name}.pdf", _HTML(string=html).write_pdf())
        resp = HttpResponse(buffer.getvalue(), content_type="application/zip")
        resp["Content-Disposition"] = (
            'attachment; filename="teacherhub-documents.zip"; '
            "filename*=UTF-8''teacherhub-documents.zip")
        return resp

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        obj = self.get_object()
        copy = CustomDocument.objects.create(
            owner=local_user(), title=f"{obj.title} — نسخة", kind=obj.kind,
            theme=obj.theme, orientation=obj.orientation, content=obj.content, tags=obj.tags,
            is_favorite=obj.is_favorite, source_type=obj.source_type, source_id=obj.source_id)
        return Response(CustomDocumentSerializer(copy).data, status=201)

    @action(detail=True, methods=["get", "post"])
    def revisions(self, request, pk=None):
        doc = self.get_object()
        if request.method == "POST":
            rev = self._snapshot(doc, request.data.get("label") or "لقطة يدوية")
            return Response(DocumentRevisionSerializer(rev).data, status=201)
        return Response(DocumentRevisionSerializer(doc.revisions.all()[:50], many=True).data)

    @action(detail=True, methods=["post"], url_path=r"revisions/(?P<revision_id>[^/.]+)/restore")
    def restore_revision(self, request, pk=None, revision_id=None):
        doc = self.get_object()
        rev = doc.revisions.filter(pk=revision_id).first()
        if not rev:
            return Response({"detail": "النسخة غير موجودة."}, status=404)
        self._snapshot(doc, "قبل الاستعادة")
        doc.title, doc.kind, doc.theme, doc.orientation, doc.content = rev.title, rev.kind, rev.theme, rev.orientation, rev.content
        doc.save()
        return Response(CustomDocumentSerializer(doc).data)

    @action(detail=True, methods=["post"], url_path="refresh-source")
    def refresh_source(self, request, pk=None):
        doc = self.get_object()
        if not doc.source_type:
            return Response({"detail": "هذه الوثيقة ليست نسخة من وثيقة حية."}, status=400)
        try:
            _title, theme, blocks = docs_builder.snapshot_existing(doc.source_type, doc.source_id, local_user(), _profile())
        except Exception as exc:
            return Response({"detail": f"تعذّر التحديث من المصدر: {exc}"}, status=400)
        self._snapshot(doc, "قبل التحديث من المصدر الحي")
        doc.theme = theme or doc.theme
        doc.content = {"blocks": blocks}
        doc.save(update_fields=["theme", "content", "updated_at"])
        return Response(CustomDocumentSerializer(doc).data)

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        """Smart generators powered by live classes, marks, courses and rosters."""
        try:
            payload = docs_builder.generate_data_document(
                request.data.get("generator"), request.data, local_user(), _profile())
        except Exception as exc:
            return Response({"detail": f"تعذّر التوليد: {exc}"}, status=400)
        doc = CustomDocument.objects.create(owner=local_user(), **payload)
        return Response(CustomDocumentSerializer(doc).data, status=201)

    @action(detail=False, methods=["post"], url_path="from-existing")
    def from_existing(self, request):
        """Snapshot an existing platform document into an editable copy."""
        source_type = request.data.get("source_type")
        source_id = request.data.get("source_id") or None
        try:
            source_id = int(source_id) if source_id not in (None, "") else None
        except (TypeError, ValueError):
            source_id = None
        try:
            title, theme, blocks = docs_builder.snapshot_existing(source_type, source_id, local_user(), _profile())
        except Exception as exc:  # missing object / unknown type
            return Response({"detail": f"تعذّر إنشاء النسخة: {exc}"}, status=400)
        doc = CustomDocument.objects.create(
            owner=local_user(), title=title, kind="editable-copy", theme=theme,
            orientation="landscape" if source_type in ("gradebook", "seating") else "portrait",
            content={"blocks": blocks}, source_type=source_type or "", source_id=source_id)
        return Response(CustomDocumentSerializer(doc).data, status=201)


class SchoolClassStatsView(APIView):
    """Per-term class mark statistics for the grade book."""
    def get(self, request, pk):
        try:
            cls = SchoolClass.objects.get(pk=pk, owner=local_user())
        except SchoolClass.DoesNotExist:
            return Response({"detail": "الفوج غير موجود."}, status=404)
        students = list(cls.students.prefetch_related("marks"))
        stats = {}
        for term in (1, 2, 3):
            avgs = []
            for st in students:
                m = next((x for x in st.marks.all() if x.term == term), None)
                if m and m.average is not None:
                    avgs.append(m.average)
            stats[f"term{term}"] = {
                "graded": len(avgs),
                "average": round(sum(avgs) / len(avgs), 2) if avgs else None,
                "highest": max(avgs) if avgs else None,
                "lowest": min(avgs) if avgs else None,
                "success_rate": round(sum(1 for a in avgs if a >= 10) * 100 / len(avgs)) if avgs else None,
            }
        return Response({"class_id": cls.id, "students": len(students), "stats": stats})



# ------------------------------------------------------------------ class analytics & term review
def _analytics_avg(values):
    values = [value for value in values if value is not None]
    return round(sum(values) / len(values), 2) if values else None


def _build_class_analytics(cls, term=1, date_from=None, date_to=None):
    students = list(cls.students.prefetch_related(
        "marks", "attendance_records", "follow_up_records", "support_plans", "assignment_submissions__assignment").order_by("full_name"))
    courses = list(Course.objects.filter(owner=local_user()).order_by("order", "id"))
    progress = class_progress(cls, courses)

    def in_range(value):
        if value is None: return True
        if date_from and value < date_from: return False
        if date_to and value > date_to: return False
        return True

    term_labels = {1: "الثلاثي الأول", 2: "الثلاثي الثاني", 3: "الثلاثي الثالث"}
    term_stats = {}
    for term_number in (1, 2, 3):
        averages = []
        components = {"continuous": [], "supervised": [], "exam": []}
        for student in students:
            mark = next((row for row in student.marks.all() if row.term == term_number), None)
            if not mark: continue
            if mark.average is not None: averages.append(mark.average)
            for key in components:
                value = getattr(mark, key)
                if value is not None: components[key].append(value)
        term_stats[str(term_number)] = {
            "term": term_number, "label": term_labels[term_number], "graded": len(averages),
            "average": _analytics_avg(averages), "highest": max(averages) if averages else None,
            "lowest": min(averages) if averages else None,
            "success_rate": round(sum(1 for value in averages if value >= 10) * 100 / len(averages), 1) if averages else None,
            "components": {key: _analytics_avg(values) for key, values in components.items()},
        }
    selected_marks = term_stats[str(term)]
    annual_values = []
    for student in students:
        averages = [mark.average for mark in student.marks.all() if mark.average is not None]
        if averages: annual_values.append(round(sum(averages) / len(averages), 2))
    distribution_bins = [(0, 5, "0–5"), (5, 10, "5–10"), (10, 15, "10–15"), (15, 20.01, "15–20")]
    selected_averages = []
    for student in students:
        mark = next((row for row in student.marks.all() if row.term == term), None)
        if mark and mark.average is not None: selected_averages.append(mark.average)
    distribution = [{"label": label, "count": sum(1 for value in selected_averages if low <= value < high),
                     "percent": round(sum(1 for value in selected_averages if low <= value < high) * 100 / len(selected_averages), 1) if selected_averages else 0}
                    for low, high, label in distribution_bins]

    attendance_records = [row for row in AttendanceRecord.objects.filter(student__school_class=cls).select_related("student") if in_range(row.date)]
    attendance_counts = {key: sum(1 for row in attendance_records if row.status == key) for key, _ in AttendanceRecord.STATUSES}
    attended = attendance_counts["present"] + attendance_counts["late"] + attendance_counts["left_early"]
    attendance_rate = round(attended * 100 / len(attendance_records), 1) if attendance_records else None

    follow_records = [row for row in StudentFollowUpRecord.objects.filter(student__school_class=cls).select_related("student", "course") if in_range(row.date)]
    follow_summary = {}
    for key, label in StudentFollowUpRecord.CATEGORIES:
        selected = [row for row in follow_records if row.category == key]
        scores = [row.score for row in selected if row.score is not None]
        follow_summary[key] = {"label": label, "count": len(selected), "average": _analytics_avg(scores),
                               "low_students": len({row.student_id for row in selected if row.score is not None and row.score < 2.5})}

    assignments = [row for row in Assignment.objects.filter(school_class=cls).exclude(status="archived")
                   .select_related("course").prefetch_related("submissions") .order_by("due_date", "-created_at")
                   if not (date_from or date_to) or in_range(row.due_date) or in_range(row.assigned_date)]
    assignment_rows = []
    for assignment in assignments:
        stats = assignment.stats
        assignment_rows.append({
            "id": assignment.id, "title": assignment.title, "course_title": assignment.course.title if assignment.course else None,
            "status": assignment.status, "status_label": assignment.status_label, "due_date": str(assignment.due_date) if assignment.due_date else None,
            **stats})
    relevant_assignments = [row for row in assignments if row.status in ("active", "closed")]
    submissions_by_student = {}
    for row in AssignmentSubmission.objects.filter(assignment__in=relevant_assignments).select_related("assignment"):
        submissions_by_student.setdefault(row.student_id, {})[row.assignment_id] = row

    student_rows = []
    for student in students:
        marks_by_term = {mark.term: mark for mark in student.marks.all()}
        term_average = marks_by_term.get(term).average if term in marks_by_term else None
        term_averages = [marks_by_term[key].average for key in sorted(marks_by_term) if marks_by_term[key].average is not None]
        annual_average = _analytics_avg(term_averages)
        trend = round(term_averages[-1] - term_averages[0], 2) if len(term_averages) >= 2 else None
        student_attendance = [row for row in attendance_records if row.student_id == student.id]
        student_counts = {key: sum(1 for row in student_attendance if row.status == key) for key, _ in AttendanceRecord.STATUSES}
        student_attended = student_counts["present"] + student_counts["late"] + student_counts["left_early"]
        student_rate = round(student_attended * 100 / len(student_attendance), 1) if student_attendance else None
        student_submissions = submissions_by_student.get(student.id, {})
        effective_statuses = []
        scored_percents = []
        for assignment in relevant_assignments:
            submission = student_submissions.get(assignment.id)
            effective_statuses.append(submission.status if submission else "not_submitted")
            if submission and submission.score is not None and assignment.max_score:
                scored_percents.append(submission.score / assignment.max_score * 100)
        submitted = sum(1 for value in effective_statuses if value in ("submitted", "late", "reviewed"))
        excused = sum(1 for value in effective_statuses if value == "excused")
        risk = _student_risk(student, date_from, date_to)
        student_rows.append({
            "student_id": student.id, "student_name": student.full_name,
            "term_average": term_average, "annual_average": annual_average, "trend": trend,
            "attendance_rate": student_rate, "absences": student_counts["absent"], "lates": student_counts["late"],
            "assignment_expected": len(relevant_assignments), "assignment_submitted": submitted,
            "assignment_missing": sum(1 for value in effective_statuses if value == "not_submitted"),
            "assignment_late": sum(1 for value in effective_statuses if value == "late"),
            "assignment_completion": round(submitted * 100 / max(len(relevant_assignments) - excused, 0), 1) if len(relevant_assignments) - excused else 0,
            "assignment_average_percent": _analytics_avg(scored_percents),
            "risk_score": risk["risk_score"], "risk_level": risk["risk_level"], "reasons": risk["reasons"],
            "open_plans": risk["open_plans"],
        })

    assignment_totals = {"expected": 0, "submitted": 0, "missing": 0, "late": 0, "reviewed": 0, "excused": 0}
    for row in assignment_rows:
        if row["status"] in ("active", "closed"):
            for key in assignment_totals: assignment_totals[key] += row[key]
    assignment_denominator = max(assignment_totals["expected"] - assignment_totals["excused"], 0)
    assignment_completion = round(assignment_totals["submitted"] * 100 / assignment_denominator, 1) if assignment_denominator else 0
    assignment_score_percents = []
    for assignment in relevant_assignments:
        for submission in assignment.submissions.all():
            if submission.score is not None and assignment.max_score:
                assignment_score_percents.append(submission.score / assignment.max_score * 100)

    support_plans = SupportPlan.objects.filter(student__school_class=cls)
    communications = ParentCommunication.objects.filter(student__school_class=cls)
    risk_distribution = {level: sum(1 for row in student_rows if row["risk_level"] == level) for level in ("high", "medium", "low")}
    average_risk = _analytics_avg([row["risk_score"] for row in student_rows])

    health_parts = []
    if selected_marks["success_rate"] is not None: health_parts.append((selected_marks["success_rate"], 0.30, "النجاح في الثلاثي"))
    if attendance_rate is not None: health_parts.append((attendance_rate, 0.25, "الحضور"))
    if assignment_totals["expected"]: health_parts.append((assignment_completion, 0.25, "تسليم المهام"))
    if student_rows: health_parts.append((100 - (average_risk or 0), 0.20, "انخفاض المخاطرة"))
    health_score = (round(sum(value * weight for value, weight, _label in health_parts)
                          / sum(weight for _value, weight, _label in health_parts), 1)
                    if health_parts else None)
    health_label = "ممتاز" if health_score is not None and health_score >= 85 else "جيد" if health_score is not None and health_score >= 70 else "يحتاج متابعة" if health_score is not None and health_score >= 50 else "يحتاج تدخلًا" if health_score is not None else "غير متوفر"

    recommendations = []
    components = selected_marks["components"]
    available_components = {key: value for key, value in components.items() if value is not None}
    if available_components:
        weakest = min(available_components, key=available_components.get)
        weakest_label = {"continuous": "التقويم المستمر", "supervised": "الفروض المحروسة", "exam": "الاختبار"}.get(weakest, weakest)
        if available_components[weakest] < 10:
            recommendations.append({"severity": "high", "title": "تركيز على مكوّن ضعيف", "text": f"متوسط {weakest_label} هو الأضعف ({available_components[weakest]}/20)؛ يُنصح بأنشطة استدراكية قصيرة قبل التقييم الموالي."})
    if attendance_rate is not None and attendance_rate < 90:
        recommendations.append({"severity": "high", "title": "تحسين الحضور", "text": f"نسبة حضور الفوج {attendance_rate}٪؛ راجعوا التلاميذ ذوي الغيابات المتكررة وتواصلوا مع أوليائهم."})
    if assignment_totals["expected"] and assignment_completion < 80:
        recommendations.append({"severity": "medium", "title": "رفع تسليم المهام", "text": f"نسبة تسليم المهام {assignment_completion}٪؛ قسّموا المهام الطويلة وحدّدوا آجالًا مرحلية."})
    low_follow = [value for value in follow_summary.values() if value["average"] is not None and value["average"] < 3]
    if low_follow:
        weakest_follow = min(low_follow, key=lambda value: value["average"])
        recommendations.append({"severity": "medium", "title": "متابعة سلوكية/تعلمية", "text": f"متوسط {weakest_follow['label']} منخفض ({weakest_follow['average']}/5)؛ خصّصوا متابعة أسبوعية قصيرة لهذا الجانب."})
    if risk_distribution["high"]:
        recommendations.append({"severity": "high", "title": "خطط دعم عاجلة", "text": f"يوجد {risk_distribution['high']} تلميذًا بمخاطرة عالية؛ راجعوا خطط الدعم المفتوحة وحدّثوا تقدمها."})
    if progress["percent"] < 50:
        recommendations.append({"severity": "medium", "title": "تسريع المحاذاة مع المقرر", "text": f"تقدّم المقرر {progress['percent']}٪؛ الدرس التالي المقترح: {progress['next_course']['title'] if progress['next_course'] else '—'}."})
    if not recommendations:
        recommendations.append({"severity": "low", "title": "مواصلة الإيقاع الحالي", "text": "المؤشرات العامة مستقرة؛ واصلوا التوثيق الدوري للحضور والمهام والمتابعة."})

    sessions = Session.objects.filter(school_class=cls, owner=local_user()).select_related("course")
    if date_from: sessions = sessions.filter(date__gte=date_from)
    if date_to: sessions = sessions.filter(date__lte=date_to)
    recent_sessions = [{"id": row.id, "date": str(row.date), "course_title": row.course.title if row.course else None,
                        "status": row.status, "absentees": row.absentees} for row in sessions.order_by("-date")[:8]]

    return {
        "class": {"id": cls.id, "name": cls.name, "level": cls.level, "students": len(students)},
        "filters": {"term": term, "from": str(date_from) if date_from else None, "to": str(date_to) if date_to else None},
        "health": {"score": health_score, "label": health_label,
                   "components": [{"label": label, "value": value, "weight": weight} for value, weight, label in health_parts]},
        "marks": {"terms": term_stats, "selected": selected_marks, "annual_average": _analytics_avg(annual_values),
                  "annual_graded": len(annual_values), "distribution": distribution},
        "attendance": {"records": len(attendance_records), "recorded_days": len({row.date for row in attendance_records}),
                       "counts": attendance_counts, "attendance_rate": attendance_rate},
        "follow_up": {"total": len(follow_records), "by_category": follow_summary},
        "assignments": {"total": len(assignment_rows), **assignment_totals, "completion_rate": assignment_completion,
                        "average_score_percent": _analytics_avg(assignment_score_percents), "rows": assignment_rows},
        "support": {"plans": support_plans.count(), "open_plans": support_plans.exclude(status__in=["completed", "cancelled"]).count(),
                    "completed_plans": support_plans.filter(status="completed").count(), "communications": communications.count(),
                    "risk_distribution": risk_distribution, "average_risk": average_risk},
        "curriculum": {**progress, "sessions_in_period": sessions.count(), "recent_sessions": recent_sessions},
        "students": student_rows,
        "top_performers": sorted([row for row in student_rows if row["term_average"] is not None], key=lambda row: (-row["term_average"], row["student_name"]))[:6],
        "most_improved": sorted([row for row in student_rows if row["trend"] is not None], key=lambda row: (-row["trend"], row["student_name"]))[:6],
        "needs_support": sorted(student_rows, key=lambda row: (-row["risk_score"], row["student_name"]))[:10],
        "attendance_concerns": sorted([row for row in student_rows if row["absences"] or (row["attendance_rate"] is not None and row["attendance_rate"] < 90)], key=lambda row: (-row["absences"], row["attendance_rate"] if row["attendance_rate"] is not None else 101))[:10],
        "assignment_concerns": sorted([row for row in assignment_rows if row["status"] in ("active", "closed")], key=lambda row: (row["completion_rate"], row["title"]))[:8],
        "recommendations": recommendations,
    }


class ClassAnalyticsView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.query_params.get("term") or 1)
        except ValueError: term = 1
        if term not in (1, 2, 3): term = 1
        return Response(_build_class_analytics(cls, term, _parse_iso_date(request.query_params.get("from")), _parse_iso_date(request.query_params.get("to"))))


class ClassAnalyticsOverviewView(APIView):
    def get(self, request):
        try: term = int(request.query_params.get("term") or 1)
        except ValueError: term = 1
        if term not in (1, 2, 3): term = 1
        rows = []
        for cls in SchoolClass.objects.filter(owner=local_user()).order_by("name"):
            data = _build_class_analytics(cls, term)
            rows.append({
                "class_id": cls.id, "class_name": cls.name, "level": cls.level, "students": data["class"]["students"],
                "term_average": data["marks"]["selected"]["average"], "success_rate": data["marks"]["selected"]["success_rate"],
                "attendance_rate": data["attendance"]["attendance_rate"], "assignment_completion": data["assignments"]["completion_rate"],
                "average_risk": data["support"]["average_risk"], "health_score": data["health"]["score"],
                "curriculum_percent": data["curriculum"]["percent"], "open_support_plans": data["support"]["open_plans"],
            })
        rows.sort(key=lambda row: (-(row["health_score"] if row["health_score"] is not None else -1), row["class_name"]))
        return Response({"term": term, "classes": rows})


def _create_class_analytics_document(cls, data, doc_type="council"):
    profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
    selected = data["marks"]["selected"]
    if doc_type == "bulletin":
        blocks = [
            docs_builder.fields([("المؤسسة", school), ("الفوج", cls.name), ("المستوى", cls.level), ("الثلاثي", selected["label"]), ("الأستاذ(ة)", teacher), ("التاريخ", str(datetime.date.today()))], f"نشرة متابعة فوج — {cls.name}"),
            docs_builder.text(f"أولياء الأمور الكرام، نشارككم صورة عامة عن متابعة فوج {cls.name} خلال {selected['label']}. "
                              f"معدل الفوج: {selected['average'] if selected['average'] is not None else 'غير متوفر بعد'}/20، نسبة النجاح: {selected['success_rate'] if selected['success_rate'] is not None else '—'}٪، "
                              f"نسبة الحضور: {data['attendance']['attendance_rate'] if data['attendance']['attendance_rate'] is not None else '—'}٪، ونسبة تسليم المهام: {data['assignments']['completion_rate']}٪."),
            docs_builder.heading("ما نلاحظه"), docs_builder.checklist([row["text"] for row in data["recommendations"]]),
            docs_builder.heading("كيف يساعد الولي في البيت"), docs_builder.checklist([
                "مراقبة الحضور اليومي وتبرير الغياب عند الحاجة.", "تخصيص وقت ثابت لمراجعة الدروس وإنجاز الواجبات.",
                "الاطلاع على ملاحظات الأستاذ والتواصل عند وجود صعوبة.", "تشجيع التلميذ على المشاركة وطرح الأسئلة داخل القسم."]),
            docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"]),
        ]
        return CustomDocument.objects.create(owner=local_user(), title=f"نشرة أولياء فوج — {cls.name} — {selected['label']}", kind="parent-letter",
            orientation="portrait", content={"blocks": blocks}, tags=["تحليلات الفوج", "نشرة أولياء", cls.name], source_type="class-analytics", source_id=cls.id)

    top_rows = [[str(i + 1), row["student_name"], str(row["term_average"]), str(row["annual_average"] if row["annual_average"] is not None else "—"), f"{row['assignment_completion']}٪"] for i, row in enumerate(data["top_performers"])]
    support_rows = [[row["student_name"], f"{row['risk_score']}/100", str(row["annual_average"] if row["annual_average"] is not None else "—"), str(row["absences"]), str(row["assignment_missing"]), "؛ ".join(row["reasons"][:3])] for row in data["needs_support"] if row["risk_score"] > 0]
    assignment_rows = [[row["title"], row["status_label"], f"{row['completion_rate']}٪", str(row["missing"]), str(row["late"]), str(row["average_score_percent"] if row["average_score_percent"] is not None else "—")] for row in data["assignment_concerns"]]
    dist_rows = [[row["label"], str(row["count"]), f"{row['percent']}٪"] for row in data["marks"]["distribution"]]
    blocks = [
        docs_builder.fields([("الفوج", cls.name), ("المستوى", cls.level), ("عدد التلاميذ", str(data["class"]["students"])), ("الثلاثي", selected["label"]),
                             ("مؤشر صحة الفوج", f"{data['health']['score']} — {data['health']['label']}" if data["health"]["score"] is not None else "—"),
                             ("الأستاذ(ة)", teacher), ("المؤسسة", school), ("التاريخ", str(datetime.date.today()))], f"تقرير مجلس/متابعة فوج — {cls.name}"),
        docs_builder.table(["المؤشر", "القيمة"], [
            ["معدل الثلاثي", str(selected["average"] if selected["average"] is not None else "—")], ["نسبة النجاح", f"{selected['success_rate']}٪" if selected["success_rate"] is not None else "—"],
            ["نسبة الحضور", f"{data['attendance']['attendance_rate']}٪" if data["attendance"]["attendance_rate"] is not None else "—"],
            ["نسبة تسليم المهام", f"{data['assignments']['completion_rate']}٪"], ["تقدم المقرر", f"{data['curriculum']['percent']}٪"],
            ["متوسط المخاطرة", str(data["support"]["average_risk"] if data["support"]["average_risk"] is not None else "—")]], "مؤشرات عامة"),
        docs_builder.table(["شريحة المعدلات", "العدد", "النسبة"], dist_rows, "توزيع معدلات الثلاثي"),
        docs_builder.table(["#", "التلميذ", "معدل الثلاثي", "المعدل السنوي", "تسليم المهام"], top_rows, "أوائل الفوج في الثلاثي المحدد"),
    ]
    if support_rows: blocks.append(docs_builder.table(["التلميذ", "المخاطرة", "المعدل السنوي", "غيابات", "مهام مفقودة", "أسباب المتابعة"], support_rows, "تلاميذ يحتاجون متابعة"))
    if assignment_rows: blocks.append(docs_builder.table(["المهمة", "الحالة", "الإنجاز", "غير المسلّم", "متأخر", "متوسط النقاط ٪"], assignment_rows, "مهام تحتاج متابعة"))
    blocks.append(docs_builder.checklist([f"{row['title']}: {row['text']}" for row in data["recommendations"]], "توصيات وقرارات مقترحة"))
    blocks.append(docs_builder.signatures(["الأستاذ(ة)", "مستشار التوجيه", "إدارة المؤسسة"]))
    return CustomDocument.objects.create(owner=local_user(), title=f"تقرير تحليلات فوج — {cls.name} — {selected['label']}", kind="report-card",
        orientation="landscape", content={"blocks": blocks}, tags=["تحليلات الفوج", "تقرير ثلاثي", cls.name], source_type="class-analytics", source_id=cls.id)


class ClassAnalyticsReportView(APIView):
    def post(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.data.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        data = _build_class_analytics(cls, term, _parse_iso_date(request.data.get("from")), _parse_iso_date(request.data.get("to")))
        doc = _create_class_analytics_document(cls, data, request.data.get("type") or "council")
        return Response(CustomDocumentSerializer(doc).data, status=201)


# ------------------------------------------------------------------ term pack / closing centre
TERM_PACK_LABELS = {1: "الثلاثي الأول", 2: "الثلاثي الثاني", 3: "الثلاثي الثالث"}


def _term_pack_documents(cls, term):
    """All documents already generated for this class + term pack."""
    term_label = TERM_PACK_LABELS[term]
    student_ids = set(cls.students.values_list("id", flat=True))
    docs = []
    for doc in CustomDocument.objects.filter(owner=local_user()).filter(source_type__in=["term-pack", "class-analytics"]).order_by("-updated_at"):
        if term_label not in (doc.tags or []):
            continue
        if doc.source_type == "term-pack" and (doc.source_id in student_ids or doc.source_id == cls.id):
            docs.append(doc)
        elif doc.source_type == "class-analytics" and doc.source_id == cls.id:
            docs.append(doc)
    return docs


def _build_term_pack(cls, term=1, date_from=None, date_to=None):
    data = _build_class_analytics(cls, term, date_from, date_to)
    term_label = TERM_PACK_LABELS[term]
    students = data["students"]
    total = len(students)
    docs = _term_pack_documents(cls, term)
    report_docs = {}
    for doc in docs:
        if doc.source_type == "term-pack" and doc.title.startswith("كشف متابعة"):
            report_docs.setdefault(doc.source_id, doc)

    ranked = sorted([row for row in students if row["term_average"] is not None],
                    key=lambda row: (-row["term_average"], row["student_name"]))
    ranks = {row["student_id"]: index + 1 for index, row in enumerate(ranked)}
    student_rows = []
    for row in students:
        doc = report_docs.get(row["student_id"])
        student_rows.append({**row, "rank": ranks.get(row["student_id"]),
                             "has_report": doc is not None,
                             "report_document_id": doc.id if doc else None})

    selected = data["marks"]["selected"]
    missing_marks = [row["student_name"] for row in students if row["term_average"] is None]
    without_attendance = [row["student_name"] for row in students if row["attendance_rate"] is None]
    open_tasks = TeacherTask.objects.filter(owner=local_user(), school_class=cls, status__in=["pending", "in_progress"])
    overdue_tasks = open_tasks.filter(due_date__lt=datetime.date.today()).count()
    tasks_component = 100 if not open_tasks.count() else max(0, 100 - 10 * open_tasks.count() - 15 * overdue_tasks)
    marks_component = round(selected["graded"] * 100 / total, 1) if total else 0
    attendance_component = round((total - len(without_attendance)) * 100 / total, 1) if total else 0
    assignments_component = data["assignments"]["completion_rate"] if data["assignments"]["expected"] else 100
    components = [
        {"key": "marks", "label": "اكتمال نقاط الثلاثي", "value": marks_component, "weight": 0.40},
        {"key": "attendance", "label": "تغطية سجلات الحضور", "value": attendance_component, "weight": 0.20},
        {"key": "assignments", "label": "تسليم المهام والواجبات", "value": assignments_component, "weight": 0.25},
        {"key": "tasks", "label": "خلوّ مركز الإجراءات", "value": tasks_component, "weight": 0.15},
    ]
    score = round(sum(row["value"] * row["weight"] for row in components), 1) if total else 0
    label = "جاهز للإغلاق" if score >= 85 else "شبه جاهز" if score >= 65 else "يحتاج استكمالًا" if score >= 40 else "غير جاهز بعد"

    def check(key, label_text, status, value, detail, route):
        return {"key": key, "label": label_text, "status": status, "value": value, "detail": detail, "route": route}

    checks = [
        check("marks", "نقاط الثلاثي مكتملة", "ok" if not missing_marks else "missing",
              f"{selected['graded']}/{total}", "لا توجد نقاط ناقصة." if not missing_marks else "تلاميذ بدون معدل ثلاثي: " + "، ".join(missing_marks[:8]), "/students"),
        check("attendance", "سجلات حضور موثقة", "ok" if not without_attendance else "warning",
              f"{data['attendance']['recorded_days']} يوم / {data['attendance']['records']} سجل",
              "كل التلاميذ لديهم سجلات حضور." if not without_attendance else "تلاميذ بلا أي سجل حضور: " + "، ".join(without_attendance[:8]), "/follow-up"),
        check("assignments", "المهام والواجبات مغلقة", "ok" if not data["assignments"]["expected"] or data["assignments"]["completion_rate"] >= 90 else "warning" if data["assignments"]["completion_rate"] >= 60 else "missing",
              f"{data['assignments']['completion_rate']}٪", f"{data['assignments']['missing']} تسليم مفقود من أصل {data['assignments']['expected']} متوقع." if data["assignments"]["expected"] else "لا مهام مسجلة لهذا الفوج.", "/assignments"),
        check("support", "خطط الدعم محيّنة", "ok" if not data["support"]["open_plans"] else "warning",
              str(data["support"]["open_plans"]), "لا خطط دعم مفتوحة." if not data["support"]["open_plans"] else "راجعوا تقدم خطط الدعم المفتوحة وحدّثوا حالتها قبل الإغلاق.", "/support"),
        check("tasks", "مهام إجرائية مفتوحة", "ok" if not open_tasks.count() else "warning",
              str(open_tasks.count()), "لا مهام مفتوحة مرتبطة بهذا الفوج." if not open_tasks.count() else f"{overdue_tasks} مهمة متأخرة من أصل {open_tasks.count()} مفتوحة.", "/actions"),
        check("curriculum", "تقدم المقرر الدراسي", "ok" if data["curriculum"]["percent"] >= 50 else "warning",
              f"{data['curriculum']['percent']}٪", f"أُنجز {data['curriculum']['done_count']} من {data['curriculum']['total_courses']} دروسًا؛ التالي: {data['curriculum']['next_course']['title'] if data['curriculum']['next_course'] else '—'}.", "/courses"),
        check("reports", "كشوف المتابعة مولّدة", "ok" if total and len(report_docs) >= total else "warning",
              f"{len(report_docs)}/{total}", "وُلّدت كشوف كل التلاميذ لهذا الثلاثي." if total and len(report_docs) >= total else "يمكن توليد الكشوف الناقصة من زر توليد الباقة أسفله.", "/reports"),
    ]
    return {
        "class": data["class"], "term": term, "term_label": term_label,
        "filters": data["filters"],
        "readiness": {"score": score, "label": label, "components": components, "checks": checks},
        "summary": {"term_average": selected["average"], "success_rate": selected["success_rate"],
                    "graded": selected["graded"], "attendance_rate": data["attendance"]["attendance_rate"],
                    "assignment_completion": data["assignments"]["completion_rate"],
                    "health_score": data["health"]["score"], "health_label": data["health"]["label"],
                    "average_risk": data["support"]["average_risk"], "curriculum_percent": data["curriculum"]["percent"]},
        "students": student_rows,
        "generated_reports": len(report_docs),
        "existing_documents": [{"id": doc.id, "title": doc.title, "kind": doc.kind, "kind_label": doc.get_kind_display() if hasattr(doc, "get_kind_display") else doc.kind,
                                "source_type": doc.source_type, "updated_at": doc.updated_at.isoformat()} for doc in docs[:40]],
    }


class TermPackView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.query_params.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        return Response(_build_term_pack(cls, term, _parse_iso_date(request.query_params.get("from")), _parse_iso_date(request.query_params.get("to"))))


class TermPacksOverviewView(APIView):
    def get(self, request):
        try: term = int(request.query_params.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        rows = []
        for cls in SchoolClass.objects.filter(owner=local_user()).order_by("name"):
            pack = _build_term_pack(cls, term)
            rows.append({"class": pack["class"], "term": term, "term_label": pack["term_label"],
                         "readiness_score": pack["readiness"]["score"], "readiness_label": pack["readiness"]["label"],
                         "term_average": pack["summary"]["term_average"], "success_rate": pack["summary"]["success_rate"],
                         "graded": pack["summary"]["graded"], "generated_reports": pack["generated_reports"],
                         "open_checks": sum(1 for row in pack["readiness"]["checks"] if row["status"] != "ok")})
        return Response({"term": term, "term_label": TERM_PACK_LABELS[term], "classes": rows})


class TermPackGenerateView(APIView):
    def post(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.data.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        include = request.data.get("include") or ["reports", "certificates", "council", "bulletin"]
        skip_existing = request.data.get("skip_existing", True) not in (False, "false", "0")
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        term_label = TERM_PACK_LABELS[term]
        pack = _build_term_pack(cls, term)
        created, skipped = [], []

        def light(doc):
            return {"id": doc.id, "title": doc.title, "kind": doc.kind}

        if "reports" in include:
            students = list(cls.students.prefetch_related("marks").order_by("full_name"))
            rows_by_id = {row["student_id"]: row for row in pack["students"]}
            existing = {doc.source_id: doc for doc in _term_pack_documents(cls, term)
                        if doc.source_type == "term-pack" and doc.title.startswith("كشف متابعة")}
            for student in students:
                if skip_existing and student.id in existing:
                    skipped.append({"type": "report", "name": student.full_name, "reason": "الكشف مولّد سابقًا"})
                    continue
                row = rows_by_id.get(student.id, {})
                marks_by_term = {mark.term: mark for mark in student.marks.all()}
                mark_rows = [[TERM_PACK_LABELS[t],
                              str(marks_by_term[t].continuous if t in marks_by_term and marks_by_term[t].continuous is not None else "—"),
                              str(marks_by_term[t].supervised if t in marks_by_term and marks_by_term[t].supervised is not None else "—"),
                              str(marks_by_term[t].exam if t in marks_by_term and marks_by_term[t].exam is not None else "—"),
                              str(marks_by_term[t].average if t in marks_by_term and marks_by_term[t].average is not None else "—")] for t in (1, 2, 3)]
                advice = []
                if row.get("assignment_missing"): advice.append(f"استكمال {row['assignment_missing']} مهمة/مهام غير مسلّمة ومتابعتها مع الأستاذ.")
                if row.get("absences"): advice.append(f"تقليص الغيابات ({row['absences']}) وتبريرها عند الاقتضاء بالتنسيق مع الولي.")
                if row.get("term_average") is not None and row["term_average"] < 10: advice.append("إدراج التلميذ في خطة دعم قصيرة مع مراجعة أسبوعية وتتبع للتقدم.")
                if row.get("risk_score", 0) >= 50: advice.append("فتح أو تحيين خطة دعم فردية والتواصل مع الولي خلال هذا الثلاثي.")
                if not advice: advice.append("مواصلة العمل المنتظم ومراجعة الدروس أولًا بأول للحفاظ على المستوى.")
                blocks = [
                    docs_builder.fields([("التلميذ(ة)", student.full_name), ("القسم", cls.name), ("المستوى", cls.level), ("الثلاثي", term_label),
                                         ("معدل الثلاثي", str(row.get("term_average") if row.get("term_average") is not None else "—")),
                                         ("المعدل السنوي", str(row.get("annual_average") if row.get("annual_average") is not None else "—")),
                                         ("الترتيب في الفوج", str(row.get("rank") or "—")),
                                         ("نسبة الحضور", f"{row['attendance_rate']}٪" if row.get("attendance_rate") is not None else "—"),
                                         ("نسبة تسليم المهام", f"{row.get('assignment_completion', 0)}٪"),
                                         ("درجة المخاطرة", f"{row.get('risk_score', 0)}/100"),
                                         ("الأستاذ(ة)", teacher), ("المؤسسة", school)], f"كشف متابعة {term_label} — {student.full_name}"),
                    docs_builder.table(["الثلاثي", "التقويم المستمر", "الفروض المحروسة", "الاختبار", "المعدل"], mark_rows, "النقاط والمعدلات"),
                ]
                if row.get("reasons"): blocks.append(docs_builder.checklist(row["reasons"], "مؤشرات تحتاج متابعة"))
                blocks.append(docs_builder.checklist(advice, "توصيات وإجراءات مقترحة"))
                blocks.append(docs_builder.signatures(["الأستاذ(ة)", "ولي التلميذ (اطّلع ووقّع)", "إدارة المؤسسة"]))
                doc = CustomDocument.objects.create(owner=local_user(), title=f"كشف متابعة {term_label} — {student.full_name} — {cls.name}",
                    kind="report-card", orientation="portrait", content={"blocks": blocks},
                    tags=["باقة الثلاثي", term_label, cls.name], source_type="term-pack", source_id=student.id)
                created.append({"type": "report", **light(doc)})

        if "certificates" in include:
            mode = request.data.get("certificate_mode") or "threshold"
            scored = sorted([(row["term_average"], row["student_name"]) for row in pack["students"] if row["term_average"] is not None],
                            key=lambda item: (-item[0], item[1]))
            if mode == "top":
                try: top_n = max(1, int(request.data.get("top_n") or 3))
                except (TypeError, ValueError): top_n = 3
                chosen = scored[:top_n]
            else:
                try: minimum = float(request.data.get("min_average") or 14)
                except (TypeError, ValueError): minimum = 14
                chosen = [item for item in scored if item[0] >= minimum]
            cert_title = f"شهادات المتفوقين — {cls.name} ({term_label})"
            if not chosen:
                skipped.append({"type": "certificates", "name": cls.name, "reason": "لا تلميذ مطابق لمعيار التكريم"})
            elif skip_existing and CustomDocument.objects.filter(owner=local_user(), source_type="term-pack", source_id=cls.id, title=cert_title).exists():
                skipped.append({"type": "certificates", "name": cls.name, "reason": "شهادات هذا الثلاثي مولّدة سابقًا"})
            else:
                blocks = [{"type": "certificates", "title": "شهادة تقدير وتفوق",
                           "text": f"تقديرًا للتفوق في مادة الإعلام الآلي خلال {term_label} بقسم {cls.name}، مع تمنياتنا بمزيد من النجاح والتميز.",
                           "names": [name for _avg, name in chosen], "signer": teacher or "الأستاذ(ة)", "date": str(datetime.date.today())}]
                doc = CustomDocument.objects.create(owner=local_user(), title=cert_title, kind="certificate",
                    orientation="landscape", content={"blocks": blocks}, tags=["باقة الثلاثي", term_label, cls.name],
                    source_type="term-pack", source_id=cls.id)
                created.append({"type": "certificates", **light(doc)})

        data = _build_class_analytics(cls, term)
        for doc_type, key in (("council", "council"), ("bulletin", "bulletin")):
            if key not in include: continue
            title_prefix = "تقرير تحليلات فوج" if doc_type == "council" else "نشرة أولياء فوج"
            expected_title = f"{title_prefix} — {cls.name} — {term_label}"
            if skip_existing and CustomDocument.objects.filter(owner=local_user(), source_type="class-analytics", source_id=cls.id, title=expected_title).exists():
                skipped.append({"type": doc_type, "name": cls.name, "reason": "الوثيقة مولّدة سابقًا لهذا الثلاثي"})
                continue
            doc = _create_class_analytics_document(cls, data, doc_type)
            created.append({"type": doc_type, **light(doc)})

        return Response({"created": created, "skipped": skipped,
                         "created_count": len(created), "skipped_count": len(skipped),
                         "pack": _build_term_pack(cls, term)}, status=201)



# ------------------------------------------------------------------ inspection readiness & professional portfolio
def _build_portfolio(term=1):
    user = local_user()
    profile = _profile()
    classes = list(SchoolClass.objects.filter(owner=user).order_by("name"))
    courses = list(Course.objects.filter(owner=user).order_by("order", "id"))
    sessions = list(Session.objects.filter(owner=user).select_related("school_class", "course", "lesson_plan"))
    done_sessions = [row for row in sessions if row.status == "done"]
    lesson_plans = LessonPlan.objects.filter(owner=user)
    planned_course_ids = set(lesson_plans.exclude(course__isnull=True).values_list("course_id", flat=True))
    taught_course_ids = {row.course_id for row in done_sessions if row.course_id}
    plan_coverage = round(len(taught_course_ids & planned_course_ids) * 100 / len(taught_course_ids), 1) if taught_course_ids else 0
    documented = sum(1 for row in done_sessions if row.points_written or row.board_summary or row.homework or row.remarks)
    sessions_documented = round(documented * 100 / len(done_sessions), 1) if done_sessions else 0

    students_total = Student.objects.filter(school_class__in=classes).count() if classes else 0
    graded_students = Mark.objects.filter(student__school_class__in=classes).values("student").distinct().count() if classes else 0
    attendance_students = AttendanceRecord.objects.filter(student__school_class__in=classes).values("student").distinct().count() if classes else 0
    gradebook_coverage = round(graded_students * 100 / students_total, 1) if students_total else 0
    attendance_coverage = round(attendance_students * 100 / students_total, 1) if students_total else 0

    profile_values = [profile.full_name, profile.current_school, profile.specialty, profile.job_title,
                      profile.diploma, profile.hire_date, profile.inspection_district, profile.echelon]
    profile_percent = round(sum(1 for value in profile_values if value) * 100 / len(profile_values), 1)

    journals = list(Journal.objects.filter(owner=user).order_by("-updated_at"))
    seminars = list(Seminar.objects.filter(owner=user).order_by("date"))
    visits = list(Visit.objects.filter(owner=user).select_related("institution").order_by("-date"))
    observations = list(Observation.objects.filter(owner=user).order_by("-date"))
    documents = CustomDocument.objects.filter(owner=user)
    training_component = min(100, len(seminars) * 34)

    components = [
        {"key": "profile", "label": "اكتمال البطاقة المهنية", "value": profile_percent, "weight": 0.15},
        {"key": "lesson_plans", "label": "تغطية خطط الدروس المنفذة", "value": plan_coverage, "weight": 0.25},
        {"key": "sessions", "label": "توثيق سجل الحصص", "value": sessions_documented, "weight": 0.20},
        {"key": "gradebook", "label": "تغطية دفتر التنقيط", "value": gradebook_coverage, "weight": 0.20},
        {"key": "attendance", "label": "توثيق حضور التلاميذ", "value": attendance_coverage, "weight": 0.10},
        {"key": "training", "label": "التكوين والندوات الموثقة", "value": training_component, "weight": 0.10},
    ]
    score = round(sum(row["value"] * row["weight"] for row in components), 1)
    label = "جاهزية عالية" if score >= 85 else "جاهزية جيدة" if score >= 65 else "تحتاج تحضيرًا" if score >= 40 else "تحتاج عملًا كبيرًا"

    def check(key, label_text, status, value, detail, route):
        return {"key": key, "label": label_text, "status": status, "value": value, "detail": detail, "route": route}

    checks = [
        check("profile", "البطاقة المهنية مكتملة", "ok" if profile_percent >= 80 else "warning" if profile_percent >= 50 else "missing",
              f"{profile_percent}٪", "الاسم والمؤسسة والتخصص والشهادة ومقاطعة التفتيش موثقة." if profile_percent >= 80 else "أكملوا الاسم الكامل، المؤسسة الحالية، الشهادة، تاريخ التوظيف، الدرجة ومقاطعة التفتيش.", "/profile"),
        check("journals", "الدفاتر اليومية محيّنة", "ok" if journals else "missing",
              str(len(journals)), f"آخر تحيين: {journals[0].updated_at.date()} — {journals[0].title}" if journals else "لا دفتر يومي منشأ بعد.", "/journals"),
        check("lesson_plans", "خطط دروس للدروس المنفذة", "ok" if plan_coverage >= 80 else "warning" if plan_coverage >= 40 else "missing",
              f"{plan_coverage}٪", f"{len(taught_course_ids & planned_course_ids)} من {len(taught_course_ids)} درسًا منفذًا له خطة درس مرتبطة.", "/lesson-plans"),
        check("sessions", "سجل الحصص موثق", "ok" if sessions_documented >= 70 else "warning" if done_sessions else "missing",
              f"{len(done_sessions)} حصة", f"{documented} حصة موثقة بالنقاط المكتوبة أو ملخص السبورة أو الواجب.", "/sessions"),
        check("gradebook", "دفتر التنقيط محيّن", "ok" if gradebook_coverage >= 80 else "warning" if gradebook_coverage >= 40 else "missing",
              f"{graded_students}/{students_total}", "تلاميذ لهم نقاط مسجلة في دفتر التنقيط.", "/students"),
        check("attendance", "حضور التلاميذ موثق", "ok" if attendance_coverage >= 50 else "warning" if attendance_coverage else "missing",
              f"{attendance_coverage}٪", "نسبة التلاميذ الذين لديهم سجل حضور فعلي واحد على الأقل.", "/follow-up"),
        check("training", "التكوين المستمر موثق", "ok" if len(seminars) >= 2 else "warning" if seminars else "missing",
              str(len(seminars)), "ندوات وأيام تكوينية وملتقيات مسجلة في المنصة.", "/calendar"),
        check("visits", "زيارات التفتيش والمتابعة موثقة", "ok" if visits else "warning",
              str(len(visits)), f"آخر زيارة موثقة: {visits[0].date} ({visits[0].visit_type})." if visits else "وثّقوا الزيارات السابقة وملاحظاتها وتوصياتها لتتبع التحسين.", "/inspection"),
        check("documents", "مكتبة وثائق غنية", "ok" if documents.count() >= 5 else "warning",
              str(documents.count()), "وثائق قابلة للتحرير في استوديو الإنشاء (تقارير، كشوف، شهادات…).", "/creator"),
    ]

    class_rows = []
    for cls in classes:
        analytics = _build_class_analytics(cls, term)
        progress = class_progress(cls, courses)
        class_rows.append({
            "id": cls.id, "name": cls.name, "level": cls.level, "students": analytics["class"]["students"],
            "curriculum_percent": progress["percent"], "done_courses": progress["done_count"], "total_courses": progress["total_courses"],
            "next_course": progress["next_course"]["title"] if progress["next_course"] else None,
            "term_average": analytics["marks"]["selected"]["average"], "success_rate": analytics["marks"]["selected"]["success_rate"],
            "attendance_rate": analytics["attendance"]["attendance_rate"], "health_score": analytics["health"]["score"],
            "sessions_done": len([row for row in done_sessions if row.school_class_id == cls.id]),
        })

    kind_labels = dict(CustomDocument.KINDS)
    by_kind = {}
    for doc in documents:
        by_kind[doc.kind] = by_kind.get(doc.kind, 0) + 1
    portfolio_docs = [{"id": doc.id, "title": doc.title, "updated_at": doc.updated_at.isoformat()}
                      for doc in documents.filter(source_type="inspection-portfolio")[:10]]

    return {
        "term": term, "term_label": TERM_PACK_LABELS[term],
        "profile": {"full_name": profile.full_name, "job_title": profile.job_title, "specialty": profile.specialty,
                    "diploma": profile.diploma, "hire_date": str(profile.hire_date) if profile.hire_date else None,
                    "current_school": profile.current_school, "inspection_district": profile.inspection_district,
                    "echelon": profile.echelon, "phone": profile.phone, "percent": profile_percent},
        "readiness": {"score": score, "label": label, "components": components, "checks": checks},
        "classes": class_rows,
        "recent_sessions": [{"id": row.id, "date": str(row.date), "class_name": row.school_class.name if row.school_class else "",
                             "course_title": row.course.title if row.course else None,
                             "has_lesson_plan": bool(row.lesson_plan_id), "homework": row.homework}
                            for row in sorted(done_sessions, key=lambda item: item.date, reverse=True)[:10]],
        "training": [{"id": row.id, "date": str(row.date), "title": row.title, "kind": row.kind, "place": row.place, "organizer": row.organizer} for row in seminars],
        "visits": [{"id": row.id, "date": str(row.date), "visit_type": row.visit_type,
                    "institution": row.institution.name if row.institution else "", "teacher_visited": row.teacher_visited,
                    "observations": row.observations, "recommendations": row.recommendations} for row in visits[:10]],
        "observations": [{"id": row.id, "date": str(row.date), "teacher_name": row.teacher_name, "class_name": row.class_name,
                          "percent": row.percent, "appreciation": row.appreciation} for row in observations[:10]],
        "documents_summary": {"total": documents.count(),
                              "by_kind": [{"kind": key, "label": kind_labels.get(key, key), "count": value}
                                          for key, value in sorted(by_kind.items(), key=lambda item: -item[1])[:8]]},
        "totals": {"classes": len(classes), "students": students_total, "sessions_done": len(done_sessions),
                   "lesson_plans": lesson_plans.count(), "notebooks": NoteBook.objects.filter(owner=user).count(),
                   "documents": documents.count(), "seminars": len(seminars), "visits": len(visits)},
        "existing_portfolios": portfolio_docs,
    }


class PortfolioView(APIView):
    def get(self, request):
        try: term = int(request.query_params.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        return Response(_build_portfolio(term))


class PortfolioGenerateView(APIView):
    def post(self, request):
        try: term = int(request.data.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        data = _build_portfolio(term)
        profile = data["profile"]
        readiness = data["readiness"]
        class_rows = [[row["name"], str(row["students"]), f"{row['curriculum_percent']}٪",
                       str(row["term_average"] if row["term_average"] is not None else "—"),
                       f"{row['success_rate']}٪" if row["success_rate"] is not None else "—",
                       f"{row['attendance_rate']}٪" if row["attendance_rate"] is not None else "—",
                       str(row["health_score"] if row["health_score"] is not None else "—")] for row in data["classes"]]
        session_rows = [[row["date"], row["class_name"], row["course_title"] or "—",
                         "نعم" if row["has_lesson_plan"] else "لا", row["homework"] or "—"] for row in data["recent_sessions"]]
        training_rows = [[row["date"], row["title"], row["kind"], row["place"] or "—", row["organizer"] or "—"] for row in data["training"]]
        visit_rows = [[row["date"], row["visit_type"], row["institution"] or "—", (row["recommendations"] or "—")[:90]] for row in data["visits"]]
        strengths = [row["detail"] for row in readiness["checks"] if row["status"] == "ok"]
        improvements = [f"{row['label']}: {row['detail']}" for row in readiness["checks"] if row["status"] != "ok"]
        blocks = [
            docs_builder.cover("ملف التفتيش والجاهزية المهنية", f"مادة {profile['specialty'] or 'الإعلام الآلي'} — {data['term_label']}",
                               [f"الأستاذ(ة): {profile['full_name'] or '—'}", f"المؤسسة: {profile['current_school'] or '—'}",
                                f"مقاطعة التفتيش: {profile['inspection_district'] or '—'}", f"تاريخ الإعداد: {datetime.date.today()}"]),
            docs_builder.fields([("الاسم الكامل", profile["full_name"] or "—"), ("الوظيفة", profile["job_title"] or "—"),
                                 ("التخصص", profile["specialty"] or "—"), ("الشهادة", profile["diploma"] or "—"),
                                 ("تاريخ التوظيف", profile["hire_date"] or "—"), ("الدرجة / الصنف", profile["echelon"] or "—"),
                                 ("المؤسسة الحالية", profile["current_school"] or "—"), ("مقاطعة التفتيش", profile["inspection_district"] or "—"),
                                 ("الهاتف", profile["phone"] or "—")], "البطاقة المهنية"),
            docs_builder.fields([("مؤشر الجاهزية", f"{readiness['score']}٪ — {readiness['label']}"),
                                 ("عدد الأفواج", str(data["totals"]["classes"])), ("عدد التلاميذ", str(data["totals"]["students"])),
                                 ("حصص منفذة موثقة", str(data["totals"]["sessions_done"])), ("خطط دروس", str(data["totals"]["lesson_plans"])),
                                 ("وثائق الاستوديو", str(data["totals"]["documents"])), ("أنشطة تكوينية", str(data["totals"]["seminars"])),
                                 ("زيارات موثقة", str(data["totals"]["visits"]))], "مؤشرات عامة"),
            docs_builder.table(["الفوج", "التلاميذ", "تقدم المقرر", "معدل الثلاثي", "النجاح", "الحضور", "صحة الفوج"], class_rows, f"الأفواج ومؤشرات {data['term_label']}"),
        ]
        if session_rows: blocks.append(docs_builder.table(["التاريخ", "الفوج", "الدرس", "خطة درس", "الواجب"], session_rows, "أحدث الحصص المنفذة"))
        if training_rows: blocks.append(docs_builder.table(["التاريخ", "النشاط", "النوع", "المكان", "الجهة المنظمة"], training_rows, "التكوين والندوات والملتقيات"))
        if visit_rows: blocks.append(docs_builder.table(["التاريخ", "نوع الزيارة", "المؤسسة", "التوصيات"], visit_rows, "زيارات التفتيش والمتابعة"))
        if strengths: blocks.append(docs_builder.checklist(strengths, "نقاط قوة موثقة"))
        if improvements: blocks.append(docs_builder.checklist(improvements, "نقاط تحتاج تحسينًا قبل الزيارة"))
        blocks.append(docs_builder.checklist([
            "الدفتر اليومي ودفتر التحضير محيّنان وموقّعان.", "دفتر التنقيط مكتمل لكل الأفواج.",
            "خطط الدروس جاهزة للطباعة عند الطلب.", "كشوف وتقارير الثلاثي مولّدة من مركز تقارير الثلاثي.",
            "سجل الندوات والتكوين وزيارات المتابعة مرفق بهذا الملف."], "وثائق تُرفق عادة بملف التفتيش"))
        blocks.append(docs_builder.signatures(["الأستاذ(ة)", "مفتش المادة", "إدارة المؤسسة"]))
        doc = CustomDocument.objects.create(owner=local_user(), title=f"ملف التفتيش والجاهزية المهنية — {data['term_label']}",
            kind="report-card", orientation="portrait", content={"blocks": blocks},
            tags=["ملف التفتيش", "جاهزية مهنية", data["term_label"]], source_type="inspection-portfolio")
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ backup, integrity & school-year rollover
def _backup_querysets(user):
    """All user-owned data, ordered so foreign-key targets come first."""
    return [
        TeacherProfile.objects.filter(user=user),
        Journal.objects.filter(owner=user),
        NoteBook.objects.filter(owner=user),
        SchoolClass.objects.filter(owner=user),
        TimetableSlot.objects.filter(school_class__owner=user),
        Course.objects.filter(owner=user),
        LessonPlan.objects.filter(owner=user),
        NoteEntry.objects.filter(notebook__owner=user),
        Session.objects.filter(owner=user),
        Student.objects.filter(school_class__owner=user),
        Mark.objects.filter(student__school_class__owner=user),
        Holiday.objects.filter(owner=user),
        Seminar.objects.filter(owner=user),
        Institution.objects.filter(owner=user),
        Visit.objects.filter(owner=user),
        Observation.objects.filter(owner=user),
        CustomDocument.objects.filter(owner=user),
        DocumentRevision.objects.filter(document__owner=user),
        QuestionBankItem.objects.filter(owner=user),
        AttendanceRecord.objects.filter(student__school_class__owner=user),
        StudentFollowUpRecord.objects.filter(student__school_class__owner=user),
        SupportPlan.objects.filter(student__school_class__owner=user),
        ParentCommunication.objects.filter(student__school_class__owner=user),
        Assignment.objects.filter(school_class__owner=user),
        AssignmentSubmission.objects.filter(assignment__school_class__owner=user),
        TeacherTask.objects.filter(owner=user),
    ]


class BackupInfoView(APIView):
    def get(self, request):
        user = local_user()
        classes = list(SchoolClass.objects.filter(owner=user).order_by("name"))
        counts = {}
        for qs in _backup_querysets(user):
            counts[qs.model._meta.label.split(".")[-1]] = qs.count()
        try:
            from django.conf import settings as dj_settings
            db_path = dj_settings.DATABASES["default"].get("NAME")
            db_size = os.path.getsize(db_path) if db_path and os.path.exists(db_path) else None
        except Exception:
            db_size = None

        done_sessions = Session.objects.filter(owner=user, status="done")
        students = Student.objects.filter(school_class__owner=user)
        graded_ids = set(Mark.objects.filter(student__school_class__owner=user).values_list("student_id", flat=True))
        empty_docs = sum(1 for doc in CustomDocument.objects.filter(owner=user) if not (doc.content or {}).get("blocks"))
        assignments_no_sub = [row for row in Assignment.objects.filter(school_class__owner=user).exclude(status="archived")
                              if not row.submissions.exists()]

        def check(key, label_text, status, value, detail, route):
            return {"key": key, "label": label_text, "status": status, "value": value, "detail": detail, "route": route}

        checks = [
            check("sessions_course", "حصص منفذة مرتبطة بدرس", "ok" if not done_sessions.filter(course__isnull=True).count() else "warning",
                  str(done_sessions.filter(course__isnull=True).count()), "حصص منفذة دون درس مرتبط في المقرر.", "/sessions"),
            check("sessions_plan", "حصص مرتبطة بخطة درس", "ok" if not done_sessions.filter(lesson_plan__isnull=True).count() else "warning",
                  str(done_sessions.filter(lesson_plan__isnull=True).count()), "حصص منفذة دون خطة درس مرتبطة مباشرة.", "/lesson-plans"),
            check("students_marks", "تلاميذ لديهم نقاط", "ok" if students.count() == len(graded_ids) else "warning",
                  f"{len(graded_ids)}/{students.count()}", "تلاميذ دون أي نقطة مسجلة في دفتر التنقيط.", "/students"),
            check("classes_slots", "أفواج لها توقيت أسبوعي", "ok" if not [c for c in classes if not c.slots.exists()] else "warning",
                  str(len([c for c in classes if not c.slots.exists()])), "أفواج دون حصص أسبوعية في جدول التوقيت.", "/classes"),
            check("documents_empty", "وثائق غير فارغة", "ok" if not empty_docs else "warning",
                  str(empty_docs), "وثائق في الاستوديو دون أي كتل محتوى.", "/creator"),
            check("assignments_sub", "مهام لها تسليمات", "ok" if not assignments_no_sub else "warning",
                  str(len(assignments_no_sub)), "مهام نشطة أو مغلقة دون أي تسليم مسجل.", "/assignments"),
            check("tasks_overdue", "مهام إجرائية غير متأخرة", "ok" if not TeacherTask.objects.filter(owner=user, status__in=["pending", "in_progress"], due_date__lt=datetime.date.today()).count() else "warning",
                  str(TeacherTask.objects.filter(owner=user, status__in=["pending", "in_progress"], due_date__lt=datetime.date.today()).count()), "مهام مفتوحة تجاوزت أجلها في مركز الإجراءات.", "/actions"),
        ]
        return Response({
            "counts": counts,
            "total_records": sum(counts.values()),
            "database_size_bytes": db_size,
            "classes": [{"id": cls.id, "name": cls.name, "level": cls.level,
                         "students": cls.students.count(), "slots": cls.slots.count()} for cls in classes],
            "checks": checks,
            "backup_format": "teacherhub-backup",
            "backup_version": 1,
        })


class BackupExportView(APIView):
    def get(self, request):
        from django.core import serializers as dj_serializers
        user = local_user()
        payload = []
        for qs in _backup_querysets(user):
            payload.extend(json.loads(dj_serializers.serialize("json", qs)))
        wrapper = {"format": "teacherhub-backup", "version": 1,
                   "exported_at": timezone.now().isoformat(), "records": len(payload), "data": payload}
        response = HttpResponse(json.dumps(wrapper, ensure_ascii=False, indent=1), content_type="application/json; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="teacherhub-backup-{datetime.date.today().isoformat()}.json"'
        return response


class BackupImportView(APIView):
    def post(self, request):
        from django.core import serializers as dj_serializers
        payload = request.data
        if isinstance(payload, dict):
            if payload.get("format") not in (None, "teacherhub-backup"):
                return Response({"detail": "صيغة ملف غير مدعومة."}, status=400)
            data = payload.get("data")
        else:
            data = payload
        if not isinstance(data, list) or not data:
            return Response({"detail": "ملف النسخة الاحتياطية فارغ أو غير صالح."}, status=400)
        imported, by_model = 0, {}
        try:
            with transaction.atomic():
                for obj in dj_serializers.deserialize("json", json.dumps(data)):
                    obj.save()
                    imported += 1
                    label = obj.object._meta.label.split(".")[-1]
                    by_model[label] = by_model.get(label, 0) + 1
        except Exception as exc:
            return Response({"detail": f"فشل الاستيراد: {str(exc)[:240]}"}, status=400)
        return Response({"imported": imported, "by_model": by_model})


class SchoolYearRolloverView(APIView):
    def post(self, request):
        user = local_user()
        class_ids = request.data.get("class_ids") or []
        if not isinstance(class_ids, list) or not class_ids:
            return Response({"detail": "اختر فوجًا واحدًا على الأقل."}, status=400)
        year_label = str(request.data.get("year_label") or "2026 / 2027").strip()
        copy_students = request.data.get("copy_students", True) not in (False, "false", "0")
        copy_slots = request.data.get("copy_slots", True) not in (False, "false", "0")
        created, skipped = [], []
        for class_id in class_ids:
            cls = SchoolClass.objects.filter(owner=user, pk=class_id).first()
            if not cls:
                skipped.append({"class_id": class_id, "reason": "الفوج غير موجود"})
                continue
            new_name = f"{cls.name} — {year_label}"
            if SchoolClass.objects.filter(owner=user, name=new_name).exists():
                skipped.append({"class_id": cls.id, "name": new_name, "reason": "فوج السنة الجديدة موجود سابقًا"})
                continue
            new_cls = SchoolClass.objects.create(owner=user, name=new_name, level=cls.level,
                                                 students_count=cls.students.count() if copy_students else cls.students_count)
            if copy_slots:
                for slot in cls.slots.all():
                    TimetableSlot.objects.create(school_class=new_cls, weekday=slot.weekday,
                                                 start_time=slot.start_time, end_time=slot.end_time, room=slot.room)
            students_copied = 0
            if copy_students:
                for student in cls.students.all().order_by("full_name"):
                    Student.objects.create(school_class=new_cls, full_name=student.full_name)
                    students_copied += 1
            created.append({"id": new_cls.id, "name": new_cls.name, "level": new_cls.level,
                            "students_copied": students_copied, "slots_copied": new_cls.slots.count()})
        return Response({"created": created, "skipped": skipped,
                         "created_count": len(created), "skipped_count": len(skipped)}, status=201)



# ------------------------------------------------------------------ annual curriculum distribution & progression
def _academic_year(today=None):
    today = today or datetime.date.today()
    start = datetime.date(today.year, 9, 1) if today.month >= 9 else datetime.date(today.year - 1, 9, 1)
    return start, datetime.date(start.year + 1, 6, 30)


def _term_for_date(value):
    if value is None: return None
    if value.month >= 9: return 1
    if value.month <= 3: return 2
    return 3


def _build_progression(cls, today=None):
    today = today or datetime.date.today()
    user = local_user()
    year_start, year_end = _academic_year(today)
    courses = list(Course.objects.filter(owner=user).order_by("order", "id"))
    sessions = list(Session.objects.filter(owner=user, school_class=cls, status="done", course__isnull=False)
                    .select_related("course").order_by("date"))
    actual = {}
    for row in sessions:
        actual.setdefault(row.course_id, []).append(row)
    slots = list(cls.slots.all().order_by("weekday", "start_time"))
    slot_weekdays = sorted({(slot.weekday + 6) % 7 for slot in slots})  # slot Sun=0 -> python Mon=0
    holidays = list(Holiday.objects.filter(owner=user))

    def is_holiday(day):
        return any(row.start_date <= day <= row.end_date for row in holidays)

    def teaching_days_between(start, end):
        if end < start or not slot_weekdays: return 0
        count, day = 0, start
        while day <= end:
            if day.weekday() in slot_weekdays and not is_holiday(day): count += 1
            day += datetime.timedelta(days=1)
        return count

    plan_course_ids = set(LessonPlan.objects.filter(owner=user).exclude(course__isnull=True).values_list("course_id", flat=True))
    remaining = [course for course in courses if course.id not in actual]
    pointer = max(today, year_start)
    if sessions and sessions[-1].date >= pointer:
        pointer = sessions[-1].date + datetime.timedelta(days=1)
    projected = {}
    for course in remaining:
        day, assigned = pointer, None
        while day <= year_end:
            if slot_weekdays and day.weekday() in slot_weekdays and not is_holiday(day):
                assigned = day
                break
            day += datetime.timedelta(days=1)
        projected[course.id] = assigned
        if assigned: pointer = assigned + datetime.timedelta(days=1)

    first_remaining_id = remaining[0].id if remaining else None
    rows = []
    for course in courses:
        done_sessions = actual.get(course.id, [])
        if done_sessions:
            status, status_label, date_value, is_projected = "done", "منجز", done_sessions[0].date, False
        elif course.id == first_remaining_id:
            status, status_label, date_value, is_projected = "current", "جارٍ الآن", projected.get(course.id), True
        else:
            status, status_label, date_value, is_projected = "upcoming", "قادم", projected.get(course.id), True
        rows.append({
            "course_id": course.id, "order": course.order, "title": course.title,
            "domain": course.domain, "unit": course.unit,
            "status": status, "status_label": status_label,
            "date": str(date_value) if date_value else None, "is_projected": is_projected and date_value is not None,
            "term": _term_for_date(date_value), "term_label": TERM_PACK_LABELS.get(_term_for_date(date_value)),
            "sessions_count": len(done_sessions), "has_lesson_plan": course.id in plan_course_ids,
        })

    total = len(courses)
    done_count = total - len(remaining)
    percent = round(done_count * 100 / total) if total else 0
    elapsed_days = teaching_days_between(year_start, min(today, year_end))
    total_days = teaching_days_between(year_start, year_end)
    year_percent = round(elapsed_days * 100 / total_days, 1) if total_days else 0
    pace_diff = round(percent - year_percent, 1)
    pace = "ahead" if pace_diff >= 10 else "behind" if pace_diff <= -10 else "on_track"
    pace_label = {"ahead": "متقدم عن الإيقاع", "on_track": "على الإيقاع السنوي", "behind": "متأخر عن الإيقاع"}[pace]
    projected_finish = None
    for row in reversed(rows):
        if row["date"]: projected_finish = row["date"]; break
    current = next((row for row in rows if row["status"] == "current"), None)

    recommendations = []
    if pace == "behind":
        recommendations.append({"severity": "high", "title": "تسريع الإيقاع", "text": f"أُنجز {percent}٪ من المقرر مقابل {year_percent}٪ من أيام التدريس المنقضية؛ برمجوا حصص استدراك أو ادمجوا الدروس القصيرة المتكاملة."})
    if current and not current["has_lesson_plan"]:
        recommendations.append({"severity": "medium", "title": "تحضير خطة الدرس الحالي", "text": f"الدرس الجاري «{current['title']}» لا خطة درس مرتبطة به بعد؛ حضّروها قبل الحصة القادمة."})
    missing_plans = [row for row in rows if row["status"] != "done" and not row["has_lesson_plan"]]
    if missing_plans:
        recommendations.append({"severity": "medium", "title": "خطط دروس ناقصة", "text": f"{len(missing_plans)} درسًا قادمًا دون خطة درس: " + "، ".join(row["title"] for row in missing_plans[:4]) + "."})
    if projected_finish and projected_finish > str(year_end):
        recommendations.append({"severity": "high", "title": "خطر عدم إنهاء المقرر", "text": f"الإنهاء المتوقع {projected_finish} يتجاوز نهاية السنة الدراسية {year_end}؛ راجعوا توزيع الحصص المتبقية."})
    if not recommendations:
        recommendations.append({"severity": "low", "title": "إيقاع سليم", "text": "التقدم متوافق مع التوزيع السنوي؛ واصلوا التوثيق المنتظم للحصص وخطط الدروس."})

    return {
        "class": {"id": cls.id, "name": cls.name, "level": cls.level},
        "school_year": {"start": str(year_start), "end": str(year_end), "label": f"{year_start.year} / {year_end.year}"},
        "slots_per_week": len(slots),
        "summary": {"total_courses": total, "done_courses": done_count, "percent": percent,
                    "current_course": current["title"] if current else None,
                    "projected_finish": projected_finish,
                    "finishes_on_time": bool(projected_finish and projected_finish <= str(year_end)),
                    "year_percent": year_percent, "pace": pace, "pace_label": pace_label, "pace_diff": pace_diff},
        "courses": rows,
        "recommendations": recommendations,
    }


class ProgressionView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        return Response(_build_progression(cls))


class ProgressionsOverviewView(APIView):
    def get(self, request):
        rows = []
        for cls in SchoolClass.objects.filter(owner=local_user()).order_by("name"):
            data = _build_progression(cls)
            rows.append({"class": data["class"], **data["summary"], "school_year": data["school_year"]["label"]})
        return Response({"classes": rows})


class ProgressionDocumentView(APIView):
    def post(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        data = _build_progression(cls)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        summary = data["summary"]
        table_rows = [[str(row["order"]), row["title"], " / ".join(part for part in [row["domain"], row["unit"]] if part) or "—",
                       row["status_label"], (row["date"] or "—") + (" (متوقع)" if row["is_projected"] else ""),
                       row["term_label"] or "—", "نعم" if row["has_lesson_plan"] else "لا"] for row in data["courses"]]
        blocks = [
            docs_builder.fields([("الفوج", cls.name), ("المستوى", cls.level), ("السنة الدراسية", data["school_year"]["label"]),
                                 ("عدد الدروس", str(summary["total_courses"])), ("الدروس المنجزة", str(summary["done_courses"])),
                                 ("نسبة التقدم", f"{summary['percent']}٪"), ("الدرس الجاري", summary["current_course"] or "—"),
                                 ("الإنهاء المتوقع", summary["projected_finish"] or "—"), ("الإيقاع", summary["pace_label"]),
                                 ("الأستاذ(ة)", teacher), ("المؤسسة", school)], f"التوزيع السنوي للمنهاج — {cls.name}"),
            docs_builder.table(["#", "الدرس", "المجال / الوحدة", "الحالة", "التاريخ", "الثلاثي", "خطة درس"], table_rows, "توزيع الدروس على السنة الدراسية"),
            docs_builder.checklist([f"{row['title']}: {row['text']}" for row in data["recommendations"]], "ملاحظات وتوصيات الإيقاع"),
            docs_builder.text("ملاحظة: التواريخ القادمة تقديرية محسوبة من جدول التوقيت الأسبوعي للفوج مع استبعاد العطل والمناسبات المسجلة، وتُحيَّن تلقائيًا كلما سُجّلت حصص جديدة."),
            docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"]),
        ]
        doc = CustomDocument.objects.create(owner=local_user(), title=f"التوزيع السنوي — {cls.name} ({data['school_year']['label']})",
            kind="tracker-sheet", orientation="landscape", content={"blocks": blocks},
            tags=["التوزيع السنوي", cls.name], source_type="curriculum-progression", source_id=cls.id)
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ bulk parent communication centre
CAMPAIGN_AUDIENCES = {
    "absentees": "كثيرو الغياب",
    "missing_assignments": "مهام غير مسلّمة",
    "low_grades": "معدلات تحتاج دعمًا",
    "honor": "المتفوقون — رسائل تهنئة",
    "support_open": "خطط دعم مفتوحة",
    "all": "كل تلاميذ الفوج",
}
CAMPAIGN_SUBJECTS = {
    "absentees": "إشعار بخصوص غيابات التلميذ",
    "missing_assignments": "متابعة تسليم المهام والواجبات",
    "low_grades": "ملخص نتائج الثلاثي وخطة الدعم",
    "honor": "تهنئة بتفوق التلميذ",
    "support_open": "متابعة خطة دعم التلميذ",
    "all": "رسالة إلى أولياء التلاميذ",
}
CAMPAIGN_MESSAGES = {
    "absentees": "تحية طيبة وبعد،\nنعلمكم أن ابنكم(تكم) {name} من قسم {class} سجّل {absences} غيابات خلال الفترة الأخيرة، ونسبة حضوره الحالية {attendance}٪. المواظبة شرط أساسي للتحصيل، لذا نرجو منكم تبرير الغيابات ومتابعة الحضور اليومي، والاتصال بنا عند أي ظرف طارئ.",
    "missing_assignments": "تحية طيبة وبعد،\nنعلمكم أن ابنكم(تكم) {name} من قسم {class} لم يسلّم بعد {missing} من المهام والواجبات المطلوبة في مادة الإعلام الآلي. نرجو منكم متابعة إنجازها وتسليمها في أقرب الآجال، لأن هذه المهام جزء من التقويم المستمر.",
    "low_grades": "تحية طيبة وبعد،\nنشارككم أن معدل ابنكم(تكم) {name} من قسم {class} في {term} هو {average}/20، وهو معدل يحتاج دعمًا مشتركًا بيننا وبينكم. نقترح خطة مراجعة منتظمة في البيت ومتابعة أسبوعية مع الأستاذ، ونحن جاهزون لأي لقاء لتوضيح التفاصيل.",
    "honor": "تحية طيبة وبعد،\nيسرّنا أن نهنئكم بتفوق ابنكم(تكم) {name} من قسم {class} في مادة الإعلام الآلي خلال {term} بمعدل {average}/20. نشكر لكم متابعتكم ودعمكم، ونتمنى له(ا) مزيدًا من التألق والنجاح.",
    "support_open": "تحية طيبة وبعد،\nفي إطار خطة الدعم الموضوعة لابنكم(تكم) {name} من قسم {class}، نعلمكم أن الخطة ما تزال قيد التنفيذ وعدد خطط الدعم المفتوحة المرتبطة به(ا): {plans}. نرجو مواصلة التعاون معنا ومتابعة التوصيات المتفق عليها، وسنعلمكم بأي تطور.",
    "all": "تحية طيبة وبعد،\nنتواصل معكم بخصوص متابعة ابنكم(تكم) {name} من قسم {class} في مادة الإعلام الآلي خلال {term}. معدل التلميذ الحالي {average}/20 ونسبة حضوره {attendance}٪. شاكرين لكم تعاونكم الدائم لما فيه مصلحة التلميذ، ونبقى رهن إشارتكم لأي استفسار.",
}


def _campaign_rows(cls, term=1, audience="absentees", min_absences=3):
    data = _build_class_analytics(cls, term)
    rows = data["students"]
    if audience == "absentees":
        chosen = [row for row in rows if row["absences"] >= min_absences]
        chosen.sort(key=lambda row: (-row["absences"], row["student_name"]))
        detail = lambda row: f"{row['absences']} غيابات • نسبة الحضور {row['attendance_rate'] if row['attendance_rate'] is not None else '—'}٪"
    elif audience == "missing_assignments":
        chosen = [row for row in rows if row["assignment_missing"] >= 1]
        chosen.sort(key=lambda row: (-row["assignment_missing"], row["student_name"]))
        detail = lambda row: f"{row['assignment_missing']} مهمة غير مسلّمة من أصل {row['assignment_expected']}"
    elif audience == "low_grades":
        chosen = [row for row in rows if row["term_average"] is not None and row["term_average"] < 10]
        chosen.sort(key=lambda row: (row["term_average"], row["student_name"]))
        detail = lambda row: f"معدل {data['marks']['selected']['label']}: {row['term_average']}/20 • مخاطرة {row['risk_score']}/100"
    elif audience == "honor":
        chosen = [row for row in rows if row["term_average"] is not None and row["term_average"] >= 15]
        chosen.sort(key=lambda row: (-row["term_average"], row["student_name"]))
        detail = lambda row: f"معدل {data['marks']['selected']['label']}: {row['term_average']}/20"
    elif audience == "support_open":
        chosen = [row for row in rows if row["open_plans"] >= 1]
        chosen.sort(key=lambda row: (-row["open_plans"], row["student_name"]))
        detail = lambda row: f"{row['open_plans']} خطة دعم مفتوحة • مخاطرة {row['risk_score']}/100"
    else:
        audience = "all"
        chosen = sorted(rows, key=lambda row: row["student_name"])
        detail = lambda row: f"المعدل السنوي {row['annual_average'] if row['annual_average'] is not None else '—'} • الحضور {row['attendance_rate'] if row['attendance_rate'] is not None else '—'}٪"
    result = []
    for row in chosen:
        last = ParentCommunication.objects.filter(student_id=row["student_id"]).order_by("-date", "-created_at").first()
        result.append({**row, "detail": detail(row),
                       "last_communication": {"date": str(last.date), "subject": last.subject} if last else None})
    return result


def _render_campaign_message(template, cls, row, term):
    values = {
        "name": row["student_name"], "class": cls.name,
        "average": row["term_average"] if row.get("term_average") is not None else (row.get("annual_average") if row.get("annual_average") is not None else "—"),
        "absences": row.get("absences", 0), "missing": row.get("assignment_missing", 0),
        "attendance": row["attendance_rate"] if row.get("attendance_rate") is not None else "—",
        "plans": row.get("open_plans", 0), "term": TERM_PACK_LABELS[term],
    }
    out = template or ""
    for key, value in values.items():
        out = out.replace("{" + key + "}", str(value))
    return out


class ParentCampaignPreviewView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        audience = request.query_params.get("audience") or "absentees"
        if audience not in CAMPAIGN_AUDIENCES: audience = "absentees"
        try: term = int(request.query_params.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        try: min_absences = max(1, int(request.query_params.get("min_absences") or 3))
        except (TypeError, ValueError): min_absences = 3
        recent = [{"id": doc.id, "title": doc.title, "updated_at": doc.updated_at.isoformat()}
                  for doc in CustomDocument.objects.filter(owner=local_user(), source_type="parent-campaign", source_id=cls.id).order_by("-updated_at")[:8]]
        return Response({
            "class": {"id": cls.id, "name": cls.name, "level": cls.level},
            "audience": audience, "audience_label": CAMPAIGN_AUDIENCES[audience],
            "term": term, "term_label": TERM_PACK_LABELS[term], "min_absences": min_absences,
            "students": _campaign_rows(cls, term, audience, min_absences),
            "default_subject": CAMPAIGN_SUBJECTS[audience], "default_message": CAMPAIGN_MESSAGES[audience],
            "audiences": [{"key": key, "label": label} for key, label in CAMPAIGN_AUDIENCES.items()],
            "recent_campaigns": recent,
        })


class ParentCampaignGenerateView(APIView):
    def post(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        audience = request.data.get("audience") or "absentees"
        if audience not in CAMPAIGN_AUDIENCES: audience = "absentees"
        try: term = int(request.data.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        try: min_absences = max(1, int(request.data.get("min_absences") or 3))
        except (TypeError, ValueError): min_absences = 3
        rows = _campaign_rows(cls, term, audience, min_absences)
        selected_ids = request.data.get("student_ids")
        if isinstance(selected_ids, list) and selected_ids:
            wanted = {int(value) for value in selected_ids if str(value).isdigit()}
            rows = [row for row in rows if row["student_id"] in wanted]
        if not rows:
            return Response({"detail": "لا تلاميذ محددون في هذه القائمة."}, status=400)
        subject = (request.data.get("subject") or CAMPAIGN_SUBJECTS[audience]).strip()
        template = request.data.get("message") or CAMPAIGN_MESSAGES[audience]
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        blocks = []
        for index, row in enumerate(rows):
            rendered = _render_campaign_message(template, cls, row, term)
            blocks.append(docs_builder.fields([("المؤسسة", school), ("التاريخ", str(datetime.date.today())),
                                               ("إلى السيد(ة)", "ولي التلميذ(ة)"), ("التلميذ(ة)", row["student_name"]),
                                               ("القسم", cls.name), ("الموضوع", subject)], f"رسالة ولي — {row['student_name']}"))
            blocks.append(docs_builder.text(rendered))
            blocks.append(docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة", "ولي التلميذ (اطّلع ووقّع)"]))
            if index < len(rows) - 1:
                blocks.append(docs_builder.pagebreak())
        doc = CustomDocument.objects.create(owner=local_user(),
            title=f"مراسلات أولياء — {CAMPAIGN_AUDIENCES[audience]} — {cls.name} — {datetime.date.today()}",
            kind="parent-letter", orientation="portrait", content={"blocks": blocks},
            tags=["تواصل جماعي", CAMPAIGN_AUDIENCES[audience], cls.name], source_type="parent-campaign", source_id=cls.id)
        logged = 0
        if request.data.get("log", True) not in (False, "false", "0"):
            for row in rows:
                ParentCommunication.objects.create(student_id=row["student_id"], date=datetime.date.today(),
                    channel="letter", subject=subject,
                    summary=_render_campaign_message(template, cls, row, term)[:400],
                    outcome="رسالة جماعية مولّدة من مركز التواصل الجماعي مع الأولياء.")
                logged += 1
        return Response({"document": {"id": doc.id, "title": doc.title, "kind": doc.kind},
                         "recipients": len(rows), "logged": logged}, status=201)



# ------------------------------------------------------------------ weekly work planner
def _build_week(anchor=None):
    user = local_user()
    today = datetime.date.today()
    anchor = anchor or today
    week_start = anchor - datetime.timedelta(days=(anchor.weekday() + 1) % 7)  # Sunday = 0
    week_end = week_start + datetime.timedelta(days=6)
    classes = list(SchoolClass.objects.filter(owner=user).prefetch_related("slots").order_by("name"))
    courses = list(Course.objects.filter(owner=user).order_by("order", "id"))
    progress_by_class = {cls.id: class_progress(cls, courses) for cls in classes}
    sessions = list(Session.objects.filter(owner=user, date__gte=week_start, date__lte=week_end)
                    .select_related("course", "school_class"))
    holidays = list(Holiday.objects.filter(owner=user, start_date__lte=week_end, end_date__gte=week_start))
    days = []
    total_slots = logged_count = needs_log_count = 0
    for offset in range(7):
        day = week_start + datetime.timedelta(days=offset)
        holiday = next((row for row in holidays if row.start_date <= day <= row.end_date), None)
        entries = []
        for cls in classes:
            for slot in cls.slots.all():
                if slot.weekday != offset: continue
                total_slots += 1
                day_sessions = [row for row in sessions if row.date == day and row.school_class_id == cls.id]
                logged = day_sessions[0] if day_sessions else None
                if logged: logged_count += 1
                needs_log = bool(day < today and not logged and not holiday)
                if needs_log: needs_log_count += 1
                next_course = progress_by_class[cls.id]["next_course"]
                entries.append({
                    "slot_id": slot.id, "class_id": cls.id, "class_name": cls.name,
                    "start_time": str(slot.start_time) if slot.start_time else None,
                    "end_time": str(slot.end_time) if slot.end_time else None, "room": slot.room,
                    "next_course": next_course if not logged else None,
                    "session": {"id": logged.id, "status": logged.status,
                                "status_label": logged.get_status_display(),
                                "course_title": logged.course.title if logged.course else None} if logged else None,
                    "needs_log": needs_log,
                })
        entries.sort(key=lambda row: (row["start_time"] or "", row["class_name"]))
        days.append({"date": str(day), "weekday": offset, "weekday_name": WEEKDAY_NAMES[offset],
                     "is_today": day == today, "is_past": day < today,
                     "holiday": holiday.name if holiday else None, "entries": entries})
    return {
        "week_start": str(week_start), "week_end": str(week_end), "today": str(today),
        "days": days,
        "summary": {"slots": total_slots, "logged": logged_count, "needs_log": needs_log_count,
                    "sessions_this_week": len([row for row in sessions if row.status == "done"]),
                    "holidays": len({row.id for row in holidays})},
    }


class PlannerWeekView(APIView):
    def get(self, request):
        anchor = _parse_iso_date(request.query_params.get("date")) or datetime.date.today()
        return Response(_build_week(anchor))


class PlannerDocumentView(APIView):
    def post(self, request):
        anchor = _parse_iso_date(request.data.get("date")) or datetime.date.today()
        data = _build_week(anchor)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        rows = []
        lesson_rows = []
        for day in data["days"]:
            if day["holiday"]:
                rows.append([day["weekday_name"], day["date"], "عطلة / مناسبة", day["holiday"], "—", "—"])
            for entry in day["entries"]:
                if entry["session"]:
                    lesson = entry["session"]["course_title"] or "—"
                    state = entry["session"]["status_label"]
                else:
                    lesson = entry["next_course"]["title"] if entry["next_course"] else "—"
                    state = "مخططة"
                rows.append([day["weekday_name"], day["date"], entry["class_name"],
                             f"{entry['start_time'] or ''} — {entry['room']}", lesson, state])
                lesson_rows.append([day["weekday_name"], entry["class_name"], lesson, "☐"])
        blocks = [
            docs_builder.fields([("الأسبوع", f"{data['week_start']} ← {data['week_end']}"), ("الأستاذ(ة)", teacher), ("المؤسسة", school),
                                 ("حصص الأسبوع", str(data["summary"]["slots"])), ("حصص مسجلة", str(data["summary"]["logged"]))],
                                "مخطط العمل الأسبوعي"),
            docs_builder.table(["اليوم", "التاريخ", "الفوج / المناسبة", "الوقت / القاعة", "الدرس", "الحالة"], rows, "برنامج الأسبوع"),
            docs_builder.table(["اليوم", "الفوج", "الدرس", "أُنجز"], lesson_rows, "قائمة تحقق إنجاز الحصص"),
            docs_builder.signatures(["الأستاذ(ة)"]),
        ]
        doc = CustomDocument.objects.create(owner=local_user(), title=f"مخطط أسبوعي — {data['week_start']}",
            kind="tracker-sheet", orientation="landscape", content={"blocks": blocks},
            tags=["تخطيط أسبوعي"], source_type="weekly-planner")
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ gradebook entry & marks import centre
def _gradebook_payload(cls, term):
    students = list(cls.students.prefetch_related("marks").order_by("full_name"))
    rows = []
    for student in students:
        mark = next((row for row in student.marks.all() if row.term == term), None)
        rows.append({"student_id": student.id, "student_name": student.full_name,
                     "continuous": mark.continuous if mark else None,
                     "supervised": mark.supervised if mark else None,
                     "exam": mark.exam if mark else None,
                     "average": mark.average if mark else None,
                     "has_mark": mark is not None})
    averages = [row["average"] for row in rows if row["average"] is not None]
    stats = {"students": len(rows), "graded": len(averages),
             "with_any_mark": sum(1 for row in rows if row["has_mark"]),
             "average": round(sum(averages) / len(averages), 2) if averages else None,
             "highest": max(averages) if averages else None,
             "lowest": min(averages) if averages else None,
             "success_rate": round(sum(1 for value in averages if value >= 10) * 100 / len(averages), 1) if averages else None}
    return {"class": {"id": cls.id, "name": cls.name, "level": cls.level},
            "term": term, "term_label": TERM_PACK_LABELS[term], "rows": rows, "stats": stats}


def _clean_mark_value(value):
    if value in (None, "", "—", "-"): return None
    try: number = float(value)
    except (TypeError, ValueError): return None
    return max(0.0, min(20.0, number))


def _upsert_mark(student, term, continuous, supervised, exam):
    if continuous is None and supervised is None and exam is None:
        Mark.objects.filter(student=student, term=term).delete()
        return "cleared"
    Mark.objects.update_or_create(student=student, term=term,
                                  defaults={"continuous": continuous, "supervised": supervised, "exam": exam})
    return "saved"


class GradebookView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.query_params.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        return Response(_gradebook_payload(cls, term))


class GradebookSaveView(APIView):
    def post(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.data.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        valid_ids = set(cls.students.values_list("id", flat=True))
        saved = cleared = 0
        for row in (request.data.get("rows") or [])[:300]:
            try: student_id = int(row.get("student_id"))
            except (TypeError, ValueError): continue
            if student_id not in valid_ids: continue
            result = _upsert_mark(Student.objects.get(pk=student_id), term,
                                  _clean_mark_value(row.get("continuous")),
                                  _clean_mark_value(row.get("supervised")),
                                  _clean_mark_value(row.get("exam")))
            if result == "saved": saved += 1
            else: cleared += 1
        payload = _gradebook_payload(cls, term)
        return Response({"saved": saved, "cleared": cleared, **payload})


class GradebookExportView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.query_params.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        payload = _gradebook_payload(cls, term)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["student_id", "student_name", "continuous", "supervised", "exam", "average"])
        for row in payload["rows"]:
            writer.writerow([row["student_id"], row["student_name"],
                             "" if row["continuous"] is None else row["continuous"],
                             "" if row["supervised"] is None else row["supervised"],
                             "" if row["exam"] is None else row["exam"],
                             "" if row["average"] is None else row["average"]])
        response = HttpResponse("﻿" + buffer.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="gradebook-{cls.id}-term{term}.csv"'
        return response


class GradebookImportView(APIView):
    def post(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.data.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        text = request.data.get("csv") or ""
        if not text.strip():
            return Response({"detail": "نص CSV فارغ."}, status=400)
        first_line = text.strip().splitlines()[0]
        delimiter = ";" if ";" in first_line and "," not in first_line else ","
        students_by_id = {row.id: row for row in cls.students.all()}
        students_by_name = {row.full_name.strip(): row for row in cls.students.all()}
        imported, unmatched = 0, []
        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        for raw in reader:
            if not raw: continue
            normalized = {(key or "").strip().lower(): (value.strip() if isinstance(value, str) else value) for key, value in raw.items()}
            student = None
            raw_id = normalized.get("student_id") or normalized.get("id")
            if raw_id and str(raw_id).isdigit():
                student = students_by_id.get(int(raw_id))
            if student is None:
                name = normalized.get("student_name") or normalized.get("name") or normalized.get("الاسم") or ""
                student = students_by_name.get(str(name).strip())
            if student is None:
                label = str(normalized.get("student_name") or raw_id or "?").strip()
                if label and label != "?": unmatched.append(label)
                continue
            result = _upsert_mark(student, term,
                                  _clean_mark_value(normalized.get("continuous")),
                                  _clean_mark_value(normalized.get("supervised")),
                                  _clean_mark_value(normalized.get("exam")))
            if result == "saved": imported += 1
        payload = _gradebook_payload(cls, term)
        return Response({"imported": imported, "unmatched": unmatched, **payload})



# ------------------------------------------------------------------ class council & meetings centre
class MeetingViewSet(viewsets.ModelViewSet):
    serializer_class = MeetingSerializer

    def get_queryset(self):
        qs = Meeting.objects.filter(owner=local_user()).select_related("school_class")
        params = self.request.query_params
        if params.get("school_class"): qs = qs.filter(school_class_id=params["school_class"])
        if params.get("meeting_type"): qs = qs.filter(meeting_type=params["meeting_type"])
        if params.get("q"): qs = qs.filter(Q(title__icontains=params["q"]) | Q(agenda__icontains=params["q"]))
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=local_user())

    @action(detail=True, methods=["post"], url_path="generate-minutes")
    def generate_minutes(self, request, pk=None):
        meeting = self.get_object()
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        decision_rows = [[row.get("text", ""), row.get("responsible", "") or "—", row.get("due", "") or "—",
                          "أُنجز" if row.get("done") else "قيد التنفيذ"] for row in (meeting.decisions or [])]
        blocks = [
            docs_builder.fields([("المؤسسة", school), ("عنوان الاجتماع", meeting.title), ("نوع الاجتماع", meeting.type_label),
                                 ("التاريخ", str(meeting.date)), ("الفوج", meeting.school_class.name if meeting.school_class else "—"),
                                 ("الثلاثي", TERM_PACK_LABELS.get(meeting.term, "—") if meeting.term else "—"),
                                 ("الحاضرون", "، ".join(meeting.attendees or []) or "—"), ("الأستاذ(ة)", teacher)],
                                f"محضر اجتماع — {meeting.title}"),
        ]
        if meeting.agenda:
            blocks.append(docs_builder.heading("جدول الأعمال"))
            blocks.append(docs_builder.text(meeting.agenda))
        if decision_rows:
            blocks.append(docs_builder.table(["القرار / الإجراء", "المسؤول", "الأجل", "الحالة"], decision_rows, "القرارات والتوصيات"))
        if meeting.notes:
            blocks.append(docs_builder.heading("ملاحظات إضافية"))
            blocks.append(docs_builder.text(meeting.notes))
        blocks.append(docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"]))
        doc = CustomDocument.objects.create(owner=local_user(), title=f"محضر — {meeting.title} — {meeting.date}",
            kind="meeting-minutes", orientation="portrait", content={"blocks": blocks},
            tags=["اجتماعات", meeting.type_label], source_type="meeting", source_id=meeting.id)
        meeting.minutes_document = doc
        meeting.save(update_fields=["minutes_document", "updated_at"])
        return Response({"document": CustomDocumentSerializer(doc).data,
                         "meeting": MeetingSerializer(meeting).data}, status=201)

    @action(detail=True, methods=["post"], url_path="push-decisions")
    def push_decisions(self, request, pk=None):
        meeting = self.get_object()
        decisions = list(meeting.decisions or [])
        created = []
        for row in decisions:
            text = (row.get("text") or "").strip()
            if not text or row.get("task_id"): continue
            due = _parse_iso_date(row.get("due")) if row.get("due") else None
            task = TeacherTask.objects.create(
                owner=local_user(), title=text[:200],
                description=f"قرار من اجتماع «{meeting.title}» بتاريخ {meeting.date}." + (f" المسؤول: {row['responsible']}." if row.get("responsible") else ""),
                category="general", priority="medium", status="pending", due_date=due,
                school_class=meeting.school_class, source_type="meeting", source_id=meeting.id)
            row["task_id"] = task.id
            created.append({"id": task.id, "title": task.title})
        meeting.decisions = decisions
        meeting.save(update_fields=["decisions", "updated_at"])
        return Response({"created": created, "created_count": len(created),
                         "meeting": MeetingSerializer(meeting).data})


class CouncilBriefView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try: term = int(request.query_params.get("term") or 1)
        except (TypeError, ValueError): term = 1
        if term not in (1, 2, 3): term = 1
        data = _build_class_analytics(cls, term)
        selected = data["marks"]["selected"]
        agenda = [
            f"عرض نتائج {selected['label']}: معدل الفوج {selected['average'] if selected['average'] is not None else '—'}/20 ونسبة النجاح {selected['success_rate'] if selected['success_rate'] is not None else '—'}٪.",
            f"مؤشر صحة الفوج {data['health']['score'] if data['health']['score'] is not None else '—'} — {data['health']['label']}؛ نسبة الحضور {data['attendance']['attendance_rate'] if data['attendance']['attendance_rate'] is not None else '—'}٪ وتسليم المهام {data['assignments']['completion_rate']}٪.",
            "مناقشة توزيع المعدلات ومكونات التقويم (المستمر، الفروض، الاختبار).",
        ]
        if data["support"]["risk_distribution"]["high"]:
            agenda.append(f"دراسة حالات {data['support']['risk_distribution']['high']} تلميذًا بمخاطرة عالية وخطط دعمهم.")
        if data["assignments"]["missing"]:
            agenda.append(f"معالجة {data['assignments']['missing']} تسليمًا مفقودًا للمهام والواجبات.")
        agenda.append(f"تقدم المقرر الدراسي ({data['curriculum']['percent']}٪) وبرمجة ما تبقى من الثلاثي.")
        agenda.append("التحضير للثلاثي الموالي وتوزيع المهام.")
        decisions = []
        for row in data["needs_support"][:4]:
            if row["risk_score"] >= 25:
                decisions.append({"text": f"إدراج {row['student_name']} في خطة دعم فردية ومتابعة أسبوعية", "responsible": "", "due": "", "done": False})
        if data["attendance"]["attendance_rate"] is not None and data["attendance"]["attendance_rate"] < 90:
            decisions.append({"text": "تفعيل التواصل مع أولياء التلاميذ كثيري الغياب", "responsible": "", "due": "", "done": False})
        if data["assignments"]["completion_rate"] < 80 and data["assignments"]["expected"]:
            decisions.append({"text": "تحديد آجال مرحلية لرفع نسبة تسليم المهام", "responsible": "", "due": "", "done": False})
        decisions.append({"text": "برمجة لقاء تنسيقي لمتابعة تنفيذ قرارات المجلس", "responsible": "", "due": "", "done": False})
        return Response({
            "class": data["class"], "term": term, "term_label": selected["label"],
            "summary": {"term_average": selected["average"], "success_rate": selected["success_rate"],
                        "attendance_rate": data["attendance"]["attendance_rate"],
                        "assignment_completion": data["assignments"]["completion_rate"],
                        "health_score": data["health"]["score"], "health_label": data["health"]["label"],
                        "average_risk": data["support"]["average_risk"],
                        "curriculum_percent": data["curriculum"]["percent"]},
            "needs_support": [{"student_id": row["student_id"], "student_name": row["student_name"],
                               "risk_score": row["risk_score"], "annual_average": row["annual_average"],
                               "absences": row["absences"]} for row in data["needs_support"][:6]],
            "suggested_agenda": agenda, "suggested_decisions": decisions,
        })



# ------------------------------------------------------------------ annual year review & final synthesis
def _build_year_review_class(cls):
    term_data = {}
    analytics_by_term = {}
    for term in (1, 2, 3):
        data = _build_class_analytics(cls, term)
        analytics_by_term[term] = data
        selected = data["marks"]["selected"]
        term_data[str(term)] = {"term": term, "label": selected["label"], "average": selected["average"],
                                "success_rate": selected["success_rate"], "graded": selected["graded"],
                                "attendance_rate": data["attendance"]["attendance_rate"],
                                "assignment_completion": data["assignments"]["completion_rate"]}
    base = analytics_by_term[3]
    students = base["students"]
    with_annual = [row for row in students if row["annual_average"] is not None]
    top_year = sorted(with_annual, key=lambda row: (-row["annual_average"], row["student_name"]))[:5]
    improved = sorted([row for row in students if row["trend"] is not None], key=lambda row: (-row["trend"], row["student_name"]))[:5]
    summer_support = sorted([row for row in students if (row["annual_average"] is not None and row["annual_average"] < 10) or row["risk_score"] >= 50],
                            key=lambda row: (-row["risk_score"], row["student_name"]))[:8]
    term_averages = [term_data[str(t)]["average"] for t in (1, 2, 3) if term_data[str(t)]["average"] is not None]
    year_trend = round(term_averages[-1] - term_averages[0], 2) if len(term_averages) >= 2 else None
    activity = {
        "sessions_done": Session.objects.filter(owner=local_user(), school_class=cls, status="done").count(),
        "courses_done": base["curriculum"]["done_count"], "courses_total": base["curriculum"]["total_courses"],
        "curriculum_percent": base["curriculum"]["percent"],
        "assignments_total": base["assignments"]["total"], "assignment_completion": base["assignments"]["completion_rate"],
        "support_plans": base["support"]["plans"], "support_completed": base["support"]["completed_plans"],
        "communications": base["support"]["communications"],
        "follow_up_records": StudentFollowUpRecord.objects.filter(student__school_class=cls).count(),
        "attendance_records": base["attendance"]["records"], "attendance_rate": base["attendance"]["attendance_rate"],
        "meetings": Meeting.objects.filter(owner=local_user(), school_class=cls).count(),
        "tasks_done": TeacherTask.objects.filter(owner=local_user(), school_class=cls, status="done").count(),
        "tasks_total": TeacherTask.objects.filter(owner=local_user(), school_class=cls).count(),
    }
    highlights = []
    if term_averages:
        highlights.append(f"المعدل السنوي العام للفوج: {base['marks']['annual_average'] if base['marks']['annual_average'] is not None else '—'}/20 عبر {len(term_averages)} ثلاثيات موثقة.")
    if year_trend is not None:
        highlights.append(f"مسار الفوج خلال السنة: {'تحسّن' if year_trend > 0 else 'تراجع' if year_trend < 0 else 'استقرار'} بمقدار {abs(year_trend)} نقطة بين أول وآخر ثلاثي.")
    highlights.append(f"أُنجز {activity['courses_done']} من {activity['courses_total']} دروسًا ({activity['curriculum_percent']}٪) في {activity['sessions_done']} حصة موثقة.")
    if activity["assignments_total"]:
        highlights.append(f"نسبة تسليم المهام والواجبات على مدار السنة: {activity['assignment_completion']}٪.")
    if top_year:
        highlights.append(f"في مقدمة الفوج سنويًا: {top_year[0]['student_name']} بمعدل {top_year[0]['annual_average']}/20.")
    if summer_support:
        highlights.append(f"{len(summer_support)} تلميذًا يُقترح إدراجهم في دعم صيفي أو متابعة خاصة عند الدخول المدرسي.")
    recommendations = []
    if summer_support:
        recommendations.append("إعداد قائمة دعم صيفية للتلاميذ ذوي المعدلات الضعيفة أو المخاطرة العالية ومتابعتهم عند الدخول.")
    if activity["attendance_rate"] is not None and activity["attendance_rate"] < 90:
        recommendations.append("وضع خطة حضور للسنة المقبلة تستهدف التلاميذ كثيري الغياب منذ الأسابيع الأولى.")
    if activity["assignment_completion"] < 80 and activity["assignments_total"]:
        recommendations.append("اعتماد آجال مرحلية للمهام منذ بداية السنة لرفع نسبة التسليم.")
    if activity["curriculum_percent"] < 100:
        recommendations.append(f"استكمال الدروس المتبقية ({activity['courses_total'] - activity['courses_done']}) في مطلع السنة المقبلة أو دمجها في حصص مراجعة.")
    recommendations.append("الاحتفاظ بنسخة احتياطية كاملة من بيانات السنة قبل انطلاق السنة الجديدة (مركز النسخ الاحتياطي).")
    return {
        "class": base["class"], "terms": term_data,
        "annual_average": base["marks"]["annual_average"], "year_trend": year_trend,
        "students_count": len(students),
        "top_year": [{"student_id": row["student_id"], "student_name": row["student_name"], "annual_average": row["annual_average"]} for row in top_year],
        "most_improved": [{"student_id": row["student_id"], "student_name": row["student_name"], "trend": row["trend"], "annual_average": row["annual_average"]} for row in improved if row["trend"] and row["trend"] > 0][:5],
        "summer_support": [{"student_id": row["student_id"], "student_name": row["student_name"], "annual_average": row["annual_average"], "risk_score": row["risk_score"]} for row in summer_support],
        "activity": activity, "highlights": highlights, "recommendations": recommendations,
    }


def _build_year_review():
    user = local_user()
    classes = [ _build_year_review_class(cls) for cls in SchoolClass.objects.filter(owner=user).order_by("name") ]
    year_start, _year_end = _academic_year()
    return {
        "school_year": f"{year_start.year} / {year_start.year + 1}",
        "classes": classes,
        "totals": {
            "classes": len(classes),
            "students": Student.objects.filter(school_class__owner=user).count(),
            "sessions_done": Session.objects.filter(owner=user, status="done").count(),
            "documents": CustomDocument.objects.filter(owner=user).count(),
            "meetings": Meeting.objects.filter(owner=user).count(),
            "support_plans": SupportPlan.objects.filter(student__school_class__owner=user).count(),
            "communications": ParentCommunication.objects.filter(student__school_class__owner=user).count(),
            "tasks_done": TeacherTask.objects.filter(owner=user, status="done").count(),
            "tasks_total": TeacherTask.objects.filter(owner=user).count(),
        },
    }


class YearReviewView(APIView):
    def get(self, request):
        return Response(_build_year_review())


class YearReviewDocumentView(APIView):
    def post(self, request):
        user = local_user()
        class_id = request.data.get("class_id")
        review = _build_year_review()
        selected = review["classes"]
        if class_id:
            cls = _owned_school_class(class_id)
            if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
            selected = [row for row in selected if row["class"]["id"] == cls.id]
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        blocks = [docs_builder.cover("تقرير الحصيلة السنوية", f"مادة الإعلام الآلي — السنة الدراسية {review['school_year']}",
                                     [f"الأستاذ(ة): {teacher or '—'}", f"المؤسسة: {school or '—'}", f"تاريخ الإعداد: {datetime.date.today()}"])]
        for index, row in enumerate(selected):
            terms_rows = [[row["terms"][str(t)]["label"], str(row["terms"][str(t)]["average"] if row["terms"][str(t)]["average"] is not None else "—"),
                           f"{row['terms'][str(t)]['success_rate']}٪" if row["terms"][str(t)]["success_rate"] is not None else "—",
                           str(row["terms"][str(t)]["graded"])] for t in (1, 2, 3)]
            top_rows = [[str(i + 1), item["student_name"], str(item["annual_average"])] for i, item in enumerate(row["top_year"])]
            support_rows = [[item["student_name"], str(item["annual_average"] if item["annual_average"] is not None else "—"), f"{item['risk_score']}/100"] for item in row["summer_support"]]
            activity = row["activity"]
            blocks.append(docs_builder.fields([("الفوج", row["class"]["name"]), ("المستوى", row["class"]["level"]),
                                               ("عدد التلاميذ", str(row["students_count"])), ("المعدل السنوي العام", str(row["annual_average"] if row["annual_average"] is not None else "—")),
                                               ("مسار السنة", str(row["year_trend"]) if row["year_trend"] is not None else "—")],
                                              f"حصيلة فوج {row['class']['name']}"))
            blocks.append(docs_builder.table(["الثلاثي", "معدل الفوج", "نسبة النجاح", "تلاميذ مقيّمون"], terms_rows, "نتائج الثلاثيات"))
            blocks.append(docs_builder.table(["المؤشر", "القيمة"], [
                ["حصص منفذة موثقة", str(activity["sessions_done"])], ["تقدم المقرر", f"{activity['curriculum_percent']}٪ ({activity['courses_done']}/{activity['courses_total']})"],
                ["تسليم المهام", f"{activity['assignment_completion']}٪"], ["نسبة الحضور", f"{activity['attendance_rate']}٪" if activity["attendance_rate"] is not None else "—"],
                ["خطط دعم (مكتملة)", f"{activity['support_plans']} ({activity['support_completed']})"], ["تواصل مع الأولياء", str(activity["communications"])],
                ["اجتماعات موثقة", str(activity["meetings"])], ["مهام منجزة", f"{activity['tasks_done']}/{activity['tasks_total']}"]], "نشاط السنة"))
            if top_rows: blocks.append(docs_builder.table(["#", "التلميذ", "المعدل السنوي"], top_rows, "أوائل الفوج في السنة"))
            if support_rows: blocks.append(docs_builder.table(["التلميذ", "المعدل السنوي", "المخاطرة"], support_rows, "تلاميذ يُقترح دعمهم صيفًا"))
            blocks.append(docs_builder.checklist(row["highlights"], "أبرز حصائل السنة"))
            blocks.append(docs_builder.checklist(row["recommendations"], "توصيات للسنة المقبلة"))
            if index < len(selected) - 1:
                blocks.append(docs_builder.pagebreak())
        blocks.append(docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"]))
        title_suffix = selected[0]["class"]["name"] if class_id and selected else "كل الأفواج"
        doc = CustomDocument.objects.create(owner=user, title=f"تقرير الحصيلة السنوية — {title_suffix} ({review['school_year']})",
            kind="report-card", orientation="portrait", content={"blocks": blocks},
            tags=["حصيلة سنوية", review["school_year"]], source_type="year-review",
            source_id=class_id if class_id else None)
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ design studio: themes & page composer
JOURNAL_SECTIONS = [
    {"key": "cover", "label": "صفحة الغلاف"},
    {"key": "profile_card", "label": "بطاقة الحالة الشخصية والمهنية"},
    {"key": "holidays", "label": "العطل المدرسية والمناسبات"},
    {"key": "seminars", "label": "الندوات والملتقيات والأيام التكوينية"},
    {"key": "weekly_schedule", "label": "برنامج العمل الأسبوعي"},
    {"key": "sessions_log", "label": "سجلّ الحصص المنفَّذة"},
    {"key": "classes_progress", "label": "الأفواج وتقدّم المقرر"},
    {"key": "term_summary", "label": "ملخص نتائج الأفواج"},
    {"key": "notes", "label": "صفحات الملاحظات"},
]
JOURNAL_DEFAULT_SECTIONS = ["cover", "profile_card", "holidays", "seminars", "weekly_schedule", "sessions_log", "notes"]
INSPECTOR_SECTIONS = [
    {"key": "cover", "label": "صفحة الغلاف"},
    {"key": "profile_card", "label": "بطاقة الحالة الشخصية والمهنية"},
    {"key": "institutions", "label": "مؤسسات مقاطعة التفتيش"},
    {"key": "holidays", "label": "العطل المدرسية والمناسبات"},
    {"key": "seminars", "label": "الندوات والملتقيات"},
    {"key": "weekly_schedule", "label": "برنامج العمل الأسبوعي"},
    {"key": "visits", "label": "سجلّ الزيارات التفتيشية"},
    {"key": "observation", "label": "شبكة ملاحظة الحصة وتقييمها"},
    {"key": "follow_up", "label": "سجلّ متابعة الأساتذة والمؤسسات"},
    {"key": "notes", "label": "صفحات الملاحظات"},
]
INSPECTOR_DEFAULT_SECTIONS = [row["key"] for row in INSPECTOR_SECTIONS]


class DesignSectionsView(APIView):
    def get(self, request):
        return Response({
            "journal": {"sections": JOURNAL_SECTIONS, "default_sections": JOURNAL_DEFAULT_SECTIONS},
            "inspector": {"sections": INSPECTOR_SECTIONS, "default_sections": INSPECTOR_DEFAULT_SECTIONS},
            "patterns": [{"key": key, "label": label} for key, label in Theme._meta.get_field("pattern").choices],
            "cover_styles": [{"key": key, "label": label} for key, label in Theme._meta.get_field("cover_style").choices],
            "heading_fonts": ["Tajawal", "IBM Plex Sans Arabic", "Amiri", "Scheherazade New", "Aref Ruqaa", "Lalezar"],
            "body_fonts": ["IBM Plex Sans Arabic", "Tajawal", "Amiri", "Scheherazade New"],
        })



# ------------------------------------------------------------------ revision & exam season centre
EXAM_SEASON_LABELS = {1: "الثلاثي الأول", 2: "الثلاثي الثاني", 3: "الثلاثي الثالث"}


def _safe_term(value, default=1):
    try: term = int(value or default)
    except (TypeError, ValueError): return default
    return term if term in (1, 2, 3) else default


def _exam_season_lessons(cls, term, user, today=None):
    today = today or datetime.date.today()
    sessions = [row for row in Session.objects.filter(owner=user, school_class=cls, status="done", course__isnull=False)
                .select_related("course").order_by("date") if _term_for_date(row.date) == term]
    by_course = {}
    for row in sessions:
        entry = by_course.setdefault(row.course_id, {"course": row.course, "sessions": 0, "last": row.date})
        entry["sessions"] += 1
        entry["last"] = max(entry["last"], row.date)
    question_counts = {}
    for item in QuestionBankItem.objects.filter(owner=user, course_id__in=list(by_course.keys())):
        question_counts[item.course_id] = question_counts.get(item.course_id, 0) + 1
    lessons = []
    for course_id, entry in by_course.items():
        course = entry["course"]
        days = max((today - entry["last"]).days, 0)
        questions = question_counts.get(course_id, 0)
        priority_score = round(min(days, 60) / 60 * 70 + (30 if questions == 0 else max(0, 30 - questions * 8)))
        lessons.append({
            "course_id": course.id, "title": course.title, "domain": course.domain, "unit": course.unit,
            "sessions_count": entry["sessions"], "last_taught": str(entry["last"]), "days_since": days,
            "questions_count": questions, "priority_score": priority_score,
            "priority": "عالية" if priority_score >= 55 else "متوسطة" if priority_score >= 30 else "منخفضة",
        })
    lessons.sort(key=lambda row: (-row["priority_score"], row["title"]))
    return lessons


def _build_exam_season(cls, term=1):
    user = local_user()
    today = datetime.date.today()
    students = list(cls.students.prefetch_related("marks", "attendance_records", "assignment_submissions__assignment").order_by("full_name"))
    lessons = _exam_season_lessons(cls, term, user, today)
    total_students = len(students)
    averages, complete = [], 0
    continuous_filled = supervised_filled = 0
    at_risk = []
    for student in students:
        mark = next((row for row in student.marks.all() if row.term == term), None)
        if mark:
            if mark.continuous is not None: continuous_filled += 1
            if mark.supervised is not None: supervised_filled += 1
            if mark.average is not None:
                complete += 1
                averages.append(mark.average)
        absences = sum(1 for row in student.attendance_records.all() if row.status == "absent")
        reasons = []
        if mark is None or mark.average is None:
            reasons.append("نقاط الثلاثي غير مكتملة")
        elif mark.average < 10:
            reasons.append(f"معدل الثلاثي {mark.average} دون 10")
        if absences >= 3:
            reasons.append(f"{absences} غيابات مسجلة")
        risk = _student_risk(student)
        if risk["risk_score"] >= 50:
            reasons.append(f"درجة مخاطرة {risk['risk_score']}/100")
        if reasons:
            at_risk.append({
                "student_id": student.id, "student_name": student.full_name,
                "average": mark.average if mark else None, "absences": absences,
                "risk_score": risk["risk_score"], "reasons": reasons,
            })
    at_risk.sort(key=lambda row: (row["average"] is None, row["average"] if row["average"] is not None else 0, -row["risk_score"]))
    marks_component = round((continuous_filled + supervised_filled) * 100 / (2 * total_students)) if total_students else 0
    questions_component = round(sum(1 for row in lessons if row["questions_count"] > 0) * 100 / len(lessons)) if lessons else 0
    risk_component = round(100 - len(at_risk) * 100 / total_students) if total_students else 0
    attendance_rows = AttendanceRecord.objects.filter(student__school_class=cls)
    attended = attendance_rows.filter(status__in=["present", "late", "left_early"]).count()
    attendance_rate = round(attended * 100 / attendance_rows.count(), 1) if attendance_rows.exists() else None
    readiness = round(0.35 * marks_component + 0.25 * questions_component + 0.25 * risk_component
                      + 0.15 * (attendance_rate if attendance_rate is not None else marks_component))
    readiness_label = ("جاهزية عالية" if readiness >= 80 else "جاهز تقريبًا" if readiness >= 60
                       else "يحتاج دفعًا أخيرًا" if readiness >= 40 else "بداية التحضير")
    bank_total = sum(row["questions_count"] for row in lessons)
    return {
        "class": {"id": cls.id, "name": cls.name, "level": cls.level, "students_count": total_students},
        "term": term, "term_label": EXAM_SEASON_LABELS[term],
        "readiness": {"score": readiness, "label": readiness_label,
                      "parts": {"marks_completeness": marks_component, "questions_coverage": questions_component,
                                "students_clear": risk_component, "attendance": attendance_rate}},
        "stats": {"students": total_students, "graded_complete": complete,
                  "average": _analytics_avg(averages),
                  "success_rate": round(sum(1 for value in averages if value >= 10) * 100 / len(averages), 1) if averages else None,
                  "lessons_taught": len(lessons), "bank_questions": bank_total,
                  "lessons_without_questions": sum(1 for row in lessons if row["questions_count"] == 0)},
        "lessons": lessons,
        "at_risk": at_risk[:30],
        "at_risk_count": len(at_risk),
    }


def _mock_exam_selection(cls, term, count):
    user = local_user()
    lessons = _exam_season_lessons(cls, term, user)
    taught_ids = [row["course_id"] for row in lessons]
    if not taught_ids: return [], lessons
    difficulty_rank = {"سهل": 0, "متوسط": 1, "صعب": 2}
    pool = list(QuestionBankItem.objects.filter(owner=user, course_id__in=taught_ids).select_related("course"))
    queues = {}
    for item in pool:
        queues.setdefault(item.course_id, []).append(item)
    course_order = {row["course_id"]: index for index, row in enumerate(lessons)}
    for queue in queues.values():
        queue.sort(key=lambda item: (difficulty_rank.get(item.difficulty, 1), item.id))
    ordered_courses = sorted(queues.keys(), key=lambda cid: course_order.get(cid, 99))
    selected = []
    while len(selected) < count and any(queues.values()):
        for cid in ordered_courses:
            if queues.get(cid):
                selected.append(queues[cid].pop(0))
                if len(selected) >= count: break
    return selected, lessons


class ExamSeasonOverviewView(APIView):
    def get(self, request):
        term = _safe_term(request.query_params.get("term"), 1)
        rows = []
        for cls in SchoolClass.objects.filter(owner=local_user()).order_by("name"):
            data = _build_exam_season(cls, term)
            rows.append({"class": data["class"], "readiness": data["readiness"], "stats": data["stats"],
                         "at_risk_count": data["at_risk_count"]})
        return Response({"term": term, "term_label": EXAM_SEASON_LABELS[term], "classes": rows})


class ExamSeasonClassView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        return Response(_build_exam_season(cls, _safe_term(request.query_params.get("term"), 1)))


class ExamSeasonPackView(APIView):
    def post(self, request):
        user = local_user()
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        term = _safe_term(request.data.get("term"), 1)
        data = _build_exam_season(cls, term)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        lesson_rows = [[str(i + 1), row["title"], row["last_taught"], f"منذ {row['days_since']} يوم",
                        str(row["questions_count"]), row["priority"]] for i, row in enumerate(data["lessons"])]
        risk_rows = [[row["student_name"], str(row["average"]) if row["average"] is not None else "—",
                      "؛ ".join(row["reasons"])] for row in data["at_risk"]]
        actions = [f"مراجعة درس «{row['title']}» — أولوية {row['priority']} (دُرّس منذ {row['days_since']} يوم)" for row in data["lessons"][:8]]
        actions += ["استكمال إدخال نقاط التقويم المستمر والفروض المحروسة قبل الاختبار",
                    "جلسة دعم مركزة للتلاميذ في قائمة الاهتمام قبل موعد الاختبار",
                    "توليد موضوع اختبار تجريبي من بنك الأسئلة وتدريب التلاميذ عليه",
                    "مراجعة دفتر التنقيط والتأكد من اكتمال كل الخانات"]
        blocks = [docs_builder.cover(f"حزمة المراجعة والامتحانات — {cls.name}", f"مادة الإعلام الآلي — {data['term_label']}",
                                     [f"الأستاذ(ة): {teacher or '—'}", f"المؤسسة: {school or '—'}", f"تاريخ الإعداد: {datetime.date.today()}"]),
                  docs_builder.fields([("الفوج", cls.name), ("المستوى", cls.level), ("الثلاثي", data["term_label"]),
                                       ("جاهزية الامتحان", f"{data['readiness']['score']}٪ — {data['readiness']['label']}"),
                                       ("دروس دُرّست هذا الثلاثي", str(data["stats"]["lessons_taught"])),
                                       ("أسئلة بنك جاهزة", str(data["stats"]["bank_questions"])),
                                       ("تلاميذ يحتاجون اهتمامًا", str(data["at_risk_count"]))], "مؤشرات الجاهزية"),
                  docs_builder.table(["#", "الدرس", "آخر تدريس", "القدم", "أسئلة البنك", "أولوية المراجعة"], lesson_rows, "خطة مراجعة الدروس (مرتبة بالأولوية)") if lesson_rows else docs_builder.text("لا حصص منفذة موثقة في هذا الثلاثي بعد."),
                  docs_builder.table(["التلميذ", "المعدل", "أسباب الاهتمام"], risk_rows, "تلاميذ يحتاجون دعمًا قبل الاختبار") if risk_rows else docs_builder.text("لا تلاميذ في قائمة الاهتمام — أحسنت."),
                  docs_builder.checklist(actions, "قائمة مهام أسبوع الامتحانات"),
                  docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"])]
        doc = CustomDocument.objects.create(owner=user, title=f"حزمة المراجعة والامتحانات — {cls.name} ({data['term_label']})",
            kind="revision-pack", orientation="portrait", content={"blocks": blocks},
            tags=["مراجعة", "امتحانات", data["term_label"]], source_type="exam-season", source_id=cls.id)
        return Response(CustomDocumentSerializer(doc).data, status=201)


class ExamSeasonMockExamView(APIView):
    def post(self, request):
        user = local_user()
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        term = _safe_term(request.data.get("term"), 1)
        try: count = int(request.data.get("count") or 10)
        except (TypeError, ValueError): count = 10
        count = max(1, min(30, count))
        selected, _lessons = _mock_exam_selection(cls, term, count)
        if not selected:
            return Response({"detail": "لا توجد أسئلة في بنك الأسئلة مرتبطة بدروس هذا الثلاثي — أضف أسئلة أولًا من بنك الأسئلة."}, status=400)
        data = _build_exam_season(cls, term)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        total_points = sum(item.points for item in selected)
        include_answers = bool(request.data.get("include_answers"))
        blocks = [docs_builder.cover(f"اختبار تجريبي — {cls.name}", f"مادة الإعلام الآلي — {data['term_label']} (موضوع تدريبي من بنك الأسئلة)",
                                     [f"المؤسسة: {school or '—'}", f"الأستاذ(ة): {teacher or '—'}", f"التاريخ: {datetime.date.today()}"]),
                  docs_builder.fields([("المستوى", cls.level), ("المدة", "ساعة واحدة"), ("عدد الأسئلة", str(len(selected))),
                                       ("المجموع", f"{total_points:g} نقطة")], "معلومات الاختبار"),
                  docs_builder.text("تعليمات: أجب عن جميع الأسئلة بوضوح. هذا الموضوع تدريبي وُلّد تلقائيًا من بنك الأسئلة لدروس هذا الثلاثي."),
                  docs_builder.questions([item.as_block_question() for item in selected], "الأسئلة", show_answers=include_answers),
                  docs_builder.signatures(["الأستاذ(ة)"])]
        doc = CustomDocument.objects.create(owner=user, title=f"اختبار تجريبي — {cls.name} ({data['term_label']})",
            kind="exam", orientation="portrait", content={"blocks": blocks},
            tags=["اختبار تجريبي", "بنك الأسئلة", data["term_label"]], source_type="exam-season", source_id=cls.id)
        return Response({**CustomDocumentSerializer(doc).data, "questions_used": len(selected), "total_points": total_points}, status=201)



# ------------------------------------------------------------------ end-of-term ceremony & certificates centre
CEREMONY_TIERS = [
    {"key": "excellence", "label": "امتياز", "min": 16},
    {"key": "felicitations", "label": "تهنئة", "min": 14},
    {"key": "encouragement", "label": "تشجيع", "min": 12},
    {"key": "honour", "label": "لوحة الشرف", "min": 10},
]


def _ceremony_tier(average):
    if average is None: return None
    for tier in CEREMONY_TIERS:
        if average >= tier["min"]: return tier
    return None


def _build_ceremony(cls, term=1):
    students = list(cls.students.prefetch_related("marks", "attendance_records").order_by("full_name"))
    ranked, improved = [], []
    attendance_awards = []
    for student in students:
        marks = {row.term: row for row in student.marks.all()}
        mark = marks.get(term)
        average = mark.average if mark else None
        tier = _ceremony_tier(average)
        previous = marks.get(term - 1).average if term > 1 and marks.get(term - 1) else None
        delta = round(average - previous, 2) if average is not None and previous is not None else None
        row = {"student_id": student.id, "student_name": student.full_name, "average": average,
               "tier": tier["label"] if tier else None, "tier_key": tier["key"] if tier else None,
               "previous_average": previous, "improvement": delta}
        if average is not None: ranked.append(row)
        if delta is not None and delta > 0: improved.append(row)
        term_records = [r for r in student.attendance_records.all() if _term_for_date(r.date) == term]
        if len(term_records) >= 5:
            attended = sum(1 for r in term_records if r.status in ("present", "late", "left_early"))
            rate = round(attended * 100 / len(term_records), 1)
            if rate >= 95: attendance_awards.append({"student_id": student.id, "student_name": student.full_name, "attendance_rate": rate})
    ranked.sort(key=lambda row: (-row["average"], row["student_name"]))
    for index, row in enumerate(ranked): row["rank"] = index + 1
    improved.sort(key=lambda row: (-row["improvement"], row["student_name"]))
    tier_counts = {tier["label"]: sum(1 for row in ranked if row["tier"] == tier["label"]) for tier in CEREMONY_TIERS}
    return {
        "class": {"id": cls.id, "name": cls.name, "level": cls.level, "students_count": len(students)},
        "term": term, "term_label": EXAM_SEASON_LABELS[term],
        "ranked": ranked,
        "podium": ranked[:3],
        "tier_counts": tier_counts,
        "eligible": sum(1 for row in ranked if row["tier"]),
        "improved": improved[:5],
        "attendance_awards": attendance_awards,
    }


class CeremonyOverviewView(APIView):
    def get(self, request):
        term = _safe_term(request.query_params.get("term"), 1)
        rows = []
        for cls in SchoolClass.objects.filter(owner=local_user()).order_by("name"):
            data = _build_ceremony(cls, term)
            rows.append({"class": data["class"], "tier_counts": data["tier_counts"], "eligible": data["eligible"],
                         "podium": data["podium"], "improved_top": data["improved"][0] if data["improved"] else None})
        return Response({"term": term, "term_label": EXAM_SEASON_LABELS[term], "classes": rows})


class CeremonyClassView(APIView):
    def get(self, request, pk):
        cls = _owned_school_class(pk)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        return Response(_build_ceremony(cls, _safe_term(request.query_params.get("term"), 1)))


class CeremonyCertificatesView(APIView):
    def post(self, request):
        user = local_user()
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        term = _safe_term(request.data.get("term"), 1)
        data = _build_ceremony(cls, term)
        mode = request.data.get("mode") or "tiers"
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else "الأستاذ(ة)"; school = profile.current_school if profile and profile.current_school else ""
        blocks = []
        total = 0
        if mode == "top":
            try: top_n = max(1, int(request.data.get("top_n") or 3))
            except (TypeError, ValueError): top_n = 3
            chosen = data["ranked"][:top_n]
            if chosen:
                blocks.append({"type": "certificates", "title": "شهادة تقدير وتفوق",
                               "text": f"تقديرًا للحصول على أحد المراتب الأولى في مادة الإعلام الآلي خلال {data['term_label']} بقسم {cls.name}، مع تمنياتنا بمزيد من النجاح والتميز.",
                               "names": [row["student_name"] for row in chosen], "signer": teacher, "date": str(datetime.date.today())})
                total = len(chosen)
        else:
            for tier in CEREMONY_TIERS:
                names = [row["student_name"] for row in data["ranked"] if row["tier"] == tier["label"]]
                if not names: continue
                blocks.append({"type": "certificates", "title": f"شهادة {tier['label']}",
                               "text": f"تقديرًا للحصول على تقدير «{tier['label']}» في مادة الإعلام الآلي خلال {data['term_label']} بقسم {cls.name}، مع تمنياتنا بمزيد من النجاح والتميز.",
                               "names": names, "signer": teacher, "date": str(datetime.date.today())})
                total += len(names)
        if not blocks:
            return Response({"detail": "لا تلاميذ مؤهلين للشهادات في هذا الثلاثي بعد — تأكد من اكتمال النقاط."}, status=400)
        doc = CustomDocument.objects.create(owner=user, title=f"شهادات التكريم — {cls.name} ({data['term_label']})",
            kind="certificate", orientation="landscape", content={"blocks": blocks},
            tags=["شهادات", "تكريم", data["term_label"]], source_type="ceremony", source_id=cls.id)
        return Response({**CustomDocumentSerializer(doc).data, "certificates_count": total}, status=201)


class CeremonyHonourBoardView(APIView):
    def post(self, request):
        user = local_user()
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        term = _safe_term(request.data.get("term"), 1)
        data = _build_ceremony(cls, term)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        tier_rows = [[tier["label"], str(data["tier_counts"][tier["label"]]),
                      "، ".join(row["student_name"] for row in data["ranked"] if row["tier"] == tier["label"]) or "—"]
                     for tier in CEREMONY_TIERS]
        rank_rows = [[str(row["rank"]), row["student_name"], str(row["average"]), row["tier"] or "—"] for row in data["ranked"]]
        improved_rows = [[row["student_name"], str(row["previous_average"]), str(row["average"]), f"+{row['improvement']}"] for row in data["improved"]]
        blocks = [docs_builder.cover(f"لوحة شرف {cls.name}", f"مادة الإعلام الآلي — {data['term_label']} — المتفوقون والمتميزون",
                                     [f"المؤسسة: {school or '—'}", f"الأستاذ(ة): {teacher or '—'}", f"تاريخ الإعداد: {datetime.date.today()}"]),
                  docs_builder.table(["التقدير", "العدد", "التلاميذ"], tier_rows, "المتكرمون حسب التقدير"),
                  docs_builder.table(["المرتبة", "التلميذ", "المعدل", "التقدير"], rank_rows, "الترتيب الكامل للفوج") if rank_rows else docs_builder.text("لا نقاط مكتملة في هذا الثلاثي بعد."),
                  docs_builder.table(["التلميذ", "الثلاثي السابق", "هذا الثلاثي", "التحسن"], improved_rows, "أبطال التحسن") if improved_rows else docs_builder.text("يظهر أبطال التحسن ابتداءً من الثلاثي الثاني بمقارنة المعدلات."),
                  docs_builder.checklist(["طباعة شهادات التكريم من مركز الحفل وتوقيعها",
                                          "تعليق لوحة الشرف في القسم قبل حصة التكريم",
                                          "إشعار أولياء المتكرمين برسالة تهنئة",
                                          "توثيق الحفل بصور وأرشفتها في ملف التفتيش"], "قائمة مهام حفل التكريم"),
                  docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"])]
        doc = CustomDocument.objects.create(owner=user, title=f"لوحة الشرف — {cls.name} ({data['term_label']})",
            kind="poster", orientation="portrait", content={"blocks": blocks},
            tags=["لوحة شرف", "تكريم", data["term_label"]], source_type="ceremony", source_id=cls.id)
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ parent meeting day centre
def _meeting_candidates(cls, term, audience):
    students = list(cls.students.prefetch_related("marks", "attendance_records", "assignment_submissions__assignment").order_by("full_name"))
    rows = []
    for student in students:
        mark = next((row for row in student.marks.all() if row.term == term), None)
        average = mark.average if mark else None
        absences = sum(1 for row in student.attendance_records.all() if row.status == "absent" and _term_for_date(row.date) == term)
        risk = _student_risk(student)
        topics, priority = [], 0
        if audience == "at_risk":
            if mark is None or average is None:
                topics.append("نقاط الثلاثي غير مكتملة"); priority += 40
            elif average < 10:
                topics.append(f"معدل الثلاثي {average} دون 10 — خطة دعم"); priority += 60
            if absences >= 3:
                topics.append(f"غيابات متكررة ({absences})"); priority += 25
            if risk["risk_score"] >= 50:
                topics.append(f"متابعة الدعم (مخاطرة {risk['risk_score']}/100)"); priority += 20
            if not topics: continue
        elif audience == "watch":
            if average is None or not (10 <= average < 12): continue
            topics.append(f"تشجيع ومتابعة التقدم (المعدل {average})"); priority = 30
        elif audience == "honours":
            if average is None or average < 14: continue
            topics.append(f"تهنئة وتشجيع التفوق (المعدل {average})"); priority = round(average)
        else:
            topics.append("لقاء متابعة دوري للاطلاع على النتائج"); priority = 10
        rows.append({"student": student, "average": average, "absences": absences,
                     "risk_score": risk["risk_score"], "topics": topics, "priority": priority})
    rows.sort(key=lambda row: (-row["priority"], row["student"].full_name))
    return rows


class ParentMeetingDayViewSet(viewsets.ModelViewSet):
    serializer_class = ParentMeetingDaySerializer

    def get_queryset(self):
        qs = ParentMeetingDay.objects.filter(owner=local_user()).select_related("school_class").prefetch_related("appointments__student")
        if self.request.query_params.get("school_class"):
            qs = qs.filter(school_class_id=self.request.query_params["school_class"])
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=local_user())

    @action(detail=True, methods=["post"], url_path="build-schedule")
    def build_schedule(self, request, pk=None):
        day = self.get_object()
        term = _safe_term(request.data.get("term"), 1)
        audience = request.data.get("audience") or "at_risk"
        if audience not in ("at_risk", "watch", "honours", "all"):
            return Response({"detail": "جمهور غير معروف."}, status=400)
        if day.appointments.exclude(status="scheduled").exists():
            return Response({"detail": "هذا اليوم فيه مواعيد منجزة أو ملغاة — أنشئ يومًا جديدًا لإعادة البناء."}, status=400)
        candidates = _meeting_candidates(day.school_class, term, audience)
        day.appointments.all().delete()
        start = datetime.datetime.combine(day.date, day.start_time)
        created = []
        for index, row in enumerate(candidates):
            slot_start = start + datetime.timedelta(minutes=day.slot_minutes * index)
            slot_end = slot_start + datetime.timedelta(minutes=day.slot_minutes)
            created.append(ParentAppointment.objects.create(
                day=day, student=row["student"], start_time=slot_start.time(), end_time=slot_end.time(),
                topics=row["topics"]))
        return Response({"created": len(created), "audience": audience,
                         "appointments": ParentAppointmentSerializer(created, many=True).data})

    @action(detail=True, methods=["post"], url_path=r"appointments/(?P<appt_id>[0-9]+)/status")
    def appointment_status(self, request, pk=None, appt_id=None):
        day = self.get_object()
        appointment = day.appointments.filter(id=appt_id).first()
        if not appointment: return Response({"detail": "الموعد غير موجود."}, status=404)
        status_value = request.data.get("status")
        if status_value not in dict(ParentAppointment.STATUSES):
            return Response({"detail": "حالة غير معروفة."}, status=400)
        appointment.status = status_value
        if "outcome" in request.data:
            appointment.outcome = str(request.data.get("outcome") or "")
        appointment.save()
        if status_value == "attended" and appointment.outcome and not appointment.communication_id:
            communication = ParentCommunication.objects.create(
                student=appointment.student, date=day.date, channel="meeting",
                subject=f"لقاء ولي — {day.title} ({day.school_class.name})",
                summary="؛ ".join(appointment.topics), outcome=appointment.outcome)
            appointment.communication = communication
            appointment.save(update_fields=["communication"])
        return Response(ParentAppointmentSerializer(appointment).data)

    @action(detail=True, methods=["post"], url_path="generate-invitations")
    def generate_invitations(self, request, pk=None):
        day = self.get_object()
        appointments = list(day.appointments.select_related("student").all())
        if not appointments:
            return Response({"detail": "ابنِ جدول المواعيد أولًا قبل توليد الدعوات."}, status=400)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else "الأستاذ(ة)"; school = profile.current_school if profile and profile.current_school else ""
        blocks = [docs_builder.cover(day.title, f"دعوات لقاء الأولياء — {day.school_class.name}",
                                     [f"المؤسسة: {school or '—'}", f"الأستاذ(ة): {teacher}", f"التاريخ: {day.date}"])]
        for index, appointment in enumerate(appointments):
            blocks.append(docs_builder.heading(f"دعوة لقاء — {appointment.student.full_name}"))
            blocks.append(docs_builder.fields([
                ("التلميذ(ة)", appointment.student.full_name), ("الفوج", day.school_class.name),
                ("تاريخ اللقاء", str(day.date)), ("الساعة", f"{appointment.start_time:%H:%M} — {appointment.end_time:%H:%M}"),
                ("المكان", day.location or "قاعة الأساتذة"), ("مواضيع اللقاء", "؛ ".join(appointment.topics) or "متابعة دورية"),
            ]))
            blocks.append(docs_builder.text("حضرة ولي التلميذ(ة)، ندعوكم لحضور لقاء مع أستاذ مادة الإعلام الآلي لمناقشة "
                                            "مسار ابنكم/ابنتكم الدراسي. حضوركم في الوقت المحدد يضمن حسن سير اللقاءات. شكرًا لتعاونكم."))
            if index < len(appointments) - 1: blocks.append(docs_builder.pagebreak())
        doc = CustomDocument.objects.create(owner=local_user(), title=f"دعوات لقاء الأولياء — {day.school_class.name} ({day.date})",
            kind="parent-letter", orientation="portrait", content={"blocks": blocks},
            tags=["لقاء أولياء", str(day.date)], source_type="parent-meeting-day", source_id=day.id)
        return Response({**CustomDocumentSerializer(doc).data, "invitations_count": len(appointments)}, status=201)

    @action(detail=True, methods=["post"], url_path="generate-agenda")
    def generate_agenda(self, request, pk=None):
        day = self.get_object()
        appointments = list(day.appointments.select_related("student").all())
        if not appointments:
            return Response({"detail": "ابنِ جدول المواعيد أولًا قبل توليد جدول اليوم."}, status=400)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else "الأستاذ(ة)"; school = profile.current_school if profile and profile.current_school else ""
        rows = [[f"{a.start_time:%H:%M} — {a.end_time:%H:%M}", a.student.full_name,
                 "؛ ".join(a.topics) or "متابعة", a.status_label] for a in appointments]
        stats = day.stats
        blocks = [docs_builder.cover(f"جدول يوم لقاء الأولياء — {day.school_class.name}", day.title,
                                     [f"المؤسسة: {school or '—'}", f"الأستاذ(ة): {teacher}", f"التاريخ: {day.date}",
                                      f"المكان: {day.location or 'قاعة الأساتذة'}"]),
                  docs_builder.fields([("عدد المواعيد", str(stats["total"])), ("حضر", str(stats["attended"])),
                                       ("لم يحضر", str(stats["no_show"])), ("ما زال مجدولًا", str(stats["scheduled"]))], "حالة اليوم"),
                  docs_builder.table(["الوقت", "التلميذ", "موضوع اللقاء", "الحالة"], rows, "مواعيد اليوم بالترتيب"),
                  docs_builder.checklist(["طباعة دعوات اللقاء وتوزيعها على التلاميذ قبل اليوم",
                                          "تحضير ملخص نتائج كل تلميذ مدعو (المعدل، الغيابات، المهام)",
                                          "تسجيل خلاصة كل لقاء مباشرة في مركز يوم اللقاء",
                                          "متابعة الغائبين برسالة أو مكالمة خلال الأسبوع"], "تحضيرات اليوم"),
                  docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"])]
        doc = CustomDocument.objects.create(owner=local_user(), title=f"جدول لقاء الأولياء — {day.school_class.name} ({day.date})",
            kind="report-card", orientation="portrait", content={"blocks": blocks},
            tags=["لقاء أولياء", "جدول يوم"], source_type="parent-meeting-day", source_id=day.id)
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ smart assistant weekly digest
ASSISTANT_LINKS = {
    "support-plan": "/support", "parent-communication": "/support", "student": "/support",
    "assignment": "/assignments", "session": "/follow-up", "course": "/lesson-plans",
    "holiday": "/calendar", "seminar": "/calendar", "visit": "/inspection",
}


def _build_digest():
    user = local_user()
    today = datetime.date.today()
    term = _term_for_date(today) or 1
    open_tasks = TeacherTask.objects.filter(owner=user, status__in=["pending", "in_progress"])
    existing = {(task.source_type, task.source_id, task.title) for task in open_tasks}
    items = []

    for row in _task_suggestions():
        items.append({
            "key": row["key"], "title": row["title"], "detail": row["description"],
            "category": row["category"], "category_label": row["category_label"],
            "severity": row["priority"], "due_date": row["due_date"], "reason": row["reason"],
            "already_added": row["already_added"], "source_type": row["source_type"],
            "source_id": row["source_id"], "student": row["student"], "school_class": row["school_class"],
            "link": ASSISTANT_LINKS.get(row["source_type"], "/actions"),
        })

    def add(key, title, detail, category, severity, due_date, source_type, source_id, link, reason,
            student=None, school_class=None):
        items.append({
            "key": key, "title": title, "detail": detail, "category": category,
            "category_label": dict(TeacherTask.CATEGORIES).get(category, category),
            "severity": severity, "due_date": str(due_date) if due_date else None, "reason": reason,
            "already_added": (source_type, source_id, title) in existing,
            "source_type": source_type, "source_id": source_id,
            "student": student.id if student else None,
            "school_class": school_class.id if school_class else None, "link": link,
        })

    for cls in SchoolClass.objects.filter(owner=user).order_by("name"):
        season = _build_exam_season(cls, term)
        if season["readiness"]["score"] < 60 and season["stats"]["lessons_taught"]:
            add(f"exam-readiness:{cls.id}:{term}", f"جاهزية امتحان {cls.name} منخفضة ({season['readiness']['score']}٪)",
                f"جاهزية {season['term_label']} لهذا الفوج دون 60٪ — راجع اكتمال النقاط وتغطية بنك الأسئلة وأولويات المراجعة.",
                "calendar", "high" if season["readiness"]["score"] < 40 else "medium",
                today + datetime.timedelta(days=5), "exam-season", cls.id, "/exam-season",
                "مؤشر جاهزية الامتحانات المحسوب من مركز المراجعة", school_class=cls)
        if season["stats"]["lessons_without_questions"]:
            add(f"bank-gap:{cls.id}:{term}", f"دروس بلا أسئلة بنك في {cls.name} ({season['stats']['lessons_without_questions']})",
                "دروس دُرّست هذا الثلاثي ولا يملك بنك الأسئلة أي سؤال لها — أضف أسئلة لتفعيل الاختبارات التجريبية.",
                "lesson", "medium", today + datetime.timedelta(days=7), "question-bank", cls.id, "/question-bank",
                "فجوة تغطية بنك الأسئلة لدروس الثلاثي", school_class=cls)
        incomplete = season["stats"]["students"] - season["stats"]["graded_complete"]
        if incomplete > 0 and season["stats"]["students"]:
            add(f"marks-gap:{cls.id}:{term}", f"نقاط غير مكتملة في {cls.name} ({incomplete} تلميذ)",
                f"ما زال {incomplete} تلميذ بلا معدل ثلاثي مكتمل — أكمل الإدخال من دفتر التنقيط قبل الاختبارات.",
                "document", "high" if incomplete >= 5 else "medium",
                today + datetime.timedelta(days=4), "gradebook", cls.id, "/gradebook",
                "اكتمال نقاط الثلاثي الحالي", school_class=cls)
        ceremony = _build_ceremony(cls, term)
        if ceremony["eligible"] >= 3 and incomplete == 0:
            add(f"ceremony:{cls.id}:{term}", f"شهادات جاهزة للتوليد في {cls.name} ({ceremony['eligible']} متكرم)",
                "اكتملت نقاط الثلاثي ويوجد متكرمون بانتظار شهاداتهم — ولّد الشهادات ولوحة الشرف من مركز الحفل.",
                "document", "low", today + datetime.timedelta(days=10), "ceremony", cls.id, "/ceremony",
                "اكتمال النتائج ووجود متكرمين", school_class=cls)

    for meeting in Meeting.objects.filter(owner=user).select_related("school_class"):
        for index, decision in enumerate(meeting.decisions or []):
            if decision.get("done"): continue
            due_raw = decision.get("due")
            try: due = datetime.date.fromisoformat(str(due_raw)) if due_raw else None
            except ValueError: due = None
            if due and due <= today + datetime.timedelta(days=7):
                add(f"meeting-decision:{meeting.id}:{index}", f"قرار اجتماع يقترب أجله: {str(decision.get('text', ''))[:60]}",
                    f"من اجتماع «{meeting.title}» بتاريخ {meeting.date} — المسؤول: {decision.get('responsible') or '—'}، الأجل: {due}.",
                    "general", "high" if due < today else "medium", due, "meeting", meeting.id, "/meetings",
                    "قرار اجتماع غير منجز قريب الأجل", school_class=meeting.school_class)

    for day in ParentMeetingDay.objects.filter(owner=user, date__gte=today, date__lte=today + datetime.timedelta(days=7)).select_related("school_class"):
        scheduled = day.appointments.filter(status="scheduled").count()
        if scheduled:
            add(f"parent-day:{day.id}", f"يوم لقاء أولياء قريب: {day.school_class.name} ({day.date})",
                f"{scheduled} موعد مجدول بانتظار طباعة الدعوات والتحضير.",
                "parent", "medium", day.date, "parent-meeting-day", day.id, "/parent-meetings",
                "يوم لقاء خلال الأسبوع ومواعيده جاهزة", school_class=day.school_class)

    for task in open_tasks.filter(due_date__lt=today).order_by("due_date")[:10]:
        add(f"task-overdue:{task.id}", f"مهمة متأخرة: {task.title}",
            f"كان أجلها {task.due_date} وما زالت {task.get_status_display()}.",
            "general", "high", task.due_date, "task", task.id, "/actions",
            "مهمة مفتوحة تجاوزت أجلها", school_class=task.school_class)

    rank = {"high": 0, "medium": 1, "low": 2}
    items.sort(key=lambda item: (item["already_added"], rank.get(item["severity"], 1), item["due_date"] or "9999-12-31", item["title"]))
    counts = {
        "total": len(items), "new": sum(1 for item in items if not item["already_added"]),
        "high": sum(1 for item in items if item["severity"] == "high"),
        "medium": sum(1 for item in items if item["severity"] == "medium"),
        "low": sum(1 for item in items if item["severity"] == "low"),
        "open_tasks": open_tasks.count(),
        "overdue_tasks": open_tasks.filter(due_date__lt=today).count(),
    }
    return {"generated_at": str(today), "term": term, "term_label": EXAM_SEASON_LABELS[term],
            "week_from": str(today), "week_to": str(today + datetime.timedelta(days=7)),
            "counts": counts, "focus": [item for item in items if not item["already_added"]][:5], "items": items}


class AssistantDigestView(APIView):
    def get(self, request):
        return Response(_build_digest())


class AssistantCreateTasksView(APIView):
    def post(self, request):
        digest = _build_digest()
        keys = request.data.get("keys")
        wanted = set(keys) if isinstance(keys, list) else None
        created, skipped = 0, 0
        valid_categories = dict(TeacherTask.CATEGORIES)
        for item in digest["items"]:
            if wanted is not None and item["key"] not in wanted: continue
            if item["already_added"]:
                skipped += 1
                continue
            due = None
            if item["due_date"]:
                try: due = datetime.date.fromisoformat(str(item["due_date"]))
                except ValueError: due = None
            TeacherTask.objects.create(
                owner=local_user(), title=item["title"], description=item["detail"],
                category=item["category"] if item["category"] in valid_categories else "general",
                priority=item["severity"] if item["severity"] in ("low", "medium", "high") else "medium",
                due_date=due, student_id=item["student"], school_class_id=item["school_class"],
                source_type=item["source_type"] or "", source_id=item["source_id"], origin="auto")
            created += 1
        return Response({"created": created, "skipped": skipped})



# ------------------------------------------------------------------ school year opening wizard
def _opening_status():
    user = local_user()
    year_start, year_end = _academic_year()
    year_label = f"{year_start.year} / {year_start.year + 1}"
    profile = _profile()
    classes = list(SchoolClass.objects.filter(owner=user).prefetch_related("students", "slots").order_by("name"))
    courses_count = Course.objects.filter(owner=user).count()
    journals = list(Journal.objects.filter(owner=user))
    year_journal = next((j for j in journals if year_label in (j.school_year or "")), None)
    holidays_count = Holiday.objects.filter(owner=user, start_date__gte=year_start, start_date__lte=year_end).count()
    classes_with_students = sum(1 for cls in classes if cls.students.count())
    classes_with_slots = sum(1 for cls in classes if cls.slots.count())
    total_students = sum(cls.students.count() for cls in classes)
    steps = [
        {"key": "profile", "label": "البطاقة الشخصية والمهنية", "done": bool(profile and profile.full_name and profile.current_school),
         "detail": (profile.full_name if profile and profile.full_name else "الاسم والمؤسسة غير مكتملين"), "link": "/profile"},
        {"key": "classes", "label": "إنشاء أفواج السنة", "done": len(classes) >= 1,
         "detail": f"{len(classes)} فوج منشأ", "link": "/classes"},
        {"key": "students", "label": "قوائم التلاميذ", "done": bool(classes) and classes_with_students == len(classes),
         "detail": f"{total_students} تلميذ — {classes_with_students}/{len(classes)} فوج بقوائم", "link": "/students"},
        {"key": "timetable", "label": "التوقيت الأسبوعي", "done": bool(classes) and classes_with_slots == len(classes),
         "detail": f"{classes_with_slots}/{len(classes)} فوج له حصص أسبوعية", "link": "/planner"},
        {"key": "courses", "label": "المقرر الدراسي", "done": courses_count >= 1,
         "detail": f"{courses_count} درس في المقرر", "link": "/courses"},
        {"key": "journal", "label": "الدفتر اليومي للسنة", "done": year_journal is not None,
         "detail": (year_journal.title if year_journal else f"لا دفتر بسنة {year_label} بعد"), "link": "/journals"},
        {"key": "holidays", "label": "عطل ومناسبات السنة", "done": holidays_count >= 1,
         "detail": f"{holidays_count} عطلة/مناسبة مسجلة هذا العام", "link": "/calendar"},
    ]
    done_count = sum(1 for step in steps if step["done"])
    return {"school_year": year_label, "year_start": str(year_start), "year_end": str(year_end),
            "steps": steps, "done": done_count, "total": len(steps),
            "readiness": round(done_count * 100 / len(steps)) if steps else 0,
            "classes": [{"id": cls.id, "name": cls.name, "level": cls.level,
                         "students": cls.students.count(), "slots": cls.slots.count()} for cls in classes]}


class OpeningStatusView(APIView):
    def get(self, request):
        return Response(_opening_status())


class OpeningQuickClassView(APIView):
    def post(self, request):
        name = str(request.data.get("name") or "").strip()
        if not name: return Response({"detail": "اسم الفوج مطلوب."}, status=400)
        cls = SchoolClass.objects.create(owner=local_user(), name=name,
                                         level=str(request.data.get("level") or "").strip(),
                                         students_count=int(request.data.get("students_count") or 0))
        return Response({"id": cls.id, "name": cls.name, "level": cls.level}, status=201)


class OpeningImportStudentsView(APIView):
    def post(self, request):
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        raw = str(request.data.get("names") or "")
        names, seen = [], set()
        for chunk in raw.replace(";", "\n").replace(",", "\n").splitlines():
            name = chunk.strip().strip(".-•")
            if name and name not in seen:
                seen.add(name)
                names.append(name)
        existing = set(cls.students.values_list("full_name", flat=True))
        created, skipped = 0, 0
        for name in names[:300]:
            if name in existing:
                skipped += 1
                continue
            Student.objects.create(school_class=cls, full_name=name)
            created += 1
        total = cls.students.count()
        if cls.students_count != total:
            cls.students_count = total
            cls.save(update_fields=["students_count"])
        return Response({"created": created, "skipped": skipped, "total_students": total})


class OpeningQuickSlotView(APIView):
    def post(self, request):
        cls = _owned_school_class(request.data.get("class_id"))
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        try:
            weekday = int(request.data.get("weekday"))
            start = datetime.time.fromisoformat(str(request.data.get("start_time") or "08:00"))
            end = datetime.time.fromisoformat(str(request.data.get("end_time") or "09:00"))
        except (TypeError, ValueError):
            return Response({"detail": "اليوم أو التوقيت غير صالح."}, status=400)
        if weekday not in range(7): return Response({"detail": "اليوم غير صالح."}, status=400)
        slot = TimetableSlot.objects.create(school_class=cls, weekday=weekday, start_time=start, end_time=end,
                                            room=str(request.data.get("room") or "مخبر الإعلام الآلي"))
        return Response({"id": slot.id, "weekday": weekday, "start_time": str(start), "end_time": str(end)}, status=201)


class OpeningQuickJournalView(APIView):
    def post(self, request):
        user = local_user()
        year_start, _ = _academic_year()
        year_label = f"{year_start.year} / {year_start.year + 1}"
        profile = _profile()
        theme = None
        if request.data.get("theme_id"):
            theme = Theme.objects.filter(id=request.data.get("theme_id")).first()
        journal = Journal.objects.create(
            owner=user, title=str(request.data.get("title") or f"الدفتر اليومي {year_label}").strip(),
            school_year=str(request.data.get("school_year") or year_label),
            institution=(profile.current_school if profile else "") or "",
            teacher_name=(profile.full_name if profile else "") or "", theme=theme)
        return Response({"id": journal.id, "title": journal.title, "school_year": journal.school_year}, status=201)


class OpeningChecklistView(APIView):
    def post(self, request):
        user = local_user()
        status = _opening_status()
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        step_rows = [[("✓" if step["done"] else "○"), step["label"], step["detail"]] for step in status["steps"]]
        class_rows = [[row["name"], row["level"], str(row["students"]), str(row["slots"])] for row in status["classes"]]
        next_steps = [f"استكمال: {step['label']} — {step['detail']}" for step in status["steps"] if not step["done"]]
        blocks = [docs_builder.cover("دليل افتتاح السنة الدراسية", f"مادة الإعلام الآلي — {status['school_year']}",
                                     [f"الأستاذ(ة): {teacher or '—'}", f"المؤسسة: {school or '—'}", f"تاريخ الإعداد: {datetime.date.today()}"]),
                  docs_builder.fields([("السنة الدراسية", status["school_year"]), ("جاهزية الافتتاح", f"{status['readiness']}٪ ({status['done']}/{status['total']})"),
                                       ("الأفواج", str(len(status["classes"])))], "حالة الافتتاح"),
                  docs_builder.table(["", "الخطوة", "الحالة"], step_rows, "قائمة تحقق الافتتاح"),
                  docs_builder.table(["الفوج", "المستوى", "التلاميذ", "الحصص الأسبوعية"], class_rows, "الأفواج المنشأة") if class_rows else docs_builder.text("لا أفواج منشأة بعد."),
                  docs_builder.checklist(next_steps or ["كل خطوات الافتتاح مكتملة — سنة موفقة!"], "الخطوات الموالية"),
                  docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"])]
        doc = CustomDocument.objects.create(owner=user, title=f"دليل افتتاح السنة الدراسية ({status['school_year']})",
            kind="report-card", orientation="portrait", content={"blocks": blocks},
            tags=["افتتاح السنة", status["school_year"]], source_type="opening-wizard", source_id=None)
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ inspection simulation centre
SIM_LEVELS = [(80, "ممتاز"), (65, "جيد"), (50, "مقبول"), (35, "ضعيف"), (0, "ضعيف جدًا")]


def _sim_level(percent):
    for threshold, label in SIM_LEVELS:
        if percent >= threshold: return label
    return "ضعيف جدًا"


def _build_inspection_simulation():
    user = local_user()
    today = datetime.date.today()
    term = _term_for_date(today) or 1
    profile = _profile()
    classes = list(SchoolClass.objects.filter(owner=user).order_by("name"))
    courses = list(Course.objects.filter(owner=user))
    sessions = list(Session.objects.filter(owner=user).select_related("course", "lesson_plan"))
    done = [row for row in sessions if row.status == "done"]
    plans = LessonPlan.objects.filter(owner=user)
    planned_ids = set(plans.exclude(course__isnull=True).values_list("course_id", flat=True))
    taught_ids = {row.course_id for row in done if row.course_id}
    plan_coverage = round(len(taught_ids & planned_ids) * 100 / len(taught_ids), 1) if taught_ids else 0
    courses_planned = round(len(planned_ids & {c.id for c in courses}) * 100 / len(courses), 1) if courses else 0
    journals = list(Journal.objects.filter(owner=user).order_by("-updated_at"))
    journal_percent = 0
    if journals:
        age = (today - journals[0].updated_at.date()).days
        journal_percent = 100 if age <= 30 else 70 if age <= 90 else 40
    documented = sum(1 for row in done if row.points_written or row.board_summary or row.homework or row.remarks)
    sessions_documented = round(documented * 100 / len(done), 1) if done else 0
    sessions_with_plan = round(sum(1 for row in done if row.lesson_plan_id) * 100 / len(done), 1) if done else 0
    homework_percent = round(sum(1 for row in done if row.homework) * 100 / len(done), 1) if done else 0
    recent_done = sum(1 for row in done if row.date >= today - datetime.timedelta(days=21))
    recent_percent = 100 if recent_done >= 3 else 60 if recent_done >= 1 else 0

    students = list(Student.objects.filter(school_class__in=classes).prefetch_related(
        "marks", "attendance_records", "follow_up_records", "support_plans", "assignment_submissions__assignment")) if classes else []
    students_total = len(students)
    graded_students = sum(1 for st in students if any(m.average is not None for m in st.marks.all()))
    gradebook_coverage = round(graded_students * 100 / students_total, 1) if students_total else 0
    term_complete = 0
    if classes:
        ratios = []
        for cls in classes:
            season = _build_exam_season(cls, term)
            ratios.append(season["stats"]["graded_complete"] * 100 / season["stats"]["students"] if season["stats"]["students"] else 0)
        term_complete = round(sum(ratios) / len(ratios), 1) if ratios else 0
    submissions = [sub for st in students for sub in st.assignment_submissions.all()]
    reviewed = sum(1 for sub in submissions if sub.score is not None or sub.status == "reviewed")
    assignments_review = round(reviewed * 100 / len(submissions), 1) if submissions else None
    high_risk = [st for st in students if _student_risk(st)["risk_score"] >= 50]
    risk_with_plan = sum(1 for st in high_risk if st.support_plans.exclude(status__in=["completed", "cancelled"]).exists())
    risk_coverage = round(risk_with_plan * 100 / len(high_risk), 1) if high_risk else 100
    follow_students = sum(1 for st in students if len(st.follow_up_records.all()) > 0)
    follow_coverage = round(min(100, follow_students * 100 / students_total * 3), 1) if students_total else 0
    comms_count = ParentCommunication.objects.filter(student__school_class__in=classes).count() if classes else 0
    comms_percent = min(100, comms_count * 20)
    attendance_students = sum(1 for st in students if len(st.attendance_records.all()) > 0)
    attendance_coverage = round(attendance_students * 100 / students_total, 1) if students_total else 0

    documents_count = CustomDocument.objects.filter(owner=user).count()
    documents_percent = min(100, documents_count * 10)
    journals_themed = round(sum(1 for j in journals if j.theme_id) * 100 / len(journals), 1) if journals else 0
    meetings = list(Meeting.objects.filter(owner=user))
    meetings_percent = 100 if any(m.minutes_document_id for m in meetings) else 60 if meetings else 30
    seminars_count = Seminar.objects.filter(owner=user).count()
    training_percent = min(100, seminars_count * 34)
    bank_count = QuestionBankItem.objects.filter(owner=user).count()
    bank_percent = min(100, bank_count * 10)
    visits_count = Visit.objects.filter(owner=user).count() + Observation.objects.filter(owner=user).count()
    visits_percent = min(100, visits_count * 50)

    def domain(key, label, indicators, strength, weakness, recommendation):
        values = [row["value"] for row in indicators if row["value"] is not None]
        percent = round(sum(values) / len(values), 1) if values else 0
        return {"key": key, "label": label, "percent": percent, "score": round(percent / 5, 1),
                "indicators": indicators, "strength": strength, "weakness": weakness, "recommendation": recommendation}

    domains = [
        domain("planning", "التخطيط والتحضير",
               [{"label": "تغطية خطط الدروس المنفذة", "value": plan_coverage},
                {"label": "دروس المقرر المخططة", "value": courses_planned},
                {"label": "حداثة الدفتر اليومي", "value": journal_percent}],
               "تحضير موثق وخطط دروس مرتبطة بالدروس المنفذة",
               "خطط الدروس لا تغطي كل الدروس المنفذة بعد",
               "اربط خطة درس بكل درس قبل تنفيذه من صفحة خطط الدروس"),
        domain("delivery", "تنفيذ الحصص وتوثيقها",
               [{"label": "الحصص الموثقة بالنقاط/الملخص", "value": sessions_documented},
                {"label": "حصص مرتبطة بخطة درس", "value": sessions_with_plan},
                {"label": "انتظام التوثيق (آخر 3 أسابيع)", "value": recent_percent}],
               "سجل حصص حي وموثق بانتظام",
               "توثيق الحصص ناقص أو غير منتظم",
               "وثّق كل حصة بالنقاط المكتوبة وملخص السبورة فور انتهائها"),
        domain("assessment", "التقويم ودفتر التنقيط",
               [{"label": "تغطية دفتر التنقيط", "value": gradebook_coverage},
                {"label": "اكتمال نقاط الثلاثي الحالي", "value": term_complete},
                {"label": "تصحيح المهام المسلمة", "value": assignments_review}],
               "تقويم منتظم ودفتر تنقيط محيّن",
               "نقاط أو تصحيحات متأخرة في دفتر التنقيط",
               "أكمل إدخال النقاط من صفحة إدخال النقاط وراجع المهام المسلمة"),
        domain("followup", "متابعة التلاميذ والدعم",
               [{"label": "تغطية خطط الدعم للمحتاجين", "value": risk_coverage},
                {"label": "تلاميذ بمتابعة فردية", "value": follow_coverage},
                {"label": "تواصل الأولياء الموثق", "value": comms_percent}],
               "متابعة فردية ودعم موثق للتلاميذ المحتاجين",
               "تلاميذ محتاجون بلا خطة دعم أو متابعة موثقة",
               "أنشئ خطط دعم من صفحة الدعم وتواصل الأولياء وسجّل المتابعات"),
        domain("organisation", "التنظيم والوثائق الإدارية",
               [{"label": "غنى مكتبة الوثائق", "value": documents_percent},
                {"label": "هوية الدفاتر (سمات مطبقة)", "value": journals_themed},
                {"label": "محاضر الاجتماعات الموثقة", "value": meetings_percent}],
               "وثائق إدارية منظمة وجاهزة للاطلاع",
               "وثائق أو محاضر ناقصة في الملف الإداري",
               "ولّد محاضر اجتماعاتك وطبّق سماتك على الدفاتر من استوديو السمات"),
        domain("development", "التكوين والتطوير المهني",
               [{"label": "الندوات والأيام التكوينية", "value": training_percent},
                {"label": "بنك الأسئلة المتنامي", "value": bank_percent},
                {"label": "زيارات وملاحظات موثقة", "value": visits_percent}],
               "تطوير مهني موثق وبنك أسئلة متنامٍ",
               "التكوين الموثق أو بنك الأسئلة ما زال محدودًا",
               "سجّل ندواتك في التقويم وأثرِ بنك الأسئلة لدروسك"),
    ]
    overall_percent = round(sum(d["percent"] for d in domains) / len(domains), 1) if domains else 0
    overall = round(overall_percent / 5, 1)
    appreciation = ("ممتاز" if overall >= 16 else "جيد جدًا" if overall >= 14 else "جيد" if overall >= 12
                    else "مقبول" if overall >= 10 else "يحتاج مرافقة ودعمًا")

    grid_sources = [plan_coverage, sessions_documented, sessions_with_plan, follow_coverage, bank_percent,
                    assignments_review if assignments_review is not None else gradebook_coverage,
                    attendance_coverage, comms_percent, risk_coverage, homework_percent]
    from .pdf import DEFAULT_CRITERIA
    grid = [{"criterion": label, "percent": round(grid_sources[i]) if i < len(grid_sources) else 0,
             "score": round((grid_sources[i] if i < len(grid_sources) else 0) / 5, 1),
             "level": _sim_level(grid_sources[i] if i < len(grid_sources) else 0)}
            for i, label in enumerate(DEFAULT_CRITERIA)]

    strengths = [d["strength"] for d in domains if d["percent"] >= 65]
    weaknesses = [{"domain": d["label"], "text": d["weakness"], "recommendation": d["recommendation"]}
                  for d in domains if d["percent"] < 65]
    evidence = [
        {"item": "الدفتر اليومي للسنة الحالية", "available": bool(journals), "link": "/journals"},
        {"item": "دفتر التنقيط محيّن لكل الأفواج", "available": gradebook_coverage >= 80, "link": "/gradebook"},
        {"item": "خطط دروس الدروس المنفذة", "available": plan_coverage >= 80, "link": "/lesson-plans"},
        {"item": "سجل الحصص الموثق", "available": sessions_documented >= 70, "link": "/sessions"},
        {"item": "ملف التفتيش والجاهزية", "available": documents_count >= 5, "link": "/portfolio"},
        {"item": "خطط الدعم وتواصل الأولياء", "available": risk_coverage >= 80, "link": "/support"},
        {"item": "محاضر مجالس الأقسام", "available": any(m.minutes_document_id for m in meetings), "link": "/meetings"},
        {"item": "شهادات ولوحات شرف الثلاثي", "available": CustomDocument.objects.filter(owner=user, source_type="ceremony").exists(), "link": "/ceremony"},
    ]
    return {"overall": overall, "overall_percent": overall_percent, "appreciation": appreciation,
            "term": term, "term_label": EXAM_SEASON_LABELS[term], "domains": domains, "grid": grid,
            "strengths": strengths, "weaknesses": weaknesses, "evidence": evidence,
            "counts": {"classes": len(classes), "students": students_total, "sessions_done": len(done),
                       "documents": documents_count, "bank_questions": bank_count}}


class InspectionSimulationView(APIView):
    def get(self, request):
        return Response(_build_inspection_simulation())


class InspectionSimulationReportView(APIView):
    def post(self, request):
        user = local_user()
        data = _build_inspection_simulation()
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else ""; school = profile.current_school if profile and profile.current_school else ""
        domain_rows = [[d["label"], f"{d['score']}/20", "؛ ".join(f"{i['label']}: {i['value']}٪" for i in d["indicators"] if i["value"] is not None)[:110]] for d in data["domains"]]
        grid_rows = [[row["criterion"], f"{row['score']}/20", row["level"]] for row in data["grid"]]
        evidence_rows = [[("✓" if row["available"] else "○"), row["item"]] for row in data["evidence"]]
        blocks = [docs_builder.cover("تقرير محاكاة التفتيش", "تقييم ذاتي استعدادًا لزيارة التفتيش — مادة الإعلام الآلي",
                                     [f"الأستاذ(ة): {teacher or '—'}", f"المؤسسة: {school or '—'}", f"تاريخ الإعداد: {datetime.date.today()}"]),
                  docs_builder.fields([("الدرجة العامة المحاكاة", f"{data['overall']}/20"), ("التقدير العام", data["appreciation"]),
                                       ("الأفواج", str(data["counts"]["classes"])), ("التلاميذ", str(data["counts"]["students"])),
                                       ("حصص منفذة", str(data["counts"]["sessions_done"])), ("وثائق", str(data["counts"]["documents"]))], "النتيجة العامة"),
                  docs_builder.table(["المحور", "الدرجة", "أبرز المؤشرات"], domain_rows, "محاور التفتيش الستة"),
                  docs_builder.table(["المعيار", "الدرجة", "المستوى"], grid_rows, "شبكة ملاحظة الحصة (محاكاة)"),
                  docs_builder.checklist(data["strengths"] or ["لا نقاط قوة بارزة بعد — ابدأ بخطط الدروس وتوثيق الحصص"], "نقاط القوة"),
                  docs_builder.checklist([f"{w['domain']}: {w['recommendation']}" for w in data["weaknesses"]] or ["لا ملاحظات جوهرية — واصل بنفس النسق"], "نقاط التحسين وتوصياتها"),
                  docs_builder.table(["", "الدليل المطلوب"], evidence_rows, "أدلة جاهزة لعرضها على المفتش"),
                  docs_builder.signatures(["الأستاذ(ة)", "المفتش(ة)"])]
        doc = CustomDocument.objects.create(owner=user, title=f"تقرير محاكاة التفتيش ({datetime.date.today()})",
            kind="report-card", orientation="portrait", content={"blocks": blocks},
            tags=["محاكاة تفتيش", "تقييم ذاتي"], source_type="inspection-simulation", source_id=None)
        return Response(CustomDocumentSerializer(doc).data, status=201)



# ------------------------------------------------------------------ support groups & remedial centre
REMEDIAL_BANDS = [
    {"band": "intensive", "label": "دعم مكثف", "focus": "إعادة بناء الأساسيات بتمارين قصيرة متدرجة ومتابعة أسبوعية فردية",
     "actions": ["حصة استدراك أسبوعية", "تمارين أساسيات يومية قصيرة", "لقاء ولي لعرض خطة الدعم"]},
    {"band": "support", "label": "دعم ومواكبة", "focus": "تثبيت المكتسبات ومراجعة موجهة قبل الفروض والاختبارات",
     "actions": ["مراجعة موجهة قبل الاختبار", "أوراق عمل تصحيحية", "متابعة الواجبات أسبوعيًا"]},
    {"band": "boost", "label": "تعزيز وتثبيت", "focus": "رفع المعدل نحو التميز بتمارين أعمق وتحديات إضافية",
     "actions": ["تمارين تعميق وتحديات", "أدوار قيادة في أعمال الأفواج", "أهداف معدّل للثلاثي الموالي"]},
    {"band": "attendance", "label": "متابعة الحضور", "focus": "معالجة الغياب المتكرر بالتواصل مع الأولياء وخطة التزام",
     "actions": ["اتصال بالولي خلال الأسبوع", "خطة التزام حضور موقعة", "مراجعة أسبوعية لسجل الحضور"]},
]
_COMPONENT_LABELS = {"continuous": "التقويم المستمر", "supervised": "الفرض المحروس", "exam": "الاختبار"}


def _remedial_suggestions(cls, term=1):
    students = list(cls.students.prefetch_related("marks", "attendance_records").order_by("full_name"))
    grouped = {meta["band"]: [] for meta in REMEDIAL_BANDS}
    for student in students:
        mark = next((row for row in student.marks.all() if row.term == term), None)
        average = mark.average if mark else None
        components = {}
        if mark:
            for key in ("continuous", "supervised", "exam"):
                value = getattr(mark, key)
                if value is not None: components[_COMPONENT_LABELS[key]] = value
        weak = min(components, key=components.get) if components else None
        absences = sum(1 for row in student.attendance_records.all() if row.status == "absent" and _term_for_date(row.date) == term)
        row = {"student_id": student.id, "student_name": student.full_name, "average": average,
               "weak_component": weak, "weak_value": components.get(weak) if weak else None, "absences": absences}
        if average is None or average < 8:
            grouped["intensive"].append(row)
        elif average < 10:
            grouped["support"].append(row)
        elif average < 12:
            grouped["boost"].append(row)
        if absences >= 3:
            grouped["attendance"].append(row)
    bands = []
    for meta in REMEDIAL_BANDS:
        rows = sorted(grouped[meta["band"]], key=lambda r: (r["average"] is None, r["average"] or 0, r["student_name"]))
        bands.append({**meta, "students": rows, "count": len(rows)})
    return {"class": {"id": cls.id, "name": cls.name, "level": cls.level, "students_count": len(students)},
            "term": term, "term_label": EXAM_SEASON_LABELS[term], "bands": bands}


class RemedialSuggestionsView(APIView):
    def get(self, request):
        term = _safe_term(request.query_params.get("term"), 1)
        class_id = request.query_params.get("class")
        if class_id:
            cls = _owned_school_class(class_id)
            if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
            return Response(_remedial_suggestions(cls, term))
        rows = []
        for cls in SchoolClass.objects.filter(owner=local_user()).order_by("name"):
            data = _remedial_suggestions(cls, term)
            rows.append({"class": data["class"], "counts": {band["band"]: band["count"] for band in data["bands"]}})
        return Response({"term": term, "term_label": EXAM_SEASON_LABELS[term], "classes": rows})


class SupportGroupViewSet(viewsets.ModelViewSet):
    serializer_class = SupportGroupSerializer

    def get_queryset(self):
        qs = SupportGroup.objects.filter(owner=local_user()).select_related("school_class").prefetch_related("members")
        if self.request.query_params.get("school_class"):
            qs = qs.filter(school_class_id=self.request.query_params["school_class"])
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=local_user())

    @action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        group = self.get_object()
        try:
            group.planned_date = datetime.date.fromisoformat(str(request.data.get("date"))) if request.data.get("date") else None
        except ValueError:
            return Response({"detail": "التاريخ غير صالح."}, status=400)
        try:
            group.planned_time = datetime.time.fromisoformat(str(request.data.get("time"))) if request.data.get("time") else None
        except ValueError:
            return Response({"detail": "الوقت غير صالح."}, status=400)
        group.save(update_fields=["planned_date", "planned_time"])
        return Response(SupportGroupSerializer(group).data)

    @action(detail=True, methods=["post"], url_path="generate-worksheet")
    def generate_worksheet(self, request, pk=None):
        group = self.get_object()
        try: count = int(request.data.get("count") or 8)
        except (TypeError, ValueError): count = 8
        selected, _lessons = _mock_exam_selection(group.school_class, group.term, max(1, min(20, count)))
        if not selected:
            return Response({"detail": "لا أسئلة في بنك الأسئلة لدروس هذا الثلاثي — أضف أسئلة أولًا."}, status=400)
        profile = _profile(); teacher = profile.full_name if profile and profile.full_name else "الأستاذ(ة)"
        member_names = "، ".join(st.full_name for st in group.members.all())
        blocks = [docs_builder.heading(f"ورقة عمل داعمة — {group.title}"),
                  docs_builder.fields([("الفوج", group.school_class.name), ("المجموعة", group.band_label),
                                       ("الثلاثي", EXAM_SEASON_LABELS[group.term]), ("الأستاذ(ة)", teacher),
                                       ("التلاميذ", member_names or "—"),
                                       ("الموعد المخطط", f"{group.planned_date or '—'} {group.planned_time or ''}")], "بطاقة الورقة"),
                  docs_builder.text(f"محور التركيز: {group.focus}" if group.focus else "ورقة عمل لمراجعة دروس الثلاثي وتثبيت المكتسبات."),
                  docs_builder.questions([item.as_block_question() for item in selected], "تمارين الدعم والاستدراك"),
                  docs_builder.signatures(["الأستاذ(ة)"])]
        doc = CustomDocument.objects.create(owner=local_user(), title=f"ورقة عمل داعمة — {group.title} ({EXAM_SEASON_LABELS[group.term]})",
            kind="worksheet", orientation="portrait", content={"blocks": blocks},
            tags=["دعم", "استدراك", group.band_label], source_type="support-group", source_id=group.id)
        group.worksheet_document = doc
        group.save(update_fields=["worksheet_document"])
        return Response({**CustomDocumentSerializer(doc).data, "questions_used": len(selected)}, status=201)

    @action(detail=True, methods=["post"], url_path="create-plans")
    def create_plans(self, request, pk=None):
        group = self.get_object()
        meta = next((row for row in REMEDIAL_BANDS if row["band"] == group.band), REMEDIAL_BANDS[1])
        created, skipped = 0, 0
        for student in group.members.all():
            if student.support_plans.exclude(status__in=["completed", "cancelled"]).exists():
                skipped += 1
                continue
            weakest = ""
            mark = next((row for row in student.marks.all() if row.term == group.term), None)
            if mark:
                values = {_COMPONENT_LABELS[key]: getattr(mark, key) for key in ("continuous", "supervised", "exam")
                          if getattr(mark, key) is not None}
                if values: weakest = f" — أضعف مكوّن: {min(values, key=values.get)}"
            SupportPlan.objects.create(
                student=student, title=f"خطة {group.band_label} — {student.full_name}",
                category="attendance" if group.band == "attendance" else "academic",
                priority="high" if group.band in ("intensive", "attendance") else "medium",
                status="planned", start_date=datetime.date.today(),
                reason=(group.focus or meta["focus"]) + weakest,
                actions=[{"text": text, "done": False, "due": None} for text in meta["actions"]])
            created += 1
        return Response({"created": created, "skipped": skipped})



# ------------------------------------------------------------------ assessment centre (Phase 33)
def _assessment_results_payload(assessment):
    students = list(assessment.school_class.students.order_by("full_name", "id"))
    by_student = {row.student_id: row for row in assessment.results.select_related("student")}
    rows = []
    for student in students:
        result = by_student.get(student.id)
        rows.append({
            "result_id": result.id if result else None,
            "student": student.id,
            "student_name": student.full_name,
            "status": result.status if result else "unmarked",
            "status_label": result.status_label if result else "غير مسجل",
            "score": result.score if result else None,
            "score_percent": result.score_percent if result else None,
            "comment": result.comment if result else "",
        })
    return {"assessment": AssessmentSerializer(assessment).data, "students": rows, "stats": assessment.stats}


def _assessment_question_selection(assessment, count, target_points, lesson_counts=None):
    """Balanced pick from the question bank: round-robin across difficulties,
    optionally continuing until the target total points is reached. When
    `lesson_counts` ([{course_id, count}]) is given, pick exactly that many
    questions from each chosen lesson instead."""
    import random as _random
    all_items = list(QuestionBankItem.objects.filter(owner=local_user()).select_related("course"))

    def _balanced(pool):
        groups = {label: [] for label in ("سهل", "متوسط", "صعب")}
        other = []
        for item in pool:
            (groups.get(item.difficulty) or other).append(item)
        rng = _random.SystemRandom()
        for group in list(groups.values()) + [other]:
            rng.shuffle(group)
        ordered = []
        buckets = [groups["سهل"], groups["متوسط"], groups["صعب"], other]
        while any(buckets):
            for bucket in buckets:
                if bucket:
                    ordered.append(bucket.pop())
        return ordered

    if lesson_counts:
        selected, total = [], 0.0
        for entry in lesson_counts:
            try:
                cid = int(entry.get("course_id")); wanted = int(entry.get("count"))
            except (TypeError, ValueError, AttributeError):
                continue
            if wanted < 1:
                continue
            picked = _balanced([item for item in all_items if item.course_id == cid])[:min(wanted, 200)]
            selected.extend(picked)
            total += sum(float(item.points or 0) for item in picked)
        return selected, round(total, 2)

    pool = all_items
    if assessment.course_id:
        pool = [item for item in pool if item.course_id == assessment.course_id]
    if not pool:
        return [], 0
    groups = {label: [] for label in ("سهل", "متوسط", "صعب")}
    other = []
    for item in pool:
        (groups.get(item.difficulty) or other).append(item)
    rng = _random.SystemRandom()
    for group in list(groups.values()) + [other]:
        rng.shuffle(group)
    ordered = []
    buckets = [groups["سهل"], groups["متوسط"], groups["صعب"], other]
    while any(buckets):
        for bucket in buckets:
            if bucket:
                ordered.append(bucket.pop())
    selected, total = [], 0.0
    for item in ordered:
        selected.append(item)
        total += float(item.points or 0)
        if target_points:
            if total >= target_points and len(selected) >= 3:
                break
        elif len(selected) >= count:
            break
        if len(selected) >= 100:
            break
    return selected, round(total, 2)


class AssessmentViewSet(viewsets.ModelViewSet):
    """Planned assessments with generated papers, results and analysis."""
    serializer_class = AssessmentSerializer

    def get_queryset(self):
        qs = (Assessment.objects.filter(owner=local_user())
              .select_related("school_class", "course", "paper_document", "analysis_document")
              .prefetch_related("results", "school_class__students", "support_groups"))
        params = self.request.query_params
        if params.get("school_class"): qs = qs.filter(school_class_id=params["school_class"])
        if params.get("course"): qs = qs.filter(course_id=params["course"])
        if params.get("term"): qs = qs.filter(term=params["term"])
        if params.get("assessment_kind"): qs = qs.filter(assessment_kind=params["assessment_kind"])
        if params.get("status"): qs = qs.filter(status=params["status"])
        if params.get("q"):
            qs = qs.filter(Q(title__icontains=params["q"]) | Q(course__title__icontains=params["q"])
                           | Q(school_class__name__icontains=params["q"]))
        return qs

    def perform_create(self, serializer):
        serializer.save(owner=local_user())

    @action(detail=True, methods=["get", "post"], url_path="results")
    def results(self, request, pk=None):
        assessment = self.get_object()
        if request.method == "GET":
            return Response(_assessment_results_payload(assessment))
        rows = request.data.get("rows")
        if not isinstance(rows, list):
            return Response({"detail": "قائمة النتائج غير صالحة."}, status=400)
        valid_students = {st.id: st for st in assessment.school_class.students.all()}
        parsed = []
        for row in rows:
            try:
                student_id = int(row.get("student"))
            except (TypeError, ValueError, AttributeError):
                return Response({"detail": "معرّف تلميذ غير صالح في النتائج."}, status=400)
            if student_id not in valid_students:
                return Response({"detail": "يوجد تلميذ لا ينتمي إلى فوج هذا التقويم."}, status=400)
            row_status = row.get("status") or "unmarked"
            if row_status not in dict(AssessmentResult.STATUSES):
                return Response({"detail": "حالة نتيجة غير صالحة."}, status=400)
            score = row.get("score")
            if row_status in ("absent", "excused", "unmarked"):
                score = None
            elif score in ("", None):
                score = None
            else:
                try:
                    score = float(score)
                except (TypeError, ValueError):
                    return Response({"detail": "نقطة غير صالحة."}, status=400)
                score = min(max(score, 0), float(assessment.max_score or 20))
            parsed.append((valid_students[student_id], row_status, score, str(row.get("comment") or "").strip()))
        with transaction.atomic():
            for student, row_status, score, comment in parsed:
                AssessmentResult.objects.update_or_create(
                    assessment=assessment, student=student,
                    defaults={"status": row_status, "score": score, "comment": comment})
            stats = assessment.stats
            if stats["scored"]:
                if assessment.status in ("planned", "prepared", "administered"):
                    assessment.status = "corrected" if stats["correction_progress"] >= 100 else "administered"
                    assessment.save(update_fields=["status", "updated_at"])
        return Response(_assessment_results_payload(Assessment.objects.prefetch_related("results").get(pk=assessment.pk)))

    @action(detail=True, methods=["post"], url_path="create-support-group")
    def create_support_group(self, request, pk=None):
        assessment = self.get_object()
        try:
            threshold = float(request.data.get("threshold") or 50)
        except (TypeError, ValueError):
            return Response({"detail": "عتبة النجاح غير صالحة."}, status=400)
        threshold = min(max(threshold, 1), 100)
        include_absent = request.data.get("include_absent") in (True, "true", "1", 1)
        band = request.data.get("band") or "support"
        if band not in dict(SupportGroup.BANDS):
            return Response({"detail": "نوع مجموعة الدعم غير صالح."}, status=400)
        existing = assessment.support_groups.filter(status="active").first()
        if existing:
            return Response({"created": False, "group": SupportGroupSerializer(existing).data,
                             "detail": "توجد مجموعة دعم نشطة لهذا التقويم."})
        payload = _assessment_results_payload(assessment)
        member_ids, absent_ids = [], []
        for row in payload["students"]:
            if row["status"] == "present" and row["score_percent"] is not None and row["score_percent"] < threshold:
                member_ids.append(row["student"])
            elif row["status"] == "absent":
                absent_ids.append(row["student"])
        if include_absent:
            member_ids += absent_ids
        if not member_ids:
            return Response({"detail": "لا تلاميذ دون العتبة المحددة في هذا التقويم — عدّلوا العتبة أو سجّلوا النتائج أولًا."}, status=400)
        title = (request.data.get("title") or "").strip() or f"دعم واستدراك — {assessment.title}"
        focus = (request.data.get("focus") or "").strip() or (
            f"استدراك بناءً على نتائج {assessment.kind_label} «{assessment.title}»"
            + (f" (درس: {assessment.course.title})" if assessment.course_id else "")
            + f" — {len(member_ids)} تلميذًا دون {threshold:g}٪"
            + ("، بمن فيهم الغائبون." if include_absent and absent_ids else "."))
        group = SupportGroup.objects.create(
            owner=local_user(), school_class=assessment.school_class, term=assessment.term,
            band=band, title=title, focus=focus, source_assessment=assessment)
        group.members.set(member_ids)
        return Response({"created": True, "group": SupportGroupSerializer(group).data,
                         "member_count": len(member_ids), "threshold": threshold}, status=201)

    @action(detail=True, methods=["get"], url_path="results/export")
    def results_export(self, request, pk=None):
        assessment = self.get_object()
        payload = _assessment_results_payload(assessment)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["التلميذ", "الحالة", "النقطة", "من أصل", "على 20", "النسبة ٪", "التقدير", "ملاحظة"])
        for row in payload["students"]:
            percent = row["score_percent"]
            writer.writerow([row["student_name"], row["status_label"],
                             "" if row["score"] is None else row["score"],
                             assessment.max_score,
                             "" if percent is None else round(percent / 5, 2),
                             "" if percent is None else percent,
                             ("ممتاز" if percent >= 80 else "جيد" if percent >= 65 else "مقبول" if percent >= 50 else "يحتاج دعمًا") if percent is not None else "",
                             row["comment"] or ""])
        response = HttpResponse("﻿" + buffer.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="assessment-{assessment.id}-results.csv"'
        return response

    @action(detail=True, methods=["post"], url_path="generate-paper")
    def generate_paper(self, request, pk=None):
        assessment = self.get_object()
        try: count = int(request.data.get("count") or 10)
        except (TypeError, ValueError): count = 10
        count = max(1, min(50, count))
        target = request.data.get("target_points")
        try: target = float(target) if target not in (None, "") else None
        except (TypeError, ValueError): target = None
        lesson_counts = request.data.get("lesson_counts") or None
        selected, total_points = _assessment_question_selection(assessment, count, target, lesson_counts=lesson_counts)
        if not selected:
            detail = ("لا أسئلة في بنك الأسئلة لهذا الدرس — أضف أسئلة أو أزل ربط الدرس لتوليد الموضوع من كل البنك."
                      if assessment.course_id else
                      "بنك الأسئلة فارغ — أضف أسئلة أو ولّدها من نقاط المقرر أولًا.")
            return Response({"detail": detail}, status=400)
        profile = _profile()
        teacher = profile.full_name if profile and profile.full_name else ""
        title = str(request.data.get("title") or assessment.title)[:200]
        blocks = [
            docs_builder.fields([
                ("المادة", "الإعلام الآلي"), ("الفوج", assessment.school_class.name),
                ("الدرس", assessment.course.title if assessment.course else "—"),
                ("نوع التقويم", assessment.kind_label), ("التاريخ", str(assessment.date)),
                ("المدة", f"{assessment.duration_minutes} دقيقة"),
                ("النقطة القصوى", str(assessment.max_score)),
                ("الأستاذ(ة)", teacher), ("عدد الأسئلة", str(len(selected))),
                ("مجموع نقاط الأسئلة", str(total_points)),
            ], title),
            docs_builder.text(assessment.instructions or "التعليمات: اقرأ كل سؤال بعناية وأجب بخط واضح ومنظم."),
            docs_builder.questions([item.as_block_question() for item in selected], "الأسئلة",
                                   show_answers=bool(request.data.get("include_answer_key", True))),
            docs_builder.signatures(["إمضاء الأستاذ(ة)"]),
        ]
        doc = CustomDocument.objects.create(
            owner=local_user(), title=f"{title} — {assessment.school_class.name}", kind="exam",
            orientation="portrait", content={"blocks": blocks},
            tags=doc_exchange.clean_tags(["تقويمات", assessment.kind_label, assessment.school_class.name]),
            source_type="assessment", source_id=assessment.id)
        assessment.paper_document = doc
        if assessment.status == "planned":
            assessment.status = "prepared"
        assessment.save(update_fields=["paper_document", "status", "updated_at"])
        return Response({"document": CustomDocumentSerializer(doc).data,
                         "assessment": AssessmentSerializer(assessment).data,
                         "questions_used": len(selected), "total_points": total_points}, status=201)

    @action(detail=True, methods=["post"], url_path="generate-analysis")
    def generate_analysis(self, request, pk=None):
        assessment = self.get_object()
        stats = assessment.stats
        rows = list(assessment.results.select_related("student"))
        scored = sorted((r for r in rows if r.status == "present" and r.score is not None),
                        key=lambda r: (-(r.score_percent or 0), r.student.full_name))
        ranking = [[str(i + 1), r.student.full_name, f"{r.score}/{assessment.max_score}",
                    f"{r.score_percent}٪",
                    "ممتاز" if (r.score_percent or 0) >= 80 else "جيد" if (r.score_percent or 0) >= 65
                    else "مقبول" if (r.score_percent or 0) >= 50 else "يحتاج دعمًا"]
                   for i, r in enumerate(scored)]
        absent_names = [r.student.full_name for r in rows if r.status in ("absent", "excused")]
        support_names = [f"{r.student.full_name} ({r.score_percent}٪)" for r in scored if (r.score_percent or 0) < 50]
        recommendations = []
        if not scored:
            recommendations.append("سجّلوا نتائج هذا التقويم أولًا ليصبح التحليل معبّرًا عن أداء الفوج.")
        else:
            if (stats["success_rate"] or 0) < 50:
                recommendations.append("نسبة النجاح دون 50٪: برمجوا حصة استدراك حول النقاط الأضعف ثم تقويمًا قصيرًا للتحقق.")
            if support_names:
                recommendations.append("أدرجوا التلاميذ دون 50٪ في مجموعات الدعم والاستدراك وخطط متابعة فردية.")
            if absent_names:
                recommendations.append("عالجوا حالات الغياب بتنظيم تقويم تعويضي والتواصل مع الأولياء عند التكرار.")
            if (stats["average_percent"] or 0) >= 65:
                recommendations.append("الأداء العام جيد: ثبّتوا المكتسبات بتمارين تعزيز وانتقلوا إلى الدرس الموالي.")
            if not recommendations:
                recommendations.append("واصلوا المتابعة العادية وراجعوا توزيع النقاط في مجلس الفوج.")
        blocks = [
            docs_builder.cover(f"تحليل نتائج — {assessment.title}",
                               assessment.school_class.name,
                               [f"{assessment.kind_label} • {assessment.date}", f"الأستاذ(ة): {(_profile().full_name or '')}"]),
            docs_builder.fields([
                ("الفوج", assessment.school_class.name),
                ("الدرس", assessment.course.title if assessment.course else "—"),
                ("الثلاثي", {1: "الثلاثي الأول", 2: "الثلاثي الثاني", 3: "الثلاثي الثالث"}.get(assessment.term, "—")),
                ("مكوّن دفتر التنقيط المقابل", assessment.grade_component_label),
                ("المصحَّحون", f"{stats['scored']}/{stats['present']} حاضر"),
                ("معدل الفوج", f"{stats['average_percent']}٪ ({stats['average_20']}/20)" if stats["average_percent"] is not None else "—"),
                ("نسبة النجاح", f"{stats['success_rate']}٪" if stats["success_rate"] is not None else "—"),
                ("الوسيط", f"{stats['median_percent']}٪" if stats["median_percent"] is not None else "—"),
            ], "مؤشرات عامة"),
            docs_builder.table(["الشريحة", "عدد التلاميذ"],
                               [[row["label"], str(row["count"])] for row in stats["distribution"]],
                               "توزيع النتائج"),
        ]
        if ranking:
            blocks.append(docs_builder.table(["الرتبة", "التلميذ", "النقطة", "النسبة", "التقدير"], ranking, "ترتيب الفوج"))
        if absent_names:
            blocks.append(docs_builder.checklist(absent_names, "غيابات تستدعي التعويض أو المتابعة"))
        if support_names:
            blocks.append(docs_builder.checklist(support_names, "تلاميذ يحتاجون دعمًا (دون 50٪)"))
        blocks.append(docs_builder.heading("توصيات الأستاذ"))
        blocks.append(docs_builder.checklist(recommendations, ""))
        if assessment.notes:
            blocks.append(docs_builder.heading("ملاحظات"))
            blocks.append(docs_builder.text(assessment.notes))
        blocks.append(docs_builder.signatures(["الأستاذ(ة)", "إدارة المؤسسة"]))
        doc = CustomDocument.objects.create(
            owner=local_user(), title=f"تحليل نتائج — {assessment.title} — {assessment.school_class.name}",
            kind="report-card", orientation="portrait", content={"blocks": blocks},
            tags=doc_exchange.clean_tags(["تقويمات", "تحليل نتائج", assessment.school_class.name]),
            source_type="assessment", source_id=assessment.id)
        assessment.analysis_document = doc
        assessment.save(update_fields=["analysis_document", "updated_at"])
        return Response({"document": CustomDocumentSerializer(doc).data,
                         "assessment": AssessmentSerializer(assessment).data, "stats": stats}, status=201)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        copy = Assessment.objects.create(
            owner=local_user(), school_class=source.school_class, course=source.course,
            term=source.term, assessment_kind=source.assessment_kind,
            title=f"{source.title} — نسخة"[:200], date=datetime.date.today(),
            duration_minutes=source.duration_minutes, max_score=source.max_score,
            status="planned", instructions=source.instructions, notes=source.notes)
        return Response(AssessmentSerializer(copy).data, status=201)



# ------------------------------------------------------------------ assessment -> gradebook sync (Phase 35)
GRADEBOOK_COMPONENTS = {"continuous": "تقويم مستمر", "supervised": "فرض محروس", "exam": "اختبار"}


def _gradebook_sync_preview(cls, term, component):
    """Per-student official-mark candidates computed from corrected assessments.

    Only assessments whose kind maps to `component` and that hold at least one
    present, scored result are eligible. A student's candidate is the mean of
    their score percents across eligible assessments, normalised to /20."""
    assessments = list(Assessment.objects.filter(owner=local_user(), school_class=cls, term=term)
                       .prefetch_related("results__student").order_by("date", "id"))
    eligible = []
    for assessment in assessments:
        if assessment.grade_component != component:
            continue
        scored = [r for r in assessment.results.all() if r.status == "present" and r.score is not None]
        if scored:
            eligible.append((assessment, {r.student_id: r for r in scored}))
    students = list(cls.students.prefetch_related("marks").order_by("full_name", "id"))
    rows = []
    for student in students:
        mark = next((m for m in student.marks.all() if m.term == term), None)
        current = getattr(mark, component) if mark else None
        sources, percents = [], []
        for assessment, by_student in eligible:
            result = by_student.get(student.id)
            if result is None:
                continue
            percent = result.score_percent
            percents.append(percent)
            sources.append({"assessment_id": assessment.id, "title": assessment.title,
                            "score": result.score, "max_score": assessment.max_score,
                            "percent": percent, "score_20": round(percent / 5, 2)})
        computed = round((sum(percents) / len(percents)) / 5, 2) if percents else None
        if computed is None:
            action = "no_data"
        elif current is None:
            action = "fill"
        elif abs(float(current) - computed) < 0.005:
            action = "same"
        else:
            action = "replace"
        rows.append({"student_id": student.id, "student_name": student.full_name,
                     "current": current, "computed": computed, "sources": sources, "action": action})
    return {
        "class": {"id": cls.id, "name": cls.name, "level": cls.level},
        "term": term,
        "term_label": TERM_PACK_LABELS[term],
        "component": component,
        "component_label": GRADEBOOK_COMPONENTS[component],
        "assessments": [{"id": a.id, "title": a.title, "kind_label": a.kind_label, "date": str(a.date),
                         "status": a.status, "gradebook_synced_at": str(a.gradebook_synced_at) if a.gradebook_synced_at else None}
                        for a, _ in eligible],
        "rows": rows,
        "summary": {
            "eligible_assessments": len(eligible),
            "will_fill": sum(1 for r in rows if r["action"] == "fill"),
            "will_replace": sum(1 for r in rows if r["action"] == "replace"),
            "same": sum(1 for r in rows if r["action"] == "same"),
            "no_data": sum(1 for r in rows if r["action"] == "no_data"),
        },
    }


def _parse_sync_request(data):
    cls = _owned_school_class(data.get("class_id") or data.get("school_class") or data.get("class"))
    try: term = int(data.get("term") or 1)
    except (TypeError, ValueError): term = 1
    component = data.get("component") or "supervised"
    return cls, term, component


class GradebookSyncPreviewView(APIView):
    def get(self, request):
        cls, term, component = _parse_sync_request(request.query_params)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        if term not in (1, 2, 3): return Response({"detail": "الثلاثي غير صالح."}, status=400)
        if component not in GRADEBOOK_COMPONENTS: return Response({"detail": "مكوّن دفتر التنقيط غير صالح."}, status=400)
        return Response(_gradebook_sync_preview(cls, term, component))


class GradebookSyncApplyView(APIView):
    def post(self, request):
        cls, term, component = _parse_sync_request(request.data)
        if not cls: return Response({"detail": "الفوج غير موجود."}, status=404)
        if term not in (1, 2, 3): return Response({"detail": "الثلاثي غير صالح."}, status=400)
        if component not in GRADEBOOK_COMPONENTS: return Response({"detail": "مكوّن دفتر التنقيط غير صالح."}, status=400)
        mode = request.data.get("mode") or "fill"
        if mode not in ("fill", "overwrite"): mode = "fill"
        selected_ids = request.data.get("student_ids")
        if selected_ids is not None:
            try: selected_ids = {int(x) for x in selected_ids}
            except (TypeError, ValueError): return Response({"detail": "قائمة التلاميذ غير صالحة."}, status=400)
        preview = _gradebook_sync_preview(cls, term, component)
        students_by_id = {st.id: st for st in cls.students.all()}
        updated = skipped_existing = skipped_same = skipped_no_data = 0
        with transaction.atomic():
            for row in preview["rows"]:
                if selected_ids is not None and row["student_id"] not in selected_ids:
                    continue
                if row["computed"] is None:
                    skipped_no_data += 1; continue
                if row["action"] == "same":
                    skipped_same += 1; continue
                if row["action"] == "replace" and mode == "fill":
                    skipped_existing += 1; continue
                student = students_by_id[row["student_id"]]
                mark, _created = Mark.objects.get_or_create(student=student, term=term)
                setattr(mark, component, row["computed"])
                mark.save(update_fields=[component])
                updated += 1
            eligible_ids = [row["id"] for row in preview["assessments"]]
            if eligible_ids:
                Assessment.objects.filter(pk__in=eligible_ids).update(gradebook_synced_at=timezone.now())
        result = _gradebook_sync_preview(cls, term, component)
        result.update({"updated": updated, "skipped_existing": skipped_existing,
                       "skipped_same": skipped_same, "skipped_no_data": skipped_no_data, "mode": mode})
        return Response(result)


# ------------------------------------------------------------------ global search
class SearchView(APIView):
    """One search across the whole studio (Ctrl+K in the UI)."""
    def get(self, request):
        u = local_user()
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"query": q, "groups": []})
        groups = []

        def add(key, label, rows):
            if rows:
                groups.append({"key": key, "label": label, "results": rows})

        add("classes", "الأقسام", [
            {"id": c.id, "title": c.name, "subtitle": c.level, "route": "/classes"}
            for c in SchoolClass.objects.filter(owner=u).filter(Q(name__icontains=q) | Q(level__icontains=q))[:6]])
        add("courses", "المقرر", [
            {"id": c.id, "title": c.title, "subtitle": c.domain, "route": f"/courses?lesson={c.id}"}
            for c in Course.objects.filter(owner=u).filter(Q(title__icontains=q) | Q(domain__icontains=q) | Q(unit__icontains=q))[:6]])
        add("students", "التلاميذ", [
{"id": st.id, "title": st.full_name, "subtitle": st.school_class.name, "route": f"/students/{st.id}"}
            for st in Student.objects.filter(school_class__owner=u, full_name__icontains=q).select_related("school_class")[:6]])
        add("plans", "خطط الدروس", [
            {"id": p_.id, "title": p_.title, "subtitle": p_.domain, "route": f"/lesson-plans?plan={p_.id}"}
            for p_ in LessonPlan.objects.filter(owner=u).filter(Q(title__icontains=q) | Q(domain__icontains=q))[:6]])
        add("journals", "الدفاتر", [
            {"id": j.id, "title": j.title, "subtitle": j.institution, "route": f"/preview/journal/{j.id}"}
            for j in Journal.objects.filter(owner=u).filter(Q(title__icontains=q) | Q(institution__icontains=q))[:6]])
        add("notebooks", "دفاتر الملاحظات", [
            {"id": b.id, "title": b.title, "subtitle": b.class_name, "route": f"/preview/notebook/{b.id}"}
            for b in NoteBook.objects.filter(owner=u).filter(Q(title__icontains=q) | Q(entries__content__icontains=q)).distinct()[:6]])
        add("institutions", "المؤسسات", [
            {"id": i.id, "title": i.name, "subtitle": i.commune, "route": "/inspection"}
            for i in Institution.objects.filter(owner=u).filter(Q(name__icontains=q) | Q(commune__icontains=q) | Q(district__icontains=q) | Q(director__icontains=q))[:6]])
        add("questions", "بنك الأسئلة", [
            {"id": x.id, "title": x.prompt[:100], "subtitle": x.course.title if x.course else x.qtype, "route": "/question-bank"}
            for x in QuestionBankItem.objects.filter(owner=u).filter(Q(prompt__icontains=q) | Q(answer__icontains=q)).select_related("course")[:6]])
        add("support", "خطط الدعم والتواصل", [
            {"id": x.id, "title": x.title, "subtitle": x.student.full_name, "route": "/support"}
            for x in SupportPlan.objects.filter(student__school_class__owner=u).filter(Q(title__icontains=q) | Q(student__full_name__icontains=q)).select_related("student")[:6]])
        add("assignments", "المهام والواجبات", [
            {"id": x.id, "title": x.title, "subtitle": x.school_class.name, "route": "/assignments"}
            for x in Assignment.objects.filter(school_class__owner=u).filter(Q(title__icontains=q) | Q(instructions__icontains=q) | Q(course__title__icontains=q)).select_related("school_class", "course")[:6]])
        add("tasks", "مركز الإجراءات", [
            {"id": x.id, "title": x.title, "subtitle": x.category_label, "route": "/actions"}
            for x in TeacherTask.objects.filter(owner=u).filter(Q(title__icontains=q) | Q(description__icontains=q))[:6]])
        add("assessments", "الفروض والاختبارات", [
            {"id": x.id, "title": x.title, "subtitle": f"{x.school_class.name} • {x.kind_label} • {x.date}", "route": f"/assessments?assessment={x.id}"}
            for x in Assessment.objects.filter(owner=u).filter(Q(title__icontains=q) | Q(course__title__icontains=q) | Q(school_class__name__icontains=q)).select_related("school_class", "course")[:6]])
        add("documents", "وثائق قابلة للتحرير", [
            {"id": d.id, "title": d.title, "subtitle": d.kind_label if hasattr(d, "kind_label") else d.get_kind_display(), "route": f"/editor/{d.id}"}
            for d in CustomDocument.objects.filter(owner=u, title__icontains=q, is_archived=False)[:6]])
        add("sessions", "الحصص", [
            {"id": x.id, "title": (x.course.title if x.course else "حصة"),
             "subtitle": f"{x.date} • {x.school_class.name}", "route": "/sessions"}
            for x in Session.objects.filter(owner=u, course__title__icontains=q).select_related("course", "school_class")[:6]])
        return Response({"query": q, "groups": groups})


def _orient(request):
    return "landscape" if request.query_params.get("orientation") == "landscape" else "portrait"


def _dated(qs, request, field="date"):
    d_from, d_to = request.query_params.get("from"), request.query_params.get("to")
    if d_from:
        qs = qs.filter(**{f"{field}__gte": d_from})
    if d_to:
        qs = qs.filter(**{f"{field}__lte": d_to})
    order = request.query_params.get("order")
    if order == "oldest":
        qs = qs.order_by(field)
    elif order == "newest":
        qs = qs.order_by(f"-{field}")
    return qs



def _period(holidays, seminars, request):
    """Restrict holidays (by overlap) and seminars to the requested date range."""
    d_from, d_to = request.query_params.get("from"), request.query_params.get("to")
    if d_from:
        holidays = holidays.filter(end_date__gte=d_from)
        seminars = seminars.filter(date__gte=d_from)
    if d_to:
        holidays = holidays.filter(start_date__lte=d_to)
        seminars = seminars.filter(date__lte=d_to)
    return holidays, seminars

# ------------------------------------------------------------------ PDF exports
def _theme_for(request, obj=None):
    tid = request.query_params.get("theme")
    if tid:
        t = Theme.objects.filter(pk=tid).first()
        if t:
            return t
    if obj is not None and getattr(obj, "theme_id", None):
        return obj.theme
    return Theme.objects.filter(slug="gentleman-navy").first() or Theme.objects.first()


def _profile():
    prof, _ = TeacherProfile.objects.get_or_create(user=local_user())
    return prof


@api_view(['GET'])
def export_journal(request, pk):
    j = Journal.objects.filter(pk=pk, owner=local_user()).first()
    if not j:
        return Response({"detail": "غير موجود."}, status=404)
    u = local_user()
    j_sessions = _dated(j.sessions.select_related("school_class", "course").all(), request)
    j_holidays, j_seminars = _period(Holiday.objects.filter(owner=u), Seminar.objects.filter(owner=u), request)
    classes_rows, term_rows = [], []
    for cls in SchoolClass.objects.filter(owner=u).prefetch_related("students__marks").order_by("name"):
        progress = class_progress(cls)
        students = list(cls.students.all())
        def _tavg(term, students=students):
            vals = [m.average for st in students for m in st.marks.all() if m.term == term and m.average is not None]
            return round(sum(vals) / len(vals), 2) if vals else "—"
        annual_vals = []
        for st in students:
            avgs = [m.average for m in st.marks.all() if m.average is not None]
            if avgs: annual_vals.append(round(sum(avgs) / len(avgs), 2))
        classes_rows.append([pdfdocs.esc(cls.name), pdfdocs.esc(cls.level), str(len(students)),
                             f"{progress['percent']}٪ ({progress['done_count']}/{progress['total_courses']})",
                             pdfdocs.esc(progress["next_course"]["title"]) if progress["next_course"] else "—"])
        term_rows.append([pdfdocs.esc(cls.name), str(_tavg(1)), str(_tavg(2)), str(_tavg(3)),
                          str(round(sum(annual_vals) / len(annual_vals), 2)) if annual_vals else "—"])
    return pdfdocs.pdf_response(_theme_for(request, j), j.title,
        pdfdocs.journal_doc(j, _theme_for(request, j), _profile(), u,
                            j_holidays, j_seminars,
                            TimetableSlot.objects.filter(school_class__owner=u).select_related("school_class"),
                            sessions=list(j_sessions), classes_rows=classes_rows, term_rows=term_rows),
        f"الدفتر اليومي — {j.title}", orientation=_orient(request))


@api_view(['GET'])
def export_inspector(request):
    u = local_user()
    t = _theme_for(request)
    visits = _dated(Visit.objects.filter(owner=u), request)
    i_holidays, i_seminars = _period(Holiday.objects.filter(owner=u), Seminar.objects.filter(owner=u), request)
    observations = _dated(Observation.objects.filter(owner=u), request)
    return pdfdocs.pdf_response(t, "دفتر المفتش",
        pdfdocs.inspector_doc(t, _profile(), u,
                              i_holidays, i_seminars,
                              TimetableSlot.objects.filter(school_class__owner=u).select_related("school_class"),
                              Institution.objects.filter(owner=u), visits,
                              observations,
                              SchoolClass.objects.filter(owner=u),
                              config=_profile().inspector_page_config or {},
                              cover_config=_profile().cover_config or {}),
        "دفتر المفتش", orientation=_orient(request))


@api_view(['GET'])
def export_gradebook(request, pk):
    cls = SchoolClass.objects.filter(pk=pk, owner=local_user()).first()
    if not cls:
        return Response({"detail": "غير موجود."}, status=404)
    term = request.query_params.get("term")
    term = int(term) if term in ("1", "2", "3") else None
    sort = request.query_params.get("sort", "name")
    return pdfdocs.pdf_response(_theme_for(request), f"دفتر التنقيط — {cls.name}",
        pdfdocs.gradebook_doc(cls, _theme_for(request), _profile(), local_user(), term=term, sort=sort),
        f"دفتر التنقيط — {cls.name}", orientation=_orient(request))


@api_view(['GET'])
def export_lesson_plan(request, pk):
    p = LessonPlan.objects.filter(pk=pk, owner=local_user()).first()
    if not p:
        return Response({"detail": "غير موجود."}, status=404)
    return pdfdocs.pdf_response(_theme_for(request, p), p.title,
        pdfdocs.plan_doc(p, _theme_for(request, p), _profile(), local_user()),
        f"خطة الدرس — {p.title}", orientation=_orient(request))


@api_view(['GET'])
def export_course(request, pk):
    c = Course.objects.filter(pk=pk, owner=local_user()).first()
    if not c:
        return Response({"detail": "غير موجود."}, status=404)
    return pdfdocs.pdf_response(_theme_for(request, c), c.title,
        pdfdocs.course_doc(c, _theme_for(request, c), _profile(), local_user()),
        f"الدرس {c.order} — {c.title}", orientation=_orient(request))


@api_view(['GET'])
def export_class_report(request, pk):
    cls = SchoolClass.objects.filter(pk=pk, owner=local_user()).first()
    if not cls:
        return Response({"detail": "غير موجود."}, status=404)
    return pdfdocs.pdf_response(_theme_for(request), f"تقرير {cls.name}",
        pdfdocs.class_report_doc(cls, _theme_for(request), _profile(), local_user()),
        f"تقرير تقدم — {cls.name}", orientation=_orient(request))


@api_view(['GET'])
def export_sessions(request):
    u = local_user()
    qs = Session.objects.filter(owner=u).select_related("school_class", "course")
    cls_id = request.query_params.get("class")
    title = "سجلّ الحصص المنفَّذة"
    if cls_id:
        qs = qs.filter(school_class_id=cls_id)
        cls = SchoolClass.objects.filter(pk=cls_id).first()
        if cls:
            title = f"سجلّ حصص {cls.name}"
    if request.query_params.get("course"):
        qs = qs.filter(course_id=request.query_params["course"])
    if request.query_params.get("status"):
        qs = qs.filter(status=request.query_params["status"])
    qs = _dated(qs, request)
    _order = request.query_params.get("order")
    if _order == "start_time":
        qs = qs.order_by("date", "start_time")
    elif _order == "absentees":
        qs = qs.order_by("-absentees", "-date")
    elif _order == "duration":
        qs = qs.order_by("-duration", "-date")
    return pdfdocs.pdf_response(_theme_for(request), title,
        pdfdocs.sessions_doc(list(qs), _theme_for(request), title, _profile(), u), title,
        orientation=_orient(request))


@api_view(['GET'])
def export_timetable(request):
    u = local_user()
    slots = TimetableSlot.objects.filter(school_class__owner=u).select_related("school_class")
    body = (f"<div class='band' style='font-size:15pt;text-align:center'>برنامج العمل الأسبوعي</div>"
            + pdfdocs.weekly_grid(slots))
    return pdfdocs.pdf_response(_theme_for(request), "برنامج العمل الأسبوعي", body, "برنامج العمل الأسبوعي",
                                orientation=_orient(request))


@api_view(['GET'])
def export_notebook(request, pk):
    b = NoteBook.objects.filter(pk=pk, owner=local_user()).first()
    if not b:
        return Response({"detail": "غير موجود."}, status=404)
    entries = b.entries.select_related("school_class", "course", "session").all()
    if request.query_params.get("tag"):
        entries = entries.filter(tag=request.query_params["tag"])
    if request.query_params.get("class"):
        entries = entries.filter(school_class_id=request.query_params["class"])
    if request.query_params.get("course"):
        entries = entries.filter(course_id=request.query_params["course"])
    entries = _dated(entries, request)
    return pdfdocs.pdf_response(_theme_for(request, b), b.title,
        pdfdocs.notebook_doc(b, _theme_for(request, b), _profile(), local_user(), entries=list(entries)),
        f"دفتر ملاحظات — {b.title}", orientation=_orient(request))


@api_view(['GET'])
def export_observation(request, pk):
    o = Observation.objects.filter(pk=pk, owner=local_user()).first()
    if not o:
        return Response({"detail": "غير موجود."}, status=404)
    return pdfdocs.pdf_response(_theme_for(request), "شبكة ملاحظة الحصة",
        pdfdocs.observation_doc(o, _theme_for(request), _profile(), local_user()),
        f"شبكة ملاحظة — {o.date}", orientation=_orient(request))


@api_view(['GET'])
def export_custom(request, pk):
    doc = CustomDocument.objects.filter(pk=pk, owner=local_user()).first()
    if not doc:
        return Response({"detail": "غير موجود."}, status=404)
    theme = _theme_for(request, doc)
    orientation = request.query_params.get("orientation") or doc.orientation
    body = pdfdocs.custom_doc(doc, theme, _profile(), local_user())
    return pdfdocs.pdf_response(theme, doc.title, body, doc.title, orientation=orientation)


@api_view(['GET'])
def export_custom_docx(request, pk):
    doc = CustomDocument.objects.filter(pk=pk, owner=local_user()).first()
    if not doc:
        return Response({"detail": "غير موجود."}, status=404)
    theme = _theme_for(request, doc)
    data = docx_export.build_docx(doc, theme)
    from django.http import HttpResponse
    from django.utils.text import slugify
    from urllib.parse import quote
    resp = HttpResponse(data, content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ascii_name = slugify(doc.title) or "document"
    resp["Content-Disposition"] = (f'attachment; filename="{ascii_name}.docx"; '
                                   f"filename*=UTF-8''{quote(doc.title + '.docx')}")
    return resp


# ------------------------------------------------------------------ dashboard
class DashboardView(APIView):
    def get(self, request):
        u = local_user()
        journals = Journal.objects.filter(owner=u)
        plans = LessonPlan.objects.filter(owner=u)
        books = NoteBook.objects.filter(owner=u)
        entries = NoteEntry.objects.filter(notebook__owner=u)
        spotlight = Theme.objects.filter(slug="gentleman-navy").first() or Theme.objects.first()
        return Response({
            "counts": {
                "journals": journals.count(),
                "lesson_plans": plans.count(),
                "notebooks": books.count(),
                "entries": entries.count(),
                "themes": Theme.objects.count(),
                "classes": SchoolClass.objects.filter(owner=u).count(),
                "courses": Course.objects.filter(owner=u).count(),
                "sessions": Session.objects.filter(owner=u, status="done").count(),
                "students": Student.objects.filter(school_class__owner=u).count(),
                "institutions": Institution.objects.filter(owner=u).count(),
                "visits": Visit.objects.filter(owner=u).count(),
                "holidays": Holiday.objects.filter(owner=u).count(),
                "seminars": Seminar.objects.filter(owner=u).count(),
                "observations": Observation.objects.filter(owner=u).count(),
                "documents": CustomDocument.objects.filter(owner=u).count(),
                "question_bank": QuestionBankItem.objects.filter(owner=u).count(),
                "attendance_records": AttendanceRecord.objects.filter(student__school_class__owner=u).count(),
                "follow_up_records": StudentFollowUpRecord.objects.filter(student__school_class__owner=u).count(),
                "support_plans": SupportPlan.objects.filter(student__school_class__owner=u).count(),
                "open_support_plans": SupportPlan.objects.filter(student__school_class__owner=u).exclude(status__in=["completed", "cancelled"]).count(),
                "parent_communications": ParentCommunication.objects.filter(student__school_class__owner=u).count(),
                "assignments": Assignment.objects.filter(school_class__owner=u).count(),
                "active_assignments": Assignment.objects.filter(school_class__owner=u, status="active").count(),
                "overdue_assignments": Assignment.objects.filter(school_class__owner=u, status__in=["draft", "active"], due_date__lt=datetime.date.today()).count(),
                "assignment_submissions": AssignmentSubmission.objects.filter(student__school_class__owner=u).count(),
                "missing_assignment_submissions": AssignmentSubmission.objects.filter(student__school_class__owner=u, status="not_submitted", assignment__due_date__lte=datetime.date.today()).count(),
                "teacher_tasks": TeacherTask.objects.filter(owner=u).count(),
                "open_tasks": TeacherTask.objects.filter(owner=u, status__in=["pending", "in_progress"]).count(),
                "overdue_tasks": TeacherTask.objects.filter(owner=u, status__in=["pending", "in_progress"], due_date__lt=datetime.date.today()).count(),
            },
            "recent_journals": JournalSerializer(journals.order_by("-updated_at")[:4], many=True).data,
            "recent_plans": LessonPlanSerializer(plans.order_by("-updated_at")[:4], many=True).data,
            "recent_entries": NoteEntrySerializer(entries.order_by("-date")[:5], many=True).data,
            "spotlight_theme": ThemeSerializer(spotlight).data if spotlight else None,
        })


# ------------------------------------------------------------------ dashboard extra counts patch
# (kept in DashboardView below)
