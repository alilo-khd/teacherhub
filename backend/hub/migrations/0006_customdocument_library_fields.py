from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("hub", "0005_documentrevision_and_new_kinds")]

    operations = [
        migrations.AddField(
            model_name="customdocument",
            name="tags",
            field=models.JSONField(blank=True, default=list, help_text="وسوم قصيرة لتنظيم مكتبة الوثائق"),
        ),
        migrations.AddField(
            model_name="customdocument",
            name="is_favorite",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="customdocument",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
    ]
