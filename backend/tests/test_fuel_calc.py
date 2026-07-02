"""
Tests for FuelCalculator (stateful per-lap burn tracker).
Simulates lap crossings by calling update() with advancing lap numbers.
No iRacing SDK required.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from backend.calculations.fuel import FuelCalculator
from backend.state.race_state import RaceState, FuelState, SessionState, CarState, RelativeCar


# ── Helper ────────────────────────────────────────────────────────────────────

def _state(
    lap: int,
    fuel: float,
    laps_remaining: int = 20,
    last_lap: float = 90.0,
    on_pit: bool = False,
    speed: float = 150.0,
    time_remaining: float = 0.0,
) -> RaceState:
    player = RelativeCar(car_idx=0, car_number="1", driver_name="P", car_class="GT3", is_player=True)
    state = RaceState(
        connected=True,
        fuel=FuelState(level=fuel, percent=fuel / 50.0),
        session=SessionState(
            type="race",
            laps_remaining=laps_remaining,
            time_remaining=time_remaining,
        ),
        car=CarState(
            lap=lap, speed=speed, last_lap_time=last_lap,
            best_lap_time=last_lap - 0.5, on_pit_road=on_pit,
        ),
        cars=[player],
    )
    return state


def _burn(calc: FuelCalculator, from_fuel: float, from_lap: int, n_laps: int = 1, burn: float = 2.3) -> tuple[float, int]:
    """Drive N clean laps and return (fuel_after, final_lap)."""
    fuel, lap = from_fuel, from_lap
    for _ in range(n_laps):
        calc.update(_state(lap, fuel))      # mid-lap tick
        lap  += 1
        fuel -= burn
        calc.update(_state(lap, fuel))      # lap crossing tick
    return fuel, lap


# ── Data collection ───────────────────────────────────────────────────────────

def test_first_tick_no_data():
    calc = FuelCalculator()
    r = calc.update(_state(1, 50.0))
    assert r.laps_sampled == 0
    assert r.burn_rate == 0.0


def test_one_complete_lap():
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    r = calc.update(_state(2, 47.7))
    assert r.laps_sampled == 1
    assert r.burn_rate == pytest.approx(2.3, abs=0.01)


def test_five_lap_rolling_average():
    calc = FuelCalculator()
    burns = [2.3, 2.5, 2.1, 2.4, 2.2]
    calc.update(_state(1, 50.0))
    fuel = 50.0
    for i, b in enumerate(burns, start=2):
        fuel -= b
        calc.update(_state(i, fuel))
    r = calc.update(_state(len(burns) + 2, fuel - 2.3))
    assert r.laps_sampled == 5
    assert r.burn_rate == pytest.approx(sum(burns) / len(burns), abs=0.05)


def test_rolling_window_drops_old_data():
    """After >5 laps, old burns drop out — recent average should shift."""
    calc = FuelCalculator()
    fuel, lap = 50.0, 1
    calc.update(_state(lap, fuel))
    # 5 laps at 2.0L
    fuel, lap = _burn(calc, fuel, lap, n_laps=5, burn=2.0)
    # 3 more laps at 3.5L
    fuel, lap = _burn(calc, fuel, lap, n_laps=3, burn=3.5)
    r = calc.update(_state(lap, fuel))
    # Window of 5: last 3 at 3.5, first 2 from old batch → avg > 2.0
    assert r.burn_rate > 2.5


# ── Surplus / deficit ─────────────────────────────────────────────────────────

def test_surplus_no_stop():
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    # need 5 × 2.3 = 11.5L, have 47.7L
    r = calc.update(_state(2, 47.7, laps_remaining=5))
    assert r.stops_required == 0
    assert r.laps_remaining_on_fuel > 5


def test_deficit_one_stop():
    calc = FuelCalculator()
    calc.update(_state(1, 10.0))
    # need 20 × 2.3 = 46L, have 7.7L → definitely need a stop
    r = calc.update(_state(2, 7.7, laps_remaining=20))
    assert r.stops_required >= 1


def test_can_save_stop_when_saveable():
    """1.3L short over 10 laps (0.13L/lap) should be flagged as saveable."""
    calc = FuelCalculator()
    # Start with 24L so crossing to 21.7L gives a clean 2.3L/lap burn rate.
    # 10 laps left: need 23L, have 21.7L → 1.3L deficit → exactly 1 stop needed.
    calc.update(_state(1, 24.0))
    r = calc.update(_state(2, 21.7, laps_remaining=10))
    assert r.stops_required == 1
    assert r.can_save_stop is True
    assert r.save_per_lap > 0


def test_cannot_save_stop_when_too_short():
    """Many laps short — saving isn't enough, must pit."""
    calc = FuelCalculator()
    calc.update(_state(1, 10.0))
    # need 46L, have 7.7L → 38.3L short → cannot save
    r = calc.update(_state(2, 7.7, laps_remaining=20))
    assert r.can_save_stop is False


# ── Pit stop contamination ────────────────────────────────────────────────────

