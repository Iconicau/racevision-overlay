"""
Tests for RelativeCalculator.
Covers gap math, S/F line wrap-around, window sizing, lap-time conversion, and edge cases.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from backend.calculations.relative import RelativeCalculator
from backend.state.race_state import RaceState, SessionState, CarState, RelativeCar

_TRACK_KM  = 5.0
_SPEED_KMH = 180.0        # → 50.0 m/s
_TRACK_M   = _TRACK_KM * 1000.0
_SPEED_MS  = _SPEED_KMH / 3.6

_calc = RelativeCalculator()


@pytest.fixture(autouse=True)
def _fresh_calc():
    """Reset the shared RelativeCalculator before each test.
    The median filter keeps per-car deque history that would otherwise bleed between tests."""
    global _calc
    _calc = RelativeCalculator()


def _state(cars: list[RelativeCar], speed: float = _SPEED_KMH, track_km: float = _TRACK_KM) -> RaceState:
    return RaceState(
        connected=True,
        track_length_km=track_km,
        session=SessionState(type="race", laps_remaining=10),
        car=CarState(speed=speed, lap=5, last_lap_time=90.0),
        cars=cars,
    )


def _car(*, idx: int, pct: float, is_player: bool = False, on_pit: bool = False) -> RelativeCar:
    return RelativeCar(
        car_idx=idx,
        car_number=str(idx),
        driver_name=f"D{idx}",
        car_class="GT3",
        lap_dist_pct=pct,
        is_player=is_player,
        on_pit_road=on_pit,
    )


def _gap(result: list[RelativeCar], idx: int) -> float:
    return next(c.gap_to_player for c in result if c.car_idx == idx)


# ── Basic gap sign ────────────────────────────────────────────────────────────

def test_car_ahead_positive_gap():
    player = _car(idx=0, pct=0.5, is_player=True)
    ahead  = _car(idx=1, pct=0.6)
    result = _calc.update(_state([player, ahead]))
    assert _gap(result, 1) > 0


def test_car_behind_negative_gap():
    player = _car(idx=0, pct=0.5, is_player=True)
    behind = _car(idx=1, pct=0.4)
    result = _calc.update(_state([player, behind]))
    assert _gap(result, 1) < 0


def test_player_gap_is_zero():
    player = _car(idx=0, pct=0.5, is_player=True)
    result = _calc.update(_state([player]))
    assert _gap(result, 0) == pytest.approx(0.0, abs=0.01)


# ── Gap magnitude ─────────────────────────────────────────────────────────────

def test_gap_magnitude_ahead():
    """Car 0.1 laps ahead: gap = 0.1 × last_lap_time = 9s."""
    player = _car(idx=0, pct=0.5, is_player=True)
    ahead  = _car(idx=1, pct=0.6)
    result = _calc.update(_state([player, ahead]))
    expected = 0.1 * 90.0   # delta_pct × ref_lap_time
    assert _gap(result, 1) == pytest.approx(expected, abs=0.1)


def test_gap_magnitude_behind():
    player = _car(idx=0, pct=0.5, is_player=True)
    behind = _car(idx=1, pct=0.4)
    result = _calc.update(_state([player, behind]))
    expected = -0.1 * 90.0
    assert _gap(result, 1) == pytest.approx(expected, abs=0.1)


def test_gap_uses_lap_time_not_track_length():
    """Gap is driven by lap time, not track length — same value on any circuit."""
    player = _car(idx=0, pct=0.5, is_player=True)
    ahead  = _car(idx=1, pct=0.6)
    gap_short = _gap(_calc.update(_state([player, ahead], track_km=2.0)), 1)
    gap_long  = _gap(_calc.update(_state([player, ahead], track_km=8.0)), 1)
    assert gap_short == pytest.approx(gap_long, abs=0.01)


# ── S/F line wrap-around ──────────────────────────────────────────────────────

def test_car_just_crossed_sf_is_ahead():
    """Player at 0.99, car just crossed S/F at 0.01 → car is AHEAD."""
    player       = _car(idx=0, pct=0.99, is_player=True)
    just_crossed = _car(idx=1, pct=0.01)
    result = _calc.update(_state([player, just_crossed]))
    assert _gap(result, 1) > 0


def test_car_about_to_cross_sf_is_behind():
    """Player at 0.01, car at 0.99 hasn't crossed yet → car is BEHIND."""
    player = _car(idx=0, pct=0.01, is_player=True)
    behind = _car(idx=1, pct=0.99)
    result = _calc.update(_state([player, behind]))
    assert _gap(result, 1) < 0


