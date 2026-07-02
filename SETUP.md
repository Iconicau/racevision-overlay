# RaceVision — Milestone 1 Setup

## Prerequisites
- Python 3.11+
- Node.js 20+

## Backend

```bash
# From the project root
pip install -r requirements.txt

# Run with mock telemetry (no iRacing needed)
$env:USE_MOCK="true"; python -m backend.main

# Run with live iRacing
python -m backend.main
```

API runs at http://127.0.0.1:8000
WebSocket at ws://127.0.0.1:8000/ws
Health check at http://127.0.0.1:8000/health

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:5173

## Verify it works

1. Start the backend with USE_MOCK=true
2. Start the frontend
3. Open http://localhost:5173 — you should see live mock data (Spa, Demo Driver, fuel draining)
4. WebSocket status badge should show "connected" in green
