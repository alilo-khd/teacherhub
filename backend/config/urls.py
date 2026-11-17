from django.contrib import admin
from django.http import FileResponse, JsonResponse
from django.urls import path, include, re_path

from config.settings import FRONTEND_DIST


def spa_index(request):
    """Serve the built React app (production all-in-one hosting).

    In local dev there is no build — Vite serves the UI on :5173 instead.
    """
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(open(index, "rb"), content_type="text/html")
    return JsonResponse({"detail": "Frontend build not found — run the Vite dev server or build the frontend."}, status=404)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("hub.urls")),
    re_path(r"^(?!api/|admin/|static/).*$", spa_index),
]
