"""REST + SSE views."""

from __future__ import annotations

import json
import mimetypes
import time
from pathlib import Path
from queue import Empty

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, StreamingHttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import services
from .models import AIPrediction, Alert, Building, CleaningEvent, Restroom, SensorReading
from .serializers import (
    AIPredictionSerializer,
    AlertSerializer,
    BuildingSerializer,
    CleaningEventSerializer,
    RestroomSerializer,
    SensorReadingSerializer,
)


@api_view(["GET"])
def health(_request) -> Response:
    return Response(
        {
            "ok": True,
            "service": "csucc-smart-restroom-backend",
            "time": timezone.now().isoformat(),
            "buildings": Building.objects.count(),
            "restrooms": Restroom.objects.count(),
            "readings": SensorReading.objects.count(),
            "alerts": Alert.objects.count(),
            "active_alerts": Alert.objects.filter(acknowledged=False).count(),
            "cleanings": CleaningEvent.objects.count(),
            "predictions": AIPrediction.objects.count(),
        }
    )


@api_view(["GET"])
def list_buildings(_request) -> Response:
    return Response(BuildingSerializer(Building.objects.all(), many=True).data)


@api_view(["GET"])
def list_restrooms(_request) -> Response:
    qs = Restroom.objects.select_related("building").all()
    return Response(RestroomSerializer(qs, many=True).data)


@api_view(["GET"])
def snapshot(_request) -> Response:
    """Latest reading + prediction for every restroom (for initial frontend load)."""
    restrooms = Restroom.objects.select_related("building").all()
    out = []
    for r in restrooms:
        latest = r.readings.order_by("-t").first()
        if not latest:
            continue
        pred = r.predictions.order_by("-t").first()
        out.append(
            {
                "restroom": RestroomSerializer(r).data,
                "current": SensorReadingSerializer(latest).data,
                "prediction": AIPredictionSerializer(pred).data if pred else None,
            }
        )
    return Response(out)


@api_view(["GET"])
def list_readings(_request) -> Response:
    qs = SensorReading.objects.select_related("restroom").order_by("-t")[:500]
    return Response(SensorReadingSerializer(qs, many=True).data)


@api_view(["GET"])
def list_alerts(_request) -> Response:
    qs = Alert.objects.select_related("restroom__building").order_by("-t")[:200]
    return Response(AlertSerializer(qs, many=True).data)


@api_view(["GET"])
def list_cleanings(_request) -> Response:
    qs = CleaningEvent.objects.select_related("restroom__building").order_by("-t")[:200]
    return Response(CleaningEventSerializer(qs, many=True).data)


@api_view(["GET"])
def list_predictions(_request) -> Response:
    qs = AIPrediction.objects.select_related("restroom").order_by("-t")[:200]
    return Response(AIPredictionSerializer(qs, many=True).data)


@csrf_exempt
@api_view(["POST"])
def dispatch_janitor(request) -> Response:
    code = request.data.get("restroom") if hasattr(request, "data") else None
    if not code:
        return Response({"error": "restroom required"}, status=400)
    try:
        result = services.dispatch_janitor(code)
    except Restroom.DoesNotExist:
        return Response({"error": "restroom not found"}, status=404)
    return Response(result)


@csrf_exempt
@api_view(["POST"])
def inject_hazard(request) -> Response:
    level = (request.data.get("level") if hasattr(request, "data") else None) or "critical"
    if level not in ("hazardous", "critical"):
        return Response({"error": "level must be 'hazardous' or 'critical'"}, status=400)
    return Response(services.inject_demo_hazard(level=level))


@csrf_exempt
@api_view(["POST"])
def acknowledge_alert(request, alert_id: int) -> Response:
    try:
        a = Alert.objects.get(id=alert_id)
    except Alert.DoesNotExist:
        return Response({"error": "not found"}, status=404)
    a.acknowledged = True
    a.acknowledged_at = timezone.now()
    a.save(update_fields=["acknowledged", "acknowledged_at"])
    return Response(AlertSerializer(a).data)


