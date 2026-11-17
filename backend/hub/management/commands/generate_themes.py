# -*- coding: utf-8 -*-
"""Generate the theme library automatically.

Usage:
    python manage.py generate_themes              # curated + 48 generated
    python manage.py generate_themes --extra 24   # 24 more generated themes
"""
from django.core.management.base import BaseCommand
from hub.models import Theme
from hub.theme_gen import CURATED, generate_theme_dicts


class Command(BaseCommand):
    help = "Seed curated themes and auto-generate a library of additional themes."

    def add_arguments(self, parser):
        parser.add_argument("--generated", type=int, default=48,
                            help="how many auto-generated themes to ensure (default 48)")
        parser.add_argument("--extra", type=int, default=0,
                            help="generate this many NEW themes beyond the current count")

    def handle(self, *args, **opts):
        created = 0
        for data in CURATED:
            _, was = Theme.objects.get_or_create(
                slug=data["slug"], defaults={**data, "body_font": "IBM Plex Sans Arabic",
                                             "source": "curated"})
            created += was
        existing = Theme.objects.filter(source="generated").count()
        target = existing + opts["extra"] if opts["extra"] else max(existing, opts["generated"])
        if target > existing:
            for data in generate_theme_dicts(target - existing, offset=existing):
                _, was = Theme.objects.get_or_create(slug=data["slug"], defaults=data)
                created += was
        self.stdout.write(self.style.SUCCESS(
            f"Themes ready: {Theme.objects.count()} total ({created} newly created)."))
