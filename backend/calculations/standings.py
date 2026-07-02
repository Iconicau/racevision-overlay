"""
Standings calculator.
- Race: sorted by laps completed + track position, gaps in seconds, projected iR change.
- Qualifying / Practice: sorted by best lap time, gaps relative to P1.
"""
from __future__ import annotations
import math
from backend.state.race_state import RaceState, RelativeCar, StandingsCar

_FALLBACK_LAP_TIME = 90.0
_QUALI_SESSIONS = {"qualify", "lone qualify", "open qualify", "practice", "offline testing"}


def _calc_ir_changes(cars: list[StandingsCar]) -> dict[int, int]:
    """
    Predict iRating change for each car.
    Formula: ΔiR = (200 / (N-1)) × Σ_j (actual_vs_j − expected_vs_j)
    Grouped per class so LMP2/GT3 don't incorrectly affect each other.
    Uses class_position (always set correctly by _race_standings now).
    """
    changes: dict[int, int] = {}

    by_class: dict[str, list[StandingsCar]] = {}
    for car in cars:
        cls = car.car_class or ""
        by_class.setdefault(cls, []).append(car)

    for cls_cars in by_class.values():
        rated = [c for c in cls_cars if c.irating > 0]
        n = len(rated)
        if n < 2:
            continue

        factor = 200.0 / (n - 1)

        for i, car_i in enumerate(rated):
            total = 0.0
            pos_i = car_i.class_position  # always > 0 — computed from sorted order
            for j, car_j in enumerate(rated):
                if i == j:
                    continue
                pos_j = car_j.class_position
                expected = 1.0 / (1.0 + math.exp((car_j.irating - car_i.irating) / 1600.0))
                actual   = 1.0 if pos_i < pos_j else 0.0
                total   += actual - expected
            changes[car_i.car_idx] = round(total * factor)

    return changes


def _mark_fastest_laps(cars: list[StandingsCar]) -> None:
    """Set has_fastest_lap=True on the car with the best lap time in each class."""
    best: dict[str, tuple[int, float]] = {}
    for car in cars:
        if car.best_lap_time and car.best_lap_time > 0:
            cls = car.car_class or ""
            if cls not in best or car.best_lap_time < best[cls][1]:
                best[cls] = (car.car_idx, car.best_lap_time)
    for car in cars:
        cls = car.car_class or ""
        car.has_fastest_lap = cls in best and best[cls][0] == car.car_idx


def _is_quali_mode(state: RaceState) -> bool:
    return state.session.type.lower() in _QUALI_SESSIONS


