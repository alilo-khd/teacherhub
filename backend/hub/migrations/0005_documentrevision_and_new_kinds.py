from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("hub", "0004_customdocument")]

    operations = [
        migrations.AlterField(
            model_name="customdocument",
            name="kind",
            field=models.CharField(choices=[("blank", "وثيقة فارغة"), ("editable-copy", "نسخة قابلة للتحرير"), ("exam", "اختبار / فرض"), ("worksheet", "ورقة عمل / نشاط"), ("rubric", "شبكة تقويم"), ("flashcards", "بطاقات تعليمية"), ("certificate", "شهادات تقدير"), ("seating", "مخطط جلوس"), ("name-tags", "بطاقات أسماء"), ("poster", "ملصق قسم"), ("parent-letter", "رسالة / إشعار لأولياء التلاميذ"), ("meeting-minutes", "محضر اجتماع"), ("report-card", "كشف / تقرير تلميذ"), ("permission-slip", "رخصة / إذن خروج"), ("invitation", "دعوة نشاط"), ("attendance-sheet", "سجل الحضور والغياب"), ("tracker-sheet", "سجل متابعة الواجبات والسلوك"), ("student-id-cards", "بطاقات هوية التلاميذ")], default="blank", max_length=30),
        ),
        migrations.CreateModel(
            name="DocumentRevision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("label", models.CharField(blank=True, max_length=120)),
                ("title", models.CharField(max_length=200)),
                ("kind", models.CharField(default="blank", max_length=30)),
                ("orientation", models.CharField(default="portrait", max_length=12)),
                ("content", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("document", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="revisions", to="hub.customdocument")),
                ("theme", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="document_revisions", to="hub.theme")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
