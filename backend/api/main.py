"""
FastAPI application with a single WebSocket endpoint.
Broadcasts RaceState JSON to all connected frontend clients on every telemetry tick.
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.state.race_state import RaceState
from backend.calculations.fuel import FuelCalculator
from backend.calculations.fuel_strategy import FuelSavingDeltaEngine
from backend.calculations.relative import RelativeCalculator
from backend.calculations.standings import StandingsCalculator
from backend.db.database import init_db
from backend.api.settings_routes import router as settings_router, _load as load_settings
from backend.telemetry.track_recorder import TrackRecorder
from backend.telemetry.svg_track import load_track, has_track

logger = logging.getLogger(__name__)

# Shared state — the latest snapshot from telemetry
_current_state: RaceState = RaceState(connected=False)
_connected_clients: set[WebSocket] = set()
_fuel_calculator = FuelCalculator()
_fuel_strategy_engine = FuelSavingDeltaEngine()
_relative_calculator = RelativeCalculator()
_standings_calculator = StandingsCalculator()
_track_recorder = TrackRecorder()
_svg_cache: dict[int, list[list[float]]] = {}   # track_id → path


async def broadcast(state: RaceState) -> None:
    """Called by the telemetry connector on every tick."""
    global _current_state

    # Run calculation engine before broadcasting
    _settings = load_settings()
    state.fuel_calc = _fuel_calculator.update(state)

    # Fuel strategy — derive car class from player car, then run profile engine
    player_car = next((c for c in state.cars if c.is_player), None)
    car_class  = (player_car.car_class if player_car else "").strip().upper()
    state.fuel_strategy = _fuel_strategy_engine.calculate(
        state.fuel_calc, car_class, state.track_length_km
    )

    state.relative = _relative_calculator.update(
        state,
        ahead=_settings.relative_ahead,
        behind=_settings.relative_behind,
    )
    state.standings = _standings_calculator.update(state)

    # Track path — SVG for outline, dead-reckoning recorder for accurate car placement
    if state.connected and state.track_name:
        tid = state.track_id

        # Load SVG outline once (visual shape only)
        if tid and has_track(tid):
            if tid not in _svg_cache:
                _svg_cache[tid] = load_track(tid)
            state.track_outline = _svg_cache[tid]

        # Always run the recorder for accurate car dot placement
        if state.track_name != _track_recorder._track_name:
            _track_recorder.load_for_track(state.track_name)
        path, recording = _track_recorder.update(
            lap_dist_pct=state.car.lap_dist_pct,
            yaw=state.car.yaw,
            speed_ms=state.car.speed / 3.6,
        )
        state.track_path = path
        state.track_path_recording = recording

    _current_state = state

    if not _connected_clients:
        return

    payload = state.model_dump_json()
    dead: set[WebSocket] = set()

    for client in _connected_clients:
        try:
            await client.send_text(payload)
        except Exception:
            dead.add(client)

    _connected_clients.difference_update(dead)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    init_db()
    use_mock = os.getenv("USE_MOCK", "false").lower() == "true"

    if use_mock:
        from backend.mock.mock_telemetry import MockTelemetryConnector
        connector = MockTelemetryConnector(on_state_update=broadcast)
        logger.info("Starting in MOCK mode")
    else:
        from backend.telemetry.connector import TelemetryConnector
        connector = TelemetryConnector(on_state_update=broadcast)
        logger.info("Starting with live iRacing SDK")

    task = asyncio.create_task(connector.start())

    yield

    await connector.stop()
    task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(title="RaceVision API", version="0.1.0", lifespan=lifespan)

    app.include_router(settings_router)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "connected": _current_state.connected}

    @app.get("/state")
    async def get_state() -> RaceState:
        """One-shot snapshot — useful for initial page load."""
        return _current_state

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        await websocket.accept()
        _connected_clients.add(websocket)
        logger.info(f"Frontend connected. Clients: {len(_connected_clients)}")

        # Send current state immediately on connect
        await websocket.send_text(_current_state.model_dump_json())

        try:
            while True:
                # Keep connection alive; all data flows server→client
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            _connected_clients.discard(websocket)
            logger.info(f"Frontend disconnected. Clients: {len(_connected_clients)}")

    return app


app = create_app()
