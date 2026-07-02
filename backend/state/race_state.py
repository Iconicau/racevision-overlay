from __future__ import annotations
from pydantic import BaseModel, Field


class SaveScenario(BaseModel):
    label: str = ""                     # "Light save" / "To finish" / "Aggressive"
    save_rate: float = 0.0              # L/lap to target (delta vs current burn)
    time_cost: float = 0.0             # estimated lap-time cost in seconds
    time_cost_measured: bool = False    # True = from real session correlation
    outcome: str = ""                   # "Finish +1.2L" / "Avoids pit stop"


# ── Fuel Saving Delta models ───────────────────────────────────────────────────

class ProfileResult(BaseModel):
    """Result of testing one save profile against the current race situation."""
    profile_name: str = ""
    save_rate: float = 0.0                 # L/lap reduction required
    lap_time_loss: float = 0.0            # s/lap cost estimate for this profile
    lift_recommendation: str = ""          # human-readable driving tip
    can_finish: bool = False               # True if this profile gets you to the flag
    expected_finish_fuel: float = 0.0     # L remaining at finish (negative = short)
    expected_total_time_loss: float = 0.0 # cumulative seconds added to race time
    confidence: float = 0.0              # 0.0–1.0 composite confidence score


class FuelStrategyRecommendation(BaseModel):
    """Top-level output of the FuelSavingDeltaEngine."""
    current_fuel: float = 0.0
    fuel_needed: float = 0.0
    fuel_deficit: float = 0.0            # positive = short of fuel; 0 = ok
    laps_remaining: float = 0.0
    all_profiles: list[ProfileResult] = Field(default_factory=list)
    recommended_profile: ProfileResult | None = None   # cheapest profile that finishes
    estimated_finish_fuel: float = 0.0   # from recommended profile (negative = short)
    estimated_time_loss: float = 0.0     # total seconds added (from recommended)
    confidence: float = 0.0
    recommendation_text: str = ""


class FuelCalculation(BaseModel):
    burn_rate: float = 0.0              # L/lap rolling average
    laps_remaining_on_fuel: float = 0.0
    fuel_to_finish: float = 0.0         # L needed to complete race
    stops_required: int = 0
    can_save_stop: bool = False
    save_per_lap: float = 0.0           # L/lap to save to avoid next stop
    insight: str = ""                   # summary sentence
    laps_sampled: int = 0               # laps of burn data collected so far
    scenarios: list[SaveScenario] = Field(default_factory=list)
    pace_samples: int = 0               # laps of (fuel_used, lap_time) pairs
    time_cost_measured: bool = False    # True once real correlation is available


class StandingsCar(BaseModel):
    car_idx: int = 0
    car_number: str = ""
    driver_name: str = ""
    car_class: str = ""
    class_color: str = "#ffffff"
    position: int = 0
    class_position: int = 0
    laps_completed: int = 0
    laps_down: int = 0           # 0 = lead lap
    gap_to_leader: float = 0.0   # seconds (0 for leader or lapped cars)
    gap_to_ahead: float = 0.0    # seconds to car directly ahead
    lap_dist_pct: float = 0.0    # 0.0–1.0 position around track
    best_lap_time: float = 0.0   # seconds (-1 = no time set)
    last_lap_time: float = 0.0   # seconds
    irating: int = 0
    lic_string: str = ""          # e.g. "A 4.35"
    ir_change: int = 0            # projected iRating change based on current position
    on_pit_road: bool = False
    is_player: bool = False
    is_stale: bool = False        # True when car is outside telemetry bubble (last known state)
    country_code: str = ""        # ISO 3166-1 alpha-2, e.g. "AU", "US"
    car_screen_name: str = ""     # short car model name, e.g. "Ferrari 488 GT3"
    has_fastest_lap: bool = False # True for fastest lap holder in this class


