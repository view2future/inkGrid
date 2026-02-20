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

STELES_SRC_ROOT = ROOT / "steles"

# Extra stele assets that are served by the backend on web,
# but must be present in the bundled Android WebView.
STELES_EXTRA_DIRS: list[str] = [
    "3-kaishu/4-qianhouchibifu",
]


def _ignore_stele_assets(dirpath: str, names: list[str]) -> set[str]:
    ignored: set[str] = set()
    here = Path(dirpath)
    for name in names:
        if name in {".DS_Store", "old"}:
            ignored.add(name)
            continue

        p = here / name
        if not p.is_file():
            continue

        suffix = p.suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png"}:
            continue

        # Prefer webp when available.
        if p.with_suffix(".webp").exists():
            ignored.add(name)

    return ignored


def _prune_non_webp_when_webp_exists(root: Path) -> int:
    removed = 0
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        suffix = p.suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png"}:
            continue
        if p.with_suffix(".webp").exists():
            p.unlink(missing_ok=True)
            removed += 1
    return removed


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

    public_root = DEST.parent
    steles_dest_root = public_root / "steles"
    if not steles_dest_root.exists():
        raise SystemExit(f"Android assets steles dir not found: {steles_dest_root}")

    copied_dirs = 0
    for rel in STELES_EXTRA_DIRS:
        src_dir = (STELES_SRC_ROOT / rel).resolve()
        if not src_dir.exists():
            raise SystemExit(f"Stele asset dir not found: {src_dir}")

        dest_dir = (steles_dest_root / rel).resolve()
        dest_dir.parent.mkdir(parents=True, exist_ok=True)

        shutil.copytree(
            src_dir,
            dest_dir,
            dirs_exist_ok=True,
            ignore=_ignore_stele_assets,
        )

        removed = _prune_non_webp_when_webp_exists(dest_dir)
        if removed:
            print(f"pruned {removed} non-webp files in {dest_dir.relative_to(ROOT)}")

        copied_dirs += 1
        print(
            f"synced {src_dir.relative_to(ROOT)} -> {dest_dir.relative_to(ROOT)}"
        )

    if copied_dirs:
        print("done", copied_dirs, "stele dirs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
