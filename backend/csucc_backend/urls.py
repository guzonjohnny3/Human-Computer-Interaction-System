from django.contrib import admin
from django.urls import include, path, re_path

from monitoring import views as monitoring_views


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("monitoring.urls")),
    path("api/", include("accounts.urls")),
    # Same-origin frontend: serve the Next.js static export from the
    # repo's ./out directory. Anything not matched above falls through to
    # the SPA's index.html (Next.js router handles in-app navigation).
    path("", monitoring_views.frontend, name="frontend-root"),
    re_path(r"^(?P<path>.+)$", monitoring_views.frontend, name="frontend-catchall"),
]
