"""Python port of the realtime sensor simulation.

The signal is driven by a daily traffic curve (people produce odor + CO2),
a weekly seasonality, a per-restroom personality, and an Ornstein–Uhlenbeck
random walk. The behaviour matches `src/lib/simulation.ts` on the frontend.
"""

from __future__ import annotations

import math
import random
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _traffic_level(t: datetime, baseline: float) -> float:
    """0..1 traffic level for a given timestamp."""
    local = t.astimezone()
    hour = local.hour + local.minute / 60.0
    dow = local.weekday()  # Mon=0..Sun=6
    weekend = 0.35 if dow >= 5 else 1.0

    def peak(h: float, mu: float, sigma: float) -> float:
        return math.exp(-((h - mu) ** 2) / (2 * sigma * sigma))

    morning = peak(hour, 9.5, 1.2)
    lunch = peak(hour, 12.5, 0.9)
    after = peak(hour, 15.5, 1.4)
    night_floor = 0.05

    base = night_floor + 1.05 * morning + 1.25 * lunch + 0.9 * after
    base *= 0.6 + baseline * 0.9
    base *= weekend
    return _clamp(base / 2.3, 0.0, 1.0)


@dataclass
class ReadingState:
    mq135: float
    mq136: float
    mq137: float
    temperature: float
    humidity: float
    last_reset_ms: int


def _next_ou(prev: float, target: float, theta: float, sigma: float) -> float:
    """dX = theta*(target - X)dt + sigma * dW"""
    return prev + theta * (target - prev) + sigma * (random.random() - 0.5) * 2.0


@dataclass
class Reading:
    t: datetime
    mq135: float
    mq136: float
    mq137: float
    temperature: float
    humidity: float
    odor: float
    air_quality: float


@dataclass
class CleaningRecord:
    t: datetime
    odor_before: float
    odor_after: float
    trigger: str  # 'scheduled' | 'reactive' | 'manual'
    duration_min: int


@dataclass
class TickResult:
    reading: Reading
    cleaning: CleaningRecord | None = None


@dataclass
class _StateRegistry:
    states: dict[str, ReadingState] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)


_REG = _StateRegistry()


def _round1(v: float) -> float:
    return round(v * 10) / 10


def tick_restroom(
    code: str,
    baseline: float,
    now: datetime,
    record_cleaning: bool = True,
) -> TickResult:
    """Produce the next reading for a restroom at time `now`."""
    with _REG.lock:
        s = _REG.states.get(code)
        if s is None:
            s = ReadingState(
                mq135=40 + baseline * 15,
                mq136=8 + baseline * 5,
                mq137=4 + baseline * 6,
                temperature=28 + baseline * 1.5,
                humidity=70 + baseline * 8,
                last_reset_ms=int(now.timestamp() * 1000),
            )
            _REG.states[code] = s

        traffic = _traffic_level(now, baseline)
        now_ms = int(now.timestamp() * 1000)
        since_reset_min = (now_ms - s.last_reset_ms) / 60000.0
        badness = s.mq137 + s.mq136 * 1.4
        clean_chance = max(0.0, badness - 25) / 1500.0
        if since_reset_min > 240:
            clean_chance += 0.01

        cleaning: CleaningRecord | None = None
        if random.random() < clean_chance:
            odor_before = _clamp(
                s.mq137 * 1.1 + s.mq136 * 1.0 + max(0, s.mq135 - 60) * 0.25, 0, 100
            )
            s.mq135 *= 0.45
            s.mq136 *= 0.35
            s.mq137 *= 0.3
            s.humidity = _clamp(s.humidity - 6, 55, 95)
            s.last_reset_ms = now_ms
            odor_after = _clamp(
                s.mq137 * 1.1 + s.mq136 * 1.0 + max(0, s.mq135 - 60) * 0.25, 0, 100
            )
            if record_cleaning:
                cleaning = CleaningRecord(
                    t=now,
                    odor_before=_round1(odor_before),
                    odor_after=_round1(odor_after),
                    trigger="reactive" if odor_before > 70 else "scheduled",
                    duration_min=int(round(8 + (odor_before / 100.0) * 22)),
                )

        target135 = 55 + traffic * 90 + baseline * 10
        target136 = 6 + traffic * 35 + baseline * 4
        target137 = 3 + traffic * 55 + baseline * 5
        target_temp = (
            27.5
            + traffic * 3
            + math.sin(now.astimezone().hour / 24.0 * math.pi * 2) * 1.2
        )
        target_hum = (
            72
            + traffic * 14
            + math.cos(now.astimezone().hour / 24.0 * math.pi * 2) * 3
        )

        s.mq135 = _clamp(_next_ou(s.mq135, target135, 0.18, 4), 0, 400)
        s.mq136 = _clamp(_next_ou(s.mq136, target136, 0.18, 2), 0, 200)
        s.mq137 = _clamp(_next_ou(s.mq137, target137, 0.18, 2.2), 0, 200)
        s.temperature = _clamp(_next_ou(s.temperature, target_temp, 0.25, 0.15), 20, 40)
        s.humidity = _clamp(_next_ou(s.humidity, target_hum, 0.25, 0.6), 30, 100)

        odor = _clamp(
            s.mq137 * 1.1 + s.mq136 * 1.0 + max(0, s.mq135 - 60) * 0.25, 0, 100
        )
        air = _clamp(
            100 - (s.mq137 * 1.2 + s.mq136 * 0.9 + max(0, s.mq135 - 50) * 0.2 + odor * 0.15),
            0,
            100,
        )

        return TickResult(
            reading=Reading(
                t=now,
                mq135=_round1(s.mq135),
                mq136=_round1(s.mq136),
                mq137=_round1(s.mq137),
                temperature=_round1(s.temperature),
                humidity=_round1(s.humidity),
                odor=_round1(odor),
                air_quality=_round1(air),
            ),
            cleaning=cleaning,
        )