def test_wraparound_gap_magnitude():
    """Player at 0.95, car at 0.05: delta_pct=0.10 (wrap), gap = 0.10 × 90s = 9s."""
    player = _car(idx=0, pct=0.95, is_player=True)
    ahead  = _car(idx=1, pct=0.05)
    result = _calc.update(_state([player, ahead]))
    expected = 0.10 * 90.0
    assert _gap(result, 1) == pytest.approx(expected, abs=0.5)


def test_symmetry_around_sf_line():
    """Car 0.1 laps ahead whether measured normally or wrapping should give same gap."""
    # Normal case: player 0.3, car 0.4
    p1 = _car(idx=0, pct=0.3, is_player=True)
    a1 = _car(idx=1, pct=0.4)
    gap_normal = _gap(_calc.update(_state([p1, a1])), 1)

    # Wrap case: player 0.95, car 0.05
    p2 = _car(idx=0, pct=0.95, is_player=True)
    a2 = _car(idx=1, pct=0.05)
    gap_wrap = _gap(_calc.update(_state([p2, a2])), 1)

    assert gap_normal == pytest.approx(gap_wrap, abs=0.5)


# ── Window sizing ─────────────────────────────────────────────────────────────

def test_window_clips_to_ahead_count():
    player     = _car(idx=0, pct=0.5, is_player=True)
    ahead_cars = [_car(idx=i + 1, pct=0.5 + (i + 1) * 0.03) for i in range(6)]
    result = _calc.update(_state([player] + ahead_cars), ahead=3, behind=5)
    ahead_in_result = [c for c in result if c.gap_to_player > 0]
    assert len(ahead_in_result) <= 3


def test_window_clips_to_behind_count():
    player      = _car(idx=0, pct=0.5, is_player=True)
    behind_cars = [_car(idx=i + 1, pct=0.5 - (i + 1) * 0.03) for i in range(6)]
    result = _calc.update(_state([player] + behind_cars), ahead=5, behind=3)
    behind_in_result = [c for c in result if c.gap_to_player < 0]
    assert len(behind_in_result) <= 3


def test_result_ordered_most_ahead_first():
    player = _car(idx=0, pct=0.5, is_player=True)
    cars   = [
        _car(idx=1, pct=0.7),   # furthest ahead
        _car(idx=2, pct=0.6),   # closer ahead
        _car(idx=3, pct=0.4),   # behind
    ]
    result = _calc.update(_state([player] + cars))
    gaps   = [c.gap_to_player for c in result]
    assert gaps == sorted(gaps, reverse=True)


def test_player_included_in_window():
    player = _car(idx=0, pct=0.5, is_player=True)
    others = [_car(idx=i + 1, pct=0.5 + (i + 1) * 0.05) for i in range(3)]
    result = _calc.update(_state([player] + others))
    assert any(c.car_idx == 0 for c in result)


# ── Speed / lap-time behaviour ────────────────────────────────────────────────

def test_gap_independent_of_speed():
    """Gap is lap-time-based, so current speed has no effect on the result."""
    player = _car(idx=0, pct=0.5, is_player=True)
    ahead  = _car(idx=1, pct=0.6)
    gap_crawling = _gap(_calc.update(_state([player, ahead], speed=1.0)), 1)
    gap_full     = _gap(_calc.update(_state([player, ahead], speed=300.0)), 1)
    assert gap_crawling == pytest.approx(gap_full, abs=0.01)


# ── Pit road ─────────────────────────────────────────────────────────────────

def test_pit_car_included_in_result():
    """On-pit-road cars should still appear in the relative list."""
    player  = _car(idx=0, pct=0.5, is_player=True)
    pit_car = _car(idx=1, pct=0.49, on_pit=True)
    result  = _calc.update(_state([player, pit_car]))
    assert 1 in [c.car_idx for c in result]


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_no_player_returns_empty():
    cars = [_car(idx=0, pct=0.5), _car(idx=1, pct=0.6)]
    assert _calc.update(_state(cars)) == []


def test_disconnected_returns_empty():
    state = _state([_car(idx=0, pct=0.5, is_player=True)])
    state.connected = False
    assert _calc.update(state) == []


def test_single_car_is_player():
    player = _car(idx=0, pct=0.5, is_player=True)
    result = _calc.update(_state([player]))
    assert len(result) == 1
    assert result[0].gap_to_player == pytest.approx(0.0, abs=0.01)


def test_many_cars_no_crash():
    """50-car field should not crash or error."""
    player = _car(idx=0, pct=0.5, is_player=True)
    field  = [_car(idx=i + 1, pct=(0.5 + (i + 1) * 0.018) % 1.0) for i in range(49)]
    result = _calc.update(_state([player] + field))
    assert len(result) > 0   # should return a window, not crash


