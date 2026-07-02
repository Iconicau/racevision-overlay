"""
Extracts raw variables from the iRacing SDK and maps them onto RaceState.
No calculations here — just unit conversions and field mapping.
"""
from __future__ import annotations
import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import irsdk

from backend.state.race_state import (
    RaceState, FuelState, SessionState, CarState, DriverState, RelativeCar, WeatherState, TyreState
)


def _calc_sof(iratings: list[int]) -> int:
    """iRacing Strength of Field: 1600 × ln(N / Σ e^{-ir/1600}).

    Equal to the iRating value where every driver would have P(win) = 1/N.
    Returns 0 if fewer than 2 rated drivers are present.
    """
    rated = [ir for ir in iratings if ir > 0]
    if len(rated) < 2:
        return 0
    n = len(rated)
    return round(1600.0 * math.log(n / sum(math.exp(-ir / 1600.0) for ir in rated)))


def _safe_float(val: object, lo: float = 0.0, hi: float = float("inf"), default: float = 0.0) -> float:
    """Return val clamped to [lo, hi], or default if val is None / non-numeric / out of range.

    Guards against corrupted SDK reads that occur when iRacing changes cars mid-session
    without a full shared-memory reset — the cached variable offset can temporarily point
    at the wrong data (e.g. FuelLevel reading RPM values).
    """
    if val is None:
        return default
    try:
        v = float(val)
    except (TypeError, ValueError):
        return default
    return v if lo <= v <= hi else default


_FLAG_MAP = {
    0x0001: "checkered",
    0x0002: "white",
    0x0004: "green",
    0x0008: "yellow",
    0x0010: "red",
    0x0020: "blue",
    0x0080: "black",
    0x0100: "yellow_waving",
    0x0400: "caution",
    0x0800: "caution_waving",
    0x1000: "black_and_white",
    0x2000: "meatball",
    0x4000: "repair",
    0x8000: "furled_checkered",
}


def _resolve_flag(raw: int) -> str:
    for mask, name in _FLAG_MAP.items():
        if raw & mask:
            return name
    return "none"


def _int_to_hex_color(color_int: int) -> str:
    """Convert iRacing's integer class color to a CSS hex string."""
    return f"#{color_int:06x}"


def _build_cars(
    ir: "irsdk.IRSDK",
    player_idx: int,
    drivers: list[dict],
    last_cars: dict[int, RelativeCar] | None = None,
) -> list[RelativeCar]:
    lap_dist        = ir["CarIdxLapDistPct"]    or []
    positions       = ir["CarIdxPosition"]       or []
    class_positions = ir["CarIdxClassPosition"]  or []
    on_pit          = ir["CarIdxOnPitRoad"]      or []
    laps_completed  = ir["CarIdxLapCompleted"]   or []
    best_lap_times  = ir["CarIdxBestLapTime"]    or []
    last_lap_times  = ir["CarIdxLastLapTime"]    or []
    est_times       = ir["CarIdxEstTime"]        or []

    # Build lookup from idx → driver info
    driver_by_idx: dict[int, dict] = {d.get("CarIdx", -1): d for d in drivers}

    cars: list[RelativeCar] = []
    for idx, pct in enumerate(lap_dist):
        driver = driver_by_idx.get(idx, {})
        if not driver or not driver.get("UserName", ""):
            continue  # unused slot — always skip
        if driver.get("CarIsPaceCar", 0) or driver.get("IsSpectator", 0):
            continue  # pace car and spectators never appear in overlay

        if pct < 0:
            # Car is registered but outside iRacing's 32-car telemetry bubble.
            # Return last known state (marked stale) so it doesn't vanish from the overlay.
            if last_cars and idx in last_cars:
                cars.append(last_cars[idx].model_copy(update={"is_stale": True}))
            continue

        color_int = driver.get("CarClassColor", 0xFFFFFF)
        raw_est = est_times[idx] if idx < len(est_times) else None
        cars.append(RelativeCar(
            car_idx=idx,
            car_number=str(driver.get("CarNumber", "")),
            driver_name=driver.get("UserName", ""),
            car_class=driver.get("CarClassShortName", "") or driver.get("CarClassName", ""),
            class_color=_int_to_hex_color(color_int),
            position=positions[idx] if idx < len(positions) else 0,
            class_position=class_positions[idx] if idx < len(class_positions) else 0,
            lap_dist_pct=pct,
            laps_completed=laps_completed[idx] if idx < len(laps_completed) else 0,
            best_lap_time=best_lap_times[idx] if idx < len(best_lap_times) else -1.0,
            last_lap_time=last_lap_times[idx] if idx < len(last_lap_times) else 0.0,
            irating=int(driver.get("IRating", 0)),
            lic_string=str(driver.get("LicString", "")),
            on_pit_road=bool(on_pit[idx]) if idx < len(on_pit) else False,
            is_player=(idx == player_idx),
            est_time=float(raw_est) if raw_est is not None and raw_est > 0 else 0.0,
            country_code=str(driver.get("CountryCode", "")),
            car_screen_name=str(driver.get("CarScreenNameShort", "") or driver.get("CarScreenName", "")),
        ))

    return cars


