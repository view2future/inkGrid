#!/usr/bin/env python3

"""Build a per-stele character classifier dataset from an InkGrid chars dataset.

Why:

For full-text alignment, geometry-only DP can drift on noisy pages (seals, blanks,
merged boxes). A lightweight classifier that predicts top-k candidate characters
for each crop provides a strong extra signal.

This script exports an Ultralytics-compatible classification dataset:

out-dir/
  train/<UXXXX>/<img>.(png|webp)
  val/<UXXXX>/<img>.(png|webp)
  classes.json  # maps UXXXX -> original char

Use with Ultralytics (after install):

  yolo classify train data=<out-dir> model=yolo11n-cls.pt imgsz=224 batch=64 epochs=50 device=mps
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
from pathlib import Path
from typing import Any


def cp_tag(ch: str) -> str:
    if not ch:
        return "U003F"
    cp = ord(ch)
    if cp <= 0xFFFF:
        return f"U{cp:04X}"
    return f"U{cp:06X}"


def _link_or_copy(src: Path, dst: Path, *, copy: bool) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return
    if copy:
        shutil.copy2(src, dst)
        return
    try:
        os.link(src, dst)
        return
    except Exception:
        pass
    try:
        dst.symlink_to(src.resolve())
        return
    except Exception:
        shutil.copy2(src, dst)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--val-ratio", type=float, default=0.12)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--copy", action="store_true")
    args = ap.parse_args()

    dataset_dir = Path(args.dataset_dir).resolve()
    idx_path = dataset_dir / "index.json"
    if not idx_path.exists():
        raise SystemExit(f"Missing index.json: {idx_path}")

    data = json.loads(idx_path.read_text(encoding="utf-8"))
    files = data.get("files")
    if not isinstance(files, list):
        raise SystemExit("Invalid index.json: missing files")

    # Group by page to avoid leakage (optional but useful).
    by_page: dict[str, list[dict[str, Any]]] = {}
    classes: dict[str, str] = {}
    for e in files:
        if not isinstance(e, dict):
            continue
        ch = str(e.get("char") or "")
        file = str(e.get("file") or "")
        if not file:
            continue
        src = e.get("source") or {}
        page = str(src.get("image") or "")
        if page.startswith("pages_raw/"):
            page = page.split("/", 1)[1]
        tag = cp_tag(ch)
        classes[tag] = ch
        by_page.setdefault(page or "__unknown__", []).append({"tag": tag, "file": file})

    rng = random.Random(int(args.seed))
    pages = sorted(by_page.keys())
    rng.shuffle(pages)
    val_n = max(1, int(round(len(pages) * float(args.val_ratio)))) if pages else 0
    val_set = set(pages[:val_n])

    out_dir = Path(args.out_dir).resolve()
    for split in ("train", "val"):
        (out_dir / split).mkdir(parents=True, exist_ok=True)

    total = 0
    for page in pages:
        split = "val" if page in val_set else "train"
        for e in by_page.get(page, []):
            tag = str(e["tag"])
            src_path = dataset_dir / str(e["file"])
            if not src_path.exists():
                continue
            dst = out_dir / split / tag / src_path.name
            _link_or_copy(src_path, dst, copy=bool(args.copy))
            total += 1

    (out_dir / "classes.json").write_text(
        json.dumps({"classes": classes}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"done images={total} classes={len(classes)} out={out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
