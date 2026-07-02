"""
Records the real track shape by dead-reckoning: speed × direction (Yaw) each tick.

Why not VelocityX/VelocityZ?
  iRacing's velocity vars are in the car's LOCAL body frame (Z=forward, X=sideways).
  Integrating them without rotating to world space always produces a straight line.
  Using scalar Speed + world Yaw bypasses this — Speed is always positive and
  Yaw gives the absolute heading, so the integral traces a proper 2D world path.

How it works:
  - Every tick: pos_x += speed * cos(yaw) * dt,  pos_z += speed * sin(yaw) * dt
  - Sample every ~30 ticks (≈0.5 s at 60 Hz) when moving
  - Detect lap completion when lap_dist_pct wraps from ≥0.88 → <0.12
  - Normalise sample list to a 0-1 bounding box (equal scale both axes) and save
  - Subsequent sessions load the saved path instantly from SQLite
"""
from __future__ import annotations
import logging
import math

from backend.db.database import get_track_path, save_track_path

logger = logging.getLogger(__name__)

DT = 1.0 / 60.0        # seconds per tick (iRacing SDK runs at 60 Hz)
SAMPLE_EVERY = 30      # record a point every N ticks (~0.5 s)
MIN_SPEED_MS = 3.0     # skip samples while barely moving (< ~11 km/h)
MIN_SAMPLES = 60       # need at least this many points for a valid path


class TrackRecorder:
    def __init__(self) -> None:
        self._samples: list[tuple[float, float]] = []
        self._pos_x = 0.0
        self._pos_z = 0.0
        self._tick = 0
        self._last_pct: float | None = None
        self._completed_path: list[list[float]] = []
        self._recording = False
        self._track_name = ""

    # ── Public ────────────────────────────────────────────────────────────────

    def load_for_track(self, track_name: str) -> list[list[float]]:
        """Call when the track name becomes known.  Returns saved path (may be [])."""
        if track_name == self._track_name:
            return self._completed_path

        self._track_name = track_name
        saved = get_track_path(track_name)
        if saved:
            logger.info(f"Track path loaded from DB: {track_name} ({len(saved)} pts)")
            self._completed_path = saved
            self._recording = False
        else:
            logger.info(f"No saved path for {track_name!r} — will record on next lap")
            self._completed_path = []
            self._reset()
            self._recording = True
        return self._completed_path

    def update(
        self,
        lap_dist_pct: float,
        yaw: float,
        speed_ms: float,
    ) -> tuple[list[list[float]], bool]:
        """
        Call every tick.  Returns (path, recording_flag).
        path is [] until a full lap has been recorded and normalised.
        """
        if not self._recording:
            return self._completed_path, False

        # Dead-reckoning: project speed onto world X/Z using heading
        self._pos_x += speed_ms * math.cos(yaw) * DT
        self._pos_z += speed_ms * math.sin(yaw) * DT

        # Sub-sample at reduced rate, only when moving
        self._tick += 1
        if self._tick % SAMPLE_EVERY == 0 and speed_ms > MIN_SPEED_MS:
            self._samples.append((self._pos_x, self._pos_z))

        # Lap-completion detection
        lap_complete = (
            self._last_pct is not None
            and self._last_pct > 0.88
            and lap_dist_pct < 0.12
        )
        self._last_pct = lap_dist_pct

        if lap_complete and len(self._samples) >= MIN_SAMPLES:
            path = _normalise(self._samples)
            self._completed_path = path
            self._recording = False
            save_track_path(self._track_name, path)
            logger.info(
                f"Track path recorded and saved: {self._track_name} ({len(path)} pts)"
            )

        return self._completed_path, self._recording

    # ── Private ───────────────────────────────────────────────────────────────

    def _reset(self) -> None:
        self._samples = []
        self._pos_x = 0.0
        self._pos_z = 0.0
        self._tick = 0
        self._last_pct = None


def _normalise(samples: list[tuple[float, float]]) -> list[list[float]]:
    """Scale to 0-1 bounding box, preserving aspect ratio."""
    xs = [s[0] for s in samples]
    zs = [s[1] for s in samples]
    min_x, max_x = min(xs), max(xs)
    min_z, max_z = min(zs), max(zs)
    range_x = max_x - min_x or 1.0
    range_z = max_z - min_z or 1.0
    scale = max(range_x, range_z)
    return [
        [round((x - min_x) / scale, 4), round((z - min_z) / scale, 4)]
        for x, z in samples
    ]
