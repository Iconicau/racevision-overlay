"""
Fuel strategy engine.

Per-lap burn tracking  →  rolling average burn rate
Pace correlation       →  measures actual lap-time cost of fuel saving after 4+ laps
Lookup table           →  estimates that cost from lap 1 using car class + track length
Scenario generation    →  three save targets (light / to-finish / aggressive) with cost
"""
from __future__ import annotations
from collections import deque

from backend.state.race_state import RaceState, FuelCalculation, SaveScenario

_ROLLING_WINDOW       = 5
_MIN_LAPS_FOR_CALC    = 1
_MIN_LAPS_FOR_PACE    = 4   # laps before correlation replaces lookup table

# Seconds of lap time lost per 0.1 L/lap saved, at a medium-length track (3–5 km).
# Based on typical iRacing lift-and-coast behaviour per car class.
_BASE_COST: dict[str, float] = {
    "GT3": 0.20,  "GTE": 0.20,  "GT4": 0.22,
    "GTD": 0.20,  "GTD PRO": 0.18,
    "LMP2": 0.14, "LMP3": 0.16, "GTP": 0.13,
    "DPI": 0.13,  "IMSA": 0.16,
    "PORSCHE": 0.24, "FERRARI": 0.20, "MCLAREN": 0.20,
    "NASCAR": 0.08,  "OVAL": 0.06,
}

def _track_mult(km: float) -> float:
    """Short, tight tracks cost more time per L saved; long straights are free."""
    if km <= 0:    return 1.0
    if km < 2.0:   return 2.0
    if km < 3.5:   return 1.4
    if km < 5.0:   return 1.0
    if km < 7.0:   return 0.75
    return 0.55


def _linreg_slope(xs: list[float], ys: list[float]) -> float | None:
    """OLS slope Δy/Δx.  Returns None when variance is too low to trust."""
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    ss_xx = sum((x - mx) ** 2 for x in xs)
    if ss_xx < 1e-8:
        return None
    ss_xy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return ss_xy / ss_xx


class FuelCalculator:
    def __init__(self) -> None:
        self._last_lap:                 int              = -1
        self._fuel_at_lap_start:        float | None     = None
        self._on_pit_at_lap_start:      bool             = False
        self._burn_history:             deque[float]     = deque(maxlen=_ROLLING_WINDOW)
        # (fuel_used_this_lap, lap_time) for pace-cost correlation
        self._pace_pairs:               deque[tuple[float, float]] = deque(maxlen=10)

    # ── Public ────────────────────────────────────────────────────────────────

    def update(self, state: RaceState) -> FuelCalculation:
        cur_lap  = state.car.lap
        cur_fuel = state.fuel.level
        on_pit   = state.car.on_pit_road

        if not state.connected or cur_lap == 0:
            self._reset()
            return FuelCalculation()

        # First valid tick: initialise
        if self._last_lap == -1:
            self._last_lap             = cur_lap
            self._fuel_at_lap_start    = cur_fuel
            self._on_pit_at_lap_start  = on_pit
            return FuelCalculation()

        # Lap crossing detected
        if cur_lap > self._last_lap and self._fuel_at_lap_start is not None:
            laps_crossed = cur_lap - self._last_lap
            fuel_used    = self._fuel_at_lap_start - cur_fuel
            lap_time     = state.car.last_lap_time

            valid = (
                fuel_used > 0
                and laps_crossed == 1
                and not self._on_pit_at_lap_start
                and not on_pit
            )
            if valid:
                self._burn_history.append(fuel_used)
                if lap_time > 0:
                    self._pace_pairs.append((fuel_used, lap_time))

            self._last_lap            = cur_lap
            self._fuel_at_lap_start   = cur_fuel
            self._on_pit_at_lap_start = on_pit

        return self._calculate(state)

    # ── Private ───────────────────────────────────────────────────────────────

    def _calculate(self, state: RaceState) -> FuelCalculation:
        n_samples = len(self._burn_history)
        if n_samples < _MIN_LAPS_FOR_CALC:
            return FuelCalculation(laps_sampled=n_samples)

        burn_rate = sum(self._burn_history) / n_samples
        if burn_rate <= 0:
            return FuelCalculation(laps_sampled=n_samples)

        cur_fuel       = state.fuel.level
        laps_on_fuel   = cur_fuel / burn_rate
        race_laps_left = float(state.session.laps_remaining)

        # Timed race: iRacing reports 32767 for unlimited/timed sessions.
        # Also handle 0 (mock / session not started).
        if race_laps_left == 0 or race_laps_left >= 32767:
            if state.session.time_remaining > 0 and state.car.last_lap_time > 0:
                race_laps_left = state.session.time_remaining / state.car.last_lap_time
            else:
                race_laps_left = 0.0

        fuel_to_finish = race_laps_left * burn_rate if race_laps_left > 0 else 0.0
        deficit        = fuel_to_finish - cur_fuel
        # Guard against cur_fuel == 0 (sensor glitch or tank empty)
        if deficit > 0 and cur_fuel > 0:
            stops_required = max(0, int(deficit / cur_fuel) + 1)
        else:
            stops_required = 0

        can_save_stop = False
        save_per_lap  = 0.0
        if stops_required == 1 and race_laps_left > 0:
            req = cur_fuel / race_laps_left
            if 0 < req < burn_rate:
                can_save_stop = True
                save_per_lap  = round(burn_rate - req, 3)

        # ── Time-cost estimation ──────────────────────────────────────────────
        player_car  = next((c for c in state.cars if c.is_player), None)
        car_class   = (player_car.car_class if player_car else "").strip().upper()
        track_km    = state.track_length_km

        measured          = False
        pace_cost_per_l   = None   # seconds per 1.0 L/lap saved

        # Attempt measured correlation once we have enough laps
        if len(self._pace_pairs) >= _MIN_LAPS_FOR_PACE:
            xs = [p[0] for p in self._pace_pairs]
            ys = [p[1] for p in self._pace_pairs]
            slope = _linreg_slope(xs, ys)
            # slope should be negative: more fuel burned → faster lap
            if slope is not None and slope < -0.15:
                pace_cost_per_l = -slope   # positive: s lost per L/lap saved
                measured        = True

        # Lookup table fallback (used from lap 1 until correlation is available)
        if pace_cost_per_l is None:
            base = next(
                (v for k, v in _BASE_COST.items() if k and car_class.startswith(k)),
                0.20,
            )
            pace_cost_per_l = (base / 0.1) * _track_mult(track_km)

        # ── Build scenarios ───────────────────────────────────────────────────
        scenarios = _build_scenarios(
            burn_rate, cur_fuel, race_laps_left,
            pace_cost_per_l, measured,
        )

        insight = _build_insight(
            burn_rate, laps_on_fuel, race_laps_left,
            stops_required, can_save_stop, save_per_lap,
        )

        return FuelCalculation(
            burn_rate                 = round(burn_rate, 3),
            laps_remaining_on_fuel    = round(laps_on_fuel, 1),
            fuel_to_finish            = round(fuel_to_finish, 1),
            stops_required            = stops_required,
            can_save_stop             = can_save_stop,
            save_per_lap              = save_per_lap,
            insight                   = insight,
            laps_sampled              = n_samples,
            scenarios                 = scenarios,
            pace_samples              = len(self._pace_pairs),
            time_cost_measured        = measured,
        )

    def _reset(self) -> None:
        self._last_lap            = -1
        self._fuel_at_lap_start   = None
        self._on_pit_at_lap_start = False
        self._burn_history.clear()
        self._pace_pairs.clear()


