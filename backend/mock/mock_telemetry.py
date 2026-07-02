"""
Replays synthetic telemetry so you can develop and test without iRacing running.
Simulates a multiclass endurance race (LMP2 + GT3) at Spa-Francorchamps.

Runs at 10× wall-clock speed — laps complete every ~11 real seconds so
the fuel widget populates within ~20 seconds of launch.

Race timeline (~220 real seconds total before auto-restart):
  0–66s real  → Normal racing; LMP2 gradually laps GT3 field (natural physics)
  66–81s real → LMP2 leader is 1 lap up on GT3 cars (laps_down=1 in standings)
  81–91s real → #88 Schumacher (GT3 P1) pits; #55 Vettel (LMP2 P5) pits
  120–220s    → Sprint finish; Hamilton (#33 LMP2 P3) battles player for P3/P4
  220s        → Race over — auto-restarts after 5s pause

Fuel scenario: 44L over 20 laps at 2.3L/lap.
  Total needed: 46L → 2L deficit → 0.10L/lap required
  LITE (0.04L) can't cover → ✗
  MED  (0.09L) can't cover → ✗
  AGG  (0.16L) covers with +1.2L spare → ✓ (recommended)
"""
from __future__ import annotations
import asyncio
import math
import time
import logging
from typing import Callable, Awaitable

from backend.state.race_state import (
    RaceState, FuelState, SessionState, CarState, DriverState, RelativeCar
)

logger = logging.getLogger(__name__)

POLL_HZ       = 30
POLL_INTERVAL = 1.0 / POLL_HZ

_TIME_SCALE        = 10.0   # 10× speed
_FUEL_CAPACITY     = 50.0
_STARTING_FUEL     = 44.0   # 2L short of what 20 laps × 2.3L/lap needs
_FUEL_BURN_PER_LAP = 2.3
_TOTAL_RACE_LAPS   = 20
_TRACK_KM          = 7.004  # Spa

_LMP2_LAP = 110.0   # simulated lap time (s)
_GT3_LAP  = 135.0

_PLAYER_CAR_IDX = 3  # player is car idx 3 (LMP2 #42 "Demo Driver")

_MOCK_CARS = [
    # idx, #,    name,              class,  color,      lap_time,  offset, pos, cls, irating, car_screen_name,          country
    (0,  "11", "A. Verstappen",     "LMP2", "#4fc3f7", _LMP2_LAP,  0.35,  1, 1, 3150, "Oreca 07 LMP2",          "NL"),
    (1,  "22", "C. Leclerc",        "LMP2", "#4fc3f7", _LMP2_LAP,  0.18,  2, 2, 2980, "Oreca 07 LMP2",          "MC"),
    (2,  "33", "L. Hamilton",       "LMP2", "#4fc3f7", _LMP2_LAP,  0.06,  3, 3, 2860, "Dallara P217 LMP2",      "GB"),
    (3,  "42", "Demo Driver",       "LMP2", "#4fc3f7", _LMP2_LAP,  0.00,  4, 4, 2850, "Oreca 07 LMP2",          "AU"),  # player
    (4,  "55", "S. Vettel",         "LMP2", "#4fc3f7", _LMP2_LAP, -0.08,  5, 5, 2720, "Dallara P217 LMP2",      "DE"),
    (5,  "66", "F. Alonso",         "LMP2", "#4fc3f7", _LMP2_LAP, -0.21,  6, 6, 2650, "Oreca 07 LMP2",          "ES"),
    (6,  "77", "N. Rosberg",        "LMP2", "#4fc3f7", _LMP2_LAP, -0.42,  7, 7, 2480, "Oreca 07 LMP2",          "DE"),
    # GT3 class
    (7,  "88", "M. Schumacher",     "GT3",  "#ef9a9a", _GT3_LAP,   0.28,  8, 1, 2420, "Ferrari 488 GT3",        "DE"),
    (8,  "99", "K. Raikkonen",      "GT3",  "#ef9a9a", _GT3_LAP,   0.14,  9, 2, 2350, "Porsche 911 GT3 R",      "FI"),
    (9,  "10", "D. Ricciardo",      "GT3",  "#ef9a9a", _GT3_LAP,   0.03, 10, 3, 2280, "McLaren 720S GT3",       "AU"),
    (10, "14", "J. Button",         "GT3",  "#ef9a9a", _GT3_LAP,  -0.05, 11, 4, 2200, "BMW M4 GT3",             "GB"),
    (11, "16", "V. Bottas",         "GT3",  "#ef9a9a", _GT3_LAP,  -0.19, 12, 5, 2150, "Mercedes-AMG GT3",       "FI"),
    (12, "18", "E. Ocon",           "GT3",  "#ef9a9a", _GT3_LAP,  -0.33, 13, 6, 2050, "Ferrari 488 GT3",        "FR"),
    (13, "20", "L. Norris",         "GT3",  "#ef9a9a", _GT3_LAP,  -0.48, 14, 7, 1980, "Porsche 911 GT3 R",      "GB"),
    (14, "23", "G. Russell",        "GT3",  "#ef9a9a", _GT3_LAP,  -0.62, 15, 8, 1900, "Lamborghini Huracan GT3","GB"),
]


