import io
import json
import secrets
import zipfile

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from . import document_exchange
from .models import Assessment, AssessmentResult, Assignment, AssignmentSubmission, AttendanceRecord, Course, CustomDocument, Holiday, Institution, Journal, LessonPlan, Mark, Meeting, ParentCommunication, QuestionBankItem, SchoolClass, Seminar, Session, TimetableSlot, Student, StudentFollowUpRecord, SupportGroup, SupportPlan, TeacherProfile, TeacherTask, Theme
from .serializers import TimetableSlotSerializer
from .views import local_user


class TeacherAPITestCase(APITestCase):
    """Existing workflow tests run as the one provisioned teacher."""

    def setUp(self):
        super().setUp()
        User = get_user_model()
        self.teacher, created = User.objects.get_or_create(
            username=settings.TEACHER_USERNAME,
            defaults={"first_name": "Test", "last_name": "Teacher"},
        )
        if created:
            self.teacher.set_unusable_password()
            self.teacher.save(update_fields=["password"])
        self.client.force_authenticate(user=self.teacher)


class PrivateTeacherAuthTests(APITestCase):
    def setUp(self):
        super().setUp()
        self.User = get_user_model()
        self.password = secrets.token_urlsafe(24)
        self.teacher = self.User.objects.create_user(
            username=settings.TEACHER_USERNAME,
            password=self.password,
            first_name="Test",
            last_name="Teacher",
        )

    def test_private_api_and_me_reject_anonymous_without_creating_an_account(self):
        self.teacher.delete()
        before = self.User.objects.count()
        anonymous = APIClient()
        self.assertEqual(anonymous.get("/api/dashboard/").status_code, 403)
        me = anonymous.get("/api/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertIsNone(me.data["user"])
        self.assertEqual(self.User.objects.count(), before)
        self.assertFalse(self.User.objects.filter(username=settings.TEACHER_USERNAME).exists())

    def test_login_logout_server_session(self):
        client = APIClient(enforce_csrf_checks=True)
        credentials = {"username": self.teacher.username, "password": self.password}
        # LoginView is CSRF-exempt: no CSRF token needed to log in
        logged_in = client.post("/api/auth/login/", credentials, format="json")
        self.assertEqual(logged_in.status_code, 200, logged_in.content)
        self.assertIn("sessionid", client.cookies)
        self.assertEqual(client.get("/api/auth/me/").data["user"]["username"], self.teacher.username)

        token = client.cookies["csrftoken"].value
        logged_out = client.post(
            "/api/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(logged_out.status_code, 200, logged_out.content)
        self.assertIsNone(client.get("/api/auth/me/").data["user"])

    def test_other_accounts_cannot_sign_in_or_access_the_workspace(self):
        other = self.User.objects.create_user(username="other", password=self.password)
        client = APIClient(enforce_csrf_checks=True)
        client.get("/api/auth/csrf/")
        response = client.post(
            "/api/auth/login/",
            {"username": other.username, "password": self.password},
            format="json",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(client.get("/api/classes/").status_code, 403)

    def test_public_registration_and_demo_login_are_not_exposed(self):
        self.assertEqual(self.client.post("/api/auth/register/", {}, format="json").status_code, 404)
        self.assertEqual(self.client.post("/api/auth/demo-login/", {}, format="json").status_code, 404)

    def test_private_provisioning_command_sets_a_strong_password_without_displaying_it(self):
        from unittest.mock import patch
        from django.core.management import call_command
        from io import StringIO

        password = secrets.token_urlsafe(30)
        output = StringIO()
        with patch(
            "hub.management.commands.provision_teacher.getpass",
            side_effect=[password, password],
        ):
            call_command("provision_teacher", stdout=output)
        self.teacher.refresh_from_db()
        self.assertTrue(self.teacher.check_password(password))
        self.assertFalse(self.teacher.is_staff)
        self.assertFalse(self.teacher.is_superuser)
        self.assertNotIn(password, output.getvalue())


@override_settings(CACHES={
    "default": {
        "BACKEND": "django.core.cache.backends.db.DatabaseCache",
        "LOCATION": "teacherhub_login_cache_test",
    }
})
class SharedDatabaseLoginThrottleTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        call_command("createcachetable", "teacherhub_login_cache_test", verbosity=0)

    def setUp(self):
        super().setUp()
        from django.core.cache import cache
        cache.clear()

    def _client_with_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.get("/api/auth/csrf/")
        self.assertEqual(response.status_code, 200)
        return client, client.cookies["csrftoken"].value

    def _failed_logins(self, client, token, count):
        statuses = []
        for _ in range(count):
            response = client.post(
                "/api/auth/login/",
                {"username": settings.TEACHER_USERNAME, "password": ""},
                format="json",
                HTTP_X_CSRFTOKEN=token,
            )
            statuses.append(response.status_code)
        return statuses

    def test_throttle_cache_key_does_not_store_the_raw_client_ip(self):
        from django.test import RequestFactory
        from .throttling import PrivateTeacherLoginThrottle

        request = RequestFactory().post("/", REMOTE_ADDR="192.0.2.42")
        ident = PrivateTeacherLoginThrottle().get_ident(request)
        self.assertEqual(len(ident), 64)
        self.assertNotIn("192.0.2.42", ident)

    def test_shared_database_throttle_counts_across_client_instances(self):
        first, first_token = self._client_with_csrf()
        second, second_token = self._client_with_csrf()
        self.assertEqual(self._failed_logins(first, first_token, 6), [401] * 6)
        self.assertEqual(self._failed_logins(second, second_token, 5), [401] * 4 + [429])


class DocumentExchangeTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.theme = Theme.objects.create(slug="gentleman-navy", name_ar="البدلة الكحلية")

    def payload(self, title="اختبار مستورد"):
        return {
            "format": document_exchange.FORMAT,
            "version": document_exchange.VERSION,
            "document": {
                "title": title,
                "kind": "exam",
                "orientation": "portrait",
                "theme_slug": self.theme.slug,
                "tags": ["اختبارات", "ثلاثي أول"],
                "content": {"blocks": [
                    {"type": "heading", "text": "تعليمات"},
                    {"type": "text", "text": "أجب عن جميع الأسئلة."},
                ]},
            },
        }

    def test_import_json_and_export_json_round_trip(self):
        response = self.client.post("/api/documents/import-json/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        self.assertEqual(doc.tags, ["اختبارات", "ثلاثي أول"])
        self.assertEqual(doc.theme, self.theme)

        exported = self.client.get(f"/api/documents/{doc.id}/export-json/")
        self.assertEqual(exported.status_code, 200)
        data = json.loads(exported.content.decode("utf-8"))
        self.assertEqual(data["format"], document_exchange.FORMAT)
        self.assertEqual(data["document"]["title"], "اختبار مستورد")

    def test_invalid_block_type_is_rejected(self):
        payload = self.payload()
        payload["document"]["content"]["blocks"] = [{"type": "script", "text": "bad"}]
        response = self.client.post("/api/documents/import-json/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(CustomDocument.objects.count(), 0)

    def test_import_markdown_file(self):
        upload = SimpleUploadedFile(
            "lesson.md",
            "# عنوان الدرس\n\n- نقطة أولى\n- نقطة ثانية\n\nنص ختامي.".encode("utf-8"),
            content_type="text/markdown",
        )
        response = self.client.post("/api/documents/import-file/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, 201, response.content)
        blocks = response.data["content"]["blocks"]
        self.assertEqual(blocks[0]["type"], "heading")
        self.assertIn("checklist", [b["type"] for b in blocks])

    def test_import_docx_file(self):
        from docx import Document

        source = Document()
        source.add_heading("درس مستورد", level=1)
        source.add_paragraph("فقرة قابلة للتحرير.")
        table = source.add_table(rows=2, cols=2)
        table.cell(0, 0).text = "العنصر"
        table.cell(0, 1).text = "الشرح"
        table.cell(1, 0).text = "البيانات"
        table.cell(1, 1).text = "قيم أولية"
        buffer = io.BytesIO()
        source.save(buffer)
        upload = SimpleUploadedFile(
            "lesson.docx", buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        response = self.client.post("/api/documents/import-file/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, 201, response.content)
        types = [b["type"] for b in response.data["content"]["blocks"]]
        self.assertIn("table", types)

    def test_import_pdf_file(self):
        import pymupdf

        pdf = pymupdf.open()
        page = pdf.new_page()
        page.insert_text((72, 72), "Editable PDF Lesson", fontsize=20)
        page.insert_text((72, 110), "This paragraph was extracted from a PDF and can now be edited.", fontsize=11)
        upload = SimpleUploadedFile("lesson.pdf", pdf.tobytes(), content_type="application/pdf")
        response = self.client.post("/api/documents/import-file/", {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, 201, response.content)
        blocks = response.data["content"]["blocks"]
        self.assertTrue(any("Editable PDF Lesson" in str(b.get("text", "")) for b in blocks))
        self.assertTrue(any("can now be edited" in str(b.get("text", "")) for b in blocks))

    def test_bulk_archive_favorite_and_zip_json_export(self):
        first = self.client.post("/api/documents/import-json/", self.payload("وثيقة أ"), format="json").data
        second = self.client.post("/api/documents/import-json/", self.payload("وثيقة ب"), format="json").data

        response = self.client.post(
            "/api/documents/bulk/", {"ids": [first["id"], second["id"]], "action": "archive"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(all(d["is_archived"] for d in response.data["documents"]))

        response = self.client.post(
            "/api/documents/bulk/", {"ids": [first["id"]], "action": "favorite"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["documents"][0]["is_favorite"])

        exported = self.client.post(
            "/api/documents/bulk-export/", {"ids": [first["id"], second["id"]], "format": "json"}, format="json")
        self.assertEqual(exported.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(exported.content)) as archive:
            self.assertEqual(len(archive.namelist()), 2)
            self.assertTrue(all(name.endswith(".teacherhub.json") for name in archive.namelist()))


class QuestionBankTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.course = Course.objects.create(owner=self.user,
            title="نظام التشغيل", domain="بيئة التعامل مع الحاسوب", unit="البرمجيات",
            level="أولى ثانوي", order=3, summary="ملخص الدرس",
            key_points=["وظائف نظام التشغيل", "أنواع أنظمة التشغيل"])

    def create_question(self, prompt="ما هو نظام التشغيل؟", points=2, difficulty="متوسط"):
        return self.client.post("/api/question-bank/", {
            "course": self.course.id, "prompt": prompt, "qtype": "سؤال قصير",
            "difficulty": difficulty, "points": points, "options": [],
            "answer": "برنامج يدير موارد الحاسوب", "explanation": "", "lines": 3,
            "tags": ["أساسيات"],
        }, format="json")

    def test_create_and_filter_question(self):
        response = self.create_question()
        self.assertEqual(response.status_code, 201, response.content)
        listed = self.client.get("/api/question-bank/?q=نظام")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(listed.data["results"][0]["course_title"], "نظام التشغيل")

    def test_seed_from_courses_is_idempotent(self):
        first = self.client.post("/api/question-bank/seed-from-courses/", {}, format="json")
        second = self.client.post("/api/question-bank/seed-from-courses/", {}, format="json")
        self.assertEqual(first.data["created"], 2)
        self.assertEqual(second.data["created"], 0)
        self.assertEqual(QuestionBankItem.objects.count(), 2)

    def test_import_from_document_and_generate_exam(self):
        doc = CustomDocument.objects.create(owner=self.user,
            title="اختبار قديم", kind="exam", content={"blocks": [{
                "type": "questions", "title": "الأسئلة", "questions": [
                    {"prompt": "اذكر وظيفتين لنظام التشغيل.", "qtype": "سؤال قصير",
                     "points": 4, "options": [], "answer": "إدارة الملفات والذاكرة", "lines": 3},
                ],
            }]})
        imported = self.client.post(
            "/api/question-bank/import-from-document/",
            {"document_id": doc.id, "course_id": self.course.id}, format="json")
        self.assertEqual(imported.status_code, 201, imported.content)
        self.assertEqual(imported.data["created"], 1)

        generated = self.client.post("/api/question-bank/generate-document/", {
            "course_id": self.course.id, "count": 5, "strategy": "sequential",
            "include_answer_key": True, "title": "اختبار مولّد من البنك",
        }, format="json")
        self.assertEqual(generated.status_code, 201, generated.content)
        doc2 = CustomDocument.objects.get(pk=generated.data["id"])
        qblock = next(b for b in doc2.content["blocks"] if b["type"] == "questions")
        self.assertEqual(len(qblock["questions"]), 1)
        self.assertTrue(qblock["show_answers"])

    def test_generate_document_rejects_empty_match(self):
        response = self.client.post("/api/question-bank/generate-document/", {
            "course_id": self.course.id, "difficulty": "صعب",
        }, format="json")
        self.assertEqual(response.status_code, 400)


class AttendanceFollowUpTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1 ج م ع 1", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali Benali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara Haddad")
        self.course = Course.objects.create(owner=self.user, title="تقنية المعلومات", order=1)

    def test_mark_attendance_bulk_is_idempotent_and_summarised(self):
        payload = {"class_id": self.cls.id, "date": "2026-11-10", "records": [
            {"student_id": self.ali.id, "status": "present", "note": ""},
            {"student_id": self.sara.id, "status": "absent", "note": "بدون مبرر"},
        ]}
        first = self.client.post("/api/attendance/mark-bulk/", payload, format="json")
        second = self.client.post("/api/attendance/mark-bulk/", payload, format="json")
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(second.data["saved"], 2)
        self.assertEqual(AttendanceRecord.objects.count(), 2)

        day = self.client.get(f"/api/attendance/day/?class={self.cls.id}&date=2026-11-10")
        self.assertEqual(day.data["counts"]["absent"], 1)
        summary = self.client.get(f"/api/attendance/summary/?class={self.cls.id}")
        self.assertEqual(summary.data["recorded_days"], 1)
        sara = next(x for x in summary.data["students"] if x["student_id"] == self.sara.id)
        self.assertEqual(sara["attendance_rate"], 0.0)

    def test_generate_actual_attendance_register(self):
        self.client.post("/api/attendance/mark-bulk/", {
            "class_id": self.cls.id, "date": "2026-11-10", "records": [
                {"student_id": self.ali.id, "status": "present"},
                {"student_id": self.sara.id, "status": "late", "note": "تأخر 10 دقائق"},
            ]}, format="json")
        response = self.client.post("/api/attendance/generate-register/", {
            "class_id": self.cls.id, "month": "2026-11"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        self.assertEqual(doc.kind, "attendance-sheet")
        table = next(b for b in doc.content["blocks"] if b["type"] == "table")
        self.assertIn("✓", table["rows"][0])
        self.assertIn("ت", table["rows"][1])

    def test_follow_up_bulk_summary_and_document(self):
        response = self.client.post("/api/follow-ups/bulk-save/", {
            "class_id": self.cls.id, "date": "2026-11-10", "category": "homework",
            "course_id": self.course.id, "records": [
                {"student_id": self.ali.id, "score": 5, "status": "أنجز", "note": "عمل ممتاز"},
                {"student_id": self.sara.id, "score": 2, "status": "جزئي", "note": "يحتاج مراجعة"},
            ]}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(StudentFollowUpRecord.objects.count(), 2)

        summary = self.client.get(f"/api/follow-ups/summary/?class={self.cls.id}")
        self.assertEqual(summary.data["total_records"], 2)
        sara = next(x for x in summary.data["students"] if x["student_id"] == self.sara.id)
        self.assertTrue(sara["needs_support"])

        generated = self.client.post("/api/follow-ups/generate-document/", {
            "class_id": self.cls.id, "from": "2026-11-01", "to": "2026-11-30"}, format="json")
        self.assertEqual(generated.status_code, 201, generated.content)
        self.assertEqual(CustomDocument.objects.get(pk=generated.data["id"]).kind, "tracker-sheet")


class SupportPlanTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج الدعم", level="أولى ثانوي")
        self.student = Student.objects.create(school_class=self.cls, full_name="تلميذ يحتاج دعمًا")
        Mark.objects.create(student=self.student, term=1, continuous=8, supervised=9, exam=9)
        AttendanceRecord.objects.create(student=self.student, date="2026-11-10", status="absent")
        AttendanceRecord.objects.create(student=self.student, date="2026-11-11", status="absent")
        AttendanceRecord.objects.create(student=self.student, date="2026-11-12", status="absent")
        StudentFollowUpRecord.objects.create(student=self.student, date="2026-11-12", category="homework", score=2, status="جزئي")

    def create_plan(self):
        return self.client.post("/api/support-plans/", {
            "student": self.student.id, "title": "خطة تحسين الحضور والواجبات",
            "category": "mixed", "priority": "high", "status": "active",
            "reason": "غيابات متكررة وواجبات غير مكتملة",
            "actions": [{"text": "اتصال بالولي", "done": False, "due": "2026-11-20"},
                        {"text": "مراجعة أسبوعية للواجبات", "done": True, "due": ""}],
            "start_date": "2026-11-14", "due_date": "2026-12-14",
            "teacher_notes": "متابعة أسبوعية", "outcome": "",
        }, format="json")

    def test_risk_overview_detects_student(self):
        response = self.client.get(f"/api/support-plans/risk-overview/?class={self.cls.id}")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["students_at_risk"], 1)
        row = response.data["students"][0]
        self.assertGreaterEqual(row["risk_score"], 50)
        self.assertTrue(row["reasons"])

    def test_create_plan_progress_and_documents(self):
        created = self.create_plan()
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data["progress_percent"], 50)
        plan = SupportPlan.objects.get(pk=created.data["id"])

        generated = self.client.post(f"/api/support-plans/{plan.id}/generate-document/", {"type": "plan"}, format="json")
        self.assertEqual(generated.status_code, 201, generated.content)
        self.assertEqual(CustomDocument.objects.get(pk=generated.data["document"]["id"]).kind, "report-card")

        letter = self.client.post(f"/api/support-plans/{plan.id}/generate-document/", {"type": "letter"}, format="json")
        self.assertEqual(letter.status_code, 201, letter.content)
        self.assertEqual(CustomDocument.objects.get(pk=letter.data["document"]["id"]).kind, "parent-letter")
        self.assertEqual(ParentCommunication.objects.count(), 1)

    def test_parent_communication_crud_filter(self):
        plan = SupportPlan.objects.create(student=self.student, title="خطة")
        response = self.client.post("/api/parent-communications/", {
            "student": self.student.id, "support_plan": plan.id, "date": "2026-11-14",
            "channel": "phone", "subject": "متابعة الغياب", "summary": "تم الاتصال بالولي",
            "outcome": "تعهد بمتابعة الحضور", "follow_up_date": "2026-11-21",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        listed = self.client.get(f"/api/parent-communications/?student={self.student.id}&channel=phone")
        self.assertEqual(listed.data["count"], 1)



class AssignmentTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج المهام", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara")
        self.course = Course.objects.create(owner=self.user, title="نظام التشغيل", order=1,
                                            key_points=["وظائف نظام التشغيل", "إدارة الملفات"])

    def create_assignment(self):
        return self.client.post("/api/assignments/", {
            "school_class": self.cls.id, "course": self.course.id, "title": "واجب نظام التشغيل",
            "assignment_type": "homework", "status": "active", "assigned_date": "2020-01-01",
            "due_date": "2020-01-05", "instructions": "أجب عن الأنشطة التالية.",
            "success_criteria": "إجابات واضحة\nأمثلة صحيحة", "max_score": 20,
            "estimated_minutes": 25, "allow_late": True,
        }, format="json")

    def track(self, assignment_id):
        return self.client.post(f"/api/assignments/{assignment_id}/bulk-save/", {"records": [
            {"student_id": self.ali.id, "status": "submitted", "score": 18, "feedback": "عمل جيد"},
            {"student_id": self.sara.id, "status": "not_submitted", "score": None, "feedback": ""},
        ]}, format="json")

    def test_create_assignment_and_tracking_stats(self):
        created = self.create_assignment()
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data["stats"]["expected"], 2)
        tracked = self.track(created.data["id"])
        self.assertEqual(tracked.status_code, 200, tracked.content)
        self.assertEqual(tracked.data["saved"], 2)
        self.assertEqual(tracked.data["stats"]["submitted"], 1)
        self.assertEqual(tracked.data["stats"]["missing"], 1)
        self.assertEqual(tracked.data["stats"]["completion_rate"], 50.0)
        self.assertEqual(tracked.data["stats"]["average_score_percent"], 90.0)
        self.assertEqual(AssignmentSubmission.objects.count(), 2)

    def test_overview_and_risk_include_missing_assignment(self):
        created = self.create_assignment()
        self.track(created.data["id"])
        overview = self.client.get(f"/api/assignments/overview/?class={self.cls.id}")
        self.assertEqual(overview.status_code, 200, overview.content)
        self.assertEqual(overview.data["totals"]["missing"], 1)
        self.assertEqual(len(overview.data["missing_students"]), 1)
        self.assertEqual(overview.data["missing_students"][0]["student_id"], self.sara.id)
        risk = self.client.get(f"/api/support-plans/risk-overview/?class={self.cls.id}")
        row = next(x for x in risk.data["students"] if x["student_id"] == self.sara.id)
        self.assertEqual(row["assignment_counts"]["missing"], 1)
        self.assertTrue(any("مهمة واجبة" in reason for reason in row["reasons"]))

    def test_generate_assignment_documents(self):
        created = self.create_assignment()
        assignment_id = created.data["id"]
        self.track(assignment_id)
        worksheet = self.client.post(f"/api/assignments/{assignment_id}/generate-document/", {"type": "worksheet"}, format="json")
        self.assertEqual(worksheet.status_code, 201, worksheet.content)
        self.assertEqual(CustomDocument.objects.get(pk=worksheet.data["id"]).kind, "worksheet")
        report = self.client.post(f"/api/assignments/{assignment_id}/generate-document/", {"type": "report"}, format="json")
        self.assertEqual(report.status_code, 201, report.content)
        self.assertEqual(CustomDocument.objects.get(pk=report.data["id"]).kind, "tracker-sheet")
        missing = self.client.post(f"/api/assignments/{assignment_id}/generate-document/", {"type": "missing"}, format="json")
        self.assertEqual(missing.status_code, 201, missing.content)

    def test_support_missing_is_idempotent_and_score_is_clamped(self):
        created = self.create_assignment()
        assignment_id = created.data["id"]
        saved = self.client.post(f"/api/assignments/{assignment_id}/bulk-save/", {"records": [
            {"student_id": self.ali.id, "status": "reviewed", "score": 99, "feedback": ""},
            {"student_id": self.sara.id, "status": "not_submitted"},
        ]}, format="json")
        ali = next(x for x in saved.data["students"] if x["student"] == self.ali.id)
        self.assertEqual(ali["score"], 20)
        first = self.client.post(f"/api/assignments/{assignment_id}/support-missing/", {}, format="json")
        second = self.client.post(f"/api/assignments/{assignment_id}/support-missing/", {}, format="json")
        self.assertEqual(first.data["created"], 1)
        self.assertEqual(second.data["created"], 0)
        self.assertEqual(second.data["existing"], 1)
        self.assertEqual(SupportPlan.objects.filter(student=self.sara, category="homework").count(), 1)



class StudentDossierTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج الملف الفردي", level="أولى ثانوي")
        self.student = Student.objects.create(school_class=self.cls, full_name="تلميذ الملف الشامل")
        self.course = Course.objects.create(owner=self.user, title="الملفات والمجلدات", order=2)
        Mark.objects.create(student=self.student, term=1, continuous=8, supervised=9, exam=9)
        Mark.objects.create(student=self.student, term=2, continuous=12, supervised=13, exam=14)
        AttendanceRecord.objects.create(student=self.student, date="2026-11-10", status="present")
        AttendanceRecord.objects.create(student=self.student, date="2026-11-11", status="absent", note="غياب يحتاج متابعة")
        StudentFollowUpRecord.objects.create(student=self.student, course=self.course, date="2026-11-12", category="homework", score=2, status="جزئي", note="واجب غير مكتمل")
        self.assignment = Assignment.objects.create(
            school_class=self.cls, course=self.course, title="واجب الملفات", assignment_type="homework",
            status="active", assigned_date="2020-01-01", due_date="2020-01-05", max_score=20)
        self.plan = SupportPlan.objects.create(
            student=self.student, title="خطة تحسين الواجبات", category="homework", priority="high",
            status="active", actions=[{"text": "مراجعة أسبوعية", "done": True, "due": ""}],
            start_date="2026-11-12")
        ParentCommunication.objects.create(
            student=self.student, support_plan=self.plan, date="2026-11-13", channel="phone",
            subject="متابعة الواجب", summary="اتصال بالولي", outcome="اتفاق على متابعة أسبوعية")

    def test_dossier_aggregates_all_student_records(self):
        response = self.client.get(f"/api/students/{self.student.id}/dossier/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["student"]["full_name"], "تلميذ الملف الشامل")
        self.assertEqual(response.data["summary"]["marks"]["annual_average"], 11.0)
        self.assertEqual(response.data["summary"]["attendance"]["attendance_rate"], 50.0)
        self.assertEqual(response.data["summary"]["assignments"]["missing"], 1)
        self.assertEqual(response.data["summary"]["support"]["open"], 1)
        self.assertEqual(response.data["summary"]["communications"]["total"], 1)
        self.assertGreaterEqual(response.data["risk"]["risk_score"], 25)
        event_types = {row["type"] for row in response.data["timeline"]}
        self.assertTrue({"attendance", "follow_up", "assignment", "support", "communication"}.issubset(event_types))
        self.assertTrue(response.data["recommendations"]["next_actions"])

    def test_generate_individual_report_and_parent_summary(self):
        report = self.client.post(f"/api/students/{self.student.id}/generate-document/", {"type": "report"}, format="json")
        self.assertEqual(report.status_code, 201, report.content)
        report_doc = CustomDocument.objects.get(pk=report.data["document"]["id"])
        self.assertEqual(report_doc.kind, "report-card")
        self.assertEqual(report_doc.source_type, "student-dossier")

        parent = self.client.post(f"/api/students/{self.student.id}/generate-document/", {"type": "parent"}, format="json")
        self.assertEqual(parent.status_code, 201, parent.content)
        self.assertEqual(CustomDocument.objects.get(pk=parent.data["document"]["id"]).kind, "parent-letter")
        self.assertEqual(ParentCommunication.objects.filter(student=self.student).count(), 2)

        dossier = self.client.get(f"/api/students/{self.student.id}/dossier/")
        self.assertEqual(len(dossier.data["generated_documents"]), 2)



class ClassAnalyticsTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج التحليلات", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara")
        self.course = Course.objects.create(owner=self.user, title="نظام التشغيل", order=1)
        Course.objects.create(owner=self.user, title="الملفات والمجلدات", order=2)
        Mark.objects.create(student=self.ali, term=1, continuous=18, supervised=18, exam=19)
        Mark.objects.create(student=self.ali, term=2, continuous=19, supervised=19, exam=20)
        Mark.objects.create(student=self.sara, term=1, continuous=8, supervised=9, exam=9)
        Mark.objects.create(student=self.sara, term=2, continuous=10, supervised=10, exam=11)
        AttendanceRecord.objects.create(student=self.ali, date="2026-11-10", status="present")
        AttendanceRecord.objects.create(student=self.sara, date="2026-11-10", status="present")
        AttendanceRecord.objects.create(student=self.sara, date="2026-11-11", status="absent")
        StudentFollowUpRecord.objects.create(student=self.sara, date="2026-11-11", category="homework", score=2)
        self.assignment = Assignment.objects.create(
            school_class=self.cls, course=self.course, title="واجب التحليلات", status="active",
            assigned_date="2020-01-01", due_date="2020-01-05", max_score=20)
        AssignmentSubmission.objects.create(assignment=self.assignment, student=self.ali, status="reviewed", score=18)
        AssignmentSubmission.objects.create(assignment=self.assignment, student=self.sara, status="not_submitted")
        SupportPlan.objects.create(student=self.sara, title="خطة دعم التحليلات", status="active", category="mixed")
        Session.objects.create(owner=self.user, school_class=self.cls, course=self.course, date="2026-11-10", status="done")

    def test_class_analytics_aggregates_all_domains(self):
        response = self.client.get(f"/api/classes/{self.cls.id}/analytics/?term=1")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["class"]["students"], 2)
        self.assertEqual(response.data["marks"]["selected"]["graded"], 2)
        self.assertEqual(response.data["marks"]["selected"]["success_rate"], 50.0)
        self.assertEqual(response.data["attendance"]["attendance_rate"], 66.7)
        self.assertEqual(response.data["assignments"]["completion_rate"], 50.0)
        self.assertEqual(response.data["curriculum"]["percent"], 50)
        self.assertIsNotNone(response.data["health"]["score"])
        self.assertEqual(response.data["top_performers"][0]["student_id"], self.ali.id)
        self.assertEqual(response.data["needs_support"][0]["student_id"], self.sara.id)
        self.assertTrue(response.data["recommendations"])

    def test_class_analytics_overview_and_reports(self):
        overview = self.client.get("/api/analytics/classes/?term=1")
        self.assertEqual(overview.status_code, 200, overview.content)
        self.assertEqual(len(overview.data["classes"]), 1)
        self.assertEqual(overview.data["classes"][0]["class_id"], self.cls.id)

        council = self.client.post(f"/api/analytics/classes/{self.cls.id}/generate-report/", {"term": 1, "type": "council"}, format="json")
        self.assertEqual(council.status_code, 201, council.content)
        council_doc = CustomDocument.objects.get(pk=council.data["id"])
        self.assertEqual(council_doc.kind, "report-card")
        self.assertEqual(council_doc.source_type, "class-analytics")

        bulletin = self.client.post(f"/api/analytics/classes/{self.cls.id}/generate-report/", {"term": 1, "type": "bulletin"}, format="json")
        self.assertEqual(bulletin.status_code, 201, bulletin.content)
        self.assertEqual(CustomDocument.objects.get(pk=bulletin.data["id"]).kind, "parent-letter")



class TeacherTaskTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج الإجراءات", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara")
        self.omar = Student.objects.create(school_class=self.cls, full_name="Omar")
        self.course = Course.objects.create(owner=self.user, title="نظام التشغيل", order=1)
        for student in (self.sara, self.omar):
            Mark.objects.create(student=student, term=1, continuous=8, supervised=9, exam=9)
            for day in ("2026-11-10", "2026-11-11", "2026-11-12"):
                AttendanceRecord.objects.create(student=student, date=day, status="absent")
            StudentFollowUpRecord.objects.create(student=student, date="2026-11-12", category="homework", score=2)
        self.assignment = Assignment.objects.create(
            school_class=self.cls, course=self.course, title="واجب الإجراءات", status="active",
            assigned_date="2020-01-01", due_date="2020-01-05", max_score=20)
        AssignmentSubmission.objects.create(assignment=self.assignment, student=self.ali, status="submitted", score=18)
        AssignmentSubmission.objects.create(assignment=self.assignment, student=self.sara, status="not_submitted")
        self.plan = SupportPlan.objects.create(
            student=self.sara, title="خطة دعم الإجراءات", category="mixed", priority="high", status="active",
            due_date="2020-01-06", actions=[{"text": "مراجعة", "done": False, "due": ""}])
        ParentCommunication.objects.create(
            student=self.sara, support_plan=self.plan, date="2020-01-03", channel="phone",
            subject="متابعة الغياب", outcome="اتفاق على اتصال لاحق", follow_up_date="2020-01-10")

    def test_manual_task_crud_summary_and_completion(self):
        created = self.client.post("/api/tasks/", {
            "title": "تحضير ملخص الفوج", "description": "مراجعة النتائج", "category": "document",
            "priority": "medium", "status": "pending", "due_date": "2026-11-20",
            "student": self.sara.id, "school_class": self.cls.id,
        }, format="json")
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data["route"], f"/students/{self.sara.id}")
        completed = self.client.post(f"/api/tasks/{created.data['id']}/complete/", {}, format="json")
        self.assertEqual(completed.data["status"], "done")
        self.assertIsNotNone(completed.data["completed_at"])
        summary = self.client.get("/api/tasks/summary/")
        self.assertEqual(summary.data["done"], 1)
        self.assertEqual(summary.data["completion_rate"], 100.0)

    def test_smart_suggestions_and_idempotent_acceptance(self):
        response = self.client.get("/api/tasks/suggestions/")
        self.assertEqual(response.status_code, 200, response.content)
        keys = {row["key"] for row in response.data["suggestions"]}
        self.assertIn(f"assignment:{self.assignment.id}", keys)
        self.assertIn(f"support-plan:{self.plan.id}", keys)
        self.assertIn(f"student-risk:{self.omar.id}", keys)
        self.assertTrue(any(key.startswith("parent-follow-up:") for key in keys))

        suggestion = next(row for row in response.data["suggestions"] if row["key"] == f"assignment:{self.assignment.id}")
        first = self.client.post("/api/tasks/accept-suggestion/", suggestion, format="json")
        second = self.client.post("/api/tasks/accept-suggestion/", suggestion, format="json")
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertEqual(TeacherTask.objects.filter(source_type="assignment", source_id=self.assignment.id).count(), 1)

        generated = self.client.post("/api/tasks/generate-suggestions/", {}, format="json")
        self.assertGreaterEqual(generated.data["created"], 3)
        regenerated = self.client.post("/api/tasks/generate-suggestions/", {}, format="json")
        self.assertEqual(regenerated.data["created"], 0)

    def test_generate_action_plan_document(self):
        self.client.post("/api/tasks/", {"title": "مهمة خطة العمل", "category": "general", "priority": "high", "due_date": "2020-01-01"}, format="json")
        response = self.client.post("/api/tasks/generate-document/", {"only_open": True}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        self.assertEqual(doc.kind, "tracker-sheet")
        self.assertEqual(doc.source_type, "teacher-tasks")


class TermPackTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج باقة الثلاثي", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara")
        self.omar = Student.objects.create(school_class=self.cls, full_name="Omar")
        Mark.objects.create(student=self.ali, term=1, continuous=16, supervised=17, exam=18)
        Mark.objects.create(student=self.sara, term=1, continuous=8, supervised=9, exam=9)
        for day in ("2026-11-10", "2026-11-11"):
            AttendanceRecord.objects.create(student=self.sara, date=day, status="absent")

    def test_preview_readiness_and_ranks(self):
        response = self.client.get(f"/api/classes/{self.cls.id}/term-pack/?term=1")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data
        self.assertEqual(data["summary"]["graded"], 2)
        self.assertEqual(data["generated_reports"], 0)
        marks_check = next(row for row in data["readiness"]["checks"] if row["key"] == "marks")
        self.assertEqual(marks_check["status"], "missing")
        self.assertIn("Omar", marks_check["detail"])
        rows = {row["student_name"]: row for row in data["students"]}
        self.assertEqual(rows["Ali"]["rank"], 1)
        self.assertIsNone(rows["Omar"]["rank"])
        self.assertFalse(rows["Ali"]["has_report"])
        overview = self.client.get("/api/term-packs/?term=1")
        self.assertEqual(overview.status_code, 200)
        self.assertTrue(any(row["class"]["id"] == self.cls.id for row in overview.data["classes"]))

    def test_generate_pack_and_skip_existing(self):
        response = self.client.post(f"/api/classes/{self.cls.id}/term-pack/generate/", {
            "term": 1, "include": ["reports", "certificates", "council", "bulletin"],
            "certificate_mode": "threshold", "min_average": 14, "skip_existing": True,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        # 3 student reports + certificates + council + bulletin
        self.assertEqual(response.data["created_count"], 6, response.data)
        types = [row["type"] for row in response.data["created"]]
        self.assertEqual(types.count("report"), 3)
        cert = CustomDocument.objects.get(kind="certificate", source_type="term-pack", source_id=self.cls.id)
        names = cert.content["blocks"][0]["names"]
        self.assertEqual(names, ["Ali"])
        preview = self.client.get(f"/api/classes/{self.cls.id}/term-pack/?term=1").data
        self.assertEqual(preview["generated_reports"], 3)

        again = self.client.post(f"/api/classes/{self.cls.id}/term-pack/generate/", {
            "term": 1, "include": ["reports", "certificates", "council", "bulletin"], "skip_existing": True,
        }, format="json")
        self.assertEqual(again.data["created_count"], 0, again.data)
        self.assertGreaterEqual(again.data["skipped_count"], 5)

        report_doc = CustomDocument.objects.filter(source_type="term-pack", source_id=self.ali.id).first()
        exported = self.client.get(f"/api/exports/custom/{report_doc.id}/")
        self.assertEqual(exported.status_code, 200)
        self.assertTrue(exported.content.startswith(b"%PDF-"))


class PortfolioTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        profile = TeacherProfile.objects.get_or_create(user=self.user)[0]
        profile.full_name = "الأستاذ سمير حداد"; profile.current_school = "ثانوية العقيد لطفي — وهران"
        profile.specialty = "الإعلام الآلي"; profile.diploma = "ماستر إعلام آلي"
        profile.inspection_district = "مقاطعة وهران غرب"; profile.echelon = "صنف 13"
        profile.save()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج ملف التفتيش", level="أولى ثانوي")
        self.student = Student.objects.create(school_class=self.cls, full_name="Ali")
        Mark.objects.create(student=self.student, term=1, continuous=15, supervised=16, exam=17)
        self.course = Course.objects.create(owner=self.user, title="نظام التشغيل", order=1)
        self.plan = LessonPlan.objects.create(owner=self.user, title="خطة نظام التشغيل", course=self.course)
        Session.objects.create(owner=self.user, school_class=self.cls, course=self.course, lesson_plan=self.plan,
                               date="2026-11-10", status="done", board_summary="ملخص السبورة", homework="تمرين 1")
        Seminar.objects.create(owner=self.user, title="ندوة مقاطعة", date="2026-10-27", kind="ندوة", place="ثانوية العقيد لطفي")
        Institution.objects.create(owner=self.user, name="ثانوية العقيد لطفي — وهران")
        Journal.objects.create(owner=self.user, title="الدفتر اليومي")

    def test_portfolio_readiness(self):
        response = self.client.get("/api/portfolio/?term=1")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data
        self.assertEqual(data["totals"]["classes"], 1)
        self.assertEqual(data["totals"]["sessions_done"], 1)
        keys = {row["key"] for row in data["readiness"]["checks"]}
        self.assertTrue({"profile", "lesson_plans", "gradebook", "training"} <= keys)
        plans_check = next(row for row in data["readiness"]["checks"] if row["key"] == "lesson_plans")
        self.assertEqual(plans_check["status"], "ok")
        self.assertGreater(data["readiness"]["score"], 40)

    def test_generate_portfolio_document(self):
        response = self.client.post("/api/portfolio/generate/", {"term": 1}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        self.assertEqual(doc.source_type, "inspection-portfolio")
        exported = self.client.get(f"/api/exports/custom/{doc.id}/")
        self.assertEqual(exported.status_code, 200)
        self.assertTrue(exported.content.startswith(b"%PDF-"))


class BackupTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج النسخ الاحتياطي", level="أولى ثانوي")
        self.student = Student.objects.create(school_class=self.cls, full_name="Ali")
        Mark.objects.create(student=self.student, term=1, continuous=12, supervised=13, exam=14)

    def test_backup_info_and_export(self):
        info = self.client.get("/api/backup/info/")
        self.assertEqual(info.status_code, 200, info.content)
        self.assertEqual(info.data["counts"]["SchoolClass"], 1)
        self.assertTrue(any(row["id"] == self.cls.id for row in info.data["classes"]))
        exported = self.client.get("/api/backup/export/")
        self.assertEqual(exported.status_code, 200)
        self.assertIn("attachment", exported["Content-Disposition"])
        payload = json.loads(exported.content)
        self.assertEqual(payload["format"], "teacherhub-backup")
        models = {row["model"] for row in payload["data"]}
        self.assertIn("hub.schoolclass", models)
        self.assertIn("hub.student", models)

    def test_import_roundtrip_restores_deleted_student(self):
        payload = json.loads(self.client.get("/api/backup/export/").content)
        student_id = self.student.id
        self.student.delete()
        self.assertFalse(Student.objects.filter(pk=student_id).exists())
        response = self.client.post("/api/backup/import/", payload, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(Student.objects.filter(pk=student_id, full_name="Ali").exists())
        bad = self.client.post("/api/backup/import/", {"format": "other", "data": []}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_school_year_rollover_copies_roster(self):
        response = self.client.post("/api/backup/rollover/", {
            "class_ids": [self.cls.id], "year_label": "2026 / 2027",
            "copy_students": True, "copy_slots": False,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["created_count"], 1)
        new_cls = SchoolClass.objects.get(pk=response.data["created"][0]["id"])
        self.assertEqual(new_cls.students.count(), 1)
        self.assertEqual(new_cls.students_count, 1)
        again = self.client.post("/api/backup/rollover/", {"class_ids": [self.cls.id], "year_label": "2026 / 2027"}, format="json")
        self.assertEqual(again.data["created_count"], 0)
        self.assertEqual(again.data["skipped_count"], 1)

    def test_backup_verify_valid_payload(self):
        payload = json.loads(self.client.get("/api/backup/export/").content)
        response = self.client.post("/api/backup/verify/", payload, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["status"], "valid")
        self.assertEqual(response.data["total_records"], payload["records"])
        self.assertIn("SchoolClass", response.data["by_model"])

    def test_backup_verify_invalid_format(self):
        response = self.client.post(
            "/api/backup/verify/", {"format": "other", "data": []}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_backup_verify_empty_data(self):
        response = self.client.post(
            "/api/backup/verify/", {"format": "teacherhub-backup", "data": []}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["total_records"], 0)


class SecurityAuditLogTests(TeacherAPITestCase):
    """Security audit log: creation, filtering, immutability."""

    def setUp(self):
        super().setUp()
        from .models import SecurityAuditLog
        self.audit_log = SecurityAuditLog.objects.create(
            user=self.teacher,
            action="login",
            resource_type="system",
            resource_label="Teacher workspace",
            details={"method": "password", "success": True},
            ip_address="127.0.0.1",
            user_agent="Mozilla/5.0",
        )

    def test_list_audit_logs(self):
        resp = self.client.get("/api/security-audit-logs/")
        self.assertEqual(resp.status_code, 200, resp.content)
        results = resp.data.get("results", resp.data) if isinstance(resp.data, dict) else resp.data
        self.assertGreaterEqual(len(results), 1)

    def test_filter_by_action(self):
        resp = self.client.get("/api/security-audit-logs/?action=login")
        self.assertEqual(resp.status_code, 200, resp.content)
        results = resp.data.get("results", resp.data) if isinstance(resp.data, dict) else resp.data
        self.assertTrue(all(r["action"] == "login" for r in results))

    def test_filter_by_user(self):
        resp = self.client.get(f"/api/security-audit-logs/?user={self.teacher.id}")
        self.assertEqual(resp.status_code, 200, resp.content)
        results = resp.data.get("results", resp.data) if isinstance(resp.data, dict) else resp.data
        self.assertTrue(all(r["user"] == self.teacher.id for r in results))

    def test_audit_log_is_append_only(self):
        from rest_framework.exceptions import ValidationError
        from .serializers import SecurityAuditLogSerializer
        # Cannot update via serializer
        serializer = SecurityAuditLogSerializer(instance=self.audit_log, data={"action": "logout"}, partial=True)
        # Serializer may validate, but save() should raise
        try:
            serializer.is_valid(raise_exception=True)
            with self.assertRaises(ValueError):
                serializer.save()
        except ValidationError:
            pass

    def test_audit_log_cannot_be_deleted(self):
        with self.assertRaises(ValueError):
            self.audit_log.delete()

    def test_audit_log_serializer_fields(self):
        from .serializers import SecurityAuditLogSerializer
        serializer = SecurityAuditLogSerializer(instance=self.audit_log)
        data = serializer.data
        self.assertEqual(data["action"], "login")
        self.assertEqual(data["user_name"], self.teacher.username)
        self.assertEqual(data["ip_address"], "127.0.0.1")
        self.assertIn("created_at", data)


class ParentStudentPortalTests(TeacherAPITestCase):
    """Parent and student portal read-only access."""

    def setUp(self):
        super().setUp()
        from django.contrib.auth import get_user_model
        User = get_user_model()
        from .models import (
            Organization, School, AcademicYear, SchoolClass, Student,
            TeacherProfile, Mark,
        )
        import datetime
        self.organization = Organization.objects.create(
            name="Portal Org", code="portal-org", status="active",
        )
        self.school = School.objects.create(
            organization=self.organization, name="Portal School", code="portal-school", status="active",
        )
        self.academic_year = AcademicYear.objects.create(
            organization=self.organization, school=self.school,
            name="2025-2026",
            start_date=datetime.date(2025, 9, 1),
            end_date=datetime.date(2026, 6, 30),
            status="active",
        )
        self.school_class = SchoolClass.objects.create(
            name="Portal Class", level="5e", academic_year=self.academic_year,
            school=self.school, organization=self.organization, owner=self.teacher,
        )
        self.student = Student.objects.create(
            full_name="Portal Student", school_class=self.school_class,
            organization=self.organization, school=self.school,
        )
        Mark.objects.create(student=self.student, term=1, continuous=12, supervised=13, exam=14)

        # Parent user
        self.parent_user = User.objects.create_user(
            username="parent1", password="parent-pass-123",
            first_name="Parent", last_name="One",
        )
        self.parent_profile = TeacherProfile.objects.create(
            user=self.parent_user, role="parent",
            linked_student=self.student, full_name="Parent One",
        )

        # Student user
        self.student_user = User.objects.create_user(
            username="student1", password="student-pass-123",
            first_name="Portal", last_name="Student",
        )
        self.student_profile = TeacherProfile.objects.create(
            user=self.student_user, role="student",
            linked_student=self.student, full_name="Portal Student",
        )

    def _auth_as(self, user):
        self.client.force_authenticate(user=user)

    def test_parent_portal_summary(self):
        self._auth_as(self.parent_user)
        resp = self.client.get("/api/parent-portal/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["student"]["full_name"], "Portal Student")
        self.assertEqual(resp.data["marks_count"], 1)

    def test_parent_portal_marks(self):
        self._auth_as(self.parent_user)
        resp = self.client.get("/api/parent-portal/marks/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(len(resp.data), 1)

    def test_parent_portal_attendance(self):
        self._auth_as(self.parent_user)
        resp = self.client.get("/api/parent-portal/attendance/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(len(resp.data), 0)

    def test_parent_portal_sessions(self):
        self._auth_as(self.parent_user)
        resp = self.client.get("/api/parent-portal/sessions/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(len(resp.data), 0)

    def test_student_portal_summary(self):
        self._auth_as(self.student_user)
        resp = self.client.get("/api/student-portal/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["student"]["full_name"], "Portal Student")

    def test_student_portal_marks(self):
        self._auth_as(self.student_user)
        resp = self.client.get("/api/student-portal/marks/")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(len(resp.data), 1)

    def test_teacher_cannot_access_parent_portal(self):
        resp = self.client.get("/api/parent-portal/")
        self.assertEqual(resp.status_code, 403)

    def test_parent_cannot_access_student_portal(self):
        self._auth_as(self.parent_user)
        resp = self.client.get("/api/student-portal/")
        self.assertEqual(resp.status_code, 403)


class ProgressionTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج التوزيع السنوي", level="أولى ثانوي")
        # timetable slot: every day of week is unrealistic; use weekday of a known Monday (python Mon=0 -> slot weekday 1)
        TimetableSlot.objects.create(school_class=self.cls, weekday=1, start_time="10:00")
        self.c1 = Course.objects.create(owner=self.user, title="الدرس الأول", order=1)
        self.c2 = Course.objects.create(owner=self.user, title="الدرس الثاني", order=2)
        self.c3 = Course.objects.create(owner=self.user, title="الدرس الثالث", order=3)
        Session.objects.create(owner=self.user, school_class=self.cls, course=self.c1, date="2026-09-07", status="done")
        LessonPlan.objects.create(owner=self.user, title="خطة الدرس الثاني", course=self.c2)
        import datetime as _dt
        today = _dt.date.today()
        Holiday.objects.create(owner=self.user, name="عطلة اختبار", start_date=today, end_date=today + _dt.timedelta(days=30))

    def test_progression_statuses_and_projection(self):
        response = self.client.get(f"/api/classes/{self.cls.id}/progression/")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data
        rows = {row["title"]: row for row in data["courses"]}
        self.assertEqual(rows["الدرس الأول"]["status"], "done")
        self.assertEqual(rows["الدرس الثاني"]["status"], "current")
        self.assertTrue(rows["الدرس الثاني"]["has_lesson_plan"])
        self.assertEqual(data["summary"]["done_courses"], 1)
        # projected dates must skip the 30-day holiday that starts today
        import datetime as _dt
        projected_date = _dt.date.fromisoformat(rows["الدرس الثاني"]["date"])
        self.assertGreater(projected_date, _dt.date.today() + _dt.timedelta(days=29))

    def test_overview_and_generate_document(self):
        overview = self.client.get("/api/progressions/")
        self.assertEqual(overview.status_code, 200)
        self.assertTrue(any(row["class"]["id"] == self.cls.id for row in overview.data["classes"]))
        response = self.client.post(f"/api/classes/{self.cls.id}/progression/generate-document/", {}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        self.assertEqual(doc.source_type, "curriculum-progression")
        exported = self.client.get(f"/api/exports/custom/{doc.id}/")
        self.assertTrue(exported.content.startswith(b"%PDF-"))


class ParentCampaignTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج مراسلات الأولياء", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara")
        Mark.objects.create(student=self.ali, term=1, continuous=17, supervised=18, exam=18)
        Mark.objects.create(student=self.sara, term=1, continuous=7, supervised=8, exam=8)
        for day in ("2026-11-02", "2026-11-03", "2026-11-04"):
            AttendanceRecord.objects.create(student=self.sara, date=day, status="absent")

    def test_audience_preview(self):
        response = self.client.get(f"/api/classes/{self.cls.id}/parent-campaign/?audience=absentees&min_absences=3")
        self.assertEqual(response.status_code, 200, response.content)
        names = [row["student_name"] for row in response.data["students"]]
        self.assertEqual(names, ["Sara"])
        honor = self.client.get(f"/api/classes/{self.cls.id}/parent-campaign/?audience=honor&term=1")
        self.assertEqual([row["student_name"] for row in honor.data["students"]], ["Ali"])
        low = self.client.get(f"/api/classes/{self.cls.id}/parent-campaign/?audience=low_grades&term=1")
        self.assertEqual([row["student_name"] for row in low.data["students"]], ["Sara"])

    def test_generate_letter_pack_and_log(self):
        response = self.client.post(f"/api/classes/{self.cls.id}/parent-campaign/generate/", {
            "audience": "absentees", "min_absences": 3, "log": True,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["recipients"], 1)
        self.assertEqual(response.data["logged"], 1)
        doc = CustomDocument.objects.get(pk=response.data["document"]["id"])
        self.assertEqual(doc.kind, "parent-letter")
        self.assertEqual(doc.source_type, "parent-campaign")
        text_blocks = [block for block in doc.content["blocks"] if block.get("type") == "text"]
        self.assertIn("Sara", text_blocks[0]["text"])
        self.assertIn("3 غيابات", text_blocks[0]["text"])
        comm = ParentCommunication.objects.get(student=self.sara)
        self.assertEqual(comm.channel, "letter")
        exported = self.client.get(f"/api/exports/custom/{doc.id}/")
        self.assertTrue(exported.content.startswith(b"%PDF-"))


class PlannerTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج التخطيط الأسبوعي", level="أولى ثانوي")
        TimetableSlot.objects.create(school_class=self.cls, weekday=1, start_time="10:00", room="مخبر الإعلام الآلي")  # Monday
        self.course = Course.objects.create(owner=self.user, title="تقنية المعلومات", order=1)
        # 2026-11-16 is a Monday; the week (Sun..Sat) containing it starts 2026-11-15
        self.monday = "2026-11-16"

    def test_week_view_suggests_next_course(self):
        response = self.client.get(f"/api/planner/week/?date={self.monday}")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data
        self.assertEqual(data["week_start"], "2026-11-15")
        monday = next(day for day in data["days"] if day["date"] == self.monday)
        self.assertEqual(len(monday["entries"]), 1)
        entry = monday["entries"][0]
        self.assertEqual(entry["next_course"]["title"], "تقنية المعلومات")
        self.assertIsNone(entry["next_plan"])
        self.assertIsNone(entry["session"])

    def test_week_view_includes_latest_plan_for_the_suggested_course(self):
        LessonPlan.objects.create(owner=self.user, course=self.course, title="خطة سابقة")
        latest = LessonPlan.objects.create(owner=self.user, course=self.course, title="الخطة الحالية")
        data = self.client.get(f"/api/planner/week/?date={self.monday}").data
        monday = next(day for day in data["days"] if day["date"] == self.monday)
        entry = monday["entries"][0]
        self.assertEqual(entry["next_plan"], {"id": latest.id, "title": "الخطة الحالية"})

    def test_logging_session_marks_entry_done(self):
        created = self.client.post("/api/sessions/", {
            "school_class": self.cls.id, "course": self.course.id, "date": self.monday, "status": "done",
        }, format="json")
        self.assertIn(created.status_code, (200, 201), created.content)
        data = self.client.get(f"/api/planner/week/?date={self.monday}").data
        monday = next(day for day in data["days"] if day["date"] == self.monday)
        self.assertIsNotNone(monday["entries"][0]["session"])
        self.assertIsNone(monday["entries"][0]["next_plan"])
        self.assertEqual(data["summary"]["logged"], 1)

    def test_generate_weekly_document(self):
        response = self.client.post("/api/planner/week/generate-document/", {"date": self.monday}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        self.assertEqual(doc.source_type, "weekly-planner")
        exported = self.client.get(f"/api/exports/custom/{doc.id}/")
        self.assertTrue(exported.content.startswith(b"%PDF-"))


class GradebookTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج دفتر التنقيط", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara")

    def test_bulk_save_and_stats(self):
        response = self.client.post(f"/api/classes/{self.cls.id}/gradebook/save/", {
            "term": 1, "rows": [
                {"student_id": self.ali.id, "continuous": 15, "supervised": 16, "exam": 17},
                {"student_id": self.sara.id, "continuous": 25, "supervised": "", "exam": 9},
            ]}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["saved"], 2)
        rows = {row["student_name"]: row for row in response.data["rows"]}
        self.assertEqual(rows["Ali"]["average"], 16.25)
        self.assertEqual(rows["Sara"]["continuous"], 20.0)  # clamped to /20
        self.assertIsNone(rows["Sara"]["average"])  # incomplete until all three exist
        self.assertEqual(response.data["stats"]["graded"], 1)

    def test_export_and_import_csv(self):
        Mark.objects.create(student=self.ali, term=1, continuous=10, supervised=11, exam=12)
        exported = self.client.get(f"/api/classes/{self.cls.id}/gradebook/export/?term=1")
        self.assertEqual(exported.status_code, 200)
        csv_text = exported.content.decode("utf-8-sig")
        self.assertIn("Ali", csv_text)
        Mark.objects.all().delete()
        response = self.client.post(f"/api/classes/{self.cls.id}/gradebook/import/", {"term": 1, "csv": csv_text}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["imported"], 1)
        self.assertEqual(Mark.objects.get(student=self.ali, term=1).average, 11.25)
        by_name = self.client.post(f"/api/classes/{self.cls.id}/gradebook/import/", {
            "term": 2, "csv": "student_name,continuous,supervised,exam\nتلميذ غير موجود,1,2,3\nSara,5,6,7",
        }, format="json")
        self.assertEqual(by_name.data["imported"], 1)
        self.assertEqual(by_name.data["unmatched"], ["تلميذ غير موجود"])


class MeetingTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج مجلس القسم", level="أولى ثانوي")
        self.student = Student.objects.create(school_class=self.cls, full_name="Sara")
        Mark.objects.create(student=self.student, term=1, continuous=7, supervised=8, exam=8)
        for day in ("2026-11-02", "2026-11-03", "2026-11-04"):
            AttendanceRecord.objects.create(student=self.student, date=day, status="absent")

    def _create_meeting(self):
        response = self.client.post("/api/meetings/", {
            "school_class": self.cls.id, "date": "2026-12-20", "title": "مجلس قسم الثلاثي الأول",
            "meeting_type": "class_council", "term": 1, "agenda": "عرض النتائج ودراسة الحالات",
            "attendees": ["الأستاذ سمير حداد", "إدارة المؤسسة"],
            "decisions": [
                {"text": "إدراج Sara في خطة دعم فردية", "responsible": "الأستاذ سمير حداد", "due": "2027-01-10", "done": False},
                {"text": "التواصل مع ولي Sara", "responsible": "", "due": "", "done": True},
            ]}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.data

    def test_meeting_crud(self):
        meeting = self._create_meeting()
        self.assertEqual(meeting["decisions_total"], 2)
        self.assertEqual(meeting["decisions_done"], 1)
        listing = self.client.get(f"/api/meetings/?school_class={self.cls.id}")
        self.assertEqual(len(listing.data["results"] if isinstance(listing.data, dict) else listing.data), 1)

    def test_minutes_and_push_decisions_idempotent(self):
        meeting = self._create_meeting()
        minutes = self.client.post(f"/api/meetings/{meeting['id']}/generate-minutes/", {}, format="json")
        self.assertEqual(minutes.status_code, 201, minutes.content)
        doc = CustomDocument.objects.get(pk=minutes.data["document"]["id"])
        self.assertEqual(doc.kind, "meeting-minutes")
        pushed = self.client.post(f"/api/meetings/{meeting['id']}/push-decisions/", {}, format="json")
        self.assertEqual(pushed.data["created_count"], 2)
        self.assertEqual(TeacherTask.objects.filter(source_type="meeting", source_id=meeting["id"]).count(), 2)
        again = self.client.post(f"/api/meetings/{meeting['id']}/push-decisions/", {}, format="json")
        self.assertEqual(again.data["created_count"], 0)

    def test_council_brief(self):
        response = self.client.get(f"/api/meetings/council-brief/{self.cls.id}/?term=1")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.data["suggested_agenda"])
        self.assertTrue(any("Sara" in (row.get("text") or "") for row in response.data["suggested_decisions"]))


class YearReviewTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="فوج الحصيلة السنوية", level="أولى ثانوي")
        self.ali = Student.objects.create(school_class=self.cls, full_name="Ali")
        self.sara = Student.objects.create(school_class=self.cls, full_name="Sara")
        # Ali improves across terms; Sara stays low
        Mark.objects.create(student=self.ali, term=1, continuous=10, supervised=11, exam=12)
        Mark.objects.create(student=self.ali, term=2, continuous=15, supervised=16, exam=17)
        Mark.objects.create(student=self.sara, term=1, continuous=6, supervised=7, exam=7)
        Mark.objects.create(student=self.sara, term=2, continuous=7, supervised=7, exam=8)
        self.course = Course.objects.create(owner=self.user, title="تقنية المعلومات", order=1)
        Session.objects.create(owner=self.user, school_class=self.cls, course=self.course, date="2026-09-07", status="done")

    def test_year_review_aggregation(self):
        response = self.client.get("/api/year-review/")
        self.assertEqual(response.status_code, 200, response.content)
        row = next(item for item in response.data["classes"] if item["class"]["id"] == self.cls.id)
        self.assertEqual(row["terms"]["1"]["average"], 9.0)
        self.assertIsNotNone(row["annual_average"])
        self.assertEqual(row["top_year"][0]["student_name"], "Ali")
        self.assertEqual(row["most_improved"][0]["student_name"], "Ali")
        self.assertTrue(any(item["student_name"] == "Sara" for item in row["summer_support"]))
        self.assertEqual(row["activity"]["sessions_done"], 1)

    def test_generate_year_document(self):
        response = self.client.post("/api/year-review/generate-document/", {"class_id": self.cls.id}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        self.assertEqual(doc.source_type, "year-review")
        exported = self.client.get(f"/api/exports/custom/{doc.id}/")
        self.assertTrue(exported.content.startswith(b"%PDF-"))


class DesignerTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.journal = Journal.objects.create(owner=self.user, title="دفتر المصمم", school_year="2026 / 2027")
        Holiday.objects.create(owner=self.user, name="عطلة المصمم", start_date="2026-12-19", end_date="2026-12-25")
        self.curated = Theme.objects.create(slug="curated-test", name_ar="سمة مصممة للاختبار", source="curated")

    def _pdf_text(self, content):
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        return "".join(page.get_text() for page in doc)

    def test_custom_theme_lifecycle(self):
        created = self.client.post("/api/themes/", {"name_ar": "سمتي الخاصة", "deep": "#123456", "accent": "#FFAA00"}, format="json")
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.data["source"], "custom")
        theme_id = created.data["id"]
        edited = self.client.patch(f"/api/themes/{theme_id}/", {"deep": "#654321"}, format="json")
        self.assertEqual(edited.data["deep"], "#654321")
        forbidden = self.client.patch(f"/api/themes/{self.curated.id}/", {"deep": "#000000"}, format="json")
        self.assertEqual(forbidden.status_code, 403)
        duplicated = self.client.post(f"/api/themes/{self.curated.id}/duplicate/", {}, format="json")
        self.assertEqual(duplicated.status_code, 201)
        self.assertEqual(duplicated.data["source"], "custom")
        removed = self.client.delete(f"/api/themes/{theme_id}/")
        self.assertEqual(removed.status_code, 204)

    def test_journal_page_composer(self):
        default_text = self._pdf_text(self.client.get(f"/api/exports/journal/{self.journal.id}/").content)
        self.assertIn("العطل المدرسية والمناسبات", default_text)
        patched = self.client.patch(f"/api/journals/{self.journal.id}/", {
            "page_config": {"sections": ["cover", "sessions_log", "classes_progress"], "notes_rows": 4},
        }, format="json")
        self.assertEqual(patched.status_code, 200, patched.content)
        custom_text = self._pdf_text(self.client.get(f"/api/exports/journal/{self.journal.id}/").content)
        self.assertIn("سجلّ الحصص", custom_text)
        self.assertIn("تقدّم المقرر", custom_text)
        self.assertNotIn("العطل المدرسية والمناسبات", custom_text)

    def test_inspector_page_composer(self):
        profile = TeacherProfile.objects.get_or_create(user=self.user)[0]
        profile.inspector_page_config = {"sections": ["cover", "visits"], "notes_rows": 3}
        profile.save()
        text = self._pdf_text(self.client.get("/api/exports/inspector/").content)
        self.assertIn("سجلّ الزيارات التفتيشية", text)
        self.assertNotIn("مؤسسات مقاطعة التفتيش", text)


class ExamSeasonTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        import datetime as _dt
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="2ع1 امتحانات", level="ثانية ثانوي")
        self.course_a = Course.objects.create(owner=self.user, title="مكونات الحاسوب", order=1)
        self.course_b = Course.objects.create(owner=self.user, title="نظام التشغيل", order=2)
        for course in (self.course_a, self.course_b):
            Session.objects.create(owner=self.user, school_class=self.cls, course=course,
                                   date=_dt.date(2026, 10, 6), status="done")
        self.low = Student.objects.create(school_class=self.cls, full_name="تلميذ متعثر")
        self.good = Student.objects.create(school_class=self.cls, full_name="تلميذ متفوق")
        self.partial = Student.objects.create(school_class=self.cls, full_name="تلميذ ناقص النقاط")
        Mark.objects.create(student=self.low, term=1, continuous=5, supervised=6, exam=4)
        Mark.objects.create(student=self.good, term=1, continuous=15, supervised=16, exam=17)
        Mark.objects.create(student=self.partial, term=1, continuous=12)
        for day in (7, 8, 9):
            AttendanceRecord.objects.create(student=self.low, date=_dt.date(2026, 10, day), status="absent")
        QuestionBankItem.objects.create(owner=self.user, course=self.course_a, prompt="ما وظيفة المعالج؟", points=2)
        QuestionBankItem.objects.create(owner=self.user, course=self.course_a, prompt="عرّف الذاكرة الحية.", points=3, difficulty="سهل")

    def test_exam_season_detail(self):
        overview = self.client.get("/api/exam-season/?term=1")
        self.assertEqual(overview.status_code, 200)
        self.assertTrue(any(row["class"]["id"] == self.cls.id for row in overview.data["classes"]))
        detail = self.client.get(f"/api/exam-season/class/{self.cls.id}/?term=1")
        self.assertEqual(detail.status_code, 200, detail.content)
        data = detail.data
        self.assertEqual(data["stats"]["lessons_taught"], 2)
        self.assertEqual(data["stats"]["graded_complete"], 2)
        self.assertEqual(data["stats"]["average"], 10.5)
        self.assertEqual(data["stats"]["success_rate"], 50.0)
        lesson_b = next(row for row in data["lessons"] if row["title"] == "نظام التشغيل")
        lesson_a = next(row for row in data["lessons"] if row["title"] == "مكونات الحاسوب")
        self.assertEqual(lesson_b["questions_count"], 0)
        self.assertGreater(lesson_b["priority_score"], lesson_a["priority_score"])
        risk_ids = [row["student_id"] for row in data["at_risk"]]
        self.assertIn(self.low.id, risk_ids)
        self.assertIn(self.partial.id, risk_ids)
        self.assertNotIn(self.good.id, risk_ids)
        self.assertTrue(0 <= data["readiness"]["score"] <= 100)

    def test_generate_pack_and_mock_exam(self):
        pack = self.client.post("/api/exam-season/generate-pack/", {"class_id": self.cls.id, "term": 1}, format="json")
        self.assertEqual(pack.status_code, 201, pack.content)
        self.assertEqual(pack.data["kind"], "revision-pack")
        self.assertIn("نظام التشغيل", str(pack.data["content"]))
        exam = self.client.post("/api/exam-season/generate-mock-exam/", {"class_id": self.cls.id, "term": 1, "count": 10}, format="json")
        self.assertEqual(exam.status_code, 201, exam.content)
        self.assertEqual(exam.data["kind"], "exam")
        self.assertEqual(exam.data["questions_used"], 2)
        self.assertEqual(exam.data["total_points"], 5)
        questions_block = next(b for b in exam.data["content"]["blocks"] if b["type"] == "questions")
        self.assertEqual(len(questions_block["questions"]), 2)

    def test_mock_exam_empty_bank(self):
        import datetime as _dt
        other = SchoolClass.objects.create(owner=self.user, name="فوج بلا بنك", level="أولى ثانوي")
        course_c = Course.objects.create(owner=self.user, title="الشبكات", order=3)
        Session.objects.create(owner=self.user, school_class=other, course=course_c,
                               date=_dt.date(2026, 10, 6), status="done")
        res = self.client.post("/api/exam-season/generate-mock-exam/", {"class_id": other.id, "term": 1}, format="json")
        self.assertEqual(res.status_code, 400)


class CeremonyTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        import datetime as _dt
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="2ع1 تكريم", level="ثانية ثانوي")
        def student(name, term1, term2=None):
            row = Student.objects.create(school_class=self.cls, full_name=name)
            Mark.objects.create(student=row, term=1, continuous=term1[0], supervised=term1[1], exam=term1[2])
            if term2: Mark.objects.create(student=row, term=2, continuous=term2[0], supervised=term2[1], exam=term2[2])
            return row
        self.excellent = student("تلميذ ممتاز", (18, 17, 18), (17, 17, 17))
        self.felicite = student("تلميذ مهنّأ", (15, 15, 15), (16, 15, 15))
        self.encourage = student("تلميذ مشجّع", (13, 12, 12))
        self.honour = student("تلميذ لوحة", (11, 10, 10))
        self.weak = student("تلميذ صاعد", (8, 8, 8), (12, 12, 12))
        for day in range(5, 11):
            AttendanceRecord.objects.create(student=self.excellent, date=_dt.date(2026, 10, day), status="present")

    def test_ceremony_detail_tiers(self):
        detail = self.client.get(f"/api/ceremony/class/{self.cls.id}/?term=1")
        self.assertEqual(detail.status_code, 200, detail.content)
        data = detail.data
        self.assertEqual(data["tier_counts"], {"امتياز": 1, "تهنئة": 1, "تشجيع": 1, "لوحة الشرف": 1})
        self.assertEqual(data["eligible"], 4)
        self.assertEqual(data["podium"][0]["student_name"], "تلميذ ممتاز")
        self.assertEqual(data["podium"][0]["tier"], "امتياز")
        self.assertEqual([row["student_name"] for row in data["attendance_awards"]], ["تلميذ ممتاز"])

    def test_ceremony_improvement_term2(self):
        detail = self.client.get(f"/api/ceremony/class/{self.cls.id}/?term=2")
        self.assertEqual(detail.data["improved"][0]["student_name"], "تلميذ صاعد")
        self.assertEqual(detail.data["improved"][0]["improvement"], 4.0)

    def test_generate_certificates_and_board(self):
        certs = self.client.post("/api/ceremony/generate-certificates/", {"class_id": self.cls.id, "term": 1}, format="json")
        self.assertEqual(certs.status_code, 201, certs.content)
        self.assertEqual(certs.data["kind"], "certificate")
        self.assertEqual(certs.data["certificates_count"], 4)
        names = [name for block in certs.data["content"]["blocks"] for name in block.get("names", [])]
        self.assertEqual(len(names), 4)
        self.assertNotIn("تلميذ صاعد", names)
        board = self.client.post("/api/ceremony/generate-honour-board/", {"class_id": self.cls.id, "term": 1}, format="json")
        self.assertEqual(board.status_code, 201, board.content)
        self.assertEqual(board.data["kind"], "poster")
        self.assertIn("تلميذ ممتاز", str(board.data["content"]))


class ParentMeetingTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1ع1 لقاءات", level="أولى ثانوي")
        def student(name, marks):
            row = Student.objects.create(school_class=self.cls, full_name=name)
            Mark.objects.create(student=row, term=1, continuous=marks[0], supervised=marks[1], exam=marks[2])
            return row
        self.low = student("تلميذ متعثر للقاء", (8, 8, 8))
        self.mid = student("تلميذ متوسط للقاء", (11, 11, 11))
        self.top = student("تلميذ متفوق للقاء", (16, 16, 16))
        created = self.client.post("/api/parent-meeting-days/", {
            "school_class": self.cls.id, "date": "2026-12-03", "start_time": "13:00", "slot_minutes": 10,
            "location": "قاعة الأساتذة"}, format="json")
        self.assertEqual(created.status_code, 201, created.content)
        self.day_id = created.data["id"]

    def test_build_schedule_audiences_and_slots(self):
        built = self.client.post(f"/api/parent-meeting-days/{self.day_id}/build-schedule/", {"audience": "at_risk", "term": 1}, format="json")
        self.assertEqual(built.status_code, 200, built.content)
        self.assertEqual(built.data["created"], 1)
        self.assertEqual(built.data["appointments"][0]["student"], self.low.id)
        self.assertTrue(str(built.data["appointments"][0]["start_time"]).startswith("13:00"))
        rebuilt = self.client.post(f"/api/parent-meeting-days/{self.day_id}/build-schedule/", {"audience": "all", "term": 1}, format="json")
        self.assertEqual(rebuilt.data["created"], 3)
        starts = [str(row["start_time"])[:5] for row in rebuilt.data["appointments"]]
        self.assertEqual(starts, ["13:00", "13:10", "13:20"])

    def test_status_outcome_logs_communication(self):
        built = self.client.post(f"/api/parent-meeting-days/{self.day_id}/build-schedule/", {"audience": "all", "term": 1}, format="json")
        appt_id = built.data["appointments"][0]["id"]
        done = self.client.post(f"/api/parent-meeting-days/{self.day_id}/appointments/{appt_id}/status/",
                                {"status": "attended", "outcome": "اتفقنا على خطة مراجعة أسبوعية"}, format="json")
        self.assertEqual(done.status_code, 200, done.content)
        self.assertIsNotNone(done.data["communication"])
        comm_id = done.data["communication"]
        again = self.client.post(f"/api/parent-meeting-days/{self.day_id}/appointments/{appt_id}/status/",
                                 {"status": "attended", "outcome": "اتفقنا على خطة مراجعة أسبوعية"}, format="json")
        self.assertEqual(again.data["communication"], comm_id)
        self.assertEqual(ParentCommunication.objects.filter(student_id=done.data["student"]).count(), 1)
        blocked = self.client.post(f"/api/parent-meeting-days/{self.day_id}/build-schedule/", {"audience": "all"}, format="json")
        self.assertEqual(blocked.status_code, 400)

    def test_generate_documents(self):
        self.client.post(f"/api/parent-meeting-days/{self.day_id}/build-schedule/", {"audience": "all", "term": 1}, format="json")
        invites = self.client.post(f"/api/parent-meeting-days/{self.day_id}/generate-invitations/", {}, format="json")
        self.assertEqual(invites.status_code, 201, invites.content)
        self.assertEqual(invites.data["kind"], "parent-letter")
        self.assertEqual(invites.data["invitations_count"], 3)
        self.assertIn("تلميذ متفوق للقاء", str(invites.data["content"]))
        agenda = self.client.post(f"/api/parent-meeting-days/{self.day_id}/generate-agenda/", {}, format="json")
        self.assertEqual(agenda.status_code, 201)
        self.assertIn("13:00", str(agenda.data["content"]))


class AssistantDigestTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        import datetime as _dt
        self.user = local_user()
        self.today = _dt.date.today()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1ع1 مساعد", level="أولى ثانوي")
        self.course = Course.objects.create(owner=self.user, title="درس المساعد", order=1)
        Session.objects.create(owner=self.user, school_class=self.cls, course=self.course,
                               date=self.today - _dt.timedelta(days=20), status="done")
        self.student = Student.objects.create(school_class=self.cls, full_name="تلميذ المساعد")
        self.meeting = Meeting.objects.create(
            owner=self.user, school_class=self.cls, date=self.today, title="مجلس قسم تجريبي",
            decisions=[{"text": "مراجعة دعم التلاميذ المتعثرين", "responsible": "الأستاذ",
                        "due": str(self.today + _dt.timedelta(days=2)), "done": False, "task_id": None}])
        self.overdue = TeacherTask.objects.create(
            owner=self.user, title="مهمة متأخرة للمساعد", status="pending",
            due_date=self.today - _dt.timedelta(days=1))

    def test_digest_collects_cross_centre_signals(self):
        res = self.client.get("/api/assistant/digest/")
        self.assertEqual(res.status_code, 200, res.content)
        keys = [item["key"] for item in res.data["items"]]
        self.assertTrue(any(key.startswith("bank-gap:") for key in keys), keys)
        self.assertTrue(any(key.startswith("marks-gap:") for key in keys), keys)
        self.assertTrue(any(key.startswith("meeting-decision:") for key in keys), keys)
        self.assertTrue(any(key.startswith("task-overdue:") for key in keys), keys)
        self.assertGreaterEqual(res.data["counts"]["high"], 1)
        self.assertTrue(res.data["focus"])

    def test_create_tasks_idempotent(self):
        digest = self.client.get("/api/assistant/digest/").data
        key = next(item["key"] for item in digest["items"] if item["key"].startswith("bank-gap:"))
        first = self.client.post("/api/assistant/digest/create-tasks/", {"keys": [key]}, format="json")
        self.assertEqual(first.data["created"], 1)
        second = self.client.post("/api/assistant/digest/create-tasks/", {"keys": [key]}, format="json")
        self.assertEqual(second.data["created"], 0)
        self.assertEqual(second.data["skipped"], 1)
        task = TeacherTask.objects.filter(owner=self.user, source_type="question-bank").first()
        self.assertIsNotNone(task)
        self.assertEqual(task.origin, "auto")


class OpeningWizardTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()

    def test_opening_flow(self):
        before = self.client.get("/api/opening/status/")
        self.assertEqual(before.status_code, 200)
        year_label = before.data["school_year"]
        created = self.client.post("/api/opening/quick-class/", {"name": "1ع1 افتتاح", "level": "أولى ثانوي"}, format="json")
        self.assertEqual(created.status_code, 201, created.content)
        class_id = created.data["id"]
        imported = self.client.post("/api/opening/import-students/", {
            "class_id": class_id, "names": "أحمد بن يوسف\nسارة العلوي\nأحمد بن يوسف\nمحمد الأمين"}, format="json")
        self.assertEqual(imported.data, {"created": 3, "skipped": 0, "total_students": 3})
        again = self.client.post("/api/opening/import-students/", {
            "class_id": class_id, "names": "أحمد بن يوسف\nتلميذ جديد"}, format="json")
        self.assertEqual(again.data["created"], 1)
        self.assertEqual(again.data["skipped"], 1)
        slot = self.client.post("/api/opening/quick-slot/", {
            "class_id": class_id, "weekday": 0, "start_time": "08:00", "end_time": "09:00"}, format="json")
        self.assertEqual(slot.status_code, 201, slot.content)
        journal = self.client.post("/api/opening/quick-journal/", {"title": f"دفتر الافتتاح {year_label}"}, format="json")
        self.assertEqual(journal.status_code, 201)
        self.assertEqual(journal.data["school_year"], year_label)
        after = self.client.get("/api/opening/status/")
        done_keys = {step["key"] for step in after.data["steps"] if step["done"]}
        self.assertTrue({"classes", "students", "timetable", "journal"} <= done_keys)
        doc = self.client.post("/api/opening/generate-checklist/", {}, format="json")
        self.assertEqual(doc.status_code, 201, doc.content)
        self.assertIn("1ع1 افتتاح", str(doc.data["content"]))


class InspectionSimulationTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        import datetime as _dt
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1ع1 تفتيش", level="أولى ثانوي")
        self.course = Course.objects.create(owner=self.user, title="درس التفتيش", order=1)
        self.plan = LessonPlan.objects.create(owner=self.user, course=self.course, title="خطة درس التفتيش")
        self.student = Student.objects.create(school_class=self.cls, full_name="تلميذ التفتيش")
        Mark.objects.create(student=self.student, term=1, continuous=14, supervised=13, exam=15)
        Session.objects.create(owner=self.user, school_class=self.cls, course=self.course, lesson_plan=self.plan,
                               date=_dt.date.today(), status="done", points_written=["نقطة أ"], homework="واجب")

    def test_simulation_scores(self):
        res = self.client.get("/api/inspection-simulation/")
        self.assertEqual(res.status_code, 200, res.content)
        data = res.data
        self.assertEqual(len(data["domains"]), 6)
        self.assertEqual(len(data["grid"]), 10)
        self.assertTrue(0 <= data["overall"] <= 20)
        planning = next(d for d in data["domains"] if d["key"] == "planning")
        self.assertEqual(planning["indicators"][0]["value"], 100.0)
        self.assertTrue(data["appreciation"])
        self.assertTrue(any(row["item"].__contains__("الدفتر اليومي") for row in data["evidence"]))

    def test_generate_report(self):
        res = self.client.post("/api/inspection-simulation/generate-report/", {}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.data["kind"], "report-card")
        self.assertIn("محاور التفتيش الستة", str(res.data["content"]))


class LessonLinkingTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.course = Course.objects.create(owner=self.user, title="درس الربط التجريبي", order=50)
        self.plan = LessonPlan.objects.create(owner=self.user, course=self.course, title="خطة درس الربط التجريبي")

    def test_course_serializer_exposes_plan(self):
        res = self.client.get("/api/courses/")
        row = next(item for item in res.data["results"] if item["id"] == self.course.id)
        self.assertEqual(row["plan"]["id"], self.plan.id)
        self.assertEqual(row["plans_count"], 1)

    def test_plan_serializer_exposes_course(self):
        res = self.client.get("/api/lesson-plans/")
        row = next(item for item in res.data["results"] if item["id"] == self.plan.id)
        self.assertEqual(row["course"], self.course.id)
        self.assertEqual(row["course_title"], "درس الربط التجريبي")

    def test_search_deep_links(self):
        res = self.client.get("/api/search/?q=الربط التجريبي")
        self.assertEqual(res.status_code, 200, res.content)
        groups = {group["key"]: group for group in res.data["groups"]}
        self.assertIn(f"/courses?lesson={self.course.id}", [row["route"] for row in groups["courses"]["results"]])
        self.assertIn(f"/lesson-plans?plan={self.plan.id}", [row["route"] for row in groups["plans"]["results"]])

    def test_taught_session_auto_links_its_course_plan(self):
        school_class = SchoolClass.objects.create(owner=self.user, name="فوج ربط الخطة", level="أولى ثانوي")
        response = self.client.post("/api/sessions/", {
            "school_class": school_class.id,
            "course": self.course.id,
            "date": "2026-11-16",
            "status": "done",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["lesson_plan"], self.plan.id)
        self.assertEqual(Session.objects.get(pk=response.data["id"]).lesson_plan_id, self.plan.id)


class CoverDesignerTests(TeacherAPITestCase):
    TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="

    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.journal = Journal.objects.create(owner=self.user, title="دفتر الغلاف", school_year="2026 / 2027",
                                              institution="ثانوية تجريبية")

    def _page1(self, content):
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        return doc, doc[0].get_text(), doc[0].get_images()

    def test_journal_cover_design(self):
        patched = self.client.patch(f"/api/journals/{self.journal.id}/", {
            "cover_config": {"image": self.TINY_PNG, "layout": "top", "motto": "العلم نور والجهل ظلام",
                             "show_year": False}}, format="json")
        self.assertEqual(patched.status_code, 200, patched.content)
        doc, text, images = self._page1(self.client.get(f"/api/exports/journal/{self.journal.id}/").content)
        self.assertIn("العلم نور", text)
        self.assertNotIn("السنة الدراسية", text)
        self.assertGreaterEqual(len(images), 1)

    def test_inspector_cover_design(self):
        profile = TeacherProfile.objects.get_or_create(user=self.user)[0]
        profile.cover_config = {"image": self.TINY_PNG, "layout": "side", "motto": "شعار المفتش التجريبي"}
        profile.save()
        doc, text, images = self._page1(self.client.get("/api/exports/inspector/").content)
        self.assertIn("شعار المفتش", text)
        self.assertGreaterEqual(len(images), 1)


class RemedialTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        import datetime as _dt
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1ع1 استدراك", level="أولى ثانوي")
        def student(name, marks=None, absences=0):
            row = Student.objects.create(school_class=self.cls, full_name=name)
            if marks: Mark.objects.create(student=row, term=1, continuous=marks[0], supervised=marks[1], exam=marks[2])
            for day in range(5, 5 + absences):
                AttendanceRecord.objects.create(student=row, date=_dt.date(2026, 10, day), status="absent")
            return row
        self.weak = student("تلميذ ضعيف", (6, 9, 5))
        self.mid = student("تلميذ دعم", (9, 9, 9))
        self.boost = student("تلميذ تعزيز", (11, 11, 11))
        self.top = student("تلميذ متفوق", (16, 16, 16), absences=3)
        self.incomplete = student("تلميذ بلا نقاط")
        self.course = Course.objects.create(owner=self.user, title="درس الاستدراك", order=1)
        Session.objects.create(owner=self.user, school_class=self.cls, course=self.course,
                               date=_dt.date(2026, 10, 6), status="done")
        QuestionBankItem.objects.create(owner=self.user, course=self.course, prompt="سؤال استدراك؟", points=2)

    def test_band_suggestions(self):
        res = self.client.get(f"/api/remedial/?class={self.cls.id}&term=1")
        self.assertEqual(res.status_code, 200, res.content)
        bands = {band["band"]: band for band in res.data["bands"]}
        self.assertEqual(bands["intensive"]["count"], 2)
        self.assertEqual(bands["support"]["count"], 1)
        self.assertEqual(bands["boost"]["count"], 1)
        self.assertEqual(bands["attendance"]["count"], 1)
        weak_row = next(r for r in bands["intensive"]["students"] if r["student_name"] == "تلميذ ضعيف")
        self.assertEqual(weak_row["weak_component"], "الاختبار")

    def test_group_worksheet_and_plans(self):
        created = self.client.post("/api/support-groups/", {
            "school_class": self.cls.id, "term": 1, "band": "intensive", "title": "مجموعة الدعم المكثف أ",
            "member_ids": [self.weak.id, self.incomplete.id]}, format="json")
        self.assertEqual(created.status_code, 201, created.content)
        group_id = created.data["id"]
        scheduled = self.client.post(f"/api/support-groups/{group_id}/schedule/", {"date": "2026-12-10", "time": "13:00"}, format="json")
        self.assertEqual(str(scheduled.data["planned_date"]), "2026-12-10")
        sheet = self.client.post(f"/api/support-groups/{group_id}/generate-worksheet/", {}, format="json")
        self.assertEqual(sheet.status_code, 201, sheet.content)
        self.assertEqual(sheet.data["kind"], "worksheet")
        plans = self.client.post(f"/api/support-groups/{group_id}/create-plans/", {}, format="json")
        self.assertEqual(plans.data, {"created": 2, "skipped": 0})
        again = self.client.post(f"/api/support-groups/{group_id}/create-plans/", {}, format="json")
        self.assertEqual(again.data, {"created": 0, "skipped": 2})


class CourseParityTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.course = Course.objects.create(owner=self.user, title="درس التكافؤ", order=60,
                                            key_points=["نقطة أولى", "نقطة ثانية"], summary="ملخص الدرس")
        self.theme = Theme.objects.create(slug="parity-theme", name_ar="سمة التكافؤ", source="curated")

    def test_theme_apply_to_course(self):
        res = self.client.post(f"/api/themes/{self.theme.id}/apply/", {"resource_type": "course", "resource_id": self.course.id}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.course.refresh_from_db()
        self.assertEqual(self.course.theme_id, self.theme.id)

    def test_course_handout_pdf(self):
        res = self.client.get(f"/api/exports/course/{self.course.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.content.startswith(b"%PDF"))
        import fitz
        text = "".join(page.get_text() for page in fitz.open(stream=res.content, filetype="pdf"))
        self.assertIn("درس التكافؤ", text)

    def test_course_editable_snapshot(self):
        res = self.client.post("/api/documents/from-existing/", {"source_type": "course", "source_id": self.course.id}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIn("نقطة أولى", str(res.data["content"]))


class AssessmentCentreTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1 ج م ع 1", level="أولى ثانوي")
        self.other_cls = SchoolClass.objects.create(owner=self.user, name="1 ج م ع 2", level="أولى ثانوي")
        students = [Student.objects.create(school_class=self.cls, full_name=name)
                    for name in ("أمين بن عمر", "خديجة مرابط", "يوسف حمداني")]
        self.students = students
        self.outsider = Student.objects.create(school_class=self.other_cls, full_name="تلميذ خارجي")
        self.course = Course.objects.create(owner=self.user, order=1, title="مدخل إلى الإعلام الآلي",
                                            key_points=["مكونات الحاسوب"])
        for i in range(4):
            QuestionBankItem.objects.create(
                owner=self.user, course=self.course, prompt=f"سؤال تجريبي {i + 1}",
                qtype="سؤال قصير", difficulty=["سهل", "متوسط", "صعب", "متوسط"][i],
                points=5, answer=f"إجابة {i + 1}", lines=3)

    def create_assessment(self):
        response = self.client.post("/api/assessments/", {
            "school_class": self.cls.id, "course": self.course.id, "term": 1,
            "assessment_kind": "exam", "title": "اختبار الثلاثي الأول",
            "date": "2026-11-20", "duration_minutes": 60, "max_score": 20,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.data

    def test_create_results_and_stats(self):
        assessment = self.create_assessment()
        self.assertEqual(assessment["grade_component"], "exam")
        self.assertEqual(assessment["stats"]["expected"], 3)
        rows = [
            {"student": self.students[0].id, "status": "present", "score": 18, "comment": "ممتاز"},
            {"student": self.students[1].id, "status": "present", "score": 8, "comment": ""},
            {"student": self.students[2].id, "status": "absent", "score": 19, "comment": ""},
        ]
        response = self.client.post(f"/api/assessments/{assessment['id']}/results/", {"rows": rows}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        stats = response.data["stats"]
        self.assertEqual(stats["scored"], 2)
        self.assertEqual(stats["absent"], 1)
        self.assertEqual(stats["average_percent"], 65.0)
        self.assertEqual(stats["success_rate"], 50.0)
        absent_row = next(r for r in response.data["students"] if r["status"] == "absent")
        self.assertIsNone(absent_row["score"])

    def test_results_reject_student_from_another_class(self):
        assessment = self.create_assessment()
        response = self.client.post(f"/api/assessments/{assessment['id']}/results/", {
            "rows": [{"student": self.outsider.id, "status": "present", "score": 10, "comment": ""}],
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(AssessmentResult.objects.count(), 0)

    def test_generate_paper_and_analysis_documents(self):
        assessment = self.create_assessment()
        response = self.client.post(f"/api/assessments/{assessment['id']}/generate-paper/",
                                    {"count": 3, "include_answer_key": True}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["questions_used"], 3)
        paper = CustomDocument.objects.get(pk=response.data["document"]["id"])
        self.assertEqual(paper.kind, "exam")
        self.assertEqual(paper.source_type, "assessment")
        refreshed = Assessment.objects.get(pk=assessment["id"])
        self.assertEqual(refreshed.paper_document_id, paper.id)
        self.assertEqual(refreshed.status, "prepared")

        self.client.post(f"/api/assessments/{assessment['id']}/results/", {"rows": [
            {"student": self.students[0].id, "status": "present", "score": 16, "comment": ""},
            {"student": self.students[1].id, "status": "present", "score": 6, "comment": ""},
        ]}, format="json")
        response = self.client.post(f"/api/assessments/{assessment['id']}/generate-analysis/", {}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["document"]["id"])
        content = json.dumps(doc.content, ensure_ascii=False)
        self.assertIn("أمين بن عمر", content)
        self.assertIn("تحليل نتائج", doc.title)


class QuestionGenerationQuotaTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.course_a = Course.objects.create(owner=self.user, order=1, title="درس أ", key_points=["نقطة أ"])
        self.course_b = Course.objects.create(owner=self.user, order=2, title="درس ب", key_points=["نقطة ب"])
        for i in range(6):
            QuestionBankItem.objects.create(owner=self.user, course=self.course_a, prompt=f"سؤال أ {i}",
                                            qtype="سؤال قصير", difficulty="متوسط", points=2, answer="أ", lines=2)
        for i in range(3):
            QuestionBankItem.objects.create(owner=self.user, course=self.course_b, prompt=f"سؤال ب {i}",
                                            qtype="سؤال قصير", difficulty="سهل", points=2, answer="ب", lines=2)

    def test_generate_document_with_per_lesson_quotas(self):
        response = self.client.post("/api/question-bank/generate-document/", {
            "kind": "exam",
            "lesson_counts": [{"course_id": self.course_a.id, "count": 4},
                              {"course_id": self.course_b.id, "count": 10}],
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["questions_used"], 7)
        breakdown = {row["course_id"]: row for row in response.data["breakdown"]}
        self.assertEqual(breakdown[self.course_a.id]["delivered"], 4)
        self.assertEqual(breakdown[self.course_b.id]["delivered"], 3)
        self.assertEqual(breakdown[self.course_b.id]["requested"], 10)
        doc = CustomDocument.objects.get(pk=response.data["id"])
        questions = [b for b in doc.content["blocks"] if b["type"] == "questions"][0]["questions"]
        self.assertEqual(len(questions), 7)

    def test_seed_variants_create_multiple_questions_per_point(self):
        response = self.client.post("/api/question-bank/seed-from-courses/", {"variants": 3}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        # 2 courses already have bank questions, but seed prompts are new: 2 points x 3 variants
        self.assertEqual(response.data["created"], 6)
        again = self.client.post("/api/question-bank/seed-from-courses/", {"variants": 3}, format="json")
        self.assertEqual(again.data["created"], 0)


class GradebookSyncTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1 ج م ع 9", level="أولى ثانوي")
        self.s1 = Student.objects.create(school_class=self.cls, full_name="تلميذ أ")
        self.s2 = Student.objects.create(school_class=self.cls, full_name="تلميذ ب")
        self.s3 = Student.objects.create(school_class=self.cls, full_name="تلميذ ج")

    def _assessment(self, title, scores):
        assessment = Assessment.objects.create(
            owner=self.user, school_class=self.cls, term=1, assessment_kind="supervised",
            title=title, max_score=20, status="corrected")
        for student, score in scores.items():
            AssessmentResult.objects.create(
                assessment=assessment, student=student,
                status="present" if score is not None else "absent", score=score)
        return assessment

    def test_preview_averages_across_assessments_and_apply_fill_only(self):
        self._assessment("فرض 1", {self.s1: 10, self.s2: 16, self.s3: None})
        self._assessment("فرض 2", {self.s1: 14, self.s2: 8})
        Mark.objects.create(student=self.s2, term=1, continuous=11, supervised=9, exam=12)

        preview = self.client.get(f"/api/assessments/gradebook-sync/preview/?class_id={self.cls.id}&term=1&component=supervised")
        self.assertEqual(preview.status_code, 200, preview.content)
        rows = {row["student_id"]: row for row in preview.data["rows"]}
        self.assertEqual(rows[self.s1.id]["computed"], 12.0)   # mean of 50% and 70% -> 60% -> 12/20
        self.assertEqual(rows[self.s1.id]["action"], "fill")
        self.assertEqual(rows[self.s2.id]["computed"], 12.0)
        self.assertEqual(rows[self.s2.id]["action"], "replace")
        self.assertEqual(rows[self.s3.id]["action"], "no_data")
        self.assertEqual(preview.data["summary"]["eligible_assessments"], 2)

        applied = self.client.post("/api/assessments/gradebook-sync/apply/", {
            "class_id": self.cls.id, "term": 1, "component": "supervised", "mode": "fill",
        }, format="json")
        self.assertEqual(applied.status_code, 200, applied.content)
        self.assertEqual(applied.data["updated"], 1)
        self.assertEqual(applied.data["skipped_existing"], 1)
        self.assertEqual(Mark.objects.get(student=self.s1, term=1).supervised, 12.0)
        self.assertEqual(Mark.objects.get(student=self.s2, term=1).supervised, 9)  # untouched in fill mode
        self.assertTrue(Assessment.objects.filter(gradebook_synced_at__isnull=False).count() == 2)

        overwritten = self.client.post("/api/assessments/gradebook-sync/apply/", {
            "class_id": self.cls.id, "term": 1, "component": "supervised", "mode": "overwrite",
        }, format="json")
        self.assertEqual(overwritten.data["updated"], 1)
        mark = Mark.objects.get(student=self.s2, term=1)
        self.assertEqual(mark.supervised, 12.0)
        self.assertEqual(mark.average, 11.75)  # (11 + 12 + 12*2) / 4

    def test_preview_is_scoped_by_component(self):
        exam = Assessment.objects.create(owner=self.user, school_class=self.cls, term=1,
                                         assessment_kind="exam", title="اختبار", max_score=20, status="corrected")
        AssessmentResult.objects.create(assessment=exam, student=self.s1, status="present", score=15)
        preview = self.client.get(f"/api/assessments/gradebook-sync/preview/?class_id={self.cls.id}&term=1&component=supervised")
        self.assertEqual(preview.data["summary"]["eligible_assessments"], 0)
        preview = self.client.get(f"/api/assessments/gradebook-sync/preview/?class_id={self.cls.id}&term=1&component=exam")
        self.assertEqual(preview.data["summary"]["eligible_assessments"], 1)


class AssessmentHistoryExportTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1 ج م ع 9", level="أولى ثانوي")
        self.s1 = Student.objects.create(school_class=self.cls, full_name="تلميذ أ")
        self.s2 = Student.objects.create(school_class=self.cls, full_name="تلميذ ب")
        self.a1 = Assessment.objects.create(owner=self.user, school_class=self.cls, term=1,
                                            assessment_kind="supervised", title="فرض 1", max_score=20, status="corrected")
        a2 = Assessment.objects.create(owner=self.user, school_class=self.cls, term=1,
                                       assessment_kind="exam", title="اختبار 1", max_score=20, status="corrected")
        AssessmentResult.objects.create(assessment=self.a1, student=self.s1, status="present", score=16)
        AssessmentResult.objects.create(assessment=a2, student=self.s1, status="present", score=10)
        AssessmentResult.objects.create(assessment=self.a1, student=self.s2, status="absent")

    def test_dossier_includes_assessment_history(self):
        data = self.client.get(f"/api/students/{self.s1.id}/dossier/").data
        summary = data["summary"]["assessments"]
        self.assertEqual(summary["recorded"], 2)
        self.assertEqual(summary["average_percent"], 65.0)  # mean of 80% and 50%
        self.assertEqual(summary["average_20"], 13.0)
        self.assertEqual({row["title"] for row in data["assessment_results"]}, {"فرض 1", "اختبار 1"})
        self.assertTrue(any(e["type"] == "assessment" for e in data["timeline"]))
        other = self.client.get(f"/api/students/{self.s2.id}/dossier/").data
        self.assertEqual(other["summary"]["assessments"]["absent"], 1)
        self.assertIsNone(other["summary"]["assessments"]["average_percent"])

    def test_results_csv_export(self):
        response = self.client.get(f"/api/assessments/{self.a1.id}/results/export/")
        self.assertEqual(response.status_code, 200, response.content)
        text = b"".join(response.streaming_content).decode("utf-8-sig") if hasattr(response, "streaming_content") else response.content.decode("utf-8-sig")
        self.assertIn("التلميذ", text)
        self.assertIn("تلميذ أ", text)
        self.assertIn("ممتاز", text)  # 16/20 = 80%

    def test_dossier_document_includes_assessment_table(self):
        response = self.client.post(f"/api/students/{self.s1.id}/generate-document/", {"type": "report"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        doc = CustomDocument.objects.get(pk=response.data["document"]["id"])
        headings = [b.get("title", "") for b in doc.content["blocks"]]
        self.assertIn("نتائج التقويمات والفروض", headings)


class AssessmentSupportGroupTests(TeacherAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = local_user()
        self.cls = SchoolClass.objects.create(owner=self.user, name="1 ج م ع 9", level="أولى ثانوي")
        self.s1 = Student.objects.create(school_class=self.cls, full_name="تلميذ أ")
        self.s2 = Student.objects.create(school_class=self.cls, full_name="تلميذ ب")
        self.s3 = Student.objects.create(school_class=self.cls, full_name="تلميذ ج")
        self.a1 = Assessment.objects.create(owner=self.user, school_class=self.cls, term=1,
                                            assessment_kind="supervised", title="فرض 1", max_score=20, status="corrected")
        AssessmentResult.objects.create(assessment=self.a1, student=self.s1, status="present", score=16)  # 80%
        AssessmentResult.objects.create(assessment=self.a1, student=self.s2, status="present", score=8)   # 40%
        AssessmentResult.objects.create(assessment=self.a1, student=self.s3, status="absent")

    def test_creates_group_from_below_threshold_students(self):
        response = self.client.post(f"/api/assessments/{self.a1.id}/create-support-group/", {"threshold": 50}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.data["created"])
        group = SupportGroup.objects.get(pk=response.data["group"]["id"])
        self.assertEqual([s.id for s in group.members.all()], [self.s2.id])
        self.assertEqual(group.source_assessment_id, self.a1.id)
        self.assertEqual(group.term, 1)

        again = self.client.post(f"/api/assessments/{self.a1.id}/create-support-group/", {"threshold": 50}, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertFalse(again.data["created"])
        self.assertEqual(SupportGroup.objects.count(), 1)

        listed = self.client.get("/api/assessments/").data
        row = next(r for r in listed["results"] if r["id"] == self.a1.id)
        self.assertEqual(row["support_group_id"], group.id)

    def test_include_absent_and_empty_candidates(self):
        response = self.client.post(f"/api/assessments/{self.a1.id}/create-support-group/",
                                    {"threshold": 50, "include_absent": True}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["member_count"], 2)
        SupportGroup.objects.all().delete()
        empty = self.client.post(f"/api/assessments/{self.a1.id}/create-support-group/", {"threshold": 30}, format="json")
        self.assertEqual(empty.status_code, 400)


class SeedIfEmptyTests(TeacherAPITestCase):
    def test_loads_snapshot_once_into_empty_database(self):
        self.assertEqual(Course.objects.count(), 0)
        call_command("seed_if_empty", verbosity=0)
        self.assertEqual(Course.objects.count(), 11)
        self.assertEqual(LessonPlan.objects.count(), 9)
        call_command("seed_if_empty", verbosity=0)
        self.assertEqual(Course.objects.count(), 11)

    def test_preserves_preexisting_themes_and_remaps_fixture_foreign_keys(self):
        # Simulate theme initialization using both an overlapping slug under a
        # different pk and a pk the snapshot wants for a different theme.
        Theme.objects.create(pk=1, slug="reserved-id-one", name_ar="محفوظ ١")
        Theme.objects.create(pk=2, slug="reserved-id-two", name_ar="محفوظ ٢")
        Theme.objects.create(pk=900, slug="gentleman-navy", name_ar="لا تغيّرني")

        call_command("seed_if_empty", verbosity=0)

        self.assertEqual(Course.objects.count(), 11)
        self.assertEqual(LessonPlan.objects.count(), 9)
        self.assertEqual(Theme.objects.get(slug="gentleman-navy").pk, 900)
        self.assertEqual(Theme.objects.get(slug="gentleman-navy").name_ar, "لا تغيّرني")
        self.assertTrue(Journal.objects.filter(theme_id=900).exists())
        remapped = Theme.objects.get(slug="monochrome")
        self.assertGreater(remapped.pk, 900)
        self.assertTrue(Journal.objects.filter(theme=remapped).exists())
        self.assertEqual(Theme.objects.get(pk=1).slug, "reserved-id-one")

    def test_any_existing_non_theme_data_prevents_snapshot_merge(self):
        Course.objects.create(owner=local_user(), title="existing live lesson")
        call_command("seed_if_empty", verbosity=0)
        self.assertEqual(Course.objects.count(), 1)
        self.assertEqual(LessonPlan.objects.count(), 0)


class GradeSubmissionApprovalTests(TeacherAPITestCase):
    """Grade result submission → approve → publish workflow."""

    def setUp(self):
        super().setUp()
        from .models import (
            Organization, School, AcademicYear, SchoolClass, Course,
            Student, GradeRuleSet, CalculatedResult,
        )
        import datetime
        self.organization = Organization.objects.create(
            name="Test Org", code="test-org", status="active",
        )
        self.school = School.objects.create(
            organization=self.organization, name="Test School", code="test-school", status="active",
        )
        self.academic_year = AcademicYear.objects.create(
            organization=self.organization, school=self.school,
            name="2025-2026",
            start_date=datetime.date(2025, 9, 1),
            end_date=datetime.date(2026, 6, 30),
            status="active",
        )
        self.course = Course.objects.create(
            owner=self.teacher, title="Mathematics",
        )
        self.school_class = SchoolClass.objects.create(
            name="Grade 5A", level="5e", academic_year=self.academic_year,
            school=self.school, organization=self.organization, owner=self.teacher,
        )
        self.student = Student.objects.create(
            full_name="Test Student", school_class=self.school_class,
            organization=self.organization, school=self.school,
        )
        self.ruleset = GradeRuleSet.objects.create(
            school=self.school, subject=self.course, academic_year=self.academic_year,
            term=1, name="Test Ruleset v1", version=1, is_active=True, is_approved=True,
            formula_config={"component_weights": {"continuous": 0.3, "supervised": 0.3, "exam": 0.4},
                            "rounding": 2, "pass_threshold": 50},
            component_max={"continuous": 20, "supervised": 20, "exam": 20},
            effective_from="2025-09-01",
            created_by=self.teacher,
        )
        self.result = CalculatedResult.objects.create(
            student=self.student, school_class=self.school_class, subject=self.course,
            academic_year=self.academic_year, term=1, ruleset=self.ruleset,
            ruleset_version=1, input_snapshot={}, calculated_value=15.5,
            calculated_percent=77.5, calculation_breakdown={}, status="calculated",
        )

    def test_submit_transitions_calculated_to_submitted(self):
        url = f"/api/calculated-results/{self.result.id}/submit/"
        resp = self.client.post(url, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.result.refresh_from_db()
        self.assertEqual(self.result.status, "submitted")
        self.assertEqual(self.result.submitted_by, self.teacher)
        self.assertIsNotNone(self.result.submitted_at)

    def test_submit_rejects_already_submitted(self):
        self.result.status = "submitted"
        self.result.submitted_by = self.teacher
        self.result.submitted_at = timezone.now()
        self.result.save()
        url = f"/api/calculated-results/{self.result.id}/submit/"
        resp = self.client.post(url, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_approve_transitions_submitted_to_approved(self):
        self.result.status = "submitted"
        self.result.submitted_by = self.teacher
        self.result.submitted_at = timezone.now()
        self.result.save()
        url = f"/api/calculated-results/{self.result.id}/approve/"
        resp = self.client.post(url, {"comment": "Looks good"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.result.refresh_from_db()
        self.assertEqual(self.result.status, "approved")
        self.assertEqual(self.result.reviewed_by, self.teacher)
        self.assertEqual(self.result.review_comment, "Looks good")
        self.assertIsNotNone(self.result.reviewed_at)

    def test_approve_rejects_not_submitted(self):
        url = f"/api/calculated-results/{self.result.id}/approve/"
        resp = self.client.post(url, {"comment": "x"}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_reject_requires_comment(self):
        self.result.status = "submitted"
        self.result.submitted_by = self.teacher
        self.result.submitted_at = timezone.now()
        self.result.save()
        url = f"/api/calculated-results/{self.result.id}/reject/"
        resp = self.client.post(url, {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_reject_transitions_submitted_to_rejected(self):
        self.result.status = "submitted"
        self.result.submitted_by = self.teacher
        self.result.submitted_at = timezone.now()
        self.result.save()
        url = f"/api/calculated-results/{self.result.id}/reject/"
        resp = self.client.post(url, {"comment": "Needs correction"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.result.refresh_from_db()
        self.assertEqual(self.result.status, "rejected")
        self.assertEqual(self.result.review_comment, "Needs correction")

    def test_publish_transitions_approved_to_published(self):
        self.result.status = "approved"
        self.result.reviewed_by = self.teacher
        self.result.reviewed_at = timezone.now()
        self.result.save()
        url = f"/api/calculated-results/{self.result.id}/publish/"
        resp = self.client.post(url, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.result.refresh_from_db()
        self.assertEqual(self.result.status, "published")

    def test_void_transitions_published_to_voided(self):
        self.result.status = "published"
        self.result.reviewed_by = self.teacher
        self.result.reviewed_at = timezone.now()
        self.result.save()
        url = f"/api/calculated-results/{self.result.id}/void/"
        resp = self.client.post(url, {"comment": "Error in data"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.result.refresh_from_db()
        self.assertEqual(self.result.status, "voided")


class TimetableConflictTests(TeacherAPITestCase):
    """Timetable slot conflict detection: same class / same room overlapping times."""

    def setUp(self):
        super().setUp()
        from .models import (
            Organization, School, AcademicYear, SchoolClass, TimetableSlot,
        )
        import datetime
        self.organization = Organization.objects.create(
            name="TT Org", code="tt-org", status="active",
        )
        self.school = School.objects.create(
            organization=self.organization, name="TT School", code="tt-school", status="active",
        )
        self.academic_year = AcademicYear.objects.create(
            organization=self.organization, school=self.school,
            name="2025-2026",
            start_date=datetime.date(2025, 9, 1),
            end_date=datetime.date(2026, 6, 30),
            status="active",
        )
        self.cls_a = SchoolClass.objects.create(
            name="Class A", level="5e", academic_year=self.academic_year,
            school=self.school, organization=self.organization, owner=self.teacher,
        )
        self.cls_b = SchoolClass.objects.create(
            name="Class B", level="6e", academic_year=self.academic_year,
            school=self.school, organization=self.organization, owner=self.teacher,
        )

    def test_no_conflict_when_times_do_not_overlap(self):
        from .models import TimetableSlot
        s1 = TimetableSlot.objects.create(
            school_class=self.cls_a, weekday=1, start_time="08:00", end_time="08:45", room="Room 101",
        )
        s2 = TimetableSlot.objects.create(
            school_class=self.cls_a, weekday=1, start_time="09:00", end_time="09:45", room="Room 101",
        )
        serializer = TimetableSlotSerializer(instance=s2)
        self.assertIsNone(serializer.data.get("conflict_warning"))

    def test_class_conflict_detected_on_create(self):
        from .models import TimetableSlot
        from rest_framework.exceptions import ValidationError
        TimetableSlot.objects.create(
            school_class=self.cls_a, weekday=1, start_time="08:00", end_time="08:45", room="Room 101",
        )
        # Overlapping slot for same class, same weekday
        serializer = TimetableSlotSerializer(data={
            "school_class": self.cls_a.id,
            "weekday": 1,
            "start_time": "08:20",
            "end_time": "09:00",
            "room": "Room 102",
        })
        with self.assertRaises(ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_room_conflict_detected_on_create(self):
        from .models import TimetableSlot
        from rest_framework.exceptions import ValidationError
        TimetableSlot.objects.create(
            school_class=self.cls_a, weekday=1, start_time="08:00", end_time="08:45", room="Room 101",
        )
        # Different class, same room, overlapping time
        serializer = TimetableSlotSerializer(data={
            "school_class": self.cls_b.id,
            "weekday": 1,
            "start_time": "08:20",
            "end_time": "09:00",
            "room": "Room 101",
        })
        with self.assertRaises(ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_no_conflict_different_day(self):
        from .models import TimetableSlot
        TimetableSlot.objects.create(
            school_class=self.cls_a, weekday=1, start_time="08:00", end_time="08:45", room="Room 101",
        )
        # Same class, same time, different weekday — no conflict
        serializer = TimetableSlotSerializer(data={
            "school_class": self.cls_a.id,
            "weekday": 2,
            "start_time": "08:00",
            "end_time": "08:45",
            "room": "Room 101",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_detect_conflicts_endpoint(self):
        from .models import TimetableSlot
        TimetableSlot.objects.create(
            school_class=self.cls_a, weekday=1, start_time="08:00", end_time="08:45", room="Room 101",
        )
        TimetableSlot.objects.create(
            school_class=self.cls_a, weekday=1, start_time="08:20", end_time="09:00", room="Room 102",
        )
        resp = self.client.get("/api/timetable/detect_conflicts/")
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["conflicts"][0]["type"], "class")


class ComputerLabSeatingTests(TeacherAPITestCase):
    """Computer lab and seating assignment CRUD and validation."""

    def setUp(self):
        super().setUp()
        from .models import (
            Organization, School, AcademicYear, SchoolClass, Student,
            ComputerLab, Seat, SeatingAssignment,
        )
        import datetime
        self.organization = Organization.objects.create(
            name="Lab Org", code="lab-org", status="active",
        )
        self.school = School.objects.create(
            organization=self.organization, name="Lab School", code="lab-school", status="active",
        )
        self.academic_year = AcademicYear.objects.create(
            organization=self.organization, school=self.school,
            name="2025-2026",
            start_date=datetime.date(2025, 9, 1),
            end_date=datetime.date(2026, 6, 30),
            status="active",
        )
        self.school_class = SchoolClass.objects.create(
            name="Class A", level="5e", academic_year=self.academic_year,
            school=self.school, organization=self.organization, owner=self.teacher,
        )
        self.student = Student.objects.create(
            full_name="Test Student", school_class=self.school_class,
            organization=self.organization, school=self.school,
        )
        self.lab = ComputerLab.objects.create(
            school=self.school, name="مخبر الإعلام الآلي 1", code="lab-1",
            capacity=20, room_number="101", status="active",
            computers_count=20, operating_system="Windows 11",
            software_list=["Word", "Excel", "PowerPoint"],
            notes="مخبر رئيسي",
        )
        self.seat_a1 = Seat.objects.create(
            lab=self.lab, seat_number="A1", row="A", column=1, status="available",
        )
        self.seat_a2 = Seat.objects.create(
            lab=self.lab, seat_number="A2", row="A", column=2, status="available",
        )

    def test_create_computer_lab(self):
        from .serializers import ComputerLabSerializer
        serializer = ComputerLabSerializer(data={
            "school": self.school.id,
            "name": "مخبر 2",
            "code": "lab-2",
            "capacity": 15,
            "room_number": "102",
            "status": "active",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        lab = serializer.save()
        self.assertEqual(lab.code, "lab-2")
        self.assertEqual(lab.capacity, 15)

    def test_duplicate_lab_code_rejected(self):
        from .serializers import ComputerLabSerializer
        from rest_framework.exceptions import ValidationError
        serializer = ComputerLabSerializer(data={
            "school": self.school.id,
            "name": "مخبر مكرر",
            "code": "lab-1",  # already exists
            "capacity": 10,
        })
        with self.assertRaises(ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_create_seat(self):
        from .serializers import SeatSerializer
        serializer = SeatSerializer(data={
            "lab": self.lab.id,
            "seat_number": "B1",
            "row": "B",
            "column": 1,
            "status": "available",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        seat = serializer.save()
        self.assertEqual(seat.seat_number, "B1")

    def test_duplicate_seat_number_rejected(self):
        from .serializers import SeatSerializer
        from rest_framework.exceptions import ValidationError
        serializer = SeatSerializer(data={
            "lab": self.lab.id,
            "seat_number": "A1",  # already exists
            "row": "A",
            "column": 1,
            "status": "available",
        })
        with self.assertRaises(ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_create_seating_assignment(self):
        from .serializers import SeatingAssignmentSerializer
        serializer = SeatingAssignmentSerializer(data={
            "student": self.student.id,
            "lab": self.lab.id,
            "seat": self.seat_a1.id,
            "academic_year": self.academic_year.id,
            "term": 1,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        assignment = serializer.save(assigned_by=self.teacher)
        self.assertEqual(assignment.student, self.student)
        self.assertEqual(assignment.seat, self.seat_a1)
        self.assertEqual(assignment.assigned_by, self.teacher)

    def test_duplicate_seat_assignment_rejected(self):
        from .models import SeatingAssignment
        from .serializers import SeatingAssignmentSerializer
        from rest_framework.exceptions import ValidationError
        # First assignment
        SeatingAssignment.objects.create(
            student=self.student, lab=self.lab, seat=self.seat_a1,
            academic_year=self.academic_year, term=1, assigned_by=self.teacher,
        )
        # Same seat, same term — conflict
        serializer = SeatingAssignmentSerializer(data={
            "student": self.student.id,
            "lab": self.lab.id,
            "seat": self.seat_a1.id,
            "academic_year": self.academic_year.id,
            "term": 1,
        })
        with self.assertRaises(ValidationError):
            serializer.is_valid(raise_exception=True)

    def test_computer_lab_seat_counts(self):
        from .serializers import ComputerLabSerializer
        serializer = ComputerLabSerializer(instance=self.lab)
        data = serializer.data
        self.assertEqual(data["seat_count"], 2)
        self.assertEqual(data["available_seats"], 2)
        self.assertEqual(data["occupied_seats"], 0)

    def test_detect_conflicts_endpoint_with_labs(self):
        from .models import TimetableSlot
        # Create a timetable conflict to verify endpoint still works with labs present
        TimetableSlot.objects.create(
            school_class=self.school_class, weekday=1, start_time="08:00", end_time="08:45", room="Room 101",
        )
        resp = self.client.get("/api/timetable/detect_conflicts/")
        self.assertEqual(resp.status_code, 200, resp.content)
        data = resp.json()
        self.assertEqual(data["count"], 0)