def force_clean(code: str, baseline: float, now: datetime) -> TickResult:
    """Force-clean a restroom (acknowledged janitor dispatch)."""
    with _REG.lock:
        s = _REG.states.get(code)
        if s:
            s.mq135 *= 0.35
            s.mq136 *= 0.25
            s.mq137 *= 0.2
            s.humidity = _clamp(s.humidity - 8, 55, 95)
            s.last_reset_ms = int(now.timestamp() * 1000)
    tick = tick_restroom(code, baseline, now, record_cleaning=True)
    if tick.cleaning is not None:
        tick.cleaning.trigger = "manual"
    return tick


def inject_hazard(code: str, baseline: float, level: str = "critical") -> Reading:
    """Inject a hazard spike for live demo of the alerting pipeline."""
    with _REG.lock:
        s = _REG.states.get(code)
        if s is not None:
            if level == "critical":
                s.mq137 = 70
                s.mq136 = 38
                s.mq135 = 180
                s.humidity = _clamp(s.humidity + 8, 55, 100)
            else:
                s.mq137 = 45
                s.mq136 = 28
                s.mq135 = 140
                s.humidity = _clamp(s.humidity + 5, 55, 100)
    return tick_restroom(code, baseline, datetime.now(timezone.utc)).reading


def status_of(r: Reading) -> str:
    """Compute status string from a reading. Mirrors src/lib/status.ts."""
    if r.mq137 > 60 or r.odor > 92 or r.air_quality < 12:
        return "critical"
    if r.mq137 > 40 or r.odor > 80 or r.air_quality < 25 or r.mq136 > 35:
        return "hazardous"
    if r.mq137 > 22 or r.odor > 60 or r.air_quality < 45 or r.mq135 > 110:
        return "poor"
    if r.mq137 > 10 or r.odor > 35 or r.air_quality < 65:
        return "moderate"
    return "safe"


def seed_history(
    code: str, baseline: float, hours: float, step_seconds: int = 60
) -> list[Reading]:
    """Seed several hours of history for the database."""
    out: list[Reading] = []
    now = datetime.now(timezone.utc)
    steps = int(hours * 3600 / step_seconds)
    for i in range(steps, 0, -1):
        ts = datetime.fromtimestamp(now.timestamp() - i * step_seconds, tz=timezone.utc)
        out.append(tick_restroom(code, baseline, ts, record_cleaning=False).reading)
    return out