def _mock_sof(cars: list, cls_filter: str | None = None) -> int:
    """Compute SOF from _MOCK_CARS using iRacing's logarithmic formula."""
    irs = [row[9] for row in cars if row[9] > 0 and (cls_filter is None or row[3] == cls_filter)]
    if len(irs) < 2:
        return 0
    n = len(irs)
    return round(1600.0 * math.log(n / sum(math.exp(-ir / 1600.0) for ir in irs)))


_MOCK_SOF_OVERALL = _mock_sof(_MOCK_CARS)
_MOCK_SOF_BY_CLASS = {
    "LMP2": _mock_sof(_MOCK_CARS, "LMP2"),
    "GT3":  _mock_sof(_MOCK_CARS, "GT3"),
}

# Sim-time windows (seconds) when a car is on pit road.
# Position is frozen at the moment they enter the pits.
# sim_elapsed = real_elapsed × _TIME_SCALE
_PIT_WINDOWS: dict[int, tuple[float, float]] = {
    7: (810.0, 845.0),    # #88 Schumacher (GT3 P1) pits at sim-lap ~6   (real ~81–84.5s)
    4: (880.0, 915.0),    # #55 Vettel    (LMP2 P5) pits at sim-lap ~8   (real ~88–91.5s)
}


class MockTelemetryConnector:
    def __init__(self, on_state_update: Callable[[RaceState], Awaitable[None]]) -> None:
        self._callback  = on_state_update
        self._running   = False
        self._start_time       = 0.0
        self._last_logged_lap  = -1
        self._lapping_logged   = False

    async def start(self) -> None:
        self._running    = True
        self._start_time = time.monotonic()
        logger.info("Mock telemetry connector started (10× speed, Spa 20-lap race)")
        await self._run_loop()

    async def stop(self) -> None:
        self._running = False

    async def _run_loop(self) -> None:
        tick = 0
        await asyncio.sleep(0.5)
        logger.info("[MOCK] iRacing connected — 15-car multiclass field | fuel: 44L / 46L needed")

        while self._running:
            tick += 1
            elapsed_real = time.monotonic() - self._start_time
            elapsed      = elapsed_real * _TIME_SCALE   # simulated race seconds

            # ── Race-over: auto-restart after a pause ──────────────────────────
            race_sim_length = _TOTAL_RACE_LAPS * _LMP2_LAP
            if elapsed >= race_sim_length + 50:   # 5 extra sim-seconds grace
                logger.info("[MOCK] Race finished — restarting in 5 real seconds...")
                await asyncio.sleep(5.0)
                self._start_time     = time.monotonic()
                self._last_logged_lap  = -1
                self._lapping_logged   = False
                tick = 0
                continue

            # ── Player state ───────────────────────────────────────────────────
            player_lap_time = _LMP2_LAP
            player_lap      = min(_TOTAL_RACE_LAPS + 1, int(elapsed / player_lap_time) + 1)
            player_pct      = (elapsed % player_lap_time) / player_lap_time
            laps_done       = max(0, player_lap - 1)
            laps_remaining  = max(0, _TOTAL_RACE_LAPS - laps_done)

            fuel_used   = (elapsed / player_lap_time) * _FUEL_BURN_PER_LAP
            fuel_level  = max(0.0, _STARTING_FUEL - fuel_used)
            speed_base  = 180.0 + 80.0 * abs(math.sin(player_pct * math.pi * 6))

            alt      = 1 if player_lap % 2 == 0 else -1
            last_lap = player_lap_time + alt * 0.35

            # ── Phase logging ─────────────────────────────────────────────────
            if player_lap != self._last_logged_lap:
                self._last_logged_lap = player_lap
                logger.info(
                    f"[MOCK] Lap {player_lap}/{_TOTAL_RACE_LAPS} "
                    f"| fuel={fuel_level:.1f}L "
                    f"| {laps_remaining} lap{'s' if laps_remaining != 1 else ''} to go"
                )

            # Log first time LMP2 leader laps the GT3 field
            lmp2_leader_laps = int((elapsed + 0.35 * _LMP2_LAP) / _LMP2_LAP)
            gt3_leader_laps  = int((elapsed + 0.28 * _GT3_LAP)  / _GT3_LAP)
            if not self._lapping_logged and lmp2_leader_laps > gt3_leader_laps:
                self._lapping_logged = True
                logger.info("[MOCK] LMP2 leader is now 1 lap up on GT3 — lapped traffic active")

            # ── Battle oscillation: Hamilton (#33, idx=2) fights player in late race
            # Kicks in after sim-second 1200 (real 120s) to simulate a close P3/P4 battle
            _BATTLE_START_SIM = 1200.0
            _BATTLE_AMP_PCT   = 0.013   # ±0.013 lap_pct ≈ ±1.8s gap at Spa

            # ── Build car list ─────────────────────────────────────────────────
            cars: list[RelativeCar] = []
            for idx, number, name, cls, color, lap_time, offset, pos, cls_pos, irating, car_screen_name, country_code in _MOCK_CARS:
                is_player = (idx == _PLAYER_CAR_IDX)

                pit_window = _PIT_WINDOWS.get(idx)
                in_pit = pit_window is not None and pit_window[0] <= elapsed <= pit_window[1]

                if in_pit:
                    # Freeze position at the moment they entered the pits
                    frozen_elapsed = pit_window[0] + offset * lap_time
                    car_pct  = (frozen_elapsed % lap_time) / lap_time
                    car_laps = int(frozen_elapsed / lap_time)
                    on_pit   = True
                else:
                    car_elapsed = elapsed + offset * lap_time
                    car_pct     = (car_elapsed % lap_time) / lap_time
                    car_laps    = int(car_elapsed / lap_time)
                    on_pit      = False

                # Late-race battle: Hamilton oscillates around the player
                if idx == 2 and elapsed > _BATTLE_START_SIM:
                    battle_phase = (elapsed - _BATTLE_START_SIM) * 0.08   # slow oscillation
                    car_pct = (car_pct + _BATTLE_AMP_PCT * math.sin(battle_phase)) % 1.0

                # Elapsed seconds in current lap (mirrors iRacing's CarIdxEstTime).
                # The real SDK value starts at 0 at the S/F line and increases as the car
                # progresses around the track. (1 - pct) was the old wrong assumption.)
                car_est_time = round(car_pct * lap_time, 3)

                # Stagger best lap times so standings show realistic FL variation
                best_lap = lap_time - 0.5 - idx * 0.08 if car_laps >= 1 else -1.0

                cars.append(RelativeCar(
                    car_idx         = idx,
                    car_number      = number,
                    driver_name     = name,
                    car_class       = cls,
                    class_color     = color,
                    position        = pos,
                    class_position  = cls_pos,
                    lap_dist_pct    = round(car_pct, 4),
                    laps_completed  = car_laps,
                    on_pit_road     = on_pit,
                    is_player       = is_player,
                    est_time        = round(car_est_time, 3),
                    irating         = irating,
                    best_lap_time   = round(best_lap, 3),
                    country_code    = country_code,
                    car_screen_name = car_screen_name,
                ))

            # ── Full state ─────────────────────────────────────────────────────
            state = RaceState(
                connected       = True,
                is_on_track     = True,
                tick            = tick,
                track_name      = "Spa-Francorchamps",
                track_length_km = _TRACK_KM,
                air_temp_c      = 22.5,
                track_temp_c    = 28.0,
                fuel=FuelState(
                    level   = round(fuel_level, 3),
                    percent = round(fuel_level / _FUEL_CAPACITY, 4),
                ),
                session=SessionState(
                    type           = "race",
                    time_remaining = max(0.0, race_sim_length - elapsed),
                    laps_remaining = laps_remaining,
                    laps_total     = _TOTAL_RACE_LAPS,
                    flags          = "green",
                ),
                car=CarState(
                    speed         = round(speed_base, 1),
                    gear          = min(7, max(1, int(speed_base / 40))),
                    rpm           = round(4000 + speed_base * 30, 0),
                    lap           = player_lap,
                    lap_dist_pct  = round(player_pct, 4),
                    last_lap_time = last_lap,
                    best_lap_time = player_lap_time - 0.8,
                    on_pit_road   = False,
                ),
                driver=DriverState(
                    name           = "Demo Driver",
                    car_number     = "42",
                    ir_rating      = 2850,
                    position       = 4,
                    class_position = 4,
                ),
                cars       = cars,
                sof        = _MOCK_SOF_OVERALL,
                class_sof  = _MOCK_SOF_BY_CLASS,
            )

            await self._callback(state)
            await asyncio.sleep(POLL_INTERVAL)
