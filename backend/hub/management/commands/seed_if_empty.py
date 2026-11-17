# -*- coding: utf-8 -*-
"""Restore the bundled snapshot only into an otherwise empty app database.

A few visual themes may already have been created in a fresh deployment before
this command runs. They are matched by slug, preserved, and their fixture IDs
are remapped before the remaining snapshot is loaded. Any other existing hub
model data makes this a no-op: never merge over or overwrite live records.
"""
import json
import tempfile
from pathlib import Path

from django.apps import apps
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from hub.models import Theme
from hub.views import local_user


FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "teacherhub_snapshot.json"
THEME_LABEL = "hub.theme"


class Command(BaseCommand):
    help = "Load the bundled snapshot into an empty app database, preserving existing themes."

    def handle(self, *args, **options):
        if not FIXTURE_PATH.is_file():
            raise CommandError(f"Bundled snapshot not found: {FIXTURE_PATH.name}")

        with FIXTURE_PATH.open(encoding="utf-8") as source:
            rows = json.load(source)

        # Existing teacher data means this is not a fresh database. Themes are
        # the sole exception: they are often initialized independently and are
        # safely matched/remapped below. This protects live data on every rebuild.
        existing_data = []
        for model in apps.get_app_config("hub").get_models():
            if model is Theme:
                continue
            if model.objects.exists():
                existing_data.append(model._meta.label_lower)
        if existing_data:
            self.stdout.write(
                "seed_if_empty: app data already exists "
                f"({', '.join(existing_data[:5])}); snapshot skipped to preserve it."
            )
            return

        rows = self._merge_existing_themes(rows)

        # The snapshot uses the natural key "teacher" for ownership but does
        # not ship auth.User rows. Make sure that natural key resolves even if
        # the app has already created its local teacher account.
        local_user()

        # loaddata provides one transaction and FK checks. Use a temporary JSON
        # file because the adjusted fixture may omit/remap pre-existing themes.
        with tempfile.TemporaryDirectory(prefix="teacherhub-seed-") as tmpdir:
            adjusted_path = Path(tmpdir) / "snapshot.json"
            adjusted_path.write_text(
                json.dumps(rows, ensure_ascii=False), encoding="utf-8")
            call_command("loaddata", str(adjusted_path), verbosity=0)

        self.stdout.write(self.style.SUCCESS(
            "seed_if_empty: snapshot loaded "
            f"({apps.get_model('hub', 'Course').objects.count()} lessons, "
            f"{apps.get_model('hub', 'LessonPlan').objects.count()} lesson plans)."
        ))

    @staticmethod
    def _merge_existing_themes(rows):
        """Drop themes already present by slug and remap all snapshot FKs.

        This handles databases where theme initialization has already created
        the same slug with a different primary key, or has occupied a primary
        key that the snapshot would otherwise use.
        """
        theme_rows = [row for row in rows if row["model"] == THEME_LABEL]
        if not theme_rows:
            return rows

        existing = list(Theme.objects.all())
        existing_by_slug = {theme.slug: theme for theme in existing}
        existing_by_pk = {theme.pk: theme for theme in existing}
        fixture_max_pk = max((int(row["pk"]) for row in theme_rows), default=0)
        next_pk = max([fixture_max_pk, *(int(pk) for pk in existing_by_pk)], default=0) + 1
        pk_map = {}
        kept_theme_rows = []

        for row in theme_rows:
            old_pk = int(row["pk"])
            slug = row["fields"]["slug"]
            match = existing_by_slug.get(slug)
            if match is not None:
                pk_map[old_pk] = match.pk
                continue

            target_pk = old_pk
            if target_pk in existing_by_pk:
                while next_pk in existing_by_pk:
                    next_pk += 1
                target_pk = next_pk
                next_pk += 1
            pk_map[old_pk] = target_pk
            row["pk"] = target_pk
            kept_theme_rows.append(row)

        # Remap every FK/O2O in the bundled app fixture that targets Theme.
        for row in rows:
            if row["model"] == THEME_LABEL:
                continue
            model = apps.get_model(row["model"])
            fields = row["fields"]
            for field in model._meta.fields:
                remote = getattr(field, "remote_field", None)
                if remote is None or remote.model is not Theme:
                    continue
                value = fields.get(field.name)
                if isinstance(value, int):
                    fields[field.name] = pk_map.get(value, value)

        # Keep newly-added themes at the front, before objects that refer to them.
        other_rows = [row for row in rows if row["model"] != THEME_LABEL]
        return kept_theme_rows + other_rows
