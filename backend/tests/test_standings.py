"""
Tests for StandingsCalculator and _calc_ir_changes.
No iRacing, no server — plain Python inputs only.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from backend.calculations.standings import StandingsCalculator, _calc_ir_changes
from backend.state.race_state import (
    RaceState, SessionState, CarState, RelativeCar, StandingsCar,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _state(cars: list[RelativeCar], session_type: str = "race", last_lap: float = 90.0) -> RaceState:
    return RaceState(
        connected=True,
        session=SessionState(type=session_type, laps_remaining=20),
        car=CarState(last_lap_time=last_lap, lap=5),
        cars=cars,
    )


def _car(
    *,
    idx: int,
    cls: str = "GT3",
    pos: int = 1,
    cls_pos: int = 1,
    laps: int = 10,
    pct: float = 0.5,
    irating: int = 2000,
    on_pit: bool = False,
    is_player: bool = False,
    best_lap: float = 90.0,
) -> RelativeCar:
    return RelativeCar(
        car_idx=idx,
        car_number=str(idx),
        driver_name=f"Driver {idx}",
        car_class=cls,
        class_color="#ffffff",
        position=pos,
        class_position=cls_pos,
        laps_completed=laps,
        lap_dist_pct=pct,
        irating=irating,
        on_pit_road=on_pit,
        is_player=is_player,
        best_lap_time=best_lap,
        last_lap_time=best_lap + 0.5,
    )


def _sc(idx: int, cls: str, cls_pos: int, pos: int, ir: int) -> StandingsCar:
    return StandingsCar(car_idx=idx, car_class=cls, class_position=cls_pos, position=pos, irating=ir)


_calc = StandingsCalculator()


# ── Ghost / inactive car filtering ───────────────────────────────────────────

def test_ghost_car_excluded():
    """Position=0 + laps=0 is an unused slot — must be filtered."""
    real  = _car(idx=0, pos=1, laps=5)
    ghost = RelativeCar(car_idx=99, car_number="", driver_name="", position=0, laps_completed=0)
    result = _calc.update(_state([real, ghost]))
    assert 99 not in [c.car_idx for c in result]


def test_zero_laps_with_position_kept():
    """A car with pos>0 but 0 laps (race start) should still appear."""
    car = _car(idx=0, pos=1, laps=0, pct=0.0)
    assert len(_calc.update(_state([car]))) == 1


def test_formation_lap_cars_shown():
    """Before the start, CarIdxLapCompleted=-1 and CarIdxPosition=0 — cars must appear."""
    # Simulate a full field on the formation lap: position=0, laps=-1
    p1 = _car(idx=0, pos=0, cls_pos=0, laps=-1, pct=0.80)
    p2 = _car(idx=1, pos=0, cls_pos=0, laps=-1, pct=0.60)
    p3 = _car(idx=2, pos=0, cls_pos=0, laps=-1, pct=0.40, is_player=True)
    result = _calc.update(_state([p1, p2, p3]))
    assert len(result) == 3
    # Should be ordered by track position: p1 furthest around → assigned P1
    assert result[0].car_idx == 0
    assert result[1].car_idx == 1
    assert result[2].car_idx == 2


def test_formation_lap_ghost_still_excluded():
    """Unused slot (position=0, laps=0) must still be filtered even with formation lap fix."""
    real  = _car(idx=0, pos=0, laps=-1, pct=0.5)
    ghost = RelativeCar(car_idx=99, car_number="", driver_name="", position=0, laps_completed=0)
    result = _calc.update(_state([real, ghost]))
    assert len(result) == 1
    assert result[0].car_idx == 0


def test_ghost_does_not_create_phantom_class():
    """Ghost car must not appear as its own class in a multiclass race."""
    real  = _car(idx=0, cls="GT3",  pos=1, cls_pos=1, laps=5)
    ghost = RelativeCar(car_idx=99, car_class="", position=0, laps_completed=0)
    result = _calc.update(_state([real, ghost]))
    classes = {c.car_class for c in result}
    assert "" not in classes


# ── Sorting ───────────────────────────────────────────────────────────────────

def test_race_sorted_by_laps_then_pct():
    """Primary sort: laps desc; secondary: pct desc."""
    leader = _car(idx=0, pos=1, laps=10, pct=0.8)
    second = _car(idx=1, pos=2, laps=10, pct=0.5)
    lapped = _car(idx=2, pos=3, laps=9,  pct=0.9)
    result = _calc.update(_state([lapped, second, leader]))
    assert [c.car_idx for c in result] == [0, 1, 2]


def test_positions_assigned_sequentially():
    cars = [_car(idx=i, pos=i + 1, laps=10 - i, pct=0.5) for i in range(5)]
    result = _calc.update(_state(cars))
    assert [c.position for c in result] == [1, 2, 3, 4, 5]


def test_leader_always_position_one():
    cars = [_car(idx=i, pos=i + 1, laps=10 - i, pct=0.5) for i in range(3)]
    result = _calc.update(_state(cars))
    assert result[0].position == 1


# ── Laps down ─────────────────────────────────────────────────────────────────

def test_laps_down_zero_for_lead_lap():
    leader = _car(idx=0, pos=1, laps=10, pct=0.7)
    second = _car(idx=1, pos=2, laps=10, pct=0.3)
    result = _calc.update(_state([leader, second]))
    assert result[0].laps_down == 0
    assert result[1].laps_down == 0


def test_laps_down_one():
    leader = _car(idx=0, pos=1, laps=10, pct=0.5)
    lapped = _car(idx=1, pos=2, laps=9,  pct=0.9)
    result = _calc.update(_state([leader, lapped]))
    assert result[1].laps_down == 1


def test_laps_down_two():
    leader   = _car(idx=0, pos=1, laps=12, pct=0.5)
    two_down = _car(idx=1, pos=2, laps=10, pct=0.3)
    result = _calc.update(_state([leader, two_down]))
    assert result[1].laps_down == 2


# ── Gap calculations ──────────────────────────────────────────────────────────

def test_gap_to_leader_formula():
    """gap = (leader_pct - car_pct) × last_lap_time."""
    leader = _car(idx=0, pos=1, laps=10, pct=0.8)
    second = _car(idx=1, pos=2, laps=10, pct=0.6)
    result = _calc.update(_state([leader, second], last_lap=100.0))
    assert result[1].gap_to_leader == pytest.approx(20.0, abs=0.1)


def test_gap_to_leader_zero_for_leader():
    result = _calc.update(_state([_car(idx=0, pos=1, laps=10, pct=0.8)]))
    assert result[0].gap_to_leader == 0.0


def test_gap_to_ahead():
    a = _car(idx=0, pos=1, laps=10, pct=0.9)
    b = _car(idx=1, pos=2, laps=10, pct=0.6)
    c = _car(idx=2, pos=3, laps=10, pct=0.3)
    result = _calc.update(_state([a, b, c], last_lap=100.0))
    # b's gap to a: 0.3 × 100 = 30s; c's gap to b: 0.3 × 100 = 30s
    assert result[1].gap_to_ahead == pytest.approx(30.0, abs=0.1)
    assert result[2].gap_to_ahead == pytest.approx(30.0, abs=0.1)


def test_gaps_zero_for_lapped_car():
    leader = _car(idx=0, pos=1, laps=10, pct=0.5)
    lapped = _car(idx=1, pos=2, laps=9,  pct=0.9)
    result = _calc.update(_state([leader, lapped]))
    assert result[1].gap_to_leader == 0.0
    assert result[1].gap_to_ahead  == 0.0


# ── Multiclass ────────────────────────────────────────────────────────────────

def test_multiclass_class_positions_preserved():
    cars = [
        _car(idx=0, cls="LMP2", pos=1, cls_pos=1, laps=10, pct=0.8),
        _car(idx=1, cls="LMP2", pos=2, cls_pos=2, laps=10, pct=0.5),
        _car(idx=2, cls="GT3",  pos=3, cls_pos=1, laps=9,  pct=0.9),
        _car(idx=3, cls="GT3",  pos=4, cls_pos=2, laps=9,  pct=0.6),
    ]
    result = _calc.update(_state(cars))
    by_idx = {c.car_idx: c for c in result}
    assert by_idx[0].class_position == 1
    assert by_idx[1].class_position == 2
    assert by_idx[2].class_position == 1
    assert by_idx[3].class_position == 2


def test_multiclass_overall_order_spans_classes():
    lmp2 = _car(idx=0, cls="LMP2", pos=1, cls_pos=1, laps=10, pct=0.8)
    gt3  = _car(idx=1, cls="GT3",  pos=2, cls_pos=1, laps=10, pct=0.4)
    result = _calc.update(_state([lmp2, gt3]))
    assert result[0].position == 1
    assert result[1].position == 2


def test_lapped_class_gets_laps_down_relative_to_overall_leader():
    """GT3 car 1 lap behind the LMP2 leader should show laps_down=1."""
    lmp2_leader = _car(idx=0, cls="LMP2", pos=1, cls_pos=1, laps=10, pct=0.5)
    gt3_lapped  = _car(idx=1, cls="GT3",  pos=2, cls_pos=1, laps=9,  pct=0.7)
    result = _calc.update(_state([lmp2_leader, gt3_lapped]))
    by_idx = {c.car_idx: c for c in result}
    assert by_idx[1].laps_down == 1


# ── iRating ───────────────────────────────────────────────────────────────────

def test_ir_equal_ratings_two_cars():
    """P1 gains +100, P2 loses −100 (n=2, factor=200, equal iR → expected=0.5)."""
    cars = [_sc(0, "GT3", 1, 1, 2000), _sc(1, "GT3", 2, 2, 2000)]
    ch = _calc_ir_changes(cars)
    assert ch[0] == 100
    assert ch[1] == -100


def test_ir_sum_zero_within_class():
    """iRating is zero-sum: gains and losses balance exactly."""
    cars = [_sc(i, "GT3", i + 1, i + 1, 1000 + i * 300) for i in range(5)]
    assert sum(_calc_ir_changes(cars).values()) == 0


def test_ir_heavy_favourite_wins_earns_little():
    high = _sc(0, "GT3", 1, 1, 4500)
    low  = _sc(1, "GT3", 2, 2,  800)
    ch   = _calc_ir_changes([high, low])
    assert 0 < ch[0] < 25   # deserved result → small gain (natural-exp gives ~18 for 3700-pt gap)


def test_ir_heavy_favourite_loses_heavily():
    high = _sc(0, "GT3", 2, 2, 4500)
    low  = _sc(1, "GT3", 1, 1,  800)
    ch   = _calc_ir_changes([high, low])
    assert ch[0] < -50


def test_ir_unrated_excluded():
    """Cars with irating=0 must not participate in the formula."""
    rated   = _sc(0, "GT3", 1, 1, 2000)
    unrated = _sc(1, "GT3", 2, 2, 0)
    ch      = _calc_ir_changes([rated, unrated])
    assert ch == {}   # n < 2 rated → nothing computed


def test_ir_single_car_class_skipped():
    assert _calc_ir_changes([_sc(0, "LMP2", 1, 1, 3000)]) == {}


def test_ir_multiclass_grouped_separately():
    """LMP2 and GT3 must each run their own ELO calculation independently."""
    cars = [
        _sc(0, "LMP2", 1, 1, 2000),
        _sc(1, "LMP2", 2, 2, 2000),
        _sc(2, "GT3",  1, 3, 2000),
        _sc(3, "GT3",  2, 4, 2000),
    ]
    ch = _calc_ir_changes(cars)
    assert ch[0] == 100 and ch[1] == -100   # LMP2
    assert ch[2] == 100 and ch[3] == -100   # GT3


def test_ir_multiclass_lmp2_position_does_not_affect_gt3():
    """Even though LMP2 is P1 overall, GT3 P1 in class should still gain iR."""
    cars = [
        _sc(0, "LMP2", 1, 1, 2000),  # LMP2 overall P1
        _sc(1, "LMP2", 2, 2, 2000),
        _sc(2, "GT3",  1, 3, 2000),  # GT3 P1 in class, P3 overall
        _sc(3, "GT3",  2, 4, 2000),
    ]
    ch = _calc_ir_changes(cars)
    assert ch[2] == 100   # GT3 class-P1 should gain, not be penalised for being P3 overall


# ── Qualifying ────────────────────────────────────────────────────────────────

def test_quali_sorted_fastest_first():
    fast   = _car(idx=0, best_lap=88.5)
    medium = _car(idx=1, best_lap=89.8)
    slow   = _car(idx=2, best_lap=91.2)
    result = _calc.update(_state([slow, medium, fast], session_type="qualify"))
    assert [c.car_idx for c in result][:3] == [0, 1, 2]


def test_quali_gap_to_leader_correct():
    p1 = _car(idx=0, best_lap=89.0)
    p2 = _car(idx=1, best_lap=90.2)
    result = _calc.update(_state([p1, p2], session_type="qualify"))
    by_idx = {c.car_idx: c for c in result}
    assert by_idx[0].gap_to_leader == 0.0
    assert by_idx[1].gap_to_leader == pytest.approx(1.2, abs=0.01)


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_disconnected_returns_empty():
    state = _state([_car(idx=0)])
    state.connected = False
    assert _calc.update(state) == []


def test_empty_cars_returns_empty():
    assert _calc.update(_state([])) == []


def test_single_car_race():
    result = _calc.update(_state([_car(idx=0, pos=1, laps=5)]))
    assert len(result) == 1
    assert result[0].position == 1
    assert result[0].gap_to_leader == 0.0
