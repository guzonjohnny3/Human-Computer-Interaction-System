"""DRF serializers."""

from __future__ import annotations

from rest_framework import serializers

from .models import AIPrediction, Alert, Building, CleaningEvent, Restroom, SensorReading


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = ["id", "code", "name", "short_name", "lat", "lng"]


class RestroomSerializer(serializers.ModelSerializer):
    building = BuildingSerializer(read_only=True)

    class Meta:
        model = Restroom
        fields = [
            "id",
            "code",
            "restroom_type",
            "lat",
            "lng",
            "baseline",
            "building",
        ]


class SensorReadingSerializer(serializers.ModelSerializer):
    restroom_code = serializers.CharField(source="restroom.code", read_only=True)

    class Meta:
        model = SensorReading
        fields = [
            "id",
            "restroom_code",
            "t",
            "mq135",
            "mq136",
            "mq137",
            "temperature",
            "humidity",
            "odor",
            "air_quality",
            "status",
        ]


class AIPredictionSerializer(serializers.ModelSerializer):
    restroom_code = serializers.CharField(source="restroom.code", read_only=True)

    class Meta:
        model = AIPrediction
        fields = [
            "id",
            "restroom_code",
            "t",
            "predicted_odor_1h",
            "predicted_status_1h",
            "peak_hour",
            "worst_day",
            "hazardous_window",
            "narrative",
            "confidence",
        ]


class AlertSerializer(serializers.ModelSerializer):
    restroom_code = serializers.CharField(source="restroom.code", read_only=True)
    building_name = serializers.CharField(source="restroom.building.name", read_only=True)
    restroom_type = serializers.CharField(source="restroom.restroom_type", read_only=True)

    class Meta:
        model = Alert
        fields = [
            "id",
            "t",
            "restroom_code",
            "building_name",
            "restroom_type",
            "level",
            "severity",
            "source",
            "message",
            "acknowledged",
            "acknowledged_at",
        ]


class CleaningEventSerializer(serializers.ModelSerializer):
    restroom_code = serializers.CharField(source="restroom.code", read_only=True)
    building_name = serializers.CharField(source="restroom.building.name", read_only=True)
    restroom_type = serializers.CharField(source="restroom.restroom_type", read_only=True)

    class Meta:
        model = CleaningEvent
        fields = [
            "id",
            "t",
            "restroom_code",
            "building_name",
            "restroom_type",
            "trigger",
            "duration_min",
            "odor_before",
            "odor_after",
        ]
