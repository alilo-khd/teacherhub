"""TeacherHub — teacher management (Django + DRF).

Local-first by default (SQLite, dev server), production-ready via env vars:
DATABASE_URL (Neon Postgres), DJANGO_SECRET_KEY, DJANGO_DEBUG,
DJANGO_ALLOWED_HOSTS. A repo-root `.env` (e.g. written by `neon init`) is
loaded automatically and never overrides real environment variables.
"""
import os
from pathlib import Path
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"


def _load_env_file(path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(REPO_ROOT / ".env")
_load_env_file(REPO_ROOT / ".env.local")
_load_env_file(BASE_DIR / ".env")

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
_secret_key = os.environ.get("DJANGO_SECRET_KEY")
if not DEBUG and not _secret_key:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be configured when DEBUG is disabled.")
SECRET_KEY = _secret_key or "dev-only-teacherhub-local-key-change-me"
# The existing data model and bundled snapshot are keyed to this single owner.
TEACHER_USERNAME = "teacher"

_render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
_default_hosts = "*" if DEBUG else (_render_host or "")
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", _default_hosts).split(",") if h.strip()]
if _render_host and _render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_render_host)
if not DEBUG and not ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set DJANGO_ALLOWED_HOSTS or use a host-provided external hostname.")

CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
if _render_host:
    CSRF_TRUSTED_ORIGINS.append(f"https://{_render_host}")
if DEBUG:
    # Local Vite and the isolated Arena preview proxy to Django on the same
    # origin, but the browser's Origin still reflects the Vite preview host.
    CSRF_TRUSTED_ORIGINS.extend([
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "https://*.e2b.app",
    ])
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SESSION_COOKIE_AGE = 12 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG

if DEBUG:
    # Convenient for local-only workflows and automated tests.
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "teacherhub-development-cache",
        }
    }
else:
    # Render runs multiple Gunicorn workers. Persist throttles in the existing
    # shared Postgres database rather than using per-process memory.
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": "teacherhub_cache",
            "OPTIONS": {"MAX_ENTRIES": 10000, "CULL_FREQUENCY": 3},
        }
    }

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "hub",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]


ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates",
              "DIRS": [], "APP_DIRS": True,
              "OPTIONS": {"context_processors": [
                  "django.template.context_processors.request",
                  "django.contrib.auth.context_processors.auth",
                  "django.contrib.messages.context_processors.messages"]}}]

if os.environ.get("DATABASE_URL"):
    import dj_database_url
    DATABASES = {"default": dj_database_url.config(conn_max_age=60, conn_health_checks=True)}
elif DEBUG:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3",
                             "NAME": BASE_DIR / "db.sqlite3"}}
else:
    # Production must never silently fall back to a disposable local file:
    # on hosts like Render that file is wiped on every rebuild.
    raise ImproperlyConfigured(
        "DATABASE_URL is not set. In production (DJANGO_DEBUG=0) TeacherHub "
        "requires a real database — set DATABASE_URL to your Neon connection "
        "string in the host's environment settings.")

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
LANGUAGE_CODE = "ar"
TIME_ZONE = "Africa/Algiers"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []
STORAGES = {"staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
            "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["hub.permissions.IsTeacherAccount"],
    "DEFAULT_THROTTLE_RATES": {"teacher_login": "10/minute"},
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
}
