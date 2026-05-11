"""Static campus topology — buildings and restrooms.

Mirrors `src/lib/buildings.ts` so the backend and frontend agree on coords,
building names, and per-restroom baselines.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BuildingSpec:
    code: str
    name: str
    short_name: str
    lat: float
    lng: float


CAMPUS_CENTER = (9.11765, 125.53435)

BUILDINGS: tuple[BuildingSpec, ...] = (
    BuildingSpec("mis", "MIS Building", "MIS", 9.11820, 125.53330),
    BuildingSpec("ceit", "CEIT Building", "CEIT", 9.11790, 125.53410),
    BuildingSpec("registrar", "Registrar", "REG", 9.11760, 125.53310),
    BuildingSpec("cba", "CBA Building", "CBA", 9.11730, 125.53400),
    BuildingSpec("acad", "ACAD Building", "ACAD", 9.11770, 125.53480),
    BuildingSpec("citte", "CITTE Building", "CITTE", 9.11700, 125.53350),
    BuildingSpec("cthm", "CTHM Building", "CTHM", 9.11825, 125.53510),
    BuildingSpec("gym", "Gymnasium", "GYM", 9.11680, 125.53520),
    BuildingSpec("complab", "Computer Laboratory", "CLAB", 9.11810, 125.53265),
    BuildingSpec("library", "Library", "LIB", 9.11750, 125.53445),
    BuildingSpec("clinic", "Clinic", "CLN", 9.11695, 125.53430),
    BuildingSpec("osas", "OSAS", "OSAS", 9.11740, 125.53250),
    BuildingSpec("oasfa", "OASFA", "OASFA", 9.11665, 125.53280),
)


def hash_baseline(s: str) -> float:
    """Deterministic 0..1 baseline — must match the JS implementation."""
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h / 0xFFFFFFFF


@dataclass(frozen=True)
class RestroomSpec:
    code: str
    building_code: str
    building_name: str
    restroom_type: str
    lat: float
    lng: float
    baseline: float


def all_restrooms() -> list[RestroomSpec]:
    out: list[RestroomSpec] = []
    for b in BUILDINGS:
        for t in ("Male", "Female"):
            off_lat = 0.00012 if t == "Male" else -0.00012
            off_lng = -0.00012 if t == "Male" else 0.00012
            code = f"{b.code}-{t.lower()}"
            out.append(
                RestroomSpec(
                    code=code,
                    building_code=b.code,
                    building_name=b.name,
                    restroom_type=t,
                    lat=b.lat + off_lat,
                    lng=b.lng + off_lng,
                    baseline=hash_baseline(code),
                )
            )
    return out
