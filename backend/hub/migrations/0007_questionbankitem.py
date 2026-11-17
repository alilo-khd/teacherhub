from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("hub", "0006_customdocument_library_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="QuestionBankItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("prompt", models.TextField()),
                ("qtype", models.CharField(choices=[("سؤال قصير", "سؤال قصير"), ("اختيار من متعدد", "اختيار من متعدد"), ("صح / خطأ", "صح / خطأ"), ("سؤال مقالي", "سؤال مقالي"), ("أكمل الفراغ", "أكمل الفراغ"), ("تصنيف", "تصنيف"), ("نشاط تطبيقي", "نشاط تطبيقي")], default="سؤال قصير", max_length=40)),
                ("difficulty", models.CharField(choices=[("سهل", "سهل"), ("متوسط", "متوسط"), ("صعب", "صعب")], default="متوسط", max_length=20)),
                ("points", models.FloatField(default=2)),
                ("options", models.JSONField(blank=True, default=list)),
                ("answer", models.TextField(blank=True)),
                ("explanation", models.TextField(blank=True)),
                ("lines", models.PositiveSmallIntegerField(default=3)),
                ("tags", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("course", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="question_bank_items", to="hub.course")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="question_bank_items", to=settings.AUTH_USER_MODEL)),
                ("source_document", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="bank_questions", to="hub.customdocument")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
    ]
