from django.conf import settings
from rest_framework.permissions import BasePermission


class IsTeacherAccount(BasePermission):
    """Allow only the provisioned private teacher account into the workspace."""

    message = "Authentication is required for this private workspace."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_active", False)
            and user.get_username() == settings.TEACHER_USERNAME
        )


def _profile(user):
    try:
        return user.profile
    except Exception:
        return None


class IsParentAccount(BasePermission):
    """Allow a provisioned parent account to view their children's data."""

    message = "Parent portal access required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_active", False):
            return False
        profile = _profile(user)
        return bool(profile and profile.role == "parent" and profile.linked_student_id)


class IsStudentAccount(BasePermission):
    """Allow a provisioned student account to view their own data."""

    message = "Student portal access required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_active", False):
            return False
        profile = _profile(user)
        return bool(profile and profile.role == "student" and profile.linked_student_id)


class IsPortalAccount(BasePermission):
    """Allow any portal account (parent or student)."""

    message = "Portal access required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated or not getattr(user, "is_active", False):
            return False
        profile = _profile(user)
        return bool(profile and profile.role in ("parent", "student") and profile.linked_student_id)
