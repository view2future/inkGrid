#!/usr/bin/env python3

"""Sync frontend public data into Android assets.

Capacitor Android build keeps a copy of `public/data/*.json` under:
  frontend/android/app/src/main/assets/public/data/

This script copies the canonical JSON files from:
  frontend/public/data/

Run after updating catalog/knowledge/path JSON.

Usage:
  python3 scripts/sync_android_public_data.py
"""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "public" / "data"
DEST = (
    ROOT
    / "frontend"
    / "android"
    / "app"
    / "src"
    / "main"
    / "assets"
    / "public"
    / "data"
)


def main() -> int:
    if not SRC.exists():
        raise SystemExit(f"Source data dir not found: {SRC}")
    if not DEST.exists():
        raise SystemExit(f"Android assets data dir not found: {DEST}")

    copied = 0
    for p in sorted(SRC.glob("*.json")):
        dest = DEST / p.name
        shutil.copy2(p, dest)
        copied += 1
        print(f"copied {p.relative_to(ROOT)} -> {dest.relative_to(ROOT)}")

    print("done", copied, "files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
