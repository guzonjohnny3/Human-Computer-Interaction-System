"""Data model for the CSUCC Smart Restroom Air Quality Monitoring System.

The schema mirrors the conceptual entities used by the realtime frontend:
buildings → restrooms → (sensor readings, AI predictions, alerts, cleaning
events). All numeric sensor fields are stored as FloatField for parity with
the simulated MQ135 / MQ136 / MQ137 outputs.
"""

from __future__ import annotations

from django.db import models


class StatusLevel(models.TextChoices):
    SAFE = "safe", "Safe"
    MODERATE = "moderate", "Moderate"
    POOR = "poor", "Poor"
    HAZARDOUS = "hazardous", "Hazardous"
    CRITICAL = "critical", "Critical"


class RestroomType(models.TextChoices):
    MALE = "Male", "Male"
    FEMALE = "Female", "Female"


class AlertSeverity(models.TextChoices):
    INFO = "INFO", "Info"
    WARNING = "WARNING", "Warning"
    CRITICAL = "CRITICAL", "Critical"


class AlertSource(models.TextChoices):
    SENSOR = "sensor", "Sensor escalation"
    AI = "ai", "AI prediction"


class CleaningTrigger(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    REACTIVE = "reactive", "Reactive"
    MANUAL = "manual", "Manual (admin dispatch)"


class Building(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=128)
    short_name = models.CharField(max_length=32)
    lat = models.FloatField()
    lng = models.FloatField()

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Restroom(models.Model):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="restrooms")
    code = models.CharField(max_length=64, unique=True)
    restroom_type = models.CharField(max_length=8, choices=RestroomType.choices)
    lat = models.FloatField()
    lng = models.FloatField()
    baseline = models.FloatField(default=0.5)

    class Meta:
        ordering = ["building__name", "restroom_type"]
        unique_together = [("building", "restroom_type")]

    def __str__(self) -> str:
        return f"{self.building.name} · {self.restroom_type}"


class SensorReading(models.Model):
    restroom = models.ForeignKey(Restroom, on_delete=models.CASCADE, related_name="readings")
    t = models.DateTimeField(db_index=True)
    mq135 = models.FloatField(help_text="MQ135 — CO2 / VOC equivalent (ppm)")
    mq136 = models.FloatField(help_text="MQ136 — H2S / sulfur equivalent (ppm)")
    mq137 = models.FloatField(help_text="MQ137 — NH3 / ammonia equivalent (ppm)")
    temperature = models.FloatField(help_text="°C")
    humidity = models.FloatField(help_text="%")
    odor = models.FloatField(help_text="composite odor index 0..100")
    air_quality = models.FloatField(help_text="composite AQ score 0..100 (higher = better)")
    status = models.CharField(max_length=16, choices=StatusLevel.choices, db_index=True)

    class Meta:
        ordering = ["-t"]
        indexes = [
            models.Index(fields=["restroom", "-t"]),
        ]

    def __str__(self) -> str:
        return f"{self.restroom} @ {self.t.isoformat()} [{self.status}]"


class AIPrediction(models.Model):
    """Snapshot of MLR + LSTM forecast for a restroom at a given time."""

    restroom = models.ForeignKey(Restroom, on_delete=models.CASCADE, related_name="predictions")
    t = models.DateTimeField(db_index=True)
    predicted_odor_1h = models.FloatField()
    predicted_status_1h = models.CharField(max_length=16, choices=StatusLevel.choices)
    peak_hour = models.IntegerField()
    worst_day = models.IntegerField(help_text="0=Sun .. 6=Sat")
    hazardous_window = models.CharField(max_length=128)
    narrative = models.TextField()
    confidence = models.FloatField(help_text="MLR R² (0..1)")

    class Meta:
        ordering = ["-t"]
        indexes = [
            models.Index(fields=["restroom", "-t"]),
        ]


class Alert(models.Model):
    restroom = models.ForeignKey(Restroom, on_delete=models.CASCADE, related_name="alerts")
    t = models.DateTimeField(db_index=True)
    level = models.CharField(max_length=16, choices=StatusLevel.choices)
    severity = models.CharField(max_length=16, choices=AlertSeverity.choices, db_index=True)
    source = models.CharField(max_length=16, choices=AlertSource.choices)
    message = models.TextField()
    reading = models.ForeignKey(
        SensorReading, on_delete=models.SET_NULL, null=True, blank=True, related_name="alerts"
    )
    prediction = models.ForeignKey(
        AIPrediction, on_delete=models.SET_NULL, null=True, blank=True, related_name="alerts"
    )
    acknowledged = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-t"]
        indexes = [
            models.Index(fields=["restroom", "-t"]),
            models.Index(fields=["acknowledged", "-t"]),
        ]


class CleaningEvent(models.Model):
    restroom = models.ForeignKey(Restroom, on_delete=models.CASCADE, related_name="cleanings")
    t = models.DateTimeField(db_index=True)
    trigger = models.CharField(max_length=16, choices=CleaningTrigger.choices)
    duration_min = models.IntegerField(help_text="approximate cleaning duration in minutes")
    odor_before = models.FloatField()
    odor_after = models.FloatField()

    class Meta:
        ordering = ["-t"]
        indexes = [
            models.Index(fields=["restroom", "-t"]),
        ]