def build_race_state(
    ir: "irsdk.IRSDK",
    tick: int,
    last_cars: dict[int, RelativeCar] | None = None,
) -> RaceState:
    """Build a full RaceState snapshot from a live iRacing SDK handle."""
    try:
        driver_info = ir["DriverInfo"]
        player_idx = ir["PlayerCarIdx"] or 0
        drivers = driver_info.get("Drivers", []) if driver_info else []
        my_driver = next((d for d in drivers if d.get("CarIdx") == player_idx), {})

        session_info = ir["SessionInfo"]
        sessions = session_info.get("Sessions", []) if session_info else []
        session_num = ir["SessionNum"] or 0
        current_session = next(
            (s for s in sessions if s.get("SessionNum") == session_num), {}
        )
        session_type_raw = current_session.get("SessionType", "unknown").lower()
        raw_flags = ir["SessionFlags"] or 0

        cars = _build_cars(ir, player_idx, drivers, last_cars)

        # SOF from full DriverInfo list — stable for the entire session
        by_class_ir: dict[str, list[int]] = {}
        all_ir: list[int] = []
        for d in drivers:
            ir_val = int(d.get("IRating", 0))
            cls = d.get("CarClassShortName", "") or d.get("CarClassName", "")
            if ir_val > 0:
                all_ir.append(ir_val)
                if cls:
                    by_class_ir.setdefault(cls, []).append(ir_val)
        sof_overall = _calc_sof(all_ir)
        class_sof = {cls: _calc_sof(irs) for cls, irs in by_class_ir.items()}

        return RaceState(
            connected=True,
            tick=tick,
            track_name=ir["WeekendInfo"]["TrackDisplayName"] if ir["WeekendInfo"] else "",
            track_id=int(ir["WeekendInfo"].get("TrackID", 0)) if ir["WeekendInfo"] else 0,
            track_length_km=float(
                str(ir["WeekendInfo"].get("TrackLength", "0 km")).replace(" km", "")
            ) if ir["WeekendInfo"] else 0.0,
            air_temp_c=ir["AirTemp"] or 0.0,
            track_temp_c=ir["TrackTempCrew"] or 0.0,
            player_incidents=ir["PlayerCarMyIncidentCount"] or 0,
            is_on_track=bool(ir["IsOnTrack"]),
            is_replay_playing=bool(ir["IsReplayPlaying"]),
            is_in_setup=bool(ir["IsInGarage"]),
            fuel=FuelState(
                level=_safe_float(ir["FuelLevel"], 0.0, 200.0),   # no car exceeds 200L
                percent=_safe_float(ir["FuelLevelPct"], 0.0, 1.0),
            ),
            session=SessionState(
                type=session_type_raw,
                time_remaining=ir["SessionTimeRemain"] or 0.0,
                time_elapsed=ir["SessionTime"] or 0.0,
                laps_remaining=ir["SessionLapsRemain"] or 0,
                laps_total=ir["SessionLapsTotal"] or 0,
                flags=_resolve_flag(raw_flags),
            ),
            car=CarState(
                speed=(ir["Speed"] or 0.0) * 3.6,
                gear=ir["Gear"] or 0,
                rpm=ir["RPM"] or 0.0,
                lap=ir["Lap"] or 0,
                lap_dist_pct=ir["LapDistPct"] or 0.0,
                last_lap_time=ir["LapLastLapTime"] or 0.0,
                best_lap_time=ir["LapBestLapTime"] or 0.0,
                on_pit_road=bool(ir["OnPitRoad"]),
                yaw=ir["Yaw"] or 0.0,
            ),
            driver=DriverState(
                name=my_driver.get("UserName", ""),
                car_number=my_driver.get("CarNumber", ""),
                ir_rating=int(my_driver.get("IRating", 0)),
                position=ir["PlayerCarPosition"] or 0,
                class_position=ir["PlayerCarClassPosition"] or 0,
            ),
            cars=cars,
            sof=sof_overall,
            class_sof=class_sof,
            weather=WeatherState(
                skies=max(0, min(3, int(ir["Skies"] or 0))),
                wind_dir_rad=float(ir["WindDir"] or 0.0) % (2 * math.pi),
                wind_vel_ms=_safe_float(ir["WindVel"], 0.0, 150.0),
                humidity=_safe_float(ir["RelativeHumidity"], 0.0, 1.0),
                fog_level=_safe_float(ir["FogLevel"], 0.0, 1.0),
                weather_declared_wet=bool(ir["WeatherDeclaredWet"]),
                weather_type=max(0, min(1, int(ir["WeatherType"] or 0))),
            ),
            tyre=TyreState(
                lf_temp=_safe_float(ir["LFtempCM"], 0.0, 250.0),
                rf_temp=_safe_float(ir["RFtempCM"], 0.0, 250.0),
                lr_temp=_safe_float(ir["LRtempCM"], 0.0, 250.0),
                rr_temp=_safe_float(ir["RRtempCM"], 0.0, 250.0),
                lf_wear=_safe_float(ir["LFwearM"],  0.0, 1.0),
                rf_wear=_safe_float(ir["RFwearM"],  0.0, 1.0),
                lr_wear=_safe_float(ir["LRwearM"],  0.0, 1.0),
                rr_wear=_safe_float(ir["RRwearM"],  0.0, 1.0),
            ),
        )
    except Exception:
        return RaceState(connected=True, tick=tick)