# ── Gap formula (pct-based) ───────────────────────────────────────────────────
# Gap = delta_pct × ref_lap_time, regardless of est_time or laps_completed.

def _car_with_est(*, idx: int, pct: float, laps: int, est: float, is_player: bool = False) -> RelativeCar:
    """Build a RelativeCar with est_time set (same class GT3)."""
    return RelativeCar(
        car_idx=idx, car_number=str(idx), driver_name=f"D{idx}",
        car_class="GT3", lap_dist_pct=pct, laps_completed=laps,
        is_player=is_player, est_time=est,
    )


def _car_class_est(*, idx: int, pct: float, laps: int, est: float, cls: str,
                   is_player: bool = False) -> RelativeCar:
    """Build a RelativeCar with a specific class and est_time."""
    return RelativeCar(
        car_idx=idx, car_number=str(idx), driver_name=f"D{idx}",
        car_class=cls, lap_dist_pct=pct, laps_completed=laps,
        is_player=is_player, est_time=est,
    )


def test_gap_formula_same_lap():
    """Same-class same-lap: gap = car_est - player_est (elapsed time, increases around track).
    Values chosen so est_time and pct formulas agree (9.0s each).
    pct=0.3 → elapsed=27s, pct=0.4 → elapsed=36s at 90s/lap."""
    player = _car_with_est(idx=0, pct=0.3, laps=5, est=27.0, is_player=True)
    ahead  = _car_with_est(idx=1, pct=0.4, laps=5, est=36.0)
    result = _calc.update(_state([player, ahead]))
    assert _gap(result, 1) == pytest.approx(9.0, abs=0.1)


def test_same_class_same_lap_uses_est_time():
    """When est_time diverges from pct × ref, same-class same-lap uses est_time."""
    # pct formula: 0.1 × 90 = 9.0  |  est formula: 38 - 27 = 11.0
    # player elapsed=27s (pct=0.3 × 90), ahead est=38s (slightly higher pace)
    player = _car_with_est(idx=0, pct=0.3, laps=5, est=27.0, is_player=True)
    ahead  = _car_with_est(idx=1, pct=0.4, laps=5, est=38.0)
    result = _calc.update(_state([player, ahead]))
    assert _gap(result, 1) == pytest.approx(11.0, abs=0.1)


def test_cross_class_same_lap_uses_pct():
    """Cross-class cars on the same lap use pct-based gap, not est_time.
    est_time values from different classes are incommensurable (different lap times)."""
    # est formula (if used) would give 38-27=11s; pct formula gives 0.1×90=9s
    player = _car_class_est(idx=0, pct=0.3, laps=5, est=27.0, cls="LMP2", is_player=True)
    gt3    = _car_class_est(idx=1, pct=0.4, laps=5, est=38.0, cls="GT3")
    result = _calc.update(_state([player, gt3]))
    assert _gap(result, 1) == pytest.approx(0.1 * 90.0, abs=0.1)


def test_gap_formula_ahead_positive_behind_negative():
    """Higher pct = ahead = positive gap; lower pct = behind = negative gap.
    Elapsed time: pct=0.5→45s, pct=0.6→54s (ahead), pct=0.4→36s (behind)."""
    player = _car_with_est(idx=0, pct=0.5, laps=5, est=45.0, is_player=True)
    ahead  = _car_with_est(idx=1, pct=0.6, laps=5, est=54.0)
    behind = _car_with_est(idx=2, pct=0.4, laps=5, est=36.0)
    result = _calc.update(_state([player, ahead, behind]))
    assert _gap(result, 1) > 0
    assert _gap(result, 2) < 0


def test_gap_not_affected_by_speed():
    """Gap must not change with different player speeds."""
    player = _car_with_est(idx=0, pct=0.5, laps=5, est=45.0, is_player=True)
    ahead  = _car_with_est(idx=1, pct=0.6, laps=5, est=54.0)
    gap_slow = _gap(_calc.update(_state([player, ahead], speed=30.0)), 1)
    gap_fast = _gap(_calc.update(_state([player, ahead], speed=300.0)), 1)
    assert gap_slow == pytest.approx(gap_fast, abs=0.01)


# ── Multiclass (regression: GT3 not appearing / wrong gaps) ──────────────────

def _car_laps(*, idx: int, pct: float, laps: int, is_player: bool = False) -> RelativeCar:
    return RelativeCar(
        car_idx=idx, car_number=str(idx), driver_name=f"D{idx}",
        car_class="GT3", lap_dist_pct=pct, laps_completed=laps, is_player=is_player,
    )