def _sse_format(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n".encode()


def stream(_request) -> StreamingHttpResponse:
    """Server-Sent Events stream of simulation ticks."""

    def gen():
        q = services.subscribe()
        try:
            # Initial hello + snapshot.
            yield _sse_format("hello", {"ok": True, "ts": time.time()})
            last_keepalive = time.time()
            while True:
                try:
                    payload = q.get(timeout=10.0)
                    yield _sse_format("tick", payload)
                    last_keepalive = time.time()
                except Empty:
                    if time.time() - last_keepalive > 8:
                        yield b": ping\n\n"
                        last_keepalive = time.time()
        finally:
            services.unsubscribe(q)

    resp = StreamingHttpResponse(gen(), content_type="text/event-stream")
    resp["Cache-Control"] = "no-cache"
    resp["X-Accel-Buffering"] = "no"
    return resp


def _frontend_dir() -> Path | None:
    """Return the directory holding the Next.js static export, or None."""
    candidate = getattr(settings, "FRONTEND_OUT_DIR", None)
    if candidate:
        p = Path(candidate)
        if p.exists():
            return p
    fallback = Path(settings.BASE_DIR).parent / "out"
    return fallback if fallback.exists() else None


def _serve_frontend_file(path: str) -> HttpResponse:
    """Serve a single file from the Next.js static export."""
    root = _frontend_dir()
    if root is None:
        raise Http404("frontend not built")
    rel = (path or "").lstrip("/")
    candidates: list[Path] = []
    if rel:
        candidates.append(root / rel)
        candidates.append(root / f"{rel}.html")
        candidates.append(root / rel / "index.html")
    candidates.append(root / "index.html")
    for c in candidates:
        try:
            resolved = c.resolve()
        except OSError:
            continue
        if root.resolve() not in resolved.parents and resolved != root.resolve():
            continue
        if resolved.is_file():
            ctype, _ = mimetypes.guess_type(str(resolved))
            return FileResponse(resolved.open("rb"), content_type=ctype or "application/octet-stream")
    raise Http404(path)


def frontend(request, path: str = "") -> HttpResponse:
    """Catch-all that serves the Next.js static export."""
    return _serve_frontend_file(path)


def index(_request) -> HttpResponse:
    root = _frontend_dir()
    if root is not None and (root / "index.html").is_file():
        return _serve_frontend_file("")
    body = """<!doctype html>
<html><head><meta charset='utf-8'><title>CSUCC Smart Restroom Backend</title>
<style>body{background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif;padding:32px;max-width:900px;margin:0 auto;line-height:1.6}
h1{color:#67e8f9}code{background:#0f172a;padding:2px 6px;border-radius:4px;color:#fde047}
a{color:#22d3ee}ul{padding-left:18px}.api{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:14px}</style>
</head><body>
<h1>CSUCC Smart Restroom Air Quality Monitoring API</h1>
<p>Django REST + PostgreSQL backend for the CSUCC capstone project.
Simulation engine emits MQ135 / MQ136 / MQ137 readings every few seconds;
MLR + LSTM-style forecasts and severity-aware alerts are persisted and
broadcast via Server-Sent Events.</p>
<div class='api'><h3>Endpoints</h3><ul>
<li><a href='./health/'>GET /api/health/</a> &mdash; service status</li>
<li><a href='./buildings/'>GET /api/buildings/</a> &mdash; campus buildings</li>
<li><a href='./restrooms/'>GET /api/restrooms/</a> &mdash; restrooms</li>
<li><a href='./snapshot/'>GET /api/snapshot/</a> &mdash; current state of every restroom</li>
<li><a href='./readings/'>GET /api/readings/</a> &mdash; recent sensor readings</li>
<li><a href='./predictions/'>GET /api/predictions/</a> &mdash; MLR + LSTM predictions</li>
<li><a href='./alerts/'>GET /api/alerts/</a> &mdash; recent alerts</li>
<li><a href='./cleanings/'>GET /api/cleanings/</a> &mdash; cleaning events</li>
<li><code>POST /api/cleanings/dispatch/</code> &mdash; admin dispatches a janitor
   <code>{ "restroom": "&lt;code&gt;" }</code></li>
<li><code>POST /api/hazard/inject/</code> &mdash; demo hazard injection
   <code>{ "level": "hazardous" | "critical" }</code></li>
<li><code>POST /api/alerts/&lt;id&gt;/ack/</code> &mdash; acknowledge an alert</li>
<li><a href='./stream/'>GET /api/stream/</a> &mdash; SSE stream of realtime ticks</li>
</ul></div>
</body></html>"""
    return HttpResponse(body)
