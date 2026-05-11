from django.contrib import admin
from django.urls import include, path

from monitoring import views as monitoring_views


urlpatterns = [
    path("", monitoring_views.index),
    path("admin/", admin.site.urls),
    path("api/", include("monitoring.urls")),
    path("api/", include("accounts.urls")),
]
