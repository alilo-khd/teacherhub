from getpass import getpass

from django.conf import settings
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Privately create the single teacher account or reset its password."

    def handle(self, *args, **options):
        User = get_user_model()
        username = settings.TEACHER_USERNAME
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User(username=username)

        password = getpass("New private teacher password: ")
        confirmation = getpass("Confirm password: ")
        if password != confirmation:
            raise CommandError("The passwords did not match; no account changes were made.")

        try:
            password_validation.validate_password(password, user=user)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc

        with transaction.atomic():
            user.set_password(password)
            user.is_active = True
            # The teacher account is an application user, not a Django admin.
            user.is_staff = False
            user.is_superuser = False
            user.save()

        self.stdout.write(self.style.SUCCESS(
            "The private teacher account is ready. The password was not displayed."
        ))
