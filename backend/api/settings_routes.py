"""
Settings API — GET and PUT for user preferences.
All settings have server-side defaults so the frontend always gets a complete object.
"""
from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel

from backend.db.database import get_all_settings, set_setting

router = APIRouter(prefix="/settings", tags=["settings"])


class AppSettings(BaseModel):
    theme: str = "dark"            # "dark" | "light" | "oled"
    speed_unit: str = "kmh"        # "kmh" | "mph"
    fuel_unit: str = "litres"      # "litres" | "gallons"
    show_class_position: bool = False
    relative_ahead: int = 5        # cars to show ahead of player in relative
    relative_behind: int = 5       # cars to show behind player in relative
    standings_ahead: int = 5       # positions to show ahead of player in standings
    standings_behind: int = 5      # positions to show behind player in standings
    standings_mode: str = "top_n"  # "top_n" | "window"
    standings_top_n: int = 5       # cars shown per class when mode is top_n
    relative_anchor_bottom: bool = False
    standings_anchor_bottom: bool = False
    overlay_visibility: str = "in_car"   # in_car | replay | in_car_or_replay | all_iracing | always


_DEFAULTS = AppSettings().model_dump()


def _load() -> AppSettings:
    stored = get_all_settings()
    merged = {**_DEFAULTS, **stored}
    return AppSettings(**merged)


@router.get("", response_model=AppSettings)
async def get_settings() -> AppSettings:
    return _load()


@router.put("", response_model=AppSettings)
async def update_settings(patch: AppSettings) -> AppSettings:
    for key, value in patch.model_dump().items():
        set_setting(key, value)
    return _load()