# ── Scenario builder ──────────────────────────────────────────────────────────

# (finish buffer target in litres, label, outcome template)
_TIERS = [
    ("Light save",      0.3,  "Avoids stop, {spare:.1f}L spare"),
    ("Medium save",     1.5,  "Comfortable — {spare:.1f}L margin"),
    ("Aggressive save", 3.0,  "Very safe — {spare:.1f}L buffer"),
]


def _build_scenarios(
    burn: float,
    fuel: float,
    laps: float,
    pace_cost_per_l: float,
    measured: bool,
) -> list[SaveScenario]:
    """Always generate exactly 3 tiers (light / medium / aggressive) when saving is relevant."""
    if laps <= 0 or burn <= 0:
        return []

    deficit = burn * laps - fuel   # positive = need to save, negative = surplus

    # Nothing to show if there's already a large surplus
    if deficit <= 0:
        return []

    scenarios: list[SaveScenario] = []
    for label, target_spare, outcome_tmpl in _TIERS:
        save = (deficit + target_spare) / laps
        if save < 0.01 or save > 1.1:   # skip unrealistic rates
            continue
        cost        = round(save * pace_cost_per_l, 2)
        spare       = fuel - (burn - save) * laps
        outcome     = outcome_tmpl.format(spare=spare)
        scenarios.append(SaveScenario(
            label              = label,
            save_rate          = round(save, 3),
            time_cost          = cost,
            time_cost_measured = measured,
            outcome            = outcome,
        ))

    return scenarios


def _build_insight(
    burn: float, laps_on_fuel: float, race_laps_left: float,
    stops: int, can_save: bool, save_rate: float,
) -> str:
    if race_laps_left <= 0:
        return f"Burning {burn:.2f}L/lap — {laps_on_fuel:.1f} laps on current fuel."
    if stops == 0:
        surplus = laps_on_fuel - race_laps_left
        return f"Fuel OK — {surplus:.1f} laps to spare at current burn."
    if can_save:
        return f"Save {save_rate:.2f}L/lap to avoid an extra stop."
    return f"{stops} more pit stop{'s' if stops > 1 else ''} required."
