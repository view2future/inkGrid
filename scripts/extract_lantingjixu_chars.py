#!/usr/bin/env python3
"""Extract Lantingjixu (兰亭集序) characters into single images.

Input:
  steles/4-xingshu/1-lantingjixu/lantingjixu-*.jpg

It labels characters using the vertical layout text from Wikisource (蘭亭集序).
The Wikisource "竖排" section provides line breaks that correspond to vertical
columns (right-to-left). This lets us constrain per-column character counts.

Output:
  steles/4-xingshu/1-lantingjixu/chars_shenlong/
    - One PNG per character
    - index.json mapping each file to its character and source location
    - text.txt concatenated text used for labeling
    - debug/ overlay images for inspection
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance


WIKISOURCE_RAW_URL = (
    "https://zh.wikisource.org/wiki/%E8%98%AD%E4%BA%AD%E9%9B%86%E5%BA%8F?action=raw"
)


@dataclass
class ColumnBox:
    x0: int
    x1: int


@dataclass
class CharBox:
    x0: int
    y0: int
    x1: int
    y1: int


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input-dir",
        default="steles/4-xingshu/1-lantingjixu",
        help="Directory containing lantingjixu-*.jpg",
    )
    parser.add_argument(
        "--output-dir",
        default="steles/4-xingshu/1-lantingjixu/chars_shenlong",
        help="Output directory for single-character images",
    )
    parser.add_argument("--size", type=int, default=512, help="Output image size")
    parser.add_argument(
        "--inner-pad", type=int, default=30, help="Padding inside canvas"
    )
    parser.add_argument(
        "--cell-margin",
        type=float,
        default=0.02,
        help="Margin ratio to trim inside each char cell",
    )
    parser.add_argument(
        "--context-pad",
        type=float,
        default=0.22,
        help="Extra context ratio around each cell before trimming",
    )
    parser.add_argument(
        "--bbox-ink-threshold",
        type=int,
        default=120,
        help="Grayscale threshold for ink bbox trimming (higher = more ink)",
    )
    parser.add_argument(
        "--bbox-pad",
        type=float,
        default=0.14,
        help="Padding ratio around trimmed ink bbox",
    )
    parser.add_argument(
        "--col-pad",
        type=float,
        default=0.12,
        help="Extra x padding ratio beyond detected column bounds",
    )
    parser.add_argument(
        "--min-cell-ratio",
        type=float,
        default=0.30,
        help="Min cell height ratio of expected step",
    )
    parser.add_argument(
        "--contrast",
        type=float,
        default=1.06,
        help="Contrast boost for the cropped glyph",
    )
    parser.add_argument(
        "--ink-threshold",
        type=int,
        default=100,
        help="Grayscale threshold for ink mask (lower = darker)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Write debug overlay images",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    debug_dir = output_dir / "debug"
    if args.debug:
        debug_dir.mkdir(parents=True, exist_ok=True)

    image_paths = sorted(input_dir.glob("lantingjixu-*.jpg"), key=_natural_page_key)
    if not image_paths:
        raise SystemExit(f"No lantingjixu-*.jpg found in {input_dir}")

    lines = extract_lanting_vertical_lines(fetch_raw(WIKISOURCE_RAW_URL))
    if not lines:
        raise SystemExit("Empty lanting text after cleaning")

    # Detect columns per image; ensure we can align to the extracted text lines.
    col_boxes_by_page: list[list[ColumnBox]] = []
    for p in image_paths:
        img = Image.open(p).convert("RGB")
        arr = np.array(img)
        ink = ink_mask(arr, ink_threshold=int(args.ink_threshold))
        cols = detect_columns(ink)
        if not cols:
            raise SystemExit(f"Failed to detect columns for {p.name}")
        cols = expand_columns(cols, img.width, pad_ratio=float(args.col_pad))
        col_boxes_by_page.append(cols)

    detected_total_cols = sum(len(x) for x in col_boxes_by_page)
    if detected_total_cols != len(lines):
        # Wikisource sometimes wraps the final character "文" onto a separate line.
        # If that happens, merge it back to the previous line.
        if (
            detected_total_cols == len(lines) - 1
            and len(lines) >= 2
            and len(lines[-1]) == 1
        ):
            lines[-2] = lines[-2] + lines[-1]
            lines = lines[:-1]
        else:
            raise SystemExit(
                f"Cannot align: detected {detected_total_cols} columns from images, "
                f"but Wikisource vertical text has {len(lines)} lines. "
                "Try adjusting --ink-threshold or column detection parameters."
            )

    index_entries: list[dict] = []
    global_idx = 0
    global_col_idx = 0

    for page_i, (img_path, col_boxes) in enumerate(
        zip(image_paths, col_boxes_by_page, strict=True), start=1
    ):
        img = Image.open(img_path).convert("RGB")
        arr = np.array(img)
        ink = ink_mask(arr, ink_threshold=int(args.ink_threshold))

        # Debug overlay
        overlay: Image.Image | None = None
        draw: ImageDraw.ImageDraw | None = None
        if args.debug:
            overlay = img.copy()
            draw = ImageDraw.Draw(overlay)

        # Reading order: rightmost column first.
        # Our detect_columns returns left->right segments; reverse.
        col_boxes_sorted = sorted(col_boxes, key=lambda b: b.x0, reverse=True)

        for col_in_page, col_box in enumerate(col_boxes_sorted):
            line_text = lines[global_col_idx]
            global_col_idx += 1
            chars = list(line_text)
            if not chars:
                continue

            char_boxes = split_column_into_chars(
                ink,
                col_box,
                expected_count=len(chars),
                min_cell_ratio=float(args.min_cell_ratio),
            )
            if len(char_boxes) != len(chars):
                raise SystemExit(
                    f"Split mismatch on {img_path.name}: column {col_in_page} expected {len(chars)} chars, "
                    f"got {len(char_boxes)}."
                )

            for row_in_col, (ch, box) in enumerate(zip(chars, char_boxes, strict=True)):
                global_idx += 1

                cell_w = max(1, box.x1 - box.x0)
                cell_h = max(1, box.y1 - box.y0)

                # Context crop around the cell, clamped within the column.
                ctx_px_x = int(round(cell_w * float(args.context_pad)))
                ctx_px_y = int(round(cell_h * float(args.context_pad)))
                ctx_x0 = max(int(col_box.x0), int(box.x0) - ctx_px_x)
                ctx_x1 = min(int(col_box.x1), int(box.x1) + ctx_px_x)
                ctx_y0 = max(0, int(box.y0) - ctx_px_y)
                ctx_y1 = min(img.height, int(box.y1) + ctx_px_y)

                # Optional inner margin (kept small; final crop uses ink bbox).
                mx = int(round(cell_w * float(args.cell_margin)))
                my = int(round(cell_h * float(args.cell_margin)))
                ctx_x0 = min(ctx_x1 - 1, ctx_x0 + mx)
                ctx_x1 = max(ctx_x0 + 1, ctx_x1 - mx)
                ctx_y0 = min(ctx_y1 - 1, ctx_y0 + my)
                ctx_y1 = max(ctx_y0 + 1, ctx_y1 - my)

                crop_ctx = img.crop((ctx_x0, ctx_y0, ctx_x1, ctx_y1))

                exp_cx = ((box.x0 + box.x1) / 2.0) - float(ctx_x0)
                exp_cy = ((box.y0 + box.y1) / 2.0) - float(ctx_y0)

                bbox_pad_px = max(
                    2, int(round(min(cell_w, cell_h) * float(args.bbox_pad)))
                )
                crop_final, ink_bbox, quality = trim_glyph(
                    crop_ctx,
                    expected_center=(exp_cx, exp_cy),
                    ink_threshold=int(args.bbox_ink_threshold),
                    pad_px=bbox_pad_px,
                )

                if ink_bbox is None:
                    page_crop_box = [ctx_x0, ctx_y0, ctx_x1, ctx_y1]
                else:
                    page_crop_box = [
                        int(ctx_x0 + ink_bbox[0]),
                        int(ctx_y0 + ink_bbox[1]),
                        int(ctx_x0 + ink_bbox[2]),
                        int(ctx_y0 + ink_bbox[3]),
                    ]
                quality["crop_box"] = page_crop_box

                if args.contrast and float(args.contrast) != 1.0:
                    crop_final = ImageEnhance.Contrast(crop_final).enhance(
                        float(args.contrast)
                    )

                out = render_square(
                    crop_final, size=int(args.size), inner_pad=int(args.inner_pad)
                )

                code = format_codepoint(ch)
                filename = f"lantingjixu_shenlong_{global_idx:04d}_{code}.png"
                out_path = output_dir / filename
                out.save(out_path, format="PNG", optimize=True)

                index_entries.append(
                    {
                        "index": global_idx,
                        "char": ch,
                        "codepoint": f"U+{ord(ch):X}",
                        "file": filename,
                        "source": {
                            "image": img_path.name,
                            "image_index": page_i,
                            "line_index": global_col_idx,
                            "pos_in_line": row_in_col,
                            "line_text": line_text,
                            "grid": {"col": col_in_page, "row": row_in_col},
                            "cell_box": [box.x0, box.y0, box.x1, box.y1],
                            "context_box": [ctx_x0, ctx_y0, ctx_x1, ctx_y1],
                            "crop_box": quality["crop_box"],
                            "ink_bbox": ink_bbox,
                            "quality": quality,
                            "column_box": [col_box.x0, 0, col_box.x1, img.height],
                        },
                    }
                )

                if overlay is not None and draw is not None:
                    # Draw final crop_box in cyan.
                    fx0, fy0, fx1, fy1 = quality["crop_box"]
                    draw.rectangle([fx0, fy0, fx1, fy1], outline=(0, 220, 255), width=2)
                    # Draw original cell box in yellow.
                    draw.rectangle(
                        [box.x0, box.y0, box.x1, box.y1], outline=(255, 200, 0), width=1
                    )

        if overlay is not None:
            overlay.save(
                debug_dir / f"overlay_{page_i:02d}_{img_path.stem}.jpg",
                format="JPEG",
                quality=86,
            )

    with (output_dir / "index.json").open("w", encoding="utf-8") as f:
        json.dump(
            {
                "name": "兰亭集序 · 神龙本（竖排）",
                "source": WIKISOURCE_RAW_URL,
                "total_images": len(image_paths),
                "total_columns": len(lines),
                "total_chars": global_idx,
                "files": index_entries,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    with (output_dir / "text.txt").open("w", encoding="utf-8") as f:
        f.write("".join(lines))

    print(f"Wrote {global_idx} character images to {output_dir}")
    return 0


def _natural_page_key(p: Path) -> int:
    m = re.search(r"(\d+)$", p.stem)
    return int(m.group(1)) if m else 0


def fetch_raw(url: str) -> str:
    return subprocess.check_output(["curl", "-L", "-sS", url], text=True)


def extract_lanting_vertical_lines(raw: str) -> list[str]:
    # Extract the vertical writing span in the "竖排" section.
    key = "writing-mode|v"
    i = raw.find(key)
    if i == -1:
        raise ValueError("Cannot find vertical text marker")
    # Find first '>' after the marker.
    start = raw.find(">", i)
    if start == -1:
        raise ValueError("Cannot find span start")
    start += 1
    end = raw.find("</span>", start)
    if end == -1:
        raise ValueError("Cannot find span end")

    span = raw[start:end]

    # Normalize BR tags.
    span = span.replace("</br>", "\n").replace("<br/>", "\n").replace("<br>", "\n")
    span = span.replace("<br />", "\n")

    # Strip any remaining HTML tags.
    span = re.sub(r"<[^>]+>", "", span)

    # Templates and wiki markups (subset).
    # {{另|怏|快}} -> 怏
    span = re.sub(r"\{\{\s*另\s*\|\s*([^|}]+)\|[^}]+\}\}", r"\1", span)
    # Remove remaining {{...}}
    span = re.sub(r"\{\{[^}]+\}\}", "", span)

    # Language conversion markup: -{ ... }-
    def repl_lang(m: re.Match) -> str:
        inner = m.group(1)
        # Prefer zh-hant if present.
        m_hant = re.search(r"zh-hant:([^;]+)", inner)
        if m_hant:
            return m_hant.group(1)
        m_zh = re.search(r"zh:([^;]+)", inner)
        if m_zh:
            return m_zh.group(1)
        # Otherwise take the first segment.
        return inner.split(";")[0]

    span = re.sub(r"-\{([\s\S]*?)\}-", repl_lang, span)

    # Strip whitespace/punctuation.
    lines: list[str] = []
    for raw_line in span.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        line = re.sub(r"[\s，。；、「」『』【】《》〈〉（）()]+", "", line)
        line = re.sub(r"[0-9A-Za-z\[\]=·\-—:：,\.]+", "", line)
        line = re.sub(r"[！？，．…、；：]+", "", line)
        line = line.strip()
        if line:
            lines.append(line)

    return lines


def ink_mask(arr: np.ndarray, ink_threshold: int) -> np.ndarray:
    # arr is RGB uint8.
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)

    gray = (0.299 * r + 0.587 * g + 0.114 * b).astype(np.float32)

    # Red seal heuristic.
    # Important: keep *dark* red pixels (ink under seal), only suppress seal-like reds.
    redish = (r > 120) & ((r - g) > 40) & ((r - b) > 40)
    seal = redish & (gray > 82)

    ink = gray < float(ink_threshold)
    return ink & (~seal)


def _smooth_1d(x: np.ndarray, win: int) -> np.ndarray:
    if win <= 1:
        return x.astype(np.float32)
    w = np.ones(int(win), dtype=np.float32) / float(win)
    return np.convolve(x.astype(np.float32), w, mode="same")


def detect_columns(ink: np.ndarray) -> list[ColumnBox]:
    # x projection
    proj = ink.sum(axis=0).astype(np.float32)
    if proj.max() <= 0:
        return []
    proj = _smooth_1d(proj, 17)
    thr = float(proj.max()) * 0.14
    on = proj > thr

    segs = segments_1d(on, min_len=max(20, ink.shape[1] // 80))
    if not segs:
        return []

    # Merge segments separated by small gaps.
    merged: list[list[int]] = []
    for a, b in segs:
        if not merged:
            merged.append([a, b])
            continue
        if a - merged[-1][1] <= 18:
            merged[-1][1] = b
        else:
            merged.append([a, b])

    # Filter abnormal widths.
    widths = [b - a for a, b in merged]
    if not widths:
        return []
    med = float(np.median(np.array(widths, dtype=np.float32)))
    out: list[ColumnBox] = []
    for a, b in merged:
        w = b - a
        if w < max(18, int(med * 0.55)):
            continue
        out.append(ColumnBox(int(a), int(b)))

    return out


def expand_columns(
    cols: list[ColumnBox], img_width: int, *, pad_ratio: float
) -> list[ColumnBox]:
    if not cols:
        return cols

    cols_sorted = sorted(cols, key=lambda b: b.x0)
    widths = [max(1, c.x1 - c.x0) for c in cols_sorted]
    med = float(np.median(np.array(widths, dtype=np.float32)))
    pad = int(round(max(0.0, float(pad_ratio)) * med))
    pad = max(0, min(pad, int(med * 0.55)))

    out = [
        ColumnBox(x0=max(0, c.x0 - pad), x1=min(int(img_width), c.x1 + pad))
        for c in cols_sorted
    ]

    # Prevent overlaps by clamping to midpoints between original columns.
    for i in range(len(out) - 1):
        left_orig = cols_sorted[i]
        right_orig = cols_sorted[i + 1]
        mid = int(round((left_orig.x1 + right_orig.x0) / 2.0))
        # Ensure a small gap.
        out[i].x1 = min(out[i].x1, mid)
        out[i + 1].x0 = max(out[i + 1].x0, mid)

    # Make sure all are valid.
    fixed: list[ColumnBox] = []
    for c in out:
        x0 = int(max(0, c.x0))
        x1 = int(min(img_width, c.x1))
        if x1 <= x0 + 1:
            continue
        fixed.append(ColumnBox(x0=x0, x1=x1))
    return fixed


def segments_1d(on: np.ndarray, min_len: int) -> list[tuple[int, int]]:
    segs: list[tuple[int, int]] = []
    i = 0
    n = int(on.shape[0])
    while i < n:
        if bool(on[i]):
            j = i
            while j < n and bool(on[j]):
                j += 1
            if j - i >= int(min_len):
                segs.append((i, j))
            i = j
        else:
            i += 1
    return segs


def split_column_into_chars(
    ink: np.ndarray,
    col: ColumnBox,
    expected_count: int,
    *,
    min_cell_ratio: float,
) -> list[CharBox]:
    x0, x1 = int(col.x0), int(col.x1)
    ink_col = ink[:, x0:x1]
    if ink_col.size == 0:
        return []

    col_h = int(ink_col.shape[0])
    col_w = int(ink_col.shape[1])

    # Remove large solid occlusion rows (e.g. dark patch) to avoid dominating projections.
    row_sum = ink_col.sum(axis=1).astype(np.float32)
    heavy = row_sum > float(col_w) * 0.68
    if bool(np.any(heavy)):
        ink_col = ink_col.copy()
        ink_col[heavy, :] = False
        row_sum = ink_col.sum(axis=1).astype(np.float32)

    if float(row_sum.max()) <= 0:
        y_top, y_bottom = 0, col_h
    else:
        row_sum_s = _smooth_1d(row_sum, 11)
        total = float(np.sum(row_sum_s))
        if total <= 0:
            y_top, y_bottom = 0, col_h
        else:
            cum = np.cumsum(row_sum_s)
            y_top = int(np.searchsorted(cum, total * 0.004))
            y_bottom = int(np.searchsorted(cum, total * 0.996)) + 1
            y_top = max(0, min(y_top, col_h - 1))
            y_bottom = max(y_top + 1, min(y_bottom, col_h))

    height = max(1, y_bottom - y_top)
    step = height / float(expected_count)

    # Add padding to include stroke tails.
    pad_y = max(6, int(round(step * 0.22)))
    y_top = max(0, y_top - pad_y)
    y_bottom = min(col_h, y_bottom + pad_y)

    height = max(1, y_bottom - y_top)
    step = height / float(expected_count)

    proj = ink_col[y_top:y_bottom, :].sum(axis=1).astype(np.float32)
    proj = _smooth_1d(proj, max(9, int(round(step * 0.18)) | 1))

    min_cell = max(14, int(round(step * max(0.10, float(min_cell_ratio)))))
    center_win = max(10, int(round(step * 0.60)))

    # 1) Find per-character centers by snapping to local maxima.
    centers: list[int] = []
    for i in range(expected_count):
        y_expect = y_top + int(round(step * (i + 0.5)))
        a = max(y_top, y_expect - center_win)
        b = min(y_bottom, y_expect + center_win)
        if b - a <= 3:
            centers.append(int(max(y_top, min(y_expect, y_bottom - 1))))
            continue

        local = proj[(a - y_top) : (b - y_top)]
        y_rel = int(np.argmax(local))
        centers.append(int(a + y_rel))

    # 2) Enforce monotonic centers with a minimum spacing.
    half = max(3, min_cell // 2)
    centers[0] = max(centers[0], y_top + half)
    centers[-1] = min(centers[-1], y_bottom - half)
    for i in range(1, expected_count):
        centers[i] = max(centers[i], centers[i - 1] + min_cell)
    for i in range(expected_count - 2, -1, -1):
        centers[i] = min(centers[i], centers[i + 1] - min_cell)
    centers[0] = max(centers[0], y_top + half)
    centers[-1] = min(centers[-1], y_bottom - half)

    # 3) Build boundaries at midpoints between centers.
    boundaries: list[int] = [y_top]
    for i in range(1, expected_count):
        boundaries.append(int(round((centers[i - 1] + centers[i]) / 2.0)))
    boundaries.append(y_bottom)

    # 4) Refine boundaries to nearby local minima (between neighbors).
    refine_win = max(8, int(round(step * 0.35)))
    for i in range(1, expected_count):
        mid = boundaries[i]
        low = boundaries[i - 1] + min_cell
        high = boundaries[i + 1] - min_cell
        if high <= low:
            boundaries[i] = int(
                max(boundaries[i - 1] + 1, min(mid, boundaries[i + 1] - 1))
            )
            continue
        a = max(low, mid - refine_win)
        b = min(high, mid + refine_win)
        if b - a > 3:
            local = proj[(a - y_top) : (b - y_top)]
            y_rel = int(np.argmin(local))
            mid = int(a + y_rel)
        boundaries[i] = int(max(low, min(mid, high)))

    out: list[CharBox] = []
    for i in range(expected_count):
        cy0 = int(boundaries[i])
        cy1 = int(boundaries[i + 1])
        if cy1 <= cy0:
            cy1 = min(col_h, cy0 + 1)
        out.append(CharBox(x0=x0, y0=cy0, x1=x1, y1=cy1))
    return out


def trim_glyph(
    img: Image.Image,
    *,
    expected_center: tuple[float, float],
    ink_threshold: int,
    pad_px: int,
) -> tuple[Image.Image, list[int] | None, dict]:
    """Trim a context crop to a single glyph bbox.

    Returns:
      - trimmed image
      - ink bbox within the context crop (x0,y0,x1,y1) or None
      - quality dict (includes final crop_box placeholder filled by caller)
    """

    arr = np.array(img.convert("RGB"))
    ink = ink_mask(arr, ink_threshold=int(ink_threshold))
    h, w = ink.shape

    # Reject huge solid blocks (occlusion) inside this context crop.
    m = ink.astype(np.uint8)
    num, labels, stats, centroids = cv2.connectedComponentsWithStats(m, connectivity=8)

    region_area = float(h * w)
    min_area = max(36, int(region_area * 0.002))

    comps: list[tuple[float, int, int, int, int, int, float, float]] = []
    exp_x, exp_y = expected_center
    for i in range(1, int(num)):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < min_area:
            continue

        x = int(stats[i, cv2.CC_STAT_LEFT])
        y = int(stats[i, cv2.CC_STAT_TOP])
        ww = int(stats[i, cv2.CC_STAT_WIDTH])
        hh = int(stats[i, cv2.CC_STAT_HEIGHT])
        cx = float(centroids[i][0])
        cy = float(centroids[i][1])

        fill = float(area) / max(1.0, float(ww * hh))
        area_ratio = float(area) / max(1.0, region_area)

        # Complexity: occlusion blocks are usually "solid" with low perimeter/area.
        per_area = 0.0
        try:
            comp = (labels == i).astype(np.uint8) * 255
            contours, _ = cv2.findContours(
                comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            per = 0.0
            for cnt in contours:
                per += float(cv2.arcLength(cnt, True))
            per_area = per / max(1.0, float(area))
        except Exception:
            per_area = 0.0

        # Drop obvious occlusion blocks.
        if area_ratio >= 0.40 and fill >= 0.62 and per_area > 0 and per_area <= 0.052:
            continue

        dx = abs(cx - exp_x) / max(1.0, float(w))
        dy = abs(cy - exp_y) / max(1.0, float(h))
        dist = dx + dy

        size_bonus = min(1.0, float(area) / max(1.0, region_area * 0.10))

        # Penalize overly blocky components.
        block_penalty = 0.0
        if fill >= 0.70 and per_area > 0 and per_area <= 0.060:
            block_penalty += 0.18
        if area_ratio >= 0.65:
            block_penalty += 0.10

        # Penalize components that hug the crop edges.
        touch = int(x <= 1) + int(y <= 1) + int(x + ww >= w - 2) + int(y + hh >= h - 2)
        edge_penalty = 0.06 * float(touch)

        score = dist - 0.42 * size_bonus + block_penalty + edge_penalty
        comps.append((score, i, x, y, ww, hh, cx, cy))

    if not comps:
        # Fallback: no ink (or only occlusions). Keep the original context.
        quality = {
            "ink_pixels": int(ink.sum()),
            "cc": 0,
            "edge_touch": 0,
            "is_empty": True,
            "crop_box": None,
        }
        return img, None, quality

    comps.sort(key=lambda t: t[0])
    _, best_id, bx, by, bww, bhh, _, _ = comps[0]
    best_x0, best_y0 = bx, by
    best_x1, best_y1 = bx + bww, by + bhh

    # Include nearby components that belong to the same glyph.
    expand = max(8, int(round(min(w, h) * 0.10)))
    sel = []
    ex0 = max(0, best_x0 - expand)
    ex1 = min(w, best_x1 + expand)
    ey0 = max(0, best_y0 - expand)
    ey1 = min(h, best_y1 + expand)
    for _, cid, x, y, ww, hh, cx, cy in comps:
        if ex0 <= cx <= ex1 and ey0 <= cy <= ey1:
            sel.append((x, y, x + ww, y + hh, cid))

    x0 = min(s[0] for s in sel)
    y0 = min(s[1] for s in sel)
    x1 = max(s[2] for s in sel)
    y1 = max(s[3] for s in sel)

    # Pad and clamp.
    x0p = max(0, x0 - pad_px)
    y0p = max(0, y0 - pad_px)
    x1p = min(w, x1 + pad_px)
    y1p = min(h, y1 + pad_px)
    if x1p <= x0p + 1 or y1p <= y0p + 1:
        x0p, y0p, x1p, y1p = x0, y0, x1, y1

    # Edge touch metric (within 2px).
    tol = 2
    edge_touch = (
        int(x0p <= tol)
        + int(y0p <= tol)
        + int(x1p >= w - 1 - tol)
        + int(y1p >= h - 1 - tol)
    )

    ink_pixels = int((labels == best_id).sum())
    quality = {
        "ink_pixels": int(ink.sum()),
        "cc": int(len(sel)),
        "edge_touch": edge_touch,
        "is_empty": False,
        # filled by caller (page coordinates)
        "crop_box": None,
    }

    trimmed = img.crop((int(x0p), int(y0p), int(x1p), int(y1p)))
    return trimmed, [int(x0p), int(y0p), int(x1p), int(y1p)], quality


def format_codepoint(ch: str) -> str:
    cp = ord(ch)
    if cp <= 0xFFFF:
        return f"U{cp:04X}"
    if cp <= 0xFFFFF:
        return f"U{cp:05X}"
    return f"U{cp:06X}"


def render_square(img: Image.Image, size: int, inner_pad: int) -> Image.Image:
    bg = (10, 10, 12)
    canvas = Image.new("RGB", (size, size), bg)

    max_w = max(1, size - inner_pad * 2)
    max_h = max(1, size - inner_pad * 2)
    scale = min(max_w / img.width, max_h / img.height)
    new_w = max(1, int(round(img.width * scale)))
    new_h = max(1, int(round(img.height * scale)))
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(resized, (x, y))
    return canvas


if __name__ == "__main__":
    raise SystemExit(main())
