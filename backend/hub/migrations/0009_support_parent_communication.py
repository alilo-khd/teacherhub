from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("hub", "0008_attendance_followup")]

    operations = [
        migrations.CreateModel(
            name="SupportPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("category", models.CharField(choices=[("academic", "دعم دراسي"), ("attendance", "متابعة الحضور"), ("homework", "متابعة الواجبات"), ("behaviour", "السلوك والانضباط"), ("mixed", "دعم شامل"), ("other", "أخرى")], default="academic", max_length=30)),
                ("priority", models.CharField(choices=[("low", "منخفضة"), ("medium", "متوسطة"), ("high", "عالية")], default="medium", max_length=20)),
                ("status", models.CharField(choices=[("planned", "مخططة"), ("active", "جارية"), ("monitoring", "قيد المراقبة"), ("completed", "مكتملة"), ("cancelled", "ملغاة")], default="planned", max_length=20)),
                ("reason", models.TextField(blank=True)),
                ("actions", models.JSONField(blank=True, default=list, help_text="[{text, done, due}] — إجراءات الدعم القابلة للتتبع")),
                ("start_date", models.DateField(blank=True, null=True)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("teacher_notes", models.TextField(blank=True)),
                ("outcome", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="support_plans", to="hub.student")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="ParentCommunication",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("channel", models.CharField(choices=[("letter", "رسالة مكتوبة"), ("phone", "مكالمة هاتفية"), ("meeting", "لقاء"), ("message", "رسالة قصيرة / تطبيق"), ("other", "أخرى")], default="letter", max_length=20)),
                ("subject", models.CharField(max_length=200)),
                ("summary", models.TextField(blank=True)),
                ("outcome", models.TextField(blank=True)),
                ("follow_up_date", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="parent_communications", to="hub.student")),
                ("support_plan", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="communications", to="hub.supportplan")),
            ],
            options={"ordering": ["-date", "-created_at"]},
        ),
    ]
