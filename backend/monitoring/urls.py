from __future__ import annotations

from django.urls import path

from . import views


urlpatterns = [
    path("", views.index),
    path("health/", views.health),
    path("buildings/", views.list_buildings),
    path("restrooms/", views.list_restrooms),
    path("snapshot/", views.snapshot),
    path("readings/", views.list_readings),
    path("predictions/", views.list_predictions),
    path("alerts/", views.list_alerts),
    path("alerts/<int:alert_id>/ack/", views.acknowledge_alert),
    path("cleanings/", views.list_cleanings),
    path("cleanings/dispatch/", views.dispatch_janitor),
    path("hazard/inject/", views.inject_hazard),
    path("stream/", views.stream),
]
