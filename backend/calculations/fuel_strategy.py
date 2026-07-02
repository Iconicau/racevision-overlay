"""
Fuel Saving Delta Engine.

Applies configurable save profiles to the current fuel situation and
produces an explicit can_finish recommendation for each profile.

Architecture:
  FuelSaveProfile      — immutable data object for one save level
  ProfileSource (ABC)  — extension point: swap in a learned source later
  DefaultProfileSource — lookup-table implementation (car class + track length)
  FuelSavingDeltaEngine — pure calculation, no iRacing dependency

Testability: FuelSavingDeltaEngine.calculate_from_inputs() takes plain floats,
so tests need zero iRacing infrastructure.

Future extensibility: implement ProfileSource to return profiles calibrated from
historical race data instead of lookup tables. Pass the new source to the engine
via the constructor — no other code changes required.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass

from backend.state.race_state import (
    FuelCalculation,
    ProfileResult,
    FuelStrategyRecommendation,
)

# Minimum laps of burn data before confidence exceeds "uncertain"
_CONFIDENT_LAPS = 8


# ── Profile definition ─────────────────────────────────────────────────────────

@dataclass(frozen=True)
class FuelSaveProfile:
    """One named save level. Immutable — create new instances to change values."""
    name: str
    save_rate: float           # L/lap to reduce consumption by
    lap_time_loss: float       # estimated s/lap penalty (before track/class scaling)
    lift_recommendation: str   # concise driving tip shown to the user
    base_confidence: float     # 0.0–1.0 inherent reliability of this profile's estimates


# ── Profile source interface ───────────────────────────────────────────────────

class ProfileSource(ABC):
    """Provides the ordered list of save profiles for a given car/track context.

    Implement this class to replace lookup-table estimates with values
    learned from historical race telemetry.
    """

    @abstractmethod
    def get_profiles(self, car_class: str, track_km: float) -> list[FuelSaveProfile]:
        """Return profiles ordered lightest → most aggressive."""


# ── Default (lookup-table) implementation ─────────────────────────────────────

class DefaultProfileSource(ProfileSource):
    """Profile estimates from typical iRacing lift-and-coast behaviour.

    Calibrated against a 4–5 km reference track. The track length multiplier
    and car-class multiplier adjust the lap-time cost automatically.
    """

    # (name, save_rate L/lap, base_time_loss s/lap, lift tip, base_confidence)
    _TEMPLATE: list[tuple[str, float, float, str, float]] = [
        (
            "Light",
            0.04,
            0.10,
            "Slight lift on the longest straight — barely noticeable",
            0.85,
        ),
        (
            "Medium",
            0.09,
            0.28,
            "Lift 50–80m earlier at two heavy braking zones",
            0.78,
        ),
        (
            "Aggressive",
            0.16,
            0.55,
            "Coast through medium corners, brake significantly earlier",
            0.68,
        ),
    ]

    # Lap-time cost multiplier per car class (higher = more time lost per L saved)
    _CLASS_MULT: dict[str, float] = {
        "GT3":       1.00,
        "GTE":       1.00,
        "GT4":       1.05,
        "GTD":       1.00,
        "GTD PRO":   0.95,
        "LMP2":      0.82,
        "LMP3":      0.88,
        "GTP":       0.78,
        "DPI":       0.78,
        "IMSA":      0.90,
        "NASCAR":    0.45,
        "OVAL":      0.35,
    }

    def get_profiles(self, car_class: str, track_km: float) -> list[FuelSaveProfile]:
        class_mult = next(
            (mult for cls, mult in self._CLASS_MULT.items()
             if car_class.strip().upper().startswith(cls)),
            1.0,
        )
        track_mult = _track_length_mult(track_km)

        return [
            FuelSaveProfile(
                name=name,
                save_rate=save_rate,
                lap_time_loss=round(base_loss * class_mult * track_mult, 3),
                lift_recommendation=lift_tip,
                base_confidence=base_conf,
            )
            for name, save_rate, base_loss, lift_tip, base_conf in self._TEMPLATE
        ]


def _track_length_mult(km: float) -> float:
    """Short circuits offer fewer coasting opportunities → more time lost per L saved."""
    if km <= 0:   return 1.0
    if km < 2.0:  return 1.85
    if km < 3.5:  return 1.30
    if km < 5.0:  return 1.00
    if km < 7.0:  return 0.72
    return 0.52


# ── Engine ─────────────────────────────────────────────────────────────────────

class FuelSavingDeltaEngine:
    """Turns raw fuel numbers into a profile-based finishing recommendation.

    Constructor injection: pass a custom ProfileSource to replace lookup-table
    estimates with learned values without touching any other code.
    """

    def __init__(self, source: ProfileSource | None = None) -> None:
        self._source: ProfileSource = source or DefaultProfileSource()

    # ── Public API ────────────────────────────────────────────────────────────

    def calculate(
        self,
        fuel_calc: FuelCalculation,
        car_class: str,
        track_km: float,
    ) -> FuelStrategyRecommendation:
        """Convenience wrapper — derives primitive inputs from a FuelCalculation."""
        if fuel_calc.burn_rate <= 0 or fuel_calc.fuel_to_finish <= 0:
            return FuelStrategyRecommendation()

        current_fuel   = fuel_calc.laps_remaining_on_fuel * fuel_calc.burn_rate
        laps_remaining = fuel_calc.fuel_to_finish / fuel_calc.burn_rate

        return self.calculate_from_inputs(
            current_fuel=current_fuel,
            burn_rate=fuel_calc.burn_rate,
            laps_remaining=laps_remaining,
            car_class=car_class,
            track_km=track_km,
            laps_sampled=fuel_calc.laps_sampled,
            time_cost_measured=fuel_calc.time_cost_measured,
        )

    def calculate_from_inputs(
        self,
        current_fuel: float,
        burn_rate: float,
        laps_remaining: float,
        car_class: str,
        track_km: float,
        laps_sampled: int = 0,
        time_cost_measured: bool = False,
    ) -> FuelStrategyRecommendation:
        """Primary calculation method — accepts plain floats for easy unit testing.

        Args:
            current_fuel:      Litres remaining in the tank right now.
            burn_rate:         Rolling-average L/lap.
            laps_remaining:    Race laps left to complete.
            car_class:         iRacing car class string (e.g. "GT3").
            track_km:          Circuit length in km.
            laps_sampled:      Laps of burn data collected (affects confidence).
            time_cost_measured: True when lap-time cost is from real correlation.
        """
        if burn_rate <= 0 or laps_remaining <= 0:
            return FuelStrategyRecommendation()

        fuel_needed = burn_rate * laps_remaining
        fuel_deficit = max(0.0, fuel_needed - current_fuel)

        profiles   = self._source.get_profiles(car_class, track_km)
        data_conf  = min(1.0, laps_sampled / _CONFIDENT_LAPS)
        meas_bonus = 0.15 if time_cost_measured else 0.0

        results = [
            self._evaluate_profile(p, current_fuel, burn_rate, laps_remaining,
                                   data_conf, meas_bonus)
            for p in profiles
        ]

        # Cheapest profile that can reach the finish
        recommended = next((r for r in results if r.can_finish), None)

        return FuelStrategyRecommendation(
            current_fuel=round(current_fuel, 2),
            fuel_needed=round(fuel_needed, 2),
            fuel_deficit=round(fuel_deficit, 2),
            laps_remaining=round(laps_remaining, 1),
            all_profiles=results,
            recommended_profile=recommended,
            estimated_finish_fuel=round(
                recommended.expected_finish_fuel if recommended else current_fuel - fuel_needed,
                2,
            ),
            estimated_time_loss=round(
                recommended.expected_total_time_loss if recommended else 0.0,
                1,
            ),
            confidence=round(
                recommended.confidence if recommended
                else (max((r.confidence for r in results), default=0.0)),
                2,
            ),
            recommendation_text=_build_recommendation_text(
                fuel_deficit, laps_remaining, recommended
            ),
        )

    # ── Private ───────────────────────────────────────────────────────────────

    @staticmethod
    def _evaluate_profile(
        profile: FuelSaveProfile,
        current_fuel: float,
        burn_rate: float,
        laps_remaining: float,
        data_confidence: float,
        measured_bonus: float,
    ) -> ProfileResult:
        effective_burn     = burn_rate - profile.save_rate
        finish_fuel        = current_fuel - effective_burn * laps_remaining
        can_finish         = finish_fuel >= 0.0
        total_time_loss    = profile.lap_time_loss * laps_remaining
        confidence         = min(1.0, profile.base_confidence * data_confidence + measured_bonus)

        return ProfileResult(
            profile_name=profile.name,
            save_rate=profile.save_rate,
            lap_time_loss=profile.lap_time_loss,
            lift_recommendation=profile.lift_recommendation,
            can_finish=can_finish,
            expected_finish_fuel=round(finish_fuel, 2),
            expected_total_time_loss=round(total_time_loss, 1),
            confidence=round(confidence, 2),
        )


# ── Recommendation text builder ────────────────────────────────────────────────

def _build_recommendation_text(
    deficit: float,
    laps: float,
    rec: ProfileResult | None,
) -> str:
    if deficit <= 0.0:
        return "No saving needed — fuel is sufficient to finish."
    if rec is None:
        return (
            f"Saving {deficit:.2f}L across {laps:.0f} laps is not achievable "
            "with any profile — a pit stop is required."
        )
    save_needed = deficit / laps if laps > 0 else 0.0
    return (
        f"{rec.profile_name} save: reduce burn by {save_needed:.3f}L/lap. "
        f"Costs ~{rec.lap_time_loss:.2f}s/lap ({rec.expected_total_time_loss:.0f}s total). "
        f"{rec.lift_recommendation}."
    )
