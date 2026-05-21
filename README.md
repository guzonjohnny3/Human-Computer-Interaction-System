# CSUCC Smart Restroom Air Quality Monitoring System

An AI-powered, realtime smart-campus environmental monitoring platform for **Caraga State University — Cabadbaran City (CSUCC)**. The dashboard simulates **MQ135 / MQ136 / MQ137** IoT air-quality sensors deployed in male & female comfort rooms across every campus building, visualises them on an interactive Leaflet map, and runs **Multiple Linear Regression (MLR) + LSTM-inspired** forecasting to predict future restroom conditions.

![Tech](https://img.shields.io/badge/Next.js-16-black?logo=next.js) ![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss) ![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)

## Features

### Realtime IoT simulation
- **26 restroom sensor nodes** (13 buildings × Male + Female).
- 7 channels per node — MQ135, MQ136, MQ137, temperature, humidity, composite odor and air quality score.
- Ornstein–Uhlenbeck stochastic process driven by a daily traffic curve, weekly seasonality and per-restroom "personality" — values evolve smoothly like real sensors.
- Auto-tick every **5 seconds**; 3 hours of history is seeded on boot so the AI has data immediately.
- Simulated janitorial resets that drop readings dramatically when state degrades.

### Smart campus map (Leaflet)
- Dark-themed Carto basemap centred on CSUCC.
- 26 dynamic circle markers that change colour based on the current status:
  - 🟢 **Safe** — clean environment
  - 🟡 **Moderate** — moderate odor detected
  - 🟠 **Poor** — poor ventilation, strong odor
  - 🔴 **Hazardous** — dangerous ammonia concentration
  - ⚫ **Critical** — blinking, immediate sanitation required
- Building short-name labels, glowing markers, status legend.
- Click a marker to open a detail popup with all sensor values.

### AI prediction layer
- **Multiple Linear Regression** — closed-form OLS over 10 features (hour-of-day sin/cos, day-of-week sin/cos, temperature, humidity, MQ135, MQ136, MQ137 → odor). Reported R² shown as confidence.
- **LSTM-inspired recurrent forecaster** — gated exponential smoothing with cell / forget / output gates that projects the next hour of odor and blends in the hourly seasonal profile learnt from history.
- Outputs: 1-hour-ahead odor + status, peak smell hour, worst day of the week, predicted hazardous time window, natural-language narrative.

### Dashboard
- Glassmorphism dark-mode UI, ambient gradient backdrop, blueprint-grid overlay.
- Live status cards sorted worst-first, sparklines for every sensor.
- AI prediction cards (top 4 most-at-risk restrooms).
- Active alerts feed with status escalation events.
- Best / worst restroom rankings.
- Campus-wide analytics + per-restroom multi-sensor sparkline panel.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Map | Leaflet 1.9 (client-only via `next/dynamic`) |
| Charts | Custom SVG sparklines |
| Simulation + AI | In-browser TypeScript (no backend required) |

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The dashboard self-seeds with 3 hours of history; markers update every 5 seconds.

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build (writes static export to ./out)
npm run start   # serve production build
npm run lint    # eslint
```

## Running with the Django backend (full stack)

The repo also ships a Django REST backend (under `backend/`) that owns
the simulation, AI models, alerts, and authentication. To avoid CORS
preflight issues the Django app can serve the Next.js static export
directly (same origin):

```bash
# 1. Build the frontend static export
npm install
NEXT_PUBLIC_BACKEND_URL="" npm run build      # writes ./out

# 2. Boot the Django backend (it serves /api/* and / from ./out)
cd backend
uv sync                                       # one-time
uv run python manage.py migrate
CSUCC_FORCE_AUTOSTART=1 uv run python manage.py runserver 0.0.0.0:8000
```

Open <http://127.0.0.1:8000/> — login screen, sign-up, dashboard, map,
alerts and janitor flows all run end-to-end.

For ASGI deployment (e.g. Fly.io) use the FastAPI wrapper:
```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

Set `DATABASE_URL=postgres://…` to switch from SQLite to PostgreSQL.

## Project layout

```
src/
  app/
    page.tsx            # mounts the dashboard
    layout.tsx          # root layout (dark)
    globals.css         # tailwind + leaflet/popup/marker overrides
  components/
    Dashboard.tsx       # top-level grid composition
    CampusMap.tsx       # client-only Leaflet wrapper
    CampusMapInner.tsx  # actual Leaflet map + markers + popups
    Header.tsx          # status chips + live clock
    StatusCards.tsx     # live restroom status cards
    AIPanel.tsx         # AI prediction cards
    AlertFeed.tsx       # active alert stream
    Rankings.tsx        # worst / cleanest restroom rankings
    Analytics.tsx       # campus aggregates + per-restroom trends
    Sparkline.tsx       # tiny SVG line chart
  hooks/
    useRestroomData.ts  # realtime state + AI tick orchestration
  lib/
    buildings.ts        # 13 CSUCC buildings × Male/Female restrooms
    simulation.ts       # MQ135/136/137/temp/humidity/odor simulation
    ai.ts               # MLR + LSTM-inspired forecasting
    status.ts           # threshold → status mapping + theme tokens
    types.ts            # shared TS types
```

## Notes on the AI

The MLR coefficients are recomputed on every prediction sweep over the latest rolling history. The LSTM-inspired forecaster is a deterministic gated recurrent model (sigmoid forget / input / output gates and a tanh cell update) seeded from the trailing hidden state and combined with the empirically-learnt hourly seasonal profile — it is not a trained neural network, but the inference shape is identical to a 1-cell LSTM and the resulting trajectory is what drives the peak-hour and hazardous-window predictions.

## License

For academic use — © CSUCC.
