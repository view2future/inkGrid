#!/usr/bin/env python3

"""Export InkGrid char crop metadata into a YOLO detection dataset.

This script converts existing `index.json` (per-glyph crop boxes) into per-page YOLO
label files (x_center, y_center, w, h normalized), so you can train a detector on
full page images.

Key design choices based on past cropping failures:

- Expand bboxes slightly to reduce clipping.
- If `safe_column_box`/`safe_row_box` exist, clamp expanded bbox into their
  intersection to avoid swallowing neighbor columns.
- Split train/val by page (not by glyph) to prevent leakage.

Dependencies: Python 3, Pillow.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from PIL import Image


@dataclass(frozen=True)
class PageRef:
    stele_dir: Path
    stele_slug: str
    page_name: str
    page_path: Path
    width: int
    height: int

    @property
    def export_name(self) -> str:
        # Avoid collisions across steles.
        return f"{self.stele_slug}__{self.page_name}"


def _as_int_box(v: Any) -> list[int] | None:
    if not isinstance(v, list) or len(v) != 4:
        return None
    try:
        return [int(v[0]), int(v[1]), int(v[2]), int(v[3])]
    except Exception:
        return None


def _clamp_box(box: list[int], *, w: int, h: int) -> list[int]:
    x0, y0, x1, y1 = box
    x0 = max(0, min(x0, w))
    x1 = max(0, min(x1, w))
    y0 = max(0, min(y0, h))
    y1 = max(0, min(y1, h))
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    return [x0, y0, x1, y1]


def _intersect(a: list[int], b: list[int]) -> list[int] | None:
    x0 = max(a[0], b[0])
    y0 = max(a[1], b[1])
    x1 = min(a[2], b[2])
    y1 = min(a[3], b[3])
    if x1 <= x0 or y1 <= y0:
        return None
    return [x0, y0, x1, y1]


def _expand_box(
    box: list[int],
    *,
    expand_ratio: float,
    expand_px: int,
) -> list[int]:
    x0, y0, x1, y1 = box
    bw = max(1, x1 - x0)
    bh = max(1, y1 - y0)
    pad = max(int(round(min(bw, bh) * float(expand_ratio))), int(expand_px))
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]


def _safe_region(src: dict[str, Any]) -> list[int] | None:
    col = _as_int_box(src.get("safe_column_box"))
    row = _as_int_box(src.get("safe_row_box"))
    if col and row:
        return _intersect(col, row)
    return col or row


def _find_page_path(stele_dir: Path, page_name: str) -> Path:
    candidates = [
        stele_dir / page_name,
        stele_dir / "pages_raw" / page_name,
        stele_dir / "workbench" / "pages_raw" / page_name,
        stele_dir / "workbench" / "pages" / page_name,
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            return p
    raise FileNotFoundError(f"Missing page image {page_name} under {stele_dir}")


def _link_or_copy(src: Path, dst: Path, *, copy: bool) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return
    if copy:
        shutil.copy2(src, dst)
        return
    # Prefer hardlink; fall back to symlink.
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


def _iter_dataset_dirs(paths: Iterable[str]) -> list[Path]:
    out: list[Path] = []
    for p in paths:
        d = Path(p).resolve()
        if not d.exists():
            raise SystemExit(f"Missing dataset dir: {d}")
        idx = d / "index.json"
        if not idx.exists():
            raise SystemExit(f"Missing index.json: {idx}")
        out.append(d)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--dataset-dir",
        action="append",
        default=[],
        help="InkGrid dataset dir containing index.json (repeatable)",
    )
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--val-ratio", type=float, default=0.12)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--copy", action="store_true", help="Copy page images (default link)")
    ap.add_argument("--expand-ratio", type=float, default=0.04)
    ap.add_argument("--expand-px", type=int, default=2)
    ap.add_argument(
        "--class-name",
        default="glyph",
        help="Single YOLO class name (default: glyph)",
    )
    args = ap.parse_args()

    dataset_dirs = _iter_dataset_dirs(args.dataset_dir)
    out_dir = Path(args.out_dir).resolve()
    (out_dir / "images" / "train").mkdir(parents=True, exist_ok=True)
    (out_dir / "images" / "val").mkdir(parents=True, exist_ok=True)
    (out_dir / "labels" / "train").mkdir(parents=True, exist_ok=True)
    (out_dir / "labels" / "val").mkdir(parents=True, exist_ok=True)
    (out_dir / "meta").mkdir(parents=True, exist_ok=True)

    rng = random.Random(int(args.seed))

    # Collect annotations grouped by page.
    pages: dict[str, PageRef] = {}
    ann_by_page: dict[str, list[dict[str, Any]]] = {}

    for d in dataset_dirs:
        idx_path = d / "index.json"
        data = json.loads(idx_path.read_text(encoding="utf-8"))
        files = data.get("files")
        if not isinstance(files, list):
            raise SystemExit(f"Invalid index.json (missing files): {idx_path}")

        stele_dir = d.parent
        stele_slug = stele_dir.name

        for e in files:
            if not isinstance(e, dict):
                continue
            src = e.get("source") or {}
            page_name = str(src.get("image") or "").strip()
            crop_box = _as_int_box(src.get("crop_box"))
            if not page_name or not crop_box:
                continue

            page_key = f"{stele_slug}__{page_name}"
            if page_key not in pages:
                page_path = _find_page_path(stele_dir, page_name)
                with Image.open(page_path) as img:
                    w, h = img.size
                pages[page_key] = PageRef(
                    stele_dir=stele_dir,
                    stele_slug=stele_slug,
                    page_name=page_name,
                    page_path=page_path,
                    width=int(w),
                    height=int(h),
                )

            pref = pages[page_key]
            expanded = _expand_box(
                crop_box,
                expand_ratio=float(args.expand_ratio),
                expand_px=int(args.expand_px),
            )
            expanded = _clamp_box(expanded, w=pref.width, h=pref.height)

            safe = _safe_region(src)
            if safe:
                safe = _clamp_box(safe, w=pref.width, h=pref.height)
                clipped = _intersect(expanded, safe)
                if clipped:
                    expanded = clipped

            x0, y0, x1, y1 = expanded
            bw = max(1, x1 - x0)
            bh = max(1, y1 - y0)
            xc = (x0 + x1) / 2.0 / float(pref.width)
            yc = (y0 + y1) / 2.0 / float(pref.height)
            wn = bw / float(pref.width)
            hn = bh / float(pref.height)

            ann = {
                "dataset_dir": str(d),
                "stele_slug": stele_slug,
                "page": page_name,
                "page_export": pages[page_key].export_name,
                "char": str(e.get("char") or ""),
                "index": int(e.get("index") or 0),
                "bbox_xyxy": [int(x0), int(y0), int(x1), int(y1)],
                "yolo": [float(xc), float(yc), float(wn), float(hn)],
                "score": float(e.get("score") or 1.0),
            }
            ann_by_page.setdefault(page_key, []).append(ann)

    page_keys = sorted(pages.keys())
    rng.shuffle(page_keys)
    val_n = max(1, int(round(len(page_keys) * float(args.val_ratio)))) if page_keys else 0
    val_set = set(page_keys[:val_n])

    # Export images + labels.
    meta_pages: list[dict[str, Any]] = []
    ann_out = out_dir / "meta" / "annotations.jsonl"
    with ann_out.open("w", encoding="utf-8") as f_ann:
        for key in sorted(page_keys):
            pref = pages[key]
            split = "val" if key in val_set else "train"

            img_dst = out_dir / "images" / split / pref.export_name
            lbl_dst = out_dir / "labels" / split / (Path(pref.export_name).stem + ".txt")

            _link_or_copy(pref.page_path, img_dst, copy=bool(args.copy))

            lines: list[str] = []
            for a in ann_by_page.get(key, []):
                xc, yc, wn, hn = a["yolo"]
                # One class: 0
                lines.append(f"0 {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}")
                f_ann.write(json.dumps(a, ensure_ascii=False) + "\n")

            lbl_dst.parent.mkdir(parents=True, exist_ok=True)
            lbl_dst.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

            meta_pages.append(
                {
                    "key": key,
                    "split": split,
                    "stele_slug": pref.stele_slug,
                    "page": pref.page_name,
                    "export_name": pref.export_name,
                    "src": str(pref.page_path),
                    "width": pref.width,
                    "height": pref.height,
                    "ann_count": len(ann_by_page.get(key, [])),
                }
            )

    (out_dir / "meta" / "pages.json").write_text(
        json.dumps({"pages": meta_pages}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # YOLO dataset yaml (Ultralytics-compatible).
    (out_dir / "inkgrid.yaml").write_text(
        "\n".join(
            [
                f"path: {out_dir}",
                "train: images/train",
                "val: images/val",
                "names:",
                f"  0: {str(args.class_name)}",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print(f"done pages={len(page_keys)} val={len(val_set)} out={out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
