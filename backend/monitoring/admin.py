from django.contrib import admin

from .models import AIPrediction, Alert, Building, CleaningEvent, Restroom, SensorReading


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "short_name", "lat", "lng")
    search_fields = ("name", "code")


@admin.register(Restroom)
class RestroomAdmin(admin.ModelAdmin):
    list_display = ("code", "building", "restroom_type", "baseline")
    list_filter = ("restroom_type", "building")


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = ("restroom", "t", "mq135", "mq136", "mq137", "odor", "air_quality", "status")
    list_filter = ("status", "restroom__building")
    date_hierarchy = "t"


@admin.register(AIPrediction)
class AIPredictionAdmin(admin.ModelAdmin):
    list_display = ("restroom", "t", "predicted_odor_1h", "predicted_status_1h", "confidence")
    list_filter = ("predicted_status_1h", "restroom__building")


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("restroom", "t", "level", "severity", "source", "acknowledged")
    list_filter = ("severity", "source", "level", "acknowledged")
    date_hierarchy = "t"


@admin.register(CleaningEvent)
class CleaningEventAdmin(admin.ModelAdmin):
    list_display = ("restroom", "t", "trigger", "duration_min", "odor_before", "odor_after")
    list_filter = ("trigger", "restroom__building")
    date_hierarchy = "t"
