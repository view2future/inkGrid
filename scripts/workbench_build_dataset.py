#!/usr/bin/env python3
"""Build a simple grid-based dataset from workbench uploaded pages.

V1 goal: produce an InkGrid-consumable dataset directory:
- `index.json`
- per-char PNGs (square normalized)
- QA outputs (optional)
- page overlays (grid/crop/qa)

This script intentionally keeps dependencies minimal.
"""

from __future__ import annotations

import argparse
import json
import os
import time
import importlib.util
import sys
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stele-slug", required=True)
    ap.add_argument("--stele-dir", required=True)
    ap.add_argument("--pages-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--direction", required=True, choices=["vertical_rtl", "horizontal_ltr"])
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--inner-pad", type=int, default=30)
    ap.add_argument("--job-file", default=None)
    args = ap.parse_args()

    stele_slug = str(args.stele_slug)
    pages_dir = Path(args.pages_dir)
    out_dir = Path(args.out_dir)
    job_file = Path(args.job_file) if args.job_file else None

    if not pages_dir.exists():
        raise SystemExit(f"Missing pages dir: {pages_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "overlays").mkdir(parents=True, exist_ok=True)

    # Reuse helpers from existing extractor when available.
    # NOTE: scripts/ isn't a Python package, so import via file path.
    repo_root = Path(__file__).resolve().parent.parent
    extract_path = (repo_root / "scripts" / "extract_lantingjixu_chars.py").resolve()
    mod = None
    try:
        spec = importlib.util.spec_from_file_location("extract_lantingjixu_chars", extract_path)
        if spec is not None and spec.loader is not None:
            mod = importlib.util.module_from_spec(spec)
            # Python 3.14 dataclasses expects the module to exist in sys.modules.
            sys.modules[str(spec.name)] = mod
            spec.loader.exec_module(mod)
    except Exception:
        mod = None

    def fallback_render_square(img: Image.Image, size: int, inner_pad: int) -> Image.Image:
        bg = (10, 10, 12)
        canvas = Image.new("RGB", (size, size), bg)
        max_w = max(1, size - inner_pad * 2)
        max_h = max(1, size - inner_pad * 2)
        scale = min(max_w / img.width, max_h / img.height)
        w = max(1, int(round(img.width * scale)))
        h = max(1, int(round(img.height * scale)))
        work = img.resize((w, h), Image.Resampling.LANCZOS)
        canvas.paste(work, ((size - w) // 2, (size - h) // 2))
        return canvas

    if mod is not None and hasattr(mod, "render_square"):
        render_square = getattr(mod, "render_square")
        ink_mask = getattr(mod, "ink_mask", None)
        trim_glyph = getattr(mod, "trim_glyph", None)
    else:
        render_square = None
        ink_mask = None
        trim_glyph = None

    # Load workbench pages ordering + per-page overrides if present.
    workbench_pages: list[dict] = []
    try:
        wb_pages_path = Path(args.stele_dir) / "workbench" / "pages.json"
        if wb_pages_path.exists():
            wb = json.loads(wb_pages_path.read_text(encoding="utf-8"))
            workbench_pages = list(wb.get("pages") or [])
    except Exception:
        workbench_pages = []

    # Load alignment text (optional): if text length matches total cells,
    # use it to label outputs and set codepoints.
    align_text = ""
    try:
        align_path = Path(args.stele_dir) / "workbench" / "alignment.json"
        if align_path.exists():
            a = json.loads(align_path.read_text(encoding="utf-8"))
            align_text = str(a.get("text_trad") or "")
    except Exception:
        align_text = ""

    def cp_tag(ch: str) -> str:
        if not ch:
            return "U003F"
        cp = ord(ch)
        if cp <= 0xFFFF:
            return f"U{cp:04X}"
        return f"U{cp:06X}"

    pages = [
        p
        for p in pages_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    ]
    pages_by_name = {p.name: p for p in pages}

    ordered = []
    for e in workbench_pages:
        name = str((e or {}).get("image") or "").strip()
        p = pages_by_name.get(name)
        if p is not None:
            ordered.append(p)
    for p in sorted(pages, key=lambda x: x.name):
        if p not in ordered:
            ordered.append(p)
    pages = ordered
    if not pages:
        raise SystemExit("No page images found")

    update_job(job_file, stage="layout", progress=10, note=f"pages={len(pages)}")

    index_entries: list[dict] = []
    global_idx = 0

    expected_cells = 0
    for page_path in pages:
        page_override: dict | None = None
        for e in workbench_pages:
            if str((e or {}).get("image") or "") == page_path.name:
                page_override = (e or {}).get("override")
                break
        page_cols = int((page_override or {}).get("cols") or args.cols)
        page_rows = int((page_override or {}).get("rows") or args.rows)
        if page_cols <= 0 or page_rows <= 0:
            page_cols = int(args.cols)
            page_rows = int(args.rows)
        expected_cells += int(page_cols * page_rows)

    def split_axis(proj: Any, expected_count: int) -> list[int]:
        # Return boundaries (len expected_count+1) from 0..len(proj)
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

    for page_i, page_path in enumerate(pages, start=1):
        img = Image.open(page_path).convert("RGB")
        w, h = img.width, img.height

        page_override: dict | None = None
        page_layout: dict | None = None
        for e in workbench_pages:
            if str((e or {}).get("image") or "") == page_path.name:
                page_override = (e or {}).get("override")
                page_layout = (e or {}).get("layout")
                break
        page_direction = str((page_override or {}).get("direction") or args.direction)
        page_cols = int((page_override or {}).get("cols") or args.cols)
        page_rows = int((page_override or {}).get("rows") or args.rows)
        if page_cols <= 0 or page_rows <= 0:
            page_cols = int(args.cols)
            page_rows = int(args.rows)

        # Compute adaptive grid boundaries from projections when numpy is available.
        x_bounds = None
        y_bounds = None
        y_bounds_by_col: list[list[int]] | None = None
        x_bounds_by_row: list[list[int]] | None = None
        ink = None
        if isinstance(page_layout, dict):
            if page_direction == "vertical_rtl":
                xb = page_layout.get("col_bounds")
                rb = page_layout.get("row_bounds_by_col")
                if (
                    isinstance(xb, list)
                    and len(xb) == page_cols + 1
                    and isinstance(rb, list)
                    and len(rb) == page_cols
                ):
                    x_bounds = [int(v) for v in xb]
                    y_bounds_by_col = [[int(v) for v in r] for r in rb]
            else:
                yb = page_layout.get("row_bounds")
                cb = page_layout.get("col_bounds_by_row")
                if (
                    isinstance(yb, list)
                    and len(yb) == page_rows + 1
                    and isinstance(cb, list)
                    and len(cb) == page_rows
                ):
                    y_bounds = [int(v) for v in yb]
                    x_bounds_by_row = [[int(v) for v in r] for r in cb]

        if x_bounds is None and y_bounds is None and np is not None and ink_mask is not None:
            arr = np.asarray(img)
            ink = ink_mask(arr, ink_threshold=115)
            if page_direction == "vertical_rtl":
                proj_x = ink.sum(axis=0).astype("float32")
                x_bounds = split_axis(proj_x, page_cols)
                y_bounds_by_col = []
                for col in range(page_cols):
                    cx0 = int(x_bounds[col])
                    cx1 = int(x_bounds[col + 1])
                    region = ink[:, cx0:cx1]
                    proj_y = region.sum(axis=1).astype("float32")
                    y_bounds_by_col.append(split_axis(proj_y, page_rows))
            else:
                proj_y = ink.sum(axis=1).astype("float32")
                y_bounds = split_axis(proj_y, page_rows)
                x_bounds_by_row = []
                for row in range(page_rows):
                    ry0 = int(y_bounds[row])
                    ry1 = int(y_bounds[row + 1])
                    region = ink[ry0:ry1, :]
                    proj_x = region.sum(axis=0).astype("float32")
                    x_bounds_by_row.append(split_axis(proj_x, page_cols))

        # Uniform grid fallback.
        cell_w = w / float(page_cols)
        cell_h = h / float(page_rows)

        # Reading order
        if page_direction == "vertical_rtl":
            col_order = list(range(page_cols - 1, -1, -1))
            row_order = list(range(page_rows))
        else:
            col_order = list(range(page_cols))
            row_order = list(range(page_rows))

        overlay_grid = img.copy()
        draw = ImageDraw.Draw(overlay_grid)

        # draw grid lines
        if x_bounds is not None:
            for c in range(1, page_cols):
                x = int(x_bounds[c])
                draw.line([(x, 0), (x, h)], fill=(0, 200, 255), width=2)
        else:
            for c in range(1, page_cols):
                x = int(round(c * cell_w))
                draw.line([(x, 0), (x, h)], fill=(0, 200, 255), width=2)

        if page_direction == "vertical_rtl" and y_bounds_by_col is not None and x_bounds is not None:
            for col in range(page_cols):
                cx0 = int(x_bounds[col])
                cx1 = int(x_bounds[col + 1])
                for r in range(1, page_rows):
                    y = int(y_bounds_by_col[col][r])
                    draw.line([(cx0, y), (cx1, y)], fill=(0, 200, 255), width=2)
        else:
            # horizontal_ltr or fallback
            for r in range(1, page_rows):
                y = int(y_bounds[r]) if y_bounds is not None else int(round(r * cell_h))
                draw.line([(0, y), (w, y)], fill=(0, 200, 255), width=2)

        # minimal font fallback
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None

        for ci, col in enumerate(col_order):
            for ri, row in enumerate(row_order):
                if page_direction == "vertical_rtl":
                    if x_bounds is not None:
                        x0 = int(x_bounds[col])
                        x1 = int(x_bounds[col + 1])
                    else:
                        x0 = int(round(col * cell_w))
                        x1 = int(round((col + 1) * cell_w))

                    if y_bounds_by_col is not None:
                        y0 = int(y_bounds_by_col[col][row])
                        y1 = int(y_bounds_by_col[col][row + 1])
                    else:
                        y0 = int(round(row * cell_h))
                        y1 = int(round((row + 1) * cell_h))
                else:
                    if y_bounds is not None:
                        y0 = int(y_bounds[row])
                        y1 = int(y_bounds[row + 1])
                    else:
                        y0 = int(round(row * cell_h))
                        y1 = int(round((row + 1) * cell_h))

                    if x_bounds_by_row is not None:
                        x0 = int(x_bounds_by_row[row][col])
                        x1 = int(x_bounds_by_row[row][col + 1])
                    elif x_bounds is not None:
                        x0 = int(x_bounds[col])
                        x1 = int(x_bounds[col + 1])
                    else:
                        x0 = int(round(col * cell_w))
                        x1 = int(round((col + 1) * cell_w))
                x1 = max(x1, x0 + 1)
                y1 = max(y1, y0 + 1)

                global_idx += 1
                cell_crop = img.crop((x0, y0, x1, y1))

                # Optional glyph trim (best-effort): find ink bbox inside the cell.
                crop_box = [x0, y0, x1, y1]
                if trim_glyph is not None:
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
                        crop_box = [x0, y0, x1, y1]

                if render_square is not None:
                    out = render_square(
                        img.crop((int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))),
                        size=int(args.size),
                        inner_pad=int(args.inner_pad),
                        expected_center=(float((x1 - x0) / 2.0), float((y1 - y0) / 2.0)),
                    )
                else:
                    out = fallback_render_square(
                        img.crop((int(crop_box[0]), int(crop_box[1]), int(crop_box[2]), int(crop_box[3]))),
                        size=int(args.size),
                        inner_pad=int(args.inner_pad),
                    )

                ch = align_text[global_idx - 1] if global_idx - 1 < len(align_text) else "?"
                code = cp_tag(ch)
                filename = f"{stele_slug}_{global_idx:04d}_{code}.png"
                out.save(out_dir / filename, format="PNG", optimize=True)

                # label on overlay
                if font:
                    draw.text((x0 + 4, y0 + 4), f"{global_idx:04d}", fill=(255, 255, 255), font=font)

                # crop box outline
                draw.rectangle(crop_box, outline=(80, 255, 170), width=2)

                page_ref = f"pages_raw/{page_path.name}"

                # Safe corridor midlines (prevents cross-cell swallow).
                # Column safe bounds based on physical neighbor midlines.
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
                            "line_index": int(ci),
                            "pos_in_line": int(ri),
                            "cell_box": [x0, y0, x1, y1],
                            "crop_box": crop_box,
                            "safe_column_box": safe_column_box,
                            "safe_row_box": safe_row_box,
                        },
                    }
                )

        overlay_grid.save(
            out_dir / "overlays" / f"page_{page_i:02d}_grid.png",
            format="PNG",
            optimize=True,
        )

        # V1: crop overlay equals cell overlay (future: draw actual crop boxes).
        overlay_grid.save(
            out_dir / "overlays" / f"page_{page_i:02d}_crop.png",
            format="PNG",
            optimize=True,
        )

        update_job(job_file, stage="crop_render", progress=10 + int(70 * page_i / max(1, len(pages))))

    index = {
        "total_chars": len(index_entries),
        "meta": {
            "stele_slug": stele_slug,
            "direction": str(args.direction),
            "default_grid": {"cols": int(args.cols), "rows": int(args.rows)},
            "expected_cells": int(expected_cells),
            "text_len": int(len(align_text)),
        },
        "files": index_entries,
    }
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    update_job(job_file, stage="qa", progress=90)

    # Optional QA if available.
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
                str(Path(args.stele_dir)),
                "--top",
                "80",
            ]
        )
    except Exception:
        # Ignore QA errors for now.
        pass

    # QA overlay (best-effort): draw red boxes for flagged entries.
    try:
        report_path = out_dir / "qa_report.json"
        if report_path.exists():
            rep = json.loads(report_path.read_text(encoding="utf-8"))
            entries = list(rep.get("entries") or [])
            by_page: dict[str, list[dict]] = {}
            for e in entries:
                if not (e.get("flags") or []):
                    continue
                src = e.get("source") or {}
                page = src.get("image")
                box = src.get("crop_box")
                if not page or not box:
                    continue
                by_page.setdefault(Path(str(page)).name, []).append(
                    {"box": box, "flags": e.get("flags")}
                )

            for page_i, page_path in enumerate(pages, start=1):
                base = Image.open(page_path).convert("RGB")
                d = ImageDraw.Draw(base)
                for it in by_page.get(page_path.name, []):
                    x0, y0, x1, y1 = [int(v) for v in it["box"]]
                    d.rectangle([x0, y0, x1, y1], outline=(255, 80, 90), width=3)
                base.save(
                    out_dir / "overlays" / f"page_{page_i:02d}_qa.png",
                    format="PNG",
                    optimize=True,
                )
    except Exception:
        pass

    update_job(job_file, stage="done", progress=100)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