class StandingsCalculator:
    def update(self, state: RaceState) -> list[StandingsCar]:
        if not state.connected or not state.cars:
            return []
        if _is_quali_mode(state):
            return self._quali_standings(state)
        return self._race_standings(state)

    # ── Qualifying / Practice ─────────────────────────────────────────────

    def _quali_standings(self, state: RaceState) -> list[StandingsCar]:
        timed   = [c for c in state.cars if c.best_lap_time and c.best_lap_time > 0]
        untimed = [c for c in state.cars if c not in timed]

        timed.sort(key=lambda c: c.best_lap_time)

        result: list[StandingsCar] = []
        overall_pos = 0
        class_pos: dict[str, int] = {}

        for car in timed + untimed:
            overall_pos += 1
            cls = car.car_class or ""
            class_pos[cls] = class_pos.get(cls, 0) + 1

            if timed and car.best_lap_time and car.best_lap_time > 0:
                gap_to_leader = car.best_lap_time - timed[0].best_lap_time
                idx = timed.index(car)
                gap_to_ahead = (car.best_lap_time - timed[idx - 1].best_lap_time) if idx > 0 else 0.0
            else:
                gap_to_leader = 0.0
                gap_to_ahead  = 0.0

            result.append(StandingsCar(
                car_idx=car.car_idx,
                car_number=car.car_number,
                driver_name=car.driver_name,
                car_class=car.car_class,
                class_color=car.class_color,
                position=overall_pos,
                class_position=class_pos[cls],
                laps_completed=car.laps_completed,
                laps_down=0,
                gap_to_leader=round(gap_to_leader, 3),
                gap_to_ahead=round(gap_to_ahead, 3),
                lap_dist_pct=car.lap_dist_pct,
                best_lap_time=car.best_lap_time,
                last_lap_time=car.last_lap_time,
                irating=car.irating,
                lic_string=car.lic_string,
                on_pit_road=car.on_pit_road,
                is_player=car.is_player,
                is_stale=car.is_stale,
                country_code=car.country_code,
                car_screen_name=car.car_screen_name,
            ))

        _mark_fastest_laps(result)
        return result

    # ── Race ─────────────────────────────────────────────────────────────

    def _race_standings(self, state: RaceState) -> list[StandingsCar]:
        # Exclude pure ghost slots: position=0 AND laps_completed=0.
        # laps_completed=-1 during formation lap, so != 0 keeps those entries.
        active_cars = [c for c in state.cars if c.position > 0 or c.laps_completed != 0]
        sorted_cars = sorted(
            active_cars,
            key=lambda c: (c.laps_completed, c.lap_dist_pct),
            reverse=True,
        )
        if not sorted_cars:
            return []

        # best_lap_time is stable (monotonically decreasing); last_lap_time changes on
        # every lap completion, which causes all pct-based gaps to jump together.
        field_best = min(
            (c.best_lap_time for c in state.cars if c.best_lap_time > 10.0),
            default=0.0,
        )
        ref_lap_time = (
            state.car.best_lap_time
            or field_best
            or state.car.last_lap_time
            or _FALLBACK_LAP_TIME
        )

        # Identify the class leader (most laps + furthest) for each class.
        # All gap/interval calculations are relative to the CLASS leader, not the
        # overall leader.  This gives meaningful numbers inside each class box.
        class_leaders: dict[str, RelativeCar] = {}
        for car in sorted_cars:
            cls = car.car_class or ""
            if cls not in class_leaders:
                class_leaders[cls] = car

        result: list[StandingsCar] = []
        class_pos_counters: dict[str, int] = {}   # always > 0, derived from sort order
        class_prev_pct: dict[str, float] = {}     # last pct seen within each class

        for pos, car in enumerate(sorted_cars, start=1):
            cls = car.car_class or ""

            # class_position derived from sort order — never 0, never relies on iRacing's
            # CarIdxClassPosition which can be 0 or stale during transitions.
            class_pos_counters[cls] = class_pos_counters.get(cls, 0) + 1
            computed_class_pos = class_pos_counters[cls]

            cls_leader = class_leaders.get(cls)

            # laps_down relative to CLASS leader (not overall leader).
            # Keeps GT3 cars showing "+1L within GT3" rather than "+2L behind GTP".
            if cls_leader is not None:
                laps_down = cls_leader.laps_completed - car.laps_completed
            else:
                laps_down = 0

            if laps_down == 0 and cls_leader is not None:
                # Gap to CLASS leader, using pct delta converted to seconds
                pct_delta = cls_leader.lap_dist_pct - car.lap_dist_pct
                gap_to_leader = max(0.0, pct_delta * ref_lap_time)

                # Interval to the car directly ahead WITHIN THE SAME CLASS.
                # Using a per-class prev_pct avoids cross-class garbage intervals.
                prev_pct_cls = class_prev_pct.get(cls)
                if prev_pct_cls is not None:
                    gap_to_ahead = max(0.0, (prev_pct_cls - car.lap_dist_pct) * ref_lap_time)
                else:
                    gap_to_ahead = 0.0
                class_prev_pct[cls] = car.lap_dist_pct
            else:
                gap_to_leader = 0.0
                gap_to_ahead  = 0.0
                # Do NOT update class_prev_pct for lapped cars — the next lead-lap
                # car in the same class should still see the last lead-lap car's pct.

            result.append(StandingsCar(
                car_idx=car.car_idx,
                car_number=car.car_number,
                driver_name=car.driver_name,
                car_class=car.car_class,
                class_color=car.class_color,
                position=pos,
                class_position=computed_class_pos,
                laps_completed=car.laps_completed,
                laps_down=laps_down,
                gap_to_leader=round(gap_to_leader, 2),
                gap_to_ahead=round(gap_to_ahead, 2),
                lap_dist_pct=car.lap_dist_pct,
                best_lap_time=car.best_lap_time,
                last_lap_time=car.last_lap_time,
                irating=car.irating,
                lic_string=car.lic_string,
                on_pit_road=car.on_pit_road,
                is_player=car.is_player,
                is_stale=car.is_stale,
                country_code=car.country_code,
                car_screen_name=car.car_screen_name,
            ))

        ir_changes = _calc_ir_changes(result)
        for car in result:
            car.ir_change = ir_changes.get(car.car_idx, 0)

        _mark_fastest_laps(result)
        return result