def test_lap_crossing_while_pitting_excluded():
    """Lap crossing where car is on pit road must not count."""
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))               # initialise
    r = calc.update(_state(2, 47.7, on_pit=True))   # crossing, but on pit road
    assert r.laps_sampled == 0


def test_lap_crossing_when_lap_started_on_pit_excluded():
    """First lap after exiting pit (started from pit lane) must also be excluded."""
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))                       # normal
    calc.update(_state(1, 50.0, on_pit=True))          # entered pit mid-lap (no crossing yet)
    calc.update(_state(2, 50.0, on_pit=True))          # lap crossing while pitting
    calc.update(_state(2, 50.0, on_pit=False))         # exited pit (no crossing)
    r = calc.update(_state(3, 47.7, on_pit=False))     # first lap back — started from pit → excluded
    assert r.laps_sampled == 0


def test_second_clean_lap_after_pit_counts():
    """Second full clean lap after pit exit should count normally."""
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    calc.update(_state(1, 50.0, on_pit=True))
    calc.update(_state(2, 50.0, on_pit=True))
    calc.update(_state(2, 50.0, on_pit=False))
    calc.update(_state(3, 47.7, on_pit=False))   # first back (excluded)
    r = calc.update(_state(4, 45.4, on_pit=False))  # second back — should count
    assert r.laps_sampled >= 1
    assert r.burn_rate == pytest.approx(2.3, abs=0.05)


def test_refuel_jump_not_counted_as_negative_burn():
    """Fuel increasing between laps (pit refuel) must not produce a negative burn sample."""
    calc = FuelCalculator()
    calc.update(_state(1, 15.0))
    # Pit: refuel to 50L while crossing lap line
    r = calc.update(_state(2, 50.0, on_pit=True))
    assert r.laps_sampled == 0   # must not count this "lap"
    # Even if somehow the crossing slipped through, burn would be negative which is wrong
    if r.burn_rate != 0.0:
        assert r.burn_rate > 0


# ── Timed race ────────────────────────────────────────────────────────────────

def test_timed_race_uses_time_remaining():
    """When laps_remaining=0, fuel_to_finish should use time_remaining / last_lap_time."""
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    # 1800s remaining, 90s lap → 20 equivalent laps, burn=2.3 → need ~46L
    r = calc.update(_state(2, 47.7, laps_remaining=0, last_lap=90.0, time_remaining=1800.0))
    assert r.fuel_to_finish == pytest.approx(46.0, abs=2.0)


def test_iracing_sentinel_laps_uses_time():
    """laps_remaining=32767 is iRacing's sentinel for a timed race."""
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    r = calc.update(_state(2, 47.7, laps_remaining=32767, last_lap=90.0, time_remaining=900.0))
    # 900s / 90s = 10 laps → fuel_to_finish ≈ 23L
    assert r.fuel_to_finish == pytest.approx(23.0, abs=2.0)


# ── Scenarios ─────────────────────────────────────────────────────────────────

def test_scenarios_generated_when_deficit():
    """When car is short on fuel, save-scenario cards should be populated."""
    calc = FuelCalculator()
    # 24→21.7L gives burn_rate=2.3; need 23L for 10 laps; deficit=1.3L → scenarios generated.
    calc.update(_state(1, 24.0))
    r = calc.update(_state(2, 21.7, laps_remaining=10))
    assert len(r.scenarios) > 0


def test_no_scenarios_when_surplus():
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    r = calc.update(_state(2, 47.7, laps_remaining=5))
    assert r.scenarios == []


# ── Disconnected / reset ──────────────────────────────────────────────────────

def test_disconnected_returns_empty():
    calc = FuelCalculator()
    state = _state(1, 50.0)
    state.connected = False
    r = calc.update(state)
    assert r.laps_sampled == 0 and r.burn_rate == 0.0


def test_reconnect_starts_fresh():
    """Disconnecting and reconnecting should reset the burn history."""
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    calc.update(_state(2, 47.7))   # 1 lap sampled

    disc = _state(2, 47.7)
    disc.connected = False
    calc.update(disc)              # disconnect → reset

    calc.update(_state(1, 50.0))  # reconnect
    r = calc.update(_state(2, 47.7))
    assert r.laps_sampled == 1    # only the one lap since reconnect


def test_zero_lap_resets():
    """car.lap == 0 (garage/pre-race) should reset the calculator."""
    calc = FuelCalculator()
    calc.update(_state(1, 50.0))
    calc.update(_state(2, 47.7))
    r = calc.update(_state(0, 50.0))   # back in garage
    assert r.laps_sampled == 0


# ── Large field stress ────────────────────────────────────────────────────────

def test_many_laps_no_crash():
    """Run 30 laps through the calculator without error or negative burn rate."""
    calc = FuelCalculator()
    fuel, lap = 80.0, 1
    calc.update(_state(lap, fuel))
    for _ in range(30):
        lap  += 1
        fuel -= 2.3
        r = calc.update(_state(lap, max(0.0, fuel), laps_remaining=max(0, 35 - lap)))
    assert r.burn_rate > 0
    assert r.laps_sampled > 0
