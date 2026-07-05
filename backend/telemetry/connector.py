"""
Manages the iRacing SDK connection lifecycle.
Polls at ~60Hz, detects connect/disconnect, and calls the provided state callback.
No calculations. No UI. No widget logic.
"""
from __future__ import annotations
import asyncio
import logging
import time
from typing import Callable, Awaitable

import irsdk

from backend.state.race_state import RaceState, RelativeCar, TyreState
from backend.telemetry.reader import build_race_state

logger = logging.getLogger(__name__)

POLL_HZ = 60
POLL_INTERVAL = 1.0 / POLL_HZ
RECONNECT_INTERVAL = 5.0  # seconds between reconnect attempts when iRacing is closed


class TelemetryConnector:
    def __init__(self, on_state_update: Callable[[RaceState], Awaitable[None]]) -> None:
        self._callback = on_state_update
        self._ir = irsdk.IRSDK()
        self._running = False
        self._tick = 0
        self._last_car_idx: int = -1                       # detect mid-session car swaps
        self._last_cars: dict[int, RelativeCar] = {}       # persistence for out-of-bubble cars
        self._last_valid_tyre: TyreState = TyreState()     # LFtempCM etc. return 0 while many cars are driving

    async def start(self) -> None:
        self._running = True
        logger.info("Telemetry connector started")
        await self._run_loop()

    async def stop(self) -> None:
        self._running = False
        self._ir.shutdown()
        logger.info("Telemetry connector stopped")

    async def _run_loop(self) -> None:
        connected = False

        while self._running:
            try:
                if not self._ir.is_initialized or not self._ir.is_connected:
                    if connected:
                        logger.info("iRacing disconnected — resetting SDK variable cache")
                        connected = False
                        self._last_car_idx = -1
                        self._last_cars = {}
                        self._last_valid_tyre = TyreState()
                        await self._callback(RaceState(connected=False))
                        # shutdown() clears the cached variable offsets so that
                        # startup() re-reads them fresh.  Without this, changing
                        # cars in a test session can leave stale offsets that make
                        # FuelLevel read from the wrong memory slot (e.g. RPM data).
                        self._ir.shutdown()

                    self._ir.startup()

                    if not self._ir.is_initialized:
                        await asyncio.sleep(RECONNECT_INTERVAL)
                        continue

                if not connected:
                    logger.info("iRacing connected")
                    connected = True
                    self._last_car_idx = -1

                self._ir.freeze_var_buffer_latest()

                # Detect car change even when iRacing doesn't drop the connection
                # (e.g. swapping cars in test-drive mode).  A changed PlayerCarIdx
                # means variable offsets may have shifted; force a clean re-init.
                cur_car_idx = self._ir["PlayerCarIdx"] or 0
                if self._last_car_idx != -1 and cur_car_idx != self._last_car_idx:
                    logger.info(
                        "Car change detected (idx %d → %d) — re-initialising SDK",
                        self._last_car_idx, cur_car_idx,
                    )
                    connected = False
                    self._last_car_idx = -1
                    self._last_cars = {}
                    self._last_valid_tyre = TyreState()
                    self._ir.shutdown()
                    await self._callback(RaceState(connected=False))
                    await asyncio.sleep(1.0)   # let iRacing finish loading the new car
                    continue
                self._last_car_idx = cur_car_idx

                self._tick += 1
                state = build_race_state(self._ir, self._tick, self._last_cars)
                # Update persistence cache with only fresh (non-stale) entries.
                # Stale cars already came from the cache — don't double-cache them.
                self._last_cars = {c.car_idx: c for c in state.cars if not c.is_stale}

                # LFtempCM / RFtempCM etc. return 0 while many cars are actively driving —
                # iRacing only commits real values when the car pits or exits. Persist the
                # last valid reading so the tyre widget always shows the most recent data.
                tyre = state.tyre
                if tyre.lf_temp > 0 or tyre.rf_temp > 0 or tyre.lr_temp > 0 or tyre.rr_temp > 0:
                    self._last_valid_tyre = tyre
                elif self._last_valid_tyre.lf_temp > 0:
                    state.tyre = self._last_valid_tyre

                await self._callback(state)

            except Exception:
                logger.exception("Telemetry loop error — retrying in %ss", RECONNECT_INTERVAL)
                connected = False
                self._last_car_idx = -1
                self._last_cars = {}
                self._last_valid_tyre = TyreState()
                self._ir.shutdown()
                # Notify frontend so it shows "offline" instead of freezing on last state
                try:
                    await self._callback(RaceState(connected=False))
                except Exception:
                    pass
                await asyncio.sleep(RECONNECT_INTERVAL)
                continue

            await asyncio.sleep(POLL_INTERVAL)