class RelativeCar(BaseModel):
    car_idx: int = 0
    car_number: str = ""
    driver_name: str = ""
    car_class: str = ""
    class_color: str = "#ffffff"  # hex color for class indicator
    position: int = 0
    class_position: int = 0
    lap_dist_pct: float = 0.0
    laps_completed: int = 0
    best_lap_time: float = -1.0
    last_lap_time: float = 0.0
    irating: int = 0
    lic_string: str = ""          # e.g. "A 4.35"
    on_pit_road: bool = False
    is_player: bool = False
    gap_to_player: float = 0.0   # seconds; negative = behind player, positive = ahead
    est_time: float = 0.0        # CarIdxEstTime — seconds elapsed in current lap (0 at S/F, increases)
    is_stale: bool = False        # True when car is outside telemetry bubble (last known state)
    country_code: str = ""        # ISO 3166-1 alpha-2, e.g. "AU", "US"
    car_screen_name: str = ""     # short car model name, e.g. "Ferrari 488 GT3"


class FuelState(BaseModel):
    level: float = 0.0          # litres remaining
    percent: float = 0.0        # 0.0 – 1.0


class SessionState(BaseModel):
    type: str = "unknown"       # "race", "qualify", "practice", etc.
    time_remaining: float = 0.0 # seconds
    time_elapsed: float = 0.0   # seconds since session started
    laps_remaining: int = 0
    laps_total: int = 0         # 0 or 32767 = timed race; actual number = lap race
    flags: str = "none"         # "green", "yellow", "checkered", etc.


class CarState(BaseModel):
    speed: float = 0.0          # km/h
    gear: int = 0
    rpm: float = 0.0
    lap: int = 0
    lap_dist_pct: float = 0.0   # 0.0 – 1.0, position around track
    last_lap_time: float = 0.0  # seconds
    best_lap_time: float = 0.0  # seconds
    on_pit_road: bool = False
    yaw: float = 0.0            # car heading in radians (world frame, used by track recorder)


class DriverState(BaseModel):
    name: str = ""
    car_number: str = ""
    ir_rating: int = 0
    position: int = 0           # overall race position
    class_position: int = 0


class WeatherState(BaseModel):
    skies: int = 0                    # 0=Clear, 1=PartlyCloudy, 2=MostlyCloudy, 3=Overcast
    wind_dir_rad: float = 0.0         # radians from north clockwise (direction wind comes FROM)
    wind_vel_ms: float = 0.0          # m/s
    humidity: float = 0.0             # 0.0–1.0
    fog_level: float = 0.0            # 0.0–1.0
    weather_declared_wet: bool = False
    weather_type: int = 0             # 0=constant, 1=dynamic


class TyreState(BaseModel):
    lf_temp: float = 0.0   # °C centre tread — 0 = no data
    rf_temp: float = 0.0
    lr_temp: float = 0.0
    rr_temp: float = 0.0
    lf_wear: float = 0.0   # 0.0 = new, 1.0 = fully worn (0 = not available)
    rf_wear: float = 0.0
    lr_wear: float = 0.0
    rr_wear: float = 0.0


class RaceState(BaseModel):
    connected: bool = False
    fuel: FuelState = Field(default_factory=FuelState)
    fuel_calc: FuelCalculation = Field(default_factory=FuelCalculation)
    fuel_strategy: FuelStrategyRecommendation = Field(default_factory=FuelStrategyRecommendation)
    session: SessionState = Field(default_factory=SessionState)
    car: CarState = Field(default_factory=CarState)
    driver: DriverState = Field(default_factory=DriverState)
    cars: list[RelativeCar] = Field(default_factory=list)      # all cars on track (raw)
    relative: list[RelativeCar] = Field(default_factory=list)  # proximity window around player
    standings: list[StandingsCar] = Field(default_factory=list)
    track_name: str = ""
    track_id: int = 0
    track_length_km: float = 0.0
    air_temp_c: float = 0.0
    track_temp_c: float = 0.0
    player_incidents: int = 0
    is_on_track: bool = False
    is_replay_playing: bool = False
    is_in_setup: bool = False      # True while player is in the garage / setup screen
    tick: int = 0               # increments each update, useful for frontend change detection
    track_outline: list[list[float]] = Field(default_factory=list)  # SVG shape for drawing
    track_path: list[list[float]] = Field(default_factory=list)    # recorder path for car placement
    track_path_recording: bool = False  # True while we're collecting the first lap
    sof: int = 0                          # overall Strength of Field (all classes combined)
    class_sof: dict[str, int] = Field(default_factory=dict)  # SOF per car class
    weather: WeatherState = Field(default_factory=WeatherState)
    tyre: TyreState = Field(default_factory=TyreState)
