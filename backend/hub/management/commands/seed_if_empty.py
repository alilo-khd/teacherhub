# -*- coding: utf-8 -*-
"""Load the bundled data snapshot — but only into an empty database.

The deploy package ships a snapshot of the teacher's data (lessons, lesson
plans, classes, students, marks, documents…) at
hub/fixtures/teacherhub_snapshot.json. On a fresh deployment (new/empty
database) this command restores everything automatically; on an existing
database (e.g. the Neon project already in use) it is a no-op, so deploys
and rebuilds never duplicate or overwrite live data.

Usage:
    python manage.py seed_if_empty
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand

from hub.models import Course


class Command(BaseCommand):
    help = "Load the bundled teacherhub_snapshot fixture if the database is empty."

    def handle(self, *args, **options):
        if Course.objects.exists():
            self.stdout.write("seed_if_empty: database already has lessons — snapshot skipped.")
            return
        call_command("loaddata", "teacherhub_snapshot", verbosity=0)
        self.stdout.write(self.style.SUCCESS(
            f"seed_if_empty: snapshot loaded ({Course.objects.count()} lessons)."))
