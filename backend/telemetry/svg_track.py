"""
Loads a pre-downloaded iRacing track SVG and converts it to a normalised
coordinate list suitable for the track map widget.

SVG source: iTelemetry/iracing-tracks (GitHub, public)
File layout: backend/data/tracks/{track_id}.svg
             backend/data/tracks/{track_id}.json  (baseline + clockwise)

The `baseline` value in the config is the lap_dist_pct at which the SVG path
starts.  We rotate the coordinate list so that index 0 always corresponds to
lap_dist_pct = 0 (start/finish line), meaning the frontend can place car dots
with a simple  path[int(pct * N)]  lookup.
"""
from __future__ import annotations
import json
import logging
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

logger = logging.getLogger(__name__)

def _data_dir() -> Path:
    if getattr(sys, "frozen", False):
        # PyInstaller bundle — data files land in _MEIPASS (onedir: _internal/)
        base = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
        return base / "backend" / "data" / "tracks"
    return Path(__file__).parent.parent / "data" / "tracks"

_DATA_DIR = _data_dir()

# ── SVG path parser ──────────────────────────────────────────────────────────

_CMD_RE = re.compile(r'([MmLlHhVvCcZz])')
_NUM_RE = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def _nums(s: str) -> list[float]:
    return [float(m) for m in _NUM_RE.findall(s)]


def _bezier_pts(p0: tuple, p1: tuple, p2: tuple, p3: tuple, n: int = 8):
    """Sample n+1 points along a cubic Bézier (includes endpoints)."""
    pts = []
    for i in range(n + 1):
        t  = i / n
        mt = 1 - t
        x  = mt**3*p0[0] + 3*mt**2*t*p1[0] + 3*mt*t**2*p2[0] + t**3*p3[0]
        y  = mt**3*p0[1] + 3*mt**2*t*p1[1] + 3*mt*t**2*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts


def _parse_path_d(d: str) -> list[tuple[float, float]]:
    """Convert an SVG path `d` string to a flat list of (x, y) points."""
    # Split into (command, raw-args) chunks
    parts = _CMD_RE.split(d)
    # parts = ['', 'M', '1650,447.3', 'c', '-5,3.2 ...', ...]
    chunks: list[tuple[str, list[float]]] = []
    i = 1
    while i < len(parts) - 1:
        cmd  = parts[i]
        args = _nums(parts[i + 1]) if i + 1 < len(parts) else []
        chunks.append((cmd, args))
        i += 2

    pts: list[tuple[float, float]] = []
    cur  = (0.0, 0.0)
    start = (0.0, 0.0)

    for cmd, args in chunks:
        if cmd == 'M':
            cur   = (args[0], args[1])
            start = cur
            for j in range(2, len(args) - 1, 2):
                cur = (args[j], args[j + 1])
                pts.append(cur)

        elif cmd == 'm':
            cur   = (cur[0] + args[0], cur[1] + args[1])
            start = cur

        elif cmd == 'L':
            for j in range(0, len(args) - 1, 2):
                cur = (args[j], args[j + 1])
                pts.append(cur)

        elif cmd == 'l':
            for j in range(0, len(args) - 1, 2):
                cur = (cur[0] + args[j], cur[1] + args[j + 1])
                pts.append(cur)

        elif cmd == 'H':
            for x in args:
                cur = (x, cur[1])
                pts.append(cur)

        elif cmd == 'h':
            for dx in args:
                cur = (cur[0] + dx, cur[1])
                pts.append(cur)

        elif cmd == 'V':
            for y in args:
                cur = (cur[0], y)
                pts.append(cur)

        elif cmd == 'v':
            for dy in args:
                cur = (cur[0], cur[1] + dy)
                pts.append(cur)

        elif cmd == 'C':
            for j in range(0, len(args) - 5, 6):
                p1 = (args[j],     args[j + 1])
                p2 = (args[j + 2], args[j + 3])
                p3 = (args[j + 4], args[j + 5])
                for pt in _bezier_pts(cur, p1, p2, p3)[1:]:
                    pts.append(pt)
                cur = p3

        elif cmd == 'c':
            for j in range(0, len(args) - 5, 6):
                p1 = (cur[0] + args[j],     cur[1] + args[j + 1])
                p2 = (cur[0] + args[j + 2], cur[1] + args[j + 3])
                p3 = (cur[0] + args[j + 4], cur[1] + args[j + 5])
                for pt in _bezier_pts(cur, p1, p2, p3)[1:]:
                    pts.append(pt)
                cur = p3

        elif cmd in ('Z', 'z'):
            pts.append(start)
            cur = start

    return pts


