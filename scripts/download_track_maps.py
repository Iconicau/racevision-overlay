"""
One-time script — downloads iRacing track SVGs from iTelemetry/iracing-tracks (GitHub).
No iRacing credentials required. Run once; bundle the output with the app.

Output: backend/data/tracks/{id}.svg  +  backend/data/tracks/{id}.json
"""
import json
import ssl
import sys
import time
import urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/iTelemetry/iracing-tracks/main"
OUT  = Path(__file__).parent.parent / "backend" / "data" / "tracks"

# Cloudflare WARP intercepts TLS on this machine.
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode    = ssl.CERT_NONE


def fetch(url: str) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RaceVision/0.1"})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None   # track ID doesn't exist
        raise
    except Exception as e:
        print(f"  WARN: {url} → {e}")
        return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped    = 0

    # iRacing track IDs run from 1 up to ~600+ with many gaps
    ids_to_try = list(range(1, 700))

    print(f"Downloading iRacing track maps to {OUT}")
    print(f"Trying {len(ids_to_try)} possible track IDs (gaps are normal)...\n")

    for track_id in ids_to_try:
        svg_path = OUT / f"{track_id}.svg"
        cfg_path = OUT / f"{track_id}.json"

        # Skip if already downloaded
        if svg_path.exists() and cfg_path.exists():
            skipped += 1
            continue

        svg_data = fetch(f"{BASE}/svgs/{track_id}.svg")
        if svg_data is None:
            continue  # this ID doesn't exist

        cfg_data = fetch(f"{BASE}/configs/{track_id}.json")

        svg_path.write_bytes(svg_data)
        if cfg_data:
            cfg_path.write_bytes(cfg_data)
        else:
            # Write a default config if missing
            cfg_path.write_text(json.dumps({"baseline": 0.0, "clockwise": True}))

        downloaded += 1
        if downloaded % 10 == 0:
            print(f"  {downloaded} downloaded so far...")
        time.sleep(0.05)   # be polite to GitHub

    print(f"\nDone! {downloaded} new tracks downloaded, {skipped} already existed.")
    print(f"Track maps saved to: {OUT}")


if __name__ == "__main__":
    main()
