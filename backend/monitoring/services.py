"""Background simulation orchestrator.

Runs a thread that:
1. every `SIM_TICK_SECONDS` seconds, generates a fresh sensor reading for
   every restroom and persists it to the database.
2. computes an MLR + LSTM-style forecast for each restroom.
3. emits alerts on status escalation (sensor) and on AI predictions
   forecasting hazardous/critical (AI).
4. records cleaning events for both scheduled/reactive (simulation) and
   manual (admin dispatch) triggers.

The thread is started on Django app-ready when `CSUCC_AUTOSTART=1` (default).
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from queue import Queue, Empty, Full
from typing import Iterable

from django.conf import settings
from django.db import close_old_connections, transaction

from . import simulation as sim
from .ai import predict_for_history, weekday_label
from .campus import BUILDINGS, RestroomSpec, all_restrooms
from .models import (
    AIPrediction,
    Alert,
    AlertSeverity,
    AlertSource,
    Building,
    CleaningEvent,
    CleaningTrigger,
    Restroom,
    SensorReading,
    StatusLevel,
)


log = logging.getLogger("csucc.sim")

# In-memory ring of recent readings per restroom (avoids hitting DB every tick).
_READING_HISTORY: dict[str, list[sim.Reading]] = {}
_LAST_AI_ALERT: dict[str, float] = {}
_LAST_STATUS: dict[str, str] = {}

# Subscribers receive a small JSON-serialisable dict per tick (used by SSE).
_SUBSCRIBERS: list[Queue] = []
_SUBSCRIBERS_LOCK = threading.Lock()

_RUN_LOCK = threading.Lock()
_running = False


def _to_severity(status: str) -> str:
    if status in ("critical", "hazardous"):
        return AlertSeverity.CRITICAL
    if status == "poor":
        return AlertSeverity.WARNING
    return AlertSeverity.INFO


def _status_rank(level: str) -> int:
    return {"safe": 0, "moderate": 1, "poor": 2, "hazardous": 3, "critical": 4}.get(level, 0)


def _alert_message_for(level: str, restroom_type: str, building: str) -> str:
    if level == "critical":
        return f"CRITICAL — {restroom_type} CR at {building}: ammonia spike, immediate sanitation required."
    if level == "hazardous":
        return f"HAZARDOUS — {restroom_type} CR at {building}: dangerous ammonia concentration detected."
    if level == "poor":
        return f"POOR ventilation — {restroom_type} CR at {building}: strong odor detected."
    if level == "moderate":
        return f"MODERATE odor — {restroom_type} CR at {building}: monitor for escalation."
    return f"{restroom_type} CR at {building} status changed to {level}."


def ensure_seed_data() -> None:
    """Idempotently create Building + Restroom rows + seeded history."""
    with transaction.atomic():
        for b in BUILDINGS:
            Building.objects.update_or_create(
                code=b.code,
                defaults={"name": b.name, "short_name": b.short_name, "lat": b.lat, "lng": b.lng},
            )
        bmap = {b.code: b for b in Building.objects.all()}
        for r in all_restrooms():
            Restroom.objects.update_or_create(
                code=r.code,
                defaults={
                    "building": bmap[r.building_code],
                    "restroom_type": r.restroom_type,
                    "lat": r.lat,
                    "lng": r.lng,
                    "baseline": r.baseline,
                },
            )

    # Seed history if the DB is empty for this restroom.
    seed_hours = float(getattr(settings, "SIM_SEED_HOURS", 3))
    for r in all_restrooms():
        rr = Restroom.objects.get(code=r.code)
        if rr.readings.exists():
            history = _load_history(rr, limit=200)
        else:
            history = sim.seed_history(r.code, r.baseline, hours=seed_hours, step_seconds=60)
            SensorReading.objects.bulk_create(
                [
                    SensorReading(
                        restroom=rr,
                        t=h.t,
                        mq135=h.mq135,
                        mq136=h.mq136,
                        mq137=h.mq137,
                        temperature=h.temperature,
                        humidity=h.humidity,
                        odor=h.odor,
                        air_quality=h.air_quality,
                        status=sim.status_of(h),
                    )
                    for h in history
                ]
            )
        _READING_HISTORY[r.code] = history[-200:]
        _LAST_STATUS[r.code] = sim.status_of(history[-1]) if history else "safe"


def _load_history(restroom: Restroom, limit: int = 200) -> list[sim.Reading]:
    qs = list(restroom.readings.order_by("-t")[:limit])[::-1]
    return [
        sim.Reading(
            t=r.t,
            mq135=r.mq135,
            mq136=r.mq136,
            mq137=r.mq137,
            temperature=r.temperature,
            humidity=r.humidity,
            odor=r.odor,
            air_quality=r.air_quality,
        )
        for r in qs
    ]


def subscribe() -> Queue:
    q: Queue = Queue(maxsize=10)
    with _SUBSCRIBERS_LOCK:
        _SUBSCRIBERS.append(q)
    return q


def unsubscribe(q: Queue) -> None:
    with _SUBSCRIBERS_LOCK:
        if q in _SUBSCRIBERS:
            _SUBSCRIBERS.remove(q)


def _broadcast(payload: dict) -> None:
    with _SUBSCRIBERS_LOCK:
        dead: list[Queue] = []
        for q in _SUBSCRIBERS:
            try:
                q.put_nowait(payload)
            except Full:
                dead.append(q)
        for q in dead:
            try:
                _SUBSCRIBERS.remove(q)
            except ValueError:
                pass


def _tick_one(spec: RestroomSpec, rr: Restroom, now: datetime) -> dict:
    """Run one simulation step for a single restroom; persist + alert."""
    history = _READING_HISTORY.get(spec.code, [])
    tick = sim.tick_restroom(spec.code, spec.baseline, now, record_cleaning=True)
    reading = tick.reading
    status = sim.status_of(reading)

    history.append(reading)
    if len(history) > 200:
        history = history[-200:]
    _READING_HISTORY[spec.code] = history

    sr = SensorReading.objects.create(
        restroom=rr,
        t=reading.t,
        mq135=reading.mq135,
        mq136=reading.mq136,
        mq137=reading.mq137,
        temperature=reading.temperature,
        humidity=reading.humidity,
        odor=reading.odor,
        air_quality=reading.air_quality,
        status=status,
    )

    cleaning_payload: dict | None = None
    if tick.cleaning is not None:
        ce = CleaningEvent.objects.create(
            restroom=rr,
            t=tick.cleaning.t,
            trigger=tick.cleaning.trigger,
            duration_min=tick.cleaning.duration_min,
            odor_before=tick.cleaning.odor_before,
            odor_after=tick.cleaning.odor_after,
        )
        cleaning_payload = {
            "id": ce.id,
            "restroom": rr.code,
            "t": ce.t.isoformat(),
            "trigger": ce.trigger,
            "duration_min": ce.duration_min,
            "odor_before": ce.odor_before,
            "odor_after": ce.odor_after,
        }

    pred_obj: AIPrediction | None = None
    pred = predict_for_history(history)
    if pred is not None:
        pred_obj = AIPrediction.objects.create(
            restroom=rr,
            t=pred.t,
            predicted_odor_1h=pred.predicted_odor_1h,
            predicted_status_1h=pred.predicted_status_1h,
            peak_hour=pred.peak_hour,
            worst_day=pred.worst_day,
            hazardous_window=pred.hazardous_window,
            narrative=pred.narrative,
            confidence=pred.confidence,
        )

    # Alert generation.
    prev_status = _LAST_STATUS.get(spec.code)
    new_alerts: list[dict] = []
    if prev_status is not None and _status_rank(status) > _status_rank(prev_status) and status in (
        "moderate",
        "poor",
        "hazardous",
        "critical",
    ):
        a = Alert.objects.create(
            restroom=rr,
            t=now,
            level=status,
            severity=_to_severity(status),
            source=AlertSource.SENSOR,
            message=_alert_message_for(status, rr.restroom_type, rr.building.name),
            reading=sr,
            prediction=pred_obj,
        )
        new_alerts.append(_serialize_alert(a))

    if pred is not None and pred.predicted_status_1h in ("hazardous", "critical"):
        last = _LAST_AI_ALERT.get(spec.code, 0.0)
        if time.time() - last > 60:
            a = Alert.objects.create(
                restroom=rr,
                t=now,
                level=pred.predicted_status_1h,
                severity=_to_severity(pred.predicted_status_1h),
                source=AlertSource.AI,
                message=(
                    f"AI predicts {pred.predicted_status_1h.upper()} — "
                    f"{rr.restroom_type} CR at {rr.building.name}: "
                    f"odor expected to reach {pred.predicted_odor_1h:.0f} within 1h."
                ),
                reading=sr,
                prediction=pred_obj,
            )
            _LAST_AI_ALERT[spec.code] = time.time()
            new_alerts.append(_serialize_alert(a))

    _LAST_STATUS[spec.code] = status

    return {
        "restroom": rr.code,
        "building": rr.building.name,
        "building_code": rr.building.code,
        "type": rr.restroom_type,
        "status": status,
        "current": {
            "t": reading.t.isoformat(),
            "mq135": reading.mq135,
            "mq136": reading.mq136,
            "mq137": reading.mq137,
            "temperature": reading.temperature,
            "humidity": reading.humidity,
            "odor": reading.odor,
            "air_quality": reading.air_quality,
        },
        "prediction": _serialize_prediction(pred_obj) if pred_obj else None,
        "alerts": new_alerts,
        "cleaning": cleaning_payload,
    }


def _serialize_alert(a: Alert) -> dict:
    return {
        "id": a.id,
        "t": a.t.isoformat(),
        "restroom": a.restroom.code,
        "building": a.restroom.building.name,
        "type": a.restroom.restroom_type,
        "level": a.level,
        "severity": a.severity,
        "source": a.source,
        "message": a.message,
        "acknowledged": a.acknowledged,
    }


def _serialize_prediction(p: AIPrediction) -> dict:
    return {
        "t": p.t.isoformat(),
        "predicted_odor_1h": p.predicted_odor_1h,
        "predicted_status_1h": p.predicted_status_1h,
        "peak_hour": p.peak_hour,
        "worst_day": p.worst_day,
        "worst_day_label": weekday_label(p.worst_day),
        "hazardous_window": p.hazardous_window,
        "narrative": p.narrative,
        "confidence": p.confidence,
    }


def run_one_tick() -> dict:
    """One simulation step across all restrooms."""
    now = datetime.now(timezone.utc)
    specs = {r.code: r for r in all_restrooms()}
    restrooms = list(Restroom.objects.select_related("building"))
    states: list[dict] = []
    for rr in restrooms:
        spec = specs[rr.code]
        try:
            with transaction.atomic():
                states.append(_tick_one(spec, rr, now))
        except Exception:  # pragma: no cover
            log.exception("tick failed for %s", rr.code)
    payload = {"t": now.isoformat(), "states": states}
    _broadcast(payload)
    return payload


def _loop() -> None:
    global _running
    interval = float(getattr(settings, "SIM_TICK_SECONDS", 5.0))
    log.info("CSUCC simulation loop starting (interval=%ss)", interval)
    while _running:
        start = time.monotonic()
        try:
            run_one_tick()
        except Exception:  # pragma: no cover
            log.exception("simulation tick crashed")
        finally:
            close_old_connections()
        sleep = max(0.0, interval - (time.monotonic() - start))
        time.sleep(sleep)
    log.info("CSUCC simulation loop stopped")


def start_loop() -> None:
    global _running
    with _RUN_LOCK:
        if _running:
            return
        _running = True
        t = threading.Thread(target=_loop, name="csucc-sim", daemon=True)
        t.start()


def stop_loop() -> None:
    global _running
    with _RUN_LOCK:
        _running = False


def dispatch_janitor(restroom_code: str) -> dict:
    """Manual force-clean triggered by an admin."""
    rr = Restroom.objects.select_related("building").get(code=restroom_code)
    spec = next(r for r in all_restrooms() if r.code == restroom_code)
    now = datetime.now(timezone.utc)
    tick = sim.force_clean(spec.code, spec.baseline, now)
    reading = tick.reading
    SensorReading.objects.create(
        restroom=rr,
        t=reading.t,
        mq135=reading.mq135,
        mq136=reading.mq136,
        mq137=reading.mq137,
        temperature=reading.temperature,
        humidity=reading.humidity,
        odor=reading.odor,
        air_quality=reading.air_quality,
        status=sim.status_of(reading),
    )
    ce: CleaningEvent | None = None
    if tick.cleaning is not None:
        ce = CleaningEvent.objects.create(
            restroom=rr,
            t=tick.cleaning.t,
            trigger=CleaningTrigger.MANUAL,
            duration_min=tick.cleaning.duration_min,
            odor_before=tick.cleaning.odor_before,
            odor_after=tick.cleaning.odor_after,
        )
    Alert.objects.filter(restroom=rr, acknowledged=False).update(
        acknowledged=True, acknowledged_at=now
    )
    return {
        "ok": True,
        "restroom": rr.code,
        "reading": {
            "t": reading.t.isoformat(),
            "mq135": reading.mq135,
            "mq136": reading.mq136,
            "mq137": reading.mq137,
            "temperature": reading.temperature,
            "humidity": reading.humidity,
            "odor": reading.odor,
            "air_quality": reading.air_quality,
            "status": sim.status_of(reading),
        },
        "cleaning": (
            {
                "id": ce.id,
                "t": ce.t.isoformat(),
                "trigger": ce.trigger,
                "duration_min": ce.duration_min,
                "odor_before": ce.odor_before,
                "odor_after": ce.odor_after,
            }
            if ce is not None
            else None
        ),
    }


def inject_demo_hazard(level: str = "critical") -> dict:
    """Pick a random clean restroom and spike its sensors."""
    rrs = list(Restroom.objects.select_related("building"))
    safe_rrs = [
        rr
        for rr in rrs
        if _LAST_STATUS.get(rr.code, "safe") in ("safe", "moderate")
    ]
    pool: Iterable[Restroom] = safe_rrs or rrs
    import random as _r

    target = _r.choice(list(pool))
    spec = next(r for r in all_restrooms() if r.code == target.code)
    reading = sim.inject_hazard(spec.code, spec.baseline, level=level)
    SensorReading.objects.create(
        restroom=target,
        t=reading.t,
        mq135=reading.mq135,
        mq136=reading.mq136,
        mq137=reading.mq137,
        temperature=reading.temperature,
        humidity=reading.humidity,
        odor=reading.odor,
        air_quality=reading.air_quality,
        status=sim.status_of(reading),
    )
    return {
        "ok": True,
        "restroom": target.code,
        "building": target.building.name,
        "type": target.restroom_type,
        "level": level,
    }


# Re-export queue helpers for the SSE view.
__all__ = (
    "ensure_seed_data",
    "start_loop",
    "stop_loop",
    "run_one_tick",
    "subscribe",
    "unsubscribe",
    "dispatch_janitor",
    "inject_demo_hazard",
)
# Silence unused-import warning for Empty (used implicitly in callers).
_ = Empty