def _parse_svg(svg_file: Path) -> list[tuple[float, float]]:
    tree = ET.parse(svg_file)
    root = tree.getroot()

    # Strip namespace for simpler querying
    for elem in root.iter():
        elem.tag = elem.tag.split('}')[-1]

    path_elem = (
        root.find('.//path[@class="track-surface"]')
        or root.find('.//path')
    )
    if path_elem is None:
        return []

    return _parse_path_d(path_elem.get('d', ''))


def _resample(pts: list[tuple[float, float]], n: int = 600) -> list[tuple[float, float]]:
    """Resample path to n evenly-spaced points by arc length.
    Without this, corners (many bezier samples) are over-represented vs straights,
    causing the car dot to jump around when using simple pct*N indexing.
    """
    if len(pts) < 2:
        return pts
    dists = [0.0]
    for i in range(1, len(pts)):
        dx = pts[i][0] - pts[i - 1][0]
        dy = pts[i][1] - pts[i - 1][1]
        dists.append(dists[-1] + math.sqrt(dx * dx + dy * dy))
    total = dists[-1]
    if total == 0:
        return pts
    result: list[tuple[float, float]] = []
    for j in range(n):
        target = j / n * total
        lo, hi = 0, len(dists) - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if dists[mid] <= target:
                lo = mid
            else:
                hi = mid
        if dists[hi] == dists[lo]:
            result.append(pts[lo])
        else:
            t = (target - dists[lo]) / (dists[hi] - dists[lo])
            x = pts[lo][0] + t * (pts[hi][0] - pts[lo][0])
            y = pts[lo][1] + t * (pts[hi][1] - pts[lo][1])
            result.append((x, y))
    return result


def _normalise(pts: list[tuple[float, float]]) -> list[list[float]]:
    """Scale to 0-1 bounding box preserving aspect ratio."""
    if not pts:
        return []
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    scale = max(max_x - min_x, max_y - min_y) or 1.0
    return [
        [round((x - min_x) / scale, 4), round((y - min_y) / scale, 4)]
        for x, y in pts
    ]


def _rotate(path: list[list[float]], baseline: float) -> list[list[float]]:
    """
    Rotate the path list so that index 0 corresponds to lap_dist_pct = 0.

    baseline is the lap_dist_pct where the SVG path starts.
    E.g. baseline=0.327 means path[0] is at the 32.7 % mark of the track.
    The start/finish (pct=0) sits at index int((1 - baseline) * N).
    """
    if not path or baseline == 0.0:
        return path
    n       = len(path)
    offset  = int(round((1.0 - baseline) * n)) % n
    return path[offset:] + path[:offset]


# ── Public API ───────────────────────────────────────────────────────────────

def load_track(track_id: int) -> list[list[float]]:
    """
    Return the normalised, start-aligned coordinate list for `track_id`.
    Returns [] if no SVG is available for that ID.
    """
    svg_file = _DATA_DIR / f"{track_id}.svg"
    cfg_file = _DATA_DIR / f"{track_id}.json"

    if not svg_file.exists():
        return []

    try:
        pts = _parse_svg(svg_file)
        if not pts:
            logger.warning(f"No path data in {svg_file}")
            return []

        # Resample to uniform arc-length spacing BEFORE normalising so that
        # int(pct * N) gives accurate car positions on all track sections.
        pts = _resample(pts, n=600)
        path = _normalise(pts)

        baseline   = 0.0
        clockwise  = True
        if cfg_file.exists():
            cfg       = json.loads(cfg_file.read_text())
            baseline  = float(cfg.get("baseline", 0.0))
            clockwise = bool(cfg.get("clockwise", True))

        # Reverse BEFORE rotating so the rotation offset stays correct.
        if clockwise:
            path = list(reversed(path))

        path = _rotate(path, baseline)

        logger.info(f"Loaded SVG track {track_id}: {len(path)} points (baseline={baseline})")
        return path

    except Exception as e:
        logger.error(f"Failed to load track SVG {track_id}: {e}")
        return []


def has_track(track_id: int) -> bool:
    return (_DATA_DIR / f"{track_id}.svg").exists()
