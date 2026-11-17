from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("hub", "0007_questionbankitem")]

    operations = [
        migrations.CreateModel(
            name="AttendanceRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("status", models.CharField(choices=[("present", "حاضر"), ("absent", "غائب"), ("late", "متأخر"), ("excused", "غياب مبرر"), ("left_early", "غادر مبكرًا")], default="present", max_length=20)),
                ("note", models.CharField(blank=True, max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("session", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="attendance_records", to="hub.session")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_records", to="hub.student")),
            ],
            options={"ordering": ["-date", "student__full_name"]},
        ),
        migrations.CreateModel(
            name="StudentFollowUpRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("category", models.CharField(choices=[("homework", "الواجب المنزلي"), ("behaviour", "السلوك والانضباط"), ("participation", "المشاركة"), ("support", "الدعم والملاحظات")], default="homework", max_length=30)),
                ("score", models.PositiveSmallIntegerField(blank=True, null=True, help_text="من 0 إلى 5")),
                ("status", models.CharField(blank=True, max_length=80)),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("course", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="follow_up_records", to="hub.course")),
                ("session", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="follow_up_records", to="hub.session")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="follow_up_records", to="hub.student")),
            ],
            options={"ordering": ["-date", "student__full_name", "category"]},
        ),
        migrations.AddConstraint(
            model_name="attendancerecord",
            constraint=models.UniqueConstraint(fields=("student", "date", "session"), name="unique_student_day_session_attendance"),
        ),
    ]
