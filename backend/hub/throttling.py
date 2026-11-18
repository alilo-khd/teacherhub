import hashlib
import hmac

from django.conf import settings
from rest_framework.throttling import ScopedRateThrottle


class PrivateTeacherLoginThrottle(ScopedRateThrottle):
    """Share login limits without persisting the raw client IP in cache keys."""

    def get_ident(self, request):
        client_ident = super().get_ident(request)
        return hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            client_ident.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
