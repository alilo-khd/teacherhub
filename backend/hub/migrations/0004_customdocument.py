# Generated for Creator Studio (editable block documents).
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("hub", "0003_holiday_institution_observation_seminar_student_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("kind", models.CharField(choices=[("blank", "وثيقة فارغة"), ("editable-copy", "نسخة قابلة للتحرير"), ("exam", "اختبار / فرض"), ("worksheet", "ورقة عمل / نشاط"), ("rubric", "شبكة تقويم"), ("flashcards", "بطاقات تعليمية"), ("certificate", "شهادات تقدير"), ("seating", "مخطط جلوس"), ("name-tags", "بطاقات أسماء"), ("poster", "ملصق قسم"), ("parent-letter", "رسالة / إشعار لأولياء التلاميذ"), ("meeting-minutes", "محضر اجتماع"), ("report-card", "كشف / تقرير تلميذ"), ("permission-slip", "رخصة / إذن خروج"), ("invitation", "دعوة نشاط")], default="blank", max_length=30)),
                ("orientation", models.CharField(choices=[("portrait", "عمودي"), ("landscape", "أفقي")], default="portrait", max_length=12)),
                ("content", models.JSONField(blank=True, default=dict)),
                ("source_type", models.CharField(blank=True, max_length=30)),
                ("source_id", models.PositiveIntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="custom_documents", to=settings.AUTH_USER_MODEL)),
                ("theme", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="custom_documents", to="hub.theme")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
    ]
