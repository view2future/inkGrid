#!/usr/bin/env python3

"""Build an InkGrid char crop dataset using grid layout + detector hints.

This script keeps the most reliable part of the current pipeline (layout-driven
reading order + full-text labeling), while using a trained detector to improve
crop boxes inside each cell.

It is intended to reduce *clipping* (stroke tails cut off) while keeping
cross-cell swallow under control via the same safe-corridor midlines used in
`scripts/workbench_build_dataset.py`.

Inputs:

- stele-dir: a directory containing page images and optional workbench/pages.json
- detections-json: output of scripts/ml_yolo_predict_pages.py
- alignment-text: full transcription string (optional but recommended)

Outputs:

- out-dir/index.json
- out-dir/*.webp (square normalized crops)
- out-dir/overlays/* (optional)
- optional QA report (calls scripts/qa_char_crops.py)
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None


def _load_extractor(repo_root: Path):
    extract_path = (repo_root / "scripts" / "extract_lantingjixu_chars.py").resolve()
    spec = importlib.util.spec_from_file_location("extract_lantingjixu_chars", extract_path)
    if spec is None or spec.loader is None:
        raise SystemExit("cannot import extractor")
    mod = importlib.util.module_from_spec(spec)
    # Python 3.14 dataclasses expects the module to exist in sys.modules.
    sys.modules[str(spec.name)] = mod
    spec.loader.exec_module(mod)
    return mod


def split_axis(proj: Any, expected_count: int) -> list[int]:
    # Copied from scripts/workbench_preview_page.py for consistency.
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
                v = (
                    dp[i - 1][k]
                    + cand_cost[i][j]
                    + size_lambda * (cell - 1.0) * (cell - 1.0)
                )
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


def cp_tag(ch: str) -> str:
    if not ch:
        return "U003F"
    cp = ord(ch)
    if cp <= 0xFFFF:
        return f"U{cp:04X}"
    return f"U{cp:06X}"


def clamp_box(box: list[int], *, w: int, h: int) -> list[int]:
    x0, y0, x1, y1 = box
    x0 = max(0, min(int(x0), w))
    x1 = max(0, min(int(x1), w))
    y0 = max(0, min(int(y0), h))
    y1 = max(0, min(int(y1), h))
    if x1 <= x0:
        x1 = min(w, x0 + 1)
    if y1 <= y0:
        y1 = min(h, y0 + 1)
    return [x0, y0, x1, y1]


def intersect(a: list[int], b: list[int]) -> list[int] | None:
    x0 = max(a[0], b[0])
    y0 = max(a[1], b[1])
    x1 = min(a[2], b[2])
    y1 = min(a[3], b[3])
    if x1 <= x0 or y1 <= y0:
        return None
    return [x0, y0, x1, y1]


def expand(box: list[int], *, pad_px: int) -> list[int]:
    return [box[0] - pad_px, box[1] - pad_px, box[2] + pad_px, box[3] + pad_px]


def box_iou(a: list[int], b: list[int]) -> float:
    inter = intersect(a, b)
    if not inter:
        return 0.0
    ia = (inter[2] - inter[0]) * (inter[3] - inter[1])
    aa = (a[2] - a[0]) * (a[3] - a[1])
    ba = (b[2] - b[0]) * (b[3] - b[1])
    return float(ia) / float(max(1.0, aa + ba - ia))


def dilate_3x3(mask: Any):
    assert np is not None
    padded = np.pad(mask, ((1, 1), (1, 1)), mode="constant", constant_values=False)
    out = np.zeros_like(mask, dtype=bool)
    h, w = mask.shape
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= padded[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
    return out


def contact_ink_sides(
    page_ink: Any,
    *,
    crop_box: list[int],
    ring_px: int,
    band_ratio: float,
) -> dict[str, int]:
    """Directional contact-ink counts around a crop.

    "Contact ink" means ink pixels in the outer ring that touch ink inside the crop.
    This is a strong signal that the crop is clipping stroke tails.
    """

    assert np is not None
    x0, y0, x1, y1 = (int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))
    h, w = page_ink.shape
    r = max(1, int(ring_px))

    ex0 = max(0, x0 - r)
    ey0 = max(0, y0 - r)
    ex1 = min(w, x1 + r)
    ey1 = min(h, y1 + r)
    if ex1 <= ex0 + 1 or ey1 <= ey0 + 1:
        return {"left": 0, "right": 0, "top": 0, "bottom": 0, "total": 0}

    outer = page_ink[ey0:ey1, ex0:ex1]
    ring = outer.copy()

    ix0 = max(0, x0 - ex0)
    iy0 = max(0, y0 - ey0)
    ix1 = max(0, x1 - ex0)
    iy1 = max(0, y1 - ey0)
    ix0 = min(ix0, ring.shape[1])
    ix1 = min(ix1, ring.shape[1])
    iy0 = min(iy0, ring.shape[0])
    iy1 = min(iy1, ring.shape[0])
    ring[iy0:iy1, ix0:ix1] = False

    inner = np.zeros_like(ring, dtype=bool)
    inner_mask = page_ink[y0:y1, x0:x1]
    ih, iw = inner_mask.shape
    inner[iy0 : iy0 + ih, ix0 : ix0 + iw] = inner_mask
    contact = ring & dilate_3x3(inner)

    # Side bands: only count contacts in the center band of the opposite axis.
    bh = max(1, iy1 - iy0)
    bw = max(1, ix1 - ix0)
    band_ratio = float(max(0.1, min(1.0, band_ratio)))
    pad_y = int(round(bh * (1.0 - band_ratio) / 2.0))
    pad_x = int(round(bw * (1.0 - band_ratio) / 2.0))
    by0 = max(0, iy0 + pad_y)
    by1 = min(contact.shape[0], iy1 - pad_y)
    bx0 = max(0, ix0 + pad_x)
    bx1 = min(contact.shape[1], ix1 - pad_x)

    left = int(contact[by0:by1, :ix0].sum())
    right = int(contact[by0:by1, ix1:].sum())
    top = int(contact[:iy0, bx0:bx1].sum())
    bottom = int(contact[iy1:, bx0:bx1].sum())
    return {"left": left, "right": right, "top": top, "bottom": bottom, "total": int(contact.sum())}


def ink_ratio(mask: Any, *, box: list[int]) -> float:
    assert np is not None
    x0, y0, x1, y1 = (int(box[0]), int(box[1]), int(box[2]), int(box[3]))
    x1 = max(x1, x0 + 1)
    y1 = max(y1, y0 + 1)
    region = mask[y0:y1, x0:x1]
    denom = float(max(1, region.shape[0] * region.shape[1]))
    return float(region.sum()) / denom


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stele-slug", required=True)
    ap.add_argument("--stele-dir", required=True)
    ap.add_argument("--pages-dir", default=None, help="defaults to stele-dir")
    ap.add_argument("--detections-json", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--direction", required=True, choices=["vertical_rtl", "horizontal_ltr"])
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--inner-pad", type=int, default=30)
    ap.add_argument("--alignment-text", default=None)
    ap.add_argument("--format", choices=["png", "webp"], default="webp")
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--det-iou-thr", type=float, default=0.08)
    ap.add_argument("--det-topk", type=int, default=4)
    ap.add_argument("--det-pad-ratio", type=float, default=0.08)
    ap.add_argument("--det-pad-min", type=int, default=6)
    ap.add_argument("--strict-ink-thr", type=int, default=115)
    ap.add_argument("--loose-ink-thr", type=int, default=150)
    ap.add_argument("--cell-empty-ink-ratio", type=float, default=0.0006)
    ap.add_argument("--expand-ring-px", type=int, default=10)
    ap.add_argument("--expand-side-thr", type=int, default=25)
    ap.add_argument("--expand-band-ratio", type=float, default=0.6)
    ap.add_argument("--expand-step-ratio", type=float, default=0.08)
    ap.add_argument("--expand-step-min", type=int, default=4)
    ap.add_argument("--expand-max-iters", type=int, default=2)
    ap.add_argument("--run-qa", action="store_true")
    args = ap.parse_args()

    stele_dir = Path(args.stele_dir).resolve()
    pages_dir = Path(args.pages_dir).resolve() if args.pages_dir else stele_dir
    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "overlays").mkdir(parents=True, exist_ok=True)

    repo_root = Path(__file__).resolve().parent.parent
    mod = _load_extractor(repo_root)
    ink_mask = getattr(mod, "ink_mask")
    trim_glyph = getattr(mod, "trim_glyph")
    render_square = getattr(mod, "render_square")

    det_data = json.loads(Path(args.detections_json).read_text(encoding="utf-8"))
    det_pages = det_data.get("pages")
    if not isinstance(det_pages, dict):
        raise SystemExit("detections-json must contain {pages:{...}}")

    # Workbench ordering + overrides + (optional) stored layout.
    workbench_pages: list[dict] = []
    wb_path = stele_dir / "workbench" / "pages.json"
    if wb_path.exists():
        try:
            wb = json.loads(wb_path.read_text(encoding="utf-8"))
            workbench_pages = list(wb.get("pages") or [])
        except Exception:
            workbench_pages = []

    # Determine page order.
    pages: list[Path] = []
    existing = {p.name: p for p in pages_dir.iterdir() if p.is_file()}
    for e in workbench_pages:
        name = str((e or {}).get("image") or "").strip()
        if name and name in existing:
            pages.append(existing[name])
    for p in sorted(existing.values(), key=lambda x: x.name):
        if p not in pages and p.name in det_pages:
            pages.append(p)
    if not pages:
        raise SystemExit("No pages found")

    # Alignment text.
    align_text = ""
    if args.alignment_text:
        p = Path(args.alignment_text)
        align_text = p.read_text(encoding="utf-8").strip() if p.exists() else str(args.alignment_text).strip()

    index_entries: list[dict] = []
    global_idx = 0
    used_by_page: dict[str, int] = {}
    used_cells_with_det = 0
    total_cells = 0

    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    for page_i, page_path in enumerate(pages, start=1):
        page_name = page_path.name
        dets_raw = det_pages.get(page_name) or []
        dets: list[dict] = []
        for d in dets_raw:
            if not isinstance(d, dict):
                continue
            xyxy = d.get("xyxy")
            if not (isinstance(xyxy, list) and len(xyxy) == 4):
                continue
            try:
                b = [int(round(float(xyxy[0]))), int(round(float(xyxy[1]))), int(round(float(xyxy[2]))), int(round(float(xyxy[3])))]
            except Exception:
                continue
            dets.append({"xyxy": b, "score": float(d.get("score") or 0.0)})

        img = Image.open(page_path).convert("RGB")
        w, h = img.width, img.height
        arr = np.asarray(img) if np is not None else None
        strict_ink = (
            ink_mask(arr, ink_threshold=int(args.strict_ink_thr)) if (arr is not None) else None
        )
        loose_ink = (
            ink_mask(arr, ink_threshold=int(args.loose_ink_thr)) if (arr is not None) else None
        )

        page_override: dict | None = None
        page_layout: dict | None = None
        for e in workbench_pages:
            if str((e or {}).get("image") or "") == page_name:
                page_override = (e or {}).get("override")
                page_layout = (e or {}).get("layout")
                break

        page_direction = str((page_override or {}).get("direction") or args.direction)
        page_cols = int((page_override or {}).get("cols") or args.cols)
        page_rows = int((page_override or {}).get("rows") or args.rows)
        page_cols = page_cols if page_cols > 0 else int(args.cols)
        page_rows = page_rows if page_rows > 0 else int(args.rows)
        total_cells += int(page_cols * page_rows)

        # Load stored layout if present.
        x_bounds = None
        y_bounds = None
        y_bounds_by_col: list[list[int]] | None = None
        x_bounds_by_row: list[list[int]] | None = None

        if isinstance(page_layout, dict):
            if page_direction == "vertical_rtl":
                xb = page_layout.get("col_bounds")
                rb = page_layout.get("row_bounds_by_col")
                if isinstance(xb, list) and len(xb) == page_cols + 1 and isinstance(rb, list) and len(rb) == page_cols:
                    x_bounds = [int(v) for v in xb]
                    y_bounds_by_col = [[int(v) for v in r] for r in rb]
            else:
                yb = page_layout.get("row_bounds")
                cb = page_layout.get("col_bounds_by_row")
                if isinstance(yb, list) and len(yb) == page_rows + 1 and isinstance(cb, list) and len(cb) == page_rows:
                    y_bounds = [int(v) for v in yb]
                    x_bounds_by_row = [[int(v) for v in r] for r in cb]

        # Compute layout if missing.
        if (x_bounds is None and y_bounds is None) and (strict_ink is not None):
            if page_direction == "vertical_rtl":
                proj_x = strict_ink.sum(axis=0).astype("float32")
                x_bounds = split_axis(proj_x, page_cols)
                y_bounds_by_col = []
                for col in range(page_cols):
                    cx0 = int(x_bounds[col])
                    cx1 = int(x_bounds[col + 1])
                    proj_y = strict_ink[:, cx0:cx1].sum(axis=1).astype("float32")
                    y_bounds_by_col.append(split_axis(proj_y, page_rows))
            else:
                proj_y = strict_ink.sum(axis=1).astype("float32")
                y_bounds = split_axis(proj_y, page_rows)
                x_bounds_by_row = []
                for row in range(page_rows):
                    ry0 = int(y_bounds[row])
                    ry1 = int(y_bounds[row + 1])
                    proj_x = strict_ink[ry0:ry1, :].sum(axis=0).astype("float32")
                    x_bounds_by_row.append(split_axis(proj_x, page_cols))

        cell_w = w / float(page_cols)
        cell_h = h / float(page_rows)

        if page_direction == "vertical_rtl":
            col_order = list(range(page_cols - 1, -1, -1))
            row_order = list(range(page_rows))
        else:
            col_order = list(range(page_cols))
            row_order = list(range(page_rows))

        overlay = img.copy()
        draw = ImageDraw.Draw(overlay)

        for ci, col in enumerate(col_order):
            for ri, row in enumerate(row_order):
                # Cell box
                if page_direction == "vertical_rtl":
                    x0 = int(x_bounds[col]) if x_bounds is not None else int(round(col * cell_w))
                    x1 = int(x_bounds[col + 1]) if x_bounds is not None else int(round((col + 1) * cell_w))
                    if y_bounds_by_col is not None:
                        bounds = y_bounds_by_col[col]
                        y0 = int(bounds[row])
                        y1 = int(bounds[row + 1])
                    else:
                        y0 = int(round(row * cell_h))
                        y1 = int(round((row + 1) * cell_h))
                else:
                    y0 = int(y_bounds[row]) if y_bounds is not None else int(round(row * cell_h))
                    y1 = int(y_bounds[row + 1]) if y_bounds is not None else int(round((row + 1) * cell_h))
                    if x_bounds_by_row is not None:
                        bounds = x_bounds_by_row[row]
                        x0 = int(bounds[col])
                        x1 = int(bounds[col + 1])
                    else:
                        x0 = int(round(col * cell_w))
                        x1 = int(round((col + 1) * cell_w))

                x1 = max(x1, x0 + 1)
                y1 = max(y1, y0 + 1)
                cell_box = [x0, y0, x1, y1]

                # Safe corridor midlines (same as workbench_build_dataset).
                if page_direction == "vertical_rtl" and x_bounds is not None:
                    left_mid = 0 if col == 0 else int(round((x_bounds[col - 1] + x_bounds[col]) / 2.0))
                    right_mid = w if col == page_cols - 1 else int(round((x_bounds[col + 1] + x_bounds[col + 2]) / 2.0))
                elif page_direction == "horizontal_ltr" and x_bounds_by_row is not None:
                    bounds = x_bounds_by_row[row]
                    left_mid = 0 if col == 0 else int(round((bounds[col - 1] + bounds[col]) / 2.0))
                    right_mid = w if col == page_cols - 1 else int(round((bounds[col + 1] + bounds[col + 2]) / 2.0))
                else:
                    left_mid, right_mid = x0, x1

                if page_direction == "vertical_rtl" and y_bounds_by_col is not None:
                    bounds = y_bounds_by_col[col]
                    top_mid = 0 if row == 0 else int(round((bounds[row - 1] + bounds[row]) / 2.0))
                    bottom_mid = h if row == page_rows - 1 else int(round((bounds[row + 1] + bounds[row + 2]) / 2.0))
                elif page_direction == "horizontal_ltr" and y_bounds is not None:
                    top_mid = 0 if row == 0 else int(round((y_bounds[row - 1] + y_bounds[row]) / 2.0))
                    bottom_mid = h if row == page_rows - 1 else int(round((y_bounds[row + 1] + y_bounds[row + 2]) / 2.0))
                else:
                    top_mid, bottom_mid = y0, y1

                safe_column_box = [int(left_mid), 0, int(right_mid), h]
                safe_row_box = [int(left_mid), int(top_mid), int(right_mid), int(bottom_mid)]

                flags: list[str] = []
                if strict_ink is not None:
                    r = ink_ratio(strict_ink, box=cell_box)
                    if r <= float(args.cell_empty_ink_ratio):
                        flags.append("empty_cell")

                # Choose best detection for this cell (top-k candidates).
                cand: list[dict[str, Any]] = []
                for d in dets:
                    bb = clamp_box(d["xyxy"], w=w, h=h)
                    iou = box_iou(bb, cell_box)
                    if iou < float(args.det_iou_thr):
                        continue
                    cx = (bb[0] + bb[2]) / 2.0
                    cy = (bb[1] + bb[3]) / 2.0
                    center_in = (cell_box[0] <= cx <= cell_box[2]) and (cell_box[1] <= cy <= cell_box[3])
                    s = float(d.get("score") or 0.0)
                    cand.append({"xyxy": bb, "score": s, "iou": iou, "center_in": center_in})

                cand.sort(key=lambda x: (not bool(x["center_in"]), -float(x["iou"]), -float(x["score"])))
                cand = cand[: max(0, int(args.det_topk))]

                # Fallback heuristic crop.
                crop_box = cell_box
                det_used = None
                if cand:
                    # Try candidates; prefer ones that survive safe-clamp.
                    for best in cand:
                        bb = best["xyxy"]
                        pad = max(
                            int(
                                round(
                                    min(bb[2] - bb[0], bb[3] - bb[1])
                                    * float(args.det_pad_ratio)
                                )
                            ),
                            int(args.det_pad_min),
                        )
                        bb2 = expand(bb, pad_px=pad)
                        bb2 = clamp_box(bb2, w=w, h=h)
                        clipped = intersect(bb2, safe_row_box) or intersect(bb2, safe_column_box)
                        if clipped is None:
                            clipped = bb2

                        clipped = clamp_box(clipped, w=w, h=h)
                        area0 = float(max(1, (bb2[2] - bb2[0]) * (bb2[3] - bb2[1])))
                        area1 = float(max(1, (clipped[2] - clipped[0]) * (clipped[3] - clipped[1])))
                        # If safe clamp kills too much of the box, try the next candidate.
                        if area1 / area0 < 0.55:
                            continue
                        crop_box = clipped
                        det_used = best
                        used_cells_with_det += 1
                        used_by_page[page_name] = used_by_page.get(page_name, 0) + 1
                        break
                else:
                    # Use ink-trim inside cell.
                    try:
                        cell_crop = img.crop((x0, y0, x1, y1))
                        _, bbox, _q = trim_glyph(
                            cell_crop,
                            expected_center=(float((x1 - x0) / 2.0), float((y1 - y0) / 2.0)),
                            ink_threshold=150,
                            pad_px=max(8, int(round(min(x1 - x0, y1 - y0) * 0.14))),
                        )
                        if bbox:
                            crop_box = [x0 + int(bbox[0]), y0 + int(bbox[1]), x0 + int(bbox[2]), y0 + int(bbox[3])]
                    except Exception:
                        crop_box = cell_box

                crop_box = clamp_box(crop_box, w=w, h=h)

                # Post-process: expand outwards if we see contact ink (reduce clipping).
                expand_iters = 0
                expand_log: list[dict[str, Any]] = []
                if loose_ink is not None and int(args.expand_max_iters) > 0:
                    for _it in range(int(args.expand_max_iters)):
                        c = contact_ink_sides(
                            loose_ink,
                            crop_box=crop_box,
                            ring_px=int(args.expand_ring_px),
                            band_ratio=float(args.expand_band_ratio),
                        )
                        step = max(
                            int(args.expand_step_min),
                            int(
                                round(
                                    min(crop_box[2] - crop_box[0], crop_box[3] - crop_box[1])
                                    * float(args.expand_step_ratio)
                                )
                            ),
                        )

                        dx0 = -step if c["left"] >= int(args.expand_side_thr) else 0
                        dx1 = step if c["right"] >= int(args.expand_side_thr) else 0
                        dy0 = -step if c["top"] >= int(args.expand_side_thr) else 0
                        dy1 = step if c["bottom"] >= int(args.expand_side_thr) else 0
                        if dx0 == dx1 == dy0 == dy1 == 0:
                            break

                        next_box = [
                            crop_box[0] + dx0,
                            crop_box[1] + dy0,
                            crop_box[2] + dx1,
                            crop_box[3] + dy1,
                        ]
                        next_box = clamp_box(next_box, w=w, h=h)
                        # keep within safe corridor
                        next_box = intersect(next_box, safe_row_box) or intersect(next_box, safe_column_box) or next_box
                        next_box = clamp_box(next_box, w=w, h=h)

                        expand_log.append({"contact": c, "step": step, "box": next_box})
                        crop_box = next_box
                        expand_iters += 1

                if expand_iters:
                    flags.append("expanded")

                out_img = render_square(
                    img.crop((int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))),
                    size=int(args.size),
                    inner_pad=int(args.inner_pad),
                    expected_center=(float((x1 - x0) / 2.0), float((y1 - y0) / 2.0)),
                )

                global_idx += 1
                ch = align_text[global_idx - 1] if global_idx - 1 < len(align_text) else "?"
                code = cp_tag(ch)
                # Reading-order indices: line_index=ci, pos_in_line=ri
                file_ext = str(args.format).lower()
                filename = (
                    f"{args.stele_slug}_i{global_idx:04d}_p{page_i:02d}_c{ci+1:02d}_r{ri+1:02d}_{code}.{file_ext}"
                )

                out_path = out_dir / filename
                if file_ext == "webp":
                    out_img.save(
                        out_path,
                        format="WEBP",
                        quality=int(max(1, min(100, int(args.quality)))),
                        method=6,
                    )
                else:
                    out_img.save(out_path, format="PNG", optimize=True)

                if font:
                    draw.text((x0 + 4, y0 + 4), f"{global_idx:04d}", fill=(255, 255, 255), font=font)
                draw.rectangle(crop_box, outline=(80, 255, 170), width=2)
                if det_used is not None:
                    draw.rectangle(det_used["xyxy"], outline=(255, 200, 80), width=2)

                page_ref = f"pages_raw/{page_name}" if (stele_dir / "pages_raw" / page_name).exists() else page_name

                index_entries.append(
                    {
                        "index": global_idx,
                        "char": ch,
                        "char_trad": ch,
                        "char_simp": ch,
                        "codepoint": code.replace("U", "U+"),
                        "file": filename,
                        "source": {
                            "image": page_ref,
                            "image_index": page_i,
                            "page_override": page_override,
                            "grid": {"col": int(col), "row": int(row)},
                            "grid_reading": {"col": int(ci + 1), "row": int(ri + 1)},
                            "line_index": int(ci),
                            "pos_in_line": int(ri),
                            "cell_box": cell_box,
                            "crop_box": crop_box,
                            "safe_column_box": safe_column_box,
                            "safe_row_box": safe_row_box,
                            "detector": det_used,
                            "postprocess": {"expand_iters": expand_iters, "expand": expand_log[-1] if expand_log else None},
                            "flags": flags,
                        },
                    }
                )

        overlay.save(out_dir / "overlays" / f"page_{page_i:02d}_det.png", format="PNG", optimize=True)

    index = {
        "total_chars": len(index_entries),
        "meta": {
            "stele_slug": str(args.stele_slug),
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "direction": str(args.direction),
            "default_grid": {"cols": int(args.cols), "rows": int(args.rows)},
            "expected_cells": int(total_cells),
            "text_len": int(len(align_text)),
            "detector": {
                "detections_json": str(Path(args.detections_json)),
                "iou_thr": float(args.det_iou_thr),
                "pad_ratio": float(args.det_pad_ratio),
                "pad_min": int(args.det_pad_min),
            },
            "usage": {
                "cells": int(total_cells),
                "cells_with_detector": int(used_cells_with_det),
                "cells_with_detector_ratio": float(used_cells_with_det) / float(max(1, total_cells)),
                "by_page": used_by_page,
            },
            "output": {
                "format": str(args.format),
                "quality": int(args.quality) if str(args.format) == "webp" else None,
                "size": int(args.size),
                "inner_pad": int(args.inner_pad),
            },
        },
        "files": index_entries,
    }
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.run_qa:
        try:
            import subprocess

            qa_script = (repo_root / "scripts" / "qa_char_crops.py").resolve()
            subprocess.check_call(
                [
                    "python3",
                    str(qa_script),
                    "--dataset-dir",
                    str(out_dir),
                    "--source-dir",
                    str(stele_dir),
                    "--top",
                    "120",
                ]
            )
        except Exception:
            pass

    print(f"done chars={len(index_entries)} out={out_dir}")
    if align_text and len(align_text) != total_cells:
        print(f"warn alignment text len={len(align_text)} expected_cells={total_cells}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
