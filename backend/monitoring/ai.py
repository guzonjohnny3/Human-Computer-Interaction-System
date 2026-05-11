"""AI prediction pipeline — Multiple Linear Regression + LSTM-style forecast.

Objectives 5 and 6 explicitly mention MLR for AQ prediction and LSTM for
forecasting future odor trends. We use:

- scikit-learn's LinearRegression for the MLR component (closed-form OLS).
- A deterministic LSTM-inspired gated recurrent forecaster (NumPy). This
  preserves the architecture-of-an-LSTM (input/forget/output gates +
  cell state) but uses fixed weights instead of training, so the demo
  doesn't depend on TensorFlow being installed. The same shape of model
  can be swapped for a trained Keras LSTM later — the AIPrediction record
  is fed from this function regardless.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

from .simulation import Reading


@dataclass
class Prediction:
    t: datetime
    predicted_odor_1h: float
    predicted_status_1h: str
    peak_hour: int
    worst_day: int
    hazardous_window: str
    narrative: str
    confidence: float


_WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _lstm_cell(
    x: np.ndarray, h_prev: np.ndarray, c_prev: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """One step of an LSTM cell with fixed (synthetic) weights."""
    n = h_prev.shape[0]
    rng = np.random.default_rng(seed=12345)
    Wf = rng.standard_normal((n, n + x.shape[0])) * 0.1
    Wi = rng.standard_normal((n, n + x.shape[0])) * 0.1
    Wo = rng.standard_normal((n, n + x.shape[0])) * 0.1
    Wc = rng.standard_normal((n, n + x.shape[0])) * 0.1
    bf, bi, bo, bc = (np.zeros(n) + 0.1,) * 4

    z = np.concatenate([h_prev, x])
    f = _sigmoid(Wf @ z + bf)
    i = _sigmoid(Wi @ z + bi)
    o = _sigmoid(Wo @ z + bo)
    c_hat = np.tanh(Wc @ z + bc)
    c = f * c_prev + i * c_hat
    h = o * np.tanh(c)
    return h, c


def _status_from_odor(odor: float) -> str:
    if odor >= 92:
        return "critical"
    if odor >= 80:
        return "hazardous"
    if odor >= 60:
        return "poor"
    if odor >= 35:
        return "moderate"
    return "safe"


def predict_for_history(history: list[Reading]) -> Prediction | None:
    """Run MLR + LSTM-style forecast on the recent history of a restroom."""
    if len(history) < 12:
        return None

    now = history[-1].t

    # ── MLR: predict instantaneous odor from (MQ135, MQ136, MQ137, hum, temp).
    X = np.array(
        [[h.mq135, h.mq136, h.mq137, h.humidity, h.temperature] for h in history]
    )
    y = np.array([h.odor for h in history])
    mlr = LinearRegression().fit(X, y)
    confidence = float(max(0.0, min(1.0, r2_score(y, mlr.predict(X)))))

    # ── LSTM-style forecast for 1-hour odor trajectory.
    hsize = 8
    h_state = np.zeros(hsize)
    c_state = np.zeros(hsize)
    for r in history[-24:]:  # warm up
        x = np.array([r.odor / 100.0, r.mq137 / 100.0, r.humidity / 100.0])
        h_state, c_state = _lstm_cell(x, h_state, c_state)

    # Roll forward 12 steps (each ≈5 min if sim tick is 5s × 60).
    last = history[-1]
    x = np.array([last.odor / 100.0, last.mq137 / 100.0, last.humidity / 100.0])
    forecast: list[float] = []
    for _ in range(12):
        h_state, c_state = _lstm_cell(x, h_state, c_state)
        # Project hidden state to a scalar odor in 0..100 via a fixed
        # readout combining hidden state mean with the latest signal.
        proj = float(0.5 * np.tanh(h_state.mean()) * 50 + 50 * x[0])
        proj = max(0.0, min(100.0, proj))
        forecast.append(proj)
        # use the projected odor as the next x[0], keeping the rest at the
        # last observation (a simple decoder).
        x = np.array([proj / 100.0, x[1], x[2]])

    predicted_odor_1h = forecast[-1]
    predicted_status_1h = _status_from_odor(predicted_odor_1h)

    # ── Peak hour + worst day across history (statistical summary).
    hours = np.array([h.t.astimezone().hour for h in history])
    odors = np.array([h.odor for h in history])
    peak_hour = int(hours[np.argmax(odors)])

    weekdays = np.array([h.t.astimezone().weekday() for h in history])
    if len(set(weekdays.tolist())) > 0:
        worst_day = int(
            sorted(
                set(weekdays.tolist()),
                key=lambda d: -float(odors[weekdays == d].mean()),
            )[0]
        )
    else:
        worst_day = 0

    # ── Hazardous window: roughly when the forecast crosses 70 in the next hour.
    hazardous_window = "no hazardous window predicted"
    for i, o in enumerate(forecast):
        if o >= 70:
            mins_from_now = (i + 1) * 5
            t = (datetime.now(timezone.utc) + timedelta(minutes=mins_from_now)).astimezone()
            hazardous_window = f"~{t.strftime('%H:%M')}"
            break

    narrative = (
        "Forecast holds at safe levels for the next hour."
        if predicted_status_1h in ("safe", "moderate")
        else f"Forecast predicts {predicted_status_1h} conditions within the next hour."
    )

    return Prediction(
        t=now,
        predicted_odor_1h=round(predicted_odor_1h, 1),
        predicted_status_1h=predicted_status_1h,
        peak_hour=peak_hour,
        worst_day=worst_day,
        hazardous_window=hazardous_window,
        narrative=narrative,
        confidence=round(confidence, 3),
    )


def weekday_label(idx: int) -> str:
    return _WEEKDAY_NAMES[idx % 7]
