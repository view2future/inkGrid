#!/usr/bin/env python3
"""Preview recompute for a single page.

Outputs:
- overlays/page_grid.png (grid + crop)
- overlays/page_crop.png (same as grid for now)
- cells.json (cell_box/crop_box + preview png path)

This is used by Workbench "mouse-up recompute".
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None


def update_job(job_file: Path | None, *, stage: str, progress: int, note: str | None = None) -> None:
    if not job_file:
        return
    try:
        cur = json.loads(job_file.read_text(encoding="utf-8"))
    except Exception:
        return
    cur["status"] = "running"
    cur["stage"] = str(stage)
    cur["progress"] = int(progress)
    cur["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    if note:
        cur["log_tail"] = (str(cur.get("log_tail") or "") + "\n" + str(note)).strip()[-6000:]
    job_file.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def split_axis(proj: Any, expected_count: int) -> list[int]:
    n = int(proj.shape[0])
    if expected_count <= 0:
        return [0, n]
    if expected_count == 1:
        return [0, n]

    step = n / float(expected_count)
    min_cell = max(12, int(round(step * 0.35)))
    win = max(10, int(round(step * 0.60)))
    dev_lambda = 0.55
    size_lambda = 0.90

    proj = proj.astype("float32")
    proj_max = float(max(1.0, float(proj.max())))

    cand_y: list[list[int]] = []
    cand_cost: list[list[float]] = []
    for i in range(1, expected_count):
        remaining = expected_count - i
        y_expect = int(round(step * i))
        lo = int(max(min_cell, y_expect - win))
        hi = int(min(n - remaining * min_cell, y_expect + win))
        if hi <= lo:
            lo = int(max(min_cell, min(y_expect, n - remaining * min_cell - 1)))
            hi = lo + 1
        ys = list(range(lo, hi))
        costs = []
        for y in ys:
            dev = (float(y) - float(y_expect)) / max(1.0, float(step))
            costs.append(float(proj[y]) / proj_max + dev_lambda * dev * dev)
        cand_y.append(ys)
        cand_cost.append(costs)

    INF = 1e18
    dp = [[INF] * len(c) for c in cand_y]
    prev = [[-1] * len(c) for c in cand_y]
    for j, y in enumerate(cand_y[0]):
        cell = float(y) / max(1.0, float(step))
        dp[0][j] = cand_cost[0][j] + size_lambda * (cell - 1.0) * (cell - 1.0)

    for i in range(1, len(cand_y)):
        for j, y in enumerate(cand_y[i]):
            best = INF
            best_k = -1
            for k, y_prev in enumerate(cand_y[i - 1]):
                if y - y_prev < min_cell:
                    continue
                cell = (float(y) - float(y_prev)) / max(1.0, float(step))
                v = dp[i - 1][k] + cand_cost[i][j] + size_lambda * (cell - 1.0) * (cell - 1.0)
                if v < best:
                    best = v
                    best_k = k
            dp[i][j] = best
            prev[i][j] = best_k

    boundaries = [0]
    last_i = len(cand_y) - 1
    best_j = min(range(len(dp[last_i])), key=lambda j: dp[last_i][j])
    chosen = [0] * len(cand_y)
    chosen[last_i] = best_j
    for i in range(last_i, 0, -1):
        chosen[i - 1] = prev[i][chosen[i]]
    for i, j in enumerate(chosen):
        boundaries.append(int(cand_y[i][j]))
    boundaries.append(n)
    return boundaries


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stele-slug", required=True)
    ap.add_argument("--stele-dir", required=True)
    ap.add_argument("--pages-dir", required=True)
    ap.add_argument("--page", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--direction", required=True, choices=["vertical_rtl", "horizontal_ltr"])
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--preview-size", type=int, default=256)
    ap.add_argument("--inner-pad", type=int, default=20)
    ap.add_argument("--job-file", default=None)
    args = ap.parse_args()

    stele_dir = Path(args.stele_dir)
    pages_dir = Path(args.pages_dir)
    page_name = str(args.page)
    out_dir = Path(args.out_dir)
    job_file = Path(args.job_file) if args.job_file else None

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "overlays").mkdir(parents=True, exist_ok=True)

    page_path = pages_dir / page_name
    if not page_path.exists():
        raise SystemExit(f"Missing page: {page_path}")

    update_job(job_file, stage="preview_layout", progress=10)

    img = Image.open(page_path).convert("RGB")
    w, h = img.width, img.height

    # Optional: load saved layout from pages.json
    layout = None
    try:
        pages_json = stele_dir / "workbench" / "pages.json"
        if pages_json.exists():
            wb = json.loads(pages_json.read_text(encoding="utf-8"))
            for e in wb.get("pages") or []:
                if (e or {}).get("image") == page_name:
                    layout = (e or {}).get("layout")
                    break
    except Exception:
        layout = None

    repo_root = Path(__file__).resolve().parent.parent
    extract_path = (repo_root / "scripts" / "extract_lantingjixu_chars.py").resolve()
    spec = importlib.util.spec_from_file_location("extract_lantingjixu_chars", extract_path)
    if spec is None or spec.loader is None:
        raise SystemExit("cannot import extractor")
    mod = importlib.util.module_from_spec(spec)
    # Python 3.14 dataclasses expects the module to exist in sys.modules.
    sys.modules[str(spec.name)] = mod
    spec.loader.exec_module(mod)
    ink_mask = getattr(mod, "ink_mask")
    trim_glyph = getattr(mod, "trim_glyph")
    render_square = getattr(mod, "render_square")

    if np is None:
        raise SystemExit("numpy is required for preview recompute")
    arr = np.asarray(img)
    ink = ink_mask(arr, ink_threshold=115)

    direction = args.direction
    cols = int(args.cols)
    rows = int(args.rows)

    x_bounds = None
    y_bounds = None
    y_bounds_by_col = None
    x_bounds_by_row = None

    if isinstance(layout, dict):
        # trust stored layout if shape matches
        if direction == "vertical_rtl":
            xb = layout.get("col_bounds")
            rb = layout.get("row_bounds_by_col")
            if isinstance(xb, list) and len(xb) == cols + 1 and isinstance(rb, list) and len(rb) == cols:
                x_bounds = [int(v) for v in xb]
                y_bounds_by_col = [[int(v) for v in r] for r in rb]
        else:
            yb = layout.get("row_bounds")
            cb = layout.get("col_bounds_by_row")
            if isinstance(yb, list) and len(yb) == rows + 1 and isinstance(cb, list) and len(cb) == rows:
                y_bounds = [int(v) for v in yb]
                x_bounds_by_row = [[int(v) for v in r] for r in cb]

    if direction == "vertical_rtl":
        if x_bounds is None:
            x_bounds = split_axis(ink.sum(axis=0).astype("float32"), cols)
        if y_bounds_by_col is None:
            y_bounds_by_col = []
            for col in range(cols):
                cx0 = int(x_bounds[col])
                cx1 = int(x_bounds[col + 1])
                proj_y = ink[:, cx0:cx1].sum(axis=1).astype("float32")
                y_bounds_by_col.append(split_axis(proj_y, rows))
    else:
        if y_bounds is None:
            y_bounds = split_axis(ink.sum(axis=1).astype("float32"), rows)
        if x_bounds_by_row is None:
            x_bounds_by_row = []
            for row in range(rows):
                ry0 = int(y_bounds[row])
                ry1 = int(y_bounds[row + 1])
                proj_x = ink[ry0:ry1, :].sum(axis=0).astype("float32")
                x_bounds_by_row.append(split_axis(proj_x, cols))

    # Help type checkers: the above ensures non-None.
    assert x_bounds is not None or direction == "horizontal_ltr"
    assert y_bounds is not None or direction == "vertical_rtl"
    assert y_bounds_by_col is not None or direction == "horizontal_ltr"
    assert x_bounds_by_row is not None or direction == "vertical_rtl"

    # Persist computed layout back to pages.json entry.
    try:
        pages_json = stele_dir / "workbench" / "pages.json"
        if pages_json.exists():
            wb = json.loads(pages_json.read_text(encoding="utf-8"))
        else:
            wb = {"version": 1, "pages": []}
        pages_out = []
        for e in wb.get("pages") or []:
            if (e or {}).get("image") != page_name:
                pages_out.append(e)
                continue
            if direction == "vertical_rtl":
                e = dict(e)
                e["layout"] = {
                    "direction": direction,
                    "cols": cols,
                    "rows": rows,
                    "col_bounds": x_bounds,
                    "row_bounds_by_col": y_bounds_by_col,
                }
                pages_out.append(e)
            else:
                e = dict(e)
                e["layout"] = {
                    "direction": direction,
                    "cols": cols,
                    "rows": rows,
                    "row_bounds": y_bounds,
                    "col_bounds_by_row": x_bounds_by_row,
                }
                pages_out.append(e)
        wb["pages"] = pages_out
        pages_json.write_text(json.dumps(wb, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        pass

    update_job(job_file, stage="preview_render", progress=40)

    overlay = img.copy()
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    cells = []
    preview_dir = out_dir / "cells"
    preview_dir.mkdir(parents=True, exist_ok=True)
    idx_in_page = 0

    x_bounds_v: list[int] = []
    y_bounds_by_col_v: list[list[int]] = []
    y_bounds_h: list[int] = []
    x_bounds_by_row_h: list[list[int]] = []

    if direction == "vertical_rtl":
        assert x_bounds is not None
        assert y_bounds_by_col is not None
        x_bounds_v = x_bounds
        y_bounds_by_col_v = y_bounds_by_col
    else:
        assert y_bounds is not None
        assert x_bounds_by_row is not None
        y_bounds_h = y_bounds
        x_bounds_by_row_h = x_bounds_by_row

    if direction == "vertical_rtl":
        col_order = list(range(cols - 1, -1, -1))
        row_order = list(range(rows))
    else:
        col_order = list(range(cols))
        row_order = list(range(rows))

    for col in range(cols):
        if direction == "vertical_rtl":
            cx0 = int(x_bounds_v[col])
            cx1 = int(x_bounds_v[col + 1])
            draw.line([(cx0, 0), (cx0, h)], fill=(0, 200, 255), width=2)
            if col == cols - 1:
                draw.line([(cx1, 0), (cx1, h)], fill=(0, 200, 255), width=2)
        else:
            # lines drawn per-row below
            pass

    if direction == "horizontal_ltr":
        for r in range(rows + 1):
            y = int(y_bounds_h[r])
            draw.line([(0, y), (w, y)], fill=(0, 200, 255), width=2)

    for col_i, col in enumerate(col_order):
        for row_i, row in enumerate(row_order):
            if direction == "vertical_rtl":
                x0 = int(x_bounds_v[col])
                x1 = int(x_bounds_v[col + 1])
                y0 = int(y_bounds_by_col_v[col][row])
                y1 = int(y_bounds_by_col_v[col][row + 1])
            else:
                y0 = int(y_bounds_h[row])
                y1 = int(y_bounds_h[row + 1])
                x0 = int(x_bounds_by_row_h[row][col])
                x1 = int(x_bounds_by_row_h[row][col + 1])

            idx_in_page += 1
            cell_box = [x0, y0, x1, y1]
            cell_crop = img.crop((x0, y0, x1, y1))
            crop_box = cell_box
            try:
                _, bbox, _q = trim_glyph(
                    cell_crop,
                    expected_center=(float((x1 - x0) / 2.0), float((y1 - y0) / 2.0)),
                    ink_threshold=120,
                    pad_px=max(6, int(round(min(x1 - x0, y1 - y0) * 0.10))),
                )
                if bbox:
                    crop_box = [x0 + int(bbox[0]), y0 + int(bbox[1]), x0 + int(bbox[2]), y0 + int(bbox[3])]
            except Exception:
                crop_box = cell_box

            out = render_square(
                img.crop((int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))),
                size=int(args.preview_size),
                inner_pad=int(args.inner_pad),
                expected_center=(float((x1 - x0) / 2.0), float((y1 - y0) / 2.0)),
            )
            png_name = f"cell_{idx_in_page:04d}.png"
            out.save(preview_dir / png_name, format="PNG", optimize=True)

            draw.rectangle(cell_box, outline=(0, 200, 255), width=2)
            draw.rectangle(crop_box, outline=(80, 255, 170), width=2)
            if font:
                draw.text((x0 + 4, y0 + 4), f"{idx_in_page:04d}", fill=(255, 255, 255), font=font)

            cells.append(
                {
                    "index_in_page": idx_in_page,
                    "line_index": int(col_i) if direction == "vertical_rtl" else int(row),
                    "pos_in_line": int(row_i) if direction == "vertical_rtl" else int(col),
                    "cell_box": cell_box,
                    "crop_box": crop_box,
                    "preview_png": f"cells/{png_name}",
                }
            )

    overlay.save(out_dir / "overlays" / "page_grid.png", format="PNG", optimize=True)
    overlay.save(out_dir / "overlays" / "page_crop.png", format="PNG", optimize=True)
    (out_dir / "cells.json").write_text(
        json.dumps({"page": page_name, "cells": cells}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    update_job(job_file, stage="done", progress=100)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
