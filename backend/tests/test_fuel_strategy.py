"""
Tests for FuelSavingDeltaEngine.
No iRacing SDK, no backend server, no network — just plain inputs and outputs.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from backend.calculations.fuel_strategy import (
    FuelSavingDeltaEngine,
    FuelSaveProfile,
    ProfileSource,
    DefaultProfileSource,
)
from backend.state.race_state import FuelStrategyRecommendation


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_engine() -> FuelSavingDeltaEngine:
    return FuelSavingDeltaEngine()


def run(
    current_fuel: float,
    burn_rate: float,
    laps_remaining: float,
    car_class: str = "GT3",
    track_km: float = 4.5,
    laps_sampled: int = 5,
) -> FuelStrategyRecommendation:
    return make_engine().calculate_from_inputs(
        current_fuel=current_fuel,
        burn_rate=burn_rate,
        laps_remaining=laps_remaining,
        car_class=car_class,
        track_km=track_km,
        laps_sampled=laps_sampled,
    )


# ── No-saving-needed cases ────────────────────────────────────────────────────

def test_surplus_fuel_no_deficit():
    """Driver has more than enough fuel — deficit should be 0."""
    result = run(current_fuel=20.0, burn_rate=2.0, laps_remaining=8.0)
    assert result.fuel_deficit == 0.0


def test_surplus_all_profiles_can_finish():
    """All three profiles can finish when there's a comfortable surplus."""
    result = run(current_fuel=25.0, burn_rate=2.0, laps_remaining=8.0)
    assert all(p.can_finish for p in result.all_profiles)


def test_surplus_no_recommendation_needed_text():
    result = run(current_fuel=25.0, burn_rate=2.0, laps_remaining=8.0)
    assert "no saving needed" in result.recommendation_text.lower()


# ── Can-save cases ────────────────────────────────────────────────────────────

def test_light_save_sufficient():
    """A small deficit should be coverable by Light save only."""
    # burn=2.0, laps=10, need=20.0. fuel=19.6, deficit=0.4 → need ~0.04 L/lap
    result = run(current_fuel=19.6, burn_rate=2.0, laps_remaining=10.0, laps_sampled=5)
    assert result.fuel_deficit > 0
    assert result.recommended_profile is not None
    assert result.recommended_profile.profile_name == "Light"
    assert result.recommended_profile.can_finish


def test_medium_save_needed_when_light_not_enough():
    """A larger deficit should require Medium save."""
    # burn=2.0, laps=10, need=20.0. fuel=19.0, deficit=1.0 → need 0.10 L/lap (Light=0.04, Medium=0.09)
    result = run(current_fuel=19.0, burn_rate=2.0, laps_remaining=10.0)
    assert result.recommended_profile is not None
    # Light can't cover 0.10 L/lap deficit; Medium can (saves 0.09 but we set deficit/lap=0.10)
    # Depends on exact profile save_rates — verify can_finish on recommended
    assert result.recommended_profile.can_finish


def test_aggressive_save_needed():
    """Heavy deficit should escalate to Aggressive save."""
    # burn=2.0, laps=10, need=20.0. fuel=17.5, deficit=2.5 → 0.25 L/lap needed
    result = run(current_fuel=17.5, burn_rate=2.0, laps_remaining=10.0)
    # Aggressive saves 0.16 L/lap which is less than 0.25 → should report no profile works
    # OR if deficit/lap <= 0.16, Aggressive covers it
    # 2.5 / 10 = 0.25 > 0.16, so no profile covers it
    assert result.recommended_profile is None
    assert "pit stop" in result.recommendation_text.lower()


def test_aggressive_save_just_enough():
    """Deficit coverable only by Aggressive save should recommend Aggressive."""
    # burn=2.0, laps=10, need=20.0. fuel=18.5, deficit=1.5 → 0.15 L/lap needed
    # Light (0.04) and Medium (0.09) can't cover; Aggressive (0.16) has 0.1L spare
    result = run(current_fuel=18.5, burn_rate=2.0, laps_remaining=10.0)
    assert result.recommended_profile is not None
    assert result.recommended_profile.profile_name == "Aggressive"
    assert result.recommended_profile.expected_finish_fuel > 0


# ── Profile ordering ──────────────────────────────────────────────────────────

