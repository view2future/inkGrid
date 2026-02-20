#!/usr/bin/env python3

"""Build a reading-order detection sequence from page-level detections.

This script takes detections on full page images (xyxy bboxes) and assigns each
detection to a grid cell using the same layout logic used by the workbench.

It also computes simple quality signals used for filtering:

- ink_ratio (strict ink mask)
- red_ratio (seal-like pixels)

By default it marks detections that look like seals/noise as ignored.

Output format:

{
  "meta": {...},
  "detections": [ { "id", "page", "page_index", "xyxy", "score", "cell", "ink_ratio", "red_ratio", "flags" }, ... ]
}
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image

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
    sys.modules[str(spec.name)] = mod
    spec.loader.exec_module(mod)
    return mod


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


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stele-dir", required=True)
    ap.add_argument("--pages-dir", default=None, help="defaults to stele-dir")
    ap.add_argument("--detections-json", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--direction", required=True, choices=["vertical_rtl", "horizontal_ltr"])
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--strict-ink-thr", type=int, default=115)
    ap.add_argument("--seal-red-ratio", type=float, default=0.10)
    ap.add_argument("--min-ink-ratio", type=float, default=0.0005)
    ap.add_argument("--seal-ignore-ink-max", type=float, default=0.002)
    ap.add_argument("--ignore-seal", action="store_true", default=True)
    ap.add_argument("--min-box-size", type=int, default=10)
    ap.add_argument("--max-box-area-ratio", type=float, default=0.35)
    ap.add_argument("--keep-duplicates", action="store_true")
    args = ap.parse_args()

    stele_dir = Path(args.stele_dir).resolve()
    pages_dir = Path(args.pages_dir).resolve() if args.pages_dir else stele_dir
    det = json.loads(Path(args.detections_json).read_text(encoding="utf-8"))
    det_pages = det.get("pages")
    if not isinstance(det_pages, dict):
        raise SystemExit("detections-json must contain {pages:{...}}")

    repo_root = Path(__file__).resolve().parent.parent
    mod = _load_extractor(repo_root)
    ink_mask = getattr(mod, "ink_mask")

    # Optional workbench layout.
    workbench_pages: list[dict] = []
    wb_path = stele_dir / "workbench" / "pages.json"
    if wb_path.exists():
        try:
            wb = json.loads(wb_path.read_text(encoding="utf-8"))
            workbench_pages = list(wb.get("pages") or [])
        except Exception:
            workbench_pages = []

    existing = {p.name: p for p in pages_dir.iterdir() if p.is_file()}
    page_names = [p for p in existing.keys() if p in det_pages]
    # Prefer workbench order.
    ordered: list[str] = []
    for e in workbench_pages:
        name = str((e or {}).get("image") or "").strip()
        if name and name in page_names:
            ordered.append(name)
    for n in sorted(page_names):
        if n not in ordered:
            ordered.append(n)

    if not ordered:
        raise SystemExit("No pages matched detections")

    out_dets: list[dict] = []
    for page_i, page_name in enumerate(ordered, start=1):
        page_path = existing[page_name]
        img = Image.open(page_path).convert("RGB")
        w, h = img.size
        if np is None:
            raise SystemExit("numpy required")
        arr = np.asarray(img)
        ink = ink_mask(arr, ink_threshold=int(args.strict_ink_thr))

        # red-ish pixels (seal)
        r = arr[..., 0].astype(np.int16)
        g = arr[..., 1].astype(np.int16)
        b = arr[..., 2].astype(np.int16)
        redish = (r > 120) & ((r - g) > 40) & ((r - b) > 40)

        # layout: try stored bounds first
        page_override: dict | None = None
        page_layout: dict | None = None
        for e in workbench_pages:
            if str((e or {}).get("image") or "") == page_name:
                page_override = (e or {}).get("override")
                page_layout = (e or {}).get("layout")
                break
        cols = int((page_override or {}).get("cols") or args.cols)
        rows = int((page_override or {}).get("rows") or args.rows)
        cols = cols if cols > 0 else int(args.cols)
        rows = rows if rows > 0 else int(args.rows)
        direction = str((page_override or {}).get("direction") or args.direction)

        x_bounds = None
        y_bounds = None
        y_bounds_by_col: list[list[int]] | None = None
        x_bounds_by_row: list[list[int]] | None = None
        if isinstance(page_layout, dict):
            if direction == "vertical_rtl":
                xb = page_layout.get("col_bounds")
                rb = page_layout.get("row_bounds_by_col")
                if isinstance(xb, list) and len(xb) == cols + 1 and isinstance(rb, list) and len(rb) == cols:
                    x_bounds = [int(v) for v in xb]
                    y_bounds_by_col = [[int(v) for v in r] for r in rb]
            else:
                yb = page_layout.get("row_bounds")
                cb = page_layout.get("col_bounds_by_row")
                if isinstance(yb, list) and len(yb) == rows + 1 and isinstance(cb, list) and len(cb) == rows:
                    y_bounds = [int(v) for v in yb]
                    x_bounds_by_row = [[int(v) for v in r] for r in cb]

        if x_bounds is None and y_bounds is None:
            if direction == "vertical_rtl":
                x_bounds = split_axis(ink.sum(axis=0).astype("float32"), cols)
                y_bounds_by_col = []
                for col in range(cols):
                    cx0 = int(x_bounds[col])
                    cx1 = int(x_bounds[col + 1])
                    y_bounds_by_col.append(split_axis(ink[:, cx0:cx1].sum(axis=1).astype("float32"), rows))
            else:
                y_bounds = split_axis(ink.sum(axis=1).astype("float32"), rows)
                x_bounds_by_row = []
                for row in range(rows):
                    ry0 = int(y_bounds[row])
                    ry1 = int(y_bounds[row + 1])
                    x_bounds_by_row.append(split_axis(ink[ry0:ry1, :].sum(axis=0).astype("float32"), cols))

        def find_bin(bounds: list[int], v: float) -> int:
            # bounds is len n+1
            for i in range(len(bounds) - 1):
                if bounds[i] <= v < bounds[i + 1]:
                    return i
            return max(0, len(bounds) - 2)

        # Detections in this page.
        raw = det_pages.get(page_name) or []
        page_out: list[dict] = []
        for k, d in enumerate(raw):
            if not isinstance(d, dict):
                continue
            xyxy = d.get("xyxy")
            if not (isinstance(xyxy, list) and len(xyxy) == 4):
                continue
            x0, y0, x1, y1 = [int(round(float(x))) for x in xyxy]
            x0 = int(clamp(x0, 0, w - 1))
            x1 = int(clamp(x1, x0 + 1, w))
            y0 = int(clamp(y0, 0, h - 1))
            y1 = int(clamp(y1, y0 + 1, h))
            score = float(d.get("score") or 0.0)
            cx = (x0 + x1) / 2.0
            cy = (y0 + y1) / 2.0

            if direction == "vertical_rtl":
                assert x_bounds is not None and y_bounds_by_col is not None
                col = find_bin(x_bounds, cx)
                row = find_bin(y_bounds_by_col[col], cy)
                line_index = int(cols - 1 - col)
                pos_in_line = int(row)
            else:
                assert y_bounds is not None and x_bounds_by_row is not None
                row = find_bin(y_bounds, cy)
                col = find_bin(x_bounds_by_row[row], cx)
                line_index = int(row)
                pos_in_line = int(col)

            ink_ratio = float(ink[y0:y1, x0:x1].sum()) / float(max(1, (y1 - y0) * (x1 - x0)))
            red_ratio = float(redish[y0:y1, x0:x1].sum()) / float(max(1, (y1 - y0) * (x1 - x0)))

            bw = int(x1 - x0)
            bh = int(y1 - y0)
            area_ratio = float(bw * bh) / float(max(1, w * h))

            flags: list[str] = []
            if ink_ratio < float(args.min_ink_ratio):
                flags.append("low_ink")
            if red_ratio >= float(args.seal_red_ratio):
                flags.append("seal_like")

            if bw < int(args.min_box_size) or bh < int(args.min_box_size):
                flags.append("too_small")
            if area_ratio >= float(args.max_box_area_ratio):
                flags.append("too_large")

            ignored = False
            if "too_small" in flags or "too_large" in flags:
                ignored = True
            if bool(args.ignore_seal) and ("seal_like" in flags) and (ink_ratio <= float(args.seal_ignore_ink_max)):
                ignored = True
            if ignored:
                flags.append("ignored")

            det_id = f"{page_name}__{k:05d}"
            page_out.append(
                {
                    "id": det_id,
                    "page": page_name,
                    "page_index": page_i,
                    "xyxy": [x0, y0, x1, y1],
                    "score": score,
                    "cell": {
                        "direction": direction,
                        "cols": cols,
                        "rows": rows,
                        "col": int(col),
                        "row": int(row),
                        "line_index": int(line_index),
                        "pos_in_line": int(pos_in_line),
                    },
                    "ink_ratio": ink_ratio,
                    "red_ratio": red_ratio,
                    "flags": flags,
                }
            )

        # Stable reading order.
        page_out.sort(key=lambda d: (d["cell"]["line_index"], d["cell"]["pos_in_line"], d["xyxy"][0], d["xyxy"][1]))

        if not args.keep_duplicates:
            # Keep only best score per (line,pos)
            by_cell: dict[tuple[int, int], dict] = {}
            for d in page_out:
                key = (int(d["cell"]["line_index"]), int(d["cell"]["pos_in_line"]))
                cur = by_cell.get(key)
                if cur is None or float(d.get("score") or 0.0) > float(cur.get("score") or 0.0):
                    by_cell[key] = d
            page_out = list(by_cell.values())
            page_out.sort(key=lambda d: (d["cell"]["line_index"], d["cell"]["pos_in_line"], d["xyxy"][0], d["xyxy"][1]))

        for d in page_out:
            out_dets.append(d)

    # Global reading order: page_index then line/pos
    out_dets.sort(key=lambda d: (d["page_index"], d["cell"]["line_index"], d["cell"]["pos_in_line"]))

    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "meta": {
            "stele_dir": str(stele_dir),
            "direction": str(args.direction),
            "cols": int(args.cols),
            "rows": int(args.rows),
            "strict_ink_thr": int(args.strict_ink_thr),
        },
        "detections": out_dets,
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"done dets={len(out_dets)} out={out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
