"""
Relative gap calculator.
Computes track position gaps between all cars and the player,
converts to seconds, and returns a sorted proximity list.
"""
from __future__ import annotations
from collections import deque
from backend.state.race_state import RaceState, RelativeCar

_FALLBACK_LAP_TIME = 90.0
_GAP_SMOOTH = 3  # median window (ticks) — kills single-tick SDK spikes at line crossings


class RelativeCalculator:
    def __init__(self) -> None:
        self._gap_history: dict[int, deque[float]] = {}

    def update(self, state: RaceState, ahead: int = 5, behind: int = 5) -> list[RelativeCar]:
        if not state.connected or not state.cars:
            return []

        player = next((c for c in state.cars if c.is_player), None)
        if player is None:
            return []

        player_pct   = player.lap_dist_pct
        player_est   = player.est_time
        player_class = player.car_class

        # best_lap_time is stable (only ever decreases); last_lap_time changes on every
        # lap completion, which makes ALL pct-based gaps jump simultaneously.
        # Seed from the fastest known lap in the field when the player has no data yet.
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

        # Prune history for cars no longer in the session
        active_ids = {c.car_idx for c in state.cars}
        for k in list(self._gap_history):
            if k not in active_ids:
                del self._gap_history[k]

        gapped: list[tuple[float, RelativeCar]] = []
        for car in state.cars:
            if (player_est > 0 and car.est_time > 0
                    and car.laps_completed == player.laps_completed
                    and car.car_class == player_class):
                # est_time-based: accurate for same-class same-lap gaps.
                # CarIdxEstTime = seconds elapsed in the current lap (0 at S/F, rising).
                # A car further around the track has a higher est_time than the player,
                # so (car.est_time - player_est) > 0 means the car is ahead. ✓
                # We keep the laps_completed == constraint deliberately: est_time comparison
                # only makes sense within the same lap.  Lap-down cars use pct-based gap
                # so they show physical proximity, not a misleading "-90s" race gap.
                raw_gap = car.est_time - player_est
            else:
                # pct-based: gives physical track proximity regardless of class or lap count.
                # Handles cross-class cars and same-class lap-down/up cars correctly.
                delta_pct = (car.lap_dist_pct - player_pct) % 1.0
                if delta_pct > 0.5:
                    delta_pct -= 1.0
                raw_gap = delta_pct * ref_lap_time

            # 3-tick median filter — absorbs the brief spike that can occur when the
            # SDK's est_time and laps_completed update in slightly different frames.
            h = self._gap_history.setdefault(car.car_idx, deque(maxlen=_GAP_SMOOTH))
            h.append(raw_gap)
            gap_s = sorted(h)[len(h) // 2]

            gapped.append((gap_s, car))

        # Sort by gap descending (most ahead first)
        gapped.sort(key=lambda x: x[0], reverse=True)

        player_idx = next(
            (i for i, (_, c) in enumerate(gapped) if c.is_player), None
        )
        if player_idx is None:
            return []

        # Slice window around player
        start = max(0, player_idx - ahead)
        end = min(len(gapped), player_idx + behind + 1)
        window = gapped[start:end]

        # Always include the single closest lapping car (1+ lap ahead in race order)
        # and the single closest lapped car (1+ lap behind in race order).
        window_idxs = set(range(start, end))
        player_laps = player.laps_completed

        lapping_outside = [(g, c) for i, (g, c) in enumerate(gapped)
                           if i not in window_idxs and c.laps_completed > player_laps]
        lapped_outside  = [(g, c) for i, (g, c) in enumerate(gapped)
                           if i not in window_idxs and c.laps_completed < player_laps]

        if lapping_outside:
            window.append(max(lapping_outside, key=lambda x: x[0]))
        if lapped_outside:
            window.append(min(lapped_outside, key=lambda x: x[0]))

        window.sort(key=lambda x: x[0], reverse=True)

        result: list[RelativeCar] = []
        for gap_s, car in window:
            updated = car.model_copy(update={"gap_to_player": round(gap_s, 2)})
            result.append(updated)

        return result