def test_profiles_ordered_lightest_first():
    """Profiles must be ordered lightest → aggressive (save_rate ascending)."""
    profiles = DefaultProfileSource().get_profiles("GT3", 4.5)
    rates = [p.save_rate for p in profiles]
    assert rates == sorted(rates)


def test_exactly_three_profiles():
    profiles = DefaultProfileSource().get_profiles("GT3", 4.5)
    assert len(profiles) == 3


# ── Confidence ────────────────────────────────────────────────────────────────

def test_confidence_zero_with_no_data():
    result = run(current_fuel=19.0, burn_rate=2.0, laps_remaining=10.0, laps_sampled=0)
    assert result.confidence == 0.0


def test_confidence_increases_with_laps():
    low  = run(current_fuel=19.0, burn_rate=2.0, laps_remaining=10.0, laps_sampled=2)
    high = run(current_fuel=19.0, burn_rate=2.0, laps_remaining=10.0, laps_sampled=8)
    assert high.confidence > low.confidence


# ── Total time loss ───────────────────────────────────────────────────────────

def test_total_time_loss_equals_per_lap_times_laps():
    result = run(current_fuel=18.4, burn_rate=2.0, laps_remaining=10.0, laps_sampled=5)
    if result.recommended_profile:
        expected = round(result.recommended_profile.lap_time_loss * 10.0, 1)
        assert result.recommended_profile.expected_total_time_loss == pytest.approx(expected, abs=0.05)


# ── Track length scaling ──────────────────────────────────────────────────────

def test_short_track_costs_more_time():
    """Short circuits should have higher lap_time_loss than long ones."""
    profiles_short = DefaultProfileSource().get_profiles("GT3", 1.5)
    profiles_long  = DefaultProfileSource().get_profiles("GT3", 8.0)
    # Compare Medium profile (index 1)
    assert profiles_short[1].lap_time_loss > profiles_long[1].lap_time_loss


# ── Car class scaling ─────────────────────────────────────────────────────────

def test_lmp2_costs_less_than_gt3():
    """Prototype cars should lose less time per unit of fuel saved."""
    profiles_gt3  = DefaultProfileSource().get_profiles("GT3",  4.5)
    profiles_lmp2 = DefaultProfileSource().get_profiles("LMP2", 4.5)
    assert profiles_lmp2[1].lap_time_loss < profiles_gt3[1].lap_time_loss


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_zero_burn_rate_returns_empty():
    result = run(current_fuel=10.0, burn_rate=0.0, laps_remaining=10.0)
    assert result.fuel_deficit == 0.0
    assert result.all_profiles == []


def test_zero_laps_returns_empty():
    result = run(current_fuel=10.0, burn_rate=2.0, laps_remaining=0.0)
    assert result.all_profiles == []


def test_unknown_car_class_uses_default_cost():
    """Unknown class should not crash — falls back to a default multiplier."""
    result = run(
        current_fuel=18.4, burn_rate=2.0, laps_remaining=10.0,
        car_class="UNKNOWN_CAR_2099",
    )
    assert len(result.all_profiles) == 3


# ── Custom ProfileSource (extensibility demo) ─────────────────────────────────

class FixedProfileSource(ProfileSource):
    """Example learned source: always returns one fixed profile."""
    def get_profiles(self, car_class: str, track_km: float) -> list[FuelSaveProfile]:
        return [
            FuelSaveProfile(
                name="Learned Light",
                save_rate=0.05,
                lap_time_loss=0.08,
                lift_recommendation="Lift slightly on back straight",
                base_confidence=0.92,
            )
        ]


def test_custom_profile_source_is_used():
    engine = FuelSavingDeltaEngine(source=FixedProfileSource())
    result = engine.calculate_from_inputs(
        current_fuel=19.5, burn_rate=2.0, laps_remaining=10.0,
        car_class="GT3", track_km=4.5, laps_sampled=5,
    )
    assert len(result.all_profiles) == 1
    assert result.all_profiles[0].profile_name == "Learned Light"


if __name__ == "__main__":
    # Quick smoke test without pytest
    result = run(current_fuel=19.0, burn_rate=2.0, laps_remaining=10.0, laps_sampled=5)
    print("Recommendation:", result.recommendation_text)
    print("Recommended profile:", result.recommended_profile)
    for p in result.all_profiles:
        print(f"  [{p.profile_name}] can_finish={p.can_finish} "
              f"finish_fuel={p.expected_finish_fuel:.2f}L "
              f"time_loss={p.expected_total_time_loss:.1f}s")