def test_multiclass_different_class_physically_ahead_shows_positive_gap():
    """GT3 physically ahead of LMP2 player (1 lap down in race) must have positive gap.
    The old laps_diff formula gave ~ -87s for this case, hiding the car entirely."""
    player = _car_laps(idx=0, pct=0.5, laps=4, is_player=True)
    gt3    = _car_laps(idx=1, pct=0.7, laps=3)   # 20% of track ahead, 1 lap down
    result = _calc.update(_state([player, gt3]))
    gap    = _gap(result, 1)
    assert gap > 0, f"GT3 physically ahead should have positive gap, got {gap}"
    assert gap == pytest.approx(0.2 * 90, abs=1.0)


def test_multiclass_different_class_physically_behind_shows_negative_gap():
    """GT3 physically behind LMP2 player (1 lap down) must have negative gap."""
    player = _car_laps(idx=0, pct=0.5, laps=4, is_player=True)
    gt3    = _car_laps(idx=1, pct=0.3, laps=3)   # 20% behind, 1 lap down
    result = _calc.update(_state([player, gt3]))
    gap    = _gap(result, 1)
    assert gap < 0, f"GT3 physically behind should have negative gap, got {gap}"


def test_multiclass_lapping_cars_appear_in_correct_section():
    """A lapping car (higher lap, physically behind) should have a negative gap
    (below the player in the relative), not a spuriously large positive gap."""
    player = _car_laps(idx=0, pct=0.5, laps=4, is_player=True)
    lapper = _car_laps(idx=1, pct=0.4, laps=5)   # physically 10% behind
    result = _calc.update(_state([player, lapper]))
    gap    = _gap(result, 1)
    assert gap < 0, f"Lapper physically behind should have negative gap, got {gap}"


# ── Lapped / lapping car always visible ──────────────────────────────────────

def test_lapping_car_shown_when_window_full():
    """A car 1 lap ahead must appear even when 5 same-lap cars fill the ahead window."""
    player   = _car_laps(idx=0, pct=0.5, laps=4, is_player=True)
    same_lap = [_car_laps(idx=i + 1, pct=0.5 + (i + 1) * 0.04, laps=4) for i in range(5)]
    lapper   = _car_laps(idx=99, pct=0.4, laps=5)   # 1 lap ahead, physically behind
    result   = _calc.update(_state([player] + same_lap + [lapper]), ahead=5, behind=5)
    assert any(c.car_idx == 99 for c in result)


def test_lapped_car_shown_when_window_full():
    """A car 1 lap behind must appear even when 5 same-lap cars fill the behind window."""
    player   = _car_laps(idx=0, pct=0.5, laps=5, is_player=True)
    same_lap = [_car_laps(idx=i + 1, pct=0.5 - (i + 1) * 0.04, laps=5) for i in range(5)]
    lapped   = _car_laps(idx=99, pct=0.6, laps=4)   # 1 lap behind, physically ahead
    result   = _calc.update(_state([player] + same_lap + [lapped]), ahead=5, behind=5)
    assert any(c.car_idx == 99 for c in result)


def test_same_lap_window_still_clipped():
    """Same-lap cars beyond the window limit are still excluded after lapped-car fix."""
    player     = _car(idx=0, pct=0.5, is_player=True)
    ahead_cars = [_car(idx=i + 1, pct=0.5 + (i + 1) * 0.03) for i in range(6)]
    result = _calc.update(_state([player] + ahead_cars), ahead=3, behind=5)
    ahead_in_result = [c for c in result if c.gap_to_player > 0]
    assert len(ahead_in_result) <= 3


def test_multiclass_only_closest_lapping_car_shown():
    """In a large field with 10 cars on a higher lap, only the closest one outside
    the normal window is appended — not all 10."""
    # Player at pct=0.5. 5 same-lap cars at 0.48–0.40 fill the behind window.
    # 10 lapping cars (laps+1) further behind at 0.38–0.20.
    # Only idx=100 (pct=0.38, closest outside the window) should be added.
    player   = _car_laps(idx=0,   pct=0.50, laps=4, is_player=True)
    same_lap = [_car_laps(idx=i+1, pct=0.50 - (i+1)*0.02, laps=4) for i in range(5)]
    lappers  = [_car_laps(idx=100+i, pct=0.38 - 0.02*i, laps=5) for i in range(10)]
    result   = _calc.update(_state([player] + same_lap + lappers), ahead=5, behind=5)
    lapper_idxs = [c.car_idx for c in result if c.car_idx >= 100]
    assert len(lapper_idxs) == 1, f"Expected 1 lapping car, got {len(lapper_idxs)}"
    assert lapper_idxs[0] == 100
